# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

主要读者是熟悉 Pi 的技术同事。他们会用 Pi 的终端交互模式（TUI），了解扩展、斜杠命令和模型配置。他们想知道这个扩展包里每项功能做什么、怎么触发、背后靠什么机制，以及有哪些边界和代价。

## Product Purpose

`pi-personal-extensions` 是个人维护的 Pi 扩展合集。它通过一个入口文件加载七项功能，用 `/personal` 统一启停和设置。讲解页的目标是让同事读完或听完后，能说清每项功能的作用和关键机制，并能自己安装和配置。

## Positioning

一个入口管理七项功能：禁用的功能不注册命令和事件；各功能的快捷命令与 `/personal` 子菜单共用同一套处理逻辑和配置。

## Operating Context

- 在 Pi TUI 中使用；部分功能（自动命名）也在 RPC 模式工作，Print / JSON 模式不自动调用。
- 配置文件默认在 `~/.pi/agent/`，跟随 `PI_CODING_AGENT_DIR`。
- 依赖镜像使用 npmmirror。

## Capabilities and Constraints

七项功能：`session-title`、`auto-session-name`、`substatusline`、`clickable-paths`、`user-message-border`、`statusline-style-picker`、`jev-inline-effort`。事实以 `README.md` 和 `extensions/` 源码为准。

## Evidence on Hand

- `README.md`、`CHANGELOG.md`、`extensions/*.ts`、`tests/*.test.mjs`。
- 没有用户数据、截图或使用统计；讲解页里的示意数据必须标注为示例。

## Product Principles

1. 事实以源码为准，讲解不夸大能力。
2. 写清代价和边界：额外的模型额度、发送了哪些文本、超时和失败时的行为。
3. 不改变主模型和主会话设置，这是多项功能的共同承诺。
