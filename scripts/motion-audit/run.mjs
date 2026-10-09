// Walks foes in a straight line in node and measures their legs (docs/systems/procedural-animation.md,
// "Measuring"; the rubric: .claude/skills/procedural-animation/SKILL.md).
//
//   node scripts/motion-audit/run.mjs                 a sample of every family (old kinds, world enemies, guardians)
//   node scripts/motion-audit/run.mjs desert/dune-skitter crab keeper   just these (world enemy ids, kinds, guardians)
//   node scripts/motion-audit/run.mjs --all           all 100 world enemies too
//   node scripts/motion-audit/run.mjs --json          the full reports as JSON
//   node scripts/motion-audit/run.mjs --pace=0.5      at half their speeds (does the gait follow the speed?)
//
// A foot is the lowest world-space vertex under its leg's pivot; the hip is the pivot's world position. Each
// subject walks 4 s at its own speed on flat ground (y = 0) after 1 s to settle. The measures are pure
// (metrics.mjs, tests/motion-metrics.test.js); this file only drives the game's own models and look().
import * as THREE from 'three';
import { Foes } from '../../src/foes.js';
import { GameState } from '../../src/game-state.js';
import { ENEMY_ROSTER } from '../../src/enemies/roster.js';
import { keeperModel, sentinelModel, foremanModel, gardenerModel, signModel } from '../../src/temples/guardians.js';
import { walkReport } from './metrics.mjs';

const args = process.argv.slice(2), json = args.includes('--json'), all = args.includes('--all');
const pace = Number(args.find((a) => a.startsWith('--pace='))?.slice(7) ?? 1);   // (walk at this share of each one's speed)
const picks = args.filter((a) => !a.startsWith('--'));
const DT = 1 / 60, SETTLE = 60, FRAMES = 240;
const v = new THREE.Vector3();

/** The lowest vertex (world) in an object's subtree. */
function lowest(obj, out) {
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
function record({ root, legs, step, torso = root, seconds = FRAMES * DT }) {
  const feet = legs.map(() => []), hips = legs.map(() => []), body = [], f = new THREE.Vector3(), h = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i < SETTLE + FRAMES; i++) {
    step(DT, i * DT);
    root.updateMatrixWorld(true);
    if (i < SETTLE) continue;
    legs.forEach((L, k) => { lowest(L, f); L.getWorldPosition(h); feet[k].push(f.toArray()); hips[k].push(h.toArray()); });
    body.push(torso.getWorldPosition(b).toArray());   // (the drawn body, so its bob counts)
  }
  return walkReport({ feet, hips, body, seconds });
}

const sys = new Foes({ scene: new THREE.Scene(), level: { spawn: new THREE.Vector3(0, 0, -200) }, levelId: 'arena', physics: { groundAt: () => 0 }, player: { pos: new THREE.Vector3(0, 0, 50), health: 1, vel: new THREE.Vector3(), hurt() {} }, game: new GameState(null) });

/** A foe of the game (an old kind or a world enemy id) chasing in a straight line. */
function foeSubject(kind, legsOf) {
  const f = sys.add(kind, new THREE.Vector3());
  const legs = legsOf(f.model);
  const speed = (f.def.speed ?? 2) * pace;
  const run = record({ root: f.model.group, legs, torso: f.model.body ?? f.model.group, step: (dt) => { f.state = 'chase'; f.heading = 0; f.dist = 2;   /* (close by: a hound is solid) */ f.pos.z += speed * dt; sys.look(f, dt); } });
  sys.remove(f);
  return { speed, ...run };
}

/** A guardian model (src/temples/guardians.js) walking: its animate() with a speed, the group moved by us. */
function guardianSubject(make, legsOf, speed = 2.2) {
  const m = make();
  speed *= pace;
  const legs = legsOf(m);
  let z = 0;
  const run = record({ root: m.group, legs, torso: m.body ?? m.group, step: (dt, t) => { z += speed * dt; m.animate(dt, t, { state: 'fight', speed }); m.group.position.set(0, 0, z); } });
  return { speed, ...run };
}

// Where each kind keeps its legs (the old kinds' models expose them only in `parts`, by position).
const OLD = {
  machine: (M) => M.legs,
  golem: (M) => M.parts.slice(5, 7),
  stalker: (M) => M.parts.slice(2, 6),
  crab: (M) => M.parts.slice(-6),
  slag: (M) => M.parts.slice(-2),
  hound: (M) => { const out = []; M.group.traverse((o) => { if (o.isGroup && Math.abs(o.position.y - 0.5) < 1e-6 && Math.abs(Math.abs(o.position.z) - 0.42) < 1e-6) out.push(o); }); return out; },
};
const GUARDIANS = {
  keeper: () => guardianSubject(keeperModel, (m) => m.legs.map((L) => L.hip), 2.2),
  sentinel: () => guardianSubject(sentinelModel, (m) => m.legs, 2.4),
  foreman: () => guardianSubject(foremanModel, (m) => m.legs, 2.4),
  gardener: () => guardianSubject(gardenerModel, (m) => m.legs, 2.4),
  sign: () => guardianSubject(signModel, (m) => m.legs, 2.4),
};
const worldLegs = (M) => M.limbs.filter((l) => l.role === 'leg').map((l) => l.o);
const sample = ['desert/dune-skitter', 'desert/cistern-beast', 'desert/possessed-cistern-pump'];
for (const form of ['crab', 'mantis', 'shell', 'bird', 'stalker', 'newt', 'beetle', 'wasp', 'tripod', 'bell', 'diver'])
  { const e = ENEMY_ROSTER.find((x) => x.form === form && !sample.includes(x.id)); if (e) sample.push(e.id); }
const shade = ENEMY_ROSTER.find((x) => x.family === 'shade'); if (shade) sample.push(shade.id);

const ids = picks.length ? picks : [...Object.keys(OLD), ...(all ? ENEMY_ROSTER.map((e) => e.id) : sample), ...Object.keys(GUARDIANS)];
const out = {};
for (const id of ids) {
  if (GUARDIANS[id]) out[id] = GUARDIANS[id]();
  else if (OLD[id]) out[id] = foeSubject(id, OLD[id]);
  else if (ENEMY_ROSTER.some((e) => e.id === id)) { const e = ENEMY_ROSTER.find((x) => x.id === id); const r = foeSubject(id, worldLegs); out[id] = { form: e.form, ...r }; }
  else console.warn(`unknown subject: ${id}`);
}
sys.dispose();

if (json) console.log(JSON.stringify(out, null, 1));
else {
  const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
  console.log('subject                                  legs  speed  slide/m  worst  reachSpan  lift   steps/s  bob    groups');
  for (const [id, r] of Object.entries(out)) {
    console.log(`${(id + (r.form ? ` (${r.form})` : '')).padEnd(40)} ${String(r.legs.length).padStart(4)}  ${f2(r.speed).padStart(5)}  ${f2(r.slidePerMetre).padStart(7)}  ${f2(r.worstSlide).padStart(5)}  ${f2(r.reachSpan).padStart(9)}  ${f2(r.lift).padStart(5)}  ${f2(r.cadence).padStart(7)}  ${f2(r.bob).padStart(5)}  ${JSON.stringify(r.groups)}`);
  }
}
