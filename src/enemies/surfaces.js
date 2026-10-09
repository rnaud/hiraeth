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
    out[k] = Object.fromEntries(Object.entries(v).map(([f, x]) => [f, f === 'color' || f === 'color2' ? surfaceColor(x, skin.palette) : x]));
  }
  return Object.keys(out).length ? out : null;
}
