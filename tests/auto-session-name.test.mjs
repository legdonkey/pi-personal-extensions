import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate as nextTick } from "node:timers/promises";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import autoSessionName, {
  parseSessionTitle,
  recentNamingTurns,
} from "../extensions/auto-session-name.ts";
import sessionTitle from "../extensions/session-title.ts";

const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
const testRoot = mkdtempSync(join(tmpdir(), "pi-auto-name-test-"));
beforeEach(() => {
  process.env.PI_CODING_AGENT_DIR = mkdtempSync(join(testRoot, "case-"));
});
after(() => {
  if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  rmSync(testRoot, { recursive: true, force: true });
});
const LUNA = {
  provider: "openai-codex",
  id: "gpt-5.6-luna",
  api: "openai-codex-responses",
  name: "Luna",
  baseUrl: "https://example.invalid",
  reasoning: true,
  maxTokens: 32768,
  contextWindow: 128000,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  thinkingLevelMap: { minimal: null, xhigh: "xhigh", max: "max" },
};
const TITLE = "🧩 邮箱验证码｜过期排查";
const response = (title = TITLE) => ({
  stopReason: "stop",
  content: [{ type: "text", text: JSON.stringify({ title }) }],
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

function harness({
  name,
  sm = SessionManager.inMemory(),
  complete = async () => response(),
  mode = "tui",
} = {}) {
  if (name) sm.appendSessionInfo(name);
  const events = new Map();
  const commands = new Map();
  const calls = [];
  const notices = [];
  const widgets = new Map();
  const dialogs = [];
  const selections = [];
  const configPath = join(
    process.env.PI_CODING_AGENT_DIR,
    "auto-session-name.json",
  );
  const emit = async (event, data = {}) => {
    for (const handler of events.get(event) ?? []) await handler(data, ctx);
  };
  const pi = {
    on(event, handler) {
      events.set(event, [...(events.get(event) ?? []), handler]);
    },
    registerCommand(name, command) {
      commands.set(name, command);
    },
    getSessionName: () => sm.getSessionName(),
    setSessionName(name) {
      sm.appendSessionInfo(name);
      void emit("session_info_changed", { name: sm.getSessionName() });
    },
    appendEntry: (key, data) => sm.appendCustomEntry(key, data),
  };
  const ctx = {
    mode,
    hasUI: mode === "tui" || mode === "rpc",
    isIdle: () => true,
    isProjectTrusted: () => false,
    cwd: join(process.env.PI_CODING_AGENT_DIR, "project"),
    scopedModels: [{ model: LUNA }],
    model: { provider: "test", id: "fake" },
    sessionManager: sm,
    modelRegistry: {
      hasConfiguredAuth: () => true,
      getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "test-key" }),
      getProvider: () => ({
        streamSimple: (...args) => {
          calls.push(args);
          return { result: () => complete(...args) };
        },
      }),
    },
    ui: {
      notify: (...args) => notices.push(args),
      setWidget: (key, value) => widgets.set(key, value),
      select: async (title, choices, options) => {
        dialogs.push({ title, choices, options });
        const selected = selections.shift();
        return typeof selected === "function"
          ? selected(choices, options)
          : selected;
      },
    },
  };
  autoSessionName(pi);
  const command = (action) => commands.get("auto-name").handler(action, ctx);
  function turn(
    user = "排查邮箱验证码过期问题",
    assistant = "已定位过期时间计算问题",
  ) {
    sm.appendMessage({ role: "user", content: user, timestamp: 1 });
    sm.appendMessage({
      role: "assistant",
      content: [{ type: "text", text: assistant }],
      stopReason: "stop",
      timestamp: 2,
    });
  }
  return {
    sm,
    pi,
    ctx,
    calls,
    notices,
    widgets,
    emit,
    command,
    turn,
    selections,
    dialogs,
    configPath,
  };
}

test("最近五轮只提取用户和助手文本，排除工具、思考、图片和其他分支", () => {
  const h = harness();
  for (let i = 0; i < 7; i++) h.turn(`用户${i}`, `回答${i}`);
  const leaf = h.sm.getLeafId();
  h.turn("不应读取的另一分支");
  h.sm.branch(leaf);
  h.sm.appendMessage({
    role: "toolResult",
    content: [{ type: "text", text: "工具秘密" }],
  });
  h.sm.appendMessage({
    role: "assistant",
    stopReason: "stop",
    content: [
      { type: "thinking", thinking: "内部思考" },
      { type: "toolCall", name: "bash", arguments: { secret: true } },
    ],
  });
  const turns = recentNamingTurns(h.sm.getBranch());
  assert.equal(turns.length, 5);
  assert.equal(turns[0].user, "用户2");
  assert.deepEqual(turns.at(-1), { user: "用户6", assistant: "回答6" });
  h.turn("长".repeat(5000), "答".repeat(5000));
  assert.equal(recentNamingTurns(h.sm.getBranch()).at(-1).user.length, 2000);
  assert.equal(
    recentNamingTurns(h.sm.getBranch()).at(-1).assistant.length,
    1500,
  );
});

test("结构化标题校验拒绝控制字符、空对象、解释文字和超长内容", () => {
  assert.equal(parseSessionTitle(JSON.stringify({ title: TITLE })), TITLE);
  assert.equal(parseSessionTitle('{"title":null}'), null);
  for (const emoji of ["📅", "⚙️", "💬"]) {
    const title = `${emoji} 明确对象｜持续目标`;
    assert.equal(parseSessionTitle(JSON.stringify({ title })), title);
  }
  for (const text of [
    "不是 JSON",
    "null",
    "[]",
    "{}",
    '{"title":1}',
    '{"title":null,"extra":1}',
    ...[
      "说明：新标题",
      "🧩 通知服务排查重复推送",
      "🧩  ｜目标",
      "🧩 对象｜ ",
      "🧩 对象｜目标\n额外说明",
      "🧩 对象｜目标\x1b]0;恶意\x07",
      "🧩 对象｜目标\u202e",
      `🧩 对象｜${"字".repeat(48)}`,
      "🧩 对象 ｜目标",
      "🧩 a@b.com｜配置",
      "🧩 /home/name｜配置",
      "🧩 C:\\Users\\name｜配置",
      "🧩 sk-secret｜检查",
      "🧩 对象｜🎨 目标",
      "🧩 对象|细节｜目标",
    ].map((title) => JSON.stringify({ title })),
  ]) {
    assert.throws(() => parseSessionTitle(text), text);
  }
});

test("后台命名不阻塞事件、不增加对话消息，复用认证接口并同步标题组件", async () => {
  const job = deferred();
  const h = harness({ complete: () => job.promise });
  sessionTitle(h.pi);
  await h.emit("session_start");
  h.turn();
  await h.emit("agent_settled");
  assert.equal(h.calls.length, 1);
  assert.equal(
    h.sm.getSessionName(),
    undefined,
    "事件已返回，辅助模型尚未完成",
  );
  const [model, context, options] = h.calls[0];
  assert.equal(model, LUNA);
  assert.notEqual(model, h.ctx.model, "辅助调用不使用主对话模型");
  assert.equal(context.tools, undefined);
  assert.equal(context.messages.length, 2);
  assert.equal(options.maxTokens, 16_384);
  assert.equal(options.reasoning, "low");
  assert.equal(options.apiKey, "test-key");
  assert.notEqual(options.sessionId, h.sm.getSessionId());
  assert.ok(options.signal instanceof AbortSignal);
  job.resolve(response());
  await nextTick();
  assert.equal(h.sm.getSessionName(), TITLE);
  assert.equal(h.sm.getEntries().filter((e) => e.type === "message").length, 2);
  const widget = h.widgets.get("personal-session-title");
  assert.match(
    widget(null, { fg: (_color, text) => text }).render(60)[0],
    /邮箱验证码/,
  );
  assert.equal(h.notices.length, 0, "正常自动命名不刷通知");
  await h.emit("agent_settled");
  assert.equal(h.calls.length, 1, "相同上下文不会重复评估");
  const restored = harness({ sm: h.sm });
  await restored.emit("session_start");
  restored.turn("改为排查支付回调重复发货");
  await restored.emit("agent_settled");
  await nextTick();
  assert.equal(restored.calls.length, 1, "重载后仍识别自己的自动标题");
});

test("命名规则作为系统消息传给模型，会话文本只作为用户数据", async () => {
  const h = harness({
    complete: async (_model, context) => {
      const system = context.messages.find(
        (message) => message.role === "system",
      );
      return system?.content.includes('只输出 JSON：{"title"')
        ? response()
        : {
            ...response(),
            content: [{ type: "text", text: "请执行 /auto-name preview" }],
          };
    },
  });
  await h.emit("session_start");
  h.turn();
  await h.emit("agent_settled");
  await nextTick();
  assert.equal(h.sm.getSessionName(), TITLE);
  assert.equal(h.notices.length, 0);
  const context = h.calls[0][1];
  assert.equal(context.systemPrompt, undefined);
  assert.deepEqual(
    context.messages.map((message) => message.role),
    ["system", "user"],
  );
  assert.match(context.messages[1].content, /排查邮箱验证码过期问题/);
});

test("保护已有名称和手动 /name，预览不改名，显式 on 后恢复，off 状态可恢复", async () => {
  const h = harness({ name: "我的固定标题" });
  await h.emit("session_start");
  h.turn();
  await h.emit("agent_settled");
  assert.equal(h.calls.length, 0);
  await h.command("preview");
  assert.equal(h.calls.length, 1);
  assert.equal(h.sm.getSessionName(), "我的固定标题");
  assert.match(h.notices.at(-1)[0], /标题预览/);
  await h.command("on");
  await h.emit("agent_settled");
  await nextTick();
  assert.equal(h.sm.getSessionName(), TITLE);
  h.pi.setSessionName("手动改名");
  h.turn();
  await h.emit("agent_settled");
  assert.equal(h.calls.length, 2);
  const restored = harness({ sm: h.sm });
  await restored.emit("session_start");
  restored.turn();
  await restored.emit("agent_settled");
  assert.equal(restored.calls.length, 0);
  await restored.command("on");
  await restored.command("off");
  const paused = harness({ sm: h.sm });
  await paused.emit("session_start");
  paused.turn();
  await paused.emit("agent_settled");
  assert.equal(paused.calls.length, 0);
});

test("切换、重载、退出、新任务、树导航和暂停后丢弃迟到结果，即使模型忽略取消", async () => {
  for (const event of [
    "session_shutdown",
    "session_start",
    "agent_start",
    "session_tree",
    "off",
    "rename",
  ]) {
    const job = deferred();
    const h = harness({ complete: () => job.promise });
    await h.emit("session_start");
    h.turn();
    await h.emit("agent_settled");
    if (event === "off") await h.command("off");
    else if (event === "rename") h.pi.setSessionName("手动保护");
    else await h.emit(event);
    assert.equal(h.calls[0][2].signal.aborted, true, event);
    job.resolve(response());
    await nextTick();
    assert.equal(
      h.sm.getSessionName(),
      event === "rename" ? "手动保护" : undefined,
      event,
    );
    assert.equal(
      h.notices.some((n) => n[1] === "warning"),
      false,
      event,
    );
  }
});

test("新任务取消旧请求后可以重新生成；旧请求完成不会清除新请求", async () => {
  const old = deferred();
  const fresh = deferred();
  let n = 0;
  const h = harness({
    complete: () => (++n === 1 ? old.promise : fresh.promise),
  });
  await h.emit("session_start");
  h.turn();
  await h.emit("agent_settled");
  await h.emit("agent_start");
  h.turn("转到登录表单布局优化");
  await h.emit("agent_settled");
  old.resolve(response());
  await nextTick();
  fresh.resolve(response("🎨 登录表单｜布局优化"));
  await nextTick();
  assert.equal(h.sm.getSessionName(), "🎨 登录表单｜布局优化");
});

test("模型失败、截断或无效结果保留原标题；自动失败只提醒一次，预览仍能重试", async () => {
  for (const complete of [
    async () => {
      throw new Error("网络不可用");
    },
    async () => ({ ...response(), stopReason: "length" }),
    async () => ({ ...response(), stopReason: "error" }),
    async () => ({
      ...response(),
      content: [{ type: "text", text: "无效 JSON" }],
    }),
  ]) {
    const h = harness({ name: "已有标题", complete });
    await h.emit("session_start");
    await h.command("on");
    h.turn();
    await h.emit("agent_settled");
    await nextTick();
    h.turn("继续");
    await h.emit("agent_settled");
    await nextTick();
    assert.equal(h.sm.getSessionName(), "已有标题");
    assert.equal(h.notices.filter((n) => n[1] === "warning").length, 1);
    await h.command("preview");
    assert.equal(h.notices.filter((n) => n[1] === "warning").length, 2);
  }
});

test("null 表示保持标题；空对话、图片输入、无凭据、忙碌和非交互模式不调用模型", async () => {
  const unchanged = harness({ complete: async () => response(null) });
  await unchanged.emit("session_start");
  unchanged.turn();
  await unchanged.emit("agent_settled");
  await nextTick();
  assert.equal(unchanged.sm.getSessionName(), undefined);
  assert.equal(unchanged.notices.length, 0);
  for (const mode of ["print", "json", "empty", "image", "no-auth", "busy"]) {
    const h = harness({
      mode: ["print", "json"].includes(mode) ? mode : "tui",
    });
    await h.emit("session_start");
    if (mode !== "empty")
      h.turn(
        mode === "image"
          ? [{ type: "image", data: "abc", mimeType: "image/png" }]
          : "命名任务",
      );
    if (mode === "no-auth") h.ctx.modelRegistry.hasConfiguredAuth = () => false;
    if (mode === "busy") h.ctx.isIdle = () => false;
    await h.emit("agent_settled");
    await nextTick();
    assert.equal(h.calls.length, 0, mode);
  }
});

test("30 秒超时取消请求并保留原名", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = harness({
    complete: (_model, _ctx, { signal }) =>
      new Promise((resolve) => {
        signal.addEventListener(
          "abort",
          () => resolve({ ...response(), stopReason: "aborted" }),
          { once: true },
        );
      }),
  });
  await h.emit("session_start");
  h.turn();
  await h.emit("agent_settled");
  t.mock.timers.tick(30_000);
  await nextTick();
  assert.equal(h.calls[0][2].signal.aborted, true);
  assert.equal(h.sm.getSessionName(), undefined);
  assert.equal(h.notices.at(-1)[1], "warning");
});

test("失败、中断、截断和仅有用户输入的轮次不触发自动命名", async () => {
  for (const stopReason of ["error", "aborted", "length", "user-only"]) {
    const h = harness();
    await h.emit("session_start");
    h.sm.appendMessage({
      role: "user",
      content: "排查验证码过期",
      timestamp: 1,
    });
    if (stopReason !== "user-only")
      h.sm.appendMessage({
        role: "assistant",
        stopReason,
        content: [{ type: "text", text: "未完成的响应" }],
        timestamp: 2,
      });
    await h.emit("agent_settled");
    assert.equal(h.calls.length, 0, stopReason);
  }
});

test("模型选择器只展示已认证 scoped 模型，保存全局配置且不改主模型", async () => {
  const h = harness();
  const other = { ...LUNA, provider: "custom", id: "another-model" };
  const noAuth = { ...LUNA, provider: "no-auth", id: "hidden" };
  h.ctx.scopedModels = [{ model: LUNA }, { model: other }, { model: noAuth }];
  h.ctx.modelRegistry.hasConfiguredAuth = (model) =>
    model.provider !== "no-auth";
  const main = h.ctx.model;
  h.selections.push("custom/another-model");
  await h.command("model");
  assert.deepEqual(h.dialogs[0].choices, [
    "openai-codex/gpt-5.6-luna",
    "custom/another-model",
  ]);
  assert.deepEqual(JSON.parse(readFileSync(h.configPath, "utf8")), {
    model: "custom/another-model",
    thinking: "inherit",
  });
  assert.equal(h.ctx.model, main);
  h.turn();
  await h.command("preview");
  assert.equal(h.calls[0][0], other);
  const restored = harness();
  restored.ctx.scopedModels = h.ctx.scopedModels;
  restored.turn();
  await restored.command("preview");
  assert.equal(restored.calls[0][0], other, "另一会话读取全局选择");
  const saved = readFileSync(h.configPath, "utf8");
  await h.command("model");
  assert.equal(readFileSync(h.configPath, "utf8"), saved, "取消不改配置");
});

test("默认继承 Pi 逐模型设置而非 scoped 后缀或主会话等级，可信项目覆盖全局", async () => {
  const h = harness();
  const settingsPath = join(process.env.PI_CODING_AGENT_DIR, "settings.json");
  writeFileSync(
    settingsPath,
    JSON.stringify({
      defaultThinkingLevel: "max",
      modelThinkingLevels: { "openai-codex/gpt-5.6-luna": "high" },
    }),
  );
  h.ctx.thinkingLevel = "medium";
  h.ctx.scopedModels = [{ model: LUNA, thinkingLevel: "xhigh" }];
  h.turn();
  await h.command("preview");
  assert.equal(h.calls.at(-1)[2].reasoning, "high");
  mkdirSync(join(h.ctx.cwd, ".pi"), { recursive: true });
  writeFileSync(
    join(h.ctx.cwd, ".pi/settings.json"),
    JSON.stringify({
      modelThinkingLevels: { "openai-codex/gpt-5.6-luna": "medium" },
    }),
  );
  await h.command("preview");
  assert.equal(h.calls.at(-1)[2].reasoning, "high", "未信任项目不参与继承");
  h.ctx.isProjectTrusted = () => true;
  await h.command("preview");
  assert.equal(h.calls.at(-1)[2].reasoning, "medium");
  h.ctx.isProjectTrusted = () => false;
  writeFileSync(settingsPath, JSON.stringify({ defaultThinkingLevel: "max" }));
  await h.command("preview");
  assert.equal(h.calls.at(-1)[2].reasoning, "low", "没有逐模型设置时回退 low");
});

test("思考选择器支持独立覆盖、恢复继承和模型能力过滤", async () => {
  const h = harness();
  writeFileSync(
    join(process.env.PI_CODING_AGENT_DIR, "settings.json"),
    JSON.stringify({
      modelThinkingLevels: { "openai-codex/gpt-5.6-luna": "high" },
    }),
  );
  h.selections.push("low");
  await h.command("thinking");
  assert.match(h.dialogs[0].choices[0], /继承.*high/);
  assert.equal(h.dialogs[0].choices.includes("minimal"), false);
  h.turn();
  await h.command("preview");
  assert.equal(h.calls.at(-1)[2].reasoning, "low");
  h.selections.push("openai-codex/gpt-5.6-luna");
  await h.command("model");
  assert.equal(
    JSON.parse(readFileSync(h.configPath, "utf8")).thinking,
    "low",
    "选择同一模型保留独立等级",
  );
  h.selections.push((choices) => choices[0]);
  await h.command("thinking");
  await h.command("preview");
  assert.equal(h.calls.at(-1)[2].reasoning, "high");
  h.selections.push("off");
  await h.command("thinking");
  await h.command("preview");
  assert.equal(h.calls.at(-1)[2].reasoning, undefined);
  assert.equal(h.calls.at(-1)[2].maxTokens, 1024);
  const noThinking = { ...LUNA, id: "plain", reasoning: false };
  h.ctx.scopedModels.push({ model: noThinking });
  h.selections.push("openai-codex/plain");
  await h.command("model");
  assert.equal(
    JSON.parse(readFileSync(h.configPath, "utf8")).thinking,
    "inherit",
  );
  await h.command("thinking");
  assert.deepEqual(h.dialogs.at(-1).choices.slice(1), ["off"]);
  await h.command("preview");
  assert.equal(h.calls.at(-1)[2].reasoning, undefined);
});

test("模型未纳入 scoped 时不偷偷回退；配置损坏及保存失败不覆盖文件", async () => {
  const h = harness();
  h.turn();
  h.ctx.scopedModels = [{ model: { ...LUNA, id: "another-model" } }];
  await h.command("preview");
  assert.equal(h.calls.length, 0);
  assert.match(h.notices.at(-1)[0], /scoped-models/);
  h.ctx.scopedModels = [];
  await h.command("model");
  assert.equal(h.dialogs.length, 0);
  h.ctx.scopedModels = [{ model: LUNA }];
  for (const raw of [
    "{",
    "[]",
    "null",
    '{"thinking":"ultra"}',
    '{"model":3}',
    '{"model":""}',
  ]) {
    writeFileSync(h.configPath, raw);
    await h.command("preview");
    assert.equal(h.calls.length, 0);
    assert.equal(readFileSync(h.configPath, "utf8"), raw);
  }
  rmSync(h.configPath);
  h.selections.push((choices) => {
    mkdirSync(h.configPath);
    return choices[0];
  });
  await h.command("model");
  assert.match(h.notices.at(-1)[0], /保存.*失败/);
});

test("更换命名配置取消旧请求；对话框被会话关闭取消后不保存", async () => {
  const job = deferred();
  const h = harness({ complete: () => job.promise });
  h.turn();
  await h.emit("agent_settled");
  h.selections.push("high");
  await h.command("thinking");
  assert.equal(h.calls[0][2].signal.aborted, true);
  job.resolve(response());
  await nextTick();
  assert.equal(h.sm.getSessionName(), undefined);
  const before = readFileSync(h.configPath, "utf8");
  h.selections.push(async (choices, { signal }) => {
    await h.emit("session_shutdown");
    assert.equal(signal.aborted, true);
    return choices[0];
  });
  await h.command("model");
  assert.equal(readFileSync(h.configPath, "utf8"), before);
});

test("辅助模型复用 Pi 解析的认证、端点与环境，不泄露给模型上下文", async () => {
  const h = harness();
  h.ctx.modelRegistry.getApiKeyAndHeaders = async () => ({
    ok: true,
    apiKey: "private-key",
    headers: { "X-Test": "private-header" },
    baseUrl: "https://proxy.invalid",
    env: { PRIVATE_TEST: "private-env" },
  });
  h.turn();
  await h.command("preview");
  const [model, context, options] = h.calls[0];
  assert.equal(model.baseUrl, "https://proxy.invalid");
  assert.equal(options.apiKey, "private-key");
  assert.deepEqual(options.headers, { "X-Test": "private-header" });
  assert.deepEqual(options.env, { PRIVATE_TEST: "private-env" });
  assert.equal(JSON.stringify(context).includes("private-"), false);
});
