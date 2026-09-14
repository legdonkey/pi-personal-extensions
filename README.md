# pi-personal-extensions

个人维护的 [Pi](https://pi.dev) 扩展合集。Pi 只加载 `extensions/pi-personal-extensions.ts` 一个入口，通过 `/personal` 选择其中的七项功能。

## 功能开关

输入 `/personal` 打开功能列表：上下选择、空格切换，Enter 保存并自动重载，Esc 放弃修改。`pi config` 只负责整个扩展的启用或禁用。

开关保存在 `~/.pi/agent/personal-extensions.json`（设置 `PI_CODING_AGENT_DIR` 时跟随该目录），默认全部开启。关闭的功能不会注册命令、事件或定时器；保存后的重载会执行旧功能的正常清理。其他已打开的 pi 会话需要各自 `/reload`。

```json
{
  "terminal-title": true,
  "session-title": true,
  "auto-session-name": true,
  "substatusline": true,
  "clickable-paths": true,
  "user-message-border": true,
  "statusline-style-picker": true
}
```

各功能自己的配置继续保留。例如 `/personal` 中启用路径链接，只表示加载该功能，仍遵循 `/clickable-paths` 保存的设置。关闭风格选择器只移除命令，不恢复之前已应用的状态栏配色。

## 包含的功能

### terminal-title

将 Pi 的终端标题设置为 `π · <会话名>`；未命名会话只显示 `π`。标题会在会话启动、切换和 `/name` 后更新。

### session-title

在 TUI 输入框下方、状态栏上方单独显示一行右对齐的会话标题，不覆盖原生页脚或 `pi-statusline`。默认开启，可通过 `/personal` 中的「右下角会话标题」关闭。

- 读取 Pi 已有会话名，使用 `/name 标题` 修改后立即更新；启动、恢复、切换和重载时同步。
- 未命名时显示「未命名会话」。本显示组件不调用模型；自动生成由下面的独立功能负责。
- 长标题自动省略，支持中文和 emoji；不影响输入和其他状态栏信息。

### auto-session-name

参考 [oil-oil/oil-codex-title](https://github.com/oil-oil/oil-codex-title) 的后台命名方式和稳定命名规则，通过 Pi 官方 `setSessionName()` 接口实现，不修改数据库、不启动子 Agent。

- 默认开启。TUI / RPC 中每轮工作成功结束后，参考当前分支最近最多 5 轮对话，后台评估是否需要更新标题，例如 `🧩 邮箱验证码｜过期排查`；失败、中断或截断的轮次跳过。
- 使用「类别 emoji + 对象｜目标」，跟随最近用户消息的主要语言。通过提示词要求稳定对象名称和类别，只有任务实质变化才更新；“继续”“推送”等收尾动作不取代主线。
- 默认使用 **`gpt-5.6-luna`**，候选只来自 Pi 当前会话的 `/scoped-models`，并过滤未配置认证的模型。默认 ID 在多个服务商中匹配时，按 scoped 列表顺序选择；通过选择器保存后使用完整 `provider/modelId`。列表为空、模型被移出列表或未登录时会提示，保留原标题，不回退主模型或其他模型。
- 思考强度默认**继承 `/settings` → Default thinking level per model**（`modelThinkingLevels["provider/modelId"]`），未配置时使用 `low`；不是主会话临时思考强度、scoped pattern 的思考后缀或全局 `defaultThinkingLevel`。已信任项目中的对应设置优先于全局设置，继承值按 Pi 的模型能力规则调整。
- 可单独选择命名思考强度，选择器只展示该模型支持的等级；非推理模型实际使用 `off`。更换命名模型时恢复为继承，避免把旧模型的等级套到新模型。
- 复用 Pi 已配置的认证、服务商和代理端点，通过 Pi 的统一思考参数适配各模型。独立调用一次辅助请求，不向原对话插入消息，也不会改动主模型或主会话思考等级。自动命名及预览都会额外消耗**命名模型**额度；这部分消耗不计入 Pi 原生会话用量统计。
- 仅发送当前标题和对话文本片段：每轮用户文本最多 2,000 字符，助手文本最多 1,500 字符；不发送工具结果、思考内容或图片。片段中仍可能含有业务信息，会发送给选定的命名模型服务商。
- 保护已有手动标题。`/name 自定义标题` 后自动暂停当前会话命名；重新开启需要显式执行 `/auto-name on`。恢复和重载会保留暂停状态及自动标题归属。
- 新任务开始、切换会话、树导航、重载或退出时取消未完成请求，丢弃迟到结果；30 秒超时或异常时保留原名，并提示失败。Print / JSON 模式不自动调用，避免给批处理及常见子 Agent 额外命名。
- 会话选择器、终端标题和右下角标题通过现有改名事件同步更新。

```text
/auto-name          # 查看状态、命名模型和实际思考强度
/auto-name model    # 从 scoped-models 中选择全局命名模型
/auto-name thinking # 选择独立思考强度，或恢复继承 Pi 逐模型默认值
/auto-name preview  # 仅预览建议标题，不改名；工作结束后使用
/auto-name off      # 暂停当前会话的自动命名，固定现有标题
/auto-name on       # 恢复当前会话自动命名，下轮结束后生效
/name 自定义标题    # Pi 原生命令；改名并保护该名称
```

模型和思考选择保存在 `~/.pi/agent/auto-session-name.json`（跟随 `PI_CODING_AGENT_DIR`），后续命名请求读取最新配置；选择框中取消不保存，更改配置会取消当前未完成的命名请求。不会修改 Pi 的 `settings.json`。

```json
{
  "model": "openai-codex/gpt-5.6-luna",
  "thinking": "inherit"
}
```

`thinking` 可设为 `inherit` 或所选模型支持的 `off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`。使用选择器可避免配置不支持的等级。

全局关闭用 `/personal` 中的「自动会话命名」。关闭不会撤销已有标题。此功能只负责命名，未移植参考插件的闲置归档功能，也不绑定 Codex 专有模型。

### substatusline

在 Pi 状态栏显示当前模型服务商的剩余额度和当前会话 ID。

目前支持：

- `openai-codex`：显示周额度剩余比例。
- `zai-coding-cn`：显示 5 小时和周额度剩余比例。

额度会在会话启动、切换模型、Agent 完成工作以及定时器触发时刷新。

### clickable-paths

把 Pi 消息中的真实本地文件路径转换成终端可点击链接，支持定位到行号和列号。

命令：

```text
/clickable-paths
/clickable-paths on
/clickable-paths off
/clickable-paths editor <vscode|vscode-insiders|cursor|windsurf|file>
/clickable-paths bare <on|off>
```

配置保存在：

```text
~/.pi/agent/clickable-paths.json
```

### user-message-border

给对话区的普通用户消息加一圈细橙色线框（`#D99A52`），保留正文原有底色、文字颜色、Markdown 高亮和可点击链接。不修改会话记录或模型上下文，也不改变 AI 回答、工具输出和输入框。

- 加载后自动生效，历史消息重新渲染时同样带框。
- 使用带 `user` 标题的圆角细线框 `╭─╮│╰─╯`；边框和正文统一使用主题的 `userMessageBg` 背景。正文按可用宽度减两列重新排版，保留原生左右内边距、Markdown 和链接转换，上下边框替换原有空白行，不额外增加高度。宽度不足 8 列时回退原生显示。字符线条仍有字形留隙，不保证像素级贴边。
- 仅在 TUI 模式启用；技能调用的折叠说明块等其他组件不加框。
- pi 暂无普通用户消息的边框接口，因此扩展临时包装 `UserMessageComponent` 的渲染方法，重载或退出时清理。升级 pi 后建议运行测试验证兼容性。

### statusline-style-picker

预览并应用 11 套状态栏配色，保留原有 `/statusline-style` 命令：

```text
/statusline-style
/statusline-style 11
/statusline-style Claude 暖纸
```

该功能是配色选择器，**不包含状态栏本体**，需要另外启用 `npm:@narumitw/pi-statusline`。配置继续写入 `~/.pi/agent/pi-statusline.json`（支持 `PI_AGENT_DIR`），应用后自动重载。

## 从独立扩展迁移

安装本包后，移除以前单独安装的功能路径，避免重复注册。曾直接放在 `~/.pi/agent/extensions/` 下的同名扩展也需移出自动发现目录；需要删除时请放入废纸篓。

旧版包过滤器（如 `-extensions/terminal-title.ts`）不再控制内部功能，请将选择迁移到 `/personal`。更换本地包路径时，先移除旧路径再安装新路径，保留原有功能配置文件。

## 本地开发

安装依赖并检查类型：

```bash
npm install --ignore-scripts
npm run check
```

将当前目录作为全局 Pi Package 安装：

```bash
pi install "$(pwd)"
```

修改扩展后，在正在运行的 Pi 中执行：

```text
/reload
```

查看或调整整个扩展的启用状态（内部功能用 `/personal`）：

```bash
pi list
pi config
```

卸载本地包：

```bash
pi remove "$(pwd)"
```

## 通过 Git 安装

推送到 GitHub 后可以直接安装：

```bash
pi install git:github.com/<用户名>/pi-personal-extensions
```

安装指定版本：

```bash
pi install git:github.com/<用户名>/pi-personal-extensions@v0.1.0
```

## 发布到 npm

1. 删除 `package.json` 中的 `"private": true`。
2. 确认包名可用，必要时改成 npm scope 包名。
3. 更新 `version` 和 `CHANGELOG.md`。
4. 执行 `npm run check`。
5. 执行 `npm publish`。

发布后安装：

```bash
pi install npm:pi-personal-extensions
```

## 项目结构

```text
.
├── extensions/
│   ├── pi-personal-extensions.ts
│   ├── auto-session-name.ts
│   ├── auto-session-name-settings.ts
│   ├── clickable-paths.ts
│   ├── session-title.ts
│   ├── statusline-style-picker.ts
│   ├── substatusline.ts
│   ├── terminal-title.ts
│   └── user-message-border.ts
├── tests/
│   ├── auto-session-name.test.mjs
│   ├── personal.test.mjs
│   ├── session-title.test.mjs
│   ├── statusline-style-picker.test.mjs
│   └── user-message-border.test.mjs
├── CHANGELOG.md
├── README.md
├── package.json
└── tsconfig.json
```
