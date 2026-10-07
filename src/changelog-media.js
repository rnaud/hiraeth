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
  '0.82': [
    { match: 'The traveller moves more like a person at the moments that used to look mechanical', shots: [
      { name: 'captured-start', caption: 'Setting off at a walk (the stick half way), a frame every tenth of a second from the side: before, the jog loop hunches him forward; after, Mixamo’s captured start keeps him upright, arms swinging', size: [1280, 237], from: 'the Motion page’s frame strips (motionPage.sheet), the same scripted run before and after (7 October)' },
      { name: 'captured-stop', caption: 'Letting go of the stick at a walk, seen from in front: after, the captured stop throws his arms out to brake; the feet land in the same places', size: [1280, 237], from: 'the Motion page’s frame strips, the same run before and after (7 October)' },
      { name: 'captured-pivot', caption: 'Doubling back at a run: after, the head and shoulders turn into it first', size: [1280, 237], from: 'the Motion page’s frame strips, the same run before and after (7 October)' },
    ], numbers: [
      { title: 'Foot sliding (the worst contact)', unit: 'm', better: 'lower', device: 'Node, the gait harness on the coral-shirt traveller (scripts/mocap/compare.mjs)', source: 'docs/systems/animation.md, “Captured starts, stops and turns over the loops”', rows: [
        { where: 'walk, run, turn back, stop', before: 0.11, after: 0.11 },
        { where: 'walk, quarter turn, stop', before: 0.08, after: 0.08 },
        { where: 'turn round on the spot', before: 0.09, after: 0.09 },
        { where: 'slow walk, stop', before: 0.05, after: 0.05 },
        { where: 'the same with motion matching instead (not used)', before: 0.11, after: 0.25 },
      ] },
      { title: 'How fast the pose answers the stick', unit: 's', better: 'lower', device: 'Node, the gait harness on the coral-shirt traveller', source: 'docs/systems/animation.md', rows: [
        { where: 'from standing, the stick pushed: a foot off the ground', before: 0.13, after: 0.13 },
        { where: 'slow walk: a foot off the ground', before: 0.17, after: 0.17 },
        { where: 'letting go at a walk: both feet held', before: 0.9, after: 0.9 },
        { where: 'facing back after turning at a run', before: 0.3, after: 0.3 },
      ] },
      { title: 'The traveller’s animation a frame (walking, stopping, turning, jumping about the desert)', unit: 'ms', better: 'lower', device: MAC_X4, source: 'docs/systems/animation.md, “The traveller’s captured moves”: two runs each, the captured moves off (before) and on', rows: [
        { where: 'the player’s whole update, run 1', before: 1.64, after: 1.43 },
        { where: 'the player’s whole update, run 2', before: 1.76, after: 1.71 },
        { where: 'the Animator', before: '0.22–0.26', after: '0.21–0.25' },
      ], note: 'within the run-to-run noise: the moves cost nothing measurable' },
    ], see: 'Walk with the stick half way and let go, tap back to turn round on the spot, or run and pull back: the body above the legs follows the capture. The dev menu’s Motion section switches it off to compare.' },
    { match: 'Knocked down, the traveller gets up as a person does', shots: [
      { name: 'getup-stomach', caption: 'Knocked forward onto his face: before, the kneel; after, Mixamo’s get-up from the stomach, placed where he lies', size: [1280, 143], from: 'the Motion page’s frame strips, the same knockdown before and after (7 October)' },
      { name: 'getup-back', caption: 'Knocked back: after, he sits up and rises from his back', size: [1280, 143], from: 'the Motion page’s frame strips, the same knockdown before and after (7 October)' },
    ], numbers: [
      { title: 'Lying to standing', unit: 's', better: 'lower', device: 'the game’s timing (src/ragdoll.js GET_UP, KNOCK)', source: 'docs/systems/animation.md, “The traveller’s captured moves”', rows: [
        { where: 'from the back', before: 1.25, after: 1.45 },
        { where: 'from the stomach', before: 1.25, after: 2.05 },
      ], note: 'the captured get-ups play at twice their pace; the kneel was quicker, but the same for every fall' },
    ] },
    { match: 'Jumps and landings look caught from life', shots: [
      { name: 'running-jump', caption: 'A running jump, from behind: before, a frog-legged tuck with the arms straight out; after, the captured stride through the air', size: [1280, 216], from: 'the Motion page’s frame strips, the same jump before and after (7 October)' },
      { name: 'drop', caption: 'Walking off a 1.44 m ledge toward the camera: after, the captured landing’s deep crouch', size: [1280, 216], from: 'the Motion page’s frame strips, the same drop before and after (7 October)' },
    ], see: 'Run and jump, walk off a ledge, fall from a roof at a run, or climb a wall and jump off it (A / × while climbing). The flight itself is as before: the same height, the same time in the air, the same place to land.' },
    { match: 'Standing still a while, he now and then looks about him', see: 'Stand still: after 7 s he looks about him (Mixamo’s look-around), later breathes a while, then the old look-around, ten seconds apart. Only the body above the legs moves: the feet stay planted to the millimetre (tests/idle-legs.test.js stands him 36 s).' },
    { match: 'Picking something up off the ground he goes down on one knee', shots: [
      { name: 'kneel', caption: 'Picking something up: down on one knee, a look at it, and up again (E pressed at 0.5 s)', only: 'after', size: [1280, 216], from: 'the Motion page’s frame strip (7 October)' },
      { name: 'pet', caption: 'Petting Moustache: kneeling, a hand reached out to him', only: 'after', size: [1280, 216], from: 'the Motion page’s frame strip (7 October)' },
    ], see: 'Pick up a feather in Vael, a flower at home, or pet Moustache at home: walking off stands him up at once.' },
  ],
  '0.81': [
    { match: 'What’s new (N) has a See what changed button', shots: [
      { name: 'see-what-changed', caption: 'This page: a line of v0.77 with its before and after, the split dragged to the left', only: 'after', size: [1440, 900], from: 'a screenshot of changelog.html (7 October)' },
    ] },
  ],
  '0.80': [
    { match: 'Crowded places run smoother on handhelds', numbers: [
      { title: 'A frame at the camps and in the Signal Market’s crowd', unit: 'ms', better: 'lower', device: MAC_X4, source: 'docs/systems/performance.md, “The people posed without recomputing what was current”', rows: [
        { where: 'the camps: the whole frame', before: 25.7, after: 22.8 },
        { where: 'the camps: the people’s update', before: 6.1, after: 4.9 },
        { where: 'the Signal Market’s crowd: the whole frame', before: 14.0, after: 13.2 },
        { where: 'the Signal Market’s crowd: the people’s update', before: 3.6, after: 2.9 },
      ] },
    ], see: 'Nothing looks different: the people are posed to the same float as before (checked bone by bone, frame by frame); it is the time each frame takes that went down.' },
    { match: 'On the Handheld and Steam Deck settings the grass grows further', see: 'On the Handheld or Steam Deck setting, walk into the Garden of Spheres’ meadows or the dry grass round home: the blades reach well ahead of the traveller instead of stopping a few steps in front of him. (A still picture barely shows it: the numbers say how far.)', numbers: [
      { title: 'How far the grass grows round you', unit: 'm', better: 'higher', device: 'the Handheld and Steam Deck settings', source: 'docs/systems/performance.md, “What the Handheld and the Deck lose next to High”', rows: [
        { where: 'Handheld: the full grass', before: 11.5, after: 14 },
        { where: 'Handheld: the far, thinner grass', before: 26, after: 36 },
        { where: 'Steam Deck: the full grass', before: 13.5, after: 16 },
        { where: 'Steam Deck: the far, thinner grass', before: 30, after: 40 },
      ] },
      { title: 'What it costs, walking the Garden’s bench path', unit: 'ms', better: 'lower', device: MAC_X4, rows: [
        { where: 'the processor a frame', before: 11.6, after: 11.5 },
        { where: 'the graphics a frame', before: 7.3, after: 7.3 },
      ] },
    ] },
  ],
  '0.79': [
    { match: 'Cloaks hang over people’s arms now', shots: [
      { name: 'cloak-arms', caption: 'Bako and the Speaker from in front and from three-quarters, in the running game', commit: 'a526f2e', view: people([{ id: 'bako' }, { id: 'bako', yaw: 0.8 }, { id: 'speaker' }, { id: 'speaker', yaw: -0.8 }]) },
    ], numbers: [
      { title: 'Of each person’s hands and forearms, the share the cloak covered (idle / walking / talking)', unit: '%', better: 'lower', device: 'the character studio, MakeHuman bodies', rows: [
        { where: 'Bako', before: '51–84', after: 0 },
        { where: 'the Speaker', before: '51–65', after: 0 },
        { where: 'Nour', before: '31–41', after: 0 },
        { where: 'Ama, talking', before: 42, after: 0 },
        { where: 'Hessa, talking', before: 31, after: 0 },
      ] },
    ] },
    { match: 'Bako’s bag hangs over his cloak', shots: [
      { name: 'bako-bag', caption: 'Bako from in front, three-quarters and the side', commit: '3221594', before: '27ffa13^', view: people([{ id: 'bako' }, { id: 'bako', yaw: 0.8 }, { id: 'bako', yaw: 1.57 }]) },
    ] },
    { match: 'Sefa slings her oud on her back', shots: [
      { name: 'sefa-walk', caption: 'Sefa walking, from behind and from the side, in the character studio', commit: 'df5f5c4', view: studio('who=npc&world=desert&npc=sefa&source=makehuman&anim=game:walk&time=0.6&yaw=2.6', [1280, 720]) },
      { name: 'marrow-walk', caption: 'Marrow walking, in the character studio', commit: 'df5f5c4', view: studio('who=npc&world=desert&npc=marrow&source=makehuman&anim=game:walk&time=0.6&yaw=2.2', [1280, 720]) },
    ] },
    { match: 'In Vael II the needle spires and the mushroom tables', shots: [
      { name: 'vael2-needles', caption: 'The References’ view of the needles against the peach sky', commit: 'bb521ba', view: { ref: '3783-spires' } },
      { name: 'vael2-tables', caption: 'The References’ view under the mushroom, the plain and its tower', commit: 'bb521ba', view: { ref: '3783-mushroom-plain' } },
    ] },
    { match: 'The cracks in Vael II’s peach plain', shots: [
      { name: 'vael2-crevasse', caption: 'The References’ view of the crevasse, the tower and the far sea of cloud', commit: 'cdb7daa', view: { ref: '3785-crevasse' } },
    ] },
    { match: 'Vael II’s sea of cloud is printed flat', shots: [
      { name: 'vael2-cloud', caption: 'Vael II from over its start at 9 in the morning, the sea of cloud below', commit: 'a5a6b41', view: { level: 'arzach2', hour: 9, player: [0, 41.13, 22], eye: [0, 70, 31.27], target: [-48.35, 40.65, 11.66] } },
      { name: 'vael2-cloud-afternoon', caption: 'The same at 4 in the afternoon', commit: 'a5a6b41', view: { level: 'arzach2', hour: 16, player: [0, 41.13, 22], eye: [0, 70, 31.27], target: [-48.35, 40.65, 11.66] } },
    ] },
    { match: 'At dusk and at night Vael II’s shadows', shots: [
      { name: 'vael2-dusk', caption: 'Vael II’s start at dusk', commit: '02974b3', view: { level: 'arzach2', hour: 18.6, player: [0, 41.13, 22], eye: [0, 45, 31.27], target: [0, 42.82, 21.51] } },
      { name: 'vael2-night', caption: 'The same at night', commit: '02974b3', view: { level: 'arzach2', hour: 22, player: [0, 41.13, 22], eye: [0, 45, 31.27], target: [0, 42.82, 21.51] } },
    ] },
    { match: 'The game menu’s Quests panel lists everything', see: 'Finish the desert’s first quest, travel to Vael and open the game menu (View / Select, or J): Quests lists the desert’s quest under Done instead of “None yet”.' },
    { match: 'In the Sketchbook, a story you told on an older save', see: 'Load a save from before the story pages (v0.6x) whose story you had told, open the game menu’s Sketchbook: that world’s story reads as told.' },
    { match: 'The Buried Machine’s drum is lined', shots: [
      { name: 'buried-drum', caption: 'The References’ view of the traveller in the drum', commit: '27255e7', before: '6de2ddd^', view: { ref: '3791-oculus-traveller' } },
      { name: 'buried-teal-hall', caption: 'The References’ view of the porthole in the teal hall', commit: '27255e7', before: '6de2ddd^', view: { ref: '3790-teal-porthole' } },
    ] },
    { match: 'Under the City-Shaft’s terraces', see: 'In the City-Shaft, look up from a lower terrace at the blue underside of the one above: pipes, casings and plates hang between its ribs.' },
    { match: 'The undersides of Vael II’s mushroom tables', shots: [
      { name: 'vael2-caps', caption: 'The References’ view up under the giant cap', commit: '87d6195', view: { ref: '3787-giant-cap' } },
      { name: 'vael2-under-cap', caption: 'The References’ view under the great cap, the birds and the traveller', commit: '87d6195', view: { ref: '3786-under-cap' } },
    ] },
    { match: 'The Signal Market’s back alleys', shots: [
      { name: 'market-alley', caption: 'Into a back alley off the Signal Market’s street', commit: 'dfa7e07', view: { level: 'bazaar', player: [-24, 0, 73], eye: [-26, 5, 73], target: [-52, 9, 73], fov: 60 } },
    ] },
    { match: 'Stepping out of a cab beside a building', see: 'In the Signal Market or the City-Shaft, ride a cab to a stop beside a wall and step out (E, or B / ○): the camera stays outside the cab.' },
    { match: 'E (B / ○) uses what you are facing', shots: [
      { name: 'cab-prompt', caption: 'Facing a parked cab with people about: the prompt over it says what E will do', only: 'after', size: [1280, 633], from: 'the interaction work’s own screenshot (7 October)' },
    ], see: 'Walk up to a parked cab with someone standing at your shoulder: the prompt over the cab says it will get you in, and E (B / ○) does.' },
  ],
  '0.78': [
    { match: 'The City-Shaft looks more like its drawings', shots: [
      { name: 'shaft-wide', caption: 'Across and down the shaft to its lake', commit: '0bb9a0a', view: { level: 'incal', player: [274, 200, 0], eye: [283.27, 228.87, 0], target: [2.6, -46.8, 8.11] } },
    ] },
    { match: 'The Signal Market’s stalls are full now', shots: [
      { name: 'market-stalls-ref', caption: 'The References’ view of the long street of stalls', commit: '17d2e92', before: 'af8e8c6^', view: { ref: '3808-long-street' } },
    ] },
    { match: 'In the Buried Machine the trench walls are a mass of pipes', shots: [
      { name: 'buried-trench', caption: 'The References’ view of the domes on the ridge and the pipes in the trench', commit: '86c6ee4', view: { ref: '3789-domes-trench' } },
      { name: 'buried-city', caption: 'The References’ view of the ring and the city hanging over it', commit: '86c6ee4', view: { ref: '3789-city-ring' } },
    ] },
    { match: 'The desert’s canyon walls and violet cliffs', shots: [
      { name: 'violet-cliffs', caption: 'The References’ view of the turquoise pool in the violet cliffs', commit: '74f6ff6', view: { ref: '3774-violet-pool' } },
    ] },
    { match: 'A wall turned away from the sun now stays in full shadow', see: 'In the Signal Market or Qanat, look at a wall turned from the sun with another building between it and the sun: it is one even shadow, not a lighter half-tone patch.' },
    { match: 'Where sand has banked against an old wall', see: 'Walk along Qanat’s outer wall where the sand banks against it: the pale band of dust at the wall’s foot follows the top of the sand.' },
    { match: 'The plaster is stained darker round the doors', see: 'Walk up to a door in Qanat, at home, in the Signal Market or at Vael II’s monastery: the plaster round it is darker, worn by hands.' },
    { match: 'In the References level the gorge under the rope bridges', shots: [
      { name: 'gorge-shadow', caption: 'The References’ view of the rope bridges over the gorge', commit: '22c1b63', view: { ref: 'bridges' } },
    ] },
    { match: 'In the References level the Signal Market’s panels', shots: [
      { name: 'ref-market-crowd', caption: 'The crowded skybridge and the round towers', commit: 'af8e8c6', view: { ref: '3804-crowded-bridge' } },
      { name: 'ref-market-cabs', caption: 'The bridge between the towers, cabs under it', commit: 'af8e8c6', view: { ref: '3807-bridge-cabs' } },
      { name: 'ref-shaft-balcony', caption: 'The balcony over the slot in the City-Shaft', commit: '0bb9a0a', view: { ref: '3782-balcony' } },
    ] },
    { match: 'Looking across the City-Shaft is lighter on handhelds', numbers: [
      { title: 'Draw calls in close views of the towers', better: 'lower', device: 'headless Chrome, Handheld preset', source: 'docs/systems/performance.md, “Round 3, on the Mac”', rows: [
        { where: 'a tower close by', before: 313, after: 141 },
        { where: 'another', before: 328, after: 110 },
        { where: 'a third', before: 547, after: 115 },
      ] },
      { title: 'The processor’s work a frame', unit: 'ms', better: 'lower', device: MAC_X4, rows: [
        { where: 'the rim', before: 35.6, after: 31.3 },
        { where: 'the wide view across the shaft', before: 39.8, after: 37.3 },
      ] },
    ], see: 'The towers look exactly as before (0.001–0.16 % of the pixels apart, the moving things): the gain is in how they are drawn.' },
  ],
  '0.77': [
    { match: 'The traveller’s face moves now', see: 'Talk to anyone and watch the traveller in the conversation’s close-up: he smiles, frowns or looks worried with what is said, blinks, glances about, and his mouth moves as he speaks.' },
    { match: 'The fluid tank is the glass jar', shots: [
      { name: 'flask', caption: 'The traveller from behind, the tank on his back', commit: 'c3cceb8', view: people([{ id: 'traveller', yaw: 2.6, dist: 2.6, height: 1.2 }, { id: 'traveller', yaw: 3.14, dist: 2.2, height: 1.3 }], { player: [29, 24.456, 132], heading: 0.6435 }) },
    ] },
    { match: 'On handhelds every world runs a little smoother around the traveller', numbers: [
      { title: 'The traveller’s shirt: its work on the processor a frame', unit: 'ms', better: 'lower', device: MAC_X4, source: 'docs/systems/performance.md, “The traveller’s overshirt on the GPU”', rows: [
        { where: 'the shirt’s update (median 0.2–0.5)', before: 3.5, after: 0.5 },
        { where: 'positions and normals sent to the graphics chip a frame (kB)', before: 260, after: 16 },
      ] },
    ] },
    { match: 'In the Garden of Spheres the white hill is carved', shots: [
      { name: 'garden-white-hill', caption: 'The References’ view of the white hill and the stepped pyramid on top', commit: '8d8a6e4', before: '702658c^', view: { ref: '3793-white-hill' } },
    ] },
    { match: 'The Garden’s olives and shrubs', shots: [
      { name: 'garden-olives', caption: 'The References’ view of the olive grove round the plaza', commit: '8d8a6e4', before: '702658c^', view: { ref: '3793-olive-plaza' } },
      { name: 'garden-hedges', caption: 'The round plaza between the fruit hedges', commit: '8d8a6e4', before: '702658c^', view: { ref: '3795-plaza-hedges' } },
    ] },
    { match: 'The undersides of the great umbrella trees', shots: [
      { name: 'garden-umbrellas', caption: 'The References’ view under the canopies, the pyramids beyond', commit: '8d8a6e4', before: '702658c^', view: { ref: '3794-canopies-pyramids' } },
    ] },
    { match: 'The round plaza is paved', shots: [
      { name: 'garden-plaza', caption: 'The References’ view of the golden sphere setting behind the plaza', commit: '8d8a6e4', before: '702658c^', view: { ref: '3796-golden-sphere-plaza' } },
    ] },
    { match: 'The robot statue in the android wood', shots: [
      { name: 'garden-robot', caption: 'The References’ view of the white ruins in the wood', commit: '8d8a6e4', before: '702658c^', view: { ref: '3794-wood-ruins' } },
    ] },
    { match: 'In Lorn II the great roots are tangles', shots: [
      { name: 'lorn2-arches', caption: 'The References’ view under the root arches, the stream', commit: '799d4df', before: 'c04f540^', view: { ref: '3797-root-arches' } },
      { name: 'lorn2-cave', caption: 'The traveller before the root cave', commit: '799d4df', before: 'c04f540^', view: { ref: '3797-cave-traveller' } },
    ] },
    { match: 'Lorn II’s roots and the bushes on its banks', shots: [
      { name: 'lorn2-hatching', caption: 'The References’ view down the stream between the trunks', commit: '799d4df', before: 'c04f540^', view: { ref: '3798-stream-trunks' } },
    ] },
    { match: 'Look up near the start of Lorn II’s path', shots: [
      { name: 'lorn2-nest', caption: 'The References’ view of the nest of eggs in the great mushroom', commit: '799d4df', before: 'c04f540^', view: { ref: '3797-nest-shroom' } },
    ] },
    { match: 'The desert’s people carry the rest', shots: [
      { name: 'nour-marrow', caption: 'Nour and Marrow from in front and three-quarters, in the running game', commit: 'c69e864', view: people([{ id: 'nour' }, { id: 'nour', yaw: 0.8 }, { id: 'marrow' }, { id: 'marrow', yaw: 0.8 }]) },
      { name: 'sefa-speaker', caption: 'Sefa and the Speaker', commit: 'c69e864', view: people([{ id: 'sefa' }, { id: 'sefa', yaw: -0.8 }, { id: 'speaker' }, { id: 'speaker', yaw: 0.8 }]) },
    ] },
    { match: 'Sefa’s oud no longer pokes through her cloak', see: 'In the desert, follow Sefa as she walks between the camps and Qanat: her cloak swings round the oud instead of the oud showing through it.' },
    { match: 'The desert sand no longer looks bare at noon', shots: [
      { name: 'noon-pebbles', caption: 'The sand at your feet on a dune’s crest at half past twelve', commit: 'e2b43ad', view: desertAt([-203, 23.5, 303], [-208, 21.2, 308], { fov: 28, hour: 12.5, player: [-198, 22, 298] }) },
    ], numbers: [
      { title: 'Pebbles on open sand (dark spots in 10 000 pixels)', better: 'higher', device: 'Mac, the clock fixed, cloud shadows and wind off', source: 'the commit’s measurements (e2b43ad)', rows: [
        { where: 'noon, looking ahead', before: 30, after: 46 },
        { where: 'noon, looking down', before: 23, after: 35 },
        { where: '10 in the morning', before: 33, after: 35 },
        { where: 'for comparison: 8 in the morning', before: 44, after: 44 },
      ] },
    ] },
    { match: 'Lorn II’s bank bushes keep their leafy look', see: 'In Lorn II, look along the stream at the bushes on the far bank: their outline stays broken by leaves and their hatching stays strokes, instead of turning into smooth dark lumps.' },
    { match: 'The Garden of Spheres’ olive trees have rounder', shots: [
      { name: 'olive-crowns', caption: 'The References’ view of the olive grove round the plaza', commit: '2b81b29', view: { ref: '3793-olive-plaza' } },
    ] },
    { match: 'The Garden’s round plaza reads pale', shots: [
      { name: 'plaza-pale', caption: 'The References’ view of the round plaza between the fruit hedges', commit: 'afc17bc', view: { ref: '3795-plaza-hedges' } },
    ] },
    { match: 'The floor of the Buried Machine’s rust canyon', shots: [
      { name: 'canyon-floor', caption: 'Down the Buried Machine’s rust canyon toward the first cross-wall', commit: '37f6603', view: { level: 'buried', player: [cx(-170), -33.9, -170], eye: [cx(-170), -24, -170], target: [cx(-250), -34, -250], fov: 60 } },
    ], numbers: [
      { title: 'Sand over 10 cm deep on the canyon floor', unit: 'samples of 3 502', better: 'lower', source: 'the commit’s measurements (37f6603)', rows: [{ where: 'the rust canyon’s floor', before: 133, after: 40 }] },
    ] },
    { match: 'Climbing a wall where sand is banked', see: 'Walk up to a wall where the sand banks against its foot (Qanat’s, or the Buried Machine’s canyon) and climb: you take hold from the top of the bank, and climbing down you step off onto it.' },
    { match: 'Cabs are solid just as they are drawn', numbers: [
      { title: 'Where a cab’s solid and drawn shapes disagree', better: 'lower', device: AUDIT, source: 'the commit’s measurements (9098d88)', rows: [{ where: 'the City-Shaft’s cabs (share of samples, %)', before: 47, after: 2.9 }] },
    ], see: 'In the Signal Market, climb onto a parked cab: you stand on its nose, tail or striped canopy where they are drawn.' },
    { match: 'Climbing an olive tree in the Garden of Spheres', see: 'In the Garden of Spheres, climb an olive’s trunk: you stop under the crown, or climb round its leaves and stand on top.' },
  ],
  '0.76': [
    { match: 'The Steam Deck gets its own Graphics setting', numbers: [
      { title: 'What the Deck drew before, on High, against its own setting', device: 'Steam Deck OLED, SteamOS 3.8', source: 'docs/systems/performance.md, “The Steam Deck”', note: 'the frame rate on the new setting is still to be measured on the Deck', rows: [
        { where: 'pixels drawn (thousands)', before: 2304, after: 1024 },
        { where: 'props drawn out to (m)', before: 520, after: 380 },
        { where: 'the fine shadow map (px)', before: 2048, after: 1024 },
        { where: 'the desert’s spawn on High (fps)', before: '17–22', after: null },
      ] },
    ] },
    { match: 'On handhelds the City-Shaft runs smoother', numbers: [
      { title: 'Looking across the City-Shaft', better: 'higher', unit: 'fps', device: RETROID, source: 'docs/systems/performance.md, “The Retroid, second round”', rows: [
        { where: 'the wide view', before: '42–43', after: 45 },
        { where: 'the rim', before: '50–51', after: 52 },
      ] },
      { title: 'Draw calls', better: 'lower', device: RETROID, rows: [
        { where: 'the wide view', before: 1492, after: 1326 },
        { where: 'the rim', before: 1025, after: 960 },
      ] },
    ] },
    { match: 'On handhelds the picture no longer goes soft for nothing', numbers: [
      { title: 'The resolution the game keeps in Qanat, the camps and the City-Shaft', unit: '× the screen', better: 'higher', device: RETROID.replace(', render scale held at 0.75', ', automatic resolution'), source: 'docs/systems/performance.md, “The Retroid, second round”', rows: [
        { where: 'Qanat, the camps, the City-Shaft', before: '0.6–0.75', after: 0.75 },
      ] },
    ], see: 'On a handheld, stand in Qanat or the camps with the frame readout on (F): the picture stays sharp; it softens only where the graphics, not the processor, are behind.' },
    { match: 'The desert’s camps and other crowded places run a little smoother', numbers: [
      { title: 'The processor’s work a frame at the camps', unit: 'ms', better: 'lower', device: RETROID, source: 'docs/systems/performance.md, “The Retroid, second round”', rows: [{ where: 'the camps', before: 20.2, after: 19.6 }] },
    ] },
    { match: 'The loading screen’s turning pen', see: 'Open a world on a handheld and watch the pen on the loading screen: it should turn without stopping. (Measured on a busy Mac it stopped 100–240 ms at a time before; the Retroid’s own measurement is still to do.)' },
    { match: 'The Buried Machine’s great wheel is solid', numbers: [
      { title: 'Where the wheel’s solid and drawn shapes disagree', better: 'lower', device: AUDIT, source: 'the commit’s measurements (48b995e)', rows: [
        { where: 'feet sinking into it', before: 69, after: 37 },
        { where: 'climbing off it into nothing', before: 102, after: 11 },
        { where: 'standing on an unseen floor', before: 18, after: 0 },
      ] },
    ], see: 'In the Buried Machine, climb onto the great wheel in the dunes and wait for it to turn: it carries you round, and a spoke sweeps you aside.' },
    { match: 'In the Buried Machine’s rust canyon, the heavy rims', shots: [
      { name: 'cross-wall', caption: 'The first cross-wall’s oval opening in the rust canyon', commit: 'ce7febb', view: { level: 'buried', player: [cx(-232), -33.9, -232], eye: [cx(-232), -30.5, -232], target: [cx(-262), -29, -262], fov: 60 } },
    ] },
    { match: 'In Lorn II’s Deep Wood every root is solid', see: 'In Lorn II, walk into the gnarled roots along the banks or the thin ones round the great arches: you climb them and stand on them instead of walking through.' },
    { match: 'In the Garden of Spheres the olive trees’ trunks', numbers: [
      { title: 'Climbs that came off a tree into nothing', better: 'lower', device: AUDIT, source: 'the commit’s measurements (ba26446)', rows: [{ where: 'the Garden’s olives and cypresses', before: 234, after: 10 }] },
    ], see: 'Walk into a cypress in the Garden of Spheres: it stops you where it is drawn.' },
    { match: 'In Lorn’s Hush-House the gates of jaws', see: 'In Lorn’s Hush-House, walk up to a shut gate of jaws: it stops you at its two halves, and still won’t let you by until it is stilled.' },
    { match: 'You no longer sink into banked sand', numbers: [
      { title: 'Places where you walked through the drawn sand', better: 'lower', device: AUDIT, source: 'the commit’s measurements (ba26446)', rows: [
        { where: 'the desert', before: 46, after: 6 },
        { where: 'Vael', before: 80, after: 28 },
      ] },
    ], see: 'Walk along a drift of sand banked against a wall or a rock: your feet stay on the sand as it is drawn.' },
  ],
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
