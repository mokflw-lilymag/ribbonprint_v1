@echo off
chcp 65001 >nul 2>&1
title RibbonBridge 자동 설치기
echo ========================================================
echo       리본 프린트 브릿지 자동 설치를 시작합니다.
echo ========================================================
echo.

:: Ensure we are not running directly inside a zip file
if "%~dp0"=="%TEMP%\" (
    echo [경고] 압축을 풀지 않고 실행하셨습니다.
    echo 반드시 '압축 풀기'를 먼저 진행하신 후 실행해 주세요.
    pause
    exit /b
)

echo [1/4] 기존 실행중인 프로세스를 종료하고 있습니다...
taskkill /F /IM launch_service.exe >nul 2>&1
taskkill /F /IM sys_service.exe >nul 2>&1
taskkill /F /IM RibbonBridge_Core.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Determine installation folder (no delayed expansion needed)
set "INSTALL_DIR=%LocalAppData%\RibbonBridge"
if "%LocalAppData%"=="" set "INSTALL_DIR=%USERPROFILE%\AppData\Local\RibbonBridge"

echo [2/4] 설치 폴더: %INSTALL_DIR%
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo [3/4] 필수 시스템 파일을 설치하고 있습니다...
if not exist "%~dp0system" (
    echo [오류] 설치 파일을 찾을 수 없습니다 (system 폴더 누락).
    echo 압축이 제대로 풀렸는지 확인해 주세요.
    pause
    exit /b
)

:: Copy everything from system folder
xcopy "%~dp0system\*" "%INSTALL_DIR%\" /E /Y /H /I >nul

:: Verify critical files existence after copy
if not exist "%INSTALL_DIR%\sys_service.exe" (
    echo [오류] 핵심 파일 복사에 실패했습니다.
    echo 백신 프로그램이 차단했을 수 있습니다. 일시 해제 후 재시도해 주세요.
    pause
    exit /b
)
if not exist "%INSTALL_DIR%\launch_service.exe" (
    echo [오류] 런처 파일 복사에 실패했습니다.
    echo 백신 프로그램이 차단했을 수 있습니다. 일시 해제 후 재시도해 주세요.
    pause
    exit /b
)

echo [4/4] 윈도우 시작프로그램에 등록하고 있습니다...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "RibbonBridgeService" /t REG_SZ /d "\"%INSTALL_DIR%\launch_service.exe\"" /f >nul

echo.
echo ========================================================
echo    설치가 성공적으로 완료되었습니다!
echo    이제 브라우저에서 인쇄를 시작하실 수 있습니다.
echo.
echo    * 잠시 후 서비스가 자동으로 시작됩니다.
echo    * 설치 경로: %INSTALL_DIR%
echo ========================================================

:: 즉시 서비스 시작 (절대 경로 사용)
echo 서비스 시작 중...
start "" "%INSTALL_DIR%\launch_service.exe"

timeout /t 3 /nobreak >nul
exit /b
