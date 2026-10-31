# statusbar（使用者版）事实清单

路径省略前缀 `extensions/`。`cli.md` 指 `node_modules/@earendil-works/pi-coding-agent/docs/cli.md`，`config.js` 指同包的 `dist/config.js`。

## 看懂额度和会话 ID（fig-statusbar-1）

- 功能 label「额度与会话 ID」「状态栏风格选择」 —— pi-personal-extensions.ts:33, 51
- 状态栏显示两项：会话 ID 和服务商剩余额度 —— substatusline.ts:6-7, 30-35, 105
- 会话 ID 显示末尾 8 位 —— substatusline.ts:28
- openai-codex 显示 `weekly N% left`（周额度剩余） —— substatusline.ts:192-194
- zai-coding-cn 显示 `5h N% left · weekly N% left`（5 小时、周额度剩余） —— substatusline.ts:217-222
- N 是剩余百分比（100 − 已用，取整） —— substatusline.ts:318-323
- 图中 `a1b2c3d4`、63%、82%、47% 是示例值，图注已标注；原图注「位置由状态栏决定」无法从源码核实，已删

## 更新时机（只在排查第 3 步和不朗读列表里出现）

- 会话开始、会话树跳转（session_tree）、切换模型时立即发起查询（异步；失败时保留旧值，所以朗读写「立即发起查询」而不是「立刻更新」） —— substatusline.ts:125-147, 106-111
- 之后每 5 分钟查询一次（「约 5 分钟内」等到下一次更新） —— substatusline.ts:8, 117-123
- Pi 回复完一轮（agent_settled）也查询；距上次查询开始不足 30 秒跳过；失败的查询同样记录开始时间 —— substatusline.ts:9, 77-86, 149-152

## 额度为空怎么办（fig-statusbar-2）

- 只有 openai-codex、zai-coding-cn 显示额度，其他服务商时额度为空 —— substatusline.ts:11-13, 60-65
- 额度需要读取该服务商的登录凭据（`pi auth`）；读不到时本次查询失败 —— substatusline.ts:169-176, 201-206, 225-234
- 查询需要访问服务商的用量接口（网络），单步最多 15 秒 —— substatusline.ts:10, 186-190, 207-216, 241-249
- 查询失败时保留上次查到的值；从没查到过就为空 —— substatusline.ts:106-111

## 换配色（fig-statusbar-3 录屏）

- 状态栏本体来自 `npm:@narumitw/pi-statusline`，需要另外安装启用 —— README.md:110；pi-personal-extensions.ts:52
- 安装命令格式 `pi install npm:@scope/package` —— cli.md:241
- `/statusline-style` 不带参数打开选择器：上下键挑选并实时预览，Enter 应用，Esc 放弃 —— statusline-style-picker.ts:257-300
- 选择器只在 TUI 模式下打开 —— statusline-style-picker.ts:258-262
- 可带编号（如 11）或名称（如 茶墨渐层）直接选；名称写错提示「未知风格」，不写文件、不重载 —— statusline-style-picker.ts:14, 171-176, 257, 304-307；tests/statusline-style-picker.test.mjs:56, 63-65
- 录屏画面：`/statusline-style` 配色列表 01–11，上下移动时菜单内「预览」条换色，底部真实状态栏不变，Esc 不应用（预览条见 statusline-style-picker.ts:282-283） —— docs/extensions-usage/tapes/statusline-style.tape；statusline-style-picker.ts:289-300

## 应用后改什么（并入换配色一节；录屏下方的键帽步骤条 statusbar-07～10 一步一个 cue）

- Pi 正在回复或压缩时，扩展的 `ctx.reload()` 会被拒绝；需等结束后再应用或手动 `/reload` —— node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js:1488；dist/modes/interactive/interactive-mode.js:1521, 5300（Codex 核对）
- 会话 ID 用途未补：`pi --session` 按会话 ID **前缀**匹配，末尾 8 位不能直接用来打开会话 —— node_modules/@earendil-works/pi-coding-agent/dist/main.js:204, 210；docs/cli.md:90-91

- 应用后：配色换成所选（palette、palettePreset → custom），density → compact，separator → round；其他设置不变 —— statusline-style-picker.ts:220-233；tests/statusline-style-picker.test.mjs:57-61
- 文件在 agent 目录（默认 `~/.pi/agent/`，`PI_CODING_AGENT_DIR` 可改） —— statusline-style-picker.ts:218-219；config.js:438, 453-459
- 写完后自动重载 —— statusline-style-picker.ts:309-312；tests/statusline-style-picker.test.mjs:62
- 写入失败时提示「应用失败」，不重载 —— statusline-style-picker.ts:309-318
