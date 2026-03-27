@echo off
setlocal
chcp 65001 >nul 2>&1
title RibbonBridge v11.0 최신 설치 및 복구

echo ========================================================
echo       리본 프린트 브릿지 [v11.0] 자동 설치 및 복구
echo ========================================================
echo.

:: 1. 기존 프로세스 청소
echo [1/4] 기존 프로세스 종료 중...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *bridge*" >nul 2>&1
taskkill /F /IM RibbonBridge_Core.exe >nul 2>&1
taskkill /F /IM launch_service.exe >nul 2>&1
taskkill /F /IM sys_service.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: 2. 설치 경로 설정
set "INSTALL_DIR=%LocalAppData%\RibbonBridge"
if "%LocalAppData%"=="" set "INSTALL_DIR=%USERPROFILE%\AppData\Local\RibbonBridge"
echo [2/4] 설치 폴더 준비: %INSTALL_DIR%
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: 3. 최신 엔진 파일 복사 (가장 중요)
echo [3/4] 최신 엔진 및 설정 파일 복사 중...
copy /Y "%~dp0bridge_server.js" "%INSTALL_DIR%\" >nul 2>&1
copy /Y "%~dp0package.json" "%INSTALL_DIR%\" >nul 2>&1
copy /Y "%~dp0printer_presets.json" "%INSTALL_DIR%\" >nul 2>&1
copy /Y "%~dp0RibbonInstaller.cs" "%INSTALL_DIR%\" >nul 2>&1

:: 기존 exe 방식 호환용 (필요한 경우)
if exist "%~dp0sys_service.exe" copy /Y "%~dp0sys_service.exe" "%INSTALL_DIR%\" >nul 2>&1
if exist "%~dp0launch_service.exe" copy /Y "%~dp0launch_service.exe" "%INSTALL_DIR%\" >nul 2>&1

:: 파일 체크
if not exist "%INSTALL_DIR%\bridge_server.js" (
    echo.
    echo [경고] bridge_server.js 파일을 찾을 수 없습니다!
    echo 압축을 모두 푼 다음, 다시 실행해 주세요.
    pause
    exit /b
)

:: 4. 레지스트리 서비스 등록 (부팅 시 자동 실행)
echo [4/4] 윈도우 시작 프로그램 등록 중...
:: VBS 스크립트를 생성하여 검은 창 없이 백그라운드에서 실행되게 설정
set "VBS_PATH=%INSTALL_DIR%\run_bridge.vbs"
echo CreateObject("WScript.Shell").Run "node """ ^& WScript.Arguments(0) ^& """ --silent", 0, False > "%VBS_PATH%"

:: 레지스트리 등록 (VBS를 통해 bridge_server.js 실행)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "RibbonBridgeService_v11" /t REG_SZ /d "wscript.exe \"%VBS_PATH%\" \"%INSTALL_DIR%\bridge_server.js\"" /f >nul 2>&1

echo.
echo ========================================================
echo    설치가 완료되었습니다!
echo    [v11.0] 새로운 연속 인쇄(리본 로딩 방지) 기능이 적용되었습니다.
echo ========================================================
echo.

:: 즉시 실행
start "" wscript.exe "%VBS_PATH%" "%INSTALL_DIR%\bridge_server.js"

echo 잠시 후 인쇄를 시도해 보세요.
timeout /t 3 /nobreak >nul
exit /b
