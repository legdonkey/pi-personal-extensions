import {
  UserMessageComponent,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";

const orange = (text: string): string => `\x1b[38;2;217;154;82m${text}\x1b[39m`;
// 只匹配原生 Box 的边缘空格，不扫描正文或 OSC 超链接内容。
const leftPadding = /^((?:\x1b\[[\d;]*m)*) /;
const rightPadding = / (?=(?:\x1b\[[\d;]*m)*$)/;

export default function (pi: ExtensionAPI) {
  let cleanup: (() => void) | undefined;

  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui" || cleanup) return;

    // ponytail: pi 暂无普通用户消息的边框钩子，临时包装导出的组件；有官方接口后迁移。
    const prototype = UserMessageComponent.prototype;
    const originalRender = prototype.render;
    let active = true;

    function render(this: UserMessageComponent, width: number): string[] {
      const lines = originalRender.call(this, width);
      if (!active || width < 3 || lines.length < 3) return lines;
      const blank = " ".repeat(width);
      // 必须有完整边缘留白；零 padding、窄窗口或不兼容的渲染结构沿用原样，避免吞字。
      if (!lines[0].includes(blank) || !lines[lines.length - 1].includes(blank))
        return lines;
      if (lines.some((line) => visibleWidth(line) !== width)) return lines;
      if (
        lines
          .slice(1, -1)
          .some((line) => !leftPadding.test(line) || !rightPadding.test(line))
      )
        return lines;

      const edge = "─".repeat(width - 2);
      return lines.map((line, index) => {
        // 保留原生背景控制码及 OSC 133 导航标记，只替换空格。
        if (index === 0) return line.replace(blank, orange(`┌${edge}┐`));
        if (index === lines.length - 1)
          return line.replace(blank, orange(`└${edge}┘`));
        return line
          .replace(rightPadding, orange("│"))
          .replace(
            leftPadding,
            (_match, style: string) => style + orange("│") + style,
          );
      });
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
