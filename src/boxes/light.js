import * as THREE from 'three';
import { LightShaft } from '../veil.js';

// The light out of an opening chest (issue #285, the author: "Right now you have little 3d shapes coming out of it,
// let's have real light coming out of it"; the reference: references/Core Objects/Chests/light/light-1.jpg). Until then
// eleven thin glowing blades and eighteen jade specks rose out of it; now it is light, drawn as the game draws every
// shaft of light (src/veil.js), washes laid over the finished picture after the ink pass, so no ink round it, no
// shadow, nothing to bump into, and no new program (the washes' one, with its rays switched on):
//   - the column: two cones from the chest's mouth up, a wide pale jade one streaked into slow rays round it and a
//     narrower pale gold core, each soft where it is seen edge-on, gone at its far end, stepped into flat bands
//   - the mouth: a disc of gold light over the open chest, as if the chest were full of it
//   - the motes: a few flat round dots drifting up in the beam, turned to the eye
// It swells as the halves part and settles as the item rises (chestLightK, scene.js); the chest's lamp (box.light, a
// local light of the shared list: main.js updateLights) lights his face and the ground round it with it (chestLamp),
// and the chest's linings glow (uBoxA.y over 1, materials.js MAKERS_BOX).
//
//   const L = new ChestLight({ veils, parent: scene, kind })   (veils null: a test, the meshes alone)
//   L.update({ mouth, yaw, k, time, eye })   per frame: where its mouth is (world), its strength 0..1, the camera
//   L.dispose()                              gone with its scene, its washes out of the pass

/** Its look: colours, alphas (a layer), sizes (m, at the chest's full size), the rays (how many round, how strongly,
 *  the soft edge), the motes. */
export const CHEST_LIGHT = {
  outer: '#7fd6aa', inner: '#ffe29a', mouth: '#fff0c8', mote: '#fff8e0',
  alpha: { outer: 0.22, inner: 0.27, mouth: 0.6, mote: 0.9 },
  height: 3.8, top: 2.1, innerK: 0.5, innerHeight: 0.85,
  rays: { count: 7, strength: 0.85, soft: 0.6, speed: 1 },
  motes: { n: 22, size: [0.012, 0.026], rise: 0.32, life: 4.5 },
};
/** The mouth's half-widths across and front to back (m, at scale 1) and its height up the chest (a share of its height). */
export const MOUTHS = { makers: { x: 0.31, z: 0.25, y: 0.44 }, temple: { x: 0.26, z: 0.26, y: 0.1 } };

/**
 * How strong the chest's light is (0..1) at time t of a phase of the opening (scene.js TIMES; `open` the share of the
 * dissolve phase over which its halves part; `from` what it was as 'out' began): none before it opens; swelling as the
 * halves part, full as they finish; settling to SETTLE as the item rises and over the reveal; held through the card;
 * dimming in the closing beat; gone as the scene hands back.
 */
export const SETTLE = 0.5;
export function chestLightK(phase, t, T, { open = 0.5, from = SETTLE, outTime = 1.3 } = {}) {
  const sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  if (phase === 'dissolve') {
    const u = t / T.dissolve;
    const swell = sm(u / open);
    return u <= open ? swell : 1 - (1 - SETTLE) * sm((u - open) / (1 - open));
  }
  if (phase === 'reveal' || phase === 'card') return SETTLE;
  if (phase === 'beat') return SETTLE * (1 - 0.6 * sm(t / (T.beat || 1)));
  if (phase === 'out') return from * (1 - sm(t / Math.max(0.2, outTime * 0.8)));
  return 0;
}

/** The chest's lamp (box.light: x y z, radius): reach `base` + `seam` while light leaks at its seam + `reach` with its
 *  light, raised `lift` over the mouth as it comes, so his face is in it. */
export const LAMP = { base: 2.2, seam: 3.2, reach: 6, lift: 0.6 };
export function chestLamp(out, mouth, seam, k) {
  return out.set(mouth.x, mouth.y + LAMP.lift * k, mouth.z, LAMP.base + LAMP.seam * seam * (1 - k) + LAMP.reach * k);
}

const SEG = 24, MS = 10;   // (the mouth's fan; a mote's sides: round at any size it is seen)

export class ChestLight {
  constructor({ veils = null, parent, kind = 'makers' } = {}) {
    const C = CHEST_LIGHT;
    this.kind = kind === 'temple' ? 'temple' : 'makers';
    this.group = new THREE.Group();
    this.group.name = 'Chest light';
    parent.add(this.group);
    this.veils = veils;
    this.outer = new LightShaft(veils, this.group, { color: C.outer, alpha: [C.alpha.outer], near: 0, segments: 32 });
    this.inner = new LightShaft(veils, this.group, { color: C.inner, alpha: [C.alpha.inner], near: 0, segments: 20 });
    for (const w of [...this.outer.washes, ...this.inner.washes]) w.material.uniforms.uRays.value.set(C.rays.strength, 0, C.rays.count, C.rays.soft);
    for (const w of this.inner.washes) w.material.uniforms.uRays.value.set(C.rays.strength * 0.5, 0, C.rays.count - 2, C.rays.soft);
    // the mouth: a flat ellipse of light (a fan round its middle), written in world metres as the shafts are
    this.mouthMesh = this.flat(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 2) * 3), 3)), C.mouth, C.alpha.mouth);
    const idx = []; for (let j = 0; j < SEG; j++) idx.push(0, j + 1, j + 2);
    this.mouthMesh.geometry.setIndex(idx);
    // the motes: little flat discs turned to the eye, rising in the beam
    const M = C.motes;
    this.motes = Array.from({ length: M.n }, (_, i) => ({ a: i * 2.39996, r: ((i * 7) % 11) / 11, ph: ((i * 37) % 23) / 23, s: M.size[0] + (M.size[1] - M.size[0]) * (((i * 5) % 7) / 6), sway: 0.6 + (i % 5) * 0.2 }));
    const mg = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(M.n * (MS + 1) * 3), 3));
    const mi = []; for (let i = 0; i < M.n; i++) for (let j = 0; j < MS; j++) mi.push(i * (MS + 1), i * (MS + 1) + 1 + j, i * (MS + 1) + 1 + ((j + 1) % MS));
    mg.setIndex(mi);
    this.moteMesh = this.flat(mg, C.mote, C.alpha.mote);
    this.k = 0;
    this.visible = true;
    // light only adds: laid over the picture additively (blending is the draw's state, not the program: still the washes' one)
    for (const w of this.washes) w.material.blending = THREE.AdditiveBlending;
  }

  /** A flat mesh of its own drawn only as its wash (as LightShaft's: layer 31, invisible in the G-buffer). */
  flat(geo, color, alpha) {
    const nrm = new Float32Array(geo.attributes.position.count * 3); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;   // (up: the wash lights it flat, glowing)
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
    m.layers.set(31);
    m.userData.noCollide = true; m.userData.dynamic = true; m.castShadow = false; m.frustumCulled = false;
    this.group.add(m);
    m.updateMatrixWorld(true);
    const w = this.veils?.add(m, { color, glow: 1, alpha, near: 0 });
    if (w) w.frustumCulled = false;
    m.userData.wash = w ?? null;
    return m;
  }

  get washes() { return [...this.outer.washes, ...this.inner.washes, this.mouthMesh.userData.wash, this.moteMesh.userData.wash].filter(Boolean); }
  get visible() { return this.group.visible; }
  set visible(v) { this.group.visible = v; }

  /** Per frame: its mouth (world, the open chest's middle at the height its halves part), the chest's yaw, its strength
   *  0..1 (chestLightK), the clock (s) and the eye (the camera's position: the motes turn to it). */
  update({ mouth, yaw = 0, k = 0, time = 0, eye = null, scale = 1 }) {
    const C = CHEST_LIGHT, Mo = MOUTHS[this.kind];
    this.k = k;
    this.group.visible = k > 0.002;
    if (!this.group.visible) return this;
    const rx = Mo.x * scale, rz = Mo.z * scale, r0 = Math.max(rx, rz) * 0.92;
    // the column: taller and wider as it swells (it rises out of the chest, it doesn't switch on)
    const grow = 0.35 + 0.65 * k, h = C.height * grow;
    _top.set(mouth.x, mouth.y + h, mouth.z);
    this.outer.set(_top, r0 + (C.top - r0) * grow, mouth, r0);
    _top.set(mouth.x, mouth.y + h * C.innerHeight, mouth.z);
    this.inner.set(_top, (r0 + (C.top * 0.55 - r0) * grow) * C.innerK + r0 * 0.25, mouth, r0 * C.innerK);
    this.outer.fade(k); this.inner.fade(Math.min(1, k * 1.15));
    for (const w of [...this.outer.washes, ...this.inner.washes]) w.material.uniforms.uRays.value.y = time * C.rays.speed;
    // the mouth, a little under the rim (the bowl's front hides it from low; from above the chest is full of light)
    const cy = Math.cos(yaw), sy = Math.sin(yaw), P = this.mouthMesh.geometry.attributes.position;
    P.setXYZ(0, mouth.x, mouth.y - 0.01, mouth.z);
    for (let j = 0; j <= SEG; j++) {
      const a = (j / SEG) * Math.PI * 2, x = Math.cos(a) * rx * 0.97, z = Math.sin(a) * rz * 0.97;
      P.setXYZ(j + 1, mouth.x + x * cy + z * sy, mouth.y - 0.01, mouth.z - x * sy + z * cy);
    }
    P.needsUpdate = true;
    this.mouthMesh.geometry.computeBoundingSphere();
    const mw = this.mouthMesh.userData.wash;
    if (mw) mw.material.uniforms.uWash.value.x = C.alpha.mouth * Math.min(1, k * 1.4);
    // the motes: up through the beam, swaying, each small, growing in and out over its life
    const M = C.motes, Q = this.moteMesh.geometry.attributes.position;
    _f.set(0, 0, 1);
    this.motes.forEach((m, i) => {
      const life = ((time / M.life) * (0.8 + 0.4 * m.sway) + m.ph) % 1;
      const y = life * h * 0.85, spread = r0 * (0.3 + 0.7 * m.r) * (1 + (y / Math.max(h, 1e-3)) * 1.2);
      const a = m.a + Math.sin(time * 0.4 * m.sway + m.ph * 6) * 0.5;
      _p.set(mouth.x + Math.cos(a) * spread, mouth.y + 0.05 + y, mouth.z + Math.sin(a) * spread);
      const s = m.s * Math.sin(Math.PI * life) * Math.min(1, k * 1.5);
      if (eye) _f.subVectors(eye, _p).normalize();
      _r.crossVectors(_Y, _f); if (_r.lengthSq() < 1e-6) _r.set(1, 0, 0); _r.normalize();
      _u.crossVectors(_f, _r);
      const o = i * (MS + 1);
      Q.setXYZ(o, _p.x, _p.y, _p.z);
      for (let j = 0; j < MS; j++) {
        const b = (j / MS) * Math.PI * 2, c = Math.cos(b) * s, d = Math.sin(b) * s;
        Q.setXYZ(o + 1 + j, _p.x + _r.x * c + _u.x * d, _p.y + _r.y * c + _u.y * d, _p.z + _r.z * c + _u.z * d);
      }
    });
    Q.needsUpdate = true;
    this.moteMesh.geometry.computeBoundingSphere();
    return this;
  }

  dispose() {
    for (const w of this.washes) this.veils?.remove?.(w);
    this.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.group.removeFromParent();
  }
}

const _top = new THREE.Vector3(), _p = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0);
