# pi-personal-extensions

个人维护的 [Pi](https://pi.dev) 扩展合集。通过单一入口 `extensions/pi-personal-extensions.ts` 加载，只向 Pi 注册 `/personal`，管理六项功能。每项功能各用一个实现文件。

## 安装与开发

需要 Pi ≥ 1.0.1、Node.js ≥ 22.19。在仓库根目录执行：

```bash
npm install --ignore-scripts --registry=https://registry.npmmirror.com
npm run check
pi install "$(pwd)"
```

依赖镜像使用 npmmirror。修改代码后在 Pi 中执行 `/reload`；卸载使用 `pi remove "$(pwd)"`。

## 统一管理

`/personal` 是所有功能的管理入口：选择功能后，可启停或进入其设置。上下选择、Enter 确认、Esc 取消。例如：

```text
/personal → 原位思考强度（Jev / d1-ultra） → 选择分类模型（Jev / d1-ultra）
/personal → 自动会话命名 → 选择命名模型
/personal → 文件路径可点击 → 打开方式：cursor
/personal → 状态栏：额度、会话 ID 与配色 → 预览并选择配色
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
| `inline-effort` | 用 Jev 或 d1-ultra 自动调整 GPT-6 Codex 思考强度 |

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

适用于 `openai-codex-responses` 接口的 GPT-6 系列，且 thinking 不为 `off`。需要 OpenRouter 认证和 `openai-codex` 登录。

```bash
pi --model openai-codex/gpt-6.1-sol --thinking medium
```

在 `/personal → 原位思考强度（Jev / d1-ultra）` 中选择：

- 「查看分类模型与状态」：查看分类模型和当前分支的最近决策。
- 「选择分类模型（Jev / d1-ultra）」：选择并保存；取消不保存。
- 「使用 Jev 分类模型」或「使用 d1-ultra 分类模型」：直接保存对应选择。
- 「测试分类模型可用性」：用固定公开样例测试，不改强度或会话决策。

| 选择 | OpenRouter 模型 ID |
| --- | --- |
| `jev` | `~typesafe/jev-latest` |
| `d1-ultra` | `liquid/d1-ultra` |

分类器只选择 `low`、`medium`、`high`、`xhigh`、`max`，不替换主聊天模型。通过 `configuration_update` 调整强度，顶层 thinking 保持基线，以保留缓存前缀。状态栏显示实际强度及最近尝试的分类模型，例如 `🧠 xhigh · 基线 medium · Jev`；Pi 自带的 thinking 显示仅反映基线。

- 切换从下一条尚未分类的用户消息生效，无需重载；其他会话和子代理的后续分类也读取全局选择。工作中不能切换或测试。
- 每条新用户消息分类一次，包括 steer 和 follow-up；工具续调和重试不重复分类。决策跟随分支，恢复、fork、树导航和压缩后保持原结果。
- 发送当前请求和近期对话文本，内容预算合计 16,000 字符；不发送系统规则、工具结果、思考或图片数据。文本可能包含业务信息，分类会增加等待时间并消耗服务额度。
- 15 秒超时、服务不可用、结果无效或 `probabilities[choice] < 0.5` 时沿用当前强度，不切换分类模型。取消不记录决策，空白输入不调用。配置无效时提示，可在 `/personal → 原位思考强度（Jev / d1-ultra） → 选择分类模型（Jev / d1-ultra）` 中重新保存。
- 复用 Pi 原生 classifier、OpenRouter 认证及代理。d1-ultra 是付费模型，价格以 [OpenRouter 端点信息](https://openrouter.ai/api/v1/models/liquid/d1-ultra/endpoints)为准。
- OpenRouter 白名单需放行实际服务商及模型。`Latest` 别名还需放行解析后的固定版本，否则可能被 Guardrail 拦截。
- 子代理需加载本扩展，角色 thinking 作为基线；外部 CLI 代理不经过本扩展。
- `configuration_update` 不能与服务端自动压缩、自动截断或 `/responses/compact` 混用；Pi 客户端压缩不受影响。请求无法与上下文对齐时不注入，并显示「未调整」。

## 路径链接与状态栏

在 `/personal → 文件路径可点击` 中查看设置、开启或暂停路径链接。通过「打开方式：vscode」等菜单项选择 `vscode`、`vscode-insiders`、`cursor`、`windsurf` 或 `file`。通过「识别裸路径」或「不识别裸路径」控制不带反引号的路径识别。

在 `/personal → 状态栏：额度、会话 ID 与配色` 中统一启停额度、会话 ID 和配色选择功能。二级菜单的「预览并选择配色」可预览全部 11 套配色；「应用配色：1. 茶墨渐层」等 11 个直达项可直接应用，支持 RPC。应用后自动重载；配色预览需要 TUI。

额度与会话 ID 由本包提供。配色需要另行启用 `npm:@narumitw/pi-statusline`，本包不包含该状态栏本体。额度显示支持 `openai-codex` 周额度，以及 `zai-coding-cn` 的 5 小时和周额度。

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

## 项目结构

- `extensions/`：统一入口及功能实现。
- `tests/`：功能与回归测试。
- `package.json`：包声明和开发命令。
- `CHANGELOG.md`：更新记录。

运行 `npm run check` 检查类型并执行全部测试。用户消息边框依赖 Pi 组件渲染方法，升级 Pi 后应验证兼容性。
