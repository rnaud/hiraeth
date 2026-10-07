// What the interactive changelog (changelog.html, src/changelog-page/) shows beside a line of
// src/changelog.js: before / after pictures, performance numbers, or how to see a change that has no
// picture (docs/systems/changelog.md). The game never imports this: its changelog panel (N), the
// release notes and changelog.md stay text only.
//
// By version, a list of the lines that have something to show. `match` is the line's opening words
// (it must match exactly one line of that version: tests/changelog-media.test.js), then any of
//   shots: [{ name, caption, commit, before?, view, only? }]
//          pictures in changelog-media/<version>/<name>-before.webp and -after.webp, taken by
//          scripts/changelog-shots.mjs at `before` (default: the commit's parent) and `commit`, from
//          `view` (see the script: a References view `ref`, or `level` + camera `eye`/`target`/`fov`,
//          the hour, weather, preset, size, a `setup` script); only: 'after' for a picture with no before
//   numbers: [{ title, unit, better: 'lower' | 'higher', device, rows: [{ where, before, after }], source, note? }]
//          measurements before and after (frame times, fps, draws, the contact audit's counts…); a value
//          is a number or a range written as text ('17–25'), drawn as bars by its middle
//   see:   how to see it in the game, for what a picture can't show (sound, feel, solid ground…)
//   tags:  extra filters beyond the ones read from the words (tagsOf)
// A line of src/changelog.js may also be an object { text, shots?, numbers?, see?, tags? }: the same
// fields, written with the line itself.

import { lineText } from './changelog.js';

export const MEDIA_DIR = 'changelog-media';
export { lineText };

/** The files of a shot (paths from the site's root): before is null for an after-only picture. */
export function shotFiles(v, s) {
  const at = (side) => `${MEDIA_DIR}/${v}/${s.name}-${side}.webp`;
  return { before: s.only === 'after' ? null : at('before'), after: s.only === 'before' ? null : at('after') };
}

/** The worlds by the words lines use for them (the most specific first). */
export const WORLDS = [
  ['vael2', 'Vael II', /Vael II|Sky Stones/],
  ['vael', 'Vael', /\bVael\b(?! II)/],
  ['lorn2', 'Lorn II', /Lorn II|Deep Wood/],
  ['lorn', 'Lorn', /\bLorn\b(?! II)|Hush-House/],
  ['desert', 'The Desert', /desert|Qanat|dune|camps|pilgrim|Givers|sand\b|leviathan|petal station|radio dish|salt lagoon|Bako|Sefa|Marrow|Nour|Speaker|Ama\b|Hessa/i],
  ['shaft', 'The City-Shaft', /City-Shaft|Wren/],
  ['market', 'The Signal Market', /Signal Market/],
  ['buried', 'The Buried Machine', /Buried Machine|rust canyon|great wheel|Engine-House/],
  ['spheres', 'The Garden of Spheres', /Garden of Spheres|the Garden|olive|android wood|umbrella trees|round plaza/],
  ['home', 'Home', /at home|houses at home/],
  ['viridel', 'Viridel', /Viridel/],
  ['garage', 'The Sealed Hangar', /First Garage|Sealed Hangar/],
  ['references', 'References', /References level/],
];

/** The kinds of change, by their words. */
export const KINDS = [
  ['perf', 'Performance', /smoother|lighter on handhelds|frames a second|runs a little|costs? less|automatic resolution|graphics setting|loading screen/i],
  ['characters', 'Characters', /traveller|people|person|cloak|cape|robe|Bako|Sefa|Marrow|Nour|Speaker|Wren is|keepers|bird|face/i],
  ['devices', 'Devices', /Steam Deck|handheld|Retroid|Android/i],
  ['menus', 'Menus & controls', /menu|Sketchbook|Quests|Items shows|panel|\bE \(|prompt|scout|screen on the dash|charms/i],
  ['contact', 'Solid as drawn', /solid|stand on|your feet|hold you up|climb|invisible|sink into/i],
];

/** A line's filters: its worlds and kinds from its words, and any it names itself. */
export function tagsOf(text, extra = []) {
  const tags = new Set(extra);
  for (const [id, , re] of WORLDS) if (re.test(text)) tags.add(id);
  if (tags.has('vael2')) tags.delete('vael');
  if (tags.has('lorn2') && !/\bLorn’s\b|Lorn’s Hush/.test(text)) tags.delete('lorn');
  for (const [id, , re] of KINDS) if (re.test(text)) tags.add(id);
  if ([...tags].some((t) => WORLDS.some(([w]) => w === t))) tags.add('worlds');
  return [...tags];
}


/** The media entry of a line: written with the line, or matched by its opening words here. */
export function mediaFor(v, item, media = CHANGELOG_MEDIA) {
  const text = lineText(item);
  const found = (media[v] ?? []).find((m) => text.startsWith(m.match));
  const inline = typeof item === 'string' ? null : item;
  if (!found && !inline) return null;
  return { ...(found ?? {}), ...(inline ?? {}), text };
}

/**
 * Every version with its lines, each line with its text, tags and media (null when it has none).
 * @param changelog src/changelog.js CHANGELOG
 */
export function changelogEntries(changelog, media = CHANGELOG_MEDIA) {
  return changelog.map((e) => ({
    v: e.v, date: e.date,
    lines: e.items.map((item, i) => {
      const m = mediaFor(e.v, item, media);
      const text = lineText(item);
      return { v: e.v, i, text, tags: tagsOf(text, m?.tags), shots: (m?.shots ?? []).map((s) => ({ ...s, ...shotFiles(e.v, s) })), numbers: m?.numbers ?? [], see: m?.see ?? null };
    }),
  }));
}

// ------------------------------------------------------------------ the views the pictures are taken from
// (scripts/changelog-shots.mjs: the same for the before and the after; hour 10, clear, High, 1280 × 720 unless said)
const RETROID = 'Retroid Pocket (GeckoView), Handheld preset, render scale held at 0.75';
const MAC_X4 = 'Mac, headless Chrome, Handheld preset, CPU slowed ×4';
const AUDIT = 'the contact audit (samples where the drawn shape and the solid one disagree)';
const desertAt = (eye, target, o = {}) => ({ level: 'desert', player: o.player ?? [eye[0], 2, eye[2]], eye, target, fov: o.fov ?? 55, ...o });
const SAVE_DESERT = { flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] };
const studio = (query, size = [960, 720]) => ({ page: 'studio.html', query: `${query}&paused=true`, size, wait: 3000 });
const people = (list, o = {}) => ({ level: 'desert', people: list, size: [1280, 720], wait: 1500, ...o });
const cx = (z) => 28 * Math.sin((z + 40) / 95);   // the Buried Machine's canyon centreline (buried.js canyonX)

export const CHANGELOG_MEDIA = {
};
