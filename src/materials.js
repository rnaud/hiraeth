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
export const MODE_WATER = 3;
export const MODE_OUTFIT = 4;
export const MODE_RIBBON = 5;   // hover trail: flat colour bands along aFold.x   // skinned people: clothes by body region (rest pose)

export const sharedUniforms = {
  uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.3).normalize() },
  uShadowMap: { value: null },
  uShadowMatrix: { value: new THREE.Matrix4() },
  uShadowBias: { value: 0.0002 },
  uShadowNormalOffset: { value: 0.35 },
  // finest cascade, a few metres around the player: crisp character shadows
  // that don't crawl across a coarse texel grid while you move
  uShadowMap0: { value: null },
  uShadowMatrix0: { value: new THREE.Matrix4() },
  uShadowBias0: { value: 0.00005 },
  uShadowNormalOffset0: { value: 0.03 },
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
  // local lights (glowing crystals, eggs, portals, the jetpack flame): xyz + radius
  uLights: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, -1e5, 0, 0)) },
  uFormHatch: { value: 1 },      // strokes follow slopes / wrap round objects
  uDots: { value: 0 },           // pen dotting on the ground (print style)
  uCloudShadows: { value: 1 },
};

const vertexShader = /* glsl */ `
  out vec3 vWorldPos;
  out vec3 vNormal;
  out vec3 vInstColor;
  out float vViewDepth;
  out vec3 vObjPos;
  out vec3 vObjNormal;
  out vec3 vBind;
  in vec2 aFold;          // cloth: (across, down) 0..1; (0,0) on everything else
  out vec2 vFold;
  out vec2 vTextureUV;
  #include <skinning_pars_vertex>
  uniform vec4 uOutfit;
  uniform float uSuit;

  void main() {
    vec3 transformed = position;
    // a padded suit: the body swells along its normals (baggier on the legs), not the head or hands
    if (uSuit > 0.0 && position.y < uOutfit.z - 0.02 && abs(position.x) < uOutfit.w - 0.03)
      transformed += normal * (position.y < uOutfit.y ? 0.03 : 0.022) * smoothstep(uOutfit.x - 0.04, uOutfit.x + 0.04, position.y);
    vec3 objectNormal = normal;
    #ifdef USE_SKINNING
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <skinning_vertex>
    #endif
    vTextureUV = uv;
    vBind = position;
    vFold = aFold;
    vec4 pos = vec4(transformed, 1.0);
    vec3 nrm = objectNormal;
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
  uniform sampler2D uShadowMap0;
  uniform mat4 uShadowMatrix0;
  uniform float uShadowBias0;
  uniform float uShadowNormalOffset0;
  uniform sampler2D uShadowMap2;
  uniform mat4 uShadowMatrix2;
  uniform float uShadowBias2;
  uniform float uShadowNormalOffset2;
  uniform float uGlyphs;
  uniform float uBiomes;    // terrain: desert regions decide the ground palette
  uniform float uSandInk;  // sparse desert wind strokes, no pebble-dot field
  uniform float uRipples;   // terrain: wind ripple marks
  uniform float uTicks;     // terrain: inked grass ticks
  uniform float uGlow;      // self-lit (crystals, eggs): ignores shadow, glows at night
  uniform float uClouds;
  uniform float uCloudShadows;
  uniform vec4 uLights[8];
  uniform float uFormHatch;
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
  in vec3 vBind;
  in vec2 vFold;
  in vec2 vTextureUV;
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uFolds;
  uniform float uScrub;
  uniform int uPattern;    // 1 facade, 2 roof tiles, 3 leaves, 4 rock cracks
  uniform float uDots;
  uniform vec3 uSkin;
  uniform vec4 uGlove;    // rgb, a = 1: gloved hands
  uniform float uHero;    // player-only flag, packed above the glow range in gHatch.a
  uniform float uSuit;    // puffy-suit crease lines at the joints
  uniform vec3 uGlassCenter;
  uniform float uGlass;   // glass: only the rim and a highlight streak are drawn
  uniform vec4 uOutfit;   // bootTop, beltY, neckY, wristX (rest pose, metres)
  uniform vec4 uFace;     // eyeY, eyeX, noseY, chinY (rest pose)

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
    float iF, i0, i1;
    float sF = sampleShadow(uShadowMap0, uShadowMatrix0, wp, n, uShadowNormalOffset0, uShadowBias0, iF);
    if (iF >= 1.0) return sF;
    float s0 = sampleShadow(uShadowMap, uShadowMatrix, wp, n, uShadowNormalOffset, uShadowBias, i0);
    if (i0 < 1.0) {
      float s1 = sampleShadow(uShadowMap2, uShadowMatrix2, wp, n, uShadowNormalOffset2, uShadowBias2, i1);
      s0 = mix(mix(1.0, s1, i1), s0, i0);
    }
    return mix(s0, sF, iF);
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

  // ---------------------------------------------------------------- drawn patterns
  // Windows on a wall: frames (some arched), dark glass, sills, painted shutters,
  // a cornice line per storey. Coordinates run along the face, so they stick.
  float facade(vec3 wp, vec3 n, inout vec3 alb) {
    float vert = 1.0 - smoothstep(0.25, 0.4, abs(n.y));
    vec2 dirH = normalize(vec2(-n.z, n.x) + 1e-5);
    vec2 q = vec2(dot(wp.xz, dirH), wp.y) / vec2(3.0, 3.3);
    vec2 fq = max(fwidth(q), vec2(1e-5));
    vec2 id = floor(q), f = fract(q);
    float h = hash(id + 3.7), h2 = hash(id + 9.1);
    float ink = inkLine(abs(f.y - 0.03) / fq.y, 0.8) * 0.6;                    // cornice
    if (h > 0.22) {
      vec2 c = f - vec2(0.5, 0.48), hf = vec2(0.17, 0.22);
      vec2 d2 = abs(c) - hf;
      float box = max(d2.x, d2.y);
      if (h2 > 0.5 && c.y > hf.y - hf.x) box = length(vec2(c.x, c.y - (hf.y - hf.x))) - hf.x;   // arched top
      if (box < 0.0) alb = mix(alb, vec3(0.36, 0.43, 0.56), vert);
      ink = max(ink, inkLine(abs(box) / fq.x, 1.0));
      if (abs(c.x) < hf.x + 0.05) ink = max(ink, inkLine(abs(c.y + hf.y + 0.03) / fq.y, 1.3));  // sill
      if (h2 > 0.55 && h2 < 0.88 && abs(abs(c.x) - hf.x - 0.075) < 0.065 && abs(c.y) < hf.y)     // shutters
        alb = mix(alb, h > 0.6 ? vec3(0.37, 0.55, 0.5) : vec3(0.36, 0.47, 0.62), vert);
    }
    return ink * vert * (1.0 - smoothstep(0.06, 0.16, max(fq.x, fq.y)));
  }

  // Roof tiles: rows with staggered joints.
  float roofTiles(vec3 wp) {
    float v = wp.y * 4.5, u = dot(wp.xz, vec2(0.707)) * 3.5;
    float fv = max(fwidth(v), 1e-5), fu = max(fwidth(u), 1e-5);
    float row = abs(fract(v + 0.5) - 0.5) / fv;
    float joint = abs(fract(u + floor(v) * 0.5 + 0.5) - 0.5) / fu;
    return max(inkLine(row, 0.8), inkLine(joint, 0.7) * 0.7) * (1.0 - smoothstep(0.15, 0.4, max(fv, fu)));
  }

  // Leaves: little scalloped arcs on the foliage, more of them in shade.
  float leaves(vec3 op) {
    vec2 q = vec2(op.x + op.z * 0.6, op.y) * 2.6;
    vec2 fq = max(fwidth(q), vec2(1e-5));
    vec2 id = floor(q), f = fract(q);
    vec2 o = vec2(hash(id), hash(id + 2.3)) * 0.3 - 0.15;
    vec2 c = f - vec2(0.5, 0.3) - o;
    float d = abs(length(c) - 0.3);
    return inkLine(d / max(fq.x, fq.y), 0.9) * step(0.0, c.y) * step(0.35, hash(id + 5.0)) * (1.0 - smoothstep(0.12, 0.3, max(fq.x, fq.y)));
  }

  // Rock cracks: a broken Voronoi network across the stone.
  float rockCracks(vec3 op) {
    vec2 q = (op.xy + op.zx * 0.6) * 0.9;
    float fwq = max(max(fwidth(q.x), fwidth(q.y)), 1e-5);
    float d = voronoiBorder(q) / fwq;
    float gaps = smoothstep(0.35, 0.55, vnoise(q * 2.3 + 11.0));
    return inkLine(d, 0.9) * gaps * (1.0 - smoothstep(0.08, 0.2, fwq));
  }

  float segDist(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    return length(p - a - ab * t);
  }

  // Moebius face ink, in rest-pose face coordinates (q.x = |x|, q.y = y - eyeY):
  // heavy upper lids, bags under the eyes, a frown crease, the nose bridge,
  // nose-to-mouth folds, cheekbones and the mouth line. fwq = metres per pixel.
  float faceInk(vec2 q, float fwq, float frontal) {
    float e = uFace.y, ny = uFace.z - uFace.x, cy = uFace.w - uFace.x;
    vec2 lid = (q - vec2(e, 0.004)) / vec2(0.017, 0.008);
    float m = 0.0;
    float dLid = abs(length(lid) - 1.0) * 0.008;
    m = max(m, inkLine(dLid / fwq, 1.0) * step(0.0, lid.y + 0.25) * step(abs(lid.x), 1.1));
    vec2 bag = (q - vec2(e + 0.002, -0.006)) / vec2(0.014, 0.006);
    m = max(m, inkLine(abs(length(bag) - 1.0) * 0.006 / fwq, 0.7) * step(bag.y, -0.35) * 0.45);
    m = max(m, inkLine(segDist(q, vec2(0.02, ny - 0.002), vec2(0.034, ny - 0.04)) / fwq, 0.8) * 0.7); // fold
    m = max(m, inkLine(segDist(q, vec2(0.042, -0.018), vec2(0.064, -0.036)) / fwq, 1.0) * 0.8);    // cheekbone
    float my = ny + (cy - ny) * 0.42;
    m = max(m, inkLine(segDist(q, vec2(0.0, my), vec2(0.019, my + 0.002)) / fwq, 1.0));           // mouth
    m = max(m, inkLine(segDist(q, vec2(0.0, cy + 0.012), vec2(0.008, cy + 0.011)) / fwq, 1.0) * 0.6); // chin cleft
    return m * frontal;
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
    return inkLine(d, 0.9) * patchMask * broken * vis * (1.0 - smoothstep(0.06, 0.16, slope));
  }

  // Sparse, surface-anchored pen strokes. Their physical length stays fixed;
  // fade subpixel strokes away instead of enlarging them into screen-space dots.
  float sandScuffs(vec2 p) {
    vec2 q = mat2(0.82, -0.57, 0.57, 0.82) * p / 22.0;
    vec2 cell = floor(q), local = fract(q) - (0.25 + hash2(cell + 11.0) * 0.5);
    float seed = hash(cell + 37.0);
    float halfLength = mix(0.055, 0.18, hash(cell + 19.0));
    float bend = local.y - local.x * local.x * 0.5;
    float aa = max(fwidth(bend), 1e-5);
    float stroke = inkLine(abs(bend) / aa, 0.65);
    stroke *= 1.0 - smoothstep(halfLength * 0.6, halfLength, abs(local.x));
    float resolved = smoothstep(3.0, 7.0, halfLength * 2.0 / max(fwidth(q.x), 1e-5));
    float scuffPatch = smoothstep(0.40, 0.70, vnoise(p * 0.045 + 13.0));
    return stroke * step(0.65, seed) * scuffPatch * resolved * 0.55;
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

  // Grass: short inked ticks scattered on a jittered grid, leaning with the wind.
  float grassTicks(vec2 p, vec2 fwp) {
    float cell = 1.4;
    vec2 g = p / cell, id = floor(g);
    vec2 h = hash2(id + 7.7);
    if (h.x > 0.42) return 0.0;
    vec2 c = 0.25 + h * 0.5;
    vec2 dir = normalize(vec2(0.35 + 0.3 * h.y, 1.0));
    vec2 q = fract(g) - c;
    float along = clamp(dot(q, dir), -0.13, 0.13);
    float d = length(q - dir * along) * cell / max(max(fwp.x, fwp.y), 1e-6);   // device px
    float vis = 1.0 - smoothstep(0.03, 0.08, max(fwp.x, fwp.y) / cell);
    return inkLine(d, 1.0) * vis;
  }

  // Water: drifting contour lines of a slow noise field, like inked ripples.
  float waterLines(vec2 p, float t) {
    vec2 q = p * 0.045 + vec2(t * 0.03, t * 0.017);
    float f = vnoise(q) * 0.6 + vnoise(q * 2.3 - t * 0.04) * 0.4;
    float v = f * 9.0;
    float fw = fwidth(v);
    float d = abs(fract(v + 0.5) - 0.5) / max(fw, 1e-6);
    float broken = smoothstep(0.3, 0.55, vnoise(p * 0.08 + 31.0));
    return inkLine(d, 1.0) * broken * (1.0 - smoothstep(0.25, 0.5, fw));
  }

  // ordered 4x4 dither threshold, for print-like dissolves
  float bayer4(vec2 p) {
    vec2 q = mod(floor(p), 4.0);
    int i = int(q.x) + int(q.y) * 4;
    int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
    return (float(m[i]) + 0.5) / 16.0;
  }

  void main() {
    // the hover trail dissolves into dots over its last stretch
    // glass (the bubble helmet): see-through except at the grazing rim and a curved highlight
    if (uGlass > 0.0) {
      vec3 Vg = normalize(cameraPosition - vWorldPos);
      float fr = 1.0 - abs(dot(normalize(vNormal), Vg));
      vec3 od = normalize(vObjPos - uGlassCenter);
      float streak = step(abs(atan(od.y, od.x) - 2.2), 0.09) * step(0.25, od.z) * step(od.z, 0.75);
      if (fr < 0.72 && streak < 0.5) discard;
    }
    if (uMode == ${MODE_RIBBON} && bayer4(gl_FragCoord.xy / max(uPixelRatio, 1.0) * 0.5) < smoothstep(0.45, 0.95, vFold.y)) discard;
    // stroke coordinates + derivatives first, in uniform control flow
    vec3 on = uFlat > 0.5 ? cross(dFdx(vObjPos), dFdy(vObjPos)) : vObjNormal;
    vec3 tw = pow(abs(normalize(on)), vec3(3.0));
    tw /= (tw.x + tw.y + tw.z);
    if (uMode == ${MODE_TERRAIN}) tw = vec3(0.0, 1.0, 0.0);
    vec2 ce1 = strokeCoord(tw, vec2(0.766, 0.643));
    vec2 ce2 = strokeCoord(tw, vec2(0.83, -0.56));
    float fw1 = fwidth(ce1.x), fw2 = fwidth(ce2.x);
    // form-following strokes: height contours (terrain slopes) / rings round objects
    vec2 ceY = vec2(vObjPos.y, dot(vObjPos.xz, vec2(0.7071)));
    float fwY = fwidth(vObjPos.y);
    vec2 fwd = vec2(fw1, fwidth(ce1.y));
    vec3 gq = vObjPos / max(uGrid, 1e-3);
    vec3 gfw = fwidth(gq);
    vec3 gw = vec3(0.0);
    if (uGrid > 0.0 || uGlyphs > 0.0) { gw = pow(abs(normalize(on)), vec3(6.0)); gw /= (gw.x + gw.y + gw.z); }
    vec2 fwp = fwidth(vWorldPos.xz);
    float foldU = vFold.x * uFolds;
    float foldFw = fwidth(foldU);
    float fwBind = max(fwidth(vBind.y), fwidth(vBind.x)) / max(uPixelRatio, 1e-3);
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
    if (uHasMap > 0.5) albedo *= texture(uMap, vTextureUV).rgb;
    vec2 bw = vec2(0.0);
    float slope = 1.0 - n.y;
    if (uMode == ${MODE_TERRAIN}) {
      // Sand with flat patches of a second tone, rock on steep slopes; the
      // three tones come from the region (golden dunes / rose canyons / salt flats).
      vec3 c1 = uColor, c2 = uColor2, c3 = uColor3;
      if (uBiomes > 0.5) {
        bw = biomeWeights(vWorldPos.xz);
        biomeGround(bw, c1, c2, c3);
      }
      float patches = vnoise(vWorldPos.xz * 0.011) * 0.65 + vnoise(vWorldPos.xz * 0.045) * 0.35;
      albedo = patches > 0.6 ? c2 : c1;
      if (slope > 0.42) albedo = c3;
      else if (slope > 0.30 && patches < 0.45) albedo = mix(c1, c3, 0.5);
      float b = max(blobs(vWorldPos.xz, fwp, 2.2, 0.28, 0.45, 0.0),
                max(blobs(vWorldPos.xz, fwp, 11.0, 1.3, 0.35, 41.0),
                    blobs(vWorldPos.xz, fwp, 34.0, 3.2, 0.22, 97.0)));
      if (uSandInk < 0.5) albedo *= mix(vec3(1.0), vec3(0.945, 0.935, 0.965), b);
    } else if (uMode == ${MODE_STRATA}) {
      albedo = strata(vWorldPos);
    } else if (uMode == ${MODE_RIBBON}) {
      // flat print bands of colour, fixed along the path so they don't crawl
      // colours blend smoothly from one band into the next
      vec3 P[5] = vec3[5](vec3(0.949, 0.773, 0.294), vec3(0.902, 0.529, 0.373), vec3(0.910, 0.561, 0.651),
                          vec3(0.663, 0.608, 0.878), vec3(0.384, 0.765, 0.788));
      int i0 = int(mod(floor(vFold.x), 5.0)), i1 = int(mod(floor(vFold.x) + 1.0, 5.0));
      albedo = mix(P[i0], P[i1], smoothstep(0.0, 1.0, fract(vFold.x)));
    } else if (uMode == ${MODE_OUTFIT}) {
      // boots / trousers / belt / tunic with sleeves / skin at the neck and hands
      vec3 b = vBind;
      float ax = abs(b.x);
      if (ax > uOutfit.w && uGlove.a > 0.5) albedo = uGlove.rgb;
      else if ((b.y > uOutfit.z && ax < 0.16) || ax > uOutfit.w) albedo = uSkin;
      else if (b.y < uOutfit.x) albedo = uColor3;
      else if (abs(b.y - uOutfit.y) < 0.03 && ax < 0.25) albedo = uColor2 * 0.6 + vec3(0.33, 0.24, 0.1);
      else if (b.y < uOutfit.y) albedo = uColor2;
      else if (ax > uOutfit.w - 0.05) albedo = uColor * 0.75;     // cuffs
      else albedo = uColor;
    } else if (uMode == ${MODE_WATER}) {
      // two flat tones drifting slowly
      float w = vnoise(vWorldPos.xz * 0.012 + uTime * 0.01);
      albedo = w > 0.55 ? uColor2 : uColor;
    }
    float patInk = 0.0;
    if (uPattern == 1) patInk = facade(vWorldPos, n, albedo);
    else if (uPattern == 2) patInk = roofTiles(vWorldPos);
    else if (uPattern == 3) patInk = leaves(vObjPos);
    else if (uPattern == 4) patInk = rockCracks(vObjPos);
    albedo *= vInstColor;
    // cloth: the colour runs from the collar (uColor) down to the hem (uColor2)
    // cloth in flat blocks of colour, like a printed plate: the body colour, then a hem band
    if (uFolds > 0.0) albedo = (vFold.y < 0.62 ? uColor : uColor2) * vInstColor;

    float ndl = dot(n, uSunDir);
    float lambert = ndl * 0.5 + 0.5;
    float sh = ndl > 0.0 ? getShadow(vWorldPos, n) * cloudShadow(vWorldPos) : 1.0;
    // Cast shadows clamp the light term below the toon threshold (0.5) but keep
    // some gradation so the post-process can choose single vs cross hatching.
    float L = mix(min(lambert, 0.38), lambert, sh);
    L = mix(L, 1.0, uGlow);

    // local lights pool light on nearby surfaces, even inside shadow
    float local = 0.0;
    for (int i = 0; i < 8; i++) {
      vec3 dl = uLights[i].xyz - vWorldPos;
      float d = length(dl);
      if (d < uLights[i].w) {
        float att = pow(1.0 - d / uLights[i].w, 2.0);
        local = max(local, att * (0.35 + 0.65 * max(dot(n, dl / d), 0.0)));
      }
    }
    L = max(L, mix(L, 0.97, smoothstep(0.15, 0.5, local)));

    gAlbedoLight = vec4(albedo, L);
    gNormalDepth = vec4(n, vViewDepth);

    gHatch = vec4(0.0);
    float detail = 0.0;
    if (uGrid > 0.0) detail = gridLines(gq, gfw, gw);
    if (uGlyphs > 0.0) detail = max(detail, glyphs(glyphUV, glyphFw));
    if (uMode == ${MODE_TERRAIN}) {
      if (uRipples > 0.5) detail = max(detail, sandRipples(vWorldPos.xz, rippleFw, slope) * (1.0 - bw.y));
      if (bw.y > 0.0 && slope < 0.2) detail = max(detail, mudCracks(vWorldPos.xz, crackFw) * smoothstep(0.3, 0.8, bw.y));
      if (uTicks > 0.5 && slope < 0.35) detail = max(detail, grassTicks(vWorldPos.xz, fwp) * 0.8);
      if (uSandInk > 0.5) detail = max(detail, sandScuffs(vWorldPos.xz) * (1.0 - bw.y));
      if (uDots > 0.0 && uSandInk < 0.5) {
        // pen dotting: patchy, denser in hollows, a few bigger pebble dots
        float patchy = 0.45 + 0.55 * smoothstep(0.3, 0.75, vnoise(vWorldPos.xz * 0.06 + 7.0));
        float dots = stipple(ce1, fwd, 8.5 * mix(0.7, 1.45, smoothstep(5.0, 220.0, vViewDepth)), 0.32);
        float pebbles = stipple(ce2 * 0.37, fwd * 0.37, 20.0, 0.75) * step(0.5, vnoise(vWorldPos.xz * 0.2));
        detail = max(detail, max(dots * patchy, pebbles) * uDots * 1.6);
      }
    } else if (uMode == ${MODE_WATER}) {
      detail = max(detail, waterLines(vWorldPos.xz, uTime) * 0.7);
    } else if (uMode == ${MODE_STRATA} && abs(normalize(on).y) < 0.6) {
      detail = max(detail, fissures(vec2(faceX, vObjPos.y), fissFw) * 0.85);
    }
    if (uScrub > 0.0) {
      // brush: short broken pen strokes over the lobes, denser in shade
      float dash = smoothstep(0.42, 0.6, vnoise(vec2(ce1.x * 2.5, ce1.y * 9.0)));
      float dk = clamp((uToon - L) / uToon, 0.0, 1.0);
      float strokesB = strokes(ce1, fw1, mix(6.0, 3.5, dk), mix(0.8, 1.3, dk));
      detail = max(detail, strokesB * dash * (0.6 + 0.4 * dk));
    }
    if (uFolds > 0.0) {
      // drapery: fold lines down the cloth, each starting and ending at its own height
      float col = floor(foldU + 0.5);
      float d = abs(foldU - col) / max(foldFw, 1e-5);
      float h1 = hash(vec2(col, 3.1)), h2 = hash(vec2(col, 8.7));
      float run = smoothstep(0.08 + h1 * 0.25, 0.14 + h1 * 0.25, vFold.y) * (1.0 - smoothstep(0.75 + h2 * 0.25, 0.8 + h2 * 0.25, vFold.y));
      detail = max(detail, inkLine(d, mix(1.3, 0.7, vFold.y)) * run * step(0.25, h2 + 0.3));
    }
    if (uMode == ${MODE_OUTFIT} && uSuit > 0.0) {
      // a padded suit: short curved creases bunch up at the elbows, knees, waist and shoulders
      vec3 b = vBind;
      float ax = abs(b.x);
      float wob = (vnoise(b.xz * 40.0 + b.y * 9.0) - 0.5) * 0.35;
      float arm = smoothstep(0.24, 0.3, ax) * (1.0 - smoothstep(uOutfit.w - 0.06, uOutfit.w - 0.02, ax));
      float elbow = 1.0 - smoothstep(0.03, 0.11, abs(ax - 0.42));
      float knee = (1.0 - smoothstep(0.04, 0.13, abs(b.y - 0.5))) * step(ax, 0.24);
      float waist = (1.0 - smoothstep(0.02, 0.08, abs(b.y - uOutfit.y + 0.06))) * step(ax, 0.24);
      float u = arm > 0.5 ? ax * 22.0 + wob : b.y * 22.0 + wob;
      float fu = max(fwidth(u), 1e-4);
      float creases = inkLine(abs(fract(u) - 0.5) / fu, 0.9) * step(0.45, vnoise(vec2(u * 0.7, b.z * 30.0 + b.x * 11.0)));
      detail = max(detail, creases * max(max(elbow * arm, knee), waist) * 0.85 * (1.0 - smoothstep(0.05, 0.2, fu)));
    }
    if (uMode == ${MODE_OUTFIT} && vBind.y > uOutfit.z && abs(vBind.x) < 0.16) {
      float frontal = smoothstep(0.15, 0.45, normalize(vObjNormal).z);
      detail = max(detail, faceInk(vec2(abs(vBind.x), vBind.y - uFace.x), fwBind * uPixelRatio, frontal));
    }
    detail = max(detail, patInk);
    gHatch.b = detail;
    gHatch.a = max(uGlow, smoothstep(0.15, 0.6, local) * 0.6) + 2.0 * uHero;
    float dark = clamp((uToon - L) / uToon, 0.0, 1.0);
    // detail by distance: finer marks close to the camera, coarser far away
    float hsp = uHatchSpacing * mix(0.78, 1.4, smoothstep(6.0, 260.0, vViewDepth));
    if (dark > 0.0 && uHatch > 0.0 && uShadeStyle == 1) {
      gHatch.r = stipple(ce1, fwd, hsp * 1.15, dark) * smoothstep(0.02, 0.15, dark);
    } else if (dark > 0.0 && uHatch > 0.0) {
      float h1 = strokes(ce1, fw1, hsp, mix(0.9, 2.2, dark)) * smoothstep(0.02, 0.12, dark);
      if (uFormHatch > 0.0 && uMode == ${MODE_TERRAIN}) {
        // on slopes the strokes become height contours wrapping round the dunes
        float sm = smoothstep(0.1, 0.3, slope) * uFormHatch;
        float hc = strokes(ceY, fwY, hsp, mix(0.9, 2.2, dark)) * smoothstep(0.02, 0.12, dark);
        h1 = mix(h1, hc, sm);
      }
      float h2 = 0.0;
      if (dark > 0.5) {
        bool rings = uFormHatch > 0.0 && uFlat < 0.5 && uMode != ${MODE_TERRAIN};
        // smooth objects: cross-hatch as rings round the form (trunks, ribs, domes)
        h2 = (rings ? strokes(ceY, fwY, hsp * 1.2, mix(0.6, 1.7, dark))
                    : strokes(ce2, fw2, hsp * 1.2, mix(0.6, 1.7, dark))) * smoothstep(0.5, 0.65, dark);
      }
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
 * @param {boolean} [o.biomes]  terrain: desert region palettes
 * @param {boolean} [o.sandInk] terrain: sparse contour strokes instead of dot fields
 * @param {boolean} [o.ripples] terrain: wind ripple marks
 * @param {boolean} [o.ticks]   terrain: inked grass ticks
 * @param {number}  [o.glow]    0..1 self-lit
 * @param {THREE.Side} [o.side]
 */
export function makeMaterial(o) {
  const key = JSON.stringify({ ...o, map: o.map?.uuid });
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
      uMap: { value: o.map ?? null },
      uHasMap: { value: o.map ? 1 : 0 },
      uMode: { value: o.mode ?? MODE_PLAIN },
      uFlat: { value: o.flat ? 1 : 0 },
      uStrataSize: { value: o.strataSize ?? 4.0 },
      uGrid: { value: o.grid ?? 0 },
      uGlyphs: { value: o.glyphs ? 1 : 0 },
      uBiomes: { value: o.biomes ? 1 : 0 },
      uRipples: { value: o.ripples ? 1 : 0 },
      uSandInk: { value: o.sandInk ? 1 : 0 },
      uTicks: { value: o.ticks ? 1 : 0 },
      uGlow: { value: o.glow ?? 0 },
      uFolds: { value: o.folds ?? 0 },
      uScrub: { value: o.scrub ? 1 : 0 },
      uPattern: { value: { facade: 1, tiles: 2, leaves: 3, cracks: 4 }[o.pattern] ?? 0 },
      uSkin: { value: new THREE.Color(o.skin ?? '#e8c6a8') },
      uGlove: { value: o.gloves ? new THREE.Vector4(...new THREE.Color(o.gloves).toArray(), 1) : new THREE.Vector4() },
      uHero: { value: 0 },
      uSuit: { value: o.suit ? 1 : 0 },
      uGlassCenter: { value: o.glassCenter ?? new THREE.Vector3() },
      uGlass: { value: o.glass ? 1 : 0 },
      uOutfit: { value: new THREE.Vector4(...(o.outfit ?? [0.13, 0.97, 1.47, 0.64])) },
      uFace: { value: new THREE.Vector4(...(o.face ?? [1.7, 0.032, 1.657, 1.577]).filter((_, i) => i !== 3)) },
    },
  });
  cache.set(key, mat);
  return mat;
}


/** Tag only the player's materials, preserving live shared shader uniforms. */
export function markHero(root, copies = new Map()) {
  root?.traverse((o) => {
    if (!o.isMesh) return;
    const tagged = (material) => {
      if (!material.uniforms?.uHero) return material;
      if (!copies.has(material)) {
        const copy = material.clone();
        Object.assign(copy.uniforms, sharedUniforms);
        copy.uniforms.uHero.value = 1;
        copies.set(material, copy);
      }
      return copies.get(material);
    };
    o.material = Array.isArray(o.material) ? o.material.map(tagged) : tagged(o.material);
  });
  return copies;
}
