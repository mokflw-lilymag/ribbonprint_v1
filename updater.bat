@echo off
echo ==============================================
echo RibbonBridge Auto Updater
echo ==============================================
echo Please wait...
timeout /t 2 /nobreak >nul
taskkill /F /IM sys_service.exe >nul 2>&1
taskkill /F /IM launch_service.exe >nul 2>&1

echo Downloading latest version...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/mokflw-lilymag/ribbonprint_v1/raw/main/RibbonBridge_Setup.zip' -OutFile 'update.zip' -TimeoutSec 60"

if not exist update.zip (
  echo Download failed!
  start "" "launch_service.exe"
  exit /b
)

echo Extracting...
powershell -Command "Expand-Archive -Path 'update.zip' -DestinationPath 'upd_tmp' -Force"

echo Applying update...
copy /Y upd_tmp\*.exe . >nul 2>&1
copy /Y upd_tmp\*.json . >nul 2>&1
for /d %%D in (upd_tmp\*) do (
  copy /Y "%%D\*.exe" "." >nul 2>&1
  copy /Y "%%D\*.json" "." >nul 2>&1
)
if exist upd_tmp rmdir /S /Q upd_tmp
if exist update.zip del update.zip

echo Starting new version...
start "" "launch_service.exe"
(goto) 2>nul & del "%~f0"