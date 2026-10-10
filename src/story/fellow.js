import * as THREE from 'three';
import { NPC, registerNPCTargets } from '../npc.js';
import { TANSY, STOPS, MEETINGS, ITEMS, GREETING_LINES, HOME, HOME_TALK } from './fellow-data.js';

// The fellow traveller (src/story/fellow-data.js: Tansy, from the Salt Harbour): met four times along the route,
// a few steps from the traveller's ship, each meeting changed by the last (docs/systems/story.md, "A fellow
// traveller"). src/story/index.js sets her up in every world:
//
//   fellowHere(flags, world)   → { meeting, again } | null: is she here, and with which meeting
//                                (again: the meeting already had here, and she has not moved on yet)
//   fellowPerson(world)        → her def for that world: her talk's pages for it, its entries, her balloon
//   fellowSpot({ ship, physics, level, npcs })  → { at, heading } | null: where she waits
//   setupFellow({ levelId, scene, physics, level, ship, npcs, lib, humans, game, quests, talkable }) → { npc, here } | null
//
// She is in the first MEETINGS of her STOPS the traveller lands in, in whatever order (the route keeps them in
// order nearly always): each stop holds one meeting (`fellow.stop.<world>`), the next one there is (`fellow.meet`
// + 1). A meeting is had once its last answer is given (its node's `had`), so walking off halfway through
// leaves it to be had again. Once it is, she stays where she is for the rest of the visit and any visit
// after, until she is met in the next stop; after the last she is gone (home, or on).

const UP = new THREE.Vector3(0, 1, 0);

/** Is she in this world, and with which meeting? (from the save's flags, when the world is built) */
export function fellowHere(flags = {}, world) {
  if (world === HOME.world) return flags['fellow.end'] === 'home' ? { meeting: 'home', again: true } : null;
  if (!STOPS.includes(world)) return null;
  const met = +flags['fellow.meet'] || 0, here = +flags[`fellow.stop.${world}`] || 0;
  if (here) return here === met && met < MEETINGS ? { meeting: met, again: true } : null;
  return met < MEETINGS ? { meeting: met + 1, again: false } : null;
}

const pageIn = (world) => (p) => !(p && typeof p === 'object' && ((p.world && p.world !== world) || (p.notWorld && p.notWorld === world)));

/** Her def for this world: the pages said here, the meetings marked as had here, the entries, her greeting. */
export function fellowPerson(world, here = null) {
  // (home at the Salt Harbour: a word or two each time, listen-only)
  if (here?.meeting === 'home') return { ...TANSY, lines: ['~happy~ You came!', '~playful~ Sit. Hesper says sit.'], talk: HOME_TALK };
  const nodes = {};
  for (const [id, n] of Object.entries(TANSY.talk.nodes)) {
    const node = { ...n, say: [n.say].flat().filter(pageIn(world)) };
    if (n.had) node.do = [...[n.do ?? []].flat(), { set: { 'fellow.meet': n.had, [`fellow.stop.${world}`]: n.had } }];
    nodes[id] = node;
  }
  const stop = (ctx) => +ctx.game.flag(`fellow.stop.${world}`) || 0;
  const met = (ctx) => +ctx.game.flag('fellow.meet') || 0;
  const entry = [
    ...[1, 2, 3, 4].map((k) => ({ if: (ctx) => stop(ctx) === k, node: `again${k}` })),
    { if: (ctx) => met(ctx) === 0, node: 'm1' },
    { if: (ctx) => met(ctx) === 1, node: 'm2' },
    { if: (ctx) => met(ctx) === 2, node: 'm3' },
    { if: (ctx) => met(ctx) >= 3 && ctx.game.flag('fellow.heart') === 'on', node: 'm4.on' },
    { node: 'm4.home' },
  ];
  const k = here?.meeting ?? 1;
  return {
    ...TANSY,
    lines: here?.again ? ['~neutral~ Still here. Resting my feet.', '~playful~ Don’t tell anyone I stopped.'] : GREETING_LINES[k],
    talk: { entry, nodes },
    // (her balloon: a meeting waiting for you here, src/story/balloons.js)
    fresh: (ctx) => !stop(ctx) && met(ctx) < MEETINGS,
  };
}

/**
 * Where she waits: a few steps out from the ship's ramp and to one side (she saw it come down), on solid ground
 * the traveller can walk to from the ramp, out of the water, with room over her head and nobody on the spot.
 * No ship (a test, a world without one): round the world's spawn instead.
 */
export function fellowSpot({ ship = null, physics, level, npcs = [] }) {
  const foot = ship?.rampFoot ?? level?.spawn;
  if (!foot || !physics) return null;
  const out = ship?.outDir ?? new THREE.Vector3(0, 0, 1);
  const side = new THREE.Vector3(out.z, 0, -out.x);
  const eye = foot.clone().addScaledVector(UP, 1.2);
  for (const d of [8, 10, 6, 13, 16]) {
    for (const s of [5, -5, 6.5, -6.5, 4, -4]) {
      const p = foot.clone().addScaledVector(out, d).addScaledVector(side, s);
      const g = physics.groundAt(p.x, foot.y + 4, p.z, 10);
      if (!Number.isFinite(g) || Math.abs(g - foot.y) > 2.5) continue;
      p.y = g;
      if (level?.unsafe?.(p)) continue;
      if (physics.rayDistance(p.clone().addScaledVector(UP, 0.3), UP, 2) < 1.9) continue;   // (headroom)
      if (npcs.some((n) => n.pos && Math.hypot(n.pos.x - p.x, n.pos.z - p.z) < 3.5)) continue;
      // nothing between the ramp's foot and her (a wall, a rock)
      const to = p.clone().addScaledVector(UP, 1.2).sub(eye), dist = to.length();
      if (physics.rayDistance(eye, to.normalize(), dist) < dist - 0.4) continue;
      // and the ground on the way there walkable (no hole, no cliff between)
      let ok = true;
      for (let t = 0.2; t < 1 && ok; t += 0.2) {
        const q = foot.clone().lerp(p, t), gq = physics.groundAt(q.x, Math.max(foot.y, g) + 3, q.z, 8);
        ok = Number.isFinite(gq) && Math.abs(gq - (foot.y + (g - foot.y) * t)) < 1.6 && !level?.unsafe?.(q.setY(gq));
      }
      if (!ok) continue;
      return { at: p, heading: Math.atan2(foot.x - p.x, foot.z - p.z) };
    }
  }
  return null;
}

/** Her place at home, beside Hesper's book in the Salt Harbour. */
export function homeSpot(physics) {
  const [x, z] = HOME.at, g = physics.groundAt(x, 60, z, 120);
  return Number.isFinite(g) ? { at: new THREE.Vector3(x, g, z), heading: HOME.heading } : null;
}

/** Put her in this world if she is here (src/story/index.js, every world). */
export function setupFellow({ levelId, scene, physics, level, ship = null, npcs = [], lib = null, humans = null, game, quests, talkable }) {
  if (quests) quests.itemNames = { ...(quests.itemNames ?? {}), ...ITEMS };
  const here = fellowHere(game?.data?.flags ?? {}, levelId);
  if (!here || !scene || !physics) return null;
  // (in her stops she waits by the ship: none, none of her (the worlds' own story tests build no ship))
  if (here.meeting !== 'home' && !ship?.rampFoot) return null;
  const spot = here.meeting === 'home' ? homeSpot(physics) : fellowSpot({ ship, physics, level, npcs });
  if (!spot) return null;
  const def = fellowPerson(levelId, here);
  // (made here rather than by the story's spawn: dressed for the Salt Harbour in every world, so she looks the same)
  const npc = new NPC(scene, physics, {
    route: [spot.at.clone()], palette: def.palette, lines: def.lines, lib, human: humans ? humans[1] : null, kind: def.kind,
    scale: def.scale, head: def.head, cape: def.cape, look: def.look, world: def.world, def, speed: 0.6, facing: spot.heading,
  });
  npc.heading = spot.heading;
  if (npc.char?.pack) npc.char.pack.visible = true;   // (a traveller: her pack on her back, every world)
  npcs.push(npc);
  registerNPCTargets([npc]);
  talkable?.(npc, def);
  return { npc, here, def, spot };
}
