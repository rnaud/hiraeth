// The scientist as data: Anselm Thrum, who studies light (docs/systems/fragments.md, issue #196; named Orrin until v1.61,
// #229: the father's neighbours are the Orrins). His story: docs/story-bible.md, "The fragments of the singing light".
//
// He has been on the lookout for the fragments of the singing light since the night the light went over: where it passed it
// shed splinters of its song, and they hid where nobody goes. The first one the traveller picks up, he is there (he
// had been following its song with his ticking box); he says so in a few words and asks to come aboard. From then on
// he lives in the ship's hold among the crates (src/story/scientist.js ABOARD), counts what you bring him, and sells
// his upgrades for them (v1.62, issue #185: src/fragment-shop.js; until then he fitted one free at each milestone of
// the count, 5, 10, 15, 25, 50, 75 and all): "Show me what you have" opens his shop (src/shop-panel.js).
//
// Flags: frag.met (the first meeting had), frag.<world>.<i> (src/fragments-data.js), frag.finder.off; met.thrum,
// talks.thrum (the panel's). Items: src/items.js FRAGMENT_ITEMS; what you hold: src/fragment-shop.js.

import { fragmentCounts, CHART_FLAG } from '../fragments-data.js';
import { fragmentPurse, affordable, THRUM_WARES } from '../fragment-shop.js';
import { TITLES } from '../levels/names.js';

// (in words to thirty: a world's count is 24 since v1.70, issue #317; over that, figures)
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const NUM = ['no', ...ONES.slice(1), 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  ...ONES.map((o) => (o ? `twenty-${o}` : 'twenty')), 'thirty'];
const say = (n) => (n < NUM.length ? NUM[n] : String(n));
const cap = (s) => s.replace(/^./, (c) => c.toUpperCase());
/** A world's title inside a sentence (“in the Desert”). */
const inLine = (id) => (TITLES[id] ?? id).replace(/^The /, 'the ');

/**
 * His shop's lines (src/shop-panel.js keeperLine, as the keepers' SHOP_LINES): on opening, too dear, its gear not had
 * yet, fitted already, each upgrade as he fits it, and his goodbye.
 */
export const THRUM_SHOP_LINES = {
  open: ['~curious~ What’ll it be? Everything here runs on fragments.', '~happy~ Pick one. I’ll fit it while you wait.'],
  short: ['~neutral~ Not enough yet. Bring me a few more.', '~playful~ Close. One or two more will do it.'],
  needs: ['~curious~ Nothing to fit it to yet. Find the gear first.', '~neutral~ That one wants gear you don’t have.'],
  owned: ['~happy~ You’re wearing that one already.', '~playful~ Fitted. Twice would be greedy.'],
  finder: ['~playful~ My little box. It beeps when a fragment is near, faster the closer you get.'],
  lightheart: ['~happy~ Stitched in over your heart. One more heart, for good.'],
  lightedge: ['~curious~ Done. Your blade hits half as hard again.'],
  lightcell: ['~neutral~ Done. Your tank holds one more shot.'],
  lightwing: ['~happy~ Done. Your wings fly faster and sink slower.'],
  lightstep: ['~neutral~ Done. You’ll run longer and get your breath back quicker.'],
  lightguard: ['~surprised~ Done. Blocking costs you half what it did.'],
  // (his wares that aren't upgrades, v1.86, issue #481: src/fragment-shop.js THRUM_WARES)
  wait: ['~playful~ I haven’t written the next page yet. Bring me more first.', '~neutral~ Still writing it. A few more fragments.'],
  page: ['~playful~ There. Don’t read it while I’m watching.', '~neutral~ Another page. It’s mostly about the light.'],
  lamp: ['~happy~ My jar, made a lamp. Every one you bring makes it brighter.'],
  chart: ['~curious~ Where they ring, every one I’ve heard. Your Map has them now.'],
  tune: ['~happy~ The whole tune, as the light sang it. Ask me and I’ll play it.'],
  bye: ['~happy~ Bring me more.', '~curious~ Keep an ear out. They hum when you’re close.'],
};

/** What he calls out as you come near (his balloon). */
export const GREETING_LINES = ['~curious~ Found any more?', '~happy~ Bring me fragments. I’ll fit them to your gear.'];
const OFFER_GREETING = ['~happy~ There you are! You’ve enough for something.', '~playful~ Come here, come here. Have a look.'];

export const THRUM = {
  id: 'thrum', name: 'Anselm Thrum', title: 'who studies the singing light', color: '#8fc7d8', voice: 0.95, kind: 'm', scale: 1.0,
  tier: 'quest',   // (src/costumes.js PROMINENCE: he keeps all his colours)
  // a patched pale coat with too many pockets, goggles pushed up on his brow, a tool belt; grey curls
  palette: { cloak: '#e8e2d0', lining: '#3d5a80', cloth: '#c98b4a', legs: '#3a3448', hair: '#d6d2c8', skin: '#d9a982' },
  head: 'curls', cape: 0, world: 'incal',
  look: { head: 'curls', under: 'none', mask: 'browgoggles', body: 'toolbelt', prop: 'none', trim: 'patches', robe: 0.3, flare: 0.3, robeOpen: 0.45, robeRole: 'cloak', robeHem: 'cloak', build: 'slender', height: 1.045616391436197, mood: 'curious' },   // (a thin man, issue #402: his height the one drawn before, so his eyes and face stay his; his pale coat, open: issue #347; it was a cape)
  lines: GREETING_LINES,
};

/** What he says of the world you are in: a loose word for how much still sings here, never a number (issue #519). */
export function hereLine(w, here) {
  if (!w?.total) return null;
  const share = w.left / w.total;
  if (!w.left) return '~happy~ It’s gone quiet here. You’ve listened well.';
  if (share > 0.5) return `~curious~ ${cap(inLine(here))} still sings loud.`;
  return `~neutral~ A little singing left in ${inLine(here)}.`;
}

/**
 * His count, in his words: how many found so far, how many to spend, and a loose word for the world you are in. Never
 * how many there are, nor a list of where most are left (issue #519: "I shouldn't be able to tell how many fragments of
 * light there are in total"). `here`: the world you are in.
 */
export function tallyLines(flags = {}, here = null, has = (id) => !!flags[`item.${id}`]) {
  const c = fragmentCounts(flags), { held } = fragmentPurse(flags, has);
  const out = [`~neutral~ ${c.found ? `${cap(say(c.found))} so far.` : 'None yet.'} ${held ? `${cap(say(held))} to spend.` : 'None to spend.'}`];
  const hw = here && c.worlds[here];
  const h = hereLine(hw, here);
  if (h) out.push(h);
  // (his chart, offered once 100 are found: he says so the first time, issue #520)
  if (chartNews(flags)) out.push('~curious~ I’ve been plotting where they ring. Want it? It’s on my shelf.');
  return out;
}
/** His chart is on his shelf and he hasn't said so yet (issue #520). */
const chartNews = (flags) => !flags[CHART_FLAG] && !flags['thrum.chart.told'] && fragmentCounts(flags).found >= CHART_AFTER;
const CHART_AFTER = THRUM_WARES.find((w) => w.id === 'chart').after;

/**
 * His talk, built from the save each time it opens (src/story/scientist.js): the meeting if not had, else his count
 * and his shop ("Show me what you have": game 'shop:open' { shop: 'thrum' }, src/shop-panel.js). `here`: the world he
 * is in; `has(id)`: an item owned.
 */
export function thrumTalk(flags = {}, { here = null, has = (id) => !!flags[`item.${id}`] } = {}) {
  const nodes = {
    // ---------------------------------------------------------------- the first fragment
    meet: {
      say: [
        // (v1.61, #229: he opens in the middle of the chase, not on his name and trade; the panel names him. Since issue
        // #550 his run in is filmed, src/story/scientist-arrival.js: the talk opens on him out of breath)
        '~tired~ (Out of breath, a brass box ticking in his hand.) Don’t drop it!',
        '~happy~ A fragment of the singing light. I’ve been on the lookout for these since the night the light went over.',
        '~curious~ They turn up wherever it passed. Bits of it that broke off, I think. They settle on the landmarks: rooftops, old bones, high stones.',
        '~playful~ Bring me more. I’ll work them into your gear, at a price.',
      ],
      choices: [
        { text: '~curious~ Where will I find you?', goto: 'meet.ship' },
        { text: '~neutral~ Come aboard, then.', goto: 'meet.aboard' },
      ],
    },
    'meet.ship': {
      do: { set: { 'frag.met': true } },
      say: ['~playful~ On your ship, if you’ll have me. I’ll take the hold, among the crates. Bring them as you find them.'],
    },
    // (each answer its own reply, issue #226's quest QC: an invitation isn't answered "if you'll have me")
    'meet.aboard': {
      do: { set: { 'frag.met': true } },
      say: ['~happy~ I hoped you’d say that. I’ll take the hold, among the crates. Bring them as you find them.'],
    },
    // ---------------------------------------------------------------- aboard
    hello: {
      ...(chartNews(flags) ? { do: { set: { 'thrum.chart.told': true } } } : {}),
      say: tallyLines(flags, here, has),
      choices: [
        { text: '~curious~ Show me what you have.', do: { emit: ['shop:open', { shop: 'thrum' }] }, end: true },
        { text: '~curious~ Where do they hide?', goto: 'where' },
        // (the light's tune, bought: he plays it whole, aboard, issue #481; src/story/scientist.js plays it)
        { text: '~happy~ Play me the light’s tune.', if: { flag: 'thrum.tune' }, goto: 'tune' },
      ],
    },
    tune: {
      do: { emit: ['thrum:tune', {}] },
      say: ['~happy~ (He turns a brass key on his box, and the light’s song comes out of it, whole.)'],
    },
    where: {
      say: ['~neutral~ On the landmarks, off the main paths: a roof, a tower’s top, the middle of something old.', '~playful~ Listen, too. They hum, quietly, when you’re near one.'],
      choices: [
        { text: '~curious~ Show me what you have.', do: { emit: ['shop:open', { shop: 'thrum' }] }, end: true },
        { text: '~neutral~ I’ll keep looking.', end: true },
      ],
    },
  };
  const entry = [{ if: { not: { flag: 'frag.met' } }, node: 'meet' }, { node: 'hello' }];
  return { entry, nodes };
}

/** His first meeting, named: for the dialogue-voices test (nobody opens on their own name). */
export const THRUM_MEETING = { name: THRUM.name, talk: thrumTalk({}, { has: () => false }) };
/** His talk aboard (five found in the desert): for the tone and dialogue tests. */
export const THRUM_TALK = thrumTalk({ 'frag.met': true, ...Object.fromEntries([0, 1, 2, 3, 4].map((i) => [`frag.desert.${i}`, true])) }, { here: 'desert', has: () => false });

/** His person for the world `here` (the talk a getter: built afresh from `flags()` each time it opens). */
export function thrumPerson({ flags = () => ({}), has, here = null } = {}) {
  return {
    ...THRUM,
    get talk() { return thrumTalk(flags(), { here, has }); },
    get lines() { return affordable(flags(), has) ? OFFER_GREETING : GREETING_LINES; },
    // (his balloon: enough held for an upgrade you can have, src/story/balloons.js)
    fresh: () => !!affordable(flags(), has),
  };
}
