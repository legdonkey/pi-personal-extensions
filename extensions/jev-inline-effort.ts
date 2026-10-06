import type { Message, Model, ModelThinkingLevel } from "@earendil-works/pi-ai";
import type {
  ContextWithSystemEvent,
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { classifyTask } from "./jev-router.ts";

type AgentMessage = ContextWithSystemEvent["messages"][number];
type Anchor = { role: string; timestamp: number };
type Decision = { timestamp: number; thinkingLevel: ModelThinkingLevel };
type InputItem = { type?: string; role?: string };
type Payload = { model?: unknown; input?: InputItem[]; reasoning?: { effort?: unknown } };

const EFFORT_ENTRY = "jev-inline-effort";
const STATUS_KEY = "jev-inline-effort";
const CODEX_API = "openai-codex-responses";
const THINKING_LEVELS = new Set<unknown>(["minimal", "low", "medium", "high", "xhigh", "max"]);

function isGpt6(id: unknown) {
  return typeof id === "string" && id.startsWith("gpt-6");
}

/** 与 convertToLlm 和 Responses 消息转换一致：这些消息各自成为一个 role:"user" 输入项。 */
function producesUserItem(message: AgentMessage) {
  const { role, content, excludeFromContext } = message as {
    role: string; content?: unknown; excludeFromContext?: boolean;
  };
  if (role === "bashExecution") return !excludeFromContext;
  if (role === "branchSummary" || role === "compactionSummary") return true;
  if (role !== "user" && role !== "custom") return false;
  return !Array.isArray(content) || content.length > 0;
}

function decisions(ctx: ExtensionContext): Decision[] {
  return ctx.sessionManager.getBranch().flatMap((entry) => {
    if (entry.type !== "custom" || entry.customType !== EFFORT_ENTRY) return [];
    const data = entry.data as Partial<Decision> | undefined;
    return typeof data?.timestamp === "number" && THINKING_LEVELS.has(data.thinkingLevel)
      ? [data as Decision] : [];
  });
}

function apiEffort(model: Model<any>, level: ModelThinkingLevel) {
  const mapped = model.thinkingLevelMap?.[level];
  return mapped === null ? undefined : mapped ?? level;
}

export default function (pi: ExtensionAPI) {
  // 同一会话的请求严格串行：context_with_system 之后紧跟同一次调用的 before_provider_request。
  let anchors: Anchor[] | undefined;

  const active = (ctx: ExtensionContext) =>
    ctx.model?.api === CODEX_API && isGpt6(ctx.model.id) && pi.getThinkingLevel() !== "off";
  const clearStatus = (_event: unknown, ctx: ExtensionContext) => {
    anchors = undefined;
    ctx.ui.setStatus(STATUS_KEY, undefined);
  };
  pi.on("session_start", clearStatus);
  pi.on("session_shutdown", clearStatus);
  pi.on("model_select", clearStatus);

  pi.on("context_with_system", async (event, ctx) => {
    anchors = undefined;
    if (!active(ctx)) return;
    const messages = event.messages;
    anchors = messages.filter(producesUserItem).map(({ role, timestamp }) => ({ role, timestamp }));

    const recorded = decisions(ctx);
    const classified = new Set(recorded.map(({ timestamp }) => timestamp));
    const pending = messages.slice(messages.findLastIndex(({ role }) => role === "assistant") + 1)
      .filter((message) => message.role === "user" && producesUserItem(message)
        && !classified.has(message.timestamp));
    if (pending.length === 0) return;

    const current = recorded.at(-1)?.thinkingLevel ?? pi.getThinkingLevel();
    try {
      const { thinkingLevel } = await classifyTask({
        messages: messages.filter(({ role }) => role === "user" || role === "assistant") as Message[],
        signal: ctx.signal,
      }, ctx, current);
      for (const { timestamp } of pending) pi.appendEntry(EFFORT_ENTRY, { timestamp, thinkingLevel });
    } catch (error) {
      anchors = undefined;
      if (error instanceof Error && error.name === "AbortError") return;
      throw error;
    }
  });

  pi.on("before_provider_request", (event, ctx) => {
    const snapshot = anchors;
    anchors = undefined;
    if (!snapshot || !active(ctx)) return undefined;
    const body = event.payload as Payload;
    const base = body.reasoning?.effort;
    if (!Array.isArray(body.input) || typeof base !== "string" || !isGpt6(body.model)) return undefined;
    if (body.input.filter(({ role }) => role === "user").length !== snapshot.length) {
      ctx.ui.setStatus(STATUS_KEY, `🧠 ${base} · 未调整`);
      return undefined;
    }

    const recorded = decisions(ctx);
    const present = new Set(snapshot.map(({ timestamp }) => timestamp));
    const desired = new Map(recorded.map(({ timestamp, thinkingLevel }) => [timestamp, thinkingLevel]));
    // 压缩摘要承接被压缩掉的最后一次决策，避免本轮中途压缩后强度回落到基线。
    const carried = recorded.findLast(({ timestamp }) => !present.has(timestamp))?.thinkingLevel;

    let running = base;
    let userIndex = 0;
    const input: InputItem[] = [];
    for (const item of body.input) {
      if (item.role === "user") {
        const anchor = snapshot[userIndex++];
        const level = anchor.role === "compactionSummary" ? carried
          : anchor.role === "user" ? desired.get(anchor.timestamp) : undefined;
        const effort = level && apiEffort(ctx.model!, level);
        // 每条 update 后紧跟一个 user 项，因此不会出现相邻的 update。
        if (effort && effort !== running) {
          input.push({ type: "configuration_update", reasoning: { effort } } as InputItem);
          running = effort;
        }
      }
      input.push(item);
    }
    ctx.ui.setStatus(STATUS_KEY, running === base ? `🧠 ${base}` : `🧠 ${running} · 基线 ${base}`);
    return input.length === body.input.length ? undefined : { ...body, input };
  });
}
