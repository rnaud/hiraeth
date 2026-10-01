import * as THREE from 'three';
import { sharedUniforms } from './materials.js';

// ---------------------------------------------------------------------------
// Moebius / Sable composite pass.
//
// Inputs (from the G-buffer written by materials.js):
//   tAlbedo : rgb albedo, a = light term
//   tNormal : rgb world normal, a = view depth (0 = sky)
//   tHatch  : r = single hatch, g = cross hatch (strokes drawn on surfaces)
//
// Steps, per pixel:
//   1. Ink lines: depth discontinuities (Laplacian of 1/z, so flat planes
//      never produce false edges), normal creases, albedo boundaries and
//      optionally cast-shadow boundaries. Sample positions are displaced by
//      a noise field for a hand-inked wobble, optionally "boiling" at 8 fps.
//   2. Two-tone cel shading: albedo in light, albedo * shadow tint in shade.
//   3. Hatching in shadow: single hatch for soft shade, cross hatching for
//      the darkest areas. By default the strokes come from the G-buffer and
//      are anchored to surfaces; a screen-space fallback is kept for comparison.
//   4. Atmospheric perspective: distance fog towards the sky horizon colour;
//      lines and hatching fade with distance like a pen drawing.
//   5. Procedural sky: flat gradient, inked sun disc, inked flat clouds with
//      hatched undersides.
//   6. Paper: grain + fibre + vignette.
// ---------------------------------------------------------------------------

export const DEBUG_VIEWS = {
  Final: 0,
  'Raw (no stylisation)': 1,
  Albedo: 2,
  Normals: 3,
  Depth: 4,
  'Light term': 5,
  'Ink lines only': 6,
  'Hatch strokes': 7,
};

const vertexShader = /* glsl */ `
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D tAlbedo;
  uniform sampler2D tNormal;
  uniform sampler2D tHatch;
  uniform float uHatchScreen;
  uniform vec2 uRes;
  uniform float uPixelRatio;
  uniform mat4 uInvProj;
  uniform mat4 uCamWorld;
  uniform vec3 uSunDir;
  uniform float uTime;

  uniform vec3 uSkyTop;
  uniform vec3 uSkyHorizon;
  uniform vec3 uInk;
  uniform vec3 uShadowTint;
  uniform vec3 uSunColor;
  uniform vec3 uLightTint;
  uniform float uNight;
  uniform vec3 uSunDisc;     // sun direction (drawn even after the moon takes over lighting)
  uniform vec3 uMoonDisc;
  uniform float uMoonVis;
  uniform float uFlatten;    // 1 = shadows faded out (sun -> moon hand-over)
  uniform float uFogMul;     // region fog multiplier

  uniform float uFogDensity;
  uniform float uFogStart;

  uniform float uLineWidth;
  uniform float uDepthThresh;
  uniform float uNormalThresh;
  uniform float uAlbedoEdges;
  uniform float uShadowEdges;
  uniform float uWobble;
  uniform float uBoil;

  uniform float uToon;
  uniform float uHatch;
  uniform float uHatchSpacing;
  uniform float uHighlight;
  uniform float uClouds;
  uniform float uGrain;
  uniform int uDebug;

  in vec2 vUv;
  out highp vec4 fragColor;

  // ---------------------------------------------------------------- noise
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return s;
  }

  // ---------------------------------------------------------------- helpers
  vec3 viewRay(vec2 uv) {
    vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
    return normalize((uCamWorld * vec4(p.xyz / p.w, 0.0)).xyz);
  }

  vec3 skyBase(vec3 rd) {
    float h = clamp(rd.y, 0.0, 1.0);
    vec3 c = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.6, h));
    float sd = max(dot(rd, uSunDisc), 0.0);
    c = mix(c, uSkyHorizon * vec3(1.03, 1.0, 0.96), pow(sd, 8.0) * 0.5 * (1.0 - h) * (1.0 - uNight));
    return c;
  }

  // Parallel pen strokes. p in CSS pixels, width in pixels.
  float hatch(vec2 p, float angle, float spacing, float width) {
    vec2 dir = vec2(cos(angle), sin(angle));
    float v = dot(p, dir) / spacing;
    v += (vnoise(p * 0.035) - 0.5) * 0.7;          // wobbly strokes
    float d = abs(fract(v) - 0.5) * spacing;        // px distance to stroke centre
    float w = width * (0.75 + 0.5 * vnoise(p * vec2(0.02, 0.15))); // pressure variation
    return 1.0 - smoothstep(w * 0.5 - 0.6, w * 0.5 + 0.6, d);
  }

  // Strokes anchored to a coordinate c (e.g. the cloud plane) rather than the
  // screen, with power-of-two LOD like the surface hatching.
  float strokeAt(float v, float f, float widthPx) {
    float d = abs(fract(v + 0.5) - 0.5);
    float hw = 0.5 * widthPx * uPixelRatio * f;
    return 1.0 - smoothstep(hw - 0.6 * f, hw + 0.6 * f, d);
  }
  float anchoredStrokes(float c, float fw, float spacingPx, float widthPx) {
    float lvl = log2(max(fw * spacingPx * uPixelRatio, 1e-7));
    float s0 = exp2(floor(lvl));
    return mix(strokeAt(c / s0, fw / s0, widthPx), strokeAt(c / (2.0 * s0), fw / (2.0 * s0), widthPx), fract(lvl));
  }

  float invDepth(float d) { return d > 0.0 ? 1.0 / d : 0.0; }

  // Returns ink amount; minDepth = nearest depth in the kernel (for fading).
  float inkLines(vec2 uv, float w, out float minDepth) {
    vec2 px = w / uRes;
    vec4 c  = texture(tNormal, uv);
    vec4 n1 = texture(tNormal, uv + vec2(px.x, 0.0));
    vec4 n2 = texture(tNormal, uv - vec2(px.x, 0.0));
    vec4 n3 = texture(tNormal, uv + vec2(0.0, px.y));
    vec4 n4 = texture(tNormal, uv - vec2(0.0, px.y));

    float big = 1e7;
    minDepth = min(min(c.w > 0.0 ? c.w : big, min(n1.w > 0.0 ? n1.w : big, n2.w > 0.0 ? n2.w : big)),
                   min(n3.w > 0.0 ? n3.w : big, n4.w > 0.0 ? n4.w : big));

    // Depth: Laplacian of inverse depth (planar in screen space -> 0 on planes).
    float ic = invDepth(c.w), i1 = invDepth(n1.w), i2 = invDepth(n2.w), i3 = invDepth(n3.w), i4 = invDepth(n4.w);
    float mx = max(max(max(ic, i1), max(i2, i3)), i4);
    float lap = abs(i1 + i2 - 2.0 * ic) + abs(i3 + i4 - 2.0 * ic);
    float dEdge = smoothstep(uDepthThresh, uDepthThresh * 1.6, lap / max(mx, 1e-7));

    // Normals: creases.
    float nEdge = 0.0;
    if (c.w > 0.0) {
      float d1 = n1.w > 0.0 ? 1.0 - dot(c.xyz, n1.xyz) : 0.0;
      float d2 = n2.w > 0.0 ? 1.0 - dot(c.xyz, n2.xyz) : 0.0;
      float d3 = n3.w > 0.0 ? 1.0 - dot(c.xyz, n3.xyz) : 0.0;
      float d4 = n4.w > 0.0 ? 1.0 - dot(c.xyz, n4.xyz) : 0.0;
      nEdge = smoothstep(uNormalThresh, uNormalThresh * 1.5, max(max(d1, d2), max(d3, d4)));
    }

    // Albedo boundaries + shadow boundaries.
    float aEdge = 0.0, sEdge = 0.0;
    if (c.w > 0.0 && (uAlbedoEdges > 0.0 || uShadowEdges > 0.0)) {
      vec4 a  = texture(tAlbedo, uv);
      vec4 a1 = texture(tAlbedo, uv + vec2(px.x, 0.0));
      vec4 a2 = texture(tAlbedo, uv - vec2(px.x, 0.0));
      vec4 a3 = texture(tAlbedo, uv + vec2(0.0, px.y));
      vec4 a4 = texture(tAlbedo, uv - vec2(0.0, px.y));
      float da = max(max(length(a.rgb - a1.rgb), length(a.rgb - a2.rgb)),
                     max(length(a.rgb - a3.rgb), length(a.rgb - a4.rgb)));
      aEdge = smoothstep(0.08, 0.14, da) * uAlbedoEdges;
      float s = step(uToon, a.a);
      float ds = max(max(abs(s - step(uToon, a1.a)), abs(s - step(uToon, a2.a))),
                     max(abs(s - step(uToon, a3.a)), abs(s - step(uToon, a4.a))));
      sEdge = ds * uShadowEdges * (1.0 - uFlatten);
    }
    return clamp(max(max(dEdge, nEdge), max(aEdge * 0.85, sEdge * 0.8)), 0.0, 1.0);
  }

  // ---------------------------------------------------------------- sky
  vec3 renderSky(vec3 rd, vec2 fc, out float ink) {
    vec3 col = skyBase(rd);
    ink = 0.0;
    float px = uPixelRatio;

    // Sun: flat disc with an inked contour and a thin halo ring.
    float ang = acos(clamp(dot(rd, uSunDisc), -1.0, 1.0));
    float aa = fwidth(ang);
    float r = 0.05;
    col = mix(col, uSunColor, 1.0 - smoothstep(r - aa, r + aa, ang));
    ink = max(ink, 1.0 - smoothstep(0.0, aa * 1.2 * px, abs(ang - r)));
    ink = max(ink, 0.5 * (1.0 - uNight) * (1.0 - smoothstep(0.0, aa * 0.7 * px, abs(ang - r * 1.6))));

    // Moon: smaller pale disc with a crescent shadow, drawn separately so it
    // never jumps when the lighting switches from sun to moon.
    if (uMoonVis > 0.0) {
      float ma = acos(clamp(dot(rd, uMoonDisc), -1.0, 1.0));
      float mw = fwidth(ma);
      float mr = 0.035;
      vec3 side = normalize(cross(uMoonDisc, vec3(0.0, 1.0, 0.0)) + 1e-5);
      float ca = acos(clamp(dot(rd, normalize(uMoonDisc + side * 0.022)), -1.0, 1.0));
      float disc = 1.0 - smoothstep(mr - mw, mr + mw, ma);
      float crescent = disc * (1.0 - smoothstep(mr - mw, mr + mw, ca));
      col = mix(col, mix(vec3(0.96, 0.94, 0.88), uSkyTop * 1.2, crescent * 0.85), disc * uMoonVis);
      ink = max(ink, uMoonVis * (1.0 - smoothstep(0.0, mw * 1.2 * px, abs(ma - mr))));
    }

    // Stars: sparse inked-paper dots at night.
    if (uNight > 0.0 && rd.y > 0.0) {
      vec2 sp = rd.xz / (rd.y + 1.0) * 260.0;
      vec2 cell = floor(sp);
      float hs = hash(cell);
      vec2 o = vec2(hash(cell + 3.3), hash(cell + 7.7)) * 0.6 + 0.2;
      float sd2 = length(fract(sp) - o) / max(fwidth(sp.x), 1e-5);
      float star = step(0.985, hs) * (1.0 - smoothstep(0.4, 1.2 + 1.2 * step(0.996, hs), sd2 / px));
      col = mix(col, vec3(1.0, 0.97, 0.88), star * uNight * smoothstep(0.02, 0.2, rd.y));
    }

    // Flat inked clouds on a virtual plane.
    if (rd.y > 0.0 && uClouds > 0.0) {
      vec2 p = rd.xz / (rd.y + 0.15);
      p = vec2(p.x * 0.55, p.y * 1.4) + vec2(uTime * 0.006, 0.0);
      float th = mix(0.75, 0.52, uClouds);
      float f = fbm(p * 1.3);
      float fw = fwidth(f);
      float fade = smoothstep(0.07, 0.3, rd.y);
      float m = smoothstep(th - fw, th + fw, f) * fade;
      // Underside: where a sample shifted toward the horizon is outside the cloud.
      vec2 outward = normalize(rd.xz + 1e-5) * vec2(0.55, 1.4);
      float f2 = fbm((p + outward * 0.12) * 1.3);
      float under = (1.0 - smoothstep(th - fw, th + fw, f2)) * m;
      vec3 cloudCol = mix(vec3(1.0, 0.985, 0.95) * uLightTint, uSkyHorizon * uShadowTint * 1.1, under);
      col = mix(col, cloudCol, m);
      float cc = dot(p, vec2(0.98, 0.2));
      float h = anchoredStrokes(cc, fwidth(cc), uHatchSpacing * 0.9, 1.0) * under * uHatch;
      col = mix(col, uInk, h * 0.45);
      ink = max(ink, (1.0 - smoothstep(0.0, fw * 1.3 * uLineWidth, abs(f - th))) * fade * 0.9);
    }
    return col;
  }

  // ---------------------------------------------------------------- main
  void main() {
    vec2 uv = vUv;
    vec2 fc = gl_FragCoord.xy / uPixelRatio;   // CSS pixels: stable stroke size on HiDPI
    vec4 A = texture(tAlbedo, uv);
    vec4 N = texture(tNormal, uv);
    bool isSky = N.w <= 0.0;
    float depth = isSky ? 1e7 : N.w;
    vec3 rd = viewRay(uv);

    // ---- debug views
    if (uDebug == 2) { fragColor = vec4(isSky ? skyBase(rd) : A.rgb, 1.0); return; }
    if (uDebug == 3) { fragColor = vec4(isSky ? vec3(0.0) : N.rgb * 0.5 + 0.5, 1.0); return; }
    if (uDebug == 4) { fragColor = vec4(vec3(isSky ? 1.0 : pow(depth / 3000.0, 0.4)), 1.0); return; }
    if (uDebug == 5) { fragColor = vec4(vec3(isSky ? 1.0 : A.a), 1.0); return; }
    if (uDebug == 7) { vec3 H = texture(tHatch, uv).rgb; fragColor = vec4(vec3(1.0 - max(max(H.r, H.g), H.b)), 1.0); return; }
    if (uDebug == 1) {
      vec3 c = isSky ? skyBase(rd) : A.rgb * (0.35 + 0.75 * A.a);
      if (!isSky) c = mix(c, skyBase(rd), 1.0 - exp(-max(depth - uFogStart, 0.0) * uFogDensity * uFogMul));
      fragColor = vec4(c, 1.0);
      return;
    }

    // ---- 1. ink lines with hand-drawn wobble
    float boilT = floor(uTime * 8.0) * uBoil;
    vec2 wob = vec2(vnoise(fc * 0.06 + boilT * 17.3), vnoise(fc * 0.06 + 31.7 + boilT * 11.1)) - 0.5;
    vec2 euv = uv + wob * uWobble * 2.0 * uPixelRatio / uRes;
    float nearD;
    float probeD = depth;
    if (isSky) {   // sky side of a silhouette: use the neighbouring surface depth
      vec2 o = 2.0 * uPixelRatio / uRes;
      vec4 s = vec4(texture(tNormal, uv + vec2(o.x, 0)).w, texture(tNormal, uv - vec2(o.x, 0)).w,
                    texture(tNormal, uv + vec2(0, o.y)).w, texture(tNormal, uv - vec2(0, o.y)).w);
      s = mix(vec4(1e7), s, step(1e-6, s));
      probeD = min(min(s.x, s.y), min(s.z, s.w));
    }
    float weight = mix(uLineWidth, 1.0, smoothstep(15.0, 400.0, probeD));
    float ink = inkLines(euv, weight * uPixelRatio, nearD);

    // fog factor (for lines use the nearest surface in the kernel)
    float fogLine = 1.0 - exp(-max(nearD - uFogStart, 0.0) * uFogDensity * uFogMul * 1.4);
    ink *= 1.0 - fogLine;

    vec3 col;
    if (isSky) {
      float skyInk;
      col = renderSky(rd, fc, skyInk);
      ink = max(ink, skyInk);
    } else {
      // ---- 2. two-tone cel shading
      vec3 albedo = A.rgb;
      float L = A.a;
      float lit = smoothstep(uToon - 0.01, uToon + 0.01, L);
      // during the sun -> moon hand-over both tones converge, so shadows fade
      vec3 shade = mix(albedo * uShadowTint, albedo * uLightTint, uFlatten);
      col = mix(shade, albedo * uLightTint, lit);
      col *= 1.0 + uHighlight * smoothstep(0.9, 0.92, L);

      // ---- 3. hatching in shadow
      float dark = clamp((uToon - L) / uToon, 0.0, 1.0);
      float hFade = (1.0 - smoothstep(uHatchScreen > 0.5 ? 40.0 : 150.0, uHatchScreen > 0.5 ? 350.0 : 700.0, depth)) * uHatch * (1.0 - uFlatten);
      vec3 H = texture(tHatch, uv).rgb;
      // drawn detail lines: grids, glyphs, ripples, cracks, fissures (independent of the marks toggle)
      col = mix(col, uInk, clamp(H.b, 0.0, 1.0) * 0.6 * (1.0 - smoothstep(120.0, 600.0, depth)));
      if (hFade > 0.0 && uHatchScreen < 0.5) {
        col = mix(col, uInk, clamp(max(H.r, H.g), 0.0, 1.0) * hFade * 0.55);
      } else if (hFade > 0.0) {
        float h1 = hatch(fc, 0.95, uHatchSpacing, mix(0.9, 2.2, dark)) * smoothstep(0.02, 0.12, dark);
        float h2 = hatch(fc, -0.6, uHatchSpacing * 1.2, mix(0.6, 1.7, dark)) * smoothstep(0.5, 0.65, dark);
        col = mix(col, uInk, max(h1, h2) * hFade * 0.55);
      }

      // ---- 4. atmospheric perspective
      float fog = 1.0 - exp(-max(depth - uFogStart, 0.0) * uFogDensity * uFogMul);
      col = mix(col, skyBase(rd), fog);
    }

    if (uDebug == 6) col = vec3(0.97, 0.94, 0.86);
    col = mix(col, uInk, ink);

    // ---- 6. paper
    float grain = hash(fc + fract(uTime * 7.0) * 113.0 * uBoil) - 0.5;
    float fibre = vnoise(fc * vec2(0.9, 0.12)) * 0.5 + vnoise(fc * 0.25) * 0.5;
    col *= 1.0 + uGrain * (grain * 0.5 + (fibre - 0.5) * 0.6);
    vec2 q = uv - 0.5;
    col *= 1.0 - 0.28 * pow(length(q) * 1.25, 3.0);

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

export function createPost() {
  const uniforms = {
    tAlbedo: { value: null },
    tNormal: { value: null },
    tHatch: { value: null },
    uHatchScreen: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uPixelRatio: { value: 1 },
    uInvProj: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uSunDir: { value: new THREE.Vector3() },
    uTime: { value: 0 },

    uSkyTop: { value: new THREE.Color('#8ccfd2') },
    uSkyHorizon: { value: new THREE.Color('#f7ecd2') },
    uInk: { value: new THREE.Color('#2b211f') },
    uShadowTint: { value: new THREE.Color('#a59bd0') },
    uSunColor: { value: new THREE.Color('#fff6dc') },
    uLightTint: { value: new THREE.Color('#ffffff') },
    uNight: { value: 0 },
    uSunDisc: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDisc: { value: new THREE.Vector3(0, -1, 0) },
    uMoonVis: { value: 0 },
    uFlatten: { value: 0 },
    uFogMul: { value: 1 },

    uFogDensity: { value: 0.0011 },
    uFogStart: { value: 120 },

    uLineWidth: { value: 2.0 },
    uDepthThresh: { value: 0.07 },
    uNormalThresh: { value: 0.22 },
    uAlbedoEdges: { value: 1 },
    uShadowEdges: { value: 1 },
    uWobble: { value: 1.0 },
    uBoil: { value: 0 },

    // shared with the surface shader, which draws the strokes
    uToon: sharedUniforms.uToon,
    uHatch: sharedUniforms.uHatch,
    uHatchSpacing: sharedUniforms.uHatchSpacing,
    uShadeStyle: sharedUniforms.uShadeStyle,
    uHighlight: { value: 0.0 },
    uClouds: sharedUniforms.uClouds,
    uGrain: { value: 0.1 },
    uDebug: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return { scene, camera, uniforms };
}

// Style presets: the same pipeline can lean towards Sable (flat, clean,
// two-tone) or towards a Moebius page (inked, hatched, wobbly).
export const PRESETS = {
  Moebius: {
    uLineWidth: 2.0, uDepthThresh: 0.07, uNormalThresh: 0.22, uAlbedoEdges: 1, uShadowEdges: 1,
    uWobble: 1.0, uBoil: 0, uHatch: 1, uShadeStyle: 0, uHatchSpacing: 5.5, uHighlight: 0, uGrain: 0.1, uClouds: 0.6,
    uFogDensity: 0.0011,
  },
  Sable: {
    uLineWidth: 1.6, uDepthThresh: 0.07, uNormalThresh: 0.3, uAlbedoEdges: 0, uShadowEdges: 0,
    uWobble: 0.0, uBoil: 0, uHatch: 1, uShadeStyle: 1, uHatchSpacing: 7, uHighlight: 0.05, uGrain: 0.04, uClouds: 0.5,
    uFogDensity: 0.0009,
  },
  'Animated ink': {
    uLineWidth: 2.2, uDepthThresh: 0.07, uNormalThresh: 0.2, uAlbedoEdges: 1, uShadowEdges: 1,
    uWobble: 1.6, uBoil: 1, uHatch: 1, uShadeStyle: 0, uHatchSpacing: 5, uHighlight: 0, uGrain: 0.14, uClouds: 0.7,
    uFogDensity: 0.0011,
  },
};
