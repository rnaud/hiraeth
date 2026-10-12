import * as THREE from 'three';
import { registerInteractable, PRIORITY } from '../interact.js';
import { Puffs } from './puffs.js';
import { THINGS } from './edena-data.js';

// Viridel's way up to the Greenhouse, alive (issue #189; the pieces: src/viridel-stair.js, src/viridel-wrecks.js,
// src/viridel-nursery.js). The water stair's sluice-gates: at the top of each flight a wheel; turned, its board lifts, the
// way on opens, and the bed below floods and blooms. Opened once, a gate stays open (its flag). The round ship's cabin
// under the hill of flowers, and the old pyramid's top over the nursery: things to look at.
//
// Flags: edena.sluice.1 … edena.sluice.3, edena.roundship.seen, edena.nursery.seen.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const SLUICE_FLAG = (k) => `edena.sluice.${k + 1}`;

export function setupEdenaRoute(ctx) {
  const { level, game, sound, scene, toast, dialogue } = ctx;
  const E = level.edena, S = E?.stair;
  if (!S) return null;
  const spray = new Puffs(scene, { color: '#bfe6ea', max: 60, glow: 0.4, detail: 0 });
  for (const G of S.gates) {
    if (game.flag(SLUICE_FLAG(G.k))) S.setOpen(G.k, true, true);
    const at = G.wheel.position;
    registerInteractable({
      id: `edena.sluice.${G.k + 1}`, priority: PRIORITY.use, range: 3.2, prompt: 'turn the sluice wheel', at: () => at.clone().add(V(0, 0.4, 0)),
      enabled: () => !G.open,
      distance: (p) => (Math.abs(p.pos.y - G.stand.y) < 2.5 ? flat(p.pos, at) : Infinity),
      use: () => {
        game.set(SLUICE_FLAG(G.k), true);
        S.setOpen(G.k, true);
        sound.chime?.();
        const f = G.flight;
        for (let j = 0; j < 3; j++) spray.burst(f.steps[Math.floor(f.n * (0.2 + j * 0.3))].clone().add(V(0, 0.3, 0)), { n: 6, rise: 1, size: 0.2, spread: 0.8, life: 1.4, gravity: 5 });
        toast(G.k ? 'The board lifts. Water runs down the steps, and the bed below floods and flowers.' : 'The board lifts. The water runs down past you, and the bottom bed floods and flowers.');
      },
    });
  }
  // the round ship's cabin: a look, inside
  const W = E.wrecks;
  if (W?.pieces?.round) {
    const at = W.pieces.round.drawing;
    registerInteractable({ id: 'edena.roundship', priority: PRIORITY.use, range: 2.8, prompt: 'look round the cabin', at: () => at,
      distance: (p) => (Math.abs(p.pos.y - at.y) < 3 ? flat(p.pos, at) : Infinity), use: () => dialogue.start(THINGS.roundship, null, at) });
  }
  // the old pyramid's top: a look out over the nursery
  const O = E.nursery?.old;
  if (O?.top) {
    const at = O.top.clone();
    registerInteractable({ id: 'edena.oldpyramid', priority: PRIORITY.use, range: 4, prompt: 'look out over the nursery', at: () => at.clone().add(V(0, 1.6, 0)),
      distance: (p) => (Math.abs(p.pos.y - at.y) < 3 ? flat(p.pos, at) : Infinity), use: () => dialogue.start(THINGS.oldpyramid, null, at) });
  }
  const update = (dt) => { spray.update(dt); };
  return { update, spray };
}
