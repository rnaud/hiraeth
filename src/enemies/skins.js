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
    // (sheet-1: slate-blue shell with pale lichen stars, ivory legs, arms and belly, apricot pincer tips, black eyes;
    // sheet-2: turquoise shell crusted with cream barnacles, cream legs on rusty coral joints and arms, rope and anchor)
    arzach2: { name: 'cliff crab', palette: { shell: '#7b8697', shell2: '#9ea7b3', under: '#e9dfc8', leg: '#eee5d0', joint: '#d9ccae', claw: '#e9a07a', dark: '#2f3846', eye: '#1e1d24', accent: '#efe5c4' }, props: ['lichen'] },
    garage: { name: 'oil beetle', palette: { shell: '#1f3b3d', shell2: '#2f5a5a', under: '#9fb3a8', leg: '#2f5a5a', joint: '#141c1d', claw: '#3b6d6a', dark: '#141c1d', eye: '#e8f07a', accent: '#7fd1c4' }, props: ['antennae', 'sheen'] },
    bazaar: { name: 'stall crab', palette: { shell: '#c98a5c', shell2: '#e0a878', under: '#f2e3c4', leg: '#f2e3c4', joint: '#d0603e', claw: '#d0603e', dark: '#3a2a24', eye: '#2a2024', accent: '#5aa39b', cloth: '#d35d6e', cloth2: '#f2c54b' }, props: ['awning'] },
    saltharbour: { name: 'anchor crab', palette: { shell: '#76b8aa', shell2: '#a0d2c4', under: '#efe4cc', leg: '#f3e9d4', joint: '#c97d64', arm: '#c97d64', tip: '#d07f66', claw: '#d9785e', dark: '#484a68', eye: '#1e1d24', accent: '#eee2c2', rope: '#b38b58', iron: '#8a4c36' }, props: ['barnacles', 'rope'], moves: ['burrow'] },
    glassdunes: { name: 'glass crab', palette: { shell: '#8fd9c0', shell2: '#c9f2e2', under: '#e8f4ea', leg: '#c9f2e2', joint: '#5fbf9f', claw: '#5fbf9f', dark: '#2d4a3e', eye: '#fff4b0', accent: '#ffffff' }, props: ['facets'] },
    underwater: { name: 'coral crab', palette: { shell: '#e8b9a0', shell2: '#f2d0bc', under: '#f7efe2', leg: '#f7efe2', joint: '#e0705a', claw: '#e0705a', dark: '#4a2e30', eye: '#bff0ff', accent: '#ef6f6c' }, props: ['coral'], moves: ['burrow'] },
    antennas: { name: 'copper beetle', palette: { shell: '#b0683c', shell2: '#c98a54', under: '#e8d9b8', leg: '#c98a54', joint: '#3a2a22', claw: '#7fb59a', dark: '#3a2a22', eye: '#e8f07a', accent: '#6fbf9a' }, props: ['antennae', 'patina'] },
  },
  skitter: {
    desert: { name: 'dune skitter', palette: { body: '#d7af72', accent: '#a96f3d' } },
    perdide: { name: 'spore mite', palette: { body: '#c8b6dc', accent: '#8f7fb0' } },
    buried: { name: 'ash grub', palette: { body: '#8d8a86', accent: '#ff8a4c' } },
    moonfoundry: { name: 'furnace beetle', palette: { body: '#5a4038', accent: '#ff7a2e' } },
    underside: { name: 'bridge crawler', palette: { body: '#4c566a', accent: '#a7b6c9' } },
  },
  centipede: {
    buried: { name: 'drill-head centipede', palette: { plate: '#9a968c', plate2: '#b4b0a4', under: '#c8c2b4', leg: '#8a867c', head: '#a49e92', accent: '#d8743a', dark: '#3a3632', eye: '#ffb86a' }, props: ['bands', 'drill'] },
    spheres: { name: 'pearl centipede', palette: { plate: '#efe7dc', plate2: '#f8f2ea', under: '#d8cfe0', leg: '#b8a8c8', head: '#e8dff0', accent: '#c8b8d8', dark: '#4a4058', eye: '#9fd8f2' }, props: ['pearl'] },
    fallenring: { name: 'orbital centipede', palette: { plate: '#3f8f8a', plate2: '#5aa8a0', under: '#d8e8e0', leg: '#2a5a58', head: '#d8b048', accent: '#d8b048', dark: '#16302e', eye: '#fff4b0' }, props: ['gold'] },
    eclipse: { name: 'crescent crawler', palette: { plate: '#5b4a86', plate2: '#7a66a8', under: '#cfc2e8', leg: '#3a2e5a', head: '#4a3c70', accent: '#d6c2ff', dark: '#1d1630', eye: '#d6ffb0' }, props: ['glow'] },
    waterfall: { name: 'drain crawler', palette: { plate: '#2f3a3c', plate2: '#46575a', under: '#8fa8a8', leg: '#20292a', head: '#2a3436', accent: '#6fa8a0', dark: '#121718', eye: '#bff0e8' }, props: ['slick'] },
    antennas: { name: 'wire-wound centipede', palette: { plate: '#6a5848', plate2: '#86705a', under: '#d8c8a8', leg: '#4a3a2e', head: '#5a4a3c', accent: '#c98a54', dark: '#2a2018', eye: '#e8f07a' }, props: ['wire'] },
  },
  toad: {
    perdide: { name: 'spore toad', palette: { body: '#7d9a5c', accent: '#c8b6dc' } },
    incal: { name: 'pressure toad', palette: { body: '#6f8fae', accent: '#b39464' } },
    waterfall: { name: 'pressure-jet toad', palette: { body: '#ef9a8a', accent: '#f2e3c4' } },
    home: { name: 'bulb toad', palette: { body: '#9bbf6a', accent: '#f2a4c0' }, arena: true },
  },
  lizard: {
    // (sheet-1: dusty terracotta and rose scales mottled with darker bands, ivory belly plates, a tarnished brass horn
    // with verdigris at its seams; sheet-2: teal scales with amber rosettes, cream belly, polished brass hung with coins)
    incal: { name: 'pipe lizard', palette: { hide: '#d8866a', hide2: '#e8a68a', belly: '#efe1c3', horn: '#c39d55', dark: '#3a2a30', eye: '#f2e2b0', accent: '#8e5a6a', verd: '#5fa59a' } },
    buried: { name: 'ash lizard', palette: { hide: '#8d8a86', hide2: '#a8a49c', belly: '#d8d2c4', horn: '#3b3533', dark: '#262224', eye: '#ff9a5a', accent: '#5a5654', verd: '#5a5654' }, props: ['soot'] },
    bazaar: { name: 'coin lizard', palette: { hide: '#55a5a3', hide2: '#84c3bd', belly: '#f1e4c6', horn: '#dcb34c', dark: '#1f3a38', eye: '#f2d34b', accent: '#d9a24a', verd: '#3f8a86' }, props: ['coins', 'key'] },
    eclipse: { name: 'night lizard', palette: { hide: '#5b4a86', hide2: '#7a66a8', belly: '#cfc2e8', horn: '#b8a0e8', dark: '#1d1630', eye: '#d6ffb0', accent: '#3a2d60', verd: '#d6c2ff' }, props: ['glow'] },
    moonfoundry: { name: 'ember lizard', palette: { hide: '#e0783e', hide2: '#f2a060', belly: '#f7dcb4', horn: '#ffd36a', dark: '#3b2420', eye: '#fff4b0', accent: '#a8482a', verd: '#ff7a2e' }, props: ['hot'] },
    atelier: { name: 'ink lizard', palette: { hide: '#2b2534', hide2: '#463d52', belly: '#efe4c8', horn: '#b39464', dark: '#141018', eye: '#f8e8bb', accent: '#76617d', verd: '#76617d' }, arena: true },
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
    arzach2: { name: 'cloud jelly', palette: { bell: '#efc4d4', bell2: '#f8dce6', under: '#a8c8e0', thread: '#d8e4ec', lantern: '#b39464', light: '#ffc27a', eye: '#1a1420', dark: '#8a6a78' }, props: ['paper', 'puffy'] },
    perdide2: { name: 'lamp jelly', palette: { bell: '#c8453e', bell2: '#e06a5a', thread: '#a8342e', lantern: '#b8955a', light: '#ffd27a', eye: '#fff2c0', dark: '#4a1a18' }, props: ['brass'], moves: ['mend'] },
    spheres: { name: 'halo jelly', palette: { bell: '#efe7f2', bell2: '#f8f4fa', thread: '#c8b8d8', lantern: '#e8f8ff', light: '#a8e0f2', eye: '#4a4058', dark: '#6a5a80' }, props: ['prism', 'halo'], moves: ['mend'] },
    underwater: { name: 'porcelain jelly', palette: { bell: '#f4f1ea', bell2: '#ffffff', thread: '#8fc8e8', lantern: '#d8f0f8', light: '#8fc8e8', eye: '#2a4a5a', dark: '#5f8fa8' }, props: ['float', 'glaze'], moves: ['mend'] },
    fallenring: { name: 'sun jelly', palette: { bell: '#3f8f8a', bell2: '#5aa8a0', thread: '#2a6a66', lantern: '#ffcf8a', light: '#ff9a3e', eye: '#fff4b0', dark: '#16302e' }, props: ['core'], moves: ['mend'] },
  },
  moth: {
    perdide2: { name: 'lamp moth', palette: { wing: '#a39bbf', wing2: '#c8c2d8', body: '#f2cf86', spot: '#d8504a', glow: '#fff2d0', antenna: '#c9a050', eye: '#1a1420' }, props: ['lit', 'dusty'], moves: ['dust'] },
    edena: { name: 'glass wasp', palette: { wing: '#f2b8c8', wing2: '#f8dce4', body: '#f7d8a8', spot: '#e0607a', glow: '#fff0f4', antenna: '#5a3a44', eye: '#2a1e24' }, props: ['wasp'] },
    bazaar: { name: 'sign moth', palette: { wing: '#2a1f36', wing2: '#3a2c48', body: '#ff9ac8', spot: '#5ff0e8', glow: '#ffffff', antenna: '#ff5fa2', eye: '#101018' }, props: ['neon', 'letters'] },
    antennas: { name: 'signal moth', palette: { wing: '#efe4c8', wing2: '#f7efda', body: '#ffe6a8', spot: '#c98a54', glow: '#fff8e0', antenna: '#b0683c', eye: '#2a2018' }, props: ['dish'], moves: ['dust'] },
    spacecity: { name: 'space moth', palette: { wing: '#5f7fd8', wing2: '#a8b8f0', body: '#d8f0ff', spot: '#f2f4ff', glow: '#ffffff', antenna: '#d8dff2', eye: '#101830' }, props: ['sail'] },
  },
  ray: {
    arzach: { name: 'storm ray', palette: { top: '#c8573a', top2: '#d8704c', under: '#ece2c8', edge: '#9fb3d8', spots: '#8a3424', eye: '#2a1810', tail: '#e8dcc0' }, props: [], moves: ['draft'] },
    arzach2: { name: 'cloud ray', palette: { top: '#e8e4ec', top2: '#f6f4f8', under: '#ffffff', edge: '#a8c8e0', spots: '#a8c8e0', eye: '#4a6a8a', tail: '#a8b8c8' }, props: ['mist'], moves: ['draft'] },
    garage: { name: 'scrap ray', palette: { top: '#b8a888', top2: '#cdbf9e', under: '#e8dcc0', edge: '#5a5654', spots: '#5a5654', eye: '#ffb347', tail: '#3a3634' }, props: ['patches', 'wire'] },
    glassdunes: { name: 'glass manta', palette: { top: '#8fd9c0', top2: '#c9f2e2', under: '#e8f8f0', edge: '#ffffff', spots: '#ffffff', eye: '#fff4b0', tail: '#5fbf9f' }, props: ['facets'] },
    underwater: { name: 'porcelain ray', palette: { top: '#f4f1ea', top2: '#ffffff', under: '#f8f6f0', edge: '#5f8fc8', spots: '#5f8fc8', eye: '#2a4a6a', tail: '#8fc8e8' }, props: ['ribbons', 'glaze'] },
    underside: { name: 'abyss ray', palette: { top: '#2f3348', top2: '#3e4460', under: '#7f8fc8', edge: '#9fb0e8', spots: '#9fb0e8', eye: '#bfe9ff', tail: '#1a1d2c' }, props: ['long', 'dark'] },
  },
  worm: {
    desert: { name: 'dune worm', palette: { body: '#e3b866', body2: '#efcf8a', ring: '#c98a3a', sand: '#c99a62', mouth: '#4fa89a', teeth: '#f7f0dc', eye: '#1a1410', fin: '#e8d6aa' }, props: ['fin'] },
    buried: { name: 'drill grub', palette: { body: '#6a6080', body2: '#857aa0', ring: '#463e58', sand: '#6a625a', mouth: '#5a8a98', teeth: '#a8b0b4', eye: '#ff9a5a', fin: '#c8c4d8' }, props: ['drill'] },
    glassdunes: { name: 'glass worm', palette: { body: '#8fd9c0', body2: '#c9f2e2', ring: '#5fbf9f', sand: '#a8d8c8', mouth: '#3f8f8a', teeth: '#ffffff', eye: '#fff4b0', fin: '#e8fff6' }, props: ['crest'] },
  },
  tripod: {
    // (sheet-1: ivory enamel, polished brass, slate-blue bands and panels, pink rust; sheet-2: a riveted coral-copper
    // diving bell with a turquoise band and several portholes, buttery yellow lamp, cream legs, black bubbles rising)
    incal: { name: 'inspection tripod', palette: { body: '#efe5cd', body2: '#f8f0dd', leg: '#ebe1c9', brass: '#c49a52', accent: '#7088a8', dark: '#3a3330', lamp: '#fff3cc', rust: '#d99a8c' }, props: ['enamel'] },
    buried: { name: 'mining tripod', palette: { body: '#b8a58a', body2: '#cdbb9e', leg: '#c8b698', brass: '#8a5a3a', accent: '#b8603a', dark: '#2e2a28', lamp: '#ffd38a', rust: '#a0522d' }, props: ['drill'] },
    underwater: { name: 'diving bell', palette: { body: '#d68e78', body2: '#e6a690', leg: '#ecdcc0', brass: '#c49a52', accent: '#6db2a8', dark: '#2a3036', lamp: '#ffe8a0', rust: '#b06a56' }, props: ['bell', 'portholes', 'key', 'bubbles'] },
    fallenring: { name: 'gyroscope tripod', palette: { body: '#e8efe8', body2: '#f4f8f4', leg: '#e8efe8', brass: '#d8b048', accent: '#3f8f8a', dark: '#24302e', lamp: '#fff4b0', rust: '#7fb59a' }, props: ['gyro'] },
    desert: { name: 'cistern pump', palette: { body: '#e9dfbb', body2: '#f2ead0', leg: '#e9dfbb', brass: '#b39464', accent: '#cfa2a7', dark: '#3a2f28', lamp: '#fff2c0', rust: '#c98d4f' }, props: ['pump'] },
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
    // (sheet-1, the Garden of Spheres: matte ink-black with violet smoke, black antlers glinting gold, a thin pearl-and-
    // gold halo caught in them, white eyes; sheet-2, the Mangrove: bone-white driftwood antlers, the black body dripping
    // like wet ink, sage and lilac smoke, small turquoise eyes)
    eclipse: { name: 'night hound', palette: { ink: '#15121c', rim: '#3b2a5c', antler: '#d6c2ff', eye: '#d6c2ff', glow: '#d6c2ff', smoke: '#3b2a5c', smoke2: '#5a4686' }, props: ['crescent'] },
    mangrove: { name: 'driftwood hound', palette: { ink: '#1a1a20', rim: '#3a3a44', antler: '#ebe3d1', eye: '#6fe0d0', glow: '#6fe0d0', smoke: '#a3c1ab', smoke2: '#c2b0dc' }, props: ['bleached', 'drips'] },
    spheres: { name: 'halo hound', palette: { ink: '#1a1521', rim: '#3a2c4e', antler: '#241c2e', eye: '#f4f0ff', glow: '#dcb860', smoke: '#4a3868', smoke2: '#8676a6' }, props: ['halo', 'glints'] },
    bazaar: { name: 'alley hound', palette: { ink: '#16141a', rim: '#3a3440', antler: '#b39464', eye: '#ffb8d0', glow: '#ff9ac0', smoke: '#3a3440', smoke2: '#5a4a58' }, props: ['wire'] },
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
  desert: ['the sand-edged blot', '#c99a48'], arzach: ['the feather-tufted blot', '#8caeb1'], arzach2: ['the cloud-edged blot', '#b8c8d8'],
  perdide: ['the moss-edged blot', '#7d9a5c'], perdide2: ['the root-edged blot', '#3f6a5a'], edena: ['the leaf-edged blot', '#6fa85c'],
  incal: ['the rust-edged blot', '#a0605a'], garage: ['the oil-edged blot', '#3b5a5a'], buried: ['the ash-edged blot', '#8d8a86'],
  spheres: ['the pearl-edged blot', '#c8b8d8'], bazaar: ['the paint-edged blot', '#d35d6e'], mangrove: ['the salt-edged blot', '#d8d0c0'],
  glassdunes: ['the glass-edged blot', '#8fd9c0'], waterfall: ['the wet blot', '#5f9fb8'], saltharbour: ['the brine-edged blot', '#4f7fa8'],
  antennas: ['the copper-edged blot', '#c98a54'], underwater: ['the coral-edged blot', '#e0705a'], eclipse: ['the night blot', '#5b4a86'],
  fallenring: ['the teal-edged blot', '#3f8f8a'], moonfoundry: ['the ember-edged blot', '#e0783e'], underside: ['the girder blot', '#4c566a'],
  spacecity: ['the star-edged blot', '#5f7fd8'],
};
// Its sheets (references/enemy-archetypes/blot/): sheet-1, the Desert's, deep ink-black with violet light on its gloss and
// cream eyes; sheet-2, the Hangar's, gunmetal ink with teal light, its edge rust and oily teal, metal shavings stuck in it.
const BLOT_DRESS = { garage: { palette: { ink: '#1c2125', shine: '#4f7378', edge: '#c06c38', edge2: '#3f8682' }, props: ['shavings'] } };
SKINS.blot = Object.fromEntries(Object.entries(BLOT_EDGE).map(([w, [name, edge]]) => [w, { name, palette: { ink: '#1e1a26', shine: '#5c4a8e', edge, eye: '#f4efe0', ...BLOT_DRESS[w]?.palette }, props: BLOT_DRESS[w]?.props }]));

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
