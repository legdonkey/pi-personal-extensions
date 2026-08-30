import assert from "node:assert/strict";
import test from "node:test";

import {
  protectSource,
  restoreProtectedSource,
  shouldTranslateSource,
} from "../extensions/thinking-zh/protect.ts";

test("忠实中文化会隐藏并无损恢复行内代码", () => {
  const protectedSource = protectSource("Checking `npm run check` now");

  assert.equal(protectedSource.text, "Checking __PI_THINKING_ZH_0000__ now");
  assert.equal(
    restoreProtectedSource(protectedSource, "正在检查 __PI_THINKING_ZH_0000__"),
    "正在检查 `npm run check`",
  );
});

test("忠实中文化不会把代码、路径和 URL 发给翻译模型", () => {
  const source = [
    "Review these references:",
    "```ts",
    'const token = "secret";',
    "```",
    "[documentation](https://example.com/private?q=1)",
    "https://api.example.com/v1/items",
    "/Users/me/project/src/index.ts:12:4",
    "~/notes/todo.md",
    String.raw`C:\Users\me\project\index.ts`,
    "@src/config.ts",
    "@README.md",
  ].join("\n");

  const protectedSource = protectSource(source);

  for (const sensitive of [
    'const token = "secret";',
    "https://example.com/private?q=1",
    "https://api.example.com/v1/items",
    "/Users/me/project/src/index.ts:12:4",
    "~/notes/todo.md",
    String.raw`C:\Users\me\project\index.ts`,
    "@src/config.ts",
    "@README.md",
  ]) {
    assert.equal(protectedSource.text.includes(sensitive), false, sensitive);
  }

  assert.equal(
    restoreProtectedSource(
      protectedSource,
      protectedSource.text.replace("Review", "正在检查"),
    ),
    source.replace("Review", "正在检查"),
  );
});

test("Markdown 链接中带括号的 URL 会完整保护", () => {
  const source = "[documentation](https://example.com/a_(secret)?q=(value))";
  const protectedSource = protectSource(source);

  assert.deepEqual(protectedSource.values, [
    "https://example.com/a_(secret)?q=(value)",
  ]);
  assert.equal(protectedSource.text.includes("secret"), false);
  assert.equal(
    restoreProtectedSource(protectedSource, protectedSource.text),
    source,
  );
});

test("带括号的 URL 会作为完整值保护", () => {
  const source = "Open https://example.com/a_(secret)?q=(value)";
  const protectedSource = protectSource(source);

  assert.equal(protectedSource.text.includes("secret"), false);
  assert.deepEqual(protectedSource.values, [
    "https://example.com/a_(secret)?q=(value)",
  ]);
  assert.equal(
    restoreProtectedSource(protectedSource, protectedSource.text),
    source,
  );
});

test("相对路径、文件位置和裸文件名会作为完整值保护", () => {
  const source = "Review extensions/thinking-zh.ts:12:4 and README.md";
  const protectedSource = protectSource(source);

  assert.deepEqual(protectedSource.values, [
    "extensions/thinking-zh.ts:12:4",
    "README.md",
  ]);
  assert.equal(
    restoreProtectedSource(protectedSource, protectedSource.text),
    source,
  );
});

test("更长的 Markdown 结束围栏仍会保护整段代码", () => {
  const source = [
    "Inspect this code:",
    "~~~ts",
    'const credential = "secret";',
    "~~~~",
  ].join("\n");
  const protectedSource = protectSource(source);

  assert.equal(protectedSource.text.includes("secret"), false);
  assert.equal(
    restoreProtectedSource(protectedSource, protectedSource.text),
    source,
  );
});

test("本地检测只提交仍需中文化的可见思考块", () => {
  const shortEnglish = protectSource(
    [
      "Summarizing three Pi extension capabilities",
      "Detailing clickable-paths and packaging features",
    ].join("\n"),
  );
  const chinese = protectSource("正在归纳 Pi 的三项扩展能力");
  const chineseDominant = protectSource("正在检查 API 和 cache 的当前状态");
  const codeOnly = protectSource("`npm run check`\n/Users/me/project");

  assert.equal(shouldTranslateSource(shortEnglish), true);
  assert.equal(shouldTranslateSource(chinese), false);
  assert.equal(shouldTranslateSource(chineseDominant), false);
  assert.equal(shouldTranslateSource(codeOnly), false);
});

test("占位符不完整时拒绝恢复译文", () => {
  const protectedSource = protectSource("Checking `npm run check`");
  const placeholder = "__PI_THINKING_ZH_0000__";

  assert.throws(
    () => restoreProtectedSource(protectedSource, "正在检查"),
    /占位符/,
  );
  assert.throws(
    () =>
      restoreProtectedSource(
        protectedSource,
        `正在检查 ${placeholder} ${placeholder}`,
      ),
    /占位符/,
  );
  assert.throws(
    () =>
      restoreProtectedSource(
        protectedSource,
        `正在检查 ${placeholder} __PI_THINKING_ZH_9999__`,
      ),
    /占位符/,
  );
});
