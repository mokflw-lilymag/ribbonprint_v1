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
  const { printer_name, image_base64, width_mm, length_mm, margin_offset_mm, print_quality } = req.body;
  if (!printer_name || !image_base64) {
    return res.status(400).json({ status: 'error', message: 'Missing printer_name or image_base64' });
  }

  const jobId  = `job_${Date.now()}`;
  const tmpPng = path.join(TMP_DIR, `${jobId}.png`);

  console.log(`\n[PRINT] ── Job ${jobId} ─────────────────────`);
  console.log(`[PRINT]   Printer : ${printer_name}`);
  console.log(`[PRINT]   Size    : ${width_mm}mm × ${length_mm}mm`);

  try {
    // 1. Base64 → PNG 파일 저장
    const rawData = image_base64.includes(',') ? image_base64.split(',')[1] : image_base64;
    fs.writeFileSync(tmpPng, Buffer.from(rawData, 'base64'));
    console.log(`[PRINT]   Saved   : ${tmpPng}`);

    // 2. 프린터 브랜드 확인
    const cached = cachedPrinterInfo[printer_name];
    const brand  = cached?.brand || detectBrand(printer_name, '');
    const isM105 = printer_name.toUpperCase().includes('M105');

    // 3. ESC/P 에이전트 (M105 제외한 Epson)
    if (brand === 'epson' && !isM105 && HAS_EPSON) {
      const marginCenter = 34.5 + (parseFloat(margin_offset_mm) || 0) + (width_mm / 2.0);
      const cmd = `"${EPSON_AGENT}" "${printer_name}" "${tmpPng}" ${width_mm} ${length_mm} ${marginCenter.toFixed(1)}`;
      await new Promise((resolve, reject) => {
        exec(cmd, { timeout: 30000 }, (err, stdout) => {
          if (err || !stdout.includes('SUCCESS')) reject(new Error(stdout || err?.message));
          else resolve();
        });
      });
      console.log(`[PRINT] ✅ ESC/P Success`);
      return res.json({ status: 'success', method: 'escp' });
    }

    // 4. GDI 엔진 (M105 포함 모든 기타 프린터)
    const leftMarginMM = parseFloat(margin_offset_mm) || 0;
    await printViaGDI(printer_name, tmpPng, parseFloat(width_mm), parseFloat(length_mm), leftMarginMM);
    console.log(`[PRINT] ✅ GDI Success`);
    return res.json({ status: 'success', method: 'gdi' });

  } catch (err) {
    console.error(`[PRINT] ❌ ${err.message}`);
    return res.json({ status: 'error', message: err.message });
  } finally {
    try { if (fs.existsSync(tmpPng)) fs.unlinkSync(tmpPng); } catch {}
  }
});

// ─── GDI Engine: Epson M105 배너 최적화 ───────────────────────
// 핵심 원리:
//  · .NET System.Drawing 사용하여 이미지를 리본 크기에 맞게 출력
//  · 종이 크기: A4 폭(210mm=827/100인치) + 리본 길이를 높이로 설정
//  · DrawImage rect는 픽셀 단위가 아니라 1/100인치 단위 (GDI 기본)
//  · M105는 세로 방향(landscape=false), 상단부터 급지
//  · 이미지는 이미 App.tsx에서 180도 회전되어 있음
function printViaGDI(printerName, imagePath, widthMM, lengthMM, leftMarginMM) {
  return new Promise((resolve, reject) => {
    const safePrinter = printerName.replace(/'/g, "''");
    const safeImage   = imagePath.replace(/\\/g, '\\\\').replace(/'/g, "''");

    // mm → 1/100 inch 변환 (PrintDocument 단위)
    // 25.4mm = 1 inch = 100 units
    const widthUnits  = Math.round(widthMM  / 25.4 * 100);
    const lengthUnits = Math.round(lengthMM / 25.4 * 100);
    
    // [V10] M105 같은 A4 프린터에서 배율이 뻥튀기되는 현상을 막기 위해
    // 페이지 폭을 A4(210mm = 827 unit)로 "고정"합니다.
    const canvasWidthUnits = 827; 

    console.log(`[GDI V10] Target Center: ${leftMarginMM}mm, Ribbon Width: ${widthMM}mm`);

    const finalX = leftMarginMM - (widthMM / 2);

    const psScript = `
Add-Type -AssemblyName System.Drawing

$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = '${safePrinter}'
$pd.PrintController = New-Object System.Drawing.Printing.StandardPrintController

# [V10] 용지 폭을 A4(210mm)로 고정하여 드라이버의 자동 배율 조정을 원천 봉쇄
$paperSize = New-Object System.Drawing.Printing.PaperSize("A4-Fixed", ${canvasWidthUnits}, ${lengthUnits})
$pd.DefaultPageSettings.PaperSize = $paperSize
$pd.DefaultPageSettings.Margins   = New-Object System.Drawing.Printing.Margins(0,0,0,0)
$pd.OriginAtMargins = $false

$img = [System.Drawing.Image]::FromFile('${safeImage}')

$pd.Add_PrintPage({
  param($sender, $e)
  
  # 단위를 밀리미터(mm)로 고정하여 윈도우 배율 영향 차단
  $e.Graphics.PageUnit = [System.Drawing.GraphicsUnit]::Millimeter
  
  # 프린터 하드웨어 여백(HardMargin) 보정
  $offX = $e.PageSettings.HardMarginX / 100 * 25.4
  $offY = $e.PageSettings.HardMarginY / 100 * 25.4
  $e.Graphics.TranslateTransform(-$offX, -$offY)

  # X = 설정표의 수치 그대로 사용 (보충 보정 없이 직접 대입)
  $destRect = New-Object System.Drawing.RectangleF(${leftMarginMM}, 0, ${widthMM}, ${lengthMM})
  
  # [V10.7] 정밀 가로 눈침 (Ruler) - 인쇄 상단에 1mm 단위로 표기
  $rulerFont = New-Object System.Drawing.Font("Arial", 2)
  $rulerBrush = [System.Drawing.Brushes]::Red
  $rulerPenThin = New-Object System.Drawing.Pen([System.Drawing.Color]::Red, 0.1)
  $rulerPenBold = New-Object System.Drawing.Pen([System.Drawing.Color]::Red, 0.3)

  for ($m = 0; $m -le 210; $m++) {
    if ($m % 10 -eq 0) {
      # 10mm 마다 긴 선 + 숫자
      $e.Graphics.DrawLine($rulerPenBold, $m, 0, $m, 5)
      $e.Graphics.DrawString($m.ToString(), $rulerFont, $rulerBrush, $m, 5)
    } elseif ($m % 5 -eq 0) {
      $e.Graphics.DrawLine($rulerPenThin, $m, 0, $m, 3)
    } else {
      $e.Graphics.DrawLine($rulerPenThin, $m, 0, $m, 1.5)
    }
  }

  # 현재 설정된 중심점(Center)에 파란색 긴 화살표 표시
  $centerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::Blue, 0.5)
  $e.Graphics.DrawLine($centerPen, ${leftMarginMM}, 0, ${leftMarginMM}, 15)

  # 정밀 품질 렌더링
  $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $e.Graphics.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  
  $e.Graphics.DrawImage($img, $destRect)
  $e.HasMorePages = $false
})

$pd.Print()
$img.Dispose()
$pd.Dispose()
Write-Output "GDI_SUCCESS"
`;

    const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript]);
    let stdout = '';
    let stderr = '';

    ps.stdout.on('data', d => { stdout += d.toString(); });
    ps.stderr.on('data', d => { stderr += d.toString(); });

    ps.on('close', code => {
      console.log(`[GDI] Exit=${code}, stdout="${stdout.trim()}", stderr="${stderr.trim().slice(0,200)}"`);
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
