import * as THREE from 'three';
import { makeMaterial } from '../../materials.js';
import { skinShader, spliceSkin } from './skin-shader.js';
import { MK_GLSL } from './machined.js';

// ---------------------------------------------------------------------------
// The makers' machined finish on any surface (issue #691, docs/systems/materials.md "The machined finish outside the
// skins"): the temples' picked walls and floors (references/surfaces/temple-walls/sheet-1.jpg, temple-floors/sheet-1.jpg,
// skins/machined.js mkFinish) for what is the makers' but wears no skin of its own: the makers' courts' pads and the
// chests' plinths in every world, and the Builders' Greenhouse (Viridel), the one temple drawn with a plain grid.
// Upward faces are square plates (each its tone, an inlaid border, sockets at their corners); the rest panels in
// courses along the face's dominant axis (a tone each, some set back, a border on half, a socket high up), their
// joints inked fine. In the object's own frame (a piece's box, a temple's kit) or the world's from an origin. As every
// skin's pattern it reaches the Unity port as data (skin-shader.js; scripts/unity-export/skin-hlsl.mjs).
// ---------------------------------------------------------------------------

const PARS = /* glsl */ `
  uniform vec4 uMcP;
  uniform vec3 uMcO;
`;
const GLSL = /* glsl */ `
  // a joint between plates: a fine pen line d metres off, px metres a pixel, faded as the plates grow small
  float mcJoint(vec2 f, vec2 S, float px) {
    vec2 d = min(f, 1.0 - f) * S;
    float k = 1.0 - smoothstep(min(S.x, S.y) / 40.0, min(S.x, S.y) / 14.0, px);
    return max(mkLine(d.x, px, 0.8), mkLine(d.y, px, 0.8)) * 0.55 * k;
  }
`;
const BODIES = {
  // uMcP: x the floor's plate (m), y z a wall panel's width and course (m), w 1: the object's frame (else the world's from uMcO)
  plates: /* glsl */ `
    vec3 mcP = uMcP.w > 0.5 ? vObjPos : vWorldPos - uMcO;
    float mcPx = max(max(length(dFdx(mcP)), length(dFdy(mcP))), 1e-4);
    float mcInk = 0.0;
    vec3 albedo = uColor;
    {
      vec3 an = abs(n);
      if (an.y > 0.65) {
        vec2 S = vec2(uMcP.x), gq = mcP.xz / S, gi = floor(gq), gf = fract(gq);
        mcInk = mcJoint(gf, S, mcPx);
        mcInk = max(mcInk, mkFinish((gf - 0.5) * S, 0.5 * S, gi.x * 17.0 + gi.y * 5.0, mcPx, true, albedo));
      } else {
        bool sx = an.x > an.z;
        vec2 S = uMcP.yz, gq = vec2(sx ? mcP.z : mcP.x, mcP.y) / S, gi = floor(gq), gf = fract(gq);
        mcInk = mcJoint(gf, S, mcPx);
        mcInk = max(mcInk, mkFinish((gf - 0.5) * S, 0.5 * S, gi.x * 13.1 + gi.y * 7.7 + (sx ? 31.0 : 0.0), mcPx, false, albedo));
      }
    }
  `,
};

const SHADER = skinShader('machined', { pars: PARS, glsl: MK_GLSL + GLSL, bodies: BODIES, ink: 'mcInk', emit: null });

/** The machined finish's sizes (m): a floor's plate, a wall's panel (width, course). */
export const MACHINED = { plate: 2.4, panel: [2.4, 2.4] };

const cache = new Map();
/**
 * A surface material in the makers' machined finish: makeMaterial's own options (`o`: its colour, shade, hatching),
 * plus plate (m), panel ([w, h] m), obj (true: in the object's own frame, else the world's from `origin`).
 */
export function machinedMaterial(o, { plate = MACHINED.plate, panel = MACHINED.panel, obj = true, origin = null } = {}) {
  const key = JSON.stringify([o, plate, panel, obj, origin?.toArray?.() ?? null]);
  if (cache.has(key)) return cache.get(key);
  const m = makeMaterial({ flat: true, ...o, key: `machined.${key}` });
  spliceSkin(m, SHADER, 'plates', 'machined-plates.js');
  Object.assign(m.uniforms, {
    uMcP: { value: new THREE.Vector4(plate, panel[0], panel[1], obj ? 1 : 0) },
    uMcO: { value: origin?.clone?.() ?? new THREE.Vector3() },
  });
  m.userData.houseSkin = 'machined';
  cache.set(key, m);
  return m;
}

/**
 * The Builders' Greenhouse's surfaces in the machined finish (a house's `def.skin`, skins/index.js): its walls and floors
 * swapped for machined ones in its own colours before the layout, put back after (its exterior is built after).
 */
export function machinedHouseSkin({ wall = [3.2, 3.2], plate = 2.4 } = {}) {
  // (finishOnly: its surfaces only, not a futuristic skin of its own: no dressing, no house air, temples/air.js)
  return Object.assign((rt) => {
    const M = rt.M, look = rt.def.palette?.look?.all ?? {}, P = rt.def.palette ?? {};
    const was = { wall: M.wall, floor: M.floor };
    M.wall = machinedMaterial({ ...look, color: P.wall ?? '#f5f3ed', hatch: 0.2 }, { panel: wall, plate });
    M.floor = machinedMaterial({ ...look, color: P.floor ?? '#ebe7dc', hatch: 0.35 }, { panel: [plate, 0.8], plate });
    return { name: 'machined', done() { Object.assign(M, was); } };
  }, { finishOnly: true });
}
