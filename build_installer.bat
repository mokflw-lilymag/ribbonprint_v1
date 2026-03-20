@echo off
echo ==============================================
echo    RibbonBridge Installer Builder (SaaS)
echo ==============================================
echo.

echo [1] Compiling C# Engine (ribbon_printer.exe)...
"%windir%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /out:ribbon_printer.exe ribbon_printer.cs
if %errorlevel% neq 0 (
  echo ERROR: Failed to compile C# engine.
  pause
  exit /b
)

echo [2] Checking 'pkg' module to compile Node.js server...
call npm list -g pkg >nul 2>&1
if %errorlevel% neq 0 (
  echo Installing pkg globally...
  call npm install -g pkg
)

echo [3] Compiling bridge_server.js to RibbonBridge_Core.exe...
call npx pkg bridge_server.js --target node18-win-x64 --output RibbonBridge_Core.exe

echo [4] Creating Dist folder...
if exist "RibbonBridge_Setup" rd /s /q "RibbonBridge_Setup"
mkdir RibbonBridge_Setup

copy RibbonBridge_Core.exe RibbonBridge_Setup\
copy ribbon_printer.exe RibbonBridge_Setup\

echo ==============================================
echo BUILD COMPLETE!
echo [INSTALL INSTRUCTIONS FOR FLORISTS]
echo Just zip 'RibbonBridge_Setup' and give it to florists.
echo They just double click 'RibbonBridge_Core.exe'.
echo ==============================================
pause
