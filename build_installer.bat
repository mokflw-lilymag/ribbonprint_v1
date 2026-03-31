@echo off
setlocal
echo ==============================================
echo    RibbonBridge Universal Builder v25.0
echo ==============================================
echo.

:: 1. Compile C# Native Printing Engine
echo [1] Compiling C# Native Engine (ribbon_printer.exe)...
"%windir%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /out:RibbonBridge_Dist\ribbon_printer.exe ribbon_printer.cs
if %errorlevel% neq 0 (
  echo ERROR: printer engine compilation failed.
  pause & exit /b
)

:: 2. Compile Node.js Bridge Server
echo [2] Compiling Bridge Server (RibbonBridge_Core.exe)...
call npx pkg RibbonBridge_Dist\bridge_server.js --target node18-win-x64 --output RibbonBridge_Dist\RibbonBridge_Core.exe
if %errorlevel% neq 0 (
  echo ERROR: Bridge server packaging failed.
  pause & exit /b
)

:: 3. Prepare Package for Embedding
echo [3] Organizing Assets for Setup Package...
if exist "RibbonBridge_Final" rd /s /q "RibbonBridge_Final"
mkdir RibbonBridge_Final
mkdir RibbonBridge_Final\system

copy "RibbonBridge_Dist\RibbonBridge_Core.exe" "RibbonBridge_Final\system\" /Y
copy "RibbonBridge_Dist\ribbon_printer.exe" "RibbonBridge_Final\system\" /Y
copy "RibbonBridge_Dist\[필독_꽃집사장님]리본프린터_자동설치.bat" "RibbonBridge_Final\" /Y

:: Create Temporary ZIP (Limited to files we need)
if exist "RibbonBridge_Temp.zip" del "RibbonBridge_Temp.zip"
powershell -Command "Compress-Archive -Path 'RibbonBridge_Final\*' -DestinationPath 'RibbonBridge_Temp.zip' -Force"

:: 4. Compile Final EXE Installer with ZIP Embedded
echo [4] Building Final EXE Installer (RibbonBridge_Setup_v25.exe)...

:: References needed for RibbonInstaller.cs: System.IO.Compression, System.Windows.Forms, etc.
set "REFS=/r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll"
set "RES=/resource:RibbonBridge_Temp.zip,RibbonBridgePackage.zip"

"%windir%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /target:winexe /nologo /out:RibbonBridge_Setup_v25.exe %REFS% %RES% RibbonInstaller.cs

if %errorlevel% neq 0 (
  echo ERROR: Installer compilation failed.
  pause & exit /b
)

:: Clean up temporary files
if exist "RibbonBridge_Temp.zip" del "RibbonBridge_Temp.zip"
if exist "RibbonBridge_Final" rd /s /q "RibbonBridge_Final"

echo.
echo ==============================================
echo    ✅ ALL-IN-ONE BUILD SUCCESSFUL!
echo    Final File: RibbonBridge_Setup_v25.exe
echo.
echo    사용자(꽃집)에게 RibbonBridge_Setup_v25.exe 파일만 전달하세요.
echo ==============================================
echo.
pause
