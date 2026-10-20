// The camera QC's guardian framing in node (issue #359, the author: "During guardian encounters when locked in I should be
// able to always see the guardian, myself in full body and the floor. Right now with the mother snapper I cut off after
// the torso"): every temple's guardian built in its own arena (the world's level, its collision), awake on its body, the
// traveller locked on to it at points round it, the real CameraRig and the lock camera as main.js turns them
// (src/foes.js lockFollow, the guardian's steady turn), the guardian's box given to the rig as main.js gives it
// (src/lock-frame.js guardianBox). At each point: is he whole on the screen (his box's eight corners, his feet), the
// guardian (its box's corners), the floor between you? `fit: false` is the camera before the fix (no box given).
//
//   node scripts/camera-qc/sim-guardians.mjs [temple …] [--before]     a line per guardian: framed points, the worst
import * as THREE from 'three';
import { buildableById } from '../../src/levels/buildable.js';
import { Physics } from '../../src/physics.js';
import { CameraRig } from '../../src/player.js';
import { lockFollow, STEADY } from '../../src/foes.js';
import { guardianBox, framePoints } from '../../src/lock-frame.js';
import { analyse } from './lib.mjs';
import { loadSkin } from '../motion-audit/walk.mjs';
import { createKeeperCreature } from '../../src/characters/keeper-creature.js';
import { createElderCreature } from '../../src/characters/elder-v3-creature.js';

globalThis.window ??= { addEventListener() {} };
const dom = { addEventListener() {} };
const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
const F = { up: Y, fwd: Z, right: X };
const quiet = (f) => { const w = console.warn, l = console.log, i = console.info, e = console.error; console.warn = console.log = console.info = console.error = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; console.error = e; } };

/** Every temple's guardian: [the world it is built in, its temple]. */
export const GUARDIAN_ARENAS = [
  ['desert', 'desert'], ['incal', 'incal'], ['arzach', 'arzach'], ['arzach', 'arzach2'], ['perdide', 'perdide'], ['perdide', 'perdide2'],
  ['edena', 'edena'], ['underwater', 'underwater'], ['glassdunes', 'garage'], ['buried', 'buried'], ['moonfoundry', 'moonfoundry'],
  ['spheres', 'spheres'], ['spacecity', 'spacecity'], ['bazaar', 'bazaar'],
];

/**
 * The generated bodies the game swaps in once their GLB has loaded (src/temples/guardian-generated.js): node has no page
 * to fetch `/guardians/<id>/model.glb` from, so the GLBs are read from public/ as the motion audit reads them
 * (walk.mjs loadSkin) and swapped in here, as make() does in the game (issue #566: the Keeper and the Aerie's Elder were
 * framed by their old procedural bodies' boxes). Keyed by the wrapper's name.
 */
const [keeperGltf, elderGltf] = await Promise.all([loadSkin('keeper-v1'), loadSkin('elder-v3')]);
const GENERATED = {
  'Cistern-Keeper': () => createKeeperCreature(keeperGltf, { gameMaterial: true }),
  'Elder of Vael': () => createElderCreature(elderGltf, { gameMaterial: true, lod: true }),
};
// (the level's own fetch of them still fails in node, a moment later: its warning is about a body already swapped in)
{ const warn = console.warn; console.warn = (...a) => { if (!String(a[0]).includes('the generated body did not load')) warn(...a); }; }

const worlds = new Map();
/** A world built once: its level and collision. */
export function world(id) {
  if (worlds.has(id)) return worlds.get(id);
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById(id).create(scene));
  const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const w = { id, scene, level, physics };
  worlds.set(id, w);
  return w;
}

/** A temple's guardian in its arena, placed and posed awake (its fight's stance, no move under way). */
export function guardianArena(worldId, templeId) {
  const w = world(worldId);
  const rt = (w.level.temples ?? []).find((t) => t.id === templeId && t.guardian);
  if (!rt) throw new Error(`no guardian in ${worldId}/${templeId}`);
  const g = rt.guardian, m = g.model;
  const make = Object.entries(GENERATED).find(([name]) => m.group?.name?.startsWith(`${name} · `))?.[1];
  if (make && m.swap && !m.generated) quiet(() => m.swap(make()));
  m.pos.copy(m.home ?? g.arena.center);
  quiet(() => {
    g.place();
    const kit = { eye: null, ground: (x, y, z) => { const h = w.physics.groundAt(x, y, z, 6); return Number.isFinite(h) ? h : null; } };
    for (let i = 0, t = 0; i < 60; i++) m.animate(1 / 60, (t += 1 / 60), { state: 'fight', attack: null, k: 0, speed: 0, meter: 0.3, phase: 0, kit, pushed: false });
  });
  m.group.updateMatrixWorld(true);
  const box = guardianBox(m, m.pos, { min: new THREE.Vector3(), max: new THREE.Vector3() }, 0);
  return { ...w, rt, g, m, box, A: g.arena, name: g.def.name };
}

/** Points round the guardian on its arena's floor: `dists` m from its body's edge, `n` ways round, at least `wall` m inside the arena's edge. */
export function aroundGuardian(G, { dists = [5, 9], n = 6, wall = 4 } = {}) {
  const out = [], c = G.m.pos, A = G.A, r = (G.m.bodyR ?? (G.m.radius ?? 3) * 0.75);
  for (const d of dists) for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3, x = c.x + Math.sin(a) * (d + r), z = c.z + Math.cos(a) * (d + r);
    if (Math.hypot(x - A.center.x, z - A.center.z) > A.r - wall) continue;
    const y = G.physics.groundAt(x, A.y + 2, z, 5);
    // (on the arena's floor, with room to stand: not on a plinth's top or inside a pillar)
    if (!Number.isFinite(y) || Math.abs(y - A.y) > 0.6 || G.physics.roomAt(new THREE.Vector3(x, y + 1.2, z), 0.45) < 0.4) continue;
    out.push(new THREE.Vector3(x, y, z));
  }
  return out;
}

const _n = new THREE.Vector3();
/** Of `pts`, the share inside the frame (NDC within ±`edge`, in front of the lens). */
export function inFrame(camera, pts, edge = 1) {
  let k = 0;
  for (const p of pts) { _n.copy(p).project(camera); if (_n.z < 1 && Math.abs(_n.x) <= edge && Math.abs(_n.y) <= edge) k++; }
  return k / pts.length;
}
const corners = (min, max) => Array.from({ length: 8 }, (_, k) => new THREE.Vector3(k & 1 ? max.x : min.x, k & 2 ? max.y : min.y, k & 4 ? max.z : min.z));

/**
 * The traveller standing locked on at `pos` for `secs` s (the camera behind him on the line to it first, as the lock
 * turns it): returns what is on the screen at the end and the rig. `fit` false: no box given to the rig (the camera
 * before issue #359).
 */
export function lockedAt(G, pos, { fit = true, secs = 4, dt = 1 / 60, aspect = 16 / 9 } = {}) {
  const camera = new THREE.PerspectiveCamera(55, aspect, 0.3, 5000);
  const rig = new CameraRig(camera, dom, G.physics);
  const f = { pos: G.m.pos.clone(), chest: G.m.pos.clone().addScaledVector(Y, G.m.floats ? 0 : (G.m.height ?? 3) * 0.5), def: { radius: G.m.bodyR ?? (G.m.radius ?? 2.6) * 0.75 }, turn: STEADY.turn };
  rig.yaw = Math.atan2(-(f.pos.x - pos.x), -(f.pos.z - pos.z));
  const view = { foe: null, side: 1, angle: 0, line: 0, turn: 0, vel: 0 };
  rig._jumped = true;
  for (let i = 0; i < secs / dt; i++) {
    rig.locked = true; rig.lockAt = f.chest; rig.frameWith = fit ? G.box : null;
    lockFollow(view, rig, f, pos, F, dt);
    rig.update(pos, dt, null);
    rig._jumped = false;
  }
  camera.updateMatrixWorld(true);
  const him = corners(new THREE.Vector3(pos.x - 0.3, pos.y, pos.z - 0.3), new THREE.Vector3(pos.x + 0.3, pos.y + 1.75, pos.z + 0.3));
  const feet = [new THREE.Vector3(pos.x, pos.y + 0.05, pos.z)];
  const mid = G.box.min.clone().add(G.box.max).multiplyScalar(0.5);
  const floor = [new THREE.Vector3((pos.x + mid.x) / 2, pos.y, (pos.z + mid.z) / 2)];
  return {
    him: inFrame(camera, him), feet: inFrame(camera, feet), floor: inFrame(camera, floor),
    // (its body as the framing reads it: round its box's middle at its foot, middle and top, its foot's near side)
    foe: inFrame(camera, framePoints(pos, G.box).slice(8, 15)), foeMid: inFrame(camera, [mid]),
    // (its foot and its middle, either side, and its foot's near side: what a cramped spot keeps when its top is lost)
    foeLow: inFrame(camera, [8, 9, 10, 11, 14].map((i) => framePoints(pos, G.box)[i])), foeTop: inFrame(camera, framePoints(pos, G.box).slice(12, 14)),
    arm: rig._curDist, pitch: rig._fitPitch ?? rig.pitch, rig, camera,
  };
}

/**
 * Circling the guardian locked on, a walk each way (the stick read from the lock's line, as sim-lock's walk), the
 * camera recorded every frame as the browser's QC records it: lib.mjs's measures (pops, jumps, spins, roughness), and
 * the frames where he or it left the screen.
 */
export function circleGuardian(G, { fit = true, secs = 6, dt = 1 / 60, start } = {}) {
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000);
  const rig = new CameraRig(camera, dom, G.physics);
  const f = { pos: G.m.pos.clone(), chest: G.m.pos.clone().addScaledVector(Y, G.m.floats ? 0 : (G.m.height ?? 3) * 0.5), def: { radius: G.m.bodyR ?? (G.m.radius ?? 2.6) * 0.75 }, turn: STEADY.turn };
  const pos = (start ?? aroundGuardian(G, { dists: [7, 5, 9], n: 6 })[0]).clone();
  rig.yaw = Math.atan2(-(f.pos.x - pos.x), -(f.pos.z - pos.z));
  const view = { foe: null, side: 1, angle: 0, line: 0, turn: 0, vel: 0 }, vel = new THREE.Vector3(), push = new THREE.Vector3();
  const S = [], fwd = new THREE.Vector3(), head = new THREE.Vector3(), chest = new THREE.Vector3(), n = new THREE.Vector3();
  const ndc = (p) => { n.copy(p).project(camera); return n.z > 1 ? null : [n.x, n.y]; };
  let t = 0, outHim = 0, outFoe = 0, outMid = 0, frames = 0;
  rig._jumped = true;
  for (const [stick, for_] of [[null, 1.5], [[1, 0], secs], [[-1, 0.2], secs], [[0, -1], 1], [[0, 1], 1]]) {
    for (let st = 0; st < for_; st += dt) {
      t += dt;
      rig.locked = true; rig.lockAt = f.chest; rig.frameWith = fit ? G.box : null;
      // (the stick read against it as the game reads it locked on: forward toward it, sideways round it, the circle kept:
      // src/player.js, Player.orbitLock)
      let move = null;
      const to = new THREE.Vector3(f.pos.x - pos.x, 0, f.pos.z - pos.z), R0 = to.length(); to.divideScalar(R0 || 1);
      if (stick) move = new THREE.Vector3(-to.z, 0, to.x).multiplyScalar(stick[0]).addScaledVector(to, stick[1]).normalize().multiplyScalar(3.8);
      vel.lerp(move ?? new THREE.Vector3(), 1 - Math.exp(-(move ? 8 : 16) * dt));
      pos.addScaledVector(vel, dt);
      if (stick && !stick[1]) { const R1 = Math.hypot(pos.x - f.pos.x, pos.z - f.pos.z); pos.x = f.pos.x + (pos.x - f.pos.x) * R0 / R1; pos.z = f.pos.z + (pos.z - f.pos.z) * R0 / R1; }
      // (kept in the arena and off its body, as the game's collision and the body block keep him)
      const A = G.A, dc = Math.hypot(pos.x - A.center.x, pos.z - A.center.z);
      if (dc > A.r - 1.2) { pos.x = A.center.x + (pos.x - A.center.x) * (A.r - 1.2) / dc; pos.z = A.center.z + (pos.z - A.center.z) * (A.r - 1.2) / dc; }
      const dg = Math.hypot(pos.x - f.pos.x, pos.z - f.pos.z), keep = f.def.radius + 1.2;
      if (dg < keep) { pos.x = f.pos.x + (pos.x - f.pos.x) * keep / dg; pos.z = f.pos.z + (pos.z - f.pos.z) * keep / dg; }
      if (G.physics.pushCapsule(pos, 0.45, 0.6, 2.2, push, Y)) { const n2 = push.clone().setY(0).normalize(); const into = vel.dot(n2); if (into < 0) vel.addScaledVector(n2, -into); }
      const gy = G.physics.groundAt(pos.x, pos.y + 1.2, pos.z, 3); if (Number.isFinite(gy)) pos.y = gy;
      rig._vel = vel;
      lockFollow(view, rig, f, pos, F, dt);
      rig.update(pos, dt, null);
      rig._jumped = false;
      camera.updateMatrixWorld(true);
      camera.getWorldDirection(fwd);
      head.copy(pos).addScaledVector(Y, 1.6); chest.copy(pos).addScaledVector(Y, 1.1);
      if (t > 1.5) {
        frames++;
        if (inFrame(camera, [pos.clone().addScaledVector(Y, 0.02), head]) < 1) outHim++;
        const fp = framePoints(pos, G.box);
        if (inFrame(camera, [8, 9, 10, 11, 14].map((i) => fp[i])) < 1) outFoe++;
        if (inFrame(camera, [G.box.min.clone().add(G.box.max).multiplyScalar(0.5)]) < 1) outMid++;
      }
      S.push({ t, dt, cam: camera.position.toArray(), look: rig._look.toArray(), pos: pos.toArray(), fwd: fwd.toArray(), cmdYaw: 0, cmdPitch: 0, clear: 1,
        occl: false, head: ndc(head), chest: ndc(chest), tight: rig.tightK, side: rig._side, shoulder: rig.shoulder, cur: rig._curDist, seg: 0 });
    }
  }
  const r = analyse(S);
  return { ...r, outHim: outHim / Math.max(1, frames), outFoe: outFoe / Math.max(1, frames), outMid: outMid / Math.max(1, frames), samples: S };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), fit = !args.includes('--before'), only = args.filter((a) => !a.startsWith('--'));
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  for (const [w, id] of GUARDIAN_ARENAS) {
    if (only.length && !only.includes(id)) continue;
    const G = guardianArena(w, id), size = G.box.max.clone().sub(G.box.min);
    const rows = aroundGuardian(G).map((p) => lockedAt(G, p, { fit }));
    const worst = (k) => Math.min(...rows.map((r) => r[k]));
    const ok = rows.filter((r) => r.him === 1 && r.feet === 1 && r.floor === 1 && r.foeLow === 1).length, whole = rows.filter((r) => r.foe === 1).length, seen = rows.filter((r) => r.him === 1 && r.feet === 1 && r.foeMid === 1).length;
    console.log(`${id.padEnd(12)} ${G.name.slice(0, 26).padEnd(26)} box ${size.toArray().map((v) => v.toFixed(1)).join('×')}  framed ${ok}/${rows.length} (whole ${whole}, both seen ${seen})  worst: him ${pct(worst('him'))} feet ${pct(worst('feet'))} floor ${pct(worst('floor'))} it ${pct(worst('foeLow'))} (top ${pct(worst('foeTop'))})  arm ${Math.min(...rows.map((r) => r.arm)).toFixed(1)}–${Math.max(...rows.map((r) => r.arm)).toFixed(1)} m`);
    if (args.includes('--circle')) {
      const c = circleGuardian(G, { fit }), m = c.measures;
      console.log(`   circling: ${c.green ? 'green' : 'RED'} pops ${m.pops} jumps ${m.jumps} look ${m.lookJumps} spins ${m.spins} rough ${(m.rms * 100).toFixed(2)} cm, him out ${pct(c.outHim)}, its middle out ${pct(c.outMid)}, its foot and middle out ${pct(c.outFoe)}${c.green ? '' : ' | ' + c.fails.join('; ')}`);
    }
  }
}
