import * as THREE from 'three';
import { makeMaterial, sharedUniforms } from '../../materials.js';
import { metal } from '../landmark-materials.js';

// ---------------------------------------------------------------------------
// The Whale-House's futuristic skin (issue #342, docs/systems/temples.md "Futuristic skins"): the makers' sounding-house
// drawn as the author's picked references (references/temples/future/whale-house/sheet-1.jpg, sheet-2.jpg) have it, an
// ancient high-tech test chamber of dark sage slate, over its rooms as they are: the same rooms, doors, collision,
// pieces, positions, timings and logic (tests/temple-skins.test.js).
//   1. surfaces (the surface shader's albedo and first pen lines replaced, as landmark-materials.js stone() does):
//      the walls tall slate slabs in staggered courses with chamfered edges (a lit and a shaded lip) and pen seams;
//      the floors and ceilings plates; thin aquamarine circuit lines inlaid in both, the walls' rising from the
//      floor with a 45° jog to a lens, the floors' running along the plates' seams with 45° jogs, a slow pulse
//      travelling along them. The lines are emissive (the post's bloom gives them their halo, as lamps have).
//   2. the house's own colours: its frames and lintels dark metal, its coral courses gone for a dark slate one, its
//      whorled shells' chambers dark metal and brass orbs and their coral rings glowing aquamarine rings, the frieze's
//      shell a lens terminal (an aquamarine disc in a brass ring), the sea behind the glass deep blue.
//   3. machined dressing, drawn only (InstancedMeshes: noCollide, out of the shadow passes, never cut into tiles):
//      rows of brass horn terminals on slate footings along one wall of each big room, tall slate listening slabs with
//      a glowing ring lens and a lit strip, a glowing edge along the foot of the great windows. Placed from the kit's
//      record of its walls and rooms (TempleKit.plan), kept clear of every doorway, piece and thing drawn on the walls.
// On the Low, Handheld and Steam Deck presets (uWearLite) the shader leaves out the chamfers, the floors' second set of
// lines and the walls' foot lines, and the horns' dark mouths are hidden.
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
/** m: the dressing's blocks stand this far down into the floor (no face of theirs in the floor's plane: z-fighting) */
const SINK = 0.05;

/** The skin's colours (sRGB) and sizes (m). */
export const WHALE_SKIN = {
  wall: { color: '#5c7a6f', dark: '#3a524b', light: '#85a296', panel: [1.9, 7.5] },
  floor: { color: '#73897f', dark: '#4f655d', light: '#93a99d', plate: [3.0, 2.0] },
  line: '#63f2dc',
  trim: '#36474a',               // the frames, lintels and columns: dark metal
  band: '#3d544d',               // a dark slate course where the coral one ran
  orb: '#5b6d6c', orb2: '#c9973f',
  sea: '#2b6796', deep: '#1d4a70',
  slate: '#526b62', mouth: '#0b1213',
  /** the dressing: horn terminals (every m, up to n on one wall of a room), listening slabs (every m along the rest) */
  horns: { every: 2.7, n: 7, minH: 12, shelf: 6.4 },
  slabs: { every: 11, n: 4, w: 1.5, h: 6.2, d: 0.5, minH: 12 },
};

// ------------------------------------------------------------------ the surfaces
const PARS = /* glsl */ `
  uniform vec3 uSkinO;
  uniform vec4 uWhRound[4];
  uniform int uWhRoundN;
  uniform vec3 uWhLine;
  uniform vec3 uWhDark;
  uniform vec3 uWhLight;
  uniform vec2 uWhCell;
`;
const GLSL = /* glsl */ `
  float whH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float whSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0); return length(pa - ba * h); }
  // along a wall (m): round a round room the kit recorded by its angle, else by the face's axis
  float whAlong(vec3 p, vec3 nn) {
    for (int i = 0; i < 4; i++) {
      if (i >= uWhRoundN) break;
      vec4 R = uWhRound[i];
      vec2 d = p.xz - R.xy;
      float r = length(d);
      if (abs(r - R.z) < 2.2 && p.y > R.w - 1.0 && p.y < R.w + 30.0 && abs(dot(nn.xz, d)) > 0.8 * r * length(nn.xz)) return atan(d.y, d.x) * R.z;
    }
    return abs(nn.x) > abs(nn.z) ? p.z : p.x;
  }
  // a wall's line, in a column of two panels (P wide): up the middle of one from the floor, a 45° jog to the next, on
  // up to its lens. x: the distance to the line (m), y: to its lens' middle
  vec2 whWallLine(vec2 q, float P) {
    float Wc = 2.0 * P, c = floor(q.x / Wc), x0 = c * Wc;
    if (whH(vec2(c, 7.13)) > 0.75) return vec2(1e3);
    float xa = x0 + 0.5 * P, xb = x0 + 1.5 * P;
    if (whH(vec2(c, 5.71)) < 0.5) { float s = xa; xa = xb; xb = s; }
    float yj = 0.9 + 3.2 * whH(vec2(c, 9.37)), yt = yj + P + 0.8 + 2.6 * whH(vec2(c, 4.41));
    float d = min(min(whSeg(q, vec2(xa, -2.0), vec2(xa, yj)), whSeg(q, vec2(xa, yj), vec2(xb, yj + P))), whSeg(q, vec2(xb, yj + P), vec2(xb, yt - 0.2)));
    return vec2(d, length(q - vec2(xb, yt)));
  }
  // a floor's lines: rows every S along u, in runs of C (the run on or not), each run its own offset by whole plates
  // (G) from the row's seam, a 45° jog between two runs; ends lensed. x: the distance (m), y: to an end's lens
  vec2 whFloorLine(vec2 p, float S, float C, float G, float seed) {
    float r = floor(p.y / S);
    if (whH(vec2(r, seed)) > 0.7) return vec2(1e3);
    float zc = r * S, i = floor(p.x / C), x0 = i * C, x1 = x0 + C;
    float on0 = step(0.22, whH(vec2(i, r + seed))), onL = step(0.22, whH(vec2(i - 1.0, r + seed))), onR = step(0.22, whH(vec2(i + 1.0, r + seed)));
    float o0 = floor(whH(vec2(i, r * 1.7 + seed)) * 2.999) - 1.0, oL = floor(whH(vec2(i - 1.0, r * 1.7 + seed)) * 2.999) - 1.0, oR = floor(whH(vec2(i + 1.0, r * 1.7 + seed)) * 2.999) - 1.0;
    float z0 = zc + o0 * G, zL = zc + oL * G, zR = zc + oR * G;
    float dL = onL * abs(z0 - zL) * 0.5, dR = onR * abs(zR - z0) * 0.5;
    float d = 1e3, lens = 1e3;
    if (on0 > 0.5) {
      d = whSeg(p, vec2(x0 + dL, z0), vec2(x1 - dR, z0));
      if (onL > 0.5) d = min(d, whSeg(p, vec2(x0 - dL, zL), vec2(x0 + dL, z0))); else lens = length(p - vec2(x0 + 0.6, z0));
      if (onR > 0.5) d = min(d, whSeg(p, vec2(x1 - dR, z0), vec2(x1 + dR, zR))); else lens = min(lens, length(p - vec2(x1 - 0.6, z0)));
    } else {
      // (the next runs' jogs reach into this one)
      if (onL > 0.5) lens = length(p - vec2(x0 - 0.6, zL));
      if (onR > 0.5) lens = min(lens, length(p - vec2(x1 + 0.6, zR)));
    }
    return vec2(d, lens);
  }
  // a line's cover at a distance d (m), fw metres a pixel: 3 cm wide, never under a pixel (fainter once it is)
  float whCover(float d, float fw, float w) {
    float ww = max(w, 0.6 * fw);
    return (1.0 - smoothstep(ww - 0.5 * fw, ww + 0.5 * fw, d)) * min(1.0, w / ww);
  }
  float whInk(float px) { float w = 0.5 * uPixelRatio; return 1.0 - smoothstep(w, w + 1.1, px); }
`;

/** Each body replaces the surface's `vec3 albedo = uColor;` (whInk its first pen lines, whGlow its light). */
const BODIES = {
  wall: /* glsl */ `
    vec3 whP = vWorldPos - uSkinO;
    float whInkV = 0.0, whGlow = 0.0;
    vec3 albedo = uColor;
    {
      bool side = abs(n.y) < 0.65;
      float P = side ? uWhCell.x : 4.8, Hc = side ? uWhCell.y : 4.8;
      vec2 q = side ? vec2(whAlong(whP, n), whP.y - (whP.y < -3.0 ? -24.0 : 0.0)) : whP.xz;
      // the slabs: columns P wide, courses Hc high, each column's courses set off its own way
      float col = floor(q.x / P), oy = side ? whH(vec2(col, 3.3)) * Hc : 0.0;
      vec2 c = vec2(q.x / P, (q.y + oy) / Hc), cell = floor(c), f = fract(c);
      vec2 fw2 = fwidth(q), fq = fwidth(c);
      float fw = max(max(fw2.x, fw2.y), 1e-5);
      vec2 em = min(f, 1.0 - f) / max(fq, 1e-5);
      float far = smoothstep(0.08, 0.2, max(fq.x, fq.y));
      float tone = 0.93 + 0.12 * whH(cell + 11.0) - 0.07 * step(0.86, whH(cell + 2.0));
      albedo = uColor * mix(tone, 1.0, far);
      whInkV = whInk(min(em.x, em.y)) * 0.5 * (1.0 - far);
      if (uWearLite < 0.5) {
        // the chamfers: a lit lip along each slab's top and left edge, a shaded one along its bottom and right
        float b = 0.07;
        vec2 m = f * vec2(P, Hc), M2 = (1.0 - f) * vec2(P, Hc);
        float lit = max(1.0 - smoothstep(b - fw, b, M2.y), 1.0 - smoothstep(b - fw, b, m.x));
        float shd = max(1.0 - smoothstep(b - fw, b, m.y), 1.0 - smoothstep(b - fw, b, M2.x));
        float k = (1.0 - smoothstep(0.4, 1.0, fw / b));
        albedo = mix(albedo, uWhLight, lit * k * 0.8);
        albedo = mix(albedo, uWhDark, shd * k * 0.8 * (1.0 - lit));
      }
      if (side) {
        vec2 L = whWallLine(q, P);
        float d = L.x;
        // (a foot line along the wall in some stretches)
        if (uWearLite < 0.5 && whH(vec2(floor(q.x / 13.0), 1.9)) < 0.5) d = min(d, abs(q.y - 0.45));
        float ring = abs(L.y - 0.22), dot0 = L.y - 0.07;
        float pulse = 0.8 + 0.2 * sin(uTime * 1.1 - (q.x + q.y) * 0.35);
        float cov = max(max(whCover(d, fw, 0.022), whCover(ring, fw, 0.03)), whCover(max(dot0, 0.0), fw, 0.001) * step(dot0, 0.0));
        cov = max(cov, (1.0 - smoothstep(0.0, fw, dot0)) * step(L.y, 0.5));
        albedo = mix(albedo, uWhLine * (0.85 + 0.15 * pulse), cov);
        whGlow = cov * pulse;
        whInkV *= 1.0 - cov;
      }
    }
  `,
  floor: /* glsl */ `
    vec3 whP = vWorldPos - uSkinO;
    float whInkV = 0.0, whGlow = 0.0;
    vec3 albedo = uColor;
    {
      bool top = abs(n.y) > 0.65;
      vec2 q = top ? whP.xz : vec2(abs(n.x) > abs(n.z) ? whP.z : whP.x, whP.y);
      vec2 c = q / uWhCell, cell = floor(c), f = fract(c);
      vec2 fw2 = fwidth(q), fq = fwidth(c);
      float fw = max(max(fw2.x, fw2.y), 1e-5);
      vec2 em = min(f, 1.0 - f) / max(fq, 1e-5);
      float far = smoothstep(0.08, 0.2, max(fq.x, fq.y));
      albedo = uColor * mix(0.94 + 0.1 * whH(cell + 5.0), 1.0, far);
      whInkV = whInk(min(em.x, em.y)) * 0.45 * (1.0 - far);
      if (uWearLite < 0.5) {
        float b = 0.06;
        vec2 m = f * uWhCell, M2 = (1.0 - f) * uWhCell;
        float lit = max(1.0 - smoothstep(b - fw, b, M2.y), 1.0 - smoothstep(b - fw, b, m.x));
        float shd = max(1.0 - smoothstep(b - fw, b, m.y), 1.0 - smoothstep(b - fw, b, M2.x));
        float k = (1.0 - smoothstep(0.4, 1.0, fw / b));
        albedo = mix(albedo, uWhLight, lit * k * 0.55);
        albedo = mix(albedo, uWhDark, shd * k * 0.55 * (1.0 - lit));
      }
      if (top) {
        // the lines along the plates' seams: rows along x (every 4 plates) and, but on the lighter presets, along z
        vec2 A = whFloorLine(q, uWhCell.y * 4.0, uWhCell.x * 3.0, uWhCell.y, 1.3);
        if (uWearLite < 0.5) { vec2 B = whFloorLine(q.yx, uWhCell.x * 4.0, uWhCell.y * 4.0, uWhCell.x, 7.9); A = min(A, B); }
        float pulse = 0.8 + 0.2 * sin(uTime * 1.1 - (q.x + q.y) * 0.35);
        float cov = max(whCover(A.x, fw, 0.026), max(whCover(abs(A.y - 0.2), fw, 0.03), 1.0 - smoothstep(0.07 - fw, 0.07, A.y)));
        albedo = mix(albedo, uWhLine * (0.85 + 0.15 * pulse), cov);
        whGlow = cov * pulse;
        whInkV *= 1.0 - cov;
      }
    }
  `,
};

const EMIT_LINE = 'float emit = 0.0;   // lit windows at night (facade)';
/** The surface material of one of the skin's bodies: makeMaterial's own, its albedo, first pen lines and light the body's. */
function skinMaterial(body, look, S, U, key) {
  const m = makeMaterial({ flat: true, ...look, color: S.color, key: `temple.skin.whale.${key}` });
  // (this build's rooms and origin: a material from the cache is pointed at them again)
  Object.assign(m.uniforms, { uSkinO: U.origin, uWhRound: U.round, uWhRoundN: U.count });
  if (m.userData.houseSkin) return m;
  m.userData.houseSkin = body;
  const fs = m.fragmentShader, at = fs.lastIndexOf('void main()');
  if (at < 0 || !fs.includes('vec3 albedo = uColor;') || !fs.includes('float detail = 0.0;') || !fs.includes(EMIT_LINE)) throw new Error('whale-house.js: the surface shader changed: no albedo, emit or detail line to replace');
  m.fragmentShader = PARS + fs.slice(0, at) + GLSL + fs.slice(at).replace('vec3 albedo = uColor;', BODIES[body]).replace(EMIT_LINE, 'float emit = whGlow;').replace('float detail = 0.0;', 'float detail = whInkV;');
  Object.assign(m.uniforms, {
    uWhLine: { value: new THREE.Color(WHALE_SKIN.line) }, uWhDark: { value: new THREE.Color(S.dark) }, uWhLight: { value: new THREE.Color(S.light) },
    uWhCell: { value: new THREE.Vector2(...(S.panel ?? S.plate)) },
  });
  return m;
}

// ------------------------------------------------------------------ the dressing's shapes (unit sizes)
/** A horn terminal's brass: a post up its footing's back, a collar, a bell opening out of the wall (z), 1 its mouth's radius. */
function hornGeometry() {
  const bell = new THREE.LatheGeometry([[0.32, 0], [0.36, 0.25], [0.5, 0.5], [0.78, 0.75], [1.0, 0.9], [1.0, 1.0], [0.86, 0.96]].map(([r, y]) => new THREE.Vector2(r, y)), 14).rotateX(Math.PI / 2).translate(0, 0, 0.2);
  const collar = new THREE.TorusGeometry(0.42, 0.1, 4, 14).translate(0, 0, 0.3);
  const post = new THREE.CylinderGeometry(0.16, 0.2, 1.2, 8).translate(0, -0.9, 0.1);
  return merge([bell, collar, post]);
}
/** A horn's dark mouth, a disc a little inside its bell's rim. */
const mouthGeometry = () => new THREE.CircleGeometry(0.88, 14).translate(0, 0, 1.12).toNonIndexed();
/** A lens: a ring and its dot, facing z (radius 1). */
const lensGeometry = () => merge([new THREE.RingGeometry(0.72, 1.0, 20), new THREE.CircleGeometry(0.36, 12)]);
/** A unit box, its foot at y = 0, its back at z = 0 (out of the wall along z). */
const blockGeometry = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0.5).toNonIndexed();

function merge(list) {
  const pos = [], nor = [];
  for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; if (!g.attributes.normal) g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// ------------------------------------------------------------------ placing the dressing
/** An instanced, drawn-only mesh of the dressing: walked through, never buried, never casting a shadow. */
function instanced(name, geo, mat, list, frame) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  m.name = `The Whale-House skin: ${name}`; m.count = list.length;
  list.forEach((l, i) => m.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(frame, l)));
  m.instanceMatrix.needsUpdate = true;
  m.userData.noCollide = true; m.userData.keepBuried = true; m.userData.skin = true;
  // (one draw a pass for the whole house's, never cut into tiles nor given levels of detail: perf.js, lod.js)
  m.userData.dynamic = true;
  m.castShadow = false; m.receiveShadow = true;
  m.userData.castShadow = false;   // (out of every shadow pass: shadows.js draws all but those that opt out)
  m.computeBoundingSphere();
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
function keepOuts(rt, surfaces) {
  const K = rt.kit, keep = new Keep(), b = new THREE.Box3();
  const local = (box) => box.clone().applyMatrix4(K.inv);
  for (const [mat, list] of K.batches) {
    if (surfaces.has(mat)) continue;
    for (const g of list) {
      g.computeBoundingBox();
      const l = local(g.boundingBox), s = l.getSize(V());
      if (Math.max(s.x, s.z) < 10.5 && !(s.x > 6 && s.z > 6)) keep.add(l.expandByScalar(0.3));   // (not a floor's slab, a wall's cap or a whole ring)
    }
  }
  for (const p of rt.pieces) {
    const o = p.group ?? p.mesh ?? p.root;
    if (o?.isObject3D) { b.setFromObject(o); const l = local(b), s = l.getSize(V()); if (!l.isEmpty() && Math.max(s.x, s.z) < 14 && s.y < 30) keep.add(l.expandByScalar(0.8)); }
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

function dress(rt, mats, keep, plan, rooms, out) {
  const S = WHALE_SKIN, K = rt.kit;
  const blocks = [], horns = [], mouths = [], lenses = [], strips = [], shelves = [], frames = [];
  const clear = (c, half) => !keep.hits(new THREE.Box3(c.clone().sub(half), c.clone().add(half)));
  const used = new Set();
  /** A horn terminal at foot p on a wall facing nrm: a slate footing, the brass horn on it, its lens. */
  const horn = (p, t, nrm, top) => {
    blocks.push(basis(p.clone().setY(p.y - SINK).addScaledVector(nrm, -0.05), t.clone().multiplyScalar(1.15), V(0, 1.0 + SINK, 0), nrm.clone().multiplyScalar(0.95)));
    const m = p.clone().setY(p.y + 1.72).addScaledVector(nrm, 0.05);
    horns.push(basis(m, t.clone().multiplyScalar(0.62), V(0, 0.62, 0), nrm.clone().multiplyScalar(0.72)));
    mouths.push(basis(m, t.clone().multiplyScalar(0.62), V(0, 0.62, 0), nrm.clone().multiplyScalar(0.72)));
    lenses.push(basis(p.clone().setY(p.y + 0.55).addScaledVector(nrm, 0.92), t.clone().multiplyScalar(0.12), V(0, 0.12, 0), nrm.clone().multiplyScalar(1)));
    // its circuit: down the wall from the shelf (or high up) to its footing
    strips.push(basis(p.clone().setY(p.y + 1.0), t.clone().multiplyScalar(0.045), V(0, (top ?? p.y + 6) - p.y - 1.0, 0), nrm.clone().multiplyScalar(0.03)));
  };
  /** A listening slab at foot p: a tall slate block, a ring lens high on it, a lit strip down from the lens. */
  const slab = (p, t, nrm) => {
    const W = S.slabs;
    blocks.push(basis(p.clone().setY(p.y - SINK).addScaledVector(nrm, -0.05), t.clone().multiplyScalar(W.w), V(0, W.h + SINK, 0), nrm.clone().multiplyScalar(W.d)));
    blocks.push(basis(p.clone().setY(p.y - SINK).addScaledVector(nrm, -0.05), t.clone().multiplyScalar(W.w + 0.5), V(0, 0.5 + SINK, 0), nrm.clone().multiplyScalar(W.d + 0.3)));
    lenses.push(basis(p.clone().setY(p.y + W.h - 1.3).addScaledVector(nrm, W.d - 0.03), t.clone().multiplyScalar(0.34), V(0, 0.34, 0), nrm.clone().multiplyScalar(1)));
    strips.push(basis(p.clone().setY(p.y + 0.9).addScaledVector(nrm, W.d - 0.04), t.clone().multiplyScalar(0.06), V(0, W.h - 2.6, 0), nrm.clone().multiplyScalar(0.05)));
  };
  const at = (f, s) => f.o.clone().addScaledVector(f.t, s);
  const freeOf = (f, s, half) => !f.holes.some((h) => s > h.x0 - half - 1.2 && s < h.x1 + half + 1.2);
  const F = faces(plan, rooms);
  // the horn terminals: in each big hall, a row along its longest clear wall
  for (const r of rooms) {
    if (r.kind !== 'hall' || r.y1 - r.y0 < S.horns.minH) continue;
    let best = null;
    for (const f of F.filter((g) => g.room === r)) {
      // the longest run of clear spots along this face
      let run = [], top = [];
      for (let s = f.s0 + 2; s <= f.s1 - 2; s += S.horns.every) {
        const p = at(f, s), c = p.clone().addScaledVector(f.nrm, 0.6).setY(p.y + 1.6);
        if (freeOf(f, s, 0.6) && clear(c, V(0.9, 1.6, 0.9))) { run.push([s, p]); if (run.length > top.length) top = run.slice(); } else run = [];
      }
      if (top.length > (best?.spots.length ?? 1)) best = { f, spots: top };
    }
    if (!best) continue;
    const n = Math.min(S.horns.n, best.spots.length), k0 = Math.floor((best.spots.length - n) / 2);
    const row = best.spots.slice(k0, k0 + n), f = best.f;
    const [sa] = row[0], [sb] = row[row.length - 1];
    // the shelf over them, brass dish horns on it (as drawn): when its stretch of wall is clear that high
    const y0 = f.o.y, ys = y0 + S.horns.shelf, a0 = at(f, sa - 1.0), a1 = at(f, sb + 1.0);
    const shelfBox = new THREE.Box3().setFromPoints([a0.clone().setY(ys - 0.4), a1.clone().addScaledVector(f.nrm, 1.1).setY(ys + 2.2)]);
    const shelf = r.y1 - y0 > S.horns.shelf + 4 && !keep.hits(shelfBox);
    if (shelf) {
      const mid = a0.clone().lerp(a1, 0.5);
      shelves.push(basis(mid.clone().setY(ys - 0.4).addScaledVector(f.nrm, -0.05), f.t.clone().multiplyScalar(sb - sa + 2.0), V(0, 0.4, 0), f.nrm.clone().multiplyScalar(1.15)));
      strips.push(basis(mid.clone().setY(ys - 0.12).addScaledVector(f.nrm, 1.1), f.t.clone().multiplyScalar(sb - sa + 1.9), V(0, 0.04, 0), f.nrm.clone().multiplyScalar(0.03)));
      row.forEach(([, p], i) => {
        if (i % 2) return;
        const m = p.clone().setY(ys + 0.95).addScaledVector(f.nrm, 0.1);
        blocks.push(basis(p.clone().setY(ys - 0.02).addScaledVector(f.nrm, 0.1), f.t.clone().multiplyScalar(0.8), V(0, 0.3, 0), f.nrm.clone().multiplyScalar(0.7)));
        horns.push(basis(m, f.t.clone().multiplyScalar(0.8), V(0, 0.8, 0), f.nrm.clone().multiplyScalar(0.55)));
        mouths.push(basis(m, f.t.clone().multiplyScalar(0.8), V(0, 0.8, 0), f.nrm.clone().multiplyScalar(0.55)));
      });
    }
    for (const [, p] of row) horn(p, f.t, f.nrm, shelf ? ys - 0.4 : y0 + 5);
    used.add(f);
    keep.add(new THREE.Box3().setFromPoints([at(f, sa - 1), at(f, sb + 1).addScaledVector(f.nrm, 1.5).setY(y0 + (shelf ? S.horns.shelf + 2.4 : 3.2))]));
  }
  // the listening slabs, along the other walls of the big rooms
  for (const f of F) {
    if (used.has(f) || f.room.y1 - f.room.y0 < S.slabs.minH) continue;
    let placed = 0;
    const L = f.s1 - f.s0, n = Math.max(1, Math.floor(L / S.slabs.every));
    for (let i = 0; i < n && placed < S.slabs.n; i++) {
      const s = f.s0 + ((i + 0.5) / n) * L, p = at(f, s);
      const c = p.clone().addScaledVector(f.nrm, 0.5).setY(p.y + S.slabs.h / 2);
      if (!freeOf(f, s, 1.2) || !clear(c, V(1.3, S.slabs.h / 2, 0.7))) continue;
      slab(p, f.t, f.nrm); placed++;
      keep.add(new THREE.Box3().setFromCenterAndSize(c, V(2.5, S.slabs.h, 1.6)));
    }
  }
  // the round rooms: a slab between every few of their stones, clear of their gaps
  for (const r of rooms) {
    if (r.kind !== 'round') continue;
    const e = r.e, step = TAU / e.seg, every = Math.max(2, Math.round(e.seg / 8));
    for (let i = 1; i < e.seg; i += every) {
      const a = i * step;
      if ((e.gaps ?? []).some((g) => Math.abs(Math.atan2(Math.sin(a - g.a), Math.cos(a - g.a))) * e.r < g.w / 2 + 2.4)) continue;
      const out_ = V(Math.sin(a), 0, Math.cos(a)), nrm = out_.clone().negate(), t = V(Math.cos(a), 0, -Math.sin(a)).negate();
      const p = V(e.x, e.y, e.z).addScaledVector(out_, e.r * Math.cos(Math.PI / e.seg) - 0.02);
      const c = p.clone().addScaledVector(nrm, 0.5).setY(e.y + S.slabs.h / 2);
      if (!clear(c, V(1.3, S.slabs.h / 2, 0.7))) continue;
      slab(p, t, nrm);
      keep.add(new THREE.Box3().setFromCenterAndSize(c, V(2.5, S.slabs.h, 1.6)));
    }
  }
  // the great windows: a lit edge along their foot, on the room's side (rt.skinGlass: the house says where they are)
  for (const g of rt.skinGlass ?? []) greatWindow(mats, g, frames, strips, keep);
  out.push(instanced('slate footings, shelves and slabs', blockGeometry(), mats.slate, [...blocks, ...shelves], K.frame));
  out.push(instanced('window frames', blockGeometry(), mats.trim, frames, K.frame));
  out.push(instanced('brass horns', hornGeometry(), mats.brass, horns, K.frame));
  const mm = instanced('horns’ mouths', mouthGeometry(), mats.mouth, mouths, K.frame); mm.userData.skinFine = true; out.push(mm);
  out.push(instanced('lenses', lensGeometry(), mats.glow, lenses, K.frame));
  out.push(instanced('lit strips', blockGeometry(), mats.glow, strips, K.frame));
  return { horns: horns.length, slabs: strips.length, lenses: lenses.length, shelves: shelves.length, frames: frames.length };
}

/**
 * A great window (rt.skinGlass: { a its foot's middle, along (unit), L, h, out (into the room), glass (its Glass piece) }):
 * a heavy dark metal frame round it (posts, a header, a sill) on the room's side, lit lines along it, its pane the sea
 * (seaMaterial) and its grid thin dark mullions. The piece, its logic and its collider are as they were.
 */
function greatWindow(mats, g, frames, strips, keep) {
  const a = V(...g.a), t = V(...g.along), o = V(...g.out), up = V(0, 1, 0), { L, h } = g;
  const box = (s, y, w, hh, d0, d1, list = frames) => list.push(basis(a.clone().addScaledVector(t, s).setY(a.y + y).addScaledVector(o, d0), t.clone().multiplyScalar(w), up.clone().multiplyScalar(hh), o.clone().multiplyScalar(d1 - d0)));
  // posts at its ends and two between (clear of the rungs' columns), the header under its head, the sill at its foot
  for (const k of [-0.5, -0.15, 0.15, 0.5]) {
    const w = Math.abs(k) === 0.5 ? 1.0 : 0.6, s = k * L - Math.sign(k) * (Math.abs(k) === 0.5 ? w / 2 : 0);
    // (none by a doorway or a piece)
    const c = a.clone().addScaledVector(t, s).setY(a.y + h / 2).addScaledVector(o, 0.52);
    if (keep.hits(new THREE.Box3().setFromCenterAndSize(c, V(0.6, h * 0.9, 0.6)))) continue;
    box(s, -SINK, w, h + SINK, 0.3, 0.75);
    box(s, 0.6, 0.05, h - 1.6, 0.75, 0.78, strips);
  }
  // (a header only over a glass not climbed: the tank's climber goes up its face to the shelf)
  if (g.header !== false) { box(0, h - 0.75, L, 0.75, 0.3, 0.85); box(0, h - 0.82, L - 2.2, 0.05, 0.85, 0.88, strips); }
  else box(0, h - 0.08, L - 2.2, 0.05, 0.3, 0.33, strips);
  box(0, -SINK, L, 0.16 + SINK, 0.3, 0.62);
  box(0, 0.17, L - 2.2, 0.04, 0.58, 0.61, strips);
  const glass = g.glass;
  if (!glass?.group) return;
  const [pane, bars] = glass.group.children;
  if (pane?.isMesh) {
    glass.group.updateMatrixWorld(true);
    const O = V().setFromMatrixPosition(glass.group.matrixWorld), T = V(1, 0, 0).transformDirection(glass.group.matrixWorld);
    pane.material = seaMaterial(O, T, glass.w, glass.h);
  }
  if (bars?.isMesh) bars.material = mats.trim;
}

// the sea through a great window: deep blue, darker below, shafts of light from above, motes; through the tank's tall
// glass a whale far out and the Listener's fan of an ear on the sea floor (drawn on the pane: nothing there to reach)
const SEA = /* glsl */ `
    vec3 albedo = uColor;
    float whInkV = 0.0;
    {
      vec3 sp = vWorldPos - uSeaO;
      vec2 q = vec2(dot(sp, uSeaT), sp.y);
      float W = uSeaWH.x, Hh = uSeaWH.y, k = clamp(q.y / Hh, 0.0, 1.0);
      vec2 fw2 = fwidth(q);
      float fw = max(max(fw2.x, fw2.y), 1e-4);
      albedo = mix(vec3(0.04, 0.13, 0.27), vec3(0.17, 0.40, 0.64), smoothstep(0.0, 1.0, k));
      // shafts from above, slanted, soft-edged
      float sh = fract((q.x * 0.9 + q.y * 0.45) / 6.3 + 0.25 * vnoise(vec2(q.x * 0.05, 3.0)));
      float band = smoothstep(0.55, 0.68, sh) * (1.0 - smoothstep(0.78, 0.92, sh));
      albedo += vec3(0.08, 0.15, 0.18) * band * smoothstep(0.1, 1.0, k);
      // motes
      vec2 mc = floor(q * 2.5);
      albedo += vec3(0.10, 0.14, 0.16) * step(0.988, hash(mc)) * (1.0 - smoothstep(0.1, 0.25, length(fract(q * 2.5) - 0.5)));
      // the sea floor far off
      albedo = mix(albedo, vec3(0.08, 0.20, 0.29), (1.0 - smoothstep(0.0, 0.3, q.y - Hh * 0.07)) * 0.7);
      if (Hh > 6.0) {
        // the whale: a long body tapering to its tail, a fluke; paler than the water, inked
        vec2 d = q - vec2(-W * 0.12, Hh * 0.72);
        float u = d.x / 4.2;
        float r = 0.66 * (1.0 - smoothstep(-0.5, 1.05, u)) * (0.5 + 0.5 * smoothstep(-1.12, -0.6, u)) + 0.06;
        float yb = d.y + 0.06 * d.x;
        float inside = step(abs(u), 1.12) * step(abs(yb), r);
        vec2 fl = d - vec2(4.9, 0.32);
        float fluke = step(-0.1, fl.x) * step(fl.x, 1.0) * step(abs(fl.y - 0.1 * fl.x), 0.08 + 0.55 * fl.x);
        float whale = max(inside, fluke);
        albedo = mix(albedo, vec3(0.28, 0.45, 0.58), whale);
        whInkV = max(whInkV, step(abs(u), 1.12) * (1.0 - smoothstep(0.0, 1.5 * fw, abs(abs(yb) - r))) * 0.7);
        // the Listener far out: a fan of plates over a stepped block, dark against the blue
        vec2 e = q - vec2(W * 0.17, Hh * 0.1);
        float rr = length(e), ang = atan(e.y, e.x);
        float fan = step(0.0, e.y) * step(rr, 4.4) * step(1.1, rr) * step(0.3, ang) * step(ang, 2.84);
        float block = step(abs(e.x), 1.5) * step(e.y, 1.1) * step(-0.7, e.y) + step(abs(e.x), 2.3) * step(e.y, 0.2) * step(-0.7, e.y);
        float lis = min(1.0, fan + block);
        albedo = mix(albedo, vec3(0.08, 0.19, 0.30), lis * 0.85);
        float seam = fan * (1.0 - smoothstep(0.0, 1.3 * fw, abs(fract(ang / 0.21) - 0.5) * 0.21 * rr));
        whInkV = max(whInkV, max(seam * 0.55, fan * (1.0 - smoothstep(0.0, 1.4 * fw, abs(rr - 4.4))) * 0.6));
      }
    }
`;
const seas = new Map();
/** A pane's sea (its frame: O its foot's middle, T along it; w, h its size). */
function seaMaterial(O, T, w, h) {
  const key = `${O.x.toFixed(1)}/${O.y.toFixed(1)}/${O.z.toFixed(1)}`;
  if (seas.has(key)) return seas.get(key);
  const m = makeMaterial({ color: '#2b6796', glow: 0.55, flat: true, key: `temple.skin.whale.sea.${key}` });
  const fs = m.fragmentShader, at = fs.lastIndexOf('void main()');
  if (at < 0 || !fs.includes('vec3 albedo = uColor;') || !fs.includes('float detail = 0.0;')) throw new Error('whale-house.js: the surface shader changed: no albedo or detail line to replace');
  m.fragmentShader = 'uniform vec3 uSeaO;\nuniform vec3 uSeaT;\nuniform vec2 uSeaWH;\n' + fs.slice(0, at) + fs.slice(at).replace('vec3 albedo = uColor;', SEA).replace('float detail = 0.0;', 'float detail = whInkV;');
  m.userData.houseSkin = 'sea';
  Object.assign(m.uniforms, { uSeaO: { value: O.clone() }, uSeaT: { value: T.clone() }, uSeaWH: { value: new THREE.Vector2(w, h) } });
  seas.set(key, m);
  return m;
}

/** The finest dressing hidden on the lighter presets (uWearLite), and the dressing's lights breathing. */
class SkinLife {
  constructor(meshes, glow) { this.fine = meshes.filter((m) => m.userData.skinFine); this.glow = glow; }
  update(dt, t) {
    const on = sharedUniforms.uWearLite.value < 0.5;
    for (const m of this.fine) if (m.visible !== on) m.visible = on;
    this.glow.uniforms.uGlow.value = 0.86 + 0.1 * Math.sin(t * 1.1);
  }
}

// ------------------------------------------------------------------ the skin
/**
 * The Whale-House's skin (its def's `skin`, src/temples/skins/index.js): its surfaces swapped into rt.M (the kit shares
 * it), its own materials for the house's layout (skin.mats: the orbs, the rings, the sea), the kit's plan recording.
 */
export function whaleHouseSkin(rt) {
  const S = WHALE_SKIN, K = rt.kit, M = rt.M;
  // (the house's look, its shade deeper: the drawings' slate is dark, its shade strong)
  const look = { ...(rt.def.palette?.look?.all ?? {}), shade: 0.02, shadeFlat: 0 };
  const U = {
    origin: { value: K.origin.clone() },
    round: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
    count: { value: 0 },
  };
  const was = { wall: M.wall, wallGlyph: M.wallGlyph, floor: M.floor, trim: M.trim, bands: M.bands, ornament: M.ornament, glyph: M.glyph };
  const own = (k, o) => makeMaterial({ flat: true, ...o, key: `temple.skin.whale.${k}` });
  const glow = own('glow', { color: S.line, glow: 0.9, side: THREE.DoubleSide });
  const mats = {
    wall: skinMaterial('wall', look, S.wall, U, 'wall'),
    wallGlyph: skinMaterial('wall', { ...look, glyphs: 1.6 }, S.wall, U, 'wallGlyph'),
    floor: skinMaterial('floor', look, S.floor, U, 'floor'),
    trim: own('trim', { ...look, color: S.trim, metal: 'iron', refl: 0.35, highlight: 0.2 }),
    glyph: own('glyph', { color: S.line, glow: 0.85 }),
    glow,
    // (the house's own, for its layout: whorl(), pillar(), the sea)
    orb: own('orb', { ...look, color: S.orb, metal: 'iron', refl: 0.4, highlight: 0.3 }),
    orb2: metal(S.orb2),
    ring: glow,
    sea: own('sea', { color: S.sea, glow: 0.35 }),
    deep: own('deep', { color: S.deep, glow: 0.25 }),
    // the dressing's
    slate: own('slate', { ...look, color: S.slate, side: THREE.DoubleSide }),
    brass: metal(S.orb2),
    mouth: own('mouth', { color: S.mouth, side: THREE.DoubleSide }),
  };
  const lens = { a: metal(S.orb2), b: glow };
  Object.assign(M, {
    wall: mats.wall, wallGlyph: mats.wallGlyph, floor: mats.floor, trim: mats.trim, glyph: mats.glyph,
    bands: [{ at: 0.72, h: 0.6, mat: own('band', { ...look, color: S.band }) }],
    ornament: { kind: 'porthole', mats: lens },
  });
  K.plan = [];
  const meshes = [];
  const skin = {
    name: 'whale-house', S, mats, meshes, stats: null,
    /** After the layout: the round rooms handed to the shader, the dressing placed and added. */
    dress() {
      const t0 = performance.now(), plan = K.plan, rooms = roomsOf(plan);
      const round = rooms.filter((r) => r.kind === 'round').slice(0, 4);
      round.forEach((r, i) => U.round.value[i].set(r.x, r.z, r.r, r.y0));
      U.count.value = round.length;
      const keep = keepOuts(rt, new Set([mats.wall, mats.wallGlyph, mats.floor, M.bands[0].mat, M.sand]));
      skin.stats = { ...dress(rt, mats, keep, plan, rooms, meshes), ms: Math.round(performance.now() - t0) };
      for (const m of meshes) K.group.add(m);
      rt.pieces.push(new SkinLife(meshes, glow));
    },
    /** After the kit's flush: the house's own materials back for its exterior. */
    done() { Object.assign(M, was); K.plan = null; },
  };
  return skin;
}
