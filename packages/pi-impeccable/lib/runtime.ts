import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { locateEngine } from "./engine.ts";

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const skillDir = join(packageRoot, "skills/impeccable");
export const runnerPath = join(skillDir, "scripts/run.mjs");
export const commands: Record<string, { description: string; argumentHint: string }> = JSON.parse(
  readFileSync(join(skillDir, "scripts/command-metadata.json"), "utf8"),
);

function readObject(path: string, tolerant = false): Record<string, any> {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("必须为 JSON 对象");
    return value;
  } catch (error) {
    if (tolerant || (error instanceof Error && "code" in error && error.code === "ENOENT")) return {};
    throw new Error(`无法读取配置：${path}`, { cause: error });
  }
}

export function writeObject(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  renameSync(temp, path);
}

export function readPins(cwd: string): string[] {
  const path = join(cwd, ".pi/impeccable-pins.json");
  const pins = readObject(path).commands ?? [];
  if (!Array.isArray(pins) || pins.some((pin) => typeof pin !== "string" || !Object.hasOwn(commands, pin))) {
    throw new Error(`快捷命令必须来自 Impeccable 命令列表：${path}`);
  }
  return [...new Set(pins)];
}

export function changePin(cwd: string, action: string, command: string): string {
  if (!["pin", "unpin"].includes(action) || !Object.hasOwn(commands, command)) {
    throw new Error("用法：/impeccable <pin|unpin> <设计命令>");
  }
  const pins = readPins(cwd).filter((pin) => pin !== command);
  if (action === "pin") pins.push(command);
  writeObject(join(cwd, ".pi/impeccable-pins.json"), { commands: pins });
  return `${action === "pin" ? "已启用" : "已移除"} /${command}。执行 /reload 后更新命令列表。`;
}

export function hookEnabled(cwd: string): boolean {
  if (/^(1|true|yes|on)$/i.test(process.env.IMPECCABLE_HOOK_DISABLED ?? "")) return false;
  let enabled = true;
  for (const file of ["config.json", "config.local.json"]) {
    const hook = readObject(join(cwd, ".impeccable", file), true).hook;
    if (hook && Object.hasOwn(hook, "enabled")) enabled = hook.enabled !== false;
  }
  return enabled;
}

export function sessionKey(id: string): string {
  return "pi-" + createHash("sha256").update(id).digest("hex").slice(0, 32);
}

export function hookText(stdout: string): string {
  if (!stdout.trim()) return "";
  const value = JSON.parse(stdout);
  const text = value.hookSpecificOutput?.additionalContext ?? value.additionalContext
    ?? value.additional_context ?? value.reason;
  if (typeof text !== "string") throw new Error("Impeccable 返回了无法识别的钩子结果");
  return text;
}

export function adaptContext(stdout: string, automatic: boolean): string {
  const parts = stdout.split("\n\n---\n\n");
  let root: string | undefined;
  for (const part of parts) {
    if (part.startsWith("RESOLVED_CONTEXT:\n")) {
      root = JSON.parse(part.slice("RESOLVED_CONTEXT:\n".length)).projectRoot;
    }
  }
  return parts.map((part) => {
    if (part.startsWith("SUBAGENT_AUTHORIZATION:")) {
      return "PI_SUBAGENT_POLICY: 遵循当前宿主的子代理授权规则。技能加载本身不授权委派。获准后使用已验证可执行的代理与本包角色指令；否则按上游降级流程在当前线程完成，并披露评审方式。";
    }
    if (part.startsWith("MANUAL_DETECTOR_REQUIRED:") && automatic && root && hookEnabled(root)) {
      return "PI_AUTOMATIC_DETECTOR: Pi 在成功的 UI 编辑后运行即时检查，在结束前运行完整规则深度检查。不要重复手动扫描。钩子失败会单独报告，届时执行一次手动 detect。";
    }
    return part;
  }).join("\n\n---\n\n");
}

export interface RunOptions {
  cwd: string;
  input?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  sessionId?: string;
  automatic?: boolean;
}
export interface EngineResult {
  code: number;
  stdout: string;
  stderr: string;
  killed: boolean;
  outputPath?: string;
}

export async function runEngine(argv: string[], options: RunOptions): Promise<EngineResult> {
  if (!Array.isArray(argv) || argv.some((arg) => typeof arg !== "string" || arg.includes("\0"))) {
    throw new Error("argv 必须为不含空字符的字符串数组");
  }
  if (argv[0] === "pin") {
    if (argv.length !== 3) throw new Error("用法：pin <pin|unpin> <设计命令>");
    return { code: 0, stdout: changePin(options.cwd, argv[1], argv[2]), stderr: "", killed: false };
  }
  if (options.signal?.aborted) throw new Error("Impeccable 操作已取消");
  const timeoutMs = options.timeoutMs ?? (argv[0] === "live-poll" ? 660_000 : 60_000);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3_600_000) {
    throw new Error("timeoutMs 必须为 1 到 3600000 之间的整数");
  }
  const started = Date.now();
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  const binary = await locateEngine(signal);
  const remainingMs = timeoutMs - (Date.now() - started);
  if (remainingMs <= 0) throw new Error("Impeccable 操作超时");
  const result = await new Promise<EngineResult>((resolveResult, reject) => {
    const child = spawn(binary, argv, {
      cwd: options.cwd,
      env: {
        ...process.env,
        IMPECCABLE_PROVIDER_ID: "pi",
        IMPECCABLE_SKILL_DIR: skillDir,
        IMPECCABLE_SELF: join(skillDir, "scripts", process.platform === "win32" ? "impeccable.cmd" : "impeccable"),
        ...(options.sessionId ? { IMPECCABLE_SESSION_ID: sessionKey(options.sessionId) } : {}),
        ...(argv[0] === "hook" ? { IMPECCABLE_HOOK_HARNESS: "claude" } : {}),
      },
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    let stdout = "", stderr = "", killed = false;
    let forceTimer: NodeJS.Timeout | undefined;
    const kill = () => {
      if (killed) return;
      killed = true;
      if (process.platform === "win32") {
        if (child.pid) spawn(join(process.env.SystemRoot || "C:\\Windows", "System32/taskkill.exe"), ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }).on("error", () => child.kill());
      } else {
        const signalGroup = (signal: NodeJS.Signals) => {
          try { if (child.pid) process.kill(-child.pid, signal); } catch { /* 进程组可能已退出。 */ }
        };
        signalGroup("SIGTERM");
        forceTimer = setTimeout(() => signalGroup("SIGKILL"), 2_000);
        forceTimer.unref();
      }
    };
    const timer = setTimeout(kill, remainingMs);
    options.signal?.addEventListener("abort", kill, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      // 引擎提前退出时，仍清理同一进程组中的后代。
      if (forceTimer && !killed) clearTimeout(forceTimer);
      options.signal?.removeEventListener("abort", kill);
    };
    child.stdout.setEncoding("utf8").on("data", (data) => { stdout += data; if (stdout.length + stderr.length > 10_000_000) kill(); });
    child.stderr.setEncoding("utf8").on("data", (data) => { stderr += data; if (stdout.length + stderr.length > 10_000_000) kill(); });
    child.stdin.on("error", () => {});
    child.once("error", (error) => { cleanup(); reject(error); });
    child.once("close", (code) => {
      cleanup();
      resolveResult({ code: killed ? 1 : code ?? 1, stdout, stderr, killed });
    });
    child.stdin.end(options.input ?? "");
    if (options.signal?.aborted) kill();
  });
  if (argv[0] === "context" && result.code === 0) result.stdout = adaptContext(result.stdout, options.automatic === true);
  if (argv[0] === "hooks" && result.code === 0) {
    result.stdout += `\nPi 原生钩子：${hookEnabled(options.cwd) ? "开启" : "关闭"}；加载本包扩展后生效。\n`;
  }
  return result;
}

export function resultText(result: EngineResult): string {
  let text = [result.stdout, result.stderr, result.killed ? "操作超时或已取消。" : ""].filter(Boolean).join("\n");
  if (!text) text = `Impeccable 已完成，退出码 ${result.code}。`;
  if (text.length > 40_000) {
    const path = join(mkdtempSync(join(tmpdir(), "pi-impeccable-")), "output.txt");
    writeFileSync(path, text, { mode: 0o600 });
    result.outputPath = path;
    return text.slice(0, 40_000) + `\n输出已截断。完整输出：${path}`;
  }
  return text;
}
