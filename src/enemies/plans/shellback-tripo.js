import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, pivot, ease, eyeColor, finish, plate, tubeGeometry, merged, V } from './kit.js';
import { gazePart } from '../gaze.js';
import { SkinLegs, bendFrame } from '../../characters/creature-legs.js';
import { RENDER_FRAME } from '../../render-frame.js';
import { shellbackModel } from './shellback.js';

// The shellback crab (issue #800): the game's `crab`, everywhere it is fielded (its worlds, the Arena, the fight temples,
// the creatures gallery). Its body is Tripo's (task 5f2aa15f-…, from the approved image,
// references/enemy-redesign-2026-10-30/shellback/e8102be7-…-2.png), made into the game's asset by the trial's prepare.mjs
// (references/enemy-redesign-2026-10-30/trials/shellback-tripo/: the game's frame and size, 12k triangles, the dome cut
// along its lip, five flat colours) and shipped by scripts/tripo/ship-shellback.mjs as public/enemies/shellback/body.glb
// (its 512² flat texture, COLOR_0, the landmarks in its extras). Put on the crab's rig family here: the motion kit's
// walker plan, an alternating tripod, its legs fitted to the mesh's own (the landmarks: each leg's hip, knee, ankle and
// foot, the claws' shoulder, knuckle, finger, hand and tip).
//
// No humanoid skeleton: a custom skin. Each leg's thigh, shin and foot are bones framed in the leg's bend plane
// (src/characters/creature-legs.js SkinLegs, the Keeper's route, #267: the kit's own segments solve, the bones follow
// without the half-turn flips of a straight-down shin); the collar and belly ride the body, the face its own bone; each
// claw a shoulder, a blade and an inner finger. Every vertex is weighted to its nearest part (a capsule round each
// segment; the body an ellipsoid under the dome), blended with the next over a few centimetres at the hips, knees,
// ankles and the claws' joints, so the fused mesh bends there instead of tearing. The dome (its triangles first in the
// index) is its own mesh on the body, one flat colour (a bomb cracks it off); its two front scutes copied off it as the
// armour that falls (Foes.dropPlate).
//
// Its look at you (the author's, #800): the painted eyes are painted out of the texture and two slit eyes stand in
// their place, their own parts on a face bone; the gaze (src/enemies/gaze.js) turns the face toward the traveller and
// slides the eyes the rest of the way (they go orange as it winds up).
//
// The claw: a ball against the face's side (the shoulder), the inner finger rising from it to the knuckle at the top
// of the arch, the blade hanging from the knuckle in front, each their own bone hinged at the knuckle: the snap opens
// the jaw between them at the top of its wind and slams it shut as the pincer chops down.
//
// Skins (src/enemies/skins.js): the home skin (the cliff crab's, Vael II) wears the reference's colours from the
// texture; every other skin recolours the mesh's five colour roles from its palette (vertex colours), paints its dome
// with the skin's `shell` surface (src/enemies/surfaces.js: the anchor crab's barnacle rosettes, the oil beetle's
// gloss, the copper beetle's rust, the glass crab's glow) and wears its dress, merged a material (antennae, a copper
// patina, barnacles, a rope and an anchor, coral, glass facets, a stall's awning), hidden when the dome cracks.
//
// The engines (Unity) decode no picture: there the home skin is drawn by its vertex colours too (the texture's five,
// exactly). Where the asset is missing or not loaded yet (a browser page that built a crab before
// loadShellbackBody finished, an old player's files), the direct shellback (plans/shellback.js) stands in.
//
// The crab in everything else: the same archetype, def, attacks, windows, sounds, death recipe, lying body.

/** The load's deadline (ms): past it the foes are made with the direct body (tests/load-awaits.test.js). */
export const LOAD_DEADLINE = 30000;
/** The shipped body, under public/. */
export const SHELLBACK_BODY = 'enemies/shellback/body.glb';
/** The roles of the flat texture's colours (prepare.mjs PALETTE, landmarks.palette: one flat colour a role). */
const ROLES = { shell: '#df9f45', leg: '#f1e2ae', claw: '#c75f3a', collar: '#6f9d72', dark: '#3a2c22' };
/** The face that turns to you (game frame, m): the ellipsoid of the vertices it carries, where it turns about, how far. */
const FACE = { at: [0, 0.7, 0.74], radii: [0.26, 0.15, 0.17], pivot: [0, 0.7, 0.5], yaw: 0.3, up: 0.12, down: 0.15 };
const BLEND = 0.05;   // m over which a vertex is shared by its two nearest parts

const _v = new THREE.Vector3(), _a = new THREE.Vector3();
/** Distance from p to the segment a–b. */
const segDist = (p, a, b) => { _a.subVectors(b, a); const t = THREE.MathUtils.clamp(_v.subVectors(p, a).dot(_a) / Math.max(1e-9, _a.lengthSq()), 0, 1); return _v.copy(a).addScaledVector(_a, t).distanceTo(p); };
const vec = (a) => new THREE.Vector3(...a);

// ---------------------------------------------------------------------------------------------- the source
const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
/**
 * The shipped GLB (scripts/tripo/ship-shellback.mjs: one mesh, plain accessors) read at once, without three's loader:
 * { geometry (position, normal, uv, color: COLOR_0's bytes, normalised), landmarks, image: { bytes, mime } | null, map: null }.
 */
export function parseShellback(bytes) {
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
  g.setAttribute('uv', acc(p.attributes.TEXCOORD_0)); g.setAttribute('color', acc(p.attributes.COLOR_0));
  g.setIndex(acc(p.indices));
  const im = json.images?.[0];
  return { geometry: g, landmarks: mesh.extras.landmarks, image: im ? { bytes: view(im.bufferView), mime: im.mimeType } : null, map: null };
}

let source = null, pending = null, tried = false;
/** The body's bytes where they can be read at once: the engines' host (public/), Node's files (tests, tools); else null (a browser). */
function readNow() {
  try {
    const host = globalThis.__HIRAETH_HOST__;
    if (host?.readFile) return host.readFile(SHELLBACK_BODY) ?? null;
    const fs = globalThis.process?.getBuiltinModule?.('node:fs');
    if (fs) return fs.readFileSync(new URL(`../../../public/${SHELLBACK_BODY}`, import.meta.url));
  } catch (e) { /* not there: the direct body stands in */ }
  return null;
}
/** The loaded body (null until loaded; the engines and Node read it on first use). */
export function shellbackSource() {
  if (!source && !tried) { tried = true; const b = readNow(); if (b) source = parseShellback(b); }
  return source;
}
/**
 * The body, loaded once (a browser: fetched, its texture decoded; the engines and Node: read at once, no texture). The
 * game awaits it before it builds its foes (src/main.js); a failed load leaves the direct shellback standing in.
 */
export function loadShellbackBody(base = import.meta.env?.BASE_URL ?? '/') {
  if (shellbackSource()) return Promise.resolve(source);
  if (typeof fetch !== 'function') return Promise.resolve(null);
  // (a deadline, as the load's other assets have: a fetch that never answers leaves the direct body standing in)
  let timer = null;
  const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve(null), LOAD_DEADLINE); });
  return pending ??= Promise.race([deadline, (async () => {
    const r = await fetch(`${base}${SHELLBACK_BODY}`);
    if (!r.ok || /text\/html/.test(r.headers.get('content-type') ?? '')) throw new Error(`no ${SHELLBACK_BODY} (${r.status})`);
    const src = parseShellback(await r.arrayBuffer());
    if (src.image && typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(new Blob([src.image.bytes], { type: src.image.mime }), { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      // (its texels are the printed colours the G-buffer takes; glTF's UVs: not flipped)
      const map = new THREE.Texture(bmp); map.colorSpace = THREE.NoColorSpace; map.flipY = false; map.needsUpdate = true;
      src.map = map;
    }
    return (source = src);
  })()]).then((src) => { clearTimeout(timer); if (!src) { pending = null; console.warn('the shellback body did not load in time: the direct shellback stands in'); } return src; },
    (e) => { clearTimeout(timer); pending = null; console.warn('the shellback body did not load: the direct shellback stands in', e); return null; });
}
/** Stand a source in (the trial page's, a test's), or null to forget it (the next build reads it again). */
export function setShellbackSource(src) { source = src; tried = !!src; pending = null; }

/** The crab's builder (src/enemies/plans/index.js): the Tripo body, or the direct shellback where it is not loaded. */
export function shellbackCrab(skin) {
  const src = shellbackSource();
  return src ? tripoShellbackModel(skin, src) : shellbackModel(skin);
}

// ---------------------------------------------------------------------------------------------- the weights
/** The colour role of each vertex (its COLOR_0, nearest of ROLES). */
function rolesOf(geo) {
  const C = geo.attributes.color, n = C.count, out = new Uint8Array(n), keys = Object.keys(ROLES), ref = keys.map((k) => { const h = parseInt(ROLES[k].slice(1), 16); return { r: (h >> 16) / 255, g: ((h >> 8) & 255) / 255, b: (h & 255) / 255 }; });   // (as COLOR_0's bytes: sRGB, not THREE.Color's linear)
  for (let i = 0; i < n; i++) {
    const r = C.getX(i), g = C.getY(i), b = C.getZ(i); let best = 0, d = Infinity;
    ref.forEach((c, k) => { const e = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2; if (e < d) { d = e; best = k; } });
    out[i] = best;
  }
  return { out, keys };
}

const CACHE = new WeakMap();
/** The weights and splits of one source geometry (worked out once: every shellback shares them). */
function prepare(src, bones) {
  const hit = CACHE.get(src.geometry); if (hit) return hit;
  const geo = src.geometry, L = src.landmarks, P = geo.attributes.position, n = P.count;
  const { out: role, keys } = rolesOf(geo);
  const red = (i) => keys[role[i]] === 'claw';
  // the parts' segments, in the group's frame (bone index: the order of `bones.list`); a claw's only for its red
  // vertices (the face's side is pressed against the shoulder's ball)
  const segs = [];
  L.claws.forEach((c, k) => {
    const B = bones.claw[k];
    segs.push({ b: B.arm, a: vec(c.shoulder), z: vec(c.elbow), r: 0.13, claw: true });
    segs.push({ b: B.finger, a: vec(c.knuckle), z: vec(c.finger), r: 0.08, claw: true });
    segs.push({ b: B.blade, a: vec(c.knuckle), z: vec(c.hand), r: 0.1, claw: true });
    segs.push({ b: B.blade, a: vec(c.hand), z: vec(c.tip), r: 0.13, claw: true });
  });
  L.legs.forEach((l, k) => {
    segs.push({ b: bones.leg[k].thigh, a: vec(l.hip), z: vec(l.knee), r: 0.12 });
    segs.push({ b: bones.leg[k].shin, a: vec(l.knee), z: vec(l.ankle), r: 0.12 });
    segs.push({ b: bones.leg[k].foot, a: vec(l.ankle).setY(0.07), z: vec(l.foot).setY(0.05), r: 0.16, foot: true });
  });
  // the body: an ellipsoid under the dome, its sides at the hips
  const hipX = Math.abs(L.legs[0].hip[0]), cy = L.legs[0].hip[1] + 0.12, zs = L.legs.map((l) => l.hip[2]), cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const ex = hipX * 0.98, ey = 0.42, ez = (Math.max(...zs) - Math.min(...zs)) / 2 + 0.32;
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4), p = new THREE.Vector3();
  const fa = FACE.at, fr = FACE.radii;
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(P, i);
    const e = Math.hypot(p.x / ex, (p.y - cy) / ey, (p.z - cz) / ez), isRed = red(i);
    let best = { s: (e - 1) * ex, b: bones.body }, second = { s: Infinity, b: bones.body };
    for (const s of segs) {
      if (s.claw && !isRed) continue;
      let d = segDist(p, s.a, s.z) - s.r;
      if (s.foot && p.y > 0.16) d += 1;   // (the foot only under the ankle)
      if (d < best.s) { second = best; best = { s: d, b: s.b }; } else if (d < second.s && s.b !== best.b) second = { s: d, b: s.b };
    }
    let w = second.b === best.b ? 1 : THREE.MathUtils.clamp(0.5 + (second.s - best.s) / (2 * BLEND), 0.5, 1);
    // the face: what the body carries inside the face's ellipsoid goes to the face bone, eased out to its edge
    if (best.b === bones.body && !isRed) {
      const f = 1 - THREE.MathUtils.smoothstep(Math.hypot((p.x - fa[0]) / fr[0], (p.y - fa[1]) / fr[1], (p.z - fa[2]) / fr[2]), 0.6, 1);
      if (f > 0) { const on = f >= 0.5; best = { b: on ? bones.face : bones.body }; second = { b: on ? bones.body : bones.face }; w = on ? f : 1 - f; }
    }
    SI[i * 4] = best.b; SW[i * 4] = w; SI[i * 4 + 1] = second.b; SW[i * 4 + 1] = 1 - w;
  }
  // the triangles: the dome's (prepare.mjs cut it along its lip: its triangles first) to the dome's mesh, the rest skinned
  const I = geo.index.array, nd = L.domeTriangles * 3;
  const domeTris = Array.from(I.subarray(0, nd)), restTris = Array.from(I.subarray(nd));
  const out = { SI, SW, role, keys, domeTris, restTris, cy, top: domeHeights(P, domeTris, L.legs[0].hip[1]) };
  CACHE.set(src.geometry, out);
  return out;
}

/**
 * The dome's top over the ground plan, in the body's frame (where a skin's dress sits): a grid of the highest point of
 * the dome's triangles over each cell, read back as at(x, z) → y and normal(x, z) → its surface's normal there.
 */
function domeHeights(P, tris, bodyY, cells = 40) {
  const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (const v of tris) { const x = P.getX(v), z = P.getZ(v); lo[0] = Math.min(lo[0], x); lo[1] = Math.min(lo[1], z); hi[0] = Math.max(hi[0], x); hi[1] = Math.max(hi[1], z); }
  const sx = (hi[0] - lo[0]) / cells, sz = (hi[1] - lo[1]) / cells, H = new Float32Array((cells + 1) ** 2).fill(-Infinity);
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    const ax = P.getX(a), az = P.getZ(a), bx = P.getX(b), bz = P.getZ(b), cx = P.getX(c), cz = P.getZ(c), det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 1e-12) continue;
    for (let i = Math.max(0, Math.floor((Math.min(ax, bx, cx) - lo[0]) / sx)); i <= Math.min(cells, Math.ceil((Math.max(ax, bx, cx) - lo[0]) / sx)); i++)
      for (let k = Math.max(0, Math.floor((Math.min(az, bz, cz) - lo[1]) / sz)); k <= Math.min(cells, Math.ceil((Math.max(az, bz, cz) - lo[1]) / sz)); k++) {
        const x = lo[0] + i * sx, z = lo[1] + k * sz, l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det, l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        const y = l1 * P.getY(a) + l2 * P.getY(b) + l3 * P.getY(c) - bodyY, j = i * (cells + 1) + k;
        if (y > H[j]) H[j] = y;
      }
  }
  const cell = (x, z) => { const i = Math.round(THREE.MathUtils.clamp((x - lo[0]) / sx, 0, cells)), k = Math.round(THREE.MathUtils.clamp((z - lo[1]) / sz, 0, cells)); return H[i * (cells + 1) + k]; };
  const at = (x, z) => { const y = cell(x, z); return Number.isFinite(y) ? y : 0; };
  const normal = (x, z) => { const d = 0.06, gx = (at(x + d, z) - at(x - d, z)) / (2 * d), gz = (at(x, z + d) - at(x, z - d)) / (2 * d); return V(-gx, 1, -gz).normalize(); };
  return { at, normal, lo, hi };
}

/** The colours of a skin over the mesh's roles (a world's own look on the same body): COLOR_0 recoloured. */
function skinColours(geo, prep, P) {
  const n = geo.attributes.color.count, out = new Float32Array(n * 3);
  const want = { shell: P.shell, leg: P.leg, claw: P.claw, collar: P.collar ?? P.joint, dark: P.dark };
  const cols = prep.keys.map((k) => new THREE.Color(want[k] ?? ROLES[k]));
  for (let i = 0; i < n; i++) { const c = cols[prep.role[i]]; out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b; }
  return new THREE.BufferAttribute(out, 3);
}

/** A sub-geometry of `geo` with these triangles (its attributes shared, its own index). */
const subset = (geo, tris, attrs) => { const g = new THREE.BufferGeometry(); for (const [k, a] of Object.entries(attrs)) g.setAttribute(k, a); g.setIndex(tris); return g; };

// ---------------------------------------------------------------------------------------------- a skin's dress
/**
 * A skin's dress over the dome (the body's frame), merged a material: { geometries by material, awning (its own pivot) }.
 * Laid out over the dome's plan (x ±0.8 m, z −1.24…0.85 m) on its measured top (domeHeights).
 */
function dress(body, props, P, M, top) {
  const kit = new Map(), put = (mat, geo) => { if (!kit.has(mat)) kit.set(mat, []); kit.get(mat).push(geo); };
  const accentM = M.mat('sbAccent', P.accent, { flat: true }), inkM = M.mat('sbDressInk', P.dark, { flat: true });
  const cz = -0.2, RX = 0.74, RZ = 0.98;   // (the dome's middle and its half-spans, a little inside its lip)
  /** geo laid on the dome at (x, z): its +z along the surface's normal there, `lift` m over it. */
  const sit = (geo, x, z, lift = 0) => geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), top.normal(x, z))).translate(x, top.at(x, z) + lift, z);
  const polar = (a, r) => [Math.sin(a) * r * RX, cz + Math.cos(a) * r * RZ];
  if (props.has('antennae')) for (const s of [-1, 1]) put(inkM, tubeGeometry([[s * 0.1, -0.02, 0.8], [s * 0.3, 0.34, 1.12], [s * 0.55, 0.56, 1.34], [s * 0.75, 0.54, 1.5]], 0.016));
  if (props.has('patina')) for (let i = 0; i < 7; i++) { const [x, z] = polar(i * 2.1, 0.28 + (i % 3) * 0.2); put(accentM, sit(new THREE.SphereGeometry(0.13, 7, 4).scale(1, 1, 0.25), x, z)); }
  if (props.has('barnacles')) for (let i = 0; i < 5; i++) { const a = i * 2.4 + 0.3, r = 0.22 + i * 0.15;
    for (let k = 0; k < 6; k++) { const [x, z] = polar(a + (k % 3) * 0.14, r + (k > 2 ? 0.09 : 0)); put(accentM, sit(new THREE.CylinderGeometry(0.03, 0.055, 0.05, 7).rotateX(Math.PI / 2).translate(0, 0, 0.02).scale(...Array(3).fill(0.8 + ((i + k) % 3) * 0.25)), x, z)); } }
  if (props.has('rope')) {
    // an old rope tangled over its back, and a small iron anchor caught in it, hanging off its right side
    const ropeM = M.mat('sbRope', P.rope ?? P.dark), ironM = M.mat('sbIron', P.iron ?? P.dark);
    const path = [[-0.28, 0.45], [0.05, 0.12], [0.35, -0.2], [0.62, -0.45]].map(([x, z]) => [x, top.at(x, z) + 0.025, z]);
    put(ropeM, tubeGeometry([...path, [0.8, 0.02, -0.56]], 0.028));
    put(ropeM, new THREE.TorusKnotGeometry(0.15, 0.026, 56, 6, 2, 5).rotateX(-1.2).rotateZ(0.5).translate(0.36, top.at(0.36, -0.25) + 0.05, -0.25));
    const at = new THREE.Matrix4().compose(V(0.86, -0.03, -0.6), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0.4, -0.35)), V(1, 1, 1));
    for (const a of [new THREE.TorusGeometry(0.035, 0.012, 5, 10).translate(0, 0.02, 0), new THREE.CylinderGeometry(0.018, 0.018, 0.35, 6).translate(0, -0.185, 0), new THREE.CylinderGeometry(0.014, 0.014, 0.16, 5).rotateZ(Math.PI / 2).translate(0, -0.07, 0), new THREE.TorusGeometry(0.11, 0.016, 5, 12, Math.PI).rotateZ(Math.PI).translate(0, -0.26, 0)]) put(ironM, a.applyMatrix4(at));
  }
  if (props.has('coral')) for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 0.24, z = cz + (i % 2 ? -0.2 : 0.15), y = top.at(x, z) - 0.02;
    put(accentM, tubeGeometry([[x, y, z], [x * 1.1, y + 0.26, z], [x * 1.25 + 0.05, y + 0.43, z - 0.04]], 0.035, 0.018)); put(accentM, tubeGeometry([[x * 1.05, y + 0.18, z], [x * 1.05 + 0.13, y + 0.32, z + 0.05]], 0.022, 0.012)); }
  if (props.has('facets')) for (let i = 0; i < 5; i++) { const [x, z] = polar(i * 1.26, 0.42); put(accentM, new THREE.OctahedronGeometry(0.1, 0).scale(1, 1.8, 1).translate(x, top.at(x, z) - 0.02, z)); }
  const group = pivot(body, 0, 0, 0, 'dress');
  let awning = null;
  if (props.has('awning')) {
    // a hermit's awning of patched cloth on four poles, over the shell: a stall on legs
    const crown = top.at(0, cz);
    awning = pivot(group, 0, crown - 0.12, cz, 'awning');
    const clothA = M.mat('sbCloth', P.cloth ?? P.accent, { side: THREE.DoubleSide }), clothB = M.mat('sbCloth2', P.cloth2 ?? P.claw, { side: THREE.DoubleSide });
    const poles = [], A = [], B = [];
    for (const [x, z] of [[-0.56, 0.62], [0.56, 0.62], [-0.56, -0.66], [0.56, -0.66]]) { const foot = top.at(x, z + cz) - (crown - 0.12); poles.push(new THREE.CylinderGeometry(0.022, 0.022, 0.32 - foot, 6).translate(x, (0.32 + foot) / 2, z)); }
    // (the roof a low gable of four strips, each falling to its side: seen from the ground it shows as a roof, not an edge)
    for (let i = 0; i < 4; i++) { const x = -0.45 + i * 0.3, s = Math.sign(x); (i % 2 ? A : B).push(new THREE.PlaneGeometry(0.32, 1.5).rotateX(-Math.PI / 2).rotateZ(-s * 0.3).translate(x, 0.4 - Math.abs(x) * 0.31, -0.02)); }
    for (const s of [-1, 1]) (s > 0 ? B : A).push(new THREE.PlaneGeometry(1.24, 0.18).rotateX(s * 0.25).translate(0, 0.2, s * 0.76));
    add(awning, merged(poles), inkM); add(awning, merged(A), clothA); add(awning, merged(B), clothB);
  }
  for (const [mat, geos] of kit) add(group, merged(geos), mat);
  return { group, awning };
}

// ---------------------------------------------------------------------------------------------- the body
/** The crab's body (the model contract of plans/index.js), from the loaded source (shellbackSource). */
export function tripoShellbackModel(skin, src) {
  const L = src.landmarks, home = skin.id === 'arzach2';
  const P = { ...skin.palette, ...(home ? { ...ROLES, eye: '#1e1d24' } : {}) }, props = new Set(home ? [] : skin.props);
  const M = materials('crab', skin);
  const bodyY = L.legs[0].hip[1];
  const g = new THREE.Group(), body = pivot(g, 0, bodyY, 0, 'shell'); g.name = `${skin.name} · shellback`;
  const B = (o) => new THREE.Vector3(o[0], o[1] - bodyY, o[2]);   // (a landmark in the body's frame)
  // ---------------------------------------------------------------- the kit's legs on the mesh's own, their segments hidden
  const hide = new THREE.MeshBasicMaterial({ visible: false });
  const legs = L.legs.map((l, k) => {
    const hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const along = ankle.clone().sub(hip), pole = knee.clone().sub(hip).addScaledVector(along, -knee.clone().sub(hip).dot(along) / along.lengthSq()).normalize();
    pole.y += 0.35; pole.normalize();   // (knees out and a little up: the walker's own)
    const leg = planLeg(PLANS.walker, { group: g, body, hip: B(l.hip), foot: { x: l.foot[0], z: l.foot[2] }, lenA: hip.distanceTo(knee), lenB: knee.distanceTo(ankle), pole, ankle: ankle.y, radius: 0.02, mats: { joint: hide }, name: `shellback leg ${k}` });
    const gone = []; leg.root.traverse((o) => { if (o.isMesh) gone.push(o); }); for (const o of gone) { o.geometry.dispose(); o.removeFromParent(); }
    return leg;
  });
  const rig = new Rig({ plan: PLANS.walker, group: g, body, legs });
  // ---------------------------------------------------------------- the bones: legs (group children, bend-plane framed), claws on the body
  const list = [body], index = (o) => { list.push(o); return list.length - 1; };
  const legBones = legs.map((leg, k) => {
    const l = L.legs[k], hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const mk = (name, at, dir) => { const b = new THREE.Bone(); b.name = `leg${k}_${name}`; b.position.copy(at); if (dir) bendFrame(dir, leg.pole, b.quaternion); g.add(b); return b; };
    const thigh = mk('thigh', hip, knee.clone().sub(hip)), shin = mk('shin', knee, ankle.clone().sub(knee)), foot = mk('foot', ankle.clone().setY(ankle.y - leg.ankle), null);
    return { thigh: index(thigh), shin: index(shin), foot: index(foot), objs: { [`leg${k}_thigh`]: thigh, [`leg${k}_shin`]: shin, [`leg${k}_foot`]: foot } };
  });
  // (a leg's foot, for the motion audit's walk, scripts/motion-audit/walk-procedural.mjs lowest: the skin's foot bone, where the
  // kit's leg plants it; the kit's own segments are empty here)
  legs.forEach((leg, k) => { const foot = legBones[k].objs[`leg${k}_foot`]; leg.root.lowest = (out) => foot.getWorldPosition(out); });
  // (each claw: the shoulder's ball against the face, the blade and the inner finger both hinged at the knuckle)
  const clawBones = L.claws.map((c) => {
    const shoulder = pivot(body, ...B(c.shoulder).toArray(), 'shoulder');
    const at = (q) => vec(q).sub(vec(c.shoulder)).toArray();
    const hand = pivot(shoulder, ...at(c.knuckle), 'claw'), finger = pivot(shoulder, ...at(c.knuckle), 'finger');
    const tip = pivot(hand, ...vec(c.tip).sub(vec(c.knuckle)).toArray());
    return { arm: index(shoulder), blade: index(hand), finger: index(finger), shoulder, hand, fingerBone: finger, tip };
  });
  // the face: a pivot behind it on the body, its look the gaze's (an inner group the gaze turns: the face bone)
  const faceRoot = pivot(body, ...B(FACE.pivot).toArray(), 'face');
  const faceGaze = gazePart(g, faceRoot, { mode: 'turn', yaw: FACE.yaw, up: FACE.up, down: FACE.down });
  const faceBone = index(faceGaze.node);
  // the rest pose (the bind's): the kit's segments at the landmarks, so SkinLegs measures its offsets there
  legs.forEach((leg, k) => { const l = L.legs[k]; leg.root.position.copy(vec(l.hip)); leg.shin.position.copy(vec(l.knee).sub(vec(l.hip))); leg.foot.position.copy(vec(l.ankle).sub(vec(l.hip))).setY(l.ankle[1] - leg.ankle - l.hip[1]); });
  const skinLegs = new SkinLegs({ kit: { legs, rig }, bones: Object.assign({}, ...legBones.map((x) => x.objs)), group: g, body });
  // ---------------------------------------------------------------- the meshes
  const prep = prepare(src, { body: 0, face: faceBone, leg: legBones, claw: clawBones });
  const geo = src.geometry, textured = home && !!src.map;
  // (the home skin's own colours: the texture's, or where no picture is drawn (the engines) its vertex colours, the same five)
  const colour = textured ? null : skinColours(geo, prep, P);
  const attrs = { position: geo.attributes.position, normal: geo.attributes.normal, uv: geo.attributes.uv, ...(colour ? { color: colour } : {}) };
  // (both sides drawn: Tripo's lip is an open sheet, its inside showed as holes under the rim)
  const skinM = M.mat(textured ? 'sbTripo' : 'sbTripoTint', '#ffffff', { side: THREE.DoubleSide, ...(textured ? { map: src.map } : { vertexColors: true }) });
  // (the dome one colour, its edge the cut's own line, painted with its skin's shell surface: the home skin's a soft
  // mottle, the direct body's, src/enemies/surfaces.js)
  const domeM = M.mat('shell', P.shell, { side: THREE.DoubleSide });
  const restGeo = subset(geo, prep.restTris, { ...attrs, skinIndex: new THREE.BufferAttribute(prep.SI, 4), skinWeight: new THREE.BufferAttribute(prep.SW, 4) });
  const sm = new THREE.SkinnedMesh(restGeo, skinM); sm.name = 'shellback skin'; sm.frustumCulled = false; g.add(sm);
  // the dome: on the body (in its frame), its own mesh; its two front scutes copied off it, a little proud, the armour
  const domeGeo = subset(geo, prep.domeTris, { position: attrs.position, normal: attrs.normal, uv: attrs.uv }).toNonIndexed(); domeGeo.translate(0, -bodyY, 0);
  const shell = add(body, domeGeo, domeM); shell.name = 'dome';
  // (they wear the dome's own material: unseen as plates until one is knocked off)
  const DP = domeGeo.attributes.position, DN = domeGeo.attributes.normal, DU = domeGeo.attributes.uv;
  let front = -Infinity; for (let i = 0; i < DP.count; i++) front = Math.max(front, DP.getZ(i));
  const plates = [1, -1].map((s) => {
    const pos = [], nor = [], uv = [];
    for (let t = 0; t < DP.count; t += 3) {
      let ok = true; for (let k = 0; k < 3; k++) { const x = DP.getX(t + k), y = DP.getY(t + k), z = DP.getZ(t + k), a = Math.atan2(x, z); if (!(s * a > 0.08 && s * a < 1.45 && y > 0.32 && y < 0.62 && z > front - 0.9)) ok = false; }
      if (!ok) continue;
      for (let k = 0; k < 3; k++) { const j = t + k; pos.push(DP.getX(j) + DN.getX(j) * 0.006, DP.getY(j) + DN.getY(j) * 0.006, DP.getZ(j) + DN.getZ(j) * 0.006); nor.push(DN.getX(j), DN.getY(j), DN.getZ(j)); uv.push(DU.getX(j), DU.getY(j)); }
    }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return plate(body, pg, domeM, 0, 0, 0, `scute ${s > 0 ? 'left' : 'right'}`);
  });
  const meat = add(body, new THREE.SphereGeometry(0.66, 12, 6).scale(1, 0.34, 1.1), M.mat('meat', '#e08a70'), 0, 0.2, -0.2); meat.visible = false;
  // a skin's dress over the dome (merged a material; it comes off with the dome)
  const worn = dress(body, props, P, M, prep.top);
  // the eyes where the painted ones were (prepare.mjs painted those out): two upright slits of their size, a little
  // proud of the face along its own normal there, on the face bone; the gaze slides them on toward him (their own
  // material, they glow as it winds up)
  const eyeM = M.own('eye', P.eye, { glow: 0.35 });
  const F0 = vec(FACE.pivot), eyeGeo = L.eyes.filter(Boolean).map((e) => {
    const at = vec(e.at), nrm = faceNormal(geo, at), [w, h] = e.size ?? [0.03, 0.09];
    const r = Math.max(0.012, w * 0.55), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
    return new THREE.CapsuleGeometry(r, Math.max(0.02, h - 2 * r), 3, 8).scale(1, 1, 0.45).applyQuaternion(q).translate(...at.addScaledVector(nrm, 0.012).sub(F0).toArray());
  });
  // (the mesh's origin between the two: the face's turn carries it, so its matrix moves as the eyes do, the engines' mirror's)
  const eyesGeo = merged(eyeGeo); eyesGeo.computeBoundingBox(); const mid = eyesGeo.boundingBox.getCenter(new THREE.Vector3()); eyesGeo.translate(-mid.x, -mid.y, -mid.z);
  const eyes = add(faceGaze.node, eyesGeo, eyeM, mid.x, mid.y, mid.z); eyes.name = 'eyes';
  const gaze = [faceGaze, gazePart(g, eyes, { mode: 'slide', slide: 0.035 })];
  const shellTop = pivot(body, 0, L.crown - bodyY + 0.05, -0.2);
  finish(g);
  g.updateMatrixWorld(true);
  sm.bind(new THREE.Skeleton(list));
  boneBoxes(sm, list, prep);
  const parts = [shell, ...plates, worn.group, ...clawBones.map((c) => c.shoulder), ...legs.map((l) => l.root)];
  let side = 0, sink = 0, spin = 0, flip = 0, clampK = 0;
  return {
    group: g, body, rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.shell, P.leg, P.claw], gaze, plates,
    shellback: 'tripo',
    tell: (id) => (id === 'snap' ? clawBones[1].tip : id === 'burrow' ? eyes : shellTop),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      // (going down, issue #767: on its belly; one already on its back stays there)
      const flipped = f.dying ? (f.dying.onBack ??= flip > Math.PI / 2) : f.flipped > 0;
      // (its guard, issue #661: clamped down in its dome, legs drawn under, the pincers folded over its face)
      clampK = ease(clampK, f.guardK ?? 0, 12, dt);
      const tuck = Math.max(id === 'spin' ? (wind ? c.wind : strike ? 1 : 0) : 0, clampK);
      // sideways: it scuttles side-on in bursts, turns to face you to strike
      const scuttle = c.moving && f.state === 'chase' && f.dist > 3 ? 1 : 0;
      side = ease(side, scuttle * (f.home.x > 0 ? 1 : -1) * Math.PI / 2, 7, dt);
      g.rotation.y = f.heading + side;
      const buried = id === 'burrow' && wind ? c.wind : 0;
      sink = ease(sink, buried, buried > sink ? 6 : 10, dt);
      const o = rig.update({ pos: f.pos, heading: f.heading + side, state: f.state, k: f.k, atk: f.atk, stunned: f.stunned }, dt,
        { eye: c.eye, ground: c.ground, touch: c.touch, recovery: c.recovery, air: flipped ? 1 : tuck > 0.02 ? 1 + tuck : sink > 0.05 ? 1 + sink * 0.6 : 0 });
      legs.forEach((l, k) => { l.air.set(0, flipped ? Math.sin(c.now / 60 + k) * 0.2 : 0, flipped ? Math.cos(c.now / 75 + k) * 0.14 : 0); });
      // the snap: the near (right) pincer rears up and forward, the jaw opening; then it chops down, shut
      const snap = id === 'snap' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0;
      const chop = strike && id === 'snap' ? Math.sin(Math.min(1, c.release) * Math.PI) : 0;
      const limp = f.dying ? THREE.MathUtils.smoothstep(f.dying.u, 0.05, 0.45) : 0;
      clawBones.forEach((cl, i) => {
        const near = i === 1 ? snap : snap * 0.25, s = i ? -1 : 1;
        // (the jaw: open at the top of the wind, the blade forward and the inner finger back; slammed shut in the chop)
        const open = near * (1 - chop) + (f.state === 'idle' ? Math.max(0, Math.sin(c.now / 420 + i * 2)) * 0.15 : 0);
        cl.shoulder.rotation.set(-near * 0.8 + chop * 0.35 - tuck * 0.3 + limp * 0.45, s * tuck * 0.45, -s * tuck * 0.2);
        cl.hand.rotation.set(-open * 0.5 + chop * 0.3 + tuck * 0.5 - limp * 0.35, 0, 0);
        cl.fingerBone.rotation.set(open * 0.6 - chop * 0.3 + tuck * 0.2, 0, 0);
      });
      // the spin: tucked, rocking, then turning as a top
      const rock = id === 'spin' && wind ? Math.sin(c.now / 70) * 0.08 * c.wind : 0;
      spin += dt * (strike && id === 'spin' ? 26 : tuck > 0 ? tuck * 4 : 0);
      flip = ease(flip, flipped ? Math.PI : 0, 12, dt);
      body.position.set(o.x, bodyY - tuck * 0.24 - clampK * 0.12 - sink * 0.6 + o.y, o.z);
      body.rotation.set(o.pitch - (id === 'spin' && wind ? 0.3 * c.wind : 0) + rock, tuck > 0.5 && strike ? spin : o.yaw, flip + o.roll);
      if (worn.awning) worn.awning.rotation.z = Math.sin(c.now / 260) * 0.03 * (c.moving ? 1 : 0.3);
      rig.write();
      skinLegs.write(f.heading + side, { air: flipped || tuck > 0.02 ? 1 : 0 });
      // cracked: the dress and the dome come off, the soft back shows
      worn.group.visible = f.shelled; shell.visible = f.shelled; meat.visible = !f.shelled;
      for (const x of plates) if (!f.shelled) x.visible = false;
      if ((tuck > 0.5 && strike) || (buried > 0.3 && Math.random() < 0.5)) c.dust(f.pos, P.leg, 2);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye));
    },
    dispose() { M.dispose(); hide.dispose(); restGeo.dispose(); domeGeo.dispose(); for (const x of plates) x.geometry.dispose(); },
  };
}

/** The surface's normal near `at` (the source geometry's vertices within 5 cm, averaged), pointing ahead. */
function faceNormal(geo, at) {
  const P = geo.attributes.position, N = geo.attributes.normal, n = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) if (v.fromBufferAttribute(P, i).distanceTo(at) < 0.05) n.add(v.fromBufferAttribute(N, i));
  if (n.z <= 0) n.set(0, 0, 1);
  return n.normalize();
}

/** Each bone's box of the vertices it carries most (the body the blade meets, src/foe-body.js; a gallery's frame), as kit.js skinned. */
function boneBoxes(sm, bones, prep) {
  const local = bones.map(() => new THREE.Box3()), pos = sm.geometry.attributes.position, idx = sm.geometry.index.array, v = new THREE.Vector3(), seen = new Uint8Array(pos.count);
  sm.updateMatrixWorld(true);
  for (const i of idx) { if (seen[i]) continue; seen[i] = 1; const b = prep.SI[i * 4]; local[b].expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(sm.matrixWorld).applyMatrix4(sm.skeleton.boneInverses[b])); }
  sm.userData.boneBoxes = { bones, local };
  const box = new THREE.Box3(), sphere = new THREE.Sphere(), back = new THREE.Matrix4(), corner = new THREE.Vector3();
  const bounds = () => { sm.updateWorldMatrix(true, false); back.copy(sm.matrixWorld).invert(); box.makeEmpty();
    bones.forEach((b, i) => { const Lb = local[i]; if (Lb.isEmpty()) return; b.updateWorldMatrix(true, false); for (let k = 0; k < 8; k++) box.expandByPoint(corner.set(k & 1 ? Lb.max.x : Lb.min.x, k & 2 ? Lb.max.y : Lb.min.y, k & 4 ? Lb.max.z : Lb.min.z).applyMatrix4(b.matrixWorld).applyMatrix4(back)); });
    return box; };
  let at = -1;
  Object.defineProperty(sm, 'boundingBox', { configurable: true, get: bounds, set() {} });
  Object.defineProperty(sm, 'boundingSphere', { configurable: true, get: () => { if (RENDER_FRAME.on && at === RENDER_FRAME.n) return sphere; at = RENDER_FRAME.on ? RENDER_FRAME.n : -1; return bounds().getBoundingSphere(sphere); }, set() {} });
}
