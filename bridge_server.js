const express = require('express');
const cors = require('cors');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json({ limit: '70mb' }));

console.log('--- Professional SaaS Ribbon Bridge (C# Hybrid) ---');

app.get('/', (req, res) => {
  res.send({ status: 'ok', message: 'SaaS Bridge Active' });
});

/**
 * 1. List Printers
 */
app.get('/api/printers', (req, res) => {
  try {
    const psCommand = 'powershell -Command "Get-Printer | Select-Object Name, PrinterStatus | ConvertTo-Json"';
    const output = execSync(psCommand).toString();
    let printers = JSON.parse(output || '[]');
    if (!Array.isArray(printers)) printers = [printers];

    const data = printers.map(p => ({
      name: p.Name,
      status: p.PrinterStatus === 0 ? 'Ready' : 'Busy',
      model: p.Name,
      brand: p.Name.toLowerCase().includes('epson') ? 'Epson' : 'Unknown'
    }));
    res.json({ status: 'success', data });
  } catch (err) {
    res.json({ status: 'error', message: err.message });
  }
});

/**
 * 2. Auto-Pairing (Silences 404 errors from UI)
 */
app.post('/api/pair', (req, res) => {
  // Currently frontend sends user_id to auto-pair.
  // In the JS native hybrid, we might use this later.
  res.json({ status: 'success', message: 'Paired ok' });
});

/**
 * 3. High Performance Ribbon Printing via Native EXE agent
 */
app.post('/api/print_image', async (req, res) => {
  const { printer_name, image_base64, width_mm, length_mm } = req.body;

  if (!printer_name || !image_base64) {
    return res.status(400).json({ status: 'error', message: 'Missing data' });
  }

  try {
    const tmpDir = path.join(os.tmpdir(), 'ribbon-saas');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const tmpFilePath = path.join(tmpDir, `job_${Date.now()}.png`);
    const image_data = image_base64.split(',')[1];
    fs.writeFileSync(tmpFilePath, Buffer.from(image_data, 'base64'));

    const agentPath = path.resolve(__dirname, 'ribbon_printer.exe');
    console.log(`[EXEC] ${printer_name} | Size: ${width_mm}x${length_mm}mm`);

    // The SaaS FIX: Calling our specialized C# tool that takes control of GDI
    const command = `"${agentPath}" "${printer_name}" "${tmpFilePath}" ${width_mm} ${length_mm}`;

    exec(command, (error, stdout, stderr) => {
      // Cleanup
      try { fs.unlinkSync(tmpFilePath); } catch (e) {}

      if (error || !stdout.includes('SUCCESS')) {
        console.error('Core error:', stderr || stdout);
        return res.json({ status: 'error', message: (stderr || stdout).trim() });
      }

      console.log('[AGENT] Print success reported.');
      res.json({ status: 'success' });
    });

  } catch (err) {
    console.error('Final bridge error:', err.message);
    res.json({ status: 'error', message: err.message });
  }
});

app.listen(port, () => {
  console.log(`> SaaS Bridge listening on http://localhost:${port}`);
  console.log(`> Strategy: Native Hybrid (NodeJS + C# Precision Agent)`);
});
