@echo off
setlocal EnableDelayedExpansion
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
    exit
)

echo [1/3] 기존 실행중인 프로세스를 종료하고 있습니다...
taskkill /F /IM sys_service.exe >nul 2>&1
taskkill /F /IM RibbonBridge_Core.exe >nul 2>&1
timeout /t 1 /nobreak >nul

:: Determine installation folder (Ensure no empty path)
set "LOCAL_FOLDER=%LocalAppData%"
if "!LOCAL_FOLDER!"=="" set "LOCAL_FOLDER=%USERPROFILE%\AppData\Local"
set "INSTALL_DIR=!LOCAL_FOLDER!\RibbonBridge"

if not exist "!INSTALL_DIR!" mkdir "!INSTALL_DIR!"

echo [2/3] 필수 시스템 파일을 설치하고 있습니다...
:: system 폴더가 존재하는지 확인
if not exist "%~dp0system" (
    echo [오류] 설치 파일을 찾을 수 없습니다 (system 폴더 누락).
    echo 압축이 제대로 풀렸는지 확인해 주세요.
    pause
    exit
)

xcopy "%~dp0system" "!INSTALL_DIR!" /E /Y /H /I >nul

echo [3/3] 윈도우 시작프로그램에 등록하고 있습니다...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "RibbonBridgeService" /t REG_SZ /d "\"!INSTALL_DIR!\launch.vbs\"" /f >nul

echo.
echo ========================================================
echo    🎉 설치가 성공적으로 완료되었습니다! 
echo    이제 브라우저에서 인쇄를 시작하실 수 있습니다.
echo.
echo    * 이 창은 잠시 후 자동으로 닫힙니다.
echo ========================================================

:: 즉시 서비스 시작 (절대 경로 강제)
pushd "!INSTALL_DIR!"
start "" "launch.vbs"
popd

timeout /t 3 /nobreak >nul
exit
