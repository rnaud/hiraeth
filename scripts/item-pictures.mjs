// Every item's picture for the items page (items.html, src/items-page/): the game draws each item's own
// model as its menu does (src/item-icons.js: the game's pipeline, ink lines and all, on the slots' paper),
// in a headless Chrome against this checkout's own Vite (never the author's dev server), and they are kept
// as public/item-pictures/<id>.webp (cwebp). Re-run it when an item is added or its model changes.
//
//   node scripts/item-pictures.mjs            every item
//   node scripts/item-pictures.mjs bell,echo  those only
// PORT (default 5430) is Vite's, PORT+1 Chrome's debugging port.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, chrome, shoot, DEFAULT_VIEW } from './changelog-shots.mjs';
import { ITEMS } from '../src/items.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 5430);
export const PICTURE = { size: 256, quality: 80, dir: 'public/item-pictures' };
const only = process.argv[2]?.split(',');
const ids = Object.keys(ITEMS).filter((id) => !only || only.includes(id));
const work = mkdtempSync(join(tmpdir(), 'memento-items-'));
mkdirSync(join(ROOT, PICTURE.dir), { recursive: true });
const server = await serve(ROOT);
const c = await chrome();
let failed = 0;
try {
  // the game up in the desert (any world: the pictures are drawn high over the traveller, alone)
  await shoot(c, `http://127.0.0.1:${PORT}/`, { ...DEFAULT_VIEW, level: 'desert', wait: 1000, setup: 'window.foes?.list?.forEach((f) => window.foes.remove(f));' }, join(work, 'world.png'));
  for (const id of ids) {
    const url = await c.ev(`(async () => {
      const I = window.itemIcons; I.cache.delete(${JSON.stringify(id)}); I.get(${JSON.stringify(id)});
      for (let i = 0; i < 40 && I.queue.length; i++) { I.pump(); await new Promise((r) => requestAnimationFrame(r)); }
      return I.cache.get(${JSON.stringify(id)}) ?? null;
    })()`);
    if (!url) { failed++; console.error(`${id}: no picture`); continue; }
    const ext = url.startsWith('data:image/png') ? 'png' : 'jpg', raw = join(work, `${id}.${ext}`), out = join(ROOT, PICTURE.dir, `${id}.webp`);
    writeFileSync(raw, Buffer.from(url.split(',')[1], 'base64'));
    execFileSync('cwebp', ['-quiet', '-q', String(PICTURE.quality), '-resize', String(PICTURE.size), '0', raw, '-o', out]);
    console.log(`${id}: ${(statSync(out).size / 1024).toFixed(0)} KB`);
  }
} finally {
  await c.close();
  await server.close();
  rmSync(work, { recursive: true, force: true });
}
if (failed) { console.error(`${failed} pictures failed`); process.exitCode = 1; }
