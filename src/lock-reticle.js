import * as THREE from 'three';
import { bodySpan } from './foe-body.js';

// The lock-on's reticle (#foe-lock, docs/systems/foes.md "The lock-on"; v1.39: thin and quiet, it was four thick gold
// chevrons on a ring over the foe's chest). Four fine ink ticks frame the foe's drawn body at its corners, a small diamond
// settles over its head, and a row of tiny pips over the diamond counts what is left of it. Nothing is drawn on the body:
// the frame is the body's own box on the screen (src/foe-body.js bodySpan, its parts as posed) grown by a gap.
// It is not only a marker: it reads the foe for you.
// - calm: gold, breathing a little;
// - winding up: the ticks tint coral, double and close in on the body as the strike comes (at the strike: guard, or go);
// - open (stunned, parried, flipped, asleep, reeling): pale blue, the ticks turned in toward it, held wide;
// - out of the blade's reach (a ray under the sand, a hound running as a shadow): dimmed and dashed.
// Never by colour alone (a colour-blind player reads the shapes): winding up, each tick doubles and closes in; open, the
// corner ticks turn into short strokes pointing in, and the diamond becomes a hollow ring; at the strike a small four-point
// burst; veiled, all of it dashed (reticleShape).
// It eases in on a new foe (from wider and faint, the diamond dropping onto it). Off the screen it waits at the edge on
// its side, small. Each stroke is a coloured line over a softer ink one, so it reads on bright sand and in the dark.
//
//   const r = new LockReticle(); r.update(foe | null, camera, dt); r.acquire(); r.dispose()

export const RETICLE = {
  min: 14, max: 260,          // px: the frame's half-size on the screen, at least / at most
  margin: 0.35,               // m round the foe's body (the frame of a body with no parts to measure: its sphere)
  gap: 9,                     // px between the body's box and the ticks (× the spread)
  tick: 11,                   // px: each corner tick's arms
  line: 1.8, under: 3.6,      // px: the coloured stroke, the ink one under it
  close: 0.35,                // the gap at the strike, × the calm one (the ticks close in, never onto the body)
  open: 1.7,                  // × the gap while it is open
  snap: 0.32,                 // s the ease-in takes
  drop: 16,                   // px the diamond settles from
  pips: 8,                    // most pips drawn (more hp: each stands for more)
  ink: '#2b211f', gold: '#f2c54b', cream: '#f7ecd2', red: '#ef6a4c', blue: '#bfe9ff',
};

/**
 * What the reticle shows for foe f (pure: tests): { mode: 'calm' | 'wind' | 'strike' | 'open' | 'veiled', k (the
 * wind-up 0..1), hp, max }.
 */
export function reticleLook(f) {
  if (!f) return null;
  const hp = Math.max(0, Math.ceil(f.hp ?? 0)), max = f.def?.hp ?? hp;
  let mode = 'calm';
  if (f.buried || f.phased) mode = 'veiled';
  else if (f.stunned > 0 || f.flipped > 0 || f.sleep > 0 || (f.state === 'recover' && f.reel)) mode = 'open';
  else if (f.state === 'wind') mode = 'wind';
  else if (f.state === 'strike') mode = 'strike';
  return { mode, k: mode === 'wind' ? f.k ?? 0 : mode === 'strike' ? 1 : 0, hp, max };
}

/**
 * The shape of each look, besides its colour (pure: tests): the ticks point 'out' (corners round the body: calm, winding
 * up) or 'in' (open: short strokes pointing at it), are single or doubled, dashed or not, under a 'diamond', a hollow
 * 'ring' or a 'burst'. Every mode differs from the others in shape.
 */
export function reticleShape(look) {
  const mode = look?.mode ?? 'calm';
  return {
    point: mode === 'open' ? 'in' : 'out',
    double: mode === 'wind' || mode === 'strike',
    dash: mode === 'veiled',
    centre: mode === 'open' ? 'ring' : mode === 'strike' ? 'burst' : 'diamond',
  };
}

/** The gap between the body and the ticks, × RETICLE.gap, for a look (pure: tests; the name is the old chevrons'). */
export function chevronSpread(look, t = 0) {
  if (!look) return 1;
  if (look.mode === 'wind') return THREE.MathUtils.lerp(1, RETICLE.close, look.k * look.k);
  if (look.mode === 'strike') return RETICLE.close * 0.9;
  if (look.mode === 'open') return RETICLE.open + Math.sin(t * 6) * 0.08;
  return 1 + Math.sin(t * 2.4) * 0.05;
}

/**
 * The frame round a body box on the screen (pure: tests): `box` { x0, y0, x1, y1 } in px, the spread, the ease-in (0..1).
 * Returns { cx, cy, hw, hh }: its centre and half-size, the body's box grown by the gap on every side (the ticks sit on
 * its corners, outside the body), at least RETICLE.min, at most RETICLE.max.
 */
export function reticleFrame(box, spread = 1, ease = 1, out = {}) {
  const R = RETICLE, g = R.gap * spread + (1 - ease) * 2.2 * R.gap;
  out.cx = (box.x0 + box.x1) / 2; out.cy = (box.y0 + box.y1) / 2;
  out.hw = THREE.MathUtils.clamp((box.x1 - box.x0) / 2 + g, R.min, R.max);
  out.hh = THREE.MathUtils.clamp((box.y1 - box.y0) / 2 + g, R.min, R.max);
  return out;
}

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent = null) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
};
/** A stroke as drawn: a soft ink line under a fine coloured one. Returns the coloured one (the ink one is .under). */
function inked(d, parent, R = RETICLE) {
  const under = el('path', { d, fill: 'none', stroke: R.ink, 'stroke-width': R.under, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.5 }, parent);
  const top = el('path', { d, fill: 'none', stroke: R.gold, 'stroke-width': R.line, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
  top.under = under;
  return top;
}

const _p = new THREE.Vector3(), _c = new THREE.Vector3(), _k = new THREE.Vector3(), _box = { x0: 0, y0: 0, x1: 0, y1: 0 }, _fr = {};

export class LockReticle {
  constructor(parent = document.body) {
    const R = RETICLE, L = R.tick;
    this.root = Object.assign(document.createElement('div'), { id: 'foe-lock' });
    this.root.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:24;display:none';
    this.svg = el('svg', { width: 2, height: 2, style: 'position:absolute;left:0;top:0;overflow:visible' });
    this.root.appendChild(this.svg);
    // the four corners, each drawn as the top left one turned: an L along the frame's edges (out), or a short stroke
    // pointing in at the body (in); a second L outside it while winding up
    this.corners = [0, 1, 2, 3].map((i) => {
      const g = el('g', {}, this.svg), turn = el('g', { transform: `rotate(${i * 90})` }, g);
      const ell = inked(`M0,${L} L0,0 L${L},0`, turn);
      const second = el('g', { transform: 'translate(-3.6,-3.6)', style: 'display:none' }, turn);
      const ell2 = inked(`M0,${L * 0.8} L0,0 L${L * 0.8},0`, second);
      const stroke = inked('M-1.5,-1.5 L5,5', turn);
      return { g, ell, second, ell2, stroke };
    });
    // over its head: the diamond (open: a hollow ring; the strike: a small four-point burst), the pips above it
    this.crown = el('g', {}, this.svg);
    this.diamond = el('g', {}, this.crown);
    el('path', { d: 'M0,-6 L4.6,0 L0,6 L-4.6,0Z', fill: R.ink, opacity: 0.6 }, this.diamond);
    this.dot = el('path', { d: 'M0,-4.4 L3.2,0 L0,4.4 L-3.2,0Z', fill: R.gold }, this.diamond);
    this.ringC = el('g', { style: 'display:none' }, this.crown);
    this.ringDot = inked('M4,0 A4,4 0 1 1 -4,0 A4,4 0 1 1 4,0Z', this.ringC);
    this.burst = el('g', { style: 'display:none' }, this.crown);
    el('path', { d: 'M0,-7 L1.8,-1.8 L7,0 L1.8,1.8 L0,7 L-1.8,1.8 L-7,0 L-1.8,-1.8Z', fill: R.ink, opacity: 0.6 }, this.burst);
    this.burstDot = el('path', { d: 'M0,-5 L1.1,-1.1 L5,0 L1.1,1.1 L0,5 L-1.1,1.1 L-5,0 L-1.1,-1.1Z', fill: R.red }, this.burst);
    this.pipsG = el('g', {}, this.crown);
    this.pips = [];
    parent.appendChild(this.root);
    this.t = 0; this.snap = 1; this.foe = null; this.flash = 0; this.lastMode = null;
    this.span = { lo: 0, hi: 0, centre: new THREE.Vector3(), radius: 0 };
  }

  /** A new foe locked: the reticle eases in on it. */
  acquire() { this.snap = 0; }

  /** The pips: one per hp up to RETICLE.pips (more: each stands for a share), in a row over the diamond. */
  drawPips(look) {
    const R = RETICLE, n = Math.min(R.pips, Math.max(1, look.max)), per = look.max / n;
    while (this.pips.length < n) {
      const g = el('g', {}, this.pipsG);
      el('circle', { r: 2.5, fill: R.ink, opacity: 0.6 }, g);
      this.pips.push({ g, fill: el('circle', { r: 1.6, fill: R.cream }, g) });
    }
    const gap = 6;
    this.pips.forEach((p, i) => {
      if (i >= n) { p.g.style.display = 'none'; return; }
      p.g.style.display = '';
      p.g.setAttribute('transform', `translate(${((i - (n - 1) / 2) * gap).toFixed(1)},-12)`);
      const left = look.hp / per - i;   // (this pip's share left: 1 full, 0 gone)
      p.fill.setAttribute('fill', left > 0.5 ? (look.mode === 'open' ? R.blue : R.cream) : R.ink);
      p.fill.setAttribute('r', left > 0.5 ? 1.6 : 0.8);
    });
  }

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
    if (!f || !camera) { this.root.style.display = 'none'; return; }
    this.t += dt; this.snap = Math.min(1, this.snap + dt / R.snap);
    const look = reticleLook(f);
    if (look.mode === 'strike' && this.lastMode !== 'strike') this.flash = 1;   // (the strike: a white flash as they meet)
    this.lastMode = look.mode;
    this.flash = Math.max(0, this.flash - dt * 5);
    const W = window.innerWidth, H = window.innerHeight;
    const s = this.snap, ease = 1 - (1 - s) ** 3;
    // where: the body's box on the screen; off it (or behind), held small at the edge on its side
    const box = this.screenBox(f, camera, W, H);
    let fr;
    const onScreen = box && box.x1 > W * 0.04 && box.x0 < W * 0.96 && box.y1 > H * 0.05 && box.y0 < H * 0.95;
    if (onScreen) fr = reticleFrame(box, chevronSpread(look, this.t), ease, _fr);
    else {
      _c.copy(f.chest); _p.copy(_c).project(camera);
      const behind = _p.z > 1;
      let x = behind ? -_p.x : _p.x, y = behind ? -_p.y : _p.y;
      const k = 1 / Math.max(Math.abs(x) / 0.88, Math.abs(y) / 0.84, 1e-3); if (k < 1 || behind) { x *= k; y *= k; }
      fr = Object.assign(_fr, { cx: (x * 0.5 + 0.5) * W, cy: (0.5 - y * 0.5) * H, hw: R.min, hh: R.min });
    }
    this.root.style.display = '';
    this.root.style.transform = `translate(${fr.cx.toFixed(1)}px,${fr.cy.toFixed(1)}px)`;
    this.root.style.opacity = String((look.mode === 'veiled' ? 0.55 : 1) * ease);
    const colour = this.flash > 0.3 ? '#ffffff' : look.mode === 'wind' || look.mode === 'strike' ? R.red : look.mode === 'open' ? R.blue : R.gold;
    const shape = reticleShape(look), dash = shape.dash ? '2.5 3' : 'none';
    const at = [[-fr.hw, -fr.hh], [fr.hw, -fr.hh], [fr.hw, fr.hh], [-fr.hw, fr.hh]];
    this.corners.forEach((c, i) => {
      c.g.setAttribute('transform', `translate(${at[i][0].toFixed(1)},${at[i][1].toFixed(1)})`);
      const out = shape.point === 'out';
      c.ell.style.display = c.ell.under.style.display = out ? '' : 'none';
      c.stroke.style.display = c.stroke.under.style.display = out ? 'none' : '';
      c.second.style.display = shape.double && out ? '' : 'none';
      for (const top of [c.ell, c.ell2, c.stroke]) { top.setAttribute('stroke', colour); top.setAttribute('stroke-dasharray', dash); top.under.setAttribute('stroke-dasharray', dash); }
    });
    // the crown over its head, settling onto it as it eases in
    this.crown.setAttribute('transform', `translate(0,${(-fr.hh - 9 - (1 - ease) * R.drop).toFixed(1)})`);
    this.diamond.style.display = shape.centre === 'diamond' ? '' : 'none';
    this.ringC.style.display = shape.centre === 'ring' ? '' : 'none';
    this.burst.style.display = shape.centre === 'burst' ? '' : 'none';
    this.dot.setAttribute('fill', colour);
    this.ringDot.setAttribute('stroke', colour);
    this.burstDot.setAttribute('fill', colour);
    this.pipsG.style.display = onScreen ? '' : 'none';
    if (onScreen) this.drawPips(look);
  }

  dispose() { this.root.remove(); }
}
