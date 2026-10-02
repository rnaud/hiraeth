import * as THREE from 'three';

// Wind-blown sand: short inked wisps that skim the ground around the player
// in gusts. Each wisp is a camera-facing ribbon rebuilt on the CPU every frame
// (a few thousand vertices), drawn after the composite pass. It tests itself
// against the G-buffer depth so it hides behind dunes and rocks, and fades
// with distance like the rest of the line work.

const SEGS = 10;

const vertexShader = /* glsl */ `
  in float aAlpha;
  out float vAlpha;
  out float vDepth;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D tNormal;
  uniform vec2 uRes;
  uniform vec3 uInk;
  in float vAlpha;
  in float vDepth;
  out highp vec4 fragColor;
  void main() {
    float scene = texture(tNormal, gl_FragCoord.xy / uRes).w;
    if (scene > 0.0 && vDepth > scene + 0.25) discard;   // manual depth test
    fragColor = vec4(uInk, vAlpha);
  }
`;

export class WindStreaks {
  constructor(count = 260) {
    this.count = count;
    this.wisps = [];
    this.time = 0;
    this.windAngle = 0.6;

    const verts = count * (SEGS + 1) * 2;
    this.positions = new Float32Array(verts * 3);
    this.alphas = new Float32Array(verts);
    const index = [];
    for (let w = 0; w < count; w++) {
      const base = w * (SEGS + 1) * 2;
      for (let k = 0; k < SEGS; k++) {
        const a = base + k * 2, b = a + 1, c = a + 2, d = a + 3;
        index.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(index);
    this.uniforms = {
      tNormal: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uInk: { value: null },
    };
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader,
        fragmentShader,
        uniforms: this.uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);

    for (let i = 0; i < count; i++) this.wisps.push({ age: 1, life: 0 }); // all dead
    this._p = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  get windDir() {
    return [Math.cos(this.windAngle), Math.sin(this.windAngle)];
  }

  /** Gust strength 0..1, slowly varying. */
  gust() {
    const t = this.time;
    const g = THREE.MathUtils.clamp(0.35 + 0.45 * Math.sin(t * 0.21) + 0.3 * Math.sin(t * 0.53 + 1.7), 0, 1);
    return Math.max(g, this.boost ?? 0);   // a sandstorm keeps it gusting
  }

  spawn(w, x, z, vx, vz, opts = {}) {
    w.x = x; w.z = z; w.vx = vx; w.vz = vz;
    w.age = 0;
    w.life = opts.life ?? 1.6 + Math.random() * 2.2;
    w.len = opts.len ?? 2.5 + Math.random() * 5;
    w.h = opts.h ?? 0.08 + Math.random() * Math.random() * 1.6;
    w.amp = 0.15 + Math.random() * 0.4;
    w.phase = Math.random() * 10;
    w.strength = opts.strength ?? 0.55 + Math.random() * 0.4;
  }

  /** Dust kicked up by the hoverbike. */
  emit(x, z, vx, vz) {
    const w = this.wisps.find((q) => q.age >= q.life);
    if (!w) return;
    this.spawn(w, x + (Math.random() - 0.5) * 1.5, z + (Math.random() - 0.5) * 1.5, vx, vz,
      { life: 0.7 + Math.random() * 0.6, len: 2 + Math.random() * 3, h: 0.1 + Math.random() * 0.5, strength: 0.6 });
  }

  update(dt, center, camera, terrain, pxScale, enabled = true) {
    this.time += dt;
    this.windAngle = 0.6 + Math.sin(this.time * 0.013) * 0.35;
    const [wx, wz] = this.windDir;
    const gust = this.gust();
    const cam = camera.position;
    const p = this._p, T = this._t, V = this._v, S = this._s;

    for (let i = 0; i < this.count; i++) {
      const w = this.wisps[i];
      w.age += dt;
      if (w.age >= w.life && enabled && Math.random() < gust * dt * 6) {
        // spawn upwind of the player, in a disc
        const a = Math.random() * Math.PI * 2, r = 4 + Math.sqrt(Math.random()) * 40;
        const speed = 7 + Math.random() * 7;
        this.spawn(w, center.x + Math.cos(a) * r - wx * 15, center.z + Math.sin(a) * r - wz * 15, wx * speed, wz * speed);
      }
      const base = i * (SEGS + 1) * 2;
      if (w.age >= w.life) {
        for (let k = 0; k <= SEGS; k++) { this.alphas[base + k * 2] = 0; this.alphas[base + k * 2 + 1] = 0; }
        continue;
      }
      w.x += w.vx * dt;
      w.z += w.vz * dt;
      const spd = Math.hypot(w.vx, w.vz) || 1;
      const dx = w.vx / spd, dz = w.vz / spd;
      const life = Math.sin(Math.PI * Math.min(w.age / w.life, 1));
      for (let k = 0; k <= SEGS; k++) {
        const s = (k / SEGS) * w.len;
        const wig = Math.sin(w.phase + s * 0.9 - w.age * 4) * w.amp;
        p.set(w.x - dx * s - dz * wig, 0, w.z - dz * s + dx * wig);
        p.y = terrain.heightAt(p.x, p.z) + w.h + Math.sin(w.phase * 2 + s * 0.6) * 0.08;
        // tangent and camera-facing side vector
        T.set(-dx, 0, -dz);
        V.subVectors(cam, p);
        const dist = V.length();
        S.crossVectors(T, V).normalize().multiplyScalar(0.5 * Math.max(1.7 * dist * pxScale, 0.015));
        const j = (base + k * 2) * 3;
        this.positions[j] = p.x - S.x; this.positions[j + 1] = p.y - S.y; this.positions[j + 2] = p.z - S.z;
        this.positions[j + 3] = p.x + S.x; this.positions[j + 4] = p.y + S.y; this.positions[j + 5] = p.z + S.z;
        const taper = Math.sin(Math.PI * (k / SEGS));
        const a = w.strength * life * taper * (1 - THREE.MathUtils.smoothstep(dist, 35, 90));
        this.alphas[base + k * 2] = a;
        this.alphas[base + k * 2 + 1] = a;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.aAlpha.needsUpdate = true;
  }
}
