// The camera QC's foe framing in node (issue #752, the author: "When locked on enemies I should see the whole enemy and
// myself and the ground like Zelda botw"): every built foe kind's body (src/enemies/plans archetypeModel) stood in the
// Arena's middle, the traveller locked on to it 2, 5 and 9 m off at points round it, the real CameraRig and the lock
// camera as the game turns them (src/foes.js lockFollow), the foe's box given to the rig as the game gives it
// (src/lock-frame.js foeBox). At each point: is its drawn body whole on the screen, he whole, his feet, the ground at its
// feet, and does his body cover no more than FRAME_COVER of it (lib.mjs FRAME_EDGE, FRAME_COVER)? `fit: false` is the
// camera before #752 (no box given for a foe that is not a guardian).
//
//   node scripts/camera-qc/sim-foes.mjs [kind …] [--before] [--circle]     a line per kind: framed points by distance
import * as THREE from 'three';
import { CameraRig } from '../../src/player.js';
import { Foe, lockFollow } from '../../src/foes.js';
import { foeBox } from '../../src/lock-frame.js';
import { bodySpan } from '../../src/foe-body.js';
import { archetypeModel } from '../../src/enemies/plans/index.js';
import { analyse, cover, FRAME_EDGE, FRAME_COVER } from './lib.mjs';
import { world } from './sim-guardians.mjs';
import { FRAME_KINDS } from './scenarios.mjs';

globalThis.window ??= { addEventListener() {} };
const dom = { addEventListener() {} };
const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
const F = { up: Y, fwd: Z, right: X };
const quiet = (f) => { const w = console.warn, l = console.log; console.warn = console.log = () => {}; try { return f(); } finally { console.warn = w; console.log = l; } };

/** A built kind's foe standing in the Arena's middle, its body posed as built and placed where the game draws it (its footing, a flyer up at its hover). */
export function arenaFoe(kind, at = new THREE.Vector3(0, 0, 0)) {
  const W = world('arena');
  const f = quiet(() => new Foe(kind, at.clone()));
  f.model = quiet(() => archetypeModel(f.kind, null, 0));
  f.model.group.position.copy(f.bodyAt());
  f.model.group.rotation.y = 0;
  f.model.group.updateMatrixWorld(true);
  return { ...W, f };
}

const _n = new THREE.Vector3();
const inF = (camera, p, E = FRAME_EDGE) => { _n.copy(p).project(camera); return _n.z < 1 && Math.abs(_n.x) <= E && Math.abs(_n.y) <= E; };
const rect = (camera, pts) => { let b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of pts) { _n.copy(p).project(camera); if (_n.z > 1) return null; b = [Math.min(b[0], _n.x), Math.min(b[1], _n.y), Math.max(b[2], _n.x), Math.max(b[3], _n.y)]; }
  return b; };
const corners = (min, max) => Array.from({ length: 8 }, (_, k) => new THREE.Vector3(k & 1 ? max.x : min.x, k & 2 ? max.y : min.y, k & 4 ? max.z : min.z));

/** What a camera frames, locked on to `f` from his feet at `pos`: [its body whole, he whole, his feet, the ground at its feet, his cover of it] (as the browser's QC records `whole`). */
export function framed(camera, f, pos) {
  const b = bodySpan(f.model)._box, body = corners(b.min, b.max);
  const him = corners(new THREE.Vector3(pos.x - 0.3, pos.y, pos.z - 0.3), new THREE.Vector3(pos.x + 0.3, pos.y + 1.75, pos.z + 0.3));
  const fr = rect(camera, body), pr = rect(camera, him);
  return [+body.every((p) => inF(camera, p)), +him.every((p) => inF(camera, p)), +inF(camera, pos.clone().addScaledVector(Y, 0.03)),
    +inF(camera, f.pos.clone().addScaledVector(Y, 0.03)), fr && pr ? cover(fr, pr) : 1];
}
export const allFramed = (w) => w.slice(0, 4).every(Boolean) && w[4] <= FRAME_COVER;

/** Locked on at `pos` for `secs` s, the camera behind him on the line to it first: what is framed then, the arm and the rig. */
export function lockedOn(G, pos, { fit = true, secs = 3, dt = 1 / 60, aspect = 16 / 9 } = {}) {
  const camera = new THREE.PerspectiveCamera(55, aspect, 0.3, 5000), f = G.f;
  const rig = new CameraRig(camera, dom, G.physics);
  rig.yaw = Math.atan2(-(f.pos.x - pos.x), -(f.pos.z - pos.z));
  const view = { foe: null, side: 1, angle: 0, line: 0, turn: 0, vel: 0 }, box = { min: new THREE.Vector3(), max: new THREE.Vector3() };
  rig._jumped = true;
  for (let i = 0, t = 0; i < secs / dt; i++, t += dt) {
    rig.locked = true; rig.lockAt = f.chest; rig.frameWith = fit ? foeBox(f, f.pos, box, t, bodySpan) : null;
    lockFollow(view, rig, f, pos, F, dt);
    rig.update(pos, dt, null);
    rig._jumped = false;
  }
  camera.updateMatrixWorld(true);
  return { whole: framed(camera, f, pos), arm: rig._curDist, pitch: Math.asin(-camera.getWorldDirection(new THREE.Vector3()).y), fov: camera.fov, rig, camera };
}

/** Points `d` m from it, `n` ways round (on the Arena's floor). */
export const around = (G, d, n = 6) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + 0.2; return new THREE.Vector3(G.f.pos.x + Math.sin(a) * d, 0, G.f.pos.z + Math.cos(a) * d); });

/**
 * Circling it locked on at `d` m, each way, then stepping in and back (the stick read from the lock's line, as sim-lock's
 * walk): the camera recorded every frame as the browser's QC records it, lib.mjs's measures, and the share of frames framed.
 */
export function circle(G, { fit = true, d = 4, secs = 5, dt = 1 / 60 } = {}) {
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000), f = G.f;
  const rig = new CameraRig(camera, dom, G.physics);
  const pos = new THREE.Vector3(f.pos.x, 0, f.pos.z + d);
  rig.yaw = 0;
  const view = { foe: null, side: 1, angle: 0, line: 0, turn: 0, vel: 0 }, vel = new THREE.Vector3(), box = { min: new THREE.Vector3(), max: new THREE.Vector3() };
  const S = [], fwd = new THREE.Vector3(), head = new THREE.Vector3(), chest = new THREE.Vector3(), n = new THREE.Vector3();
  const ndc = (p) => { n.copy(p).project(camera); return n.z > 1 ? null : [n.x, n.y]; };
  let t = 0, ok = 0, frames = 0;
  rig._jumped = true;
  for (const [stick, for_] of [[null, 1], [[1, 0], secs], [[-1, 0], secs], [[0, -1], 1], [[0, 1], 1]]) {
    for (let st = 0; st < for_; st += dt) {
      t += dt;
      rig.locked = true; rig.lockAt = f.chest; rig.frameWith = fit ? foeBox(f, f.pos, box, t, bodySpan) : null;
      const to = new THREE.Vector3(f.pos.x - pos.x, 0, f.pos.z - pos.z), R0 = to.length(); to.divideScalar(R0 || 1);
      const move = stick ? new THREE.Vector3(-to.z, 0, to.x).multiplyScalar(stick[0]).addScaledVector(to, stick[1]).normalize().multiplyScalar(3.2) : new THREE.Vector3();
      vel.lerp(move, 1 - Math.exp(-(stick ? 8 : 16) * dt));
      pos.addScaledVector(vel, dt);
      if (stick && !stick[1]) { const R1 = Math.hypot(pos.x - f.pos.x, pos.z - f.pos.z); pos.x = f.pos.x + (pos.x - f.pos.x) * R0 / R1; pos.z = f.pos.z + (pos.z - f.pos.z) * R0 / R1; }
      rig._vel = vel;
      lockFollow(view, rig, f, pos, F, dt);
      rig.update(pos, dt, null);
      rig._jumped = false;
      camera.updateMatrixWorld(true);
      camera.getWorldDirection(fwd);
      head.copy(pos).addScaledVector(Y, 1.6); chest.copy(pos).addScaledVector(Y, 1.1);
      if (t > 1.5) { frames++; if (allFramed(framed(camera, f, pos))) ok++; }
      S.push({ t, dt, cam: camera.position.toArray(), look: rig._look.toArray(), pos: pos.toArray(), fwd: fwd.toArray(), cmdYaw: 0, cmdPitch: 0, clear: 1,
        occl: false, head: ndc(head), chest: ndc(chest), tight: rig.tightK, side: rig._side, shoulder: rig.shoulder, cur: rig._curDist, seg: 0 });
    }
  }
  return { ...analyse(S), framed: ok / Math.max(1, frames), samples: S };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), fit = !args.includes('--before'), only = args.filter((a) => !a.startsWith('--'));
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  const tot = { 2: [0, 0], 5: [0, 0], 9: [0, 0] };
  for (const kind of only.length ? only : FRAME_KINDS) {
    const G = arenaFoe(kind), b = bodySpan(G.f.model)._box, size = b.max.clone().sub(b.min);
    const cols = [2, 5, 9].map((d) => {
      const rows = around(G, d).map((p) => lockedOn(G, p, { fit }));
      const k = rows.filter((r) => allFramed(r.whole)).length;
      tot[d][0] += k; tot[d][1] += rows.length;
      const lost = ['it', 'him', 'feet', 'ground'].filter((_, i) => rows.some((r) => !r.whole[i])).concat(rows.some((r) => r.whole[4] > FRAME_COVER) ? ['covered'] : []);
      return `${d} m ${k}/${rows.length}${lost.length ? ` (${lost.join(', ')})` : ''} arm ${Math.min(...rows.map((r) => r.arm)).toFixed(1)}–${Math.max(...rows.map((r) => r.arm)).toFixed(1)} pitch ${Math.min(...rows.map((r) => r.pitch)).toFixed(2)}–${Math.max(...rows.map((r) => r.pitch)).toFixed(2)} fov ${Math.max(...rows.map((r) => r.fov)).toFixed(0)}`;
    });
    console.log(`${kind.padEnd(11)} ${size.toArray().map((v) => v.toFixed(1)).join('×').padEnd(13)} ${cols.join(' | ')}`);
    if (args.includes('--circle')) {
      const c = circle(G, { fit }), m = c.measures;
      console.log(`   circling at 4 m: ${c.green ? 'green' : 'RED'} pops ${m.pops} jumps ${m.jumps} look ${m.lookJumps} spins ${m.spins} rough ${(m.rms * 100).toFixed(2)} cm, framed ${pct(c.framed)}${c.green ? '' : ' | ' + c.fails.join('; ')}`);
    }
  }
  console.log(`all: ${Object.entries(tot).map(([d, [k, n]]) => `${d} m ${k}/${n} (${pct(k / n)})`).join(', ')}`);
}
