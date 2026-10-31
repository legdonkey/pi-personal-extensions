import assert from "node:assert/strict";
import { test } from "node:test";
import { shortSessionId } from "../extensions/substatusline.ts";

test("会话 ID 取末尾 8 位，短 ID 原样显示", () => {
  // 同一时间段内新建的两个 UUIDv7 会话，前 7 位相同，末 8 位不同。
  assert.equal(shortSessionId("019a3f2c-7b1e-7c4d-9a2b-3c4d5e6f7a8b"), "5e6f7a8b");
  assert.equal(shortSessionId("019a3f2c-8e0f-7123-b456-0123456789ab"), "456789ab");
  assert.equal(shortSessionId("abc"), "abc");
  assert.equal(shortSessionId(""), "");
});
