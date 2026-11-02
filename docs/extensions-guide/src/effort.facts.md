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
- 入口 `/personal` → 原位思考强度（Jev / d1-ultra）→ 菜单项；处理函数以 `effort` 名存进 commands 表，不注册成斜杠命令 —— ext:230；entry:50, entry:70-74, entry:129-134, entry:139
- 配置文件在 agent 目录下的 `inline-effort.json`；agent 目录默认 `~/.pi/agent/`，`PI_CODING_AGENT_DIR` 可覆盖 —— ext:23-26, ext:48；config:453-458；README.md:107, README.md:119
- 默认分类器 Jev，可选 d1-ultra —— ext:11-14, ext:35, ext:40

## 1. 什么时候分类（图 1）

- 「原位」：Codex 顶层 reasoning.effort 保持基线，档位作为 configuration_update 写在 input 里当前用户项之前；Claude 只改 Pi 已生成的末尾空 system 消息中的 output_config.effort —— ext:396-428, ext:366-390
- 「适用」：主模型属于支持矩阵，且 thinking 不为 `off` —— ext:306-308

- 每条新用户消息选一个档位并记为决策 —— ext:322-356
- 工具续调和重试不再分类（已有决策的时间戳跳过；最后一条助手消息之后没有新用户消息就不分类） —— ext:322-334；README.md:91；test:138-142, test:453-455
- steer、follow-up 追加的用户消息也分类；自定义消息和 bash 命令输出不触发分类 —— ext:177-185, ext:330-333；README.md:91；test:195-214
- GPT-6 Codex 适用条件：接口 `openai-codex-responses`、模型 ID 以 `gpt-6` 开头、thinking 不是 `off` —— ext:70, ext:80-82, ext:306-308；test:173-193
- Claude 适用条件：接口 `anthropic-messages`、`compat.supportsMidConvoEffort === true`、模型 ID 精确等于 `claude-opus-5`、`claude-opus-5-5` 或 `claude-sonnet-5-5`，且 thinking 不是 `off`；不新增其他模型 —— ext:84-88, ext:306-308；test:173-193；README.md:58-67
- 两类模型都需要 OpenRouter 认证；GPT-6 Codex 另需 `openai-codex` 登录 —— README.md:58；ext:71
- 功能不替换主模型 —— README.md:82；ext:366-390, ext:392-428（只调整请求中的档位）
- 空白输入不调用分类器，沿用当前强度 —— ext:105, ext:343-347；README.md:93；test:599-603
- 当前强度 = 当前分支最近一次决策；没有决策时用基线（Pi 的 thinking 设置） —— ext:338
- 分类最多等 15 秒 —— ext:72, ext:160, ext:214；test:79, test:560-565
- 分类器只收到对话文本（用户和助手消息），不含系统提示词（role 为 system 的消息）、工具结果、思考块和图片数据 —— ext:90-97, ext:343；README.md:92；test:332-344
- 分类器 ID：Jev `~typesafe/jev-latest`，d1-ultra `liquid/d1-ultra`；d1-ultra 付费 —— ext:12-13；README.md:80-81, README.md:94
- 只回答 low、medium、high、xhigh、max —— ext:77, ext:151-155, ext:167-173；README.md:82
- 对话内容预算：当前请求最多 12,000、近期最多 6 条用户或助手消息、最多 8,000、合计不超过 16,000（JS 字符串长度，即 UTF-16 单元） —— ext:100-114
- 请求另加固定提示语（「近期对话（…）:」「当前用户请求:」）和分类规则，所以 prompt 可略超 16,000 —— ext:114, ext:145-157；test:342
- 图片换成「[附有图片]」 —— ext:94；test:604-607
- 图 1 中「虚线框是外部服务（OpenRouter）」 —— ext:71, ext:118

## 2. 分类结果怎么用（图 2）

- 「合格」：分类正常完成（stopReason 为 stop）、档位在五档内、所选档位概率是 [0.5, 1] 内的有限数，才采用 —— ext:167-173；test:599-623
- 超时、服务出错时沿用当前强度并弹警告 —— ext:166, ext:222-224, ext:345-353；test:285-308（warned 分支 test:302-304）, test:560-597
- 响应无法解析（缺答案、缺 confidence、概率结构无效）时 Pi 原生 classifier 返回 `stopReason: "error"`，扩展按出错处理并警告 —— s1:37-55, s1:174-180；ext:166, ext:352
- 档位不在五档内、概率低于 0.5、stopReason 为 length 时静默沿用，不警告 —— ext:167-173；test:285-308
- 警告原文 `openrouter/<模型 ID> 不可用，思考强度沿用 <档位>。不会切换分类模型；请在 /personal → 原位思考强度（Jev / d1-ultra） → 选择分类模型（Jev / d1-ultra） 或「测试分类模型可用性」中检查。`（页面和 demo 已补全） —— ext:73, ext:352
- 采用和沿用都写入决策（空白输入也写，classifier 为 null） —— ext:336-339, ext:356；test:256-274, test:301
- 用户取消时不写决策、不警告 —— ext:345-360；README.md:93；test:310-330
- 决策按消息时间戳写入 —— ext:356
- 多条待分类消息只调用一次分类器，按最后一条用户消息作为当前请求，结果写给每条 pending 消息 —— ext:100-103, ext:330-335, ext:343-347, ext:356
- 分类中切换会话或模型，迟到结果不写入 —— ext:337, ext:355；test:560-597

## 3. Codex：为什么不改顶层参数（图 3）

- Pi 每次请求前按当前上下文构造完整 input —— codex:379-394
- 基线在 Codex 请求顶层 `reasoning.effort` —— ext:396；codex:414-424
- 缓存前缀、保留缓存前缀是 README 的设计目标 —— README.md:86；CHANGELOG.md:34（仓库未验证服务端 prompt cache 命中规则）
- 保留缓存前缀不保证 100% 命中；TTL、最小 token 数和其他提示变更仍会影响命中 —— README.md:86
- Gemini 4 Argon 已存在，但官方资料只明确 implicit cache；未找到改变 thinking_level 保缓存的明确官方承诺，因此本次不支持。这是缺证，不是证明会丢缓存 —— README.md:88；https://ai.google.dev/gemini-api/docs/latest-model
- 启用缓存且有会话 ID 时，请求带 `prompt_cache_key` —— codex:171-173, codex:397
- WebSocket 增量续传：传输方式为 auto 或 websocket-cached；当前连接保留 continuation 和有效 lastResponseId；除 input、previous_response_id 外其余字段一致；新 input 以上次 input 加上次响应开头。全部满足才只发新增部分并带 `previous_response_id`，否则发完整请求 —— codex:184, codex:1121-1160, codex:1175-1177
- 默认传输方式是 auto —— codex:184
- before_provider_request 的改写发生在构造请求之后、发送之前 —— codex:174-177；sdk:213-218, sdk:262
- 图 3 是独立 Codex 示例（medium → xhigh），不是测试数据；「顶层不变」一行示意 configuration_update 方案下请求 2 的开头与请求 1 相同（同图 4）

## 4. 按接口写入档位（图 4）

### Codex

- 顶层保持基线，在用户项前插入 `{ type: "configuration_update", reasoning: { effort } }` —— ext:392-428；test:128-161
- 注入发生在 `before_provider_request`，只改写 `input` —— ext:365, ext:428；test:133-134
- 整轮没有任何新增 update 时原样返回；有历史 update 需要重放时仍返回新 payload —— ext:428
- 每条 update 后紧跟一个用户项，不会相邻 —— ext:419-424；test:157-159
- 档位先经过 `thinkingLevelMap` 映射 —— ext:196-199, ext:417
- 决策按时间戳持久化；模型、基线和已有上下文不变时，追加请求在同样位置插入同样的项，新请求开头等于上一次请求 —— ext:356, ext:392-428；test:142, test:147, test:154, test:458, test:482
- 前提条件：改基线或模型映射后，重放可能新增或去掉 update，开头随之变化 —— ext:196-199, ext:396, ext:417-422
- 档位和当前强度相同时，当前用户项前不插入 —— ext:419-422；test:163-171
- 回到基线时也插入一条 update 抵消前一条 —— ext:419-422；test:150-155
- 仅 Codex：不能与服务端自动压缩、自动截断或 `/responses/compact` 混用；Pi 客户端压缩不受影响 —— README.md:97（源码无对应检查）
- 图 4 是独立 Codex 示例（medium、xhigh、medium）；被引测试的实际序列是 xhigh → low → medium（test:130, test:148, test:155），只用于证明注入机制

### Claude

- Pi 原生序列化器用空 system 消息的 `output_config.effort` 记录逐消息档位；扩展只替换 Pi 已生成的末尾空 system 标记，不改顶层 output_config、thinking、历史消息或 thinking blocks —— anthropic:1209-1217；ext:366-390；test:658-710
- 三个指定模型支持逐消息 effort 并保持此前缓存前缀；所需 beta `mid-conversation-output-config-2026-07-01` 由 Pi 发送；其他 Opus、Sonnet 版本并非全部支持 —— README.md:86；anthropic:117, anthropic:851-853；https://platform.claude.com/docs/en/build-with-claude/effort#change-effort-mid-conversation-beta
- Pi v1.5.0 的 Anthropic 序列化实现和本仓库 1.0.1 依赖都有原生标记，无需升级依赖 —— README.md:86；anthropic:1209-1217；https://github.com/earendil-works/pi/blob/v1.5.0/packages/ai/src/api/anthropic-messages.ts
- `message_end` 保存实际发送的 `providerThinkingLevel`，供 Pi 重建历史 effort 标记；主会话 thinking 基线不变 —— ext:431-439；anthropic:1152-1156, anthropic:1210-1216；test:658-691
- 同一请求由提供方内部重建或重试时复用原模型快照；流式期间切换模型后，旧回复仍保存实际档位 —— ext:202-207, ext:309-315, ext:365-390, ext:431-439；test:745-767
- Pi 的 `max_tokens: 1` 缓存预热回放不干预；因当前没有请求 ID 可区分，`max_tokens: 1` 主请求也不自动调整，待 Pi 暴露请求 ID 后再区分 —— ext:372-373；test:769-789；README.md:84
- 请求形状无效、取消或生命周期清理时不覆盖 payload 或回复 —— ext:372-386, ext:431-439；test:712-743
- 验收：仓库默认依赖 `npm run check` 61/61 通过；Pi 1.5.0 临时副本的 inline-effort 测试 28/28 通过。另以 Pi 1.5.0 原生 streamSimple 和本地 HTTP 假服务触发 preferred strict 工具 400 降级重试，两次 HTTP 都发送 xhigh，最终 message_end 保存 xhigh —— 主代理提供的本轮验收记录；test:745-789 覆盖对应生命周期回归

## 5. 决策跟随会话分支（图 5）

- 决策是会话自定义条目，类型沿用旧名 `jev-inline-effort`（旧会话可直接恢复），内容 `{ timestamp, thinkingLevel, classifier }`，不发给模型 —— ext:68, ext:356；types:1234-1235
- 只读当前分支路径（从叶子到根）上的条目 —— ext:187-194；sm:1057-1071
- 恢复、fork、树导航后旧消息保持原档位、不重新分类 —— README.md:91；test:453-494, test:658-691
- 分叉后仍继承共同祖先（图中 U1）的决策，读不到分叉后另一分支（U2）的决策；新消息重新分类 —— ext:187-194；sm:1057-1071；test:235-243
- 压缩摘要承接被压缩部分的最后一次决策，强度不回落到基线 —— ext:405-417；test:216-233, test:688-690
- 会话开始、退出和切换模型时只清掉本扩展的 🧠 段（setStatus 只作用于 STATUS_KEY），并取消进行中的分类 —— ext:69, ext:309-320；test:276-283
- 图 5 的 xhigh、low 是示例值 —— 结构参照 test:216-243

## 6. 状态栏与演示（图 6）

- 状态栏格式：当前强度不等于基线时 `🧠 当前 · 基线 基线值 · 分类器`，相等时 `🧠 基线值 · 分类器` —— ext:389, ext:427；test:135, test:149, test:156, test:168, test:670
- Codex 用户项数量与本次上下文算出的数量不一致时不插入，显示 `🧠 基线 · 未调整 · 分类器` —— ext:400-403；README.md:97；test:245-254（状态 test:250）
- 分类器标签取最近一次决策；无决策或 classifier 为 null 时「未分类」 —— ext:74-76, ext:389, ext:398
- 分类失败时决策仍记录所选分类器 —— ext:346, ext:356；test:301
- Pi 自带的 thinking 显示只反映基线 —— README.md:82
- 会话刚恢复时没有 🧠 段，下一次请求后才显示 —— ext:316（session_start 清空）, ext:365-427（before_provider_request 才设置）
- demo 的「第一条消息时当前强度等于基线」 —— ext:338；demo 只展示 Codex 的 update 和「未调整」规则 —— ext:392-428

## 7. 在 /personal 里管理（图 7 录屏 + 表）

- 菜单项与处理函数参数：查看分类模型与状态（status）、选择分类模型（model）、测试分类模型可用性（test） —— entry:70-74, entry:171-178
- 本项目只注册 `/personal`；功能的 registerCommand 被 featureApi 截住，只存进 commands 表 —— entry:129-134, entry:139
- `/personal` 有 UI 就能用（TUI、RPC）；没有 UI 时提示并返回；批量功能开关只在 TUI —— entry:142-145, entry:190-193
- 查看状态：是否适用、后续分类器、当前分支最近决策 —— ext:240-247
- 「查看分类模型与状态」在 agent 运行时也可用；选择和测试要求空闲 —— ext:240-252, ext:293-296；test:539-558
- 「选择分类模型」打开选择器，Esc 取消不保存 —— ext:265-287
- 选择写入全局配置，从下一条未分类消息生效，旧决策不变；其他会话和子代理的后续分类也读取 —— ext:297-298, ext:346；README.md:90；test:453-466
- 「测试分类模型可用性」用固定样例「把 hello 转成大写。」，不读会话、不写决策、不改强度 —— ext:256-263；test:514-537
- 配置无效时报错，不退回 Jev；在「选择分类模型」里重新保存可修复 —— ext:34-43；test:424-451
- OpenRouter 白名单需放行实际服务商和模型；Latest 别名还需放行解析后的固定版本 —— README.md:95
- 录屏 effort-status：/personal → 原位思考强度 → 查看分类模型与状态，输出原文见 scratchpad/recapture-actual.md（最近决策：尚无，指向菜单路径） —— ext:244；entry:71

## 8. 子代理与代价（图 8）

- 子代理需加载本扩展，基线取子代理自己的 thinking 设置；外部 CLI 代理不经过本扩展 —— README.md:96；ext:338（基线 = pi.getThinkingLevel()）
- 分类增加等待、消耗服务额度，文本可能含业务信息 —— README.md:92
- d1-ultra 付费，价格以 OpenRouter 端点信息为准 —— README.md:94

## 改名与兼容（inline-effort）

- 文件、功能 ID、配置文件名从 jev-inline-effort 改为 inline-effort —— entry:15, entry:49；ext:23, ext:48；README.md:115
- `inline-effort.json` 读取返回 ENOENT 时才读 `jev-inline-effort.json`；新文件格式或内容无效时报错，不回退 —— ext:23-44；README.md:125
- 保存只写 `inline-effort.json`，旧文件保留不改写 —— ext:46-59；test:380-408；README.md:125
- 开关新键 `inline-effort` 存在时以新键为准，否则读旧键 `jev-inline-effort`；旧键仍须为布尔值 —— entry:106-113, entry:121-122；README.md:124
- 会话决策条目类型和状态栏键仍为 `jev-inline-effort`，旧会话可直接恢复 —— ext:67-69；README.md:126
