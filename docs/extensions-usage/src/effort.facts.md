# effort（使用者版）事实清单

路径缩写：`ext` = `extensions/inline-effort.ts`，`entry` = `extensions/pi-personal-extensions.ts`，`test` = `tests/inline-effort.test.mjs`。技术版出处见 `docs/extensions-guide/src/effort.facts.md`。`report` = Codex worker 汇报 `/tmp/pi-inline-effort-worker-report.md` 及结果文件 `/tmp/pi-inline-effort-benchmark-20261114.json`。`gpt6` = GPT-6 推理强度官方指南调研报告 `/private/tmp/claude-501/-Users-yangguandao-Projects-pi-personal-extensions/739c1906-4a81-4bd5-9fe7-05e8177ecafc/scratchpad/gpt6-effort-research.md`。

## 它能帮你什么

- 档位共五档：low、medium、high、xhigh、max —— ext:114, ext:394-402
- 给每条新用户消息选一个档位；同一批进入请求的新消息共用一次分类结果，空白消息不分类 —— ext:872-929, ext:874, ext:888；test:920-926；README.md:119, README.md:123
- 只调整思考强度，主模型不变 —— README.md:90；ext:594-624, ext:939-1004
- 图 1 的三条消息和档位是示例；「把 hello 转成大写」是「测试分类模型可用性」的固定样例 —— ext:736
- 两套规则：Opus 5.5、Sonnet 5.5、Fable 5.2、GPT-6 Astra（`gpt-6-astra`）和 GPT-6.1 Sol（`gpt-6.1-sol`）用按模型规则；Opus 5 和其他 GPT-6 Codex 模型用通用规则（四档常规工作 + max 例外） —— ext:213, ext:226-348, ext:382-403；test:1501-1545
- 「按官方指南整理」：三个 Claude 模型的规则来自 auto-effort 的 `hooks/policy-text.ts`，源码注释列出 Anthropic 官方依据；两个 GPT 模型的规则按 gpt6 第 3 部分草案写入，源码注释列出 OpenAI 和 Codex 官方链接 —— ext:195-211, ext:226-270, ext:271-348；gpt6 第 0、3 部分；test:1501-1545
- 「三个 Claude 模型的规则来自 Claude Code 的 auto-effort mod」：只改了默认档字段名和共用原则首句（改为「为当前主会话的下一轮选择推理强度」），其余文字与来源相同 —— ext:195-196, ext:219, ext:351；test:1501-1545
- GPT 两个模型「默认档是 low，同样参考当前档位」；举例「Astra 档位偏强，官方推荐器从不推荐 max」「Sol 追求最高质量时官方直接换成 Astra 的 xhigh，而不是把 Sol 升到 max」 —— ext:288, ext:320, ext:387, ext:290, ext:293, ext:326；test:1501-1545
- 两个 GPT 模型的档位就是 low 到 max 五档，直接对应分类结果，不需要换算 —— ext:283；gpt6 第 1 部分第 1 条；pi152 `openai-codex.json` 的 thinkingLevelMap（low～max 映射到同名档位）
- 按模型规则分类时传入当前档位；规则举例「指出上一轮跳过文件、没跑测试或半途放弃时至少高一档」来自共用原则，「Fable 5.2 上一轮 low / medium 提前停下、要求继续做完给 high」来自 Fable 说明 —— ext:387, ext:821, ext:882, ext:362, ext:248；test:1511
- 通用规则才有「不继承旧难度」的示例、「不因主题等提档」「无法识别时 high 兜底」；两套规则下分类器都只读有限文本、同轮工具续调不重分类 —— ext:395-402, ext:132-157, ext:872-877

## 想让它生效

- GPT-6 Codex 适用条件：接口 `openai-codex-responses`、模型 ID 以 `gpt-6` 开头、thinking 不是 off —— ext:93, ext:117-119, ext:787-791；README.md:61-65
- Claude（Anthropic 协议）适用条件：接口 `anthropic-messages`、`compat.supportsMidConvoEffort === true`、模型 ID 精确等于 `claude-opus-5`、`claude-opus-5-5`、`claude-sonnet-5-5` 或 `claude-fable-5-2`，且 thinking 不是 off —— ext:121-125, ext:787-791；README.md:61-66；test:195-215, test:1481-1499
- Claude（Antigravity）适用条件：provider `antigravity`、接口 `antigravity-api`、模型 ID 精确等于 `claude-opus-5-5` 或 `claude-sonnet-5-5`，且 thinking 不是 off；需先安装并启用带 legacy streamSimple 注册的 pi-antigravity，本机使用 0.11.0；不新增其他模型 —— ext:127-130, ext:787-791；README.md:61, README.md:67-69；test:1165-1299
- 三个分支都需要 OpenRouter 认证；Codex 另需 `openai-codex` 登录；分类器走 OpenRouter —— README.md:61；ext:94
- 示例启动命令 `pi --model openai-codex/gpt-6.1-sol --thinking medium` 是 GPT-6 Codex 示例 —— README.md:69-73
- 「查看分类模型与状态」输出「适用」或「当前主模型或 thinking 不适用」；「适用」只检查主模型和 thinking，不检查登录、分类器连通 —— ext:676, ext:787-791
- 确认步骤：「测试分类模型可用性」检查分类器；发消息后看 🧠 段的档位，切换警告只表示首选报错，回退成功时采用 Jev 档位；未获合格结果才沿用最近档位（不显示「未调整」）；Codex 出现「未调整」表示请求对齐失败、这次没有调整、按基线发出 —— ext:732-743, ext:882, ext:915, ext:929, ext:974-978, ext:990-1003
- Codex 在当前用户消息前插入 `configuration_update`；Anthropic 协议分支只修改 Pi 已生成的末尾空 system 消息中的 `output_config.effort`，不改顶层 output_config、thinking、历史消息或 thinking blocks —— ext:939-1004；test:1004-1056
- Antigravity 是独立分支；扩展临时包装插件原生 streamSimple，只改匹配主请求的 options.reasoning，由插件按 runtime ID 路由；max 和 xhigh 夹到 high，不改会话 thinking 或历史上下文 —— ext:594-624, ext:861-867；test:1165-1205；README.md:90, README.md:92
- Anthropic 协议分支内部重建或重试复用原模型快照；流式切模型后旧回复仍保存实际档位；Pi 的 `max_tokens: 1` 缓存预热回放不干预。因无请求 ID，`max_tokens: 1` 主请求也不自动调整，待 Pi 暴露请求 ID 后再区分 —— ext:590, ext:792-808, ext:939-965, ext:1007-1054；test:1091-1135；README.md:96
- Anthropic 官方文档明确 `claude-opus-5`、`claude-opus-5-5`、`claude-sonnet-5-5` 支持逐消息 effort 并保持此前缓存前缀；所需 beta 由 Pi 发送 —— README.md:114；https://platform.claude.com/docs/en/build-with-claude/effort#change-effort-mid-conversation-beta
- Fable 5.2 只在 Anthropic 协议分支：依据 Pi 1.5.2 目录 `supportsMidConvoEffort: true` 和本地序列化结果接入；没有向 Fable 发出真实请求，真实缓存命中未验证；Antigravity 不支持 Fable —— ext:124, ext:127-130；tests/fixtures/fable-5-2.pi-1.5.2.json；test:1481-1499；README.md:114；report「Fable 验证」
- 保留缓存前缀不保证 100% 命中；TTL、最小 token 数和其他提示变更仍影响命中 —— README.md:98, README.md:112
- Gemini 4 Argon 已存在，但官方资料只明确 implicit cache；未找到改变 thinking_level 保缓存的明确官方承诺，因此不支持。这是缺证，不是证明会丢缓存 —— README.md:116；https://ai.google.dev/gemini-api/docs/latest-model
- 仅 Codex：`configuration_update` 不能和服务端自动压缩、自动截断或 `/responses/compact` 一起用；Pi 客户端压缩不受影响 —— README.md:127
- 功能默认开启，可在 `/personal` 里关闭 —— entry:43, entry:88-90, entry:164-186

## 状态栏的 🧠 段

- 格式：实际档位与基线不同时 `🧠 实际 · 基线 基线值 · 分类器`，相同时 `🧠 基线值 · 分类器` —— ext:613, ext:964, ext:1003；test:157, test:178, test:1016
- 基线 = Pi 当前的 thinking 设置，会话中修改 thinking 后基线随之变化（每次请求读取） —— ext:882, ext:971
- 仅 Codex：「未调整」表示这次请求没能调整，按基线发出 —— ext:974-978；test:272
- 两次检测到缓存重建后，🧠 段显示「🧠 自动调整暂停：检测到两次缓存重建 · /personal → 原位思考强度 → 恢复自动调整」；图 3 里写作「🧠 自动调整暂停 · …」是缩写 —— ext:586-587；test:1569-1575
- Pi 自带的 thinking 显示只反映基线 —— README.md:90
- 恢复会话或切换模型后 🧠 段被清空；满足适用条件的下一次请求后显示 —— ext:792-815, ext:599-616, ext:939-1004
- 分类器一栏取最近一次决策；空白消息和等待超时的决策显示「未分类」 —— ext:108-113, ext:888-929, ext:906-908, ext:613, ext:964, ext:974

## 想看现在的状态

- 「查看分类模型与状态」显示是否适用、后续分类器、失败回退策略、当前分支最近决策（档位 · 分类器） —— ext:651, ext:672-679
- 「测试分类模型可用性」用固定样例测试，不写决策、不改强度 —— ext:732-743；entry:66
- 录屏 effort-status：二级菜单五个设置项加「禁用此功能并重载」；输出适用、后续分类 openrouter/liquid/d1-ultra、失败回退 Jev（仅本次）、最近决策「尚无」（录制环境配置） —— docs/extensions-usage/media/effort-status.png；ext:676；entry:63-69

## 想换分类器

- `/personal` → 原位思考强度 → 「选择分类模型」打开选择器，选择 Jev、d1-ultra、Mammoth 27B 或 Decider v1.2；Enter 保存（Pi 选择框通用按键），Esc 放弃 —— ext:746-768；README.md:78
- Jev 默认，四个分类模型均按输入计费；统一通过选择器切换 —— ext:12-37, ext:58, ext:746-779；README.md:124
- 新选择对所有会话生效，从下一条未分类的消息开始，已有消息的档位不变 —— ext:778, ext:833, ext:905；README.md:118
- Pi 正在工作时不能切换、测试或测评 —— ext:681-731, ext:773-776；README.md:118
- 菜单速查表五行对应五个菜单项 —— entry:64-68
- 录屏 effort-model：二级菜单五个设置项；标题「思考分类模型（全局） · 当前：openrouter/liquid/d1-ultra」，四项 Jev / d1-ultra / Mammoth 27B / Decider v1.2，光标浏览至 Mammoth 27B 后回到 Jev，底部提示 enter select，Esc 回到二级菜单、不保存；默认是 Jev —— docs/extensions-usage/tapes/effort-model.tape；media/effort-model.mp4、effort-model.png；ext:58, ext:758-761；entry:63-69

## 分类失败怎么办

- 首选非 Jev 模型超时或服务出错时显示安全原因、提示正在切换到 Jev 并单跳回退一次 Jev；仍失败才沿用当前档位并警告 —— ext:95, ext:453-473, ext:888-926；README.md:121
- 档位无效与把握不足（有效结果的所选概率低于 0.5）均不触发 Jev 回退，直接沿用当前档位；无效结果发一次警告，低置信度静默不警告 —— ext:413-419, ext:460-464, ext:915；pi-ai/dist/api/system-one-shared.js:37-55, :174-180；test:307-345, test:718-739, test:920-970
- 当前档位 = 当前分支上一次决策，没有就是基线 —— ext:882
- 对话照常进行（沿用后照常发出请求） —— ext:902-919, ext:929
- 警告显示 HTTP 状态码和白名单中文原因（携带 Guardrail 关键词时优先归类为「OpenRouter 策略或白名单限制」）；首选非 Jev 模型超时或报错先提示「正在切换到 openrouter/typesafe/jev-1.14」，最终无合格结果时沿用，只列出实际错误或结果无效，不把低置信度列为错误。未知错误不透出服务原文 —— ext:175-193, ext:468-472；test:616-716, test:1301-1376
- 警告里建议在 `/personal` → 原位思考强度 → 「选择分类模型」或「测试分类模型可用性」中检查 —— ext:915
- 提交时就在 input 事件后台分类；发请求时最多再等 5 秒，超时沿用当前档位、丢弃迟到结果，同一会话只提醒第一次；提醒原文「分类等待超过 5 秒，本次沿用 〈当前档位〉；分类已中止，迟到结果不再采用。」（图注示例填 medium） —— ext:96, ext:844-853, ext:894-913；test:1415-1479

## 代价和隐私

- 提交时后台分类，发请求时最多再等 5 秒；后台每个分类模型仍限时 15 秒，回退可能额外消耗 Jev 额度 —— ext:95, ext:96, ext:448-474, ext:899；README.md:119, README.md:122
- 判档测评也消耗 OpenRouter 额度 —— ext:693；README.md:81
- 消耗 OpenRouter 额度，四个分类模型均按输入计费，价格以 OpenRouter 为准 —— ext:12-37；README.md:120, README.md:124
- 发送当前消息和之前最多 6 条用户或助手消息的文本，可能含业务信息 —— ext:141-157（slice(-6)）；README.md:120
- 不发送系统提示词、工具输出、思考内容和图片数据 —— ext:132-139, ext:888；README.md:120；test:369-381

## 本轮补充

- 章节导语「不用这些模型可以跳过本章」指 GPT-6 Codex、Anthropic 协议分支的四个指定 Claude 模型和 Antigravity 分支的两个指定 Claude 模型以外的情况 —— ext:787-791（不适用时不分类）；README.md:61-68
- 图 3 对照行：Pi 自带 thinking 显示是基线，实际档位看 🧠 段 —— README.md:90；ext:613, ext:964, ext:1003
- 换分类器步骤条（↑↓ 选择、Enter 保存、Esc 放弃）—— docs/extensions-usage/media/effort-model.png（录屏底部提示 enter select / escape/ctrl+c cancel）；ext:757-760

## 单一入口（/personal）

- 本项目只注册 `/personal`；原位思考强度的操作都在 `/personal` → 原位思考强度 的菜单项里 —— entry:43, entry:63-69, entry:130-139
- 菜单项：查看分类模型与状态、选择分类模型、测试分类模型可用性、恢复自动调整、运行判档测评 —— entry:64-68；tests/personal.test.mjs:329
- 录屏 effort-status：/personal → 原位思考强度 → 二级菜单 → 查看分类模型与状态，显示失败回退 Jev（仅本次）、最近决策尚无；2026-11-14 在临时 agent 目录（未复制凭据文件）用 Pi 1.5.2 重录，tape 高度 740，仅查看示例配置，不验证模型可用性；技术版素材与使用者版逐字节相同 —— docs/extensions-usage/tapes/effort-status.tape；两版 media/effort-status.png；ext:672-679；entry:63-69。
- 录屏 effort-model：选择器标题当前 d1-ultra，列出四项模型，光标浏览至 Mammoth 27B 后回到 Jev，Esc 回到二级菜单；二级菜单含五个设置项，加上「禁用此功能并重载」共六项；2026-11-14 在临时 agent 目录（未复制凭据文件）用 Pi 1.5.2 重录，只操作选择器，不发模型消息；gemini-video 审查后把截止点延到 9.0 秒以包含 Esc 返回 —— docs/extensions-usage/tapes/effort-model.tape；docs/extensions-usage/tapes/_settings.tape；media/effort-model.png；entry:63-69、162-169；ext:758-761。

## 按推理结构选档（通用规则，Opus 5 与其他 GPT-6 Codex 模型）

- low 直接执行明确操作，medium 判断可在局部完成，high 综合多项行为或交付约束，xhigh 消解冲突证据、排查混杂解释或检验跨边界行为；max 是需系统反证、严格推导与失效分析的例外攻坚，或需有排除外部阻碍后深入分析仍不足的具体证据 —— ext:395-402；test:1378-1412（四种分类器共用提示契约，不验证线上语义效果）
- 近期对话只补全同任务的目标、约束和交付要求；不继承旧难度，简短的继续或修改也结合前文判断；不按主题、代理数量、精美成片、操作敏感或重试提档；high 仅在无法识别任务要求时保守兜底，不替代模型专长、授权与实测 —— ext:395；test:1392-1399
- 字号调整、图示设计、查数画图与混杂归因为判据示例，不是线上分类保证 —— ext:397-400；test:1378-1412 只校验发送内容
- 分类看不到图片与工具结果，同轮工具续调不重分类，已有历史决策不变；修改提示不改变输入或映射 —— ext:132-157, ext:608, ext:872-925, ext:958-960, ext:992-996

## 缓存重建后暂停

- 调整过档位且上一次缓存读取大于 0 时，本次读取比上一次少就提示「检测到缓存重建」，并写明两次读取量和可能原因；只是写入变大不算；每轮最多计一次 —— ext:879, ext:1007-1028；test:1554-1566, test:1593-1630
- 缓存过期、压缩、树导航和切换模型属于正常失效，不做判断：两次主请求开始时刻相隔超过缓存保留时间（模型目录 promptCache.short，没有时 5 分钟）、上次判断以来发生压缩或树导航、模型变了，都跳过本次判断 —— ext:97-106, ext:800-801, ext:816-817, ext:1019-1022；test:1632-1673
- 「服务端提前清除缓存，或其他扩展改了提示词，也可能触发」：这些情况同样会让读取变少，扩展无法区分，警告文案列出这些可能原因 —— ext:1026-1028
- 同一会话累计两次暂停：不再调用分类器、沿用当前档位、🧠 段显示暂停原因和恢复路径 —— ext:1029-1034, ext:844-845, ext:889, ext:586-587；test:1554-1575
- 「恢复自动调整」恢复并清零计数；切换主模型不解除，新会话清零 —— ext:660-670, ext:792-801；test:1576-1591
- 暂停时「查看分类模型与状态」显示「暂停（检测到两次缓存重建）」 —— ext:676；test:1577-1578
- 图 8 的触发次数是示例，状态栏文字是源码原文；第一个方框副标题「读取比上一次少」、底部「不做判断：缓存过期、压缩、树导航、切换模型」即上面两条 —— ext:586-587, ext:1021-1023, ext:1029

## 判档测评

- 菜单 `/personal` → 原位思考强度 → 运行判档测评；确认框说明会消耗 OpenRouter 额度；Esc 取消；Pi 工作时不能运行；只在终端界面 —— entry:68；ext:681-729；test:1719-1799
- 75 个用例 × Opus 5.5 / Sonnet 5.5 / Fable 5.2 三套规则 = 225 次分类；只调用分类器；结果显示命中率、偏低、偏高、无效数、中位耗时 —— ext:482, ext:512-556；test:1691-1717
- 明细在 agent 目录的 `inline-effort-bench` 文件夹，不含用例原文 —— ext:721-724；test:1746-1788
- 测评期间首选分类器失败也不逐条弹出切换警告；回退到 Jev 的次数和原因分布写在结束时的汇总里，首选非 Jev 分类器时多一行回退统计；图注中的「225 次 / HTTP 429」是示例 —— ext:447-451, ext:471, ext:517-520, ext:549-566, ext:704-706；test:1691-1717, test:1746-1788
- 用例原样来自 auto-effort（HeyCubit/effortless 用例的按模型标注版），MIT 许可全文在 `extensions/inline-effort-data/THIRD_PARTY.md`；20 个 holdout 不用于调整提示词 —— extensions/inline-effort-data/THIRD_PARTY.md；README.md:201
- 实测（2026-11-14，Jev，Pi 1.5.2）：Opus 5.5 74/75（98.7%）、holdout 20/20、中位 414ms；Sonnet 5.5 65/75（86.7%）、18/20、406ms；Fable 5.2 70/75（93.3%）、19/20、402ms；225 次调用 0.01501479 美元 —— report「真实 Jev 测评」
- 命中率只说明结果和标注一致，不代表主模型完成质量 —— README.md:201

## 改名与兼容

- 配置文件为 agent 目录下的 `inline-effort.json`；升级后原有设置自动保留（旧 `jev-inline-effort.json` 和旧开关仍能读取） —— ext:44-57, ext:71；entry:121-122；README.md:172、182-184
- Esc 逐级返回，取消不保存；设置保存后回到二级菜单，重载后结束导航；批量开关从一级进入时取消返回一级，直接 switches 取消退出 —— tests/personal-navigation.test.mjs；tests/personal.test.mjs「统一入口按开关注册五项功能」

## 自动回退与安全原因

- 只有合法档位、有限且位于 [0, 1] 的概率才可归为低置信度；0 静默，0.5 可采用，非法概率、截断或缺答案视为结果无效。结果无效与低置信度均不触发 Jev 回退，直接沿用最近档位并持久化（结果无效发一次警告，低置信度静默），恢复和工具续调不重复分类 —— ext:413-419, ext:460-464；test:307-345, test:718-739, test:920-970。
- 固定样例测试仅低置信度时返回普通 info 提示，不发 warning、不回退，不写决策或改变状态 —— test:834-858。

- 首选非 Jev 模型（`d1-ultra`、`mammoth-27b`、`decider`）在请求超时或服务报错时，依次尝试首选模型、Jev（`typesafe/jev-1.14`），先发切换 warning；Jev 返回低置信度时仅警告首选模型的真实错误并沿用当前强度，Jev 返回结果无效或报错时合并列出两条错误并沿用。每模型独立 15 秒，最多约 30 秒；全局选择不变，下条新消息重新尝试首选 —— ext:453-473；test:616-716, test:771-790。
- 回退成功记录 classifier=jev、fallbackFrom=首选模型键；状态栏显示 `Jev（〈首选模型〉 回退）`。恢复和工具续调沿用，不破坏历史前缀；Claude、Antigravity 同样生效 —— test:741-769, test:814-832。
- HTTP 429 显示服务限流、携带 Guardrail 关键词的 404/403 显示 OpenRouter 策略或白名单限制、5xx 显示上游服务异常；未知原因明确提示未识别。不输出服务端原文或凭据。回退警告在 Jev 调用前出现；成功后显示实际模型和档位，未获合格档位时只列出实际错误或结果无效，低置信度不警告 —— ext:175-193；test:616-716, test:1301-1376。
- 用户取消或生命周期切换不继续回退，不写迟到决策或显示完成通知；已经发出的切换提示保留。空白输入不调用、配置无效不尝试任何模型 —— test:347-367, test:474-501, test:792-812。
- 固定样例可用性测试走同一回退流程，不把 Jev 成功说成首选模型成功，不改会话决策、状态或基线 —— test:834-858, test:1301-1376。
- 演示区用本地固定示例模拟 Jev 返回 low，不发送 API 请求、不保证线上结果；仅服务报错可回退，结果无效与低置信度不回退并沿用基线 —— tests/effort-demo.test.mjs。

- 本轮重录 personal-menu、personal-switches、statusline-style，后者包含第五项标题开关及状态栏标题；其他认证/聊天录屏保留历史画面并在紧邻图注中标明标题位置已变化，不伪造模型调用 —— docs/extensions-usage/tapes/；两版页面可见历史录屏图注。
- 删除原视频审查后（/personal 一级菜单和批量开关各少一项），在按 _settings.tape 创建的临时 agent 目录重录 personal-menu、personal-switches、statusline-style、clickable-paths-status、effort-status、effort-model，画面中一级菜单为五项功能加「批量功能开关」；前三个录制前移除了临时目录里的凭据文件，后三个保留凭据文件但不发送模型消息；随后重录 auto-name-model、auto-name-status（旧画面的一级菜单还有已合并的「右下角会话标题」），保留凭据文件但不发送模型消息，两个 tape 去掉一级菜单里多余的一次下移；未重录的只剩 chat-turn —— docs/extensions-usage/tapes/；docs/extensions-usage/media/；extensions/pi-personal-extensions.ts:16-47
