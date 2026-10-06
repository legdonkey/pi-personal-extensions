import assert from "node:assert/strict";
import { test } from "node:test";
import register from "../extensions/jev-inline-effort.ts";

const codexModel = (id = "gpt-6.1-sol") => ({
  provider: "openai-codex", id, api: "openai-codex-responses",
  thinkingLevelMap: { off: null, minimal: "low", low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" },
});

function setup({ thinking = "medium", model = codexModel() } = {}) {
  const events = new Map();
  const branch = [];
  const h = {
    events, branch, thinking, model, choices: [], calls: 0, warnings: [], status: undefined,
    error: undefined, abortDuringClassification: undefined, inputs: [],
    classifierAvailable: true, stopReason: "stop", confidence: 1,
  };
  register({
    on(name, handler) { events.set(name, handler); },
    appendEntry(customType, data) { branch.push({ type: "custom", customType, data }); },
    getThinkingLevel: () => h.thinking,
  });
  h.ctx = {
    get model() { return h.model; },
    signal: undefined,
    sessionManager: { getBranch: () => branch },
    ui: {
      setStatus(key, value) { assert.equal(key, "jev-inline-effort"); h.status = value; },
      notify(message, type) { h.warnings.push({ message, type }); },
    },
    modelRegistry: {
      findOfType(type, provider, id) {
        assert.deepEqual([type, provider, id], ["classifier", "openrouter", "~typesafe/jev-latest"]);
        return h.classifierAvailable ? {} : undefined;
      },
      async classify(_model, input) {
        h.calls++;
        h.inputs.push(input);
        h.abortDuringClassification?.abort();
        if (h.error) throw h.error;
        assert.deepEqual(Object.keys(input.questions), ["thinking"]);
        assert.deepEqual(Object.keys(input.questions.thinking.criteria), ["low", "medium", "high", "xhigh", "max"]);
        const choice = h.choices.shift() ?? "high";
        return {
          stopReason: h.stopReason,
          answers: { thinking: { type: "choice", choice, probabilities: { [choice]: h.confidence } } },
        };
      },
    },
  };
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
  assert.equal(h.status, "🧠 xhigh · 基线 medium");
  assert.deepEqual(h.branch.map(({ data }) => data), [{ timestamp: 1, thinkingLevel: "xhigh" }]);

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
  assert.equal(h.status, "🧠 low · 基线 medium");

  // 回到基线强度时也需要一条 update 抵消上一条。
  messages.push(assistant(6), user(7));
  const third = await h.request(messages);
  assert.ok(isPrefix(second.input, third.input));
  assert.deepEqual(updates(third), [[1, "xhigh"], [6, "low"], [9, "medium"]]);
  assert.equal(h.status, "🧠 medium");
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
  assert.equal(h.status, "🧠 high");
  assert.equal(h.branch.length, 1);
});

test("仅对物理 GPT-6 Codex 模型且思考未关闭时生效", async () => {
  const cases = [
    { model: { provider: "jev", id: "sol-auto", api: "pi-virtual" } },
    { model: { ...codexModel("gpt-5.6-sol") } },
    { model: { ...codexModel(), api: "openai-responses" } },
    { thinking: "off" },
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
  assert.equal(h.status, "🧠 low · 基线 medium");

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
  assert.equal(h.status, "🧠 medium · 未调整");
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
  assert.deepEqual(h.branch.at(-1).data, { timestamp: 3, thinkingLevel: "xhigh" });
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
  for (const [failure, apply] of Object.entries(failures)) {
    const h = setup({ thinking: "high" });
    apply(h);
    const payload = await h.request([system, user(1)], { base: "high" });
    assert.deepEqual(updates(payload), [], failure);
    assert.deepEqual(h.branch.map(({ data }) => data), [{ timestamp: 1, thinkingLevel: "high" }], failure);
    const warned = ["missing", "exception", "error"].includes(failure);
    assert.equal(h.warnings.length, warned ? 1 : 0, failure);
    if (warned) assert.match(h.warnings[0].message, /思考强度沿用 high/);
  }
});

test("取消分类时不记录决策、不提示失败", async () => {
  const cancellations = {
    before: (h) => { const c = new AbortController(); c.abort(); h.ctx.signal = c.signal; },
    during: (h) => { h.abortDuringClassification = new AbortController(); h.ctx.signal = h.abortDuringClassification.signal; },
    thrown: (h) => { h.error = new DOMException("已取消", "AbortError"); },
    stopReason: (h) => { h.stopReason = "aborted"; },
  };
  for (const [name, apply] of Object.entries(cancellations)) {
    const h = setup();
    apply(h);
    const payload = await h.request([system, user(1)]);
    assert.deepEqual(updates(payload), [], name);
    assert.equal(h.branch.length, 0, name);
    assert.equal(h.warnings.length, 0, name);
    if (name === "before") assert.equal(h.calls, 0);
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
