// #800 phase 2: scripts/motion-audit's straight-line walk of a trial foe in each variant (node, no GPU): slide a metre,
// worst contact, reach and lift, groups and cadence, at full and half pace, per variant.
//   node references/enemy-redesign-2026-10-30/trials/motion-audit.mjs [crab@arzach2] [--json]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { TRIAL_BUILDERS } from '../../../src/enemies/plans/index.js';
import { shellbackModel } from '../../../src/enemies/plans/shellback.js';
import { tripoShellbackModel } from './shellback-tripo/model.js';
import { foeSystem, foeSubject, legsFor } from '../../../scripts/motion-audit/walk.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), json = args.includes('--json'), id = args.find((a) => !a.startsWith('--')) ?? 'crab@arzach2';
/** The Tripo source in node: the GLB's arrays as a BufferGeometry (no texture: the vertex colours stand in). */
function tripoSource() {
  const b = readFileSync(join(HERE, 'shellback-tripo/tripo-lod.glb')), jn = b.readUInt32LE(12), j = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn);
  const TY = { 5126: Float32Array, 5125: Uint32Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const acc = (i) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], A = TY[a.componentType], off = v.byteOffset + (a.byteOffset ?? 0); return { arr: new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT)), n: CO[a.type], norm: !!a.normalized }; };
  const p = j.meshes[0].primitives[0], g = new THREE.BufferGeometry();
  for (const [k, name] of [['POSITION', 'position'], ['NORMAL', 'normal'], ['TEXCOORD_0', 'uv'], ['COLOR_0', 'color']]) { const a = acc(p.attributes[k]); g.setAttribute(name, new THREE.BufferAttribute(a.arr, a.n, a.norm)); }
  g.setIndex(new THREE.BufferAttribute(acc(p.indices).arr, 1));
  return { geometry: g, map: null, landmarks: JSON.parse(readFileSync(join(HERE, 'shellback-tripo/landmarks.json'), 'utf8')) };
}
const src = tripoSource();
const VARIANTS = { current: null, direct: shellbackModel, tripo: (skin) => tripoShellbackModel(skin, src) };
// (two measures of a foot: the audit's own, the leg's lowest drawn point, and the kit's foot joint itself: a broad flat
//  sole has no one lowest point, its lowest vertex hops heel to toe, which reads as slide; the Tripo legs are bones
//  outside the kit's chains, read from the skin's foot bones)
const footJoints = (M) => M.rig.legs.map((L, k) => { const foot = M.group.getObjectByName(`leg${k}_foot`) ?? L.foot; return { lowest: (o) => foot.getWorldPosition(o), getWorldPosition: (o) => L.root.getWorldPosition(o) }; });
const kind = id.split('@')[0], out = {};
const brief = (r) => ({ slidePerMetre: +r.slidePerMetre.toFixed(4), worstSlide: +r.worstSlide.toFixed(3), reachShare: +(r.reachShare ?? 0).toFixed(3), liftShare: +(r.liftShare ?? 0).toFixed(3), cadence: r.cadence, bob: +r.bob.toFixed(3), groups: r.groups, legLength: +(r.legLength ?? 0).toFixed(2) });
for (const [v, fn] of Object.entries(VARIANTS)) {
  if (fn) TRIAL_BUILDERS[kind] = fn; else delete TRIAL_BUILDERS[kind];
  for (const pace of [1, 0.5]) for (const [m, legs] of [['lowest point', legsFor(kind)], ['foot joint', footJoints]]) {
    if (v === 'tripo' && m === 'lowest point') continue;   // (its skin's bones are not under the kit's legs: no lowest point to read)
    const sys = foeSystem();
    const r = foeSubject(sys, id, legs, { pace });
    out[`${v} ×${pace} · ${m}`] = json ? r : brief(r);
    sys.dispose();
  }
}
delete TRIAL_BUILDERS[kind];
if (json) console.log(JSON.stringify(out, null, 1));
else for (const [k, r] of Object.entries(out)) console.log(k.padEnd(30), JSON.stringify(r));
