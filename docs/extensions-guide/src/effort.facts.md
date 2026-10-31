# effort 章节事实清单

路径缩写：
- `ext` = `extensions/inline-effort.ts`
- `test` = `tests/inline-effort.test.mjs`
- `entry` = `extensions/pi-personal-extensions.ts`
- `codex` = `node_modules/@earendil-works/pi-ai/dist/api/openai-codex-responses.js`
- `s1` = `node_modules/@earendil-works/pi-ai/dist/api/system-one-shared.js`
- `sdk` = `node_modules/@earendil-works/pi-coding-agent/dist/core/sdk.js`
- `types` = `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
- `sm` = `node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js`
- `config` = `node_modules/@earendil-works/pi-coding-agent/dist/config.js`
- `tape` = `docs/extensions-usage/tapes/effort-status.tape`

## 头部

- 功能 ID `inline-effort`，菜单 label「原位思考强度（Jev / d1-ultra）」 —— entry:49-50
- 入口 `/personal` → 原位思考强度（Jev / d1-ultra）→ 菜单项；处理函数以 `effort` 名存进 commands 表，不注册成斜杠命令 —— ext:223；entry:50, entry:70-74, entry:132-137, entry:142
- 配置文件在 agent 目录下的 `inline-effort.json`；agent 目录默认 `~/.pi/agent/`，`PI_CODING_AGENT_DIR` 可覆盖 —— ext:23-26, ext:48；config:453-458；README.md:96, README.md:106
- 默认分类器 Jev，可选 d1-ultra —— ext:11-14, ext:35, ext:40

## 1. 什么时候分类（图 1）

- 「原位」：顶层 reasoning.effort 保持基线，档位作为 configuration_update 写在 input 里当前用户项之前 —— ext:357, ext:374-386
- 「适用」= 三个条件同时满足 —— ext:299-300

- 每条新用户消息选一个档位并记为决策 —— ext:318-344
- 工具续调和重试不再分类（已有决策的时间戳跳过；最后一条助手消息之后没有新用户消息就不分类） —— ext:319-323；README.md:78；test:138-142, test:452-455
- steer、follow-up 追加的用户消息也分类；自定义消息和 bash 命令输出不触发分类 —— ext:320-322；README.md:78；test:189-208
- 适用条件：接口 `openai-codex-responses`、模型 ID 以 `gpt-6` 开头、thinking 不是 `off`；不满足时不分类、不改写请求 —— ext:70, ext:80-82, ext:299-300, ext:314, ext:355；test:172-187
- 需要 OpenRouter 认证和 `openai-codex` 登录 —— README.md:58；ext:71
- 功能不替换主模型 —— README.md:75；ext:382（只插入 reasoning.effort）
- 空白输入不调用分类器，沿用当前强度 —— ext:99, ext:333-336；README.md:80；test:593-598
- 当前强度 = 当前分支最近一次决策；没有决策时用基线（Pi 的 thinking 设置） —— ext:326
- 分类最多等 15 秒 —— ext:72, ext:154, ext:207；test:79
- 分类器只收到对话文本（用户和助手消息），不含系统提示词（role 为 system 的消息）、工具结果、思考块和图片数据 —— ext:84-91, ext:331；README.md:79；test:326-338
- 分类器 ID：Jev `~typesafe/jev-latest`，d1-ultra `liquid/d1-ultra`；d1-ultra 付费 —— ext:12-13；README.md:72-73, README.md:81
- 只回答 low、medium、high、xhigh、max —— ext:77, ext:144-150, ext:165-166；README.md:75
- 对话内容预算：当前请求最多 12,000、近期最多 6 条用户或助手消息、最多 8,000、合计不超过 16,000（JS 字符串长度，即 UTF-16 单元） —— ext:98-106
- 请求另加固定提示语（「近期对话（…）:」「当前用户请求:」）和分类规则，所以 prompt 可略超 16,000 —— ext:108, ext:139-151；test:336
- 图片换成「[附有图片]」 —— ext:88；test:600-603
- 图 1 中「虚线框是外部服务（OpenRouter）」 —— ext:71, ext:113

## 2. 分类结果怎么用（图 2）

- 「合格」：分类正常完成（stopReason 为 stop）、档位在五档内、所选档位概率是 [0.5, 1] 内的有限数，才采用 —— ext:161-167；test:604-611
- 超时、服务出错时沿用当前强度并弹警告 —— ext:160, ext:215-217, ext:337-341；test:279-302（warned 分支 test:296-298）, test:554
- 响应无法解析（缺答案、缺 confidence、概率结构无效）时 Pi 原生 classifier 返回 `stopReason: "error"`，扩展按出错处理并警告 —— s1:37-55, s1:174-180；ext:160, ext:340
- 档位不在五档内、概率低于 0.5、stopReason 为 length 时静默沿用，不警告 —— ext:161-167；test:279-302
- 警告原文 `openrouter/<模型 ID> 不可用，思考强度沿用 <档位>。不会切换分类模型；请在 /personal → 原位思考强度（Jev / d1-ultra） → 选择分类模型（Jev / d1-ultra） 或「测试分类模型可用性」中检查。`（页面和 demo 已补全） —— ext:73, ext:340
- 采用和沿用都写入决策（空白输入也写，classifier 为 null） —— ext:327-328, ext:344；test:254-256, test:295
- 用户取消时不写决策、不警告 —— ext:337-339, ext:345-348；README.md:80；test:304-324
- 决策按消息时间戳写入 —— ext:344
- 多条待分类消息只调用一次分类器，按最后一条用户消息作为当前请求，结果写给每条 pending 消息 —— ext:95-98, ext:320-322, ext:331-335, ext:344
- 分类中切换会话或模型，迟到结果不写入 —— ext:325, ext:343；test:554-591

## 3. 为什么不改顶层参数（图 3）

- Pi 每次请求前按当前上下文构造完整 input —— codex:379-394
- 基线在请求顶层 `reasoning.effort` —— ext:65, ext:357；codex:414-424
- 缓存前缀、保留缓存前缀是 README 的设计目标 —— README.md:75；CHANGELOG.md:23（仓库未验证服务端 prompt cache 命中规则）
- 启用缓存且有会话 ID 时，请求带 `prompt_cache_key` —— codex:171-173, codex:397
- WebSocket 增量续传：传输方式为 auto 或 websocket-cached；当前连接保留 continuation 和有效 lastResponseId；除 input、previous_response_id 外其余字段一致；新 input 以上次 input 加上次响应开头。全部满足才只发新增部分并带 `previous_response_id`，否则发完整请求 —— codex:184, codex:1121-1160, codex:1175-1177
- 默认传输方式是 auto —— codex:184
- before_provider_request 的改写发生在构造请求之后、发送之前 —— codex:174-177；sdk:213-218, sdk:262
- 图 3 是独立示例（medium → xhigh），不是测试数据；「顶层不变」一行示意 configuration_update 方案下请求 2 的开头与请求 1 相同（同图 4）

## 4. 插入 configuration_update（图 4）

- 顶层保持基线，在用户项前插入 `{ type: "configuration_update", reasoning: { effort } }` —— ext:374-386；test:127-135
- 注入发生在 `before_provider_request`，只改写 `input` —— ext:352, ext:389；test:133-134
- 整轮没有任何新增 update 时原样返回；有历史 update 需要重放时仍返回新 payload —— ext:389
- 每条 update 后紧跟一个用户项，不会相邻 —— ext:380；test:157-159
- 档位先经过 `thinkingLevelMap` 映射 —— ext:190-193, ext:379
- 决策按时间戳持久化；模型、基线和已有上下文不变时，追加请求在同样位置插入同样的项，新请求开头等于上一次请求 —— ext:344, ext:357, ext:367, ext:376-383；test:142, test:147, test:154, test:458, test:482
- 前提条件：改基线或模型映射后，重放可能新增或去掉 update，开头随之变化 —— ext:190-193, ext:357, ext:381
- 档位和当前强度相同时，当前用户项前不插入 —— ext:381；test:162-170
- 回到基线时也插入一条 update 抵消前一条 —— ext:381-383；test:150-155
- README：不能与服务端自动压缩、自动截断或 `/responses/compact` 混用；Pi 客户端压缩不受影响 —— README.md:84（源码无对应检查）
- 图 4 是独立示例（medium、xhigh、medium）；被引测试的实际序列是 xhigh → low → medium（test:129, test:148, test:155），只用于证明注入机制

## 5. 决策跟随会话分支（图 5）

- 决策是会话自定义条目，类型沿用旧名 `jev-inline-effort`（旧会话可直接恢复），内容 `{ timestamp, thinkingLevel, classifier }`，不发给模型 —— ext:68, ext:344；types:1234-1235
- 只读当前分支路径（从叶子到根）上的条目 —— ext:181-188；sm:1057-1071
- 恢复、fork、树导航后旧消息保持原档位、不重新分类 —— README.md:78；test:447-488
- 分叉后仍继承共同祖先（图中 U1）的决策，读不到分叉后另一分支（U2）的决策；新消息重新分类 —— ext:181-188；sm:1057-1071；test:229-237
- 压缩摘要承接被压缩部分的最后一次决策，强度不回落到基线 —— ext:368-369, ext:377；test:210-227
- 会话开始、退出和切换模型时只清掉本扩展的 🧠 段（setStatus 只作用于 STATUS_KEY），并取消进行中的分类 —— ext:69, ext:301-310；test:270-277
- 图 5 的 xhigh、low 是示例值 —— 结构参照 test:210-237

## 6. 状态栏与演示（图 6）

- 状态栏格式：当前强度不等于基线时 `🧠 当前 · 基线 基线值 · 分类器`，相等时 `🧠 基线值 · 分类器` —— ext:388；test:135, test:149, test:156, test:168
- 用户项数量与本次上下文算出的数量不一致时不插入，显示 `🧠 基线 · 未调整 · 分类器` —— ext:316, ext:361-364；README.md:84；test:239-248（状态 test:244）
- 分类器标签取最近一次决策；无决策或 classifier 为 null 时「未分类」 —— ext:74-76, ext:360
- 分类失败时决策仍记录所选分类器 —— ext:334, ext:344；test:295
- Pi 自带的 thinking 显示只反映基线 —— README.md:75
- 会话刚恢复时没有 🧠 段，下一次请求后才显示 —— ext:308（session_start 清空）, ext:388（before_provider_request 才设置）
- demo 的「第一条消息时当前强度等于基线」 —— ext:326

## 7. 在 /personal 里管理（图 7 录屏 + 表）

- 菜单项与处理函数参数：查看分类模型与状态（status）、选择分类模型（model）、测试分类模型可用性（test） —— entry:70-74, entry:174-181
- 本项目只注册 `/personal`；功能的 registerCommand 被 featureApi 截住，只存进 commands 表 —— entry:132-137, entry:142
- `/personal` 有 UI 就能用（TUI、RPC）；没有 UI 时提示并返回；批量功能开关只在 TUI —— entry:145-148, entry:193-196
- 查看状态：是否适用、后续分类器、当前分支最近决策 —— ext:232-239
- 「查看分类模型与状态」在 agent 运行时也可用；选择和测试要求空闲 —— ext:232-244, ext:285-288；test:533-552
- 「选择分类模型」打开选择器，Esc 取消不保存 —— ext:259-279
- 选择写入全局配置，从下一条未分类消息生效，旧决策不变；其他会话和子代理的后续分类也读取 —— ext:289-290, ext:334；README.md:77；test:447-460
- 「测试分类模型可用性」用固定样例「把 hello 转成大写。」，不读会话、不写决策、不改强度 —— ext:248-255；test:508-531
- 配置无效时报错，不退回 Jev；在「选择分类模型」里重新保存可修复 —— ext:34-43；test:418-445
- OpenRouter 白名单需放行实际服务商和模型；Latest 别名还需放行解析后的固定版本 —— README.md:82
- 录屏 effort-status：/personal → 原位思考强度 → 查看分类模型与状态，输出原文见 scratchpad/recapture-actual.md（最近决策：尚无，指向菜单路径） —— ext:236；entry:71

## 8. 子代理与代价（图 8）

- 子代理需加载本扩展，基线取子代理自己的 thinking 设置；外部 CLI 代理不经过本扩展 —— README.md:83；ext:326（基线 = pi.getThinkingLevel()）
- 分类增加等待、消耗服务额度，文本可能含业务信息 —— README.md:79
- d1-ultra 付费，价格以 OpenRouter 端点信息为准 —— README.md:81

## 改名与兼容（inline-effort）

- 文件、功能 ID、配置文件名从 jev-inline-effort 改为 inline-effort —— entry:15, entry:49；ext:23, ext:48；README.md:102
- `inline-effort.json` 读取返回 ENOENT 时才读 `jev-inline-effort.json`；新文件格式或内容无效时报错，不回退 —— ext:23-44；README.md:112
- 保存只写 `inline-effort.json`，旧文件保留不改写 —— ext:46-59；test:374-417；README.md:112
- 开关新键 `inline-effort` 存在时以新键为准，否则读旧键 `jev-inline-effort`；旧键仍须为布尔值 —— entry:109-116, entry:124-125；README.md:111
- 会话决策条目类型和状态栏键仍为 `jev-inline-effort`，旧会话可直接恢复 —— ext:67-69；README.md:113
