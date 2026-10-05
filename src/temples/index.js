import * as THREE from 'three';
import { game as sharedGame } from '../game-state.js';
import { items } from '../items.js';
import { TempleRuntime } from './runtime.js';
import { DESERT_TEMPLE } from './desert.js';
import * as DESERT_WORDS from './desert-data.js';
import { INCAL_TEMPLE } from './incal.js';
import * as INCAL_WORDS from './incal-data.js';
import { ARZACH2_TEMPLE } from './arzach2.js';
import * as ARZACH2_WORDS from './arzach2-data.js';
import { SPHERES_TEMPLE } from './spheres.js';
import * as SPHERES_WORDS from './spheres-data.js';
import { BURIED_TEMPLE } from './buried.js';
import * as BURIED_WORDS from './buried-data.js';
import { PERDIDE2_TEMPLE } from './perdide2.js';
import * as PERDIDE2_WORDS from './perdide2-data.js';
import { PERDIDE_TEMPLE } from './perdide.js';
import * as PERDIDE_WORDS from './perdide-data.js';
import { ARZACH_TEMPLE } from './arzach.js';
import * as ARZACH_WORDS from './arzach-data.js';
import { GARAGE_TEMPLE } from './garage.js';
import * as GARAGE_WORDS from './garage-data.js';
import { EDENA_TEMPLE } from './edena.js';
import * as EDENA_WORDS from './edena-data.js';
import { BAZAAR_TEMPLE } from './bazaar.js';
import * as BAZAAR_WORDS from './bazaar-data.js';

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
  incal: { def: INCAL_TEMPLE, words: INCAL_WORDS },
  arzach2: { def: ARZACH2_TEMPLE, words: ARZACH2_WORDS },
  spheres: { def: SPHERES_TEMPLE, words: SPHERES_WORDS },
  buried: { def: BURIED_TEMPLE, words: BURIED_WORDS },
  perdide2: { def: PERDIDE2_TEMPLE, words: PERDIDE2_WORDS },
  perdide: { def: PERDIDE_TEMPLE, words: PERDIDE_WORDS },
  arzach: { def: ARZACH_TEMPLE, words: ARZACH_WORDS },
  garage: { def: GARAGE_TEMPLE, words: GARAGE_WORDS },
  edena: { def: EDENA_TEMPLE, words: EDENA_WORDS },
  bazaar: { def: BAZAAR_TEMPLE, words: BAZAAR_WORDS },
};

/**
 * The gifts, world by world: `temple` is the gadget inside the world's temple (the key to its
 * later rooms and its guardian), `world` the gifts left in the open. `built: false` marks a
 * temple still to come: until it is built, its gadget waits in the world as before (`now`).
 * tests/temples.test.js checks the split, and that it matches PLACEMENTS.
 */
export const GADGETS = {
  desert: { temple: 'fire', world: ['backpack', 'star'], built: true },
  incal: { temple: 'jetpack', world: ['soles'], built: true },
  // planned (LORE.md, "Temples"): until a temple is built its world keeps its box as it was
  arzach: { temple: 'glider', world: ['hush'], built: true },         // the wings moved here from Vael II's stack; the hush-cloth on Vael's spire
  arzach2: { temple: 'bell', world: ['scarf'], built: true },         // the bell moved here from Vael's spire; the wind-silk scarf on the balanced stack (the wings went to the Aerie)
  garage: { temple: 'coil', world: ['level'], built: true },          // the quick coil moved inside from the keep's wall; the brass level is there now
  buried: { temple: 'cell', world: ['resin'], built: true },          // the fourth chamber moved here from Lorn II
  edena: { temple: 'bloom', world: ['pouch'], built: true },          // a new gun mode, found in the Greenhouse; the seed pouch is on the canopy (the lantern went to Lorn II)
  spheres: { temple: 'lens', world: ['shell'], built: true },
  perdide: { temple: 'stun', world: ['reed'], built: true },          // the stilling mode moved inside from the mossy rise; the breathing reed is there now
  perdide2: { temple: 'lantern', world: ['moss'], built: true },      // the lantern moved here from Viridel; the glow-moss pin on the root arch
  bazaar: { temple: 'echo', world: [], built: true },                // a new tool, found in the Undertower; the market has no chest in the open
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
  // A level with a list of its own, in another shape (the Hangar's gravity portals, { pos, to, toUp, toFwd },
  // which the level's own update walks to send you through): the temple's doorways join a copy of it, in that
  // shape, so whatever reads the list (the scout, the flora, the reactive world, the wildlife) reads them alike,
  // and the level's own list (level.garage.portals, its update's) is left as it was.
  if (level.navigationPortals && level.navigationPortals !== level.portals) level.navigationPortals = [...rt.portals.map(navigationPortal), ...level.navigationPortals];
  // the ground round the building is kept clear: no tree, rock or tuft of the world's own grows through it
  const keep = rt.outside?.clear ?? [];
  if (keep.length) {
    clearInstances(scene, keep, rt.root);
    const avoid = level.floraAvoid;
    level.floraAvoid = (x, z, r = 0) => keep.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r) || !!avoid?.(x, z, r);
  }
  const init = level.init, dynamic = level.dynamic, update = level.update;
  level.init = (physics) => { init?.call(level, physics); rt.init(physics); };
  level.dynamic = () => { const base = dynamic ? dynamic.call(level) : []; return base.length ? [...base, ...rt.solids()] : rt.solids(); };
  level.update = function (dt, t, o = {}) {
    update?.call(level, dt, t, o);
    if (o.fade) rt.fadeFn ??= o.fade;
    rt.change?.late?.(dt, t);   // (after the level's own movers: a change may move what they move)
  };
  return level;
}

/** A temple doorway in the shape of a level's own navigation portals (pos, toUp, toFwd: src/levels/garage.js). */
export function navigationPortal(p) {
  return { ...p, pos: p.at.clone(), toUp: p.toUp?.clone() ?? new THREE.Vector3(0, 1, 0), toFwd: new THREE.Vector3(Math.sin(p.heading ?? 0), 0, Math.cos(p.heading ?? 0)) };
}

/**
 * Walk-through instanced things a world scatters (trees, rocks, tufts: InstancedMesh, noCollide or not) whose
 * instances stand inside one of the circles [{ x, z, r }] are scaled to nothing (the temple stands there now).
 * Returns how many.
 */
export function clearInstances(scene, circles, except = null) {
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), w = new THREE.Matrix4();
  let n = 0;
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isInstancedMesh || o.userData.dynamic) return;
    for (let q = o; q; q = q.parent) if (q === except) return;
    let changed = false;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      w.multiplyMatrices(o.matrixWorld, m);
      p.setFromMatrixPosition(w);
      if (!circles.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < c.r)) continue;
      const e = m.elements;   // (scaled to nothing where it stood: its bounds stay where they were)
      e[0] = e[1] = e[2] = e[4] = e[5] = e[6] = e[8] = e[9] = e[10] = 0;
      o.setMatrixAt(i, m);
      changed = true; n++;
    }
    if (changed) o.instanceMatrix.needsUpdate = true;
  });
  return n;
}

/** The story side: the temple's quest, its people, the locators; returns { update } or null. */
export function setupTempleStory(ctx) {
  const { level, levelId, quests, spawn, player, sound, toast, game = sharedGame, physics, isNight = null } = ctx;
  const rt = level?.temple;
  const T = TEMPLES[levelId];
  if (!rt || !T) return null;
  rt.connect({ player, sound, toast, quests, fade: rt.fadeFn, isNight });
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
  // elsewhere the local stands by the building's door, a little to the side, looking out the way it does
  const local = T.def.local, person = local && P[local.person];
  if (person && spawn && rt.outside) {
    const D = rt.outside.door, f = new THREE.Vector3(Math.sin(D.heading), 0, Math.cos(D.heading)), side = new THREE.Vector3(f.z, 0, -f.x);
    const at = D.at.clone().addScaledVector(f, local.out ?? 7).addScaledVector(side, local.side ?? 6);
    const g = (p) => { const y = physics?.groundAt?.(p.x, p.y + 3, p.z, 8); return new THREE.Vector3(p.x, Number.isFinite(y) ? y : p.y, p.z); };
    const n = spawn(person, { route: [g(at), g(at.clone().addScaledVector(side, 2.5))], speed: 0.4 });
    people.push(n);
    quests?.locate?.(local.person, () => n.pos);
  }
  // a temple whose gadget this world needs to get about (the City-Shaft's jets): its quest starts on arrival
  if (T.def.startsOnArrival?.() && quests && !quests.isStarted?.(Q.id)) {
    quests.start(Q.id);
    // (the world's own story stays the tracked one: the temple waits in the sketchbook, and says so)
    const main = quests.active?.().find((q) => q.main && q.id !== Q.id);
    if (main) quests.track(main.id);
    setTimeout(() => toast?.(T.def.arrivalLine), 9000)?.unref?.();
  }
  // after: the locals' balloons say what changed
  const after = () => { if (W.LINES_AFTER?.length) for (const n of people) { n.lines = [...W.LINES_AFTER]; n.lineIdx = 0; } };
  if (game.flag(`temple.${id}.done`)) after();
  const offAfter = game.on(`flag:temple.${id}.done`, (v) => { if (v) after(); });
  return {
    rt, people, dispose: offAfter,
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
