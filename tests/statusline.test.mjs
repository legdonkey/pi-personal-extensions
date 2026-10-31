import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setImmediate as nextTick } from "node:timers/promises";
import { visibleWidth } from "@earendil-works/pi-tui";
import statusline, { shortSessionId } from "../extensions/statusline.ts";

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
    await command.handler("", { ...ctx, mode: "rpc" });
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
