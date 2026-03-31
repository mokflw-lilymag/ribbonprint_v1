try {
    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host "   RibbonBridge Universal Builder v25.0" -ForegroundColor White
    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host ""

    $csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

    # 0. Clean previous builds
    Write-Host "[0] Cleaning old build artifacts..." -ForegroundColor Yellow
    $filesToClean = @("ribbon_printer.exe", "RibbonBridge_Core.exe", "launch_service.exe", "RibbonBridge_Setup_v25_0.exe", "RibbonBridgePackage.zip")
    foreach($f in $filesToClean) { if(Test-Path $f) { Remove-Item $f -Force } }

    # 1. Compile C# Native Printing Engine
    Write-Host "[1] Compiling C# Native GDI Engine (ribbon_printer.exe)..." -ForegroundColor Yellow
    $cscArgs = @("/target:exe", "/nologo", "/out:ribbon_printer.exe", "ribbon_printer.cs")
    Start-Process -FilePath $csc -ArgumentList $cscArgs -NoNewWindow -Wait
    if (-not (Test-Path "ribbon_printer.exe")) { throw "Failed to compile ribbon_printer.exe" }

    # 2. Compile Windows Service Watchdog (launch_service.exe)
    Write-Host "[2] Compiling Watchdog Service (launch_service.exe)..." -ForegroundColor Yellow
    $cscWatchdogArgs = @("/target:winexe", "/nologo", "/out:launch_service.exe", "RibbonLauncher.cs")
    Start-Process -FilePath $csc -ArgumentList $cscWatchdogArgs -NoNewWindow -Wait
    if (-not (Test-Path "launch_service.exe")) { throw "Failed to compile launch_service.exe" }

    # 3. Compile Node.js Bridge Server
    Write-Host "[3] Compiling Node.js Bridge Server via pkg (RibbonBridge_Core.exe)..." -ForegroundColor Yellow
    npx pkg bridge_server.js -t node18-win-x64 --output RibbonBridge_Core.exe
    if (-not (Test-Path "RibbonBridge_Core.exe")) { throw "Failed to compile RibbonBridge_Core.exe" }

    # 4. Prepare Package for Embedding
    Write-Host "[4] Preparing Package Bundle..." -ForegroundColor Yellow
    if (Test-Path "RibbonBridge_Final") { Remove-Item "RibbonBridge_Final" -Recurse -Force }
    New-Item -ItemType Directory -Path "RibbonBridge_Final\system" | Out-Null
    
    Copy-Item "RibbonBridge_Core.exe" -Destination "RibbonBridge_Final\system\" -Force
    Copy-Item "ribbon_printer.exe" -Destination "RibbonBridge_Final\system\" -Force
    Copy-Item "launch_service.exe" -Destination "RibbonBridge_Final\system\" -Force
    if(Test-Path "printer_presets.json") { Copy-Item "printer_presets.json" -Destination "RibbonBridge_Final\system\" -Force }
    if(Test-Path "ribbon_presets.json") { Copy-Item "ribbon_presets.json" -Destination "RibbonBridge_Final\system\" -Force }

    Compress-Archive -Path "RibbonBridge_Final\system\*" -DestinationPath "RibbonBridgePackage.zip" -Force
    Write-Host "  -> RibbonBridgePackage.zip successfully created." -ForegroundColor Green

    # 5. Compile Final Installer Box
    Write-Host "[5] Compiling RibbonBridge_Setup_v25_0.exe..." -ForegroundColor Yellow
    $cscInstallerArgs = @(
        "/target:winexe",
        "/nologo",
        "/out:RibbonBridge_Setup_v25_0.exe",
        "/resource:RibbonBridgePackage.zip",
        "/r:System.IO.Compression.dll",
        "/r:System.IO.Compression.FileSystem.dll",
        "/r:System.Windows.Forms.dll",
        "RibbonInstaller.cs"
    )
    Start-Process -FilePath $csc -ArgumentList $cscInstallerArgs -NoNewWindow -Wait
    if (-not (Test-Path "RibbonBridge_Setup_v25_0.exe")) { throw "Failed to compile RibbonBridge_Setup_v25_0.exe" }

    # 6. Deploy to Web Public
    Write-Host "[6] Deploying to Web Directory..." -ForegroundColor Yellow
    $publicDir = "ribbon-web\public"
    if (-not (Test-Path $publicDir)) { New-Item -ItemType Directory -Path $publicDir | Out-Null }
    Copy-Item "RibbonBridge_Setup_v25_0.exe" -Destination "$publicDir\RibbonBridge_Setup_v25_0.exe" -Force
    
    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host "   v25.0 BUILD COMPLETE!" -ForegroundColor Green
    Write-Host "   Deployment Path: $publicDir\RibbonBridge_Setup_v25_0.exe" -ForegroundColor White
    Write-Host "==============================================" -ForegroundColor Cyan


} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}
