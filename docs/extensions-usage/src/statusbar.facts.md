# statusbar（使用者版）事实清单

路径省略前缀 `extensions/`。`cli.md` 指 `node_modules/@earendil-works/pi-coding-agent/docs/cli.md`，`config.js` 指同包的 `dist/config.js`。

## 看懂额度和会话 ID（fig-statusbar-1）

- 一项功能、一个开关：label「状态栏：额度、会话 ID 与配色」 —— pi-personal-extensions.ts:30-35
- 升级时两个旧开关合成一个：只有两个旧开关都为 false 才关闭，否则开启 —— pi-personal-extensions.ts:106-113, 118-120
- 状态栏显示两项：会话 ID 和服务商剩余额度 —— statusline.ts:9-10, 35-40, 120
- 会话 ID 显示末尾 8 位 —— statusline.ts:33
- openai-codex 显示 `weekly N% left`（周额度剩余） —— statusline.ts:364-367
- zai-coding-cn 显示 `5h N% left · weekly N% left`（5 小时、周额度剩余） —— statusline.ts:390-395
- kimi-coding 显示 `5h N% left`，老套餐附 `weekly N% left`（limit_7d），新套餐附 `monthly N% left`（limit_month_code，缺失回退 limit_month_total）；真实订阅响应已验证 —— statusline.ts:398-436；tests/statusline.test.mjs「kimi-coding 新套餐显示 5 小时和月度额度」「kimi-coding 老套餐显示 5 小时和周额度」
- antigravity 显示当前模型配额 `quota N% left`，例如 `quota 60% left`；只接受有限数值 `remainingFraction`，约束到 0～1，多个同模型变体取最低值 —— statusline.ts:278-294；tests/statusline.test.mjs:146-161
- Antigravity 配额可能使用共享池，不是独立的 5 小时或周窗口，也不是 token 计数 —— statusline.ts:278-294；tests/statusline.test.mjs:146-154
- Codex、智谱和 Kimi 的 N 是剩余百分比（100 − 已用，取整） —— statusline.ts:533-538
- 图中 `a1b2c3d4`、63%、82%、47%、86%、99%、60% 是示例值，图注已标注；原图注「位置由状态栏决定」无法从源码核实，已删

## 更新时机（只在排查第 3 步和不朗读列表里出现）

- 会话开始、会话树跳转（session_tree）、切换模型时立即发起查询（异步；其他服务商失败时保留旧值，Antigravity 隐藏旧值，所以朗读写「立即发起查询」而不是「立刻更新」） —— statusline.ts:66-73, 89-93, 121-126, 140-165
- 之后每 5 分钟查询一次（「约 5 分钟内」等到下一次更新） —— statusline.ts:11, 132-138
- Pi 回复完一轮（agent_settled）也查询；距上次查询开始不足 30 秒跳过；失败的查询同样记录开始时间 —— statusline.ts:12, 82-94, 167-170
- Antigravity 每次查询重新读取当前账号凭据；账号变化在下一刷新生效，不主动监听账号切换；切换模型强制查询，不显示旧模型缓存 —— statusline.ts:89-93, 158-165, 303-306；tests/statusline.test.mjs:163-228

## 额度为空怎么办（fig-statusbar-2）

- 只有 openai-codex、zai-coding-cn、kimi-coding、antigravity 显示额度，其他服务商时额度为空 —— statusline.ts:14-18, 66-71
- Codex、智谱和 Kimi 通过 `pi auth` 读取登录凭据；读不到时本次查询失败 —— statusline.ts:343-350, 374-379, 402-409, 440-449
- Antigravity 需先启用 pi-antigravity，并通过当前 provider 获取 JSON 凭据 —— README.md:116；statusline.ts:297-309；tests/statusline.test.mjs:163-180
- Codex、智谱和 Kimi 查询需要访问服务商的用量接口（网络），单步最多 15 秒 —— statusline.ts:13, 359-363, 379-388, 409-417, 451-463
- Antigravity POST 固定官方 endpoint 的 `fetchAvailableModels`，所有回退共用 15 秒网络超时 —— statusline.ts:310-336；tests/statusline.test.mjs:182-193
- 前三个服务商查询失败时保留上次查到的值；从没查到过就为空。Antigravity 找不到配额或查询失败时隐藏旧值 —— statusline.ts:89-93, 121-126；tests/statusline.test.mjs:163-228

## 换配色（fig-statusbar-3 录屏）

- 状态栏本体来自 `npm:@narumitw/pi-statusline`，需要另外安装启用 —— README.md:114；pi-personal-extensions.ts:33
- 安装命令格式 `pi install npm:@scope/package` —— cli.md:241
- 入口：`/personal` →「状态栏：额度、会话 ID 与配色」→「选择 pi-statusline 自定义配色」打开配色列表；上下键挑选并实时预览，Enter 应用，Esc 放弃 —— pi-personal-extensions.ts:32, 85-86；statusline.ts:198-253
- 选择前告知需启用 pi-statusline、不改变 Pi 主题；应用会覆盖自定义配色，设置 compact 密度和 round 分隔符；RPC 支持选择、取消和无效值校验 —— tests/statusline.test.mjs「迁入的风格选择器保留 11 套配色、预览、配置和重载行为」；tests/personal.test.mjs「RPC 从统一配色选择器应用全部 11 套自定义配色，无需 custom」
- 统一入口支持 TUI 预览和 RPC 普通列表，均可选择全部 11 套配色 —— tests/personal.test.mjs「RPC 从统一配色选择器应用全部 11 套自定义配色，无需 custom」
- 录屏画面（录屏：/personal → 状态栏：额度、会话 ID 与配色 → 选择 pi-statusline 自定义配色）：配色列表 01–11，上下移动时菜单内「预览」条换色，底部真实状态栏不变，Esc 不应用（预览条见 statusline.ts:235-236） —— docs/extensions-usage/tapes/statusline-style.tape；statusline.ts:242-253

## 应用后改什么（并入换配色一节；录屏下方的键帽步骤条 statusbar-07～10 一步一个 cue）

- Pi 正在回复或压缩时，扩展的 `ctx.reload()` 会被拒绝；需等结束后再应用或手动 `/reload` —— node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js:5300-5307
- 会话 ID 用途未补：`pi --session` 按会话 ID **前缀**匹配，末尾 8 位不能直接用来打开会话 —— node_modules/@earendil-works/pi-coding-agent/dist/main.js:204, 210；docs/cli.md:90-91

- 应用后：配色换成所选（palette、palettePreset → custom），density → compact，separator → round；其他设置不变 —— statusline.ts:764-777；tests/statusline.test.mjs:64-68
- 文件在 agent 目录（默认 `~/.pi/agent/`，`PI_CODING_AGENT_DIR` 可改） —— statusline.ts:762-763；config.js:438, 453-459
- 写完后自动重载 —— statusline.ts:263-266；tests/statusline.test.mjs:69
- 写入失败时提示「应用失败」，不重载 —— statusline.ts:263-272
