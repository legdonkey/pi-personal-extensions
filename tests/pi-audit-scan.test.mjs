import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeSession, buildReport, diffJson, LIMITS } from "../scripts/pi-audit-scan.mjs";

const system = (tools = []) => ({ type: "message", message: { role: "system", sections: { rules: "规则" }, toolsAdded: tools } });
const user = () => ({ type: "message", message: { role: "user", content: "问题" } });
const assistant = (timestamp, usage, extra = {}) => ({
  type: "message",
  message: { role: "assistant", provider: "openai-codex", api: "openai-codex-responses", model: "gpt-6.1-sol", thinkingLevel: "medium", stopReason: "stop", timestamp, usage, ...extra },
});
const signatures = (analysis) => analysis.problems.map(({ signature }) => signature);

test("识别上下文膨胀、超大工具定义与结果，以及扩展工具报错；内置工具报错不报告，pi 已截断的内置工具结果按截断上限判断", () => {
  const analysis = analyzeSession([
    system([{ name: "subagent", description: "x".repeat(LIMITS.toolDefinitionChars) }, { name: "read", description: "读文件" }]),
    user(),
    assistant(0, { input: 1000, cacheRead: LIMITS.baseInputTokens }),
    { type: "message", message: { role: "toolResult", toolName: "fetch_content", isError: true, content: [{ type: "text", text: "No API key" }] } },
    { type: "message", message: { role: "toolResult", toolName: "bash", isError: true, content: "exit 1" } },
    { type: "message", message: { role: "toolResult", toolName: "read", content: "x".repeat(LIMITS.truncatedToolResultChars + 1) } },
    { type: "message", message: { role: "toolResult", toolName: "bash", content: "x".repeat(LIMITS.truncatedToolResultChars) } },
    { type: "message", message: { role: "toolResult", toolName: "codemode", content: "x".repeat(LIMITS.toolResultChars + 1) } },
    { type: "custom", customType: "jev-inline-effort", data: {} },
  ], "a.jsonl");
  assert.deepEqual(signatures(analysis).sort(), ["base-input", "large-tool-result:codemode", "large-tool-result:read", "tool-error:fetch_content", "tool-size:subagent"]);
});

test("短间隔缓存失效按前置变化归因；超过间隔阈值的视为自然过期", () => {
  const analysis = analyzeSession([
    system(), user(),
    assistant(0, { input: 5000, cacheRead: 0 }),
    { type: "thinking_level_change", thinkingLevel: "high" },
    assistant(30_000, { input: 5000, cacheRead: 0 }),
    assistant(60_000, { input: 5000, cacheRead: 0 }, { model: "gpt-6-luna" }),
    assistant(60_000 + LIMITS.cacheGapMs + 1, { input: 5000, cacheRead: 0 }, { model: "gpt-6-luna" }),
    { type: "custom", customType: "jev-inline-effort", data: {} },
  ], "b.jsonl");
  assert.deepEqual(signatures(analysis), ["cache-miss:thinking", "cache-miss:model"]);
});

test("工具续接前置无客户端变化时归因服务端，并计入短间隔请求数", () => {
  const analysis = analyzeSession([
    system(), user(),
    assistant(0, { input: 8841, cacheRead: 0 }),
    { type: "message", message: { role: "toolResult", toolName: "fetch_content", isError: true, content: "ENOTFOUND" } },
    { type: "custom", customType: "web-search-results", data: {} },
    assistant(4_000, { input: 2529, cacheRead: 8832 }),
    assistant(8_000, { input: 11_419, cacheRead: 0 }),
    { type: "custom", customType: "jev-inline-effort", data: {} },
  ], "e.jsonl");
  assert.deepEqual(signatures(analysis).filter((s) => s.startsWith("cache-miss")), ["cache-miss:provider"]);
  assert.equal(analysis.metrics.cacheChecks, 2);
});

test("切换模型只归因紧随其后的一次未命中；之后同模型仍未命中归为服务端", () => {
  const analysis = analyzeSession([
    system(), user(),
    assistant(0, { input: 8870, cacheRead: 0 }),
    { type: "model_change", provider: "openai-codex", modelId: "gpt-6-luna" },
    user(),
    assistant(10_000, { input: 8867, cacheRead: 0 }, { model: "gpt-6-luna" }),
    assistant(15_000, { input: 9000, cacheRead: 0 }, { model: "gpt-6-luna" }),
    { type: "custom", customType: "jev-inline-effort", data: {} },
  ], "f.jsonl");
  assert.deepEqual(signatures(analysis), ["cache-miss:model", "cache-miss:provider"]);
});

test("物理 GPT-6 会话缺少 Jev 决策时提示；虚拟模型会话只报告虚拟模型", () => {
  assert.deepEqual(signatures(analyzeSession([system(), user(), assistant(0, { input: 10, cacheRead: 0 })], "c.jsonl")), ["jev-missing"]);
  assert.deepEqual(signatures(analyzeSession([system(), user(), assistant(0, { input: 10, cacheRead: 0 })], "c.jsonl", { jevEnabled: false })), []);
  const virtual = analyzeSession([{ type: "model_change", provider: "jev", modelId: "sol-auto" }, system(), user(), assistant(0, { input: 10, cacheRead: 0 })], "d.jsonl");
  assert.deepEqual(signatures(virtual), ["virtual-model"]);
});

test("报告按台账区分新旧问题，支持前缀匹配；配置差异列出增删改路径", () => {
  const analyses = [
    { metrics: { baseInput: 9000, input: 100, cacheRead: 900 }, problems: [
      { signature: "tool-size:subagent", detail: "大", file: "/s/a.jsonl" },
      { signature: "cache-miss:model", detail: "失效", file: "/s/a.jsonl" },
      { signature: "jev-missing", detail: "缺失", file: "/s/b.jsonl" },
    ] },
  ];
  const { markdown, freshCount } = buildReport({
    since: "2026-10-01", now: "2026-10-06T00:00:00Z", analyses, ledger: ["tool-size:*", "jev-missing"], configChanges: [], versionChanges: [],
  });
  assert.equal(freshCount, 1);
  assert.match(markdown, /### `cache-miss:model` · 1 次 · 1 个会话/);
  assert.match(markdown, /整体缓存命中率：90%/);
  assert.match(markdown, /- `tool-size:subagent` · 1 次/);
  assert.deepEqual(diffJson({ a: 1, b: { c: 2 } }, { a: 2, b: {}, d: true }), ["~ a: 1 → 2", "- b.c", "+ d: true"]);
});

test("服务端缓存未命中只在全期占比超过阈值时作为新问题报告", () => {
  const report = (cacheChecks) => buildReport({
    since: "2026-10-01", now: "2026-10-06T00:00:00Z", ledger: [], configChanges: [], versionChanges: [],
    analyses: [{ metrics: { baseInput: 9000, input: 100, cacheRead: 900, cacheChecks }, problems: [
      { signature: "cache-miss:provider", detail: "未命中", file: "/s/a.jsonl" },
    ] }],
  });
  const quiet = report(Math.ceil(1 / LIMITS.providerCacheMissRate));
  assert.equal(quiet.freshCount, 0);
  assert.match(quiet.markdown, /服务端缓存未命中：1\/20 次短间隔请求（5\.0%/);
  const loud = report(10);
  assert.equal(loud.freshCount, 1);
  assert.match(loud.markdown, /### `cache-miss:provider` · 1 次/);
});
