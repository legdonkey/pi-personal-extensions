# message 章节事实清单

路径省略前缀 `extensions/`、`tests/`。`pi-tui/…`、`pi-coding-agent/…` 指 `node_modules/@earendil-works/` 下的包，只用来解释 Pi 本体行为。

## 总图（渲染链路）

- Pi 默认把文件路径显示成普通文字；改写成 Markdown 链接后才可点击 —— clickable-paths.ts:4-7

- 功能 label：「文件路径可点击」（clickable-paths）、「用户消息橙色线框」（user-message-border） —— pi-personal-extensions.ts:37-38, 43-44
- 路径改写在 Markdown 渲染前进行，只影响显示，会话记录和发给模型的内容不变 —— clickable-paths.ts:9-10, 242
- 用户消息、助手消息、思考块都把 transformer 传给 Markdown 组件 —— pi-coding-agent/dist/modes/interactive/components/user-message.js:37；assistant-message.js:86, 118；pi-coding-agent/dist/core/extensions/types.d.ts:1124
- 用户消息默认参与改写（`userMessages` 默认 true） —— clickable-paths.ts:37, 247
- 线框包装用户消息组件的 render，作用在渲染输出上 —— user-message-border.ts:16-17, 20-23, 43

## 文件路径可点击

- 识别两类候选：反引号行内代码、裸路径 —— clickable-paths.ts:160, 166-167, 193-196
- 裸路径必须带扩展名 —— clickable-paths.ts:162-167
- `bare off` 关闭裸路径识别（任何不是 off 的值都算开启） —— clickable-paths.ts:184, 200, 277-281
- 文件真实存在（`statSync().isFile()`）才变链接 —— clickable-paths.ts:95-97, 107-122, 142-143
- 存在性缓存：结果有效期 5 秒（不定时删除）；最多 4000 条，达到上限后，下次写入前清空整个缓存 —— clickable-paths.ts:86-88, 90-103
- 有效期内删掉的文件，链接可能暂时还在 —— clickable-paths.ts:92-93（命中缓存直接返回旧结果）
- 拆出末尾 `:行:列` —— clickable-paths.ts:125-131, 141
- 相对路径按会话工作目录解析；`~/` 展开到主目录；绝对路径原样使用 —— clickable-paths.ts:115-120, 238-240
- 按编辑器拼 URL：`<editor>://file<路径>:行:列`；默认 vscode —— clickable-paths.ts:35, 72-77
- 路径按 `/` 分段做 encodeURIComponent —— clickable-paths.ts:65-66
- file 选项生成 `file://<路径>`，交给系统默认程序打开，不带行号 —— clickable-paths.ts:59-62, 68-70
- 改写成 Markdown 链接，行内代码的链接文本保留反引号 —— clickable-paths.ts:143, 193-196
- 终端支持超链接时 Pi 输出 OSC 8，屏幕只显示链接文字；不支持时显示链接文字和括号里的 URL —— pi-tui/dist/components/markdown.js:539-558；clickable-paths.ts:4-7
- 屏幕上行内代码不显示反引号，渲染成行内代码样式（图中第 5 步去掉反引号） —— pi-tui/dist/components/markdown.js:536-545
- 带行号的路径找不到文件时，把整串当文件名再试一次，链接不带行号 —— clickable-paths.ts:134-148
- 候选整体含 `://` 时不解析（图中示例是行内代码 `https://example.com/app.ts`）；裸路径扫描仍可能改写 URL 中的文件名片段 —— clickable-paths.ts:113, 167-172
- 只有 `FENCE_RE` 匹配的反引号/波浪线围栏内不改写；四空格缩进代码块不匹配，照常改写 —— clickable-paths.ts:204-224（Codex 内存复现）
- 行内链接和图片只在 `SEGMENT_RE` 匹配到 `[...](...)` 时原样保留；引用式链接 `[README.md][ref]` 的方括号文本仍可能被裸路径正则改写 —— clickable-paths.ts:160, 166-167, 187-191
- 流式输出中的消息不改写，等最终渲染再处理；思考块不改写 —— clickable-paths.ts:244-246
- `userMessages` 为 false 时不处理用户消息 —— clickable-paths.ts:247
- 设置四项与默认值：enabled true、editor vscode、bareText true、userMessages true —— clickable-paths.ts:22-38
- 前三项在 `/personal` → 文件路径可点击 的二级菜单里改（菜单项调用内部 clickable-paths 处理函数的 on/off/editor/bare），`userMessages` 只能改配置文件 —— pi-personal-extensions.ts:75-84, 174-175；clickable-paths.ts:252-299
- 二级菜单项：查看路径链接设置、开启 / 暂停路径链接（提示「下一条消息生效」）、打开方式 ×5、识别 / 不识别裸路径 —— pi-personal-extensions.ts:75-84；clickable-paths.ts:262
- clickable-paths 的处理函数只登记进 `/personal` 的命令表，不注册成斜杠命令 —— pi-personal-extensions.ts:133-137；clickable-paths.ts:252
- 编辑器选项：vscode / vscode-insiders / cursor / windsurf / file —— clickable-paths.ts:20, 232
- 设置入口只有 `/personal` → 文件路径可点击；用户消息橙色线框在 actions 表里没有设置项，只有启用 / 禁用 —— pi-personal-extensions.ts:36-47, 61-91, 165-166
- 配置文件在 agent 目录下：`path.join(getAgentDir(), "clickable-paths.json")`，默认 `~/.pi/agent/`，跟随 `PI_CODING_AGENT_DIR` —— clickable-paths.ts:16, 235；pi-coding-agent/dist/config.js:453-458；README.md:94-106
- 演示：presets 和工作目录、主目录均为示例；演示假定文件存在，不模拟冒号文件名回退；绝对路径原样保留 `..`，`~/` 和相对路径规范化 —— clickable-paths.ts:117, 120（path.join / path.resolve 规范化，绝对路径不处理）

## 用户消息橙色线框

- 只在 TUI 模式包装 —— user-message-border.ts:13；user-message-border.test.mjs:37-40
- `session_start` 重复触发不叠加包装 —— user-message-border.ts:13；user-message-border.test.mjs:41-44
- 颜色 rgb(217,154,82)；边框字符背景用主题 `userMessageBg` —— user-message-border.ts:7, 33-34
- Pi 暂无普通用户消息的边框钩子，这是临时方案（源码注释原话） —— user-message-border.ts:15
- 替换 `UserMessageComponent.prototype.render`，对所有实例生效 —— user-message-border.ts:16-17, 43；user-message-border.test.mjs:97-105
- 关闭时 render 仍是本层就改回原始方法 —— user-message-border.ts:44-48, 51-54；user-message-border.test.mjs:98-99
- 别的 Pi 扩展后来又包装一层时不覆盖；线框这一层 active=false 后直接转发原始 render —— user-message-border.ts:21, 45-47；user-message-border.test.mjs:106-113
- 第一步：按 `width - 2` 调用原始渲染 —— user-message-border.ts:23
- 第二步：首末空白行换成上下边框，上边框含 `user` —— user-message-border.ts:22, 24, 35-37, 39
- 第三步：中间各行两侧加 `│`；每行可见宽度等于 width —— user-message-border.ts:38；user-message-border.test.mjs:84
- 边框占用原空白行，行数等于 `render(width - 2)` 的行数，不额外加行 —— user-message-border.test.mjs:59-65
- 正文少了两列，长行可能多折一行（20 列下 17 个 a 从 3 行变 4 行） —— user-message-border.ts:23（Codex 用真实组件验证）
- 正文行原样保留：ANSI、链接、内边距 —— user-message-border.test.mjs:76-82
- 退回条件：width < 8；行数 < 2；首末行缺少 width−2 个连续普通空格；任一行可见宽度 ≠ width−2 —— user-message-border.ts:21, 24-31；user-message-border.test.mjs:89-94
- 退回时按完整宽度调用原始渲染，不画边框；功能仍是「已加载」状态（回退只发生在 render 内，不卸载功能） —— user-message-border.ts:21, 31
- 升级 Pi 后应验证兼容性；`npm run check` 检查类型并执行全部测试 —— README.md:122
