// The trial page's own Vite (never 5173): PORT=5486 node references/enemy-redesign-2026-10-30/trials/serve.mjs
// then open /references/enemy-redesign-2026-10-30/trials/arena.html. Ctrl-C stops it.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const PORT = Number(process.env.PORT ?? 5486);
if (PORT === 5173) throw new Error('5173 is the author’s own dev server');
const { createServer } = await import('vite');
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), cacheDir: join(ROOT, '.vite-cache'), logLevel: 'error', clearScreen: false,
  server: { port: PORT, strictPort: true, host: '127.0.0.1', fs: { strict: false }, hmr: false, watch: null } });
await server.listen();
console.log(`http://127.0.0.1:${PORT}/references/enemy-redesign-2026-10-30/trials/arena.html`);
