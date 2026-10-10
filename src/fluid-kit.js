import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// What the magic-fluid backpack grows when the traveller finds the pieces
// (src/items.js): the gun modes' looks, the fluid wings that bloom out of the
// tank, the twin jets clipped under it, and the path the tank takes when it
// is swung off the back into a vehicle's socket. fluid-tool.js drives them.

/**
 * The gun modes. All of them share the three charges; all but push shoot a glob (push throws its cone of
 * fluid shock along the aim: FluidTool.push), and the
 * mode changes what the glob does (targets.js) and how the fluid looks:
 * tones (null: the fluid's own blend), rate: how fast the lava churns (stun
 * almost still, fire boiling), and the splash's character.
 */
export const MODES = {
  shoot: { item: 'gun', name: 'fluid', label: 'Fluid', tones: null, rate: 1, css: '' },
  // the push: a cone of fluid shock along the aim (no glob), pale and quick; it comes with the fluid gun
  push: { item: 'gun', name: 'push', label: 'Push', tones: ['#e8f4ff', '#9ec9e8', '#52c8cf', '#ffffff'], rate: 1.8, css: 'push', glow: '#e8f4ff', cone: true },
  stun: { item: 'stun', name: 'stilling', label: 'Stilling', tones: ['#d6f0fa', '#86bfe8', '#5a8ed6', '#f2fbff'], rate: 0.12, css: 'stun', glow: '#bfe6f7' },
  fire: { item: 'fire', name: 'ember', label: 'Ember', tones: ['#f9c45a', '#e0644a', '#f39a45', '#fff0b8', '#b8433f'], rate: 2.6, css: 'fire', glow: '#ffb347' },
  // Viridel's: leaf green and petal pink, slow as sap (src/temples/edena.js: seeds, budded doors, vines)
  bloom: { item: 'bloom', name: 'bloom', label: 'Bloom', tones: ['#7fcf72', '#f2a7b8', '#4f9a5a', '#f6d36a', '#fff1f4'], rate: 0.55, css: 'bloom', glow: '#c6eba8' },
  // the City Floating in Space's: a cone like the push's that pulls toward you (src/temples/spacecity.js: balls, the moorers' rings)
  tether: { item: 'tether', name: 'tether', label: 'Tether', tones: ['#f4e9c8', '#c9b48a', '#e8c66a', '#fffaf0'], rate: 1.4, css: 'push', glow: '#f4e9c8', cone: true, pull: true },
};
export const MODE_ORDER = ['shoot', 'push', 'stun', 'fire', 'bloom', 'tether'];
export const STUN_SECONDS = 3.5;

/** The owned modes in order (has: id -> bool). Without the fluid gun (a gadget, src/gadgets/gun.js) and the backpack it drinks from: none. */
export function ownedModes(has) {
  if (!has('gun') || !has('backpack')) return [];
  return MODE_ORDER.filter((m) => has(MODES[m].item));
}
/** The next owned mode after `mode` (dir +1 / -1); the same one if it is the only one. */
export function nextMode(mode, owned, dir = 1) {
  if (!owned.length) return 'shoot';
  const i = owned.indexOf(mode);
  return owned[((i < 0 ? 0 : i + dir) % owned.length + owned.length) % owned.length];
}

// ---------------------------------------------------------------- wings

const smooth = (k) => k * k * (3 - 2 * k);
const clamp01 = (k) => Math.min(1, Math.max(0, k));
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

/**
 * One lobe of membrane, length 1 along +y from its root, half-width
 * WING_W(y) along x, a little cambered along z. The shader (materials.js,
 * fluid kind 'wing') reads these object-space coordinates: the lava flows
 * across it, veins run along it and the tip dissolves into print dots.
 */
export const WING_W = (y) => 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(y, 0.8) * 0.97 + 0.03)), 0.85);
function lobeGeometry(rows = 14, cols = 8) {
  const pos = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const y = j / rows, w = WING_W(y);
    for (let i = 0; i <= cols; i++) {
      const u = i / cols * 2 - 1, x = u * w;
      pos.push(x, y, 0.06 * (1 - u * u) * Math.sin(Math.PI * y));   // cambered: the middle bellies out
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// three lobes a side, in the tank's frame (y up the glass, +z toward the wearer, the
// wearer's right at -x): open direction, length (m), width (m), bloom delay (0..1)
const LOBES = [
  { dir: [0.92, 0.34, 0.1], len: 1.6, width: 0.56, delay: 0 },
  { dir: [0.86, 0.02, -0.5], len: 1.25, width: 0.5, delay: 0.14 },
  { dir: [0.42, -0.5, -0.76], len: 0.85, width: 0.38, delay: 0.28 },
];
const WING_NORMAL = new THREE.Vector3(0, 0.78, -0.62).normalize();   // the membranes face up and back

/**
 * The fluid wings: three translucent lobes a side bloom out of the tank's
 * shoulders when the traveller glides, in the fluid's lava-lamp tones,
 * veined and inked; they fold back into the tank on landing, and flap gently
 * (more in turns, and in the wind).
 */
export class FluidWings {
  constructor(tankGroup, tones) {
    this.group = new THREE.Group();
    this.group.name = 'Fluid wings';
    this.material = makeMaterial({ color: '#ffffff', fluid: 'wing', glow: 0.5, side: THREE.DoubleSide, fluidTones: tones, key: 'fluid-wings' });
    this.U = this.material.uniforms;
    const geo = lobeGeometry();
    this.lobes = [];
    for (const s of [1, -1]) {
      const root = new THREE.Group();
      root.position.set(s * 0.13, 0.43, -0.03);   // the cap's shoulders, a little behind
      this.group.add(root);
      for (const L of LOBES) {
        const pivot = new THREE.Group();
        const mesh = new THREE.Mesh(geo, this.material);
        mesh.userData.noCollide = true;
        mesh.frustumCulled = false;
        pivot.add(mesh);
        root.add(pivot);
        const len = _a.set(L.dir[0] * s, L.dir[1], L.dir[2]).normalize().clone();
        const width = _b.crossVectors(WING_NORMAL, len).normalize().multiplyScalar(s).clone();
        const normal = _c.crossVectors(width, len).normalize().clone();   // a right-handed basis
        const open = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(width, len, normal));
        // folded: tucked down along the glass, inside the tank
        const fl = new THREE.Vector3(s * 0.15, -1, -0.1).normalize(), fw = new THREE.Vector3(0, 0, s).cross(fl).normalize();
        const folded = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(fw, fl, new THREE.Vector3().crossVectors(fw, fl)));
        this.lobes.push({ s, pivot, mesh, open, folded, flapAxis: width.clone(), ...L });
      }
    }
    this.group.traverse((o) => { o.userData.noCollide = true; });
    this.group.visible = false;
    this.k = 0; this.time = 0;
    tankGroup.add(this.group);
  }

  /**
   * @param open    0..1 (the player's wing state: 1 while gliding)
   * @param turn    the glide's turn rate (rad/s, + = left)
   * @param wind    m/s of wind (stirs the flapping)
   */
  update(dt, { open = 0, turn = 0, wind = 0, time = 0, fill = 1 } = {}) {
    this.time += dt;
    this.k = open;
    const on = open > 0.02;
    this.group.visible = on;
    if (!on) return;
    const t = this.time;
    // the tips dissolve into dots while blooming or folding
    this.U.uFluidB.value.y = 0.8 * (1 - smooth(clamp01(open * 1.6)));
    this.U.uFluidA.value.z = time;
    this.U.uFluidA.value.x = fill;
    for (const L of this.lobes) {
      const k = clamp01((open - L.delay * 0.6) / (1 - L.delay * 0.6));
      const e = smooth(k);
      // a little overshoot as each lobe snaps open
      const bloom = e + Math.sin(Math.PI * e) * 0.12;
      _q.copy(L.folded).slerp(L.open, Math.min(1, bloom));
      // flap: a slow beat, deeper when banking, the outer wing up in a turn
      const amp = 0.05 + 0.2 * Math.min(1, Math.abs(turn)) + 0.015 * Math.min(wind, 6);
      const beat = Math.sin(t * 3.1 + L.delay * 2.2) * amp + L.s * turn * 0.22;
      _q2.setFromAxisAngle(L.flapAxis, beat * e * (1 + L.delay));
      L.pivot.quaternion.copy(_q2).multiply(_q);
      const grow = 0.06 + 0.94 * Math.min(1, bloom);
      L.mesh.scale.set(L.width * (0.35 + 0.65 * e), L.len * grow, L.width * (0.35 + 0.65 * e));
    }
  }
}

// ---------------------------------------------------------------- jets

/**
 * The fluid jets: two brass nozzles clipped under the tank that spit the
 * fluid as coloured flames while the traveller thrusts. The flames share
 * the glob's churning material (pass it in), so they burn in the tank's tones.
 */
export class FluidJets {
  constructor(tankGroup, flameMaterial, metal) {
    this.group = new THREE.Group();
    this.group.name = 'Fluid jets';
    this.nozzles = [];
    this.flames = [];
    const parts = new Map();   // the brass and steel, baked into one mesh per material (fewer draws in every pass)
    const bake = (geo, mat, m) => { if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push(geo.applyMatrix4(m)); };
    for (const s of [-1, 1]) {
      const n = new THREE.Group();
      n.position.set(s * 0.1, -0.085, -0.06);   // (under the round backpack's dome, v1.38: clear of the plate)
      n.rotation.z = s * 0.16;                       // splayed a little outward
      n.updateMatrix();
      const at = (y) => new THREE.Matrix4().makeTranslation(0, y, 0).premultiply(n.matrix);
      bake(new THREE.BoxGeometry(0.05, 0.05, 0.07), metal.dark, at(0.03));                        // the clip
      bake(new THREE.CylinderGeometry(0.03, 0.045, 0.1, 10), metal.brass, at(-0.03));              // the body
      bake(new THREE.CylinderGeometry(0.045, 0.06, 0.05, 12, 1, true), metal.brassOpen, at(-0.1)); // the bell
      // the flame: a teardrop of churning fluid pointing down, stretched by the thrust
      const flame = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.045, -0.02], [0.08, -0.14], [0.07, -0.34], [0.04, -0.66], [0, -1]].map(([x, y]) => new THREE.Vector2(x, y)), 10), flameMaterial);
      flame.position.y = -0.12;
      flame.visible = false;
      flame.frustumCulled = false;
      n.add(flame);
      const core = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.03, -0.05], [0.035, -0.3], [0, -1]].map(([x, y]) => new THREE.Vector2(x, y)), 8), metal.core);
      core.position.y = -0.12;
      core.visible = false;
      n.add(core);
      this.group.add(n);
      this.nozzles.push(n);
      this.flames.push({ flame, core });
    }
    for (const [mat, geos] of parts) {
      for (const g of geos) if (g.index) { const ng = g.toNonIndexed(); g.dispose(); geos[geos.indexOf(g)] = ng; }
      for (const g of geos) for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      this.group.add(new THREE.Mesh(mergeGeometries(geos), mat));
      geos.forEach((g) => g.dispose());
    }
    this.group.traverse((o) => { o.userData.noCollide = true; });
    this.group.visible = false;
    this.thrust = 0;
    tankGroup.add(this.group);
  }
  /** World positions of the two nozzle mouths. */
  mouths(out = [new THREE.Vector3(), new THREE.Vector3()]) {
    this.nozzles.forEach((n, i) => { n.updateWorldMatrix(true, false); n.localToWorld(out[i].set(0, -0.13, 0)); });
    return out;
  }
  update(dt, { on = false, thrusting = false, power = 1, time = 0 } = {}) {
    this.group.visible = on;
    this.thrust += ((thrusting && on ? 0.35 + 0.65 * Math.min(1, power) : 0) - this.thrust) * (1 - Math.exp(-(thrusting ? 18 : 10) * dt));
    const lit = this.thrust > 0.03;
    this.flames.forEach(({ flame, core }, i) => {
      flame.visible = core.visible = lit;
      if (!lit) return;
      const flick = 0.82 + 0.18 * Math.sin(time * 47 + i * 2.1) + 0.12 * Math.sin(time * 83 + i);
      const L = 0.62 * this.thrust * flick;
      flame.scale.set(1 + 0.25 * this.thrust, L, 1 + 0.25 * this.thrust);
      core.scale.set(1, L * 0.55, 1);
    });
  }
}

// ---------------------------------------------------------------- the hand-off

/** Timings of the backpack hand-off onto a powered vehicle (s), and where in it things happen (0..1). */
export const HANDOFF = {
  board: 1.0,        // swing the pack off, slot it in, climb on
  unboard: 0.7,      // step off, take it back, shoulder it
  lift: 0.08, seat: 0.62,      // boarding: the tank leaves the back at lift, clicks into the socket at seat
  grab: 0.12, worn: 0.82,      // unboarding: the tank leaves the socket at grab, is on the back at worn
  arc: 0.55,         // m the tank rises over the straight line between the two
};

/**
 * The tank's world pose along a hand-off: u 0..1 from pose A (position,
 * quaternion, scale) to pose B, arcing up along `up` and turning once
 * (it swings round over the shoulder). Writes into out { p, q, s }.
 */
export function handoffPose(u, A, B, up, out) {
  const e = smooth(clamp01(u));
  out.p.lerpVectors(A.p, B.p, e).addScaledVector(up, Math.sin(Math.PI * e) * HANDOFF.arc);
  out.q.copy(A.q).slerp(B.q, e);
  // a half twist about up in the middle, unwound by the end
  _q.setFromAxisAngle(up, Math.sin(Math.PI * e) * 0.9);
  out.q.premultiply(_q);
  out.s.lerpVectors(A.s, B.s, e);
  return out;
}
