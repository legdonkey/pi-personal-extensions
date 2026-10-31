# /effort：继续 chat-turn 产生的会话（pi -c），不发新消息，只看状态输出
Output "/private/tmp/claude-501/-Users-yangguandao-Projects-pi-personal-extensions/446cc168-f46d-47aa-9300-0cee8a1ae535/scratchpad/raw/effort-status.mp4"
# 终端窗口缩小到内容区域，让文字在约 640px 宽的显示框里仍可读
Set Width 960
Set Height 540
Source "docs/extensions-usage/tapes/_settings.tape"

Hide
Type "cd /Users/yangguandao/Projects/pi-personal-extensions && clear && pi -c --model openai-codex/gpt-6.1-sol --thinking medium"
Enter
Wait+Screen /未命名会话|｜/
Sleep 5s
Show

Sleep 1s
Type "/effort"
Sleep 800ms
Enter
Sleep 5s

Hide
Ctrl+D
Sleep 1s
