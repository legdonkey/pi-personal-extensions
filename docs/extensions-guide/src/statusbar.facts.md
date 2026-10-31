# statusbar 章节事实清单

路径省略前缀 `extensions/`。`types.d.ts` 指 `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`，`session-manager.js` 指同包的 `dist/core/session-manager.js`；这两个文件只用来解释 Pi 自身的行为。

## 功能名

- 一项功能：ID `statusline`，label「状态栏：额度、会话 ID 与配色」，源码 `extensions/statusline.ts`，一个开关 —— pi-personal-extensions.ts:30-35
- 迁移：旧开关 `substatusline`、`statusline-style-picker` 仍做布尔校验；新键缺失时，两个旧键都为 false 才关闭，否则开启 —— pi-personal-extensions.ts:106-113, 118-120
- 配色生效需要另行启用 `npm:@narumitw/pi-statusline` 包 —— README.md:92；pi-personal-extensions.ts:33

## 额度：什么时候刷新（fig-statusbar-1）

- 状态栏写两项：状态键 `usage`（额度）和 `session-id` —— statusline.ts:9-10, 34-37, 108
- 会话 ID 只显示末尾 8 位（`shortSessionId = id.slice(-8)`） —— statusline.ts:31, 33-38
- 会话 ID 在 session_start 和 session_tree 时写入 —— statusline.ts:131, 139
- Pi 默认用 uuidv7 生成会话 ID（也允许调用方指定其他 ID），开头是毫秒时间戳，相近时间新建的会话开头相同，所以取末尾 —— session-manager.js:12-14, 691-695；node_modules/@earendil-works/pi-ai/dist/utils/uuid.js:28-31；statusline.ts:30
- 会话开始（session_start）、树导航（session_tree）时立即强制刷新，并重启定时器 —— statusline.ts:128-142
- session_tree 是「会话树导航之后」触发的事件 —— types.d.ts:641-642
- 切换模型（model_select）时取消未完成的请求，并立即强制刷新 —— statusline.ts:144-150
- 定时器每 5 分钟强制刷新一次 —— statusline.ts:11, 120-126
- agent_settled 时刷新，不强制 —— statusline.ts:152-155
- agent_settled 表示 agent 一次运行完全结束 —— types.d.ts:767-769
- 非强制刷新距上次刷新**开始**少于 30 秒时跳过；强制刷新不检查冷却，但也会更新「上次刷新开始」的时间 —— statusline.ts:12, 80-86
- 会话关闭时停止定时器、取消请求、清空两项状态 —— statusline.ts:157-166
- 图 1 状态栏片段 `7c3e9a41 • weekly 88% left` 是示例值，图上已标注
- 时间线上的具体时刻（0:20、2:00、3:10、3:30）是示例，图注已标注

## 一次刷新（fig-statusbar-2）

- 额度窗口 = 按时间段统计的限额（5 小时、周） —— statusline.ts:313-314, 371-375
- 缺少所需窗口时抛错，与请求失败走同一分支（保留上次成功值） —— statusline.ts:287, 315, 109-114

- 只支持 `openai-codex` 和 `zai-coding-cn` —— statusline.ts:14-16
- 当前服务商不在支持列表里时，额度状态为空 —— statusline.ts:65-68
- 凭据通过 `pi auth` 读取：Codex 用 `print-bearer-token --provider openai-codex --min-expiry 5m`，智谱用 `print-api-key --provider zai-coding-cn` —— statusline.ts:264-271, 296-301, 320-329
- 读凭据和请求接口各有 15 秒超时（两步分别计时，整次刷新可能超过 15 秒） —— statusline.ts:13, 324, 336-339
- Codex 接口 `https://chatgpt.com/backend-api/wham/usage`，带 `Bearer` 令牌；能解析出账号 ID 时加 `ChatGPT-Account-ID` —— statusline.ts:272-285, 346-360
- 智谱接口 `https://open.bigmodel.cn/api/monitor/usage/quota/limit`，`Authorization` 直接放 API Key，不加 Bearer —— statusline.ts:302-311
- Codex 取 `rate_limit`、`additional_rate_limits` 中 `primary_window`/`secondary_window` 里第一个长度 6～8 天的窗口，显示 `weekly N% left` —— statusline.ts:287-289, 362-385
- 智谱只读 `TOKENS_LIMIT`、`CREDIT_LIMIT`；`unit 3/number 5` 为 5 小时，`unit 6/number 1` 为周；缺一个就算失败；显示 `5h N% left · weekly N% left` —— statusline.ts:312-317, 387-411
- 剩余 = 100 − 已用百分比，限制在 0～100，四舍五入 —— statusline.ts:413-418
- 请求失败时保留该服务商上次成功的结果；没有缓存时状态为空 —— statusline.ts:109-114
- 图中 `weekly 63% left`、`5h 82% left · weekly 47% left` 是示例值，图头已标注

## 换配色：选择器（fig-statusbar-3 录屏）

- 功能注册的 `statusline-style` 处理函数只进 `/personal` 的 commands 表，不再注册成斜杠命令；入口是 `/personal` →「状态栏：额度、会话 ID 与配色」 —— pi-personal-extensions.ts:129-134, 31-32；statusline.ts:168-169
- 状态栏二级菜单只提供「选择 pi-statusline 自定义配色」和功能启停 —— tests/personal.test.mjs「统一菜单覆盖全部功能和设置」
- 不带参数时打开选择器：上下键切换（循环）并实时预览，Enter 应用，Esc 取消 —— statusline.ts:182-237
- TUI 显示实时预览，带 UI 的 RPC 使用普通列表；取消不保存，无效值不写配置，无 UI 时提示 —— tests/statusline.test.mjs「迁入的风格选择器保留 11 套配色、预览、配置和重载行为」
- 选择前告知需启用 pi-statusline、不改变 Pi 主题；应用会覆盖自定义配色，设置 compact 密度和 round 分隔符；RPC 支持选择、取消和无效值校验 —— tests/statusline.test.mjs「迁入的风格选择器保留 11 套配色、预览、配置和重载行为」；tests/personal.test.mjs「RPC 从统一配色选择器应用全部 11 套自定义配色，无需 custom」
- 新录屏底部状态栏显示会话 ID 末尾 8 位；其中 ponytail 是本机另一个扩展，extensions/ 下没有相关代码 —— media/statusline-style.png
- 录屏画面（video 的 data-cue 挂在 beat 第一句 statusbar-08）：打开配色选择器，上下移动预览，Esc 退出（录屏：/personal → 状态栏：额度、会话 ID 与配色 → 选择 pi-statusline 自定义配色） —— docs/extensions-usage/tapes/statusline-style.tape:15-33（技术版共用使用者版的录屏）；statusline.ts:226-231, 237

## 11 套配色怎么分组（fig-statusbar-4）

- 每套 6 组前景色/背景色；色值照抄 STYLES —— statusline.ts:435-568, 669-670
- 13 个字段分 6 组：brand/provider/model、thinking/tools、cwd、branch、context/tokens/cost、cache/time/turn —— statusline.ts:570-593, 671-672
- 预览标签 `M sol`、`T high`、`D pi`、`G main`、`C 42%`、`K 76%` —— statusline.ts:603
- 宽度小于 68 列时预览拆成两行 —— statusline.ts:619-626, 673-676
- 每行按终端宽度截断 —— statusline.ts:222；tests/statusline.test.mjs:44-50

## 应用配色时写什么（fig-statusbar-5）

- 文件写到 `getAgentDir()/pi-statusline.json`，与 pi-statusline 读取的位置一致 —— statusline.ts:642-643
- `getAgentDir()` 默认 `~/.pi/agent`，设置 `PI_CODING_AGENT_DIR` 时用该目录 —— node_modules/@earendil-works/pi-coding-agent/dist/config.js:433, 438, 453-459
- 读出原文件，展开原有顶层字段，再覆盖 `palettePreset: "custom"`、`palette`（整个对象替换为 13 字段配色）、`density: "compact"`、`separator: "round"` —— statusline.ts:644-657；tests/statusline.test.mjs:64-68
- 文件不存在（ENOENT）时从空对象开始；其他读取错误或 JSON 解析错误抛出，算作失败 —— statusline.ts:644-649
- 先写 `.tmp`（权限 0600），再 rename 替换正式文件（页面只一句带过，说「同第 2 章」） —— statusline.ts:658-663
- 写完后自动重载（`ctx.reload()`） —— statusline.ts:247-250；tests/statusline.test.mjs:69
- 写文件失败时提示「应用失败：<原因>」，不执行重载 —— statusline.ts:247-256
- 图中原文件的字段是示例，图注已标注
