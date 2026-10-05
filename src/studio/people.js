import * as THREE from 'three';
import { namedLook, crowdLook, tribeOf, hairstyleOf, hashSeed } from '../costumes.js';
import { mulberry32 } from '../noise.js';
import { irisFor } from '../eyes.js';
import { ageClassOf } from '../makehuman/people.js';

// Who the character studio can show: a world's story people (src/story/<world>-data.js),
// someone of its crowd (costumes.js crowdLook, by seed) or a blank body, each as the
// game dresses them (costumes.js), with the studio's overrides on top.

// the story's data per world (loaded when the world is picked)
const DATA = {
  desert: () => import('../story/desert-data.js'),
  incal: () => import('../story/incal-data.js'),
  arzach: () => import('../story/arzach-data.js'),
  arzach2: () => import('../story/arzach2-data.js'),
  garage: () => import('../story/garage-data.js'),
  buried: () => import('../story/buried-data.js'),
  edena: () => import('../story/edena-data.js'),
  spheres: () => import('../story/spheres-data.js'),
  perdide: () => import('../story/perdide-data.js'),
  perdide2: () => import('../story/perdide2-data.js'),
  bazaar: () => import('../story/bazaar-data.js'),
  home: () => import('../story/home-data.js'),
};

/** The worlds with story people, in the order of the faces lineup (studio: Lineup → every world's faces). */
export const STORY_WORLDS = Object.keys(DATA);

/** People in a story data module: every exported person (an id, a name and a body), not the things. */
export function peopleIn(mod) {
  const out = [], seen = new Set();
  for (const [key, v] of Object.entries(mod ?? {})) {
    if (key === 'THINGS' || !v || typeof v !== 'object') continue;
    for (const d of Array.isArray(v) ? v : Object.values(v)) {
      if (!d || typeof d !== 'object' || !d.id || !d.name || !(d.palette || d.head || d.kind) || d.narrator || seen.has(d.id)) continue;
      seen.add(d.id);
      out.push(d);
    }
  }
  return out;
}

const casts = new Map();
/** A world's story people (cached). */
export async function castOf(world) {
  if (!casts.has(world)) casts.set(world, DATA[world] ? DATA[world]().then(peopleIn).catch(() => []) : Promise.resolve([]));
  return casts.get(world);
}

/** A body with nothing on: plain clothes, bare head (short hair or long), no cape. */
export function BLANK(kind = 'm') {
  return {
    world: null, tribe: 'a blank body', blank: true,
    cloak: '#c8483a', cloth: '#e2d3b4', legs: '#5a4a40', skin: '#d9a98a', hair: '#4a3226', hat: '#d8a24a', accent: '#3b4f8a',
    head: kind === 'f' ? 'long' : 'short', mask: 'none', body: 'none', prop: 'none', trim: 'none', robe: 0, flare: 0.3,
    capeLen: 0, capeWide: 1, bulk: 0, sleeveless: false, size: 1, kind, build: 'average', height: kind === 'f' ? 0.95 : 1, eyes: irisFor(mulberry32(kind === 'f' ? 2 : 1)),
  };
}

const PIECES = ['head', 'mask', 'body', 'prop', 'trim', 'robe', 'flare', 'capeLen', 'capeWide'];
const COLOURS = ['cloak', 'cloth', 'legs', 'skin', 'hair', 'hat', 'accent', 'eyes'];

/**
 * The look of a person on stage: spec { who: 'npc' | 'crowd' | 'blank', def?, seed? } as the game
 * dresses them in `world`, then the studio's costume pieces (state.l), colours (state.c) and build.
 */
/** A place for a person of the City-Shaft (costumes.js zoneIncal: dressed by how deep they live). */
const SPOT_Y = { rim: 200, upper: 150, middle: 36, lower: -100 };
// (where the story puts its City-Shaft people: src/story/incal.js)
const STORY_Y = { incal: { nima: 150, ossa: -290, pip: -290, dov: 320, wren: 150, corvin: 200, lio: 200, hask: 200 } };

export function lookFor(spec, state, world) {
  let base;
  const y = SPOT_Y[state.spot] ?? STORY_Y[world]?.[spec.def?.id] ?? 0;
  const pos = new THREE.Vector3(0, y, 0);
  if (spec.who === 'npc' && spec.def) {
    const d = spec.def;
    // as NPC does (src/npc.js): seeded by who they are; hair and beard follow their kind only when the story gives one
    base = namedLook({ world, id: d.id, palette: d.palette ?? {}, head: d.head ?? null, cape: d.cape ?? null, look: d.look ?? {}, pos, kind: d.body ?? d.kind ?? null, young: ['child', 'teen'].includes(ageClassOf({ def: d })) });
    base.kind = d.body ?? d.kind ?? 'm';   // (def.body: the body, if not the voice's kind)
  } else if (spec.who === 'crowd') {
    const seed = spec.seed ?? state.seed;
    const kind = state.kind === 'f' || state.kind === 'm' ? state.kind : mulberry32(seed)() < 0.5 ? 'm' : 'f';
    base = crowdLook(mulberry32(seed * 7919 + 13), { world, kind, pos });
  } else base = BLANK(state.kind === 'f' ? 'f' : 'm');
  const s = { ...base };
  for (const k of PIECES) if (state.l?.[k] !== undefined && state.l[k] !== '') s[k] = typeof base[k] === 'number' ? +state.l[k] : state.l[k];
  // bare-headed in their own people's hairstyle (costumes.js tribe.hair), whatever they wear on it
  if (s.head === 'bare') { const r = mulberry32(hashSeed(`bare:${spec.who === 'npc' ? spec.def?.id : spec.seed ?? state.seed}:${s.kind}`)); r(); s.head = hairstyleOf(tribeOf(world, { pos }), s.kind, r()); }
  if (state.l?.beard !== undefined && state.l.mask === undefined) s.mask = state.l.beard ? 'beard' : s.mask === 'beard' ? 'none' : s.mask;
  for (const k of COLOURS) if (state.c?.[k]) s[k] = state.c[k];
  if (state.build) s.build = state.build;
  return s;
}

/** Face variants for the studio's dropdown (morph.js FACE_PRESETS; the Lab's giants wear them all). */
export { FACE_PRESETS } from '../morph.js';
