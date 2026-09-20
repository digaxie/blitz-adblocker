@echo off
chcp 65001 >nul
title Blitz.gg Ad-Blocker & Optimizer

echo ====================================================
echo        Blitz.gg Ad-Blocker & Optimizer Setup
echo ====================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA / ERROR]
    echo Node.js sisteminizde kurulu bulunamadı!
    echo Node.js is not installed on your system!
    echo.
    echo Lütfen https://nodejs.org adresinden kurup tekrar deneyin.
    echo Please install Node.js from https://nodejs.org and try again.
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [*] Gerekli bağımlılıklar yükleniyor / Installing dependencies...
    call npm install --silent
)

echo.
echo [*] Yama başlatılıyor / Starting patcher...
node patch.js

if %errorlevel% equ 0 (
    echo.
    echo [?] Blitz başlatılsın mı? / Launch Blitz now? (E/H - Y/N)
    set /p launchChoice="> "
    if /i "%launchChoice%"=="e" (
        start "" "%LOCALAPPDATA%\Programs\Blitz\Blitz.exe"
    ) else if /i "%launchChoice%"=="y" (
        start "" "%LOCALAPPDATA%\Programs\Blitz\Blitz.exe"
    )
)

echo.
pause
