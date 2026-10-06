import * as THREE from 'three';
import { sharedUniforms, SHADE, SPOT, WEATHER } from './materials.js';

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
  'Drawn detail (faces, glyphs)': 8,
};

/**
 * A face's shade (gHatch.a face flag): the world's shadow tint's darkness in a warm skin tone
 * (`tone`, multiplied: about as dark as the tint, redder), `warm` of the way from the tint to it,
 * `night` of that given back at night (a face in moonlight is still the night's colour).
 */
export const FACE_SHADE = { tone: 'vec3(1.13, 0.93, 0.8)', warm: '0.72', night: '0.6' };

/**
 * The spot blacks' screen-space taps (enclosure), as constants (the shader used to work out a cos
 * and a sin for every tap of every pixel): n fixed directions from 0.39 rad, every other one at
 * 0.55 of the radius. tests/occlusion-taps.test.js.
 */
export const OCCLUSION_TAPS = {
  spot: (n) => Array.from({ length: n }, (_, i) => { const a = 0.39 + (i * 6.2832) / n, r = i % 2 ? 0.55 : 1; return [Math.cos(a) * r, Math.sin(a) * r]; }),
};
/** A GLSL constant array of vec2s. */
export const glslVec2s = (name, list) => `const vec2 ${name}[${list.length}] = vec2[${list.length}](${list.map(([x, y]) => `vec2(${x.toFixed(7)}, ${y.toFixed(7)})`).join(', ')});`;

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
  uniform sampler2D tBloom;   // the glowing surfaces, blurred at a quarter of the resolution (createBloom)
  uniform sampler2D tBloom2;  // the same, wider (an eighth)
  uniform float uBloom;       // its strength (0: none)
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
  uniform float uProj11;      // projection[1][1] = 1 / tan(fov / 2)
  uniform float uAO;          // crease shading + ink accents
  uniform float uSkyBands;    // posterised sky gradient
  uniform float uHazeBands;   // distance haze in flat layers
  uniform float uRays;        // sun rays at low sun
  uniform vec4 uSubject;      // the player on screen: uv, view depth, radius (uv units, y)
  uniform float uAerial;      // distant layers lose saturation and drift to the sky colour
  uniform float uLineVary;    // thick silhouettes / thin interior lines / pen pressure
  uniform float uPostLite;    // 1 = one ink-line kernel instead of two (the handheld preset)
  uniform float uSkyFlat;     // flat printed sky (vs gradient)
  uniform float uSkyDots;     // stipple dots in the sky
  uniform float uCumulus;     // puffy cloud bank on the horizon
  uniform float uRain;        // weather: ink rain 0..1
  uniform float uRainNear;    // m: under a roof, no rain is drawn nearer than this (src/shelter.js)
  uniform float uStorm;       // weather: sandstorm 0..1
  uniform vec3 uStormColor;
  uniform vec4 uPlanet[3];        // xyz = direction, w = angular radius (0 = none)
  uniform vec4 uPlanetColor[3];   // rgb, a = ring (0 none, else ring tilt)
  uniform vec3 uPlanetCraters;    // per planet: 1 = cratered, 0 = a plain printed disc
  uniform vec4 uBackdrop;         // rgb, a = 1: one flat colour instead of the sky (a conversation's portrait)
  uniform float uCrevice;         // the deepest crevices filled with ink (0..1)
  uniform float uPaper;           // the paper's tooth (0..1)
  uniform float uShadowFlat;      // shadows printed in their own colour (0: albedo × tint .. 1: the tint at the surface's value)
  uniform vec4 uHaze;             // the far ground's haze colour, a = how much (0: the sky's horizon)
  uniform float uShadeKeep;       // how much of its own hue a shade keeps where its material doesn't say (materials.js SHADE)
  // spot blacks (SPOT): x how much (0 off), y the pocket's size (m), z how enclosed a shaded point must be
  // to go black (0..1), w how far cast shadows darken toward the spot tone (0..1); the tone: rgb, a how much
  // of the surface's own colour it keeps
  uniform vec4 uSpot;
  uniform vec4 uSpotTone;

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
    float t = smoothstep(0.0, 0.6, h);
    // posterised into flat bands, like a printed gradient
    float tb = (floor(t * 5.0) + smoothstep(0.46, 0.54, fract(t * 5.0))) / 5.0;
    vec3 c = mix(uSkyHorizon, uSkyTop, mix(t, tb, uSkyBands));
    // flat printed sky: one tint down to the horizon, only a narrow paler band right on it
    c = mix(c, mix(uSkyHorizon, uSkyTop, mix(0.45, 1.0, smoothstep(0.0, 0.03, h))), uSkyFlat);
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

  // Edge components at a given kernel width:
  //   x = depth discontinuity (silhouettes), y = normal crease,
  //   z = albedo boundary, w = shadow boundary.
  // minDepth = nearest surface in the kernel (for fading).
  vec4 inkLines(vec2 uv, float w, bool interior, out float minDepth) {
    vec2 px = max(w, 1.0) / uRes;
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
    if (c.w > 0.0 && interior) {
      float d1 = n1.w > 0.0 ? 1.0 - dot(c.xyz, n1.xyz) : 0.0;
      float d2 = n2.w > 0.0 ? 1.0 - dot(c.xyz, n2.xyz) : 0.0;
      float d3 = n3.w > 0.0 ? 1.0 - dot(c.xyz, n3.xyz) : 0.0;
      float d4 = n4.w > 0.0 ? 1.0 - dot(c.xyz, n4.xyz) : 0.0;
      nEdge = smoothstep(uNormalThresh, uNormalThresh * 1.5, max(max(d1, d2), max(d3, d4)));
    }

    // Albedo boundaries + shadow boundaries.
    float aEdge = 0.0, sEdge = 0.0;
    if (c.w > 0.0 && interior && (uAlbedoEdges > 0.0 || uShadowEdges > 0.0)) {
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
    return vec4(dEdge, nEdge, aEdge, sEdge);
  }

  // ---------------------------------------------------------------- crease shading
  // Small screen-space ambient occlusion from the depth/normal buffer: where
  // nearby geometry closes in (building bases, crevices, under canopies) the
  // inker adds darker tone and a few accent strokes.
  vec3 viewPos(vec2 uv, float d) {
    vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
    vec3 r = p.xyz / p.w;
    return r / -r.z * d;
  }
  ${glslVec2s('SPOT_TAPS8', OCCLUSION_TAPS.spot(8))}
  ${glslVec2s('SPOT_TAPS4', OCCLUSION_TAPS.spot(4))}
  float creaseAO(vec2 uv, vec3 nW, float d, vec2 fc) {
    vec3 P = viewPos(uv, d);
    vec3 nV = normalize(transpose(mat3(uCamWorld)) * nW);
    float R = 1.3;
    float rpx = clamp(R * uProj11 * 0.5 * uRes.y / d, 3.0, 48.0);
    // (the spiral's steps turned by one rotation, the random angle's: a cos and a sin per pixel, not
    // per tap; a tap that doesn't count weighs 0; the surface flags only read for a tap that would
    // count, to rule out a grass blade: most taps close nothing in. docs/systems/performance.md)
    float a0 = hash(fc) * 6.2832;
    vec2 cs = vec2(cos(a0), sin(a0));
    mat2 turn = mat2(cs.x, cs.y, -cs.y, cs.x);
    float ao = 0.0;
    for (int i = 0; i < 8; i++) {
      float b = float(i) * 2.39996;
      float rr = rpx * sqrt((float(i) + 0.5) / 8.0);
      vec2 suv = uv + turn * vec2(cos(b), sin(b)) * rr / uRes;
      float sd = texture(tNormal, suv).w;
      vec3 v = viewPos(suv, sd) - P;
      float dist = length(v);
      float c = step(0.0, sd) * sign(sd)   // (not the sky)
        * max(dot(nV, v) / max(dist, 1e-4) - 0.2, 0.0) * (1.0 - smoothstep(R * 0.6, R * 1.6, dist));
      // (grass blades close nothing in: no grey speckle round them)
      if (c > 0.0) c *= step(mod(texture(tHatch, suv).a, 16.0), 7.5);
      ao += c;
    }
    return clamp(ao / 8.0 * 2.2, 0.0, 1.0);
  }

  // ---------------------------------------------------------------- spot blacks
  // How enclosed a point is, at the scale of a pocket (R metres): from fixed directions round it in
  // screen space (no jitter: the estimate is smooth from pixel to pixel, so a hard threshold of it is a
  // clean-edged mass), the share of the neighbours standing in front of its face. taps: 8, or 4 (handheld).
  // The directions are constants (SPOT_TAPS8, SPOT_TAPS4), the view ray is affine in uv (a
  // perspective camera: ray(uv) = (uv * rA + rB, -1)), and a tap on the sky weighs 0 instead of a
  // skip: the same estimate at a fraction of its cost (docs/systems/performance.md).
  float enclosure(vec2 uv, vec3 nW, float d, float R, int taps) {
    vec2 rB = viewPos(vec2(0.0), 1.0).xy, rA = viewPos(vec2(1.0), 1.0).xy - rB;
    vec3 P = vec3(uv * rA + rB, -1.0) * d;
    vec3 nV = normalize(transpose(mat3(uCamWorld)) * nW);
    vec2 s = clamp(R * uProj11 * 0.5 * uRes.y / d, 4.0, 96.0) / uRes;
    float r1 = R * 1.5, r2 = R * 3.0, occ = 0.0;
    if (taps == 8) {
      for (int i = 0; i < 8; i++) {
        vec2 suv = uv + SPOT_TAPS8[i] * s;
        float sd = texture(tNormal, suv).w;
        vec3 v = vec3(suv * rA + rB, -1.0) * sd - P;
        float dist = length(v);
        occ += step(0.0, sd) * sign(sd)   // (the sky: open)
          * smoothstep(0.12, 0.5, dot(nV, v) / max(dist, 1e-4)) * (1.0 - smoothstep(r1, r2, dist));
      }
      return occ * 0.125;
    }
    for (int i = 0; i < 4; i++) {
      vec2 suv = uv + SPOT_TAPS4[i] * s;
      float sd = texture(tNormal, suv).w;
      vec3 v = vec3(suv * rA + rB, -1.0) * sd - P;
      float dist = length(v);
      occ += step(0.0, sd) * sign(sd) * smoothstep(0.12, 0.5, dot(nV, v) / max(dist, 1e-4)) * (1.0 - smoothstep(r1, r2, dist));
    }
    return occ * 0.25;
  }

  // ---------------------------------------------------------------- planets
  // Big flat bodies hanging in the sky: toon-lit by the sun, hatched on the
  // night side, a few craters, an optional ring, all inked.
  void drawPlanet(vec3 rd, vec4 P, vec4 C, float craters, inout vec3 col, inout float ink) {
    if (P.w <= 0.0) return;
    vec3 dir = normalize(P.xyz);
    vec3 e1 = normalize(cross(dir, vec3(0.0, 1.0, 0.0)));
    vec3 e2 = cross(e1, dir);
    // tangent-plane coordinates in units of the planet radius. Derivatives are
    // taken before any branching (a branch here left garbage derivatives along
    // the great circle 90° away, drawing a stray ink line across the sky).
    vec2 q = vec2(dot(rd, e1), dot(rd, e2)) / tan(P.w);
    float r = length(q);
    float fw = min(fwidth(r), 0.5);
    float cr0 = 0.0;
    vec2 rq0 = vec2(q.x, q.y / max(C.a, 1e-3));
    float ringFw = min(fwidth(length(rq0)), 0.5);
    float facing = step(0.0, dot(rd, dir));   // back hemisphere: nothing drawn
    if (facing == 0.0) return;
    float px = uPixelRatio;
    bool hasRing = C.a > 0.0;
    float ringR = 0.0, ringMask = 0.0;
    if (hasRing) {
      vec2 rq = vec2(q.x, q.y / C.a);
      ringR = length(rq);
      ringMask = (smoothstep(1.45, 1.45 + ringFw * 2.0, ringR) - smoothstep(2.1 - ringFw * 2.0, 2.1, ringR));
    }
    // back half of the ring is hidden by the planet
    bool front = q.y < 0.0;
    if (hasRing && !front && r < 1.0) ringMask = 0.0;
    if (r < 1.0 + fw) {
      vec3 n = normalize(q.x * e1 + q.y * e2 - sqrt(max(1.0 - r * r, 0.0)) * dir);
      float lit = smoothstep(-0.02, 0.02, dot(n, uSunDisc));
      vec3 base = C.rgb;
      vec3 pc = mix(base * uShadowTint * 0.9, base * mix(vec3(1.0), uLightTint, 0.3), lit);
      // craters
      vec2 cq = q * 4.0;
      vec2 cid = floor(cq);
      float ch = hash(cid + 3.1);
      float cr = length(fract(cq) - 0.5 - (vec2(hash(cid), hash(cid + 1.7)) - 0.5) * 0.4);
      float crater = step(0.7, ch) * (1.0 - smoothstep(0.18, 0.2, cr)) * craters;
      pc = mix(pc, pc * 0.86, crater);
      float disc = 1.0 - smoothstep(1.0 - fw, 1.0 + fw, r);
      col = mix(col, pc, disc);
      // hatching on the night side, anchored to the planet
      float hc = dot(q, vec2(0.8, 0.6)) * 22.0;
      float hl = 1.0 - smoothstep(0.0, fwidth(hc) * 1.2 * px, abs(fract(hc) - 0.5) * 2.0 - 0.6);
      col = mix(col, uInk, hl * (1.0 - lit) * disc * 0.35 * uHatch);
      ink = max(ink, (1.0 - smoothstep(0.0, fw * 1.4 * px, abs(r - 1.0))) * 0.95);
      ink = max(ink, (1.0 - smoothstep(0.0, fwidth(cr) * 1.2 * px, abs(cr - 0.19))) * step(0.7, ch) * disc * 0.5 * craters);
    }
    if (hasRing && ringMask > 0.0) {
      vec3 rc = mix(C.rgb * 1.15, vec3(0.97, 0.94, 0.86), 0.5);
      col = mix(col, rc, ringMask);
      ink = max(ink, (1.0 - smoothstep(0.0, ringFw * 1.3 * px, min(abs(ringR - 1.45), abs(ringR - 2.1)))) * 0.85);
    }
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

    // Sun rays: pale wedges fanning from a low sun.
    if (uRays > 0.0 && uSunDisc.y > -0.05) {
      float low = (1.0 - smoothstep(0.08, 0.45, uSunDisc.y)) * (1.0 - uNight);
      vec3 s1 = normalize(cross(uSunDisc, vec3(0.0, 1.0, 0.0)));
      vec3 s2 = cross(s1, uSunDisc);
      float phi = atan(dot(rd, s2), dot(rd, s1));
      float wedge = smoothstep(0.55, 0.62, vnoise(vec2(phi * 9.0 + uTime * 0.01, 3.0)));
      float near = (1.0 - smoothstep(0.08, 0.9, ang)) * step(r * 1.7, ang);
      col = mix(col, mix(col, uSunColor, 0.6), wedge * near * low * uRays);
    }

    for (int i = 0; i < 3; i++) drawPlanet(rd, uPlanet[i], uPlanetColor[i], uPlanetCraters[i], col, ink);

    // printed sky: a field of fine dots, a bit denser up high
    if (uSkyDots > 0.0 && rd.y > 0.0) {
      // dots live on the sky dome (azimuth / elevation), not on the screen;
      // the grid spacing snaps to powers of two of ~3.4 px so they stay even
      float el = asin(clamp(rd.y, -1.0, 1.0));
      // azimuth/elevation low in the sky, a projected cap overhead (no pinch at the zenith)
      bool cap = rd.y > 0.82;
      vec2 sp = cap ? rd.xz / rd.y + 40.0 : vec2(atan(rd.x, rd.z) * cos(el), el);
      // the mapping's screen Jacobian: sky units per device pixel, both axes
      mat2 J = mat2(dFdx(sp), dFdy(sp));
      float det = abs(determinant(J));
      mat2 Ji = det > 1e-12 ? inverse(J) : mat2(1e6);
      float pxA = clamp(sqrt(det), 1e-6, 0.02);
      float lvl = log2(pxA * 5.0 * uPixelRatio);
      float dots = 0.0;
      // a grain, not a screen: dots anywhere in their cell, of several sizes and weights, thicker
      // and thinner in drifts (a slow noise on the dome), the same density down to the horizon
      float drift = smoothstep(0.25, 0.75, vnoise(sp * 9.0 + 3.0));
      for (int L = 0; L < 2; L++) {
        float cell = exp2(floor(lvl) + float(L));
        vec2 g = sp / cell, id = floor(g);
        vec2 o = vec2(hash(id + 1.3), hash(id + 7.1)) * 0.9 + 0.05;
        float present = step(hash(id + 4.4), mix(0.16, 0.38, drift));
        float size = mix(0.3, 0.75, hash(id + 2.9));
        float dpx = length(Ji * ((fract(g) - o) * cell));      // true screen pixels: round dots
        float d = (1.0 - smoothstep(size * uPixelRatio, size * uPixelRatio + 0.5, dpx)) * present * mix(0.55, 1.0, hash(id + 6.2));
        dots += d * (L == 0 ? 1.0 - fract(lvl) : fract(lvl));
      }
      col = mix(col, uSkyTop * 0.72, clamp(dots, 0.0, 1.0) * smoothstep(0.65, 1.6, uPixelRatio) * uSkyDots * (1.0 - uNight * 0.5));
    }

    // cumulus bank: puffy cream clouds sitting on the horizon, inked, each
    // puff drawn as an arc, undersides cut flat
    if (uCumulus > 0.0 && rd.y > -0.02) {
      float az = atan(rd.x, rd.z);
      float e = rd.y;
      float hgt = 0.0, inner = 1.0;
      for (int k = 0; k < 3; k++) {
        float n = 7.0 + float(k) * 5.0;                       // puffs per radian
        float f = az * n / 6.2832 * 6.2832 + float(k) * 1.7;
        float cell = floor(f), u = fract(f) * 2.0 - 1.0;
        float big = hash(vec2(cell, float(k) + 2.0));
        float mass = smoothstep(0.25, 0.65, vnoise(vec2(az * 1.3 + float(k) * 3.0, 4.0)));   // gaps between banks
        float r = (0.012 + 0.03 * big) * mass * (1.0 - float(k) * 0.22);
        float top = (0.03 + 0.03 * mass) * step(0.01, mass) + r * 1.6 * sqrt(max(1.0 - u * u, 0.0));
        hgt = max(hgt, top);
        inner = min(inner, abs(e - top) / max(fwidth(e), 1e-5));
      }
      float fw = max(fwidth(e), 1e-5);
      float cloud = (1.0 - smoothstep(hgt - fw, hgt + fw, e)) * step(0.0, hgt - 0.001) * uCumulus;
      float shade = smoothstep(hgt * 0.45, 0.0, e);                 // bottom of the bank in shade
      vec3 cc = mix(vec3(0.98, 0.95, 0.86) * uLightTint, uSkyHorizon * uShadowTint * 1.12, shade * 0.6);
      col = mix(col, cc, cloud);
      ink = max(ink, (1.0 - smoothstep(0.0, 1.3 * uPixelRatio, abs(e - hgt) / fw)) * step(0.001, hgt) * uCumulus);
      ink = max(ink, (1.0 - smoothstep(0.0, 0.9 * uPixelRatio, inner)) * cloud * 0.55);   // inner puff arcs
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
    vec4 surface = texture(tHatch, uv);
    // the shade's tone, packed over the strokes (materials.js SHADE): r += 2 (1 + hue step), g += 2 lift step
    vec2 shadeQ = floor(surface.rg * 0.5);
    surface.rg -= 2.0 * shadeQ;
    // a weathered wall (materials.js WEATHER: b += 16): the dust splashed up its foot, below
    float wearW = step(15.5, surface.b);
    surface.b -= 16.0 * wearW;
    // a material's own spot-black amount, packed over its drawn detail (materials.js SPOT): b += 4 × step
    float spotQ = floor(surface.b * 0.25);
    surface.b -= 4.0 * spotQ;
    float spotMat = spotQ > 0.5 ? (spotQ - 1.0) / ${SPOT.steps}.0 : 1.0;
    float shadeLift = shadeQ.y / ${SHADE.lifts}.0;
    // (hue steps past the hues: the material's own flat print, materials.js SHADE.flats)
    bool ownFlat = shadeQ.x > ${SHADE.hues + 1}.5;
    float shadeHue = shadeQ.x > 0.5 && !ownFlat ? (shadeQ.x - 1.0) / ${SHADE.hues}.0 : uShadeKeep;
    float shadowFlat = ownFlat ? (shadeQ.x - ${SHADE.hues + 2}.0) / ${SHADE.flats}.0 : uShadowFlat;
    // gHatch.a packs glow (0..1) + 2 hero (the player) + 4 figure (any other person) + 8 soft ink (grass blades)
    // + 16 a face (its skin and eyes: flat colour and one shadow tone, no line round the shade, no crease shading)
    // + 32 sand banked against something (sand-drifts.js: the line where it meets a wall drawn softly)
    float drift = step(31.5, surface.a);
    surface.a -= 32.0 * drift;
    float face = step(15.5, surface.a);
    surface.a -= 16.0 * face;
    float soft = step(7.5, surface.a);
    surface.a -= 8.0 * soft;
    // a grass blade carries no hatching: r is its pen line's share, g its outline's fade with distance
    vec2 grassInk = surface.rg * soft;
    surface.rgb *= 1.0 - soft;
    float figure = step(3.5, surface.a);
    surface.a -= 4.0 * figure;
    float hero = step(1.5, surface.a);
    // a light (gHatch.a glow over 0.62: crystals, lamps, lit windows; the local lights' pools stay under it)
    float emitHere = isSky ? 0.0 : smoothstep(0.62, 0.9, surface.a - 2.0 * hero);
    // Detail follows projected size, so a small landscape-phone figure keeps colour.
    float heroHeight = max(0.0, uSubject.w) * 2.0 * uRes.y / uPixelRatio;
    float heroDetail = smoothstep(70.0, 180.0, heroHeight);
    vec2 hp = max(1.0, 0.65 * uPixelRatio) / uRes;
    vec4 hm = vec4(texture(tHatch, uv + vec2(hp.x, 0)).a,
      texture(tHatch, uv - vec2(hp.x, 0)).a, texture(tHatch, uv + vec2(0, hp.y)).a,
      texture(tHatch, uv - vec2(0, hp.y)).a);
    hm = mod(hm, 16.0);
    hm -= 8.0 * step(vec4(7.5), hm);
    hm = step(vec4(1.5), hm - 4.0 * step(vec4(3.5), hm));
    float heroNear = max(hero, max(max(hm.x, hm.y), max(hm.z, hm.w)));
    float heroBoundary = heroNear - min(hero, min(min(hm.x, hm.y), min(hm.z, hm.w)));
    float depth = isSky ? 1e7 : N.w;
    vec3 rd = viewRay(uv);

    // ---- debug views
    if (uDebug == 2) { fragColor = vec4(isSky ? skyBase(rd) : A.rgb, 1.0); return; }
    if (uDebug == 3) { fragColor = vec4(isSky ? vec3(0.0) : N.rgb * 0.5 + 0.5, 1.0); return; }
    if (uDebug == 4) { fragColor = vec4(vec3(isSky ? 1.0 : pow(depth / 3000.0, 0.4)), 1.0); return; }
    if (uDebug == 5) { fragColor = vec4(vec3(isSky ? 1.0 : A.a), 1.0); return; }
    if (uDebug == 9) { fragColor = vec4(vec3(isSky ? 1.0 : 1.0 - enclosure(uv, N.xyz, depth, uSpot.y, 8)), 1.0); return; }   // spot blacks: how enclosed
    if (uDebug == 8) { fragColor = vec4(vec3(isSky ? 1.0 : 1.0 - texture(tHatch, uv).b), 1.0); return; }
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
    float weight = mix(uLineWidth, uLineWidth * 0.6, smoothstep(15.0, 400.0, probeD));
    // pen pressure: the line swells and thins along its length
    float press = mix(1.0, 0.65 + 0.7 * vnoise(fc * 0.045 + boilT * 3.1), uLineVary);
    // silhouettes (depth edges) heavy, interior creases and colour edges light
    float silW = weight * mix(1.0, 1.35, uLineVary) * press;
    float inW = weight * mix(1.0, 0.75, uLineVary) * mix(1.0, 0.85 + 0.3 * vnoise(fc * 0.06 + 9.0), uLineVary);
    // Keep continuous interior strokes near the subject.
    vec2 sd = (uv - uSubject.xy) * vec2(uRes.x / uRes.y, 1.0);
    float subj = (1.0 - smoothstep(uSubject.w * 0.7, uSubject.w, length(sd))) * (1.0 - smoothstep(1.5, 4.0, abs(probeD - uSubject.z)));
    // Use the exact player mask instead of fattening everything near its screen centre.
    silW = mix(silW, 0.65, heroNear);
    euv = mix(euv, uv, heroNear);
    float nearD2;
    vec4 eS, eI;
    if (uPostLite > 0.5) {
      // handheld: one kernel between the two weights serves silhouettes and interior lines (half the taps)
      eI = inkLines(euv, mix(silW, inW, 0.5) * uPixelRatio, true, nearD2);
      eS = eI; nearD = nearD2;
    } else {
      eS = inkLines(euv, silW * uPixelRatio, false, nearD);
      eI = inkLines(euv, inW * uPixelRatio, true, nearD2);
    }
    nearD = min(nearD, nearD2);
    // interior lines break up like quick pen strokes; gaps are anchored in the world
    vec3 wpL = uCamWorld[3].xyz + rd * min(probeD, 5000.0) / max(dot(rd, -uCamWorld[2].xyz), 0.2);
    float gapN = vnoise(vec2(wpL.x + wpL.y * 0.7, wpL.z - wpL.y * 0.4) * 0.9);
    float broken = mix(1.0, smoothstep(0.22, 0.34, gapN), uLineVary * (1.0 - subj) * smoothstep(3.0, 12.0, probeD));
    float ink = clamp(max(max(eS.x, eI.y * broken), max(eI.z * 0.85 * broken, eI.w * 0.8 * (1.0 - face))), 0.0, 1.0);

    // People far away: a pen line of fixed width turned small figures into black shapes
    // (more so at the handheld's render scale). Where this pixel's kernel touches a person
    // (gHatch.a figure flag), the lines are redrawn by the figure's height on screen: a
    // narrower kernel and a lighter outline, kept on the background side once the figure is
    // small, and the inner lines (folds, colour zones, face) fading out first. Only pixels
    // that already have ink pay for the extra taps.
    // how much inner ink (lines, drawn detail, hatching) a person keeps here
    float innerK = figure > 0.5 && hero < 0.5 ? smoothstep(70.0, 260.0, 1.8 * uRes.y * 0.5 * uProj11 / max(depth, 0.1)) : 1.0;
    float softNear = soft;   // a grass blade under this pixel's ink kernel (soft ink)
    float driftNear = drift; // banked sand under this pixel's ink kernel
    vec2 grassNear = grassInk;   // its pen line's share and its outline's fade (the blade's own, or the nearest blade's)
    if (ink > 0.02 && hero < 0.5 && !isSky) {
      vec2 fo = max(silW * uPixelRatio, 1.0) / uRes;
      vec4 t1 = texture(tHatch, euv + vec2(fo.x, 0)), t2 = texture(tHatch, euv - vec2(fo.x, 0)),
           t3 = texture(tHatch, euv + vec2(0, fo.y)), t4 = texture(tHatch, euv - vec2(0, fo.y));
      vec4 fa = vec4(t1.a, t2.a, t3.a, t4.a);
      driftNear = max(drift, max(max(step(31.5, fa.x), step(31.5, fa.y)), max(step(31.5, fa.z), step(31.5, fa.w))));
      fa = mod(fa, 16.0);
      vec4 faSoft = step(vec4(7.5), fa);
      fa -= 8.0 * faSoft;
      softNear = max(soft, max(max(faSoft.x, faSoft.y), max(faSoft.z, faSoft.w)));
      if (soft < 0.5 && softNear > 0.5) {
        // beside a blade: its pen line at most, its outline as faded as the least faded blade round it
        vec4 pens = vec4(t1.r, t2.r, t3.r, t4.r) * faSoft, fades = mix(vec4(1.0), vec4(t1.g, t2.g, t3.g, t4.g), faSoft);
        grassNear = vec2(max(max(pens.x, pens.y), max(pens.z, pens.w)), min(min(fades.x, fades.y), min(fades.z, fades.w)));
      }
      float figHit = max(figure, max(max(step(3.5, fa.x), step(3.5, fa.y)), max(step(3.5, fa.z), step(3.5, fa.w))));
      if (figHit > 0.5) {
        float figPx = 1.8 * uRes.y * 0.5 * uProj11 / max(nearD, 0.1);   // a person's height, render px
        float k = smoothstep(40.0, 260.0, figPx);
        float innerF = smoothstep(70.0, 260.0, figPx);
        float alpha = mix(0.5, 1.0, smoothstep(20.0, 140.0, figPx));
        float nd;
        vec4 fS = inkLines(euv, mix(1.0, silW * uPixelRatio, k), false, nd);
        vec4 fI = uPostLite > 0.5 ? fS : inkLines(euv, mix(1.0, inW * uPixelRatio, k), true, nd);
        float outline = fS.x * alpha * mix(1.0 - figure, 1.0, k);
        ink = clamp(max(outline, max(max(fI.y, fI.z * 0.85) * broken, fI.w * 0.8 * (1.0 - face)) * mix(innerF, 1.0, 1.0 - figure)), 0.0, 1.0);
      }
    }

    float heroInk = max(heroBoundary * 0.82, max(eI.y, eI.z) * 0.22 * heroDetail * hero);
    ink = mix(ink, heroInk, heroNear);

    // fog factor (for lines use the nearest surface in the kernel)
    float fogLine = 1.0 - exp(-max(nearD - uFogStart, 0.0) * uFogDensity * uFogMul * 1.4);
    ink *= 1.0 - fogLine;

    vec3 col;
    if (isSky) {
      float skyInk;
      col = renderSky(rd, fc, skyInk);
      ink = max(ink, skyInk * (1.0 - uBackdrop.a));
      col = mix(col, uBackdrop.rgb, uBackdrop.a);
    } else {
      // ---- 2. two-tone cel shading
      vec3 albedo = A.rgb;
      float L = A.a;
      float lit = smoothstep(uToon - 0.01, uToon + 0.01, L);
      // during the sun -> moon hand-over both tones converge, so shadows fade
      // a face's shade (its skin, its eyes' whites) is a warm darker tone of itself, not the world's
      // blue-violet shadow: the shadow tint's own darkness, turned warm (less so at night)
      vec3 shadowTint = uShadowTint;
      // each surface's own shade (materials.js SHADE): the tint's darkness in its own hue, a little
      // warm, as much as it keeps; then lifted toward the light (a half-tone, the ground's bounce)
      float tintV = dot(uShadowTint, vec3(0.3, 0.55, 0.15));
      shadowTint = mix(shadowTint, tintV * vec3(${SHADE.warm.join(', ')}), shadeHue * (1.0 - 0.6 * uNight));
      if (face > 0.5) shadowTint = mix(uShadowTint, dot(uShadowTint, vec3(0.3, 0.55, 0.15)) * ${FACE_SHADE.tone}, ${FACE_SHADE.warm} * (1.0 - ${FACE_SHADE.night} * uNight));
      vec3 shadeC = albedo * shadowTint;
      // a flat printed shadow (uShadowFlat): the shadow's own colour at the surface's value, not the
      // surface's colour darkened (the City-Shaft's pink walls go blue in shade, not dark pink)
      if (shadowFlat > 0.0 && face < 0.5) shadeC = mix(shadeC, shadowTint * (0.45 + 0.7 * dot(albedo, vec3(0.3, 0.55, 0.15))), shadowFlat);
      shadeC = mix(shadeC, albedo * uLightTint, face > 0.5 ? 0.0 : shadeLift);
      vec3 shade = mix(shadeC, albedo * uLightTint, uFlatten);
      // self-lit surfaces (gHatch.a) keep their colour at night and glow a little
      float glow = surface.a - 2.0 * hero;
      col = mix(shade, albedo * mix(uLightTint, vec3(1.12), glow), lit);
      // a light: a bright flat core, paler towards white, whatever the hour
      col = mix(col, mix(albedo * 1.1, vec3(1.0), 0.3), emitHere);
      col = mix(col, mix(col, albedo * uLightTint, 0.3), hero);
      col *= 1.0 + uHighlight * smoothstep(0.9, 0.92, L);

      // ---- 3. hatching in shadow
      float dark = clamp((uToon - L) / uToon, 0.0, 1.0);
      float hFade = (1.0 - smoothstep(uHatchScreen > 0.5 ? 40.0 : 150.0, uHatchScreen > 0.5 ? 350.0 : 700.0, depth)) * uHatch * (1.0 - uFlatten);
      hFade *= mix(1.0, 0.12 * heroDetail, hero);
      vec3 H = surface.rgb;
      // the player's drawn face and folds are its pen work: full strength once it is large enough to read
      H.b *= mix(1.0, heroDetail, hero) * innerK;
      hFade *= innerK;
      // drawn detail lines: grids, glyphs, ripples, cracks, fissures (independent of the marks toggle)
      // (a value over 1 is a pen line, the faces' (materials.js faceInk): darker, up to 0.92 at 2)
      float drawnK = mix(0.6, 0.88, hero);
      col = mix(col, uInk, (clamp(H.b, 0.0, 1.0) * drawnK + clamp(H.b - 1.0, 0.0, 1.0) * (0.92 - drawnK)) * (1.0 - smoothstep(120.0, 600.0, depth)));
      if (hFade > 0.0 && uHatchScreen < 0.5) {
        col = mix(col, uInk, clamp(max(H.r, H.g), 0.0, 1.0) * hFade * 0.55);
      } else if (hFade > 0.0) {
        float h1 = hatch(fc, 0.95, uHatchSpacing, mix(0.9, 2.2, dark)) * smoothstep(0.02, 0.12, dark);
        float h2 = hatch(fc, -0.6, uHatchSpacing * 1.2, mix(0.6, 1.7, dark)) * smoothstep(0.5, 0.65, dark);
        col = mix(col, uInk, max(h1, h2) * hFade * 0.55);
      }

      // ---- 3b. crease shading: darker tone + accent strokes where geometry closes in
      if (uAO > 0.0 && depth < 260.0 && hero < 0.5 && soft < 0.5 && face < 0.5) {   // (not between grass blades: they'd go grey; a face's sockets are hatched instead)
        float ao = creaseAO(uv, N.xyz, depth, fc) * (1.0 - smoothstep(80.0, 260.0, depth)) * uAO * (1.0 - emitHere);
        col = mix(col, col * uShadowTint * 0.85, smoothstep(0.15, 0.7, ao) * 0.55);
        ink = max(ink, smoothstep(0.6, 0.9, ao) * 0.45 * innerK);
        // the deepest crevices (between ribs, into a hull's machinery) filled solid, as an inker does
        col = mix(col, uInk * 1.15, smoothstep(0.72, 0.97, ao) * uCrevice * (1.0 - L * 0.5) * innerK);
      }

      // ---- 3b'. weathered walls: a flat band of darker dust splashed up the foot of the wall, its top a
      // little ragged. Found from the G-buffer: a probe the band's height below this pixel (on screen) that
      // lands on the ground (facing up) less than the band's height under it (in the world). One tap.
      if (wearW > 0.5 && depth < 220.0 && abs(N.y) < 0.5) {
        float bandH = ${WEATHER.foot.height};
        vec3 wpP = uCamWorld[3].xyz + rd * depth / max(dot(rd, -uCamWorld[2].xyz), 0.2);
        float dyPx = clamp(bandH * 1.6 * uProj11 * 0.5 * uRes.y / depth, 1.0, 120.0);
        vec2 puv = uv - vec2(0.0, dyPx / uRes.y);
        vec4 Np = texture(tNormal, puv);
        if (Np.w > 0.0 && Np.y > 0.7) {
          vec3 wpG = uCamWorld[3].xyz + viewRay(puv) * Np.w / max(dot(viewRay(puv), -uCamWorld[2].xyz), 0.2);
          float hUp = wpP.y - wpG.y;
          float rag = (vnoise(vec2(wpP.x + wpP.z, 0.0) * 1.7) - 0.5) * 0.22;
          float band = (1.0 - smoothstep(bandH - 0.02 + rag, bandH + 0.02 + rag, hUp)) * step(-0.3, hUp) * (1.0 - smoothstep(150.0, 220.0, depth));
          col = mix(col, col * vec3(0.82, 0.78, 0.73), band * ${(WEATHER.foot.dark * 4).toFixed(2)});
        }
      }

      // ---- 3c. spot blacks: the third tier of value. A shaded point enclosed at the scale of a pocket
      // (between ribs or pipes, into a hull, a city's recesses) is filled with a near-black mass of the
      // world's darkest tone, hard-edged; cast shadows darken toward it (uSpot.w). Never on a face, a
      // person, grass or a light; never in the light (the sheets keep their lit areas clean).
      if (uSpot.x > 0.0 && lit < 0.5 && spotMat > 0.0 && depth < 600.0 && face + figure + hero + soft < 0.5 && emitHere < 0.5) {
        vec3 spotC = uSpotTone.rgb * mix(vec3(1.0), clamp(albedo * 2.2, 0.0, 1.6), uSpotTone.a);
        float k = uSpot.x * spotMat * (1.0 - uNight * 0.5) * (1.0 - smoothstep(350.0, 600.0, depth)) * (1.0 - uFlatten);
        float encl = enclosure(uv, N.xyz, depth, uSpot.y, uPostLite > 0.5 ? 4 : 8);
        float spot = smoothstep(uSpot.z - 0.03, uSpot.z + 0.03, encl) * (1.0 - shadeLift);
        // in cast shadow (facing the sun, yet dark): toward the spot tone, keeping its strokes
        float castK = smoothstep(0.05, 0.2, dot(N.xyz, uSunDir)) * (1.0 - shadeLift) * uSpot.w;
        col = mix(col, spotC, castK * k);
        col = mix(col, spotC, spot * k);
        if (uDebug == 10) { fragColor = vec4(castK * k, spot * k, 0.2, 1.0); return; }   // spot blacks: the cast (red) and spot (green) masks
      }

      // ---- 4. atmospheric perspective, in flat layers like a printed background
      float fog = 1.0 - exp(-max(depth - uFogStart, 0.0) * uFogDensity * uFogMul);
      float fb = fog * 4.0;
      float fogQ = (floor(fb) + smoothstep(0.42, 0.58, fract(fb))) / 4.0;
      fog = mix(fog, fogQ, uHazeBands);
      vec3 skyC = skyBase(rd);
      // the far ground's own haze (uHaze: rgb, a = how much): a pale band of far land under the sky
      // (the desert's warm lilac-cream dunes), not the sky's colour
      if (uHaze.a > 0.0) skyC = mix(skyC, uHaze.rgb, uHaze.a * (1.0 - uNight));
      // aerial perspective: mid-distance layers go greyer and paler before the fog takes them
      float aer = smoothstep(0.0, 0.55, fog) * uAerial;
      float luma = dot(col, vec3(0.3, 0.55, 0.15));
      col = mix(col, mix(vec3(luma), skyC, 0.35) * 1.04, aer * 0.4);
      col = mix(col, skyC, fog);
    }

    if (uDebug == 6) col = vec3(0.97, 0.94, 0.86);
    // no ink eats a light: its inner lines go, its outline thins
    ink *= 1.0 - emitHere * 0.7;
    // grass: its edges drawn in a darker shade of the green, not black, and only on the blade's
    // own side (half as wide); a few tufts keep a real pen line
    vec3 inkC = uInk;
    if (softNear > 0.5) {
      inkC = mix(mix(uInk, col * 0.62, 0.85), uInk, grassNear.x);
      // (on the blade itself only its outline: no crease, colour-edge or shadow-edge lines;
      //  fading out with distance, where the blades blend into the ground)
      ink = (soft > 0.5 ? min(ink, eS.x) * mix(0.75, 1.0, grassNear.x) : ink * mix(0.22, 1.0, grassNear.x)) * (1.0 - grassNear.y);
    }
    // where banked sand meets a wall: a light line in a darker shade of the sand, not a hard contact line
    if (driftNear > 0.5 && softNear < 0.5) { inkC = mix(uInk, col * 0.6, 0.55); ink *= 0.45; }
    col = mix(col, inkC, ink);

    // ---- 4b. light: a halo round glowing things, in flat rings like a printed glow, and a
    // soft wash of their colour over what is near (it washes over the ink lines too)
    if (uBloom > 0.0) {
      vec3 b = texture(tBloom, uv).rgb, w = texture(tBloom2, uv).rgb;
      float bl = max(b.r, max(b.g, b.b)), wl = max(w.r, max(w.g, w.b));
      if (wl > 0.003 || bl > 0.003) {
        float k = uBloom * mix(0.6, 1.0, uNight);
        vec3 light = mix((b + w) / max(bl + wl, 1e-4), vec3(1.0), 0.45);
        // the inner ring hugs the light, the outer one reaches further; both flat
        float r1 = smoothstep(0.14, 0.16, bl), r2 = max(r1, smoothstep(0.05, 0.058, wl));
        float out1 = 1.0 - emitHere;
        col = mix(col, light, (r1 * 0.5 + (r2 - r1) * 0.22) * k * out1);
        col += w * (0.4 + 0.6 * uNight) * uBloom * out1;   // its colour on what is near
      }
    }

    // ---- 5. weather, drawn on the page like the rest
    if (uStorm > 0.0) {
      // sand haze: the whole picture sinks into a warm flat tone, nearest things last
      float near = isSky ? 1.0 : smoothstep(4.0, 90.0, depth);
      col = mix(col, uStormColor, uStorm * (0.25 + 0.55 * near));
      // streaks of blown sand racing across the frame
      vec2 sp = vec2(fc.x * 0.6 - uTime * 900.0, fc.y);
      float row = floor(sp.y / 6.0);
      float hr = hash(vec2(row, 3.7));
      float dash = smoothstep(0.82, 0.86, fract(sp.x / (180.0 + hr * 260.0) + hr * 7.0)) * step(0.55, hr);
      float thin = 1.0 - smoothstep(0.6, 1.2, abs(fract(sp.y / 6.0) - 0.5) * 6.0);
      col = mix(col, uInk * 0.6 + uStormColor * 0.4, dash * thin * uStorm * 0.45);
    }
    if (uRain > 0.0) {
      col *= 1.0 - 0.1 * uRain;
      // slanted ink strokes falling in columns
      vec2 rp = vec2(fc.x + fc.y * 0.22, fc.y + uTime * 1100.0);
      float colId = floor(rp.x / 11.0);
      float h1 = hash(vec2(colId, 1.3)), h2 = hash(vec2(colId, 8.1));
      float len = 26.0 + h1 * 40.0;
      float v = fract((rp.y + h2 * 900.0) / (len * 6.0));
      float stroke = (1.0 - smoothstep(0.0, 0.16, v)) * step(0.35, h1);
      float w = 1.0 - smoothstep(0.35, 0.9, abs(fract(rp.x / 11.0) - 0.5) * 11.0);
      // under a roof the rain falls out past its edge, not over what's under it with you
      float wet = uRainNear > 0.0 ? smoothstep(uRainNear * 0.7, uRainNear, depth) : 1.0;
      col = mix(col, uInk, stroke * w * uRain * 0.5 * wet);
    }

    // ---- 6. paper
    // no per-pixel noise: a screen-fixed grain reads as dirt the world slides under
    float grain = 0.0;
    float fibre = vnoise(fc * 0.55) * 0.5 + vnoise(fc * 0.21 + 7.0) * 0.5;   // isotropic: no streaks
    col *= 1.0 + uGrain * (grain * 0.5 + (fibre - 0.5) * 0.6);
    // the paper's tooth: a fine mottle and its pits, strongest in the light colours (ink sits on it)
    if (uPaper > 0.0) {
      // (the handheld: one octave and no pits, one noise tap instead of four)
      float tooth = uPostLite > 0.5 ? vnoise(fc * 0.9 + 3.1) : vnoise(fc * 0.9 + 3.1) * 0.55 + vnoise(fc * 0.37 + 11.0) * 0.3 + vnoise(fc * 0.09 + 5.0) * 0.15;
      float pits = uPostLite > 0.5 ? 0.0 : smoothstep(0.78, 0.92, vnoise(fc * 1.7 + 17.0));
      float onLight = smoothstep(0.25, 0.75, dot(col, vec3(0.3, 0.55, 0.15)));
      col *= 1.0 + uPaper * onLight * ((tooth - 0.5) * 0.11 - pits * 0.05);
    }
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
    tBloom: { value: null },
    tBloom2: { value: null },
    uBloom: { value: 0 },
    uHatchScreen: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uPixelRatio: { value: 1 },
    uInvProj: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uSunDir: { value: new THREE.Vector3() },
    uTime: { value: 0 },

    // (the surface shader's own: metals reflect the sky, windows light up at night)
    uSkyTop: sharedUniforms.uSkyTop,
    uSkyHorizon: sharedUniforms.uSkyHorizon,
    uInk: { value: new THREE.Color('#2b211f') },
    uShadowTint: { value: new THREE.Color('#a59bd0') },
    uSunColor: { value: new THREE.Color('#fff6dc') },
    uLightTint: { value: new THREE.Color('#ffffff') },
    uNight: sharedUniforms.uNight,
    uSunDisc: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDisc: { value: new THREE.Vector3(0, -1, 0) },
    uMoonVis: { value: 0 },
    uFlatten: { value: 0 },
    uFogMul: { value: 1 },
    uProj11: { value: 1 },
    uAO: { value: 1 },
    uSkyBands: { value: 0.7 },
    uHazeBands: { value: 0.6 },
    uRays: { value: 1 },
    uLineVary: { value: 1 },
    uPostLite: { value: 0 },
    uSubject: { value: new THREE.Vector4(0, 0, 0, -1) },
    uAerial: { value: 1 },
    uSkyFlat: { value: 0 },
    uSkyDots: { value: 0 },
    uCumulus: { value: 0 },
    uRain: { value: 0 },
    uRainNear: { value: 0 },
    uStorm: { value: 0 },
    uStormColor: { value: new THREE.Color('#e3c58f') },
    uBackdrop: { value: new THREE.Vector4(0, 0, 0, 0) },
    uPlanet: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    uPlanetColor: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    uPlanetCraters: { value: new THREE.Vector3(1, 1, 1) },

    uFogDensity: { value: 0.0011 },
    uFogStart: { value: 120 },

    uLineWidth: { value: 1.25 },
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
    uDots: sharedUniforms.uDots,
    uHighlight: { value: 0.0 },
    uClouds: sharedUniforms.uClouds,
    // the shade's tones (materials.js SHADE: the surface shader packs them, the presets set them)
    uHalftone: sharedUniforms.uHalftone,
    uBounce: sharedUniforms.uBounce,
    uShadeKeep: sharedUniforms.uShadeKeep,
    uCrevice: { value: 0 },
    uPaper: { value: 0 },
    uShadowFlat: { value: 0 },
    uHaze: { value: [1, 1, 1, 0] },
    uSpot: { value: [0, 2.5, 0.5, 0] },
    uSpotTone: { value: [0.17, 0.15, 0.19, 0.4] },
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

// ---------------------------------------------------------------------------
// Light: the glowing surfaces (gHatch.a glow over 0.62) gathered from the G-buffer at a
// quarter of the resolution, then blurred (two passes). The composite reads it back as a halo
// in flat rings round each light and a soft wash of its colour over what is near.
// About 1/16 of the pixels, a few taps each: cheap enough for the handheld.
// ---------------------------------------------------------------------------
const bloomVert = /* glsl */ `
  out vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const extractFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D tAlbedo;
  uniform sampler2D tHatch;
  in vec2 vUv;
  out highp vec4 fragColor;
  void main() {
    ivec2 size = textureSize(tHatch, 0), base = ivec2(gl_FragCoord.xy) * 4;
    vec3 sum = vec3(0.0), mx = vec3(0.0);
    for (int y = 0; y < 4; y++)
      for (int x = 0; x < 4; x++) {
        ivec2 p = min(base + ivec2(x, y), size - 1);
        float a = mod(texelFetch(tHatch, p, 0).a, 16.0);   // (+16: a face)
        a -= 8.0 * step(7.5, a);
        a -= 4.0 * step(3.5, a);
        a -= 2.0 * step(1.5, a);
        float e = smoothstep(0.62, 0.9, a);
        if (e > 0.0) { vec3 c = texelFetch(tAlbedo, p, 0).rgb * e; sum += c; mx = max(mx, c); }
      }
    fragColor = vec4(mix(sum / 16.0, mx, 0.5), 1.0);
  }
`;
const blurFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D tSrc;
  uniform vec2 uStep;   // one texel along the blur, times its spread
  in vec2 vUv;
  out highp vec4 fragColor;
  void main() {
    // a 13-texel gaussian in 7 bilinear taps
    vec3 c = texture(tSrc, vUv).rgb * 0.19648;
    c += (texture(tSrc, vUv + uStep * 1.41176).rgb + texture(tSrc, vUv - uStep * 1.41176).rgb) * 0.29691;
    c += (texture(tSrc, vUv + uStep * 3.29412).rgb + texture(tSrc, vUv - uStep * 3.29412).rgb) * 0.09447;
    c += (texture(tSrc, vUv + uStep * 5.17647).rgb + texture(tSrc, vUv - uStep * 5.17647).rgb) * 0.01038;
    fragColor = vec4(c, 1.0);
  }
`;

/**
 * The glow buffer: render(renderer) after the G-buffer; post reads `texture` (a quarter of the
 * resolution: the tight glow) as tBloom and `wide` (an eighth, blurred again) as tBloom2.
 */
export function createBloom(gbuffer, { spread = 1.3, wideSpread = 3.0 } = {}) {
  const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const a = new THREE.WebGLRenderTarget(1, 1, opts), b = new THREE.WebGLRenderTarget(1, 1, opts);
  const c = new THREE.WebGLRenderTarget(1, 1, opts), d = new THREE.WebGLRenderTarget(1, 1, opts);
  const quad = (fragmentShader, uniforms) => {
    const m = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: bloomVert, fragmentShader, uniforms, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);
    return { scene, m };
  };
  const extract = quad(extractFrag, { tAlbedo: { value: gbuffer.textures[0] }, tHatch: { value: gbuffer.textures[2] } });
  const blur = quad(blurFrag, { tSrc: { value: null }, uStep: { value: new THREE.Vector2() } });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pass = (src, dst, sx, sy) => {
    blur.m.uniforms.tSrc.value = src.texture;
    blur.m.uniforms.uStep.value.set(sx, sy);
    renderer_.setRenderTarget(dst);
    renderer_.render(blur.scene, cam);
  };
  let renderer_ = null;
  return {
    texture: a.texture,
    wide: c.texture,
    setSize(w, h) {
      a.setSize(Math.max(1, Math.ceil(w / 4)), Math.max(1, Math.ceil(h / 4))); b.setSize(a.width, a.height);
      c.setSize(Math.max(1, Math.ceil(w / 8)), Math.max(1, Math.ceil(h / 8))); d.setSize(c.width, c.height);
    },
    render(renderer) {
      renderer_ = renderer;
      renderer.setRenderTarget(a);
      renderer.render(extract.scene, cam);
      pass(a, b, spread / a.width, 0);
      pass(b, a, 0, spread / a.height);
      pass(a, d, wideSpread / c.width, 0);   // (down to an eighth on the way)
      pass(d, c, 0, wideSpread / c.height);
    },
  };
}

// Style presets: the same pipeline can lean towards Sable (flat, clean,
// two-tone) or towards a Moebius page (inked, hatched, wobbly).
export const PRESETS = {
  Moebius: {
    uLineWidth: 1.5, uLineVary: 1, uDepthThresh: 0.07, uNormalThresh: 0.22, uAlbedoEdges: 1, uShadowEdges: 1,
    uWobble: 1.0, uBoil: 0, uHatch: 1, uShadeStyle: 0, uHatchSpacing: 5.5, uHighlight: 0, uGrain: 0.1, uClouds: 0.6,
    uFogDensity: 0.0011, uSkyFlat: 0, uSkyDots: 0, uCumulus: 0, uDots: 0,
    uHalftone: 0, uBounce: 0, uShadeKeep: 0, uCrevice: 0, uPaper: 0, uShadowFlat: 0, uHaze: [1, 1, 1, 0], uSpot: [0, 2.5, 0.5, 0], uSpotTone: [0.17, 0.15, 0.19, 0.4],
  },
  // Sable: a fine, almost uniform pen line, flat colour, sparse dotting
  Sable: {
    uLineWidth: 1.25, uLineVary: 0.25, uDepthThresh: 0.07, uNormalThresh: 0.3, uAlbedoEdges: 0, uShadowEdges: 0,
    uWobble: 0.0, uBoil: 0, uHatch: 0.6, uShadeStyle: 1, uHatchSpacing: 8, uHighlight: 0.05, uGrain: 0.04, uClouds: 0.5,
    uFogDensity: 0.0009, uSkyFlat: 0, uSkyDots: 0, uCumulus: 0, uDots: 0,
    uHalftone: 0, uBounce: 0, uShadeKeep: 0, uCrevice: 0, uPaper: 0, uShadowFlat: 0, uHaze: [1, 1, 1, 0], uSpot: [0, 2.5, 0.5, 0], uSpotTone: [0.17, 0.15, 0.19, 0.4],
  },
  // a Moebius print: flat stippled sky, cumulus on the horizon, dotted ground,
  // fine even ink, dense fine hatching in blue shadow
  'Moebius print': {
    uLineWidth: 1.0, uLineVary: 0.55, uDepthThresh: 0.07, uNormalThresh: 0.3, uAlbedoEdges: 1, uShadowEdges: 0.8,
    uWobble: 0.35, uBoil: 0, uHatch: 1, uShadeStyle: 0, uHatchSpacing: 3.6, uHighlight: 0, uGrain: 0.05, uClouds: 0.45,
    uFogDensity: 0.0009, uSkyFlat: 1, uSkyDots: 1, uCumulus: 1, uSkyBands: 0, uHazeBands: 0.5, uRays: 0, uDots: 1,
    // the shade in three tones: a form turned from the sun a half-tone, faces turned down lifted by
    // the ground's light, cast shadows the full tint; shades keep some of their own hue
    uHalftone: 0.35, uBounce: 0.4, uShadeKeep: 0.3, uCrevice: 0.85, uPaper: 0.7, uShadowFlat: 0, uHaze: [1, 1, 1, 0],
    // a third tier of value: spot blacks in the shaded pockets, cast shadows a little deeper
    uSpot: [1, 3, 0.3, 0.2], uSpotTone: [0.17, 0.15, 0.19, 0.4],
  },
  // high-key, bone-white, heavy cast shadows, few lines
  Vael: {
    uLineWidth: 1.35, uLineVary: 0.9, uDepthThresh: 0.08, uNormalThresh: 0.35, uAlbedoEdges: 0.4, uShadowEdges: 1,
    uWobble: 1.2, uBoil: 0, uHatch: 1, uShadeStyle: 0, uHatchSpacing: 4.5, uHighlight: 0, uGrain: 0.12, uClouds: 0.25,
    uFogDensity: 0.0008, uSkyFlat: 0, uSkyDots: 0, uCumulus: 0, uDots: 0,
    uHalftone: 0, uBounce: 0, uShadeKeep: 0, uCrevice: 0, uPaper: 0, uShadowFlat: 0, uHaze: [1, 1, 1, 0], uSpot: [0, 2.5, 0.5, 0], uSpotTone: [0.17, 0.15, 0.19, 0.4],
  },
  // Moebius at his cleanest: flat colour, thin lines, light dotting only
  Viridel: {
    uLineWidth: 1.05, uLineVary: 0.6, uDepthThresh: 0.07, uNormalThresh: 0.28, uAlbedoEdges: 1, uShadowEdges: 0.4,
    uWobble: 0.4, uBoil: 0, uHatch: 0.5, uShadeStyle: 1, uHatchSpacing: 8, uHighlight: 0.06, uGrain: 0.05, uClouds: 0.7,
    uFogDensity: 0.0008, uSkyFlat: 0, uSkyDots: 0, uCumulus: 0, uDots: 0,
    uHalftone: 0, uBounce: 0, uShadeKeep: 0, uCrevice: 0, uPaper: 0, uShadowFlat: 0, uHaze: [1, 1, 1, 0], uSpot: [0, 2.5, 0.5, 0], uSpotTone: [0.17, 0.15, 0.19, 0.4],
  },
  // twilight swamp: dense hatching, glowing crystals carry the light
  Lorn: {
    uLineWidth: 1.45, uLineVary: 1, uDepthThresh: 0.07, uNormalThresh: 0.24, uAlbedoEdges: 1, uShadowEdges: 1,
    uWobble: 1.0, uBoil: 0, uHatch: 1, uShadeStyle: 0, uHatchSpacing: 5, uHighlight: 0, uGrain: 0.1, uClouds: 0.5,
    uFogDensity: 0.0012, uSkyFlat: 0, uSkyDots: 0, uCumulus: 0, uDots: 0,
    uHalftone: 0, uBounce: 0, uShadeKeep: 0, uCrevice: 0, uPaper: 0, uShadowFlat: 0, uHaze: [1, 1, 1, 0], uSpot: [0, 2.5, 0.5, 0], uSpotTone: [0.17, 0.15, 0.19, 0.4],
  },
  'Animated ink': {
    uLineWidth: 1.7, uLineVary: 1, uDepthThresh: 0.07, uNormalThresh: 0.2, uAlbedoEdges: 1, uShadowEdges: 1,
    uWobble: 1.6, uBoil: 1, uHatch: 1, uShadeStyle: 0, uHatchSpacing: 5, uHighlight: 0, uGrain: 0.14, uClouds: 0.7,
    uFogDensity: 0.0011, uSkyFlat: 0, uSkyDots: 0, uCumulus: 0, uDots: 0,
    uHalftone: 0, uBounce: 0, uShadeKeep: 0, uCrevice: 0, uPaper: 0, uShadowFlat: 0, uHaze: [1, 1, 1, 0], uSpot: [0, 2.5, 0.5, 0], uSpotTone: [0.17, 0.15, 0.19, 0.4],
  },
};
