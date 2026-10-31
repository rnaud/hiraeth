import * as THREE from 'three';

// The family A Tripo bodies' shared pieces (#800: the toad, the centipede, the skitter): their meshes are loaded by
// src/enemies/foe-assets.js (public/enemies/<concept>/body.glb, its triangles grouped by part, COLOR_0 each part's flat
// colour, and landmarks.json beside it, written by scripts/tripo/ship-body.mjs); here the trial's own GLB reader (a body's
// asset with its landmarks in its extras, references/enemy-redesign-2026-10-30/trials/familyA-tripo/<foe>-lod.glb, for the
// tests), the bones' boxes, a part's sub-geometry and a surface's normal.

const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
/** A shipped GLB read: { geometry (position, normal, uv, color: COLOR_0's bytes, normalised), landmarks, image: { bytes, mime } | null, map: null }. */
export function parseTripoBody(bytes) {
  // (a plain Uint8Array view: a Node Buffer's slice shares its memory, and its pool's offset)
  const u8 = ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : new Uint8Array(bytes);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const jn = dv.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jn))), bin = 28 + jn;
  const view = (i) => { const v = json.bufferViews[i]; return u8.slice(bin + (v.byteOffset ?? 0), bin + (v.byteOffset ?? 0) + v.byteLength); };   // (a copy: aligned)
  const acc = (i) => { const a = json.accessors[i], b = view(a.bufferView), A = TY[a.componentType];
    return new THREE.BufferAttribute(new A(b.buffer, a.byteOffset ?? 0, a.count * CO[a.type]), CO[a.type], !!a.normalized); };
  const mesh = json.meshes[0], p = mesh.primitives[0], g = new THREE.BufferGeometry();
  g.setAttribute('position', acc(p.attributes.POSITION)); g.setAttribute('normal', acc(p.attributes.NORMAL));
  if (p.attributes.TEXCOORD_0 !== undefined) g.setAttribute('uv', acc(p.attributes.TEXCOORD_0));
  g.setAttribute('color', acc(p.attributes.COLOR_0));
  g.setIndex(acc(p.indices));
  const im = json.images?.[0];
  return { geometry: g, landmarks: mesh.extras.landmarks ?? null, image: im ? { bytes: view(im.bufferView), mime: im.mimeType } : null, map: null };
}

// ---------------------------------------------------------------------------------------------- shared helpers
/** The colour role of each vertex (its COLOR_0, nearest of `roles` { name: '#hex' }), as COLOR_0's bytes (sRGB, not THREE.Color's linear). */
export function rolesOf(geo, roles) {
  const C = geo.attributes.color, n = C.count, out = new Uint8Array(n), keys = Object.keys(roles);
  const ref = keys.map((k) => { const h = parseInt(roles[k].slice(1), 16); return [(h >> 16) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]; });
  for (let i = 0; i < n; i++) {
    const r = C.getX(i), g = C.getY(i), b = C.getZ(i); let best = 0, d = Infinity;
    ref.forEach((c, k) => { const e = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2; if (e < d) { d = e; best = k; } });
    out[i] = best;
  }
  return { role: out, keys };
}

/** A skin's colours over the mesh's roles (`want[role]` a colour, else the role's own): COLOR_0 recoloured, linear floats. */
export function roleColours(n, role, keys, want, roles) {
  const out = new Float32Array(n * 3), cols = keys.map((k) => new THREE.Color(want[k] ?? roles[k]));
  for (let i = 0; i < n; i++) { const c = cols[role[i]]; out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b; }
  return new THREE.BufferAttribute(out, 3);
}

/**
 * Each bone's box of the vertices it carries most (the body the blade meets, src/foe-body.js; a gallery's frame), as
 * kit.js skinned does; the skinned mesh's bounds from them (it is drawn where its bones are, not its bind).
 */
export function boneBoxes(sm, bones, SI, RENDER_FRAME) {
  const local = bones.map(() => new THREE.Box3()), pos = sm.geometry.attributes.position, idx = sm.geometry.index.array, v = new THREE.Vector3(), seen = new Uint8Array(pos.count);
  sm.updateMatrixWorld(true);
  for (const i of idx) { if (seen[i]) continue; seen[i] = 1; const b = SI[i * 4]; local[b].expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(sm.matrixWorld).applyMatrix4(sm.skeleton.boneInverses[b])); }
  sm.userData.boneBoxes = { bones, local };
  const box = new THREE.Box3(), sphere = new THREE.Sphere(), back = new THREE.Matrix4(), corner = new THREE.Vector3();
  const bounds = () => { sm.updateWorldMatrix(true, false); back.copy(sm.matrixWorld).invert(); box.makeEmpty();
    bones.forEach((b, i) => { const Lb = local[i]; if (Lb.isEmpty()) return; b.updateWorldMatrix(true, false); for (let k = 0; k < 8; k++) box.expandByPoint(corner.set(k & 1 ? Lb.max.x : Lb.min.x, k & 2 ? Lb.max.y : Lb.min.y, k & 4 ? Lb.max.z : Lb.min.z).applyMatrix4(b.matrixWorld).applyMatrix4(back)); });
    return box; };
  let at = -1;
  Object.defineProperty(sm, 'boundingBox', { configurable: true, get: bounds, set() {} });
  Object.defineProperty(sm, 'boundingSphere', { configurable: true, get: () => { if (RENDER_FRAME.on && at === RENDER_FRAME.n) return sphere; at = RENDER_FRAME.on ? RENDER_FRAME.n : -1; return bounds().getBoundingSphere(sphere); }, set() {} });
}

/** A sub-geometry of `geo` with these triangles (its attributes shared, its own index). */
export const subset = (geo, tris, attrs) => { const g = new THREE.BufferGeometry(); for (const [k, a] of Object.entries(attrs)) g.setAttribute(k, a); g.setIndex(tris); return g; };

/** The surface's normal near `at` (the geometry's vertices within `r` m, averaged), or `fallback`. */
export function surfaceNormal(geo, at, r = 0.05, fallback = new THREE.Vector3(0, 0, 1)) {
  const P = geo.attributes.position, N = geo.attributes.normal, n = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) if (v.fromBufferAttribute(P, i).distanceTo(at) < r) n.add(v.fromBufferAttribute(N, i));
  if (n.lengthSq() < 1e-9) return fallback.clone();
  return n.normalize();
}
