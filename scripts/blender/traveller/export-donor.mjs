// The donor for the Blender traveller (issue #493): the game's own MakeHuman body at the traveller's B3
// parameters (public/anim/mh/body.bin, CC0), its eyes and brows, its face keys, and the 53-bone
// skeleton the game binds him to, at the B3 fit (traveller-b3-fit.js). build.py reads this JSON.
//   node scripts/blender/traveller/export-donor.mjs <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import * as T from 'three';
import { parseBody, makeBody } from '../../../src/makehuman/body.js';
import { fitTravellerB3 } from '../../../src/characters/traveller-b3-fit.js';

const out = process.argv[2] ?? 'donor.json';
const b = readFileSync('public/anim/mh/body.bin'), data = parseBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
const report = JSON.parse(readFileSync('public/characters/traveller-b3/rig.json'));
const scene = makeBody(data, report.params, { fresh: true, brows: 1 });
scene.updateMatrixWorld(true);
const body = scene.getObjectByName('Body'), bones = body.skeleton.bones;
const before = bones.map((o) => o.getWorldPosition(new T.Vector3()).toArray());
const beforeQ = bones.map((o) => o.getWorldQuaternion(new T.Quaternion()).toArray());
const fit = fitTravellerB3(scene);
scene.updateMatrixWorld(true);
const r = (a) => Array.from(a, (v) => Math.round(v * 1e6) / 1e6);
const mesh = (m) => {
  const g = m.geometry;
  return { name: m.name, position: r(g.attributes.position.array), index: Array.from(g.index.array),
    joints: Array.from(g.attributes.skinIndex.array), weights: r(g.attributes.skinWeight.array) };
};
// the face keys (body.bin's sparse deltas at this head's scale, as the game's shader applies them)
const prof = scene.userData.profile, P = data.meta.parts, keys = {};
for (const key of Object.keys(data.meta.keys)) {
  const idx = data.get(`k_${key}_i`), d = data.get(`k_${key}_d`), s = data.scale(`k_${key}_d`), k = prof.kHead;
  const parts = {};
  for (let j = 0; j < idx.length; j++) {
    const v = idx[j];
    for (const name of ['body', 'eyes', 'brows1']) {
      const p = P[name];
      if (v >= p.start && v < p.start + p.count) (parts[name] ??= []).push([v - p.start, ...r([d[j * 3] * s * k[0], d[j * 3 + 1] * s * k[1], d[j * 3 + 2] * s * k[2]])]);
    }
  }
  keys[key] = parts;
}
writeFileSync(out, JSON.stringify({
  params: report.params, kHead: prof.kHead, size: prof.size,
  bones: bones.map((o, i) => ({ name: o.name, parent: o.parent?.isBone ? o.parent.name : null,
    head: r(o.getWorldPosition(new T.Vector3()).toArray()), donorHead: r(before[i]),
    quat: r(o.getWorldQuaternion(new T.Quaternion()).toArray()), donorQuat: r(beforeQ[i]) })),
  meshes: ['Body', 'Eyes', 'Eyebrows'].map((n) => mesh(scene.getObjectByName(n))),
  keys,
}));
console.log('donor', out, fit.joints.length, 'bones');
