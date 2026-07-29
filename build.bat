@echo off
chcp 65001 >nul
echo ========================================
echo   智卷工坊 · 安装包构建
echo ========================================
echo.
echo 📦 正在构建前端资源...
call npm run build
echo.
echo 🚀 正在打包 Electron 应用...
call npm run dist
echo.
echo ========================================
echo   ✅ 构建完成！
echo ========================================
echo.
echo 📁 安装包位于 release\ 目录下
echo.
pause