// The ending: going home, to the stone on the hill (docs/game-brief.md, working
// decision 5; docs/story-bible.md, "The recordings" and "The ending").
//
//  - Once ENDING_WORLDS worlds are done, the last recording on the reel asks the
//    traveller home (src/story/calls.js) and the galactic map shows Home at its
//    centre, where the route starts (src/ship/starmap.js).
//  - Choosing Home flies there (?level=home&via=ship, src/levels/home.js). Out of
//    the jump the ship reads out the hold: every keepsake and every one of the
//    makers' small gifts (tokenList) goes down. The ship lands by the house; the
//    lamp in its window is dark. The parents are dead: their stone stands in the
//    front yard. Lou, his daughter, runs down from the small house across the yard
//    and goes to the stone with him (src/story/home.js). The traveller sets the
//    tokens on it one by one (tombLines: a short line for each); Lou leaves her
//    drawing; last the reel, which plays its oldest recording
//    (FINAL_RECORDING, as a hologram over the stone). The closing line, an end
//    card, then the credits: a paper page of the worlds, the people met, and what
//    was left on the stone (src/ship/homecoming.js plays it all).
//  - `ending.done` is set at the end, and the game goes on: the ship flies anywhere
//    again; the reel plays its oldest side; the stone keeps its tokens.
//
// Everything here is pure (data and text); the tests use it directly.
//
// Flags: ending.keepsake ('all'; saves that ended before kept one keepsake's id, or
// 'nothing'), ending.kind, ending.name, ending.tokens (how many), ending.done.

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
import { LOU_AT_STONE } from './home-data.js';
import { ITEMS } from '../items.js';

/** How many worlds must be done before home is on the map. */
export const ENDING_WORLDS = 6;

export const HOME_ID = 'home';

export const endingUnlocked = (completed) => (Array.isArray(completed) ? completed.length : completed) >= ENDING_WORLDS;

/**
 * Is Home on the galactic map? The one rule the map, the charge card and the ending share:
 * any six worlds done (of the eleven on the route, in any order), and the last recording on
 * the reel heard ("Come home": `calls.home`, or `calls.<ENDING_WORLDS>` on older saves); or
 * the ending already played. The voicemail button blinks on the dash while that message waits
 * (the holo table's map opens either way); the worlds not yet seen stay open, before home or after.
 */
export const homeOpen = ({ flag, completed }) => !!flag?.('ending.done')
  || (endingUnlocked(completed ?? 0) && !!(flag?.('calls.home') || flag?.(`calls.${ENDING_WORLDS}`)));

/** The galactic map's entry for home (null while it is not on the chart). */
export function homeEntry({ unlocked, current }) {
  if (!unlocked && current !== HOME_ID) return null;
  return {
    id: HOME_ID, title: 'Home', home: true, current: current === HOME_ID, visited: true, done: false,
    source: 'where the route begins',
    blurb: 'A small round house on a small round hill, and two moons over it. Nobody lives in the round house now; there is a stone in its yard. Across the yard, a smaller house with its lamp lit.',
  };
}

/** Coming home with empty hands (saves that ended before the stone could choose it). */
export const NOTHING = { id: 'nothing', level: HOME_ID, name: 'Nothing', kind: 'nothing', text: 'Empty hands. Just you, walking back in through the door on your own two feet.' };
/** What is left at the stone now: everything. */
export const ALL = { id: 'all', level: HOME_ID, name: 'Everything you gathered', kind: 'all', text: 'Every keepsake and every gift, set on the stone one by one.' };

export const KIND_LABEL = { thing: 'a thing', song: 'a song', word: 'words', person: 'a person', knowing: 'a knowing', nothing: 'yourself', all: 'everything', item: 'a gift' };

/** The makers' small gifts that go on the stone (not the backpack, its jets and wings: he wears those). */
export const TOKEN_ITEMS = ['stun', 'fire', 'cell', 'coil', 'lantern', 'lens', 'bell', 'star'];

/** What each gift means now, set on the stone. */
const ITEM_LINES = {
  stun: "~solemn~ (The stilling lens. So many things changed when you stopped rushing.)",
  fire: "~solemn~ (The ember ring. You learned to carry fire.)",
  cell: "~solemn~ (The fourth chamber. Room for a little more.)",
  coil: "~solemn~ (The quick coil. Something to help you get up again.)",
  lantern: "~solemn~ (The lantern charm. A light you could take with you.)",
  lens: "~solemn~ (The glyph lens. Marks you would once have walked past.)",
  bell: "~solemn~ (The bell-note whistle. One clear note, wherever you play it.)",
  star: "~solemn~ (The pale star from your hood. A traveller’s sign.)",
};

/**
 * Everything that goes on the stone, in order: the keepsakes as they were found, then the
 * makers' gifts. Each is { id, kind ('thing' | 'song' | 'word' | 'person' | 'knowing' | 'item'),
 * name, text, keepsake?, item? }.
 * @param keepsakes game.keepsakes() · owned: item ids (items.owned())
 */
export function tokenList(keepsakes = [], owned = []) {
  const seen = new Set(), out = [];
  for (const k of keepsakes) if (k?.id && !seen.has(k.id)) { seen.add(k.id); out.push({ id: k.id, kind: k.kind ?? 'thing', name: k.name, text: k.text ?? '', level: k.level, keepsake: k }); }
  for (const id of TOKEN_ITEMS) if (owned.includes(id) && ITEMS[id]) out.push({ id: `item.${id}`, kind: 'item', name: ITEMS[id].name, text: ITEMS[id].text, item: id });
  return out;
}

/** The line as a token is set down: what it was, now. */
export function tokenLine(t) {
  const name = t.name ?? '';
  switch (t.kind) {
    case 'item': return spoken('scene', ITEM_LINES[t.item] ?? `~solemn~ (${name}.)`);
    case 'song': return spoken('scene', `~solemn~ (${name}. You can hum it now without thinking.)`);
    case 'word': return spoken('scene', `~solemn~ (“${quoteOf(t.keepsake ?? t)}”)`);
    case 'person': return spoken('scene', `~solemn~ (${name}. Someone you promised to visit again.)`);
    case 'knowing': return spoken('scene', `~solemn~ (${name}. Something you wish you could explain to them.)`);
    default: return spoken('scene', `~solemn~ (${name}. All this way, in your keeping.)`);
  }
}

/** Keep what was left at the stone. */
export function leaveTokens(game, tokens = []) {
  game.set('ending.keepsake', ALL.id);
  game.set('ending.kind', ALL.kind);
  game.set('ending.name', ALL.name);
  game.set('ending.tokens', tokens.length);
  return ALL;
}

/** What was left at the end, as kept (null before the ending). */
export function chosenKeepsake(game) {
  const id = game.flag('ending.keepsake');
  if (!id) return null;
  if (id === NOTHING.id) return NOTHING;
  if (id === ALL.id) return ALL;
  return (game.keepsakes() ?? []).find((k) => k.id === id) ?? { id, name: game.flag('ending.name') ?? id, kind: game.flag('ending.kind') ?? 'thing' };
}

/** The words a keepsake holds, without the speaker's attribution: “Look up once a day.” → Look up once a day. */
export function quoteOf(k) {
  const t = k?.text ?? '';
  const m = t.match(/“([^”]+)”/);
  if (m) return m[1].trim();
  return k?.kind === 'word' && t ? t : k?.name ?? '';
}

// ------------------------------------------------------------------ at the stone

// each line carries its tone ('~sad~ …': src/story/tone.js), read off by spoken()
const F = (text) => spoken('father', text), M = (text) => spoken('mother', text), S = (text, extra) => spoken('scene', text, extra), YOU = (text) => spoken('you', text);
const LOU = (text, extra) => spoken('lou', text, extra);

/**
 * The oldest recording of all: the one he never searched for. It plays by itself when he
 * sets the reel on the stone, the three of them on the hologram (the parents young, a small
 * child between them).
 */
export const FINAL_RECORDING = [
  S("~solemn~ (The reel finds its oldest recording. One you never thought to search for.)"),
  M("~happy~ The light’s on. Say hello. Both hands? All right, both hands."),
  S("~happy~ (A small child waves at the recorder. You.)"),
  F("~happy~ We’re recording this for you. In case you’re grown up and far away when you need to hear it."),
  F('~solemn~ You don’t have to bring us anything. Do you hear? Nothing.'),
  M("~happy~ We’re proud of you already. Look at those hands. He’s trying to wave to everyone."),
  F("~playful~ Say goodbye to the recorder, love. Goodbye, recorder."),
  YOU('~whisper~ Goodbye.'),
];

export const CLOSING = S("~solemn~ Something of value. Home, on your own two feet.");

/**
 * Everything at the stone, in order. Lines that set a token down carry it (`token`); the
 * line that sets the reel down carries `reel: true`; FINAL_RECORDING follows it.
 * @param tokens tokenList() · ctx { ilenTold: the mother's recording about Ilen was heard, lou: Lou is there with you
 *   (she leaves her drawing: the line carries `drawing: true`; and asks about the recording after it),
 *   broke: the tea terraces in Viridel came down (`edena.terraces.flooded`, the quest that fails) }
 */
export function tombLines(tokens = [], ctx = {}) {
  const lines = [S("~solemn~ (Their names beneath two overlapping rings. The same shape as the moons above the house.)")];
  if (tokens.length) {
    lines.push(YOU('~whisper~ I brought everything.'));
    for (const t of tokens) lines.push({ ...tokenLine(t), token: t });
  } else lines.push(S("~sad~ (You have nothing to set down. You rest your empty hands on the stone.)"));
  if (ctx.ilenTold) lines.push(YOU('~whisper~ And this space is for Ilen, wherever she is.'));
  // the quest that failed (src/story/terraces.js): the father's own advice, kept (calls.js, beat 'broke')
  if (ctx.broke) lines.push(YOU("~sad~ And Esk’s hill, which I could not mend. I helped open the gate that broke. I’m still sorry."));
  lines.push(YOU('~whisper~ It isn’t what you asked for. It’s what I have.'));
  if (ctx.lou) lines.push(LOU(LOU_AT_STONE.bring), S(LOU_AT_STONE.drawing, { drawing: true }));
  lines.push(S("~solemn~ (You set the reel beside the keepsakes. It starts to play.)", { reel: true }));
  lines.push(...FINAL_RECORDING);
  if (ctx.lou) lines.push(LOU(LOU_AT_STONE.after), YOU(LOU_AT_STONE.you));
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
 * @param o { order, titles: { id: level title }, storyTitles: { id: story title }, flag(k), keepsake (ALL, or an older save's), tokens (tokenList) }
 * @returns { title, worlds: [{ id, title, story, done, people: [{ name, title, met }] }], home: [lines], keepsake, tokens: [names] }
 */
export function credits({ order = Object.keys(WORLD_DATA), titles = {}, storyTitles = {}, flag = () => undefined, keepsake = null, tokens = [] } = {}) {
  const worlds = order.filter((id) => WORLD_DATA[id]).map((id) => ({
    id, title: titles[id] ?? id, story: storyTitles[id] ?? '', done: !!flag(`world.${id}.done`),
    people: peopleOf(id).map((p) => ({ ...p, met: !!flag(`met.${p.id}`) })),
  }));
  const home = [];
  if (flag('bird.promise')) home.push('the bird, who keeps her promises');
  home.push('your mother and your father, on the hill');
  home.push('Lou, who drew every world, and Aunt Tove, and Moustache, in the small house');
  if (flag('calls.ilen.told')) home.push('and Ilen, wherever she is');
  return { title: 'SOMETHING OF VALUE', worlds, home, keepsake, tokens: tokens.map((t) => t.name) };
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
    ${c.tokens?.length ? `<section class="stone"><h3>Left on the stone</h3><ul>${c.tokens.map((n) => `<li class="met">${esc(n)}</li>`).join('')}</ul></section>`
    : c.keepsake && c.keepsake.id !== 'all' ? `<p class="brought">Brought home: <b>${esc(c.keepsake.name)}</b>${c.keepsake.kind && c.keepsake.kind !== 'nothing' ? ` <i>(${esc(KIND_LABEL[c.keepsake.kind] ?? c.keepsake.kind)})</i>` : ''}</p>` : ''}
    <p class="end">The ship is ready whenever you are.</p>
  </div>`;
}
