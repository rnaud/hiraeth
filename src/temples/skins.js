import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, sharedUniforms } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';

// ---------------------------------------------------------------------------
// The houses' alien skins (issue #342, docs/systems/temples.md "Alien skins"): the look and feel of a house redrawn after
// the author's picked reference (references/temples/alien/<id>/sheet-1.jpg) over its rooms as they are. A house opts in
// with `skin: 'cactus' | 'comb'` on its def; nothing of its layout changes: the same rooms, doors, collision, pieces,
// positions and logic. The skin is three things:
//   1. its surfaces: the house's wall, climb-face and floor materials swapped for the skin's own (the surface shader, its
//      albedo and pen lines replaced, as landmark-materials.js stone() does): a cactus's pleated ribs, valley lines and
//      fine crackle; a hive's cream courses, wavy blue bands and hexagonal cells; cracked flesh or hex-tiled floors; the
//      makers' marked faces (doors, the climb's face, a pier) a pale smooth seal with their carvings. The
//      walls of a round room are patterned round its middle (the rooms the kit recorded: uSkR), so a drum's ribs and cells
//      run on round it without a seam, and a ceiling's ribs converge on its oculus.
//   2. its relief and dressing, drawn only: a few InstancedMeshes (noCollide, keepBuried, no shadow): rib fins up the
//      walls and ribs across the ceilings, a plate of turquoise pores in each oculus and seed-capsule lamps on tall
//      stalks (the cactus); hooded hex cells on the walls, papery wing-pane membranes high under the ceilings and a papery
//      nest mouth round each oculus (the comb). They are placed from the kit's record of its walls and rooms
//      (TempleKit.plan) and kept clear of every doorway, of everything else drawn on the walls (frames, friezes, glyphs,
//      windows, fittings) and of every piece, by boxes.
//   3. its braziers: a seed capsule on a fleshy stalk over the same hooded bowl (pieces.js Brazier asks rt.skin), lit as
//      before (the capsule glows amber with it).
// On the Low, Handheld and Steam Deck presets (uWearLite) the shader leaves out its fine crackle and the finest dressing
// (the ceiling ribs, the small cells) is hidden. The exterior keeps the house's own stone: the house's materials are put
// back once its rooms are built (runtime.js).
//
//   const skin = houseSkin(rt)     before def.layout(rt): rt.M's surfaces swapped, rt.kit.plan recording (null: no skin)
//   skin.dress()                   after the layout, before kit.flush(): the shader's rooms, the dressing
//   skin.done()                    after kit.flush(): rt.M as it was (the exterior is built with it)
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
/** Up to this many rooms are handed to the shader (a house's halls, round rooms and passages, the round ones first). */
export const SKIN_ROOMS = 16;

/**
 * The skins: colours (sRGB), pattern sizes (m), the dressing's sizes and spacing.
 *   wall { color (the flank), a, b, c (pattern tones), size: [pleat or cell, crackle or wall share, ceiling share] }
 *   wallGlyph (the seal) { color, b, size: [cell, its net's ink] } · floor { color, a, b, size: [cell, fine crackle] }
 */
export const SKINS = {
  /** The Rose House (references/temples/alien/rose-house/sheet-1.jpg): the inside of a dry barrel cactus. */
  cactus: {
    bands: false,   // (no straight courses across the ribs)
    wall: { color: '#d68677', a: '#a3485a', b: '#efc595', size: [4.4, 0.32, 0] },
    wallGlyph: { color: '#e5ad8a', b: '#f3cfa3', size: [0.75, 0.38, 0] },
    floor: { color: '#e2b993', a: '#d2a283', b: '#ecc9a3', size: [3.6, 0.7] },
    fin: { color: '#d98b78', crest: '#f1cb9c', valley: '#a24b5a', every: 4.4, round: 2, width: 2.3, depth: 0.65, crackle: 0.32 },
    rib: { every: 2, width: 0.95, depth: 0.5 },
    pore: { color: '#86ece0', glow: 0.85 },
    plate: { color: '#c67266' },
    lamp: { stalk: '#cf8a76', glass: '#b3566c', lit: '#f5a04a', count: 4 },
    brazier: { flesh: '#cf8473', glass: '#c0647a', lit: '#f7aa4e' },
  },
  /** The Warden's Well (references/temples/alien/wardens-well/sheet-1.jpg): a vertical wasp's comb. */
  comb: {
    bands: true,    // (the steel-blue course under every frieze stays: the glyphs read on it)
    wall: { color: '#efe4cc', a: '#7f95c6', b: '#3b4567', c: '#929ab9', size: [1.9, 0.2, 0.42] },
    wallGlyph: { color: '#f4ecda', b: '#fbf5e8', size: [1.1, 0.22, 0] },
    floor: { color: '#e6dbc1', a: '#d4c7aa', b: '#efe6d2', size: [1.25, 0] },
    cell: { rim: '#f3ead6', side: '#d9d2c4', deep: '#5f6a92', back: '#333b5b', density: 0.015, min: 0.55, max: 1.55, depth: 0.42 },
    membrane: { color: '#e3def0', vein: '#a59dc2', panes: 7 },
    nest: { color: '#e9e1cf', grey: '#9d9aaa' },
  },
};

// ------------------------------------------------------------------ the surfaces: the shader's own patterns
// (declared before main(): the surface shader's hash, vnoise, uPixelRatio and uWearLite are in scope by then)
const SK_PARS = /* glsl */ `
  uniform vec3 uSkinO;
  uniform vec4 uSkR[${SKIN_ROOMS}];
  uniform vec4 uSkY[${SKIN_ROOMS}];
  uniform int uSkN;
  uniform vec3 uSkA;
  uniform vec3 uSkB;
  uniform vec3 uSkC;
  uniform vec4 uSkP;
`;
const SK_GLSL = /* glsl */ `
  vec2 skH2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
  // the Voronoi net of q (in cells): x the half gap F2 - F1 to the nearest edge (cells), y the nearest cell's hash
  vec2 skVoronoi(vec2 q) {
    vec2 c = floor(q), f = fract(q);
    float d1 = 8.0, d2 = 8.0, id = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j)), o = skH2(c + g) * 0.8 + 0.1, r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = o.x; } else if (d < d2) d2 = d;
    }
    return vec2((sqrt(d2) - sqrt(d1)) * 0.5, id);
  }
  // a pen line along the net's edges (fq: cells a pixel), gone once the cells are under ~10 px
  float skNet(float e, float fq) {
    float w = 0.45 * uPixelRatio, px = e / max(fq, 1e-5);
    return (1.0 - smoothstep(w, w + 1.0, px)) * (1.0 - smoothstep(0.06, 0.12, fq));
  }
  // along a wall (m, or radians in a round room the kit recorded: y 1; rq its radius, its pleats round and their phase,
  // set so that the fins at its joints stand on the crests), else by the face's axis
  vec2 skAlong(vec3 p, vec3 nn, out vec3 rq) {
    rq = vec3(0.0);
    for (int i = 0; i < ${SKIN_ROOMS}; i++) {
      if (i >= uSkN) break;
      vec4 R = uSkR[i];
      if (R.w >= 0.0) continue;
      vec2 d = p.xz - R.xy;
      float r = length(d);
      if (abs(r - R.z) < 1.9 && p.y > uSkY[i].x - 1.0 && p.y < uSkY[i].y + 1.5 && abs(dot(nn.xz, d)) > 0.8 * r * length(nn.xz)) { rq = vec3(R.z, uSkY[i].zw); return vec2(atan(d.y, d.x), 1.0); }
    }
    return vec2(abs(nn.x) > abs(nn.z) ? p.z : p.x, 0.0);
  }
  // the room over or under p: the angle round its middle, and 1 + how far from it (m); 0 outside them all
  vec2 skRoom(vec3 p) {
    for (int i = 0; i < ${SKIN_ROOMS}; i++) {
      if (i >= uSkN) break;
      vec4 R = uSkR[i], Y = uSkY[i];
      if (p.y < Y.x - 0.6 || p.y > Y.y + 2.0) continue;
      vec2 d = p.xz - R.xy;
      if (R.w < 0.0 ? length(d) < R.z + 1.6 : (abs(d.x) < R.z + 1.4 && abs(d.y) < R.w + 1.4)) return vec2(atan(d.y, d.x), 1.0 + length(d));
    }
    return vec2(0.0);
  }
  // 1 on a room's own walls (within 2 m of the walls the kit recorded), 0 on a pillar or a block in its middle
  float skNearWall(vec3 p) {
    for (int i = 0; i < ${SKIN_ROOMS}; i++) {
      if (i >= uSkN) break;
      vec4 R = uSkR[i], Y = uSkY[i];
      if (p.y < Y.x - 0.6 || p.y > Y.y + 1.0) continue;
      vec2 d = p.xz - R.xy;
      if (R.w < 0.0 ? abs(length(d) - R.z) < 2.0 : (max(abs(d.x) - R.z, abs(d.y) - R.w) > -2.0 && max(abs(d.x) - R.z, abs(d.y) - R.w) < 1.5)) return 1.0;
    }
    return 0.0;
  }
  // a hex cell of p (an inradius of 0.5): xy the offset in it, zw its id; and its hex distance
  vec4 skHex(vec2 p) {
    const vec2 s = vec2(1.0, 1.7320508);
    vec4 c = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
    vec4 h = vec4(p - c.xy * s, p - (c.zw + 0.5) * s);
    return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, c.xy) : vec4(h.zw, c.zw + 0.5);
  }
  float skHexD(vec2 h) { h = abs(h); return max(dot(h, vec2(0.5, 0.8660254)), h.x); }
  float skLine(float px) { float w = 0.5 * uPixelRatio; return 1.0 - smoothstep(w, w + 1.1, px); }
`;
/**
 * Each pattern replaces the surface's `vec3 albedo = uColor;` (and its first pen lines: skInk). uSkP: the skin's sizes.
 *   cactusWall: pleats up the walls (uSkP.x m a pleat; deep in the valley uSkA, the flank uColor, ochre on the crest uSkB),
 *     a pen line down each valley and a broken one down the shaded flank, fine crackle (uSkP.y m) near; on a ceiling the
 *     pleats run round its room's middle, converging on the oculus.
 *   cactusFloor: cracked dry flesh, cells of uSkP.x m each its own tone, a finer crackle (uSkP.y) near.
 *   combWall: cream (uColor) in fine wavy courses, wavy blue bands (uSkA), and hex cells (uSkP.x m across) of which
 *     uSkP.y on a wall and uSkP.z on a ceiling are holes going deep (uSkC to uSkB) inside a lighter rim.
 *   combFloor: hex tiles (uSkP.x m) each its own tone.
 *   membrane: a pale wing pane, its veins in two nets.
 *   flesh: the dressing's own (a fin's tones are its vertex colours): a fine crackle near.
 */
const BODIES = {
  cactusWall: /* glsl */ `
    vec3 skP = vWorldPos - uSkinO;
    float skInk = 0.0;
    vec3 albedo = uColor;
    {
      float q = 0.0, along = 0.0;
      vec3 rq;
      bool side = abs(n.y) < 0.65;
      if (side) {
        vec2 A = skAlong(skP, n, rq);
        along = A.y > 0.5 ? A.x * rq.x : A.x;
        q = A.y > 0.5 ? A.x / 6.2831853 * (rq.y > 0.5 ? rq.y : max(1.0, floor(6.2831853 * rq.x / uSkP.x + 0.5))) + rq.z : A.x / uSkP.x;
        q += (vnoise(vec2(along * 0.09, skP.y * 0.05)) - 0.5) * 0.22 + sin(skP.y * 0.17 + along * 0.031) * 0.05;
      } else {
        vec2 G = skRoom(skP);
        along = skP.x;
        q = G.y > 0.5 ? G.x / 6.2831853 * 44.0 + sin(G.y * 0.35) * 0.1 : (skP.x + skP.z * 0.37) / uSkP.x;
      }
      float fq = fwidth(q);
      float f = fract(q), c = smoothstep(0.0, 0.42, min(f, 1.0 - f) * 2.0) * 0.55 + smoothstep(0.35, 1.0, min(f, 1.0 - f) * 2.0) * 0.45;
      float far = smoothstep(0.12, 0.3, fq);
      vec3 tone = mix(uSkA, uColor, smoothstep(0.0, 0.5, c));
      tone = mix(tone, uSkB, smoothstep(0.55, 1.0, c));
      albedo = mix(tone, uColor * 0.55 + (uSkA + uSkB) * 0.225, far);
      albedo *= 0.95 + 0.1 * vnoise(vec2(along, skP.y) * 0.06);
      float dv = min(f, 1.0 - f) / max(fq, 1e-5), dh = abs(f - 0.78) / max(fq, 1e-5);
      skInk = skLine(dv) * (1.0 - far) * 0.9;
      skInk = max(skInk, skLine(dh) * (1.0 - far) * 0.35 * step(0.45, vnoise(vec2(q * 2.0, skP.y * 0.35))));
      vec2 cq = (side ? vec2(along, skP.y) : skP.xz) / uSkP.y;
      vec2 fc = fwidth(cq);
      // (in patches, as the reference's dry skin cracks: not all over)
      if (uWearLite < 0.5) { vec2 vo = skVoronoi(cq); skInk = max(skInk, skNet(vo.x, max(fc.x, fc.y)) * 0.3 * smoothstep(0.38, 0.62, vnoise(cq * 0.09 + 3.0))); }
    }
  `,
  cactusFloor: /* glsl */ `
    vec3 skP = vWorldPos - uSkinO;
    float skInk = 0.0;
    vec3 albedo = uColor;
    {
      bool top = abs(n.y) > 0.65;
      vec2 uv = top ? skP.xz : vec2(abs(n.x) > abs(n.z) ? skP.z : skP.x, skP.y);
      vec2 q = uv / uSkP.x, fq2 = fwidth(q);
      float fq = max(fq2.x, fq2.y);
      vec2 vo = skVoronoi(q);
      float far = smoothstep(0.08, 0.2, fq);
      vec3 cell = mix(mix(uSkA, uColor, smoothstep(0.0, 0.45, vo.y)), uSkB, smoothstep(0.55, 0.95, vo.y));
      albedo = mix(mix(uColor, cell, 0.6), uColor, far);
      albedo *= 0.96 + 0.08 * vnoise(uv * 0.11);
      skInk = skNet(vo.x, fq) * 0.42;
      // (the fine crackle in patches, as dry skin cracks)
      vec2 q2 = uv / uSkP.y, f2 = fwidth(q2);
      if (uWearLite < 0.5) { vec2 v2 = skVoronoi(q2 + 17.0); skInk = max(skInk, skNet(v2.x, max(f2.x, f2.y)) * 0.2 * smoothstep(0.4, 0.66, vnoise(uv * 0.07 + 5.0))); }
    }
  `,
  combWall: /* glsl */ `
    vec3 skP = vWorldPos - uSkinO;
    float skInk = 0.0;
    vec3 albedo = uColor;
    {
      vec3 rq;
      bool side = abs(n.y) < 0.65;
      vec2 uv = skP.xz;
      if (side) {
        vec2 A = skAlong(skP, n, rq);
        uv = vec2(A.y > 0.5 ? A.x / 6.2831853 * max(1.0, floor(6.2831853 * rq.x / uSkP.x + 0.5)) * uSkP.x : A.x, skP.y);
      }
      // fine wavy courses of the comb's paper, a pen line each, broken
      float yy = uv.y + (vnoise(vec2(uv.x * 0.11, uv.y * 0.07)) - 0.5) * 1.3;
      float sq = yy / 0.45, sfq = fwidth(sq);
      float sd = min(fract(sq), 1.0 - fract(sq)) / max(sfq, 1e-5);
      float course = skLine(sd) * smoothstep(0.38, 0.6, vnoise(vec2(uv.x * 0.5, sq * 0.7))) * (1.0 - smoothstep(0.15, 0.35, sfq));
      // the wavy blue bands, on the walls
      float bq = yy / 3.9, bi = floor(bq), bf = fract(bq);
      float bw = step(0.35, fract(sin(bi * 12.9898) * 43758.5453)) * (0.07 + 0.13 * fract(sin(bi * 78.233) * 43758.5453));
      float band = side ? step(bf, bw) : 0.0;
      albedo = mix(uColor, uSkA, band);
      albedo *= 0.97 + 0.06 * vnoise(uv * 0.13);
      // the cells: a hex grid; some of its cells holes going deep inside a lighter rim
      vec2 hp = uv / uSkP.x;
      vec2 hfw2 = fwidth(hp);
      float hfw = max(hfw2.x, hfw2.y);
      vec4 hx = skHex(hp);
      float hid = fract(sin(dot(hx.zw, vec2(12.9898, 78.233))) * 43758.5453);
      float hk = 0.5 * (0.5 + 0.38 * fract(sin(dot(hx.zw, vec2(39.35, 11.13))) * 43758.5453));
      float hd = skHexD(hx.xy);
      float hole = step(hid, side ? uSkP.y : uSkP.z) * (1.0 - smoothstep(0.05, 0.12, hfw)) * (side ? skNearWall(skP) : 1.0);
      float inside = step(hd, hk) * hole, rim = step(hd, hk + 0.055) * hole * (1.0 - inside);
      albedo = mix(albedo, mix(uSkB, uSkC, smoothstep(hk * 0.15, hk, hd)), inside);
      albedo = mix(albedo, uColor * 1.04, rim);
      float px = hfw;
      float rings = max(skLine(abs(hd - hk * 0.72) / max(px, 1e-5)), skLine(abs(hd - hk * 0.46) / max(px, 1e-5)) * 0.8) * inside;
      skInk = max(course * 0.4 * (1.0 - inside), rings * 0.55);
      skInk = max(skInk, skLine(abs(hd - hk - 0.055) / max(px, 1e-5)) * hole * 0.5);
    }
  `,
  combFloor: /* glsl */ `
    vec3 skP = vWorldPos - uSkinO;
    float skInk = 0.0;
    vec3 albedo = uColor;
    {
      bool top = abs(n.y) > 0.65;
      vec2 uv = top ? skP.xz : vec2(abs(n.x) > abs(n.z) ? skP.z : skP.x, skP.y);
      vec2 hp = uv / uSkP.x, f2 = fwidth(hp);
      float fq = max(f2.x, f2.y);
      vec4 hx = skHex(hp);
      float hd = skHexD(hx.xy), id = fract(sin(dot(hx.zw, vec2(12.9898, 78.233))) * 43758.5453);
      float far = smoothstep(0.06, 0.16, fq);
      albedo = mix(mix(uSkA, uSkB, id), uColor, 0.45 + 0.55 * far);
      skInk = skLine((0.5 - hd) / max(fq, 1e-5)) * (1.0 - smoothstep(0.08, 0.16, fq)) * 0.7;
    }
  `,
  seal: /* glsl */ `
    vec3 skP = vWorldPos - uSkinO;
    float skInk = 0.0;
    vec3 albedo = uColor;
    {
      vec3 an = abs(n);
      vec2 uv = an.y > an.x && an.y > an.z ? skP.xz : (an.x > an.z ? skP.zy : skP.xy);
      vec2 q = uv / uSkP.x, fq = fwidth(q);
      vec2 vo = skVoronoi(q);
      albedo = mix(uColor, uSkB, 0.35 * vo.y) * (0.97 + 0.06 * vnoise(uv * 0.2));
      skInk = skNet(vo.x, max(fq.x, fq.y)) * uSkP.y;
    }
  `,
  membrane: /* glsl */ `
    vec3 skP = vWorldPos - uSkinO;
    float skInk = 0.0;
    vec3 albedo = uColor;
    {
      vec3 an = abs(n);
      vec2 uv = an.y > an.x && an.y > an.z ? skP.xz : (an.x > an.z ? skP.zy : skP.xy);
      vec2 q1 = uv / 0.7, q2 = uv / 2.4, f1 = fwidth(q1), f2 = fwidth(q2);
      vec2 v1 = skVoronoi(q1), v2 = skVoronoi(q2 + 9.0);
      albedo = mix(uColor, uSkA, 0.1 * v2.y);
      skInk = max(skNet(v1.x, max(f1.x, f1.y)) * 0.22, skNet(v2.x, max(f2.x, f2.y)) * 0.55);
    }
  `,
  paper: /* glsl */ `
    vec3 skP = vWorldPos - uSkinO;
    float skInk = 0.0;
    vec3 albedo = uColor;
    {
      // a wasp's paper: wavy courses of two greys and a cream round the nest, a pen line between, a few veins
      float yy = skP.y + (vnoise(skP.xz * 0.35) - 0.5) * 0.5, q = yy / 0.34, fq = fwidth(q);
      float k = floor(q), f = fract(q), t = fract(sin(k * 12.9898) * 43758.5453);
      albedo = t < 0.33 ? uColor : (t < 0.66 ? mix(uColor, uSkA, 0.35) : mix(uColor, uSkA, 0.6));
      skInk = skLine(min(f, 1.0 - f) / max(fq, 1e-5)) * (1.0 - smoothstep(0.2, 0.4, fq)) * 0.45;
    }
  `,
  flesh: /* glsl */ `
    vec3 skP = vWorldPos - uSkinO;
    float skInk = 0.0;
    vec3 albedo = uColor;
    {
      vec3 an = abs(n);
      vec2 uv = an.y > an.x && an.y > an.z ? skP.xz : (an.x > an.z ? skP.zy : skP.xy);
      vec2 q = uv / uSkP.y, fq = fwidth(q);
      if (uWearLite < 0.5) skInk = skNet(skVoronoi(q).x, max(fq.x, fq.y)) * 0.26;
    }
  `,
};

/** The surface material of a skin's pattern: makeMaterial's own, its albedo and first pen lines the pattern's. */
/** (the rooms' surfaces one-sided as the kit's own; the dressing's both: its instances' frames may be mirrored) */
function skinMaterial(body, look, pat, U, key) {
  const m = makeMaterial({ flat: true, ...look, color: pat.color, key: `temple.skin.${key}` });
  // (the house's rooms and origin, this build's: a material from the cache is pointed at them again)
  Object.assign(m.uniforms, { uSkinO: U.origin, uSkR: U.rooms, uSkY: U.roomsY, uSkN: U.count });
  if (m.userData.houseSkin) return m;
  m.userData.houseSkin = body;
  const fs = m.fragmentShader, at = fs.lastIndexOf('void main()');
  if (at < 0 || !fs.includes('vec3 albedo = uColor;') || !fs.includes('float detail = 0.0;')) throw new Error('skins.js: the surface shader changed: no albedo or detail line to replace');
  m.fragmentShader = SK_PARS + fs.slice(0, at) + SK_GLSL + fs.slice(at).replace('vec3 albedo = uColor;', BODIES[body]).replace('float detail = 0.0;', 'float detail = skInk;');
  Object.assign(m.uniforms, {
    uSkA: { value: new THREE.Color(pat.a ?? pat.color) }, uSkB: { value: new THREE.Color(pat.b ?? pat.color) }, uSkC: { value: new THREE.Color(pat.c ?? pat.color) },
    uSkP: { value: new THREE.Vector4(...(pat.size ?? [1, 1, 0]), 0) },
  });
  return m;
}

// ------------------------------------------------------------------ the dressing's shapes (unit sizes, scaled per instance)
/** A rib fin: y 0..1 up, x -0.5..0.5 across, z 0..1 out of the wall (its back sunk behind the face); a flared foot, a
 *  half-round body tapering to a point; coloured deep in its valleys and pale on its crest (vertex colours). */
function finGeometry(S) {
  const rows = [[0, 1.55, 1.35], [0.07, 1.06, 0.86], [0.55, 0.86, 0.66], [0.9, 0.46, 0.38], [1, 0.06, 0.05]];
  const seg = 5, P = [], C = [];
  const valley = new THREE.Color(S.valley), flank = new THREE.Color(S.color), crest = new THREE.Color(S.crest), c = new THREE.Color();
  const pt = (r, k) => { const [y, w, d] = rows[r], a = (k / seg) * Math.PI; return [-Math.cos(a) * w * 0.5, y, Math.sin(a) * d - 0.12 * (1 - Math.sin(a))]; };
  const col = (k) => { const s = Math.sin((k / seg) * Math.PI); return s < 0.5 ? c.copy(valley).lerp(flank, s * 2) : c.copy(flank).lerp(crest, (s - 0.5) * 2); };
  for (let r = 0; r < rows.length - 1; r++) for (let k = 0; k < seg; k++) {
    const a = pt(r, k), b = pt(r, k + 1), d = pt(r + 1, k), e = pt(r + 1, k + 1);
    for (const [p, kk] of [[a, k], [b, k + 1], [d, k], [b, k + 1], [e, k + 1], [d, k]]) { P.push(...p); col(kk); C.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.computeVertexNormals();
  return g;
}
/** A hooded hex cell, its front radius 1: a rim standing out of the wall (deeper at the top: its hood), its tunnel going in
 *  to a dark back of rings; z out of the wall, y up (vertex colours: the rim cream to the back's deep blue). */
function cellGeometry(S) {
  const P = [], C = [], col = (h) => new THREE.Color(h);
  const rim = col(S.rim), side = col(S.side), deep = col(S.deep), back = col(S.back), mid = deep.clone().lerp(back, 0.5);
  const hex = (r, z, k, hood = 0) => { const a = (k / 6) * TAU + Math.PI / 6, y = Math.sin(a); return [Math.cos(a) * r, y * r, z + Math.max(0, y) * hood]; };
  const quad = (a, b, c, d, ca, cb, cc, cd) => { for (const [p, q] of [[a, ca], [b, cb], [c, cc], [b, cb], [d, cd], [c, cc]]) { P.push(...p); C.push(q.r, q.g, q.b); } };
  const D = S.depth, H = D * 0.9;   // (the rim's front, and how much further its top stands out: the hood)
  for (let k = 0; k < 6; k++) {
    // the rim's outer side (from behind the wall's face out to its front), its front ring, the tunnel in, the back's rings
    quad(hex(1.28, -0.3, k), hex(1.28, -0.3, k + 1), hex(1.28, D, k, H), hex(1.28, D, k + 1, H), side, side, side, side);
    quad(hex(1.28, D, k, H), hex(1.28, D, k + 1, H), hex(1.0, D, k, H), hex(1.0, D, k + 1, H), rim, rim, rim, rim);
    quad(hex(1.0, D, k, H), hex(1.0, D, k + 1, H), hex(0.66, 0.06, k), hex(0.66, 0.06, k + 1), side, side, deep, deep);
    quad(hex(0.66, 0.06, k), hex(0.66, 0.06, k + 1), hex(0.0, 0.05, k), hex(0.0, 0.05, k + 1), mid, mid, back, back);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.computeVertexNormals();
  return g;
}
/** A unit triangle (0,0,0) (1,0,0) (0,1,0), mapped onto any three points by its instance's matrix: a membrane pane. */
function paneGeometry() {
  const g = new THREE.BufferGeometry();
  // (a few rows, so the pane sags a little toward its free corner)
  const P = [], n = 4, at = (i, j) => [i / n, j / n, -0.06 * Math.sin((i / n) * Math.PI) * Math.sin((j / n) * Math.PI) * 4];
  for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
    P.push(...at(i, j), ...at(i + 1, j), ...at(i, j + 1));
    if (i + j < n - 1) P.push(...at(i + 1, j), ...at(i + 1, j + 1), ...at(i, j + 1));
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return g;
}
/** The papery nest mouth round an oculus of radius 1: three scalloped skirts hanging from the ceiling, flaring down. */
function nestGeometry() {
  const parts = [], seg = 28;
  for (let s = 0; s < 3; s++) {
    const P = [], top = 0, r0 = 1.08 + s * 0.2, r1 = 1.45 + s * 0.4, y1 = -0.5 - s * 0.3;
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * TAU, a1 = ((k + 1) / seg) * TAU;
      const sc = (a) => 1 + 0.06 * Math.cos(a * 9 + s * 1.7);
      const ring = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
      const A = ring(a0, r0, top), B = ring(a1, r0, top), Cc = ring(a0, r1 * sc(a0), y1 * sc(a0 + 0.5)), Dd = ring(a1, r1 * sc(a1), y1 * sc(a1 + 0.5));
      P.push(...A, ...Cc, ...B, ...B, ...Cc, ...Dd);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    parts.push(g);
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}
/** A pore: a flattened lens, its dome down out of the plate (radius 1). */
const poreGeometry = () => new THREE.SphereGeometry(1, 8, 2, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI).scale(1, 0.35, 1).toNonIndexed();
/** A seed capsule: a ribbed pod (radius 1, 2.2 high from its stem's top), its tip pointed. */
function capsuleGeometry(seg = 10, rows = 6) {
  const P = [], R = (t) => Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 - 0.15 * t), rib = (a) => 1 + 0.09 * Math.cos(a * 8);
  const at = (t, a) => { const r = R(t) * rib(a); return [Math.cos(a) * r, t * 2.2, Math.sin(a) * r]; };
  for (let i = 0; i < rows; i++) for (let k = 0; k < seg; k++) {
    const t0 = i / rows, t1 = (i + 1) / rows, a0 = (k / seg) * TAU, a1 = ((k + 1) / seg) * TAU;
    P.push(...at(t0, a0), ...at(t1, a0), ...at(t0, a1), ...at(t0, a1), ...at(t1, a0), ...at(t1, a1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return g;
}
/** A tall fleshy stalk, 1 high: a flared foot, a thin stem, a collar at the top where its capsule sits. */
const stalkGeometry = () => new THREE.LatheGeometry([[0.9, 0], [0.45, 0.018], [0.2, 0.06], [0.13, 0.5], [0.12, 0.93], [0.28, 0.985], [0.01, 1.002]].map(([r, y]) => new THREE.Vector2(r, y)), 8).toNonIndexed();

// ------------------------------------------------------------------ placing the dressing
/** An instanced, drawn-only mesh of the dressing: walked through, never buried, never casting a shadow. */
function instanced(name, geo, mat, list, frame) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  m.name = name; m.count = list.length;
  list.forEach((l, i) => m.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(frame, l)));
  m.instanceMatrix.needsUpdate = true;
  m.userData.noCollide = true; m.userData.keepBuried = true; m.userData.skin = true;
  // (one draw a pass for the whole house's, never cut into tiles nor given levels of detail: perf.js, lod.js; the main
  // thread is the limit on the Deck and the Xbox, and these are a few thousand triangles each)
  m.userData.dynamic = true;
  m.castShadow = false; m.receiveShadow = true;
  m.userData.castShadow = false;   // (out of every shadow pass: shadows.js draws all but those that opt out)
  m.computeBoundingSphere();
  return m;
}
/** A matrix from a basis (x across, y up the piece, z out of the wall) at p. */
const basis = (p, x, y, z) => new THREE.Matrix4().makeBasis(x, y, z).setPosition(p);

/** A box keeping the dressing off something (local metres). */
class Keep {
  constructor() { this.cells = new Map(); this.size = 4; }
  key(i, j, k) { return `${i},${j},${k}`; }
  add(b) {
    const s = this.size;
    if (!Number.isFinite(b.min.x + b.max.x + b.min.y + b.max.y + b.min.z + b.max.z)) return;
    for (let i = Math.floor(b.min.x / s); i <= Math.floor(b.max.x / s); i++) for (let j = Math.floor(b.min.y / s); j <= Math.floor(b.max.y / s); j++) for (let k = Math.floor(b.min.z / s); k <= Math.floor(b.max.z / s); k++) {
      const key = this.key(i, j, k);
      if (!this.cells.has(key)) this.cells.set(key, []);
      this.cells.get(key).push(b);
    }
  }
  /** The boxes that overlap b, each once. */
  query(b) {
    const s = this.size, found = new Set();
    for (let i = Math.floor(b.min.x / s); i <= Math.floor(b.max.x / s); i++) for (let j = Math.floor(b.min.y / s); j <= Math.floor(b.max.y / s); j++) for (let k = Math.floor(b.min.z / s); k <= Math.floor(b.max.z / s); k++) {
      for (const o of this.cells.get(this.key(i, j, k)) ?? []) if (o.intersectsBox(b)) found.add(o);
    }
    return [...found];
  }
  hits(b) {
    const s = this.size;
    for (let i = Math.floor(b.min.x / s); i <= Math.floor(b.max.x / s); i++) for (let j = Math.floor(b.min.y / s); j <= Math.floor(b.max.y / s); j++) for (let k = Math.floor(b.min.z / s); k <= Math.floor(b.max.z / s); k++) {
      for (const o of this.cells.get(this.key(i, j, k)) ?? []) if (o.intersectsBox(b)) return true;
    }
    return false;
  }
}
/** Every small thing drawn on the walls and every piece, as boxes in the kit's frame: what the dressing keeps off. */
function keepOuts(rt, surfaces) {
  const K = rt.kit, keep = new Keep(), b = new THREE.Box3();
  const local = (box) => box.clone().applyMatrix4(K.inv);
  keep.slabs = new Keep();
  for (const [mat, list] of K.batches) {
    // (a floor or a ledge: kept off in its own height, by what lies on a wall: a cell cut by the loft's floor)
    if (mat === rt.M.floor) for (const g of list) { g.computeBoundingBox(); const l = local(g.boundingBox); if (l.max.y - l.min.y < 1.6) keep.slabs.add(l.expandByScalar(0.25)); }
    if (surfaces.has(mat)) continue;
    for (const g of list) {
      g.computeBoundingBox();
      const l = local(g.boundingBox), s = l.getSize(V());
      if (Math.max(s.x, s.z) < 10.5 && !(s.x > 6 && s.z > 6)) keep.add(l.expandByScalar(0.3));   // (not a floor's slab, a wall's cap or a whole ring)
    }
  }
  for (const p of rt.pieces) {
    const o = p.group ?? p.mesh ?? p.root;
    // (a piece's own body, kept clear; one that reaches across a room, a draught's column, by its middle alone)
    if (o?.isObject3D) { b.setFromObject(o); const l = local(b), s = l.getSize(V()); if (!l.isEmpty() && Math.max(s.x, s.z) < 14 && s.y < 30) keep.add(l.expandByScalar(0.8)); }
    for (const q of [p.pos, p.center]) if (q?.isVector3) keep.add(new THREE.Box3().setFromCenterAndSize(K.local(q), V(3, 3, 3)));
  }
  return keep;
}

/** The kit's rooms (local): halls, round rooms and passages, with their floors and ceilings. */
function roomsOf(plan) {
  const out = [];
  for (const e of plan) {
    if (e.kind === 'hall') out.push({ kind: 'hall', x: e.x, z: e.z, hx: e.w / 2, hz: e.d / 2, y0: e.y, y1: e.y + e.h, floor: e.floor, roof: e.roof, oculus: e.oculus, e });
    else if (e.kind === 'round') out.push({ kind: 'round', x: e.x, z: e.z, r: e.r, y0: e.y, y1: e.y + e.h, floor: e.floor, oculus: e.oculus, e });
    else if (e.kind === 'corridor') out.push({ kind: 'corridor', x: (e.x0 + e.x1) / 2, z: (e.z0 + e.z1) / 2, hx: (e.x1 - e.x0) / 2, hz: (e.z1 - e.z0) / 2, y0: e.y, y1: e.y + e.h, e });
  }
  return out;
}
const inRoom = (R, x, y, z) => y >= R.y0 - 0.5 && y <= R.y1 + 0.5 && (R.kind === 'round' ? Math.hypot(x - R.x, z - R.z) < R.r - 0.2 : Math.abs(x - R.x) < R.hx - 0.1 && Math.abs(z - R.z) < R.hz - 0.1);

/** The skin's hash: the same dressing every build. */
function rand(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }

/**
 * The places along every wall face (the kit's straight walls and round rooms) a fin or a cell may stand: each face's
 * frame and its room, as segments { o (a point on the face at its foot), t (along), nrm (into the room), L, y0, y1,
 * holes [{ x0, x1, y0, y1 }] (m along, up from the floor of the room), round }.
 */
function faces(plan, rooms) {
  const out = [];
  for (const e of plan) {
    if (e.kind === 'wall') {
      const t = V(e.dir[0], 0, e.dir[1]);
      for (const side of [1, -1]) {
        const nrm = V(e.dir[1], 0, -e.dir[0]).multiplyScalar(side);
        // which room this face looks into, piece by piece along it (a wall between two halls has a room each side)
        const o = V(e.a[0], e.y0, e.a[1]).addScaledVector(nrm, e.t / 2);
        let cur = null, from = 0;
        const flush = (to) => { if (cur && to - from > 1.5) out.push({ o, t, nrm, s0: from, s1: to, room: cur, y0: Math.max(e.y0, cur.y0), y1: Math.min(e.y0 + e.h, cur.y1), holes: e.holes.map((h) => ({ x0: h.x0, x1: h.x1, y0: e.y0 + h.y0, y1: e.y0 + h.y1 })) }); };
        for (let s = 0.25; s <= e.L; s += 0.5) {
          const p = o.clone().addScaledVector(t, s).addScaledVector(nrm, 1.0);
          const R = rooms.find((r) => r.kind !== 'corridor' && [1.5, 4, 8].some((dy) => inRoom(r, p.x, Math.max(e.y0, r.y0) + dy, p.z)))
            ?? rooms.find((r) => [1.5, 3].some((dy) => inRoom(r, p.x, Math.max(e.y0, r.y0) + dy, p.z)));
          if (R !== cur) { flush(s); cur = R ?? null; from = s; }
        }
        flush(e.L);
      }
    } else if (e.kind === 'round') {
      out.push({ round: e, room: rooms.find((r) => r.e === e), y0: e.y, y1: e.y + e.h });
    }
  }
  return out;
}

// ------------------------------------------------------------------ the two skins' dressing
/** The cactus's: rib fins up the walls, ribs across the ceilings, a plate of pores in each oculus, seed-capsule lamps. */
function dressCactus(rt, S, mats, keep, plan, rooms, out) {
  const fins = [], ribs = [], pores = [], plates = [], stalks = [], capsules = [], lit = [];
  const F = S.fin, R = S.rib, rnd = rand(342);
  const clear = (c, half) => !keep.hits(new THREE.Box3(c.clone().sub(half), c.clone().add(half)));
  /**
   * A rib up the wall at foot p (on the face, its back sunk in), from y0 to y1: what stands on the wall in its way (a
   * frieze's glyph, a doorway's frame, a window) cuts it in two, a fin rising from the floor and one hanging from the
   * ceiling, their tips short of it (the glyph between them); `blocked` [[y0, y1]] more of the same (a doorway).
   */
  const rib = (p, t, nrm, y0, y1, blocked = []) => {
    const hw = F.width / 2 + 0.15, c = p.clone().addScaledVector(nrm, F.depth / 2 + 0.1);
    const foot = new THREE.Box3(V(c.x - hw, y0, c.z - hw), V(c.x + hw, y1, c.z + hw));
    const cuts = [...blocked, ...keep.query(foot).map((o) => [o.min.y, o.max.y])];
    let lo = y1, hi = y0;
    for (const [u0, u1] of cuts) { lo = Math.min(lo, u0); hi = Math.max(hi, u1); }
    const tx = t.clone().multiplyScalar(F.width), tz = nrm.clone().multiplyScalar(F.depth);
    if (!cuts.length) { fins.push(basis(p.clone().setY(y0), tx, V(0, y1 - y0, 0), tz)); return 1; }
    let n = 0;
    if (lo - 0.35 - y0 >= 3) { fins.push(basis(p.clone().setY(y0), tx, V(0, lo - 0.35 - y0, 0), tz)); n++; }
    if (y1 - hi - 0.35 >= 2.5) { fins.push(basis(p.clone().setY(y1), tx, V(0, -(y1 - hi - 0.35), 0), tz)); n++; }
    return n;
  };
  for (const f of faces(plan, rooms)) {
    if (f.round) {
      const e = f.round, step = TAU / e.seg, gaps = e.gaps ?? [];
      for (let i = 0; i < e.seg; i += F.round) {
        const a = i * step;
        const doors = gaps.filter((g) => Math.abs(Math.atan2(Math.sin(a - g.a), Math.cos(a - g.a))) * e.r < g.w / 2 + 1.6).map((g) => [e.y + (g.y0 ?? 0) - 0.5, e.y + (g.y0 ?? 0) + g.h + 1.2]);
        const out_ = V(Math.sin(a), 0, Math.cos(a)), nrm = out_.clone().negate(), t = V(Math.cos(a), 0, -Math.sin(a));
        rib(V(e.x, 0, e.z).addScaledVector(out_, e.r + 0.14), t, nrm, e.y, e.y + e.h - 0.55, doors);
        // and its rib across the ceiling, to the oculus
        if (e.oculus > 0 && (i / F.round) % R.every === 0) {
          const r1 = e.r - 0.2, r0 = e.r * e.oculus + 0.45, len = r1 - r0;
          if (len > 1.5) ribs.push(basis(V(e.x, e.y + e.h + 0.14, e.z).addScaledVector(out_, r1), t.clone().multiplyScalar(R.width), nrm.clone().multiplyScalar(len), V(0, -R.depth, 0)));
        }
      }
      continue;
    }
    if (!f.room || f.y1 - f.y0 < 5) continue;
    // (on the shader's crests: the world's coordinate along the wall over the pleat, cactusWall, a half pleat on)
    const along0 = Math.abs(f.t.x) > 0.5 ? f.o.x : f.o.z, sign = Math.abs(f.t.x) > 0.5 ? Math.sign(f.t.x) : Math.sign(f.t.z);
    let first = ((0.5 * F.every - along0) * sign) % F.every;
    while (first < f.s0 + 1.2) first += F.every;
    for (let s = first; s <= f.s1 - 1.2; s += F.every) {
      const doors = f.holes.filter((h) => s > h.x0 - 1.7 && s < h.x1 + 1.7).map((h) => [h.y0 - 0.5, h.y1 + 1.2]);
      rib(f.o.clone().addScaledVector(f.t, s).addScaledVector(f.nrm, -0.14), f.t, f.nrm, f.y0, f.y1 - 0.55, doors);
    }
  }
  // the halls' ceilings: ribs from the walls in to the oculus (or the middle), converging on it
  for (const r of rooms) {
    if (r.kind !== 'hall' || !r.roof) continue;
    const oc = r.roof === 'oculus' ? r.oculus : 0, ox = r.hx * oc, oz = r.hz * oc, y = r.y1 + 0.14, n = 20;
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * TAU, d = V(Math.cos(a), 0, Math.sin(a));
      const tw = Math.min(r.hx / Math.abs(d.x || 1e-6), r.hz / Math.abs(d.z || 1e-6)) - 0.25;   // to the walls
      const ti = oc ? Math.min(ox / Math.abs(d.x || 1e-6), oz / Math.abs(d.z || 1e-6)) + 0.45 : 2.5;
      if (tw - ti < 2) continue;
      const p = V(r.x, y, r.z).addScaledVector(d, tw), inward = d.clone().negate();
      ribs.push(basis(p, V(-d.z, 0, d.x).multiplyScalar(R.width), inward.multiplyScalar(tw - ti), V(0, -R.depth, 0)));
    }
    if (oc) {
      // a plate of pores in the oculus, turquoise light through them
      plates.push(basis(V(r.x, r.y1 + 0.45, r.z), V(ox * 2 + 0.6, 0, 0), V(0, 0.1, 0), V(0, 0, oz * 2 + 0.6)));
      porePlate(pores, rnd, r.x, r.y1 + 0.4, r.z, (u, v) => Math.abs(u) < ox - 0.35 && Math.abs(v) < oz - 0.35, Math.max(ox, oz));
    }
  }
  for (const r of rooms) {
    if (r.kind !== 'round' || !(r.oculus > 0)) continue;
    const ro = r.r * r.oculus;
    plates.push(basis(V(r.x, r.y1 + 0.45, r.z), V(ro * 2 + 0.6, 0, 0), V(0, 0.1, 0), V(0, 0, ro * 2 + 0.6)));
    porePlate(pores, rnd, r.x, r.y1 + 0.4, r.z, (u, v) => Math.hypot(u, v) < ro - 0.35, ro);
  }
  // seed-capsule lamps on tall stalks, a few in each room with a floor, near its walls
  for (const r of rooms) {
    if (r.kind === 'corridor' || r.floor === false && r.kind === 'hall') continue;
    const H = r.y1 - r.y0;
    if (H < 11) continue;
    let placed = 0;
    for (let k = 0; k < 40 && placed < S.lamp.count; k++) {
      let p;
      if (r.kind === 'round') { const a = rnd() * TAU; p = V(r.x + Math.sin(a) * (r.r - 1.9), r.y0, r.z + Math.cos(a) * (r.r - 1.9)); }
      else { const side = Math.floor(rnd() * 4), u = rnd() * 2 - 1; p = side < 2 ? V(r.x + u * (r.hx - 4), r.y0, r.z + (side ? 1 : -1) * (r.hz - 1.9)) : V(r.x + (side === 2 ? 1 : -1) * (r.hx - 1.9), r.y0, r.z + u * (r.hz - 4)); }
      const h = H * (0.42 + rnd() * 0.18), s = 0.85 + rnd() * 0.35;
      if (!clear(p.clone().setY(r.y0 + h / 2 + 1), V(1.4, h / 2 + 1.4, 1.4))) continue;
      if (stalks.some((m) => V().setFromMatrixPosition(m).distanceTo(p) < 7)) continue;
      stalks.push(basis(p, V(s, 0, 0), V(0, h, 0), V(0, 0, s)));
      const cap = basis(p.clone().setY(r.y0 + h - 0.05), V(0.85 * s, 0, 0), V(0, 0.85 * s, 0), V(0, 0, 0.85 * s));
      (placed % 3 === 1 ? lit : capsules).push(cap);
      keep.add(new THREE.Box3().setFromCenterAndSize(p.clone().setY(r.y0 + h / 2), V(2, h, 2)));
      placed++;
    }
  }
  const K = rt.kit;
  out.push(instanced('skin: rib fins', finGeometry(F), mats.fin, fins, K.frame));
  const rm = instanced('skin: ceiling ribs', finGeometry(F), mats.fin, ribs, K.frame); rm.userData.skinFine = true; out.push(rm);
  out.push(instanced('skin: pore plates', new THREE.BoxGeometry(1, 1, 1).toNonIndexed(), mats.plate, plates, K.frame));
  out.push(instanced('skin: pores', poreGeometry(), mats.pore, pores, K.frame));
  out.push(instanced('skin: stalks', stalkGeometry(), mats.stalk, stalks, K.frame));
  out.push(instanced('skin: seed capsules', capsuleGeometry(), mats.capsule, capsules, K.frame));
  out.push(instanced('skin: lit seed capsules', capsuleGeometry(), mats.capsuleLit, lit, K.frame));
  return { fins: fins.length, ribs: ribs.length, pores: pores.length, lamps: stalks.length };
}
/** A cluster of pores in an oculus's plate at (x, y, z): in(u, v) says what lies inside it; size its half width. */
function porePlate(pores, rnd, x, y, z, inside, size) {
  const placed = [];
  for (let k = 0; k < 220 && placed.length < 26; k++) {
    const u = (rnd() * 2 - 1) * size, v = (rnd() * 2 - 1) * size, r = 0.3 + rnd() * rnd() * 0.85;
    if (!inside(u, v) || !inside(u + Math.sign(u) * r, v + Math.sign(v) * r)) continue;
    if (placed.some(([pu, pv, pr]) => Math.hypot(u - pu, v - pv) < r + pr + 0.18)) continue;
    placed.push([u, v, r]);
    pores.push(basis(V(x + u, y, z + v), V(r, 0, 0), V(0, r, 0), V(0, 0, r)));
  }
}

/** The comb's: hooded hex cells on the walls, wing-pane membranes high under the ceilings, a nest mouth round each oculus. */
function dressComb(rt, S, mats, keep, plan, rooms, out) {
  const big = [], small = [], panes = [], nests = [];
  const C = S.cell, rnd = rand(342);
  const cells = [];   // (each cell's centre and radius, to keep them apart)
  const tryCell = (p, t, nrm, r) => {
    const reach = r * 1.3 + 0.2;
    if (cells.some(([q, rq]) => q.distanceTo(p) < reach + rq * 1.3 + 0.35)) return false;
    const c = p.clone().addScaledVector(nrm, 0.35), box = new THREE.Box3().setFromCenterAndSize(c, V(reach * 2 + 0.4, reach * 2 + 0.4, reach * 2 + 0.4));
    if (keep.hits(box) || keep.slabs?.hits(box)) return false;
    cells.push([p, r]);
    (r < 0.9 ? small : big).push(basis(p, t.clone().multiplyScalar(r), V(0, r, 0), nrm.clone().multiplyScalar(0.6 + 0.4 * r)));
    return true;
  };
  const size = () => C.min + (C.max - C.min) * Math.pow(rnd(), 1.6);
  // (the eyes to strike: no dark cell on the walls round one at its height, so it reads against plain comb)
  const eyes = rt.pieces.filter((p) => p.constructor.name === 'Switch' && p.group).map((p) => rt.kit.local(p.group.position));
  const nearEye = (R, y, r) => eyes.some((q) => Math.abs(q.y - y) < r + 3 && (R.kind === 'round' ? Math.hypot(q.x - R.x, q.z - R.z) < R.r : Math.abs(q.x - R.x) < R.hx && Math.abs(q.z - R.z) < R.hz) && q.y > R.y0 - 1 && q.y < R.y1 + 1);
  for (const f of faces(plan, rooms)) {
    if (f.round) {
      const e = f.round, n = Math.round(TAU * e.r * e.h * C.density);
      for (let k = 0; k < n * 3 && n > 0; k++) {
        const a = rnd() * TAU, r = size(), y = e.y + 1.2 + r + rnd() * (e.h - 2.6 - 2 * r);
        if (f.room && nearEye(f.room, y, r)) continue;
        if ((e.gaps ?? []).some((g) => Math.abs(Math.atan2(Math.sin(a - g.a), Math.cos(a - g.a))) * e.r < g.w / 2 + r + 1.4 && y > e.y + (g.y0 ?? 0) - r - 1 && y < e.y + (g.y0 ?? 0) + g.h + r + 1.2)) continue;
        const out_ = V(Math.sin(a), 0, Math.cos(a));
        // (its back on the wall's face: a stone's inner face is nearer the middle at its centre than at its joints)
        const face = e.r * Math.cos(Math.PI / e.seg) - 0.02;
        tryCell(V(e.x, y, e.z).addScaledVector(out_, face), V(Math.cos(a), 0, -Math.sin(a)).negate(), out_.clone().negate(), r);
      }
      continue;
    }
    if (!f.room || f.y1 - f.y0 < 4) continue;
    const L = f.s1 - f.s0, H = f.y1 - f.y0, n = Math.round(L * H * C.density);
    for (let k = 0; k < n * 3 && n > 0; k++) {
      const r = size(), s = f.s0 + r + 0.6 + rnd() * (L - 2 * r - 1.2), y = f.y0 + 1.2 + r + rnd() * (H - 2.6 - 2 * r);
      if (!(L - 2 * r - 1.2 > 0) || !(H - 2.6 - 2 * r > 0)) continue;
      if (f.holes.some((h) => s > h.x0 - r - 1.5 && s < h.x1 + r + 1.5 && y > h.y0 - r - 1 && y < h.y1 + r + 1.2)) continue;
      if (nearEye(f.room, y, r)) continue;
      tryCell(f.o.clone().addScaledVector(f.t, s).setY(y).addScaledVector(f.nrm, -0.01), f.t.clone().negate(), f.nrm, r);
    }
  }
  // membranes: wing panes high round the tall rooms, from the wall under the ceiling down and in
  for (const r of rooms) {
    const H = r.y1 - r.y0;
    if (r.kind === 'corridor' || H < 16 || (r.kind === 'round' ? r.r : Math.min(r.hx, r.hz)) < 13) { if (r.kind === 'round' && r.oculus > 0 && H >= 16) nests.push(basis(V(r.x, r.y1 + 0.3, r.z), V(r.r * r.oculus, 0, 0), V(0, r.r * r.oculus * 0.85, 0), V(0, 0, r.r * r.oculus))); continue; }
    const k = S.membrane.panes, top = r.y1 - 0.6;
    for (let i = 0; i < k; i++) {
      const a0 = ((i + 0.15 + rnd() * 0.2) / k) * TAU, a1 = a0 + (TAU / k) * (0.45 + rnd() * 0.2), am = (a0 + a1) / 2;
      const wall = (a, inset) => r.kind === 'round' ? V(r.x + Math.sin(a) * (r.r - inset), 0, r.z + Math.cos(a) * (r.r - inset))
        : (() => { const d = V(Math.sin(a), 0, Math.cos(a)), t = Math.min(r.hx / Math.abs(d.x || 1e-6), r.hz / Math.abs(d.z || 1e-6)); return V(r.x, 0, r.z).addScaledVector(d, t - inset); })();
      const A = wall(a0, 0.25).setY(top), B = wall(a1, 0.25).setY(top - 1.5 - rnd() * 2), Cc = wall(am, 4.2 + rnd() * 2).setY(top - 6 - rnd() * 3);
      const box = new THREE.Box3().setFromPoints([A, B, Cc]);
      if (keep.hits(box)) continue;
      panes.push(new THREE.Matrix4().makeBasis(B.clone().sub(A), Cc.clone().sub(A), B.clone().sub(A).cross(Cc.clone().sub(A)).normalize().multiplyScalar(0.3)).setPosition(A));
    }
    // the nest mouth round its oculus
    if (r.kind === 'round' && r.oculus > 0) { const ro = r.r * r.oculus; nests.push(basis(V(r.x, r.y1 + 0.3, r.z), V(ro, 0, 0), V(0, ro * 0.85, 0), V(0, 0, ro))); }
  }
  const K = rt.kit;
  out.push(instanced('skin: hooded cells', cellGeometry(C), mats.cell, big, K.frame));
  const sm = instanced('skin: small cells', cellGeometry(C), mats.cell, small, K.frame); sm.userData.skinFine = true; out.push(sm);
  out.push(instanced('skin: membranes', paneGeometry(), mats.membrane, panes, K.frame));
  out.push(instanced('skin: nest mouths', nestGeometry(), mats.nest, nests, K.frame));
  return { cells: big.length + small.length, panes: panes.length, nests: nests.length };
}

// ------------------------------------------------------------------ the skin's braziers
/** A brazier in the cactus: the hooded bowl in flesh on its fleshy stem, a ribbed seed capsule over the coals. */
function cactusBrazier(S, mats, piece, s) {
  const g = piece.group;
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)), seg);
  const flat = (geo) => (geo.index ? geo.toNonIndexed() : geo);
  // (the stem's footprint as the bronze one's: what you stand by is the same)
  const stem = lathe([[0.7, 0], [0.7, 0.2], [0.35, 0.4], [0.28, 0.85], [0.42, 1.05], [0.55, 1.2]].map(([r, y]) => [r * s, y * s]), 12);
  const bowl = lathe([[0.25, 0], [0.5, 0.15], [0.9, 0.55], [1.1, 0.95], [1.0, 1.0], [0.75, 0.62], [0.2, 0.55]].map(([r, y]) => [r * s, y * s + 1.1 * s]), 16);
  const parts = [flat(stem), flat(bowl)];
  if (piece.o.hood) parts.push(flat(new THREE.SphereGeometry(1.25 * s, 16, 8, Math.PI * 0.75, Math.PI * 1.5, 0.45, Math.PI / 2 - 0.45).translate(0, 1.62 * s, 0)));
  for (const p of parts) for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal') p.deleteAttribute(k);
  g.add(new THREE.Mesh(mergeGeometries(parts), mats.braFlesh));
  // (the makers' glyph on the hood's back, as on the stone one)
  if (piece.o.hood) g.add(new THREE.Mesh(glyphGeometry(0.8 * s, 0.05).rotateY(Math.PI).translate(0, 2.35 * s, -0.95 * s), piece.rt.M.trimMat));
  // the seed capsule over the hood's crown on a short fleshy stalk: wine glass, amber once lit (the fire under it)
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.11 * s, 1.5 * s, 6).translate(-0.62 * s, 2.55 * s, -0.25 * s).toNonIndexed(), mats.braFlesh));
  const cap = new THREE.Mesh(capsuleGeometry(14, 9).scale(0.55 * s, 0.72 * s, 0.55 * s).translate(0, 2.95 * s, 0), mats.braGlass.clone());
  cap.name = 'seed capsule';
  g.add(cap);
  piece.skinCapsule = cap;
  return true;
}

// ------------------------------------------------------------------ the house's skin
/**
 * The skin of the house rt builds (its def's `skin`), or null: its surfaces swapped into rt.M (the kit shares it), the kit's
 * plan recording. Called before def.layout(rt).
 */
export function houseSkin(rt) {
  const name = rt.def.skin;
  const S = SKINS[name];
  // (globalThis.__noHouseSkin: the house as it was, for a bench's before and after in one page load)
  if (!S || globalThis.__noHouseSkin) return null;
  const K = rt.kit, M = rt.M, P = rt.def.palette ?? {}, id = rt.def.id;
  const U = {
    origin: { value: K.origin.clone() },
    rooms: { value: Array.from({ length: SKIN_ROOMS }, () => new THREE.Vector4()) },
    roomsY: { value: Array.from({ length: SKIN_ROOMS }, () => new THREE.Vector4()) },
    count: { value: 0 },
  };
  const look = P.look?.all ?? {};
  const was = { wall: M.wall, wallGlyph: M.wallGlyph, floor: M.floor, bands: M.bands };
  const mats = {};
  if (name === 'cactus') {
    mats.wall = skinMaterial('cactusWall', look, S.wall, U, `${id}.wall`);
    mats.wallGlyph = skinMaterial('seal', { ...look, glyphs: 2.2 }, S.wallGlyph, U, `${id}.wallGlyph`);
    mats.floor = skinMaterial('cactusFloor', look, S.floor, U, `${id}.floor`);
    mats.fin = skinMaterial('flesh', { ...look, vertexColors: true, side: THREE.DoubleSide }, { color: '#ffffff', size: [1, S.fin.crackle, 0] }, U, `${id}.fin`);
    mats.fin.vertexColors = true;
    mats.plate = skinMaterial('flesh', { ...look, side: THREE.DoubleSide }, { color: S.plate.color, size: [1, 0.4, 0] }, U, `${id}.plate`);
    mats.stalk = skinMaterial('flesh', { ...look, side: THREE.DoubleSide }, { color: S.lamp.stalk, size: [1, 0.35, 0] }, U, `${id}.stalk`);
    mats.braFlesh = skinMaterial('flesh', look, { color: S.brazier.flesh, size: [1, 0.3, 0] }, U, `${id}.brazier`);
    const own = (k, o) => makeMaterial({ flat: true, side: THREE.DoubleSide, ...o, key: `temple.skin.${id}.${k}` });
    mats.pore = own('pore', { color: S.pore.color, glow: S.pore.glow });
    mats.capsule = own('capsule', { color: S.lamp.glass, glow: 0.3, shade: 0.3, metal: 'painted', refl: 0.6, highlight: 0.25 });
    mats.capsuleLit = own('capsuleLit', { color: S.lamp.lit, glow: 0.7 });
    mats.braGlass = makeMaterial({ color: S.brazier.glass, glow: 0.3, flat: true, metal: 'painted', refl: 0.6, highlight: 0.25, key: `temple.skin.${id}.braGlass` });
  } else {
    mats.wall = skinMaterial('combWall', look, S.wall, U, `${id}.wall`);
    mats.wallGlyph = skinMaterial('seal', { ...look, glyphs: 1.6 }, S.wallGlyph, U, `${id}.wallGlyph`);
    mats.floor = skinMaterial('combFloor', look, S.floor, U, `${id}.floor`);
    mats.cell = makeMaterial({ ...look, color: '#ffffff', vertexColors: true, flat: true, side: THREE.DoubleSide, key: `temple.skin.${id}.cell` });
    mats.cell.vertexColors = true;
    mats.membrane = skinMaterial('membrane', { ...look, hatch: 0.3, side: THREE.DoubleSide }, { color: S.membrane.color, a: S.membrane.vein }, U, `${id}.membrane`);
    mats.nest = skinMaterial('paper', { ...look, hatch: 0.3, side: THREE.DoubleSide }, { color: S.nest.color, a: S.nest.grey }, U, `${id}.nest`);
  }
  Object.assign(M, { wall: mats.wall, wallGlyph: mats.wallGlyph, floor: mats.floor });
  if (!S.bands) M.bands = [];
  K.plan = [];
  const meshes = [];
  const skin = {
    name, S, mats, meshes, stats: null,
    /** A brazier's own look (pieces.js Brazier): true when the skin drew it. */
    brazier: name === 'cactus' ? (piece, s) => cactusBrazier(S, mats, piece, s) : null,
    /** A brazier lit (pieces.js Brazier ignite): its capsule glows. */
    lit(piece) { const m = piece.skinCapsule?.material; if (m) { m.uniforms.uColor.value.set(S.brazier.lit); m.uniforms.uGlow.value = 0.8; } },
    /** After the layout: the rooms handed to the shader, the dressing placed and added. */
    dress() {
      const t0 = performance.now(), plan = K.plan, rooms = roomsOf(plan);
      const list = [...rooms.filter((r) => r.kind === 'round'), ...rooms.filter((r) => r.kind === 'hall'), ...rooms.filter((r) => r.kind === 'corridor')].slice(0, SKIN_ROOMS);
      list.forEach((r, i) => {
        U.rooms.value[i].set(r.x, r.z, r.kind === 'round' ? r.r : r.hx, r.kind === 'round' ? -1 : r.hz);
        // (a round room's pleats: one between each two of its fins, a crest on each, cactusWall's skAlong)
        const np = name === 'cactus' && r.kind === 'round' ? r.e.seg / S.fin.round : 0;
        U.roomsY.value[i].set(r.y0, r.y1, np, np ? 0.5 - ((np / 4) % 1) : 0);
      });
      U.count.value = list.length;
      const keep = keepOuts(rt, new Set([mats.wall, mats.wallGlyph, mats.floor, M.sand]));
      skin.stats = { ...(name === 'cactus' ? dressCactus : dressComb)(rt, S, mats, keep, plan, rooms, meshes), ms: Math.round(performance.now() - t0) };
      for (const m of meshes) K.group.add(m);
      rt.pieces.push(new SkinDetail(meshes));
    },
    /** After the kit's flush: the house's own materials back for its exterior. */
    done() { Object.assign(M, was); K.plan = null; },
  };
  rt.skin = skin;
  return skin;
}

/** The finest dressing hidden on the lighter presets (uWearLite: Low, Handheld, the Steam Deck), as the shader's crackle is. */
class SkinDetail {
  constructor(meshes) { this.fine = meshes.filter((m) => m.userData.skinFine); }
  update() { const on = sharedUniforms.uWearLite.value < 0.5; for (const m of this.fine) if (m.visible !== on) m.visible = on; }
}
