import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, sharedUniforms } from '../../materials.js';
import { paint } from '../kit.js';

// ---------------------------------------------------------------------------
// The Aerie in its futuristic skin (issue #342, docs/systems/temples.md "Futuristic skins"): the inside of the makers'
// house on Vael's plain redrawn after the author's picks (references/temples/future/aerie/sheet-1.jpg, sheet-2.jpg): a
// round shaft of dark slate in tall vertical slabs with chamfered edges, thin pale peach circuits ringing it in pairs and
// climbing it between the rings, warm grey floor plates with peach rings inlaid round the vents, a turbine of machined
// blades in every great vent's grille, ochre sand on the ledges and the balconies with a lit peach rim along their edges,
// floating discs and hexagons with glowing rims high round the shafts, a row of lit slots along every frieze. Look only:
// the same rooms, doors, collision, pieces, positions, timings and logic (skins/index.js; tests/temple-skins.test.js).
//   1. surfaces: the wall, the makers' marked metal (doors, the hall's screens: wallGlyph), the floor and the trim swapped
//      for the skin's: the surface shader with its albedo, its first pen lines and its glow replaced, as
//      landmark-materials.js stone() does. A round room's slabs run round it without a seam (the rooms the kit recorded,
//      uSkR). A floor at its room's own floor is slate; anything higher (a ledge, a balcony, the perch, a lip, a riding
//      disc) is the drawings' ochre sand.
//   2. the glow: the circuits, the floors' inlays, the doors' seams, the rings round the vents' throats and the stones'
//      cups, the vent mouths' and the great eye's rims, the wing lines up the well (arzach.js's own, recoloured), the bands'
//      lines, the ledges' rims, the slots and the glyphs: peach, just over the post pass's halo start (0.62: AERIE.emit), so
//      lines stay crisp; breathing slowly up the shaft.
//   3. dressing, drawn only (InstancedMeshes: noCollide, keepBuried, dynamic, out of the shadow passes): turbines in the
//      great vents' grilles, turning while the wind rises; floating discs and hexagons high round the round rooms and the
//      gulf, kept off every doorway, piece, wind column and ledge; the lit rims along the raised slabs' edges; a lit line
//      round each great band of the well.
// On Low, Handheld and the Deck (uWearLite) the shader leaves out the slabs' tones and chamfers and the climbing
// circuits, and only half the floating plates are drawn.
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
/** Up to this many rooms are handed to the shader (the round ones first). */
export const AERIE_ROOMS = 16;

/** The skin's colours (sRGB, after the picks' pixels) and sizes (m). */
export const AERIE = {
  peach: '#ffbe98',
  /** the slate: its slabs' two tones, the grooves; panel heights (m: tall, few joints), slab cells (m), a ring of
   *  circuits every n m, a ceiling's rings (m) */
  wall: { color: '#555960', a: '#50545b', b: '#5d6169', c: '#33363d', panel: 15, cell: 1.35, band: 6.5, ceil: 3.2 },
  /** the makers' machined metal: doors, the hall's screens (panels m) */
  metal: { color: '#4b4f57', a: '#464a52', b: '#555a63', c: '#2c2f36', panel: 1.6 },
  /** the trim (kerbs, caps, feathers of stone, the eye's lid): a lighter machined slate, no lit seams */
  trim: { color: '#6a6d74', a: '#65686f', b: '#72757c', c: '#3b3e45', panel: 2.4 },
  /** the floors' plates (m): warm grey at a room's floor, as the picks', ochre sand higher up */
  floor: { color: '#7d7571', a: '#78706c', b: '#857d78', c: '#5d5652', plate: 3.0 },
  sand: { a: '#cba982', b: '#d6b68e', side: '#9a7d63' },
  /** the bands across the walls (kit.js M.bands): a dark plinth and a dark course under the frieze */
  bands: [{ y: 0.4, h: 0.8, color: '#3c3f46' }, { at: 0.72, h: 0.9, color: '#45484f' }],
  stone: '#6f7279',
  turbine: { blade: '#4a4d55', edge: '#9a9ca2', frame: '#3a3d44' },
  plate: { top: '#d0ae86', side: '#9c7f65' },
  /** how bright the skin's lights are (makeMaterial glow; post.js haloes over 0.62: just over it keeps a halo tight) */
  emit: { glyph: 0.72, slot: 0.7, ring: 0.67, rim: 0.74, lines: 0.76, wing: 0.76 },
};

// ------------------------------------------------------------------ the surfaces: the shader's patterns
// (declared before main(): the surface shader's hash, vnoise, uTime, uPixelRatio and uWearLite are in scope by then)
const SK_PARS = /* glsl */ `
  uniform vec3 uSkinO;
  uniform vec4 uSkR[${AERIE_ROOMS}];
  uniform vec4 uSkY[${AERIE_ROOMS}];
  uniform int uSkN;
  uniform vec3 uSkA;
  uniform vec3 uSkB;
  uniform vec3 uSkC;
  uniform vec3 uSkS;
  uniform vec3 uSkT;
  uniform vec3 uSkU;
  uniform vec3 uSkG;
  uniform vec4 uSkP;
  uniform float uSkObj;
`;
const SK_GLSL = /* glsl */ `
  float skH1(float x) { return fract(sin(x * 91.3458) * 47453.5453); }
  float skH2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // a pen line d metres from its middle, px metres a pixel
  float skInkL(float d, float px) { float w = 0.5 * uPixelRatio * px; return 1.0 - smoothstep(w, w + px * 1.1, d); }
  // a thin lit line (half width hw m, never under ~0.6 px), its coverage
  float skLit(float d, float px, float hw) { float w = max(hw, 0.6 * px); return 1.0 - smoothstep(w, w + px, d); }
  // along a wall: (m round a round room the kit recorded, its circumference), else (by the face's axis, 0)
  vec2 skAlong(vec3 p, vec3 nn) {
    for (int i = 0; i < ${AERIE_ROOMS}; i++) {
      if (i >= uSkN) break;
      vec4 R = uSkR[i];
      if (R.w >= 0.0) continue;
      vec2 d = p.xz - R.xy;
      float r = length(d);
      if (abs(r - R.z) < 1.9 && p.y > uSkY[i].x - 1.0 && p.y < uSkY[i].y + 1.5 && abs(dot(nn.xz, d)) > 0.8 * r * length(nn.xz))
        return vec2((atan(d.y, d.x) + 3.14159265) * R.z, 6.2831853 * R.z);
    }
    return vec2(abs(nn.x) > abs(nn.z) ? p.z : p.x, 0.0);
  }
  // the room over or under p: its rect or circle (x, z, half x or r, half z or -1), its floor and ceiling (Y); false: none
  bool skRoomOf(vec3 p, out vec4 R, out vec4 Y) {
    for (int i = 0; i < ${AERIE_ROOMS}; i++) {
      if (i >= uSkN) break;
      R = uSkR[i]; Y = uSkY[i];
      if (p.y < Y.x - 0.8 || p.y > Y.y + 2.0) continue;
      vec2 d = p.xz - R.xy;
      if (R.w < 0.0 ? length(d) < R.z + 1.6 : (abs(d.x) < R.z + 1.4 && abs(d.y) < R.w + 1.4)) return true;
    }
    return false;
  }
  // a seam's distance (m) in a run of cells of size s: q the coordinate (m)
  float skSeam(float q, float s) { float f = fract(q / s); return min(f, 1.0 - f) * s; }
  // is there a joint at the left of slab cell i (of n round a round room)? Slabs one to three cells wide
  bool skJ(float i, float n) { float k = n > 0.5 ? mod(i, n) : i; return skH1(k * 1.37 + 0.5) > 0.42 || mod(k, 3.0) < 0.5; }
`;

/**
 * Each pattern replaces the surface's `vec3 albedo = uColor;` (its first pen lines: skInk; its glow: skGlow, added to
 * the surface's emit before the light). uSkP: the skin's sizes; uSkG: the glow's colour.
 *   slate: the walls. Tall vertical slabs (cells of uSkP.y m, one to three a slab; a joint across one every uSkP.x m or
 *     so, staggered), each its tone between uSkA and uSkB, a chamfer lit down its left edge and shaded down its right,
 *     the joints inked. Every uSkP.z m a pair of thin peach lines round the wall (most lit), and from some joints a line
 *     climbing to the next pair, stepping sideways once on its way. Ceilings: rings of slabs round their room's middle.
 *   metal: the makers' machined panels (uSkP.x m), seams inked, chamfered, a peach seam down some (uSkP.y > 0).
 *   plates: the floors. At a room's own floor: warm grey plates (uSkP.x m) in rings round a round room's middle, in a
 *     grid in a hall, a peach inlay round each room 1.6 m in from its walls (a round room's doubled, and a ring and
 *     four spokes round its middle). Higher (a ledge, a balcony, the perch, a riding disc): ochre sand plates.
 */
const BODIES = {
  slate: /* glsl */ `
    vec3 skP = uSkObj > 0.5 ? vObjPos : vWorldPos - uSkinO;
    float skPx = max(max(length(dFdx(skP)), length(dFdy(skP))), 1e-4);
    float skInk = 0.0, skGlow = 0.0;
    vec3 albedo = uColor;
    {
      bool lite = uWearLite > 0.5;
      float pulse = 0.8 + 0.2 * sin(uTime * 0.8 - skP.y * 0.09);
      if (abs(n.y) < 0.65) {
        vec2 A = uSkObj > 0.5 ? vec2(abs(n.x) > abs(n.z) ? skP.z : skP.x, 0.0) : skAlong(skP, n);
        float along = A.x;
        float CW = uSkP.y, NC = 0.0;
        if (A.y > 0.5) { NC = max(1.0, floor(A.y / CW + 0.5)); CW = A.y / NC; }
        float cx = along / CW, ci = floor(cx), cf = fract(cx);
        bool jl = skJ(ci, NC), jr = skJ(ci + 1.0, NC);
        // the slab this cell is part of: from the joint at its left
        float s0 = ci;
        for (int k = 0; k < 3; k++) { if (skJ(s0, NC)) break; s0 -= 1.0; }
        float dl = jl ? cf * CW : 99.0, dr = jr ? (1.0 - cf) * CW : 99.0, dv = min(dl, dr);
        // a joint across it every so often: tall panels, few joints, staggered slab to slab
        float HH = uSkP.x * (0.75 + 0.5 * skH1(s0 * 3.1 + 0.7));
        float hy = skP.y / HH + skH1(s0 * 1.93), hi = floor(hy), hf = fract(hy);
        float dh = min(hf, 1.0 - hf) * HH;
        float near = 1.0 - smoothstep(CW / 40.0, CW / 12.0, skPx);
        if (!lite) {
          float t = skH2(vec2(s0, hi) + 0.37);
          albedo = mix(uColor, mix(uSkA, uSkB, t), 0.8 * near + 0.2);
          // (the chamfers: lit down a slab's left edge, in shade down its right, as the drawings' crisp slabs)
          float ch = 0.1;
          albedo *= 1.0 + near * (0.16 * (1.0 - smoothstep(ch * 0.55, ch, dl)) - 0.14 * (1.0 - smoothstep(ch * 0.55, ch, dr)));
          skInk = max(skInk, skInkL(abs(dl - ch), skPx) * 0.3 * near);
        }
        skInk = max(skInk, max(skInkL(dv, skPx) * 0.75, skInkL(dh, skPx) * 0.7) * near);
        // the rings of circuits: every uSkP.z m a pair of thin lit lines round the wall (most of them lit)
        float BH = uSkP.z, by = skP.y - 3.4, bi = floor(by / BH), bf = by - bi * BH;
        float on = step(0.22, skH1(bi * 5.3 + 2.0)) * step(0.0, by);
        float c = max(skLit(abs(bf), skPx, 0.036), skLit(abs(bf - 0.32), skPx, 0.022)) * on;
        // ... and from some joints a line climbing to the next ring, stepping sideways once on its way
        if (!lite && jl) {
          float onU = step(0.22, skH1((bi + 1.0) * 5.3 + 2.0));
          float has = step(0.62, skH1(mod(ci, max(NC, 1e5)) * 7.7 + bi * 3.1)) * on * onU;
          float jy = 1.2 + skH1(ci * 2.9 + bi) * (BH - 2.4), jx = 0.5 * CW;
          float x = cf * CW, xl = bf < jy ? 0.22 : 0.22 + jx;
          float v = skLit(abs(x - xl), skPx, 0.018) * step(0.3, bf);
          v = max(v, skLit(abs(bf - jy), skPx, 0.018) * step(0.22, x) * step(x, 0.22 + jx));
          c = max(c, v * has);
        }
        skGlow = max(skGlow, c);
      } else if (n.y < 0.0) {
        // a ceiling: rings of slabs round its room's middle; a grid in a hall
        vec4 R, Y;
        if (uSkObj < 0.5 && skRoomOf(skP, R, Y) && R.w < 0.0) {
          vec2 d = skP.xz - R.xy;
          float r = length(d), RS = uSkP.w, ri = floor(r / RS);
          float nseg = max(6.0, floor(6.2831853 * (ri + 0.5) * RS / 2.6 + 0.5));
          float aq = (atan(d.y, d.x) + 3.14159265) / 6.2831853 * nseg + skH1(ri);
          float da = min(fract(aq), 1.0 - fract(aq)) / nseg * 6.2831853 * r;
          skInk = max(skInkL(skSeam(r, RS), skPx), skInkL(da, skPx)) * 0.7;
          if (!lite) albedo = mix(uSkA, uSkB, skH2(vec2(floor(aq), ri)));
          if (Y.z > 0.0) skGlow = skLit(abs(r - Y.z - 0.9), skPx, 0.04);
        } else {
          skInk = max(skInkL(skSeam(skP.x, 3.0), skPx), skInkL(skSeam(skP.z, 3.0), skPx)) * 0.6;
        }
      } else {
        skInk = max(skInkL(skSeam(skP.x, 2.4), skPx), skInkL(skSeam(skP.z, 2.4), skPx)) * 0.5;
      }
      skGlow *= pulse;
      albedo = mix(albedo, uSkG, skGlow);
      skInk *= 1.0 - skGlow;
      skGlow *= SK_LINES;   // (the light the lines give: just over the post pass's halo, so they stay crisp)
    }
  `,
  metal: /* glsl */ `
    vec3 skP = uSkObj > 0.5 ? vObjPos : vWorldPos - uSkinO;
    float skPx = max(max(length(dFdx(skP)), length(dFdy(skP))), 1e-4);
    float skInk = 0.0, skGlow = 0.0;
    vec3 albedo = uColor;
    {
      vec3 an = abs(n);
      vec2 uv = an.y > an.x && an.y > an.z ? skP.xz : (an.x > an.z ? skP.zy : skP.xy);
      float S = uSkP.x;
      vec2 q = uv / S, ci = floor(q), cf = fract(q);
      float near = 1.0 - smoothstep(S / 40.0, S / 14.0, skPx);
      float dx = min(cf.x, 1.0 - cf.x) * S, dy = min(cf.y, 1.0 - cf.y) * S;
      if (uWearLite < 0.5) {
        albedo = mix(uColor, mix(uSkA, uSkB, skH2(ci + 0.71)), 0.6 * near);
        float ch = 0.06;
        albedo *= 1.0 + near * (0.15 * (1.0 - smoothstep(ch * 0.6, ch, (1.0 - cf.y) * S)) - 0.13 * (1.0 - smoothstep(ch * 0.6, ch, cf.y * S)));
        skInk = max(skInk, max(skInkL(abs((1.0 - cf.y) * S - ch), skPx), skInkL(abs(cf.x * S - ch), skPx)) * 0.28 * near);
      }
      skInk = max(skInk, max(skInkL(dx, skPx), skInkL(dy, skPx)) * 0.75 * near);
      // a peach seam down some panels' joints (not the trim's)
      float lit = step(0.6, skH1(floor(q.x + 0.5) * 3.9 + 1.7)) * step(0.5, uSkP.y);
      skGlow = skLit(dx, skPx, 0.022) * lit * (0.8 + 0.2 * sin(uTime * 1.1 + skP.y * 0.3));
      albedo = mix(albedo, uSkG, skGlow);
      skInk *= 1.0 - skGlow;
      skGlow *= SK_LINES;
    }
  `,
  plates: /* glsl */ `
    vec3 skP = uSkObj > 0.5 ? vObjPos : vWorldPos - uSkinO;
    float skPx = max(max(length(dFdx(skP)), length(dFdy(skP))), 1e-4);
    float skInk = 0.0, skGlow = 0.0;
    vec3 albedo = uColor;
    {
      bool lite = uWearLite > 0.5;
      float S = uSkP.x, near = 1.0 - smoothstep(S / 40.0, S / 14.0, skPx);
      vec4 R = vec4(0.0, 0.0, 2.2, -1.0), Y = vec4(0.0);
      bool inRoom = uSkObj > 0.5 ? false : skRoomOf(skP, R, Y);
      // (at a room's own floor: slate plates; anything higher, or a riding disc: the drawings' ochre sand)
      bool low = inRoom && skP.y < Y.x + 0.6;
      vec3 cA = low ? uSkA : uSkS, cB = low ? uSkB : uSkT;
      albedo = low ? uColor : mix(uSkS, uSkT, 0.5);
      if (n.y > 0.65) {
        float t = 0.5;
        if (uSkObj > 0.5) {
          // a riding disc: rings of plates round its middle, a peach ring inlaid by its rim
          vec2 d = skP.xz;
          float r = length(d), RS = 0.8, ri = floor(r / RS);
          float nseg = max(4.0, floor(6.2831853 * (ri + 0.5) * RS / 1.4 + 0.5));
          float aq = (atan(d.y, d.x) + 3.14159265) / 6.2831853 * nseg + skH1(ri * 1.7);
          float da = min(fract(aq), 1.0 - fract(aq)) / nseg * 6.2831853 * r;
          skInk = max(skInkL(skSeam(r, RS), skPx), skInkL(da, skPx) * step(1.0, ri)) * 0.55 * near;
          t = skH2(vec2(floor(aq), ri));
          skGlow = skLit(abs(r - 1.75), skPx, 0.04);
        } else if (inRoom && R.w < 0.0) {
          // rings of plates round the middle; at the room's floor the inlays: two rings 1.6 m in from the wall, a ring
          // round the middle and four spokes between
          vec2 d = skP.xz - R.xy;
          float r = length(d), RS = S, ri = floor(r / RS);
          float nseg = max(4.0, floor(6.2831853 * (ri + 0.5) * RS / S + 0.5));
          float aq = (atan(d.y, d.x) + 3.14159265) / 6.2831853 * nseg + skH1(ri * 1.7);
          float da = min(fract(aq), 1.0 - fract(aq)) / nseg * 6.2831853 * r;
          skInk = max(skInkL(skSeam(r, RS), skPx), skInkL(da, skPx) * step(1.0, ri)) * 0.6 * near;
          t = skH2(vec2(floor(aq), ri));
          if (low && R.z > 8.0) {
            float ro = R.z - 1.6, rm = 0.42 * R.z;
            skGlow = max(max(skLit(abs(r - ro), skPx, 0.045), skLit(abs(r - ro + 0.4), skPx, 0.022)), skLit(abs(r - rm), skPx, 0.035));
            float an = atan(d.y, d.x) + 0.3927, sp = abs(fract(an / 1.5707963 + 0.5) - 0.5) * 1.5707963 * r;
            skGlow = max(skGlow, skLit(sp, skPx, 0.025) * step(rm, r) * step(r, ro - 0.4));
          }
        } else {
          // a grid of plates (from the room's middle); the inlay round the room 1.6 m in
          vec2 d = skP.xz - R.xy;
          vec2 g = (d + (inRoom ? vec2(0.0) : vec2(0.5 * S))) / S, gi = floor(g), gf = fract(g);
          skInk = max(skInkL(min(gf.x, 1.0 - gf.x) * S, skPx), skInkL(min(gf.y, 1.0 - gf.y) * S, skPx)) * 0.6 * near;
          t = skH2(gi + 0.13);
          if (low) {
            float e = max(abs(d.x) - R.z, abs(d.y) - R.w);
            skGlow = skLit(abs(e + 1.6), skPx, 0.04) * step(4.0, min(R.z, R.w));
          }
        }
        if (!lite) albedo = mix(albedo, mix(cA, cB, t), 0.7 * near + 0.2);
      } else if (n.y < -0.65) {
        // a floor's underside, the ceiling of the room under it: slate
        albedo = SK_UNDER;
        skInk = max(skInkL(skSeam(skP.x, 3.0), skPx), skInkL(skSeam(skP.z, 3.0), skPx)) * 0.6;
      } else {
        // a slab's or a ledge's edge: its side darker, a course line under its top
        albedo = low ? uColor * 0.85 : uSkU;
        float top = fract(skP.y / 0.8);
        skInk = skInkL(min(top, 1.0 - top) * 0.8, skPx) * 0.4 * near;
      }
      skGlow *= 0.82 + 0.18 * sin(uTime * 0.7 + length(skP.xz) * 0.15);
      albedo = mix(albedo, uSkG, skGlow);
      skInk *= 1.0 - skGlow;
      skGlow *= SK_LINES;
    }
  `,
};

/** The surface material of a skin's pattern: makeMaterial's own, its albedo, first pen lines and glow the pattern's. */
function skinMaterial(body, look, pat, U, key, obj = false) {
  const m = makeMaterial({ flat: true, ...look, color: pat.color, key: `temple.skin.${key}` });
  // (the house's rooms and origin, this build's: a material from the cache is pointed at them again)
  Object.assign(m.uniforms, { uSkinO: U.origin, uSkR: U.rooms, uSkY: U.roomsY, uSkN: U.count });
  if (m.userData.houseSkin) return m;
  m.userData.houseSkin = body;
  const fs = m.fragmentShader, at = fs.lastIndexOf('void main()');
  const u = new THREE.Color(AERIE.wall.color), under = `#define SK_UNDER vec3(${u.r.toFixed(4)}, ${u.g.toFixed(4)}, ${u.b.toFixed(4)})\n#define SK_LINES ${AERIE.emit.lines.toFixed(3)}\n`;
  const LIGHT = 'L = mix(L, 1.0, max(uGlow, emit));';
  if (at < 0 || !fs.includes('vec3 albedo = uColor;') || !fs.includes('float detail = 0.0;') || !fs.includes(LIGHT)) throw new Error('skins/aerie.js: the surface shader changed: no albedo, light or detail line to replace');
  m.fragmentShader = SK_PARS + under + fs.slice(0, at) + SK_GLSL + fs.slice(at)
    .replace('vec3 albedo = uColor;', BODIES[body])
    .replace(LIGHT, `emit = max(emit, skGlow); ${LIGHT}`)
    .replace('float detail = 0.0;', 'float detail = skInk;');
  const S = AERIE.sand;
  Object.assign(m.uniforms, {
    uSkA: { value: new THREE.Color(pat.a ?? pat.color) }, uSkB: { value: new THREE.Color(pat.b ?? pat.color) }, uSkC: { value: new THREE.Color(pat.c ?? pat.color) },
    uSkS: { value: new THREE.Color(S.a) }, uSkT: { value: new THREE.Color(S.b) }, uSkU: { value: new THREE.Color(S.side) },
    uSkG: { value: new THREE.Color(AERIE.peach) },
    uSkP: { value: new THREE.Vector4(...[...pat.size, 0, 0, 0, 0].slice(0, 4)) },
    uSkObj: { value: obj ? 1 : 0 },
  });
  return m;
}

// ------------------------------------------------------------------ the dressing's shapes
/** Vertex colours over a geometry (non-indexed), all one colour. */
function tinted(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
/**
 * A turbine in a vent's grille (radius 1: scaled to the vent's), as the picks' floor grilles: a ring of machined blades,
 * each pitched about its own length, between a hub ring and an outer frame, standing a hand's breadth over the floor
 * (TURBINE: radii and heights, m before scaling, y not scaled), clear of the plate in the middle and the ring round it.
 */
export const TURBINE = { r0: 0.48, r1: 0.9, blades: 26, pitch: 0.62, y: 0.1 };
function turbineGeometry(S) {
  const { r0, r1, blades, pitch, y } = TURBINE, parts = [], len = r1 - r0 - 0.03;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * TAU;
    const b = new THREE.BoxGeometry(len, 0.012, 0.085).rotateX(pitch).translate((r0 + r1) / 2, y, 0).rotateY(a);
    parts.push(tinted(b, S.blade));
    // (a pale edge along each blade's leading side, as the picks' crisp machined blades)
    parts.push(tinted(new THREE.BoxGeometry(len, 0.014, 0.012).translate((r0 + r1) / 2, y + 0.026, 0.035).rotateY(a), S.edge));
  }
  const ring = (a, b, h, yy, c) => tinted(new THREE.CylinderGeometry(b, b, h, 48, 1, true).translate(0, yy, 0), c);
  parts.push(ring(r0, r0, 0.07, y, S.frame), ring(r1, r1, 0.07, y, S.frame));
  // (the frames' tops: flat rings, a little over the blades)
  parts.push(tinted(new THREE.RingGeometry(r0 - 0.02, r0 + 0.02, 48).rotateX(-Math.PI / 2).translate(0, y + 0.036, 0), S.edge));
  parts.push(tinted(new THREE.RingGeometry(r1 - 0.025, r1 + 0.02, 48).rotateX(-Math.PI / 2).translate(0, y + 0.036, 0), S.edge));
  return mergeGeometries(parts);
}
/** A floating plate (radius 1, 1 thick before scaling): a disc or a hexagon, ochre sand on top, its side darker. */
function plateGeometry(sides, P) {
  const g = new THREE.CylinderGeometry(1, 0.94, 1, sides, 1).toNonIndexed(), pos = g.attributes.position, nrm = g.attributes.normal;
  const top = new THREE.Color(P.top), side = new THREE.Color(P.side), under = new THREE.Color(P.side).multiplyScalar(0.8), a = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const ny = nrm.getY(i), c = ny > 0.5 ? top : ny < -0.5 ? under : side; a.set([c.r, c.g, c.b], i * 3); }
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
/** A floating plate's lit rim: a thin band round its side, a hair proud of it, a third of the way down. */
const rimGeometry = (sides) => new THREE.CylinderGeometry(1.012, 1.008, 0.14, sides, 1, true).translate(0, 0.16, 0).toNonIndexed();

/**
 * The frieze's glyphs (and the threshold's) are the kit's own, the shared makers' mark (src/story/sign-text.js
 * glyphGeometry), lit in the skin's peach: counted, never redrawn (tests/temple-skins.test.js).
 */
const countSigns = (K, mat) => K.batches.get(mat)?.filter((g) => g.userData.makersMark).length ?? 0;

// ------------------------------------------------------------------ placing the dressing
/** An instanced, drawn-only mesh of the dressing: walked through, never buried, never casting a shadow. */
function instanced(name, geo, mat, list, frame) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  m.name = name; m.count = list.length;
  list.forEach((l, i) => m.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(frame, l.m ?? l)));
  m.instanceMatrix.needsUpdate = true;
  m.userData.noCollide = true; m.userData.keepBuried = true; m.userData.skin = true;
  // (one draw a pass for the whole house's, never cut into tiles nor given levels of detail: perf.js, lod.js)
  m.userData.dynamic = true;
  m.castShadow = false; m.receiveShadow = true;
  m.userData.castShadow = false;   // (out of every shadow pass: shadows.js draws all but those that opt out)
  m.computeBoundingSphere();
  return m;
}

/** Boxes keeping the dressing off something (local metres), in a grid of cells. */
class Keep {
  constructor() { this.cells = new Map(); this.size = 4; }
  *keys(b) {
    const s = this.size;
    for (let i = Math.floor(b.min.x / s); i <= Math.floor(b.max.x / s); i++) for (let j = Math.floor(b.min.y / s); j <= Math.floor(b.max.y / s); j++) for (let k = Math.floor(b.min.z / s); k <= Math.floor(b.max.z / s); k++) yield `${i},${j},${k}`;
  }
  add(b) {
    if (!Number.isFinite(b.min.x + b.max.x + b.min.y + b.max.y + b.min.z + b.max.z)) return;
    for (const key of this.keys(b)) { if (!this.cells.has(key)) this.cells.set(key, []); this.cells.get(key).push(b); }
  }
  hits(b) {
    for (const key of this.keys(b)) for (const o of this.cells.get(key) ?? []) if (o.intersectsBox(b)) return true;
    return false;
  }
}
/** Every floor and ledge, every small thing drawn in the rooms and every piece, as boxes in the kit's frame. */
function keepOuts(rt, walls, floors) {
  const K = rt.kit, keep = new Keep(), b = new THREE.Box3();
  const local = (box) => box.clone().applyMatrix4(K.inv);
  for (const [mat, list] of K.batches) {
    if (walls.has(mat)) continue;
    for (const g of list) {
      g.computeBoundingBox();
      const l = local(g.boundingBox), s = l.getSize(V());
      // (a floor or a ledge: kept off in its own height and a stride over it)
      if (floors.has(mat)) { if (s.y < 1.6) keep.add(new THREE.Box3(l.min.clone().addScalar(-0.6), l.max.clone().add(V(0.6, 3, 0.6)))); continue; }
      if (Math.max(s.x, s.z) < 16 && !(s.x > 8 && s.z > 8)) keep.add(l.expandByScalar(0.6));   // (not a whole ring or a band)
    }
  }
  for (const p of rt.pieces) {
    const o = p.group ?? p.mesh ?? p.root;
    if (o?.isObject3D && p.constructor.name !== 'Updraft') { b.setFromObject(o); const l = local(b), s = l.getSize(V()); if (!l.isEmpty() && Math.max(s.x, s.z) < 14 && s.y < 30) keep.add(l.expandByScalar(1.2)); }
    for (const q of [p.pos, p.center]) if (q?.isVector3) keep.add(new THREE.Box3().setFromCenterAndSize(K.local(q), V(4, 4, 4)));
    // (a wind's column, the flight's air: all of its height and a wide margin round it)
    if (p.constructor.name === 'Updraft' && p.foot?.isVector3) {
      const f = K.local(p.foot), r = p.r + 3.5;
      keep.add(new THREE.Box3(V(f.x - r, f.y - 1, f.z - r), V(f.x + r, f.y + p.hMax + 5, f.z + r)));
    }
    // (a gust's hall: its whole air, so nothing floats in the way of a glide on it)
    if (p.constructor.name === 'Gust' && Array.isArray(p.o?.min)) keep.add(new THREE.Box3(V(...p.o.min), V(...p.o.max)).expandByScalar(-1.5));
  }
  return keep;
}
/** The kit's rooms (local): halls, round rooms and passages, with their floors, ceilings and oculi. */
function roomsOf(plan) {
  const out = [];
  for (const e of plan) {
    if (e.kind === 'hall') out.push({ kind: 'hall', x: e.x, z: e.z, hx: e.w / 2, hz: e.d / 2, y0: e.y, y1: e.y + e.h, roof: e.roof, oculus: e.oculus, floor: e.floor, e });
    else if (e.kind === 'round') out.push({ kind: 'round', x: e.x, z: e.z, r: e.r, y0: e.y, y1: e.y + e.h, oculus: e.oculus, gaps: e.gaps ?? [], seg: e.seg, e });
    else if (e.kind === 'corridor') out.push({ kind: 'corridor', x: (e.x0 + e.x1) / 2, z: (e.z0 + e.z1) / 2, hx: (e.x1 - e.x0) / 2, hz: (e.z1 - e.z0) / 2, y0: e.y, y1: e.y + e.h, e });
  }
  return out;
}
/** The skin's hash: the same dressing every build. */
function rand(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
const angleOff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
/** Is a round room's wall clear at angle a (rotunda angles: 0 = +z) and heights y0..y1 of its doorways (m of clearance)? */
const clearOfGaps = (R, a, y0, y1, m) => !R.gaps.some((g) => angleOff(a, g.a) * R.r < g.w / 2 + m && y1 > R.y0 + (g.y0 ?? 0) - m && y0 < R.y0 + (g.y0 ?? 0) + g.h + m);

/** A geometry's vertices in the kit's frame, and how they sit: its box, its middle, how near its middle any comes. */
function shapeOf(K, g) {
  const p = g.attributes.position, v = V(), box = new THREE.Box3();
  const pts = [];
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(K.inv); box.expandByPoint(v); pts.push(v.clone()); }
  const c = box.getCenter(V()), s = box.getSize(V());
  let rin = Infinity;
  for (const q of pts) rin = Math.min(rin, Math.hypot(q.x - c.x, q.z - c.z));
  return { box, c, s, rin, pts };
}

/**
 * The trim's shapes sorted: the flat rings round the vents' throats, the stones' cups and the perch (lit, as the picks'
 * peach rings), the upright rings round the vents' mouths and the great eye (lit), and the great bands round the well
 * (staying trim, a lit line drawn round each); the rest (kerbs, caps, stone feathers, the eye's lid) the trim's.
 */
function sortTrim(K, list) {
  const rings = [], rest = [], bands = [];
  for (const g of list) {
    const { s, c, rin, box } = shapeOf(K, g), half = Math.max(s.x, s.z) / 2;
    const flat = s.y <= 0.55 && Math.abs(s.x - s.z) < 0.25 * Math.max(s.x, s.z) && rin > 0.35 * half;
    if (flat && half <= 6) { rings.push(g); continue; }
    if (s.y <= 0.8 && Math.abs(s.x - s.z) < 0.05 * Math.max(s.x, s.z) && half > 10 && rin > 0.8 * half) { bands.push({ x: c.x, z: c.z, y: (box.min.y + box.max.y) / 2, r: rin }); rest.push(g); continue; }
    // (an upright ring: thin across, round in its own plane, open in its middle)
    const thin = Math.min(s.x, s.z), wide = Math.max(s.x, s.z);
    if (thin < 0.75 && s.y > 2 && s.y < 7 && Math.abs(wide - s.y) < 0.5 * wide) {
      const pts = shapeOf(K, g).pts, cc = c;
      let r0 = Infinity;
      for (const q of pts) r0 = Math.min(r0, Math.hypot(s.x < s.z ? q.z - cc.z : q.x - cc.x, q.y - cc.y));
      if (r0 > 0.3 * Math.min(wide, s.y) / 2) { rings.push(g); continue; }
    }
    rest.push(g);
  }
  return { rings, rest, bands };
}

/** The raised slabs' edges (local): each a box of floor under its room's ceiling, higher than its room's floor. */
function raisedEdges(K, list, rooms) {
  const edges = [];
  const inRoom = (c) => rooms.find((R) => R.kind !== 'corridor' && c.y > R.y0 - 0.5 && c.y < R.y1 && (R.kind === 'round' ? Math.hypot(c.x - R.x, c.z - R.z) < R.r : Math.abs(c.x - R.x) < R.hx && Math.abs(c.z - R.z) < R.hz));
  for (const g of list) {
    const { box, s, pts } = shapeOf(K, g);
    // (a box: every vertex at its corners; a step of the stairs is too small to rim)
    if (Math.min(s.x, s.z) < 2 || Math.max(s.x, s.z) < 3) continue;
    const corner = (q) => (Math.abs(q.x - box.min.x) < 1e-3 || Math.abs(q.x - box.max.x) < 1e-3) && (Math.abs(q.z - box.min.z) < 1e-3 || Math.abs(q.z - box.max.z) < 1e-3);
    if (!pts.every(corner)) continue;
    const top = V((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2), R = inRoom(top);
    if (!R || top.y < R.y0 + 0.6) continue;
    const y = box.max.y - 0.16, [x0, x1, z0, z1] = [box.min.x, box.max.x, box.min.z, box.max.z];
    edges.push({ a: V(x0, y, z0), b: V(x1, y, z0), out: V(0, 0, -1) }, { a: V(x1, y, z1), b: V(x0, y, z1), out: V(0, 0, 1) },
      { a: V(x0, y, z1), b: V(x0, y, z0), out: V(-1, 0, 0) }, { a: V(x1, y, z0), b: V(x1, y, z1), out: V(1, 0, 0) });
  }
  return edges;
}

/** The floating plates round the tall round rooms and the gulf, high, near their walls, off everything. */
function floaters(rt, keep, rooms) {
  const rnd = rand(1342), out = [];
  const boxAt = (c, h) => new THREE.Box3(c.clone().sub(h), c.clone().add(h));
  const tryAt = (c, r) => {
    const box = boxAt(c, V(r + 1.2, 1.6, r + 1.2));
    if (keep.hits(box) || out.some((o) => o.c.distanceTo(c) < o.r + r + 2.5)) return false;
    keep.add(box);
    const hex = rnd() < 0.45, th = 0.3 + rnd() * 0.18, tilt = (rnd() < 0.5 ? 0.04 : 0.18) * (rnd() < 0.5 ? -1 : 1);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, rnd() * TAU, tilt * 0.6 * (rnd() - 0.5), 'YXZ'));
    out.push({ c, r, hex, m: new THREE.Matrix4().compose(c, q, V(r, th, r)) });
    return true;
  };
  for (const R of rooms) {
    if (R.kind === 'round' && R.r >= 15 && R.y1 - R.y0 >= 20) {
      // (high round the drum, over the heights a glide takes, between its doorways: the picks' discs and hexagons)
      // (a tall drum two tiers: between its lower doorways and over its high balcony)
      const tiers = R.y1 - R.y0 > 30 ? [[19, 28, 4], [37, R.y1 - R.y0 - 2.5, 6]] : [[15, R.y1 - R.y0 - 2.5, 5]];
      for (const [lo, hi, want] of tiers) for (let k = 0, n = 0; k < 400 && n < want; k++) {
        const a = rnd() * TAU, y = R.y0 + lo + rnd() * (hi - lo), r = 1.3 + rnd() * 1.7;
        if (y > R.y1 - 2.5 || !clearOfGaps(R, a, y - 3, y + 3, 3)) continue;
        const d = R.r - r - 1.2 - rnd() * 3.5;
        if (tryAt(V(R.x + Math.sin(a) * d, y, R.z + Math.cos(a) * d), r)) n++;
      }
    } else if (R.kind === 'hall' && R.y1 - R.y0 >= 40 && R.floor === false) {
      // (the gulf: high along its side walls, over the gusts' air)
      let n = 0;
      for (let k = 0; k < 400 && n < 6; k++) {
        const side = rnd() < 0.5 ? -1 : 1, r = 1.3 + rnd() * 1.6, y = R.y1 - 4 - rnd() * 8;
        const c = V(R.x + side * (R.hx - r - 1 - rnd() * 2), y, R.z + (rnd() * 2 - 1) * (R.hz - 12));
        if (tryAt(c, r)) n++;
      }
    }
  }
  // (every other one first: the lighter presets draw the first half, spread through every room)
  return [...out.filter((_, i) => i % 2 === 0), ...out.filter((_, i) => i % 2 === 1)];
}

/** The turbines turning while their wind rises; the floating plates halved on the lighter presets. */
class SkinMotion {
  constructor(turbines, mesh, frame, plates) {
    this.turbines = turbines; this.mesh = mesh; this.frame = frame; this.plates = plates;
    this._m = new THREE.Matrix4(); this._r = new THREE.Matrix4();
  }
  update(dt) {
    const lite = sharedUniforms.uWearLite.value > 0.5;
    for (const { mesh, n } of this.plates) mesh.count = lite ? Math.ceil(n / 2) : n;
    if (!this.mesh) return;
    dt = Math.min(dt, 0.1);
    this.turbines.forEach((t, i) => {
      // (it spins up as its wind rises, and runs down when a stone stops it)
      t.k = THREE.MathUtils.clamp(t.k + (t.piece.on ? dt / 2.5 : -dt / 4), 0, 1);
      t.a = (t.a + dt * t.k * 1.6) % TAU;
      this._m.multiplyMatrices(this.frame, t.m).multiply(this._r.makeRotationY(t.a));
      this.mesh.setMatrixAt(i, this._m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ the house's skin
/**
 * The Aerie's futuristic skin (skins/index.js: a house's `def.skin`), called before def.layout(rt): rt.M's surfaces,
 * trim, bands, glyph and ornament swapped for the skin's, rt.P's glow peach, the kit's plan recording.
 */
export function aerieSkin(rt) {
  const K = rt.kit, M = rt.M, id = rt.def.id, look = rt.def.palette?.look?.all ?? {};
  const U = {
    origin: { value: K.origin.clone() },
    rooms: { value: Array.from({ length: AERIE_ROOMS }, () => new THREE.Vector4()) },
    roomsY: { value: Array.from({ length: AERIE_ROOMS }, () => new THREE.Vector4()) },
    count: { value: 0 },
  };
  const W = AERIE.wall, Mt = AERIE.metal, Tr = AERIE.trim, F = AERIE.floor, E = AERIE.emit;
  const glowM = (k, glow) => makeMaterial({ color: AERIE.peach, glow, flat: true, key: `temple.skin.${id}.${k}` });
  // (the hatching sparse on the slate, as the picks' shadows)
  const mats = {
    wall: skinMaterial('slate', { ...look, hatch: 0.15 }, { ...W, size: [W.panel, W.cell, W.band, W.ceil] }, U, `${id}.wall`),
    wallGlyph: skinMaterial('metal', { ...look, hatch: 0.2, glyphs: 1.6 }, { ...Mt, size: [Mt.panel, 1, 0] }, U, `${id}.wallGlyph`),
    trim: skinMaterial('metal', { ...look, hatch: 0.2 }, { ...Tr, size: [Tr.panel, 0, 0] }, U, `${id}.trim`),
    floor: skinMaterial('plates', { ...look, hatch: 0.35 }, { ...F, size: [F.plate, 0, 0] }, U, `${id}.floor`),
    // (the pieces' own: a riding disc, a door's slab take their pattern in their own frame)
    floorObj: skinMaterial('plates', { ...look, hatch: 0.35 }, { ...F, size: [F.plate, 0, 0] }, U, `${id}.floorObj`, true),
    wallGlyphObj: skinMaterial('metal', { ...look, hatch: 0.2, glyphs: 1.6 }, { ...Mt, size: [Mt.panel, 1, 0] }, U, `${id}.wallGlyphObj`, true),
    // (the lights just over the post pass's halo start: crisp lines and slits, not soft blobs)
    glyph: glowM('glyph', E.glyph),
    slot: glowM('slot', E.slot),
    ring: glowM('ring', E.ring),
    rim: glowM('rim', E.rim),
    wing: glowM('wing', E.wing),
    // (seen from inside its ring: both its faces drawn)
    band: makeMaterial({ color: AERIE.peach, glow: E.rim, flat: true, side: THREE.DoubleSide, key: `temple.skin.${id}.band` }),
    turbine: makeMaterial({ ...look, color: '#ffffff', vertexColors: true, flat: true, hatch: 0.2, side: THREE.DoubleSide, key: `temple.skin.${id}.turbine` }),
    plate: makeMaterial({ ...look, color: '#ffffff', vertexColors: true, flat: true, hatch: 0.3, key: `temple.skin.${id}.plate` }),
  };
  for (const k of ['turbine', 'plate']) mats[k].vertexColors = true;
  const was = { M: { wall: M.wall, wallGlyph: M.wallGlyph, floor: M.floor, bands: M.bands, trim: M.trim, stone: M.stone, glyph: M.glyph, ornament: M.ornament }, P: rt.P };
  Object.assign(M, {
    wall: mats.wall, wallGlyph: mats.wallGlyph, floor: mats.floor, glyph: mats.glyph, trim: mats.trim,
    bands: AERIE.bands.map((b) => ({ ...b, mat: paint(b.color) })),
    stone: paint(AERIE.stone),
    // (the frieze's carved feathers become a row of lit slots, the picks' slots that breathe the gusts)
    ornament: M.ornament ? { ...M.ornament, kind: 'slot', mats: { a: mats.slot, b: mats.slot } } : M.ornament,
  });
  // (the pieces' glows the makers' peach: the plates' and the stones' rings, the raft's, the doors')
  rt.P = { ...rt.P, glow: AERIE.peach };
  K.plan = [];
  const meshes = [];
  const skin = {
    name: 'aerie', mats, meshes, U, stats: null,
    /** After the layout: the rooms handed to the shader, the pieces' surfaces in their own frame, the trim sorted, the dressing placed. */
    dress() {
      const t0 = performance.now(), rooms = roomsOf(K.plan);
      const list = [...rooms.filter((r) => r.kind === 'round'), ...rooms.filter((r) => r.kind === 'hall'), ...rooms.filter((r) => r.kind === 'corridor')].slice(0, AERIE_ROOMS);
      list.forEach((r, i) => {
        U.rooms.value[i].set(r.x, r.z, r.kind === 'round' ? r.r : r.hx, r.kind === 'round' ? -1 : r.hz);
        U.roomsY.value[i].set(r.y0, r.y1, r.kind === 'round' && r.oculus > 0 ? r.r * r.oculus : 0, 0);
      });
      U.count.value = list.length;
      // the pieces: a riding disc and the doors' slabs in their own frame, the winds' stones lit rings
      for (const p of rt.pieces) {
        const o = p.group ?? p.mesh ?? p.root, wind = p.constructor.name === 'Updraft';
        o?.traverse?.((m) => {
          if (m.material === mats.floor) m.material = mats.floorObj;
          else if (m.material === mats.wallGlyph) m.material = mats.wallGlyphObj;
          else if (wind && m.material === M.trimMat) m.material = mats.ring;
        });
      }
      // the wing lines up the well (arzach.js's own, its glyph colour): peach
      const wingLines = makeMaterial({ color: '#7cc1c4', glow: 0.35, flat: true, key: 'temple.vael.winglines' });
      const wl = K.batches.get(wingLines) ?? [];
      if (wl.length) { K.batches.delete(wingLines); K.batches.set(mats.wing, [...(K.batches.get(mats.wing) ?? []), ...wl]); }
      // the trim sorted: its rings lit, its great bands a lit line round each
      const T = sortTrim(K, K.batches.get(mats.trim) ?? []);
      if (T.rest.length) K.batches.set(mats.trim, T.rest); else K.batches.delete(mats.trim);
      if (T.rings.length) K.batches.set(mats.ring, [...(K.batches.get(mats.ring) ?? []), ...T.rings]);
      const signs = countSigns(K, mats.glyph);
      const keep = keepOuts(rt, new Set([mats.wall, mats.wallGlyph]), new Set([mats.floor]));
      const F0 = K.frame;
      // the turbines in the great vents' grilles (a wind 2.9 m round or more, on a floor)
      const turbines = rt.pieces.filter((p) => p.constructor.name === 'Updraft' && p.r >= 2.9).map((p) => {
        const f = K.local(p.foot);
        return { piece: p, k: p.on ? 1 : 0, a: 0, m: new THREE.Matrix4().compose(V(f.x, f.y, f.z), new THREE.Quaternion(), V(p.r, 1, p.r)) };
      });
      const tm = instanced('skin: turbines', turbineGeometry(AERIE.turbine), mats.turbine, turbines.map((t) => t.m), F0);
      meshes.push(tm);
      // the raised slabs' lit rims
      const edges = raisedEdges(K, K.batches.get(mats.floor) ?? [], rooms);
      const strip = (e) => {
        const d = e.b.clone().sub(e.a), L = d.length(), x = d.normalize(), y = V(0, 1, 0), z = x.clone().cross(y);
        const c = e.a.clone().add(e.b).multiplyScalar(0.5).addScaledVector(e.out, 0.02);
        return new THREE.Matrix4().makeBasis(x, y, z).scale(V(L, 1, 1)).setPosition(c);
      };
      meshes.push(instanced('skin: ledge rims', new THREE.BoxGeometry(1, 0.07, 0.03).toNonIndexed(), mats.rim, edges.map(strip), F0));
      // a lit line round each great band of the well, a hair inside its face
      meshes.push(instanced('skin: band lines', new THREE.CylinderGeometry(1, 1, 0.06, 96, 1, true).toNonIndexed(), mats.band,
        T.bands.map((b) => new THREE.Matrix4().compose(V(b.x, b.y, b.z), new THREE.Quaternion(), V(b.r - 0.015, 1, b.r - 0.015))), F0));
      // the floating discs and hexagons, their lit rims
      const fl = floaters(rt, keep, rooms);
      const plates = [];
      for (const [hex, sides] of [[false, 40], [true, 6]]) {
        const own = fl.filter((f) => f.hex === hex);
        const body = instanced(`skin: floating ${hex ? 'hexagons' : 'discs'}`, plateGeometry(sides, AERIE.plate), mats.plate, own.map((f) => f.m), F0);
        const rim = instanced(`skin: floating ${hex ? 'hexagons' : 'discs'}’ rims`, rimGeometry(sides), mats.rim, own.map((f) => f.m), F0);
        meshes.push(body, rim);
        plates.push({ mesh: body, n: own.length }, { mesh: rim, n: own.length });
      }
      for (const m of meshes) K.group.add(m);
      rt.pieces.push(new SkinMotion(turbines, turbines.length ? tm : null, F0, plates));
      skin.stats = { rooms: list.length, signs, turbines: turbines.length, rims: edges.length, bands: T.bands.length, rings: T.rings.length, wing: wl.length, floaters: fl.length, hexes: fl.filter((f) => f.hex).length, ms: Math.round(performance.now() - t0) };
    },
    /** After the kit's flush: the house's own materials back for its exterior; the lights out of the shadow passes. */
    done() {
      Object.assign(M, was.M); rt.P = was.P; K.plan = null;
      const lights = new Set([mats.glyph, mats.slot, mats.ring, mats.rim, mats.wing, mats.band]);
      K.group.traverse((o) => { if (o.isMesh && lights.has(o.material)) { o.castShadow = false; o.userData.castShadow = false; } });
      for (const p of rt.pieces) if (p.constructor.name === 'Updraft') p.root?.traverse?.((o) => { if (o.material === mats.ring) { o.castShadow = false; o.userData.castShadow = false; } });
    },
  };
  return skin;
}
