// ═══════════════════════════════════════════════════════════════
//   RibbonBridge v11.0 — Queue Monitoring & Persistence
//   GDI · Queue System · Retry/Cancel Support
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const cors    = require('cors');
const { exec, execSync, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ─── Constants ─────────────────────────────────────────────────
const VERSION = '11.1';
const PORT    = 8000;
const TMP_DIR = path.join(os.tmpdir(), 'ribbon-saas');
const FONT_DIR = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');

const isPkg = typeof process.pkg !== 'undefined';
const BASE_DIR = isPkg ? path.dirname(process.execPath) : __dirname;

// ─── App Setup ─────────────────────────────────────────────────
const app = express();
app.use(cors());
<<<<<<< Updated upstream
app.use(express.json({ limit: '50mb' }));

// ── 버전 체크 API (자동 업데이트 유도용) ───────────────────────
app.get('/api/version', (req, res) => {
  res.json({ status: 'success', version: VERSION });
});
=======
app.use(express.json({ limit: '250mb' }));
>>>>>>> Stashed changes

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ─── Global Queue State ────────────────────────────────────────
let printQueue = []; // [{id, status, timestamp, printer, images, width, length, margin}]

// ─── Boot Log ──────────────────────────────────────────────────
console.log('╔══════════════════════════════════════════════════╗');
console.log(`║      RibbonBridge v${VERSION} — Banner Folding       ║`);
console.log('╚══════════════════════════════════════════════════╝');
console.log(`> Platform : ${os.platform()} ${os.release()}`);
console.log(`> Temp Dir : ${TMP_DIR}`);

// ─── Routes ════════════════════════════════════════════════════

app.get('/', (_req, res) => {
  res.json({ status: 'ok', version: VERSION, queue_count: printQueue.length });
});

// 페어링
app.post('/api/pair', (req, res) => {
  res.json({ status: 'ok', version: VERSION, paired: true });
});

// 프린터 목록
app.get('/api/printers', (_req, res) => {
  try {
    const cmd = `powershell -NoProfile -Command "Get-Printer | Select-Object Name,PrinterStatus,DriverName | ConvertTo-Json -Compress"`;
    const raw = execSync(cmd, { timeout: 10000, encoding: 'utf8' });
    let list = JSON.parse(raw || '[]');
    if (!Array.isArray(list)) list = [list];
    const data = list.filter(p => p.Name).map(p => ({
      name: p.Name,
      status: p.PrinterStatus === 0 ? 'Ready' : 'Error/Offline',
      driver: p.DriverName || ''
    }));
    return res.json({ status: 'success', data });
  } catch (err) {
    return res.json({ status: 'error', message: err.message });
  }
});

// ─── Queue Management API ──────────────────────────────────────

// 1. 대기열 목록 가져오기
app.get('/api/queue', (_req, res) => {
  // 전송 시 이미지는 제외하고 메타데이터만 전송
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
<<<<<<< Updated upstream
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
=======
  const { printer_name, images, width_mm, length_mm, margin_offset_mm } = req.body;
  if (!printer_name || !images) return res.status(400).json({ status: 'error', message: 'Missing data' });

  const jobId = `job_${Date.now()}`;
  const newJob = {
    id: jobId,
    status: 'printing',
    timestamp: new Date().toISOString(),
    printer: printer_name,
    images: images,
    width: width_mm,
    length: length_mm,
    margin: margin_offset_mm
  };

  printQueue.unshift(newJob);
  if (printQueue.length > 10) printQueue.pop(); // 최대 10개만 유지

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

// 4. 작업 삭제/취소
app.delete('/api/queue/:jobId', (req, res) => {
  const index = printQueue.findIndex(q => q.id === req.params.jobId);
  if (index > -1) {
    printQueue.splice(index, 1);
    // 윈도우 스풀러 강제 취소 명령 (옵션)
    exec(`powershell "Get-PrintJob -PrinterName '*' | Where-Object { $_.JobDescription -match 'Ribbon' } | Remove-PrintJob"`);
    res.json({ status: 'success' });
  } else {
    res.status(404).json({ status: 'error', message: 'Not found' });
  }
});

// ─── Core Logic: Execute Print Job ─────────────────────────────
async function executePrintJob(job) {
  try {
    console.log(`[Queue] Starting Job: ${job.id} on ${job.printer}`);
    await printViaGDI(job.printer, job.images, parseFloat(job.width), parseFloat(job.length), parseFloat(job.margin) || 0);
    job.status = 'completed';
    console.log(`[Queue] Job Completed: ${job.id}`);
  } catch (err) {
    job.status = 'failed';
    console.error(`[Queue] Job Failed: ${job.id} - ${err.message}`);
  }
}

// ─── GDI Engine (v10.9 logic preserved) ───────────────────────
function printViaGDI(printerName, images, widthMM, segmentLengthMM, leftMarginMM) {
>>>>>>> Stashed changes
  return new Promise((resolve, reject) => {
    // images가 단일 경로면 배열로 변환
    const imageList = Array.isArray(images) ? images : [images];
    const safePrinter = printerName.replace(/'/g, "''");
<<<<<<< Updated upstream
    
    // mm → 1/100 inch 변환
    const widthUnits  = Math.round(widthMM  / 25.4 * 100);
    const lengthUnits = Math.round(lengthMM / 25.4 * 100);
    const canvasWidthUnits = 827; // A4 Fixed
    const imageHeightMM = lengthMM - cuttingMarginMM;
=======
    const segmentLengthUnits = Math.round(segmentLengthMM / 25.4 * 100);
    const canvasWidthUnits = 827; 
>>>>>>> Stashed changes
    const finalX = leftMarginMM - (widthMM / 2);
    const totalLengthUnits = segmentLengthUnits * images.length;

    const tmpFiles = [];
    images.forEach((img, idx) => {
      const rawData = img.includes(',') ? img.split(',')[1] : img;
      const tmpFile = path.join(TMP_DIR, `q_seg_${Date.now()}_${idx}.png`);
      fs.writeFileSync(tmpFile, Buffer.from(rawData, 'base64'));
      tmpFiles.push(tmpFile);
    });

    const fileListForPS = tmpFiles.map(f => `'${f.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`).join(',');

    console.log(`[GDI V11] Combined Job: ${imageList.length} pages, Center=${leftMarginMM}mm, Paper=${lengthMM}mm`);

    const psScript = `
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Drawing.Printing;
public class DevDev {
    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern int DocumentProperties(IntPtr h, IntPtr hp, string n, IntPtr outP, IntPtr inP, int f);
    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern bool OpenPrinter(string n, out IntPtr hp, IntPtr pd);
    [DllImport("winspool.drv")]
    public static extern bool ClosePrinter(IntPtr hp);
    public static void Force(PrinterSettings ps, int w, int l) {
        try {
            IntPtr h = ps.GetHdevmode();
            IntPtr p = Marshal.ReadIntPtr(h);
            Marshal.WriteInt32(p, 40, Marshal.ReadInt32(p, 40) | 2 | 4 | 8);
            Marshal.WriteInt16(p, 44, 256);
            Marshal.WriteInt16(p, 46, (short)l);
            Marshal.WriteInt16(p, 48, (short)w);
            IntPtr hp;
            if (OpenPrinter(ps.PrinterName, out hp, IntPtr.Zero)) {
                DocumentProperties(IntPtr.Zero, hp, ps.PrinterName, p, p, 10);
                ClosePrinter(hp);
            }
            ps.SetHdevmode(h);
            Marshal.FreeHGlobal(h);
        } catch {}
    }
}
"@

$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = '${safePrinter}'
$pd.PrintController = New-Object System.Drawing.Printing.StandardPrintController

<<<<<<< Updated upstream
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
=======
$totalL = ${totalLengthUnits} * 25.4 / 100
[DevDev]::Force($pd.PrinterSettings, [Math]::Round(${widthMM} * 10), [Math]::Round($totalL * 10))

$ps = New-Object System.Drawing.Printing.PaperSize("Ribbon", ${canvasWidthUnits}, ${totalLengthUnits})
$ps.RawKind = 256
$pd.DefaultPageSettings.PaperSize = $ps
$pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)

$imgs = @(${fileListForPS})
$bitmaps = New-Object System.Collections.Generic.List[System.Drawing.Image]
foreach($p in $imgs){ $bitmaps.Add([System.Drawing.Image]::FromFile($p)) }

$pd.Add_PrintPage({
  param($s, $e)
  $e.Graphics.PageUnit = [System.Drawing.GraphicsUnit]::Millimeter
  $offX = $e.PageSettings.HardMarginX / 100 * 25.4
  $offY = $e.PageSettings.HardMarginY / 100 * 25.4
  $e.Graphics.TranslateTransform(-$offX, -$offY)
  $y = 0
  $blackPen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 0.2)
  foreach($b in $bitmaps){
    $r = New-Object System.Drawing.RectangleF(${finalX}, $y, ${widthMM}, ${segmentLengthMM})
    $e.Graphics.DrawImage($b, $r)
    $y += ${segmentLengthMM}
    # Draw Fold Line after first segment if multiple
    if($y -lt ($totalL - 1)){
        $e.Graphics.DrawLine($blackPen, ${finalX}, $y, (${finalX} + ${widthMM}), $y)
    }
  }
  $blackPen.Dispose()
  $e.HasMorePages = $false
})
try { $pd.Print(); Write-Host "OK" } catch { Write-Error $_ } finally { $bitmaps | %{ $_.Dispose() }; $pd.Dispose() }
`;

    const psProc = spawn('powershell', ['-NoProfile', '-Command', psScript]);
    psProc.on('close', code => {
      tmpFiles.forEach(f => { try { fs.unlinkSync(f); } catch(e){} });
      if (code === 0) resolve(); else reject(new Error('PS Exit '+code));
    });
>>>>>>> Stashed changes
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
  console.log(`\n> 🚀 RibbonBridge v${VERSION} (Monitor Mode) at http://localhost:${PORT}\n`);
});
