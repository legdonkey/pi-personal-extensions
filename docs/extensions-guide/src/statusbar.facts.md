# statusbar 章节事实清单

## 功能与统计口径

- `statusline` 保持总开关，另有五个独立开关，label 不变；actions 提供「选择 pi-statusline 自定义配色」「查看 token 速度口径」「独立功能开关」，配色仍是第一项；内部处理器只进入 commands 表，唯一公开命令为 `/personal` —— extensions/pi-personal-extensions.ts:24-29、88-92、132-145；tests/personal.test.mjs「统一菜单覆盖全部功能和设置」。
- 旧状态栏开关继续校验；只有新键缺失且两个旧键都为 false 时关闭 —— extensions/pi-personal-extensions.ts:111-128。
- 会话 ID 取末 8 位；额度沿用 `usage`、ID 沿用 `session-id`，速度新增 `personal-token-speed`，均使用 setStatus，不调用 setFooter —— extensions/statusline.ts:12-23、37-44、112-116、132-140、243-271；tests/statusline.test.mjs「token 速度用最终 output 除以内容流时间，等待单列，工具续调逐次重算且不替换 footer」。
- 速度只在助手 message_end 后显示：最终 usage.output / 首个 message_update 至 message_end 的本地单调时钟秒数，保留 1 位小数；等待是 turn_start 至首个内容块事件；没有字符计数或实时 token 计数 —— extensions/statusline.ts:243-271；tests/statusline.test.mjs:317-359。
- text、thinking、toolcall 的 start/delta/end 都由 Pi 转发为 message_update，块开始事件不是精确首 token；durationMs 是请求总耗时，包含等待，不能直接作分母 —— Pi 1.5.0 安装包 `pi-agent-core/dist/agent-loop.js:284-325`、`pi-ai/dist/types.d.ts:398-406`、`pi-ai/dist/utils/event-stream.js:82-123`（位于 `/Users/yangguandao/.pi/agent/install/releases/1.5.0/node_modules/@earendil-works/`）。
- Pi Usage.reasoning 是 output 的子集，output 已含提供方计入的隐藏推理；输出时间含流传输、扩展处理和尾部用量等待，不是纯正文或服务端解码速度，隐藏推理不发事件时无法还原真实过程 —— Pi 1.5.0 `pi-ai/dist/types.d.ts:285-296`；extensions/statusline.ts:341-346；README.md「token 速度口径」。
- 工具续调每次单算，不含工具执行时间；下一 turn_start 清空；失败、取消、deferred、无内容、无正 output 或无正时长不显示；模型/会话/树导航/关闭后清空，不恢复历史速度，所有 provider 均可统计 —— extensions/statusline.ts:207-290；tests/statusline.test.mjs:317-399。
- 速度不额外请求模型、可从「独立功能开关」启停、无需第三方 footer；第三方 footer 是否显示取决于它是否渲染扩展状态 —— extensions/statusline.ts:243-271、341-346；README.md「token 速度口径」；Pi 1.5.0 `pi-coding-agent/examples/extensions/custom-footer.ts:1-7`。
- 50.0 tok/s、等待 3.0 秒、输出 2.0 秒均为示例，不是线上 benchmark —— tests/statusline.test.mjs:317-359；两版 statusbar-16 明示「示例」。

## 额度与生命周期

- 支持 Codex 周窗口（6～8 天）、智谱 5 小时+周、Kimi 5 小时+周（老套餐）或月（新套餐，优先 limit_month_code，缺失取 limit_month_total）；剩余 100 − 已用，限制 0～100 后取整 —— extensions/statusline.ts:507-606、651-707；tests/statusline.test.mjs「kimi-coding 新套餐显示 5 小时和月度额度」「kimi-coding 老套餐显示 5 小时和周额度」。
- Antigravity 只匹配当前模型/运行变体及指定别名，跳过 internal，多个变体取最低有限 remainingFraction，约束到 0～1；quota 是可能共享的模型配额，不是 5 小时/周窗口或 token 数 —— extensions/statusline.ts:445-463；tests/statusline.test.mjs「Antigravity 仅显示当前模型额度，兼容变体和 Pro 别名并校验响应」。
- Antigravity 通过当前 provider 获取 JSON 凭据，POST 三个固定官方 endpoint 的 fetchAvailableModels，所有回退共用 15 秒网络超时；需启用 pi-antigravity —— extensions/statusline.ts:465-505；README.md「路径链接与状态栏」。
- Codex、智谱、Kimi 通过 pi auth 读凭据；读凭据和网络请求各限 15 秒；接口分别为 chatgpt.com/backend-api/wham/usage、open.bigmodel.cn/api/monitor/usage/quota/limit、api.kimi.com/coding/v1/usages —— extensions/statusline.ts:507-598、608-633。
- 会话开始、树导航、切换模型强制查询；5 分钟定时；agent_settled 非强制刷新，距上次开始不足 30 秒跳过；关闭停止定时器并取消查询 —— extensions/statusline.ts:16-18、142-164、198-241、273-290。
- 前三个 provider 失败保留各自缓存；Antigravity 每次刷新先清空、重新解析账号凭据，失败或缺配额隐藏旧值；不主动监听账号切换 —— extensions/statusline.ts:132-140、155-159、176-192、233-240、470-477；tests/statusline.test.mjs「Antigravity 从当前 provider 获取凭据，切换模型和账号不复用旧额度」。
- 图中的会话 ID、额度百分比及时间线时刻都是示例，图注已标明 —— 两版 statusbar 第一个图的 title/desc/figcaption。

## 配色、录屏与保存

- 仅配色需要另装启用 npm:@narumitw/pi-statusline，不改变 Pi 主题；TUI 实时预览、RPC 普通列表，取消不写，无效值不写；应用后自动重载，失败提示且不重载 —— extensions/statusline.ts:348-442；tests/statusline.test.mjs「迁入的风格选择器保留 11 套配色、预览、配置和重载行为」。
- 11 套配色、每套 6 组前景/背景，13 个字段按组共享；预览标签 M sol、T high、D pi、G main、C 42%、K 76%；68 列以下拆两行，并按宽度截断 —— extensions/statusline.ts:396-406、724-927；tests/statusline.test.mjs:25-114。
- applyStyle 用 getAgentDir()/pi-statusline.json：保留其他顶层项，整体覆盖 palettePreset/custom、palette、density/compact、separator/round；不存在从空对象写，其他读错不覆盖；临时文件 0600 后 rename —— extensions/statusline.ts:930-953；tests/statusline.test.mjs:25-114。
- 因菜单新增口径项和功能说明变化，重新录制 statusline-style 与 personal-switches；全新临时 agent，仅显式加载本仓库与 pi-statusline，无凭据、不发模型消息；直接运行 Pi 1.5.0 安装目录中的 pi。配色录屏先查看五项独立开关并取消，再预览配色、Esc 不应用，底部无速度值（没有请求模型） —— docs/extensions-usage/media/statusline-style.mp4、personal-switches.mp4；对应 tapes；tests/personal.test.mjs「统一菜单覆盖全部功能和设置」。

## 五项独立开关

- 面板路径 `/personal → 状态栏：额度、会话 ID 与配色 → 独立功能开关`；列五项当前值后选择开启/关闭，TUI 与 RPC 都用 select；取消或非法选择不保存 —— extensions/pi-personal-extensions.ts:88-92；extensions/statusline.ts:292-338；tests/statusline.test.mjs「四项开关保持可管理，配色禁用不回滚第三方配置，取消及损坏配置不写入」。
- getAgentDir()/personal-statusline.json 保存 usageEnabled、sessionIdEnabled、tokenSpeedEnabled、styleEnabled、sessionTitleEnabled；前四项缺失时默认 true，sessionTitleEnabled 缺失时沿用旧 session-title，两者都缺失才默认 true，已存在的新旧字段必须布尔；非对象、坏 JSON、读取失败报错，启动配置无效会中止本次加载，不改文件 —— extensions/statusline.ts:47-94；tests/statusline.test.mjs「四项开关保持可管理，配色禁用不回滚第三方配置，取消及损坏配置不写入」。
- 保存前重读校验，保留未知项，临时文件 wx/0600 后 rename；写入或 rename 失败不覆盖原配置、不改变运行时值；不写 pi-statusline.json —— extensions/statusline.ts:304-338；tests/statusline.test.mjs「独立开关写入或 rename 失败时不覆盖配置、不应用运行时变更」。
- 额度关闭清 usage、停定时器、取消查询且迟到结果无效；开启强制刷新绕过冷却；凭据子进程也收到取消信号 —— extensions/statusline.ts:132-153、199-205、338-338、608-618；tests/statusline.test.mjs「独立额度开关持久化：关闭清 usage、取消查询并停轮询，迟到结果无效，开启强制刷新且保留其他状态」「关闭额度也向读取凭据的子进程传递取消信号」。
- ID 关闭即清 session-id，开启即显示；速度关闭清值和计时，开启从下一 turn_start 生效，不接续半途响应 —— extensions/statusline.ts:40-45、243-271、338-338；tests/statusline.test.mjs「ID 与 token 速度独立启停：立即清值，ID 开启即显示，速度开启从下个 turn_start 计时」。
- 配色禁用只阻止本包选择器，不回滚第三方已保存配色，独立开关面板仍可使用 —— extensions/statusline.ts:292-339、361-365；tests/statusline.test.mjs「四项开关保持可管理，配色禁用不回滚第三方配置，取消及损坏配置不写入」。
- 顶层 statusline 总开关及旧配置映射不变；关闭总开关不删独立配置，重开仍读取它；设置只即时改变当前会话，其他会话重载后读取 —— extensions/pi-personal-extensions.ts:110-143；extensions/statusline.ts:92-94、338-338；tests/personal.test.mjs「状态栏总开关保留独立设置，旧总开关兼容规则不变」。

- 会话标题合入 statusline，第五项独立开关 sessionTitleEnabled，新项优先、缺失沿用旧 session-title，空名仍显示未命名会话 —— tests/session-title.test.mjs；README.md「会话标题合并迁移」。

- 本轮重录 personal-menu、personal-switches、statusline-style，后者包含第五项标题开关及状态栏标题；其他认证/聊天录屏保留历史画面并在紧邻图注中标明标题位置已变化，不伪造模型调用 —— docs/extensions-usage/tapes/；两版页面可见历史录屏图注。
