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

- 功能 ID `inline-effort`，菜单 label「原位思考强度（Jev / d1-ultra）」 —— entry:49-50
- 入口 `/personal` → 原位思考强度（Jev / d1-ultra）→ 菜单项；处理函数以 `effort` 名存进 commands 表，不注册成斜杠命令 —— ext:312；entry:50, entry:70-74, entry:129-134, entry:139
- 配置文件在 agent 目录下的 `inline-effort.json`；agent 目录默认 `~/.pi/agent/`，`PI_CODING_AGENT_DIR` 可覆盖 —— ext:23-26, ext:48；config:453-458；README.md:163-174
- 默认分类器 Jev，可选 d1-ultra —— ext:11-14, ext:35, ext:40

## 1. 什么时候分类（图 1）

- 「原位」：Codex 顶层 reasoning.effort 保持基线，档位作为 configuration_update 写在 input 里当前用户项之前；Anthropic 协议分支只改 Pi 已生成的末尾空 system 消息中的 output_config.effort；Antigravity 分支只改匹配请求的 options.reasoning —— ext:494-530, ext:467-492, ext:238-267
- 「适用」：主模型属于支持矩阵，且 thinking 不为 `off` —— ext:389-393

- 每条新用户消息选一个档位并记为决策 —— ext:425-457
- 工具续调和重试不再分类（已有决策的时间戳跳过；最后一条助手消息之后没有新用户消息就不分类） —— ext:425-430；README.md:112；test:141-145, test:456-458
- steer、follow-up 追加的用户消息也分类；自定义消息和 bash 命令输出不触发分类 —— ext:204-212, ext:427-430；README.md:112；test:198-217
- GPT-6 Codex 适用条件：接口 `openai-codex-responses`、模型 ID 以 `gpt-6` 开头、thinking 不是 `off` —— ext:70, ext:81-83, ext:389-393；test:176-196
- Claude（Anthropic 协议）适用条件：接口 `anthropic-messages`、`compat.supportsMidConvoEffort === true`、模型 ID 精确等于 `claude-opus-5`、`claude-opus-5-5` 或 `claude-sonnet-5-5`，且 thinking 不是 `off` —— ext:85-89, ext:389-393；test:176-196；README.md:70-78
- Claude（Antigravity）适用条件：provider `antigravity`、接口 `antigravity-api`、模型 ID 精确等于 `claude-opus-5-5` 或 `claude-sonnet-5-5`，且 thinking 不是 `off`；需已注册带 legacy streamSimple 的 pi-antigravity provider，本机使用 0.11.0 —— ext:91-94, ext:389-393；test:992-1126；README.md:70, README.md:77
- 不新增其他模型；三个分支都需要 OpenRouter 认证；GPT-6 Codex 另需 `openai-codex` 登录 —— README.md:70, README.md:79；ext:71
- 功能不替换主模型 —— README.md:95；ext:238-267, ext:467-530（只调整请求中的档位）
- 空白输入不调用分类器，沿用当前强度 —— ext:106, ext:439-457；README.md:114；test:771-775
- 当前强度 = 当前分支最近一次决策；没有决策时用基线（Pi 的 thinking 设置） —— ext:433
- 每个分类模型最多等 15 秒，d1-ultra → Jev 回退合计最多约 30 秒 —— ext:72, ext:280-311；test「d1-ultra 超时后 Jev 使用独立 15 秒预算，迟到结果不能当作成功」
- 分类器只收到对话文本（用户和助手消息），不含系统提示词（role 为 system 的消息）、工具结果、思考块和图片数据 —— ext:96-103, ext:439；README.md:113；test:335-347
- 分类器 ID：Jev `~typesafe/jev-latest`，d1-ultra `liquid/d1-ultra`；d1-ultra 付费 —— ext:12-13；README.md:92-93, README.md:115
- 只回答 low、medium、high、xhigh、max —— ext:78, ext:173-177, ext:189-195；README.md:95
- 对话内容预算：当前请求最多 12,000、近期最多 6 条用户或助手消息、最多 8,000、合计不超过 16,000（JS 字符串长度，即 UTF-16 单元） —— ext:106-120
- 请求另加固定提示语（「近期对话（…）:」「当前用户请求:」）和分类规则，所以 prompt 可略超 16,000 —— ext:120, ext:167-179；test:345
- 图片换成「[附有图片]」 —— ext:100；test:776-779
- 图 1 中「虚线框是外部服务（OpenRouter）」 —— ext:71, ext:119

## 2. 分类结果怎么用（图 2）

- 「合格」：分类正常完成（stopReason 为 stop）、档位在五档内、所选档位概率是 [0.5, 1] 内的有限数，才采用 —— ext:189-195；test:771-796
- d1-ultra 超时或服务出错时先警告并回退 Jev；最终失败才警告并沿用当前强度 —— ext:188, ext:288-306, ext:439-453；test:288-311（最终失败警告 test:305-308）, test:732-769
- 响应无法解析（缺答案、缺 confidence、概率结构无效）时 Pi 原生 classifier 返回 `stopReason: "error"`，扩展按出错处理并警告 —— s1:37-55, s1:174-180；ext:188, ext:453
- 档位不在五档内或 stopReason 为 length 时视为无效结果，警告并触发 Jev 回退；有效结果的概率低于 0.5 时静默回退，全部为低置信度时静默沿用 —— ext:189-195；test:288-311
- 警告显示 HTTP 状态码和白名单中文原因；d1-ultra 失败先提示「正在切换到 Jev」，最终无合格结果时沿用，只列出实际错误，不把低置信度列为错误。未知错误不透出服务原文 —— test「d1-ultra 服务出错或无效时回退 Jev，警告先显示安全原因和正在切换」；test「真实 Pi classifier 管线复用 models.json 的代理端点、认证及头部，404 不伪报成功」
- 采用和沿用都写入决策（空白输入也写，classifier 为 null） —— ext:433-434, ext:457；test:259-277, test:304
- 用户取消时不回退、不写决策、不显示新的完成通知；取消前已发出的切换提示保留 —— ext:439-465；README.md:114；test:313-333
- 决策按消息时间戳写入 —— ext:457
- 多条待分类消息共用一次分类流程（可能包含 Jev 回退），按最后一条用户消息作为当前请求，结果写给每条 pending 消息 —— ext:106-109, ext:427-430, ext:439-448, ext:457
- 分类中切换会话或模型，迟到结果不写入 —— ext:432, ext:456；test:732-769

## 3. Codex：为什么不改顶层参数（图 3）

- Pi 每次请求前按当前上下文构造完整 input —— codex:379-394
- 基线在 Codex 请求顶层 `reasoning.effort` —— ext:498；codex:414-424
- 缓存前缀、保留缓存前缀是 README 的设计目标 —— README.md:103；CHANGELOG.md:44
- 保留缓存前缀不保证 100% 命中；TTL、最小 token 数和其他提示变更仍会影响命中 —— README.md:103, README.md:105
- 本次 wrapper 真实通道实测：固定分类夹具强制 low → high → medium → low，真实 Antigravity 主模型的 cacheRead 为 Opus `0 / 13981 / 13994 / 14014`、Sonnet `0 / 13978 / 13991 / 14011`；基线始终 medium，实际 runtime 后缀和 message_end 字段依次为 low / high / medium / low。Opus 完整成功序列前有若干次 SAFETY 零输出尝试，未计入成功序列；固定夹具不等于真实 Jev 端到端，短时实测不是厂商保证 —— README.md:105；主代理提供的本轮验收记录
- Gemini 4 Argon 已存在，但官方资料只明确 implicit cache；未找到改变 thinking_level 保缓存的明确官方承诺，因此本次不支持。这是缺证，不是证明会丢缓存 —— README.md:109；https://ai.google.dev/gemini-api/docs/latest-model
- 启用缓存且有会话 ID 时，请求带 `prompt_cache_key` —— codex:171-173, codex:397
- WebSocket 增量续传：传输方式为 auto 或 websocket-cached；当前连接保留 continuation 和有效 lastResponseId；除 input、previous_response_id 外其余字段一致；新 input 以上次 input 加上次响应开头。全部满足才只发新增部分并带 `previous_response_id`，否则发完整请求 —— codex:184, codex:1121-1160, codex:1175-1177
- 默认传输方式是 auto —— codex:184
- before_provider_request 的改写发生在构造请求之后、发送之前 —— codex:174-177；sdk:213-218, sdk:262
- 图 3 是独立 Codex 示例（medium → xhigh），不是测试数据；「顶层不变」一行示意 configuration_update 方案下请求 2 的开头与请求 1 相同（同图 4）

## 4. 按接入分支写入档位（图 4）

### Codex

- 顶层保持基线，在用户项前插入 `{ type: "configuration_update", reasoning: { effort } }` —— ext:494-530；test:131-164
- 注入发生在 `before_provider_request`，只改写 `input` —— ext:467, ext:530；test:136-137
- 整轮没有任何新增 update 时原样返回；有历史 update 需要重放时仍返回新 payload —— ext:530
- 每条 update 后紧跟一个用户项，不会相邻 —— ext:515-526；test:160-162
- 档位先经过 `thinkingLevelMap` 映射 —— ext:223-226, ext:519
- 决策按时间戳持久化；模型、基线和已有上下文不变时，追加请求在同样位置插入同样的项，新请求开头等于上一次请求 —— ext:457, ext:494-530；test:145, test:150, test:157, test:461, test:485
- 前提条件：改基线或模型映射后，重放可能新增或去掉 update，开头随之变化 —— ext:223-226, ext:498, ext:519-523
- 档位和当前强度相同时，当前用户项前不插入 —— ext:520-523；test:166-174
- 回到基线时也插入一条 update 抵消前一条 —— ext:520-523；test:153-158
- 仅 Codex：不能与服务端自动压缩、自动截断或 `/responses/compact` 混用；Pi 客户端压缩不受影响 —— README.md:118（源码无对应检查）
- 图 4 是独立 Codex 示例（medium、xhigh、medium）；被引测试的实际序列是 xhigh → low → medium（test:133, test:151, test:158），只用于证明注入机制

### Claude

- Pi 原生序列化器用空 system 消息的 `output_config.effort` 记录逐消息档位；扩展只替换 Pi 已生成的末尾空 system 标记，不改顶层 output_config、thinking、历史消息或 thinking blocks —— anthropic:1209-1217；ext:467-492；test:831-881
- 三个指定模型支持逐消息 effort 并保持此前缓存前缀；所需 beta `mid-conversation-output-config-2026-07-01` 由 Pi 发送；其他 Opus、Sonnet 版本并非全部支持 —— README.md:107；anthropic:117, anthropic:851-853；https://platform.claude.com/docs/en/build-with-claude/effort#change-effort-mid-conversation-beta
- Pi v1.5.0 的 Anthropic 序列化实现和本仓库 1.0.1 依赖都有原生标记，无需升级依赖 —— README.md:107；anthropic:1209-1217；https://github.com/earendil-works/pi/blob/v1.5.0/packages/ai/src/api/anthropic-messages.ts
- `message_end` 保存实际发送的 `providerThinkingLevel`，供 Pi 重建历史 effort 标记；主会话 thinking 基线不变 —— ext:533-549；anthropic:1152-1156, anthropic:1210-1216；test:831-862
- 同一请求由提供方内部重建或重试时复用原模型快照；流式期间切换模型后，旧回复仍保存实际档位 —— ext:234-235, ext:394-400, ext:467-492, ext:533-549；test:918-940
- Pi 的 `max_tokens: 1` 缓存预热回放不干预；因当前没有请求 ID 可区分，`max_tokens: 1` 主请求也不自动调整，待 Pi 暴露请求 ID 后再区分 —— ext:473-474；test:942-962；README.md:101
- 请求形状无效、取消或生命周期清理时不覆盖 payload 或回复 —— ext:473-487, ext:533-549；test:885-916
- 验收：仓库默认依赖 `npm run check` 65/65 通过；Pi 1.5.0 临时副本的 inline-effort 测试 32/32 通过。另以 Pi 1.5.0 原生 streamSimple 和本地 HTTP 假服务触发 preferred strict 工具 400 降级重试，两次 HTTP 都发送 xhigh，最终 message_end 保存 xhigh —— 主代理提供的本轮验收记录；test:918-962 覆盖对应生命周期回归

### Antigravity

- pi-antigravity 0.11 不触发 onPayload；扩展在 context_with_system 分类后临时包装原生 streamSimple，只改匹配 sessionId、末条消息 timestamp 和模型的主请求 options.reasoning，再由插件按 -low / -medium / -high runtime ID 路由；max 和 xhigh 夹到 high，会话 thinking 和历史上下文不变 —— ext:238-267, ext:409-422；test:992-1031；README.md:97
- wrapper 保留 oauth、headers、images、refreshModels；注册和恢复时携带 provider.getAllModels 当前动态目录（chat、image、classifier），按 type + id 补回 registered model.headers —— ext:260-278；test:992-1009, test:1088-1126；README.md:97
- message_end 保存实际 providerThinkingLevel；工具续调、同一主请求重试和恢复沿用原决策；maxTokens: 1 预热和辅助 session 不干预 —— ext:243-267, ext:533-541；test:992-1085；README.md:99, README.md:101
- session_shutdown 只恢复原 streamSimple，保留第三方后来对 headers 等字段的部分更新；第三方已替换 streamSimple 时不覆盖 —— ext:271-278, ext:394-406；test:1058-1126；README.md:101
- 新增 4 项 Antigravity 回归测试；真实 ModelRuntime 用例覆盖动态刷新目录、图片模型、模型级头部和第三方部分注册 —— test:992-1126；CHANGELOG.md:15

## 5. 决策跟随会话分支（图 5）

- 决策是会话自定义条目，类型沿用旧名 `jev-inline-effort`（旧会话可直接恢复），内容 `{ timestamp, thinkingLevel, classifier }`，回退成功时另带 `fallbackFrom`，不发给模型 —— ext:68, ext:457；types:1234-1235
- 只读当前分支路径（从叶子到根）上的条目 —— ext:214-221；sm:1057-1071
- 恢复、fork、树导航后旧消息保持原档位、不重新分类 —— README.md:112；test:456-497, test:831-862
- 分叉后仍继承共同祖先（图中 U1）的决策，读不到分叉后另一分支（U2）的决策；新消息重新分类 —— ext:214-221；sm:1057-1071；test:238-246
- 压缩摘要承接被压缩部分的最后一次决策，强度不回落到基线 —— ext:507-519；test:219-236, test:859-861
- 会话开始、退出和切换模型时只清掉本扩展的 🧠 段（setStatus 只作用于 STATUS_KEY），并取消进行中的分类 —— ext:69, ext:394-407；test:279-286
- 图 5 的 xhigh、low 是示例值 —— 结构参照 test:219-246

## 6. 状态栏与演示（图 6）

- 状态栏格式：当前强度不等于基线时 `🧠 当前 · 基线 基线值 · 分类器`，相等时 `🧠 基线值 · 分类器` —— ext:256, ext:491, ext:529；test:138, test:152, test:159, test:171, test:843
- Codex 用户项数量与本次上下文算出的数量不一致时不插入，显示 `🧠 基线 · 未调整 · 分类器` —— ext:501-505；README.md:118；test:248-257（状态 test:253）
- 分类器标签取最近一次决策；无决策或 classifier 为 null 时「未分类」 —— ext:74-77, ext:256, ext:491, ext:500
- 所有尝试失败时仍记录首选分类器；回退成功时记录实际 Jev 和回退来源 —— ext:442, ext:457；test:304
- Pi 自带的 thinking 显示只反映基线 —— README.md:95
- 会话刚恢复时没有 🧠 段，下一次请求后才显示 —— ext:405（session_start 清空）, ext:243-267, ext:467-530（发送前才设置）
- demo 的「第一条消息时当前强度等于基线」 —— ext:433；demo 只展示 Codex 的 update 和「未调整」规则 —— ext:494-530

## 7. 在 /personal 里管理（图 7 录屏 + 表）

- 菜单项与处理函数参数：查看分类模型与状态（status）、选择分类模型（model）、测试分类模型可用性（test） —— entry:70-74, entry:171-178
- 本项目只注册 `/personal`；功能的 registerCommand 被 featureApi 截住，只存进 commands 表 —— entry:129-134, entry:139
- `/personal` 有 UI 就能用（TUI、RPC）；没有 UI 时提示并返回；批量功能开关只在 TUI —— entry:142-145, entry:190-193
- 查看状态：是否适用、后续分类器、失败回退策略、当前分支最近决策 —— ext:322-329
- 「查看分类模型与状态」在 agent 运行时也可用；选择和测试要求空闲 —— ext:322-334, ext:376-379；test:711-730
- 「选择分类模型」打开选择器，Esc 取消不保存 —— ext:348-370
- 选择写入全局配置，从下一条未分类消息生效，旧决策不变；其他会话和子代理的后续分类也读取 —— ext:380-381, ext:442；README.md:111；test:456-469
- 「测试分类模型可用性」用固定样例「把 hello 转成大写。」，不读会话、不写决策、不改强度 —— ext:338-346；test:685-709
- 配置无效时报错，不退回 Jev；在「选择分类模型」里重新保存可修复 —— ext:34-43；test:427-454
- OpenRouter 白名单需放行实际服务商和模型；Latest 别名还需放行解析后的固定版本 —— README.md:116
- 录屏 effort-status：/personal → 原位思考强度 → 查看分类模型与状态，显示失败回退 Jev（仅本次）、最近决策尚无；在临时 agent 目录重录，仅查看示例配置，不验证模型可用性；标题合入状态栏，技术版素材与使用者版相同 —— docs/extensions-usage/tapes/effort-status.tape；两版 media/effort-status.png；ext:321-329；entry:74-78。

## 8. 子代理与代价（图 8）

- 子代理需加载本扩展，基线取子代理自己的 thinking 设置；外部 CLI 代理不经过本扩展 —— README.md:117；ext:433（基线 = pi.getThinkingLevel()）
- 分类增加等待、消耗服务额度，文本可能含业务信息 —— README.md:113
- d1-ultra 付费，价格以 OpenRouter 端点信息为准 —— README.md:115

## 按推理结构选档

- low 直接执行明确操作，medium 判断可在局部完成，high 综合多项行为或交付约束，xhigh 消解冲突证据、排查混杂解释或检验跨边界行为；max 是需系统反证、严格推导与失效分析的例外攻坚，或需有排除外部阻碍后深入分析仍不足的具体证据 —— ext:176-182；test:1195-1229（两种分类器共用提示契约，不验证线上语义效果）
- 近期对话只补全同任务的目标、约束和交付要求；不继承旧难度，简短的继续或修改也结合前文判断；不按主题、代理数量、精美成片、操作敏感或重试提档；high 仅在无法识别任务要求时保守兜底，不替代模型专长、授权与实测 —— ext:176；test:1209-1216
- 字号调整、图示设计、查数画图与混杂归因为判据示例，不是线上分类保证 —— ext:178-181；test:1195-1229 只校验发送内容
- 分类看不到图片与工具结果，同轮工具续调不重分类，已有历史决策不变；修改提示不改变输入或映射 —— ext:96-120, ext:252, ext:425-448, ext:486-488, ext:519-523

## 改名与兼容（inline-effort）

- 文件、功能 ID、配置文件名从 jev-inline-effort 改为 inline-effort —— entry:15, entry:49；ext:23, ext:48；README.md:169
- `inline-effort.json` 读取返回 ENOENT 时才读 `jev-inline-effort.json`；新文件格式或内容无效时报错，不回退 —— ext:23-44；README.md:180
- 保存只写 `inline-effort.json`，旧文件保留不改写 —— ext:46-59；test:383-411；README.md:180
- 开关新键 `inline-effort` 存在时以新键为准，否则读旧键 `jev-inline-effort`；旧键仍须为布尔值 —— entry:106-113, entry:121-122；README.md:179
- 会话决策条目类型和状态栏键仍为 `jev-inline-effort`，旧会话可直接恢复 —— ext:67-69；README.md:181

## 自动回退与安全原因

- 只有合法档位、有限且位于 [0, 1] 的概率才可归为低置信度；0 静默，0.5 可采用，非法概率仍警告。混合回退仅报告实际错误，沿用最近档位并持久化，恢复和工具续调不重复分类 —— test「空输入、图片、概率边界和无效答案按规则处理」；test「低置信度静默回退，混合无效结果只警告真实错误」；test「低置信度沿用上次决策，工具续调与恢复不重复分类」。
- 固定样例测试仅低置信度时返回普通 info 提示，不发 warning，不写决策或改变状态 —— test「可用性测试只发送固定样例，成功、低置信度和失败均不写决策或改变状态」。

- 首选 d1-ultra 时依次尝试 d1-ultra、Jev；报错、超时、无效或概率低于 0.5 均可触发，仅本次回退；只有前三者发 warning，低置信度静默回退。每模型独立 15 秒，最多约 30 秒；全局选择不变，下条新消息重新尝试首选 —— test「d1-ultra 服务出错或无效时回退 Jev，警告先显示安全原因和正在切换」；test「d1-ultra 超时后 Jev 使用独立 15 秒预算，迟到结果不能当作成功」。
- 回退成功记录 classifier=jev、fallbackFrom=d1-ultra；状态栏显示 Jev（d1-ultra 回退）。恢复和工具续调沿用，不破坏历史前缀；Claude、Antigravity 同样生效 —— test「回退决策可恢复、工具续调不重分类；下条新消息重新尝试 d1-ultra」；test「回退同样适用于 Claude 和 Antigravity，状态栏和实际发送档位一致」。
- HTTP 429 显示服务限流、5xx 显示上游服务异常；未知原因明确提示未识别。不输出服务端原文或凭据。回退警告在 Jev 调用前出现；成功后显示实际模型和档位，最终无合格结果时只列出实际错误，低置信度不警告 —— test「d1-ultra 服务出错或无效时回退 Jev，警告先显示安全原因和正在切换」；test「真实 Pi classifier 管线复用 models.json 的代理端点、认证及头部，404 不伪报成功」。
- 用户取消或生命周期切换不继续回退，不写迟到决策或显示完成通知；已经发出的切换提示保留。空白输入不调用、配置无效不尝试任何模型 —— test「取消分类时不记录决策、不提示失败」；test「Jev 回退期间取消或切换会话，不写决策、不显示迟到成功或失败」；test「配置无效时不偷用 Jev；选择器可修复配置，保存失败保留原状」。
- 固定样例可用性测试走同一回退流程，不把 Jev 成功说成 d1-ultra 成功，不改会话决策、状态或基线 —— test「真实 Pi classifier 管线复用 models.json 的代理端点、认证及头部，404 不伪报成功」。
- 演示区用本地固定示例模拟 Jev 返回 low，不发送 API 请求、不保证线上结果；支持回退成功、失败、直接 Jev、空输入和对齐失败 —— tests/effort-demo.test.mjs。

- 本轮重录 personal-menu、personal-switches、statusline-style，后者包含第五项标题开关及状态栏标题；其他认证/聊天录屏保留历史画面并在紧邻图注中标明标题位置已变化，不伪造模型调用 —— docs/extensions-usage/tapes/；两版页面可见历史录屏图注。
- 删除原视频审查后（/personal 一级菜单和批量开关各少一项），在按 _settings.tape 创建的临时 agent 目录重录 personal-menu、personal-switches、statusline-style、clickable-paths-status、effort-status、effort-model，画面中一级菜单为五项功能加「批量功能开关」；前三个录制前移除了临时目录里的凭据文件，后三个保留凭据文件但不发送模型消息；随后重录 auto-name-model、auto-name-status（旧画面的一级菜单还有已合并的「右下角会话标题」），保留凭据文件但不发送模型消息，两个 tape 去掉一级菜单里多余的一次下移；未重录的只剩 chat-turn —— docs/extensions-usage/tapes/；docs/extensions-usage/media/；extensions/pi-personal-extensions.ts:16-47
