import * as THREE from 'three';
import { makeMaterial, releaseMaterial } from './materials.js';
import { buildCharacter } from './player.js';
import { Humanoid } from './humanoid.js';
import { Animator } from './animator.js';
import { Locomotion } from './locomotion.js';
import { Dots } from './fluid-tool.js';
import { Footprints } from './life.js';

// A shade's body (src/foes.js, kind 'shade'; docs/systems/foes.md, "The shade"): a person of living shadow drawn as
// a cartoon's negative. The game's own skinned body and its animator (walks, and the Sword and Shield pack's attack
// as it strikes), flat black (materials.js fluid 'shadow') with a few white strokes for its folds, its lines white
// (makeMaterial({ lineWhite }): post.js draws them in the paper's white, so it reads in the desert's noon and in a
// dark hall alike). Its head is a black flame: tongues of black rising off the neck, flickering, streaming back as
// it runs, flaring up as it winds up, whipping with its cut, guttering when it is hit or stilled, torn away into
// black licks as it dies; two white eye-slits in it. Its feet run into the floor in drips, drops fall off it and
// dark pools are left where it walks (a footprints decal: it darkens what it lands on, never inked).
//
//   const body = new ShadeBody(scene, { lib, human, pools })   (Foes makes one a shade; pools: shared ShadePools)
//   body.update(dt, foe)       after the foe's mind: walks where it went, strikes as it winds up and strikes
//   body.melt = 0..1           how much has run away (its coming and its going)

/** The strike from motion capture: the clip, its wind-up (start → the cut) and its follow-through. */
export const SHADE_STRIKE = { clip: 'mixamo_ss_attack_2', from: 0.1, cut: 0.55, to: 0.95 };
/** Its black, a near-black for the drops, its eyes' white. */
export const SHADE_TONES = ['#08070a', '#1a1720', '#f7f2e6'];
/** The body's material: one per shade (its own time and melt), the flame's mesh shares it. fluidBox: fold strokes, neck cut (bind y). */
export const SHADE_MATERIAL = { color: SHADE_TONES[0], fluid: 'shadow', fluidBox: [0, 1.8, 1, 1.6], line: 1, lineWhite: true };
const UP = new THREE.Vector3(0, 1, 0);
let uid = 0;

// ------------------------------------------------------------------ the flame's maths (pure: tests/shade-flame.test.js)

/**
 * How the flame answers the body. lean: its tongues' lean back per m/s (local), at most leanMax; flare: how much
 * longer at a wind-up's end; gutter: how much shorter while stilled or hit; whip: the cut's lateral swing; ease:
 * how fast it follows (1/s: up, down, the whip's).
 */
export const FLAME = { lean: 0.16, leanMax: 0.9, flare: 0.6, gutter: 0.55, whip: 1, ease: [10, 5, 14], flick: 1.4 };

const smooth = (x) => { x = Math.min(Math.max(x, 0), 1); return x * x * (3 - 2 * x); };
const toward = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

/** The flame's state at rest. */
export const flameRest = () => ({ lx: 0, lz: 0, size: 0, whip: 0, gutter: 0, flick: 1, time: 0 });

/**
 * What the flame wants this frame, from the foe: { vx, vz } its velocity in its own frame (m/s: x its right, z ahead),
 * state and k (the mind's: 'wind' 0..1, 'strike' 0..1), stunned (s), flash (0..1: just hit), melt (0..1: run away).
 * Returns { lx, lz, size, whip, gutter, flick }: the lean (per unit of a tongue's length, back from where it goes),
 * its size (1 at rest; 0 gone), the cut's whip (−1..1, across), how guttered (0..1), how fast it flickers.
 */
export function flameTarget(s) {
  const F = FLAME;
  let lx = -(s.vx ?? 0) * F.lean, lz = -(s.vz ?? 0) * F.lean;
  const m = Math.hypot(lx, lz);
  if (m > F.leanMax) { lx *= F.leanMax / m; lz *= F.leanMax / m; }
  const k = s.k ?? 0;
  const gutter = (s.stunned ?? 0) > 0 || (s.flash ?? 0) > 0.15 ? 1 : 0;
  let flare = 0, whip = 0;
  if (s.state === 'wind') flare = smooth(k / 0.85);
  else if (s.state === 'strike') { flare = 1 - 0.5 * k; whip = Math.sin(2 * Math.PI * Math.min(k * 1.15, 1)) * F.whip; }
  const melt = Math.min(Math.max(s.melt ?? 0, 0), 1);
  const size = (1 + F.flare * flare) * (1 - F.gutter * gutter) * (1 - melt) ** 0.7;
  return { lx, lz, size, whip, gutter, flick: 1 + F.flick * flare + 2.2 * gutter + 1.5 * melt };
}

/** The flame eased toward what it wants (prev is updated in place and returned): it flares fast and dies down slower. */
export function flameDrive(prev, s, dt) {
  const t = flameTarget(s), [up, down, whipRate] = FLAME.ease;
  prev.lx = toward(prev.lx, t.lx, down, dt); prev.lz = toward(prev.lz, t.lz, down, dt);
  prev.size = toward(prev.size, t.size, t.size > prev.size ? up : down, dt);
  prev.whip = toward(prev.whip, t.whip, whipRate, dt);
  prev.gutter = toward(prev.gutter, t.gutter, t.gutter > prev.gutter ? 18 : 4, dt);
  prev.flick = toward(prev.flick, t.flick, up, dt);
  prev.time += dt * prev.flick;   // (its own clock: a faster flicker never jumps)
  return prev;
}

/** A tongue's width along it (u 0 its root … 1 its tip), 0..1: a round root, a bulb a little over a third of the way up, a sharp tip. */
export function tongueRadius(u) {
  if (u <= 0 || u >= 1) return 0;
  const a = u ** 0.7;
  return Math.sin(Math.PI * a) ** 0.6 * (1 - 0.3 * u);
}

/**
 * Where a tongue's axis is at u (0..1), from its root, in the shade's frame (out: Vector3). T a tongue
 * ({ len, tilt: [x, z], phase, wave }), d the drive. It rises its length (flickering), tilted out its own way,
 * leaning back by the drive's lean more toward its tip (u²), whipped across by the cut, and licks: a wave
 * travelling up it, growing toward the tip (choppier when guttered).
 */
export function tongueAxis(u, T, d, out = new THREE.Vector3()) {
  const t = d.time, p = T.phase;
  const len = tongueLength(T, d);
  const amp = T.wave * (1 + 0.8 * d.gutter) * len;
  const w = u ** 1.5, u2 = u * u, u3 = u2 * u;
  const curl = (T.curl ?? 0) * len * u3 * (1 + 0.35 * Math.sin(t * 3.1 + p));   // (its tip curls over, a drawn flame's hook)
  const wx = Math.sin(t * 5.3 - u * 4.2 + p) * amp * w + Math.sin(t * 17 + p * 3) * 0.03 * d.gutter * len * w;
  const wz = Math.cos(t * 4.1 - u * 3.6 + p * 1.7) * amp * 0.6 * w;
  return out.set(T.tilt[0] * len * u + d.lx * len * u2 + d.whip * 0.45 * len * u2 + wx + curl,
    len * u * (1 - 0.25 * Math.min(1, Math.hypot(d.lx, d.lz)) * u) - Math.abs(curl) * 0.4,
    T.tilt[1] * len * u + d.lz * len * u2 + wz);
}

/** A tongue's length now: its own times the flame's size, flickering (two waves, and a jolt when guttered). */
export function tongueLength(T, d) {
  const t = d.time, p = T.phase;
  const flick = 1 + 0.16 * Math.sin(t * 6.1 + p) + 0.09 * Math.sin(t * 13.7 + p * 2.3) + 0.12 * d.gutter * Math.sign(Math.sin(t * 9 + p));
  return T.len * Math.max(d.size, 0) * flick;
}

/** The flame's tongues (from the neck, in the shade's frame: x its right, z ahead): the head's, the shoulders', the back's. */
export const TONGUES = [
  { at: [0, 0.0, 0.02], r: 0.165, len: 0.52, tilt: [0, -0.06], phase: 0, wave: 0.07, curl: 0.12, main: true },
  { at: [0.02, 0.2, -0.03], r: 0.095, len: 0.5, tilt: [0.05, -0.2], phase: 2.7, wave: 0.2, curl: 0.3 },
  { at: [-0.07, 0.15, 0.0], r: 0.08, len: 0.36, tilt: [-0.26, -0.1], phase: 4.1, wave: 0.2, curl: -0.35 },
  { at: [0.07, 0.14, 0.0], r: 0.08, len: 0.4, tilt: [0.22, -0.12], phase: 1.2, wave: 0.2, curl: 0.35 },
  { at: [0.0, 0.08, -0.1], r: 0.085, len: 0.42, tilt: [-0.05, -0.42], phase: 5.3, wave: 0.16, curl: -0.3 },
  { at: [0.12, -0.06, -0.02], r: 0.06, len: 0.24, tilt: [0.42, -0.1], phase: 3.3, wave: 0.22, curl: 0.45 },
  { at: [-0.12, -0.06, -0.02], r: 0.06, len: 0.22, tilt: [-0.42, -0.1], phase: 0.6, wave: 0.22, curl: -0.45 },
];
const SEG = 10, RINGS = 11;
// (the flame's vertices sit this high in its mesh, its root at the neck: the shared material's fold strokes start over 0.3)
const FLAME_Y = 0.5;
/** Where the eye-slits sit on the head's tongue: up it (u), round from its front (rad), and their slant (rad). */
export const EYES = { u: 0.4, round: 0.4, slant: 0.36, w: 0.07, h: 0.026 };

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3(), _n1 = new THREE.Vector3(), _n2 = new THREE.Vector3(), _x = new THREE.Vector3(1, 0, 0);

/** The black flame: its tongues in one mesh, rewritten each frame (a few hundred vertices), sharing the body's material. */
export class ShadeFlame {
  constructor(parent, material, eyeMat) {
    const per = (SEG + 1) * (RINGS + 1), n = TONGUES.length * per;
    const g = new THREE.BufferGeometry(), idx = [];
    TONGUES.forEach((_, k) => {
      for (let j = 0; j < RINGS; j++) for (let i = 0; i < SEG; i++) {
        const a = k * per + j * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    });
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    // aFold: x 1 + round the tongue (3 + on the head's: no lick drawn on it), y up it (materials.js fluid 'shadow')
    const fold = new Float32Array(n * 2);
    TONGUES.forEach((T, k) => { for (let j = 0; j <= RINGS; j++) for (let i = 0; i <= SEG; i++) { const o = k * per + j * (SEG + 1) + i; fold[o * 2] = (T.main ? 3 : 1) + Math.min(i / SEG, 0.999); fold[o * 2 + 1] = j / RINGS; } });
    g.setAttribute('aFold', new THREE.BufferAttribute(fold, 2));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.4, 0), 1.4);   // (generous: it never needs recomputing)
    this.mesh = new THREE.Mesh(g, material);
    Object.assign(this.mesh.userData, { dynamic: true, noCollide: true });
    parent.add(this.mesh);
    // the eye-slits: two white almonds, slanting in
    const almond = new THREE.Shape();
    almond.moveTo(-0.5, 0); almond.quadraticCurveTo(0, 0.9, 0.5, 0); almond.quadraticCurveTo(0, -0.55, -0.5, 0);
    const eg = new THREE.ShapeGeometry(almond, 6);
    this.eyes = [-1, 1].map((side) => {
      const e = new THREE.Mesh(eg, eyeMat);
      Object.assign(e.userData, { dynamic: true, noCollide: true, side });
      this.mesh.add(e);
      return e;
    });
    this.drive = flameRest();
    this.tips = TONGUES.map(() => new THREE.Vector3());
  }

  /** Rewrite the tongues for the drive d, rooted at `neck` (in the parent's frame). */
  update(d, neck) {
    this.mesh.position.copy(neck).y -= FLAME_Y;
    this.mesh.updateMatrixWorld();
    const P = this.mesh.geometry.attributes.position, N = this.mesh.geometry.attributes.normal;
    const per = (SEG + 1) * (RINGS + 1);
    TONGUES.forEach((T, k) => {
      const len = Math.max(tongueLength(T, d), 1e-3);
      for (let j = 0; j <= RINGS; j++) {
        const u = j / RINGS;
        tongueAxis(u, T, d, _a);
        tongueAxis(Math.min(u + 0.04, 1), T, d, _b);
        tongueAxis(Math.max(u - 0.04, 0), T, d, _t);
        _t.subVectors(_b, _t).normalize();   // the axis' tangent
        _n1.copy(_x).addScaledVector(_t, -_x.dot(_t)).normalize();
        _n2.crossVectors(_t, _n1);
        const r = T.r * tongueRadius(u) * Math.min(1, 0.55 + 0.45 * d.size) * (1 - 0.25 * d.gutter);
        const dr = T.r * (tongueRadius(Math.min(u + 0.02, 1)) - tongueRadius(Math.max(u - 0.02, 0))) / (0.04 * len);
        for (let i = 0; i <= SEG; i++) {
          const th = (i / SEG) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), o = k * per + j * (SEG + 1) + i;
          const ox = _n1.x * c + _n2.x * s, oy = _n1.y * c + _n2.y * s, oz = _n1.z * c + _n2.z * s;
          // (a little flatter front to back: a drawn flame's shape)
          P.setXYZ(o, T.at[0] + _a.x + ox * r, FLAME_Y + T.at[1] + _a.y + oy * r, T.at[2] + _a.z + oz * r * 0.85);
          _b.set(ox, oy, oz / 0.85).addScaledVector(_t, -dr).normalize();
          N.setXYZ(o, _b.x, _b.y, _b.z);
        }
        if (j === RINGS) this.tips[k].set(T.at[0] + _a.x, T.at[1] + _a.y, T.at[2] + _a.z).add(neck);   // (in the shade's frame)
        if (T.main && Math.abs(u - EYES.u) < 0.5 / RINGS + 1e-6) this.placeEyes(T, d, u, r);
      }
    });
    P.needsUpdate = true; N.needsUpdate = true;
  }

  /** The eye-slits on the head's tongue, facing out of it: narrowed as it winds up, shut to lines when guttered. */
  placeEyes(T, d, u, r) {
    tongueAxis(u, T, d, _a);
    const wide = 1 + 0.25 * Math.max(0, d.size - 1), shut = 1 - 0.65 * d.gutter, slant = EYES.slant * (1 + 0.5 * Math.max(0, d.size - 1));
    for (const e of this.eyes) {
      const side = e.userData.side, th = -Math.PI / 2 + side * EYES.round;   // (−π/2: its front, +z)
      const ox = _n1.x * Math.cos(th) + _n2.x * Math.sin(th), oy = _n1.y * Math.cos(th) + _n2.y * Math.sin(th), oz = (_n1.z * Math.cos(th) + _n2.z * Math.sin(th)) * 0.85;
      e.position.set(T.at[0] + _a.x + ox * r * 1.02, FLAME_Y + T.at[1] + _a.y + oy * r * 1.02, T.at[2] + _a.z + oz * r * 1.02);
      e.lookAt(_b.set(ox, oy, oz).add(e.position).applyMatrix4(this.mesh.matrixWorld));
      e.rotateZ(-side * slant);
      e.scale.set(EYES.w * wide, EYES.h * shut * Math.min(1, d.size * 1.5), 1);
      e.visible = d.size > 0.08;
    }
  }
}

/** The floor's pools, the falling drops and the rising licks, shared by every shade in a world. */
export class ShadePools {
  constructor(scene) {
    const blob = new THREE.Shape();
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2, r = 0.22 * (1 + 0.25 * Math.sin(a * 3 + 1) + 0.15 * Math.sin(a * 5));
      if (i === 0) blob.moveTo(Math.cos(a) * r, Math.sin(a) * r); else blob.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    this.pools = new Footprints(scene, { count: 120, life: 9, depth: 0.32, geometry: new THREE.ShapeGeometry(blob, 3) });
    // (white-lined, as the shade is: black drops and licks drawn in the paper's white)
    // (smooth, so no crease is drawn across a drop's facets)
    const mat = makeMaterial({ color: '#ffffff', lineWhite: true, key: 'shade-drops' });
    this.drops = new Dots(scene, 220, mat, new THREE.SphereGeometry(1, 8, 6));
    // a lick: a teardrop, pointed up (Dots turn it along its way)
    const lick = new THREE.LatheGeometry(Array.from({ length: 7 }, (_, i) => new THREE.Vector2(tongueRadius(i / 6) * 0.38, i / 6 - 0.3)), 10);
    this.licks = new Dots(scene, 90, mat, lick);
  }
  update(dt) { this.pools.update(dt); this.drops.update(dt, UP); this.licks.update(dt, UP); }
  dispose() { this.pools.mesh?.removeFromParent(); this.drops.mesh?.removeFromParent(); this.licks.mesh?.removeFromParent(); }
}

const _neck = new THREE.Vector3(), _inv = new THREE.Matrix4();

export class ShadeBody {
  constructor(scene, { lib, human, pools }) {
    this.scene = scene; this.pools = pools; this.melt = 1; this.time = Math.random() * 10; this.dripT = 0; this.poolT = 0; this.lickT = 0;
    this.char = buildCharacter({});
    this.group = this.char.root;
    this.group.userData.noCollide = true;
    scene.add(this.group);
    this.humanoid = new Humanoid(human, this.char, 'm', { skin: SHADE_TONES[0], build: 'average' });
    // its own material (its own time and melt): the body, and the flame sharing it
    this.mat = makeMaterial({ ...SHADE_MATERIAL, key: `shade-${uid++}` });
    const eyes = makeMaterial({ color: SHADE_TONES[2], flat: true, glow: 0.95, lineWhite: true, key: 'shade-eyes' });
    this.humanoid.model.traverse((o) => {
      if (!o.isMesh) return;
      o.userData.dynamic = true; o.userData.noCollide = true;
      // (its head is the flame; a costume's pieces, a hat or a pack, are not its: only the skinned body is drawn)
      if (o === this.humanoid.eyeMesh || o === this.humanoid.browMesh || !o.isSkinnedMesh) o.visible = false;
      else o.material = this.mat;
    });
    this.flame = new ShadeFlame(this.group, this.mat, eyes);
    this.neckBone = this.humanoid.b.neck_01 ?? this.humanoid.b.Head;
    this.animator = new Animator(lib, this.char);
    this.animator.bindBody(this.humanoid);
    this.loco = new Locomotion({ walk: 1.4, style: { lean: 0.8, bank: 0.8 } });
    this.last = null;
  }

  update(dt, f) {
    this.time += dt;
    const A = this.animator, N = A.lib.native ?? {};
    const vx = this.last && dt > 0 ? (f.pos.x - this.last.x) / dt : 0, vz = this.last && dt > 0 ? (f.pos.z - this.last.z) / dt : 0;
    const speed = Math.hypot(vx, vz);
    (this.last ??= new THREE.Vector3()).copy(f.pos);
    // its strike: the clip up to the cut as it winds up, on through the follow-through as it recovers
    const S = SHADE_STRIKE;
    if (f.state === 'wind') A.playUpper(S.clip, S.from + f.k * (S.cut - 0.16 - S.from), Math.min(1, f.k * 4));
    else if (f.state === 'strike') A.playUpper(S.clip, S.cut - 0.16 + f.k * 0.29, 1);
    else if (f.state === 'recover' && f._struck !== undefined) {
      f._struck += dt;
      const u = f._struck / 0.45;
      if (u < 1) A.playUpper(S.clip, S.cut + 0.13 + u * (S.to - S.cut - 0.13), 1 - u * u);
    }
    if (f.state === 'wind') f._struck = 0;
    A.update(dt, { speed, onGround: true, mode: 'ground', walkAt: (N.walk ?? 1.4) * 1.3, jogAt: N.jog ?? 3, sprintAt: (N.sprint ?? 6) * 1.2, strideScale: 1.05 });
    this.group.position.copy(f.pos);
    this.group.quaternion.setFromAxisAngle(UP, f.heading);
    A.apply(this.group, { legScale: 1.04 });
    this.loco.update(dt, { vf: speed, speed, heading: f.heading, ground: true });
    this.loco.pose(this.char);
    this.humanoid.update();
    // its time, and how much of it has run away
    const melt = THREE.MathUtils.clamp(this.melt, 0, 1);
    this.mat.uniforms.uFluidA.value.z = this.time;
    this.mat.uniforms.uFluidB.value.y = melt;
    // the flame, rooted at its neck, answering how it moves and what it does (in its own frame: x right, z ahead)
    const c = Math.cos(f.heading), s = Math.sin(f.heading);
    const d = flameDrive(this.flame.drive, { vx: vx * c - vz * s, vz: vx * s + vz * c, state: f.state, k: f.k, stunned: f.stunned, flash: f.flash, melt }, dt);
    this.group.updateMatrixWorld(true);
    _inv.copy(this.group.matrixWorld).invert();
    _neck.setFromMatrixPosition(this.neckBone.matrixWorld).applyMatrix4(_inv);
    _neck.y = Math.min(_neck.y, 2.3 - 2.4 * melt);   // (as it pours away, its flame sinks with it)
    this.flame.update(d, _neck);
    if (!this.pools) return;
    // licks torn off its flame: as it dies, and now and then as it flares or gutters
    this.lickT -= dt;
    const tearing = (f.dead !== undefined && melt < 0.95) || d.size > 1.5 || d.gutter > 0.6;
    if (tearing && this.lickT <= 0) {
      this.lickT = f.dead !== undefined ? 0.02 : 0.09;
      const tip = this.flame.tips[Math.floor(Math.random() * this.flame.tips.length)];
      const at = tip.clone().applyMatrix4(this.group.matrixWorld);
      const back = new THREE.Vector3(d.lx * c + d.lz * s, 0, -d.lx * s + d.lz * c);
      this.pools.licks.add({ pos: at, vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.4 + Math.random(), (Math.random() - 0.5) * 0.6).addScaledVector(back, 2), drag: 1.5, grav: -1.5, size: 0.05 + Math.random() * 0.05, stretch: 3.2, life: 0.45 + Math.random() * 0.3, color: SHADE_TONES[0] });
    }
    // drops fall off it; where it walks, it leaves dark pools
    this.dripT -= dt; this.poolT -= dt;
    if (this.dripT <= 0) {
      this.dripT = 0.22;
      const a = Math.random() * Math.PI * 2, at = new THREE.Vector3(f.pos.x + Math.cos(a) * 0.18, f.pos.y + 0.2 + Math.random() * 0.7, f.pos.z + Math.sin(a) * 0.18);
      this.pools.drops.add({ pos: at, vel: new THREE.Vector3(0, -0.6, 0), grav: 9, size: 0.018 + Math.random() * 0.014, stretch: 2.5, life: 0.5, color: Math.random() < 0.8 ? SHADE_TONES[0] : SHADE_TONES[1] });
    }
    if (this.poolT <= 0 && (speed > 0.3 || Math.random() < 0.02)) {
      this.poolT = speed > 0.3 ? 0.28 : 0.8;
      this.pools.pools.add(new THREE.Vector3(f.pos.x + (Math.random() - 0.5) * 0.3, f.pos.y + 0.02, f.pos.z + (Math.random() - 0.5) * 0.3), Math.random() * Math.PI * 2, UP);
    }
  }

  dispose() { this.group.removeFromParent(); releaseMaterial(this.mat); this.flame.mesh.geometry.dispose(); }
}
