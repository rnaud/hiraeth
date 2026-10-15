import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, sharedUniforms } from '../../materials.js';
import { paint } from '../kit.js';

// ---------------------------------------------------------------------------
// The Engine-House in its futuristic skin (issue #342, docs/systems/temples.md "Futuristic skins"): the makers' engine
// under the dunes drawn as the author's picks have it (references/temples/future/engine-house/sheet-1.jpg, sheet-2.jpg),
// a quiet machine hall of navy slate and dark metal lit by thin amber circuits and the glow of its pits, over its rooms
// as they are: the same rooms, doors, collision, pieces, positions, timings and logic (tests/temple-skins.test.js).
//   1. surfaces (the surface shader's albedo, first pen lines and glow replaced, as landmark-materials.js stone() does):
//      the walls tall navy slate slabs (few joints, each column's set off its own way) with chamfered edges, a lit lip
//      and a shaded one, the hatching kept sparse; thin amber circuits rising from the floor, turning on chamfered
//      corners to a small lens, a foot line along some stretches; down in the pits the slabs warm to amber toward the
//      embers, a lit line down every column. The floors plates, amber lines along their seams with 45° jogs, a border
//      line round each hall and each round room, an amber edge under every landing's lip. The machine slabs (the gantry,
//      the doors' leaves) darker metal, their circuits denser; the doors' a lit seam up their middle. The lines are
//      emissive just over the post pass's halo start (crisp, not blurred) and a slow pulse travels along them.
//   2. the house's own: its pipes and frames dark blue steel, its straps gone, its valves lens terminals (a thin lit ring
//      on the slate) beside the friezes, the friezes' glyphs the shared makers' mark (the open corner beside a
//      shorter upright) lit pale amber, the pits' embers amber light, the drop
//      hammers dark metal (rt.P.wall2), the balls polished dark steel, the Tooth-Warden rust-red plates on navy
//      (skin.warden), the rooms' light cool, the daylight teal (skin.light).
//   3. machined dressing, drawn only (InstancedMeshes: noCollide, out of the shadow passes): in each big hall a square of
//      four round lens terminals on a dark plate, two lit; tall slate pilaster slabs along the halls' and the round
//      rooms' walls, an amber line up each and a lens at its head. Placed from the kit's record of its walls and rooms
//      (TempleKit.plan), kept clear of every doorway, piece and thing drawn on the walls.
// On the Low, Handheld and Steam Deck presets (uWearLite) the shader leaves out the chamfers, the panels' tones, the
// floors' second set of lines and the foot lines, and the pilasters' lenses are hidden.
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
/** Rooms handed to the shader (round ones first); the pits (the embers' boxes). */
export const ENGINE_ROOMS = 24;
export const ENGINE_PITS = 2;
/** m: the dressing's blocks stand this far down into the floor (no face of theirs in the floor's plane) */
const SINK = 0.05;

/** The skin's colours (sRGB) and sizes (m), after the picks' pixels (navy slate, L ≈ 40-60 of 255; amber lines). */
export const ENGINE_SKIN = {
  wall: { color: '#37455a', dark: '#252e3b', light: '#5b6c84', seam: '#1c232e', cell: [2.4, 6.4], density: 0.62 },
  machine: { color: '#323c4b', dark: '#1e252f', light: '#4f5c70', seam: '#161b23', cell: [1.8, 3.2], density: 0.9 },
  floor: { color: '#434e5d', dark: '#2b333e', light: '#5d6a7b', seam: '#20262f', cell: [2.4, 1.6] },
  amber: '#ffb244', amberPale: '#ffd486',
  /** what glows (the post pass's halo starts at 0.62: just over it, a crisp light) */
  emit: { line: 0.72, pulse: 0.08, heat: 0.5 },
  trim: '#29323e', dark: '#1a2029', stone: '#4b596b', brass: '#b08848', ball: '#3c4651', slab: '#36435a',
  ember: '#ffa53c',
  /** the rooms' light (index.js reads it for the house): a cool shade, a pale light, the sun teal through the oculi */
  light: { shadow: '#7d8aa2', light: '#eef0ea', sun: '#d6efe9' },
  /** the Tooth-Warden (guardians.js sentinelModel's colours): rust-red plates on navy, an amber eye */
  warden: { hull: '#743324', hull2: '#55241a', dark: '#26303c', brass: '#c79a4c', eye: '#ffb244' },
  /** the drop hammers' heads (pieces.js Hammer reads rt.P.wall2): dark metal */
  hammer: '#2c3644',
  /** the dressing: a square of lens terminals in each hall this tall; pilasters every m along the walls */
  lenses: { minH: 14, y: 4.6, r: 0.62, gap: 1.7 },
  pilasters: { every: 7.2, n: 6, w: 1.5, d: 0.42, h: 0.62, minH: 14 },
};

// ------------------------------------------------------------------ the shader
const PARS = /* glsl */ `
  uniform vec3 uSkinO;
  uniform vec2 uSkRot;
  uniform vec4 uSkR[${ENGINE_ROOMS}];
  uniform vec4 uSkY[${ENGINE_ROOMS}];
  uniform int uSkN;
  uniform vec4 uSkPitA[${ENGINE_PITS}];
  uniform vec4 uSkPitB[${ENGINE_PITS}];
  uniform int uSkPitN;
  uniform vec4 uSkLips;
  uniform vec3 uSkA;
  uniform vec3 uSkDark;
  uniform vec3 uSkLight;
  uniform vec3 uSkSeam;
  uniform vec2 uSkCell;
  uniform float uSkK;
  uniform float uSkObj;
`;
const E = ENGINE_SKIN.emit;
const GLSL = /* glsl */ `
  float ehH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float ehSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0); return length(pa - ba * h); }
  // a line d m from its middle, w m half wide, antialiased by fw (never under about a pixel: thinner broke into dashes)
  float ehLine(float d, float fw, float w) { w = max(w, fw * 0.6); return 1.0 - smoothstep(w, w + max(fw, 1e-5) * 1.3, d); }
  // gone once its spacing is under a few pixels
  float ehNear(float fw, float every) { return 1.0 - smoothstep(0.12, 0.3, fw / every); }
  // the kit's local frame, from the world
  vec3 ehLocal(vec3 w) { vec3 d = w - uSkinO; return vec3(d.x * uSkRot.x - d.z * uSkRot.y, d.y, d.x * uSkRot.y + d.z * uSkRot.x); }
  vec3 ehLocalN(vec3 n) { return vec3(n.x * uSkRot.x - n.z * uSkRot.y, n.y, n.x * uSkRot.y + n.z * uSkRot.x); }
  // the room a wall face belongs to: along it (m round a round room), its floor's height (y), 1 if found (z)
  vec3 ehWall(vec3 p, vec3 nn) {
    for (int i = 0; i < ${ENGINE_ROOMS}; i++) {
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
  int ehFloor(vec3 p) {
    for (int i = 0; i < ${ENGINE_ROOMS}; i++) {
      if (i >= uSkN) break;
      vec4 R = uSkR[i], Y = uSkY[i];
      if (abs(p.y - Y.x) > 0.6) continue;
      vec2 d = p.xz - R.xy;
      if (R.w < 0.0 ? length(d) < R.z + 0.2 : (abs(d.x) < R.z + 0.2 && abs(d.y) < R.w + 0.2)) return i;
    }
    return -1;
  }
  // how near a pit's embers p is (0 far above them or outside every pit, 1 at them)
  float ehHeat(vec3 p) {
    float k = 0.0;
    for (int i = 0; i < ${ENGINE_PITS}; i++) {
      if (i >= uSkPitN) break;
      vec4 A = uSkPitA[i], B = uSkPitB[i];
      if (p.x < A.x - 1.6 || p.x > A.z + 1.6 || p.z < A.y - 1.6 || p.z > A.w + 1.6 || p.y > B.y + 0.05) continue;
      k = max(k, 1.0 - smoothstep(0.0, B.y - B.x, p.y - B.x));
    }
    return k;
  }
  // a wall's circuit in a column of two panels (P wide): up from the floor, a chamfered corner, across to the next
  // panel's middle, a chamfered corner, on up to its lens. x: the distance to the line (m), y: to its lens' middle
  vec2 ehWallLine(vec2 q, float P, float K) {
    float Wc = 2.0 * P, c = floor(q.x / Wc), x0 = c * Wc;
    if (ehH(vec2(c, 7.13)) > K) return vec2(1e3);
    float xa = x0 + 0.5 * P, xb = x0 + 1.5 * P;
    if (ehH(vec2(c, 5.71)) < 0.5) { float s = xa; xa = xb; xb = s; }
    float s = sign(xb - xa), ch = 0.3;
    float yj = 0.8 + 2.4 * ehH(vec2(c, 9.37)), yt = yj + 1.4 + 3.2 * ehH(vec2(c, 4.41));
    float d = ehSeg(q, vec2(xa, -2.0), vec2(xa, yj - ch));
    d = min(d, ehSeg(q, vec2(xa, yj - ch), vec2(xa + s * ch, yj)));
    d = min(d, ehSeg(q, vec2(xa + s * ch, yj), vec2(xb - s * ch, yj)));
    d = min(d, ehSeg(q, vec2(xb - s * ch, yj), vec2(xb, yj + ch)));
    d = min(d, ehSeg(q, vec2(xb, yj + ch), vec2(xb, yt - 0.2)));
    return vec2(d, length(q - vec2(xb, yt)));
  }
  // a floor's lines: rows every S along u, in runs of C (the run on or not), each run its own offset by whole plates
  // (G) from the row's seam, a 45° jog between two runs; ends lensed. x: the distance (m), y: to an end's lens
  vec2 ehFloorLine(vec2 p, float S, float C, float G, float seed) {
    float r = floor(p.y / S);
    if (ehH(vec2(r, seed)) > 0.7) return vec2(1e3);
    float zc = r * S, i = floor(p.x / C), x0 = i * C, x1 = x0 + C;
    float on0 = step(0.25, ehH(vec2(i, r + seed))), onL = step(0.25, ehH(vec2(i - 1.0, r + seed))), onR = step(0.25, ehH(vec2(i + 1.0, r + seed)));
    float o0 = floor(ehH(vec2(i, r * 1.7 + seed)) * 2.999) - 1.0, oL = floor(ehH(vec2(i - 1.0, r * 1.7 + seed)) * 2.999) - 1.0, oR = floor(ehH(vec2(i + 1.0, r * 1.7 + seed)) * 2.999) - 1.0;
    float z0 = zc + o0 * G, zL = zc + oL * G, zR = zc + oR * G;
    float dL = onL * abs(z0 - zL) * 0.5, dR = onR * abs(zR - z0) * 0.5;
    float d = 1e3, lens = 1e3;
    if (on0 > 0.5) {
      d = ehSeg(p, vec2(x0 + dL, z0), vec2(x1 - dR, z0));
      if (onL > 0.5) d = min(d, ehSeg(p, vec2(x0 - dL, zL), vec2(x0 + dL, z0))); else lens = length(p - vec2(x0 + 0.6, z0));
      if (onR > 0.5) d = min(d, ehSeg(p, vec2(x1 - dR, z0), vec2(x1 + dR, zR))); else lens = min(lens, length(p - vec2(x1 - 0.6, z0)));
    } else {
      if (onL > 0.5) lens = length(p - vec2(x0 - 0.6, zL));
      if (onR > 0.5) lens = min(lens, length(p - vec2(x1 + 0.6, zR)));
    }
    return vec2(d, lens);
  }
  // a lens at the end of a line: a ring and its dot (r: from its middle, m)
  float ehLens(float r, float fw) { return max(ehLine(abs(r - 0.2), fw, 0.025), 1.0 - smoothstep(0.075 - fw, 0.075, r)); }
  // the pulse travelling slowly along the lines (the oil-light)
  float ehPulse(vec2 q) { return 0.5 + 0.5 * sin(uTime * 0.8 - (q.x + q.y) * 0.3); }
`;

/** Each body replaces the surface's `vec3 albedo = uColor;` and sets skInk (its pen lines) and skEmit (what glows). */
const BODIES = {
  // the walls (and, denser, the machine slabs): tall chamfered slabs, amber circuits, the pits' heat
  wall: /* glsl */ `
    vec3 skP = uSkObj > 0.5 ? vObjPos : ehLocal(vWorldPos), skN = uSkObj > 0.5 ? normalize(vObjNormal) : ehLocalN(n);
    float skInk = 0.0, skEmit = 0.0;
    vec3 albedo = uColor;
    {
      bool lite = uWearLite > 0.5;
      bool side = abs(skN.y) < 0.65;
      vec3 W = side ? (uSkObj > 0.5 ? vec3(abs(skN.x) > abs(skN.z) ? skP.z : skP.x, 0.0, 1.0) : ehWall(skP, skN)) : vec3(skP.x, 0.0, 0.0);
      float base = side && W.z > 0.5 ? W.y : 0.0;
      vec2 uv = side ? vec2(W.x, skP.y - base) : skP.xz;
      float P = uSkCell.x, Hc = uSkCell.y;
      // the slabs: columns P wide, a joint across every Hc, each column's joints set off its own way
      float col = floor(uv.x / P), oy = side ? ehH(vec2(col, 3.3)) * Hc : 0.0;
      vec2 c = vec2(uv.x / P, (uv.y + oy) / Hc), cell = floor(c), f = fract(c), fq = fwidth(c);
      vec2 fw2 = fwidth(uv);
      float fw = max(max(fw2.x, fw2.y), 1e-5);
      vec2 dm = min(f, 1.0 - f) * uSkCell, dfw = fq * uSkCell;
      float near = ehNear(max(dfw.x, dfw.y), 1.0);
      float seam = max(ehLine(dm.x, dfw.x, 0.02), ehLine(dm.y, dfw.y, 0.02));
      if (!lite) {
        albedo *= 0.95 + 0.1 * ehH(cell + 11.0);
        // the chamfers: a lit lip along each slab's top and left edge, a shaded one along its bottom and right
        float b = 0.075;
        vec2 m = f * uSkCell, M2 = (1.0 - f) * uSkCell;
        float lit = max(1.0 - smoothstep(b - fw, b, M2.y), 1.0 - smoothstep(b - fw, b, m.x));
        float shd = max(1.0 - smoothstep(b - fw, b, m.y), 1.0 - smoothstep(b - fw, b, M2.x));
        float k = 1.0 - smoothstep(0.4, 1.0, fw / b);
        albedo = mix(albedo, uSkLight, lit * k * 0.75);
        albedo = mix(albedo, uSkDark, shd * k * 0.75 * (1.0 - lit));
      }
      albedo = mix(albedo, uSkSeam, seam * 0.75 * near);
      skInk = seam * near * 0.5;
      // (ceilings and undersides darker, as the picks' are)
      if (skN.y < -0.65) albedo *= 0.72;
      if (side) {
        float heat = uSkObj > 0.5 ? 0.0 : ehHeat(skP);
        vec2 L = ehWallLine(uv, P, uSkK);
        float d = L.x;
        // (a foot line along the wall in some stretches)
        if (!lite && W.z > 0.5 && ehH(vec2(floor(uv.x / 11.0), 1.9)) < 0.45) d = min(d, abs(uv.y - 0.4));
        // the machine's leaves: a lit seam up their middle (in their own frame)
        if (uSkObj > 0.5) d = min(d, abs(uv.x));
        float pulse = ehPulse(uv);
        float cov = max(ehLine(d, fw, 0.022), ehLens(L.y, fw));
        // down in a pit: a lit line down every column, the slabs warming toward the embers
        if (heat > 0.0) {
          float px = abs(fract(uv.x / P) - 0.5) * P;
          cov = max(cov, ehLine(px, fw, 0.03) * smoothstep(0.05, 0.4, heat));
          albedo = mix(albedo, uSkA * 0.78, heat * heat * 0.75);
          skEmit = max(skEmit, heat * heat * ${E.heat.toFixed(3)});
        }
        cov *= ehNear(fw, 0.25);
        albedo = mix(albedo, uSkA * (0.85 + 0.15 * pulse), cov);
        skEmit = max(skEmit, cov * (${E.line.toFixed(3)} + ${E.pulse.toFixed(3)} * pulse));
        skInk *= 1.0 - cov;
      }
    }
  `,
  // the floors: plates, amber lines along their seams, a border round each room, a lit edge under each landing's lip
  floor: /* glsl */ `
    vec3 skP = uSkObj > 0.5 ? vObjPos : ehLocal(vWorldPos), skN = uSkObj > 0.5 ? normalize(vObjNormal) : ehLocalN(n);
    float skInk = 0.0, skEmit = 0.0;
    vec3 albedo = uColor;
    {
      bool lite = uWearLite > 0.5;
      bool top = skN.y > 0.65;
      vec2 q = top ? skP.xz : vec2(abs(skN.x) > abs(skN.z) ? skP.z : skP.x, skP.y);
      vec2 c = q / uSkCell, cell = floor(c), f = fract(c), fq = fwidth(c);
      vec2 fw2 = fwidth(q);
      float fw = max(max(fw2.x, fw2.y), 1e-5);
      vec2 dm = min(f, 1.0 - f) * uSkCell, dfw = fq * uSkCell;
      float near = ehNear(max(dfw.x, dfw.y), 1.0);
      float seam = max(ehLine(dm.x, dfw.x, 0.02), ehLine(dm.y, dfw.y, 0.02));
      if (!lite) {
        albedo *= 0.95 + 0.1 * ehH(cell + 5.0);
        float b = 0.06;
        vec2 m = f * uSkCell, M2 = (1.0 - f) * uSkCell;
        float lit = max(1.0 - smoothstep(b - fw, b, M2.y), 1.0 - smoothstep(b - fw, b, m.x));
        float shd = max(1.0 - smoothstep(b - fw, b, m.y), 1.0 - smoothstep(b - fw, b, M2.x));
        float k = 1.0 - smoothstep(0.4, 1.0, fw / b);
        albedo = mix(albedo, uSkLight, lit * k * 0.5);
        albedo = mix(albedo, uSkDark, shd * k * 0.5 * (1.0 - lit));
      }
      albedo = mix(albedo, uSkSeam, seam * 0.7 * near);
      skInk = seam * near * 0.45;
      float cov = 0.0;
      if (top && uSkObj < 0.5) {
        // the lines along the plates' seams: rows along x (every 4 plates) and, but on the lighter presets, along z
        vec2 A = ehFloorLine(q, uSkCell.y * 4.0, uSkCell.x * 3.0, uSkCell.y, 1.3);
        if (!lite) { vec2 B = ehFloorLine(q.yx, uSkCell.x * 4.0, uSkCell.y * 5.0, uSkCell.x, 7.9); A = min(A, B); }
        cov = max(ehLine(A.x, fw, 0.024), ehLens(A.y, fw));
        // a border round the room's floor
        int ri = ehFloor(skP);
        if (ri >= 0) {
          vec4 R = uSkR[ri];
          vec2 d = skP.xz - R.xy;
          float e = R.w < 0.0 ? length(d) - R.z : max(abs(d.x) - R.z, abs(d.y) - R.w);
          bool passage = uSkY[ri].z > 0.5;
          if (passage) { float cc = R.z < R.w ? abs(d.x) : abs(d.y); cov = max(cov, ehLine(abs(cc - 1.6), fw, 0.024)); }
          else cov = max(cov, ehLine(abs(e + 1.5), fw, 0.026));
        }
      } else if (top) {
        // a riding disc's or a bridge's own: a lens in its middle
        cov = ehLens(length(skP.xz), fw);
      } else {
        // a slab's edge (a landing's face): darker, an amber line just under its lip, the pits' heat on it
        albedo *= 0.72;
        if (uSkObj < 0.5) {
          for (int i = 0; i < 4; i++) { float y = uSkLips[i]; if (y > -900.0) cov = max(cov, ehLine(abs(skP.y - (y - 0.14)), fw, 0.024)); }
          float heat = ehHeat(skP);
          albedo = mix(albedo, uSkA * 0.7, heat * heat * 0.7);
          skEmit = max(skEmit, heat * heat * ${E.heat.toFixed(3)});
        }
      }
      cov *= ehNear(fw, 0.25);
      float pulse = ehPulse(q);
      albedo = mix(albedo, uSkA * (0.85 + 0.15 * pulse), cov);
      skEmit = max(skEmit, cov * (${E.line.toFixed(3)} + ${E.pulse.toFixed(3)} * pulse));
      skInk *= 1.0 - cov;
    }
  `,
};

/** One of the skin's surface materials: makeMaterial's, its albedo and first pen lines the body's, its glow skEmit. */
function skinMaterial(body, look, S, U, key, obj = false) {
  const m = makeMaterial({ flat: true, ...look, color: S.color, key: `temple.skin.engine.${key}` });
  // (this build's rooms and pits: a material from the cache is pointed at them again)
  Object.assign(m.uniforms, { uSkinO: U.origin, uSkRot: U.rot, uSkR: U.rooms, uSkY: U.roomsY, uSkN: U.count, uSkPitA: U.pitA, uSkPitB: U.pitB, uSkPitN: U.pits, uSkLips: U.lips });
  if (m.userData.houseSkin) return m;
  m.userData.houseSkin = body;
  const fs = m.fragmentShader, at = fs.lastIndexOf('void main()');
  if (at < 0 || !fs.includes('vec3 albedo = uColor;') || !fs.includes('float detail = 0.0;') || !fs.includes('float emit = 0.0;')) throw new Error('skins/engine-house.js: the surface shader changed: no albedo, emit or detail line to replace');
  m.fragmentShader = PARS + fs.slice(0, at) + GLSL + fs.slice(at).replace('vec3 albedo = uColor;', BODIES[body]).replace('float emit = 0.0;', 'float emit = skEmit;').replace('float detail = 0.0;', 'float detail = skInk;');
  Object.assign(m.uniforms, {
    uSkA: { value: new THREE.Color(ENGINE_SKIN.amber) }, uSkDark: { value: new THREE.Color(S.dark) }, uSkLight: { value: new THREE.Color(S.light) },
    uSkSeam: { value: new THREE.Color(S.seam) }, uSkCell: { value: new THREE.Vector2(...S.cell) }, uSkK: { value: S.density ?? 0.6 },
    uSkObj: { value: obj ? 1 : 0 },
  });
  return m;
}

// ------------------------------------------------------------------ the makers' sign
/**
 * The friezes' and the threshold's glyphs are the kit's own, the shared makers' mark (src/story/sign-text.js
 * glyphGeometry), lit in the skin's pale amber: counted, never redrawn (tests/temple-skins.test.js).
 */
const countSigns = (K, mat) => K.batches.get(mat)?.filter((g) => g.userData.makersMark).length ?? 0;

// ------------------------------------------------------------------ the dressing's shapes (unit frames: x across, y up, z out of the wall)
/** Geometries merged into one, each part a grey level (a colour attribute: the dressing's material reads it). */
function merge(list, tones) {
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
/** A unit box, its foot at y = 0, its back at z = 0 (out of the wall along z). */
const blockGeometry = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0.5).toNonIndexed();
/**
 * A chamfered slab (unit: 1 wide, 1 high, 1 deep, its back at z = 0): its two front edges cut (cx across, cz out), its
 * head cut back the same way: a section across (x, out of the wall) extruded up.
 */
function slabGeometry(cx = 0.08, cz = 0.3) {
  const sec = new THREE.Shape();
  sec.moveTo(-0.5, 0); sec.lineTo(0.5, 0); sec.lineTo(0.5, 1 - cz); sec.lineTo(0.5 - cx, 1); sec.lineTo(-0.5 + cx, 1); sec.lineTo(-0.5, 1 - cz); sec.lineTo(-0.5, 0);
  // (rotated about x, a quarter turn: the section's y out of the wall along z, the extrusion down y; then lifted to 0..1)
  const g = new THREE.ExtrudeGeometry(sec, { depth: 1, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, 1, 0);
  return g.index ? g.toNonIndexed() : g;
}
/**
 * A lens terminal's plate: a dark metal plate, four round bezels in a square on it (their wells dark), as the picks'
 * wall has them (unit: the plate 1 by 1, its back at z = 0); the lit lenses are the glow's (lensGeometry).
 */
function terminalGeometry(r, gap) {
  const S = gap + 2 * r + 0.5, parts = [new THREE.BoxGeometry(S, S, 0.16).translate(0, 0, 0.08), new THREE.BoxGeometry(S + 0.3, S + 0.3, 0.06).translate(0, 0, 0.03)], tones = [1, 0.8];
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    parts.push(new THREE.TorusGeometry(r * 1.08, r * 0.16, 6, 22).scale(1, 1, 0.8).translate(x * gap / 2, y * gap / 2, 0.2)); tones.push(1.6);
    parts.push(new THREE.CircleGeometry(r * 0.98, 22).translate(x * gap / 2, y * gap / 2, 0.165)); tones.push(0.35);
  }
  return merge(parts, tones);
}
/** A lens: a lit disc in a thin lit ring, facing z (radius 1). */
const lensGeometry = () => mergeGeometries([new THREE.RingGeometry(0.82, 1.0, 22), new THREE.CircleGeometry(0.62, 18)].map((g) => g.toNonIndexed()));

// ------------------------------------------------------------------ placing the dressing
/** An instanced, drawn-only mesh of the dressing: walked through, never buried, never casting a shadow. */
function instanced(name, geo, mat, list, frame) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  m.name = `The Engine-House skin: ${name}`; m.count = list.length;
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

function dress(rt, keep, plan, rooms) {
  const S = ENGINE_SKIN, out = { slabs: [], plates: [], lit: [], strips: [], fine: [] };
  const clear = (c, half) => !keep.hits(new THREE.Box3(c.clone().sub(half), c.clone().add(half)));
  const at = (f, s) => f.o.clone().addScaledVector(f.t, s);
  const freeOf = (f, s, half) => !f.holes.some((h) => s > h.x0 - half - 1.2 && s < h.x1 + half + 1.2);
  const F = faces(plan, rooms), used = new Set();
  let n = 0;
  // a square of four lens terminals in each big hall: on its longest clear wall, the middle of the clear stretch
  const T = S.lenses, size = T.gap + 2 * T.r + 0.8;
  for (const r of rooms) {
    if (r.kind !== 'hall' || r.y1 - r.y0 < T.minH) continue;
    let best = null;
    for (const f of F.filter((g) => g.room === r)) {
      for (let s = f.s0 + size; s <= f.s1 - size; s += 0.5) {
        const p = at(f, s), c = p.clone().addScaledVector(f.nrm, 0.3).setY(p.y + T.y);
        if (!freeOf(f, s, size / 2) || !clear(c, V(size / 2 + 0.3, size / 2 + 0.3, 0.6))) continue;
        const score = -Math.abs(s - (f.s0 + f.s1) / 2) + (f.s1 - f.s0);
        if (!best || score > best.score) best = { f, s, score };
      }
    }
    if (!best) continue;
    const { f, s } = best, p = at(f, s).setY(f.o.y + T.y).addScaledVector(f.nrm, 0.01);
    out.plates.push(basis(p, f.t, V(0, 1, 0), f.nrm));
    // (two of the four lit, as drawn: a pair down one side or along the top, by the room)
    const k = n++ % 3, lit = [[[-1, 1], [1, 1]], [[-1, -1], [-1, 1]], [[-1, 1], [1, -1]]][k];
    for (const [x, y] of lit) out.lit.push(basis(p.clone().addScaledVector(f.t, x * T.gap / 2).setY(p.y + y * T.gap / 2).addScaledVector(f.nrm, 0.18), f.t.clone().multiplyScalar(T.r * 0.98), V(0, T.r * 0.98, 0), f.nrm.clone()));
    // its circuit: down the wall from the plate to the floor
    out.strips.push(basis(at(f, s).setY(f.o.y).addScaledVector(f.nrm, 0.012), f.t.clone().multiplyScalar(0.05), V(0, T.y - size / 2 - 0.15, 0), f.nrm.clone().multiplyScalar(0.03)));
    used.add(f);
    keep.add(new THREE.Box3().setFromCenterAndSize(p.clone().addScaledVector(f.nrm, 0.3), V(size + 3, size + 2, 2)).union(new THREE.Box3().setFromCenterAndSize(p.clone().setY(f.o.y + 1), V(2, 2, 2))));
  }
  // pilaster slabs along the halls' walls: tall chamfered slate, a lit line up each, a lens at its head
  const Pl = S.pilasters;
  const pilaster = (p, t, nrm, h) => {
    out.slabs.push(basis(p.clone().setY(p.y - SINK).addScaledVector(nrm, -0.04), t.clone().multiplyScalar(Pl.w), V(0, h + SINK, 0), nrm.clone().multiplyScalar(Pl.d)));
    out.strips.push(basis(p.clone().setY(p.y + 0.5).addScaledVector(nrm, Pl.d - 0.035), t.clone().multiplyScalar(0.06), V(0, h - 2.0, 0), nrm.clone().multiplyScalar(0.04)));
    out.fine.push(basis(p.clone().setY(p.y + h - 1.0).addScaledVector(nrm, Pl.d - 0.02), t.clone().multiplyScalar(0.2), V(0, 0.2, 0), nrm.clone()));
  };
  for (const f of F) {
    const R = f.room, H = R.y1 - R.y0;
    if (H < Pl.minH) continue;
    const h = Math.min(H * Pl.h, 12);
    const L = f.s1 - f.s0, k = Math.max(1, Math.floor(L / Pl.every));
    let placed = 0;
    for (let i = 0; i < k && placed < Pl.n; i++) {
      const s = f.s0 + ((i + 0.5) / k) * L, p = at(f, s);
      const c = p.clone().addScaledVector(f.nrm, 0.4).setY(p.y + h / 2);
      if (!freeOf(f, s, Pl.w / 2 + 0.4) || !clear(c, V(Pl.w / 2 + 0.3, h / 2, 0.6))) continue;
      pilaster(p, f.t, f.nrm, h); placed++;
      keep.add(new THREE.Box3().setFromCenterAndSize(c, V(Pl.w + 1.2, h, 1.4)));
    }
  }
  // the round rooms: a pilaster against every few of their stones, clear of their gaps
  for (const r of rooms) {
    if (r.kind !== 'round') continue;
    const e = r.e, step = TAU / e.seg, every = Math.max(2, Math.round(e.seg / 9)), h = Math.min((r.y1 - r.y0) * Pl.h, 12);
    for (let i = 1; i < e.seg; i += every) {
      const a = (i + 0.5) * step;
      if ((e.gaps ?? []).some((g) => Math.abs(Math.atan2(Math.sin(a - g.a), Math.cos(a - g.a))) * e.r < g.w / 2 + 2.4)) continue;
      const o = V(Math.sin(a), 0, Math.cos(a)), nrm = o.clone().negate(), t = V(Math.cos(a), 0, -Math.sin(a)).negate();
      const p = V(e.x, e.y, e.z).addScaledVector(o, e.r * Math.cos(Math.PI / e.seg) - 0.02);
      const c = p.clone().addScaledVector(nrm, 0.4).setY(e.y + h / 2);
      if (!clear(c, V(Pl.w / 2 + 0.3, h / 2, 0.6))) continue;
      pilaster(p, t, nrm, h);
      keep.add(new THREE.Box3().setFromCenterAndSize(c, V(Pl.w + 1.2, h, 1.4)));
    }
  }
  return out;
}

/** The finest dressing hidden on the lighter presets (uWearLite), and the dressing's lights breathing. */
class SkinLife {
  constructor(meshes, glow) { this.fine = meshes.filter((m) => m.userData.skinFine); this.glow = glow; }
  update(dt, t) {
    const on = sharedUniforms.uWearLite.value < 0.5;
    for (const m of this.fine) if (m.visible !== on) m.visible = on;
    this.glow.uniforms.uGlow.value = ENGINE_SKIN.emit.line + 0.05 + 0.05 * Math.sin(t * 0.8);
  }
}

// ------------------------------------------------------------------ the skin
/**
 * The Engine-House's skin (its def's `skin`, src/temples/skins/index.js): called before the layout. Swaps rt.M's
 * surfaces (and rt.P's hammer iron) for its own and starts the kit's plan; buried.js asks it for its embers' material
 * (skin.mats.ember) and the Tooth-Warden's colours (skin.warden).
 */
export function engineHouseSkin(rt) {
  const K = rt.kit, M = rt.M, S = ENGINE_SKIN, look = rt.def.palette?.look?.all ?? {};
  const U = {
    origin: { value: K.origin.clone() }, rot: { value: new THREE.Vector2(Math.cos(K.yaw), Math.sin(K.yaw)) },
    rooms: { value: Array.from({ length: ENGINE_ROOMS }, () => new THREE.Vector4()) },
    roomsY: { value: Array.from({ length: ENGINE_ROOMS }, () => new THREE.Vector4()) },
    count: { value: 0 },
    pitA: { value: Array.from({ length: ENGINE_PITS }, () => new THREE.Vector4()) },
    pitB: { value: Array.from({ length: ENGINE_PITS }, () => new THREE.Vector4()) },
    pits: { value: 0 },
    lips: { value: new THREE.Vector4(-999, -999, -999, -999) },
  };
  const own = (k, o) => makeMaterial({ flat: true, ...o, key: `temple.skin.engine.${k}` });
  const glow = own('glow', { color: S.amber, glow: S.emit.line + 0.05, side: THREE.DoubleSide });
  const mats = {
    wall: skinMaterial('wall', { ...look, hatch: 0.15 }, S.wall, U, 'wall'),
    machine: skinMaterial('wall', { ...look, hatch: 0.2 }, S.machine, U, 'machine'),
    floor: skinMaterial('floor', { ...look, hatch: 0.4 }, S.floor, U, 'floor'),
    // (the pieces' own, in their own frame: they move with the riding discs, the bridge and the doors' leaves)
    floorObj: skinMaterial('floor', { ...look, hatch: 0.4 }, S.floor, U, 'floorObj', true),
    machineObj: skinMaterial('wall', { ...look, hatch: 0.2 }, { ...S.machine, cell: [1.75, 2.25] }, U, 'machineObj', true),
    glow,
    glyph: own('glyph', { color: S.amberPale, glow: 0.78 }),
    ember: own('ember', { color: S.ember, glow: 0.7 }),
    trimMat: own('fitting', { color: S.brass, metal: 'brass', refl: 0.15 }),
    stoneMat: own('ball', { ...look, color: S.ball, metal: 'iron', refl: 0.45, highlight: 0.35 }),
    // the dressing's slate (vertex tones: the plates' bezels lighter, their wells near black)
    slab: own('slab', { ...look, color: S.slab, hatch: 0.15, vertexColors: true }),
  };
  const was = { ...M }, wasP = rt.P;
  Object.assign(M, {
    wall: mats.wall, wallGlyph: mats.machine, floor: mats.floor, trimMat: mats.trimMat, stoneMat: mats.stoneMat, glyph: mats.glyph,
    trim: paint(S.trim), dark: paint(S.dark), stone: paint(S.stone),
    // (no straps across the slabs; the valves lens terminals: a thin lit ring on the slate)
    bands: [],
    // (its well the wall's own slate: a disc of another look 1 cm off a round room's chord z-fought, tests/zfight.test.js)
    ornament: { kind: 'porthole', mats: { a: glow, b: mats.wall } },
  });
  // (the drop hammers' heads dark metal: pieces.js Hammer paints them rt.P.wall2)
  rt.P = { ...wasP, wall2: S.hammer };
  K.plan = [];
  const meshes = [];
  const skin = {
    name: 'engine-house', S, mats, U, meshes, stats: null, light: S.light, warden: S.warden,
    /** After the layout: the rooms and pits handed to the shader, the signs counted, the pieces' surfaces, the dressing. */
    dress() {
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      const plan = K.plan, rooms = roomsOf(plan), list = rooms.slice(0, ENGINE_ROOMS);
      list.forEach((r, i) => {
        U.rooms.value[i].set(r.x, r.z, r.kind === 'round' ? r.r : r.hx, r.kind === 'round' ? -1 : r.hz);
        U.roomsY.value[i].set(r.y0, r.y1, r.kind === 'corridor' ? 1 : 0, 0);
      });
      U.count.value = list.length;
      // the pits: under each stretch of embers (its xz), from the embers' top up to the landings' lips
      const lips = [...new Set(rooms.filter((r) => r.kind !== 'corridor').map((r) => r.y0))].sort((a, b) => a - b);
      const embers = (K.batches.get(mats.ember) ?? []).map((g) => { g.computeBoundingBox(); return g.boundingBox.clone().applyMatrix4(K.inv); });
      embers.slice(0, ENGINE_PITS).forEach((b, i) => {
        // (the highest floor within a hall's height over the embers: the landings round the pit, not the pit's own hall)
        const top = Math.max(b.max.y + 4, ...lips.filter((y) => y > b.max.y + 2 && y < b.max.y + 14));
        U.pitA.value[i].set(b.min.x, b.min.z, b.max.x, b.max.z);
        U.pitB.value[i].set(b.max.y, top, 0, 0);
      });
      U.pits.value = Math.min(ENGINE_PITS, embers.length);
      // (the landings' lips: every floor over the lowest, where a slab's edge looks down into a pit or a hall)
      const hi = lips.filter((y) => y > lips[0] + 1).slice(0, 4);
      U.lips.value.set(...[...hi, -999, -999, -999, -999].slice(0, 4));
      const signs = countSigns(K, mats.glyph);
      for (const p of rt.pieces) {
        const o = p.group ?? p.mesh ?? p.root;
        o?.traverse?.((m) => { if (m.material === mats.floor) m.material = mats.floorObj; else if (m.material === mats.machine) m.material = mats.machineObj; });
      }
      const keep = keepOuts(rt, new Set([mats.wall, mats.machine, mats.floor, mats.ember, M.sand]));
      const d = dress(rt, keep, plan, rooms);
      const F0 = K.frame;
      meshes.push(instanced('pilaster slabs', slabGeometry(), mats.slab, d.slabs, F0));
      meshes.push(instanced('lens terminals’ plates', terminalGeometry(S.lenses.r, S.lenses.gap), mats.slab, d.plates, F0));
      meshes.push(instanced('lit lenses', lensGeometry(), glow, d.lit, F0));
      meshes.push(instanced('lit lines', blockGeometry(), glow, d.strips, F0));
      const fm = instanced('pilasters’ lenses', lensGeometry(), glow, d.fine, F0); fm.userData.skinFine = true; meshes.push(fm);
      for (const m of meshes) K.group.add(m);
      rt.pieces.push(new SkinLife(meshes, glow));
      skin.stats = { rooms: list.length, pits: U.pits.value, signs, pilasters: d.slabs.length, terminals: d.plates.length, lit: d.lit.length + d.fine.length, strips: d.strips.length, ms: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0) };
    },
    /** After the kit's flush: the lit surfaces out of the shadow passes, the house's own materials back for its exterior. */
    done() {
      for (const m of K.group.children) if (m.material === glow || m.material === mats.glyph || m.material === mats.ember || m.material === M.ornament?.mats?.a) { m.castShadow = false; m.userData.castShadow = false; }
      Object.keys(M).forEach((k) => { if (!(k in was)) delete M[k]; });
      Object.assign(M, was);
      rt.P = wasP;
      K.plan = null;
    },
  };
  return skin;
}
