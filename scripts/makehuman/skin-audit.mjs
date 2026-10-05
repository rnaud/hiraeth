// How well each body's skin weights hold up in the game's clips (docs/makehuman.md): the Quaternius
// bodies and the MakeHuman prototype's, driven as the studio drives a clip (the rig, then
// Humanoid.update), skinned on the CPU every 1/30 s.
//
//   node scripts/makehuman/skin-audit.mjs [--json]
//
// Per joint (shoulder, elbow, wrist, hip, knee), the vertices blended between its two bones (each
// of the two largest weights ≥ 0.15): linear blend skinning pulls them toward the joint as it bends
// or twists (the "candy wrapper"), so `girth` is the mean distance to the joint against the rest
// pose's, at the clip's worst frame (1: the volume kept); `pinch` the share of the joint's
// triangles whose area falls under 40% of their rest area at that frame.
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { Humanoid, prepareHuman } = await import('../../src/humanoid.js');
const { buildCharacter } = await import('../../src/player.js');
const { libraryFrom, Animator } = await import('../../src/animator.js');
const { prepareMakeHuman } = await import('../../src/makehuman/body.js');

const parse = async (path) => {
  const b = await readFile(new URL(`../../public/${path}`, import.meta.url));
  return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
};
const JOINTS = {
  shoulder: ['clavicle', 'upperarm', 'upperarm'], elbow: ['upperarm', 'lowerarm', 'lowerarm'], wrist: ['lowerarm', 'hand', 'hand'],
  hip: ['pelvis', 'thigh', 'thigh'], knee: ['thigh', 'calf', 'calf'],
};
const CLIPS = ['Walk_Loop', 'Sprint_Loop', 'Climb_Up_Loop', 'ClimbLedge', 'Jump_Start', 'Idle_Loop'];

const lib = libraryFrom(await parse('anim/ual.glb'));
const manifest = JSON.parse(await readFile(new URL('../../public/anim/mh/people.json', import.meta.url), 'utf8'));
const bodies = [
  { name: 'Quaternius m', kind: 'm', template: prepareHuman((await parse('anim/human_m.glb')).scene, 'm') },
  { name: 'Quaternius f', kind: 'f', template: prepareHuman((await parse('anim/human_f.glb')).scene, 'f') },
];
for (const e of manifest.people) bodies.push({ name: `MakeHuman ${e.id}`, kind: e.kind, template: prepareMakeHuman((await parse(`anim/mh/${e.id}.glb`)).scene, e) });

function audit({ template, kind }) {
  const char = buildCharacter();
  const h = new Humanoid(template, char, kind);
  const a = new Animator(lib, char);
  const root = char.root, body = h.body, bones = body.skeleton.bones;
  const P = body.geometry.attributes.position, J = body.geometry.attributes.skinIndex, W = body.geometry.attributes.skinWeight;
  const index = body.geometry.index;
  // each joint's blended vertices and triangles, per side
  const regions = [];
  for (const [joint, [pa, ch, at]] of Object.entries(JOINTS)) for (const s of ['l', 'r']) {
    const name = (n) => (n === 'pelvis' ? 'pelvis' : `${n}_${s}`);
    const ip = bones.findIndex((b) => b.name === name(pa)), ic = bones.findIndex((b) => b.name === name(ch));
    if (ip < 0 || ic < 0) continue;
    const verts = [];
    for (let i = 0; i < P.count; i++) {
      const w = [0, 1, 2, 3].map((k) => [J.getComponent(i, k), W.getComponent(i, k)]).sort((x, y) => y[1] - x[1]);
      const set = new Set([w[0][0], w[1][0]]);
      if (set.has(ip) && set.has(ic) && w[1][1] >= 0.15) verts.push(i);
    }
    const inR = new Set(verts), tris = [];
    for (let t = 0; t < index.count; t += 3) { const v = [index.getX(t), index.getX(t + 1), index.getX(t + 2)]; if (v.every((x) => inR.has(x))) tris.push(v); }
    regions.push({ joint, side: s, at: bones.find((b) => b.name === name(at)), verts, tris });
  }
  const pos = (out) => { for (const r of regions) for (const i of r.verts) body.getVertexPosition(i, out[i] ??= new THREE.Vector3()); };
  const area = (p, [a0, b0, c0]) => new THREE.Vector3().subVectors(p[b0], p[a0]).cross(new THREE.Vector3().subVectors(p[c0], p[a0])).length() / 2;
  h.update(true);
  root.updateMatrixWorld(true);
  const rest = [];
  pos(rest);
  const restRef = regions.map((r) => {
    const c = r.at.getWorldPosition(new THREE.Vector3());
    return { d: r.verts.map((i) => rest[i].distanceTo(c)), a: r.tris.map((t) => area(rest, t)) };
  });
  const out = {};
  for (const clipName of CLIPS) {
    const clip = lib.all.find((c) => c.name === clipName);
    for (const act of Object.values(a.actions)) act.setEffectiveWeight(0);
    const act = a.mixer.clipAction(clip); act.enabled = true; act.setEffectiveWeight(1); act.play();
    const worst = {};
    for (let t = 0; t < clip.duration; t += 1 / 30) {
      act.time = t; a.mixer.update(0); a.src.updateMatrixWorld(true);
      a.apply(root, { legScale: 1.04 }); root.updateMatrixWorld(true);
      h.update(); h.model.updateMatrixWorld(true);
      const now = [];
      pos(now);
      regions.forEach((r, k) => {
        const c = r.at.getWorldPosition(new THREE.Vector3());
        let g = 0;
        r.verts.forEach((i, j) => { g += now[i].distanceTo(c) / Math.max(restRef[k].d[j], 1e-4); });
        g /= Math.max(r.verts.length, 1);
        let pinched = 0;
        r.tris.forEach((tri, j) => { if (area(now, tri) < 0.4 * restRef[k].a[j]) pinched++; });
        const pinch = pinched / Math.max(r.tris.length, 1);
        const w = (worst[r.joint] ??= { girth: Infinity, pinch: 0 });
        w.girth = Math.min(w.girth, g); w.pinch = Math.max(w.pinch, pinch);
      });
    }
    act.setEffectiveWeight(0); act.stop();
    out[clipName] = worst;
  }
  return { out, verts: Object.fromEntries(regions.filter((r) => r.side === 'l').map((r) => [r.joint, r.verts.length])) };
}

const results = {};
for (const b of bodies) results[b.name] = audit(b);
if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 1));
else {
  const joints = Object.keys(JOINTS);
  console.log(`| Body | ${joints.map((j) => `${j} girth / pinch`).join(' | ')} |`);
  console.log(`|---|${joints.map(() => '---').join('|')}|`);
  for (const [name, r] of Object.entries(results)) {
    // the worst over every clip, and which clip
    const cells = joints.map((j) => {
      let g = Infinity, gc = '', p = 0;
      for (const [c, w] of Object.entries(r.out)) { if (w[j]?.girth < g) { g = w[j].girth; gc = c; } p = Math.max(p, w[j]?.pinch ?? 0); }
      return `${g.toFixed(2)} (${gc.replace(/_Loop|_Start/, '')}) / ${(p * 100).toFixed(0)}%`;
    });
    console.log(`| ${name} | ${cells.join(' | ')} |`);
  }
}
