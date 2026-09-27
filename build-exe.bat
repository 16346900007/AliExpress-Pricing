@echo off
chcp 65001 >nul
title AE Pricing Build
cd /d "F:\AliExpress Pricing"
nvm use 22.16.0
echo Building AE Pricing exe...
echo.
pnpm tauri build
echo.
echo Done! Installer: src-tauri\target\release\bundle\nsis\
pause
