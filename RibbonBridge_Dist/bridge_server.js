// ═══════════════════════════════════════════════════════════════
//   RibbonBridge v25.0 — Premium SaaS Universal Engine
//   Support: Epson M-Series (ESC/P-R) & Xprinter (GDI/POS)
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

// Path to C# High-Performance Engine
const CS_ENGINE_PATH = path.join(BASE_DIR, 'ribbon_printer.exe');

// ─── App Setup ─────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '250mb' }));

if (!fs.existsSync(TMP_DIR)) {
    try { fs.mkdirSync(TMP_DIR, { recursive: true }); } catch (e) {}
}

// ─── Global Queue State ────────────────────────────────────────
let printQueue = [];

// ─── Boot Log (Premium Design) ──────────────────────────────────
console.clear();
console.log('\x1b[36m%s\x1b[0m', '  ╔══════════════════════════════════════════════════════════════╗');
console.log('\x1b[36m%s\x1b[0m', '  ║                                                              ║');
console.log('\x1b[36m%s\x1b[0m', `  ║      🚀 RIBBON BRIDGE v${VERSION} — PREMIUM PRINTING SERVER      ║`);
console.log('\x1b[36m%s\x1b[0m', '  ║                                                              ║');
console.log('\x1b[36m%s\x1b[0m', '  ╚══════════════════════════════════════════════════════════════╝');
console.log(`  > Platform      : \x1b[33m${os.platform()} ${os.release()}\x1b[0m`);
console.log(`  > Engine Mode   : \x1b[32m${fs.existsSync(CS_ENGINE_PATH) ? 'Hybrid (GDI + native-ESC/P)' : 'GDI Only'}\x1b[0m`);
console.log(`  > Local Server  : \x1b[34mhttp://localhost:${PORT}\x1b[0m`);
console.log(`  > Temporary Dir : ${TMP_DIR}`);
console.log('  \x1b[90m%s\x1b[0m', '  ────────────────────────────────────────────────────────────────');
console.log('    [STATUS] 리본 프린터 브릿지가 대기 중입니다...');

// ─── Routes ════════════════════════════════════════════════════

app.get('/', (_req, res) => {
  res.json({ 
    status: 'ok', 
    version: VERSION, 
    engine: fs.existsSync(CS_ENGINE_PATH) ? 'v25.0 Native-Turbo' : 'v25.0 GDI-Standard',
    features: [
      'Universal Printer Discovery',
      'Xprinter Auto-Cutter Support',
      'Absolute Margin Calibration',
      'Ultra-Banner Rendering'
    ],
    queue_count: printQueue.length,
    uptime: Math.floor(process.uptime())
  });
});

// 버전 체크 및 페어링
app.get('/api/version', (req, res) => res.json({ status: 'success', version: VERSION }));
app.post('/api/pair', (req, res) => res.json({ status: 'ok', version: VERSION, paired: true }));

// 프린터 목록 (개선된 분류 시스템)
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

      // 벤더 분류
      const d = (p.DriverName + ' ' + p.Name).toLowerCase();
      let vendor = 'generic';
      if (d.includes('epson') || d.includes('m10')) vendor = 'epson';
      else if (d.includes('xprinter') || d.includes('xp-')) vendor = 'xprinter';

      return {
        name: p.Name,
        status: statusStr,
        driver: p.DriverName || '',
        vendor: vendor,
        capabilities: {
           canCut: vendor === 'xprinter',
           nativeEpson: vendor === 'epson' && fs.existsSync(CS_ENGINE_PATH)
        }
      };
    });
    return res.json({ status: 'success', data });
  } catch (err) {
    return res.json({ status: 'error', message: err.message });
  }
});

// ─── Queue Management API ──────────────────────────────────────

app.get('/api/queue', (_req, res) => {
  res.json({ status: 'success', data: printQueue.slice(0, 10).map(q => ({
    id: q.id, status: q.status, timestamp: q.timestamp, printer: q.printer, segments: q.images.length
  }))});
});

app.post('/api/print_image', async (req, res) => {
  const { printer_name, images, width_mm, length_mm, margin_offset_mm, cutting_margin_mm = 0, vendor = 'generic' } = req.body;

  if (!printer_name || !images) {
    return res.status(400).json({ status: 'error', message: 'Missing parameters' });
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
    cutting_margin: cutting_margin_mm,
    vendor: vendor
  };

  printQueue.unshift(newJob);
  if (printQueue.length > 50) printQueue.pop();

  // Background execution
  executePrintJob(newJob);

  res.json({ status: 'success', job_id: jobId });
});

app.post('/api/queue/clear', (req, res) => {
  printQueue = [];
  res.json({ status: 'success' });
});

// ─── Core Logic: Execute Print Job ─────────────────────────────
async function executePrintJob(job) {
  const localPaths = [];
  try {
    console.log(`  \x1b[32m[PRINT]\x1b[0m ${job.id} (${job.images.length} segments) -> ${job.printer}`);

    // 1. Save base64 to temp files
    for (let i = 0; i < job.images.length; i++) {
      const pathStr = path.join(TMP_DIR, `${job.id}_${i}.png`);
      const imgData = job.images[i];
      const rawData = imgData.includes(',') ? imgData.split(',')[1] : imgData;
      fs.writeFileSync(pathStr, Buffer.from(rawData, 'base64'));
      localPaths.push(pathStr);
    }

    // 2. Select Engine
    if (job.vendor === 'epson' && fs.existsSync(CS_ENGINE_PATH)) {
        // Native C# Engine (ESC/P-R) - Precise Roll Support
        await printViaNativeCS(job);
    } else {
        // PowerShell GDI Engine (Universal)
        await printViaGDI(job.printer, localPaths, job.width, job.length, job.margin, job.cutting_margin);
    }

    job.status = 'completed';
    console.log(`  \x1b[36m[OK]\x1b[0m Job Complete: ${job.id}`);

  } catch (err) {
    job.status = 'error';
    job.error = err.message;
    console.error(`  \x1b[31m[ERROR]\x1b[0m ${job.id}: ${err.message}`);
  } finally {
    setTimeout(() => {
      localPaths.forEach(p => { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { } });
    }, 10000); // 10s retention
  }
}

// ─── Native C# Engine Wrapper ────────────────────────────────
function printViaNativeCS(job) {
    return new Promise((resolve, reject) => {
        // We only support single banner print for native engine currently (it merges internally in .cs if modified, 
        // but here we send the first path. If multi-segment, use GDI or refine .cs)
        const combinedImagePath = path.join(TMP_DIR, `${job.id}_0.png`);
        
        // ribbon_printer.exe "printer" "path" width length margin
        const args = [
            `"${job.printer}"`,
            `"${combinedImagePath}"`,
            job.width,
            job.length,
            job.margin
        ];

        const cmd = `"${CS_ENGINE_PATH}" ${args.join(' ')}`;
        exec(cmd, (err, stdout, stderr) => {
            if (err) return reject(err);
            if (stdout.includes('SUCCESS')) resolve();
            else reject(new Error(stdout || stderr));
        });
    });
}

// ─── GDI Engine (Standard PowerShell) ──────────────────────
function printViaGDI(printerName, images, widthMM, lengthMM, leftMarginMM, cuttingMarginMM = 0) {
  return new Promise((resolve, reject) => {
    const imageList = Array.isArray(images) ? images : [images];
    const safePrinter = printerName.replace(/'/g, "''");
    const totalLengthMM = (lengthMM * imageList.length) + cuttingMarginMM;
    
    const finalX = leftMarginMM - (widthMM / 2);
    const safeX = finalX < 0 ? 0 : finalX;

    const psScript = `
Add-Type -AssemblyName System.Drawing
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = '${safePrinter}'
$pd.PrintController = New-Object System.Drawing.Printing.StandardPrintController

$widthUnits = [int](210 / 25.4 * 100)
$totalLengthUnits = [int](${totalLengthMM} / 25.4 * 100)
$customPaper = New-Object System.Drawing.Printing.PaperSize("RibbonBanner", $widthUnits, $totalLengthUnits)
$customPaper.RawKind = 256 

$pd.DefaultPageSettings.PaperSize = $customPaper
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
    ps.stdout.on('data', d => { stdout += d.toString(); });
    ps.on('close', code => {
      if (code === 0 && stdout.includes('GDI_SUCCESS')) resolve();
      else reject(new Error(stdout || `PowerShell exit code ${code}`));
    });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`    [SERVER] Running at \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
});

