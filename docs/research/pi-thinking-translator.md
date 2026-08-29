# `pi-thinking-translator` 源码实现审查

> 审查时间：2026-08-30。结论以 npm `0.1.9` tarball 的实际文件为准，并与 GitHub `main`/`v0.1.8` 对照；不是仅依据 README。
>
> **引用约定**：下文“npm 源码 Lx-Ly”指 npm tarball 内 `package/extensions/thinking-translator.ts` 的行号，稳定原文为 [`unpkg@0.1.9`](https://unpkg.com/pi-thinking-translator@0.1.9/extensions/thinking-translator.ts)；“npm metadata”指固定版本的 [`package.json`](https://unpkg.com/pi-thinking-translator@0.1.9/package.json) 和 [registry version document](https://registry.npmjs.org/pi-thinking-translator/0.1.9)。可公开定位的 GitHub 基线是提交 [`df8ef85`](https://github.com/wplct/pi-thinking-translator/commit/df8ef85a584500c9e0e57c7fba88fcd9fcf8be82)。

## 一、结论摘要

这个包的核心思路是：在 `message_update` 中识别 `thinking_*`/`text_end` 流事件，把翻译任务以 `void` 方式放到后台；翻译模型的增量输出仅写入进程内数组，通过编辑器上方的临时 widget 展示，并用 `tui.requestRender()` 主动重绘。它**不返回改写后的消息，也不调用会话写入 API**，因此译文不会进入原 assistant message、session 或后续主模型 context。

设计方向适合“把可见思考摘要异步翻译成中文”，但现版不是可直接照搬的生产实现：没有并发上限、请求级取消控制、超时、重试或缓存；`reasoning`/`reasoning_summary` 虽被配置层宣称支持，实际事件流不处理；npm `0.1.9` 没有对应 Git tag/commit；而且宽泛 peer 依赖已使源码在当前 `@earendil-works/pi-ai@0.84.4` 下因 `stream` 导出消失而无法加载/类型检查。

## 二、核心事件流与启动时机

### 1. 它监听哪些 Pi 事件

扩展只注册四个 Pi 事件（另注册一个 `/thinking-translator` 命令）：

| Pi 事件 | 实际行为 |
| --- | --- |
| `session_start` | 清空旧 widget、段落状态、计时器并递增展示 epoch。 |
| `agent_start` | 每轮主 agent 开始时做同样清理，使旧任务的后续输出在逻辑上失效。 |
| `message_update` | 读取 `event.assistantMessageEvent`，后台分析并翻译。 |
| `session_shutdown` | reload/退出/切会话前清理临时 UI 状态。 |

证据：npm 源码 L75-L108；GitHub 基线 [`extensions/thinking-translator.ts#L75-L108`](https://github.com/wplct/pi-thinking-translator/blob/df8ef85a584500c9e0e57c7fba88fcd9fcf8be82/extensions/thinking-translator.ts#L75-L108)。它**没有**监听 `message_start`、`message_end`、`agent_end`、`context`、`session_before_compact` 等事件。

`message_update` 内部识别的 assistant 流事件只有：

- `start`：增加 assistant message 序号并清空 thinking block 状态；
- `done` / `error`：清空 thinking block 状态；
- `thinking_start`、`thinking_delta`、`thinking_end`；
- `text_end`（仅配置含 `text` 时）。

证据：npm 源码 L369-L395；GitHub 基线 [`#L366-L392`](https://github.com/wplct/pi-thinking-translator/blob/df8ef85a584500c9e0e57c7fba88fcd9fcf8be82/extensions/thinking-translator.ts#L366-L392)。

**重要不一致**：配置类型和 README 列出 `reasoning`、`reasoning_summary`（npm 源码 L11、L323-L327；[`README@0.1.9` 配置表](https://unpkg.com/pi-thinking-translator@0.1.9/README.md)），辅助函数 `getTranslatableBlockSource()` 也能读这两类 block（L750-L757），但该函数没有进入真实事件链，`collectStreamTranslationSources()` 也没有任何 `reasoning_*` 分支。因此当前运行时实际上只会翻译 `thinking`，以及显式开启的 `text`。

### 2. 何时启动翻译，是否阻塞主 agent

#### `thinking`

每个 thinking block 以 `assistant message serial + contentIndex` 为键独立累积 delta（npm 源码 L400-L453）。文本先按空行拆成段落；长度不超过 40 个 Unicode 字符的单行段落会被当作“短标题”，并和下一正文段合并（L696-L745）。流尚未结束时，最后一段被视为未完成；出现下一段后，刚闭合的前一段立即开始翻译。到 `thinking_end` 时，所有尚未翻译的段落一起提交（npm `0.1.9` L418-L430）。

普通中间段只有在拉丁字母数 `>= minLatinChars` 且多于 CJK 字符时才翻译；但 `thinking_end` 产生的 source 带 `final: true`，会绕过该过滤，所以最终剩余段即便短、中文居多或像代码也会送翻译（L352-L356、L763-L766）。

#### `text`

只在 `text_end` 收到完整 `event.content` 后翻译，并仍受 `minLatinChars` 过滤；默认未启用 `text`（L50-L55、L389-L393）。

#### 不阻塞主 agent

`message_update` handler 是同步函数，调用 `void translateStreamEventBlock(...)` 后立刻返回，没有 `await`，也没有把 Promise 返回给 Pi（L99-L102）。翻译内部的 `Promise.allSettled()` 只等待同一次后台调用产生的 sources，不会让主 agent 等待（L342-L364）。不同 `message_update` 触发的任务还能彼此重叠。因此它是**旁路、fire-and-forget**，不会阻塞主 agent 的 token 流、工具调用或结束。

## 三、译文展示、数据隔离与 UI 刷新

### 3. 如何展示；是否修改 thinking/message/session/context

- 每个请求先往模块级 `translationEntries` 数组加入一个空占位，翻译模型每个 `text_delta` 追加到该 entry（npm 源码 L467-L497）。
- 第一次增量到达时，用 `ctx.ui.setWidget("thinking-translator.translation", componentFactory, { placement: "aboveEditor" })` 注册编辑器上方 widget（L546-L585）。
- widget 每次 render 都从内存数组现算：过滤过期项、用 Pi Markdown 主题渲染、只显示最后 20 行正文，并加“思考翻译”标题；最后 5 秒逐级变暗（L657-L691）。这不是消息旁的逐段内联译文，也没有真正的可交互滚动，只是保留末尾 20 行。
- npm `0.1.9` 在翻译完成后清理代码围栏、`<thinking>`/`<text>` 包裹等，再把该 entry 的过期时间重设为完成后 30 秒（L499-L514、L791-L801）。

隔离性方面，源码只读取流事件并维护自己的内存；没有调用 `pi.sendMessage()`、`pi.appendEntry()`，没有 `message_end` 返回值，没有注册 `context` handler，也没有修改 `event.message`/`assistantMessageEvent`。清理时只调用 `setWidget(..., undefined)` 和 `setStatus(..., undefined)`（L629-L650）。因此：

- 原始 `thinking`/`text` block 不变；
- assistant message 不变；
- 译文不写 session JSONL；
- 不进入后续主模型 context 或 compaction 输入；
- 不改变**主 agent 请求**的 provider cache key。

但应准确理解 README 的“无缓存影响”：插件会发起一条完全独立的翻译模型请求；它没有设置或禁止翻译后端自身的 provider cache。译文隔离成立，不等于“没有额外模型请求、费用或后端留存”。

### 4. 如何触发 UI 刷新

刷新机制分两层：

1. `ensureWidget()` 首次用 component factory 注册 widget，并从 factory 回调拿到 `tuiRef`、`themeRef`；组件 `render(width)` 直接读取模块级 `translationEntries`（L574-L585）。
2. 每个翻译 `text_delta` 修改 entry 后调用 `refreshWidget()`；它检查 epoch/sequence，确保 widget 已注册，然后显式调用 `tuiRef?.requestRender?.()`（L491-L496、L546-L553）。条目到期清理后也调用 `requestRender()`（L590-L599）。

完成时 `finalizeWidget()` 安排过期清理，并设置 30 秒总隐藏 timer；timer 到期通过 `setWidget(key, undefined)` 移除 widget（L558-L568、L645-L650）。这符合 Pi TUI 的“状态变化后调用 `tui.requestRender()`”组件模式。

一个边缘问题是：失败 catch 或清洗后空结果只从数组删除 entry，却**没有立即 `requestRender()`**（L500-L514）。如果屏幕已显示过部分译文，失败后可能暂时保留旧画面，直到其他 TUI 事件触发重绘。

## 四、并发、取消、缓存、超时与失败回退

### 5. 机制现状

| 方面 | 实际实现 | 评价/限制 |
| --- | --- | --- |
| 并发 | 同一事件中的多个新段落用 `Promise.allSettled()` 并行；不同 `message_update` 又是各自 detached Promise。 | **无并发上限、队列或背压**。快速产生多段时会并发请求翻译模型。证据：L99-L102、L342-L364。 |
| 顺序保护 | 请求有递增 sequence；较旧 sequence 在较新输出已经展示后不能再主动 refresh/finalize。 | 防止“旧请求晚回”主动覆盖新 UI，但 entry 仍会继续写；并非真正串行，存在计时器/重绘竞态。证据：L58-L64、L455-L461、L546-L568。 |
| 跨轮失效 | `session_start`/`agent_start`/`session_shutdown`/`clear` 递增 epoch、清数组和 timer；旧流看到 epoch 不同就停止消费展示。 | 这是**逻辑取消**；没有持有请求的 `AbortController` 并主动 abort。证据：L89-L107、L491-L499、L629-L640。 |
| 用户取消 | 模型 `stream()` 接收 `signal: ctx.signal`。 | Esc/agent abort 能否终止底层请求取决于 Pi signal 和 provider 是否合作；`ctx.signal` 可能为空，且 clear/新轮次本身不 abort 请求。证据：L485-L489。 |
| 缓存/去重 | 没有任何 source hash、结果 cache 或 in-flight 去重。 | 相同段落会重复请求；配置文件还会在每个 `message_update` 同步读取。证据：L149-L177、L342-L350。 |
| 超时 | 没有 timeout、`AbortSignal.timeout()` 或 deadline。 | 翻译可无限挂起；只受外部 `ctx.signal`/provider 行为影响。 |
| 重试 | 无。 | 限流、网络抖动、格式问题直接失败。 |
| 失败回退 | 鉴权/stream 异常移除占位并 warning；同一错误字符串只提示一次。模型缺失/registry 缺失也只警告后跳过。原始 assistant 输出始终保留。 | 基本“fail open”正确，但不会显示原文副本或重试；失败删除后缺一次主动重绘。证据：L217-L265、L342-L364、L510-L514、L772-L785。 |

还存在一个具体并发竞态：若较新 sequence 已输出后失败，较旧请求随后完成会因 sequence gate 跳过 `finalizeWidget()`；此时可能没有任务重新安排清理/隐藏 timer。动态 render 最终会过滤过期 entry，但缺少定时 `requestRender()` 时，屏幕可能延迟清除（L546-L568、L590-L599）。

npm `0.1.9` 相比 GitHub `v0.1.8` 修了三处并发/显示问题：一次 delta 补齐多段时不再只取最后一段；空输出按 entry 身份删除而不是误 `pop()` 其他并发项；完成后重新计算 30 秒可见期。npm 源码 L425-L430、L499-L509；GitHub 基线相应位置见 [`#L422-L429`](https://github.com/wplct/pi-thinking-translator/blob/df8ef85a584500c9e0e57c7fba88fcd9fcf8be82/extensions/thinking-translator.ts#L422-L429) 与 [`#L494-L509`](https://github.com/wplct/pi-thinking-translator/blob/df8ef85a584500c9e0e57c7fba88fcd9fcf8be82/extensions/thinking-translator.ts#L494-L509)。

## 五、配置与模型调用

### 6. 配置

内置默认值是：`enabled: true`、目标语言 `Simplified Chinese`、仅 `thinking`、`minLatinChars: 250`，不预选模型（npm 源码 L42-L55）。配置按以下顺序覆盖：

1. 内置默认值；
2. `~/.pi/agent/thinking-translator.json`；
3. `<cwd>/.pi/thinking-translator.json`。

项目层后读，普通字段直接覆盖；`translatorModel` 的 `provider`/`id` 支持在 fallback 上局部合并（L128-L202）。任一已存在配置 JSON 读取/解析出错会把本次有效配置整体设为 `enabled: false`，同一路径只警告一次（L156-L177、L207-L212）。`init` 只在显式命令时创建模板，模板默认 `enabled: false` 且不写模型（L289-L317）。

限制：除 `contentTypes` 和 `translatorModel` 外，`enabled`、`targetLanguage`、`minLatinChars` 只是 TypeScript 断言，没有运行时类型/范围验证；配置每个流 delta 都同步 `existsSync/readFileSync/JSON.parse`；项目路径硬编码 `.pi`，没有使用 Pi 的 `CONFIG_DIR_NAME`，也没有显式检查 `ctx.isProjectTrusted()`。

### 模型调用

1. 用 `ctx.modelRegistry.find(provider, id)` 查模型；
2. 用 `ctx.modelRegistry.getApiKeyAndHeaders(model)` 取鉴权；
3. 调 `@earendil-works/pi-ai` 的 `stream(model, request, options)`；请求只有一条本地构造的 `user` message；
4. options 传 `apiKey`、`headers`、`ctx.signal`，`maxTokens = clamp(ceil(source.length × 1.3), 1024, 8192)`；
5. prompt 要求把 delimiters 中内容视作 inert data，保持 Markdown/代码标识，只输出目标语言纯文本；消费 `text_delta` 流式展示。

证据：npm 源码 L217-L246、L481-L540、L772-L785。它不使用当前主 agent 模型，必须显式配置 registry 中另一个或同一个模型；没有 temperature、thinking level、JSON schema、usage 归集或 provider 级超时配置。翻译调用的 token/费用也没有写回 Pi session usage。

## 六、npm 版本与源码可追溯性

### 7. 当前版本、tag 和 commit

截至审查时间：

- npm `latest` 是 **`0.1.9`**；固定版本 metadata 的 `version` 为 `0.1.9`，发布时间为 `2026-06-08T16:14:13.884Z`，tarball SHA-1 为 `4554c536f30a45a2c9297b0160221e6a07b10b1c`，integrity 为 `sha512-XKJ2OTBCoN+DU1OTkaO4aGlcvGG2FIysC1aN3I1WaO0V3aKEMSpyNoSDDHVxIkIwiCtAkRPSrUir2ezVib3RCQ==`（[npm registry 固定版本 metadata](https://registry.npmjs.org/pi-thinking-translator/0.1.9)）。
- npm `0.1.9` metadata **没有 `gitHead`**，GitHub 也**没有 `v0.1.9` tag**。
- GitHub `main` 和最新 tag **`v0.1.8`** 都指向 commit [`df8ef85a584500c9e0e57c7fba88fcd9fcf8be82`](https://github.com/wplct/pi-thinking-translator/tree/df8ef85a584500c9e0e57c7fba88fcd9fcf8be82)；npm `0.1.8` metadata 的 `gitHead` 正是该 commit。
- 因而无法诚实地给 npm `0.1.9` 指定源码 commit。可复核事实是：`0.1.9` tarball = GitHub `df8ef85` 基线加上前述三处源码修复、README 更新及 package version 更新，但这些变更未出现在公开 Git commit/tag 中。

这是供应链可追溯性缺口。npm README 给出的 `pi install git:github.com/wplct/pi-thinking-translator@v0.1.9`（[`README@0.1.9`](https://unpkg.com/pi-thinking-translator@0.1.9/README.md) 第 26-30 行）目前会引用不存在的 tag。

### package metadata/可运行性问题

- tarball 实际只有 `package.json`、`README.md`、`extensions/.gitkeep`、`extensions/thinking-translator.ts` 四个文件；metadata 的 `files` 也只包含 `extensions` 和 `README.md`（[`package.json@0.1.9`](https://unpkg.com/pi-thinking-translator@0.1.9/package.json) L26-L29）。但 README 的 “Package Layout” 声称包含 `TODO.md` 和 `tests/`，且发布包 scripts 仍指向 `tests/*.test.ts`（metadata L44-L47）；已安装 tarball 无法按其脚本自测。
- 源码直接 import `@earendil-works/pi-tui`（npm 源码 L7），metadata 却只把它列为 `devDependency: 0.74.1`，没有声明为 runtime dependency/peer（metadata L35-L42）。
- 更严重的是 `@earendil-works/pi-ai` 与 coding-agent 的 peer range 都是 `"*"`，源码却依赖旧版具名导出 `stream`（L4）。实测用 metadata 自动解析到当前 `@earendil-works/pi-ai@0.84.4` 时，`npm run typecheck` 和测试入口都报 `TS2305`/`SyntaxError: ... does not provide an export named 'stream'`；固定到 `pi-ai`/coding-agent `0.74.1` 后，npm `0.1.9` 源码才通过 typecheck，仓库现有 16 个测试全部通过。即该包需要收窄兼容版本或迁移到当前 Pi AI API。

## 七、文档与实现不一致清单

1. **`reasoning`/`reasoning_summary` 支持是名义上的**：README/类型白名单说支持，真实流事件分发不处理。
2. **Git 安装示例无效**：npm README 指向不存在的 `v0.1.9`。
3. **npm package layout 不实**：README 列 `TODO.md`/`tests`，tarball 未发布；scripts 却仍引用测试。
4. **“30 秒 after last update”不精确**：每个 entry 在 npm `0.1.9` 是“翻译完成后 30 秒”过期；全局 hide timer 也是在成功完成时设置。流式 delta 只清旧 hide timer，不逐 delta 延长 entry 的 `expiresAt`（L478、L493-L509、L546-L568）。
5. **GitHub `main` README 比源码更旧**：它还写“最后 8 行”、默认示例 `minLatinChars: 24`、严格 JSON 输出/解析；同一 commit 源码实际是 20 行、250、流式纯文本。参见 GitHub [`README.md`](https://github.com/wplct/pi-thinking-translator/blob/df8ef85a584500c9e0e57c7fba88fcd9fcf8be82/README.md) 与 [`thinking-translator.ts`](https://github.com/wplct/pi-thinking-translator/blob/df8ef85a584500c9e0e57c7fba88fcd9fcf8be82/extensions/thinking-translator.ts)。npm `0.1.9` README 已修正这些旧描述。
6. 源码注释称新轮次会“让仍在后台翻译的旧任务失效”，准确说只是**让旧结果不可展示**；没有主动终止底层请求。

## 八、对目标需求的可复用点与限制

### 8. “把可见思考摘要异步翻译成中文”可直接复用的点

- **事件入口**：用 `message_update.assistantMessageEvent` 抓 `thinking_delta`/`thinking_end`，不用等整个主 agent 结束。
- **不阻塞模式**：handler 内 `void` 启动旁路 Promise，不把翻译时延加入主 agent 关键路径。
- **上下文隔离**：只写 TUI widget，不调用 message/session/context 写入 API；这是最值得保留的边界。
- **流式体验**：第二模型的 `text_delta` 直接追加并 `requestRender()`，首字延迟低。
- **生命周期隔离**：用 epoch 防止上一轮/上一会话结果串到当前 UI；用 sequence 抑制旧请求晚回的主动刷新。
- **模型复用**：通过 Pi model registry 查模型和鉴权，不另造 key 管理体系。
- **展示基础**：widget component factory、Markdown 渲染、宽度感知、末尾行数限制和自动消失都可复用。

### 必须补强/不能直接复用的部分

1. **先确认“可见思考摘要”的真实事件类型**：现实现只真正支持 `thinking_*`；不要因为 config 出现 `reasoning_summary` 就认为能收到它。对不同 provider 的实际 `AssistantMessageEvent` 写集成测试。
2. **取消要从逻辑失效升级为物理取消**：每个请求持有 `AbortController`，与 `ctx.signal` 组合；`agent_start`、session 切换、手动 clear 时 abort 所有旧请求。
3. **设置硬超时和并发上限**：例如 10–30 秒 timeout、最多 1–2 个翻译请求；新摘要可“latest wins”，避免 thinking 分段速度超过翻译速度。
4. **增加有界缓存/去重**：以 `{model,targetLanguage,sourceHash}` 为 key 做 session 内 LRU，并合并相同 in-flight 请求；不要写入对话 session。
5. **修正竞态和重绘**：entry 删除、失败、abort 都立即 `requestRender()`；清理 timer 不应被 sequence gate 意外跳过；展示顺序应按 source sequence 排序，而非请求启动/完成偶然顺序。
6. **对“摘要”优先翻译完整稳定单元**：如果上游已经给 visible summary，优先在对应 end 事件翻译完整摘要；当前“短标题 + 空行 + 正文”是启发式，可能误组普通段落，且会把多段拆成多次付费请求。
7. **补齐可靠性**：可重试的 429/5xx 指数退避一次；鉴权/配置错误不重试；保留原文是最终 fallback。
8. **固定 Pi API 兼容范围并升级调用 API**：不能继续使用 `peerDependencies: "*"` 加旧 `stream` 导出；CI 至少覆盖声明的最低/最高 Pi 版本。
9. **隐私与计费**：thinking 摘要会被发送给第二模型；应明确本地模型选项、usage 统计和敏感内容策略。当前实现没有把旁路模型 usage 计入 Pi session。
10. **配置只在 session/文件变化时加载并严格校验**：避免每个 token 同步读盘；使用 Pi 的配置目录常量和 trust 边界。

## 最终判断

**架构思路可复用，现包实现不可原样依赖。** 对目标需求，建议保留“`message_update` 旁路异步翻译 + UI-only widget + `requestRender()` + epoch 隔离”四件套；重写请求调度层，加入真实取消、timeout、并发 1、latest-wins、LRU 去重及当前 Pi API 兼容；如果目标仅是“可见思考摘要”，不要开放未实现的 `reasoning` 配置，也不要默认翻译普通 answer `text`。
