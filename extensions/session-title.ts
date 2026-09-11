import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { stripVTControlCharacters } from "node:util";

const WIDGET_KEY = "personal-session-title";

export default function sessionTitle(pi: ExtensionAPI) {
  const update = (ctx: ExtensionContext) => {
    if (ctx.mode !== "tui") return;
    const name =
      stripVTControlCharacters(ctx.sessionManager.getSessionName() ?? "")
        .replace(/[\x00-\x1f\x7f-\x9f\u2028\u2029]/g, " ")
        .trim() || "未命名会话";
    ctx.ui.setWidget(
      WIDGET_KEY,
      (_tui, theme) => ({
        render(width) {
          const title = truncateToWidth(name, Math.max(0, width), "…");
          return [
            " ".repeat(Math.max(0, width - visibleWidth(title))) +
              theme.fg("dim", title),
          ];
        },
        invalidate() {},
      }),
      { placement: "belowEditor" },
    );
  };

  pi.on("session_start", (_event, ctx) => update(ctx));
  pi.on("session_info_changed", (_event, ctx) => update(ctx));
  pi.on("session_shutdown", (_event, ctx) => {
    if (ctx.mode === "tui") ctx.ui.setWidget(WIDGET_KEY, undefined);
  });
}
