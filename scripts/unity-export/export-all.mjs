// Export every world of the web game for the Unity port, one process each (a world's story
// registers listeners on the shared game state: a fresh process keeps them apart):
//
//   node scripts/unity-export/export-all.mjs [--clean] [ids…]
//
// Writes unity/Memento/Assets/StreamingAssets/<id>/ for every world of src/levels/index.js
// on the route and home (or the ids given), and the shared store StreamingAssets/shared/
// (--clean starts it afresh). Everything it writes is git-ignored (about 4 GB in all).
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const clean = args.includes('--clean');
const { LEVELS } = await import('../../src/levels/index.js');
const ids = args.filter((a) => !a.startsWith('--'));
const worlds = ids.length ? ids : LEVELS.filter((l) => !l.dev && l.id !== 'atelier').map((l) => l.id);
if (clean) rmSync(resolve(here, '../../unity/Memento/Assets/StreamingAssets/shared'), { recursive: true, force: true });
const t0 = Date.now();
const failed = [];
for (const id of worlds) {
  const r = spawnSync(process.execPath, ['--max-old-space-size=12000', resolve(here, 'export-world.mjs'), id], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  const out = (r.stdout ?? '').trim().split('\n');
  console.log(`${id}: ${out[out.length - 1] ?? ''}`);
  if (r.status !== 0) { failed.push(id); console.log((r.stderr ?? '').split('\n').slice(0, 12).join('\n')); }
}
console.log(`${worlds.length - failed.length}/${worlds.length} worlds exported in ${((Date.now() - t0) / 1000).toFixed(0)} s${failed.length ? `; failed: ${failed.join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
