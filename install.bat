@echo off
echo ========================================
echo   智卷工坊 · 依赖安装
echo ========================================
echo.
echo 📦 安装 Node.js 依赖...
call npm install
echo.
echo 📦 安装 Python 依赖（必备，摘自 requirements.txt）...
call pip install -r requirements.txt
echo.
echo ℹ️ 如需本地 OCR（可选，体积较大），请另行执行：
echo    pip install -r requirements-ocr.txt
echo.
echo ========================================
echo   ✅ 安装完成！
echo ========================================
pause