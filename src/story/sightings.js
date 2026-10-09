// Sightings: the open threads the traveller wonders about, written down as he meets them (the
// game menu's Sketchbook, its Sightings page; after Outer Wilds' ship log). Every trace of the
// singing light, of the makers' sign (three dots over an arc) and of the father's signal, as a
// short line with the world and who said it; the ones not met yet are "?" slots.
//
//   SIGHTINGS        [{ id, thread, world, who, line, heard?, flag? }]   (the route's; the detours' are in sightings-detours.js)
//   seen(id, game)   has the traveller met it (its save flag sight.<id>, or the flag it is keyed on)
//   recordSightings(game, { toast })   once per story runtime (src/story/index.js): writes each one down as it is met
//   sightingsData({ game, known, titles })   → the Sightings page's threads (src/game-menu-data.js)
//
// How one is met:
//  - heard: { who, node, has? }  a conversation reaches that person's node (Dialogue emits 'dialogue:node';
//                                a listen-only person's node is 'listen', `has` a few words of the entry said);
//  - flag: 'name'                a flag the story already sets (a clue, a quest's end);
//  - by its own flag, sight.<id>, set by a line's effect ({ do: { set: { 'sight.<id>': true } } }): the detours.
// Each is saved as the flag sight.<id> (in the save, like every flag), so it stays met.

import { DETOUR_SIGHTINGS } from './sightings-detours.js';
import { isWip } from '../levels/names.js';

export const THREADS = [
  { id: 'light', name: 'The singing light', ask: 'What struck the ship, and why did it turn?' },
  { id: 'glyph', name: 'The makers’ sign', ask: 'Three dots over an arc, burned into the hull. Who signs their work like that?' },
  { id: 'signal', name: 'The father’s signal', ask: 'A voice sent out a long time ago. Who was it meant for?' },
  { id: 'before', name: 'Someone came this way before', ask: 'Who else came this far alone?' },
];

const ROUTE = [
  // ---------------------------------------------------------------- the singing light
  { id: 'desert.oum', thread: 'light', world: 'desert', who: 'Oum', line: 'A light crossed the dunes singing one long note. It turned over Qanat, and the tree went dark.', heard: { who: 'oum', node: 'light' } },
  { id: 'desert.dalia', thread: 'light', world: 'desert', who: 'Dalia', line: 'The stones hummed under a clear sky. Something low, then rising, like a question.', heard: { who: 'tamsin', node: 'listen', has: 'night before your crash' } },
  { id: 'desert.nour', thread: 'light', world: 'desert', who: 'Nour', line: 'The Givers’ chest answered the light all night.', heard: { who: 'nour', node: 'dark' } },
  { id: 'arzach.senn', thread: 'light', world: 'arzach', who: 'Senn', line: 'The light sang. The stones answered. The bird cried.', heard: { who: 'senn', node: 'light' } },
  { id: 'arzach2.calix', thread: 'light', world: 'arzach2', who: 'Calix', line: 'The night it passed, the silent bell hummed by itself.', heard: { who: 'calix', node: 'mark' } },
  { id: 'perdide.sedge', thread: 'light', world: 'perdide', who: 'Sedge', line: 'Low over the reeds, one high note. The Great Crystal answered without any rain.', heard: { who: 'sedge', node: 'light' } },
  { id: 'perdide.saba', thread: 'light', world: 'perdide', who: 'Saba', line: 'The crystal is a piece of it, fallen long ago. The rest is still out there, singing.', heard: { who: 'saba', node: 'heard' } },
  { id: 'perdide.phrase', thread: 'light', world: 'perdide', who: 'the Great Crystal', line: 'In the rain it sang a phrase it had never sung before: the one you heard the night the ship was struck.', flag: 'perdide.crystal.sung' },
  { id: 'perdide2.robin', thread: 'light', world: 'perdide2', who: 'Robin', line: 'It came low over the wood. Three pools went out as it passed: one, two, three.', heard: { who: 'wick', node: 'night' } },
  { id: 'perdide2.saucer', thread: 'light', world: 'perdide2', who: 'Odile and Talo’s saucer', line: 'Struck a second time, over the deep wood. Its lamp still blinks three short and one long.', heard: { who: 'saucer', node: 'look' } },
  { id: 'edena.mira', thread: 'light', world: 'edena', who: 'Mira', line: 'Talo called it the Singer: it sang, turned, then struck their ship.', heard: { who: 'mira', node: 'same' } },
  { id: 'edena.odile', thread: 'light', world: 'edena', who: 'Odile’s log', line: '“A light off the port bow, keeping pace. I think it’s beautiful.” Then it turned toward them.', heard: { who: 'log', node: 'odile' } },
  { id: 'edena.sol', thread: 'light', world: 'edena', who: 'Sol', line: 'Every flower in the garden turned to follow it, in the dark.', heard: { who: 'sol', node: 'strange' } },
  { id: 'incal.nima', thread: 'light', world: 'incal', who: 'Nima', line: 'It flew low across the shaft. The Lodestar answered, and a splinter fell, singing.', heard: { who: 'nima', node: 'rang' } },
  { id: 'incal.dov', thread: 'light', world: 'incal', who: 'Dov', line: 'When it turned over the palace, he saw the mark on it.', heard: { who: 'dov', node: 'night' } },
  { id: 'incal.wren', thread: 'light', world: 'incal', who: 'Wren', line: 'Slow, then a sharp turn. A cab’s compass spun for an hour.', heard: { who: 'wren', node: 'light' } },
  { id: 'garage.lune', thread: 'light', world: 'garage', who: 'Lune', line: 'It crossed the ring’s slit, low and slow, and the metal sang back. Then it turned, deliberately.', heard: { who: 'lune', node: 'light' } },
  { id: 'buried.hask', thread: 'light', world: 'buried', who: 'Hask', line: 'A Tuning Star, singing the wheel’s note. Nobody knows what they come to tune.', heard: { who: 'hask.buried', node: 'why' } },
  { id: 'spheres.ume', thread: 'light', world: 'spheres', who: 'Ume', line: 'An Answerer, matching the pole’s note. It turned directly over the plaza.', heard: { who: 'ume', node: 'strange' } },
  { id: 'bazaar.ferro', thread: 'light', world: 'bazaar', who: 'Ferro', line: 'It turned as though it were reading the signs. The antenna’s bulbs lit by themselves.', heard: { who: 'ferro', node: 'light' } },
  // ---------------------------------------------------------------- the makers' sign
  { id: 'desert.hull', thread: 'glyph', world: 'desert', who: 'Marrow', line: 'Burned into your ship’s hull where it was struck, and still warm.', heard: { who: 'marrow', node: 'wreck' } },
  { id: 'desert.givers', thread: 'glyph', world: 'desert', who: 'Nour', line: 'The Givers’ mark: on the giants, the carved stones, the chests. The same signature.', heard: { who: 'nour', node: 'givers' } },
  { id: 'arzach.track', thread: 'glyph', world: 'arzach', who: 'Oïa', line: 'Drawn in the sand without a word: the bird’s track.', heard: { who: 'oia', node: 'track' } },
  { id: 'arzach2.face', thread: 'glyph', world: 'arzach2', who: 'the tower on the plain', line: 'On the brow of a sleeping face, the same as the desert’s masked head.', heard: { who: 'face', node: 'look' } },
  { id: 'perdide.hush', thread: 'glyph', world: 'perdide', who: 'Wendel', line: 'The Hush: three raindrops over a shut mouth. Carved under the Great Crystal.', heard: { who: 'wendel', node: 'glyph' } },
  { id: 'perdide2.welcome', thread: 'glyph', world: 'perdide2', who: 'Hollin', line: 'The Welcome: three lamps over a hull. Someone here expects you.', heard: { who: 'hollin.perdide2', node: 'glyph' } },
  { id: 'edena.scar', thread: 'glyph', world: 'edena', who: 'Odile and Talo’s ship', line: 'Under the vines, scorched metal, and the same mark burned into it.', heard: { who: 'scar', node: 'look' } },
  { id: 'incal.three', thread: 'glyph', world: 'incal', who: 'Ossa', line: 'The Three Who Look Up, cut into the Lodestar’s underside where only the bottom can see.', heard: { who: 'ossa', node: 'glyph' } },
  { id: 'garage.thumb', thread: 'glyph', world: 'garage', who: 'Clemence', line: 'The Major found it scratched on a stone and copied it onto everything. For luck. Or for somebody.', heard: { who: 'clemence', node: 'listen', has: 'thumbprint' } },
  { id: 'buried.thumb', thread: 'glyph', world: 'buried', who: 'Wen', line: 'The Maker’s Thumb, on the buried pipes, painted on the doors.', heard: { who: 'wen', node: 'mark' } },
  { id: 'spheres.footprint', thread: 'glyph', world: 'spheres', who: 'Emrys', line: 'The Footprint, pressed under every sphere, where nobody looks.', heard: { who: 'ivo', node: 'listen', has: 'Footprint' } },
  { id: 'bazaar.heard', thread: 'glyph', world: 'bazaar', who: 'the oldest sign', line: 'Under the mark, four words: WE HEARD YOU.', heard: { who: 'oldSign', node: 'awake' } },
  // ---------------------------------------------------------------- the father's signal
  { id: 'ship.signature', thread: 'signal', world: 'desert', who: 'the ship', line: 'The scar is magnetised. Its field beats slowly, in threes.', flag: 'signature.told' },
  { id: 'garage.signal', thread: 'signal', world: 'garage', who: 'Lune', line: 'A signal passed round for years that nobody could read, read at last through the slit.', heard: { who: 'lune', node: 'signal' } },
  { id: 'bazaar.kip', thread: 'signal', world: 'bazaar', who: 'Kip', line: 'The unsent recording arrived singing, a man’s voice under the note, saying a name.', heard: { who: 'kip', node: 'recording' } },
  { id: 'bazaar.voice', thread: 'signal', world: 'bazaar', who: 'the broadcast', line: 'Your father’s voice, younger, sent a long time ago to someone called Ilen.', heard: { who: 'broadcast', node: 'play' } },
  { id: 'bazaar.sel', thread: 'signal', world: 'bazaar', who: 'Sel', line: 'Thirty years crossing the dark, looking for someone. It reached you instead.', heard: { who: 'sel', node: 'name' } },
  // ---------------------------------------------------------------- someone came this way before
  { id: 'perdide.two', thread: 'before', world: 'perdide', who: 'Saba', line: 'Two strangers came in a borrowed skiff, asking where the singing light had gone.', heard: { who: 'saba', node: 'two' } },
  { id: 'edena.lookout', thread: 'before', world: 'edena', who: 'Talo’s note', line: '“It turned once. It can turn again. If it does, I want to be looking.”', heard: { who: 'lookout', node: 'note' } },
];

export const SIGHTINGS = [...ROUTE, ...DETOUR_SIGHTINGS];
const BY_ID = new Map(SIGHTINGS.map((s) => [s.id, s]));
export const sightingFlag = (id) => `sight.${id}`;

/** Has the traveller met it? */
export function seen(id, game) {
  const s = BY_ID.get(id);
  return !!game?.flag?.(sightingFlag(id)) || (!!s?.flag && !!game?.flag?.(s.flag));
}

const said = (say) => [].concat(say ?? []).map((x) => (typeof x === 'string' ? x : x?.text ?? '')).join(' ');
/** The sightings a conversation's node is (person id, node id, what was said). */
export function sightingsOf({ id, node, say } = {}) {
  return SIGHTINGS.filter((s) => s.heard && s.heard.who === id && s.heard.node === node && (!s.heard.has || said(say).includes(s.heard.has)));
}

/**
 * Write the sightings down as they are met: conversations (Dialogue's 'dialogue:node'), the flags
 * they are keyed on, their own flags. A new one says so (toast). Returns an unsubscribe.
 */
export function recordSightings(game, { toast = () => {} } = {}) {
  const told = new Set();
  const note = (s) => { if (!game.flag(sightingFlag(s.id))) game.set(sightingFlag(s.id), true); };
  // (an old save: what it already holds, written down quietly)
  for (const s of SIGHTINGS) if (s.flag && game.flag(s.flag) && !game.flag(sightingFlag(s.id))) game.set(sightingFlag(s.id), true);
  const offs = [
    game.on('dialogue:node', (e) => { for (const s of sightingsOf(e)) note(s); }),
    game.on('flag', ({ name, value }) => {
      if (!value) return;
      for (const s of SIGHTINGS) if (s.flag === name) note(s);
      // written down (by note, or by a line's own effect): said once
      const s = name.startsWith('sight.') ? BY_ID.get(name.slice(6)) : null;
      if (s && !told.has(s.id)) { told.add(s.id); toast(`Noted in your sketchbook’s Sightings: ${THREADS.find((t) => t.id === s.thread)?.name.toLowerCase()}.`); }
    }),
  ];
  return () => offs.forEach((off) => off?.());
}

/**
 * The Sightings page: [{ id, name, ask, found, of, entries: [{ id, line, who, world, found }] }], one a
 * thread, in order. A sighting not met yet keeps its world's name only if the world is known (`known(id)`); one in a
 * world still being made (src/levels/names.js WIP) is left out until met.
 */
export function sightingsData({ game, known = () => true, titles = {}, list = SIGHTINGS, wip = isWip } = {}) {
  return THREADS.map((t) => {
    // (a world still being made is off the map: its slots are left out, unless already met there)
    const entries = list.filter((s) => s.thread === t.id && (!wip(s.world) || seen(s.id, game))).map((s) => {
      const found = seen(s.id, game);
      return { id: s.id, found, line: found ? s.line : '?', who: found ? s.who : '', world: found || known(s.world) ? titles[s.world] ?? s.world : '' };
    });
    // (the ones met first, in the route's order; then the open slots)
    entries.sort((a, b) => Number(b.found) - Number(a.found));
    return { id: t.id, name: t.name, ask: t.ask, found: entries.filter((e) => e.found).length, of: entries.length, entries };
  });
}
