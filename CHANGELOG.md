# 更新记录

本项目遵循语义化版本号。

## 未发布

- 删除「原视频审查」功能：移除 `understand_video` 工具、`/personal → 原视频审查` 菜单项、对应源码、测试和两份讲解页的章节，功能数从六项减为五项。替代方案是 legdonkey-plugins 里的 `gemini-video` 技能。旧 `personal-extensions.json` 中的 `understand-video` 键仍可读取并检查是否为布尔值，但不再生效，下次保存功能开关时不再写入。重录 `/personal` 菜单相关录屏。

- 将会话标题合入状态栏，删除独立 session-title 扩展，顶层功能由七项减为六项；标题通过 setStatus 显示，不再占输入框下方独立一行，也不接管 footer。新增第五项独立开关 sessionTitleEnabled，新项优先，缺失时沿用旧 session-title 布尔项；保留旧关闭意图、格式校验和旧文件。

- 状态栏新增「独立功能开关」：分别持久控制服务商额度、会话 ID、token 速度、pi-statusline 配色选择器和会话标题；没有旧设置时默认全开，标题兼容默认规则见上条；顶层 statusline 仍为总开关。配置保存于 personal-statusline.json，格式或存储失败不覆盖原配置、不应用变更。额度关闭清值、取消查询并停轮询，开启强制刷新；ID 即时清除或显示；速度关闭清计时，开启从下次请求生效；禁用配色选择器不回滚第三方已保存配色。补齐隔离测试、说明与受影响录屏。审查后补齐第五项开关、配置默认规则与总览图，重录无凭据可复现的路径设置、分类器状态和分类模型选择菜单。

- 状态栏新增单次回复结束后的 token 速度、等待和输出耗时，通过 `ctx.ui.setStatus` 显示，不替换 footer，可在独立功能开关中启停。按最终 `usage.output` / 首个内容块事件至回复结束的秒数计算，包含提供方计入的隐藏推理和尾部用量等待，不按字符估算，也不宣称纯正文或服务端解码速度；失败、取消或缺少有效统计时不显示，工具续调单独计时。新增 `/personal → 状态栏：额度、会话 ID 与配色 → 查看 token 速度口径`，更新测试与两份讲解页。

## 0.6.0 - 2026-11-07

- 原视频审查的 MP4 文件上限从 20 MiB 提高到 50 MiB，父子进程校验、工具说明、菜单提示与两份讲解页同步更新；120 秒超时及其他安全限制不变。补充大小边界回归测试，不代表已验证上游服务能接受 50 MiB。

- 原位思考强度新增 d1-ultra → Jev 自动回退：d1-ultra 超时、报错、无效或低置信度时，本次改用 Jev；仅超时、报错和无效结果发 warning，显示白名单归类的安全原因与「正在切换」，有效结果的概率低于 0.5 不发 warning；成功后提示实际档位，状态栏与可恢复决策标注回退来源。每个模型独立限时 15 秒，最多约 30 秒；最终无可采用结果才沿用原档位，仅列出实际错误；全部为低置信度时静默沿用。补充零概率、0.5 边界、非法概率及混合回退回归测试。取消不回退，不改全局选择、主模型、基线或旧决策，下一条新消息仍先尝试 d1-ultra。状态查看和固定样例测试同步展示策略与实际结果，补充 HTTP 429、超时、取消、恢复、三种主模型接入与凭据脱敏回归测试，并同步两份讲解页。
- `understand_video` 在工具结果 `details` 中补充调用与用量元数据：透传 `bytes`、`provider`、`model`（逻辑模型名，非已确认服务端路由）、`inputMode`（`native-video/mp4`）与 `durationMs`（从 `execute` 进入计时到结果格式化，包含主进程文件校验、worker 启动、模型调用与等待子进程关闭）。`usage` 按数值白名单只保留有限非负数且缺失字段不补零，附带 `usageSource: "provider-normalized"`，有 `cost` 时附带 `costSource: "local-estimate"`；`cost` 是本地估算而非账单，底层可能将未返回统计归一化为零，零值不代表免费。用量仅放在 `details` 中，未设置工具顶层 `usage`，不汇入 Pi 会话用量统计，也不查询额外账户额度。区分 `stopReason` 与 `outputTruncated` 两种独立状态，`length` 和本地 32 KiB 截断均在正文附加警告，调用成功不保证输出完整。错误 `details` 只返回安全的 `errorCode` 与 `failurePhase`，不转发原始错误或猜测登录、额度原因。无新增 UI、菜单或配置；此次新增元数据仅由离线 fake SDK 测试验证。
- 修复 `understand_video` 的 IPC 序列化边界：`MAX_RESULT_BYTES` 设为 `6 * 32 * 1024 + 8 * 1024`（200 KiB），容纳 32 KiB 正文 JSON 最坏六倍转义与 8 KiB 元数据；保留完整序列化包上限检查，并独立校验正文不超过 32 KiB、元数据（`JSON.stringify({ ...result, text: "" })`）不超过 8 KiB，不放宽正文上限。新增回归测试覆盖引号、反斜杠和控制字符在 32 KiB 边界下的转义返回，以及超限正文与元数据的拒绝。

## 0.5.0 - 2026-11-05

- 新增第七项功能「原视频审查」：统一入口注册 `understand_video`，通过 `/personal → 原视频审查 → 查看通路与限制` 管理。独立 worker 使用现有 SDK OAuth 与正常 Argon 路由发送真实 `video/mp4`，不覆写主宿主 `fetch`、不修改核心或第三方包。仅允许工作目录内非隐藏、无符号/硬链接的 MP4（24 bytes–20 MiB），父子双检和摘要比对，120 秒超时/取消清理，正文最多 32 KiB，失败不回退、不暴露鉴权和原始 provider 错误。统一入口和 `video-reviewer` 的真实工具调用均正确识别三秒红蓝绿测试视频；音轨未可靠验证，长视频和快速转场不保证覆盖。角色新增工具白名单，实测后台子代理可继承扩展，已移除冗余的 child-only 加载路径；其他权限和模型不变。新增隔离进程、安全边界、异常、空响应、取消及菜单回归测试，并更新两份讲解页。

- 调整 `inline-effort` 五档判据：按推理结构区分常规档位，将 `max` 收紧为例外攻坚；近期对话只补全同一任务要求，不继承旧难度；`high` 仅在无法识别任务要求时保守兜底。不按主题、精美成片、代理数量、敏感操作或反复报错自动提档，不以思考强度替代模型专长、授权与实测。历史决策、输入范围和档位映射保持不变，补充两种分类器共用提示契约的离线测试。

- 状态栏额度新增 Antigravity 支持：需先启用 `pi-antigravity`，通过 `ctx.modelRegistry.getApiKeyForProvider('antigravity')` 获取当前 provider 的 JSON 凭据，POST Google `fetchAvailableModels`，固定官方 endpoint 依次回退，总网络超时 15 秒。扩展按当前模型精确 ID 或运行变体后缀匹配；`gemini-3.1-pro` 兼容 `gemini-pro-agent`，`gemini-3.5-flash` 兼容 `gemini-3-flash-agent`。只接受有限数值 `remainingFraction`，约束到 0～1，多个同模型变体取最低值，显示如 `quota 60% left`。该值是当前模型在服务端对应的配额，可能使用共享池，不是独立的 5 小时或周窗口，也不是 token 计数。找不到配额或查询失败时隐藏 Antigravity 旧值，其他 provider 保留缓存；每次刷新重新解析当前账号凭据，账号变化在下一刷新生效，不主动监听账号切换；模型切换强制查询，不显示旧模型缓存。刷新时机和冷却不变。
- 新增 2 项 Antigravity 回归测试，覆盖模型与变体匹配、别名、配额校验、当前 provider 凭据、模型和账号切换、失败隐藏旧值及刷新冷却；`npm run check` 当前 67/67 通过。

## 0.4.0 - 2026-11-03

- 原位思考强度新增 Antigravity 分支：provider 为 `antigravity`，接口为 `antigravity-api`，模型 ID 精确等于 `claude-opus-5-5` 或 `claude-sonnet-5-5`，thinking 仍须不为 `off`。需先安装并启用带 legacy `streamSimple` 注册的 `pi-antigravity`；本机使用 0.11.0。扩展在 `context_with_system` 分类后临时包装插件原生 `streamSimple`，保留 `oauth`、`headers`、`images` 和 `refreshModels`，注册和恢复时携带 `provider.getAllModels` 当前动态目录（含 chat、image、classifier），并按 `type + id` 补回 registered model 的 `headers`。扩展只修改匹配当前 `sessionId`、末条消息 `timestamp` 和模型的主请求 `options.reasoning`，交给插件按 `-low`、`-medium`、`-high` runtime ID 路由。`max` 和 `xhigh` 夹到 `high`；会话 thinking 和历史上下文不变。`message_end` 保存实际 `providerThinkingLevel`；工具续调、重试和恢复沿用原决策；`maxTokens: 1` 预热及辅助 session 不干预；`session_shutdown` 只恢复原 `streamSimple`，保留第三方后来对 `headers` 等字段的部分更新，也不覆盖第三方替换的新流。原 GPT-6 Codex 和 Anthropic 协议分支保留，Antigravity 不使用 Anthropic 消息级 `output_config`。
- 新增 4 项 Antigravity 回归测试，覆盖两个精确模型 ID、原生流包装与配置保留、动态目录刷新、图片模型、模型级头部、第三方部分注册、档位钳制、请求匹配、工具续调与恢复、实际档位保存、预热与辅助请求、重试、取消和退出恢复。`npm run check` 当前 65/65 通过；本机 Pi 1.5.0 临时副本的 inline-effort 测试 32/32 通过。

## 0.3.0 - 2026-11-03

- 原位思考强度新增 Claude 支持：仅限 `anthropic-messages` 接口、`compat.supportsMidConvoEffort === true`，且模型 ID 精确等于 `claude-opus-5`、`claude-opus-5-5` 或 `claude-sonnet-5-5`；thinking 仍须不为 `off`。扩展只修改 Pi 已生成的末尾空 `system` 消息中的 `output_config.effort`，并在 `message_end` 保存实际 `providerThinkingLevel` 供历史重放；顶层 `output_config`、`thinking`、历史消息和主会话 thinking 基线不变。保留原有 GPT-6 Codex 支持，分类、取消、超时、配置和隐私行为不变。
- 新增 Claude 真实 Pi 序列化测试，在 `onPayload` 截断且不发远端请求；覆盖历史前缀、恢复、工具续调、thinking block 不变、无效请求形状、取消、清理、内部重试、流式切模型和缓存预热回放。`npm run check` 的 61 项测试全部通过；Pi 1.5.0 临时副本的 inline-effort 测试 28/28 通过。

- 状态栏额度新增 `kimi-coding` 支持：通过 Kimi Code 订阅的 `GET https://api.kimi.com/coding/v1/usages` 查询，显示 5 小时窗口剩余量；老套餐附周额度（`limit_7d`），新套餐附月度额度（`limit_month_code`，缺失时回退 `limit_month_total`）。

- 配色菜单合并为「选择 pi-statusline 自定义配色」：移除 11 个重复直达项，TUI 预览、RPC 普通列表共用一个入口。选择页说明需要启用 pi-statusline、会覆盖自定义配色并设置紧凑布局和圆角分隔符，不改变 Pi 主题。

- `/personal` 支持 Esc 逐级返回，保存设置或查看状态后留在二级菜单；启停功能和应用配色仍退出并重载。从一级菜单进入批量开关后取消会返回一级；直接执行 `/personal switches` 则退出。

- 移除分类模型菜单中重复的「使用 Jev」「使用 d1-ultra」快捷项，统一通过「选择分类模型」切换；保留状态查看和可用性测试。

## 0.2.0 - 2026-11-01

- 按「一个功能一个文件」重构：命名配置并入 `auto-session-name.ts`；额度、会话 ID 与配色选择合并到 `statusline.ts`，使用 `statusline` 开关；思考强度模块及测试改名为 `inline-effort`。功能总数从七项变为六项，仍只向 Pi 注册 `/personal`。
- 状态栏一级菜单合并为「状态栏：额度、会话 ID 与配色」；二级菜单保留配色预览和全部 11 个应用配色入口，统一启停。
- 兼容旧功能开关：两个状态栏旧键缺省时按开启处理，仅两者都为 `false` 才关闭；`jev-inline-effort` 映射到 `inline-effort`。新键优先，旧键保留布尔校验，保存只写新键，读取不改写文件。
- 分类配置改用 `inline-effort.json`；新文件缺失时读取 `jev-inline-effort.json`，保存只写新文件并保留旧文件。思考决策条目类型、自动命名会话状态键和状态栏键保持原值，兼容历史会话。
- 补充旧开关全部布尔组合、新键优先、旧配置文件读取与保留、旧会话决策恢复及合并状态栏测试；配置读写测试均使用 `PI_CODING_AGENT_DIR` 临时目录。
- 状态栏会话 ID 改为显示末尾 8 位：UUIDv7 前 7 位是时间戳，约 17 分钟内新建的会话前缀相同，无法区分。
- 路径链接配置和配色选择器改用 `getAgentDir()`，跟随 `PI_CODING_AGENT_DIR`；配色选择器不再读取 `PI_AGENT_DIR`，与 pi-statusline 读取的位置一致。
- `/personal` 成为唯一斜杠命令，统一管理所有功能的启停和设置；原快捷命令仅保留为内部处理器。新增 Jev、d1-ultra 分类模型及 11 套配色的直达菜单，提示及文档统一改用菜单路径。
- `/personal` 支持有 UI 的 RPC 客户端；无 UI 时提示并返回。批量开关仍需 TUI，RPC 中提示从各功能菜单逐项启停。增加唯一命令注册、菜单操作、RPC 配色应用和无 UI 测试。
- 停止维护 Pi 版 Impeccable，移除 `packages/` 中的独立包、技能快照、同步脚本及测试；主扩展合集不受影响。
- 原位思考强度新增可选 d1-ultra 分类器，移除 Elephant 选项，保留默认 Jev；通过 `/personal → 原位思考强度（Jev / d1-ultra）` 查看、选择并持久化分类模型，用固定公开样例测试可用性。复用 Pi 的 OpenRouter classifier、认证及代理配置，不改变主模型或历史决策，不配置付费回退。
- 补充分类配置、切换、取消、超时、低置信度、无效输入及原生 HTTP 管线测试。d1-ultra 已通过 Pi 原生 classifier 真实连通验证；明确输入费用及旧 Elephant 配置的修复方式。
- 新增 Jev 原位思考强度：主会话和子代理的物理 GPT-6 Codex 模型按每条用户消息分类，通过 `configuration_update` 调整强度，顶层 effort 不变以保留 prompt cache；决策跟随会话分支，压缩后自动承接，状态栏显示实际强度；接入 `/personal` 独立开关。
- 移除 `terminal-title` 模块及功能开关，终端标题交由 Pi 或 Orca 管理；保留自动会话命名和右下角标题显示，兼容旧配置。
- 新增自动会话命名：每轮结束后用独立模型后台评估最近五轮对话，支持稳定标题、手动名称保护、预览及会话级暂停/恢复；接入 `/personal` 独立开关。
- 新增命名模型及思考强度选择器，候选来自已认证的 scoped-models，默认 `gpt-5.6-luna`；思考默认继承 Pi 逐模型配置，未配置时回退 `low`，支持独立覆盖和全局保存。
- 增加命名上下文筛选、输出校验、重载恢复、异步取消、超时、配置保存、思考继承和模型筛选测试。

- 新增右下角会话标题，支持改名同步、窄窗口省略及独立开关，不覆盖原有状态栏。
- 统一为一个扩展入口，通过 `/personal` 保存六项功能开关并自动重载。
- 加入用户消息橙色线框，保留原有底色和文字样式。
- 状态栏保留 11 套配色，通过 `/personal → 状态栏：额度、会话 ID 与配色 → 预览并选择配色` 进入，并限制窄窗口预览宽度。
- 增加功能筛选、配置保存、风格选择和消息边框测试。

## 0.1.0

- 将 `provider-usage` 和 `clickable-paths` 整理为一个 Pi Package。
- 增加本地开发、类型检查和版本管理基础配置。
