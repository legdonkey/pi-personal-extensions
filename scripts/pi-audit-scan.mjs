#!/usr/bin/env node
// pi 会话周检：扫描上次运行后新增或更新的 pi 会话，统计上下文体量、缓存、错误和配置变化，生成 Markdown 报告。
// 只读取会话与配置，不调用模型。用法：node scripts/pi-audit-scan.mjs [--since <ISO 时间>] [--no-notify] [--dry-run]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HOME = homedir();
export const LIMITS = {
  baseInputTokens: 12_000, // 首轮输入（含缓存命中）超过即提示上下文膨胀
  toolDefinitionChars: 8_000, // 单个工具定义超过即提示
  toolResultChars: 20_000, // 单次工具结果超过即提示
  // pi 本体按 50KB 截断 read、bash、grep、find、ls 的结果；超过 50KB 加截断说明的长度才说明截断失效。
  truncatedToolResultChars: 52_000,
  cacheGapMs: 2 * 60_000, // 相邻请求间隔小于该值仍未命中缓存才算异常，避开服务端缓存自然过期
  cacheMissMinInput: 2_000,
  // 前置无客户端变化的缓存失效来自服务端（同一 WebSocket 连接上的 previous_response_id 增量请求也会出现），
  // 近几周基线约 2%；只在全期占比超过该值时报告。
  providerCacheMissRate: 0.05,
};
const SECRET_KEY = /key|token|secret|password|auth/i;
// 内置工具的报错多是模型正常试探（命令失败、路径不存在），只报告扩展工具的错误。
const BUILTIN_TOOLS = new Set(["bash", "read", "edit", "write", "grep", "find", "ls", "codemode", "tool_search"]);
const TRUNCATED_TOOLS = new Set(["bash", "read", "grep", "find", "ls"]);

export function paths(env = process.env) {
  const agentDir = env.PI_CODING_AGENT_DIR ?? join(HOME, ".pi", "agent");
  const auditDir = env.PI_AUDIT_HOME ?? join(agentDir, "audit");
  return {
    agentDir,
    auditDir,
    sessionsDir: join(agentDir, "sessions"),
    watched: {
      "settings.json": join(agentDir, "settings.json"),
      "personal-extensions.json": join(agentDir, "personal-extensions.json"),
      "web-search.json": existsSync(join(agentDir, "web-search.json")) ? join(agentDir, "web-search.json") : join(HOME, ".pi", "web-search.json"),
      "rpiv-ask-user-question.json": join(HOME, ".config", "rpiv-ask-user-question", "config.json"),
      "ponytail.json": join(HOME, ".config", "ponytail", "config.json"),
    },
  };
}

function readJsonl(file) {
  return readFileSync(file, "utf8").split("\n").flatMap((line) => {
    if (!line.trim()) return [];
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

function text(content) {
  if (typeof content === "string") return content;
  return Array.isArray(content) ? content.map((part) => part?.text ?? "").join("") : "";
}

/** 分析单个会话，返回指标与问题列表。问题的 signature 用于台账去重。 */
export function analyzeSession(entries, file, { jevEnabled = true } = {}) {
  const problems = [];
  const add = (signature, detail) => problems.push({ signature, detail, file });
  const metrics = { requests: 0, cacheRead: 0, input: 0, baseInput: undefined, cacheChecks: 0 };
  let system;
  let previous;
  let changedSincePrevious = [];
  let userMessages = 0;
  let jevDecisions = 0;
  let codexGpt6 = false;
  let virtual = false;

  for (const entry of entries) {
    if (entry.type === "model_change") {
      changedSincePrevious.push("model");
      if (entry.provider === "jev") virtual = true;
      if (entry.provider === "jev") add("virtual-model", `会话选择了已移除的虚拟模型 ${entry.provider}/${entry.modelId}`);
    }
    if (entry.type === "thinking_level_change") changedSincePrevious.push("thinking");
    if (entry.type === "custom" && entry.customType === "jev-inline-effort") jevDecisions++;
    if (entry.type !== "message") continue;
    const message = entry.message ?? {};

    if (message.role === "system") {
      if (!system) system = message;
      else if (message.toolsAdded?.length) changedSincePrevious.push("tools");
    } else if (message.role === "user") {
      userMessages++;
    } else if (message.role === "toolResult") {
      const output = text(message.content);
      if (message.isError && !BUILTIN_TOOLS.has(message.toolName)) add(`tool-error:${message.toolName}`, `${message.toolName} 报错：${output.slice(0, 160)}`);
      const limit = TRUNCATED_TOOLS.has(message.toolName) ? LIMITS.truncatedToolResultChars : LIMITS.toolResultChars;
      if (output.length > limit) {
        add(`large-tool-result:${message.toolName}`, `${message.toolName} 返回 ${output.length} 字符`);
      }
    } else if (message.role === "assistant") {
      const usage = message.usage ?? {};
      if (message.api === "pi-virtual") add("virtual-model", "请求仍使用虚拟模型");
      if (message.provider === "openai-codex" && String(message.model).startsWith("gpt-6") && message.thinkingLevel !== "off") codexGpt6 = true;
      if (message.stopReason === "error") {
        add(`assistant-error:${String(message.errorMessage ?? "").slice(0, 60)}`, String(message.errorMessage ?? "未知错误").slice(0, 300));
      }
      if (message.stopReason === "error" || message.stopReason === "aborted") { previous = undefined; continue; }
      metrics.requests++;
      metrics.input += usage.input ?? 0;
      metrics.cacheRead += usage.cacheRead ?? 0;
      metrics.baseInput ??= (usage.input ?? 0) + (usage.cacheRead ?? 0);
      const gap = previous ? message.timestamp - previous.timestamp : Infinity;
      if (previous && gap < LIMITS.cacheGapMs && (usage.input ?? 0) + (usage.cacheRead ?? 0) >= LIMITS.cacheMissMinInput) {
        metrics.cacheChecks++;
        if (usage.cacheRead === 0) {
          if (previous.model !== message.model) changedSincePrevious.push("model");
          const cause = [...new Set(changedSincePrevious)].sort().join("+");
          add(`cache-miss:${cause || "provider"}`, `间隔 ${Math.round(gap / 1000)} 秒仍全量计费 ${usage.input} tokens（${cause ? `前置变化：${cause}` : "前置无客户端变化"}）`);
        }
      }
      previous = message;
      changedSincePrevious = [];
    }
  }

  if (metrics.baseInput > LIMITS.baseInputTokens) add("base-input", `首轮输入 ${metrics.baseInput} tokens，超过 ${LIMITS.baseInputTokens}`);
  const toolSizes = (system?.toolsAdded ?? []).map((tool) => ({ name: tool.name, chars: JSON.stringify(tool).length }));
  for (const tool of toolSizes) {
    if (tool.chars > LIMITS.toolDefinitionChars) add(`tool-size:${tool.name}`, `工具 ${tool.name} 定义 ${tool.chars} 字符`);
  }
  if (jevEnabled && !virtual && codexGpt6 && userMessages > 0 && jevDecisions === 0) {
    add("jev-missing", `${userMessages} 条用户消息没有任何 Jev 原位强度决策`);
  }
  const sectionSizes = Object.fromEntries(Object.entries(system?.sections ?? {}).map(([key, value]) => [key, String(value).length]));
  return { file, metrics, problems, sectionSizes, toolSizes };
}

/** 列出 since 之后修改过的会话文件，跳过临时目录和子代理产物。 */
export function listSessions(sessionsDir, since) {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name);
      if (name.isDirectory()) {
        if (name.name.startsWith("--private-") || name.name === "subagent-artifacts") continue;
        walk(full);
      } else if (name.name.endsWith(".jsonl") && statSync(full).mtimeMs > since) {
        files.push(full);
      }
    }
  };
  if (existsSync(sessionsDir)) walk(sessionsDir);
  return files.sort();
}

/** 读取台账中已处理问题的 signature；末尾为 * 时按前缀匹配。 */
export function readLedger(file) {
  if (!existsSync(file)) return [];
  return [...readFileSync(file, "utf8").matchAll(/^- .*?`([^`]+)`/gm)].map((match) => match[1]);
}

const inLedger = (signature, ledger) =>
  ledger.some((entry) => entry.endsWith("*") ? signature.startsWith(entry.slice(0, -1)) : entry === signature);

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, SECRET_KEY.test(key) ? "<redacted>" : redact(inner)]));
  }
  return value;
}

/** 返回两个 JSON 值之间变化的路径，例如 "+ a.b"、"- a.c"、"~ a.d: 1 → 2"。 */
export function diffJson(before, after, prefix = "") {
  const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
  if (isObject(before) && isObject(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((key) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (!(key in before)) return [`+ ${path}: ${JSON.stringify(after[key])}`];
      if (!(key in after)) return [`- ${path}`];
      return diffJson(before[key], after[key], path);
    });
  }
  return JSON.stringify(before) === JSON.stringify(after) ? [] : [`~ ${prefix}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`];
}

function versions(agentDir) {
  const result = {};
  const run = (command, args) => {
    try { return execFileSync(command, args, { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return undefined; }
  };
  // 读托管安装记录的当前版本，不执行 pi：launchd 的 PATH 里没有 pi 启动脚本依赖的 node。
  try { result.pi = readFileSync(join(agentDir, "install", "current-version"), "utf8").trim(); } catch {}
  try {
    const deps = JSON.parse(readFileSync(join(agentDir, "npm", "package.json"), "utf8")).dependencies ?? {};
    for (const name of Object.keys(deps)) {
      try { result[name] = JSON.parse(readFileSync(join(agentDir, "npm", "node_modules", name, "package.json"), "utf8")).version; } catch {}
    }
  } catch {}
  const dirs = (dir) => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  const gitRoot = join(agentDir, "git");
  for (const host of dirs(gitRoot)) for (const owner of dirs(join(gitRoot, host))) for (const repo of dirs(join(gitRoot, host, owner))) {
    result[`git:${owner}/${repo}`] = run("git", ["-C", join(gitRoot, host, owner, repo), "rev-parse", "--short", "HEAD"]);
  }
  return result;
}

const median = (values) => {
  const sorted = values.filter((value) => value !== undefined).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : undefined;
};

export function buildReport({ since, now, analyses, ledger, configChanges, versionChanges }) {
  const cacheChecks = analyses.reduce((sum, { metrics }) => sum + (metrics.cacheChecks ?? 0), 0);
  const providerMisses = analyses.flatMap(({ problems }) => problems).filter(({ signature }) => signature === "cache-miss:provider").length;
  const providerRate = cacheChecks ? providerMisses / cacheChecks : 0;
  const groups = new Map();
  for (const analysis of analyses) for (const problem of analysis.problems) {
    if (problem.signature === "cache-miss:provider" && providerRate <= LIMITS.providerCacheMissRate) continue;
    const group = groups.get(problem.signature) ?? { signature: problem.signature, count: 0, details: [], files: new Set() };
    group.count++;
    if (group.details.length < 3) group.details.push(problem.detail);
    group.files.add(problem.file);
    groups.set(problem.signature, group);
  }
  const all = [...groups.values()].sort((a, b) => b.count - a.count);
  const fresh = all.filter((group) => !inLedger(group.signature, ledger));
  const known = all.filter((group) => inLedger(group.signature, ledger));
  const totals = analyses.reduce((sum, { metrics }) => ({ input: sum.input + metrics.input, cacheRead: sum.cacheRead + metrics.cacheRead }), { input: 0, cacheRead: 0 });
  const hitRate = totals.input + totals.cacheRead ? Math.round((totals.cacheRead / (totals.input + totals.cacheRead)) * 100) : 0;

  const lines = [
    `# pi 会话周检 ${now.slice(0, 10)}`,
    "",
    `- 扫描范围：${since} 之后更新的 ${analyses.length} 个会话`,
    `- 首轮输入中位数：${median(analyses.map(({ metrics }) => metrics.baseInput)) ?? "无数据"} tokens；整体缓存命中率：${hitRate}%`,
    `- 服务端缓存未命中：${providerMisses}/${cacheChecks} 次短间隔请求（${(providerRate * 100).toFixed(1)}%，超过 ${LIMITS.providerCacheMissRate * 100}% 才报告）`,
    `- 新问题：${fresh.length} 类；台账中已处理：${known.length} 类`,
    "",
    "## 新问题",
    "",
    ...(fresh.length ? fresh.flatMap((group) => [
      `### \`${group.signature}\` · ${group.count} 次 · ${group.files.size} 个会话`,
      "",
      ...group.details.map((detail) => `- ${detail}`),
      ...[...group.files].slice(0, 3).map((file) => `- 会话：\`${file}\``),
      "",
    ]) : ["无。", ""]),
    "## 配置变化",
    "",
    ...(configChanges.length ? configChanges.map((change) => `- ${change}`) : ["无。"]),
    "",
    "## 版本变化",
    "",
    ...(versionChanges.length ? versionChanges.map((change) => `- ${change}`) : ["无。"]),
    "",
    "## 台账中已处理的问题",
    "",
    ...(known.length ? known.map((group) => `- \`${group.signature}\` · ${group.count} 次`) : ["无。"]),
    "",
  ];
  return { markdown: lines.join("\n"), freshCount: fresh.length };
}

function main(argv) {
  const options = { notify: !argv.includes("--no-notify"), dryRun: argv.includes("--dry-run") };
  const sinceIndex = argv.indexOf("--since");
  const p = paths();
  const statePath = join(p.auditDir, "state.json");
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
  const now = new Date().toISOString();
  const since = sinceIndex >= 0 ? argv[sinceIndex + 1] : state.lastRun ?? new Date(Date.now() - 7 * 86_400_000).toISOString();

  let jevEnabled = true;
  try { jevEnabled = JSON.parse(readFileSync(p.watched["personal-extensions.json"], "utf8"))["jev-inline-effort"] !== false; } catch {}
  const analyses = listSessions(p.sessionsDir, Date.parse(since)).map((file) => analyzeSession(readJsonl(file), file, { jevEnabled }));

  const configs = {};
  for (const [name, file] of Object.entries(p.watched)) {
    try { configs[name] = redact(JSON.parse(readFileSync(file, "utf8"))); } catch { configs[name] = null; }
  }
  const configChanges = state.configs
    ? Object.keys(configs).flatMap((name) => diffJson(state.configs[name] ?? null, configs[name]).map((change) => `${name}：${change}`))
    : [];
  const currentVersions = versions(p.agentDir);
  const versionChanges = state.versions ? diffJson(state.versions, currentVersions) : [];

  const ledgerPath = join(p.auditDir, "ledger.md");
  const { markdown, freshCount } = buildReport({ since, now, analyses, ledger: readLedger(ledgerPath), configChanges, versionChanges });
  const reportPath = join(p.auditDir, "reports", `${now.slice(0, 10)}.md`);
  if (!options.dryRun) {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, markdown);
    writeFileSync(join(p.auditDir, "latest.md"), markdown);
    writeFileSync(statePath, `${JSON.stringify({ lastRun: now, configs, versions: currentVersions }, null, 2)}\n`);
    if (!existsSync(ledgerPath)) {
      writeFileSync(ledgerPath, "# pi 周检台账\n\n每行一个已处理的问题，格式为 `` - 状态 | `signature` | 说明 ``。状态写已修复、已接受或误报；signature 末尾加 * 表示按前缀匹配。\n\n");
    }
  }
  const changed = freshCount + configChanges.length + versionChanges.length;
  console.log(options.dryRun ? markdown : `报告：${reportPath}（新问题 ${freshCount} 类，配置变化 ${configChanges.length} 项，版本变化 ${versionChanges.length} 项）`);
  if (options.notify && !options.dryRun && changed > 0 && process.platform === "darwin") {
    const message = `新问题 ${freshCount} 类，配置变化 ${configChanges.length} 项，版本变化 ${versionChanges.length} 项`;
    try {
      execFileSync("osascript", ["-e", `display notification ${JSON.stringify(message)} with title "pi 会话周检" subtitle ${JSON.stringify(basename(reportPath))}`], { stdio: ["ignore", "ignore", "pipe"] });
      console.log("已发送系统通知");
    } catch (error) {
      console.error(`系统通知发送失败：${error.stderr?.toString().trim() || error.message}`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
