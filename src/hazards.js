import * as THREE from 'three';

// Things that hurt while you touch them: the burning tree's flame, cactus spines, and anything
// else a world registers. Each is a simple volume with a kind and a damage rate (share of the
// health bar per second). While the traveller is inside one, it takes that rate (in small bites,
// so the hurt thud isn't every frame), and spines push you back out. The first touch of a kind
// says what it is ("It burns!"). Health is src/player.js hurt() / heal().
//
//   const off = registerHazard({ kind: 'fire', dps: 0.3, test: (p) => bool })
//   registerHazard(cylinderHazard({ kind: 'spikes', x, z, y0, y1, r, dps: 0.12 }))
//   updateHazards(dt, player, { notice })   once a frame (main.js)

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
export function flameHazard({ x, z, y0, y1, rMax, belly = 0.5, dps = 0.3 }) {
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
const state = { acc: 0, kind: null, told: new Set() };
const _push = new THREE.Vector3();

/**
 * Once a frame: hurt the traveller inside a hazard (the worst one they touch). notice(text) says
 * what it is the first time; returns the kind touched (or null).
 */
export function updateHazards(dt, player, { notice = () => {} } = {}) {
  if (!player || player.ride || player.hidden || !list.length) { state.acc = 0; state.kind = null; return null; }
  let worst = null;
  for (const h of list) if (h.test(player.pos) && (!worst || h.dps > worst.dps)) worst = h;
  if (!worst) { state.acc = 0; state.kind = null; return null; }
  let first = false;
  if (state.kind !== worst.kind) {
    // just touched it: a first bite at once, so you feel it
    first = true;
    state.kind = worst.kind;
    state.acc = Math.max(state.acc, worst.dps * 0.25);
    if (!state.told.has(worst.kind)) { state.told.add(worst.kind); notice(NOTES[worst.kind] ?? 'That hurts.'); }
  }
  state.acc += worst.dps * dt;
  if (first || state.acc >= 0.05) { player.hurt?.(state.acc, worst.kind); state.acc = 0; }
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
export const resetHazardNotes = () => { state.told.clear(); state.acc = 0; state.kind = null; };
