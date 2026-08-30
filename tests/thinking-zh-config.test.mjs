import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  getThinkingZhConfigPath,
  loadThinkingZhConfig,
  saveThinkingZhConfig,
} from "../extensions/thinking-zh/config.ts";

test("新配置缺失时安全关闭且不读取旧配置", () => {
  const agentDir = mkdtempSync(path.join(tmpdir(), "thinking-zh-config-"));
  try {
    writeFileSync(
      path.join(agentDir, "thinking-translator.json"),
      JSON.stringify({
        enabled: true,
        translatorModel: { provider: "legacy", id: "legacy" },
      }),
    );
    const configPath = getThinkingZhConfigPath(agentDir);
    const loaded = loadThinkingZhConfig(configPath);

    assert.equal(configPath, path.join(agentDir, "thinking-zh.json"));
    assert.deepEqual(loaded.config, { version: 1, enabled: false });
    assert.match(loaded.issue ?? "", /不存在/);
  } finally {
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("配置通过安全写入后可以完整读回", async () => {
  const agentDir = mkdtempSync(path.join(tmpdir(), "thinking-zh-config-"));
  const configPath = getThinkingZhConfigPath(agentDir);
  try {
    await saveThinkingZhConfig(configPath, {
      version: 1,
      enabled: false,
      translatorModel: { provider: "openai-codex", id: "gpt-5.6-luna" },
    });

    assert.deepEqual(loadThinkingZhConfig(configPath), {
      config: {
        version: 1,
        enabled: false,
        translatorModel: { provider: "openai-codex", id: "gpt-5.6-luna" },
      },
    });
    assert.deepEqual(readdirSync(agentDir), ["thinking-zh.json"]);
  } finally {
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("只有通过运行时校验的 v1 配置才会启用", () => {
  const agentDir = mkdtempSync(path.join(tmpdir(), "thinking-zh-config-"));
  const configPath = getThinkingZhConfigPath(agentDir);
  try {
    writeFileSync(
      configPath,
      JSON.stringify({
        version: 1,
        enabled: true,
        translatorModel: { provider: "openai-codex", id: "gpt-5.6-luna" },
      }),
    );
    assert.deepEqual(loadThinkingZhConfig(configPath), {
      config: {
        version: 1,
        enabled: true,
        translatorModel: { provider: "openai-codex", id: "gpt-5.6-luna" },
      },
    });

    writeFileSync(configPath, "{broken");
    const malformed = loadThinkingZhConfig(configPath);
    assert.equal(malformed.config.enabled, false);
    assert.match(malformed.issue ?? "", /无效/);

    writeFileSync(configPath, JSON.stringify({ version: 1, enabled: true }));
    const missingModel = loadThinkingZhConfig(configPath);
    assert.equal(missingModel.config.enabled, false);
    assert.match(missingModel.issue ?? "", /模型/);

    writeFileSync(configPath, JSON.stringify({ version: 1, enabled: "yes" }));
    const wrongSchema = loadThinkingZhConfig(configPath);
    assert.equal(wrongSchema.config.enabled, false);
    assert.match(wrongSchema.issue ?? "", /无效/);
  } finally {
    rmSync(agentDir, { recursive: true, force: true });
  }
});
