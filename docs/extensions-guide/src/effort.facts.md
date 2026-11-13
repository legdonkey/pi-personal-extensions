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
- `rt` = `node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js`（Pi 1.0.1 开发依赖；Pi 1.5.2 安装目录同名文件行为一致）
- `pi152` = `~/.pi/agent/install/releases/1.5.2/node_modules/@earendil-works`
- `ref` = `/Users/yangguandao/Projects/claude-auto-effort`（auto-effort 源仓库，只读参考）
- `report` = Codex worker 汇报 `/tmp/pi-inline-effort-worker-report.md` 及其结果文件 `/tmp/pi-inline-effort-benchmark-20261114.json`、`/tmp/pi-inline-effort-fable-20261114.json`
- `gpt6` = GPT-6 Astra / GPT-6.1 Sol 推理强度官方指南调研报告 `/private/tmp/claude-501/-Users-yangguandao-Projects-pi-personal-extensions/739c1906-4a81-4bd5-9fe7-05e8177ecafc/scratchpad/gpt6-effort-research.md`（第 0 部分来源链接，第 3 部分规则草案）

## 头部

- 功能 ID `inline-effort`，菜单 label「原位思考强度」 —— entry:42-43
- 入口 `/personal` → 原位思考强度 → 菜单项；处理函数以 `effort` 名存进 commands 表，不注册成斜杠命令 —— ext:651；entry:43, entry:63-69, entry:130-137, entry:139
- 头部导语「用户提交时后台分类，发请求时最多再等 5 秒；两次缓存重建暂停；菜单里运行判档测评」分别见下文第 1 节、「缓存守护」和「判档测评」
- 配置文件在 agent 目录下的 `inline-effort.json`；agent 目录默认 `~/.pi/agent/`，`PI_CODING_AGENT_DIR` 可覆盖 —— ext:46-50, ext:71；config:453-458；README.md:164-177
- 默认分类器 Jev，可选 d1-ultra、Mammoth 27B、Decider v1.2 —— ext:12-37, ext:58, ext:63

## 1. 什么时候分类（图 1）

- 「原位」：Codex 顶层 reasoning.effort 保持基线，档位作为 configuration_update 写在 input 里当前用户项之前；Anthropic 协议分支只改 Pi 已生成的末尾空 system 消息中的 output_config.effort；Antigravity 分支只改匹配请求的 options.reasoning —— ext:967-1004, ext:939-965, ext:594-624
- 「适用」：主模型属于支持矩阵，且 thinking 不为 `off` —— ext:787-791

- 每条新用户消息选一个档位并记为决策 —— ext:872-929
- 工具续调和重试不再分类（已有决策的时间戳跳过；最后一条助手消息之后没有新用户消息就不分类） —— ext:872-877；README.md:119；test:160-164, test:503-509
- steer、follow-up 追加的用户消息也分类；自定义消息和 bash 命令输出不触发分类 —— ext:423-431, ext:874-877；README.md:119；test:217-236
- GPT-6 Codex 适用条件：接口 `openai-codex-responses`、模型 ID 以 `gpt-6` 开头、thinking 不是 `off` —— ext:93, ext:117-119, ext:787-791；test:195-215
- Claude（Anthropic 协议）适用条件：接口 `anthropic-messages`、`compat.supportsMidConvoEffort === true`、模型 ID 精确等于 `claude-opus-5`、`claude-opus-5-5`、`claude-sonnet-5-5` 或 `claude-fable-5-2`，且 thinking 不是 `off` —— ext:121-125, ext:787-791；test:195-215, test:1481-1499；README.md:61-66
- Claude（Antigravity）适用条件：provider `antigravity`、接口 `antigravity-api`、模型 ID 精确等于 `claude-opus-5-5` 或 `claude-sonnet-5-5`，且 thinking 不是 `off`；需已注册带 legacy streamSimple 的 pi-antigravity provider，本机使用 0.11.0 —— ext:127-130, ext:787-791；test:1165-1299；README.md:61, README.md:67
- 不新增其他模型；三个分支都需要 OpenRouter 认证；GPT-6 Codex 另需 `openai-codex` 登录 —— README.md:61, README.md:69；ext:94
- 功能不替换主模型 —— README.md:90；ext:594-624, ext:939-1004（只调整请求中的档位）
- 空白输入不调用分类器，沿用当前强度 —— ext:142-147, ext:888-929；README.md:123；test:920-926
- 当前强度 = 当前分支最近一次决策；没有决策时用基线（Pi 的 thinking 设置） —— ext:882
- 用户提交时在 `input` 事件里后台启动分类（模板展开前；steer、follow-up 同样经过 input）；缓存守护暂停或不适用时不启动 —— ext:844-853, ext:819-842；rt:1502, rt:1658, rt:1680-1691（steer / followUp 入队前已触发 input）；test:1415-1429
- 扩展命令（如 `/personal`）在 input 事件之前处理，不会触发后台分类 —— rt:1489-1497
- 发请求的 `context_with_system` 按最终上下文重算分类文本；与后台任务相同就复用，不同就中止旧任务并重新分类 —— ext:888-893；test:1431-1440
- 发请求时最多再等 5 秒（`CLASSIFICATION_WAIT_MS`）；超时沿用当前强度、中止分类、丢弃迟到结果，决策照常写入且 classifier 为 null；每个会话第一次超时 warning 一次，session_start 清零 —— ext:96, ext:894-913, ext:929, ext:792-797；test:1442-1479
- 后台分类期间的回退 warning 先缓存，发请求时才显示；请求已中止的任务不再提示 —— ext:822-841, ext:893
- 后台每个分类模型仍独立限时 15 秒，首选非 Jev 模型超时或报错后单跳回退一次 Jev —— ext:95, ext:448-474, ext:636-649；test「超时后 Jev 使用独立 15 秒预算，迟到结果不能当作成功」（test:772-790）
- 图 1 底部「后台分类 · 最多再等 5 秒」即上面两条
- 分类器只收到对话文本（用户和助手消息），不含系统提示词（role 为 system 的消息）、工具结果、思考块和图片数据 —— ext:132-139, ext:888；README.md:120；test:369-381
- 四个固定分类器 ID：Jev `typesafe/jev-1.14`、d1-ultra `liquid/d1-ultra`、Mammoth 27B `baseten/mammoth-1`、Decider v1.2 `perplexity/pplx-decider-v1.2`；宿主目录未收录对应固定 ID 时从原生 `~typesafe/jev-latest` 模板补充元数据，不覆盖服务商目录 —— ext:12-37, ext:160-172；README.md:83-88, README.md:124；test:546-614
- 只回答 low、medium、high、xhigh、max —— ext:114, ext:389-404, ext:414-419；README.md:90
- 对话内容预算：当前请求最多 12,000、近期最多 6 条用户或助手消息、最多 8,000、合计不超过 16,000（JS 字符串长度，即 UTF-16 单元） —— ext:141-157
- 请求另加固定提示语（「近期对话（…）:」「当前用户请求:」）和分类规则，所以 prompt 可略超 16,000 —— ext:156, ext:386-405；test:379
- 图片换成「[附有图片]」 —— ext:136；test:927-930
- 图 1 中「虚线框是外部服务（OpenRouter）」 —— ext:94, ext:164

## 2. 分类结果怎么用（图 2）

- 「合格」：分类正常完成（stopReason 为 stop）、档位在五档内、所选档位概率是 [0.5, 1] 内的有限数，才采用 —— ext:413-419；test:920-970
- 首选非 Jev 模型超时或服务出错时先警告并回退一次 Jev；仍无合格结果才警告并沿用当前强度 —— ext:412, ext:453-473, ext:888-926；test:307-345, test:616-716, test:881-918
- 响应无法解析（缺答案、缺 confidence、概率结构无效）时 Pi 原生 classifier 返回 `stopReason: "error"`，扩展按服务报错处理 —— s1:37-55, s1:174-180；ext:412, ext:465-472
- 档位不在五档内、概率非法或 stopReason 为 length 时视为结果无效，不触发 Jev 回退，直接发一次警告并沿用当前强度；有效结果的概率低于 0.5 时也不回退，静默沿用当前强度 —— ext:413-419, ext:460-464；test:307-345, test:718-739, test:920-970
- 警告显示 HTTP 状态码和白名单中文原因（携带 Guardrail 或数据策略关键词时优先归类为「OpenRouter 策略或白名单限制」）；首选非 Jev 模型超时或报错先提示「正在切换到 openrouter/typesafe/jev-1.14」，最终无合格结果时沿用，只列出实际错误或结果无效，不把低置信度列为错误。未知错误不透出服务原文 —— ext:175-193, ext:468-472；test:616-716, test:1301-1376
- 采用、沿用和等待超时都写入决策（空白输入和等待超时的 classifier 为 null） —— ext:882-884, ext:906-908, ext:929；test:278-296, test:331, test:1442-1479
- 等待超时提醒原文：「分类等待超过 5 秒，本次沿用 〈当前强度〉；分类已中止，迟到结果不再采用。」（页面示例填 medium） —— ext:909-912
- 用户取消时不回退、不写决策、不显示新的完成通知；取消前已发出的切换提示保留 —— ext:887-936；README.md:123；test:347-367, test:792-812
- 决策按消息时间戳写入 —— ext:929
- 多条待分类消息共用一次分类流程（可能包含 Jev 回退），按最后一条用户消息作为当前请求，结果写给每条 pending 消息 —— ext:142-146, ext:874-877, ext:888-925, ext:929
- 分类中切换会话或模型，迟到结果不写入 —— ext:881, ext:928；test:881-918

## 3. Codex：为什么不改顶层参数（图 3）

- Pi 每次请求前按当前上下文构造完整 input —— codex:379-394
- 基线在 Codex 请求顶层 `reasoning.effort` —— ext:971；codex:414-424
- 缓存前缀、保留缓存前缀是 README 的设计目标 —— README.md:98；CHANGELOG.md:72
- 保留缓存前缀不保证 100% 命中；TTL、最小 token 数和其他提示变更仍会影响命中 —— README.md:98, README.md:112
- 本次 wrapper 真实通道实测：固定分类夹具强制 low → high → medium → low，真实 Antigravity 主模型的 cacheRead 为 Opus `0 / 13981 / 13994 / 14014`、Sonnet `0 / 13978 / 13991 / 14011`；基线始终 medium，实际 runtime 后缀和 message_end 字段依次为 low / high / medium / low。Opus 完整成功序列前有若干次 SAFETY 零输出尝试，未计入成功序列；固定夹具不等于真实 Jev 端到端，短时实测不是厂商保证 —— README.md:112；主代理提供的本轮验收记录
- Gemini 4 Argon 已存在，但官方资料只明确 implicit cache；未找到改变 thinking_level 保缓存的明确官方承诺，因此本次不支持。这是缺证，不是证明会丢缓存 —— README.md:116；https://ai.google.dev/gemini-api/docs/latest-model
- 启用缓存且有会话 ID 时，请求带 `prompt_cache_key` —— codex:171-173, codex:397
- WebSocket 增量续传：传输方式为 auto 或 websocket-cached；当前连接保留 continuation 和有效 lastResponseId；除 input、previous_response_id 外其余字段一致；新 input 以上次 input 加上次响应开头。全部满足才只发新增部分并带 `previous_response_id`，否则发完整请求 —— codex:184, codex:1121-1160, codex:1175-1177
- 默认传输方式是 auto —— codex:184
- before_provider_request 的改写发生在构造请求之后、发送之前 —— codex:174-177；sdk:213-218, sdk:262
- 图 3 是独立 Codex 示例（medium → xhigh），不是测试数据；「顶层不变」一行示意 configuration_update 方案下请求 2 的开头与请求 1 相同（同图 4）

## 4. 按接入分支写入档位（图 4）

### Codex

- 顶层保持基线，在用户项前插入 `{ type: "configuration_update", reasoning: { effort } }` —— ext:967-1004；test:150-183
- 注入发生在 `before_provider_request`，只改写 `input` —— ext:939, ext:1004；test:155-156
- 整轮没有任何新增 update 时原样返回；有历史 update 需要重放时仍返回新 payload —— ext:1004
- 每条 update 后紧跟一个用户项，不会相邻 —— ext:988-1000；test:179-181
- 档位先经过 `thinkingLevelMap` 映射 —— ext:442-445, ext:993
- 决策按时间戳持久化；模型、基线和已有上下文不变时，追加请求在同样位置插入同样的项，新请求开头等于上一次请求 —— ext:929, ext:967-1004；test:164, test:169, test:176, test:508, test:532
- 前提条件：改基线或模型映射后，重放可能新增或去掉 update，开头随之变化 —— ext:442-445, ext:971, ext:993-997
- 档位和当前强度相同时，当前用户项前不插入 —— ext:995-998；test:185-193
- 回到基线时也插入一条 update 抵消前一条 —— ext:995-998；test:172-177
- 仅 Codex：不能与服务端自动压缩、自动截断或 `/responses/compact` 混用；Pi 客户端压缩不受影响 —— README.md:127（源码无对应检查）
- 图 4 是独立 Codex 示例（medium、xhigh、medium）；被引测试的实际序列是 xhigh → low → medium（test:152, test:170, test:177），只用于证明注入机制

### Claude

- Pi 原生序列化器用空 system 消息的 `output_config.effort` 记录逐消息档位；扩展只替换 Pi 已生成的末尾空 system 标记，不改顶层 output_config、thinking、历史消息或 thinking blocks —— anthropic:1209-1217；ext:939-965；test:1004-1056
- 官方文档明确 `claude-opus-5`、`claude-opus-5-5`、`claude-sonnet-5-5` 支持逐消息 effort 并保持此前缓存前缀；所需 beta `mid-conversation-output-config-2026-07-01` 由 Pi 发送；其他 Opus、Sonnet 版本并非全部支持 —— README.md:114；anthropic:117, anthropic:851-853；https://platform.claude.com/docs/en/build-with-claude/effort#change-effort-mid-conversation-beta
- `claude-fable-5-2` 依据 Pi 1.5.2 目录 `supportsMidConvoEffort: true` 纳入；用 Pi 1.5.2 序列化器在网络调用前截取两轮请求：末尾标记依次 `[high]`、`[high, low]`，顶层 effort 始终 low，thinking 始终 adaptive，前一轮消息前缀相同（忽略缓存断点），message_end 保存 high、low —— ext:124；tests/fixtures/fable-5-2.pi-1.5.2.json；pi152/pi-ai/dist/providers/data/anthropic.json；pi152/pi-ai/dist/api/anthropic-messages.js:1167；test:1481-1499；report「Fable 验证」
- Fable 5.2 两轮真实请求和第二轮缓存读取未验证：真实会话预检因 `no-anthropic-auth` 失败，没有向 Fable 提供方发送请求；Antigravity 分支不加 Fable —— report「Fable 验证」；ext:127-130；test:1496-1498
- Pi v1.5.0 的 Anthropic 序列化实现和本仓库 1.0.1 依赖都有原生标记，无需升级依赖 —— README.md:114；anthropic:1209-1217；https://github.com/earendil-works/pi/blob/v1.5.0/packages/ai/src/api/anthropic-messages.ts
- `message_end` 保存实际发送的 `providerThinkingLevel`，供 Pi 重建历史 effort 标记；主会话 thinking 基线不变 —— ext:1007-1054；anthropic:1152-1156, anthropic:1210-1216；test:1004-1037
- 同一请求由提供方内部重建或重试时复用原模型快照；流式期间切换模型后，旧回复仍保存实际档位 —— ext:590, ext:792-808, ext:939-965, ext:1007-1054；test:1091-1113
- Pi 的 `max_tokens: 1` 缓存预热回放不干预；因当前没有请求 ID 可区分，`max_tokens: 1` 主请求也不自动调整，待 Pi 暴露请求 ID 后再区分 —— ext:946-947；test:1115-1135；README.md:96
- 请求形状无效、取消或生命周期清理时不覆盖 payload 或回复 —— ext:946-960, ext:1007-1054；test:1058-1089
- 验收：仓库默认依赖 `npm run check` 65/65 通过；Pi 1.5.0 临时副本的 inline-effort 测试 32/32 通过。另以 Pi 1.5.0 原生 streamSimple 和本地 HTTP 假服务触发 preferred strict 工具 400 降级重试，两次 HTTP 都发送 xhigh，最终 message_end 保存 xhigh —— 主代理提供的本轮验收记录；test:1091-1135 覆盖对应生命周期回归

### Antigravity

- pi-antigravity 0.11 不触发 onPayload；扩展在 context_with_system 分类后临时包装原生 streamSimple，只改匹配 sessionId、末条消息 timestamp 和模型的主请求 options.reasoning，再由插件按 -low / -medium / -high runtime ID 路由；max 和 xhigh 夹到 high，会话 thinking 和历史上下文不变 —— ext:594-624, ext:861-867；test:1165-1205；README.md:92
- wrapper 保留 oauth、headers、images、refreshModels；注册和恢复时携带 provider.getAllModels 当前动态目录（chat、image、classifier），按 type + id 补回 registered model.headers —— ext:617-635；test:1165-1182, test:1261-1299；README.md:92
- message_end 保存实际 providerThinkingLevel；工具续调、同一主请求重试和恢复沿用原决策；maxTokens: 1 预热和辅助 session 不干预 —— ext:599-624, ext:1007-1046；test:1165-1259；README.md:94, README.md:96
- session_shutdown 只恢复原 streamSimple，保留第三方后来对 headers 等字段的部分更新；第三方已替换 streamSimple 时不覆盖 —— ext:628-635, ext:792-814；test:1231-1299；README.md:96
- 新增 4 项 Antigravity 回归测试；真实 ModelRuntime 用例覆盖动态刷新目录、图片模型、模型级头部和第三方部分注册 —— test:1165-1299；CHANGELOG.md:43

## 5. 决策跟随会话分支（图 5）

- 决策是会话自定义条目，类型沿用旧名 `jev-inline-effort`（旧会话可直接恢复），内容 `{ timestamp, thinkingLevel, classifier }`，回退成功时另带 `fallbackFrom`，不发给模型 —— ext:91, ext:929；types:1234-1235
- 只读当前分支路径（从叶子到根）上的条目 —— ext:433-440；sm:1057-1071
- 恢复、fork、树导航后旧消息保持原档位、不重新分类 —— README.md:119；test:503-544, test:1004-1037
- 分叉后仍继承共同祖先（图中 U1）的决策，读不到分叉后另一分支（U2）的决策；新消息重新分类 —— ext:433-440；sm:1057-1071；test:257-265
- 压缩摘要承接被压缩部分的最后一次决策，强度不回落到基线 —— ext:980-992；test:238-255, test:1034-1036
- 会话开始、退出和切换模型时只清掉本扩展的 🧠 段（setStatus 只作用于 STATUS_KEY），并取消进行中的分类和后台分类；缓存守护暂停时这个位置显示暂停提示，切换模型不解除暂停，session_start 清零 —— ext:92, ext:586-587, ext:792-815；test:298-305, test:1554-1591
- 图 5 的 xhigh、low 是示例值 —— 结构参照 test:238-265

## 6. 状态栏与演示（图 6）

- 状态栏格式：当前强度不等于基线时 `🧠 当前 · 基线 基线值 · 分类器`，相等时 `🧠 基线值 · 分类器` —— ext:613, ext:964, ext:1003；test:157, test:171, test:178, test:190, test:1016
- Codex 用户项数量与本次上下文算出的数量不一致时不插入，显示 `🧠 基线 · 未调整 · 分类器` —— ext:974-978；README.md:127；test:267-276
- 分类器标签取最近一次决策；无决策或 classifier 为 null 时「未分类」 —— ext:108-113, ext:613, ext:964, ext:974
- 未获得合格档位时仍记录首选分类器；回退成功时记录实际 Jev 和回退来源（如 `Jev（d1-ultra 回退）`、`Jev（Mammoth 27B 回退）`、`Jev（Decider v1.2 回退）`） —— ext:108-113, ext:833, ext:905, ext:929；test:331, test:616-650
- Pi 自带的 thinking 显示只反映基线 —— README.md:90
- 暂停时状态栏文字固定为「🧠 自动调整暂停：检测到两次缓存重建 · /personal → 原位思考强度 → 恢复自动调整」，覆盖各分支的普通状态 —— ext:586-587；test:1569-1574
- 会话刚恢复时没有 🧠 段，下一次请求后才显示 —— ext:811（session_start 清空）, ext:599-616, ext:939-1004（发送前才设置）
- demo 的「第一条消息时当前强度等于基线」 —— ext:882；demo 只展示 Codex 的 update 和「未调整」规则 —— ext:967-1004
- demo「等待超过 5 秒（示例）」：沿用基线、不插入、标签「未分类」、提醒原文同上 —— ext:906-913；tests/effort-demo.test.mjs「讲解页演示…」末段 timeout 断言

## 7. 在 /personal 里管理（图 7 录屏 + 表）

- 菜单项与处理函数参数：查看分类模型与状态（status）、选择分类模型（model）、测试分类模型可用性（test）、恢复自动调整（resume）、运行判档测评（bench） —— entry:63-69, entry:166-186；tests/personal.test.mjs:329
- 本项目只注册 `/personal`；功能的 registerCommand 被 featureApi 截住，只存进 commands 表 —— entry:130-137, entry:139
- `/personal` 有 UI 就能用（TUI、RPC）；没有 UI 时提示并返回；批量功能开关只在 TUI —— entry:142-145, entry:190-193
- 查看状态：是否适用、后续分类器、失败回退策略、当前分支最近决策 —— ext:672-679
- 「查看分类模型与状态」和「恢复自动调整」在 agent 运行时也可用；选择、测试和测评要求空闲 —— ext:660-685, ext:773-776；test:860-879, test:1719-1728
- 暂停时状态第一项显示「暂停（检测到两次缓存重建）」 —— ext:676；test:1576-1578
- 「恢复自动调整」：未暂停时提示「当前会话未暂停自动调整。」；暂停时解除并清零计数与缓存比较基准 —— ext:660-670；test:1579-1587
- 「运行判档测评」只在 TUI；确认框说明 OpenRouter 额度；Esc 取消 —— ext:685-729；test:1719-1744
- 「选择分类模型」打开四个模型的选择器，Esc 取消不保存 —— ext:745-768
- 选择写入全局配置，从下一条未分类消息生效，旧决策不变；其他会话和子代理的后续分类也读取 —— ext:777-778, ext:833, ext:905；README.md:118；test:503-516
- 「测试分类模型可用性」用固定样例「把 hello 转成大写。」，不读会话、不写决策、不改强度 —— ext:732-743；test:834-858
- 配置无效时报错，不退回 Jev；在「选择分类模型」里重新保存可修复 —— ext:57-66；test:474-501
- 四个分类器均绑定固定模型 ID，OpenRouter 白名单只需放行实际服务商和对应模型 —— README.md:125
- 录屏 effort-status：/personal → 原位思考强度 → 二级菜单（五个设置项加「禁用此功能并重载」）→ 查看分类模型与状态，显示失败回退 Jev（仅本次）、最近决策尚无；2026-11-14 在临时 agent 目录（未复制凭据文件）用 Pi 1.5.2 重录，tape 高度改为 740，仅查看示例配置 d1-ultra，不验证模型可用性；技术版素材与使用者版逐字节相同 —— docs/extensions-usage/tapes/effort-status.tape；docs/extensions-usage/tapes/_settings.tape（裁切参数）；两版 media/effort-status.mp4、effort-status.png；ext:672-679；entry:63-69、162-169。

## 8. 子代理与代价（图 8）

- 子代理需加载本扩展，基线取子代理自己的 thinking 设置；外部 CLI 代理不经过本扩展 —— README.md:126；ext:882（基线 = pi.getThinkingLevel()）
- 分类增加等待（发请求时最多再等 5 秒）、消耗服务额度（含回退和测评），文本可能含业务信息 —— README.md:120, README.md:122；ext:96, ext:899
- 后台分类每个模型仍限时 15 秒，回退可能额外消耗 Jev 额度；等待超时后中止分类 —— ext:95, ext:457, ext:906-907；README.md:122
- 四个分类模型均按输入计费，价格以 OpenRouter 端点信息为准 —— ext:12-37；README.md:124
- 图 8 主请求框加高到 64，副标题拆成「Codex / Claude」和「Antigravity」两行，修复第二轮前单行 `Codex / Claude / Antigravity` 超出 160 宽方框的问题 —— docs/extensions-guide/src/06-effort.html（fig-effort-8）

## 按模型规则（Opus 5.5 / Sonnet 5.5 / Fable 5.2 / GPT-6 Astra / GPT-6.1 Sol）

- 两套规则：按模型规则覆盖五个模型，Opus 5 和其他 GPT-6 Codex 模型用通用规则 —— ext:213, ext:226-348, ext:382-403；test:1501-1545
- Claude 三个模型的规则移植自 auto-effort 的 `hooks/policy-text.ts`：notes 和五档 levels 与来源相同，源码注释保留 Anthropic 官方依据链接；为适配 Pi 只改两处：默认档字段 `claudeCodeDefault` 改名为 `defaultEffort`（取值仍为 medium），`COMMON_INSTRUCTIONS` 首句由「你为 Claude Code 主会话的下一轮选择 effort（推理投入）」改为「你为当前主会话的下一轮选择推理强度（effort）」 —— ext:195-211, ext:215-224, ext:226-270, ext:350-351；ref:hooks/policy-text.ts；test:1501-1545（defaultEffort、首句和不含 Claude Code 的断言）
- GPT-6 Astra（`gpt-6-astra`）和 GPT-6.1 Sol（`gpt-6.1-sol`）的 name、notes、五档 levels 按 gpt6 第 3 部分草案写入，只做三处改动：去掉方括号来源编号，改在代码注释列出 gpt6 第 0 部分的官方链接；删除 Sol notes 中标为「推断」的一句，保留「质量优先时……官方直接换成 Astra xhigh 而不是把 Sol 升到 max」；两者 defaultEffort 写 low（Codex 内置目录 default_reasoning_level） —— ext:271-348；gpt6 第 0、3 部分；test:1501-1545（不含方括号、「推断」「suggestModel」，保留官方事实句）；本轮用脚本把草案去编号、去推断句后与源码逐项比对，五档和 notes 全部相等
- 页面要点「Astra 档位刻度偏强，官方推荐器从不推荐 max」「Sol 质量优先时官方换成 Astra xhigh，而不是把 Sol 升到 max」 —— ext:290, ext:293, ext:313, ext:326
- 两个 GPT 模型的 ID 取自 Pi 1.5.2 的 `openai-codex` 目录；其 thinkingLevelMap 把 low～max 映射到同名档位。官方 API 档位就是 low、medium、high、xhigh、max，与分类结果一一对应，不需要映射；Codex 分支按 thinkingLevelMap 映射和插入 configuration_update 的逻辑不变 —— pi152/pi-ai/dist/providers/data/openai-codex.json（chat:gpt-6-astra、chat:gpt-6.1-sol）；gpt6 第 1 部分第 1 条；ext:283, ext:354-357（apiEffort）
- 组题方式同 auto-effort 的 `systemOneQuestion`：instructions = 共用原则 + 「当前模型：名称。说明」，criteria = 该模型五档条件 —— ext:382-392；ref:hooks/policy-text.ts:115-122；test:1501-1545
- 只对这五个模型 ID 生效，Anthropic 协议和 Antigravity 的同名 Claude 模型共用；分类时另传当前强度 `currentEffort` —— ext:382, ext:387, ext:821, ext:882；test:1501-1545
- 共用原则按工作阶段、隐藏边界情况密度、自主执行长度判断，并列出进展信号 —— ext:351-368
- Opus 5 和其他 GPT-6 Codex 模型（测试覆盖 `gpt-6-sol`、`gpt-6.1-terra`、`gpt-6-luna`）用通用规则，不传当前强度 —— ext:387, ext:393-403；test:1501-1545（generic 断言）
- 测试默认 Codex 模型改为 `gpt-6-sol`，让其余 Codex 机制测试继续走通用规则 —— test:27-28

## 按推理结构选档（通用规则）

- low 直接执行明确操作，medium 判断可在局部完成，high 综合多项行为或交付约束，xhigh 消解冲突证据、排查混杂解释或检验跨边界行为；max 是需系统反证、严格推导与失效分析的例外攻坚，或需有排除外部阻碍后深入分析仍不足的具体证据 —— ext:396-402；test:1378-1412（四种分类器共用提示契约，不验证线上语义效果）
- 近期对话只补全同任务的目标、约束和交付要求；不继承旧难度，简短的继续或修改也结合前文判断；不按主题、代理数量、精美成片、操作敏感或重试提档；high 仅在无法识别任务要求时保守兜底，不替代模型专长、授权与实测 —— ext:395；test:1392-1399
- 字号调整、图示设计、查数画图与混杂归因为判据示例，不是线上分类保证 —— ext:397-400；test:1378-1412 只校验发送内容
- 分类看不到图片与工具结果，同轮工具续调不重分类，已有历史决策不变；修改提示不改变输入或映射 —— ext:132-157, ext:608, ext:872-925, ext:958-960, ext:992-996

## 缓存守护（图 9）

- 只看主会话助手回复：api、provider、model 与本次请求一致；stopReason 不是 error / aborted；usage.cacheRead 为有限非负数 —— ext:1007-1015；test:1611-1630
- 「调整过档位」：Codex 插入了 configuration_update；Anthropic 协议分支按决策改写了末尾标记；Antigravity 有决策 —— ext:1002, ext:963, ext:612, ext:1023；test:1675-1689, test:1801-1812
- 判定：上一次读取 > 0，且本次读取 < 上一次读取；只是写入变大不算 —— ext:1021-1023；test:1554-1566（100 → 80 触发）、test:1611-1630（写入 99999 但读取不减不触发）
- 为什么不看写入：Pi 把 cache_control 放在最后一条 user 或 system 消息上，一次读入很长的工具结果会让写入很大，但读取不会变少 —— pi152/pi-ai/dist/api/anthropic-messages.js:1408-1428；ext:1018
- 三种正常失效跳过本次判断，并以本次读取作为下一次比较的基准：两次主请求开始时刻相隔超过缓存保留时间；上一次判断以来发生过压缩（session_compact）或树导航（session_tree）；模型（provider / api / id）变了，model_select 也清空基准 —— ext:106, ext:582-585, ext:800-801, ext:816-817, ext:1021-1022, ext:1036-1037；test:1632-1673
- 保留时间取模型目录 `promptCache.short`；没有时用 `DEFAULT_CACHE_TTL_MS` = 5 分钟；间隔等于保留时间仍判断，超过才跳过 —— ext:97-105；test:1632-1673（300000 / 300001 ms，promptCache.short = 60 时 60000 / 60001 ms）
- Pi 1.5.2 对 Anthropic 请求默认 short 保留：cache_control 为 `{ type: "ephemeral" }` 不带 ttl；`PI_CACHE_RETENTION=long` 且模型支持时才是 1h；目录 promptCache 为 `{ short: 300, long: 3600 }` —— pi152/pi-ai/dist/api/anthropic-messages.js:28-47；pi152/pi-ai/dist/providers/data/anthropic.json；tests/fixtures/fable-5-2.pi-1.5.2.json
- 间隔按两次请求的开始时刻计算：startedAt 在发请求前记录；Pi 的 CacheWarmer 在 streamFn 发送前 start()，以 Date.now() 计 startedAt 和下次预热时刻 —— ext:612, ext:860, ext:963, ext:1002, ext:1019-1022；pi152/pi-coding-agent/dist/core/sdk.js:261-270；pi152/pi-coding-agent/dist/core/cache-warmer.js:56-92, 132-146；test:1632-1673（上一轮回复 6 分钟后立即请求，不触发）
- 用 short 计算偏保守：真实保留更长时只会多跳过 —— ext:97-100；pi152/pi-ai/dist/cache-warming.js:26-33（getPromptCacheTtlMs 按 retention 取 promptCache）
- 警告文案以「检测到缓存重建」开头，写明两次读取量、可能原因（改档改变前缀、服务端提前清除缓存、其他扩展改系统提示词或工具）和已排除的情况；页面里的 80 / 100 是示例数值 —— ext:1026-1028；test:1554-1566
- 每个用户轮次最多计一次（新的待分类用户消息时重置） —— ext:879, ext:1023-1024；test:1593-1609
- 累计两次暂停：中止后台分类，状态栏显示暂停；暂停期间 input 不启动分类、context_with_system 不调用分类器、沿用当前强度 —— ext:1029-1034, ext:845, ext:889；test:1554-1574
- 暂停与计数只在扩展内存；model_select 保留暂停并清空比较基准，session_start 全部清零；「恢复自动调整」清零计数和基准 —— ext:578-585, ext:792-801, ext:664-667；test:1576-1591
- 图 9 是判断流程示意，不含实测数字

## 判档测评（图 10）

- 75 个用例 × 3 个规则模型 = 225 次分类；20 个 holdout；19 个带近期对话；按运行时文本预算拼分类文本 —— ext:478-496, ext:512-538；extensions/inline-effort-data/judge-cases.json；test:1691-1717
- 用当前分类器和运行时相同的回退规则；只调用分类器 —— ext:704-706, ext:637-649；test:1746-1788
- 测评期间不逐条弹回退警告：classifyEffort 的 onFallback 默认弹出「正在切换」警告，测评传入记录函数，把原因记到该用例 —— ext:447-451, ext:471, ext:500-503, ext:517-520, ext:704-706；test:1746-1788（warnings 只有一条汇总，没有「正在切换」）
- 汇总末尾写回退到 Jev 的次数和按原因的分布（按次数从多到少，原因是 classificationFailure 白名单归类后的文字），次数包括 Jev 也失败的用例；直接选 Jev 时不写这一行；页面里的 225 次 / HTTP 429 是示例 —— ext:549-556, ext:559-566, ext:725；test:1691-1717, test:1746-1788
- 正常对话中的回退提示不变 —— ext:451；test:1746-1788（测评后普通请求仍弹「正在切换」）
- 统计：全部 / holdout 命中、偏低、偏高、无效（无可采用档位，含服务错误）、中位耗时 —— ext:527-548；test:1691-1744
- 明细写到 `getAgentDir()/inline-effort-bench/`，flag wx、mode 0600，只含 ID、规则模型、holdout、当前强度、可接受档位、实际档位、分类器、回退来源、回退原因、结果和耗时，不含消息原文；报告另含 fallbacks 汇总 —— ext:507-511, ext:533-535, ext:556, ext:721-724；test:1746-1788
- 要求空闲且在 TUI；确认框说明额度；确认期间开始工作或切换会话则不运行；Esc 或 dispose 中止 —— ext:681-729；test:1719-1799
- 用例文件与 claude-auto-effort `bench/judge-cases.json` 逐字节一致；后者由 HeyCubit/effortless 用例按模型标注派生；MIT 许可全文随包交付 —— extensions/inline-effort-data/THIRD_PARTY.md；ref:bench/THIRD_PARTY.md；report「验证」（cmp）；package.json `files` 含 `extensions`
- 实测（2026-11-14，Jev `typesafe/jev-1.14`，Pi 1.5.2，直接调用测评函数）：Opus 5.5 74/75、holdout 20/20、偏低 0、偏高 0、无效 1、中位 414ms；Sonnet 5.5 65/75、18/20、5、1、4、406ms；Fable 5.2 70/75、19/20、3、1、1、402ms；225 次调用均返回用量、服务错误 0、输入 357,495 tokens、费用 0.01501479 美元 —— report「真实 Jev 测评」；/tmp/pi-inline-effort-benchmark-20261114.json（summary、calls、reportedCost、inputTokens）

## 改名与兼容（inline-effort）

- 文件、功能 ID、配置文件名从 jev-inline-effort 改为 inline-effort —— entry:14, entry:42；ext:46, ext:71；README.md:172, README.md:182
- `inline-effort.json` 读取返回 ENOENT 时才读 `jev-inline-effort.json`；新文件格式或内容无效时报错，不回退 —— ext:44-67；README.md:184
- 保存只写 `inline-effort.json`，旧文件保留不改写 —— ext:69-82；test:430-458；README.md:184
- 开关新键 `inline-effort` 存在时以新键为准，否则读旧键 `jev-inline-effort`；旧键仍须为布尔值 —— entry:103-112, entry:121-122；README.md:182
- 会话决策条目类型和状态栏键仍为 `jev-inline-effort`，旧会话可直接恢复 —— ext:90-92；README.md:185

## 自动回退与安全原因

- 只有合法档位、有限且位于 [0, 1] 的概率才可归为低置信度；0 静默，0.5 可采用，非法概率、截断或缺答案视为结果无效。结果无效与低置信度均不触发 Jev 回退，直接沿用最近档位并持久化（结果无效发一次警告，低置信度静默），恢复和工具续调不重复分类 —— ext:413-419, ext:460-464；test「分类不可用、出错、超时、截断、低置信度或结果无效时沿用当前生效强度」（test:307-345）；test「低置信度沿用上次决策，工具续调与恢复不重复分类」（test:718-739）；test「空输入、图片、概率边界和无效答案按规则处理」（test:920-970）。
- 固定样例测试仅低置信度时返回普通 info 提示，不发 warning、不回退，不写决策或改变状态 —— test「可用性测试只发送固定样例，成功、低置信度和失败均不写决策或改变状态」（test:834-858）。

- 首选非 Jev 模型（`d1-ultra`、`mammoth-27b`、`decider`）在请求超时或服务报错时，依次尝试首选模型、Jev（`typesafe/jev-1.14`），先发切换 warning；Jev 返回低置信度时仅警告首选模型的真实错误并沿用当前强度，Jev 返回结果无效或报错时合并列出两条错误并沿用。每模型独立 15 秒，最多约 30 秒；全局选择不变，下条新消息重新尝试首选 —— ext:453-473；test:616-716, test:771-790。
- 回退成功记录 classifier=jev、fallbackFrom=首选模型键；状态栏显示 `Jev（〈首选模型〉 回退）`。恢复和工具续调沿用，不破坏历史前缀；Claude、Antigravity 同样生效 —— test:741-769, test:814-832。
- HTTP 429 显示服务限流、携带 Guardrail 关键词的 404/403 显示 OpenRouter 策略或白名单限制、5xx 显示上游服务异常；未知原因明确提示未识别。不输出服务端原文或凭据。回退警告在 Jev 调用前出现；成功后显示实际模型和档位，未获合格档位时只列出实际错误或结果无效，低置信度不警告 —— ext:175-193；test:616-716, test:1301-1376。
- 用户取消或生命周期切换不继续回退，不写迟到决策或显示完成通知；已经发出的切换提示保留。空白输入不调用、配置无效不尝试任何模型 —— test:347-367, test:474-501, test:792-812。
- 固定样例可用性测试走同一回退流程，不把 Jev 成功说成首选模型成功，不改会话决策、状态或基线 —— test:834-858, test:1301-1376。
- 演示区用本地固定示例模拟 Jev 返回 low，不发送 API 请求、不保证线上结果；仅服务报错可回退，结果无效与低置信度不回退并沿用基线 —— tests/effort-demo.test.mjs。

- 本轮重录 personal-menu、personal-switches、statusline-style，后者包含第五项标题开关及状态栏标题；其他认证/聊天录屏保留历史画面并在紧邻图注中标明标题位置已变化，不伪造模型调用 —— docs/extensions-usage/tapes/；两版页面可见历史录屏图注。
- 删除原视频审查后（/personal 一级菜单和批量开关各少一项），在按 _settings.tape 创建的临时 agent 目录重录 personal-menu、personal-switches、statusline-style、clickable-paths-status、effort-status、effort-model，画面中一级菜单为五项功能加「批量功能开关」；前三个录制前移除了临时目录里的凭据文件，后三个保留凭据文件但不发送模型消息；随后重录 auto-name-model、auto-name-status（旧画面的一级菜单还有已合并的「右下角会话标题」），保留凭据文件但不发送模型消息，两个 tape 去掉一级菜单里多余的一次下移；未重录的只剩 chat-turn —— docs/extensions-usage/tapes/；docs/extensions-usage/media/；extensions/pi-personal-extensions.ts:16-47
- 2026-11-14 因原位思考强度二级菜单从三项增至五项，重录 effort-status、effort-model；用 gemini-video（gemini-4-carbon，4 fps，high）审查：步骤和画面文字与图注一致；effort-model 初剪结尾缺少 Esc 返回，已把截止点从 8.0 秒延到 9.0 秒并复查通过 —— docs/extensions-usage/media/；docs/extensions-usage/tapes/_settings.tape
