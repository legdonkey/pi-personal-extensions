# pi-personal-extensions

个人维护的 [Pi](https://pi.dev) 扩展合集。Pi 只加载 `extensions/index.ts` 一个入口，通过 `/personal` 选择其中的五项功能。

## 功能开关

输入 `/personal` 打开功能列表：上下选择、空格切换，Enter 保存并自动重载，Esc 放弃修改。`pi config` 只负责整个扩展的启用或禁用。

开关保存在 `~/.pi/agent/personal-extensions.json`（设置 `PI_CODING_AGENT_DIR` 时跟随该目录），默认全部开启。关闭的功能不会注册命令、事件或定时器；保存后的重载会执行旧功能的正常清理。其他已打开的 pi 会话需要各自 `/reload`。

```json
{
  "terminal-title": true,
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

给对话区的普通用户消息加一圈细橙色线框（`#D99A52`），保留原有底色、文字颜色、Markdown 高亮和可点击链接。不修改会话记录或模型上下文，也不改变 AI 回答、工具输出和输入框。

- 加载后自动生效，历史消息重新渲染时同样带框。
- 终端边框由 `┌─┐│└┘` 字符组成，直接画在消息背景最外沿的原有空白上，不额外增加宽度或高度，正文位置和换行保持不变。边缘没有留白（如零 padding）或窗口太窄时回退原生显示，避免覆盖正文。
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
│   ├── index.ts
│   ├── clickable-paths.ts
│   ├── statusline-style-picker.ts
│   ├── substatusline.ts
│   ├── terminal-title.ts
│   └── user-message-border.ts
├── tests/
│   ├── personal.test.mjs
│   ├── statusline-style-picker.test.mjs
│   └── user-message-border.test.mjs
├── CHANGELOG.md
├── README.md
├── package.json
└── tsconfig.json
```
