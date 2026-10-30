// The Tripo mummer's source in node (no texture: its vertex colours stand in), for the walk audit and the tests:
// tripo-lod.glb's arrays as a BufferGeometry (skinIndex and skinWeight from JOINTS_0 and WEIGHTS_0) and skeleton.json.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const HERE = dirname(fileURLToPath(import.meta.url));
export function tripoMummerSource() {
  const b = readFileSync(join(HERE, 'tripo-lod.glb')), jn = b.readUInt32LE(12), j = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn);
  const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const acc = (i) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], A = TY[a.componentType], off = v.byteOffset + (a.byteOffset ?? 0);
    return { arr: new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT)), n: CO[a.type], norm: !!a.normalized }; };
  const p = j.meshes[0].primitives[0], g = new THREE.BufferGeometry();
  for (const [k, name] of [['POSITION', 'position'], ['NORMAL', 'normal'], ['TEXCOORD_0', 'uv'], ['COLOR_0', 'color'], ['JOINTS_0', 'skinIndex'], ['WEIGHTS_0', 'skinWeight']]) {
    const a = acc(p.attributes[k]); g.setAttribute(name, new THREE.BufferAttribute(a.arr, a.n, a.norm));
  }
  g.setIndex(new THREE.BufferAttribute(acc(p.indices).arr, 1));
  return { geometry: g, map: null, skeleton: JSON.parse(readFileSync(join(HERE, 'skeleton.json'), 'utf8')) };
}
