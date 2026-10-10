import * as THREE from 'three';
import { inkMat } from './kit.js';
import { rayWorld } from '../fluid-tool.js';
import { HIDDEN, hiddenIn, setSolid, riseHeight, ghostPath, ghostBridge, hiddenWriting, buried } from './hidden.js';

// The seeing lens (docs/systems/gadgets.md, "The seeing lens"): a monocle of the makers' glass. Hold the use
// button and the traveller holds it up: the view goes into the glass (src/post.js, "the seeing lens": a ring
// of brass, the world inside drawn in blue ink on pale paper, dark outside), and what the makers hid shows:
// ghost paths that hold you up only while the glass is up (src/gadgets/hidden.js), false floors that vanish
// under it, writing on walls, buried caches, boxes and relics shimmering through what stands between, and
// foes' weak points (a cut on a foe seen through the glass bites twice as deep: src/foes.js `exposed`).
// It clouds over as you look: LENS.drain of a small meter a second, back when lowered.

export const LENS = {
  drain: 1 / 16,     // of the meter a second held up (16 s of looking)
  steady: 1 / 3,     // of that while he stands on what it shows (a long ghost bridge is crossed before it clouds)
  refill: 1 / 5,     // a second, once lowered for `wait` s
  wait: 0.8,
  again: 0.2,        // the meter it needs before it can be raised again once clouded over
  rise: 9, fall: 7,  // 1/s: up and down
  see: 0.35,         // the raise at which hidden things show (and false floors go)
  solid: 0.5,        // the raise at which ghost paths hold you up
  radius: 0.46,      // the glass's radius on the screen (of the screen's height)
  marks: 8,          // marks at most (src/post.js uLensMarks)
  far: 90,           // m: boxes and relics marked within
  foes: 32,          // m: weak points marked within
  expose: 1.5,       // s a foe stays exposed after it was seen
  pips: 5,
  grace: 1.5,        // s a ghost path you stand on holds once the glass comes down (it pales and flickers: raise it again, or step off)
};

/**
 * A ghost path's grace when the glass comes down under you (`grace`: s left, or null): starts when it would go
 * while you stand on it, runs down, is over when the glass is up again or you are off it. Returns the new
 * grace (null: none) and whether it is still solid. Pure.
 */
export function ghostGrace(grace, { solidNow, wasSolid, standing, dt }) {
  if (solidNow) return { grace: null, solid: true };
  if (grace == null) {
    if (!wasSolid || !standing) return { grace: null, solid: false };
    grace = LENS.grace;
  } else if (!standing) return { grace: null, solid: false };
  grace -= dt;
  return grace > 0 ? { grace, solid: true } : { grace: null, solid: false };
}
/** The marks' kinds (src/post.js colours them): something to find, a weak point, writing. */
export const MARK = { find: 0, weak: 1, writing: 2 };

/** The meter after dt: drains while up, comes back after `wait` s down. { meter, idle }. Pure. */
export function lensMeter(meter, idle, dt, up, drain = LENS.drain) {
  if (up) return { meter: Math.max(0, meter - drain * dt), idle: 0 };
  idle += dt;
  return { meter: idle > LENS.wait ? Math.min(1, meter + LENS.refill * dt) : meter, idle };
}

/** Eases the raise k toward up (1) or down (0). Pure. */
export const lensRaise = (k, up, dt) => {
  const want = up ? 1 : 0, r = up ? LENS.rise : LENS.fall;
  const n = k + (want - k) * (1 - Math.exp(-r * dt));
  return Math.abs(n - want) < 0.004 ? want : n;
};

/** What a hidden entry does at raise k: { shown, solid }. Pure. */
export function revealAt(e, k) {
  if (e.kind === 'buried' && e.unearthed) return { shown: true, solid: false };
  const seen = k >= LENS.see;
  return { shown: e.illusion ? !seen : seen, solid: !!e.solidWhenSeen && k >= LENS.solid };
}

/**
 * The marks the glass draws this frame: the nearest `max` of `cands` ({ pos, kind, r }) in front of the camera,
 * as screen points { x, y (uv), kind, size (of the screen's height) }. Pure but for the camera's matrices.
 */
export function lensMarks(cands, camera, { max = LENS.marks, from = camera.position } = {}) {
  const P11 = camera.projectionMatrix.elements[5];
  const out = [];
  const v = new THREE.Vector3();
  const sorted = cands.map((c) => ({ c, d: c.pos.distanceTo(from) })).sort((a, b) => a.d - b.d);
  for (const { c, d } of sorted) {
    if (out.length >= max) break;
    v.copy(c.pos).applyMatrix4(camera.matrixWorldInverse);
    if (v.z > -0.3) continue;   // behind
    v.applyMatrix4(camera.projectionMatrix);
    if (Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
    const size = THREE.MathUtils.clamp(((c.r ?? 0.6) * P11) / (2 * Math.max(0.5, d)), 0.014, 0.075);
    out.push({ x: v.x * 0.5 + 0.5, y: v.y * 0.5 + 0.5, kind: c.kind, size, d });
  }
  return out;
}

function lensModel(scale = 1) {
  const g = new THREE.Group();
  const brass = inkMat('#d6a94a', { metal: 'brass' }), glass = inkMat('#a9e3dc', { glass: true }), dark = inkMat('#3a3330'), chain = inkMat('#b88a3a', { metal: 'brass' });
  const s = scale;
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.1 * s, 0.016 * s, 8, 32), brass));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.094 * s, 0.094 * s, 0.008 * s, 28).rotateX(Math.PI / 2), glass));
  // a fine engraved ring on the glass (the makers' sight), and a small knurled stem with a grip
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.055 * s, 0.004 * s, 4, 24).translate(0, 0, 0.006 * s), dark));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012 * s, 0.014 * s, 0.07 * s, 8).translate(0, -0.15 * s, 0), brass));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.02 * s, 10, 8).translate(0, -0.19 * s, 0), dark));
  // a short chain hanging from the rim
  for (let i = 0; i < 4; i++) g.add(new THREE.Mesh(new THREE.TorusGeometry(0.012 * s, 0.003 * s, 4, 8).rotateY(i % 2 ? Math.PI / 2 : 0).translate(0.1 * s + i * 0.012 * s, -0.03 * s - i * 0.02 * s, 0), chain));
  return g;
}

/** A small engraved key of light, the cache the yard's lens bay keeps under the sand. */
function cacheModel() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.8), inkMat('#6f5a8c')));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.12, 0.86).translate(0, 0.2, 0), inkMat('#d6a94a', { metal: 'brass' })));
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0).translate(0, 0.5, 0), inkMat('#bff3ea', { glow: 1 })));
  return g;
}

/** The lens's own sounds (the game's synth: src/audio.js sweep / burst). */
const sfx = {
  up(s) { const t = s?.ctx?.currentTime; if (t == null) return; s.sweep(t, 1500, 2300, 0.22, 0.05, 'sine'); s.sweep(t + 0.04, 2250, 3400, 0.3, 0.025, 'sine'); s.burst(t, { dur: 0.05, type: 'bandpass', freq: 3000, q: 3, vol: 0.04 }); },
  down(s) { const t = s?.ctx?.currentTime; if (t == null) return; s.sweep(t, 1900, 1200, 0.16, 0.035, 'sine'); },
  clouded(s) { const t = s?.ctx?.currentTime; if (t == null) return; s.sweep(t, 900, 500, 0.35, 0.04, 'triangle'); s.burst(t, { dur: 0.3, type: 'highpass', freq: 4200, q: 0.4, vol: 0.03 }); },
  found(s) { if (s?.chime) s.chime(); },
};

export default {
  id: 'monocle', name: 'Seeing lens', glyph: '◎', order: 70, trigger: 'look',
  text: 'A monocle of the makers’ glass on a short brass stem. Through it the world is drawn in blue ink, and what they hid is drawn too.',
  use: 'Hold LT / L2 or RT / R2 (R or T, the right or middle mouse button) to look through it. Hidden paths, false floors, writing on walls and buried caches show, boxes and relics shimmer through walls, and a foe’s weak point shows (a cut there bites twice as deep). Hidden paths hold you up only while you look. The glass clouds over as you look (slower while you stand on what it shows) and clears when lowered.',
  model: () => lensModel(1),
  create(ctx) { return new Lens(ctx); },

  /** Its bay: two towers with a false bridge between them and the true ghost path beside it, writing on a wall, a buried cache. */
  yard(kit) {
    kit.flag('#3d7f9a');
    const H = 5;
    // the near tower and its steps; the far tower, a lamp on it
    kit.block([2.6, H, 2.8], [-5.2, H / 2, -6]);
    kit.steps([-5.2, 0, 2.6], H, { width: 1.8, rise: 0.5, run: 0.72 });
    kit.block([2.6, H, 2.8], [5.2, H / 2, -6]);
    kit.lamp([5.2, H, -6]);
    // a bridge of planks straight across: an illusion (step on it and you fall; the glass shows it is not there)
    ghostBridge(kit.group, [-3.9, H, -5.6], [3.9, H, -5.6], { illusion: true, material: kit.mats.wood, sag: 0.25, posts: false, width: 1.3 });
    // the true way: a ghost path winding behind it, held up only while the lens is
    ghostPath(kit.group, [[-3.5, H, -7.0], [-2.1, H + 0.15, -8.1], [-0.6, H + 0.3, -8.7], [0.9, H + 0.3, -8.6], [2.3, H + 0.15, -7.9], [3.6, H, -7.0]], { width: 1.5, depth: 1.6, id: 'yard.lens.path' });
    // writing on the far tower's face, only for the glass
    hiddenWriting(kit.group, [5.2, 2.6, -4.55], 0, 'THE GLASS\nHOLDS UP\nALL IT SEES', { width: 2.2, id: 'yard.lens.writing', message: 'Writing on the tower, only for the glass: “The glass holds up all it sees.”' });
    // a cache buried in the sand in front: marked through the glass; a stomp of the spring boots brings it up
    const cache = cacheModel();
    kit.group.add(cache);
    buried(cache, new THREE.Vector3(1.5, 0.35, 1.2), { id: 'yard.lens.cache', message: 'A makers’ cache, brought up out of the sand.' });
  },
};

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0);

class Lens {
  constructor(ctx) {
    this.ctx = ctx;
    this.meter = 1; this.idle = 1; this.k = 0; this.up = false; this.time = 0;
    this.entries = []; this.known = 0;
    this.held = lensModel(0.9); this.held.visible = false; this.held.traverse((o) => { o.userData.noCollide = true; });
    ctx.fx?.add(this.held);
    this.ray = { origin: new THREE.Vector3(), dir: new THREE.Vector3() };
    this.marks = [];
    this.read = new Set();
  }

  get aiming() { return this.up; }
  canUse() {
    const P = this.ctx.player;
    return !!P && !P.ride && !P.down && !P.dead && !P.swim?.under;
  }

  equip() { this.ctx.sfx?.equip?.(this.ctx.sound); }
  unequip() { this.lower(); }
  cancel() { this.lower(); }

  press() {
    if (!this.canUse()) return;
    // (a path fading under you: the glass goes up again on what little has cleared)
    const fading = this.entries.some((e) => e.grace != null);
    if (this.meter < (fading ? 0.04 : LENS.again)) { this.ctx.notice?.('The glass has clouded over: it clears in a few seconds.', 'lens-clouded'); sfx.clouded(this.ctx.sound); return; }
    this.up = true; sfx.up(this.ctx.sound);
  }
  release() { this.lower(); }
  lower() { if (this.up) sfx.down(this.ctx.sound); this.up = false; }

  /** The hidden things of this world (adopted as they are made: a world builds them before the lens exists). */
  adopt() {
    if (HIDDEN.length === this.known) return;
    this.known = HIDDEN.length;
    const scene = this.ctx.scene;
    this.entries = scene ? hiddenIn(scene) : HIDDEN.slice();
  }

  update(dt, paused = false) {
    // (a conversation, a scene, the ship: the glass comes down, and the view out of it with it)
    if (paused) { this.lower(); this.k = lensRaise(this.k, false, dt); this.drawGlass(); this.held.visible = this.k > 0.05; if (this.held.visible) this.held.scale.setScalar(Math.max(0.01, this.k)); return; }
    const { ctx } = this, P = ctx.player;
    this.time += dt;
    this.adopt();
    if (this.up && !this.canUse()) this.lower();
    ({ meter: this.meter, idle: this.idle } = lensMeter(this.meter, this.idle, dt, this.up, LENS.drain * (this.up && this.onGhost() ? LENS.steady : 1)));
    if (this.up && this.meter <= 0) { this.lower(); ctx.notice?.('The glass has clouded over: it clears in a few seconds.', 'lens-clouded'); sfx.clouded(ctx.sound); }
    this.k = lensRaise(this.k, this.up, dt);
    // the hidden things: shown, solid, read
    for (const e of this.entries) {
      const r = revealAt(e, this.k);
      if (e.kind === 'buried' && e.unearthed && e.rise < 1) {
        e.rise += dt;
        e.object.position.copy(e.at).addScaledVector(_Y, riseHeight(e.rise, e.depth));
        e.object.rotation.y += dt * 0.6 * Math.max(0, 1 - e.rise);
        if (e.rise >= 0.7 && !e.said) { e.said = true; if (e.message) ctx.notice?.(e.message, `lens-${e.id}`); sfx.found(ctx.sound); e.rise = 1; }
      }
      if (e.kind === 'buried' && !e.unearthed) { e.object.visible = false; continue; }
      if (e.solidWhenSeen) {
        // lowered while you stand on it: it holds a moment, pale and flickering, then goes (ghostGrace)
        const g = ghostGrace(e.grace ?? null, { solidNow: r.solid, wasSolid: e.solid, standing: e.solid && this.standingOn(e), dt });
        if (g.grace != null && e.grace == null) { ctx.notice?.('The path fades as the glass comes down: raise it again, or step off.', 'lens-fading'); sfx.clouded(ctx.sound); }
        e.grace = g.grace;
        if (g.grace != null) r.shown = Math.sin(g.grace * (10 + 18 * (1 - g.grace / LENS.grace))) > -0.4;   // (it flickers, faster as it goes)
        setSolid(ctx.physics, e, g.solid);
      }
      if (r.shown !== e.shown) { e.shown = r.shown; e.object.visible = r.shown; }
      if (r.shown && e.message && !e.illusion && e.kind !== 'buried' && this.k > 0.6 && !this.read.has(e)) this.tryRead(e);
    }
    this.drawGlass(dt);
    // the foes it has seen stay exposed a moment
    for (const f of ctx.foes?.list ?? []) if (f.exposed > 0) f.exposed = Math.max(0, f.exposed - dt);
    // up, the camera comes over the shoulder and he turns to look where it looks
    if (this.up && ctx.camera && ctx.aimAt) {
      ctx.camera.getWorldDirection(this.ray.dir);
      ctx.aimAt(_w.copy(ctx.camera.position).addScaledVector(this.ray.dir, 30), this.ray.dir);
    }
    // the glass in hand, held up toward the eye
    this.held.visible = this.k > 0.05;
    if (this.held.visible && P) {
      const hand = ctx.tool?.muzzle && P.object?.visible !== false ? ctx.tool.muzzle(_u) : _u.copy(P.pos).addScaledVector(P.frame?.up ?? _Y, 1.45);
      this.held.position.copy(hand);
      this.held.quaternion.copy(ctx.camera?.quaternion ?? this.held.quaternion);
      this.held.scale.setScalar(Math.max(0.01, this.k));
    }
  }

  /** Is he standing on a ghost path the glass holds up? */
  onGhost() {
    for (const e of this.entries) if (e.solid && this.standingOn(e)) return true;
    return false;
  }

  /** Is he on (or just over, a step's hop) this entry's planks? */
  standingOn(e) {
    const P = this.ctx.player;
    if (!P) return false;
    e.box ??= new THREE.Box3().setFromObject(e.object).expandByScalar(0.3);
    if (!e.box.containsPoint(P.pos)) return false;
    if (P.onGround) return true;
    // (between two steps, or a hop: the ground under him is the path)
    const g = this.ctx.physics?.groundAt?.(P.pos.x, P.pos.y + 0.3, P.pos.z, 1.5);
    return Number.isFinite(g) && P.pos.y - g < 1.2;
  }

  /** Read writing seen up close, looked at, nothing in between: a notice, once. */
  tryRead(e) {
    const { ctx } = this, cam = ctx.camera;
    if (!cam) return;
    const at = e.object.getWorldPosition(_v);
    const P = ctx.player, d = P ? at.distanceTo(P.pos) : at.distanceTo(cam.position);
    if (d > e.range) return;
    cam.getWorldDirection(_w);
    const to = _u.subVectors(at, cam.position), L = to.length();
    if (to.divideScalar(L).dot(_w) < 0.86) return;
    const hit = rayWorld(ctx.physics, cam.position, to, L - 0.4);
    if (hit) return;
    this.read.add(e);
    if (e.id && ctx.game?.flag?.(`lens.read.${e.id}`)) return;
    if (e.id) ctx.game?.set?.(`lens.read.${e.id}`, true);
    ctx.notice?.(e.message, `lens-${e.id ?? e.message}`);
    sfx.found(ctx.sound);
    ctx.game?.emit?.('lens:read', { id: e.id });
  }

  /** The candidates for the glass's marks: boxes and relics, buried caches, unread writing, foes. */
  candidates() {
    const { ctx } = this, P = ctx.player, out = [];
    const near = (p, r) => !P || p.distanceTo(P.pos) < r;
    for (const it of ctx.relics?.items ?? []) if (!it.done && near(it.grp.position, LENS.far)) out.push({ pos: it.grp.position, kind: MARK.find, r: 0.7 });
    for (const b of ctx.boxes?.list ?? []) if (!(b.spent?.() ?? false) && b.pos && near(b.pos, LENS.far)) out.push({ pos: b.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), kind: MARK.find, r: 0.8 });
    for (const e of this.entries) {
      if (e.kind === 'buried' && !e.unearthed && near(e.at, 60)) out.push({ pos: e.at, kind: MARK.find, r: 0.8 });
      else if (e.mark && e.message && e.kind === 'writing' && !this.read.has(e) && !(e.id && ctx.game?.flag?.(`lens.read.${e.id}`))) { const p = e.object.getWorldPosition(new THREE.Vector3()); if (near(p, 40)) out.push({ pos: p, kind: MARK.writing, r: 0.9 }); }
    }
    for (const f of ctx.foes?.list ?? []) {
      if (!f.alive || !near(f.pos, LENS.foes)) continue;
      f.exposed = LENS.expose;
      out.push({ pos: f.chest.clone(), kind: MARK.weak, r: (f.def?.radius ?? 0.6) * 0.6 });
    }
    return out;
  }

  /** The post pass's lens: its raise, its radius, the time, and its marks (src/post.js uLens, uLensMarks). */
  drawGlass() {
    const U = this.ctx.post;
    if (!U?.uLens) return;
    if (this.k <= 0) { if (U.uLens.value.x !== 0) U.uLens.value.set(0, LENS.radius, 0, 0); return; }
    const cam = this.ctx.camera;
    let marks = [];
    if (cam) { cam.updateMatrixWorld(); marks = lensMarks(this.candidates(), cam); }
    marks.forEach((m, i) => U.uLensMarks.value[i].set(m.x, m.y, m.kind, m.size));
    this.marks = marks;
    U.uLens.value.set(this.k, LENS.radius, this.time, marks.length);
  }

  hud() {
    const n = Math.ceil(this.meter * LENS.pips - 1e-6);
    return { count: n, max: LENS.pips, note: this.up ? 'looking' : this.meter < LENS.again ? 'clouded' : null };
  }

  dispose() {
    for (const e of this.entries) if (e.handle) setSolid(this.ctx.physics, e, false);
    this.held.removeFromParent();
    const U = this.ctx.post;
    if (U?.uLens) U.uLens.value.x = 0;
  }
}

