import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import personal from "../extensions/pi-personal-extensions.ts";

test("菜单逐级返回，取消不保存，保存后留在二级菜单，重载后停止导航", async () => {
  const previous = process.env.PI_CODING_AGENT_DIR;
  const dir = mkdtempSync(join(tmpdir(), "pi-personal-navigation-"));
  process.env.PI_CODING_AGENT_DIR = dir;
  try {
    for (const mode of ["tui", "rpc"]) {
      const commands = new Map();
      personal({
        registerCommand: (name, command) => commands.set(name, command),
        on() {}, registerMarkdownTransformer() {}, registerTool() {},
      });
      const path = join(dir, "inline-effort.json");
      rmSync(path, { force: true });
      const steps = [
        [/统一管理/, 4],
        [/原位思考强度.*返回上一级/, 1],
        [/思考分类模型（全局）/, undefined],
        [/原位思考强度.*返回上一级/, 1, () => assert.equal(existsSync(path), false)],
        [/思考分类模型（全局）/, 1],
        [/原位思考强度.*返回上一级/, undefined, () => assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), { model: "d1-ultra" })],
        [/统一管理/, 0],
        [/自动会话命名.*返回上一级/, undefined],
        [/统一管理/, undefined],
      ];
      let reloads = 0;
      const ctx = {
        mode, hasUI: true, isIdle: () => true,
        reload: async () => { reloads++; },
        ui: {
          notify() {},
          select: async (title, options) => {
            assert.ok(steps.length, "不应多打开菜单，尤其是重载之后");
            const [pattern, index, check] = steps.shift();
            assert.match(title, pattern);
            check?.();
            return options[index];
          },
          custom: async () => undefined,
        },
      };
      const command = commands.get("personal");
      await command.handler("", ctx);
      assert.equal(steps.length, 0);
      assert.equal(reloads, 0);
      if (mode === "tui") {
        steps.push([/统一管理/, 5], [/统一管理/, undefined]);
        await command.handler("", ctx);
        assert.equal(steps.length, 0, "批量开关取消后返回一级菜单");
        steps.push([/统一管理/, 1], [/状态栏.*返回上一级/, 0], [/状态栏.*返回上一级/, undefined], [/统一管理/, undefined]);
        await command.handler("", ctx);
        assert.equal(steps.length, 0, "配色预览取消后返回二级菜单");
      }
      steps.push([/统一管理/, 1], [/状态栏.*返回上一级/, 0]);
      if (mode === "rpc") steps.push([/选择 pi-statusline 自定义配色/, 0]);
      else ctx.ui.custom = async () => 0;
      await command.handler("", ctx);
      assert.equal(reloads, 1);
      assert.equal(steps.length, 0);
    }
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
