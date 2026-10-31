# /personal → 状态栏：额度、会话 ID 与配色 → 选择 pi-statusline 自定义配色 → ↓↓↑ → Esc。只查看、预览或取消，不保存、不重载、不发送模型消息。
Output "/private/tmp/claude-501/-Users-yangguandao-Projects-pi-personal-extensions/446cc168-f46d-47aa-9300-0cee8a1ae535/scratchpad/raw4/statusline-style.mp4"
Output "/private/tmp/claude-501/-Users-yangguandao-Projects-pi-personal-extensions/446cc168-f46d-47aa-9300-0cee8a1ae535/scratchpad/raw4/statusline-style.txt"
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
Sleep 900ms
Down@130ms 2
Sleep 400ms
Enter
Sleep 1.1s
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
