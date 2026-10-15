import * as THREE from 'three';
import { makeMaterial, sharedUniforms } from '../../materials.js';
import { Dish, EchoEar } from '../pieces.js';
import { skinShader, spliceSkin } from './skin-shader.js';

// ---------------------------------------------------------------------------
// The Undertower's futuristic skin (issue #342, docs/systems/temples.md "Futuristic skins"): the makers' first sign's
// foundations drawn as the author's picked references (references/temples/future/undertower/sheet-1.jpg, sheet-2.jpg)
// have them, a quiet test chamber of ancient high technology in dark blue-grey slate, over its rooms as they are: the
// same rooms, doors, collision, pieces, positions, timings and logic (tests/temple-skins.test.js).
//   1. surfaces (the surface shader's albedo, first pen lines and light replaced, as landmark-materials.js stone() does):
//      the walls tall slate panels with few joints (each column's joints set off its own way), chamfered (a lit and a
//      shaded lip) and inked at their seams; the floors and ceilings large plates; thin coral circuit lines inlaid in
//      both, the walls' rising from the floor with a 45° jog to a lens, the floors' along the plates' seams with 45°
//      jogs, lensed at their ends, a slow pulse running along them. They emit a little over the post's halo start
//      (crisp, not blurred). Hatching kept sparse on the slate, as the drawings' shadows are.
//   2. the house's own: its frames dark slate, its courses a darker slate, its slots of market light thin coral slits,
//      its glyphs coral; the singing balls and eggs polished bronze (their rings keep their notes' colours), the
//      fittings brass; the dishes and horns polished brass, the dishes' lenses coral (their materials only); the cable
//      dark; the First Sign brass, a mast on three legs with its listening dish for a head (its colours only).
//   3. machined dressing, drawn only (noCollide, out of the shadow passes, never cut into tiles): tall slate monoliths
//      with a coral slit and a lens along the big rooms' walls; brass collars round the dishes' stands, coral lines up
//      their stems and out across the floor to a lens; the cable pits full of bundled cable with coral sparks running
//      along it where a note goes through. Placed from the kit's record of its walls and rooms (TempleKit.plan), kept
//      clear of every doorway, piece and thing drawn on the walls.
// On the Low, Handheld and Steam Deck presets (uWearLite) the shader leaves out the chamfers, the floors' second set of
// lines and the walls' foot lines, and the floor lines out from the stands and their lenses are hidden.
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
/** m: the dressing's blocks stand this far down into the floor (no face of theirs in the floor's plane: z-fighting) */
const SINK = 0.05;

/** The skin's colours (sRGB) and sizes (m), sampled from the picks (the slate's lit faces, its shade, the brass). */
export const UNDERTOWER_SKIN = {
  wall: { color: '#5b6e82', dark: '#3c4c5e', light: '#8296aa', panel: [2.6, 9.0] },
  floor: { color: '#7a8086', dark: '#555d65', light: '#a0a7ac', plate: [3.2, 2.2] },
  /** the circuits' coral (the house's accent), and how strongly they emit (just over the post's 0.62 halo start) */
  line: '#ff7a50', emit: 0.76,
  trim: '#3c4c5d',               // the frames, lintels and columns: a darker slate
  slab: '#687b8f',               // the monoliths: a paler slate than the walls behind them, as the drawings' pilasters
  band: '#37475a',               // the courses
  dark: '#2a3746',               // the grooves, the cable on the floors
  cable: '#3d4d60',              // the pits' cable: lit a little by its sparks, a blue-grey mass, not a black one
  /** polished brass (the dishes, the horns, the collars, the fittings), lit a little from within to keep its gold in
   *  the slate's shade; the balls and eggs a darker bronze */
  brass: '#c29550', bronze: '#8d7449',
  /** the rooms' light (index.js reads it for the house: the colour script's shade, light and sun inside): the drawings'
   *  shade a clear slate blue, not the house's own deep violet one, its light warm */
  light: { shadow: '#8290ad', light: '#fff0dc', sun: '#ffe2b8' },
  /** the dressing: monoliths along the big rooms' walls (every m, up to n a face, at most h tall) */
  slabs: { every: 9.5, n: 3, w: 1.8, h: 8.6, d: 0.55, minH: 14 },
  /** the cable pits' bundles: how many cables, kept this far off the pillars' line (|x|) */
  cables: { n: 46, clear: 2.9 },
  /** the First Sign's colours (src/temples/guardians.js signModel): a brass mast, a brass listening dish, coral lamps */
  sign: { hull: '#a88d5a', hull2: '#856f48', dark: '#28323d', brass: '#c99758', dish: '#cfa865', lamp: '#ffab85' },
};

// ------------------------------------------------------------------ the surfaces
const PARS = /* glsl */ `
  uniform vec3 uSkinO;
  uniform vec4 uUtRound[4];
  uniform int uUtRoundN;
  uniform vec3 uUtLine;
  uniform vec3 uUtDark;
  uniform vec3 uUtLight;
  uniform vec2 uUtCell;
  uniform float uUtEmit;
`;
const GLSL = /* glsl */ `
  float utH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float utSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0); return length(pa - ba * h); }
  // along a wall (m): round a round room the kit recorded by its angle, else by the face's axis
  float utAlong(vec3 p, vec3 nn) {
    for (int i = 0; i < 4; i++) {
      if (i >= uUtRoundN) break;
      vec4 R = uUtRound[i];
      vec2 d = p.xz - R.xy;
      float r = length(d);
      if (abs(r - R.z) < 2.2 && p.y > R.w - 1.0 && p.y < R.w + 30.0 && abs(dot(nn.xz, d)) > 0.8 * r * length(nn.xz)) return atan(d.y, d.x) * R.z;
    }
    return abs(nn.x) > abs(nn.z) ? p.z : p.x;
  }
  // a wall's line, in a column of two panels (P wide): up the middle of one from the floor, a 45° jog to the next, on
  // up to its lens. x: the distance to the line (m), y: to its lens' middle
  vec2 utWallLine(vec2 q, float P) {
    float Wc = 2.0 * P, c = floor(q.x / Wc), x0 = c * Wc;
    if (utH(vec2(c, 7.13)) > 0.55) return vec2(1e3);
    float xa = x0 + 0.5 * P, xb = x0 + 1.5 * P;
    if (utH(vec2(c, 5.71)) < 0.5) { float s = xa; xa = xb; xb = s; }
    float yj = 0.8 + 2.6 * utH(vec2(c, 9.37)), yt = yj + P + 0.9 + 2.4 * utH(vec2(c, 4.41));
    float d = min(min(utSeg(q, vec2(xa, -40.0), vec2(xa, yj)), utSeg(q, vec2(xa, yj), vec2(xb, yj + P))), utSeg(q, vec2(xb, yj + P), vec2(xb, yt - 0.2)));
    return vec2(d, length(q - vec2(xb, yt)));
  }
  // a floor's lines: rows every S along u, in runs of C (the run on or not), each run its own offset by whole plates
  // (G) from the row's seam, a 45° jog between two runs; ends lensed. x: the distance (m), y: to an end's lens
  vec2 utFloorLine(vec2 p, float S, float C, float G, float seed) {
    float r = floor(p.y / S);
    if (utH(vec2(r, seed)) > 0.62) return vec2(1e3);
    float zc = r * S, i = floor(p.x / C), x0 = i * C, x1 = x0 + C;
    float on0 = step(0.25, utH(vec2(i, r + seed))), onL = step(0.25, utH(vec2(i - 1.0, r + seed))), onR = step(0.25, utH(vec2(i + 1.0, r + seed)));
    float o0 = floor(utH(vec2(i, r * 1.7 + seed)) * 2.999) - 1.0, oL = floor(utH(vec2(i - 1.0, r * 1.7 + seed)) * 2.999) - 1.0, oR = floor(utH(vec2(i + 1.0, r * 1.7 + seed)) * 2.999) - 1.0;
    float z0 = zc + o0 * G, zL = zc + oL * G, zR = zc + oR * G;
    float dL = onL * abs(z0 - zL) * 0.5, dR = onR * abs(zR - z0) * 0.5;
    float d = 1e3, lens = 1e3;
    if (on0 > 0.5) {
      d = utSeg(p, vec2(x0 + dL, z0), vec2(x1 - dR, z0));
      if (onL > 0.5) d = min(d, utSeg(p, vec2(x0 - dL, zL), vec2(x0 + dL, z0))); else lens = length(p - vec2(x0 + 0.6, z0));
      if (onR > 0.5) d = min(d, utSeg(p, vec2(x1 - dR, z0), vec2(x1 + dR, zR))); else lens = min(lens, length(p - vec2(x1 - 0.6, z0)));
    } else {
      // (the next runs' jogs reach into this one)
      if (onL > 0.5) lens = length(p - vec2(x0 - 0.6, zL));
      if (onR > 0.5) lens = min(lens, length(p - vec2(x1 + 0.6, zR)));
    }
    return vec2(d, lens);
  }
  // a line's cover at a distance d (m), fw metres a pixel: w wide, never under a pixel (fainter once it is)
  float utCover(float d, float fw, float w) {
    float ww = max(w, 0.6 * fw);
    return (1.0 - smoothstep(ww - 0.5 * fw, ww + 0.5 * fw, d)) * min(1.0, w / ww);
  }
  float utInk(float px) { float w = 0.5 * uPixelRatio; return 1.0 - smoothstep(w, w + 1.1, px); }
`;

/** Each body replaces the surface's `vec3 albedo = uColor;` (utInkV its first pen lines, utGlow its light). */
const BODIES = {
  wall: /* glsl */ `
    vec3 utP = vWorldPos - uSkinO;
    float utInkV = 0.0, utGlow = 0.0;
    vec3 albedo = uColor;
    {
      bool side = abs(n.y) < 0.65;
      float P = side ? uUtCell.x : 4.8, Hc = side ? uUtCell.y : 4.8;
      vec2 q = side ? vec2(utAlong(utP, n), utP.y) : utP.xz;
      // the panels: columns P wide, joints Hc apart, each column's joints set off its own way; every third column
      // a panel and a half wide (the drawings' slabs are not a grid)
      float col = floor(q.x / P), oy = side ? utH(vec2(col, 3.3)) * Hc : 0.0;
      vec2 c = vec2(q.x / P, (q.y + oy) / Hc), cell = floor(c), f = fract(c);
      vec2 fw2 = fwidth(q), fq = fwidth(c);
      float fw = max(max(fw2.x, fw2.y), 1e-5);
      vec2 em = min(f, 1.0 - f) / max(fq, 1e-5);
      // (a joint across a panel only every other one: tall slabs, few joints)
      if (side && utH(cell + 4.7) < 0.5) em.y = 1e3;
      float far = smoothstep(0.08, 0.2, max(fq.x, fq.y));
      float tone = 0.94 + 0.1 * utH(cell + 11.0) - 0.06 * step(0.85, utH(cell + 2.0));
      albedo = uColor * mix(tone, 1.0, far);
      utInkV = utInk(min(em.x, em.y)) * 0.55 * (1.0 - far);
      if (uWearLite < 0.5) {
        // the chamfers: a lit lip along each slab's top and left edge, a shaded one along its bottom and right
        float b = 0.08;
        vec2 m = f * vec2(P, Hc), M2 = (1.0 - f) * vec2(P, Hc);
        float lit = max(side && em.y > 1e2 ? 0.0 : 1.0 - smoothstep(b - fw, b, M2.y), 1.0 - smoothstep(b - fw, b, m.x));
        float shd = max(side && em.y > 1e2 ? 0.0 : 1.0 - smoothstep(b - fw, b, m.y), 1.0 - smoothstep(b - fw, b, M2.x));
        float k = (1.0 - smoothstep(0.4, 1.0, fw / b));
        albedo = mix(albedo, uUtLight, lit * k * 0.75);
        albedo = mix(albedo, uUtDark, shd * k * 0.8 * (1.0 - lit));
      }
      if (side) {
        vec2 L = utWallLine(q, P);
        float d = L.x;
        // (a foot line along the wall in some stretches)
        if (uWearLite < 0.5 && utH(vec2(floor(q.x / 13.0), 1.9)) < 0.45) d = min(d, abs(fract(q.y / 12.0) * 12.0 - 0.45));
        float ring = abs(L.y - 0.2), dot0 = L.y - 0.07;
        float pulse = 0.85 + 0.15 * sin(uTime * 1.1 - (q.x + q.y) * 0.35);
        float cov = max(utCover(d, fw, 0.026), utCover(ring, fw, 0.03));
        cov = max(cov, (1.0 - smoothstep(0.0, fw, dot0)) * step(L.y, 0.5));
        albedo = mix(albedo, uUtLine * (0.88 + 0.12 * pulse), cov);
        utGlow = cov * uUtEmit * pulse;
        utInkV *= 1.0 - cov;
      }
    }
  `,
  floor: /* glsl */ `
    vec3 utP = vWorldPos - uSkinO;
    float utInkV = 0.0, utGlow = 0.0;
    vec3 albedo = uColor;
    {
      bool top = abs(n.y) > 0.65;
      vec2 q = top ? utP.xz : vec2(abs(n.x) > abs(n.z) ? utP.z : utP.x, utP.y);
      vec2 c = q / uUtCell, cell = floor(c), f = fract(c);
      vec2 fw2 = fwidth(q), fq = fwidth(c);
      float fw = max(max(fw2.x, fw2.y), 1e-5);
      vec2 em = min(f, 1.0 - f) / max(fq, 1e-5);
      float far = smoothstep(0.08, 0.2, max(fq.x, fq.y));
      albedo = uColor * mix(0.94 + 0.09 * utH(cell + 5.0), 1.0, far);
      utInkV = utInk(min(em.x, em.y)) * 0.45 * (1.0 - far);
      if (uWearLite < 0.5) {
        float b = 0.06;
        vec2 m = f * uUtCell, M2 = (1.0 - f) * uUtCell;
        float lit = max(1.0 - smoothstep(b - fw, b, M2.y), 1.0 - smoothstep(b - fw, b, m.x));
        float shd = max(1.0 - smoothstep(b - fw, b, m.y), 1.0 - smoothstep(b - fw, b, M2.x));
        float k = (1.0 - smoothstep(0.4, 1.0, fw / b));
        albedo = mix(albedo, uUtLight, lit * k * 0.55);
        albedo = mix(albedo, uUtDark, shd * k * 0.55 * (1.0 - lit));
      }
      if (top) {
        // the lines along the plates' seams: rows along x (every 3 plates) and, but on the lighter presets, along z
        vec2 A = utFloorLine(q, uUtCell.y * 3.0, uUtCell.x * 3.0, uUtCell.y, 1.3);
        if (uWearLite < 0.5) { vec2 B = utFloorLine(q.yx, uUtCell.x * 4.0, uUtCell.y * 4.0, uUtCell.x, 7.9); A = min(A, B); }
        float pulse = 0.85 + 0.15 * sin(uTime * 1.1 - (q.x + q.y) * 0.35);
        float cov = max(utCover(A.x, fw, 0.034), max(utCover(abs(A.y - 0.2), fw, 0.034), 1.0 - smoothstep(0.08 - fw, 0.08, A.y)));
        albedo = mix(albedo, uUtLine * (0.88 + 0.12 * pulse), cov);
        utGlow = cov * uUtEmit * pulse;
        utInkV *= 1.0 - cov;
      }
    }
  `,
  // the pits' cable: dark, sparks of coral drifting along it where a note runs through
  cable: /* glsl */ `
    vec3 utP = vWorldPos - uSkinO;
    float utInkV = 0.0, utGlow = 0.0;
    vec3 albedo = uColor;
    {
      vec2 q = vec2(utP.z * 1.2 - uTime * 1.6, utP.x * 2.6 + utP.y * 1.3);
      vec2 c = floor(q), f = fract(q) - 0.5;
      float on = step(0.86, utH(c));
      vec2 fw2 = fwidth(q);
      float fw = max(max(fw2.x, fw2.y), 1e-4);
      float cov = on * (1.0 - smoothstep(0.2 - fw, 0.2 + fw, length(f * vec2(0.45, 1.0))));
      albedo = mix(albedo, uUtLine, cov);
      utGlow = cov * uUtEmit;
    }
  `,
};

const EMIT_LINE = 'float emit = 0.0;   // lit windows at night (facade)';
/** The pattern, as data the web's shader and the Unity port's are both made from (skin-shader.js). */
const SHADER = skinShader('undertower', { pars: PARS, glsl: GLSL, bodies: BODIES, ink: 'utInkV', emit: 'utGlow', emitAt: 'line' });

/** The surface material of one of the skin's bodies: makeMaterial's own, its albedo, first pen lines and light the body's. */
function skinMaterial(body, look, S, U, key) {
  const m = makeMaterial({ flat: true, ...look, color: S.color, key: `temple.skin.undertower.${key}` });
  // (this build's rooms and origin: a material from the cache is pointed at them again)
  Object.assign(m.uniforms, { uSkinO: U.origin, uUtRound: U.round, uUtRoundN: U.count });
  if (m.userData.houseSkin) return m;
  m.userData.houseSkin = body;
  spliceSkin(m, SHADER, body, 'undertower.js');
  Object.assign(m.uniforms, {
    uUtLine: { value: new THREE.Color(UNDERTOWER_SKIN.line) }, uUtDark: { value: new THREE.Color(S.dark ?? S.color) }, uUtLight: { value: new THREE.Color(S.light ?? S.color) },
    uUtCell: { value: new THREE.Vector2(...(S.panel ?? S.plate ?? [1, 1])) }, uUtEmit: { value: UNDERTOWER_SKIN.emit },
  });
  return m;
}

// ------------------------------------------------------------------ the dressing's shapes (unit sizes)
/** A lens: a ring and its dot, facing z (radius 1). */
const lensGeometry = () => merge([new THREE.RingGeometry(0.72, 1.0, 20), new THREE.CircleGeometry(0.36, 12)]);
/** A unit box, its foot at y = 0, its back at z = 0 (out of the wall along z). */
const blockGeometry = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0.5).toNonIndexed();
/** A unit box, its foot at y = 0, centred in x and z (a floor strip, a stem's strip). */
const stripGeometry = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0).toNonIndexed();
/**
 * A stand's brass collar (unit: 1 its radius, 1 its height): a machined foot ring stepping in to a collar, as the
 * drawings' pedestals have it.
 */
const collarGeometry = () => new THREE.LatheGeometry([[1.0, 0], [1.0, 0.28], [0.84, 0.34], [0.84, 0.62], [0.66, 0.7], [0.66, 1.0], [0.01, 1.0]].map(([r, y]) => new THREE.Vector2(r, y)), 16);

/** Geometries merged into one (positions and normals). */
function merge(list) {
  const pos = [], nor = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// ------------------------------------------------------------------ placing the dressing
/** Drawn only: walked through, never buried, never casting a shadow, one draw for the whole house (never tiled). */
function drawnOnly(m, name) {
  m.name = `The Undertower skin: ${name}`;
  m.userData.noCollide = true; m.userData.keepBuried = true; m.userData.skin = true;
  m.userData.dynamic = true;
  m.castShadow = false; m.receiveShadow = true;
  m.userData.castShadow = false;   // (out of every shadow pass: shadows.js draws all but those that opt out)
  return m;
}
/** An instanced, drawn-only mesh of the dressing. */
function instanced(name, geo, mat, list, frame) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  m.count = list.length;
  list.forEach((l, i) => m.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(frame, l)));
  m.instanceMatrix.needsUpdate = true;
  drawnOnly(m, name);
  m.computeBoundingSphere();
  return m;
}
/** Drawn-only geometry baked into one mesh: each [geometry, matrices] placed at every one of its matrices. */
function baked(name, parts, mat, frame) {
  const list = [], m4 = new THREE.Matrix4();
  for (const [geo, mats] of parts) for (const l of mats) list.push(geo.clone().applyMatrix4(m4.multiplyMatrices(frame, l)));
  const g = list.length ? merge(list) : new THREE.BufferGeometry();
  const m = drawnOnly(new THREE.Mesh(g, mat), name);
  m.userData.places = parts.map(([, mats]) => mats.map((l) => new THREE.Matrix4().multiplyMatrices(frame, l))).flat();
  if (list.length) g.computeBoundingSphere();
  return m;
}
/** A matrix from a basis (x across, y up, z out of the wall) at p. */
const basis = (p, x, y, z) => new THREE.Matrix4().makeBasis(x, y, z).setPosition(p);

/** Boxes keeping the dressing off something (the kit's local metres), in a grid of cells. */
class Keep {
  constructor() { this.cells = new Map(); this.size = 4; }
  each(b, f) {
    const s = this.size;
    for (let i = Math.floor(b.min.x / s); i <= Math.floor(b.max.x / s); i++) for (let j = Math.floor(b.min.y / s); j <= Math.floor(b.max.y / s); j++) for (let k = Math.floor(b.min.z / s); k <= Math.floor(b.max.z / s); k++) if (f(`${i},${j},${k}`)) return true;
    return false;
  }
  add(b) {
    if (!Number.isFinite(b.min.x + b.max.x + b.min.y + b.max.y + b.min.z + b.max.z)) return;
    this.each(b, (key) => { if (!this.cells.has(key)) this.cells.set(key, []); this.cells.get(key).push(b); });
  }
  hits(b) { return this.each(b, (key) => (this.cells.get(key) ?? []).some((o) => o.intersectsBox(b))); }
}
/** Every small thing drawn on the walls and every piece, as boxes in the kit's frame: what the dressing keeps off. */
function keepOuts(rt, surfaces, { dishes = true } = {}) {
  const K = rt.kit, keep = new Keep(), b = new THREE.Box3();
  const local = (box) => box.clone().applyMatrix4(K.inv);
  for (const [mat, list] of K.batches) {
    if (surfaces.has(mat)) continue;
    for (const g of list) {
      g.computeBoundingBox();
      const l = local(g.boundingBox), s = l.getSize(V());
      if (Math.max(s.x, s.z) < 10.5 && !(s.x > 6 && s.z > 6)) keep.add(l.expandByScalar(0.3));   // (not a floor's slab, a wall's cap or a whole ring)
      else if (s.y < 0.3 && Math.min(s.x, s.z) < 3) keep.add(l.expandByScalar(0.3));   // (but a ball's groove, however long)
    }
  }
  for (const p of rt.pieces) {
    if (!dishes && p instanceof Dish) continue;   // (high on their stands: the floor under them is free)
    // (a pair of dishes has no group of its own: its two ends)
    for (const o of [p.group ?? p.mesh ?? p.root, ...(p.ends ?? []).map((e) => e.g)]) {
      if (!o?.isObject3D) continue;
      b.setFromObject(o); const l = local(b), s = l.getSize(V());
      if (!l.isEmpty() && Math.max(s.x, s.z) < 14 && s.y < 30) keep.add(l.expandByScalar(0.8));
    }
    for (const q of [p.pos, p.center]) if (q?.isVector3) keep.add(new THREE.Box3().setFromCenterAndSize(K.local(q), V(3, 3, 3)));
  }
  return keep;
}

/** The kit's rooms (local): halls, round rooms and passages. */
function roomsOf(plan) {
  const out = [];
  for (const e of plan) {
    if (e.kind === 'hall') out.push({ kind: 'hall', x: e.x, z: e.z, hx: e.w / 2, hz: e.d / 2, y0: e.y, y1: e.y + e.h, e });
    else if (e.kind === 'round' && e.oculus >= 0) out.push({ kind: 'round', x: e.x, z: e.z, r: e.r, y0: e.y, y1: e.y + e.h, e });
    else if (e.kind === 'corridor') out.push({ kind: 'corridor', x: (e.x0 + e.x1) / 2, z: (e.z0 + e.z1) / 2, hx: (e.x1 - e.x0) / 2, hz: (e.z1 - e.z0) / 2, y0: e.y, y1: e.y + e.h, e });
  }
  return out;
}
const inRoom = (R, x, y, z) => y >= R.y0 - 0.5 && y <= R.y1 + 0.5 && (R.kind === 'round' ? Math.hypot(x - R.x, z - R.z) < R.r - 0.2 : Math.abs(x - R.x) < R.hx - 0.1 && Math.abs(z - R.z) < R.hz - 0.1);

/**
 * The straight wall faces looking into a hall (not a passage): { o (the face's foot at its start), t (along), nrm (into
 * the room), s0, s1 (m along), room, holes [{ x0, x1 }] (m along) }.
 */
function faces(plan, rooms) {
  const out = [];
  for (const e of plan) {
    if (e.kind !== 'wall') continue;
    const t = V(e.dir[0], 0, e.dir[1]);
    for (const side of [1, -1]) {
      const nrm = V(e.dir[1], 0, -e.dir[0]).multiplyScalar(side);
      const o = V(e.a[0], e.y0, e.a[1]).addScaledVector(nrm, e.t / 2);
      let cur = null, from = 0;
      const flush = (to) => { if (cur && cur.kind === 'hall' && to - from > 4) out.push({ o, t, nrm, s0: from, s1: to, room: cur, holes: e.holes }); };
      for (let s = 0.25; s <= e.L; s += 0.5) {
        const p = o.clone().addScaledVector(t, s).addScaledVector(nrm, 1.0);
        const R = rooms.find((r) => r.kind !== 'corridor' && Math.abs(r.y0 - e.y0) < 0.5 && inRoom(r, p.x, r.y0 + 1.5, p.z)) ?? null;
        if (R !== cur) { flush(s); cur = R; from = s; }
      }
      flush(e.L);
    }
  }
  return out;
}

/**
 * The floor under a point of a hall (local m): its pit's landings stand over the hall's own floor (rt.skinPits, from the
 * house's layout); over a pit, null (nothing is stood there).
 */
function floorAt(pits, x, z, y0) {
  for (const P of pits) {
    if (x < P.x0 - 1.5 || x > P.x1 + 1.5 || z < P.hz0 - 1.5 || z > P.hz1 + 1.5 || Math.abs(y0 - P.y) > 0.5) continue;
    if (z > P.z0 - 1.0 && z < P.z1 + 1.0) return null;
    return P.floor;
  }
  return y0;
}

function dress(rt, mats, keep, floorKeep, plan, rooms, out) {
  const S = UNDERTOWER_SKIN, K = rt.kit, pits = rt.skinPits ?? [];
  const blocks = [], lenses = [], strips = [], collars = [], floorStrips = [], dots = [];
  const clear = (c, half) => !keep.hits(new THREE.Box3(c.clone().sub(half), c.clone().add(half)));
  /** A monolith at foot p against a wall facing nrm: a tall slate slab on a plinth, a coral slit up it, a lens over it. */
  const slab = (p, t, nrm, h) => {
    const W = S.slabs;
    blocks.push(basis(p.clone().setY(p.y - SINK).addScaledVector(nrm, -0.05), t.clone().multiplyScalar(W.w), V(0, h + SINK, 0), nrm.clone().multiplyScalar(W.d)));
    blocks.push(basis(p.clone().setY(p.y - SINK).addScaledVector(nrm, -0.05), t.clone().multiplyScalar(W.w + 0.5), V(0, 0.45 + SINK, 0), nrm.clone().multiplyScalar(W.d + 0.3)));
    lenses.push(basis(p.clone().setY(p.y + h - 1.2).addScaledVector(nrm, W.d - 0.03), t.clone().multiplyScalar(0.3), V(0, 0.3, 0), nrm.clone().multiplyScalar(1)));
    strips.push(basis(p.clone().setY(p.y + 1.0).addScaledVector(nrm, W.d - 0.04), t.clone().multiplyScalar(0.05), V(0, h - 2.6, 0), nrm.clone().multiplyScalar(0.05)));
  };
  const at = (f, s) => f.o.clone().addScaledVector(f.t, s);
  const freeOf = (f, s, half) => !f.holes.some((h) => s > h.x0 - half - 1.2 && s < h.x1 + half + 1.2);
  // the monoliths along the big halls' walls (on the landings in a pit's hall, none down in the pit)
  for (const f of faces(plan, rooms)) {
    if (f.room.y1 - f.room.y0 < S.slabs.minH) continue;
    let placed = 0;
    const L = f.s1 - f.s0, n = Math.max(1, Math.floor(L / S.slabs.every));
    for (let i = 0; i < n && placed < S.slabs.n; i++) {
      const s = f.s0 + ((i + 0.5) / n) * L, p = at(f, s), y = floorAt(pits, p.x, p.z, p.y);
      if (y === null) continue;
      p.y = y;
      const h = Math.min(S.slabs.h, f.room.y1 - y - 5);
      if (h < 5) continue;
      const c = p.clone().addScaledVector(f.nrm, 0.5).setY(y + h / 2);
      if (!freeOf(f, s, 1.2) || !clear(c, V(1.4, h / 2, 0.7))) continue;
      slab(p, f.t, f.nrm, h); placed++;
      keep.add(new THREE.Box3().setFromCenterAndSize(c, V(2.6, h, 1.6)));
    }
  }
  // the round rooms: a monolith between every few of their stones, clear of their gaps
  for (const r of rooms) {
    if (r.kind !== 'round') continue;
    const e = r.e, seg = e.seg ?? 28, step = TAU / seg, every = Math.max(2, Math.round(seg / 8)), h = Math.min(S.slabs.h, e.h - 5);
    for (let i = 1; i < seg; i += every) {
      const a = i * step;
      if ((e.gaps ?? []).some((g) => Math.abs(Math.atan2(Math.sin(a - g.a), Math.cos(a - g.a))) * e.r < g.w / 2 + 2.4)) continue;
      const out_ = V(Math.sin(a), 0, Math.cos(a)), nrm = out_.clone().negate(), t = V(Math.cos(a), 0, -Math.sin(a)).negate();
      const p = V(e.x, e.y, e.z).addScaledVector(out_, e.r * Math.cos(Math.PI / seg) - 0.02);
      const c = p.clone().addScaledVector(nrm, 0.5).setY(e.y + h / 2);
      if (!clear(c, V(1.4, h / 2, 0.7))) continue;
      slab(p, t, nrm, h);
      keep.add(new THREE.Box3().setFromCenterAndSize(c, V(2.6, h, 1.6)));
    }
  }
  // the dishes' stands (rt.skinStands, from the house's layout: { x, z, y, h }): a brass collar round the foot, coral
  // lines up the stem's two faces, and across the floor from the collar to a lens, where the floor is clear
  const X = V(1, 0, 0), Y = V(0, 1, 0), Z = V(0, 0, 1);
  for (const st of rt.skinStands ?? []) {
    collars.push(basis(V(st.x, st.y - SINK, st.z), X.clone().multiplyScalar(0.86), Y.clone().multiplyScalar(0.62 + SINK), Z.clone().multiplyScalar(0.86)));
    for (const sx of [-1, 1]) strips.push(basis(V(st.x, st.y + 0.6, st.z + sx * 0.31), X.clone().multiplyScalar(0.05), Y.clone().multiplyScalar(Math.max(0.3, st.h - 0.95)), Z.clone().multiplyScalar(0.03)));
    let n = 0;
    for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      if (n >= 2) break;
      const d = V(dx, 0, dz), Lr = 3.6, a = V(st.x, st.y, st.z).addScaledVector(d, 1.0), b = V(st.x, st.y, st.z).addScaledVector(d, 1.0 + Lr);
      // (its own stand and collar not counted: from 1.6 m out)
      const box = new THREE.Box3().setFromPoints([V(st.x, st.y, st.z).addScaledVector(d, 1.6), b]).expandByVector(V(0.3, 0, 0.3)); box.min.y = st.y; box.max.y = st.y + 0.6;
      if (floorKeep.hits(box)) continue;
      const mid = a.clone().lerp(b, 0.5), across = V(dz, 0, -dx);
      floorStrips.push(basis(mid.setY(st.y - 0.02), across.multiplyScalar(0.05), Y.clone().multiplyScalar(0.032), d.clone().multiplyScalar(Lr + 0.2)));
      dots.push(basis(b.clone().setY(st.y + 0.013), V(0.13, 0, 0), V(0, 0, -0.13), V(0, 1, 0)));
      n++;
    }
  }
  out.push(instanced('slate monoliths', blockGeometry(), mats.slate, blocks, K.frame));
  out.push(instanced('brass collars', collarGeometry(), mats.brass, collars, K.frame));
  // the lights in one mesh (the lenses and the slits), and the finest in another (the lines out across the floor and
  // their lenses, left out on the lighter presets): a draw each (the Deck is held by its draws)
  out.push(baked('lenses and lit strips', [[lensGeometry(), lenses], [blockGeometry(), strips]], mats.glow, K.frame));
  const fine = baked('floor lines and lenses', [[stripGeometry(), floorStrips], [lensGeometry(), dots]], mats.glow, K.frame); fine.userData.skinFine = true; out.push(fine);
  const cables = pitCables(rt, pits, mats.cable);
  if (cables) out.push(cables);
  return { slabs: lenses.length, stands: collars.length, lines: floorStrips.length, cables: cables?.userData.cables ?? 0, strips: strips.length };
}

/**
 * The cable pits full of the makers' old cable (rt.skinPits: { x0, x1, z0, z1 (the pit), y (its floor), floor (the
 * landings') }): bundles out of the pit's near wall, down to its floor, along it and up the far wall, kept off the
 * pillars' line (|x| < clear); one drawn-only mesh for every pit, its sparks the cable material's.
 */
function pitCables(rt, pits, mat) {
  const S = UNDERTOWER_SKIN.cables, geos = [];
  let n = 0;
  for (const P of pits) {
    const rnd = mulberry(Math.round(P.z0 * 10));
    const deep = P.floor - P.y;
    for (let i = 0; i < S.n; i++) {
      let x = P.x0 + 1 + rnd() * (P.x1 - P.x0 - 2);
      if (Math.abs(x) < S.clear) x = Math.sign(x || 1) * (S.clear + rnd() * 1.5);
      // (out of the near wall a little way up, down its face, along the floor in a bundle, up the far wall's face into it)
      const r = 0.14 + rnd() * 0.2, lay = P.y + r + rnd() * 0.7, drift = (rnd() - 0.5) * 3, Lz = P.z1 - P.z0;
      const h0 = P.y + deep * (0.12 + rnd() * 0.22), h1 = P.y + deep * (0.12 + rnd() * 0.22), w0 = P.z0 + r + 0.05, w1 = P.z1 - r - 0.05;
      const pts = [V(x, h0, P.z0 - 0.3), V(x, h0 - 0.4, w0), V(x + drift * 0.1, lay + 0.6, w0 + 0.5), V(x + drift * 0.4, lay, P.z0 + Lz * 0.3), V(x + drift * 0.7, lay + 0.1, P.z0 + Lz * 0.7), V(x + drift, lay + 0.6, w1 - 0.5), V(x + drift, h1 - 0.4, w1), V(x + drift, h1, P.z1 + 0.3)];
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 22, r, 5));
      n++;
    }
  }
  if (!geos.length) return null;
  const g = merge(geos);
  for (const x of geos) x.dispose();
  g.applyMatrix4(rt.kit.frame);
  const m = drawnOnly(new THREE.Mesh(g, mat), 'cable in the pits');
  m.userData.cables = n;
  g.computeBoundingSphere();
  return m;
}
/** A small seeded random (the cables' layout the same every build). */
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * The house's dishes and horns in the skin's brass (drawn only: their materials swapped, their meshes, logic and lights
 * as they were): a dish's cream bowl, its rim and post, its lens coral; a horn's bell and its stand (its ring keeps
 * its note's colour).
 */
function brassPieces(rt, mats) {
  const trim = mats.brass, coral = new THREE.Color(UNDERTOWER_SKIN.line);
  for (const p of rt.pieces) {
    if (!(p instanceof Dish || p instanceof EchoEar)) continue;
    for (const g of p.group ? [p.group] : (p.ends ?? []).map((e) => e.g)) g?.traverse((o) => { if (o.isMesh && (p instanceof EchoEar ? o.material !== p.glow : o.material === trim || o.material === p.cream)) o.material = mats.brass; });
    if (p instanceof Dish) p.glow?.uniforms?.uColor?.value?.copy?.(coral);
  }
}

/** The finest dressing hidden on the lighter presets (uWearLite), and the dressing's lights breathing. */
class SkinLife {
  constructor(meshes, glow) { this.fine = meshes.filter((m) => m.userData.skinFine); this.glow = glow; }
  update(dt, t) {
    const on = sharedUniforms.uWearLite.value < 0.5;
    for (const m of this.fine) if (m.visible !== on) m.visible = on;
    this.glow.uniforms.uGlow.value = 0.74 + 0.05 * Math.sin(t * 1.1);
  }
}

// ------------------------------------------------------------------ the skin
/**
 * The Undertower's skin (its def's `skin`, src/temples/skins/index.js): its surfaces swapped into rt.M (the kit and the
 * pieces share it), the kit's plan recording, the stands' and pits' records (rt.skinStands, rt.skinPits: bazaar.js).
 */
export function undertowerSkin(rt) {
  const S = UNDERTOWER_SKIN, K = rt.kit, M = rt.M;
  // (the house's look, its shade deeper: the drawings' slate is dark, its shade strong; the hatching sparse)
  const look = { ...(rt.def.palette?.look?.all ?? {}), shade: 0.02, shadeFlat: 0 };
  const U = {
    origin: { value: K.origin.clone() },
    round: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
    count: { value: 0 },
  };
  const was = { wall: M.wall, wallGlyph: M.wallGlyph, floor: M.floor, trim: M.trim, trimMat: M.trimMat, stoneMat: M.stoneMat, dark: M.dark, bands: M.bands, ornament: M.ornament, glyph: M.glyph };
  const own = (k, o) => makeMaterial({ flat: true, ...o, key: `temple.skin.undertower.${k}` });
  const glow = own('glow', { color: S.line, glow: 0.76, side: THREE.DoubleSide });
  // (a soft polish, as drawn: the metal's banded reflection kept low, or the flat-shaded bowls break into stripes)
  const brass = { flat: false, metal: 'brass', refl: 0.28, highlight: 0.25, glow: 0.3, shade: 0.15, shadeFlat: 0, hatch: 0.2, side: THREE.DoubleSide };
  const mats = {
    wall: skinMaterial('wall', { ...look, hatch: 0.15 }, S.wall, U, 'wall'),
    wallGlyph: skinMaterial('wall', { ...look, hatch: 0.15, glyphs: 1.6 }, S.wall, U, 'wallGlyph'),
    floor: skinMaterial('floor', { ...look, hatch: 0.45 }, S.floor, U, 'floor'),
    cable: skinMaterial('cable', { shade: 0.1, shadeFlat: 0, hatch: 0.3, glow: 0.12 }, { color: S.cable }, U, 'cable'),
    // (paints, as the house's own frames and courses are: in the kit's one paint mesh, no draw of their own)
    trim: { paint: new THREE.Color(S.trim), smooth: false, side: THREE.FrontSide },
    band: { paint: new THREE.Color(S.band), smooth: false, side: THREE.FrontSide },
    glyph: own('glyph', { color: S.line, glow: 0.78 }),
    slot: own('slot', { color: S.line, glow: 0.74 }),
    glow,
    slate: own('slate', { ...look, color: S.slab, hatch: 0.15, side: THREE.DoubleSide }),
    brass: own('brass', { ...brass, color: S.brass }),
    bronze: own('bronze', { ...brass, color: S.bronze, glow: 0.2, refl: 0.35, highlight: 0.35 }),
  };
  Object.assign(M, {
    wall: mats.wall, wallGlyph: mats.wallGlyph, floor: mats.floor, trim: mats.trim, glyph: mats.glyph,
    trimMat: mats.brass, stoneMat: mats.bronze, dark: { paint: new THREE.Color(S.dark), smooth: false, side: THREE.FrontSide },
    bands: [{ at: 0.72, h: 0.5, mat: mats.band }],
    ornament: { kind: 'slot', mats: { a: mats.slot, b: mats.slot } },
  });
  K.plan = [];
  rt.skinStands = []; rt.skinPits = [];
  const meshes = [];
  const skin = {
    name: 'undertower', S, mats, meshes, stats: null, sign: S.sign, light: S.light,
    /** After the layout: the round rooms handed to the shader, the dressing placed and added. */
    dress() {
      const t0 = performance.now(), plan = K.plan, rooms = roomsOf(plan);
      const round = rooms.filter((r) => r.kind === 'round').slice(0, 4);
      round.forEach((r, i) => U.round.value[i].set(r.x, r.z, r.r, r.y0));
      U.count.value = round.length;
      const surfaces = new Set([mats.wall, mats.wallGlyph, mats.floor, M.bands[0].mat, M.sand]);
      const keep = keepOuts(rt, surfaces), floorKeep = keepOuts(rt, surfaces, { dishes: false });
      skin.stats = { ...dress(rt, mats, keep, floorKeep, plan, rooms, meshes), ms: Math.round(performance.now() - t0) };
      for (const m of meshes) K.group.add(m);
      brassPieces(rt, mats);
      rt.pieces.push(new SkinLife(meshes, glow));
    },
    /** After the kit's flush: the lit things out of the shadow passes, the house's own materials back for its exterior. */
    done() {
      for (const m of K.group.children) if (m.material === mats.glyph || m.material === mats.slot) { m.castShadow = false; m.userData.castShadow = false; }
      Object.assign(M, was); K.plan = null;
    },
  };
  return skin;
}
