#!/usr/bin/env node
// The people's walks measured as the traveller's are (tests/gait-sim.js measure): a person walks a
// straight line at their own pace, near the camera (feet planted), first with the library's walk,
// then with each captured one (lib.motion.walks). Slide, held, sink, jerk, and the cadence.
//   node scripts/mocap/compare-people.mjs
import * as THREE from 'three';
import { loadAssets, measure } from '../../tests/gait-sim.js';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { NPC } = await import('../../src/npc.js');
const { Physics } = await import('../../src/physics.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export async function walkPerson(walk, { speed = 1.25, secs = 6, kind = 'm' } = {}) {
  const { lib, human } = await loadAssets();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2)));
  scene.updateMatrixWorld(true);
  const physics = new Physics(scene);
  const npc = new NPC(scene, physics, { route: [V(0, 0, 0), V(0, 0, 300)], cape: 0, lines: ['~neutral~ …'], lib, human: human[kind], kind, speed });
  npc.speed = speed; npc.pause = 0;
  npc._walkFor = npc.gait;   // (this walk, not one picked for them)
  npc.animator.useWalk(walk);
  const camera = new THREE.PerspectiveCamera();
  const player = { pos: V(30, 0, 0), vel: V(0, 0, 0), frame: { up: V(0, 1, 0) }, wind: V(0, 0, 0), riding: false, bodyCapsules: () => [] };
  const H = npc.humanoid, B = H.b, dt = 1 / 60, frames = [];
  const ground = () => 0;
  let prevPhase = npc.animator.phase, cycles = 0, t = 0;
  for (let i = 0; i < secs / dt; i++) {
    camera.position.set(npc.pos.x + 4, 1.6, npc.pos.z + 2);
    npc.update(dt, player, camera);
    npc.object.updateMatrixWorld(true);
    const f = { t, tag: 'walk', feet: {} };
    for (const s of ['l', 'r']) {
      const ball = B[`ball_${s}`].getWorldPosition(new THREE.Vector3()), ankle = B[`foot_${s}`].getWorldPosition(new THREE.Vector3());
      const F = H._feet?.[s];
      f.feet[s] = { ball, ankle, gBall: ground(), gAnkle: ground(), locked: !!F?.locked, step: !!F?.step, w: F?.w ?? 0 };
    }
    f.pelvis = B.pelvis.getWorldPosition(new THREE.Vector3());
    f.head = B.Head.getWorldPosition(new THREE.Vector3());
    f.maxTurn = 0;
    frames.push(f);
    if (t > 1 && npc.animator.phase < prevPhase) cycles++;
    prevPhase = npc.animator.phase;
    t += dt;
  }
  const m = measure(frames, H, dt, 1);
  return { ...m, cadence: cycles / (secs - 1), walk: npc.animator.walkName ?? 'library walk' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { lib } = await loadAssets();
  const fmt = (r) => `slide ${r.maxSlide.toFixed(3)} / ${r.meanSlide.toFixed(3)}  held ${r.heldSlide.toFixed(4)}  sink ${r.sink.toFixed(3)}  jerk ${r.jitterHead.toFixed(2)}  ${r.cadence.toFixed(2)} cycles/s`;
  console.log(`${'library walk'.padEnd(34)} ${fmt(await walkPerson(null))}`);
  for (const w of lib.motion.walks) {
    const speed = Math.min(Math.max(w.speed * 1.05, 0.9), 1.6);   // (near its own pace, as walkFor picks)
    console.log(`${`${w.name} ${w.desc}`.slice(0, 34).padEnd(34)} ${fmt(await walkPerson(w, { speed }))}  at ${speed.toFixed(2)} m/s`);
  }
}
