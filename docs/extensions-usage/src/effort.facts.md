# effort（使用者版）事实清单

路径缩写：`ext` = `extensions/inline-effort.ts`，`entry` = `extensions/pi-personal-extensions.ts`，`test` = `tests/inline-effort.test.mjs`。技术版出处见 `docs/extensions-guide/src/effort.facts.md`。

## 它能帮你什么

- 档位共五档：low、medium、high、xhigh、max —— ext:77, ext:151-155
- 给每条新用户消息选一个档位；同一批进入请求的新消息共用一次分类结果，空白消息不分类 —— ext:322-356, ext:330, ext:343；test:599-603；README.md:91, README.md:93
- 只调整思考强度，主模型不变 —— README.md:82；ext:366-390, ext:392-428
- 图 1 的三条消息和档位是示例；「把 hello 转成大写」是「测试分类模型可用性」的固定样例 —— ext:257

## 想让它生效

- GPT-6 Codex 适用条件：接口 `openai-codex-responses`、模型 ID 以 `gpt-6` 开头、thinking 不是 off —— ext:70, ext:80-82, ext:306-308；README.md:58-63
- Claude 适用条件：接口 `anthropic-messages`、`compat.supportsMidConvoEffort === true`、模型 ID 精确等于 `claude-opus-5`、`claude-opus-5-5` 或 `claude-sonnet-5-5`，且 thinking 不是 off；不新增其他模型 —— ext:84-88, ext:306-308；README.md:58-67；test:173-193
- 两类模型都需要 OpenRouter 认证；Codex 另需 `openai-codex` 登录；分类器走 OpenRouter —— README.md:58；ext:71
- 示例启动命令 `pi --model openai-codex/gpt-6.1-sol --thinking medium` 是 GPT-6 Codex 示例 —— README.md:67-71
- 「查看分类模型与状态」输出「适用」或「当前主模型或 thinking 不适用」；「适用」只检查主模型和 thinking，不检查登录、分类器连通 —— ext:244, ext:306-308
- 确认步骤：「测试分类模型可用性」检查分类器；发消息后看 🧠 段的档位，弹出分类警告表示分类失败、沿用当前档位（仍按最近一次决策照常调整，不显示「未调整」）；Codex 出现「未调整」表示请求对齐失败、这次没有调整、按基线发出 —— ext:256-263, ext:338, ext:352, ext:356, ext:400-403, ext:419-427
- Codex 在当前用户消息前插入 `configuration_update`；Claude 只修改 Pi 已生成的末尾空 system 消息中的 `output_config.effort`，不改顶层 output_config、thinking、历史消息或 thinking blocks —— ext:366-390, ext:392-428；test:658-710
- Claude 内部重建或重试复用原模型快照；流式切模型后旧回复仍保存实际档位；Pi 的 `max_tokens: 1` 缓存预热回放不干预。因无请求 ID，`max_tokens: 1` 主请求也不自动调整，待 Pi 暴露请求 ID 后再区分 —— ext:202-207, ext:309-315, ext:365-390, ext:431-439；test:745-789；README.md:84
- Anthropic 官方文档明确上述三个 Claude 模型支持逐消息 effort 并保持此前缓存前缀；所需 beta 由 Pi 发送 —— README.md:86；https://platform.claude.com/docs/en/build-with-claude/effort#change-effort-mid-conversation-beta
- 保留缓存前缀不保证 100% 命中；TTL、最小 token 数和其他提示变更仍影响命中 —— README.md:86
- Gemini 4 Argon 已存在，但官方资料只明确 implicit cache；未找到改变 thinking_level 保缓存的明确官方承诺，因此不支持。这是缺证，不是证明会丢缓存 —— README.md:88；https://ai.google.dev/gemini-api/docs/latest-model
- 仅 Codex：`configuration_update` 不能和服务端自动压缩、自动截断或 `/responses/compact` 一起用；Pi 客户端压缩不受影响 —— README.md:97
- 功能默认开启，可在 `/personal` 里关闭 —— entry:50, entry:91-93, entry:162-180

## 状态栏的 🧠 段

- 格式：实际档位与基线不同时 `🧠 实际 · 基线 基线值 · 分类器`，相同时 `🧠 基线值 · 分类器` —— ext:389, ext:427；test:135, test:156, test:670
- 基线 = Pi 当前的 thinking 设置，会话中修改 thinking 后基线随之变化（每次请求读取） —— ext:338, ext:396
- 仅 Codex：「未调整」表示这次请求没能调整，按基线发出 —— ext:400-403；test:250
- Pi 自带的 thinking 显示只反映基线 —— README.md:82
- 恢复会话或切换模型后 🧠 段被清空；满足适用条件的下一次请求后显示 —— ext:309-320, ext:365-427
- 分类器一栏取最近一次决策；空白消息的决策显示「未分类」 —— ext:74-76, ext:343-356, ext:389, ext:398

## 想看现在的状态

- 「查看分类模型与状态」显示是否适用、后续分类器、当前分支最近决策（档位 · 分类器） —— ext:234, ext:240-247
- 「测试分类模型可用性」用固定样例测试，不写决策、不改强度 —— ext:256-263；entry:73
- 录屏 effort-status：输出适用、后续分类 openrouter/liquid/d1-ultra、最近决策「尚无」（录制环境配置） —— docs/extensions-usage/media/effort-status.png；ext:244

## 想换分类器

- `/personal` → 原位思考强度 → 「选择分类模型（Jev / d1-ultra）」打开选择器，选择 Jev 或 d1-ultra；Enter 保存（Pi 选择框通用按键），Esc 放弃 —— ext:265-287；README.md:75
- Jev 默认，d1-ultra 付费；统一通过选择器切换 —— ext:11-14, ext:35, ext:265-298；README.md:94
- 新选择对所有会话生效，从下一条未分类的消息开始，已有消息的档位不变 —— ext:298, ext:346；README.md:90
- Pi 正在工作时不能切换或测试 —— ext:249-252, ext:293-296；README.md:90
- 录屏 effort-model：标题「思考分类模型（全局）· 当前：openrouter/liquid/d1-ultra」，两项 Jev / d1-ultra，底部提示 enter select，Esc 退出不保存；默认是 Jev —— usage-captures.md；ext:35, ext:277-280

## 分类失败怎么办

- 15 秒超时或服务出错时沿用当前档位并警告 —— ext:72, ext:222-224, ext:345-353；README.md:93
- 档位无效或把握不足（所选档位概率低于 0.5）时静默沿用；服务错误或响应格式损坏时警告 —— ext:164-173, ext:352；pi-ai/dist/api/system-one-shared.js:37-55, :174-180；test:285-308
- 当前档位 = 当前分支上一次决策，没有就是基线 —— ext:338
- 对话照常进行（沿用后照常发出请求） —— ext:347, ext:356
- 警告原文 —— ext:352
- 警告里建议在 `/personal` → 原位思考强度 → 「选择分类模型」或「测试分类模型可用性」中检查 —— ext:352

## 代价和隐私

- 每次分类多等一会儿，最多 15 秒 —— ext:72, ext:160, ext:214；README.md:92-93
- 消耗 OpenRouter 额度；d1-ultra 付费，价格以 OpenRouter 为准 —— README.md:92, README.md:94
- 发送当前消息和之前最多 6 条用户或助手消息的文本，可能含业务信息 —— ext:100-114（slice(-6)）；README.md:92
- 不发送系统提示词、工具输出、思考内容和图片数据 —— ext:90-97, ext:343；README.md:92；test:332-344

## 本轮补充

- 章节导语「不用这些模型可以跳过本章」指 GPT-6 Codex 和三个指定 Claude 模型以外的情况 —— ext:306-308（不适用时不分类）；README.md:58-67
- 图 3 对照行：Pi 自带 thinking 显示是基线，实际档位看 🧠 段 —— README.md:82；ext:389, ext:427
- 换分类器步骤条（↑↓ 选择、Enter 保存、Esc 放弃）—— usage-captures.md（录屏底部提示 enter select / escape cancel）；ext:279-280

## 单一入口（/personal）

- 本项目只注册 `/personal`；原位思考强度的操作都在 `/personal` → 原位思考强度（Jev / d1-ultra）的菜单项里 —— entry:50, entry:70-74, entry:129-139
- 菜单项：查看分类模型与状态、选择分类模型（Jev / d1-ultra）、测试分类模型可用性 —— entry:71-73
- 录屏 effort-status：/personal → 原位思考强度 → 查看分类模型与状态，输出原文见 scratchpad/recapture-actual.md（最近决策：尚无，指向菜单路径） —— ext:244；entry:71
- 录屏 effort-model：选择器标题当前 d1-ultra，光标 Jev → d1-ultra → Jev，Esc 退出；二级菜单含三个设置项，加上「禁用此功能并重载」共四项 —— entry:71-73, entry:162-168；ext:279

## 改名与兼容

- 配置文件为 agent 目录下的 `inline-effort.json`；升级后原有设置自动保留（旧 `jev-inline-effort.json` 和旧开关仍能读取） —— ext:23-33, ext:48；entry:121-122；README.md:115, README.md:124-125
- Esc 逐级返回，取消不保存；设置保存后回到二级菜单，重载后结束导航；批量开关从一级进入时取消返回一级，直接 switches 取消退出 —— tests/personal-navigation.test.mjs；tests/personal.test.mjs「统一入口按开关注册六项功能」
