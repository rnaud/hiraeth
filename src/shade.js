import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { Dots } from './fluid-tool.js';
import { Footprints } from './life.js';

// The shadow's leavings (src/foes.js): ShadePools, the dark pools a blot or a shade leaves where it is cut down (and a
// hound or a shade where it steps out of its shadow), the drops it sheds and the licks a cut leaves in the air.
//
// The shade's old body lived here until the enemy roster's batch 5 (v1.18): the game's skinned person drawn as a cartoon's
// negative, a black flame for a head. The shade is now a cloak worn by nothing on its own body (src/enemies/plans/
// humanoid.js); the flame's maths and its white-lined material stay (tests/shade-flame.test.js), unused by any foe.

/** The strike from motion capture: the clip, its wind-up (start → the cut) and its follow-through. */
export const SHADE_STRIKE = { clip: 'mixamo_ss_attack_1', from: 0.55, cut: 1.15, to: 1.7 };   // (the blade's old leaping third, v1.38 and before: moves.glb keeps it for the shade)
/** Its black, a near-black for the drops, its eyes' white. */
export const SHADE_TONES = ['#08070a', '#1a1720', '#f7f2e6'];
/** The body's material: one per shade (its own time and melt), the flame's mesh shares it. fluidBox: fold strokes, neck cut (bind y). */
export const SHADE_MATERIAL = { color: SHADE_TONES[0], fluid: 'shadow', fluidBox: [0, 1.8, 1, 1.5], line: 1, lineWhite: true };
const UP = new THREE.Vector3(0, 1, 0);

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
