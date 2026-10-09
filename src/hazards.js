import * as THREE from 'three';

// Things that hurt while you touch them: the burning tree's flame, cactus spines, and anything
// else a world registers. Each is a simple volume with a kind and a damage rate (hearts a second).
// While the traveller is inside one, it takes that rate in quarter-heart bites (so the hurt thud
// isn't every frame; the first touch bites at once), and spines push you back out. The first touch of a kind
// says what it is ("It burns!"). Health is src/player.js hurt() / heal().
//
//   const off = registerHazard({ kind: 'fire', dps: 1, test: (p) => bool })
//   registerHazard(cylinderHazard({ kind: 'spikes', x, z, y0, y1, r, dps: 0.5 }))
//   updateHazards(dt, player, { notice })   once a frame (main.js)

/** The rates the world's hazards use (hearts a second): a flame, the cacti's spines, a temple's spike rows. */
export const HAZARD_DPS = { fire: 1, spikes: 0.5, spikeRow: 0.25, embers: 0.75 };
/** Hazards bite a quarter heart at a time; a fresh touch bites at once, but not again within REBITE s. */
const BITE = 0.25, REBITE = 0.75;

const list = [];

/** Add a hazard: { kind, dps, test(pos) -> bool, push?(pos, out) -> Vector3 | null }. Returns a remover. */
export function registerHazard(h) {
  list.push(h);
  return () => { const i = list.indexOf(h); if (i >= 0) list.splice(i, 1); };
}
export const clearHazards = () => { list.length = 0; };
export const hazardCount = () => list.length;
/** The first hazard whose volume holds `pos` (feet), or null (a gadget's bubble pops on one: src/gadgets/bubble.js). */
export const hazardAt = (pos) => list.find((h) => h.test(pos)) ?? null;

/** An upright cylinder (a cactus, a spiked post): you're in it when your body is within r of its axis. */
export function cylinderHazard({ kind, x, z, y0, y1, r, dps, push = kind === 'spikes' }) {
  const r2 = r * r;
  return {
    kind, dps, x, z, r,
    test: (p) => p.y + 1.6 > y0 && p.y < y1 && (p.x - x) ** 2 + (p.z - z) ** 2 < r2,
    push: push ? (p, out) => out.set(p.x - x, 0, p.z - z).normalize() : null,
  };
}

/**
 * A flame's volume: a round-bellied shape over an axis (x, z), from y0 to y1, widest (rMax) at
 * `belly` of the way up, narrowing toward the tip. Climb into it and it burns.
 */
export function flameHazard({ x, z, y0, y1, rMax, belly = 0.5, dps = HAZARD_DPS.fire }) {
  return {
    kind: 'fire', dps, x, z,
    test: (p) => {
      const cy = p.y + 1;   // (the chest)
      if (cy < y0 || cy > y1) return false;
      const k = (cy - y0) / (y1 - y0);
      const r = rMax * (k < belly ? Math.sin((k / belly) * Math.PI / 2) ** 0.55 : 1 - (k - belly) / (1 - belly) * 0.9);
      return (p.x - x) ** 2 + (p.z - z) ** 2 < r * r;
    },
    push: null,
  };
}

const NOTES = { fire: 'It burns! Get out of the flames.', spikes: 'Ouch: spines.' };
const state = { acc: 0, kind: null, cool: 0, told: new Set() };
const _push = new THREE.Vector3();

/**
 * Once a frame: hurt the traveller inside a hazard (the worst one they touch). notice(text) says
 * what it is the first time; returns the kind touched (or null).
 */
export function updateHazards(dt, player, { notice = () => {} } = {}) {
  state.cool = Math.max(0, state.cool - dt);
  if (!player || player.ride || player.hidden || !list.length) { state.acc = 0; state.kind = null; return null; }
  let worst = null;
  for (const h of list) if (h.test(player.pos) && (!worst || h.dps > worst.dps)) worst = h;
  if (!worst) { state.acc = 0; state.kind = null; return null; }
  let first = false;
  if (state.kind !== worst.kind) {
    // just touched it: a first bite at once, so you feel it (not again for a moment: spines that push you out
    // and a step back in don't bite on every touch)
    first = state.cool <= 0;
    state.kind = worst.kind;
    if (!state.told.has(worst.kind)) { state.told.add(worst.kind); notice(NOTES[worst.kind] ?? 'That hurts.'); }
  }
  state.acc += worst.dps * dt;
  if (first || state.acc >= BITE - 1e-9) {
    const q = first ? BITE : Math.floor(state.acc / BITE + 1e-9) * BITE;
    player.hurt?.(q, worst.kind);
    state.acc = first ? 0 : Math.max(0, state.acc - q);
    state.cool = REBITE;
  }
  // spines push you back out (and off the plant if you were climbing it)
  if (worst.push) {
    const d = worst.push(player.pos, _push);
    if (d) {
      if (player.climbing) player.climbing = false;
      player.vel.x = d.x * 5; player.vel.z = d.z * 5;
      if (player.vel.y < 1.5) player.vel.y = 1.5;
    }
  }
  return worst.kind;
}

/** (tests) forget what has been said */
export const resetHazardNotes = () => { state.told.clear(); state.acc = 0; state.kind = null; state.cool = 0; };
