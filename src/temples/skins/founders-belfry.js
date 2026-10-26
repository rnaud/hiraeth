import { glyphGeometry } from '../../story/sign-text.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from '../../materials.js';
import { paint, T } from '../kit.js';
import { BellEar } from '../pieces.js';
import { MOUND } from '../../boxes/mound.js';
import { skinShader, spliceSkin } from './skin-shader.js';
import { MK_GLSL } from './machined.js';

// ---------------------------------------------------------------------------
// The Founders' Belfry in its futuristic skin (issue #342, docs/systems/temples.md "Futuristic skins"): its rooms as an
// ancient high-tech test chamber, after the author's picked drawings (references/temples/future/founders-belfry/
// sheet-1.jpg, sheet-2.jpg). Its look only: the same rooms, doors, collision, pieces, timings and logic.
//   1. its surfaces (the surface shader's albedo and first pen lines replaced, as landmark-materials.js stone() does):
//      dark slate walls in tall chamfered slabs edged in bronze, a ledge band part way up, pilasters with a lit slot at
//      their foot (hatching cut to a fifth, as the sheet's sparse shadows), a cobalt circuit inlaid round each
//      room that jogs between two heights; slate floor plates with bronze and cobalt rings round each round room's
//      middle, a bronze and cobalt border round each hall's, a cobalt line down each passage; the doors two heavy slate
//      leaves, a cobalt seam between them. Every cobalt line glows (a light to the post pass: it blooms) and breathes.
//   2. the note: while a founders' bell rings (or the whistle sounds) pale cobalt rings spread from it over every floor
//      and wall near it (the shader, from uSkBell), and faint rings hang in the air round the bell (a drawn-only mesh,
//      hidden while it is quiet).
//   3. its bells (arzach2.js hang asks skin.bell): not cups but resonators, four heavy chamfered bronze rings a ring's
//      height apart round a dark core, held by nothing, a cobalt line round each, the makers' sign on the lowest. Its dressing beside every
//      tall doorway: a column of lens terminals on a cobalt line. Drawn only, in the kit's batches (one draw for all
//      the bronze, one for all the cobalt), out of the shadow passes, kept off doorways and pieces. The
//      chest's mound drawn as a hexagonal slate pedestal with lit panels over its own collider (skin.pedestal).
// On Low, Handheld and the Deck (uWearLite) the shader leaves out the chamfers' light and shade and the tone of each
// panel. The exterior keeps the house's own stone (done() puts its materials back).
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
/** Rooms handed to the shader (round ones first), and the note's sources (the bells, the whistle). */
export const BELFRY_ROOMS = 16;
export const BELFRY_NOTES = 6;

/** The skin's colours (sRGB) and sizes (m), after the picked sheets. */
export const BELFRY_SKIN = {
  wall: '#5f667b', wallSeam: '#353a4b', pilaster: '#545a6e',
  floor: '#989cae', floorSeam: '#6c7184',
  door: '#596074',
  bronze: '#a67c45', cobalt: '#4c6ef5', cobaltPale: '#93abff', pillar: '#5a6175', pedestal: '#565c70', slot: '#ffeccc',
  dark: '#2f3446', stone: '#a4a8b8', band: '#666c80',
  panel: [2.6, 6.0, 7.8],        // a slab's width, the joints across, the pilasters' spacing
  ledge: 4.4,                    // the ledge band's foot over the floor
  plate: [3.0, 2.6],             // a hall's plate, a round room's ring of plates
  circuit: [1.1, 0.45, 3.0],     // the circuit's height over the floor, its jog, the run between jogs
  note: { speed: 5.5, every: 2.6, reach: 18 },
  lens: { r: 0.15, ring: [0.19, 0.27], at: [2.2, 3.2, 4.2, 5.2], line: [0.3, 6.2], out: 1.25 },
};

// ------------------------------------------------------------------ the shader
const PARS = /* glsl */ `
  uniform vec3 uSkinO;
  uniform vec2 uSkRot;
  uniform vec4 uSkR[${BELFRY_ROOMS}];
  uniform vec4 uSkY[${BELFRY_ROOMS}];
  uniform int uSkN;
  uniform vec4 uSkBell[${BELFRY_NOTES}];
  uniform vec3 uSkA;
  uniform vec3 uSkB;
  uniform vec3 uSkC;
  uniform vec3 uSkD;
`;
const GLSL = /* glsl */ `
  // the kit's local frame (z into the house), from the world
  vec3 fbLocal(vec3 w) { vec3 d = w - uSkinO; return vec3(d.x * uSkRot.x - d.z * uSkRot.y, d.y, d.x * uSkRot.y + d.z * uSkRot.x); }
  vec3 fbLocalN(vec3 n) { return vec3(n.x * uSkRot.x - n.z * uSkRot.y, n.y, n.x * uSkRot.y + n.z * uSkRot.x); }
  // a line d m from its middle, w m half wide, antialiased by fw (d's change a pixel)
  // (never under about a pixel wide: a thinner line broke into dashes at a low resolution)
  float fbLine(float d, float fw, float w) { w = max(w, fw * 0.6); return 1.0 - smoothstep(w, w + max(fw, 1e-5) * 1.3, d); }
  // gone once its spacing is under a few pixels
  float fbNear(float fw, float every) { return 1.0 - smoothstep(0.12, 0.3, fw / every); }
  // the room a wall face belongs to: along it (m round a round room), its floor's height (y), 1 if found (z)
  vec3 fbWall(vec3 p, vec3 nn) {
    for (int i = 0; i < ${BELFRY_ROOMS}; i++) {
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
  int fbFloor(vec3 p) {
    for (int i = 0; i < ${BELFRY_ROOMS}; i++) {
      if (i >= uSkN) break;
      vec4 R = uSkR[i], Y = uSkY[i];
      if (abs(p.y - Y.x) > 0.6) continue;
      vec2 d = p.xz - R.xy;
      if (R.w < 0.0 ? length(d) < R.z + 0.2 : (abs(d.x) < R.z + 0.2 && abs(d.y) < R.w + 0.2)) return i;
    }
    return -1;
  }
  // the note: pale rings spreading from every bell that rings (uSkBell: local xyz, how loud)
  float fbNote(vec3 p) {
    float k = 0.0;
    for (int i = 0; i < ${BELFRY_NOTES}; i++) {
      vec4 B = uSkBell[i];
      if (B.w <= 0.001) continue;
      float d = length(p - B.xyz);
      float ph = d / ${BELFRY_SKIN.note.every.toFixed(2)} - uTime * ${(BELFRY_SKIN.note.speed / BELFRY_SKIN.note.every).toFixed(3)};
      float dm = abs(fract(ph) - 0.5) * ${BELFRY_SKIN.note.every.toFixed(2)};
      float fw = fwidth(d);
      float ring = fbLine(abs(dm - ${(BELFRY_SKIN.note.every / 2).toFixed(2)}), fw, 0.05) * fbNear(fw, 0.6);
      k = max(k, ring * B.w * (1.0 - smoothstep(${(BELFRY_SKIN.note.reach * 0.4).toFixed(1)}, ${BELFRY_SKIN.note.reach.toFixed(1)}, d)) * smoothstep(0.8, 2.0, d));
    }
    return k;
  }
`;

/**
 * Each body replaces the surface's `vec3 albedo = uColor;` and sets skInk (its pen lines: the detail) and skEmit (what
 * glows: the post pass's light). uColor the face, uSkA the cobalt, uSkB the bronze, uSkC the seams, uSkD the lit slots.
 */
const BODIES = {
  wall: /* glsl */ `
    vec3 skP = fbLocal(vWorldPos), skN = fbLocalN(n);
    float skInk = 0.0, skEmit = 0.0;
    vec3 albedo = uColor;
    {
      bool side = abs(skN.y) < 0.65;
      vec3 W = side ? fbWall(skP, skN) : vec3(skP.x, 0.0, 0.0);
      vec2 uv = side ? vec2(W.x, skP.y) : skP.xz;
      // the slabs: tall panels ${BELFRY_SKIN.panel[0]} m wide, a joint across only every ${BELFRY_SKIN.panel[1]} m up from the
      // room's floor, each vertical seam edged with thin bronze; chamfered (a pale bevel down one edge, a dark one down the other)
      float base = side && W.z > 0.5 ? W.y : 0.0;
      vec2 q = vec2(uv.x / ${BELFRY_SKIN.panel[0].toFixed(2)}, (uv.y - base) / ${BELFRY_SKIN.panel[1].toFixed(2)});
      vec2 cell = floor(q), f = fract(q), fq = fwidth(q);
      vec2 dm = min(f, 1.0 - f) * vec2(${BELFRY_SKIN.panel[0].toFixed(2)}, ${BELFRY_SKIN.panel[1].toFixed(2)});
      vec2 dfw = fq * vec2(${BELFRY_SKIN.panel[0].toFixed(2)}, ${BELFRY_SKIN.panel[1].toFixed(2)});
      float near = fbNear(max(dfw.x, dfw.y), 1.0);
      float seam = max(fbLine(dm.x, dfw.x, 0.022), fbLine(dm.y, dfw.y, 0.022));
      float edged = fbLine(abs(dm.x - 0.075), dfw.x, 0.014) * fbNear(dfw.x, 0.25);
      albedo = uColor;
      if (uWearLite < 0.5) {
        albedo *= 1.0 + (hash(cell + 3.7) - 0.5) * 0.06;
        float lE = f.x * ${BELFRY_SKIN.panel[0].toFixed(2)}, rE = (1.0 - f.x) * ${BELFRY_SKIN.panel[0].toFixed(2)}, tE = (1.0 - f.y) * ${BELFRY_SKIN.panel[1].toFixed(2)};
        albedo *= 1.0 + 0.12 * fbLine(lE - 0.2, dfw.x, 0.05) * near - 0.1 * fbLine(rE - 0.2, dfw.x, 0.05) * near + 0.1 * fbLine(tE - 0.08, dfw.y, 0.05) * near;
      }
      albedo = mix(albedo, uSkC, seam * 0.8 * near);
      albedo = mix(albedo, uSkB, edged * near);
      skInk = seam * near * 0.45;
      // the makers' finish (machined.js) on the slab
      skInk = max(skInk, mkFinish((f - 0.5) * vec2(${BELFRY_SKIN.panel[0].toFixed(2)}, ${BELFRY_SKIN.panel[1].toFixed(2)}), 0.5 * vec2(${BELFRY_SKIN.panel[0].toFixed(2)}, ${BELFRY_SKIN.panel[1].toFixed(2)}), cell.x * 13.1 + cell.y * 7.7, max(dfw.x, dfw.y), false, albedo));
      if (side && W.z > 0.5) {
        // the ledge band part way up: a darker course, pale on its top edge, a bronze rail under it
        float ly = skP.y - W.y - ${BELFRY_SKIN.ledge.toFixed(2)}, lfw = fwidth(ly);
        float band = (1.0 - smoothstep(0.0, lfw, ly - 0.32)) * smoothstep(-lfw, 0.0, ly);
        albedo = mix(albedo, uColor * 0.72, band);
        albedo = mix(albedo, uColor * 1.3, fbLine(abs(ly - 0.3), lfw, 0.025));
        albedo = mix(albedo, uSkB, fbLine(abs(ly + 0.04), lfw, 0.04));
        skInk = max(skInk, max(fbLine(abs(ly - 0.32), lfw, 0.01), fbLine(abs(ly), lfw, 0.01)) * 0.5 * near);
      }
      if (side && W.z > 0.5) {
        float yy = skP.y - W.y;
        // the pilasters: a darker slab every ${BELFRY_SKIN.panel[2]} m, bronze at its edges, a lit slot at its foot
        float px = abs(fract(uv.x / ${BELFRY_SKIN.panel[2].toFixed(2)}) - 0.5) * ${BELFRY_SKIN.panel[2].toFixed(2)};
        float pfw = fwidth(uv.x);
        float pil = 1.0 - smoothstep(0.55, 0.55 + pfw, px);
        albedo = mix(albedo, uColor * 0.86, pil);
        float edge = fbLine(abs(px - 0.55), pfw, 0.035);
        albedo = mix(albedo, uSkB, edge * fbNear(pfw, 0.2));
        skInk = max(skInk, edge * 0.5 * near);
        float slot = (1.0 - smoothstep(0.11, 0.11 + pfw, px)) * step(0.55, yy) * step(yy, 2.35);
        albedo = mix(albedo, uSkD, slot);
        skEmit = max(skEmit, slot * 0.72);   // (a light, its halo kept tight: just over the post pass's 0.62)
        skInk = max(skInk, fbLine(abs(px - 0.13), pfw, 0.012) * step(0.5, yy) * step(yy, 2.4) * 0.6 * near);
        // the circuit: a cobalt line round the room, jogging between two heights every ${BELFRY_SKIN.circuit[2]} m
        float run = ${BELFRY_SKIN.circuit[2].toFixed(2)}, cx = uv.x / run, c = floor(cx), fx = fract(cx);
        float h0 = ${BELFRY_SKIN.circuit[0].toFixed(2)} + ${BELFRY_SKIN.circuit[1].toFixed(2)} * step(0.5, hash(vec2(c - 1.0, 5.3)));
        float h1 = ${BELFRY_SKIN.circuit[0].toFixed(2)} + ${BELFRY_SKIN.circuit[1].toFixed(2)} * step(0.5, hash(vec2(c, 5.3)));
        float h2 = ${BELFRY_SKIN.circuit[0].toFixed(2)} + ${BELFRY_SKIN.circuit[1].toFixed(2)} * step(0.5, hash(vec2(c + 1.0, 5.3)));
        float fy = fwidth(yy);
        float d = abs(yy - h1);
        if (yy > min(h0, h1) - 0.03 && yy < max(h0, h1) + 0.03) d = min(d, fx * run);
        if (yy > min(h1, h2) - 0.03 && yy < max(h1, h2) + 0.03) d = min(d, (1.0 - fx) * run);
        float line = fbLine(d, max(fy, pfw), 0.04) * fbNear(max(fy, pfw), 0.15) * (1.0 - pil);
        // (and a lens where it jogs)
        float lens = fbLine(length(vec2(fx * run, yy - h1)), max(fy, pfw), 0.09) * step(0.5, abs(h1 - h0)) * (1.0 - pil);
        float breathe = 0.78 + 0.22 * sin(uTime * 0.9 - uv.x * 0.08);
        float glowK = max(line, lens);
        albedo = mix(albedo, uSkA, glowK);
        skEmit = max(skEmit, glowK * breathe);
      }
      float note = fbNote(skP);
      albedo = mix(albedo, mix(uSkA, vec3(1.0), 0.25), note);
      skEmit = max(skEmit, note);
    }
  `,
  floor: /* glsl */ `
    vec3 skP = fbLocal(vWorldPos), skN = fbLocalN(n);
    float skInk = 0.0, skEmit = 0.0;
    vec3 albedo = uColor;
    {
      if (skN.y > 0.65) {
        int ri = fbFloor(skP);
        vec2 d = skP.xz;
        float seam = 0.0, bronze = 0.0, cobalt = 0.0, disc = 0.0, nearK = 1.0;
        vec2 cell = vec2(0.0), mkL = vec2(0.0), mkS = vec2(0.0);
        float mkPx = 1.0;
        if (ri >= 0) d = skP.xz - uSkR[ri].xy;
        if (ri >= 0 && uSkR[ri].w < 0.0) {
          // a round room: rings of plates round its middle, radial seams, bronze and cobalt rings in the stone
          float R = uSkR[ri].z, rr = length(d), a = atan(d.y, d.x);
          float qr = rr / ${BELFRY_SKIN.plate[1].toFixed(2)}, ring = floor(qr);
          float nseg = max(6.0, floor(6.2831853 * (ring + 0.5) * ${BELFRY_SKIN.plate[1].toFixed(2)} / ${BELFRY_SKIN.plate[0].toFixed(2)}));
          float qa = a / 6.2831853 * nseg + hash(vec2(ring, 2.0));
          float fr = fwidth(rr), fa = fwidth(qa) * rr * 6.2831853 / nseg;
          nearK = fbNear(fr, 0.5);
          seam = max(fbLine(min(fract(qr), 1.0 - fract(qr)) * ${BELFRY_SKIN.plate[1].toFixed(2)}, fr, 0.02), ring > 0.5 ? fbLine(min(fract(qa), 1.0 - fract(qa)) * rr * 6.2831853 / nseg, fa, 0.02) : 0.0);
          cell = vec2(ring, floor(qa));
          if (ring > 0.5) { mkL = vec2((fract(qa) - 0.5) * rr * 6.2831853 / nseg, (fract(qr) - 0.5) * ${BELFRY_SKIN.plate[1].toFixed(2)}); mkS = vec2(3.14159265 * (ring + 0.5) * ${BELFRY_SKIN.plate[1].toFixed(2)} / nseg, 0.5 * ${BELFRY_SKIN.plate[1].toFixed(2)}); mkPx = max(fr, fa); }
          float r1 = 3.3, r2 = R * 0.62;
          disc = 1.0 - smoothstep(r1 - 0.05, r1 - 0.05 + fr, rr);
          bronze = max(fbLine(abs(rr - r1), fr, 0.1), fbLine(abs(rr - r2), fr, 0.12));
          bronze = max(bronze, fbLine(abs(rr - (R - 0.9)), fr, 0.07));
          cobalt = max(fbLine(abs(rr - (r1 + 0.45)), fr, 0.035), fbLine(abs(rr - (r2 + 0.4)), fr, 0.035));
        } else {
          // a hall or a passage: square plates from its middle; a hall's bronze and cobalt border, a passage's cobalt line
          vec2 q = d / ${BELFRY_SKIN.plate[0].toFixed(2)} + 0.5, fq2 = fwidth(q) * ${BELFRY_SKIN.plate[0].toFixed(2)};
          vec2 f = fract(q);
          float fq = max(fq2.x, fq2.y);
          nearK = fbNear(fq, 0.5);
          cell = floor(q);
          mkL = (f - 0.5) * ${BELFRY_SKIN.plate[0].toFixed(2)}; mkS = vec2(0.5 * ${BELFRY_SKIN.plate[0].toFixed(2)}); mkPx = fq;
          seam = max(fbLine(min(f.x, 1.0 - f.x) * ${BELFRY_SKIN.plate[0].toFixed(2)}, fq2.x, 0.02), fbLine(min(f.y, 1.0 - f.y) * ${BELFRY_SKIN.plate[0].toFixed(2)}, fq2.y, 0.02));
          if (ri >= 0) {
            vec4 R = uSkR[ri];
            float e = max(abs(d.x) - R.z, abs(d.y) - R.w);
            bool passage = uSkY[ri].z > 0.5;
            if (passage) {
              // (down the passage's length, toward the doors at its ends)
              float c = R.z < R.w ? abs(d.x) : abs(d.y);
              cobalt = fbLine(c, fq, 0.04);
              bronze = fbLine(abs(c - 1.1), fq, 0.06);
            } else {
              bronze = fbLine(abs(e + 1.8), fq, 0.1);
              cobalt = fbLine(abs(e + 2.35), fq, 0.035);
              float rr = length(d);
              bronze = max(bronze, fbLine(abs(rr - 2.6), fq, 0.09));
              cobalt = max(cobalt, fbLine(abs(rr - 3.05), fq, 0.035));
              disc = 1.0 - smoothstep(2.55, 2.55 + fq, rr);
            }
          }
        }
        if (uWearLite < 0.5) albedo *= 1.0 + (hash(cell + 11.3) - 0.5) * 0.07;
        albedo = mix(albedo, uSkC, seam * 0.6 * nearK);
        albedo = mix(albedo, uColor * 0.8, disc);
        albedo = mix(albedo, uSkB, bronze);
        skInk = max(seam * 0.5 * nearK, bronze * 0.35 * nearK);
        // the makers' finish (machined.js) on the plate (not on the inlaid metal or the middle's disc)
        if (mkS.x > 0.0) skInk = max(skInk, mkFinish(mkL, mkS, cell.x * 17.0 + cell.y * 5.0, mkPx, true, albedo) * (1.0 - bronze) * (1.0 - disc));
        float breathe = 0.75 + 0.25 * sin(uTime * 0.7 + length(d) * 0.25);
        albedo = mix(albedo, uSkA, cobalt);
        skEmit = cobalt * breathe;
      } else {
        // a slab's edge (a landing's face, a ledge's): darker, as the sheet's slate
        albedo = uColor * 0.74;
      }
      float note = fbNote(skP);
      albedo = mix(albedo, mix(uSkA, vec3(1.0), 0.25), note);
      skEmit = max(skEmit, note);
    }
  `,
  door: /* glsl */ `
    vec3 skP = fbLocal(vWorldPos), skN = fbLocalN(n);
    float skInk = 0.0, skEmit = 0.0;
    vec3 albedo = uColor;
    {
      vec3 an = abs(skN);
      vec2 uv = an.y > 0.65 ? skP.xz : vec2(an.x > an.z ? skP.z : skP.x, skP.y);
      // two heavy leaves (the seam down the middle glows), each of two slabs, 2 m courses, chamfered
      vec2 q = vec2(uv.x / 1.75, uv.y / 2.25), f = fract(q), fq = fwidth(q);
      vec2 dm = min(f, 1.0 - f) * vec2(1.75, 2.25), dfw = fq * vec2(1.75, 2.25);
      float near = fbNear(max(dfw.x, dfw.y), 0.8);
      float seam = max(fbLine(dm.x, dfw.x, 0.02), fbLine(dm.y, dfw.y, 0.02));
      if (uWearLite < 0.5) {
        albedo *= 1.0 + (hash(floor(q) + 1.3) - 0.5) * 0.06;
        albedo *= 1.0 + 0.1 * fbLine((1.0 - f.y) * 2.25 - 0.07, dfw.y, 0.05) * near - 0.08 * fbLine(f.y * 2.25 - 0.07, dfw.y, 0.05) * near;
      }
      albedo = mix(albedo, uSkC, seam * 0.75 * near);
      skInk = seam * near * 0.6;
      float mid = abs(fract(uv.x / 7.0 + 0.5) - 0.5) * 7.0;
      float line = fbLine(mid, dfw.x, 0.035) * near * step(an.y, 0.65);
      albedo = mix(albedo, uSkA, line);
      skEmit = line * (0.8 + 0.2 * sin(uTime * 1.2 + uv.y * 0.4));
    }
  `,
  cobalt: /* glsl */ `
    vec3 skP = fbLocal(vWorldPos);
    float skInk = 0.0, skEmit = 0.8;   // (a light, its halo kept tight)
    vec3 albedo = uColor;
    {
      // breathing, and whiter near a bell while it rings
      float k = 0.0;
      for (int i = 0; i < ${BELFRY_NOTES}; i++) { vec4 B = uSkBell[i]; if (B.w > 0.001) k = max(k, B.w * (1.0 - smoothstep(2.0, 6.0, length(skP - B.xyz)))); }
      albedo = mix(uColor * (0.9 + 0.1 * sin(uTime * 1.1 + skP.y * 0.6)), uSkD, k * (0.55 + 0.45 * sin(uTime * 9.0)));
    }
  `,
};

/** The pattern, as data the web's shader and the Unity port's are both made from (skin-shader.js). */
const SHADER = skinShader('founders-belfry', { pars: PARS, glsl: GLSL + MK_GLSL, bodies: BODIES, ink: 'skInk', emit: 'skEmit', emitAt: 'init' });

/** One of the skin's surface materials: makeMaterial's, its albedo and first pen lines the body's, its glow skEmit. */
function skinMaterial(body, look, U, key) {
  const m = makeMaterial({ flat: true, ...look, key: `temple.skin.belfry.${key}` });
  // (this build's rooms and notes: a material from the cache is pointed at them again)
  Object.assign(m.uniforms, { uSkinO: U.origin, uSkRot: U.rot, uSkR: U.rooms, uSkY: U.roomsY, uSkN: U.count, uSkBell: U.bells });
  if (m.userData.belfrySkin) return m;
  spliceSkin(m, SHADER, body, 'founders-belfry.js');
  const S = BELFRY_SKIN;
  Object.assign(m.uniforms, {
    uSkA: { value: new THREE.Color(S.cobalt) }, uSkB: { value: new THREE.Color(S.bronze) },
    uSkC: { value: new THREE.Color(body === 'floor' ? S.floorSeam : S.wallSeam) }, uSkD: { value: new THREE.Color(body === 'cobalt' ? S.cobaltPale : S.slot) },
  });
  m.userData.belfrySkin = body;
  return m;
}

// ------------------------------------------------------------------ the bells
/** A ring of a bell: a chamfered band r0..r1, y0..y1 (lathed). */
function ringGeometry(r0, r1, y0, y1, c, seg = 40) {
  const pts = [[r0, y0 + c], [r0 + c, y0], [r1 - c, y0], [r1, y0 + c], [r1, y1 - c], [r1 - c, y1], [r0 + c, y1], [r0, y1 - c], [r0, y0 + c]];
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

// ------------------------------------------------------------------ placing the dressing
/** The kit's rooms (local): round rooms, halls and passages, as the shader takes them. */
function roomsOf(plan) {
  const out = [];
  for (const e of plan) {
    if (e.kind === 'round') out.push({ kind: 'round', x: e.x, z: e.z, r: e.r, y0: e.y, y1: e.y + e.h, e });
    else if (e.kind === 'hall') out.push({ kind: 'hall', x: e.x, z: e.z, hx: e.w / 2, hz: e.d / 2, y0: e.y, y1: e.y + e.h, e });
    else if (e.kind === 'corridor') out.push({ kind: 'corridor', x: (e.x0 + e.x1) / 2, z: (e.z0 + e.z1) / 2, hx: (e.x1 - e.x0) / 2, hz: (e.z1 - e.z0) / 2, y0: e.y, y1: e.y + e.h, e });
  }
  return [...out.filter((r) => r.kind === 'round'), ...out.filter((r) => r.kind === 'hall'), ...out.filter((r) => r.kind === 'corridor')];
}
const inside = (R, x, y, z) => y >= R.y0 - 0.5 && y <= R.y1 && (R.kind === 'round' ? Math.hypot(x - R.x, z - R.z) < R.r - 0.3 : Math.abs(x - R.x) < R.hx - 0.3 && Math.abs(z - R.z) < R.hz - 0.3);

/** What the dressing keeps off (local boxes): every piece, and every small thing the layout drew on a wall (glyphs). */
function keepOuts(rt, mats) {
  const K = rt.kit, out = [], b = new THREE.Box3();
  for (const [mat, list] of K.batches) {
    if (mat !== rt.M.glyph && mat !== mats.cobalt) continue;
    for (const g of list) { g.computeBoundingBox(); out.push(g.boundingBox.clone().applyMatrix4(K.inv).expandByScalar(0.4)); }
  }
  for (const p of rt.pieces) {
    const o = p.group ?? p.mesh ?? p.root;
    if (o?.isObject3D) { b.setFromObject(o); if (!b.isEmpty()) { const l = b.clone().applyMatrix4(K.inv), s = l.getSize(V()); if (Math.max(s.x, s.z) < 14 && s.y < 30) out.push(l.expandByScalar(0.6)); } }
    for (const q of [p.pos, p.at]) if (q?.isVector3) out.push(new THREE.Box3().setFromCenterAndSize(K.local(q), V(2.4, 2.4, 2.4)));
  }
  return out;
}

/**
 * The faces beside every tall doorway, where a column of lens terminals stands: { o (on the face at the room's floor,
 * local), t (along the face), nrm (out of it, into the room) } for each side of each hole at least 5 m high.
 */
function doorSides(plan, rooms) {
  const out = [], S = BELFRY_SKIN.lens;
  const room = (p) => rooms.find((R) => R.kind !== 'corridor' && inside(R, p.x, p.y + 1, p.z));
  for (const e of plan) {
    if (e.kind === 'wall') {
      const t = V(e.dir[0], 0, e.dir[1]), n0 = V(e.dir[1], 0, -e.dir[0]);
      for (const o of e.holes) {
        if (o.y1 - o.y0 < 5) continue;
        for (const [x, side] of [[o.x0 - S.out, -1], [o.x1 + S.out, 1]]) {
          if (x < 0.5 || x > e.L - 0.5) continue;
          for (const s of [1, -1]) {
            const nrm = n0.clone().multiplyScalar(s), p = V(e.a[0], e.y0 + o.y0, e.a[1]).addScaledVector(t, x).addScaledVector(nrm, e.t / 2);
            const R = room(p.clone().addScaledVector(nrm, 0.8));
            if (R) out.push({ o: p, t: t.clone().multiplyScalar(side), nrm, R });
          }
        }
      }
    } else if (e.kind === 'round') {
      const step = TAU / e.seg;
      for (const g of e.gaps) {
        if (g.h < 5) continue;
        for (const sd of [-1, 1]) {
          const a = g.a + sd * (g.w / 2 + S.out) / e.r, i = Math.floor((((a % TAU) + TAU) % TAU) / step), as = (i + 0.5) * step;
          const nrm = V(-Math.sin(as), 0, -Math.cos(as)), t = V(Math.cos(as), 0, -Math.sin(as));
          const off = e.r * Math.tan(a - as);
          if (Math.abs(off) > e.r * Math.tan(step / 2) - 0.45) continue;   // (not across the joint of two stones)
          const p = V(e.x + Math.sin(as) * e.r, e.y + (g.y0 ?? 0), e.z + Math.cos(as) * e.r).addScaledVector(t, off);
          out.push({ o: p, t, nrm, R: { kind: 'round', y0: e.y } });
        }
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ the note: its sources each frame
/** The note's sources: each founders' bell (its ear: loud while it rings) and the whistle where it sounds. */
class BelfryNote {
  constructor(rt, U, sources, rings = []) {
    this.rt = rt; this.U = U; this.sources = sources; this.whistle = 0; this.rings = rings; this.t = 0;
    this.off = rt.game?.on?.('bell', ({ pos, soft } = {}) => {
      if (!pos || soft) return;
      const l = rt.kit.local(pos);
      U.bells.value[BELFRY_NOTES - 1].set(l.x, l.y + 1.4, l.z, U.bells.value[BELFRY_NOTES - 1].w);
      this.whistle = 2.6;
    });
  }
  update(dt) {
    const L = this.rt.logic, B = this.U.bells.value;
    this.sources.forEach((s, i) => {
      const ear = s.ear, lit = L.isLit(ear.id);
      if (lit && !s.was) s.t = 0;
      s.was = lit; s.t = (s.t ?? 99) + dt;
      // a held note as long as it holds (fading over its last seconds), one that stays lit for a few seconds
      const want = !lit ? 0 : ear.hold ? Math.min(1, ear.left / 2) : Math.max(0, 1 - s.t / 6);
      B[i].w += (want - B[i].w) * Math.min(1, dt * 5);
      // the bell's faint rings in the air, shown only while it sounds, breathing out and in
      const m = this.rings[i];
      if (m) { m.visible = B[i].w > 0.08; if (m.visible) m.scale.setScalar(1 + 0.06 * Math.sin(this.t * 5 + i)); }
    });
    this.t += dt;
    this.whistle = Math.max(0, this.whistle - dt);
    const w = B[BELFRY_NOTES - 1];
    w.w += ((this.whistle > 0 ? Math.min(1, this.whistle) : 0) - w.w) * Math.min(1, dt * 6);
  }
  dispose() { this.off?.(); }
}

// ------------------------------------------------------------------ the house's skin
/**
 * The Founders' Belfry's skin (its def's `skin`, src/temples/skins/index.js): called before the layout. Swaps rt.M's
 * surfaces (and rt.P's glow) for its own and starts the kit's plan; skin.bell draws a bell for arzach2.js hang.
 * globalThis.__noHouseSkin: none, for a bench's before and after in one page load (as ?noskin=1).
 */
export function foundersBelfrySkin(rt) {
  if (globalThis.__noHouseSkin) return null;
  const K = rt.kit, M = rt.M, S = BELFRY_SKIN, look = rt.def.palette?.look?.all ?? {};
  const U = {
    origin: { value: K.origin.clone() }, rot: { value: new THREE.Vector2(Math.cos(K.yaw), Math.sin(K.yaw)) },
    rooms: { value: Array.from({ length: BELFRY_ROOMS }, () => new THREE.Vector4()) },
    roomsY: { value: Array.from({ length: BELFRY_ROOMS }, () => new THREE.Vector4()) },
    count: { value: 0 },
    bells: { value: Array.from({ length: BELFRY_NOTES }, () => new THREE.Vector4()) },
  };
  const own = (k, o) => makeMaterial({ flat: true, ...o, key: `temple.skin.belfry.${k}` });
  const mats = {
    wall: skinMaterial('wall', { ...look, color: S.wall, hatch: 0.15 }, U, 'wall'),
    floor: skinMaterial('floor', { ...look, color: S.floor, hatch: 0.55 }, U, 'floor'),
    door: skinMaterial('door', { ...look, color: S.door, hatch: 0.2 }, U, 'door'),
    cobalt: skinMaterial('cobalt', { color: S.cobalt, glow: 1, side: THREE.DoubleSide }, U, 'cobalt'),
    bronze: own('bronze', { color: S.bronze, metal: 'brass', refl: 0.08 }),
    pillar: own('pillar', { ...look, color: S.pillar, hatch: 0.2 }),
    pedestal: own('pedestal', { ...look, color: S.pedestal, hatch: 0.2, side: THREE.DoubleSide }),
    lit: own('lit', { color: S.slot, glow: 0.72, side: THREE.DoubleSide }),
    stoneMat: own('stone', { ...look, color: S.stone, color2: '#9397a8', color3: '#b3b6c3', mode: MODE_STRATA, strataSize: 0.7 }),
    glyph: own('glyph', { color: S.cobaltPale, glow: 0.9 }),
  };
  const was = { ...M }, wasP = rt.P;
  Object.assign(M, {
    wall: mats.wall, floor: mats.floor, wallGlyph: mats.door, trim: mats.bronze, stoneMat: mats.stoneMat, glyph: mats.glyph,
    dark: paint(S.dark), stone: paint(S.stone),
    bands: [{ at: 0.72, h: 0.7, mat: paint(S.band) }],
    ornament: { kind: 'porthole', mats: { a: mats.bronze, b: mats.cobalt } },
  });
  // (the pieces' own glow, cobalt: the doors' medallions, the plates' rims, the balls' lines)
  rt.P = { ...wasP, glow: S.cobaltPale };
  K.plan = [];
  const bells = [];
  const skin = {
    name: 'founders-belfry', mats, U, bells, stats: null,
    /**
     * A founders' bell (arzach2.js hang): its mouth at `at` (local), s its scale, `ear` the BellEar it answers to. A
     * resonator, not a cup: four heavy chamfered bronze rings a ring's height apart round a dark core, a cobalt line round each, the
     * makers' sign on the lowest (front and back), cobalt round the lowest's underside. Drawn only. Returns true.
     */
    bell([x, y, z], s, ear, face = 0) {
      const bronze = [], cobalt = [], dark = [];
      // (four heavy rings, a gap as tall as a ring between each: the dark core seen through every gap)
      const n = 4, H = 4.2 * s, h = H / (2 * n - 1), gap = h;
      let low = null;
      for (let k = 0; k < n; k++) {
        const r1 = s * (1.55 - 0.07 * k), r0 = r1 - 0.36 * s, y0 = y + k * (h + gap), y1 = y0 + h;
        bronze.push(ringGeometry(r0, r1, y0, y1, 0.08 * s).translate(x, 0, z));
        cobalt.push(new THREE.CylinderGeometry(r1 + 0.02, r1 + 0.02, 0.035 * s, 48, 1, true).translate(x, y0 + h * (k ? 0.5 : 0.75), z));
        if (!k) low = { r1, y0, y1 };
      }
      cobalt.push(new THREE.RingGeometry(low.r1 - 0.24 * s, low.r1 - 0.17 * s, 48).rotateX(Math.PI / 2).translate(x, y - 0.02, z));
      dark.push(new THREE.CylinderGeometry(0.88 * s, 0.88 * s, H + 0.6 * s, 20).translate(x, y + H / 2 + 0.1 * s, z));
      for (const sd of [0, Math.PI]) {
        // (the shared makers' mark, src/story/sign-text.js: under the lowest ring's cobalt line)
        const a = face + sd, r = low.r1 + 0.025;
        cobalt.push(T(glyphGeometry(0.34 * s, 0.03), [x + Math.sin(a) * r, low.y0 + 0.25 * s, z + Math.cos(a) * r], [0, a, 0]));
      }
      for (const g of bronze) K.add(mats.bronze, g);
      for (const g of cobalt) K.add(mats.cobalt, g);
      for (const g of dark) K.add(M.dark, g);
      bells.push({ at: V(x, y + H * 0.5, z), ear, s, y });
      return true;
    },
    /**
     * The chest's mound (arzach2.js): its collider as it is, drawn as the sheet's pedestal, a low hexagonal slate
     * frustum over the same ramp (its flats a little inside the collider's round, its corners a little out), a bronze
     * edge round its top, a lit panel on each side. Returns true.
     */
    pedestal(drawn, solid) {
      K.solid(solid);
      solid.computeBoundingBox();
      const bb = solid.boundingBox, c = bb.getCenter(V()), h = bb.max.y - bb.min.y, y0 = bb.min.y;
      const rf = (bb.max.x - bb.min.x) / 2, k = 1 / 0.92;
      const Rf = rf * k, Rt = MOUND.top * k, P = [], lit = [], rim = [];
      const corner = (i, R, yy) => { const a = (i / 6) * TAU + Math.PI / 6; return V(c.x + Math.cos(a) * R, yy, c.z + Math.sin(a) * R); };
      const tri = (out, a, b, d) => out.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
      for (let i = 0; i < 6; i++) {
        const f0 = corner(i, Rf, y0 - 0.02), f1 = corner(i + 1, Rf, y0 - 0.02), t0 = corner(i, Rt, y0 + h), t1 = corner(i + 1, Rt, y0 + h);
        tri(P, f0, t0, f1); tri(P, f1, t0, t1);
        tri(P, t0, V(c.x, y0 + h, c.z), t1);
        // a lit panel inset on the side, 2 cm off it
        const out = V((f0.x + f1.x) / 2 - c.x, 0, (f0.z + f1.z) / 2 - c.z).normalize().multiplyScalar(0.02).setY(0.012);
        const at = (u, v) => f0.clone().lerp(f1, u).lerp(t0.clone().lerp(t1, u), v).add(out);
        const [a, b, d, e] = [at(0.22, 0.3), at(0.78, 0.3), at(0.22, 0.72), at(0.78, 0.72)];
        tri(lit, a, d, b); tri(lit, b, d, e);
        rim.push(T(new THREE.BoxGeometry(t0.distanceTo(t1) + 0.05, 0.06, 0.08), [(t0.x + t1.x) / 2, y0 + h - 0.02, (t0.z + t1.z) / 2], [0, -Math.atan2(t1.z - t0.z, t1.x - t0.x), 0]));
      }
      const geo = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
      K.add(mats.pedestal, geo(P));
      K.add(mats.lit, geo(lit));
      for (const g of rim) K.add(mats.bronze, g);
      return true;
    },
    /** After the layout: the rooms and the note's sources handed to the shader, the lens terminals placed. */
    dress() {
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      const plan = K.plan, rooms = roomsOf(plan).slice(0, BELFRY_ROOMS);
      rooms.forEach((r, i) => {
        U.rooms.value[i].set(r.x, r.z, r.kind === 'round' ? r.r : r.hx, r.kind === 'round' ? -1 : r.hz);
        U.roomsY.value[i].set(r.y0, r.y1, r.kind === 'corridor' ? 1 : 0, 0);
      });
      U.count.value = rooms.length;
      // the note's sources: every ear of the house, at its bell where it has one
      const ears = rt.pieces.filter((p) => p instanceof BellEar);
      const sources = ears.slice(0, BELFRY_NOTES - 1).map((ear, i) => {
        const b = bells.find((q) => q.ear === ear.id), at = b?.at ?? K.local(ear.at);
        U.bells.value[i].set(at.x, at.y, at.z, 0);
        return { ear };
      });
      // the lens terminals beside every tall doorway, on a cobalt line, kept off pieces and glyphs
      const keep = keepOuts(rt, mats), L = S.lens;
      let lenses = 0;
      for (const d of doorSides(plan, rooms)) {
        const col = new THREE.Box3().setFromPoints([d.o.clone().addScaledVector(d.t, -0.4).setY(d.o.y + L.line[0]), d.o.clone().addScaledVector(d.t, 0.4).addScaledVector(d.nrm, 0.5).setY(d.o.y + L.line[1])]);
        if (keep.some((k) => k.intersectsBox(col))) continue;
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(d.t, V(0, 1, 0), d.nrm));
        const put = (mat, geo, y, out) => { geo.applyQuaternion(q); const p = d.o.clone().addScaledVector(d.nrm, out).setY(d.o.y + y); K.add(mat, geo.translate(p.x, p.y, p.z)); };
        put(mats.cobalt, new THREE.PlaneGeometry(0.06, L.line[1] - L.line[0]), (L.line[0] + L.line[1]) / 2, 0.015);
        for (const y of L.at) {
          put(mats.cobalt, new THREE.CircleGeometry(L.r, 16), y, 0.025);
          put(mats.bronze, new THREE.RingGeometry(L.ring[0], L.ring[1], 20), y, 0.03);
          lenses++;
        }
      }
      // the columns (the kit's and the layout's) in slate, not bronze: the trim's tall round pieces, drawn only (their
      // collision is the kit's already)
      const trim = K.batches.get(mats.bronze) ?? [], pillars = [];
      for (let i = trim.length - 1; i >= 0; i--) {
        const g = trim[i];
        g.computeBoundingBox();
        const sz = g.boundingBox.clone().applyMatrix4(K.inv).getSize(V());
        if (sz.y > 6 && sz.x > 1.6 && sz.z > 1.6 && sz.x < 3.2 && sz.z < 3.2) pillars.push(...trim.splice(i, 1));
      }
      if (pillars.length) K.batches.set(mats.pillar, pillars);
      // (the bells' rings in the air: one drawn-only mesh a bell, hidden while it is quiet)
      const rings = sources.map(({ ear }) => {
        const b = bells.find((q) => q.ear === ear.id);
        if (!b) return null;
        const g = mergeGeometries([2.6, 3.5, 4.4].map((r, j) => new THREE.TorusGeometry(r * b.s, 0.022, 3, 72).rotateX(Math.PI / 2).translate(0, (j - 1) * 0.5 * b.s, 0).toNonIndexed()));
        const m = new THREE.Mesh(g, mats.cobalt);
        m.position.copy(K.world(b.at.x, b.at.y - 0.4 * b.s, b.at.z));
        m.visible = false; m.name = `${rt.def.name}: the ${ear.id} bell's note`;
        m.castShadow = false; m.userData.castShadow = false; m.userData.noCollide = true; m.userData.dynamic = true; m.userData.skin = true;
        rt.root.add(m);
        return m;
      });
      rt.pieces.push(new BelfryNote(rt, U, sources, rings));
      skin.stats = { rooms: rooms.length, bells: bells.length, notes: sources.length, lenses, ms: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0) };
    },
    /** After the kit's flush: the cobalt out of the shadow passes, and the house's own materials back for its exterior. */
    done() {
      for (const m of K.group.children) if (m.material === mats.cobalt) { m.castShadow = false; m.userData.castShadow = false; m.userData.skin = true; }
      Object.keys(M).forEach((k) => { if (!(k in was)) delete M[k]; });
      Object.assign(M, was);
      rt.P = wasP;
      K.plan = null;
    },
  };
  return skin;
}
