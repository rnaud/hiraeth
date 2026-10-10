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
    // (sheet-1: sand-gold domes with an ochre band round them, ivory legs, tiny black eyes with turquoise glints;
    // sheet-2: dark iron-grey domes with a glowing ember-orange seam down the back, cream enamel legs)
    desert: { name: 'dune skitter', palette: { dome: '#e0b25a', dome2: '#ecc878', band: '#d98a3c', leg: '#efe4cc', joint: '#e2d4b4', eye: '#1e2a2a', glint: '#5fd0c0', seam: '#ff7a2e', dark: '#6a4a2a' }, props: ['band'] },
    perdide: { name: 'spore mite', palette: { dome: '#c8b6dc', dome2: '#ddd0ea', band: '#8f7fb0', leg: '#efe8f0', joint: '#d8cce4', eye: '#2a2030', glint: '#9fe8d8', dark: '#4a3c60' }, props: ['band', 'dust'] },
    buried: { name: 'ash grub', palette: { dome: '#8d8a86', dome2: '#a8a49c', band: '#6a6660', leg: '#cfc8bc', joint: '#b0a898', eye: '#2a2420', glint: '#ff9a5a', seam: '#ff8a4c', dark: '#2e2a28' }, props: ['seam'] },
    moonfoundry: { name: 'furnace beetle', palette: { dome: '#4a4a4e', dome2: '#5e5e62', band: '#38383c', leg: '#efe4cc', joint: '#ddd0b4', eye: '#2a2020', glint: '#ff9a3e', seam: '#ff7a2e', dark: '#1e1c1e' }, props: ['seam'] },
    underside: { name: 'bridge crawler', palette: { dome: '#4c566a', dome2: '#5f6a80', band: '#a7b6c9', leg: '#c9d2dc', joint: '#8a96a8', eye: '#1a1e28', glint: '#bfe9ff', dark: '#22283a' }, props: ['rivets'] },
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
    // (sheet-1: mottled moss-green skin with pale lilac spots and warts, a cream belly, the throat sac pale lilac, violet
    // shadows, heavy-lidded golden eyes; sheet-2: slate-blue skin with lilac spots, an ivory belly, pink lids and toe
    // tips, a brass valve and a pressure gauge growing from its back, the swollen sac holding hot water and steam)
    perdide: { name: 'spore toad', palette: { skin: '#8d9b5f', skin2: '#a6ae74', spots: '#b9a6d2', belly: '#efe4c4', sac: '#c4b1d9', dark: '#4c4060', eye: '#d6b450', lid: '#8d9b5f', toe: '#b4a8c4', glob: '#9a7fb8', dots: '#5a4878' }, props: [] },
    incal: { name: 'pressure toad', palette: { skin: '#6c84a6', skin2: '#8498b8', spots: '#ab9cc8', belly: '#efe6cf', sac: '#c8b2da', dark: '#363c5a', eye: '#2a2024', lid: '#e4a6b4', toe: '#e2a8b6', glob: '#f0a078', dots: '#ffd8a0', brass: '#c49a52' }, props: ['valve', 'gauge', 'steam'], moves: ['volley'] },
    waterfall: { name: 'pressure-jet toad', palette: { skin: '#e8907e', skin2: '#f2ad9a', spots: '#f6e6c8', belly: '#f7ecd8', sac: '#f4c6b4', dark: '#6a3a40', eye: '#2a2024', lid: '#e8907e', toe: '#f2c0b0', glob: '#9fd8e8', dots: '#e8f8ff', brass: '#c49a52' }, props: ['jet'], moves: ['volley'] },
    home: { name: 'bulb toad', palette: { skin: '#9bbf6a', skin2: '#b4d488', spots: '#f2a4c0', belly: '#f4ecd0', sac: '#f2c4d8', dark: '#3f5a3a', eye: '#2a2024', lid: '#9bbf6a', toe: '#c8dca8', glob: '#f2a4c0', dots: '#fff0f6', flower: '#f2a4c0' }, props: ['flower'], arena: true },
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
    // (sheet-1: a cream glazed clay jug with ochre painted bands and little ochre marks between them, a cream neck and
    // head, sand-gold legs and toes, a sand bill tipped turquoise; sheet-2: a slim feathered pale blue body with folded
    // wings and a fan of tail feathers, a pale neck, a hooked ivory bill, a crest of rust-red feathers, ivory legs)
    desert: { name: 'cistern heron', palette: { body: '#efe6cc', body2: '#f7f0dc', band: '#d9a050', neck: '#ece2c6', bill: '#d9bc7c', tip: '#5fbfb0', leg: '#d9bc7c', joint: '#c49a5a', eye: '#2a2018', crest: '#ece2c6', dark: '#6a5a40' }, props: ['jug'] },
    arzach: { name: 'ridge runner', palette: { body: '#a2c8de', body2: '#c8e0ec', band: '#7ea8c6', neck: '#d4e6ee', bill: '#ebe0c6', tip: '#c6b48e', leg: '#e8dec8', joint: '#cbbb96', eye: '#2a2018', crest: '#d2603e', dark: '#3a5466' }, props: ['feathers', 'wings', 'crest', 'hook'] },
    perdide: { name: 'marsh snapper', palette: { body: '#9aa874', body2: '#b4bf8e', band: '#7d8a5a', neck: '#c4caa2', bill: '#d8cfb0', tip: '#7d9a5c', leg: '#d6d0b4', joint: '#b4a8c4', eye: '#2a2030', crest: '#c8b6dc', dark: '#4a4060' }, props: ['feathers', 'cap'] },
    mangrove: { name: 'root wader', palette: { body: '#efeae0', body2: '#f8f5ee', band: '#d8d0c0', neck: '#f2eee6', bill: '#b8ab92', tip: '#6a6050', leg: '#e2dccd', joint: '#b8ab92', eye: '#2a2820', crest: '#efeae0', dark: '#5a5040' }, props: ['feathers', 'roots'] },
  },
  roller: {
    spheres: { name: 'pearl roller', palette: { body: '#f2ece2', accent: '#c8b8d8' } },
    garage: { name: 'ball-bearing snail', palette: { body: '#a8b0b4', accent: '#3b5a5a' } },
    saltharbour: { name: 'brine mollusk', palette: { body: '#dfe8ea', accent: '#4f7fa8' } },
    spacecity: { name: 'magnetic mollusk', palette: { body: '#d8dff2', accent: '#5f7fd8' } },
    mangrove: { name: 'salt mollusk', palette: { body: '#f4f1ea', accent: '#b8ab92' } },
  },
  rootknot: {
    // (sheet-1: a pale lilac cap with cream gills and a few pale warts, a reed-green bulb ribbed top to bottom with small
    // pale dots, ochre root-arms, lilac tendrils, two pale glowing eyes, violet shadows; sheet-2: a deep teal cap over
    // softly glowing turquoise gills, a red-brown bulb, dark bark-brown roots, brass spores drifting)
    perdide: { name: 'reed knot', palette: { cap: '#c6b2d8', cap2: '#d8c8e6', gill: '#efe2c8', bulb: '#a4bea6', bulb2: '#bcd0bc', root: '#d8b468', root2: '#c09650', tendril: '#bca8d4', eye: '#fff4c8', dark: '#55466c', spore: '#e8d8f0' }, props: [] },
    perdide2: { name: 'root crawler', palette: { cap: '#2f6f72', cap2: '#3f8486', gill: '#5fe8d8', bulb: '#a8473c', bulb2: '#bd5c4c', root: '#6a4a30', root2: '#553a24', tendril: '#9a4a3c', eye: '#7ff0e8', dark: '#2a1e18', spore: '#d8b048' }, props: ['glow', 'spores'], moves: ['puff'] },
    edena: { name: 'topiary knot', palette: { cap: '#6fa85c', cap2: '#88bf72', gill: '#d8e8a8', bulb: '#5a8a4a', bulb2: '#6f9f5c', root: '#8a6a48', root2: '#6a503a', tendril: '#4a7a3c', eye: '#f8f0c0', dark: '#2a3a24', spore: '#f0f4d0' }, props: ['clipped'] },
    mangrove: { name: 'mangrove knot', palette: { cap: '#d8d0c0', cap2: '#e8e2d4', gill: '#b8ab92', bulb: '#c8bfa8', bulb2: '#d8d0bc', root: '#efeae0', root2: '#d8d0c0', tendril: '#b8ab92', eye: '#9fe8d8', dark: '#5a5040', spore: '#f4f0e8' }, props: [] },
    waterfall: { name: 'weed knot', palette: { cap: '#2f3a3c', cap2: '#46575a', gill: '#6fa8a0', bulb: '#3a4a48', bulb2: '#4a5c5a', root: '#2a3432', root2: '#1e2826', tendril: '#5a7a70', eye: '#bff0e8', dark: '#121718', spore: '#bff0e8' }, props: ['slick'] },
  },
  jelly: {
    arzach2: { name: 'cloud jelly', palette: { bell: '#efc4d4', bell2: '#f8dce6', under: '#a8c8e0', thread: '#d8e4ec', lantern: '#b39464', light: '#ffc27a', eye: '#1a1420', dark: '#8a6a78' }, props: ['paper', 'puffy'] },
    perdide2: { name: 'lamp jelly', palette: { bell: '#c8453e', bell2: '#e06a5a', thread: '#a8342e', lantern: '#b8955a', light: '#ffd27a', eye: '#fff2c0', dark: '#4a1a18' }, props: ['brass'], moves: ['mend'] },
    spheres: { name: 'halo jelly', palette: { bell: '#efe7f2', bell2: '#f8f4fa', thread: '#c8b8d8', lantern: '#e8f8ff', light: '#a8e0f2', eye: '#4a4058', dark: '#6a5a80' }, props: ['prism', 'halo'], moves: ['mend'] },
    // (sheet-2: white porcelain with cobalt bands and medallions, cobalt under the bell, coral-red threads, yellow glass lanterns in brass nets)
    underwater: { name: 'porcelain jelly', palette: { bell: '#f4f1ea', bell2: '#ffffff', under: '#3550a8', thread: '#e2787e', lantern: '#b8955a', light: '#ffe28a', eye: '#2a4a5a', dark: '#3550a8' }, props: ['float', 'glaze'], moves: ['mend'] },
    fallenring: { name: 'sun jelly', palette: { bell: '#3f8f8a', bell2: '#5aa8a0', thread: '#2a6a66', lantern: '#ffcf8a', light: '#ff9a3e', eye: '#fff4b0', dark: '#16302e' }, props: ['core'], moves: ['mend'] },
  },
  moth: {
    perdide2: { name: 'lamp moth', palette: { wing: '#a39bbf', wing2: '#c8c2d8', body: '#f2cf86', spot: '#d8504a', glow: '#fff2d0', antenna: '#c9a050', eye: '#1a1420' }, props: ['lit', 'dusty'], moves: ['dust'] },
    edena: { name: 'glass wasp', palette: { wing: '#f2b8c8', wing2: '#f8dce4', body: '#f7d8a8', spot: '#e0607a', glow: '#fff0f4', antenna: '#5a3a44', eye: '#2a1e24' }, props: ['wasp'] },
    bazaar: { name: 'sign moth', palette: { wing: '#2a1f36', wing2: '#3a2c48', body: '#ff9ac8', spot: '#5ff0e8', glow: '#ffffff', antenna: '#ff5fa2', eye: '#101018' }, props: ['neon', 'letters'] },
    // (sheet-2: cream paper wings traced with copper, a mint-green lantern, copper hood and legs)
    antennas: { name: 'signal moth', palette: { wing: '#efe4c8', wing2: '#f7efda', body: '#cfe5c6', spot: '#9fd0b8', glow: '#eefbe8', antenna: '#b0683c', eye: '#2a2018' }, props: ['dish'], moves: ['dust'] },
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
    // (sheet-1, the Hangar's: black-teal and gunmetal steel, patched khaki canvas covers, bronze bolts, a glowing orange lip,
    // the brew ink-black and violet, two welding-torch arms; sheet-2, the Moon Foundry's: cream enamel with chipped edges,
    // soot-darkened brass, glowing ember slag at the lip, no torch arms)
    garage: { name: 'welding cart', palette: { body: '#3e5a5c', body2: '#4f6e70', brass: '#a8854e', dark: '#1e2626', canvas: '#9c8e70', canvas2: '#7a6e56', pot: '#4a6466', pot2: '#5c7678', track: '#3a3c3c', wheel: '#55605e', brew: '#1d1626', lip: '#ff9a3e', slag: '#ff8a2e', slag2: '#ffd36a', smoke: '#1c1a1e', smoke2: '#55525a', eye: '#f8f4ff', crust: '#7a8590', flame: '#ffd27a', dust: '#8a8072', rust: '#a0603e' }, props: ['torches'] },
    buried: { name: 'ore cart', palette: { body: '#7a5a40', body2: '#8e6c50', brass: '#8a5a3a', dark: '#2e2620', canvas: '#8a7058', canvas2: '#6a5444', pot: '#8a4f32', pot2: '#a0603e', track: '#3a3430', wheel: '#5a4a40', brew: '#1d1626', lip: '#ff7a2e', slag: '#ff7a2e', slag2: '#ffc06a', smoke: '#1b1720', smoke2: '#3e3048', eye: '#ffe0c0', crust: '#7a7a80', dust: '#8d8a86', rust: '#b06a3a' }, props: ['bucket'] },
    moonfoundry: { name: 'crucible cart', palette: { body: '#ece2c8', body2: '#f6eedc', brass: '#9a7a48', dark: '#3a2e26', canvas: '#e6dcc2', canvas2: '#c9bc9c', pot: '#efe6d0', pot2: '#f8f2e2', track: '#4a3e34', wheel: '#9a7a48', brew: '#e8783a', lip: '#ffb06a', slag: '#ff8a3e', slag2: '#ffd36a', smoke: '#2a2228', smoke2: '#5a4a4a', eye: '#fff6e0', crust: '#8a8a8a', dust: '#a89a84', rust: '#5a4a3e' }, props: ['ember'] },
    overnighttrain: { name: 'luggage trolley', palette: { body: '#8a5a3a', body2: '#a06e4a', brass: '#d8b048', dark: '#2a2018', canvas: '#a67c52', canvas2: '#7a5a3a', pot: '#6a4a32', pot2: '#7e5a3e', track: '#2a2420', wheel: '#d8b048', brew: '#1d1626', lip: '#d8b048', slag: '#ff8a2e', slag2: '#ffd36a', smoke: '#1b1720', smoke2: '#4a3a5e', eye: '#fff4d8', crust: '#7a7a80', dust: '#8a8072', rust: '#7a4a2e' }, props: ['trolley'], arena: true },
  },
  bell: {
    // (sheet-1, the Signal Market's: aged bronze with teal verdigris, a brass yoke hung with little coins and patched cloth
    // pennants, amber accents, the spirit ink-black and violet; sheet-2, the Salt Harbour's: a weathered cream winch drum
    // in the yoke, its chain and hook swinging below as the clapper, a turquoise yoke with rusty coral plates, salt crust)
    bazaar: { name: 'sign automaton', palette: { bell: '#c4a96a', bell2: '#d4bc82', bellInside: '#4a4030', verd: '#6fb5a2', yoke: '#b89448', leg: '#b39a5a', joint: '#7fb5a0', dark: '#3a3228', spirit: '#1a1622', shine: '#6a4a9e', eye: '#f8f4ff', coin: '#d8b048', cloth: '#b8a8d8', clapper: '#5a5048' }, props: ['coins', 'pennants'] },
    saltharbour: { name: 'dock winch', palette: { bell: '#ece2cc', bell2: '#f6eedc', bellInside: '#4a4a52', verd: '#d9826a', yoke: '#6fc2b4', leg: '#6fc2b4', joint: '#d9826a', dark: '#3a3a48', spirit: '#1a1622', shine: '#5a4a8e', eye: '#f8f4ff', chain: '#8a8e94', drum2: '#e8dcc6', salt: '#f8f6ee' }, props: ['winch', 'salt'] },
    underside: { name: 'cable crane', palette: { bell: '#4c566a', bell2: '#5f6a80', bellInside: '#22283a', verd: '#8a96a8', yoke: '#d8b048', leg: '#4c566a', joint: '#d8b048', dark: '#22283a', spirit: '#14121c', shine: '#5a5a8e', eye: '#f4f0ff', chain: '#cdd2d8', drum2: '#d8b048', salt: '#a7b6c9' }, props: ['winch'] },
  },
  drone: {
    // (sheet-1, the City-Shaft's: weathered brass plates with pink rust, ivory enamel rims, slate-blue undersides, the smoke
    // ink-black and violet; sheet-2, the Garden of Spheres': pearl-white plates with fine gold rims, gold arms, a faint prism
    // shimmer, the smoke a pale blue-grey)
    incal: { name: 'rust drone', palette: { plate: '#c9a868', plate2: '#d8bc84', rim: '#efe5cd', under: '#7088a8', dark: '#2e2a2c', brass: '#b8924e', smoke: '#2c2834', smoke2: '#6e6680', eye: '#f6f2ff', steel: '#d0d4da', rust: '#d9998a', accent: '#7088a8' }, props: ['rust'] },
    garage: { name: 'scrap drone', palette: { plate: '#6a6e6a', plate2: '#7e827c', rim: '#9a9488', under: '#3a3a3a', dark: '#1e1e1e', brass: '#a07a48', smoke: '#1c1a20', smoke2: '#3e3a46', eye: '#f4f4e8', rust: '#a0603e', tints: ['#7a5a3e', null, '#5f6b4a'] }, props: ['scrap'] },
    spheres: { name: 'ring drone', palette: { plate: '#f6f2ea', plate2: '#fdfbf6', rim: '#f8f4ee', under: '#e4dfe8', dark: '#8a7a5a', vent: '#d8b048', brass: '#d8b048', smoke: '#9aa0b4', smoke2: '#cfd4e2', eye: '#ffffff', rust: '#e8d8f0', accent: '#d8b048' }, props: ['pearl'] },
    antennas: { name: 'relay drone', palette: { plate: '#c98a54', plate2: '#d8a070', rim: '#efe4c8', under: '#5a6a5a', dark: '#2a2622', brass: '#c98a54', smoke: '#1f1a26', smoke2: '#4a3a5a', eye: '#e8f07a', rust: '#6fbf9a' }, props: ['dish'] },
    spacecity: { name: 'airlock drone', palette: { plate: '#f4f4f0', plate2: '#ffffff', rim: '#f8f8f6', under: '#b8c4dc', dark: '#2a3048', brass: '#8fa8e8', smoke: '#1c1e2a', smoke2: '#3a4466', eye: '#dff0ff', rust: '#c8d4ec', accent: '#5f7fd8' }, props: ['stripe'] },
    fallenring: { name: 'gyroscope drone', palette: { plate: '#e8efe8', plate2: '#f4f8f4', rim: '#d8b048', under: '#3f8f8a', dark: '#24302e', brass: '#d8b048', smoke: '#1c2624', smoke2: '#3a5a56', eye: '#fff4b0', rust: '#7fb59a' }, props: ['gyro'] },
  },
  brute: {
    // (sheet-1, Lorn II's wood cutter: old ivory hull with brass fittings, cracked all over, the widest cracks glowing violet,
    // tar dripping, dark roots and moss grown over it, a rusted saw blade in one fist, deep teal shadows; sheet-2, the Glass
    // Dunes' furnace walker: plated in faceted pale aqua glass over a sand-gold hull, the cracks glowing orange, a glowing
    // furnace door in its chest)
    perdide2: { name: 'wood cutter', palette: { body: '#e6d8b4', body2: '#efe5c8', joint: '#d6c69e', brass: '#b38d4e', verd: '#6f9a8a', tar: '#1d1a26', core: '#c9a25a', glow: '#a77bff', seam: '#4a4452', slab: '#8a7f70', root: '#3b3127', moss: '#6f8a3a', saw: '#a8693e', dark: '#2a2622' }, props: ['roots', 'saw'] },
    edena: { name: 'pruning machine', palette: { body: '#ece6d4', body2: '#f6f1e2', joint: '#d9d2bd', brass: '#8fae7a', verd: '#5f9a7a', tar: '#1d1a26', core: '#a6d86a', glow: '#9a6cff', seam: '#46503f', slab: '#6f7a5a', root: '#4f6a3a', moss: '#7fb85c', blade: '#cfd4d8', dark: '#26302a' }, props: ['shears', 'roots'] },
    glassdunes: { name: 'furnace walker', palette: { body: '#a9ded6', body2: '#d8f3ef', joint: '#c9a868', brass: '#c9a35e', verd: '#e8c88a', tar: '#1d1a26', core: '#ffa23e', glow: '#ff7a2e', seam: '#f2dfaa', slab: '#c9e8e0', dark: '#2a3a38' }, props: ['door'] },
    waterfall: { name: 'turbine guardian', palette: { body: '#b9c6cc', body2: '#d2dde2', joint: '#8fa3ad', brass: '#c49a52', verd: '#5f9fb8', tar: '#1a2028', core: '#9fe0ff', glow: '#8f7bff', seam: '#2e3a44', slab: '#6f8a94', dark: '#1e262c' }, props: ['turbine', 'wet'] },
    moonfoundry: { name: 'crucible hand', palette: { body: '#ece0c4', body2: '#f6ecd6', joint: '#5a4a3e', brass: '#8a6a3a', verd: '#4a3a30', tar: '#1d1a20', core: '#ff9a3e', glow: '#ff7a2e', seam: '#3a2e28', slab: '#5a4e46', dark: '#2a2220' }, props: ['ladle'] },
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
