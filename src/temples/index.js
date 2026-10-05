import * as THREE from 'three';
import { game as sharedGame } from '../game-state.js';
import { items } from '../items.js';
import { TempleRuntime } from './runtime.js';
import { DESERT_TEMPLE } from './desert.js';
import * as DESERT_WORDS from './desert-data.js';

// The makers' temples: one great building in each world, a Zelda-style
// dungeon of rooms and puzzles in that world's architecture, with a gadget
// found half-way that is the key to the rest, and a guardian at the end
// (calmed if it lives, stopped if it is a machine), whose resolution changes
// the world outside. LORE.md, "Temples", has the design; README "The
// makers' temples" the system.
//
// Two hooks bring them into the game:
//   attachTemple(levelId, scene, level)   at level build (src/levels/index.js wraps every create):
//                                         builds the temple and joins it to the level (portals, lights,
//                                         init, dynamic, update); level.temple is the runtime
//   setupTempleStory(ctx)                 in the story runtime (src/story/index.js): the temple's quest,
//                                         its local, the locators for the marker and the scout, and the
//                                         per-frame update
//
// TEMPLES: by level id, each { def (the temple: layout, logic, guardian, exterior, change), words }.
// GADGETS: which of the makers' gifts each world keeps in its temple and which it leaves in the open
// (the 50/50 split; src/boxes/placements.js places them).

export const TEMPLES = {
  desert: { def: DESERT_TEMPLE, words: DESERT_WORDS },
};

/**
 * The gifts, world by world: `temple` is the gadget inside the world's temple (the key to its
 * later rooms and its guardian), `world` the gifts left in the open. `built: false` marks a
 * temple still to come: until it is built, its gadget waits in the world as before (`now`).
 * tests/temples.test.js checks the split, and that it matches PLACEMENTS.
 */
export const GADGETS = {
  desert: { temple: 'fire', world: ['backpack', 'star'], built: true },
  incal: { temple: 'jetpack', world: ['soles'], built: false, now: ['jetpack'] },
  arzach: { temple: 'glider', world: ['bell'], built: false, plan: 'the wings move here from Vael II; the bell goes to Vael II’s temple' },
  arzach2: { temple: 'bell', world: ['glider'], built: false },
  garage: { temple: 'coil', world: ['coil'], built: false },
  buried: { temple: 'cell', world: ['resin'], built: false },
  edena: { temple: 'bloom', world: ['lantern'], built: false },
  spheres: { temple: 'lens', world: ['lens'], built: false },
  perdide: { temple: 'stun', world: ['stun'], built: false },
  perdide2: { temple: 'lantern', world: ['cell'], built: false },
  bazaar: { temple: 'echo', world: [], built: false },
};

/** Build the world's temple into its level (if it has one) and join it to the level's hooks. */
export function attachTemple(levelId, scene, level, { game = sharedGame } = {}) {
  const T = TEMPLES[levelId];
  if (!T || !level) return level;
  const rt = new TempleRuntime({ scene, level, def: T.def, game, items });
  level.temple = rt;
  // (first in the list: a level's own doorways keep their places at its end, where its story and tests look)
  (level.portals ??= []).unshift(...rt.portals);
  // (the scout and the quest marker route through the temple's door like any doorway)
  if (level.navigationPortals && level.navigationPortals !== level.portals) level.navigationPortals.unshift(...rt.portals);
  const init = level.init, dynamic = level.dynamic, update = level.update;
  level.init = (physics) => { init?.call(level, physics); rt.init(physics); };
  level.dynamic = () => { const base = dynamic ? dynamic.call(level) : []; return base.length ? [...base, ...rt.solids()] : rt.solids(); };
  level.update = function (dt, t, o = {}) {
    update?.call(level, dt, t, o);
    if (o.fade) rt.fadeFn ??= o.fade;
  };
  return level;
}

/** The story side: the temple's quest, its people, the locators; returns { update } or null. */
export function setupTempleStory(ctx) {
  const { level, levelId, quests, spawn, player, sound, toast, game = sharedGame, physics } = ctx;
  const rt = level?.temple;
  const T = TEMPLES[levelId];
  if (!rt || !T) return null;
  rt.connect({ player, sound, toast, quests, fade: rt.fadeFn });
  const W = T.words, id = rt.id, Q = W.QUEST;
  // the quest: find the house, find what is inside, go down to its heart
  quests?.define?.({
    id: Q.id, title: Q.title, world: levelId, outro: Q.outro,
    stages: [
      { id: 'find', text: Q.find, label: T.def.name, flag: `temple.${id}.entered`, at: `temple.${id}.door` },
      { id: 'gadget', text: Q.gadget, label: 'Inside the house', when: () => rt.logic.gadget, at: `temple.${id}.next` },
      { id: 'keeper', text: Q.keeper, label: 'The heart of the house', flag: `temple.${id}.done`, at: `temple.${id}.next` },
    ],
  });
  quests?.locate?.(`temple.${id}.door`, () => rt.outside?.door.at ?? rt.arrival.pos);
  quests?.locate?.(`temple.${id}.next`, () => nextSpot(rt));
  // you found the door yourself: the quest starts when you come near it, or go in
  const near = () => rt.outside && player && player.pos.distanceTo(rt.outside.door.at) < 70;
  // the local who points you there
  const people = [];
  const P = W.PEOPLE ?? {};
  if (levelId === 'desert' && P.sabri && level.qanat && spawn) {
    const camps = level.qanat.camps, at = camps.spot(34, 8);
    const g = (p) => { const y = physics?.groundAt?.(p.x, p.y + 4, p.z); return new THREE.Vector3(p.x, Number.isFinite(y) ? y : p.y, p.z); };
    const route = [0, 2.1, 4.2].map((a) => g(new THREE.Vector3(at.x + Math.sin(a) * 1.4, at.y, at.z + Math.cos(a) * 1.4)));
    const n = spawn(P.sabri, { route, speed: 0.5 });
    people.push(n);
    quests?.locate?.('sabri', () => n.pos);
  }
  return {
    rt, people,
    update(dt, t) {
      if (!quests?.isStarted?.(Q.id) && (near() || game.flag(`temple.${id}.entered`))) quests.start(Q.id);
      rt.update(dt, t);
    },
  };
}

/** Where the marker points inside a temple: the next thing to do (logic.next), else the arrival. */
export function nextSpot(rt) {
  // in the arena, while it is awake: it
  if (rt.guardian?.awake) return rt.guardian.model.pos.clone();
  const id = rt.logic.next();
  const e = id && rt.logic.el(id);
  if (e?.type === 'gadget' && rt.gadgetSite) return new THREE.Vector3(...rt.gadgetSite.at);
  if (e?.type === 'boss' && rt.guardian) return rt.guardian.model.pos.clone();
  const p = id && rt.piece(id);
  const at = p?.center ?? p?.pos ?? p?.group?.position;
  if (at) return at.clone();
  if (rt.logic.resolved) return rt.doorOut?.clone() ?? rt.arrival.pos.clone();
  return rt.arrival.pos.clone();
}
