import assert from "node:assert/strict";
import { test } from "node:test";
import register from "../extensions/jev-router.ts";

const levels = ["low", "medium", "high", "xhigh", "max"];
const bases = [["luna-auto", "gpt-6-luna"], ["sol-auto", "gpt-6.1-sol"], ["astra-auto", "gpt-6-astra"]];
const request = {
  reason: "user",
  thinkingLevel: "off",
  messages: [{ role: "user", content: "分析 Agent 工具循环的实现" }],
};

function setup({ sessionId = "child-1", entries = [] } = {}) {
  const routers = new Map();
  const events = new Map();
  register({
    on(name, handler) { events.set(name, handler); },
    registerVirtualModel(model) { routers.set(model.id, model); },
    appendEntry(customType, data) { entries.push({ type: "custom", customType, data }); },
  });
  const h = {
    routers, events, calls: 0, warnings: [], status: undefined,
    choice: "high", confidence: 1, stopReason: "stop",
    modelChoice: "sol-auto", modelConfidence: 1, entries, sessionId, inputs: [],
    classifierAvailable: true, modelAvailable: true,
    error: undefined, abortDuringClassification: undefined, input: undefined,
    ctx: undefined,
  };
  h.ctx = {
    sessionManager: {
      getSessionId: () => h.sessionId,
      getEntries: () => entries,
    },
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
        h.inputs.push(input);
        h.abortDuringClassification?.abort();
        if (h.error) throw h.error;
        assert.deepEqual(Object.keys(input.questions), input.questions.model ? ["model", "thinking"] : ["thinking"]);
        if (input.questions.model) {
          assert.deepEqual(Object.keys(input.questions.model.criteria), bases.map(([id]) => id));
        }
        assert.deepEqual(Object.keys(input.questions.thinking.criteria), levels);
        return {
          stopReason: h.stopReason,
          answers: {
            thinking: { type: "choice", choice: h.choice, probabilities: { [h.choice]: h.confidence } },
            model: { type: "choice", choice: h.modelChoice, probabilities: { [h.modelChoice]: h.modelConfidence } },
          },
        };
      },
    },
  };
  return h;
}

test("注册三个固定基础模型及子代理自动入口，模型选择和会话事件清理状态提示", async () => {
  const h = setup();
  assert.deepEqual([...h.routers.keys()], [...bases.map(([id]) => id), "subagent-auto"]);
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
    const foreign = { model: { provider: "openai-codex", id: "foreign-model" }, thinkingLevel: "max" };
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

for (const [autoModelId, modelId] of bases) {
  test(`子代理首次选择 ${autoModelId}，后续消息只调整强度，恢复和压缩保持模型`, async () => {
    const h = setup();
    const router = h.routers.get("subagent-auto");
    h.modelChoice = autoModelId;
    h.choice = "medium";
    // fork 中的父模型不能代替当前子任务的首次分类。
    const parent = { model: { provider: "openai-codex", id: "gpt-6-astra" }, thinkingLevel: "max" };
    const first = await router.route({ ...request, previous: parent }, h.ctx);
    assert.equal(first.model.id, modelId);
    assert.equal(first.thinkingLevel, "medium");
    assert.equal(h.calls, 1);
    assert.ok(h.inputs[0].questions.model);
    assert.deepEqual(h.entries[0].data, { sessionId: "child-1", autoModelId });

    h.modelChoice = autoModelId === "astra-auto" ? "luna-auto" : "astra-auto";
    h.choice = "xhigh";
    const next = await router.route({ ...request, state: first.state, previous: first }, h.ctx);
    assert.equal(next.model.id, modelId);
    assert.equal(next.thinkingLevel, "xhigh");
    assert.equal(h.calls, 2);
    assert.equal(h.inputs[1].questions.model, undefined);
    assert.equal(h.entries.length, 1);
    for (const reason of ["continuation", "retry", "direct"]) {
      const route = await router.route({ ...request, reason, previous: next }, h.ctx);
      assert.equal(route.model.id, modelId);
      assert.equal(route.thinkingLevel, "xhigh");
      assert.equal(h.calls, 2);
    }

    // 重载后，即使当前分支没有路由状态，也读取会话级模型选择。
    const restored = setup({ entries: h.entries });
    restored.modelChoice = h.modelChoice;
    restored.choice = "low";
    const resumed = await restored.routers.get("subagent-auto").route(request, restored.ctx);
    assert.equal(resumed.model.id, modelId);
    assert.equal(resumed.thinkingLevel, "low");
    assert.equal(restored.input.questions.model, undefined);
    assert.equal(restored.entries.length, 1);
  });
}

test("不同子代理独立选模，fork 不继承父会话的模型锁定", async () => {
  const parent = setup({ sessionId: "parent" });
  parent.modelChoice = "astra-auto";
  await parent.routers.get("subagent-auto").route(request, parent.ctx);
  const children = bases.map(([autoModelId], index) => {
    const h = setup({ sessionId: `child-${index}`, entries: [...parent.entries] });
    h.modelChoice = autoModelId;
    return h;
  });
  const results = await Promise.all(children.map((h) => h.routers.get("subagent-auto").route(request, h.ctx)));
  assert.deepEqual(results.map((route) => route.model.id), bases.map(([, id]) => id));
  assert.ok(children.every((h) => h.calls === 1 && h.input.questions.model));
  assert.equal(parent.entries.length, 1);
});

test("子代理首次分类失败或模型结果无效时固定 Sol，后续故障沿用强度", async () => {
  for (const failure of ["missing", "exception", "error", "length", "confidence", "unknown"]) {
    const h = setup();
    h.classifierAvailable = failure !== "missing";
    h.error = failure === "exception" ? new Error("网络连接失败") : undefined;
    h.stopReason = ["error", "length"].includes(failure) ? failure : "stop";
    h.modelConfidence = failure === "confidence" ? 0.49 : 1;
    h.modelChoice = failure === "unknown" ? "invalid" : "astra-auto";
    h.choice = "medium";
    const router = h.routers.get("subagent-auto");
    const first = await router.route(request, h.ctx);
    assert.equal(first.model.id, "gpt-6.1-sol");
    assert.equal(h.entries[0].data.autoModelId, "sol-auto");
    h.error = new Error("分类不可用");
    const next = await router.route({ ...request, state: { thinkingLevel: "xhigh" } }, h.ctx);
    assert.equal(next.model.id, "gpt-6.1-sol");
    assert.equal(next.thinkingLevel, "xhigh");
    assert.equal(h.entries.length, 1);
  }
});

test("子代理的模型与思考强度分别校验，低置信度强度不影响有效模型选择", async () => {
  const h = setup();
  h.modelChoice = "luna-auto";
  h.confidence = 0.49;
  const route = await h.routers.get("subagent-auto").route(request, h.ctx);
  assert.equal(route.model.id, "gpt-6-luna");
  assert.equal(route.thinkingLevel, "high");
});

test("取消首次分类不保存模型选择，取消后可以重新选择", async () => {
  const h = setup();
  const router = h.routers.get("subagent-auto");
  h.abortDuringClassification = new AbortController();
  await assert.rejects(router.route({ ...request, signal: h.abortDuringClassification.signal }, h.ctx), { name: "AbortError" });
  assert.equal(h.entries.length, 0);
  assert.equal(h.warnings.length, 0);
  h.abortDuringClassification = undefined;
  h.modelChoice = "astra-auto";
  assert.equal((await router.route(request, h.ctx)).model.id, "gpt-6-astra");
});

test("选定模型缺失时保留选择并报错，不切换模型或重复选模", async () => {
  const h = setup();
  const router = h.routers.get("subagent-auto");
  h.modelAvailable = false;
  h.modelChoice = "luna-auto";
  await assert.rejects(router.route(request, h.ctx), /找不到基础模型 openai-codex\/gpt-6-luna/);
  assert.equal(h.entries[0].data.autoModelId, "luna-auto");
  assert.equal(h.calls, 1);
  h.modelChoice = "astra-auto";
  await assert.rejects(router.route(request, h.ctx), /找不到基础模型/);
  assert.equal(h.calls, 1);
  h.modelAvailable = true;
  assert.equal((await router.route(request, h.ctx)).model.id, "gpt-6-luna");
  assert.equal(h.input.questions.model, undefined);
});

test("任务前的独立请求不锁定模型，已锁定模型的独立请求不重新分类", async () => {
  const h = setup();
  const router = h.routers.get("subagent-auto");
  const direct = await router.route({ ...request, reason: "direct", messages: [] }, h.ctx);
  assert.equal(direct.model.id, "gpt-6.1-sol");
  assert.equal(direct.state, undefined);
  assert.equal(h.entries.length, 0);
  assert.equal(h.calls, 0);
  h.modelChoice = "astra-auto";
  const first = await router.route(request, h.ctx);
  const compact = await router.route({ ...request, reason: "direct", previous: first }, h.ctx);
  assert.equal(compact.model.id, "gpt-6-astra");
  assert.equal(h.calls, 1);
});

test("分类输入限制文本长度，并排除系统规则、工具结果和图片数据", async () => {
  const h = setup();
  await h.routers.get("subagent-auto").route({
    ...request,
    messages: [
      { role: "system", content: "系统秘密" },
      { role: "user", content: "历史内容".repeat(4000) },
      { role: "assistant", content: [{ type: "thinking", thinking: "思考秘密" }] },
      { role: "toolResult", content: [{ type: "text", text: "工具秘密" }] },
      { role: "user", content: [{ type: "text", text: "当前任务".repeat(4000) }, { type: "image", data: "图片秘密" }] },
    ],
  }, h.ctx);
  assert.ok(h.input.state.prompt.length < 16_200);
  for (const secret of ["系统秘密", "思考秘密", "工具秘密", "图片秘密"]) {
    assert.ok(!h.input.state.prompt.includes(secret));
  }
});
