# /personal → 状态栏：额度、会话 ID 与配色 → 独立功能开关（查看后 Esc）→ 选择 pi-statusline 自定义配色 → ↓↓↑ → Esc。只查看、预览或取消，不保存、不重载、不发送模型消息。
Output "/private/tmp/claude-501/-Users-yangguandao-Projects-pi-personal-extensions/ef62fe0d-740b-45b2-b2c3-d3c976c4b808/scratchpad/raw/statusline-style.mp4"
Output "/private/tmp/claude-501/-Users-yangguandao-Projects-pi-personal-extensions/ef62fe0d-740b-45b2-b2c3-d3c976c4b808/scratchpad/raw/statusline-style.txt"
Set Width 960
Set Height 720
Source "docs/extensions-usage/tapes/_settings.tape"

Hide
Type@1ms "cd /Users/yangguandao/Projects/pi-personal-extensions && clear && PATH=$HOME/.local/share/pi-node/current/bin:$PATH $HOME/.pi/agent/install/releases/$(cat $HOME/.pi/agent/install/current-version)/node_modules/.bin/pi --no-session --no-skills --no-prompt-templates --model openai-codex/gpt-6.1-sol --thinking medium"
Enter
Wait+Screen /未命名会话|gpt-6.1-sol/
Sleep 2s
Show

Type "/personal"
Sleep 300ms
Enter
Wait+Screen /个人扩展 · 统一管理/
Sleep 500ms
Down@130ms 1
Sleep 300ms
Enter
Sleep 600ms
Down@130ms 2
Enter
Wait+Screen /状态栏独立功能开关/
Sleep 1.3s
Escape
Sleep 500ms
Up@130ms 2
Enter
Wait+Screen /选择 pi-statusline 自定义配色/
Sleep 1.2s
Down
Sleep 900ms
Down
Sleep 900ms
Up
Sleep 1.1s
Escape
Sleep 900ms

Hide
Ctrl+D
Sleep 700ms
