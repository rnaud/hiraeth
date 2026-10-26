import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, sharedUniforms } from '../../materials.js';
import { paint } from '../kit.js';
import { skinShader, spliceSkin } from './skin-shader.js';
import { MK_GLSL } from './machined.js';

// ---------------------------------------------------------------------------
// The Footprint in its futuristic skin (issue #342, docs/systems/temples.md "Futuristic skins"): the inside of the
// walker's heel redrawn after the author's pick (references/temples/future/footprint/sheet-1.jpg): a white sphere of
// smooth cream panels, round and octagonal plates set in them, ringed walkways round every tall room with thin pale
// blue-white lines along their edges, round lens terminals of teal glass, thin rings floating under the oculi, lavender
// in the shade. Kept light and pale as its pick (the house was white plaster), never dark slate. Look only: the same
// rooms, doors, collision, pieces, positions, timings and logic (skins/index.js; tests/temple-skins.test.js).
//   1. surfaces: the wall, the makers' machined metal (doors: wallGlyph) and the floor swapped for the skin's: the surface
//      shader with its albedo, its first pen lines and its glow replaced, as landmark-materials.js stone() does. The
//      walls: tall cream panels, few joints, a chamfer along each, a round or an octagonal plate in some, a lit line
//      along their foot. A round room's panels run round it without a seam (the rooms the kit recorded, uFpR). The
//      floors: cream plates in rings round a round room's middle, in a grid in a hall, a pale line inlaid 1.6 m in from
//      the walls and along every ledge's lip over a pit; the ceilings: rings of plates, a lit ring round each oculus.
//      The pieces' own surfaces (a door's slab, a stepping stone) take their pattern in their own frame (uFpObj).
//   2. the glow: every line is emissive in pale blue-white, breathing slowly, just over the post pass's halo start
//      (0.62: FOOT.emit), so the lines stay crisp, not blurred; the glyphs a deeper blue, so they read on the cream.
//   3. dressing, drawn only (InstancedMeshes: noCollide, keepBuried, dynamic, out of the shadow passes): the ringed
//      walkways round the walls over the doors (each with a lit line along its lip), lens terminals of teal glass in
//      round cream housings (none in a room with an eye to strike: the eyes are the ones to read), thin rings floating
//      under the oculi, turning slowly. Kept off every doorway, piece, column and glyph.
// On Low, Handheld and the Deck (uWearLite) the shader leaves out the panels' tones, chamfers and plates, and the
// floating rings are not drawn.
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
/** Up to this many rooms are handed to the shader (the round ones first). */
export const FOOT_ROOMS = 16;

/** The skin's colours (sRGB, sampled from the pick: lit cream #e7d7c7, lavender shade #a8a0ac) and sizes (m). */
export const FOOT = {
  /** the lines' light: pale blue-white */
  line: '#b4e5f9',
  /** the walls: cream panels, their two tones (close), the grooves' shade; course (m: tall), panel (m: wide) */
  wall: { color: '#faf4e2', a: '#f7f0de', b: '#fcf8e8', c: '#d6c8c4', course: 4.5, panel: 4.6 },
  /** the makers' machined metal: doors (panels m) */
  metal: { color: '#e9e3e3', a: '#e4dddf', b: '#efe9e8', c: '#bdb6c0', panel: 1.5 },
  /** the floors' plates (m) */
  floor: { color: '#f3ede0', a: '#efe8db', b: '#f7f1e6', c: '#cdbfba', plate: 3.0 },
  /** the bands across the walls (kit.js M.bands): the frieze's course a shade deeper than the panels */
  bands: [{ at: 0.72, h: 0.6, color: '#e9dbcd' }],
  trim: '#f2e7da', stone: '#efe5dc', dark: '#8f8aab', fitting: '#dcd5d4', under: '#ece0d4',
  /** the glyphs: a deeper blue than the lines, to read on the cream */
  glyph: '#82c9ec',
  /** the walkways round the walls (m): how deep, how thick; their top, their lip's face, their underside */
  walk: { deep: 3.0, thick: 0.6, top: '#f4e8db', face: '#e6d8cb', under: '#d9ccc6' },
  lens: { housing: '#efe4d7', rim: '#dccfc1', back: '#b8b0bd', glass: '#8fd8cc', ring: '#b4e5f9', core: '#effffb' },
  /** how bright the skin's lights are (makeMaterial glow; post.js haloes over 0.62: just over it keeps a halo tight) */
  emit: { lines: 0.76, strip: 0.74, glyph: 0.72, ring: 0.7, lens: 0.75, plate: 0.1 },
};

// ------------------------------------------------------------------ the surfaces: the shader's patterns
// (declared before main(): the surface shader's hash, uTime, uPixelRatio and uWearLite are in scope by then)
const FP_PARS = /* glsl */ `
  uniform vec3 uFpO;
  uniform vec4 uFpR[${FOOT_ROOMS}];
  uniform vec4 uFpY[${FOOT_ROOMS}];
  uniform int uFpN;
  uniform vec3 uFpA;
  uniform vec3 uFpB;
  uniform vec3 uFpC;
  uniform vec3 uFpG;
  uniform vec4 uFpP;
  uniform float uFpObj;
`;
const FP_GLSL = /* glsl */ `
  float fpH1(float x) { return fract(sin(x * 91.3458) * 47453.5453); }
  float fpH2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // a pen line d metres from its middle, px metres a pixel
  float fpInk(float d, float px) { float w = 0.5 * uPixelRatio * px; return 1.0 - smoothstep(w, w + px * 1.1, d); }
  // a thin lit line (half width hw m, never under ~0.6 px), its coverage
  float fpLit(float d, float px, float hw) { float w = max(hw, 0.6 * px); return 1.0 - smoothstep(w, w + px, d); }
  // along a wall: (m round a round room the kit recorded, its circumference), else (by the face's axis, 0)
  vec2 fpAlong(vec3 p, vec3 nn) {
    for (int i = 0; i < ${FOOT_ROOMS}; i++) {
      if (i >= uFpN) break;
      vec4 R = uFpR[i];
      if (R.w >= 0.0) continue;
      vec2 d = p.xz - R.xy;
      float r = length(d);
      if (abs(r - R.z) < 1.9 && p.y > uFpY[i].x - 1.0 && p.y < uFpY[i].y + 1.5 && abs(dot(nn.xz, d)) > 0.8 * r * length(nn.xz))
        return vec2((atan(d.y, d.x) + 3.14159265) * R.z, 6.2831853 * R.z);
    }
    return vec2(abs(nn.x) > abs(nn.z) ? p.z : p.x, 0.0);
  }
  // the room over or under p: its rect or circle (x, z, half x or r, half z or -1), its floor, ceiling and oculus (Y)
  bool fpRoomOf(vec3 p, out vec4 R, out vec4 Y) {
    for (int i = 0; i < ${FOOT_ROOMS}; i++) {
      if (i >= uFpN) break;
      R = uFpR[i]; Y = uFpY[i];
      if (p.y < Y.x - 0.8 || p.y > Y.y + 2.0) continue;
      vec2 d = p.xz - R.xy;
      if (R.w < 0.0 ? length(d) < R.z + 1.6 : (abs(d.x) < R.z + 1.4 && abs(d.y) < R.w + 1.4)) return true;
    }
    return false;
  }
  float fpSeam(float q, float s) { float f = fract(q / s); return min(f, 1.0 - f) * s; }
  // rings of plates round (0, 0) at d: the seams' distance (m), the plate's cell
  vec3 fpRings(vec2 d, float RS, float S) {
    float r = length(d), ri = floor(r / RS);
    float nseg = max(6.0, floor(6.2831853 * (ri + 0.5) * RS / S + 0.5));
    float aq = (atan(d.y, d.x) + 3.14159265) / 6.2831853 * nseg + fpH1(ri * 1.7);
    float da = min(fract(aq), 1.0 - fract(aq)) / nseg * 6.2831853 * r;
    return vec3(min(fpSeam(r, RS), ri < 1.0 ? 1e3 : da), floor(aq), ri);
  }
`;

/**
 * Each pattern replaces the surface's `vec3 albedo = uColor;` (its first pen lines: fpInkV; its glow: fpGlow, added to
 * the surface's emit before the light). uFpP: the skin's sizes; uFpG: the lines' colour.
 */
const BODIES = {
  // the walls: courses (uFpP.x m) of tall panels (about uFpP.y m; a whole number round a round room), their seams inked
  // fine, a chamfer along each; a round or an octagonal plate set in some; a lit line along the foot. Ceilings: rings of
  // plates round their room's middle, a lit ring round the oculus (a lit frame round a hall's). Tops: plates.
  plaster: /* glsl */ `
    vec3 fpP = uFpObj > 0.5 ? vObjPos : vWorldPos - uFpO;
    float fpPx = max(max(length(dFdx(fpP)), length(dFdy(fpP))), 1e-4);
    float fpInkV = 0.0, fpGlow = 0.0;
    vec3 albedo = uColor;
    {
      bool lite = uWearLite > 0.5;
      if (abs(n.y) < 0.65) {
        vec2 A = uFpObj > 0.5 ? vec2(abs(n.x) > abs(n.z) ? fpP.z : fpP.x, 0.0) : fpAlong(fpP, n);
        float CH = uFpP.x, ci = floor(fpP.y / CH), cf = fract(fpP.y / CH);
        float sw = uFpP.y;
        if (A.y > 0.5) sw = A.y / max(1.0, floor(A.y / sw + 0.5));
        float sx = A.x / sw, si = floor(sx), sf = fract(sx);
        float dv = min(sf, 1.0 - sf) * sw, dh = min(cf, 1.0 - cf) * CH;
        float near = 1.0 - smoothstep(CH / 50.0, CH / 16.0, fpPx);
        if (!lite) {
          albedo = mix(uColor, mix(uFpA, uFpB, fpH2(vec2(si, ci) + 0.37)), 0.7 * near + 0.3);
          // (a chamfer round each panel: lit along its top and its left, in shade along its foot and its right)
          float ch = 0.12;
          float top = 1.0 - smoothstep(ch * 0.5, ch, (1.0 - cf) * CH), foot = 1.0 - smoothstep(ch * 0.5, ch, cf * CH);
          float lft = 1.0 - smoothstep(ch * 0.5, ch, sf * sw), rgt = 1.0 - smoothstep(ch * 0.5, ch, (1.0 - sf) * sw);
          albedo *= 1.0 + near * (0.05 * max(top, lft) - 0.07 * max(foot, rgt));
          fpInkV = max(fpInkV, max(fpInkL(abs(cf * CH - ch), fpPx), fpInkL(abs(sf * sw - ch), fpPx)) * 0.16 * near);
          // the makers' finish (machined.js) on the panel, as the floors' plates (issue #691)
          fpInkV = max(fpInkV, mkFinish(vec2((sf - 0.5) * sw, (cf - 0.5) * CH), vec2(0.5 * sw, 0.5 * CH), si * 13.1 + ci * 7.7, fpPx, false, albedo));
          // a plate set in some panels (never in the lowest course): a round one, two rings; or an octagon round a ring
          float h = fpH2(vec2(si * 1.31, ci * 2.77) + 5.1);
          if (ci >= 1.0 && h < 0.34) {
            vec2 c = vec2((sf - 0.5) * sw, (cf - 0.5) * CH);
            float rr = min(sw, CH) * 0.3;
            if (h < 0.17) {
              float r = length(c);
              fpInkV = max(fpInkV, max(fpInkL(abs(r - rr), fpPx) * 0.6, fpInkL(abs(r - rr * 0.72), fpPx) * 0.4) * near);
              if (r < rr) albedo *= 0.965;
            } else {
              vec2 q = abs(c);
              float oct = max(max(q.x, q.y), (q.x + q.y) * 0.7071), r = length(c);
              fpInkV = max(fpInkV, max(fpInkL(abs(oct - rr * 1.05), fpPx) * 0.6, fpInkL(abs(r - rr * 0.45), fpPx) * 0.4) * near);
              if (oct < rr * 1.05) albedo *= 0.965;
            }
          }
        }
        fpInkV = max(fpInkV, max(fpInkL(dv, fpPx) * 0.5, fpInkL(dh, fpPx) * 0.55) * near);
        // the lit line along the walls' foot (the floors at 0: the ledges, the halls; in a pit, along its lip's height)
        fpGlow = max(fpGlow, fpLit(abs(fpP.y - 0.32), fpPx, 0.025));
        if (fpP.y > 0.18 && fpP.y < 0.46) fpInkV = max(fpInkV, max(fpInkL(abs(fpP.y - 0.2), fpPx), fpInkL(abs(fpP.y - 0.44), fpPx)) * 0.5);
      } else if (n.y < 0.0) {
        vec4 R, Y;
        if (uFpObj < 0.5 && fpRoomOf(fpP, R, Y)) {
          vec2 d = fpP.xz - R.xy;
          if (R.w < 0.0) {
            vec3 g = fpRings(d, uFpP.w, uFpP.y);
            fpInkV = fpInk(g.x, fpPx) * 0.55;
            if (!lite) albedo = mix(uFpA, uFpB, fpH2(g.yz));
            if (Y.z > 0.0) fpGlow = fpLit(abs(length(d) - Y.z - 0.9), fpPx, 0.05);
          } else {
            fpInkV = max(fpInk(fpSeam(d.x, uFpP.y * 0.75), fpPx), fpInk(fpSeam(d.y, uFpP.y * 0.75), fpPx)) * 0.5;
            if (Y.z > 0.0) fpGlow = fpLit(abs(max(abs(d.x) - Y.z, abs(d.y) - Y.w) - 0.8), fpPx, 0.05);
          }
        } else fpInkV = max(fpInk(fpSeam(fpP.x, uFpP.y), fpPx), fpInk(fpSeam(fpP.z, uFpP.y), fpPx)) * 0.5;
      } else {
        fpInkV = max(fpInk(fpSeam(fpP.x, uFpP.y * 0.5), fpPx), fpInk(fpSeam(fpP.z, uFpP.y * 0.5), fpPx)) * 0.4;
      }
      fpGlow *= 0.82 + 0.18 * sin(uTime * 0.8 - fpP.y * 0.12);
      albedo = mix(albedo, uFpG, fpGlow);
      fpInkV *= 1.0 - fpGlow;
      fpGlow *= FP_LINES;
    }
  `,
  // the makers' machined panels (uFpP.x m), seams inked, chamfered, a lit seam down some of them
  metal: /* glsl */ `
    vec3 fpP = uFpObj > 0.5 ? vObjPos : vWorldPos - uFpO;
    float fpPx = max(max(length(dFdx(fpP)), length(dFdy(fpP))), 1e-4);
    float fpInkV = 0.0, fpGlow = 0.0;
    vec3 albedo = uColor;
    {
      vec3 an = abs(n);
      vec2 uv = an.y > an.x && an.y > an.z ? fpP.xz : (an.x > an.z ? fpP.zy : fpP.xy);
      float S = uFpP.x;
      vec2 q = uv / S, ci = floor(q), cf = fract(q);
      float near = 1.0 - smoothstep(S / 40.0, S / 14.0, fpPx);
      float dx = min(cf.x, 1.0 - cf.x) * S, dy = min(cf.y, 1.0 - cf.y) * S;
      if (uWearLite < 0.5) {
        albedo = mix(uColor, mix(uFpA, uFpB, fpH2(ci + 0.71)), 0.6 * near);
        float ch = 0.06;
        albedo *= 1.0 + near * (0.06 * (1.0 - smoothstep(ch * 0.6, ch, (1.0 - cf.y) * S)) - 0.08 * (1.0 - smoothstep(ch * 0.6, ch, cf.y * S)));
        fpInkV = max(fpInkV, max(fpInkL(abs((1.0 - cf.y) * S - ch), fpPx), fpInkL(abs(cf.x * S - ch), fpPx)) * 0.2 * near);
      }
      fpInkV = max(fpInkV, max(fpInkL(dx, fpPx), fpInkL(dy, fpPx)) * 0.6);
      float lit = step(0.6, fpH1(floor(q.x + 0.5) * 3.9 + 1.7));
      fpGlow = fpLit(dx, fpPx, 0.022) * lit * (0.82 + 0.18 * sin(uTime * 1.1 + fpP.y * 0.3));
      albedo = mix(albedo, uFpG, fpGlow);
      fpInkV *= 1.0 - fpGlow;
      fpGlow *= FP_LINES;
    }
  `,
  // the floors: plates (uFpP.x m) in rings round a round room's middle, in a grid in a hall; a pale line inlaid 1.6 m in
  // from the walls; along a ledge's lip (its face just under the floors at 0), a lit line
  plates: /* glsl */ `
    vec3 fpP = uFpObj > 0.5 ? vObjPos : vWorldPos - uFpO;
    float fpPx = max(max(length(dFdx(fpP)), length(dFdy(fpP))), 1e-4);
    float fpInkV = 0.0, fpGlow = 0.0;
    vec3 albedo = uColor;
    {
      bool lite = uWearLite > 0.5;
      float S = uFpP.x, near = 1.0 - smoothstep(S / 40.0, S / 14.0, fpPx);
      if (n.y > 0.65) {
        vec4 R = vec4(0.0, 0.0, 1.6, -1.0), Y = vec4(0.0);
        bool inRoom = uFpObj > 0.5 ? true : fpRoomOf(fpP, R, Y);
        vec2 d = fpP.xz - R.xy;
        float t = 0.5;
        vec3 mkA = vec3(1.0);
        if (inRoom && R.w < 0.0) {
          vec3 g = fpRings(d, uFpObj > 0.5 ? 0.8 : S, S);
          fpInkV = fpInkL(g.x, fpPx) * 0.5 * near;
          t = fpH2(g.yz);
          if (uFpObj < 0.5) fpGlow = fpLit(abs(length(d) - R.z + 1.6), fpPx, 0.04);
        } else {
          vec2 gq = (d + (inRoom ? vec2(0.0) : vec2(0.5 * S))) / S, gi = floor(gq), gf = fract(gq);
          fpInkV = max(fpInkL(min(gf.x, 1.0 - gf.x) * S, fpPx), fpInkL(min(gf.y, 1.0 - gf.y) * S, fpPx)) * 0.5 * near;
          t = fpH2(gi + 0.13);
          // the makers' finish (machined.js) on the plate
          fpInkV = max(fpInkV, mkFinish((gf - 0.5) * S, vec2(0.5 * S), gi.x * 17.0 + gi.y * 5.0, fpPx, true, mkA));
          if (inRoom && uFpObj < 0.5) {
            float e = max(abs(d.x) - R.z, abs(d.y) - R.w);
            fpGlow = fpLit(abs(e + 1.6), fpPx, 0.04) * step(4.0, min(R.z, R.w));
          }
        }
        if (!lite) albedo = mix(uColor, mix(uFpA, uFpB, t), 0.7 * near + 0.2);
        albedo *= mkA;
      } else if (n.y < -0.65) {
        // a floor's underside (a ledge's, a corridor's roof seen from under): plates, cream
        albedo = FP_UNDER;
        fpInkV = max(fpInkL(fpSeam(fpP.x, S), fpPx), fpInkL(fpSeam(fpP.z, S), fpPx)) * 0.45;
      } else {
        // a slab's or a ledge's edge: a course line under its top; along a lip at the floors' height, a lit line
        float top = fract(fpP.y / 0.8);
        fpInkV = fpInkL(min(top, 1.0 - top) * 0.8, fpPx) * 0.35 * near;
        if (uFpObj < 0.5) fpGlow = fpLit(abs(fpP.y + 0.14), fpPx, 0.03);
      }
      fpGlow *= 0.82 + 0.18 * sin(uTime * 0.7 + length(fpP.xz) * 0.15);
      albedo = mix(albedo, uFpG, fpGlow);
      fpInkV *= 1.0 - fpGlow;
      fpGlow *= FP_LINES;
    }
  `,
};

/** The pattern, as data the web's shader and the Unity port's are both made from (skin-shader.js). */
const SHADER = skinShader('footprint', { pars: FP_PARS, defines: (() => { const u = new THREE.Color(FOOT.under); return `#define FP_UNDER vec3(${u.r.toFixed(4)}, ${u.g.toFixed(4)}, ${u.b.toFixed(4)})\n#define FP_LINES ${FOOT.emit.lines.toFixed(3)}\n#define fpInkL fpInk\n`; })(), glsl: FP_GLSL + MK_GLSL, bodies: BODIES, ink: 'fpInkV', emit: 'fpGlow', emitAt: 'light' });

/** The surface material of a skin's pattern: makeMaterial's own, its albedo, first pen lines and glow the pattern's. */
function skinMaterial(body, look, pat, U, key, obj = false) {
  const m = makeMaterial({ flat: true, ...look, color: pat.color, key: `temple.skin.${key}` });
  // (the house's rooms and origin, this build's: a material from the cache is pointed at them again)
  Object.assign(m.uniforms, { uFpO: U.origin, uFpR: U.rooms, uFpY: U.roomsY, uFpN: U.count });
  if (m.userData.houseSkin) return m;
  m.userData.houseSkin = body;
  spliceSkin(m, SHADER, body, 'footprint.js');
  Object.assign(m.uniforms, {
    uFpA: { value: new THREE.Color(pat.a ?? pat.color) }, uFpB: { value: new THREE.Color(pat.b ?? pat.color) }, uFpC: { value: new THREE.Color(pat.c ?? pat.color) },
    uFpG: { value: new THREE.Color(FOOT.line) },
    uFpP: { value: new THREE.Vector4(...[...pat.size, 0, 0, 0, 0].slice(0, 4)) },
    uFpObj: { value: obj ? 1 : 0 },
  });
  return m;
}

// ------------------------------------------------------------------ the dressing's shapes
/** Vertex colours over a geometry (non-indexed), all one colour; only its position and normal kept. */
function tinted(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
/** Only the position kept (a glowing piece's geometry, one colour: its material's). */
function bare(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  return g;
}
/** A lathed ring (rotunda angles: 0 = +z, toward +x) through a profile [[r, y], …] from angle a0, `len` round. */
const latheArc = (prof, a0, len, n) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), n, a0, len);

/**
 * A walkway round a round room, as the drawing's: a ring of plate from the wall (r + 0.3, inside the stones) to r - deep,
 * its lip's face, its underside; a lit line along its lip; caps at its ends, where a doorway or a piece breaks it.
 */
function ringWalk(geos, strips, R, y, a0, len) {
  const W = FOOT.walk, r0 = R.r + 0.3, r1 = R.r - W.deep, y0 = y - W.thick, full = len >= TAU - 1e-6;
  const n = Math.max(4, Math.ceil(len / TAU * R.seg * 3)), arc = (prof) => latheArc(prof, a0, len, n).translate(R.x, 0, R.z);
  geos.push(tinted(arc([[r1, y], [r0, y]]), W.top));
  geos.push(tinted(arc([[r0, y0], [r1, y0]]), W.under));
  geos.push(tinted(arc([[r1, y0], [r1, y]]), W.face));
  // (the lit line along the lip: a thin band a little proud of its face)
  strips.push(bare(arc([[r1 - 0.02, y - W.thick * 0.62], [r1 - 0.02, y - W.thick * 0.38]])));
  if (full) return;
  // (a cap at each end: a quad in the plane through the room's axis; the material draws both its faces)
  for (const a of [a0, a0 + len]) {
    const s = Math.sin(a), c = Math.cos(a), P = (r, yy) => [R.x + s * r, yy, R.z + c * r];
    const q = [P(r1, y0), P(r0, y0), P(r0, y), P(r1, y)];
    const cap = new THREE.BufferGeometry();
    cap.setAttribute('position', new THREE.Float32BufferAttribute([...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]], 3));
    cap.computeVertexNormals();
    geos.push(tinted(cap, W.face));
  }
}
/** A walkway along a straight wall: from a to b (local x, z on the wall's face line), `nrm` into the room. */
function wallWalk(geos, strips, a, b, nrm, y) {
  const W = FOOT.walk, L = Math.hypot(b.x - a.x, b.z - a.z), dir = V(b.x - a.x, 0, b.z - a.z).normalize();
  // (from 0.3 m inside the wall to `deep` out of it; its frame: x along, y up, z into the room)
  const m = new THREE.Matrix4().makeBasis(dir, V(0, 1, 0), nrm).setPosition(V((a.x + b.x) / 2, 0, (a.z + b.z) / 2));
  const d = W.deep + 0.3, zc = W.deep - d / 2;
  const top = new THREE.BoxGeometry(L, W.thick, d).translate(0, y - W.thick / 2, zc);
  // (its faces coloured by side: the top, the lip, the underside)
  const g = top.toNonIndexed(), P = g.attributes.position, N = g.attributes.normal, C = new Float32Array(P.count * 3);
  const cTop = new THREE.Color(W.top), cFace = new THREE.Color(W.face), cUnder = new THREE.Color(W.under);
  for (let i = 0; i < P.count; i++) { const ny = N.getY(i), c = ny > 0.5 ? cTop : ny < -0.5 ? cUnder : cFace; C.set([c.r, c.g, c.b], i * 3); }
  g.deleteAttribute('uv'); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  geos.push(g.applyMatrix4(m));
  strips.push(bare(new THREE.BoxGeometry(L - 0.04, W.thick * 0.24, 0.03).translate(0, y - W.thick * 0.45, W.deep + 0.015).applyMatrix4(m)));
}
/** A lens terminal: a round cream housing standing out of the wall (radius 1, facing +z), a dark back ring. */
function housingGeometry(L) {
  return mergeGeometries([
    tinted(new THREE.CylinderGeometry(1.0, 1.08, 0.26, 28).rotateX(Math.PI / 2).translate(0, 0, 0.13), L.housing),
    tinted(new THREE.TorusGeometry(0.86, 0.09, 5, 28).translate(0, 0, 0.27), L.rim),
    tinted(new THREE.CircleGeometry(0.76, 28).translate(0, 0, 0.265), L.back),
  ]);
}
/** Its lens: teal glass, a pale ring round it, a bright core (radius 1, facing +z, in front of its housing). */
function lensGeometry(L) {
  const rings = [[0, 0.16, L.core], [0.16, 0.56, L.glass], [0.56, 0.64, L.ring]];
  return mergeGeometries(rings.map(([a, b, c]) => tinted(new THREE.RingGeometry(Math.max(a, 0.001), b, 28, 1).translate(0, 0, 0.29), c)));
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
  /**
   * Does b meet a box kept off? (skipTall, for the walkways: not the columns from floor to ceiling, which pierce them as
   * a gallery's, nor the doors, whose doorways the walls' holes and the round rooms' gaps keep clear: a break over a
   * hidden door would show where it is)
   */
  hits(b, skipTall = false) {
    for (const key of this.keys(b)) for (const o of this.cells.get(key) ?? []) if (!(skipTall && (o.tall || o.door)) && o.intersectsBox(b)) return true;
    return false;
  }
}
/** Every small thing drawn on the walls (glyphs, columns), every floor and ledge, and every piece, as boxes in the kit's frame. */
function keepOuts(rt, surfaces) {
  const K = rt.kit, keep = new Keep(), b = new THREE.Box3();
  const local = (box) => box.clone().applyMatrix4(K.inv);
  for (const [mat, list] of K.batches) {
    if (surfaces.has(mat)) continue;
    for (const g of list) {
      g.computeBoundingBox();
      const l = local(g.boundingBox), s = l.getSize(V());
      if (mat === rt.M.floor) { if (s.y < 1.6) keep.add(l.expandByScalar(0.4)); continue; }
      if (Math.max(s.x, s.z) < 10.5 && !(s.x > 6 && s.z > 6)) keep.add(Object.assign(l.expandByScalar(0.3), { tall: s.y > 8 }));   // (not a wall's cap or a whole ring)
    }
  }
  for (const p of rt.pieces) {
    const o = p.group ?? p.mesh ?? p.root;
    if (o?.isObject3D) { b.setFromObject(o); const l = local(b), s = l.getSize(V()); if (!l.isEmpty() && Math.max(s.x, s.z) < 14 && s.y < 30) keep.add(Object.assign(l.expandByScalar(0.8), { door: p.constructor.name === 'Door' })); }
    for (const q of [p.pos, p.center]) if (q?.isVector3) keep.add(new THREE.Box3().setFromCenterAndSize(K.local(q), V(3, 3, 3)));
  }
  return keep;
}
/** The kit's rooms (local): halls, round rooms and passages, with their floors, ceilings and oculi. */
function roomsOf(plan) {
  const out = [];
  for (const e of plan) {
    if (e.kind === 'hall') out.push({ kind: 'hall', x: e.x, z: e.z, hx: e.w / 2, hz: e.d / 2, y0: e.y, y1: e.y + e.h, roof: e.roof, oculus: e.roof === 'oculus' ? e.oculus : 0, e });
    else if (e.kind === 'round') out.push({ kind: 'round', x: e.x, z: e.z, r: e.r, y0: e.y, y1: e.y + e.h, oculus: e.oculus, gaps: e.gaps ?? [], seg: e.seg, e });
    else if (e.kind === 'corridor') out.push({ kind: 'corridor', x: (e.x0 + e.x1) / 2, z: (e.z0 + e.z1) / 2, hx: (e.x1 - e.x0) / 2, hz: (e.z1 - e.z0) / 2, y0: e.y, y1: e.y + e.h, e });
  }
  return out;
}
/** The skin's hash: the same dressing every build. */
function rand(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
const angleOff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** Where a round room's wall stands at angle a (rotunda angles): its face, out, along. */
function roundAt(R, a, y) {
  const out = V(Math.sin(a), 0, Math.cos(a));
  const face = R.r * Math.cos(Math.PI / (R.seg ?? 28)) - 0.02;
  return { p: V(R.x, y, R.z).addScaledVector(out, face), nrm: out.clone().negate(), t: V(-Math.cos(a), 0, Math.sin(a)) };
}
const clearOfGaps = (R, a, y0, y1, m) => !R.gaps.some((g) => angleOff(a, g.a) * R.r < g.w / 2 + m && y1 > R.y0 + (g.y0 ?? 0) - m && y0 < R.y0 + (g.y0 ?? 0) + g.h + m);

/**
 * The heights of a room's walkways (m, local): over the doorways (10.4 m) and over the frieze (its glyphs at 0.72 of a
 * hall's height, 0.7 of a round room's), never within 1.5 m of the frieze nor 2.5 m of the ceiling.
 */
export function walkLevels(R) {
  const h = R.y1 - R.y0, frieze = R.y0 + h * (R.kind === 'round' ? 0.7 : 0.72);
  return [10.4, frieze + 1.8].filter((y) => Math.abs(y - frieze) >= 1.5 && y <= R.y1 - 2.5 && y >= 10.2);
}

/** The dressing: walkways, lens terminals, floating rings. */
function dress(rt, keep, rooms) {
  const rnd = rand(3420), walk = [], strips = [], housings = [], lenses = [], rings = [];
  const inside = (R, q) => q.y > R.y0 - 1 && q.y < R.y1 + 1 && (R.kind === 'round' ? Math.hypot(q.x - R.x, q.z - R.z) < R.r : Math.abs(q.x - R.x) < R.hx && Math.abs(q.z - R.z) < R.hz);
  const eyed = (R) => rt.pieces.some((p) => p.constructor.name === 'Switch' && p.group && inside(R, rt.kit.local(p.group.position)));
  const boxAt = (c, half) => new THREE.Box3(c.clone().sub(half), c.clone().add(half));
  const W = FOOT.walk;
  let walks = 0;
  for (const R of rooms) {
    if (R.kind === 'corridor') continue;
    // the walkways: round the walls, broken where a piece, a column or a glyph stands in their way
    for (const y of walkLevels(R)) {
      const half = V(0.9, W.thick / 2 + 0.05, 0.9);
      if (R.kind === 'round') {
        const n = R.seg * 2, step = TAU / n, free = [];
        for (let i = 0; i < n; i++) {
          const a = (i + 0.5) * step, out = V(Math.sin(a), 0, Math.cos(a));
          const c = V(R.x, y - W.thick / 2, R.z).addScaledVector(out, R.r - W.deep / 2);
          free.push(clearOfGaps(R, a, y - W.thick, y, 0.6) && !keep.hits(boxAt(c, half), true));
        }
        if (free.every(Boolean)) { ringWalk(walk, strips, R, y, 0, TAU); walks++; continue; }
        // (the runs between the breaks, from the first break round)
        const s0 = free.indexOf(false);
        let run = 0;
        for (let k = 1; k <= n; k++) {
          const i = (s0 + k) % n;
          if (free[i] && k < n) { run++; continue; }
          if (run >= 3) { ringWalk(walk, strips, R, y, ((i - run) * step + TAU) % TAU, run * step); walks++; }
          run = 0;
        }
      } else {
        // (the north and south walls' the whole width, the east and west walls' between them, never overlapping)
        const x0 = R.x - R.hx, x1 = R.x + R.hx, z0 = R.z - R.hz, z1 = R.z + R.hz, D = W.deep + 0.02;
        const sides = [
          { a: V(x0, 0, z0), b: V(x1, 0, z0), nrm: V(0, 0, 1) }, { a: V(x1, 0, z1), b: V(x0, 0, z1), nrm: V(0, 0, -1) },
          { a: V(x1, 0, z0 + D), b: V(x1, 0, z1 - D), nrm: V(-1, 0, 0) }, { a: V(x0, 0, z1 - D), b: V(x0, 0, z0 + D), nrm: V(1, 0, 0) },
        ];
        for (const S of sides) {
          const L = S.a.distanceTo(S.b), n = Math.max(1, Math.round(L / 1.6)), dir = S.b.clone().sub(S.a).divideScalar(L), cell = L / n;
          const holed = (u) => rt.kit.plan.some((e) => e.kind === 'wall' && e.holes.some((h) => {
            const p = S.a.clone().addScaledVector(dir, u), q = p.clone().sub(V(e.a[0], 0, e.a[1])), wd = V(e.dir[0], 0, e.dir[1]), s = q.dot(wd);
            return Math.abs(q.dot(V(wd.z, 0, -wd.x))) < e.t + 1 && s > h.x0 - 0.6 && s < h.x1 + 0.6 && y > e.y0 + h.y0 - 0.6 && y - W.thick < e.y0 + h.y1 + 0.6;
          }));
          let from = -1;
          for (let k = 0; k <= n; k++) {
            const u = (k + 0.5) * cell, c = S.a.clone().addScaledVector(dir, u).addScaledVector(S.nrm, W.deep / 2).setY(y - W.thick / 2);
            const ok = k < n && !holed(u) && !keep.hits(boxAt(c, half), true);
            if (ok && from < 0) from = k;
            if (!ok && from >= 0) {
              if (k - from >= 2) { wallWalk(walk, strips, S.a.clone().addScaledVector(dir, from * cell), S.a.clone().addScaledVector(dir, k * cell), S.nrm, y); walks++; }
              from = -1;
            }
          }
        }
      }
    }
    if (R.y1 - R.y0 < 14) continue;
    // lens terminals on the walls under the walkways: two a room (none in a room with an eye to strike)
    let placed = eyed(R) ? 2 : 0;
    const lens = (p, t, nrm) => {
      const c = p.clone().addScaledVector(nrm, 0.4), box = boxAt(c, V(1.6, 1.6, 1.0));
      if (keep.hits(box)) return false;
      keep.add(box.clone().expandByScalar(3));
      housings.push(basis(p, t, V(0, 1, 0), nrm));
      lenses.push(basis(p, t, V(0, 1, 0), nrm));
      return true;
    };
    for (let k = 0; k < 80 && placed < 2; k++) {
      const y = Math.max(R.y0, 0) + 5.4 + rnd() * 1.4;
      if (R.kind === 'round') {
        const a = rnd() * TAU;
        if (!clearOfGaps(R, a, y - 1.4, y + 1.4, 2.0)) continue;
        const f = roundAt(R, a, y);
        if (lens(f.p, f.t, f.nrm)) placed++;
      } else {
        const side = Math.floor(rnd() * 4), u = (rnd() * 2 - 1) * 0.6;
        const nrm = [V(0, 0, 1), V(0, 0, -1), V(1, 0, 0), V(-1, 0, 0)][side];
        const p = side < 2 ? V(R.x + u * R.hx, y, R.z - nrm.z * (R.hz - 0.01)) : V(R.x - nrm.x * (R.hx - 0.01), y, R.z + u * R.hz);
        const t = V(0, 1, 0).cross(nrm).normalize();
        if (rt.kit.plan.some((e) => e.kind === 'wall' && e.holes.some((h) => {
          const d = V(e.a[0], 0, e.a[1]), dir = V(e.dir[0], 0, e.dir[1]), q = p.clone().setY(0).sub(d), s = q.dot(dir), off = Math.abs(q.dot(V(dir.z, 0, -dir.x)));
          return off < e.t + 1 && s > h.x0 - 2.5 && s < h.x1 + 2.5 && y > e.y0 + h.y0 - 2.5 && y < e.y0 + h.y1 + 2.5;
        }))) continue;
        if (lens(p, t, nrm)) placed++;
      }
    }
    // thin rings floating under the oculus (a tilted one inside it in a round room without a guardian)
    if (R.oculus > 0) {
      const ro = R.kind === 'round' ? R.r * R.oculus : Math.min(R.hx, R.hz) * R.oculus, yc = R.y1 - 2.4;
      rings.push({ p: V(R.x, yc, R.z), r: ro + 1.3, tilt: 0, w: 0.05 });
      if (R.kind === 'round' && R.y1 - R.y0 < 20) rings.push({ p: V(R.x, yc - 1.8, R.z), r: ro * 0.75, tilt: 0.42, w: 0.09 });
    }
  }
  return { walk, strips, housings, lenses, rings, walks };
}

/** The floating rings turning slowly; on the lighter presets not drawn. */
class SkinMotion {
  constructor(mesh, rings, frame) {
    this.mesh = mesh; this.rings = rings; this.frame = frame; this.t = 0;
    this._m = new THREE.Matrix4(); this._r = new THREE.Matrix4();
  }
  /** A ring's matrix in the kit's frame at time t: a unit torus in the x-z plane scaled to its radius, tilted, turned about the vertical. */
  static local(g, t) {
    return new THREE.Matrix4().makeTranslation(g.p.x, g.p.y, g.p.z).multiply(new THREE.Matrix4().makeRotationY(t * g.w))
      .multiply(new THREE.Matrix4().makeRotationX(g.tilt)).multiply(new THREE.Matrix4().makeScale(g.r, g.r, g.r));
  }
  update(dt) {
    if (!this.mesh) return;
    const lite = sharedUniforms.uWearLite.value > 0.5;
    this.mesh.visible = !lite;
    if (lite) return;
    this.t += Math.min(dt, 0.1);
    this.rings.forEach((g, i) => this.mesh.setMatrixAt(i, this._m.multiplyMatrices(this.frame, SkinMotion.local(g, this.t))));
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ the house's skin
/**
 * The Footprint's futuristic skin (skins/index.js: a house's `def.skin`), called before def.layout(rt): rt.M's
 * surfaces, bands, trim, fittings and glyph swapped for the skin's (its portholes left out: lens terminals instead),
 * rt.P's glow pale blue-white, the kit's plan recording.
 */
export function footprintSkin(rt) {
  const K = rt.kit, M = rt.M, id = rt.def.id, look = rt.def.palette?.look?.all ?? {};
  const U = {
    origin: { value: K.origin.clone() },
    rooms: { value: Array.from({ length: FOOT_ROOMS }, () => new THREE.Vector4()) },
    roomsY: { value: Array.from({ length: FOOT_ROOMS }, () => new THREE.Vector4()) },
    count: { value: 0 },
  };
  const Wl = FOOT.wall, Mt = FOOT.metal, F = FOOT.floor;
  const glowM = (k, color, glow, o = {}) => makeMaterial({ color, glow, flat: true, ...o, key: `temple.skin.${id}.${k}` });
  // (the game's hatching sparse on the skin's surfaces, as the drawing's: only in the deepest shade)
  const wallLook = { ...look, hatch: 0.15 }, floorLook = { ...look, hatch: 0.4 };
  const mats = {
    wall: skinMaterial('plaster', wallLook, { ...Wl, size: [Wl.course, Wl.panel, 0, 3.0] }, U, `${id}.wall`),
    wallGlyph: skinMaterial('metal', { ...wallLook, glyphs: 1.6 }, { ...Mt, size: [Mt.panel, 0, 0] }, U, `${id}.wallGlyph`),
    wallGlyphObj: skinMaterial('metal', { ...wallLook, glyphs: 1.6 }, { ...Mt, size: [Mt.panel, 0, 0] }, U, `${id}.wallGlyphObj`, true),
    floor: skinMaterial('plates', floorLook, { ...F, size: [F.plate, 0, 0] }, U, `${id}.floor`),
    floorObj: skinMaterial('plates', floorLook, { ...F, size: [F.plate, 0, 0] }, U, `${id}.floorObj`, true),
    glyph: glowM('glyph', FOOT.glyph, FOOT.emit.glyph),
    trimMat: makeMaterial({ ...look, color: FOOT.fitting, flat: true, hatch: 0.3, key: `temple.skin.${id}.fitting` }),
    walk: makeMaterial({ ...look, color: '#ffffff', vertexColors: true, flat: true, hatch: 0.2, side: THREE.DoubleSide, key: `temple.skin.${id}.walk` }),
    strip: glowM('strip', FOOT.line, FOOT.emit.strip, { side: THREE.DoubleSide }),
    housing: makeMaterial({ ...look, color: '#ffffff', vertexColors: true, flat: true, hatch: 0.2, key: `temple.skin.${id}.housing` }),
    lens: glowM('lens', '#ffffff', FOOT.emit.lens, { vertexColors: true }),
    ring: glowM('ring', FOOT.line, FOOT.emit.ring, { side: THREE.DoubleSide }),
  };
  for (const k of ['walk', 'housing', 'lens']) mats[k].vertexColors = true;
  const was = { M: { wall: M.wall, wallGlyph: M.wallGlyph, floor: M.floor, bands: M.bands, trim: M.trim, trimMat: M.trimMat, stone: M.stone, dark: M.dark, glyph: M.glyph, ornament: M.ornament }, P: rt.P };
  Object.assign(M, {
    wall: mats.wall, wallGlyph: mats.wallGlyph, floor: mats.floor, glyph: mats.glyph, trimMat: mats.trimMat,
    bands: FOOT.bands.map((b) => ({ ...b, mat: paint(b.color) })),
    // (the columns, lips and the chest's mound in cream, hatched only in the deepest shade)
    trim: makeMaterial({ ...look, color: FOOT.trim, flat: true, hatch: 0.25, key: `temple.skin.${id}.trim` }),
    stone: paint(FOOT.stone), dark: paint(FOOT.dark),
    // (no portholes under the friezes: the skin's lens terminals stand on the walls instead)
    ornament: null,
  });
  // (the pieces' glows pale blue-white: the plates' discs, the doors' medallions, the stones only the lens shows)
  rt.P = { ...rt.P, glow: FOOT.line };
  K.plan = [];
  const meshes = [];
  const skin = {
    name: 'footprint', mats, meshes, stats: null,
    /** After the layout: the rooms handed to the shader, the pieces' surfaces in their own frame, the dressing placed. */
    dress() {
      const t0 = performance.now(), rooms = roomsOf(K.plan);
      const list = [...rooms.filter((r) => r.kind === 'round'), ...rooms.filter((r) => r.kind === 'hall'), ...rooms.filter((r) => r.kind === 'corridor')].slice(0, FOOT_ROOMS);
      list.forEach((r, i) => {
        U.rooms.value[i].set(r.x, r.z, r.kind === 'round' ? r.r : r.hx, r.kind === 'round' ? -1 : r.hz);
        const oc = r.oculus > 0 ? r.oculus : 0;
        U.roomsY.value[i].set(r.y0, r.y1, r.kind === 'round' ? r.r * oc : (r.hx ?? 0) * oc, r.kind === 'round' ? 0 : (r.hz ?? 0) * oc);
      });
      U.count.value = list.length;
      for (const p of rt.pieces) {
        const o = p.group ?? p.mesh ?? p.root;
        // (a hidden door is plain wall until the lens shows it: its slab the walls' own panels)
        const plain = p.constructor.name === 'Door' && p.o?.hidden;
        o?.traverse?.((m) => {
          if (m.material === mats.floor) m.material = mats.floorObj;
          else if (m.material === mats.wallGlyph) m.material = plain ? mats.wall : mats.wallGlyphObj;
        });
      }
      const keep = keepOuts(rt, new Set([mats.wall, mats.wallGlyph, M.sand]));
      const d = dress(rt, keep, rooms);
      const F0 = K.frame, I = [new THREE.Matrix4()];
      if (d.walk.length) {
        meshes.push(instanced('skin: walkways', mergeGeometries(d.walk), mats.walk, I, F0));
        meshes.push(instanced('skin: walkways’ lines', mergeGeometries(d.strips), mats.strip, I, F0));
      }
      meshes.push(instanced('skin: lens housings', housingGeometry(FOOT.lens), mats.housing, d.housings, F0));
      meshes.push(instanced('skin: lenses', lensGeometry(FOOT.lens), mats.lens, d.lenses, F0));
      // (a unit torus, its tube 6 cm at the rings' radii: thin lines of light)
      const rm = instanced('skin: floating rings', bare(new THREE.TorusGeometry(1, 0.014, 4, 96).rotateX(Math.PI / 2)), mats.ring, d.rings.map((g) => SkinMotion.local(g, 0)), F0);
      // (they turn: their bounds round the whole sweep)
      rm.boundingSphere = null; rm.computeBoundingSphere(); if (rm.boundingSphere) rm.boundingSphere.radius += 2;
      meshes.push(rm);
      const motion = new SkinMotion(rm, d.rings, F0);
      for (const m of meshes) K.group.add(m);
      rt.pieces.push(motion);
      skin.stats = { walks: d.walks, lenses: d.lenses.length, rings: d.rings.length, rooms: list.length, ms: Math.round(performance.now() - t0) };
    },
    /** After the kit's flush: the house's own materials back for its exterior; the lights kept out of the shadow passes. */
    done() {
      Object.assign(M, was.M); rt.P = was.P; K.plan = null;
      const lights = new Set([mats.glyph, mats.strip, mats.lens, mats.ring]);
      K.group.traverse((o) => { if (o.isMesh && lights.has(o.material)) { o.castShadow = false; o.userData.castShadow = false; } });
    },
  };
  return skin;
}
