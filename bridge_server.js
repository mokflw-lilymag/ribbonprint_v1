// ═══════════════════════════════════════════════════════════════
//   RibbonBridge v13.5 — Epson M-Series Master
//   GDI Engine v13.5 · Banner Merging & Absolute Centering(+5mm)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const { exec, execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Constants ─────────────────────────────────────────────────
const VERSION = '13.5';
const PORT = 8000;
const TMP_DIR = path.join(os.tmpdir(), 'ribbon-saas');
const FONT_DIR = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');

const isPkg = typeof process.pkg !== 'undefined';
const BASE_DIR = isPkg ? path.dirname(process.execPath) : __dirname;

// ─── App Setup ─────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '250mb' }));

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ─── Global Queue State ────────────────────────────────────────
let printQueue = []; // [{id, status, timestamp, printer, images, width, length, margin}]

// ─── Boot Log ──────────────────────────────────────────────────
console.log('╔══════════════════════════════════════════════════╗');
console.log(`║      RibbonBridge v${VERSION} — Queue & Monitor       ║`);
console.log('╚══════════════════════════════════════════════════╝');
console.log(`> Platform : ${os.platform()} ${os.release()}`);
console.log(`> Temp Dir : ${TMP_DIR}`);

// ─── Routes ════════════════════════════════════════════════════

app.get('/', (_req, res) => {
  res.json({ 
    status: 'ok', 
    version: VERSION, 
    engine: 'GDI v14.0 (Single-Page Master | User Calibrated)',
    features: [
      'Absolute Center-point Alignment',
      'Ultra-Banner Continuous Merging',
      'Zero-Offset Policy (User Calibrated)'
    ],
    queue_count: printQueue.length,
    uptime: Math.floor(process.uptime())
  });
});

// 페어링
app.post('/api/pair', (req, res) => {
  res.json({ status: 'ok', version: VERSION, paired: true });
});

// 버전 체크 API
app.get('/api/version', (req, res) => {
  res.json({ status: 'success', version: VERSION });
});

// 프린터 목록
app.get('/api/printers', (_req, res) => {
  try {
    const cmd = `powershell -NoProfile -Command "Get-Printer | Select-Object Name,PrinterStatus,DriverName | ConvertTo-Json -Compress"`;
    const raw = execSync(cmd, { timeout: 10000, encoding: 'utf8' });
    let list = JSON.parse(raw || '[]');
    if (!Array.isArray(list)) list = [list];
    const data = list.filter(p => p.Name).map(p => {
      let statusStr = 'Ready';
      if (p.PrinterStatus & 0x00000001) statusStr = 'Paused';
      else if (p.PrinterStatus & 0x00000002) statusStr = 'Error';
      else if (p.PrinterStatus & 0x00000008) statusStr = 'Paper Jam';
      else if (p.PrinterStatus & 0x00000010) statusStr = 'Paper Out';
      else if (p.PrinterStatus !== 0) statusStr = 'Busy/Other';

      return {
        name: p.Name,
        status: statusStr,
        driver: p.DriverName || ''
      };
    });
    return res.json({ status: 'success', data });
  } catch (err) {
    return res.json({ status: 'error', message: err.message });
  }
});

// ─── Queue Management API ──────────────────────────────────────

// 1. 대기열 목록 가져오기
app.get('/api/queue', (_req, res) => {
  const list = printQueue.map(q => ({
    id: q.id,
    status: q.status,
    timestamp: q.timestamp,
    printer: q.printer,
    width: q.width,
    length: q.length,
    segments: q.images.length
  }));
  res.json({ status: 'success', data: list });
});

// 2. 새로운 작업 추가 & 인쇄 시작
app.post('/api/print_image', async (req, res) => {
  const { printer_name, images, width_mm, length_mm, margin_offset_mm, cutting_margin_mm = 0 } = req.body;

  if (!printer_name || !images) {
    return res.status(400).json({ status: 'error', message: 'Missing printer_name or images' });
  }

  const jobId = `job_${Date.now()}`;
  const newJob = {
    id: jobId,
    status: 'printing',
    timestamp: new Date().toISOString(),
    printer: printer_name,
    images: Array.isArray(images) ? images : [images],
    width: width_mm,
    length: length_mm,
    margin: margin_offset_mm,
    cutting_margin: cutting_margin_mm
  };

  printQueue.unshift(newJob);
  if (printQueue.length > 20) printQueue.pop();

  // 백그라운드에서 인쇄 실행
  executePrintJob(newJob);

  res.json({ status: 'success', job_id: jobId });
});

// 3. 작업 재시도
app.post('/api/queue/retry/:jobId', (req, res) => {
  const job = printQueue.find(q => q.id === req.params.jobId);
  if (!job) return res.status(404).json({ status: 'error', message: 'Job not found' });

  job.status = 'printing';
  executePrintJob(job);
  res.json({ status: 'success' });
});

// 4. 대기열 비우기
app.post('/api/queue/clear', (req, res) => {
  printQueue = [];
  res.json({ status: 'success' });
});

// 5. 작업 삭제/취소
app.delete('/api/queue/:jobId', (req, res) => {
  const index = printQueue.findIndex(q => q.id === req.params.jobId);
  if (index > -1) {
    printQueue.splice(index, 1);
    exec(`powershell "Get-PrintJob -PrinterName '*' | Where-Object { $_.JobDescription -match 'Ribbon' } | Remove-PrintJob"`);
    res.json({ status: 'success' });
  } else {
    res.status(404).json({ status: 'error', message: 'Not found' });
  }
});

// ─── Core Logic: Execute Print Job ─────────────────────────────
async function executePrintJob(job) {
  const localPaths = [];
  try {
    console.log(`[Queue] Starting Job: ${job.id} (Segments: ${job.images.length})`);

    // 1. Save base64 to temp files
    for (let i = 0; i < job.images.length; i++) {
      const pathStr = path.join(TMP_DIR, `${job.id}_${i}.png`);
      const imgData = job.images[i];
      const rawData = imgData.includes(',') ? imgData.split(',')[1] : imgData;
      fs.writeFileSync(pathStr, Buffer.from(rawData, 'base64'));
      localPaths.push(pathStr);
    }

    // 2. Call GDI Engine
    const width = parseFloat(job.width);
    const length = parseFloat(job.length);
    const margin = parseFloat(job.margin) || 0;
    const cut = parseFloat(job.cutting_margin) || 0;

    await printViaGDI(job.printer, localPaths, width, length, margin, cut);

    job.status = 'completed';
    console.log(`[Queue] Job Completed: ${job.id}`);

  } catch (err) {
    job.status = 'error';
    job.error = err.message;
    console.error(`[Queue] Job ERROR: ${job.id} - ${err.message}`);
  } finally {
    // Cleanup Temp Files after short delay
    setTimeout(() => {
      localPaths.forEach(p => {
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { }
      });
    }, 5000);
  }
}

// ─── GDI Engine v14.0 (User Calibrated) ──────────────────────
function printViaGDI(printerName, images, widthMM, lengthMM, leftMarginMM, cuttingMarginMM = 0) {
  return new Promise((resolve, reject) => {
    const imageList = Array.isArray(images) ? images : [images];
    const safePrinter = printerName.replace(/'/g, "''");
    
    // 1. 배너 통합 길이 계산 (리본들의 순수 합 + 맨 마지막 절단 여백 1회)
    const totalLengthMM = (lengthMM * imageList.length) + cuttingMarginMM;
    
    // [원복] 임의 보정 제거: 사용자 앱의 보정 기능과 연동되도록 (중심점 - 폭/2) 순수 수식만 사용
    const finalX = leftMarginMM - (widthMM / 2); 
    const safeX = finalX < 0 ? 0 : finalX;

    console.log(`[GDI v15.2 Production] Combined Length: ${totalLengthMM}mm (Segments: ${imageList.length}, Offset: ${cuttingMarginMM}mm)`);
    console.log(`[GDI v15.2 Production] Target X: ${safeX}mm (Pure math: margin - width/2)`);

    const psScript = `
Add-Type -AssemblyName System.Drawing
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = '${safePrinter}'
$pd.PrintController = New-Object System.Drawing.Printing.StandardPrintController

# 1. 엡손 M105용 무제한 사용자 정의 용지 규격 (A4 너비, 가변 높이)
$widthUnits = [int](210 / 25.4 * 100)
$totalLengthUnits = [int](${totalLengthMM} / 25.4 * 100)
$customPaper = New-Object System.Drawing.Printing.PaperSize("RibbonBanner", $widthUnits, $totalLengthUnits)
# [핵심] RawKind를 0(Custom)으로 주입하여 드라이버의 A4 강제 회귀를 방지
$customPaper.RawKind = 0 

$pd.DefaultPageSettings.PaperSize = $customPaper
$pd.DefaultPageSettings.Landscape = $false
$pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)

$images = @(${imageList.map(img => `'${img.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`).join(',')})

$pd.Add_PrintPage({
  param($sender, $e)
  $g = $e.Graphics
  $g.PageUnit = [System.Drawing.GraphicsUnit]::Millimeter
  
  $currentY = 0
  foreach ($path in $images) {
    if (Test-Path $path) {
      $img = [System.Drawing.Image]::FromFile($path)
      # [V15.1 정규] 사용자가 웹 UI에서 맞춘 위치(safeX)에 정확히 출력
      $destRect = New-Object System.Drawing.RectangleF(${safeX}, $currentY, ${widthMM}, ${lengthMM})
      $g.DrawImage($img, $destRect)
      
      $currentY += ${lengthMM}
      $img.Dispose()
    }
  }
  $e.HasMorePages = $false
})

try {
  $pd.Print()
  $pd.Dispose()
  Write-Output "GDI_SUCCESS"
} catch {
  Write-Output "GDI_ERROR: $($_.Exception.Message)"
}
`;

    const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript]);
    let stdout = '';
    let stderr = '';

    ps.stdout.on('data', d => { 
      const txt = d.toString();
      stdout += txt;
      console.log(`[GDI Server] ${txt.trim()}`);
    });
    ps.stderr.on('data', d => { stderr += d.toString(); });

    ps.on('close', code => {
      if (code === 0 && stdout.includes('GDI_SUCCESS')) {
        resolve();
      } else {
        const errMsg = stderr.trim() || stdout.trim() || `GDI exit code ${code}`;
        console.error(`[GDI Error] ${errMsg}`);
        reject(new Error(errMsg));
      }
    });
    ps.on('error', err => reject(new Error(`spawn error: ${err.message}`)));
  });
}

// ─── Font APIs ────────────────────────────────────────────────
app.get('/api/fonts', (_req, res) => {
  try {
    const fonts = fs.readdirSync(FONT_DIR).filter(f => /\.(ttf|otf|ttc)$/i.test(f)).map(f => ({ name: path.parse(f).name, filename: f }));
    res.json({ status: 'success', fonts });
  } catch (err) { res.json({ status: 'error', message: err.message }); }
});

app.get('/api/fonts/file/:fn', (req, res) => {
  const p = path.join(FONT_DIR, path.basename(req.params.fn));
  if (fs.existsSync(p)) res.sendFile(p); else res.status(404).end();
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n> 🚀 RibbonBridge v${VERSION} (Stable Mode) at http://localhost:${PORT}\n`);
});
