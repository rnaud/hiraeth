import {
  Fn, If, uniform, vec2, vec3, vec4, float, select, mix, smoothstep, max, dot, abs, fract, cos, sin, clamp, normalize,
  screenUV, screenSize,
} from 'three/tsl';
import { vnoise } from './surface-tsl.js';

// ---------------------------------------------------------------------------
// The WebGPU spike's composite (issue #802): post.js's ink pass cut down to what the spike measures, in TSL.
//   - two-tone cel shading: the albedo in the light tint where the light term passes the toon threshold, in the
//     shadow tint under it (post.js 2);
//   - the shade's screen-space pen hatching, one direction and a cross where it is darker (post.js 3, uHatchScreen's
//     strokes: hatch());
//   - the ink lines: where the view depth jumps, the normal turns, the colour changes or the light crosses the toon
//     threshold between a pixel and its four neighbours (post.js 1's edge tests, one pixel wide, no weights, tints,
//     far fades, noise or wobble);
//   - the sky, where nothing was drawn (depth 0): its horizon to its top by the ray's height (no clouds, sun, haze).
// ---------------------------------------------------------------------------

const hatch = Fn(([p, angle, spacing, width]) => {
  const dir = vec2(cos(angle), sin(angle));
  const v = dot(p, dir).div(spacing).add(vnoise(p.mul(0.035)).sub(0.5).mul(0.7));
  const d = abs(fract(v).sub(0.5)).mul(spacing);
  const w = width.mul(vnoise(p.mul(vec2(0.02, 0.15))).mul(0.5).add(0.75));
  return smoothstep(w.mul(0.5).sub(0.6), w.mul(0.5).add(0.6), d).oneMinus();
});

/**
 * The composite's output node. tA: albedo + light, tN: normal + view depth (the scene pass's textures);
 * U: post.js's uniforms (the tints, the ink), SU: the shared ones (toon, hatch spacing, sky), cam: the game's camera.
 */
export function inkComposite({ tA, tN, tD, U, SU, camera }) {
  const toon = live(SU.uToon), spacing = live(SU.uHatchSpacing), hatchK = live(SU.uHatch);
  const shadowTint = live(U.uShadowTint), lightTint = live(U.uLightTint), ink = live(U.uInk);
  const skyTop = live(SU.uSkyTop), skyHorizon = live(SU.uSkyHorizon);
  const invProj = uniform(camera.projectionMatrixInverse), camWorld = uniform(camera.matrixWorld);
  const pxRatio = live(SU.uPixelRatio);

  return Fn(() => {
    const uv = screenUV;
    const px = vec2(1).div(screenSize);
    const A = tA.sample(uv), N = tN.sample(uv);
    // (sky: nothing drawn there, the depth buffer at its far end. Not the colour targets: on the WebGL 2 back end, three
    //  r186's pass left them uncleared where nothing was drawn, an old frame showing in the sky)
    const skyAt = (q) => tD.sample(q).x.greaterThanEqual(0.999999);
    const depth = select(skyAt(uv), float(0), N.w);
    // the ray through this pixel (world), for the sky
    const ndc = vec4(uv.x.mul(2).sub(1), uv.y.oneMinus().mul(2).sub(1), 1, 1);
    const vp = invProj.mul(ndc);
    const rd = normalize(camWorld.mul(vec4(vp.xyz.div(vp.w), 0)).xyz);
    const col = vec3(0).toVar();
    If(depth.lessThanEqual(0.0), () => {
      col.assign(mix(skyHorizon, skyTop, smoothstep(0.0, 0.45, rd.y.max(0))));
    }).Else(() => {
      const albedo = A.rgb, L = A.a;
      const lit = smoothstep(toon.sub(0.01), toon.add(0.01), L);
      col.assign(mix(albedo.mul(shadowTint), albedo.mul(lightTint), lit));
      // the shade's strokes, in CSS pixels (as the game's: a stroke as wide on a HiDPI screen)
      const fc = uv.mul(screenSize).div(max(pxRatio, 1));
      const dark = clamp(toon.sub(L).div(toon), 0.0, 1.0);
      const hFade = smoothstep(40.0, 350.0, depth).oneMinus().mul(hatchK);
      const h1 = hatch(fc, float(0.95), spacing, mix(0.9, 2.2, dark)).mul(smoothstep(0.02, 0.12, dark));
      const h2 = hatch(fc, float(-0.6), spacing.mul(1.2), mix(0.6, 1.7, dark)).mul(smoothstep(0.5, 0.65, dark));
      col.assign(mix(col, ink, max(h1, h2).mul(hFade).mul(0.55)));
    });
    // the ink lines: depth jumps, turns of the normal, changes of colour and of light, against the four neighbours
    const edge = float(0).toVar();
    const s = step4(toon);
    for (const o of [vec2(1, 0), vec2(-1, 0), vec2(0, 1), vec2(0, -1)]) {
      const q = uv.add(o.mul(px));
      const Nq = tN.sample(q), Aq = tA.sample(q);
      const dq = select(skyAt(q), float(0), Nq.w);
      const sky = depth.lessThanEqual(0).or(dq.lessThanEqual(0));
      const near = select(depth.lessThanEqual(0), dq, select(dq.lessThanEqual(0), depth, depth.min(dq)));
      const dJump = select(sky, select(depth.lessThanEqual(0).and(dq.lessThanEqual(0)), float(0), float(1)), abs(depth.sub(dq)).div(near.max(0.01)).sub(0.02).mul(25).clamp(0, 1));
      const nTurn = select(sky, float(0), smoothstep(0.25, 0.45, dot(N.xyz, Nq.xyz).oneMinus()));
      const cDiff = select(sky, float(0), smoothstep(0.06, 0.12, abs(A.rgb.sub(Aq.rgb)).dot(vec3(0.3, 0.55, 0.15))));
      const sDiff = select(sky, float(0), abs(s(A.a).sub(s(Aq.a))));
      edge.assign(max(edge, max(max(dJump, nTurn), max(cDiff, sDiff))));
    }
    return vec4(mix(col, ink, edge), 1.0);
  })();
}

/** A uniform that follows one of the game's ({ value }), read again every render. */
export const live = (o) => uniform(o.value).onRenderUpdate(() => o.value);

const step4 = (toon) => (L) => select(L.greaterThanEqual(toon), float(1), float(0));
