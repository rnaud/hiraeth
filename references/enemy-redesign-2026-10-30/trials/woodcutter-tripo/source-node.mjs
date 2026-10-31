// The wood cutter's Tripo source in node (the motion audit; the game's own: src/enemies/foe-assets.js): public/enemies/woodcutter/'s GLB arrays as a BufferGeometry, no
// texture (its vertex colours stand in), and the landmarks.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

export function nodeSource(dir = new URL('../../../../public/enemies/woodcutter/', import.meta.url)) {
  const b = readFileSync(new URL('body.glb', dir)), jn = b.readUInt32LE(12), j = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn);
  const TY = { 5126: Float32Array, 5125: Uint32Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const acc = (i) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], A = TY[a.componentType], off = v.byteOffset + (a.byteOffset ?? 0); return new THREE.BufferAttribute(new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT)), CO[a.type], !!a.normalized); };
  const p = j.meshes[0].primitives[0], g = new THREE.BufferGeometry();
  g.setAttribute('position', acc(p.attributes.POSITION)); g.setAttribute('normal', acc(p.attributes.NORMAL)); g.setAttribute('uv', acc(p.attributes.TEXCOORD_0)); g.setAttribute('color', acc(p.attributes.COLOR_0));
  g.setIndex(acc(p.indices));
  return { geometry: g, map: null, landmarks: JSON.parse(readFileSync(new URL('landmarks.json', dir), 'utf8')), triangles: j.meshes[0].extras.triangles };
}
