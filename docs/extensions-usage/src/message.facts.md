# message（使用者版）事实清单

路径省略前缀 `extensions/`、`tests/`。`pi-tui/…`、`pi-coding-agent/…` 指 `node_modules/@earendil-works/` 下的包，只用来解释 Pi 本体行为。

## 用户消息橙色线框

- 功能名「用户消息橙色线框」，「文件路径可点击」 —— pi-personal-extensions.ts:39, 45
- 用户消息外加橙色圆角线框，左上角写 `user` —— user-message-border.ts:7, 35-39
- 只在 TUI（终端界面）模式生效 —— user-message-border.ts:13
- 不用设置：没有快捷命令，`/personal` 二级菜单里没有设置项 —— pi-personal-extensions.ts:68-94（actions 表里没有 user-message-border）
- 只改显示，不改消息内容 —— README.md:38；user-message-border.ts:20-41（只包装 render）
- 可以在 `/personal` 里关闭这项功能（步骤在第 1 章） —— pi-personal-extensions.ts:150, 158-163, 172
- 升级 Pi 后线框可能不再显示，消息照常显示（行结构检查不通过时退回原始渲染） —— user-message-border.ts:15, 25-31；README.md:133

## 文件路径可点击

- 回复里的本地文件路径变成链接，点击由编辑器打开 —— clickable-paths.ts:1-7, 72-77
- 点击方式取决于终端（链接由终端的超链接能力处理） —— pi-tui/dist/components/markdown.js:539-545
- 「多数终端要按住修饰键再点击，macOS 常是 Cmd 键，其他系统常是 Ctrl 键；有的终端直接点击」：终端自身的行为，不在本包源码里，正文用「多数」「常是」「以终端设置为准」限定，未逐个终端核实
- 带行号列号时跳到对应行列（vscode 系列 URL 带 `:行:列`）；例子 `src/app.ts:12:5` 放在列表和图里 —— clickable-paths.ts:72-77, 125-131
- 只有真实存在的文件会变链接；文件夹不算 —— clickable-paths.ts:95-97, 107-122
- 相对路径按会话工作目录查找 —— clickable-paths.ts:120, 238-240
- `~/` 开头的路径展开到主目录 —— clickable-paths.ts:116-118
- 用户自己发的消息默认也处理；没有菜单入口和命令，关闭要改 agent 目录下 `clickable-paths.json` 的 `userMessages` —— clickable-paths.ts:37, 235, 247, 252-301；pi-personal-extensions.ts:82-91
- 手改配置后要 `/reload`：配置只在功能加载时读取一次 —— clickable-paths.ts:235-236
- 默认编辑器 vscode —— clickable-paths.ts:35
- 编辑器选项 vscode / vscode-insiders / cursor / windsurf / file —— clickable-paths.ts:20, 232
- 换编辑器：`/personal` →「文件路径可点击」→「打开方式：…」；或 `/clickable-paths editor <名称>` —— pi-personal-extensions.ts:82-88；clickable-paths.ts:266-275
- file 选项由系统默认程序打开，不跳到行 —— clickable-paths.ts:59-62, 68-70
- 演示里的链接地址格式 —— clickable-paths.ts:64-77（示例路径与工作目录为虚构）
- 裸路径（没加反引号）要带扩展名才识别 —— clickable-paths.ts:162-167
- 关闭裸路径识别：二级菜单「不识别裸路径」或 `/clickable-paths bare off`；恢复用 `bare on` —— pi-personal-extensions.ts:89-90；clickable-paths.ts:277-282
- 三个反引号或三个波浪线包起来的代码块里不变链接 —— clickable-paths.ts:204-224
- 已经写成链接的文字保持原样（仍按原链接显示） —— clickable-paths.ts:160, 187-191；pi-tui/dist/components/markdown.js:539
- 思考内容里不变 —— clickable-paths.ts:246
- 回复输出中不改，输出完再变链接 —— clickable-paths.ts:244-245
- 查看设置 `/clickable-paths`：显示「状态」「编辑器」「裸路径」「工作目录」四行和用法 —— clickable-paths.ts:284-297
- 暂停 `/clickable-paths off`，下一条消息生效；恢复 `on` —— clickable-paths.ts:257-264
- 设置保存在 agent 目录下的 `clickable-paths.json`（默认 `~/.pi/agent/`） —— clickable-paths.ts:235；README.md:115-124
- Pi 没有启用终端超链接时，链接文字后面用括号显示链接地址 —— pi-tui/dist/components/markdown.js:542-557
- 是否启用终端超链接的优先级：Pi 设置 `terminal.hyperlinks`（true/false）> 环境变量 `PI_HYPERLINKS`（1/0）> 自动检测 —— pi-coding-agent/dist/core/settings-manager.js:889-895；pi-coding-agent/dist/modes/interactive/interactive-mode.js:356；pi-tui/dist/terminal-image.js:92-94, 106, 109-116；pi-coding-agent/docs/terminal-setup.md:207-215
- `terminal.hyperlinks` 写在 agent 目录或项目 `.pi/` 下的 `settings.json` —— pi-coding-agent/dist/core/settings-manager.js:99-100；pi-coding-agent/dist/config.js:435；pi-coding-agent/docs/settings.md:107
- 自动检测时启用超链接的终端：iTerm2、kitty、Ghostty、WezTerm、Warp、Windows Terminal、Alacritty、VS Code 和 Zed 的终端；其他终端（含未识别的终端）不启用 —— pi-tui/dist/terminal-image.js:36-89
- 自动检测时，在 tmux 里只有 tmux 转发超链接才启用（设置或环境变量会覆盖这一检测） —— pi-tui/dist/terminal-image.js:20-30, 45-47, 92-94
- 录屏 clickable-paths-status 画面：输入 `/clickable-paths` 显示「状态：开启 / 编辑器：vscode / 裸路径：识别 / 工作目录」和三行用法 —— docs/extensions-usage/media/clickable-paths-status.png；clickable-paths.ts:284-297

- 「点了没反应」检查清单（不朗读）：确认修饰键（终端行为，未核实）；`/clickable-paths` 看「编辑器」是否已安装；`/clickable-paths editor file` 交给系统默认程序；命令只改配置、不刷新已显示的消息，要让 Pi 重新输出路径后点新链接测试 —— clickable-paths.ts:20, 59-62, 68-70, 232, 266-275, 284-297（editor 分支只改 config 并保存、提示，不触发重渲染）。只写检查动作，不断言「编辑器没装时点击没反应」
