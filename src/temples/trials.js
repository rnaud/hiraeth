import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { T, box, prep } from './kit.js';

// The makers' trials (issue #660, docs/design/temple-puzzles.md): two pieces the houses' side rooms are built from.
//
//   Clock      a makers' clock: an eye on a pedestal that a hit wakes (a splash; or only the fan's wind, `by: 'gust'`; or
//              only a bomb's blast, `by: 'bomb'`). Woken, it runs its element's `hold` seconds (a 'timer', logic.js: lit
//              only while it runs), and what waits on { lit: id } stands open while it runs. The countdown is in the room,
//              not on the screen: a strip of lamps inlaid in the floor from the eye to what it holds goes out lamp by
//              lamp, the eye's end first, so the light left runs on ahead of you toward the way; the bars by the door
//              drain top down with it; a tick each second, a quicker, higher one and a blink in its last seconds, a falling
//              clack when it stops. Woken again while it runs, it starts over. Nothing is saved: a reload, a fall, a
//              walk away, and it is simply still, ready to be woken again. At rest a faint pulse runs along the strip,
//              from the eye toward the door, so the way it will light reads before it runs.
//   GlyphFloor glyph tiles in the floor and a panel on a wall that shows some of them in an order, with one to four pips
//              under each. Step on the tiles in that order and the element (a 'glyphs', logic.js) is lit for good; a tile
//              out of turn puts out the ones stepped, and you start again. With a `when` (a clock's run) the tiles take
//              only while it holds, and the panel can show its glyphs only then (`muralWhen`): read the order and step it
//              before the lamps go out.
//
// Both draw only what a still picture can show: a strip half lit, a panel and its pips, tiles lit in turn.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = (k) => k * k * (3 - 2 * k);
let uid = 0;
const own = (o) => makeMaterial({ ...o, key: `temple.trial.${uid++}` });
const noCollide = (o) => { o.traverse((c) => { c.userData.noCollide = true; c.userData.dynamic = true; }); return o; };
const mesh = (geos, mat) => new THREE.Mesh(mergeGeometries([geos].flat().map(prep)), mat);

/** The clock's numbers: its last seconds (s, the quick ticks), a lamp's size (m: across, along), the pulse at rest (s a run). */
export const CLOCK = { urgent: 3, lamp: [0.75, 1.1], pulse: 3.2, idle: 0.05 };

/** What woke it: a hit's mode and info (targets.js onHit) against the clock's `by`. */
export function wokenBy(by, mode, info = {}) {
  if (!by) return true;
  if (by === 'gust') return mode === 'gust' || info?.source === 'gust';
  if (by === 'bomb') return info?.source === 'bomb';
  return mode === by;
}

/** Points along a polyline (local [x, y, z]), n of them, evenly by length: [{ p, yaw }] at each one's middle. */
export function alongLine(pts, n) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[2] - a[2]);
    segs.push({ a, b, L, from: total }); total += L;
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = ((i + 0.5) / n) * total, g = segs.find((x) => s <= x.from + x.L + 1e-6) ?? segs.at(-1), k = g.L ? (s - g.from) / g.L : 0;
    out.push({ p: [g.a[0] + (g.b[0] - g.a[0]) * k, g.a[1] + (g.b[1] - g.a[1]) * k, g.a[2] + (g.b[2] - g.a[2]) * k], yaw: Math.atan2(g.b[0] - g.a[0], g.b[2] - g.a[2]) });
  }
  return { out, total };
}

/**
 * Is lamp i of n (0 at the eye's end) lit with `left` of `hold` seconds to go? The lamps lit are the door's end's, as
 * many as the share of time left (rounded up): the eye's end goes out first. Pure.
 */
export const lampLit = (i, n, left, hold) => hold > 0 && left > 0 && i >= n - Math.ceil((left / hold) * n - 1e-9);

export class Clock {
  /**
   * o: { id (its 'timer' element), at: [x, y, z] the pedestal's foot (local), yaw (the way the eye faces), by: null |
   *      'gust' | 'bomb' (what wakes it), strip: [[x, y, z], ...] the lamps' line on the floor from the eye to what it
   *      holds, n (lamps), bars: [{ at: [x, y, z] (foot), yaw, h }] upright strips (beside a door) that drain top down,
   *      lids (stone lids over the eye, shut while its element's `when` fails), wrong (said when another hit meets it),
   *      unmet (said when it won't wake: its `when`), heard (said once when it first runs), faded (said once when it
   *      stops) }
   */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, L = rt.logic;
    this.hold = L.el?.(o.id)?.hold ?? 8;
    this.left = 0; this.time = 0; this.flash = 0; this.next = 0;
    const lampColor = rt.P?.lamp ?? '#f6c84e', glowColor = rt.P?.glow ?? '#70e7df';
    // the pedestal: a squared column of the house's trim, the eye on its slanted top (solid: you can stand behind it)
    const [x, y, z] = o.at, yaw = o.yaw ?? 0, ph = o.h ?? 1.5;
    K.both(M.trim, T(new THREE.BoxGeometry(1.5, ph, 1.5), [x, y + ph / 2, z], [0, yaw, 0]));
    K.add(M.dark, T(new THREE.BoxGeometry(1.9, 0.2, 1.9), [x, y + 0.11, z], [0, yaw, 0]));
    this.group = new THREE.Group();
    this.group.position.copy(K.world(x, y + ph + 0.75, z));
    this.group.rotation.set(0, K.heading(yaw), 0);
    rt.root.add(this.group);
    const tilt = new THREE.Group(); tilt.rotation.x = -0.45; this.group.add(tilt);
    tilt.add(mesh([T(new THREE.TorusGeometry(0.72, 0.13, 6, 24), [0, 0, 0]), T(new THREE.CylinderGeometry(0.75, 0.75, 0.2, 24), [0, 0, -0.12], [Math.PI / 2, 0, 0])], M.trimMat));
    this.eye = own({ color: glowColor, glow: 0.1, flat: true });
    tilt.add(mesh([T(new THREE.SphereGeometry(0.46, 16, 10).scale(1, 1, 0.35), [0, 0, 0.05])], this.eye));
    // by the wind: four little vanes round the eye, that turn while it runs (the Warden's Well's fan); by a blast: an iron
    // cross-bar over it, a ring of rivets (it wants a bomb, not a splash)
    if (o.by === 'gust') {
      this.vanes = new THREE.Group(); this.vanes.position.z = 0.18; tilt.add(this.vanes);
      for (let i = 0; i < 4; i++) this.vanes.add(mesh([T(new THREE.BoxGeometry(0.16, 0.62, 0.05), [0, 0.86, 0], [0, 0.5, 0])], M.trimMat).rotateZ((i * Math.PI) / 2));
    } else if (o.by === 'bomb') {
      tilt.add(mesh([box(1.7, 0.16, 0.12, 0, 0, 0.22), box(0.16, 1.7, 0.12, 0, 0, 0.22), ...Array.from({ length: 8 }, (_, i) => T(new THREE.SphereGeometry(0.07, 6, 4), [Math.sin(i * 0.785) * 0.9, Math.cos(i * 0.785) * 0.9, 0.04]))], M.trimMat));
    }
    if (o.lids) {
      this.lids = [-1, 1].map((sd) => {
        const g = new THREE.Group();
        g.add(mesh([T(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 20, 1, false, sd > 0 ? 0 : Math.PI, Math.PI), [0, 0, 0.3], [Math.PI / 2, 0, 0])], M.trimMat));
        tilt.add(g);
        return { g, sd };
      });
      this.lidK = this.awake() ? 1 : 0;
    }
    noCollide(this.group);
    this.center = new THREE.Vector3();
    this.group.updateMatrixWorld(true);
    this.group.getWorldPosition(this.center);
    this.off = registerTarget({ kind: 'switch', radius: 1.0, position: () => this.center, enabled: () => true, onHit: (mode, point, dir, info) => this.hit(mode, info) });
    // the strip: lamps inlaid in a dark channel along the floor (drawn only: flush with the floor, nothing to trip on)
    this.lamps = [];
    if (o.strip?.length > 1) {
      const n = o.n ?? 14, [lw, ll] = CLOCK.lamp, { out, total } = alongLine(o.strip, n);
      const channel = [];
      for (let i = 0; i < o.strip.length - 1; i++) {
        const a = o.strip[i], b = o.strip[i + 1], L = Math.hypot(b[0] - a[0], b[2] - a[2]);
        channel.push(T(new THREE.BoxGeometry(lw + 0.35, 0.05, L + lw + 0.35), [(a[0] + b[0]) / 2, a[1] + 0.035, (a[2] + b[2]) / 2], [0, Math.atan2(b[0] - a[0], b[2] - a[2]), 0]));
      }
      K.add(M.dark, mergeGeometries(channel.map(prep)));
      this.total = total;
      for (const { p, yaw: ly } of out) {
        const m = own({ color: lampColor, glow: CLOCK.idle, flat: true });
        const lamp = mesh([box(lw, 0.05, Math.min(ll, (total / n) * 0.7), 0, 0, 0)], m);
        lamp.position.copy(K.world(p[0], p[1] + 0.085, p[2])); lamp.rotation.y = K.heading(ly);
        rt.root.add(noCollide(lamp));
        this.lamps.push({ m, lamp });
      }
    }
    // the bars: upright lamps in a trim frame (beside the door it holds), each `segs` tall, draining from the top
    this.bars = (o.bars ?? []).map((b) => {
      const g = new THREE.Group(), h = b.h ?? 6, segs = b.segs ?? 8;
      g.position.copy(K.world(...b.at)); g.rotation.y = K.heading(b.yaw ?? 0);
      rt.root.add(g);
      g.add(mesh([box(0.9, h + 0.5, 0.3, 0, (h + 0.5) / 2, 0)], M.trimMat));
      const cells = [];
      for (let j = 0; j < segs; j++) {
        const m = own({ color: lampColor, glow: CLOCK.idle, flat: true });
        g.add(mesh([box(0.55, (h / segs) * 0.78, 0.12, 0, 0.25 + (j + 0.5) * (h / segs), 0.18)], m));
        cells.push(m);
      }
      noCollide(g);
      return { g, cells };
    });
  }
  /** Its `when` holds (its lids up: it could wake now), or it runs. */
  awake() { const L = this.rt.logic; return L.isLit(this.id) || L.check(L.el(this.id)?.when); }
  /** Seconds left of its run (0: still). */
  get running() { return this.left; }
  hit(mode, info) {
    if (!wokenBy(this.o.by, mode, info)) {
      this.flash = 0.5;
      this.rt.sound?.critter?.('clack', 0.6);
      if (this.o.wrong) this.rt.notice?.(this.o.wrong, `wrong.${this.id}`);
      return true;
    }
    this.start();
    return true;
  }
  /** Wake it, or start it over while it runs. False if it won't wake now (its `when`, its items). */
  start() {
    const L = this.rt.logic;
    if (L.isLit(this.id)) { this.left = this.hold; this.next = 0; this.rt.sound?.templeMechanism?.(); return true; }
    if (!L.light(this.id)) {
      this.flash = 0.5;
      if (this.o.unmet && !L.check(L.el(this.id)?.when)) this.rt.notice?.(this.o.unmet, `unmet.${this.id}`);
      else this.rt.sound?.critter?.('clack', 0.5);
      return false;
    }
    this.left = this.hold; this.next = 0;
    if (!this.rt.sound?.templeMechanism?.()) this.rt.sound?.chime?.();
    if (this.o.heard) this.rt.notice?.(this.o.heard, `heard.${this.id}`);
    this.rt.onLit?.(this.id);
    return true;
  }
  /** Stop it now (its run out): what it holds lets go. */
  stop() {
    this.left = 0;
    if (this.rt.logic.quiet(this.id)) {
      this.rt.sound?.templeTick?.('out');
      if (this.o.faded) this.rt.notice?.(this.o.faded, `faded.${this.id}`);
    }
  }
  update(dt, t) {
    this.time += dt;
    const L = this.rt.logic;
    if (this.left > 0 && !L.isLit(this.id)) this.left = 0;   // (put out from outside: a reset)
    else if (this.left <= 0 && L.isLit(this.id)) { this.left = this.hold; this.next = 0; }   // (woken from outside: a full run)
    if (this.left > 0) {
      this.left -= dt;
      // the ticks: one a second, tick and tock; twice as fast and higher in its last seconds
      this.next -= dt;
      if (this.next <= 0 && this.left > 0) {
        const urgent = this.left <= CLOCK.urgent;
        this.rt.sound?.templeTick?.(urgent ? 'urgent' : (this.beat = !this.beat) ? 'tick' : 'tock', 0.9);
        this.next = urgent ? 0.5 : 1;
      }
      if (this.left <= 0) this.stop();
    }
    const run = this.left > 0, k = run ? this.left / this.hold : 0, urgent = run && this.left <= CLOCK.urgent;
    const blink = urgent ? (Math.sin(this.time * Math.PI * 4) > 0 ? 1 : 0.35) : 1;
    // the strip: lit from the door's end back as far as the time left reaches; at rest a faint pulse runs along it
    const n = this.lamps.length;
    for (let i = 0; i < n; i++) {
      let g;
      if (run) g = lampLit(i, n, this.left, this.hold) ? 0.95 * blink : 0.03;
      else {
        const ph = ((this.time / CLOCK.pulse) % 1) * (n + 4) - 2, d = Math.abs(i - ph);
        g = CLOCK.idle + (this.awake() ? 0.22 : 0.08) * Math.max(0, 1 - d / 1.5);
      }
      this.lamps[i].m.uniforms.uGlow.value = g;
    }
    for (const b of this.bars) {
      const m = b.cells.length;
      b.cells.forEach((c, j) => { c.uniforms.uGlow.value = run ? (j < Math.ceil(k * m - 1e-9) ? 0.9 * blink : 0.03) : CLOCK.idle; });
    }
    this.flash = Math.max(0, this.flash - dt);
    this.eye.uniforms.uGlow.value = run ? 0.9 * blink : (this.awake() ? 0.25 + 0.15 * Math.sin(t * 2.4) : 0.08) + this.flash;
    if (this.vanes && run) this.vanes.rotation.z += dt * 9;
    if (this.lids) {
      this.lidK = THREE.MathUtils.clamp(this.lidK + (this.awake() ? dt / 0.5 : -dt / 0.7), 0, 1);
      for (const l of this.lids) l.g.position.x = l.sd * ease(this.lidK) * 0.85;   // (they slide apart sideways, clear of the pedestal)
    }
  }
  dispose() { this.off?.(); }
}

/** The glyphs the tiles and the panel carry: makers' signs, each a flat outline of its own shape (segments, turn). */
export const GLYPHS = { ring: [40, 0], tri: [3, Math.PI / 2], square: [4, Math.PI / 4], diamond: [4, 0], hex: [6, 0] };
/** A glyph's outline, flat in the xz plane (y up), r across. */
export function glyphShape(name, r = 1) {
  const [n, a0] = GLYPHS[name] ?? GLYPHS.ring;
  return new THREE.RingGeometry(r * 0.72, r, n, 1, a0, Math.PI * 2);
}

/** Where a step goes: the next tile in turn (+1), one already stepped (0), out of turn (-1). Pure. */
export function stepOn(order, seq, tile) {
  if (order[seq] === tile) return 1;
  if (order.slice(0, seq).includes(tile)) return 0;
  return -1;
}

export class GlyphFloor {
  /**
   * o: { id (its 'glyphs' element), at: [[x, y, z], ...] the tiles' middles (local), glyphs: [name of each], order: [tile indices, in turn], r (a tile's
   *      radius, m), mural: { at: [x, y, z] the panel's foot (local), yaw (the way it faces) }, muralWhen (a condition: the
   *      panel shows its glyphs only while it holds), wrong (said once at a tile out of turn), unmet (said once at a tile
   *      that won't take: its `when`), done (said once when the last takes) }
   */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, r = (this.r = o.r ?? 1.5);
    const glowColor = rt.P?.glow ?? '#70e7df', lampColor = rt.P?.lamp ?? '#f6c84e';
    this.seq = 0; this.flash = 0; this.on = null;
    this.dim = new THREE.Color(glowColor).lerp(new THREE.Color('#3a4250'), 0.55).getStyle(); this.lit = lampColor;
    this.tiles = o.at.map((at, i) => ({ at, glyph: o.glyphs[i] })).map((tl, i) => {
      const [x, y, z] = tl.at;
      // a low drum of trim stone, its top 0.18 over the floor, the glyph inlaid on it
      K.both(M.trim, T(new THREE.CylinderGeometry(r, r + 0.1, 0.18, 28), [x, y + 0.09, z]));
      // (its inlay a dim, cool colour until stepped in turn: then the house's lamp colour, lit, so a stepped tile reads at
      // a glance from across the room, whatever the house's own glow colour is)
      const m = own({ color: this.dim, glow: 0.08, flat: true });
      const g = mesh([T(glyphShape(tl.glyph, r * 0.72), [0, 0, 0], [-Math.PI / 2, 0, 0])], m);
      g.position.copy(K.world(x, y + 0.2, z)); g.rotation.y = K.heading(0);
      rt.root.add(noCollide(g));
      return { at: tl.at, glyph: tl.glyph, m, i };
    });
    // the panel: a slab of the house's trim, the glyphs in turn across it, one to four pips under each
    const P = o.mural, n = o.order.length, w = 2.6 * n + 1.4, ph = 4.2;
    this.panel = new THREE.Group();
    this.panel.position.copy(K.world(...P.at)); this.panel.rotation.y = K.heading(P.yaw ?? 0);
    rt.root.add(this.panel);
    this.panel.add(mesh([box(w, ph, 0.4, 0, 1.4 + ph / 2, 0), box(w + 0.4, 0.3, 0.6, 0, 1.4, 0), box(w + 0.4, 0.3, 0.6, 0, 1.4 + ph, 0), box(0.6, 1.4, 0.4, -w / 2 + 0.6, 0.7, 0), box(0.6, 1.4, 0.4, w / 2 - 0.6, 0.7, 0)], M.trimMat));
    this.panel.add(mesh([box(w - 0.6, ph - 0.6, 0.06, 0, 1.4 + ph / 2, 0.21)], own({ color: rt.P?.dark ?? '#2a2d3a', flat: true })));   // (the kit's dark is a paint, not a material)
    this.signs = o.order.map((ti, k) => {
      const m = own({ color: lampColor, glow: 0.3, flat: true }), cx = (k - (n - 1) / 2) * 2.6, gy = 1.4 + ph * 0.62;
      const pips = Array.from({ length: k + 1 }, (_, j) => T(new THREE.CircleGeometry(0.13, 10), [cx + (j - k / 2) * 0.38, 1.4 + ph * 0.22, 0.26]));
      const sign = mesh([T(glyphShape(this.tiles[ti].glyph, 0.95), [cx, gy, 0.26], [0, 0, 0]), ...pips], m);
      this.panel.add(sign);
      return { m, sign };
    });
    noCollide(this.panel);
  }
  get done() { return this.rt.logic.isLit(this.id); }
  /** The tile you stand on now (its index), or -1. */
  standing() {
    const P = this.rt.player;
    if (!P?.pos || P.onGround === false) return -1;
    const l = this.rt.kit.local(P.pos);
    return this.tiles.findIndex((tl) => Math.hypot(l.x - tl.at[0], l.z - tl.at[2]) < this.r && Math.abs(l.y - (tl.at[1] + 0.18)) < 0.7);
  }
  /** A step on tile i (the runtime's player each frame; the tests call it). */
  step(i) {
    const L = this.rt.logic;
    if (this.done || i < 0) return 0;
    if (!L.canUse(this.id)) {
      this.flash = 0.4; this.seq = 0;
      this.rt.sound?.critter?.('clack', 0.4);
      if (this.o.unmet) this.rt.notice?.(this.o.unmet, `unmet.${this.id}`);
      return -1;
    }
    const s = stepOn(this.o.order, this.seq, i);
    if (s === 0) return 0;
    if (s < 0) {
      // out of turn: the tiles stepped go out (a tile that is the first of the order starts it again)
      const had = this.seq;
      this.seq = 0; this.flash = 0.5;
      this.rt.sound?.critter?.('clack', 0.8);
      if (had && this.o.wrong) this.rt.notice?.(this.o.wrong, `wrong.${this.id}`);
      if (this.o.order[0] === i) return this.step(i);
      return -1;
    }
    this.seq++;
    this.rt.sound?.critter?.('blip', 0.6 + 0.1 * this.seq);
    if (this.seq >= this.o.order.length && L.light(this.id)) {
      if (!this.rt.sound?.templeMechanism?.()) this.rt.sound?.chime?.();
      this.rt.sound?.chime?.();
      if (this.o.done) this.rt.notice?.(this.o.done, `done.${this.id}`);
      this.rt.onLit?.(this.id);
    }
    return 1;
  }
  update(dt, t) {
    const L = this.rt.logic;
    // its `when` let go mid-way (the clock ran out): the tiles stepped go out
    if (this.seq && !this.done && !L.canUse(this.id)) { this.seq = 0; this.flash = 0.5; }
    const i = this.standing();
    if (i !== this.on) { this.on = i; if (i >= 0) this.step(i); }
    this.flash = Math.max(0, this.flash - dt);
    const done = this.done, live = done || L.canUse(this.id);
    const stepped = new Set(this.o.order.slice(0, this.seq));
    for (const tl of this.tiles) {
      const on = done || stepped.has(tl.i);
      if (tl.on !== on) { tl.on = on; tl.m.uniforms.uColor.value.set(on ? this.lit : this.dim); }
      tl.m.uniforms.uGlow.value = done ? 0.8 : on ? 0.95 : (live ? 0.2 + 0.08 * Math.sin(t * 2 + tl.i) : 0.04) + this.flash * 0.5;
    }
    const shown = done || !this.o.muralWhen || L.check(this.o.muralWhen);
    this.signs.forEach((s, k) => { s.sign.visible = shown; s.m.uniforms.uGlow.value = done || k < this.seq ? 0.95 : 0.35; });
  }
}
