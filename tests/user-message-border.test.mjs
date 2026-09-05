import assert from "node:assert/strict";
import { test } from "node:test";
import { stripVTControlCharacters as plain } from "node:util";
import {
  initTheme,
  UserMessageComponent,
} from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import extension from "../extensions/user-message-border.ts";

function load() {
  const handlers = new Map();
  extension({ on: (name, handler) => handlers.set(name, handler) });
  return {
    start: (mode = "tui") => handlers.get("session_start")({}, { mode }),
    stop: () => handlers.get("session_shutdown")({}),
  };
}

test("边框与原生背景边缘重合，不改变消息尺寸、正文和鼠标坐标", () => {
  const prototype = UserMessageComponent.prototype;
  const originalRender = prototype.render;
  const originalMouse = prototype.handleMouse;
  const runtime = load();
  try {
    for (const mode of ["rpc", "json", "print"]) {
      runtime.start(mode);
      assert.equal(prototype.render, originalRender);
    }
    runtime.start();
    const patchedRender = prototype.render;
    runtime.start();
    assert.equal(prototype.render, patchedRender, "重复启动不叠加边框");
    assert.equal(
      prototype.handleMouse,
      originalMouse,
      "布局不变，无需包装鼠标处理",
    );

    for (const theme of ["dark", "light"]) {
      initTheme(theme);
      for (const padding of [1, 3]) {
        const message = new UserMessageComponent(
          "中文消息 👩‍💻 **强调** [链接](https://example.com)\n\n" +
            "长消息自动换行。".repeat(12) +
            "\n\n```ts\nconst n = 42;\n```",
          undefined,
          padding,
        );
        for (const width of [20, 80, 120, 40]) {
          const expected = originalRender.call(message, width);
          const actual = message.render(width);
          assert.equal(
            actual.length,
            expected.length,
            "边框占用原有留白，不额外增加行",
          );
          assert.equal(plain(actual[0]), `┌${"─".repeat(width - 2)}┐`);
          assert.equal(plain(actual.at(-1)), `└${"─".repeat(width - 2)}┘`);
          for (let i = 1; i < actual.length - 1; i++) {
            const text = plain(actual[i]);
            assert.equal(text[0], "│");
            assert.equal(text.at(-1), "│");
            assert.equal(
              ` ${text.slice(1, -1)} `,
              plain(expected[i]),
              "正文和换行完全不变",
            );
          }
          for (const [i, line] of actual.entries()) {
            const backgrounds = (s) =>
              new Set(s.match(/\x1b\[(?:48;[\d;]+|49)m/g));
            assert.deepEqual(
              backgrounds(line),
              backgrounds(expected[i]),
              "每行保留原有背景色",
            );
            // 导航标记和超链接的控制序列不得丢失或重复。
            const osc = (s) => s.match(/\x1b\][^\x07]*\x07/g) ?? [];
            assert.deepEqual(osc(line), osc(expected[i]));
          }
          assert.ok(actual.every((line) => visibleWidth(line) === width));
          assert.deepEqual(message.render(width), actual, "不污染原生缓存");
          message.invalidate();
          assert.deepEqual(message.render(width), actual);
        }
      }
    }

    // 没有边缘留白或终端太窄时，不覆盖正文。
    for (const [padding, width] of [
      [0, 40],
      [1, 1],
      [1, 2],
    ]) {
      const message = new UserMessageComponent(
        "不能覆盖的正文",
        undefined,
        padding,
      );
      assert.deepEqual(
        message.render(width),
        originalRender.call(message, width),
      );
    }
    const message = new UserMessageComponent("测试重载");
    runtime.stop();
    assert.equal(prototype.render, originalRender);
    assert.deepEqual(message.render(40), originalRender.call(message, 40));
    runtime.stop();
    runtime.start();
    assert.equal(
      message.render(40).length,
      originalRender.call(message, 40).length,
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
    assert.equal(prototype.handleMouse, originalMouse);
  }
});
