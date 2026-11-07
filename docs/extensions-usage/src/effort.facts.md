# effort（使用者版）事实清单

路径缩写：`ext` = `extensions/inline-effort.ts`，`entry` = `extensions/pi-personal-extensions.ts`，`test` = `tests/inline-effort.test.mjs`。技术版出处见 `docs/extensions-guide/src/effort.facts.md`。

## 它能帮你什么

- 档位共五档：low、medium、high、xhigh、max —— ext:78, ext:173-177
- 给每条新用户消息选一个档位；同一批进入请求的新消息共用一次分类结果，空白消息不分类 —— ext:425-457, ext:427, ext:439；test:771-775；README.md:112, README.md:114
- 只调整思考强度，主模型不变 —— README.md:95；ext:238-267, ext:467-530
- 图 1 的三条消息和档位是示例；「把 hello 转成大写」是「测试分类模型可用性」的固定样例 —— ext:339

## 想让它生效

- GPT-6 Codex 适用条件：接口 `openai-codex-responses`、模型 ID 以 `gpt-6` 开头、thinking 不是 off —— ext:70, ext:81-83, ext:389-393；README.md:70-75
- Claude（Anthropic 协议）适用条件：接口 `anthropic-messages`、`compat.supportsMidConvoEffort === true`、模型 ID 精确等于 `claude-opus-5`、`claude-opus-5-5` 或 `claude-sonnet-5-5`，且 thinking 不是 off —— ext:85-89, ext:389-393；README.md:70-78；test:176-196
- Claude（Antigravity）适用条件：provider `antigravity`、接口 `antigravity-api`、模型 ID 精确等于 `claude-opus-5-5` 或 `claude-sonnet-5-5`，且 thinking 不是 off；需先安装并启用带 legacy streamSimple 注册的 pi-antigravity，本机使用 0.11.0；不新增其他模型 —— ext:91-94, ext:389-393；README.md:70, README.md:77-78；test:992-1126
- 三个分支都需要 OpenRouter 认证；Codex 另需 `openai-codex` 登录；分类器走 OpenRouter —— README.md:70；ext:71
- 示例启动命令 `pi --model openai-codex/gpt-6.1-sol --thinking medium` 是 GPT-6 Codex 示例 —— README.md:78-84
- 「查看分类模型与状态」输出「适用」或「当前主模型或 thinking 不适用」；「适用」只检查主模型和 thinking，不检查登录、分类器连通 —— ext:326, ext:389-393
- 确认步骤：「测试分类模型可用性」检查分类器；发消息后看 🧠 段的档位，切换警告只表示首选失败，回退成功时采用 Jev 档位；全部失败才沿用最近档位（不显示「未调整」）；Codex 出现「未调整」表示请求对齐失败、这次没有调整、按基线发出 —— ext:338-346, ext:433, ext:453, ext:457, ext:501-505, ext:520-529
- Codex 在当前用户消息前插入 `configuration_update`；Anthropic 协议分支只修改 Pi 已生成的末尾空 system 消息中的 `output_config.effort`，不改顶层 output_config、thinking、历史消息或 thinking blocks —— ext:467-530；test:831-881
- Antigravity 是独立分支；扩展临时包装插件原生 streamSimple，只改匹配主请求的 options.reasoning，由插件按 runtime ID 路由；max 和 xhigh 夹到 high，不改会话 thinking 或历史上下文 —— ext:238-267, ext:409-422；test:992-1031；README.md:95, README.md:97
- Anthropic 协议分支内部重建或重试复用原模型快照；流式切模型后旧回复仍保存实际档位；Pi 的 `max_tokens: 1` 缓存预热回放不干预。因无请求 ID，`max_tokens: 1` 主请求也不自动调整，待 Pi 暴露请求 ID 后再区分 —— ext:234-235, ext:394-400, ext:467-492, ext:533-549；test:918-962；README.md:101
- Anthropic 官方文档明确 Anthropic 协议分支的上述三个 Claude 模型支持逐消息 effort 并保持此前缓存前缀；所需 beta 由 Pi 发送 —— README.md:107；https://platform.claude.com/docs/en/build-with-claude/effort#change-effort-mid-conversation-beta
- 保留缓存前缀不保证 100% 命中；TTL、最小 token 数和其他提示变更仍影响命中 —— README.md:103, README.md:105
- Gemini 4 Argon 已存在，但官方资料只明确 implicit cache；未找到改变 thinking_level 保缓存的明确官方承诺，因此不支持。这是缺证，不是证明会丢缓存 —— README.md:109；https://ai.google.dev/gemini-api/docs/latest-model
- 仅 Codex：`configuration_update` 不能和服务端自动压缩、自动截断或 `/responses/compact` 一起用；Pi 客户端压缩不受影响 —— README.md:118
- 功能默认开启，可在 `/personal` 里关闭 —— entry:50, entry:91-93, entry:162-180

## 状态栏的 🧠 段

- 格式：实际档位与基线不同时 `🧠 实际 · 基线 基线值 · 分类器`，相同时 `🧠 基线值 · 分类器` —— ext:256, ext:491, ext:529；test:138, test:159, test:843
- 基线 = Pi 当前的 thinking 设置，会话中修改 thinking 后基线随之变化（每次请求读取） —— ext:433, ext:498
- 仅 Codex：「未调整」表示这次请求没能调整，按基线发出 —— ext:501-505；test:253
- Pi 自带的 thinking 显示只反映基线 —— README.md:95
- 恢复会话或切换模型后 🧠 段被清空；满足适用条件的下一次请求后显示 —— ext:394-407, ext:243-267, ext:467-530
- 分类器一栏取最近一次决策；空白消息的决策显示「未分类」 —— ext:74-77, ext:439-457, ext:256, ext:491, ext:500

## 想看现在的状态

- 「查看分类模型与状态」显示是否适用、后续分类器、失败回退策略、当前分支最近决策（档位 · 分类器） —— ext:312, ext:322-329
- 「测试分类模型可用性」用固定样例测试，不写决策、不改强度 —— ext:338-346；entry:73
- 录屏 effort-status：输出适用、后续分类 openrouter/liquid/d1-ultra、失败回退 Jev（仅本次）、最近决策「尚无」（录制环境配置） —— docs/extensions-usage/media/effort-status.png；ext:326

## 想换分类器

- `/personal` → 原位思考强度 → 「选择分类模型（Jev / d1-ultra）」打开选择器，选择 Jev 或 d1-ultra；Enter 保存（Pi 选择框通用按键），Esc 放弃 —— ext:348-370；README.md:87
- Jev 默认，d1-ultra 付费；统一通过选择器切换 —— ext:11-14, ext:35, ext:348-381；README.md:115
- 新选择对所有会话生效，从下一条未分类的消息开始，已有消息的档位不变 —— ext:381, ext:442；README.md:111
- Pi 正在工作时不能切换或测试 —— ext:331-334, ext:376-379；README.md:111
- 录屏 effort-model：标题「思考分类模型（全局）· 当前：openrouter/liquid/d1-ultra」，两项 Jev / d1-ultra，底部提示 enter select，Esc 退出不保存；默认是 Jev —— usage-captures.md；ext:35, ext:360-363

## 分类失败怎么办

- d1-ultra 超时或服务出错时显示安全原因、提示正在切换并回退 Jev；全部失败才沿用当前档位并警告 —— ext:72, ext:288-306, ext:439-453；README.md:114
- 档位无效与把握不足（有效结果的所选概率低于 0.5）均触发 Jev 回退；无效结果发警告，低置信度不发警告；最终无合格结果时沿用 —— ext:186-195, ext:453；pi-ai/dist/api/system-one-shared.js:37-55, :174-180；test:288-311
- 当前档位 = 当前分支上一次决策，没有就是基线 —— ext:433
- 对话照常进行（沿用后照常发出请求） —— ext:443-448, ext:457
- 警告显示 HTTP 状态码和白名单中文原因；d1-ultra 失败先提示「正在切换到 Jev」，最终无合格结果时沿用，只列出实际错误，不把低置信度列为错误。未知错误不透出服务原文 —— test「d1-ultra 服务出错或无效时回退 Jev，警告先显示安全原因和正在切换」；test「真实 Pi classifier 管线复用 models.json 的代理端点、认证及头部，404 不伪报成功」
- 警告里建议在 `/personal` → 原位思考强度 → 「选择分类模型」或「测试分类模型可用性」中检查 —— ext:453

## 代价和隐私

- 每个分类模型最多等 15 秒，含回退最多约 30 秒 —— ext:72, ext:280-311；README.md:119-121
- 消耗 OpenRouter 额度；d1-ultra 付费，价格以 OpenRouter 为准 —— README.md:113, README.md:115
- 发送当前消息和之前最多 6 条用户或助手消息的文本，可能含业务信息 —— ext:106-120（slice(-6)）；README.md:113
- 不发送系统提示词、工具输出、思考内容和图片数据 —— ext:96-103, ext:439；README.md:113；test:335-347

## 本轮补充

- 章节导语「不用这些模型可以跳过本章」指 GPT-6 Codex、Anthropic 协议分支的三个指定 Claude 模型和 Antigravity 分支的两个指定 Claude 模型以外的情况 —— ext:389-393（不适用时不分类）；README.md:70-78
- 图 3 对照行：Pi 自带 thinking 显示是基线，实际档位看 🧠 段 —— README.md:95；ext:256, ext:491, ext:529
- 换分类器步骤条（↑↓ 选择、Enter 保存、Esc 放弃）—— usage-captures.md（录屏底部提示 enter select / escape cancel）；ext:360-363

## 单一入口（/personal）

- 本项目只注册 `/personal`；原位思考强度的操作都在 `/personal` → 原位思考强度（Jev / d1-ultra）的菜单项里 —— entry:50, entry:70-74, entry:129-139
- 菜单项：查看分类模型与状态、选择分类模型（Jev / d1-ultra）、测试分类模型可用性 —— entry:71-73
- 录屏 effort-status：/personal → 原位思考强度 → 查看分类模型与状态，显示失败回退 Jev（仅本次）、最近决策尚无，完整输出见 docs/extensions-usage/media/effort-status.png —— ext:326；entry:71
- 录屏 effort-model：选择器标题当前 d1-ultra，光标 Jev → d1-ultra → Jev，Esc 退出；二级菜单含三个设置项，加上「禁用此功能并重载」共四项 —— entry:71-73, entry:162-168；ext:362

## 按推理结构选档

- low 直接执行明确操作，medium 判断可在局部完成，high 综合多项行为或交付约束，xhigh 消解冲突证据、排查混杂解释或检验跨边界行为；max 是需系统反证、严格推导与失效分析的例外攻坚，或需有排除外部阻碍后深入分析仍不足的具体证据 —— ext:176-182；test:1195-1229（两种分类器共用提示契约，不验证线上语义效果）
- 近期对话只补全同任务的目标、约束和交付要求；不继承旧难度，简短的继续或修改也结合前文判断；不按主题、代理数量、精美成片、操作敏感或重试提档；high 仅在无法识别任务要求时保守兜底，不替代模型专长、授权与实测 —— ext:176；test:1209-1216
- 字号调整、图示设计、查数画图与混杂归因为判据示例，不是线上分类保证 —— ext:178-181；test:1195-1229 只校验发送内容
- 分类看不到图片与工具结果，同轮工具续调不重分类，已有历史决策不变；修改提示不改变输入或映射 —— ext:96-120, ext:252, ext:425-448, ext:486-488, ext:519-523

## 改名与兼容

- 配置文件为 agent 目录下的 `inline-effort.json`；升级后原有设置自动保留（旧 `jev-inline-effort.json` 和旧开关仍能读取） —— ext:23-33, ext:48；entry:121-122；README.md:138, README.md:147-148
- Esc 逐级返回，取消不保存；设置保存后回到二级菜单，重载后结束导航；批量开关从一级进入时取消返回一级，直接 switches 取消退出 —— tests/personal-navigation.test.mjs；tests/personal.test.mjs「统一入口按开关注册七项功能」

## 自动回退与安全原因

- 只有合法档位、有限且位于 [0, 1] 的概率才可归为低置信度；0 静默，0.5 可采用，非法概率仍警告。混合回退仅报告实际错误，沿用最近档位并持久化，恢复和工具续调不重复分类 —— test「空输入、图片、概率边界和无效答案按规则处理」；test「低置信度静默回退，混合无效结果只警告真实错误」；test「低置信度沿用上次决策，工具续调与恢复不重复分类」。
- 固定样例测试仅低置信度时返回普通 info 提示，不发 warning，不写决策或改变状态 —— test「可用性测试只发送固定样例，成功、低置信度和失败均不写决策或改变状态」。

- 首选 d1-ultra 时依次尝试 d1-ultra、Jev；报错、超时、无效或概率低于 0.5 均可触发，仅本次回退；只有前三者发 warning，低置信度静默回退。每模型独立 15 秒，最多约 30 秒；全局选择不变，下条新消息重新尝试首选 —— test「d1-ultra 服务出错或无效时回退 Jev，警告先显示安全原因和正在切换」；test「d1-ultra 超时后 Jev 使用独立 15 秒预算，迟到结果不能当作成功」。
- 回退成功记录 classifier=jev、fallbackFrom=d1-ultra；状态栏显示 Jev（d1-ultra 回退）。恢复和工具续调沿用，不破坏历史前缀；Claude、Antigravity 同样生效 —— test「回退决策可恢复、工具续调不重分类；下条新消息重新尝试 d1-ultra」；test「回退同样适用于 Claude 和 Antigravity，状态栏和实际发送档位一致」。
- HTTP 429 显示服务限流、5xx 显示上游服务异常；未知原因明确提示未识别。不输出服务端原文或凭据。回退警告在 Jev 调用前出现；成功后显示实际模型和档位，最终无合格结果时只列出实际错误，低置信度不警告 —— test「d1-ultra 服务出错或无效时回退 Jev，警告先显示安全原因和正在切换」；test「真实 Pi classifier 管线复用 models.json 的代理端点、认证及头部，404 不伪报成功」。
- 用户取消或生命周期切换不继续回退，不写迟到决策或显示完成通知；已经发出的切换提示保留。空白输入不调用、配置无效不尝试任何模型 —— test「取消分类时不记录决策、不提示失败」；test「Jev 回退期间取消或切换会话，不写决策、不显示迟到成功或失败」；test「配置无效时不偷用 Jev；选择器可修复配置，保存失败保留原状」。
- 固定样例可用性测试走同一回退流程，不把 Jev 成功说成 d1-ultra 成功，不改会话决策、状态或基线 —— test「真实 Pi classifier 管线复用 models.json 的代理端点、认证及头部，404 不伪报成功」。
- 演示区用本地固定示例模拟 Jev 返回 low，不发送 API 请求、不保证线上结果；支持回退成功、失败、直接 Jev、空输入和对齐失败 —— tests/effort-demo.test.mjs。
