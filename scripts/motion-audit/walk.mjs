// Walking the game's own foes in node, for the motion audit (run.mjs) and its regression tests
// (tests/motion-plans.test.js). docs/systems/procedural-animation.md, "Measuring".
//
// A foot is the lowest world-space vertex under its leg's pivot; the hip is the pivot's world position. Each
// subject walks at its own speed on flat ground (y = 0) after 1 s to settle. With `pack`, a second foe of the
// same kind walks beside it and `unison` is how alike their first legs' heights run (1: in step).
import * as THREE from 'three';
import { Foes } from '../../src/foes.js';
import { GameState } from '../../src/game-state.js';
import { keeperModel, sentinelModel, foremanModel, gardenerModel, signModel } from '../../src/temples/guardians.js';
import { walkReport, correlation } from './metrics.mjs';

export const DT = 1 / 60, SETTLE = 60, FRAMES = 240;
const v = new THREE.Vector3();

/** The lowest vertex (world) in an object's subtree. */
export function lowest(obj, out) {
  let best = Infinity;
  obj.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 400))) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      if (v.y < best) { best = v.y; out.copy(v); }
    }
  });
  return out;
}

/** Record feet, hips and body over the run; step(dt, t) advances the subject one frame. */
export function record({ root, legs, step, torso = root, seconds = FRAMES * DT, extra = null }) {
  const feet = legs.map(() => []), hips = legs.map(() => []), body = [], f = new THREE.Vector3(), h = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i < SETTLE + FRAMES; i++) {
    step(DT, i * DT);
    root.updateMatrixWorld(true);
    extra?.root.updateMatrixWorld(true);
    if (i < SETTLE) continue;
    legs.forEach((L, k) => { lowest(L, f); L.getWorldPosition(h); feet[k].push(f.toArray()); hips[k].push(h.toArray()); });
    body.push(torso.getWorldPosition(b).toArray());   // (the drawn body, so its bob counts)
    if (extra) extra.heights.push(lowest(extra.leg, f).y);
  }
  return { ...walkReport({ feet, hips, body, seconds }), heights: feet[0]?.map((p) => p[1]) ?? [] };
}

/** A foes system on flat ground, the traveller far ahead (they chase in a straight line). */
export function foeSystem() {
  return new Foes({ scene: new THREE.Scene(), level: { spawn: new THREE.Vector3(0, 0, -200) }, levelId: 'arena', physics: { groundAt: () => 0 }, player: { pos: new THREE.Vector3(0, 0, 50), health: 1, vel: new THREE.Vector3(), hurt() {} }, game: new GameState(null) });
}

// Where each old kind keeps its legs: on the kit, its rig's chains; before it, by position in `parts`.
const kitLegs = (M) => M.rig?.legs.map((l) => l.root);
export const OLD = {
  machine: (M) => M.legs,
  golem: (M) => M.parts.slice(5, 7),
  stalker: (M) => M.parts.slice(2, 6),
  crab: (M) => kitLegs(M) ?? M.parts.slice(-6),
  slag: (M) => M.parts.slice(-2),
  hound: (M) => kitLegs(M) ?? (() => { const out = []; M.group.traverse((o) => { if (o.isGroup && Math.abs(o.position.y - 0.5) < 1e-6 && Math.abs(Math.abs(o.position.z) - 0.42) < 1e-6) out.push(o); }); return out; })(),
};
export const worldLegs = (M) => M.limbs.filter((l) => l.role === 'leg').map((l) => l.o);

/**
 * A foe of the game (an old kind or a world enemy id) chasing in a straight line at `pace` × its speed.
 * pack: a second of its kind walks 3 m to its side, out of step or not (unison). cost: time the kit (µs a frame).
 */
export function foeSubject(sys, kind, legsOf, { pace = 1, pack = false, cost = false } = {}) {
  const f = sys.add(kind, new THREE.Vector3());
  const g = pack ? sys.add(kind, new THREE.Vector3(3, 0, 0)) : null;
  const legs = legsOf(f.model);
  const speed = (f.def.speed ?? 2) * pace;
  const extra = g ? { root: g.model.group, leg: legsOf(g.model)[0], heights: [] } : null;
  let kit = 0, frames = 0;
  if (cost && f.model.rig) {
    const R = f.model.rig, u = R.update.bind(R), w = R.write.bind(R);
    R.update = (...a) => { const t = performance.now(); const o = u(...a); kit += performance.now() - t; return o; };
    R.write = (...a) => { const t = performance.now(); w(...a); kit += performance.now() - t; frames++; };
  }
  const drive = (x, dt) => { x.state = 'chase'; x.heading = 0; x.dist = 2; /* (close by: a hound is solid) */ x.pos.z += speed * dt; sys.look(x, dt); };
  const run = record({ root: f.model.group, legs, torso: f.model.body ?? f.model.group, extra, step: (dt) => { drive(f, dt); if (g) drive(g, dt); } });
  sys.remove(f); if (g) sys.remove(g);
  const L = f.model.rig?.length;
  return {
    speed, ...run,
    legLength: L, reachShare: L ? run.reachSpan / L : null, liftShare: L ? run.lift / L : null,
    unison: extra ? correlation(run.heights, extra.heights) : null,
    kitUs: frames ? (kit / frames) * 1000 : null, legsN: legs.length,
  };
}

/** A guardian model (src/temples/guardians.js) walking: its animate() with a speed, the group moved by us. */
export function guardianSubject(make, legsOf, speed = 2.2, pace = 1) {
  const m = make();
  speed *= pace;
  const legs = legsOf(m);
  let z = 0;
  const run = record({ root: m.group, legs, torso: m.body ?? m.group, step: (dt, t) => { z += speed * dt; m.animate(dt, t, { state: 'fight', speed }); m.group.position.set(0, 0, z); } });
  return { speed, ...run };
}

export const GUARDIANS = {
  keeper: (pace) => guardianSubject(keeperModel, (m) => m.legs.map((L) => L.hip), 2.2, pace),
  sentinel: (pace) => guardianSubject(sentinelModel, (m) => m.legs, 2.4, pace),
  foreman: (pace) => guardianSubject(foremanModel, (m) => m.legs, 2.4, pace),
  gardener: (pace) => guardianSubject(gardenerModel, (m) => m.legs, 2.4, pace),
  sign: (pace) => guardianSubject(signModel, (m) => m.legs, 2.4, pace),
};
