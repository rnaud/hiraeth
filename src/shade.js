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
export const SHADE_STRIKE = { clip: 'mixamo_ss_attack_1', from: 0.55, cut: 1.15, to: 1.7 };   // (the blade's first cut: moves.glb has it)
/** Its black, a near-black for the drops, its eyes' white. */
export const SHADE_TONES = ['#08070a', '#1a1720', '#f7f2e6'];
/** The body's material: one per shade (its own time and melt), the flame's mesh shares it. fluidBox: fold strokes, neck cut (bind y). */
export const SHADE_MATERIAL = { color: SHADE_TONES[0], fluid: 'shadow', fluidBox: [0, 1.8, 1, 1.5], line: 1, lineWhite: true };
const UP = new THREE.Vector3(0, 1, 0);
let uid = 0;

// ------------------------------------------------------------------ the flame's maths (pure: tests/shade-flame.test.js)

/**
 * How the flame answers the body. lean: its tongues' lean back per m/s (local), at most leanMax; flare: how much
 * longer at a wind-up's end; gutter: how much shorter while stilled or hit; whip: the cut's lateral swing; ease:
 * how fast it follows (1/s: up, down, the whip's).
 */
export const FLAME = { lean: 0.16, leanMax: 0.9, flare: 0.45, gutter: 0.55, whip: 1, ease: [10, 5, 14], flick: 1.4 };

const smooth = (x) => { x = Math.min(Math.max(x, 0), 1); return x * x * (3 - 2 * x); };
const toward = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

/** The flame's state at rest. */
export const flameRest = () => ({ lx: 0, lz: 0, size: 0, whip: 0, gutter: 0, flick: 1, time: 0, snap: [0, 0, 0] });

/** Its licks: bulges travelling up a tongue (u, the flame's clock, the tongue's phase), a factor on its width round 1. */
export const lickWave = (u, t, p = 0) => 1 + 0.3 * Math.sin(u * 13 - t * 7.5 + p) * Math.sin(Math.PI * u);

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
  if (prev.snap) for (let i = 0; i < prev.snap.length; i++) prev.snap[i] = Math.max(0, prev.snap[i] - dt * 4);
  return prev;
}

/** A tongue's width along it (u 0 its root … 1 its tip), 0..1: a round root, a bulb a little over a third of the way up, a sharp tip. */
export function tongueRadius(u) {
  if (u <= 0 || u >= 1) return 0;
  const a = u ** 0.8;
  return Math.sin(Math.PI * a) ** 0.5 * (1 - 0.4 * u);
}

/**
 * Where a tongue's axis is at u (0..1), from its root (out: Vector3; x across, y up, z toward the eye: the flame's card uses x and y). T a tongue
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
  const wx = Math.sin(t * 5.3 - u * 6.5 + p) * amp * w + Math.sin(t * 17 + p * 3) * 0.03 * d.gutter * len * w;
  const wz = Math.cos(t * 4.1 - u * 3.6 + p * 1.7) * amp * 0.6 * w;
  return out.set(T.tilt[0] * len * u + d.lx * len * u2 + d.whip * 0.45 * len * u2 + wx + curl,
    len * u * (1 - 0.25 * Math.min(1, Math.hypot(d.lx, d.lz)) * u) - Math.abs(curl) * 0.4,
    T.tilt[1] * len * u + d.lz * len * u2 + wz);
}

/** A tongue's length now: its own times the flame's size, flickering (two waves, and a jolt when guttered), shorter just after its tip broke off. */
export function tongueLength(T, d) {
  const t = d.time, p = T.phase;
  const flick = 1 + 0.16 * Math.sin(t * 6.1 + p) + 0.09 * Math.sin(t * 13.7 + p * 2.3) + 0.12 * d.gutter * Math.sign(Math.sin(t * 9 + p));
  return T.len * Math.max(d.size, 0) * flick * (1 - 0.3 * (d.snap?.[T.i] ?? 0));   // (snap: its tip just broke off)
}

/**
 * The flame's tongues, drawn as a cartoon draws a flame: flat shapes on a card that turns to face the eye (round its
 * upright), overlapping into one silhouette, an onion wrapping the neck that narrows to three wavy tips. In the
 * card's frame from the neck: at [x across, y up, z toward the eye], r its half-width, tilt [across, -].
 */
export const TONGUES = [
  // the flame's body: an onion rising from behind the collar (its root hidden by the chest and shoulders), its
  // tip wavering high over where the head was
  { at: [0, -0.22, 0.06], r: 0.19, len: 0.72, tilt: [0, 0], phase: 0, wave: 0.2, curl: 0.04, main: true },
  // two lesser tips out of its flanks, leaning out and curling back in: three wavy tips in all
  { at: [-0.12, -0.02, 0.05], r: 0.1, len: 0.46, tilt: [-0.26, 0], phase: 2.1, wave: 0.2, curl: 0.34 },
  { at: [0.12, -0.04, 0.045], r: 0.095, len: 0.4, tilt: [0.28, 0], phase: 4.4, wave: 0.2, curl: -0.34 },
].map((T, i) => ({ ...T, i }));
const ROWS = 24, COLS = 7;
// (the flame's vertices sit this high in its mesh, its root at the neck: the shared material's fold strokes start over 0.3)
const FLAME_Y = 0.5;
/** Where the eye-slits sit on the head's tongue: up it (u), apart (of its half-width), and their slant (rad). */
export const EYES = { u: 0.5, apart: 0.42, slant: 0.36, w: 0.075, h: 0.028 };

const _a = new THREE.Vector3(), _w = new THREE.Vector3();

/**
 * The black flame: its tongues on one card in one mesh (525 vertices rewritten each frame), sharing the body's material.
 * The card turns to the eye as it is drawn (onBeforeRender, a perspective camera's: not the shadow's); its normals
 * bulge it (turned out to its edges, so the material's white contour runs round it) and its aFold marks the head's
 * tongue (3 +: its lick only up its tip) from the others (1 +: a white lick up them).
 */
export class ShadeFlame {
  constructor(parent, material, eyeMat) {
    const per = (ROWS + 1) * COLS, n = TONGUES.length * per;
    const g = new THREE.BufferGeometry(), idx = [];
    TONGUES.forEach((_, k) => {
      for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS - 1; i++) {
        const a = k * per + j * COLS + i, b = a + 1, c = a + COLS, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    });
    const nrm = new Float32Array(n * 3), fold = new Float32Array(n * 2);
    TONGUES.forEach((T, k) => {
      for (let j = 0; j <= ROWS; j++) for (let i = 0; i < COLS; i++) {
        const o = k * per + j * COLS + i, sx = (i / (COLS - 1)) * 2 - 1, ph = sx * Math.PI * 0.5 * 0.98;
        nrm[o * 3] = Math.sin(ph); nrm[o * 3 + 1] = 0; nrm[o * 3 + 2] = Math.cos(ph);   // (a bulge: out to its edges)
        fold[o * 2] = (T.main ? 3 : 1) + 0.5 + 0.35 * sx; fold[o * 2 + 1] = j / ROWS;   // (a lick at sx ~0.7)
      }
    });
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('aFold', new THREE.BufferAttribute(fold, 2));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, FLAME_Y + 0.3, 0), 1.2);   // (generous: never recomputed)
    this.mesh = new THREE.Mesh(g, material);
    Object.assign(this.mesh.userData, { dynamic: true, noCollide: true });
    parent.add(this.mesh);
    this.yaw = 0;   // the card's turn in its parent's frame (to the eye, as last drawn)
    this.mesh.onBeforeRender = (renderer, scene, camera) => {
      if (!camera.isPerspectiveCamera || !this.mesh.parent) return;
      const P = this.mesh.parent;
      _w.setFromMatrixPosition(camera.matrixWorld);
      P.worldToLocal(_w);
      this.yaw = Math.atan2(_w.x - this.mesh.position.x, _w.z - this.mesh.position.z);
      this.mesh.rotation.y = this.yaw;
      this.mesh.updateMatrixWorld(true);
    };
    // the eye-slits: two white almonds, slanting in, on the card's face
    const almond = new THREE.Shape();
    almond.moveTo(-0.5, 0); almond.quadraticCurveTo(0, 0.9, 0.5, 0); almond.quadraticCurveTo(0, -0.55, -0.5, 0);
    const eg = new THREE.ShapeGeometry(almond, 6);
    this.eyes = [-1, 1].map((side) => {
      const e = new THREE.Mesh(eg, eyeMat);
      Object.assign(e.userData, { dynamic: true, noCollide: true, side });
      e.onBeforeRender = this.mesh.onBeforeRender;   // (whichever is drawn first turns the card)
      this.mesh.add(e);
      return e;
    });
    this.drive = flameRest();
    this.tips = TONGUES.map(() => new THREE.Vector3());
  }

  /** Rewrite the tongues for the drive d, rooted at `neck` (in the parent's frame). */
  update(d, neck) {
    this.mesh.position.copy(neck).y -= FLAME_Y;
    // the lean across the card (the card faces the eye: a lean toward or away from it only shortens the flame)
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const across = d.lx * c - d.lz * s, along = -(d.lx * s + d.lz * c);
    const dc = { ...d, lx: across, lz: 0 };
    const P = this.mesh.geometry.attributes.position, per = (ROWS + 1) * COLS;
    TONGUES.forEach((T, k) => {
      for (let j = 0; j <= ROWS; j++) {
        const u = j / ROWS;
        tongueAxis(u, T, dc, _a);
        _a.y *= 1 - 0.3 * Math.min(1, Math.abs(along)) * u;   // (leaning toward or away from the eye: foreshortened)
        const r = T.r * tongueRadius(u) * Math.min(1, 0.55 + 0.45 * d.size) * (1 - 0.25 * d.gutter);
        // (its root leans back behind the collar, so the chest and shoulders hide where it starts)
        const z = T.at[2] - 0.15 * (1 - u) ** 4;
        for (let i = 0; i < COLS; i++) {
          // each edge scalloped by its own licks (out of step, left and right): a drawn flame's wavering sides
          const sx = (i / (COLS - 1)) * 2 - 1, rr = r * lickWave(u, d.time, T.phase + 1.7 * sx);
          P.setXYZ(k * per + j * COLS + i, T.at[0] + _a.x + sx * rr, FLAME_Y + T.at[1] + _a.y, z + 0.04 * (1 - sx * sx) * tongueRadius(u));
        }
        if (j === ROWS) this.tips[k].set(T.at[0] + _a.x, T.at[1] + _a.y, T.at[2]);
        if (T.main && j === Math.round(EYES.u * ROWS)) this.placeEyes(d, T, r, z);
      }
      // (the tips in the parent's frame, turned with the card)
      const t = this.tips[k], x = t.x;
      t.set(x * c + t.z * s, t.y, -x * s + t.z * c).add(neck);
    });
    P.needsUpdate = true;
  }

  /** The eye-slits on the head's tongue: narrowed as it winds up, shut to lines when guttered. */
  placeEyes(d, T, r, z) {
    const wide = 1 + 0.25 * Math.max(0, d.size - 1), shut = 1 - 0.65 * d.gutter, slant = EYES.slant * (1 + 0.5 * Math.max(0, d.size - 1));
    for (const e of this.eyes) {
      const side = e.userData.side;
      e.position.set(T.at[0] + _a.x + side * EYES.apart * r, FLAME_Y + T.at[1] + _a.y, z + 0.05);
      e.rotation.set(0, 0, -side * slant);
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
    // (drops plain black, inked as anything is; the licks and wisps white-lined, as the shade is, smooth so no facet is inked)
    this.drops = new Dots(scene, 220, makeMaterial({ color: '#ffffff', key: 'shade-drops' }), new THREE.SphereGeometry(1, 10, 8));
    const mat = makeMaterial({ color: '#ffffff', lineWhite: true, key: 'shade-licks' });
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
    // its tips break off as small rising wisps, now and then at rest; often as it flares or gutters; a stream as it dies
    this.lickT -= dt;
    if (d.size > 0.05 && this.lickT <= 0) {
      const dying = f.dead !== undefined, busy = d.size > 1.3 || d.gutter > 0.6;
      this.lickT = dying ? 0.02 : busy ? 0.1 : 0.35 + Math.random() * 0.45;
      const k = Math.floor(Math.random() * this.flame.tips.length);
      d.snap[k] = 1;   // (the tongue it left jumps short)
      const at = this.flame.tips[k].clone().applyMatrix4(this.group.matrixWorld);
      const back = new THREE.Vector3(d.lx * c + d.lz * s, 0, -d.lx * s + d.lz * c);
      const big = dying ? 1 : 0.6;
      this.pools.licks.add({ pos: at, vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.1 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4).addScaledVector(back, 2), drag: 1.5, grav: -1.2, size: (0.04 + Math.random() * 0.04) * big, stretch: 3.2, life: 0.4 + Math.random() * 0.3, color: SHADE_TONES[0] });
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
