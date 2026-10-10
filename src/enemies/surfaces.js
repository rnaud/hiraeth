// What each skin's parts are painted with (docs/systems/foes.md, "Procedural surfaces"; the shader: src/foe-surface.js):
// the patterns, colour zones, glow and gloss the design sheets draw on each archetype
// (references/enemy-archetypes/<id>/sheet-1.jpg the main skin, sheet-2.jpg the alternate). A body builder's materials
// (src/enemies/plans/kit.js `materials`) look their part up here by name: SURFACES[archetype]['*'][name] is worn in
// every skin, SURFACES[archetype][skin][name] over it (a feature set to null takes one away).
//
// A colour is '#rrggbb', a key of the skin's palette ('shell'), that key darker ('shell*0.7') or paler ('shell+0.3',
// toward white). Sizes are metres of the part (the body's scale included). `mat` adds makeMaterial options to the part
// (a denser hatch: `hatch`).

/** Pale lichen stars, flecks of lichen and darker specks over a worn slate dome (the cliff crab's: sheet-1). */
const LICHEN = {
  spots: { color: 'accent', scale: 0.17, share: 0.6, size: 1.3, star: 0.75, jitter: 1 },
  spots2: { color: 'accent', scale: 0.07, share: 0.3, size: 0.7, amount: 0.85 },
  mottle: { color: 'shell2', scale: 0.12, amount: 0.35, soft: 0.1, detail: 0.55, strength: 0.55 },
};
/** Fine dark specks (the sheets' stippled legs, claws and belly plates). */
const SPECKS = (color = 'dark', amount = 0.55, scale = 0.05) => ({ spots2: { color, scale, share: 0.45, size: 0.45, amount } });

export const SURFACES = {
  crab: {
    '*': {
      under: { bands: { color: 'under*0.86', axis: 1, period: 0.07, width: 0.1, ink: 0.55 }, ...SPECKS('dark', 0.35, 0.05) },
      leg: { ...SPECKS('dark', 0.55, 0.05) },
      // (the fingers: apricot at the tips, the hand's ivory toward the knuckle)
      claw: { fade: { color: 'leg', axis: 2, from: 0.22, to: 0.04 }, ...SPECKS('dark', 0.6, 0.045) },
      joint: { ...SPECKS('dark', 0.4, 0.05) },
    },
    arzach2: { shell: { ...LICHEN } },
    saltharbour: {
      shell: {
        mottle: { color: '#c9a35e', scale: 0.16, amount: 0.25, soft: 0.1, detail: 0.5, strength: 0.7 },
        spots: { color: 'accent', scale: 0.1, share: 0.45, size: 1.6, ring: 0.5, jitter: 1, soft: 0.12 },
        spots2: { color: 'accent', scale: 0.045, share: 0.5, size: 1.2, amount: 0.95, soft: 0.1 },
      },
      claw: { fade: { color: 'leg', axis: 2, from: 0.22, to: 0.04 }, mottle: { color: 'arm', scale: 0.05, amount: 0.3, soft: 0.06, strength: 0.7 }, ...SPECKS('dark', 0.6, 0.045) },
      leg: { mottle: { color: 'joint', scale: 0.06, amount: 0.2, soft: 0.08, strength: 0.5 }, ...SPECKS('dark', 0.5, 0.05) },
    },
    garage: { shell: { gloss: { size: 0.05, sky: 0.6 }, bands: { color: 'shell2', axis: 0, period: 0.4, width: 0.05, ink: 0 } } },
    antennas: { shell: { rust: { color: 'accent', color2: 'shell2', amount: 0.3, amount2: 0.15, scale: 0.18, down: 0.6, pits: 0.3 } } },
    bazaar: { shell: { mottle: { color: 'shell2', scale: 0.18, amount: 0.4, soft: 0.1 }, ...SPECKS('dark', 0.4) } },
    underwater: { shell: { spots: { color: 'accent', scale: 0.12, share: 0.6, size: 0.7, ring: 0.5 }, ...SPECKS('joint', 0.5) } },
    glassdunes: { shell: { glow: { color: 'shell2', amount: 0.35, rim: 0.5, core: 1.5, emit: 0.15 }, gloss: { size: 0.04, sky: 0.7 } } },
  },
  lizard: {
    '*': {
      hide: {
        // dusty scales mottled with darker rosettes, a ridge of darker spots down the back
        scales: { color: 'accent', size: 0.035, ink: 0.25, tone: 0.07, amount: 0.25 },
        mottle: { color: 'accent', scale: 0.11, amount: 0.38, soft: 0.06, detail: 0.5, strength: 0.75 },
        belly: { color: 'belly', edge: -0.25, soft: 0.08, seams: 0.06, ink: 0.5 },
      },
      belly: { bands: { color: 'belly*0.9', axis: 2, period: 0.07, width: 0.12, ink: 0.5 } },
    },
    bazaar: {
      hide: {
        scales: { color: 'dark', size: 0.03, ink: 0.3, tone: 0.06, amount: 0.15 },
        // (amber rosettes: a ring of gold round a paler heart, soft-edged so no pen line rings each one)
        spots: { color: 'accent+0.1', scale: 0.12, share: 0.6, size: 1.5, ring: 0.45, jitter: 0.5, soft: 0.45 },
        spots2: { color: 'accent+0.3', scale: 0.12, share: 0.6, size: 0.45, jitter: 0.5, soft: 0.4, amount: 0.6 },
        belly: { color: 'belly', edge: -0.25, soft: 0.08, seams: 0.06, ink: 0.5 },
        mottle: null,
      },
    },
    buried: { hide: { mottle: { color: 'dark', scale: 0.1, amount: 0.35, soft: 0.12 } } },
    eclipse: { hide: { spots2: { color: 'verd', scale: 0.05, share: 0.4, size: 0.4 } } },
    moonfoundry: { hide: { mottle: { color: 'accent', scale: 0.09, amount: 0.4, soft: 0.05 }, glow: { color: 'verd', amount: 0.25, rim: 0.4, core: 3, emit: 0.3, pulse: 1.5 } } },
  },
  hound: {
    '*': {
      // (glints scattered over the ink, and its fur in darker and lighter patches)
      ink: { spots2: { color: 'glow', scale: 0.09, share: 0.4, size: 0.75 }, mottle: { color: 'rim', scale: 0.25, amount: 0.3, soft: 0.2, strength: 0.6 } },
    },
    mangrove: {
      ink: { spots: { color: 'smoke', scale: 0.12, share: 0.3, size: 0.6, amount: 0.8 }, spots2: { color: 'glow', scale: 0.09, share: 0.3, size: 0.6 }, mottle: { color: 'rim', scale: 0.22, amount: 0.35, soft: 0.18, strength: 0.6 } },
      antler: { grain: { color: 'antler*0.82', spacing: 0.025, ink: 0.45, warp: 0.7, amount: 0.5 }, ...SPECKS('#5a5048', 0.6, 0.03) },
    },
    spheres: { antler: { spots2: { color: 'glow', scale: 0.05, share: 0.55, size: 0.45 } } },
  },
  tripod: {
    '*': {
      body: { rust: { color: 'rust', color2: 'accent', amount: 0.14, amount2: 0, scale: 0.12, down: 0.7, pits: 0.2 }, gloss: { size: 0.025, sky: 0.45, amount: 0.8 } },
      leg: { rust: { color: 'rust', color2: 'rust', amount: 0.2, amount2: 0, scale: 0.08, down: 0.4, pits: 0 } },
    },
    incal: { body: { drips: { color: 'rust', width: 0.11, from: 0.2, length: 0.4, bulb: 0.3, amount: 0.55 }, rust: { color: 'rust', color2: 'accent', amount: 0.12, amount2: 0, scale: 0.1, down: 0.7, pits: 0.2 }, gloss: { size: 0.025, sky: 0.45, amount: 0.8 } } },
    underwater: { body: { mottle: { color: 'rust', scale: 0.14, amount: 0.45, soft: 0.1, detail: 0.6, strength: 0.7 }, rust: { color: 'rust*0.9', color2: 'accent+0.2', amount: 0.12, amount2: 0.12, scale: 0.12, down: 0.6, pits: 0.4 } } },
  },
  blot: {
    // (wet ink: a crisp white glint of the sun and a violet one of the sky, streaks of violet light in it)
    '*': { ink: { gloss: { size: 0.035, sky: 0.9, amount: 1, color: 'shine+0.6' }, mottle: { color: 'shine', scale: 0.3, amount: 0.25, soft: 0.25, strength: 0.4, detail: 0.3 } }, edge: { mottle: { color: 'edge*0.75', scale: 0.08, amount: 0.4, soft: 0.06 } } },
    garage: { ink: { gloss: { size: 0.035, sky: 0.9, amount: 1, color: 'shine+0.6' }, mottle: { color: 'shine', scale: 0.2, amount: 0.35, soft: 0.2, strength: 0.55, detail: 0.6 }, spots2: { color: 'edge', scale: 0.08, share: 0.35, size: 0.6, amount: 0.8 } } },
  },
  worm: {
    '*': {
      body: { mottle: { color: 'ring', scale: 0.25, amount: 0.35, soft: 0.15, strength: 0.6 }, ...SPECKS('ring*0.8', 0.5, 0.05) },
      ring: { mottle: { color: 'body', scale: 0.2, amount: 0.3, soft: 0.15, strength: 0.5 } },
      fin: { grain: { color: 'fin*0.88', spacing: 0.06, ink: 0.3, warp: 0.2, amount: 0.4 }, ...SPECKS('ring', 0.5, 0.06) },
    },
    buried: { body: { rust: { color: '#9a5a3a', color2: 'ring', amount: 0.18, amount2: 0.2, scale: 0.12, down: 0.2, pits: 0.5 } } },
    glassdunes: { body: { glow: { color: 'body2', amount: 0.35, rim: 0.5, core: 1.5, emit: 0.15 }, gloss: { size: 0.04, sky: 0.7 }, mottle: null, spots2: null } },
  },
  ray: {
    '*': {
      // (a fine net of veins over the wings, a darker bloom here and there)
      top: { mottle: { color: 'spots', scale: 0.35, amount: 0.3, soft: 0.2, strength: 0.4 }, scales: { color: 'spots', size: 0.24, ink: 0.5, tone: 0.04, amount: 0.15, mode: 1 } },
      tail: { bands: { color: 'tail*0.75', axis: 1, period: 0.12, width: 0.15, ink: 0.6 } },
    },
    glassdunes: { top: { glow: { color: 'top2', amount: 0.4, rim: 0.7, core: 1.2, emit: 0.2 }, gloss: { size: 0.05, sky: 0.8 }, mottle: { color: '#c8b8f0', scale: 0.5, amount: 0.35, soft: 0.08, strength: 0.6 }, scales: { color: 'edge', size: 0.3, ink: 0.15, tone: 0.06, amount: 0.35, mode: 1 } } },
    underwater: { top: { gloss: { size: 0.04, sky: 0.7 }, stripes: { color: 'spots', axis: 2, period: 0.5, width: 0.06 } } },
  },
  moth: {
    '*': {
      // (thin paper over rods: fine veins across it, a paler bloom)
      wing: { mottle: { color: 'wing2', scale: 0.2, amount: 0.3, soft: 0.2, strength: 0.6 }, stripes: { color: 'wing*0.85', axis: 0, period: 0.11, width: 0.04, ink: 0, amount: 0.45 } },
      lantern: { glow: { color: 'glow', amount: 0.55, rim: 0.2, core: 1.4, pulse: 2.2, emit: 0.7 }, bands: { color: 'antenna', axis: 1, period: 0.16, width: 0.06, ink: 0.4 } },
    },
    antennas: { wing: { stripes: { color: 'antenna', axis: 0, period: 0.14, width: 0.05, ink: 0, amount: 0.35 } }, lantern: { glow: { color: '#d8f0d8', amount: 0.4, rim: 0.2, core: 1.4, pulse: 1.6, emit: 0.3 }, bands: { color: 'antenna', axis: 1, period: 0.16, width: 0.06, ink: 0.4 } } },
    bazaar: { lantern: { glow: { color: 'body', amount: 0.7, rim: 0.5, core: 1.2, pulse: 4, emit: 0.9 } } },
  },
  centipede: {
    '*': {
      plate: { rust: { color: 'plate*0.8', color2: 'accent', amount: 0.15, amount2: 0, scale: 0.12, down: 0.5, pits: 0.4 }, gloss: { size: 0.02, sky: 0.4, amount: 0.6 } },
      head: { rust: { color: 'head*0.8', color2: 'accent', amount: 0.15, amount2: 0, scale: 0.1, down: 0.5, pits: 0.4 }, gloss: { size: 0.02, sky: 0.4, amount: 0.6 } },
    },
    fallenring: { plate: { gloss: { size: 0.03, sky: 0.5 }, mottle: { color: 'plate2', scale: 0.1, amount: 0.3, soft: 0.06, strength: 0.6 } } },
    eclipse: { plate: { spots2: { color: 'accent', scale: 0.06, share: 0.3, size: 0.35 } } },
  },
  jelly: {
    '*': {
      bell: { glow: { color: 'bell2', amount: 0.35, rim: 0.45, core: 1.6, emit: 0.1 }, mottle: { color: 'bell2', scale: 0.25, amount: 0.4, soft: 0.25, strength: 0.6 } },
      under: { glow: { color: 'light', amount: 0.3, rim: 0.2, core: 1.2, emit: 0.2 } },
      // the paper lanterns' globes (light0…2): ribs round them, brighter at the heart
      light: { glow: { color: '#fffaf0', amount: 0.45, rim: 0, core: 2.2, pulse: 1.8, emit: 0.6 }, bands: { color: 'lantern', axis: 1, period: 0.075, width: 0.06, ink: 0.45, amount: 0.6 } },
    },
    underwater: {
      // (white glaze with two cobalt bands round its crown and a broken one lower down, cobalt underneath)
      bell: { gloss: { size: 0.03, sky: 0.7 }, stripes: { color: 'dark', axis: 1, period: 1, width: 0.05, offset: -0.6 }, bands: { color: 'dark', axis: 1, period: 1, width: 0.025, offset: -0.5 }, spots: { color: 'dark', scale: 0.32, share: 0.18, size: 1.2, ring: 0.3, soft: 0.3 }, glow: null },
      under: { glow: null },
      light: { glow: { color: '#fffaf0', amount: 0.45, rim: 0, core: 2.2, pulse: 1.8, emit: 0.6 }, bands: { color: 'dark', axis: 1, period: 0.1, width: 0.04, ink: 0.5, amount: 0.6 }, stripes: { color: 'dark', axis: 0, period: 0.1, width: 0.04, ink: 0.5, amount: 0.6 } },
    },
  },
};

// batch 3 (v1.12): the bellows toad, the stilt heron, the skitter swarm, the root knot
Object.assign(SURFACES, {
  toad: {
    '*': {
      // (sheet-1: round lilac spots of every size and warts over mottled moss-green, the spots inked; sheet-2 the same on slate)
      skin: {
        spots: { color: 'spots', scale: 0.2, share: 0.75, size: 0.8, jitter: 1, soft: 0.22 },
        spots2: { color: 'spots+0.2', scale: 0.1, share: 0.45, size: 0.55, amount: 0.9, soft: 0.15 },
        mottle: { color: 'skin2', scale: 0.24, amount: 0.38, soft: 0.16, detail: 0.5, strength: 0.6 },
      },
      // (the belly's folds across it, and its pale stipple)
      belly: { bands: { color: 'belly*0.9', axis: 1, period: 0.1, width: 0.06, ink: 0.18 }, ...SPECKS('dark', 0.2, 0.05) },
      // (the sac: folds down its length, a light through it as it swells)
      sac: { stripes: { color: 'sac*0.88', axis: 0, period: 0.12, width: 0.1, ink: 0.25 }, glow: { color: 'sac+0.35', amount: 0.3, rim: 0.5, core: 1.5, emit: 0.15 } },
      glob: { spots: { color: 'dots', scale: 0.11, share: 0.6, size: 0.65, soft: 0.05 } },
      toe: { mottle: { color: 'skin', scale: 0.08, amount: 0.3, soft: 0.1, strength: 0.5 } },
      web: { stripes: { color: 'toe*0.85', axis: 0, period: 0.09, width: 0.1, ink: 0.3 } },
    },
    incal: {
      // (sheet-2: denser smaller lilac-pink spots and a scatter of pale dots over the slate)
      skin: {
        spots: { color: 'spots', scale: 0.16, share: 0.75, size: 0.78, jitter: 1, soft: 0.22 },
        spots2: { color: 'toe', scale: 0.09, share: 0.45, size: 0.5, amount: 0.85, soft: 0.15 },
        mottle: { color: 'skin2', scale: 0.2, amount: 0.35, soft: 0.16, detail: 0.5, strength: 0.6 },
      },
      brass: { gloss: { size: 0.03, sky: 0.5 } },
    },
    waterfall: { brass: { gloss: { size: 0.03, sky: 0.5 } } },
  },
  heron: {
    '*': {
      // (the legs: bony segments, fine lines along them; the bill tipped another colour toward its point)
      leg: { grain: { color: 'leg*0.88', spacing: 0.04, ink: 0.12, warp: 0.25, amount: 0.25 }, ...SPECKS('dark', 0.18, 0.04) },
      joint: { ...SPECKS('dark', 0.4, 0.04) },
      bill: { fade: { color: 'tip', axis: 2, from: 0.5, to: 0.86 } },
      neck: { ...SPECKS('dark', 0.2, 0.05) },
    },
    desert: {
      // (sheet-1: glazed cream clay, two ochre lines round its belly, a crackle of fine lines in the glaze, a gloss)
      body: {
        bands: { color: 'band', axis: 1, period: 1, width: 0.045, offset: -0.05, ink: 0 },
        stripes: { color: 'band', axis: 1, period: 1, width: 0.045, offset: -0.22, ink: 0 },
        scales: { color: 'dark', size: 0.2, ink: 0.18, tone: 0.025, amount: 0.08, mode: 1 },
        gloss: { size: 0.045, sky: 0.6, amount: 0.8 },
      },
    },
    arzach: {
      // (sheet-2: overlapping pale blue feathers, darker at their edges; a pale neck; rust-red crest)
      body: { scales: { color: 'band', size: 0.1, ink: 0.18, tone: 0.06, amount: 0.25 }, mottle: { color: 'body2', scale: 0.25, amount: 0.3, soft: 0.2, strength: 0.5 } },
      wing: { scales: { color: 'band', size: 0.12, ink: 0.2, tone: 0.06, amount: 0.28 } },
      crest: { fade: { color: 'crest*0.7', axis: 1, from: 0.0, to: 0.3 } },
    },
    perdide: { body: { scales: { color: 'band', size: 0.08, ink: 0.3, tone: 0.06, amount: 0.25 } }, crest: { spots: { color: 'crest+0.4', scale: 0.08, share: 0.45, size: 0.55 } } },
    mangrove: { body: { scales: { color: 'band', size: 0.08, ink: 0.25, tone: 0.05, amount: 0.2 } }, leg: { grain: { color: 'joint', spacing: 0.035, ink: 0.4, warp: 0.6, amount: 0.5 } } },
  },
  skitter: {
    '*': {
      // (sheet-1: a smooth gold dome with one ochre band round it, fine stipple, a soft sheen)
      dome: {
        bands: { color: 'band', axis: 1, period: 1, width: 0.045, offset: -0.1, ink: 0.15 },
        mottle: { color: 'dome2', scale: 0.12, amount: 0.3, soft: 0.2, strength: 0.5 },
        ...SPECKS('dark', 0.3, 0.035),
        gloss: { size: 0.02, sky: 0.3, amount: 0.3 },
      },
      leg: { ...SPECKS('dark', 0.35, 0.025) },
      limbs: { ...SPECKS('dark', 0.35, 0.025) },   // (the legs and feelers as one skinned mesh, the joints tinted)
      joint: { bands: { color: 'joint*0.8', axis: 1, period: 0.05, width: 0.15, ink: 0.4 } },
    },
    moonfoundry: {
      // (sheet-2: dark iron, pitted and stippled, a glowing seam down the back; no band)
      dome: { bands: null, rust: { color: 'dome2', color2: 'band', amount: 0.25, amount2: 0.1, scale: 0.06, down: 0.3, pits: 0.6 }, ...SPECKS('#18161a', 0.6, 0.03), gloss: { size: 0.025, sky: 0.3, amount: 0.6 } },
      seam: { glow: { color: 'seam', amount: 0.6, rim: 0.2, core: 1.4, pulse: 2.2, emit: 0.8 } },
    },
    buried: {
      dome: { bands: { color: 'band', axis: 2, period: 0.09, width: 0.25, ink: 0.4 }, ...SPECKS('dark', 0.5, 0.03) },
      seam: { glow: { color: 'seam', amount: 0.55, rim: 0.2, core: 1.4, pulse: 1.8, emit: 0.7 } },
    },
    underside: { dome: { bands: null, spots: { color: 'band', scale: 0.08, share: 0.5, size: 0.35, ring: 0.4 }, gloss: { size: 0.03, sky: 0.5 } } },
  },
  // ----------------------------------------------------------------------------- batch 4: the possessed machines
  brute: {
    '*': {
      // (sheet-1: old ivory cracked all over like a dropped jar, fine dark seams, the widest cracks glowing violet; tar
      // running down from the belt; a few warm stains; brass fittings with verdigris at their seams)
      body: {
        cracks: { color: 'glow', ink: 'seam', inkAmount: 0.32, scale: 0.36, width: 0.022, tone: 0.03, veins: 0.8, vein: 0.06, glow: 0.95 },
        mottle: { color: 'body*0.9', scale: 0.35, amount: 0.3, soft: 0.25, strength: 0.5 },
        drips: { color: 'tar', width: 0.22, from: 2.02, length: 0.4, bulb: 0.35, amount: 0.7 },
        gloss: { size: 0.02, sky: 0.3, amount: 0.35 },
      },
      brass: { rust: { color: 'brass*0.72', color2: 'verd', amount: 0.14, amount2: 0.12, scale: 0.08, down: 0.6, pits: 0.3 }, gloss: { size: 0.03, sky: 0.4, amount: 0.6 } },
      tar: { gloss: { size: 0.04, sky: 0.85, amount: 0.9, color: 'glow+0.5' }, mottle: { color: 'glow*0.6', scale: 0.12, amount: 0.25, soft: 0.2, strength: 0.4 } },
      root: { grain: { color: 'root*0.7', spacing: 0.03, ink: 0.35, warp: 0.6, amount: 0.5 } },
      moss: { mottle: { color: 'moss*0.75', scale: 0.06, amount: 0.4, soft: 0.1 }, ...SPECKS('moss+0.3', 0.5, 0.03) },
      saw: { rust: { color: 'saw*0.7', color2: '#c98a54', amount: 0.4, amount2: 0.2, scale: 0.08, down: 0.2, pits: 0.6 } },
      slab: { mottle: { color: 'slab*0.8', scale: 0.15, amount: 0.4, soft: 0.1 }, ...SPECKS('dark', 0.4, 0.05) },
    },
    edena: { blade: { gloss: { size: 0.03, sky: 0.7 }, fade: { color: 'blade*0.7', axis: 1, from: -0.4, to: -1.3 } } },
    glassdunes: {
      // (sheet-2: thick faceted plates of pale aqua glass, each facet its own shade and a thin pale-gold line round it, a
      // crisp glint; orange cracks glowing through; the hull's sand-gold showing at the joints)
      body: {
        cracks: { color: 'glow', ink: 'seam', inkAmount: 0.6, scale: 0.28, width: 0.024, tone: 0.12, veins: 0.6, vein: 0.05, glow: 1 },
        glow: { color: 'body2', amount: 0.12, rim: 0.4, core: 1.6, emit: 0.04 },
        gloss: { size: 0.035, sky: 0.75, amount: 0.9 },
        drips: { color: 'tar', width: 0.2, from: 2.02, length: 0.45, bulb: 0.35, amount: 0.8 },
      },
    },
    waterfall: {
      body: {
        cracks: { color: 'glow', ink: 'seam', inkAmount: 0.75, scale: 0.12, width: 0.045, tone: 0.05, veins: 0.55, vein: 0.055, glow: 0.9 },
        gloss: { size: 0.05, sky: 0.9, amount: 1 },
        drips: { color: '#e4f2f8', width: 0.1, from: 3.6, length: 0.8, bulb: 0.3, amount: 0.5 },
        mottle: { color: 'verd', scale: 0.3, amount: 0.25, soft: 0.2, strength: 0.4 },
      },
    },
    moonfoundry: {
      body: {
        cracks: { color: 'glow', ink: 'seam', inkAmount: 0.8, scale: 0.12, width: 0.05, tone: 0.05, veins: 0.5, vein: 0.06, glow: 1 },
        rust: { color: 'joint', color2: 'body*0.8', amount: 0.22, amount2: 0.1, scale: 0.15, down: 0.8, pits: 0.4 },
        drips: { color: 'tar', width: 0.16, from: 2.02, length: 0.55, bulb: 0.35, amount: 0.85 },
      },
    },
  },
  drone: {
    '*': {
      // (sheet-1: weathered brass with patches of pink rust, concentric rings turned into the top plate, the slate-blue
      // underside; ivory enamel rims; the cloud ink-black with violet in it)
      plate: {
        rust: { color: 'rust', color2: 'plate2', amount: 0.24, amount2: 0.12, scale: 0.12, down: 0.2, pits: 0.4 },
        bands: { color: 'plate*0.82', axis: 3, period: 0.09, width: 0.08, ink: 0.3 },
        belly: { color: 'under', edge: -0.4, soft: 0.05 },
        gloss: { size: 0.025, sky: 0.4, amount: 0.5 },
      },
      rim: { gloss: { size: 0.03, sky: 0.5, amount: 0.7 }, mottle: { color: 'rust', scale: 0.08, amount: 0.15, soft: 0.1, strength: 0.6 } },
      smoke: { mottle: { color: 'smoke2', scale: 0.12, amount: 0.35, soft: 0.3, strength: 0.7, detail: 0.6 } },
      brass: { gloss: { size: 0.03, sky: 0.4, amount: 0.6 } },
    },
    spheres: {
      // (sheet-2: pearl plates with a faint prism shimmer, a crisp glaze; gold rims; pale grey-blue smoke)
      plate: {
        mottle: { color: '#f4dcea', scale: 0.25, amount: 0.18, soft: 0.3, strength: 0.4, detail: 0.5 },
        spots2: { color: '#d4f0ec', scale: 0.2, share: 0.4, size: 1.2, soft: 0.5, amount: 0.35 },
        belly: { color: 'under', edge: -0.4, soft: 0.05 },
        gloss: { size: 0.04, sky: 0.8, amount: 1 },
      },
      rim: { gloss: { size: 0.04, sky: 0.8, amount: 1 }, mottle: { color: '#f0e0f4', scale: 0.1, amount: 0.2, soft: 0.3, strength: 0.5 } },
      smoke: { mottle: { color: 'smoke2', scale: 0.14, amount: 0.45, soft: 0.35, strength: 0.8, detail: 0.5 } },
    },
    garage: { plate: { rust: { color: 'rust', color2: 'plate2', amount: 0.35, amount2: 0.15, scale: 0.1, down: 0.3, pits: 0.7 }, bands: { color: 'dark', axis: 0, period: 0.31, width: 0.02, ink: 0.5 }, belly: { color: 'under', edge: -0.4, soft: 0.05 } } },
    spacecity: { plate: { gloss: { size: 0.04, sky: 0.8, amount: 1 }, belly: { color: 'under', edge: -0.4, soft: 0.05 }, bands: { color: 'accent', axis: 3, period: 0.24, width: 0.08, ink: 0.2 } } },
  },
  cart: {
    '*': {
      // (sheet-1: black-teal steel, scuffed and rusted at the edges, rivets; patched khaki canvas with darker patches and
      // stitched seams; the crucible gunmetal with ink running down from its rim; treads on the belts; spoked wheels)
      hull: { rust: { color: 'rust', color2: 'body2', amount: 0.15, amount2: 0.1, scale: 0.1, down: 0.7, pits: 0.4 }, ...SPECKS('dark', 0.3, 0.05) },
      canvas: {
        scales: { color: 'canvas2', size: 0.34, ink: 0.4, tone: 0.1, amount: 0.25, mode: 1 },
        mottle: { color: 'canvas2', scale: 0.22, amount: 0.35, soft: 0.12, strength: 0.7 },
      },
      pot: {
        drips: { color: 'brew', width: 0.15, from: 0.52, length: 0.5, bulb: 0.4, amount: 0.95 },
        mottle: { color: 'pot2', scale: 0.25, amount: 0.3, soft: 0.2, strength: 0.6 },
        rust: { color: 'rust', color2: 'pot2', amount: 0.12, amount2: 0, scale: 0.1, down: 0.8, pits: 0.3 },
      },
      belt: { bands: { color: 'track*0.55', axis: 2, period: 0.12, width: 0.42, ink: 0.55 } },
      wheel: { stripes: { color: 'wheel*0.55', axis: 4, period: 0.26, width: 0.22, ink: 0.4 }, bands: { color: 'wheel*0.7', axis: 3, period: 1, width: 0.15, offset: -0.85 } },
      brew: { gloss: { size: 0.04, sky: 0.9, amount: 0.9, color: 'smoke2+0.5' }, mottle: { color: 'smoke2', scale: 0.12, amount: 0.3, soft: 0.2, strength: 0.6 } },
      smoke: { mottle: { color: 'smoke2', scale: 0.15, amount: 0.3, soft: 0.3, strength: 0.6, detail: 0.6 } },
      brass: { gloss: { size: 0.03, sky: 0.4, amount: 0.5 } },
    },
    moonfoundry: {
      // (sheet-2: cream enamel chipped at the edges, soot down its sides; the brew glowing ember, ember drips down the pot)
      hull: { rust: { color: 'rust', color2: 'body2', amount: 0.07, amount2: 0.05, scale: 0.06, down: 0.9, pits: 0.3 }, gloss: { size: 0.03, sky: 0.5, amount: 0.6 } },
      pot: {
        drips: { color: 'slag', width: 0.15, from: 0.52, length: 0.42, bulb: 0.4, amount: 0.95 },
        rust: { color: 'rust', color2: 'pot2', amount: 0.06, amount2: 0, scale: 0.06, down: 0.95, pits: 0.3 },
        gloss: { size: 0.03, sky: 0.5, amount: 0.6 },
      },
      brew: { glow: { color: 'slag', amount: 0.7, rim: 0.2, core: 1, pulse: 2.5, emit: 0.8 }, mottle: { color: 'slag2', scale: 0.1, amount: 0.35, soft: 0.1 } },
    },
  },
  bell: {
    '*': {
      // (sheet-1: aged bronze clouded with teal verdigris, two engraved bands of ornament (at the shoulder and above the
      // lip); the yoke's brass plates riveted, verdigris at the seams; the spirit wet black with violet light on it)
      bell: {
        mottle: { color: 'verd', scale: 0.08, amount: 0.26, soft: 0.25, strength: 0.6, detail: 0.6 },
        rust: { color: 'verd*0.85', color2: 'bell2', amount: 0.1, amount2: 0.14, scale: 0.1, down: 0.5, pits: 0.3 },
        bands: { color: 'bell*0.62', axis: 1, period: 1.1, width: 0.075, ink: 0.55, offset: 0.33 },
        gloss: { size: 0.025, sky: 0.4, amount: 0.5 },
      },
      yoke: { mottle: { color: 'verd', scale: 0.08, amount: 0.3, soft: 0.2, strength: 0.6 }, rust: { color: 'verd', color2: 'yoke*0.8', amount: 0.1, amount2: 0.08, scale: 0.08, down: 0.5, pits: 0.4 }, gloss: { size: 0.03, sky: 0.4, amount: 0.5 } },
      leg: { mottle: { color: 'verd', scale: 0.08, amount: 0.35, soft: 0.2, strength: 0.6 }, rust: { color: 'verd', color2: 'leg*0.8', amount: 0.1, amount2: 0.08, scale: 0.08, down: 0.4, pits: 0.3 } },
      spirit: { gloss: { size: 0.04, sky: 0.9, amount: 1, color: 'shine+0.5' }, mottle: { color: 'shine', scale: 0.12, amount: 0.25, soft: 0.25, strength: 0.4 } },
      cloth: { mottle: { color: 'cloth*0.8', scale: 0.12, amount: 0.3, soft: 0.1 }, scales: { color: 'cloth*0.7', size: 0.2, ink: 0.3, tone: 0.08, amount: 0.2, mode: 1 } },
    },
    saltharbour: {
      // (sheet-2: the cream drum weathered and salt-crusted, coral rust in patches; the wound chain in rows; the turquoise
      // yoke spotted with coral rust)
      drum: { mottle: { color: 'bell*0.85', scale: 0.2, amount: 0.3, soft: 0.2, strength: 0.6 }, spots2: { color: 'salt', scale: 0.05, share: 0.4, size: 0.6, amount: 0.8 }, rust: { color: 'verd', color2: 'bell2', amount: 0.15, amount2: 0, scale: 0.1, down: 0.5, pits: 0.3 } },
      wound: { stripes: { color: 'chain*0.55', axis: 0, period: 0.1, width: 0.3, ink: 0.6 }, spots2: { color: 'verd', scale: 0.06, share: 0.3, size: 0.6, amount: 0.6 } },
      yoke: { rust: { color: 'joint', color2: 'yoke*0.85', amount: 0.25, amount2: 0.1, scale: 0.1, down: 0.5, pits: 0.4 }, spots2: { color: 'salt', scale: 0.05, share: 0.35, size: 0.5, amount: 0.7 } },
      leg: { rust: { color: 'joint', color2: 'leg*0.8', amount: 0.25, amount2: 0.1, scale: 0.1, down: 0.4, pits: 0.3 }, spots2: { color: 'salt', scale: 0.05, share: 0.3, size: 0.5, amount: 0.6 } },
    },
    underside: {
      drum: { rust: { color: 'verd', color2: 'bell2', amount: 0.2, amount2: 0.1, scale: 0.12, down: 0.5, pits: 0.4 } },
      wound: { stripes: { color: 'chain*0.55', axis: 0, period: 0.1, width: 0.3, ink: 0.6 } },
    },
  },
  rootknot: {
    '*': {
      // (sheet-1: a lilac cap freckled with pale raised warts; cream gills fanning out under it; a bulb ribbed top to
      // bottom with small pale dots; ochre roots with lines along them)
      cap: {
        spots: { color: 'cap2+0.3', scale: 0.26, share: 0.4, size: 0.55, soft: 0.04 },
        spots2: { color: 'cap*0.82', scale: 0.08, share: 0.3, size: 0.4, amount: 0.6 },
        mottle: { color: 'cap*0.88', scale: 0.4, amount: 0.35, soft: 0.2, strength: 0.6 },
      },
      gill: { stripes: { color: 'gill*0.72', axis: 4, period: 0.045, width: 0.3, ink: 0.45 } },
      bulb: {
        stripes: { color: 'bulb*0.82', axis: 4, period: 0.16, width: 0.06, ink: 0.3 },
        spots2: { color: 'bulb2+0.4', scale: 0.13, share: 0.35, size: 0.32 },
        mottle: { color: 'bulb2', scale: 0.3, amount: 0.3, soft: 0.2, strength: 0.4 },
      },
      root: { grain: { color: 'root2', spacing: 0.045, ink: 0.35, warp: 0.5, amount: 0.5 }, ...SPECKS('dark', 0.3, 0.05) },
      tendril: { fade: { color: 'tendril*0.7', axis: 1, from: -0.1, to: -0.5 } },
    },
    perdide2: {
      // (sheet-2: the turquoise gills glow softly under the deep teal cap)
      gill: { stripes: { color: 'gill*0.7', axis: 4, period: 0.045, width: 0.3, ink: 0.35 }, glow: { color: 'gill', amount: 0.55, rim: 0.3, core: 1.2, pulse: 1.1, emit: 0.7 } },
    },
    edena: { cap: { spots: null, spots2: null, scales: { color: 'cap*0.8', size: 0.12, ink: 0.3, tone: 0.08, amount: 0.3 } } },
    waterfall: { cap: { gloss: { size: 0.018, sky: 0.5, amount: 0.6 } }, bulb: { gloss: { size: 0.02, sky: 0.5, amount: 0.6 } } },
  },
});

// batch 5 (v1.17): the late spirits and the roller
Object.assign(SURFACES, {
  shade: {
    '*': {
      // (sheet-1: the cloak's worn cloth mottled with a lighter moss, its folds inked down its length, darkening into the
      // violet-black smoke where its tatters break up; the ribbons spotted with holes; the boots' leather glossed; the
      // sword wet ink with violet light on it, the smoke clouded)
      cloak: {
        mottle: { color: 'cloak2', scale: 0.14, amount: 0.35, soft: 0.15, detail: 0.6, strength: 0.6 },
        stripes: { color: 'cloak*0.78', axis: 4, period: 0.13, width: 0.08, ink: 0.15 },
        fade: { color: 'smoke', axis: 1, from: 0.7, to: 0.44 },
        ...SPECKS('lining', 0.35, 0.05),
      },
      hood: { mottle: { color: 'hood2', scale: 0.08, amount: 0.3, soft: 0.15, strength: 0.6 }, ...SPECKS('face', 0.35, 0.04) },
      strip: { spots2: { color: 'lining', scale: 0.06, share: 0.35, size: 0.55, amount: 0.9 }, mottle: { color: 'strip*0.8', scale: 0.08, amount: 0.3, soft: 0.2, strength: 0.6 } },
      boot: { gloss: { size: 0.03, sky: 0.5, amount: 0.6 }, mottle: { color: 'boot*0.82', scale: 0.06, amount: 0.3, soft: 0.2, strength: 0.6 } },
      sword: { gloss: { size: 0.03, sky: 0.9, amount: 1, color: 'shine+0.4' }, mottle: { color: 'shine', scale: 0.06, amount: 0.3, soft: 0.25, strength: 0.6 } },
      smoke: { mottle: { color: 'smoke2', scale: 0.1, amount: 0.4, soft: 0.35, strength: 0.8, detail: 0.6 } },
    },
    // (the woodsman's hood: rough bark, its grain running up to the point, darker in the furrows)
    perdide2: { hood: { grain: { color: 'hood2', spacing: 0.03, ink: 0.45, warp: 0.6, amount: 0.7 }, mottle: { color: 'hood2', scale: 0.07, amount: 0.3, soft: 0.1, strength: 0.6 } } },
    // (the pilgrim's: smooth violet cloth, a pale gold trim round the hood's rim and down the cloak's opening)
    eclipse: {
      hood: { mottle: { color: 'hood2', scale: 0.12, amount: 0.3, soft: 0.25, strength: 0.5 }, bands: { color: 'trim', axis: 1, period: 0.5, width: 0.05, ink: 0.4, offset: 0.12 } },
      cloak: {
        mottle: { color: 'cloak2', scale: 0.16, amount: 0.4, soft: 0.2, detail: 0.6, strength: 0.7 },
        stripes: { color: 'cloak*0.78', axis: 4, period: 0.13, width: 0.08, ink: 0.15 },
        bands: { color: 'trim', axis: 4, period: 6.3, width: 0.012, ink: 0.4, offset: 0 },
        fade: { color: 'smoke', axis: 1, from: 0.7, to: 0.44 },
      },
    },
    incal: { cloak: { scales: { color: 'cloak*0.8', size: 0.22, ink: 0.35, tone: 0.1, amount: 0.3, mode: 1 } } },   // (the vagrant's patched coat)
    garage: { hood: { gloss: { size: 0.03, sky: 0.4, amount: 0.5 } }, cloak: { rust: { color: 'strip', color2: 'cloak2', amount: 0.12, amount2: 0.08, scale: 0.1, down: 0.7, pits: 0.3 } } },
    spheres: { cloak: { gloss: { size: 0.04, sky: 0.7, amount: 0.5 }, fade: { color: 'smoke', axis: 1, from: 0.7, to: 0.44 } } },
    glassdunes: { strip: { gloss: { size: 0.02, sky: 0.9, amount: 1 }, glow: { color: 'strip', amount: 0.3, rim: 0.6, core: 1.5, emit: 0.2 } } },
  },
  roller: {
    '*': {
      // (sheet-1: polished steel in riveted plates, an oily rainbow sheen sliding over it (pink, cyan, gold), crisp
      // highlights; the spiral groove darker; the foot dark teal, wet, rippled across its sole, darker in the folds)
      shell: {
        scales: { color: 'shell*0.75', size: 0.32, ink: 0.3, tone: 0.06, amount: 0.25, mode: 1 },
        mottle: { color: 'rain2', scale: 0.3, amount: 0.22, soft: 0.45, detail: 0.5, strength: 0.55 },
        spots: { color: 'rain1', scale: 0.45, share: 0.4, size: 1.0, soft: 0.5, jitter: 1, amount: 0.3 },
        spots2: { color: 'rain3', scale: 0.38, share: 0.4, size: 1.0, soft: 0.5, amount: 0.3 },
        gloss: { size: 0.01, sky: 0.35, amount: 0.4 },
      },
      spiral: { gloss: { size: 0.03, sky: 0.6, amount: 0.8 } },
      band: { gloss: { size: 0.03, sky: 0.5, amount: 0.7 }, ...SPECKS('spiral', 0.3, 0.04) },
      foot: {
        bands: { color: 'foot2', axis: 2, period: 0.05, width: 0.22, ink: 0.15 },
        mottle: { color: 'foot2', scale: 0.1, amount: 0.3, soft: 0.2, strength: 0.6 },
        gloss: { size: 0.012, sky: 0.4, amount: 0.4 },
      },
      key: { gloss: { size: 0.025, sky: 0.4, amount: 0.6 } },
    },
    // (sheet-2: a pearl of fine tiles, blush and gold lustre, the spiral glowing gold from inside)
    spheres: {
      shell: {
        scales: { color: 'shell*0.85', size: 0.11, ink: 0.18, tone: 0.05, amount: 0.25, mode: 1 },
        mottle: { color: 'rain1', scale: 0.25, amount: 0.25, soft: 0.45, detail: 0.5, strength: 0.6 },
        spots2: { color: 'rain2', scale: 0.35, share: 0.5, size: 1.1, soft: 0.5, amount: 0.4 },
        gloss: { size: 0.025, sky: 0.9, amount: 1 },
      },
      spiral: { glow: { color: 'spiral', amount: 0.6, rim: 0.2, core: 1.2, pulse: 1.2, emit: 0.6 }, gloss: { size: 0.03, sky: 0.6, amount: 0.8 } },
    },
    saltharbour: { shell: { spots2: { color: 'shell2', scale: 0.05, share: 0.55, size: 0.8, amount: 0.95 }, mottle: { color: 'rain2', scale: 0.2, amount: 0.3, soft: 0.2, strength: 0.6 }, scales: null } },
    spacecity: { shell: { bands: { color: 'band', axis: 0, period: 0.36, width: 0.08, ink: 0.3 } } },
    mangrove: { shell: { mottle: { color: 'rain2', scale: 0.18, amount: 0.35, soft: 0.25, strength: 0.6 }, gloss: null, ...SPECKS('band', 0.4, 0.05) } },
  },
  marionette: {
    '*': {
      // (sheet-1: clear glass catching faint prism tints (pink, cyan, gold) in soft patches, a bright rim where it turns
      // from you, crisp highlights; the joints glossy pearl; the knot of smoke clouded violet in black)
      body: {
        mottle: { color: 'prism1', scale: 0.12, amount: 0.3, soft: 0.45, detail: 0.5, strength: 0.7 },
        spots2: { color: 'prism2', scale: 0.16, share: 0.5, size: 1.1, soft: 0.5, amount: 0.45 },
        glow: { color: 'body2', amount: 0.3, rim: 0.85, core: 1.6, emit: 0.1 },
        gloss: { size: 0.03, sky: 0.9, amount: 1 },
      },
      joint: { gloss: { size: 0.025, sky: 0.8, amount: 1 }, mottle: { color: 'body2', scale: 0.05, amount: 0.25, soft: 0.4, strength: 0.5 } },
      smoke: { mottle: { color: 'smoke2', scale: 0.22, amount: 0.25, soft: 0.4, strength: 0.7, detail: 0.6 } },
    },
    // (sheet-2: brown paper creased and patched, string tied round every parcel; the seals' wax glossy)
    bazaar: {
      body: {
        mottle: { color: 'body2', scale: 0.08, amount: 0.4, soft: 0.1, detail: 0.6, strength: 0.7 },
        stripes: { color: 'twine', axis: 1, period: 0.14, width: 0.05, ink: 0.4 },
        ...SPECKS('twine', 0.35, 0.04),
        glow: null, gloss: null, spots2: null,
      },
      joint: { grain: { color: 'twine', spacing: 0.012, ink: 0.4, warp: 0.4, amount: 0.6 }, mottle: null, gloss: null },
    },
    underside: { body: { rust: { color: 'rust', color2: 'body2', amount: 0.25, amount2: 0.1, scale: 0.08, down: 0.6, pits: 0.5 }, glow: null, spots2: null, mottle: null, gloss: { size: 0.03, sky: 0.4, amount: 0.5 } } },
    saltharbour: { body: { drips: { color: 'salt', width: 0.06, from: 1.6, length: 0.4, bulb: 0.3, amount: 0.7 }, mottle: { color: 'body2', scale: 0.1, amount: 0.3, soft: 0.2, strength: 0.6 }, glow: null, spots2: null } },
  },
});

/** A colour of the table: '#rrggbb', a palette key, darker 'key*0.7', paler 'key+0.3'. */
export function surfaceColor(c, palette = {}) {
  if (typeof c !== 'string' || c.startsWith('#')) return c;
  const m = /^([a-z0-9]+)(?:([*+])([\d.]+))?$/i.exec(c);
  if (!m || !palette[m[1]]) return undefined;
  const hex = palette[m[1]];
  if (!m[2]) return hex;
  const k = Number(m[3]), rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const out = rgb.map((x) => (m[2] === '*' ? x * k : x + (1 - x) * k));
  return `#${out.map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The painted surface of an archetype's part in a skin ({ fade, mottle, … } with its colours resolved), or null.
 * @param skin src/enemies/skins.js skinOf: { id, palette }
 */
export function surfaceFor(archetype, skin, name) {
  const T = SURFACES[archetype];
  if (!T || !skin) return null;
  // (numbered parts, a jelly's light0…2, wear their family's: 'light')
  const base = name.replace(/\d+$/, ''), pick = (t) => t?.[name] ?? t?.[base];
  const merged = { ...(pick(T['*']) ?? {}), ...(pick(T[skin.id]) ?? {}) };
  const out = {};
  for (const [k, v] of Object.entries(merged)) {
    if (!v) continue;
    if (k === 'mat') { out.mat = v; continue; }   // (makeMaterial options for the part, not a feature)
    out[k] = Object.fromEntries(Object.entries(v).map(([f, x]) => [f, typeof x === 'string' ? surfaceColor(x, skin.palette) : x]));   // (color, color2, the cracks' ink)
  }
  return Object.keys(out).length ? out : null;
}
