# pi-personal-extensions

个人维护的 [Pi](https://pi.dev) 扩展合集。通过单一入口 `extensions/pi-personal-extensions.ts` 加载，只向 Pi 注册 `/personal`，管理六项功能。每项功能各用一个实现文件。

## 功能演示

https://github.com/user-attachments/assets/b752ae51-9b07-481a-919d-2403c3324da7

## 安装与开发

需要 Pi ≥ 1.0.1、Node.js ≥ 22.19。在仓库根目录执行：

```bash
npm install --ignore-scripts --registry=https://registry.npmmirror.com
npm run check
pi install "$(pwd)"
```

依赖镜像使用 npmmirror。修改代码后在 Pi 中执行 `/reload`；卸载使用 `pi remove "$(pwd)"`。

## 统一管理

`/personal` 是所有功能的管理入口：选择功能后，可启停或进入其设置。上下选择、Enter 确认。三级菜单按 Esc 返回二级，二级返回一级，一级才退出；取消不保存。保存设置或查看状态后留在二级菜单，启停功能和应用配色则退出并重载。例如：

```text
/personal → 原位思考强度（Jev / d1-ultra） → 选择分类模型（Jev / d1-ultra）
/personal → 自动会话命名 → 选择命名模型
/personal → 文件路径可点击 → 打开方式：cursor
/personal → 状态栏：额度、会话 ID 与配色 → 选择 pi-statusline 自定义配色
```

默认全部开启。禁用的功能只提供启用入口，不注册其事件。启停保存后自动重载；其他已打开的会话需各自 `/reload`。菜单显示的是功能是否已加载，各功能自身状态在对应子菜单中查看。

支持交互界面的客户端均可使用 `/personal`，包括 RPC 客户端；没有 UI 时提示并返回。批量启停可选择「批量功能开关」，或执行 `/personal switches`：空格切换、Enter 保存、Esc 取消。批量界面需要 TUI；RPC 中会提示从各功能菜单逐项启停。

| 功能 | 作用 |
| --- | --- |
| `session-title` | 输入框下方右对齐显示会话名，长标题自动省略，不调用模型 |
| `auto-session-name` | 工作完成后后台命名，保护手动标题 |
| `statusline` | 显示服务商剩余额度和会话 ID（末尾 8 位），预览并应用 11 套配色 |
| `clickable-paths` | 将本地文件路径转换为可点击链接，支持行列定位 |
| `user-message-border` | 为 TUI 普通用户消息添加橙色圆角边框，不修改上下文 |
| `inline-effort` | 用 Jev 或 d1-ultra 自动调整 GPT-6 Codex、Anthropic 协议分支的指定 Claude 模型和 Antigravity 分支的指定 Claude 模型的思考强度 |

`pi config` 管理整个扩展包。各功能设置均从 `/personal` 进入（例外：路径链接的 `userMessages` 只能在 `clickable-paths.json` 里改）；启停功能不会清除其独立配置。

## 自动会话命名

TUI / RPC 中每轮成功结束后，参考当前分支最近最多 5 轮对话更新标题。Print / JSON 模式不自动调用。

在 `/personal → 自动会话命名` 中查看状态、模型和实际思考强度，选择命名模型或独立思考强度，也可暂停或恢复当前会话命名。「选择命名模型」只列出已认证的 scoped-models。「预览建议标题」只预览、不改名，需等待工作结束。Pi 自带的 `/name 自定义标题` 会手动命名，并暂停自动命名。

- 默认模型为 `gpt-5.6-luna`。不可用时保留原标题，不改用主模型或其他模型。
- 默认继承 `/settings` 中该模型的默认思考强度，未配置时用 `low`；不是主会话的临时思考等级。更换命名模型后恢复继承。
- 复用 Pi 认证和代理，不改变主模型或主会话思考强度。配置保存后用于后续命名请求。
- 仅发送标题和对话文本片段：每轮用户最多 2,000 字符、助手最多 1,500 字符，不发送工具结果、思考或图片。文本仍可能包含业务信息。
- 命名及预览额外消耗所选模型额度，不计入 Pi 原生会话用量统计。
- 30 秒超时或失败时保留原名；新任务、会话切换、树导航、重载和退出会取消未完成请求。

## 自动思考强度

支持 GPT-6 Codex、Anthropic 协议分支的三个指定 Claude 模型，以及 Antigravity 分支的两个指定 Claude 模型。三个分支都要求 thinking 不为 `off`，并使用 OpenRouter 上的分类器。GPT-6 Codex 还需要 `openai-codex` 登录。Antigravity 还需要先安装并启用 `pi-antigravity`，由插件注册带 legacy `streamSimple` 的 `antigravity` provider；本机使用 `pi-antigravity` 0.11.0。

| 主模型分支 | provider / 接口 | 模型条件 | 调整方式 |
| --- | --- | --- | --- |
| GPT-6 Codex | `openai-codex-responses` | 模型 ID 以 `gpt-6` 开头 | 在当前用户消息前插入 `configuration_update` |
| Claude（Anthropic 协议） | `anthropic-messages` | 模型 ID 精确等于 `claude-opus-5`、`claude-opus-5-5` 或 `claude-sonnet-5-5`；`compat.supportsMidConvoEffort === true` | 只修改 Pi 已生成的末尾空 `system` 消息中的 `output_config.effort` |
| Claude（Antigravity） | provider `antigravity`；接口 `antigravity-api` | 模型 ID 精确等于 `claude-opus-5-5` 或 `claude-sonnet-5-5` | 临时包装 `pi-antigravity` 的原生 `streamSimple`，只修改匹配请求的 `options.reasoning` |

不新增其他模型。GPT-6 Codex 启动示例：

```bash
pi --model openai-codex/gpt-6.1-sol --thinking medium
```

在 `/personal → 原位思考强度（Jev / d1-ultra）` 中选择：

- 「查看分类模型与状态」：查看分类模型和当前分支的最近决策。
- 「选择分类模型（Jev / d1-ultra）」：选择并保存；取消不保存。
- 「测试分类模型可用性」：用固定公开样例测试，不改强度或会话决策。

| 选择 | OpenRouter 模型 ID |
| --- | --- |
| `jev` | `~typesafe/jev-latest` |
| `d1-ultra` | `liquid/d1-ultra` |

分类器只选择 `low`、`medium`、`high`、`xhigh`、`max`，不替换主聊天模型。GPT-6 Codex 通过 `configuration_update` 调整强度，顶层 `reasoning.effort` 保持基线。Anthropic 协议分支使用 Pi 原生逐消息标记，只改末尾空 `system` 消息的 `output_config.effort`；顶层 `output_config`、`thinking` 和历史消息不变。Antigravity 是独立分支，不使用 Anthropic 的消息级 `output_config`。状态栏显示实际强度及最近尝试的分类模型，例如 `🧠 xhigh · 基线 medium · Jev`；Pi 自带的 thinking 显示仅反映基线。

`pi-antigravity` 不触发 `onPayload`。因此，Antigravity 分支在 `context_with_system` 分类后，临时包装插件的原生 `streamSimple`。包装保留原 `oauth`、`headers`、`images` 和 `refreshModels`。注册和恢复 wrapper 时，扩展携带 `provider.getAllModels` 的当前动态目录，包括 chat、image 和 classifier 模型，并按 `type + id` 补回 registered model 的 `headers`。只有 `sessionId`、末条消息 `timestamp` 和模型都匹配当前主请求时，扩展才修改 `options.reasoning`，再交给插件按 `-low`、`-medium`、`-high` runtime ID 路由。`max` 和 `xhigh` 夹到 `high`。会话 thinking 和历史上下文不变。

Anthropic 协议分支和 Antigravity 分支都在 `message_end` 保存实际发送的 `providerThinkingLevel`。Anthropic 协议分支用该字段供 Pi 重放历史标记。主会话 thinking 基线不变。工具续调、同一主请求重试和会话恢复沿用原决策。

Anthropic 协议请求由提供方内部重建或重试时，扩展复用原模型快照。流式期间切换模型后，旧回复仍保存实际档位。扩展不干预 Pi 的 `max_tokens: 1` 缓存预热回放。当前没有请求 ID 可用于区分请求，因此 `max_tokens: 1` 的主请求也不自动调整；等待 Pi 暴露请求 ID 后再区分。Antigravity 的 `maxTokens: 1` 预热和辅助 session 也不干预。`session_shutdown` 只恢复原 `streamSimple`，保留第三方后来对 `headers` 等字段的部分更新；如果其他扩展已替换 `streamSimple`，则不覆盖。

三个分支都以保留缓存前缀为目标，但不保证缓存 100% 命中。缓存命中仍受 TTL、最小 token 数和其他提示变更影响。

本次扩展 wrapper 真实通道短时实测使用固定分类夹具，强制 `low → high → medium → low`，避免分类波动。主模型使用真实 Antigravity。`cacheRead` 分别为：`claude-opus-5-5` 的 `0 / 13981 / 13994 / 14014`，`claude-sonnet-5-5` 的 `0 / 13978 / 13991 / 14011`。请求基线始终为 `medium`，实际 runtime 后缀依次为 `low / high / medium / low`，`message_end` 保存的实际字段与之一致。Opus 在完整成功序列前另有若干次 `SAFETY` 零输出尝试，这些尝试未计入成功序列。固定分类夹具不等于真实 Jev 端到端测试。这些数字只代表本次短时实测，不是厂商保证，也不保证 TTL 到期或提示词变化后仍命中。

[Anthropic 官方文档](https://platform.claude.com/docs/en/build-with-claude/effort#change-effort-mid-conversation-beta)明确 Anthropic 协议分支的上述三个 Claude 模型支持逐消息 effort，并保持此前缓存前缀。该能力需要 beta `mid-conversation-output-config-2026-07-01`，由 Pi 负责发送。其他 Opus、Sonnet 版本并非全部支持，本扩展不扩大模型范围。Pi v1.5.0 的 [Anthropic 序列化实现](https://github.com/earendil-works/pi/blob/v1.5.0/packages/ai/src/api/anthropic-messages.ts)已有原生标记；本仓库依赖的 1.0.1 也有此能力，无需升级依赖。

[Gemini 4 Argon](https://ai.google.dev/gemini-api/docs/latest-model) 已存在，但官方资料只明确 implicit cache。本次未找到「改变 `thinking_level` 仍保留缓存」的明确官方承诺，因此不支持 Gemini 4 Argon。这是缺少证据，不是证明切换档位一定丢失缓存。

- 切换从下一条尚未分类的用户消息生效，无需重载；其他会话和子代理的后续分类也读取全局选择。工作中不能切换或测试。
- 每条新用户消息分类一次，包括 steer 和 follow-up；工具续调和重试不重复分类。决策跟随分支，恢复、fork、树导航和压缩后保持原结果。
- 发送当前请求和近期对话文本，内容预算合计 16,000 字符；不发送系统规则、工具结果、思考或图片数据。文本可能包含业务信息，分类会增加等待时间并消耗服务额度。
- 15 秒超时、服务不可用、结果无效或 `probabilities[choice] < 0.5` 时沿用当前强度，不切换分类模型。取消不记录决策，空白输入不调用。配置无效时提示，可在 `/personal → 原位思考强度（Jev / d1-ultra） → 选择分类模型（Jev / d1-ultra）` 中重新保存。
- 复用 Pi 原生 classifier、OpenRouter 认证及代理。d1-ultra 是付费模型，价格以 [OpenRouter 端点信息](https://openrouter.ai/api/v1/models/liquid/d1-ultra/endpoints)为准。
- OpenRouter 白名单需放行实际服务商及模型。`Latest` 别名还需放行解析后的固定版本，否则可能被 Guardrail 拦截。
- 子代理需加载本扩展，角色 thinking 作为基线；外部 CLI 代理不经过本扩展。
- 仅 GPT-6 Codex：`configuration_update` 不能与服务端自动压缩、自动截断或 `/responses/compact` 混用；Pi 客户端压缩不受影响。Codex 请求无法与上下文对齐时不注入，并显示「未调整」。

## 路径链接与状态栏

在 `/personal → 文件路径可点击` 中查看设置、开启或暂停路径链接。通过「打开方式：vscode」等菜单项选择 `vscode`、`vscode-insiders`、`cursor`、`windsurf` 或 `file`。通过「识别裸路径」或「不识别裸路径」控制不带反引号的路径识别。

在 `/personal → 状态栏：额度、会话 ID 与配色` 中统一启停额度、会话 ID 和配色选择功能。通过「选择 pi-statusline 自定义配色」选择 11 套配色：TUI 支持实时预览，RPC 使用普通列表。应用后覆盖 `pi-statusline.json` 中的自定义配色（`palettePreset: "custom"`），并设为紧凑布局、圆角分隔符，再自动重载；不改变 Pi 主题。需另行安装并启用 pi-statusline。

额度与会话 ID 由本包提供。配色需要另行启用 `npm:@narumitw/pi-statusline`，本包不包含该状态栏本体。额度显示支持 `openai-codex` 周额度、`zai-coding-cn` 的 5 小时和周额度、`kimi-coding` 的 5 小时额度（老套餐另显示周额度，新套餐另显示月度额度），以及 `antigravity` 的当前模型配额（例如 `quota 60% left`）。

Antigravity 额度需要先安装并启用 `pi-antigravity`。扩展通过当前 provider 获取 JSON 凭据，请求 Google `fetchAvailableModels`，再按当前模型 ID、运行变体或指定别名匹配配额；多个同模型变体取最低剩余值。`quota` 是当前模型在服务端对应的配额，可能使用共享池，不是独立的 5 小时或周窗口，也不是 token 计数。找不到配额或查询失败时隐藏 Antigravity 旧值，其他服务商仍保留各自缓存。每次刷新都会重新解析当前账号凭据，账号变化在下一刷新生效；扩展不主动监听账号切换。切换模型会强制查询，不显示旧模型缓存。刷新时机和冷却不变。

## 配置文件

默认位于 `~/.pi/agent/`：

| 文件 | 内容 |
| --- | --- |
| `personal-extensions.json` | 六项功能的布尔开关 |
| `auto-session-name.json` | 命名模型 `model` 和思考设置 `thinking` |
| `inline-effort.json` | 分类模型：`{"model":"jev"}` 或 `{"model":"d1-ultra"}`；新文件缺失时兼容读取 `jev-inline-effort.json` |
| `clickable-paths.json` | 路径链接设置 |
| `pi-statusline.json` | 状态栏配色 |

设置 `PI_CODING_AGENT_DIR` 后，以上文件都改用该目录。配置选择器取消不保存；命名和分类设置不修改 Pi 的 `settings.json`。

旧配置自动兼容：

- `personal-extensions.json` 中的 `substatusline` 和 `statusline-style-picker` 合并为 `statusline`。缺失的旧键按默认开启处理；任一旧键为 `true` 即开启，两个旧键都为 `false` 才关闭。
- `jev-inline-effort` 开关映射到 `inline-effort`。新键存在时以新键为准；旧键仍须为布尔值。读取不改写配置，下次保存功能开关时只写六个新键。
- 仅在 `inline-effort.json` 缺失时读取 `jev-inline-effort.json`；保存只写新文件，保留旧文件。新文件格式或权限有误时提示错误。
- 会话中的思考决策条目类型和状态栏键仍为 `jev-inline-effort`；自动命名会话状态仍为 `personal-auto-session-name`。状态栏继续使用 `usage` 和 `session-id`，旧会话可直接恢复。

## 自动思考强度的选档规则

自动选档按本轮交付的推理结构分为五档：`low` 直接执行明确操作；`medium` 做局部可判的成熟查询或排错；`high` 综合多项约束完成常规设计、联动修改或表达；`xhigh` 处理冲突证据、混杂因素或跨边界耦合推理；`max` 为例外攻坚档，要求系统反证、严格推导与失效分析，或有具体证据表明排除数据、权限、工具等外部阻碍后，深入分析仍不足。

近期对话只补全同一任务省略的目标、约束与交付要求，不继承旧档位。示例：修改位置和方式明确的字号调整可用 `low`，改做讲解图示设计可用 `high`；按成熟口径查数画图可用 `medium`，排查多因素混杂原因可用 `xhigh`。这些是判据示例，不是线上分类保证。

不按专业主题、长文本、多代理、精美成片、操作敏感或反复报错自动提档；仅无法识别任务要求时才以 `high` 保守兜底。思考强度不代替模型专长、语感、审美、授权与实测；分类只读有限文本，不看图片和工具结果，同轮工具续调与已有历史消息不重分类。新规则只影响后续尚未分类的消息，不改变档位映射、主模型或基线。

## 项目结构

- `extensions/`：统一入口及功能实现。
- `tests/`：功能与回归测试。
- `package.json`：包声明和开发命令。
- `CHANGELOG.md`：更新记录。

运行 `npm run check` 检查类型并执行全部测试。用户消息边框依赖 Pi 组件渲染方法，升级 Pi 后应验证兼容性。
