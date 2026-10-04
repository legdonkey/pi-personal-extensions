@echo off
rem Pi 适配：运行固定版本且经过校验的官方引擎。
node "%~dp0run.mjs" %*
exit /b %errorlevel%
