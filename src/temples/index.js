import { attachTempleDefinition, TEMPLE_HOME, templeWorld, nextSpot } from './attachment.js';
export { TEMPLE_HOME, templeWorld, addTemple, templeOf, navigationPortal, clearInstances, nextSpot } from './attachment.js';
import { helperThreshold } from './helper-threshold.js';
import { consumeHelperReturn, HELPER_ENCOUNTERS } from './helper-encounter.js';
import { helperInvitation, helperWorldLease } from './helper-cinematics.js';
import * as THREE from 'three';
import { game as sharedGame } from '../game-state.js';
import { playFinale } from './finale.js';
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
import { SPACECITY_TEMPLE } from './spacecity.js';
import * as SPACECITY_WORDS from './spacecity-data.js';
import { MOONFOUNDRY_TEMPLE } from './moonfoundry.js';
import * as MOONFOUNDRY_WORDS from './moonfoundry-data.js';
import { UNDERWATER_TEMPLE } from './underwater.js';
import * as UNDERWATER_WORDS from './underwater-data.js';
import { templeNeeds } from '../story/quest-needs.js';

// The makers' temples: one great building in each world, a Zelda-style
// dungeon of rooms and puzzles in that world's architecture, with a gadget
// found half-way that is the key to the rest, and a guardian at the end
// (calmed if it lives, stopped if it is a machine), whose resolution changes
// the world outside. LORE.md, "Temples", has the design; docs/systems/temples.md
// the system.
//
// Two hooks bring them into the game:
//   attachTemple(id, scene, level)        at level build (each world's builder): builds the temple `id` and
//                                         joins it to the level (portals, lights, init, dynamic, update);
//                                         level.temples lists the runtimes, level.temple is the one you are
//                                         in (or the world's own: a merged world has two, Vael's Aerie and the
//                                         sky stones' Founders' Belfry: src/levels/names.js PARTS)
//   setupTempleStory(ctx)                 in the story runtime (src/story/index.js): the temple's quest,
//                                         its local, the locators for the marker and the scout, and the
//                                         per-frame update
//
// TEMPLES: by temple id (the world it was built for), each { def (the temple: layout, logic, guardian, exterior,
// change), words }. TEMPLE_HOME: where a temple stands now when its own world is gone (the First Garage, the
// Sealed Hangar's, in the Glass Dunes); templesIn(world): the temples a world builds.
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
  spacecity: { def: SPACECITY_TEMPLE, words: SPACECITY_WORDS },
  moonfoundry: { def: MOONFOUNDRY_TEMPLE, words: MOONFOUNDRY_WORDS },
  underwater: { def: UNDERWATER_TEMPLE, words: UNDERWATER_WORDS },
};

/** The temples a world builds (its parts' and those moved to it). */
export const templesIn = (world) => Object.keys(TEMPLES).filter((id) => templeWorld(id) === world);

/**
 * The gifts, world by world: `temple` is the gadget inside the world's temple (the key to its
 * later rooms and its guardian), `world` the gifts left in the open (charms and upgrades, never a gadget: issue #375,
 * docs/design/gadget-temples.md). `built: false` marks a
 * temple still to come: until it is built, its gadget waits in the world as before (`now`).
 * tests/temples.test.js checks the split, and that it matches PLACEMENTS.
 */
export const GADGETS = {
  desert: { temple: 'sword', world: ['backpack', 'star'], built: true },   // (blade, guard and gun now share the Rose House; the backpack and lift valve remain Qanat's first lessons)
  incal: { temple: 'fan', world: ['soles'], built: true },             // the gust fan (issue #377; the Warden's bellows from v1.42, the Warden's harness, the City-Shaft's own jets, before them); the soft-fall soles behind its makers' court's gate (v1.86, issue #518: on the rim pillar before)
  // planned (LORE.md, "Temples"): until a temple is built its world keeps its box as it was
  arzach: { temple: 'glider', world: ['hush', 'bell'], built: true }, // the wings moved here from Vael II's stack; the hush-cloth on Vael's spire; the bell-note whistle in its makers' court (issue #375: the hook's box, the hook earned in the Belfry)
  arzach2: { temple: 'hook', world: ['scarf'], built: true },         // the grappling hook (issue #377: the bell-note whistle until then, a charm, now in Vael's court); the wind-silk scarf behind the sky stones' court's gate (v1.86, issue #518: on the balanced stack before)
  garage: { temple: 'boomerang', world: ['level'], built: true },     // the Clock-House (the Sealed Hangar's First Garage, in the Glass Dunes now: TEMPLE_HOME): the boomerang inside (issue #377: the quick coil until then); the brass level behind the court's gate north of it (v1.86, issue #518: on a glass mound before)
  buried: { temple: 'bomb', world: ['resin', 'lens'], built: true },          // ink bombs (issue #377: the fourth chamber until then, now in the Garden of Spheres' court)
  edena: { temple: 'bloom', world: ['lantern'], built: true }, // a new gun mode, found in the Greenhouse; the lantern charm back in its makers' court (issue #375: the bubble wand's box)
  spheres: { temple: 'monocle', world: ['shell', 'cell'], built: true },   // the seeing lens (issue #377: the glyph lens until then, now in the Buried Machine's court); the fourth chamber in its makers' court, the bombs' old box (issue #375)
  perdide: { temple: 'stun', world: ['reed', 'wardenbellows'], built: true }, // the stilling mode moved inside from the mossy rise; the breathing reed is there now; the Warden's bellows in its makers' court (issue #375: the fan's box)
  perdide2: { temple: 'bubble', world: ['moss', 'coil'], built: true }, // the bubble wand (issue #377: the lantern charm until then, now in Viridel's court); the glow-moss pin on the root arch
  bazaar: { temple: 'recall', world: ['sandglass'], built: true },   // the recall hourglass (issue #377: the echo shell until then, folded into it); the pinch of slow sand behind its makers' court's gate (v1.86, issue #518)
  spacecity: { temple: 'tether', world: ['starthread'], built: true }, // the Mooring-House: tether mode inside; the star-thread on a roof in the Towers
  moonfoundry: { temple: 'magnet', world: ['bellows'], built: true }, // the Casting-House: the magnet glove inside (issue #377: the founders' tongs until then, folded into the glove); the pocket bellows on top of the cradled moon
  underwater: { temple: 'springs', world: ['pearl'], built: true },   // the Whale-House: the spring boots inside (issue #377: the whale-horn until then, folded into the boots' stomp); the diver's pearl on the top deck of the Avenue's tower of pods
};

/** Compatibility entry point for callers intentionally using the full registry. */
export function attachTemple(id, scene, level, options) {
  return attachTempleDefinition(id, TEMPLES[id], scene, level, options);
}

/**
 * The story side of every temple in the level (a merged world has two): returns { update, dispose, people, rt, all }
 * (rt: the first's runtime) or null.
 */
export function setupTempleStory(ctx) {
  const lease = helperWorldLease(ctx.game ?? sharedGame);
  const helperCtx = { ...ctx, helperLive: lease.live };
  // (the world's own temple first: its quest, its local, rt below)
  const list = [...(ctx.level?.temples ?? (ctx.level?.temple ? [ctx.level.temple] : []))].sort((a, b) => (b.id === ctx.levelId) - (a.id === ctx.levelId));
  const all = list.map((rt) => setupOneTemple(helperCtx, rt)).filter(Boolean);
  if (!all.length) return null;
  if (all.length === 1) return { ...all[0], all, dispose() { lease.dispose(); all[0].dispose?.(); } };
  return {
    rt: all[0].rt, people: all.flatMap((t) => t.people), all,
    dispose() { lease.dispose(); for (const t of all) t.dispose?.(); },
    update(dt, t) { for (const one of all) one.update(dt, t); },
  };
}

/** The story side of one temple: its quest, its people, the locators; returns { update } or null. */
function setupOneTemple(ctx, rt) {
  const { level, quests, spawn, player, sound, toast, game = sharedGame, physics, isNight = null, moments = null } = ctx;
  const T = rt && TEMPLES[rt.id];
  if (!rt || !T) return null;
  const levelId = rt.id;   // (the temple's own world: the desert's Sabri waits at the qanat's camps)
  rt.connect({ player, sound, toast, quests, fade: rt.fadeFn, isNight });
  // its ending, filmed as the guardian is resolved (src/temples/finale.js, issue #366), the world's theme under it
  rt.onFinale = () => playFinale(rt, { moments, sound, game });
  // The entrance owns the opening; only the game's goal receipt can
  // resolve the temple on return. Disposing either story or room cancels launch.
  let invitation = null, threshold = null;
  if (HELPER_ENCOUNTERS[rt.id] && rt.guardian?.def.helper) {
    invitation = helperInvitation(rt, { game, player, moments, from: ctx.levelId,
      playGame: ctx.playGame, liveWorld: ctx.helperLive });
    threshold = helperThreshold(rt, { game, player, invitation, moments, live: ctx.helperLive });
    rt.startHelper = threshold.continueLegacy;
    rt.canStartHelper = threshold.legacyAvailable;
    rt.offs.push(invitation.dispose, threshold.dispose);
  }
  const W = T.words, id = rt.id, Q = W.QUEST;
  // the quest: find the house, find what is inside, go down to its heart
  quests?.define?.({
    id: Q.id, title: Q.title, world: Q.world ?? levelId, outro: Q.outro, ...(Q.main ? { main: true } : {}),
    // (what its rooms want from outside, the Rose House's double jump: its local gives it once that is had, issue #328)
    needs: templeNeeds(T.def.logic, templeWorld(id)),
    stages: [
      { id: 'find', text: Q.find, label: T.def.name, flag: `temple.${id}.entered`, at: `temple.${id}.door` },
      { id: 'gadget', text: Q.gadget, label: 'Inside the house', when: () => rt.logic.gadget, at: `temple.${id}.next` },
      // (a gadget whose first use is not plain to see, the City-Shaft's jets: a step that says what to do with it,
      // done once it has been used to go on: T.def.used)
      ...(Q.use ? [{ id: 'use', text: Q.use.text, label: Q.use.label, when: () => !!T.def.used?.(rt) || rt.logic.resolved, at: `temple.${id}.next` }] : []),
      { id: 'keeper', text: Q.keeper, label: 'The heart of the house', flag: `temple.${id}.done`, at: `temple.${id}.next` },
    ],
  });
  quests?.locate?.(`temple.${id}.door`, () => rt.outside?.door.at ?? rt.arrival.pos);
  quests?.locate?.(`temple.${id}.next`, () => nextSpot(rt));
  // you found the door yourself: the quest starts as you go in (and, in a save from before the givers, as you come near)
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
  // the local gives the temple's quest (issue #273): it waits for their talk, and they are the world's lead giver, the
  // one the ship marks on the map on arrival (src/story/quests.js givenBy); going in starts it all the same. A save that
  // had been here before the givers (src/save-migrate.js step 26, `givers.old.<temple>`) keeps the old ways: the quest
  // starts on arrival where the world needs its gadget, and as you come near the door.
  const giver = levelId === 'desert' && P.sabri ? (people.length ? 'sabri' : null) : person && rt.outside && spawn ? local.person : null;
  const giverName = giver ? (P[giver]?.name ?? giver) : null;
  if (giver) quests?.givenBy?.(Q.id, giver, { rank: 0, label: levelId === 'desert' ? `${giverName}, at Qanat’s camps` : `${giverName}, by ${String(T.def.name ?? 'the makers’ house').replace(/^The /, 'the ')}` });
  const legacy = !giver || !quests?.givenBy || !!game.flag(`givers.old.${id}`);
  // a temple whose gadget this world needs to get about (the City-Shaft's jets): its quest started on arrival (old saves)
  if (legacy && T.def.startsOnArrival?.() && quests && !quests.isStarted?.(Q.id)) {
    quests.start(Q.id);
    // (the world's own story stays the tracked one: the temple waits in the sketchbook, and says so; and
    // while the world's own quest waits for its first conversation, the scout finds who to talk to)
    const qd = quests.def?.(Q.id);
    if (qd) qd.arrival = true;
    const main = quests.active?.().find((q) => q.main && q.id !== Q.id);
    if (main) quests.track(main.id);
    setTimeout(() => toast?.(T.def.arrivalLine), 9000)?.unref?.();
  }
  // after: the locals' balloons say what changed
  const after = () => { if (W.LINES_AFTER?.length) for (const n of people) { n.lines = [...W.LINES_AFTER]; n.lineIdx = 0; } };
  if (game.flag(`temple.${id}.done`)) after();
  const offAfter = game.on(`flag:temple.${id}.done`, (v) => { if (v) after(); });
  let byTheWay = false;   // its quest started as you passed by (not by arrival, not inside)
  return {
    rt, people, dispose() { threshold?.dispose(); invitation?.dispose(); offAfter(); },
    update(dt, t) {
      if (!quests?.isStarted?.(Q.id) && ((legacy && near()) || game.flag(`temple.${id}.entered`))) {
        quests.start(Q.id);
        // only passing by (the ship lands near Vael's Aerie): it started on its own, so while the world's own
        // quest waits for its first conversation the scout still finds who to talk to (quests.objective)
        const qd = quests.def?.(Q.id);
        if (qd && !game.flag(`temple.${id}.entered`)) { qd.arrival = true; byTheWay = true; }
      }
      // inside it, the temple is what you are doing
      if (byTheWay && game.flag(`temple.${id}.entered`)) { const qd = quests.def?.(Q.id); if (qd) qd.arrival = false; byTheWay = false; }
      if (rt.guardian?.def.helper) consumeHelperReturn(game, rt.id, ctx.levelId, {
        restore: p => player?.teleport(new THREE.Vector3(...p.pos), new THREE.Vector3(...p.up), new THREE.Vector3(...p.fwd)),
        resolve: () => { if (rt.guardian.state === 'resolved') rt.onBossResolved(); else rt.guardian.resolve(); },
      });
      rt.update(dt, t);
      threshold?.update();
    },
  };
}
