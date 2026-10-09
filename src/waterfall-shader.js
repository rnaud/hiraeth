import * as THREE from 'three';

// ---------------------------------------------------------------------------
// A falling sheet of water drawn the way the sheets draw it (references/levels/The City Behind the Waterfall/
// environment): not a simulation but a print. Compiled into the G-buffer surface shader
// (materials.js) for a material made with `fall: {...}` (the FALL define); like the rest it
// writes a flat albedo, how lit it is and ink for post.js to print.
//
//   columns    the curtain splits into vertical bands of four flat tones (the deep
//              teal of thin water, the water's turquoise, a pale aqua, white), their
//              edges fixed across the sheet so they never crawl sideways; post.js inks
//              the tone edges like any colour edge (thin lines, the material's line)
//   flow       the bands' breaks stream down the sheet at the fall's speed: long streaks,
//              stretched ~20:1, so the curtain moves without a particle
//   ink        thin pen streaks falling a little faster than the water, each in its own
//              lane, broken into dashes; gone once a lane is under ~3 px (far: flat tones)
//   gaps       where a column runs thin the water is see-through (discard): the city or
//              the valley behind shows through slits that wobble with the flow
//   lip        a glassy smooth band under the top edge, before the water breaks up
//   mist       a pale band at the foot whose top edge billows, and no gaps in it
//
// The sheet's uv is in metres: x across it, y up from its foot (waterfall-kit.js fallSheet).
// Cost: five value-noise taps a pixel, no texture; it only draws where the sheet is.
// ---------------------------------------------------------------------------

/** The defaults of a fall: m/s down the sheet, the columns' width (m), see-through share, the mist's height (m), the ink's strength, the lip's height (m). */
export const FALL = { speed: 6, column: 2.4, gaps: 0.18, mist: 9, ink: 0.85, lip: 3.5, height: 100 };
/** The tone thresholds (the field's value): deep | water | pale | white. */
export const FALL_TONES = [0.38, 0.53, 0.67];

/** Turn a fresh makeMaterial() material into a fall: the FALL define and its uniforms (o.fall: FALL's fields). */
export function fallMaterial(mat, o = {}) {
  const f = { ...FALL, ...(o.fall === true ? {} : o.fall) };
  mat.defines = { ...mat.defines, FALL: 1 };
  Object.assign(mat.uniforms, {
    uFallA: { value: new THREE.Vector4(f.speed, f.column, f.gaps, f.mist) },
    uFallB: { value: new THREE.Vector4(f.ink, f.lip, f.height, f.seed ?? 0) },
  });
  mat.side = o.side ?? THREE.DoubleSide;
  return mat;
}

export const FALL_GLSL = /* glsl */ `
  uniform vec4 uFallA;   // speed (m/s) · column width (m) · see-through share · mist height (m)
  uniform vec4 uFallB;   // ink · lip height (m) · the sheet's height (m) · seed

  struct FallLook { vec3 albedo; float ink; float gap; };

  FallLook fallLook(vec2 q) {
    FallLook F;
    float t = uTime, sp = uFallA.x, cw = uFallA.y, seed = uFallB.w;
    float cx = q.x / cw;
    // the columns: a field across the sheet only (no time, no height: they never crawl sideways)
    float col = vnoise(vec2(cx * 0.45 + seed, 1.7)) * 0.62 + vnoise(vec2(cx * 1.7 + seed * 3.1, 5.3)) * 0.38;
    // the flow: breaks streaming down, long and thin, faster in the middle of the sheet's height
    float y = q.y + t * sp;
    float flow = vnoise(vec2(cx * 2.6 + seed, y / (cw * 22.0))) * 0.6 + vnoise(vec2(cx * 6.1 + 11.0 + seed, y / (cw * 9.0))) * 0.4;
    float lip = smoothstep(uFallB.z - uFallB.y * 1.6, uFallB.z - uFallB.y * 0.4, q.y);   // 1 at the lip: smooth glassy water
    float v = mix(col * 0.72 + flow * 0.28, col, lip);
    vec3 white = mix(uColor2, vec3(0.97, 1.0, 0.98), 0.75);
    vec3 c = v < ${FALL_TONES[0]} ? uColor3 : (v < ${FALL_TONES[1]} ? uColor : (v < ${FALL_TONES[2]} ? uColor2 : white));
    // the mist at the foot: a pale band whose top billows (and drifts a little up)
    float mist = uFallA.w;
    float mTop = mist * (0.75 + 0.5 * vnoise(vec2(cx * 0.35 + seed, t * 0.25))) + (vnoise(vec2(cx * 1.4, t * 0.6 - q.y * 0.1)) - 0.5) * mist * 0.35;
    float inMist = step(q.y, mTop);
    c = inMist > 0.5 ? mix(uColor2, white, step(q.y, mTop * 0.55)) : c;
    // see-through slits where a column runs thin (never in the mist or at the lip)
    float g = col + (flow - 0.5) * 0.12;
    F.gap = step(g, uFallA.z) * (1.0 - inMist) * step(lip, 0.5);
    // the pen streaks: one lane per 0.45 column, a line at its own place in it, broken into dashes
    // falling a little faster than the water
    float sx = cx * 2.2;
    float lane = floor(sx);
    float off = 0.2 + 0.6 * hash(vec2(lane, 3.1 + seed));
    float dPx = abs(fract(sx) - off) / max(fwidth(sx), 1e-5);
    float dl = cw * (6.0 + 10.0 * hash(vec2(lane, 9.7)));
    float dash = step(0.56, vnoise(vec2(lane * 7.13 + seed, (q.y + t * sp * 1.25) / dl)));
    float far = 1.0 - smoothstep(0.15, 0.33, fwidth(sx));   // (a lane under ~3 px: no streaks, the tones alone)
    F.ink = inkLine(dPx, 0.8) * dash * uFallB.x * far * (1.0 - inMist) * (1.0 - lip * 0.8);
    F.albedo = c;
    return F;
  }
`;
