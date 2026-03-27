@echo off
chcp 65001 >nul 2>&1
title RibbonBridge 설치
echo ========================================================
echo       리본 프린트 브릿지 자동 설치
echo ========================================================
echo.

echo [1/3] 기존 프로세스 종료 중...
taskkill /F /IM launch_service.exe >nul 2>&1
taskkill /F /IM sys_service.exe >nul 2>&1
timeout /t 2 /nobreak >nul

set "INSTALL_DIR=%LocalAppData%\RibbonBridge"
if "%LocalAppData%"=="" set "INSTALL_DIR=%USERPROFILE%\AppData\Local\RibbonBridge"

echo [2/3] 파일 복사 중... (%INSTALL_DIR%)
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: 현재 폴더의 exe, json 파일들을 설치 폴더로 복사
copy /Y "%~dp0sys_service.exe" "%INSTALL_DIR%\" >nul
copy /Y "%~dp0launch_service.exe" "%INSTALL_DIR%\" >nul
copy /Y "%~dp0drv_eps.exe" "%INSTALL_DIR%\" >nul
copy /Y "%~dp0drv_hp.exe" "%INSTALL_DIR%\" >nul
copy /Y "%~dp0printer_presets.json" "%INSTALL_DIR%\" >nul

if not exist "%INSTALL_DIR%\sys_service.exe" (
    echo [오류] 파일 복사 실패. 백신 프로그램을 일시 해제 후 재시도해 주세요.
    pause
    exit /b
)

echo [3/3] 시작프로그램 등록 중...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "RibbonBridgeService" /t REG_SZ /d "\"%INSTALL_DIR%\launch_service.exe\"" /f >nul

echo.
echo ========================================================
echo    설치 완료! 서비스를 시작합니다...
echo ========================================================

start "" "%INSTALL_DIR%\launch_service.exe"

timeout /t 3 /nobreak >nul
exit /b
