import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { featherGeometry, smallWingGeometry } from './avian.js';
import { makeMaterial } from './materials.js';

// Small ambient life: none of it is gameplay, all of it is drawn with the same
// inked G-buffer materials so it sits in the picture like everything else.

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

/** A flock of birds circling somewhere near the player, wings flapping. */
export class Flock {
  constructor(scene, { count = 14, color = '#3a2f2a', size = 1, height = [30, 70], radius = 90, speed = 0.12, seed = 1 } = {}) {
    this.count = count;
    this.size = size;
    this.height = height;
    this.radius = radius;
    this.speed = speed;
    this.phase = seed * 1.7;
    const mat = makeMaterial({ color, flat: true, side: THREE.DoubleSide });
    this.wings = [-1, 1].map((side) => {
      const m = new THREE.InstancedMesh(smallWingGeometry(side), mat, count);
      m.frustumCulled = false;
      m.userData.noCollide = true;
      m.userData.dynamic = true;
      scene.add(m);
      return m;
    });
    const parts = [
      new THREE.SphereGeometry(1,10,7).scale(.18,.2,.48),
      new THREE.SphereGeometry(1,10,7).scale(.14,.15,.18).translate(0,.16,.42),
      new THREE.ConeGeometry(.075,.26,6).rotateX(Math.PI/2).translate(0,.13,.66),
    ];
    for(let i=-2;i<=2;i++) parts.push(featherGeometry(.53,.16).rotateY(i*.17).translate(i*.045,.03,-.3));
    this.bodies = new THREE.InstancedMesh(mergeGeometries(parts.map(g=>{const out=g.index?g.toNonIndexed():g;out.deleteAttribute('uv');return out;})),
      makeMaterial({color:new THREE.Color(color).lerp(new THREE.Color('#b6aaa0'),.3).getStyle(),flat:true,side:THREE.DoubleSide}),count);
    this.bodies.frustumCulled=false;
    this.bodies.userData.noCollide=true; this.bodies.userData.dynamic=true;
    scene.add(this.bodies);
    this.birds = Array.from({ length: count }, (_, i) => ({
      off: new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 16),
      flap: Math.random() * 6, rate: 7 + Math.random() * 4, glide: Math.random() * 10,
    }));
    this.center = new THREE.Vector3();
  }

  /** @param eye camera position: birds never shrink below ~minPx on screen */
  update(dt, t, focus, eye) {
    const a = this.phase + t * this.speed;
    const h = this.height[0] + (this.height[1] - this.height[0]) * (0.5 + 0.5 * Math.sin(t * 0.05 + this.phase));
    this.center.set(focus.x + Math.cos(a) * this.radius, focus.y + h, focus.z + Math.sin(a) * this.radius);
    const yaw = Math.atan2(-Math.sin(a), Math.cos(a)) + (this.speed < 0 ? Math.PI : 0); // along the tangent of the circle
    for (let i = 0; i < this.count; i++) {
      const b = this.birds[i];
      b.flap += dt * b.rate;
      // glide now and then: wings held still
      const gliding = Math.sin(t * 0.3 + b.glide) > 0.4;
      const flap = gliding ? 0.15 : Math.sin(b.flap) * 0.75;
      _p.copy(this.center).add(b.off);
      _p.x += Math.sin(t * 0.7 + i) * 2;
      _p.y += Math.sin(t * 0.9 + i * 1.3) * 1.2;
      // Cap distance compensation: distant birds must not grow into giant Vs.
      _s.setScalar(eye ? Math.min(this.size*1.7, Math.max(this.size, _p.distanceTo(eye)*.009)) : this.size);
      const bank = this.speed < 0 ? -.13 : .13;
      _e.set(.05,yaw,bank,'YXZ'); _q.setFromEuler(_e);
      _m.compose(_p,_q,_s); this.bodies.setMatrixAt(i,_m);
      for (let w = 0; w < 2; w++) {
        const side = w === 0 ? -1 : 1;
        _e.set(.05, yaw, bank + side * flap, 'YXZ');
        _q.setFromEuler(_e);

        _m.compose(_p, _q, _s);
        this.wings[w].setMatrixAt(i, _m);
      }
    }
    this.bodies.instanceMatrix.needsUpdate = true;
    for (const m of this.wings) m.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Tiny particles drifting around the camera: dust, pollen, ash, fireflies.
 * Drawn as round sprites on top of the composite (not through the G-buffer),
 * otherwise their ink outline would turn them into black specks. They test
 * against the G-buffer depth so they still hide behind things.
 */
export class Motes {
  constructor(scene, { count = 220, color = '#e6d3a8', size = 0.08, glow = 0, box = 36, rise = 0, wind = [0.6, 0.2] } = {}) {
    this.count = count;
    this.box = box;
    this.rise = rise;
    this.wind = wind;
    const pos = new Float32Array(count * 3), phase = new Float32Array(count);
    for (let i = 0; i < count; i++) phase[i] = Math.random() * 6.28;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.uniforms = {
      tNormal: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uPR: { value: 1 },
      uColor: { value: new THREE.Color(color) }, uInk: { value: new THREE.Color('#2b211f') },
      uGlow: { value: glow }, uSize: { value: size }, uTime: { value: 0 },
    };
    const points = new THREE.Points(geo, new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, transparent: true, depthTest: false, depthWrite: false, uniforms: this.uniforms,
      vertexShader: `
        in float aPhase; uniform float uSize, uPR, uTime, uGlow; out float vDepth; out float vTw;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vDepth = -mv.z;
          vTw = mix(1.0, 0.35 + 0.65 * max(sin(uTime * 2.2 + aPhase * 3.0), 0.0), uGlow);   // fireflies blink
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(uSize * uPR * 900.0 / max(vDepth, 0.1), 1.5 * uPR, 14.0 * uPR) * mix(1.0, 1.8, uGlow);
        }`,
      fragmentShader: `
        precision highp float;
        uniform sampler2D tNormal; uniform vec2 uRes; uniform vec3 uColor, uInk; uniform float uGlow;
        in float vDepth; in float vTw; out highp vec4 fragColor;
        void main() {
          float scene = texture(tNormal, gl_FragCoord.xy / uRes).w;
          if (scene > 0.0 && vDepth > scene + 0.2) discard;
          float r = length(gl_PointCoord - 0.5);
          if (r > 0.5) discard;
          float rim = smoothstep(0.3, 0.42, r) * (1.0 - uGlow);          // thin inked rim (not on glows)
          vec3 col = mix(uColor, uInk, rim * 0.7);
          float core = 1.0 - smoothstep(0.42, 0.5, r);
          float halo = mix(core, (1.0 - smoothstep(0.0, 0.5, r)), uGlow);   // glows: soft halo
          float far = 1.0 - smoothstep(22.0, 38.0, vDepth);
          fragColor = vec4(col * mix(1.0, 1.25, uGlow), halo * far * vTw);
        }`,
    }));
    points.frustumCulled = false;
    this.geo = geo;
    this.scene = new THREE.Scene();
    this.scene.add(points);
    this.seeds = Array.from({ length: count }, () => new THREE.Vector3(Math.random(), Math.random(), Math.random()));
  }

  update(dt, t, focus) {
    this.uniforms.uTime.value = t;
    const B = this.box, H = B * 0.5;
    const pos = this.geo.attributes.position.array;
    // each mote drifts freely; its position is wrapped into a box centred on the focus
    const wrap = (v, c, size) => c - size / 2 + ((((v - c + size / 2) % size) + size) % size);
    for (let i = 0; i < this.count; i++) {
      const s = this.seeds[i];
      const x = s.x * 1000 + t * this.wind[0] + Math.sin(t * 0.5 + i) * 1.5;
      const y = s.y * 1000 + t * this.rise + Math.sin(t * 0.8 + i * 0.7) * 0.8;
      const z = s.z * 1000 + t * this.wind[1] + Math.cos(t * 0.4 + i) * 1.5;
      pos[i * 3] = wrap(x, focus.x, B);
      pos[i * 3 + 1] = wrap(y, focus.y + H * 0.3, H);
      pos[i * 3 + 2] = wrap(z, focus.z, B);
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

/** A cloth banner hanging from its top edge, waving in the wind. */
export class Banner {
  constructor(scene, pos, rotY, { width = 2, height = 6, color = '#d9643a', glyphs = true } = {}) {
    const g = new THREE.PlaneGeometry(width, height, 2, 10);
    g.translate(0, -height / 2, 0);
    this.base = g.attributes.position.array.slice();
    this.geo = g;
    this.height = height;
    this.mesh = new THREE.Mesh(g, makeMaterial({ color, side: THREE.DoubleSide, grid: glyphs ? width / 2 : 0, glyphs }));
    this.mesh.position.copy(pos);
    this.mesh.rotation.y = rotY;
    this.mesh.userData.noCollide = true;
    this.phase = Math.random() * 10;
    scene.add(this.mesh);
  }

  update(t) {
    const p = this.geo.attributes.position.array, b = this.base, H = this.height;
    for (let i = 0; i < p.length; i += 3) {
      const down = -b[i + 1] / H;                      // 0 at the top edge, 1 at the bottom
      const wave = Math.sin(t * 2.6 + this.phase - down * 4 + b[i] * 0.8);
      p[i + 2] = b[i + 2] + wave * 0.45 * down + down * down * 0.9;
      p[i] = b[i] + Math.sin(t * 1.7 + this.phase + down * 3) * 0.1 * down;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

/** Puffs rising from a surface, swelling then shrinking away (steam, smoke). */
export class Puffs {
  constructor(scene, { count = 60, color = '#d6e6a0', glow = 0.3, area = (rand) => new THREE.Vector3(), rise = 6, life = 6, size = 4 } = {}) {
    this.count = count;
    this.area = area;
    this.rise = rise;
    this.life = life;
    this.size = size;
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), makeMaterial({ color, glow }), count);
    this.mesh.frustumCulled = false;
    this.mesh.userData.noCollide = true;
    this.mesh.userData.dynamic = true;   // (moved every frame: tileScene and the clipping audit leave it be)
    scene.add(this.mesh);
    this.items = Array.from({ length: count }, () => ({ pos: area(Math.random), age: Math.random() * life }));
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      const it = this.items[i];
      it.age += dt;
      if (it.age > this.life) { it.age = 0; it.pos = this.area(Math.random); }
      const k = it.age / this.life;
      _p.copy(it.pos).setY(it.pos.y + k * this.rise * this.life);
      _s.setScalar(this.size * Math.sin(Math.PI * k) * (0.6 + 0.4 * k));
      _m.compose(_p, _q.identity(), _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Footprints pressed into sand: a recycled pool of small dark ovals that fade. */
export class Footprints {
  /**
   * Boot prints pressed into whatever you walk on: a decal that darkens the
   * G-buffer albedo underneath it (multiply blend), so a print always takes
   * the colour of its surface, sand, moss, stone or tiles alike. Normals,
   * depth and marks are left alone, so prints don't get outlined.
   */
  constructor(scene, { count = 160, life = 30, depth = 0.87, geometry = null } = {}) {   // (geometry: another shape, flat in xy: a shade's pools)
    this.count = count;
    this.life = life;
    // a sole: heel and ball as two ovals, toe forward (+z)
    const sole = new THREE.Shape();
    sole.absellipse(0, -0.075, 0.042, 0.05, 0, Math.PI * 2);
    const g = geometry ?? mergeSole([new THREE.ShapeGeometry(sole, 10), new THREE.ShapeGeometry(new THREE.Shape().absellipse(0.004, 0.055, 0.05, 0.075, 0, Math.PI * 2), 12)]);
    g.rotateX(Math.PI / 2);
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uDepth: { value: depth } },
      vertexShader: `in float aFade; out float vFade;
        void main() { vFade = aFade; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: `precision highp float; uniform float uDepth; in float vFade;
        layout(location = 0) out highp vec4 gAlbedoLight;
        layout(location = 1) out highp vec4 gNormalDepth;
        layout(location = 2) out highp vec4 gHatch;
        void main() {
          float k = mix(1.0, uDepth, vFade);
          gAlbedoLight = vec4(k, k, k, 1.0);    // multiplied into the surface colour; light (alpha) unchanged
          gNormalDepth = vec4(1.0);
          gHatch = vec4(1.0);
        }`,
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.fade = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    g.setAttribute('aFade', this.fade);
    this.mesh = new THREE.InstancedMesh(g, material, count);
    // drawn wherever the prints are: rewritten every frame, so never given fixed bounds (perf.js
    // fitBounds once fitted them round the empty pool at the origin, a 1 m sphere: the prints were
    // culled whenever the camera turned that spot out of view)
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.userData.dynamic = true;
    this.mesh.renderOrder = 5;
    this.mesh.userData.noCollide = true;
    this.items = Array.from({ length: count }, () => ({ pos: new THREE.Vector3(), q: new THREE.Quaternion(), age: life }));
    this.next = 0;
    for (let i = 0; i < count; i++) { _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); }
    scene.add(this.mesh);
  }

  add(pos, heading, up) {
    const it = this.items[this.next];
    this.next = (this.next + 1) % this.count;
    it.pos.copy(pos).addScaledVector(up, 0.012);
    it.q.setFromUnitVectors(_s.set(0, 1, 0), up).multiply(_q.setFromAxisAngle(_s.set(0, 1, 0), heading));
    it.age = 0;
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      const it = this.items[i];
      if (it.age >= this.life) continue;
      it.age += dt;
      const k = 1 - Math.min(it.age / this.life, 1);   // fade out: the print fills back in
      this.fade.setX(i, k * k);
      _m.compose(it.pos, it.q, _s.set(1, 1, 1));
      this.mesh.setMatrixAt(i, _m);
      if (k <= 0) { _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.fade.needsUpdate = true;
  }
}

function mergeSole(geos) {
  const pos = [], idx = [];
  for (const g of geos) {
    const base = pos.length / 3, P = g.attributes.position;
    for (let i = 0; i < P.count; i++) pos.push(P.getX(i), P.getY(i), P.getZ(i));
    for (const v of g.index.array) idx.push(base + v);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(idx);
  return out;
}
