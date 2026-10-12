// The Deck's run (scripts/bench/deck-worlds.mjs) on the Mac, a proxy while the Deck is away: the built game (dist/,
// `npx vite build` first) served on its own port and a muted headless Chrome on the real GPU at the Deck's 1280 × 800
// (pixel ratio 1), remote debugging on PORT + 1; it stays up until killed (Ctrl-C), then
//   node scripts/bench/deck-worlds.mjs --port <PORT + 1> --origin http://127.0.0.1:<PORT>/index.html --slow 4 ...
// The CPU slowed ×4 is roughly the Deck's main thread against an M-series Mac's; the GPU is not slowed (Metal on
// the Mac is far quicker than the Deck's), so its numbers say what the CPU side costs, not the Deck's GPU ms.
// PORT (default 5431). Never 5173 (the author's dev server).
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { tempDir, ownProcess } from '../temp-dirs.mjs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = Number(process.env.PORT ?? 5431), CDP = PORT + 1;
if (PORT === 5173 || CDP === 5173) throw new Error('5173 is the author’s own dev server: pick another PORT');
const DIST = resolve(process.env.DIST ?? join(ROOT, 'dist'));   // (DIST: another build, e.g. the one before a change)
if (!existsSync(join(DIST, 'index.html'))) throw new Error(`no ${DIST}/index.html: run npx vite build first`);
const { preview } = await import('vite');
const server = await preview({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'error', preview: { port: PORT, strictPort: true, host: '127.0.0.1' }, build: { outDir: DIST } });
const profile = tempDir('deck-mac-chrome-');
const chrome = ownProcess(spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist',
  '--force-device-scale-factor=1', '--window-size=1280,800', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--no-first-run', `http://127.0.0.1:${PORT}/manifest.webmanifest`], { stdio: 'ignore' }));
const stop = () => { try { chrome.kill('SIGKILL'); } catch { /* gone */ } server.httpServer.close(); rmSync(profile, { recursive: true, force: true }); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
chrome.on('exit', stop);
console.log(`serving dist/ on ${PORT}, Chrome's debugging on ${CDP}`);
