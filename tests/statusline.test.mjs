import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setImmediate as nextTick } from "node:timers/promises";
import { visibleWidth } from "@earendil-works/pi-tui";
import statusline, { shortSessionId, formatAntigravityUsage } from "../extensions/statusline.ts";

test("迁入的风格选择器保留 11 套配色、预览、配置和重载行为", async () => {
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = mkdtempSync(join(tmpdir(), "pi-style-test-"));
  try {
    let command;
    statusline({
      on() {},
      registerCommand: (name, value) => {
        assert.equal(name, "statusline-style");
        command = value;
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
    sessionManager: { getSessionId: () => "019a3f2c-7b1e-7c4d-9a2b-3c4d5e6f7a8b" },
    ui: { setStatus: (key, value) => statuses.set(key, value) },
  };
  try {
    assert.deepEqual([...commands.keys()], ["statusline-style"]);
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
    sessionManager: { getSessionId: () => "abc" },
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
    sessionManager: { getSessionId: () => "abc" },
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
