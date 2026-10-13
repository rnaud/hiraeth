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

import { fragmentCounts } from '../fragments-data.js';
import { fragmentPurse, affordable } from '../fragment-shop.js';
import { TITLES } from '../levels/names.js';

const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const say = (n) => (n <= 10 ? NUM[n] : String(n));
const cap = (s) => s.replace(/^./, (c) => c.toUpperCase());
/** A world's title inside a sentence (“in the Desert”). */
const inLine = (id) => (TITLES[id] ?? id).replace(/^The /, 'the ');

/**
 * His shop's lines (src/shop-panel.js keeperLine, as the keepers' SHOP_LINES): on opening, too dear, its gear not had
 * yet, fitted already, each upgrade as he fits it, and his goodbye.
 */
export const THRUM_SHOP_LINES = {
  open: ['~curious~ What’ll it be? Everything here runs on fragments.', '~happy~ Pick one. I’ll fit it while you wait.'],
  short: ['~neutral~ Not enough yet. Bring me a few more.', '~playful~ Close. Go and listen for them.'],
  needs: ['~curious~ Nothing to fit it to yet. Find the gear first.', '~neutral~ That one wants gear you don’t have.'],
  owned: ['~happy~ You’re wearing that one already.', '~playful~ Fitted. Twice would be greedy.'],
  finder: ['~playful~ My little box. It beeps when one is near, faster the closer you are.'],
  lightheart: ['~happy~ Stitched in, over your heart. One more, for good.'],
  lightedge: ['~curious~ Tempered. It’ll cut half as hard again.'],
  lightcell: ['~solemn~ Ground fine, a chamber for your tank. One more shot.'],
  lightwing: ['~happy~ Threaded through the veins. Faster in the air, slower to sink.'],
  lightstep: ['~neutral~ Set in your heels. You’ll run longer and rest quicker.'],
  lightguard: ['~surprised~ Round the rim. A block costs half now.'],
  bye: ['~happy~ Bring me more.', '~curious~ Listen for them. They sing.'],
};

/** What he calls out as you come near (his balloon). */
export const GREETING_LINES = ['~curious~ Any more out there?', '~happy~ The hold hums when you bring one aboard.'];
const OFFER_GREETING = ['~happy~ There you are! You’ve enough for something.', '~playful~ Come here, come here. Have a look.'];

export const THRUM = {
  id: 'thrum', name: 'Anselm Thrum', title: 'who studies the singing light', color: '#8fc7d8', voice: 0.95, kind: 'm', scale: 1.0,
  tier: 'quest',   // (src/costumes.js PROMINENCE: he keeps all his colours)
  // a patched pale coat with too many pockets, goggles pushed up on his brow, a tool belt; grey curls
  palette: { cloak: '#e8e2d0', lining: '#3d5a80', cloth: '#c98b4a', legs: '#3a3448', hair: '#d6d2c8', skin: '#d9a982' },
  head: 'curls', cape: 0.9, world: 'incal',
  look: { head: 'curls', under: 'none', mask: 'browgoggles', body: 'toolbelt', prop: 'none', trim: 'patches', robe: 0.06, mood: 'curious' },
  lines: GREETING_LINES,
};

/** His count, in his words: how many found, how many to spend, and where most still hide (`here`: the world you are in). */
export function tallyLines(flags = {}, here = null, has = (id) => !!flags[`item.${id}`]) {
  const c = fragmentCounts(flags), { held } = fragmentPurse(flags, has);
  const out = [`~neutral~ ${cap(say(c.found))} of ${c.total}${c.found >= c.total ? ', every one there is' : ''}. ${held ? `${cap(say(held))} to spend.` : 'None to spend.'}`];
  const left = Object.entries(c.worlds).filter(([, w]) => w.left > 0);
  const hw = here && c.worlds[here];
  if (hw) out.push(hw.left ? `~curious~ ${cap(say(hw.left))} still hide${hw.left === 1 ? 's' : ''} here, in ${inLine(here)}.` : `~happy~ None left here, in ${inLine(here)}. You’ve had them all.`);
  const most = left.filter(([id]) => id !== here).sort((a, b) => b[1].left - a[1].left).slice(0, 3);
  if (most.length) out.push(`~neutral~ Most left: ${most.map(([id, w]) => `${inLine(id)}, ${w.left}`).join('; ')}.`);
  return out;
}

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
        // (v1.61, #229: he opens in the middle of the chase, not on his name and trade; the panel names him)
        '~surprised~ (A thin man in a patched coat comes at a run, goggles on his brow, a brass box ticking in his hand.) Don’t drop it!',
        '~happy~ A fragment of the singing light. I’ve been on the lookout for these since the night the light went over.',
        '~curious~ Where it passed, it shed splinters of its song. They hide where nobody goes.',
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
      say: tallyLines(flags, here, has),
      choices: [
        { text: '~curious~ Show me what you have.', do: { emit: ['shop:open', { shop: 'thrum' }] }, end: true },
        { text: '~curious~ Where do they hide?', goto: 'where' },
      ],
    },
    where: {
      say: ['~whisper~ Up high. Behind things. At the ends of paths. Never where anyone sends you.', '~playful~ Listen, too. They sing, very quietly.'],
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
