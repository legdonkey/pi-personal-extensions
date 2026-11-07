import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../docs/extensions-guide/src/06-effort.html", import.meta.url), "utf8");
const script = source.match(/<script type="module">([\s\S]*?)<\/script>/)[1];

function demo({ model = "d1-ultra", result = "error", probability = 0.8, fallbackOk = true, misaligned = false } = {}) {
  const outputs = Object.fromEntries(["level", "update", "status", "warn"].map((name) => [name, {}]));
  const form = {
    base: { value: "medium" }, model: { value: model }, result: { value: result },
    p: { value: probability }, pOut: {}, fallbackOk: { checked: fallbackOk }, misaligned: { checked: misaligned },
    querySelector: (selector) => outputs[selector.match(/data-out="(\w+)"/)[1]],
    addEventListener() {},
  };
  const root = { querySelector: (selector) => selector === ".effort-demo-form" ? form : {} };
  runInNewContext(script, { document: { querySelector: () => root } });
  return { outputs, form };
}

test("讲解页演示区分回退成功、全部失败、直接 Jev、空输入及请求对齐失败", () => {
  const success = demo();
  assert.match(success.outputs.warn.textContent, /HTTP 429：服务限流.*正在切换.*已回退/);
  assert.equal(success.outputs.status.textContent, "🧠 low · 基线 medium · Jev（d1-ultra 回退）");
  assert.match(demo({ fallbackOk: false }).outputs.warn.textContent, /Jev 也失败.*沿用 medium/);
  const jev = demo({ model: "Jev" });
  assert.match(jev.outputs.warn.textContent, /HTTP 429：服务限流.*沿用 medium/);
  assert.doesNotMatch(jev.outputs.warn.textContent, /切换/);
  assert.equal(jev.form.fallbackOk.disabled, true);
  const lowConfidence = demo({ result: "high", probability: 0.49 });
  assert.match(lowConfidence.outputs.warn.textContent, /已回退.*普通提示/);
  assert.doesNotMatch(lowConfidence.outputs.warn.textContent, /分类失败|结果无效|正在切换/);
  assert.equal(demo({ model: "Jev", result: "high", probability: 0.49 }).outputs.warn.textContent, "无");
  assert.equal(demo({ model: "Jev", result: "high", probability: 0 }).outputs.warn.textContent, "无");
  assert.match(demo({ model: "Jev", result: "high", probability: -0.1 }).outputs.warn.textContent, /结果无效/);
  assert.match(demo({ model: "Jev", result: "invalid", probability: 0.1 }).outputs.warn.textContent, /结果无效/);
  assert.equal(demo({ model: "Jev", result: "high", probability: 0.5 }).outputs.status.textContent, "🧠 high · 基线 medium · Jev");
  const mixed = demo({ result: "high", probability: 0.49, fallbackOk: false }).outputs.warn.textContent;
  assert.match(mixed, /HTTP 503/);
  assert.doesNotMatch(mixed, /结果无效|正在切换/);
  assert.equal(demo({ result: "empty" }).outputs.status.textContent, "🧠 medium · 未分类");
  assert.equal(demo({ misaligned: true }).outputs.status.textContent, "🧠 medium · 未调整 · Jev（d1-ultra 回退）");
});
