@echo off
chcp 65001 >nul 2>&1
title Ollama GPU Status Check

echo ========================================
echo   Ollama GPU Status Check
echo ========================================
echo.

REM Check if Ollama is running
powershell -NoProfile -ExecutionPolicy Bypass -Command "$wc=New-Object Net.WebClient;try{$wc.DownloadString('http://localhost:11434/api/tags')|Out-Null;exit 0}catch{exit 1}" >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Ollama service is not running!
    echo.
    echo     Please start Ollama first:
    echo     1. Run start.bat from project directory
    echo     2. Or run: ollama serve
    echo.
    pause
    exit /b 1
)

echo [+] Ollama service is running
echo.
echo Current loaded models:
echo ----------------------------------------
ollama ps
echo ----------------------------------------
echo.

REM Check GPU status
ollama ps 2>nul | findstr "GPU" >nul
if %errorlevel% equ 0 (
    echo [✅] GPU acceleration is ACTIVE
) else (
    ollama ps 2>nul | findstr "CPU" >nul
    if %errorlevel% equ 0 (
        echo [!] WARNING: Running on CPU mode!
        echo     To enable GPU:
        echo     1. Quit Ollama from tray icon
        echo     2. Run: ollama serve
    ) else (
        echo [i] No models loaded yet
        echo     Models will load on first use
    )
)

echo.
echo Tip: Models are loaded on-demand when you use AI features
echo.
pause
