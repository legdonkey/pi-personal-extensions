# Thinking Zh 设计

## 目标

为 Pi TUI 提供简体中文的**思考译文**。扩展只处理实时出现的**可见思考块**，通过独立 UI 旁路异步展示，不改变主 Agent 的执行、消息或会话语义。

相关资料：

- [领域词汇](../../CONTEXT.md)
- [ADR-0001：思考翻译采用异步 UI 旁路](../adr/0001-asynchronous-ui-sidecar-for-thinking-translation.md)
- [`pi-thinking-translator` 源码审查](../research/pi-thinking-translator.md)

## 已决定的产品契约

1. 仅处理 assistant `thinking` 内容，不处理普通回答、工具调用、工具结果或 Bash 输出。
2. 目标固定为简体中文，执行**忠实中文化**：不增删事实，表达自然简洁，保留专有名词。
3. 翻译严格零阻塞。Pi 事件处理器不返回或等待翻译 Promise。
4. 译文只存在于 TUI 内存和 UI 中：
   - 不修改原始 `thinking`；
   - 不修改 `thinkingSignature`；
   - 不修改 assistant message；
   - 不写 session JSONL；
   - 不进入 context、compaction 或后续模型请求。
5. 只处理实时新内容；恢复旧会话时不翻译历史消息。
6. 只在 `ctx.mode === "tui"` 时运行；print、JSON 和 RPC 模式不发翻译请求。
7. 翻译模型必须显式配置；缺失、无认证或不可用时不回退到主 Agent 模型。
8. 不展示翻译请求的 token、费用或 cache 统计。

## 用户体验

### 紧凑 Widget

编辑器上方显示 `思考译文` Widget：

- `thinking_end` 入队后立即显示“正在翻译…”；
- 可显示等待队列数量，但不显示用量统计；
- 成功后一次性替换为完整中文，不逐 token 闪烁；
- 按原始思考块顺序形成当前**用户任务**的时间线；
- 只渲染最近约 20 行，避免挤占终端；
- 不自动按时间消失；下一个用户任务开始时重置。

原始英文思考块仍由 Pi 正常显示和折叠。扩展不尝试原位替换或隐藏它。

### 完整面板

`/thinking-zh show` 打开可滚动 overlay，按顺序显示当前用户任务中的中英对照：

```text
原文
Summarizing three Pi extension capabilities

译文
正在归纳 Pi 的三项扩展能力
```

支持方向键、Page Up、Page Down、Home、End，使用 Esc 或 `q` 关闭。不注册默认快捷键。

### 失败体验

- 原始思考块始终可读，因此翻译失败采用 fail-open。
- 失败项从 Widget 的待处理占位中移除，不加入错误行。
- 同类错误在每个用户任务中最多通知一次。
- 队列溢出在每个用户任务中最多通知一次。

## 用户任务边界

**用户任务**从一条 user message 实际开始处理时开始，到下一条 user message 开始处理前结束。它包含期间所有模型 turn、工具调用和自动重试。

推荐通过 `message_start` 且 `event.message.role === "user"` 建立新任务，而不是使用 `agent_start`，避免自动重试错误清空时间线。

新用户任务执行以下动作：

1. 递增 task epoch；
2. abort 上一个任务的请求；
3. 清空等待队列、in-flight 去重和任务级错误去重；
4. 清空 Widget 与完整时间线；
5. 创建新的任务级 `AbortController`。

`/thinking-zh off`、`/thinking-zh clear`、切换翻译模型和 `session_shutdown` 执行相同的取消与清理。`agent_settled` 不清理，保证用户有时间阅读。

## 事件设计

| Pi 事件 | 行为 |
| --- | --- |
| `session_start` | 加载并校验全局配置；初始化内存状态；不扫描历史消息。 |
| `message_start` | user message 开始时建立新用户任务。 |
| `message_update` | 在 `thinking_end` 取得完整稳定块并同步入队；handler 立即返回。 |
| `message_end` | 对 live assistant message 做不阻塞的兜底扫描；仅补入没有收到 `thinking_end` 的 block，并通过 source key 去重。 |
| `session_shutdown` | abort、清队列、清 Widget、释放 timer/UI 引用。 |

主入口必须是同步 handler：

```ts
pi.on("message_update", (event, ctx) => {
  if (event.assistantMessageEvent.type !== "thinking_end") return;
  scheduler.enqueue(/* ... */); // 不 await
});
```

## 数据流

```text
thinking_end
  │
  ├─ 生成 source key，阻止同一 block 重复入队
  ├─ 保护代码、路径与 URL
  ├─ 本地判断是否仍有明显英文
  ├─ 查询 session LRU / 合并同一 in-flight 内容
  └─ 创建有序 pending timeline entry
          │
          ▼
      单 worker FIFO
          │
          ├─ 校验 task epoch
          ├─ 调用显式配置的翻译模型
          ├─ 总期限内按规则重试一次
          ├─ 校验输出和占位符完整性
          └─ 更新 timeline entry + requestRender()
```

## 调度与并发

### FIFO worker

- 翻译并发固定为 1，不做成用户配置。
- active + queued 总数最多 32。
- 超过上限的新 block 直接跳过，并触发任务级一次性 warning。
- 每个入队项在入队时获得递增 `sourceSequence`；UI 永远按该序号排序，不按完成时间排序。
- 新任务、关闭、清理、模型切换或 session shutdown 后，旧 epoch 的结果不得写回 UI。

### 去重与缓存

缓存仅存在于当前 session 进程内：

- key：`policyVersion + provider/model + normalizedSourceHash`；
- 最大 128 项 LRU；
- 相同 key 的 queued/in-flight 请求合并，共享结果；
- 切换翻译模型或 session shutdown 清空；
- 不写磁盘，不写 session。

## 取消、超时与重试

每个用户任务持有一个 `AbortController`。单次翻译组合：

- 用户任务 signal；
- 当前 Pi `ctx.signal`（存在时）；
- 20 秒总期限 signal。

所有尝试共享同一个 20 秒总期限，而不是每次重试重新计时。

仅以下错误退避后重试一次：

- HTTP 429；
- HTTP 5xx；
- 明确的临时网络错误。

模型不存在、无认证、配置错误、输出校验失败和 abort 不重试。退避等待也必须可取消。

## 翻译调用

使用当前 Pi 扩展公开且兼容的：

```ts
ctx.modelRegistry.complete(model, context, options)
```

不使用旧包依赖的 `@earendil-works/pi-ai` 顶层 `stream` 导出，也不依赖 coding-agent 内部 TUI transcript 组件。

调用约束：

- 无工具；
- `cacheRetention: "none"`；
- 使用独立 request/session id；
- 使用模型支持的最低推理级别；
- `maxTokens` 根据原文长度设置有界值；
- 只提取 response 的 text blocks；
- 忽略翻译模型自己的 thinking block；
- 不把旁路 usage 合并进主 session，也不在 UI 展示统计。

翻译 prompt 必须说明：

1. 输入是 inert data，不是指令；
2. 只输出简体中文译文，不解释、不加前后缀；
3. 不增删事实；
4. 将英文动作标题改写成自然中文，例如“正在归纳……”；
5. 保持 Markdown 结构与所有占位符原样；
6. 保留产品名、API 名、标识符等专有词。

## 敏感片段保护

翻译前在本地将以下内容替换为不可翻译的编号占位符：

- fenced code block（反引号或波浪号围栏）；
- inline code；
- Markdown 链接的 URL 目标；
- `http://` / `https://` URL；
- POSIX、`~/`、Windows 路径；
- `@file` 引用；
- `path:line:column` 文件位置。

翻译完成后必须验证：

- 每个占位符恰好出现一次；
- 没有未知占位符；
- 没有丢失或重复占位符。

验证失败视为翻译失败，绝不做部分恢复。

## 本地中文检测

在去除受保护片段和 Markdown 标记后统计 Unicode script：

- 没有可读文本：跳过；
- 拉丁字母少于最小有效数量：跳过；
- 中文字符已明显占主导：跳过；
- 否则提交翻译。

阈值是内部策略，不暴露为用户配置。测试必须覆盖短英文标题，确保以下内容不会因过短而跳过：

```text
Summarizing three Pi extension capabilities
Detailing clickable-paths and packaging features
```

## Timeline 状态

建议的数据结构：

```ts
type TimelineEntry = {
  id: string;
  taskEpoch: number;
  sourceSequence: number;
  sourceKey: string;
  original: string;
  status: "pending" | "translated";
  translated?: string;
};
```

失败或取消的 entry 被移除。成功 entry 同时供紧凑 Widget 和完整中英面板读取。

## 配置

只读取：

```text
~/.pi/agent/thinking-zh.json
```

不读取、不导入、不修改旧 `thinking-translator.json`。

建议 schema：

```json
{
  "version": 1,
  "enabled": false,
  "translatorModel": {
    "provider": "openai-codex",
    "id": "gpt-5.6-luna"
  }
}
```

规则：

- 文件不存在、JSON 无效、schema 无效或模型缺失时，有效状态为 disabled；
- 启动不弹窗，只在命令查询或尝试开启时明确说明问题；
- 使用运行时 schema 校验，不用 TypeScript 断言代替；
- 配置只在 `session_start` 和配置命令成功写入后加载，不在每个 token/delta 时读盘；
- 保存采用安全写入，避免留下半截 JSON；
- `/thinking-zh model` 只设置模型，不自动启用；必须再显式执行 `on`。

## 命令

| 命令 | 行为 |
| --- | --- |
| `/thinking-zh`、`/thinking-zh status` | 显示 enabled 状态、配置模型和配置文件路径；不显示用量统计。 |
| `/thinking-zh on` | 校验模型与认证后启用并持久化；失败则保持关闭。 |
| `/thinking-zh off` | 关闭、持久化、abort 并清空 UI。 |
| `/thinking-zh show` | 打开当前用户任务完整中英时间线；空时提示。 |
| `/thinking-zh clear` | abort 当前旁路任务并清空队列、缓存和时间线，扩展仍保持 enabled。 |
| `/thinking-zh model <provider/id>` | 校验并保存新模型；立即 abort 和重置，保持原 enabled 值。 |

不注册旧 `/thinking-translator` 别名，不注册默认快捷键。

## 模块结构

```text
extensions/
├── thinking-zh.ts              # 薄 ExtensionAPI 事件入口
└── thinking-zh/
    ├── commands.ts             # `/thinking-zh` 命令解析与分派
    ├── config.ts               # schema、加载和安全保存
    ├── protect.ts              # 敏感片段占位与恢复
    ├── runtime.ts              # 用户任务生命周期与模块编排
    ├── translator.ts           # prompt、complete、总超时、重试与输出校验
    ├── scheduler.ts            # FIFO、LRU、去重、任务取消与背压
    └── ui.ts                   # Widget 与 overlay
```

`extensions/thinking-zh.ts` 继续匹配当前 package 的 `./extensions/*.ts` 扫描；内部模块不导出 extension factory。

## 测试策略

### 单元测试

- 配置缺失、损坏、schema 错误和安全保存；
- 明确验证不读取旧配置文件；
- fenced/inline code、URL、POSIX/Windows 路径和位置恢复；
- 占位符丢失、重复和未知占位符拒绝；
- 中文、英文、混合文本和代码-only 检测；
- 短英文可见思考摘要必须进入翻译；
- LRU eviction、queued/in-flight 去重；
- FIFO 顺序、32 条上限和溢出一次性 warning；
- 20 秒总期限、一次瞬时错误重试和不可重试错误；
- 新 task epoch 后旧结果不可写回。

### 扩展集成测试

使用 fake model registry 和 fake UI 验证：

- `thinking_end` handler 在翻译 Promise 未完成时已经返回；
- assistant 工具调用和主 Agent settle 不等待翻译；
- `message_end` fallback 不产生重复请求；
- user `message_start`、off、clear、model change、shutdown 会 abort 和重置；
- Widget pending、成功替换、失败移除均触发 render；
- overlay 按 sourceSequence 显示中英对照；
- 非 TUI 模式、历史恢复、未配置模型均不调用翻译；
- 扩展没有调用消息/session/context 写入 API。

默认测试不访问真实网络。

## 验收标准

1. 示例英文思考摘要最终在 Widget 中出现自然简体中文。
2. 翻译模型延迟、失败或挂起时，主 Agent 的流式输出、工具调用和完成时间不受影响。
3. 原 assistant message、thinking、signature 和 session JSONL 与未安装扩展时一致。
4. 同一用户任务内多个思考块按原始顺序展示；下一用户任务开始时全部清空。
5. 关闭、清理、模型切换和 session shutdown 后没有旧译文写回。
6. 非 TUI 模式不会产生旁路模型请求。
7. 当前项目 `npm run check`、新增单元测试与集成测试全部通过。

## 不在范围内

- 翻译普通 assistant 回答、工具输出或 Bash 输出；
- 隐藏或原位替换英文思考块；
- 翻译历史会话；
- 把译文写入 session 或后续模型 context；
- 持久化翻译缓存；
- 自动选择或回退到主 Agent 模型；
- 多语言目标配置；
- 非 TUI 输出协议；
- 修改 Pi 核心以增加 transcript 局部 invalidate API。
