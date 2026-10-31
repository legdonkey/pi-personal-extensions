# 公共画面设置。各录屏 tape 用 Source 引入；在仓库根目录执行：vhs docs/extensions-guide/tapes/<id>.tape
# PI_CODING_AGENT_DIR / PI_AGENT_DIR 指向 ~/.pi/agent 的副本（排除 sessions，settings.json 中相对包路径改为绝对路径，并设 quietStartup: true），
# 避免录制改动真实配置。重录时把下面的路径换成新建的副本。
Set Shell "bash"
Set Width 1280
Set Height 720
Set FontSize 18
Set FontFamily "Maple Mono NF CN"
Set Padding 24
Set TypingSpeed 60ms
Set Theme "Catppuccin Mocha"
Set WaitTimeout 60s
Env PI_CODING_AGENT_DIR "/private/tmp/claude-501/-Users-yangguandao-Projects-pi-personal-extensions/446cc168-f46d-47aa-9300-0cee8a1ae535/scratchpad/pi-agent-sandbox"
Env PI_AGENT_DIR "/private/tmp/claude-501/-Users-yangguandao-Projects-pi-personal-extensions/446cc168-f46d-47aa-9300-0cee8a1ae535/scratchpad/pi-agent-sandbox"
