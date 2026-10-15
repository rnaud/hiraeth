import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, sharedUniforms } from '../../materials.js';
import { paint } from '../kit.js';
import { Door, Flame, Switch, Sentry } from '../pieces.js';
import { glyphGeometry } from '../../story/sign-text.js';
import { skinShader, spliceSkin } from './skin-shader.js';

// ---------------------------------------------------------------------------
// The Rose House in its futuristic skin (issue #342, docs/systems/temples.md "Futuristic skins"), after the author's
// picks (references/temples/future/rose-house/sheet-1.jpg and sheet-2.jpg): a test chamber of the Givers' high
// technology, its look only. The same rooms, doors, collision, pieces, positions and logic (tests/temple-skins.test.js).
//   1. surfaces: the walls monolithic slabs of warm violet-grey slate, each its own tone, a chamfer round it (a lit bevel
//      on its upper edge, a shaded one under), a pen line in every joint and rose sand caught in some; thin line circuits
//      in long straight runs and right-angled turns up the slabs and across the floor plates, most of them lit ember
//      orange (they breathe, and bloom tightly: the surface's `emit` just over the post pass's 0.62), the rest dark, a
//      small lit node where a lit run turns or ends; the makers' marked faces (doors, the gallery's face, the pier, the
//      obelisk) a finer machined slab with more circuits lit; warm sandstone floor plates split in halves and quarters
//      with their inlays; the cistern's basin in concentric stepped rings, a pale tide line round it.
//   2. glows: the frieze's lamps light panels (a lit slot under every other glyph), each groove a thin ember line down its
//      floor, the makers' mark (the shared one: an open corner beside a shorter upright) lit; daylight through slots along the great halls' ceilings (a lit strip under each edge).
//   3. dressing, drawn only (three merged meshes, vertex-coloured: no collision, out of the shadow passes, kept off every
//      doorway and piece): slate obelisks with a cold cup in the corners of the great halls, thin slate plates floating
//      high under the ceilings, a thin hoop floating over every pilot flame (its inner edge lit), the spout slab hanging
//      over the cistern with the sign on it and a dead lens under it.
//   4. braziers (pieces.js Brazier asks rt.skin.brazier): an obelisk terminal round the same hooded bowl and fire, its
//      mouth low on the groove, its circuit lit when the bowl is (rt.skin.lit).
// On Low, Handheld and the Steam Deck (uWearLite) the shader leaves out the dark circuits, the insets and the chamfers'
// shading, and the floating plates are hidden.
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** The skin's colours (sRGB) and sizes (m). */
export const ROSE_SKIN = {
  ember: '#ff8a3d',
  wall: { color: '#5e5462', seam: '#2f2833', bevel: '#8a7d88', sand: '#c4917c', size: [4.2, 6.0, 4.4, 0.8], more: [0.32, 0.85, 0.07, 0.6] },
  machine: { color: '#554c58', seam: '#2a242d', bevel: '#7f7381', sand: '#c4917c', size: [1.7, 2.3, 2.0, 0.8], more: [0.45, 0.9, 0.05, 0.3] },
  floor: { color: '#b89e90', seam: '#6a5550', bevel: '#d0bbab', sand: '#d29f88', size: [4.2, 0, 3.8, 0.6], more: [0, 0.55, 0.04, 0.7] },
  basin: { color: '#8a7d86', seam: '#463d48', tide: '#dccdbd', step: 0.62 },
  trim: '#4a4251', stone: '#5c5263', fitting: '#413a45', groove: '#2e2a33', dressing: '#584e5f',
  sign: '#ff9a50', lens: '#2b2730',
  /** daylight through the slots along the halls' ceilings (drawn: a lit strip) */
  daylight: '#f4d29a', slot: { w: 1.5, off: 0.3, end: 1.4 },
  /** how many corner obelisks, floating plates a hall may have, and their sizes */
  obelisk: { inset: 2.6, h: 6.6, foot: 1.8, top: 1.15 },
  plates: { per: 7, below: [3, 7.5], clear: 9 },
};

// ------------------------------------------------------------------ the surfaces
// (declared before main(): the surface shader's vnoise, uPixelRatio, uTime and uWearLite are in scope by then)
const RH_PARS = /* glsl */ `
  uniform vec3 uSkinO;
  uniform vec4 uSkP;
  uniform vec4 uSkQ;
  uniform vec3 uSkA;
  uniform vec3 uSkB;
  uniform vec3 uSkE;
  uniform vec3 uSkS;
  uniform vec3 uSkC;
`;
const RH_GLSL = /* glsl */ `
  float rhH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float rhSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0); return length(pa - ba * h); }
  // a line w m across at d m from its middle, pxm m a pixel: its share of the pixel (never thinner than a pixel)
  float rhCov(float d, float w, float pxm) { float h = max(w * 0.5, pxm * 0.5); return clamp((h - d) / pxm + 0.5, 0.0, 1.0) * clamp(w / pxm, 0.45, 1.0); }
  // a circuit in the strip u0..u0+W: segments S long up v, each at its own place across, joined by right-angled turns;
  // lit in runs of three (a share uSkP.w of them). x: how near the lit trace (m), y: the dark, z: a lens terminal (m)
  // (on one of three lanes across its strip: a third of the time a run goes straight on, unturned)
  float rhX(float seed, float k, float u0, float W) { return u0 + W * (0.2 + 0.3 * floor(rhH(vec2(seed, k)) * 2.999)); }
  float rhLit(float seed, float k) { return step(rhH(vec2(seed * 1.31, floor(k / 3.0))), uSkP.w); }
  vec3 rhTrace(vec2 p, float u0, float W, float S, float seed) {
    float k = floor(p.y / S), y0 = k * S, y1 = y0 + S;
    float xa = rhX(seed, k, u0, W), xp = rhX(seed, k - 1.0, u0, W), xn = rhX(seed, k + 1.0, u0, W);
    float lk = rhLit(seed, k), lp = rhLit(seed, k - 1.0), ln = rhLit(seed, k + 1.0);
    float dv = abs(p.x - xa), d0 = rhSeg(p, vec2(xp, y0), vec2(xa, y0)), d1 = rhSeg(p, vec2(xa, y1), vec2(xn, y1));
    float lit = 1e3, dark = 1e3, lens = 1e3;
    if (lk > 0.5) lit = dv; else dark = dv;
    if (lk * lp > 0.5) lit = min(lit, d0); else dark = min(dark, d0);
    if (lk * ln > 0.5) lit = min(lit, d1); else dark = min(dark, d1);
    // (a node where a lit run ends, and where it turns)
    if (lk > 0.5 && (ln < 0.5 || abs(xn - xa) > 1e-3)) lens = length(p - vec2(xa, y1));
    if (lk > 0.5 && lp < 0.5) lens = min(lens, length(p - vec2(xa, y0)));
    return vec3(lit, dark, lens);
  }
  float rhLine(float px) { float w = 0.5 * uPixelRatio; return 1.0 - smoothstep(w, w + 1.0, px); }
  // the circuits' lit pixels, breathing a little, each run its own beat: just over the post pass's 0.62, a tight halo
  float rhBreathe(float seed) { return 0.74 + 0.06 * sin(uTime * 1.15 + seed * 2.3); }
  // a circuit's look over albedo: lit (uSkE, emit) or dark (uSkA, a groove); its lens terminals
  void rhCircuit(vec3 T, float pxm, float lite, float seed, inout vec3 albedo, inout float emit, inout float ink) {
    float cl = rhCov(T.x, 0.045, pxm), cd = (1.0 - lite) * rhCov(T.y, 0.035, pxm) * (1.0 - smoothstep(0.02, 0.05, pxm));
    float lensC = rhCov(T.z, 0.15, pxm), ring = rhCov(abs(T.z - 0.12), 0.03, pxm) * (1.0 - smoothstep(0.02, 0.05, pxm));
    albedo = mix(albedo, uSkA, max(cd * 0.85, ring));
    float on = max(cl, lensC) * rhBreathe(seed);
    albedo = mix(albedo, uSkE, max(cl, lensC));
    emit = max(emit, on);
    ink = max(ink, ring * 0.6);
  }
`;
/** Each body replaces the surface's `vec3 albedo = uColor;` (and its first pen lines, its emit). */
const BODIES = {
  // slabs of slate: uSkP (slab width, course, circuit segment, lit share), uSkQ (inset share, circuit share, chamfer, sand)
  slab: /* glsl */ `
    vec3 skP = vWorldPos - uSkinO;
    float skInk = 0.0, skEmit = 0.0;
    vec3 albedo = uColor;
    {
      vec3 an = abs(n);
      bool side = an.y < 0.65;
      vec2 uv = side ? vec2(dot(skP.xz, normalize(vec2(-n.z, n.x) + 1e-6)), skP.y) : skP.xz;   // (along the face, whichever way it looks: a round room's stones too)
      vec2 fw2 = fwidth(uv);
      float pxm = max(max(fw2.x, fw2.y), 1e-5), lite = uWearLite;
      float near = 1.0 - smoothstep(0.035, 0.09, pxm);
      float W = uSkP.x, col = floor(uv.x / W), hc = rhH(vec2(col, 3.1));
      float H = uSkP.y * (0.75 + 0.5 * hc), vq = uv.y / H + hc * 5.0, row = floor(vq);
      vec2 f = vec2(fract(uv.x / W), fract(vq)), dm = min(f, 1.0 - f) * vec2(W, H);
      float dj = min(dm.x, dm.y);
      albedo = uColor * (1.0 + (rhH(vec2(col, row) + 13.0) - 0.5) * 0.1 + (vnoise(uv * 0.31) - 0.5) * 0.05);
      // the chamfer round each slab: lit on its upper edge (and its left), shaded under it (and on its right)
      float bev = (1.0 - smoothstep(uSkQ.z, uSkQ.z + pxm, dj)) * near * (1.0 - lite * 0.6);
      float up = dm.y < dm.x ? (f.y > 0.5 ? 1.0 : -1.0) : (f.x < 0.5 ? 0.55 : -0.55);
      albedo = mix(albedo, up > 0.0 ? uSkB : uColor * 0.7, bev * abs(up));
      // the joint: a pen line, rose sand caught in some of them
      skInk = rhLine(dj / pxm) * 0.85;
      float sand = smoothstep(0.5, 0.78, vnoise(uv * 0.45 + 9.0)) * (1.0 - smoothstep(0.0, 0.14, dj)) * uSkQ.w;
      albedo = mix(albedo, uSkS, sand);
      // a panel inset in some slabs
      if (lite < 0.5 && rhH(vec2(col, row) + 5.0) < uSkQ.x) skInk = max(skInk, rhLine(abs(dj - 0.32) / pxm) * 0.45 * near);
      // the circuits: one in some slabs' columns, up the wall (across a ceiling)
      // (two strips to a column: a circuit in most of them)
      float W2 = W * 0.5, c2 = floor(uv.x / W2);
      if (rhH(vec2(c2, 7.7)) < uSkQ.y) rhCircuit(rhTrace(uv, c2 * W2, W2, uSkP.z * (0.8 + 0.5 * rhH(vec2(c2, 2.9))), c2 + 0.37), pxm, lite, c2, albedo, skEmit, skInk);
    }
  `,
  // floor plates: uSkP.x m squares, some split in halves or quarters, inlaid circuits both ways (uSkP.zw, uSkQ.y)
  plates: /* glsl */ `
    vec3 skP = vWorldPos - uSkinO;
    float skInk = 0.0, skEmit = 0.0;
    vec3 albedo = uColor;
    {
      vec3 an = abs(n);
      bool top = an.y > 0.65;
      vec2 uv = top ? skP.xz : vec2(dot(skP.xz, normalize(vec2(-n.z, n.x) + 1e-6)), skP.y);
      vec2 fw2 = fwidth(uv);
      float pxm = max(max(fw2.x, fw2.y), 1e-5), lite = uWearLite;
      float near = 1.0 - smoothstep(0.035, 0.09, pxm);
      float G = uSkP.x;
      vec2 c = floor(uv / G), f = fract(uv / G);
      float h = rhH(c + 1.7);
      vec2 sub = h < 0.3 ? vec2(1.0) : (h < 0.65 ? (rhH(c + 3.0) < 0.5 ? vec2(2.0, 1.0) : vec2(1.0, 2.0)) : vec2(2.0));
      vec2 fs = fract(f * sub), cs = floor(f * sub), dm = min(fs, 1.0 - fs) * G / sub;
      float dj = min(dm.x, dm.y);
      albedo = uColor * (1.0 + (rhH(c * 2.0 + cs + 21.0) - 0.5) * 0.07 + (vnoise(uv * 0.4) - 0.5) * 0.04);
      float bev = (1.0 - smoothstep(uSkQ.z, uSkQ.z + pxm, dj)) * near * (1.0 - lite * 0.6);
      albedo = mix(albedo, (fs.y > 0.5) == (dm.y < dm.x) ? uSkB : uColor * 0.82, bev * 0.8);
      skInk = rhLine(dj / pxm) * 0.75;
      // rose sand blown over the plates in drifts, and caught in the joints
      float drift = smoothstep(0.58, 0.82, vnoise(uv * 0.07 + 4.0)) * 0.5 + (1.0 - smoothstep(0.0, 0.12, dj)) * smoothstep(0.45, 0.7, vnoise(uv * 0.5));
      albedo = mix(albedo, uSkS, clamp(drift, 0.0, 1.0) * uSkQ.w * (top ? 1.0 : 0.0));
      // (a floor's edge, a ledge's face: the slate of the walls, its plates' joints still)
      if (!top) albedo = mix(albedo, uSkA, 0.55);
      // the inlays: circuits along the plates' columns one way, and the other
      if (top) {
        if (rhH(vec2(c.x, 7.7)) < uSkQ.y) rhCircuit(rhTrace(uv, c.x * G, G, uSkP.z, c.x + 0.37), pxm, lite, c.x, albedo, skEmit, skInk);
        if (rhH(vec2(c.y, 9.1)) < uSkQ.y * 0.6) rhCircuit(rhTrace(uv.yx, c.y * G, G, uSkP.z * 1.3, c.y + 51.0), pxm, lite, c.y, albedo, skEmit, skInk);
      }
    }
  `,
  // the cistern's basin: steps in rings round its middle (uSkC: its x, z and radius), a pale tide line under its rim
  basin: /* glsl */ `
    vec3 skP = vWorldPos - uSkinO;
    float skInk = 0.0, skEmit = 0.0;
    vec3 albedo = uColor;
    {
      float r = length(skP.xz - uSkC.xy), fr = max(fwidth(r), 1e-5);
      if (r < uSkC.z + 0.2) {
        float q = r / uSkP.x, k = floor(q), f = fract(q);
        albedo = uColor * (0.94 + 0.12 * step(0.5, fract(k * 0.5)) + 0.05 * f);
        skInk = rhLine(min(f, 1.0 - f) * uSkP.x / fr) * 0.8;
        float tide = smoothstep(uSkC.z - 0.95, uSkC.z - 0.85, r) * (1.0 - smoothstep(uSkC.z - 0.55, uSkC.z - 0.45, r));
        albedo = mix(albedo, uSkB, tide);
      }
    }
  `,
};

/** The pattern, as data the web's shader and the Unity port's are both made from (skin-shader.js). */
const SHADER = skinShader('rose-house', { pars: RH_PARS, glsl: RH_GLSL, bodies: BODIES, ink: 'skInk', emit: 'skEmit', emitAt: 'init' });

/** The surface material of one of the skin's bodies: makeMaterial's own, its albedo, first pen lines and emit the body's. */
function skinMaterial(body, look, o, U, key) {
  const m = makeMaterial({ flat: true, ...look, color: o.color, key: `temple.skin.rose.${key}` });
  m.uniforms.uSkinO = U.origin;
  if (m.userData.roseSkin) return m;
  m.userData.roseSkin = body;
  spliceSkin(m, SHADER, body, 'rose-house.js');
  const c = (h) => ({ value: new THREE.Color(h ?? o.color) });
  Object.assign(m.uniforms, {
    uSkA: c(o.seam), uSkB: c(o.bevel ?? o.tide), uSkE: c(ROSE_SKIN.ember), uSkS: c(o.sand),
    uSkP: { value: new THREE.Vector4(...(o.size ?? [o.step ?? 1, 0, 0, 0])) },
    uSkQ: { value: new THREE.Vector4(...(o.more ?? [0, 0, 0, 0])) },
    uSkC: { value: new THREE.Vector3(...(o.centre ?? [0, 0, 0])) },
  });
  return m;
}

// ------------------------------------------------------------------ shapes
const flat = (g) => (g.index ? g.toNonIndexed() : g);
/** Strip a geometry to position and normal (to merge with others). */
function bare(g) {
  g = flat(g);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
/** A square frustum (a tapered slab), foot w0 wide, top w1, h high, its foot at y 0 (no bottom face). */
function frustum(w0, w1, h, d0 = w0, d1 = w1) {
  const g = new THREE.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2, 1, 4, 1, true).rotateY(Math.PI / 4).translate(0, 0.5, 0);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const t = P.getY(i), w = THREE.MathUtils.lerp(w0, w1, t), d = THREE.MathUtils.lerp(d0, d1, t);
    P.setXYZ(i, Math.sign(P.getX(i)) * w / 2, t * h, Math.sign(P.getZ(i)) * d / 2);
  }
  g.computeVertexNormals();
  return bare(g);
}
const slab = (w, h, d, x = 0, y = 0, z = 0) => bare(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
/** The makers' mark (the shared one, src/story/sign-text.js glyphGeometry), `size` m square, `depth` thick, its middle at 0. */
const markGeometry = (size = 1, depth = 0.06) => bare(glyphGeometry(size, depth));

// ------------------------------------------------------------------ what the dressing keeps off
/** Boxes (the kit's frame) round every doorway, archway and piece: the dressing stands clear of them. */
function keepOuts(rt, plan) {
  const K = rt.kit, out = [], b = new THREE.Box3();
  const local = (box) => box.clone().applyMatrix4(K.inv);
  // the holes in the walls: a doorway, an archway, a window, 1.5 m either side and 5 m out each way
  for (const e of plan) {
    if (e.kind === 'wall') {
      const t = V(e.dir[0], 0, e.dir[1]), nrm = V(e.dir[1], 0, -e.dir[0]);
      for (const h of e.holes) {
        const pts = [];
        for (const s of [h.x0 - 1.5, h.x1 + 1.5]) for (const o of [-5, 5]) pts.push(V(e.a[0], 0, e.a[1]).addScaledVector(t, s).addScaledVector(nrm, o));
        const bb = new THREE.Box3().setFromPoints(pts);
        bb.min.y = e.y0 + h.y0 - 0.5; bb.max.y = e.y0 + h.y1 + 1.5;
        out.push(bb);
      }
    } else if (e.kind === 'round') {
      for (const g of e.gaps ?? []) {
        const d = V(Math.sin(g.a), 0, Math.cos(g.a)), t = V(d.z, 0, -d.x), c = V(e.x, 0, e.z).addScaledVector(d, e.r);
        const pts = [];
        for (const s of [-(g.w / 2 + 1.5), g.w / 2 + 1.5]) for (const o of [-5, 5]) pts.push(c.clone().addScaledVector(t, s).addScaledVector(d, o));
        const bb = new THREE.Box3().setFromPoints(pts);
        bb.min.y = e.y + (g.y0 ?? 0) - 0.5; bb.max.y = e.y + (g.y0 ?? 0) + g.h + 1.5;
        out.push(bb);
      }
    }
  }
  // what the kit drew that is not a wall, a floor or the sand: columns, frames, mounds, the pier, the obelisk
  const surfaces = new Set([rt.M.wall, rt.M.floor, rt.M.sand]);
  for (const [mat, list] of K.batches) {
    if (surfaces.has(mat) || mat.vertexColors) continue;
    for (const g of list) {
      g.computeBoundingBox();
      const l = local(g.boundingBox), s = l.getSize(V());
      if (Math.max(s.x, s.z) < 12 && !(s.x > 6 && s.z > 6)) out.push(l.expandByScalar(0.4));
    }
  }
  // the paint the kit drew (columns, frames, lips): the same, by its triangles' boxes per geometry
  for (const [mat, list] of K.batches) {
    if (!mat.vertexColors) continue;
    for (const g of list) {
      g.computeBoundingBox();
      const l = local(g.boundingBox), s = l.getSize(V());
      if (s.y > 1.5 && Math.max(s.x, s.z) < 4) out.push(l.expandByScalar(0.4));
    }
  }
  // every piece: its body, 1 m round it (a door: 5 m out each way across its doorway)
  for (const p of rt.pieces) {
    const o = p.group ?? p.mesh ?? p.root;
    if (o?.isObject3D) {
      o.updateMatrixWorld(true);
      b.setFromObject(o);
      const l = local(b), s = l.getSize(V());
      if (!l.isEmpty() && Math.max(s.x, s.z) < 16 && s.y < 30) out.push(l.expandByScalar(p instanceof Door ? 1.5 : 1.0));
      if (p instanceof Door) out.push(l.clone().expandByVector(V(5, 0.5, 5)));
    }
    for (const q of [p.pos, p.center]) if (q?.isVector3) out.push(new THREE.Box3().setFromCenterAndSize(K.local(q), V(3, 3, 3)));
  }
  return out;
}
const hits = (keep, box) => keep.some((k) => k.intersectsBox(box));

/** The skin's hash: the same dressing every build. */
function rand(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }

// ------------------------------------------------------------------ the dressing
/**
 * The dressing's geometries (the kit's frame): `slate` (obelisks, the flames' rings, the spout), `plates` (the floating
 * plates: the finer, hidden on the lighter presets) and `glow` (their lit parts: the lenses, the rings' inner lines, the
 * grooves' lines, the sign on the spout). Returns counts.
 */
function dressing(rt, S, keep, plan) {
  const K = rt.kit, rnd = rand(342), slate = [], plates = [], glow = [], dead = [];
  const rooms = plan.filter((e) => e.kind === 'hall' || e.kind === 'round');
  const eyes = rt.pieces.filter((p) => p instanceof Switch || p instanceof Sentry).map((p) => K.local(p.group?.position ?? p.pos));
  const n = { obelisks: 0, plates: 0, rings: 0, spouts: 0, grooves: 0, slots: 0 };
  // the obelisks: a tapered slate slab with a cold cup on it in each corner of the great halls, a lens on its two faces
  // looking into the room (sheet-1, sheet-2: the brazier terminals at the hall's corners)
  const O = S.obelisk;
  for (const r of rooms) {
    if (r.kind !== 'hall' || r.floor === false || r.h < 15) continue;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = r.x + sx * (r.w / 2 - O.inset), z = r.z + sz * (r.d / 2 - O.inset);
      const box = new THREE.Box3(V(x - O.foot / 2 - 0.3, r.y, z - O.foot / 2 - 0.3), V(x + O.foot / 2 + 0.3, r.y + O.h + 1, z + O.foot / 2 + 0.3));
      if (hits(keep, box)) continue;
      const y = r.y - 0.05;
      slate.push(frustum(O.foot, O.top, O.h).translate(x, y, z));
      slate.push(slab(O.top + 0.3, 0.35, O.top + 0.3, x, y + O.h + 0.175, z));
      // the cup: a square bowl on a short neck
      slate.push(frustum(0.55, 0.55, 0.5).translate(x, y + O.h + 0.35, z), frustum(0.9, 1.35, 0.45).translate(x, y + O.h + 0.85, z));
      // its lens, on the two faces looking into the room, and a lit line up from the foot to it
      for (const [fx, fz] of [[-sx, 0], [0, -sz]]) {
        const hw = THREE.MathUtils.lerp(O.foot, O.top, 0.33) / 2 + 0.03, ly = y + O.h * 0.33;
        const c = V(x + fx * hw, ly, z + fz * hw), yaw = Math.atan2(fx, fz);
        glow.push(bare(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 14).rotateX(Math.PI / 2).rotateY(yaw).translate(c.x, c.y, c.z)));
        dead.push(bare(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 14).rotateX(Math.PI / 2).rotateY(yaw).translate(c.x - fx * 0.012, c.y, c.z - fz * 0.012)));
        const w0 = O.foot / 2 + 0.02, w1 = THREE.MathUtils.lerp(O.foot, O.top, 0.3) / 2 + 0.02;
        // (a thin bar on the tapered face, from the foot to under the lens, off-centre)
        const a = V(x + fx * w0, y + 0.3, z + fz * w0).add(V(fz * 0.35, 0, fx * 0.35)), b = V(x + fx * w1, ly - 0.35, z + fz * w1).add(V(fz * 0.35, 0, fx * 0.35));
        glow.push(bar(a, b, 0.05));
        glow.push(bar(b, V(c.x, ly - 0.35, c.z), 0.05));
      }
      keep.push(box);
      n.obelisks++;
    }
  }
  // the floating plates: thin slate slabs high under the ceilings, held by nothing (off the eyes to strike, over the
  // spout's place in a round room, and off one another)
  const P = S.plates, placed = [];
  for (const r of rooms) {
    if (r.h < 15) continue;
    const top = r.y + r.h;
    for (let k = 0, got = 0; k < 60 && got < P.per; k++) {
      const y = top - P.below[0] - rnd() * (P.below[1] - P.below[0]);
      let x, z;
      if (r.kind === 'round') { const a = rnd() * TAU, d = 6 + rnd() * (r.r - 9.5); x = r.x + Math.sin(a) * d; z = r.z + Math.cos(a) * d; }
      else { x = r.x + (rnd() * 2 - 1) * (r.w / 2 - 4); z = r.z + (rnd() * 2 - 1) * (r.d / 2 - 4); }
      const w = 2.2 + rnd() * 2.2, d = 0.9 + rnd() * 1.1, yaw = (rnd() - 0.5) * 0.3 + (rnd() < 0.5 ? 0 : Math.PI / 2);
      if (eyes.some((q) => Math.hypot(q.x - x, q.z - z) < P.clear)) continue;
      if (placed.some((q) => Math.hypot(q.x - x, q.z - z) < 4.5 && Math.abs(q.y - y) < 2.5)) continue;
      const box = new THREE.Box3().setFromCenterAndSize(V(x, y, z), V(w + 0.6, 0.8, w + 0.6));
      if (hits(keep, box)) continue;
      placed.push(V(x, y, z));
      plates.push(bare(new THREE.BoxGeometry(w, 0.14, d).rotateZ((rnd() - 0.5) * 0.08).rotateY(yaw).translate(x, y, z)));
      got++; n.plates++;
    }
  }
  // a thin ring floating over every pilot flame (sheet-1, sheet-2: the never-dying flame held in a floating hoop), over
  // the ball that rolls through it: a flat hoop of slate, its inner edge lit ember
  for (const p of rt.pieces) {
    if (!(p instanceof Flame)) continue;
    const c = K.local(p.pos), R = (p.o.r ?? 0.9) + 0.65, y = c.y + 2.45;
    const hoop = new THREE.LatheGeometry([[R, -0.04], [R + 0.13, -0.035], [R + 0.13, 0.035], [R, 0.04], [R, -0.04]].map(([a, b]) => new THREE.Vector2(a, b)), 32);
    slate.push(bare(hoop).translate(c.x, y, c.z));
    glow.push(bare(new THREE.TorusGeometry(R - 0.005, 0.03, 3, 32).rotateX(Math.PI / 2).translate(c.x, y, c.z)));
    n.rings++;
  }
  // daylight through slots along the great halls' ceilings (sheet-1, sheet-2: the roof stops short of the walls, the sky
  // a bright line along their tops): a lit strip just under the ceiling along each wall, clear of the lintel's trim
  // (and of whatever stands up to the ceiling there: a hall's columns)
  const L = S.slot, day = [];
  for (const r of rooms) {
    if (r.kind !== 'hall' || r.h < 15 || !r.roof) continue;
    const y = r.y + r.h - 0.04, a = L.off + L.w / 2, ex = r.w - 2 * L.end, ez = r.d - 2 * L.end;
    for (const [cx, cz, sx, sz] of [[r.x, r.z - r.d / 2 + a, ex, L.w], [r.x, r.z + r.d / 2 - a, ex, L.w], [r.x - r.w / 2 + a, r.z, L.w, ez], [r.x + r.w / 2 - a, r.z, L.w, ez]]) {
      if (hits(keep, new THREE.Box3().setFromCenterAndSize(V(cx, y - 0.3, cz), V(sx, 0.6, sz)))) continue;
      day.push(slab(sx, 0.04, sz, cx, y, cz));
      n.slots++;
    }
  }
  // the spout slab hanging over a great round room's middle (the cistern): a beam across its oculus, set into its
  // ceiling, a neck, the slab with the makers' sign on the faces toward its doors and a dead lens under it
  for (const r of rooms) {
    if (r.kind !== 'round' || r.r < 16 || !(r.oculus > 0)) continue;
    const top = r.y + r.h, ro = r.r * r.oculus, by = top - 1.6, sy = top - 7.6, sh = 4.3, sw = 5.4;
    slate.push(slab(2 * ro + 3, 2.05, 2.2, r.x, by + 1.025, r.z));
    slate.push(slab(2.2, by - (sy + sh) + 0.05, 2.2, r.x, (by + sy + sh) / 2, r.z));
    slate.push(slab(sw, sh, sw, r.x, sy + sh / 2, r.z));
    slate.push(slab(sw + 0.3, 0.3, sw + 0.3, r.x, sy + 0.15, r.z));
    for (const s of [-1, 1]) glow.push(markGeometry(2.4, 0.08).rotateY(s > 0 ? 0 : Math.PI).translate(r.x, sy + sh * 0.6, r.z + s * (sw / 2 + 0.03)));
    for (const s of [-1, 1]) glow.push(bare(new THREE.BoxGeometry(sw * 0.7, 0.06, 0.05).translate(r.x, sy + 0.62, r.z + s * (sw / 2 + 0.03))));
    dead.push(bare(new THREE.CylinderGeometry(1.25, 1.25, 0.04, 24).translate(r.x, sy - 0.02, r.z)));
    n.spouts++;
  }
  // the grooves: a thin ember line down the middle of every tar ball's groove (the kit's dark paint, a thin long box)
  const dark = new THREE.Color(S.groove);
  for (const [mat, list] of K.batches) {
    if (!mat.vertexColors) continue;
    for (const g of list) {
      const C = g.attributes.color;
      if (!C || Math.abs(C.getX(0) - dark.r) > 1e-3 || Math.abs(C.getY(0) - dark.g) > 1e-3 || Math.abs(C.getZ(0) - dark.b) > 1e-3) continue;
      g.computeBoundingBox();
      const l = g.boundingBox.clone().applyMatrix4(K.inv);
      if (l.max.y - l.min.y > 0.08) continue;
      const P = g.attributes.position, pts = [];
      for (let i = 0; i < P.count; i++) pts.push(V(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(K.inv));
      const c = l.getCenter(V());
      let far = pts[0];
      for (const q of pts) if (q.distanceTo(c) > far.distanceTo(c)) far = q;
      const d0 = far.clone().sub(c).setY(0).normalize(), axis = V();
      for (const q of pts) { const v = q.clone().sub(c).setY(0); axis.addScaledVector(v, Math.sign(v.dot(d0)) || 1); }
      axis.normalize();
      let half = 0, wide = 0;
      for (const q of pts) { const v = q.clone().sub(c).setY(0); half = Math.max(half, Math.abs(v.dot(axis))); wide = Math.max(wide, Math.abs(v.x * axis.z - v.z * axis.x)); }
      if (half < 3 || wide > 0.75) continue;   // (a groove's floor; not the dry channels' wider ones)
      const y = l.max.y + 0.012;
      glow.push(bar(c.clone().setY(y).addScaledVector(axis, -half + 0.3), c.clone().setY(y).addScaledVector(axis, half - 0.3), 0.06, 0.02));
      n.grooves++;
    }
  }
  return { slate, plates, glow, dead, day, n };
}
/** A thin bar from a to b (w across, t thick), lying flat (its thin side up) unless it runs up. */
function bar(a, b, w, t = w) {
  const d = b.clone().sub(a), L = d.length();
  const g = new THREE.BoxGeometry(w, t, L).translate(0, 0, L / 2);
  const m = new THREE.Matrix4().lookAt(V(), d, Math.abs(d.y) > 0.9 * L ? V(0, 0, 1) : V(0, 1, 0));
  // (lookAt aims -z; the box runs +z: turn it round)
  g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI)).applyMatrix4(m).translate(a.x, a.y, a.z);
  return bare(g);
}
/** A geometry painted one colour (the dressing's materials read vertex colours: two looks in one draw). */
function tint(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
/** A drawn-only mesh of the dressing (in the world: geometries from the kit's frame), out of every shadow pass. */
function drawn(name, geos, mat, frame) {
  if (!geos.length) return null;
  const g = mergeGeometries(geos).applyMatrix4(frame);
  const m = new THREE.Mesh(g, mat);
  m.name = name;
  m.userData.noCollide = true; m.userData.keepBuried = true; m.userData.skin = true;
  // (one draw a pass for the whole house's: never cut into tiles nor given levels of detail, src/perf.js, src/lod.js)
  m.userData.dynamic = true;
  m.castShadow = false; m.receiveShadow = true;
  m.userData.castShadow = false;   // (out of every shadow pass: shadows.js draws all but those that opt out)
  return m;
}

// ------------------------------------------------------------------ the makers' sign
/**
 * The kit's glyphs (its friezes', drawn in M.glyph) are the shared makers' mark (src/story/sign-text.js glyphGeometry),
 * lit in the skin's ember: counted, never redrawn (tests/temple-skins.test.js).
 */
const countSigns = (K, mat) => K.batches.get(mat)?.filter((g) => g.userData.makersMark).length ?? 0;

// ------------------------------------------------------------------ the braziers
/**
 * A brazier as an obelisk terminal (pieces.js Brazier: its group faces its mouth, +z): two cheeks and a back of slate
 * round a low mouth on the groove, a square cup over it round the coals, a cowl round the cup's back open at the top and
 * the front, the sign on the cowl's back and a circuit up the cheeks' fronts and over the back, lit with the bowl.
 */
function obeliskBrazier(mats, piece, s) {
  const g = piece.group, parts = [], lines = [];
  // (the old stem's footprint: what you stand by is the same; the ball rolls into the mouth between the cheeks)
  parts.push(frustum(1.55 * s, 1.3 * s, 1.5 * s, 0.42 * s, 0.38 * s).translate(0, 0, -0.62 * s));
  for (const x of [-1, 1]) parts.push(frustum(0.36 * s, 0.32 * s, 1.5 * s, 1.0 * s, 0.9 * s).translate(x * 0.6 * s, 0, -0.05 * s));
  parts.push(slab(1.5 * s, 0.12 * s, 1.35 * s, 0, 1.44 * s, -0.12 * s));
  // the cup: a square bowl, its floor under the coals (1.62 s), its lip at 2.05 s
  parts.push(frustum(1.25 * s, 1.75 * s, 0.5 * s).translate(0, 1.5 * s, 0));
  // the cowl: back and sides round the cup, open at its front (the mouth's side) and its top, for the fire
  parts.push(slab(1.85 * s, 0.85 * s, 0.16 * s, 0, 2.38 * s, -0.86 * s));
  for (const x of [-1, 1]) parts.push(slab(0.16 * s, 0.85 * s, 1.1 * s, x * 0.86 * s, 2.38 * s, -0.36 * s));
  // the obelisk behind it all, tapering up past the fire (the picks' brazier terminals)
  parts.push(frustum(1.5 * s, 0.85 * s, 4.7 * s, 0.4 * s, 0.3 * s).translate(0, 0, -1.12 * s), slab(1.05 * s, 0.18 * s, 0.5 * s, 0, 4.79 * s, -1.12 * s));
  g.add(new THREE.Mesh(mergeGeometries(parts), mats.machine));
  // the circuit: up each cheek's front from the mouth's foot to the cup, along the cup's lip, and the sign on the back
  for (const x of [-1, 1]) {
    lines.push(bare(new THREE.BoxGeometry(0.05 * s, 1.3 * s, 0.04 * s).translate(x * 0.6 * s, 0.75 * s, 0.47 * s)));
    lines.push(bare(new THREE.BoxGeometry(0.05 * s, 0.05 * s, 0.04 * s).translate(x * 0.6 * s, 0.12 * s, 0.47 * s)));
  }
  lines.push(bare(new THREE.BoxGeometry(1.7 * s, 0.05 * s, 0.04 * s).translate(0, 1.92 * s, 0.86 * s)));
  lines.push(markGeometry(0.5 * s, 0.05).translate(0, 3.55 * s, -0.9 * s));
  lines.push(bare(new THREE.BoxGeometry(0.05 * s, 1.1 * s, 0.04 * s).translate(0.3 * s, 3.65 * s, -0.91 * s)), bare(new THREE.BoxGeometry(0.05 * s, 0.8 * s, 0.04 * s).translate(-0.28 * s, 3.4 * s, -0.91 * s)));
  lines.push(bare(new THREE.CylinderGeometry(0.13 * s, 0.13 * s, 0.04, 12).rotateX(Math.PI / 2).translate(0, 0.9 * s, -0.84 * s)));
  const lineMat = makeMaterial({ color: ROSE_SKIN.ember, glow: 0.18, flat: true, key: `temple.skin.rose.brazier.${piece.id}` });
  lineMat.uniforms.uColor.value.set('#9a5a3e');
  const m = new THREE.Mesh(mergeGeometries(lines), lineMat);
  m.name = 'brazier circuit';
  g.add(m);
  piece.skinLines = lineMat;
  return true;
}

// ------------------------------------------------------------------ the house's skin
/**
 * The Rose House's skin (src/temples/skins/index.js houseSkin calls it before the layout): rt.M's surfaces and fittings
 * swapped for the skin's, the kit's plan recording; its hooks.
 */
export function roseHouseSkin(rt) {
  const K = rt.kit, M = rt.M, S = ROSE_SKIN, P = rt.def.palette ?? {};
  const look = P.look?.all ?? {};
  const U = { origin: { value: K.origin.clone() } };
  const was = { ...M };
  const mats = {
    wall: skinMaterial('slab', look, S.wall, U, 'wall'),
    machine: skinMaterial('slab', look, S.machine, U, 'machine'),
    floor: skinMaterial('plates', look, S.floor, U, 'floor'),
    basin: null,
    stoneMat: makeMaterial({ color: S.stone, flat: true, ...look, key: 'temple.skin.rose.stoneMat' }),
    trimMat: makeMaterial({ color: S.fitting, flat: true, key: 'temple.skin.rose.fitting' }),
    glyph: makeMaterial({ color: S.sign, glow: 0.76, flat: true, key: 'temple.skin.rose.sign' }),
    dressing: makeMaterial({ flat: true, ...look, color: '#ffffff', vertexColors: true, key: 'temple.skin.rose.dressing' }),
    // (the lit dressing: its glow just over the post pass's 0.62, the halo kept tight)
    glow: makeMaterial({ color: '#ffffff', vertexColors: true, glow: 0.78, flat: true, key: 'temple.skin.rose.glow' }),
    slot: makeMaterial({ color: S.ember, glow: 0.78, flat: true, key: 'temple.skin.rose.slot' }),
    slotDim: makeMaterial({ color: '#4a3c3c', glow: 0.1, flat: true, key: 'temple.skin.rose.slotDim' }),
  };
  Object.assign(M, {
    wall: mats.wall, wallGlyph: mats.machine, floor: mats.floor, stoneMat: mats.stoneMat, trimMat: mats.trimMat, glyph: mats.glyph,
    trim: paint(S.trim), stone: paint(S.stone), dark: paint(S.groove),
    // (no straight courses across the slabs; the frieze's lamps light panels: a lit slot under every other glyph)
    bands: [],
    ornament: { kind: 'slot', mats: { a: mats.slot, b: mats.slotDim } },
  });
  K.plan = [];
  const meshes = [];
  const skin = {
    id: 'rose-house', S, mats, meshes, stats: null,
    /** A brazier's body (pieces.js Brazier): an obelisk terminal; true, the skin drew it. */
    brazier: (piece, s) => obeliskBrazier(mats, piece, s),
    /** A brazier lit (pieces.js Brazier ignite): its circuit lights. */
    lit(piece) { const m = piece.skinLines; if (m) { m.uniforms.uColor.value.set(S.ember); m.uniforms.uGlow.value = 0.95; } },
    /** After the layout: the basin, the signs and the dressing. */
    dress() {
      const t0 = performance.now(), plan = K.plan;
      // the great round room's basin (M.stone, the house's one use of it): its steps round its middle
      const big = plan.filter((e) => e.kind === 'round').sort((a, b) => b.r - a.r)[0];
      if (big) {
        mats.basin = skinMaterial('basin', look, { ...S.basin, centre: [big.x, big.z, 6.65] }, U, 'basin');
        moveStone(K, S.stone, mats.basin, big);
      }
      const signs = countSigns(K, M.glyph);
      const keep = keepOuts(rt, plan);
      const D = dressing(rt, S, keep, plan);
      // (vertex colours: the dark lenses drawn with the slate, the daylight slots with the ember lines)
      const slateM = drawn('skin: obelisks, rings, the spout and its dark lenses', [...D.slate.map((g) => tint(g, S.dressing)), ...D.dead.map((g) => tint(g, S.lens))], mats.dressing, K.frame);
      const plateM = drawn('skin: floating plates', D.plates.map((g) => tint(g, S.dressing)), mats.dressing, K.frame);
      const glowM = drawn('skin: lit lines, lenses and the daylight slots', [...D.glow.map((g) => tint(g, S.ember)), ...D.day.map((g) => tint(g, S.daylight))], mats.glow, K.frame);
      for (const m of [slateM, plateM, glowM]) if (m) { K.group.add(m); meshes.push(m); }
      // (the floating plates hidden on the lighter presets, as the shader's finer marks are)
      if (plateM && slateM) { plateM.userData.skinFine = true; slateM.onBeforeRender = () => { plateM.visible = sharedUniforms.uWearLite.value < 0.5; }; }
      skin.stats = { ...D.n, signs, ms: Math.round(performance.now() - t0) };
    },
    /** After the kit's flush: the house's own materials back, for its exterior. */
    done() { for (const k of Object.keys(M)) if (!(k in was)) delete M[k]; Object.assign(M, was); K.plan = null; },
  };
  return skin;
}

/**
 * The basin: the geometries of the kit's stone paint inside the great round room's floor (its basin, its spout's
 * muzzle) moved to the basin's own material, patterned round the room's middle.
 */
function moveStone(K, color, mat, room) {
  const c = new THREE.Color(color), moved = [];
  for (const [m, list] of K.batches) {
    if (!m.vertexColors) continue;
    for (let i = list.length - 1; i >= 0; i--) {
      const g = list[i], C = g.attributes.color;
      if (!C || Math.abs(C.getX(0) - c.r) > 1e-3 || Math.abs(C.getY(0) - c.g) > 1e-3 || Math.abs(C.getZ(0) - c.b) > 1e-3) continue;
      g.computeBoundingBox();
      const l = g.boundingBox.clone().applyMatrix4(K.inv), mid = l.getCenter(V());
      if (Math.hypot(mid.x - room.x, mid.z - room.z) > 2 || l.max.y > room.y + 0.5) continue;
      g.deleteAttribute('color');
      moved.push(g); list.splice(i, 1);
    }
  }
  if (moved.length) { if (!K.batches.has(mat)) K.batches.set(mat, []); K.batches.get(mat).push(...moved); }
  return moved.length;
}
