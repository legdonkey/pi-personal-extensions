import assert from "node:assert/strict";
import { test } from "node:test";
import { stripVTControlCharacters } from "node:util";
import { visibleWidth } from "@earendil-works/pi-tui";
import sessionTitle from "../extensions/session-title.ts";

test("会话标题右对齐、截断、改名与切换同步，退出清理且不接管页脚", () => {
  const handlers = new Map();
  sessionTitle({ on: (event, handler) => handlers.set(event, handler) });
  let name = "实现会话标题 🐱";
  let widget;
  let updates = 0;
  const theme = { fg: (_color, text) => `\x1b[90m${text}\x1b[0m` };
  const ctx = {
    mode: "tui",
    sessionManager: { getSessionName: () => name },
    ui: {
      setWidget(key, factory, options) {
        assert.equal(key, "personal-session-title");
        if (factory) assert.equal(options.placement, "belowEditor");
        widget = factory?.({}, theme);
        updates++;
      },
    },
  };
  const emit = (event, context = ctx) => handlers.get(event)({}, context);
  const render = (width) => stripVTControlCharacters(widget.render(width)[0]);
  emit("session_start");
  assert.equal(render(40), " ".repeat(40 - visibleWidth(name)) + name);
  for (const width of [0, 1, 2, 3, 8, 20, 40, 80]) {
    assert.equal(visibleWidth(render(width)), width);
    assert.equal(widget.render(width).length, 1);
  }
  assert.ok(render(8).endsWith("…"));
  name = "改名";
  emit("session_info_changed");
  assert.equal(render(20).trim(), name);
  name = "\x1b[31m标题\x1b[0m\n\t下一行\x07";
  emit("session_info_changed");
  assert.equal(render(40).trim(), "标题  下一行");
  name = undefined;
  emit("session_info_changed");
  assert.equal(render(40).trim(), "未命名会话");
  emit("session_shutdown");
  assert.equal(widget, undefined);
  name = "恢复的会话";
  emit("session_start");
  assert.equal(render(40).trim(), name);
  theme.fg = (_color, text) => `\x1b[37m${text}\x1b[0m`;
  widget.invalidate();
  assert.ok(widget.render(40)[0].includes("\x1b[37m"));
  const before = updates;
  for (const mode of ["rpc", "print", "json"]) {
    for (const event of handlers.keys()) emit(event, { ...ctx, mode });
  }
  assert.equal(updates, before);
});
