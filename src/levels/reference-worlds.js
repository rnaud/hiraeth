// ---------------------------------------------------------------------------
// The References' worlds (src/levels/references.js, docs/systems/references.md "Adding a world"):
// one entry per world whose reference sheets have views, in the order the views are numbered.
// The level loads only the world you go to: its module (a dynamic import, a chunk of its own in
// the build) and then its views, built a step at a time. Another world is another load of the
// page (?level=references&world=<id>&view=<n>), so the world you leave is gone with the page.
//
//   id      the world in the address: &world=<id>
//   name    its name in the quick menu and the label; its sheets' names start with it
//           ("The Desert / IMG_3775.JPG": reference-picker.js groups by that)
//   count   how many views its module holds: the views are numbered across the worlds, this
//           world's first being 1 + the counts before it (tests/reference-worlds.test.js checks
//           the count against the module, so a view added there fails until it is counted here)
//   load    () => import('./reference-<world>.js'): a module exporting SHEETS (its sheets by
//           key: { name, size, url }) and VIEWS (its views, in order: reference-views.js
//           describes their fields)
//
// A new world goes at the end, so the views before it keep their numbers.
// ---------------------------------------------------------------------------

export const REFERENCE_WORLDS = [
  { id: 'desert', name: 'The Desert', count: 27, load: () => import('./reference-desert.js') },
  { id: 'shaft', name: 'The City-Shaft', count: 23, load: () => import('./reference-shaft.js') },
  { id: 'vael2', name: 'Vael II, the Sky Stones', count: 31, load: () => import('./reference-vael2.js') },
  { id: 'buried', name: 'The Buried Machine', count: 22, load: () => import('./reference-buried.js') },
  { id: 'spheres', name: 'The Garden of Spheres', count: 22, load: () => import('./reference-spheres.js') },
  { id: 'lorn', name: 'Lorn II', count: 23, load: () => import('./reference-lorn.js') },
  { id: 'market', name: 'The Signal Market', count: 21, load: () => import('./reference-market.js') },
  { id: 'mangrove', name: 'The White Mangrove', count: 4, load: () => import('./reference-mangrove.js') },
  { id: 'glassdunes', name: 'The Glass Dunes', count: 4, load: () => import('./reference-glassdunes.js') },
  { id: 'waterfall', name: 'The City Behind the Waterfall', count: 4, load: () => import('./reference-waterfall.js') },
  { id: 'saltharbour', name: 'The Salt Harbour', count: 4, load: () => import('./reference-saltharbour.js') },
  { id: 'antennas', name: 'The Forest of Antennas', count: 4, load: () => import('./reference-antennas.js') },
  { id: 'underwater', name: 'The Underwater City', count: 4, load: () => import('./reference-underwater.js') },
  { id: 'eclipse', name: 'The City During the Eclipse', count: 4, load: () => import('./reference-eclipse.js') },
  { id: 'fallenring', name: 'The Fallen Ring', count: 4, load: () => import('./reference-fallenring.js') },
  { id: 'moonfoundry', name: 'The Moon Foundry', count: 4, load: () => import('./reference-moonfoundry.js') },
  { id: 'underside', name: 'The Underside', count: 4, load: () => import('./reference-underside.js') },
  { id: 'spacecity', name: 'The City Floating in Space', count: 4, load: () => import('./reference-spacecity.js') },
];

/** The index of the first view of world k (0-based, across all the worlds). */
export function firstView(k, worlds = REFERENCE_WORLDS) {
  let n = 0;
  for (let j = 0; j < k; j++) n += worlds[j].count;
  return n;
}
/** How many views there are, all the worlds together. */
export const totalViews = (worlds = REFERENCE_WORLDS) => worlds.reduce((n, w) => n + w.count, 0);
/** The world of an id (its index), or -1. */
export const worldIndex = (id, worlds = REFERENCE_WORLDS) => worlds.findIndex((w) => w.id === id);

/** View i (0-based, across the worlds): { k: its world, local: its place in that world }, or null. */
export function locateView(i, worlds = REFERENCE_WORLDS) {
  if (!Number.isInteger(i) || i < 0) return null;
  for (let k = 0, n = 0; k < worlds.length; n += worlds[k].count, k++) if (i < n + worlds[k].count) return { k, local: i - n };
  return null;
}

const loaded = new Map();   // world entry → Promise of its views, and once there the views themselves
/**
 * World k's sheets and views: a promise of { k, id, name, first, count, views, sheets } (its module
 * imported once; the views keep their own objects, reference-views.js and the level share them).
 */
export function loadWorld(k, worlds = REFERENCE_WORLDS) {
  const w = worlds[k];
  if (!w) return Promise.reject(new Error(`no reference world ${k}`));
  let p = loaded.get(w);
  if (!p) {
    p = w.load().then((m) => {
      const world = { k, id: w.id, name: w.name, first: firstView(k, worlds), count: w.count, views: m.VIEWS, sheets: m.SHEETS };
      if (!Array.isArray(world.views) || !world.sheets) throw new Error(`reference-${w.id}: its module exports no VIEWS or SHEETS`);
      p.world = world;
      return world;
    });
    loaded.set(w, p);
  }
  return p;
}
/** World k's views if they are loaded already (else null): the level's build goes on at once with them. */
export const loadedWorld = (k, worlds = REFERENCE_WORLDS) => loaded.get(worlds[k])?.world ?? null;

/** Every world loaded (the quick menu's list, the tests, the trailer), in order. */
export const loadAllWorlds = (worlds = REFERENCE_WORLDS) => Promise.all(worlds.map((_, k) => loadWorld(k, worlds)));

/**
 * Where the address opens the level: { k, local } (or { id } when it names a view by its id, found
 * once the worlds are loaded: findView).
 *   world=<id>&view=<n>   the n-th view of that world (1-based; no view: its first)
 *   view=<n>              the n-th view across the worlds (as the label numbers them)
 *   view=<view id>        that view, whichever world it is in
 */
export function startOf(params, worlds = REFERENCE_WORLDS) {
  const wid = params?.get?.('world'), v = params?.get?.('view');
  const k = wid ? worldIndex(wid, worlds) : -1;
  const n = v !== null && v !== undefined && /^\d+$/.test(v) ? Number(v) : null;
  if (k >= 0) return { k, local: n >= 1 && n <= worlds[k].count ? n - 1 : 0 };
  if (n !== null) return locateView(n - 1, worlds) ?? { k: 0, local: 0 };
  if (v) return { id: v };
  return { k: 0, local: 0 };
}

/** The world and place of a view by its id (every world loaded to find it), or null. */
export async function findView(id, worlds = REFERENCE_WORLDS) {
  for (const world of await loadAllWorlds(worlds)) {
    const local = world.views.findIndex((v) => v.id === id);
    if (local >= 0) return { k: world.k, local };
  }
  return null;
}

/** The address of a view (world k, its local place), keeping the rest of the query (?look=, ?mh=, …). */
export function viewSearch(search, k, local, worlds = REFERENCE_WORLDS) {
  const q = new URLSearchParams(search ?? '');
  q.set('level', 'references');
  q.set('world', worlds[k].id);
  q.set('view', String(local + 1));
  return `?${q.toString()}`;
}
