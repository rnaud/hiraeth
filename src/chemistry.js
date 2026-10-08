import * as THREE from 'three';
import { allTargets } from './targets.js';

// The world's chemistry (docs/systems/living-world.md, "The world's chemistry"): a few general
// rules by which fire, wind, stilling, bloom, creatures and foes act on each other without the
// traveller, in place of per-scene scripts. It reads everything through the target registry
// (src/targets.js), so whatever registers a flammable (src/flammable.js spots, the temples' brambles,
// the Gadget Yard's fire) or a foe takes part:
//   fire spreads    a burning spot (a bramble, a flared camp fire, a lamp) lights the dry brambles and
//                   unlit lamps near it after a moment: further downwind, less far upwind (spreadReach)
//   wind's embers   a burning bramble throws embers on the world wind (player.wind, set from the sky's
//                   slowly turning wind in main.js); a gust of the fan through one throws a fistful
//                   down the gust. Where an ember lands on a dry bramble, it catches
//   creatures       wildlife near a fire flee it (Wildlife.scare)
//   foes            one in a fire takes the fire (its target's onHit 'fire', at most once a second);
//                   one lit (by a fire or an ember glob) sets alight the dry brambles it walks into
//   stilling        a stilling glob puts a fire out; bloom regrows a burnt bramble at once (flammable.js;
//                   a bloom glob on the ground beside one counts too, 'tool:bloom')
// Cheap: the rules look only within CHEM.near of the traveller, CHEM.hz times a second; the embers
// fly every frame (a dozen at most). A cap keeps a whole world from burning at once.

export const CHEM = {
  hz: 8,             // rule checks a second
  near: 140,         // m round the traveller the rules look
  reach: 2.2,        // m, edge to edge, a burning bramble lights a dry one in still air
  down: 2.2,         // x the reach straight downwind in a full wind
  up: 0.35,          // x the reach straight upwind in a full wind
  windFull: 2.5,     // m/s of wind that counts as full (a windy world's breeze; storms are more, capped)
  lamp: 0.6,         // x the reach a lamp catches at (it wants the fire right by it)
  delay: [0.45, 1.5],// s before a spot catches: near the fire soon, at the reach's edge later
  maxSpread: 10,     // fires going (and about to catch) past which nothing more spreads (BURN.maxLit is 14)
  retry: 4,          // s before a spot that would not catch is tried again
  scare: 6,          // m round a fire creatures flee (+2 per heat: a flare's further)
  foeTouch: 0.6,     // m past both radii a foe touches a fire (or a bramble)
  foeCool: 1,        // s between the fire a foe takes from standing in one
  foeLit: 4,         // s a foe stays lit after the fire touched it
  embers: { max: 12, rate: 0.9, drag: 0.6, grav: 1.1, life: [1.3, 2.1], land: 0.5, gust: 6 },
};
const EMBER_TONES = ['#ffd27a', '#ff9a3c', '#ff6a2a'];
const Y = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** How much of a full wind `speed` m/s is: 0..1. Pure. */
export const windStrength = (speed) => clamp01((speed ?? 0) / CHEM.windFull);

/**
 * How far (m, edge to edge) a fire at `from` reaches toward `to` with the wind blowing along `windDir`
 * (x, z; any length) at `windSpeed` m/s: CHEM.reach x heat in still air, up to CHEM.down times that
 * straight downwind and down to CHEM.up times upwind in a full wind, in between across it. Pure.
 */
export function spreadReach(windDir, windSpeed, from, to, { reach = CHEM.reach, heat = 1 } = {}) {
  const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz);
  const wl = Math.hypot(windDir?.x ?? 0, windDir?.z ?? 0), w = windStrength(windSpeed);
  const c = d > 1e-6 && wl > 1e-6 ? (dx * windDir.x + dz * windDir.z) / (d * wl) : 0;
  const k = c >= 0 ? 1 + c * w * (CHEM.down - 1) : 1 + c * w * (1 - CHEM.up);
  return reach * heat * k;
}

/** The gap between two round things (centres a, b; radii ra, rb), never below 0. Pure. */
export const gapBetween = (a, ra, b, rb) => Math.max(0, a.distanceTo(b) - ra - rb);

/** Seconds before a spot `gap` m from a fire that reaches `reach` m catches. Pure. */
export const spreadDelay = (gap, reach) => CHEM.delay[0] + (CHEM.delay[1] - CHEM.delay[0]) * clamp01(reach > 0 ? gap / reach : 1);

/** One step of an ember's flight (the fluid tool's dots move the same way): drag, a slow fall. Pure (moves e). */
export function emberStep(e, dt, up = Y) {
  e.vel.multiplyScalar(Math.exp(-CHEM.embers.drag * dt)).addScaledVector(up, -CHEM.embers.grav * dt);
  e.pos.addScaledVector(e.vel, dt);
  e.age += dt;
  return e.age >= e.life;
}

/** Where a burnt-out ember lands, flown from `from` at `vel` for `life` s (for tests and tuning). Pure. */
export function emberLanding(from, vel, life, dt = 1 / 60) {
  const e = { pos: from.clone(), vel: vel.clone(), age: 0, life };
  while (!emberStep(e, dt));
  return e.pos;
}

export class Chemistry {
  /**
   * @param o.flammables  the level's Flammables (src/flammable.js): its spots, how hot they burn, what can catch
   * @param o.wildlife    Wildlife (src/wildlife.js): scare(p, r, life)
   * @param o.tool        the fluid tool: its glow dots draw the embers (optional)
   * @param o.game        game state: 'tool:bloom' (a bloom glob landed on the world)
   * @param o.wind        the world wind, a Vector3 (x, z) kept up to date (player.wind)
   */
  constructor({ flammables = null, wildlife = null, tool = null, game = null, wind = null, rng = Math.random } = {}) {
    this.fl = flammables; this.wildlife = wildlife; this.tool = tool; this.rng = rng;
    this.wind = wind ?? new THREE.Vector3();
    this.time = 0; this.acc = 0;
    this.focus = new THREE.Vector3(1e9, 0, 0);
    this.pending = new Map();      // target -> { at, from }: about to catch
    this.tried = new WeakMap();    // target -> when the chemistry last lit it (or tried)
    this.foeHit = new WeakMap();   // foe target -> when it last took the fire from standing in one
    this.foeLitAt = new WeakMap(); // foe target -> when fire last touched it (a fire, an ember glob)
    this.watched = new WeakSet();
    this.embers = [];
    this.dry = [];                 // the dry spots of the last check (where embers may land)
    this.stats = { spread: 0, embers: 0, foes: 0 };
    if (flammables) flammables.onGust = (s, dir, info) => this.gustEmbers(s.centre, dir, info?.strength ?? 1);
    this.offBloom = game?.on?.('tool:bloom', (e) => e?.point && this.fl?.bloomNear?.(e.point));
  }

  /** What a registered target is to the fire: { t, pos, r, kind, heat (0: not burning), dry (can catch) }, or null. */
  node(t) {
    const s = t.spot;
    if (s && this.fl && t.kind === 'flammable') return { t, s, pos: s.centre, r: s.r, kind: s.kind, heat: this.fl.heatOf(s), dry: this.fl.canCatch(s) };
    if (t.kind === 'flammable' || t.kind === 'ember') {
      const b = !!t.burning?.();
      return { t, pos: t.position(), r: t.radius, kind: t.flammable ?? t.kind, heat: b ? 1 : 0, dry: !b && t.flammable === 'bramble' && t.enabled() };
    }
    return null;
  }

  /** Note when an ember glob (or anything) gives a foe the fire: it is lit for a while. (Wraps its target's onHit.) */
  watch(t) {
    this.watched.add(t);
    const on = t.onHit;
    t.onHit = (mode, ...rest) => { if (mode === 'fire') this.foeLitAt.set(t, this.time); return on?.call(t, mode, ...rest); };
  }
  litFoe(t) { return this.time - (this.foeLitAt.get(t) ?? -1e9) < CHEM.foeLit || t.foe?.lit > 0; }

  update(dt, focus) {
    this.time += dt;
    if (focus) this.focus.copy(focus);
    this.flyEmbers(dt);
    for (const [t, p] of this.pending) if (this.time >= p.at) { this.pending.delete(t); this.light(t, p.from); }
    this.acc += dt;
    if (this.acc < 1 / CHEM.hz) return;
    const step = this.acc; this.acc = 0;
    this.tick(step);
  }

  /** It catches: as if an ember glob landed on it. */
  light(t, from) {
    this.tried.set(t, this.time);
    const p = t.position();
    const dir = from ? _v.subVectors(p, from).setY(0) : _v.set(0, 0, 0);
    if (dir.lengthSq() > 1e-6) dir.normalize(); else dir.set(0, 0, 1);
    this.stats.spread++;
    return t.onHit?.('fire', p.clone(), dir.clone(), { mode: 'fire', source: 'chemistry', colours: EMBER_TONES });
  }

  /** Set target t to catch in `delay` s (unless it already will, or too much burns). Returns true if it will. */
  schedule(t, delay, from) {
    if (this.pending.has(t) || this.going() >= CHEM.maxSpread) return false;
    this.pending.set(t, { at: this.time + delay, from: from.clone() });
    return true;
  }
  going() { return (this.fl?.burning?.length ?? 0) + this.pending.size; }

  tick(step) {
    const near2 = CHEM.near * CHEM.near, F = this.focus;
    const fires = [], dry = [], foes = [];
    for (const t of allTargets()) {
      if (t.kind === 'foe') {
        if (!this.watched.has(t)) this.watch(t);
        if (t.foe?.alive !== false && t.enabled() && t.position().distanceToSquared(F) < near2) foes.push(t);
        continue;
      }
      if (t.kind !== 'flammable' && t.kind !== 'ember') continue;
      const n = this.node(t);
      if (!n || n.pos.distanceToSquared(F) > near2) continue;
      if (n.heat > 0) fires.push(n);
      else if (n.dry && !this.pending.has(t) && !(this.time - (this.tried.get(t) ?? -1e9) < CHEM.retry)) dry.push(n);
    }
    this.dry = dry;
    if (!fires.length && !foes.length) return;
    const W = this.wind, ws = Math.hypot(W.x, W.z), w = windStrength(ws);
    for (const f of fires) {
      // 1. fire spreads to what is dry and near enough (the wind stretching it)
      for (const d of dry) {
        if (this.pending.has(d.t)) continue;
        const gap = gapBetween(f.pos, f.r, d.pos, d.r);
        const reach = spreadReach(W, ws, f.pos, d.pos, { heat: f.heat }) * (d.kind === 'bramble' ? 1 : CHEM.lamp);
        if (gap <= reach) this.schedule(d.t, spreadDelay(gap, reach), f.pos);
      }
      // 2. creatures flee it
      this.wildlife?.scare?.(f.pos, CHEM.scare + f.heat * 2, 0.6);
      // 3. a foe standing in it takes the fire
      for (const t of foes) {
        const p = t.position();
        if (gapBetween(p, t.radius, f.pos, f.r) <= CHEM.foeTouch) this.burnFoe(t, p, f.pos);
      }
      // 4. the wind takes a burning bramble's embers
      if (f.kind === 'bramble' && w > 0.05 && this.rng() < CHEM.embers.rate * w * step) this.windEmber(f.pos, W, w);
    }
    // 5. a lit foe sets alight the dry brambles it walks into
    for (const t of foes) {
      if (!this.litFoe(t)) continue;
      const p = t.position();
      if (this.rng() < 0.5) this.spark(p);
      for (const d of dry) if (d.kind === 'bramble' && gapBetween(p, t.radius, d.pos, d.r) <= CHEM.foeTouch) this.schedule(d.t, 0.3, p);
    }
  }

  burnFoe(t, p, from) {
    if (this.time - (this.foeHit.get(t) ?? -1e9) < CHEM.foeCool) return false;
    this.foeHit.set(t, this.time);
    const dir = _w.subVectors(p, from).setY(0);
    if (dir.lengthSq() > 1e-6) dir.normalize(); else dir.set(0, 0, 1);
    this.stats.foes++;
    t.onHit?.('fire', p.clone(), dir.clone(), { mode: 'fire', source: 'chemistry', colours: EMBER_TONES });
    this.foeLitAt.set(t, this.time);
    return true;
  }

  // ------------------------------------------------------------------ embers

  /** One ember off a burning bramble, on the world wind (w: its strength 0..1). */
  windEmber(at, wind, w) {
    const r = this.rng, L = Math.hypot(wind.x, wind.z) || 1;
    const sp = 1.5 + 2.2 * w + r() * 1.5, side = (r() - 0.5) * 1.2;
    const vel = new THREE.Vector3((wind.x / L) * sp - (wind.z / L) * side, 1.2 + r() * 1.2, (wind.z / L) * sp + (wind.x / L) * side);
    const [a, b] = CHEM.embers.life;
    return this.launch(_v.copy(at).addScaledVector(Y, 0.5 + r() * 0.6), vel, a + r() * (b - a));
  }

  /** A gust of the fan through a burning bramble: a fistful of embers thrown down the gust (strength 0..1). */
  gustEmbers(at, dir, strength = 1) {
    const r = this.rng, flat = _w.set(dir?.x ?? 0, 0, dir?.z ?? 1);
    if (flat.lengthSq() < 1e-6) flat.set(0, 0, 1);
    flat.normalize();
    const n = Math.round(CHEM.embers.gust * (0.5 + 0.5 * clamp01(strength)));
    let out = 0;
    for (let i = 0; i < n; i++) {
      const sp = 4 + r() * 3.5, side = (r() - 0.5) * 2.4;
      const vel = new THREE.Vector3(flat.x * sp - flat.z * side, 1 + r() * 1.5, flat.z * sp + flat.x * side);
      if (this.launch(_v.copy(at).addScaledVector(Y, 0.3 + r() * 0.6), vel, 1 + r() * 0.6)) out++;
    }
    return out;
  }

  launch(pos, vel, life) {
    if (this.embers.length >= CHEM.embers.max) return null;
    const e = { pos: pos.clone(), vel: vel.clone(), age: 0, life, trail: 0 };
    this.embers.push(e);
    this.stats.embers++;
    // drawn: one glowing dot flying the same way (the fluid tool's glow, src/fluid-tool.js), a short trail behind
    this.tool?.glow?.add?.({ pos: e.pos, vel: e.vel, drag: CHEM.embers.drag, grav: CHEM.embers.grav, size: 0.07, life, color: EMBER_TONES[this.stats.embers % 3] });
    return e;
  }

  spark(p) {
    this.tool?.glow?.add?.({ pos: _v.copy(p).add(_w.set(this.rng() - 0.5, 0, this.rng() - 0.5).multiplyScalar(0.6)), vel: _w.set(0, 1.4, 0), drag: 2, size: 0.045, life: 0.5, color: EMBER_TONES[(this.rng() * 3) | 0], grow: true });
  }

  flyEmbers(dt) {
    if (!this.embers.length) return;
    for (const e of [...this.embers]) {
      if ((e.trail += dt) > 0.09 && this.tool?.glow) { e.trail = 0; this.tool.glow.add({ pos: e.pos, vel: _w.set(0, 0.2, 0), drag: 3, size: 0.035, life: 0.25, color: EMBER_TONES[2] }); }
      if (!emberStep(e, dt)) continue;
      this.embers.splice(this.embers.indexOf(e), 1);
      this.land(e.pos);
    }
  }

  /** An ember came down at p: a dry bramble under it catches. */
  land(p) {
    for (const d of this.dry) {
      if (d.kind !== 'bramble' || this.pending.has(d.t)) continue;
      if (Math.hypot(p.x - d.pos.x, p.z - d.pos.z) <= d.r + CHEM.embers.land && Math.abs(p.y - d.pos.y) < 3) return this.schedule(d.t, 0.35, p);
    }
    return false;
  }

  dispose() {
    this.offBloom?.();
    if (this.fl?.onGust) this.fl.onGust = null;
    this.embers.length = 0; this.pending.clear();
  }
}
