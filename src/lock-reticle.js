import * as THREE from 'three';

// The lock-on's reticle (#foe-lock, docs/systems/foes.md "The lock-on"): drawn as the game's prompts are, gold in a
// thick ink line. Four chevrons round the foe on a hand-drawn ring, a row of pips over it for what is left of it.
// It is not only a marker: it reads the foe for you.
// - calm: the chevrons turn slowly round it, breathing;
// - winding up: they turn red and close in on it as the strike comes (at the strike they meet: guard, or go);
// - open (stunned, parried, flipped, asleep, reeling): pale blue, spread wide and pulsing: now cut;
// - out of the blade's reach (a ray under the sand, a hound running as a shadow): dimmed and dashed.
// It snaps in on a new foe (from wide, with a quick turn) and is sized to the foe on the screen. Off the screen it
// waits at the edge on its side, small.
//
//   const r = new LockReticle(); r.update(foe | null, camera, dt); r.acquire(); r.dispose()

export const RETICLE = {
  min: 30, max: 76,           // px: its radius on the screen, from the foe's size there
  margin: 0.35,               // m round the foe's body
  spin: 0.5,                  // rad/s calm
  close: 0.5,                 // the chevrons' radius at the strike, × the calm one
  open: 1.25,                 // × spread while it is open
  snap: 0.24,                 // s the snap-in takes
  pips: 8,                    // most pips drawn (more hp: each stands for more)
  ink: '#2b211f', gold: '#f2c54b', cream: '#f7ecd2', red: '#f05a3c', blue: '#bfe9ff',
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

/** How far the chevrons sit from the middle (× the radius) and how fast they turn, for a look (pure: tests). */
export function chevronSpread(look, t = 0) {
  if (!look) return 1;
  if (look.mode === 'wind') return THREE.MathUtils.lerp(1, RETICLE.close, look.k * look.k);
  if (look.mode === 'strike') return RETICLE.close * 0.9;
  if (look.mode === 'open') return RETICLE.open + Math.sin(t * 9) * 0.06;
  return 1 + Math.sin(t * 2.4) * 0.04;
}

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent = null) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
};
/** A ring as drawn by hand: a closed path whose radius wavers a little and whose ends overlap (seeded). */
function wobblyRing(r, seed = 1) {
  const n = 40, pts = [];
  for (let i = 0; i <= n + 3; i++) {
    const a = (i / n) * Math.PI * 2 - 0.4;
    const rr = r * (1 + 0.035 * Math.sin(a * 3 + seed) + 0.02 * Math.sin(a * 7 + seed * 2.3)) + (i > n ? (i - n) * 0.6 : 0);
    pts.push(`${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${pts.join('L')}`;
}

const _p = new THREE.Vector3(), _c = new THREE.Vector3();

export class LockReticle {
  constructor(parent = document.body) {
    const R = RETICLE;
    this.root = Object.assign(document.createElement('div'), { id: 'foe-lock' });
    this.root.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:24;display:none';
    // drawn round 0,0 at a radius of 50 (scaled to the foe)
    this.svg = el('svg', { width: 220, height: 220, viewBox: '-110 -110 220 220', style: 'position:absolute;left:-110px;top:-110px;overflow:visible' });
    this.root.appendChild(this.svg);
    this.scaleG = el('g', {}, this.svg);
    this.ringG = el('g', {}, this.scaleG);
    const ring = wobblyRing(50, 2.1);
    el('path', { d: ring, fill: 'none', stroke: R.ink, 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.55 }, this.ringG);
    this.ring = el('path', { d: ring, fill: 'none', stroke: R.gold, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-dasharray': '10 7' }, this.ringG);
    this.spinG = el('g', {}, this.scaleG);
    // four chevrons pointing in, each an ink stroke under a coloured one
    this.chevrons = [0, 1, 2, 3].map((i) => {
      const g = el('g', { transform: `rotate(${45 + i * 90})` }, this.spinG);
      const inner = el('g', {}, g);
      const d = 'M-13,-9 L0,0 L-13,9';
      el('path', { d, fill: 'none', stroke: R.ink, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, inner);
      const top = el('path', { d, fill: 'none', stroke: R.gold, 'stroke-width': 4.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, inner);
      return { inner, top };
    });
    // the centre: a small diamond
    el('path', { d: 'M0,-5 L5,0 L0,5 L-5,0Z', fill: R.ink }, this.scaleG);
    this.dot = el('path', { d: 'M0,-2.8 L2.8,0 L0,2.8 L-2.8,0Z', fill: R.gold }, this.scaleG);
    // what is left of it: pips on an arc under it
    this.pipsG = el('g', {}, this.svg);
    this.pips = [];
    parent.appendChild(this.root);
    this.t = 0; this.snap = 1; this.foe = null; this.spin = 0; this.flash = 0; this.lastMode = null;
  }

  /** A new foe locked: the reticle snaps in on it. */
  acquire() { this.snap = 0; }

  /** The pips: one per hp up to RETICLE.pips (more: each stands for a share), on an arc over the ring. */
  drawPips(look, r) {
    const R = RETICLE, n = Math.min(R.pips, Math.max(1, look.max)), per = look.max / n;
    while (this.pips.length < n) {
      const g = el('g', {}, this.pipsG);
      el('circle', { r: 5, fill: R.ink }, g);
      this.pips.push({ g, fill: el('circle', { r: 2.9, fill: R.cream }, g) });
    }
    const span = Math.min(Math.PI * 0.75, n * 0.2), rr = r + 16;
    this.pips.forEach((p, i) => {
      if (i >= n) { p.g.style.display = 'none'; return; }
      const a = -Math.PI / 2 - (n > 1 ? (0.5 - i / (n - 1)) * span : 0);   // (over it: under it the traveller stands in the way)
      p.g.style.display = '';
      p.g.setAttribute('transform', `translate(${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)})`);
      const left = look.hp / per - i;   // (this pip's share left: 1 full, 0 gone)
      p.fill.setAttribute('fill', left > 0.5 ? (look.mode === 'open' ? R.blue : R.cream) : R.ink);
      p.fill.setAttribute('r', left > 0.5 ? 2.9 : 1.2);
    });
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
    // where: the foe's chest on the screen; off it (or behind), held at the edge on its side, small
    _c.copy(f.chest);
    _p.copy(_c).project(camera);
    const behind = _p.z > 1;
    let x = behind ? -_p.x : _p.x, y = behind ? -_p.y : _p.y;
    const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.9;
    if (off) { const k = 1 / Math.max(Math.abs(x) / 0.88, Math.abs(y) / 0.84, 1e-3); if (k < 1 || behind) { x *= k; y *= k; } }
    const W = window.innerWidth, H = window.innerHeight;
    // how big: the foe's body (and a margin) at its distance, in pixels
    const dist = Math.max(0.5, camera.position.distanceTo(_c)), fov = THREE.MathUtils.degToRad(camera.fov ?? 60);
    const px = ((f.def.radius + R.margin) / dist) * (H / 2) / Math.tan(fov / 2);
    const r = THREE.MathUtils.clamp(px, R.min, R.max) * (off ? 0.6 : 1);
    this.root.style.display = '';
    this.root.style.transform = `translate(${((x * 0.5 + 0.5) * W).toFixed(1)}px,${((0.5 - y * 0.5) * H).toFixed(1)}px)`;
    // the snap-in: from wide and faint, an overshoot, a quick quarter turn
    const s = this.snap, ease = 1 - (1 - s) ** 3, pop = 1 + Math.sin(Math.min(1, s * 1.15) * Math.PI) * 0.12;
    const scale = (r / 50) * THREE.MathUtils.lerp(2, 1, ease) * pop * (1 + this.flash * 0.12);
    this.scaleG.setAttribute('transform', `scale(${scale.toFixed(3)})`);
    this.root.style.opacity = String((look.mode === 'veiled' ? 0.55 : 1) * Math.min(1, s * 2.5));
    // the turn: slow when calm, quicker winding up, stopped while it is open (it holds wide, pulsing)
    this.spin += dt * (look.mode === 'wind' ? R.spin * 3 : look.mode === 'open' ? 0 : R.spin) + (1 - ease) * dt * 6;
    this.spinG.setAttribute('transform', `rotate(${(this.spin * 57.3).toFixed(1)})`);
    this.ringG.setAttribute('transform', `rotate(${(-this.t * 12).toFixed(1)})`);
    const spread = chevronSpread(look, this.t), colour = this.flash > 0.3 ? '#ffffff' : look.mode === 'wind' || look.mode === 'strike' ? R.red : look.mode === 'open' ? R.blue : R.gold;
    for (const c of this.chevrons) {
      c.inner.setAttribute('transform', `translate(${(50 * spread + 4).toFixed(1)},0)`);
      c.top.setAttribute('stroke', colour);
      c.top.setAttribute('stroke-dasharray', look.mode === 'veiled' ? '5 5' : 'none');
    }
    this.ring.setAttribute('stroke', look.mode === 'open' ? R.blue : look.mode === 'wind' ? R.red : R.gold);
    this.ring.setAttribute('opacity', look.mode === 'wind' ? String(0.35 + 0.65 * look.k) : '0.8');
    this.dot.setAttribute('fill', colour);
    this.pipsG.style.display = off ? 'none' : '';
    this.pipsG.setAttribute('transform', `scale(${((r / 50) * THREE.MathUtils.lerp(2, 1, ease)).toFixed(3)})`);
    if (!off) this.drawPips(look, 50);
  }

  dispose() { this.root.remove(); }
}
