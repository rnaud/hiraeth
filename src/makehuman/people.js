// The MakeHuman bodies in the game (docs/makehuman.md): each world's people get their bodies from the one
// parametric body (src/makehuman/body.js), by who they are. The Desert's people are MakeHuman bodies by
// default (MH_WORLDS, stage 2), any world's with ?mh=1, none with ?mh=0; the studio's Body source too.
//
//   const people = await loadPeople(base, world)   the world's family of bodies
//   people.humans()                                [man, woman]: the grown-up templates, where the
//                                                  game passes its [m, f] Quaternius ones (NPC, the
//                                                  story, the holograms)
//   people.templateFor({ kind, def, dress, pooled })   the body for a person (npc.js asks it): their age
//                                                  (a story child, an elder: def.age, an elder's face),
//                                                  their build, their world's proportions
//
// A template is a person's skeleton and body; the other builds are bodies on that skeleton
// (profile.buildGeometry: a crowd body takes each person's build, as the Quaternius ones do), so a
// world has at most a few dozen distinct bodies, each shared by everyone of that kind, age and build.
// The traveller stays on his Quaternius body (his suit and gear are fitted to it: stage 2).
import { loadBody, makeBody, bodyGeometryFor } from './body.js';
import { personParams, AGES, paramsKey, MH_BUILDS } from './shape.js';
import { mhLookPieces, mhStyleOf } from './hair.js';
import { buildGeometry } from '../humanoid.js';
import { FACE_MORPHS } from '../morph.js';
import { HEIGHT } from '../costumes.js';

const INK = new Set(FACE_MORPHS.filter((d) => d.ink).map((d) => d.key));

/** How much of the game's face morphs (morph.js FACE_MORPHS: the Quaternius faces' warps) a MakeHuman grown-up keeps: its own face is already shaped. */
export const FACE_KEEP = 0.5;

/** A face morph for a MakeHuman body: a child's only its ink (and `young`), a grown-up's shapes halved, eyes no bigger than 1.1. */
export function filterFace(face, child) {
  if (!face) return face;
  const out = {};
  for (const [k, v] of Object.entries(face)) {
    const d = FACE_MORPHS.find((x) => x.key === k);
    if (k === 'young' || INK.has(k) || !d) { out[k] = v; continue; }
    if (child) continue;
    out[k] = d.def + (v - d.def) * FACE_KEEP;
    if (k === 'eyeSize') out[k] = Math.min(out[k], 1.1);
  }
  return out;
}

/**
 * The age class of a person (shape.js AGES): the story's (def.age), an elder's face, else grown up. A
 * story person the story makes small (def.scale under CHILD_SCALE) without an age is a child too.
 */
export function ageClassOf({ def = null, dress = null } = {}) {
  if (def?.age === 'child') return 'child';
  if (def?.age === 'teen') return 'teen';
  if (def?.age === 'elder' || dress?.faceType === 'elder') return 'elder';
  if (!def?.age && def?.scale && def.scale < CHILD_SCALE) return 'child';
  return 'adult';
}
/** Under this story scale (def.scale) someone with no age of their own is a child (the desert's Ilo, 0.7). */
export const CHILD_SCALE = 0.82;

/** How old a person is (years): the story's own (def.years), else their age class's (shape.js AGES). */
export function yearsOf(who = {}) {
  const y = who.def?.years;
  return Number.isFinite(y) ? y : AGES[ageClassOf(who)];
}

/** The profile hooks humanoid.js reads on a MakeHuman template (its builds, its hair, its face). */
export function equip(scene, { kind, years, build = 'average', world = 'default', over = {} }) {
  const prof = scene.userData.profile;
  const child = years < 13;
  prof.build = build;
  // (y: another age on this skeleton, a crowd body come close as an elder: Humanoid.setBuild)
  prof.buildGeometry = (body, b, morph, y = years) => {
    const base = body.userData.baseGeometry ?? body.geometry;
    const g = (b === build || !b) && y === years ? base : bodyGeometryFor(scene, personParams({ kind, years: y, build: b || build, world, over }));
    if (!morph) return g;
    // the game's body morphs (girths, on the mesh) over the MakeHuman build
    return buildGeometry({ userData: { baseGeometry: g }, geometry: g, skeleton: body.skeleton, bindMatrix: body.bindMatrix }, 'average', morph);
  };
  prof.lookPieces = mhLookPieces;
  prof.lookKey = (look) => `|${mhStyleOf(look) ?? ''}`;
  prof.filterFace = (face) => filterFace(face, child);
  prof.filterMorph = (morph) => (child ? null : morph);
  prof.yearsOf = (look) => AGES[ageClassOf({ dress: look })];
  return scene;
}

/** A Humanoid template for a person (cached by the parametric body): kind, years, build, world, `over` (shape.js personParams). */
export function personTemplate(data, { kind = 'm', years = AGES.adult, build = 'average', world = 'default', over = {}, label = '' } = {}) {
  const params = { ...personParams({ kind, years, build, world, over }), years };
  const scene = makeBody(data, params, { brows: kind === 'm' && years >= 13 ? 1 : 0, id: `${world}|${kind}|${years}|${build}|${paramsKey(params)}`, label });
  const prof = scene.userData.profile;
  if (prof.buildGeometry) return scene;
  equip(scene, { kind, years, build, world, over });
  // The game sets everyone's height as the root's scale (a look's height, HEIGHT.f for a woman, a story's
  // def.scale) for bodies as tall as the Quaternius ones in bind space. Every MakeHuman sample has its hips
  // where the Quaternius man's are, so a MakeHuman woman (longer-legged) stands 5 % taller than a man
  // there: a grown-up's root scale is corrected (heightFix) so a woman is as much shorter than a man of
  // her world as the Quaternius woman is (Q_TOP), a man as MakeHuman makes him. The young stand as tall
  // as MakeHuman makes someone of their age beside the grown-ups of their kind (trueScale: the root's
  // scale itself; a story's child scale was set for a man's body with a big head).
  if (years < 18) {
    const grown = personTemplate(data, { kind, years: AGES.adult, world }).userData.profile;
    const tall = grown.measured.height * grown.heightFix * (kind === 'f' ? HEIGHT.f : 1);   // the grown-up's height in the game
    prof.heightFix = (grown.measured.height * grown.heightFix) / prof.measured.height;
    prof.trueScale = (tall * (prof.size * prof.measured.height) / (grown.size * grown.measured.height)) / prof.measured.height;
  } else if (kind === 'f') {
    const man = personTemplate(data, { kind: 'm', years: AGES.adult, world }).userData.profile;
    const woman = build === 'average' && years === AGES.adult ? prof : personTemplate(data, { kind: 'f', years: AGES.adult, world }).userData.profile;
    prof.heightFix = (Q_TOP.f / Q_TOP.m) * (man.measured.height / woman.measured.height);
  } else prof.heightFix = 1;
  return scene;
}

/** The Quaternius bodies' height in bind space (m: the top of the head, as humanoid.js prepareHuman leaves them; tests/makehuman.test.js measures them): the game's heights were set for these. */
export const Q_TOP = { m: 1.81, f: 1.767 };

export class MakeHumanPeople {
  constructor(data, world = 'default') {
    this.data = data;
    this.world = world;
  }

  template(kind, ageClass = 'adult', build = 'average', years = AGES[ageClass] ?? AGES.adult) {
    const t = personTemplate(this.data, { kind, years, build, world: this.world });
    t.userData.mhPeople = this;
    return t;
  }

  /** The body for a person: a crowd's pooled body is a grown-up of average build (it takes each person's build as it goes). */
  templateFor({ kind = 'm', def = null, dress = null, pooled = false } = {}) {
    const k = ageClassOf({ def }) === 'child' ? def.kind ?? kind : kind;
    if (pooled) return this.template(k, 'adult', 'average');
    const age = ageClassOf({ def, dress });
    return this.template(k === 'f' ? 'f' : 'm', age, dress?.build ?? 'average', yearsOf({ def, dress }));
  }

  /**
   * The crowd's bodies made ahead, one every `gap` ms while the page is idle (each ~15-30 ms): every build
   * of a grown-up and an elder of each kind on the pooled skeletons, so a crowd person coming close never
   * waits for theirs. Returns a promise of how many.
   */
  warm({ gap = 120 } = {}) {
    const jobs = [];
    for (const k of ['m', 'f']) for (const years of [AGES.adult, AGES.elder]) for (const build of Object.keys(MH_BUILDS)) jobs.push([k, years, build]);
    const idle = (f) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(f, { timeout: 2000 }) : setTimeout(f, 0));
    return new Promise((done) => {
      let n = 0;
      const next = () => {
        if (n >= jobs.length) return done(n);
        const [k, years, build] = jobs[n++];
        const t = this.template(k);
        if (!(years === AGES.adult && build === 'average')) bodyGeometryFor(t, personParams({ kind: k, years, build, world: this.world }));
        setTimeout(() => idle(next), gap);
      };
      idle(next);
    });
  }

  /** [man, woman] grown-ups, where the game passes its Quaternius pair. */
  humans() {
    return [this.template('m'), this.template('f')];
  }
}

/**
 * The worlds whose people are MakeHuman bodies by default (docs/makehuman.md: the Desert in stage 2, then
 * each world once its costumes, children and crowd are checked: the Signal Market).
 */
export const MH_WORLDS = new Set(['desert', 'bazaar', 'incal', 'arzach', 'arzach2', 'garage', 'buried', 'edena', 'spheres', 'perdide', 'perdide2', 'mangrove', 'glassdunes', 'waterfall', 'home', 'lab', 'references', 'atelier', 'saltharbour', 'underwater']);

/** Whether a world's people are MakeHuman bodies: the page's ?mh=1 / ?mh=0 (to compare), else the world's default (MH_WORLDS). */
export function usesMakeHuman(world, flag = null) {
  if (flag === '1') return true;
  if (flag === '0') return false;
  return MH_WORLDS.has(world);
}

/** The world's MakeHuman people: the data once, the family for this world. */
export async function loadPeople(base = '/', world = 'default') {
  return new MakeHumanPeople(await loadBody(base), world);
}
