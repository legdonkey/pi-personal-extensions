# video 事实清单

- 工具名、参数、菜单内状态说明及严格目录/大小限制 —— extensions/understand-video.ts:51-73；extensions/pi-personal-extensions.ts:55-60、69-71。
- 父子双检：工作目录真实路径、非隐藏路径、MP4 后缀与 ftyp、普通文件、无符号/硬链接、20 MiB、有限读取、读取期间变更及 SHA-256 摘要 —— extensions/understand-video-worker.mjs:12-40、55-58；tests/understand-video.test.mjs「合法 MP4」「权限不足」「文件类型」「API 异常」。
- worker 只加载指定 provider，无 ambient 扩展、技能或上下文；内存设置/会话，由 SDK 自行处理既有账号，使用宿主 getPackageDir() —— extensions/understand-video.ts:72；extensions/understand-video-worker.mjs:59-74。
- 正常 provider 的 Argon 动态路由，medium 调用，只在独立进程适配真实 video/mp4，官方 HTTPS endpoint 和模型形状不符时不注入 —— extensions/understand-video-worker.mjs:43-52、75-83；tests/understand-video.test.mjs「只注入 Google 原生视频请求」。
- 宿主 fetch 不变；超时/取消杀进程，close 后才返回，IPC 有限输出且不转发原始 provider 错误；worker 自有看门狗、断连退出 —— extensions/understand-video.ts:14-47、75-80；extensions/understand-video-worker.mjs:84-103；tests/understand-video.test.mjs「真实隔离进程成功返回」「取消和超时」「输出限制」。
- 工具不是主会话的视频附件，视频外发并消耗额外额度；当前未返回 usage 因而不汇入主会话统计；音轨、长视频和快速转场边界 —— extensions/understand-video.ts:10、62-64、73；extensions/understand-video-worker.mjs:83-89。
- 两个真实调用正确识别 0–1 秒红、1–2 秒蓝、2–3 秒绿；仅使用已授权的无敏感 probe.mp4，不代表完整审片验收 —— /tmp/understand-video-entry-smoke-result.json；video-reviewer 验收 run 8c9e15ab-8363-4366-b6d9-6d4451933183；tests/understand-video.test.mjs 为离线 mock，不作为真实模型正确性证据。
- 角色工具需显式允许；当前后台子代理继承父会话扩展，无需额外指定扩展路径，其他权限与模型不变 —— /Users/yangguandao/.pi/agent/agents/video-reviewer.md:5-15；移除 subagentOnlyExtensions 后的验收 run 0bc41c0b-bc96-4661-aa9b-353dbfedf1dd（实际调用 understand_video 成功并识别红蓝绿）。
- 已打开主会话需手动 /reload，启停重载沿用统一入口；录屏 personal-menu / personal-switches 已按新增功能重录并同步两份讲解页 —— extensions/pi-personal-extensions.ts:147-272；docs/extensions-usage/tapes/personal-menu.tape、personal-switches.tape。
