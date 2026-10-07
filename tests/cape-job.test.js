// The capes simulated by an engine (src/cape.js CAPE_HOST, engine/cape-job.js; the Unity bridge's BridgeCape.cs):
// the same cape, walking, turning, carried every 3rd frame, seated on a field, spread like wings, simulated by
// cape.js itself and through the packets by the job, comes out the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Cape, CAPE_HOST, groundField, resetDrapes, SEATED, OVER } from '../src/cape.js';
import { jsCapeOffload, CAPE_K, CapeJob, packCapeDesc, writeCapePacket, capePacketWords } from '../engine/cape-job.js';
import { CommandWriter } from '../engine/unity/pack.js';

THREE.ColorManagement.enabled = false;

function rig(offload) {
  const scene = new THREE.Scene(), body = new THREE.Group(), torso = new THREE.Object3D();
  torso.position.y = 1.0; body.add(torso); scene.add(body);
  CAPE_HOST.offload = offload;
  let cape;
  try { cape = new Cape(scene, torso, { cols: 10, rows: 8, length: 1.2, bottom: 0.4, bells: 0 }); } finally { CAPE_HOST.offload = null; }
  return { scene, body, torso, cape };
}

function play(R, frames, { seated = false, carry = false, spread = 0 } = {}) {
  const up = new THREE.Vector3(0, 1, 0), vel = new THREE.Vector3(), wind = new THREE.Vector3(0.6, 0, 0.2), floor = new THREE.Vector3();
  const field = seated ? groundField((x, top) => (Math.abs(x) < 0.3 ? 0.45 : 0), new THREE.Vector3(0, 0.45, 0), 0, SEATED.seat) : null;
  const out = [];
  let t = 0, acc = 0;
  for (let f = 0; f < frames; f++) {
    const dt = 1 / 60; t += dt;
    // walking a circle, turning, legs swinging
    const x = Math.sin(t * 0.7) * 3, z = Math.cos(t * 0.7) * 3;
    vel.set(Math.cos(t * 0.7) * 2.1, 0, -Math.sin(t * 0.7) * 2.1);
    if (!seated) { R.body.position.set(x, 0, z); R.body.rotation.y = t * 0.7 + Math.PI / 2; } else vel.set(0, 0, 0);
    R.scene.updateMatrixWorld();
    floor.set(R.body.position.x, 0, R.body.position.z);
    const sw = Math.sin(t * 6) * 0.3, b = R.body.position;
    const capsules = [
      { a: new THREE.Vector3(b.x + 0.1, 0.9, b.z + sw * 0.3), b: new THREE.Vector3(b.x + 0.1 + sw * 0.2, 0.1, b.z + sw), r: 0.09 },
      { a: new THREE.Vector3(b.x - 0.1, 0.9, b.z - sw * 0.3), b: new THREE.Vector3(b.x - 0.1 - sw * 0.2, 0.1, b.z - sw), r: 0.09 },
      { a: new THREE.Vector3(b.x, 1.4, b.z), b: new THREE.Vector3(b.x, 0.8, b.z), r: 0.17, rb: 0.2 },
      { a: new THREE.Vector3(b.x + 0.25, 1.35, b.z + 0.05), b: new THREE.Vector3(b.x + 0.32, 0.95, b.z + 0.12), r: 0.05, over: true },
      { a: new THREE.Vector3(b.x - 0.22, 1.2, b.z - 0.18), b: new THREE.Vector3(b.x - 0.2, 0.95, b.z - 0.2), r: 0.08, under: true },
    ];
    const s = { up, vel, wind, floor, capsules, field, spread, still: false };
    acc += dt;
    if (carry) { if (f % 3 === 2) { R.cape.update(acc, { ...s, carry: 1 }); acc = 0; } else R.cape.follow(); }
    else { R.cape.update(dt, s); acc = 0; }
    if (R.cape.off) R.cape.pull();
    out.push(Float32Array.from(R.cape.p));
  }
  return out;
}

/**
 * The same to the float, while the cloth's own chaos hasn't grown the packets' float rounding (their numbers are
 * 32-bit, cape.js's doubles): the first 20 frames to 0.1 mm; and after, the same cloth: on average within 2 mm
 * (cape.js against itself with its colliders rounded to floats drifts as far).
 */
function same(a, b, what) {
  let early = 0, sum = 0, n = 0, worst = 0;
  for (let f = 0; f < a.length; f++) for (let i = 0; i < a[f].length; i++) {
    const d = Math.abs(a[f][i] - b[f][i]);
    if (f < 20) early = Math.max(early, d);
    sum += d; n++; worst = Math.max(worst, d);
  }
  assert.ok(early < 1e-4, `${what}: the first frames differ by ${early.toFixed(6)} m`);
  assert.ok(sum / n < 2e-3, `${what}: on average ${(sum / n).toFixed(6)} m apart (worst ${worst.toFixed(4)})`);
}

for (const [name, o] of [['walking', {}], ['carried every 3rd frame', { carry: true }], ['seated on a bench\'s field', { seated: true }], ['spread like wings', { spread: 0.8 }]]) {
  test(`a cape simulated through the engine's packets is cape.js's own: ${name}`, () => {
    resetDrapes();
    const A = rig(null), B = rig(jsCapeOffload(CommandWriter));
    assert.ok(B.cape.off && !A.cape.off);
    const a = play(A, 240, o), b = play(B, 240, o);
    same(a, b, name);
    // (and it moved: not two capes standing still)
    let moved = 0; for (let i = 0; i < a[0].length; i++) moved = Math.max(moved, Math.abs(a[239][i] - a[60][i]));
    assert.ok(moved > 0.05 || o.seated, `it moved ${moved}`);
  });
}

test('the cape packet\'s length is what a reader skips; the job\'s constants are cape.js\'s and BridgeCape.cs\'s', () => {
  const R = rig(null), w = new CommandWriter(1 << 12);
  const pk = { push: true, P: R.cape.p, Q: R.cape.q, carry: 0.5, mc: new THREE.Matrix4().elements, steps: 3, iters: 5, h: 0.01, damp: 0.95, kv0: 1, time: 1, gravity: 18, drag: 0.2, flutter: 0.04,
    up: new THREE.Vector3(0, 1, 0), air: new THREE.Vector3(), lag: new THREE.Vector3(), right: new THREE.Vector3(1, 0, 0), floor: new THREE.Vector3(), spread: 0, pins: new Float32Array(R.cape.cols * 12),
    caps: [{ a: new THREE.Vector3(), b: new THREE.Vector3(0, 1, 0), r: 0.1 }], from: null, field: groundField(() => 0, new THREE.Vector3(), 0) };
  writeCapePacket(w, 3, 7, pk, R.cape);
  const buf = w.take(), u = new Uint32Array(buf), f = new Float32Array(buf);
  const n = R.cape.cols * R.cape.rows;
  assert.equal(capePacketWords(u, 1, n), u.length - 2, 'the packet ends where the stream does');
  const job = new CapeJob(packCapeDesc(R.cape));
  assert.equal(job.packet(u, f, 1), u.length - 2, 'the job reads it whole');
  assert.equal(CAPE_K.fold, SEATED.fold); assert.equal(CAPE_K.reach, OVER.reach);
  const cs = readFileSync(new URL('../unity/Memento/Assets/MementoJS/Runtime/BridgeCape.cs', import.meta.url), 'utf8');
  for (const [k, v] of Object.entries(CAPE_K)) assert.match(cs, new RegExp(`${k} = ${v}f`), `BridgeCape.cs's ${k}`);
});
