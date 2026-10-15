import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, sharedUniforms } from '../../materials.js';
import { paint } from '../kit.js';
import { skinShader, spliceSkin } from './skin-shader.js';

// ---------------------------------------------------------------------------
// The Mooring-House in its futuristic skin (issue #342, docs/systems/temples.md "Futuristic skins"): the makers' capstan
// house on the Moorings drawn as the author's picks have it (references/temples/future/mooring-house/sheet-1.jpg,
// sheet-2.jpg), a quiet round hall of dark slate slabs round a stopped ring winch banded with thin teal circuits, its
// cables slack out to the islands floating under the planet, over its rooms as they are: the same rooms, doors,
// collision, pieces, positions, timings and logic (tests/temple-skins.test.js).
//   1. surfaces (the surface shader's albedo, first pen lines and glow replaced, as landmark-materials.js stone() does):
//      the walls tall violet-grey slate slabs (few joints, each column's set off its own way) with chamfered edges, a
//      lit lip and a shaded one, the hatching kept sparse, a rare thin teal circuit; the floors slate plates, laid in
//      rings round a round room's middle (the picks' concentric floor), in a grid in the halls, a teal border line in
//      from the walls, a teal edge under every landing's lip over the void; round the great capstan's foot a dark well
//      ring, a teal line at its lip and short spokes out to lenses. The machine slabs (the doors' leaves) darker metal.
//   2. the capstan (skin.house.drum, which spacecity.js's layout draws it in): a drum of dark teal-slate metal in
//      panels, banded with thin teal line circuits with 45° jogs, its lid a disc of rings round a lens; its bars and
//      base dark iron, its cable wrap left off (the picks' drum is bare). The house's paints: brass muted, iron near
//      black, the cables dark; the starlight lines teal; the moorers' rings of the friezes dark metal with a teal line;
//      the Anchor-Warden ochre brass and dark iron, its dome iron, its eye teal (skin.house.warden).
//   3. machined dressing, drawn only (no collision, kept off every doorway, piece and thing drawn on the walls):
//      - ring lights round the walls at hand height (a dark rounded bezel, a flat teal ring and its lens: a light, not
//        a ring to pull, which the house's pieces are), and a dark slot framed in slate where each of the capstan
//        hall's cables goes into the wall: merged into the kit's own batches (paint and the skin's glow: no draw of
//        their own);
//      - square slate plates floating high over the big rooms and the void, a teal lens on each face, bobbing slowly
//        (two InstancedMeshes, out of the shadow passes);
//      - islands of the city's adobe floating in the void under and round the house, their cables slack toward it
//        (the kit's paint batch, outside the walls: seen down through the void halls and out of the Capstan Floor's
//        windows).
// The makers' glyph is the shared open-corner mark (sign-text.js glyphGeometry), left as it is.
// On the Low, Handheld and Steam Deck presets (uWearLite) the shader leaves out the chamfers, the panels' tones and the
// floors' line runs, and the floating plates stand still with their lenses hidden.
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
/** Rooms handed to the shader (round ones first). */
export const MOORING_ROOMS = 24;

/** The skin's colours (sRGB) and sizes (m), after the picks' pixels (slate walls #383a46-#585057, L 58-85; floors L 50-100). */
export const MOORING_SKIN = {
  wall: { color: '#57545f', dark: '#363440', light: '#76727f', seam: '#22212a', cell: [2.6, 7.2], density: 0.22 },
  machine: { color: '#3a3d48', dark: '#24262f', light: '#555968', seam: '#181a21', cell: [1.8, 3.2], density: 0.8 },
  floor: { color: '#6b6670', dark: '#46424b', light: '#86818b', seam: '#2c2a31', cell: [2.6, 2.6] },
  drum: { color: '#33434a', dark: '#1f2a30', light: '#4c5f66', seam: '#151d22', cell: [1.35, 1.4], density: 1 },
  teal: '#6fe0c8', glyph: '#8fe8d4',
  /** what glows (the post pass's halo starts at 0.62: just over it, a crisp light) */
  emit: { line: 0.72, pulse: 0.06 },
  trim: '#34333e', dark: '#191920', stone: '#4c4a56', brass: '#a8844c', ball: '#3a3e47', slab: '#43414e',
  /** the house's own paints (spacecity.js's layout reads skin.house) */
  paints: { brass: '#a07c48', iron: '#26272f', cable: '#2c2a2a' },
  /** the rooms' light (index.js reads it for the house): lavender shade, a cream light, a pale sun */
  light: { shadow: '#8e8aa6', light: '#f4efe6', sun: '#fff1da' },
  /** the Anchor-Warden (guardian-anchor.js anchorModel's colours): ochre brass on dark iron, a teal eye */
  warden: { brass: '#b48a48', brass2: '#8c6a36', iron: '#2a2b33', teal: '#33343e', cream: '#8c6a36', cable: '#2c2a2a', eye: '#6fe0c8' },
  /** the capstan's middle and the radius of its iron foot (the kit's local m): the well ring round it on the floor */
  hub: { x: 0, z: 30, r: 3.3, well: 1.1 },
  /** ring lights round the walls: their middle this high, one a stone or a face every m, this many to a room at most */
  rings: { y: 1.9, every: 6.5, n: 8, minH: 9, w: 1.1, h: 1.5 },
  /** where the capstan hall's cables go into its wall (spacecity.js layout's cable angles, at r 17.9, y 12) */
  slots: { angles: [0.55, 1.95, 2.75, -2.75, -0.95, -0.4], r: 18, y: 12, w: 1.3, h: 1.7 },
};

/**
 * The floating plates, by room (the kit's local m): n plates in a box (or round a middle, r0..r1), clear of the
 * balcony's sector (skip: an angle and a half-width) in the capstan hall. All of them well over the floors the
 * traveller walks and the lines his tether flies.
 */
export const MOORING_PLATES = [
  { round: [0, 30], r: [7.5, 13.5], y: [10, 17], n: 7, skip: [-1.795, 0.7] },        // the Capstan Hall
  { round: [-28.3, 1.7], r: [6, 11], y: [10.5, 14], n: 3 },                             // the Winch Room
  { box: [-52, 11, 67, -38, 16, 92], n: 4 },                                            // the Drift, over the void
  { box: [-76, 16, 31, -48, 22, 39], n: 3 },                                            // the Balance, over the void
  { round: [-107, 46.5], r: [11, 15.5], y: [14.5, 19], n: 4 },                              // the Capstan Floor
];
/** The islands floating in the void round the house (the kit's local m): their middles and sizes, the cable's end on the house. */
export const MOORING_ISLANDS = [
  // out of the Capstan Floor's west windows
  { at: [-190, 6, 72], s: 20, to: [-126, 16, 62] },
  { at: [-205, -14, 10], s: 16, to: [-124, 14, 32] },
  { at: [-165, 18, -32], s: 12, to: [-120, 20, 30] },
  { at: [-150, 34, 140], s: 14, to: [-112, 24, 64] },
  // overhead, seen up through the void halls' open tops
  { at: [-40, 62, 112], s: 18, to: [-45, 21, 94.6] },
  { at: [-96, 54, 78], s: 14, to: [-69.6, 21, 80] },
  { at: [-22, 74, 38], s: 16, to: [-45.4, 29, 40] },
  { at: [-66, 68, -6], s: 12, to: [-62, 29, 16.4] },
];

// ------------------------------------------------------------------ the shader
const PARS = /* glsl */ `
  uniform vec3 uSkinO;
  uniform vec2 uSkRot;
  uniform vec4 uSkR[${MOORING_ROOMS}];
  uniform vec4 uSkY[${MOORING_ROOMS}];
  uniform int uSkN;
  uniform vec4 uSkLips;
  uniform vec4 uSkHub;
  uniform vec3 uSkA;
  uniform vec3 uSkDark;
  uniform vec3 uSkLight;
  uniform vec3 uSkSeam;
  uniform vec2 uSkCell;
  uniform float uSkK;
  uniform float uSkObj;
`;
const E = MOORING_SKIN.emit;
const GLSL = /* glsl */ `
  float mhH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float mhSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0); return length(pa - ba * h); }
  // a line d m from its middle, w m half wide, antialiased by fw (never under about a pixel: thinner broke into dashes)
  float mhLine(float d, float fw, float w) { w = max(w, fw * 0.6); return 1.0 - smoothstep(w, w + max(fw, 1e-5) * 1.3, d); }
  // gone once its spacing is under a few pixels
  float mhNear(float fw, float every) { return 1.0 - smoothstep(0.12, 0.3, fw / every); }
  // the kit's local frame, from the world
  vec3 mhLocal(vec3 w) { vec3 d = w - uSkinO; return vec3(d.x * uSkRot.x - d.z * uSkRot.y, d.y, d.x * uSkRot.y + d.z * uSkRot.x); }
  vec3 mhLocalN(vec3 n) { return vec3(n.x * uSkRot.x - n.z * uSkRot.y, n.y, n.x * uSkRot.y + n.z * uSkRot.x); }
  // the room a wall face belongs to: along it (m round a round room), its floor's height (y), 1 if found (z)
  vec3 mhWall(vec3 p, vec3 nn) {
    for (int i = 0; i < ${MOORING_ROOMS}; i++) {
      if (i >= uSkN) break;
      vec4 R = uSkR[i], Y = uSkY[i];
      if (p.y < Y.x - 0.5 || p.y > Y.y + 1.5) continue;
      vec2 d = p.xz - R.xy;
      if (R.w < 0.0) {
        float r = length(d);
        if (abs(r - R.z) < 1.9 && abs(dot(nn.xz, d)) > 0.8 * r * length(nn.xz)) return vec3(atan(d.y, d.x) * R.z, Y.x, 1.0);
      } else if (abs(d.x) < R.z + 0.3 && abs(d.y) < R.w + 0.3) return vec3(abs(nn.x) > abs(nn.z) ? p.z : p.x, Y.x, 1.0);
    }
    return vec3(abs(nn.x) > abs(nn.z) ? p.z : p.x, 0.0, 0.0);
  }
  // the room whose floor p lies on: its index, or -1
  int mhFloor(vec3 p) {
    for (int i = 0; i < ${MOORING_ROOMS}; i++) {
      if (i >= uSkN) break;
      vec4 R = uSkR[i], Y = uSkY[i];
      if (abs(p.y - Y.x) > 0.6) continue;
      vec2 d = p.xz - R.xy;
      if (R.w < 0.0 ? length(d) < R.z + 0.2 : (abs(d.x) < R.z + 0.2 && abs(d.y) < R.w + 0.2)) return i;
    }
    return -1;
  }
  // a wall's circuit in a column of two panels (P wide): up from the floor, a chamfered corner, across to the next
  // panel's middle, a chamfered corner, on up to its lens. x: the distance to the line (m), y: to its lens' middle
  vec2 mhWallLine(vec2 q, float P, float K) {
    float Wc = 2.0 * P, c = floor(q.x / Wc), x0 = c * Wc;
    if (mhH(vec2(c, 7.13)) > K) return vec2(1e3);
    float xa = x0 + 0.5 * P, xb = x0 + 1.5 * P;
    if (mhH(vec2(c, 5.71)) < 0.5) { float s = xa; xa = xb; xb = s; }
    float s = sign(xb - xa), ch = 0.3;
    float yj = 0.8 + 2.4 * mhH(vec2(c, 9.37)), yt = yj + 1.4 + 3.2 * mhH(vec2(c, 4.41));
    float d = mhSeg(q, vec2(xa, -2.0), vec2(xa, yj - ch));
    d = min(d, mhSeg(q, vec2(xa, yj - ch), vec2(xa + s * ch, yj)));
    d = min(d, mhSeg(q, vec2(xa + s * ch, yj), vec2(xb - s * ch, yj)));
    d = min(d, mhSeg(q, vec2(xb - s * ch, yj), vec2(xb, yj + ch)));
    d = min(d, mhSeg(q, vec2(xb, yj + ch), vec2(xb, yt - 0.2)));
    return vec2(d, length(q - vec2(xb, yt)));
  }
  // runs of line along rows every S (u across, v along the rows), in runs of C (the run on or not by \`on\`), each run
  // its own offset by whole steps (G) from the row's middle, a 45° jog between two runs; ends lensed. x: the distance
  // (m), y: to an end's lens. (The capstan's bands and the floors' lines.)
  vec2 mhRuns(vec2 p, float S, float C, float G, float seed, float rowOn, float on) {
    float r = floor(p.y / S);
    if (mhH(vec2(r, seed)) > rowOn) return vec2(1e3);
    float zc = (r + 0.5) * S, i = floor(p.x / C), x0 = i * C, x1 = x0 + C;
    float on0 = step(1.0 - on, mhH(vec2(i, r + seed))), onL = step(1.0 - on, mhH(vec2(i - 1.0, r + seed))), onR = step(1.0 - on, mhH(vec2(i + 1.0, r + seed)));
    float o0 = floor(mhH(vec2(i, r * 1.7 + seed)) * 2.999) - 1.0, oL = floor(mhH(vec2(i - 1.0, r * 1.7 + seed)) * 2.999) - 1.0, oR = floor(mhH(vec2(i + 1.0, r * 1.7 + seed)) * 2.999) - 1.0;
    float z0 = zc + o0 * G, zL = zc + oL * G, zR = zc + oR * G;
    float dL = onL * abs(z0 - zL) * 0.5, dR = onR * abs(zR - z0) * 0.5;
    float d = 1e3, lens = 1e3;
    if (on0 > 0.5) {
      d = mhSeg(p, vec2(x0 + dL, z0), vec2(x1 - dR, z0));
      if (onL > 0.5) d = min(d, mhSeg(p, vec2(x0 - dL, zL), vec2(x0 + dL, z0))); else lens = length(p - vec2(x0 + 0.3, z0));
      if (onR > 0.5) d = min(d, mhSeg(p, vec2(x1 - dR, z0), vec2(x1 + dR, zR))); else lens = min(lens, length(p - vec2(x1 - 0.3, z0)));
    }
    return vec2(d, lens);
  }
  // a lens: a ring and its dot (r: from its middle, m; k its size)
  float mhLens(float r, float fw, float k) { return max(mhLine(abs(r - 0.2 * k), fw, 0.025), 1.0 - smoothstep(0.075 * k - fw, 0.075 * k, r)); }
  // the slow pulse along the lines (a stopped machine's: barely there)
  float mhPulse(vec2 q) { return 0.5 + 0.5 * sin(uTime * 0.5 - (q.x + q.y) * 0.25); }
  // chamfers: a lit lip along a cell's top and left edges, a shaded one along its bottom and right (f the cell's fraction)
  vec3 mhChamfer(vec3 albedo, vec2 f, vec2 cell, float fw, float b, float k) {
    vec2 m = f * cell, M2 = (1.0 - f) * cell;
    float lit = max(1.0 - smoothstep(b - fw, b, M2.y), 1.0 - smoothstep(b - fw, b, m.x));
    float shd = max(1.0 - smoothstep(b - fw, b, m.y), 1.0 - smoothstep(b - fw, b, M2.x));
    float g = 1.0 - smoothstep(0.4, 1.0, fw / b);
    albedo = mix(albedo, uSkLight, lit * g * k);
    return mix(albedo, uSkDark, shd * g * k * (1.0 - lit));
  }
`;

/** Each body replaces the surface's `vec3 albedo = uColor;` and sets skInk (its pen lines) and skEmit (what glows). */
const BODIES = {
  // the walls (and, denser, the machine slabs): tall chamfered slabs, a rare teal circuit
  wall: /* glsl */ `
    vec3 skP = uSkObj > 0.5 ? vObjPos : mhLocal(vWorldPos), skN = uSkObj > 0.5 ? normalize(vObjNormal) : mhLocalN(n);
    float skInk = 0.0, skEmit = 0.0;
    vec3 albedo = uColor;
    {
      bool lite = uWearLite > 0.5;
      bool side = abs(skN.y) < 0.65;
      vec3 W = side ? (uSkObj > 0.5 ? vec3(abs(skN.x) > abs(skN.z) ? skP.z : skP.x, 0.0, 1.0) : mhWall(skP, skN)) : vec3(skP.x, 0.0, 0.0);
      float base = side && W.z > 0.5 ? W.y : 0.0;
      vec2 uv = side ? vec2(W.x, skP.y - base) : skP.xz;
      float P = uSkCell.x, Hc = uSkCell.y;
      float col = floor(uv.x / P), oy = side ? mhH(vec2(col, 3.3)) * Hc : 0.0;
      vec2 c = vec2(uv.x / P, (uv.y + oy) / Hc), cell = floor(c), f = fract(c), fq = fwidth(c);
      // (the pixel's size from the position, not uv: a round room's uv jumps once round it)
      vec3 fp = fwidth(skP);
      float fw = max(max(fp.x, fp.y), max(fp.z, 1e-5));
      vec2 dm = min(f, 1.0 - f) * uSkCell, dfw = vec2(fw);
      float near = mhNear(fw, 1.0);
      float seam = max(mhLine(dm.x, fw, 0.02), mhLine(dm.y, fw, 0.02));
      if (!lite) {
        albedo *= 0.94 + 0.12 * mhH(cell + 11.0);
        albedo = mhChamfer(albedo, f, uSkCell, fw, 0.075, 0.75);
      }
      albedo = mix(albedo, uSkSeam, seam * 0.75 * near);
      skInk = seam * near * 0.5;
      // (ceilings and undersides darker, as the picks' are)
      if (skN.y < -0.65) albedo *= 0.7;
      if (side) {
        vec2 L = mhWallLine(uv, P, uSkK);
        float d = L.x;
        // the machine's leaves: a lit seam up their middle (in their own frame)
        if (uSkObj > 0.5) d = min(d, abs(uv.x));
        float pulse = mhPulse(uv);
        float cov = max(mhLine(d, fw, 0.022), mhLens(L.y, fw, 1.0));
        cov *= mhNear(fw, 0.25);
        albedo = mix(albedo, uSkA * (0.85 + 0.15 * pulse), cov);
        skEmit = max(skEmit, cov * (${E.line.toFixed(3)} + ${E.pulse.toFixed(3)} * pulse));
        skInk *= 1.0 - cov;
      }
    }
  `,
  // the floors: plates (in rings round a round room's middle), a teal border, the capstan's well ring, lit lips
  floor: /* glsl */ `
    vec3 skP = uSkObj > 0.5 ? vObjPos : mhLocal(vWorldPos), skN = uSkObj > 0.5 ? normalize(vObjNormal) : mhLocalN(n);
    float skInk = 0.0, skEmit = 0.0;
    vec3 albedo = uColor;
    {
      bool lite = uWearLite > 0.5;
      bool top = skN.y > 0.65;
      vec3 fp = fwidth(skP);
      float fw = max(max(fp.x, fp.y), max(fp.z, 1e-5));
      float near = mhNear(fw, 1.0);
      int ri = top && uSkObj < 0.5 ? mhFloor(skP) : -1;
      bool round = ri >= 0 && uSkR[ri].w < 0.0;
      vec2 q = top ? skP.xz : vec2(abs(skN.x) > abs(skN.z) ? skP.z : skP.x, skP.y);
      float seam = 0.0, cov = 0.0;
      if (round) {
        // plates in rings round the room's middle: rings 2.6 m apart, each cut into plates about 2.6 m long, each ring
        // turned its own way
        vec4 R = uSkR[ri];
        vec2 d = skP.xz - R.xy;
        float r = length(d), ring = uSkCell.x, k = floor(r / ring);
        float np = max(6.0, floor(${TAU.toFixed(5)} * (k + 0.5) * ring / uSkCell.y));
        float aa = (atan(d.y, d.x) / ${TAU.toFixed(5)} + 0.5) * np + mhH(vec2(k, 2.0));
        float fr = fract(r / ring), fa = fract(aa);
        float dr = min(fr, 1.0 - fr) * ring, da = min(fa, 1.0 - fa) * ${TAU.toFixed(5)} * max(r, 0.5) / np;
        seam = k < 0.5 ? mhLine(dr, fw, 0.02) : max(mhLine(dr, fw, 0.02), mhLine(da, fw, 0.02));
        if (!lite) albedo *= 0.95 + 0.1 * mhH(vec2(k, floor(aa)) + 5.0);
        // a border line round the room, 1.5 m in from its wall
        cov = mhLine(abs(r - (R.z - 1.5)), fw, 0.026);
        // the capstan's foot: a dark well ring round it, a teal line at its lip, short spokes out to lenses
        vec2 h = skP.xz - uSkHub.xy;
        float rh = length(h);
        if (rh < uSkHub.z + uSkHub.w + 2.2 && abs(skP.y - uSkY[ri].x) < 0.2) {
          float lip = uSkHub.z + uSkHub.w;
          float well = 1.0 - smoothstep(lip - fw, lip, rh);
          albedo = mix(albedo, uSkSeam * 0.8, well);
          seam *= 1.0 - well;
          cov = max(cov, mhLine(abs(rh - lip - 0.12), fw, 0.03));
          cov = max(cov, mhLine(abs(rh - uSkHub.z - 0.12), fw, 0.018) * well);
          float sa = atan(h.y, h.x) / ${TAU.toFixed(5)} * 12.0, sd = abs(fract(sa) - 0.5) * ${TAU.toFixed(5)} * rh / 12.0;
          float sp = mhLine(sd, fw, 0.022) * step(lip + 0.12, rh) * (1.0 - step(lip + 1.5, rh));
          cov = max(cov, sp);
          float ld = length(vec2(sd, rh - lip - 1.75));
          cov = max(cov, mhLens(ld, fw, 1.0));
        }
      } else {
        vec2 c = q / uSkCell, cell = floor(c), f = fract(c);
        vec2 dm = min(f, 1.0 - f) * uSkCell;
        seam = max(mhLine(dm.x, fw, 0.02), mhLine(dm.y, fw, 0.02));
        if (!lite) {
          albedo *= 0.95 + 0.1 * mhH(cell + 5.0);
          albedo = mhChamfer(albedo, f, uSkCell, fw, 0.06, 0.5);
        }
        if (top && uSkObj < 0.5) {
          // a few runs of line along the plates' seams, but on the lighter presets
          if (!lite) { vec2 A = mhRuns(q, uSkCell.y * 3.0, uSkCell.x * 3.0, uSkCell.y * 0.5, 1.3, 0.35, 0.6); cov = max(mhLine(A.x, fw, 0.022), mhLens(A.y, fw, 1.0)); }
          if (ri >= 0) {
            vec4 R = uSkR[ri];
            vec2 d = skP.xz - R.xy;
            float e = max(abs(d.x) - R.z, abs(d.y) - R.w);
            bool passage = uSkY[ri].z > 0.5;
            if (passage) { float cc = R.z < R.w ? abs(d.x) : abs(d.y); cov = max(cov, mhLine(abs(cc - 1.6), fw, 0.024)); }
            else cov = max(cov, mhLine(abs(e + 1.5), fw, 0.026));
          }
        } else if (top) {
          // a riding disc's or a bridge's own: a lens in its middle
          cov = mhLens(length(skP.xz), fw, 1.4);
        } else {
          // a slab's edge (a landing's face over the void): darker, a teal line just under its lip
          albedo *= 0.7;
          if (uSkObj < 0.5) for (int i = 0; i < 4; i++) { float y = uSkLips[i]; if (y > -900.0) cov = max(cov, mhLine(abs(skP.y - (y - 0.14)), fw, 0.026)); }
        }
      }
      albedo = mix(albedo, uSkSeam, seam * 0.7 * near);
      skInk = seam * near * 0.45;
      cov *= mhNear(fw, 0.25);
      float pulse = mhPulse(q);
      albedo = mix(albedo, uSkA * (0.85 + 0.15 * pulse), cov);
      skEmit = max(skEmit, cov * (${E.line.toFixed(3)} + ${E.pulse.toFixed(3)} * pulse));
      skInk *= 1.0 - cov;
    }
  `,
  // the great capstan: a drum of dark teal-slate panels banded with teal circuits; its lid rings round a lens
  drum: /* glsl */ `
    vec3 skP = mhLocal(vWorldPos), skN = mhLocalN(n);
    float skInk = 0.0, skEmit = 0.0;
    vec3 albedo = uColor;
    {
      bool lite = uWearLite > 0.5;
      vec3 fp = fwidth(skP);
      float fw = max(max(fp.x, fp.y), max(fp.z, 1e-5));
      vec2 h = skP.xz - uSkHub.xy;
      float rh = length(h), ang = atan(h.y, h.x);
      float cov = 0.0, seam = 0.0;
      vec2 q;
      if (skN.y < 0.55) {
        // the drum's side: panels 1.35 m round by 1.4 m, bands of circuit between y 0.7 and 3.7
        q = vec2(ang * 2.75, skP.y);
        vec2 c = q / uSkCell, cell = floor(c), f = fract(c), dm = min(f, 1.0 - f) * uSkCell;
        seam = max(mhLine(dm.x, fw, 0.018), mhLine(dm.y, fw, 0.018));
        if (!lite) { albedo *= 0.93 + 0.14 * mhH(cell + 3.0); albedo = mhChamfer(albedo, f, uSkCell, fw, 0.05, 0.6); }
        vec2 A = mhRuns(q - vec2(0.0, 0.7), 0.38, 1.8, 0.19, 4.1, 0.8, 0.85);
        float band = step(0.7, q.y) * step(q.y, 3.75);
        cov = max(mhLine(A.x, fw, 0.016), mhLens(A.y, fw, 0.6) * step(mhH(vec2(floor(q.x / 1.8), floor(q.y / 0.38))), 0.4)) * band;
        // (now and then a short line down between two bands)
        float vx = abs(fract(q.x / 2.1 + 0.37) - 0.5) * 2.1;
        cov = max(cov, mhLine(vx, fw, 0.015) * band * step(mhH(vec2(floor(q.x / 2.1 + 0.37), 9.0)), 0.45) * step(1.4, q.y) * step(q.y, 2.9));
      } else {
        // the lid: rings round a lens, radial seams
        q = h;
        float sa = abs(fract(ang / ${TAU.toFixed(5)} * 12.0) - 0.5) * ${TAU.toFixed(5)} * rh / 12.0;
        seam = mhLine(sa, fw, 0.018) * step(1.2, rh);
        seam = max(seam, mhLine(abs(rh - 1.2), fw, 0.02));
        cov = max(mhLine(abs(rh - 2.1), fw, 0.03), mhLens(rh, fw, 2.2));
        albedo *= 1.25;
      }
      albedo = mix(albedo, uSkSeam, seam * 0.75);
      skInk = seam * 0.5;
      float pulse = mhPulse(q);
      albedo = mix(albedo, uSkA * (0.85 + 0.15 * pulse), cov);
      skEmit = max(skEmit, cov * (${E.line.toFixed(3)} + ${E.pulse.toFixed(3)} * pulse));
      skInk *= 1.0 - cov;
    }
  `,
};

/** The pattern, as data the web's shader and the Unity port's are both made from (skin-shader.js). */
const SHADER = skinShader('mooring-house', { pars: PARS, glsl: GLSL, bodies: BODIES, ink: 'skInk', emit: 'skEmit', emitAt: 'init' });

/** One of the skin's surface materials: makeMaterial's, its albedo and first pen lines the body's, its glow skEmit. */
function skinMaterial(body, look, S, U, key, obj = false) {
  const m = makeMaterial({ flat: true, ...look, color: S.color, key: `temple.skin.mooring.${key}` });
  // (this build's rooms: a material from the cache is pointed at them again)
  Object.assign(m.uniforms, { uSkinO: U.origin, uSkRot: U.rot, uSkR: U.rooms, uSkY: U.roomsY, uSkN: U.count, uSkLips: U.lips, uSkHub: U.hub });
  if (m.userData.houseSkin) return m;
  m.userData.houseSkin = body;
  spliceSkin(m, SHADER, body, 'mooring-house.js');
  Object.assign(m.uniforms, {
    uSkA: { value: new THREE.Color(MOORING_SKIN.teal) }, uSkDark: { value: new THREE.Color(S.dark) }, uSkLight: { value: new THREE.Color(S.light) },
    uSkSeam: { value: new THREE.Color(S.seam) }, uSkCell: { value: new THREE.Vector2(...S.cell) }, uSkK: { value: S.density ?? 0.6 },
    uSkObj: { value: obj ? 1 : 0 },
  });
  return m;
}

// ------------------------------------------------------------------ the dressing's shapes (unit frames: x across, y up, z out of the wall)
/** Geometries merged into one, each part a grey level (a colour attribute: the plates' material reads it). */
function toned(list, tones) {
  const pos = [], nor = [], col = [];
  list.forEach((g0, i) => {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    for (let j = 0; j < g.attributes.position.count; j++) col.push(tones[i], tones[i], tones[i]);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
/** Geometries merged into one, each part its own colour (THREE.Color, linear: the colour attribute). */
function coloured(list, colours) {
  const pos = [], nor = [], col = [];
  list.forEach((g0, i) => {
    const g = g0.index ? g0.toNonIndexed() : g0, c = colours[i];
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    for (let j = 0; j < g.attributes.position.count; j++) col.push(c.r, c.g, c.b);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
/** A rounded rectangle (w by h, corners r) as a shape about its middle. */
function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = w / 2, y = h / 2;
  s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y);
  s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
  return s;
}
/** A slab of a shape, d deep, its back at z = 0, its front edges chamfered c. */
function plaque(shape, d, c) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - c, bevelEnabled: true, bevelThickness: c, bevelSize: c, bevelSegments: 1, curveSegments: 3 });
  return g.index ? g.toNonIndexed() : g;
}
/** A square plate floating (unit: 1 across, its middle at the origin): a chamfered slab, darker under its rim. */
function plateGeometry() {
  const t = 0.07, top = new THREE.CylinderGeometry(0.47, 0.5, t, 4, 1).rotateY(Math.PI / 4).translate(0, t / 2, 0);
  const under = new THREE.CylinderGeometry(0.5, 0.42, t * 1.2, 4, 1).rotateY(Math.PI / 4).translate(0, -t * 0.6, 0);
  return toned([top, under], [1.15, 0.6]);
}
/** A plate's two lenses (on its top and under it): a ring and its dot each (unit, as the plate). */
function plateLensGeometry() {
  const up = [new THREE.RingGeometry(0.14, 0.17, 20), new THREE.CircleGeometry(0.06, 12)].map((g) => g.rotateX(-Math.PI / 2).translate(0, 0.072, 0).toNonIndexed());
  const down = [new THREE.RingGeometry(0.14, 0.17, 20), new THREE.CircleGeometry(0.06, 12)].map((g) => g.rotateX(Math.PI / 2).translate(0, -0.086, 0).toNonIndexed());
  return mergeGeometries([...up, ...down]);
}
/** A floating island of the city's adobe (unit-ish: about s across): terraced blocks over a stepped keel, seeded. */
function islandParts(s, seed) {
  let k = seed * 9973 + 7;
  const rnd = () => ((k = (k * 16807) % 2147483647) / 2147483647);
  const top = [], side = [], under = [];
  // the deck and its terraces
  top.push(new THREE.BoxGeometry(s, s * 0.14, s * 0.8).translate(0, 0, 0));
  for (let i = 0; i < 6; i++) {
    const w = s * (0.18 + rnd() * 0.25), d = s * (0.16 + rnd() * 0.22), h = s * (0.08 + rnd() * 0.16);
    top.push(new THREE.BoxGeometry(w, h, d).translate((rnd() - 0.5) * s * 0.65, s * 0.07 + h / 2 - 0.3 - i * 0.07, (rnd() - 0.5) * s * 0.5));
  }
  for (let i = 0; i < 3; i++) { const w = s * (0.1 + rnd() * 0.12); side.push(new THREE.BoxGeometry(w, s * (0.2 + rnd() * 0.3), w).translate((rnd() - 0.5) * s * 0.5 + 0.13 * i, s * 0.2, (rnd() - 0.5) * s * 0.4 + 0.11 * i)); }
  // the keel: steps narrowing down
  let w = s * 0.85, d = s * 0.66, y = -s * 0.07;
  for (let i = 0; i < 4; i++) {
    const h = s * (0.1 + rnd() * 0.06);
    under.push(new THREE.BoxGeometry(w, h, d).translate((rnd() - 0.5) * s * 0.08, y - h / 2 + 0.35, (rnd() - 0.5) * s * 0.06));
    y -= h; w *= 0.68; d *= 0.7;
  }
  return { top, side, under };
}

// ------------------------------------------------------------------ placing the dressing
/** An instanced, drawn-only mesh of the dressing: walked through, never buried, never casting a shadow. */
function instanced(name, geo, mat, list, frame) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  m.name = `The Mooring-House skin: ${name}`; m.count = list.length;
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
    const o = p.group ?? p.mesh ?? p.root ?? p.object;
    if (o?.isObject3D) { b.setFromObject(o); const l = local(b), s = l.getSize(V()); if (!l.isEmpty() && Math.max(s.x, s.z) < 14 && s.y < 30) keep.add(l.expandByScalar(0.8)); }
    for (const q of [p.pos, p.center, p.home]) if (q?.isVector3) keep.add(new THREE.Box3().setFromCenterAndSize(K.local(q), V(3, 3, 3)));
  }
  return keep;
}

/** The kit's rooms (local): round rooms, halls and passages, as the shader takes them (round ones first). */
function roomsOf(plan) {
  const out = [];
  for (const e of plan) {
    if (e.kind === 'round' && e.oculus >= 0) out.push({ kind: 'round', x: e.x, z: e.z, r: e.r, y0: e.y, y1: e.y + e.h, e });
    else if (e.kind === 'hall') out.push({ kind: 'hall', x: e.x, z: e.z, hx: e.w / 2, hz: e.d / 2, y0: e.y, y1: e.y + e.h, e });
    else if (e.kind === 'corridor') out.push({ kind: 'corridor', x: (e.x0 + e.x1) / 2, z: (e.z0 + e.z1) / 2, hx: (e.x1 - e.x0) / 2, hz: (e.z1 - e.z0) / 2, y0: e.y, y1: e.y + e.h, e });
  }
  return [...out.filter((r) => r.kind === 'round'), ...out.filter((r) => r.kind === 'hall'), ...out.filter((r) => r.kind === 'corridor')];
}
const inRoom = (R, x, y, z) => y >= R.y0 - 0.5 && y <= R.y1 + 0.5 && (R.kind === 'round' ? Math.hypot(x - R.x, z - R.z) < R.r - 0.2 : Math.abs(x - R.x) < R.hx - 0.1 && Math.abs(z - R.z) < R.hz - 0.1);

/** The straight wall faces looking into a hall with a floor: { o, t (along), nrm (into the room), s0, s1, room, holes }. */
function faces(plan, rooms) {
  const out = [];
  for (const e of plan) {
    if (e.kind !== 'wall') continue;
    const t = V(e.dir[0], 0, e.dir[1]);
    for (const side of [1, -1]) {
      const nrm = V(e.dir[1], 0, -e.dir[0]).multiplyScalar(side);
      const o = V(e.a[0], e.y0, e.a[1]).addScaledVector(nrm, e.t / 2);
      let cur = null, from = 0;
      const flush = (to) => { if (cur && cur.kind === 'hall' && cur.e.floor && to - from > 4) out.push({ o, t, nrm, s0: from, s1: to, room: cur, holes: e.holes }); };
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

/** The ring lights (bezel, ring, lens) and the cable slots, into the kit's batches; the floating plates' matrices. */
function dress(rt, keep, rooms, mats) {
  const K = rt.kit, S = MOORING_SKIN, Rg = S.rings, out = { rings: 0, slots: 0, plates: [], islands: 0 };
  const clear = (c, half) => !keep.hits(new THREE.Box3(c.clone().sub(half), c.clone().add(half)));
  const bezelShape = roundRect(Rg.w, Rg.h, 0.32);
  const bezel = plaque(bezelShape, 0.1, 0.035);
  const well = new THREE.ShapeGeometry(roundRect(Rg.w - 0.22, Rg.h - 0.22, 0.24), 3).translate(0, 0, 0.16);
  const ring = new THREE.RingGeometry(0.34, 0.41, 28).translate(0, 0.1, 0.18), lens = new THREE.CircleGeometry(0.08, 12).translate(0, 0.1, 0.18);
  const tick = new THREE.PlaneGeometry(0.05, 0.22).translate(0, -0.52, 0.18);
  const bezelPaint = paint(S.slab), wellPaint = paint(S.dark);
  /** one ring light at p on a wall (t along it, nrm out of it into the room) */
  const ringAt = (p, t, nrm) => {
    const m = basis(p, t, V(0, 1, 0), nrm);
    K.add(bezelPaint, bezel.clone().applyMatrix4(m));
    K.add(wellPaint, well.clone().applyMatrix4(m));
    for (const g of [ring, lens, tick]) K.add(mats.glow, g.clone().applyMatrix4(m));
    keep.add(new THREE.Box3().setFromCenterAndSize(p.clone().addScaledVector(nrm, 0.2), V(Rg.w + 2.4, Rg.h + 1, 2.4)));
    out.rings++;
  };
  const half = V(Rg.w / 2 + 0.4, Rg.h / 2 + 0.3, 0.5);
  // round rooms: one against a stone every few, clear of their gaps
  for (const r of rooms) {
    if (r.kind !== 'round' || r.y1 - r.y0 < Rg.minH || !r.e.floor) continue;
    const e = r.e, step = TAU / e.seg, every = Math.max(2, Math.round(Rg.every / (step * e.r)));
    let n = 0;
    for (let i = 1; i < e.seg && n < Rg.n; i += every) {
      const a = (i + 0.5) * step;
      if ((e.gaps ?? []).some((g) => (g.y0 ?? 0) < 2 && Math.abs(Math.atan2(Math.sin(a - g.a), Math.cos(a - g.a))) * e.r < g.w / 2 + 2.2)) continue;
      const o = V(Math.sin(a), 0, Math.cos(a)), nrm = o.clone().negate(), t = V(Math.cos(a), 0, -Math.sin(a)).negate();
      const p = V(e.x, e.y + Rg.y, e.z).addScaledVector(o, e.r - 0.005);
      if (!clear(p.clone().addScaledVector(nrm, 0.3), half)) continue;
      ringAt(p, t, nrm); n++;
    }
  }
  // the halls with floors: along their walls
  const at = (f, s) => f.o.clone().addScaledVector(f.t, s);
  const freeOf = (f, s, w) => !f.holes.some((h) => h.y0 < 2 && s > h.x0 - w - 1.2 && s < h.x1 + w + 1.2);
  for (const f of faces(rt.kit.plan, rooms)) {
    if (f.room.y1 - f.room.y0 < Rg.minH) continue;
    const L = f.s1 - f.s0, k = Math.max(1, Math.floor(L / Rg.every));
    for (let i = 0; i < k; i++) {
      const s = f.s0 + ((i + 0.5) / k) * L, p = at(f, s).setY(f.o.y + Rg.y).addScaledVector(f.nrm, 0.01);
      if (!freeOf(f, s, Rg.w / 2) || !clear(p.clone().addScaledVector(f.nrm, 0.3), half)) continue;
      ringAt(p, f.t, f.nrm);
    }
  }
  // the cable slots in the capstan hall's wall: a slate frame, a dark slot, a teal line along its sill
  {
    const Sl = S.slots, H = S.hub;
    const frame = [
      new THREE.BoxGeometry(Sl.w + 0.5, 0.25, 0.16).translate(0, Sl.h / 2 + 0.125, 0.08), new THREE.BoxGeometry(Sl.w + 0.5, 0.25, 0.16).translate(0, -Sl.h / 2 - 0.125, 0.08),
      new THREE.BoxGeometry(0.25, Sl.h, 0.16).translate(-Sl.w / 2 - 0.125, 0, 0.08), new THREE.BoxGeometry(0.25, Sl.h, 0.16).translate(Sl.w / 2 + 0.125, 0, 0.08),
    ];
    const slot = new THREE.PlaneGeometry(Sl.w, Sl.h).translate(0, 0, 0.02), sill = new THREE.PlaneGeometry(Sl.w + 0.3, 0.05).translate(0, -Sl.h / 2 - 0.31, 0.012);
    for (const a of Sl.angles) {
      const o = V(Math.sin(a), 0, Math.cos(a)), nrm = o.clone().negate(), t = V(Math.cos(a), 0, -Math.sin(a)).negate();
      const p = V(H.x, Sl.y, H.z).addScaledVector(o, Sl.r - 0.005);
      const m = basis(p, t, V(0, 1, 0), nrm);
      for (const g of frame) K.add(bezelPaint, g.clone().applyMatrix4(m));
      K.add(paint('#0e0e12'), slot.clone().applyMatrix4(m));
      K.add(mats.glow, sill.clone().applyMatrix4(m));
      out.slots++;
    }
  }
  // the floating plates: n a room, in its box or round its middle, each clear of the pieces and of the others
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const Z of MOORING_PLATES) {
    let n = 0;
    for (let tries = 0; tries < 80 && n < Z.n; tries++) {
      let p;
      if (Z.round) {
        const a = rnd() * TAU, r = Z.r[0] + rnd() * (Z.r[1] - Z.r[0]);
        if (Z.skip && Math.abs(Math.atan2(Math.sin(a - Z.skip[0]), Math.cos(a - Z.skip[0]))) < Z.skip[1]) continue;
        p = V(Z.round[0] + Math.sin(a) * r, Z.y[0] + rnd() * (Z.y[1] - Z.y[0]), Z.round[1] + Math.cos(a) * r);
      } else {
        const [x0, y0, z0, x1, y1, z1] = Z.box;
        p = V(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), z0 + rnd() * (z1 - z0));
      }
      const size = 2.6 + rnd() * 1.8;
      if (!clear(p, V(size / 2 + 1, 1.2, size / 2 + 1)) || out.plates.some((q) => q.p.distanceTo(p) < size + 3.5)) continue;
      out.plates.push({ p, size, yaw: rnd() * Math.PI, tilt: (rnd() - 0.5) * 0.12, phase: rnd() * TAU });
      keep.add(new THREE.Box3().setFromCenterAndSize(p, V(size + 1, 1, size + 1)));
      n++;
    }
  }
  // the islands floating in the void, their cables slack toward the house (their own mesh: drawn only, far)
  {
    const parts = [], tones = [], C = (h) => new THREE.Color(h);
    const adobe = C('#dcbb92'), adobeSide = C('#c49c74'), keel = C('#9f7d62'), cable = C(S.paints.cable);
    MOORING_ISLANDS.forEach((I, i) => {
      const { top, side, under } = islandParts(I.s, i + 1), m = new THREE.Matrix4().makeRotationY(i * 1.7).setPosition(...I.at);
      for (const [list, c] of [[top, adobe], [side, adobeSide], [under, keel]]) for (const g of list) { parts.push(g.applyMatrix4(m)); tones.push(c); }
      // the cable: from under the island's deck's edge, sagging deep, to the house
      const a = V(...I.at).add(V(Math.sin(i * 1.7) * I.s * 0.3, -I.s * 0.05, Math.cos(i * 1.7) * I.s * 0.3)), b = V(...I.to);
      const sag = Math.max(8, a.distanceTo(b) * 0.22);
      const pts = Array.from({ length: 13 }, (_, j) => { const u = j / 12; return a.clone().lerp(b, u).add(V(0, -Math.sin(Math.PI * u) * sag, 0)); });
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.22, 4, false)); tones.push(cable);
      out.islands++;
    });
    out.islandGeometry = coloured(parts, tones);
  }
  return out;
}

/** The floating plates bobbing (still on the lighter presets, their lenses hidden there). */
class SkinLife {
  constructor(plates, body, lenses, frame) { this.plates = plates; this.body = body; this.lenses = lenses; this.frame = frame; this.m = new THREE.Matrix4(); this.still = null; }
  update(dt, t = 0) {
    const lite = sharedUniforms.uWearLite.value > 0.5;
    if (this.lenses.visible === lite) this.lenses.visible = !lite;
    if (lite && this.still) return;
    this.still = lite;
    this.plates.forEach((P, i) => { this.m.multiplyMatrices(this.frame, plateMatrix(P, lite ? 0 : t)); this.body.setMatrixAt(i, this.m); this.lenses.setMatrixAt(i, this.m); });
    this.body.instanceMatrix.needsUpdate = true; this.lenses.instanceMatrix.needsUpdate = true;
  }
}
/** A floating plate's matrix (local) at time t: a slow bob and sway. */
function plateMatrix(P, t) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(P.tilt + 0.03 * Math.sin(t * 0.4 + P.phase), P.yaw, P.tilt * 0.5));
  return new THREE.Matrix4().compose(P.p.clone().setY(P.p.y + 0.18 * Math.sin(t * 0.5 + P.phase)), q, V(P.size, P.size, P.size));
}

// ------------------------------------------------------------------ the skin
/**
 * The Mooring-House's skin (its def's `skin`, src/temples/skins/index.js): called before the layout. Swaps rt.M's
 * surfaces for its own and starts the kit's plan; spacecity.js's layout asks it for its house paints, the capstan's
 * drum, the starlight lines and the Anchor-Warden's colours (skin.house).
 */
export function mooringHouseSkin(rt) {
  const K = rt.kit, M = rt.M, S = MOORING_SKIN, look = rt.def.palette?.look?.all ?? {};
  const U = {
    origin: { value: K.origin.clone() }, rot: { value: new THREE.Vector2(Math.cos(K.yaw), Math.sin(K.yaw)) },
    rooms: { value: Array.from({ length: MOORING_ROOMS }, () => new THREE.Vector4()) },
    roomsY: { value: Array.from({ length: MOORING_ROOMS }, () => new THREE.Vector4()) },
    count: { value: 0 },
    lips: { value: new THREE.Vector4(-999, -999, -999, -999) },
    hub: { value: new THREE.Vector4(S.hub.x, S.hub.z, S.hub.r, S.hub.well) },
  };
  const own = (k, o) => makeMaterial({ flat: true, ...o, key: `temple.skin.mooring.${k}` });
  const glow = own('glow', { color: S.teal, glow: S.emit.line + 0.04 });
  const mats = {
    wall: skinMaterial('wall', { ...look, hatch: 0.15 }, S.wall, U, 'wall'),
    machine: skinMaterial('wall', { ...look, hatch: 0.2 }, S.machine, U, 'machine'),
    floor: skinMaterial('floor', { ...look, hatch: 0.35 }, S.floor, U, 'floor'),
    drum: skinMaterial('drum', { ...look, hatch: 0.2 }, S.drum, U, 'drum'),
    // (the pieces' own, in their own frame: they move with the cradle, the pan, the gangway and the doors' leaves)
    floorObj: skinMaterial('floor', { ...look, hatch: 0.35 }, S.floor, U, 'floorObj', true),
    machineObj: skinMaterial('wall', { ...look, hatch: 0.2 }, { ...S.machine, cell: [1.75, 2.25] }, U, 'machineObj', true),
    glow,
    glyph: own('glyph', { color: S.glyph, glow: 0.7 }),
    trimMat: own('fitting', { color: S.brass, metal: 'brass', refl: 0.12 }),
    stoneMat: own('ball', { ...look, color: S.ball, metal: 'iron', refl: 0.4, highlight: 0.3 }),
    // the floating plates' slate (vertex tones: the top lighter, the rim under it darker)
    plate: own('plate', { ...look, color: S.slab, hatch: 0.1, vertexColors: true }),
    island: own('island', { ...look, color: '#ffffff', hatch: 0.25, vertexColors: true }),
  };
  const was = { ...M };
  Object.assign(M, {
    wall: mats.wall, wallGlyph: mats.machine, floor: mats.floor, trimMat: mats.trimMat, stoneMat: mats.stoneMat, glyph: mats.glyph,
    trim: paint(S.trim), dark: paint(S.dark), stone: paint(S.stone), accent: paint(S.trim),
    // (no teal and coral courses: one dark ledge course, as the picks' walls have, at three fifths of their height)
    bands: [{ at: 0.6, h: 0.4, mat: paint('#2b2a34') }],
    // (the frieze's moorers' rings dark metal, the line under every other teal)
    ornament: { kind: 'mooring', mats: { a: paint('#3c3b46'), b: glow } },
  });
  K.plan = [];
  const meshes = [];
  const skin = {
    name: 'mooring-house', S, mats, U, meshes, stats: null, light: S.light,
    /** what spacecity.js's layout draws in: its paints, the capstan's drum, the starlight lines, the warden's colours */
    house: {
      brass: paint(S.paints.brass), iron: paint(S.paints.iron), cable: paint(S.paints.cable, { side: THREE.DoubleSide }),
      drum: mats.drum, star: glow, warden: S.warden, wrap: false,
    },
    /** After the layout: the rooms handed to the shader, the pieces' surfaces, the dressing. */
    dress() {
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      const rooms = roomsOf(K.plan), list = rooms.slice(0, MOORING_ROOMS);
      list.forEach((r, i) => {
        U.rooms.value[i].set(r.x, r.z, r.kind === 'round' ? r.r : r.hx, r.kind === 'round' ? -1 : r.hz);
        U.roomsY.value[i].set(r.y0, r.y1, r.kind === 'corridor' ? 1 : 0, 0);
      });
      U.count.value = list.length;
      // (the landings' lips: every floor over the lowest, where a slab's edge looks down into the void)
      const lips = [...new Set(rooms.filter((r) => r.kind !== 'corridor').map((r) => r.y0))].sort((a, b) => a - b);
      const hi = lips.filter((y) => y > lips[0] + 1).slice(0, 4);
      U.lips.value.set(...[...hi, -999, -999, -999, -999].slice(0, 4));
      for (const p of rt.pieces) {
        const o = p.group ?? p.mesh ?? p.root;
        o?.traverse?.((m) => { if (m.material === mats.floor) m.material = mats.floorObj; else if (m.material === mats.machine) m.material = mats.machineObj; });
      }
      const keep = keepOuts(rt, new Set([mats.wall, mats.machine, mats.floor, mats.drum, M.voidM]));
      const d = dress(rt, keep, rooms, mats);
      const local = d.plates.map((P) => plateMatrix(P, 0));
      const body = instanced('floating plates', plateGeometry(), mats.plate, local, K.frame);
      const lenses = instanced('floating plates’ lenses', plateLensGeometry(), glow, local, K.frame);
      body.instanceMatrix.setUsage(THREE.DynamicDrawUsage); lenses.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      meshes.push(body, lenses);
      // the islands: one mesh, drawn only, out of the shadow passes, never cut into tiles
      const isl = new THREE.Mesh(d.islandGeometry.applyMatrix4(K.frame), mats.island);
      isl.name = 'The Mooring-House skin: islands in the void';
      Object.assign(isl.userData, { noCollide: true, keepBuried: true, skin: true, dynamic: true, castShadow: false });
      isl.castShadow = false;
      meshes.push(isl);
      for (const m of meshes) K.group.add(m);
      rt.pieces.push(new SkinLife(d.plates, body, lenses, K.frame));
      skin.stats = { rooms: list.length, rings: d.rings, slots: d.slots, plates: d.plates.length, islands: d.islands, ms: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0) };
    },
    /** After the kit's flush: the lit surfaces out of the shadow passes, the house's own materials back for its exterior. */
    done() {
      for (const m of K.group.children) if (m.material === glow || m.material === mats.glyph) { m.castShadow = false; m.userData.castShadow = false; }
      Object.keys(M).forEach((k) => { if (!(k in was)) delete M[k]; });
      Object.assign(M, was);
      K.plan = null;
    },
  };
  return skin;
}
