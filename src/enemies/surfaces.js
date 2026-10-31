// What each skin's parts are painted with (docs/systems/foes.md, "Procedural surfaces"; the shader: src/foe-surface.js):
// the patterns, colour zones, glow and gloss the design sheets draw on each archetype
// (references/enemy-archetypes/<id>/sheet-1.jpg the main skin, sheet-2.jpg the alternate). A body builder's materials
// (src/enemies/plans/kit.js `materials`) look their part up here by name: SURFACES[archetype]['*'][name] is worn in
// every skin, SURFACES[archetype][skin][name] over it (a feature set to null takes one away).
//
// A colour is '#rrggbb', a key of the skin's palette ('shell'), that key darker ('shell*0.7') or paler ('shell+0.3',
// toward white). Sizes are metres of the part (the body's scale included). `mat` adds makeMaterial options to the part
// (a denser hatch: `hatch`).

/** Fine dark specks (the sheets' stippled legs, claws and belly plates). */
const SPECKS = (color = 'dark', amount = 0.55, scale = 0.05) => ({ spots2: { color, scale, share: 0.45, size: 0.45, amount } });

export const SURFACES = {
  crab: {
    // (the shellback, issue #800: its Tripo body is flat colour, the reference's on its home skin; each skin paints the
    // dome, its `shell`, with its own surface (the home skin's a soft ochre mottle, the direct body's): src/enemies/plans/shellback-tripo.js)
    arzach2: { shell: { mottle: { color: 'shell2', scale: 0.22, amount: 0.3, soft: 0.14, detail: 0.4, strength: 0.45 } } },
    saltharbour: {
      shell: {
        mottle: { color: '#c9a35e', scale: 0.16, amount: 0.25, soft: 0.1, detail: 0.5, strength: 0.7 },
        // (sheet-2: cream barnacle rosettes crusted in patches, petals round a teal heart, cream specks round them)
        spots: { color: 'accent', scale: 0.12, share: 0.95, size: 1.8, star: 0.5, ring: 0.6, jitter: 0.7, soft: 0.5, cluster: 0.38, clusterShare: 0.5 },
        spots2: { color: 'accent', scale: 0.05, share: 0.7, size: 1.0, amount: 0.95, soft: 0.5, cluster: 0.38, clusterShare: 0.6 },
      },
    },
    // (a small crisp highlight of the sun's, no sky's: on the Tripo dome's broad smooth top the old ones lit two patches like eyes)
    garage: { shell: { gloss: { size: 0.01, sky: 0 }, bands: { color: 'shell2', axis: 0, period: 0.4, width: 0.05, ink: 0 } } },
    antennas: { shell: { rust: { color: 'accent', color2: 'shell2', amount: 0.3, amount2: 0.15, scale: 0.18, down: 0.6, pits: 0.3 } } },
    bazaar: { shell: { mottle: { color: 'shell2', scale: 0.18, amount: 0.4, soft: 0.1 }, ...SPECKS('dark', 0.4) } },
    underwater: { shell: { spots: { color: 'accent', scale: 0.12, share: 0.6, size: 0.7, ring: 0.5 }, ...SPECKS('joint', 0.5) } },
    glassdunes: { shell: { glow: { color: 'shell2', amount: 0.35, rim: 0.5, core: 1.5, emit: 0.15 }, gloss: { size: 0.012, sky: 0 } } },
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
    // (the home skin, the approved #800 reference's: flat cream and sage, a soft mottle and a little sheen only)
    incal: { body: { rust: null, mottle: { color: 'body2', scale: 0.25, amount: 0.3, soft: 0.2, strength: 0.4 }, gloss: { size: 0.02, sky: 0.3, amount: 0.35 } }, leg: { rust: null, mottle: { color: 'limb*0.9', scale: 0.15, amount: 0.25, soft: 0.2, strength: 0.4 } } },
    underwater: { body: { mottle: { color: 'rust', scale: 0.14, amount: 0.45, soft: 0.1, detail: 0.6, strength: 0.7 }, rust: { color: 'rust*0.9', color2: 'accent+0.2', amount: 0.12, amount2: 0.12, scale: 0.12, down: 0.6, pits: 0.4 } } },
  },
  blot: {
    // (wet ink: a crisp white glint of the sun and a violet one of the sky, streaks of violet light in it)
    '*': { ink: { gloss: { size: 0.09, sky: 0.9, amount: 1, color: 'shine+0.6', streaks: 9, streakWidth: 0.22 }, mottle: { color: 'shine', scale: 0.3, amount: 0.25, soft: 0.25, strength: 0.4, detail: 0.3 } }, edge: { mottle: { color: 'edge*0.75', scale: 0.08, amount: 0.4, soft: 0.06 } },
      // (#800, the Tripo body: its lilac flank a soft wet light, its belly plate the world's colour soaked in, blotched)
      shine: { gloss: { size: 0.12, sky: 0.7, amount: 0.7 }, fade: { color: 'shine*0.8', axis: 1, from: 0.2, to: 0.75 } }, belly: { mottle: { color: 'belly*0.86', scale: 0.1, amount: 0.35, soft: 0.2, strength: 0.6 } } },
    garage: { ink: { gloss: { size: 0.09, sky: 0.9, amount: 1, color: 'shine+0.6', streaks: 9, streakWidth: 0.22 }, mottle: { color: 'shine', scale: 0.2, amount: 0.35, soft: 0.2, strength: 0.55, detail: 0.6 }, spots2: { color: 'edge', scale: 0.08, share: 0.35, size: 0.6, amount: 0.8 } } },
  },
  worm: {
    '*': {
      body: { mottle: { color: 'ring', scale: 0.25, amount: 0.35, soft: 0.15, strength: 0.6 }, ...SPECKS('ring*0.8', 0.5, 0.05) },
      ring: { mottle: { color: 'body', scale: 0.2, amount: 0.3, soft: 0.15, strength: 0.5 } },
      fin: { grain: { color: 'fin*0.88', spacing: 0.06, ink: 0.3, warp: 0.2, amount: 0.4 }, ...SPECKS('ring', 0.5, 0.06) },
      // (#800, the Tripo body: its belly soft and pale, a faint mottle)
      belly: { mottle: { color: 'belly*0.9', scale: 0.22, amount: 0.3, soft: 0.2, strength: 0.5 } },
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
    // (the lamp moth, #800: the reference's plain orange body, warm from inside; no lantern's ribs)
    perdide2: { lantern: { glow: { color: 'glow', amount: 0.35, rim: 0.2, core: 1.4, pulse: 2.2, emit: 0.35 }, bands: null } },
  },
  centipede: {
    '*': {
      // (the sheet's rivets: a ring of them near each plate's front and back edge)
      // (the glosses small and of the sun's alone, #800: on the Tripo body's broad smooth plates the sky's lit white patches)
      plate: { rust: { color: 'plate*0.8', color2: 'accent', amount: 0.15, amount2: 0, scale: 0.12, down: 0.5, pits: 0.4 }, gloss: { size: 0.01, sky: 0, amount: 0.5 }, rivets: { color: 'plate+0.25', axis: 2, period: 0.19, offset: 0.5, count: 16, size: 0.035, ink: 0.55, shine: 0.25 } },
      head: { rust: { color: 'head*0.8', color2: 'accent', amount: 0.15, amount2: 0, scale: 0.1, down: 0.5, pits: 0.4 }, gloss: { size: 0.01, sky: 0, amount: 0.5 } },
    },
    // (the home skin, the approved #800 reference's: flat salmon plates, a soft mottle and a small gloss only)
    buried: {
      plate: { rust: null, rivets: null, gloss: null, mottle: { color: 'plate2', scale: 0.3, amount: 0.3, soft: 0.2, detail: 0.4, strength: 0.4 } },
      head: { rust: null, gloss: null, mottle: { color: 'plate2', scale: 0.25, amount: 0.25, soft: 0.2, strength: 0.4 } },
    },
    fallenring: { plate: { gloss: { size: 0.012, sky: 0 }, mottle: { color: 'plate2', scale: 0.1, amount: 0.3, soft: 0.06, strength: 0.6 } } },
    eclipse: { plate: { spots2: { color: 'accent', scale: 0.06, share: 0.3, size: 0.35 } } },
  },
  jelly: {
    '*': {
      bell: { glow: { color: 'bell2', amount: 0.35, rim: 0.45, core: 1.6, emit: 0.1 }, mottle: { color: 'bell2', scale: 0.25, amount: 0.4, soft: 0.25, strength: 0.6 } },
      // the paper lanterns' globes (light0…2): ribs round them, brighter at the heart
      light: { glow: { color: '#fffaf0', amount: 0.45, rim: 0, core: 2.2, pulse: 1.8, emit: 0.6 }, bands: { color: 'lantern', axis: 1, period: 0.075, width: 0.06, ink: 0.45, amount: 0.6 } },
    },
    // (the cloud jelly, #800: the reference's salmon bulbs drawn with fine ribs from their neck to their foot)
    arzach2: { light: { glow: { color: '#fff4e8', amount: 0.3, rim: 0, core: 2.2, pulse: 1.8, emit: 0.35 }, bands: { color: 'lantern*0.8', axis: 4, period: 0.55, width: 0.05, ink: 0.35, amount: 0.5 } } },
    underwater: {
      // (white glaze with two cobalt bands round its crown and a broken one lower down, cobalt underneath)
      bell: { gloss: { size: 0.03, sky: 0.7 }, stripes: { color: 'dark', axis: 1, period: 1, width: 0.05, offset: -0.6 }, bands: { color: 'dark', axis: 1, period: 1, width: 0.025, offset: -0.5 }, spots: { color: 'dark', scale: 0.32, share: 0.18, size: 1.2, ring: 0.3, soft: 0.3 }, glow: null },
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
    // (the home skin, the approved #800 reference's: a plain sage skin, a smooth orange belly; a soft mottle only)
    perdide: {
      skin: { spots: null, spots2: null, mottle: { color: 'skin2', scale: 0.3, amount: 0.3, soft: 0.2, detail: 0.4, strength: 0.4 } },
      belly: { bands: null, spots2: null, mottle: { color: 'belly*0.94', scale: 0.25, amount: 0.25, soft: 0.2, strength: 0.4 } },
      toe: { mottle: null, stripes: { color: 'toe*0.9', axis: 2, period: 0.12, width: 0.08, ink: 0.15, amount: 0.35 } },
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
        // (the ochre marks between the two lines: a ring of dabs round the belly)
        rivets: { color: 'band', axis: 1, period: 1, offset: 0.155, count: 11, size: 0.075, ink: 0, shine: 0 },
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
    // (the home skin, the approved #800 reference's: a plain orange shell, a soft mottle only)
    desert: { dome: { bands: null, spots2: null, gloss: null, mottle: { color: 'dome2', scale: 0.2, amount: 0.3, soft: 0.2, strength: 0.4 } } },
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
  fencer: {
    '*': {
      // (issue #665, no sheet: glazed ceramic plates with fine panel lines, a few worn patches; brass trim; the seams lit)
      plate: { bands: { color: 'plate*0.86', axis: 1, period: 0.16, width: 0.012, ink: 0.35 }, mottle: { color: 'plate2', scale: 0.2, amount: 0.25, soft: 0.3, strength: 0.4 }, gloss: { size: 0.025, sky: 0.55, amount: 0.6 } },
      shield: { bands: { color: 'shield*0.82', axis: 0, period: 0.12, width: 0.01, ink: 0.3 }, gloss: { size: 0.03, sky: 0.6, amount: 0.65 } },
      trim: { gloss: { size: 0.03, sky: 0.4, amount: 0.6 } },
      steel: { gloss: { size: 0.02, sky: 0.9, amount: 0.9 } },
      seam: { glow: { color: 'seam', amount: 0.5, rim: 0.3, core: 2, emit: 0.4, pulse: 1.2 } },
      frame: { mottle: { color: 'frame*0.8', scale: 0.08, amount: 0.3, soft: 0.2, strength: 0.4 } },
    },
  },
  // ----------------------------------------------------------------------------- the makers' defunct droids (issue #726)
  // one surface for the family (DROID_SURFACE, below): the sentinel, the oracle and the crawler wear it in every skin
  sentinel: { '*': null },
  oracle: { '*': null },
  crawler: { '*': null },
  brute: {
    '*': {
      // (sheet-1: old ivory cracked all over like a dropped jar, fine dark seams, the widest cracks glowing violet; tar
      // running down from the belt; a few warm stains; brass fittings with verdigris at their seams)
      body: {
        // (v1.46: a lighter net, as the sheet's pen draws it: fewer, finer seams, and only some of the wider cracks violet)
        cracks: { color: 'glow', ink: 'seam', inkAmount: 0.2, scale: 0.46, width: 0.014, tone: 0.025, veins: 0.75, vein: 0.045, glow: 0.95, share: 0.38 },
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
      // (#800: the spool drone's slate cap wears what the ring drone's ivory rims did)
      cap: { gloss: { size: 0.03, sky: 0.5, amount: 0.7 }, mottle: { color: 'rust', scale: 0.08, amount: 0.15, soft: 0.1, strength: 0.6 } },
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
      cap: { gloss: { size: 0.04, sky: 0.8, amount: 1 }, mottle: { color: '#f0e0f4', scale: 0.1, amount: 0.2, soft: 0.3, strength: 0.5 } },
      smoke: { mottle: { color: 'smoke2', scale: 0.14, amount: 0.45, soft: 0.35, strength: 0.8, detail: 0.5 } },
    },
    // (the home skin, the approved #800 reference's: flat cream plates, a soft mottle and a little sheen; a little rust)
    incal: { plate: { rust: { color: 'rust', color2: 'plate2', amount: 0.08, amount2: 0, scale: 0.12, down: 0.2, pits: 0.2 }, bands: null, belly: null, mottle: { color: 'plate2', scale: 0.25, amount: 0.3, soft: 0.2, strength: 0.4 }, gloss: { size: 0.02, sky: 0.3, amount: 0.35 } } },
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
      // (the spore pod it throws, issue #769: a soft ball of spores freckled in its gills' colour)
      pod: {
        spots: { color: 'gill', scale: 0.12, share: 0.45, size: 0.45, soft: 0.05 },
        mottle: { color: 'spore*0.85', scale: 0.3, amount: 0.4, soft: 0.2, strength: 0.5 },
      },
    },
    perdide2: {
      // (sheet-2: the turquoise gills glow softly under the deep teal cap)
      gill: { stripes: { color: 'gill*0.7', axis: 4, period: 0.045, width: 0.3, ink: 0.35 }, glow: { color: 'gill', amount: 0.55, rim: 0.3, core: 1.2, pulse: 1.1, emit: 0.7 } },
    },
    edena: { cap: { spots: null, spots2: null, scales: { color: 'cap*0.8', size: 0.12, ink: 0.3, tone: 0.08, amount: 0.3 } } },
    waterfall: { cap: { gloss: { size: 0.018, sky: 0.5, amount: 0.6 } }, bulb: { gloss: { size: 0.02, sky: 0.5, amount: 0.6 } } },
  },
});

// batch 5 (v1.18): the late spirits and the roller
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
  wisp: {
    '*': {
      // (sheet-1: the petals glossy ink, their shine broken in wet streaks, a deep violet coming up from the cup into
      // their lower halves and the shadows; the coal mottled orange and yellow, hot at the heart)
      petal: {
        fade: { color: 'shell2', axis: 1, from: 0.1, to: -0.7, amount: 0.5 },
        gloss: { size: 0.05, sky: 0.55, amount: 0.8, streaks: 5, streakWidth: 0.35 },
      },
      edge: { gloss: { size: 0.03, sky: 0.5, amount: 0.6 } },
      core: { mottle: { color: 'fire', scale: 0.07, amount: 0.45, soft: 0.15, strength: 0.8 }, glow: { color: 'fire', amount: 0.5, rim: 0.3, core: 2.2, pulse: 2.4, emit: 0.7 } },
    },
    // (sheet-4, the marsh wisp: pale lichen in flower-shaped rosettes gathered in colonies over half of its dull mossy
    // petals, flecks of it between them; a soft sheen, not the cinder wisp's wet ink)
    perdide2: { petal: {
      spots: { color: 'lichen', scale: 0.11, share: 0.95, size: 1.8, jitter: 0.9, star: 0.3, soft: 0.3, cluster: 0.22, clusterShare: 0.55 },
      spots2: { color: 'lichen', scale: 0.04, share: 0.45, size: 0.8, amount: 0.75, soft: 0.3, cluster: 0.22, clusterShare: 0.65 },
      gloss: { size: 0.05, sky: 0.35, amount: 0.3, streaks: 5, streakWidth: 0.35 },
    }, drip: { gloss: { size: 0.04, sky: 0.5, amount: 0.6 } } },
  },
});

// The mummers (issue #724): patched sack, torn rag, rope, a dented brass pot, wet glossy ink, driftwood (sheets in
// references/enemy-archetypes/mummer/ and mummerking/).
Object.assign(SURFACES, {
  mummer: {
    '*': {
      // (sheet-1: the sack stitched from big patches, sun-faded indigo with ochre and sand-pale ones, a pen line of
      // stitches round each; ink seeping from the seams and running down)
      sack: {
        scales: { color: 'patch2', size: 0.2, ink: 0.55, tone: 0.3, amount: 0.22, mode: 1 },
        mottle: { color: 'patch', scale: 0.19, amount: 0.34, soft: 0.02, detail: 0.2, strength: 0.95 },
        drips: { color: 'ink', width: 0.07, from: 0.0, length: 0.14, bulb: 0.3, amount: 0.55 },
      },
      rag: { mottle: { color: 'rag*0.78', scale: 0.05, amount: 0.4, soft: 0.1, strength: 0.6 }, stripes: { color: 'rag*0.7', axis: 1, period: 0.05, width: 0.15, ink: 0.15 }, ...SPECKS('rag*0.6', 0.4, 0.03) },
      rope: { mottle: { color: 'rope*0.72', scale: 0.012, amount: 0.45, soft: 0.1, strength: 0.7 }, ...SPECKS('rope*0.55', 0.5, 0.01) },
      // (the pot: brass worn bright on its dents, tarnished in its creases, a little verdigris at the seams; a crisp glint)
      brass: { rust: { color: 'brass*0.68', color2: 'verd', amount: 0.16, amount2: 0.06, scale: 0.06, down: 0.5, pits: 0.4 }, gloss: { size: 0.03, sky: 0.55, amount: 0.75 } },
      // (the ink: wet, black with a violet sheen)
      ink: { gloss: { size: 0.035, sky: 0.7, amount: 0.95, color: 'sheen+0.3' } },
      wood: { grain: { color: 'wood*0.78', spacing: 0.02, ink: 0.4, warp: 0.6, amount: 0.55 } },
      iron: { rust: { color: 'iron*0.7', color2: '#9a6a3a', amount: 0.25, amount2: 0.15, scale: 0.05, down: 0.4, pits: 0.4 }, gloss: { size: 0.02, sky: 0.5, amount: 0.5 } },
    },
  },
  mummerking: {
    '*': {
      sack: {
        scales: { color: 'patch2', size: 0.42, ink: 0.55, tone: 0.3, amount: 0.22, mode: 1 },
        mottle: { color: 'patch', scale: 0.4, amount: 0.38, soft: 0.02, detail: 0.2, strength: 0.95 },
        drips: { color: 'ink', width: 0.12, from: 0.1, length: 0.3, bulb: 0.3, amount: 0.55 },
      },
      rag: { mottle: { color: 'rag*0.78', scale: 0.1, amount: 0.4, soft: 0.1, strength: 0.6 }, stripes: { color: 'rag*0.7', axis: 1, period: 0.1, width: 0.15, ink: 0.15 }, ...SPECKS('rag*0.6', 0.4, 0.05) },
      rope: { mottle: { color: 'rope*0.72', scale: 0.02, amount: 0.45, soft: 0.1, strength: 0.7 }, ...SPECKS('rope*0.55', 0.5, 0.015) },
      brass: { rust: { color: 'brass*0.7', color2: 'verd', amount: 0.1, amount2: 0.05, scale: 0.08, down: 0.5, pits: 0.3 }, gloss: { size: 0.04, sky: 0.6, amount: 0.85 } },
      // (the cauldron: green patina over copper, the copper showing where it is worn, dark at its rim)
      copper: { rust: { color: 'copper2', color2: 'copper*0.75', amount: 0.22, amount2: 0.2, scale: 0.09, down: 0.3, pits: 0.5 }, gloss: { size: 0.04, sky: 0.4, amount: 0.5 } },
      ink: { gloss: { size: 0.05, sky: 0.7, amount: 0.95, color: 'sheen+0.3' } },
      // (the barrel's staves: dark oak in vertical boards, inked between; the crown and the beam paler, weathered)
      wood: { stripes: { color: 'wood*0.62', axis: 4, period: 0.6, width: 0.08, ink: 0.5 }, grain: { color: 'wood*0.8', spacing: 0.03, ink: 0.35, warp: 0.5, amount: 0.5 } },
      iron: { rust: { color: 'iron*0.8', color2: '#8a5a3a', amount: 0.25, amount2: 0.15, scale: 0.08, down: 0.4, pits: 0.5 } },
      pale: { grain: { color: 'wood2*0.75', spacing: 0.035, ink: 0.4, warp: 0.5, amount: 0.55 } },
    },
  },
});

// Roster v4's monsters (issue #726; sheets in references/enemy-archetypes/grunt/ and hulk/): skin, cloth and hide, wood.
Object.assign(SURFACES, {
  grunt: {
    '*': {
      // (sheet-1: tomato red, deeper in its creases and blotched paler on its belly, cheeks and snout; fine dark stipple and
      // a soft sheen on its round belly and head)
      skin: {
        mottle: { color: 'skin+0.12', scale: 0.09, amount: 0.32, soft: 0.14, detail: 0.45, strength: 0.5 },
        spots2: { color: 'crease', scale: 0.03, share: 0.4, size: 0.4, amount: 0.45 },
      },
      // (the khaki loincloth: a coarse weave, darker stains, torn)
      cloth: { mottle: { color: 'cloth2', scale: 0.06, amount: 0.4, soft: 0.1, strength: 0.6 }, ...SPECKS('cloth2*0.7', 0.4, 0.02) },
      leather: { mottle: { color: 'leather*0.7', scale: 0.03, amount: 0.4, soft: 0.1, strength: 0.6 }, gloss: { size: 0.02, sky: 0.4, amount: 0.4 } },
      iron: { rust: { color: 'iron*0.7', color2: '#9a6a3a', amount: 0.25, amount2: 0.15, scale: 0.03, down: 0.4, pits: 0.4 }, gloss: { size: 0.015, sky: 0.5, amount: 0.5 } },
      // (the club: grey-brown wood, its grain running along it, the knobs darker; the rack's spear and bow the same)
      wood: { grain: { color: 'wood*0.72', spacing: 0.015, ink: 0.4, warp: 0.7, amount: 0.55 }, mottle: { color: 'wood2', scale: 0.05, amount: 0.3, soft: 0.1, strength: 0.5 } },
      bone: { fade: { color: 'bone*0.75', axis: 1, from: -0.02, to: 0.03 } },
      ink: { gloss: { size: 0.02, sky: 0.6, amount: 0.8 } },
    },
  },
  hulk: {
    '*': {
      // (sheet-1: slate blue, lilac in its shadows, its muscles' creases inked; a sheen on its shoulders)
      skin: {
        mottle: { color: 'skin2', scale: 0.22, amount: 0.3, soft: 0.16, detail: 0.4, strength: 0.5 },
        spots2: { color: 'crease', scale: 0.06, share: 0.35, size: 0.4, amount: 0.4 },
      },
      // (the belly: pale icy blue, smooth, washed a little bluer toward its edges; its shade lifted and its hue kept, so
      // the light falls on it softly instead of a flat white band beside a grey one)
      belly: { mat: { shade: 0.6, shadeHue: 0.7 }, mottle: { color: 'belly*0.9', scale: 0.22, amount: 0.35, soft: 0.45, detail: 0.4, strength: 0.5 }, ...SPECKS('crease', 0.2, 0.05) },
      // (the kilt: hide patches in brown, olive and tan, a stitched line round each, ragged and stained)
      hide: {
        scales: { color: 'hide2', size: 0.26, ink: 0.55, tone: 0.35, amount: 0.3, mode: 1 },
        mottle: { color: 'hide3', scale: 0.24, amount: 0.38, soft: 0.02, detail: 0.2, strength: 0.95 },
        ...SPECKS('hide*0.6', 0.4, 0.04),
      },
      rope: { mottle: { color: 'rope*0.72', scale: 0.02, amount: 0.45, soft: 0.1, strength: 0.7 }, ...SPECKS('rope*0.55', 0.5, 0.015) },
      wood: { grain: { color: 'wood*0.7', spacing: 0.03, ink: 0.4, warp: 0.5, amount: 0.55 }, mottle: { color: 'wood2', scale: 0.12, amount: 0.3, soft: 0.1, strength: 0.5 } },
      iron: { rust: { color: 'iron*0.8', color2: '#8a5a3a', amount: 0.22, amount2: 0.12, scale: 0.06, down: 0.4, pits: 0.5 }, gloss: { size: 0.03, sky: 0.5, amount: 0.5 } },
      // (the horn and the fangs, the toenails: ivory, ringed, darker at the root)
      horn: { bands: { color: 'horn*0.88', axis: 1, period: 0.04, width: 0.12, ink: 0.08 }, gloss: { size: 0.02, sky: 0.5, amount: 0.5 } },
      ink: { gloss: { size: 0.02, sky: 0.6, amount: 0.8 } },
    },
  },
});

/**
 * The droids' one surface (issue #726; src/enemies/plans/droid.js; their sheets): the ivory ceramic weathered as the sheets
 * paint it, warm grey-brown stains in soft blotches, grime and a little moss gathered low on each panel, small dark chips
 * flaked off the glaze, a dull glaze's shine; the dark joints worn to a grey here and there; the seams lit; the moss in
 * tufts. Their stronger tier (DROID_TIER_SURFACE): the ceramic scorched, soot over it in blotches and low on each panel,
 * a net of fine cracks glowing red through it, chips charred black.
 */
export const DROID_SURFACE = {
  ceramic: {
    // (soft edges: the sheets wash their stains on, no pen line round them)
    mottle: { color: 'stain', scale: 0.18, amount: 0.38, soft: 0.5, detail: 0.6, strength: 0.65 },
    // (grime low on each panel: the drips' runs, faint, under the stains)
    drips: { color: 'stain+0.15', width: 0.07, from: 0.6, length: 0.25, bulb: 0.1, amount: 0.3 },
    spots2: { color: 'stain*0.75', scale: 0.03, share: 0.08, size: 0.4, amount: 0.45, soft: 0.6 },
    gloss: { size: 0.03, sky: 0.45, amount: 0.4 },
  },
  ring: { mottle: { color: 'stain', scale: 0.08, amount: 0.25, soft: 0.2, strength: 0.5 }, gloss: { size: 0.02, sky: 0.5, amount: 0.5 } },
  joint: { mottle: { color: 'joint2', scale: 0.05, amount: 0.3, soft: 0.2, strength: 0.6 }, gloss: { size: 0.02, sky: 0.5, amount: 0.45 } },
  seam: { glow: { color: 'seam', amount: 0.6, rim: 0.3, core: 2, emit: 0.5, pulse: 1.4 } },
  moss: { mottle: { color: 'moss*0.68', scale: 0.025, amount: 0.45, soft: 0.1 }, ...SPECKS('moss+0.35', 0.5, 0.012) },
  steel: { gloss: { size: 0.02, sky: 0.9, amount: 0.85 }, rust: { color: 'stain*0.7', color2: 'stain', amount: 0.08, amount2: 0.04, scale: 0.05, down: 0.3, pits: 0.4 } },
};
export const DROID_TIER_SURFACE = {
  ceramic: {
    mottle: { color: '#2a221c', scale: 0.14, amount: 0.3, soft: 0.6, detail: 0.6, strength: 0.6 },
    rust: { color: '#231b16', color2: 'stain', amount: 0.15, amount2: 0.1, scale: 0.08, down: 0.85, pits: 0.6 },
    cracks: { color: 'seam', ink: '#14100e', inkAmount: 0.6, scale: 0.12, width: 0.02, tone: 0.04, veins: 0.32, vein: 0.03, glow: 0.7, share: 0.3 },
    gloss: { size: 0.03, sky: 0.3, amount: 0.25 },
  },
  ring: { mottle: { color: '#1d1714', scale: 0.08, amount: 0.4, soft: 0.2, strength: 0.7 } },
  joint: { mottle: { color: '#0e0c0c', scale: 0.05, amount: 0.4, soft: 0.2, strength: 0.6 } },
  moss: { mottle: { color: '#1d1714', scale: 0.025, amount: 0.5, soft: 0.1 } },
  steel: { mottle: { color: '#1d1714', scale: 0.04, amount: 0.4, soft: 0.2 } },
};
const droidParts = (names) => Object.fromEntries(names.map((n) => [n, DROID_SURFACE[n]]));
SURFACES.sentinel['*'] = droidParts(['ceramic', 'joint', 'seam', 'moss', 'steel']);
SURFACES.oracle['*'] = droidParts(['ceramic', 'joint', 'seam', 'ring']);
// (#800: the survey crawler, the reference's clean ceramic: the droids' joints, a soft mottle on its cream and sage)
SURFACES.crawler['*'] = { ...droidParts(['joint']), ceramic: { mottle: { color: 'ceramic2', scale: 0.12, amount: 0.3, soft: 0.25, strength: 0.4 }, gloss: { size: 0.02, sky: 0.3, amount: 0.3 } }, leg: { mottle: { color: 'leg*0.9', scale: 0.08, amount: 0.25, soft: 0.2, strength: 0.4 } } };
/** An archetype's own stronger-tier surface instead of the bands (TIER_SURFACE): the droids' scorch. */
export const TIER_SURFACES = { sentinel: DROID_TIER_SURFACE, oracle: DROID_TIER_SURFACE, crawler: DROID_TIER_SURFACE };
// The third batch (issue #726; sheets in references/enemy-archetypes/prowler/ and warlord/).
Object.assign(SURFACES, {
  prowler: {
    '*': {
      // (sheet-1: smooth leaf-green skin, its fine scales only a stipple; paler blotches on its flanks; a soft sheen)
      skin: {
        mottle: { color: 'skin2', scale: 0.12, amount: 0.3, soft: 0.16, detail: 0.4, strength: 0.45 },
        spots2: { color: 'crease', scale: 0.025, share: 0.3, size: 0.35, amount: 0.25 },
        gloss: { size: 0.02, sky: 0.35, amount: 0.25 },
      },
      // (the cream throat, chest, belly and the tail's underside: smooth, a few faint ventral lines across it)
      // (its shade lifted and its hue kept: cream in the back light too, never grey)
      belly: { mat: { shade: 0.45, shadeHue: 0.8 }, bands: { color: 'belly2', axis: 1, period: 0.05, width: 0.08, ink: 0.06 } },
      // (polished steel: a bright highlight, faint smudges)
      // (its shade lifted: the blade's flat stays bright steel turned from the sun, not a dark blue slab)
      steel: { mat: { shade: 0.5, shadeHue: 0.6 }, gloss: { size: 0.025, sky: 0.9, amount: 0.8 }, mottle: { color: 'steel*0.78', scale: 0.03, amount: 0.3, soft: 0.2, strength: 0.5 } },
      leather: { mottle: { color: 'leather*0.7', scale: 0.03, amount: 0.4, soft: 0.1, strength: 0.6 }, gloss: { size: 0.02, sky: 0.4, amount: 0.3 } },
      bone: { fade: { color: 'bone*0.72', axis: 1, from: -0.02, to: 0.03 } },
      ink: { gloss: { size: 0.02, sky: 0.6, amount: 0.8 } },
    },
  },
  warlord: {
    '*': {
      // (sheet-1: deep crimson, the muscles' creases darker, a fine stipple in the shade)
      skin: {
        mottle: { color: 'skin2', scale: 0.18, amount: 0.28, soft: 0.16, detail: 0.4, strength: 0.45 },
        spots2: { color: 'crease', scale: 0.05, share: 0.35, size: 0.4, amount: 0.4 },
      },
      // (the mane: dark brown, combed into long strands, paler streaks through it)
      mane: { grain: { color: 'mane*0.6', spacing: 0.012, ink: 0.5, warp: 0.9, amount: 0.7 }, mottle: { color: 'mane2', scale: 0.08, amount: 0.35, soft: 0.1, strength: 0.6 } },
      // (the horns: ridged rings along them, darker at the root)
      horn: { grain: { color: 'horn2', spacing: 0.022, ink: 0.25, warp: 0.2, amount: 0.55 }, gloss: { size: 0.02, sky: 0.4, amount: 0.3 } },
      // (rough bronze: blotched darker, pitted, a dull sheen; the plates the same)
      bronze: { rust: { color: 'bronze2', color2: '#5e4426', amount: 0.2, amount2: 0.08, scale: 0.025, down: 0.3, pits: 0.3 }, gloss: { size: 0.03, sky: 0.45, amount: 0.45 } },
      plate: { rust: { color: 'bronze2', color2: '#5e4426', amount: 0.2, amount2: 0.08, scale: 0.03, down: 0.3, pits: 0.3 }, gloss: { size: 0.035, sky: 0.45, amount: 0.45 } },
      // (the loincloth and the belt: coarse, stained)
      cloth: { mottle: { color: 'cloth*0.75', scale: 0.07, amount: 0.4, soft: 0.1, strength: 0.6 }, ...SPECKS('cloth*0.6', 0.4, 0.025) },
      wood: { grain: { color: 'wood*0.7', spacing: 0.02, ink: 0.4, warp: 0.3, amount: 0.55 }, mottle: { color: 'wood2', scale: 0.12, amount: 0.3, soft: 0.1, strength: 0.5 } },
      steel: { gloss: { size: 0.03, sky: 0.8, amount: 0.7 }, mottle: { color: 'steel*0.75', scale: 0.05, amount: 0.3, soft: 0.2, strength: 0.5 } },
    },
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

/** A plate of armour (src/enemies/plans/kit.js plate, issue #722): rows of pale rivet heads round it, dark wear low on it, a dull shine. */
export const PLATE_SURFACE = {
  rivets: { color: '#efe4c4', axis: 1, period: 0.22, offset: 0.5, count: 20, size: 0.055, ink: 0.6, shine: 0.35 },
  rust: { color: '#2e2622', color2: '#5a4a3a', amount: 0.18, amount2: 0.08, scale: 0.14, down: 0.7, pits: 0.5 },
  gloss: { size: 0.03, sky: 0.45, amount: 0.5 },
};
/**
 * The stronger tier's bands (issue #722, D13; src/enemies/skins.js tierSkin darkens its palette): broad near-black bands
 * across every part of its body but its eyes, glows, smoke, ink and plates (TIER_BARE), a pen line at each edge.
 */
export const TIER_SURFACE = { stripes: { color: '#16121a', amount: 0.82, axis: 1, period: 0.36, width: 0.24, ink: 0.4 } };
export const TIER_BARE = /^(eye|eyes|glow|lamp|beam|core|lip|brew|stream|slag|smoke|smokeHi|mist|halo|ward|line|thread|ink|spirit|plate|light|flame|fire|spore|lens|glass|cloth|canvas|ripple|pool|sand)|Build$/;

/**
 * The painted surface of an archetype's part in a skin ({ fade, mottle, … } with its colours resolved), or null.
 * @param skin src/enemies/skins.js skinOf: { id, palette }
 */
export function surfaceFor(archetype, skin, name) {
  const T = SURFACES[archetype] ?? {};
  if (!skin) return null;
  // (numbered parts, a jelly's light0…2, wear their family's: 'light')
  const base = name.replace(/\d+$/, ''), pick = (t) => t?.[name] ?? t?.[base];
  // (a plate of armour, issue #722: riveted, worn, its own unless the archetype paints it; a tier's parts banded: TIER_SURFACE)
  // (an archetype with a tier surface of its own, the droids' scorch: that, part by part, instead of the bands)
  const own = TIER_SURFACES[archetype], tierPaint = !skin.tier ? {} : own ? pick(own) ?? {} : !TIER_BARE.test(base) ? TIER_SURFACE : {};
  const merged = { ...(base === 'plate' && !pick(T['*']) ? PLATE_SURFACE : {}), ...(pick(T['*']) ?? {}), ...(pick(T[skin.id]) ?? {}), ...tierPaint };
  const out = {};
  for (const [k, v] of Object.entries(merged)) {
    if (!v) continue;
    if (k === 'mat') { out.mat = v; continue; }   // (makeMaterial options for the part, not a feature)
    out[k] = Object.fromEntries(Object.entries(v).map(([f, x]) => [f, typeof x === 'string' ? surfaceColor(x, skin.palette) : x]));   // (color, color2, the cracks' ink)
  }
  return Object.keys(out).length ? out : null;
}
