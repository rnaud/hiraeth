// What fills the game menu's panels (src/game-menu.js), read off the save each time a panel is drawn.
// Everything the sketchbook held is here: the gear and what you carry (Items), the father's charge and
// the quests (Quests), the sightings, the story pages, relics, errands and the observatory's sketch (Sketchbook), and
// how far each world you know has come, its boxes too (Worlds).
//
//   menuSources({ items, mode, quests, charge, keepsakes, journal, levels, known, current, boxes, errands, icon, titles, game })
//     → { items(), quests(), sketches(), worlds() }

import { ITEMS } from './items.js';
import { CHARGE, chargeStep } from './story/charge.js';
import { ALL_QUESTS } from './story/all-quests.js';
import { sightingsData } from './story/sightings.js';

const KIND_ORDER = ['core', 'movement', 'mode', 'gadget', 'upgrade', 'charm', 'pass', 'cosmetic'];   // (gadget: src/gadgets/)
/** Each gun mode's item (the backpack shoots plain fluid). */
const MODE_OF = { backpack: 'shoot', stun: 'stun', fire: 'fire', bloom: 'bloom' };
const cap = (s) => String(s ?? '').replace(/^./, (c) => c.toUpperCase());

/** The gear, the backpack first: { gear, slots, pack, keepsakes } for itemsPanel. */
export function itemsData({ owned = [], mode = null, modes = [], gadget = null, gadgets = [], carried = [], keepsakes = [], icon = () => null, titles = {} } = {}) {
  const list = owned.filter((id) => ITEMS[id]).sort((a, b) => KIND_ORDER.indexOf(ITEMS[a].kind) - KIND_ORDER.indexOf(ITEMS[b].kind));
  const choice = modes.length > 1;
  const gear = list.map((id) => {
    const d = ITEMS[id], m = MODE_OF[id];
    // (a gadget, src/gadgets/: in hand, or taken in hand from here)
    if (d.kind === 'gadget') return { id, name: d.name, kind: d.kind, text: d.text, use: d.use, icon: icon(id), inUse: id === gadget, usable: gadgets.includes(id) && id !== gadget };
    return { id, name: d.name, kind: d.kind, text: d.text, use: d.use, icon: icon(id), inUse: choice && !!m && m === mode, usable: choice && !!m && modes.includes(m) && m !== mode };
  });
  // (a slot for every item there is to find: the empty ones are drawn, never named)
  const slots = Object.keys(ITEMS).length;
  const pack = carried.map((name, i) => ({ id: `pack.${i}`, name: cap(name) }));
  const keeps = keepsakes.map((k) => ({ id: k.id, name: k.name, text: k.text, world: titles[k.level] ?? '' }));
  return { gear, slots, pack, keepsakes: keeps };
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
 * Sketchbook: the Sightings page (`sightings`: src/story/sightings.js sightingsData, or null), a row for
 * each world you know (`levels` [{ id, title, hidden, relicNames, storyTitle }], `known(id)`), then the
 * observatory's sketch and the errands' (journal.data).
 */
export function sketchesData({ data = {}, levels = [], known = () => true, sightings = null } = {}) {
  const worlds = levels.filter((L) => (!L.hidden || data.completed) && known(L.id)).map((L) => {
    const relics = (L.relicNames ?? []).map((name, i) => ({ name, img: data.relics?.[L.id]?.[i]?.img ?? null }));
    const st = data.stories?.[L.id];
    return { id: L.id, title: L.title, story: { title: L.storyTitle ?? L.title, img: st?.img || null, told: !!st }, relics, found: relics.filter((r) => r.img).length, of: relics.length };
  });
  const extra = [];
  const obs = data.observatory;
  if (obs?.started) extra.push({ id: 'observatory', title: 'The Sleeping Observatory', wide: true, tiles: [{ name: obs.done ? 'The stars remember' : 'The sleeping observatory', img: obs.img || null,
    caption: obs.done ? (obs.fragments ?? []).join(' ') || 'The roof unfolded, and the observatory drew its stars.' : 'East of camp: climb the six ledges, turn the lenses toward the centre.' }] });
  const errs = Object.entries(data.errands ?? {});
  if (errs.length) extra.push({ id: 'errands', title: 'Errands', count: `${errs.filter(([, e]) => e.done).length}/${errs.length}`, tiles: errs.map(([, e]) => ({ name: `${cap(e.item)}${e.done ? ', delivered' : ''}`, img: e.done ? e.img || null : null, caption: e.done ? `Delivered to ${e.toTitle}.` : `Still to carry to ${e.toTitle}.` })) });
  return { sightings, worlds, extra };
}

/** Worlds: the worlds you know, in the route's order (`order`), with what is done in each. */
export function worldsData({ data = {}, levels = [], order = [], known = () => true, current = null, boxes = {}, done = () => false } = {}) {
  const byId = Object.fromEntries(levels.map((L) => [L.id, L]));
  const ids = [...order.filter((id) => byId[id] && known(id)), ...(current && byId[current] && !order.includes(current) && !byId[current].hidden ? [current] : [])];
  return ids.map((id, i) => {
    const L = byId[id], b = boxes[id];
    return { id, n: i + 1, title: L.title, thumb: `thumbs/${id}.jpg`, current: id === current, told: !!(data.stories?.[id] || done(id)),
      relics: [Object.keys(data.relics?.[id] ?? {}).length, (L.relicNames ?? []).length], boxes: b?.total ? [b.found, b.total] : null, blurb: L.blurb ?? '' };
  });
}

/** The four panels' sources, from the running game's parts (main.js). */
export function menuSources(o) {
  const titles = o.titles ?? Object.fromEntries((o.levels ?? []).map((L) => [L.id, L.title]));
  return {
    items: () => itemsData({ owned: o.items.owned(), ...(o.mode?.() ?? {}), carried: o.quests?.carried?.() ?? [], keepsakes: o.keepsakes?.() ?? [], icon: o.icon, titles }),
    quests: () => questsData({ quests: o.quests, charge: o.charge?.(), errands: o.journal?.data?.errands, defs: o.errandDefs ?? [], titles }),
    sketches: () => sketchesData({ data: o.journal?.data ?? {}, levels: o.levels ?? [], known: o.known ?? (() => true),
      sightings: o.game ? sightingsData({ game: o.game, known: o.known ?? (() => true), titles }) : null }),
    worlds: () => worldsData({ data: o.journal?.data ?? {}, levels: o.levels ?? [], order: o.order ?? [], known: o.known ?? (() => true), current: o.current, boxes: o.boxes?.() ?? {}, done: o.done ?? (() => false) }),
  };
}
