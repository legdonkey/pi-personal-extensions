import fs from "node:fs";
import path from "node:path";

export interface TranslatorModelConfig {
  readonly provider: string;
  readonly id: string;
}

export interface ThinkingZhConfig {
  readonly version: 1;
  readonly enabled: boolean;
  readonly translatorModel?: TranslatorModelConfig;
}

export interface LoadedThinkingZhConfig {
  readonly config: ThinkingZhConfig;
  readonly issue?: string;
}

const DISABLED_CONFIG: ThinkingZhConfig = { version: 1, enabled: false };
let saveSequence = 0;

export function getThinkingZhConfigPath(agentDir: string): string {
  return path.join(agentDir, "thinking-zh.json");
}

export async function saveThinkingZhConfig(
  configPath: string,
  config: ThinkingZhConfig,
): Promise<void> {
  const directory = path.dirname(configPath);
  const temporaryPath = `${configPath}.tmp-${process.pid}-${++saveSequence}`;
  await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });

  try {
    await fs.promises.writeFile(
      temporaryPath,
      `${JSON.stringify(config, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    await fs.promises.rename(temporaryPath, configPath);
  } finally {
    await fs.promises.rm(temporaryPath, { force: true });
  }
}

export function loadThinkingZhConfig(
  configPath: string,
): LoadedThinkingZhConfig {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as unknown;
    const config = parseConfig(raw);
    if (!config) {
      return {
        config: DISABLED_CONFIG,
        issue: `配置内容无效：${configPath}`,
      };
    }
    if (config.enabled && !config.translatorModel) {
      return {
        config: { version: 1, enabled: false },
        issue: "尚未配置翻译模型",
      };
    }
    return { config };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {
        config: DISABLED_CONFIG,
        issue: `配置文件不存在：${configPath}`,
      };
    }
    return {
      config: DISABLED_CONFIG,
      issue: `配置文件无效：${configPath}`,
    };
  }
}

function parseConfig(value: unknown): ThinkingZhConfig | undefined {
  if (!isRecord(value) || value.version !== 1 || typeof value.enabled !== "boolean") {
    return undefined;
  }

  const rawModel = value.translatorModel;
  if (rawModel === undefined) {
    return { version: 1, enabled: value.enabled };
  }
  if (
    !isRecord(rawModel) ||
    typeof rawModel.provider !== "string" ||
    rawModel.provider.trim().length === 0 ||
    typeof rawModel.id !== "string" ||
    rawModel.id.trim().length === 0
  ) {
    return undefined;
  }

  return {
    version: 1,
    enabled: value.enabled,
    translatorModel: {
      provider: rawModel.provider.trim(),
      id: rawModel.id.trim(),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
