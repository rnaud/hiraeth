// Qanat's shop in node (the camera QC's desert-shop without a browser, issue #289): the desert built (its collision), the
// traveller walked round the shop by the browser scenario's own points (between the counter and the door), the camera
// turned after the way, the real CameraRig through the real collision (scripts/camera-qc/sim.mjs). Prints the measures.
//
//   node scripts/camera-qc/sim-shop.mjs
import * as THREE from 'three';
import { buildableById } from '../../src/levels/buildable.js';
import { Physics } from '../../src/physics.js';
import { CameraRig } from '../../src/player.js';
import { walk } from './sim.mjs';
import { analyse } from './lib.mjs';

globalThis.window ??= { addEventListener() {} };
const dom = { addEventListener() {} };
const quiet = (f) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; } };

/** The desert built once: its level and collision. */
export function desertWorld() {
  const scene = new THREE.Scene();
  const level = quiet(() => buildableById('desert').create(scene));
  const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  return { scene, level, physics };
}

/** The shop's way, as scripts/camera-qc/scenarios.mjs's desert-shop works it out in the page. */
export function shopWay(level) {
  const s = level.shops[0], c = s.counter.at, l = s.counter.look, d = new THREE.Vector3(c.x - l.x, 0, c.z - l.z).normalize(), r = new THREE.Vector3(-d.z, 0, d.x);
  const P = (a, b) => { const p = c.clone().addScaledVector(d, a).addScaledVector(r, b); return [p.x, p.z]; };
  return { path: [P(1.2, 0), P(1, 2.6), P(2.4, 2.6), P(2.4, -2.6), P(1, -2.6), P(1, 2.6), P(2.2, 0.5)], yaw: Math.atan2(d.x, d.z), floor: c.y };
}

export function shopWalk(world, opts = {}) {
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000), rig = new CameraRig(camera, dom, world.physics);
  const w = shopWay(world.level);
  const S = walk(rig, world.physics, camera, w.path, { speed: 3.8, steer: 100, yaw: w.yaw, floor: w.floor, ...opts });
  return { samples: S, rig, ...analyse(S) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const world = desertWorld(), r = shopWalk(world), m = r.measures;
  console.log(`desert-shop ${r.green ? 'green' : 'RED  '} pops ${m.pops} jumps ${m.jumps} look ${m.lookJumps} spins ${m.spins} clip ${(m.clip * 100).toFixed(1)}% out ${(m.out * 100).toFixed(1)}% rev ${m.reversals}/s rough ${(m.rms * 100).toFixed(2)} cm arm ${m.armMin}-${m.armMax}`);
  for (const e of r.events.slice(0, +(process.env.EVENTS ?? 6))) { const s = r.samples[e.i]; console.log(`   ${e.kind} t ${e.t.toFixed(2)} ${e.size.toFixed(2)} at ${s.pos.map((v) => v.toFixed(2))} cur ${s.cur.toFixed(2)} side ${s.side.toFixed(2)}`); }
}
