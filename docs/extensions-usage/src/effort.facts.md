# effort（使用者版）事实清单

路径缩写：`ext` = `extensions/inline-effort.ts`，`entry` = `extensions/pi-personal-extensions.ts`，`test` = `tests/inline-effort.test.mjs`。技术版出处见 `docs/extensions-guide/src/effort.facts.md`。

## 它能帮你什么

- 档位共五档：low、medium、high、xhigh、max —— ext:77, ext:144-150
- 给每条新用户消息选一个档位；同一批进入请求的新消息共用一次分类结果，空白消息不分类 —— ext:318-344, ext:320, ext:331；test:593-598；README.md:78
- 只调整思考强度，主模型不变 —— README.md:75；ext:382
- 图 1 的三条消息和档位是示例；「把 hello 转成大写」是「测试分类模型可用性」的固定样例 —— ext:249

## 想让它生效

- 适用条件：接口 `openai-codex-responses`、模型 ID 以 `gpt-6` 开头、thinking 不是 off（朗读只说 GPT-6 系列并开启 thinking，完整条件在不朗读的列表） —— ext:70, ext:80-82, ext:299-300；README.md:58
- 需要 `openai-codex` 登录和 OpenRouter 认证；分类器走 OpenRouter —— README.md:58；ext:71
- 示例启动命令 `pi --model openai-codex/gpt-6.1-sol --thinking medium` —— README.md:61
- 「查看分类模型与状态」输出「适用」或「当前主模型或 thinking 不适用」；「适用」只检查主模型和 thinking，不检查登录、分类器连通 —— ext:236, ext:299-300
- 确认步骤：「测试分类模型可用性」检查分类器；发消息后看 🧠 段的档位，弹出分类警告表示分类失败、沿用当前档位（仍按最近一次决策照常调整，不显示「未调整」）；出现「未调整」表示请求对齐失败、这次没有调整、按基线发出 —— ext:248-255, ext:326, ext:340, ext:344, ext:361-364, ext:381, ext:388
- 不能和服务端自动压缩、自动截断或 `/responses/compact` 一起用；Pi 客户端压缩不受影响 —— README.md:84
- 功能默认开启，可在 `/personal` 里关闭 —— entry:50, entry:91-93, entry:162-180

## 状态栏的 🧠 段

- 格式：实际档位与基线不同时 `🧠 实际 · 基线 基线值 · 分类器`，相同时 `🧠 基线值 · 分类器` —— ext:388；test:135, test:156
- 基线 = Pi 当前的 thinking 设置，会话中修改 thinking 后基线随之变化（每次请求读取） —— ext:326, ext:357
- 「未调整」：这次请求没能调整，按基线发出 —— ext:361-364；test:244
- Pi 自带的 thinking 显示只反映基线 —— README.md:75
- 恢复会话或切换模型后 🧠 段被清空；满足适用条件的下一次请求后显示 —— ext:306-310, ext:355, ext:388
- 分类器一栏取最近一次决策；空白消息的决策显示「未分类」 —— ext:74-76, ext:333-344, ext:360

## 想看现在的状态

- 「查看分类模型与状态」显示是否适用、后续分类器、当前分支最近决策（档位 · 分类器） —— ext:226, ext:232-239
- 「测试分类模型可用性」用固定样例测试，不写决策、不改强度 —— ext:248-255；entry:73
- 录屏 effort-status：输出适用、后续分类 openrouter/liquid/d1-ultra、最近决策「尚无」（录制环境配置） —— docs/extensions-usage/media/effort-status.png；ext:236

## 想换分类器

- `/personal` → 原位思考强度 → 「选择分类模型（Jev / d1-ultra）」打开选择器，选择 Jev 或 d1-ultra；Enter 保存（Pi 选择框通用按键），Esc 放弃 —— ext:257-279；README.md:67
- Jev 默认，d1-ultra 付费；统一通过选择器切换 —— ext:11-14, ext:35, ext:257-290；README.md:81
- 新选择对所有会话生效，从下一条未分类的消息开始，已有消息的档位不变 —— ext:290, ext:334；README.md:77
- Pi 正在工作时不能切换或测试 —— ext:241-244, ext:285-288；README.md:77
- 录屏 effort-model：标题「思考分类模型（全局）· 当前：openrouter/liquid/d1-ultra」，两项 Jev / d1-ultra，底部提示 enter select，Esc 退出不保存；默认是 Jev —— usage-captures.md；ext:35, ext:269-272

## 分类失败怎么办

- 15 秒超时或服务出错时沿用当前档位并警告 —— ext:72, ext:215-217, ext:337-341；README.md:80
- 档位无效或把握不足（所选档位概率低于 0.5）时静默沿用；服务错误或响应格式损坏时警告 —— ext:160-167, ext:340；pi-ai/dist/api/system-one-shared.js:37-55, :174-180；test:279-302
- 当前档位 = 当前分支上一次决策，没有就是基线 —— ext:326
- 对话照常进行（沿用后照常发出请求） —— ext:335, ext:344
- 警告原文 —— ext:340
- 警告里建议在 `/personal` → 原位思考强度 → 「选择分类模型」或「测试分类模型可用性」中检查 —— ext:340

## 代价和隐私

- 每次分类多等一会儿，最多 15 秒 —— ext:72, ext:154, ext:207；README.md:79
- 消耗 OpenRouter 额度；d1-ultra 付费，价格以 OpenRouter 为准 —— README.md:79, README.md:81
- 发送当前消息和之前最多 6 条用户或助手消息的文本，可能含业务信息 —— ext:94-108（slice(-6)）；README.md:79
- 不发送系统提示词、工具输出、思考内容和图片数据 —— ext:84-91, ext:331；README.md:79；test:326-338

## 本轮补充

- 章节导语「不用 GPT-6 系列可以跳过本章」—— ext:299-300（不适用时不分类）
- 图 3 对照行：Pi 自带 thinking 显示是基线，实际档位看 🧠 段 —— README.md:75；ext:388
- 换分类器步骤条（↑↓ 选择、Enter 保存、Esc 放弃）—— usage-captures.md（录屏底部提示 enter select / escape cancel）；ext:271-272

## 单一入口（/personal）

- 本项目只注册 `/personal`；原位思考强度的操作都在 `/personal` → 原位思考强度（Jev / d1-ultra）的菜单项里 —— entry:50, entry:70-74, entry:129-139
- 菜单项：查看分类模型与状态、选择分类模型（Jev / d1-ultra）、测试分类模型可用性 —— entry:71-73
- 录屏 effort-status：/personal → 原位思考强度 → 查看分类模型与状态，输出原文见 scratchpad/recapture-actual.md（最近决策：尚无，指向菜单路径） —— ext:236；entry:71
- 录屏 effort-model：选择器标题当前 d1-ultra，光标 Jev → d1-ultra → Jev，Esc 退出；二级菜单含三个设置项，加上「禁用此功能并重载」共四项 —— entry:71-73, entry:162-168；ext:271

## 改名与兼容

- 配置文件为 agent 目录下的 `inline-effort.json`；升级后原有设置自动保留（旧 `jev-inline-effort.json` 和旧开关仍能读取） —— ext:23-33, ext:48；entry:121-122；README.md:102, README.md:111-112
- Esc 逐级返回，取消不保存；设置保存后回到二级菜单，重载后结束导航；批量开关从一级进入时取消返回一级，直接 switches 取消退出 —— tests/personal-navigation.test.mjs；tests/personal.test.mjs「统一入口按开关注册六项功能」
