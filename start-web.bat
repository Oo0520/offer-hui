@echo off
REM Offer派 启动脚本：先杀端口 3000，再启动
echo [1/3] 杀掉占 3000 的进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo   杀 PID %%a
  taskkill /F /PID %%a 2>nul
)
timeout /t 3 /nobreak >nul

echo [2/3] 启动 Next.js...
cd /d E:\AIMemory\DaoBao\offer-hui\apps\web
start /B "" "C:\Program Files\nodejs\node.exe" node_modules\next\dist\bin\next start -p 3000 > ..\..\web-out.log 2> ..\..\web-err.log

echo [3/3] 等待...
timeout /t 8 /nobreak >nul
echo 完成: http://localhost:3000
