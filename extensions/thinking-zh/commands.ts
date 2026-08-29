import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ThinkingZhRuntime } from "./runtime.ts";

const USAGE =
  "用法：/thinking-zh [on|off|status|show|clear|model <provider/id>]";

export function registerThinkingZhCommand(
  pi: ExtensionAPI,
  runtime: ThinkingZhRuntime,
): void {
  pi.registerCommand("thinking-zh", {
    description: "控制可见思考块的简体中文译文",
    handler: async (args, ctx) => {
      const [action = "status", ...rest] = args.trim().split(/\s+/);
      switch (action) {
        case "":
        case "status":
          runtime.showStatus(ctx);
          return;
        case "model":
          await runtime.setModel(rest.join(" "), ctx);
          return;
        case "on":
          await runtime.enable(ctx);
          return;
        case "off":
          await runtime.disable(ctx);
          return;
        case "clear":
          runtime.clear(ctx);
          return;
        case "show":
          await runtime.show(ctx);
          return;
        default:
          ctx.ui.notify(USAGE, "warning");
      }
    },
  });
}
