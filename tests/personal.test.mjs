import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { initTheme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import personal from "../extensions/pi-personal-extensions.ts";

const ids = [
  "auto-session-name",
  "statusline",
  "clickable-paths",
  "user-message-border",
  "inline-effort",
];
const off = Object.fromEntries(ids.map((id) => [id, false]));
const styleNames = ["茶墨渐层", "冰川蓝阶", "靛夜层云", "琥珀余温", "紫藤暮色", "松林雾径", "陶火晚照", "玫瑰尘光", "石墨银阶", "潮汐青绿", "Claude 暖纸"];
function load(overrides = {}) {
  const commands = new Map();
  const events = [];
  const transformers = [];
  const virtualModels = [];
  const tools = [];
  personal({
    registerTool: (tool) => tools.push(tool),
    registerCommand: (name, command) => commands.set(name, command),
    on: (name) => events.push(name),
    registerMarkdownTransformer: (fn) => transformers.push(fn),
    registerVirtualModel: (model) => virtualModels.push(model),
    ...overrides,
  });
  return { commands, events, transformers, virtualModels, tools };
}

test("统一入口按开关注册五项功能，忽略已移除开关，菜单保存后重载，取消不落盘", async () => {
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
      ["personal"],
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
      assert.deepEqual([...loaded.commands.keys()], ["personal"]);
      assert.equal(
        loaded.events.includes("model_select"),
        ["statusline", "inline-effort"].includes(id),
      );
      assert.equal(
        loaded.events.includes("session_info_changed"),
        ["statusline", "auto-session-name"].includes(id),
      );
      assert.equal(
        loaded.transformers.length,
        id === "clickable-paths" ? 1 : 0,
      );
      assert.deepEqual(loaded.tools, [], "不注册任何工具");
      assert.deepEqual(loaded.virtualModels, [], "不注册任何虚拟模型");
      assert.equal(
        loaded.events.includes("session_shutdown"),
        [
                  "auto-session-name",
          "statusline",
          "user-message-border",
          "inline-effort",
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
      hasUI: true,
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
    await command.handler("switches", ctx);
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), off);
    assert.equal(reloads, 0);
    keys = ["\r"];
    await command.handler("switches", ctx);
    assert.equal(reloads, 0, "未修改时不重载");
    keys = [" ", "\r"];
    await command.handler("switches", ctx);
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), {
      ...off,
      "auto-session-name": true,
    });
    assert.equal(reloads, 1);
    assert.ok(load().events.includes("session_info_changed"));
    for (const invalid of ["{", "null", "[]", '{"session-title":"false"}', '{"understand-video":"false"}']) {
      writeFileSync(path, invalid);
      assert.throws(load, /配置/);
      assert.equal(readFileSync(path, "utf8"), invalid);
    }
    // 模拟配置写入失败：目标是目录，必须报告失败且不触发重载。
    const failureDir = mkdtempSync(join(tmpdir(), "pi-personal-write-test-"));
    process.env.PI_CODING_AGENT_DIR = failureDir;
    const failure = load().commands.get("personal");
    mkdirSync(join(failureDir, "personal-extensions.json"));
    await failure.handler("switches", ctx);
    assert.equal(reloads, 1);
    assert.equal(notices.at(-1)[1], "error");
    rmSync(failureDir, { recursive: true, force: true });
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("已删除的原视频审查开关仍可读取并检查格式，不注册工具和菜单项", async () => {
  const previous = process.env.PI_CODING_AGENT_DIR;
  const dir = mkdtempSync(join(tmpdir(), "pi-personal-removed-"));
  process.env.PI_CODING_AGENT_DIR = dir;
  const path = join(dir, "personal-extensions.json");
  try {
    for (const value of [true, false]) {
      const source = JSON.stringify({ ...off, "user-message-border": true, "understand-video": value });
      writeFileSync(path, source);
      const loaded = load();
      assert.deepEqual([...loaded.commands.keys()], ["personal"]);
      assert.deepEqual(loaded.tools, []);
      assert.ok(loaded.events.includes("session_shutdown"), "其余开关照常生效");
      assert.equal(readFileSync(path, "utf8"), source, "加载不改写旧配置");
      let options;
      await loaded.commands.get("personal").handler("", {
        mode: "rpc", hasUI: true,
        ui: { select: async (_title, items) => { options = items; }, notify: (message) => assert.fail(message) },
      });
      assert.equal(options.length, ids.length + 1);
      assert.ok(options.every((label) => !label.includes("视频")));
    }
    for (const value of [null, "false", 0, [], {}]) {
      writeFileSync(path, JSON.stringify({ ...off, "understand-video": value }));
      assert.throws(load, /understand-video 必须为 true 或 false/, JSON.stringify(value));
    }
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("旧开关键兼容缺省值和全部布尔组合，新键优先，保存只写五个新键", async () => {
  const previous = process.env.PI_CODING_AGENT_DIR;
  const dir = mkdtempSync(join(tmpdir(), "pi-personal-migration-"));
  process.env.PI_CODING_AGENT_DIR = dir;
  const path = join(dir, "personal-extensions.json");
  try {
    for (const usage of [undefined, false, true]) {
      for (const style of [undefined, false, true]) {
        for (const current of [undefined, false, true]) {
          const raw = { ...off };
          delete raw.statusline;
          if (usage !== undefined) raw.substatusline = usage;
          if (style !== undefined) raw["statusline-style-picker"] = style;
          if (current !== undefined) raw.statusline = current;
          const source = JSON.stringify(raw);
          writeFileSync(path, source);
          const expected = current ?? (usage !== false || style !== false);
          assert.equal(load().events.includes("session_tree"), expected, source);
          assert.equal(readFileSync(path, "utf8"), source, "加载不改写旧配置");
        }
      }
    }
    for (const legacy of [undefined, false, true]) {
      for (const current of [undefined, false, true]) {
        const raw = { ...off };
        delete raw["inline-effort"];
        if (legacy !== undefined) raw["jev-inline-effort"] = legacy;
        if (current !== undefined) raw["inline-effort"] = current;
        writeFileSync(path, JSON.stringify(raw));
        assert.equal(load().events.includes("context_with_system"), current ?? legacy ?? true);
      }
    }
    for (const id of ["substatusline", "statusline-style-picker", "jev-inline-effort"]) {
      for (const value of [null, "false", 0, [], {}]) {
        writeFileSync(path, JSON.stringify({ ...off, [id]: value }));
        assert.throws(load, /必须为 true 或 false/, `${id}: ${JSON.stringify(value)}`);
      }
    }
    const raw = {
      ...off,
      substatusline: false,
      "statusline-style-picker": false,
      "jev-inline-effort": true,
    };
    delete raw.statusline;
    delete raw["inline-effort"];
    writeFileSync(path, JSON.stringify(raw));
    const command = load().commands.get("personal");
    const choices = [0, "启用此功能并重载"];
    let reloads = 0;
    await command.handler("", {
      mode: "rpc", hasUI: true,
      reload: async () => { reloads++; },
      ui: {
        select: async (_title, options) => {
          const choice = choices.shift();
          return typeof choice === "number" ? options[choice] : choice;
        },
        notify: (message) => assert.fail(message),
      },
    });
    assert.equal(reloads, 1);
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), {
      ...off, "auto-session-name": true, "inline-effort": true,
    });
    assert.equal(load().events.includes("session_tree"), true);
    assert.equal(load().events.includes("context_with_system"), true);
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("统一菜单覆盖全部功能和设置，调用内部处理器，取消不保存", async () => {
  const previous = process.env.PI_CODING_AGENT_DIR;
  const dir = mkdtempSync(join(tmpdir(), "pi-personal-menu-"));
  process.env.PI_CODING_AGENT_DIR = dir;
  const path = join(dir, "personal-extensions.json");
  try {
    writeFileSync(path, "{}");
    const entries = [];
    const loaded = load({
      getSessionName: () => undefined,
      appendEntry: (type, data) => entries.push({ type, data }),
    });
    const personal = loaded.commands.get("personal");
    const calls = [];
    let choices = [];
    const menus = [];
    let reloads = 0;
    const notices = [];
    let classifierCalls = 0;
    const ctx = {
      mode: "tui", hasUI: true, isIdle: () => true,
      cwd: join(dir, "project"),
      isProjectTrusted: () => false,
      sessionManager: { getBranch: () => [] },
      scopedModels: [{ model: { provider: "test", id: "gpt-5.6-luna", reasoning: true } }],
      modelRegistry: {
        hasConfiguredAuth: () => true,
        findOfType: (_type, provider, id) => ({ provider, id, api: "typesafe-system-one" }),
        classify: async () => {
          classifierCalls++;
          return { stopReason: "stop", answers: { thinking: { type: "choice", choice: "high", probabilities: { high: 1 } } } };
        },
      },
      reload: async () => { reloads++; },
      ui: {
        notify: (...args) => notices.push(args),
        select: async (title, options) => {
          menus.push({ title, options });
          const choice = choices.shift();
          return typeof choice === "number" ? options[choice] : choice;
        },
        custom: async () => { calls.push("custom"); return undefined; },
      },
    };
    await personal.handler("", ctx);
    assert.equal(menus[0].options.length, 6);
    assert.equal(menus[0].options.filter((label) => label.startsWith("状态栏：")).length, 1);
    assert.equal(menus[0].options[1], "状态栏：额度、会话 ID 与配色 · 已加载");
    assert.equal(readFileSync(path, "utf8"), "{}");
    const expected = {
      0: ["查看状态", "选择命名模型", "选择命名思考强度", "预览建议标题", "暂停当前会话命名", "恢复当前会话命名"],
      2: ["查看路径链接设置", "开启路径链接", "暂停路径链接", "打开方式：vscode", "打开方式：vscode-insiders", "打开方式：cursor", "打开方式：windsurf", "打开方式：file", "识别裸路径", "不识别裸路径"],
      1: ["选择 pi-statusline 自定义配色", "查看 token 速度口径", "独立功能开关"],
      4: ["查看分类模型与状态", "选择分类模型（Jev / d1-ultra）", "测试分类模型可用性"],
    };
    for (let feature = 0; feature < ids.length; feature++) {
      choices = [feature, undefined];
      await personal.handler("", ctx);
      assert.deepEqual(menus.at(-2).options, [...(expected[feature] ?? []), "禁用此功能并重载"]);
    }
    const choose = async (feature, action) => {
      choices = [feature, action];
      await personal.handler("", ctx);
      assert.equal(choices.length, 0);
    };
    await choose(0, "查看状态");
    assert.match(notices.at(-1)[0], /自动命名：开启.*选择：\/personal → 自动会话命名/);
    await choose(0, "选择命名模型");
    assert.match(menus.at(-3).title, /^命名模型（全局）/);
    await choose(0, "选择命名思考强度");
    assert.match(menus.at(-3).title, /^命名思考强度（全局）/);
    await choose(0, "预览建议标题");
    assert.match(notices.at(-1)[0], /还没有可用于命名的用户文本/);
    await choose(0, "暂停当前会话命名");
    assert.equal(entries.at(-1).data.enabled, false);
    await choose(0, "恢复当前会话命名");
    assert.equal(entries.at(-1).data.enabled, true);
    await choose(2, "查看路径链接设置");
    assert.match(notices.at(-1)[0], /设置：\/personal → 文件路径可点击/);
    for (const [action, key, value] of [
      ["开启路径链接", "enabled", true], ["暂停路径链接", "enabled", false],
      ...["vscode", "vscode-insiders", "cursor", "windsurf", "file"].map((editor) => [`打开方式：${editor}`, "editor", editor]),
      ["识别裸路径", "bareText", true], ["不识别裸路径", "bareText", false],
    ]) {
      await choose(2, action);
      assert.equal(JSON.parse(readFileSync(join(dir, "clickable-paths.json"), "utf8"))[key], value);
    }
    await choose(1, "独立功能开关");
    assert.match(menus.at(-3).title, /状态栏独立功能开关/);
    await choose(1, "查看 token 速度口径");
    assert.match(notices.at(-1)[0], /usage.output.*隐藏推理.*不替换 footer/);
    await choose(1, "选择 pi-statusline 自定义配色");
    assert.equal(calls.at(-1), "custom");
    await choose(4, "查看分类模型与状态");
    assert.match(notices.at(-1)[0], /后续分类：openrouter\/~typesafe\/jev-latest/);
    await choose(4, "选择分类模型（Jev / d1-ultra）");
    assert.match(menus.at(-3).title, /^思考分类模型（全局）/);
    assert.equal(menus.at(-3).options.length, 2);
    for (const [index, model] of [[0, "jev"], [1, "d1-ultra"]]) {
      choices = [4, "选择分类模型（Jev / d1-ultra）", index];
      await personal.handler("", ctx);
      assert.equal(choices.length, 0);
      assert.deepEqual(JSON.parse(readFileSync(join(dir, "inline-effort.json"), "utf8")), { model });
    }
    await choose(4, "测试分类模型可用性");
    assert.equal(classifierCalls, 1);
    assert.match(notices.at(-1)[0], /测试成功/);
    assert.equal(readFileSync(path, "utf8"), "{}");
    assert.equal(reloads, 0);
    choices = [5];
    await personal.handler("", ctx);
    assert.equal(calls.at(-1), "custom");
    await personal.handler("switches", ctx);
    assert.equal(calls.at(-1), "custom");
    choices = [4, "禁用此功能并重载"];
    await personal.handler("", ctx);
    assert.equal(reloads, 1);
    assert.equal(JSON.parse(readFileSync(path, "utf8"))["inline-effort"], false);
    const disabled = load();
    assert.deepEqual([...disabled.commands.keys()], ["personal"]);
    choices = [4, undefined];
    await disabled.commands.get("personal").handler("", ctx);
    assert.deepEqual(menus.at(-2).options, ["启用此功能并重载"]);
    choices = [4, 0];
    await disabled.commands.get("personal").handler("", ctx);
    assert.equal(reloads, 2);
    assert.equal(JSON.parse(readFileSync(path, "utf8"))["inline-effort"], true);
    await personal.handler("invalid", ctx);
    assert.match(notices.at(-1)[0], /用法/);
    assert.equal(reloads, 2);
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("TUI 和有 UI 的 RPC 均可从 personal 子菜单保存分类模型，不重载、不调用主模型", async () => {
  const previous = process.env.PI_CODING_AGENT_DIR;
  const dir = mkdtempSync(join(tmpdir(), "pi-personal-effort-"));
  process.env.PI_CODING_AGENT_DIR = dir;
  try {
    const loaded = load();
    let reloads = 0;
    for (const mode of ["tui", "rpc"]) {
      const choices = [4, 1, 1];
      const ctx = {
        mode, hasUI: true, isIdle: () => true,
        reload: async () => { reloads++; },
        ui: {
          select: async (_title, options) => options[choices.shift()],
          notify() {},
        },
      };
      await loaded.commands.get("personal").handler("", ctx);
      assert.deepEqual(JSON.parse(readFileSync(join(dir, "inline-effort.json"), "utf8")), { model: "d1-ultra" });
      assert.equal(reloads, 0);
      assert.equal(choices.length, 0);
    }
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("RPC 支持逐项启停，批量开关提示替代路径；没有 UI 时提示并返回", async () => {
  const previous = process.env.PI_CODING_AGENT_DIR;
  const dir = mkdtempSync(join(tmpdir(), "pi-personal-rpc-"));
  process.env.PI_CODING_AGENT_DIR = dir;
  const path = join(dir, "personal-extensions.json");
  try {
    writeFileSync(path, JSON.stringify(off));
    const command = load().commands.get("personal");
    const notices = [];
    let choices = [0, "启用此功能并重载"];
    let reloads = 0;
    const ctx = {
      mode: "rpc", hasUI: true,
      reload: async () => { reloads++; },
      ui: {
        notify: (...args) => notices.push(args),
        select: async (_title, options) => {
          const choice = choices.shift();
          return typeof choice === "number" ? options[choice] : choice;
        },
        custom: async () => assert.fail("RPC 不应调用 custom"),
      },
    };
    await command.handler("", ctx);
    assert.equal(reloads, 1);
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), { ...off, "auto-session-name": true });
    const saved = readFileSync(path, "utf8");
    choices = ["批量功能开关"];
    for (const args of ["", "switches"]) {
      await command.handler(args, ctx);
      assert.match(notices.at(-1)[0], /不支持批量功能开关.*\/personal.*启用此功能并重载.*禁用此功能并重载/);
      assert.equal(notices.at(-1)[1], "warning");
    }
    assert.equal(readFileSync(path, "utf8"), saved);
    assert.equal(reloads, 1);
    for (const mode of ["tui", "rpc", "print", "json"]) {
      for (const args of ["", "switches"]) {
        await command.handler(args, {
          ...ctx, mode, hasUI: false,
          reload: async () => assert.fail("无 UI 时不应重载"),
          ui: { ...ctx.ui, select: async () => assert.fail("无 UI 时不应打开菜单") },
        });
        assert.match(notices.at(-1)[0], /没有交互界面.*\/personal/);
        assert.equal(notices.at(-1)[1], "warning");
      }
    }
    assert.equal(readFileSync(path, "utf8"), saved);
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("RPC 从统一配色选择器应用全部 11 套自定义配色，无需 custom", async () => {
  const previous = process.env.PI_CODING_AGENT_DIR;
  const dir = mkdtempSync(join(tmpdir(), "pi-personal-rpc-style-"));
  process.env.PI_CODING_AGENT_DIR = dir;
  const path = join(dir, "pi-statusline.json");
  try {
    writeFileSync(path, JSON.stringify({ preserved: "保留原有配置" }));
    const command = load().commands.get("personal");
    const notices = [];
    let choices = [];
    let reloads = 0;
    const ctx = {
      mode: "rpc", hasUI: true,
      reload: async () => { reloads++; },
      ui: {
        notify: (...args) => notices.push(args),
        select: async (_title, options) => options[choices.shift()],
        custom: async () => assert.fail("直接应用配色不应调用 custom"),
      },
    };
    for (const [index, name] of styleNames.entries()) {
      choices = [1, 0, index];
      await command.handler("", ctx);
      assert.equal(choices.length, 0);
      assert.deepEqual(notices.at(-1), [`已应用 pi-statusline 自定义配色：${name}（紧凑布局、圆角分隔符）`, "info"]);
      const config = JSON.parse(readFileSync(path, "utf8"));
      assert.equal(config.preserved, "保留原有配置");
      assert.equal(config.palettePreset, "custom");
      assert.equal(Object.keys(config.palette).length, 13);
      assert.equal(reloads, index + 1);
    }
    assert.equal(JSON.parse(readFileSync(path, "utf8")).palette.brand.fg, "#d97757");
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("技术讲解页的状态栏菜单示例包含配色与 token 速度口径处理器", () => {
  const html = readFileSync(new URL("../docs/extensions-guide/src/02-entry.html", import.meta.url), "utf8");
  assert.match(html, /状态栏 3 项（选择 pi-statusline 自定义配色、查看 token 速度口径、独立功能开关）/);
  const row = html.match(/\{ label: "状态栏：额度、会话 ID 与配色", command:[^\n]+/)[0].replace(/,$/, "");
  const ac = (command, list) => list.map(([label, args]) => ({ label, cmd: `${command}${args ? ` ${args}` : ""}` }));
  const feature = new Function("ac", `return (${row});`)(ac);
  assert.deepEqual(feature.actions.map(({ cmd }) => cmd), ["statusline-style", "statusline-info", "statusline-settings"]);
  const expression = html.match(/const names = (.+);/)[1];
  const getNames = new Function("features", "on", `return (${expression});`);
  assert.deepEqual(getNames([feature], [true]), ["statusline-style", "statusline-info", "statusline-settings"]);
  assert.deepEqual(getNames([feature], [false]), []);
});

test("状态栏总开关保留独立设置，旧总开关兼容规则不变", () => {
  const previous = process.env.PI_CODING_AGENT_DIR;
  const dir = mkdtempSync(join(tmpdir(), "pi-statusline-master-test-"));
  process.env.PI_CODING_AGENT_DIR = dir;
  try {
    const path = join(dir, "personal-extensions.json");
    const settingsPath = join(dir, "personal-statusline.json");
    const saved = JSON.stringify({ usageEnabled: false, sessionIdEnabled: false, tokenSpeedEnabled: false, styleEnabled: false });
    writeFileSync(settingsPath, saved);
    writeFileSync(path, JSON.stringify({ ...off, statusline: true }));
    assert.ok(load().events.includes("message_end"), "独立开关不改变顶层功能注册");
    writeFileSync(path, JSON.stringify(off));
    assert.equal(load().events.length, 0);
    assert.equal(readFileSync(settingsPath, "utf8"), saved);
    const legacy = { ...off, substatusline: false, "statusline-style-picker": false };
    delete legacy.statusline;
    writeFileSync(path, JSON.stringify(legacy));
    assert.equal(load().events.length, 0);
    writeFileSync(path, JSON.stringify({ ...legacy, statusline: true }));
    assert.ok(load().events.includes("message_end"), "新总开关覆盖旧总开关");
    assert.equal(readFileSync(settingsPath, "utf8"), saved);
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
