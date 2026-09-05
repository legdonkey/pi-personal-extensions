import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import picker from "../extensions/statusline-style-picker.ts";

test("迁入的风格选择器保留 11 套配色、预览、配置和重载行为", async () => {
  const previous = process.env.PI_AGENT_DIR;
  process.env.PI_AGENT_DIR = mkdtempSync(join(tmpdir(), "pi-style-test-"));
  try {
    let command;
    picker({
      registerCommand: (name, value) => {
        assert.equal(name, "statusline-style");
        command = value;
      },
    });
    assert.equal(command.getArgumentCompletions("").length, 11);
    const path = join(process.env.PI_AGENT_DIR, "pi-statusline.json");
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
    if (previous === undefined) delete process.env.PI_AGENT_DIR;
    else process.env.PI_AGENT_DIR = previous;
  }
});
