// The hound's Tripo trial asset in node (tests, the motion audit): tripo-lod.glb's arrays as a BufferGeometry (no
// texture: its vertex colours stand in) and the landmarks; what loadTripoHound gives the page.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const HERE = new URL('./', import.meta.url);
export function nodeSource() {
  const b = readFileSync(new URL('tripo-lod.glb', HERE)), jn = b.readUInt32LE(12), j = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn);
  const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const acc = (i) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], A = TY[a.componentType], off = v.byteOffset + (a.byteOffset ?? 0); return new THREE.BufferAttribute(new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT)), CO[a.type], !!a.normalized); };
  const p = j.meshes[0].primitives[0], g = new THREE.BufferGeometry();
  for (const [k, name] of [['POSITION', 'position'], ['NORMAL', 'normal'], ['TEXCOORD_0', 'uv'], ['COLOR_0', 'color'], ['JOINTS_0', 'skinIndex'], ['WEIGHTS_0', 'skinWeight']]) g.setAttribute(name, acc(p.attributes[k]));
  g.setIndex(acc(p.indices));
  return { geometry: g, map: null, landmarks: JSON.parse(readFileSync(new URL('landmarks.json', HERE), 'utf8')), triangles: j.meshes[0].extras.triangles };
}
