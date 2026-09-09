@echo off
rem OfferPai one-click start: MCP Server + Web (PRODUCTION mode) + tunnels
rem Usage: start_all.bat  (URLs written to logs dir, check with check_urls.bat)
cd /d "%~dp0"
if not exist logs mkdir logs

echo [1/3] Starting MCP Server :8001 ...
start "offerp-mcp" cmd /c "cd apps\mcp && ..\worker\.venv\Scripts\python.exe server.py --port 8001"

echo [2/3] Starting Web :3000 (production) ...
if not exist "apps\web\.next\BUILD_ID" (
  start "offerp-web" cmd /c "cd apps\web && npm run build && npm start > ..\..\logs\web.log 2>&1"
) else (
  start "offerp-web" cmd /c "cd apps\web && npm start > ..\..\logs\web.log 2>&1"
)

timeout /t 5 /nobreak >nul
echo [3/3] Starting tunnels (web + mcp) ...
start "tunnel-web" cmd /c "cloudflared.exe tunnel --url http://localhost:3000 --no-autoupdate > logs\tunnel-web.log 2>&1"
timeout /t 2 /nobreak >nul
start "tunnel-mcp" cmd /c "cloudflared.exe tunnel --url http://localhost:8001 --no-autoupdate > logs\tunnel-mcp.log 2>&1"

echo.
echo All services starting (PRODUCTION mode). Run check_urls.bat to get public URLs.