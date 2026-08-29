import {
  getMarkdownTheme,
  type ExtensionContext,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import {
  Markdown,
  matchesKey,
  truncateToWidth,
  type Component,
  type TUI,
} from "@earendil-works/pi-tui";
import type { TimelineEntry } from "./scheduler.ts";

const WIDGET_KEY = "thinking-zh.timeline";
const MAX_WIDGET_LINES = 20;

export class ThinkingZhUi {
  private timeline: readonly TimelineEntry[] = [];
  private tui: { requestRender(force?: boolean): void } | undefined;
  private theme: ExtensionContext["ui"]["theme"] | undefined;
  private registered = false;

  update(timeline: readonly TimelineEntry[], ctx: ExtensionContext): void {
    this.timeline = timeline;
    if (timeline.length === 0) {
      this.clear(ctx);
      return;
    }

    if (!this.registered) {
      ctx.ui.setWidget(
        WIDGET_KEY,
        (tui, theme) => {
          this.tui = tui;
          this.theme = theme;
          return {
            render: (width: number) => this.renderWidget(width),
            invalidate: () => undefined,
            dispose: () => {
              this.tui = undefined;
              this.theme = undefined;
            },
          };
        },
        { placement: "aboveEditor" },
      );
      this.registered = true;
    }
    this.tui?.requestRender();
  }

  clear(ctx: ExtensionContext): void {
    this.timeline = [];
    if (this.registered) ctx.ui.setWidget(WIDGET_KEY, undefined);
    this.registered = false;
    this.tui = undefined;
    this.theme = undefined;
  }

  async show(ctx: ExtensionContext): Promise<void> {
    if (ctx.mode !== "tui") {
      ctx.ui.notify("/thinking-zh show 仅支持 TUI 模式", "warning");
      return;
    }
    if (this.timeline.length === 0) {
      ctx.ui.notify("当前用户任务还没有思考译文", "info");
      return;
    }

    await ctx.ui.custom<void>(
      (tui, theme, _keybindings, done) =>
        new TimelineOverlay(() => this.timeline, tui, theme, () => done()),
      {
        overlay: true,
        overlayOptions: {
          anchor: "center",
          width: "80%",
          maxHeight: 30,
          margin: 1,
        },
      },
    );
  }

  private renderWidget(width: number): string[] {
    const pendingCount = this.timeline.filter(
      (entry) => entry.status === "pending",
    ).length;
    let title = "思考译文";
    if (pendingCount === 1) title = "思考译文 · 正在翻译";
    if (pendingCount > 1) {
      title = `思考译文 · 正在翻译（${pendingCount}）`;
    }
    const theme = this.theme;
    const body = this.timeline.flatMap((entry) => {
      if (entry.status === "translated") {
        return new Markdown(
          entry.translated ?? "",
          0,
          0,
          getMarkdownTheme(),
        ).render(Math.max(1, width));
      }
      return [theme ? theme.fg("muted", "正在翻译…") : "正在翻译…"];
    });
    const visibleBody = body.slice(-(MAX_WIDGET_LINES - 1));
    return [
      theme ? theme.fg("accent", theme.bold(title)) : title,
      ...visibleBody,
    ].map((line) => truncateToWidth(line, Math.max(1, width)));
  }
}

class TimelineOverlay implements Component {
  private scrollTop = 0;
  private contentHeight = 0;
  private readonly viewportHeight = 24;
  private readonly getTimeline: () => readonly TimelineEntry[];
  private readonly tui: Pick<TUI, "requestRender">;
  private readonly theme: Theme;
  private readonly close: () => void;

  constructor(
    getTimeline: () => readonly TimelineEntry[],
    tui: Pick<TUI, "requestRender">,
    theme: Theme,
    close: () => void,
  ) {
    this.getTimeline = getTimeline;
    this.tui = tui;
    this.theme = theme;
    this.close = close;
  }

  render(width: number): string[] {
    const contentWidth = Math.max(20, width - 2);
    const content: string[] = [];
    for (const [index, entry] of this.getTimeline().entries()) {
      if (index > 0) content.push("");
      content.push(this.theme.fg("accent", this.theme.bold(`原文 ${index + 1}`)));
      content.push(
        ...new Markdown(entry.original, 0, 0, getMarkdownTheme()).render(
          contentWidth,
        ),
      );
      content.push(this.theme.fg("accent", this.theme.bold("译文")));
      if (entry.status === "translated" && entry.translated) {
        content.push(
          ...new Markdown(entry.translated, 0, 0, getMarkdownTheme()).render(
            contentWidth,
          ),
        );
      } else {
        content.push(this.theme.fg("muted", "正在翻译…"));
      }
    }

    this.contentHeight = content.length;
    this.clampScroll();
    const visible = content.slice(
      this.scrollTop,
      this.scrollTop + this.viewportHeight,
    );
    const title = this.theme.fg("accent", this.theme.bold("思考译文时间线"));
    const help = this.theme.fg(
      "dim",
      "↑/↓ · Page Up/Down · Home/End · Esc/q 关闭",
    );
    return [title, ...visible, help].map((line) =>
      truncateToWidth(line, Math.max(1, width)),
    );
  }

  handleInput(data: string): void {
    const action = readOverlayAction(data);
    if (action === "close") {
      this.close();
      return;
    }
    if (!action) return;

    switch (action) {
      case "up":
        this.scrollTop -= 1;
        break;
      case "down":
        this.scrollTop += 1;
        break;
      case "pageUp":
        this.scrollTop -= this.viewportHeight;
        break;
      case "pageDown":
        this.scrollTop += this.viewportHeight;
        break;
      case "home":
        this.scrollTop = 0;
        break;
      case "end":
        this.scrollTop = this.contentHeight;
        break;
      default:
        return;
    }
    this.clampScroll();
    this.tui.requestRender();
  }

  invalidate(): void {}

  private clampScroll(): void {
    this.scrollTop = Math.max(
      0,
      Math.min(
        this.scrollTop,
        Math.max(0, this.contentHeight - this.viewportHeight),
      ),
    );
  }
}

type OverlayAction =
  | "close"
  | "up"
  | "down"
  | "pageUp"
  | "pageDown"
  | "home"
  | "end";

function readOverlayAction(data: string): OverlayAction | undefined {
  if (matchesKey(data, "escape") || data === "q") return "close";
  if (matchesKey(data, "up")) return "up";
  if (matchesKey(data, "down")) return "down";
  if (matchesKey(data, "pageUp")) return "pageUp";
  if (matchesKey(data, "pageDown")) return "pageDown";
  if (matchesKey(data, "home")) return "home";
  if (matchesKey(data, "end")) return "end";
  return undefined;
}
