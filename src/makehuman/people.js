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
import { personParams, AGES, paramsKey } from './shape.js';
import { mhLookPieces, mhStyleOf } from './hair.js';
import { buildGeometry } from '../humanoid.js';
import { FACE_MORPHS } from '../morph.js';

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
  // the game sets everyone's height (the root's scale: a story child's def.scale, a look's height) for a
  // body as tall as a grown-up's in bind space; a MakeHuman child's is taller there (its hips are scaled
  // to the grown-ups', its head is bigger): the root's scale corrected so they stand as tall as the game says
  // (heightFix), or, for the young, as tall as MakeHuman makes someone of their age beside the game's
  // grown-ups (trueScale: the root's scale itself; a story's child scale was set for a man's body)
  if (years < 18) {
    const grown = personTemplate(data, { kind, years: AGES.adult, world }).userData.profile;
    prof.heightFix = grown.measured.height / prof.measured.height;
    prof.trueScale = prof.size / grown.size;
  } else prof.heightFix = 1;
  return scene;
}

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

  /** [man, woman] grown-ups, where the game passes its Quaternius pair. */
  humans() {
    return [this.template('m'), this.template('f')];
  }
}

/**
 * The worlds whose people are MakeHuman bodies by default (docs/makehuman.md, stage 2: the Desert first;
 * the others stay on the Quaternius bodies until their costumes and crowds are checked).
 */
export const MH_WORLDS = new Set(['desert']);

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
