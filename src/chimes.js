import * as THREE from 'three';
import { makeMaterial } from './materials.js';

// Chimes, the currency (docs/systems/items.md, "Chimes"): small pierced brass discs that ring when they fall,
// the kind the route's people trade (the City-Shaft's lift and taxi tokens, Tobin's bent coin). The wallet is
// src/resources.js (resources.chimes, addChimes, spend, the 'wallet' event); this module is where they come
// from and how they lie in the world:
//
//   dropAmount({ kind, category }, rng)   what a foe cut down leaves (DROP_OF by kind, DROP_CATEGORY for the
//                                         100 world enemies by their category), a little spread
//   dropPolicy(level)                     'on' | 'training' (the Arena: into the wallet, not counted as earned)
//                                         | 'off' (a game's own foes: Ink tide; or level.foes.chimes false)
//   PURSE                                 the one-time purses: a temple's guardian, a makers' run's first finish
//   pieceValues(n)                        the pieces a drop scatters (ones; fives for a big drop)
//   ChimeField                            the pieces: pop out in a little arc, bounce, hover and turn, glint;
//                                         walked over (PIECE.take) or drawn in (PIECE.magnet) they are picked
//                                         up; left, they blink (PIECE.blink) and are gone after PIECE.life s
//   ChimeView                             draws a field (one instanced mesh of discs, one of glints)

/** What a foe of each kind leaves, in chimes (a fraction is a chance of one: the swarm's six blots, the splinters). */
export const DROP_OF = {
  swarm: 0.5, splinter: 0.5, moth: 1,                  // the small ones, that come in groups
  blot: 2, spitter: 3, flyer: 3, ray: 4, drone: 4, hound: 4,
  stalker: 5, crab: 5, machine: 6,
  shade: 8, golem: 8, slag: 8,                         // the heavy ones
};
/** The 100 world enemies (src/enemies/roster.js), by their category. */
export const DROP_CATEGORY = { 'local-creature': 4, 'shadow-spirit': 6, 'possessed-machine': 8 };
/** The one-time purses: each temple's guardian resolved (and each sparring bout in the Arena's ring), a makers' run's first finish. */
export const PURSE = { guardian: 40, run: 15 };
/** The spread round a drop's base (±), never under one. */
export const SPREAD = 0.25;

/** Chimes a foe cut down leaves: { kind, category } (category: a world enemy's). rng in [0, 1). */
export function dropAmount({ kind = null, category = null } = {}, rng = Math.random) {
  const base = category && DROP_CATEGORY[category] != null ? DROP_CATEGORY[category] : DROP_OF[kind] ?? 1;
  if (base < 1) return rng() < base ? 1 : 0;
  return Math.max(1, Math.round(base * (1 - SPREAD + rng() * SPREAD * 2)));
}

/** Whether foes drop chimes in this level: 'off' (a game's own foes, or level.foes.chimes false), 'training' (the Arena's waves and list), 'on'. */
export function dropPolicy(level) {
  const F = level?.foes ?? {};
  if (F.chimes === false || F.own) return 'off';
  if (F.chimes === 'training' || F.waves) return 'training';
  return 'on';
}

/** The pieces a drop of n chimes scatters: ones, and for a big drop (PIECE.fiveFrom and over) fives first. */
export function pieceValues(n) {
  n = Math.max(0, Math.floor(n));
  if (n < PIECE.fiveFrom) return Array(n).fill(1);
  return [...Array(Math.floor(n / 5)).fill(5), ...Array(n % 5).fill(1)];
}

/**
 * The pieces' tuning (m, s). flight: s in the air; spread: m out from where it fell; rise: m the arc goes up;
 * hover: m over the ground at rest; wait: s before it can be picked up (it is seen popping out first); magnet:
 * m from the traveller's middle it is drawn in from; take: m it is picked up at; pull: m/s² drawn in; life: s
 * on the ground; blink: s before the end it blinks; glint: s between a piece's glints.
 */
export const PIECE = {
  flight: [0.45, 0.7], spread: [0.5, 1.7], rise: [1.1, 1.9], bounce: 0.22, bounceT: 0.24, hover: 0.32,
  wait: 0.45, magnet: 2.4, take: 0.65, pull: 30, life: 30, blink: 5, glint: [1.4, 3], max: 160, fiveFrom: 10,
};

/** Whether a piece is drawn this moment: always, but in its last PIECE.blink s it blinks, faster towards the end. */
export function pieceVisible(p) {
  if (p.phase === 'pull') return true;
  const left = PIECE.life - p.age;
  if (left > PIECE.blink) return true;
  const rate = left > PIECE.blink / 2 ? 5 : 10;   // (blinks a second)
  return Math.floor(p.age * rate * 2) % 2 === 0;
}

const lerp = (a, b, k) => a + (b - a) * k;

/** The pieces lying in the world (pure: plain vectors; tested in node). */
export class ChimeField {
  /**
   * @param o.groundAt (x, y, z) → the ground's height under a point near y, or null (then it lands where it fell)
   * @param o.rng      [0, 1)
   * @param o.onTake   (piece) when one is picked up (main.js: into the wallet, the sound, the HUD)
   */
  constructor({ groundAt = null, rng = Math.random, onTake = () => {} } = {}) {
    Object.assign(this, { groundAt, rng, onTake });
    this.list = [];
  }

  /** Scatter n chimes from `at` (a foe's feet, a guardian's). `training`: the Arena's (carried on each piece). Returns the pieces. */
  drop(at, n, { training = false } = {}) {
    const out = [], r = this.rng;
    for (const value of pieceValues(n)) {
      if (this.list.length >= PIECE.max) this.list.shift();
      const a = r() * Math.PI * 2, d = lerp(PIECE.spread[0], PIECE.spread[1], r()) * (value > 1 ? 1.2 : 1);
      const to = new THREE.Vector3(at.x + Math.sin(a) * d, at.y, at.z + Math.cos(a) * d);
      const g = this.groundAt?.(to.x, at.y, to.z);
      if (Number.isFinite(g) && Math.abs(g - at.y) < 4) to.y = g;   // (no ledge far below or above: it stays at the foe's height)
      const p = {
        value, training: !!training, phase: 'fly', age: 0, t: 0,
        from: new THREE.Vector3(at.x, at.y + 0.6, at.z), to, rest: to.clone(),
        flight: lerp(PIECE.flight[0], PIECE.flight[1], r()), rise: lerp(PIECE.rise[0], PIECE.rise[1], r()),
        pos: new THREE.Vector3(at.x, at.y + 0.6, at.z), speed: 0, spin: r() * Math.PI * 2, glintIn: lerp(PIECE.glint[0], PIECE.glint[1], r()), glint: 0,
      };
      this.list.push(p); out.push(p);
    }
    return out;
  }

  /**
   * One frame. `player`: the traveller's feet (a point), or null (can't pick up: knocked out, in a scene).
   * `height`: from the feet to the traveller's middle (where pieces are drawn to). Returns the pieces picked up.
   */
  update(dt, player = null, { height = 0.9 } = {}) {
    const taken = [];
    const mid = player ? _mid.set(player.x, player.y + height, player.z) : null;
    for (const p of this.list) {
      p.age += dt; p.t += dt;
      p.spin += dt * (p.phase === 'pull' ? 14 : 3);
      if (p.phase === 'fly') {
        const u = Math.min(1, p.t / p.flight);
        p.pos.set(lerp(p.from.x, p.to.x, u), lerp(p.from.y, p.to.y + PIECE.hover, u) + 4 * p.rise * u * (1 - u), lerp(p.from.z, p.to.z, u));
        if (u >= 1) { p.phase = 'bounce'; p.t = 0; }
      } else if (p.phase === 'bounce') {
        const u = Math.min(1, p.t / PIECE.bounceT);
        p.pos.set(p.to.x, p.to.y + PIECE.hover + 4 * PIECE.bounce * u * (1 - u), p.to.z);
        if (u >= 1) { p.phase = 'rest'; p.t = 0; }
      } else if (p.phase === 'rest') {
        p.pos.set(p.to.x, p.to.y + PIECE.hover + Math.sin(p.age * 2.4 + p.spin * 0.1) * 0.04, p.to.z);
        p.glintIn -= dt;
        if (p.glintIn <= 0) { p.glint = 0.3; p.glintIn = lerp(PIECE.glint[0], PIECE.glint[1], this.rng()); }
      }
      p.glint = Math.max(0, p.glint - dt);
      if (!mid || p.age < PIECE.wait) continue;
      const d = p.pos.distanceTo(mid), feet = Math.hypot(p.pos.x - player.x, p.pos.z - player.z);
      // walked over (round the feet, up to the middle), or drawn in from the magnet's reach
      const over = feet < PIECE.take && p.pos.y > player.y - 0.5 && p.pos.y < player.y + height * 2;
      if (over || d < PIECE.take) { p.done = true; taken.push(p); continue; }
      if (p.phase !== 'pull' && d < PIECE.magnet) { p.phase = 'pull'; p.speed = 2; }
      if (p.phase === 'pull') {
        p.speed += PIECE.pull * dt;
        const step = Math.min(d, p.speed * dt);
        p.pos.addScaledVector(_dir.subVectors(mid, p.pos).normalize(), step);
        if (p.pos.distanceTo(mid) < PIECE.take * 0.5) { p.done = true; taken.push(p); }
      }
    }
    // the ones left too long go; the ones picked up, into the wallet
    this.list = this.list.filter((p) => !p.done && (p.phase === 'pull' || p.age < PIECE.life));
    for (const p of taken) this.onTake(p);
    return taken;
  }

  clear() { this.list = []; }
  /** Chimes lying about (the pieces' values). */
  get lying() { return this.list.reduce((s, p) => s + p.value, 0); }
}
const _mid = new THREE.Vector3(), _dir = new THREE.Vector3();

/**
 * The drops wired to the game's events (main.js; tests): 'foe:burst' scatters a foe's chimes where it fell (not
 * one lost out of the world or into deep water, none when the policy is 'off'); 'temple:resolved' a guardian's
 * purse, once per temple (flag res.purse.<id>); 'guardian:spar' (the Arena's ring) a purse each bout, as
 * training. `purseAt(pos)`: where a purse lands (main.js: on the floor between the guardian and you).
 * Returns a function that unhooks them.
 */
export function connectDrops(game, field, { policy = 'on', purseAt = (pos) => pos, sound = null, rng = Math.random } = {}) {
  const training = policy === 'training';
  const offs = [
    game.on('foe:burst', (e) => {
      if (policy === 'off' || e?.lost || !e?.pos) return;
      const n = dropAmount(e, rng);
      if (n) { field.drop(e.pos, n, { training }); sound?.chimeScatter?.(); }
    }),
    game.on('temple:resolved', ({ id, pos } = {}) => {
      const k = `res.purse.${id}`;
      if (!id || game.flag(k)) return;
      game.set(k, true);
      field.drop(purseAt(pos), PURSE.guardian); sound?.chimeScatter?.(true);
    }),
    game.on('guardian:spar', ({ pos } = {}) => {
      if (policy === 'off' || !pos) return;
      field.drop(purseAt(pos), PURSE.guardian, { training: true }); sound?.chimeScatter?.(true);
    }),
  ];
  return () => offs.forEach((off) => off?.());
}

// ------------------------------------------------------------------ the look

/** A chime: a brass disc pierced with a square hole, a raised rim (m; its face is in the xy plane). */
export function chimeGeometry(r = 0.12) {
  const s = new THREE.Shape(); s.absarc(0, 0, r, 0, Math.PI * 2, false);
  const h = r * 0.3, hole = new THREE.Path(); hole.moveTo(-h, -h); hole.lineTo(-h, h); hole.lineTo(h, h); hole.lineTo(h, -h); hole.closePath();
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: r * 0.16, bevelEnabled: true, bevelThickness: r * 0.06, bevelSize: r * 0.06, bevelSegments: 1, curveSegments: 18 });
  g.translate(0, 0, -r * 0.08);
  return g;
}
/** A glint: a flat four-point star (the light catching an edge). */
export function glintGeometry(r = 0.16) {
  const s = new THREE.Shape(), k = r * 0.16;
  s.moveTo(0, r); s.lineTo(k, k); s.lineTo(r, 0); s.lineTo(k, -k); s.lineTo(0, -r); s.lineTo(-k, -k); s.lineTo(-r, 0); s.lineTo(-k, k); s.closePath();
  return new THREE.ShapeGeometry(s);
}

/** The tones: a one is brass, a five a paler, larger chime. */
export const CHIME_TONES = { 1: '#d6a13e', 5: '#f0d98a' };

/** Draws a ChimeField: the discs turning on their edge (one instanced mesh), and a glint now and then. */
export class ChimeView {
  constructor(parent, max = PIECE.max) {
    this.discs = new THREE.InstancedMesh(chimeGeometry(), makeMaterial({ metal: 'brass', color: '#ffffff', glow: 0.25, key: 'chimes' }), max);
    this.discs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.glints = new THREE.InstancedMesh(glintGeometry(), makeMaterial({ color: '#fff8dc', flat: true, glow: 1, side: THREE.DoubleSide, key: 'chime-glint' }), 32);
    for (const m of [this.discs, this.glints]) { m.frustumCulled = false; m.count = 0; m.userData.noCollide = true; m.name = 'Chimes'; parent?.add(m); }
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._c = new THREE.Color(); this._e = new THREE.Euler();
  }
  /** camera: the glints face it. */
  update(field, camera = null) {
    let i = 0, j = 0;
    for (const p of field.list) {
      if (!pieceVisible(p)) continue;
      const s = p.value > 1 ? 1.45 : 1;
      const grow = p.phase === 'fly' ? Math.min(1, 0.4 + p.t * 3) : p.phase === 'pull' ? 0.85 : 1;
      this._q.setFromEuler(this._e.set(0.18, p.spin, 0));
      this._m.compose(p.pos, this._q, this._s.setScalar(s * grow));
      this.discs.setMatrixAt(i, this._m);
      this.discs.setColorAt(i, this._c.set(CHIME_TONES[p.value] ?? CHIME_TONES[1]));
      i++;
      if (p.glint > 0 && j < 32) {
        const k = Math.sin((1 - p.glint / 0.3) * Math.PI);
        if (camera) this._q.copy(camera.quaternion); else this._q.identity();
        this._m.compose(_gp.copy(p.pos).add(_off.set(0.05, 0.06, 0).applyQuaternion(this._q)), this._q, this._s.setScalar(Math.max(0.01, k * s)));
        this.glints.setMatrixAt(j++, this._m);
      }
    }
    this.discs.count = i; this.glints.count = j;
    this.discs.instanceMatrix.needsUpdate = true; this.glints.instanceMatrix.needsUpdate = true;
    if (this.discs.instanceColor) this.discs.instanceColor.needsUpdate = true;
  }
  dispose() {
    for (const m of [this.discs, this.glints]) { m.removeFromParent(); m.geometry.dispose(); m.dispose?.(); }
  }
}
const _gp = new THREE.Vector3(), _off = new THREE.Vector3();
