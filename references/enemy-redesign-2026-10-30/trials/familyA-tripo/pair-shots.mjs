// The changelog's before / after pictures of a family A foe (#800), made by hand (the commit is still to be rebased): each
// shot through scripts/changelog-shots.mjs's own `shoot` with a `foe` view (the creatures gallery, enemies.html: the
// game's own body through Foes.look, alone, large, 3D only, the same camera for both), the before at a commit (an archive
// of it, this checkout's node_modules linked in, served on the same port, deleted after), the after on this checkout;
// written as changelog-media/<version>/<name>-before|after.webp (cwebp, the page's size and quality).
//
//   PORT=5478 CDP=5479 node references/enemy-redesign-2026-10-30/trials/familyA-tripo/pair-shots.mjs <before-sha> <version> \
//     <name>=<kind@skin>[:<pose>[:<at>]][:yaw] …      (pose idle by default; yaw 0.75 three-quarter, π/2 its left side)
//
// Muted: the gallery builds no Sound; Chrome runs with --mute-audio (scripts/changelog-shots.mjs chrome).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, chrome, shoot, toWebp, DEFAULT_VIEW } from '../../../../scripts/changelog-shots.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const [BEFORE, VERSION, ...SPECS] = process.argv.slice(2);
if (process.env.PORT === '5173') throw new Error('never 5173');
const shots = SPECS.map((s) => { const [name, rest] = s.split('='); const [id, pose = 'idle', at = '0.8', yaw = '0.75'] = rest.split(':'); return { name, foe: { id, pose, at: +at, yaw: +yaw } }; });
const work = mkdtempSync(join(process.env.TMP ?? tmpdir(), 'hiraeth-pairs-'));
const c = await chrome();
try {
  for (const side of ['before', 'after']) {
    let dir = ROOT;
    if (side === 'before') {
      dir = join(work, 'src');
      execFileSync('sh', ['-c', `mkdir -p "${dir}" && git archive ${BEFORE} | tar -x -C "${dir}"`], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], maxBuffer: 1 << 30 });
      symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
    }
    const server = await serve(dir);
    try {
      for (const s of shots) {
        const png = join(work, `${s.name}-${side}.png`), v = { ...DEFAULT_VIEW, foe: s.foe };
        await shoot(c, `http://127.0.0.1:${process.env.PORT}/`, v, png);
        const kb = toWebp(png, join(ROOT, 'changelog-media', VERSION, `${s.name}-${side}.webp`)) / 1024;
        console.log(`${VERSION}/${s.name} ${side}: ${kb.toFixed(0)} KB`);
      }
    } finally { await server.close(); }
  }
} finally {
  await c.close();
  if (!process.env.KEEP_PNG) rmSync(work, { recursive: true, force: true }); else console.log('PNGs kept in', work);
}
