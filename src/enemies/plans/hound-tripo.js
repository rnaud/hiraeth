import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, merged, pivot, pair, ease, eyeColor, finish } from './kit.js';
import { broadHoundModel } from './broad-hound.js';
import { gazePart } from '../gaze.js';
import { SkinLegs, bendFrame } from '../../characters/creature-legs.js';
import { RENDER_FRAME } from '../../render-frame.js';

// The game's hound (archetype `hound`, issue #800): the broad-pawed hound from Tripo, the author's pick of the trial
// (references/enemy-redesign-2026-10-30/trials/, the hound sections). Tripo task 09f5de9e-… from the approved image,
// rigged by Tripo's quadruped rig (66154a67-…), made into an asset by the trial's prepare.mjs (the game's frame and
// size, a flat texture of seven colours, vertex colours, 12k triangles, Tripo's weights gathered onto the game's bones,
// a little more leg, Tripo's small horns taken off) and shipped by scripts/tripo/ship-hound.mjs:
// public/enemies/hound/body.glb (16-bit indices, the texture 512², the landmarks in the mesh's extras), as the shellback's.
//
// It loads as the shellback's does (plans/shellback-tripo.js): a browser fetches it (loadHoundBody, asked for with the
// load's early assets and awaited before the foes are made: main.js, the gallery); the engines and Node read it at once
// on the first hound built (no texture: its vertex colours). Until it is in, or if it can't be, the hound is the direct
// broad-pawed body (plans/broad-hound.js broadHoundModel), the same
// parts and colours built in code. Both are the hound in everything but the body: the same archetype, def (pounce,
// step behind, bite, rake; reach, windows, `phase`), sounds, death recipe, lying body.
//
// On the hound's rig family: the motion kit's quadruped plan, a trot on diagonal pairs, its legs fitted to the rig's own
// joints. Not Tripo's skeleton (54 joints, its left hind leg twice over): the game's bones carry Tripo's weights. Each
// leg's thigh, shin and foot are bones framed in the leg's bend plane (src/characters/creature-legs.js SkinLegs: the
// kit's own segments solve, the bones follow); the body, neck, head and four tail joints are pivots on the kit's body.
// Its eyes look at you (issue #508): the head turns toward the traveller (gaze.js 'turn': the bone the head's vertices
// hang on is the gaze's own node), and two slit eyes of their own (orange as it winds up) sit over the painted ones.
// Its shadow form: lying in wait, stepping behind you or phased it is a pool with its head and horns rising out of it.
// Tripo fused the jaw: the bite and the snarl are the head's.
//
// The horns are the reference's big ram's horns, swept here from the landmarks' roots into the same skinned mesh on
// the head's bone (no extra draw): bleached thicker in the Mangrove, a tangle of wire in the Market. A world's props
// are fitted to this body: the Mangrove's ink drips hang off its chin, neck, chest and belly, in the skin on their
// bones; the Garden of Spheres' gold glints run along the horns and its halo rests over them, on the head's gaze bone.
//
// Draws standing: the skin and the eyes (2), the Garden of Spheres' glints and halo (4). In the engines (no picture
// decoded: engine/boot.js COLOURED_PICTURES) its home skin is drawn by the asset's own vertex colours, as the others.

/** The load's deadline (ms): past it the foes are made with the direct body (tests/load-awaits.test.js). */
export const LOAD_DEADLINE = 30000;
/** The shipped body, under public/. */
export const HOUND_BODY = 'enemies/hound/body.glb';

const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
/**
 * The shipped GLB (scripts/tripo/ship-hound.mjs: one mesh, plain accessors) read at once, without three's loader:
 * { geometry (position, normal, uv, color: COLOR_0's bytes, normalised; skinIndex, skinWeight), landmarks,
 *   image: { bytes, mime } | null, map: null }.
 */
export function parseHound(bytes) {
  // (a plain Uint8Array view: a Node Buffer's slice shares its memory, and its pool's offset)
  const u8 = ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : new Uint8Array(bytes);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const jn = dv.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jn))), bin = 28 + jn;
  const view = (i) => { const v = json.bufferViews[i]; return u8.slice(bin + (v.byteOffset ?? 0), bin + (v.byteOffset ?? 0) + v.byteLength); };   // (a copy: aligned)
  const acc = (i) => { const a = json.accessors[i], b = view(a.bufferView), A = TY[a.componentType];
    return new THREE.BufferAttribute(new A(b.buffer, a.byteOffset ?? 0, a.count * CO[a.type]), CO[a.type], !!a.normalized); };
  const mesh = json.meshes[0], p = mesh.primitives[0], g = new THREE.BufferGeometry();
  for (const [k, name] of [['POSITION', 'position'], ['NORMAL', 'normal'], ['TEXCOORD_0', 'uv'], ['COLOR_0', 'color'], ['JOINTS_0', 'skinIndex'], ['WEIGHTS_0', 'skinWeight']]) g.setAttribute(name, acc(p.attributes[k]));
  g.setIndex(acc(p.indices));
  const im = json.images?.[0];
  return { geometry: g, landmarks: mesh.extras.landmarks, triangles: mesh.extras.triangles, texture: mesh.extras.texture, bytes: u8.byteLength,
    image: im ? { bytes: view(im.bufferView), mime: im.mimeType } : null, map: null };
}

let source = null, pending = null, tried = false;
/** The body's bytes where they can be read at once: the engines' host (public/), Node's files (tests, tools); else null (a browser). */
function readNow() {
  try {
    const host = globalThis.__HIRAETH_HOST__;
    if (host?.readFile) return host.readFile(HOUND_BODY) ?? null;
    const fs = globalThis.process?.getBuiltinModule?.('node:fs');
    if (fs) return fs.readFileSync(new URL(`../../../public/${HOUND_BODY}`, import.meta.url));
  } catch (e) { /* not there: the direct body stands in */ }
  return null;
}
/** The loaded body (null until loaded; the engines and Node read it on first use). */
export function houndSource() {
  if (!source && !tried) { tried = true; const b = readNow(); if (b) source = parseHound(b); }
  return source;
}
/**
 * The body, loaded once (a browser: fetched, its texture decoded; the engines and Node: read at once, no texture). The
 * game awaits it before it builds its foes (src/main.js); a failed load leaves the direct hound standing in.
 */
export function loadHoundBody(base = import.meta.env?.BASE_URL ?? '/') {
  if (houndSource()) return Promise.resolve(source);
  if (typeof fetch !== 'function') return Promise.resolve(null);
  // (a deadline, as the load's other assets have: a fetch that never answers leaves the direct body standing in)
  let timer = null;
  const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve(null), LOAD_DEADLINE); });
  return pending ??= Promise.race([deadline, (async () => {
    const r = await fetch(`${base}${HOUND_BODY}`);
    if (!r.ok || /text\/html/.test(r.headers.get('content-type') ?? '')) throw new Error(`no ${HOUND_BODY} (${r.status})`);
    const src = parseHound(await r.arrayBuffer());
    if (src.image && typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(new Blob([src.image.bytes], { type: src.image.mime }), { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      // (its texels are the printed colours the G-buffer takes; glTF's UVs: not flipped)
      const map = new THREE.Texture(bmp); map.colorSpace = THREE.NoColorSpace; map.flipY = false; map.needsUpdate = true;
      src.map = map;
    }
    return (source = src);
  })()]).then((src) => { clearTimeout(timer); if (!src) { pending = null; console.warn('the hound body did not load in time: the direct hound stands in'); } return src; },
    (e) => { clearTimeout(timer); pending = null; console.warn('the hound body did not load: the direct hound stands in', e); return null; });
}
/** Stand a source in (the trial page's, a test's), null to forget it (the next build reads it again), false for none (the direct body). */
export function setHoundSource(src) { source = src || null; tried = src !== null; pending = null; }

/** The game's hound in a world's skin (plans/index.js): the Tripo body, or the direct broad-pawed hound where it is not loaded. */
export function houndModel(skin) {
  const src = houndSource();
  if (src) return tripoHoundModel(skin, src);
  const M = broadHoundModel(skin); delete M.trial; M.body3d = 'direct'; M.group.name = skin.name;   // (the game's fallback, not the trial's)
  return M;
}

/** The flat texture's colour roles: the coat's shades, the mauve saddle, the cream horns and muzzle. */
const ROLE = (c) => (c.r + c.g + c.b > 2 ? 'cream' : c.r > 0.35 ? 'patch' : 'coat');

/**
 * A skin's colours over the mesh's roles (a world's own look on the same body): COLOR_0 recoloured, its shades kept;
 * the muzzle (the mesh's own cream) in the skin's muzzle colour, the horns (added, after the mesh's vertices) in its
 * antler colour. Cached on the dressed geometry, a skin.
 */
function skinColours(geo, P, palette, key) {
  geo.userData.colours ??= new Map();
  if (geo.userData.colours.has(key)) return geo.userData.colours.get(key);
  const C = geo.attributes.color, n = C.count, n0 = n - (geo.userData.added ?? 0), out = new Float32Array(n * 3), c = new THREE.Color();
  const coats = palette.map((h) => new THREE.Color(h)).filter((x) => ROLE(x) === 'coat'), mid = coats[Math.floor(coats.length / 2)];
  const lum = (x) => x.r + x.g + x.b, ink = new THREE.Color(P.ink), t = new THREE.Color();
  const want = { muzzle: new THREE.Color(P.muzzle ?? P.antler), horn: new THREE.Color(P.antler), patch: new THREE.Color(P.patch) };
  for (let i = 0; i < n; i++) {
    c.setRGB(C.getX(i), C.getY(i), C.getZ(i));
    const role = ROLE(c);
    if (role === 'coat') t.copy(ink).multiplyScalar(Math.min(1.6, lum(c) / Math.max(1e-3, lum(mid))));
    else t.copy(role === 'patch' ? want.patch : i < n0 ? want.muzzle : want.horn);
    out[i * 3] = t.r; out[i * 3 + 1] = t.g; out[i * 3 + 2] = t.b;
  }
  const a = new THREE.BufferAttribute(out, 3);
  geo.userData.colours.set(key, a);
  return a;
}

const vec = (a) => new THREE.Vector3(...a);

/** A ram's horn on side s, from its root (offsets in the mesh frame, m, × k): up and back over the ear, round and down
 * behind it, the tip turning forward beneath (the reference's cream crescents, a C open to the front). */
export function hornPath(s, k = 1) {
  return [[-0.03, -0.02, 0.01], [0.04, 0.08, -0.03], [0.095, 0.135, -0.12], [0.125, 0.105, -0.21], [0.14, 0.01, -0.245], [0.15, -0.08, -0.2], [0.145, -0.12, -0.12], [0.13, -0.11, -0.05]]
    .map(([x, y, z]) => [s * x * k, y * k, z * k]);
}
/** A smooth tube swept along points, its radius radius(t) (t 0 at the first point, 1 at the last), the root capped. */
function sweep(points, radius, radial = 10, steps = 28) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => vec(p))), F = curve.computeFrenetFrames(steps, false);
  const pos = [], nor = [], idx = [], n = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const c = curve.getPointAt(i / steps), r = radius(i / steps);
    for (let j = 0; j < radial; j++) { const a = (j / radial) * Math.PI * 2; n.copy(F.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(F.binormals[i], Math.sin(a)); pos.push(c.x + n.x * r, c.y + n.y * r, c.z + n.z * r); nor.push(n.x, n.y, n.z); }
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < radial; j++) { const a = i * radial + j, b = i * radial + ((j + 1) % radial); idx.push(a, b, a + radial, b, b + radial, a + radial); }
  const c0 = curve.getPointAt(0), t0 = F.tangents[0], ci = pos.length / 3; pos.push(c0.x, c0.y, c0.z); nor.push(-t0.x, -t0.y, -t0.z);
  for (let j = 0; j < radial; j++) idx.push(ci, (j + 1) % radial, j);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}
/** The horns' size (× hornPath), root radius (thicker bleached) and tip radius. */
export const HORN = { k: 0.98, r: 0.054, bleached: 0.064, tip: 0.008 };
/** A skin's horns from roots [{ side, at }] (× k: the shadow form's smaller pair), as geometries: a world's own (bleached, wire). */
function hornShapes(roots, props, k = HORN.k) {
  const out = [], q = k / HORN.k;
  for (const h of roots) {
    const pts = hornPath(h.side, k).map(([x, y, z]) => [x + h.at[0], y + h.at[1], z + h.at[2]]);
    if (props.has('wire')) { for (let i = 0; i < 4; i++) out.push(sweep(pts.map(([x, y, z], j) => [x + h.side * (i - 1) * 0.014 * q, y + Math.sin(j * 1.7 + i * 1.3) * 0.022 * q, z + Math.cos(j * 1.3 + i) * 0.014 * q]), () => 0.016 * q, 6, 24)); continue; }
    const r0 = (props.has('bleached') ? HORN.bleached : HORN.r) * q;
    // (a crescent: full through its first third, swelling a little in the middle, then tapering to the tip)
    out.push(sweep(pts, (t) => THREE.MathUtils.lerp(r0, HORN.tip * q, THREE.MathUtils.smoothstep(t, 0.3, 1)) * (1 + 0.22 * Math.sin(Math.PI * t))));
  }
  return out;
}
/** The Mangrove's ink drips: [x, z, bone, length] under the chin, the neck, the chest and the belly. */
const DRIPS = [[0, 1.1, 'head', 0.12], [0.07, 0.8, 'neck', 0.15], [-0.07, 0.86, 'neck', 0.11], [0.12, 0.45, 'body', 0.2], [-0.1, 0.33, 'body', 0.16], [0.1, 0.05, 'body', 0.18], [-0.09, -0.12, 'body', 0.14], [0.08, -0.3, 'body', 0.12]];
/** The dressed geometry's key: a skin's horns and drips. */
const dressKey = (props) => `${props.has('wire') ? 'wire' : props.has('bleached') ? 'bleached' : 'horn'}${props.has('drips') ? '+drips' : ''}`;
/**
 * The source's skin dressed for a skin's props (cached on the source, a geometry a props set): the mesh with the horns
 * (on the head's bone, the cream's colour and texel) and the drips (on their bones, the darkest coat's) added.
 */
function dressed(src, props) {
  const key = dressKey(props);
  src.dressed ??= new Map();
  if (src.dressed.has(key)) return src.dressed.get(key);
  const L = src.landmarks, geo = src.geometry, bone = (n) => L.bones.indexOf(n);
  const cream = new THREE.Color(L.palette[L.palette.length - 1]), coat = new THREE.Color(L.palette[0]);
  // (each part: its geometry, its joints and weights, its colour and texel)
  const parts = hornShapes(L.hornRoot, props).map((g) => [g, { j: [bone('head'), 0, 0, 0], w: [1, 0, 0, 0] }, cream, L.creamUV]);
  const A = geo.attributes;
  if (props.has('drips')) {
    const P = A.position, N = A.normal, SI = A.skinIndex, SW = A.skinWeight;
    for (const [x, z, b, len] of DRIPS) {
      // (hung from the underside there: the lowest downward-facing vertex of that part within 4 cm (the body's or a
      // thigh's under the trunk), the drop on that vertex's own weights, so it moves as the skin it hangs from)
      const ok = new Set(b === 'body' ? ['body', ...[0, 1, 2, 3].map((k) => `leg${k}_thigh`)].map(bone) : [bone(b)]);
      let a = -1; for (let i = 0; i < P.count; i++) if (ok.has(SI.getX(i)) && N.getY(i) < -0.4 && Math.abs(P.getX(i) - x) < 0.04 && Math.abs(P.getZ(i) - z) < 0.04 && (a < 0 || P.getY(i) < P.getY(a))) a = i;
      if (a < 0) continue;
      const w = { j: [SI.getX(a), SI.getY(a), SI.getZ(a), SI.getW(a)], w: [SW.getX(a), SW.getY(a), SW.getZ(a), SW.getW(a)] };
      parts.push([new THREE.ConeGeometry(0.022, len, 6).rotateX(Math.PI).translate(P.getX(a), P.getY(a) - len / 2 + 0.012, P.getZ(a)), w, coat, L.coatUV]);
    }
  }
  const n0 = A.position.count, n = n0 + parts.reduce((s, [g]) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n0; i++) {
    pos[i * 3] = A.position.getX(i); pos[i * 3 + 1] = A.position.getY(i); pos[i * 3 + 2] = A.position.getZ(i);
    nor[i * 3] = A.normal.getX(i); nor[i * 3 + 1] = A.normal.getY(i); nor[i * 3 + 2] = A.normal.getZ(i);
    uv[i * 2] = A.uv.getX(i); uv[i * 2 + 1] = A.uv.getY(i);
    col[i * 3] = A.color.getX(i); col[i * 3 + 1] = A.color.getY(i); col[i * 3 + 2] = A.color.getZ(i);
    for (let k = 0; k < 4; k++) { si[i * 4 + k] = A.skinIndex.getComponent(i, k); sw[i * 4 + k] = A.skinWeight.getComponent(i, k); }
  }
  const index = Array.from(geo.index.array);
  let at = n0;
  for (const [g, b, c, t] of parts) {
    const gp = g.attributes.position, gn = g.attributes.normal;
    for (let i = 0; i < gp.count; i++) { const v = at + i; pos.set([gp.getX(i), gp.getY(i), gp.getZ(i)], v * 3); nor.set([gn.getX(i), gn.getY(i), gn.getZ(i)], v * 3); uv.set(t, v * 2); col.set([c.r, c.g, c.b], v * 3); si.set(b.j, v * 4); sw.set(b.w, v * 4); }
    if (g.index) for (const i of g.index.array) index.push(at + i); else for (let i = 0; i < gp.count; i++) index.push(at + i);
    at += gp.count; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); out.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  out.setIndex(new THREE.Uint32BufferAttribute(Uint32Array.from(index), 1));
  out.userData.added = n - n0;
  src.dressed.set(key, out);
  return out;
}

/**
 * The Tripo hound in a skin (the model contract of plans/index.js), from a loaded source (houndSource, or by hand: the
 * trial's 1024² asset).
 */
export function tripoHoundModel(skin, src) {
  const L = src.landmarks, home = skin.id === 'eclipse', props = new Set(skin.props);
  const P = { ...skin.palette, ...(home ? { eye: '#f2e8c8' } : {}) };
  P.patch ??= P.smoke2 ?? P.smoke;
  const M = materials('hound', skin);
  // (its ink drawn with a white contour on every world but the Garden of Spheres', a pale world: black on it)
  const white = !props.has('glints');
  const g = new THREE.Group(), body = pivot(g, 0, 0, 0, 'body'); g.name = skin.name;
  // ---------------------------------------------------------------- the kit's legs on the rig's own, their segments hidden
  const hide = new THREE.MeshBasicMaterial({ visible: false });
  const plan = PLANS.quadruped;
  const legs = L.legs.map((l, k) => {
    const hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const along = ankle.clone().sub(hip), pole = knee.clone().sub(hip).addScaledVector(along, -knee.clone().sub(hip).dot(along) / along.lengthSq()).normalize();
    // (the feet's homes made even, left and right: the mesh stands mid-stride)
    const pair2 = L.legs.find((m) => m.front === l.front && m !== l), fx = (Math.abs(l.foot[0]) + Math.abs(pair2.foot[0])) / 2 * l.side, fz = (l.foot[2] + pair2.foot[2]) / 2;
    const leg = planLeg(plan, { group: g, body, hip: vec(l.hip), foot: { x: fx, z: fz }, lenA: hip.distanceTo(knee), lenB: knee.distanceTo(ankle), pole, ankle: ankle.y, radius: 0.02, mats: { joint: hide }, name: `hound leg ${k}` });
    const gone = []; leg.root.traverse((o) => { if (o.isMesh) gone.push(o); }); for (const o of gone) { o.geometry.dispose(); o.removeFromParent(); }
    return leg;
  });
  const rig = new Rig({ plan, group: g, body, legs });
  // ---------------------------------------------------------------- the bones (prepare.mjs's BONES order)
  const bones = {};
  bones.body = body;
  const neck = bones.neck = pivot(body, ...L.neck, 'neck');
  const headPivot = pivot(neck, ...vec(L.headBase).sub(vec(L.neck)).toArray(), 'head');
  // (its look: the head turns toward the traveller; the bone the head's vertices hang on is the gaze's own node)
  const headGaze = gazePart(g, headPivot, { mode: 'turn', yaw: 0.55, up: 0.3, down: 0.35 });
  bones.head = headGaze.node;
  let parent = body, prev = [0, 0, 0];
  L.tail.slice(0, 4).forEach((t, i) => { const b = pivot(parent, ...vec(t).sub(vec(prev)).toArray(), `tail ${i}`); bones[`tail${i}`] = b; parent = b; prev = t; });
  const legBones = legs.map((leg, k) => {
    const l = L.legs[k], hip = vec(l.hip), knee = vec(l.knee), ankle = vec(l.ankle);
    const mk = (name, at, dir) => { const b = new THREE.Bone(); b.name = `leg${k}_${name}`; b.position.copy(at); if (dir) bendFrame(dir, leg.pole, b.quaternion); g.add(b); bones[b.name] = b; return b; };
    return { thigh: mk('thigh', hip, knee.clone().sub(hip)), shin: mk('shin', knee, ankle.clone().sub(knee)), foot: mk('foot', ankle.clone().setY(ankle.y - leg.ankle), null) };
  });
  // the rest pose (the bind's): the kit's segments at the landmarks, so SkinLegs measures its offsets there
  legs.forEach((leg, k) => { const l = L.legs[k]; leg.root.position.copy(vec(l.hip)); leg.shin.position.copy(vec(l.knee).sub(vec(l.hip))); leg.foot.position.copy(vec(l.ankle).sub(vec(l.hip))).setY(l.ankle[1] - leg.ankle - l.hip[1]); });
  const skinLegs = new SkinLegs({ kit: { legs, rig }, bones: Object.fromEntries(legBones.flatMap((b, k) => [[`leg${k}_thigh`, b.thigh], [`leg${k}_shin`, b.shin], [`leg${k}_foot`, b.foot]])), group: g, body });
  const list = L.bones.map((n) => bones[n]);
  // ---------------------------------------------------------------- the skin
  // (the mesh, its horns and its world's drips: dressed() once a props set; a skin's own colours over its roles; the
  // home skin by its texture, or by the asset's own vertex colours where no picture is decoded: the engines)
  const geo = dressed(src, props);
  const textured = home && !!src.map;
  const colour = home ? null : skinColours(geo, P, L.palette, skin.key ?? skin.id);
  const restGeo = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) restGeo.setAttribute(k, geo.attributes[k]);
  restGeo.setAttribute('color', colour ?? geo.attributes.color);
  restGeo.setIndex(geo.index);
  const skinM = M.mat(textured ? 'bhTripo' : 'bhTripoTint', '#ffffff', { lineWhite: white, ...(textured ? { map: src.map } : { vertexColors: true }) });
  const sm = new THREE.SkinnedMesh(restGeo, skinM); sm.name = 'hound skin'; sm.frustumCulled = false; g.add(sm);
  // the eyes over the painted ones: two pale slits on the head's gaze bone (its own material, they glow as it winds up)
  const eyeM = M.own('eye', P.eye, { glow: 0.85 });
  const hb = vec(L.headBase);
  const eyeGeo = merged(L.eyes.filter(Boolean).map((e) => new THREE.CapsuleGeometry(0.016, 0.04, 3, 8).rotateZ(Math.PI / 2 - e.side * 0.35).scale(1, 1, 0.5).translate(...vec(e.at).sub(hb).add(new THREE.Vector3(0, 0, 0.012)).toArray())));
  const eyes = add(headGaze.node, eyeGeo, eyeM); eyes.name = 'eyes';
  // (the rake's glow on the horns' crown)
  const root = vec(L.hornRoot[0].at).add(vec(L.hornRoot[1].at)).multiplyScalar(0.5), crown = root.clone().add(new THREE.Vector3(0, 0.13 * HORN.k, -0.15 * HORN.k));
  const hornTip = pivot(headGaze.node, ...crown.clone().sub(hb).toArray());
  // the Garden of Spheres: gold glints along the horns and a pearl-and-gold halo over them, on the head's gaze bone
  const glintM = props.has('glints') ? M.own('glint', P.glow, { glow: 0.9 }) : null;
  const propGeos = [];
  if (glintM) {
    const gg = merged(L.hornRoot.flatMap((h) => hornPath(h.side, HORN.k).slice(1, 7).map(([x, y, z], i) => new THREE.SphereGeometry(0.013, 6, 4).translate(x + h.at[0] - hb.x + h.side * (HORN.r * (1 - i / 7) + 0.006), y + h.at[1] - hb.y, z + h.at[2] - hb.z))));
    propGeos.push(gg); add(headGaze.node, gg, glintM).name = 'glints';
  }
  if (props.has('halo')) {
    const h = pivot(headGaze.node, 0, crown.y - hb.y + 0.05, crown.z - hb.z + 0.04, 'halo'); h.rotation.set(-0.12, 0, 0.06);
    const hg = new THREE.TorusGeometry(0.3, 0.011, 5, 48).rotateX(Math.PI / 2); propGeos.push(hg);
    add(h, hg, M.own('halo', P.glow, { glow: 0.8 })).name = 'halo';
  }
  // ---------------------------------------------------------------- its shadow form: a pool, its head and horns rising out of it
  const poolShape = new THREE.Shape(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2, r = 0.55 * (1 + (i % 2 ? 0.18 : -0.05) + Math.sin(i * 2.3) * 0.08); poolShape[i ? 'lineTo' : 'moveTo'](Math.sin(a) * r, Math.cos(a) * r); }
  const poolM = M.mat('bhPool', P.ink, { flat: true, lineWhite: white });
  const pool = add(g, new THREE.ShapeGeometry(poolShape).scale(0.95, 1.7, 1).rotateX(-Math.PI / 2), poolM, 0, 0.03, 0);
  const glowRim = add(g, new THREE.RingGeometry(0.62, 0.72, 24).scale(0.95, 1.7, 1).rotateX(-Math.PI / 2), M.own('glow', P.glow, { glow: 0.8, side: THREE.DoubleSide }), 0, 0.04, 0);
  const rising = pivot(g, 0, 0, 0.4, 'rising');
  add(rising, new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.15, 0.16, 0.22), poolM);
  // (the rising head wears the body's own horns, smaller: the same sweep from two roots on its crown, a world's own)
  const riseHorns = hornShapes([-1, 1].map((s) => ({ side: s, at: [s * 0.08, 0.15, 0.03] })), props, 0.85);
  const snout = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.1, 0.07, 0.11).translate(0, 0, 0.17); snout.deleteAttribute('uv');
  // (in the horns' colour: the home skin's the texture's cream)
  add(rising, merged([...riseHorns, snout]), M.mat('bhRiseLight', home ? L.palette.at(-1) : P.antler, { flat: true, lineWhite: white }));
  add(rising, merged(pair((s) => new THREE.SphereGeometry(0.04, 8, 6).scale(1, 0.55, 1).translate(s * 0.08, 0.08, 0.15))), eyeM);
  const gaze = [headGaze, gazePart(g, rising, { mode: 'turn', yaw: 0.5, up: 0.3, down: 0.3 })];
  finish(g);
  g.updateMatrixWorld(true);
  sm.bind(new THREE.Skeleton(list));
  boneBoxes(sm, list);
  const tailBones = [0, 1, 2, 3].map((i) => bones[`tail${i}`]);
  let solid = 1, crouch = 0, rake = 0, coil = 0, bite = 0;
  return {
    group: g, gaze, body, rig, parts: [], eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, shadowy: true, tones: [P.ink, P.antler, P.patch],
    body3d: 'tripo',
    tell: (id) => (id === 'rake' ? hornTip : headPivot),
    anim(f, c) {
      const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
      const sinking = wind && f.atk?.blink;
      const lying = f.state === 'idle' && !f.provoked && !f.watcher;
      const gone = f.phased || sinking || lying;
      solid = ease(solid, gone ? 0 : 1, gone ? 6 : 14, dt);
      sm.visible = body.visible = solid > 0.08; body.scale.set(1, Math.max(0.05, solid), 1);
      pool.visible = solid < 0.9; pool.scale.setScalar(1.2 - solid * 0.5);
      glowRim.visible = rising.visible = solid < 0.6;
      rising.position.y = -0.12 + (1 - solid) * 0.12 + Math.sin(c.now / 140) * 0.015;
      glowRim.scale.setScalar(1 + Math.sin(c.now / 200) * 0.06);
      crouch = ease(crouch, id === 'pounce' && wind ? c.wind : 0, 10, dt);
      coil = ease(coil, id === 'pounce' && wind ? THREE.MathUtils.smoothstep(f.k, 0.5, 0.8) : 0, 14, dt);
      rake = ease(rake, id === 'rake' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0, 12, dt);
      bite = ease(bite, (strike && id === 'bite' ? Math.sin(Math.PI * f.k) : 0) + coil * 0.4, 20, dt);
      const leap = strike && f.atk?.lunge ? Math.min(1, Math.sin(Math.PI * Math.min(1, f.k * 1.4)) * 3) : 0;
      const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, recovery: c.recovery, air: leap });
      const shiver = coil * Math.sin(c.now / 22) * 0.018;
      body.position.set(o.x + shiver, -(1 - solid) * 0.3 + o.y - crouch * 0.2 + coil * 0.06, o.z);
      body.rotation.set(o.pitch + crouch * 0.12 + coil * 0.14, o.yaw + rake * (strike ? -0.5 : 0.25), o.roll + shiver);
      neck.rotation.set(crouch * 0.7 + rake * 0.6 - o.pitch * 0.6, 0, rake * 0.4);
      headPivot.rotation.x = crouch * 0.3 + rake * 0.3 + bite * 0.35;
      g.position.y += leap ? Math.sin(Math.PI * f.k) * 0.5 : 0;
      const run = c.moving ? Math.min(1, (f.def.speed ?? 5) / 5) : 0;
      const sway = Math.sin(c.now / (c.moving ? 170 : 520)) * (c.moving ? 0.22 : 0.1) * (1 - coil);
      tailBones.forEach((t, i) => t.rotation.set(-run * 0.15 - leap * 0.2 + coil * (i ? 0.08 : 0.45) + Math.sin(c.now / 30 + i) * coil * 0.03 - crouch * 0.12 * (1 - coil), sway * (0.5 + i * 0.3), 0));
      rig.write();
      skinLegs.write(f.heading, { air: leap > 0.5 ? 1 : 0 });
      eyeM.uniforms.uColor.value.set(eyeColor(f, f.lit > 0 ? '#ffe2a8' : P.eye, '#ff6a8a'));
      if (solid > 0.5 && Math.random() < (props.has('drips') ? 0.25 : 0.12)) c.drip(f, P.ink);
    },
    // (the dressed geometry and its colours are the source's, shared by every hound: kept)
    dispose() { M.dispose(); hide.dispose(); restGeo.dispose(); eyeGeo.dispose(); for (const x of propGeos) x.dispose(); },
  };
}

/**
 * Each bone's box of the vertices it carries most (the body the blade meets, src/foe-body.js; a gallery's frame), as
 * kit.js skinned. The bind pose is every hound's: the boxes are measured once a dressed geometry (cached on it).
 */
function boneBoxes(sm, bones) {
  const geo = sm.geometry, pos = geo.attributes.position;
  let local = boneBoxCache.get(pos);
  if (!local) {
    local = bones.map(() => new THREE.Box3());
    const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, v = new THREE.Vector3();
    sm.updateMatrixWorld(true);
    for (let i = 0; i < pos.count; i++) { let b = SI.getX(i), w = SW.getX(i); for (const [bb, ww] of [[SI.getY(i), SW.getY(i)], [SI.getZ(i), SW.getZ(i)], [SI.getW(i), SW.getW(i)]]) if (ww > w) { b = bb; w = ww; } local[b].expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(sm.matrixWorld).applyMatrix4(sm.skeleton.boneInverses[b])); }
    boneBoxCache.set(pos, local);
  }
  sm.userData.boneBoxes = { bones, local };
  const box = new THREE.Box3(), sphere = new THREE.Sphere(), back = new THREE.Matrix4(), corner = new THREE.Vector3();
  const bounds = () => { sm.updateWorldMatrix(true, false); back.copy(sm.matrixWorld).invert(); box.makeEmpty();
    bones.forEach((b, i) => { const Lb = local[i]; if (Lb.isEmpty()) return; b.updateWorldMatrix(true, false); for (let k = 0; k < 8; k++) box.expandByPoint(corner.set(k & 1 ? Lb.max.x : Lb.min.x, k & 2 ? Lb.max.y : Lb.min.y, k & 4 ? Lb.max.z : Lb.min.z).applyMatrix4(b.matrixWorld).applyMatrix4(back)); });
    return box; };
  let at = -1;
  Object.defineProperty(sm, 'boundingBox', { configurable: true, get: bounds, set() {} });
  Object.defineProperty(sm, 'boundingSphere', { configurable: true, get: () => { if (RENDER_FRAME.on && at === RENDER_FRAME.n) return sphere; at = RENDER_FRAME.on ? RENDER_FRAME.n : -1; return bounds().getBoundingSphere(sphere); }, set() {} });
}
/** The bone boxes measured, a dressed geometry's positions (every hound's bind pose is the same). */
const boneBoxCache = new WeakMap();
