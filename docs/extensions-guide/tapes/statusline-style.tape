# /statusline-style：配色预览列表，上下切换预览，Esc 退出不应用
Output "docs/extensions-guide/media/statusline-style.mp4"
Source "docs/extensions-guide/tapes/_settings.tape"

Hide
Type "cd /Users/yangguandao/Projects/pi-personal-extensions && clear && pi"
Enter
Wait+Screen /未命名会话/
Sleep 5s
Show

Sleep 1s
Type "/statusline-style"
Sleep 800ms
Enter
Sleep 2.5s
Down
Sleep 1.2s
Down
Sleep 1.2s
Screenshot "docs/extensions-guide/media/statusline-style.png"
Sleep 300ms
Down
Sleep 1.2s
Up
Sleep 1.5s
Escape
Sleep 1.5s

Hide
Ctrl+D
Sleep 1s
