import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, sharedUniforms } from '../../materials.js';
import { paint } from '../kit.js';
import { ROOMS, UP } from '../perdide.js';

// ---------------------------------------------------------------------------
// The Hush-House in its futuristic skin (issue #342, docs/systems/temples.md "Futuristic skins"): the inside of Lorn's
// temple redrawn after the author's pick (references/temples/future/hush-house/sheet-1.jpg): a sound-damping hall of
// dark indigo slate, deep square coffers with crisp chamfers up its walls and over its vaults, thin violet circuits in
// their seams, warm grey floor plates, long hexagonal crystal resonators hanging in slate collars over the black pool,
// the gates of jaws heavy interlocking slate shutters. Look only: the same rooms, doors, collision, pieces, positions,
// timings and logic (skins/index.js; tests/temple-skins.test.js).
//   1. surfaces: the wall, the makers' marked metal (doors, the root-wall's face) and the floor swapped for the skin's:
//      the surface shader with its albedo, its first pen lines and its glow replaced, as landmark-materials.js stone()
//      does. Up to a dado (HUSH.wall.dado over the room's floor) tall plain slabs, a violet seam over them; above it,
//      deep square coffers (a flat frame, a bevel lit at its foot and shaded at its head, a field, a second step), the
//      vaults coffered too. A round room's coffers run round it without a seam (the rooms the kit recorded, uSkR).
//   2. the glow: some seams of the coffers and the floor plates lit violet in runs, the dado's seam, the inlays round
//      each floor, a ring round each oculus; all just over the post pass's halo start (0.62: HUSH.emit), breathing.
//   3. dressing, drawn only (two merged meshes: noCollide, keepBuried, dynamic, out of the shadow passes): stepped
//      acoustic wedges in a row under every great hall's vault; long hexagonal crystal resonators in machined slate
//      collars hanging over the Bog Well's black water and round the Stilling Chamber (two lit teal and violet, faint
//      rings of sound round them, the others dark, as drawn); a stepped plinth under each crystal grown through a floor.
//      Kept off every doorway, piece and thing drawn on the walls.
//   4. the house's own: the bog's water a still black pool, the roots heavy cables, the crystals teal and violet by
//      turns; the jaws (the Snapping Passage's gate, its two mouths, the balcony's) slate shutters: the piece's own
//      square slabs (pieces.js Jaw, as the pick draws them: what is drawn is what collides), a violet lit seam on each
//      slab's point where the leaves interlock, the stiles dark slate.
// On Low, Handheld and the Deck (uWearLite) the shader leaves out the coffers' bevels and the slabs' tones, and the
// dressing draws every other wedge and no rings.
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
/** Up to this many rooms are handed to the shader (the round ones first). */
export const HUSH_ROOMS = 16;

/** The skin's colours (sRGB, sampled from the pick: its lit slate #4f506c, shade #272938, floor #807679) and sizes (m). */
export const HUSH = {
  violet: '#a983ff',
  teal: '#72dde8',
  /** the slate: its tones, the grooves; coffers (m, square), the dado's slabs (m), the dado's height, the vaults' coffers */
  wall: { color: '#74789a', a: '#6e7294', b: '#7c80a4', c: '#2a2c42', coffer: 4.8, slab: 6.0, dado: 4.2, ceil: 4.8 },
  /** the makers' machined slate: doors, the root-wall's face (panels m) */
  metal: { color: '#5e6080', a: '#585a79', b: '#666889', c: '#25263a', panel: 2.2 },
  /** the floors' plates (m): the pick's warm grey stone, its seams */
  floor: { color: '#cdbfbf', a: '#c4b6b7', b: '#d6c8c8', c: '#776b70', plate: 3.0 },
  /** the bands across the walls (kit.js M.bands): a dark plinth, the frieze's dark course */
  bands: [{ y: 0.4, h: 0.8, color: '#3e3f5a' }, { at: 0.72, h: 0.9, color: '#42435e' }],
  trim: '#55576f', stone: '#666884', dark: '#1d1e30',
  pool: '#15162a', cable: '#5b5978',
  /** the dressing's slate: faces, tops, undersides; the collars' metal and their bands */
  slate: { face: '#6a6c8c', top: '#8284a2', under: '#40425a', collar: '#46485f', band: '#7a7d9a', rod: '#33354a' },
  /** the crystals: lit teal, lit violet, dark (as the pick's two dark ones) */
  crystal: { teal: '#7fe3ee', violet: '#a983ff', dark: '#3b3a5c' },
  /** the jaws' shutters: slate, and frosted */
  jaw: { slate: '#6c6f90', frost: '#d9f1ff' },
  /** how bright the skin's lights are (makeMaterial glow; post.js haloes over 0.62: just over it keeps a halo tight) */
  emit: { glyph: 0.72, crystal: 0.68, ring: 0.7, lines: 0.78, spike: 0.6 },
  /** the house's light inside: the pick's cool lavender, not the dusk's rose (index.js reads rt.skin.light) */
  light: { shadow: '#52548a', light: '#e8e5f4', sun: '#eee9f8' },
};

// ------------------------------------------------------------------ the surfaces: the shader's patterns
// (declared before main(): the surface shader's hash, uTime, uPixelRatio and uWearLite are in scope by then)
const SK_PARS = /* glsl */ `
  uniform vec3 uSkinO;
  uniform vec4 uSkR[${HUSH_ROOMS}];
  uniform vec4 uSkY[${HUSH_ROOMS}];
  uniform int uSkN;
  uniform vec3 uSkA;
  uniform vec3 uSkB;
  uniform vec3 uSkC;
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
    for (int i = 0; i < ${HUSH_ROOMS}; i++) {
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
    for (int i = 0; i < ${HUSH_ROOMS}; i++) {
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
  // a coffer's shade at m metres into a cell of size S (x along, y up), e its distances to the cell's edges: a flat frame,
  // a bevel down into it (its foot lit, its head in shade, its sides between), the field, a second step and its core.
  // Returns the albedo's factor; ink: its edges and the bevel's mitres.
  float skCoffer(vec2 m, vec2 S, vec2 e, float px, float near, out float ink) {
    float s = min(S.x, S.y), d = min(e.x, e.y), F = 0.06 * s, B = 0.13 * s, F2 = F + B + 0.09 * s, B2 = 0.04 * s;
    bool head = e.y < e.x && m.y > S.y * 0.5, foot = e.y < e.x && m.y <= S.y * 0.5;
    float k = 1.0;
    if (d > F && d < F + B) k = head ? 0.6 : foot ? 1.14 : (m.x > S.x * 0.5 ? 0.76 : 0.9);
    else if (d >= F + B && d < F2) k = 0.8;
    else if (d >= F2 && d < F2 + B2) k = head ? 0.62 : foot ? 0.98 : 0.84;
    else if (d >= F2 + B2) k = 0.7;
    ink = max(skInkL(abs(d - F), px) * 0.35, skInkL(abs(d - F - B), px) * 0.55);
    ink = max(ink, skInkL(abs(d - F2), px) * 0.3);
    if (d > F && d < F + B) ink = max(ink, skInkL(abs(e.x - e.y) * 0.7071, px) * 0.35);
    ink *= near;
    return mix(1.0, k, near);
  }
`;

/**
 * Each pattern replaces the surface's `vec3 albedo = uColor;` (its first pen lines: skInk; its glow: skGlow, added to
 * the surface's emit before the light). uSkP: the skin's sizes; uSkG: the glow's colour (violet).
 *   coffer: the walls. Up to uSkP.z m over the room's floor tall plain slabs (about uSkP.y m), a dark groove over them,
 *     lit violet in most; above, square coffers (uSkP.x m, a whole number round a round room), some seams lit in runs.
 *     Vaults: coffers (uSkP.w m) from the room's middle, a violet ring round the oculus. Tops: plates.
 *   metal: the makers' machined panels (uSkP.x m), seams inked, chamfered, a violet seam down some of them.
 *   plates: the floors. Plates (uSkP.x m) in rings round a round room's middle, in a grid in a hall, some seams lit in
 *     runs; a violet inlay round each room 1.6 m in from its walls (and round a riding disc's rim).
 */
const BODIES = {
  coffer: /* glsl */ `
    vec3 skP = uSkObj > 0.5 ? vObjPos : vWorldPos - uSkinO;
    float skPx = max(max(length(dFdx(skP)), length(dFdy(skP))), 1e-4);
    float skInk = 0.0, skGlow = 0.0;
    vec3 albedo = uColor;
    {
      bool lite = uWearLite > 0.5;
      float pulse = 0.8 + 0.2 * sin(uTime * 0.8 - skP.y * 0.09 + skP.x * 0.02);
      float near = 1.0 - smoothstep(0.09, 0.26, skPx);
      vec4 R, Y;
      bool inR = uSkObj < 0.5 && skRoomOf(skP, R, Y);
      if (abs(n.y) < 0.65) {
        // (on the lighter presets along the face's axis: no search for the round room it stands in)
        vec2 A = uSkObj > 0.5 || lite ? vec2(abs(n.x) > abs(n.z) ? skP.z : skP.x, 0.0) : skAlong(skP, n);
        float along = A.x, h = skP.y - (inR ? Y.x : 0.0), DADO = uSkP.z;
        if (h < DADO) {
          // the dado: tall plain slabs, a chamfer along their top, a dark groove over them lit violet in most
          float sw = uSkP.y;
          if (A.y > 0.5) sw = A.y / max(1.0, floor(A.y / sw + 0.5));
          float sx = along / sw, si = floor(sx), sf = fract(sx);
          float dv = min(sf, 1.0 - sf) * sw, top = DADO - h;
          albedo = lite ? uSkB : mix(uSkB, uSkB * 1.06, skH1(si * 3.1 + 0.7));
          if (!lite) albedo *= (0.94 + 0.06 * h / DADO) * (1.0 + near * 0.14 * step(0.1, top) * (1.0 - smoothstep(0.24, 0.3, top)));
          skInk = max(skInkL(dv, skPx) * 0.7, skInkL(abs(top - 0.3), skPx) * 0.3 * near);
          if (top < 0.1) {
            albedo = uSkC;
            skInk = max(skInk, skInkL(top, skPx) * 0.8);
            skGlow = skLit(abs(top - 0.05), skPx, 0.022) * step(0.25, skH1(si * 7.7 + 3.0));
          }
        } else {
          // the coffers, square, a whole number of them round a round room
          float CH = uSkP.x, cw = CH;
          if (A.y > 0.5) cw = A.y / max(1.0, floor(A.y / CH + 0.5));
          vec2 c = vec2(along / cw, (h - DADO) / CH), ci = floor(c), cf = fract(c);
          vec2 S = vec2(cw, CH), m = cf * S, e = min(m, S - m);
          vec3 face = lite ? uColor : mix(uSkA, uSkB, skH2(ci + 0.37) * 0.8);
          float ink = 0.0;
          albedo = lite ? face : face * skCoffer(m, S, e, skPx, near, ink);
          skInk = max(ink, skInkL(min(e.x, e.y), skPx) * 0.8);
          // the seams' violet circuits: some vertical seams lit for a run of three coffers, some across for four
          float litV = step(0.74, skH2(vec2(floor(c.x + 0.5), floor(c.y / 3.0)) + 5.1));
          float litH = step(0.84, skH2(vec2(floor(c.x / 4.0) + 17.0, floor(c.y + 0.5))));
          skGlow = max(skLit(e.x, skPx, 0.025) * litV, skLit(e.y, skPx, 0.025) * litH);
        }
      } else if (n.y < 0.0) {
        // a vault: coffers from its room's middle, a violet ring round the oculus
        float S = uSkP.w;
        vec2 o = inR ? R.xy : vec2(0.0), c = (skP.xz - o) / S + 0.5, ci = floor(c), cf = fract(c);
        vec2 m = cf * S, e = min(m, S - m);
        vec3 face = lite ? uColor : mix(uSkA, uSkB, skH2(ci + 0.91) * 0.7) * 0.92;
        float ink = 0.0;
        albedo = lite ? face : face * skCoffer(m, vec2(S), e, skPx, near, ink);
        skInk = max(ink, skInkL(min(e.x, e.y), skPx) * 0.8);
        float litV = step(0.84, skH2(vec2(floor(c.x + 0.5), floor(c.y / 3.0)) + 2.3));
        skGlow = skLit(e.x, skPx, 0.03) * litV;
        if (inR && R.w < 0.0 && Y.z > 0.0) skGlow = max(skGlow, skLit(abs(length(skP.xz - R.xy) - Y.z - 0.9), skPx, 0.05));
      } else {
        skInk = max(skInkL(skSeam(skP.x, 2.4), skPx), skInkL(skSeam(skP.z, 2.4), skPx)) * 0.6;
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
        float ch = 0.07;
        albedo *= 1.0 + near * (0.16 * (1.0 - smoothstep(ch * 0.6, ch, (1.0 - cf.y) * S)) - 0.14 * (1.0 - smoothstep(ch * 0.6, ch, cf.y * S)));
        skInk = max(skInk, max(skInkL(abs((1.0 - cf.y) * S - ch), skPx), skInkL(abs(cf.x * S - ch), skPx)) * 0.28 * near);
      }
      skInk = max(skInk, max(skInkL(dx, skPx), skInkL(dy, skPx)) * 0.8);
      // a violet seam down some panels' joints
      float lit = step(0.66, skH1(floor(q.x + 0.5) * 3.9 + 1.7));
      skGlow = skLit(dx, skPx, 0.025) * lit * (0.8 + 0.2 * sin(uTime * 0.9 + skP.y * 0.3));
      albedo = mix(albedo, uSkG, skGlow);
      skInk *= 1.0 - skGlow;
      skGlow *= SK_LINES;
    }
  `,
  shutter: /* glsl */ `
    vec3 skP = vObjPos;
    float skPx = max(max(length(dFdx(skP)), length(dFdy(skP))), 1e-4);
    float skInk = 0.0, skGlow = 0.0;
    vec3 albedo = uColor;
    {
      // a jaw's leaf (its slabs the piece's own, uSkP.x m each, pieces.js Jaw): a chamfer lit along each slab's top and
      // its foot in shade, the slabs' tones by turns, a pen line in every joint
      float S = uSkP.x, q = skP.y / S, i = floor(q), f = fract(q);
      float near = 1.0 - smoothstep(S / 40.0, S / 12.0, skPx);
      albedo = uColor * (mod(i, 2.0) < 0.5 ? 1.0 : 0.9);
      if (uWearLite < 0.5) albedo *= 1.0 + near * (0.2 * (1.0 - smoothstep(0.06, 0.1, (1.0 - f) * S)) - 0.22 * (1.0 - smoothstep(0.06, 0.12, f * S)));
      skInk = skInkL(min(f, 1.0 - f) * S, skPx) * 0.85;
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
      if (n.y > 0.65) {
        vec4 R = vec4(0.0, 0.0, 2.2, -1.0), Y = vec4(0.0);
        bool inRoom = uSkObj > 0.5 ? true : skRoomOf(skP, R, Y);
        vec2 d = skP.xz - R.xy;
        float t = 0.5;
        if (inRoom && R.w < 0.0) {
          // rings of plates round the middle; a violet inlay 1.6 m in from the wall (a disc's: at its rim)
          float r = length(d), RS = uSkObj > 0.5 ? 0.8 : S, ri = floor(r / RS);
          float nseg = max(4.0, floor(6.2831853 * (ri + 0.5) * RS / S + 0.5));
          float aq = (atan(d.y, d.x) + 3.14159265) / 6.2831853 * nseg + skH1(ri * 1.7);
          float da = min(fract(aq), 1.0 - fract(aq)) / nseg * 6.2831853 * r;
          skInk = max(skInkL(skSeam(r, RS), skPx), skInkL(da, skPx) * step(1.0, ri)) * 0.65 * near;
          t = skH2(vec2(floor(aq), ri));
          float rin = uSkObj > 0.5 ? R.z * 0.82 : R.z - 1.6;
          skGlow = skLit(abs(r - rin), skPx, 0.045);
          // (and some of the rings' seams lit, a stretch at a time)
          skGlow = max(skGlow, skLit(skSeam(r, RS), skPx, 0.03) * step(0.8, skH2(vec2(floor(r / RS + 0.5), floor(aq / 3.0)) + 4.4)) * step(2.0, ri));
        } else {
          // a grid of plates (from the room's middle); some seams lit violet in runs; the inlay round the room 1.6 m in
          vec2 g = (d + (inRoom ? vec2(0.0) : vec2(0.5 * S))) / S, gi = floor(g), gf = fract(g);
          float ex = min(gf.x, 1.0 - gf.x) * S, ez = min(gf.y, 1.0 - gf.y) * S;
          skInk = max(skInkL(ex, skPx), skInkL(ez, skPx)) * 0.65 * near;
          t = skH2(gi + 0.13);
          float litX = step(0.9, skH2(vec2(floor(g.x + 0.5), floor(g.y / 3.0)) + 8.8)), litZ = step(0.91, skH2(vec2(floor(g.x / 3.0) + 3.0, floor(g.y + 0.5))));
          skGlow = max(skLit(ex, skPx, 0.03) * litX, skLit(ez, skPx, 0.03) * litZ);
          if (inRoom) {
            float e = max(abs(d.x) - R.z, abs(d.y) - R.w);
            skGlow = max(skGlow * step(e, -2.4), skLit(abs(e + 1.6), skPx, 0.045) * step(4.0, min(R.z, R.w)));
          }
        }
        if (!lite) albedo = mix(uColor, mix(uSkA, uSkB, t), 0.7 * near + 0.2);
      } else if (n.y < -0.65) {
        // a floor's underside, the vault of the room under it: slate coffers
        albedo = SK_UNDER;
        vec2 c = skP.xz / 4.8 + 0.5, cf = fract(c);
        vec2 m = cf * 4.8, e = min(m, 4.8 - m);
        float ink = 0.0;
        if (!lite) albedo *= skCoffer(m, vec2(4.8), e, skPx, near, ink);
        skInk = max(ink, skInkL(min(e.x, e.y), skPx) * 0.7);
      } else {
        // a slab's or a ledge's edge: a course line under its top
        float top = fract(skP.y / 0.8);
        skInk = skInkL(min(top, 1.0 - top) * 0.8, skPx) * 0.4 * near;
      }
      skGlow *= 0.8 + 0.2 * sin(uTime * 0.7 + length(skP.xz) * 0.15);
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
  const u = new THREE.Color(HUSH.wall.color), under = `#define SK_UNDER vec3(${u.r.toFixed(4)}, ${u.g.toFixed(4)}, ${u.b.toFixed(4)})\n#define SK_LINES ${HUSH.emit.lines.toFixed(3)}\n`;
  const LIGHT = 'L = mix(L, 1.0, max(uGlow, emit));';
  if (at < 0 || !fs.includes('vec3 albedo = uColor;') || !fs.includes('float detail = 0.0;') || !fs.includes(LIGHT)) throw new Error('skins/hush-house.js: the surface shader changed: no albedo, light or detail line to replace');
  m.fragmentShader = SK_PARS + under + fs.slice(0, at) + SK_GLSL + fs.slice(at)
    .replace('vec3 albedo = uColor;', BODIES[body])
    .replace(LIGHT, `emit = max(emit, skGlow); ${LIGHT}`)
    .replace('float detail = 0.0;', 'float detail = skInk;');
  Object.assign(m.uniforms, {
    uSkA: { value: new THREE.Color(pat.a ?? pat.color) }, uSkB: { value: new THREE.Color(pat.b ?? pat.color) }, uSkC: { value: new THREE.Color(pat.c ?? pat.color) },
    uSkG: { value: new THREE.Color(HUSH.violet) },
    uSkP: { value: new THREE.Vector4(...[...pat.size, 0, 0, 0, 0].slice(0, 4)) },
    uSkObj: { value: obj ? 1 : 0 },
  });
  return m;
}

// ------------------------------------------------------------------ the dressing's shapes (unit frames: x across, y up, z out of the wall)
/** Vertex colours over a geometry (non-indexed), all one colour; only its position, normal and colour kept. */
function tinted(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const B = (w, h, d, x, y, z, c) => tinted(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);

/**
 * A stepped acoustic wedge under a vault, as the pick's: three slabs stepping out of the wall toward the top (0.5,
 * 1.0, 1.5 m out), WEDGE.w wide, WEDGE.h tall; its top at y = 0, the wall's face at z = 0.
 */
export const WEDGE = { w: 1.5, h: 3.0, step: [0.5, 1.0, 1.5], every: 4.2 };
function wedgeGeometry(S) {
  const { w, h, step } = WEDGE, sh = h / step.length, parts = [];
  step.forEach((d, i) => {
    // (from the bottom up: the shallowest lowest; standing 3 cm off the wall, its back never in the wall's plane)
    const y = -h + i * sh + sh / 2;
    parts.push(B(w, sh, d, 0, y, d / 2 + 0.03, i === step.length - 1 ? S.face : i === 0 ? S.under : S.face));
    // (a lighter lip along each step's top edge: its chamfer)
    parts.push(B(w + 0.02, 0.1, 0.1, 0, y + sh / 2 - 0.05, d + 0.04, S.top));
  });
  return mergeGeometries(parts);
}
/** A resonator's collar and its rod (the rod 1 m, scaled to reach the vault): the collar's foot at y = 0. */
export const COLLAR = { r: 0.95, h: 1.7 };
function collarGeometry(S) {
  const C = (r0, r1, h, y, c, seg = 6) => tinted(new THREE.CylinderGeometry(r1, r0, h, seg).translate(0, y + h / 2, 0), c);
  return mergeGeometries([
    C(0.72, 0.85, 0.35, 0, S.collar), C(0.95, 0.95, 0.5, 0.35, S.collar), C(0.98, 0.98, 0.12, 0.85, S.band),
    C(0.9, 0.9, 0.55, 0.97, S.collar), C(0.55, 0.7, 0.18, 1.52, S.band),
  ]);
}
/** A long hexagonal crystal of length L under a collar (its top at y = 0), pointed at its foot. */
function crystalGeometry(L, r, hex) {
  const tip = Math.min(1.1, L * 0.22);
  const body = new THREE.CylinderGeometry(r, r, L - tip, 6).translate(0, -(L - tip) / 2, 0);
  const point = new THREE.ConeGeometry(r, tip, 6).rotateX(Math.PI).translate(0, -(L - tip) - tip / 2, 0);
  return mergeGeometries([tinted(body, hex), tinted(point, hex)]);
}
/** A faint ring of sound round a lit crystal: a flat torus, radius r. */
const ringGeometry = (r, hex) => tinted(new THREE.TorusGeometry(r, 0.035, 3, 40).rotateX(Math.PI / 2), hex);
/** A stepped plinth under a crystal grown through a floor (radius s: the crystal's), its top 0.5 m up. */
function plinthGeometry(s, S) {
  const C = (r, h, y, c) => tinted(new THREE.CylinderGeometry(r, r, h, 6).translate(0, y + h / 2, 0), c);
  return mergeGeometries([C(s * 1.9 + 0.3, 0.3, -0.05, S.face), C(s * 1.9 + 0.36, 0.06, 0.2, S.top), C(s * 1.35 + 0.2, 0.3, 0.25, S.face)]);
}

// ------------------------------------------------------------------ placing the dressing
/** A merged, drawn-only mesh of the dressing: walked through, never buried, never casting a shadow. */
function drawnOnly(name, geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.userData.noCollide = true; m.userData.keepBuried = true; m.userData.skin = true;
  // (one draw a pass for the whole house's, never cut into tiles nor given levels of detail: perf.js, lod.js)
  m.userData.dynamic = true;
  m.castShadow = false; m.receiveShadow = true;
  m.userData.castShadow = false;   // (out of every shadow pass: shadows.js draws all but those that opt out)
  m.frustumCulled = true;
  return m;
}
const basis = (p, x, y, z) => new THREE.Matrix4().makeBasis(x, y, z).setPosition(p);

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
/**
 * Every thing drawn standing out of the walls (posts, beams, piers, corbels, a balcony's parapet) and every piece, as
 * boxes in the kit's frame; not the walls, floors and vaults themselves, nor the long thin caps and lips along them.
 */
function keepOuts(rt, surfaces) {
  const K = rt.kit, keep = new Keep(), b = new THREE.Box3();
  const local = (box) => box.clone().applyMatrix4(K.inv);
  for (const [mat, list] of K.batches) {
    if (surfaces.has(mat)) continue;
    for (const g of list) {
      g.computeBoundingBox();
      const l = local(g.boundingBox), s = l.getSize(V());
      if (s.x > 6 && s.z > 6) continue;                                   // (a ring, a slab, a floor)
      if (s.y < 0.65 && Math.max(s.x, s.z) > 6) continue;                 // (a wall's cap, a ledge's lip)
      keep.add(l.expandByScalar(0.3));
    }
  }
  for (const p of rt.pieces) {
    const o = p.group ?? p.mesh ?? p.root;
    if (o?.isObject3D) { b.setFromObject(o); const l = local(b), s = l.getSize(V()); if (!l.isEmpty() && Math.max(s.x, s.z) < 14 && s.y < 30) keep.add(l.expandByScalar(0.8)); }
    for (const q of [p.pos, p.center]) if (q?.isVector3) keep.add(new THREE.Box3().setFromCenterAndSize(K.local(q), V(3, 3, 3)));
  }
  return keep;
}
/** The kit's rooms (local): halls, round rooms and passages, with their floors, ceilings and oculi. */
function roomsOf(plan) {
  const out = [];
  for (const e of plan) {
    if (e.kind === 'hall') out.push({ kind: 'hall', x: e.x, z: e.z, hx: e.w / 2, hz: e.d / 2, y0: e.y, y1: e.y + e.h, roof: e.roof, oculus: e.oculus, doors: e.doors ?? [], e });
    else if (e.kind === 'round') out.push({ kind: 'round', x: e.x, z: e.z, r: e.r, y0: e.y, y1: e.y + e.h, oculus: e.oculus, gaps: e.gaps ?? [], seg: e.seg, e });
    else if (e.kind === 'corridor') out.push({ kind: 'corridor', x: (e.x0 + e.x1) / 2, z: (e.z0 + e.z1) / 2, hx: (e.x1 - e.x0) / 2, hz: (e.z1 - e.z0) / 2, y0: e.y, y1: e.y + e.h, e });
  }
  return out;
}
const angleOff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
/** Where a round room's wall stands at angle a (rotunda angles: 0 = +z, toward +x): its face, into the room, along. */
function roundAt(R, a, y) {
  const out = V(Math.sin(a), 0, Math.cos(a));
  const face = R.r * Math.cos(Math.PI / (R.seg ?? 28)) - 0.02;
  return { p: V(R.x, y, R.z).addScaledVector(out, face), nrm: out.clone().negate(), t: V(-Math.cos(a), 0, Math.sin(a)) };
}
const clearOfGaps = (R, a, y0, y1, m) => !R.gaps.some((g) => angleOff(a, g.a) * R.r < g.w / 2 + m && y1 > R.y0 + (g.y0 ?? 0) - m && y0 < R.y0 + (g.y0 ?? 0) + g.h + m);

/**
 * The resonators (local): over the Bog Well's water four in a row across it, longest first, the first two lit (teal,
 * violet) as the pick's; round the Stilling Chamber's oculus four, two lit. { x, z, top (the collar's foot), L, r, tone }
 */
function resonators(rooms) {
  const out = [];
  const W = ROOMS.well, ST = ROOMS.stilling;
  const well = rooms.find((R) => R.kind === 'round' && Math.hypot(R.x - 0, R.z - W.z) < 1 && R.y0 === W.y);
  if (well) {
    // (over the water, clear of the riding disc's ride down the middle and of the root-wall's face behind)
    for (const [x, L, tone] of [[-13.2, 5.8, 'teal'], [-8.6, 5.2, 'violet'], [8.6, 4.6, 'dark'], [13.2, 4.0, 'dark']])
      out.push({ x, z: W.z - 2.2, top: 16.4, ceil: well.y1, L, r: 0.5, tone });
  }
  const st = rooms.find((R) => R.kind === 'round' && Math.hypot(R.x - 0, R.z - ST.z) < 1 && R.y0 === UP);
  if (st) {
    [[0.785, 4.8, 'violet'], [2.356, 4.0, 'dark'], [3.927, 5.4, 'teal'], [5.498, 3.6, 'dark']].forEach(([a, L, tone]) =>
      out.push({ x: st.x + Math.sin(a) * 10, z: st.z + Math.cos(a) * 10, top: UP + 13.5, ceil: st.y1, L, r: 0.45, tone }));
  }
  return out;
}

/** The dressing: the wedges under the vaults, the resonators, the plinths under the floors' crystals. */
function dress(rt, keep, rooms, spikes) {
  const S = HUSH.slate, Cr = HUSH.crystal, slate = [], lights = [], rings = [], wedgesA = [], wedgesB = [];
  const wedge = wedgeGeometry(S), boxAt = (c, half) => new THREE.Box3(c.clone().sub(half), c.clone().add(half));
  let nw = 0;
  /** A wedge at p on a face (t along, nrm into the room), its top at p.y. */
  const put = (p, t, nrm) => {
    const c = p.clone().addScaledVector(nrm, 0.8).setY(p.y - WEDGE.h / 2), box = boxAt(c, V(WEDGE.w / 2 + 0.3, WEDGE.h / 2 + 0.3, 1.1));
    if (keep.hits(box)) return;
    keep.add(box);
    (nw++ % 2 === 0 ? wedgesA : wedgesB).push(wedge.clone().applyMatrix4(basis(p, t, V(0, 1, 0), nrm)));
  };
  for (const R of rooms) {
    if (R.kind === 'corridor' || R.y1 - R.y0 < 14) continue;
    const y = R.y1 - 0.6;
    if (R.kind === 'round') {
      const n = Math.max(8, Math.round((TAU * R.r) / WEDGE.every));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        if (!clearOfGaps(R, a, y - WEDGE.h - 1, y + 1, 1.5)) continue;
        const f = roundAt(R, a, y);
        put(f.p, f.t, f.nrm);
      }
    } else {
      // (along all four walls, a whole number of them, from the corners in)
      for (const [nrm, len] of [[V(0, 0, 1), 2 * R.hx], [V(0, 0, -1), 2 * R.hx], [V(1, 0, 0), 2 * R.hz], [V(-1, 0, 0), 2 * R.hz]]) {
        const t = V(0, 1, 0).cross(nrm).normalize(), n = Math.floor((len - 2) / WEDGE.every);
        for (let i = 0; i < n; i++) {
          const u = -len / 2 + 1 + WEDGE.every * (i + 0.5) + (len - 2 - n * WEDGE.every) / 2;
          const p = nrm.z !== 0 ? V(R.x + u, y, R.z - nrm.z * (R.hz - 0.01)) : V(R.x - nrm.x * (R.hx - 0.01), y, R.z + u);
          put(p, t, nrm);
        }
      }
    }
  }
  // the resonators: a rod up into the vault, a machined collar, a long crystal under it; rings round the lit ones
  const reso = resonators(rooms), collar = collarGeometry(S);
  for (const r of reso) {
    const rod = r.ceil + 1.5 - (r.top + COLLAR.h);
    slate.push(tinted(new THREE.CylinderGeometry(0.16, 0.16, rod, 6).translate(r.x, r.top + COLLAR.h + rod / 2, r.z), S.rod));
    slate.push(collar.clone().translate(r.x, r.top, r.z));
    (r.tone === 'dark' ? slate : lights).push(crystalGeometry(r.L, r.r, Cr[r.tone]).translate(r.x, r.top + 0.05, r.z));
    if (r.tone !== 'dark') for (const [k, rr] of [[0.3, 1.25], [0.52, 1.55], [0.74, 1.3]]) rings.push(ringGeometry(rr, Cr[r.tone]).translate(r.x, r.top - r.L * k, r.z));
  }
  // a stepped plinth under each crystal grown through a floor (not those in the water, nor the crowns over the mouths)
  let np = 0;
  for (const s of spikes) {
    // (a tilted crystal's foot dips a little under its floor: its lowest point within 0.4 m under it)
    const R = rooms.find((q) => q.kind !== 'corridor' && s.y < q.y0 + 0.05 && s.y > q.y0 - 0.4);
    if (!R) continue;
    // (and none by a doorway or a piece)
    const w = s.r * 1.9 + 0.4, box = new THREE.Box3(V(s.x - w, R.y0 - 0.1, s.z - w), V(s.x + w, R.y0 + 0.6, s.z + w));
    if (keep.hits(box)) continue;
    slate.push(plinthGeometry(s.r, S).translate(s.x, R.y0, s.z));
    np++;
  }
  // (the order the lighter presets cut at: every other wedge, and the rings, last)
  const slateGeo = mergeGeometries([...slate, ...wedgesA, ...wedgesB]);
  const keepSlate = [...slate, ...wedgesA].reduce((n, g) => n + g.attributes.position.count, 0);
  const lightGeo = mergeGeometries([...lights, ...rings]);
  const keepLight = lights.reduce((n, g) => n + g.attributes.position.count, 0);
  return { slateGeo, lightGeo, keepSlate, keepLight, stats: { wedges: wedgesA.length + wedgesB.length, resonators: reso.length, lit: reso.filter((r) => r.tone !== 'dark').length, rings: rings.length, plinths: np } };
}

/** The lights breathing, the jaws' shutters frosted with the jaws, the presets' cut. */
class SkinMotion {
  constructor({ slate, light, keepSlate, keepLight, jaws, lightMat }) {
    Object.assign(this, { slate, light, keepSlate, keepLight, jaws, lightMat });
    this.t = 0; this._c = new THREE.Color();
  }
  update(dt) {
    const lite = sharedUniforms.uWearLite.value > 0.5;
    this.t += Math.min(dt, 0.1);
    if (this.slate) this.slate.geometry.setDrawRange(0, lite ? this.keepSlate : Infinity);
    if (this.light) this.light.geometry.setDrawRange(0, lite ? this.keepLight : Infinity);
    if (this.lightMat) this.lightMat.uniforms.uGlow.value = HUSH.emit.crystal + 0.03 * Math.sin(this.t * 1.1);
    for (const J of this.jaws) {
      const f = Math.min(1, (J.piece.frost ?? 0) * 1.4);
      J.mat.uniforms.uColor.value.set(HUSH.jaw.slate).lerp(this._c.set(HUSH.jaw.frost), f * 0.7);
      J.mat.uniforms.uGlow.value = 0.32 * f;
    }
  }
}

/**
 * The jaws as the pick's slate shutters: the piece's own square slabs (pieces.js Jaw; what is drawn is what collides:
 * their colliders are those leaves, physics.addMover) in slate (each leaf its own material: it frosts), the seam on
 * each slab's point lit violet where the leaves interlock, the stile at the hinge dark slate.
 */
function shutters(rt, look, U, mats) {
  const out = [];
  for (const p of rt.pieces) {
    if (p.constructor.name !== 'Jaw' || !p.halves) continue;
    for (const { g, side } of p.halves) {
      const [slabs, stile, seams] = g.children;
      // (each leaf its own: it frosts with its jaw; its joints the slabs')
      const m = skinMaterial('shutter', { ...look, hatch: 0.25 }, { color: HUSH.jaw.slate, size: [p.slabs.s, 0, 0] }, U, `${rt.def.id}.jaw.${p.id}.${side}`, true);
      slabs.material = m; stile.material = mats.stile; seams.material = mats.lip;
      out.push({ piece: p, mat: m });
    }
  }
  return out;
}

// ------------------------------------------------------------------ the house's skin
/**
 * The Hush-House's futuristic skin (skins/index.js: a house's `def.skin`), called before def.layout(rt): rt.M's
 * surfaces, bands, trim and glyph swapped for the skin's, the kit's plan recording, its drawing of the bog, the roots
 * and the crystals redirected (K.add, while the layout runs: drawn only; the solids are the kit's own).
 */
export function hushHouseSkin(rt) {
  const K = rt.kit, M = rt.M, id = rt.def.id, look = rt.def.palette?.look?.all ?? {};
  const U = {
    origin: { value: K.origin.clone() },
    rooms: { value: Array.from({ length: HUSH_ROOMS }, () => new THREE.Vector4()) },
    roomsY: { value: Array.from({ length: HUSH_ROOMS }, () => new THREE.Vector4()) },
    count: { value: 0 },
  };
  const W = HUSH.wall, Mt = HUSH.metal, F = HUSH.floor;
  const glowM = (k, color, glow) => makeMaterial({ color, glow, flat: true, key: `temple.skin.${id}.${k}` });
  const mats = {
    // (the hatching sparse on the skin's slate, as the pick's: hatched only in its deepest shade)
    wall: skinMaterial('coffer', { ...look, hatch: 0.18 }, { ...W, size: [W.coffer, W.slab, W.dado, W.ceil] }, U, `${id}.wall`),
    wallGlyph: skinMaterial('metal', { ...look, glyphs: 1.6, hatch: 0.2 }, { ...Mt, size: [Mt.panel, 0, 0] }, U, `${id}.wallGlyph`),
    floor: skinMaterial('plates', { ...look, hatch: 0.45 }, { ...F, size: [F.plate, 0, 0] }, U, `${id}.floor`),
    // (the pieces' own: a riding disc, a door's slab take their pattern in their own frame)
    floorObj: skinMaterial('plates', { ...look, hatch: 0.45 }, { ...F, size: [F.plate, 0, 0] }, U, `${id}.floorObj`, true),
    wallGlyphObj: skinMaterial('metal', { ...look, glyphs: 1.6, hatch: 0.2 }, { ...Mt, size: [Mt.panel, 0, 0] }, U, `${id}.wallGlyphObj`, true),
    glyph: glowM('glyph', HUSH.violet, HUSH.emit.glyph),
    teal: glowM('teal', HUSH.teal, HUSH.emit.ring),
    violetOrn: glowM('violet', HUSH.violet, HUSH.emit.ring),
    spikeTeal: glowM('spike.teal', '#8ee6ee', HUSH.emit.spike),
    spikeViolet: glowM('spike.violet', '#b597ff', HUSH.emit.spike),
    pool: makeMaterial({ color: HUSH.pool, flat: true, refl: 0.35, highlight: 0.25, key: `temple.skin.${id}.pool` }),
    cable: makeMaterial({ ...look, color: HUSH.cable, flat: true, metal: 'iron', refl: 0.25, highlight: 0.2, hatch: 0.3, key: `temple.skin.${id}.cable` }),
    slate: makeMaterial({ ...look, color: '#ffffff', vertexColors: true, flat: true, hatch: 0.2, key: `temple.skin.${id}.slate` }),
    light: makeMaterial({ color: '#ffffff', vertexColors: true, glow: HUSH.emit.crystal, flat: true, side: THREE.DoubleSide, key: `temple.skin.${id}.light` }),
    // (the jaws': the seams on their slabs' points lit violet where the leaves interlock, their stiles dark slate)
    lip: glowM('lip', HUSH.violet, HUSH.emit.ring),
    stile: makeMaterial({ ...look, color: '#2e2f46', flat: true, key: `temple.skin.${id}.stile` }),
  };
  for (const k of ['slate', 'light']) mats[k].vertexColors = true;
  const was = { M: { wall: M.wall, wallGlyph: M.wallGlyph, floor: M.floor, bands: M.bands, trim: M.trim, stone: M.stone, dark: M.dark, glyph: M.glyph, ornament: M.ornament } };
  Object.assign(M, {
    wall: mats.wall, wallGlyph: mats.wallGlyph, floor: mats.floor, glyph: mats.glyph,
    bands: HUSH.bands.map((b) => ({ ...b, mat: paint(b.color) })),
    trim: paint(HUSH.trim), stone: paint(HUSH.stone), dark: paint(HUSH.dark),
    // (the crystals by the frieze's glyphs lit teal and violet by turns)
    ornament: M.ornament ? { ...M.ornament, mats: { ...M.ornament.mats, a: mats.teal, b: mats.violetOrn } } : M.ornament,
  });
  K.plan = [];
  // While the layout runs, what it draws in its own materials: the bog's water a black pool, the roots (tubes in the
  // floor's) cables, its crystals teal and violet by turns (each noted, for a plinth under it). Drawn only: the solids
  // go through K.solid as they were.
  const own = (mat, k) => mat?.userData?.cacheKey?.includes(`"key":"temple.lorn.${k}"`);
  const spikes = [];
  let ns = 0;
  K.add = function add(mat, geo) {
    let m = mat;
    if (own(mat, 'bog')) m = mats.pool;
    else if (mat === mats.floor && geo?.type === 'TubeGeometry') m = mats.cable;
    else if (own(mat, 'crystal') && geo) {
      geo.computeBoundingBox();
      const b = geo.boundingBox, c = b.getCenter(V());
      spikes.push({ x: c.x, y: b.min.y, z: c.z, r: Math.min(1.1, Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2) });
      m = ns++ % 2 ? mats.spikeViolet : mats.spikeTeal;
    }
    return Object.getPrototypeOf(this).add.call(this, m, geo);
  };
  const meshes = [];
  const skin = {
    name: 'hush-house', mats, meshes, stats: null, light: HUSH.light,
    /** After the layout: the rooms handed to the shader, the pieces' surfaces in their own frame, the dressing placed. */
    dress() {
      const t0 = performance.now(), rooms = roomsOf(K.plan);
      const list = [...rooms.filter((r) => r.kind === 'round'), ...rooms.filter((r) => r.kind === 'hall'), ...rooms.filter((r) => r.kind === 'corridor')].slice(0, HUSH_ROOMS);
      list.forEach((r, i) => {
        U.rooms.value[i].set(r.x, r.z, r.kind === 'round' ? r.r : r.hx, r.kind === 'round' ? -1 : r.hz);
        U.roomsY.value[i].set(r.y0, r.y1, r.kind === 'round' && r.oculus > 0 ? r.r * r.oculus : 0, 0);
      });
      U.count.value = list.length;
      for (const p of rt.pieces) {
        const o = p.group ?? p.mesh ?? p.root;
        o?.traverse?.((m) => { if (m.material === mats.floor) m.material = mats.floorObj; else if (m.material === mats.wallGlyph) m.material = mats.wallGlyphObj; });
      }
      const keep = keepOuts(rt, new Set([mats.wall, mats.wallGlyph, mats.floor, M.sand, mats.pool, mats.cable, mats.spikeTeal, mats.spikeViolet]));
      const d = dress(rt, keep, rooms, spikes);
      const slate = drawnOnly('skin: wedges, collars and plinths', d.slateGeo.applyMatrix4(K.frame), mats.slate);
      const light = drawnOnly('skin: resonators and rings', d.lightGeo.applyMatrix4(K.frame), mats.light);
      slate.geometry.computeBoundingSphere(); light.geometry.computeBoundingSphere();
      meshes.push(slate, light);
      for (const m of meshes) K.group.add(m);
      const jaws = shutters(rt, look, U, mats);
      rt.pieces.push(new SkinMotion({ slate, light, keepSlate: d.keepSlate, keepLight: d.keepLight, jaws, lightMat: mats.light }));
      skin.stats = { ...d.stats, spikes: spikes.length, jaws: new Set(jaws.map((j) => j.piece)).size, rooms: list.length, ms: Math.round(performance.now() - t0) };
    },
    /**
     * After the kit's flush: the house's own materials and drawing back for its exterior; the lights (their glow under
     * the shadow passes' self-lit 0.8, to keep their halo tight) kept out of the shadow passes.
     */
    done() {
      Object.assign(M, was.M); K.plan = null; delete K.add;
      const lights = new Set([mats.glyph, mats.teal, mats.violetOrn, mats.light, mats.lip]);
      K.group.traverse((o) => { if (o.isMesh && lights.has(o.material)) { o.castShadow = false; o.userData.castShadow = false; } });
    },
  };
  return skin;
}
