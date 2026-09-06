import assert from "node:assert/strict";
import { test } from "node:test";
import { stripVTControlCharacters as plain } from "node:util";
import {
  initTheme,
  UserMessageComponent,
} from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { theme } from "../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js";
import extension from "../extensions/user-message-border.ts";

function load() {
  const handlers = new Map();
  extension({ on: (name, handler) => handlers.set(name, handler) });
  return {
    start: (mode = "tui") =>
      handlers.get("session_start")(
        {},
        {
          mode,
          ui: {
            get theme() {
              return theme;
            },
          },
        },
      ),
    stop: () => handlers.get("session_shutdown")({}),
  };
}

test("独立圆角边框统一背景，保留原生正文、链接和重载清理", () => {
  const prototype = UserMessageComponent.prototype;
  const originalRender = prototype.render;
  const runtime = load();
  try {
    for (const mode of ["rpc", "json", "print"]) {
      runtime.start(mode);
      assert.equal(prototype.render, originalRender);
    }
    runtime.start();
    const patched = prototype.render;
    runtime.start();
    assert.equal(prototype.render, patched);

    for (const name of ["dark", "light"]) {
      initTheme(name);
      const border = (text) =>
        theme.bg("userMessageBg", `\x1b[38;2;217;154;82m${text}\x1b[39m`);
      for (const padding of [0, 1, 3]) {
        const message = new UserMessageComponent(
          "中文 👩‍💻 **强调** [链接](https://example.com)\n\n" +
            "长消息自动换行。".repeat(12) +
            "\n\n```ts\nconst n = 42;\n```",
          undefined,
          padding,
        );
        for (const width of [20, 80, 120, 40]) {
          const body = originalRender.call(message, width - 2);
          const actual = message.render(width);
          assert.equal(
            actual.length,
            body.length,
            "上下边框替换空白行，不额外增高",
          );
          const blank = " ".repeat(width - 2);
          assert.equal(
            actual[0],
            body[0].replace(blank, border(`╭ user ${"─".repeat(width - 8)}╮`)),
          );
          assert.equal(
            actual.at(-1),
            body.at(-1).replace(blank, border(`╰${"─".repeat(width - 2)}╯`)),
          );
          assert.equal(plain(actual[0]), `╭ user ${"─".repeat(width - 8)}╮`);
          for (const [i, line] of body.slice(1, -1).entries()) {
            assert.equal(
              actual[i + 1],
              border("│") + line + border("│"),
              "正文 ANSI、导航标记、链接和内边距原样保留",
            );
            assert.equal(plain(actual[i + 1]), `│${plain(line)}│`);
          }
          assert.ok(actual.every((line) => visibleWidth(line) === width));
          assert.deepEqual(message.render(width), actual);
          message.invalidate();
          assert.deepEqual(message.render(width), actual);
        }
        for (const width of [1, 2, 7]) {
          assert.deepEqual(
            message.render(width),
            originalRender.call(message, width),
          );
        }
      }
    }
    const message = new UserMessageComponent("测试重载");
    runtime.stop();
    assert.equal(prototype.render, originalRender);
    runtime.stop();
    runtime.start();
    assert.equal(
      message.render(40).length,
      originalRender.call(message, 38).length,
    );
    const ours = prototype.render;
    const later = function (width) {
      return ours.call(this, width);
    };
    prototype.render = later;
    runtime.stop();
    assert.equal(prototype.render, later, "不覆盖后来加载的扩展");
    assert.deepEqual(message.render(40), originalRender.call(message, 40));
  } finally {
    runtime.stop();
    prototype.render = originalRender;
  }
});
