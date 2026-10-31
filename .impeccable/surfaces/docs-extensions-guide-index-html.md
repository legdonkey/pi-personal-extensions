---
version: 1
slug: "docs-extensions-guide-index-html"
primary_target: "docs/extensions-guide/index.html"
related_targets: []
---

## Scope

`docs/extensions-guide/index.html`：pi-personal-extensions 七项扩展的图解讲解页，带 TTS 朗读。Mode: Read。

## Audience and job

熟悉 Pi 的技术同事。读完或听完后能说清每项功能的作用、触发方式、机制、边界和代价，并能自己安装配置。

## Constraints

全宽布局，不设固定版心；跟随系统深浅色并可手动切换；自然语言用简体中文（plain-chinese 规范）；事实以源码为准；尽量用图、动画和真实 Pi 录屏讲解。

## Direction contract

FORM: canon — standard technical documentation, played straight; craft bar Stripe Docs. seed: seed:a317c52a44ab77bd
THESIS: 像 Stripe 文档一样的双栏讲解：左边短文字，右边 sticky 图表面板；朗读把两栏串起来，读到哪句，图就亮到哪一步。拒绝纯文字长文和卡片网格。
OWN-WORLD: 白底 / 深海军蓝墨色（#0a2540 系），浅蓝灰面板 #f6f9fc，细线边框；强调色取项目自身的用户消息橙 #D99A52，链接用靛蓝。系统无衬线中文字体，等宽只用于代码和技术标签。深色模式为深海军蓝底。
STORY: 封面讲「一个入口七项功能」→ 总览图 → /personal 机制 → 各功能（外观、状态、命名、思考强度）→ 安装与配置收尾。
FIRST VIEWPORT: 顶栏 + 左侧章节目录（带每章时长和朗读进度）+ 标题、导语、「从头朗读全文」按钮；底部常驻播放器（进度导轨带章节刻度和「上次停在这里」旗标）。
SIGNATURE: 朗读驱动的图表：每个 SVG 元素绑定一句朗读，未讲到时变暗，讲到时点亮或运行 SMIL 动画；录屏在讲到时从头播放。
RISK: 双栏 sticky 图在内容长短不一时会出现图文错位；窄屏退化为上下排列。
