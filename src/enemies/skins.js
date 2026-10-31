import { ARCHETYPES } from './archetypes.js';
import { PARTS } from '../levels/names.js';

// Each archetype in each world's skin (docs/design/enemy-roster.md, every archetype's "Worlds and skins"): a skin
// only recolours and dresses the archetype's body (src/enemies/plans/), and may add a skin-only move.
//
//   SKINS[archetype][world] = { name, palette: { … }, props: [ … ], scale, moves: [ … ] }
//     palette  the colours its body builder reads (each plan its own keys; missing ones fall back to the first skin's)
//     props    what dresses it: lichen, antennae, an awning, barnacles and rope, glass facets, coral, patina, coins…
//     moves    skin-only attacks (an attack's `skins`: the crab's burrow in the Salt Harbour and Underwater)
//     scale    how big it is drawn, over its archetype's own (ARCHETYPES[a].scale: the foes grown to the traveller, #741)
//     arena    a skin met only in the Arena (Home, the Atelier, the Overnight Train stay peaceful)
// The first world listed is the archetype's own skin: where it is met first, and what the Arena shows by default.

export const SKINS = {
  crab: {
    // (the shellback, issue #800: its home skin the approved reference's colours, references/enemy-redesign-2026-10-30/
    // shellback/e8102be7-…-2.png: an ochre dome, cream legs and face, red feet and pincers, a green collar, slit eyes;
    // the other worlds' skins recolour the same five on its body, src/enemies/plans/shellback-tripo.js; its green collar is
    // the model's own, ROLES: a key here would be every other skin's too, skinOf)
    arzach2: { name: 'cliff crab', palette: { shell: '#df9f45', shell2: '#e9b45f', under: '#f1e2ae', leg: '#f1e2ae', joint: '#e7d39a', claw: '#c75f3a', dark: '#3a2c22', eye: '#1e1d24', accent: '#f4e7bf' }, props: [] },
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
    // (the seedpod skitter, issue #800: its home skin the approved reference's colours,
    // references/enemy-redesign-2026-10-30/keep-skitter/711f83a4-…-1.png: an orange shell and head plate, a cream
    // underside, brown legs, two black dot eyes; the other skins recolour the same parts, src/enemies/plans/skitter-tripo.js)
    desert: { name: 'dune skitter', palette: { dome: '#cf8553', dome2: '#d9966a', band: '#efe6c3', leg: '#b8703f', joint: '#a8653a', eye: '#1e1a18', glint: '#f2e8d0', seam: '#ff7a2e', dark: '#5a3a22' }, props: ['band'] },
    perdide: { name: 'spore mite', palette: { dome: '#c8b6dc', dome2: '#ddd0ea', band: '#8f7fb0', leg: '#efe8f0', joint: '#d8cce4', eye: '#2a2030', glint: '#9fe8d8', dark: '#4a3c60' }, props: ['band', 'dust'] },
    buried: { name: 'ash grub', palette: { dome: '#8d8a86', dome2: '#a8a49c', band: '#6a6660', leg: '#cfc8bc', joint: '#b0a898', eye: '#2a2420', glint: '#ff9a5a', seam: '#ff8a4c', dark: '#2e2a28' }, props: ['seam'] },
    moonfoundry: { name: 'furnace beetle', palette: { dome: '#4a4a4e', dome2: '#5e5e62', band: '#38383c', leg: '#efe4cc', joint: '#ddd0b4', eye: '#2a2020', glint: '#ff9a3e', seam: '#ff7a2e', dark: '#1e1c1e' }, props: ['seam'] },
    underside: { name: 'bridge crawler', palette: { dome: '#4c566a', dome2: '#5f6a80', band: '#a7b6c9', leg: '#c9d2dc', joint: '#8a96a8', eye: '#1a1e28', glint: '#bfe9ff', dark: '#22283a' }, props: ['rivets'] },
  },
  centipede: {
    // (the drill-head centipede, issue #800: its home skin the approved reference's colours,
    // references/enemy-redesign-2026-10-30/centipede/616e0bd4-…-3.png: salmon plates, head and legs, a dark teal under
    // them, a cream underside, dark slit eyes; the other skins recolour the same parts on its body,
    // src/enemies/plans/centipede-tripo.js)
    buried: { name: 'drill-head centipede', palette: { plate: '#d9876b', plate2: '#e39c82', under: '#f2ead0', leg: '#d9876b', head: '#d9876b', accent: '#d8743a', dark: '#1f3a37', eye: '#1d2a28' }, props: ['bands', 'drill'] },
    spheres: { name: 'pearl centipede', palette: { plate: '#efe7dc', plate2: '#f8f2ea', under: '#d8cfe0', leg: '#b8a8c8', head: '#e8dff0', accent: '#c8b8d8', dark: '#4a4058', eye: '#9fd8f2' }, props: ['pearl'] },
    fallenring: { name: 'orbital centipede', palette: { plate: '#3f8f8a', plate2: '#5aa8a0', under: '#d8e8e0', leg: '#2a5a58', head: '#d8b048', accent: '#d8b048', dark: '#16302e', eye: '#fff4b0' }, props: ['gold'] },
    eclipse: { name: 'crescent crawler', palette: { plate: '#5b4a86', plate2: '#7a66a8', under: '#cfc2e8', leg: '#3a2e5a', head: '#4a3c70', accent: '#d6c2ff', dark: '#1d1630', eye: '#d6ffb0' }, props: ['glow'] },
    waterfall: { name: 'drain crawler', palette: { plate: '#2f3a3c', plate2: '#46575a', under: '#8fa8a8', leg: '#20292a', head: '#2a3436', accent: '#6fa8a0', dark: '#121718', eye: '#bff0e8' }, props: ['slick'] },
    antennas: { name: 'wire-wound centipede', palette: { plate: '#6a5848', plate2: '#86705a', under: '#d8c8a8', leg: '#4a3a2e', head: '#5a4a3c', accent: '#c98a54', dark: '#2a2018', eye: '#e8f07a' }, props: ['wire'] },
  },
  toad: {
    // (the bellows toad, issue #800: its home skin the approved reference's colours, references/enemy-redesign-2026-10-30/
    // bellows-toad/c5a76758-…-0.png: a plain sage skin, an orange belly, paler orange webbed feet, heavy-lidded eyes; the
    // other worlds' skins recolour the same parts on its body, src/enemies/plans/toad-tripo.js, and keep their sheets' looks:
    // sheet-2's slate-blue skin with lilac spots, an ivory belly, pink lids and toe tips, a brass valve and a pressure gauge
    // growing from its back, the swollen sac holding hot water and steam)
    perdide: { name: 'spore toad', palette: { skin: '#9bbb85', skin2: '#a9c695', spots: '#b9a6d2', belly: '#f0bd72', sac: '#f6d6a0', dark: '#3f4a32', eye: '#e9a85a', lid: '#9bbb85', toe: '#f2c27e', glob: '#b8c95a', dots: '#e8f0b0' }, props: [] },
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
    // (sheet-1, the Hangar's ball-bearing snail: a polished steel shell with an oily rainbow sheen along its spiral, riveted
    // plates and a band, a dark teal foot, black-teal shadows; sheet-2, the Garden of Spheres' pearl shell: ivory, blush
    // pink and pale gold, its spiral faintly glowing gold, a pale lilac foot, a brass wind-up key in its back)
    garage: { name: 'ball-bearing snail', palette: { shell: '#c3c8cc', shell2: '#e8ebee', band: '#8e979e', spiral: '#9ba3aa', foot: '#3c676c', foot2: '#2b4d52', stalk: '#477277', eye: '#1c2224', rain1: '#e2bcd8', rain2: '#a9dadb', rain3: '#e4dca4', flare: '#f3a361', dust: '#8a8a82' } },
    spheres: { name: 'pearl roller', palette: { shell: '#f3e8dc', shell2: '#faf3ea', band: '#d6bd86', spiral: '#f0c062', foot: '#c9b1d9', foot2: '#a98fbd', stalk: '#c9b1d9', eye: '#3a2a22', rain1: '#f5c6d6', rain2: '#f2d995', rain3: '#d9ecf2', key: '#c9a35e', flare: '#ffd27a', dust: '#e6dccb' }, props: ['pearl', 'key', 'runners'] },
    saltharbour: { name: 'brine mollusk', palette: { shell: '#d8e2e4', shell2: '#f2f5f2', band: '#4f7fa8', spiral: '#3f6a8a', foot: '#4f7f8a', foot2: '#365f6a', stalk: '#5a8a94', eye: '#1e2a30', rain1: '#f2f5f2', rain2: '#bcd6dc', rain3: '#e8e2cc', dust: '#d8d0c0' }, props: ['salt'] },
    spacecity: { name: 'magnetic mollusk', palette: { shell: '#d2daf0', shell2: '#eef1fa', band: '#5f7fd8', spiral: '#8fa8ff', foot: '#3a4a8a', foot2: '#2a3668', stalk: '#4a5aa0', eye: '#e8f0ff', rain1: '#b8c8ff', rain2: '#f0c8ff', rain3: '#c8f0ff', flare: '#8fdcff', dust: '#8a90a8' }, props: ['bands'] },
    mangrove: { name: 'salt mollusk', palette: { shell: '#f2efe6', shell2: '#fbfaf5', band: '#b8ab92', spiral: '#a89a80', foot: '#c8bca8', foot2: '#a89c88', stalk: '#cfc3ae', eye: '#2a2620', rain1: '#efe8d8', rain2: '#e2dccb', rain3: '#f6f2e6', dust: '#e8e2d2' }, props: ['chalk'] },
  },
  rootknot: {
    // (sheet-1: a pale lilac cap with cream gills and a few pale warts, a reed-green bulb ribbed top to bottom with small
    // pale dots, ochre root-arms, lilac tendrils, two pale glowing eyes, violet shadows; sheet-2: a deep teal cap over
    // softly glowing turquoise gills, a red-brown bulb, dark bark-brown roots, brass spores drifting)
    // (issue #800: the Tripo reed knot, src/enemies/plans/rootknot-tripo.js; its home skin the approved reference's colours,
    // references/enemy-redesign-2026-10-30/reed-knot/0de92fb6-…-1.png: a mauve cap, its underside in its shade, a sage bulb,
    // orange legs, pale slit eyes)
    perdide: { name: 'reed knot', palette: { cap: '#b57f77', cap2: '#c4938b', gill: '#8e5f5a', bulb: '#88ac95', bulb2: '#9dbda8', root: '#f6bf78', root2: '#e0a35c', tendril: '#bca8d4', eye: '#f9f3c0', dark: '#55466c', spore: '#e8d8f0' }, props: [] },
    perdide2: { name: 'root crawler', palette: { cap: '#2f6f72', cap2: '#3f8486', gill: '#5fe8d8', bulb: '#a8473c', bulb2: '#bd5c4c', root: '#6a4a30', root2: '#553a24', tendril: '#9a4a3c', eye: '#7ff0e8', dark: '#2a1e18', spore: '#d8b048' }, props: ['glow', 'spores'], moves: ['puff'] },
    edena: { name: 'topiary knot', palette: { cap: '#6fa85c', cap2: '#88bf72', gill: '#d8e8a8', bulb: '#5a8a4a', bulb2: '#6f9f5c', root: '#8a6a48', root2: '#6a503a', tendril: '#4a7a3c', eye: '#f8f0c0', dark: '#2a3a24', spore: '#f0f4d0' }, props: ['clipped'] },
    mangrove: { name: 'mangrove knot', palette: { cap: '#d8d0c0', cap2: '#e8e2d4', gill: '#b8ab92', bulb: '#c8bfa8', bulb2: '#d8d0bc', root: '#efeae0', root2: '#d8d0c0', tendril: '#b8ab92', eye: '#9fe8d8', dark: '#5a5040', spore: '#f4f0e8' }, props: [] },
    waterfall: { name: 'weed knot', palette: { cap: '#2f3a3c', cap2: '#46575a', gill: '#6fa8a0', bulb: '#3a4a48', bulb2: '#4a5c5a', root: '#2a3432', root2: '#1e2826', tendril: '#5a7a70', eye: '#bff0e8', dark: '#121718', spore: '#bff0e8' }, props: ['slick'] },
  },
  jelly: {
    // (#800: the approved image's colours, cloud-jelly/0cdfba00-…-1.png: a cream cap, a sage skirt, stems and curled arms, salmon
    // lanterns with dark tips; the Tripo body's texture is painted in them)
    arzach2: { name: 'cloud jelly', palette: { bell: '#efdcb4', bell2: '#f7ead0', under: '#8fa984', thread: '#8fa984', lantern: '#e3a07e', light: '#e9a884', eye: '#1e1d24', dark: '#2a2a22' }, props: ['paper', 'puffy'] },
    perdide2: { name: 'lamp jelly', palette: { bell: '#c8453e', bell2: '#e06a5a', thread: '#a8342e', lantern: '#b8955a', light: '#ffd27a', eye: '#fff2c0', dark: '#4a1a18' }, props: ['brass'], moves: ['mend'] },
    spheres: { name: 'halo jelly', palette: { bell: '#efe7f2', bell2: '#f8f4fa', thread: '#c8b8d8', lantern: '#e8f8ff', light: '#a8e0f2', eye: '#4a4058', dark: '#6a5a80' }, props: ['prism', 'halo'], moves: ['mend'] },
    // (sheet-2: white porcelain with cobalt bands and medallions, cobalt under the bell, coral-red threads, yellow glass lanterns in brass nets)
    underwater: { name: 'porcelain jelly', palette: { bell: '#f4f1ea', bell2: '#ffffff', under: '#3550a8', thread: '#e2787e', lantern: '#b8955a', light: '#ffe28a', eye: '#2a4a5a', dark: '#3550a8' }, props: ['float', 'glaze'], moves: ['mend'] },
    fallenring: { name: 'sun jelly', palette: { bell: '#3f8f8a', bell2: '#5aa8a0', thread: '#2a6a66', lantern: '#ffcf8a', light: '#ff9a3e', eye: '#fff4b0', dark: '#16302e' }, props: ['core'], moves: ['mend'] },
  },
  moth: {
    // (#800: the approved image's colours, lamp-moth/5b88e9ea-…-1.png: lilac wings with cream eye-spots, an orange body on two
    // stubby feet, a cream head with dark eyes, dark antennae with orange tips; the Tripo body's texture is painted in them)
    perdide2: { name: 'lamp moth', palette: { wing: '#b3a7c3', wing2: '#c9bfd6', body: '#e7aa6e', spot: '#a4574a', glow: '#f5e8c3', antenna: '#2b2620', eye: '#1e1d24' }, props: ['lit', 'dusty'], moves: ['dust'] },
    edena: { name: 'glass wasp', palette: { wing: '#f2b8c8', wing2: '#f8dce4', body: '#f7d8a8', spot: '#e0607a', glow: '#fff0f4', antenna: '#5a3a44', eye: '#2a1e24' }, props: ['wasp'] },
    bazaar: { name: 'sign moth', palette: { wing: '#2a1f36', wing2: '#3a2c48', body: '#ff9ac8', spot: '#5ff0e8', glow: '#ffffff', antenna: '#ff5fa2', eye: '#101018' }, props: ['neon', 'letters'] },
    // (sheet-2: cream paper wings traced with copper, a mint-green lantern, copper hood and legs)
    antennas: { name: 'signal moth', palette: { wing: '#efe4c8', wing2: '#f7efda', body: '#cfe5c6', spot: '#9fd0b8', glow: '#eefbe8', antenna: '#b0683c', eye: '#2a2018' }, props: ['dish'], moves: ['dust'] },
    spacecity: { name: 'space moth', palette: { wing: '#5f7fd8', wing2: '#a8b8f0', body: '#d8f0ff', spot: '#f2f4ff', glow: '#ffffff', antenna: '#d8dff2', eye: '#101830' }, props: ['sail'] },
  },
  ray: {
    // (#800: the approved image's colours, storm-ray/4fc2da68-…-0.png: a teal back and wings, a cream belly and undersides, the
    // wing tips red-brown; the Tripo body's texture is painted in them)
    arzach: { name: 'storm ray', palette: { top: '#5f8578', top2: '#78a090', under: '#e6d6aa', edge: '#a5523c', spots: '#3e6654', eye: '#1b1f1d', tail: '#5f8578' }, props: [], moves: ['draft'] },
    arzach2: { name: 'cloud ray', palette: { top: '#e8e4ec', top2: '#f6f4f8', under: '#ffffff', edge: '#a8c8e0', spots: '#a8c8e0', eye: '#4a6a8a', tail: '#a8b8c8' }, props: ['mist'], moves: ['draft'] },
    garage: { name: 'scrap ray', palette: { top: '#b8a888', top2: '#cdbf9e', under: '#e8dcc0', edge: '#5a5654', spots: '#5a5654', eye: '#ffb347', tail: '#3a3634' }, props: ['patches', 'wire'] },
    glassdunes: { name: 'glass manta', palette: { top: '#8fd9c0', top2: '#c9f2e2', under: '#e8f8f0', edge: '#ffffff', spots: '#ffffff', eye: '#fff4b0', tail: '#5fbf9f' }, props: ['facets'] },
    underwater: { name: 'porcelain ray', palette: { top: '#f4f1ea', top2: '#ffffff', under: '#f8f6f0', edge: '#5f8fc8', spots: '#5f8fc8', eye: '#2a4a6a', tail: '#8fc8e8' }, props: ['ribbons', 'glaze'] },
    underside: { name: 'abyss ray', palette: { top: '#2f3348', top2: '#3e4460', under: '#7f8fc8', edge: '#9fb0e8', spots: '#9fb0e8', eye: '#bfe9ff', tail: '#1a1d2c' }, props: ['long', 'dark'] },
  },
  worm: {
    // (issue #800: the Tripo dune worm, src/enemies/plans/worm-tripo.js: its belly the inside of its curl, `belly`, its fin's
    // pale; its home skin the approved reference's colours, references/enemy-redesign-2026-10-30/dune-worm/ca727e90-…-3.png:
    // ochre, a cream belly and crown, a turquoise mouth, black dot eyes)
    desert: { name: 'dune worm', palette: { body: '#e5bb68', body2: '#d4a85a', belly: '#f1ebba', ring: '#c98a3a', sand: '#c99a62', mouth: '#33927f', teeth: '#f7f0dc', eye: '#1a1410', fin: '#e8d6aa' }, props: ['fin'] },
    buried: { name: 'drill grub', palette: { body: '#6a6080', body2: '#857aa0', belly: '#c8c4d8', ring: '#463e58', sand: '#6a625a', mouth: '#5a8a98', teeth: '#a8b0b4', eye: '#ff9a5a', fin: '#c8c4d8' }, props: ['drill'] },
    glassdunes: { name: 'glass worm', palette: { body: '#8fd9c0', body2: '#c9f2e2', belly: '#e8fff6', ring: '#5fbf9f', sand: '#a8d8c8', mouth: '#3f8f8a', teeth: '#ffffff', eye: '#fff4b0', fin: '#e8fff6' }, props: ['crest'] },
  },
  tripod: {
    // (sheet-1: ivory enamel, polished brass, slate-blue bands and panels, pink rust; sheet-2: a riveted coral-copper
    // diving bell with a turquoise band and several portholes, buttery yellow lamp, cream legs, black bubbles rising)
    // (the inspection tripod, issue #800: its home skin the approved reference's colours,
    // references/enemy-redesign-2026-10-30/keep-tripod/9bb4fd97-…-0.png: a cream lamp head, neck hub and shins, sage
    // brackets (`limb`), near-black joints, an orange lens; the other skins' `limb` is their accent, plans/tripod-tripo.js)
    incal: { name: 'inspection tripod', palette: { body: '#eac9ae', body2: '#f2d6bd', leg: '#ebe1c9', limb: '#5f7560', brass: '#c49a52', accent: '#7088a8', dark: '#2c2f33', lamp: '#fff3cc', lens: '#d27f45', rust: '#d99a8c' }, props: ['enamel'] },
    buried: { name: 'mining tripod', palette: { body: '#b8a58a', body2: '#cdbb9e', leg: '#c8b698', limb: '#8a5a3a', brass: '#8a5a3a', accent: '#b8603a', dark: '#2e2a28', lamp: '#ffd38a', rust: '#a0522d' }, props: ['drill'] },
    underwater: { name: 'diving bell', palette: { body: '#d68e78', body2: '#e6a690', leg: '#ecdcc0', limb: '#6db2a8', brass: '#c49a52', accent: '#6db2a8', dark: '#2a3036', lamp: '#ffe8a0', rust: '#b06a56' }, props: ['bell', 'portholes', 'key', 'bubbles'] },
    fallenring: { name: 'gyroscope tripod', palette: { body: '#e8efe8', body2: '#f4f8f4', leg: '#e8efe8', limb: '#3f8f8a', brass: '#d8b048', accent: '#3f8f8a', dark: '#24302e', lamp: '#fff4b0', rust: '#7fb59a' }, props: ['gyro'] },
    desert: { name: 'cistern pump', palette: { body: '#e9dfbb', body2: '#f2ead0', leg: '#e9dfbb', limb: '#b39464', brass: '#b39464', accent: '#cfa2a7', dark: '#3a2f28', lamp: '#fff2c0', rust: '#c98d4f' }, props: ['pump'] },
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
    // (the spool drone, issue #800: its home skin the approved reference's colours,
    // references/enemy-redesign-2026-10-30/keep-drone/e708a0d0-…-0.png: cream plates, a slate cap, an olive-brown pod, a dark
    // green-black core with an orange slit eye; the other skins' cap is their `under`, their pod their brass, plans/drone-tripo.js)
    incal: { name: 'rust drone', palette: { plate: '#ecc7a9', plate2: '#f4d6bd', rim: '#efe5cd', under: '#7088a8', cap: '#4e5d63', pod: '#6a4a2e', dark: '#121410', brass: '#b8924e', smoke: '#1d2b26', smoke2: '#36463f', eye: '#d8902e', steel: '#d0d4da', rust: '#d9998a', accent: '#7088a8' }, props: ['rust'] },
    garage: { name: 'scrap drone', palette: { plate: '#6a6e6a', plate2: '#7e827c', rim: '#9a9488', under: '#3a3a3a', dark: '#1e1e1e', brass: '#a07a48', smoke: '#1c1a20', smoke2: '#3e3a46', eye: '#f4f4e8', rust: '#a0603e', tints: ['#7a5a3e', null, '#5f6b4a'] }, props: ['scrap'] },
    // (the Glass Dunes: the Clock-House's drones, brass and cream marble, the glass's green in their eyes: October 2026)
    glassdunes: { name: 'clock drone', palette: { plate: '#e8dfcb', plate2: '#f4eee3', rim: '#d2a648', under: '#5ea79f', dark: '#34405e', brass: '#d2a648', smoke: '#2f5c4d', smoke2: '#7fbfae', eye: '#5fd8cc', rust: '#b8c9a0', accent: '#5fd8cc' }, props: ['pearl'] },
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
  woodcutter: {
    // (issue #800: the approved reference, references/enemy-redesign-2026-10-30/keep-brute/a1860f49-…-0.png: a sage robot,
    // a pale dome head with a black visor slit, an ochre vent, olive bands, dark joints, a toothed rust saw disc; its home,
    // Lorn II's Deep Wood. The other worlds' wear their furnace brutes' palettes and their own tools on the same body:
    // Viridel's shears, the Moon Foundry's clamp hand and ladle; src/enemies/plans/woodcutter.js)
    perdide2: { name: 'sawyer', palette: { body: '#7f9f88', body2: '#93b19a', joint: '#2f4b3b', head: '#e5cfbb', visor: '#18161c', saw: '#8c3d2c', clamp: '#7a3527', brass: '#c8922f', band: '#5c5c37', core: '#f0b54a', glow: '#f3a361', slab: '#8a7f70', dark: '#1e2622' }, props: ['saw'] },
    edena: { name: 'hedge cutter', palette: { body: '#ece6d4', body2: '#f6f1e2', joint: '#d9d2bd', brass: '#8fae7a', core: '#a6d86a', glow: '#9a6cff', slab: '#6f7a5a', blade: '#cfd4d8', dark: '#26302a' }, props: ['shears'] },
    moonfoundry: { name: 'ladle hand', palette: { body: '#ece0c4', body2: '#f6ecd6', joint: '#5a4a3e', brass: '#8a6a3a', core: '#ff9a3e', glow: '#ff7a2e', slab: '#5a4e46', dark: '#2a2220' }, props: ['ladle'] },
  },
  fencer: {
    // (issue #665: no picked sheet. The makers' high tech of their temples: ivory ceramic plates over a dark frame, brass
    // trim, seams of light; the Moon Foundry's warm with the furnaces' orange, the Space City's white and cyan with a round
    // shield, the Signal Market's champion in red lacquer with a long blade and a pennant down its back)
    moonfoundry: { name: 'foundry fencer', palette: { plate: '#e9dfc8', plate2: '#f4ecda', frame: '#2c2a33', trim: '#c9973f', steel: '#cfd3d8', seam: '#ff9a3c', shield: '#ddd2b8', eye: '#ffd27a', flare: '#ffefc0' }, props: [] },
    spacecity: { name: 'orbit fencer', palette: { plate: '#f2f1ec', plate2: '#fbfaf6', frame: '#2b3346', trim: '#9fb4d0', steel: '#dfe6ee', seam: '#6fe0ff', shield: '#e6e8ee', eye: '#bff4ff', flare: '#ffffff' }, props: ['round'] },
    bazaar: { name: 'market champion', palette: { plate: '#dcc8a0', plate2: '#ecdcb8', frame: '#3a2a30', trim: '#b0503a', steel: '#e0d6c4', seam: '#ffcf6a', shield: '#a8483a', eye: '#fff0c0', flare: '#ffffff' }, props: ['pennant', 'long'] },
  },
  shade: {
    // (sheet-1, Lorn II's hollow woodsman: a pointed hood of rough olive bark, its point swept back; a moss-green and deep
    // teal cloak, worn and mottled, its tatters breaking into violet-black smoke; khaki ribbons; a brass clasp; sage
    // greaves ringed in brass; the sword ink-black and violet; sheet-2, the Eclipse's pilgrim: a tall round violet hood with
    // a brass crescent on top, a violet and dusk-blue cloak with pale gold trim, a lantern on its belt, violet greaves)
    perdide2: { name: 'hollow woodsman', palette: { cloak: '#4e8676', cloak2: '#6f9c6a', lining: '#2a2238', face: '#100d16', hood: '#8d9550', hood2: '#5f6236', strip: '#aaa65a', brass: '#b38d4e', boot: '#7d9c82', inner: '#3a2f4c', sword: '#1c1626', shine: '#7a5aa8', smoke: '#2e2440', smoke2: '#6a5890', eye: '#f7f2e6', flare: '#fff6d8', lit: '#ffb36a' }, props: ['bark'] },
    incal: { name: 'vagrant shade', palette: { cloak: '#66768c', cloak2: '#8292a6', lining: '#262634', face: '#100f16', hood: '#56617a', hood2: '#3e475a', strip: '#a39c8a', brass: '#9a8a6a', boot: '#5a6272', inner: '#2e2c3c', sword: '#1a1822', shine: '#8a9bb8', smoke: '#3e3e56', smoke2: '#6a6a86', eye: '#f2f0e8' }, props: ['ragged'] },
    garage: { name: 'hooded mechanic', palette: { cloak: '#3f5252', cloak2: '#566e6c', lining: '#1e2428', face: '#0e1012', hood: '#8a5a3a', hood2: '#5e3c26', strip: '#b8603a', brass: '#b08848', boot: '#4a4440', inner: '#262a2e', sword: '#161a1e', shine: '#4f7378', smoke: '#2f3a3e', smoke2: '#566a6e', eye: '#f2ece0' }, props: ['pointed', 'goggles', 'wrench'] },
    spheres: { name: 'halo shade', palette: { cloak: '#e4dce8', cloak2: '#f4eef4', lining: '#2a2238', face: '#120f18', hood: '#d6cde2', hood2: '#bfb4d0', strip: '#dcb860', brass: '#dcb860', boot: '#cfc6da', inner: '#3a3050', sword: '#1c1626', shine: '#a88ad8', smoke: '#5a4a7e', smoke2: '#9a8ac0', eye: '#fffaf0' }, props: ['halo'] },
    glassdunes: { name: 'mirrored nomad', palette: { cloak: '#d2b984', cloak2: '#e6d4a6', lining: '#2a2430', face: '#110e14', hood: '#c4a466', hood2: '#9a7e4a', strip: '#8fd9c0', brass: '#c9a35e', boot: '#a88e62', inner: '#3a3040', sword: '#1a1620', shine: '#8fd9c0', smoke: '#4a3e5a', smoke2: '#7a6e8e', eye: '#f7f2e6' }, props: ['veil'] },
    eclipse: { name: 'pilgrim shade', palette: { cloak: '#5b62a6', cloak2: '#7a6eb4', lining: '#201b34', face: '#0e0c16', hood: '#7c6aa8', hood2: '#5c4e88', strip: '#cbb67c', brass: '#c9a35e', boot: '#6a68a4', inner: '#352c56', sword: '#191526', shine: '#9a86e0', smoke: '#262040', smoke2: '#5e5290', eye: '#f7f2e6', glow: '#ffd27a', trim: '#cbb67c' }, props: ['crescent', 'lantern'] },
  },
  hound: {
    // (sheet-1, the Garden of Spheres: matte ink-black with violet smoke, black antlers glinting gold, a thin pearl-and-
    // gold halo caught in them, white eyes; sheet-2, the Mangrove: bone-white driftwood antlers, the black body dripping
    // like wet ink, sage and lilac smoke, small turquoise eyes)
    eclipse: { name: 'night hound', palette: { ink: '#15121c', rim: '#3b2a5c', antler: '#d6c2ff', eye: '#d6c2ff', glow: '#d6c2ff', smoke: '#3b2a5c', smoke2: '#5a4686' }, props: ['crescent'] },
    mangrove: { name: 'driftwood hound', palette: { ink: '#1a1a20', rim: '#3a3a44', antler: '#ebe3d1', eye: '#6fe0d0', glow: '#6fe0d0', smoke: '#a3c1ab', smoke2: '#c2b0dc' }, props: ['bleached', 'drips'] },
    // (its muzzle pale, the pearl of its halo: on the broad-pawed body it took the horns' black, #800)
    spheres: { name: 'halo hound', palette: { ink: '#1a1521', rim: '#3a2c4e', antler: '#241c2e', muzzle: '#d8cfe4', eye:'#f4f0ff', glow: '#dcb860', smoke: '#4a3868', smoke2: '#8676a6' }, props: ['halo', 'glints'] },
    bazaar: { name: 'alley hound', palette: { ink: '#16141a', rim: '#3a3440', antler: '#b39464', eye: '#ffb8d0', glow: '#ff9ac0', smoke: '#3a3440', smoke2: '#5a4a58' }, props: ['wire'] },
  },
  marionette: {
    // (sheet-1, the Garden of Spheres' glass puppet: clear glass with faint prism tints of pink, cyan and gold, glossy, pearl
    // ball joints, fine silver threads, the smoke knot ink-black and violet; sheet-2, the Signal Market's parcel puppet:
    // brown paper parcels tied with string for limbs, a paper-bag head, teal and brass wax seals, the knot black-grey)
    spheres: { name: 'glass puppet', palette: { body: '#dfeaf0', body2: '#f4f8fa', joint: '#efe5d8', thread: '#cdd1d8', smoke: '#1e1a26', smoke2: '#6a4a9a', prism1: '#f2c8e0', prism2: '#c2ecf0', prism3: '#f2e6b0' }, props: ['silver'] },
    bazaar: { name: 'parcel puppet', palette: { body: '#c8a368', body2: '#dcbd86', joint: '#a8865a', thread: '#8a6a48', smoke: '#262426', smoke2: '#4a4648', seal: '#5aa39b', seal2: '#d08a3a', twine: '#7a5a3a' }, props: ['parcel'] },
    underside: { name: 'crane puppet', palette: { body: '#59636f', body2: '#6f7a86', joint: '#c9a35e', thread: '#2a2a2e', smoke: '#1e1a26', smoke2: '#4a3a5a', rust: '#a0603a' }, props: ['girder'] },
    saltharbour: { name: 'drowned sailor', palette: { body: '#4f7aa2', body2: '#6a92b6', joint: '#d8cfb8', thread: '#b89a6a', smoke: '#1e2a34', smoke2: '#3f5a6a', salt: '#eef0ea' }, props: ['rope'] },
  },
  wisp: {
    // sheet-1 (references/enemy-archetypes/wisp/sheet-1.jpg, issue #440) is the cinder wisp: glossy ink-black petals with
    // deep violet shadows (shell2), thin gold edges (rim), a white-gold ring of light, an orange and yellow coal, lilac
    // eyes. The corona wisp keeps its own colours on its body.
    moonfoundry: { name: 'cinder wisp', palette: { shell: '#1b1622', shell2: '#4a3568', rim: '#cdb27a', ring: '#fff1c4', core: '#ff8a3e', fire: '#ffd36a', eye: '#c7a6f2', smoke: '#1e1a20' }, props: [] },
    // sheet-4 (issue #472) is Lorn II's marsh wisp: mossy olive green-black petals (shell) going blue-green and darker
    // toward the cup (shell2), pale sage lichen in flower-shaped patches over half of them, brass edges and a brass ring
    // (not a ring of light: 'brass'), a cold pale-green marsh-light coal, pale green eyes, olive-black drips.
    perdide2: { name: 'marsh wisp', palette: { shell: '#2e3527', shell2: '#25322c', rim: '#a8905e', ring: '#c4a468', core: '#8ed49c', fire: '#e2f4d2', eye: '#bfe8a8', smoke: '#23251b', lichen: '#a6a67a' }, props: ['moss', 'brass'] },
    eclipse: { name: 'corona wisp', palette: { shell: '#15121c', shell2: '#2e2444', rim: '#d6c2ff', ring: '#f4ecff', core: '#ffcf6a', fire: '#fff4d0', eye: '#d6c2ff', smoke: '#100c18' }, props: ['corona'] },
  },
  // (issue #724) sheet-1 (references/enemy-archetypes/mummer/sheet-1.jpg) is the Desert's dune mummer: a sack of
  // sun-faded indigo patched with ochre and a pale sand cloth, tan rag tatters, rope bindings, a dented brass coffee pot,
  // glossy ink limbs with a violet sheen, a pale driftwood club; sheet-2 its bleached twin (the Glass Dunes'): a cream
  // sack patched sky blue and saffron, pale tatters, a taller and lighter pot, the bow's spring brighter.
  mummer: {
    desert: { name: 'dune mummer', palette: { sack: '#6c78a4', patch: '#cf9a43', patch2: '#d8c9a2', rag: '#ad9264', rope: '#b0844c', brass: '#b8963f', verd: '#7d8e5a', ink: '#17131f', sheen: '#6a58a8', wood: '#d8ccb0', iron: '#8a8172', eye: '#fbf6e8', flare: '#ffcf6a', rock: '#c2a27a' }, props: [] },
    // (met only in the Arena until the mummers take their camps in the Glass Dunes: the roster v3's order, world by world)
    glassdunes: { name: 'bleached mummer', arena: true, palette: { sack: '#d8c8a3', patch: '#8fb1d2', patch2: '#e3ae4f', rag: '#c2ae86', rope: '#c09a62', brass: '#cbb062', verd: '#8a9a6a', ink: '#15121c', sheen: '#7a6ab8', wood: '#e2d7bd', iron: '#a7a196', eye: '#fbf6e8', flare: '#ffcf6a', rock: '#cbb898' }, props: ['tall'] },
  },
  // (issue #800) the dune mummer, drawn to the rebuild's approved image (references/enemy-redesign-2026-10-30/keep-mummer/):
  // its home skin wears the reference's own eight flat colours (sage gourd, cream mask, salmon patch, rust gauntlets and
  // boots, sand toe caps: src/enemies/plans/dune-mummer-tripo.js); the Glass Dunes' is bleached like the mummer's twin
  // there (a cream gourd, a sky patch, saffron gloves), from these palettes' roles
  dunemummer: {
    desert: { name: 'gourd mummer', palette: { sack: '#879d88', patch: '#c9806a', patch2: '#c46c3c', rag: '#dfb47c', rope: '#bd6438', brass: '#b8963f', verd: '#7d8e5a', ink: '#17131f', sheen: '#6a58a8', wood: '#f3e4ad', iron: '#8a8172', eye: '#fbf6e8', flare: '#ffcf6a', rock: '#c2a27a' }, props: [] },
    glassdunes: { name: 'bleached gourd', palette: { sack: '#d8c8a3', patch: '#8fb1d2', patch2: '#e3ae4f', rag: '#c2ae86', rope: '#c09a62', brass: '#cbb062', verd: '#8a9a6a', ink: '#15121c', sheen: '#7a6ab8', wood: '#e2d7bd', iron: '#a7a196', eye: '#fbf6e8', flare: '#ffcf6a', rock: '#cbb898' }, props: ['tall'] },
  },
  // sheet-1 (references/enemy-archetypes/mummerking/sheet-1.jpg) is the Desert's mummer king: a dark oak barrel with iron
  // hoops for a chest, rag in indigo, ochre and sand over it, a green-patina copper cauldron, a pale cart wheel crown, a
  // bright brass horn, glossy ink limbs, a door beam of weathered oak.
  mummerking: {
    desert: { name: 'mummer king', palette: { sack: '#56649a', patch: '#c98d36', patch2: '#d7c3a0', rag: '#a98f62', rope: '#b08850', brass: '#d9b048', verd: '#5f9a84', ink: '#141020', sheen: '#6a58a8', wood: '#8b6239', wood2: '#d6c6a4', iron: '#4e4842', copper: '#7fae9a', copper2: '#b8703f', eye: '#fbf6e8', flare: '#ffcf6a' }, props: [] },
  },
  // (issue #726, roster v4's monsters: one skin in every world, its colour the tier: tierSkin's darker, banded one later on;
  // `arena` until the worlds' rosters take them: the Desert's camp stages them behind a flag, src/encounters/sites.js)
  // sheet-1 (references/enemy-archetypes/grunt/sheet-1.jpg): tomato-red skin, a shade deeper in its creases and paler on
  // its belly and snout, knobbly bumps on its scalp; a khaki loincloth, a brown leather strap with an iron ring; ivory
  // tusks and claws; yellow eyes; a grey-brown knobbly club.
  grunt: {
    desert: { name: 'grunt', arena: true, palette: { skin: '#d65a40', skin2: '#e98a68', crease: '#9a3428', cloth: '#c6b071', cloth2: '#a48e52', leather: '#6b4630', iron: '#5e5852', wood: '#9d8a6c', wood2: '#c2b08e', bone: '#efe2c4', eye: '#f2c33c', pupil: '#1b1414', ink: '#1b1414', rock: '#b9a07c', flare: '#ffcf6a' }, props: [] },
  },
  // sheet-1 (references/enemy-archetypes/hulk/sheet-1.jpg): slate-blue skin with lilac in its shadows, a pale icy belly,
  // an ivory horn; a ragged kilt of hide patches (brown, olive, tan) on a rope belt; a long dark club with iron bands.
  hulk: {
    desert: { name: 'hulk', arena: true, palette: { skin: '#a2aed6', skin2: '#bcc6e4', crease: '#6e78a6', belly: '#bfcde8', horn: '#e4d9bf', hide: '#96754e', hide2: '#7f8a56', hide3: '#b89466', rope: '#c4a56c', wood: '#6f5034', wood2: '#8a6844', iron: '#4a4a50', bone: '#efe4c8', eye: '#f2e8c8', pupil: '#1b1418', ink: '#1b1418', flare: '#ffcf6a' }, props: [] },
  },
  // sheet-1 (references/enemy-archetypes/prowler/sheet-1.jpg): smooth leaf-green scaly skin, a shade deeper on its back and
  // paler on its flanks; a cream throat, chest, belly and tail underside; yellow eyes; a polished steel shoulder guard and
  // blade, a brown leather strap and grip; pale claws; its spit a sour yellow-green.
  prowler: {
    desert: { name: 'prowler', arena: true, palette: { skin: '#8fcd6c', skin2: '#aadd88', crease: '#5e9a48', belly: '#f6efc4', belly2: '#e2d9a8', steel: '#b8c0c6', steel2: '#e6eaec', leather: '#76543a', bone: '#efe6cc', eye: '#f2c33c', pupil: '#16201a', ink: '#16201a', spit: '#c8de6e', flare: '#ffcf6a' }, props: [] },
  },
  // sheet-1 (references/enemy-archetypes/warlord/sheet-1.jpg): deep crimson skin, darker in its creases; a dark brown mane;
  // ridged tan ram horns; rough bronze, blotched darker; a wide dark leather belt and a brown loincloth; a dark glaive
  // shaft with steel rings and a grey steel blade; yellow eyes.
  warlord: {
    desert: { name: 'warlord', arena: true, palette: { skin: '#b0384a', skin2: '#c75866', crease: '#7c2234', mane: '#4a2b22', mane2: '#6c4030', ink: '#1c1012', horn: '#ddc699', horn2: '#a88c62', bronze: '#ab8a50', bronze2: '#7a6034', cloth: '#7e6a4c', leather: '#4f3a2c', wood: '#5f432e', wood2: '#7a5a3e', steel: '#cdd2d5', steel2: '#eef0f1', eye: '#f2c33c', pupil: '#1c1012', flare: '#ffcf6a' }, props: [] },
  },
};

// (issue #726) the makers' defunct droids: one material family, the same in every world (docs/design/enemy-roster-v4.md;
// src/enemies/plans/droid.js). Their sheets (sheet-1 each) draw weathered ivory ceramic panels with warm grey-brown stains,
// near-black joints, amber seams and one amber eye, a little moss. One skin each, met only in the Arena until the world
// rosters take them (keyed to the first world: everywhere the same). Their stronger tier (`tier`): scorched darker ceramic,
// a red eye and red seams instead of amber, laid over tierSkin's dimmed palette.
export const DROID_PALETTE = {
  ceramic: '#ebe2cb', ceramic2: '#f6efdc', stain: '#b49c74', joint: '#2b2a2f', joint2: '#4a4850', seam: '#ffae36',
  eye: '#ffa51f', flare: '#fff0b8', moss: '#7d9748', steel: '#d4d6d8', ring: '#ddd3bb',
};
export const DROID_TIER = { ceramic: '#7a7064', ceramic2: '#8c8274', stain: '#2b231d', joint: '#1a1817', joint2: '#2c2826', seam: '#ff4a2e', eye: '#ff3324', flare: '#ffc2b0', moss: '#4a5032', ring: '#6e665a', steel: '#9a9890' };
const droid = (name) => ({ desert: { name, arena: true, palette: { ...DROID_PALETTE }, props: [], tier: { palette: DROID_TIER } } });
SKINS.sentinel = droid('sentinel');
SKINS.oracle = droid('oracle');
// (the survey crawler, issue #800: the approved reference's colours, references/enemy-redesign-2026-10-30/keep-crawler/
// 22d8861b-…-0.png: cream ceramic, sage legs, dark joints, a navy band under the dome, pink sockets, amber eyes; its tier the droids')
SKINS.crawler = { desert: { ...droid('crawler').desert, palette: { ...DROID_PALETTE, ceramic: '#e4cdb6', ceramic2: '#efdcc8', leg: '#7e8d7c', joint: '#3a4640', band: '#1a2230', socket: '#a06a66', eye: '#d0661c' } } };

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
// (issue #800: the Tripo body, src/enemies/plans/blot-tripo.js, wears its edge on its belly plate too, `belly`; its home skin,
// the Desert's, the approved reference's own colours, references/enemy-redesign-2026-10-30/blob/eb43fb37-…-2.png: slate ink,
// a lilac light down one flank, a tan belly, cream eyes; the sand edge kept for its pool)
const BLOT_DRESS = { desert: { palette: { ink: '#24363b', shine: '#a28c97', belly: '#e3b279', eye: '#fde9b2' } },
  garage: { palette: { ink: '#1c2125', shine: '#4f7378', edge: '#c06c38', belly: '#c06c38', edge2: '#3f8682' }, props: ['shavings'] } };
SKINS.blot = Object.fromEntries(Object.entries(BLOT_EDGE).map(([w, [name, edge]]) => [w, { name, palette: { ink: '#1e1a26', shine: '#5c4a8e', edge, belly: edge, eye: '#f4efe0', ...BLOT_DRESS[w]?.palette }, props: BLOT_DRESS[w]?.props }]));

/** Each archetype's own skin: the first world it is met in (its skins' first entry). */
export const HOME_SKIN = Object.fromEntries(Object.entries(SKINS).map(([a, s]) => [a, Object.keys(s)[0]]));

/** The skin worlds of an archetype (in order: its own first). */
export const skinWorlds = (a) => Object.keys(SKINS[a] ?? {});

/**
 * Which skin an archetype wears in a world: that world's own; else, in a part of a merged world (src/levels/names.js
 * PARTS), the skin of its other part (Vael's plain fields its sky stones' cliff crab since the herons went, issue #769);
 * else its home skin (the Arena, a world it isn't in).
 */
export function skinFor(a, world) {
  const S = SKINS[a];
  if (!S) return null;
  if (S[world]) return world;
  return Object.values(PARTS).find((p) => p.includes(world))?.find((p) => S[p]) ?? HOME_SKIN[a];
}

/**
 * An archetype's skin in a world, its palette filled from its home skin's: { id, name, palette, props, moves, scale }.
 * tier: its stronger tier's (issue #722, src/enemies/fight.js TIERS): tierSkin.
 */
export function skinOf(a, world, tier = 0) {
  const id = skinFor(a, world);
  if (!id) return null;
  const S = SKINS[a][id], home = SKINS[a][HOME_SKIN[a]];
  const out = { id, name: S.name, palette: { ...home.palette, ...S.palette }, props: S.props ?? [], moves: S.moves ?? [], scale: (S.scale ?? 1) * (ARCHETYPES[a].scale ?? 1), arena: !!S.arena };
  return tier ? tierSkin(out, S.tier) : out;
}

/**
 * The stronger tier's look (issue #722, D13, BotW's colour tiers): the same skin, darker (TIER_LOOK.dark; its eyes, glows
 * and lamps kept: TIER_LOOK.keep), banded (src/enemies/surfaces.js TIER_SURFACE paints the bands), its own materials
 * (`key`) and its own name ('banded …').
 */
export const TIER_LOOK = { dark: 0.52, keep: /^(eye|glow|lamp|lens|core|lip|brew|slag|fire|flame|light|spirit|eyes|seam|glint|flare|spore|spot|ward|line|ink)/ };
export function tierSkin(s, own = null) {
  const dim = (hex) => { const n = parseInt(hex.slice(1), 16), k = TIER_LOOK.dark; const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => Math.round(x * k)); return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`; };
  const palette = Object.fromEntries(Object.entries(s.palette).map(([k, v]) => [k, typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) && !TIER_LOOK.keep.test(k) ? dim(v) : v]));
  // (a skin's own tier colours over the dimmed ones: the droids' scorched ceramic and red eye, issue #726)
  if (own?.palette) Object.assign(palette, own.palette);
  return { ...s, palette, tier: 1, key: `${s.id}~tier`, name: own?.name ?? `${own ? 'scorched' : 'banded'} ${s.name}` };
}

/** A skin's name for a kind (by the archetype it is): 'crab', 'saltharbour' → 'anchor crab'; else the archetype's name. */
export function skinName(a, world) {
  const s = skinOf(a, world);
  return s?.name ?? ARCHETYPES[a]?.name ?? a;
}
