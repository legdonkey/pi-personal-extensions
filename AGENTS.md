# 项目维护规则

## 改功能时

- 每个功能单独放一个文件，统一由 `extensions/pi-personal-extensions.ts` 加载。
- 新功能和设置加到入口文件的 `actions` 菜单表中。
- 只向 Pi 提供 `/personal` 这一个斜杠命令。
- 给用户的提示要写菜单路径，例如 `/personal → 自动会话命名 → 选择命名模型`，不要写内部命令名。
- 升级 Pi 后，要检查用户消息边框是否仍能正常显示。

## 改配置时

- 用 `getAgentDir()` 获取配置目录，不要写死 `~/.pi/agent`。
- 改配置项名称或文件名后，旧配置仍须能读取，也仍须检查格式是否合法。
- 新旧配置项同时存在时，使用新项。具体对应关系按 `README.md` 的「配置文件」一节处理。
- 读取配置时不要修改文件，保存新配置时不要删除旧文件。
- 不要改下面这些名称，否则可能影响旧会话恢复：`jev-inline-effort`、`personal-auto-session-name`、`usage`、`session-id`。

## 测试和交付时

- 测试只能写临时目录，不能写真实的 `~/.pi`。
- 用 `mkdtempSync` 创建测试目录，再把 `PI_CODING_AGENT_DIR` 指向它。
- 测试结束后，恢复原来的环境变量并删除测试目录。
- 交付前运行 `npm run check`，检查必须全部通过。
- 用户能看到的功能有变化时，更新 `README.md`、`CHANGELOG.md` 的「未发布」部分，以及两份讲解页的相关内容。
- Git 提交说明用简体中文，一句话写清改了什么。

## 改讲解页时

- 修改前阅读 `PRODUCT.md` 和 `DESIGN.md`，按其中的要求制作页面。
- 修改 `src/` 中的页面源文件，不要直接改自动生成的 `index.html`。
- 章节格式按 `docs/extensions-guide/build.mjs` 的要求编写。
- 页面显示什么，语音就读什么。`data-say` 只能纠正读音，不能增删内容。
- 举例用的数据要标注「示例」。
- 功能变化后，更新对应的 `*.facts.md`。每条说明都要注明依据的源码行号或测试位置；代码位置变了，也要更新引用。
- 界面变化后，重录受影响的视频。
- 交付页面前，运行下面两条命令。不要加 `--no-tts`，这个参数只用于临时预览。

```bash
node docs/extensions-guide/build.mjs
node docs/extensions-guide/build.mjs docs/extensions-usage
```

## 录屏时

- 先按 `docs/extensions-usage/tapes/_settings.tape` 创建临时录屏目录，并把 `PI_CODING_AGENT_DIR` 指向它。
- 不要修改真实的 agent 目录。临时目录中的 `npm:pi-alibaba-models` 等会写真实目录的包，要先移除。
- 不要读取或打印 `auth.json` 等凭据文件。
- 直接运行 `install/releases/<current-version>` 里的 `pi`。不要用 `~/.local/bin/pi`，它会修改真实安装目录。
- 在仓库根目录运行 vhs，按 `_settings.tape` 中的参数剪辑；`chat-turn` 使用 `chat-turn.tape` 中的参数。
- 将视频和封面图保存到 `docs/extensions-usage/media/`。技术版也用到的文件，要原样复制到 `docs/extensions-guide/media/`。
- 录完后删除临时录屏目录。
