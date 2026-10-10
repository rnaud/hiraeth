// The worlds list's debug save (Debug on the title and in the Start menu, src/world-picker.js).
// A world on the route picked there opens in a save of its own, as if every world before it on
// the route (ORDER, src/levels/names.js) had been played through, and the world itself not yet:
//
//   progressBefore('glassdunes')   → { flags, keepsakes, journal } (pure; null off the route)
//   seedDebugSave('glassdunes')    → writes it into the debug slot and makes that slot the active one
//
// A merged world (src/levels/names.js PARTS: Vael with the sky stones, Lorn with the Deep Wood) is played through
// part by part, each with its own story data, temple, boxes and `world.<part>.done`; the world's page is its first
// part's. A temple is counted by its own id (the Glass Dunes' Clock-House is `temple.garage`).
//
// It is built from the game's own data, world by world, so it follows the content as it changes:
//  - every quest of the world's story (QUESTS in src/story/<world>-data.js): done (failed, for the one a
//    conversation fails: Viridel's terraces), and the flags its stages wait for set (the stage's `flag` and `value`);
//  - what its conversations do (the same data, every `do` reached anywhere in it): the flags they set
//    (the first value written, for the few that differ by answer), the gear they give (an item of
//    src/items.js: the cab pass), the keepsakes;
//  - its people met (peopleOf, src/story/ending.js, and the temple's local);
//  - its temple (src/temples/<world>-data.js): entered, its guardian resolved, its quest done;
//  - its boxes (PLACEMENTS, src/boxes/placements.js): opened, their items owned, the boxes' own quests done;
//  - the tank's colour bands its magical water adds (TANK_BANDS), the end of its main quest (WORLD_ENDS:
//    the flags and the keepsake set in code, src/story/<world>.js), `world.<id>.done`, its story page;
//  - the ship after it: the light's signature read on arrival (src/story/signature.js), the recordings
//    waiting at the console played in turn (src/story/calls.js, what they set too), and the errands
//    carried on (ERRANDS, src/levels/content.js: delivered when their world is before this one, still
//    carried when it is this one or later).
// tests/debug-save.test.js reads the story code for the grants that are not data (an onDone's game.set,
// addKeepsake, a tank band, an item granted) and fails when one is not covered here.
//
// Left out: relics and the sketchbook's pictures (drawn as you find them), conversations' once-only
// answers (`said.*`). Off the route (the dev worlds, the side worlds, home) nothing changes: the
// list opens them in the save being played.

import { ORDER, TITLES, partsOf } from './levels/names.js';
import * as glassdunes from './story/glassdunes-people.js';
import * as underwater from './story/underwater-people.js';
import * as moonfoundry from './story/moonfoundry-people.js';
import * as spacecity from './story/spacecity-people.js';
import { PLACEMENTS } from './boxes/placements.js';
import { ITEMS } from './items.js';
import { MIGRATED } from './save-migrate.js';
import { peopleOf } from './story/ending.js';
import { GIVEN, CARD } from './story/charge.js';
import { pendingCall, callLines, callContext, applyCall } from './story/calls.js';
import { arrivalLine } from './story/signature.js';
import { ERRANDS } from './levels/content.js';
import { slots, DEBUG_SLOT } from './save-slots.js';
import * as desert from './story/desert-data.js';
import * as arzach from './story/arzach-data.js';
import * as arzach2 from './story/arzach2-data.js';
import * as perdide from './story/perdide-data.js';
import * as perdide2 from './story/perdide2-data.js';
import * as edena from './story/edena-data.js';
import * as incal from './story/incal-data.js';
import * as garage from './levels/dismissed/hangar/story-data.js';
import * as buried from './story/buried-data.js';
import * as spheres from './story/spheres-data.js';
import * as bazaar from './story/bazaar-data.js';
import * as tDesert from './temples/desert-data.js';
import * as tArzach from './temples/arzach-data.js';
import * as tArzach2 from './temples/arzach2-data.js';
import * as tPerdide from './temples/perdide-data.js';
import * as tPerdide2 from './temples/perdide2-data.js';
import * as tEdena from './temples/edena-data.js';
import * as tIncal from './temples/incal-data.js';
import * as tGarage from './temples/garage-data.js';
import * as tBuried from './temples/buried-data.js';
import * as tSpheres from './temples/spheres-data.js';
import * as tBazaar from './temples/bazaar-data.js';
import * as tUnderwater from './temples/underwater-data.js';
import * as tMoonfoundry from './temples/moonfoundry-data.js';
import * as tSpacecity from './temples/spacecity-data.js';

/** The URL parameter the worlds list adds (?level=<id>&debugsave=1): src/boot.js seeds the save, then drops it. */
export const DEBUG_PARAM = 'debugsave';

/** Each route world's story data and its temple's words. */
// (by part: the merged worlds' parts each have theirs; the Glass Dunes' story is its temple, the Clock-House, and
// its people; the Sealed Hangar's, dismissed, is kept for the tests that read every world's data)
export const WORLDS = {
  desert: [desert, tDesert], arzach: [arzach, tArzach], arzach2: [arzach2, tArzach2], perdide: [perdide, tPerdide],
  perdide2: [perdide2, tPerdide2], edena: [edena, tEdena], incal: [incal, tIncal], glassdunes: [glassdunes, tGarage],
  garage: [garage, {}], buried: [buried, tBuried], spheres: [spheres, tSpheres], bazaar: [bazaar, tBazaar],
  // (the three worlds that joined the route in v1.40: their people's files and their temples' words)
  underwater: [underwater, tUnderwater], moonfoundry: [moonfoundry, tMoonfoundry], spacecity: [spacecity, tSpacecity],
};

/** What the end of a world's main quest sets in code (its onDone in src/story/<world>.js), beyond world.<id>.done and its keepsake. */
export const WORLD_ENDS = {
  desert: { 'ship.powered': true },
  arzach: { 'bird.promise': true },
};

/** The magical waters that add a colour band to the tank for good (game.emit('tool:refill', { addColour })), in route order. */
export const TANK_BANDS = [
  { world: 'desert', flag: 'desert.pool.tinted', tone: null },          // the cave's pool (src/story/desert.js fillTank)
  { world: 'perdide', flag: 'perdide.tank.tinted', tone: perdide.CRYSTAL_TONE },   // the Great Crystal's heart rung
  { world: 'buried', flag: 'buried.tank.amber', tone: buried.AMBER },  // standing in the Wick's light
  { world: 'bazaar', flag: bazaar.LANTERN_FLAG, tone: bazaar.LANTERN_TONE },   // Oyo's last lantern
];
const MAX_COLOURS = 5;   // (src/fluid-tool.js FLUID.maxColours)

/** The worlds the debug save treats as played through before `levelId`, or null when it is not on the route. */
export function worldsBefore(levelId, order = ORDER) {
  const i = order.indexOf(levelId);
  return i < 0 ? null : order.slice(0, i);
}

/** Every effect a conversation can run, anywhere in a world's data ({ set }, { give }, { keepsake }…), in the order written. */
export function dialogueEffects(data) {
  const out = [], seen = new Set();
  const walk = (o) => {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    if (Array.isArray(o)) { for (const x of o) walk(x); return; }
    if (o.do) for (const e of [].concat(o.do)) if (e && typeof e === 'object') out.push(e);
    for (const v of Object.values(o)) walk(v);
  };
  walk(data);
  return out;
}

/** The keepsake the end of a world's main quest gives (KEEPSAKE in its data, or keepsakeFor(the promise)). */
const endKeepsake = (data, flags) => data.KEEPSAKE ?? data.keepsakeFor?.(flags['perdide2.promise']) ?? null;

/**
 * The save of someone who has played every route world before `levelId` through, and has just
 * flown to it: { flags, keepsakes, journal } (the game state's and the sketchbook's), or null
 * when `levelId` is not on the route. Pure.
 */
export function progressBefore(levelId, { order = ORDER, now = Date.now() } = {}) {
  const before = worldsBefore(levelId, order);
  if (!before) return null;
  const flags = { 'prologue.done': true, 'items.v': 2, 'save.migrated': MIGRATED(), [GIVEN]: true, [CARD]: true, 'ship.level': 'desert' };
  const keepsakes = [];
  const journal = { relics: {}, stories: {}, seen: {}, errands: {} };
  let t = now - 1000 * 60 * (before.length + 1);
  const keep = (k) => { if (k && !keepsakes.some((o) => o.id === k.id)) keepsakes.push({ ...k, t: t++ }); };
  const state = { flag: (k) => flags[k], set: (k, v) => { flags[k] = v; }, keepsakes: () => keepsakes };
  before.forEach((w, n) => {
    if (n > 0) {
      // flown here from the last: the map's first line, the ship's word on arrival
      flags['ship.launched'] = true;
      flags['signature.told'] = true;
      for (const [k, v] of Object.entries(arrivalLine(w, state.flag)?.set ?? {})) flags[k] = v;
    }
    flags['ship.level'] = w;
    // the people met (every part's: peopleOf reads them)
    for (const p of peopleOf(w)) flags[`met.${p.id}`] = true;
    for (const part of partsOf(w)) playPart(part);
    journal.stories[w] = { img: null, t: t++ };
    journal.seen[w] = 1;
    // back at the ship: the recordings waiting at the console, in turn (src/ship/ship.js useConsole)
    const done = before.slice(0, n + 1);
    for (let guard = 0; guard < 4; guard++) {
      const c = pendingCall({ flag: state.flag, completed: done.length });
      if (c == null) break;
      applyCall(state, callLines(c, callContext(state, { titles: TITLES, completed: done, lastWorld: w })));
      flags[`calls.${c}`] = true;
    }
  });
  /** One part of a world played through (a world that is not merged is its own only part). */
  function playPart(w) {
    const [data, temple] = WORLDS[w] ?? [{}, {}];
    for (const p of Object.values(temple.PEOPLE ?? {})) flags[`met.${p.id}`] = true;
    // what its conversations do (a flag keeps the first value written: the answers that differ, Hollin's promise, are 'yes')
    const written = new Set(), fails = new Set();
    for (const e of [...dialogueEffects(data), ...dialogueEffects(temple)]) {
      for (const [k, v] of Object.entries(e.set ?? {})) if (!written.has(k)) { written.add(k); flags[k] = v; }
      if (e.give && ITEMS[e.give]) flags[`item.${e.give}`] = true;
      if (e.keepsake) keep(e.keepsake);
      if (e.fail) fails.add(e.fail);
    }
    // its quests over, and what their stages wait for: done, or failed for one a conversation ends that way
    // (Viridel's tea terraces: the gate always gives way)
    for (const q of data.QUESTS ?? []) {
      for (const st of q.stages ?? []) if (st.flag) flags[st.flag] = st.value ?? true;
      flags[`quest.${q.id}`] = fails.has(q.id) ? 'failed' : 'done';
      if (fails.has(q.id)) flags[`failed.${q.id}`] = q.title;
    }
    // its temple: entered, the guardian resolved (by the temple's own id: the Clock-House's is garage)
    if (temple.QUEST) {
      const id = temple.QUEST.id.replace(/^temple\./, '');
      flags[`temple.${id}.entered`] = true;
      flags[`temple.${id}.done`] = true;
      flags[`quest.${temple.QUEST.id}`] = 'done';
    }
    // its boxes opened
    for (const p of PLACEMENTS[w] ?? []) {
      flags[`box.${p.id}`] = true;
      if (ITEMS[p.item]) flags[`item.${p.item}`] = true;
      if (p.hint) flags[`quest.box.${p.id}`] = 'done';
    }
    // the tank's colours (src/fluid-tool.js refill: the next band, its tone)
    for (const b of TANK_BANDS) {
      if (b.world !== w) continue;
      flags[b.flag] = true;
      const c = (flags['tool.colours'] ?? 1) + 1;
      if (c > MAX_COLOURS) continue;
      if (b.tone) { const tones = [...(flags['tool.tones'] ?? [])]; tones[c] = b.tone.toLowerCase(); flags['tool.tones'] = tones; }
      flags['tool.colours'] = c;
    }
    // the end of the main quest
    Object.assign(flags, WORLD_ENDS[w] ?? {});
    flags[`world.${w}.done`] = true;
    keep(endKeepsake(data, flags));
  }
  if (before.length) { flags['ship.launched'] = true; flags['signature.told'] = true; }
  flags['ship.level'] = levelId;
  // the errands, carried from world to world (src/quest.js Errands): delivered, or still in the pack
  for (const e of ERRANDS) {
    const from = order.indexOf(e.from[0]), to = order.indexOf(e.to[0]), at = before.length;
    if (from < 0 || from >= at) continue;
    journal.errands[e.id] = { item: e.item, to: e.to[0], toTitle: TITLES[e.to[0]] ?? e.to[0], done: to >= 0 && to < at };
  }
  return { flags, keepsakes, journal };
}

/** Is this world one the worlds list opens in the debug save? */
export const opensInDebugSave = (levelId, order = ORDER) => order.includes(levelId);

/**
 * Start the debug save for `levelId` (src/boot.js, before the game's modules read the save): the debug slot
 * is cleared and written with progressBefore(levelId), and becomes the active slot for this page and the
 * pages after it (the ship's flights), until a save is chosen on the title. The player's own slots are
 * never written. `state` (the shared game state, if already loaded) reads the new save. Returns the progress, or null.
 */
export function seedDebugSave(levelId, { store = slots, state = null, now = Date.now() } = {}) {
  const p = progressBefore(levelId, { now });
  if (!p) return null;
  store.remove(DEBUG_SLOT);
  store.setActive(DEBUG_SLOT);
  const view = store.view(DEBUG_SLOT);
  view.setItem('moebius.game.v1', JSON.stringify({ flags: p.flags, keepsakes: p.keepsakes }));
  view.setItem('moebius.journal.v1', JSON.stringify(p.journal));
  store.touch(DEBUG_SLOT, { now });
  state?.reload?.();
  return p;
}
