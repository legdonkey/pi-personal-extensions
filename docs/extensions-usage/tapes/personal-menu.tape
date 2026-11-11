# /personal → 自动会话命名 → Esc。只查看、预览或取消，不保存、不重载、不发送模型消息。
Output "/private/tmp/claude-501/-Users-yangguandao-Projects-pi-personal-extensions/ef62fe0d-740b-45b2-b2c3-d3c976c4b808/scratchpad/raw/personal-menu.mp4"
Output "/private/tmp/claude-501/-Users-yangguandao-Projects-pi-personal-extensions/ef62fe0d-740b-45b2-b2c3-d3c976c4b808/scratchpad/raw/personal-menu.txt"
Set Width 960
Set Height 540
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
Sleep 400ms
Enter
Sleep 1.1s
Sleep 2s
Escape
Sleep 900ms

Hide
Ctrl+D
Sleep 700ms
