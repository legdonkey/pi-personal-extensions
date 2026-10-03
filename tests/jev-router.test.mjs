import assert from "node:assert/strict";
import { test } from "node:test";
import register from "../extensions/jev-router.ts";

const levels = ["low", "medium", "high", "xhigh", "max"];
const bases = [["sol-auto", "gpt-6.1-sol"], ["astra-auto", "gpt-6-astra"]];
const request = {
  reason: "user",
  thinkingLevel: "off",
  messages: [{ role: "user", content: "分析 Agent 工具循环的实现" }],
};

function setup() {
  const routers = new Map();
  const events = new Map();
  register({
    on(name, handler) { events.set(name, handler); },
    registerVirtualModel(model) { routers.set(model.id, model); },
  });
  const h = {
    routers, events, calls: 0, warnings: [], status: undefined,
    choice: "high", confidence: 1, stopReason: "stop",
    classifierAvailable: true, modelAvailable: true,
    error: undefined, abortDuringClassification: undefined, input: undefined,
    ctx: undefined,
  };
  h.ctx = {
    ui: {
      setStatus(_key, value) { h.status = value; },
      notify(message, type) { h.warnings.push({ message, type }); },
    },
    modelRegistry: {
      find(provider, id) { return h.modelAvailable ? { provider, id } : undefined; },
      findOfType(type, provider, id) {
        assert.deepEqual([type, provider, id], ["classifier", "openrouter", "~typesafe/jev-latest"]);
        return h.classifierAvailable ? {} : undefined;
      },
      async classify(_model, input) {
        h.calls++;
        h.input = input;
        h.abortDuringClassification?.abort();
        if (h.error) throw h.error;
        assert.deepEqual(Object.keys(input.questions), ["thinking"]);
        assert.deepEqual(Object.keys(input.questions.thinking.criteria), levels);
        return {
          stopReason: h.stopReason,
          answers: {
            thinking: { type: "choice", choice: h.choice, probabilities: { [h.choice]: h.confidence } },
            task: { type: "choice", choice: "luna", probabilities: { luna: 1 } },
          },
        };
      },
    },
  };
  return h;
}

test("注册两个固定基础模型，模型选择和会话事件清理状态提示", async () => {
  const h = setup();
  assert.deepEqual([...h.routers.keys()], bases.map(([id]) => id));
  for (const router of h.routers.values()) {
    assert.equal(router.provider, "jev");
    assert.deepEqual(router.thinkingLevels, ["off"]);
  }
  for (const event of ["session_start", "model_select", "session_shutdown"]) {
    h.status = "模型提示";
    h.events.get(event)({}, h.ctx);
    assert.equal(h.status, undefined);
  }
});

for (const [id, modelId] of bases) {
  test(`${id} 每轮只分类思考强度，续调和重试保持本轮选择`, async () => {
    const h = setup();
    const router = h.routers.get(id);
    let previous;
    for (const level of levels) {
      h.choice = level;
      const calls = h.calls;
      const route = await router.route({ ...request, previous, state: previous?.state }, h.ctx);
      assert.equal(h.calls, calls + 1);
      assert.deepEqual(route.model, { provider: "openai-codex", id: modelId });
      assert.equal(route.thinkingLevel, level);
      assert.deepEqual(route.state, { thinkingLevel: level });
      assert.equal(h.status, `🤖 ${modelId} · ${level}`);
      for (const reason of ["continuation", "retry"]) {
        const next = await router.route({ ...request, reason, state: route.state, previous: route }, h.ctx);
        assert.deepEqual(next.model, route.model);
        assert.equal(next.thinkingLevel, level);
        assert.equal(next.state, route.state);
      }
      assert.equal(h.calls, calls + 1);
      previous = route;
    }
    const same = await router.route({ ...request, state: previous.state }, h.ctx);
    assert.equal(same.state, previous.state);
  });

  test(`${id} 分类失败或无效时沿用思考强度，基础模型保持不变`, async () => {
    for (const failure of ["missing", "exception", "error", "length", "confidence", "unknown"]) {
      const h = setup();
      h.classifierAvailable = failure !== "missing";
      h.error = failure === "exception" ? new Error("网络连接失败") : undefined;
      h.stopReason = ["error", "length"].includes(failure) ? failure : "stop";
      h.confidence = failure === "confidence" ? 0.49 : 1;
      h.choice = failure === "unknown" ? "invalid" : "medium";
      const router = h.routers.get(id);
      for (const state of [undefined, { thinkingLevel: "xhigh" }]) {
        const route = await router.route({ ...request, state }, h.ctx);
        assert.equal(route.model.id, modelId);
        assert.equal(route.thinkingLevel, state?.thinkingLevel ?? "high");
        const calls = h.calls;
        const warnings = h.warnings.length;
        await router.route({ ...request, reason: "continuation", state: route.state }, h.ctx);
        assert.equal(h.calls, calls);
        assert.equal(h.warnings.length, warnings);
      }
      assert.equal(h.warnings.length, ["missing", "exception", "error"].includes(failure) ? 2 : 0);
      for (const warning of h.warnings) {
        assert.equal(warning.type, "warning");
        assert.match(warning.message, /基础模型保持不变/);
      }
    }
  });

  test(`${id} 压缩等独立请求和无状态续调均使用自身基础模型`, async () => {
    const h = setup();
    const router = h.routers.get(id);
    const previous = { model: { provider: "openai-codex", id: modelId }, thinkingLevel: "xhigh" };
    for (const reason of ["direct", "continuation", "retry"]) {
      const route = await router.route({ ...request, reason, previous }, h.ctx);
      assert.equal(route.model.id, modelId);
      assert.equal(route.thinkingLevel, "xhigh");
      assert.deepEqual(route.state, reason === "direct" ? undefined : { thinkingLevel: "xhigh" });
    }
    const failed = { ...previous, thinkingLevel: "medium" };
    assert.equal((await router.route({ ...request, reason: "retry", previous, failed }, h.ctx)).thinkingLevel, "medium");
    const foreign = { model: { provider: "openai-codex", id: "gpt-6-luna" }, thinkingLevel: "max" };
    const direct = await router.route({ ...request, reason: "direct", previous: foreign }, h.ctx);
    assert.equal(direct.model.id, modelId);
    assert.equal(direct.thinkingLevel, "high");
    const empty = await router.route({ ...request, messages: [] }, h.ctx);
    assert.equal(empty.model.id, modelId);
    assert.equal(empty.thinkingLevel, "high");
    assert.equal(h.calls, 0);
  });

  test(`${id} 取消分类请求时终止，不提示分类失败`, async () => {
    const h = setup();
    const router = h.routers.get(id);
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(router.route({ ...request, signal: cancelled.signal }, h.ctx), { name: "AbortError" });
    assert.equal(h.calls, 0);
    h.abortDuringClassification = new AbortController();
    await assert.rejects(router.route({ ...request, signal: h.abortDuringClassification.signal }, h.ctx), { name: "AbortError" });
    h.abortDuringClassification = undefined;
    h.error = new DOMException("已取消", "AbortError");
    await assert.rejects(router.route(request, h.ctx), { name: "AbortError" });
    h.error = undefined;
    h.stopReason = "aborted";
    await assert.rejects(router.route(request, h.ctx), { name: "AbortError" });
    assert.equal(h.warnings.length, 0);
  });

  test(`${id} 基础模型缺失时报告错误，不分类或改用其他模型`, async () => {
    const h = setup();
    h.modelAvailable = false;
    await assert.rejects(h.routers.get(id).route(request, h.ctx), /找不到基础模型/);
    assert.equal(h.calls, 0);
  });
}
