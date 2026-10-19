// What fills the game menu's panels (src/game-menu.js), read off the save each time a panel is drawn.
// The gear and what you carry (Items), the father's charge and the quests (Quests), how far each world you know has
// come, its relics, boxes and fragments too, and the way there (Worlds), the people met (People). (The Sketchbook's
// page, the sightings and the sketches, went in v1.62, issue #213: the journal still keeps them, src/quest.js.)
//
//   menuSources({ items, mode, quests, charge, keepsakes, journal, levels, known, current, boxes, errands, icon, titles, game, travel })
//     → { items(), quests(), map(), worlds(), people() }

import { ITEMS } from './items.js';
import { CHARGE, chargeStep } from './story/charge.js';
import { ALL_QUESTS } from './story/all-quests.js';
import { metPeople, personStory, personNow, interactions, PERSON } from './story/people-book.js';
import { backdropFor } from './story/portrait-bg.js';
import { TITLES } from './levels/names.js';

const KIND_ORDER = ['core', 'weapon', 'movement', 'mode', 'gadget', 'upgrade', 'charm', 'pass', 'cosmetic'];   // (gadget: src/gadgets/)
/** Each gun mode's item (the backpack shoots plain fluid). */
const MODE_OF = { backpack: 'shoot', stun: 'stun', fire: 'fire', bloom: 'bloom' };
const cap = (s) => String(s ?? '').replace(/^./, (c) => c.toUpperCase());

/** The gear, the backpack first: { gear, slots, pack, keepsakes, chimes (the wallet: src/resources.js) } for itemsPanel. */
export function itemsData({ owned = [], mode = null, modes = [], gadget = null, gadgets = [], carried = [], keepsakes = [], icon = () => null, titles = {}, chimes = null, toggles = {}, colours = null } = {}) {
  const list = owned.filter((id) => ITEMS[id]).sort((a, b) => KIND_ORDER.indexOf(ITEMS[a].kind) - KIND_ORDER.indexOf(ITEMS[b].kind));
  const choice = modes.length > 1;
  const gear = list.map((id) => {
    const d = ITEMS[id], m = MODE_OF[id];
    // (a gadget, src/gadgets/: in hand, or taken in hand from here)
    // (a thing you switch on and off from here: the fragment finder, `toggle`; in use while on)
    if (d.toggle) return { id, name: d.name, kind: d.kind, text: d.text, icon: icon(id), inUse: !!toggles[id], usable: true, toggle: true };
    if (d.kind === 'gadget') return { id, name: d.name, kind: d.kind, text: d.text, icon: icon(id), inUse: id === gadget, usable: gadgets.includes(id) && id !== gadget };
    return { id, name: d.name, kind: d.kind, text: d.text, icon: icon(id), inUse: choice && !!m && m === mode, usable: choice && !!m && modes.includes(m) && m !== mode };
  });
  // (a slot for every item there is to find: the empty ones are drawn, never named; not the debug jets, nor what is
  // retired, kept only for the saves that won it, unless you own it: v1.48)
  const slots = Math.max(Object.values(ITEMS).filter((d) => !d.debug && !d.retired).length, list.length);
  const pack = carried.map((name, i) => ({ id: `pack.${i}`, name: cap(name) }));
  const keeps = keepsakes.map((k) => ({ id: k.id, name: k.name, text: k.text, world: titles[k.level] ?? '' }));
  return { gear, slots, pack, keepsakes: keeps, chimes, colours };   // (colours: the kit's, src/kit-colours.js coloursData; null until a second is won)
}

/** The father's charge as a quest card: its goal (his words) and its next step. */
export function chargeCard(st) {
  if (!st?.stage) return null;
  const worlds = st.worlds >= st.of ? `${st.worlds} worlds done` : `${st.worlds} of ${st.of} worlds before home`;
  return { title: CHARGE.title, goal: CHARGE.words.replace(/\.$/, ''), step: chargeStep(st), worlds: st.stage === 'done' ? '' : worlds, done: st.stage === 'done' };
}

/** Quests: { charge, active, errands, done, failed } for questsPanel (quests: src/story/quests.js). */
export function questsData({ quests = null, charge = null, errands = {}, defs = [], titles = {}, everyQuest = ALL_QUESTS } = {}) {
  const s = quests?.summary?.() ?? { active: [], done: [], failed: [] };
  const parcels = Object.entries(errands ?? {}).filter(([, e]) => !e.done).map(([id, e]) => {
    const to = defs.find((d) => d.id === id)?.to?.[0];
    const where = (to && titles[to]) ?? e.toTitle ?? 'its world';
    return { id: `errand.${id}`, title: `Errand: ${cap(String(e.item).replace(/^an? /, ''))}`, goal: `Carry ${e.item} to ${where}`, step: `Take it to ${where}, and to whoever is waiting for it there` };
  });
  // (and what ended in other worlds: their quests are only defined while you are there, src/story/all-quests.js)
  const done = [...s.done], failed = [...s.failed], have = new Set([...done, ...failed, ...s.active].map((q) => q.id));
  for (const d of everyQuest) {
    if (have.has(d.id)) continue;
    if (quests?.isDone?.(d.id)) done.push({ id: d.id, title: d.title, outro: d.outro ?? 'Done.' });
    else if (quests?.isFailed?.(d.id)) failed.push({ id: d.id, title: d.title, outro: d.failOutro ?? 'It went wrong.' });
  }
  return { charge: chargeCard(charge), active: s.active, errands: parcels, done, failed };
}

/**
 * Worlds: the worlds you know, in the route's order (`order`), with what is done in each. `travel(id)`: the ship can
 * take you there from the Worlds page (a world you have been to, not this one: main.js, v1.62, issue #213).
 */
export function worldsData({ data = {}, levels = [], order = [], known = () => true, current = null, boxes = {}, done = () => false, fragments = null, people = () => [], travel = () => false } = {}) {
  const byId = Object.fromEntries(levels.map((L) => [L.id, L]));
  const ids = [...order.filter((id) => byId[id] && known(id)), ...(current && byId[current] && !order.includes(current) && !byId[current].hidden ? [current] : [])];
  const list = ids.map((id, i) => {
    const L = byId[id], b = boxes[id];
    return { id, n: i + 1, title: L.title, thumb: `thumbs/${id}.jpg`, current: id === current, told: !!(data.stories?.[id] || done(id)),
      relics: [Object.keys(data.relics?.[id] ?? {}).length, (L.relicNames ?? []).length], boxes: b?.total ? [b.found, b.total] : null, blurb: L.blurb ?? '',
      // (its full view, issue #213: the relics by name once found, a ? for the rest; the people met there)
      relicList: (L.relicNames ?? []).map((name, k) => ({ name, found: !!data.relics?.[id]?.[k] })), people: people(id) ?? [],
      travel: id !== current && !!travel(id),
      // (the fragments of the singing light found here and how many are left, once the first is found: src/fragments.js)
      fragments: fragments?.found && fragments.worlds?.[id]?.total ? [fragments.worlds[id].found, fragments.worlds[id].total] : null };
  });
  // (and all told, the worlds you don't know yet too: worldsPanel's line over the cards)
  if (fragments) Object.defineProperty(list, 'fragmentsAll', { value: { found: fragments.found, total: fragments.total } });
  return list;
}

/**
 * People (src/story/people-book.js): the cards of everyone met (`flags` met.<id>), grouped by world in the
 * route's order, and with `open` (a person's id) that person's page: the parts of their story heard, where they
 * are now, what passed between you (`errands`: the journal's; `keepsakes`: game.keepsakes()), and the people
 * before and after them for ← →. `portrait(id)` → { src, background } | null (src/portrait-cache.js).
 */
export function peopleData({ flags = {}, errands = {}, keepsakes = [], titles = {}, portrait = () => null, open = null } = {}) {
  const title = (w) => titles[w] ?? TITLES[w] ?? w;
  const groups = metPeople(flags).map((g) => ({ world: g.world, title: title(g.world), people: g.people.map((p) => ({
    id: p.id, name: p.name, role: p.role, world: g.world, worldTitle: title(g.world), portrait: portrait(p.id) ?? null, color: backdropFor({}, g.world), now: personNow(p, flags),
  })) }));
  const all = groups.flatMap((g) => g.people);
  const i = open ? all.findIndex((p) => p.id === open) : -1;
  let person = null;
  if (i >= 0) {
    const p = PERSON.get(open), card = all[i];
    person = { ...card, story: personStory(p, flags), ...interactions(p, { flags, errands, keepsakes }),
      prevId: all[i - 1]?.id ?? null, prev: all[i - 1]?.name ?? null, nextId: all[i + 1]?.id ?? null, next: all[i + 1]?.name ?? null };
  }
  return { groups, person };
}

/** The panels' sources, from the running game's parts (main.js). */
export function menuSources(o) {
  const titles = o.titles ?? Object.fromEntries((o.levels ?? []).map((L) => [L.id, L.title]));
  return {
    people: (open = null) => peopleData({ flags: o.game?.data?.flags ?? {}, errands: o.journal?.data?.errands ?? {}, keepsakes: o.game?.keepsakes?.() ?? [], titles, portrait: o.portrait ?? (() => null), open }),
    items: () => itemsData({ owned: o.items.owned(), ...(o.mode?.() ?? {}), carried: o.quests?.carried?.() ?? [], keepsakes: o.keepsakes?.() ?? [], icon: o.icon, titles, chimes: o.wallet?.() ?? null, toggles: o.toggles?.() ?? {}, colours: o.colours?.() ?? null }),
    quests: () => questsData({ quests: o.quests, charge: o.charge?.(), errands: o.journal?.data?.errands, defs: o.errandDefs ?? [], titles }),
    worlds: () => {
      const met = Object.fromEntries(metPeople(o.game?.data?.flags ?? {}).map((g) => [g.world, g.people.map((p) => p.name)]));
      return worldsData({ data: o.journal?.data ?? {}, levels: o.levels ?? [], order: o.order ?? [], known: o.known ?? (() => true), current: o.current, boxes: o.boxes?.() ?? {}, done: o.done ?? (() => false), fragments: o.fragments?.() ?? null, people: (id) => met[id] ?? [], travel: o.travel ?? (() => false) });
    },
    // (the world you are in, from above: main.js draws it, src/world-map.js)
    map: (arg) => o.map?.(arg) ?? null,
    // (inside a makers' house: its map's view, src/house-map.js houseView; null outside one: issue #405, #487)
    house: () => o.house?.() ?? null,
  };
}
