// A family E foe alone in the creatures gallery (enemies.html, the game's own body through Foes.look), one picture a
// view, for looking at a body while it is built (#800): scripts/changelog-shots.mjs's `shoot` with a `foe` view, this
// checkout served; PNGs into the folder given. Muted: the gallery builds no Sound; Chrome runs with --mute-audio.
//
//   PORT=5481 CDP=5482 node references/enemy-redesign-2026-10-30/trials/familyE-tripo/foe-shots.mjs <out-dir> \
//     <name>=<kind@skin>[:<pose>[:<at>[:<yaw>[:<pitch>[:<zoom>]]]]] …
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, chrome, shoot, DEFAULT_VIEW } from '../../../../scripts/changelog-shots.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
if (process.env.PORT === '5173') throw new Error('never 5173');
const [OUT, ...SPECS] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const shots = SPECS.map((s) => { const [name, rest] = s.split('='); const [id, pose = 'idle', at = '0.8', yaw = '0.75', pitch = '0.12', zoom = '0.66'] = rest.split(':'); return { name, foe: { id, pose, at: +at, yaw: +yaw, pitch: +pitch, zoom: +zoom } }; });
const c = await chrome();
const server = await serve(ROOT);
try {
  for (const s of shots) { const png = join(OUT, `${s.name}.png`); await shoot(c, `http://127.0.0.1:${process.env.PORT}/`, { ...DEFAULT_VIEW, foe: s.foe }, png); console.log(png); }
} finally { await server.close(); await c.close(); }
