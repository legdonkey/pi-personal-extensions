# effort 章节事实清单

路径缩写：
- `ext` = `extensions/jev-inline-effort.ts`
- `test` = `tests/jev-inline-effort.test.mjs`
- `entry` = `extensions/pi-personal-extensions.ts`
- `codex` = `node_modules/@earendil-works/pi-ai/dist/api/openai-codex-responses.js`
- `s1` = `node_modules/@earendil-works/pi-ai/dist/api/system-one-shared.js`
- `sdk` = `node_modules/@earendil-works/pi-coding-agent/dist/core/sdk.js`
- `types` = `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
- `sm` = `node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js`
- `config` = `node_modules/@earendil-works/pi-coding-agent/dist/config.js`
- `tape` = `docs/extensions-guide/tapes/effort-status.tape`

## 头部

- 功能 ID `jev-inline-effort`，菜单 label「原位思考强度（Jev / d1-ultra）」 —— entry:56-57
- 入口 `/personal` → 原位思考强度（Jev / d1-ultra）→ 菜单项；处理函数以 `effort` 名存进 commands 表，不注册成斜杠命令 —— ext:213；entry:57, entry:77-83, entry:130-135, entry:140
- 配置文件在 agent 目录下的 `jev-inline-effort.json`；agent 目录默认 `~/.pi/agent/`，`PI_CODING_AGENT_DIR` 可覆盖 —— ext:24, ext:39；config:453-458；README.md:98, README.md:108
- 默认分类器 Jev，可选 d1-ultra —— ext:11-14, ext:26, ext:31

## 1. 什么时候分类（图 1）

- 「原位」：顶层 reasoning.effort 保持基线，档位作为 configuration_update 写在 input 里当前用户项之前 —— ext:347, ext:364-376
- 「适用」= 三个条件同时满足 —— ext:289-290

- 每条新用户消息选一个档位并记为决策 —— ext:308-334
- 工具续调和重试不再分类（已有决策的时间戳跳过；最后一条助手消息之后没有新用户消息就不分类） —— ext:309-313；README.md:80；test:138-142, test:408-411
- steer、follow-up 追加的用户消息也分类；自定义消息和 bash 命令输出不触发分类 —— ext:310-312；README.md:80；test:189-208
- 适用条件：接口 `openai-codex-responses`、模型 ID 以 `gpt-6` 开头、thinking 不是 `off`；不满足时不分类、不改写请求 —— ext:60, ext:70-72, ext:289-290, ext:304, ext:345；test:172-187
- 需要 OpenRouter 认证和 `openai-codex` 登录 —— README.md:59；ext:61
- 功能不替换主模型 —— README.md:77；ext:372（只插入 reasoning.effort）
- 空白输入不调用分类器，沿用当前强度 —— ext:89, ext:323-326；README.md:82；test:549-554
- 当前强度 = 当前分支最近一次决策；没有决策时用基线（Pi 的 thinking 设置） —— ext:316
- 分类最多等 15 秒 —— ext:62, ext:144, ext:197；test:79
- 分类器只收到对话文本（用户和助手消息），不含系统提示词（role 为 system 的消息）、工具结果、思考块和图片数据 —— ext:74-81, ext:321；README.md:81；test:326-338
- 分类器 ID：Jev `~typesafe/jev-latest`，d1-ultra `liquid/d1-ultra`；d1-ultra 付费 —— ext:12-13；README.md:74-75, README.md:83
- 只回答 low、medium、high、xhigh、max —— ext:67, ext:134-140, ext:155-156；README.md:77
- 对话内容预算：当前请求最多 12,000、近期最多 6 条用户或助手消息、最多 8,000、合计不超过 16,000（JS 字符串长度，即 UTF-16 单元） —— ext:88-96
- 请求另加固定提示语（「近期对话（…）:」「当前用户请求:」）和分类规则，所以 prompt 可略超 16,000 —— ext:98, ext:129-141；test:336
- 图片换成「[附有图片]」 —— ext:78；test:556-559
- 图 1 中「虚线框是外部服务（OpenRouter）」 —— ext:61, ext:103

## 2. 分类结果怎么用（图 2）

- 「合格」：分类正常完成（stopReason 为 stop）、档位在五档内、所选档位概率是 [0.5, 1] 内的有限数，才采用 —— ext:151-157；test:560-567
- 超时、服务出错时沿用当前强度并弹警告 —— ext:150, ext:205-207, ext:327-331；test:279-302（warned 分支 test:296-298）, test:510
- 响应无法解析（缺答案、缺 confidence、概率结构无效）时 Pi 原生 classifier 返回 `stopReason: "error"`，扩展按出错处理并警告 —— s1:37-55, s1:174-180；ext:150, ext:330
- 档位不在五档内、概率低于 0.5、stopReason 为 length 时静默沿用，不警告 —— ext:151-157；test:279-302
- 警告原文 `openrouter/<模型 ID> 不可用，思考强度沿用 <档位>。不会切换分类模型；请在 /personal → 原位思考强度（Jev / d1-ultra） → 选择分类模型（Jev / d1-ultra） 或「测试分类模型可用性」中检查。`（页面和 demo 已补全） —— ext:63, ext:330
- 采用和沿用都写入决策（空白输入也写，classifier 为 null） —— ext:317-318, ext:334；test:254-256, test:295
- 用户取消时不写决策、不警告 —— ext:327-329, ext:335-338；README.md:82；test:304-324
- 决策按消息时间戳写入 —— ext:334
- 多条待分类消息只调用一次分类器，按最后一条用户消息作为当前请求，结果写给每条 pending 消息 —— ext:85-88, ext:310-312, ext:321-325, ext:334
- 分类中切换会话或模型，迟到结果不写入 —— ext:315, ext:333；test:510-547

## 3. 为什么不改顶层参数（图 3）

- Pi 每次请求前按当前上下文构造完整 input —— codex:379-394
- 基线在请求顶层 `reasoning.effort` —— ext:56, ext:347；codex:414-424
- 缓存前缀、保留缓存前缀是 README 的设计目标 —— README.md:77；CHANGELOG.md:11（仓库未验证服务端 prompt cache 命中规则）
- 启用缓存且有会话 ID 时，请求带 `prompt_cache_key` —— codex:171-173, codex:397
- WebSocket 增量续传：传输方式为 auto 或 websocket-cached；当前连接保留 continuation 和有效 lastResponseId；除 input、previous_response_id 外其余字段一致；新 input 以上次 input 加上次响应开头。全部满足才只发新增部分并带 `previous_response_id`，否则发完整请求 —— codex:184, codex:1121-1160, codex:1175-1177
- 默认传输方式是 auto —— codex:184
- before_provider_request 的改写发生在构造请求之后、发送之前 —— codex:174-177；sdk:213-218, sdk:262
- 图 3 是独立示例（medium → xhigh），不是测试数据；「顶层不变」一行示意 configuration_update 方案下请求 2 的开头与请求 1 相同（同图 4）

## 4. 插入 configuration_update（图 4）

- 顶层保持基线，在用户项前插入 `{ type: "configuration_update", reasoning: { effort } }` —— ext:364-376；test:127-135
- 注入发生在 `before_provider_request`，只改写 `input` —— ext:342, ext:379；test:133-134
- 整轮没有任何新增 update 时原样返回；有历史 update 需要重放时仍返回新 payload —— ext:379
- 每条 update 后紧跟一个用户项，不会相邻 —— ext:370；test:157-159
- 档位先经过 `thinkingLevelMap` 映射 —— ext:180-183, ext:369
- 决策按时间戳持久化；模型、基线和已有上下文不变时，追加请求在同样位置插入同样的项，新请求开头等于上一次请求 —— ext:334, ext:347, ext:357, ext:366-373；test:142, test:147, test:154, test:414, test:438
- 前提条件：改基线或模型映射后，重放可能新增或去掉 update，开头随之变化 —— ext:180-183, ext:347, ext:371
- 档位和当前强度相同时，当前用户项前不插入 —— ext:371；test:162-170
- 回到基线时也插入一条 update 抵消前一条 —— ext:371-373；test:150-155
- README：不能与服务端自动压缩、自动截断或 `/responses/compact` 混用；Pi 客户端压缩不受影响 —— README.md:86（源码无对应检查）
- 图 4 是独立示例（medium、xhigh、medium）；被引测试的实际序列是 xhigh → low → medium（test:129, test:148, test:155），只用于证明注入机制

## 5. 决策跟随会话分支（图 5）

- 决策是会话自定义条目，类型 `jev-inline-effort`，内容 `{ timestamp, thinkingLevel, classifier }`，不发给模型 —— ext:58, ext:334；types:1234-1235
- 只读当前分支路径（从叶子到根）上的条目 —— ext:171-178；sm:1057-1071
- 恢复、fork、树导航后旧消息保持原档位、不重新分类 —— README.md:80；test:403-444
- 分叉后仍继承共同祖先（图中 U1）的决策，读不到分叉后另一分支（U2）的决策；新消息重新分类 —— ext:171-178；sm:1057-1071；test:229-237
- 压缩摘要承接被压缩部分的最后一次决策，强度不回落到基线 —— ext:358-359, ext:367；test:210-227
- 会话开始、退出和切换模型时只清掉本扩展的 🧠 段（setStatus 只作用于 STATUS_KEY），并取消进行中的分类 —— ext:59, ext:291-300；test:270-277
- 图 5 的 xhigh、low 是示例值 —— 结构参照 test:210-237

## 6. 状态栏与演示（图 6）

- 状态栏格式：当前强度不等于基线时 `🧠 当前 · 基线 基线值 · 分类器`，相等时 `🧠 基线值 · 分类器` —— ext:378；test:135, test:149, test:156, test:168
- 用户项数量与本次上下文算出的数量不一致时不插入，显示 `🧠 基线 · 未调整 · 分类器` —— ext:306, ext:351-354；README.md:86；test:239-248（状态 test:244）
- 分类器标签取最近一次决策；无决策或 classifier 为 null 时「未分类」 —— ext:64-66, ext:350
- 分类失败时决策仍记录所选分类器 —— ext:324, ext:334；test:295
- Pi 自带的 thinking 显示只反映基线 —— README.md:77
- 会话刚恢复时没有 🧠 段，下一次请求后才显示 —— ext:298（session_start 清空）, ext:378（before_provider_request 才设置）
- demo 的「第一条消息时当前强度等于基线」 —— ext:316

## 7. 在 /personal 里管理（图 7 录屏 + 表）

- 菜单项与处理函数参数：查看分类模型与状态（status）、选择分类模型（model）、使用 Jev 分类模型（model jev）、使用 d1-ultra 分类模型（model d1-ultra）、测试分类模型可用性（test） —— entry:77-83, entry:170-174
- 本项目只注册 `/personal`；功能的 registerCommand 被 featureApi 截住，只存进 commands 表 —— entry:130-135, entry:140
- `/personal` 有 UI 就能用（TUI、RPC）；没有 UI 时提示并返回；批量功能开关只在 TUI —— entry:143-146, entry:180-183
- 查看状态：是否适用、后续分类器、当前分支最近决策 —— ext:222-229
- 「查看分类模型与状态」在 agent 运行时也可用；选择和测试要求空闲 —— ext:222-234, ext:275-278；test:489-508
- 「选择分类模型」打开选择器，Esc 取消不保存 —— ext:249-269
- 选择写入全局配置，从下一条未分类消息生效，旧决策不变；其他会话和子代理的后续分类也读取 —— ext:279-280, ext:324；README.md:79；test:403-416
- 「测试分类模型可用性」用固定样例「把 hello 转成大写。」，不读会话、不写决策、不改强度 —— ext:238-245；test:464-487
- 配置无效时报错，不退回 Jev；在「选择分类模型」里重新保存可修复 —— ext:25-34；test:374-401
- OpenRouter 白名单需放行实际服务商和模型；Latest 别名还需放行解析后的固定版本 —— README.md:84
- 录屏 effort-status：/personal → 原位思考强度 → 查看分类模型与状态，输出原文见 scratchpad/recapture-actual.md（最近决策：尚无，指向菜单路径） —— ext:226；entry:78

## 8. 子代理与代价（图 8）

- 子代理需加载本扩展，基线取子代理自己的 thinking 设置；外部 CLI 代理不经过本扩展 —— README.md:85；ext:316（基线 = pi.getThinkingLevel()）
- 分类增加等待、消耗服务额度，文本可能含业务信息 —— README.md:81
- d1-ultra 付费，价格以 OpenRouter 端点信息为准 —— README.md:83
