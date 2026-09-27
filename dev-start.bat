@echo off
chcp 65001 >nul
title AE Pricing
cd /d "F:\AliExpress Pricing"
echo Switching to Node 22...
nvm use 22.16.0
echo Starting AE Pricing (Vite + Tauri)...
pnpm tauri dev
pause
