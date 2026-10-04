// The ending: going home, and what you bring (docs/game-brief.md, working
// decision 5; docs/story-bible.md, "The ending").
//
//  - Once ENDING_WORLDS worlds are done, the call home that follows asks the
//    traveller to come home (src/story/calls.js) and the galactic map shows
//    Home at its centre, where the route starts (src/ship/starmap.js).
//  - Choosing Home flies there (?level=home&via=ship, src/levels/home.js).
//    The ship comes out of the jump in orbit; in the cockpit the traveller
//    chooses one keepsake to bring home, or nothing; the ship lands by the
//    house; the parents are waiting (src/ship/homecoming.js plays it).
//  - The father's words depend on the kind of thing chosen. The mother's do
//    not: they are about the traveller. A closing line, then the credits: a
//    paper page of the worlds and the people met, from the story data.
//  - The choice is kept (`ending.keepsake`, `ending.kind`); `ending.done` is
//    set at the end, and the game goes on: the ship flies anywhere again, and
//    the calls home after that are calls from home.
//
// Everything here is pure (data and text); the tests use it directly.
//
// Flags: ending.keepsake (the chosen keepsake's id, or 'nothing'), ending.kind,
// ending.name, ending.done.

import * as desert from './desert-data.js';
import * as incal from './incal-data.js';
import * as arzach from './arzach-data.js';
import * as arzach2 from './arzach2-data.js';
import * as garage from './garage-data.js';
import * as buried from './buried-data.js';
import * as edena from './edena-data.js';
import * as spheres from './spheres-data.js';
import * as perdide from './perdide-data.js';
import * as perdide2 from './perdide2-data.js';
import * as bazaar from './bazaar-data.js';
import { spoken } from './tone.js';

/** How many worlds must be done before home is on the map. */
export const ENDING_WORLDS = 6;

export const HOME_ID = 'home';

export const endingUnlocked = (completed) => (Array.isArray(completed) ? completed.length : completed) >= ENDING_WORLDS;

/** The galactic map's entry for home (null while it is not on the chart). */
export function homeEntry({ unlocked, current }) {
  if (!unlocked && current !== HOME_ID) return null;
  return {
    id: HOME_ID, title: 'Home', home: true, current: current === HOME_ID, visited: true, done: false,
    source: 'where the route begins',
    blurb: 'A small round house on a small round hill, a lamp in the window, and two moons over it. They are waiting.',
  };
}

/** Coming home with empty hands is a choice too. */
export const NOTHING = { id: 'nothing', level: HOME_ID, name: 'Nothing', kind: 'nothing', text: 'Empty hands. Just you, walking back in through the door on your own two feet.' };

export const KIND_LABEL = { thing: 'a thing', song: 'a song', word: 'words', person: 'a person', knowing: 'a knowing', nothing: 'yourself' };

/** What the cockpit panel offers: every keepsake collected, then nothing. */
export function choiceList(keepsakes = []) {
  const seen = new Set();
  const out = [];
  for (const k of keepsakes) if (k && !seen.has(k.id)) { seen.add(k.id); out.push(k); }
  return [...out, NOTHING];
}

/** Keep the choice. */
export function chooseKeepsake(game, k) {
  const pick = k ?? NOTHING;
  game.set('ending.keepsake', pick.id);
  game.set('ending.kind', pick.kind);
  game.set('ending.name', pick.name);
  return pick;
}

/** The chosen keepsake, as kept (null before the ending). */
export function chosenKeepsake(game) {
  const id = game.flag('ending.keepsake');
  if (!id) return null;
  if (id === NOTHING.id) return NOTHING;
  return (game.keepsakes() ?? []).find((k) => k.id === id) ?? { id, name: game.flag('ending.name') ?? id, kind: game.flag('ending.kind') ?? 'thing' };
}

/** The words a keepsake holds, without the speaker's attribution: “Look up once a day.” → Look up once a day. */
export function quoteOf(k) {
  const t = k?.text ?? '';
  const m = t.match(/“([^”]+)”/);
  if (m) return m[1].trim();
  return k?.kind === 'word' && t ? t : k?.name ?? '';
}

// ------------------------------------------------------------------ the parents' reaction

// each line carries its tone ('~sad~ …': src/story/tone.js), read off by spoken()
const F = (text) => spoken('father', text), M = (text) => spoken('mother', text), S = (text) => spoken('scene', text);

/** The father's words, by the kind of thing you brought. */
export const FATHER_HOME = {
  thing: (k) => [
    S(`~solemn~ (You put ${k.name.replace(/^A /, 'the ').replace(/^An /, 'the ')} in his hands. He weighs it, the way he weighs everything.)`),
    F('~happy~ Good. Solid. Something a man can hold. It is exactly what I asked you for.'),
    F('~sad~ …It is lighter than I thought it would be.'),
  ],
  song: (k) => [
    S(`~playful~ (You hum it for him: ${k.name.replace(/^The /, 'the ')}. Badly, then less badly.)`),
    F('~curious~ Again.'),
    S('~happy~ (He does not sing. But the third time through, his foot keeps the beat.)'),
  ],
  word: (k) => k.id === 'bazaar.word' ? [
    S('~solemn~ (You start to tell him the words from the tower. He knows them before you finish.)'),
    F('~sad~ Those were mine.'),
    F('~solemn~ I sent them a long way, to someone else. I am glad they found somebody.'),
  ] : [
    S(`~solemn~ (You tell him what was said to you, out there: “${quoteOf(k)}”)`),
    F('~surprised~ Someone said that to you? To you, and meant it?'),
    F('~happy~ Then they saw you properly. Good. Somebody should have, sooner.'),
  ],
  person: (k) => [
    S(`~solemn~ (You tell him about ${k.name.replace(/^The /, 'the ')}: someone out there who wants you to come back.)`),
    F('~sad~ Someone is waiting for you, out there.'),
    F('~sad~ So were we. We should have said that first, at the port, instead of all the rest.'),
  ],
  knowing: (k) => [
    S(`~curious~ (You try to explain it: ${k.text ?? k.name})`),
    F('~tired~ I don’t understand it.'),
    F('~happy~ Explain it to me again tomorrow. And the day after. We have time now.'),
  ],
  nothing: (k, ctx = {}) => [
    S('~sad~ (Your hands are empty. You hold them up so he can see.)'),
    F('~tired~ Nothing.'),
    ctx.ilen
      ? F('~sad~ That is what I told Ilen to bring, in the end. Nothing. Only herself. I said it too late, to the wrong sky.')
      : F('~solemn~ Good. That is the only thing I ever wanted back. I did not know how to ask for it.'),
  ],
};

/** The mother's words: always the same, and about you, not the gift. */
export const MOTHER_HOME = [
  M('~happy~ Let me look at you.'),
  M('~happy~ You’re taller. No, you’re not. You stand differently. Like someone who has been listened to.'),
  M('~happy~ Come inside. There’s something warm on the stove. There always was.'),
];

export const CLOSING = S('~solemn~ Something of value. You brought it home on your own two feet.');

/**
 * Everything said at the door, in order.
 * @param k the chosen keepsake (or NOTHING)
 * @param ctx { ilen: the Signal Market's broadcast was heard, ilenTold: the mother has told you }
 */
export function reactionLines(k, ctx = {}) {
  const pick = k ?? NOTHING;
  const father = (FATHER_HOME[pick.kind] ?? FATHER_HOME.thing)(pick, ctx);
  const lines = [F('~happy~ You’re home.'), ...father, ...MOTHER_HOME];
  if (ctx.ilen && !ctx.ilenTold) lines.push(M('~whisper~ There is someone we should tell you about. Tomorrow. Tonight you are home.'));
  lines.push(CLOSING);
  return lines;
}

// ------------------------------------------------------------------ the credits

/** Each world's people, from its story data. */
export const WORLD_DATA = { desert, incal, arzach, arzach2, garage, buried, edena, spheres, perdide, perdide2, bazaar };
const PEOPLE_LISTS = ['PEOPLE', 'LANDING', 'LOCALS', 'KEEPERS', 'RIM', 'STREET'];

/** [{ id, name, title }] for one world (people only: not signs, stones or bowls). */
export function peopleOf(world) {
  const m = WORLD_DATA[world];
  if (!m) return [];
  const out = [], seen = new Set();
  for (const key of PEOPLE_LISTS) {
    const list = m[key];
    if (!list) continue;
    for (const p of Array.isArray(list) ? list : Object.values(list)) {
      if (!p?.name || seen.has(p.name)) continue;
      if (/^The /.test(p.name) && !p.kind && key !== 'PEOPLE') continue;
      if (!p.talk && !p.lines && !p.kind) continue;
      seen.add(p.name);
      out.push({ id: p.id, name: p.name, title: p.title ?? '' });
    }
  }
  return out.filter((p) => !/^The (root stone|heart|fireflies|broadcast|Upward Shrine|call-lamp)/.test(p.name));
}

/**
 * The credits roll: the worlds, in the order of the route, and their people.
 * @param o { order, titles: { id: level title }, storyTitles: { id: story title }, flag(k), keepsake (chosen) }
 * @returns { title, worlds: [{ id, title, story, done, people: [{ name, title, met }] }], home: [lines], keepsake }
 */
export function credits({ order = Object.keys(WORLD_DATA), titles = {}, storyTitles = {}, flag = () => undefined, keepsake = null } = {}) {
  const worlds = order.filter((id) => WORLD_DATA[id]).map((id) => ({
    id, title: titles[id] ?? id, story: storyTitles[id] ?? '', done: !!flag(`world.${id}.done`),
    people: peopleOf(id).map((p) => ({ ...p, met: !!flag(`met.${p.id}`) })),
  }));
  const home = [];
  if (flag('bird.promise')) home.push('the bird, who keeps her promises');
  home.push('your mother', 'your father');
  if (flag('calls.ilen.told')) home.push('and Ilen, wherever she is');
  return { title: 'SOMETHING OF VALUE', worlds, home, keepsake };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The credits as a paper page (HTML); the people you never met are drawn in pencil. */
export function creditsHtml(c) {
  const world = (w) => `<section class="w${w.done ? ' done' : ''}">
      <h3>${esc(w.title)}</h3>${w.story ? `<div class="story">${esc(w.story)}</div>` : ''}
      <ul>${w.people.map((p) => `<li class="${p.met ? 'met' : 'unmet'}"><b>${esc(p.name)}</b>${p.title ? `<i>${esc(p.title)}</i>` : ''}</li>`).join('')}</ul>
    </section>`;
  return `<div class="roll">
    <h1>${esc(c.title)}</h1>
    <div class="glyph">· · ·<br>⌒</div>
    <p class="lead">A traveller went out to bring back something of value,<br>and met these people on the way.</p>
    ${c.worlds.map(world).join('')}
    <section class="home"><h3>At home</h3><ul>${c.home.map((h) => `<li class="met"><b>${esc(h)}</b></li>`).join('')}</ul></section>
    ${c.keepsake ? `<p class="brought">Brought home: <b>${esc(c.keepsake.name)}</b>${c.keepsake.kind && c.keepsake.kind !== 'nothing' ? ` <i>(${esc(KIND_LABEL[c.keepsake.kind] ?? c.keepsake.kind)})</i>` : ''}</p>` : ''}
    <p class="end">The ship is ready whenever you are.</p>
  </div>`;
}
