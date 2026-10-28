import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { initTheme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import personal from "../extensions/pi-personal-extensions.ts";

const ids = [
  "session-title",
  "auto-session-name",
  "substatusline",
  "clickable-paths",
  "user-message-border",
  "statusline-style-picker",
  "jev-inline-effort",
];
const off = Object.fromEntries(ids.map((id) => [id, false]));
function load() {
  const commands = new Map();
  const events = [];
  const transformers = [];
  const virtualModels = [];
  personal({
    registerCommand: (name, command) => commands.set(name, command),
    on: (name) => events.push(name),
    registerMarkdownTransformer: (fn) => transformers.push(fn),
    registerVirtualModel: (model) => virtualModels.push(model),
  });
  return { commands, events, transformers, virtualModels };
}

test("统一入口按开关注册七项功能，忽略已移除开关，菜单保存后重载，取消不落盘", async () => {
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
      ["auto-name", "clickable-paths", "statusline-style", "effort", "personal"],
    );
    const legacy = { ...off, "terminal-title": true, "jev-auto": true };
    writeFileSync(path, JSON.stringify(legacy));
    assert.equal(load().events.length, 0, "已移除的终端标题与 Jev 虚拟模型开关不再注册事件");
    assert.deepEqual(
      JSON.parse(readFileSync(path, "utf8")),
      legacy,
      "加载时不改写用户旧配置",
    );
    for (const id of ids) {
      writeFileSync(path, JSON.stringify({ ...off, [id]: true }));
      const loaded = load();
      assert.equal(
        loaded.commands.has("auto-name"),
        id === "auto-session-name",
      );
      assert.equal(
        loaded.commands.has("clickable-paths"),
        id === "clickable-paths",
      );
      assert.equal(
        loaded.commands.has("statusline-style"),
        id === "statusline-style-picker",
      );
      assert.equal(loaded.commands.has("effort"), id === "jev-inline-effort");
      assert.equal(
        loaded.events.includes("model_select"),
        ["substatusline", "jev-inline-effort"].includes(id),
      );
      assert.equal(
        loaded.events.includes("session_info_changed"),
        ["session-title", "auto-session-name"].includes(id),
      );
      assert.equal(
        loaded.transformers.length,
        id === "clickable-paths" ? 1 : 0,
      );
      assert.deepEqual(loaded.virtualModels, [], "不注册任何虚拟模型");
      assert.equal(
        loaded.events.includes("session_shutdown"),
        [
          "session-title",
          "auto-session-name",
          "substatusline",
          "user-message-border",
          "jev-inline-effort",
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
        select: async () => "批量功能开关",
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
      "session-title": true,
    });
    assert.equal(reloads, 1);
    assert.ok(load().events.includes("session_info_changed"));
    await command.handler("", { ...ctx, mode: "rpc" });
    assert.equal(reloads, 1);
    assert.equal(notices.at(-1)[1], "warning");

    for (const invalid of ["{", "null", "[]", '{"session-title":"false"}']) {
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

test("统一菜单覆盖全部功能和设置，复用快捷命令处理器，取消不保存", async () => {
  const previous = process.env.PI_CODING_AGENT_DIR;
  const dir = mkdtempSync(join(tmpdir(), "pi-personal-menu-"));
  process.env.PI_CODING_AGENT_DIR = dir;
  const path = join(dir, "personal-extensions.json");
  try {
    writeFileSync(path, "{}");
    const loaded = load();
    const personal = loaded.commands.get("personal");
    const calls = [];
    for (const [name, command] of loaded.commands) {
      if (name !== "personal") command.handler = async (args, ctx) => calls.push({ name, args, ctx });
    }
    let choices = [];
    const menus = [];
    let reloads = 0;
    const notices = [];
    const ctx = {
      mode: "tui",
      reload: async () => { reloads++; },
      ui: {
        notify: (...args) => notices.push(args),
        select: async (title, options) => {
          menus.push({ title, options });
          const choice = choices.shift();
          return typeof choice === "number" ? options[choice] : choice;
        },
        custom: async () => { calls.push("batch"); return undefined; },
      },
    };
    await personal.handler("", ctx);
    assert.equal(menus[0].options.length, 8);
    assert.equal(readFileSync(path, "utf8"), "{}");
    const expected = {
      1: ["auto-name", ["status", "model", "thinking", "preview", "off", "on"]],
      3: ["clickable-paths", ["", "on", "off", "editor vscode", "editor vscode-insiders", "editor cursor", "editor windsurf", "editor file", "bare on", "bare off"]],
      5: ["statusline-style", [""]],
      6: ["effort", ["status", "model", "test"]],
    };
    for (let feature = 0; feature < ids.length; feature++) {
      choices = [feature, undefined];
      await personal.handler("", ctx);
      assert.equal(menus.at(-1).options.at(-1), "禁用此功能并重载");
      const entry = expected[feature];
      assert.equal(menus.at(-1).options.length, (entry?.[1].length ?? 0) + 1);
      if (!entry) continue;
      for (const [index, args] of entry[1].entries()) {
        choices = [feature, index];
        await personal.handler("", ctx);
        assert.deepEqual(calls.at(-1), { name: entry[0], args, ctx });
      }
    }
    assert.equal(readFileSync(path, "utf8"), "{}");
    assert.equal(reloads, 0);
    choices = [7];
    await personal.handler("", ctx);
    assert.equal(calls.at(-1), "batch");
    await personal.handler("switches", ctx);
    assert.equal(calls.at(-1), "batch");
    choices = [6, "禁用此功能并重载"];
    await personal.handler("", ctx);
    assert.equal(reloads, 1);
    assert.equal(JSON.parse(readFileSync(path, "utf8"))["jev-inline-effort"], false);
    const disabled = load();
    assert.equal(disabled.commands.has("effort"), false);
    choices = [6, undefined];
    await disabled.commands.get("personal").handler("", ctx);
    assert.deepEqual(menus.at(-1).options, ["启用此功能并重载"]);
    choices = [6, 0];
    await disabled.commands.get("personal").handler("", ctx);
    assert.equal(reloads, 2);
    assert.equal(JSON.parse(readFileSync(path, "utf8"))["jev-inline-effort"], true);
    await personal.handler("invalid", ctx);
    assert.match(notices.at(-1)[0], /用法/);
    assert.equal(reloads, 2);
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("从 personal 子菜单实际保存分类模型，不重载、不调用主模型", async () => {
  const previous = process.env.PI_CODING_AGENT_DIR;
  const dir = mkdtempSync(join(tmpdir(), "pi-personal-effort-"));
  process.env.PI_CODING_AGENT_DIR = dir;
  try {
    const loaded = load();
    const choices = [6, 1, 1];
    let reloads = 0;
    const ctx = {
      mode: "tui", hasUI: true, isIdle: () => true,
      reload: async () => { reloads++; },
      ui: {
        select: async (_title, options) => options[choices.shift()],
        notify() {},
      },
    };
    await loaded.commands.get("personal").handler("", ctx);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, "jev-inline-effort.json"), "utf8")), { model: "d1-ultra" });
    assert.equal(reloads, 0);
    assert.equal(choices.length, 0);
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
