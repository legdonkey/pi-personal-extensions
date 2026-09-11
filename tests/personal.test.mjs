import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { initTheme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import personal from "../extensions/pi-personal-extensions.ts";

const ids = [
  "terminal-title",
  "session-title",
  "substatusline",
  "clickable-paths",
  "user-message-border",
  "statusline-style-picker",
];
const off = Object.fromEntries(ids.map((id) => [id, false]));
function load() {
  const commands = new Map();
  const events = [];
  const transformers = [];
  personal({
    registerCommand: (name, command) => commands.set(name, command),
    on: (name) => events.push(name),
    registerMarkdownTransformer: (fn) => transformers.push(fn),
  });
  return { commands, events, transformers };
}

test("统一入口按开关注册六项功能，菜单保存后重载，取消不落盘", async () => {
  const previous = process.env.PI_CODING_AGENT_DIR;
  const dir = mkdtempSync(join(tmpdir(), "pi-personal-test-"));
  process.env.PI_CODING_AGENT_DIR = dir;
  const path = join(dir, "personal-extensions.json");
  try {
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    assert.deepEqual(manifest.pi.extensions, [
      "./extensions/pi-personal-extensions.ts",
    ]);
    assert.deepEqual(
      [...load().commands.keys()],
      ["clickable-paths", "statusline-style", "personal"],
    );
    for (const id of ids) {
      writeFileSync(path, JSON.stringify({ ...off, [id]: true }));
      const loaded = load();
      assert.equal(
        loaded.commands.has("clickable-paths"),
        id === "clickable-paths",
      );
      assert.equal(
        loaded.commands.has("statusline-style"),
        id === "statusline-style-picker",
      );
      assert.equal(
        loaded.events.includes("model_select"),
        id === "substatusline",
      );
      assert.equal(
        loaded.events.includes("session_info_changed"),
        ["terminal-title", "session-title"].includes(id),
      );
      assert.equal(
        loaded.transformers.length,
        id === "clickable-paths" ? 1 : 0,
      );
      assert.equal(
        loaded.events.includes("session_shutdown"),
        [
          "terminal-title",
          "session-title",
          "substatusline",
          "user-message-border",
        ].includes(id),
      );
    }
    writeFileSync(path, JSON.stringify(off));
    const loaded = load();
    assert.equal(loaded.events.length, 0);
    assert.equal(loaded.transformers.length, 0);
    assert.deepEqual([...loaded.commands.keys()], ["personal"]);

    initTheme("dark");
    let reloads = 0;
    const notices = [];
    let keys = [];
    const ctx = {
      mode: "tui",
      reload: async () => {
        reloads++;
      },
      ui: {
        notify: (...args) => notices.push(args),
        custom: async (factory) => {
          let selected;
          const component = factory(
            { requestRender() {} },
            { fg: (_color, text) => text, bold: (text) => text },
            {
              matches: (data, id) =>
                data === "\r" && id === "tui.select.confirm",
            },
            (value) => {
              selected = value;
            },
          );
          for (const width of [40, 80, 120]) {
            assert.ok(
              component
                .render(width)
                .every((line) => visibleWidth(line) <= width),
            );
          }
          for (const key of keys) component.handleInput(key);
          return selected;
        },
      },
    };
    const command = loaded.commands.get("personal");
    keys = [" ", "\x1b"];
    await command.handler("", ctx);
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), off);
    assert.equal(reloads, 0);
    keys = ["\r"];
    await command.handler("", ctx);
    assert.equal(reloads, 0, "未修改时不重载");
    keys = [" ", "\r"];
    await command.handler("", ctx);
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), {
      ...off,
      "terminal-title": true,
    });
    assert.equal(reloads, 1);
    assert.ok(load().events.includes("session_info_changed"));
    await command.handler("", { ...ctx, mode: "rpc" });
    assert.equal(reloads, 1);
    assert.equal(notices.at(-1)[1], "warning");

    for (const invalid of ["{", "null", "[]", '{"terminal-title":"false"}']) {
      writeFileSync(path, invalid);
      assert.throws(load, /配置/);
      assert.equal(readFileSync(path, "utf8"), invalid);
    }
    // 模拟配置写入失败：目标是目录，必须报告失败且不触发重载。
    const failureDir = mkdtempSync(join(tmpdir(), "pi-personal-write-test-"));
    process.env.PI_CODING_AGENT_DIR = failureDir;
    const failure = load().commands.get("personal");
    mkdirSync(join(failureDir, "personal-extensions.json"));
    await failure.handler("", ctx);
    assert.equal(reloads, 1);
    assert.equal(notices.at(-1)[1], "error");
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
  }
});
