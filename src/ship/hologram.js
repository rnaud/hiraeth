import * as THREE from 'three';
import { buildCharacter } from '../player.js';
import { Humanoid } from '../humanoid.js';
import { Animator } from '../animator.js';
import { namedLook } from '../costumes.js';

// The recordings' hologram (src/story/calls.js): the parents, as they were when
// they made them, standing in a cone of light over the projector on the dash.
//
// The figures are the game's own people (the human body, dressed by
// costumes.js, played by the mocap library: idle, and the talking clip with its
// hand gestures while they speak), drawn with a light material of their own:
// translucent teal-cyan, brighter at the rims, scanlines climbing them, a
// flicker, a slice now and then sliding sideways (the glitch), eyes and a mouth
// that opens as they talk. They are not in the G-buffer: they are light, not
// ink. HOLO.scene is drawn after the Moebius composite (src/main.js renderFrame,
// like the wind-blown sand), additively, and tests itself against the G-buffer's
// depth so the traveller in front of it (and the dash) still hide it.
//
//   const holo = new Hologram({ lib, humans });       // lib: loadAnimationLibrary(), humans: [m, f] templates
//   holo.show({ parent: model.group, at, scale, who: 'both' })   // 'father' | 'mother' | 'both' | 'three'
//   holo.speak('father')                              // who is talking (null: nobody)
//   holo.glitch(1)                                    // tear it up (the impact)
//   holo.hide()                                       // folds away over HOLO_FOLD seconds
//   holo.update(dt)                                   // every frame

export const HOLO_COLOR = '#6ff0e4';
/** Seconds the picture takes to rise, and to fold away. */
export const HOLO_RISE = 0.9, HOLO_FOLD = 0.7;

/** The layer drawn after the composite: its scene and the uniforms main.js keeps up to date. */
export const HOLO = {
  scene: new THREE.Scene(),
  uniforms: { tNormal: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 } },
  /** Anything to draw this frame. */
  live() { return this.scene.children.some((c) => c.visible); },
};

// the faces, in the reshaped bind pose (humanoid.js faceAfterReshape): eye height, eye spacing, mouth height
export const FACES = { m: [1.699, 0.0288, 1.607], f: [1.656, 0.0288, 1.568] };

const vertexShader = /* glsl */ `
  #include <skinning_pars_vertex>
  uniform float uTime;
  uniform float uGlitch;
  uniform float uSeed;
  out vec3 vWorld;
  out vec3 vNormalW;
  out vec3 vBind;
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
    vec4 wp = modelMatrix * vec4(transformed, 1.0);
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

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D tNormal;
  uniform vec2 uRes;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uAlpha;      // 0 .. 1: rising / folding
  uniform float uGlitch;
  uniform float uSeed;
  uniform float uTalk;       // 0 .. 1: the mouth
  uniform vec4 uFace;        // eye y, eye x, mouth y, on (bind pose, metres)
  uniform vec2 uSpan;        // world y of the projector and the figure's top: it rises from the bottom
  in vec3 vWorld;
  in vec3 vNormalW;
  in vec3 vBind;
  in float vDepth;
  out highp vec4 fragColor;
  float line(float d, float w) { return 1.0 - smoothstep(w * 0.5, w, d); }
  void main() {
    float scene = texture(tNormal, gl_FragCoord.xy / uRes).w;
    if (scene > 0.0 && vDepth > scene + 0.04) discard;   // behind the traveller, the dash: hidden
    float h = clamp((vWorld.y - uSpan.x) / max(uSpan.y - uSpan.x, 0.01), 0.0, 1.0);
    // it builds from the projector up as it rises, and folds back down
    float reveal = smoothstep(h - 0.05, h + 0.05, uAlpha * 1.15 - 0.075);
    if (reveal <= 0.001) discard;
    vec3 V = normalize(cameraPosition - vWorld);
    float ndv = abs(dot(normalize(vNormalW), V));
    float rim = pow(1.0 - ndv, 2.2);
    float body = 0.24 + 1.0 * rim;
    // scanlines climbing the figure, and a brighter band rolling up now and then
    float scan = 0.62 + 0.38 * smoothstep(-0.3, 0.7, sin(vWorld.y * 260.0 - uTime * 7.0));
    float roll = 1.0 + 0.7 * smoothstep(0.9, 1.0, 1.0 - abs(fract(vWorld.y * 0.9 - uTime * 0.28) - 0.5) * 2.0);
    float flicker = 0.86 + 0.14 * sin(uTime * 61.0 + uSeed) * sin(uTime * 7.3 + uSeed * 3.0) - uGlitch * 0.35 * step(0.6, fract(uTime * 11.0 + uSeed));
    // the face: two eyes and a mouth that opens as they talk (darker: less light)
    float ink = 0.0;
    if (uFace.w > 0.5 && vBind.z > 0.045 && abs(vBind.y - uFace.x + 0.05) < 0.11) {
      vec2 p = vBind.xy;
      vec2 e = vec2(abs(p.x) - uFace.y, (p.y - uFace.x) * 1.7);
      ink = max(ink, line(length(e), 0.011));
      vec2 b = vec2(abs(p.x) - uFace.y, p.y - uFace.x - 0.022 + 0.004 * abs(p.x) / uFace.y);
      ink = max(ink, line(abs(b.y), 0.006) * step(abs(b.x), 0.02));   // brows
      vec2 m = vec2(p.x / 0.021, (p.y - uFace.z) / (0.0028 + 0.012 * uTalk));
      ink = max(ink, 1.0 - smoothstep(0.75, 1.0, length(m)));
    }
    float k = body * scan * roll * flicker * (1.0 - 0.8 * ink);
    // a bright seam where it is building
    float seam = smoothstep(0.04, 0.0, abs(h - (uAlpha * 1.15 - 0.075))) * step(uAlpha, 0.999);
    vec3 col = uColor * k + vec3(0.8, 1.0, 1.0) * seam * 0.8;
    float a = reveal;
    // premultiplied light, and a little dimming of what is behind (CustomBlending: ONE, ONE_MINUS_SRC_ALPHA)
    fragColor = vec4(col * a * 1.25, (0.32 + 0.3 * rim) * a);
  }
`;

// the cone of light from the projector, and its base ring: brighter low down, streaked, fading up
const coneFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tNormal;
  uniform vec2 uRes;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uGlitch;
  uniform float uSeed;
  uniform float uTalk;
  uniform vec4 uFace;
  uniform vec2 uSpan;
  in vec3 vWorld;
  in vec3 vNormalW;
  in vec3 vBind;
  in float vDepth;
  out highp vec4 fragColor;
  void main() {
    float scene = texture(tNormal, gl_FragCoord.xy / uRes).w;
    if (scene > 0.0 && vDepth > scene + 0.04) discard;
    float h = clamp((vWorld.y - uSpan.x) / max(uSpan.y - uSpan.x, 0.01), 0.0, 1.2);
    float ang = atan(vBind.x, vBind.z);
    float streak = 0.55 + 0.45 * sin(ang * 23.0 + uTime * 1.3) * sin(ang * 9.0 - uTime * 0.7);
    vec3 V = normalize(cameraPosition - vWorld);
    float edge = pow(1.0 - abs(dot(normalize(vNormalW), V)), 1.5);
    float k = (1.0 - smoothstep(0.0, 1.05, h)) * (0.25 + 0.75 * edge) * streak;
    k *= 0.85 + 0.15 * sin(uTime * 47.0 + uSeed);
    k *= uAlpha * (1.0 - 0.5 * uGlitch);
    fragColor = vec4(uColor * k * 0.38, 0.0);
  }
`;

const ringFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tNormal;
  uniform vec2 uRes;
  uniform float uTime;
  uniform vec3 uColor;
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
    fragColor = vec4(uColor * k * 0.8, 0.0);
  }
`;

// dust in the beam: points drifting up through the cone
const motesVertex = /* glsl */ `
  uniform float uTime;
  uniform float uAlpha;
  uniform float uScale;
  in float aSeed;
  out float vK;
  out float vDepth;
  void main() {
    float t = fract(aSeed * 7.31 + uTime * (0.06 + 0.05 * fract(aSeed * 3.7)));
    float a = aSeed * 40.0 + uTime * 0.3;
    float r = (0.15 + 0.7 * t) * (0.3 + 0.7 * fract(aSeed * 11.3));
    vec3 p = vec3(cos(a) * r, t * 1.9, sin(a) * r);
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
  uniform vec3 uColor;
  in float vK;
  in float vDepth;
  out highp vec4 fragColor;
  void main() {
    float scene = texture(tNormal, gl_FragCoord.xy / uRes).w;
    if (scene > 0.0 && vDepth > scene + 0.04) discard;
    float d = length(gl_PointCoord - 0.5);
    fragColor = vec4(uColor * vK * (1.0 - smoothstep(0.2, 0.5, d)), 0.0);
  }
`;

/** One light material; `u` holds the uniforms it shares with its figure (talk, face, fade). */
function lightMaterial(u, frag = fragmentShader, vert = vertexShader, o = {}) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: { ...HOLO.uniforms, ...u },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: o.side ?? THREE.FrontSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}

/** The uniforms a figure (or the beam) owns. */
function ownUniforms(seed, face = null) {
  return {
    uColor: { value: new THREE.Color(HOLO_COLOR) },
    uAlpha: { value: 0 },
    uGlitch: { value: 0 },
    uSeed: { value: seed },
    uTalk: { value: 0 },
    uFace: { value: new THREE.Vector4(...(face ?? [0, 0, 0]), face ? 1 : 0) },
    uSpan: { value: new THREE.Vector2(0, 1) },
  };
}

/** How open the mouth is, t seconds into a line (0 when silent). */
export function mouthOpen(t, talking) {
  if (!talking) return 0;
  return Math.max(0, Math.min(1, Math.sin(t * 17) * 0.5 + Math.sin(t * 7.3) * 0.35 + 0.25));
}

/** Where the figures stand on the projector (root space, before its scale), and which way they turn. */
export function holoLayout(who) {
  if (who === 'three') return [{ id: 'father', x: -0.5, yaw: 0.1 }, { id: 'child', x: 0, z: 0.12, yaw: 0 }, { id: 'mother', x: 0.5, yaw: -0.1 }];
  if (who === 'both') return [{ id: 'father', x: -0.42, yaw: 0.14 }, { id: 'mother', x: 0.42, yaw: -0.14 }];
  return [{ id: who === 'mother' ? 'mother' : 'father', x: 0, yaw: 0 }];
}

// who they were: as they are drawn at home (src/levels/home.js), younger
const PEOPLE = {
  father: { kind: 'm', scale: 1, palette: { cloak: '#f3ead8', cloth: '#b5473a', legs: '#2b2f45', hat: '#3d4a80', hair: '#b8b0a4' },
    look: { head: 'wrap', mask: 'none', body: 'collar', prop: 'none', trim: 'none', robe: 0.5, flare: 0.25 } },
  mother: { kind: 'f', scale: 1, palette: { cloak: '#277e86', cloth: '#d9503f', legs: '#34405e', hat: '#5fb7ad', hair: '#5a4038' },
    look: { head: 'headcloth', mask: 'none', body: 'scarf', prop: 'none', trim: 'none', robe: 0.3, flare: 0.3 } },
  child: { kind: 'm', scale: 0.56, palette: { cloak: '#4f8fa8', cloth: '#f2c54b', legs: '#34405e', hair: '#8a5638' },
    look: { head: 'short', mask: 'none', body: 'none', prop: 'none', trim: 'none', robe: 0 } },
};

/** One person on the hologram: a dressed body with the light material, played by the mocap library. */
export class HoloFigure {
  constructor(id, { lib, humans }) {
    const P = PEOPLE[id];
    this.id = id;
    this.kind = P.kind;
    this.char = buildCharacter(P.palette);
    this.object = this.char.root;
    this.object.scale.setScalar(P.scale);
    this.humanoid = new Humanoid(humans[P.kind === 'm' ? 0 : 1], this.char, P.kind, { skin: '#e8c6a8' });
    this.humanoid.dress(namedLook({ world: 'home', id: `holo-${id}`, palette: P.palette, look: P.look }));
    this.animator = lib ? new Animator(lib, this.char) : null;
    if (this.animator) this.animator.phase = Math.random();
    this.u = ownUniforms(Math.random() * 10, FACES[P.kind]);
    const skinned = lightMaterial(this.u);
    const rigid = lightMaterial({ ...this.u, uFace: { value: new THREE.Vector4() } });
    const model = this.humanoid.model;
    this.char.root.traverse((o) => {
      if (!o.isMesh) return;
      // only the body and its costume: the rig's own parts (hood, pack, jets) stay hidden
      if (!model.getObjectById(o.id)) { o.visible = false; return; }
      o.material = o.isSkinnedMesh ? skinned : rigid;
      o.frustumCulled = false;
    });
    this.t = 0;
    this.talk = false;
  }

  update(dt, { talking = false } = {}) {
    this.t += dt;
    const c = this.char, a = this.animator;
    if (a) {
      const N = a.lib.native;
      a.update(dt, { speed: 0, onGround: true, mode: talking ? 'talk' : 'ground', walkAt: N.walk * 1.3, jogAt: N.jog, sprintAt: N.sprint * 1.2, strideScale: 1.05 });
      a.apply(c.root, { legScale: 1.04 });
    }
    // a small nod on the stressed words
    c.head.rotateX(talking ? Math.sin(this.t * 5.3) * 0.05 : Math.sin(this.t * 0.7) * 0.015);
    this.humanoid.update();
    this.u.uTalk.value = mouthOpen(this.t, talking);
  }
}

/**
 * The picture: up to three figures, the beam and the projector's ring. It is placed in the
 * frame of `parent` (the ship's group, or the stone at home) at `at`, scaled.
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
    this.beamU = ownUniforms(3.7);
    const cone = new THREE.CylinderGeometry(1.0, 0.16, 2.0, 40, 1, true).translate(0, 1.0, 0);
    this.beam = new THREE.Mesh(cone, lightMaterial(this.beamU, coneFragment, vertexShader, { side: THREE.DoubleSide }));
    this.ring = new THREE.Mesh(new THREE.CircleGeometry(0.5, 40).rotateX(-Math.PI / 2).translate(0, 0.02, 0), lightMaterial(this.beamU, ringFragment, vertexShader, { side: THREE.DoubleSide }));
    const n = 70, seeds = new Float32Array(n), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) seeds[i] = Math.random();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.motesU = { uScale: { value: 30 } };
    this.motes = new THREE.Points(g, lightMaterial({ ...this.beamU, ...this.motesU }, motesFragment, motesVertex));
    for (const o of [this.beam, this.ring, this.motes]) { o.frustumCulled = false; this.root.add(o); }
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
   * @param o { parent: Object3D whose frame it stands in, at: Vector3 there, scale (1: life size),
   *            yaw (rad, turns it in that frame), who: 'father' | 'mother' | 'both' | 'three' }
   */
  show({ parent, at, scale = 0.5, yaw = 0, who = 'father' }) {
    this.parent = parent;
    this.local.compose(at.clone(), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(scale, scale, scale));
    this.scale = scale;
    this.layout = holoLayout(who);
    this.who = who;
    for (const f of Object.values(this.figures)) f.object.visible = false;
    for (const L of this.layout) {
      const f = this.figure(L.id);
      if (!f) continue;
      f.object.visible = true;
      f.object.position.set(L.x, 0.04, L.z ?? 0);
      f.object.rotation.set(0, L.yaw, 0);
    }
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
    const e = this.k * this.k * (3 - 2 * this.k);
    const y0 = this.root.matrixWorld.elements[13], top = y0 + 1.95 * this.scale;
    for (const L of this.layout ?? []) {
      const f = this.figures[L.id];
      if (!f) continue;
      f.update(dt, { talking: this.speaker === L.id });
      f.u.uAlpha.value = e;
      f.u.uGlitch.value = g;
      f.u.uSpan.value.set(y0, top);
    }
    this.beamU.uAlpha.value = e;
    this.beamU.uGlitch.value = g;
    this.beamU.uSpan.value.set(y0, top);
    this.motesU.uScale.value = 30 * this.scale;
  }
}
