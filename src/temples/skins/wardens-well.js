import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, sharedUniforms } from '../../materials.js';
import { paint } from '../kit.js';

// ---------------------------------------------------------------------------
// The Warden's Well in its futuristic skin (issue #342, docs/systems/temples.md "Futuristic skins"): the inside of the
// makers' tower redrawn after the author's picks (references/temples/future/wardens-well/sheet-1.jpg, sheet-2.jpg): a
// shaft of dark slate built of stacked rings of chamfered slabs, thin cyan circuits climbing it, cream stone ledges and
// courses, lens terminals in deep housings, great flat vanes turning on axles from the wall, a metal iris round the
// light at the top. Look only: the same rooms, doors, collision, pieces, positions, timings and logic (skins/index.js;
// tests/temple-skins.test.js).
//   1. surfaces: the wall, the makers' marked metal (doors, the climb's face, the irises' blades: wallGlyph) and the floor
//      swapped for the skin's: the surface shader with its albedo, its first pen lines and its glow replaced, as
//      landmark-materials.js stone() does. A round room's courses run round its middle without a seam (the rooms the kit
//      recorded, uSkR); the pieces' own (a riding disc, a door's slab, an iris's blades) take their pattern in their own
//      frame (uSkObj), so it moves with them.
//   2. the glow: the circuits, the ring bands, the floors' inlays, the doors' seams are emissive in cyan (bloom carries
//      them: post.js reads gHatch.a), breathing slowly up the shaft; the light panels, the vanes' rings, the glyphs too.
//   3. dressing, drawn only (InstancedMeshes: noCollide, keepBuried, dynamic, out of the shadow passes): lens terminals
//      in deep housings high on the walls (none in a room with an eye to strike), great flat vanes turning on axles out
//      of the tall drums' walls, a metal iris of blades and a glowing rim round each round room's oculus. Kept off every
//      doorway, piece and thing drawn on the walls by boxes.
// On Low, Handheld and the Deck (uWearLite) the shader leaves out the slabs' tones and chamfers and the circuits' jogs,
// and the vanes stand still.
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
/** Up to this many rooms are handed to the shader (the round ones first). */
export const WELL_ROOMS = 16;

/** The skin's colours (sRGB) and sizes (m). */
export const WELL = {
  cyan: '#6fe9f6',
  /** the slate: its slabs' two tones, the grooves; courses (m), slabs (m), a ring band every n courses */
  wall: { color: '#5b6585', a: '#535c7b', b: '#67729a', c: '#323a55', course: 2.3, slab: 3.6, ring: 3 },
  /** the makers' machined metal: doors, the climb's face, the irises' blades (panels m) */
  metal: { color: '#465170', a: '#3f4965', b: '#52608a', c: '#262d44', panel: 1.6 },
  /** the floors' plates (m): pale stone, its seams, the inlay */
  floor: { color: '#c9c1ad', a: '#bfb6a1', b: '#d4ccb9', c: '#8f8a80', plate: 2.6 },
  /** the bands across the walls (kit.js M.bands): the plinth, the frieze's course, cream ring courses */
  bands: [{ y: 0.4, h: 0.8, color: '#3a4360' }, { at: 0.72, h: 1.4, color: '#384160' }, { y: 6.2, h: 0.45, every: 8.4, color: '#ddd1b3' }],
  trim: '#e4d9bd', stone: '#6c7795', ledge: '#ddd1b3', capCream: '#e2d6b9',
  lens: { housing: '#495372', back: '#232a3f', lip: '#ddd1b3', ring: '#6fe9f6', dark: '#1f4652', dim: '#2b5d6a' },
  vane: { plate: '#3e4864', edge: '#d9cfb4', axle: '#8590ad' },
  iris: { blade: '#3b4561', edge: '#cfc6ad' },
};

// ------------------------------------------------------------------ the surfaces: the shader's patterns
// (declared before main(): the surface shader's hash, vnoise, uTime, uPixelRatio and uWearLite are in scope by then)
const SK_PARS = /* glsl */ `
  uniform vec3 uSkinO;
  uniform vec4 uSkR[${WELL_ROOMS}];
  uniform vec4 uSkY[${WELL_ROOMS}];
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
    for (int i = 0; i < ${WELL_ROOMS}; i++) {
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
    for (int i = 0; i < ${WELL_ROOMS}; i++) {
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
`;

/**
 * Each pattern replaces the surface's `vec3 albedo = uColor;` (its first pen lines: skInk; its glow: skGlow, added to
 * the surface's emit before the light). uSkP: the skin's sizes; uSkG: the glow's colour.
 *   slate: the walls. Courses (uSkP.x m) of slabs (about uSkP.y m, staggered, each its tone between uSkA and uSkB), the
 *     seams inked, each slab's top edge chamfered light and its foot dark; every uSkP.z courses a deeper ring groove
 *     (uSkC), lit cyan in most; thin cyan circuits climbing the wall, jogging sideways from one stretch to the next.
 *     Ceilings: rings of slabs round their room's middle, a cyan ring round the oculus. Tops: plates.
 *   metal: the makers' machined panels (uSkP.x m), seams inked, chamfered, a cyan seam down some of them.
 *   plates: the floors. Plates (uSkP.x m) in rings round a round room's middle, in a grid in a hall; a cyan inlay round
 *     each room 1.6 m in from its walls (and round a riding disc's rim).
 */
const BODIES = {
  slate: /* glsl */ `
    vec3 skP = uSkObj > 0.5 ? vObjPos : vWorldPos - uSkinO;
    float skPx = max(max(length(dFdx(skP)), length(dFdy(skP))), 1e-4);
    float skInk = 0.0, skGlow = 0.0;
    vec3 albedo = uColor;
    {
      bool lite = uWearLite > 0.5;
      float pulse = 0.78 + 0.22 * sin(uTime * 0.9 - skP.y * 0.11);
      if (abs(n.y) < 0.65) {
        vec2 A = uSkObj > 0.5 ? vec2(abs(n.x) > abs(n.z) ? skP.z : skP.x, 0.0) : skAlong(skP, n);
        float along = A.x;
        float CH = uSkP.x, ci = floor(skP.y / CH), cf = fract(skP.y / CH);
        // the slabs of this course: their width (a whole number of them round a round room), staggered
        float sw = uSkP.y * (0.8 + 0.45 * skH1(ci * 7.13 + 1.0));
        if (A.y > 0.5) sw = A.y / max(1.0, floor(A.y / sw + 0.5));
        float sx = along / sw + skH1(ci * 3.71);
        float si = floor(sx), sf = fract(sx);
        float dv = min(sf, 1.0 - sf) * sw, dh = min(cf, 1.0 - cf) * CH;
        float near = 1.0 - smoothstep(CH / 40.0, CH / 14.0, skPx);
        // each slab its tone; a chamfer along its top lit, along its foot in shade
        if (!lite) {
          float t = skH2(vec2(si, ci) + 0.37);
          albedo = mix(uColor, mix(uSkA, uSkB, t), 0.75 * near + 0.25);
          float ch = 0.07;
          albedo *= 1.0 + near * (0.16 * (1.0 - smoothstep(ch * 0.6, ch, (1.0 - cf) * CH)) - 0.14 * (1.0 - smoothstep(ch * 0.6, ch, cf * CH)));
          skInk = max(skInk, skInkL(abs((1.0 - cf) * CH - ch), skPx) * 0.3 * near);
        }
        skInk = max(skInk, max(skInkL(dv, skPx), skInkL(dh, skPx)) * 0.75 * near);
        // the ring groove at the foot of every uSkP.z-th course, lit cyan in most rings
        float ri = floor(ci / uSkP.z), ringHere = step(mod(ci, uSkP.z), 0.5);
        float gy = cf * CH;   // (m over this course's foot)
        if (ringHere > 0.5 && gy < 0.16) {
          albedo = uSkC;
          skInk = max(skInk, max(skInkL(gy, skPx), skInkL(abs(gy - 0.16), skPx)) * 0.8);
          if (skH1(ri * 5.3 + 2.0) > 0.3) skGlow = max(skGlow, skLit(abs(gy - 0.08), skPx, 0.022));
        }
        // the circuits: one in some 7 m columns of the wall, climbing in stretches of 9 m, jogging between them
        float CW = 7.0, cw = A.y > 0.5 ? A.y / max(1.0, floor(A.y / CW + 0.5)) : CW;
        float k = floor(along / cw), u = fract(along / cw);
        float SH = 9.0, sg = floor(skP.y / SH), sy = skP.y - sg * SH;
        float has = step(skH1(k * 13.37 + 4.0), 0.72);
        float on0 = has * step(0.28, skH1(k * 2.31 + sg * 7.7));
        float x0 = 0.2 + 0.6 * skH1(k * 5.17 + sg * 1.93);
        float c = skLit(abs(u - x0) * cw, skPx, 0.03) * on0;
        if (!lite) {
          // the jog at the foot of this stretch, from the last stretch's line to this one's
          float onP = has * step(0.28, skH1(k * 2.31 + (sg - 1.0) * 7.7)), xP = 0.2 + 0.6 * skH1(k * 5.17 + (sg - 1.0) * 1.93);
          float inJog = step(min(x0, xP), u) * step(u, max(x0, xP));
          c = max(c, skLit(sy, skPx, 0.03) * inJog * on0 * onP);
          // and a short spur off it to a terminal: a small lit square
          vec2 tq = vec2((u - x0) * cw - 0.45, sy - 4.5);
          c = max(c, on0 * step(0.6, skH1(k * 9.1 + sg * 3.3)) * (1.0 - smoothstep(0.0, skPx, max(abs(tq.x), abs(tq.y)) - 0.09)));
          c = max(c, on0 * step(0.6, skH1(k * 9.1 + sg * 3.3)) * skLit(abs(sy - 4.5), skPx, 0.022) * step(0.0, (u - x0) * cw) * step((u - x0) * cw, 0.45));
        }
        skGlow = max(skGlow, c);
      } else if (n.y < 0.0) {
        // a ceiling: rings of slabs round its room's middle, a cyan ring round the oculus
        vec4 R, Y;
        if (uSkObj < 0.5 && skRoomOf(skP, R, Y) && R.w < 0.0) {
          vec2 d = skP.xz - R.xy;
          float r = length(d), RS = uSkP.x, ri = floor(r / RS);
          float nseg = max(6.0, floor(6.2831853 * (ri + 0.5) * RS / uSkP.y + 0.5));
          float aq = (atan(d.y, d.x) + 3.14159265) / 6.2831853 * nseg + skH1(ri);
          float da = min(fract(aq), 1.0 - fract(aq)) / nseg * 6.2831853 * r;
          skInk = max(skInkL(skSeam(r, RS), skPx), skInkL(da, skPx)) * 0.7;
          if (!lite) albedo = mix(uSkA, uSkB, skH2(vec2(floor(aq), ri)));
          if (Y.z > 0.0) skGlow = skLit(abs(r - Y.z - 0.9), skPx, 0.05);
        } else {
          skInk = max(skInkL(skSeam(skP.x, uSkP.y), skPx), skInkL(skSeam(skP.z, uSkP.y), skPx)) * 0.6;
        }
      } else {
        skInk = max(skInkL(skSeam(skP.x, uSkP.x), skPx), skInkL(skSeam(skP.z, uSkP.x), skPx)) * 0.6;
      }
      skGlow *= pulse;
      albedo = mix(albedo, uSkG, skGlow);
      skInk *= 1.0 - skGlow;
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
      skInk = max(skInk, max(skInkL(dx, skPx), skInkL(dy, skPx)) * 0.8);
      // a cyan seam down some panels' joints
      float lit = step(0.62, skH1(floor(q.x + 0.5) * 3.9 + 1.7));
      skGlow = skLit(dx, skPx, 0.025) * lit * (0.8 + 0.2 * sin(uTime * 1.1 + skP.y * 0.3));
      albedo = mix(albedo, uSkG, skGlow);
      skInk *= 1.0 - skGlow;
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
          // rings of plates round the middle; a cyan inlay 1.6 m in from the wall (a disc's: at its rim)
          float r = length(d), RS = uSkObj > 0.5 ? 0.8 : S, ri = floor(r / RS);
          float nseg = max(4.0, floor(6.2831853 * (ri + 0.5) * RS / S + 0.5));
          float aq = (atan(d.y, d.x) + 3.14159265) / 6.2831853 * nseg + skH1(ri * 1.7);
          float da = min(fract(aq), 1.0 - fract(aq)) / nseg * 6.2831853 * r;
          skInk = max(skInkL(skSeam(r, RS), skPx), skInkL(da, skPx) * step(1.0, ri)) * 0.6 * near;
          t = skH2(vec2(floor(aq), ri));
          float rin = uSkObj > 0.5 ? R.z * 0.82 : R.z - 1.6;
          skGlow = skLit(abs(r - rin), skPx, 0.045);
        } else {
          // a grid of plates (from the room's middle); the inlay round the room 1.6 m in
          vec2 g = (d + (inRoom ? vec2(0.0) : vec2(0.5 * S))) / S, gi = floor(g), gf = fract(g);
          skInk = max(skInkL(min(gf.x, 1.0 - gf.x) * S, skPx), skInkL(min(gf.y, 1.0 - gf.y) * S, skPx)) * 0.6 * near;
          t = skH2(gi + 0.13);
          if (inRoom) {
            float e = max(abs(d.x) - R.z, abs(d.y) - R.w);
            skGlow = skLit(abs(e + 1.6), skPx, 0.045) * step(4.0, min(R.z, R.w));
          }
        }
        if (!lite) albedo = mix(uColor, mix(uSkA, uSkB, t), 0.7 * near + 0.2);
      } else if (n.y < -0.65) {
        // a floor's underside, the ceiling of the room under it: slate, in rings of slabs round the room's middle
        vec4 R = vec4(0.0), Y = vec4(0.0);
        albedo = SK_UNDER;
        if (uSkObj < 0.5 && skRoomOf(skP, R, Y) && R.w < 0.0) {
          vec2 d = skP.xz - R.xy;
          float r = length(d), RS = 2.3, ri = floor(r / RS);
          float nseg = max(6.0, floor(6.2831853 * (ri + 0.5) * RS / 3.2 + 0.5));
          float aq = (atan(d.y, d.x) + 3.14159265) / 6.2831853 * nseg + skH1(ri);
          float da = min(fract(aq), 1.0 - fract(aq)) / nseg * 6.2831853 * r;
          skInk = max(skInkL(skSeam(r, RS), skPx), skInkL(da, skPx)) * 0.7;
          if (!lite) albedo *= 0.92 + 0.16 * skH2(vec2(floor(aq), ri));
        } else skInk = max(skInkL(skSeam(skP.x, 3.0), skPx), skInkL(skSeam(skP.z, 3.0), skPx)) * 0.6;
      } else {
        // a slab's or a ledge's edge: a course line under its top
        float top = fract(skP.y / 0.8);
        skInk = skInkL(min(top, 1.0 - top) * 0.8, skPx) * 0.4 * near;
      }
      skGlow *= 0.82 + 0.18 * sin(uTime * 0.7 + length(skP.xz) * 0.15);
      albedo = mix(albedo, uSkG, skGlow);
      skInk *= 1.0 - skGlow;
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
  const u = new THREE.Color(WELL.wall.color), under = `#define SK_UNDER vec3(${u.r.toFixed(4)}, ${u.g.toFixed(4)}, ${u.b.toFixed(4)})\n`;
  const LIGHT = 'L = mix(L, 1.0, max(uGlow, emit));';
  if (at < 0 || !fs.includes('vec3 albedo = uColor;') || !fs.includes('float detail = 0.0;') || !fs.includes(LIGHT)) throw new Error('skins/wardens-well.js: the surface shader changed: no albedo, light or detail line to replace');
  m.fragmentShader = SK_PARS + under + fs.slice(0, at) + SK_GLSL + fs.slice(at)
    .replace('vec3 albedo = uColor;', BODIES[body])
    .replace(LIGHT, `emit = max(emit, skGlow); ${LIGHT}`)
    .replace('float detail = 0.0;', 'float detail = skInk;');
  Object.assign(m.uniforms, {
    uSkA: { value: new THREE.Color(pat.a ?? pat.color) }, uSkB: { value: new THREE.Color(pat.b ?? pat.color) }, uSkC: { value: new THREE.Color(pat.c ?? pat.color) },
    uSkG: { value: new THREE.Color(WELL.cyan) },
    uSkP: { value: new THREE.Vector4(...pat.size, 0) },
    uSkObj: { value: obj ? 1 : 0 },
  });
  return m;
}

// ------------------------------------------------------------------ the dressing's shapes (unit frames: x across, y up, z out of the wall)
/** Vertex colours over a geometry (non-indexed), all one colour. */
function tinted(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
/** A lens terminal's housing, 2.4 m square on the wall: a dark back, two cheeks, a sill and a deep cream overhang. */
function housingGeometry(L) {
  const B = (w, h, d, x, y, z, c) => tinted(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);
  return mergeGeometries([
    B(2.0, 2.0, 0.06, 0, 0, 0.05, L.back),
    B(0.3, 2.2, 0.62, -1.1, 0, 0.31, L.housing), B(0.3, 2.2, 0.62, 1.1, 0, 0.31, L.housing),
    B(2.5, 0.22, 0.72, 0, -1.15, 0.36, L.housing),
    B(2.9, 0.34, 1.05, 0, 1.25, 0.52, L.lip),
  ]);
}
/** A lens: concentric rings, lit and dark by turns (radius 1, facing +z). */
function lensGeometry(L) {
  const rings = [[0, 0.22, L.ring], [0.22, 0.34, L.dark], [0.34, 0.56, L.ring], [0.56, 0.64, L.dark], [0.64, 0.86, L.ring], [0.86, 1.0, L.dark]];
  return mergeGeometries(rings.map(([a, b, c]) => tinted(new THREE.RingGeometry(Math.max(a, 0.001), b, 24, 1), c)));
}
/** A great flat vane on its axle out of the wall: the axle along z from the wall, the plate on it (turned about z). */
function vaneGeometry(S) {
  const plate = tinted(new THREE.BoxGeometry(2.2, 0.14, 7).translate(0, 0, 5.1), S.plate);
  const edges = [-1.1, 1.1].map((x) => tinted(new THREE.BoxGeometry(0.09, 0.18, 7).translate(x, 0, 5.1), S.edge));
  const axle = tinted(new THREE.CylinderGeometry(0.15, 0.15, 8.8, 8).rotateX(Math.PI / 2).translate(0, 0, 4.4), S.axle);
  const collar = tinted(new THREE.CylinderGeometry(0.42, 0.5, 0.5, 10).rotateX(Math.PI / 2).translate(0, 0, 0.25), S.edge);
  const hub = tinted(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 8).rotateX(Math.PI / 2).translate(0, 0, 1.6), S.axle);
  return mergeGeometries([plate, ...edges, axle, collar, hub]);
}
/** One blade of an iris round an oculus of radius 1: a long flat wedge out from its rim, skewed round it. */
function bladeGeometry(S) {
  const s = new THREE.Shape();
  s.moveTo(1.0, -0.12); s.lineTo(1.75, 0.16); s.lineTo(1.72, 0.42); s.lineTo(1.0, 0.24); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: false }).rotateX(Math.PI / 2);   // (in the ceiling's plane: x, z)
  const edge = new THREE.Shape();
  edge.moveTo(1.0, 0.2); edge.lineTo(1.72, 0.38); edge.lineTo(1.72, 0.42); edge.lineTo(1.0, 0.24); edge.closePath();
  const e = new THREE.ExtrudeGeometry(edge, { depth: 0.045, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, -0.005, 0);
  return mergeGeometries([tinted(g, S.blade), tinted(e, S.edge)]);
}

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
/** Every small thing drawn on the walls, every floor and ledge, and every piece, as boxes in the kit's frame. */
function keepOuts(rt, surfaces) {
  const K = rt.kit, keep = new Keep(), b = new THREE.Box3();
  const local = (box) => box.clone().applyMatrix4(K.inv);
  for (const [mat, list] of K.batches) {
    for (const g of list) {
      g.computeBoundingBox();
      const l = local(g.boundingBox), s = l.getSize(V());
      // (a floor or a ledge: kept off in its own height; a floor's wide slab too)
      if (mat === rt.M.floor) { if (s.y < 1.6) keep.add(l.expandByScalar(0.4)); continue; }
      if (surfaces.has(mat)) continue;
      if (Math.max(s.x, s.z) < 10.5 && !(s.x > 6 && s.z > 6)) keep.add(l.expandByScalar(0.3));   // (not a wall's cap or a whole ring)
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
    if (e.kind === 'hall') out.push({ kind: 'hall', x: e.x, z: e.z, hx: e.w / 2, hz: e.d / 2, y0: e.y, y1: e.y + e.h, roof: e.roof, oculus: e.oculus, e });
    else if (e.kind === 'round') out.push({ kind: 'round', x: e.x, z: e.z, r: e.r, y0: e.y, y1: e.y + e.h, oculus: e.oculus, gaps: e.gaps ?? [], seg: e.seg, e });
    else if (e.kind === 'corridor') out.push({ kind: 'corridor', x: (e.x0 + e.x1) / 2, z: (e.z0 + e.z1) / 2, hx: (e.x1 - e.x0) / 2, hz: (e.z1 - e.z0) / 2, y0: e.y, y1: e.y + e.h, e });
  }
  return out;
}
/** The skin's hash: the same dressing every build. */
function rand(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
const angleOff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** Where a round room's wall stands at angle a (rotunda angles: 0 = +z, toward +x): its face, out, along. */
function roundAt(R, a, y, inset = 0) {
  const out = V(Math.sin(a), 0, Math.cos(a));
  // (on the stones' inner face: a stone is nearer the middle at its centre than at its joints)
  const face = R.r * Math.cos(Math.PI / (R.seg ?? 28)) - 0.02 - inset;
  return { p: V(R.x, y, R.z).addScaledVector(out, face), nrm: out.clone().negate(), t: V(-Math.cos(a), 0, Math.sin(a)) };   // (t × up = nrm: a right-handed frame)
}
/** Is a round room's wall clear at angle a and heights y0..y1 of its doorways (m of clearance round them)? */
const clearOfGaps = (R, a, y0, y1, m) => !R.gaps.some((g) => angleOff(a, g.a) * R.r < g.w / 2 + m && y1 > R.y0 + (g.y0 ?? 0) - m && y0 < R.y0 + (g.y0 ?? 0) + g.h + m);

/** The dressing: lens terminals, turning vanes, irises and rims round the oculi. */
function dress(rt, keep, rooms) {
  const rnd = rand(342), S = WELL, housings = [], lenses = [], vanes = [], blades = [], rims = [];
  const eyed = (R) => rt.pieces.some((p) => p.constructor.name === 'Switch' && p.group && inside(R, rt.kit.local(p.group.position)));
  const inside = (R, q) => q.y > R.y0 - 1 && q.y < R.y1 + 1 && (R.kind === 'round' ? Math.hypot(q.x - R.x, q.z - R.z) < R.r : Math.abs(q.x - R.x) < R.hx && Math.abs(q.z - R.z) < R.hz);
  const boxAt = (c, half) => new THREE.Box3(c.clone().sub(half), c.clone().add(half));
  /** A lens terminal at p on a face (t along, nrm into the room): its housing and its lens, lit or dim. */
  const lens = (p, t, nrm, lit) => {
    const c = p.clone().addScaledVector(nrm, 0.6), box = boxAt(c, V(2.2, 2.2, 2.2));
    if (keep.hits(box)) return false;
    keep.add(box);
    housings.push(basis(p, t, V(0, 1, 0), nrm));
    lenses.push({ m: basis(p.clone().addScaledVector(nrm, 0.1), t.clone().multiplyScalar(0.78), V(0, 0.78, 0), nrm.clone()), lit });
    return true;
  };
  for (const R of rooms) {
    if (R.kind === 'corridor' || R.y1 - R.y0 < 12) continue;
    // lens terminals high on the walls, hidden from the floor under their overhangs: two a room, one lit (none in a
    // room with an eye to strike: the eyes are the ones to read)
    let placed = eyed(R) ? 2 : 0;
    for (let k = 0; k < 60 && placed < 2; k++) {
      const y = R.y0 + 6.5 + rnd() * Math.min(8, R.y1 - R.y0 - 10);
      if (R.kind === 'round') {
        const a = rnd() * TAU;
        if (!clearOfGaps(R, a, y - 1.6, y + 1.6, 2.5)) continue;
        const f = roundAt(R, a, y);
        if (lens(f.p, f.t, f.nrm, placed === 0)) placed++;
      } else {
        // (on the long walls of a hall, never on a wall with a doorway's hole near: the plan's own walls say where)
        const side = Math.floor(rnd() * 4), u = (rnd() * 2 - 1) * 0.6;
        const nrm = [V(0, 0, 1), V(0, 0, -1), V(1, 0, 0), V(-1, 0, 0)][side];
        const p = side < 2 ? V(R.x + u * R.hx, y, R.z - nrm.z * (R.hz - 0.01)) : V(R.x - nrm.x * (R.hx - 0.01), y, R.z + u * R.hz);
        const t = V(0, 1, 0).cross(nrm).normalize();
        if (rt.kit.plan.some((e) => e.kind === 'wall' && e.holes.some((h) => {
          const d = V(e.a[0], 0, e.a[1]), dir = V(e.dir[0], 0, e.dir[1]), q = p.clone().setY(0).sub(d), s = q.dot(dir), off = Math.abs(q.dot(V(dir.z, 0, -dir.x)));
          return off < e.t + 1 && s > h.x0 - 3 && s < h.x1 + 3 && y > e.y0 + h.y0 - 3 && y < e.y0 + h.y1 + 3;
        }))) continue;
        if (lens(p, t, nrm, placed === 0)) placed++;
      }
    }
    if (R.kind !== 'round') continue;
    // the great flat vanes turning on their axles out of the tall drums' walls, between the rings, over the floors
    // (not in the Warden's Hall, the round room of the great vanes in its floor: the fight wants its air clear)
    const arena = rt.pieces.filter((p) => p.constructor.name === 'Vane' && p.o?.great && p.center && inside(R, rt.kit.local(p.center))).length >= 3;
    if (R.y1 - R.y0 >= 24 && R.r >= 15 && !arena) {
      const levels = Math.max(1, Math.floor((R.y1 - R.y0) / 17));
      for (let lv = 0; lv < levels; lv++) {
        let n = 0;
        for (let k = 0; k < 80 && n < 3; k++) {
          const a = ((n + rnd() * 0.6) / 3) * TAU + lv * 1.1, y = R.y0 + lv * 17 + 5.5 + rnd() * 9;
          if (y > R.y1 - 3 || !clearOfGaps(R, a, y - 3, y + 3, 4)) continue;
          const f = roundAt(R, a, y, -0.3);
          // (its plate sweeps 1.1 m about the axle, 1.6 to 8.6 m out of the wall: all of it kept clear)
          const c = f.p.clone().addScaledVector(f.nrm, 5.1), box = new THREE.Box3().setFromPoints([f.p.clone().addScaledVector(f.nrm, 0.5), f.p.clone().addScaledVector(f.nrm, 8.8)]).expandByVector(V(1.5, 1.5, 1.5));
          if (keep.hits(box) || vanes.some((v) => v.c.distanceTo(c) < 10)) continue;
          keep.add(box);
          vanes.push({ p: f.p, t: f.t, nrm: f.nrm, c, a0: rnd() * TAU, w: (0.12 + rnd() * 0.1) * (rnd() < 0.5 ? -1 : 1) });
          n++;
        }
      }
    }
    // an iris of metal blades round the oculus, under the ceiling, and a glowing rim at its lip
    if (R.oculus > 0) {
      const ro = R.r * R.oculus, yc = R.y1 - 0.08, nb = 16;
      for (let i = 0; i < nb; i++) {
        const a = (i / nb) * TAU;
        blades.push(new THREE.Matrix4().makeRotationY(a).scale(V(ro, 1, ro)).setPosition(V(R.x, yc, R.z)));
      }
      rims.push(new THREE.Matrix4().makeRotationX(Math.PI / 2).scale(V(ro + 0.05, ro + 0.05, 1)).setPosition(V(R.x, yc - 0.06, R.z)));
    }
  }
  return { housings, lenses, vanes, blades, rims };
}

/** The great vanes turning slowly (on the lighter presets they stand still), and the finest dressing's switch. */
class SkinMotion {
  constructor(mesh, vanes, frame) {
    this.mesh = mesh; this.vanes = vanes; this.frame = frame; this.t = 0;
    this._m = new THREE.Matrix4(); this._r = new THREE.Matrix4();
  }
  update(dt) {
    if (!this.mesh || sharedUniforms.uWearLite.value > 0.5) return;
    this.t += Math.min(dt, 0.1);
    this.vanes.forEach((v, i) => {
      this._m.multiplyMatrices(this.frame, basis(v.p, v.t, V(0, 1, 0), v.nrm)).multiply(this._r.makeRotationZ(v.a0 + this.t * v.w));
      this.mesh.setMatrixAt(i, this._m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ the house's skin
/**
 * The Warden's Well's futuristic skin (skins/index.js: a house's `def.skin`), called before def.layout(rt): rt.M's
 * surfaces, bands, trim, glyph and light panels swapped for the skin's, rt.P's glow cyan, the kit's plan recording.
 */
export function wardensWellSkin(rt) {
  const K = rt.kit, M = rt.M, id = rt.def.id, look = rt.def.palette?.look?.all ?? {};
  const U = {
    origin: { value: K.origin.clone() },
    rooms: { value: Array.from({ length: WELL_ROOMS }, () => new THREE.Vector4()) },
    roomsY: { value: Array.from({ length: WELL_ROOMS }, () => new THREE.Vector4()) },
    count: { value: 0 },
  };
  const W = WELL.wall, Mt = WELL.metal, F = WELL.floor;
  const glowM = (k, color, glow = 0.85) => makeMaterial({ color, glow, flat: true, key: `temple.skin.${id}.${k}` });
  const mats = {
    wall: skinMaterial('slate', look, { ...W, size: [W.course, W.slab, W.ring] }, U, `${id}.wall`),
    wallGlyph: skinMaterial('metal', { ...look, glyphs: 1.6 }, { ...Mt, size: [Mt.panel, 0, 0] }, U, `${id}.wallGlyph`),
    floor: skinMaterial('plates', look, { ...F, size: [F.plate, 0, 0] }, U, `${id}.floor`),
    // (the pieces' own: a riding disc, a door's slab, an iris's blades take their pattern in their own frame)
    floorObj: skinMaterial('plates', look, { ...F, size: [F.plate, 0, 0] }, U, `${id}.floorObj`, true),
    wallGlyphObj: skinMaterial('metal', { ...look, glyphs: 1.6 }, { ...Mt, size: [Mt.panel, 0, 0] }, U, `${id}.wallGlyphObj`, true),
    glyph: glowM('glyph', WELL.cyan, 0.85),
    panel: glowM('panel', '#8ff0fa', 0.8),
    ring: glowM('ring', WELL.cyan, 0.7),
    housing: makeMaterial({ ...look, color: '#ffffff', vertexColors: true, flat: true, key: `temple.skin.${id}.housing` }),
    lens: makeMaterial({ color: '#ffffff', vertexColors: true, glow: 0.9, flat: true, side: THREE.DoubleSide, key: `temple.skin.${id}.lens` }),
    vane: makeMaterial({ ...look, color: '#ffffff', vertexColors: true, flat: true, side: THREE.DoubleSide, key: `temple.skin.${id}.vane` }),
    blade: makeMaterial({ ...look, color: '#ffffff', vertexColors: true, flat: true, side: THREE.DoubleSide, key: `temple.skin.${id}.blade` }),
    rim: glowM('rim', WELL.cyan, 0.85),
  };
  for (const k of ['housing', 'vane', 'blade', 'lens']) mats[k].vertexColors = true;
  const was = { M: { wall: M.wall, wallGlyph: M.wallGlyph, floor: M.floor, bands: M.bands, trim: M.trim, stone: M.stone, glyph: M.glyph, ornament: M.ornament }, P: rt.P };
  Object.assign(M, {
    wall: mats.wall, wallGlyph: mats.wallGlyph, floor: mats.floor, glyph: mats.glyph,
    bands: WELL.bands.map((b) => ({ ...b, mat: paint(b.color) })),
    trim: paint(WELL.trim), stone: paint(WELL.stone),
    // (the frieze's slit windows lit cyan: light panels)
    ornament: M.ornament ? { ...M.ornament, mats: { a: mats.panel, b: mats.panel } } : M.ornament,
  });
  // (the pieces' glows the makers' cyan: the vanes' rings, the irises' rims, the riding discs')
  rt.P = { ...rt.P, glow: WELL.cyan };
  K.plan = [];
  const meshes = [];
  const skin = {
    name: 'wardens-well', mats, meshes, stats: null,
    /** incal.js's own paints and lights in the skin: the bands round the drums, the caps, the vanes' rings, the light panels, the friezes' marks. */
    paints: { band: paint('#3a4360'), cap: paint(WELL.capCream), ring: mats.ring, slit: mats.panel, mark: mats.glyph, flatArc: true },
    /** After the layout: the rooms handed to the shader, the pieces' surfaces in their own frame, the dressing placed. */
    dress() {
      const t0 = performance.now(), rooms = roomsOf(K.plan);
      const list = [...rooms.filter((r) => r.kind === 'round'), ...rooms.filter((r) => r.kind === 'hall'), ...rooms.filter((r) => r.kind === 'corridor')].slice(0, WELL_ROOMS);
      list.forEach((r, i) => {
        U.rooms.value[i].set(r.x, r.z, r.kind === 'round' ? r.r : r.hx, r.kind === 'round' ? -1 : r.hz);
        U.roomsY.value[i].set(r.y0, r.y1, r.kind === 'round' && r.oculus > 0 ? r.r * r.oculus : 0, 0);
      });
      U.count.value = list.length;
      for (const p of rt.pieces) {
        const o = p.group ?? p.mesh ?? p.root;
        o?.traverse?.((m) => { if (m.material === mats.floor) m.material = mats.floorObj; else if (m.material === mats.wallGlyph) m.material = mats.wallGlyphObj; });
      }
      const keep = keepOuts(rt, new Set([mats.wall, mats.wallGlyph, M.sand]));
      const d = dress(rt, keep, rooms);
      const F0 = K.frame;
      meshes.push(instanced('skin: lens housings', housingGeometry(WELL.lens), mats.housing, d.housings, F0));
      const lm = instanced('skin: lenses', lensGeometry(WELL.lens), mats.lens, d.lenses, F0);
      d.lenses.forEach((l, i) => lm.setColorAt(i, new THREE.Color(l.lit ? '#ffffff' : WELL.lens.dim)));
      if (lm.instanceColor) lm.instanceColor.needsUpdate = true;
      meshes.push(lm);
      const vm = instanced('skin: turning vanes', vaneGeometry(WELL.vane), mats.vane, d.vanes.map((v) => basis(v.p, v.t, V(0, 1, 0), v.nrm).multiply(new THREE.Matrix4().makeRotationZ(v.a0))), F0);
      // (they turn: their bounds the whole sweep)
      vm.boundingSphere = null; vm.computeBoundingSphere(); if (vm.boundingSphere) vm.boundingSphere.radius += 3;
      meshes.push(vm);
      meshes.push(instanced('skin: iris blades', bladeGeometry(WELL.iris), mats.blade, d.blades, F0));
      meshes.push(instanced('skin: oculus rims', new THREE.TorusGeometry(1, 0.025, 4, 48).toNonIndexed(), mats.rim, d.rims, F0));
      for (const m of meshes) K.group.add(m);
      rt.pieces.push(new SkinMotion(vm, d.vanes, F0));
      skin.stats = { lenses: d.lenses.length, lit: d.lenses.filter((l) => l.lit).length, vanes: d.vanes.length, blades: d.blades.length, rims: d.rims.length, rooms: list.length, ms: Math.round(performance.now() - t0) };
    },
    /** After the kit's flush: the house's own materials back for its exterior. */
    done() { Object.assign(M, was.M); rt.P = was.P; K.plan = null; },
  };
  return skin;
}
