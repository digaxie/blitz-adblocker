@echo off
chcp 65001 >nul
title Blitz.gg Restore to Factory Default

echo ====================================================
echo        Blitz.gg Restore to Factory Default
echo ====================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA / ERROR]
    echo Node.js sisteminizde kurulu bulunamadı!
    echo Node.js is not installed on your system!
    echo.
    pause
    exit /b 1
)

echo [*] Geri yükleme başlatılıyor / Starting restore...
node restore.js

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
