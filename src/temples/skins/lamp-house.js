import * as THREE from 'three';
import { makeMaterial, sharedUniforms } from '../../materials.js';
import { LightShaft } from '../../veil.js';
import { Switch, LightEar, Bridge } from '../pieces.js';
import { paint } from '../kit.js';
import { cyl, cone, box as gbox, torus, merge as gmerge } from '../../wildlife/geo.js';

// ---------------------------------------------------------------------------
// The Lamp-House's futuristic skin (issue #342, docs/systems/temples.md "Futuristic skins"): the makers' lamp-house drawn
// as the author's picked reference (references/temples/future/lamp-house/sheet-1.jpg) has it, a near-black test chamber
// of dark slate and metal where light wakes what waits for it, over its rooms as they are: the same rooms, doors,
// collision, pieces, positions, timings and logic (tests/temple-skins.test.js).
//   1. surfaces (the surface shader's albedo and first pen lines replaced, as landmark-materials.js stone() does): the
//      walls tall blue-black slabs with chamfered edges (a lit and a shaded lip) and few joints; the floors dark slate
//      plates; thin gold lines inlaid in both, the walls' rising from the floor with a 45° jog to a small lens, the floors'
//      running along the plates' seams with 45° jogs, and round every basin two rings and their spokes. The house is
//      dark and its lines with it: a line glows gold only near a light (the lantern you carry, a lit pool, a woken lamp,
//      `uLhSrc`), and is a dull bronze inlay elsewhere, so the light you bring wakes the floor round you.
//   2. the house's own: its frames, lintels and columns dark metal, its basins ringed in machined bronze over black
//      water with faint rings in it, its glow (eyes, glyphs, doors) warm gold, its hanging lamps kept (gold), its
//      roots dark bronze conduits, the lure pools gold; the moss-stones as they were (the drawing's moss-green glints);
//      the gallery's lantern-shown stones pale plates edged in gold.
//   3. machined dressing, drawn only (InstancedMeshes: noCollide, out of the shadow passes, never cut into tiles): a row of
//      round bronze sockets with dark glass spheres in them on a slate panel along one wall of each big room; square
//      plates floating high over the rooms, only a faint gold outline unless a light is under them, where they are
//      solid (the shader); a soft gold shaft rising from each lit basin. Placed from the kit's record of its walls and
//      rooms (TempleKit.plan), kept clear of every doorway, piece and thing drawn on the walls.
// On the Low, Handheld and Steam Deck presets (uWearLite) the shader leaves out the chamfers, the floors' second set of
// lines and the basins' spokes, and the shafts and the sockets' lamps are not drawn.
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** m: the dressing's blocks stand this far down into the floor (no face of theirs in the floor's plane: z-fighting) */
const SINK = 0.05;
/** The lights the shader wakes its lines by (the lantern, lit pools and lamps), and the basins it rings. */
export const LAMP_SOURCES = 16;
export const LAMP_POOLS = 8;

/** The skin's colours (sRGB) and sizes (m), sampled from the picked sheet (its walls #17181e, its floors #2b292c). */
export const LAMP_SKIN = {
  wall: { color: '#33354a', dark: '#1d1e2b', light: '#4c4e64', panel: [3.4, 9.5] },
  floor: { color: '#58556a', dark: '#34323e', light: '#75728a', plate: [2.4, 2.4] },
  gold: '#f6bd5c', dull: '#8a6a40',
  trim: '#2c2d3a',               // the frames, lintels, columns and posts: dark metal
  band: '#262735',               // a dark course where the moss one ran
  bronze: '#a87a44', bronzeRim: 1.25, bronzeDark: 0.62, sphere: [0.14, 0.24, 0.55], panel: [0.17, 0.19, 0.3],
  water: '#121828',
  conduit: '#3a3238',            // the roots: dark bronze conduits
  plate: '#d9c6a2',              // the floating plates, solid where lit
  /** the Lampless's plates (white, by turns a shade darker), its bronze, its lenses; its wings' squareness and taper */
  moth: { plate: '#f1ebe0', plate2: '#d9d1c4', bronze: '#a87a44', lens: '#25293a', square: 5, taper: 0.3 },
  glow: '#f2c064',               // rt.P.glow while the layout is built: the eyes, doors and orbs gold
  /** how far each kind of light wakes the lines (m) */
  reach: { lantern: 7.5, pool: 9, lamp: 7, eye: 6, lure: 8, lampRoom: 40 },
  /** the dressing: sockets (every m, up to n a row, one row a big room), floating plates (a room's share) */
  sockets: { every: 2.3, n: 7, y: 2.6, minH: 12, scale: 0.62, head: 1.5, out: 0.4 },
  plates: { every: 7.5, lo: 13, top: 3.5, size: [1.6, 3.2] },
};

// ------------------------------------------------------------------ the surfaces
const PARS = /* glsl */ `
  uniform vec3 uSkinO;
  uniform vec2 uLhRot;
  uniform vec4 uLhRound[4];
  uniform int uLhRoundN;
  uniform vec4 uLhSrc[${LAMP_SOURCES}];
  uniform int uLhSrcN;
  uniform vec4 uLhPool[${LAMP_POOLS}];
  uniform int uLhPoolN;
  uniform vec3 uLhGold;
  uniform vec3 uLhDull;
  uniform vec3 uLhDark;
  uniform vec3 uLhLight;
  uniform vec2 uLhCell;
`;
const GLSL = /* glsl */ `
  float lhH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float lhSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0); return length(pa - ba * h); }
  // the kit's local frame (z into the house), from the world
  vec3 lhLocal(vec3 w) { vec3 d = w - uSkinO; return vec3(d.x * uLhRot.x - d.z * uLhRot.y, d.y, d.x * uLhRot.y + d.z * uLhRot.x); }
  vec3 lhLocalN(vec3 v) { return vec3(v.x * uLhRot.x - v.z * uLhRot.y, v.y, v.x * uLhRot.y + v.z * uLhRot.x); }
  // how awake a point is: 1 near a light (the lantern, a lit pool, a woken lamp), 0 in the dark
  float lhWake(vec3 w) {
    float k = 0.0;
    for (int i = 0; i < ${LAMP_SOURCES}; i++) {
      if (i >= uLhSrcN) break;
      vec4 S = uLhSrc[i];
      k = max(k, 1.0 - smoothstep(0.5 * S.w, S.w, distance(w, S.xyz)));
    }
    return k;
  }
  // lit from below: in a column of light over a source (a plate high over a lit pool, over the lantern)
  float lhWakeUp(vec3 w) {
    float k = 0.0;
    for (int i = 0; i < ${LAMP_SOURCES}; i++) {
      if (i >= uLhSrcN) break;
      vec4 S = uLhSrc[i];
      float d = length(w.xz - S.xz) + max(0.0, S.y - w.y) + 0.06 * max(0.0, w.y - S.y);
      k = max(k, 1.0 - smoothstep(0.45 * S.w, 0.8 * S.w, d));
    }
    return k;
  }
  // along a wall (m): round a round room the kit recorded by its angle, else by the face's axis
  float lhAlong(vec3 p, vec3 nn) {
    for (int i = 0; i < 4; i++) {
      if (i >= uLhRoundN) break;
      vec4 R = uLhRound[i];
      vec2 d = p.xz - R.xy;
      float r = length(d);
      if (abs(r - R.z) < 2.2 && p.y > R.w - 1.0 && p.y < R.w + 30.0 && abs(dot(nn.xz, d)) > 0.8 * r * length(nn.xz)) return atan(d.y, d.x) * R.z;
    }
    return abs(nn.x) > abs(nn.z) ? p.z : p.x;
  }
  // a wall's line, in a column of two slabs (P wide): up a seam from the floor, a 45° jog to the next seam, on up to its
  // lens. x: the distance to the line (m), y: to its lens' middle
  vec2 lhWallLine(vec2 q, float P) {
    float Wc = 2.0 * P, c = floor(q.x / Wc), x0 = c * Wc;
    if (lhH(vec2(c, 7.13)) > 0.55) return vec2(1e3);
    float xa = x0 + 0.5 * P, xb = x0 + 1.5 * P;
    if (lhH(vec2(c, 5.71)) < 0.5) { float s = xa; xa = xb; xb = s; }
    float yj = 0.8 + 2.4 * lhH(vec2(c, 9.37)), yt = yj + P + 0.9 + 3.2 * lhH(vec2(c, 4.41));
    float d = min(min(lhSeg(q, vec2(xa, -2.0), vec2(xa, yj)), lhSeg(q, vec2(xa, yj), vec2(xb, yj + P))), lhSeg(q, vec2(xb, yj + P), vec2(xb, yt - 0.2)));
    return vec2(d, length(q - vec2(xb, yt)));
  }
  // a floor's lines: rows every S along u, in runs of C (the run on or not), each run its own offset by whole plates
  // (G) from the row's seam, a 45° jog between two runs; ends lensed. x: the distance (m), y: to an end's lens
  vec2 lhFloorLine(vec2 p, float S, float C, float G, float seed) {
    float r = floor(p.y / S);
    if (lhH(vec2(r, seed)) > 0.78) return vec2(1e3);
    float zc = r * S, i = floor(p.x / C), x0 = i * C, x1 = x0 + C;
    float on0 = step(0.2, lhH(vec2(i, r + seed))), onL = step(0.2, lhH(vec2(i - 1.0, r + seed))), onR = step(0.2, lhH(vec2(i + 1.0, r + seed)));
    float o0 = floor(lhH(vec2(i, r * 1.7 + seed)) * 2.999) - 1.0, oL = floor(lhH(vec2(i - 1.0, r * 1.7 + seed)) * 2.999) - 1.0, oR = floor(lhH(vec2(i + 1.0, r * 1.7 + seed)) * 2.999) - 1.0;
    float z0 = zc + o0 * G, zL = zc + oL * G, zR = zc + oR * G;
    float dL = onL * abs(z0 - zL) * 0.5, dR = onR * abs(zR - z0) * 0.5;
    float d = 1e3, lens = 1e3;
    if (on0 > 0.5) {
      d = lhSeg(p, vec2(x0 + dL, z0), vec2(x1 - dR, z0));
      if (onL > 0.5) d = min(d, lhSeg(p, vec2(x0 - dL, zL), vec2(x0 + dL, z0))); else lens = length(p - vec2(x0 + 0.5, z0));
      if (onR > 0.5) d = min(d, lhSeg(p, vec2(x1 - dR, z0), vec2(x1 + dR, zR))); else lens = min(lens, length(p - vec2(x1 - 0.5, z0)));
    } else {
      if (onL > 0.5) lens = length(p - vec2(x0 - 0.5, zL));
      if (onR > 0.5) lens = min(lens, length(p - vec2(x1 + 0.5, zR)));
    }
    return vec2(d, lens);
  }
  // the rings round a basin (two, and spokes between them on the finer presets) and its distance to them; the faint
  // rings in its water (water: 1). p local, B (x, z, r, floor y)
  float lhBasin(vec3 p, float water) {
    float d = 1e3;
    for (int i = 0; i < ${LAMP_POOLS}; i++) {
      if (i >= uLhPoolN) break;
      vec4 B = uLhPool[i];
      if (abs(p.y - B.w) > 1.4) continue;
      vec2 v = p.xz - B.xy;
      float rr = length(v);
      if (water > 0.5) {
        if (rr > B.z + 0.05) continue;
        d = min(d, min(abs(rr - B.z * 0.38), abs(rr - B.z * 0.72)));
        continue;
      }
      if (rr > B.z + 3.4) continue;
      float r1 = B.z + 1.0, r2 = B.z + 2.6;
      d = min(d, abs(rr - r1));
      // the outer ring in arcs, spokes from the inner to the outer at the arcs' ends
      float a = atan(v.y, v.x) + float(i) * 0.7, k = floor(a / 1.0471976 + 0.5), ak = k * 1.0471976;
      float arc = step(0.35, fract(a / 2.0943951 + 0.1));
      d = min(d, abs(rr - r2) + (1.0 - arc) * 1e3);
      if (uWearLite < 0.5) d = min(d, abs(sin(a - ak)) * rr + step(rr, r1) * 1e3 + step(r2, rr) * 1e3 + step(0.5, fract(k * 0.5)) * 1e3);
    }
    return d;
  }
  // a line's cover at a distance d (m), fw metres a pixel: w wide, never under a pixel (fainter once it is)
  float lhCover(float d, float fw, float w) {
    float ww = max(w, 0.6 * fw);
    return (1.0 - smoothstep(ww - 0.5 * fw, ww + 0.5 * fw, d)) * min(1.0, w / ww);
  }
  float lhInk(float px) { float w = 0.5 * uPixelRatio; return 1.0 - smoothstep(w, w + 1.1, px); }
`;

/** Each body replaces the surface's `vec3 albedo = uColor;` (lhInkV its first pen lines, lhGlow its light). */
const BODIES = {
  wall: /* glsl */ `
    vec3 lhP = lhLocal(vWorldPos), lhN = lhLocalN(n);
    float lhInkV = 0.0, lhGlow = 0.0;
    vec3 albedo = uColor;
    {
      bool side = abs(n.y) < 0.65;
      float P = side ? uLhCell.x : 4.8, Hc = side ? uLhCell.y : 4.8;
      vec2 q = side ? vec2(lhAlong(lhP, lhN), lhP.y + 6.0) : lhP.xz;
      // the slabs: columns P wide, courses Hc high, each column's courses set off its own way
      float col = floor(q.x / P), oy = side ? lhH(vec2(col, 3.3)) * Hc : 0.0;
      vec2 c = vec2(q.x / P, (q.y + oy) / Hc), cell = floor(c), f = fract(c);
      vec2 fw2 = fwidth(q), fq = fwidth(c);
      float fw = max(max(fw2.x, fw2.y), 1e-5);
      vec2 em = min(f, 1.0 - f) / max(fq, 1e-5);
      float far = smoothstep(0.08, 0.2, max(fq.x, fq.y));
      float tone = 0.94 + 0.1 * lhH(cell + 11.0) - 0.06 * step(0.85, lhH(cell + 2.0));
      // (a slab's light falling off down its face, as the drawing's: a little paler at its head)
      if (side) tone *= 0.95 + 0.08 * f.y;
      albedo = uColor * mix(tone, 1.0, far);
      lhInkV = lhInk(min(em.x, em.y)) * 0.5 * (1.0 - far);
      if (uWearLite < 0.5) {
        // the chamfers: a lit lip along each slab's top and left edge, a shaded one along its bottom and right
        float b = 0.08;
        vec2 m = f * vec2(P, Hc), M2 = (1.0 - f) * vec2(P, Hc);
        float lit = max(1.0 - smoothstep(b - fw, b, M2.y), 1.0 - smoothstep(b - fw, b, m.x));
        float shd = max(1.0 - smoothstep(b - fw, b, m.y), 1.0 - smoothstep(b - fw, b, M2.x));
        float k = (1.0 - smoothstep(0.4, 1.0, fw / b));
        albedo = mix(albedo, uLhLight, lit * k * 0.8);
        albedo = mix(albedo, uLhDark, shd * k * 0.8 * (1.0 - lit));
      }
      if (side) {
        vec2 L = lhWallLine(q, P);
        float d = L.x;
        float ring = abs(L.y - 0.2), dot0 = L.y - 0.065;
        float cov = max(max(lhCover(d, fw, 0.02), lhCover(ring, fw, 0.025)), (1.0 - smoothstep(0.0, fw, dot0)) * step(L.y, 0.5));
        float wake = lhWake(vWorldPos);
        float pulse = 0.94 + 0.06 * sin(uTime * 1.3 - (q.x + q.y) * 0.3);
        albedo = mix(albedo, mix(uLhDull, uLhGold, 0.35 + 0.65 * wake), cov);
        lhGlow = cov * mix(0.45, 0.76, wake) * pulse;
        lhInkV *= 1.0 - cov;
      }
    }
  `,
  floor: /* glsl */ `
    vec3 lhP = lhLocal(vWorldPos), lhN = lhLocalN(n);
    float lhInkV = 0.0, lhGlow = 0.0;
    vec3 albedo = uColor;
    {
      bool top = abs(n.y) > 0.65;
      vec2 q = top ? lhP.xz : vec2(abs(lhN.x) > abs(lhN.z) ? lhP.z : lhP.x, lhP.y);
      vec2 c = q / uLhCell, cell = floor(c), f = fract(c);
      vec2 fw2 = fwidth(q), fq = fwidth(c);
      float fw = max(max(fw2.x, fw2.y), 1e-5);
      vec2 em = min(f, 1.0 - f) / max(fq, 1e-5);
      float far = smoothstep(0.08, 0.2, max(fq.x, fq.y));
      albedo = uColor * mix(0.93 + 0.11 * lhH(cell + 5.0), 1.0, far);
      lhInkV = lhInk(min(em.x, em.y)) * 0.45 * (1.0 - far);
      if (uWearLite < 0.5) {
        float b = 0.06;
        vec2 m = f * uLhCell, M2 = (1.0 - f) * uLhCell;
        float lit = max(1.0 - smoothstep(b - fw, b, M2.y), 1.0 - smoothstep(b - fw, b, m.x));
        float shd = max(1.0 - smoothstep(b - fw, b, m.y), 1.0 - smoothstep(b - fw, b, M2.x));
        float k = (1.0 - smoothstep(0.4, 1.0, fw / b));
        albedo = mix(albedo, uLhLight, lit * k * 0.5);
        albedo = mix(albedo, uLhDark, shd * k * 0.5 * (1.0 - lit));
      }
      if (top) {
        // the lines along the plates' seams: rows along x (every 4 plates) and, but on the lighter presets, along z
        vec2 A = lhFloorLine(q, uLhCell.y * 3.0, uLhCell.x * 3.0, uLhCell.y, 1.3);
        if (uWearLite < 0.5) { vec2 B = lhFloorLine(q.yx, uLhCell.x * 4.0, uLhCell.y * 4.0, uLhCell.x, 7.9); A = min(A, B); }
        float bd = lhBasin(lhP, 0.0);
        float cov = max(max(lhCover(min(A.x, bd), fw, 0.024), lhCover(abs(A.y - 0.18), fw, 0.026)), 1.0 - smoothstep(0.06 - fw, 0.06, A.y));
        float wake = lhWake(vWorldPos);
        float pulse = 0.94 + 0.06 * sin(uTime * 1.3 - (q.x + q.y) * 0.3);
        albedo = mix(albedo, mix(uLhDull, uLhGold, wake), cov);
        lhGlow = cov * mix(0.3, 0.76, wake) * pulse;
        lhInkV *= 1.0 - cov;
      }
    }
  `,
  // the basins' water: black, faint rings in it that glow with its light
  water: /* glsl */ `
    vec3 lhP = lhLocal(vWorldPos);
    float lhInkV = 0.0, lhGlow = 0.0;
    vec3 albedo = uColor;
    {
      vec2 fw2 = fwidth(lhP.xz);
      float fw = max(max(fw2.x, fw2.y), 1e-5);
      float cov = lhCover(lhBasin(lhP, 1.0), fw, 0.018) * 0.8;
      float wake = lhWake(vWorldPos);
      albedo = mix(albedo, mix(uLhDull, uLhGold, wake), cov);
      lhGlow = cov * mix(0.1, 0.72, wake);
    }
  `,
  // a floating plate: its edges a faint gold outline, its body there only where a light falls under it (else not drawn)
  plate: /* glsl */ `
    float lhInkV = 0.0, lhGlow = 0.0;
    vec3 albedo = uColor;
    {
      vec2 fu = max(fwidth(vTextureUV), vec2(1e-5)), e = min(vTextureUV, 1.0 - vTextureUV) / fu;
      float rim = 1.0 - smoothstep(0.8, 2.0, min(e.x, e.y));
      float k = lhWakeUp(vWorldPos);
      if (rim < 0.5 && k < 0.2 + 0.6 * bayer4(gl_FragCoord.xy / max(uPixelRatio, 1.0) * 0.5)) discard;
      albedo = mix(uColor * (0.85 + 0.15 * k), uLhGold, rim);
      lhGlow = rim * mix(0.5, 0.74, k);
    }
  `,
  // a lantern-shown stone (the gallery's bridge): a pale plate, its edges lit gold
  stone: /* glsl */ `
    float lhInkV = 0.0, lhGlow = 0.0;
    vec3 albedo = uColor;
    {
      vec2 fu = max(fwidth(vTextureUV), vec2(1e-5)), e = min(vTextureUV, 1.0 - vTextureUV) / fu;
      float rim = 1.0 - smoothstep(1.0, 2.4, min(e.x, e.y));
      albedo = mix(uColor, uLhGold, rim);
      lhGlow = max(0.3, rim * 0.74);
    }
  `,
};

const EMIT_LINE = 'float emit = 0.0;   // lit windows at night (facade)';
/** The surface material of one of the skin's bodies: makeMaterial's own, its albedo, first pen lines and light the body's. */
function skinMaterial(body, look, color, U, key, cell = [1, 1]) {
  const m = makeMaterial({ flat: true, ...look, color, key: `temple.skin.lamp.${key}` });
  // (this build's rooms, lights and origin: a material from the cache is pointed at them again)
  Object.assign(m.uniforms, { uSkinO: U.origin, uLhRot: U.rot, uLhRound: U.round, uLhRoundN: U.roundN, uLhSrc: U.src, uLhSrcN: U.srcN, uLhPool: U.pools, uLhPoolN: U.poolN });
  if (m.userData.houseSkin) return m;
  m.userData.houseSkin = body;
  const fs = m.fragmentShader, at = fs.lastIndexOf('void main()');
  if (at < 0 || !fs.includes('vec3 albedo = uColor;') || !fs.includes('float detail = 0.0;') || !fs.includes(EMIT_LINE)) throw new Error('lamp-house.js: the surface shader changed: no albedo, emit or detail line to replace');
  m.fragmentShader = PARS + fs.slice(0, at) + GLSL + fs.slice(at).replace('vec3 albedo = uColor;', BODIES[body]).replace(EMIT_LINE, 'float emit = lhGlow;').replace('float detail = 0.0;', 'float detail = lhInkV;');
  Object.assign(m.uniforms, {
    uLhGold: { value: new THREE.Color(LAMP_SKIN.gold) }, uLhDull: { value: new THREE.Color(LAMP_SKIN.dull) },
    uLhDark: { value: new THREE.Color(look.dark ?? '#000000') }, uLhLight: { value: new THREE.Color(look.light ?? '#ffffff') },
    uLhCell: { value: new THREE.Vector2(...cell) },
  });
  return m;
}

// ------------------------------------------------------------------ the dressing's shapes (unit sizes)
/** Geometries merged into one; with tones (one a part: a grey level), a colour attribute. */
function merge(list, tones = null) {
  const pos = [], nor = [], uv = [], col = [];
  list.forEach((g0, i) => {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    if (g.attributes.uv) uv.push(...g.attributes.uv.array); else for (let j = 0; j < g.attributes.position.count; j++) uv.push(0.5, 0.5);
    if (tones) for (let j = 0; j < g.attributes.position.count; j++) col.push(...(Array.isArray(tones[i]) ? tones[i] : [tones[i], tones[i], tones[i]]));
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (tones) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
/**
 * A socket, facing z out of the wall (1 its ring's radius): a dark collar sunk in the panel, a machined bronze ring proud of
 * it, a sphere of dark glass in it (blue-black: the water in it), a bracket under it down to a small fitting. Coloured by
 * vertex (the bronze material's colour times it): the ring bright, the collar and bracket dark (one draw).
 */
function socketGeometry() {
  const S = LAMP_SKIN;
  const collar = new THREE.CylinderGeometry(1.12, 1.12, 0.22, 20).rotateX(Math.PI / 2).translate(0, 0, 0.11);
  const ring = new THREE.TorusGeometry(0.98, 0.14, 5, 22).translate(0, 0, 0.24);
  const sphere = new THREE.SphereGeometry(0.77, 14, 10).translate(0, 0, 0.36);
  const bracket = new THREE.BoxGeometry(0.22, 0.75, 0.26).translate(0, -1.35, 0.13);
  const foot = new THREE.CylinderGeometry(0.16, 0.2, 0.22, 8).rotateX(Math.PI / 2).translate(0, -1.82, 0.16);
  // its tile of the panel behind the row: from the floor (sunk SINK into it) to over the socket, out of the wall to the
  // socket's back; a joint (2 cm) to the next tile, so no two tiles share a face
  const k = 1 / S.sockets.scale, w = S.sockets.every * k - 0.04 * k, y0 = -(S.sockets.y + SINK) * k, y1 = S.sockets.head * k;
  const tile = new THREE.BoxGeometry(w, y1 - y0, S.sockets.out * k).translate(0, (y0 + y1) / 2, -S.sockets.out * k / 2 + 0.001);
  return merge([collar, ring, sphere, bracket, foot, tile], [S.bronzeDark * 0.55, S.bronzeRim, S.sphere, S.bronzeDark, 1, S.panel]);
}
/** A unit box, its foot at y = 0, its back at z = 0 (out of the wall along z). */
const blockGeometry = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0.5);
/** A floating plate: a unit box about its middle (its uv each face's 0-1: the shader's outline). */
const plateGeometry = () => new THREE.BoxGeometry(1, 1, 1);

// ------------------------------------------------------------------ placing the dressing
/** An instanced, drawn-only mesh of the dressing: walked through, never buried, never casting a shadow. */
function instanced(name, geo, mat, list, frame) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  m.name = `The Lamp-House skin: ${name}`; m.count = list.length;
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
    const surface = surfaces.has(mat);
    for (const g of list) {
      g.computeBoundingBox();
      const l = local(g.boundingBox), s = l.getSize(V());
      // (not a floor's slab, a wall's cap or a whole ring; of the walls and floors only the small blocks: the Kennel's
      // stalls, the posts, the niches)
      if (surface ? Math.max(s.x, s.y, s.z) < 8 : Math.max(s.x, s.z) < 10.5 && !(s.x > 6 && s.z > 6)) keep.add(l.expandByScalar(0.3));
    }
  }
  for (const p of rt.pieces) {
    const o = p.group ?? p.mesh ?? p.root;
    if (o?.isObject3D) { b.setFromObject(o); const l = local(b), s = l.getSize(V()); if (!l.isEmpty() && Math.max(s.x, s.z) < 14 && s.y < 30) keep.add(l.expandByScalar(0.8)); }
    for (const q of [p.pos, p.center, p.at]) if (q?.isVector3) keep.add(new THREE.Box3().setFromCenterAndSize(K.local(q), V(3, 3, 3)));
  }
  return keep;
}

/** The kit's rooms (local): halls, round rooms and passages. */
function roomsOf(plan) {
  const out = [];
  for (const e of plan) {
    if (e.kind === 'hall') out.push({ kind: 'hall', x: e.x, z: e.z, hx: e.w / 2, hz: e.d / 2, y0: e.y, y1: e.y + e.h, e });
    else if (e.kind === 'round') out.push({ kind: 'round', x: e.x, z: e.z, r: e.r, y0: e.y, y1: e.y + e.h, e });
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

/** The sockets' rows, the floating plates. */
function dress(rt, mats, keep, plan, rooms, out) {
  const S = LAMP_SKIN, K = rt.kit;
  const panels = [], sockets = [], dots = [], strips = [], plates = [];
  const clear = (c, half) => !keep.hits(new THREE.Box3(c.clone().sub(half), c.clone().add(half)));
  const at = (f, s) => f.o.clone().addScaledVector(f.t, s);
  const freeOf = (f, s, half) => !f.holes.some((h) => s > h.x0 - half - 1.2 && s < h.x1 + half + 1.2);
  const F = faces(plan, rooms);
  // the sockets: in each big hall, a row along its longest clear wall, on a slate panel edged with a gold line
  const Y = S.sockets.y;
  for (const r of rooms) {
    if (r.kind !== 'hall' || r.y1 - r.y0 < S.sockets.minH) continue;
    let best = null;
    for (const f of F.filter((g) => g.room === r)) {
      let run = [], top = [];
      for (let s = f.s0 + 2; s <= f.s1 - 2; s += S.sockets.every) {
        const p = at(f, s), c = p.clone().addScaledVector(f.nrm, 0.4).setY(p.y + Y);
        if (freeOf(f, s, 0.9) && clear(c, V(1.1, 1.9, 0.6))) { run.push([s, p]); if (run.length > top.length) top = run.slice(); } else run = [];
      }
      if (top.length > (best?.spots.length ?? 2)) best = { f, spots: top };
    }
    if (!best) continue;
    const n = Math.min(S.sockets.n, best.spots.length), k0 = Math.floor((best.spots.length - n) / 2);
    const row = best.spots.slice(k0, k0 + n), f = best.f;
    const [sa] = row[0], [sb] = row[row.length - 1], y0 = f.o.y;
    const mid = at(f, (sa + sb) / 2), L = sb - sa + 2.6;
    // the panel (each socket's tile of it: socketGeometry), a gold line along its head and its foot
    panels.push(L);
    strips.push(basis(mid.clone().setY(y0 + Y + 1.32).addScaledVector(f.nrm, 0.35), f.t.clone().multiplyScalar(L - 0.6), V(0, 0.04, 0), f.nrm.clone().multiplyScalar(0.03)));
    strips.push(basis(mid.clone().setY(y0 + 0.42).addScaledVector(f.nrm, 0.35), f.t.clone().multiplyScalar(L - 0.6), V(0, 0.04, 0), f.nrm.clone().multiplyScalar(0.03)));
    for (const [, p] of row) {
      const c = p.clone().setY(y0 + Y).addScaledVector(f.nrm, 0.35);
      const k = S.sockets.scale;
      sockets.push(basis(c, f.t.clone().multiplyScalar(k), V(0, k, 0), f.nrm.clone().multiplyScalar(k)));
      dots.push(basis(p.clone().setY(y0 + Y - 1.2).addScaledVector(f.nrm, 0.36), f.t.clone().multiplyScalar(0.12), V(0, 0.12, 0), f.nrm.clone().multiplyScalar(0.06)));
    }
    keep.add(new THREE.Box3().setFromPoints([at(f, sa - 1.3), at(f, sb + 1.3).addScaledVector(f.nrm, 1.2).setY(y0 + Y + 1.6)]));
  }
  // the floating plates: high over the big rooms (out of the camera's way and any jump's), a few to a room, each its own
  // size and tilt; drawn only, their bodies there only where a light falls under them (the shader)
  const P = S.plates;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const r of rooms) {
    if (r.kind === 'corridor') continue;
    // (not over the Lamp-Room, where the Lampless flies, nor the Kennel's fight)
    const id = roomId(rt, r);
    if (id === 'lamp' || id === 'kennel') continue;
    const floorY = id === 'roots' || id === 'gallery' ? r.y0 + (id === 'roots' ? 6 : 12) : r.y0;
    const lo = floorY + P.lo, hi = r.y1 - P.top;
    if (hi - lo < 1.5) continue;
    const hx = r.kind === 'round' ? r.r * 0.6 : r.hx - 3.5, hz = r.kind === 'round' ? r.r * 0.6 : r.hz - 3.5;
    const nx = Math.max(1, Math.round((2 * hx) / P.every)), nz = Math.max(1, Math.round((2 * hz) / P.every));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (rnd() < 0.45) continue;
      const x = r.x - hx + ((i + 0.2 + 0.6 * rnd()) / nx) * 2 * hx, z = r.z - hz + ((j + 0.2 + 0.6 * rnd()) / nz) * 2 * hz;
      if (r.kind === 'round' && Math.hypot(x - r.x, z - r.z) > r.r - 4) continue;
      const y = lo + rnd() * (hi - lo), w = P.size[0] + rnd() * (P.size[1] - P.size[0]), d = w * (0.7 + 0.5 * rnd());
      const c = V(x, y, z);
      if (!clear(c, V(w / 2 + 0.5, 0.6, d / 2 + 0.5))) continue;
      const a = (rnd() - 0.5) * 0.5, ca = Math.cos(a), sa = Math.sin(a);
      plates.push(basis(c, V(ca, 0, -sa).multiplyScalar(w), V(0, 0.16, 0), V(sa, 0, ca).multiplyScalar(d)));
    }
  }
  out.push(instanced('bronze sockets', socketGeometry(), mats.bronzeV, sockets, K.frame));
  // (the panels' lines and the sockets' small lamps: one draw, the lamps last, left out on the lighter presets: count)
  const lit = instanced('panels’ lines and lamps', blockGeometry(), mats.glow, [...strips, ...dots], K.frame);
  lit.userData.skinFine = { full: strips.length + dots.length, lite: strips.length };
  out.push(lit);
  out.push(instanced('floating plates', plateGeometry(), mats.plate, plates, K.frame));
  return { sockets: sockets.length, rows: panels.length, plates: plates.length, strips: strips.length };
}

/** The pools' radii (perdide2.js layout's pool(): the Hall of Dark Pools' two and its loft's, the Root Stair's small one). */
const POOL_R = { s1: 2.0, s2: 2.0, s3: 1.5, s5: 1.3 };

/** The house's room (perdide2.js ROOMS' id) a kit room is, by where it stands. */
function roomId(rt, r) {
  const R = rt.skin?.rooms ?? {};
  for (const [id, q] of Object.entries(R)) {
    if (q.r != null ? Math.hypot(r.x - q.x, r.z - q.z) < 1 : Math.abs(r.x - (q.x0 + q.x1) / 2) < 1 && Math.abs(r.z - (q.z0 + q.z1) / 2) < 1) return id;
  }
  // (the Lamp-Room: the round hall past the gallery)
  if (r.kind === 'round' && r.z > (R.gallery?.z1 ?? 1e9)) return 'lamp';
  return null;
}

/**
 * The house's basins (their bronze rings, the trim's annuli round each pool, drawn in the skin's bronze: their collider
 * as it was), their water, the lure pools' light gold, the gallery's lantern-shown stones pale plates edged in gold.
 * Returns the basins (local x, z, r, y) for the shader.
 */
function basins(rt, mats) {
  const K = rt.kit, out = [];
  // the pools: every Switch over a pool's water (the house's `pool()`: its eye 0.9 m over the floor), and the lure pools
  for (const p of rt.pieces) if (p instanceof Switch && /^s[1235]$/.test(p.id)) {
    const l = K.local(p.center);
    out.push({ x: l.x, z: l.z, r: POOL_R[p.id], y: l.y - 0.9 });
  }
  for (const q of rt.lurePools?.list ?? []) { const l = K.local(q.at); out.push({ x: l.x, z: l.z, r: 1.6, y: l.y - 0.1 }); q.mat.uniforms.uColor.value.set(LAMP_SKIN.water); }
  // their rings: the trim's annuli round them (each a ring of the pool's radius + 0.6, or the lure pools' 2.1)
  const trim = K.batches.get(mats.trim) ?? [], bronze = [];
  const keepT = [];
  for (const g of trim) {
    g.computeBoundingBox();
    const b = g.boundingBox.clone().applyMatrix4(K.inv), c = b.getCenter(V()), s = b.getSize(V());
    const hit = out.find((o) => Math.hypot(c.x - o.x, c.z - o.z) < 0.25 && Math.abs(s.x - s.z) < 0.3 && s.x > 2 * o.r + 0.4 && s.x < 2 * o.r + 1.6 && s.y < 0.7);
    (hit ? bronze : keepT).push(g);
  }
  if (bronze.length) { K.batches.set(mats.trim, keepT); K.batches.set(mats.bronze, [...(K.batches.get(mats.bronze) ?? []), ...bronze]); }
  // their water (the house's pool material: its black water, faint rings in it)
  const pools = makeMaterial({ color: '#2f3560', glow: 0.1, flat: true, key: 'temple.p2.pools' });
  if (K.batches.has(pools)) { K.batches.set(mats.water, [...(K.batches.get(mats.water) ?? []), ...K.batches.get(pools)]); K.batches.delete(pools); }
  // the gallery's lantern-shown stones: pale plates edged in gold (their meshes, logic and colliders as they were)
  for (const p of rt.pieces) if (p instanceof Bridge && p.ghost && p.id === 'br1') p.root.traverse((o) => { if (o.isMesh && o.material === p.ghost) o.material = mats.stone; });
  return { list: out, rings: bronze.length };
}

// ------------------------------------------------------------------ the Lampless, a machine
/**
 * The Lampless as the drawing has it, a great moth-shaped machine of thin white plates (guardians.js mothModel's parts:
 * their groups, motion, hits and logic as they were, only the meshes' shapes and colours): its body a machined fuselage of
 * octagonal segments ringed in bronze, a keel along its back; each wing a flat plate squared off from its oval (a
 * superellipse), edged in bronze, its panels by turns paler and darker; the sign on each wing in a round bronze-rimmed
 * lens; its feelers bronze rods. Done once, when the house's guardian is there (SkinLife).
 */
export function machineMoth(model) {
  if (!model?.body || model.machine) return false;
  const C = LAMP_SKIN.moth, H = Math.PI / 2;
  const meshes = model.body.children.filter((o) => o.isMesh);
  const body = meshes[0];
  // the fuselage: thorax and head forward, the abdomen's four segments tapering back, bronze rings between, a keel
  const parts = [
    cyl(0.92, 0.98, 2.3, C.plate, [0, 0, 0.15], [H, 0, 0], 8), cyl(0.7, 0.86, 0.95, C.plate2, [0, 0.08, 1.75], [H, 0, 0], 8),
    cone(0.62, 0.55, C.plate, [0, 0.08, 2.48], [H, 0, 0], 8),
    torus(0.96, 0.09, C.bronze, [0, 0, 1.3], null, [4, 16]), torus(0.99, 0.09, C.bronze, [0, 0, -1.0], null, [4, 16]),
    gbox([0.2, 0.3, 4.8], C.bronze, [0, 0.95, -0.7]),
  ];
  for (let k = 0; k < 4; k++) {
    const r0 = 0.92 - k * 0.15, r1 = r0 - 0.15, z = -1.5 - k * 0.92;
    parts.push(cyl(r0, r1, 0.86, k % 2 ? C.plate2 : C.plate, [0, -0.04 * k, z], [H, 0, 0], 8));
    parts.push(torus(r1 + 0.04, 0.06, C.bronze, [0, -0.04 * k, z - 0.45], null, [4, 14]));
  }
  if (body) { body.geometry.dispose(); body.geometry = gmerge(parts); }
  // the feelers: bronze rods (the body's meshes in its own material but the eyes)
  const bz = new THREE.Color(C.bronze);
  for (const m of meshes.slice(1)) {
    const c = m.geometry.attributes.color;
    if (!c || m.material !== body?.material) continue;
    for (let i = 0; i < c.count; i++) c.setXYZ(i, bz.r, bz.g, bz.b);
    c.needsUpdate = true;
  }
  // the wings: each flat oval squared off into a plate, its edge bronze, its panels by turns
  const v = V(), plate = new THREE.Color(C.plate), plate2 = new THREE.Color(C.plate2);
  for (const W of model.wings ?? []) {
    const ry = W.s * (W.back ? -0.35 : 0.25);
    for (const m of [W.w.children.find((o) => o.isMesh), W.outer.children.find((o) => o.isMesh)]) {
      if (!m) continue;
      const g = m.geometry, P = g.attributes.position, col = g.attributes.color;
      g.computeBoundingBox();
      const c = g.boundingBox.getCenter(V());
      // in its own axes: x along the wing (out to its tip), z across it
      let a = 0, b = 0, h = 0;
      const loc = [];
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).sub(c).applyAxisAngle(_Y, -ry);
        loc.push(v.clone()); a = Math.max(a, Math.abs(v.x)); b = Math.max(b, Math.abs(v.z)); h = Math.max(h, Math.abs(v.y));
      }
      loc.forEach((q, i) => {
        const x = q.x / a, z = q.z / b, r = Math.hypot(x, z);
        if (r > 1e-4) {
          // (the oval's rim out to the superellipse's, in the same direction)
          const cx = Math.abs(x / r), cz = Math.abs(z / r), se = Math.pow(Math.pow(cx, C.square) + Math.pow(cz, C.square), -1 / C.square);
          q.x *= se; q.z *= se;
        }
        // (narrower toward its tip, a thin plate)
        q.z *= 1 - C.taper * Math.max(0, (W.s * q.x) / a);
        q.y = Math.sign(q.y) * Math.min(Math.abs(q.y), h * 0.5);
        const rim = Math.abs(q.y) < h * 0.2 || r > 0.97;
        const k = Math.floor((W.s * x + 1) * 1.6 + (z > 0.25 ? 0.5 : 0));
        const cc = rim ? bz : k % 2 ? plate2 : plate;
        col?.setXYZ(i, cc.r, cc.g, cc.b);
        q.applyAxisAngle(_Y, ry).add(c);
        P.setXYZ(i, q.x, q.y, q.z);
      });
      P.needsUpdate = true; if (col) col.needsUpdate = true;
      g.computeVertexNormals(); g.computeBoundingSphere();
    }
    // the sign on the wing in a round lens: a dark disc rimmed in bronze under it
    const glyph = W.outer.children.find((o) => o.isMesh && o.material === model.glowM);
    if (glyph) {
      glyph.geometry.computeBoundingBox();
      const c = glyph.geometry.boundingBox.getCenter(V()), s = glyph.geometry.boundingBox.getSize(V()), R = Math.max(s.x, s.z) * 0.62;
      glyph.position.y += 0.08;
      const lens = new THREE.Mesh(gmerge([cyl(R, R, 0.04, C.lens, [c.x, 0.1, c.z], null, 18), torus(R, 0.07, C.bronze, [c.x, 0.12, c.z], [H, 0, 0], [4, 20])]), body?.material ?? glyph.material);
      lens.name = 'The Lampless’s lens (skin)';
      lens.userData.noCollide = true; lens.userData.dynamic = true;
      W.outer.add(lens);
    }
  }
  model.machine = true;
  return true;
}
const _Y = new THREE.Vector3(0, 1, 0);


/** The lights the shader wakes its lines by, every frame; the finest dressing on the finer presets; the shafts. */
class SkinLife {
  constructor(rt, skin, meshes) {
    this.rt = rt; this.skin = skin; this.fine = meshes.filter((m) => m.userData.skinFine);
    const S = LAMP_SKIN.reach;
    this.switches = rt.pieces.filter((p) => p instanceof Switch).map((p) => ({ p, r: /^s[1235]$/.test(p.id) ? S.pool : S.eye }));
    this.ears = rt.pieces.filter((p) => p instanceof LightEar);
    this.shafts = [];
    this.water = new THREE.Color(LAMP_SKIN.water); this.gold = new THREE.Color(LAMP_SKIN.gold);
  }
  /** A soft gold shaft over each basin of the house's own pools (made the first time one is lit). */
  shaft(sw) {
    if (sw.shaft !== undefined) return sw.shaft;
    const rt = this.rt;
    if (!rt.veils || !/^s[1235]$/.test(sw.p.id)) return (sw.shaft = null);
    const s = new LightShaft(rt.veils, rt.root, { color: '#ffd38a', alpha: [0.1], near: 3 });
    const foot = sw.p.center.clone().setY(sw.p.center.y - 0.6), top = foot.clone().setY(foot.y + 16);
    s.set(top, 0.5, foot, 1.3);
    s.visible = false;
    this.shafts.push(s);
    return (sw.shaft = s);
  }
  update(dt, t) {
    const rt = this.rt, U = this.skin.U, S = LAMP_SKIN.reach, lite = sharedUniforms.uWearLite.value > 0.5;
    if (!this.moth && rt.guardian?.model) this.moth = machineMoth(rt.guardian.model) || true;
    for (const m of this.fine) m.count = lite ? m.userData.skinFine.lite : m.userData.skinFine.full;
    const list = [];
    const P = rt.player;
    if (P?.pos && rt.logic?.has?.('lantern')) list.push([P.pos.x, P.pos.y + 1, P.pos.z, S.lantern]);
    for (const sw of this.switches) {
      const on = !!sw.p.on;
      if (on) list.push([sw.p.center.x, sw.p.center.y, sw.p.center.z, sw.r]);
      const sh = on || sw.shaft ? this.shaft(sw) : null;
      if (sh) sh.visible = on && !lite;
    }
    for (const e of this.ears) if (e.lit) list.push([e.at.x, e.at.y + 2.8, e.at.z, S.lamp]);
    for (const q of rt.lurePools?.list ?? []) {
      // (a lure pool's water black, gold as it takes the light and while it holds it)
      const k = q.lit ? 1 : Math.min(1, q.held / 1.2);
      q.mat.uniforms.uColor.value.copy(this.water).lerp(this.gold, k);
      if (q.lit) list.push([q.at.x, q.at.y, q.at.z, S.lure]);
    }
    const L = rt.lampRoom;
    if (L && L.lampM.uniforms.uGlow.value > 0.5) list.push([L.lamp.position.x, L.lamp.position.y, L.lamp.position.z, S.lampRoom]);
    // (the nearest to you first, if there are more than the shader takes)
    if (list.length > LAMP_SOURCES && P?.pos) list.sort((a, b) => Math.hypot(a[0] - P.pos.x, a[2] - P.pos.z) - Math.hypot(b[0] - P.pos.x, b[2] - P.pos.z));
    const n = Math.min(LAMP_SOURCES, list.length);
    for (let i = 0; i < n; i++) U.src.value[i].set(...list[i]);
    U.srcN.value = n;
    this.skin.mats.glow.uniforms.uGlow.value = 0.72 + 0.05 * Math.sin(t * 1.3);
  }
}

// ------------------------------------------------------------------ the skin
/**
 * The Lamp-House's skin (its def's `skin`, src/temples/skins/index.js): its surfaces swapped into rt.M (the kit shares
 * it), rt.P's glow gold while the pieces are made, the kit's plan recording.
 */
export function lampHouseSkin(rt, { rooms = {} } = {}) {
  const S = LAMP_SKIN, K = rt.kit, M = rt.M;
  // (the house's look, its shade a little deeper, its hatching sparse: the drawing's shadows are few)
  const look = { ...(rt.def.palette?.look?.all ?? {}), shade: 0.06, shadeFlat: 0.05 };
  const U = {
    origin: { value: K.origin.clone() },
    rot: { value: new THREE.Vector2(Math.cos(K.yaw), Math.sin(K.yaw)) },
    round: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) }, roundN: { value: 0 },
    src: { value: Array.from({ length: LAMP_SOURCES }, () => new THREE.Vector4()) }, srcN: { value: 0 },
    pools: { value: Array.from({ length: LAMP_POOLS }, () => new THREE.Vector4()) }, poolN: { value: 0 },
  };
  const was = { M: { wall: M.wall, wallGlyph: M.wallGlyph, floor: M.floor, trim: M.trim, stone: M.stone, bands: M.bands, ornament: M.ornament, glyph: M.glyph }, P: rt.P };
  const own = (k, o) => makeMaterial({ flat: true, ...o, key: `temple.skin.lamp.${k}` });
  const glow = own('glow', { color: S.gold, glow: 0.74, side: THREE.DoubleSide });
  const bronze = { color: S.bronze, metal: 'brass', refl: 0.55, highlight: 0.3, glow: 0.12, shade: 0.12, shadeFlat: 0, hatch: 0.2 };
  const wallLook = { ...look, hatch: 0.18, dark: S.wall.dark, light: S.wall.light };
  const floorLook = { ...look, hatch: 0.4, dark: S.floor.dark, light: S.floor.light };
  const mats = {
    wall: skinMaterial('wall', wallLook, S.wall.color, U, 'wall', S.wall.panel),
    wallGlyph: skinMaterial('wall', { ...wallLook, glyphs: 1.6 }, S.wall.color, U, 'wallGlyph', S.wall.panel),
    floor: skinMaterial('floor', floorLook, S.floor.color, U, 'floor', S.floor.plate),
    water: skinMaterial('water', { glow: 0.06 }, S.water, U, 'water'),
    plate: skinMaterial('plate', { glow: 0.2, hatch: 0, side: THREE.DoubleSide }, S.plate, U, 'plate'),
    stone: skinMaterial('stone', { glow: 0.3, hatch: 0 }, S.plate, U, 'stone'),
    trim: own('trim', { ...look, color: S.trim, metal: 'iron', refl: 0.3, highlight: 0.2, hatch: 0.2 }),
    conduit: own('conduit', { ...look, color: S.conduit, metal: 'iron', refl: 0.35, highlight: 0.25, hatch: 0.2 }),
    glyph: own('glyph', { color: S.gold, glow: 0.76 }),
    glow,
    bronze: own('bronze', bronze),
    bronzeV: own('bronzeV', { ...bronze, vertexColors: true }),
  };
  Object.assign(M, {
    wall: mats.wall, wallGlyph: mats.wallGlyph, floor: mats.floor, trim: mats.trim, stone: mats.conduit, glyph: mats.glyph,
    bands: [{ at: 0.72, h: 0.6, mat: paint(S.band) }],   // (paint: in the house's paint draw)
  });
  // (the eyes, the doors' glyphs, the orbs' glow, made while the layout runs: gold)
  rt.P = { ...rt.P, glow: S.glow };
  K.plan = [];
  const meshes = [];
  const skin = {
    name: 'lamp-house', S, mats, meshes, U, rooms, stats: null,
    /** After the layout: the rooms and basins handed to the shader, the dressing placed and added. */
    dress() {
      const t0 = performance.now(), plan = K.plan, rooms = roomsOf(plan);
      const round = rooms.filter((r) => r.kind === 'round').slice(0, 4);
      round.forEach((r, i) => U.round.value[i].set(r.x, r.z, r.r, r.y0));
      U.roundN.value = round.length;
      const B = basins(rt, mats);
      B.list.slice(0, LAMP_POOLS).forEach((b, i) => U.pools.value[i].set(b.x, b.z, b.r, b.y));
      U.poolN.value = Math.min(LAMP_POOLS, B.list.length);
      const keep = keepOuts(rt, new Set([mats.wall, mats.wallGlyph, mats.floor, mats.water, M.bands[0].mat]));
      skin.stats = { ...dress(rt, mats, keep, plan, rooms, meshes), basins: B.list.length, rings: B.rings, ms: Math.round(performance.now() - t0) };
      for (const m of meshes) K.group.add(m);
      rt.pieces.push(new SkinLife(rt, skin, meshes));
    },
    /** After the kit's flush: the house's own materials and palette back for its exterior; its lights cast no shadow. */
    done() {
      Object.assign(M, was.M); rt.P = was.P; K.plan = null;
      const lit = new Set([mats.glow, mats.glyph]);
      K.group.traverse((o) => { if (o.isMesh && lit.has(o.material)) { o.castShadow = false; o.userData.castShadow = false; } });
    },
  };
  return skin;
}
