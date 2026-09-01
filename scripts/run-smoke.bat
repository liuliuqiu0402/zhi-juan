@echo off
cd /d "%~dp0.."
echo ==============================================
echo   Textbook browse function-calling smoke test
echo ==============================================
echo.
set "KEY="
set /p "KEY=Paste your DeepSeek API Key (starts with sk-): "
if "%KEY%"=="" (
  echo Cancelled.
  echo.
  pause
  exit /b
)
echo.
echo Calling engine, please wait ...
echo.
node "%~dp0function-calling-smoke.mjs" --key "%KEY%"
echo.
echo Done. Watch 3 signals: cacheHit / browse_textbook / no-thinking.
echo.
pause