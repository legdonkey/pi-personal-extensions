import assert from "node:assert/strict";
import test from "node:test";

import { TranslationScheduler } from "../extensions/thinking-zh/scheduler.ts";
import { deferred, waitFor } from "./helpers.mjs";

test("重置会取消旧请求且拒绝旧结果写回新用户任务", async () => {
  const stale = deferred();
  let staleSignal;
  let freshStarted = false;
  const scheduler = new TranslationScheduler();

  scheduler.enqueue({
    sourceKey: "old:block-0",
    cacheKey: "model:old",
    original: "Old thought",
    translate: async (signal) => {
      staleSignal = signal;
      return stale.promise;
    },
  });

  scheduler.reset("New user task");
  assert.equal(staleSignal.aborted, true);
  assert.deepEqual(scheduler.getTimeline(), []);

  scheduler.enqueue({
    sourceKey: "new:block-0",
    cacheKey: "model:new",
    original: "Fresh thought",
    translate: async () => {
      freshStarted = true;
      return "新的思考";
    },
  });
  await waitFor(
    () => scheduler.getTimeline()[0]?.status === "translated",
    "fresh translation",
  );
  assert.equal(freshStarted, true);

  stale.resolve("过期的思考");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(
    scheduler.getTimeline().map(({ original, translated }) => ({
      original,
      translated,
    })),
    [{ original: "Fresh thought", translated: "新的思考" }],
  );
});

test("相同思考内容会合并 in-flight 请求并复用会话缓存", async () => {
  const translation = deferred();
  let requestCount = 0;
  const scheduler = new TranslationScheduler();
  const translate = async () => {
    requestCount += 1;
    return translation.promise;
  };

  assert.equal(
    scheduler.enqueue({
      sourceKey: "message-1:block-0",
      cacheKey: "model:same-content",
      original: "Same thought",
      translate,
    }),
    true,
  );
  assert.equal(
    scheduler.enqueue({
      sourceKey: "message-1:block-0",
      cacheKey: "model:same-content",
      original: "Same thought",
      translate,
    }),
    false,
  );
  assert.equal(
    scheduler.enqueue({
      sourceKey: "message-2:block-0",
      cacheKey: "model:same-content",
      original: "Same thought again",
      translate,
    }),
    true,
  );
  assert.equal(requestCount, 1);
  assert.equal(scheduler.getTimeline().length, 2);

  translation.resolve("相同思考");
  await waitFor(
    () =>
      scheduler.getTimeline().every((entry) => entry.status === "translated"),
    "shared translation",
  );
  assert.equal(requestCount, 1);

  assert.equal(
    scheduler.enqueue({
      sourceKey: "message-3:block-0",
      cacheKey: "model:same-content",
      original: "Same thought once more",
      translate: async () => {
        assert.fail("session cache should avoid another model request");
      },
    }),
    true,
  );
  assert.equal(scheduler.getTimeline()[2]?.translated, "相同思考");
  assert.equal(requestCount, 1);
});

test("共享同一 in-flight 的时间线项只占一个请求名额", () => {
  const never = deferred();
  const warnings = [];
  let requestCount = 0;
  const scheduler = new TranslationScheduler({
    onWarning: (kind) => warnings.push(kind),
  });

  for (let index = 0; index < 40; index += 1) {
    assert.equal(
      scheduler.enqueue({
        sourceKey: `message-${index}:block-0`,
        cacheKey: "model:shared-content",
        original: `Same thought ${index}`,
        translate: async () => {
          requestCount += 1;
          return never.promise;
        },
      }),
      true,
    );
  }

  assert.equal(requestCount, 1);
  assert.equal(scheduler.getTimeline().length, 40);
  assert.deepEqual(warnings, []);
  scheduler.reset("test complete");
});

test("思考译文队列最多接收32条且溢出只提醒一次", () => {
  const never = deferred();
  const warnings = [];
  const scheduler = new TranslationScheduler({
    onWarning: (kind) => warnings.push(kind),
  });

  for (let index = 0; index < 32; index += 1) {
    assert.equal(
      scheduler.enqueue({
        sourceKey: `message-${index}:block-0`,
        cacheKey: `model:content-${index}`,
        original: `Thought ${index}`,
        translate: async () => never.promise,
      }),
      true,
    );
  }
  for (let index = 32; index < 34; index += 1) {
    assert.equal(
      scheduler.enqueue({
        sourceKey: `message-${index}:block-0`,
        cacheKey: `model:content-${index}`,
        original: `Thought ${index}`,
        translate: async () => "不应执行",
      }),
      false,
    );
  }

  assert.equal(scheduler.getTimeline().length, 32);
  assert.deepEqual(warnings, ["overflow"]);
  scheduler.reset("test complete");
});

test("会话 LRU 超过容量后淘汰最旧译文", async () => {
  const requested = [];
  const scheduler = new TranslationScheduler({ cacheSize: 2 });

  for (const key of ["a", "b", "c"]) {
    scheduler.enqueue({
      sourceKey: `message-${key}:block-0`,
      cacheKey: `model:${key}`,
      original: `Thought ${key}`,
      translate: async () => {
        requested.push(key);
        return `译文 ${key}`;
      },
    });
    await waitFor(
      () => scheduler.getTimeline().at(-1)?.status === "translated",
      `translation ${key}`,
    );
  }

  scheduler.enqueue({
    sourceKey: "message-a-again:block-0",
    cacheKey: "model:a",
    original: "Thought a again",
    translate: async () => {
      requested.push("a");
      return "译文 a";
    },
  });
  await waitFor(
    () => scheduler.getTimeline().at(-1)?.status === "translated",
    "evicted translation",
  );
  assert.deepEqual(requested, ["a", "b", "c", "a"]);
});

test("外部取消会移除占位但不显示失败警告", async () => {
  const warnings = [];
  const scheduler = new TranslationScheduler({
    onWarning: (kind) => warnings.push(kind),
  });
  scheduler.enqueue({
    sourceKey: "message-1:block-0",
    cacheKey: "model:aborted",
    original: "Cancelled thought",
    translate: async () => {
      throw new DOMException("Cancelled", "AbortError");
    },
  });

  await waitFor(() => scheduler.getTimeline().length === 0, "cancelled entry");
  assert.deepEqual(warnings, []);
});

test("翻译失败会移除占位且每个用户任务只提醒一次", async () => {
  const warnings = [];
  const scheduler = new TranslationScheduler({
    onWarning: (kind) => warnings.push(kind),
  });

  for (let index = 0; index < 2; index += 1) {
    scheduler.enqueue({
      sourceKey: `message-${index}:block-0`,
      cacheKey: `model:failure-${index}`,
      original: `Failure ${index}`,
      translate: async () => {
        throw new Error("HTTP 500");
      },
    });
  }

  await waitFor(() => scheduler.getTimeline().length === 0, "failed entries");
  assert.deepEqual(warnings, ["translation"]);
});

test("思考译文按原始顺序单并发生成", async () => {
  const first = deferred();
  const second = deferred();
  const started = [];
  const scheduler = new TranslationScheduler();

  const firstAccepted = scheduler.enqueue({
    sourceKey: "message-1:block-0",
    cacheKey: "model:first",
    original: "First thought",
    translate: async () => {
      started.push("first");
      return first.promise;
    },
  });
  const secondAccepted = scheduler.enqueue({
    sourceKey: "message-2:block-0",
    cacheKey: "model:second",
    original: "Second thought",
    translate: async () => {
      started.push("second");
      return second.promise;
    },
  });

  assert.equal(firstAccepted, true);
  assert.equal(secondAccepted, true);
  assert.deepEqual(started, ["first"]);
  assert.deepEqual(
    scheduler
      .getTimeline()
      .map(({ original, status }) => ({ original, status })),
    [
      { original: "First thought", status: "pending" },
      { original: "Second thought", status: "pending" },
    ],
  );

  first.resolve("第一条思考");
  await waitFor(() => started.length === 2, "second translation to start");
  assert.deepEqual(started, ["first", "second"]);

  second.resolve("第二条思考");
  await waitFor(
    () =>
      scheduler.getTimeline().every((entry) => entry.status === "translated"),
    "timeline translations",
  );
  assert.deepEqual(
    scheduler.getTimeline().map(({ sourceSequence, translated }) => ({
      sourceSequence,
      translated,
    })),
    [
      { sourceSequence: 1, translated: "第一条思考" },
      { sourceSequence: 2, translated: "第二条思考" },
    ],
  );
});
