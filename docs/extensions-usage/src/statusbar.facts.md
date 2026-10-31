# statusbar（使用者版）事实清单

路径省略前缀 `extensions/`。`cli.md` 指 `node_modules/@earendil-works/pi-coding-agent/docs/cli.md`，`config.js` 指同包的 `dist/config.js`。

## 看懂额度和会话 ID（fig-statusbar-1）

- 一项功能、一个开关：label「状态栏：额度、会话 ID 与配色」 —— pi-personal-extensions.ts:30-35
- 升级时两个旧开关合成一个：只有两个旧开关都为 false 才关闭，否则开启 —— pi-personal-extensions.ts:109-116, 121-123
- 状态栏显示两项：会话 ID 和服务商剩余额度 —— statusline.ts:9-10, 33-38, 108
- 会话 ID 显示末尾 8 位 —— statusline.ts:31
- openai-codex 显示 `weekly N% left`（周额度剩余） —— statusline.ts:274-276
- zai-coding-cn 显示 `5h N% left · weekly N% left`（5 小时、周额度剩余） —— statusline.ts:299-304
- N 是剩余百分比（100 − 已用，取整） —— statusline.ts:400-405
- 图中 `a1b2c3d4`、63%、82%、47% 是示例值，图注已标注；原图注「位置由状态栏决定」无法从源码核实，已删

## 更新时机（只在排查第 3 步和不朗读列表里出现）

- 会话开始、会话树跳转（session_tree）、切换模型时立即发起查询（异步；失败时保留旧值，所以朗读写「立即发起查询」而不是「立刻更新」） —— statusline.ts:128-150, 109-114
- 之后每 5 分钟查询一次（「约 5 分钟内」等到下一次更新） —— statusline.ts:11, 120-126
- Pi 回复完一轮（agent_settled）也查询；距上次查询开始不足 30 秒跳过；失败的查询同样记录开始时间 —— statusline.ts:12, 80-89, 152-155

## 额度为空怎么办（fig-statusbar-2）

- 只有 openai-codex、zai-coding-cn 显示额度，其他服务商时额度为空 —— statusline.ts:14-16, 63-68
- 额度需要读取该服务商的登录凭据（`pi auth`）；读不到时本次查询失败 —— statusline.ts:251-258, 283-288, 307-316
- 查询需要访问服务商的用量接口（网络），单步最多 15 秒 —— statusline.ts:13, 268-272, 289-298, 323-331
- 查询失败时保留上次查到的值；从没查到过就为空 —— statusline.ts:109-114

## 换配色（fig-statusbar-3 录屏）

- 状态栏本体来自 `npm:@narumitw/pi-statusline`，需要另外安装启用 —— README.md:92；pi-personal-extensions.ts:33
- 安装命令格式 `pi install npm:@scope/package` —— cli.md:241
- 入口：`/personal` →「状态栏：额度、会话 ID 与配色」→「预览并选择配色」打开配色列表；上下键挑选并实时预览，Enter 应用，Esc 放弃 —— pi-personal-extensions.ts:32, 85-86；statusline.ts:182-225
- 配色列表只在 TUI（Pi 终端界面）打开；直接应用项在其他带 UI 的客户端也能用 —— statusline.ts:183-187；pi-personal-extensions.ts:145-148
- 二级菜单 11 项「应用配色：编号. 名称」直接应用，例如「应用配色：11. Claude 暖纸」 —— pi-personal-extensions.ts:87-89；statusline.ts:544-545, 582-587
- 录屏画面（录屏：/personal → 状态栏：额度、会话 ID 与配色 → 预览并选择配色）：配色列表 01–11，上下移动时菜单内「预览」条换色，底部真实状态栏不变，Esc 不应用（预览条见 statusline.ts:207-208） —— docs/extensions-usage/tapes/statusline-style.tape；statusline.ts:214-225

## 应用后改什么（并入换配色一节；录屏下方的键帽步骤条 statusbar-07～10 一步一个 cue）

- Pi 正在回复或压缩时，扩展的 `ctx.reload()` 会被拒绝；需等结束后再应用或手动 `/reload` —— node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js:5300-5307
- 会话 ID 用途未补：`pi --session` 按会话 ID **前缀**匹配，末尾 8 位不能直接用来打开会话 —— node_modules/@earendil-works/pi-coding-agent/dist/main.js:204, 210；docs/cli.md:90-91

- 应用后：配色换成所选（palette、palettePreset → custom），density → compact，separator → round；其他设置不变 —— statusline.ts:631-644；tests/statusline.test.mjs:59-63
- 文件在 agent 目录（默认 `~/.pi/agent/`，`PI_CODING_AGENT_DIR` 可改） —— statusline.ts:629-630；config.js:438, 453-459
- 写完后自动重载 —— statusline.ts:234-237；tests/statusline.test.mjs:64
- 写入失败时提示「应用失败」，不重载 —— statusline.ts:234-243
