// #800 family F: working pictures of this checkout's foes through the creatures gallery's `foe` view (the game's own body
// through Foes.look, alone, large, 3D only: scripts/changelog-shots.mjs shoot), for looking at a body while it is made.
// PNGs into <out-dir>; not changelog media (pair-shots.mjs in familyA-tripo makes those).
//
//   PORT=5442 CDP=5443 node references/enemy-redesign-2026-10-30/trials/familyF-tripo/shots.mjs <out-dir> \
//     <name>=<kind@skin>[:<pose>[:<at>[:<yaw>[:<pitch>[:<zoom>]]]]] …
//
// Muted: the gallery builds no Sound; Chrome runs with --mute-audio (scripts/changelog-shots.mjs chrome).
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, chrome, shoot, DEFAULT_VIEW } from '../../../../scripts/changelog-shots.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const [OUT, ...SPECS] = process.argv.slice(2);
if (process.env.PORT === '5173') throw new Error('never 5173');
mkdirSync(OUT, { recursive: true });
const shots = SPECS.map((s) => { const [name, rest] = s.split('='); const [id, pose = 'idle', at = '0.8', yaw = '0.75', pitch = '0.12', zoom = '0.66'] = rest.split(':');
  return { name, foe: { id, pose, at: +at, yaw: +yaw, pitch: +pitch, zoom: +zoom } }; });
const c = await chrome(), server = await serve(ROOT);
try {
  for (const s of shots) { await shoot(c, `http://127.0.0.1:${process.env.PORT}/`, { ...DEFAULT_VIEW, foe: s.foe }, join(OUT, `${s.name}.png`)); console.log(s.name); }
} finally { await server.close(); await c.close(); }
