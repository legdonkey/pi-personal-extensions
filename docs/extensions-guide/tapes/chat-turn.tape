# 新会话发一条消息：橙色圆角边框、回复中的路径链接、自动命名改标题、状态栏额度与会话 ID。
# 会真实调用模型一次（主模型 + 自动思考强度分类 + 自动命名）。
# 消息要带明确任务意图；只有「回复一句话」时命名模型会判定信息不足，保留原标题。
# 原始录像约 57 秒，含等待模型的空档。录完后按实际时间点剪辑（下面是 2026-10-31 这次的时间点：13.6s 回复完成、17.9s 标题改变）：
#   ffmpeg -i chat-turn.raw.mp4 -filter_complex "[0:v]trim=0.5:13.6,setpts=PTS-STARTPTS[a];[0:v]trim=13.6:17.6,setpts=(PTS-STARTPTS)/2[b];[0:v]trim=17.6:21.6,setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1:a=0,fps=30[v]" \
#     -map "[v]" -c:v libx264 -crf 30 -preset slow -pix_fmt yuv420p -movflags +faststart -an chat-turn.mp4
Output "docs/extensions-guide/media/chat-turn.mp4"
Source "docs/extensions-guide/tapes/_settings.tape"

Hide
Type "cd /Users/yangguandao/Projects/pi-personal-extensions && clear && pi --model openai-codex/gpt-6.1-sol --thinking medium"
Enter
Wait+Screen /未命名会话/
Sleep 5s
Show

Sleep 1s
Type "我在给 pi-personal-extensions 写中文讲解文档。不要调用工具，只回复一句话：入口在 extensions/pi-personal-extensions.ts:24"
Sleep 800ms
Enter
Sleep 50s
Screenshot "docs/extensions-guide/media/chat-turn.png"
Sleep 2s

Hide
Ctrl+D
Sleep 1s
