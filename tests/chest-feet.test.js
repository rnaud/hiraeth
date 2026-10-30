import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// "When I open a chest with a cinematic my character's feet move. They should be well planted before the cinematic starts"
// (issue #785). The opening sets him down square in front of the chest, turned to it (src/boxes/scene.js start), but the
// body went on as it had been: a stop from the walk or the run still to play, the gait in the blend, the turn read as a
// pivot, the relaxed stance (Player.idleLayer) easing in over half a second, and the feet still held where they had been
// before the cut. Under the scene's camera they took one or two settling steps, 0.2-0.8 m of foot travel in the first
// 0.3-0.6 s. Now the opening stands him still at once (Player.standStill): planted from its first frame.
import './register-gadgets.js';
import { ITEMS } from '../src/items.js';
import { BoxScene } from '../src/boxes/scene.js';
import { traveller, course, CAM_PLUS_Z } from './gait-sim.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const NO_INPUT = { jumpBlocked: true, crispStop: true };   // (main.js noInput: the controls taken while a box opens)
const quiet = (f) => { const e = console.error, w = console.warn; console.error = console.warn = () => {}; try { return f(); } finally { console.error = e; console.warn = w; } };

/** Walk (or run, or stand) up to a chest and open it: the feet's travel from the scene's first frame to the card. */
async function open(input, yaw) {
  const p = await traveller(course(), V(0, 0, -20), { moves: true, body: 'b3' });
  const dt = 1 / 60;
  for (let i = 0; i < 120; i++) { p.update(dt, input, CAM_PLUS_Z); p.object.updateMatrixWorld(true); }
  // the chest a little ahead and to the side, turned `yaw` (he is turned to face it as the scene opens)
  const at = p.pos.clone().add(V(0.3, 0, 1.6));
  const cam = { shot() {}, release() {}, hud() {}, bars() {} };
  const sc = new BoxScene({ box: { id: 'feet', pos: at, yaw, parts: { mats: {} }, scene: null }, def: ITEMS.lens, item: 'lens', player: p, cam, physics: p.physics,
    groundAt: (x, z, y) => p.physics.groundAt(x, y, z, 6), onGrant() {}, onEnd() {} });
  quiet(() => sc.start());
  const B = p.humanoid.b, bones = [B.ball_l, B.ball_r, B.foot_l, B.foot_r];
  let prev = null, most = 0, travel = 0, first = 0, frames = 0;
  for (let i = 0; i < 60 * 6 && sc.phase !== 'card'; i++) {
    p.update(dt, NO_INPUT, CAM_PLUS_Z); p.object.updateMatrixWorld(true);
    quiet(() => sc.update(dt));
    const now = bones.map((b) => b.getWorldPosition(V()));
    if (prev) for (let k = 0; k < now.length; k++) { const d = Math.hypot(now[k].x - prev[k].x, now[k].z - prev[k].z); most = Math.max(most, d); travel += d; if (frames <= 60) first += d; }
    prev = now; frames++;
  }
  sc.end?.();
  return { most, travel, first, frames, steps: [p.humanoid._feet.l, p.humanoid._feet.r].some((F) => F.step) };
}

test('a chest opened from a walk, a run or standing: his feet planted from the scene’s first frame, no step, no slide (#785)', async () => {
  const out = {};
  for (const [name, input, yaw] of [['walk', { KeyW: true }, Math.PI + 0.7], ['run', { KeyW: true, ShiftLeft: true }, Math.PI - 1.5], ['stand', {}, Math.PI], ['walk, turned round', { KeyW: true }, 0.4]]) {
    const r = await open(input, yaw);
    out[name] = { mostMm: +(1000 * r.most).toFixed(1), firstSecondCm: +(100 * r.first).toFixed(1), travelCm: +(100 * r.travel).toFixed(1), frames: r.frames };
    assert.ok(r.frames > 60, `${name}: the scene ran to its card (${r.frames} frames)`);
    // (a planted foot under the idle's breathing moves a fraction of a millimetre a frame; a settling step 1-11 cm)
    assert.ok(r.most < 0.003, `${name}: no foot moved more than 3 mm in a frame (${(1000 * r.most).toFixed(1)} mm)`);
    // (before: a step or two, 20-80 cm of foot travel in the first second; standing, the idle's breathing, a few mm)
    assert.ok(r.first < 0.03, `${name}: the four foot points went ${(100 * r.first).toFixed(1)} cm in the scene's first second`);
    assert.ok(!r.steps, `${name}: no step under way at the card`);
  }
  console.log('  feet in a chest opening:', JSON.stringify(out));
});
