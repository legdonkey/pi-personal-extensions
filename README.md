# pi-personal-extensions

个人维护的 [Pi](https://pi.dev) 扩展合集。扩展以一个 Pi Package 统一安装、管理和发布，同时保持彼此独立，可以在 `pi config` 中分别启用或禁用。

## 包含的扩展

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

### thinking-zh

将实时可见的 assistant `thinking` 内容在后台忠实中文化，并显示在编辑器上方的独立 Widget 中。译文不会修改原始消息、思考签名、会话记录或后续模型上下文；非 TUI 模式不会发起翻译请求。

首次使用时显式选择翻译模型并开启：

```text
/thinking-zh model <provider/id>
/thinking-zh on
```

其他命令：

```text
/thinking-zh status
/thinking-zh show
/thinking-zh clear
/thinking-zh off
```

全局配置保存在 `~/.pi/agent/thinking-zh.json`。插件不会读取旧的 `thinking-translator.json`，也不会在未配置时回退到当前主 Agent 模型。

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

查看或调整扩展启用状态：

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
│   ├── clickable-paths.ts
│   └── substatusline.ts
├── CHANGELOG.md
├── README.md
├── package.json
└── tsconfig.json
```
