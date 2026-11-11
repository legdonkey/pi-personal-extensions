# title（使用者版）事实清单

缩写：命名 = `extensions/auto-session-name.ts`；显示 = `extensions/statusline.ts`；入口 = `extensions/pi-personal-extensions.ts`；命名测试 = `tests/auto-session-name.test.mjs`；显示测试 = `tests/session-title.test.mjs`；Pi 文档 = `node_modules/@earendil-works/pi-coding-agent/docs/`。

## 头部 meta

- 入口 `/personal` → 「自动会话命名」；二级菜单：查看状态、选择命名模型、选择命名思考强度、预览建议标题、暂停当前会话命名、恢复当前会话命名 —— 菜单项见 入口:62-68（actions 表），菜单调用内部处理函数 入口:135-139（featureApi.registerCommand 只写入 commands 表，不再调用 pi.registerCommand）

## 会话名在哪里（title-01，图 1）

- 示例会话名「🧩 通知服务｜排查重复推送」 —— 命名:132

## 自动起名（title-02 ～ 03，图 2）

- 每轮正常结束后在后台起名，不用等 —— 命名:272-279, 458-461；命名测试:218-229
- 会话名由类别图标（emoji）、对象和目标组成，中间有空格和全角竖线；八种类别（图） —— 命名:131, 134, 209
- 当前会话名已准确或信息不足时不变（列表） —— 命名:129, 203, 357

## 暂停与恢复（title-04 ～ 05，图 3）

- 手动改会话名（如 `/name`）后这个会话暂停自动起名 —— 命名:261-266；命名测试:290-320
- 「恢复当前会话命名」恢复，下一轮结束后生效；「暂停当前会话命名」暂停 —— 命名:469-479；入口:67-68
- 只影响当前会话；重载后保持（图） —— 命名:233, 242-252；命名测试:308-319
- 打开已有其他会话名的会话时是暂停状态（列表、图） —— 命名:253
- 恢复后会接着改当前的会话名（列表） —— 命名:234-235, 471

## 预览（title-06，图 4）

- 「预览建议标题」弹出建议，不改会话名 —— 命名:347-355, 480-485
- 提示文字「标题预览：…」「保持原标题：…」；保持原标题对应当前会话名已合适或信息不足 —— 命名:129, 349-351
- 等 Pi 回复完再预览；暂停状态下也能预览（列表） —— 命名:270, 481-484
- 预览也消耗额度（列表） —— README.md:65

## 换命名模型（title-07，录屏 auto-name-model）

- 「选择命名模型」只列出 `/scoped-models` 里已认证的模型 —— 命名:390-400；命名:81-86；命名测试:494
- 按 ↑ ↓ 移动、按 Esc 键关闭列表不保存（键帽图、图注） —— 命名:401；录屏画面
- 默认命名模型 `gpt-5.6-luna`；只用来起名，对所有会话生效，不影响主对话（列表） —— 命名:41, 48, 37, 60-76；命名测试:233, 494-525；README.md:63
- 「选择命名思考强度」选命名用的思考强度；默认跟随 Pi 对这个模型的设置，没设置时用 low（列表） —— 命名:419-432；命名:115-121；命名测试:556
- 实际强度受命名模型支持范围限制，不支持思考的模型用 off（列表） —— 命名:124；node_modules/@earendil-works/pi-ai/dist/models.js:693-699
- 换成另一个命名模型后，命名用的思考强度恢复默认值（列表） —— 命名:404-415；命名测试:579-600
- 录屏画面（/personal → 自动会话命名 → 选择命名模型 → ↓↓↑ → Esc）：列表为录制者的 scoped models，当前 openai-codex/gpt-6.1-terra，列表七个模型（示例环境，非默认值） —— docs/extensions-usage/tapes/auto-name-model.tape；命名:396-400（标题格式「命名模型（全局） · 当前：…」）

## 查看状态（title-08，录屏 auto-name-status）

- 「查看状态」输出一条状态提示：开启状态、命名模型、命名用的思考强度，以及指向菜单路径的说明（录屏：/personal → 自动会话命名 → 查看状态） —— 命名:466, 486-494；docs/extensions-usage/media/auto-name-status.png
- 录屏画面：一条状态提示，含开启状态、模型 openai-codex/gpt-6.1-terra、思考「继承 → low」和菜单路径说明（示例环境，非默认值） —— docs/extensions-usage/tapes/auto-name-status.tape；命名:491-494

## 额度和隐私（title-09 ～ 10，图 7）

- 「自动会话命名」把当前会话名和最近最多 5 轮对话文字发给命名模型 —— 命名:285-286, 313-319

- 自动起名和预览额外消耗命名模型额度，不计入 Pi 自带用量统计 —— README.md:65
- 发送当前会话名和最近最多 5 轮对话文字 —— 命名:150-161, 285-286
- 你的消息每轮取前 2000 个字符，助手回复每轮取最后 1500 个字符（图） —— 命名:175, 182；命名测试:175-179
- 不发送工具输出、思考内容和图片 —— 命名:163-172；命名测试:152-172
- 不发送当前分支以外的对话、出错或中断的回复（图） —— 命名:176-179, 271, 280
- 对话里的业务信息会发出去 —— README.md:64
- 非交互方式运行时不起名，也就不发送（图注） —— 命名:269

## 排查（title-11 ～ 14，图 8 编号 1～4）

- 「自动会话命名」默认开启，可在 `/personal` 里开启 —— README.md:28；入口:25-26
- 「查看状态」显示暂停时，选「恢复当前会话命名」 —— 命名:469-479, 492
- 命名模型不可用时的提示指向 `/scoped-models` 和「选择命名模型」 —— 命名:96-99
- 认证用 `/login`，模型范围用 `/scoped-models` —— Pi 文档 slash-commands.md:14-15；node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js:4818, 4838
- `/scoped-models` 里 Enter 切换只影响当前会话，Esc 只关闭，默认 Ctrl+S 才保存 —— node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/components/scoped-models-selector.js:250-256, 295-299, 314-316
- 全选所有模型时 Pi 把范围存为空列表，「自动会话命名」把空列表当作没有可用模型（列表） —— interactive-mode.js:4437, 4471；命名:81-86
- 都正常时选「预览建议标题」试一次 —— 命名:294（失败提示指向该菜单项）
- 其他不起名的情况（图注）：上一轮回复出错或被中断 —— 命名:272-279；命名测试:473
- 30 秒内没有合格结果时保留原会话名并提示一次（连续失败只提示一次） —— 命名:292, 335-341, 366-370；命名测试:396-422, 451
- 非交互方式运行 —— 命名:269

## 合并后的标题显示

- 会话标题由 statusline 的 personal-session-title 状态键提供，不使用 widget、不承诺右对齐；沿用转义/控制字符消毒，空白显示未命名会话；开始、树导航、改名更新，退出清理 —— tests/session-title.test.mjs「合并标题用 setStatus，消毒、改名、树导航与退出同步，第五项独立开关及旧配置优先级」。
- 第五项 sessionTitleEnabled 新项优先，缺失沿用旧 session-title 布尔值，旧关闭仅影响标题，新旧都须合法，读取不写，保存总开关保留旧项 —— tests/session-title.test.mjs；README.md「会话标题合并迁移」。
- 未重录的认证/聊天片段紧邻可见标注历史录屏；无凭据环境不能复现真实模型调用，本轮不伪造 —— 本章历史录屏图注；docs/extensions-usage/tapes/。

- 本轮重录 personal-menu、personal-switches、statusline-style，后者包含第五项标题开关及状态栏标题；其他认证/聊天录屏保留历史画面并在紧邻图注中标明标题位置已变化，不伪造模型调用 —— docs/extensions-usage/tapes/；两版页面可见历史录屏图注。
- 删除原视频审查后重录 auto-name-model、auto-name-status：一级菜单为五项功能加「批量功能开关」，命名模型显示 openai-codex/gpt-6.1-terra，思考显示「继承 → low」；在按 _settings.tape 创建的临时 agent 目录录制，保留凭据文件但不发送模型消息；本章不再有历史录屏图注 —— docs/extensions-usage/tapes/auto-name-model.tape、auto-name-status.tape；docs/extensions-usage/media/auto-name-model.png、auto-name-status.png
