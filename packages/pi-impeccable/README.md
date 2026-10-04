# pi-impeccable

把 [Impeccable](https://github.com/pbakaus/impeccable) 的设计工作流接入 Pi。
本包面向用 Pi 开发界面的用户，提供完整上游技能、24 个设计命令和检测引擎。
Pi 原生扩展负责命令、自动检查和 Live 工具调用。

## 安装与使用

需要 Pi 1.0.2 或更新版本，以及 Node.js 22.19 或更新版本。
在仓库根目录执行：

```bash
npm ci --prefix packages/pi-impeccable --ignore-scripts --legacy-peer-deps --registry=https://registry.npmmirror.com
pi install "$(pwd)/packages/pi-impeccable"
```

依赖源为 npmmirror 中国大陆镜像。运行时只使用 Node.js 标准库。
引擎首次使用时从上游 GitHub Release 下载，随后使用本地缓存。
每次执行前验证 `engine.json` 中固定的 SHA-256。
GitHub Release 用于取得与技能匹配的正式引擎。

在 Pi 中执行 `/reload`，然后运行：

```text
/impeccable init
/impeccable audit 首页
/impeccable polish 设置页面
/impeccable live
```

本包独立安装，不加入当前仓库的 `/personal` 开关。
卸载时执行 `pi remove <本包绝对路径>`。

### 已安装旧版技能时

同名 `impeccable` 技能会发生发现冲突。必须只启用一份。
可以用 `pi config` 关闭旧包的技能资源，保留本包。
手工安装的旧技能应当移出自动发现目录，然后执行 `/reload`。
`/impeccable` 命令始终加载本包技能，不依赖同名技能的发现顺序。

## 完整能力

| 能力 | 提供方式 |
|---|---|
| 设计指令与 24 个动作 | 保留上游完整技能、参考文件和运行资源 |
| 产品与视觉上下文 | `PRODUCT.md`、`DESIGN.md`、设计侧车文件和界面简报 |
| 机械检测 | 上游完整规则；源码、静态 HTML 和浏览器渲染检测 |
| 自动检查 | Pi 成功编辑后即时检查，结束前完整规则检查 |
| 配置与忽略规则 | 上游 `hooks`、`ignores` 和 `doctor` |
| Live 迭代 | 元素选择、变体、插入、接受、丢弃、手动编辑和恢复 |
| 指定元素生成变体 | 上游 `live-generate`，对应 `/impeccable generate` |
| 视觉构建辅助 | 配色、字体、设计决策页面、素材溯源和构图校验 |
| 多角色流程 | 保留素材制作、交付评审、系统记录和编辑落盘角色 |
| 快捷命令 | Pi 原生命令注册，项目级持久化，不覆盖其他命令 |

浏览器检测需要本机有上游引擎支持的 Chromium 浏览器。
Live 需要本地项目和开发服务器，也支持本地静态 HTML。
浏览器页面操作优先使用 `ego-browser`。
生产站点可以检测；Live 只用于本地源码。

设计任务由当前 Pi 模型执行，会使用模型额度。
机械检测本身不调用模型。结束前发现问题时，最多追加一轮模型工作。
图像生成需要用户明确请求，费用和参考图上传遵循当前宿主规则。
子代理流程需要当前会话明确授权，并有可执行的代理工具。
未获授权时保留上游的线程内角色流程，并披露评审方式。

## 24 个设计命令

统一入口为 `/impeccable <命令> <目标>`。
也可以直接描述设计任务，例如 `/impeccable 重做首页首屏`。
不带参数时，技能根据项目状态提供菜单。
`help` 直接显示命令列表，不调用模型。

| 命令 | 作用 |
|---|---|
| `craft` | 新设计任务的兼容入口 |
| `init` | 采集产品背景并写入 PRODUCT.md |
| `document` | 从现有代码记录 DESIGN.md |
| `extract` | 提取复用组件与设计令牌 |
| `shape` | 规划 UX/UI |
| `critique` | 评审体验与视觉层级 |
| `audit` | 检查无障碍、响应式和性能 |
| `polish` | 发布前精修 |
| `bolder` | 增强视觉表达 |
| `quieter` | 收敛过强表达 |
| `distill` | 精简界面 |
| `harden` | 补齐错误、国际化和边界状态 |
| `onboard` | 设计引导与空状态 |
| `animate` | 添加有目的的动效 |
| `colorize` | 改善配色 |
| `typeset` | 改善字体与排版 |
| `layout` | 调整布局与间距 |
| `delight` | 添加体验细节 |
| `overdrive` | 实现高表现力效果 |
| `clarify` | 改善界面文案 |
| `adapt` | 适配设备 |
| `optimize` | 优化性能 |
| `live` | 在浏览器中迭代视觉变体 |
| `generate` | 生成指定元素的视觉变体 |

`teach` 是 `init` 的兼容别名。
其他管理入口为 `hooks`、`doctor`、`pin` 和 `unpin`。

```text
/impeccable hooks status
/impeccable hooks off
/impeccable hooks on
/impeccable doctor
/impeccable pin audit
/audit 表单
/impeccable unpin audit
```

快捷命令保存在项目 `.pi/impeccable-pins.json`。
创建和移除后自动重载。已有命令占用同名入口时，本包拒绝覆盖。

## 自动检查与工具调用

成功的 `edit`、`write` 和 `apply_patch` 会触发检查。
通过 `codemode` 执行的嵌套编辑也会触发。
结果作为独立上下文消息进入后续模型请求，保留原工具结果。

即时检查只报告机械问题；结束前检查补充其余规则。
上游引擎负责配置、生成文件过滤、关联样式扫描和去重。
失败或取消的编辑不触发检查。检查失败会明确报告。
普通 shell 写入无法由直接编辑事件识别，完成后必须手动检测。

`impeccable` 工具接受 `argv` 数组，不经过 shell：

```json
{"argv": ["detect", "--json", "src"]}
```

工具覆盖全部上游引擎命令，包括 `context`、`palette` 和 `live-*`。
使用 Live 返回的应用根目录时，传入 `cwd`。
`detect` 的退出码 `2` 表示发现问题，`1` 表示操作失败。
超时和取消会停止本次引擎进程。Live helper 按上游清理流程单独停止。

没有扩展工具时，可以使用启动脚本：

```bash
node /绝对路径/pi-impeccable/skills/impeccable/scripts/run.mjs detect --json src
```

`hooks` 使用共享 `.impeccable/config.json` 与开发者本地配置。
其管理命令沿用上游语义，会影响同项目的其他 Impeccable 安装。
`hooks reset` 会删除共享配置与缓存，执行前必须确认范围。

## 离线引擎与平台

支持 macOS arm64/x64、Linux arm64/x64 和 Windows x64。
macOS arm64 已实机验证。其余平台的安装与进程清理尚未实机验证。
缓存位于 `~/.impeccable/pi/0.1.11/`，跟随 `IMPECCABLE_HOME`。
可以提前下载 `engine.json` 指定的对应文件，验证校验值后放入缓存。
缓存校验失败时，本包拒绝执行，不自动覆盖该文件。

`IMPECCABLE_BIN` 可以指定用户信任的自备引擎。
这个显式覆盖跳过内置校验，仅用于用户已核实的二进制。
本包不从 PATH 选择未知版本，也不使用 npm 平台包中的同版本二进制。

## 上游版本与许可

技能快照为 `4.5.0`，正式引擎为 `0.1.11`。
上游提交为 `ac2ee4231132f39dbc916e527c3fd0ec5b38c6b5`。
`upstream.json` 记录 57 个原始文件的哈希。
`engine.json` 记录五个平台的正式引擎校验值。

上游英文指导保留原文，Pi 命令和宿主说明使用中文。
适配文件带有修改声明。保留上游 Apache-2.0 许可与第三方说明。

## 本地开发与验证

```bash
npm run check --prefix packages/pi-impeccable
npm pack ./packages/pi-impeccable --dry-run
```

测试覆盖资源完整性、命令与快捷入口、事件续调、配置和真实引擎。
Live 集成测试覆盖启动、认证、事件收发、回复、取消和清理。
设计产出的视觉质量仍需要按技能流程，在实际项目中验收。

更新上游时，先核对源码提交、正式引擎和平台校验值。
修改同步脚本中的提交，再更新 `engine.json`。
从已核对的上游 checkout 同步：

```bash
node packages/pi-impeccable/scripts/sync-upstream.mjs /绝对路径/impeccable
npm run check --prefix packages/pi-impeccable
```

同步保留 Pi 启动器和 `reference/pi.md`。
新增、删除和修改的上游资源必须一并核对，不能只更新命令列表。
