import * as THREE from 'three';
import { RENDER_FRAME } from '../../render-frame.js';

// (the flyers' own; family A's share src/enemies/plans/tripo-body.js) The shipped Tripo bodies of #800 (public/enemies/<concept>/body.glb, made by scripts/tripo/ship-<name>.mjs from a
// trial's prepared asset), what their builders share: the GLB read at once without three's loader (one mesh, plain
// accessors: position, normal, uv, COLOR_0, indices, the flat texture, its extras), loaded once a body (a browser
// fetches it and decodes its texture; the engines and Node read the file at once and draw its vertex colours), a
// sub-mesh of its triangles, a skin's colours over its roles, and a skinned mesh's moving bounds. The shellback crab
// (shellback-tripo.js) has its own copy of these from before; the flyers (cloud-jelly-tripo.js, …) use this one.

const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
/** The GLB's mesh: { geometry (position, normal, uv, color: COLOR_0's bytes normalised), extras, landmarks, image, map: null }. */
export function parseTripoBody(bytes) {
  const u8 = ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : new Uint8Array(bytes);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const jn = dv.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jn))), bin = 28 + jn;
  const view = (i) => { const v = json.bufferViews[i]; return u8.slice(bin + (v.byteOffset ?? 0), bin + (v.byteOffset ?? 0) + v.byteLength); };   // (a copy: aligned)
  const acc = (i) => { const a = json.accessors[i], b = view(a.bufferView), A = TY[a.componentType];
    return new THREE.BufferAttribute(new A(b.buffer, a.byteOffset ?? 0, a.count * CO[a.type]), CO[a.type], !!a.normalized); };
  const mesh = json.meshes[0], p = mesh.primitives[0], g = new THREE.BufferGeometry();
  g.setAttribute('position', acc(p.attributes.POSITION)); g.setAttribute('normal', acc(p.attributes.NORMAL));
  g.setAttribute('uv', acc(p.attributes.TEXCOORD_0)); g.setAttribute('color', acc(p.attributes.COLOR_0));
  g.setIndex(acc(p.indices));
  const im = json.images?.[0];
  return { geometry: g, extras: mesh.extras, landmarks: mesh.extras.landmarks, image: im ? { bytes: view(im.bufferView), mime: im.mimeType } : null, map: null };
}

/** The load's deadline (ms): past it the foes are made with the stand-in body (tests/load-awaits.test.js). */
export const LOAD_DEADLINE = 30000;

/**
 * One shipped body (`file` under public/): { source() (the loaded body or null; the engines and Node read it on first
 * use, through `readNow`), load(base) (once; resolves to the body, or null with the stand-in left in), set(src) (a test's,
 * a trial's) }. `readNow()`: the file's bytes where they can be read at once (the engines' host, Node's files), else null;
 * each body's own module gives it, its path a constant there, so the test selector can see what it reads.
 */
export function tripoBody(file, name, readNow) {
  let source = null, pending = null, tried = false;
  const read = () => { try { return readNow() ?? null; } catch (e) { return null; } };   // (not there: the stand-in body)
  const get = () => { if (!source && !tried) { tried = true; const b = read(); if (b) source = parseTripoBody(b); } return source; };
  const load = (base = import.meta.env?.BASE_URL ?? '/') => {
    if (get()) return Promise.resolve(source);
    if (typeof fetch !== 'function') return Promise.resolve(null);
    // (a deadline, as the load's other assets have: a fetch that never answers leaves the stand-in body)
    let timer = null;
    const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve(null), LOAD_DEADLINE); });
    return pending ??= Promise.race([deadline, (async () => {
      const r = await fetch(`${base}${file}`);
      if (!r.ok || /text\/html/.test(r.headers.get('content-type') ?? '')) throw new Error(`no ${file} (${r.status})`);
      const src = parseTripoBody(await r.arrayBuffer());
      if (src.image && typeof createImageBitmap === 'function') {
        const bmp = await createImageBitmap(new Blob([src.image.bytes], { type: src.image.mime }), { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
        // (its texels are the printed colours the G-buffer takes; glTF's UVs: not flipped)
        const map = new THREE.Texture(bmp); map.colorSpace = THREE.NoColorSpace; map.flipY = false; map.needsUpdate = true;
        src.map = map;
      }
      return (source = src);
    })()]).then((src) => { clearTimeout(timer); if (!src) { pending = null; console.warn(`the ${name} body did not load in time: its stand-in`); } return src; },
      (e) => { clearTimeout(timer); pending = null; console.warn(`the ${name} body did not load: its stand-in`, e); return null; });
  };
  const set = (src) => { source = src; tried = !!src; pending = null; };
  return { source: get, load, set, file };
}

/** A sub-geometry of `geo`: these triangles (first, count) of its index, its attributes shared. */
export function subset(geo, ranges, attrs = geo.attributes) {
  const I = geo.index.array, tris = [];
  for (const [first, count] of ranges) for (let i = first * 3; i < (first + count) * 3; i++) tris.push(I[i]);
  const g = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(attrs)) g.setAttribute(k, a);
  g.setIndex(tris);
  return g;
}

/**
 * A part of `geo` as a geometry of its own: these triangles' vertices only, moved by `offset` (its own origin: a bulb's
 * middle, the cap's lip, so its surface's patterns sit round its own axis), its attributes copied (`keys`). Returns
 * { geometry, from } (from: each new vertex's index in `geo`, for a skin's colours over it).
 */
export function piece(geo, ranges, offset = new THREE.Vector3(), keys = ['position', 'normal', 'uv']) {
  const I = geo.index.array, map = new Map(), from = [], tris = [];
  for (const [first, count] of ranges) for (let i = first * 3; i < (first + count) * 3; i++) {
    const v = I[i]; if (!map.has(v)) { map.set(v, from.length); from.push(v); } tris.push(map.get(v));
  }
  const g = new THREE.BufferGeometry();
  for (const k of keys) {
    const a = geo.attributes[k]; if (!a) continue;
    const size = a.itemSize, arr = new Float32Array(from.length * size);
    from.forEach((v, j) => { for (let c = 0; c < size; c++) arr[j * size + c] = a.getComponent(v, c); });
    if (k === 'position') for (let j = 0; j < from.length; j++) { arr[j * 3] += offset.x; arr[j * 3 + 1] += offset.y; arr[j * 3 + 2] += offset.z; }
    g.setAttribute(k, new THREE.BufferAttribute(arr, size));
  }
  g.setIndex(tris);
  return { geometry: g, from: Uint32Array.from(from) };
}
/** An attribute of `src` read at the vertices `from` (a piece's own copy of the skin's colours). */
export function pick(src, from) {
  const size = src.itemSize, arr = new Float32Array(from.length * size);
  from.forEach((v, j) => { for (let c = 0; c < size; c++) arr[j * size + c] = src.getComponent(v, c); });
  return new THREE.BufferAttribute(arr, size);
}

/** Each vertex's colour role: the nearest of `roles` (name → '#hex', as COLOR_0's bytes: sRGB, not THREE.Color's linear). */
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

/** A skin's colours over the roles (`want`: role → colour), as a float colour attribute (linear, as three's are). */
export function roleColours(roles, want, fallback) {
  const n = roles.role.length, out = new Float32Array(n * 3), cols = roles.keys.map((k) => new THREE.Color(want[k] ?? fallback[k]));
  for (let i = 0; i < n; i++) { const c = cols[roles.role[i]]; out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b; }
  return new THREE.BufferAttribute(out, 3);
}

/**
 * A skinned mesh's bounds as its bones move (a gallery frames it, the blade meets it: src/foe-body.js): each bone's box
 * of the vertices it carries most, at the bone's place now. `major(i)`: vertex i's main bone (its first skin index: the
 * builders put the larger weight first). As kit.js skinned does.
 */
export function boneBoxes(sm, bones, major = (i) => sm.geometry.attributes.skinIndex.getX(i)) {
  const local = bones.map(() => new THREE.Box3()), pos = sm.geometry.attributes.position, v = new THREE.Vector3(), seen = new Uint8Array(pos.count);
  const idx = sm.geometry.index?.array ?? Array.from({ length: pos.count }, (_, i) => i);
  sm.updateMatrixWorld(true);
  for (const i of idx) { if (seen[i]) continue; seen[i] = 1; const b = major(i); local[b].expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(sm.matrixWorld).applyMatrix4(sm.skeleton.boneInverses[b])); }
  sm.userData.boneBoxes = { bones, local };
  const box = new THREE.Box3(), sphere = new THREE.Sphere(), back = new THREE.Matrix4(), corner = new THREE.Vector3();
  const bounds = () => { sm.updateWorldMatrix(true, false); back.copy(sm.matrixWorld).invert(); box.makeEmpty();
    bones.forEach((b, i) => { const Lb = local[i]; if (Lb.isEmpty()) return; b.updateWorldMatrix(true, false); for (let k = 0; k < 8; k++) box.expandByPoint(corner.set(k & 1 ? Lb.max.x : Lb.min.x, k & 2 ? Lb.max.y : Lb.min.y, k & 4 ? Lb.max.z : Lb.min.z).applyMatrix4(b.matrixWorld).applyMatrix4(back)); });
    return box; };
  let at = -1;
  Object.defineProperty(sm, 'boundingBox', { configurable: true, get: bounds, set() {} });
  Object.defineProperty(sm, 'boundingSphere', { configurable: true, get: () => { if (RENDER_FRAME.on && at === RENDER_FRAME.n) return sphere; at = RENDER_FRAME.on ? RENDER_FRAME.n : -1; return bounds().getBoundingSphere(sphere); }, set() {} });
}

/** The surface's normal near `at` (the geometry's vertices within r, averaged), or `fallback`. */
export function normalNear(geo, at, r = 0.06, fallback = new THREE.Vector3(0, 0, 1)) {
  const P = geo.attributes.position, N = geo.attributes.normal, n = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) if (v.fromBufferAttribute(P, i).distanceTo(at) < r) n.add(v.fromBufferAttribute(N, i));
  return n.lengthSq() > 1e-9 ? n.normalize() : fallback.clone();
}
/** The geometry's surface point nearest `at` along `dir` from inside (the farthest vertex within a cone round dir): for eyes laid on it. */
export function surfaceAlong(geo, from, dir, cone = 0.08) {
  const P = geo.attributes.position, v = new THREE.Vector3(), d = new THREE.Vector3(); let best = -Infinity, out = null;
  for (let i = 0; i < P.count; i++) {
    d.subVectors(v.fromBufferAttribute(P, i), from); const t = d.dot(dir); if (t <= 0) continue;
    if (d.addScaledVector(dir, -t).length() > cone) continue;
    if (t > best) { best = t; out = v.clone(); }
  }
  return out;
}
