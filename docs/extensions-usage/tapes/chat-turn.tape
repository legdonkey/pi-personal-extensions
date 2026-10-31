# 新会话发一条消息：橙色圆角边框、回复中的路径链接、自动命名改标题、状态栏额度与会话 ID、🧠 思考强度。
# 会真实调用模型一次（主模型 + 自动思考强度分类 + 自动命名）。消息要带明确任务意图，否则命名模型可能保留原标题。
# 原始录像约 60 秒，含等待模型的空档。按实际时间点剪辑；2026-10-31 这次 14.4s 回复完成、24.4s 标题改变：
#   ffmpeg -i raw/chat-turn.mp4 -filter_complex "[0:v]trim=0.8:14.4,setpts=(PTS-STARTPTS)/2[a];[0:v]trim=14.4:16.4,setpts=PTS-STARTPTS[b];[0:v]trim=16.4:23.6,setpts=(PTS-STARTPTS)/4[c];[0:v]trim=23.6:28.6,setpts=PTS-STARTPTS[d];[a][b][c][d]concat=n=4:v=1:a=0,fps=30[v]" \
#     -map "[v]" -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart -an chat-turn.mp4
# 其他 tape：ffmpeg -ss 0.8 -to <时长-0.8（菜单）或-1.5（输出）> -vf crop=960:<高>:0:<y>，参数见交付报告。
Output "/private/tmp/claude-501/-Users-yangguandao-Projects-pi-personal-extensions/446cc168-f46d-47aa-9300-0cee8a1ae535/scratchpad/raw/chat-turn.mp4"
Set Width 1280
Set Height 720
Source "docs/extensions-usage/tapes/_settings.tape"

Hide
Type "cd /Users/yangguandao/Projects/pi-personal-extensions && clear && pi --model openai-codex/gpt-6.1-sol --thinking medium"
Enter
Wait+Screen /未命名会话/
Sleep 5s
Show

Sleep 1s
Type "我在给 pi-personal-extensions 写中文使用指南。不要调用工具，只回复一句话：入口在 extensions/pi-personal-extensions.ts:24"
Sleep 800ms
Enter
Sleep 55s

Hide
Ctrl+D
Sleep 1s
