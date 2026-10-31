---
name: pi-personal-extensions 讲解页
description: 一个入口七项功能的图解与朗读讲解，Stripe Docs 式左文右图双栏
colors:
  paper: "#ffffff"
  paper-2: "#f6f9fc"
  paper-3: "#eef3f8"
  ink: "#0a2540"
  ink-2: "#273951"
  muted: "#50617a"
  soft: "#5f6e83"
  rule: "#e3e9f0"
  rule-solid: "#cfd8e3"
  accent: "#d99a52"
  accent-ink: "#9a5a14"
  accent-tint: "#fbf1e4"
  link: "#5b54f0"
  link-tint: "#efeefe"
  ok: "#1f8a5b"
  warn: "#b7791f"
  danger: "#c4314b"
  code-bg: "#0d1b2e"
  code-ink: "#dbe6f3"
  sel: "#ffe2bd"
  dark-paper: "#0b1526"
  dark-paper-2: "#101d33"
  dark-paper-3: "#16253f"
  dark-ink: "#e8eef7"
  dark-ink-2: "#c9d4e3"
  dark-muted: "#9fb0c6"
  dark-soft: "#8394ad"
  dark-rule: "#1d2c46"
  dark-rule-solid: "#2a3b59"
  dark-accent: "#e4a765"
  dark-accent-ink: "#f0bd83"
  dark-accent-tint: "#2a2117"
  dark-link: "#9a95ff"
  dark-code-bg: "#07101e"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, Segoe UI, sans-serif"
    fontSize: "clamp(34px, 3.6vw, 52px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, Segoe UI, sans-serif"
    fontSize: "clamp(28px, 2.4vw, 36px)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  lead:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, Segoe UI, sans-serif"
    fontSize: "17.5px"
    fontWeight: 400
    lineHeight: 1.75
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.75
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, Segoe UI, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, Segoe UI, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1
  code:
    fontFamily: "ui-monospace, SF Mono, JetBrains Mono NL, Menlo, Consolas, PingFang SC, monospace"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  seg: "3px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  pill: "15px"
  full: "50%"
spacing:
  beat-y: "28px"
  beat-gap: "clamp(24px, 3vw, 56px)"
  gutter: "clamp(20px, 2.6vw, 48px)"
  chapter-top: "clamp(48px, 6vw, 96px)"
  top: "60px"
  dock: "76px"
  side: "244px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "{colors.ink-2}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "34px"
  button-secondary-hover:
    backgroundColor: "{colors.paper-2}"
  play-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    size: "44px"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "30px"
  chip-pressed:
    textColor: "{colors.ink}"
  toc-link:
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: "7px 10px"
  toc-link-current:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
  figure-panel:
    backgroundColor: "{colors.paper-2}"
    rounded: "{rounded.lg}"
    padding: "12px"
  code-block:
    backgroundColor: "{colors.code-bg}"
    textColor: "{colors.code-ink}"
    typography: "{typography.code}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  code-inline:
    backgroundColor: "{colors.paper-3}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xs}"
    padding: "1px 5px"
  note:
    backgroundColor: "{colors.paper-2}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  seg-active:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.seg}"
  demo-input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "7px 10px"
---

# Design System: pi-personal-extensions 讲解页

## Overview

**Creative North Star: "朗读驱动的技术手册"**

这是一份照标准技术文档的路子做的讲解页，标杆是 Stripe Docs：白底、深海军蓝墨色、浅蓝灰面板、细线分隔。页面不靠装饰取胜，靠的是左文右图的双栏节拍：左栏是短段落，右栏是 sticky 的 SVG 图表或真实 Pi 录屏。朗读把两栏串起来，读到哪一句，那句文字就高亮，右侧图表对应的元素就点亮，其余元素变暗。

整体密度偏「阅读型」：正文 16px、行高 1.75，段落短，标题字距收紧。版面全宽，不设版心，靠栏宽比例和流式内边距控制行长。唯一的暖色是项目自身用户消息边框的橙色，它只用来标示「正在讲的、焦点的、进度」，其余全部是冷灰蓝中性色。深色模式整体换成深海军蓝底，保持同一套角色映射。

**Key Characteristics:**
- 左文右图的 beat 双栏（0.76fr / 1.24fr），图栏 sticky。
- 单一橙色强调，来自 `user-message-border` 扩展的终端前景色 rgb(217,154,82)。
- 系统中文无衬线做全部文字，等宽只用于代码和技术标签。
- 朗读状态驱动图表：未讲到变暗，讲到点亮或播放动画。
- 底部常驻播放器，顶栏与播放器都是半透明毛玻璃。
- 浅色、深色、跟随系统三态，`[data-theme]` 手动覆盖 `prefers-color-scheme`。

## Colors

冷调的海军蓝中性色阶，加一个来自产品本身的暖橙强调色和一个靛蓝链接色。

### Primary
- **用户消息橙**（accent）：朗读进度条填充、播放器滑块描边、目录章节进度、图表焦点节点描边、讲到的连线、`.dot` 圆点、range 滑块。取自 `extensions/user-message-border.ts` 的 `\x1b[38;2;217;154;82m`，所以讲解页和终端里看到的是同一个橙。
- **焦橙墨**（accent-ink）：橙色需要作为文字或图标前景时使用（如「从这里朗读」按钮 hover），保证对比度。
- **淡杏底**（accent-tint）：正在朗读的句子底色、焦点节点 `.n.is-focal` 的填充、终端示意里被占用的格子。

### Secondary
- **靛蓝链接**（link）：正文链接、`:focus-visible` 外框、「上次停在这里」旗标、`.w.is-link` 连线。它是交互色，不和橙色争「焦点」角色。

### Neutral
- **纸白**（paper）：页面底色、按钮与 chip 底色、SVG 节点填充。
- **浅蓝灰面板**（paper-2）：sticky 图表面板、提示框、章节元信息框、目录当前项与 hover 底色；SVG `.mask` 用它遮挡连线。
- **浅灰蓝**（paper-3）：行内代码底、句子 hover 底、主题切换按下态。
- **深海军蓝墨**（ink）：标题、强调文字、主按钮与播放键底色。
- **次墨**（ink-2）：正文段落颜色（body 默认）。
- **灰蓝**（muted）：导语、图注、目录普通项、次要文字。
- **淡灰蓝**（soft）：时长、表头、细小提示、外部节点虚线描边、连线默认色。
- **细线**（rule）/ **实线**（rule-solid）：分隔线、面板边框；rule-solid 用于按钮、输入框、节点描边和刻度。
- **代码夜色**（code-bg / code-ink）：代码块和录屏外框的深色底。
- 状态色 ok / warn / danger 只用于演示输出的对错与警告提示框，以 `color-mix` 调成 7%–8% 的淡底加 40%–45% 的描边。

### Named Rules
**The One Warm Voice Rule.** 页面里只有橙色一种暖色，它只表示「正在讲 / 焦点 / 进度」。不要把橙色用作装饰底色或第二个品牌色。

**The Same Orange Rule.** accent 必须与 `user-message-border` 扩展的终端色保持一致；扩展改色，讲解页随之改。

**The Role Not Hex Rule.** 所有组件只引用 `var(--paper)`、`var(--ink)` 等角色变量；深色模式通过 `:root[data-theme="dark"]` 和 `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` 两处同值重定义切换，两处必须同步修改。

## Typography

**Display Font:** 系统中文无衬线（-apple-system、PingFang SC、Noto Sans SC、Microsoft YaHei，回退 sans-serif）
**Body Font:** 同上
**Label/Mono Font:** ui-monospace、SF Mono、JetBrains Mono NL、Menlo，中文回退 PingFang SC

**Character:** 一套系统字体包揽全部文字，靠字重 650/700 和负字距建立层级；等宽字体是「这是代码或技术值」的信号，不承担装饰。

### Hierarchy
- **Display**（700，clamp(34px, 3.6vw, 52px)，1.12）：只用于封面标题。
- **Headline**（700，clamp(28px, 2.4vw, 36px)，1.2）：章节标题；手机上固定 26px。
- **Title**（650，20px，1.35）：beat 内小节标题；h4 为 650、16px。
- **Lead**（400，17.5px）：章节导语；封面导语 18px，最大 40em。
- **Body**（400，16px，1.75）：正文；手机上 15.5px。
- **Caption**（400，14.5px，1.7）：图注、表格、目录项。
- **Label**（600，12.5px–14px）：按钮、chip、播放器文字。
- **Code**（13.5px，1.65）：代码块；行内代码 0.88em；时长、刻度、技术标签用 11.5px–12.5px 等宽。
- SVG 内文字：`.t` 14px/600 墨色，`.t-cap` 12.5px 灰蓝，`.t-sub` 与 `.t-mono` 为 12px–12.5px 等宽。

### Named Rules
**The Mono Means Code Rule.** 等宽字体只出现在代码、命令、路径、配置键、时长和数值上。中文说明文字一律用无衬线。

**The Keep-All Rule.** 标题和目录项使用 `word-break: keep-all; overflow-wrap: anywhere`，中文标题不在词中间断行。

## Layout

全宽布局，不设固定版心。外层是两列网格：左侧 244px 章节目录（≤1100px 时 228px），sticky 在顶栏下方，高度扣除顶栏和播放器；右侧主区流式内边距 clamp(20px, 2.6vw, 48px)。

每章由章节头和若干 beat 组成。章节头和 beat 都是 `minmax(0, 0.76fr) minmax(0, 1.24fr)` 双栏：左栏文字，右栏图表；章节头的右栏放元信息框，底部对齐。beat 上下内边距 28px，栏间距 clamp(24px, 3vw, 56px)，相邻 beat 之间用虚线分隔；章节之间用实细线和 clamp(48px, 6vw, 96px) 的顶部留白。没有图的 beat 自动变成单栏全宽。

图栏 sticky 在顶栏下 20px 处。SVG 最小宽度 520px（手机 480px），超出时横向滚动，并用右侧渐隐遮罩提示还有内容，滚到底时去掉遮罩。

断点：≤920px 隐藏侧栏、改用顶栏「章节」下拉，所有双栏退化为单栏，图栏取消 sticky，「从这里朗读」按钮隐藏；≤640px 顶栏 54px、播放器变为两行（高 104px），主区内边距 16px。

### Named Rules
**The Text Left, Figure Right Rule.** 讲解单元一律是左文右图的 beat；不要改成卡片网格或纯文字长文。

**The No Max-Width Rule.** 不给页面或主区设固定版心宽度；行长由栏比例控制。封面录屏是唯一的上限（980px）。

## Elevation & Depth

整体是平面的，靠色阶（paper → paper-2 → paper-3）和 1px 细线表达层次，没有常驻投影。固定在视口上的两条栏（顶栏、播放器）用 92%–94% 透明度的纸色加 `backdrop-filter: saturate(1.4) blur(10–12px)` 浮在内容之上。

### Shadow Vocabulary
- **下拉浮层**（`box-shadow: 0 12px 32px -12px rgb(10 37 64 / .25)`）：只用于窄屏的章节下拉菜单。
- **朗读下划线**（`box-shadow: inset 0 -2px 0 var(--accent)`）：正在朗读的句子底部的橙色线，这是标记，不是投影。

### Named Rules
**The Flat Paper Rule.** 面板靠底色和细线区分，不加投影。投影只给脱离文档流的临时浮层。

## Shapes

圆角克制，按尺寸递增：句子高亮 3px，行内代码与 kbd 4px，目录项、输入框、演示按钮 6px，按钮、提示框、代码块 8px，图表面板、演示框、封面录屏 10px。只有 chip（15px 胶囊）、播放键和「从这里朗读」按钮（圆形）是全圆。边框统一 1px；kbd 底边 2px 做出按键感。SVG 图表里，节点是细描边圆角矩形，外部依赖用 4 3 虚线，「幽灵」节点无填充，连线 1.5px。

## Components

### Buttons
- **Shape:** 8px 圆角，高 34px，内边距 0 14px，600 14px。
- **Primary:** 墨色底、纸色字（「从头朗读全文」）；hover 换成次墨。
- **Secondary:** 纸色底、rule-solid 描边；hover 底色换 paper-2、描边加深为 soft。
- **Icon button:** 34px 方形；在播放器内透明无边框，hover 出现 paper-2 底。
- **Play:** 44px 墨色圆形，hover 放大 1.05，按下缩到 0.96，使用 `--ease-out`。

### Chips
- **Style:** 30px 高、15px 胶囊、纸色底、灰蓝字、rule-solid 描边。
- **State:** `aria-pressed="true"` 时字色和描边都变成墨色（「跟随滚动」）。倍速 chip 依次循环 1×、1.25×、1.5×、0.85×。

### Cards / Containers
- **图表面板：** paper-2 底、rule 描边、10px 圆角、12px 内边距；图注在面板内，用一条细线与图分开。
- **提示框：** paper-2 底、8px 圆角、12px 14px 内边距；警告版用 warn 调色的淡底和描边。
- **章节元信息框：** paper-2 底的两列 dl，13.5px。
- **演示框：** 纸色底、10px 圆角、16px 内边距；输出区按 `data-ok` 显示 ok 或 danger 调色。

### Inputs / Fields
- **Style:** 等宽 14px、7px 10px 内边距、rule-solid 描边、6px 圆角、纸色底；range 滑块用 `accent-color: var(--accent)`。
- **Focus:** 2px 靛蓝外框，offset 1px（全局 `:focus-visible` 为 2px 靛蓝、offset 2px）。

### Navigation
- **顶栏：** 60px sticky，品牌图标是墨色圆角方块里白色「π」加一个橙点。右侧是浅色 / 跟随系统 / 深色三按钮分段开关，按下态 paper-3 底。
- **侧栏目录：** 每项是两列网格：章节名 + 等宽时长，下方 2px 进度条用橙色填充朗读进度，再下一行是等宽的功能名。当前章 paper-2 底、600 字重。

### 朗读段与「从这里朗读」
正文中的每句朗读文字包在 `.seg` 里，点击从该句开始朗读；hover 显示 paper-3 底。正在读的句子用 accent-tint 底加 2px 橙色下划线，`box-decoration-break: clone` 保证跨行一致。每个可朗读段落左侧外挂一个 24px 圆形播放按钮，默认隐藏，hover 段落时出现；所在 beat 正在朗读时常驻 35% 透明度。图注里的按钮放在右上角。

### 朗读驱动的图表（Signature）
SVG 共用一套类：`.n` 节点（`is-focal` 焦点、`is-ext` 外部、`is-ghost` 占位），`.t` / `.t-sub` / `.t-cap` / `.t-mono` 文字，`.w` 连线（`is-accent`、`is-link`、`is-dash`、`is-flow`），`.mask` 遮挡，`.dot` 橙点。元素通过 `data-cue` 绑定一句朗读。只有正在朗读的 beat（`.beat.is-narrating`）才把未讲到的元素降到 0.14 透明度并去饱和；讲到的元素加 `is-active`（节点描边变橙、流动连线开始 0.9s 循环虚线动画），讲过的加 `is-past` 保持点亮。`data-cue-mode="active"` 的元素只在讲到时出现。过渡统一 0.5s `--ease-out`。录屏不参与变暗，讲到时从头播放。`prefers-reduced-motion` 下取消所有动画和变暗。

### 录屏
真实 Pi 录屏放在 code-bg 深色外框里（8px 圆角、rule-solid 描边），右上角半透明黑底标签提示可放大。点击后全屏放大：深海军蓝 88% 遮罩，画面最宽 1280px；手机上按原尺寸横向滚动。

### 底部播放器
固定在底部，76px 高，三栏网格：上一句 / 播放 / 下一句；中间是当前章节名 + 当前句（单行省略）和进度导轨；右侧是状态消息、等宽时间、倍速和跟随滚动。导轨是 3px rule 色底线、橙色填充、13px 纸色圆形滑块带 2px 橙描边；章节边界是 11px 高的 rule-solid 竖刻度；「上次停在这里」是 2px 宽的靛蓝旗标。导轨是 `role="slider"`，可键盘聚焦。

### 代码块
code-bg 底、code-ink 字、8px 圆角、13.5px/1.65 等宽；hover 时右上角出现「复制」按钮。行内代码 paper-3 底、4px 圆角；在标题里去掉底色。

## Do's and Don'ts

### Do:
- **Do** 每个讲解单元都用左文右图的 beat（0.76fr / 1.24fr），图栏 sticky 在顶栏下 20px。
- **Do** 只通过角色变量取色，并在 `[data-theme="dark"]` 和 `prefers-color-scheme` 两处同步定义深色值。
- **Do** 给每个 SVG 元素绑定 `data-cue`，复用 `.n` `.t` `.w` 等共享类，不在图里另起配色（模拟终端画面的固定前景/背景色除外）。
- **Do** 把橙色留给「正在讲 / 焦点 / 进度」；链接和焦点外框用靛蓝。
- **Do** 代码、命令、路径和数值用等宽字体，说明文字用系统中文无衬线。
- **Do** 在 `prefers-reduced-motion` 下取消动画，并让所有 cue 元素保持可见。

### Don't:
- **Don't** 给页面设固定版心宽度。
- **Don't** 把讲解内容改成卡片网格或不配图的纯文字长文。
- **Don't** 引入第二种暖色或强调色，也不要让 accent 偏离 `user-message-border` 的 rgb(217,154,82)。
- **Don't** 给面板加常驻投影；层次靠 paper 色阶和 1px 细线。
- **Don't** 用 soft 色排正文或必读说明；它在白底和面板底上的对比度约 4.6～5:1，只够小号辅助标注（时长、表头、图注）。
