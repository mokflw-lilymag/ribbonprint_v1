@echo off
setlocal EnableDelayedExpansion
title RibbonBridge v25.0 PREMIUM INSTALLER
color 0B

echo.
echo    ╔══════════════════════════════════════════════════════════════╗
echo    ║                                                              ║
echo    ║      🚀 리본프린터 브릿지 v25.0 - 꽃집 사장님용 자동설치     ║
echo    ║                                                              ║
echo    ╚══════════════════════════════════════════════════════════════╝
echo.

:: Check Admin Rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [경고] 관리자 권한이 필요합니다. 
    echo 이 파일을 '마우스 오른쪽 버튼' 클릭 후 '관리자 권한으로 실행'해 주세요.
    pause
    exit
)

if "%~dp0"=="%TEMP%\" (
    echo [오류] 압축을 풀지 않고 실행하셨습니다.
    echo 반드시 다운로드 받은 파일의 '압축을 풀기' 한 후 실행해 주세요.
    pause
    exit
)

set "INSTALL_DIR=%LocalAppData%\RibbonBridge"
echo [*] 설치 준비 중... (!INSTALL_DIR!)

:: 1. 기존 프로세스 종료
echo [1/4] 기존 실행중인 인쇄 서버를 정리합니다...
taskkill /F /IM RibbonBridge_Core.exe >nul 2>&1
taskkill /F /IM ribbon_printer.exe >nul 2>&1
timeout /t 1 /nobreak >nul

:: 2. 폴더 생성 및 파일 복사
echo [2/4] 시스템 파일을 안전한 위치에 복사합니다...
if not exist "!INSTALL_DIR!" mkdir "!INSTALL_DIR!"

:: system 폴더가 있으면 거기서, 아니면 현재 폴더에서 복사
if exist "%~dp0system" (
    xcopy "%~dp0system" "!INSTALL_DIR!" /E /Y /H /I >nul
) else (
    copy "%~dp0RibbonBridge_Core.exe" "!INSTALL_DIR!\" /Y >nul
    copy "%~dp0ribbon_printer.exe" "!INSTALL_DIR!\" /Y >nul
)

if not exist "!INSTALL_DIR!\RibbonBridge_Core.exe" (
    echo [오류] 파일을 찾을 수 없습니다. 백신 프로그램이 차단했는지 확인해 주세요.
    pause
    exit
)

:: 3. 윈도우 시작프로그램 등록
echo [3/4] 컴퓨터를 켤 때 자동으로 실행되도록 등록합니다...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "RibbonBridge" /t REG_SZ /d "\"!INSTALL_DIR!\RibbonBridge_Core.exe\"" /f >nul

:: 4. 방화벽 허용 (필요시)
echo [4/4] 네트워크 연결 설정을 확인합니다...
netsh advfirewall firewall add rule name="RibbonBridge" dir=in action=allow protocol=TCP localport=8000 profile=any >nul 2>&1

echo.
echo    ╔══════════════════════════════════════════════════════════════╗
echo    ║                                                              ║
echo    ║    🎉 설치가 완료되었습니다! 이제 자유롭게 인쇄하세요.       ║
echo    ║    지금 바로 인쇄 서버를 시작합니다...                       ║
echo    ║                                                              ║
echo    ╚══════════════════════════════════════════════════════════════╝
echo.

:: 5. 실행
start "" "!INSTALL_DIR!\RibbonBridge_Core.exe"

timeout /t 5 /nobreak >nul
exit
