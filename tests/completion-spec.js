// What finishing Hiraeth takes (issue #670), derived from the game's own data, never copied by hand:
//
//   - the route (src/levels/names.js ORDER, partsOf) and how far into it each world is charted
//     (src/story/route.js knownWorlds, evaluated, not re-implemented);
//   - each world's temples (src/temples/index.js templesIn), each temple's gadget, its guardian, and the items
//     its rooms ask for (the logic's `needs`), with where each of those items is first had on the route
//     (src/boxes/placements.js PLACEMENTS, src/items.js `with`);
//   - the ship's core gadgets, which it will not leave a world without (src/story/leave-gate.js CORE);
//   - the ending's chain of conditions (src/story/ending.js), as the game evaluates them.
//
// `problems` lists what the data itself says can't be done in route order (a temple asking for an item that is
// only had later, an item nothing gives, a world the chart never shows). tests/completion.test.js asserts it is
// empty and that every requirement here is covered by a play-through; `node scripts/completion-spec.mjs` prints it.
// docs/systems/testing.md, "Completion coverage".

import { ORDER, partsOf, worldFor } from '../src/levels/names.js';
import { knownWorlds, AHEAD } from '../src/story/route.js';
import { TEMPLES, templesIn, templeWorld } from '../src/temples/index.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { ITEMS } from '../src/items.js';
import { CORE } from '../src/story/leave-gate.js';
import { ENDING_WORLDS, FINALE_ID, FINALE_AFTER, HOME_ID, homeOpen, finaleOpen, finalDue, homecomingKind } from '../src/story/ending.js';

/** The route world a part (an old world id) is played in now. */
const routeWorld = (part) => { const w = worldFor(part, null); return ORDER.includes(w) ? w : null; };

/** item → [{ world, part, box, temple }] for every makers' box that holds it (and what comes with it). */
export function itemSources() {
  const out = {};
  const add = (item, src) => { (out[item] ??= []).push(src); for (const w of ITEMS[item]?.with ?? []) add(w, { ...src, with: item }); };
  for (const [part, boxes] of Object.entries(PLACEMENTS)) {
    const world = routeWorld(part);
    if (!world) continue;
    // (the temple whose chest it is: by its gadget box, else the part's own temple for a box `temple` marks)
    for (const b of boxes) add(b.item, { world, part, box: b.id, temple: Object.keys(TEMPLES).find((t) => TEMPLES[t].def.gadgetBox === b.id) ?? (b.temple && TEMPLES[part] ? part : null) });
  }
  return out;
}

/** The fewest worlds done, in route order, before `id` is on the chart (knownWorlds itself decides). */
export function chartedAfter(id, order = ORDER) {
  for (let k = 0; k <= order.length; k++) {
    const done = new Set(order.slice(0, k));
    if (knownWorlds({ order, done: (w) => done.has(w) }).includes(id)) return k;
  }
  return null;
}

/** The ending's conditions in the order a player meets them, each checked against the game's own predicates. */
export function endingChain() {
  const first = ORDER.slice(0, ENDING_WORLDS);
  const flags = (o) => (k) => o[k];
  const steps = [
    { step: 'home charted', needs: `any ${ENDING_WORLDS} worlds done and the reel's "come home" heard (calls.home)`,
      holds: homeOpen({ flag: flags({ 'calls.home': true }), completed: first }) && !homeOpen({ flag: flags({ 'calls.home': true }), completed: first.slice(1) }) && !homeOpen({ flag: flags({}), completed: first }) },
    { step: 'first homecoming', sets: 'ending.done', holds: homecomingKind(flags({})) === 'first' },
    { step: 'the Lantern charted', needs: `ending.done and the ${FINALE_AFTER} heard (world.${FINALE_AFTER}.done or its broadcast)`,
      holds: finaleOpen({ flag: flags({ 'ending.done': true, [`world.${FINALE_AFTER}.done`]: true }) }) && !finaleOpen({ flag: flags({ 'ending.done': true }) }) && !finaleOpen({ flag: flags({ [`world.${FINALE_AFTER}.done`]: true }) }) },
    { step: `Ilen found at the ${FINALE_ID}`, sets: 'finale.met' },
    { step: 'the true ending', needs: 'finale.met, flown home', sets: 'ending.final',
      holds: finalDue(flags({ 'finale.met': true })) && homecomingKind(flags({ 'ending.done': true, 'finale.met': true })) === 'final' && homecomingKind(flags({ 'ending.done': true, 'ending.final': true, 'finale.met': true })) === null },
  ];
  return { home: HOME_ID, finale: FINALE_ID, finaleAfter: FINALE_AFTER, endingWorlds: ENDING_WORLDS, final: 'ending.final', steps };
}

/** The whole specification: { order, worlds, items, ending, minimum, problems }. */
export function completionSpec() {
  const sources = itemSources(), problems = [];
  const at = (w) => ORDER.indexOf(w);
  const firstHad = (item) => (sources[item] ?? []).reduce((a, s) => (a == null || at(s.world) < at(a.world) ? s : a), null);
  const worlds = ORDER.map((id, index) => {
    const charted = chartedAfter(id);
    if (charted == null) problems.push(`${id}: never on the chart, whatever is done`);
    const temples = templesIn(id).map((t) => {
      const def = TEMPLES[t].def, els = Object.entries(def.logic.elements);
      const needs = [...new Set(els.flatMap(([, e]) => e.needs ?? []))].sort();
      const needsFrom = Object.fromEntries(needs.map((item) => {
        const s = firstHad(item);
        if (!s) problems.push(`${def.name} (${t}, ${id}) needs ${item}, which no box on the route holds`);
        else if (at(s.world) > index) problems.push(`${def.name} (${t}, ${id}) needs ${item}, first had in ${s.world}, later on the route`);
        return [item, s ? (s.temple ? `${s.world} (${TEMPLES[s.temple]?.def.name ?? s.temple})` : s.world) : null];
      }));
      return { id: t, name: def.name, gadget: def.gadget, guardian: els.some(([, e]) => e.type === 'boss'), elements: els.length, needs, needsFrom, doneFlag: `temple.${t}.done` };
    });
    const core = (CORE[id] ?? []).map((c) => c.item);
    for (const item of core) if (!(sources[item] ?? []).some((s) => s.world === id)) problems.push(`${id}: core gadget ${item} has no box in ${id}`);
    return { id, index, parts: partsOf(id), doneFlag: `world.${id}.done`, chartedAfter: charted, temples, core };
  });
  for (const t of Object.keys(TEMPLES)) if (!ORDER.includes(templeWorld(t))) problems.push(`temple ${t} stands in ${templeWorld(t)}, off the route`);
  const ending = endingChain();
  for (const s of ending.steps) if (s.holds === false) problems.push(`the ending's "${s.step}" does not hold as ${s.needs ?? s.sets}`);
  // the fewest worlds done for the true ending: the market must be on the chart and done, and ENDING_WORLDS done for home
  const market = worlds.find((w) => w.id === FINALE_AFTER);
  const minimum = { worlds: Math.max(ENDING_WORLDS, (market?.chartedAfter ?? ORDER.length) + 1), why: `home needs ${ENDING_WORLDS} worlds done; the ${FINALE_AFTER} is charted after ${market?.chartedAfter} done in route order (AHEAD ${AHEAD}), and must be heard` };
  const items = Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, v.map((s) => s.world)]));
  return { order: [...ORDER], ahead: AHEAD, worlds, items, ending, minimum, problems };
}

/** The spec as a short Markdown report (scripts/completion-spec.mjs). */
export function specMarkdown(spec = completionSpec()) {
  const L = [`# What finishing Hiraeth takes (derived; node scripts/completion-spec.mjs)`, '',
    `Route: ${spec.order.join(' → ')}. The chart shows the next ${spec.ahead} unfinished worlds.`,
    `Fewest worlds done for the true ending: ${spec.minimum.worlds} (${spec.minimum.why}).`, '',
    '| # | world | charted after | core gadgets | temple | gadget | guardian | needs (first had in) |', '|---|---|---|---|---|---|---|---|'];
  for (const w of spec.worlds) {
    const ts = w.temples.length ? w.temples : [null];
    ts.forEach((t, i) => L.push(`| ${i ? '' : w.index + 1} | ${i ? '' : w.id} | ${i ? '' : w.chartedAfter} | ${i ? '' : w.core.join(', ')} | ${t ? `${t.name} (${t.id})` : '—'} | ${t?.gadget ?? ''} | ${t ? (t.guardian ? 'yes' : 'no') : ''} | ${t ? t.needs.map((n) => `${n} (${t.needsFrom[n]})`).join(', ') : ''} |`));
  }
  L.push('', 'Ending:', ...spec.ending.steps.map((s, i) => `${i + 1}. ${s.step}${s.needs ? `: needs ${s.needs}` : ''}${s.sets ? ` → ${s.sets}` : ''}`), `Completion: \`${spec.ending.final}\`.`, '');
  L.push(spec.problems.length ? `Problems:\n${spec.problems.map((p) => `- ${p}`).join('\n')}` : 'Problems: none.');
  return L.join('\n');
}
