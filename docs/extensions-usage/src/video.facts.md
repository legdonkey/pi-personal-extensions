# video 使用事实清单

- 管理路径为 /personal → 原视频审查 → 查看通路与限制，统一启停；工具名 understand_video，要求用户明确授权视频外发 —— extensions/pi-personal-extensions.ts:55-60、69-71；extensions/understand-video.ts:51-65。
- 只读 cwd 内非隐藏且无符号/硬链接的 MP4，24 bytes–20 MiB；非 URL、不遍历目录；问题 8000 字符、120 秒超时、正文最多 32 KiB —— extensions/understand-video-worker.mjs:7-40、58、86-89；extensions/understand-video.ts:8-9、14-47、64-68；tests/understand-video.test.mjs「合法 MP4」「文件类型」「取消和超时」「输出限制」。
- 调用现有 Antigravity OAuth 和 Argon medium，真实 video/mp4 由工具内部发送，不是主会话视频附件；没有其他模型/提供方/浏览器回退 —— extensions/understand-video-worker.mjs:43-52、59-89；extensions/understand-video.ts:10、72-80。
- 真实统一入口与 video-reviewer 均正确识别三秒红蓝绿；音轨未可靠验证，长视频和快速转场不保证覆盖 —— /tmp/understand-video-entry-smoke-result.json；video-reviewer 验收 run 8c9e15ab-8363-4366-b6d9-6d4451933183；extensions/understand-video.ts:10。
- 依赖布局固定为 getAgentDir()/npm/node_modules/pi-antigravity，实测 Pi1.5.0 与插件0.11.0；已有主会话手动 /reload，角色缺少工具或失败应报告阻塞 —— extensions/understand-video.ts:55、72；README.md「原视频审查」；/Users/yangguandao/.pi/agent/agents/video-reviewer.md:24。
- demo.mp4 和示例问题是示例，不是自动获取的业务数据 —— docs/extensions-usage/src/07-video.html:12、25。
