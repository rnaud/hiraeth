// The scientist as data: Anselm Thrum, who studies light (docs/systems/fragments.md, issue #196; named Orrin until v1.61,
// #229: the father's neighbours are the Orrins). His story: docs/story-bible.md, "The fragments of the singing light".
//
// He has been on the lookout for the fragments of the singing light since the night the light went over: where it passed it
// shed splinters of its song, and they hid where nobody goes. The first one the traveller picks up, he is there (he
// had been following its song with his ticking box); he says so in a few words and asks to come aboard. From then on
// he lives in the ship's hold among the crates (src/story/scientist.js ABOARD), counts what you bring him, and at
// each milestone (src/items.js `fragments`: 5, 10, 15, 25, 50, 75, all) offers to fit one to your gear.
//
// Flags: frag.met (the first meeting had), frag.<world>.<i> (src/fragments-data.js), frag.finder.off; met.thrum,
// talks.thrum (the panel's). Items: src/items.js FRAGMENT_ITEMS.

import { fragmentCounts } from '../fragments-data.js';
import { ITEMS, FRAGMENT_ITEMS, items as sharedItems } from '../items.js';
import { TITLES } from '../levels/names.js';

const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const say = (n) => (n <= 10 ? NUM[n] : String(n));
const cap = (s) => s.replace(/^./, (c) => c.toUpperCase());
/** A world's title inside a sentence (“in the Desert”). */
const inLine = (id) => (TITLES[id] ?? id).replace(/^The /, 'the ');

/** What he says as he fits each, by item (his offer: one line). */
export const OFFER_LINES = {
  lightheart: '~happy~ Five! Enough to stitch into your coat, over your heart. One more heart, for good.',
  finder: '~playful~ Ten. I built you a little box from my own: it beeps when one is near, faster the closer you are.',
  lightedge: '~curious~ Fifteen. Let me temper your blade with them. It’ll cut half as hard again.',
  lightcell: '~solemn~ Twenty-five. Ground fine, they make a chamber for your tank. One more shot before it runs dry.',
  lightwing: '~happy~ Fifty! I can thread them through your wings’ veins. Faster in the air, slower to sink.',
  lightstep: '~neutral~ Seventy-five. Set in your boot heels, they carry you. You’ll run longer and rest quicker.',
  lightguard: '~surprised~ All of them. Every last one. Let me ring your guard with them: a block costs half.',
};

/** What he calls out as you come near (his balloon). */
export const GREETING_LINES = ['~curious~ Any more out there?', '~happy~ The hold hums when you bring one aboard.'];
const OFFER_GREETING = ['~happy~ There you are! I’ve something for you.', '~playful~ Come here, come here. It’s ready.'];

export const THRUM = {
  id: 'thrum', name: 'Anselm Thrum', title: 'who studies the singing light', color: '#8fc7d8', voice: 0.95, kind: 'm', scale: 1.0,
  tier: 'quest',   // (src/costumes.js PROMINENCE: he keeps all his colours)
  // a patched pale coat with too many pockets, goggles pushed up on his brow, a tool belt; grey curls
  palette: { cloak: '#e8e2d0', lining: '#3d5a80', cloth: '#c98b4a', legs: '#3a3448', hair: '#d6d2c8', skin: '#d9a982' },
  head: 'curls', cape: 0.9, world: 'incal',
  look: { head: 'curls', under: 'none', mask: 'browgoggles', body: 'toolbelt', prop: 'none', trim: 'patches', robe: 0.06, mood: 'curious' },
  lines: GREETING_LINES,
};

/**
 * The offer waiting, if any: the first of FRAGMENT_ITEMS the count has reached, not yet fitted, whose gear you have.
 * `has(id)`: an item owned.
 */
export function pendingOffer(flags = {}, has = (id) => !!flags[`item.${id}`]) {
  const { found } = fragmentCounts(flags);
  return FRAGMENT_ITEMS.find((u) => found >= u.at && !has(u.id) && (!ITEMS[u.id].needs || has(ITEMS[u.id].needs)))?.id ?? null;
}

/** The next milestone past the count, or null when every one is reached. */
export function nextMilestone(found) { return FRAGMENT_ITEMS.find((u) => u.at > found)?.at ?? null; }

/** His count, in his words: how many, the next milestone, and where most still hide (`here`: the world you are in). */
export function tallyLines(flags = {}, here = null) {
  const c = fragmentCounts(flags), next = nextMilestone(c.found);
  const out = [`~neutral~ ${cap(say(c.found))} of ${c.total}.${next ? ` ${cap(say(next - c.found))} more and I’ll have something for you.` : ' That’s every one there is.'}`];
  const left = Object.entries(c.worlds).filter(([, w]) => w.left > 0);
  const hw = here && c.worlds[here];
  if (hw) out.push(hw.left ? `~curious~ ${cap(say(hw.left))} still hide${hw.left === 1 ? 's' : ''} here, in ${inLine(here)}.` : `~happy~ None left here, in ${inLine(here)}. You’ve had them all.`);
  const most = left.filter(([id]) => id !== here).sort((a, b) => b[1].left - a[1].left).slice(0, 3);
  if (most.length) out.push(`~neutral~ Most left: ${most.map(([id, w]) => `${inLine(id)}, ${w.left}`).join('; ')}.`);
  return out;
}

/**
 * His talk, built from the save each time it opens (src/story/scientist.js): the meeting if not had, else an offer
 * waiting, else his count. `here`: the world he is in; `onFit(id)`: an upgrade fitted (the toast, the hearts).
 */
export function thrumTalk(flags = {}, { here = null, has, items = sharedItems, onFit = null } = {}) {
  const offer = pendingOffer(flags, has);
  const nodes = {
    // ---------------------------------------------------------------- the first fragment
    meet: {
      say: [
        // (v1.61, #229: he opens in the middle of the chase, not on his name and trade; the panel names him)
        '~surprised~ (A thin man in a patched coat comes at a run, goggles on his brow, a brass box ticking in his hand.) Don’t drop it!',
        '~happy~ A fragment of the singing light. I’ve been on the lookout for these since the night the light went over.',
        '~curious~ Where it passed, it shed splinters of its song. They hide where nobody goes.',
        '~neutral~ Find more and I’ll work them into your gear. Five, and I’ll have something.',
      ],
      choices: [
        { text: '~curious~ Where will I find you?', goto: 'meet.ship' },
        { text: '~neutral~ Come aboard, then.', goto: 'meet.ship' },
      ],
    },
    'meet.ship': {
      do: { set: { 'frag.met': true } },
      say: ['~playful~ On your ship, if you’ll have me. I’ll take the hold, among the crates. Bring them as you find them.'],
    },
    // ---------------------------------------------------------------- aboard
    hello: {
      say: tallyLines(flags, here),
      choices: [
        { text: '~curious~ Where do they hide?', goto: 'where' },
        { text: '~neutral~ I’ll keep looking.', end: true },
      ],
    },
    where: { say: ['~whisper~ Up high. Behind things. At the ends of paths. Never where anyone sends you.', '~playful~ Listen, too. They sing, very quietly.'] },
  };
  if (offer) {
    nodes.offer = {
      say: [OFFER_LINES[offer]],
      choices: [
        { text: '~happy~ Fit it.', do: () => { if (items.grant(offer)) onFit?.(offer); }, goto: 'fitted' },
        { text: '~neutral~ Not now.', goto: 'later' },
      ],
    };
    nodes.fitted = { say: [`~playful~ There. ${ITEMS[offer].name}. Try not to lose it.`, ...tallyLines(flags, here).slice(0, 1)] };
    nodes.later = { say: ['~neutral~ It’ll keep. So will I.'] };
  }
  const entry = [{ if: { not: { flag: 'frag.met' } }, node: 'meet' }, ...(offer ? [{ node: 'offer' }] : []), { node: 'hello' }];
  return { entry, nodes };
}

/** His first meeting, named: for the dialogue-voices test (nobody opens on their own name). */
export const THRUM_MEETING = { name: THRUM.name, talk: thrumTalk({}, { has: () => false }) };
/** His talk as it reads with an offer waiting (five found in the desert): for the tone and dialogue tests. */
export const THRUM_TALK = thrumTalk({ 'frag.met': true, ...Object.fromEntries([0, 1, 2, 3, 4].map((i) => [`frag.desert.${i}`, true])) }, { here: 'desert', has: () => false });

/** His person for the world `here` (the talk a getter: built afresh from `flags()` each time it opens). */
export function thrumPerson({ flags = () => ({}), has, here = null, items = sharedItems, onFit = null } = {}) {
  return {
    ...THRUM,
    get talk() { return thrumTalk(flags(), { here, has, items, onFit }); },
    get lines() { return pendingOffer(flags(), has) ? OFFER_GREETING : GREETING_LINES; },
    // (his balloon: an offer waiting, src/story/balloons.js)
    fresh: () => !!pendingOffer(flags(), has),
  };
}
