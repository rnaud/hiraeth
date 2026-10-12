import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Humanoid, prepareHuman } from '../src/humanoid.js';
import { buildCharacter } from '../src/player.js';
import { Ragdoll, Knockdown, J, toppleVelocities } from '../src/ragdoll.js';

// #214: a ragdoll knocked toward a cliff used to climb it (the ground's push was straight up, and
// it kept its speed along the ground); it obeys the ground's slope now.
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
async function glb(name) {
  const bytes = await readFile(new URL(`../public/anim/${name}`, import.meta.url));
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length));
  json.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + length).toString('base64')}`;
  return (await new GLTFLoader().parseAsync(JSON.stringify(json), '')).scene;
}
const human = prepareHuman(await glb('human_m.glb'), 'm');
const Y = new THREE.Vector3(0, 1, 0);
const body = (at = new THREE.Vector3()) => {
  const char = buildCharacter();
  new THREE.Scene().add(char.root);
  char.root.position.copy(at);
  const H = new Humanoid(human, char, 'm');
  H.update();
  return H;
};

// a cliff rising at `grade` (rise per metre) from x = foot, flat ground before it (a heightfield: under it is solid);
// `blur`: its normal by finite differences that far either side, as the game's heightfield gives it (blended at the foot)
function cliff(foot, grade, blur = 0) {
  const g = (x) => (x > foot ? (x - foot) * grade : 0);
  const n = new THREE.Vector3();
  return {
    heightAbove: (p) => p.y - g(p.x),
    groundNormal: (x, y, z, out = n) => (blur ? out.set(g(x - blur) - g(x + blur), 2 * blur, 0).normalize()
      : x > foot ? out.set(-grade, 1, 0).normalize() : out.set(0, 1, 0)),
    pushCapsule: () => null,
  };
}

for (const [grade, name] of [[1.2, '50°'], [3, '72°'], [12, 'a sheer face']]) {
  for (const [carry, blur] of [[3, 0], [6, 0.35], [9, 0], [9, 0.35]]) {
    test(`ragdoll (#214): knocked into ${name} at ${carry} m/s${blur ? ' (the heightfield\'s blended normal)' : ''}, it never ends up higher than it started, and settles`, () => {
      const H = body();
      const ground = cliff(0.6, grade, blur);
      const rag = new Ragdoll().startFrom(H, toppleVelocities(new THREE.Vector3(1, 0, 0), Y, { carry, rise: 1, tip: 3, twist: 0.3 }));
      const start = rag.pelvis.y;
      let top = -Infinity, t = 0;
      for (; t < 8 && !(rag.settled && t > 0.5); t += 1 / 60) {
        rag.step(1 / 60, ground, Y);
        top = Math.max(top, ...rag.x.map((p) => p.y));
      }
      const end = rag.pelvis.y;
      assert.ok(rag.settled, `settles (${rag.speed.toFixed(2)} m/s after ${t.toFixed(1)} s)`);
      assert.ok(end < start + 0.15, `ends no higher than it started (pelvis ${start.toFixed(2)} -> ${end.toFixed(2)} m)`);
      assert.ok(top < 2.3, `never climbs the cliff (highest joint ${top.toFixed(2)} m)`);
    });
  }
}

test('ragdoll (#214): it does not fall through a wall (the trunk pushed out, and the push is no launch)', () => {
  // a wall at x = 0.8 the capsule meets, the ground flat
  const wall = {
    heightAbove: (p) => p.y,
    pushCapsule(pos, r, bottom, top, out, axis) {
      const a = pos.clone().addScaledVector(axis, bottom + r), b = pos.clone().addScaledVector(axis, top - r);
      const over = Math.max(a.x, b.x) + r - 0.8;
      if (over <= 0) return null;
      out.set(-over, 0, 0); pos.add(out); return out;
    },
  };
  const H = body();
  const rag = new Ragdoll().startFrom(H, toppleVelocities(new THREE.Vector3(1, 0, 0), Y, { carry: 6, rise: 1, tip: 3, twist: 0 }));
  let t = 0, top = 0;
  for (; t < 8 && !(rag.settled && t > 0.5); t += 1 / 60) { rag.step(1 / 60, wall, Y); top = Math.max(top, rag.pelvis.y); }
  assert.ok(rag.settled, 'settles against the wall');
  assert.ok(rag.pelvis.x < 0.8 && rag.x[J.chest].x < 0.8, `stays this side of the wall (${rag.pelvis.x.toFixed(2)} m)`);
  assert.ok(top < 1.3, `not thrown up off the wall (${top.toFixed(2)} m)`);
});
