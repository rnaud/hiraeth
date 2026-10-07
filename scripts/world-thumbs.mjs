// The worlds list's pictures (public/thumbs/<id>.jpg, the cards of Debug / L: src/world-picker.js): every
// world from where it starts, at its own hour (its level.defaults, else 10), clear, High (scripts/changelog-shots.mjs:
// the same headless Chrome on the GPU and the same views), the HUD hidden, a save past the prologue.
// Served from this checkout by its own Vite (never the author's dev server). 640 × 380 JPEGs (sips: macOS).
//
//   node scripts/world-thumbs.mjs                 every world
//   node scripts/world-thumbs.mjs desert,bazaar   those only
// PORT (default 5430) is Vite's, PORT+1 Chrome's debugging port.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, chrome, shoot, DEFAULT_VIEW } from './changelog-shots.mjs';
import { LEVELS } from '../src/levels/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 5430);
export const THUMB = { width: 640, height: 380, quality: 78 };
// the world's own hour, the clock stopped there
const OWN_HOUR = `const h = window.level?.defaults?.hour ?? 10; if (window.sky) { window.sky.hour = h; window.sky.speed = 0; window.updateSky?.(); }`;
/** The camera held at the traveller's start + `eye`, looking at start + `at` (a world whose start view is no picture). */
const fromStart = (eye, at) => `${OWN_HOUR}
  const { THREE, camera } = window, p = window.player.pos.clone();
  const e = p.clone().add(new THREE.Vector3(...${JSON.stringify(eye)})), t = p.clone().add(new THREE.Vector3(...${JSON.stringify(at)}));
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(e, t, new THREE.Vector3(0, 1, 0)));
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (f) { this.position.copy(e); this.quaternion.copy(q); if (this.fov !== 55) { this.fov = 55; this.updateProjectionMatrix(); } return base.call(this, f); };`;
/** A world's own view where its start isn't the picture. */
export const THUMB_VIEWS = {
  home: { setup: fromStart([0, 4, -10], [0, 1.5, 25]) },   // (it starts on a close-up of the traveller: the houses over his shoulder)
  overnighttrain: { setup: fromStart([178, 0.6, -24], [82, 3.2, 3]) },   // (it starts on the landing wagon by the ship: the train from outside, its nose and the station)
};
// (to try a view: THUMB_VIEW='{"setup":"…"}' node scripts/world-thumbs.mjs home)
const tryView = process.env.THUMB_VIEW ? JSON.parse(process.env.THUMB_VIEW) : {};

const only = process.argv[2]?.split(',');
const ids = LEVELS.map((l) => l.id).filter((id) => !only || only.includes(id));
const work = mkdtempSync(join(tmpdir(), 'memento-thumbs-'));
const server = await serve(ROOT);
const c = await chrome();
let failed = 0;
try {
  for (const id of ids) {
    const png = join(work, `${id}.png`), jpg = join(ROOT, 'public/thumbs', `${id}.jpg`);
    try {
      await shoot(c, `http://127.0.0.1:${PORT}/`, { ...DEFAULT_VIEW, size: [THUMB.width * 2, THUMB.height * 2], level: id, settle: 4000, wait: 3000, hour: null, setup: OWN_HOUR, ...THUMB_VIEWS[id], ...tryView }, png);
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(THUMB.quality), '-z', String(THUMB.height), String(THUMB.width), png, '--out', jpg], { stdio: 'ignore' });
      console.log(`${id}: ${(statSync(jpg).size / 1024).toFixed(0)} KB`);
    } catch (e) { failed++; console.error(`${id} FAILED: ${e.message}`); }
  }
} finally {
  await c.close();
  await server.close();
  rmSync(work, { recursive: true, force: true });
}
if (failed) { console.error(`${failed} pictures failed`); process.exitCode = 1; }
