// ═══════════════════════════════════════════════════════════════
//   RibbonBridge v7.0 — Production-Grade Universal Print Engine
//   Epson ESC/P · HP PCL5 · GDI Fallback · Self-Updater
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const cors    = require('cors');
const { exec, execSync, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ─── Constants ─────────────────────────────────────────────────
const VERSION    = '7.6';
const PORT       = 8000;
const TMP_DIR    = path.join(os.tmpdir(), 'ribbon-saas');
const FONT_DIR   = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');

// ★ [CRITICAL] `pkg`로 빌드된 환경인지 확인하여 물리 디스크의 실제 경로를 계산합니다.
// pkg 환경에서는 __dirname이 /snapshot/ 가상 경로를 반환하여 .exe 파일을 spawn/fs 접근하지 못합니다.
const isPkg = typeof process.pkg !== 'undefined';
const BASE_DIR = isPkg ? path.dirname(process.execPath) : __dirname;

const EPSON_AGENT = path.join(BASE_DIR, 'drv_eps.exe');
const HP_AGENT    = path.join(BASE_DIR, 'drv_hp.exe');
const HAS_EPSON   = fs.existsSync(EPSON_AGENT);
const HAS_HP      = fs.existsSync(HP_AGENT);
const UPDATE_URL  = 'https://github.com/mokflw-lilymag/ribbonprint_v1/raw/main/RibbonBridge_Setup.zip';

// ─── App Setup ─────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '200mb' }));

// Ensure tmp directory
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ─── Boot Log ──────────────────────────────────────────────────
console.log('╔══════════════════════════════════════════════════╗');
console.log(`║     RibbonBridge v${VERSION} — Universal Print Engine    ║`);
console.log('╚══════════════════════════════════════════════════╝');
console.log(`> Platform : ${os.platform()} ${os.release()}`);
console.log(`> Node     : ${process.version}`);
console.log(`> Epson    : ${HAS_EPSON ? '✅ Ready' : '⛔ Not found'}`);
console.log(`> HP       : ${HAS_HP    ? '✅ Ready' : '⛔ Not found'}`);
console.log(`> GDI      : ✅ Always available`);

// ─── Printer Presets ───────────────────────────────────────────
const DEFAULT_PRESETS = {
  models: {},
  defaults: {
    epson: { leftMargin: 34.5 },
    hp:    { leftMargin: 34.5 },
    other: { leftMargin: 34.5 }
  }
};

function loadPresets() {
  try {
    const p = path.join(BASE_DIR, 'printer_presets.json');
    if (!fs.existsSync(p)) {
      console.log('> Presets  : ⚠️  Not found, using defaults');
      return DEFAULT_PRESETS;
    }
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(`> Presets  : ✅ ${Object.keys(data.models || {}).length} models loaded`);
    return data;
  } catch (e) {
    console.log(`> Presets  : ⚠️  Parse error — ${e.message}`);
    return DEFAULT_PRESETS;
  }
}

const PRESETS = loadPresets();

// ─── Brand / Engine Detection ──────────────────────────────────
const BRAND_KEYWORDS = {
  epson:   ['epson'],
  hp:      ['hp', 'hewlett', 'packard', 'deskjet', 'officejet', 'laserjet', 'envy', 'photosmart', 'smart tank'],
  canon:   ['canon', 'pixma', 'imageclass'],
  brother: ['brother'],
  samsung: ['samsung', 'xpress']
};

function detectBrand(printerName, driverName) {
  const haystack = `${printerName || ''} ${driverName || ''}`.toLowerCase();
  for (const [brand, keywords] of Object.entries(BRAND_KEYWORDS)) {
    if (keywords.some(kw => haystack.includes(kw))) return brand;
  }
  return 'other';
}

function getEngineStrategy(brand, printerName = '') {
  const isBasicEpson = (printerName || '').toUpperCase().includes('M105');
  
  if (brand === 'epson' && isBasicEpson) {
    return { engine: 'gdi', agent: null, label: 'GDI (Epson M-Series Optimization)' };
  }
  
  if (brand === 'epson' && HAS_EPSON) return { engine: 'escp', agent: EPSON_AGENT, label: 'Epson ESC/P RAW' };
  if (brand === 'hp'    && HAS_HP)    return { engine: 'pcl5', agent: HP_AGENT,    label: 'HP PCL5 RAW' };
  if (brand === 'epson')              return { engine: 'gdi',  agent: null, label: 'GDI (Epson agent missing)' };
  if (brand === 'hp')                 return { engine: 'gdi',  agent: null, label: 'GDI (HP agent missing)' };
  return { engine: 'gdi', agent: null, label: `GDI (${brand})` };
}

function findPreset(printerName) {
  const nameLower = (printerName || '').toLowerCase();

  // 1. Exact substring match
  for (const [model, preset] of Object.entries(PRESETS.models)) {
    if (nameLower.includes(model.toLowerCase())) {
      return { ...preset, matchedModel: model };
    }
  }

  // 2. Model number match (e.g. "8100" in "HP OfficeJet 8100")
  for (const [model, preset] of Object.entries(PRESETS.models)) {
    const nums = model.match(/\d{3,}/g);
    if (nums && nums.some(n => nameLower.includes(n))) {
      return { ...preset, matchedModel: `${model} (partial)` };
    }
  }

  // 3. Brand defaults
  const brand = detectBrand(printerName, '');
  const defaults = PRESETS.defaults[brand] || PRESETS.defaults.other;
  return { ...defaults, matchedModel: `${brand} default` };
}

// ─── Printer Cache ─────────────────────────────────────────────
const cachedPrinterInfo = {};   // { name: { brand, driver } }

// ─── Routes ════════════════════════════════════════════════════

// Health Check (lightweight — used by 5s polling)
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    version: VERSION,
    message: 'RibbonBridge Universal Engine Active',
    engines: { epson_escp: HAS_EPSON, hp_pcl5: HAS_HP, gdi_fallback: true },
    uptime: Math.floor(process.uptime()),
    platform: os.platform()
  });
});

// Detailed status (diagnostics page)
app.get('/api/status', (_req, res) => {
  res.json({
    status: 'ok',
    version: VERSION,
    uptime: Math.floor(process.uptime()),
    engines: {
      epson_escp: { available: HAS_EPSON, path: EPSON_AGENT },
      hp_pcl5:    { available: HAS_HP,    path: HP_AGENT },
      gdi:        { available: true,      path: 'Windows built-in' }
    },
    cached_printers: Object.keys(cachedPrinterInfo).length,
    temp_dir: TMP_DIR,
    node_version: process.version,
    platform: `${os.platform()} ${os.release()}`,
    memory: {
      used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total_mb: Math.round(os.totalmem() / 1024 / 1024)
    }
  });
});

// ─── Font Directory ────────────────────────────────────────────
app.get('/api/fonts', (_req, res) => {
  try {
    const EXTS = new Set(['.ttf', '.otf', '.ttc', '.woff', '.woff2']);
    const fonts = [];

    if (fs.existsSync(FONT_DIR)) {
      for (const f of fs.readdirSync(FONT_DIR)) {
        const ext = path.extname(f).toLowerCase();
        if (!EXTS.has(ext)) continue;
        try {
          const stat = fs.statSync(path.join(FONT_DIR, f));
          fonts.push({
            filename: f,
            name: path.parse(f).name,
            size_kb: Math.round(stat.size / 1024 * 10) / 10,
            extension: ext
          });
        } catch { /* skip unreadable */ }
      }
    }

    fonts.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    res.json({ status: 'success', count: fonts.length, fonts });
  } catch (err) {
    res.json({ status: 'error', message: err.message });
  }
});

app.get('/api/fonts/file/:fontFilename', (req, res) => {
  const safeName = path.basename(req.params.fontFilename);
  const fontPath = path.join(FONT_DIR, safeName);
  if (!fs.existsSync(fontPath)) {
    return res.status(404).json({ status: 'error', message: `Not found: ${safeName}` });
  }
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  fs.createReadStream(fontPath).pipe(res);
});

// ─── Printer List ──────────────────────────────────────────────
app.get('/api/printers', (_req, res) => {
  const mapPrinter = (p, driverName = '') => {
    const brand = detectBrand(p.Name || p, driverName);
    const strategy = getEngineStrategy(brand, p.Name || p);
    cachedPrinterInfo[p.Name || p] = { brand, driver: driverName };
    return {
      name: p.Name || p,
      status: p.PrinterStatus === 0 ? 'Ready' : p.PrinterStatus === 1 ? 'Paused' : 'Busy',
      model: p.Name || p,
      brand,
      driver: driverName,
      port: p.PortName || '',
      engine: strategy.label
    };
  };

  // Primary: Get-Printer (modern)
  try {
    const cmd = `powershell -NoProfile -Command "Get-Printer | Select-Object Name, PrinterStatus, DriverName, PortName | ConvertTo-Json -Compress"`;
    const raw = execSync(cmd, { timeout: 10000, encoding: 'utf8' });
    let list = JSON.parse(raw || '[]');
    if (!Array.isArray(list)) list = [list];

    const data = list.filter(p => p.Name).map(p => mapPrinter(p, p.DriverName || ''));
    console.log(`[PRINTERS] ${data.length} found: ${data.map(p => p.name).join(', ')}`);
    return res.json({ status: 'success', data });
  } catch { /* fall through */ }

  // Fallback: WMI
  try {
    const cmd = `powershell -NoProfile -Command "Get-WmiObject -Query 'SELECT Name FROM Win32_Printer' | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress"`;
    const raw = execSync(cmd, { timeout: 10000, encoding: 'utf8' });
    let names = JSON.parse(raw || '[]');
    if (!Array.isArray(names)) names = [names];

    const data = names.filter(Boolean).map(n => mapPrinter({ Name: n, PrinterStatus: 0 }));
    return res.json({ status: 'success', data });
  } catch (err) {
    return res.json({ status: 'error', message: err.message });
  }
});

// ─── Auto-Pairing ──────────────────────────────────────────────
app.post('/api/pair', (req, res) => {
  const uid = req.body?.user_id;
  if (uid) console.log(`[PAIR] user: ${uid.substring(0, 8)}…`);
  res.json({ status: 'success', message: 'Paired ok' });
});

// ════════════════════════════════════════════════════════════════
//   UNIVERSAL PRINT ENGINE
// ════════════════════════════════════════════════════════════════
app.post('/api/print_image', async (req, res) => {
  const { printer_name, image_base64, width_mm, length_mm, margin_offset_mm } = req.body;

  if (!printer_name || !image_base64) {
    return res.status(400).json({ status: 'error', message: 'Missing printer_name or image_base64' });
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const tmpFile = path.join(TMP_DIR, `${jobId}.png`);

  try {
    const start = Date.now();
    // 1. Decode & Save
    const rawData = image_base64.includes(',') ? image_base64.split(',')[1] : image_base64;
    if (!rawData) return res.json({ status: 'error', message: 'Invalid image_base64 format' });
    fs.writeFileSync(tmpFile, Buffer.from(rawData, 'base64'));
    const decodeTime = Date.now() - start;
    const fileSizeKB = Math.round(fs.statSync(tmpFile).size / 1024);

    // 2. Brand & Preset
    const cached = cachedPrinterInfo[printer_name];
    let brand = cached?.brand || detectBrand(printer_name, '');
    const preset = findPreset(printer_name);

    const strategy = getEngineStrategy(brand, printer_name);
    const effLeftMargin = (preset.leftMargin || 34.5) + (parseFloat(margin_offset_mm) || 0);
    const marginCenter  = effLeftMargin + (width_mm / 2.0);

    let finalEngine = strategy.engine;
    if (preset.engine === 'escp' && HAS_EPSON) finalEngine = 'escp';
    if (preset.engine === 'pcl5' && HAS_HP)    finalEngine = 'pcl5';

    console.log(`[PRINT] ${jobId}: ${brand}/${finalEngine} | ${width_mm}x${length_mm}mm | ${fileSizeKB}KB | Decode: ${decodeTime}ms`);

    // 3. Execute
    if (finalEngine === 'escp' || finalEngine === 'pcl5') {
      const agent = finalEngine === 'escp' ? EPSON_AGENT : HP_AGENT;
      const cmd = `"${agent}" "${printer_name}" "${tmpFile}" ${width_mm} ${length_mm} ${marginCenter.toFixed(1)}`;
      await execNative(cmd, tmpFile);
      console.log(`[PRINT] ✅ ${jobId} Native Success (${Date.now() - start}ms)`);
      return res.json({ status: 'success', method: finalEngine, time: Date.now() - start });
    } else {
      await printViaGDI(printer_name, tmpFile, width_mm, length_mm, jobId, effLeftMargin);
      console.log(`[PRINT] ✅ ${jobId} GDI Success (${Date.now() - start}ms)`);
      return res.json({ status: 'success', method: 'gdi', time: Date.now() - start });
    }
  } catch (err) {
    console.error(`[PRINT] ❌ ${jobId}: ${err.message}`);
    return res.json({ status: 'error', message: err.message });
  } finally {
    // Always clean up temp file
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});

// ─── Native Engine Executor ────────────────────────────────────
function execNative(command, tmpFile) {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error((stderr || stdout || error.message).trim()));
        return;
      }
      if (stdout && stdout.includes('SUCCESS')) {
        resolve();
      } else {
        reject(new Error(`Unexpected: ${(stdout || 'No output').trim()}`));
      }
    });
  });
}

// ─── GDI PrintDocument Fallback ────────────────────────────────
function printViaGDI(printerName, imagePath, widthMM, lengthMM, jobId, leftMarginMM = 0) {
  if (!fs.existsSync(imagePath)) {
    return Promise.reject(new Error('Image file not found for GDI'));
  }

  return new Promise((resolve, reject) => {
    // Sanitize for PowerShell single-quote embedding
    const safePrinter = printerName.replace(/'/g, "''");
    const safeImage   = imagePath.replace(/\\/g, '\\\\').replace(/'/g, "''");

    const psScript = `
Add-Type -AssemblyName System.Drawing

$printerName = '${safePrinter}'
$imagePath   = '${safeImage}'
$widthMM     = ${widthMM}
$lengthMM    = ${lengthMM}
$leftMM      = ${leftMarginMM}

if (-not (Test-Path $imagePath)) {
  Write-Error "Image not found: $imagePath"
  exit 1
}

try {
  $img = [System.Drawing.Image]::FromFile($imagePath)
  $pd  = New-Object System.Drawing.Printing.PrintDocument
  $pd.PrinterSettings.PrinterName = $printerName

  if (-not $pd.PrinterSettings.IsValid) {
    Write-Error "Invalid printer: $printerName"
    exit 1
  }

  # Convert mm → 100ths of inch
  $w100      = [int]($widthMM  / 25.4 * 100)
  $h100      = [int]($lengthMM / 25.4 * 100)
  $offsetX   = [int]($leftMM   / 25.4 * 100)

  # [CRITICAL FIX]
  # EPSON 데스크탑 드라이버는 'Custom' 용지 대신 표준 'A4'를 사용할 때 끊김 없는 즉시 출력이 가능합니다.
  $driverSafeWidth = 827 
  $a4 = $pd.PrinterSettings.PaperSizes | Where-Object { ($_.Kind -eq 'A4') -or ($_.PaperName -like '*A4*') } | Select-Object -First 1
  if ($a4) {
      $pd.DefaultPageSettings.PaperSize = $a4
  } else {
      $pd.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize("A4_Safe", $driverSafeWidth, 1169)
  }
  
  $pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)
  $pd.DefaultPageSettings.Landscape = $false

  $printed = $false
  $handler = {
    param($sender, $e)
    if (-not $printed) {
      # 100분의 1인치 단위로 출력 영역을 계산합니다.
      $dest = New-Object System.Drawing.Rectangle($offsetX, 0, $w100, $h100)
      $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $e.Graphics.DrawImage($img, $dest)
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
    ps.stdout.on('data', d => { stdout += d; });
    ps.stderr.on('data', d => { stderr += d; });

    ps.on('close', code => {
      if (code === 0 && stdout.includes('GDI_SUCCESS')) {
        resolve();
      } else {
        reject(new Error(`GDI: ${(stderr || stdout || 'Unknown error').trim()}`));
      }
    });

    ps.on('error', err => reject(err));
  });
}

// ═══════════════════════════════════════════════════════════════
//   AUTO UPDATER
// ═══════════════════════════════════════════════════════════════
app.post('/api/update', (_req, res) => {
  res.json({ status: 'ok', message: 'Update initiated' });
  console.log('\n> 📥 AUTO UPDATE: starting…');

  const batPath = path.join(process.cwd(), 'updater.bat');
  const lines = [
    '@echo off',
    'echo ==============================================',
    'echo RibbonBridge Auto Updater',
    'echo ==============================================',
    'echo Please wait...',
    'timeout /t 2 /nobreak >nul',
    'taskkill /F /IM sys_service.exe >nul 2>&1',
    'taskkill /F /IM launch_service.exe >nul 2>&1',
    '',
    'echo Downloading latest version...',
    `powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ts = (Get-Date -UFormat %%s); $url = '${UPDATE_URL}?t=' + $ts; Invoke-WebRequest -Uri $url -OutFile 'update.zip' -TimeoutSec 120"`,
    '',
    'if not exist update.zip (',
    '  echo Download failed!',
    '  start "" "launch_service.exe"',
    '  exit /b',
    ')',
    '',
    'echo Extracting...',
    `powershell -Command "Expand-Archive -Path 'update.zip' -DestinationPath 'upd_tmp' -Force"`,
    '',
    'echo Applying update...',
    'copy /Y upd_tmp\\*.exe . >nul 2>&1',
    'copy /Y upd_tmp\\*.json . >nul 2>&1',
    'for /d %%D in (upd_tmp\\*) do (',
    '  copy /Y "%%D\\*.exe" "." >nul 2>&1',
    '  copy /Y "%%D\\*.json" "." >nul 2>&1',
    ')',
    'if exist upd_tmp rmdir /S /Q upd_tmp',
    'if exist update.zip del update.zip',
    '',
    'echo Starting new version...',
    'start "" "launch_service.exe"',
    '(goto) 2>nul & del "%~f0"'
  ];

  fs.writeFileSync(batPath, lines.join('\r\n'));

  setTimeout(() => {
    const child = spawn('cmd.exe', ['/c', batPath], {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd()
    });
    child.unref();
    process.exit(0);
  }, 1000);
});

// ─── Graceful Shutdown ─────────────────────────────────────────
process.on('uncaughtException', err => {
  console.error('[FATAL] Uncaught exception:', err.message);
});
process.on('unhandledRejection', reason => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

// ─── Start Server ──────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n> 🚀 RibbonBridge v${VERSION} listening on http://localhost:${PORT}`);
  console.log(`>    Epson → ESC/P RAW | HP → PCL5 RAW | Other → GDI`);
  console.log(`>    Auto GDI fallback on native failure`);
  console.log(`>    Ready for print jobs! 🖨️\n`);
});
