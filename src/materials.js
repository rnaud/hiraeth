import * as THREE from 'three';
import { BIOME_GLSL } from './biome.js';

// ---------------------------------------------------------------------------
// G-buffer surface material.
//
// Every object in the world uses this material. It does NOT produce the final
// image: it writes the raw ingredients the Moebius post-process needs into two
// render targets (MRT):
//
//   location 0 : rgb = flat albedo (with procedural strata / sand patches)
//                a   = light term (half-lambert * cast shadow), 0..1
//   location 1 : rgb = world normal, a = linear view depth (0 = sky)
//   location 2 : r = single hatch / stipple, g = cross hatch,
//                b = drawn detail lines: grids, glyphs, sand ripples, cracks,
//                    fissures (all anchored to surfaces)
//
// All the stylisation (toon bands, hatching, ink lines, fog, sky, paper)
// happens in post.js, which keeps the look consistent across all objects.
// ---------------------------------------------------------------------------

export const MODE_PLAIN = 0;
export const MODE_TERRAIN = 1;
export const MODE_STRATA = 2;

export const sharedUniforms = {
  uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.3).normalize() },
  uShadowMap: { value: null },
  uShadowMatrix: { value: new THREE.Matrix4() },
  uShadowBias: { value: 0.0002 },
  uShadowNormalOffset: { value: 0.35 },
  // second, wider shadow range (cascade) for distant terrain and mesas
  uShadowMap2: { value: null },
  uShadowMatrix2: { value: new THREE.Matrix4() },
  uShadowBias2: { value: 0.0005 },
  uShadowNormalOffset2: { value: 2.0 },
  uTime: { value: 0 },
  // Shared with the post pass (same uniform objects).
  uToon: { value: 0.5 },
  uHatch: { value: 1 },
  uHatchSpacing: { value: 5.5 },
  uPixelRatio: { value: 1 },
  uShadeStyle: { value: 0 }, // 0 = hatching, 1 = stipple (Sable-style dotting)
  uClouds: { value: 0.6 },       // cloud cover, shared with the sky in post.js
  uCloudShadows: { value: 1 },
};

const vertexShader = /* glsl */ `
  out vec3 vWorldPos;
  out vec3 vNormal;
  out vec3 vInstColor;
  out float vViewDepth;
  out vec3 vObjPos;
  out vec3 vObjNormal;

  void main() {
    vec4 pos = vec4(position, 1.0);
    vec3 nrm = normal;
    #ifdef USE_INSTANCING
      pos = instanceMatrix * pos;
      nrm = mat3(instanceMatrix) * nrm;
    #endif
    vInstColor = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vInstColor = instanceColor;
    #endif
    // Object-space position with the object's scale baked in: hatch strokes
    // are anchored to the object (they move/rotate with it) but keep a
    // metric size, so a 6x boulder gets the same stroke spacing as a pebble.
    mat4 M = modelMatrix;
    #ifdef USE_INSTANCING
      M = modelMatrix * instanceMatrix;
    #endif
    vec3 scl = vec3(length(M[0].xyz), length(M[1].xyz), length(M[2].xyz));
    vObjPos = position * scl;
    vObjNormal = normal / scl;

    vec4 world = modelMatrix * pos;
    vWorldPos = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * nrm);
    vec4 mv = viewMatrix * world;
    vViewDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform int uMode;
  uniform float uFlat;
  uniform float uStrataSize;

  uniform vec3 uSunDir;
  uniform sampler2D uShadowMap;
  uniform mat4 uShadowMatrix;
  uniform float uShadowBias;
  uniform float uShadowNormalOffset;
  uniform sampler2D uShadowMap2;
  uniform mat4 uShadowMatrix2;
  uniform float uShadowBias2;
  uniform float uShadowNormalOffset2;
  uniform float uGlyphs;
  uniform float uClouds;
  uniform float uCloudShadows;
  uniform float uTime;
  uniform float uToon;
  uniform float uHatch;
  uniform float uHatchSpacing;
  uniform float uPixelRatio;
  uniform int uShadeStyle;
  uniform float uGrid;

  in vec3 vWorldPos;
  in vec3 vNormal;
  in vec3 vInstColor;
  in float vViewDepth;
  in vec3 vObjPos;
  in vec3 vObjNormal;

  layout(location = 0) out highp vec4 gAlbedoLight;
  layout(location = 1) out highp vec4 gNormalDepth;
  layout(location = 2) out highp vec4 gHatch;

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

  ${BIOME_GLSL}

  // Hand-rolled shadow map lookup with two cascades: a sharp one around the
  // player and a wide one so mesas shadow the far dunes. "inside" fades out at
  // the frustum border so the hand-over between cascades is invisible.
  float sampleShadow(sampler2D map, mat4 m, vec3 wp, vec3 n, float off, float bias, out float inside) {
    vec4 sc = m * vec4(wp + n * off, 1.0);
    vec3 p = sc.xyz / sc.w * 0.5 + 0.5;
    vec2 e = smoothstep(0.0, 0.06, p.xy) * (1.0 - smoothstep(0.94, 1.0, p.xy));
    inside = p.z > 1.0 ? 0.0 : e.x * e.y;
    if (inside <= 0.0) return 1.0;
    vec2 texel = 1.0 / vec2(textureSize(map, 0));
    float s = 0.0;
    for (int x = -1; x <= 1; x++)
      for (int y = -1; y <= 1; y++)
        s += step(p.z - bias, textureLod(map, p.xy + vec2(x, y) * texel, 0.0).r);
    return s / 9.0;
  }

  float getShadow(vec3 wp, vec3 n) {
    float i0, i1;
    float s0 = sampleShadow(uShadowMap, uShadowMatrix, wp, n, uShadowNormalOffset, uShadowBias, i0);
    if (i0 >= 1.0) return s0;
    float s1 = sampleShadow(uShadowMap2, uShadowMatrix2, wp, n, uShadowNormalOffset2, uShadowBias2, i1);
    s1 = mix(1.0, s1, i1);
    return mix(s1, s0, i0);
  }

  // Cloud shadows: the ground point is projected along the light onto a cloud
  // layer ~300 m up, where a drifting fbm field (same threshold as the sky's
  // cloud cover) decides whether it is shaded.
  float cloudShadow(vec3 wp) {
    if (uCloudShadows <= 0.0 || uClouds <= 0.0) return 1.0;
    vec2 onLayer = wp.xz + uSunDir.xz / max(uSunDir.y, 0.15) * (300.0 - wp.y);
    vec2 q = onLayer / 260.0 + vec2(uTime * 0.012, uTime * 0.003);
    float f = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { f += a * vnoise(q); q = q * 2.03 + 17.1; a *= 0.5; }
    float th = mix(0.75, 0.52, uClouds);
    return 1.0 - smoothstep(th - 0.015, th + 0.015, f) * uCloudShadows;
  }

  vec3 strata(vec3 wp) {
    // Horizontal bands of colour, slightly wavy — the classic Moebius mesa.
    float y = wp.y + (vnoise(wp.xz * 0.04) - 0.5) * uStrataSize * 0.9;
    float band = floor(y / uStrataSize);
    float t = fract(sin(band * 12.9898) * 43758.5453);
    return t < 0.4 ? uColor : (t < 0.75 ? uColor2 : uColor3);
  }

  // ---------------------------------------------------------------- hatching
  // Pen strokes drawn on the surface itself. A stroke is an isoline of one
  // scalar "stroke coordinate" c(p), so strokes are continuous wherever c is.
  //  - Smooth objects: the three triplanar projections are blended at the
  //    *coordinate* level (not the stroke level), giving a single smooth field
  //    whose stroke angle turns gradually with the surface instead of two
  //    patterns ghosting over each other.
  //  - Terrain: one top-down projection, continuous across every dune crest.
  //  - Faceted objects: one projection per facet, as an inker would do.
  //  - LOD: the world spacing that gives the target on-screen spacing is
  //    measured from fwidth(c) (so foreshortening is accounted for) and
  //    quantised to powers of two. Lines at spacing 2s are a subset of lines
  //    at spacing s, so as you walk away every other line fades out instead
  //    of sliding.
  //  - Width is expressed in pixels (via derivatives), so strokes stay crisp.
  // Derivatives are taken in uniform control flow, so the darkness branch
  // below is safe.

  // Stroke coordinate for direction dir: x = across strokes, y = along strokes.
  vec2 strokeCoord(vec3 w, vec2 dir) {
    vec2 perp = vec2(-dir.y, dir.x);
    vec2 a = vObjPos.zy, b = vObjPos.xz, c = vObjPos.xy;
    return w.x * vec2(dot(a, dir), dot(a, perp))
         + w.y * vec2(dot(b, dir), dot(b, perp))
         + w.z * vec2(dot(c, dir), dot(c, perp));
  }

  float strokesLevel(float c, float fw, float s, float wob, float widthPx) {
    float v = c / s + wob;
    float f = fw / s;                          // periods per pixel
    float d = abs(fract(v + 0.5) - 0.5);       // distance to line (line at fract = 0)
    float hw = 0.5 * widthPx * f;
    return 1.0 - smoothstep(hw - 0.6 * f, hw + 0.6 * f, d);
  }

  // fw = fwidth(ce.x) in world units per device px; spacing / width in CSS px.
  float strokes(vec2 ce, float fw, float spacingPx, float widthPx) {
    float lvl = log2(max(fw * spacingPx * uPixelRatio, 1e-5));
    float s0 = exp2(floor(lvl));
    float t = fract(lvl);
    float s1 = s0 * 2.0;
    widthPx *= uPixelRatio;
    vec2 q = ce / s1;
    float wob = (vnoise(q * vec2(0.3, 0.12)) - 0.5) * 0.3;               // in s1 periods
    float press = 0.75 + 0.5 * vnoise(q * vec2(0.5, 0.6) + 31.0);
    float a = strokesLevel(ce.x, fw, s0, wob * 2.0, widthPx * press);
    float b = strokesLevel(ce.x, fw, s1, wob, widthPx * press);
    return mix(a, b, t);   // t -> 1 : odd lines fade out
  }

  vec2 hash2(vec2 p) {
    return vec2(hash(p), hash(p + 17.31));
  }

  // Sable-style sand blobs: small irregular darker spots scattered on the
  // ground. They give the eye a sense of scale and keep the flat colour from
  // feeling empty. Kept below the colour-boundary threshold so they don't get
  // inked outlines; they fade out once smaller than ~1.5 px to avoid shimmer.
  float blobs(vec2 p, vec2 fwp, float cell, float radius, float density, float seed) {
    vec2 g = p / cell;
    vec2 id = floor(g);
    vec2 h = hash2(id + seed);
    float r = radius / cell * (0.55 + 0.9 * h.y);                       // cell units
    vec2 c = 0.5 + (h - 0.5) * (0.9 - 2.0 * r);                         // stays inside the cell
    vec2 d2 = (fract(g) - c) * vec2(1.0, 1.0 + 0.8 * h.x);              // squashed
    float d = length(d2) + (vnoise(p / radius * 1.4 + seed) - 0.5) * r * 0.9;
    float aa = max(fwp.x, fwp.y) / cell;
    float m = 1.0 - smoothstep(r - aa, r + aa, d);
    float present = step(hash(id + seed + 3.1), density);
    float vis = smoothstep(1.2, 2.5, radius / max(max(fwp.x, fwp.y), 1e-6) / uPixelRatio);
    return m * present * vis;
  }

  // Stippling: jittered dots on a grid in the same surface frame as the
  // strokes. Dot radius and the fraction of cells that get a dot both grow
  // with darkness, like a hand-dotted shadow.
  float stippleLevel(vec2 ce, vec2 fw, float s, float dark) {
    vec2 g = ce / s;
    vec2 cell = floor(g);
    vec2 h = hash2(cell);
    vec2 centre = 0.5 + (h - 0.5) * 0.55;
    vec2 dpx = (fract(g) - centre) * s / max(fw, vec2(1e-6));   // device px
    float r = mix(0.7, 1.5, dark) * uPixelRatio * (0.7 + 0.6 * h.y);
    float present = step(hash(cell + 5.7), mix(0.35, 1.0, dark));
    return (1.0 - smoothstep(r - 0.7, r + 0.7, length(dpx))) * present;
  }

  float stipple(vec2 ce, vec2 fw, float spacingPx, float dark) {
    float lvl = log2(max(max(fw.x, fw.y) * spacingPx * uPixelRatio, 1e-5));
    float s0 = exp2(floor(lvl));
    return mix(stippleLevel(ce, fw, s0, dark), stippleLevel(ce, fw, s0 * 2.0, dark), fract(lvl));
  }

  // Drawn grid lines on architecture (Sable's "gridded lines"), ~1px pen,
  // fading out once the grid gets denser than a few pixels.
  float gridLines(vec3 q, vec3 fq, vec3 w) {
    vec3 d = abs(fract(q + 0.5) - 0.5) / max(fq, vec3(1e-6));      // px to nearest line
    vec3 l = (1.0 - smoothstep(0.4 * uPixelRatio, 0.4 * uPixelRatio + 1.0, d))
           * (1.0 - smoothstep(0.08, 0.25, fq));
    return max(w.x * max(l.y, l.z), max(w.y * max(l.x, l.z), w.z * max(l.x, l.y)));
  }

  // ---------------------------------------------------------------- drawn details
  // Procedural "hand-drawn" marks, written as ~1px ink lines into gHatch.b.
  // Each fades out once its pattern gets denser than a few pixels.

  float inkLine(float distPx, float widthPx) {
    float w = widthPx * uPixelRatio * 0.5;
    return 1.0 - smoothstep(w - 0.6, w + 0.6, distPx);
  }

  // Exact distance to Voronoi cell borders (Inigo Quilez), in cell units.
  float voronoiBorder(vec2 x) {
    vec2 n = floor(x), f = fract(x), mg = vec2(0.0), mr = vec2(0.0);
    float md = 8.0;
    for (int j = -1; j <= 1; j++)
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 r = g + hash2(n + g) - f;
        float d = dot(r, r);
        if (d < md) { md = d; mr = r; mg = g; }
      }
    md = 8.0;
    for (int j = -2; j <= 2; j++)
      for (int i = -2; i <= 2; i++) {
        vec2 g = mg + vec2(float(i), float(j));
        vec2 r = g + hash2(n + g) - f;
        if (dot(mr - r, mr - r) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
      }
    return md;
  }

  // Wind ripples on sand: broken wavy lines across the prevailing wind, in patches.
  float sandRipples(vec2 p, float fwu, float slope) {
    const vec2 across = vec2(0.82, 0.57);
    float sp = 1.6;
    float u = dot(p, across) / sp + (vnoise(p * 0.11) - 0.5) * 2.4 + (vnoise(p * 0.5) - 0.5) * 0.25;
    float along = dot(p, vec2(-across.y, across.x));
    float d = abs(fract(u + 0.5) - 0.5) / max(fwu, 1e-6);          // device px
    float patchMask = smoothstep(0.55, 0.7, vnoise(p * 0.025 + 3.0));
    float broken = smoothstep(0.35, 0.55, vnoise(vec2(along * 0.35, floor(u) * 7.1)));
    float vis = 1.0 - smoothstep(0.12, 0.3, fwu);
    return inkLine(d, 0.9) * patchMask * broken * vis * (1.0 - smoothstep(0.15, 0.3, slope));
  }

  // Dried-mud cracks: Voronoi borders, jittered, with some segments missing.
  float mudCracks(vec2 p, float fwc) {
    vec2 q = p / 5.5;
    q += (vec2(vnoise(p * 0.7), vnoise(p * 0.7 + 9.0)) - 0.5) * 0.12;
    float d = voronoiBorder(q) / max(fwc, 1e-6);
    float gaps = smoothstep(0.25, 0.45, vnoise(p * 0.35 + 20.0));
    return inkLine(d, 1.0) * gaps * (1.0 - smoothstep(0.08, 0.2, fwc));
  }

  // Vertical fissures on rock: wavy lines down the faces, in short runs.
  float fissures(vec2 q, float fwq) {
    // q = (horizontal coordinate on the face, height), in metres
    float u = q.x / 9.0 + (vnoise(vec2(q.y * 0.06, q.x * 0.05)) - 0.5) * 0.5;
    float d = abs(fract(u + 0.5) - 0.5) / max(fwq, 1e-6);
    float runs = smoothstep(0.5, 0.65, vnoise(vec2(floor(u) * 3.7, q.y * 0.035)));
    return inkLine(d, 1.0) * runs * (1.0 - smoothstep(0.08, 0.2, fwq));
  }

  // Alien script on standing stones: one glyph per grid cell, built from a
  // few pen primitives chosen by hash bits.
  float glyphs(vec2 g, vec2 fw) {
    vec2 cell = floor(g), f = fract(g) - 0.5;
    float h = hash(cell * 1.37 + 4.1);
    if (h > 0.45) return 0.0;
    float px = 1.0 / max(max(fw.x, fw.y), 1e-6);                 // device px per cell unit
    if (px < 14.0 * uPixelRatio) return 0.0;
    float bits = floor(hash(cell + 9.3) * 16.0);
    float m = 0.0;
    if (mod(bits, 2.0) >= 1.0) m = max(m, inkLine(abs(length(f) - 0.26) * px, 1.2));           // ring
    if (mod(floor(bits / 2.0), 2.0) >= 1.0)                                                     // vertical bar
      m = max(m, inkLine(max(abs(f.x), abs(f.y) - 0.34) * px, 1.2));
    if (mod(floor(bits / 4.0), 2.0) >= 1.0)                                                     // bar across
      m = max(m, inkLine(max(abs(f.y - 0.12), abs(f.x) - 0.3) * px, 1.2));
    if (mod(floor(bits / 8.0), 2.0) >= 1.0 || bits < 1.0)                                       // dot
      m = max(m, 1.0 - smoothstep(0.05 * px, 0.05 * px + 1.0, length(f - vec2(0.0, -0.22)) * px));
    return m;
  }

  void main() {
    // stroke coordinates + derivatives first, in uniform control flow
    vec3 on = uFlat > 0.5 ? cross(dFdx(vObjPos), dFdy(vObjPos)) : vObjNormal;
    vec3 tw = pow(abs(normalize(on)), vec3(3.0));
    tw /= (tw.x + tw.y + tw.z);
    if (uMode == ${MODE_TERRAIN}) tw = vec3(0.0, 1.0, 0.0);
    vec2 ce1 = strokeCoord(tw, vec2(0.766, 0.643));
    vec2 ce2 = strokeCoord(tw, vec2(0.83, -0.56));
    float fw1 = fwidth(ce1.x), fw2 = fwidth(ce2.x);
    vec2 fwd = vec2(fw1, fwidth(ce1.y));
    vec3 gq = vObjPos / max(uGrid, 1e-3);
    vec3 gfw = fwidth(gq);
    vec3 gw = vec3(0.0);
    if (uGrid > 0.0 || uGlyphs > 0.0) { gw = pow(abs(normalize(on)), vec3(6.0)); gw /= (gw.x + gw.y + gw.z); }
    vec2 fwp = fwidth(vWorldPos.xz);
    // drawn-detail coordinates + derivatives (uniform control flow)
    float rippleFw = fwidth(dot(vWorldPos.xz, vec2(0.82, 0.57)) / 1.6);
    float crackFw = max(fwp.x, fwp.y) / 5.5;
    float faceX = abs(on.x) > abs(on.z) ? vObjPos.z : vObjPos.x;     // horizontal coord on a side face
    float fissFw = fwidth(faceX) / 9.0;
    vec2 glyphUV = gw.x > max(gw.y, gw.z) ? gq.zy : (gw.y > gw.z ? gq.xz : gq.xy);
    vec2 glyphFw = gw.x > max(gw.y, gw.z) ? gfw.zy : (gw.y > gw.z ? gfw.xz : gfw.xy);

    vec3 n = normalize(vNormal);
    if (uFlat > 0.5) {
      // Faceted look: derive the normal from screen-space derivatives.
      n = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
    } else if (!gl_FrontFacing) {
      n = -n;
    }

    vec3 albedo = uColor;
    vec2 bw = vec2(0.0);
    float slope = 1.0 - n.y;
    if (uMode == ${MODE_TERRAIN}) {
      // Sand with flat patches of a second tone, rock on steep slopes; the
      // three tones come from the region (golden dunes / rose canyons / salt flats).
      bw = biomeWeights(vWorldPos.xz);
      vec3 c1, c2, c3;
      biomeGround(bw, c1, c2, c3);
      float patches = vnoise(vWorldPos.xz * 0.011) * 0.65 + vnoise(vWorldPos.xz * 0.045) * 0.35;
      albedo = patches > 0.6 ? c2 : c1;
      if (slope > 0.42) albedo = c3;
      else if (slope > 0.30 && patches < 0.45) albedo = mix(c1, c3, 0.5);
      float b = max(blobs(vWorldPos.xz, fwp, 2.2, 0.28, 0.45, 0.0),
                max(blobs(vWorldPos.xz, fwp, 11.0, 1.3, 0.35, 41.0),
                    blobs(vWorldPos.xz, fwp, 34.0, 3.2, 0.22, 97.0)));
      albedo *= mix(vec3(1.0), vec3(0.945, 0.935, 0.965), b);
    } else if (uMode == ${MODE_STRATA}) {
      albedo = strata(vWorldPos);
    }
    albedo *= vInstColor;

    float ndl = dot(n, uSunDir);
    float lambert = ndl * 0.5 + 0.5;
    float sh = ndl > 0.0 ? getShadow(vWorldPos, n) * cloudShadow(vWorldPos) : 1.0;
    // Cast shadows clamp the light term below the toon threshold (0.5) but keep
    // some gradation so the post-process can choose single vs cross hatching.
    float L = mix(min(lambert, 0.38), lambert, sh);

    gAlbedoLight = vec4(albedo, L);
    gNormalDepth = vec4(n, vViewDepth);

    gHatch = vec4(0.0);
    float detail = 0.0;
    if (uGrid > 0.0) detail = gridLines(gq, gfw, gw);
    if (uGlyphs > 0.0) detail = max(detail, glyphs(glyphUV, glyphFw));
    if (uMode == ${MODE_TERRAIN}) {
      detail = max(detail, sandRipples(vWorldPos.xz, rippleFw, slope) * (1.0 - bw.y));
      if (bw.y > 0.0 && slope < 0.2) detail = max(detail, mudCracks(vWorldPos.xz, crackFw) * smoothstep(0.3, 0.8, bw.y));
    } else if (uMode == ${MODE_STRATA} && abs(normalize(on).y) < 0.6) {
      detail = max(detail, fissures(vec2(faceX, vObjPos.y), fissFw) * 0.85);
    }
    gHatch.b = detail;
    float dark = clamp((uToon - L) / uToon, 0.0, 1.0);
    if (dark > 0.0 && uHatch > 0.0 && uShadeStyle == 1) {
      gHatch.r = stipple(ce1, fwd, uHatchSpacing * 1.15, dark) * smoothstep(0.02, 0.15, dark);
    } else if (dark > 0.0 && uHatch > 0.0) {
      float h1 = strokes(ce1, fw1, uHatchSpacing, mix(0.9, 2.2, dark)) * smoothstep(0.02, 0.12, dark);
      float h2 = 0.0;
      if (dark > 0.5)
        h2 = strokes(ce2, fw2, uHatchSpacing * 1.2, mix(0.6, 1.7, dark)) * smoothstep(0.5, 0.65, dark);
      gHatch.rg = vec2(h1, h2);
    }
  }
`;

const cache = new Map();

/**
 * @param {object} o
 * @param {number|string} o.color
 * @param {number|string} [o.color2]
 * @param {number|string} [o.color3]
 * @param {number} [o.mode]
 * @param {boolean} [o.flat]
 * @param {number} [o.strataSize]
 * @param {number} [o.grid] spacing of drawn grid lines (0 = none)
 * @param {boolean} [o.glyphs] draw alien glyphs in the grid cells
 * @param {THREE.Side} [o.side]
 */
export function makeMaterial(o) {
  const key = JSON.stringify(o);
  if (cache.has(key)) return cache.get(key);
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    side: o.side ?? THREE.FrontSide,
    uniforms: {
      ...sharedUniforms,
      uColor: { value: new THREE.Color(o.color) },
      uColor2: { value: new THREE.Color(o.color2 ?? o.color) },
      uColor3: { value: new THREE.Color(o.color3 ?? o.color) },
      uMode: { value: o.mode ?? MODE_PLAIN },
      uFlat: { value: o.flat ? 1 : 0 },
      uStrataSize: { value: o.strataSize ?? 4.0 },
      uGrid: { value: o.grid ?? 0 },
      uGlyphs: { value: o.glyphs ? 1 : 0 },
    },
  });
  cache.set(key, mat);
  return mat;
}
