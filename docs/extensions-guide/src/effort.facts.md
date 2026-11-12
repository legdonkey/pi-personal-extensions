# effort 章节事实清单

路径缩写：
- `ext` = `extensions/inline-effort.ts`
- `test` = `tests/inline-effort.test.mjs`
- `entry` = `extensions/pi-personal-extensions.ts`
- `codex` = `node_modules/@earendil-works/pi-ai/dist/api/openai-codex-responses.js`
- `anthropic` = `node_modules/@earendil-works/pi-ai/dist/api/anthropic-messages.js`
- `s1` = `node_modules/@earendil-works/pi-ai/dist/api/system-one-shared.js`
- `sdk` = `node_modules/@earendil-works/pi-coding-agent/dist/core/sdk.js`
- `types` = `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
- `sm` = `node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js`
- `config` = `node_modules/@earendil-works/pi-coding-agent/dist/config.js`
- `tape` = `docs/extensions-usage/tapes/effort-status.tape`

## 头部

- 功能 ID `inline-effort`，菜单 label「原位思考强度」 —— entry:42-43
- 入口 `/personal` → 原位思考强度 → 菜单项；处理函数以 `effort` 名存进 commands 表，不注册成斜杠命令 —— ext:336；entry:43, entry:63-67, entry:128-135, entry:137
- 配置文件在 agent 目录下的 `inline-effort.json`；agent 目录默认 `~/.pi/agent/`，`PI_CODING_AGENT_DIR` 可覆盖 —— ext:45-49, ext:70；config:453-458；README.md:150-163
- 默认分类器 Jev，可选 d1-ultra、Mammoth 27B、Decider v1.2 —— ext:11-36, ext:57, ext:62

## 1. 什么时候分类（图 1）

- 「原位」：Codex 顶层 reasoning.effort 保持基线，档位作为 configuration_update 写在 input 里当前用户项之前；Anthropic 协议分支只改 Pi 已生成的末尾空 system 消息中的 output_config.effort；Antigravity 分支只改匹配请求的 options.reasoning —— ext:518-554, ext:491-516, ext:261-290
- 「适用」：主模型属于支持矩阵，且 thinking 不为 `off` —— ext:413-417

- 每条新用户消息选一个档位并记为决策 —— ext:449-481
- 工具续调和重试不再分类（已有决策的时间戳跳过；最后一条助手消息之后没有新用户消息就不分类） —— ext:449-454；README.md:105；test:150-154, test:493-499
- steer、follow-up 追加的用户消息也分类；自定义消息和 bash 命令输出不触发分类 —— ext:227-235, ext:451-454；README.md:105；test:207-226
- GPT-6 Codex 适用条件：接口 `openai-codex-responses`、模型 ID 以 `gpt-6` 开头、thinking 不是 `off` —— ext:92, ext:105-107, ext:413-417；test:185-205
- Claude（Anthropic 协议）适用条件：接口 `anthropic-messages`、`compat.supportsMidConvoEffort === true`、模型 ID 精确等于 `claude-opus-5`、`claude-opus-5-5` 或 `claude-sonnet-5-5`，且 thinking 不是 `off` —— ext:109-113, ext:413-417；test:185-205；README.md:61-68
- Claude（Antigravity）适用条件：provider `antigravity`、接口 `antigravity-api`、模型 ID 精确等于 `claude-opus-5-5` 或 `claude-sonnet-5-5`，且 thinking 不是 `off`；需已注册带 legacy streamSimple 的 pi-antigravity provider，本机使用 0.11.0 —— ext:115-118, ext:413-417；test:1155-1289；README.md:61, README.md:67
- 不新增其他模型；三个分支都需要 OpenRouter 认证；GPT-6 Codex 另需 `openai-codex` 登录 —— README.md:61, README.md:69；ext:93
- 功能不替换主模型 —— README.md:88；ext:261-290, ext:491-554（只调整请求中的档位）
- 空白输入不调用分类器，沿用当前强度 —— ext:130-135, ext:463-481；README.md:109；test:910-916
- 当前强度 = 当前分支最近一次决策；没有决策时用基线（Pi 的 thinking 设置） —— ext:457
- 每个分类模型最多等 15 秒，首选非 Jev 模型超时或报错后单跳回退一次 Jev，合计最多约 30 秒 —— ext:94, ext:303-334；test「超时后 Jev 使用独立 15 秒预算，迟到结果不能当作成功」（test:761-780）
- 分类器只收到对话文本（用户和助手消息），不含系统提示词（role 为 system 的消息）、工具结果、思考块和图片数据 —— ext:120-127, ext:463；README.md:106；test:359-371
- 四个固定分类器 ID：Jev `typesafe/jev-1.14`、d1-ultra `liquid/d1-ultra`、Mammoth 27B `baseten/mammoth-1`、Decider v1.2 `perplexity/pplx-decider-v1.2`；宿主目录未收录对应固定 ID 时从原生 `~typesafe/jev-latest` 模板补充元数据，不覆盖服务商目录 —— ext:11-36, ext:148-160；README.md:81-86, README.md:110；test:536-604
- 只回答 low、medium、high、xhigh、max —— ext:102, ext:198-206, ext:218-223；README.md:88
- 对话内容预算：当前请求最多 12,000、近期最多 6 条用户或助手消息、最多 8,000、合计不超过 16,000（JS 字符串长度，即 UTF-16 单元） —— ext:129-145
- 请求另加固定提示语（「近期对话（…）:」「当前用户请求:」）和分类规则，所以 prompt 可略超 16,000 —— ext:144, ext:195-209；test:369
- 图片换成「[附有图片]」 —— ext:124；test:917-920
- 图 1 中「虚线框是外部服务（OpenRouter）」 —— ext:93, ext:152

## 2. 分类结果怎么用（图 2）

- 「合格」：分类正常完成（stopReason 为 stop）、档位在五档内、所选档位概率是 [0.5, 1] 内的有限数，才采用 —— ext:217-223；test:910-960
- 首选非 Jev 模型超时或服务出错时先警告并回退一次 Jev；仍无合格结果才警告并沿用当前强度 —— ext:216, ext:308-330, ext:463-478；test:297-335, test:606-706, test:871-908
- 响应无法解析（缺答案、缺 confidence、概率结构无效）时 Pi 原生 classifier 返回 `stopReason: "error"`，扩展按服务报错处理 —— s1:37-55, s1:174-180；ext:216, ext:321-328
- 档位不在五档内、概率非法或 stopReason 为 length 时视为结果无效，不触发 Jev 回退，直接发一次警告并沿用当前强度；有效结果的概率低于 0.5 时也不回退，静默沿用当前强度 —— ext:217-223, ext:317-320；test:297-335, test:708-729, test:910-960
- 警告显示 HTTP 状态码和白名单中文原因（携带 Guardrail 或数据策略关键词时优先归类为「OpenRouter 策略或白名单限制」）；首选非 Jev 模型超时或报错先提示「正在切换到 openrouter/typesafe/jev-1.14」，最终无合格结果时沿用，只列出实际错误或结果无效，不把低置信度列为错误。未知错误不透出服务原文 —— ext:163-181, ext:327-328；test:606-706, test:1291-1366
- 采用和沿用都写入决策（空白输入也写，classifier 为 null） —— ext:457-459, ext:481；test:268-286, test:321
- 用户取消时不回退、不写决策、不显示新的完成通知；取消前已发出的切换提示保留 —— ext:462-488；README.md:109；test:337-357, test:782-802
- 决策按消息时间戳写入 —— ext:481
- 多条待分类消息共用一次分类流程（可能包含 Jev 回退），按最后一条用户消息作为当前请求，结果写给每条 pending 消息 —— ext:130-134, ext:451-454, ext:463-473, ext:481
- 分类中切换会话或模型，迟到结果不写入 —— ext:456, ext:480；test:871-908

## 3. Codex：为什么不改顶层参数（图 3）

- Pi 每次请求前按当前上下文构造完整 input —— codex:379-394
- 基线在 Codex 请求顶层 `reasoning.effort` —— ext:522；codex:414-424
- 缓存前缀、保留缓存前缀是 README 的设计目标 —— README.md:96；CHANGELOG.md:66
- 保留缓存前缀不保证 100% 命中；TTL、最小 token 数和其他提示变更仍会影响命中 —— README.md:96, README.md:98
- 本次 wrapper 真实通道实测：固定分类夹具强制 low → high → medium → low，真实 Antigravity 主模型的 cacheRead 为 Opus `0 / 13981 / 13994 / 14014`、Sonnet `0 / 13978 / 13991 / 14011`；基线始终 medium，实际 runtime 后缀和 message_end 字段依次为 low / high / medium / low。Opus 完整成功序列前有若干次 SAFETY 零输出尝试，未计入成功序列；固定夹具不等于真实 Jev 端到端，短时实测不是厂商保证 —— README.md:98；主代理提供的本轮验收记录
- Gemini 4 Argon 已存在，但官方资料只明确 implicit cache；未找到改变 thinking_level 保缓存的明确官方承诺，因此本次不支持。这是缺证，不是证明会丢缓存 —— README.md:102；https://ai.google.dev/gemini-api/docs/latest-model
- 启用缓存且有会话 ID 时，请求带 `prompt_cache_key` —— codex:171-173, codex:397
- WebSocket 增量续传：传输方式为 auto 或 websocket-cached；当前连接保留 continuation 和有效 lastResponseId；除 input、previous_response_id 外其余字段一致；新 input 以上次 input 加上次响应开头。全部满足才只发新增部分并带 `previous_response_id`，否则发完整请求 —— codex:184, codex:1121-1160, codex:1175-1177
- 默认传输方式是 auto —— codex:184
- before_provider_request 的改写发生在构造请求之后、发送之前 —— codex:174-177；sdk:213-218, sdk:262
- 图 3 是独立 Codex 示例（medium → xhigh），不是测试数据；「顶层不变」一行示意 configuration_update 方案下请求 2 的开头与请求 1 相同（同图 4）

## 4. 按接入分支写入档位（图 4）

### Codex

- 顶层保持基线，在用户项前插入 `{ type: "configuration_update", reasoning: { effort } }` —— ext:518-554；test:140-173
- 注入发生在 `before_provider_request`，只改写 `input` —— ext:491, ext:554；test:145-146
- 整轮没有任何新增 update 时原样返回；有历史 update 需要重放时仍返回新 payload —— ext:554
- 每条 update 后紧跟一个用户项，不会相邻 —— ext:539-551；test:169-171
- 档位先经过 `thinkingLevelMap` 映射 —— ext:246-249, ext:544
- 决策按时间戳持久化；模型、基线和已有上下文不变时，追加请求在同样位置插入同样的项，新请求开头等于上一次请求 —— ext:481, ext:518-554；test:154, test:159, test:166, test:498, test:522
- 前提条件：改基线或模型映射后，重放可能新增或去掉 update，开头随之变化 —— ext:246-249, ext:522, ext:544-548
- 档位和当前强度相同时，当前用户项前不插入 —— ext:546-549；test:175-183
- 回到基线时也插入一条 update 抵消前一条 —— ext:546-549；test:162-167
- 仅 Codex：不能与服务端自动压缩、自动截断或 `/responses/compact` 混用；Pi 客户端压缩不受影响 —— README.md:113（源码无对应检查）
- 图 4 是独立 Codex 示例（medium、xhigh、medium）；被引测试的实际序列是 xhigh → low → medium（test:142, test:160, test:167），只用于证明注入机制

### Claude

- Pi 原生序列化器用空 system 消息的 `output_config.effort` 记录逐消息档位；扩展只替换 Pi 已生成的末尾空 system 标记，不改顶层 output_config、thinking、历史消息或 thinking blocks —— anthropic:1209-1217；ext:491-516；test:994-1046
- 三个指定模型支持逐消息 effort 并保持此前缓存前缀；所需 beta `mid-conversation-output-config-2026-07-01` 由 Pi 发送；其他 Opus、Sonnet 版本并非全部支持 —— README.md:100；anthropic:117, anthropic:851-853；https://platform.claude.com/docs/en/build-with-claude/effort#change-effort-mid-conversation-beta
- Pi v1.5.0 的 Anthropic 序列化实现和本仓库 1.0.1 依赖都有原生标记，无需升级依赖 —— README.md:100；anthropic:1209-1217；https://github.com/earendil-works/pi/blob/v1.5.0/packages/ai/src/api/anthropic-messages.ts
- `message_end` 保存实际发送的 `providerThinkingLevel`，供 Pi 重建历史 effort 标记；主会话 thinking 基线不变 —— ext:557-573；anthropic:1152-1156, anthropic:1210-1216；test:994-1027
- 同一请求由提供方内部重建或重试时复用原模型快照；流式期间切换模型后，旧回复仍保存实际档位 —— ext:257, ext:418-424, ext:491-516, ext:557-573；test:1081-1103
- Pi 的 `max_tokens: 1` 缓存预热回放不干预；因当前没有请求 ID 可区分，`max_tokens: 1` 主请求也不自动调整，待 Pi 暴露请求 ID 后再区分 —— ext:498-499；test:1105-1125；README.md:94
- 请求形状无效、取消或生命周期清理时不覆盖 payload 或回复 —— ext:498-512, ext:557-573；test:1048-1079
- 验收：仓库默认依赖 `npm run check` 65/65 通过；Pi 1.5.0 临时副本的 inline-effort 测试 32/32 通过。另以 Pi 1.5.0 原生 streamSimple 和本地 HTTP 假服务触发 preferred strict 工具 400 降级重试，两次 HTTP 都发送 xhigh，最终 message_end 保存 xhigh —— 主代理提供的本轮验收记录；test:1081-1125 覆盖对应生命周期回归

### Antigravity

- pi-antigravity 0.11 不触发 onPayload；扩展在 context_with_system 分类后临时包装原生 streamSimple，只改匹配 sessionId、末条消息 timestamp 和模型的主请求 options.reasoning，再由插件按 -low / -medium / -high runtime ID 路由；max 和 xhigh 夹到 high，会话 thinking 和历史上下文不变 —— ext:261-290, ext:438-444；test:1155-1195；README.md:90
- wrapper 保留 oauth、headers、images、refreshModels；注册和恢复时携带 provider.getAllModels 当前动态目录（chat、image、classifier），按 type + id 补回 registered model.headers —— ext:283-301；test:1155-1172, test:1251-1289；README.md:90
- message_end 保存实际 providerThinkingLevel；工具续调、同一主请求重试和恢复沿用原决策；maxTokens: 1 预热和辅助 session 不干预 —— ext:266-290, ext:557-565；test:1155-1249；README.md:92, README.md:94
- session_shutdown 只恢复原 streamSimple，保留第三方后来对 headers 等字段的部分更新；第三方已替换 streamSimple 时不覆盖 —— ext:294-301, ext:418-430；test:1221-1289；README.md:94
- 新增 4 项 Antigravity 回归测试；真实 ModelRuntime 用例覆盖动态刷新目录、图片模型、模型级头部和第三方部分注册 —— test:1155-1289；CHANGELOG.md:37

## 5. 决策跟随会话分支（图 5）

- 决策是会话自定义条目，类型沿用旧名 `jev-inline-effort`（旧会话可直接恢复），内容 `{ timestamp, thinkingLevel, classifier }`，回退成功时另带 `fallbackFrom`，不发给模型 —— ext:90, ext:481；types:1234-1235
- 只读当前分支路径（从叶子到根）上的条目 —— ext:237-244；sm:1057-1071
- 恢复、fork、树导航后旧消息保持原档位、不重新分类 —— README.md:105；test:493-534, test:994-1027
- 分叉后仍继承共同祖先（图中 U1）的决策，读不到分叉后另一分支（U2）的决策；新消息重新分类 —— ext:237-244；sm:1057-1071；test:247-255
- 压缩摘要承接被压缩部分的最后一次决策，强度不回落到基线 —— ext:531-543；test:228-245, test:1024-1026
- 会话开始、退出和切换模型时只清掉本扩展的 🧠 段（setStatus 只作用于 STATUS_KEY），并取消进行中的分类 —— ext:91, ext:418-431；test:288-295
- 图 5 的 xhigh、low 是示例值 —— 结构参照 test:228-255

## 6. 状态栏与演示（图 6）

- 状态栏格式：当前强度不等于基线时 `🧠 当前 · 基线 基线值 · 分类器`，相等时 `🧠 基线值 · 分类器` —— ext:279, ext:515, ext:553；test:147, test:161, test:168, test:180, test:1006
- Codex 用户项数量与本次上下文算出的数量不一致时不插入，显示 `🧠 基线 · 未调整 · 分类器` —— ext:525-529；README.md:113；test:257-266
- 分类器标签取最近一次决策；无决策或 classifier 为 null 时「未分类」 —— ext:96-101, ext:279, ext:515, ext:525
- 未获得合格档位时仍记录首选分类器；回退成功时记录实际 Jev 和回退来源（如 `Jev（d1-ultra 回退）`、`Jev（Mammoth 27B 回退）`、`Jev（Decider v1.2 回退）`） —— ext:96-101, ext:466, ext:481；test:321, test:606-640
- Pi 自带的 thinking 显示只反映基线 —— README.md:88
- 会话刚恢复时没有 🧠 段，下一次请求后才显示 —— ext:427（session_start 清空）, ext:266-282, ext:491-554（发送前才设置）
- demo 的「第一条消息时当前强度等于基线」 —— ext:457；demo 只展示 Codex 的 update 和「未调整」规则 —— ext:518-554

## 7. 在 /personal 里管理（图 7 录屏 + 表）

- 菜单项与处理函数参数：查看分类模型与状态（status）、选择分类模型（model）、测试分类模型可用性（test） —— entry:63-67, entry:164-184
- 本项目只注册 `/personal`；功能的 registerCommand 被 featureApi 截住，只存进 commands 表 —— entry:128-135, entry:137
- `/personal` 有 UI 就能用（TUI、RPC）；没有 UI 时提示并返回；批量功能开关只在 TUI —— entry:140-143, entry:188-191
- 查看状态：是否适用、后续分类器、失败回退策略、当前分支最近决策 —— ext:345-352
- 「查看分类模型与状态」在 agent 运行时也可用；选择和测试要求空闲 —— ext:345-357, ext:399-402；test:850-869
- 「选择分类模型」打开四个模型的选择器，Esc 取消不保存 —— ext:372-394
- 选择写入全局配置，从下一条未分类消息生效，旧决策不变；其他会话和子代理的后续分类也读取 —— ext:403-404, ext:466；README.md:104；test:493-506
- 「测试分类模型可用性」用固定样例「把 hello 转成大写。」，不读会话、不写决策、不改强度 —— ext:358-369；test:824-848
- 配置无效时报错，不退回 Jev；在「选择分类模型」里重新保存可修复 —— ext:56-65；test:464-491
- 四个分类器均绑定固定模型 ID，OpenRouter 白名单只需放行实际服务商和对应模型 —— README.md:111
- 录屏 effort-status：/personal → 原位思考强度 → 查看分类模型与状态，显示失败回退 Jev（仅本次）、最近决策尚无；在临时 agent 目录重录，仅查看示例配置，不验证模型可用性；标题合入状态栏，技术版素材与使用者版相同 —— docs/extensions-usage/tapes/effort-status.tape；两版 media/effort-status.png；ext:345-352；entry:63-67。

## 8. 子代理与代价（图 8）

- 子代理需加载本扩展，基线取子代理自己的 thinking 设置；外部 CLI 代理不经过本扩展 —— README.md:112；ext:457（基线 = pi.getThinkingLevel()）
- 分类增加等待、消耗服务额度，文本可能含业务信息 —— README.md:106
- 四个分类模型均按输入计费，价格以 OpenRouter 端点信息为准 —— ext:11-36；README.md:110

## 按推理结构选档

- low 直接执行明确操作，medium 判断可在局部完成，high 综合多项行为或交付约束，xhigh 消解冲突证据、排查混杂解释或检验跨边界行为；max 是需系统反证、严格推导与失效分析的例外攻坚，或需有排除外部阻碍后深入分析仍不足的具体证据 —— ext:199-206；test:1368-1402（四种分类器共用提示契约，不验证线上语义效果）
- 近期对话只补全同任务的目标、约束和交付要求；不继承旧难度，简短的继续或修改也结合前文判断；不按主题、代理数量、精美成片、操作敏感或重试提档；high 仅在无法识别任务要求时保守兜底，不替代模型专长、授权与实测 —— ext:199；test:1382-1389
- 字号调整、图示设计、查数画图与混杂归因为判据示例，不是线上分类保证 —— ext:201-204；test:1368-1402 只校验发送内容
- 分类看不到图片与工具结果，同轮工具续调不重分类，已有历史决策不变；修改提示不改变输入或映射 —— ext:120-145, ext:275, ext:449-473, ext:510-512, ext:543-547

## 改名与兼容（inline-effort）

- 文件、功能 ID、配置文件名从 jev-inline-effort 改为 inline-effort —— entry:14, entry:42；ext:45, ext:70；README.md:158, README.md:168
- `inline-effort.json` 读取返回 ENOENT 时才读 `jev-inline-effort.json`；新文件格式或内容无效时报错，不回退 —— ext:43-66；README.md:170
- 保存只写 `inline-effort.json`，旧文件保留不改写 —— ext:68-81；test:420-448；README.md:170
- 开关新键 `inline-effort` 存在时以新键为准，否则读旧键 `jev-inline-effort`；旧键仍须为布尔值 —— entry:101-110, entry:119-120；README.md:168
- 会话决策条目类型和状态栏键仍为 `jev-inline-effort`，旧会话可直接恢复 —— ext:89-91；README.md:171

## 自动回退与安全原因

- 只有合法档位、有限且位于 [0, 1] 的概率才可归为低置信度；0 静默，0.5 可采用，非法概率、截断或缺答案视为结果无效。结果无效与低置信度均不触发 Jev 回退，直接沿用最近档位并持久化（结果无效发一次警告，低置信度静默），恢复和工具续调不重复分类 —— ext:317-320；test「分类不可用、出错、超时、截断、低置信度或结果无效时沿用当前生效强度」（test:297-335）；test「低置信度沿用上次决策，工具续调与恢复不重复分类」（test:708-729）；test「空输入、图片、概率边界和无效答案按规则处理」（test:910-960）。
- 固定样例测试仅低置信度时返回普通 info 提示，不发 warning、不回退，不写决策或改变状态 —— test「可用性测试只发送固定样例，成功、低置信度和失败均不写决策或改变状态」（test:824-848）。

- 首选非 Jev 模型（`d1-ultra`、`mammoth-27b`、`decider`）在请求超时或服务报错时，依次尝试首选模型、Jev（`typesafe/jev-1.14`），先发切换 warning；Jev 返回低置信度时仅警告首选模型的真实错误并沿用当前强度，Jev 返回结果无效或报错时合并列出两条错误并沿用。每模型独立 15 秒，最多约 30 秒；全局选择不变，下条新消息重新尝试首选 —— ext:308-330；test:606-706, test:761-780。
- 回退成功记录 classifier=jev、fallbackFrom=首选模型键；状态栏显示 `Jev（〈首选模型〉 回退）`。恢复和工具续调沿用，不破坏历史前缀；Claude、Antigravity 同样生效 —— test:731-759, test:804-822。
- HTTP 429 显示服务限流、携带 Guardrail 关键词的 404/403 显示 OpenRouter 策略或白名单限制、5xx 显示上游服务异常；未知原因明确提示未识别。不输出服务端原文或凭据。回退警告在 Jev 调用前出现；成功后显示实际模型和档位，未获合格档位时只列出实际错误或结果无效，低置信度不警告 —— ext:163-181；test:606-706, test:1291-1366。
- 用户取消或生命周期切换不继续回退，不写迟到决策或显示完成通知；已经发出的切换提示保留。空白输入不调用、配置无效不尝试任何模型 —— test:337-357, test:464-491, test:782-802。
- 固定样例可用性测试走同一回退流程，不把 Jev 成功说成首选模型成功，不改会话决策、状态或基线 —— test:824-848, test:1291-1366。
- 演示区用本地固定示例模拟 Jev 返回 low，不发送 API 请求、不保证线上结果；仅服务报错可回退，结果无效与低置信度不回退并沿用基线 —— tests/effort-demo.test.mjs。

- 本轮重录 personal-menu、personal-switches、statusline-style，后者包含第五项标题开关及状态栏标题；其他认证/聊天录屏保留历史画面并在紧邻图注中标明标题位置已变化，不伪造模型调用 —— docs/extensions-usage/tapes/；两版页面可见历史录屏图注。
- 删除原视频审查后（/personal 一级菜单和批量开关各少一项），在按 _settings.tape 创建的临时 agent 目录重录 personal-menu、personal-switches、statusline-style、clickable-paths-status、effort-status、effort-model，画面中一级菜单为五项功能加「批量功能开关」；前三个录制前移除了临时目录里的凭据文件，后三个保留凭据文件但不发送模型消息；随后重录 auto-name-model、auto-name-status（旧画面的一级菜单还有已合并的「右下角会话标题」），保留凭据文件但不发送模型消息，两个 tape 去掉一级菜单里多余的一次下移；未重录的只剩 chat-turn —— docs/extensions-usage/tapes/；docs/extensions-usage/media/；extensions/pi-personal-extensions.ts:16-47
