import {
  UserMessageComponent,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";

const orange = (text: string): string => `\x1b[38;2;217;154;82m${text}\x1b[39m`;

export default function (pi: ExtensionAPI) {
  let cleanup: (() => void) | undefined;

  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui" || cleanup) return;

    // ponytail: pi 暂无普通用户消息的边框钩子，临时包装导出的组件；有官方接口后迁移。
    const prototype = UserMessageComponent.prototype;
    const originalRender = prototype.render;
    let active = true;

    function render(this: UserMessageComponent, width: number): string[] {
      if (!active || width < 8) return originalRender.call(this, width);
      // 复用原生正文排版和链接转换，上下空白行改作边框以压缩高度。
      const lines = originalRender.call(this, width - 2);
      const blank = " ".repeat(width - 2);
      if (
        lines.length < 2 ||
        !lines[0].includes(blank) ||
        !lines[lines.length - 1].includes(blank) ||
        lines.some((line) => visibleWidth(line) !== width - 2)
      )
        return originalRender.call(this, width);

      const border = (text: string) =>
        ctx.ui.theme.bg("userMessageBg", orange(text));
      const edge = "─".repeat(width - 2);
      return [
        lines[0].replace(blank, border(`╭ user ${"─".repeat(width - 8)}╮`)),
        ...lines.slice(1, -1).map((line) => border("│") + line + border("│")),
        lines[lines.length - 1].replace(blank, border(`╰${edge}╯`)),
      ];
    }

    prototype.render = render;
    cleanup = () => {
      active = false;
      // 不覆盖后来加载的扩展；若被其他包装引用，本层也已成为透明转发。
      if (prototype.render === render) prototype.render = originalRender;
    };
  });

  pi.on("session_shutdown", () => {
    cleanup?.();
    cleanup = undefined;
  });
}
