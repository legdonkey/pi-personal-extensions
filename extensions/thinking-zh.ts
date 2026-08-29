import {
  getAgentDir,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { registerThinkingZhCommand } from "./thinking-zh/commands.ts";
import { getThinkingZhConfigPath } from "./thinking-zh/config.ts";
import { ThinkingZhRuntime } from "./thinking-zh/runtime.ts";

export interface ThinkingZhRegistrationOptions {
  readonly agentDir?: string;
}

export function registerThinkingZh(
  pi: ExtensionAPI,
  options: ThinkingZhRegistrationOptions = {},
): void {
  const configPath = getThinkingZhConfigPath(options.agentDir ?? getAgentDir());
  const runtime = new ThinkingZhRuntime(configPath);

  pi.on("session_start", (_event, ctx) => runtime.sessionStart(ctx));
  pi.on("message_start", (event, ctx) => runtime.messageStart(event, ctx));
  pi.on("message_update", (event, ctx) => {
    const update = event.assistantMessageEvent;
    if (update.type === "thinking_end") {
      runtime.thinkingEnd(update.content, update.contentIndex, ctx);
    }
  });
  pi.on("message_end", (event, ctx) => runtime.messageEnd(event, ctx));
  pi.on("session_shutdown", (_event, ctx) => runtime.sessionShutdown(ctx));
  registerThinkingZhCommand(pi, runtime);
}

export default function thinkingZh(pi: ExtensionAPI): void {
  registerThinkingZh(pi);
}
