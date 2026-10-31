# /personal switches：SettingsList 开关列表，上下移动，空格切换一项，Esc 放弃（不保存）
Output "docs/extensions-guide/media/personal-switches.mp4"
Source "docs/extensions-guide/tapes/_settings.tape"

Hide
Type "cd /Users/yangguandao/Projects/pi-personal-extensions && clear && pi"
Enter
Wait+Screen /未命名会话/
Sleep 5s
Show

Sleep 1s
Type "/personal switches"
Sleep 800ms
Enter
Sleep 2.5s
Down
Sleep 700ms
Down
Sleep 1s
Space
Sleep 600ms
Screenshot "docs/extensions-guide/media/personal-switches.png"
Sleep 2.4s
Escape
Sleep 1.5s

Hide
Ctrl+D
Sleep 1s
