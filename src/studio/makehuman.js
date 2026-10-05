// The character studio's MakeHuman prototype (docs/makehuman.md): a second body source, the
// people of scripts/makehuman/build.py (public/anim/mh/), next to the game's Quaternius bodies.
//
//   Body source: makehuman   whoever is shown (a blank body, a crowd or story person's look)
//                            on a MakeHuman body (Who → MakeHuman person; '' the first of their kind)
//   Lineup: makehuman        each MakeHuman person beside the Quaternius body made to match them
//                            (people.json `like`: kind, build, height, body and face morphs),
//                            the Quaternius one on the left
import { BLANK } from './people.js';

/**
 * The MakeHuman person for a spec: the one picked, else one of that kind (a child for a story child,
 * else a grown-up, `n` choosing among them: a crowd lineup's people differ).
 */
export function mhEntry(manifest, id, kind, { n = 0, child = false } = {}) {
  const people = manifest?.people ?? [];
  const picked = people.find((p) => p.id === id);
  if (picked) return picked;
  const own = people.filter((p) => p.kind === kind && (child ? p.years < 13 : p.years >= 18));
  const list = own.length ? own : people.filter((p) => p.kind === kind);
  return list[((n % list.length) + list.length) % list.length] ?? people[0] ?? null;
}

/** A stand-in story definition for a MakeHuman person (NPC options: their size, their name). */
export function mhDef(entry) {
  return { id: `mh-${entry.id}`, name: `MakeHuman · ${entry.label}`, kind: entry.kind, scale: entry.scale, ...(entry.inkFace && Object.keys(entry.inkFace).length ? { face: entry.inkFace } : {}) };
}

/** The Quaternius body made to match a MakeHuman person (their `like`): a definition for NPC (size, body, face). */
export function likeDef(entry) {
  const L = entry.like ?? {};
  return { id: `q-${entry.id}`, name: `Quaternius · ${entry.label}`, kind: L.kind ?? entry.kind, scale: L.height ?? 1, ...(L.morph ? { morph: L.morph } : {}), ...(L.face ? { face: L.face } : {}) };
}

/** The look of the Quaternius twin: a blank body of its kind, in its build (the studio's overrides on top, as lookFor). */
export function likeLook(entry, base) {
  const L = entry.like ?? {};
  return { ...base, kind: L.kind ?? entry.kind, build: L.build ?? base.build, height: L.height ?? 1 };
}

/** The specs of the comparison lineup: [Quaternius twin, MakeHuman person] for the first n people (or those of `ids`: 'child,man'). */
export function mhLineup(manifest, n = 8, ids = '') {
  const out = [], pick = String(ids ?? '').split(',').filter(Boolean);
  const people = (manifest?.people ?? []).filter((e) => !pick.length || pick.includes(e.id));
  for (const entry of people.slice(0, pick.length ? people.length : n)) {
    out.push({ who: 'blank', twinOf: entry, def: likeDef(entry), kind: entry.like?.kind ?? entry.kind });
    out.push({ who: 'blank', mh: entry, def: mhDef(entry), kind: entry.kind });
  }
  return out;
}

/** A blank look for a body of `kind` (as BLANK), for the specs above. */
export const blankFor = (kind) => BLANK(kind === 'f' ? 'f' : 'm');
