// ═══════════════════════════════════════════════════════════════
//   RibbonBridge v25.0 — Dual Engine (Epson M105 + Xprinter)
//   GDI Engine v25.0 (Unified Build for Florasync-SaaS)
//   GDI Engine v1.0  · Direct-Width (XP-DT108B Thermal)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const { exec, execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Constants ─────────────────────────────────────────────────
const VERSION = '25.0';
const PORT = 8000;
const TMP_DIR = path.join(os.tmpdir(), 'ribbon-saas');
const FONT_DIR = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');

const isPkg = typeof process.pkg !== 'undefined';
const BASE_DIR = isPkg ? path.dirname(process.execPath) : __dirname;

// ─── Printer Type Detection ────────────────────────────────────
function detectPrinterType(driverName, printerName) {
  const combined = ((driverName || '') + ' ' + (printerName || '')).toLowerCase();
  if (combined.includes('xprinter') || combined.includes('xp-dt') || combined.includes('xp-tt')) return 'xprinter';
  if (combined.includes('epson') && (combined.includes('m1') || combined.includes('m-1'))) return 'epson_m105';
  return 'generic';
}

function isXprinterType(printerName) {
  const name = (printerName || '').toLowerCase();
  return name.includes('xprinter') || name.includes('xp-dt') || name.includes('xp-tt');
}

// ─── App Setup ─────────────────────────────────────────────────
const app = express();

// ─── Final Hardened CORS & PNA (Private Network Access) Middleware ───
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  
  // Standard CORS headers
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Allow-Private-Network');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Special PNA (Private Network Access) Headder Handling
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }

  // Preflight (OPTIONS) request termination
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  
  next();
});

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
        driver: p.DriverName || '',
        type: detectPrinterType(p.DriverName, p.Name)
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
  const { printer_name, images, width_mm, length_mm, margin_offset_mm, cutting_margin_mm = 0, media_type = 'roll' } = req.body;

  if (!printer_name || !images) {
    return res.status(400).json({ status: 'error', message: 'Missing printer_name or images' });
  }

  const jobId = `job_${Date.now()}`;
  const newJob = {
    id: jobId,
    status: 'printing',
    timestamp: new Date().toISOString(),
    printer: printer_name,
    mediaType: media_type, // 'roll' | 'cut'
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
    const mediaType = job.mediaType || 'roll';

    // ─── Dual Engine Branching ───
    if (isXprinterType(job.printer)) {
      console.log(`[Engine] Routing to Xprinter GDI Engine (Direct-Width/Centered)`);
      await printViaGDI_Xprinter(job.printer, localPaths, width, length, cut, margin);
    } else {
      console.log(`[Engine] Routing to Epson M105 GDI Engine (Margin-as-Center)`);
      await printViaGDI(job.printer, localPaths, width, length, margin, cut, mediaType);
    }

    job.status = 'completed';
    console.log(`[Queue] Job Completed: ${job.id}`);

    // Auto-cleanup completed job after 2 minutes (120,000 ms)
    setTimeout(() => {
      const idx = printQueue.findIndex(q => q.id === job.id && q.status === 'completed');
      if (idx > -1) {
        printQueue.splice(idx, 1);
        console.log(`[Queue] Auto-cleaned completed job: ${job.id}`);
      }
    }, 120000);

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

// ─── GDI Engine v16.0 (Roll/Cut Supported & Feed Fixed) ──────────────────────
function printViaGDI(printerName, images, widthMM, lengthMM, leftMarginMM, cuttingMarginMM = 0, mediaType = 'roll') {
  return new Promise((resolve, reject) => {
    const imageList = Array.isArray(images) ? images : [images];
    const safePrinter = printerName.replace(/'/g, "''");
    
    // 1. 배너 통합 길이 계산 (리본들의 순수 합 + 맨 마지막 절단 여백 1회)
    // 컷리본이나 물리버튼 에러 완화를 위해, 약간의 버퍼 길이를 확보해줄 수도 있지만 일단 수학적 길이를 유지합니다
    const totalLengthMM = (lengthMM * imageList.length) + cuttingMarginMM;
    
    // Coordinate logic: (UserMargin - width/2)
    // This centers the ribbon image on the printer's fixed physical center guide (specified by userMargin).
    const finalX = leftMarginMM - (widthMM / 2);
    const safeX = finalX < 0 ? 0 : finalX;

    console.log(`[GDI v${VERSION} Stable] Mode: ${mediaType.toUpperCase()}, Combined Length: ${totalLengthMM}mm, X Offset: ${safeX}mm (Segments: ${imageList.length})`);

    // [Fallback 보장] 기존 로직을 감싼 후, PaperSource만 안전하게 찾아 주입
    const psScript = `
try {
  Add-Type -AssemblyName System.Drawing
  $pd = New-Object System.Drawing.Printing.PrintDocument
  $pd.PrinterSettings.PrinterName = '${safePrinter}'
  $pd.PrintController = New-Object System.Drawing.Printing.StandardPrintController

  # 용지 공급장치 '롤(Roll/Continuous)' 자동 탐색 (오류 시 무시하고 기존대로 진행 - Fallback)
  if ('${mediaType}' -eq 'roll') {
      foreach ($source in $pd.PrinterSettings.PaperSources) {
          if ($source.SourceName -match "Roll|Continuous|롤|연속") {
              $pd.DefaultPageSettings.PaperSource = $source
              break
          }
      }
  }

  # 1. 무제한 사용자 정의 용지 규격 (너비는 A4 고정 210mm)
  $widthUnits = [int](210 / 25.4 * 100)
  $totalLengthUnits = [int](${totalLengthMM} / 25.4 * 100)
  $customPaper = New-Object System.Drawing.Printing.PaperSize("RibbonBanner", $widthUnits, $totalLengthUnits)
  $customPaper.RawKind = 256 

  $pd.DefaultPageSettings.PaperSize = $customPaper
  $pd.DefaultPageSettings.Landscape = $false
  
  # 프린터가 '여백 0'을 허용하지 않아 여백 확인 대기로 빠지는 현상 방지를 위해 극히 작은 물리적 여백 부여 (1/100인치)
  $pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(1,1,1,1)

  $images = @(${imageList.map(img => `'${img.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`).join(',')})

$pd.Add_PrintPage({
  param($sender, $e)
  $g = $e.Graphics
  $g.PageUnit = [System.Drawing.GraphicsUnit]::Millimeter
  
  $currentY = 0
  foreach ($path in $images) {
    if (Test-Path $path) {
      $img = [System.Drawing.Image]::FromFile($path)
      # [V15.6] 정밀 좌표 인쇄 - 사용자 여백(safeX) 반영
      $destRect = New-Object System.Drawing.RectangleF(${safeX}, $currentY, ${widthMM}, ${lengthMM})
      $g.DrawImage($img, $destRect)
      
      # [V15.6] 중간선 추가: 두 리본이 만나는 지점에 1mm 두께의 가이드선 생성
      if ($path -eq $images[0] -and $images.Count -gt 1) {
          $lineY = $currentY + ${lengthMM}
          $blackPen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 1)
          # 리본 실 출력 너비만큼 선 긋기
          $g.DrawLine($blackPen, ${safeX}, $lineY, (${safeX} + ${widthMM}), $lineY)
      }

      $currentY += ${lengthMM}
      $img.Dispose()
    }
  }
  $e.HasMorePages = $false
})

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

// ═══════════════════════════════════════════════════════════════
//   GDI Engine v1.0 — Xprinter Direct-Width (XP-DT108B)
//   용지 폭 = 리본 폭 (38~110mm), X=0 전체 폭 인쇄
//   M105 엔진과 완전히 독립 — M105 코드는 한 줄도 수정하지 않음
// ═══════════════════════════════════════════════════════════════
function printViaGDI_Xprinter(printerName, images, widthMM, lengthMM, cuttingMarginMM = 0, marginOffsetMM = 0) {
  return new Promise((resolve, reject) => {
    const imageList = Array.isArray(images) ? images : [images];
    const safePrinter = printerName.replace(/'/g, "''");

    // Xprinter: 물리적 최대 폭 고정 (108mm) - 프린터 중앙 가이드에 맞추기 위함
    const MAX_PRINTER_WIDTH = 108;
    // X 인쇄 시작점: 108mm 캔버스 중앙에 리본(widthMM)을 배치 + 사용자 보정치
    const startX = (MAX_PRINTER_WIDTH - widthMM) / 2 + marginOffsetMM;

    // 총 길이 = (리본 길이 × 세그먼트 수) + 마지막 커팅 여백(20mm 등)
    const totalLengthMM = (lengthMM * imageList.length) + cuttingMarginMM;

    console.log(`[Xprinter GDI v1.1] Virtual Paper: ${MAX_PRINTER_WIDTH}mm, X-Offset: ${startX}mm, Length: ${totalLengthMM}mm, CutMargin: ${cuttingMarginMM}mm`);

    const psScript = `
try {
  Add-Type -AssemblyName System.Drawing
  $pd = New-Object System.Drawing.Printing.PrintDocument
  $pd.PrinterSettings.PrinterName = '${safePrinter}'
  $pd.PrintController = New-Object System.Drawing.Printing.StandardPrintController

  # Xprinter: 실제 용지 폭 = 리본 폭 (M105처럼 A4 고정이 아님)
  $widthUnits = [int](${widthMM} / 25.4 * 100)
  $totalLengthUnits = [int](${totalLengthMM} / 25.4 * 100)
  $customPaper = New-Object System.Drawing.Printing.PaperSize("ThermalRibbon", $widthUnits, $totalLengthUnits)
  $customPaper.RawKind = 256

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
        # Xprinter: X=0 부터 전체 폭 사용 (M105의 Margin-as-Center와 다름)
        $destRect = New-Object System.Drawing.RectangleF(0, $currentY, ${widthMM}, ${lengthMM})
        $g.DrawImage($img, $destRect)

        # 멀티 세그먼트 중간선
        if ($path -eq $images[0] -and $images.Count -gt 1) {
          $lineY = $currentY + ${lengthMM}
          $blackPen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 1)
          $g.DrawLine($blackPen, 0, $lineY, ${widthMM}, $lineY)
        }

        $currentY += ${lengthMM}
        $img.Dispose()
      }
    }
    $e.HasMorePages = $false
  })

  $pd.Print()
  $pd.Dispose()
  Write-Output "GDI_XPRINTER_SUCCESS"
} catch {
  Write-Output "GDI_XPRINTER_ERROR: $($_.Exception.Message)"
}
`;

    const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript]);
    let stdout = '';
    let stderr = '';

    ps.stdout.on('data', d => {
      const txt = d.toString();
      stdout += txt;
      console.log(`[Xprinter GDI] ${txt.trim()}`);
    });
    ps.stderr.on('data', d => { stderr += d.toString(); });

    ps.on('close', code => {
      if (code === 0 && stdout.includes('GDI_XPRINTER_SUCCESS')) {
        resolve();
      } else {
        const errMsg = stderr.trim() || stdout.trim() || `Xprinter GDI exit code ${code}`;
        console.error(`[Xprinter GDI Error] ${errMsg}`);
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

// ─── Robust Server Launch ──────────────────────────────────────
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log(`║      RibbonBridge v${VERSION} — (Stable) at PORT ${PORT}    ║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`\n> 🚀 RibbonBridge v${VERSION} (Stable Mode) at http://localhost:${PORT}\n`);
});

// Port in Use Handler
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`[CRITICAL] Port ${PORT} already in use. Please close other bridge versions.`);
    // In production, we might want to kill the conflicting process, but usually better to log clearly.
    setTimeout(() => process.exit(1), 5000); 
  }
});

// Global Exception Handlers (Prevent silent death)
process.on('uncaughtException', (err) => {
  console.error(`[UNCAUGHT] ${err.message}\n${err.stack}`);
  // Keep the process alive if possible, but log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION] at:', promise, 'reason:', reason);
});

