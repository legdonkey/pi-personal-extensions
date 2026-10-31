# statusbar 章节事实清单

路径省略前缀 `extensions/`。`types.d.ts` 指 `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`，`session-manager.js` 指同包的 `dist/core/session-manager.js`；这两个文件只用来解释 Pi 自身的行为。

## 功能名

- 功能 label：「额度与会话 ID」（substatusline）、「状态栏风格选择」（statusline-style-picker） —— pi-personal-extensions.ts:32-33, 50-51
- 配色生效需要另行启用 `npm:@narumitw/pi-statusline` 包 —— README.md:110；pi-personal-extensions.ts:52

## 额度与会话 ID：什么时候刷新（fig-statusbar-1）

- 状态栏写两项：状态键 `usage`（额度）和 `session-id` —— substatusline.ts:6-7, 31-34, 105
- 会话 ID 只显示末尾 8 位（`shortSessionId = id.slice(-8)`） —— substatusline.ts:28, 30-35
- 会话 ID 在 session_start 和 session_tree 时写入 —— substatusline.ts:128, 136
- Pi 默认用 uuidv7 生成会话 ID（也允许调用方指定其他 ID），开头是毫秒时间戳，相近时间新建的会话开头相同，所以取末尾 —— session-manager.js:12-14, 691-695；node_modules/@earendil-works/pi-ai/dist/utils/uuid.js:28-31；substatusline.ts:27
- 会话开始（session_start）、树导航（session_tree）时立即强制刷新，并重启定时器 —— substatusline.ts:125-139
- session_tree 是「会话树导航之后」触发的事件 —— types.d.ts:641-642
- 切换模型（model_select）时取消未完成的请求，并立即强制刷新 —— substatusline.ts:141-147
- 定时器每 5 分钟强制刷新一次 —— substatusline.ts:8, 117-123
- agent_settled 时刷新，不强制 —— substatusline.ts:149-152
- agent_settled 表示 agent 一次运行完全结束 —— types.d.ts:767-769
- 非强制刷新距上次刷新**开始**少于 30 秒时跳过；强制刷新不检查冷却，但也会更新「上次刷新开始」的时间 —— substatusline.ts:9, 77-83
- 会话关闭时停止定时器、取消请求、清空两项状态 —— substatusline.ts:154-163
- 图 1 状态栏片段 `7c3e9a41 • weekly 88% left` 是示例值，图上已标注
- 时间线上的具体时刻（0:20、2:00、3:10、3:30）是示例，图注已标注

## 一次刷新（fig-statusbar-2）

- 额度窗口 = 按时间段统计的限额（5 小时、周） —— substatusline.ts:218-219, 276-280
- 缺少所需窗口时抛错，与请求失败走同一分支（保留上次成功值） —— substatusline.ts:193, 220, 106-111

- 只支持 `openai-codex` 和 `zai-coding-cn` —— substatusline.ts:11-13
- 当前服务商不在支持列表里时，额度状态为空 —— substatusline.ts:62-65
- 凭据通过 `pi auth` 读取：Codex 用 `print-bearer-token --provider openai-codex --min-expiry 5m`，智谱用 `print-api-key --provider zai-coding-cn` —— substatusline.ts:169-176, 201-206, 225-234
- 读凭据和请求接口各有 15 秒超时（两步分别计时，整次刷新可能超过 15 秒） —— substatusline.ts:10, 229, 241-244
- Codex 接口 `https://chatgpt.com/backend-api/wham/usage`，带 `Bearer` 令牌；能解析出账号 ID 时加 `ChatGPT-Account-ID` —— substatusline.ts:177-190, 251-265
- 智谱接口 `https://open.bigmodel.cn/api/monitor/usage/quota/limit`，`Authorization` 直接放 API Key，不加 Bearer —— substatusline.ts:207-216
- Codex 取 `rate_limit`、`additional_rate_limits` 中 `primary_window`/`secondary_window` 里第一个长度 6～8 天的窗口，显示 `weekly N% left` —— substatusline.ts:192-194, 267-290
- 智谱只读 `TOKENS_LIMIT`、`CREDIT_LIMIT`；`unit 3/number 5` 为 5 小时，`unit 6/number 1` 为周；缺一个就算失败；显示 `5h N% left · weekly N% left` —— substatusline.ts:217-222, 292-316
- 剩余 = 100 − 已用百分比，限制在 0～100，四舍五入 —— substatusline.ts:318-323
- 请求失败时保留该服务商上次成功的结果；没有缓存时状态为空 —— substatusline.ts:106-111
- 图中 `weekly 63% left`、`5h 82% left · weekly 47% left` 是示例值，图头已标注

## 状态栏风格选择：选择器（fig-statusbar-3 录屏）

- 提供 `/statusline-style`，11 套配色 —— statusline-style-picker.ts:11-144, 243-244；tests/statusline-style-picker.test.mjs:20
- 不带参数时打开选择器：上下键切换（循环）并实时预览，Enter 应用，Esc 取消 —— statusline-style-picker.ts:257-300
- 选择器只在 TUI 模式下打开；不带参数且不在 TUI 模式时只给警告 —— statusline-style-picker.ts:258-262；tests/statusline-style-picker.test.mjs:66-67
- 带编号或名称时直接应用；名称不区分大小写、完整匹配 —— statusline-style-picker.ts:171-176, 257
- 未知风格提示「未知风格」，不写文件、不重载 —— statusline-style-picker.ts:304-307；tests/statusline-style-picker.test.mjs:63-65
- 录屏录于 shortSessionId 改动之前，底部状态栏显示前 7 位（图注已说明）；其中 ponytail 是本机另一个扩展，extensions/ 下没有相关代码 —— media/statusline-style.png
- 录屏画面（video 的 data-cue 挂在 beat 第一句 statusbar-08）：输入 `/statusline-style`，上下移动预览，Esc 退出 —— docs/extensions-guide/tapes/statusline-style.tape:13-27；statusline-style-picker.ts:289-294, 300

## 11 套配色怎么分组（fig-statusbar-4）

- 每套 6 组前景色/背景色；色值照抄 STYLES —— statusline-style-picker.ts:11-144, 326-327
- 13 个字段分 6 组：brand/provider/model、thinking/tools、cwd、branch、context/tokens/cost、cache/time/turn —— statusline-style-picker.ts:146-169, 328-329
- 预览标签 `M sol`、`T high`、`D pi`、`G main`、`C 42%`、`K 76%` —— statusline-style-picker.ts:179
- 宽度小于 68 列时预览拆成两行 —— statusline-style-picker.ts:195-202, 330-333
- 每行按终端宽度截断 —— statusline-style-picker.ts:285；tests/statusline-style-picker.test.mjs:42-48

## 应用配色时写什么（fig-statusbar-5）

- 文件写到 `getAgentDir()/pi-statusline.json`，与 pi-statusline 读取的位置一致 —— statusline-style-picker.ts:218-219
- `getAgentDir()` 默认 `~/.pi/agent`，设置 `PI_CODING_AGENT_DIR` 时用该目录 —— node_modules/@earendil-works/pi-coding-agent/dist/config.js:433, 438, 453-459
- 读出原文件，展开原有顶层字段，再覆盖 `palettePreset: "custom"`、`palette`（整个对象替换为 13 字段配色）、`density: "compact"`、`separator: "round"` —— statusline-style-picker.ts:220-233；tests/statusline-style-picker.test.mjs:57-61
- 文件不存在（ENOENT）时从空对象开始；其他读取错误或 JSON 解析错误抛出，算作失败 —— statusline-style-picker.ts:220-225
- 先写 `.tmp`（权限 0600），再 rename 替换正式文件（页面只一句带过，说「同第 2 章」） —— statusline-style-picker.ts:234-239
- 写完后自动重载（`ctx.reload()`） —— statusline-style-picker.ts:309-312；tests/statusline-style-picker.test.mjs:62
- 写文件失败时提示「应用失败：<原因>」，不执行重载 —— statusline-style-picker.ts:309-318
- 图中原文件的字段是示例，图注已标注
