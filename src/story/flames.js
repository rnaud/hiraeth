import * as THREE from 'three';
import { makeMaterial } from '../materials.js';

// Stylised fire: tongues of flat colour bands that lick, sway and flicker.
// Each tongue is a little lathe whose vertices move every frame; their
// colour runs up a gradient (core → tip) that wavers, and the material
// snaps it to the palette's inks, so the bands stay crisp and flat like a
// printed flame. Ember motes drift up from the tips.

export const FIRE = ['#fff3c4', '#f9d36a', '#f0a04b', '#e0644a', '#b8433f'];
// the burning tree when it drinks: the fire turns cool and many-coloured
export const COOL_FIRE = ['#fff6dc', '#9ff0e6', '#62c3c9', '#a99be0', '#e88fa6'];

const _a = new THREE.Color(), _b = new THREE.Color(), _c = new THREE.Color();
const SEG = 10, RINGS = 9;

function gradient(palette, v, out) {
  const n = palette.length;
  v = Math.min(Math.max(v, 0), 0.9999) * (n - 1);
  const j = Math.floor(v);
  return out.copy(palette[j]).lerp(palette[Math.min(j + 1, n - 1)], v - j);
}

/**
 * A set of flame tongues in one mesh.
 * tongues: [{ at: Vector3 (base, local to `parent`), h, r, phase?, lean?: Vector3, core?: 0..1 }]
 */
export class Flames {
  constructor(parent, tongues, { palette = FIRE, seed = 0 } = {}) {
    this.tongues = tongues.map((t, i) => ({ phase: i * 1.7 + seed, lean: new THREE.Vector3(), core: 0, ...t }));
    const per = (SEG + 1) * (RINGS + 1);
    const n = this.tongues.length * per;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const idx = [];
    this.tongues.forEach((tg, k) => {
      const o = k * per;
      for (let j = 0; j < RINGS; j++) for (let i = 0; i < SEG; i++) {
        const a = o + j * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    this.geo = g;
    this.palA = palette.map((c) => new THREE.Color(c));
    this.palB = this.palA.map((c) => c.clone());
    this.pal = this.palA.map((c) => c.clone());
    this.mix = 0;
    this.material = makeMaterial({ color: '#ffffff', glow: 1, flat: true, vertexColors: true, palette, side: THREE.DoubleSide, flames: seed });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.userData.noCollide = true;
    parent.add(this.mesh);
    this.intensity = 1;
    this.update(0, 0);
    // the tongues sway a little: a generous bound once, so the mesh can still be culled
    g.computeBoundingSphere();
    g.boundingSphere.radius *= 1.4;
  }

  /** Move toward another palette over time (setPalette(COOL_FIRE)). */
  setPalette(p, instant = false) {
    this.palA = this.pal.map((c) => c.clone());
    this.palB = p.map((c) => new THREE.Color(c));
    this.mix = 0; this.snap = instant;   // instant: the next update lands on the new palette at once
  }

  update(dt, t) {
    if (this.mix < 1) {
      this.mix = this.snap ? 1 : Math.min(1, this.mix + dt / 3);
      const P = this.material.uniforms.uPalette.value;
      for (let i = 0; i < this.pal.length; i++) { this.pal[i].copy(this.palA[i]).lerp(this.palB[i], this.mix); P[i].copy(this.pal[i]); }
      this.material.uniforms.uPaletteSize.value = this.pal.length;
    }
    const P = this.geo.attributes.position.array, N = this.geo.attributes.normal.array, C = this.geo.attributes.color.array;
    const K = this.intensity;
    let v = 0;
    for (const tg of this.tongues) {
      const ph = tg.phase, R = tg.r * (0.85 + 0.15 * K), H = tg.h * (0.8 + 0.2 * K) * (1 + 0.07 * Math.sin(t * 1.7 + ph) + 0.04 * Math.sin(t * 4.3 + ph * 2));
      const sx = (Math.sin(t * 1.1 + ph) * 0.3 + Math.sin(t * 2.3 + ph * 1.7) * 0.14) * R + tg.lean.x;
      const sz = (Math.cos(t * 0.9 + ph * 1.3) * 0.3 + Math.sin(t * 2.9 + ph * 0.6) * 0.12) * R + tg.lean.z;
      for (let j = 0; j <= RINGS; j++) {
        const s = j / RINGS;
        const prof = s < 0.22 ? Math.sqrt(s / 0.22) : 1 - Math.pow((s - 0.22) / 0.78, 1.25);
        const bend = Math.pow(s, 1.6);
        for (let i = 0; i <= SEG; i++, v++) {
          const a = (i / SEG) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
          const lick = 1 + 0.2 * Math.sin(t * 3.1 + a * 2 + s * 7 + ph) * s + 0.08 * Math.sin(t * 6.7 - a * 3 + ph);
          const r = R * prof * lick;
          const o = v * 3;
          P[o] = tg.at.x + ca * r + sx * bend;
          P[o + 1] = tg.at.y + s * H;
          P[o + 2] = tg.at.z + sa * r + sz * bend;
          N[o] = ca; N[o + 1] = 0.3; N[o + 2] = sa;
          // colour: up the gradient, wavering; the inner tongues stay in the hot core
          const w = s * (1 - tg.core * 0.55) + 0.13 * Math.sin(t * 2.4 + a * 3 + ph) + 0.09 * Math.sin(t * 4.1 - s * 9 + ph) - 0.06;
          gradient(this.pal, w, _c);
          C[o] = _c.r; C[o + 1] = _c.g; C[o + 2] = _c.b;
        }
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// One great flame, drawn by a shader rather than built of meshes: the burning
// tree's fire. A single upright card that turns to face the camera (about the
// vertical only, so it never tips over), on which a fragment shader paints a
// flame as Moebius would: a few flat bands of colour from a pale core out to a
// deep red rim, an inked outline, tongues that lick upward and break off near
// the top. The bands' edges are a noise field scrolled up the flame and bent by
// a slow sway, so the fire never repeats.
//
// The card writes the G-buffer like any surface (self-lit, so night does not
// dim it), with a depth that bulges toward the camera in the flame's middle:
// the tree's limbs pass into the fire instead of being cut by a flat plane.
//
// The same interface as Flames: setPalette(COOL_FIRE) eases the colours over,
// `intensity` (1 calm .. ~3 a high flare) makes it taller, wider, hotter and
// faster, update(dt, t) animates it.

const SHEET_VERT = /* glsl */ `
  uniform float uWidth, uHeight, uK;
  out vec2 vUv;
  out vec3 vView;
  out vec3 vWorld;
  void main() {
    vec3 base = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 toCam = cameraPosition - base; toCam.y = 0.0;
    vec3 right = normalize(cross(up, length(toCam) > 1e-3 ? normalize(toCam) : vec3(0.0, 0.0, 1.0)));
    // taller and a little wider when it flares
    float w = uWidth * (0.9 + 0.1 * uK), h = uHeight * (0.82 + 0.18 * uK);
    vUv = vec2(position.x * 2.0, position.y);           // x -1..1 across, y 0..1 up
    vec3 world = base + right * position.x * w + up * position.y * h;
    vWorld = world;
    vec4 mv = viewMatrix * vec4(world, 1.0);
    vView = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }`;

const SHEET_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uPal[5];
  uniform vec3 uInk;
  uniform float uTime, uK, uSeed, uBulge, uWidth;
  uniform mat4 projectionMatrix;   // (three only declares it for the vertex stage)
  in vec2 vUv;
  in vec3 vView;
  in vec3 vWorld;
  layout(location = 0) out highp vec4 gAlbedoLight;
  layout(location = 1) out highp vec4 gNormalDepth;
  layout(location = 2) out highp vec4 gHatch;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.07 + 13.3; a *= 0.5; } return s; }

  // The flame's field at (x, y): > 0 inside, ~1 at the hot heart. Its outline is a bulb low down
  // (wide enough to swallow the tree's crown) drawn up into one licking tip.
  float field(vec2 uv, float t) {
    float y = uv.y;
    float sway = (sin(t * 0.9 + uSeed) * 0.09 + sin(t * 2.3 + y * 4.0 + uSeed * 2.0) * 0.04) * y * y;
    float x = uv.x - sway;
    // a full belly low down (it swallows the crown), drawn up into a long licking point
    float bulb = pow(sin(clamp(y / 0.3, 0.0, 1.0) * 1.5708), 0.6);
    float taper = 1.0 - pow(max(y - 0.26, 0.0) / 0.74, 0.85);
    float w = mix(0.5, 1.0, bulb) * max(taper, 0.0) * 0.9;
    // turbulence scrolled up the flame: tongues licking up the sides, breaking off at the top
    float speed = 0.6 + 0.3 * uK;
    vec2 q = vec2(x * 2.8, y * 2.1 - t * speed);
    float n = fbm(q + vec2(uSeed, 0.0) + 0.7 * vec2(fbm(q * 0.6 + 3.1 - t * 0.25), 0.0));
    float lick = (n - 0.5) * (0.3 + 1.25 * y);
    // separate tongues: ridges running up the flame, rising and splitting as they go
    float tongues = sin(x * 8.5 + (n - 0.5) * 5.0 + sin(y * 3.0 - t * 1.7) * 1.2) * smoothstep(0.25, 0.9, y) * 0.32;
    float f = (w - abs(x)) / max(w, 0.05) + lick * 1.3 + tongues;
    f -= smoothstep(0.82, 1.0, y) * 1.0;   // the tip thins out
    // a rounded foot, not a cut: the sides curl in under the belly
    return f - (1.0 - smoothstep(0.0, 0.12, y - 0.09 * x * x)) * 1.4;
  }

  void main() {
    float t = uTime;
    float f = field(vUv, t);
    if (f <= 0.0) discard;
    // bands, the hot core sitting low (the heart of the fire is near its base)
    float g = f - vUv.y * 0.62 + 0.1 * (uK - 1.0);
    float fw = fwidth(g) + 1e-4;
    float b1 = smoothstep(0.12 - fw, 0.12 + fw, g), b2 = smoothstep(0.32 - fw, 0.32 + fw, g), b3 = smoothstep(0.52 - fw, 0.52 + fw, g), b4 = smoothstep(0.7 - fw, 0.7 + fw, g);
    vec3 col = uPal[4];
    col = mix(col, uPal[3], b1);
    col = mix(col, uPal[2], b2);
    col = mix(col, uPal[1], b3);
    col = mix(col, uPal[0], b4);
    // ink: a firm line round the outside, finer ones on the outer bands' edges
    float ff = fwidth(f) + 1e-4;
    float rim = 1.0 - smoothstep(ff * 1.2, ff * 2.6, f);
    float inner = (1.0 - smoothstep(fw * 0.6, fw * 1.6, abs(g - 0.12))) * 0.7 + (1.0 - smoothstep(fw * 0.6, fw * 1.6, abs(g - 0.32))) * 0.35;
    col = mix(col, uInk, clamp(max(rim, inner * smoothstep(0.1, 0.4, vUv.y)), 0.0, 1.0));
    // a volume, not a card: the middle stands out toward the camera (the limbs go into the fire)
    float bulge = uBulge * uWidth * sqrt(clamp(f, 0.0, 1.0)) * (1.0 - abs(vUv.x) * 0.5);
    vec3 v = vView + normalize(-vView) * min(bulge, -vView.z - 0.5);
    vec4 clip = projectionMatrix * vec4(v, 1.0);
    gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
    vec3 n = normalize(cameraPosition - vWorld);
    gAlbedoLight = vec4(col, 1.0);
    gNormalDepth = vec4(n, -v.z);
    gHatch = vec4(0.0, 0.0, 0.0, 1.0);   // self-lit
  }`;

export class FlameSheet {
  /**
   * @param parent  the group to hang it in
   * @param o { at: Vector3 (the base, in parent space), width, height (m), palette, seed, bulge (share of the width) }
   */
  constructor(parent, { at, width = 40, height = 50, palette = FIRE, seed = 0, bulge = 0.35 } = {}) {
    const g = new THREE.PlaneGeometry(1, 1, 1, 1).translate(0, 0.5, 0);   // x -0.5..0.5, y 0..1
    this.palA = palette.map((c) => new THREE.Color(c));
    this.palB = this.palA.map((c) => c.clone());
    this.pal = this.palA.map((c) => c.clone());
    this.mix = 1;
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG,
      side: THREE.DoubleSide,
      uniforms: {
        uPal: { value: this.pal.map((c) => c.clone()) }, uInk: { value: new THREE.Color('#2b211f') },
        uTime: { value: 0 }, uK: { value: 1 }, uSeed: { value: seed * 1.37 }, uBulge: { value: bulge },
        uWidth: { value: width }, uHeight: { value: height },
        uGlow: { value: 1 },   // (read by the shadow pass: self-lit things cast no shadow)
      },
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.name = 'Flame sheet';
    this.mesh.position.copy(at);
    this.mesh.userData.noCollide = true;
    this.mesh.userData.dynamic = true;
    this.mesh.frustumCulled = false;   // it turns to the camera in its shader: the plane's own bounds mean nothing
    parent.add(this.mesh);
    this.width = width; this.height = height;
    this.intensity = 1;
    this._k = 1;
    this.time = seed * 3.1;
    this.update(0, 0);
  }

  /** Move toward another palette over time (setPalette(COOL_FIRE)); instant lands on it at once. */
  setPalette(p, instant = false) {
    this.palA = this.pal.map((c) => c.clone());
    this.palB = p.map((c) => new THREE.Color(c));
    this.mix = 0; this.snap = instant;
  }

  update(dt, t) {
    if (this.mix < 1) {
      this.mix = this.snap ? 1 : Math.min(1, this.mix + dt / 3);
      for (let i = 0; i < this.pal.length; i++) this.pal[i].copy(this.palA[i]).lerp(this.palB[i], this.mix);
    }
    const P = this.material.uniforms.uPal.value;
    for (let i = 0; i < 5; i++) P[i].copy(this.pal[Math.min(i, this.pal.length - 1)]);
    // the flare rises fast and settles slowly; the fire runs faster when it is high
    this._k += (this.intensity - this._k) * (1 - Math.exp(-(this.intensity > this._k ? 4 : 1.5) * dt));
    this.time += dt * (0.8 + 0.35 * this._k);
    this.material.uniforms.uTime.value = this.time;
    this.material.uniforms.uK.value = this._k;
  }
}

// ------------------------------------------------------------------ the great flame, in 3D
// A real volume: three nested teardrop shells (the red outside, the orange body, the pale
// white-gold heart low down). The vertex shader lifts and bends them with rising noise into
// tongues that lick up and sway; the fragment shader paints flat comic bands that climb and
// flicker, and opens holes in the outer shells toward the top so the tongues split apart and the
// hotter layers show through. Self-lit in the G-buffer (it glows, casts no shadow, and the ink
// pass outlines each shell like everything else).
const BODY_NOISE = /* glsl */ `
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise3(p); p = p * 2.03 + 7.7; a *= 0.5; } return s; }`;

const BODY_VERT = /* glsl */ `
  uniform float uTime, uK, uSeed, uShell;
  out vec3 vWorld;
  out vec3 vNormalW;
  out vec3 vObj;
  out float vViewDepth;
  ${BODY_NOISE}
  void main() {
    vec3 p = position;                       // a unit teardrop: y 0..1, radius under 0.5
    float y = clamp(p.y, 0.0, 1.0), t = uTime;
    vec3 out_ = vec3(p.x, 0.0, p.z);
    float r = length(out_);
    vec3 dir = r > 1e-4 ? out_ / r : vec3(0.0);
    // rising turbulence: bulges and tongues climbing the sides, faster when it flares
    float speed = 0.9 + 0.45 * uK;
    float ang = atan(p.z, p.x);
    // around the flame several tongues (noise in the angle), climbing (noise in height minus time)
    vec3 q = vec3(cos(ang) * 1.6 + uSeed, y * 2.8 - t * speed, sin(ang) * 1.6 - uSeed);
    float n = fbm3(q);
    float ridge = 1.0 - abs(fbm3(q * 1.9 + 4.2) * 2.0 - 1.0);   // sharp crests: separate tongues
    float lick = (n - 0.45) * (0.2 + 0.9 * y) + (ridge - 0.5) * 0.35 * y;
    p.xz += dir.xz * lick * 0.5;
    p.y += max(0.0, n - 0.48) * 1.1 * y * y + max(0.0, ridge - 0.6) * 0.45 * y;   // tongues reach up past the tip
    // the whole flame sways, more at the top, and leans with the flare
    float sway = (sin(t * 0.9 + uSeed) * 0.07 + sin(t * 2.4 + y * 4.0 + uSeed * 2.0) * 0.035) * y * y;
    p.x += sway; p.z += sway * 0.6 * cos(uSeed);
    vObj = vec3(position.x, y, position.z);
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normalize(normal + vec3(dir.x, 0.0, dir.z) * lick * 1.5));
    vec4 mv = viewMatrix * world;
    vViewDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

const BODY_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uPal[5];
  uniform float uTime, uK, uSeed, uShell, uTorn;
  in vec3 vWorld;
  in vec3 vNormalW;
  in vec3 vObj;
  in float vViewDepth;
  layout(location = 0) out highp vec4 gAlbedoLight;
  layout(location = 1) out highp vec4 gNormalDepth;
  layout(location = 2) out highp vec4 gHatch;
  ${BODY_NOISE}
  void main() {
    float y = vObj.y, t = uTime;
    float a = atan(vObj.z, vObj.x);
    // flicker: bands climbing the surface, broken by noise
    float n = fbm3(vec3(cos(a) * 2.2 + uSeed, y * 3.6 - t * (1.5 + 0.5 * uK), sin(a) * 2.2));
    // the outer shells are torn open, more toward the top: tongues split apart and the hotter
    // layers show through (the red outside the most, the body less, the heart never)
    float open = uShell < 0.5 ? 0.0 : (uShell > 1.5 ? 0.3 + 0.55 * smoothstep(0.1, 0.9, y) : 0.12 + 0.45 * smoothstep(0.2, 0.95, y));
    open *= uShell > 1.5 ? uTorn : mix(1.0, 0.3, step(uTorn, 0.99));   // (the outside torn as asked; the body kept nearly whole when the flame must hide what burns)
    if (n < open) discard;
    // which tone: hotter toward the heart (inner shells) and low down, cooler up and at the edges
    float heat = (2.0 - uShell) * 0.42 + (1.0 - y) * 0.35 + (n - 0.5) * 0.7 + 0.08 * (uK - 1.0);
    float fw = fwidth(heat) + 1e-4;
    vec3 col = uPal[4];
    col = mix(col, uPal[3], smoothstep(0.18 - fw, 0.18 + fw, heat));
    col = mix(col, uPal[2], smoothstep(0.4 - fw, 0.4 + fw, heat));
    col = mix(col, uPal[1], smoothstep(0.62 - fw, 0.62 + fw, heat));
    col = mix(col, uPal[0], smoothstep(0.84 - fw, 0.84 + fw, heat));
    gAlbedoLight = vec4(col, 1.0);                         // full light: it is the light
    gNormalDepth = vec4(normalize(gl_FrontFacing ? vNormalW : -vNormalW), vViewDepth);
    gHatch = vec4(0.0, 0.0, 0.0, 1.0);                    // self-lit, no hatching
  }`;

/**
 * A unit flame shape (y 0..1): a full belly drawn up into a point. belly: how high the widest
 * part reaches (a crown fire that swallows a whole tree holds its width higher up).
 */
export function flameProfile(n = 28, belly = 0.32) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const y = i / n;
    const bulb = Math.pow(Math.sin(Math.min(y / belly, 1) * Math.PI / 2), 0.55);
    const taper = Math.pow(Math.max(0, 1 - Math.max(0, y - belly * 0.9) / (1 - belly * 0.9)), 0.95);
    pts.push(new THREE.Vector2(Math.max(0.002, 0.5 * bulb * taper), y));
  }
  return pts;
}

export class FlameBody {
  /**
   * @param parent  the group to hang it in
   * @param o { at: Vector3 (the base, in parent space), width, height (m), palette, seed }
   */
  constructor(parent, { at, width = 40, height = 50, palette = FIRE, seed = 0, belly = 0.32, pace = 0.5, torn = 1, cover = 0 } = {}) {
    // cover: 0 the inner layers sit low in the heart; 1 they fill nearly the whole flame (so what the
    // torn outside shows is more fire, not what burns inside it: the tree's limbs)
    this.pace = pace;   // how fast the fire runs (1: lively; a great slow fire is about half)
    this.palA = palette.map((c) => new THREE.Color(c));
    this.palB = this.palA.map((c) => c.clone());
    this.pal = this.palA.map((c) => c.clone());
    this.mix = 1;
    this.group = new THREE.Group();
    this.group.name = 'Flame';
    this.group.position.copy(at);
    this.group.userData.noCollide = true;
    parent.add(this.group);
    const geo = new THREE.LatheGeometry(flameProfile(28, belly), 40);
    this.uniforms = { uPal: { value: this.pal.map((c) => c.clone()) }, uTime: { value: 0 }, uK: { value: 1 }, uTorn: { value: torn } };
    this.materials = [];
    // the shells: outside (0, red, open at the top), body (1), heart (2, low and pale)
    for (const [shell, sw, sh] of [[0, 1, 1], [1, 0.9 * cover + 0.78 * (1 - cover), 0.92 * cover + 0.8 * (1 - cover)], [2, 0.66 * cover + 0.5 * (1 - cover), 0.62 * cover + 0.52 * (1 - cover)]]) {
      const m = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3, vertexShader: BODY_VERT, fragmentShader: BODY_FRAG, side: THREE.DoubleSide,
        uniforms: { uPal: this.uniforms.uPal, uTime: this.uniforms.uTime, uK: this.uniforms.uK, uTorn: this.uniforms.uTorn,
          uSeed: { value: seed * 1.37 + shell * 2.1 }, uShell: { value: 2 - shell }, uGlow: { value: 1 } },
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.scale.set(width * sw, height * sh, width * sw);
      mesh.userData.noCollide = true; mesh.userData.dynamic = true;
      mesh.frustumCulled = false;   // displaced in the shader
      this.group.add(mesh);
      this.materials.push(m);
    }
    this.mesh = this.group;
    this.material = this.materials[0];   // (shared uniforms: uPal, uTime, uK)
    this.width = width; this.height = height;
    this.intensity = 1;
    this._k = 1;
    this.time = seed * 3.1;
    this.update(0, 0);
  }

  /** Move toward another palette over time (setPalette(COOL_FIRE)); instant lands on it at once. */
  setPalette(p, instant = false) {
    this.palA = this.pal.map((c) => c.clone());
    this.palB = p.map((c) => new THREE.Color(c));
    this.mix = 0; this.snap = instant;
  }

  update(dt) {
    if (this.mix < 1) {
      this.mix = this.snap ? 1 : Math.min(1, this.mix + dt / 3);
      for (let i = 0; i < this.pal.length; i++) this.pal[i].copy(this.palA[i]).lerp(this.palB[i], this.mix);
    }
    const P = this.uniforms.uPal.value;
    for (let i = 0; i < 5; i++) P[i].copy(this.pal[Math.min(i, this.pal.length - 1)]);
    // the flare rises fast and settles slowly; the fire runs faster and grows when it is high
    this._k += (this.intensity - this._k) * (1 - Math.exp(-(this.intensity > this._k ? 4 : 1.5) * dt));
    this.time += dt * (0.8 + 0.35 * this._k) * this.pace;
    this.uniforms.uTime.value = this.time;
    this.uniforms.uK.value = this._k;
    const g = 0.9 + 0.1 * this._k;
    this.group.scale.set(g, 0.82 + 0.18 * this._k, g);
  }
}

/** Glowing motes drifting up from points (the tree's crown, a camp fire). */
export class Embers {
  constructor(parent, sources, { count = 120, color = '#f9d36a', rise = 2.2, life = 5, spread = 1.5, size = 0.12 } = {}) {
    this.sources = sources;
    this.rise = rise; this.life = life; this.spread = spread;
    this.mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(size, 0), makeMaterial({ color, glow: 1, flat: true }), count);
    this.mesh.userData.noCollide = true;
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
    this.items = Array.from({ length: count }, (_, i) => this.spawn({ age: Math.random() * life }, i));
    this.dummy = new THREE.Object3D();
    this.rate = 1;
  }
  spawn(it, i) {
    const s = this.sources[i % this.sources.length];
    it.pos = (it.pos ?? new THREE.Vector3()).copy(s).add(new THREE.Vector3((Math.random() - 0.5) * this.spread * 2, Math.random() * this.spread, (Math.random() - 0.5) * this.spread * 2));
    it.vel = (it.vel ?? new THREE.Vector3()).set((Math.random() - 0.5) * 0.6, this.rise * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * 0.6);
    it.age = it.age ?? 0;
    it.max = this.life * (0.6 + Math.random() * 0.8);
    it.ph = Math.random() * 10;
    return it;
  }
  update(dt, t, wind = null) {
    const d = this.dummy;
    this.items.forEach((it, i) => {
      it.age += dt * this.rate;
      if (it.age > it.max) { it.age = 0; this.spawn(it, i); }
      it.pos.addScaledVector(it.vel, dt * this.rate);
      it.pos.x += Math.sin(t * 1.3 + it.ph) * dt * 0.8 + (wind ? wind.x * dt * 0.25 : 0);
      it.pos.z += Math.cos(t * 1.1 + it.ph) * dt * 0.8 + (wind ? wind.z * dt * 0.25 : 0);
      const k = it.age / it.max, s = Math.sin(Math.PI * Math.min(k, 1)) * (0.6 + 0.4 * Math.sin(t * 9 + it.ph));
      d.position.copy(it.pos);
      d.rotation.set(t + it.ph, t * 1.3, 0);
      d.scale.setScalar(Math.max(s, 0.001));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** A thin column of smoke: small pale puffs drifting up and leaning with the wind, thinning as they rise. */
export class Smoke {
  constructor(parent, at, { count = 34, height = 16, size = 0.75, color = '#efe6d6', lean = new THREE.Vector3(1, 0, 0.4) } = {}) {
    this.at = at.clone(); this.height = height; this.size = size; this.lean = lean.clone().normalize();
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), makeMaterial({ color, glow: 0.8, flat: true }), count);
    this.mesh.userData.noCollide = true;
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
    this.items = Array.from({ length: count }, (_, i) => ({ u: i / count, ph: Math.random() * 10, s: 0.6 + Math.random() * 0.8, o: (Math.random() - 0.5) * 0.8 }));
    this.dummy = new THREE.Object3D();
    this.update(0, 0);
  }
  update(dt, t, wind = null) {
    const d = this.dummy, H = this.height;
    const lx = wind ? wind.x * 0.4 + this.lean.x : this.lean.x, lz = wind ? wind.z * 0.4 + this.lean.z : this.lean.z;
    this.items.forEach((it, i) => {
      it.u += dt / 11;
      if (it.u > 1) it.u -= 1;
      const u = it.u, y = u * H;
      const sway = Math.sin(t * 0.5 + u * 4 + it.ph * 0.2) * 1.3 * u + it.o * u;
      d.position.set(this.at.x + lx * u * u * H * 0.45 + sway, this.at.y + y, this.at.z + lz * u * u * H * 0.45 + Math.cos(t * 0.45 + u * 3) * 0.9 * u + it.o * u);
      d.scale.set(1.25, 0.8, 1.1).multiplyScalar(this.size * it.s * (0.35 + u * 1.5) * Math.sin(Math.PI * Math.min(u * 1.1, 1)) + 0.001);
      d.rotation.set(it.ph, t * 0.1 + it.ph, 0);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// The burning tree's landmark smoke: pale, slightly warm greys by day; when the
// tree drinks, the pale cool tints of its new fire.
export const SMOKE_WARM = ['#f5efe3', '#ece4d5', '#e2d9c8', '#d8cebd'];
export const SMOKE_COOL = ['#f2f8f2', '#d9f1ee', '#cfe6ee', '#e3dcf5', '#f6e1ea', '#fff4e2'];

const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
const RISE = 0.62;   // the share of the path that climbs; the rest is the drifting plume
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

/**
 * A landmark: a tall column of light smoke rising hundreds of metres from a
 * fire, bending gently downwind and flattening into a long thin drifting
 * plume at altitude, so the fire can be found from anywhere on the plain.
 *
 * One instanced mesh of inked puffs. Each puff runs along the column's path
 * (s = 0 at the fire, 1 at the end of the plume), swelling as it rises and
 * shrinking away at the end (the G-buffer has no transparency, so smoke fades
 * by size). The path is a function of the (smoothed) wind, so nothing is
 * rebuilt per frame: only the instance matrices (and, while the colours
 * change, the instance colours) are written.
 *
 * Far shading: the column's material writes a compressed view depth into the
 * G-buffer past `farNear` metres, so the distance fog and the line fade
 * (post.js) treat it as if it stood a few hundred metres away and it stays
 * readable from kilometres off. The real depth buffer is untouched, so it
 * still hides behind dunes and walls.
 */
export class SmokeColumn {
  constructor(parent, at, { count = 340, height = 430, drift = 520, base = 5.5, top = 22, period = 170, palette = SMOKE_WARM, tint = FIRE[1], farNear = 260, farScale = 0.2, glow = 0.92 } = {}) {   // nearly self-lit: one flat soft tone, no shadow crescent on every puff
    this.at = at.clone();
    this.height = height; this.drift = drift; this.base = base; this.top = top; this.period = period;
    const mat = makeMaterial({ color: '#ffffff', glow, tag: 'smoke-column' });
    if (!mat.uniforms.uFarScale) {
      const fs = mat.fragmentShader;
      const patched = fs.replace('void main() {', 'uniform float uFarNear;\n  uniform float uFarScale;\n  void main() {')
        .replace('gNormalDepth = vec4(n, vViewDepth);', 'gNormalDepth = vec4(n, vViewDepth < uFarNear ? vViewDepth : uFarNear + (vViewDepth - uFarNear) * uFarScale);');
      mat.userData.farDepth = patched.includes('(vViewDepth - uFarNear) * uFarScale') && patched.includes('uniform float uFarScale;');
      if (mat.userData.farDepth) mat.fragmentShader = patched;
      else console.warn('SmokeColumn: the far-shading patch no longer matches materials.js; the column will fog like the rest');
      mat.uniforms.uFarNear = { value: farNear };
      mat.uniforms.uFarScale = { value: farScale };
    }
    this.material = mat;
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), mat, count);
    this.mesh.name = 'Smoke column';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.userData.noCollide = true;
    this.mesh.userData.dynamic = true;
    this.mesh.frustumCulled = false;   // it spans half a kilometre; desert-city.js skips its update when it's out of view
    this.mesh.castShadow = false; this.mesh.receiveShadow = false;
    parent.add(this.mesh);
    // u: how far along the path (0..1, advancing with time); tone: which smoke colour; oa/ob/oc: scatter round the path
    // One continuous soft trail: the puffs are spaced evenly along the path and packed closely enough to
    // overlap everywhere, from the fire to the end of the plume, with little scatter and close sizes and
    // tones, so the silhouette reads as a single line rather than a string of beads.
    this.items = Array.from({ length: count }, (_, i) => ({
      u: (i + Math.random() * 0.5) / count, tone: 0.35 + Math.random() * 0.3,
      size: 0.9 + Math.random() * 0.2, spread: 0.22,
      oa: (Math.random() - 0.5) * 2, ob: (Math.random() - 0.5) * 2, oc: (Math.random() - 0.5) * 2, ph: Math.random() * 10,
    }));
    // the wind: a direction on the ground and a gentle strength, eased slowly so the column swings like a real one
    this.wind = new THREE.Vector3(0.83, 0, 0.56);
    this.windK = 1;
    this.palA = palette.map((c) => new THREE.Color(c));
    this.palB = this.palA;
    this.mixT = Infinity;
    // the fire lights the smoke just above it (and, at night, that is the part that glows)
    this.tint = new THREE.Color(tint);
    for (const it of this.items) it.c = new THREE.Color();
    for (let i = 0; i < count; i++) this.mesh.setColorAt(i, _a.copy(this.palA[0]));
    this.colour();
    this.update(0, 0);
  }

  /** The column's centre line at s (0 = the fire, 1 = the end of the plume), into out. */
  pathAt(s, out, t = 0) {
    const wx = this.wind.x, wz = this.wind.z, H = this.height, k = this.windK;
    let y, d;
    if (s < RISE) {
      // the column: straight up, leaning a little downwind as it goes
      const q = s / RISE;
      y = H * 0.9 * q * (1 - 0.12 * q) / 0.88;
      d = H * 0.14 * k * q * q;
    } else {
      // the plume: it meets the still air aloft, levels off and drifts away downwind in a long thin line
      const r = (s - RISE) / (1 - RISE);
      y = H * (0.9 + 0.1 * (1 - Math.pow(1 - r, 3)));
      d = H * 0.14 * k + this.drift * k * (0.35 * r + 0.65 * r * r) + H * 0.05 * Math.sin(Math.min(r * 4, 1) * Math.PI / 2);
    }
    // a slow meander across the wind, growing with height
    const m = (Math.sin(s * 5.5 + t * 0.03) * 9 + Math.sin(s * 13 + t * 0.05 + 1.3) * 3) * s;
    return out.set(this.at.x + wx * d - wz * m, this.at.y + y, this.at.z + wz * d + wx * m);
  }

  /**
   * Move toward another set of smoke colours and fire tint (setPalette(SMOKE_COOL, false, COOL_FIRE[1]));
   * the change rises up the column from the fire.
   */
  setPalette(p, instant = false, tint = null) {
    this.palA = this.palB;
    this.palB = p.map((c) => new THREE.Color(c));
    this.tintA = this.tint.clone();
    this.tintB = new THREE.Color(tint ?? this.tint);
    this.mixT = instant ? Infinity : 0;
    if (instant) { this.palA = this.palB; this.tint.copy(this.tintB); }
    this.colour();
  }

  /** Each puff's own smoke colour (only while the colours change). */
  colour() {
    const A = this.palA, B = this.palB;
    for (const it of this.items) {
      gradient(A, it.tone, it.c);
      // the smoke nearest the fire changes first, the plume aloft last
      if (A !== B) it.c.lerp(gradient(B, it.tone, _b), smooth(0, 1, (this.mixT - it.u * 24) / 5));
    }
    if (this.tintB && A !== B) this.tint.copy(this.tintA).lerp(this.tintB, smooth(0, 4, this.mixT));
  }

  update(dt, t, wind = null) {
    if (wind && (wind.x || wind.z)) {
      const l = Math.hypot(wind.x, wind.z), e = 1 - Math.exp(-dt / 25);
      this.wind.lerp(_p.set(wind.x / l, 0, wind.z / l), e).normalize();
      this.windK += (Math.min(Math.max(0.55 + 0.45 * l / 2.5, 0.5), 1.5) - this.windK) * e;
    }
    if (this.mixT < 30) {
      this.mixT += dt;
      if (this.mixT >= 30) this.palA = this.palB;
      this.colour();
    }
    const yaw = Math.atan2(this.wind.x, this.wind.z), cy = Math.cos(yaw), sy = Math.sin(yaw);
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      it.u += dt / this.period;
      if (it.u >= 1) { it.u -= Math.floor(it.u); it.oa = (Math.random() - 0.5) * 2; it.ob = (Math.random() - 0.5) * 2; }
      const s = 1 - Math.pow(1 - it.u, 1.35);   // quick off the fire, slowing aloft
      this.pathAt(s, _p, t);
      // the column widens as it rises; the plume flattens and stretches along the wind, then thins away
      const pr = s < RISE ? 0 : (s - RISE) / (1 - RISE), pl = smooth(0, 0.3, pr);
      const r = it.size * smooth(0, 0.02, s) * (s < RISE ? this.base + (this.top - this.base) * Math.pow(s / RISE, 1.1) : this.top * (1 - 0.6 * pr)) * (1 - smooth(0.72, 1, pr));
      // scatter round the centre line: little near the fire, more aloft (the column frays), widest in the plume
      const sc = r * (0.5 + 0.5 * Math.min(s / RISE, 1) + 0.6 * pl), sw = Math.sin(t * 0.21 + s * 9) * r * 0.12;   // the whole line sways together
      const across = it.oa * sc * it.spread + sw, along = it.ob * sc * it.spread * 0.6;
      _p.x += across * cy + along * sy;
      _p.z += -across * sy + along * cy;
      _p.y += it.oc * sc * it.spread * (0.45 - 0.35 * pl);
      _s.set(r * (1 - 0.1 * pl), r * (0.85 - 0.5 * pl), r * (1 + 1.6 * pl));
      _q.setFromEuler(_e.set(0, yaw, 0));
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      this.mesh.setColorAt(i, _a.copy(it.c).lerp(this.tint, 0.5 * (1 - smooth(0.01, 0.13, s))));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}
