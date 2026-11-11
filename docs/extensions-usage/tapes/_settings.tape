# 公共画面设置。必须在 Source 之前设置 Width/Height；在仓库根目录执行 vhs。
# PI_CODING_AGENT_DIR 指向会话 scratchpad 里的临时 sandbox，录完已删除；重录前必须重建：
#   rsync -a ~/.pi/agent/ <sandbox>/，排除 sessions、install、session-archive、tmp、audit、backups、missions、缓存等目录；
#   settings.json 移除 npm:pi-alibaba-models（它会写真实 agent 目录），相对包路径改为绝对路径，设 quietStartup: true。
#   不读取、不打印 sandbox 里的 auth.json 等凭据；录完删除整个 sandbox。
# 各 tape 直接调用 install/releases/<current-version> 里的 pi，不经 ~/.local/bin/pi 启动器：
#   启动器会导出 PI_MANAGED_INSTALL_ROOT，每次启动都会在真实 ~/.pi/agent/install 里留下目录改动。
# 后期（原片 → media/<id>.mp4，libx264 crf 26、yuv420p、-an、+faststart，fps 30）：
#   ffmpeg -ss <起> -to <止> -i raw.mp4 -vf crop=960:<高>:0:<y>,fps=30；poster 取下表时间点，end 表示成片最后一帧。
#   id                      y   高   起   止   poster
#   personal-menu           88  434  0.2  5.7  3.0
#   personal-switches       78  436  0.2  6.7  4.6   （再 pad=960:448:0:12:0x1e1e2e，顶部补 12px 底色，避开 Ponytail 行）
#   statusline-style        0   708  0.2  10.0  7.2
#   auto-name-model         88  434  0.2  8.4  6.5
#   effort-model            156 432  0.2  7.9  5.8
#   clickable-paths-status  0   888  0.2  7.0  5.6
#   auto-name-status        0   788  0.2  6.8  end
#   effort-status           34  596  0.2  7.6  5.6
Set Shell "bash"
Set FontSize 18
Set FontFamily "Maple Mono NF CN"
Set Padding 24
Set TypingSpeed 60ms
Set Theme "Catppuccin Mocha"
Set WaitTimeout 60s
Env PI_CODING_AGENT_DIR "/private/tmp/claude-501/-Users-yangguandao-Projects-pi-personal-extensions/446cc168-f46d-47aa-9300-0cee8a1ae535/scratchpad/pi-agent-sandbox4"
