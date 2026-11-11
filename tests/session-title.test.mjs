import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import personal from "../extensions/pi-personal-extensions.ts";
import statusline from "../extensions/statusline.ts";

test("合并标题用 setStatus，消毒、改名、树导航与退出同步，第五项独立开关及旧配置优先级", async () => {
  const previous = process.env.PI_CODING_AGENT_DIR;
  const dir = mkdtempSync(join(tmpdir(), "pi-title-merged-"));
  process.env.PI_CODING_AGENT_DIR = dir;
  try {
    const legacy = join(dir, "personal-extensions.json");
    const file = join(dir, "personal-statusline.json");
    for (const old of [undefined, true, false]) for (const current of [undefined, true, false]) {
      writeFileSync(legacy, JSON.stringify(old === undefined ? {} : { "session-title": old }));
      const config = { usageEnabled: false, ...(current === undefined ? {} : { sessionTitleEnabled: current }) };
      writeFileSync(file, JSON.stringify(config));
      const events = new Map(), commands = new Map(), statuses = new Map();
      statusline({ on: (key, fn) => events.set(key, fn), registerCommand: (key, fn) => commands.set(key, fn) });
      let name = "\x1b[31m标题\x1b[0m\n\t下一行\x07";
      let choices = [];
      const ctx = { sessionManager: { getSessionName: () => name, getSessionId: () => "id" }, ui: {
        setStatus: (key, value) => statuses.set(key, value), notify() {},
        select: async (_title, values) => values[choices.shift()],
      } };
      const emit = (event) => events.get(event)({}, ctx);
      emit("session_start");
      const enabled = current ?? old ?? true;
      assert.equal(statuses.get("personal-session-title"), enabled ? "标题  下一行" : undefined);
      assert.equal(readFileSync(file, "utf8"), JSON.stringify(config), "读取不迁移写入");
      assert.equal(statuses.get("session-id"), "id");
      choices = [4, 0];
      await commands.get("statusline-settings").handler("", ctx);
      assert.equal(statuses.get("personal-session-title"), "标题  下一行");
      name = "新名字"; emit("session_info_changed");
      assert.equal(statuses.get("personal-session-title"), name);
      name = " "; emit("session_tree");
      assert.equal(statuses.get("personal-session-title"), "未命名会话");
      choices = [4, 1]; await commands.get("statusline-settings").handler("", ctx);
      assert.equal(statuses.get("personal-session-title"), undefined);
      assert.equal(statuses.get("session-id"), "id");
      assert.equal(JSON.parse(readFileSync(file, "utf8")).sessionTitleEnabled, false);
      emit("session_shutdown");
      assert.equal(statuses.get("personal-session-title"), undefined);
    }
    writeFileSync(legacy, '{"session-title":false}');
    writeFileSync(file, '{"usageEnabled":false}');
    let command;
    personal({ on() {}, registerMarkdownTransformer() {}, registerTool() {}, registerCommand: (_name, value) => { command = value; } });
    const choices = [0, "禁用此功能并重载"];
    await command.handler("", { hasUI: true, mode: "rpc", reload: async () => {}, ui: {
      select: async (_title, values) => { const value = choices.shift(); return typeof value === "number" ? values[value] : value; }, notify() {},
    } });
    assert.equal(JSON.parse(readFileSync(legacy, "utf8"))["session-title"], false, "保存总开关保留旧关闭意图");
    writeFileSync(legacy, '{"session-title":"false"}');
    assert.throws(() => statusline({}), /session-title/);
    writeFileSync(legacy, '{}'); writeFileSync(file, '{"sessionTitleEnabled":"false"}');
    assert.throws(() => statusline({}), /sessionTitleEnabled/);
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
