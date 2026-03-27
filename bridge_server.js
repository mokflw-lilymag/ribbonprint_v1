const express = require('express');
const cors = require('cors');
const { exec, execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json({ limit: '70mb' }));

// ─── Engine Paths ──────────────────────────────────────────
const EPSON_AGENT = path.resolve(__dirname, 'drv_eps.exe');
const HP_AGENT    = path.resolve(__dirname, 'drv_hp.exe');
const HAS_EPSON   = fs.existsSync(EPSON_AGENT);
const HAS_HP      = fs.existsSync(HP_AGENT);

console.log('╔══════════════════════════════════════════════════╗');
console.log('║   RibbonBridge v6.1 - Universal Print Engine    ║');
console.log('║   Epson ESC/P + HP PCL5 + GDI Fallback          ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log(`> Platform: ${os.platform()} ${os.release()}`);
console.log(`> Node.js: ${process.version}`);
console.log(`> Epson Engine: ${HAS_EPSON ? '✅ READY' : '❌ NOT FOUND'}`);
console.log(`> HP Engine:    ${HAS_HP    ? '✅ READY' : '❌ NOT FOUND'}`);
console.log(`> GDI Fallback: ✅ ALWAYS AVAILABLE (Windows built-in)`);

// ─── Printer Presets ────────────────────────────────────────
let PRESETS = { models: {}, defaults: { epson: { leftMargin: 34.5 }, hp: { leftMargin: 34.5 }, other: { leftMargin: 34.5 } } };
try {
  const presetsPath = path.resolve(__dirname, 'printer_presets.json');
  if (fs.existsSync(presetsPath)) {
    PRESETS = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
    const modelCount = Object.keys(PRESETS.models).length;
    console.log(`> Presets: ✅ ${modelCount} printer models loaded`);
  } else {
    console.log(`> Presets: ⚠️ printer_presets.json not found, using defaults`);
  }
} catch (e) {
  console.log(`> Presets: ⚠️ Parse error: ${e.message}`);
}

// Find matching preset for a printer name (fuzzy matching)
function findPreset(printerName) {
  const nameLower = (printerName || '').toLowerCase();
  
  // 1. Exact model match
  for (const [model, preset] of Object.entries(PRESETS.models)) {
    if (nameLower.includes(model.toLowerCase())) {
      return { ...preset, matchedModel: model };
    }
  }
  
  // 2. Partial match: extract model numbers
  for (const [model, preset] of Object.entries(PRESETS.models)) {
    // Extract numbers from model name (e.g., "HP OfficeJet 8100" → "8100")
    const modelNums = model.match(/\d{3,}/g);
    if (modelNums) {
      for (const num of modelNums) {
        if (nameLower.includes(num)) {
          return { ...preset, matchedModel: model + ' (partial)' };
        }
      }
    }
  }
  
  // 3. Brand defaults
  const brand = detectBrand(printerName, '');
  const defaults = PRESETS.defaults[brand] || PRESETS.defaults.other;
  return { ...defaults, matchedModel: `${brand} default` };
}

// ─── Brand Detection ────────────────────────────────────────
function detectBrand(printerName, driverName) {
  const name = ((printerName || '') + ' ' + (driverName || '')).toLowerCase();
  
  if (name.includes('epson'))    return 'epson';
  if (name.includes('hp') || name.includes('hewlett') || name.includes('packard') 
      || name.includes('deskjet') || name.includes('officejet') || name.includes('laserjet')
      || name.includes('envy') || name.includes('photosmart') || name.includes('smart tank'))
    return 'hp';
  if (name.includes('canon') || name.includes('pixma') || name.includes('imageclass'))
    return 'canon';
  if (name.includes('brother'))  return 'brother';
  if (name.includes('samsung') || name.includes('xpress'))
    return 'samsung';
  
  return 'other';
}

function getEngineStrategy(brand) {
  switch (brand) {
    case 'epson':
      return HAS_EPSON 
        ? { engine: 'escp', agent: EPSON_AGENT, label: 'Epson ESC/P RAW' }
        : { engine: 'gdi',  agent: null,        label: 'GDI Fallback (Epson agent missing)' };
    case 'hp':
      return HAS_HP
        ? { engine: 'pcl5', agent: HP_AGENT,    label: 'HP PCL5 RAW' }
        : { engine: 'gdi',  agent: null,        label: 'GDI Fallback (HP agent missing)' };
    default:
      return { engine: 'gdi', agent: null, label: `GDI Fallback (${brand})` };
  }
}

// ─── Health Check ──────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '6.2',
    message: 'RibbonBridge Universal Engine Active',
    engines: {
      epson_escp: HAS_EPSON,
      hp_pcl5: HAS_HP,
      gdi_fallback: true
    },
    uptime: Math.floor(process.uptime()),
    platform: os.platform()
  });
});

// ─── Font Directory ─────────────────────────────────────────
const WINDOWS_FONT_DIR = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');

app.get('/api/fonts', (req, res) => {
  try {
    const fontExtensions = ['.ttf', '.otf', '.ttc', '.woff', '.woff2'];
    const fonts = [];

    if (fs.existsSync(WINDOWS_FONT_DIR)) {
      const files = fs.readdirSync(WINDOWS_FONT_DIR);
      for (const f of files) {
        const ext = path.extname(f).toLowerCase();
        if (fontExtensions.includes(ext)) {
          try {
            const fullPath = path.join(WINDOWS_FONT_DIR, f);
            const stat = fs.statSync(fullPath);
            fonts.push({
              filename: f,
              name: path.parse(f).name,
              size_kb: Math.round(stat.size / 1024 * 10) / 10,
              extension: ext
            });
          } catch (e) { /* skip unreadable */ }
        }
      }
    }

    fonts.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    res.json({ status: 'success', count: fonts.length, fonts });
  } catch (err) {
    res.json({ status: 'error', message: err.message });
  }
});

app.get('/api/fonts/file/:fontFilename', (req, res) => {
  try {
    const safeName = path.basename(req.params.fontFilename);
    const fontPath = path.join(WINDOWS_FONT_DIR, safeName);
    if (!fs.existsSync(fontPath)) {
      return res.status(404).json({ status: 'error', message: `Font not found: ${safeName}` });
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    fs.createReadStream(fontPath).pipe(res);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── Printer Cache ──────────────────────────────────────────
let cachedPrinterInfo = {}; // { printerName: { brand, driver, ... } }

app.get('/api/printers', (req, res) => {
  try {
    const psCommand = `powershell -NoProfile -Command "Get-Printer | Select-Object Name, PrinterStatus, DriverName, PortName | ConvertTo-Json -Compress"`;
    const output = execSync(psCommand, { timeout: 10000, encoding: 'utf8' });
    let printers = JSON.parse(output || '[]');
    if (!Array.isArray(printers)) printers = [printers];

    const data = printers
      .filter(p => p.Name)
      .map(p => {
        const brand = detectBrand(p.Name, p.DriverName);
        const strategy = getEngineStrategy(brand);
        
        // Cache for later print routing
        cachedPrinterInfo[p.Name] = { brand, driver: p.DriverName || '' };
        
        return {
          name: p.Name,
          status: p.PrinterStatus === 0 ? 'Ready' : (p.PrinterStatus === 1 ? 'Paused' : 'Busy'),
          model: p.Name,
          brand,
          driver: p.DriverName || '',
          port: p.PortName || '',
          engine: strategy.label  // 사용자에게 어떤 엔진이 사용될지 표시
        };
      });

    console.log(`[PRINTERS] Found ${data.length} printers:`,
      data.map(p => `${p.name} (${p.brand}→${p.engine})`).join(', ')
    );
    res.json({ status: 'success', data });
  } catch (err) {
    console.error('[PRINTERS] Error:', err.message);
    // WMI Fallback
    try {
      const wmiCommand = `powershell -NoProfile -Command "Get-WmiObject -Query 'SELECT Name FROM Win32_Printer' | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress"`;
      const wmiOutput = execSync(wmiCommand, { timeout: 10000, encoding: 'utf8' });
      let names = JSON.parse(wmiOutput || '[]');
      if (!Array.isArray(names)) names = [names];
      const data = names.filter(n => n).map(n => {
        const brand = detectBrand(n, '');
        const strategy = getEngineStrategy(brand);
        cachedPrinterInfo[n] = { brand, driver: '' };
        return { name: n, status: 'Ready', model: n, brand, driver: '', port: '', engine: strategy.label };
      });
      res.json({ status: 'success', data });
    } catch (err2) {
      res.json({ status: 'error', message: err2.message });
    }
  }
});

// ─── Auto-Pairing ──────────────────────────────────────────
app.post('/api/pair', (req, res) => {
  const { user_id } = req.body || {};
  if (user_id) {
    console.log(`[PAIR] Paired with user: ${user_id.substring(0, 8)}...`);
  }
  res.json({ status: 'success', message: 'Paired ok' });
});

// ─── UNIVERSAL PRINT ENGINE ────────────────────────────────
app.post('/api/print_image', async (req, res) => {
  const { printer_name, image_base64, width_mm, length_mm, margin_offset_mm } = req.body;

  if (!printer_name || !image_base64) {
    return res.status(400).json({ status: 'error', message: 'Missing printer_name or image_base64' });
  }

  const tmpDir = path.join(os.tmpdir(), 'ribbon-saas');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const tmpFilePath = path.join(tmpDir, `${jobId}.png`);
  
  try {
    // 1. Decode & Save Image
    const image_data = image_base64.split(',')[1];
    if (!image_data) {
      return res.json({ status: 'error', message: 'Invalid image_base64 format' });
    }
    fs.writeFileSync(tmpFilePath, Buffer.from(image_data, 'base64'));

    const fileSizeKB = Math.round(fs.statSync(tmpFilePath).size / 1024);

    // 2. Detect brand & strategy
    const cached = cachedPrinterInfo[printer_name];
    let detectedBrand = cached ? cached.brand : detectBrand(printer_name, '');
    
    // 2.5 Find preset & Merge Settings
    const preset = findPreset(printer_name);
    
    // [Fix] If brand detection missed it but preset has a brand, use that!
    if ((detectedBrand === 'other' || !detectedBrand) && preset.brand) {
      detectedBrand = preset.brand;
    }
    const brand = detectedBrand;
    const strategy = getEngineStrategy(brand);
    
    const leftMargin = preset.leftMargin || 34.5;
    const userOffset = parseFloat(margin_offset_mm) || 0;
    
    // effectiveLeftMargin is the physical distance from head 0 point to the ribbon's left edge
    const effectiveLeftMargin = leftMargin + userOffset;
    
    // marginCenter is used by Raw engines (ESC/P, PCL5)
    const marginCenter = effectiveLeftMargin + (width_mm / 2.0);

    // [Fix] Determine final engine (Preset preference > Brand heuristic)
    let finalEngine = strategy.engine;
    if (preset.engine && preset.engine !== 'gdi') {
       if (preset.engine === 'escp' && HAS_EPSON) finalEngine = 'escp';
       if (preset.engine === 'pcl5' && HAS_HP) finalEngine = 'pcl5';
    }

    console.log(`[PRINT] ─── Job ${jobId} ──────────────────`);
    console.log(`[PRINT] Printer: ${printer_name}`);
    console.log(`[PRINT] Brand: ${brand.toUpperCase()} | Engine: ${finalEngine}`);
    console.log(`[PRINT] Preset: ${preset.matchedModel} (Base: ${leftMargin}mm, UserOffset: ${userOffset}mm)`);
    console.log(`[PRINT] Eff. Left Margin: ${effectiveLeftMargin.toFixed(1)}mm | Margin Center: ${marginCenter.toFixed(1)}mm`);
    console.log(`[PRINT] Size: ${width_mm}x${length_mm}mm | Image: ${fileSizeKB}KB`);

    // 3. Route to appropriate engine
    if (finalEngine === 'escp' || finalEngine === 'pcl5') {
      const agent = (finalEngine === 'escp') ? EPSON_AGENT : HP_AGENT;
      // 5th argument = margin_center_mm
      const command = `"${agent}" "${printer_name}" "${tmpFilePath}" ${width_mm} ${length_mm} ${marginCenter.toFixed(1)}`;
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Print timeout (60s). Check printer connection.'));
        }, 60000);

        exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
          clearTimeout(timeout);
          try { fs.unlinkSync(tmpFilePath); } catch (e) {}

          if (error) {
            const errMsg = (stderr || stdout || error.message).trim();
            console.error(`[PRINT] ${finalEngine.toUpperCase()} Error: ${errMsg}`);
            
            // Native engine failed → try GDI fallback
            console.log(`[PRINT] ⚠️ Native engine failed, attempting GDI fallback...`);
            printViaGDI(printer_name, tmpFilePath, width_mm, length_mm, jobId, effectiveLeftMargin)
              .then(() => {
                console.log(`[PRINT] ✅ GDI Fallback succeeded for ${jobId}`);
                resolve();
              })
              .catch((gdiErr) => {
                reject(new Error(`Native(${errMsg}) + GDI(${gdiErr.message}) both failed`));
              });
            return;
          }

          if (stdout && stdout.includes('SUCCESS')) {
            console.log(`[PRINT] ✅ ${finalEngine.toUpperCase()} Success`);
            resolve();
          } else {
            console.error(`[PRINT] Unexpected output: ${stdout}`);
            reject(new Error(`${finalEngine} failed: ${(stdout || 'No output').trim()}`));
          }
        });
      });

      return res.json({ status: 'success', method: finalEngine, brand });

    } else {
      // ── GDI Fallback ──
      // [Fix] Pass effectiveLeftMargin to GDI
      await printViaGDI(printer_name, tmpFilePath, width_mm, length_mm, jobId, effectiveLeftMargin);
      return res.json({ status: 'success', method: 'gdi', brand });
    }

  } catch (err) {
    try { fs.unlinkSync(tmpFilePath); } catch (e) {}
    console.error(`[PRINT] ❌ Final error for ${jobId}:`, err.message);
    res.json({ status: 'error', message: err.message });
  }
});

// ─── GDI PrintDocument Fallback ──────────────────────────────
function printViaGDI(printerName, imagePath, widthMM, lengthMM, jobId, leftMarginMM = 0) {
  // Re-create temp file if already deleted (for fallback path)
  const tempExists = fs.existsSync(imagePath);
  
  return new Promise((resolve, reject) => {
    const psScript = `
      Add-Type -AssemblyName System.Drawing
      
      $printerName = '${printerName.replace(/'/g, "''")}'
      $imagePath = '${(tempExists ? imagePath : '').replace(/\\/g, '\\\\').replace(/'/g, "''")}'
      $widthMM = ${widthMM}
      $lengthMM = ${lengthMM}
      $leftMarginMM = ${leftMarginMM}
      
      if (-not (Test-Path $imagePath)) {
        Write-Error "Image file not found: $imagePath"
        exit 1
      }
      
      try {
        $img = [System.Drawing.Image]::FromFile($imagePath)
        
        $pd = New-Object System.Drawing.Printing.PrintDocument
        $pd.PrinterSettings.PrinterName = $printerName
        
        if (-not $pd.PrinterSettings.IsValid) {
          Write-Error "Printer not found or invalid: $printerName"
          exit 1
        }
        
        # Custom paper size in 100ths of an inch
        $w100 = [int]($widthMM / 25.4 * 100)
        $h100 = [int]($lengthMM / 25.4 * 100)
        $offsetX100 = [int]($leftMarginMM / 25.4 * 100)
        
        # We set the total PaperWidth to include the offset area (Physical feeding width)
        # Most ribbon printers feed 100mm wide paper
        $totalWidth100 = $offsetX100 + $w100
        
        $customPaper = New-Object System.Drawing.Printing.PaperSize("RibbonCustom", $totalWidth100, $h100)
        $pd.DefaultPageSettings.PaperSize = $customPaper
        $pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
        $pd.DefaultPageSettings.Landscape = $false
        
        $printed = $false
        $handler = {
          param($sender, $e)
          if (-not $printed) {
            # Draw with horizontal offset for exact alignment
            $destRect = New-Object System.Drawing.Rectangle($offsetX100, 0, $w100, $h100)
            $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $e.Graphics.DrawImage($img, $destRect)
            $printed = $true
          }
          $e.HasMorePages = $false
        }
        
        $pd.add_PrintPage($handler)
        $pd.Print()
        $img.Dispose()
        $pd.Dispose()
        
        Write-Output "GDI_SUCCESS"
      } catch {
        Write-Error $_.Exception.Message
        exit 1
      }
    `;
    
    const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
      timeout: 30000
    });
    
    let stdout = '', stderr = '';
    ps.stdout.on('data', (data) => { stdout += data.toString(); });
    ps.stderr.on('data', (data) => { stderr += data.toString(); });
    
    ps.on('close', (code) => {
      try { fs.unlinkSync(imagePath); } catch (e) {}
      
      if (code === 0 && stdout.includes('GDI_SUCCESS')) {
        console.log(`[PRINT] ✅ GDI Success for ${jobId}`);
        resolve();
      } else {
        console.error(`[PRINT] GDI Error: ${stderr || stdout}`);
        reject(new Error(`GDI: ${(stderr || stdout || 'Unknown error').trim()}`));
      }
    });
    
    ps.on('error', (err) => {
      try { fs.unlinkSync(imagePath); } catch (e) {}
      reject(err);
    });
  });
}

// ─── Auto Updater ──────────────────────────────────────────
app.post('/api/update', (req, res) => {
  res.json({ status: 'ok', message: 'Update initiated' });
  console.log(`\n> 📥 UPDATE INITIATED: Downloading new version from GitHub...`);
  
  const batPath = path.join(process.cwd(), 'updater.bat');
  const batLogic = `@echo off
echo ==============================================
echo RibbonBridge Auto Updater (v6.1+)
echo ==============================================
echo Please wait... Waiting for server to stop...
timeout /t 2 /nobreak >nul
taskkill /F /IM sys_service.exe >nul 2>&1

echo Downloading latest version from cloud...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/mokflw-lilymag/ribbonprint_v1/raw/main/RibbonBridge_Setup.zip' -OutFile 'update.zip'"

echo Extracting update...
powershell -Command "Expand-Archive -Path 'update.zip' -DestinationPath 'upd_tmp' -Force"

echo Applying update...
:: Copy files from the "system" folder inside the zip to the current installation folder
xcopy /Y /E "upd_tmp\\system\\*" "." >nul
rmdir /S /Q upd_tmp
del update.zip

echo Starting new version...
start "" "launch_service.exe"
(goto) 2>nul & del "%~f0"`;

  fs.writeFileSync(batPath, batLogic);
  
  setTimeout(() => {
    const childProcess = spawn('cmd.exe', ['/c', batPath], {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd()
    });
    childProcess.unref();
    process.exit(0);
  }, 1000);
});

// ─── Status / Diagnostics ──────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    version: '6.2',
    uptime: Math.floor(process.uptime()),
    engines: {
      epson_escp: { available: HAS_EPSON, path: EPSON_AGENT },
      hp_pcl5:    { available: HAS_HP,    path: HP_AGENT },
      gdi:        { available: true,      path: 'Windows built-in' }
    },
    cached_printers: Object.keys(cachedPrinterInfo).length,
    temp_dir: path.join(os.tmpdir(), 'ribbon-saas'),
    node_version: process.version,
    platform: `${os.platform()} ${os.release()}`,
    memory: {
      used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total_mb: Math.round(os.totalmem() / 1024 / 1024)
    }
  });
});

// ─── Start Server ──────────────────────────────────────────
app.listen(port, '127.0.0.1', () => {
  console.log(`\n> 🚀 RibbonBridge v6.1 listening on http://localhost:${port}`);
  console.log(`>`);
  console.log(`> Print Strategy:`);
  console.log(`>   Epson → ESC/P RAW (roll mode, unlimited length)`);
  console.log(`>   HP    → PCL5 RAW (custom paper, full control)`);
  console.log(`>   Other → GDI PrintDocument (driver-based)`);
  console.log(`>   All   → Auto GDI fallback on native failure`);
  console.log(`>`);
  console.log(`> Ready for print jobs! 🖨️`);
});
