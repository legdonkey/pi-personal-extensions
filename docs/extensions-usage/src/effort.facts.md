# effort（使用者版）事实清单

路径缩写：`ext` = `extensions/inline-effort.ts`，`entry` = `extensions/pi-personal-extensions.ts`，`test` = `tests/inline-effort.test.mjs`。技术版出处见 `docs/extensions-guide/src/effort.facts.md`。

## 它能帮你什么

- 档位共五档：low、medium、high、xhigh、max —— ext:102, ext:198-206
- 给每条新用户消息选一个档位；同一批进入请求的新消息共用一次分类结果，空白消息不分类 —— ext:449-481, ext:451, ext:463；test:910-916；README.md:105, README.md:109
- 只调整思考强度，主模型不变 —— README.md:88；ext:261-290, ext:491-554
- 图 1 的三条消息和档位是示例；「把 hello 转成大写」是「测试分类模型可用性」的固定样例 —— ext:362

## 想让它生效

- GPT-6 Codex 适用条件：接口 `openai-codex-responses`、模型 ID 以 `gpt-6` 开头、thinking 不是 off —— ext:92, ext:105-107, ext:413-417；README.md:61-65
- Claude（Anthropic 协议）适用条件：接口 `anthropic-messages`、`compat.supportsMidConvoEffort === true`、模型 ID 精确等于 `claude-opus-5`、`claude-opus-5-5` 或 `claude-sonnet-5-5`，且 thinking 不是 off —— ext:109-113, ext:413-417；README.md:61-68；test:185-205
- Claude（Antigravity）适用条件：provider `antigravity`、接口 `antigravity-api`、模型 ID 精确等于 `claude-opus-5-5` 或 `claude-sonnet-5-5`，且 thinking 不是 off；需先安装并启用带 legacy streamSimple 注册的 pi-antigravity，本机使用 0.11.0；不新增其他模型 —— ext:115-118, ext:413-417；README.md:61, README.md:67-69；test:1155-1289
- 三个分支都需要 OpenRouter 认证；Codex 另需 `openai-codex` 登录；分类器走 OpenRouter —— README.md:61；ext:93
- 示例启动命令 `pi --model openai-codex/gpt-6.1-sol --thinking medium` 是 GPT-6 Codex 示例 —— README.md:69-73
- 「查看分类模型与状态」输出「适用」或「当前主模型或 thinking 不适用」；「适用」只检查主模型和 thinking，不检查登录、分类器连通 —— ext:349, ext:413-417
- 确认步骤：「测试分类模型可用性」检查分类器；发消息后看 🧠 段的档位，切换警告只表示首选报错，回退成功时采用 Jev 档位；未获合格结果才沿用最近档位（不显示「未调整」）；Codex 出现「未调整」表示请求对齐失败、这次没有调整、按基线发出 —— ext:358-369, ext:457, ext:477, ext:481, ext:525-529, ext:544-553
- Codex 在当前用户消息前插入 `configuration_update`；Anthropic 协议分支只修改 Pi 已生成的末尾空 system 消息中的 `output_config.effort`，不改顶层 output_config、thinking、历史消息或 thinking blocks —— ext:491-554；test:994-1046
- Antigravity 是独立分支；扩展临时包装插件原生 streamSimple，只改匹配主请求的 options.reasoning，由插件按 runtime ID 路由；max 和 xhigh 夹到 high，不改会话 thinking 或历史上下文 —— ext:261-290, ext:438-444；test:1155-1195；README.md:88, README.md:90
- Anthropic 协议分支内部重建或重试复用原模型快照；流式切模型后旧回复仍保存实际档位；Pi 的 `max_tokens: 1` 缓存预热回放不干预。因无请求 ID，`max_tokens: 1` 主请求也不自动调整，待 Pi 暴露请求 ID 后再区分 —— ext:257, ext:418-424, ext:491-516, ext:557-573；test:1081-1125；README.md:94
- Anthropic 官方文档明确 Anthropic 协议分支的上述三个 Claude 模型支持逐消息 effort 并保持此前缓存前缀；所需 beta 由 Pi 发送 —— README.md:100；https://platform.claude.com/docs/en/build-with-claude/effort#change-effort-mid-conversation-beta
- 保留缓存前缀不保证 100% 命中；TTL、最小 token 数和其他提示变更仍影响命中 —— README.md:96, README.md:98
- Gemini 4 Argon 已存在，但官方资料只明确 implicit cache；未找到改变 thinking_level 保缓存的明确官方承诺，因此不支持。这是缺证，不是证明会丢缓存 —— README.md:102；https://ai.google.dev/gemini-api/docs/latest-model
- 仅 Codex：`configuration_update` 不能和服务端自动压缩、自动截断或 `/responses/compact` 一起用；Pi 客户端压缩不受影响 —— README.md:113
- 功能默认开启，可在 `/personal` 里关闭 —— entry:43, entry:86-88, entry:162-184

## 状态栏的 🧠 段

- 格式：实际档位与基线不同时 `🧠 实际 · 基线 基线值 · 分类器`，相同时 `🧠 基线值 · 分类器` —— ext:279, ext:515, ext:553；test:147, test:168, test:1006
- 基线 = Pi 当前的 thinking 设置，会话中修改 thinking 后基线随之变化（每次请求读取） —— ext:457, ext:522
- 仅 Codex：「未调整」表示这次请求没能调整，按基线发出 —— ext:525-529；test:262
- Pi 自带的 thinking 显示只反映基线 —— README.md:88
- 恢复会话或切换模型后 🧠 段被清空；满足适用条件的下一次请求后显示 —— ext:418-431, ext:266-282, ext:491-554
- 分类器一栏取最近一次决策；空白消息的决策显示「未分类」 —— ext:96-101, ext:463-481, ext:279, ext:515, ext:525

## 想看现在的状态

- 「查看分类模型与状态」显示是否适用、后续分类器、失败回退策略、当前分支最近决策（档位 · 分类器） —— ext:336, ext:345-352
- 「测试分类模型可用性」用固定样例测试，不写决策、不改强度 —— ext:358-369；entry:66
- 录屏 effort-status：输出适用、后续分类 openrouter/liquid/d1-ultra、失败回退 Jev（仅本次）、最近决策「尚无」（录制环境配置） —— docs/extensions-usage/media/effort-status.png；ext:349

## 想换分类器

- `/personal` → 原位思考强度 → 「选择分类模型」打开选择器，选择 Jev、d1-ultra、Mammoth 27B 或 Decider v1.2；Enter 保存（Pi 选择框通用按键），Esc 放弃 —— ext:372-394；README.md:78
- Jev 默认，四个分类模型均按输入计费；统一通过选择器切换 —— ext:11-36, ext:57, ext:372-405；README.md:110
- 新选择对所有会话生效，从下一条未分类的消息开始，已有消息的档位不变 —— ext:404, ext:466；README.md:104
- Pi 正在工作时不能切换或测试 —— ext:354-357, ext:399-402；README.md:104
- 录屏 effort-model：标题「思考分类模型（全局） · 当前：openrouter/liquid/d1-ultra」，四项 Jev / d1-ultra / Mammoth 27B / Decider v1.2，光标浏览至 Mammoth 27B 后回到 Jev，底部提示 enter select，Esc 退出不保存；默认是 Jev —— docs/extensions-usage/tapes/effort-model.tape；media/effort-model.png；ext:57, ext:383-386

## 分类失败怎么办

- 首选非 Jev 模型超时或服务出错时显示安全原因、提示正在切换到 Jev 并单跳回退一次 Jev；仍失败才沿用当前档位并警告 —— ext:94, ext:308-330, ext:463-478；README.md:107
- 档位无效与把握不足（有效结果的所选概率低于 0.5）均不触发 Jev 回退，直接沿用当前档位；无效结果发一次警告，低置信度静默不警告 —— ext:217-223, ext:317-320, ext:477；pi-ai/dist/api/system-one-shared.js:37-55, :174-180；test:297-335, test:708-729, test:910-960
- 当前档位 = 当前分支上一次决策，没有就是基线 —— ext:457
- 对话照常进行（沿用后照常发出请求） —— ext:467-473, ext:481
- 警告显示 HTTP 状态码和白名单中文原因（携带 Guardrail 关键词时优先归类为「OpenRouter 策略或白名单限制」）；首选非 Jev 模型超时或报错先提示「正在切换到 openrouter/typesafe/jev-1.14」，最终无合格结果时沿用，只列出实际错误或结果无效，不把低置信度列为错误。未知错误不透出服务原文 —— ext:163-181, ext:327-328；test:606-706, test:1291-1366
- 警告里建议在 `/personal` → 原位思考强度 → 「选择分类模型」或「测试分类模型可用性」中检查 —— ext:477

## 代价和隐私

- 每个分类模型最多等 15 秒，含回退最多约 30 秒 —— ext:94, ext:303-334；README.md:108
- 消耗 OpenRouter 额度，四个分类模型均按输入计费，价格以 OpenRouter 为准 —— ext:11-36；README.md:106, README.md:110
- 发送当前消息和之前最多 6 条用户或助手消息的文本，可能含业务信息 —— ext:129-145（slice(-6)）；README.md:106
- 不发送系统提示词、工具输出、思考内容和图片数据 —— ext:120-127, ext:463；README.md:106；test:359-371

## 本轮补充

- 章节导语「不用这些模型可以跳过本章」指 GPT-6 Codex、Anthropic 协议分支的三个指定 Claude 模型和 Antigravity 分支的两个指定 Claude 模型以外的情况 —— ext:413-417（不适用时不分类）；README.md:61-68
- 图 3 对照行：Pi 自带 thinking 显示是基线，实际档位看 🧠 段 —— README.md:88；ext:279, ext:515, ext:553
- 换分类器步骤条（↑↓ 选择、Enter 保存、Esc 放弃）—— docs/extensions-usage/media/effort-model.png（录屏底部提示 enter select / escape/ctrl+c cancel）；ext:383-386

## 单一入口（/personal）

- 本项目只注册 `/personal`；原位思考强度的操作都在 `/personal` → 原位思考强度 的菜单项里 —— entry:43, entry:63-67, entry:128-137
- 菜单项：查看分类模型与状态、选择分类模型、测试分类模型可用性 —— entry:64-66
- 录屏 effort-status：/personal → 原位思考强度 → 查看分类模型与状态，显示失败回退 Jev（仅本次）、最近决策尚无；在临时 agent 目录重录，仅查看示例配置，不验证模型可用性；标题合入状态栏，技术版素材与使用者版相同 —— docs/extensions-usage/tapes/effort-status.tape；两版 media/effort-status.png；ext:345-352；entry:63-67。
- 录屏 effort-model：选择器标题当前 d1-ultra，列出四项模型，光标浏览至 Mammoth 27B 后回到 Jev，Esc 退出；二级菜单含三个设置项，加上「禁用此功能并重载」共四项；在临时 agent 目录重录，只操作选择器，不发模型消息 —— docs/extensions-usage/tapes/effort-model.tape；media/effort-model.png；entry:63-67、160-167；ext:383-386。

## 按推理结构选档

- low 直接执行明确操作，medium 判断可在局部完成，high 综合多项行为或交付约束，xhigh 消解冲突证据、排查混杂解释或检验跨边界行为；max 是需系统反证、严格推导与失效分析的例外攻坚，或需有排除外部阻碍后深入分析仍不足的具体证据 —— ext:199-206；test:1368-1402（四种分类器共用提示契约，不验证线上语义效果）
- 近期对话只补全同任务的目标、约束和交付要求；不继承旧难度，简短的继续或修改也结合前文判断；不按主题、代理数量、精美成片、操作敏感或重试提档；high 仅在无法识别任务要求时保守兜底，不替代模型专长、授权与实测 —— ext:199；test:1382-1389
- 字号调整、图示设计、查数画图与混杂归因为判据示例，不是线上分类保证 —— ext:201-204；test:1368-1402 只校验发送内容
- 分类看不到图片与工具结果，同轮工具续调不重分类，已有历史决策不变；修改提示不改变输入或映射 —— ext:120-145, ext:275, ext:449-473, ext:510-512, ext:543-547

## 改名与兼容

- 配置文件为 agent 目录下的 `inline-effort.json`；升级后原有设置自动保留（旧 `jev-inline-effort.json` 和旧开关仍能读取） —— ext:43-56, ext:70；entry:119-120；README.md:158、168-170
- Esc 逐级返回，取消不保存；设置保存后回到二级菜单，重载后结束导航；批量开关从一级进入时取消返回一级，直接 switches 取消退出 —— tests/personal-navigation.test.mjs；tests/personal.test.mjs「统一入口按开关注册五项功能」

## 自动回退与安全原因

- 只有合法档位、有限且位于 [0, 1] 的概率才可归为低置信度；0 静默，0.5 可采用，非法概率、截断或缺答案视为结果无效。结果无效与低置信度均不触发 Jev 回退，直接沿用最近档位并持久化（结果无效发一次警告，低置信度静默），恢复和工具续调不重复分类 —— ext:317-320；test:297-335, test:708-729, test:910-960。
- 固定样例测试仅低置信度时返回普通 info 提示，不发 warning、不回退，不写决策或改变状态 —— test:824-848。

- 首选非 Jev 模型（`d1-ultra`、`mammoth-27b`、`decider`）在请求超时或服务报错时，依次尝试首选模型、Jev（`typesafe/jev-1.14`），先发切换 warning；Jev 返回低置信度时仅警告首选模型的真实错误并沿用当前强度，Jev 返回结果无效或报错时合并列出两条错误并沿用。每模型独立 15 秒，最多约 30 秒；全局选择不变，下条新消息重新尝试首选 —— ext:308-330；test:606-706, test:761-780。
- 回退成功记录 classifier=jev、fallbackFrom=首选模型键；状态栏显示 `Jev（〈首选模型〉 回退）`。恢复和工具续调沿用，不破坏历史前缀；Claude、Antigravity 同样生效 —— test:731-759, test:804-822。
- HTTP 429 显示服务限流、携带 Guardrail 关键词的 404/403 显示 OpenRouter 策略或白名单限制、5xx 显示上游服务异常；未知原因明确提示未识别。不输出服务端原文或凭据。回退警告在 Jev 调用前出现；成功后显示实际模型和档位，未获合格档位时只列出实际错误或结果无效，低置信度不警告 —— ext:163-181；test:606-706, test:1291-1366。
- 用户取消或生命周期切换不继续回退，不写迟到决策或显示完成通知；已经发出的切换提示保留。空白输入不调用、配置无效不尝试任何模型 —— test:337-357, test:464-491, test:782-802。
- 固定样例可用性测试走同一回退流程，不把 Jev 成功说成首选模型成功，不改会话决策、状态或基线 —— test:824-848, test:1291-1366。
- 演示区用本地固定示例模拟 Jev 返回 low，不发送 API 请求、不保证线上结果；仅服务报错可回退，结果无效与低置信度不回退并沿用基线 —— tests/effort-demo.test.mjs。

- 本轮重录 personal-menu、personal-switches、statusline-style，后者包含第五项标题开关及状态栏标题；其他认证/聊天录屏保留历史画面并在紧邻图注中标明标题位置已变化，不伪造模型调用 —— docs/extensions-usage/tapes/；两版页面可见历史录屏图注。
- 删除原视频审查后（/personal 一级菜单和批量开关各少一项），在按 _settings.tape 创建的临时 agent 目录重录 personal-menu、personal-switches、statusline-style、clickable-paths-status、effort-status、effort-model，画面中一级菜单为五项功能加「批量功能开关」；前三个录制前移除了临时目录里的凭据文件，后三个保留凭据文件但不发送模型消息；随后重录 auto-name-model、auto-name-status（旧画面的一级菜单还有已合并的「右下角会话标题」），保留凭据文件但不发送模型消息，两个 tape 去掉一级菜单里多余的一次下移；未重录的只剩 chat-turn —— docs/extensions-usage/tapes/；docs/extensions-usage/media/；extensions/pi-personal-extensions.ts:16-47
