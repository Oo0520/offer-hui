@echo off
rem 查看当前公网 URL（从 tunnel 日志提取）
cd /d "%~dp0"
echo === Web URL ===
findstr /i "trycloudflare.com" logs\tunnel-web.log 2>nul | findstr /i "https://" | findstr /v "argotunnel" | findstr /v "api.cloudflare"
echo === MCP URL ===
findstr /i "trycloudflare.com" logs\tunnel-mcp.log 2>nul | findstr /i "https://" | findstr /v "argotunnel" | findstr /v "api.cloudflare"
echo.
echo (若为空，说明隧道刚启动，稍等几秒再运行本脚本)
