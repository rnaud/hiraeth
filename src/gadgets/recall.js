import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { inkMat, INK, InkLine, aimRay, assistPick } from './kit.js';
import { MotionHistory, Rewind, HISTORY } from './history.js';
import { rayWorld } from '../fluid-tool.js';
import { raycastTargets } from '../targets.js';
import { makeMaterial } from '../materials.js';
import { thinBar, thinRing } from '../thin.js';

// The recall hourglass (docs/systems/gadgets.md, "The recall hourglass"): aim at something that moved in
// the last few seconds (a crate knocked off a ledge, a bomb in flight, a cab in the City-Shaft's traffic)
// and send it back along its own path, as if its sand ran upward: a dotted ink trail shows where it has
// been, with its ghost drawn in outline along it. It glides back at the pace it went, and
// what stands on it rides along (a crate is a moving collider: physics.addMover), so a crate knocked down
// carries you back up to its ledge. Press again to stop it (or, when it was started with the button held,
// let go). Motion is kept by src/gadgets/history.js: up to HISTORY.window seconds of it, for at most
// HISTORY.cap things at once, and only while they move.
//
// What can be rewound (an "adapter": { key, kind, pos, radius, object, yaw(), moving(), alive(), can(),
// begin(), place(pos, yaw, vel), end() }): the world's loose things (src/gadgets/world.js), the bombs in
// flight (src/gadgets/bomb.js, held: their fuse waits), the cabs in traffic (src/taxi.js) and anything a
// level lists in `level.recallables()` (moving platforms of its own).

export const RECALL = {
  range: 32,          // m from the eye
  cone: 0.09,         // rad of aim assist round the line
  speed: 1,           // × the pace it went
  holdStop: 0.35,     // s: started with the button held this long, letting go stops it
  dots: 160,          // dots on the trail
  spacing: 0.32,      // m between dots
  ghosts: 5,          // outlines along the trail
  ghostEvery: 0.45,   // s of motion between them
  cool: 0.35,         // s between recalls
  far: 1.6,           // × range: further than this from you it lets go
  cabs: 6, cabNear: 90, cabReach: 70,   // the nearest cabs followed, within m; how far off one can be sent back (they are big)
};

const TEAL = '#2f8f9a', SAND = '#e2b85c';
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Vector3();
const _m = new THREE.Matrix4(), _Y = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ what can be rewound

/** A loose thing of the gadgets' world (a crate): held while it goes back (no gravity, no friction). */
export function propAdapter(p) {
  return {
    key: p, kind: p.kind ?? 'crate', pos: p.pos, radius: p.r * 1.2, object: p.object,
    yaw: () => p.object.rotation.y,
    moving: () => !!p.held && p.held !== 'recall' || (!p.resting && p.vel.lengthSq() > 0.0025),
    alive: () => p.object.visible !== false,
    can: () => !p.held || p.held === 'recall',
    begin() { p.held = 'recall'; p.vel.set(0, 0, 0); p.resting = false; },
    place(pos, yaw) { p.pos.copy(pos); p.object.rotation.y = yaw; p.vel.set(0, 0, 0); p.object.updateMatrixWorld(); },
    end() { if (p.held === 'recall') p.held = null; p.vel.set(0, 0, 0); p.resting = false; },
  };
}

/** A bomb in flight (src/gadgets/bomb.js): held, it neither falls nor burns down. */
export function bombAdapter(b, bombs) {
  return {
    key: b, kind: 'bomb', pos: b.pos, radius: 0.45, object: b.mesh,
    yaw: () => 0, moving: () => b.vel.lengthSq() > 0.01,
    alive: () => bombs.live.includes(b), can: () => !b.held || b.held === 'recall',   // (not one a bubble carries)
    begin() { b.held = 'recall'; b.vel.set(0, 0, 0); },
    place(pos) { b.pos.copy(pos); b.vel.set(0, 0, 0); },
    end() { if (b.held === 'recall') b.held = null; b.vel.set(0, 0, 0); },
  };
}

/** A cab in traffic (src/taxi.js): hovering where it is sent, then parked (it goes back to its lane by itself). */
export function taxiAdapter(v, player = null) {
  return {
    key: v, kind: 'cab', pos: v.pos, radius: 2.3 * (v.scale ?? 1), object: v.object, reach: RECALL.cabReach,
    yaw: () => v.heading ?? 0, moving: () => v.vel.lengthSq() > 0.09,
    alive: () => !!v.object?.parent, can: () => v !== player?.ride && ['lane', 'return', 'parked', 'recall'].includes(v.mode),
    begin() { v.mode = 'recall'; v.route = null; v.speed = 0; },
    place(pos, yaw, vel) {
      v.pos.copy(pos); v.parkY = pos.y; v.heading = yaw;
      if (vel) v.vel.copy(vel);
      v.object.position.copy(pos); v.object.rotation.set(v.pitch ?? 0, yaw, v.bank ?? 0, 'YXZ'); v.object.updateMatrixWorld();
    },
    end() { v.mode = 'parked'; v.idle = 0; v.parkY = v.pos.y; v.vel.set(0, 0, 0); },
  };
}

// ------------------------------------------------------------------ the look

/** The box round an object in its own frame (its meshes' bounds), for its ghost. */
export function localBox(object) {
  object.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(object.matrixWorld).invert(), box = new THREE.Box3(), b = new THREE.Box3();
  object.traverse((m) => {
    if (!m.isMesh || !m.geometry?.attributes?.position) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    box.union(b.copy(m.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(inv, m.matrixWorld)));
  });
  if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(1, 1, 1));
  return box;
}

/** Twelve inked bars round a box (kept a least width on screen: src/thin.js). */
export function outlineGeometry(box, r = 0.018) {
  const { min: a, max: b } = box, c = [];
  const P = (x, y, z) => new THREE.Vector3(x ? b.x : a.x, y ? b.y : a.y, z ? b.z : a.z);
  for (const [i, j] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) {
    const A = P(i & 4, i & 2, i & 1), B = P(j & 4, j & 2, j & 1), d = _v.subVectors(B, A), L = d.length();
    const g = new THREE.CylinderGeometry(r, r, L + r * 2, 4, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_Y, d.divideScalar(L)));
    g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
    c.push(thinBar(g, A, B));
  }
  return mergeGeometries(c);
}

function hourglassModel() {
  const g = new THREE.Group();
  const wood = inkMat('#7a4a2c'), brass = inkMat('#d6a94a', { metal: 'brass' }), sand = inkMat(SAND), glass = makeMaterial({ color: '#cfe8ea', flat: true, glass: true });
  for (const y of [0.13, -0.13]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16).translate(0, y, 0), wood));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.24, 6).translate(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08), brass));
  }
  // the two bulbs, glass (drawn as its rim), and the sand: most of it in the top bulb (it runs up)
  const profile = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12, y = -0.115 + t * 0.23; profile.push(new THREE.Vector2(0.008 + 0.062 * Math.pow(Math.abs(Math.sin(t * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5), 0.6) * (Math.abs(y) > 0.01 ? 1 : 0.15), y)); }
  g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 18), glass));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.05, 14).rotateX(Math.PI).translate(0, 0.045, 0), sand));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.035, 0.02, 14).translate(0, 0.08, 0), sand));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 4).translate(0, -0.03, 0), sand));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.015, 12).translate(0, -0.105, 0), sand));
  g.rotation.set(0.15, 0, 0.25);
  return g;
}

/** The hourglass's sounds (the game's synth): sand running back, the tick-tock while it goes, the stop. */
const now = (s) => (s?.ctx ? s.ctx.currentTime : null);
export const recallSfx = {
  start(s) { const t = now(s); if (t == null) return; s.sweep(t, 260, 1500, 0.45, 0.08, 'triangle'); s.burst(t, { dur: 0.5, type: 'highpass', freq: 2600, q: 0.6, vol: 0.06, rate: 0.6 }); },
  tick(s, hi) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.03, type: 'bandpass', freq: hi ? 3400 : 2600, q: 6, vol: 0.06 }); },
  stop(s) { const t = now(s); if (t == null) return; s.sweep(t, 900, 320, 0.16, 0.07, 'triangle'); s.burst(t, { dur: 0.08, type: 'lowpass', freq: 700, q: 0.8, vol: 0.12 }); },
  none(s) { const t = now(s); if (t == null) return; s.sweep(t, 520, 380, 0.14, 0.05, 'triangle'); },
};

// ------------------------------------------------------------------ the gadget

export default {
  id: 'recall', name: 'Recall hourglass', glyph: '⧗', order: 50,
  text: 'A small hourglass in a frame of dark wood and brass, its sand running the wrong way. Held up to something, it remembers where that thing has been.',
  use: 'Point at something that moved in the last few seconds (a crate knocked off a ledge, a thrown bomb, a cab in traffic): its path shows as a dotted line. Press Y / △ (T, or the middle mouse button) and it goes back along it, up to eight seconds, carrying whatever stands on it. Press again to stop it; if you started it with the button held, letting go stops it. Hold Y / △ with nothing in sight to aim over the shoulder.',
  model: hourglassModel,
  create(ctx) { return new Recall(ctx); },

  /** Its bay: a crate on a high ledge (knock it down, stand on it, send it back up), a lower one to learn on. */
  yard(kit) {
    kit.flag(TEAL);
    // the high ledge: 6 m, a lamp up there, a crate at its lip
    kit.block([6, 6, 4], [0.5, 3, -9]);
    kit.lamp([1.5, 6, -9.8]);
    kit.crate([0.5, 6.45, -7.45]);
    // a lower ledge to learn on (3 m), its crate at the lip too
    kit.block([3, 3, 3], [-5, 1.5, -8.5]);
    kit.crate([-5, 3.45, -7.45]);
    // a ring by the high ledge for the hook to pull its crate down with (or a bomb)
    kit.anchor([4, 4.5, -6.95], { normal: [0, 0, 1] });
    kit.crate([5.2, 0.45, -3]);
  },
};

class Recall {
  constructor(ctx) {
    this.ctx = ctx;
    this.history = new MotionHistory();
    this.adapters = new WeakMap();
    this.state = 'idle'; this.cool = 0; this.heldT = 0; this.byHold = false; this.swallow = false;
    this.hover = null; this.active = null; this.rw = null; this.tickT = 0; this.tock = false;
    this.ray = { origin: new THREE.Vector3(), dir: new THREE.Vector3() };
    this.cands = [];
    const fx = ctx.fx;
    // the trail: dots of ink and teal
    const dots = (this.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), inkMat(INK), RECALL.dots));
    dots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(RECALL.dots * 3), 3);
    dots.count = 0; dots.frustumCulled = false; dots.userData.noCollide = true;
    fx?.add(dots);
    // the ghosts: the thing drawn in outline along its path
    this.ghostMat = makeMaterial({ color: TEAL, flat: true, glow: 0.6, thin: 1.5 });
    this.ghosts = Array.from({ length: RECALL.ghosts }, () => {
      const m = new THREE.Mesh(new THREE.BufferGeometry(), this.ghostMat);
      m.visible = false; m.frustumCulled = false; m.userData.noCollide = true; fx?.add(m); return m;
    });
    this.outlines = new WeakMap();
    // while it goes back: a ring turning round it, and a line from the hourglass to it
    this.ring = new THREE.Mesh(thinRing(new THREE.TorusGeometry(1, 0.03, 4, 48), 1, 48, 4), makeMaterial({ color: SAND, flat: true, glow: 0.8, thin: 1.6 }));
    this.ring.visible = false; this.ring.userData.noCollide = true; this.ring.frustumCulled = false;
    fx?.add(this.ring);
    this.tether = fx ? new InkLine(fx, { color: TEAL, px: 1.4 }) : null;
    this._c = new THREE.Color(); this._mm = new THREE.Matrix4(); this._s = { pos: new THREE.Vector3(), yaw: 0, t: 0 };
  }

  get aiming() { return this.state === 'aim'; }
  get recalling() { return this.state === 'rewind'; }
  get equipped() { return this.ctx.game?.flag?.('gadget.equipped') === 'recall'; }

  canUse() {
    const P = this.ctx.player;
    return !!P && !P.ride && !P.down && !P.dead;
  }

  adapt(key, make) {
    let a = this.adapters.get(key);
    if (!a) { a = make(); this.adapters.set(key, a); }
    return a;
  }
  /** Everything that could be rewound now. */
  candidates() {
    const { world, player: P, level } = this.ctx, out = this.cands;
    out.length = 0;
    for (const p of world?.props ?? []) out.push(this.adapt(p, () => propAdapter(p)));
    const B = this.ctx.gadget?.('bomb');
    for (const b of B?.live ?? []) out.push(this.adapt(b, () => bombAdapter(b, B)));
    // the cabs: only the few nearest (a street of traffic would fill the history)
    const cabs = (this._cabs ??= []);
    cabs.length = 0;
    for (const v of P?.vehicles ?? []) if (v?.kind === 'taxi' && v.pos && v.object && v !== P.ride) { const d = P.pos.distanceToSquared(v.pos); if (d < RECALL.cabNear ** 2) cabs.push([d, v]); }
    cabs.sort((x, y) => x[0] - y[0]);
    for (let i = 0; i < Math.min(RECALL.cabs, cabs.length); i++) { const v = cabs[i][1]; out.push(this.adapt(v, () => taxiAdapter(v, P))); }
    for (const a of level?.recallables?.() ?? []) out.push(a);
    return out;
  }

  /** What the aim is on: a loose thing straight under it, else the nearest rewindable near the line; in sight. */
  pick() {
    const { camera, player: P, physics } = this.ctx;
    if (!camera || !P) return null;
    aimRay(camera, P, this.ray);
    const { origin, dir } = this.ray;
    const list = this.cands.filter((a) => a.alive() && a.can());
    let best = null;
    const t = raycastTargets(origin, dir, RECALL.range);
    if (t?.target?.kind === 'prop') best = list.find((a) => a.key === t.target.prop) ?? null;
    if (!best) {
      const withPath = list.filter((a) => this.history.has(a.key));
      best = assistPick(origin, dir, withPath, { range: RECALL.range, cone: RECALL.cone, near: 1.2, pos: (a) => a.pos })?.item ?? null;
      if (!best) best = assistPick(origin, dir, list.filter((a) => a.kind === 'cab'), { range: RECALL.cabReach, cone: 0.05, near: 2.5, pos: (a) => a.pos })?.item ?? null;
    }
    if (!best) return null;
    // in sight: nothing solid between the eye and it (its own collider aside: stop short of its radius)
    const d = _v.subVectors(best.pos, origin).length();
    if (d > (best.reach ?? RECALL.range) + best.radius) return null;
    if (d > best.radius + 0.3 && rayWorld(physics, origin, _w.copy(_v).divideScalar(d), d - best.radius - 0.3)) return null;
    return best;
  }

  equip() { this.ctx.sfx?.equip?.(this.ctx.sound); }
  unequip() { if (this.state === 'aim') this.state = 'idle'; if (this.recalling) this.stop(); this.hide(); }
  cancel() { if (this.state === 'aim') this.state = 'idle'; if (this.recalling) this.stop(); }

  press() {
    if (this.recalling) { this.stop(); this.swallow = true; return; }
    if (!this.canUse() || this.cool > 0) return;
    this.heldT = 0;
    const h = this.hover;
    if (h) { this.begin(h, true); return; }
    this.state = 'aim';
  }
  hold(dt) { this.heldT += dt; }
  release() {
    if (this.swallow) { this.swallow = false; return; }
    if (this.recalling) { if (this.byHold && this.heldT > RECALL.holdStop) this.stop(); return; }
    if (this.state !== 'aim') return;
    this.state = 'idle';
    const h = this.pick();
    if (h) this.begin(h, false);
  }

  /** Send `a` back along its path (or say there is none). */
  begin(a, byHold) {
    if (!this.history.has(a.key)) {
      this.ctx.notice?.('Nothing to send back: it has not moved in the last few seconds.', 'recall-still');
      recallSfx.none(this.ctx.sound);
      return false;
    }
    const path = this.history.path(a.key);
    path.unshift({ pos: a.pos.clone(), yaw: a.yaw(), t: this.history.t });
    this.history.freeze(a.key, true);
    a.begin();
    this.rw = new Rewind(path, { rate: HISTORY.rate, speed: RECALL.speed });
    this.active = a; this.state = 'rewind'; this.byHold = byHold; this.tickT = 0;
    recallSfx.start(this.ctx.sound);
    this.ctx.game?.emit?.('gadget:recall', { kind: a.kind, seconds: this.rw.left });
    return true;
  }

  /** It stops where it is now (its path forgotten: from here it is recorded anew). */
  stop() {
    const a = this.active;
    if (a) { a.end(); this.history.clear(a.key); }
    if (a?.pos) this.ctx.bursts?.add?.(a.pos, _Y, 0.5 + a.radius * 0.3);
    this.active = null; this.rw = null; this.state = 'idle'; this.cool = RECALL.cool;
    recallSfx.stop(this.ctx.sound);
  }

  update(dt, paused = false) {
    if (paused) { this.hover = null; this.hide(); return; }   // (a conversation, a scene: cancel() stopped it; its trail and reticle go)
    this.cool = Math.max(0, this.cool - dt);
    this.history.update(dt, this.candidates());
    const P = this.ctx.player;
    if (this.state === 'aim' && !this.canUse()) this.state = 'idle';
    if (this.recalling) {
      const a = this.active;
      if (!a.alive() || !a.can() || (P && P.pos.distanceTo(a.pos) > (a.reach ?? RECALL.range) * RECALL.far)) { this.stop(); this.hide(); return; }
      const r = this.rw.step(dt, _p);
      a.place(_p, r.yaw, this.rw.vel, dt);
      this.tickT -= dt;
      if (this.tickT <= 0) { this.tickT = 0.25; this.tock = !this.tock; recallSfx.tick(this.ctx.sound, this.tock); }
      this.drawRewind(a);
      this.ctx.hud?.reticle?.(null);
      this._ret = false;
      if (r.done) { this.stop(); this.hide(); }
      return;
    }
    if (!this.equipped || !this.canUse()) { this.hover = null; this.hide(); return; }
    this.hover = this.pick();
    const h = this.hover;
    if (h && this.history.has(h.key)) this.drawTrack(h);
    else this.hideTrail();
    if (h) { this.ctx.hud?.reticle?.(h.pos, 'target', this.history.has(h.key) ? `${this.history.track(h.key).seconds().toFixed(1)} s` : 'still'); this._ret = true; }
    else if (this.state === 'aim') { this.ctx.hud?.reticle?.(null, 'far', 'nothing that moved'); this._ret = true; }
    else if (this._ret) { this.ctx.hud?.reticle?.(null); this._ret = false; }
    if (this.state === 'aim') this.ctx.aimAt?.(h ? h.pos : _q.copy(this.ray.origin).addScaledVector(this.ray.dir, 12), this.ray.dir);
  }

  hide() {
    this.hideTrail();
    this.ring.visible = false; this.tether?.hide();
    if (this._ret) { this.ctx.hud?.reticle?.(null); this._ret = false; }
  }
  hideTrail() { this.dots.count = 0; for (const g of this.ghosts) g.visible = false; }

  /** The ghost's outline for an object (built once). */
  outline(a) {
    let g = this.outlines.get(a.key);
    if (!g) { g = a.object ? outlineGeometry(localBox(a.object), a.kind === 'cab' ? 0.04 : 0.018) : null; this.outlines.set(a.key, g); }
    return g;
  }

  /**
   * Dots along a path given by get(k, out) → yaw for k = 0..n-1 (newest first), a ghost every
   * RECALL.ghostEvery s and at its far end.
   */
  drawPath(a, n, get) {
    if (n < 2) { this.hideTrail(); return; }
    let dots = 0, along = 0, ghosts = 0;
    const geo = this.outline(a), every = Math.max(1, Math.round(RECALL.ghostEvery * HISTORY.rate));
    const prev = _w, cur = _v;
    get(0, prev);
    const put = (p, k) => {
      if (dots >= RECALL.dots) return;
      const s = 0.05 + 0.012 * Math.sin(k * 1.3);
      this._mm.makeScale(s, s, s).setPosition(p);
      this.dots.setMatrixAt(dots, this._mm);
      this.dots.setColorAt(dots, this._c.set(dots % 3 === 2 ? TEAL : INK));
      dots++;
    };
    const ghost = (p, yaw) => {
      if (!geo || ghosts >= this.ghosts.length) return;
      const g = this.ghosts[ghosts++];
      g.geometry = geo; g.visible = true;
      g.position.copy(p); g.rotation.set(0, yaw, 0); g.scale.copy(a.object.scale);
    };
    for (let k = 1; k < n; k++) {
      const yaw = get(k, cur);
      const L = cur.distanceTo(prev);
      along += L;
      while (along >= RECALL.spacing && L > 1e-6) {
        along -= RECALL.spacing;
        put(_p.lerpVectors(cur, prev, along / L), k);
      }
      if (k % every === 0 || k === n - 1) ghost(cur, yaw);
      prev.copy(cur);
    }
    this.dots.count = dots;
    this.dots.instanceMatrix.needsUpdate = true;
    if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
    for (let i = ghosts; i < this.ghosts.length; i++) this.ghosts[i].visible = false;
  }

  drawTrack(a) {
    const tr = this.history.track(a.key), s = this._s;
    if (!tr) { this.hideTrail(); return; }
    // (from where it is now, then back through its samples)
    this.drawPath(a, tr.len + 1, (k, out) => {
      if (k === 0) { out.copy(a.pos); return a.yaw(); }
      tr.get(k - 1, s); out.copy(s.pos); return s.yaw;
    });
  }

  drawRewind(a) {
    const rw = this.rw, i0 = Math.ceil(rw.f), P = rw.path;
    this.drawPath(a, P.length - i0 + 1, (k, out) => {
      if (k === 0) { out.copy(a.pos); return a.yaw(); }
      const s = P[i0 + k - 1]; out.copy(s.pos); return s.yaw;
    });
    // the ring round it, turning; the line from the hourglass in hand
    const R = Math.max(0.35, a.radius * 1.1);
    this.ring.visible = true;
    this.ring.position.copy(a.pos);
    this.ring.scale.setScalar(R * (1 + 0.06 * Math.sin(this.history.t * 9)));
    this.ring.rotation.set(Math.PI / 2 + 0.3 * Math.sin(this.history.t * 1.7), this.history.t * 2.4, 0);
    const P0 = this.ctx.player;
    if (this.tether && P0) {
      const hand = this.ctx.tool?.muzzle && P0.object?.visible !== false ? this.ctx.tool.muzzle(_q) : _q.copy(P0.pos).addScaledVector(P0.frame?.up ?? _Y, 1.4);
      if (hand.distanceTo(a.pos) > R + 0.4) this.tether.set(hand, _p.copy(a.pos).addScaledVector(_v.subVectors(hand, a.pos).normalize(), R)); else this.tether.hide();
    }
  }

  hud() {
    if (this.recalling) return { note: `back ${this.rw.left.toFixed(1)} s` };
    const h = this.hover;
    if (h) return { note: this.history.has(h.key) ? `${this.history.track(h.key).seconds().toFixed(1)} s to send back` : 'it has not moved' };
    return { note: 'aim at what moved' };
  }

  dispose() {
    if (this.recalling) this.stop();
    this.dots.removeFromParent(); this.ring.removeFromParent(); this.tether?.dispose();
    for (const g of this.ghosts) g.removeFromParent();
  }
}
