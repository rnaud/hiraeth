import * as THREE from 'three';
import { bodySpan } from './foe-body.js';

// The lock-on's reticle (#foe-lock, docs/systems/foes.md "The lock-on"). v1.42, the author: "closer to Ocarina of Time
// (4 arrows pointing towards the character that are rotating) and less complicated; remove the health bar, and remove the
// red when the character is attacking: it should be obvious". So: four gold arrowheads round the foe, their tips pointing
// in at it, turning slowly round it. No health pips, no colours or shapes for its wind-up, its strike or its stagger:
// the foe's own body tells those. Only a foe out of the blade's reach (a ray under the sand, a hound running as a shadow)
// dims it.
// The arrows ride a rounded box round the foe's drawn body on the screen (src/foe-body.js bodySpan, its parts as posed)
// grown by a gap, so they turn round it without sitting on it, and a far foe's ring is no smaller than RETICLE.min. A new
// lock flies them in from wider, spinning faster as they come (as Ocarina's did). Off the screen they wait small at the
// edge on its side. Each arrow is drawn over a soft pale halo and an ink edge, two-toned like a little pyramid, so it
// reads on bright sand and on dark rock; the whole drawing scales with the screen (reticleScale: a quarter larger on a
// small screen, where a CSS pixel is tiny). Replaces v1.39's corner ticks, diamond and pips, and v1.41's bolder ones.
//
//   const r = new LockReticle(); r.update(foe | null, camera, dt); r.acquire(); r.dispose()

export const RETICLE = {
  min: 30, max: 300,          // px: the ring's half-size on the screen, at least / at most (× reticleScale)
  margin: 0.35,               // m round the foe's body (the ring of a body with no parts to measure: its sphere)
  gap: 14,                    // px between the body's box and the arrows' tips
  round: 4,                   // the ring's shape: a superellipse of this power (2 an ellipse, higher a rounder box)
  arrow: 18, wide: 17,        // px: each arrowhead's length (tip to back) and width at its back
  edge: 2.6, halo: 5,         // px: the ink edge round each arrow, and the pale halo under it
  haloA: 0.45,                // the halo's opacity
  spin: 1.4,                  // rad/s the arrows turn round the foe
  breathe: 0.06,              // × the gap: the arrows ease in and out a little
  snap: 0.35,                 // s a new lock takes to fly in
  from: 2.4,                  // × the ring's size the arrows fly in from
  whirl: 5,                   // rad: the extra turn while they fly in
  veiled: 0.5,                // opacity out of the blade's reach
  scale: { at: 720, lo: 1, hi: 1.7, small: 560, boost: 1.25 },   // reticleScale
  ink: '#2b211f', gold: '#f2c54b', shade: '#c98f22', light: '#fff6dc',
};

/**
 * How large the reticle is drawn on a W × H (CSS px) screen (pure: tests): 1 at 720 px (the shorter side), growing with
 * the screen up to RETICLE.scale.hi, and a quarter larger on a small screen (under `small` px: a handheld, a phone),
 * where a CSS pixel is physically small.
 */
export function reticleScale(W, H, R = RETICLE) {
  const S = R.scale, m = Math.min(W, H) || S.at;
  return THREE.MathUtils.clamp(m / S.at, S.lo, S.hi) * (m < S.small ? S.boost : 1);
}

/** What the reticle shows for foe f (pure: tests): { mode: 'calm' | 'veiled' }, null with no foe. Nothing else: its wind-up, strike and stagger are the body's to show. */
export function reticleLook(f) {
  if (!f) return null;
  return { mode: f.buried || f.phased ? 'veiled' : 'calm' };
}

/**
 * The ring round a body box on the screen (pure: tests): `box` { x0, y0, x1, y1 } in px, the ease-in (0..1), the
 * screen's scale k. Returns { cx, cy, rx, ry }: its centre and half-sizes, the box grown by the gap (and, easing in, by
 * RETICLE.from), at least RETICLE.min, at most RETICLE.max, × k.
 */
export function reticleRing(box, ease = 1, out = {}, k = 1, t = 0) {
  const R = RETICLE, g = R.gap * k * (1 + R.breathe * Math.sin(t * 2.6));
  const grow = 1 + (R.from - 1) * (1 - ease);
  out.cx = (box.x0 + box.x1) / 2; out.cy = (box.y0 + box.y1) / 2;
  out.rx = THREE.MathUtils.clamp((box.x1 - box.x0) / 2 + g, R.min * k, R.max * k) * grow;
  out.ry = THREE.MathUtils.clamp((box.y1 - box.y0) / 2 + g, R.min * k, R.max * k) * grow;
  return out;
}

/**
 * Where each arrow's tip sits on the ring, and the way it points (pure: tests): angle a round it (0: to the right, y
 * down the screen). The ring is a superellipse (RETICLE.round), so a turning arrow keeps close to the box's corners
 * without cutting into them much. Returns { x, y, dx, dy } relative to the centre: the tip, and the unit way in.
 */
export function arrowAt(ring, a, out = {}) {
  const c = Math.cos(a), s = Math.sin(a), p = 2 / RETICLE.round;
  out.x = ring.rx * Math.sign(c) * Math.abs(c) ** p;
  out.y = ring.ry * Math.sign(s) * Math.abs(s) ** p;
  const l = Math.hypot(out.x, out.y) || 1;
  out.dx = -out.x / l; out.dy = -out.y / l;
  return out;
}

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent = null) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
};

const _p = new THREE.Vector3(), _k = new THREE.Vector3(), _box = { x0: 0, y0: 0, x1: 0, y1: 0 }, _ring = {}, _at = {};

export class LockReticle {
  constructor(parent = document.body) {
    const R = RETICLE, L = R.arrow, w = R.wide / 2;
    this.root = Object.assign(document.createElement('div'), { id: 'foe-lock' });
    this.root.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:24;display:none';
    this.svg = el('svg', { width: 2, height: 2, style: 'position:absolute;left:0;top:0;overflow:visible' });
    this.root.appendChild(this.svg);
    // each arrow drawn pointing down (+y) with its tip at the origin: a halo, an ink edge, then two faces (lit, shaded)
    const tri = `M0,0 L${w},${-L} L${-w},${-L}Z`;
    this.arrows = [0, 1, 2, 3].map(() => {
      const g = el('g', {}, this.svg);
      el('path', { d: tri, fill: R.light, stroke: R.light, 'stroke-width': R.edge + R.halo * 2, 'stroke-linejoin': 'round', opacity: R.haloA }, g);
      el('path', { d: tri, fill: R.ink, stroke: R.ink, 'stroke-width': R.edge * 2, 'stroke-linejoin': 'round', opacity: 0.85 }, g);
      el('path', { d: `M0,0 L${w},${-L} L0,${-L * 0.72}Z`, fill: R.shade }, g);
      el('path', { d: `M0,0 L0,${-L * 0.72} L${-w},${-L}Z`, fill: R.gold }, g);
      return g;
    });
    parent.appendChild(this.root);
    this.t = 0; this.snap = 1; this.foe = null;
    this.span = { lo: 0, hi: 0, centre: new THREE.Vector3(), radius: 0 };
  }

  /** A new foe locked: the arrows fly in on it. */
  acquire() { this.snap = 0; }

  /** The foe's drawn body as a box on the screen (px), or null (behind the camera: the caller holds it at the edge). */
  screenBox(f, camera, W, H) {
    const model = f.model;
    let box = null;
    if (model?.group) {
      try { bodySpan(model, this.span); box = this.span._box; } catch { box = null; }
      if (box?.isEmpty()) box = null;
    }
    const b = _box; b.x0 = b.y0 = Infinity; b.x1 = b.y1 = -Infinity;
    const put = (v) => {
      _p.copy(v).project(camera);
      if (_p.z > 1) return false;
      const x = (_p.x * 0.5 + 0.5) * W, y = (0.5 - _p.y * 0.5) * H;
      b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y);
      return true;
    };
    if (box) {
      for (let k = 0; k < 8; k++) if (!put(_k.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z))) return null;
      return b;
    }
    // (no parts to measure: its sphere round the chest)
    if (!put(f.chest)) return null;
    const dist = Math.max(0.5, camera.position.distanceTo(f.chest)), fov = THREE.MathUtils.degToRad(camera.fov ?? 60);
    const r = ((f.def?.radius ?? 0.6) + RETICLE.margin) / dist * (H / 2) / Math.tan(fov / 2);
    b.x0 -= r; b.x1 += r; b.y0 -= r; b.y1 += r;
    return b;
  }

  update(f, camera, dt = 0) {
    const R = RETICLE;
    if (f !== this.foe) { if (f) this.snap = Math.min(this.snap, 0); this.foe = f; }
    if (!f || !camera) { if (this.shown !== false) { this.root.style.display = 'none'; this.shown = false; } return; }
    this.t += dt; this.snap = Math.min(1, this.snap + dt / R.snap);
    const look = reticleLook(f);
    const W = window.innerWidth, H = window.innerHeight, K = reticleScale(W, H);
    const ease = 1 - (1 - this.snap) ** 3;
    // where: the body's box on the screen; off it (or behind), held small at the edge on its side
    const box = this.screenBox(f, camera, W, H);
    let ring;
    if (box && box.x1 > W * 0.04 && box.x0 < W * 0.96 && box.y1 > H * 0.05 && box.y0 < H * 0.95) ring = reticleRing(box, ease, _ring, K, this.t);
    else {
      _p.copy(f.chest).project(camera);
      const behind = _p.z > 1;
      let x = behind ? -_p.x : _p.x, y = behind ? -_p.y : _p.y;
      const k = 1 / Math.max(Math.abs(x) / 0.88, Math.abs(y) / 0.84, 1e-3); if (k < 1 || behind) { x *= k; y *= k; }
      const r = R.min * K * (1 + (R.from - 1) * (1 - ease));
      ring = Object.assign(_ring, { cx: (x * 0.5 + 0.5) * W, cy: (0.5 - y * 0.5) * H, rx: r, ry: r });
    }
    if (this.shown !== true) { this.root.style.display = ''; this.shown = true; }
    this.root.style.transform = `translate(${ring.cx.toFixed(1)}px,${ring.cy.toFixed(1)}px)`;
    const opacity = ((look.mode === 'veiled' ? R.veiled : 1) * Math.min(1, ease * 1.6)).toFixed(2);
    if (opacity !== this.opacity) { this.root.style.opacity = opacity; this.opacity = opacity; }
    // the turn: steady, with an extra whirl as a new lock flies in
    const turn = this.t * R.spin + R.whirl * (1 - ease);
    this.arrows.forEach((g, i) => {
      const a = arrowAt(ring, turn + i * Math.PI / 2, _at);
      const deg = Math.atan2(a.dy, a.dx) * 180 / Math.PI - 90;   // (drawn pointing down, +y: turned to point along dx, dy)
      g.setAttribute('transform', `translate(${a.x.toFixed(1)},${a.y.toFixed(1)}) rotate(${deg.toFixed(1)}) scale(${K.toFixed(3)})`);
    });
  }

  dispose() { this.root.remove(); }
}
