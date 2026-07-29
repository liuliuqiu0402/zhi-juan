@echo off
setlocal enabledelayedexpansion
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

REM [1/4] Check Ollama
echo [1/4] Checking Ollama service...

REM Check if Ollama is running using PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$wc=New-Object Net.WebClient;try{$wc.DownloadString('http://localhost:11434/api/tags')|Out-Null;exit 0}catch{exit 1}" >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Ollama not running, starting with GPU support...
    
    REM Start Ollama from command line (GPU enabled)
    start "" /B cmd /c "ollama serve"
    
    REM Wait for Ollama to be ready (max 15 seconds)
    echo     Waiting for Ollama to be ready...
    set /a retries=0
    :wait_ollama
    timeout /t 2 /nobreak >nul
    
    REM Simple check: try to access the API
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$wc=New-Object Net.WebClient;try{$wc.DownloadString('http://localhost:11434/api/tags')|Out-Null;exit 0}catch{exit 1}" >nul 2>&1
    if !errorlevel! equ 0 (
        echo [+] Ollama is ready!
        goto ollama_ready
    ) else (
        set /a retries+=1
        if !retries! lss 8 goto wait_ollama
        echo [!] Ollama startup timeout, will retry when needed
    )
) else (
    echo [+] Ollama is running
)

:ollama_ready

REM [2/4] Start Vite dev server
echo [2/4] Starting Vite dev server...
echo.

REM [3/4] Launch Electron (npm runs in background)
echo [3/4] Launching Electron...
echo ========================================
echo   All services started!
echo   - Ollama: http://localhost:11434
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
