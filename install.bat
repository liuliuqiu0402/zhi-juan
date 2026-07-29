@echo off
echo ========================================
echo   智卷工坊 · 依赖安装
echo ========================================
echo.
echo 📦 安装 Node.js 依赖...
call npm install
echo.
echo 📦 安装 Python 依赖...
call pip install PyMuPDF Pillow
echo.
echo ========================================
echo   ✅ 安装完成！
echo ========================================
pause