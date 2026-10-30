import * as THREE from 'three/webgpu';
import {
  Fn, If, Loop, step, uniform, uniformArray, vec2, vec3, vec4, float, select, mix, smoothstep, max, min, dot, normalize,
  fract, floor, sin, length, clamp, normalFlat, cameraViewMatrix, positionWorld, positionView, normalWorld, vertexColor, mrt, texture, uv,
} from 'three/tsl';
import { MODE_TERRAIN, MODE_STRATA, FACET_EDGE, SHADOW_CUT } from '../materials.js';

// ---------------------------------------------------------------------------
// The WebGPU spike's surface (issue #802, docs/systems/webgpu-spike.md): what materials.js's surface shader does for
// most of a world, written again in TSL, so three's WebGPURenderer can draw it (a GLSL ShaderMaterial it cannot).
//
// Kept: the flat colour, its painted map (uMap) and the printed colour zones (vertex colours snapped to the material's palette, uPalette), the
// ground's tones (MODE_TERRAIN: two tones in patches, rock on the slopes), the mesas' bands (MODE_STRATA), faceted
// shading (uFlat), self-lit (uGlow), the toon light term and the sun's cast shadow from one cascade (the near map: a
// 2 × 2 tent of hardware-compared taps, SHADOW_CUT). Its two G-buffer targets: albedo + light, normal + view depth.
// Left out: the ~40 other features (hatching coordinates, marks, faces, eyes, water, metal, glass, the fine and far
// cascades, local lights, the hatch target): a spike measures the renderer, it does not port the look.
// ---------------------------------------------------------------------------

const hash = Fn(([p0]) => {
  const p = fract(p0.mul(vec2(123.34, 456.21))).toVar();
  p.addAssign(dot(p, p.add(45.32)));
  return fract(p.x.mul(p.y));
});
export const vnoise = Fn(([p]) => {
  const i = floor(p), f = fract(p);
  const u = f.mul(f).mul(f.mul(-2.0).add(3.0));
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), u.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), u.x), u.y);
});

/** The shared state of every surface: the sun, the near cascade's map and matrix (slice.js keeps them current). */
export function surfaceShared(sharedUniforms) {
  return {
    sunDir: uniform(sharedUniforms.uSunDir.value),
    shadowMatrix: uniform(new THREE.Matrix4()),
    shadowBias: uniform(0.0005),
    shadowOffset: uniform(0.2),
    shadowSize: uniform(2048),
    shadowMap: null,   // (the depth texture: set before the first material is made)
    flipY: true,       // (a render target's texture is read from the top, on both back ends: the map's v turned over)
    zHalf: false,      // (WebGL's clip z is -1..1: halved and moved into the map's 0..1)
  };
}

/** The lit share of the near cascade at a world point (1 lit .. 0 shaded), as materials.js shadowLit with one cascade. */
function shadowLit(S, wp, n, ndl) {
  const sinL = ndl.mul(ndl).oneMinus().max(0).sqrt();
  const sc = S.shadowMatrix.mul(vec4(wp.add(n.mul(S.shadowOffset.mul(sinL.mul(0.65).add(0.35)))), 1.0));
  const p = sc.xyz.div(sc.w).toVar();
  const uvx = p.x.mul(0.5).add(0.5);
  const uvy = S.flipY ? p.y.mul(-0.5).add(0.5) : p.y.mul(0.5).add(0.5);
  const z = (S.zHalf ? p.z.mul(0.5).add(0.5) : p.z).sub(S.shadowBias);
  const e = smoothstep(0.0, 0.06, vec2(uvx, uvy)).mul(smoothstep(0.94, 1.0, vec2(uvx, uvy)).oneMinus());
  const inside = select(z.greaterThan(1.0), float(0), e.x.mul(e.y));
  // the tent over 3 × 3 texels in 4 bilinear taps (shadows.js tentTaps, the handheld's)
  const size = S.shadowSize, inv = float(1).div(size);
  const uv = vec2(uvx, uvy).mul(size), base = floor(uv.add(0.5)), st = uv.add(0.5).sub(base), b = base.sub(0.5);
  const w0 = st.mul(-2.0).add(3.0), w1 = st.mul(2.0).add(1.0);
  const o0 = st.oneMinus().add(1.0).div(w0).sub(1.0), o1 = st.div(w1).add(1.0);
  const tap = (ox, oy) => texture(S.shadowMap, b.add(vec2(ox, oy)).mul(inv)).compare(z);
  const s = w0.y.mul(w0.x.mul(tap(o0.x, o0.y)).add(w1.x.mul(tap(o1.x, o0.y))))
    .add(w1.y.mul(w0.x.mul(tap(o0.x, o1.y)).add(w1.x.mul(tap(o1.x, o1.y))))).div(16.0);
  const lit = mix(float(1), s, inside);
  return clamp(lit.sub(0.5).mul(SHADOW_CUT).add(0.5), 0.0, 1.0);
}

/**
 * A NodeMaterial drawing what `src` (a surface ShaderMaterial of makeMaterial) draws, in the spike's G-buffer.
 * The uniforms are the source's own objects (its colours, flat, glow): a change the game makes to them shows here too.
 */
export function surfaceMaterial(src, S, { vertexColors = src.vertexColors } = {}) {
  const u = src.uniforms;
  const mode = u.uMode?.value ?? 0;
  const c1 = uniform(u.uColor.value), c2 = uniform(u.uColor2.value), c3 = uniform(u.uColor3.value);
  const flat = uniform(u.uFlat?.value ?? 0), glow = uniform(u.uGlow?.value ?? 0);
  const paletteSize = u.uPaletteSize?.value ?? 0;
  const palette = paletteSize > 0 ? uniformArray(u.uPalette.value.slice(0, paletteSize), 'color') : null;
  const strataSize = uniform(u.uStrataSize?.value ?? 4);

  const m = new THREE.NodeMaterial();
  m.name = `spike:${src.name || src.uuid.slice(0, 6)}`;
  m.lights = false;
  m.fog = false;
  m.side = src.side;
  m.vertexColors = !!vertexColors;

  const wp = positionWorld;
  // the facet's own normal where the surface is flat-shaded, turned to the side the interpolated one faces
  const nI = normalize(normalWorld);
  const nF0 = normalize(normalFlat.transformNormalByInverseViewMatrix(cameraViewMatrix));   // (three's own facet normal, view to world)
  const nF = nF0.mul(dot(nF0, nI).sign());
  // (a mix, not a select, and no toVar: the output and the MRT are built apart; a select of the two normals, or a var,
  //  came out NaN in the MRT's normal on r186's WebGPU back end)
  const n = mix(nI, nF, step(0.5, flat));

  const albedo = Fn(() => {
    const a = vec3(c1).toVar();
    if (u.uHasMap?.value > 0.5 && u.uMap?.value) a.mulAssign(texture(u.uMap.value, uv()).rgb);   // (a painted map: the Arena floor's rings)
    if (vertexColors) {
      const ic = vertexColor().rgb.toVar();
      if (palette) {
        // printed zones: blended vertex colours snapped to the nearest ink, so the zone edges stay crisp
        const best = float(1e9).toVar(), pick = vec3(ic).toVar();
        Loop(paletteSize, ({ i }) => {
          const d = ic.sub(palette.element(i));
          const dd = dot(d, d);
          If(dd.lessThan(best), () => { best.assign(dd); pick.assign(palette.element(i)); });
        });
        ic.assign(pick);
      }
      a.mulAssign(ic);
    }
    if (mode === MODE_TERRAIN) {
      const xz = wp.xz;
      const patches = vnoise(xz.mul(0.011)).mul(0.65).add(vnoise(xz.mul(0.045)).mul(0.35));
      const slope = n.y.oneMinus();
      a.assign(select(patches.greaterThan(0.6), c2, c1));
      If(slope.greaterThan(0.42), () => { a.assign(c3); }).ElseIf(slope.greaterThan(0.30).and(patches.lessThan(0.45)), () => { a.assign(mix(c1, c3, 0.5)); });
    } else if (mode === MODE_STRATA) {
      // bands of colour, a little wavy; once thinner than a few pixels, their mean (no flicker)
      const t = wp.y.add(vnoise(wp.xz.mul(0.04)).sub(0.5).mul(strataSize).mul(0.9)).div(strataSize);
      const gt = max(length(vec2(t.dFdx(), t.dFdy())), 1e-6);
      const band = floor(t);
      const r = fract(sin(band.mul(12.9898)).mul(43758.5453));
      const c = select(r.lessThan(0.4), c1, select(r.lessThan(0.75), c2, c3));
      const mean = c1.mul(0.4).add(c2.mul(0.35)).add(c3.mul(0.25));
      a.assign(mix(mean, c, smoothstep(2.5, 5.0, float(1).div(gt))));
    }
    return a;
  })();

  const light = Fn(() => {
    const ndl = dot(n, S.sunDir).toVar();
    If(flat.greaterThan(0.5).and(ndl.lessThan(FACET_EDGE)), () => { ndl.assign(min(ndl, -FACET_EDGE)); });
    const lambert = ndl.mul(0.5).add(0.5);
    const sh = select(ndl.greaterThan(0), shadowLit(S, wp, n, ndl), float(1));
    const L = mix(min(lambert, 0.38), lambert, sh);
    return mix(L, 1.0, glow);
  })();

  m.outputNode = vec4(albedo, light);
  m.mrtNode = mrt({ normalDepth: vec4(n, positionView.z.negate()) });
  return m;
}
