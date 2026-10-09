// The chain plans' motion measures (kit phase 4, src/motion-kit/chain.js; docs/systems/procedural-animation.md,
// "Measuring"): the bodies with no feet to plant, measured through the game's own models and Foes.look.
//
//   node scripts/motion-audit/chains.mjs            every chain archetype in its own skin
//   node scripts/motion-audit/chains.mjs --json
//
//   path error   the worst distance (m) of a body point (the centipede's segments, the worm's mounds) from the path its
//                head actually took, walking a weaving line: 0 is a body that follows its head exactly (no sideways slide)
//   beat         wing beats a second at full and at half speed (the sky ray, the signal moth): the rate follows the speed
//   tip lag      how far (rad of the cycle) the wing tip trails its root
//   pulse        bell pulses a second drifting, and winding up (the lantern jelly): the telegraph quickens it
import * as THREE from 'three';
import { foeSystem } from './walk.mjs';
import { PLANS } from '../../src/motion-kit/plans.js';

const DT = 1 / 60;

/** Walk a foe along a weaving line (x = A sin(z / L)) at `pace` × its speed for `seconds`; each(f, i) per frame. */
function weave(sys, kind, { pace = 1, seconds = 6, state = 'chase', each = null, A = 1.6, L = 2.5 } = {}) {
  const f = sys.add(kind, new THREE.Vector3());
  const speed = f.def.speed * pace;
  let s = 0;
  for (let i = 0; i < seconds / DT; i++) {
    s += speed * DT;
    const z = s, x = A * Math.sin(z / L), dx = (A / L) * Math.cos(z / L);
    f.pos.set(x, 0, z); f.heading = Math.atan2(dx, 1); f.state = state; f.dist = 2; f.provoked = true;
    sys.look(f, DT);
    each?.(f, i);
  }
  return f;
}

/** The distance from p to the polyline (x, z) pts. */
function toPath(p, pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], ux = b.x - a.x, uz = b.z - a.z, l2 = ux * ux + uz * uz || 1e-12;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ux + (p.z - a.z) * uz) / l2));
    best = Math.min(best, Math.hypot(p.x - a.x - ux * t, p.z - a.z - uz * t));
  }
  return best;
}

export function pathError(sys, kind, points) {
  const path = [];
  let worst = 0;
  weave(sys, kind, { each: (f, i) => {
    path.push({ x: f.pos.x, z: f.pos.z });
    if (i < 120) return;   // (once the body has unrolled onto the walked path)
    for (const p of points(f)) worst = Math.max(worst, toPath(p, path));
  } });
  return worst;
}

/** Beats a second of a model's wave at a pace (its Wave's cycles). */
export function beat(sys, kind, pace) {
  let c0 = null, f = null;
  weave(sys, kind, { pace, seconds: 4, each: (g, i) => { f = g; if (i === 60) c0 = g.model.wave.cycles + g.model.wave.phase; } });
  return (f.model.wave.cycles + f.model.wave.phase - c0) / 3;
}

export function pulse(sys, kind, state) {
  let c0 = null, f = null;
  weave(sys, kind, { pace: 0.3, seconds: 3, state, each: (g, i) => {
    f = g;
    if (state === 'wind') { g.atk = g.def.attacks[0]; g.k = Math.min(0.99, i / 60); }
    if (i === 60) c0 = g.model.wave.cycles + g.model.wave.phase;
  } });
  return (f.model.wave.cycles + f.model.wave.phase - c0) / 2;
}

export function chainReport() {
  const sys = foeSystem(), out = {};
  out.centipede = { pathError: pathError(sys, 'centipede', (f) => f.model.spine.slice(1)) };
  out.worm = { pathError: pathError(sys, 'worm', (f) => f.model.mounds.filter((m) => m.visible).map((m) => m.position)) };
  for (const k of ['ray', 'moth']) {
    const W = PLANS[k === 'ray' ? 'glider' : 'flyer'].wing;
    out[k] = { beatFull: beat(sys, k, 1), beatHalf: beat(sys, k, 0.5), tipLag: W.lag * (W.strips - 1) };
  }
  out.jelly = { pulseDrift: pulse(sys, 'jelly', 'chase'), pulseWind: pulse(sys, 'jelly', 'wind') };
  sys.dispose();
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = chainReport();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 1));
  else for (const [k, v] of Object.entries(r)) console.log(k.padEnd(10), Object.entries(v).map(([a, b]) => `${a} ${b.toFixed(3)}`).join('   '));
}
