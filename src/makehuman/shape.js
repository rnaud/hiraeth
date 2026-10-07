// The MakeHuman parametric body's numbers (docs/makehuman.md, stage 1): who someone is (sex, age,
// build, their people's proportions) as MakeHuman's own sliders, and those sliders as weights on the
// samples scripts/makehuman/build.py made (src/makehuman/body.js turns the weights into a body).
//
// MakeHuman blends its macro targets multilinearly between corners: gender (female, male) x age
// (1, 11, 25, 90 years) x muscle (min, average, max) x weight (min, average, max); height and
// proportions lean each gender and age one way or the other. The build sampled exactly those
// corners, so a body is the same blend of the samples (nodeWeights), as MakeHuman would make it.
// On top: a few targets of the reference person, as deltas (a belly, wider hips and waist for the
// heavy; the face's: the Moebius face and bigger eyes, below).

/** MakeHuman's age corners: its slider's 0, 0.1875, 0.5 and 1 are these ages (years). */
export const AGE_YEARS = [1, 11, 25, 90];
const AGE_AT = [0, 0.1875, 0.5, 1];

/** MakeHuman's age slider for an age in years (piecewise linear between its corners). */
export function ageSlider(years) {
  const y = Math.min(90, Math.max(1, Number.isFinite(years) ? years : 25));
  for (let i = 1; i < AGE_YEARS.length; i++) {
    if (y <= AGE_YEARS[i]) return AGE_AT[i - 1] + ((y - AGE_YEARS[i - 1]) / (AGE_YEARS[i] - AGE_YEARS[i - 1])) * (AGE_AT[i] - AGE_AT[i - 1]);
  }
  return 1;
}

/** Weights of v on a list of corners (piecewise linear: at most two non-zero). */
export function cornerWeights(v, corners) {
  const w = corners.map(() => 0);
  const x = Math.min(corners[corners.length - 1], Math.max(corners[0], v));
  for (let i = 1; i < corners.length; i++) {
    if (x <= corners[i] + 1e-9) {
      const t = (x - corners[i - 1]) / (corners[i] - corners[i - 1]);
      w[i - 1] = 1 - t; w[i] = t;
      return w;
    }
  }
  w[w.length - 1] = 1;
  return w;
}

const near = (a, b) => Math.abs(a - b) < 1e-6;

/**
 * Each sample's weight for a person `p` ({ gender, age (slider), muscle, weight, height, proportions },
 * MakeHuman's 0..1 sliders): the universal corners' multilinear blend, then height and proportions as
 * a lean from each gender-and-age's average corner toward its own sample. Sums to 1.
 */
export function nodeWeights(meta, p) {
  const nodes = meta.nodes, ages = meta.ages, levels = meta.levels;
  const gw = [1 - clamp01(p.gender ?? 0.5), clamp01(p.gender ?? 0.5)];
  const aw = cornerWeights(p.age ?? 0.5, ages), mw = cornerWeights(p.muscle ?? 0.5, levels), ww = cornerWeights(p.weight ?? 0.5, levels);
  const h = clamp01(p.height ?? 0.5), pr = clamp01(p.proportions ?? 0.5);
  const out = new Float64Array(nodes.length);
  const gi = (g) => (near(g, 0) ? 0 : 1), ai = (a) => ages.findIndex((x) => near(x, a)), li = (v) => levels.findIndex((x) => near(x, v));
  const base = new Map();   // "g|a" -> the index of its average corner
  nodes.forEach((n, i) => {
    if (n.kind === 'universal') {
      out[i] = gw[gi(n.gender)] * aw[ai(n.age)] * mw[li(n.muscle)] * ww[li(n.weight)];
      if (near(n.muscle, 0.5) && near(n.weight, 0.5)) base.set(`${gi(n.gender)}|${ai(n.age)}`, i);
    }
  });
  nodes.forEach((n, i) => {
    let lean = 0;
    if (n.kind === 'height') lean = near(n.height, 1) ? Math.max(0, 2 * h - 1) : Math.max(0, 1 - 2 * h);
    else if (n.kind === 'proportions') lean = near(n.proportions, 1) ? Math.max(0, 2 * pr - 1) : Math.max(0, 1 - 2 * pr);
    else return;
    const k = gw[gi(n.gender)] * aw[ai(n.age)] * lean;
    if (!k) return;
    out[i] += k;
    out[base.get(`${gi(n.gender)}|${ai(n.age)}`)] -= k;
  });
  return out;
}
const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5));

// ------------------------------------------------------------------ people
/**
 * The game's builds (costumes.js BUILDS) as MakeHuman's muscle and weight, the heavy with a belly
 * and fuller hips (its weight slider at the top is only moderately heavy).
 */
export const MH_BUILDS = {
  slim: { muscle: 0.42, weight: 0.3 },
  average: { muscle: 0.5, weight: 0.5 },
  broad: { muscle: 0.72, weight: 0.58 },
  heavy: { muscle: 0.42, weight: 1, belly: 0.75, hips: 0.45, waist: 0.4 },
};

/** Age classes (years), as the game tells people apart: a story child, a teenager, a grown-up, an elder. */
export const AGES = { child: 8, teen: 15, adult: 32, elder: 72 };

/**
 * Each world's people (costumes.js worlds): their proportions and how tall MakeHuman makes them
 * (the game's own height still varies per person: the root's scale), and a lean of their builds
 * (muscle, weight added to MH_BUILDS'): the desert's lean and long-limbed, the market's sturdier.
 */
export const WORLD_BODIES = {
  default: { proportions: 0.6, height: 0.55 },
  desert: { proportions: 0.7, height: 0.62, muscle: 0.02, weight: -0.06 },   // pilgrims of the dunes: lean, long-limbed
  glassdunes: { proportions: 0.7, height: 0.62, muscle: 0.04, weight: -0.04 },   // the glassworkers: the desert's people
  incal: { proportions: 0.6, height: 0.55, muscle: 0.03 },                   // the City-Shaft
  arzach: { proportions: 0.65, height: 0.58, weight: -0.04 },                 // the silent ones
  arzach2: { proportions: 0.65, height: 0.58, weight: -0.04 },                // (the bell monastery)
  garage: { proportions: 0.55, height: 0.5, muscle: 0.06, weight: 0.03 },     // the mechanics
  buried: { proportions: 0.55, height: 0.5, weight: 0.04 },                   // the dome people
  edena: { proportions: 0.68, height: 0.58 },
  spheres: { proportions: 0.6, height: 0.52, weight: 0.02 },                  // the listeners
  perdide: { proportions: 0.55, height: 0.52, weight: 0.03 },                 // the swamp people
  perdide2: { proportions: 0.55, height: 0.52, weight: 0.03 },
  mangrove: { proportions: 0.62, height: 0.55, weight: -0.02 },
  waterfall: { proportions: 0.5, height: 0.5, weight: 0.04 },                // the falls' folk: sturdy stair climbers               // the lake folk: slight, long-armed (polers)
  saltharbour: { proportions: 0.55, height: 0.52, weight: 0.04 },            // the harbour folk: sun-dried, sturdy (they haul groceries aboard)
  mangrove: { proportions: 0.62, height: 0.55, weight: -0.02 },               // the lake folk: slight, long-armed (polers)
  antennas: { proportions: 0.56, height: 0.52, weight: 0.02 },                // the mast-menders: climbers
  bazaar: { proportions: 0.5, height: 0.5, weight: 0.07 },                    // the market: sturdier
  home: { proportions: 0.6, height: 0.55 },
  underwater: { proportions: 0.6, height: 0.55, weight: 0 },                 // the sea floor's folk
  eclipse: { proportions: 0.6, height: 0.54, weight: 0 },                    // the city's folk at their tables
  fallenring: { proportions: 0.55, height: 0.53, weight: 0.05 },            // the ring folk: herders, out in the weather
};

/**
 * The face's targets (the reference person's MakeHuman targets, scripts/makehuman/build.py TARGETS)
 * that make the Moebius face: the long, gaunt-but-kind look of his figures (a longer lower face and
 * chin, lean cheeks under clear cheekbones, a long straight narrow nose, a firm brow, a narrower jaw)
 * without the hollow sternness; and the eyes a little bigger than life, so they read at a distance.
 */
export const MOEBIUS_FACE = {
  chinLong: 0.55, chinNarrow: 0.3, chinStrong: 0.25, jawNarrow: 0.3, cheekLean: 0.5, cheekHollow: 0.15, cheekBones: 0.35,
  noseLong: 0.35, noseStraight: 0.5, noseNarrow: 0.2, faceOval: 0.35, browForward: 0.25,
};
/** The eyes' target for everyone (bigger than MakeHuman's realistically small eyes), and a child's on top. */
export const EYES = { all: 1, child: 0.3 };

/** The face targets of a person: the Moebius face for grown-ups (a little less for women, none for a child), bigger eyes. */
export function faceTargets(kind = 'm', years = 32, extra = {}) {
  const grown = smooth(years, 10, 22);
  const k = grown * (kind === 'f' ? 0.75 : 1);
  const out = {};
  for (const [t, w] of Object.entries(MOEBIUS_FACE)) out[t] = w * k;
  out.eyes = EYES.all + EYES.child * (1 - smooth(years, 8, 18));
  for (const [t, w] of Object.entries(extra)) out[t] = (out[t] ?? 0) + w;
  return out;
}
const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * A person as MakeHuman's sliders and targets: kind 'm' | 'f', years, build (MH_BUILDS), world
 * (WORLD_BODIES), and any slider or target set directly (`over`).
 */
export function personParams({ kind = 'm', years = AGES.adult, build = 'average', world = 'default', over = {} } = {}) {
  const W = WORLD_BODIES[world] ?? WORLD_BODIES.default, B = MH_BUILDS[build] ?? MH_BUILDS.average;
  // children and the old: MakeHuman's own build for their age (less muscle, an elder's softer weight)
  const young = 1 - smooth(years, 9, 18), old = smooth(years, 50, 80);
  const p = {
    gender: kind === 'f' ? 0 : 1, age: ageSlider(years),
    muscle: clamp01(0.5 + (B.muscle - 0.5) * (1 - young * 0.6) + (W.muscle ?? 0) - old * 0.12),
    weight: clamp01(0.5 + (B.weight - 0.5) * (1 - young * 0.6) + (W.weight ?? 0)),
    height: W.height ?? 0.55, proportions: W.proportions ?? 0.6,
    targets: { belly: (B.belly ?? 0) * (1 - young) + old * 0.12, hips: (B.hips ?? 0) * (1 - young), waist: (B.waist ?? 0) * (1 - young), ...faceTargets(kind, years) },
  };
  for (const [k, v] of Object.entries(over)) {
    if (k === 'targets') Object.assign(p.targets, v);
    else p[k] = v;
  }
  return p;
}

/** A stable key for a person's sliders and targets (templates and geometries are cached by it). */
export function paramsKey(p) {
  const r = (v) => (Math.round(v * 1000) / 1000).toString();
  const t = Object.entries(p.targets ?? {}).filter(([, v]) => Math.abs(v) > 1e-3).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}:${r(v)}`).join(',');
  return ['gender', 'age', 'muscle', 'weight', 'height', 'proportions'].map((k) => r(p[k] ?? 0.5)).join('|') + `|${t}`;
}
