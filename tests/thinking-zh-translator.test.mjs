import assert from "node:assert/strict";
import test from "node:test";

import { protectSource } from "../extensions/thinking-zh/protect.ts";
import { translateThinking } from "../extensions/thinking-zh/translator.ts";

test("模型尝试工具调用时拒绝部分译文", async () => {
  const registry = {
    complete: async () => ({
      stopReason: "toolUse",
      content: [
        { type: "text", text: "部分译文" },
        { type: "toolCall", id: "1", name: "unexpected", arguments: {} },
      ],
    }),
  };

  await assert.rejects(
    translateThinking({
      modelRegistry: registry,
      model: { provider: "fake", id: "translator" },
      source: protectSource("Translate this thought"),
      signal: new AbortController().signal,
      retryDelayMs: 0,
    }),
    /未完成|工具/,
  );
});

test("不可重试错误只调用一次翻译模型", async () => {
  let calls = 0;
  const registry = {
    complete: async () => {
      calls += 1;
      throw new Error("authentication failed");
    },
  };

  await assert.rejects(
    translateThinking({
      modelRegistry: registry,
      model: { provider: "fake", id: "translator" },
      source: protectSource("Checking authentication"),
      signal: new AbortController().signal,
      retryDelayMs: 0,
    }),
    /authentication/,
  );
  assert.equal(calls, 1);
});

test("所有尝试共享同一个总超时", async () => {
  let calls = 0;
  const registry = {
    complete: async (_model, _context, options) => {
      calls += 1;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener(
          "abort",
          () => reject(options.signal.reason),
          { once: true },
        );
      });
    },
  };

  await assert.rejects(
    translateThinking({
      modelRegistry: registry,
      model: { provider: "fake", id: "translator" },
      source: protectSource("Waiting for translation"),
      signal: new AbortController().signal,
      timeoutMs: 10,
      retryDelayMs: 0,
    }),
    /timed out|timeout/i,
  );
  assert.equal(calls, 1);
});

test("瞬时错误重试一次并只使用完整 text 译文", async () => {
  const calls = [];
  const registry = {
    complete: async (_model, context, options) => {
      calls.push({ context, options });
      if (calls.length === 1) throw new Error("HTTP 500 temporary failure");
      return {
        stopReason: "stop",
        content: [
          { type: "thinking", thinking: "internal translator thought" },
          {
            type: "text",
            text: "正在检查 __PI_THINKING_ZH_0000__",
          },
        ],
      };
    },
  };
  const protectedSource = protectSource("Checking `private-token`");

  const translated = await translateThinking({
    modelRegistry: registry,
    model: { provider: "fake", id: "translator" },
    source: protectedSource,
    signal: new AbortController().signal,
    retryDelayMs: 0,
  });

  assert.equal(translated, "正在检查 `private-token`");
  assert.equal(calls.length, 2);
  for (const call of calls) {
    const sent = call.context.messages[0].content[0].text;
    assert.equal(sent.includes("private-token"), false);
    assert.match(sent, /__PI_THINKING_ZH_0000__/);
    assert.equal(call.options.cacheRetention, "none");
    assert.equal(call.options.reasoningEffort, "minimal");
    assert.ok(call.options.signal instanceof AbortSignal);
  }
});
