import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { once } from "node:events";
import { ModelRegistry, ModelRuntime } from "@earendil-works/pi-coding-agent";
import { streamSimple as streamClaude } from "@earendil-works/pi-ai/api/anthropic-messages";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readEffortSettings, saveEffortSettings } from "../extensions/inline-effort.ts";

let previousDir;
let dir;
const configPath = () => join(dir, "inline-effort.json");
beforeEach(() => {
  previousDir = process.env.PI_CODING_AGENT_DIR;
  dir = mkdtempSync(join(tmpdir(), "pi-effort-test-"));
  process.env.PI_CODING_AGENT_DIR = dir;
});
afterEach(() => {
  if (previousDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousDir;
  rmSync(dir, { recursive: true, force: true });
});
import register from "../extensions/inline-effort.ts";

const codexModel = (id = "gpt-6.1-sol") => ({
  provider: "openai-codex", id, api: "openai-codex-responses",
  thinkingLevelMap: { off: null, minimal: "low", low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" },
});

function setup({ thinking = "medium", model = codexModel() } = {}) {
  const events = new Map();
  const branch = [];
  const commands = new Map();
  const h = {
    events, branch, thinking, model, choices: [], calls: 0, warnings: [], status: undefined,
    error: undefined, abortDuringClassification: undefined, inputs: [],
    classifierAvailable: true, stopReason: "stop", confidence: 1,
    classifierModels: [], selections: [], selectResult: undefined, selectHook: undefined,
    idle: true, classifyHook: undefined, d1InCatalog: false,
  };
  register({
    on(name, handler) { events.set(name, handler); },
    registerCommand(name, command) { commands.set(name, command); },
    appendEntry(customType, data) { branch.push({ type: "custom", customType, data }); },
    getThinkingLevel: () => h.thinking,
  });
  h.ctx = {
    get model() { return h.model; },
    signal: undefined,
    hasUI: true,
    isIdle: () => h.idle,
    sessionManager: { getBranch: () => branch },
    ui: {
      setStatus(key, value) { assert.equal(key, "jev-inline-effort"); h.status = value; },
      notify(message, type) { h.warnings.push({ message, type }); },
      async select(title, choices, options) {
        h.selections.push({ title, choices, options });
        await h.selectHook?.(options.signal);
        return typeof h.selectResult === "number" ? choices[h.selectResult] : h.selectResult;
      },
    },
    modelRegistry: {
      findOfType(type, provider, id) {
        assert.deepEqual([type, provider], ["classifier", "openrouter"]);
        assert.ok(["~typesafe/jev-latest", "liquid/d1-ultra"].includes(id));
        return h.classifierAvailable && (id !== "liquid/d1-ultra" || h.d1InCatalog) ? {
          type: "classifier", provider, id, api: "typesafe-system-one", baseUrl: "https://openrouter.ai/api/v1",
          input: ["text"], contextWindow: 262144,
          cost: { input: 0.1, output: 0, cacheRead: 0, cacheWrite: 0 },
          headers: { "X-Test-Proxy": "configured" },
        } : undefined;
      },
      async classify(model, input, options) {
        h.calls++;
        h.classifierModels.push(model);
        h.inputs.push(input);
        await h.classifyHook?.(options.signal);
        assert.equal(options.timeoutMs, 15000);
        h.abortDuringClassification?.abort();
        if (h.error) throw h.error;
        assert.deepEqual(Object.keys(input.questions), ["thinking"]);
        assert.deepEqual(Object.keys(input.questions.thinking.criteria), ["low", "medium", "high", "xhigh", "max"]);
        const choice = h.choices.shift() ?? "high";
        if (h.result) return h.result;
        return {
          stopReason: h.stopReason,
          answers: { thinking: { type: "choice", choice, probabilities: { [choice]: h.confidence } } },
        };
      },
    },
  };
  h.command = (args = "") => commands.get("effort").handler(args, h.ctx);
  // 模拟 pi 的一次请求：先触发 context_with_system，再按 Responses 转换规则构造 payload。
  h.request = async (messages, { base = "medium", input } = {}) => {
    await events.get("context_with_system")({ type: "context_with_system", messages }, h.ctx);
    const payload = {
      model: h.model.id,
      reasoning: { effort: base, summary: "auto" },
      input: input ?? toInput(messages),
    };
    const result = events.get("before_provider_request")({ type: "before_provider_request", payload }, h.ctx);
    return result === undefined ? payload : result;
  };
  return h;
}

function toInput(messages) {
  return messages.flatMap((message) => {
    if (message.role === "system") return [{ role: "developer", content: "规则" }];
    if (message.role === "assistant") return [{ type: "message", role: "assistant", id: `msg_${message.timestamp}` }];
    if (message.role === "toolResult") return [{ type: "function_call_output", call_id: `c${message.timestamp}` }];
    if (message.role === "bashExecution" && message.excludeFromContext) return [];
    if (Array.isArray(message.content) && message.content.length === 0) return [];
    return [{ role: "user", content: [{ type: "input_text", text: String(message.timestamp) }] }];
  });
}

const system = { role: "system", content: "系统", timestamp: 0 };
const user = (timestamp, content = `问题 ${timestamp}`) => ({ role: "user", content, timestamp });
const assistant = (timestamp) => ({ role: "assistant", content: [{ type: "text", text: "回答" }], timestamp });
const toolResult = (timestamp) => ({ role: "toolResult", toolCallId: `c${timestamp}`, content: [], timestamp });
const updates = (payload) => payload.input.flatMap((item, index) =>
  item.type === "configuration_update" ? [[index, item.reasoning.effort]] : []);
const isPrefix = (prefix, full) => JSON.stringify(full.slice(0, prefix.length)) === JSON.stringify(prefix);

test("每条新用户消息分类一次，用 configuration_update 调整强度，顶层 effort 不变，历史前缀稳定", async () => {
  const h = setup();
  h.choices = ["xhigh", "low", "medium"];
  const messages = [system, user(1)];
  const first = await h.request(messages);
  assert.equal(h.calls, 1);
  assert.equal(first.reasoning.effort, "medium");
  assert.deepEqual(updates(first), [[1, "xhigh"]]);
  assert.equal(h.status, "🧠 xhigh · 基线 medium · Jev");
  assert.deepEqual(h.branch.map(({ data }) => data), [{ timestamp: 1, thinkingLevel: "xhigh", classifier: "jev" }]);

  // 工具续调不重新分类，插入位置不变。
  messages.push(assistant(2), toolResult(3));
  const continuation = await h.request(messages);
  assert.equal(h.calls, 1);
  assert.ok(isPrefix(first.input, continuation.input));

  messages.push(assistant(4), user(5));
  const second = await h.request(messages);
  assert.equal(h.calls, 2);
  assert.ok(isPrefix(continuation.input, second.input));
  assert.deepEqual(updates(second), [[1, "xhigh"], [6, "low"]]);
  assert.equal(h.status, "🧠 low · 基线 medium · Jev");

  // 回到基线强度时也需要一条 update 抵消上一条。
  messages.push(assistant(6), user(7));
  const third = await h.request(messages);
  assert.ok(isPrefix(second.input, third.input));
  assert.deepEqual(updates(third), [[1, "xhigh"], [6, "low"], [9, "medium"]]);
  assert.equal(h.status, "🧠 medium · Jev");
  for (let i = 1; i < third.input.length; i++) {
    assert.ok(!(third.input[i].type === "configuration_update" && third.input[i - 1].type === "configuration_update"));
  }
});

test("分类结果与生效强度相同时不插入 update，也不改写 payload", async () => {
  const h = setup({ thinking: "high" });
  h.choices = ["high"];
  const messages = [system, user(1)];
  const payload = await h.request(messages, { base: "high" });
  assert.deepEqual(updates(payload), []);
  assert.equal(h.status, "🧠 high · Jev");
  assert.equal(h.branch.length, 1);
});

test("不支持的模型、接口或关闭思考时不分类", async () => {
  const cases = [
    { model: { provider: "jev", id: "sol-auto", api: "pi-virtual" } },
    { model: { ...codexModel("gpt-5.6-sol") } },
    { model: { ...codexModel(), api: "openai-responses" } },
    { thinking: "off" },
    ...["claude-opus-4-6", "claude-opus-4-8", "claude-sonnet-5", "claude-sonnet-4-6"].map((id) => ({ model: claudeModel(id) })),
    { model: { ...claudeModel(), compat: {} } },
    { model: { ...claudeModel(), api: "bedrock-converse-stream" } },
    { model: claudeModel(), thinking: "off" },
    { model: { provider: "google", id: "gemini-4-argon", api: "google-generative-ai" } },
  ];
  for (const options of cases) {
    const h = setup(options);
    h.choices = ["max"];
    const payload = await h.request([system, user(1)]);
    assert.equal(h.calls, 0);
    assert.deepEqual(updates(payload), []);
    assert.equal(h.branch.length, 0);
  }
});

test("steering 与 follow-up 追加的用户消息重新分类，自定义消息和命令输出不分类", async () => {
  const h = setup();
  h.choices = ["high", "max"];
  const messages = [system, user(1)];
  await h.request(messages);
  messages.push(
    assistant(2), toolResult(3),
    { role: "custom", customType: "notice", content: "子代理完成", display: true, timestamp: 4 },
    { role: "bashExecution", command: "ls", output: "a", exitCode: 0, timestamp: 5 },
    { role: "bashExecution", command: "pwd", output: "/", exitCode: 0, excludeFromContext: true, timestamp: 6 },
    user(7, [{ type: "text", text: "改成深入分析" }]),
  );
  const payload = await h.request(messages);
  assert.equal(h.calls, 2);
  assert.match(h.inputs[1].state.prompt, /当前用户请求:\n改成深入分析/);
  assert.ok(!h.inputs[1].state.prompt.includes("子代理完成"));
  const max = updates(payload).find(([, effort]) => effort === "max");
  assert.deepEqual(payload.input[max[0] + 1].content[0].text, "7");
  assert.deepEqual(h.branch.map(({ data }) => data.timestamp), [1, 7]);
});

test("压缩后由摘要承接被压掉的最后一次决策，保留消息沿用各自锚点", async () => {
  const h = setup();
  h.choices = ["xhigh", "low"];
  await h.request([system, user(1)]);
  await h.request([system, user(1), assistant(2), user(3)]);
  assert.equal(h.calls, 2);

  const summary = { role: "compactionSummary", summary: "摘要", tokensBefore: 100, timestamp: 10 };
  // 保留 user(3)：摘要承接 xhigh，user(3) 再切到 low。
  const kept = await h.request([system, summary, user(3), assistant(4), toolResult(5)]);
  assert.deepEqual(updates(kept), [[1, "xhigh"], [3, "low"]]);
  assert.equal(h.status, "🧠 low · 基线 medium · Jev");

  // 本轮中途压缩掉当前消息：摘要承接本轮 low，强度不回落到基线。
  const midTurn = await h.request([system, summary, assistant(4), toolResult(5)]);
  assert.deepEqual(updates(midTurn), [[1, "low"]]);
  assert.equal(h.calls, 2);
});

test("分支只读取当前路径上的决策，切换分支后的新消息重新分类", async () => {
  const h = setup();
  h.choices = ["max", "low"];
  await h.request([system, user(1)]);
  h.branch.length = 0;
  const payload = await h.request([system, user(2)]);
  assert.equal(h.calls, 2);
  assert.deepEqual(updates(payload), [[1, "low"]]);
});

test("payload 的 user 项与上下文对不齐时不注入，并在状态栏提示", async () => {
  const h = setup();
  h.choices = ["xhigh"];
  const payload = await h.request([system, user(1)], { input: [] });
  assert.deepEqual(payload.input, []);
  assert.equal(h.status, "🧠 medium · 未调整 · Jev");
  // 没有对应的 context 快照时（例如其他来源的请求）保持原样。
  const raw = { model: "gpt-6.1-sol", reasoning: { effort: "medium" }, input: [{ role: "user", content: [] }] };
  assert.equal(h.events.get("before_provider_request")({ payload: raw }, h.ctx), undefined);
});

test("分类失败时沿用当前生效强度，取消时不记录也不报错", async () => {
  const h = setup();
  h.choices = ["xhigh"];
  await h.request([system, user(1)]);
  h.error = new Error("网络连接失败");
  const failed = await h.request([system, user(1), assistant(2), user(3)]);
  assert.deepEqual(h.branch.at(-1).data, { timestamp: 3, thinkingLevel: "xhigh", classifier: "jev" });
  assert.deepEqual(updates(failed), [[1, "xhigh"]]);
  assert.equal(h.warnings.length, 1);

  h.error = undefined;
  h.abortDuringClassification = new AbortController();
  h.ctx.signal = h.abortDuringClassification.signal;
  const entries = h.branch.length;
  const aborted = await h.request([system, user(1), assistant(2), user(3), assistant(4), user(5)]);
  assert.equal(h.branch.length, entries);
  assert.deepEqual(updates(aborted), []);
  assert.equal(h.warnings.length, 1);
});

test("会话切换、模型选择和退出时清除状态栏", () => {
  const h = setup();
  for (const event of ["session_start", "model_select", "session_shutdown"]) {
    h.status = "🧠 xhigh";
    h.events.get(event)({}, h.ctx);
    assert.equal(h.status, undefined);
  }
});

test("分类不可用、出错、截断、低置信度或结果无效时沿用当前生效强度", async () => {
  const failures = {
    missing: (h) => { h.classifierAvailable = false; },
    exception: (h) => { h.error = new Error("网络连接失败"); },
    error: (h) => { h.stopReason = "error"; },
    length: (h) => { h.stopReason = "length"; },
    confidence: (h) => { h.confidence = 0.49; },
    unknown: (h) => { h.choices = ["invalid"]; },
  };
  for (const selected of ["jev", "d1-ultra"]) {
    saveEffortSettings(selected);
    for (const [failure, apply] of Object.entries(failures)) {
      const h = setup({ thinking: "high" });
      apply(h);
      const payload = await h.request([system, user(1)], { base: "high" });
      assert.deepEqual(updates(payload), [], failure);
      assert.deepEqual(h.branch.map(({ data }) => data), [{ timestamp: 1, thinkingLevel: "high", classifier: selected }], failure);
      const warned = ["missing", "exception", "error"].includes(failure);
      assert.equal(h.warnings.length, warned ? 1 : 0, failure);
      if (warned) assert.match(h.warnings[0].message, /思考强度沿用 high/);
      assert.ok(h.classifierModels.every(({ id }) => id === (selected === "jev" ? "~typesafe/jev-latest" : "liquid/d1-ultra")));
    }
  }
});

test("取消分类时不记录决策、不提示失败", async () => {
  const cancellations = {
    before: (h) => { const c = new AbortController(); c.abort(); h.ctx.signal = c.signal; },
    customReason: (h) => { const c = new AbortController(); c.abort(new Error("private-abort-reason")); h.ctx.signal = c.signal; },
    during: (h) => { h.abortDuringClassification = new AbortController(); h.ctx.signal = h.abortDuringClassification.signal; },
    thrown: (h) => { h.error = new DOMException("已取消", "AbortError"); },
    stopReason: (h) => { h.stopReason = "aborted"; },
  };
  for (const selected of ["jev", "d1-ultra"]) {
    saveEffortSettings(selected);
    for (const [name, apply] of Object.entries(cancellations)) {
      const h = setup();
      apply(h);
      const payload = await h.request([system, user(1)]);
      assert.deepEqual(updates(payload), [], name);
      assert.equal(h.branch.length, 0, name);
      assert.equal(h.warnings.length, 0, name);
      if (name === "before" || name === "customReason") assert.equal(h.calls, 0);
    }
  }
});

test("分类输入限制文本长度，并排除系统规则、工具结果、思考内容和图片数据", async () => {
  const h = setup();
  await h.request([
    { role: "system", content: "系统秘密", timestamp: 0 },
    user(1, "历史内容".repeat(4000)),
    { role: "assistant", content: [{ type: "thinking", thinking: "思考秘密" }], timestamp: 2 },
    { role: "toolResult", toolCallId: "c3", content: [{ type: "text", text: "工具秘密" }], timestamp: 3 },
    user(4, [{ type: "text", text: "当前任务".repeat(4000) }, { type: "image", data: "图片秘密", mimeType: "image/png" }]),
  ]);
  const prompt = h.inputs[0].state.prompt;
  assert.ok(prompt.length < 16_200);
  for (const secret of ["系统秘密", "思考秘密", "工具秘密", "图片秘密"]) assert.ok(!prompt.includes(secret), secret);
});

test("配置默认 Jev，选择保存并跨实例读取；取消和无效选择不落盘", async () => {
  assert.deepEqual(readEffortSettings(), { model: "jev" });
  const h = setup();
  await h.command();
  assert.match(h.warnings.at(-1).message, /openrouter\/~typesafe\/jev-latest/);
  assert.equal(h.calls, 0);
  await h.command("model");
  assert.equal(existsSync(configPath()), false);
  h.selectResult = 1;
  await h.command("model");
  assert.deepEqual(readEffortSettings(), { model: "d1-ultra" });
  assert.match(h.selections.at(-1).choices[1], /d1-ultra.*liquid\/d1-ultra/);
  assert.equal(h.calls, 0, "选择不发请求，不宣称服务可用");
  assert.match(h.warnings.at(-1).message, /下一条尚未分类.*历史决策不变/);
  const saved = readFileSync(configPath(), "utf8");
  h.selectResult = undefined;
  await h.command("model");
  h.selectResult = "arbitrary";
  await h.command("model");
  for (const command of ["model paid", "model d1-ultra extra", "test d1-ultra", "status ignored", "unknown"]) {
    await h.command(command);
    assert.equal(h.warnings.at(-1).type, "warning");
  }
  assert.equal(readFileSync(configPath(), "utf8"), saved);
  assert.equal(statSync(configPath()).mode & 0o777, 0o600);
  assert.deepEqual(readdirSync(dir), ["inline-effort.json"]);
  const resumed = setup();
  await resumed.request([system, user(1)]);
  assert.equal(resumed.classifierModels[0].id, "liquid/d1-ultra");
  h.selectResult = 0;
  await h.command("model");
  assert.deepEqual(readEffortSettings(), { model: "jev" });
});

test("新配置缺失时读取旧文件，保存只写新文件并保留旧文件，新文件始终优先", async () => {
  const legacyPath = join(dir, "jev-inline-effort.json");
  const legacy = '{"model":"d1-ultra"}';
  writeFileSync(legacyPath, legacy);
  assert.deepEqual(readEffortSettings(), { model: "d1-ultra" });
  assert.equal(existsSync(configPath()), false, "读取旧文件不自动写入");
  const h = setup();
  await h.request([system, user(1)]);
  assert.equal(h.classifierModels[0].id, "liquid/d1-ultra");
  await h.command("model jev");
  assert.deepEqual(JSON.parse(readFileSync(configPath(), "utf8")), { model: "jev" });
  assert.equal(readFileSync(legacyPath, "utf8"), legacy);
  assert.deepEqual(readEffortSettings(), { model: "jev" });

  for (const invalid of ["{", "null", '{"model":"paid"}']) {
    writeFileSync(configPath(), invalid);
    assert.throws(readEffortSettings, /inline-effort.json|配置/);
    assert.equal(readFileSync(legacyPath, "utf8"), legacy);
  }
  rmSync(configPath());
  mkdirSync(configPath());
  assert.throws(readEffortSettings, /无法读取 inline-effort.json/, "新文件不可读时不回退旧文件");
  rmSync(configPath(), { recursive: true });
  for (const invalid of ["{", "null", '{"model":"paid"}']) {
    writeFileSync(legacyPath, invalid);
    assert.throws(readEffortSettings, /jev-inline-effort.json|配置/);
    assert.equal(existsSync(configPath()), false);
  }
});

test("沿用旧会话条目类型和状态栏键，恢复旧决策时不重新分类", async () => {
  const h = setup();
  const historical = { type: "custom", customType: "jev-inline-effort", data: { timestamp: 1, thinkingLevel: "xhigh" } };
  h.branch.push(structuredClone(historical));
  h.events.get("session_start")({}, h.ctx);
  const payload = await h.request([system, user(1)]);
  assert.deepEqual(updates(payload), [[1, "xhigh"]]);
  assert.equal(h.calls, 0);
  assert.equal(h.status, "🧠 xhigh · 基线 medium · Jev");
  assert.deepEqual(h.branch, [historical]);
  await h.request([system, user(1), assistant(2), user(3)]);
  assert.equal(h.branch.at(-1).customType, "jev-inline-effort");
});

test("配置无效时不偷用 Jev；选择器可修复配置，保存失败保留原状", async () => {
  const h = setup({ thinking: "high" });
  for (const raw of ["{", "null", "[]", "1", '{"model":null}', '{"model":false}', '{"model":{}}', '{"model":[]}', '{"model":""}', '{"model":"elephant"}', '{"model":"paid"}', '{"model":"constructor"}', '{"model":"__proto__"}', '{"model":"Jev"}']) {
    writeFileSync(configPath(), raw);
    assert.throws(readEffortSettings, /配置|格式|JSON/);
    await h.command("status");
    assert.equal(h.warnings.at(-1).type, "warning");
    await h.command("test");
    assert.equal(h.calls, 0);
    h.branch.length = 0;
    await h.request([system, user(1)], { base: "high" });
    assert.equal(h.calls, 0);
    assert.equal(h.branch[0].data.classifier, null);
    assert.equal(readFileSync(configPath(), "utf8"), raw);
  }
  h.selectResult = 1;
  await h.command("model");
  assert.deepEqual(readEffortSettings(), { model: "d1-ultra" });
  assert.match(h.selections.at(-1).title, /配置无效/);
  writeFileSync(configPath(), "{}");
  assert.deepEqual(readEffortSettings(), { model: "jev" });
  rmSync(configPath());
  mkdirSync(configPath());
  await h.command("model d1-ultra");
  assert.match(h.warnings.at(-1).message, /保存.*失败.*原配置/);
  assert.deepEqual(readdirSync(dir), ["inline-effort.json"], "失败后不留下临时文件");
  assert.throws(() => saveEffortSettings("paid"), /请选择/);
});

test("切换只影响新消息，不重分类旧消息；恢复、fork、分支和压缩保持历史前缀", async () => {
  const h = setup();
  h.choices = ["xhigh", "low", "max"];
  const messages = [system, user(1)];
  const first = await h.request(messages);
  await h.command("model d1-ultra");
  const replay = await h.request(messages);
  assert.deepEqual(replay.input, first.input);
  assert.equal(h.calls, 1);
  messages.push(assistant(2), user(3));
  const second = await h.request(messages);
  assert.ok(isPrefix(first.input, second.input));
  assert.deepEqual(h.classifierModels.map(({ id }) => id), ["~typesafe/jev-latest", "liquid/d1-ultra"]);
  assert.equal(h.branch.at(-1).data.classifier, "d1-ultra");
  assert.match(h.status, /d1-ultra$/);
  await h.command("status");
  assert.match(h.warnings.at(-1).message, /后续分类：openrouter\/liquid\/d1-ultra.*最近决策：low · d1-ultra/);
  const model = h.classifierModels[1];
  assert.equal(model.type, "classifier");
  assert.equal(model.api, "typesafe-system-one");
  assert.equal(model.baseUrl, "https://openrouter.ai/api/v1");
  assert.equal(model.contextWindow, 32768);
  assert.deepEqual(model.headers, { "X-Test-Proxy": "configured" });
  const restored = setup();
  restored.branch.push(...structuredClone(h.branch));
  restored.events.get("session_start")({}, restored.ctx);
  assert.deepEqual((await restored.request(messages)).input, second.input);
  assert.equal(restored.calls, 0);
  // 旧记录无 classifier 字段仍可恢复；当前分支以外的记录不参与。
  delete restored.branch[0].data.classifier;
  const summary = { role: "compactionSummary", summary: "摘要", timestamp: 10 };
  assert.deepEqual(updates(await restored.request([system, summary, user(3), assistant(4)])), [[1, "xhigh"], [3, "low"]]);
  await h.command("model jev");
  messages.push(assistant(4), user(5));
  const third = await h.request(messages);
  assert.ok(isPrefix(second.input, third.input));
  assert.equal(h.classifierModels.at(-1).id, "~typesafe/jev-latest");
  restored.branch.splice(1);
  await restored.request([system, user(1), assistant(2), user(6)]);
  assert.equal(restored.calls, 1);
  assert.equal(restored.classifierModels[0].id, "~typesafe/jev-latest");
});

test("d1-ultra 优先使用 Pi 目录中的条目；不可用不调用其他模型或改动主模型", async () => {
  saveEffortSettings("d1-ultra");
  const h = setup();
  h.d1InCatalog = true;
  await h.request([system, user(1)]);
  assert.equal(h.classifierModels[0].contextWindow, 262144, "原生目录条目优先于扩展的静态元数据");
  const mainModel = h.model;
  const mainThinking = h.thinking;
  h.stopReason = "error";
  await h.request([system, user(1), assistant(2), user(3)]);
  assert.deepEqual(h.classifierModels.map(({ id }) => id), ["liquid/d1-ultra", "liquid/d1-ultra"]);
  assert.equal(h.branch.at(-1).data.thinkingLevel, "high");
  assert.match(h.warnings.at(-1).message, /liquid\/d1-ultra.*沿用 high.*不会切换/);
  assert.equal(h.model, mainModel);
  assert.equal(h.thinking, mainThinking);
  assert.deepEqual(readEffortSettings(), { model: "d1-ultra" });
});

test("可用性测试只发送固定样例，成功、低置信度和失败均不写决策或改变状态", async () => {
  const h = setup();
  h.branch.push({ type: "custom", customType: "secret", data: "会话秘密" });
  h.status = "原状态";
  await h.command("model d1-ultra");
  await h.command("test");
  assert.match(h.warnings.at(-1).message, /liquid\/d1-ultra 测试成功/);
  assert.deepEqual(h.inputs[0].state, { prompt: "当前用户请求:\n把 hello 转成大写。" });
  assert.equal(h.branch.length, 1);
  assert.equal(h.status, "原状态");
  h.confidence = 0.49;
  await h.command("test");
  assert.match(h.warnings.at(-1).message, /已响应.*不会用于调整/);
  for (const failure of ["error", "throw"]) {
    h.stopReason = failure === "error" ? "error" : "stop";
    h.error = failure === "throw" ? new Error("secret-key-from-proxy") : undefined;
    await h.command("test");
    assert.match(h.warnings.at(-1).message, /liquid\/d1-ultra.*不可用/);
    assert.ok(!h.warnings.at(-1).message.includes("secret-key-from-proxy"));
    assert.equal(h.warnings.at(-1).type, "warning");
  }
  assert.equal(h.branch.length, 1);
  assert.equal(h.status, "原状态");
});

test("忙碌时禁止切换和测试；无 UI 的内部处理器提示菜单路径，显式参数仍可处理", async () => {
  const h = setup();
  h.idle = false;
  for (const command of ["model", "model d1-ultra", "test"]) await h.command(command);
  assert.equal(h.calls, 0);
  assert.equal(h.selections.length, 0);
  assert.equal(existsSync(configPath()), false);
  h.idle = true;
  h.ctx.hasUI = false;
  await h.command("model");
  assert.match(h.warnings.at(-1).message, /没有交互界面.*\/personal → 原位思考强度（Jev \/ d1-ultra） → 选择分类模型（Jev \/ d1-ultra）/);
  await h.command("model d1-ultra");
  assert.deepEqual(readEffortSettings(), { model: "d1-ultra" });
  h.ctx.hasUI = true;
  h.selectResult = 0;
  h.selectHook = () => { h.idle = false; };
  await h.command("model");
  assert.deepEqual(readEffortSettings(), { model: "d1-ultra" });
  assert.match(h.warnings.at(-1).message, /工作已开始.*未切换/);
});

test("超时沿用当前强度；迟到结果、生命周期取消及选择取消不写入", async (t) => {
  const timeout = new AbortController();
  const timeoutMock = t.mock.method(AbortSignal, "timeout", (ms) => {
    assert.equal(ms, 15000);
    return timeout.signal;
  });
  const h = setup({ thinking: "xhigh" });
  saveEffortSettings("d1-ultra");
  h.classifyHook = () => timeout.abort(new DOMException("超时", "TimeoutError"));
  await h.request([system, user(1)]);
  assert.equal(h.branch[0].data.thinkingLevel, "xhigh");
  assert.match(h.warnings.at(-1).message, /沿用 xhigh/);
  await h.command("test");
  assert.match(h.warnings.at(-1).message, /超时/);
  timeoutMock.mock.restore();

  for (const event of ["session_start", "session_shutdown", "model_select"]) {
    const pending = setup();
    let release;
    pending.classifyHook = () => new Promise((resolve) => { release = resolve; });
    const request = pending.request([system, user(1)]);
    assert.equal(typeof release, "function");
    pending.events.get(event)({}, pending.ctx);
    release();
    assert.deepEqual(updates(await request), []);
    assert.equal(pending.branch.length, 0);
    assert.equal(pending.warnings.length, 0);
    const probe = setup();
    probe.classifyHook = () => { probe.events.get(event)({}, probe.ctx); };
    await probe.command("test");
    assert.equal(probe.warnings.length, 0, "测试取消或会话切换后不显示迟到通知");
    const picker = setup();
    picker.selectResult = 0;
    picker.selectHook = () => { picker.events.get(event)({}, picker.ctx); };
    await picker.command("model");
    assert.deepEqual(readEffortSettings(), { model: "d1-ultra" }, "迟到的选择不能写回配置");
  }
});

test("空输入、图片、概率边界和无效答案按规则处理", async () => {
  saveEffortSettings("d1-ultra");
  for (const content of ["", " \n\t", []]) {
    const h = setup();
    await h.request([system, user(1, content)]);
    assert.equal(h.calls, 0);
  }
  const image = setup();
  await image.request([system, user(1, [{ type: "image", data: "secret-image", mimeType: "image/png" }])]);
  assert.match(image.inputs[0].state.prompt, /附有图片/);
  assert.ok(!image.inputs[0].state.prompt.includes("secret-image"));
  for (const probability of [0.5, 1, 0.4999, -1, 1.01, NaN, Infinity, "1", undefined]) {
    const h = setup();
    h.confidence = probability;
    const payload = await h.request([system, user(1)]);
    const accepted = probability === 0.5 || probability === 1;
    assert.deepEqual(updates(payload), accepted ? [[1, "high"]] : []);
    assert.equal(h.classifierModels[0].id, "liquid/d1-ultra");
  }
  const invalid = setup();
  for (const answers of [{}, { thinking: { type: "bool", probability: 1 } }, { thinking: { type: "choice", choice: "high" } }]) {
    invalid.branch.length = 0;
    invalid.result = { stopReason: "stop", answers };
    assert.deepEqual(updates(await invalid.request([system, user(1)])), []);
  }
});

function claudeModel(id = "claude-opus-5-5") {
  return {
    provider: "anthropic", id, api: "anthropic-messages", reasoning: true,
    baseUrl: "http://127.0.0.1:1", maxTokens: 1024, contextWindow: 1000000,
    input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    compat: { supportsMidConvoEffort: true, forceAdaptiveThinking: true },
    thinkingLevelMap: { off: null, minimal: "low", low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" },
  };
}

// 使用真实 Pi 序列化器，在 onPayload 截止，绝不向提供方发出请求。
async function serializeClaude(h, messages) {
  await h.events.get("context_with_system")({ messages }, h.ctx);
  let payload;
  const result = await streamClaude(h.model, { messages }, {
    apiKey: "local-test-credential", reasoning: h.thinking,
    onPayload(body) {
      payload = h.events.get("before_provider_request")({ payload: body }, h.ctx) ?? body;
      throw new Error("serialization-only");
    },
  }).result();
  assert.ok(payload, result.errorMessage);
  const reply = { ...result, content: [{ type: "text", text: "回答" }], stopReason: "stop" };
  delete reply.errorMessage;
  const finalized = h.events.get("message_end")({ message: reply }, h.ctx)?.message ?? reply;
  return { payload, reply: finalized };
}

const claudeMarkers = (body) => body.messages.filter((m) => m.output_config).map((m) => m.output_config.effort);
// Pi 将缓存断点移至最新消息；断点位置不是模型输入正文的一部分。
const withoutCacheHints = (value) => JSON.parse(JSON.stringify(value, (key, item) => key === "cache_control" ? undefined : item));

test("Claude 原生序列化保持顶层配置和历史前缀，实际 effort 随回复保存并重放", async () => {
  for (const id of ["claude-opus-5", "claude-opus-5-5", "claude-sonnet-5-5"]) {
    const h = setup({ model: claudeModel(id) });
    h.choices = ["xhigh", "low"];
    const messages = [system, user(1, [{ type: "text", text: "问题 1" }])];
    const first = await serializeClaude(h, messages);
    assert.equal(first.payload.thinking.type, "adaptive");
    assert.ok(first.payload.betas.includes("mid-conversation-output-config-2026-07-01"));
    assert.deepEqual(claudeMarkers(first.payload), ["xhigh"]);
    assert.equal(first.reply.providerThinkingLevel, "xhigh");
    assert.equal(h.thinking, "medium", "主会话基线不变");
    assert.equal(h.status, "🧠 xhigh · 基线 medium · Jev");
    messages.push(first.reply, user(3));
    const second = await serializeClaude(h, messages);
    assert.deepEqual(second.payload.output_config, first.payload.output_config);
    assert.deepEqual(second.payload.thinking, first.payload.thinking);
    assert.deepEqual(withoutCacheHints(second.payload.messages.slice(0, first.payload.messages.length)), withoutCacheHints(first.payload.messages));
    assert.deepEqual(claudeMarkers(second.payload), ["xhigh", "low"]);
    assert.equal(second.reply.providerThinkingLevel, "low");
    assert.equal(h.calls, 2);
    const restored = setup({ model: h.model });
    restored.branch.push(...structuredClone(h.branch));
    assert.deepEqual((await serializeClaude(restored, messages)).payload, second.payload);
    assert.equal(restored.calls, 0);
    h.error = new Error("unavailable");
    messages.push(second.reply, user(5));
    const failed = await serializeClaude(h, messages);
    assert.deepEqual(claudeMarkers(failed.payload), ["xhigh", "low", "low"]);
    assert.equal(failed.reply.providerThinkingLevel, "low");
    const summary = { role: "user", content: "压缩摘要", timestamp: 100 };
    const compacted = await serializeClaude(h, [system, summary, failed.reply]);
    assert.equal(compacted.payload.messages.at(-1).output_config.effort, "low");
  }
});

test("Claude 工具续调不重复分类，不改 thinking block；只修正匹配回复的元数据", async () => {
  const h = setup({ model: claudeModel() });
  h.choices = ["max"];
  const messages = [system, user(1)];
  const first = await serializeClaude(h, messages);
  first.reply.content = [
    { type: "thinking", thinking: "原样思考", thinkingSignature: "test-signature" },
    { type: "toolCall", id: "call_1", name: "test", arguments: {} },
  ];
  messages.push(first.reply, { ...toolResult(3), toolCallId: "call_1", toolName: "test", content: [{ type: "text", text: "结果" }] });
  const continued = await serializeClaude(h, messages);
  assert.equal(h.calls, 1);
  assert.deepEqual(claudeMarkers(continued.payload), ["max", "max"]);
  const thinking = continued.payload.messages.find((m) => m.role === "assistant").content[0];
  assert.deepEqual(thinking, { type: "thinking", thinking: "原样思考", signature: "test-signature" });
  assert.equal(continued.reply.providerThinkingLevel, "max");
  assert.equal(h.events.get("message_end")({ message: continued.reply }, h.ctx), undefined, "已消费的实际档位不泄漏到其他回复");
});

test("Claude 请求形状不符、取消和生命周期清理时不覆盖 payload 或回复", async () => {
  const good = {
    model: "claude-opus-5-5", thinking: { type: "adaptive" }, output_config: { effort: "low" },
    messages: [{ role: "system", content: [], output_config: { effort: "medium" } }],
  };
  for (const patch of [
    { model: "different" }, { thinking: { type: "disabled" } }, { thinking: { type: "between_tools" } },
    { messages: [] }, { messages: {} }, { messages: [{ role: "user", content: [] }] },
    { messages: [{ role: "system", content: "规则", output_config: { effort: "medium" } }] },
  ]) {
    const h = setup({ model: claudeModel() });
    await h.events.get("context_with_system")({ messages: [system, user(1)] }, h.ctx);
    const payload = { ...good, ...patch };
    const before = structuredClone(payload);
    assert.equal(h.events.get("before_provider_request")({ payload }, h.ctx), undefined);
    assert.deepEqual(payload, before);
    assert.equal(h.events.get("message_end")({ message: { ...assistant(2), ...h.model, model: h.model.id } }, h.ctx), undefined);
  }
  for (const event of ["session_start", "session_shutdown"]) {
    const h = setup({ model: claudeModel() });
    await h.events.get("context_with_system")({ messages: [system, user(1)] }, h.ctx);
    h.events.get("before_provider_request")({ payload: good }, h.ctx);
    h.events.get(event)({}, h.ctx);
    assert.equal(h.events.get("message_end")({ message: { ...assistant(2), api: h.model.api, provider: h.model.provider, model: h.model.id } }, h.ctx), undefined);
  }
  const cancelled = setup({ model: claudeModel() });
  cancelled.abortDuringClassification = new AbortController();
  cancelled.ctx.signal = cancelled.abortDuringClassification.signal;
  await cancelled.events.get("context_with_system")({ messages: [system, user(1)] }, cancelled.ctx);
  assert.equal(cancelled.events.get("before_provider_request")({ payload: good }, cancelled.ctx), undefined);
  assert.equal(cancelled.branch.length, 0);
});

test("Claude 内部重试重复应用档位，流式切模型后仍为旧回复保存实际值", async () => {
  const model = claudeModel();
  const h = setup({ model });
  h.choices = ["xhigh"];
  await h.events.get("context_with_system")({ messages: [system, user(1)] }, h.ctx);
  const body = {
    model: model.id, max_tokens: 1024, thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    messages: [{ role: "system", content: [], output_config: { effort: "medium" } }],
  };
  const send = () => h.events.get("before_provider_request")({ payload: structuredClone(body) }, h.ctx);
  assert.deepEqual(claudeMarkers(send()), ["xhigh"]);
  assert.deepEqual(claudeMarkers(send()), ["xhigh"], "strict-tools 内部重建不触发 context，仍须应用本次档位");
  h.model = codexModel();
  h.events.get("model_select")({ type: "model_select" }, h.ctx);
  assert.deepEqual(claudeMarkers(send()), ["xhigh"], "旧请求重试使用原模型快照");
  const reply = { ...assistant(2), api: model.api, provider: model.provider, model: model.id, providerThinkingLevel: "medium" };
  assert.equal(h.events.get("message_end")({ message: { ...reply, provider: "other" } }, h.ctx), undefined);
  assert.equal(h.events.get("message_end")({ message: reply }, h.ctx).message.providerThinkingLevel, "xhigh");
  assert.equal(h.events.get("message_end")({ message: reply }, h.ctx), undefined);
  assert.equal(send(), undefined, "匹配回复结束后清理快照");
  assert.equal(h.calls, 1);
});

test("Claude 分类等待和流式期间的预热回放不消费快照或污染实际档位", async () => {
  const h = setup({ model: claudeModel() });
  h.branch.push({ type: "custom", customType: "jev-inline-effort", data: { timestamp: 1, thinkingLevel: "high" } });
  h.choices = ["low"];
  let release;
  h.classifyHook = () => new Promise((resolve) => { release = resolve; });
  const pending = h.events.get("context_with_system")({ messages: [system, user(1), assistant(2), user(3)] }, h.ctx);
  const body = {
    model: h.model.id, max_tokens: 1, thinking: { type: "adaptive" },
    messages: [{ role: "system", content: [], output_config: { effort: "medium" } }],
  };
  assert.equal(h.events.get("before_provider_request")({ payload: body }, h.ctx), undefined);
  release();
  await pending;
  const main = h.events.get("before_provider_request")({ payload: { ...body, max_tokens: 1024 } }, h.ctx);
  assert.deepEqual(claudeMarkers(main), ["low"]);
  assert.equal(h.events.get("before_provider_request")({ payload: body }, h.ctx), undefined);
  const reply = { ...assistant(4), api: h.model.api, provider: h.model.provider, model: h.model.id, providerThinkingLevel: "medium" };
  assert.equal(h.events.get("message_end")({ message: reply }, h.ctx).message.providerThinkingLevel, "low");
  assert.equal(h.calls, 1);
});

test("真实 Pi classifier 管线复用 models.json 的代理端点、认证及头部，404 不伪报成功", async () => {
  const requests = [];
  let unavailable = false;
  const server = createServer(async (request, response) => {
    let data = "";
    for await (const chunk of request) data += chunk;
    const body = JSON.parse(data);
    requests.push({ url: request.url, headers: request.headers, body });
    response.writeHead(unavailable ? 404 : 200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(unavailable
      ? { error: { code: 404, message: "secret-key-from-proxy: no endpoints" } }
      : { answers: { thinking: { type: "choice", choice: "low", confidence: 1, probabilities: { low: 1 } } }, usage: { input_tokens: 10, output_tokens: 1 } }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
    const modelsPath = join(dir, "models.json");
    writeFileSync(modelsPath, JSON.stringify({ providers: { openrouter: {
      baseUrl, apiKey: "local-test-credential", headers: { "X-Test-Proxy": "configured" },
    } } }));
    const runtime = await ModelRuntime.create({
      authPath: join(dir, "auth.json"), modelsPath,
      modelsStorePath: join(dir, "models-cache.json"), allowModelNetwork: false,
    });
    const registry = new ModelRegistry(runtime);
    const before = registry.getModelsOfType("chat", "openrouter").map(({ id }) => id);
    const h = setup();
    h.ctx.modelRegistry = registry;
    await h.command("model d1-ultra");
    const payload = await h.request([system, user(1, "测试消息")]);
    assert.deepEqual(updates(payload), [[1, "low"]]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/api/v1/systemone");
    assert.equal(requests[0].headers.authorization, "Bearer local-test-credential");
    assert.equal(requests[0].headers["x-test-proxy"], "configured");
    assert.equal(requests[0].body.model, "liquid/d1-ultra");
    assert.equal(requests[0].body.questions.thinking.type, "choice");
    assert.deepEqual(registry.getModelsOfType("chat", "openrouter").map(({ id }) => id), before);
    unavailable = true;
    await h.command("test");
    assert.equal(requests.length, 2);
    assert.equal(h.warnings.at(-1).type, "warning");
    assert.match(h.warnings.at(-1).message, /liquid\/d1-ultra.*不可用/);
    assert.ok(!h.warnings.at(-1).message.includes("secret-key-from-proxy"));
    assert.equal(h.branch.length, 1);
    assert.equal(requests[1].body.model, "liquid/d1-ultra");
    assert.deepEqual(requests[1].body.state, { prompt: "当前用户请求:\n把 hello 转成大写。" });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
