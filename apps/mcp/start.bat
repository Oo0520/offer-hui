# Offer派 MCP Server 启动脚本（Windows）
# 依赖复用 apps/worker/.venv（已装 fastmcp）
@echo off
cd /d "%~dp0"
..\worker\.venv\Scripts\python.exe server.py %*
