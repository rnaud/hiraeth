// The lore page's data (lore.html, src/lore-page/, docs/systems/lore-page.md), read from the game's own modules in
// node at build time so the page stays in step with the game: the route (src/levels/names.js ORDER), each world's
// page and blurb (src/levels/content.js, src/levels/index.js), its people (src/story/people-book.js), its temples,
// their guardians and phases (src/temples/), and the items with where they are found (src/items.js, the gadgets,
// src/boxes/placements.js). The few words the data cannot say are src/lore-page/lore-text.js.
//
// The page imports it as `virtual:hiraeth-lore` (lorePlugin, vite.config.js): JSON, so the page loads none of the
// game. A dev server reads the modules once; restart it to see a change to them.
//
//   node scripts/lore-data.mjs        prints a summary of what the page will show
import { existsSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SRC = new URL('../src/', import.meta.url);
const mod = (path) => import(new URL(path, SRC).href);

/** Every gadget registered as an item (src/gadgets/all.js does it through Vite's import.meta.glob, which node lacks). */
async function registerGadgets() {
  const { registerGadget, GADGETS } = await mod('gadgets/registry.js');
  const dir = new URL('gadgets/', SRC);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'all.js').sort()) {
    const m = await import(new URL(f, dir).href);
    if (m.default?.id && typeof m.default.create === 'function') registerGadget(m.default);
  }
  return GADGETS;
}
/** An item's picture (public/item-pictures/, scripts/item-pictures.mjs), or null if it has none yet. */
const itemPicture = (id) => (existsSync(new URL(`../public/item-pictures/${id}.webp`, import.meta.url)) ? `item-pictures/${id}.webp` : null);

/** A part of a person's story in the people book: 'text', or [cond, 'text']. */
const partText = (part) => (Array.isArray(part) ? part[1] : part);
/** A temple module's guardian: its export with a name and phases. */
const guardianOf = (m) => Object.values(m).find((v) => v && typeof v === 'object' && Array.isArray(v.phases) && typeof v.name === 'string');

/** The whole page's data, plain JSON. */
export async function buildLore() {
  const glyphs = Object.fromEntries((await registerGadgets()).map((g) => [g.id, g.glyph ?? '']));
  const [{ ORDER, TITLES, partsOf }, { CONTENT }, { LEVELS }, { bookOf }, temples, { ITEMS }, { PLACEMENTS, FALLBACKS }, { whereFound }, text, { lorePicture }] = await Promise.all([
    mod('levels/names.js'), mod('levels/content.js'), mod('levels/index.js'), mod('story/people-book.js'), mod('temples/index.js'),
    mod('items.js'), mod('boxes/placements.js'), mod('items-page/view.js'), mod('lore-page/lore-text.js'), mod('lore-page/pictures.js'),
  ]);
  const { TEMPLES, GADGETS, templesIn } = temples;
  const item = (id) => ({ id, name: ITEMS[id]?.name ?? id, kind: ITEMS[id]?.kind ?? '', text: ITEMS[id]?.text ?? '', picture: itemPicture(id), glyph: glyphs[id] ?? '' });
  const templeOfGadget = {};
  const worlds = [];
  for (const id of ORDER) {
    const level = LEVELS.find((l) => l.id === id);
    const page = CONTENT[id]?.story ?? {};
    const templeList = [];
    const parts = partsOf(id);
    for (const t of templesIn(id).sort((a, b) => parts.indexOf(a) - parts.indexOf(b))) {
      const { def, words } = TEMPLES[t];
      const g = guardianOf(await mod(`temples/${t}.js`));
      const local = words.PEOPLE?.[def.local?.person] ?? Object.values(words.PEOPLE ?? {})[0];
      templeOfGadget[def.gadget] = { world: id, temple: t, name: def.name, guardian: g?.name ?? '' };
      templeList.push({
        id: t, name: def.name, part: parts.length > 1 ? (TITLES[t] ?? t) : "",
        quest: { title: words.QUEST?.title ?? def.name, outro: words.QUEST?.outro ?? '' },
        enter: def.enterLine ?? '',
        local: local ? { name: local.name, title: local.title ?? '' } : null,
        gadget: item(def.gadget),
        open: (GADGETS[t]?.world ?? []).map(item),
        picture: lorePicture(`temple-${t}`) ?? `thumbs/${id}.jpg`,
        guardian: g && {
          name: g.name, kind: g.kind, final: g.final, touch: g.touch ?? '',
          wake: g.wake ?? '', openHint: g.openHint ?? '', weary: g.weary ?? '', resolved: g.resolved ?? '',
          phases: g.phases.filter((p) => p.hint || p.asks).map((p) => ({ hint: p.hint ?? '', ...(p.asks ? { asks: { verb: p.asks.verb, hint: p.asks.hint ?? '', said: p.asks.said ?? '' } } : {}) })),
          picture: lorePicture(`guardian-${t}`),
        },
      });
    }
    worlds.push({
      id, title: TITLES[id], parts: partsOf(id).map((p) => TITLES[p] ?? p),
      page: { title: page.title ?? '', intro: page.intro ?? '', outro: page.outro ?? '' },
      blurb: level?.blurb ?? '', lore: text.WORLD_LORE[id] ?? [],
      picture: `thumbs/${id}.jpg`,
      people: bookOf(id).map((p) => ({ id: p.id, name: p.name, role: p.role ?? '', story: (p.story ?? []).map(partText).filter(Boolean) })),
      temples: templeList,
    });
  }
  const items = Object.entries(ITEMS).map(([id, it]) => ({
    id, name: it.name, kind: it.kind, text: it.text, needs: it.needs ? (ITEMS[it.needs]?.name ?? it.needs) : '',
    where: whereFound(id, PLACEMENTS, FALLBACKS, TITLES), whereText: it.where ?? '',
    temple: templeOfGadget[id] ?? null, picture: itemPicture(id), glyph: glyphs[id] ?? '',
  }));
  return {
    thread: text.THREAD,
    traveller: { ...text.TRAVELLER, portrait: lorePicture('traveller-portrait'), sheet: lorePicture('traveller-sheet') },
    verbs: text.VERBS,
    worlds, items,
  };
}

export const LORE_MODULE = 'virtual:hiraeth-lore';
/** Vite: `import LORE from 'virtual:hiraeth-lore'` is buildLore()'s JSON. */
export function lorePlugin() {
  const resolved = `\0${LORE_MODULE}`;
  let cached = null;
  return {
    name: 'hiraeth-lore',
    resolveId(id) { return id === LORE_MODULE ? resolved : null; },
    async load(id) {
      if (id !== resolved) return null;
      cached ??= buildLore().then((d) => `export default ${JSON.stringify(d)};`);
      return cached;
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const d = await buildLore();
  for (const w of d.worlds) console.log(`${w.title}: ${w.people.length} people; ${w.temples.map((t) => `${t.name} (${t.gadget.name}; ${t.guardian?.name})`).join(', ')}`);
  console.log(`${d.items.length} items; ${JSON.stringify(d).length} bytes of JSON`);
}
