import * as THREE from 'three';

// The hoverbike's trail: a long band laid on the ground behind it, recorded
// over the last few seconds. Drawn like the rest of the page: a pale dust
// band that widens and fades with age, inked edge lines and dashed speed
// strokes down the middle. It's an overlay after the composite, depth-tested
// against the G-buffer so it tucks behind dunes.

const N = 320;          // samples: ~8 s of trail

const vertexShader = /* glsl */ `
  in vec3 aInfo;          // x = across (-1..1), y = age (0..1), z = distance along (m)
  out vec3 vInfo;
  out float vDepth;
  void main() {
    vInfo = aInfo;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D tNormal;
  uniform vec2 uRes;
  uniform vec3 uInk, uDust;
  uniform float uPR;
  in vec3 vInfo;
  in float vDepth;
  out highp vec4 fragColor;
  void main() {
    float scene = texture(tNormal, gl_FragCoord.xy / uRes).w;
    if (scene > 0.0 && vDepth > scene + 0.6) discard;
    float across = abs(vInfo.x), age = vInfo.y, along = vInfo.z;
    if (age >= 1.0) discard;
    float fade = pow(1.0 - age, 0.9);
    float fw = fwidth(across);
    // streaming ink lines: five lanes that waver and break into dashes with age
    float lanes = vInfo.x * 2.0 + sin(along * 0.07 + vInfo.x * 3.0) * 0.08 * age;
    float ld = abs(fract(lanes + 0.5) - 0.5) / max(fwidth(lanes), 1e-4);
    float broken = mix(1.0, step(0.35 + 0.4 * age, fract(along * 0.09 + floor(lanes + 0.5) * 0.37)), smoothstep(0.1, 0.6, age));
    float lines = (1.0 - smoothstep(0.45 * uPR, 0.45 * uPR + 1.0, ld)) * broken * step(across, 0.96);
    float edge = 1.0 - smoothstep(0.0, fw * 1.4 * uPR, abs(across - 0.97));
    // soft dust band, strongest near the bike, pale at the rim
    float body = (1.0 - smoothstep(0.35, 1.0, across)) * mix(0.5, 0.18, age);
    vec3 col = mix(uDust, uInk, max(lines, edge));
    float a = max(body, max(lines * 0.85, edge * 0.6 * (1.0 - age))) * fade;
    if (a < 0.01) discard;
    fragColor = vec4(col, a);
  }
`;

export class Trail {
  constructor() {
    this.samples = [];          // { p, side, t, d }
    this.time = 0;
    this.acc = 0;
    this.dist = 0;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 2 * 3);
    this.info = new Float32Array(N * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aInfo', new THREE.BufferAttribute(this.info, 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    this.uniforms = {
      tNormal: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uPR: { value: 1 },
      uInk: { value: new THREE.Color('#2b211f') }, uDust: { value: new THREE.Color('#fbf1da') },
    };
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader, fragmentShader, uniforms: this.uniforms,
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.life = 8;
  }

  /**
   * @param ground point on the ground under the vehicle (or null when not laying a trail)
   * @param dir    travel direction, @param up surface up
   */
  update(dt, ground, dir, up) {
    this.time += dt;
    this.acc += dt;
    if (ground && this.acc > 0.03) {
      const last = this.samples[this.samples.length - 1];
      if (last) this.dist += last.p.distanceTo(ground);
      if (!last || last.p.distanceTo(ground) > 0.4) {
        const side = new THREE.Vector3().crossVectors(up, dir).normalize();
        this.samples.push({ p: ground.clone().addScaledVector(up, 0.06), side, t: this.time, d: this.dist });
        if (this.samples.length > N) this.samples.shift();
      }
      this.acc = 0;
    }
    while (this.samples.length && this.time - this.samples[0].t > this.life) this.samples.shift();
    const n = this.samples.length;
    for (let i = 0; i < N; i++) {
      const s = this.samples[Math.min(i, n - 1)];
      const j = i * 6;
      if (!s || i >= n) {
        for (let k = 0; k < 6; k++) { this.pos[j + k] = 0; this.info[j + k] = 0; }
        this.info[j + 1] = this.info[j + 4] = 1;   // age 1 = invisible
        continue;
      }
      const age = Math.min((this.time - s.t) / this.life, 1);
      const w = 0.35 + Math.sqrt(age) * 5.5;                  // thin at the bike, fanning out
      this.pos[j] = s.p.x - s.side.x * w; this.pos[j + 1] = s.p.y - s.side.y * w; this.pos[j + 2] = s.p.z - s.side.z * w;
      this.pos[j + 3] = s.p.x + s.side.x * w; this.pos[j + 4] = s.p.y + s.side.y * w; this.pos[j + 5] = s.p.z + s.side.z * w;
      this.info[j] = -1; this.info[j + 1] = age; this.info[j + 2] = s.d;
      this.info[j + 3] = 1; this.info[j + 4] = age; this.info[j + 5] = s.d;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.aInfo.needsUpdate = true;
  }
}
