import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../../materials.js';
import { paint } from '../kit.js';
import { glyphGeometry } from '../../story/sign-text.js';

// ---------------------------------------------------------------------------
// The Casting-House in its futuristic skin (issue #342, docs/systems/temples.md "Futuristic skins"): the inside of the
// founders' house in the Moon Foundry redrawn after the author's picks (references/temples/future/casting-house/
// sheet-1.jpg, sheet-2.jpg): a tall round hall of dark iron-brown slate in tall slabs with chamfered edges, thin ivory
// circuits running round the foot of every wall and climbing it in steps to lens terminals, warm brown floor plates with
// ivory rings inlaid, the great cracked moon hung in a floating ring of dark metal (held by nothing: its chains gone), the
// pilot flames held in floating machined rings, every sealed door in a heavy slab frame with a lit line round its
// opening and a lit seam down its middle, the hooded cradles as machined cups of dark metal with the makers' sign lit on
// them, and a square grating in the Pouring Floor with the Last Founder's furnace glowing under it. Look only: the same
// rooms, doors, collision, pieces, positions, timings and logic (skins/index.js; tests/temple-skins.test.js).
//   1. surfaces: the wall, the makers' marked metal (the doors: wallGlyph), the floor and the trim swapped for the skin's:
//      the surface shader with its albedo, its first pen lines and its glow replaced, as landmark-materials.js stone()
//      does. A round room's slabs run round it without a seam (the rooms the kit recorded, uSkR). The cracked moons (the
//      house's ivory) in a shader of their own: cells cracked apart, pale, a little lit.
//   2. the glow: the circuits, the floors' inlays, the doors' seams and frames, the rings' inner lines, the cradles'
//      signs, the frieze's glyphs (the shared makers' mark, as every sign in the house): ivory, just over the post pass's halo start (0.62:
//      CASTING.emit), so lines stay crisp; the circuits breathe slowly. The grating's furnace light the pour's amber.
//   3. dressing, drawn only (InstancedMeshes: noCollide, keepBuried, dynamic, out of the shadow passes), two draws for the
//      whole house: the machined metal (the doors' slab frames, the moon's ring, the flames' rings) and its lights.
//   4. the cradles (pieces.js Brazier asks rt.skin.brazier): a machined cup on a plinth between two cheeks, its sign
//      brightening when the hot moon lights it; the same hooded mouth, fire and logic.
// On Low, Handheld and the Deck (uWearLite) the shader leaves out the slabs' tones and chamfers, the climbing circuits
// and the moon's cracks' tones.
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
/** Up to this many rooms are handed to the shader (the round ones first). */
export const CASTING_ROOMS = 16;

/** The skin's colours (sRGB, after the picks' pixels) and sizes (m). */
export const CASTING = {
  ivory: '#fff0d2',
  /** the upper floor's height (m: moonfoundry.js UP), where the walls' second tier of circuits starts */
  up: 11,
  amber: '#f2a04c',
  /** the slate: its slabs' two tones, the grooves; panel heights (m: tall, few joints), slab cells (m), the foot line's
   *  height over its room's floor (m), a ceiling's rings (m) */
  wall: { color: '#5f4c3b', a: '#543f2e', b: '#6e5944', c: '#2e231a', panel: 7, cell: 1.6, foot: 1.0, ceil: 3.2 },
  /** the founders' machined metal: the doors (panels m) */
  metal: { color: '#4e3e30', a: '#48392c', b: '#574636', c: '#261d16', panel: 1.75 },
  /** the trim (kerbs, the chest's mound, the landings' edges, the dressing's frames and rings): darker machined metal */
  trim: { color: '#463a30', a: '#41352b', b: '#4e4135', c: '#221a14', panel: 2.2 },
  /** the floors' plates (m): warm brown, as the picks' */
  floor: { color: '#7a6250', a: '#725a48', b: '#836a56', c: '#52402f', plate: 3.0 },
  /** the cracked moons: two tones of ivory, the cracks, the cells (m) and how lit they are */
  moon: { a: '#e8d5b0', b: '#d8c29b', c: '#9a8466', cell: 0.75, emit: 0.5 },
  /** the founders' iron (the claws, the rails, the chains, the columns) warmed to the picks' dark brown metal */
  iron: { from: '#3f393a', to: '#3a2f27' },
  /** the bands across the walls (kit.js M.bands): a dark plinth (no course under the frieze: the picks' walls run clear) */
  bands: [{ y: 0.45, h: 0.9, color: '#3a2e24' }],
  stone: '#5a4a3c',
  /** the grating over the Last Founder in the Pouring Floor (local m: its middle, half sizes; bars every m) */
  grate: { x: 8, z: 38.5, hx: 3.4, hz: 2.8, bar: 0.75 },
  /** the great moon made larger (its middle, local m, and how much), in its floating ring (radii, height, tilt) */
  moonAt: { x: 0, y: 16, z: 32, scale: 1.35, ring: [4.4, 5.0, 0.55, 0.08] },
  /** a pilot flame's two floating rings: [inner, outer radius, height, y over the flame] */
  flameRings: [[1.25, 1.6, 0.34, 3.6], [1.45, 1.85, 0.3, 6.0]],
  /** how bright the skin's lights are (makeMaterial glow; post.js haloes over 0.62: just over it keeps a halo tight) */
  emit: { glyph: 0.72, lights: 0.74, lines: 0.74, grate: 0.76, sign: 0.4, signLit: 0.8, ring: 0.7 },
};

// ------------------------------------------------------------------ the surfaces: the shader's patterns
// (declared before main(): the surface shader's hash, vnoise, uTime, uPixelRatio and uWearLite are in scope by then)
const SK_PARS = /* glsl */ `
  uniform vec3 uSkinO;
  uniform vec4 uSkR[${CASTING_ROOMS}];
  uniform vec4 uSkY[${CASTING_ROOMS}];
  uniform int uSkN;
  uniform vec3 uSkA;
  uniform vec3 uSkB;
  uniform vec3 uSkC;
  uniform vec3 uSkG;
  uniform vec3 uSkE;
  uniform vec4 uSkP;
  uniform vec4 uSkQ;
  uniform float uSkObj;
`;
const SK_GLSL = /* glsl */ `
  float skH1(float x) { return fract(sin(x * 91.3458) * 47453.5453); }
  float skH2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec3 skH3(vec3 p) { p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453); }
  // a pen line d metres from its middle, px metres a pixel
  float skInkL(float d, float px) { float w = 0.5 * uPixelRatio * px; return 1.0 - smoothstep(w, w + px * 1.1, d); }
  // a thin lit line (half width hw m, never under ~0.6 px), its coverage
  float skLit(float d, float px, float hw) { float w = max(hw, 0.6 * px); return 1.0 - smoothstep(w, w + px, d); }
  // along a wall: (m round a round room the kit recorded, its circumference), else (by the face's axis, 0)
  vec2 skAlong(vec3 p, vec3 nn) {
    for (int i = 0; i < ${CASTING_ROOMS}; i++) {
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
    for (int i = 0; i < ${CASTING_ROOMS}; i++) {
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
  // a lens terminal (the picks' little rings on the circuits): a ring and a dot, d m from its middle
  float skLens(float d, float px, float r) { return max(skLit(abs(d - r), px, 0.022), skLit(d, px, 0.045)); }
`;

/**
 * Each pattern replaces the surface's `vec3 albedo = uColor;` (its first pen lines: skInk; its glow: skGlow, added to
 * the surface's emit before the light, in the colour skGC). uSkP: the skin's sizes; uSkG: the glow's colour.
 *   slate: the walls. Tall vertical slabs (cells of uSkP.y m, one to three a slab; a joint across one every uSkP.x m or
 *     so, staggered), each its tone between uSkA and uSkB, a chamfer lit down its left edge and shaded down its right,
 *     the joints inked. A thin ivory line round the wall uSkP.z m over its room's floor, and from some joints a line
 *     climbing from it, stepping sideways once, up to a lens terminal high on the wall. Ceilings: rings of slabs.
 *   metal: the founders' machined panels (uSkP.x m), seams inked, chamfered, an ivory seam down some (uSkP.y > 0); a
 *     door's (uSkObj) always down its middle, where its two slabs meet.
 *   plates: the floors. Plates (uSkP.x m) in rings round a round room's middle, in a grid in a hall; at a room's own floor
 *     an ivory inlay round each room 1.6 m in from its walls (a round room's doubled, and a ring and four spokes round its
 *     middle). The grating (uSkQ: its middle and half sizes, local m): dark bars over the amber glow of the furnace under it.
 *   moon: the cracked moons: cells of uSkP.x m cracked apart (3D cells: every moon cracks where it is), two tones of
 *     ivory, lit uSkP.y.
 */
const BODIES = {
  slate: /* glsl */ `
    vec3 skP = uSkObj > 0.5 ? vObjPos : vWorldPos - uSkinO;
    float skPx = max(max(length(dFdx(skP)), length(dFdy(skP))), 1e-4);
    float skInk = 0.0, skGlow = 0.0;
    vec3 albedo = uColor, skGC = uSkG;
    {
      bool lite = uWearLite > 0.5;
      float pulse = 0.82 + 0.18 * sin(uTime * 0.7 - skP.y * 0.08);
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
          albedo *= 1.0 + near * (0.18 * (1.0 - smoothstep(ch * 0.55, ch, dl)) - 0.16 * (1.0 - smoothstep(ch * 0.55, ch, dr)));
          skInk = max(skInk, skInkL(abs(dl - ch), skPx) * 0.3 * near);
        }
        skInk = max(skInk, max(skInkL(dv, skPx) * 0.75, skInkL(dh, skPx) * 0.7) * near);
        // the circuits: a line round the wall's foot, over its room's floor
        // (the house's two floors, 0 and the upper floor SK_UP m up: no search of the rooms per pixel; a tall room's wall
        // gets a second line and tier of circuits from the upper floor's height, as the picks' tall walls)
        float fy = skP.y >= SK_UP - 0.3 ? SK_UP : 0.0;
        float by = skP.y - fy;
        float c = skLit(abs(by - uSkP.z), skPx, 0.024);
        // ... and from some joints a line climbing from it, stepping sideways once, up to a lens terminal
        if (!lite && jl) {
          float k = NC > 0.5 ? mod(ci, NC) : ci;
          float has = step(0.68, skH1(k * 7.7 + 1.3));
          float jy = 2.6 + skH1(k * 2.9) * 4.0, jx = (0.35 + 0.4 * skH1(k * 5.1)) * CW, top = jy + 5.0 + skH1(k * 3.7) * 10.0;
          if (fy < 0.5) top = min(top, SK_UP - 1.2);   // (a lower tier's lens under the upper floor's line)
          float x = cf * CW, xl = by < jy ? 0.24 : 0.24 + jx;
          float v = skLit(abs(x - xl), skPx, 0.02) * step(uSkP.z, by) * step(by, top - 0.2);
          v = max(v, skLit(abs(by - jy), skPx, 0.02) * step(0.24, x) * step(x, 0.24 + jx));
          v = max(v, skLens(length(vec2(x - 0.24 - jx, by - top)), skPx, 0.12));
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
      albedo = mix(albedo, skGC, skGlow);
      skInk *= 1.0 - skGlow;
      skGlow *= SK_LINES;   // (the light the lines give: just over the post pass's halo, so they stay crisp)
    }
  `,
  metal: /* glsl */ `
    vec3 skP = uSkObj > 0.5 ? vObjPos : vWorldPos - uSkinO;
    float skPx = max(max(length(dFdx(skP)), length(dFdy(skP))), 1e-4);
    float skInk = 0.0, skGlow = 0.0;
    vec3 albedo = uColor, skGC = uSkG;
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
        albedo *= 1.0 + near * (0.16 * (1.0 - smoothstep(ch * 0.6, ch, (1.0 - cf.y) * S)) - 0.14 * (1.0 - smoothstep(ch * 0.6, ch, cf.y * S)));
        skInk = max(skInk, max(skInkL(abs((1.0 - cf.y) * S - ch), skPx), skInkL(abs(cf.x * S - ch), skPx)) * 0.28 * near);
      }
      skInk = max(skInk, max(skInkL(dx, skPx), skInkL(dy, skPx)) * 0.75 * near);
      // an ivory seam down some panels' joints (not the trim's); a door's down its middle, where its slabs meet
      float j = floor(q.x + 0.5);
      float lit = step(0.5, uSkP.y) * max(step(0.62, skH1(j * 3.9 + 1.7)), uSkObj * step(abs(j), 0.5));
      skGlow = skLit(dx, skPx, 0.024) * lit * (0.82 + 0.18 * sin(uTime * 0.9 + skP.y * 0.25));
      albedo = mix(albedo, skGC, skGlow);
      skInk *= 1.0 - skGlow;
      skGlow *= SK_LINES;
    }
  `,
  plates: /* glsl */ `
    vec3 skP = uSkObj > 0.5 ? vObjPos : vWorldPos - uSkinO;
    float skPx = max(max(length(dFdx(skP)), length(dFdy(skP))), 1e-4);
    float skInk = 0.0, skGlow = 0.0;
    vec3 albedo = uColor, skGC = uSkG;
    {
      bool lite = uWearLite > 0.5;
      float S = uSkP.x, near = 1.0 - smoothstep(S / 40.0, S / 14.0, skPx);
      vec4 R = vec4(0.0, 0.0, 2.2, -1.0), Y = vec4(0.0);
      bool inRoom = uSkObj > 0.5 ? false : skRoomOf(skP, R, Y);
      bool low = inRoom && skP.y < Y.x + 0.6;
      if (n.y > 0.65) {
        float t = 0.5;
        vec2 gq = skP.xz - uSkQ.xy, ge = abs(gq) - uSkQ.zw;
        bool grate = uSkObj < 0.5 && uSkQ.z > 0.0 && max(ge.x, ge.y) < 0.0 && abs(skP.y - uSkP.y) < 0.2;
        if (grate) {
          // the grating: dark iron bars in a frame, between them the furnace's light far under, brightest at its heart,
          // the rings of the machine's crucible doors dark in it
          float B = uSkP.z;
          vec2 g = fract(gq / B), gd = min(g, 1.0 - g) * B;
          float bar = 1.0 - smoothstep(0.06, 0.06 + skPx, min(gd.x, gd.y));
          float frame = 1.0 - smoothstep(0.32, 0.32 + skPx, -max(ge.x, ge.y));
          float r = length(gq * vec2(0.8, 1.0)), heart = 1.0 - smoothstep(0.0, max(uSkQ.z, uSkQ.w) * 1.15, r);
          float rings = skInkL(abs(fract(r / 1.05) - 0.5) * 1.05, skPx) * 0.55;
          float under = (0.55 + 0.45 * heart) * (0.86 + 0.14 * sin(uTime * 1.3 + r * 1.7)) * (1.0 - rings);
          float iron = max(bar, frame);
          albedo = mix(uSkE * (0.5 + 0.5 * heart), uSkC * 0.7, iron);
          skGC = uSkE;
          skGlow = under * (1.0 - iron);
          skInk = max(skInkL(min(gd.x, gd.y) - 0.06, skPx), skInkL(-max(ge.x, ge.y) - 0.32, skPx)) * (1.0 - skGlow);
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
            skGlow = max(max(skLit(abs(r - ro), skPx, 0.03), skLit(abs(r - ro + 0.4), skPx, 0.018)), skLit(abs(r - rm), skPx, 0.026));
            float an = atan(d.y, d.x) + 0.3927, sp = abs(fract(an / 1.5707963 + 0.5) - 0.5) * 1.5707963 * r;
            skGlow = max(skGlow, skLit(sp, skPx, 0.022) * step(rm, r) * step(r, ro - 0.4));
          }
        } else {
          // a grid of plates (from the room's middle); the inlay round the room 1.6 m in
          vec2 d = skP.xz - R.xy;
          vec2 g = (d + (inRoom ? vec2(0.0) : vec2(0.5 * S))) / S, gi = floor(g), gf = fract(g);
          skInk = max(skInkL(min(gf.x, 1.0 - gf.x) * S, skPx), skInkL(min(gf.y, 1.0 - gf.y) * S, skPx)) * 0.6 * near;
          t = skH2(gi + 0.13);
          if (low) {
            float e = max(abs(d.x) - R.z, abs(d.y) - R.w);
            skGlow = skLit(abs(e + 1.6), skPx, 0.036) * step(4.0, min(R.z, R.w));
          }
        }
        // (the grating's own ivory line round it, half a metre out, as sheet-2's)
        if (!grate && uSkQ.z > 0.0 && abs(skP.y - uSkP.y) < 0.2) skGlow = max(skGlow, skLit(abs(max(ge.x, ge.y) - 0.5), skPx, 0.03));
        if (!lite && !grate) albedo = mix(albedo, mix(uSkA, uSkB, t), 0.7 * near + 0.2);
        if (!low && !grate) albedo *= 1.06;   // (a raised floor a shade lighter: the landings, the dais)
      } else if (n.y < -0.65) {
        // a floor's underside, the ceiling of the room under it: slate
        albedo = SK_UNDER;
        skInk = max(skInkL(skSeam(skP.x, 3.0), skPx), skInkL(skSeam(skP.z, 3.0), skPx)) * 0.6;
      } else {
        // a slab's or a ledge's edge: its side darker, a course line under its top
        albedo = uColor * 0.82;
        float top = fract(skP.y / 0.8);
        skInk = skInkL(min(top, 1.0 - top) * 0.8, skPx) * 0.4 * near;
      }
      if (skGC == uSkG) skGlow *= 0.84 + 0.16 * sin(uTime * 0.6 + length(skP.xz) * 0.12);
      albedo = mix(albedo, skGC, skGlow);
      skInk *= 1.0 - skGlow;
      skGlow *= SK_LINES;
    }
  `,
  moon: /* glsl */ `
    vec3 skP = vWorldPos - uSkinO;
    float skPx = max(max(length(dFdx(skP)), length(dFdy(skP))), 1e-4);
    float skInk = 0.0, skGlow = uSkP.y;
    vec3 albedo = uColor, skGC = albedo;
    {
      // 3D cells: the nearest two seeds, the crack where they meet
      float C = uSkP.x;
      vec3 q = skP / C, qi = floor(q), qf = fract(q);
      float f1 = 9.0, f2 = 9.0; vec3 id = vec3(0.0);
      for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) {
        vec3 o = vec3(float(i), float(j), float(k)), s = o + 0.15 + 0.7 * skH3(qi + o) - qf;
        float d = dot(s, s);
        if (d < f1) { f2 = f1; f1 = d; id = qi + o; } else if (d < f2) f2 = d;
      }
      float edge = (sqrt(f2) - sqrt(f1)) * 0.5 * C;
      float near = 1.0 - smoothstep(C / 30.0, C / 8.0, skPx);
      if (uWearLite < 0.5) albedo = mix(uSkA, uSkB, skH3(id).x);
      albedo = mix(albedo, uSkC, (1.0 - smoothstep(0.0, 0.02, edge)) * 0.3 * near);
      skInk = skInkL(edge, skPx) * 0.45 * near;
      skGC = albedo;
    }
  `,
};

/** The surface material of a skin's pattern: makeMaterial's own, its albedo, first pen lines and glow the pattern's. */
function skinMaterial(body, look, pat, U, key, obj = false) {
  const m = makeMaterial({ flat: true, ...look, color: pat.color, key: `temple.skin.${key}` });
  // (the house's rooms and origin, this build's: a material from the cache is pointed at them again)
  Object.assign(m.uniforms, { uSkinO: U.origin, uSkR: U.rooms, uSkY: U.roomsY, uSkN: U.count, uSkQ: U.grate });
  if (m.userData.houseSkin) return m;
  m.userData.houseSkin = body;
  const fs = m.fragmentShader, at = fs.lastIndexOf('void main()');
  const u = new THREE.Color(CASTING.wall.color), under = `#define SK_UNDER vec3(${u.r.toFixed(4)}, ${u.g.toFixed(4)}, ${u.b.toFixed(4)})\n#define SK_LINES ${CASTING.emit.lines.toFixed(3)}\n#define SK_UP ${CASTING.up.toFixed(2)}\n`;
  const LIGHT = 'L = mix(L, 1.0, max(uGlow, emit));';
  if (at < 0 || !fs.includes('vec3 albedo = uColor;') || !fs.includes('float detail = 0.0;') || !fs.includes(LIGHT)) throw new Error('skins/casting-house.js: the surface shader changed: no albedo, light or detail line to replace');
  m.fragmentShader = SK_PARS + under + fs.slice(0, at) + SK_GLSL + fs.slice(at)
    .replace('vec3 albedo = uColor;', BODIES[body])
    .replace(LIGHT, `emit = max(emit, skGlow); ${LIGHT}`)
    .replace('float detail = 0.0;', 'float detail = skInk;');
  Object.assign(m.uniforms, {
    uSkA: { value: new THREE.Color(pat.a ?? pat.color) }, uSkB: { value: new THREE.Color(pat.b ?? pat.color) }, uSkC: { value: new THREE.Color(pat.c ?? pat.color) },
    uSkG: { value: new THREE.Color(CASTING.ivory) }, uSkE: { value: new THREE.Color(CASTING.amber) },
    uSkP: { value: new THREE.Vector4(...[...pat.size, 0, 0, 0, 0].slice(0, 4)) },
    uSkObj: { value: obj ? 1 : 0 },
  });
  return m;
}

// ------------------------------------------------------------------ the shapes
/** Strip a geometry to positions and normals, non-indexed (for merging). */
const bare = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };

/** A geometry's vertices in the kit's frame, and how they sit: its box, its middle. */
function shapeOf(K, g) {
  const p = g.attributes.position, v = V(), box = new THREE.Box3(), pts = [];
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(K.inv); box.expandByPoint(v); pts.push(v.clone()); }
  return { box, c: box.getCenter(V()), s: box.getSize(V()), pts };
}

/**
 * The frieze's glyphs are the kit's own, the shared makers' mark (src/story/sign-text.js glyphGeometry), lit ivory: counted,
 * never redrawn (tests/temple-skins.test.js). The doors' medallions are pieces.js Door's own, the same mark.
 */
const countSigns = (K, mat) => K.batches.get(mat)?.filter((g) => g.userData.makersMark).length ?? 0;

/** A machined ring (a lathe of a chamfered rectangle: radii r0..r1, height h), its middle at the origin. */
function ringGeometry(r0, r1, h, seg = 64) {
  const c = Math.min(0.08, (r1 - r0) * 0.25, h * 0.25);
  const prof = [[r0 + c, -h / 2], [r1 - c, -h / 2], [r1, -h / 2 + c], [r1, h / 2 - c], [r1 - c, h / 2], [r0 + c, h / 2], [r0, h / 2 - c], [r0, -h / 2 + c], [r0 + c, -h / 2]];
  return bare(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), seg));
}
/** A ring's lit line round its inner face, a hair inside it. */
const ringLine = (r0, h, seg = 64) => bare(new THREE.CylinderGeometry(r0 - 0.012, r0 - 0.012, Math.min(0.07, h * 0.3), seg, 1, true));

/**
 * A door's slab frame (sheet-1's great door): jambs and a lintel of the dark machined metal round the opening, deeper on
 * a round room's side (its wall curves out toward the room), the opening's top corners chamfered; an ivory line up the
 * inside of each jamb and across under the lintel, on both faces. In the door's frame (x across, z through), local m.
 *   w, h the slab; side the door's own stone either side (pieces.js Door o.frame); zIn, zOut how far each face stands
 */
function doorFrame(w, h, side, zIn, zOut) {
  const X0 = w / 2 + side + 0.04, JW = 0.9, L0 = h + 0.95, LH = 0.75, D = zIn + zOut, zc = (zIn - zOut) / 2;   // (the lintel over the door's lamps)
  const solid = [], light = [];
  for (const s of [-1, 1]) {
    solid.push(new THREE.BoxGeometry(JW, L0 + LH, D).translate(s * (X0 + JW / 2), (L0 + LH) / 2, zc));
    // (the opening's top corner chamfered: a wedge of the frame's metal)
    solid.push(new THREE.BoxGeometry(0.85, 0.85, D - 0.06).rotateZ(Math.PI / 4).translate(s * X0, h + 0.04, zc));
  }
  solid.push(new THREE.BoxGeometry(2 * (X0 + JW), LH, D).translate(0, L0 + LH / 2, zc));
  for (const [z, f] of [[zIn, 1], [-zOut, -1]]) {
    const zz = z + f * 0.018;
    for (const s of [-1, 1]) light.push(new THREE.BoxGeometry(0.07, L0 - 0.18, 0.03).translate(s * (X0 + 0.2), 0.3 + (L0 - 0.18) / 2, zz));
    light.push(new THREE.BoxGeometry(2 * X0 + 0.47, 0.07, 0.03).translate(0, L0 + 0.12, zz));
  }
  return { solid: solid.map(bare), light: light.map(bare) };
}

// ------------------------------------------------------------------ the cradles
/**
 * A hooded cradle (pieces.js Brazier: its group faces its mouth, +z), as sheet-2's: a machined half-pipe of dark metal
 * open to the rail (the moon rolls up to its mouth), on two legs on a plinth, closed behind by a tall slab, the hood, with
 * a stepped cap; an ivory line round the half-pipe's mouth and the makers' sign lit on the slab over the fire, brighter
 * once the hot moon lights it (SkinCradles). All of it behind the moon's resting place in its mouth.
 */
function cradleBody(piece, s, mats) {
  const r = 1.2 * s, ax = 1.75 * s, z0 = -1.1 * s, z1 = 0.7 * s, open = 1.75;   // (open: radians up each side from the bottom)
  const parts = [], lights = [];
  // the half-pipe along z (a cylinder's point at theta, (sin, ·, cos), turned onto z is (sin, -cos, ·): theta 0 at the bottom)
  parts.push(new THREE.CylinderGeometry(r, r, z1 - z0, 28, 1, true, -open, 2 * open).rotateX(Math.PI / 2).translate(0, ax, (z0 + z1) / 2));
  // the hood behind it, its stepped cap; the legs and the plinth
  const HW = 2 * r + 0.3 * s, HH = 3.3 * s;
  parts.push(new THREE.BoxGeometry(HW, HH, 0.3 * s).translate(0, HH / 2, z0 - 0.15 * s));
  parts.push(new THREE.BoxGeometry(HW * 0.55, 0.35 * s, 0.4 * s).translate(0, HH + 0.175 * s, z0 - 0.15 * s));
  parts.push(new THREE.BoxGeometry(2 * r + 0.5 * s, 0.4 * s, 2.0 * s).translate(0, 0.2 * s, -0.25 * s));
  for (const x of [-1, 1]) parts.push(new THREE.BoxGeometry(0.35 * s, 0.6 * s, 1.4 * s).translate(x * 0.75 * s, 0.7 * s, -0.2 * s));
  // the lit line round the mouth (a torus's point at u, (cos, sin, 0): u = theta - π/2), the sign on the hood over the fire
  lights.push(new THREE.TorusGeometry(r, 0.026 * s, 3, 28, 2 * open).rotateZ(-open - Math.PI / 2).translate(0, ax, z1 + 0.012));
  lights.push(glyphGeometry(0.95 * s, 0.04).translate(0, 2.6 * s, z0 + 0.03));
  const body = new THREE.Mesh(mergeGeometries(parts.map(bare)), mats.cradle);
  const glowM = makeMaterial({ color: CASTING.ivory, glow: CASTING.emit.sign, flat: true, key: `temple.skin.casting.cradle.${piece.id}` });
  const glow = new THREE.Mesh(mergeGeometries(lights.map(bare)), glowM);
  body.name = 'cradle (skin)'; glow.name = 'cradle sign (skin)';
  glow.castShadow = false; glow.userData.castShadow = false;
  piece.group.add(body, glow);
  piece.skinGlow = glowM;
  return true;
}

// ------------------------------------------------------------------ placing the dressing
/** An instanced, drawn-only mesh of the dressing: walked through, never buried, never casting a shadow. */
function instanced(name, geo, mat, list, frame) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  m.name = name; m.count = list.length;
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

/** The kit's rooms (local): halls, round rooms and passages, with their floors, ceilings and oculi. */
function roomsOf(plan) {
  const out = [];
  for (const e of plan) {
    if (e.kind === 'hall') out.push({ kind: 'hall', x: e.x, z: e.z, hx: e.w / 2, hz: e.d / 2, y0: e.y, y1: e.y + e.h, oculus: e.oculus });
    else if (e.kind === 'round') out.push({ kind: 'round', x: e.x, z: e.z, r: e.r, t: e.t ?? 1.4, y0: e.y, y1: e.y + e.h, oculus: e.oculus });
    else if (e.kind === 'corridor') out.push({ kind: 'corridor', x: (e.x0 + e.x1) / 2, z: (e.z0 + e.z1) / 2, hx: (e.x1 - e.x0) / 2, hz: (e.z1 - e.z0) / 2, y0: e.y, y1: e.y + e.h });
  }
  return out;
}

/** Each door's slab frame, in the kit's frame: deeper on a round room's side, where its wall curves out. */
function doorFrames(rt, rooms) {
  const K = rt.kit, solid = [], light = [];
  let n = 0;
  for (const d of rt.pieces) {
    if (d.constructor.name !== 'Door' || !Array.isArray(d.o?.at)) continue;
    const { w = 4.4, h = 6, t = 0.9 } = d.o, side = d.o.frame?.side ?? 0, yaw = d.o.yaw ?? 0, [ax, ay, az] = d.o.at;
    const nrm = V(Math.sin(yaw), 0, Math.cos(yaw)), xo = w / 2 + side + 0.94;
    let zIn = Math.max(1.0, t / 2 + 0.35), zOut = zIn;
    for (const R of rooms) {
      if (R.kind !== 'round' || Math.abs(ay - R.y0) > 1) continue;
      const c = V(R.x - ax, 0, R.z - az), dist = c.length();
      if (Math.abs(dist - R.r - R.t / 2) > 1.2) continue;
      // (the wall's room face at the frame's outer edge: r - sqrt(r² - x²) nearer the room than at the door's middle)
      const bow = R.r - Math.sqrt(Math.max(0, R.r * R.r - xo * xo)) + R.t / 2 + 0.3;
      if (c.dot(nrm) > 0) zIn = Math.max(zIn, bow); else zOut = Math.max(zOut, bow);
    }
    const f = doorFrame(w, h, side, zIn, zOut), m = new THREE.Matrix4().makeRotationY(yaw).setPosition(ax, ay, az);
    for (const g of f.solid) solid.push(g.applyMatrix4(m));
    for (const g of f.light) light.push(g.applyMatrix4(m));
    n++;
  }
  return { solid, light, n };
}

/** Breathing: the cradles' signs, brighter once lit. */
class SkinCradles {
  constructor(braziers) { this.braziers = braziers; }
  update(dt, t = 0) {
    for (const b of this.braziers) {
      const want = b.flames ? CASTING.emit.signLit : CASTING.emit.sign;
      const u = b.skinGlow?.uniforms?.uGlow;
      if (u) u.value += (want + 0.03 * Math.sin(t * 1.2) - u.value) * Math.min(1, dt * 2);
    }
  }
}

// ------------------------------------------------------------------ the house's skin
/**
 * The Casting-House's futuristic skin (skins/index.js: a house's `def.skin`), called before def.layout(rt): rt.M's
 * surfaces, trim, bands, glyph and ornament swapped for the skin's, rt.P's glow ivory, the kit's plan recording.
 */
export function castingHouseSkin(rt) {
  const K = rt.kit, M = rt.M, id = rt.def.id, look = rt.def.palette?.look?.all ?? {};
  const G = CASTING.grate;
  const U = {
    origin: { value: K.origin.clone() },
    rooms: { value: Array.from({ length: CASTING_ROOMS }, () => new THREE.Vector4()) },
    roomsY: { value: Array.from({ length: CASTING_ROOMS }, () => new THREE.Vector4()) },
    count: { value: 0 },
    grate: { value: new THREE.Vector4(G.x, G.z, G.hx, G.hz) },
  };
  const W = CASTING.wall, Mt = CASTING.metal, Tr = CASTING.trim, F = CASTING.floor, Mo = CASTING.moon, E = CASTING.emit;
  const glowM = (k, glow, side) => makeMaterial({ color: CASTING.ivory, glow, flat: true, ...(side ? { side } : {}), key: `temple.skin.${id}.${k}` });
  // (the hatching sparse on the slate, as the picks' shadows)
  const mats = {
    wall: skinMaterial('slate', { ...look, hatch: 0.15 }, { ...W, size: [W.panel, W.cell, W.foot, W.ceil] }, U, `${id}.wall`),
    wallGlyph: skinMaterial('metal', { ...look, hatch: 0.2, glyphs: 1.6 }, { ...Mt, size: [Mt.panel, 1, 0] }, U, `${id}.wallGlyph`),
    trim: skinMaterial('metal', { ...look, hatch: 0.2 }, { ...Tr, size: [Tr.panel, 0, 0] }, U, `${id}.trim`),
    floor: skinMaterial('plates', { ...look, hatch: 0.3 }, { ...F, size: [F.plate, 0, G.bar, 0] }, U, `${id}.floor`),
    moon: skinMaterial('moon', { ...look, hatch: 0.1 }, { color: Mo.a, a: Mo.a, b: Mo.b, c: Mo.c, size: [Mo.cell, Mo.emit] }, U, `${id}.moon`),
    // (the pieces' own: a door's slabs take their pattern in their own frame, their seam down their middle)
    wallGlyphObj: skinMaterial('metal', { ...look, hatch: 0.2, glyphs: 1.6 }, { ...Mt, size: [Mt.panel, 1, 0] }, U, `${id}.wallGlyphObj`, true),
    // (the cradles' cups seen from inside: both faces)
    cradle: skinMaterial('metal', { ...look, hatch: 0.2, side: THREE.DoubleSide }, { ...Tr, size: [0.9, 0, 0] }, U, `${id}.cradle`, true),
    // (the lights just over the post pass's halo start: crisp lines, not soft blobs)
    glyph: glowM('glyph', E.glyph),
    lights: glowM('lights', E.lights, THREE.DoubleSide),
    ring: glowM('ring', E.ring),
  };
  // the ground is the floor's (the grating's y: the Pouring Floor's own)
  mats.floor.uniforms.uSkP.value.y = 0;
  const was = { M: { wall: M.wall, wallGlyph: M.wallGlyph, floor: M.floor, bands: M.bands, trim: M.trim, stone: M.stone, glyph: M.glyph, ornament: M.ornament }, P: rt.P };
  Object.assign(M, {
    wall: mats.wall, wallGlyph: mats.wallGlyph, floor: mats.floor, glyph: mats.glyph, trim: mats.trim,
    bands: CASTING.bands.map((b) => ({ ...b, mat: paint(b.color) })),
    stone: paint(CASTING.stone),
    // (the frieze's little moons: cracked moons, in a lit ivory ring)
    ornament: M.ornament ? { ...M.ornament, mats: { a: mats.moon, b: mats.ring } } : M.ornament,
  });
  // (the pieces' glows the makers' ivory: the plates' rings, the eyes', the doors')
  rt.P = { ...rt.P, glow: CASTING.ivory };
  K.plan = [];
  const meshes = [], braziers = [];
  const skin = {
    name: 'casting-house', mats, meshes, U, stats: null,
    /** A hooded cradle's body (pieces.js Brazier): a machined cup on a plinth; true, the skin drew it. */
    brazier(piece, s) { braziers.push(piece); return cradleBody(piece, s, mats); },
    /** After the layout: the rooms handed to the shader, the moons cracked, the iron warmed, the dressing placed. */
    dress() {
      const t0 = performance.now(), rooms = roomsOf(K.plan);
      const list = [...rooms.filter((r) => r.kind === 'round'), ...rooms.filter((r) => r.kind === 'hall'), ...rooms.filter((r) => r.kind === 'corridor')].slice(0, CASTING_ROOMS);
      list.forEach((r, i) => {
        U.rooms.value[i].set(r.x, r.z, r.kind === 'round' ? r.r : r.hx, r.kind === 'round' ? -1 : r.hz);
        U.roomsY.value[i].set(r.y0, r.y1, r.kind === 'round' && r.oculus > 0 ? r.r * r.oculus : 0, 0);
      });
      U.count.value = list.length;
      // the doors' slabs in their own frame
      for (const p of rt.pieces) (p.group ?? p.mesh ?? p.root)?.traverse?.((m) => { if (m.material === mats.wallGlyph) m.material = mats.wallGlyphObj; });
      // the paint: the ivory moons into the moon's shader (the great one larger, its chains and every moon's old seam
      // gone: the cracks are the shader's), the founders' iron warmed
      const ivory = new THREE.Color(rt.def.palette?.ornament?.color ?? '#efe6d2'), dark = new THREE.Color(rt.def.palette?.dark ?? '#2f2a2c');
      const ironFrom = new THREE.Color(CASTING.iron.from), ironTo = new THREE.Color(CASTING.iron.to);
      const colourOf = (g) => { const c = g.attributes.color; return c ? new THREE.Color(c.getX(0), c.getY(0), c.getZ(0)) : null; };
      const near = (a, b) => a && Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 0.01;
      const moons = [], A = CASTING.moonAt, big = V(A.x, A.y, A.z);
      let chains = 0, seams = 0, iron = 0;
      for (const [mat, geos] of [...K.batches]) {
        if (!mat.vertexColors || Object.values(mats).includes(mat)) continue;
        const keep = [];
        for (const g of geos) {
          const c = colourOf(g);
          if (near(c, ivory)) { moons.push(g); continue; }
          if (near(c, ironFrom)) {
            const { c: mid, s } = shapeOf(K, g);
            // (the great moon's chains up to the oculus: it hangs by nothing now)
            if (Math.abs(mid.y - 20.3) < 0.6 && Math.hypot(mid.x - big.x, mid.z - big.z) < 2.4 && s.y > 3.5) { chains++; continue; }
            const a = g.attributes.color;
            for (let i = 0; i < a.count; i++) a.setXYZ(i, ironTo.r, ironTo.g, ironTo.b);
            iron++;
          }
          keep.push(g);
        }
        if (keep.length) K.batches.set(mat, keep); else K.batches.delete(mat);
      }
      // (each moon's dark seam: a thin torus round a moon's middle)
      const mids = moons.map((g) => shapeOf(K, g)).map(({ c, s }) => ({ c, r: s.x / 2 }));
      for (const [mat, geos] of [...K.batches]) {
        if (!mat.vertexColors) continue;
        const keep = geos.filter((g) => {
          if (!near(colourOf(g), dark)) return true;
          const { c, s } = shapeOf(K, g);
          const seam = mids.some((m) => c.distanceTo(m.c) < 0.05 && Math.abs(Math.max(s.x, s.y, s.z) / 2 - m.r) < 0.12 * m.r + 0.06);
          if (seam) seams++;
          return !seam;
        });
        if (keep.length) K.batches.set(mat, keep); else K.batches.delete(mat);
      }
      const bigOne = mids.findIndex((m) => m.c.distanceTo(big) < 0.3);
      if (bigOne >= 0) {
        const g = moons[bigOne], to = K.frame.clone().multiply(new THREE.Matrix4().makeTranslation(big.x, big.y, big.z).scale(V(A.scale, A.scale, A.scale)).multiply(new THREE.Matrix4().makeTranslation(-big.x, -big.y, -big.z))).multiply(K.inv);
        g.applyMatrix4(to);
      }
      if (moons.length) K.batches.set(mats.moon, [...(K.batches.get(mats.moon) ?? []), ...moons.map(bare)]);
      const signs = countSigns(K, mats.glyph);
      const F0 = K.frame, I = new THREE.Matrix4();
      // the dressing: the doors' slab frames, the great moon's floating ring, the pilot flames' rings, in one draw; their
      // lights in another
      const fr = doorFrames(rt, rooms), solid = [...fr.solid], light = [...fr.light];
      const [r0, r1, rh, tilt] = A.ring;
      const tiltM = new THREE.Matrix4().makeRotationX(tilt).premultiply(new THREE.Matrix4().makeTranslation(big.x, big.y, big.z));
      if (bigOne >= 0) {
        solid.push(ringGeometry(r0, r1, rh, 96).applyMatrix4(tiltM));
        light.push(ringLine(r0, rh, 96).applyMatrix4(tiltM));
        // (the makers' mark on the ring's face toward the way in, as sheet-1's sign, sized to the ring's band)
        light.push(bare(glyphGeometry(0.42, 0.04)).translate(0, 0, -r1 - 0.025).applyMatrix4(tiltM));
      }
      const flames = rt.pieces.filter((p) => p.constructor.name === 'Flame');
      for (const f of flames) {
        const at = K.local(f.pos);
        for (const [a, b, h, y] of CASTING.flameRings) {
          const m = new THREE.Matrix4().makeTranslation(at.x, at.y + y, at.z);
          solid.push(ringGeometry(a, b, h, 40).applyMatrix4(m));
          light.push(ringLine(a, h, 40).applyMatrix4(m));
        }
      }
      if (solid.length) meshes.push(instanced('skin: machined frames and rings', mergeGeometries(solid), mats.trim, [I], F0));
      if (light.length) meshes.push(instanced('skin: their lights', mergeGeometries(light), mats.lights, [I], F0));
      for (const m of meshes) K.group.add(m);
      rt.pieces.push(new SkinCradles(braziers));
      skin.stats = { rooms: list.length, moons: moons.length, chains, seams, iron, signs, frames: fr.n, flames: flames.length, cradles: braziers.length, ms: Math.round(performance.now() - t0) };
    },
    /** After the kit's flush: the house's own materials back for its exterior; the lights out of the shadow passes. */
    done() {
      Object.assign(M, was.M); rt.P = was.P; K.plan = null;
      const lights = new Set([mats.glyph, mats.lights, mats.ring]);
      K.group.traverse((o) => { if (o.isMesh && lights.has(o.material)) { o.castShadow = false; o.userData.castShadow = false; } });
    },
  };
  return skin;
}
