import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// 윈도우 폰트 폴더를 직접 읽는 Vite 개발 서버 플러그인
function fontsApiPlugin() {
  const FONTS_DIR = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');
  const FONT_EXTENSIONS = ['.ttf', '.otf', '.ttc', '.woff', '.woff2'];

  return {
    name: 'fonts-api',
    configureServer(server: any) {
      // GET /api/local-fonts  →  윈도우 폰트 목록 반환
      server.middlewares.use('/api/local-fonts', (req: any, res: any, next: any) => {
        // /api/local-fonts/file/xxx 는 다른 핸들러로 넘김
        if (req.url && req.url.startsWith('/file/')) return next();
        
        try {
          const files = fs.readdirSync(FONTS_DIR);
          const fonts = files
            .filter(f => FONT_EXTENSIONS.includes(path.extname(f).toLowerCase()))
            .map(f => {
              const fullPath = path.join(FONTS_DIR, f);
              let sizeKb = 0;
              try { sizeKb = Math.round(fs.statSync(fullPath).size / 1024 * 10) / 10; } catch {}
              return {
                filename: f,
                name: path.parse(f).name,
                size_kb: sizeKb,
                extension: path.extname(f).toLowerCase()
              };
            })
            .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'success', count: fonts.length, fonts }));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ status: 'error', message: e.message }));
        }
      });

      // GET /api/local-fonts/file/:filename  →  폰트 파일 직접 제공 (바이너리)
      server.middlewares.use('/api/local-fonts/file', (req: any, res: any) => {
        try {
          // req.url에서 쿼리스트링 제거 후 디코딩
          let rawUrl = (req.url || '').split('?')[0].replace(/^\//, '');
          let filename: string;
          try {
            filename = decodeURIComponent(rawUrl);
          } catch {
            filename = rawUrl;
          }
          const safeName = path.basename(filename);
          const fontPath = path.join(FONTS_DIR, safeName);
          
          console.log(`[FontsAPI] Serving font: "${safeName}" → ${fontPath}`);
          
          if (!fs.existsSync(fontPath)) {
            console.error(`[FontsAPI] File not found: ${fontPath}`);
            res.statusCode = 404;
            res.end(JSON.stringify({ error: `Font not found: ${safeName}` }));
            return;
          }

          const stat = fs.statSync(fontPath);
          const data = fs.readFileSync(fontPath);
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Content-Length', stat.size.toString());
          res.end(data);
        } catch (e: any) {
          console.error(`[FontsAPI] Error serving font:`, e);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), fontsApiPlugin()],
})
