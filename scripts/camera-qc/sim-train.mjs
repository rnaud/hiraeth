// The Overnight Train's walks in node (scripts/camera-qc/sim.mjs): the way through from the deck to the balcony at a walk
// and at a run, the sleeping car's corridor, the roof walk. `node scripts/camera-qc/sim-train.mjs [name]` prints each
// walk's measures (scripts/camera-qc/lib.mjs); tests/camera-qc.test.js holds them to the limits.
import * as THREE from 'three';
import { Physics } from '../../src/physics.js';
import { CameraRig } from '../../src/player.js';
import { createOvernightTrain, CARS, car, FLOOR, WALK, NOSE_X } from '../../src/levels/overnight-train.js';
import { walk } from './sim.mjs';
import { analyse } from './lib.mjs';

globalThis.window ??= { addEventListener() {} };
const dom = { addEventListener() {} };

/** The train built once (its collision), and a fresh rig for each walk. */
export function trainWorld() {
  const scene = new THREE.Scene(), w = console.warn; console.warn = () => {};
  try { const level = createOvernightTrain(scene); return { scene, level, physics: new Physics(scene, level.ground) }; } finally { console.warn = w; }
}

const WAY = { prow: 0, dining: 0, sleeper: -2.1, dome: -0.5 };
/** The way through, from the landing wagon's front to the balcony (the sleepers' corridor along -z). */
export function wayThrough() {
  const out = [[car('landing').x1 - 3, 0]];
  for (const c of CARS.filter((q) => WAY[q.kind] !== undefined).reverse()) {
    const z = WAY[c.kind];
    out.push([c.x0 - 1.6, 0], [c.x0 + 1.2, 0], [c.x0 + 1.6, z], [c.x1 - 1.6, z], [c.x1 - 1.2, 0]);
  }
  out.push([NOSE_X + 2.6, 0]);
  return out;
}

export const WALKS = {
  'train-walk': () => ({ path: wayThrough(), speed: 3.8, floor: FLOOR }),
  'train-walk-free': () => ({ path: wayThrough(), speed: 3.8, steer: 0, floor: FLOOR }),
  'train-run': () => ({ path: wayThrough(), speed: 7.5, steer: 160, floor: FLOOR }),
  // (as the browser's: along the corridor, a turn of three quarters standing, and back)
  'train-sleeper': () => { const S = car('sleeper', 0); return { path: [[S.x0 + 4, -2.1], [S.x1 - 4, -2.1], { wait: 3 }, [S.x0 + 4, -2.1]], speed: 3.8, floor: FLOOR, turns: [{ at: (S.L - 8) / 3.8 + 0.5, for: 3, rate: 90 }] }; },
  'train-dining-turns': () => { const D = car('dining'); return { path: [[D.x0 + 3, 0], [D.x1 - 3, 0]], speed: 2, floor: FLOOR, turns: [{ at: 1, for: 3, rate: 120 }, { at: 5, for: 3, rate: -120 }] }; },
  'train-roof': () => { const B = car('dome'), S0 = car('sleeper', 0); return { path: [[B.x1 - 1, 0], [S0.x0, 0], [S0.x1, 0], [car('dining').x1 - 1, 0], [car('prow').x1 - 3, 0]], speed: 7.5, floor: WALK }; },
};

export function runWalk(world, name) {
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000);
  const rig = new CameraRig(camera, dom, world.physics);
  const o = WALKS[name]();
  const S = walk(rig, world.physics, camera, o.path, { yaw: -Math.PI / 2, ...o });
  return { samples: S, ...analyse(S) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const world = trainWorld();
  for (const name of process.argv[2] ? process.argv[2].split(',') : Object.keys(WALKS)) {
    const r = runWalk(world, name), m = r.measures;
    console.log(`${name.padEnd(20)} ${r.green ? 'green' : 'RED  '} pops ${m.pops} (max ${m.popMax}) jumps ${m.jumps} (max ${m.jumpMax}) look ${m.lookJumps} spins ${m.spins} (p95 ${m.spinP95}) clip ${(m.clip * 100).toFixed(1)}% hidden ${(m.occluded * 100).toFixed(1)}% out ${(m.out * 100).toFixed(1)}% rev ${m.reversals}/s rough ${(m.rms * 100).toFixed(2)} cm arm ${m.armMin}-${m.armMax}`);
    if (process.env.EVENTS) for (const e of r.events.slice(0, +process.env.EVENTS)) { const s = r.samples[e.i]; console.log(`   ${e.kind} t ${e.t.toFixed(2)} ${e.size.toFixed(2)} at ${s.pos.map((v) => v.toFixed(1))} cur ${s.cur.toFixed(2)} side ${s.side.toFixed(2)}`); }
  }
}
