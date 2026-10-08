// The ending, in two homecomings (docs/story-bible.md, "The ending"; docs/game-brief.md,
// working decision 5).
//
// THE FIRST HOMECOMING (ENDING_WORLDS worlds done, any six of the route's eleven):
//  - the last recording on the reel asks the traveller home (src/story/calls.js) and the galactic
//    map shows Home at its centre, where the route starts (src/ship/starmap.js);
//  - choosing Home flies there (?level=home&via=ship, src/levels/home.js). Out of the jump the ship
//    reads out the hold: every keepsake and every one of the makers' small gifts (tokenList) goes
//    down. The ship lands by the house; the lamp in its window is dark. The parents are dead: their
//    stone stands in the front yard. Lou, his daughter, runs down from the small house and goes to
//    the stone with him (src/story/home.js). He sets the tokens on it one by one (tombLines: a short
//    line for each), and the choices the stone remembers (choiceLines); Lou leaves her drawing.
//  - Then, as he takes out the reel to set it down, the singing light comes over the hill (LIGHT_OVER):
//    it dips over the round house, turns as if it is looking for something, and climbs away out
//    along the route. He keeps the reel. Lou makes him promise on the stone: once more, then he stays.
//    No end card, no credits: the story goes on (`ending.done`). The reel's oldest recording is
//    still unheard.
//
// THE FINAL CHAPTER: once the first homecoming is done and the Signal Market has been heard (the
// father's thirty-year-old broadcast to Ilen), the light's trace is charted past the market
// (finaleOpen; the relay's 'trace', src/story/relay.js): the Lantern (FINALE_ID, src/levels/lantern.js).
// There Ilen, the sister he never knew, keeps the makers' lantern. The light was her answer: she
// sent it back along the relays, singing her father's own message, carrying the makers' sign
// (three dots over an arc: "we heard you"); it went looking for the voice that had called her and
// found it on the reel in his cockpit (src/story/lantern-data.js). She comes home with him
// (`finale.met`).
//
// THE TRUE ENDING (finalDue): flying home with her plays the homecoming again, the last time: what
// is new goes on the stone, Ilen sets down the message that reached her, he sets down the reel at
// last and it plays its oldest recording (FINAL_RECORDING, as a hologram over the stone). The closing
// line, the end card, then the credits: a paper page of the worlds, the people met, and what was left
// on the stone (src/ship/homecoming.js plays it all). `ending.final` is set, and the game goes on:
// the ship flies anywhere again; the reel plays its oldest side; the stone keeps its tokens; the
// lamp in the round window is lit again (Ilen lives in the round house now).
//
// Old saves that ended before there were two homecomings (`ending.done` without `ending.first`):
// their ending counts as the first homecoming (src/save-migrate.js step 2); the finale opens once
// they have heard the market, as for everyone.
//
// Everything here is pure (data and text); the tests use it directly.
//
// Flags: ending.keepsake ('all'; saves that ended before kept one keepsake's id, or 'nothing'),
// ending.kind, ending.name, ending.tokens (how many), ending.done (the first homecoming is over),
// ending.first ('new' | 'old': how it was played), ending.final (the true ending is over),
// finale.met (Ilen found; she comes home with him).

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
import * as lantern from './lantern-data.js';
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

// ------------------------------------------------------------------ the final chapter

/** The last place: where the singing light comes from (src/levels/lantern.js). */
export const FINALE_ID = 'lantern';
/** The world whose broadcast leads there: the father's message to Ilen. */
export const FINALE_AFTER = 'bazaar';

/** The Signal Market has been heard (its world done, or the broadcast's clue). */
export const marketHeard = ({ flag, completed } = {}) => !!(flag?.(`world.${FINALE_AFTER}.done`) || flag?.('clue.bazaar.home')
  || (Array.isArray(completed) && completed.includes(FINALE_AFTER)));

/**
 * Is the Lantern on the galactic map? After the first homecoming, once the market's broadcast has been
 * heard (in either order); or once you have been there.
 */
export const finaleOpen = ({ flag, completed } = {}) => !!flag?.('finale.met') || !!flag?.('ending.final')
  || (!!flag?.('ending.done') && marketHeard({ flag, completed }));

/** Ilen is coming home with him, and the true ending has not played yet: the next flight home is the last homecoming. */
export const finalDue = (flag) => !!flag?.('finale.met') && !flag?.('ending.final');

/**
 * Which homecoming arriving at home by ship plays: 'first' (the stone, the light over the hill),
 * 'final' (Ilen with him, the oldest recording, the end card and the credits), or null (just home).
 */
export function homecomingKind(flag) {
  if (!flag?.('ending.done')) return 'first';
  if (finalDue(flag)) return 'final';
  return null;
}

/** The galactic map's entry for the Lantern (null while it is not on the chart). */
export function finaleEntry({ open, current, flag = () => undefined }) {
  if (!open && current !== FINALE_ID) return null;
  const met = !!flag('finale.met');
  return {
    id: FINALE_ID, title: 'The Lantern', finale: true, current: current === FINALE_ID, visited: met || current === FINALE_ID, done: met,
    source: 'where the singing light comes from',
    blurb: met
      ? 'A small island in a still sea of light, and the makers’ lantern on it. Ilen kept it for thirty years. It can keep itself a while.'
      : 'Past the Signal Market, off every chart: the trace of the light that struck the ship runs back to one small world, and stops there.',
  };
}

// ------------------------------------------------------------------ the choices the stone remembers

/**
 * What he chose along the route, as the stone (and Ilen) remember it:
 *   token:   'kept' | 'returned' (Dov's lift token, the City-Shaft: kept it, or pressed it back into his hand so he would go home)
 *   promise: 'kept' | 'made' | 'declined' (Hollin's lamps, Lorn II: promised to come back, and went; promised; would not promise)
 *   broke:   the tea terraces came down (Viridel: the quest that fails, whatever you do)
 */
export function choicesMade(flag = () => undefined) {
  const t = flag('incal.token');
  const p = flag('perdide2.promise');
  return {
    token: t === 'returned' ? 'returned' : t === 'kept' ? 'kept' : null,
    promise: p === 'yes' ? (flag('perdide2.promise.kept') ? 'kept' : 'made') : p === 'maybe' ? 'declined' : null,
    broke: !!flag('edena.terraces.flooded'),
  };
}

/** The traveller's words at the stone for each choice (after the tokens), tone-tagged. */
export function choiceLines(ch = {}) {
  const out = [];
  if (ch.token === 'returned') out.push(spoken('you', '~whisper~ Dov’s lift token isn’t here. I gave it back to him. He’d carried a way home for eleven years without using it.'));
  if (ch.promise === 'kept') out.push(spoken('you', '~solemn~ Hollin’s lamps. I told him I’d go back to the deep wood, and I went.'));
  else if (ch.promise === 'made') out.push(spoken('you', '~sad~ And Hollin, in the deep wood, watching the path for me. I promised I’d go back. I haven’t yet.'));
  // the quest that failed (src/story/terraces.js): the father's own advice, kept (calls.js, beat 'broke')
  if (ch.broke) out.push(spoken('you', '~sad~ And Esk’s hill, which I could not mend. I helped open the gate that broke. I’m still sorry.'));
  return out;
}

/** Coming home with empty hands (saves that ended before the stone could choose it). */
export const NOTHING = { id: 'nothing', level: HOME_ID, name: 'Nothing', kind: 'nothing', text: 'Empty hands. Just you, walking back in through the door on your own two feet.' };
/** What is left at the stone now: everything. */
export const ALL = { id: 'all', level: HOME_ID, name: 'Everything you gathered', kind: 'all', text: 'Every keepsake and every gift, set on the stone one by one.' };

export const KIND_LABEL = { thing: 'a thing', song: 'a song', word: 'words', person: 'a person', knowing: 'a knowing', nothing: 'yourself', all: 'everything', item: 'a gift' };

/** The makers' small gifts that go on the stone (not the backpack, its jets and wings: he wears those). */
export const TOKEN_ITEMS = ['stun', 'fire', 'cell', 'coil', 'lantern', 'lens', 'bell', 'shell', 'echo', 'star'];

/** What each gift means now, set on the stone. */
const ITEM_LINES = {
  stun: "~solemn~ (The stilling lens. So many things changed when you stopped rushing.)",
  fire: "~solemn~ (The ember ring. You learned to carry fire.)",
  cell: "~solemn~ (The fourth chamber. Room for a little more.)",
  coil: "~solemn~ (The quick coil. Something to help you get up again.)",
  lantern: "~solemn~ (The lantern charm. A light you could take with you.)",
  lens: "~solemn~ (The glyph lens. Marks you would once have walked past.)",
  bell: "~solemn~ (The bell-note whistle. One clear note, wherever you play it.)",
  shell: "~solemn~ (The listening shell. What was hidden hummed back, if you were quiet enough to hear it.)",
  echo: "~solemn~ (The echo shell. It keeps the last note it heard, the way the reel kept their voices.)",
  star: "~solemn~ (The pale star from your hood. A traveller’s sign.)",
};

/** Keepsakes that never go on the slab: Ilen (the Lantern's keepsake is her, and she walks to the stone herself). */
export const NOT_SET_DOWN = new Set(['lantern.person']);

/** What Ilen sets on the stone at the true ending: the message that reached her (src/story/lantern-data.js). */
export const ILEN_TOKEN = { id: 'ilen.message', kind: 'word', level: 'lantern', name: 'The message that reached her',
  text: '“Come with empty hands. Just come.” Your father’s voice, thirty years on the way. Ilen kept it.' };

/**
 * Everything that goes on the stone, in order: the keepsakes as they were found, then the
 * makers' gifts. Each is { id, kind ('thing' | 'song' | 'word' | 'person' | 'knowing' | 'item'),
 * name, text, keepsake?, item? }.
 * @param keepsakes game.keepsakes() · owned: item ids (items.owned())
 */
export function tokenList(keepsakes = [], owned = []) {
  const seen = new Set(), out = [];
  for (const k of keepsakes) if (k?.id && !seen.has(k.id) && !NOT_SET_DOWN.has(k.id)) { seen.add(k.id); out.push({ id: k.id, kind: k.kind ?? 'thing', name: k.name, text: k.text ?? '', level: k.level, keepsake: k }); }
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
  F("~happy~ We’re recording this so you can hear yourself when you’re big. You won’t believe how loud you were."),
  F('~neutral~ No, keep your spoon. The recorder doesn’t need anything. Nobody needs anything. Just wave.'),
  M("~happy~ We’re proud of you already. Look at those hands. He’s trying to wave to everyone."),
  F("~playful~ Say goodbye to the recorder, love. Goodbye, recorder."),
  YOU('~whisper~ Goodbye.'),
];

/** Ilen at the stone (docs/story-bible.md, "At the stone"): in the ending if he knows, else once at the stone after it. */
export const ILEN_AT_STONE = '~whisper~ And this space is for Ilen, wherever she is.';
/** Is Ilen still to be named at the stone? The ending is over, he has learned about her since (`ending.ilen`: she was named in it). */
export const ilenAtStoneDue = (flag) => !!flag('ending.done') && !!flag('calls.ilen.told') && !flag('ending.ilen') && !flag('home.ilen.said');

export const CLOSING = S("~solemn~ Something of value. Home, on your own two feet.");

/** The closing line of the first homecoming: no end card, the story goes on. */
export const FIRST_CLOSING = S('~solemn~ Not home yet. Not all the way.');

/**
 * The singing light over the hill, at the first homecoming, as he takes out the reel: the lines that
 * move it carry `light` ('come' | 'dip' | 'go': src/ship/homecoming.js flies it), and the one where he
 * keeps the reel carries `keep: true`.
 */
export function lightOver(ctx = {}) {
  return [
    S('~solemn~ (You take out the reel to set it beside them. Then, over the hill, something starts to sing.)', { light: 'come' }),
    S('~solemn~ (A light comes in low over the valley, singing one long, thin note that you feel in your teeth. It dips over the round house.)', { light: 'dip' }),
    ctx.lou ? LOU('~surprised~ The singing star! It comes over sometimes. Grandpa used to stand at the window for it.') : S('~solemn~ (The round window catches it. Nobody stands there now.)'),
    YOU('~solemn~ That’s what struck my ship.'),
    S('~solemn~ (It turns the way everyone said it turns, as if it is looking for something. Then it climbs away, out along the route.)', { light: 'go' }),
    ...(ctx.ilenTold ? [YOU('~whisper~ Mum said the last sound from Ilen’s ship was singing.')] : []),
    spoken('you', '~solemn~ (You keep the reel. Not yet. Not until you know what that was.)', { keep: true }),
    ...(ctx.lou ? [
      LOU('~sad~ You’re going again.'),
      YOU('~solemn~ Once more. Then I’m staying.'),
      LOU('~playful~ Promise on the stone. Hand flat. That’s how it works here.'),
      S('~solemn~ (You put your hand flat on the stone. So does she, next to yours.)'),
      YOU('~whisper~ I promise.'),
    ] : [YOU('~whisper~ Once more. Then I’m staying.')]),
  ];
}

const IL = (text, extra) => spoken('ilen', text, extra);

/** Ilen at the stone, for each choice he made on the way (she heard about them at the Lantern). */
export function ilenOnChoices(ch = {}) {
  const out = [];
  if (ch.token === 'returned') out.push(IL('~whisper~ He gave a man his way home, Dad. You’d have called it a waste. It wasn’t.'));
  if (ch.promise === 'kept') out.push(IL('~happy~ And he went back to the deep wood, like he said. Hollin knows where Odile and Talo went now.'));
  else if (ch.promise === 'made') out.push(IL('~playful~ He still owes a lamp-keeper a visit. I’ll see that he goes.'));
  if (ch.broke) out.push(IL('~solemn~ He broke something he couldn’t mend, and said sorry, and went when he was asked. You taught him that one.'));
  return out;
}

/**
 * Everything at the stone, in order. Lines that set a token down carry it (`token`); the line that
 * sets the reel down carries `reel: true` (FINAL_RECORDING follows it); Lou's drawing `drawing: true`.
 *
 * The first homecoming (ctx.final false): every token, the choices (choiceLines), Ilen's space if he
 * knows of her, Lou's drawing, then the light over the hill (lightOver): he keeps the reel, and
 * FIRST_CLOSING. The true ending (ctx.final): `tokens` are what is new since; Ilen speaks to them and
 * sets down ILEN_TOKEN; her words on the choices; the reel at last, the oldest recording, CLOSING.
 * @param tokens tokenList() (final: the new ones) · ctx { ilenTold: the mother's recording about Ilen was heard,
 *   lou: Lou is there with you (she leaves her drawing; and asks about the recording after it), drawn: her
 *   drawing is on the stone already, broke: the tea terraces came down (older callers), choices: choicesMade(),
 *   final: the true ending, Ilen at your side }
 */
export function tombLines(tokens = [], ctx = {}) {
  const ch = ctx.choices ?? { broke: !!ctx.broke };
  const lines = [S("~solemn~ (Their names beneath two overlapping rings. The same shape as the moons above the house.)")];
  if (ctx.final) {
    lines.push(IL('~whisper~ Mum. Dad. It’s Ilen.'), IL('~sad~ I heard you. It took thirty years, and I heard you.'));
    if (tokens.length) {
      lines.push(YOU('~whisper~ And what I found since.'));
      for (const t of tokens) lines.push({ ...tokenLine(t), token: t });
    }
    lines.push(S('~solemn~ (Ilen kneels and sets something small on the slab: the recording that reached her.)', { token: ILEN_TOKEN, ilen: true }));
    lines.push(IL('~solemn~ Your message came the whole way, Dad. I kept it.'));
    lines.push(...ilenOnChoices(ch));
    lines.push(YOU('~whisper~ It isn’t what you asked for. It’s what we have.'));
    if (ctx.lou) {
      lines.push(LOU('~whisper~ I left a space at the edge of my drawing. I didn’t know your face, Aunt Ilen.'));
      if (!ctx.drawn) lines.push(S(LOU_AT_STONE.drawing, { drawing: true }));
      lines.push(IL('~happy~ You can draw it now. I’ll sit very still.'));
    }
    lines.push(S('~solemn~ (You set the reel beside the keepsakes at last. It starts to play.)', { reel: true }));
    lines.push(...FINAL_RECORDING);
    lines.push(IL('~sad~ I never saw you that small. I never saw you at all.'), YOU('~whisper~ You see me now.'));
    if (ctx.lou) lines.push(LOU(LOU_AT_STONE.after), YOU(LOU_AT_STONE.you));
    lines.push(CLOSING);
    return lines;
  }
  if (tokens.length) {
    lines.push(YOU('~whisper~ I brought everything.'));
    for (const t of tokens) lines.push({ ...tokenLine(t), token: t });
  } else lines.push(S("~sad~ (You have nothing to set down. You rest your empty hands on the stone.)"));
  if (ctx.ilenTold) lines.push(YOU(ILEN_AT_STONE));
  lines.push(...choiceLines(ch));
  lines.push(YOU('~whisper~ It isn’t what you asked for. It’s what I have.'));
  if (ctx.lou) lines.push(LOU(LOU_AT_STONE.bring), S(LOU_AT_STONE.drawing, { drawing: true }));
  lines.push(...lightOver(ctx));
  lines.push(FIRST_CLOSING);
  return lines;
}

// ------------------------------------------------------------------ the credits

/** Each world's people, from its story data. */
export const WORLD_DATA = { desert, incal, arzach, arzach2, garage, buried, edena, spheres, perdide, perdide2, bazaar, lantern };
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
  if (flag('ending.final') || flag('finale.met')) home.push('and Ilen, who heard him, and answered, and came home');
  else if (flag('calls.ilen.told')) home.push('and Ilen, wherever she is');
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
