@echo off
rem Offer派 一键启动：MCP Server + Web + 内网穿透(web/mcp 双隧道)
rem 用法: start_all.bat   （URL 写入 logs 目录，可用 check_urls.bat 查看）
cd /d "%~dp0"
if not exist logs mkdir logs

echo [1/3] Starting MCP Server :8001 ...
start "offerp-mcp" cmd /c "cd apps\mcp && ..\worker\.venv\Scripts\python.exe server.py --port 8001"

echo [2/3] Starting Web :3000 ...
start "offerp-web" cmd /c "cd apps\web && npm run dev > ..\..\logs\web.log 2>&1"

timeout /t 3 /nobreak >nul
echo [3/3] Starting tunnels (web + mcp) ...
start "tunnel-web" cmd /c "cloudflared.exe tunnel --url http://localhost:3000 --no-autoupdate > logs\tunnel-web.log 2>&1"
timeout /t 2 /nobreak >nul
start "tunnel-mcp" cmd /c "cloudflared.exe tunnel --url http://localhost:8001 --no-autoupdate > logs\tunnel-mcp.log 2>&1"

echo.
echo All services starting. Run check_urls.bat to get public URLs.
