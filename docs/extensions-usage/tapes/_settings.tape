# 公共画面设置（窗口尺寸在各 tape 的 Source 之前设置；Source 之后的 Set 不生效）。各 tape 用 Source 引入；在仓库根目录执行：vhs docs/extensions-usage/tapes/<id>.tape
# 原始录像输出到 scratchpad/raw/，再用 ffmpeg 剪掉首尾、裁剪到内容区域，写入 docs/extensions-usage/media/。
# PI_CODING_AGENT_DIR 指向 ~/.pi/agent 的副本（排除 sessions 等，settings.json 中相对包路径改为绝对路径，并设 quietStartup: true；移除 npm:pi-alibaba-models，它把模型缓存写死在 ~/.pi/agent），
# 避免录制改动真实配置。本仓库的配置读取跟随 PI_CODING_AGENT_DIR。重录时把下面的路径换成新建的副本，录完删除副本。
Set Shell "bash"
Set FontSize 18
Set FontFamily "Maple Mono NF CN"
Set Padding 24
Set TypingSpeed 60ms
Set Theme "Catppuccin Mocha"
Set WaitTimeout 60s
Env PI_CODING_AGENT_DIR "/private/tmp/claude-501/-Users-yangguandao-Projects-pi-personal-extensions/446cc168-f46d-47aa-9300-0cee8a1ae535/scratchpad/pi-agent-sandbox2"
