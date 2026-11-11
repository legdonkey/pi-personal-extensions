# message（使用者版）事实清单

路径省略前缀 `extensions/`、`tests/`。`pi-tui/…`、`pi-coding-agent/…` 指 `node_modules/@earendil-works/` 下的包，只用来解释 Pi 本体行为。

## 用户消息橙色线框

- 功能名「用户消息橙色线框」，「文件路径可点击」 —— pi-personal-extensions.ts:31, 37
- 用户消息外加橙色圆角线框，左上角写 `user` —— user-message-border.ts:7, 35-39
- 只在 TUI（终端界面）模式生效 —— user-message-border.ts:13
- 不用设置：`/personal` 二级菜单里只有启用 / 禁用 —— pi-personal-extensions.ts:54-81（actions 表里没有 user-message-border）, 167-168
- 只改显示，不改消息内容 —— README.md:39；user-message-border.ts:20-41（只包装 render）
- 可以在 `/personal` 里关闭这项功能（步骤在第 1 章） —— pi-personal-extensions.ts:150-165
- 升级 Pi 后线框可能不再显示，消息照常显示（行结构检查不通过时退回原始渲染） —— user-message-border.ts:15, 25-31；README.md:198

## 文件路径可点击

- 回复里的本地文件路径变成链接，点击由编辑器打开 —— clickable-paths.ts:1-7, 72-77
- 点击方式取决于终端（链接由终端的超链接能力处理） —— pi-tui/dist/components/markdown.js:539-545
- 「多数终端要按住修饰键再点击，macOS 常是 Cmd 键，其他系统常是 Ctrl 键；有的终端直接点击」：终端自身的行为，不在本包源码里，正文用「多数」「常是」「以终端设置为准」限定，未逐个终端核实
- 带行号列号时跳到对应行列（vscode 系列 URL 带 `:行:列`）；例子 `src/app.ts:12:5` 放在列表和图里 —— clickable-paths.ts:72-77, 125-131
- 只有真实存在的文件会变链接；文件夹不算 —— clickable-paths.ts:95-97, 107-122
- 相对路径按会话工作目录查找 —— clickable-paths.ts:120, 238-240
- `~/` 开头的路径展开到主目录 —— clickable-paths.ts:116-118
- 用户自己发的消息默认也处理；没有菜单入口和命令，关闭要改 agent 目录下 `clickable-paths.json` 的 `userMessages` —— clickable-paths.ts:37, 235, 247, 252-299；pi-personal-extensions.ts:68-77
- 手改配置后要 `/reload`：配置只在功能加载时读取一次 —— clickable-paths.ts:235-236
- 默认编辑器 vscode —— clickable-paths.ts:35
- 编辑器选项 vscode / vscode-insiders / cursor / windsurf / file —— clickable-paths.ts:20, 232
- 换编辑器：`/personal` →「文件路径可点击」→「打开方式：…」（菜单是唯一入口） —— pi-personal-extensions.ts:72-74, 135, 150-173；clickable-paths.ts:266-275
- file 选项由系统默认程序打开，不跳到行 —— clickable-paths.ts:59-62, 68-70
- 演示里的链接地址格式 —— clickable-paths.ts:64-77（示例路径与工作目录为虚构）
- 裸路径（没加反引号）要带扩展名才识别 —— clickable-paths.ts:162-167
- 关闭裸路径识别：二级菜单「不识别裸路径」；恢复选「识别裸路径」 —— pi-personal-extensions.ts:75-76；clickable-paths.ts:277-282
- 三个反引号或三个波浪线包起来的代码块里不变链接 —— clickable-paths.ts:204-224
- 已经写成链接的文字保持原样（仍按原链接显示） —— clickable-paths.ts:160, 187-191；pi-tui/dist/components/markdown.js:539
- 思考内容里不变 —— clickable-paths.ts:246
- 回复输出中不改，输出完再变链接 —— clickable-paths.ts:244-245
- 查看设置：二级菜单「查看路径链接设置」，显示「状态」「编辑器」「裸路径」「工作目录」四行，最后一行提示在 `/personal` → 文件路径可点击 里设置 —— pi-personal-extensions.ts:69；clickable-paths.ts:284-296
- 暂停：二级菜单「暂停路径链接」，下一条消息生效；恢复选「开启路径链接」 —— pi-personal-extensions.ts:70-71；clickable-paths.ts:258-264
- 设置保存在 agent 目录下的 `clickable-paths.json`（默认 `~/.pi/agent/`） —— clickable-paths.ts:235；README.md:161-174
- Pi 没有启用终端超链接时，链接文字后面用括号显示链接地址 —— pi-tui/dist/components/markdown.js:542-557
- 是否启用终端超链接的优先级：Pi 设置 `terminal.hyperlinks`（true/false）> 环境变量 `PI_HYPERLINKS`（1/0）> 自动检测 —— pi-coding-agent/dist/core/settings-manager.js:889-895；pi-coding-agent/dist/modes/interactive/interactive-mode.js:356；pi-tui/dist/terminal-image.js:92-94, 106, 109-116；pi-coding-agent/docs/terminal-setup.md:207-215
- `terminal.hyperlinks` 写在 agent 目录或项目 `.pi/` 下的 `settings.json` —— pi-coding-agent/dist/core/settings-manager.js:99-100；pi-coding-agent/dist/config.js:435；pi-coding-agent/docs/settings.md:107
- 自动检测时启用超链接的终端：iTerm2、kitty、Ghostty、WezTerm、Warp、Windows Terminal、Alacritty、VS Code 和 Zed 的终端；其他终端（含未识别的终端）不启用 —— pi-tui/dist/terminal-image.js:36-89
- 自动检测时，在 tmux 里只有 tmux 转发超链接才启用（设置或环境变量会覆盖这一检测） —— pi-tui/dist/terminal-image.js:20-30, 45-47, 92-94
- 录屏 clickable-paths-status 画面（已按新版录屏核对）：`/personal` → 文件路径可点击 →「查看路径链接设置」，输出「状态：开启」「编辑器：vscode」「裸路径：识别」「工作目录」四行，最后一行「设置：/personal → 文件路径可点击，可选择开关、打开方式和裸路径识别。」；本轮在临时 agent 目录重录，只加载本仓库与 pi-statusline，不发送模型消息；底部标题合入状态栏，无 ponytail 字样 —— docs/extensions-usage/media/clickable-paths-status.png；docs/extensions-usage/tapes/clickable-paths-status.tape；clickable-paths.ts:284-296

- 「点了没反应」检查清单（不朗读）：确认修饰键（终端行为，未核实）；「查看路径链接设置」看「编辑器」是否已安装；「打开方式：file」交给系统默认程序；菜单项只改配置、不刷新已显示的消息，要让 Pi 重新输出路径后点新链接测试 —— clickable-paths.ts:20, 59-62, 68-70, 232, 266-275, 284-296（editor 分支只改 config 并保存、提示，不触发重渲染）。只写检查动作，不断言「编辑器没装时点击没反应」

- 本轮重录 personal-menu、personal-switches、statusline-style，后者包含第五项标题开关及状态栏标题；其他认证/聊天录屏保留历史画面并在紧邻图注中标明标题位置已变化，不伪造模型调用 —— docs/extensions-usage/tapes/；两版页面可见历史录屏图注。
- 删除原视频审查后（/personal 一级菜单和批量开关各少一项），在按 _settings.tape 创建的临时 agent 目录重录 personal-menu、personal-switches、statusline-style、clickable-paths-status、effort-status、effort-model，画面中一级菜单为五项功能加「批量功能开关」；前三个录制前移除了临时目录里的凭据文件，后三个保留凭据文件但不发送模型消息；auto-name-model、auto-name-status 的画面早于原视频审查，不含该项，未重录 —— docs/extensions-usage/tapes/；docs/extensions-usage/media/；extensions/pi-personal-extensions.ts:16-47
