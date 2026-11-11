# overview 事实清单

- 包名 pi-personal-extensions，是 Pi 扩展合集 —— package.json:2-4；README.md:3
- 包只声明一个扩展入口 ./extensions/pi-personal-extensions.ts —— package.json:20-24；tests/personal.test.mjs:43-48
- 入口按 personal-extensions.json 的开关加载五项功能 —— extensions/pi-personal-extensions.ts:125-135
- 入口注册 /personal，用于启停和设置 —— extensions/pi-personal-extensions.ts:137-258
- 开关文件路径来自 getAgentDir()，默认 ~/.pi/agent，可由 PI_CODING_AGENT_DIR 改变 —— extensions/pi-personal-extensions.ts:125；tests/personal.test.mjs:38-41；node_modules/@earendil-works/pi-coding-agent/dist/config.js:453-458（非本仓库）
- 五项功能的 label：自动会话命名、状态栏：额度、会话 ID 与配色、文件路径可点击、用户消息橙色线框、原位思考强度（Jev / d1-ultra） —— extensions/pi-personal-extensions.ts:16-47
- 按屏幕区域归类、章号是讲解页的组织方式，源码没有分组概念
- 用户消息橙色线框：给 TUI 普通用户消息加橙色边框，左上角显示 user —— extensions/user-message-border.ts:7、33-39
- 文件路径可点击：把本地文件路径改写成可点击链接 —— extensions/clickable-paths.ts:2-10、242-249
- 状态栏功能（statusline）：用 setStatus 显示剩余额度、会话 ID 末尾 8 位和回复结束后的 token 速度 —— extensions/statusline.ts:37-44、132-140、243-271
- 图中第二行将示例标题与 `7c41e0a2 · weekly 88% left` 放在同一状态栏区域，不再在状态栏上方单独右对齐；标题通过 setStatus 提供，位置由 footer 决定 —— extensions/statusline.ts:106-109；01-overview.html:76-105。
- 图中第二行示例 `7c41e0a2 · weekly 88% left`：会话 ID 是虚构的 8 位示例值（框内标「示例画面」），`weekly 88% left` 的格式见 extensions/statusline.ts:533-535、702-707（formatRemaining）
- 同一项状态栏功能还改 pi-statusline 的配色（同时设置 compact 密度和 round 分隔符，细节在第 4 章）—— extensions/statusline.ts:930-953；extensions/pi-personal-extensions.ts:24-27、78-79
- 状态栏会话标题：通过 setStatus 合入状态栏显示会话名 —— tests/session-title.test.mjs（合并标题回归测试）
- 自动会话命名：agent_settled 后触发检查，满足条件（有 UI、空闲、开启、未被手动名保护等）才后台请求 —— extensions/auto-session-name.ts:269-287、458-460
- 原位思考强度：支持 openai-codex-responses 接口的 GPT-6 Codex；Anthropic 协议分支要求 anthropic-messages 接口、compat.supportsMidConvoEffort 为 true 且 ID 精确匹配三个 Claude 模型；Antigravity 分支要求 provider antigravity、antigravity-api 接口且 ID 精确匹配两个 Claude 模型；三个分支都要求 thinking 不为 off。状态栏显示 `🧠 当前 · 基线 … · 分类器`，始终带分类器名；当前强度等于基线时省略基线段（图中示例 `🧠 low · 基线 medium · d1-ultra`） —— extensions/inline-effort.ts:70、80-93、355-359、234、451、462-465、489；README.md:70-78
- 「为新用户消息选择思考强度」：同批多条消息可共用一次分类，空白文本不调用 —— extensions/inline-effort.ts:106-120、391-417（细节在第 6 章）
- 五项功能默认全部开启 —— extensions/pi-personal-extensions.ts:86-88；README.md:28
- 每项可以单独关闭 —— extensions/pi-personal-extensions.ts:133-135、178
- 入口是 Pi 加载的那个文件 —— package.json:20-24
- 额度、会话 ID、速度和配色合并为一项功能、一个总开关及五个独立开关（功能 ID statusline）—— extensions/pi-personal-extensions.ts:23-28；extensions/statusline.ts（合并后的单文件）

- 会话标题合入 statusline，第五项独立开关 sessionTitleEnabled，新项优先、缺失沿用旧 session-title，空名仍显示未命名会话 —— tests/session-title.test.mjs；README.md「会话标题合并迁移」。

- 本轮重录 personal-menu、personal-switches、statusline-style，后者包含第五项标题开关及状态栏标题；其他认证/聊天录屏保留历史画面并在紧邻图注中标明标题位置已变化，不伪造模型调用 —— docs/extensions-usage/tapes/；两版页面可见历史录屏图注。
