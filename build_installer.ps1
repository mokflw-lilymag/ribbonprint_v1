try {
    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host "   RibbonBridge Universal Builder v23.1" -ForegroundColor White
    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host ""

    $csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

    # 1. Compile C# Native Printing Engine
    Write-Host "[1] Compiling C# Native Engine (ribbon_printer.exe)..." -ForegroundColor Yellow
    $cscArgs = @("/target:exe", "/nologo", "/out:ribbon_printer.exe", "ribbon_printer.cs")
    Start-Process -FilePath $csc -ArgumentList $cscArgs -NoNewWindow -Wait

    if (-not (Test-Path "ribbon_printer.exe")) {
        throw "Failed to compile ribbon_printer.exe"
    }
    Write-Host "  -> ribbon_printer.exe successfully built." -ForegroundColor Green
    Write-Host ""

    # 2. Compile Node.js Bridge Server
    Write-Host "[2] Compiling Node.js Bridge Server via pkg (RibbonBridge_Core.exe)..." -ForegroundColor Yellow
    npx pkg bridge_server.js -t node18-win-x64 --output RibbonBridge_Core.exe
    if (-not (Test-Path "RibbonBridge_Core.exe")) {

        throw "Failed to compile RibbonBridge_Core.exe via pkg"
    }
    Write-Host "  -> RibbonBridge_Core.exe successfully built." -ForegroundColor Green
    Write-Host ""

    # 3. Prepare Package for Embedding
    Write-Host "[3] Preparing Package for Setup..." -ForegroundColor Yellow
    if (Test-Path "RibbonBridgePackage.zip") { Remove-Item "RibbonBridgePackage.zip" -Force }
    if (Test-Path "RibbonBridge_Final") { Remove-Item "RibbonBridge_Final" -Recurse -Force }
    
    New-Item -ItemType Directory -Path "RibbonBridge_Final\system" | Out-Null
    Copy-Item "RibbonBridge_Core.exe" -Destination "RibbonBridge_Final\system\" -Force
    Copy-Item "ribbon_printer.exe" -Destination "RibbonBridge_Final\system\" -Force

    Compress-Archive -Path "RibbonBridge_Final\system" -DestinationPath "RibbonBridgePackage.zip" -Force
    Write-Host "  -> RibbonBridgePackage.zip successfully created." -ForegroundColor Green
    Write-Host ""

    # 4. Compile Installer Box with ZIP Embedded
    Write-Host "[4] Compiling RibbonBridge_Setup_v23_1.exe Installer..." -ForegroundColor Yellow
    $cscInstallerArgs = @(
        "/target:winexe",
        "/nologo",
        "/out:RibbonBridge_Setup_v23_1.exe",
        "/resource:RibbonBridgePackage.zip",
        "/r:System.IO.Compression.dll",
        "/r:System.IO.Compression.FileSystem.dll",
        "/r:System.Windows.Forms.dll",
        "RibbonInstaller.cs"
    )
    Start-Process -FilePath $csc -ArgumentList $cscInstallerArgs -NoNewWindow -Wait

    if (-not (Test-Path "RibbonBridge_Setup_v23_1.exe")) {
        throw "Failed to compile RibbonBridge_Setup_v23_1.exe"
    }
    Write-Host "  -> RibbonBridge_Setup_v23_1.exe successfully built." -ForegroundColor Green
    Write-Host ""

    # 5. Distribute Application
    Write-Host "[5] Distributing Setup File to web public directory..." -ForegroundColor Yellow
    if (-not (Test-Path "ribbon-web\public")) {
        New-Item -ItemType Directory -Path "ribbon-web\public" | Out-Null
    }
    Copy-Item "RibbonBridge_Setup_v23_1.exe" -Destination "ribbon-web\public\RibbonBridge_Setup_v23_1.exe" -Force
    Write-Host "  -> Successfully deployed to ribbon-web\public." -ForegroundColor Green
    Write-Host ""

    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host "   ALL-IN-ONE BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "   Final File: RibbonBridge_Setup_v23_1.exe" -ForegroundColor White
    Write-Host "==============================================" -ForegroundColor Cyan

} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}
