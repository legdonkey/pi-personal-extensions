import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, beforeEach, afterEach } from "node:test";
import fsPromises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { setImmediate as nextTick } from "node:timers/promises";
import { visibleWidth } from "@earendil-works/pi-tui";
import statusline, { shortSessionId, formatAntigravityUsage } from "../extensions/statusline.ts";

let previousAgentDir;
let testAgentDir;
beforeEach(() => {
  previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  testAgentDir = mkdtempSync(join(tmpdir(), "pi-statusline-test-"));
  process.env.PI_CODING_AGENT_DIR = testAgentDir;
});
afterEach(() => {
  if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  rmSync(testAgentDir, { recursive: true, force: true });
});

test("迁入的风格选择器保留 11 套配色、预览、配置和重载行为", async () => {
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = mkdtempSync(join(tmpdir(), "pi-style-test-"));
  try {
    let command;
    statusline({
      on() {},
      registerCommand: (name, value) => {
        if (name === "statusline-style") command = value;
      },
    });
    assert.equal(command.getArgumentCompletions("").length, 11);
    const path = join(process.env.PI_CODING_AGENT_DIR, "pi-statusline.json");
    writeFileSync(path, JSON.stringify({ preserved: "保留原有配置" }));
    let reloads = 0;
    const notices = [];
    const ctx = {
      mode: "tui",
      reload: async () => {
        reloads++;
      },
      ui: {
        notify: (...args) => notices.push(args),
        custom: async (factory) => {
          let result;
          const component = factory(
            { requestRender() {} },
            { fg: (_color, text) => text, bold: (text) => text },
            {},
            (value) => {
              result = value;
            },
          );
          for (const width of [10, 40, 80]) {
            assert.ok(
              component
                .render(width)
                .every((line) => visibleWidth(line) <= width),
            );
          }
          const rendered = component.render(80).join("\n");
          assert.match(rendered, /pi-statusline 自定义配色/);
          assert.match(rendered, /需安装并启用 pi-statusline/);
          assert.match(rendered, /不改变 Pi 主题/);
          assert.match(rendered, /紧凑布局、圆角分隔符/);
          component.handleInput("\x1b");
          return result;
        },
      },
    };
    await command.handler("", ctx);
    assert.equal(reloads, 0);
    await command.handler("11", ctx);
    const config = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(config.preserved, "保留原有配置");
    assert.equal(config.palettePreset, "custom");
    assert.equal(config.palette.brand.fg, "#d97757");
    assert.equal(Object.keys(config.palette).length, 13);
    assert.equal(reloads, 1);
    await command.handler("不存在的风格", ctx);
    assert.equal(reloads, 1);
    assert.equal(notices.at(-1)[1], "error");
    const saved = readFileSync(path, "utf8");
    let choice;
    const rpc = { ...ctx, mode: "rpc", hasUI: true, ui: { ...ctx.ui,
      custom: async () => assert.fail("RPC 不使用 TUI 预览"),
      select: async (title, options) => {
        assert.match(title, /需安装并启用 pi-statusline/);
        assert.match(title, /不改变 Pi 主题/);
        assert.match(title, /覆盖其自定义配色/);
        assert.match(title, /紧凑布局、圆角分隔符/);
        assert.equal(options.length, 11);
        return choice;
      },
    } };
    await command.handler("", rpc);
    assert.equal(readFileSync(path, "utf8"), saved, "取消不改配置");
    choice = "无效配色";
    await command.handler("", rpc);
    assert.equal(notices.at(-1)[1], "error");
    assert.equal(readFileSync(path, "utf8"), saved);
    assert.equal(reloads, 1);
    await command.handler("", { ...rpc, hasUI: false });
    assert.equal(notices.at(-1)[1], "warning");
  } finally {
    rmSync(process.env.PI_CODING_AGENT_DIR, { recursive: true, force: true });
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
  }
});

test("会话 ID 取末尾 8 位，短 ID 原样显示", () => {
  // 同一时间段内新建的两个 UUIDv7 会话，前 7 位相同，末 8 位不同。
  assert.equal(shortSessionId("019a3f2c-7b1e-7c4d-9a2b-3c4d5e6f7a8b"), "5e6f7a8b");
  assert.equal(shortSessionId("019a3f2c-8e0f-7123-b456-0123456789ab"), "456789ab");
  assert.equal(shortSessionId("abc"), "abc");
  assert.equal(shortSessionId(""), "");
});

test("合并功能同时注册配色处理器与额度事件，保留 usage 和 session-id 状态栏键", async (t) => {
  const events = new Map();
  const commands = new Map();
  const statuses = new Map();
  statusline({
    on: (name, handler) => events.set(name, handler),
    registerCommand: (name, command) => commands.set(name, command),
    exec: async () => ({ code: 0, stdout: "test-credential" }),
  });
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, "https://chatgpt.com/backend-api/wham/usage");
    return {
      ok: true,
      json: async () => ({ rate_limit: { primary_window: { used_percent: 25, limit_window_seconds: 604800 } } }),
    };
  });
  const ctx = {
    model: { provider: "openai-codex" },
    sessionManager: { getSessionName: () => undefined, getSessionId: () => "019a3f2c-7b1e-7c4d-9a2b-3c4d5e6f7a8b" },
    ui: { setStatus: (key, value) => statuses.set(key, value) },
  };
  try {
    assert.deepEqual([...commands.keys()], ["statusline-settings", "statusline-info", "statusline-style"]);
    events.get("session_start")({}, ctx);
    await nextTick();
    assert.equal(statuses.get("usage"), "weekly 75% left");
    assert.equal(statuses.get("session-id"), "5e6f7a8b");
    events.get("model_select")({ model: { provider: "unsupported" } }, ctx);
    assert.equal(statuses.get("usage"), undefined);
    assert.equal(statuses.get("session-id"), "5e6f7a8b");
  } finally {
    events.get("session_shutdown")({}, ctx);
  }
  assert.equal(statuses.get("session-id"), undefined);
});

test("Antigravity 仅显示当前模型额度，兼容变体和 Pro 别名并校验响应", () => {
  const quota = (remainingFraction) => ({ quotaInfo: { remainingFraction } });
  const body = { models: {
    "gemini-3.1-pro-low": quota(0.8), "gemini-pro-agent": quota(0.6),
    "claude-opus-4-6-thinking": quota(0.25), "gemini-4-argon-tiered": quota(1),
  } };
  assert.equal(formatAntigravityUsage(body, "gemini-3.1-pro"), "quota 60% left");
  assert.equal(formatAntigravityUsage(body, "claude-opus-4-6"), "quota 25% left");
  assert.equal(formatAntigravityUsage(body, "gemini-4-argon"), "quota 100% left");
  for (const [value, expected] of [[0, 0], [-1, 0], [2, 100], [0.556, 56]])
    assert.equal(formatAntigravityUsage({ models: { x: quota(value) } }, "x"), `quota ${expected}% left`);
  for (const value of [null, "0.5", false, NaN, Infinity, undefined])
    assert.throws(() => formatAntigravityUsage({ models: { x: quota(value) } }, "x"));
  for (const value of [null, {}, { models: [] }, body])
    assert.throws(() => formatAntigravityUsage(value, "unknown"));
});

test("Antigravity 从当前 provider 获取凭据，切换模型和账号不复用旧额度", async (t) => {
  const events = new Map();
  const statuses = new Map();
  let account = "first";
  let fail = false;
  let pending;
  let requests = 0;
  statusline({
    on: (name, handler) => events.set(name, handler), registerCommand() {},
    exec: async () => assert.fail("Antigravity 不通过子进程读取凭据"),
  });
  const ctx = {
    model: { provider: "antigravity", id: "gemini-4-argon" },
    sessionManager: { getSessionName: () => undefined, getSessionId: () => "abc" },
    modelRegistry: { getApiKeyForProvider: async (provider) => {
      assert.equal(provider, "antigravity");
      return JSON.stringify({ token: account, projectId: "test-project" });
    } },
    ui: { setStatus: (key, value) => statuses.set(key, value) },
  };
  t.mock.method(globalThis, "fetch", async (url, init) => {
    requests++;
    assert.match(url, /^https:\/\/(daily-cloudcode-pa(?:\.sandbox)?|cloudcode-pa)\.googleapis\.com\/v1internal:fetchAvailableModels$/);
    assert.equal(init.method, "POST");
    assert.equal(init.redirect, "error");
    assert.deepEqual(JSON.parse(init.body), { project: "test-project" });
    assert.equal(init.headers.Authorization, `Bearer ${account}`);
    if (pending) await pending;
    return { ok: !fail, json: async () => ({ models: {
      "gemini-4-argon": { quotaInfo: { remainingFraction: account === "first" ? 0.8 : 0.4 } },
      "claude-opus-4-6-thinking": { quotaInfo: { remainingFraction: 0.1 } },
    } }) };
  });
  const select = (id) => events.get("model_select")({ model: { provider: "antigravity", id } }, ctx);
  try {
    events.get("session_start")({}, ctx);
    await nextTick();
    assert.equal(statuses.get("usage"), "quota 80% left");
    select("claude-opus-4-6");
    assert.equal(statuses.get("usage"), undefined);
    await nextTick();
    assert.equal(statuses.get("usage"), "quota 10% left");
    account = "second";
    select("gemini-4-argon");
    await nextTick();
    assert.equal(statuses.get("usage"), "quota 40% left");
    fail = true;
    select("gemini-4-argon");
    await nextTick();
    assert.equal(statuses.get("usage"), undefined);
    const before = requests;
    events.get("agent_settled")({}, ctx);
    await nextTick();
    assert.equal(requests, before, "保留 30 秒冷却");
    fail = false;
    let resolve;
    pending = new Promise((r) => { resolve = r; });
    select("gemini-4-argon");
    await nextTick();
    events.get("model_select")({ model: { provider: "unsupported" } }, ctx);
    resolve();
    await nextTick();
    assert.equal(statuses.get("usage"), undefined, "过期结果不能覆盖新模型");
  } finally {
    events.get("session_shutdown")({}, ctx);
  }
});

function kimiUsageContext(statuses) {
  return {
    model: { provider: "kimi-coding" },
    sessionManager: { getSessionName: () => undefined, getSessionId: () => "abc" },
    ui: { setStatus: (key, value) => statuses.set(key, value) },
  };
}

function registerKimiStatusline(events) {
  statusline({
    on: (name, handler) => events.set(name, handler),
    registerCommand() {},
    exec: async (command, args) => {
      assert.deepEqual(args, ["auth", "print-bearer-token", "--provider", "kimi-coding", "--min-expiry", "5m"]);
      return { code: 0, stdout: "test-credential" };
    },
  });
}

test("kimi-coding 新套餐显示 5 小时和月度额度", async (t) => {
  const events = new Map();
  const statuses = new Map();
  registerKimiStatusline(events);
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://api.kimi.com/coding/v1/usages");
    assert.equal(init.headers.Authorization, "Bearer test-credential");
    return {
      ok: true,
      json: async () => ({
        limits: [],
        usages: {
          limit_5h: { used_ratio: 0.1387, reset_time: "2026-11-01T08:57:41Z" },
          limit_month_total: { used_ratio: 0.0111, reset_time: "2026-12-02T00:00:00Z" },
          limit_month_code: { used_ratio: 0.0111, reset_time: "2026-12-02T00:00:00Z" },
        },
      }),
    };
  });
  const ctx = kimiUsageContext(statuses);
  try {
    events.get("session_start")({}, ctx);
    await nextTick();
    assert.equal(statuses.get("usage"), "5h 86% left · monthly 99% left");
  } finally {
    events.get("session_shutdown")({}, ctx);
  }
});

test("kimi-coding 老套餐显示 5 小时和周额度", async (t) => {
  const events = new Map();
  const statuses = new Map();
  registerKimiStatusline(events);
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({
      usages: {
        limit_5h: { used_ratio: 0.5 },
        limit_7d: { used_ratio: 0.25 },
        limit_month_code: { used_ratio: 0.9 },
      },
    }),
  }));
  const ctx = kimiUsageContext(statuses);
  try {
    events.get("session_start")({}, ctx);
    await nextTick();
    assert.equal(statuses.get("usage"), "5h 50% left · weekly 75% left");
  } finally {
    events.get("session_shutdown")({}, ctx);
  }
});

test("token 速度用最终 output 除以内容流时间，等待单列，工具续调逐次重算且不替换 footer", (t) => {
  let now = 0;
  t.mock.method(performance, "now", () => now);
  const events = new Map();
  const statuses = new Map();
  statusline({ on: (name, handler) => events.set(name, handler), registerCommand() {} });
  const ctx = {
    model: { provider: "unsupported" },
    sessionManager: { getSessionName: () => undefined, getSessionId: () => "test" },
    ui: { setStatus: (key, value) => statuses.set(key, value) },
  };
  const emit = (name, event = {}) => events.get(name)(event, ctx);
  const end = (stopReason = "stop", output = 100) => emit("message_end", {
    message: { role: "assistant", stopReason, usage: { output, reasoning: 80 }, content: [] },
  });
  try {
    emit("session_start");
    emit("turn_start");
    now = 3000;
    emit("message_update", { assistantMessageEvent: { type: "thinking_start" } });
    now = 4000;
    emit("message_update", { assistantMessageEvent: { type: "text_delta", delta: "很多字符但不是 token 数" } });
    now = 5000;
    end("toolUse");
    assert.equal(statuses.get("personal-token-speed"), "50.0 tok/s · 等待 3.0s · 输出 2.0s");
    assert.equal(statuses.get("session-id"), "test");
    emit("message_end", { message: { role: "toolResult" } });
    emit("agent_settled");
    assert.match(statuses.get("personal-token-speed"), /^50.0 tok\/s/);
    emit("turn_start");
    assert.equal(statuses.get("personal-token-speed"), undefined);
    now = 6000;
    emit("message_update", { assistantMessageEvent: { type: "toolcall_start" } });
    now = 10000;
    end("length", 20);
    assert.equal(statuses.get("personal-token-speed"), "5.0 tok/s · 等待 1.0s · 输出 4.0s");
    emit("session_tree");
    assert.equal(statuses.get("personal-token-speed"), undefined);
  } finally {
    emit("session_shutdown");
  }
  assert.equal(statuses.get("personal-token-speed"), undefined);
});

test("token 速度不展示取消、失败、无用量或无内容的响应，隔离模型和会话生命周期", (t) => {
  let now = 0;
  t.mock.method(performance, "now", () => now);
  const events = new Map();
  const statuses = new Map();
  statusline({ on: (name, handler) => events.set(name, handler), registerCommand() {} });
  const ctx = { model: { provider: "unsupported" }, sessionManager: { getSessionName: () => undefined, getSessionId: () => "test" },
    ui: { setStatus: (key, value) => statuses.set(key, value) } };
  const emit = (name, event = {}, context = ctx) => events.get(name)(event, context);
  const message = (stopReason, output) => ({ message: { role: "assistant", stopReason, usage: { output } } });
  try {
    emit("session_start");
    for (const [reason, output, content, duration] of [
      ["aborted", 100, true, 1000], ["error", 100, true, 1000], ["deferred", 100, true, 1000],
      ["stop", 0, true, 1000], ["stop", NaN, true, 1000], ["stop", Infinity, true, 1000],
      ["stop", -1, true, 1000], ["stop", undefined, true, 1000],
      ["stop", 100, false, 1000], ["stop", 100, true, 0],
    ]) {
      emit("turn_start");
      if (content) emit("message_update");
      now += duration;
      emit("message_end", message(reason, output));
      assert.equal(statuses.get("personal-token-speed"), undefined);
    }
    for (const boundary of ["model_select", "session_tree", "session_start", "session_shutdown"]) {
      emit("session_start");
      emit("turn_start");
      emit("message_update");
      now += 1000;
      emit("message_end", message("stop", 100), { ...ctx, sessionManager: {} });
      assert.equal(statuses.get("personal-token-speed"), undefined, "忽略其他会话的事件");
      emit(boundary, { model: { provider: "unsupported" } });
      emit("message_end", message("stop", 100));
      assert.equal(statuses.get("personal-token-speed"), undefined, "忽略边界前开始的响应");
    }
  } finally {
    emit("session_shutdown");
  }
});

function loadStatuslineSettings(overrides = {}) {
  const events = new Map();
  const commands = new Map();
  const statuses = new Map();
  const notices = [];
  let selections = [];
  const menus = [];
  statusline({
    on: (name, handler) => events.set(name, handler),
    registerCommand: (name, command) => commands.set(name, command),
    exec: async () => ({ code: 0, stdout: "test-credential" }),
    ...overrides,
  });
  const ctx = {
    model: { provider: "openai-codex" },
    reload: async () => {},
    sessionManager: { getSessionName: () => undefined, getSessionId: () => "test-session-id" },
    ui: {
      setStatus: (key, value) => statuses.set(key, value),
      notify: (...args) => notices.push(args),
      select: async (title, choices) => {
        menus.push({ title, choices });
        const value = selections.shift();
        return typeof value === "number" ? choices[value] : value;
      },
    },
  };
  return {
    ctx, statuses, notices, menus,
    emit: (name, event = {}) => events.get(name)(event, ctx),
    configure: async (...values) => {
      selections = values;
      await commands.get("statusline-settings").handler("", ctx);
    },
    style: () => commands.get("statusline-style").handler("1", ctx),
  };
}

test("独立额度开关持久化：关闭清 usage、取消查询并停轮询，迟到结果无效，开启强制刷新且保留其他状态", async (t) => {
  const timers = new Set();
  t.mock.method(globalThis, "setInterval", (callback) => {
    const timer = { callback, unref() {} };
    timers.add(timer);
    return timer;
  });
  t.mock.method(globalThis, "clearInterval", (timer) => timers.delete(timer));
  let pending;
  let requests = 0;
  let requestSignal;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    requests++;
    requestSignal = init.signal;
    if (pending) await pending;
    return { ok: true, json: async () => ({ rate_limit: { primary_window: { used_percent: 25, limit_window_seconds: 604800 } } }) };
  });
  let now = 0;
  t.mock.method(performance, "now", () => now);
  const file = join(testAgentDir, "personal-statusline.json");
  const app = loadStatuslineSettings();
  const reply = (output = 100) => app.emit("message_end", { message: { role: "assistant", stopReason: "stop", usage: { output } } });
  try {
    app.emit("session_start");
    await nextTick();
    assert.equal(requests, 1, "缺少配置时默认开启额度");
    assert.equal(timers.size, 1);
    app.emit("turn_start");
    now = 1000;
    app.emit("message_update");
    now = 3000;
    reply();
    const speed = app.statuses.get("personal-token-speed");
    let resolve;
    pending = new Promise((done) => { resolve = done; });
    const oldTimer = [...timers][0];
    oldTimer.callback();
    await nextTick();
    await app.configure(0, 1);
    assert.equal(requestSignal.aborted, true);
    assert.equal(timers.size, 0);
    assert.equal(app.statuses.get("usage"), undefined);
    assert.equal(app.statuses.get("session-id"), "ssion-id");
    assert.equal(app.statuses.get("personal-token-speed"), speed);
    assert.equal(JSON.parse(readFileSync(file, "utf8")).usageEnabled, false);
    resolve();
    await nextTick();
    assert.equal(app.statuses.get("usage"), undefined, "忽略不配合取消的迟到响应");
    const before = requests;
    oldTimer.callback();
    app.emit("agent_settled");
    app.emit("session_tree");
    app.emit("model_select", { model: app.ctx.model });
    await nextTick();
    assert.equal(requests, before, "关闭后所有刷新入口均不查询");
    assert.equal(timers.size, 0);
    app.emit("turn_start");
    app.emit("message_update");
    now += 2000;
    reply();
    assert.match(app.statuses.get("personal-token-speed"), /^50.0 tok\/s/);
    app.emit("session_shutdown");
    const reloaded = loadStatuslineSettings();
    try {
      reloaded.emit("session_start");
      await nextTick();
      assert.equal(requests, before, "重载后仍关闭");
      assert.equal(reloaded.statuses.get("session-id"), "ssion-id");
      await reloaded.configure(0, 0);
      await nextTick();
      assert.equal(requests, before + 1, "重新开启绕过 30 秒冷却");
      assert.equal(timers.size, 1);
      assert.equal(reloaded.statuses.get("usage"), "weekly 75% left");
    } finally { reloaded.emit("session_shutdown"); }
  } finally { app.emit("session_shutdown"); }
});

test("ID 与 token 速度独立启停：立即清值，ID 开启即显示，速度开启从下个 turn_start 计时", async (t) => {
  writeFileSync(join(testAgentDir, "personal-statusline.json"), '{"usageEnabled":false}');
  let now = 0;
  t.mock.method(performance, "now", () => now);
  const app = loadStatuslineSettings();
  const reply = () => app.emit("message_end", { message: { role: "assistant", stopReason: "stop", usage: { output: 20 } } });
  try {
    app.emit("session_start");
    app.emit("turn_start");
    app.emit("message_update");
    now = 1000;
    reply();
    const speed = app.statuses.get("personal-token-speed");
    await app.configure(1, 1);
    assert.equal(app.statuses.get("session-id"), undefined);
    assert.equal(app.statuses.get("personal-token-speed"), speed);
    await app.configure(1, 0);
    assert.equal(app.statuses.get("session-id"), "ssion-id");
    app.emit("turn_start");
    app.emit("message_update");
    await app.configure(2, 1);
    assert.equal(app.statuses.get("personal-token-speed"), undefined);
    assert.equal(app.statuses.get("session-id"), "ssion-id");
    app.emit("turn_start");
    app.emit("message_update");
    now += 1000;
    reply();
    await app.configure(2, 0);
    app.emit("message_update");
    now += 1000;
    reply();
    assert.equal(app.statuses.get("personal-token-speed"), undefined, "开启后不接续半途响应");
    app.emit("turn_start");
    app.emit("message_update");
    now += 1000;
    reply();
    assert.match(app.statuses.get("personal-token-speed"), /^20.0 tok\/s/);
    await app.configure(1, 1);
    await app.configure(2, 1);
    const reloaded = loadStatuslineSettings();
    try {
      reloaded.emit("session_start");
      reloaded.emit("turn_start");
      reloaded.emit("message_update");
      now += 1000;
      reloaded.emit("message_end", { message: { role: "assistant", stopReason: "stop", usage: { output: 20 } } });
      assert.equal(reloaded.statuses.get("session-id"), undefined);
      assert.equal(reloaded.statuses.get("personal-token-speed"), undefined);
      assert.equal(reloaded.menus.length, 0);
    } finally { reloaded.emit("session_shutdown"); }
  } finally { app.emit("session_shutdown"); }
});

test("四项开关保持可管理，配色禁用不回滚第三方配置，取消及损坏配置不写入", async () => {
  const file = join(testAgentDir, "personal-statusline.json");
  const styleFile = join(testAgentDir, "pi-statusline.json");
  writeFileSync(file, '{"usageEnabled":false,"preserved":"保留"}');
  writeFileSync(styleFile, '{"palettePreset":"existing"}');
  const app = loadStatuslineSettings();
  try {
    app.emit("session_start");
    await app.configure();
    assert.deepEqual(app.menus.at(-1).choices, ["服务商额度：关闭", "会话 ID：开启", "token 速度：开启", "pi-statusline 配色选择器：开启", "会话标题：开启"]);
    await app.configure(3);
    assert.match(app.menus.at(-1).title, /状态栏独立功能开关/, "取消启停选择返回四项面板");
    await app.configure("invalid");
    await app.configure(3, "invalid");
    assert.equal(readFileSync(file, "utf8"), '{"usageEnabled":false,"preserved":"保留"}');
    await app.configure(3, 1);
    assert.equal(JSON.parse(readFileSync(file, "utf8")).preserved, "保留");
    const saved = readFileSync(styleFile, "utf8");
    await app.style();
    assert.equal(readFileSync(styleFile, "utf8"), saved);
    assert.match(app.notices.at(-1)[0], /选择器已关闭.*独立功能开关/);
    const reloaded = loadStatuslineSettings();
    await reloaded.style();
    assert.match(reloaded.notices.at(-1)[0], /选择器已关闭/);
    await app.configure(3, 0);
    assert.equal(JSON.parse(readFileSync(file, "utf8")).styleEnabled, true);
    await app.style();
    assert.equal(JSON.parse(readFileSync(styleFile, "utf8")).palettePreset, "custom");
    for (const text of ["{", "null", "[]", ...["usageEnabled", "sessionIdEnabled", "tokenSpeedEnabled", "styleEnabled", "sessionTitleEnabled"].map((key) => JSON.stringify({ [key]: "false" }))]) {
      writeFileSync(file, text);
      assert.throws(() => loadStatuslineSettings(), /状态栏配置/);
      await app.configure(1, 1);
      assert.equal(app.notices.at(-1)[1], "error");
      assert.equal(readFileSync(file, "utf8"), text, "损坏配置不覆盖");
      assert.equal(app.statuses.get("session-id"), "ssion-id", "保存失败不改变运行时设置");
    }
  } finally { app.emit("session_shutdown"); }
});

test("独立开关写入或 rename 失败时不覆盖配置、不应用运行时变更", async (t) => {
  const file = join(testAgentDir, "personal-statusline.json");
  const saved = '{"usageEnabled":false,"preserved":"保留"}';
  writeFileSync(file, saved);
  const app = loadStatuslineSettings();
  try {
    app.emit("session_start");
    for (const method of ["writeFile", "rename"]) {
      const mocked = t.mock.method(fsPromises, method, async () => { throw new Error("模拟存储失败"); });
      syncBuiltinESMExports();
      try {
        await app.configure(1, 1);
        assert.match(app.notices.at(-1)[0], /保存失败，当前设置不变/);
        assert.equal(app.notices.at(-1)[1], "error");
        assert.equal(readFileSync(file, "utf8"), saved);
        assert.equal(app.statuses.get("session-id"), "ssion-id");
      } finally {
        mocked.mock.restore();
        syncBuiltinESMExports();
      }
    }
  } finally { app.emit("session_shutdown"); }
});

test("关闭额度也向读取凭据的子进程传递取消信号", async (t) => {
  let signal;
  t.mock.method(globalThis, "fetch", async () => assert.fail("取消后不能请求额度接口"));
  const app = loadStatuslineSettings({
    exec: async (_command, _args, options) => {
      signal = options.signal;
      return await new Promise((resolve) => signal.addEventListener("abort", () => resolve({ code: 1, stdout: "" }), { once: true }));
    },
  });
  try {
    app.emit("session_start");
    assert.equal(signal.aborted, false);
    await app.configure(0, 1);
    assert.equal(signal.aborted, true);
    await nextTick();
    assert.equal(app.statuses.get("usage"), undefined);
  } finally { app.emit("session_shutdown"); }
});
