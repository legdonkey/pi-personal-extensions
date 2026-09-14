import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  clampThinkingLevel,
  getSupportedThinkingLevels,
  type ModelThinkingLevel,
} from "@earendil-works/pi-ai";
import {
  getAgentDir,
  SettingsManager,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const LEVELS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;
export type NamingSettings = {
  model: string;
  thinking: "inherit" | ModelThinkingLevel;
};
type NamingModel = ExtensionContext["scopedModels"][number]["model"];

export function readNamingSettings(): NamingSettings {
  let raw: unknown;
  try {
    raw = JSON.parse(
      readFileSync(join(getAgentDir(), "auto-session-name.json"), "utf8"),
    );
  } catch (cause) {
    if (cause instanceof Error && "code" in cause && cause.code === "ENOENT")
      return { model: "gpt-5.6-luna", thinking: "inherit" };
    throw new Error("无法读取 auto-session-name.json，请检查文件格式和权限。", {
      cause,
    });
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("auto-session-name.json 必须是 JSON 对象。");
  const { model = "gpt-5.6-luna", thinking = "inherit" } =
    raw as Partial<NamingSettings>;
  if (
    typeof model !== "string" ||
    !model.trim() ||
    /[\s\p{C}]/u.test(model) ||
    (thinking !== "inherit" && !LEVELS.includes(thinking))
  )
    throw new Error("自动命名配置中的 model 或 thinking 无效。");
  return { model, thinking };
}

export function saveNamingSettings(settings: NamingSettings): void {
  const dir = getAgentDir();
  const path = join(dir, "auto-session-name.json");
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    renameSync(temporaryPath, path);
  } catch (cause) {
    throw new Error("保存自动命名配置失败，原配置保持不变。", { cause });
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

export const namingModelKey = (model: NamingModel) =>
  `${model.provider}/${model.id}`;

export function namingModels(ctx: ExtensionContext): NamingModel[] {
  // 严格遵循用户限定的 scoped 列表；空列表也不扩展到整个模型目录。
  return ctx.scopedModels
    .map(({ model }) => model)
    .filter((model) => ctx.modelRegistry.hasConfiguredAuth(model));
}

export function resolveNamingModel(
  ctx: ExtensionContext,
  settings: NamingSettings,
): NamingModel {
  const model = namingModels(ctx).find(
    (model) =>
      namingModelKey(model) === settings.model || model.id === settings.model,
  );
  if (!model)
    throw new Error(
      `命名模型 ${settings.model} 不在已认证的 scoped-models 中，请用 /scoped-models 加入或 /auto-name model 重新选择。`,
    );
  return model;
}

export function namingThinkingLevel(
  ctx: ExtensionContext,
  model: NamingModel,
  thinking: NamingSettings["thinking"],
): ModelThinkingLevel {
  if (thinking !== "inherit") {
    if (!getSupportedThinkingLevels(model).includes(thinking))
      throw new Error(
        "命名模型不支持已配置的思考强度，请用 /auto-name thinking 重新选择。",
      );
    return thinking;
  }
  const settings = SettingsManager.create(ctx.cwd, getAgentDir(), {
    projectTrusted: ctx.isProjectTrusted(),
  });
  if (settings.drainErrors().length)
    throw new Error("无法读取 Pi 的逐模型思考配置，请检查 settings.json。");
  const level =
    settings.getModelThinkingLevel(model.provider, model.id) ?? "low";
  if (!LEVELS.includes(level))
    throw new Error("Pi 的逐模型思考配置无效，请在 /settings 中重新设置。");
  return clampThinkingLevel(model, level);
}
