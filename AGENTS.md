# AGENTS.md

本文件写给在本仓库工作的编码 agent（Pi、Codex 等）。功能说明见 `README.md`，变更记录见 `CHANGELOG.md`。事实以 `extensions/` 源码为准。

## 项目是什么

`pi-personal-extensions` 是个人维护的 Pi 扩展包，包含六项功能。

- `package.json` 的 `pi.extensions` 只声明一个入口：`extensions/pi-personal-extensions.ts`。
- 一个功能一个文件：`session-title`、`auto-session-name`、`statusline`、`clickable-paths`、`user-message-border`、`inline-effort`。
- 入口只向 Pi 注册 `/personal` 一个斜杠命令。
- 入口把 `featureApi` 传给各功能。`featureApi` 截获各功能的 `registerCommand`，把处理器存进内部 `commands` 表。`/personal` 菜单通过 `actions` 表调用这些处理器。
- 关闭的功能不调用 `register`，所以不注册命令和事件。
- 有 UI 的客户端（TUI、带 UI 的 RPC）都能用 `/personal`。没有 UI 时只提示并返回。批量开关（`/personal switches`）只支持 TUI。

## 目录结构

- `extensions/`：入口和六个功能文件。
- `tests/`：`node:test` 测试，一个功能一个 `*.test.mjs`；`personal.test.mjs` 测入口。
- `docs/extensions-guide/`：技术版讲解页。`build.mjs` 和共享外壳也在这里。
- `docs/extensions-usage/`：使用者版讲解页。
- 两份指南各有 `src/`（章节片段、`*.facts.md`）、`media/`（录屏 mp4 与 poster png）、`audio/`、`index.html`（构建产物）。
- 录屏脚本只在 `docs/extensions-usage/tapes/`。技术版 `media/` 里的录屏是从使用者版复制的同名文件。
- `PRODUCT.md`、`DESIGN.md`：讲解页的读者定位和视觉规范。

## 常用命令

1. 安装依赖：`npm install --ignore-scripts --registry=https://registry.npmmirror.com`（镜像用 npmmirror）。
2. 检查：`npm run check`。它先跑 `tsc --noEmit`，再跑全部测试。交付前必须通过。
3. 只跑测试：`npm test`。
4. 在 Pi 中执行 `/reload` 加载改动。

## 改代码的约定

- 新功能或新设置项加到 `/personal` 菜单（入口文件的 `actions` 表）。不要新增斜杠命令。
- 用户可见的提示写菜单路径，例如 `/personal → 自动会话命名 → 选择命名模型`。不要写内部命令名。
- 配置文件路径用 `getAgentDir()`。它跟随 `PI_CODING_AGENT_DIR`。不要写死 `~/.pi/agent`。
- 改功能 ID 或配置文件名时，保留旧键、旧文件的读取兼容。现有规则：
  - 旧开关 `substatusline`、`statusline-style-picker` 合并为 `statusline`；`jev-inline-effort` 映射为 `inline-effort`。新键优先，旧键仍校验为布尔值。
  - `inline-effort.json` 缺失时读 `jev-inline-effort.json`。保存只写新文件，不删旧文件。
  - 读取配置时不改写文件。
- 会话里已持久化的条目类型和状态键不要改名，否则旧会话无法恢复。当前值：思考决策条目和状态栏键 `jev-inline-effort`、自动命名状态 `personal-auto-session-name`、状态栏键 `usage` 和 `session-id`。
- 测试不得写入真实 `~/.pi`。用 `mkdtempSync` 建临时目录，设 `PI_CODING_AGENT_DIR` 指向它，测试结束后恢复环境变量并删除目录。写法见 `tests/personal.test.mjs`。
- 改动用户可见行为时，同步 `README.md`、`CHANGELOG.md` 的「未发布」一节和两份讲解页（见下节）。
- `user-message-border` 依赖 Pi 组件的渲染方法。升级 Pi 后要验证它。

## 讲解页

两份指南共用 `docs/extensions-guide/build.mjs` 和 `docs/extensions-guide/src/` 里的外壳（`_shell.html`、`guide.css`、`guide.js`）。各指南自己的内容在各自 `src/`：`NN-*.html` 章节片段、`_hero.html`、`*.facts.md`。

构建命令：

- 技术版：`node docs/extensions-guide/build.mjs`
- 使用者版：`node docs/extensions-guide/build.mjs docs/extensions-usage`

`--no-tts` 只用于排版预览。它用估算时长生成时间轴，并覆盖 `index.html`。交付前必须不带 `--no-tts` 重新构建。

- TTS 用百炼，音色 `wenhuaizhi_v3.1`（闻怀之），脚本路径写在 `build.mjs` 里。
- 语音缓存在 `docs/extensions-guide/.cache/`，两份指南共用，按「音色 + 指令 + 文本」的哈希命名。文本不变就不重新合成。
- 章节引用的录屏 `media/<id>.mp4`、`.png` 缺失时构建失败。

源码行为变化时：

1. 更新两份指南里受影响的章节文案。
2. 更新对应 `*.facts.md`。每条事实都写出处（`文件:行号` 或测试位置），行号随源码变化同步修正。
3. 画面受影响时重录对应录屏（见下节）。

章节文案规则（`build.mjs` 会校验大部分）：

- 每个朗读段是 `<span class="seg" data-seg="<章节 slug>-NN">`。ID 以本章 slug 开头，全局不重复。`.seg` 内部不能嵌套 `<span>`。
- 页面显示的文字和朗读内容一致。`data-say` 只用来处理读音（例如把 `/personal` 读成「斜杠 personal」），不用来增删内容。
- 每章的 `h2` 由构建脚本自动朗读，不必另写过渡句。
- `data-cue` 只能指向本章已出现的 seg。HTML `id` 不能重复。
- 示意数据要标注为示例。

## 录屏

所有录屏脚本都在 `docs/extensions-usage/tapes/`，用 vhs 录制，在仓库根目录执行。

- 公共设置和后期参数（裁切、起止时间、poster 时间点）写在 `_settings.tape` 的注释里。例外：`chat-turn` 的剪辑命令写在 `chat-turn.tape` 开头的注释里。
- 成片输出到 `docs/extensions-usage/media/`。技术版用到的录屏（`personal-menu`、`personal-switches`、`statusline-style`、`auto-name-status`、`effort-status`、`chat-turn`）再原样复制到 `docs/extensions-guide/media/`，文件名不变。重录后两边都要更新。

- 必须在临时 sandbox 里运行 Pi：`_settings.tape` 用 `PI_CODING_AGENT_DIR` 指向 sandbox。不改真实 `~/.pi/agent`。
- 重录前按 `_settings.tape` 注释重建 sandbox（rsync 真实 agent 目录并排除会话、install 等目录）。
- 从 sandbox 的 `settings.json` 移除会写死真实 agent 目录的第三方包，例如 `npm:pi-alibaba-models`。
- 不读取、不打印 sandbox 里的 `auth.json` 等凭据。
- 直接调用 `install/releases/<current-version>` 里的 `pi` 二进制，不经过 `~/.local/bin/pi` 启动器。原因：启动器导出 `PI_MANAGED_INSTALL_ROOT`，每次启动都会改动真实 `~/.pi/agent/install`。
- 录完删除整个 sandbox。

## 提交规范

- 提交信息用简体中文，一句话写清改了什么，风格见 `git log`。
- 不要提交 `.gitignore` 列出的生成物：`node_modules/`、`.pi/`、`.oil-diff/`、`docs/*/.cache/`、`.capture-sandbox/`、`.impeccable/hook.cache.json`、`.impeccable/config.local.json`、`*.tgz`、`*.log`。
