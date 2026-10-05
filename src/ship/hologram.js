import * as THREE from 'three';
import { buildCharacter } from '../player.js';
import { Humanoid, FACE, LOWER_FACE } from '../humanoid.js';
import { Animator } from '../animator.js';
import { namedLook } from '../costumes.js';
import { MODE_OUTFIT, MODE_EYE } from '../materials.js';

// The recordings' hologram (src/story/calls.js): the parents, as they were when
// they made them, projected as busts over the lens of the projector on the dash
// (and over the reel on the stone at home: src/ship/homecoming.js).
//
// The figures are the game's own people (the human body, dressed by
// costumes.js, played by the mocap library), cut to a bust: head, neck,
// shoulders and the top of the chest, dissolving into grains below it. They
// keep their own colours (skin, hair, clothes: each mesh's material is read and
// redrawn in light), shaded in two flat tones like the ink plates, with a bright
// edge line, faint scanlines climbing them, a flicker, a slice now and then
// sliding sideways (the glitch), the face's ink lines and a mouth that opens as
// they talk. They turn to face the traveller; their heads nod and glance while
// they speak and listen.
//
// They are light, not ink: not in the G-buffer. HOLO.render draws the picture
// into a target of its own after the Moebius composite (src/main.js renderFrame),
// with a depth buffer so a face hides the back of its own head, testing itself
// against the G-buffer's depth so the traveller in front of it (and the dash)
// still hide it; then lays it over the frame, slightly translucent, with a soft
// bloom of its own colours.
//
//   const holo = new Hologram({ lib, humans });       // lib: loadAnimationLibrary(), humans: [m, f] templates
//   holo.show({ parent: model.group, at, scale, who: 'both', face: () => travellerHead, lens: 0.16 })
//                                                     // who: 'father' | 'mother' | 'both' | 'three'
//   holo.speak('father')                              // who is talking (null: nobody)
//   holo.glitch(1)                                    // tear it up (the impact)
//   holo.hide()                                       // folds away over HOLO_FOLD seconds
//   holo.update(dt)                                   // every frame

/** The projector's own light: the beam, the lens, the edge of the picture (the people keep their colours). */
export const HOLO_COLOR = '#8ff2e6';
/** Seconds the picture takes to rise, and to fold away. */
export const HOLO_RISE = 0.9, HOLO_FOLD = 0.7;
/**
 * The bust, in the body's own metres (feet at 0): it is fully drawn above `top`, gone below
 * `bottom`, and stands `lift` (picture units) above the lens. `head`: the top of the head, with hair.
 */
export const BUST = { m: { bottom: 1.16, top: 1.33, head: 1.9 }, f: { bottom: 1.13, top: 1.29, head: 1.86 }, lift: 0.05 };

/** The layer drawn after the composite: its scene and the uniforms main.js keeps up to date. */
export const HOLO = {
  scene: new THREE.Scene(),
  uniforms: { tNormal: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 } },
  /** Anything to draw this frame. */
  live() { return this.scene.children.some((c) => c.visible); },
  rt: null,
  /** Draw the picture into its own target and lay it over `target` (the composite). */
  render(renderer, camera, target) {
    const w = target?.width ?? 1, h = target?.height ?? 1;
    if (!this.rt) this.rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
    const clear = renderer.getClearColor(_clear), alpha = renderer.getClearAlpha();
    renderer.setRenderTarget(this.rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(this.scene, camera);
    renderer.setClearColor(clear, alpha);
    renderer.setRenderTarget(target);
    const U = overlay.material.uniforms;
    U.tHolo.value = this.rt.texture;
    U.uTexel.value.set(1 / w, 1 / h);
    U.uSpread.value = h / 900;
    renderer.render(overlay.scene, overlay.camera);
  },
};
const _clear = new THREE.Color();

// the picture laid over the frame: premultiplied light, and a soft bloom of its own colours round it
const overlay = (() => {
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { tHolo: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) }, uSpread: { value: 1 } },
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tHolo;
      uniform vec2 uTexel;
      uniform float uSpread;
      in vec2 vUv;
      out highp vec4 fragColor;
      void main() {
        vec4 c = texture(tHolo, vUv);
        vec3 g = vec3(0.0);
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.785398 + 0.39;
          vec2 d = vec2(cos(a), sin(a)) * uTexel * uSpread;
          g += texture(tHolo, vUv + d * 4.0).rgb * 0.6 + texture(tHolo, vUv + d * 10.0).rgb * 0.4;
        }
        g /= 8.0;
        fragColor = vec4(c.rgb + g * 0.42 * (1.0 - 0.6 * c.a), c.a);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  return { scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), material };
})();

const vertexShader = /* glsl */ `
  #include <skinning_pars_vertex>
  uniform float uTime;
  uniform float uGlitch;
  uniform float uSeed;
  uniform mat4 uLocal;      // world -> the figure's own frame (its body's metres, feet at 0)
  out vec3 vWorld;
  out vec3 vNormalW;
  out vec3 vBind;
  out vec3 vLocal;
  out vec3 vCol;
  out float vDepth;
  void main() {
    vec3 transformed = position;
    vec3 objectNormal = normal;
    #ifdef USE_SKINNING
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <skinning_vertex>
    #endif
    vBind = position;
    #ifdef USE_COLOR
      vCol = color;
    #else
      vCol = vec3(1.0);
    #endif
    vec4 wp = modelMatrix * vec4(transformed, 1.0);
    vLocal = (uLocal * wp).xyz;
    // the glitch: now and then a thin slice of the picture slides sideways (more when torn up)
    float band = floor(wp.y * 16.0) + floor(uTime * 7.0) * 13.0;
    float r = fract(sin(band * 12.9898 + uSeed * 7.13) * 43758.5453);
    float slide = step(0.93 - uGlitch * 0.45, r) * (r - 0.5) * (0.035 + uGlitch * 0.3);
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    wp.xyz += right * slide;
    vWorld = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * objectNormal);
    vec4 mv = viewMatrix * wp;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

// A person in light: their own colours (uKind: 0 one colour, 1 per vertex (costumes), 2 the body's
// clothes by region (materials.js MODE_OUTFIT), 3 the eyes), two flat tones, the edge line, scanlines.
const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D tNormal;
  uniform vec2 uRes;
  uniform float uTime;
  uniform vec3 uTint;        // the projector's light
  uniform float uAlpha;      // 0 .. 1: rising / folding
  uniform float uGlitch;
  uniform float uSeed;
  uniform float uTalk;       // 0 .. 1: the mouth
  uniform vec2 uSpan;        // world y of the lens and the picture's top: it builds from the bottom
  uniform vec2 uCut;         // the bust: gone below x, whole above y (the figure's own metres)
  uniform int uKind;
  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uSkin;
  uniform vec4 uOutfit;      // bootTop, beltY, neckY, wristX
  uniform vec4 uGlove;
  uniform vec4 uFace;        // eyeY, eyeX, noseY, chinY (bind pose); x < 0: no face
  uniform vec4 uEyeC;        // the eyeballs' centre (|x|, y, z), w: the iris
  in vec3 vWorld;
  in vec3 vNormalW;
  in vec3 vBind;
  in vec3 vLocal;
  in vec3 vCol;
  in float vDepth;
  out highp vec4 fragColor;
  const vec3 INK = vec3(0.13, 0.1, 0.11);
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float segDist(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
  float inkLine(float d, float w) { return 1.0 - smoothstep(w * 0.5, w, d); }
  void main() {
    float scene = texture(tNormal, gl_FragCoord.xy / uRes).w;
    if (scene > 0.0 && vDepth > scene + 0.04) discard;   // behind the traveller, the dash: hidden
    float h = clamp((vWorld.y - uSpan.x) / max(uSpan.y - uSpan.x, 0.01), 0.0, 1.0);
    // it builds from the lens up as it rises, and folds back down
    float reveal = smoothstep(h - 0.05, h + 0.05, uAlpha * 1.15 - 0.075);
    if (reveal <= 0.001) discard;
    // the bust: below the chest the picture falls apart into grains, the lowest first
    float cut = smoothstep(uCut.x, uCut.y, vLocal.y);
    float grain = hash3(floor(vLocal * 110.0) + floor(uTime * 2.0) * 0.37);
    if (cut < grain * 0.55 + 0.01) discard;

    vec3 alb = uColor;
    if (uKind == 1) alb = vCol * uColor;
    else if (uKind == 2) {
      vec3 b = vBind;
      float ax = abs(b.x);
      if (ax > uOutfit.w && uGlove.a > 0.5) alb = uGlove.rgb;
      else if ((b.y > uOutfit.z && ax < 0.16) || ax > uOutfit.w) alb = uSkin;
      else if (b.y < uOutfit.x) alb = uColor3;
      else if (b.y < uOutfit.y) alb = uColor2;
      else alb = uColor;
    } else if (uKind == 3) {
      // the eyes: the white, and the iris and pupil looking ahead (where the figure turns its head)
      float side = vBind.x < 0.0 ? -1.0 : 1.0;
      vec3 d = normalize(vBind - vec3(side * uEyeC.x, uEyeC.y, uEyeC.z));
      float f = dot(d, normalize(vec3(0.0, -0.2, 1.0)));
      alb = mix(uColor, mix(uColor2, INK, 0.25), smoothstep(0.86, 0.9, f));
      alb = mix(alb, INK, smoothstep(0.955, 0.97, f));
    }

    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vWorld);
    float ndv = abs(dot(N, V));
    // two flat tones, lit from above the viewer (the ink plates' light and shade)
    vec3 key = normalize(V + vec3(0.0, 1.1, 0.0));
    float lit = mix(0.82, 1.1, smoothstep(0.12, 0.3, dot(N, key)));
    vec3 col = alb * lit;
    // projected light: the darks lifted a little, a breath of the projector's colour over everything
    col = mix(col, uTint * dot(col, vec3(0.3, 0.59, 0.11)) * 1.25, 0.08) + uTint * 0.04;

    // the face's ink lines: lids, the fold by the nose, the mouth opening as they talk
    float ink = 0.0;
    if (uKind == 2 && uFace.x > 0.0 && vBind.y > uOutfit.z && abs(vBind.x) < 0.16 && vBind.z > 0.03) {
      vec2 q = vec2(abs(vBind.x), vBind.y - uFace.x);
      float fw = max(fwidth(q.y), 1e-4) * 1.3;
      float e = uFace.y, ny = uFace.z - uFace.x, cy = uFace.w - uFace.x;
      vec2 lid = (q - vec2(e, 0.004)) / vec2(0.017, 0.008);
      ink = max(ink, inkLine(abs(length(lid) - 1.0) * 0.008 / fw, 1.0) * step(0.0, lid.y + 0.25) * step(abs(lid.x), 1.1));
      ink = max(ink, inkLine(segDist(q, vec2(0.021, ny - 0.003), vec2(0.03, ny - 0.03)) / fw, 0.7) * 0.35);
      // the mouth, its corners a little up (a kind face, as the people's rest: expression.js PEOPLE_REST)
      float my = ny + (cy - ny) * 0.42;
      vec2 m = vec2(q.x / 0.02, (q.y - my - 0.003 * min(q.x * q.x / 0.0004, 1.0)) / (0.0025 + 0.011 * uTalk));
      ink = max(ink, 1.0 - smoothstep(0.7, 1.0, length(m)));
    }

    // scanlines climbing the figure, and a brighter band rolling up now and then
    float scan = 1.0 - 0.16 * smoothstep(0.55, 1.0, sin(vLocal.y * 380.0 - uTime * 6.0));
    float roll = 1.0 + 0.15 * smoothstep(0.9, 1.0, 1.0 - abs(fract(vLocal.y * 0.8 - uTime * 0.26) - 0.5) * 2.0);
    float flicker = 0.92 + 0.08 * sin(uTime * 61.0 + uSeed) * sin(uTime * 7.3 + uSeed * 3.0) - uGlitch * 0.35 * step(0.6, fract(uTime * 11.0 + uSeed));
    col *= scan * roll * flicker;
    // the edge: a line of light round the figure, its own colour paled toward the beam's
    float edge = smoothstep(0.72, 0.95, 1.0 - ndv);
    col = mix(col, mix(alb, vec3(1.0), 0.5) * 1.1 + uTint * 0.3, edge * 0.8);
    // where it falls apart, and where it is still building: brighter
    float fray = smoothstep(0.0, 0.25, cut) * (1.0 - smoothstep(0.3, 0.8, cut));
    float seam = smoothstep(0.04, 0.0, abs(h - (uAlpha * 1.15 - 0.075))) * step(uAlpha, 0.999);
    col += (uTint * 0.22 + alb * 0.12) * fray + vec3(0.8, 1.0, 1.0) * seam * 0.8;
    col = mix(col, INK, ink * 0.85);
    float a = (0.8 + 0.14 * edge + 0.1 * scan - 0.08) * smoothstep(0.0, 0.9, cut);
    a = max(a, ink * 0.9) * reveal;
    fragColor = vec4(col * a, a);   // premultiplied (HOLO.render lays it over the frame)
  }
`;

// the beam from the lens up into the bust, and the lens's rings: light added over the picture
const coneFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tNormal;
  uniform vec2 uRes;
  uniform float uTime;
  uniform vec3 uTint;
  uniform float uAlpha;
  uniform float uGlitch;
  uniform float uSeed;
  uniform float uConeH;
  in vec3 vWorld;
  in vec3 vNormalW;
  in vec3 vBind;
  in float vDepth;
  out highp vec4 fragColor;
  void main() {
    float scene = texture(tNormal, gl_FragCoord.xy / uRes).w;
    if (scene > 0.0 && vDepth > scene + 0.04) discard;
    float h = clamp(vBind.y, 0.0, 1.0);   // (the cone's own 0 .. 1, scaled to its height)
    float ang = atan(vBind.x, vBind.z);
    float streak = 0.55 + 0.45 * sin(ang * 23.0 + uTime * 1.3) * sin(ang * 9.0 - uTime * 0.7);
    vec3 V = normalize(cameraPosition - vWorld);
    float edge = pow(1.0 - abs(dot(normalize(vNormalW), V)), 1.5);
    float k = (1.0 - smoothstep(0.0, 1.0, h)) * (0.25 + 0.75 * edge) * streak;
    k *= 0.85 + 0.15 * sin(uTime * 47.0 + uSeed);
    k *= uAlpha * (1.0 - 0.5 * uGlitch);
    fragColor = vec4(uTint * k * 0.16, 0.0);
  }
`;

const ringFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tNormal;
  uniform vec2 uRes;
  uniform float uTime;
  uniform vec3 uTint;
  uniform float uAlpha;
  in vec3 vWorld;
  in vec3 vBind;
  in float vDepth;
  out highp vec4 fragColor;
  void main() {
    float scene = texture(tNormal, gl_FragCoord.xy / uRes).w;
    if (scene > 0.0 && vDepth > scene + 0.08) discard;
    float r = length(vBind.xz);
    float ring = smoothstep(0.06, 0.0, abs(r - 0.42)) + 0.6 * smoothstep(0.04, 0.0, abs(r - 0.25 - 0.03 * sin(uTime * 3.0)));
    float k = (ring + 0.25 * (1.0 - smoothstep(0.0, 0.5, r))) * uAlpha;
    fragColor = vec4(uTint * k * 0.8, 0.0);
  }
`;

// dust in the beam: points drifting up through the cone
const motesVertex = /* glsl */ `
  uniform float uTime;
  uniform float uAlpha;
  uniform float uScale;
  uniform float uConeH;
  in float aSeed;
  out float vK;
  out float vDepth;
  void main() {
    float t = fract(aSeed * 7.31 + uTime * (0.06 + 0.05 * fract(aSeed * 3.7)));
    float a = aSeed * 40.0 + uTime * 0.3;
    float r = (0.3 + 0.7 * t) * (0.3 + 0.7 * fract(aSeed * 11.3)) * 0.7;
    vec3 p = vec3(cos(a) * r, t * uConeH * 1.6, sin(a) * r);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    vK = uAlpha * smoothstep(0.0, 0.15, t) * (1.0 - t);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uScale * 2.2 / max(vDepth, 0.3);
  }
`;
const motesFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tNormal;
  uniform vec2 uRes;
  uniform vec3 uTint;
  in float vK;
  in float vDepth;
  out highp vec4 fragColor;
  void main() {
    float scene = texture(tNormal, gl_FragCoord.xy / uRes).w;
    if (scene > 0.0 && vDepth > scene + 0.04) discard;
    float d = length(gl_PointCoord - 0.5);
    fragColor = vec4(uTint * vK * (1.0 - smoothstep(0.2, 0.5, d)), 0.0);
  }
`;

/** A figure's material: written front-most only (depth), premultiplied. */
function figureMaterial(u, side = THREE.FrontSide) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    uniforms: { ...HOLO.uniforms, ...u },
    transparent: false,
    depthTest: true,
    depthWrite: true,
    side,
    blending: THREE.NoBlending,
  });
}

/** The beam's materials: light added over the picture, behind the faces hidden. */
function beamMaterial(u, frag, vert = vertexShader, side = THREE.DoubleSide) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: { ...HOLO.uniforms, ...u },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side,
    blending: THREE.AdditiveBlending,
  });
}

/** The uniforms a figure owns (shared by all its materials). */
function figureUniforms(seed) {
  return {
    uTint: { value: new THREE.Color(HOLO_COLOR) },
    uAlpha: { value: 0 },
    uGlitch: { value: 0 },
    uSeed: { value: seed },
    uTalk: { value: 0 },
    uSpan: { value: new THREE.Vector2(0, 1) },
    uCut: { value: new THREE.Vector2(0, 0) },
    uLocal: { value: new THREE.Matrix4() },
  };
}

/** What a mesh's own (ink) material says it looks like, as the hologram's uniforms. */
export function holoLook(mat, vertexColors = false) {
  const U = mat?.uniforms ?? {};
  const c = (k, d) => new THREE.Color().copy(U[k]?.value ?? mat?.color ?? new THREE.Color(d));
  const mode = U.uMode?.value;
  const kind = mode === MODE_OUTFIT ? 2 : mode === MODE_EYE ? 3 : vertexColors ? 1 : 0;
  return {
    uKind: { value: kind },
    uColor: { value: c('uColor', '#ffffff') },
    uColor2: { value: c('uColor2', '#ffffff') },
    uColor3: { value: c('uColor3', '#ffffff') },
    uSkin: { value: c('uSkin', '#e8c6a8') },
    uOutfit: { value: (U.uOutfit?.value ?? new THREE.Vector4(0.13, 0.97, 1.47, 0.64)).clone() },
    uGlove: { value: (U.uGlove?.value ?? new THREE.Vector4()).clone() },
    uFace: { value: kind === 2 && U.uFace ? U.uFace.value.clone() : new THREE.Vector4(-1, 0, 0, 0) },
    uEyeC: { value: (U.uEyeC?.value ?? new THREE.Vector4(0.034, 1.7, 0.066, 0.44)).clone() },
  };
}

/** How open the mouth is, t seconds into a line (0 when silent). */
export function mouthOpen(t, talking) {
  if (!talking) return 0;
  return Math.max(0, Math.min(1, Math.sin(t * 17) * 0.5 + Math.sin(t * 7.3) * 0.35 + 0.25));
}

/**
 * Where the busts stand on the lens (picture space, before its scale), how high (y: the bust's
 * bottom edge over the lens) and which way they turn when nobody is there to face.
 */
export function holoLayout(who) {
  if (who === 'three') return [{ id: 'father', x: -0.36, y: BUST.lift, yaw: 0.12 }, { id: 'child', x: 0.02, y: BUST.lift + 0.06, z: 0.16, yaw: 0 }, { id: 'mother', x: 0.36, y: BUST.lift, yaw: -0.12 }];
  if (who === 'both') return [{ id: 'father', x: -0.27, y: BUST.lift, yaw: 0.12 }, { id: 'mother', x: 0.27, y: BUST.lift, yaw: -0.12 }];
  return [{ id: who === 'mother' ? 'mother' : 'father', x: 0, y: BUST.lift, yaw: 0 }];
}

/**
 * Who they were, when they made the recordings: the father with short brown hair and a full,
 * trimmed beard, a rust-red shirt; the mother with her long dark hair down,
 * a teal scarf over a lilac top; the child (the traveller, small) in yellow.
 */
export const PEOPLE = {
  father: { kind: 'm', scale: 1, skin: '#dba985', hair: '#5f3c27', moustache: true,
    palette: { cloak: '#f3ead8', cloth: '#b5473a', legs: '#2b2f45', hat: '#3d4a80', accent: '#d9a441', hair: '#5f3c27', skin: '#dba985' },
    look: { head: 'short', mask: 'beard', body: 'none', prop: 'none', trim: 'none', robe: 0 } },
  mother: { kind: 'f', scale: 1, skin: '#c99272', hair: '#2e1f1b',
    palette: { cloak: '#277e86', cloth: '#9a6aa8', legs: '#34405e', hat: '#5fb7ad', accent: '#2f9a92', hair: '#2e1f1b', skin: '#c99272' },
    look: { head: 'flow', mask: 'none', body: 'scarf', prop: 'none', trim: 'none', robe: 0 } },
  child: { kind: 'm', scale: 0.56, skin: '#e6bf9e', hair: '#8a5638',
    palette: { cloak: '#4f8fa8', cloth: '#f2c54b', legs: '#34405e', hair: '#8a5638', skin: '#e6bf9e', accent: '#4f8fa8' },
    look: { head: 'short', mask: 'none', body: 'none', prop: 'none', trim: 'none', robe: 0 } },
};

// a small smoothed random walk (glances, sways)
const wave = (t, s) => Math.sin(t * 1.13 + s) * 0.6 + Math.sin(t * 0.71 + s * 2.1) * 0.4;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _o = new THREE.Vector3(), _m = new THREE.Matrix4();

/** One person on the hologram: a dressed body drawn in light, played by the mocap library, cut to a bust. */
export class HoloFigure {
  constructor(id, { lib, humans }) {
    const P = PEOPLE[id];
    this.id = id;
    this.kind = P.kind;
    this.char = buildCharacter(P.palette);
    this.object = this.char.root;
    this.object.scale.setScalar(P.scale);
    this.humanoid = new Humanoid(humans[P.kind === 'm' ? 0 : 1], this.char, P.kind, { skin: P.skin, hair: P.hair });
    // (their hair on their own skull: costumes.js scalp)
    this.humanoid.dress(namedLook({ world: 'home', id: `holo-${id}`, palette: P.palette, look: P.look, kind: P.kind }));
    if (P.moustache) this.addMoustache(P.hair);
    this.animator = lib ? new Animator(lib, this.char) : null;
    if (this.animator) this.animator.phase = Math.random();
    const B = BUST[P.kind];
    this.u = figureUniforms(Math.random() * 10);
    this.u.uCut.value.set(B.bottom, B.top);
    const model = this.humanoid.model;
    const mats = new Map();
    this.char.root.traverse((o) => {
      if (!o.isMesh) return;
      // only the body and its costume (skinned) and the moustache: the rig's own parts (hood, collar ring, pack, jets) stay hidden
      if (!o.userData.holo && (!o.isSkinnedMesh || !model.getObjectById(o.id))) { o.visible = false; return; }
      const vc = !!o.geometry.attributes.color && !!o.material.vertexColors;
      const key = `${o.material.uuid}|${vc}`;
      if (!mats.has(key)) {
        const m = figureMaterial({ ...this.u, ...holoLook(o.material, vc) }, o.material.side);
        m.vertexColors = vc;
        mats.set(key, m);
      }
      o.material = mats.get(key);
      o.frustumCulled = false;
    });
    this.t = Math.random() * 20;
    this.seed = Math.random() * 10;
    this.look = { yaw: 0, pitch: 0 };
    this.glance = { t: 2 + Math.random() * 3, until: 0, yaw: 0, pitch: 0 };
  }

  /** The father's moustache, over the beard (costumes.js draws the beard round the jaw): on the head bone. */
  addMoustache(hair) {
    const head = this.humanoid.b.Head;
    if (!head) return;
    const g = new THREE.CapsuleGeometry(0.0105, 0.052, 3, 8).rotateZ(Math.PI / 2).scale(1, 0.8, 0.9);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) - x * x * 4); p.setZ(i, p.getZ(i) - x * x * 1.6); }
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: hair }));
    mesh.userData.holo = true;
    // placed in the bind pose (the body's metres, under the nose: humanoid.js FACE), then carried by the head
    const [eyeY, , noseY, noseZ] = FACE[this.kind];
    const y = eyeY + (noseY - eyeY) * LOWER_FACE - 0.016;
    this.char.root.updateMatrixWorld(true);
    _m.copy(head.matrixWorld).invert().multiply(this.char.root.matrixWorld)
      .multiply(new THREE.Matrix4().makeTranslation(0, y, noseZ - 0.018));
    _m.decompose(mesh.position, mesh.quaternion, mesh.scale);
    head.add(mesh);
  }

  /**
   * Pose for this frame. `face`: the traveller's head (world), whom they speak to; `other`: the
   * other one on the picture who is talking (world), if any.
   */
  update(dt, { talking = false, face = null, other = null } = {}) {
    this.t += dt;
    const c = this.char, a = this.animator, t = this.t;
    if (a) {
      const N = a.lib.native;
      a.update(dt, { speed: 0, onGround: true, mode: talking ? 'talk' : 'ground', walkAt: N.walk * 1.3, jogAt: N.jog, sprintAt: N.sprint * 1.2, strideScale: 1.05 });
      a.apply(c.root, { legScale: 1.04 });
    }
    // where the head turns: to the traveller; to the other one now and then while they talk; a glance aside
    const G = this.glance;
    if ((G.t -= dt) <= 0) {
      G.t = (talking ? 2.2 : 3.2) + Math.random() * 3.5;
      G.until = 0.5 + Math.random() * (talking ? 0.7 : 1.2);
      const toOther = other && Math.random() < 0.6;
      G.target = toOther ? 'other' : 'aside';
      G.yaw = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.25);
      G.pitch = (Math.random() - 0.6) * 0.18;
    }
    G.until -= dt;
    let yaw = 0, pitch = 0;
    const aim = G.until > 0 && G.target === 'other' && other ? other : face;
    if (aim) {
      c.root.updateMatrixWorld(true);
      const hp = (this.humanoid.b.Head ?? c.head).getWorldPosition(_w);   // (the bone: the rig's head joint sits higher)
      _v.copy(aim).sub(hp).transformDirection(_m.copy(c.root.matrixWorld).invert());
      yaw = Math.atan2(_v.x, _v.z);
      pitch = -Math.atan2(_v.y, Math.hypot(_v.x, _v.z));
    }
    if (G.until > 0 && G.target === 'aside') { yaw += G.yaw; pitch += G.pitch; }
    yaw = THREE.MathUtils.clamp(yaw, -0.7, 0.7);
    pitch = THREE.MathUtils.clamp(pitch, -0.3, 0.35);
    const k = 1 - Math.exp(-dt * 5);
    this.look.yaw += (yaw - this.look.yaw) * k;
    this.look.pitch += (pitch - this.look.pitch) * k;
    // nods on the stressed words, a tilt as they think, the shoulders breathing and swaying
    const talkK = talking ? 1 : 0.25;
    const nod = Math.sin(t * 5.3) * Math.max(0, Math.sin(t * 1.7 + this.seed)) * 0.07 * talkK + Math.sin(t * 0.8) * 0.012;
    const tilt = wave(t * 0.6, this.seed) * (talking ? 0.07 : 0.04);
    c.torso.rotateY(this.look.yaw * 0.25 + wave(t * 0.5, this.seed + 3) * 0.035 * (talking ? 1.4 : 1));
    c.torso.rotateZ(wave(t * 0.7, this.seed + 5) * 0.022);
    c.torso.rotateX(Math.sin(t * 1.5) * 0.012 + (talking ? Math.max(0, Math.sin(t * 1.7 + this.seed)) * 0.03 : 0));
    c.head.rotateY(this.look.yaw * 0.75);
    c.head.rotateX(this.look.pitch + nod);
    c.head.rotateZ(tilt);
    this.humanoid.update();
    this.u.uTalk.value = mouthOpen(this.t, talking);
  }
}

/**
 * The picture: up to three busts, the beam and the lens's rings. It is placed in the frame of
 * `parent` (the ship's group, or the stone at home) at `at`, scaled.
 */
export class Hologram {
  constructor({ lib, humans }) {
    this.lib = lib;
    this.humans = humans;
    this.figures = {};
    this.root = new THREE.Group();
    this.root.name = 'hologram';
    this.root.matrixAutoUpdate = false;
    this.root.visible = false;
    HOLO.scene.add(this.root);
    this.k = 0;            // 0 .. 1 risen
    this.target = 0;
    this.glitchK = 0;
    this.spike = 0;
    this.spikeT = 2;
    this.speaker = null;
    this.local = new THREE.Matrix4();
    this.beamU = { ...figureUniforms(3.7), uConeH: { value: 0.5 }, uScale: { value: 30 } };
    // the beam: from the lens up into the bottom of the busts (cone picture units, scaled to the lens)
    this.beamGroup = new THREE.Group();
    this.root.add(this.beamGroup);
    const cone = new THREE.CylinderGeometry(0.72, 0.4, 1.0, 40, 1, true).translate(0, 0.5, 0);
    this.beam = new THREE.Mesh(cone, beamMaterial(this.beamU, coneFragment));
    this.ring = new THREE.Mesh(new THREE.CircleGeometry(0.5, 40).rotateX(-Math.PI / 2).translate(0, 0.02, 0), beamMaterial(this.beamU, ringFragment));
    const n = 60, seeds = new Float32Array(n), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) seeds[i] = Math.random();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.motes = new THREE.Points(g, beamMaterial(this.beamU, motesFragment, motesVertex));
    for (const o of [this.beam, this.ring, this.motes]) { o.frustumCulled = false; o.renderOrder = 2; this.beamGroup.add(o); }
  }

  figure(id) {
    if (!this.figures[id]) {
      try { this.figures[id] = new HoloFigure(id, { lib: this.lib, humans: this.humans }); } catch (e) { console.warn('hologram figure failed', e); return null; }
      this.root.add(this.figures[id].object);
    }
    return this.figures[id];
  }

  /**
   * Rise over the projector.
   * @param o { parent: Object3D whose frame it stands in, at: Vector3 there (the lens), scale (1: life size),
   *            yaw (rad, turns it in that frame), who: 'father' | 'mother' | 'both' | 'three',
   *            face: world point (or () => point) of the traveller's head, whom they turn to,
   *            lens: the lens's radius (m, in the parent's frame) }
   */
  show({ parent, at, scale = 0.9, yaw = 0, who = 'father', face = null, lens = 0.16 }) {
    this.parent = parent;
    this.local.compose(at.clone(), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(scale, scale, scale));
    this.scale = scale;
    this.face = face;
    this.layout = holoLayout(who);
    this.who = who;
    for (const f of Object.values(this.figures)) f.object.visible = false;
    this.top = 0;
    for (const L of this.layout) {
      const f = this.figure(L.id);
      if (!f) continue;
      const P = PEOPLE[L.id], B = BUST[P.kind];
      f.object.visible = true;
      // the bust's bottom edge just over the lens
      f.object.position.set(L.x, L.y - B.bottom * P.scale, L.z ?? 0);
      f.object.rotation.set(0, L.yaw, 0);
      this.top = Math.max(this.top, L.y + (B.head - B.bottom) * P.scale);
    }
    // the beam fits the lens and reaches into the bottom of the busts
    const b = lens / 0.42 / scale;
    this.beamGroup.scale.set(b, 1, b);
    this.beamU.uConeH.value = BUST.lift + 0.22;
    this.beam.scale.y = this.beamU.uConeH.value;
    this.target = 1;
    this.glitchK = 0;
    this.root.visible = true;
    this.place();
  }

  /** Who is talking now ('father' | 'mother' | 'child' | null). */
  speak(who) { this.speaker = who; }
  /** Tear the picture up (0 .. 1). */
  glitch(k) { this.glitchK = k; }
  hide() { this.target = 0; this.speaker = null; }
  /** Gone at once (a scene skipped). */
  clear() { this.target = 0; this.k = 0; this.root.visible = false; this.speaker = null; }
  get visible() { return this.root.visible; }

  place() {
    if (!this.parent) return;
    this.parent.updateMatrixWorld();
    this.root.matrix.multiplyMatrices(this.parent.matrixWorld, this.local);
    this.root.matrixWorldNeedsUpdate = true;
    this.root.updateMatrixWorld(true);
  }

  /** The traveller's head, if the picture knows where he is. */
  facePoint() {
    const f = typeof this.face === 'function' ? this.face() : this.face;
    return f ?? null;
  }

  /** Turn each bust to face `face` (a world point): their yaw in the picture's frame. */
  turnTo(face) {
    if (!face) return;
    const inv = _m.copy(this.root.matrixWorld).invert();
    const p = _v.copy(face).applyMatrix4(inv);
    for (const L of this.layout ?? []) {
      const f = this.figures[L.id];
      if (!f) continue;
      const yaw = Math.atan2(p.x - f.object.position.x, p.z - f.object.position.z);
      f.object.rotation.set(0, yaw, 0);
    }
  }

  update(dt) {
    HOLO.uniforms.uTime.value += dt;
    if (!this.root.visible) return;
    const rate = this.target > this.k ? 1 / HOLO_RISE : 1 / HOLO_FOLD;
    this.k = THREE.MathUtils.clamp(this.k + Math.sign(this.target - this.k) * rate * dt, 0, 1);
    if (this.k <= 0 && this.target === 0) { this.root.visible = false; return; }
    // a short tear now and then, more when it is torn up
    if ((this.spikeT -= dt) <= 0) { this.spike = 0.35 + Math.random() * 0.4; this.spikeT = 2.5 + Math.random() * 4; }
    this.spike = Math.max(0, this.spike - dt * 3);
    const g = Math.min(1, this.glitchK + (this.spike > 0.2 ? this.spike : 0) + (1 - this.k) * 0.3);
    this.place();
    const face = this.facePoint();
    this.turnTo(face);
    this.root.updateMatrixWorld(true);
    const e = this.k * this.k * (3 - 2 * this.k);
    const y0 = this.root.matrixWorld.elements[13], top = y0 + this.top * this.scale;
    const speaker = this.speaker ? this.figures[this.speaker] : null;
    const other = speaker?.object.visible ? speaker.char.head.getWorldPosition(_o) : null;
    for (const L of this.layout ?? []) {
      const f = this.figures[L.id];
      if (!f) continue;
      const talking = this.speaker === L.id;
      f.update(dt, { talking, face, other: talking ? null : other });
      f.u.uAlpha.value = e;
      f.u.uGlitch.value = g;
      f.u.uSpan.value.set(y0, top);
      f.u.uLocal.value.copy(f.object.matrixWorld).invert();
    }
    this.beamU.uAlpha.value = e;
    this.beamU.uGlitch.value = g;
    this.beamU.uSpan.value.set(y0, top);
    this.beamU.uScale.value = 30 * this.scale;
  }
}
