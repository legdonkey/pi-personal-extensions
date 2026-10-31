# /personal switches：上下移动，空格切换一项，Esc 放弃（不保存）
Output "/private/tmp/claude-501/-Users-yangguandao-Projects-pi-personal-extensions/446cc168-f46d-47aa-9300-0cee8a1ae535/scratchpad/raw/personal-switches.mp4"
# 终端窗口缩小到内容区域，让文字在约 640px 宽的显示框里仍可读
Set Width 960
Set Height 540
Source "docs/extensions-usage/tapes/_settings.tape"

Hide
Type "cd /Users/yangguandao/Projects/pi-personal-extensions && clear && pi "
Enter
Wait+Screen /未命名会话|｜/
Sleep 5s
Show

Sleep 1s
Type "/personal switches"
Sleep 800ms
Enter
Sleep 2s
Down
Sleep 700ms
Down
Sleep 1s
Space
Sleep 2.5s
Escape
Sleep 1.5s

Hide
Ctrl+D
Sleep 1s
