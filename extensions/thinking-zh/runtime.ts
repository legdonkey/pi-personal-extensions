import { createHash } from "node:crypto";
import type {
  ExtensionContext,
  MessageEndEvent,
  MessageStartEvent,
} from "@earendil-works/pi-coding-agent";
import {
  loadThinkingZhConfig,
  saveThinkingZhConfig,
  type ThinkingZhConfig,
  type TranslatorModelConfig,
} from "./config.ts";
import {
  type ProtectedSource,
  protectSource,
  shouldTranslateSource,
} from "./protect.ts";
import {
  type SchedulerWarning,
  TranslationScheduler,
} from "./scheduler.ts";
import { translateThinking } from "./translator.ts";
import { ThinkingZhUi } from "./ui.ts";

type TranslationModel = NonNullable<
  ReturnType<ExtensionContext["modelRegistry"]["find"]>
>;
type ModelResolution =
  | { readonly model: TranslationModel; readonly issue?: never }
  | { readonly model?: never; readonly issue: string };

export class ThinkingZhRuntime {
  private readonly configPath: string;
  private readonly view = new ThinkingZhUi();
  private readonly scheduler: TranslationScheduler;
  private config: ThinkingZhConfig = { version: 1, enabled: false };
  private configIssue: string | undefined;
  private translationModel: TranslationModel | undefined;
  private activeContext: ExtensionContext | undefined;
  private activeSession: ExtensionContext["sessionManager"] | undefined;
  private assistantSerial = 0;
  private activeAssistantSerial = 0;
  private readonly observedThinkingKeys = new Set<string>();

  constructor(configPath: string) {
    this.configPath = configPath;
    this.scheduler = new TranslationScheduler({
      onChange: (timeline) => {
        if (this.activeContext?.mode === "tui") {
          this.view.update(timeline, this.activeContext);
        }
      },
      onWarning: (kind, error) => {
        if (this.activeContext?.mode !== "tui") return;
        this.activeContext.ui.notify(warningMessage(kind, error), "warning");
      },
    });
  }

  sessionStart(ctx: ExtensionContext): void {
    this.activate(ctx);
    this.activeSession = ctx.sessionManager;
    this.scheduler.reset("Session started", { clearCache: true });
    this.resetAssistantSequence();
    const loaded = loadThinkingZhConfig(this.configPath);
    this.config = loaded.config;
    this.configIssue = loaded.issue;
    this.resolveConfiguredModel(ctx);
  }

  messageStart(event: MessageStartEvent, ctx: ExtensionContext): void {
    this.activate(ctx);
    if (event.message.role === "user") {
      this.scheduler.reset("New user task");
      this.resetAssistantSequence();
      return;
    }
    if (event.message.role === "assistant") {
      this.activeAssistantSerial = ++this.assistantSerial;
    }
  }

  thinkingEnd(
    original: string,
    contentIndex: number,
    ctx: ExtensionContext,
  ): void {
    const sourceKey = this.thinkingSourceKey(contentIndex);
    if (this.observedThinkingKeys.has(sourceKey)) return;
    this.observedThinkingKeys.add(sourceKey);
    this.enqueueThinking(original, sourceKey, ctx);
  }

  messageEnd(event: MessageEndEvent, ctx: ExtensionContext): void {
    if (event.message.role !== "assistant") return;
    event.message.content.forEach((block, contentIndex) => {
      if (block.type !== "thinking" || block.redacted) return;
      const sourceKey = this.thinkingSourceKey(contentIndex);
      if (this.observedThinkingKeys.has(sourceKey)) return;
      this.observedThinkingKeys.add(sourceKey);
      this.enqueueThinking(block.thinking, sourceKey, ctx);
    });
    this.activeAssistantSerial = 0;
  }

  sessionShutdown(ctx: ExtensionContext): void {
    if (this.activeSession && ctx.sessionManager !== this.activeSession) return;
    this.scheduler.reset("Session shut down", { clearCache: true });
    this.view.clear(ctx);
    this.translationModel = undefined;
    this.activeContext = undefined;
    this.activeSession = undefined;
  }

  showStatus(ctx: ExtensionContext): void {
    this.activate(ctx);
    ctx.ui.notify(
      [
        `状态：${this.config.enabled && this.translationModel ? "开启" : "关闭"}`,
        `翻译模型：${this.modelLabel()}`,
        `配置：${this.configPath}`,
        ...(this.configIssue ? [`问题：${this.configIssue}`] : []),
      ].join("\n"),
      "info",
    );
  }

  async setModel(modelSpec: string, ctx: ExtensionContext): Promise<void> {
    this.activate(ctx);
    const requested = parseModelSpec(modelSpec);
    if (!requested) {
      ctx.ui.notify("用法：/thinking-zh model <provider/id>", "warning");
      return;
    }
    const resolved = this.findUsableModel(requested, ctx);
    if (!resolved.model) {
      ctx.ui.notify(resolved.issue, "warning");
      return;
    }
    const nextConfig: ThinkingZhConfig = {
      version: 1,
      enabled: this.config.enabled,
      translatorModel: requested,
    };
    if (!(await this.persistConfig(nextConfig, ctx))) return;

    this.scheduler.reset("Translation model changed", { clearCache: true });
    this.resolveConfiguredModel(ctx);
    const enableHint = this.config.enabled
      ? ""
      : "；仍需执行 /thinking-zh on";
    ctx.ui.notify(
      `翻译模型已设为 ${requested.provider}/${requested.id}${enableHint}`,
      "info",
    );
  }

  async enable(ctx: ExtensionContext): Promise<void> {
    this.activate(ctx);
    if (!this.config.translatorModel) {
      ctx.ui.notify("请先执行 /thinking-zh model <provider/id>", "warning");
      return;
    }
    const resolved = this.findUsableModel(this.config.translatorModel, ctx);
    if (!resolved.model) {
      ctx.ui.notify(resolved.issue, "warning");
      return;
    }
    const nextConfig: ThinkingZhConfig = {
      ...this.config,
      enabled: true,
    };
    if (!(await this.persistConfig(nextConfig, ctx))) return;
    this.translationModel = resolved.model;
    ctx.ui.notify("思考译文已开启", "info");
  }

  async disable(ctx: ExtensionContext): Promise<void> {
    this.activate(ctx);
    const nextConfig: ThinkingZhConfig = {
      ...this.config,
      enabled: false,
    };
    if (!(await this.persistConfig(nextConfig, ctx))) return;
    this.translationModel = undefined;
    this.scheduler.reset("Thinking translation disabled", { clearCache: true });
    this.view.clear(ctx);
    ctx.ui.notify("思考译文已关闭", "info");
  }

  clear(ctx: ExtensionContext): void {
    this.activate(ctx);
    this.scheduler.reset("Thinking translations cleared", { clearCache: true });
    this.view.clear(ctx);
    ctx.ui.notify("当前思考译文时间线已清空", "info");
  }

  async show(ctx: ExtensionContext): Promise<void> {
    this.activate(ctx);
    await this.view.show(ctx);
  }

  private enqueueThinking(
    original: string,
    sourceKey: string,
    ctx: ExtensionContext,
  ): void {
    this.activate(ctx);
    if (ctx.mode !== "tui" || !this.config.enabled || !this.translationModel) {
      return;
    }

    const normalizedOriginal = original.trim();
    if (!normalizedOriginal) return;
    const protectedSource = protectSource(normalizedOriginal);
    if (!shouldTranslateSource(protectedSource)) return;

    const requestSignal = ctx.signal;
    const model = this.translationModel;
    this.scheduler.enqueue({
      sourceKey,
      cacheKey: createCacheKey(model, protectedSource),
      original: normalizedOriginal,
      translate: (taskSignal) =>
        translateThinking({
          modelRegistry: ctx.modelRegistry,
          model,
          source: protectedSource,
          signal: requestSignal
            ? AbortSignal.any([taskSignal, requestSignal])
            : taskSignal,
        }),
    });
  }

  private resolveConfiguredModel(ctx: ExtensionContext): void {
    this.translationModel = undefined;
    if (!this.config.enabled || !this.config.translatorModel) return;

    const resolved = this.findUsableModel(this.config.translatorModel, ctx);
    if (!resolved.model) {
      this.configIssue = resolved.issue;
      return;
    }
    this.configIssue = undefined;
    this.translationModel = resolved.model;
  }

  private findUsableModel(
    requested: TranslatorModelConfig,
    ctx: ExtensionContext,
  ): ModelResolution {
    const model = ctx.modelRegistry.find(requested.provider, requested.id);
    if (!model) {
      return {
        issue: `找不到翻译模型 ${requested.provider}/${requested.id}`,
      };
    }
    if (!ctx.modelRegistry.hasConfiguredAuth(model)) {
      return {
        issue: `翻译模型 ${model.provider}/${model.id} 尚未配置认证`,
      };
    }
    return { model };
  }

  private async persistConfig(
    nextConfig: ThinkingZhConfig,
    ctx: ExtensionContext,
  ): Promise<boolean> {
    try {
      await saveThinkingZhConfig(this.configPath, nextConfig);
      this.config = nextConfig;
      this.configIssue = undefined;
      return true;
    } catch (cause) {
      const error = cause instanceof Error ? cause : undefined;
      const detail = error ? `：${error.message}` : "";
      ctx.ui.notify(`无法保存思考翻译配置${detail}`, "error");
      return false;
    }
  }

  private activate(ctx: ExtensionContext): void {
    this.activeContext = ctx;
  }

  private resetAssistantSequence(): void {
    this.assistantSerial = 0;
    this.activeAssistantSerial = 0;
    this.observedThinkingKeys.clear();
  }

  private thinkingSourceKey(contentIndex: number): string {
    if (this.activeAssistantSerial === 0) {
      this.activeAssistantSerial = ++this.assistantSerial;
    }
    return `${this.activeAssistantSerial}:${contentIndex}`;
  }

  private modelLabel(): string {
    const model = this.config.translatorModel;
    return model ? `${model.provider}/${model.id}` : "未配置";
  }
}

function parseModelSpec(modelSpec: string): TranslatorModelConfig | undefined {
  const separator = modelSpec.indexOf("/");
  if (separator <= 0 || separator === modelSpec.length - 1) return undefined;
  return {
    provider: modelSpec.slice(0, separator),
    id: modelSpec.slice(separator + 1),
  };
}

function createCacheKey(
  model: { provider: string; id: string },
  source: ProtectedSource,
): string {
  return createHash("sha256")
    .update(
      [
        "thinking-zh-policy-v1",
        model.provider,
        model.id,
        JSON.stringify({
          text: source.text.replace(/\r\n?/g, "\n"),
          values: source.values,
        }),
      ].join("\0"),
    )
    .digest("hex");
}

function warningMessage(kind: SchedulerWarning, error?: Error): string {
  if (kind === "overflow") return "思考译文队列已满，已跳过新的思考块";
  const detail = error ? `：${error.message}` : "";
  return `思考翻译失败${detail}`;
}
