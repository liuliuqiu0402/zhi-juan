@echo off
setlocal
chcp 65001 >nul 2>&1
title Wisdom Workshop

echo ========================================
echo   Wisdom Workshop - Starting...
echo ========================================
echo.

REM [0/4] 清理残留 Python 进程，释放 GPU 显存（仅清理本项目相关，不误杀其他 Python 程序）
echo [0/4] Cleaning GPU memory...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-WmiObject Win32_Process -Filter \"Name='python.exe' and CommandLine LIKE '%%paddleocr_vl_chat%%'\" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
echo [+] GPU memory released

REM [1/4] Check Ollama (可选：本应用当前走云端 API，未启动不影响使用)
echo [1/4] Checking Ollama service...

REM 只检测、不拉起：Ollama 未运行属正常情况
powershell -NoProfile -ExecutionPolicy Bypass -Command "$wc=New-Object Net.WebClient;try{$wc.DownloadString('http://localhost:11434/api/tags')|Out-Null;exit 0}catch{exit 1}" >nul 2>&1
if %errorlevel% neq 0 (
    echo [i] Ollama is not running - OK, the app uses cloud API.
    echo     Ollama is optional. If you need local models, run: ollama serve
) else (
    echo [+] Ollama is running
)

REM [2/4] Start Vite dev server
echo [2/4] Starting Vite dev server...
echo.

REM [3/4] Launch Electron (npm runs in background)
echo [3/4] Launching Electron...
echo ========================================
echo   All services started!
echo   - Models: cloud API (Ollama optional)
echo   - App: Opening...
echo ========================================
echo.

REM npm runs in background, no extra window
start "" /B cmd /c "npm start"

echo.
echo [+] Startup complete!
echo     Tip: This window shows logs, you can minimize it
echo     Electron app window is opening...
echo     To check GPU status: run check_gpu.bat
echo.
pause
