import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, sharedUniforms } from '../../materials.js';
import { paint } from '../kit.js';
import { metal, glazing, glaze } from '../landmark-materials.js';
import { Platform } from '../pieces.js';
import { ESC, WELL } from '../garage.js';
import { skinShader, spliceSkin } from './skin-shader.js';

// ---------------------------------------------------------------------------
// The Clock-House in its futuristic skin (issue #342, docs/systems/temples.md "Futuristic skins"): the makers' clock
// redrawn after the author's pick (references/temples/future/clock-house/sheet-1.jpg): a quiet test chamber of dark slate
// round a chasm, brass, warm light and teal glow. Its look only: the same rooms, doors, collision, pieces, timings and
// logic (tests/temple-skins.test.js).
//   1. its surfaces (the surface shader's albedo, first pen lines and glow replaced, as landmark-materials.js stone()
//      does): the walls tall dark slate slabs (few joints, chamfered, a thin brass strip in every third joint), a dark
//      plinth with a thin teal line along its top, a brass rail where the wall turns to the drawing's cream upper drum,
//      and under every landing's lip (the pit's, the chasm's) narrow umber slabs darkening into the deep; the ceilings
//      cream plates; the floors warm grey plates, chamfered, a brass and a teal line inlaid round each hall and round a
//      round room's middle, a teal line down each passage; the makers' machined faces (doors, steles, the climb's block,
//      the clock cases) a finer slate with a teal seam. The teal lines are lights (just over the post pass's 0.62 halo
//      start, so the halo stays a thin edge) and breathe.
//   2. the clock: over the Escapement's pit and high in the Winding Well a column of glass hangs (only its rims and a
//      streak drawn, a pale wash over it: landmark-materials.js glazing), a stream of pale sand stopped mid-fall inside
//      it, glittering grains stopped in the air under it, a nest of thin brass rings each tilted on its own axis round
//      it, a teal circuit dashed round each; under the pit's, a brass disc on a long arm frozen at the end of its swing.
//      Lens terminals round the great rooms' walls, in sixes as the drawing's (two of each six dark), brass rimmed and
//      bolted, a teal core with a pale heart; square slate plates edged in brass floating deep in the gallery's chasm.
//      Drawn only: four merged, vertex-coloured meshes and the glass (noCollide, keepBuried, out of the shadow passes),
//      kept off doorways, pieces and everything drawn on the walls.
//   3. the house's own: its brass darker and warmer (the frames, the dials' rims, the escape wheel), its dark the
//      drawing's umber, the glyphs teal light, no little clocks along the frieze (the lens terminals are the house's
//      ornament now); the escapement's riding disc brass (the drawing's pendulum disc), the doors' and the bridge's
//      slabs the skin's in their own frame (so their pattern moves with them); the Foreman's drum all brass, a pale
//      teal dial (skin.foreman, read by garage.js); the rooms' light warm, its shade umber (skin.light, index.js).
// On Low, Handheld and the Deck (uWearLite) the shader leaves out the slabs' tones and chamfers, and the dressing's
// finest parts (bolts, gratings, dashes, grains) are not drawn. The exterior keeps the house's own (done()).
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
/** Rooms handed to the shader (round ones first, then halls, then passages). */
export const CLOCK_ROOMS = 24;

/** The skin's colours (sRGB, sampled from the pick) and sizes (m). */
export const CLOCK_SKIN = {
  wall: '#565b63', seam: '#25262b', cream: '#e6cc9e', pillar: '#4e5158',
  chasm: '#4b4135', deep: '#1f1b17',
  floor: '#9a9082', floorSeam: '#544d44', lip: '#9a948a',
  machine: '#5a5e66', machineSeam: '#2a2c31',
  brass: '#a07a42', teal: '#4fd6c6', tealPale: '#c4fbf1',
  dark: '#33302b', glyph: '#7fe9dc',
  glass: '#c5e3df', sand: '#d4b07a', grain: '#fff2c9',
  panel: [2.4, 9.0],              // a wall slab's width, the joints across (staggered by column)
  plate: [3.0, 2.6],              // a hall's plate, a round room's ring of plates
  plinth: 0.6,                    // the dark plinth's height, the teal line along its top
  drum: { share: 0.78, min: 7 },  // the cream drum from this share of a room's height (and at least this over its floor)
  emit: { line: 0.74, lens: 0.78, glyph: 0.72 },
  /** the rooms' light (index.js reads it for the house): warm light, an umber shade, as the drawing's */
  light: { shadow: '#aaa294', light: '#fff1d8', sun: '#ffe6bd' },
  /** the Foreman's drum (garage.js foremanModel): all brass, an umber trim, a pale teal dial */
  foreman: { brass: '#c09048', brass2: '#9c7034', teal: '#b08440', dark: '#3c342a', cream: '#cfe8df', glass: '#bfeee4' },
  /** the lens terminals: in sixes round a round room, every `every` m along a great hall's wall, two of six dark */
  lens: { r: 0.92, every: 5.2, perWall: 4, minH: 12 },
};

// ------------------------------------------------------------------ the shader
const PARS = /* glsl */ `
  uniform vec3 uSkinO;
  uniform vec2 uSkRot;
  uniform vec4 uSkR[${CLOCK_ROOMS}];
  uniform vec4 uSkY[${CLOCK_ROOMS}];
  uniform int uSkN;
  uniform float uSkObj;
  uniform vec3 uSkA;
  uniform vec3 uSkB;
  uniform vec3 uSkC;
  uniform vec3 uSkD;
  uniform vec3 uSkE;
  uniform vec3 uSkF;
`;
const C = CLOCK_SKIN;
const f2 = (v) => v.toFixed(2);
const GLSL = /* glsl */ `
  // the kit's local frame (z into the house), from the world
  vec3 chLocal(vec3 w) { vec3 d = w - uSkinO; return vec3(d.x * uSkRot.x - d.z * uSkRot.y, d.y, d.x * uSkRot.y + d.z * uSkRot.x); }
  vec3 chLocalN(vec3 n) { return vec3(n.x * uSkRot.x - n.z * uSkRot.y, n.y, n.x * uSkRot.y + n.z * uSkRot.x); }
  // a line d m from its middle, w m half wide, antialiased (never under about a pixel: thinner broke into dashes)
  float chLine(float d, float fw, float w) { w = max(w, fw * 0.6); return 1.0 - smoothstep(w, w + max(fw, 1e-5) * 1.3, d); }
  // gone once its spacing is under a few pixels
  float chNear(float fw, float every) { return 1.0 - smoothstep(0.12, 0.3, fw / every); }
  // the room a wall face belongs to (its index, or -1) and how far along it p is (m round a round room)
  int chWall(vec3 p, vec3 nn, out float along) {
    along = abs(nn.x) > abs(nn.z) ? p.z : p.x;
    for (int i = 0; i < ${CLOCK_ROOMS}; i++) {
      if (i >= uSkN) break;
      vec4 R = uSkR[i], Y = uSkY[i];
      if (p.y < Y.x - 0.5 || p.y > Y.y + 1.5) continue;
      vec2 d = p.xz - R.xy;
      if (R.w < 0.0) {
        float r = length(d);
        if (abs(r - R.z) < 2.0 && abs(dot(nn.xz, d)) > 0.8 * r * length(nn.xz)) { along = atan(d.y, d.x) * R.z; return i; }
      } else if (abs(d.x) < R.z + 0.5 && abs(d.y) < R.w + 0.5) return i;
    }
    return -1;
  }
  // the room whose floor (its walking level, Y.z) p lies on, or -1
  int chFloor(vec3 p) {
    for (int i = 0; i < ${CLOCK_ROOMS}; i++) {
      if (i >= uSkN) break;
      vec4 R = uSkR[i], Y = uSkY[i];
      if (abs(p.y - Y.z) > 0.6) continue;
      vec2 d = p.xz - R.xy;
      if (R.w < 0.0 ? length(d) < R.z + 0.2 : (abs(d.x) < R.z + 0.2 && abs(d.y) < R.w + 0.2)) return i;
    }
    return -1;
  }
  // the room p stands in (by its plan only), or -1
  int chIn(vec3 p) {
    for (int i = 0; i < ${CLOCK_ROOMS}; i++) {
      if (i >= uSkN) break;
      vec4 R = uSkR[i], Y = uSkY[i];
      if (p.y < Y.x - 1.0 || p.y > Y.y + 1.0) continue;
      vec2 d = p.xz - R.xy;
      if (R.w < 0.0 ? length(d) < R.z + 0.6 : (abs(d.x) < R.z + 0.6 && abs(d.y) < R.w + 0.6)) return i;
    }
    return -1;
  }
  // under a landing's lip: narrow umber slabs, their joints staggered, darkening into the deep
  vec3 chChasm(float along, float depth, out float ink) {
    float w = 1.3, h = 3.6;
    float cx = along / w, col = floor(cx), fx = fract(cx);
    float jy = (depth + hash(vec2(col, 7.1)) * h) / h, fy = fract(jy), row = floor(jy);
    float fwx = max(fwidth(along), 1e-5), fwy = max(fwidth(depth), 1e-5);
    float near = chNear(max(fwx, fwy), 0.6);
    float seam = max(chLine(min(fx, 1.0 - fx) * w, fwx, 0.024), chLine(min(fy, 1.0 - fy) * h, fwy, 0.02));
    vec3 c = uSkE * (1.0 + (hash(vec2(col, row) + 2.3) - 0.5) * 0.14);
    if (uWearLite < 0.5) c *= 1.0 + 0.12 * chLine(fx * w - 0.1, fwx, 0.05) * near - 0.14 * chLine((1.0 - fx) * w - 0.1, fwx, 0.05) * near;
    c = mix(c, uSkF, smoothstep(0.5, 9.0, depth));
    c = mix(c, uSkF * 0.7, seam * 0.8 * near);
    ink = seam * near * 0.5;
    return c;
  }
`;

/**
 * Each body replaces the surface's `vec3 albedo = uColor;` and sets skInk (its first pen lines) and skEmit (its light).
 * uColor the face, uSkA the teal, uSkB the brass, uSkC the seams, uSkD the cream (the walls) or the lip (the floors),
 * uSkE the chasm's umber, uSkF the deep.
 */
const BODIES = {
  wall: /* glsl */ `
    vec3 skP = chLocal(vWorldPos), skN = chLocalN(n);
    float skInk = 0.0, skEmit = 0.0;
    vec3 albedo = uColor;
    {
      bool side = abs(skN.y) < 0.65;
      float along = 0.0;
      int ri = side ? chWall(skP, skN, along) : -1;
      float walk = 0.0, y0 = 0.0, y1 = 1e4;
      if (ri >= 0) { walk = uSkY[ri].z; y0 = uSkY[ri].x; y1 = uSkY[ri].y; }
      float creamY = ri >= 0 ? max(walk + ${f2(C.drum.min)}, y0 + ${f2(C.drum.share)} * (y1 - y0)) : 1e4;
      float breathe = 0.86 + 0.14 * sin(uTime * 0.8 - along * 0.07);
      if (!side) {
        // a ceiling: cream plates; a wall's top: slate
        vec2 q = skP.xz / 6.0, f = fract(q), fq = max(fwidth(q) * 6.0, vec2(1e-5));
        float near = chNear(max(fq.x, fq.y), 0.6);
        float seam = max(chLine(min(f.x, 1.0 - f.x) * 6.0, fq.x, 0.02), chLine(min(f.y, 1.0 - f.y) * 6.0, fq.y, 0.02)) * 0.6;
        albedo = skN.y < 0.0 ? uSkD * 0.8 : uColor * 1.12;
        if (uWearLite < 0.5) albedo *= 1.0 + (hash(floor(q) + 9.1) - 0.5) * 0.05;
        albedo = mix(albedo, skN.y < 0.0 ? uSkD * 0.6 : uSkC, seam * 0.7 * near);
        skInk = seam * near * 0.3;
        if (skN.y < 0.0) skEmit = 0.15;   // (lit a little from within, so it keeps its warmth in the shade: under the halo's 0.62)
      } else if (ri >= 0 && skP.y < walk - 0.3) {
        albedo = chChasm(along, walk - skP.y, skInk);
      } else if (skP.y > creamY) {
        // the cream upper drum: big pale panels, a brass rail at its foot
        float yy = skP.y - creamY;
        vec2 q = vec2(along / 4.8, 0.0), f = fract(q);
        float fwx = max(fwidth(along), 1e-5), fwy = max(fwidth(yy), 1e-5);
        float near = chNear(max(fwx, fwy), 0.8);
        float seam = chLine(min(f.x, 1.0 - f.x) * 4.8, fwx, 0.016);
        albedo = uSkD;
        if (uWearLite < 0.5) albedo *= 1.0 + (hash(floor(q) + 4.2) - 0.5) * 0.05;
        albedo = mix(albedo, uSkD * 0.8, seam * 0.6 * near);
        skInk = seam * near * 0.3;
        skEmit = 0.36;   // (the drawing's warm cream drum, kept warm in the shade: under the halo's 0.62)
        float rail = 1.0 - smoothstep(0.22, 0.22 + fwy, yy);
        albedo = mix(albedo, uSkB, rail);
        skInk = max(skInk, chLine(abs(yy - 0.22), fwy, 0.01) * 0.6);
      } else {
        // the slate: tall slabs ${C.panel[0]} m wide, a joint across every ${C.panel[1]} m (staggered by column)
        float W0 = ${f2(C.panel[0])}, H0 = ${f2(C.panel[1])};
        float yy = skP.y - walk;
        float cx = along / W0, col = floor(cx), fx = fract(cx);
        float qy = yy / H0 + hash(vec2(col, 3.3)), row = floor(qy), fy = fract(qy);
        float fwx = max(fwidth(along), 1e-5), fwy = max(fwidth(skP.y), 1e-5);
        float near = chNear(max(fwx, fwy), 0.8);
        float seam = max(chLine(min(fx, 1.0 - fx) * W0, fwx, 0.022), chLine(min(fy, 1.0 - fy) * H0, fwy, 0.022));
        albedo = uColor;
        if (uWearLite < 0.5) {
          albedo *= 1.0 + (hash(vec2(col, row) + 3.7) - 0.5) * 0.08;
          albedo *= 1.0 + 0.14 * chLine(fx * W0 - 0.1, fwx, 0.06) * near - 0.13 * chLine((1.0 - fx) * W0 - 0.1, fwx, 0.06) * near + 0.08 * chLine((1.0 - fy) * H0 - 0.08, fwy, 0.05) * near;
        }
        albedo = mix(albedo, uSkC, seam * 0.85 * near);
        skInk = seam * near * 0.45;
        // a thin brass strip in every third joint
        float k = floor(cx + 0.5), dj = abs(cx - k) * W0;
        float strip = chLine(dj, fwx, 0.045) * (1.0 - step(0.5, mod(k, 3.0)));
        albedo = mix(albedo, uSkB, strip * near);
        skInk = max(skInk, chLine(abs(dj - 0.05), fwx, 0.008) * (1.0 - step(0.5, mod(k, 3.0))) * 0.5 * near);
        if (ri >= 0) {
          // the dark plinth, a thin teal line along its top
          float py = yy - ${f2(C.plinth)};
          float plinth = 1.0 - smoothstep(-fwy, 0.0, py);
          albedo = mix(albedo, uColor * 0.7, plinth * step(-0.05, yy));
          float line = chLine(abs(py - 0.04), fwy, 0.025) * chNear(fwy, 0.12);
          albedo = mix(albedo, uSkA, line);
          skEmit = max(skEmit, line * ${f2(C.emit.line)} * breathe);
          skInk = max(skInk, chLine(abs(py), fwy, 0.01) * 0.5);
        }
      }
    }
  `,
  floor: /* glsl */ `
    vec3 skP = uSkObj > 0.5 ? vObjPos : chLocal(vWorldPos), skN = uSkObj > 0.5 ? normalize(vObjNormal) : chLocalN(n);
    float skInk = 0.0, skEmit = 0.0;
    vec3 albedo = uColor;
    {
      if (skN.y > 0.65) {
        int ri = uSkObj > 0.5 ? -1 : chFloor(skP);
        vec2 d = skP.xz;
        float seam = 0.0, brass = 0.0, teal = 0.0, nearK = 1.0, lit = 0.0, dark = 0.0;
        vec2 cell = vec2(0.0);
        if (ri >= 0) d = skP.xz - uSkR[ri].xy;
        if (ri >= 0 && uSkR[ri].w < 0.0) {
          // a round room: rings of plates round its middle, a brass and a teal ring round it
          float R = uSkR[ri].z, rr = length(d), a = atan(d.y, d.x);
          float qr = rr / ${f2(C.plate[1])}, ring = floor(qr);
          float nseg = max(6.0, floor(6.2831853 * (ring + 0.5) * ${f2(C.plate[1])} / ${f2(C.plate[0])}));
          float qa = a / 6.2831853 * nseg + hash(vec2(ring, 2.0));
          float fr = max(fwidth(rr), 1e-5), fa = max(fwidth(qa), 1e-5) * rr * 6.2831853 / nseg;
          nearK = chNear(fr, 0.5);
          seam = max(chLine(min(fract(qr), 1.0 - fract(qr)) * ${f2(C.plate[1])}, fr, 0.02), ring > 0.5 ? chLine(min(fract(qa), 1.0 - fract(qa)) * rr * 6.2831853 / nseg, fa, 0.02) : 0.0);
          lit = chLine((1.0 - fract(qr)) * ${f2(C.plate[1])} - 0.09, fr, 0.05);
          dark = chLine(fract(qr) * ${f2(C.plate[1])} - 0.09, fr, 0.05);
          cell = vec2(ring, floor(qa));
          brass = max(chLine(abs(rr - 3.2), fr, 0.08), chLine(abs(rr - (R - 1.0)), fr, 0.07));
          teal = chLine(abs(rr - 3.6), fr, 0.03);
        } else {
          // a hall, a passage (or a piece's slab): square plates from its middle; a hall's brass and teal border, a
          // passage's teal line down its middle
          vec2 q = d / ${f2(C.plate[0])} + 0.5, fq2 = max(fwidth(q) * ${f2(C.plate[0])}, vec2(1e-5));
          vec2 f = fract(q);
          float fq = max(fq2.x, fq2.y);
          nearK = chNear(fq, 0.5);
          cell = floor(q);
          seam = max(chLine(min(f.x, 1.0 - f.x) * ${f2(C.plate[0])}, fq2.x, 0.02), chLine(min(f.y, 1.0 - f.y) * ${f2(C.plate[0])}, fq2.y, 0.02));
          lit = chLine((1.0 - f.y) * ${f2(C.plate[0])} - 0.09, fq2.y, 0.05);
          dark = chLine(f.y * ${f2(C.plate[0])} - 0.09, fq2.y, 0.05);
          if (ri >= 0) {
            vec4 R = uSkR[ri];
            float e = max(abs(d.x) - R.z, abs(d.y) - R.w);
            if (uSkY[ri].w > 0.5) {
              float c = R.z < R.w ? abs(d.x) : abs(d.y);
              teal = chLine(c, fq, 0.03);
              brass = chLine(abs(c - 1.3), fq, 0.05);
            } else {
              brass = chLine(abs(e + 0.9), fq, 0.07);
              teal = chLine(abs(e + 1.35), fq, 0.028);
            }
          }
        }
        if (uWearLite < 0.5) albedo *= (1.0 + (hash(cell + 11.3) - 0.5) * 0.08) * (1.0 + 0.1 * lit * nearK - 0.1 * dark * nearK);
        albedo = mix(albedo, uSkC, seam * 0.7 * nearK);
        albedo = mix(albedo, uSkB, brass);
        skInk = max(seam * 0.5 * nearK, brass * 0.3 * nearK);
        float breathe = 0.86 + 0.14 * sin(uTime * 0.7 + length(d) * 0.2);
        albedo = mix(albedo, uSkA, teal);
        skEmit = teal * ${f2(C.emit.line)} * breathe;
      } else if (skN.y < -0.65) {
        albedo = uSkF * 1.4;
      } else if (uSkObj > 0.5) {
        albedo = uSkD * 0.9;
      } else {
        // a slab's face: a pale slate lip, a brass line under it, umber slabs below (a landing over a pit or a chasm)
        float along = abs(skN.x) > abs(skN.z) ? skP.z : skP.x;
        int ri = chIn(skP);
        float walk = ri >= 0 ? uSkY[ri].z : skP.y + 0.3;
        float depth = walk - skP.y, fwy = max(fwidth(skP.y), 1e-5);
        if (depth < 0.62) {
          albedo = uSkD;
          float b = chLine(abs(depth - 0.55), fwy, 0.04);
          albedo = mix(albedo, uSkB, b);
          skInk = chLine(abs(depth - 0.5), fwy, 0.008) * 0.6;
        } else albedo = chChasm(along, depth, skInk);
      }
    }
  `,
  machine: /* glsl */ `
    vec3 skP = uSkObj > 0.5 ? vObjPos : chLocal(vWorldPos), skN = uSkObj > 0.5 ? normalize(vObjNormal) : chLocalN(n);
    float skInk = 0.0, skEmit = 0.0;
    vec3 albedo = uColor;
    {
      vec3 an = abs(skN);
      vec2 uv = an.y > 0.65 ? skP.xz : vec2(an.x > an.z ? skP.z : skP.x, skP.y);
      // machined panels 1.6 by 4.8, chamfered, a teal seam every 9.6 m (a door's: between
      // its leaves)
      vec2 q = vec2(uv.x / 1.6 + 0.5, uv.y / 4.8), f = fract(q), fq = max(fwidth(q), vec2(1e-5));
      vec2 dm = min(f, 1.0 - f) * vec2(1.6, 4.8), dfw = fq * vec2(1.6, 4.8);
      float near = chNear(max(dfw.x, dfw.y), 0.8);
      float seam = max(chLine(dm.x, dfw.x, 0.02), chLine(dm.y, dfw.y, 0.02));
      if (uWearLite < 0.5) {
        albedo *= 1.0 + (hash(floor(q) + 1.3) - 0.5) * 0.06;
        albedo *= 1.0 + 0.12 * chLine((1.0 - f.y) * 4.8 - 0.07, dfw.y, 0.05) * near - 0.1 * chLine(f.y * 4.8 - 0.07, dfw.y, 0.05) * near;
      }
      albedo = mix(albedo, uSkC, seam * 0.8 * near);
      skInk = seam * near * 0.55;
      float mid = abs(fract(uv.x / 9.6 + 0.5) - 0.5) * 9.6;
      float line = chLine(mid, dfw.x, 0.03) * near * step(an.y, 0.65);
      albedo = mix(albedo, uSkB, chLine(abs(mid - 0.09), dfw.x, 0.025) * near * step(an.y, 0.65));
      albedo = mix(albedo, uSkA, line);
      skEmit = line * ${f2(C.emit.line)} * (0.86 + 0.14 * sin(uTime * 1.1 + uv.y * 0.3));
    }
  `,
};
/** The pattern, as data the web's shader and the Unity port's are both made from (skin-shader.js). */
const SHADER = skinShader('clock-house', { pars: PARS, glsl: GLSL, bodies: BODIES, ink: 'skInk', emit: 'skEmit', emitAt: 'init' });

/** One of the skin's surface materials: makeMaterial's, its albedo and first pen lines the body's, its glow skEmit. */
function skinMaterial(body, look, U, key, obj = false) {
  const m = makeMaterial({ flat: true, ...look, key: `temple.skin.clock.${key}` });
  // (this build's rooms: a material from the cache is pointed at them again)
  Object.assign(m.uniforms, { uSkinO: U.origin, uSkRot: U.rot, uSkR: U.rooms, uSkY: U.roomsY, uSkN: U.count });
  if (m.userData.clockSkin) return m;
  spliceSkin(m, SHADER, body, 'clock-house.js');
  const S = CLOCK_SKIN;
  Object.assign(m.uniforms, {
    uSkObj: { value: obj ? 1 : 0 },
    uSkA: { value: new THREE.Color(S.teal) }, uSkB: { value: new THREE.Color(S.brass) },
    uSkC: { value: new THREE.Color(body === 'floor' ? S.floorSeam : body === 'machine' ? S.machineSeam : S.seam) },
    uSkD: { value: new THREE.Color(body === 'floor' ? S.lip : S.cream) },
    uSkE: { value: new THREE.Color(S.chasm) }, uSkF: { value: new THREE.Color(S.deep) },
  });
  m.userData.clockSkin = body;
  return m;
}

// ------------------------------------------------------------------ the dressing's shapes
/** Vertex colours over a geometry (non-indexed, uv dropped), all one colour (or a grey tone over the material's). */
function tinted(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo, c = typeof hex === 'number' ? new THREE.Color(hex, hex, hex) : new THREE.Color(hex);
  if (!g.attributes.normal) g.computeVertexNormals();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

/**
 * The dressing's meshes, one a material: each part coarse (drawn on every preset) or fine (left out on the lighter ones:
 * the merged geometry's draw range stops short of them).
 */
class Parts {
  constructor() { this.by = new Map(); }
  add(mat, geo, fine = false) {
    if (!this.by.has(mat)) this.by.set(mat, { coarse: [], fine: [] });
    this.by.get(mat)[fine ? 'fine' : 'coarse'].push(geo);
  }
  meshes(name) {
    const out = [];
    for (const [mat, { coarse, fine }] of this.by) {
      if (!coarse.length && !fine.length) continue;
      const geo = mergeGeometries([...coarse, ...fine]);
      const n = coarse.reduce((s, g) => s + g.attributes.position.count, 0);
      const m = new THREE.Mesh(geo, mat);
      m.name = `${name}: ${mat.userData.clockPart}`;
      m.userData.noCollide = true; m.userData.keepBuried = true; m.userData.skin = true; m.userData.dynamic = true;
      m.userData.coarse = n; m.userData.fine = fine.length > 0;
      m.castShadow = false; m.receiveShadow = true; m.userData.castShadow = false;
      geo.computeBoundingSphere();
      out.push(m);
    }
    return out;
  }
}

/**
 * A lens terminal facing +z, its back at z = 0 (on the wall's face), s its scale: a bolted brass rim, a dark bezel, a
 * teal core with a pale heart (lit) or a dark grating (dark).
 */
function lens(P, mats, frame, s, lit) {
  const put = (mat, g, fine = false) => P.add(mat, g.applyMatrix4(frame), fine);
  put(mats.brassV, tinted(lathe([[0.6, 0], [0.6, 0.1], [0.68, 0.17], [0.88, 0.17], [0.96, 0.1], [0.96, 0]], 28).rotateX(Math.PI / 2).scale(s, s, s), 1));
  put(mats.darkV, tinted(new THREE.RingGeometry(0.46 * s, 0.61 * s, 28).translate(0, 0, 0.09 * s), '#25272b'));
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + Math.PI / 8; put(mats.brassV, tinted(new THREE.BoxGeometry(0.08 * s, 0.08 * s, 0.05 * s).translate(Math.cos(a) * 0.79 * s, Math.sin(a) * 0.79 * s, 0.19 * s), 0.72), true); }
  if (lit) {
    put(mats.tealV, tinted(new THREE.CircleGeometry(0.47 * s, 28).translate(0, 0, 0.06 * s), CLOCK_SKIN.teal));
    put(mats.tealV, tinted(new THREE.CircleGeometry(0.17 * s, 16).translate(0, 0, 0.075 * s), CLOCK_SKIN.tealPale));
    put(mats.tealV, tinted(new THREE.RingGeometry(0.27 * s, 0.3 * s, 24).translate(0, 0, 0.075 * s), '#8ef1e2'), true);
  } else {
    put(mats.darkV, tinted(new THREE.CircleGeometry(0.47 * s, 28).translate(0, 0, 0.06 * s), '#1c1e20'));
    for (const r of [0.1, 0.2, 0.3, 0.4]) put(mats.darkV, tinted(new THREE.RingGeometry(r * s, (r + 0.025) * s, 24).translate(0, 0, 0.075 * s), '#4d5150'), true);
  }
}

/**
 * The clock (local m): a column of glass from `top` down to `bottom` at (x, z), radius r; the sand in it stopped at
 * `stop`, its heap at the foot; tilted brass rings round it (each { r, y, ax, az } its radius, its height, its tilts);
 * the collars, the machinery under it down to `shaft`, an arm and its disc (arm: [x, y, z] the disc's middle, R).
 */
function clock(P, mats, glass, K, o) {
  const { x, z, top, bottom, r } = o, W = (g) => g.applyMatrix4(K.frame);
  const put = (mat, g, fine = false) => P.add(mat, W(g), fine);
  const h = top - bottom;
  // the glass (its rims and a streak drawn, a pale wash laid over it after the flush)
  glass.push(W(new THREE.CylinderGeometry(r, r, h, 32, 1, true).translate(x, bottom + h / 2, z)));
  // the collars: stepped brass discs top and foot, a teal ring round the foot's
  const collar = (y, dir) => {
    put(mats.brassV, tinted(lathe([[0.01, 0], [r + 0.45, 0], [r + 0.45, 0.32], [r + 0.2, 0.42], [r + 0.2, 0.62], [r - 0.05, 0.72], [0.01, 0.72]], 36).scale(1, dir, 1).translate(x, y, z), 0.92));
    put(mats.tealV, tinted(new THREE.TorusGeometry(r + 0.47, 0.045, 4, 48).rotateX(Math.PI / 2).translate(x, y + dir * 0.16, z), CLOCK_SKIN.teal));
  };
  collar(top, -1); collar(bottom, 1);
  // the cage: thin rods from collar to collar
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; put(mats.brassV, tinted(new THREE.CylinderGeometry(0.035, 0.035, h - 1.2, 5).translate(x + Math.cos(a) * (r + 0.18), bottom + h / 2, z + Math.sin(a) * (r + 0.18)), 0.85), true); }
  // the sand: a stream from the top widening as it falls, stopped at `stop` (rounded), a heap on the foot's collar
  const s0 = top - 0.7, s1 = o.stop;
  const prof = [[0.001, s0], [0.16, s0 - 0.05]];
  for (let i = 1; i <= 10; i++) { const t = i / 10; prof.push([0.16 + 0.34 * t * t, s0 + (s1 - s0) * t]); }
  prof.push([0.36, s1 - 0.12], [0.18, s1 - 0.22], [0.001, s1 - 0.25]);
  put(mats.sandV, tinted(lathe(prof, 14).translate(x, 0, z), CLOCK_SKIN.sand));
  put(mats.sandV, tinted(lathe([[r * 0.9, 0], [r * 0.7, 0.18], [r * 0.4, 0.38], [0.001, 0.48]], 20).translate(x, bottom + 0.72, z), '#cdb07c'));
  // grains stopped in the air under the stream and beside it (seeded: the same each build)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < o.grains; i++) {
    const y = bottom + 1.7 + (s1 - bottom - 1.7) * rnd() ** 0.8, a = rnd() * TAU, rr = 0.55 * Math.sqrt(rnd());
    put(mats.sandV, tinted(new THREE.OctahedronGeometry(0.025 + 0.03 * rnd(), 0).translate(x + Math.cos(a) * rr, y, z + Math.sin(a) * rr), CLOCK_SKIN.grain), true);
  }
  // the rings: thin brass hoops each tilted on its own axis, a teal circuit dashed round its outer edge
  for (const g of o.rings) {
    const q = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI / 2 + g.ax, g.ay ?? 0, g.az, 'YXZ')).setPosition(x, g.y, z);
    const tube = g.tube ?? 0.075;
    put(mats.brassV, tinted(new THREE.TorusGeometry(g.r, tube, 5, 72).applyMatrix4(q), 1));
    const n = Math.max(8, Math.round(g.r * 3));
    for (let k = 0; k < n; k++) if ((k * 7 + Math.round(g.r * 10)) % 5 !== 0) put(mats.tealV, tinted(new THREE.TorusGeometry(g.r + tube * 0.95, 0.026, 3, 5, (TAU / n) * 0.55).rotateZ((k / n) * TAU).applyMatrix4(q), CLOCK_SKIN.teal), true);
  }
  // the machinery under the foot: a stack of discs, a shaft down into the dark, a teal ring
  if (o.shaft != null) {
    let y = bottom;
    for (const [rr, hh] of [[r + 0.7, 0.35], [r + 0.2, 0.5], [r - 0.3, 0.45], [0.7, 0.6]]) { put(mats.brassV, tinted(new THREE.CylinderGeometry(rr, rr * 0.96, hh, 28).translate(x, y - hh / 2, z), 0.8)); y -= hh; }
    put(mats.tealV, tinted(new THREE.TorusGeometry(r + 0.25, 0.04, 4, 40).rotateX(Math.PI / 2).translate(x, bottom - 0.6, z), CLOCK_SKIN.teal));
    put(mats.brassV, tinted(new THREE.CylinderGeometry(0.28, 0.28, y - o.shaft, 10).translate(x, (y + o.shaft) / 2, z), 0.7));
  }
  // the pendulum's disc on its long arm, frozen at the end of its swing
  if (o.arm) {
    const [ax, ay, az, R] = o.arm, from = V(x, bottom - 1.2, z), to = V(ax, ay, az), L = from.distanceTo(to);
    const m = new THREE.Matrix4().lookAt(from, to, V(0, 1, 0)).setPosition(from.clone().lerp(to, 0.5));
    put(mats.brassV, tinted(new THREE.BoxGeometry(0.5, 0.35, L).applyMatrix4(m), 0.85));
    put(mats.brassV, tinted(new THREE.CylinderGeometry(R, R, 0.3, 48).translate(ax, ay, az), 1));
    // (its face engraved: a ring and a cross, a shade darker, 2 cm over it)
    put(mats.brassV, tinted(new THREE.RingGeometry(R * 0.86, R * 0.88, 48).rotateX(-Math.PI / 2).translate(ax, ay + 0.17, az), 0.6));
    for (const a of [0, Math.PI / 2]) put(mats.brassV, tinted(new THREE.PlaneGeometry(R * 1.7, 0.035).rotateX(-Math.PI / 2).rotateY(a).translate(ax, ay + 0.17, az), 0.6));
    put(mats.brassV, tinted(new THREE.RingGeometry(0.16, 0.24, 20).rotateX(-Math.PI / 2).translate(ax, ay + 0.17, az), 0.6));
  }
  // the hangers: rods from the top collar out to the ceiling's ring (hung: [radius, height])
  if (o.hang) for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + 0.3, from = V(x + Math.cos(a) * (r + 0.3), top + 0.6, z + Math.sin(a) * (r + 0.3)), to = V(x + Math.cos(a) * o.hang[0], o.hang[1], z + Math.sin(a) * o.hang[0]);
    const m = new THREE.Matrix4().lookAt(from, to, V(0, 1, 0)).setPosition(from.clone().lerp(to, 0.5));
    put(mats.brassV, tinted(new THREE.BoxGeometry(0.12, 0.12, from.distanceTo(to)).applyMatrix4(m), 0.8));
  }
}

/** A square slate plate floating, edged in brass (local m: its middle, its side, its tilt). */
function plate(P, mats, K, [x, y, z], side, tilt) {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(tilt[0], tilt[1], tilt[2])).setPosition(x, y, z).premultiply(K.frame);
  P.add(mats.darkV, tinted(new THREE.BoxGeometry(side, 0.4, side), '#646059').applyMatrix4(m));
  const e = side / 2 + 0.04;
  for (const [w, d, ox, oz] of [[side + 0.16, 0.08, 0, e], [side + 0.16, 0.08, 0, -e], [0.08, side, e, 0], [0.08, side, -e, 0]]) P.add(mats.brassV, tinted(new THREE.BoxGeometry(w, 0.3, d).translate(ox, 0.06, oz), 0.9).applyMatrix4(m));
}

// ------------------------------------------------------------------ placing the dressing
/** The kit's rooms (local): round rooms, halls and passages, with each one's walking level (a landing's, over a pit). */
function roomsOf(plan, K) {
  const out = [], floors = [];
  for (const g of K.batches.get(K.M.floor) ?? []) { g.computeBoundingBox(); floors.push(g.boundingBox.clone().applyMatrix4(K.inv)); }
  for (const e of plan) {
    if (e.kind === 'round') out.push({ kind: 'round', x: e.x, z: e.z, r: e.r, y0: e.y, y1: e.y + e.h, walk: e.y, e });
    else if (e.kind === 'hall') {
      const R = { kind: 'hall', x: e.x, z: e.z, hx: e.w / 2, hz: e.d / 2, y0: e.y, y1: e.y + e.h, walk: e.y, e };
      // (a hall with no floor of its own: its landings' tops, the highest floor laid in it under its roof)
      if (e.floor === false) {
        let top = -Infinity;
        for (const b of floors) if (b.max.y > e.y + 0.5 && b.max.y < e.y + e.h - 2 && b.min.x > R.x - R.hx - 1 && b.max.x < R.x + R.hx + 1 && b.min.z > R.z - R.hz - 1 && b.max.z < R.z + R.hz + 1 && b.max.x - b.min.x > R.hx) top = Math.max(top, b.max.y);
        if (Number.isFinite(top)) R.walk = top;
      }
      out.push(R);
    } else if (e.kind === 'corridor') out.push({ kind: 'corridor', x: (e.x0 + e.x1) / 2, z: (e.z0 + e.z1) / 2, hx: (e.x1 - e.x0) / 2, hz: (e.z1 - e.z0) / 2, y0: e.y, y1: e.y + e.h, walk: e.y, e });
  }
  return [...out.filter((r) => r.kind === 'round'), ...out.filter((r) => r.kind === 'hall'), ...out.filter((r) => r.kind === 'corridor')];
}
const inside = (R, x, y, z) => y >= R.y0 - 0.5 && y <= R.y1 && (R.kind === 'round' ? Math.hypot(x - R.x, z - R.z) < R.r - 0.3 : Math.abs(x - R.x) < R.hx - 0.3 && Math.abs(z - R.z) < R.hz - 0.3);
const creamOf = (R) => Math.max(R.walk + CLOCK_SKIN.drum.min, R.y0 + CLOCK_SKIN.drum.share * (R.y1 - R.y0));

/**
 * What the dressing keeps off (local boxes): every piece and the way it moves, every doorway, and everything the layout
 * drew that is not a room's surface (the clocks, the frames, the steles, the climb's block, the wheels).
 */
function keepOuts(rt, surfaces, plan) {
  const K = rt.kit, out = [], b = new THREE.Box3();
  for (const [mat, list] of K.batches) {
    if (surfaces.has(mat)) continue;
    const machine = mat === K.M.wallGlyph;
    for (const g of list) {
      g.computeBoundingBox();
      const l = g.boundingBox.clone().applyMatrix4(K.inv), s = l.getSize(V());
      if (s.x > 6 && s.z > 6) continue;                          // (a floor's slab, a ceiling's ring)
      if (!machine && Math.max(s.x, s.z) > 14 && s.y < 1.5) continue;   // (a wall's long cap)
      out.push(l.expandByScalar(0.5));
    }
  }
  for (const p of rt.pieces) {
    const o = p.group ?? p.mesh ?? p.root;
    if (o?.isObject3D) { b.setFromObject(o); if (!b.isEmpty()) { const l = b.clone().applyMatrix4(K.inv), s = l.getSize(V()); if (Math.max(s.x, s.z) < 30 && s.y < 30) out.push(l.expandByScalar(0.8)); } }
    for (const q of [p.pos, p.at]) if (q?.isVector3) out.push(new THREE.Box3().setFromCenterAndSize(K.local(q), V(3, 3, 3)));
    if (p.path) for (const q of p.path) out.push(new THREE.Box3().setFromCenterAndSize(K.local(q), V(6, 4, 6)));
  }
  // the doorways: each hole and gap, 1.5 m round it
  for (const e of plan) {
    if (e.kind === 'wall') {
      const t = V(e.dir[0], 0, e.dir[1]);
      for (const o of e.holes) {
        const a = V(e.a[0], 0, e.a[1]).addScaledVector(t, o.x0 - 1.5), c = V(e.a[0], 0, e.a[1]).addScaledVector(t, o.x1 + 1.5);
        out.push(new THREE.Box3().setFromPoints([a.setY(e.y0 + o.y0 - 1), c.setY(e.y0 + o.y1 + 1.5)]).expandByVector(V(e.t + 1, 0, e.t + 1)));
      }
    } else if (e.kind === 'round') {
      for (const g of e.gaps) {
        const da = (g.w / 2 + 1.5) / e.r, pts = [];
        for (const a of [g.a - da, g.a, g.a + da]) for (const rr of [e.r - 1, e.r + e.t]) pts.push(V(e.x + Math.sin(a) * rr, e.y + (g.y0 ?? 0) - 1, e.z + Math.cos(a) * rr), V(e.x + Math.sin(a) * rr, e.y + (g.y0 ?? 0) + g.h + 1.5, e.z + Math.cos(a) * rr));
        out.push(new THREE.Box3().setFromPoints(pts));
      }
    }
  }
  return out;
}

/**
 * The lens terminals: round each great round room six (on the stones' middles, the ring turned to miss the most
 * doorways and things), along each long wall of a great hall a row; two of each six dark. Returns how many.
 */
function lenses(P, mats, K, plan, rooms, keep) {
  const S = CLOCK_SKIN.lens, pattern = [1, 1, 0, 1, 1, 0];
  let n = 0, lit = 0;
  const hit = (p, nrm, s) => { const c = p.clone().addScaledVector(nrm, 0.3), e = 1.0 * s; return keep.some((k) => k.intersectsBox(new THREE.Box3(V(c.x - e, c.y - e, c.z - e), V(c.x + e, c.y + e, c.z + e)))); };
  const place = (p, t, nrm, s, on) => {
    const m = new THREE.Matrix4().makeBasis(t, V(0, 1, 0), nrm).setPosition(p.clone().addScaledVector(nrm, 0.03)).premultiply(K.frame);
    lens(P, mats, m, s, on); n++; if (on) lit++;
  };
  const heightOf = (R) => R.walk + THREE.MathUtils.clamp((creamOf(R) - R.walk) * 0.55, 4.5, 11);
  for (const R of rooms) {
    if (R.kind !== 'round' || R.y1 - R.walk < S.minH) continue;
    const e = R.e, step = TAU / e.seg, y = heightOf(R), s = R.r >= 16 ? 1.35 : 1.15;
    let best = null;
    for (let off = 0; off < Math.ceil(e.seg / 6); off++) {
      const at = [];
      for (let k = 0; k < 6; k++) {
        const i = Math.round(off + (k * e.seg) / 6) % e.seg, a = (i + 0.5) * step;
        const nrm = V(-Math.sin(a), 0, -Math.cos(a)), p = V(e.x + Math.sin(a) * e.r, y, e.z + Math.cos(a) * e.r);
        if (!hit(p, nrm, s)) at.push({ k, p, nrm, t: V(Math.cos(a), 0, -Math.sin(a)) });
      }
      if (!best || at.length > best.length) best = at;
    }
    for (const L of best) place(L.p, L.t, L.nrm, s, pattern[L.k]);
  }
  for (const e of plan) {
    if (e.kind !== 'wall' || e.L < 20) continue;
    const t = V(e.dir[0], 0, e.dir[1]), n0 = V(e.dir[1], 0, -e.dir[0]);
    for (const sd of [1, -1]) {
      const nrm = n0.clone().multiplyScalar(sd), mid = V(e.a[0], 0, e.a[1]).addScaledVector(t, e.L / 2).addScaledVector(nrm, e.t / 2);
      const R = rooms.find((q) => q.kind === 'hall' && inside(q, mid.x + nrm.x * 1.2, q.walk + 1, mid.z + nrm.z * 1.2));
      if (!R || R.y1 - R.walk < S.minH) continue;
      const y = heightOf(R), s = 1.1, cnt = Math.min(S.perWall, Math.floor((e.L - 6) / S.every));
      // (the row in two halves either side of the wall's middle, where its doorway mostly is)
      const xs = [];
      for (let k = 0; k < cnt; k++) xs.push(e.L / 2 + (k % 2 ? 1 : -1) * (S.every * (1 + Math.floor(k / 2)) - S.every / 2));
      xs.sort((a, b) => a - b).forEach((x, k) => {
        const p = V(e.a[0], y, e.a[1]).addScaledVector(t, x).addScaledVector(nrm, e.t / 2);
        if (!hit(p, nrm, s)) place(p, t.clone().multiplyScalar(-sd), nrm, s, pattern[k % 6]);
      });
    }
  }
  return { lenses: n, lit };
}

// ------------------------------------------------------------------ the lights' life
/** The finest dressing left out on the lighter presets (uWearLite), and the teal breathing. */
class SkinLife {
  constructor(meshes, teal) { this.meshes = meshes; this.teal = teal; this.lite = null; }
  update(dt, t = 0) {
    const lite = sharedUniforms.uWearLite.value > 0.5;
    if (lite !== this.lite) {
      this.lite = lite;
      for (const m of this.meshes) if (m.userData.fine) m.geometry.setDrawRange(0, lite ? m.userData.coarse : Infinity);
    }
    this.teal.uniforms.uGlow.value = CLOCK_SKIN.emit.lens * (0.9 + 0.1 * Math.sin(t * 1.3));
  }
}

// ------------------------------------------------------------------ the house's skin
/**
 * The Clock-House's skin (its def's `skin`, src/temples/skins/index.js): called before the layout. Swaps rt.M's
 * surfaces for its own and starts the kit's plan; skin.foreman (the Foreman's colours) and skin.light (the rooms') are
 * read by garage.js and index.js. globalThis.__noHouseSkin: none, for a bench's before and after (as ?noskin=1).
 */
export function clockHouseSkin(rt) {
  if (globalThis.__noHouseSkin) return null;
  const K = rt.kit, M = rt.M, S = CLOCK_SKIN, look = rt.def.palette?.look?.all ?? {};
  const U = {
    origin: { value: K.origin.clone() }, rot: { value: new THREE.Vector2(Math.cos(K.yaw), Math.sin(K.yaw)) },
    rooms: { value: Array.from({ length: CLOCK_ROOMS }, () => new THREE.Vector4()) },
    roomsY: { value: Array.from({ length: CLOCK_ROOMS }, () => new THREE.Vector4()) },
    count: { value: 0 },
  };
  const own = (k, o) => { const m = makeMaterial({ flat: true, ...o, key: `temple.skin.clock.${k}` }); m.userData.clockPart = k; return m; };
  // (the shade deeper and warmer than the house's own cream: the drawing's slate is dark, its shadows umber)
  const deep = { ...look, shade: 0.2, shadeFlat: 0.05 };
  const brass = { color: S.brass, metal: 'brass', refl: 0.5, highlight: 0.3, glow: 0.12, shade: 0.15, shadeFlat: 0, hatch: 0.2 };
  const mats = {
    wall: skinMaterial('wall', { ...deep, color: S.wall, hatch: 0.15 }, U, 'wall'),
    floor: skinMaterial('floor', { ...deep, color: S.floor, hatch: 0.45 }, U, 'floor'),
    machine: skinMaterial('machine', { ...deep, color: S.machine, hatch: 0.2 }, U, 'machine'),
    // (the pieces' copies: the pattern in their own frame, so it moves with them)
    floorObj: skinMaterial('floor', { ...deep, color: S.floor, hatch: 0.45 }, U, 'floorObj', true),
    machineObj: skinMaterial('machine', { ...deep, color: S.machine, hatch: 0.2 }, U, 'machineObj', true),
    trim: own('trim', brass),
    disc: own('disc', { ...brass, glow: 0.18 }),
    pillar: own('pillar', { ...deep, color: S.pillar, hatch: 0.2 }),
    glyph: own('glyph', { color: S.glyph, glow: S.emit.glyph }),
    // the dressing's: vertex-coloured (a grey tone over the brass; the others their own colours)
    brassV: own('brass', { ...brass, side: THREE.DoubleSide, vertexColors: true }),
    tealV: own('teal', { color: '#ffffff', glow: S.emit.lens, side: THREE.DoubleSide, vertexColors: true }),
    darkV: own('dark', { ...deep, color: '#ffffff', hatch: 0.25, side: THREE.DoubleSide, vertexColors: true }),
    sandV: own('sand', { color: '#ffffff', glow: 0.22, vertexColors: true }),
    glass: glazing(S.glass),
  };
  mats.glass.userData.clockPart = 'glass';
  const was = { ...M }, wasP = rt.P;
  // (the layout's own brass, metal('#d8a24a'): the frames of its dials, the escape wheel, the beams; the skin's after it)
  const houseBrass = metal('#d8a24a');
  Object.assign(M, {
    wall: mats.wall, floor: mats.floor, wallGlyph: mats.machine, trim: mats.trim, glyph: mats.glyph,
    dark: paint(S.dark), bands: [], ornament: { kind: null },
  });
  K.plan = [];
  const meshes = [];
  const skin = {
    name: 'clock-house', S, mats, U, meshes, stats: null, light: S.light, foreman: S.foreman,
    /** After the layout: the rooms handed to the shader, the house's brass and pieces in the skin's, the dressing placed. */
    dress() {
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      const plan = K.plan, rooms = roomsOf(plan, K).slice(0, CLOCK_ROOMS);
      rooms.forEach((r, i) => {
        U.rooms.value[i].set(r.x, r.z, r.kind === 'round' ? r.r : r.hx, r.kind === 'round' ? -1 : r.hz);
        U.roomsY.value[i].set(r.y0, r.y1, r.walk, r.kind === 'corridor' ? 1 : 0);
      });
      U.count.value = rooms.length;
      // the layout's brass in the skin's
      const hb = K.batches.get(houseBrass);
      if (hb) { K.batches.delete(houseBrass); K.batches.set(mats.trim, [...(K.batches.get(mats.trim) ?? []), ...hb]); }
      // the columns (the kit's, in the trim: its tall round pieces) in slate, not brass, as the drawing has none of brass
      const trim = K.batches.get(mats.trim) ?? [], pillars = [];
      for (let i = trim.length - 1; i >= 0; i--) {
        const g = trim[i];
        g.computeBoundingBox();
        const sz = g.boundingBox.clone().applyMatrix4(K.inv).getSize(V());
        if (sz.y > 6 && sz.x > 1.2 && sz.z > 1.2 && sz.x < 3.2 && sz.z < 3.2) pillars.push(...trim.splice(i, 1));
      }
      // (and the chest's mound: slate, a pedestal, not a pool of brass)
      for (let i = trim.length - 1; i >= 0; i--) {
        const g = trim[i], sz = g.boundingBox ? g.boundingBox.clone().applyMatrix4(K.inv).getSize(V()) : null;
        if (sz && sz.y < 1.5 && sz.x > 5 && sz.x < 10 && Math.abs(sz.x - sz.z) < 0.3) pillars.push(...trim.splice(i, 1));
      }
      if (pillars.length) K.batches.set(mats.pillar, pillars);
      // the pieces: the riding disc brass, the doors' and the bridge's slabs the skin's in their own frame
      let swapped = 0;
      for (const p of rt.pieces) {
        const g = p.group ?? p.mesh ?? p.root;
        g?.traverse?.((o) => {
          if (!o.isMesh) return;
          if (o.material === mats.floor) { o.material = p instanceof Platform ? mats.disc : mats.floorObj; swapped++; } else if (o.material === mats.machine || o.material === mats.wall) { o.material = mats.machineObj; swapped++; }
        });
      }
      // the dressing, kept off doorways, pieces and everything drawn
      const keep = keepOuts(rt, new Set([mats.wall, mats.floor]), plan);
      const P = new Parts(), glass = [];
      const L = lenses(P, mats, K, plan, rooms, keep);
      // the clock over the Escapement's pit: hung from its beam, the sand stopped over the walkway's height, a disc on
      // its arm frozen out over the deep (all east of the riding disc's way and the dial's tower)
      clock(P, mats, glass, K, {
        x: 9.6, z: (ESC.near + ESC.far) / 2, top: 16.65, bottom: 1.2, r: 1.15, stop: 6.4, grains: 90, shaft: ESC.y, arm: [12.4, -3.4, 21.6, 2.3],
        rings: [{ r: 4.1, y: 4.6, ax: 0.18, az: -0.32 }, { r: 3.6, y: 5.4, ax: -0.42, az: 0.12 }, { r: 3.1, y: 6.6, ax: 0.08, az: 0.5, ay: 0.7 },
          { r: 2.6, y: 3.6, ax: 0.55, az: 0.2, ay: 1.4 }, { r: 3.8, y: 8.4, ax: -0.15, az: -0.12, ay: 2.1 }, { r: 2.2, y: 9.6, ax: 0.3, az: 0.35, ay: 0.4, tube: 0.06 }],
      });
      // and high in the Winding Well, under its oculus, hung from the ring round it (well over every walkway)
      const wellTop = WELL.h - 0.9;
      clock(P, mats, glass, K, {
        x: 0, z: WELL.z, top: wellTop, bottom: wellTop - 9.4, r: 1.0, stop: wellTop - 6.2, grains: 60, hang: [WELL.r * 0.3 + 0.2, WELL.h + 0.4],
        rings: [{ r: 4.0, y: wellTop - 5.8, ax: 0.2, az: -0.3 }, { r: 3.4, y: wellTop - 5.0, ax: -0.45, az: 0.15, ay: 0.9 }, { r: 2.8, y: wellTop - 4.0, ax: 0.1, az: 0.5, ay: 2.0 },
          { r: 2.3, y: wellTop - 7.0, ax: 0.5, az: 0.2, ay: 1.2, tube: 0.06 }, { r: 3.6, y: wellTop - 3.0, ax: -0.2, az: -0.15, ay: 2.6, tube: 0.06 }],
      });
      // square plates floating deep in the gallery's chasm, a walkway going down into the dark
      const gal = rooms.find((r) => r.kind === 'hall' && r.e.floor === false && r.walk > 5);
      let plates = 0;
      if (gal) {
        const z0 = gal.z - gal.hz;
        for (const [x, dy, dz, tl] of [[-8.5, -7.2, 9.5, [0.04, 0.2, -0.05]], [-9.2, -8.1, 13.4, [-0.06, -0.3, 0.04]], [-8.2, -9.0, 17.6, [0.03, 0.5, 0.06]], [8.6, -7.6, 15.2, [0.05, -0.2, -0.04]], [9.4, -8.6, 19.4, [-0.04, 0.35, 0.05]], [8.4, -9.4, 23.2, [0.06, 0.1, -0.03]]]) {
          plate(P, mats, K, [x, gal.walk + dy, z0 + dz], 2.6, tl); plates++;
        }
      }
      for (const m of P.meshes(`${rt.def.name} skin`)) { K.group.add(m); meshes.push(m); }
      if (glass.length) {
        const g = new THREE.Mesh(mergeGeometries(glass), mats.glass);
        g.name = `${rt.def.name} skin: the clock's glass`;
        g.userData.noCollide = true; g.userData.keepBuried = true; g.userData.skin = true; g.userData.dynamic = true;
        g.castShadow = false; g.userData.castShadow = false;
        g.geometry.computeBoundingSphere();
        K.group.add(g); meshes.push(g);
      }
      rt.pieces.push(new SkinLife(meshes, mats.tealV));
      skin.stats = { rooms: rooms.length, ...L, clocks: 2, plates, swapped, ms: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0) };
    },
    /** After the kit's flush: the glowing out of the shadow passes, the glass's wash, the house's own materials back. */
    done() {
      for (const m of K.group.children) if (m.material === mats.glyph) { m.castShadow = false; m.userData.castShadow = false; }
      if (rt.level) glaze(K, rt.veils, mats.glass, { color: '#cfe6e0', alpha: 0.1, glow: 0.12 });
      Object.keys(M).forEach((k) => { if (!(k in was)) delete M[k]; });
      Object.assign(M, was);
      rt.P = wasP;
      K.plan = null;
    },
  };
  return skin;
}
