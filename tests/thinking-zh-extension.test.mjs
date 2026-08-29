import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { initTheme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { registerThinkingZh } from "../extensions/thinking-zh.ts";
import {
  getThinkingZhConfigPath,
  loadThinkingZhConfig,
} from "../extensions/thinking-zh/config.ts";
import { deferred, waitFor } from "./helpers.mjs";

initTheme();

const createFakePi = () => {
  const handlers = new Map();
  const commands = new Map();
  const mutations = [];
  return {
    handlers,
    commands,
    mutations,
    on(event, handler) {
      handlers.set(event, handler);
    },
    registerCommand(name, command) {
      commands.set(name, command);
    },
    sendMessage(...args) {
      mutations.push(["sendMessage", ...args]);
    },
    appendEntry(...args) {
      mutations.push(["appendEntry", ...args]);
    },
  };
};

const createFakeContext = (completion) => {
  let widget;
  let widgetComponent;
  let overlayComponent;
  let overlayOptions;
  let renderRequests = 0;
  let completeCalls = 0;
  const requestSignals = [];
  const model = { provider: "fake", id: "translator", reasoning: true };
  const tui = {
    requestRender() {
      renderRequests += 1;
    },
  };
  const theme = {
    fg(_color, text) {
      return text;
    },
    bold(text) {
      return text;
    },
  };
  const ui = {
    theme,
    notifications: [],
    setWidget(_key, content) {
      widget = content;
      widgetComponent =
        typeof content === "function" ? content(tui, theme) : undefined;
    },
    notify(message, type) {
      this.notifications.push({ message, type });
    },
    async custom(factory, options) {
      overlayOptions = options;
      overlayComponent = await factory(tui, theme, {}, () => undefined);
      return undefined;
    },
  };
  const ctx = {
    mode: "tui",
    hasUI: true,
    ui,
    getSignal: () => undefined,
    modelRegistry: {
      find: (provider, id) =>
        provider === model.provider && id === model.id ? model : undefined,
      hasConfiguredAuth: () => true,
      complete: async (_model, _context, options) => {
        completeCalls += 1;
        requestSignals.push(options.signal);
        return typeof completion === "function"
          ? completion(_model, _context, options)
          : completion.promise;
      },
    },
  };
  return {
    ctx,
    completeCalls: () => completeCalls,
    renderRequests: () => renderRequests,
    requestSignals,
    overlayOptions: () => overlayOptions,
    renderOverlay: () => overlayComponent?.render(80) ?? [],
    renderWidget: (width = 80) =>
      Array.isArray(widget)
        ? widget
        : (widgetComponent?.render(width) ?? []),
  };
};

test("非 TUI 模式不会发起旁路翻译请求", () => {
  const agentDir = mkdtempSync(path.join(tmpdir(), "thinking-zh-extension-"));
  try {
    writeFileSync(
      path.join(agentDir, "thinking-zh.json"),
      JSON.stringify({
        version: 1,
        enabled: true,
        translatorModel: { provider: "fake", id: "translator" },
      }),
    );
    const completion = deferred();
    const pi = createFakePi();
    const fake = createFakeContext(completion);
    fake.ctx.mode = "print";
    fake.ctx.hasUI = false;
    registerThinkingZh(pi, { agentDir });

    pi.handlers.get("session_start")({}, fake.ctx);
    pi.handlers.get("message_start")(
      { message: { role: "assistant", content: [] } },
      fake.ctx,
    );
    pi.handlers.get("message_update")(
      {
        message: { role: "assistant", content: [] },
        assistantMessageEvent: {
          type: "thinking_end",
          contentIndex: 0,
          content: "Summarizing Pi extensions",
          partial: { role: "assistant", content: [] },
        },
      },
      fake.ctx,
    );

    assert.equal(fake.completeCalls(), 0);
    assert.deepEqual(fake.renderWidget(), []);
  } finally {
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("新用户任务取消旧翻译并阻止过期结果写回", async () => {
  const agentDir = mkdtempSync(path.join(tmpdir(), "thinking-zh-extension-"));
  try {
    writeFileSync(
      path.join(agentDir, "thinking-zh.json"),
      JSON.stringify({
        version: 1,
        enabled: true,
        translatorModel: { provider: "fake", id: "translator" },
      }),
    );
    const completion = deferred();
    const pi = createFakePi();
    const fake = createFakeContext(completion);
    registerThinkingZh(pi, { agentDir });
    pi.handlers.get("session_start")({}, fake.ctx);
    pi.handlers.get("message_start")(
      { message: { role: "assistant", content: [] } },
      fake.ctx,
    );
    pi.handlers.get("message_update")(
      {
        message: { role: "assistant", content: [] },
        assistantMessageEvent: {
          type: "thinking_end",
          contentIndex: 0,
          content: "Summarizing stale work",
          partial: { role: "assistant", content: [] },
        },
      },
      fake.ctx,
    );
    assert.equal(fake.requestSignals[0]?.aborted, false);

    pi.handlers.get("message_start")(
      { message: { role: "user", content: "新任务" } },
      fake.ctx,
    );
    assert.equal(fake.requestSignals[0]?.aborted, true);
    assert.deepEqual(fake.renderWidget(), []);

    completion.resolve({
      stopReason: "stop",
      content: [{ type: "text", text: "过期译文" }],
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(fake.renderWidget(), []);
    assert.deepEqual(fake.ctx.ui.notifications, []);
  } finally {
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("message_end 不会重新入队已收到 thinking_end 的块", async () => {
  const agentDir = mkdtempSync(path.join(tmpdir(), "thinking-zh-extension-"));
  try {
    writeFileSync(
      path.join(agentDir, "thinking-zh.json"),
      JSON.stringify({
        version: 1,
        enabled: true,
        translatorModel: { provider: "fake", id: "translator" },
      }),
    );
    const completion = deferred();
    const pi = createFakePi();
    const fake = createFakeContext(completion);
    registerThinkingZh(pi, { agentDir });
    pi.handlers.get("session_start")({}, fake.ctx);
    const assistantMessage = {
      role: "assistant",
      content: [{ type: "thinking", thinking: "Reviewing clear behavior" }],
    };
    pi.handlers.get("message_start")(
      { message: assistantMessage },
      fake.ctx,
    );
    pi.handlers.get("message_update")(
      {
        message: assistantMessage,
        assistantMessageEvent: {
          type: "thinking_end",
          contentIndex: 0,
          content: "Reviewing clear behavior",
          partial: assistantMessage,
        },
      },
      fake.ctx,
    );
    assert.equal(fake.completeCalls(), 1);

    await pi.commands.get("thinking-zh").handler("clear", fake.ctx);
    pi.handlers.get("message_end")(
      { message: assistantMessage },
      fake.ctx,
    );
    assert.equal(fake.completeCalls(), 1);

    completion.resolve({
      stopReason: "stop",
      content: [{ type: "text", text: "过期译文" }],
    });
  } finally {
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("关闭、清理、切换模型和 shutdown 都会取消旁路请求", async (t) => {
  for (const action of ["off", "clear", "model", "shutdown"]) {
    await t.test(action, async () => {
      const agentDir = mkdtempSync(
        path.join(tmpdir(), "thinking-zh-extension-"),
      );
      try {
        writeFileSync(
          path.join(agentDir, "thinking-zh.json"),
          JSON.stringify({
            version: 1,
            enabled: true,
            translatorModel: { provider: "fake", id: "translator" },
          }),
        );
        const completion = deferred();
        const pi = createFakePi();
        const fake = createFakeContext(completion);
        registerThinkingZh(pi, { agentDir });
        pi.handlers.get("session_start")({}, fake.ctx);
        const assistantMessage = {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "Translating pending work" },
          ],
        };
        pi.handlers.get("message_start")(
          { message: assistantMessage },
          fake.ctx,
        );
        pi.handlers.get("message_update")(
          {
            message: assistantMessage,
            assistantMessageEvent: {
              type: "thinking_end",
              contentIndex: 0,
              content: "Translating pending work",
              partial: assistantMessage,
            },
          },
          fake.ctx,
        );
        assert.equal(fake.requestSignals[0]?.aborted, false);

        if (action === "shutdown") {
          pi.handlers.get("session_shutdown")({}, fake.ctx);
        } else {
          const commandArgs =
            action === "model" ? "model fake/translator" : action;
          await pi.commands.get("thinking-zh").handler(commandArgs, fake.ctx);
        }
        assert.equal(fake.requestSignals[0]?.aborted, true);
        assert.deepEqual(fake.renderWidget(), []);
        if (action === "clear" || action === "model") {
          pi.handlers.get("message_end")(
            { message: assistantMessage },
            fake.ctx,
          );
          assert.equal(fake.completeCalls(), 1);
        }

        completion.resolve({
          stopReason: "stop",
          content: [{ type: "text", text: "不应显示的过期译文" }],
        });
        await new Promise((resolve) => setImmediate(resolve));
        assert.deepEqual(fake.renderWidget(), []);
        assert.deepEqual(pi.mutations, []);
      } finally {
        rmSync(agentDir, { recursive: true, force: true });
      }
    });
  }
});

test("队列溢出的 thinking_end 不会被 message_end 重新入队", async () => {
  const agentDir = mkdtempSync(path.join(tmpdir(), "thinking-zh-extension-"));
  try {
    writeFileSync(
      path.join(agentDir, "thinking-zh.json"),
      JSON.stringify({
        version: 1,
        enabled: true,
        translatorModel: { provider: "fake", id: "translator" },
      }),
    );
    const first = deferred();
    let providerCall = 0;
    const pi = createFakePi();
    const fake = createFakeContext(async () => {
      providerCall += 1;
      if (providerCall === 1) return first.promise;
      return {
        stopReason: "stop",
        content: [{ type: "text", text: "已翻译" }],
      };
    });
    registerThinkingZh(pi, { agentDir });
    pi.handlers.get("session_start")({}, fake.ctx);
    const blocks = Array.from({ length: 33 }, (_value, index) => ({
      type: "thinking",
      thinking: `Reviewing unique item ${index}`,
    }));
    const assistantMessage = { role: "assistant", content: blocks };
    pi.handlers.get("message_start")(
      { message: assistantMessage },
      fake.ctx,
    );
    blocks.forEach((block, contentIndex) => {
      pi.handlers.get("message_update")(
        {
          message: assistantMessage,
          assistantMessageEvent: {
            type: "thinking_end",
            contentIndex,
            content: block.thinking,
            partial: assistantMessage,
          },
        },
        fake.ctx,
      );
    });
    assert.equal(fake.completeCalls(), 1);

    first.resolve({
      stopReason: "stop",
      content: [{ type: "text", text: "已翻译" }],
    });
    await waitFor(
      () => fake.completeCalls() === 32,
      "accepted queue to drain",
    );
    pi.handlers.get("message_end")(
      { message: assistantMessage },
      fake.ctx,
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fake.completeCalls(), 32);
  } finally {
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("缓存键保留 Markdown 换行结构", async () => {
  const agentDir = mkdtempSync(path.join(tmpdir(), "thinking-zh-extension-"));
  try {
    writeFileSync(
      path.join(agentDir, "thinking-zh.json"),
      JSON.stringify({
        version: 1,
        enabled: true,
        translatorModel: { provider: "fake", id: "translator" },
      }),
    );
    const pi = createFakePi();
    const fake = createFakeContext(async (_model, context) => {
      const sent = context.messages[0].content[0].text;
      const text = sent.includes("Reviewing\n\nMarkdown structure")
        ? "第一段\n\n第二段"
        : "单段译文";
      return { stopReason: "stop", content: [{ type: "text", text }] };
    });
    registerThinkingZh(pi, { agentDir });
    pi.handlers.get("session_start")({}, fake.ctx);

    for (const [index, source] of [
      "Reviewing\n\nMarkdown structure",
      "Reviewing Markdown structure",
    ].entries()) {
      pi.handlers.get("message_start")(
        { message: { role: "assistant", content: [] } },
        fake.ctx,
      );
      pi.handlers.get("message_update")(
        {
          message: { role: "assistant", content: [] },
          assistantMessageEvent: {
            type: "thinking_end",
            contentIndex: index,
            content: source,
            partial: { role: "assistant", content: [] },
          },
        },
        fake.ctx,
      );
    }

    await waitFor(
      () => fake.renderWidget().join("\n").includes("单段译文"),
      "single-paragraph translation",
    );
    assert.equal(fake.completeCalls(), 2);
    const widget = fake.renderWidget().join("\n");
    assert.match(widget, /第一段/);
    assert.match(widget, /第二段/);
    assert.match(widget, /单段译文/);
  } finally {
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("缓存键包含受保护值，避免不同代码片段串译", async () => {
  const agentDir = mkdtempSync(path.join(tmpdir(), "thinking-zh-extension-"));
  try {
    writeFileSync(
      path.join(agentDir, "thinking-zh.json"),
      JSON.stringify({
        version: 1,
        enabled: true,
        translatorModel: { provider: "fake", id: "translator" },
      }),
    );
    const pi = createFakePi();
    const fake = createFakeContext(async () => ({
      stopReason: "stop",
      content: [
        { type: "text", text: "正在检查 __PI_THINKING_ZH_0000__" },
      ],
    }));
    registerThinkingZh(pi, { agentDir });
    pi.handlers.get("session_start")({}, fake.ctx);

    for (const [index, secret] of ["alpha-secret", "beta-secret"].entries()) {
      pi.handlers.get("message_start")(
        { message: { role: "assistant", content: [] } },
        fake.ctx,
      );
      pi.handlers.get("message_update")(
        {
          message: { role: "assistant", content: [] },
          assistantMessageEvent: {
            type: "thinking_end",
            contentIndex: index,
            content: `Checking \`${secret}\``,
            partial: { role: "assistant", content: [] },
          },
        },
        fake.ctx,
      );
    }

    await waitFor(
      () => fake.renderWidget().join("\n").includes("beta-secret"),
      "second protected value",
    );
    assert.equal(fake.completeCalls(), 2);
    const widget = fake.renderWidget().join("\n");
    assert.match(widget, /alpha-secret/);
    assert.match(widget, /beta-secret/);
  } finally {
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("message_end 能补译缺失 thinking_end 的最终思考块", async () => {
  const agentDir = mkdtempSync(path.join(tmpdir(), "thinking-zh-extension-"));
  try {
    writeFileSync(
      path.join(agentDir, "thinking-zh.json"),
      JSON.stringify({
        version: 1,
        enabled: true,
        translatorModel: { provider: "fake", id: "translator" },
      }),
    );
    const completion = deferred();
    const pi = createFakePi();
    const fake = createFakeContext(completion);
    registerThinkingZh(pi, { agentDir });
    pi.handlers.get("session_start")({}, fake.ctx);
    const assistantMessage = {
      role: "assistant",
      content: [{ type: "thinking", thinking: "Reviewing fallback behavior" }],
    };
    pi.handlers.get("message_start")(
      { message: assistantMessage },
      fake.ctx,
    );
    pi.handlers.get("message_end")(
      { message: assistantMessage },
      fake.ctx,
    );

    assert.equal(fake.completeCalls(), 1);
    completion.resolve({
      stopReason: "stop",
      content: [{ type: "text", text: "正在检查兜底行为" }],
    });
    await waitFor(
      () => fake.renderWidget().join("\n").includes("正在检查兜底行为"),
      "message_end fallback",
    );
  } finally {
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("model、on、off 命令显式控制全局配置", async () => {
  const agentDir = mkdtempSync(path.join(tmpdir(), "thinking-zh-extension-"));
  try {
    const completion = deferred();
    const pi = createFakePi();
    const fake = createFakeContext(completion);
    registerThinkingZh(pi, { agentDir });
    pi.handlers.get("session_start")({}, fake.ctx);
    const command = pi.commands.get("thinking-zh");
    const configPath = getThinkingZhConfigPath(agentDir);

    await command.handler("model fake/translator", fake.ctx);
    assert.deepEqual(loadThinkingZhConfig(configPath), {
      config: {
        version: 1,
        enabled: false,
        translatorModel: { provider: "fake", id: "translator" },
      },
    });

    await command.handler("on", fake.ctx);
    assert.equal(loadThinkingZhConfig(configPath).config.enabled, true);

    await command.handler("off", fake.ctx);
    assert.equal(loadThinkingZhConfig(configPath).config.enabled, false);
  } finally {
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("thinking_end 在后台翻译且 message_end 兜底不会重复请求", async () => {
  const agentDir = mkdtempSync(path.join(tmpdir(), "thinking-zh-extension-"));
  try {
    writeFileSync(
      path.join(agentDir, "thinking-zh.json"),
      JSON.stringify({
        version: 1,
        enabled: true,
        translatorModel: { provider: "fake", id: "translator" },
      }),
    );
    const completion = deferred();
    const pi = createFakePi();
    const fake = createFakeContext(completion);
    registerThinkingZh(pi, { agentDir });

    pi.handlers.get("session_start")({}, fake.ctx);
    pi.handlers.get("message_start")(
      { message: { role: "user", content: "开始", timestamp: Date.now() } },
      fake.ctx,
    );
    const assistantMessage = {
      role: "assistant",
      content: [{ type: "thinking", thinking: "Summarizing Pi extensions" }],
    };
    pi.handlers.get("message_start")(
      { message: assistantMessage },
      fake.ctx,
    );

    const updateResult = pi.handlers.get("message_update")(
      {
        message: assistantMessage,
        assistantMessageEvent: {
          type: "thinking_end",
          contentIndex: 0,
          content: "Summarizing Pi extensions",
          partial: assistantMessage,
        },
      },
      fake.ctx,
    );

    assert.equal(updateResult, undefined);
    assert.equal(fake.completeCalls(), 1);
    assert.match(fake.renderWidget().join("\n"), /正在翻译/);
    assert.equal(
      fake.renderWidget(8).every((line) => visibleWidth(line) <= 8),
      true,
    );
    await pi.commands.get("thinking-zh").handler("show", fake.ctx);
    assert.match(fake.renderOverlay().join("\n"), /正在翻译/);

    completion.resolve({
      stopReason: "stop",
      content: [{ type: "text", text: "**正在归纳** Pi 扩展" }],
    });
    await waitFor(
      () => fake.renderWidget().join("\n").includes("正在归纳"),
      "translated widget",
    );
    assert.ok(fake.renderRequests() > 0);
    assert.equal(fake.renderWidget().join("\n").includes("**"), false);

    pi.handlers.get("message_end")(
      { message: assistantMessage },
      fake.ctx,
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fake.completeCalls(), 1);

    const overlay = fake.renderOverlay().join("\n");
    assert.match(overlay, /Summarizing Pi extensions/);
    assert.match(overlay, /正在归纳/);
    assert.match(overlay, /Pi 扩展/);
    assert.equal(fake.overlayOptions()?.overlay, true);
    assert.deepEqual(pi.mutations, []);
  } finally {
    rmSync(agentDir, { recursive: true, force: true });
  }
});
