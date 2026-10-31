# /effort：继续 chat-turn 录制产生的会话（pi -c），不发新消息，只看状态输出。
Output "docs/extensions-guide/media/effort-status.mp4"
Source "docs/extensions-guide/tapes/_settings.tape"

Hide
Type "cd /Users/yangguandao/Projects/pi-personal-extensions && clear && pi -c --model openai-codex/gpt-6.1-sol --thinking medium"
Enter
Wait+Screen /未命名会话|｜/
Sleep 6s
Show

Sleep 1s
Type "/effort"
Sleep 800ms
Enter
Sleep 2.5s
Screenshot "docs/extensions-guide/media/effort-status.png"
Sleep 3.5s

Hide
Ctrl+D
Sleep 1s
