@echo off
chcp 65001 >nul
REM Offer派：重启网站 + 重启 cloudflared 隧道

echo === [1/4] 杀 3000 端口旧进程 ===
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo 杀 PID %%a
  taskkill /F /PID %%a 2>nul
)
timeout /t 3 /nobreak >nul

echo === [2/4] 启动 Next.js ===
cd /d E:\AIMemory\DaoBao\offer-hui\apps\web
start /B "" "C:\Program Files\nodejs\node.exe" node_modules\next\dist\bin\next start -p 3000 > ..\..\web-out.log 2> ..\..\web-err.log
timeout /t 8 /nobreak >nul

echo === [3/4] 杀旧 cloudflared ===
taskkill /F /IM cloudflared.exe 2>nul
timeout /t 2 /nobreak >nul

echo === [4/4] 启动新隧道 ===
cd /d E:\AIMemory\DaoBao\offer-hui
start /B "" cloudflared.exe tunnel --url http://localhost:3000 > cf-out.log 2> cf-err.log
timeout /t 12 /nobreak >nul

REM 提取新 URL
findstr /R "https://.*\.trycloudflare\.com" cf-err.log > cf-url.txt
type cf-url.txt
echo.
echo === 完成 ===
echo 本地: http://localhost:3000
