// ═══════════════════════════════════════════════════════════════
//   RibbonBridge v9.0 — Epson M105 Banner Print Engine
//   GDI · Self-Updater · Font Proxy · /api/pair fixed
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const cors    = require('cors');
const { exec, execSync, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ─── Constants ─────────────────────────────────────────────────
const VERSION = '9.0';
const PORT    = 8000;
const TMP_DIR = path.join(os.tmpdir(), 'ribbon-saas');
const FONT_DIR = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');

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

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ─── Boot Log ──────────────────────────────────────────────────
console.log('╔══════════════════════════════════════════════════╗');
console.log(`║      RibbonBridge v${VERSION} — M105 Banner Engine       ║`);
console.log('╚══════════════════════════════════════════════════╝');
console.log(`> Platform : ${os.platform()} ${os.release()}`);
console.log(`> Node     : ${process.version}`);
console.log(`> Epson    : ${HAS_EPSON ? '✅ Ready' : '⛔ Not found (GDI fallback)'}`);
console.log(`> GDI      : ✅ Always available`);

// ─── Printer Brand Detection ───────────────────────────────────
const BRAND_KEYWORDS = {
  epson:   ['epson'],
  hp:      ['hp','hewlett','packard','deskjet','officejet','laserjet','envy','photosmart'],
  canon:   ['canon','pixma','imageclass'],
  brother: ['brother'],
  samsung: ['samsung','xpress']
};

function detectBrand(printerName, driverName) {
  const h = `${printerName||''} ${driverName||''}`.toLowerCase();
  for (const [brand, kws] of Object.entries(BRAND_KEYWORDS)) {
    if (kws.some(kw => h.includes(kw))) return brand;
  }
  return 'other';
}

// ─── Printer Cache ─────────────────────────────────────────────
const cachedPrinterInfo = {};

// ─── Routes ════════════════════════════════════════════════════

// Health check
app.get('/', (_req, res) => {
  res.json({ status: 'ok', version: VERSION, uptime: Math.floor(process.uptime()), platform: os.platform() });
});

app.get('/api/status', (_req, res) => {
  res.json({
    status: 'ok', version: VERSION, uptime: Math.floor(process.uptime()),
    engines: { epson_escp: { available: HAS_EPSON }, gdi: { available: true } },
    cached_printers: Object.keys(cachedPrinterInfo).length,
    temp_dir: TMP_DIR
  });
});

// ── /api/pair: 웹앱-브릿지 페어링 (에러 없이 정상 응답) ──────
app.post('/api/pair', (req, res) => {
  const { user_id } = req.body || {};
  console.log(`[Pair] ✅ Web app connected${user_id ? ` (user: ${user_id.slice(0,8)}...)` : ''}`);
  res.json({ status: 'ok', version: VERSION, paired: true });
});

// ── /api/printers: 프린터 목록 ────────────────────────────────
app.get('/api/printers', (_req, res) => {
  try {
    const cmd = `powershell -NoProfile -Command "Get-Printer | Select-Object Name,PrinterStatus,DriverName | ConvertTo-Json -Compress"`;
    const raw = execSync(cmd, { timeout: 10000, encoding: 'utf8' });
    let list = JSON.parse(raw || '[]');
    if (!Array.isArray(list)) list = [list];
    const data = list.filter(p => p.Name).map(p => {
      const brand = detectBrand(p.Name, p.DriverName || '');
      cachedPrinterInfo[p.Name] = { brand, driver: p.DriverName || '' };
      const isM105 = p.Name.toUpperCase().includes('M105');
      return {
        name: p.Name,
        status: p.PrinterStatus === 0 ? 'Ready' : 'Other',
        brand,
        driver: p.DriverName || '',
        engine: isM105 ? 'GDI (M105 Optimized)' : brand === 'epson' && HAS_EPSON ? 'Epson ESC/P' : 'GDI'
      };
    });
    return res.json({ status: 'success', data });
  } catch (err) {
    return res.json({ status: 'error', message: err.message });
  }
});

// ── /api/print_image: 핵심 프린트 엔진 ───────────────────────
app.post('/api/print_image', async (req, res) => {
  const { printer_name, image_base64, width_mm, length_mm, margin_offset_mm, cutting_margin_mm = 0 } = req.body;
  const jobId = `job_${Date.now()}`;
  const localPaths = [];

  try {
    // 이미지 리스트 처리
    const images = Array.isArray(image_base64) ? image_base64 : [image_base64];
    
    for (let i = 0; i < images.length; i++) {
        const pathStr = path.join(TMP_DIR, `${jobId}_${i}.png`);
        const rawData = images[i].includes(',') ? images[i].split(',')[1] : images[i];
        fs.writeFileSync(pathStr, Buffer.from(rawData, 'base64'));
        localPaths.push(pathStr);
    }

    console.log(`\n[PRINT] ── Multi-Job ${jobId} ─────────────────────`);
    console.log(`[PRINT]   Printer : ${printer_name}`);
    console.log(`[PRINT]   Pages   : ${localPaths.length}`);

    // GDI 엔진 호출 (이미지 경로 배열 전달)
    const leftMarginMM = parseFloat(margin_offset_mm) || 0;
    const cuttingMarginMM = parseFloat(cutting_margin_mm) || 0;
    
    await printViaGDI(printer_name, localPaths, parseFloat(width_mm), parseFloat(length_mm), leftMarginMM, cuttingMarginMM);
    
    console.log(`[PRINT] ✅ Success`);
    return res.json({ status: 'success' });

  } catch (err) {
    console.error(`[PRINT] ❌ ${err.message}`);
    return res.json({ status: 'error', message: err.message });
  } finally {
    // 모든 임시파일 삭제
    localPaths.forEach(p => {
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
    });
  }
});

// ─── GDI Engine: Epson M105 배너 최적화 ───────────────────────
// 핵심 원리:
//  · .NET System.Drawing 사용하여 이미지를 리본 크기에 맞게 출력
//  · 종이 크기: A4 폭(210mm=827/100인치) + 리본 길이를 높이로 설정
//  · DrawImage rect는 픽셀 단위가 아니라 1/100인치 단위 (GDI 기본)
//  · M105는 세로 방향(landscape=false), 상단부터 급지
//  · 이미지는 이미 App.tsx에서 180도 회전되어 있음
// ─── GDI Engine: Epson M105 배너 최적화 ───────────────────────
function printViaGDI(printerName, images, widthMM, lengthMM, leftMarginMM, cuttingMarginMM = 0) {
  return new Promise((resolve, reject) => {
    // images가 단일 경로면 배열로 변환
    const imageList = Array.isArray(images) ? images : [images];
    const safePrinter = printerName.replace(/'/g, "''");
    
    // mm → 1/100 inch 변환
    const widthUnits  = Math.round(widthMM  / 25.4 * 100);
    const lengthUnits = Math.round(lengthMM / 25.4 * 100);
    const canvasWidthUnits = 827; // A4 Fixed
    const imageHeightMM = lengthMM - cuttingMarginMM;
    const finalX = leftMarginMM - (widthMM / 2);

    console.log(`[GDI V11] Combined Job: ${imageList.length} pages, Center=${leftMarginMM}mm, Paper=${lengthMM}mm`);

    const psScript = `
Add-Type -AssemblyName System.Drawing

$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = '${safePrinter}'
$pd.PrintController = New-Object System.Drawing.Printing.StandardPrintController

# 용지 폭 고정 및 여백 0 설정 (불필요한 급지 방지)
$paperSize = New-Object System.Drawing.Printing.PaperSize("Ribbon-Roll", ${canvasWidthUnits}, ${lengthUnits})
$pd.DefaultPageSettings.PaperSize = $paperSize
$pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)
$pd.OriginAtMargins = $false

$global:pageIdx = 0
$global:images = @()
${imageList.map(img => `$global:images += '${img.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`).join('\n')}

$pd.Add_PrintPage({
  param($sender, $e)
  
  $currentImgPath = $global:images[$global:pageIdx]
  $img = [System.Drawing.Image]::FromFile($currentImgPath)
  
  $e.Graphics.PageUnit = [System.Drawing.GraphicsUnit]::Millimeter
  
  # 하드웨어 오차 제거 (0점 정렬)
  $offX = $e.PageSettings.HardMarginX / 100 * 25.4
  $offY = $e.PageSettings.HardMarginY / 100 * 25.4
  $e.Graphics.TranslateTransform(-$offX, -$offY)

  $destRect = New-Object System.Drawing.RectangleF(${finalX}, 0, ${widthMM}, ${imageHeightMM})
  
  # 품질 설정
  $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $e.Graphics.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  
  # 이미지 그리기
  $e.Graphics.DrawImage($img, $destRect)
  $img.Dispose()

  $global:pageIdx++
  if ($global:pageIdx -lt $global:images.Count) {
    $e.HasMorePages = $true
  } else {
    $e.HasMorePages = $false
  }
})

try {
  $pd.Print()
  $pd.Dispose()
  Write-Output "GDI_SUCCESS"
} catch {
  Write-Error $_.Exception.Message
}
`;

    const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript]);
    let stdout = '';
    let stderr = '';

    ps.stdout.on('data', d => { stdout += d.toString(); });
    ps.stderr.on('data', d => { stderr += d.toString(); });

    ps.on('close', code => {
      if (code === 0 && stdout.includes('GDI_SUCCESS')) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || stdout.trim() || `GDI exit code ${code}`));
      }
    });
    ps.on('error', err => reject(new Error(`spawn error: ${err.message}`)));
  });
}

// ─── Font APIs ────────────────────────────────────────────────
app.get('/api/fonts', (_req, res) => {
  try {
    const fonts = fs.readdirSync(FONT_DIR)
      .filter(f => /\.(ttf|otf|ttc)$/i.test(f))
      .map(f => ({ name: path.parse(f).name, filename: f }));
    res.json({ status: 'success', fonts });
  } catch (err) {
    res.json({ status: 'error', message: err.message });
  }
});

app.get('/api/fonts/file/:fontFilename', (req, res) => {
  const fontPath = path.join(FONT_DIR, path.basename(req.params.fontFilename));
  if (fs.existsSync(fontPath)) res.sendFile(fontPath);
  else res.status(404).end();
});

// ─── Update ───────────────────────────────────────────────────
app.post('/api/update', (_req, res) => {
  res.json({ status: 'ok', message: 'Restarting...' });
  setTimeout(() => process.exit(0), 500);
});

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n> 🚀 RibbonBridge v${VERSION} ready at http://localhost:${PORT}\n`);
  console.log(`   Endpoints:`);
  console.log(`   GET  /              → health check`);
  console.log(`   POST /api/pair      → web app pairing`);
  console.log(`   GET  /api/printers  → printer list`);
  console.log(`   POST /api/print_image → print job\n`);
});
