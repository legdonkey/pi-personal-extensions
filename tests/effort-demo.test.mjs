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

test("讲解页演示仅在服务报错时回退 Jev；结果无效或低置信度不回退且沿用当前强度", () => {
  for (const [model, id] of [
    ["d1-ultra", "liquid/d1-ultra"],
    ["Mammoth 27B", "baseten/mammoth-1"],
    ["Decider v1.2", "perplexity/pplx-decider-v1.2"],
  ]) {
    const success = demo({ model });
    assert.equal(success.form.fallbackOk.disabled, false);
    assert.match(success.outputs.warn.textContent, new RegExp(`openrouter/${id.replace(/\./g, "\\.")}.*HTTP 429：服务限流.*openrouter/typesafe/jev-1\\.14.*已回退`));
    assert.equal(success.outputs.status.textContent, `🧠 low · 基线 medium · Jev（${model} 回退）`);
    assert.match(demo({ model, fallbackOk: false }).outputs.warn.textContent, /Jev 也失败.*沿用 medium/);
    assert.equal(demo({ model, result: "xhigh", probability: 0.8 }).outputs.status.textContent, `🧠 xhigh · 基线 medium · ${model}`);
    const lowConfidence = demo({ model, result: "high", probability: 0.49 });
    assert.equal(lowConfidence.form.fallbackOk.disabled, true);
    assert.equal(lowConfidence.outputs.warn.textContent, "无");
    assert.equal(lowConfidence.outputs.status.textContent, `🧠 medium · ${model}`);
    const invalid = demo({ model, result: "invalid", probability: 0.8 });
    assert.equal(invalid.form.fallbackOk.disabled, true);
    assert.match(invalid.outputs.warn.textContent, new RegExp(`^openrouter/${id.replace(/\./g, "\\.")}：结果无效。思考强度沿用 medium。$`));
    assert.equal(invalid.outputs.status.textContent, `🧠 medium · ${model}`);
  }
  const jev = demo({ model: "Jev" });
  assert.match(jev.outputs.warn.textContent, /openrouter\/typesafe\/jev-1\.14：HTTP 429：服务限流.*沿用 medium/);
  assert.doesNotMatch(jev.outputs.warn.textContent, /切换/);
  assert.equal(jev.form.fallbackOk.disabled, true);
  assert.equal(demo({ model: "Jev", result: "high", probability: 0.49 }).outputs.warn.textContent, "无");
  assert.equal(demo({ model: "Jev", result: "high", probability: 0 }).outputs.warn.textContent, "无");
  assert.match(demo({ model: "Jev", result: "high", probability: -0.1 }).outputs.warn.textContent, /结果无效/);
  assert.match(demo({ model: "Jev", result: "invalid", probability: 0.1 }).outputs.warn.textContent, /结果无效/);
  assert.equal(demo({ model: "Jev", result: "high", probability: 0.5 }).outputs.status.textContent, "🧠 high · 基线 medium · Jev");
  assert.equal(demo({ result: "empty" }).outputs.status.textContent, "🧠 medium · 未分类");
  assert.equal(demo({ misaligned: true }).outputs.status.textContent, "🧠 medium · 未调整 · Jev（d1-ultra 回退）");
  const timeout = demo({ result: "timeout" });
  assert.equal(timeout.form.fallbackOk.disabled, true);
  assert.equal(timeout.outputs.update.textContent, "不插入");
  assert.equal(timeout.outputs.status.textContent, "🧠 medium · 未分类");
  assert.match(timeout.outputs.warn.textContent, /^分类等待超过 5 秒，本次沿用 medium；分类已中止，迟到结果不再采用。/);
});
