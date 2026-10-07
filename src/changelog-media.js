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
  '0.75': [
    { match: 'The sketchbook is now a game menu', shots: [
      { name: 'game-menu', caption: 'View / Select (J) in the desert: the sketchbook before, the game menu after', commit: '74fc72e', view: { level: 'desert', hud: true, save: SAVE_DESERT, setup: 'window.journal.toggle(true)', wait: 2500 } },
    ] },
    { match: 'Items shows what you have found as pictures', shots: [
      { name: 'menu-items', caption: 'The game menu’s Items, everything found', commit: '11001bf', only: 'after', view: { level: 'desert', query: 'items=all', hud: true, save: SAVE_DESERT, setup: "window.journal.toggle(true); window.journal.menu?.open?.('items')", wait: 4000 } },
    ] },
    { match: 'Quests shows only what matters now', shots: [
      { name: 'menu-quests', caption: 'The game menu’s Quests in the desert', commit: '11001bf', only: 'after', view: { level: 'desert', hud: true, save: SAVE_DESERT, setup: "window.journal.toggle(true); window.journal.menu?.open?.('quests')", wait: 2500 } },
    ] },
    { match: 'Sketchbook keeps every story page', shots: [
      { name: 'menu-worlds', caption: 'The game menu’s Worlds', commit: '11001bf', only: 'after', view: { level: 'desert', hud: true, save: SAVE_DESERT, setup: "window.journal.toggle(true); window.journal.menu?.open?.('worlds')", wait: 2500 } },
    ] },
    { match: 'When the scout finds your objective', see: 'Press the top button (Y / △, or the scout’s key) in a world with a quest under way: the line at the bottom gives the goal over its next step.' },
    { match: 'The charms that came out of their boxes', see: 'Open the game menu’s Items with the charms found: each is drawn as what it is (the soles, the scarf, the shell…), not a gold gem.' },
    { match: 'Standing still, the traveller’s legs hold still', shots: [
      { name: 'idle-legs', caption: 'The traveller standing for 16 seconds, a frame a second: before, his right foot steps about; after, it stays put', commit: '14d32a5', size: [2400, 700], from: 'the idle work’s own sheets, before and after, the same spot and clock (6 October)' },
    ], numbers: [
      { title: 'Standing for 20 seconds', better: 'lower', device: 'tests/idle-legs.test.js, the shipped traveller', rows: [
        { where: 'steps taken', before: '20–40', after: 0 },
        { where: 'the fastest a leg bone turned (rad/s)', before: 52, after: '≤ 2' },
      ] },
    ] },
    { match: 'The traveller stands as he is drawn', see: 'Stop anywhere and look at the traveller from the side: his feet are under his hips, a little apart, not in a stride.', numbers: [
      { title: 'How much of the idle clip’s split stance is kept', unit: '%', better: 'lower', device: 'the commit’s numbers (a0c6af7, IDLE_STANCE)', rows: [
        { where: 'front to back', before: 100, after: 30 },
        { where: 'outward', before: 100, after: 40 },
      ] },
    ] },
    { match: 'Standing about, the traveller holds his head up', see: 'Stand still, then run: he looks ahead both times, not down at the ground or at his feet.', numbers: [
      { title: 'Where his face points (degrees below level)', unit: '°', better: 'lower', device: 'the commits’ measurements (ef9c221, 3790374)', rows: [
        { where: 'standing', before: '9–21', after: '0–12' },
        { where: 'jogging', before: 35, after: 20 },
        { where: 'sprinting', before: 48, after: 20 },
      ] },
    ] },
    { match: 'Cabs drive themselves now', shots: [
      { name: 'cab-ride', caption: 'Riding a cab in the Signal Market: before, you drove it yourself (the throttle and steering prompts); after, it flies itself to the stop with you seated inside', commit: 'c872cf4', from: 'the cab work’s own screenshots, before and after (6 October), not one fixed view' },
    ] },
    { match: 'The Signal Market’s cabs stop at', shots: [
      { name: 'cab-dash', caption: 'Getting into a cab: the screen on its dash asks where to', only: 'after', from: 'the cab work’s own screenshots (6 October)' },
    ], see: 'Get into a cab in the Signal Market or the City-Shaft: the screen on its dash lists the stops; pick one with the mouse, a number key or the stick and A / ×.' },
    { match: 'Wren is the old cab itself now', see: 'In the City-Shaft, light the call-lamp at the bottom terrace and get in: Wren talks to you from its dash.' },
    { match: 'On the Steam Deck the settings have the same Updates section', shots: [
      { name: 'deck-updates', caption: 'The settings’ Updates section in the Deck’s app (the Deck runtime on the Mac), a new build waiting', only: 'after', size: [2000, 1200], from: 'the Deck work’s own screenshot (6 October)' },
    ], see: 'On the Steam Deck, open the settings (Menu): the Updates section shows what you are playing, Check for updates, and Download and restart.' },
  ],
  '0.74': [
    { match: 'Seated people’s capes rest on what they sit on', shots: [
      { name: 'seated-capes', caption: 'Bako and Sefa seated, from behind and from the side, in the running game', commit: '7a8806f', view: people([{ id: 'bako', yaw: 2.4 }, { id: 'bako', yaw: 1.57 }, { id: 'sefa', yaw: 2.4 }, { id: 'sefa', yaw: -1.57 }]) },
    ] },
    { match: 'In the City-Shaft the shade is printed flat', shots: [
      { name: 'dish-city-shadows', caption: 'The References’ view of the pink dishes over the blue domes: the dish’s shadow on the sand, hatched before, one solid dark mass after', commit: '001f401', view: { ref: '3774-dish-city' } },
    ] },
    { match: 'No more filter stuck to the screen', shots: [
      { name: 'no-filter', caption: 'Qanat from the plinth’s stair (look at the corners and the sky)', commit: '997e28a', view: desertAt([213.052, 3.246, 370.525], [231.495, 21.846, 402.601], { player: [215.544, 2.346, 374.86], fov: 60 }) },
    ], numbers: [
      { title: 'What stayed on the screen when the camera turned', device: 'Mac, Qanat’s gate, the clock frozen', source: 'the commit’s measurements (997e28a)', rows: [
        { where: 'the corners darkened (%)', before: 19, after: 0 },
        { where: 'the paper grain left on the same pixels (correlation)', before: 0.94, after: 0 },
      ] },
    ] },
    { match: 'Old walls no longer shimmer', see: 'Shimmer only shows in motion: turn the camera slowly in front of Qanat’s gate; the far walls’ grime and hatching stay still instead of crawling.', numbers: [
      { title: 'Shimmer as the camera pans (flickering pixels in 10 000)', better: 'lower', device: 'the motion check: a slow pan, the world frozen', source: 'the commit’s measurements (4d24ba7)', rows: [
        { where: 'Qanat, Medium', before: 22.8, after: 15.8 },
        { where: 'Qanat, Handheld', before: 28.1, after: 19.2 },
        { where: 'the Signal Market', before: 17.8, after: 14.3 },
      ] },
    ] },
    { match: 'The spots on the desert sand are pebbles', shots: [
      { name: 'pebbles', caption: 'The sand at your feet on a dune’s crest at 8 in the morning', commit: '4a16479', view: desertAt([-203, 23.5, 303], [-208, 21.2, 308], { fov: 28, hour: 8, player: [-198, 22, 298] }) },
      { name: 'pebbles-far', caption: 'The open dunes from a crest', commit: '4a16479', view: desertAt([-200, 39.852, 300], [-420, 2.804, 520], { hour: 9, player: [-205.657, 21.133, 305.657] }) },
    ] },
    { match: 'The Steam Deck version updates all of itself', see: 'On the Steam Deck, Check for updates in the settings: a new version of the app around the game comes from the game’s site too, not only the game.' },
    { match: 'On the Steam Deck the game has its own pictures', shots: [
      { name: 'steam-art', caption: 'Memento in the Steam Deck’s library, its banner drawn from the game itself', only: 'after', size: [1280, 800], from: 'the Deck work’s own screenshot of the Deck (7 October)' },
    ] },
    { match: 'The game runs smoothly on handhelds again', numbers: [
      { title: 'Frames a second, every view of every world', unit: 'fps', better: 'higher', device: RETROID, source: 'docs/systems/performance.md, “Every world on the Retroid, in GeckoView”', rows: [
        { where: 'the desert', before: '17–25', after: '44–60' },
        { where: 'the City-Shaft', before: '18–20', after: '44–60' },
        { where: 'the Signal Market', before: '18–24', after: '59–60' },
        { where: 'Vael', before: '18–24', after: '59–60' },
        { where: 'Vael II', before: '18–23', after: '57–60' },
        { where: 'the Buried Machine', before: '21–22', after: '59–60' },
        { where: 'the Garden of Spheres', before: '22–24', after: '59–60' },
        { where: 'Lorn II', before: '22–25', after: '59–60' },
        { where: 'home', before: '17–22', after: '59–60' },
      ] },
      { title: 'The shirt’s work on the processor a frame', unit: 'ms', better: 'lower', device: RETROID, rows: [{ where: 'every world', before: '33–43', after: 1.8 }] },
    ] },
  ],
  '0.73': [
    { match: 'In the Buried Machine your feet and hands meet the metal', numbers: [
      { title: 'Where the solid and the drawn shapes disagree', better: 'lower', device: AUDIT, source: 'the commit’s measurements (8a6ca7f)', rows: [
        { where: 'feet sinking into something drawn', before: 270, after: 69 },
        { where: 'climbing inside something', before: 833, after: 49 },
      ] },
    ], see: 'In the Buried Machine, climb the trench’s pipes and tanks or the Engine-House’s gantry: your hands and feet meet the metal where it is drawn.' },
    { match: 'In the Garden of Spheres the hill’s boulders', numbers: [
      { title: 'Where the solid and the drawn shapes disagree', better: 'lower', device: AUDIT, source: 'the commit’s measurements (8a6ca7f)', rows: [
        { where: 'feet sinking into something drawn', before: 91, after: 6 },
        { where: 'climbing inside something', before: 120, after: 6 },
      ] },
    ], see: 'In the Garden of Spheres, walk onto the singing spheres in the Footprint: they are round underfoot.' },
    { match: 'In Lorn the Hush-House’s dome', numbers: [
      { title: 'Where the solid and the drawn shapes disagree', better: 'lower', device: AUDIT, source: 'the commit’s measurements (8a6ca7f)', rows: [
        { where: 'Lorn: feet sinking', before: 61, after: 13 },
        { where: 'Lorn: climbing inside', before: 35, after: 7 },
        { where: 'Lorn II: feet sinking', before: 97, after: 8 },
        { where: 'Lorn II: climbing inside', before: 5, after: 1 },
      ] },
    ] },
    { match: 'Things you can stand on are the things you see', numbers: [
      { title: 'Feet sinking into something drawn', better: 'lower', device: AUDIT, source: 'the commit’s measurements (8a6ca7f)', rows: [
        { where: 'home', before: 23, after: 0 },
        { where: 'the Signal Market', before: 7, after: 4 },
        { where: 'Viridel', before: 18, after: 3 },
        { where: 'the Sealed Hangar', before: 5, after: 0 },
      ] },
    ] },
    { match: 'In the desert the radio dishes’ bowls', numbers: [
      { title: 'Where the solid and the drawn shapes disagree in the desert', better: 'lower', device: AUDIT, source: 'the commit’s measurements (e43d3c2)', rows: [
        { where: 'walking through something drawn', before: 79, after: 54 },
        { where: 'climbing inside something', before: 35, after: 23 },
      ] },
    ], see: 'At the salt lagoons, step onto a floating salt plate: it holds you now.' },
    { match: 'Every temple’s halls lose the invisible ledge', see: 'In any temple, climb the wall of a round room: at the top you meet the stone cornice’s overhang where it is drawn.' },
    { match: 'The desert’s people carry what their drawings give them', shots: [
      { name: 'desert-props', caption: 'Bako, Sefa, Marrow and the Speaker, in the running game', commit: 'f818c22', view: people([{ id: 'bako' }, { id: 'sefa' }, { id: 'marrow' }, { id: 'speaker' }]) },
    ] },
    { match: 'A few clouds drift over the desert again', shots: [
      { name: 'desert-clouds', caption: 'The open dunes from a crest', commit: 'bdd268d', view: desertAt([-200, 39.852, 300], [-420, 22, 520], { player: [-205.657, 21.133, 305.657] }) },
    ] },
    { match: 'Your footprints in the sand no longer vanish', see: 'Walk across the sand, then turn the camera right round: your footprints stay where you walked.' },
    { match: 'The stone half-arch that hung in the sky', shots: [
      { name: 'qanat-arch', caption: 'From the pilgrims’ camps toward Qanat’s main gate', commit: '1d45790', view: desertAt([120, 8, 225], [181, 16, 318], { player: [122, 2, 228], fov: 30 }) },
    ] },
    { match: 'Vael’s bird stands tall', shots: [
      { name: 'vael-bird', caption: 'The References’ view under the mushroom, the plain and its tower: the bird on the ground', commit: 'f7aedd2', view: { ref: '3783-mushroom-plain' } },
    ] },
    { match: 'In Vael II the mushroom tables lean', shots: [
      { name: 'vael2-stacks', caption: 'The References’ view of the stacked discs and stones', commit: 'f7aedd2', view: { ref: '3784-stacks' } },
      { name: 'vael2-mushrooms', caption: 'Mushrooms in the cloud, the arched cliff', commit: 'f7aedd2', view: { ref: '3784-mushrooms-arches' } },
    ] },
    { match: 'Vael II’s monastery has a cloister', shots: [
      { name: 'vael2-monastery', caption: 'The References’ view of the monastery on the rose cliff', commit: 'f7aedd2', view: { ref: '3784-cliff-monastery' } },
    ] },
    { match: 'The traveller no longer holds a phone', shots: [
      { name: 'no-phone', caption: 'The traveller walking in the character studio, his right hand', commit: 'ff2217c', view: studio('view=hands&yaw=-0.9') },
    ] },
    { match: 'With the tank on your back you now wear a dark leather glove', shots: [
      { name: 'glove', caption: 'The traveller’s right hand with the tank on his back', commit: '2e5a866', view: people([{ id: 'traveller', yaw: -0.9, dist: 1.6, height: 1.0 }, { id: 'traveller', yaw: -1.6, dist: 1.4, height: 0.95 }], { player: [29, 24.456, 132], heading: 0.6435 }) },
    ] },
    { match: 'People sitting on benches, stones and kerbs wear their robes', shots: [
      { name: 'seated-robes', caption: 'Bako and Sefa seated, from in front and the side', commit: '651d9fe', view: people([{ id: 'bako' }, { id: 'bako', yaw: 1.2 }, { id: 'sefa' }, { id: 'sefa', yaw: -1.2 }]) },
    ] },
    { match: 'On the Steam Deck the game starts in Gaming Mode', see: 'On the Steam Deck, start Memento from Gaming Mode: it opens instead of staying on a black screen, and Exit Game closes it at once.' },
  ],
};
