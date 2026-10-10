import * as THREE from 'three';
import { SecondOrder } from './motion-kit/spring.js';

// "I've been hit" (docs/systems/foes.md, "Hit and defeat", v1.35): what a foe's body does when a blow lands, for every
// archetype, on top of its own pose. src/foes.js Foes.hurt calls hit(); the look applies it each frame.
//
//   - the flinch: the body (the kit's `body`, which the legs hang from: the rig re-solves them after it, so the feet stay
//     planted) is shoved along the blow and tipped away from it on springs (SecondOrder: quick, overshooting a little),
//     and squashed; a stagger (a heavy blow, the riposte, a charged cut: the mind's reel 'staggered') is a bigger, slower
//     shove with a lean held while it reels, so it reads apart from a light flinch
//   - the flash: its ink goes bright a blink (flash()): the body's colour toward a pale tone, self-lit (uGlow, over the
//     bloom's threshold: a printed halo) and its line drawn white for the first frames (uLineWhite: the shade, already
//     white-lined, goes black), the material flags the post pass already reads (src/materials.js); no pass is touched
//   - the splash where the blade met it (Foes.hurt): ink and its own colours off a creature, sparks off a machine, black
//     ink off a spirit
// Armoured glances keep their own look (Foes.hurt 'glance': the sparks and the thunk, no flash, no flinch).

export const REACT = {
  // m shoved along the blow, rad tipped away from it, squash (share of its height), springs (Hz, ζ)
  flinch: { push: 0.14, tip: 0.2, squash: 0.16, f: 3.4, z: 0.38 },
  stagger: { push: 0.3, tip: 0.42, squash: 0.24, f: 1.9, z: 0.45, lean: 0.22 },
  shrug: { push: 0.06, tip: 0.08, squash: 0.06, f: 4.5, z: 0.4 },   // (a cut it shrugged off: it told, but it comes on)
  // the flash: s it lasts, how self-lit, how far toward the pale tone, s of white line at its start
  flash: { time: 0.18, glow: 0.92, white: 0.7, line: 0.08 },
  tone: { creature: '#fff3dc', machine: '#ffe2a0', spirit: '#e6f0ff' },
};

const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3(), _ax = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _c = new THREE.Color();

/** A foe's hit reaction: springs on the body's shove, tip and squash; the flash's clock. */
export class FoeReact {
  constructor(family = 'creature') {
    this.family = family;
    this.push = new SecondOrder(REACT.flinch.f, REACT.flinch.z, 0);
    this.tip = new SecondOrder(REACT.flinch.f, REACT.flinch.z, 0);
    this.squash = new SecondOrder(REACT.flinch.f * 1.4, REACT.flinch.z, 0);
    this.dir = new THREE.Vector3(0, 0, 1);   // (the blow's way, flat, world)
    this.flashT = 0; this.flashK = 0; this.lean = 0; this.leanT = 0; this.kind = null; this.age = Infinity;
    this.base = null;
  }

  /**
   * A blow from `dir` (world; null: straight on its front) of `kind` ('flinch' | 'stagger' | 'shrug'); `size`: its body's
   * scale (a brute moves less than a skitter); `flash`: its ink goes bright.
   */
  hit(dir, kind = 'flinch', { size = 1, flash = true, hold = 0 } = {}) {
    const R = REACT[kind] ?? REACT.flinch, k = 1 / Math.max(0.8, Math.pow(size, 0.35));
    if (dir && dir.lengthSq() > 1e-8) this.dir.set(dir.x, 0, dir.z).normalize();
    for (const s of [this.push, this.tip]) s.set(R.f, R.z, 0);
    this.squash.set(R.f * 1.4, R.z, 0);
    // (an impulse: the springs at rest are kicked, overshoot and settle; the peak is about the tuning's size)
    const w = 2 * Math.PI * R.f;
    this.push.yd += R.push * k * w * 1.3; this.tip.yd += R.tip * k * w * 1.3; this.squash.yd += R.squash * w * 1.8;
    this.lean = R.lean ?? 0; this.leanT = kind === 'stagger' ? Math.max(0.35, hold) : 0;
    this.kind = kind; this.age = 0;
    if (flash) this.flashT = REACT.flash.time;
  }

  /** The springs a frame. */
  update(dt) {
    if (!(dt > 0)) return;
    this.age += dt;
    this.leanT = Math.max(0, this.leanT - dt);
    const leanK = this.leanT > 0 ? this.lean : 0;
    this.push.update(dt, leanK * 0.5); this.tip.update(dt, leanK); this.squash.update(dt, 0);
    this.flashT = Math.max(0, this.flashT - dt);
    this.flashK = this.flashT > 0 ? Math.pow(this.flashT / REACT.flash.time, 0.6) : 0;
  }

  /** Is anything still moving (worth applying)? */
  get live() { return this.flashT > 0 || this.leanT > 0 || Math.abs(this.push.y) + Math.abs(this.tip.y) + Math.abs(this.squash.y) > 1e-3 || Math.abs(this.push.yd) + Math.abs(this.tip.yd) > 1e-2; }
}

/**
 * Put the body back as its own pose left it (before the model poses it again: a part the model doesn't set each frame
 * would otherwise keep last frame's shove).
 */
export function restoreBody(react, body) {
  const B = react?.base;
  if (!B || !B.set) return;
  body.position.copy(B.pos); body.quaternion.copy(B.quat); body.scale.copy(B.scale);
  B.set = false;
}

/** The shove, tip and squash on `body` (its pose this frame kept to put back). Call after the model posed it, before its legs are solved. */
export function applyReact(react, body, extra = null) {
  if (!react || !body) return;
  const live = react.live, more = extra && (extra.y || extra.pitch || extra.roll || extra.sx !== 1 || extra.sy !== 1);
  if (!live && !more) return;
  const B = (react.base ??= { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: new THREE.Vector3(), set: false });
  B.pos.copy(body.position); B.quat.copy(body.quaternion); B.scale.copy(body.scale); B.set = true;
  // the blow's way in the body's parent's frame (its world turn undone)
  const parent = body.parent;
  if (parent) parent.getWorldQuaternion(_pq).invert(); else _pq.identity();
  const ps = parent ? parent.getWorldScale(_ax).x || 1 : 1;
  _d.copy(react.dir).applyQuaternion(_pq).normalize();
  if (live) {
    const push = react.push.y / ps, tip = react.tip.y, sq = THREE.MathUtils.clamp(react.squash.y, -0.4, 0.5);
    body.position.addScaledVector(_d, push);
    // tipped away from the blow: its top goes the blow's way (turned about the axis across it)
    _ax.crossVectors(UP, _d); if (_ax.lengthSq() > 1e-8) { _ax.normalize(); body.quaternion.premultiply(_q.setFromAxisAngle(_ax, tip)); }
    body.scale.multiply(_ax.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5));
  }
  if (more) {
    // (a defeat's own moves on the body: sagging onto its legs, tipping over: src/enemies/defeat.js)
    body.position.y += (extra.y ?? 0) / ps;
    if (extra.pitch) body.quaternion.premultiply(_q.setFromAxisAngle(_ax.set(1, 0, 0), extra.pitch));
    if (extra.roll) body.quaternion.premultiply(_q.setFromAxisAngle(_ax.set(0, 0, 1), extra.roll));
    body.scale.multiply(_ax.set(extra.sx ?? 1, extra.sy ?? 1, extra.sx ?? 1));
  }
}

/**
 * The flash on a model: each of its meshes, as it is drawn (not in the shadow pass, whose material is the scene's
 * override), takes the pale tone, the self-light and (at the start) the white line, then gives its material back. Installed
 * once per model; costs nothing while `react.flashK` is 0.
 */
export function installFlash(model, react) {
  if (model._flash) return;
  model._flash = true;
  const tone = new THREE.Color(REACT.tone[react.family] ?? REACT.tone.creature);
  const saved = { color: new THREE.Color(), glow: 0, line: 0, touched: false };
  const before = function (renderer, scene, camera, geometry, material) {
    const k = react.flashK;
    if (!(k > 0) || material !== this.material || !material.uniforms?.uColor) return;
    const U = material.uniforms, F = REACT.flash;
    saved.color.copy(U.uColor.value); saved.glow = U.uGlow?.value ?? 0; saved.line = U.uLineWhite?.value ?? 0; saved.touched = true;
    U.uColor.value.lerp(tone, F.white * k);
    if (U.uGlow) U.uGlow.value = Math.max(saved.glow, F.glow * k);
    if (U.uLineWhite && react.flashT > F.time - F.line) U.uLineWhite.value = saved.line > 0.5 ? 0 : 1;
    material.uniformsNeedUpdate = true;
  };
  const after = function (renderer, scene, camera, geometry, material) {
    if (!saved.touched || material !== this.material) return;
    const U = material.uniforms;
    U.uColor.value.copy(saved.color);
    if (U.uGlow) U.uGlow.value = saved.glow;
    if (U.uLineWhite) U.uLineWhite.value = saved.line;
    material.uniformsNeedUpdate = true;
    saved.touched = false;
  };
  model.group.traverse((o) => { if (o.isMesh) { o.onBeforeRender = before; o.onAfterRender = after; } });
}

/** The colours of the splash where a blow lands, by family: its own tones and a pale fleck; sparks; black ink. */
export function splashTones(family, tones = []) {
  if (family === 'machine') return ['#fff6dc', '#ffd27a', '#ffb347', tones[0] ?? '#5a5048'];
  if (family === 'spirit') return ['#0b0910', '#1d1826', tones[0] ?? '#3b3350', '#f3eee4'];
  return [tones[0] ?? '#3b3350', '#f3eee4', tones[1] ?? '#5a4a8a', '#f3eee4'];
}

/** (tests) A colour's lightness, 0..1. */
export const lightness = (c) => { _c.set(c); const hsl = {}; _c.getHSL(hsl); return hsl.l; };
