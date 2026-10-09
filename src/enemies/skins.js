import { ARCHETYPES } from './archetypes.js';

// Each archetype in each world's skin (docs/design/enemy-roster.md, every archetype's "Worlds and skins"): a skin
// only recolours and dresses the archetype's body (src/enemies/plans/), and may add a skin-only move.
//
//   SKINS[archetype][world] = { name, palette: { … }, props: [ … ], scale, moves: [ … ] }
//     palette  the colours its body builder reads (each plan its own keys; missing ones fall back to the first skin's)
//     props    what dresses it: lichen, antennae, an awning, barnacles and rope, glass facets, coral, patina, coins…
//     moves    skin-only attacks (an attack's `skins`: the crab's burrow in the Salt Harbour and Underwater)
//     arena    a skin met only in the Arena (Home, the Atelier, the Overnight Train stay peaceful)
// The first world listed is the archetype's own skin: where it is met first, and what the Arena shows by default.

export const SKINS = {
  crab: {
    arzach2: { name: 'cliff crab', palette: { shell: '#7d93a6', shell2: '#9aaebd', under: '#efe4c8', claw: '#e8a07a', dark: '#2e3540', eye: '#f2d34b', accent: '#d7e0b4' }, props: ['lichen'] },
    garage: { name: 'oil beetle', palette: { shell: '#1f3b3d', shell2: '#2f5a5a', under: '#9fb3a8', claw: '#3b6d6a', dark: '#141c1d', eye: '#e8f07a', accent: '#7fd1c4' }, props: ['antennae', 'sheen'] },
    bazaar: { name: 'stall crab', palette: { shell: '#c98a5c', shell2: '#e0a878', under: '#f2e3c4', claw: '#d0603e', dark: '#3a2a24', eye: '#f2d34b', accent: '#5aa39b', cloth: '#d35d6e', cloth2: '#f2c54b' }, props: ['awning'] },
    saltharbour: { name: 'anchor crab', palette: { shell: '#4f7fa8', shell2: '#6d9cc0', under: '#efe9dc', claw: '#e07a5f', dark: '#26323d', eye: '#f2d34b', accent: '#e9e3d0', rope: '#c9a46a' }, props: ['barnacles', 'rope'], moves: ['burrow'] },
    glassdunes: { name: 'glass crab', palette: { shell: '#8fd9c0', shell2: '#c9f2e2', under: '#e8f4ea', claw: '#5fbf9f', dark: '#2d4a3e', eye: '#fff4b0', accent: '#ffffff' }, props: ['facets'] },
    underwater: { name: 'coral crab', palette: { shell: '#e8b9a0', shell2: '#f2d0bc', under: '#f7efe2', claw: '#e0705a', dark: '#4a2e30', eye: '#bff0ff', accent: '#ef6f6c' }, props: ['coral'], moves: ['burrow'] },
    antennas: { name: 'copper beetle', palette: { shell: '#b0683c', shell2: '#c98a54', under: '#e8d9b8', claw: '#7fb59a', dark: '#3a2a22', eye: '#e8f07a', accent: '#6fbf9a' }, props: ['antennae', 'patina'] },
  },
  skitter: {
    desert: { name: 'dune skitter', palette: { body: '#d7af72', accent: '#a96f3d' } },
    perdide: { name: 'spore mite', palette: { body: '#c8b6dc', accent: '#8f7fb0' } },
    buried: { name: 'ash grub', palette: { body: '#8d8a86', accent: '#ff8a4c' } },
    moonfoundry: { name: 'furnace beetle', palette: { body: '#5a4038', accent: '#ff7a2e' } },
    underside: { name: 'bridge crawler', palette: { body: '#4c566a', accent: '#a7b6c9' } },
  },
  centipede: {
    buried: { name: 'drill-head centipede', palette: { body: '#8d8a86', accent: '#b8603a' } },
    spheres: { name: 'pearl centipede', palette: { body: '#efe7dc', accent: '#c8b8d8' } },
    fallenring: { name: 'orbital centipede', palette: { body: '#3f8f8a', accent: '#d8b048' } },
    eclipse: { name: 'crescent crawler', palette: { body: '#5b4a86', accent: '#d6c2ff' } },
    waterfall: { name: 'drain crawler', palette: { body: '#2f3a3c', accent: '#6fa8a0' } },
    antennas: { name: 'wire-wound centipede', palette: { body: '#6a5848', accent: '#c98a54' } },
  },
  toad: {
    perdide: { name: 'spore toad', palette: { body: '#7d9a5c', accent: '#c8b6dc' } },
    incal: { name: 'pressure toad', palette: { body: '#6f8fae', accent: '#b39464' } },
    waterfall: { name: 'pressure-jet toad', palette: { body: '#ef9a8a', accent: '#f2e3c4' } },
    home: { name: 'bulb toad', palette: { body: '#9bbf6a', accent: '#f2a4c0' }, arena: true },
  },
  lizard: {
    incal: { name: 'pipe lizard', palette: { hide: '#e8a3a0', hide2: '#f2c0b8', belly: '#f4ead2', horn: '#b39464', dark: '#3a2a30', eye: '#f2d34b', accent: '#8a9bb8' }, props: ['elbow'] },
    buried: { name: 'ash lizard', palette: { hide: '#8d8a86', hide2: '#a8a49c', belly: '#d8d2c4', horn: '#3b3533', dark: '#262224', eye: '#ff9a5a', accent: '#5a5654' }, props: ['soot'] },
    bazaar: { name: 'coin lizard', palette: { hide: '#4fa39b', hide2: '#79c0b4', belly: '#f2e3c4', horn: '#d8b048', dark: '#1f3a38', eye: '#f2d34b', accent: '#d8b048' }, props: ['coins'] },
    eclipse: { name: 'night lizard', palette: { hide: '#5b4a86', hide2: '#7a66a8', belly: '#cfc2e8', horn: '#b8a0e8', dark: '#1d1630', eye: '#d6ffb0', accent: '#d6c2ff' }, props: ['glow'] },
    moonfoundry: { name: 'ember lizard', palette: { hide: '#e0783e', hide2: '#f2a060', belly: '#f7dcb4', horn: '#ffd36a', dark: '#3b2420', eye: '#fff4b0', accent: '#ff7a2e' }, props: ['hot'] },
    atelier: { name: 'ink lizard', palette: { hide: '#2b2534', hide2: '#463d52', belly: '#efe4c8', horn: '#b39464', dark: '#141018', eye: '#f8e8bb', accent: '#76617d' }, arena: true },
  },
  heron: {
    desert: { name: 'cistern heron', palette: { body: '#e9dfbb', accent: '#c98d4f' } },
    arzach: { name: 'ridge runner', palette: { body: '#8caeb1', accent: '#d7af72' } },
    perdide: { name: 'marsh snapper', palette: { body: '#c8b6dc', accent: '#7d9a5c' } },
    mangrove: { name: 'root wader', palette: { body: '#efeae0', accent: '#b8ab92' } },
  },
  roller: {
    spheres: { name: 'pearl roller', palette: { body: '#f2ece2', accent: '#c8b8d8' } },
    garage: { name: 'ball-bearing snail', palette: { body: '#a8b0b4', accent: '#3b5a5a' } },
    saltharbour: { name: 'brine mollusk', palette: { body: '#dfe8ea', accent: '#4f7fa8' } },
    spacecity: { name: 'magnetic mollusk', palette: { body: '#d8dff2', accent: '#5f7fd8' } },
    mangrove: { name: 'salt mollusk', palette: { body: '#f4f1ea', accent: '#b8ab92' } },
  },
  rootknot: {
    perdide: { name: 'reed knot', palette: { body: '#c8b6dc', accent: '#7d9a5c' } },
    perdide2: { name: 'root crawler', palette: { body: '#3f8f8a', accent: '#9fe8d8' } },
    edena: { name: 'topiary knot', palette: { body: '#6fa85c', accent: '#d8e8a8' } },
    mangrove: { name: 'mangrove knot', palette: { body: '#e8e2d0', accent: '#9fe8d8' } },
    waterfall: { name: 'weed knot', palette: { body: '#2f3a3c', accent: '#6fa8a0' } },
  },
  jelly: {
    arzach2: { name: 'cloud jelly', palette: { body: '#f2c0cf', accent: '#f2a45c' } },
    perdide2: { name: 'lamp jelly', palette: { body: '#c8453e', accent: '#d8b048' } },
    spheres: { name: 'halo jelly', palette: { body: '#efe7f2', accent: '#a8e0f2' } },
    underwater: { name: 'porcelain jelly', palette: { body: '#f4f1ea', accent: '#8fc8e8' } },
    fallenring: { name: 'sun jelly', palette: { body: '#3f8f8a', accent: '#ff9a3e' } },
  },
  moth: {
    perdide2: { name: 'lamp moth', palette: { body: '#8d8a86', accent: '#f2a45c' } },
    edena: { name: 'glass wasp', palette: { body: '#f2b8c8', accent: '#3a2a30' } },
    bazaar: { name: 'sign moth', palette: { body: '#241a2e', accent: '#ff5fa2' } },
    antennas: { name: 'signal moth', palette: { body: '#efe4c8', accent: '#c98a54' } },
    spacecity: { name: 'space moth', palette: { body: '#5f7fd8', accent: '#d8dff2' } },
  },
  ray: {
    arzach: { name: 'storm ray', palette: { body: '#b98674', accent: '#d7af72' } },
    arzach2: { name: 'cloud ray', palette: { body: '#e8e4ec', accent: '#a8c8e0' } },
    garage: { name: 'scrap ray', palette: { body: '#b8a888', accent: '#5a5654' } },
    glassdunes: { name: 'glass manta', palette: { body: '#8fd9c0', accent: '#ffffff' } },
    underwater: { name: 'porcelain ray', palette: { body: '#f4f1ea', accent: '#8fc8e8' } },
    underside: { name: 'abyss ray', palette: { body: '#2f3348', accent: '#7f8fc8' } },
  },
  worm: {
    desert: { name: 'dune worm', palette: { body: '#d7af72', accent: '#efe4c8' } },
    buried: { name: 'drill grub', palette: { body: '#6a6080', accent: '#a8b0b4' } },
    glassdunes: { name: 'glass worm', palette: { body: '#8fd9c0', accent: '#ffffff' } },
  },
  tripod: {
    incal: { name: 'inspection tripod', palette: { body: '#efe4c8', body2: '#f7efda', brass: '#b8955a', accent: '#7f93b8', dark: '#3a3330', lamp: '#fff2c0', rust: '#d99a8a' }, props: ['enamel'] },
    buried: { name: 'mining tripod', palette: { body: '#b8a58a', body2: '#cdbb9e', brass: '#8a5a3a', accent: '#b8603a', dark: '#2e2a28', lamp: '#ffd38a', rust: '#a0522d' }, props: ['drill'] },
    underwater: { name: 'diving bell', palette: { body: '#d8c48a', body2: '#e8d8a8', brass: '#a0784a', accent: '#5f9fb8', dark: '#2a3036', lamp: '#bff0ff', rust: '#6fa8a0' }, props: ['bell', 'portholes'] },
    fallenring: { name: 'gyroscope tripod', palette: { body: '#e8efe8', body2: '#f4f8f4', brass: '#d8b048', accent: '#3f8f8a', dark: '#24302e', lamp: '#fff4b0', rust: '#7fb59a' }, props: ['gyro'] },
    desert: { name: 'cistern pump', palette: { body: '#e9dfbb', body2: '#f2ead0', brass: '#b39464', accent: '#cfa2a7', dark: '#3a2f28', lamp: '#fff2c0', rust: '#c98d4f' }, props: ['pump'] },
  },
  cart: {
    garage: { name: 'welding cart', palette: { body: '#2f4a4a', accent: '#ff9a3e' } },
    buried: { name: 'ore cart', palette: { body: '#8a5a3a', accent: '#ff7a2e' } },
    moonfoundry: { name: 'crucible cart', palette: { body: '#efe4c8', accent: '#ff7a2e' } },
    overnighttrain: { name: 'luggage trolley', palette: { body: '#8a5a3a', accent: '#d8b048' }, arena: true },
  },
  bell: {
    bazaar: { name: 'sign automaton', palette: { body: '#b0783c', accent: '#5aa39b' } },
    saltharbour: { name: 'dock winch', palette: { body: '#4f6f8a', accent: '#c9a46a' } },
    underside: { name: 'cable crane', palette: { body: '#4c566a', accent: '#d8b048' } },
  },
  drone: {
    incal: { name: 'rust drone', palette: { body: '#b39464', accent: '#d99a8a' } },
    garage: { name: 'scrap drone', palette: { body: '#8a8478', accent: '#b8603a' } },
    spheres: { name: 'ring drone', palette: { body: '#f2ece2', accent: '#d8b048' } },
    antennas: { name: 'relay drone', palette: { body: '#c98a54', accent: '#efe4c8' } },
    spacecity: { name: 'airlock drone', palette: { body: '#f4f4f0', accent: '#5f7fd8' } },
    fallenring: { name: 'gyroscope drone', palette: { body: '#e8efe8', accent: '#d8b048' } },
  },
  brute: {
    perdide2: { name: 'wood cutter', palette: { body: '#efe4c8', accent: '#3f6a3c' } },
    edena: { name: 'pruning machine', palette: { body: '#e8e2d0', accent: '#6fa85c' } },
    glassdunes: { name: 'furnace walker', palette: { body: '#8fd9c0', accent: '#ffffff' } },
    waterfall: { name: 'turbine guardian', palette: { body: '#c8d0d0', accent: '#5f9fb8' } },
    moonfoundry: { name: 'crucible hand', palette: { body: '#efe4c8', accent: '#ff7a2e' } },
  },
  shade: {
    perdide2: { name: 'hollow woodsman', palette: { body: '#15121c', accent: '#6b5a3a' } },
    incal: { name: 'vagrant shade', palette: { body: '#15121c', accent: '#8a9bb8' } },
    garage: { name: 'hooded mechanic', palette: { body: '#15121c', accent: '#b8603a' } },
    spheres: { name: 'halo shade', palette: { body: '#15121c', accent: '#efe7f2' } },
    glassdunes: { name: 'mirrored nomad', palette: { body: '#15121c', accent: '#8fd9c0' } },
    eclipse: { name: 'pilgrim shade', palette: { body: '#15121c', accent: '#d6c2ff' } },
  },
  hound: {
    eclipse: { name: 'night hound', palette: { ink: '#15121c', rim: '#3b2a5c', antler: '#d6c2ff', eye: '#d6c2ff', glow: '#d6c2ff', smoke: '#3b2a5c' }, props: ['crescent'] },
    mangrove: { name: 'driftwood hound', palette: { ink: '#1a1820', rim: '#4a4038', antler: '#efe8da', eye: '#f2e8c8', glow: '#efe8da', smoke: '#5a5048' }, props: ['bleached'] },
    spheres: { name: 'halo hound', palette: { ink: '#15121c', rim: '#4a3e66', antler: '#cfc8e0', eye: '#e8f4ff', glow: '#bfe9ff', smoke: '#4a3e66' }, props: ['halo'] },
    bazaar: { name: 'alley hound', palette: { ink: '#16141a', rim: '#3a3440', antler: '#b39464', eye: '#ffb8d0', glow: '#ff9ac0', smoke: '#3a3440' }, props: ['wire'] },
  },
  marionette: {
    bazaar: { name: 'parcel puppet', palette: { body: '#c9a46a', accent: '#15121c' } },
    underside: { name: 'crane puppet', palette: { body: '#4c566a', accent: '#15121c' } },
    saltharbour: { name: 'drowned sailor', palette: { body: '#4f7fa8', accent: '#15121c' } },
    spheres: { name: 'glass puppet', palette: { body: '#e8f4f8', accent: '#c8d0e0' } },
  },
};

// The ink blot is in every world, few and early: it takes the ground's colour at its edge (sand in the Desert, moss in
// Lorn, rust in the Hangar). Its skins are made from this table of edge colours.
const BLOT_EDGE = {
  desert: ['the sand-edged blot', '#c98d4f'], arzach: ['the feather-tufted blot', '#8caeb1'], arzach2: ['the cloud-edged blot', '#b8c8d8'],
  perdide: ['the moss-edged blot', '#7d9a5c'], perdide2: ['the root-edged blot', '#3f6a5a'], edena: ['the leaf-edged blot', '#6fa85c'],
  incal: ['the rust-edged blot', '#a0605a'], garage: ['the oil-edged blot', '#3b5a5a'], buried: ['the ash-edged blot', '#8d8a86'],
  spheres: ['the pearl-edged blot', '#c8b8d8'], bazaar: ['the paint-edged blot', '#d35d6e'], mangrove: ['the salt-edged blot', '#d8d0c0'],
  glassdunes: ['the glass-edged blot', '#8fd9c0'], waterfall: ['the wet blot', '#5f9fb8'], saltharbour: ['the brine-edged blot', '#4f7fa8'],
  antennas: ['the copper-edged blot', '#c98a54'], underwater: ['the coral-edged blot', '#e0705a'], eclipse: ['the night blot', '#5b4a86'],
  fallenring: ['the teal-edged blot', '#3f8f8a'], moonfoundry: ['the ember-edged blot', '#e0783e'], underside: ['the girder blot', '#4c566a'],
  spacecity: ['the star-edged blot', '#5f7fd8'],
};
SKINS.blot = Object.fromEntries(Object.entries(BLOT_EDGE).map(([w, [name, edge]]) => [w, { name, palette: { ink: '#1e1a26', edge, eye: '#f4efe0' } }]));

/** Each archetype's own skin: the first world it is met in (its skins' first entry). */
export const HOME_SKIN = Object.fromEntries(Object.entries(SKINS).map(([a, s]) => [a, Object.keys(s)[0]]));

/** The skin worlds of an archetype (in order: its own first). */
export const skinWorlds = (a) => Object.keys(SKINS[a] ?? {});

/** Which skin an archetype wears in a world: that world's own, else its home skin (the Arena, a world it isn't in). */
export function skinFor(a, world) {
  const S = SKINS[a];
  if (!S) return null;
  return S[world] ? world : HOME_SKIN[a];
}

/** An archetype's skin in a world, its palette filled from its home skin's: { id, name, palette, props, moves, scale }. */
export function skinOf(a, world) {
  const id = skinFor(a, world);
  if (!id) return null;
  const S = SKINS[a][id], home = SKINS[a][HOME_SKIN[a]];
  return { id, name: S.name, palette: { ...home.palette, ...S.palette }, props: S.props ?? [], moves: S.moves ?? [], scale: S.scale ?? 1, arena: !!S.arena };
}

/** A skin's name for a kind (by the archetype it is): 'crab', 'saltharbour' → 'anchor crab'; else the archetype's name. */
export function skinName(a, world) {
  const s = skinOf(a, world);
  return s?.name ?? ARCHETYPES[a]?.name ?? a;
}
