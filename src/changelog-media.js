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
  ['mangrove', 'The White Mangrove', /White Mangrove/],
  ['saltharbour', 'The Salt Harbour', /Salt Harbour/],
  ['antennas', 'The Forest of Antennas', /Forest of Antennas/],
  ['moonfoundry', 'The Moon Foundry', /Moon Foundry/],
  ['references', 'References', /References level/],
  ['fallenring', 'The Fallen Ring', /Fallen Ring/],
  ['spacecity', 'The City Floating in Space', /City Floating in Space/],
  ['overnighttrain', 'The Overnight Train', /Overnight Train/],
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
    }).reverse(),   // (newest first, as the game shows them: src/changelog.js newestFirst)
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

// (the story's second pass, v0.83: a save six worlds along the route, everything charted and heard so far)
const ROUTE = ['desert', 'arzach', 'arzach2', 'perdide', 'perdide2', 'edena', 'incal', 'garage', 'buried', 'spheres', 'bazaar'];
const saveAlong = (n, flags = {}) => ({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, 'ship.powered': true, 'charge.given': true, 'charge.card': true,
  ...Object.fromEntries(ROUTE.slice(0, n).map((w) => [`world.${w}.done`, true])), ...Object.fromEntries(Array.from({ length: n }, (_, i) => [`calls.${i + 1}`, true])),
  ...(n >= 6 ? { 'calls.home': true } : {}), ...flags }, keepsakes: [] });
const GIFTS = ['stun', 'fire', 'cell', 'coil', 'lantern', 'lens', 'bell', 'shell', 'echo', 'star'];

export const CHANGELOG_MEDIA = {
  '0.93': [
    { match: 'The shade has a new look: a cartoon drawn in negative', shots: [
      { name: 'shade-desert', caption: 'A shade standing in the Arena at 10:00: the violet body with its head and eyes before; after, the black figure in its white outline, its head a black flame of three tips', from: 'headless Chrome against this branch’s own dev server and the commit before the new look, High, 1280 × 720, the camera 3.4 m from it (8 October)' },
      { name: 'shade-night', caption: 'The same in the Signal Market at 22:00: before, it was lost against the dark street; after, the white outline holds it', from: 'headless Chrome against this branch’s own dev server and the commit before the new look, High, 1280 × 720 (8 October)' },
      { name: 'shade-moves', only: 'after', caption: 'Its flame in the Arena: at rest, running (streaming back), winding up (flared), the cut (whipping), stunned (guttered) and dying (torn into licks as the body pours away)', from: 'headless Chrome against this branch’s own dev server, High, the shade posed by a script (8 October)' },
      { name: 'shade-moves-night', only: 'after', caption: 'The same moments in the night market (a passer-by walks in front of the last)', from: 'headless Chrome against this branch’s own dev server, High, the shade posed by a script (8 October)' },
      { name: 'shade-strike', only: 'after', caption: 'In real play, from the side: its arm raised as it winds up, the cut, the follow-through', from: 'headless Chrome against this branch’s own dev server, High, the shade’s own mind against the traveller (8 October)' },
    ], see: 'Open the Arena (?level=arena) and wait for wave six, or meet a lone shade in a later pack in the wilds: watch its flame as it runs at you, winds up and swings; stun it or cut it down.' },
    { match: 'Hitboxes, to study a fight', shots: [
      { name: 'hitboxes-swing', only: 'after', caption: 'The heavy third cut on its live frames: the blade’s edge and sweep in red, its cone, the blot’s body and its blade ring', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Arena, frozen on the frame the blade cuts' },
      { name: 'hitboxes-strike', only: 'after', caption: 'A machine’s slam landing: its cone filled red, the traveller’s feet inside it', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Arena, frozen as the strike goes live' },
      { name: 'hitboxes-parry', only: 'after', caption: 'A fresh guard in its parry window (white), the machine’s wind-up in orange', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Arena' },
    ], see: 'In the Arena (?level=arena) walk to the board left of the way in and press X / □ (E), or press F4 anywhere; fight a wave and watch the colours change as the cuts and strikes go live.' },
    { match: 'The Arcade (Debug worlds, next to the Gadget Yard)', shots: [
      { name: 'arcade-plaza', only: 'after', caption: 'The Arcade from above the way in: a sign for every game round the basin, the games board by the entrance', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), driven by a script' },
      { name: 'arcade-sign', only: 'after', caption: 'At a sign: its name and best on the plate, "play" on the interact button', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), driven by a script' },
      { name: 'arcade-board', only: 'after', caption: 'The games board: every game, its line and its best, to jump straight into one', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), driven by a script' },
      { name: 'arcade-pause', only: 'after', caption: 'A game from the Arcade, paused: Previous game, Next game, Back to the Arcade', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), driven by a script' },
    ], see: 'Open ?level=arcade (or the Debug worlds list). Walk to a sign and press the interact button, or press Tab (D-pad ↓) for the games board; in a game press Menu / Esc, then Next game, or LB / RB ([ ]) on any of its cards.' },
    { match: 'The shield is a device now', shots: [
      { name: 'shield-guard', caption: 'The guard held: before, a spoked disc of opaque fluid hiding the traveller; after, a smaller see-through shield of inked fluid round a collar of brass petals, close to the forearm', from: 'the character studio (studio.html?backpack=true&sword=true&shield=1&anim=clip:mixamo_ss_block_idle&paused=true&view=arms&yaw=0.7&pitch=0.12&bg=flat), headless Chrome against this branch’s own dev server, 900 × 700 (8 October)' },
      { name: 'shield-bracer', only: 'after', caption: 'Folded: the brass disc on the back of the left hand, its ribs closed like an iris round a bead of the fluid', from: 'the character studio (view=bracer&yaw=1.2&pitch=0.2), headless Chrome, 900 × 700 (8 October)' },
    ], see: 'In the Arena (?level=arena) hold LB / L1 (Z or Ctrl) and let go; take a blow with it raised, and raise it just as a blot strikes for the parry. Or open studio.html?backpack=true&shield=1&view=arms and slide “Shield open”.' },
    { match: 'The sword sits in your fist', shots: [
      { name: 'blade-grip', caption: 'The first cut at the moment it lands: before, the grip floated past the knuckles; after, it is closed in the fist, the guard over the thumb, the pommel below', from: 'the character studio (studio.html?backpack=true&sword=true&anim=clip:mixamo_ss_slash_1&paused=true&view=arms&yaw=0.7&pitch=0.12&bg=flat, scrubbed to the hit), headless Chrome against this branch’s own dev server, 900 × 700 (8 October)' },
    ], see: 'Swing in the Arena (RB / R1) and watch the right hand; or open studio.html?backpack=true&sword=true&view=hands with any clip scrubbed (the Blade and shield view shows both hands).' },
    { match: 'Each world now has foes of its own', see: 'Walk out into the wilds of the Salt Harbour, the Moon Foundry or the City During the Eclipse (away from people and the ship) and wait for a pack: crabs, slag walkers, shadow hounds. A relic there is guarded by them too.' },
    { match: 'Dune rays swim under the Desert', shots: [
      { name: 'foes-ray', only: 'after', caption: 'The Desert: a dune ray’s ring closing round the traveller’s feet, sand spraying where it will burst up', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), a ray called in with foes.spawnKind' },
      { name: 'foes-golem', only: 'after', caption: 'The Glass Dunes: a glass golem with both arms up for its slam', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
      { name: 'foes-crab', only: 'after', caption: 'The Salt Harbour: a salt crab tucked into its shell, its spinning charge drawn along the ground', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
    ] },
    { match: 'Sign moths of neon tube', shots: [
      { name: 'foes-moth', only: 'after', caption: 'The Signal Market: sign moths flaring, the flash’s cone drawn at the traveller', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
      { name: 'foes-drone', only: 'after', caption: 'The Sealed Hangar: a rust drone aiming its harpoon down the drawn lane', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
      { name: 'foes-stalker', only: 'after', caption: 'The White Mangrove: a root stalker winding up its grab, its roots’ path drawn on the planks', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
    ] },
    { match: 'Slag walkers in the Moon Foundry', shots: [
      { name: 'foes-slag', only: 'after', caption: 'The Moon Foundry: a slag walker’s leg raised for its stomp, the ring it will leave burning drawn round it', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
      { name: 'foes-hound', only: 'after', caption: 'The City During the Eclipse: two shadow hounds, and the pool behind the traveller where one will step out', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
    ] },
    { match: 'The old foes have new attacks', shots: [
      { name: 'foes-quake', only: 'after', caption: 'The Arena: a machine with both arms high for its ground slam', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
      { name: 'foes-volley', only: 'after', caption: 'The Arena: a spitter’s volley of three globs in the air, their three rings across the traveller’s way', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
    ] },
    { match: 'In the Arena a FOES tab on the left', see: 'Open ?level=arena, click FOES on the left edge and choose a kind; press F4 for the hitboxes and let a machine slam to see its shockwave run out.' },
    { match: 'Controls: the controller now follows the big action games', see: 'With a controller: walk up to someone and press X / □ to talk, B / ○ to dodge a blow, D-pad ↓ to call your mount, and click the right stick (R3) away from any foe to send the scout. Menu, then Controls, lists the whole layout.' },
    { match: 'The bell-note whistle and the echo shell have a controller button again', shots: [
      { name: 'controls-whistle', only: 'after', caption: 'No gadget in hand: the card in the corner holds the whistle (and the shell), on Y / △', from: 'headless Chrome with a virtual Xbox pad against this branch’s own dev server, Low, 1280 × 720 (8 October), the Gadget Yard with every item' },
    ], see: 'Own the whistle and a gadget, put the gadget away (the wheel’s top slot, D-pad ↑ held), and press Y / △: the boxes nearby chime.' },
    { match: 'Photo mode moved off the D-pad', see: 'Hold View and press D-pad ↑ for photo mode (View again, B / ○ or Menu leaves); on any screen, Menu (or the gear), then Photo mode.' },
    { match: 'Keyboard and mouse: a left click swings the fluid blade', see: 'Click into the game to capture the mouse and left-click: the blade swings. Hold the right button and left-click: it shoots.' },
    { match: 'The Controls page shows the new layout', shots: [
      { name: 'controls-page', only: 'after', caption: 'The Controls page with a pad in hand: X / □ uses and talks, B / ○ evades, R3 finds the objective with no foe near', from: 'headless Chrome with a virtual Xbox pad against this branch’s own dev server, Low, 1280 × 720 (8 October), the Start menu over the Gadget Yard' },
    ] },
  ],
  '0.92': [
    { match: 'Games: the worlds list (Debug) has a row of small games', shots: [
      { name: 'games-row', only: 'after', caption: 'The worlds list: the ten games under the pages, each one’s best under its name', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), a save with eight bests' },
      { name: 'ski-card', only: 'after', caption: 'A game’s start card: its rules, its controls (here a pad’s), the best so far', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
      { name: 'steps-results', only: 'after', caption: 'The results: the score, how it was made, a new best stamped', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
    ], see: 'Open the worlds list (Debug on the title, or L in play) and pick a game in the Games row, or open ?game=ski or ?game=platformer.' },
    { match: 'Dune skiing: the traveller on sand-skis', shots: [
      { name: 'ski-carve', only: 'after', caption: 'Carving through a gate, its pennants turned teal as you pass', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
      { name: 'ski-air', only: 'after', caption: 'Off a lip at 120 km/h, the ink streaks of the speed at the edges', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
      { name: 'ski-results', only: 'after', caption: 'The time, the gates, the top speed and the longest jump', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
    ], see: '?game=ski: hold the tuck on the straights, let it go to turn; press A / × at a lip for the biggest air.' },
    { match: 'Sky steps: a side-on run across stones', shots: [
      { name: 'steps-card', only: 'after', caption: 'The start card, with a pad', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
      { name: 'steps-spring', only: 'after', caption: 'Thrown up by a spring, the jump held', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
      { name: 'steps-run', only: 'after', caption: 'On a drifting stone of the makers', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
      { name: 'steps-crumble', only: 'after', caption: 'Over the cracked stones: they shake and fall a moment after you land', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
    ], see: '?game=platformer: run off an edge and press jump a moment late, or press it just before you land: both still jump.' },
    { match: 'Canyon run: the hoverbike round the Rose Canyon', shots: [
      { name: 'canyon-arch', only: 'after', caption: 'Under a stone arch, through a checkpoint’s pennants, the jets’ trails behind', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), driven by the game’s own rider (window.__canyonBot)' },
      { name: 'canyon-kicker', only: 'after', caption: 'Off the first kicker at 180 km/h: the bike over the middle of the chasm, its floor far below (seen from the canyon’s side)', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), driven by the game’s own rider, paused over the gap and drawn from beside it (the game’s captureView)' },
      { name: 'canyon-drift', only: 'after', caption: 'A sand drift across most of the floor, its fence along the crest: round it on the open side, or hop it', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), driven by the game’s own rider' },
      { name: 'canyon-results', only: 'after', caption: 'Three laps, the fastest, the top speed and a clean run', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), driven by the game’s own rider' },
    ], see: '?game=canyon, or the sign under the lavender cliffs by the desert’s rope bridge. Each checkpoint flashes your split against your best run once you have one.' },
    { match: 'Fishing: three quiet minutes at the end of a pier', shots: [
      { name: 'fishing-cast', only: 'after', caption: 'The cast held: the rod over the shoulder, the meter at 15 m, fish shadows on the water', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script (keys)' },
      { name: 'fishing-red', only: 'after', caption: 'A sky-eye ray running left with the reel held: the line glows red, ease off, pull against it', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script (keys)' },
      { name: 'fishing-catch', only: 'after', caption: 'Landed and held up on the line: new in the journal', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script (keys)' },
    ], see: '?game=fishing, or the sign on the shore of the desert’s mineral basin. Cast near a shadow for a quicker bite; the deep middle holds the heavy kinds.' },
    { match: 'Ring race: the jets, tuned for racing', shots: [
      { name: 'rings-card', only: 'after', caption: 'The start card on the mesa, the first ring glowing among the needles', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
      { name: 'rings-climb', only: 'after', caption: 'Climbing out of the needles to ring 7, the gold arrow at the top of the view on it', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
      { name: 'rings-ghost', only: 'after', caption: 'The best run’s teal ghost through ring 6 ahead of you, and the split: 1.5 s behind it', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
      { name: 'rings-results', only: 'after', caption: 'Twenty rings, no crashes, a new best', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
    ], see: '?game=rings: hold RT / R2, keep the arrow ahead of you, and let go of the trigger on the dives to save the tank.' },
    { match: 'Wing drop: three drops from high', shots: [
      { name: 'wingdrop-thermals', only: 'after', caption: 'The first drop: the thermals’ ink swirls round the way down, the Painted Mesa ahead', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
      { name: 'wingdrop-approach', only: 'after', caption: 'Gliding in at 100 m, the bullseye ahead, a star gate low on the left', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
      { name: 'wingdrop-landed', only: 'after', caption: 'Down in the bull: the drop’s aim, style and stars', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
      { name: 'wingdrop-results', only: 'after', caption: 'Three drops and their scores', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
    ], see: '?game=wingdrop: circle in a thermal to climb to the high star, and hold the stick back for the last metre or two above the target.' },
    { match: 'Both new games have an arcade sign in the desert', shots: [
      { name: 'desert-signs', only: 'after', caption: 'The ring race’s sign on the east shelf by the hanging bridge (the wing drop’s is on the far shelf)', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
    ], see: 'In the desert, ride out to the hanging bridge between the two lilac rock shelves, far out from the start (?level=desert, about x −430, z −470), and climb onto either shelf.' },
    { match: 'The shooting gallery, a fairground stall', shots: [
      { name: 'gallery-play', only: 'after', caption: 'The last fifteen seconds: golds on the rails, the stallkeeper calling, the booth splashed', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
      { name: 'gallery-results', only: 'after', caption: 'A minute’s score: hits, misses, the best run, golds, bells and plates', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
      { name: 'gallery-sign', only: 'after', caption: 'The gallery’s sign on the Signal Market’s pavement, a few steps from where you arrive', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
    ], see: '?game=gallery, or walk left from where you arrive in the Signal Market to the glowing sign. Hold LT / L2 the whole round and tap RT / R2.' },
    { match: 'Ink tide: a basin of sand in a sea of ink', shots: [
      { name: 'tide-boons', only: 'after', caption: 'A breather: three boons rise on the sigil; walk onto one', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
      { name: 'tide-wave', only: 'after', caption: 'Wave seven closing in on the sigil: a shade, a machine, a winged blot and a swarm, the sea of ink all round', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
    ], see: '?game=waves, or the sign by the way into the Arena (Debug worlds list). Guard just as a blow lands to parry: it counts for style.' },
    { match: 'Drum circle: a night round a fire in the dunes', shots: [
      { name: 'drums-card', only: 'after', caption: 'The start card: the four glyphs, the difficulty and the Timing setting', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
      { name: 'drums-play', only: 'after', caption: '77 in a row on Normal: the fire up, the dancers’ arms in the air, glyphs rolling in to the ring', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
      { name: 'drums-results', only: 'after', caption: 'The results: the rank, the perfects, the longest combo and whether your timing sits on the beat', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), played by a script' },
    ], see: '?game=drums (or the sign by the small fire south of the big one in the Desert’s pilgrim camp): try Easy first; if your hits feel late, the results suggest a Timing.' },
    { match: 'Sketch hunt: three minutes in the Signal Market', shots: [
      { name: 'hunt-list', only: 'after', caption: 'The list of six, drawn fresh each time, and three minutes on the clock', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
      { name: 'hunt-view', only: 'after', caption: 'Through the sketchbook: a ticket finch in the frame, and how good a sketch it would make', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
      { name: 'hunt-results', only: 'after', caption: 'The results: the page of sketches, one not found', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), played by a script' },
    ], see: '?game=sketchhunt (or the sign on the left pavement near the market’s gate): hold LT / L2 (right mouse, R), fill the frame with the subject and keep it in the middle.' },
    { match: 'Arcade signs in the worlds', see: 'In the Desert, walk to the pilgrim camp’s small fire south of the big one; in the Signal Market, look left from the gate. Press B / ○ (E) by the sign.' },
    { match: 'Games, a polish pass', shots: [
      { name: 'touch-ski', only: 'after', caption: 'Dune skiing on a phone held sideways: only the stick, the jump (pop) and run (the tuck)', from: 'headless Chrome against this branch’s own dev server, High, 844 × 390, Handheld, touch emulated (8 October), played by a script' },
    ], see: 'Finish a game with no score: no stamp; beat your best: “New best!”. The worlds list (Debug) shows the bests in the Games row.' },
    { match: 'Ring race: hold Shift or RB / R1', see: '?game=rings: hold RT / R2 (Space) and add RB / R1 (Shift): about 31 m/s becomes 40, the tank lasting about 5 s instead of 11.' },
    { match: 'Wing drop: after each landing', shots: [
      { name: 'wingdrop-landing', caption: 'The last drop landed: before, the camera low over the mesa behind the card; after, up behind you, the bullseye beyond, you left of the card', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), landings set by a script' },
      { name: 'wingdrop-star', only: 'after', caption: 'A scripted pilot (wingdrop.js starPilot) through the high star of the first thermal, flying the virtual pad', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
    ], see: '?game=wingdrop: circle up in the first thermal past its star, swing out and fly back through it along the way to the mesa.' },
    { match: 'Ink tide’s longer blade is drawn longer', shots: [
      { name: 'gallery-bells', caption: 'The shooting gallery, aiming: the bells up by the valance before, down over the rails after', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
    ], see: '?game=waves: take the Longer blade boon after the first wave and watch the blade; ?game=sketchhunt: raise the sketchbook at someone with a passer-by in between.' },
    { match: 'Arcade signs for the last two games', shots: [
      { name: 'sign-ski', only: 'after', caption: 'Dune skiing’s sign on the golden dune’s crest, the Desert’s skeletons and mesas beyond', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
      { name: 'sign-steps', only: 'after', caption: 'Sky steps’ sign on the start plateau’s west rim, a mushroom table and the monastery cliff beyond', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
    ], numbers: [{ title: 'Ring race: a scripted pilot’s time round the course (the boost ×1.22 for ×2 the burn before, ×1.28 for ×2.1 after)', unit: 's', better: 'lower', device: 'any (Node, 60 fps)', rows: [
      { where: 'no boost', before: 53.9, after: 53.9 },
      { where: 'boost on the straights, a quarter of the tank kept (never dry)', before: 50.7, after: 50.0 },
      { where: 'boost every straight to the last drop (dry 5 s before, 4.5 after)', before: 52.5, after: 51.5 },
    ], source: 'tests/rings.test.js (flyCourse with a boost policy)' }],
      see: 'In the Desert, climb the tall dune north-west of the start (?level=desert, about x −108, z 124); in the Sky Stones (?level=arzach2), walk to the start plateau’s west rim.' },
  ],
  '0.91': [
    { match: 'Gadgets: things to carry besides the backpack', shots: [
      { name: 'wheel', only: 'after', caption: 'D-pad up (B) held: the wheel, nothing in hand, the grappling hook, the ink bombs; the stick points at one', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
    ], see: 'Open the Gadget Yard from the Debug worlds list (?level=gadgetyard): both gadgets are yours. Y / △ (T) uses the one in hand, D-pad up (B) changes it, held it opens the wheel.' },
    { match: 'The grappling hook: hold Y / △ to aim', shots: [
      { name: 'hook-aim', only: 'after', caption: 'Aiming at the ring on the pole in the hook’s bay: the reticle turns into a red diamond on a ring, 15 m away', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'hook-reel', only: 'after', caption: 'Reeled up the pole on the line, a moment before hauling over the top', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'hook-crate', only: 'after', caption: 'A crate caught and dragged in across the yard', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'hook-market', only: 'after', caption: 'In the Signal Market: hooked to a tower’s wall 20 m away from the street, reeled up and holding on', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), ?level=bazaar' },
    ], see: 'In the Gadget Yard, the bay with the red banner: hold T (Y / △), point at a ring and let go.' },
    { match: 'Ink bombs: hold Y / △ and a dotted arc', shots: [
      { name: 'bomb-arc', only: 'after', caption: 'Aiming a bomb at the cracked wall in the middle of the yard: the dotted arc and the red ring of its blast', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'bomb-blast', only: 'after', caption: 'The blast: the cloud, the speed strokes and the wall coming apart', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'bomb-wall', only: 'after', caption: 'A moment later: the wall gone, a star of ink on the sand (in the yard it grows back after a while)', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
    ], see: 'In the Gadget Yard, the bay with the dark blue banner: throw one at the cracked wall in front of the alcove, or into the pen of ink blots.' },
    { match: 'The recall hourglass: point it at something', shots: [
      { name: 'recall-trail', only: 'after', caption: 'A crate knocked off the high ledge in the hourglass’s bay: its fall drawn as a dotted line back up to the ledge, its outline along it, 1.9 s to send back', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'recall-ride', only: 'after', caption: 'Standing on it as it goes back up its own path (the gold ring turns round it), a moment before it lands on the ledge again with the traveller aboard', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
    ], see: 'In the Gadget Yard, the bay with the teal banner: pull the crate off the high ledge with the hook (or blow it off with a bomb), stand on it, point the hourglass at it and press T (Y / △).' },
    { match: 'The ink bridge pen: hold Y / △', shots: [
      { name: 'bridge-draw', only: 'after', caption: 'Drawing: the dotted line runs out from the traveller’s feet to the far tower, the pen at its tip, 8.6 m', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'bridge-walk', only: 'after', caption: 'Set: walking across the hand-inked plank between the towers of the pen’s bay', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'bridge-wall', only: 'after', caption: 'Aimed up steeply: a short wall of ink, hatched in long diagonals and cross-hatched at its foot', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'bridge-shaft', only: 'after', caption: 'In the City-Shaft: a plank drawn out from the upper terraces, 150 m over the town below', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), ?level=incal' },
    ], see: 'In the Gadget Yard, the bay with the night-blue banner: climb the steps, hold T (Y / △) aimed at the far tower’s top, let go and walk across.' },
    { match: 'The seeing lens: hold Y / △', shots: [
      { name: 'lens-false', only: 'after', caption: 'Without the lens: a plank bridge between the two towers in the lens’s bay. Step on it and you fall: it is not there', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'lens-yard', only: 'after', caption: 'Through the lens: the false bridge is gone, the true path of glass shows behind it, and writing on the far tower is marked', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'lens-path', only: 'after', caption: 'Crossing the path of glass with the lens up (it holds you only while you look)', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
    ], see: 'In the Gadget Yard, the bay with the blue-green banner: walk up the steps of the near tower and hold T (Y / △) before you cross.' },
    { match: 'Secrets for the glass in two worlds', shots: [
      { name: 'lens-qanat', only: 'after', caption: 'Inside Qanat’s main gate, words on the pylon for the glass only', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Desert, Qanat (hour 10.5)' },
      { name: 'lens-stair', only: 'after', caption: 'The stair of glass climbing over the avenue onto the gate’s lintel', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Desert, Qanat (hour 10.5)' },
      { name: 'lens-canyon', only: 'after', caption: 'The Buried Machine: walking the bridge of glass across the canyon, 38 m over its floor', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), ?level=buried' },
    ], see: 'Walk into Qanat through its main gate and turn round with the lens up; in the Buried Machine, follow the canyon’s rim to the two stone abutments between the cross-walls.' },
    { match: 'Spring boots: hold Y / △ to crouch', shots: [
      { name: 'springs-wind', only: 'after', caption: 'Wound fully: the ring of dashes round the feet turns gold', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'springs-bounce', only: 'after', caption: 'A bounce on: the coils thrown out under the boots', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'springs-stomp', only: 'after', caption: 'A stomp from fourteen metres: the ring of dust, the shock running out in ink, a star of ink stamped on the sand', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'springs-floor', only: 'after', caption: 'About to stomp through the cracked roof of the little room in the springs’ bay', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
    ], see: 'In the Gadget Yard, the bay with the orange banner: wind them fully under the 4 m block, then climb to the 12 m one and bounce three times to the 20 m tower; stomp through the cracked roof to the lamp inside.' },
    { match: 'The Gadget Yard, a new world', shots: [
      { name: 'yard', only: 'after', caption: 'The Gadget Yard from where you arrive: the hook’s bay and its pole, the plate and its gate, the targets, the bombs’ bay beyond', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
    ] },
    { match: 'The bubble wand: hold Y / △ to aim', shots: [
      { name: 'bubble-crate', only: 'after', caption: 'A crate caught in a bubble, floating up beside the ledge in the bubble wand’s bay', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'bubble-float', only: 'after', caption: 'Floating in your own bubble up to the lamp on the pole, the stick drifting you across', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'bubble-ledge', only: 'after', caption: 'The lift puzzle done: the crate dropped onto the plate up on the ledge, the alcove’s gate sunk and its lamp in view', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
    ], see: 'In the Gadget Yard, the bay with the lavender banner: hold T (Y / △), aim at a crate and let go; look down at your feet (or jump) and press it to float yourself.' },
    { match: 'The gust fan: press Y / △ to swing it', shots: [
      { name: 'fan-gust', only: 'after', caption: 'A gust from the side: ink speed lines, curls and the wind’s fronts racing out over the sand, dust thrown up', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'fan-fire', only: 'after', caption: 'The fire in the hut’s doorway blown out in a puff of smoke', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'fan-hover', only: 'after', caption: 'Wings open, the fan swung at the ground: lifted up onto the ledge (the pips: gusts left before landing)', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'fan-skiff', only: 'after', caption: 'In Perdide: on the skiff, a swing of the fan fills its own sail; over the water the gust throws up spray', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), ?level=perdide' },
    ], see: 'In the Gadget Yard, the bay with the teal banner: press T (Y / △) at the crates, the pinwheels, the fire; jump, open the wings and swing it at the ground.' },
    { match: 'In the Gadget Yard the bubble wand’s bay', shots: [
      { name: 'fan-pinwheels', only: 'after', caption: 'The three pinwheels turning together, their lamps lit, and the gate they hold sunk', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
    ] },
    { match: 'The gadgets are in the game menu’s Items', see: 'Open the game menu (View / Select, J) on its Items: the hook and the bombs are drawn among the gear; choose one to take it in hand.' },
    { match: 'The boomerang: hold Y / △ and a dotted line', shots: [
      { name: 'boomerang-aim', only: 'after', caption: 'Aiming in its bay: locked on to two ropes and a pot of ink up on a block, the dotted path through them and home', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), the Gadget Yard' },
      { name: 'boomerang-fetch', only: 'after', caption: 'A moment later: both ropes cut and their crates on the sand, the boomerang over the block with the pot, its ink trail behind it', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), the Gadget Yard' },
      { name: 'boomerang-market', only: 'after', caption: 'In the Signal Market with an ember on the backpack: thrown at two hanging lamps, the first already alight', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), ?level=bazaar' },
    ], see: 'In the Gadget Yard, the bay with the brass banner: hold T (Y / △), sweep the reticle over the three targets and let go. Switch the backpack to ember (X / D-pad →) and throw it at the lanterns.' },
    { match: 'The magnet glove: hold Y / △ near metal', shots: [
      { name: 'magnet-hold', only: 'after', caption: 'The metal crate lifted off its tower, the field’s wavy strokes between the glove and the crate', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), the Gadget Yard' },
      { name: 'magnet-gap', only: 'after', caption: 'Pulled across 11 m of air to the iron block on its pillar, taking hold of it before hauling over the top', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), the Gadget Yard' },
      { name: 'magnet-machine', only: 'after', caption: 'In the Sealed Hangar: a makers’ machine lifted off its feet', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), ?level=garage' },
      { name: 'magnet-hangar', only: 'after', caption: 'Pulled up to the signal board’s iron face by the path from the start, holding on', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), ?level=garage' },
    ], see: 'In the Gadget Yard, the bay with the grey banner: hold T (Y / △) on the metal crate up on the tower; W and S bring it nearer and further. From the ledge up the steps, tap it at the iron block across the gap.' },
    { match: 'The Gadget Yard has two more bays', see: 'In the magnet’s bay, lift the crate off the tower, over the wall of the pit beside it and onto the plate inside: the gate of the alcove sinks, and a pot of ink waits there.' },
    { match: 'The ten gadgets play well together', shots: [
      { name: 'wheel-ten', only: 'after', caption: 'All ten in the wheel, each with its own picture, round a wider ring; holding B no longer raises the fluid shield behind it', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
    ], see: 'In the Gadget Yard hold an aiming gadget (the hook, the magnet, the lens), then tap B, or start a conversation: nothing of it is left on the screen. Wear the spring boots and open photo mode: you stay on the ground.' },
    { match: 'Gadget fixes: lower the seeing lens', shots: [
      { name: 'lens-fade', only: 'after', caption: 'The lens lowered halfway across the Buried Machine’s bridge of glass: it holds a moment longer, flickering, before it goes', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), ?level=buried' },
      { name: 'magnet-field', only: 'after', caption: 'The magnet holding a metal crate: its field in fine dashed pen lines bowing round the line, thinner toward the glove', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), the Gadget Yard' },
    ], see: 'In the Buried Machine raise the lens on the bridge of glass, walk out and lower it: you have a moment and a half to raise it again. In the Gadget Yard draw a plank, stand on it and draw on along it: it runs past its end.' },
  ],
  '0.89': [
    { match: 'The Glass Dunes’ glass glows from within', shots: [
      { name: 'glass-giants', caption: 'The cliff of the giants from the valley at 16:30: the giants held in the glass are crisp dark shapes, the lobes’ thin edges glow mint', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October); the before at the commit before the change' },
      { name: 'glass-breaker', caption: 'The breaking wave from the valley at 16:30, looking toward the sun: its lip and crest let the light through in lime, the tree inside cut clean', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October); the before at the commit before the change' },
      { name: 'glass-plate3', caption: 'The References’ view of the third picture: the giants in the cliffs, before soft smudges, now printed shapes', from: 'the References level, ?level=references&world=glassdunes&view=3, headless Chrome, High, 1456 × 816 (7 October)' },
    ], see: 'Open the Glass Dunes (?level=glassdunes) in the late afternoon and look at the walls toward the sun: their thin edges and the lips of the waves glow; the giants stand dark inside the cliffs west of the valley.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), a tight loop of renderFrame() synced by a one-pixel read, 3 × 20 frames a sample, median of 5 rounds, 16:30, the crowd off (the machine shared with other agents: compare within the run)', unit: 'ms', better: 'lower', device: 'Mac, headless Chrome on Metal, 1280 × 720', source: 'docs/systems/worlds.md, “The Glass Dunes”', rows: [
          { where: 'by the ship', before: 1.52, after: 1.55 },
          { where: 'the valley', before: 1.51, after: 1.52 },
          { where: 'the west camp', before: 1.43, after: 1.48 },
          { where: 'the breaking wave', before: 1.36, after: 1.41 },
          { where: 'the cliff of the giants', before: 1.33, after: 1.40 },
          { where: 'the Signal Market (the budget, docs/systems/worlds.md)', before: '2.23–2.28', after: null },
        ] },
      ] },
    { match: 'In the Glass Dunes the light that comes through the glass', shots: [
      { name: 'pools-spawn', caption: 'From the ship at 17:36, the sun going: the walls’ shade on the sand an emerald, not a grey teal', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October); the before at the commit before the change' },
      { name: 'pools-westcamp', caption: 'The west camp at 17:36: the light through the cliff pooled mint and lime at its foot', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October); the before at the commit before the change' },
    ], see: 'In the Glass Dunes, late in the afternoon, walk to the foot of a wall on its side away from the sun: the sand there takes the glass’s mint and lime.' },
    { match: 'Two archways in the Glass Dunes go through now', shots: [
      { name: 'passage-giants', caption: 'The archway at the foot of the cliff of the giants: before a lit panel, now a vault of glass you walk through', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October); the before at the commit before the change' },
      { name: 'passage-wave', caption: 'The frozen wave in the valley’s middle: its archway goes through to the north', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October); the before at the commit before the change' },
      { name: 'passage-inside', only: 'after', caption: 'Inside the cliff of the giants’ passage, 70 m of green vault, the sand beyond at its end', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720, 16:30 (7 October)' },
    ], see: 'From the ship walk north up the valley: the frozen wave’s archway is straight ahead; the giants’ is in the west cliff, north of the west camp.',
      numbers: [
        { title: 'The contact audit (what you stand on and walk into is what is drawn)', unit: 'problems', better: 'lower', device: 'node, tests/glass-dunes.test.js', source: 'docs/systems/worlds.md, “The Glass Dunes”', rows: [
          { where: 'climbs inside (the arches’ drawn-only rims)', before: 5, after: 1 },
          { where: 'walks through', before: 1, after: 2 },
        ] },
      ] },
    { match: 'In the References level the Glass Dunes’ fourth picture', shots: [
      { name: 'wave-plate4', caption: 'The fourth picture’s view: the wave rises steep over the camp, curls over its hollow and sweeps down to the sand', from: 'the References level, ?level=references&world=glassdunes&view=4, headless Chrome, High, 1456 × 816 (7 October)' },
    ], see: 'Open ?level=references&world=glassdunes&view=4; the backslash key lays the picture over the view.' },
    { match: 'A world picked from the Debug worlds list now opens in a separate debug save', shots: [
      { name: 'debug-save-list', only: 'after', caption: 'The worlds list (Debug on the title): a line says what picking a world does, and each card which save it opens in', from: 'headless Chrome against this branch’s own dev server, 1280 × 720 (7 October)' },
      { name: 'debug-save-items', only: 'after', caption: 'The Buried Machine picked from the list: the gear of the eight worlds before it (the wings, the jets, the cab pass…) and their keepsakes', from: 'headless Chrome against this branch’s own dev server, the game menu’s Items page, 1280 × 720 (7 October)' },
    ], see: 'On the title, choose Debug and pick a late world (the Buried Machine): open the game menu (View / Select, or J). Its Quests page lists the earlier worlds’ quests as done, the Items page holds their gear and keepsakes, the Worlds page shows their boxes opened; the Start menu reads “Debug save”. Choose a save on the title to go back to your own.' },
    { match: 'The jets fly like a plane', shots: [
      { name: 'jets-climb', only: 'after', caption: 'A second and a bit of RT / R2 from the sand in the desert: straight up, the camera looking up after you', from: 'headless Chrome against this branch’s own dev server, a simulated pad driving the jets, High, 1280 × 720, 10:00 (7 October)' },
    ], numbers: [
      { title: 'The jets from standing, RT / R2 held all the way, the stick at rest (the flight model run headless, 60 steps a second, on flat ground)', unit: 'm', better: 'higher', device: 'node, src/player.js (the old model at the commit before)', source: 'docs/systems/movement-and-camera.md, “The jets fly like a plane”', rows: [
        { where: 'height after 3 s', before: 2.4, after: 58.6 },
      ] },
      { title: 'Seconds to 30 m up from standing (before: RT with A / × held, its straight climb; now: RT alone)', unit: 's', better: 'lower', device: 'node, src/player.js', source: 'docs/systems/movement-and-camera.md', rows: [
        { where: 'to 30 m up', before: 3.1, after: 1.7 },
      ] },
    ], see: 'With the jets found, stand anywhere in the open and hold RT / R2 (the left mouse button): you go straight up, fast; a light squeeze rises slowly.' },
    { match: 'On the jets the left stick flies the nose', shots: [
      { name: 'jets-bank', only: 'after', caption: 'Banked into a right turn over the desert, flat out, the camera swinging round behind', from: 'headless Chrome against this branch’s own dev server, a simulated pad driving the jets, High, 1280 × 720, 10:00 (7 October)' },
      { name: 'jets-dive', only: 'after', caption: 'Stick forward: a dive straight down, head first, the camera looking down it', from: 'headless Chrome against this branch’s own dev server, a simulated pad driving the jets, High, 1280 × 720, 10:00 (7 October)' },
    ], numbers: [
      { title: 'Top speeds on the jets (the flight model run headless, on flat ground)', unit: 'm/s', better: 'higher', device: 'node, src/player.js', source: 'docs/systems/movement-and-camera.md', rows: [
        { where: 'level, full throttle', before: 8, after: 22 },
        { where: 'level, L3 / Shift', before: 14, after: 30.8 },
        { where: 'diving straight down', before: 12.3, after: 28.8 },
      ] },
    ], see: 'Lift off, push the left stick forward to level out, then left and right to bank round, forward to dive and back to pull up. Settings → Invert the jets’ pitch swaps forward and back.' },
    { match: 'Let go of the jets in the air', shots: [
      { name: 'jets-hold', only: 'after', caption: 'LT / L2 in flight: the jets hold him in the air, sinking slowly, the arm up to shoot', from: 'headless Chrome against this branch’s own dev server, a simulated pad driving the jets, High, 1280 × 720, 10:00 (7 October)' },
    ], numbers: [
      { title: 'Letting go of the throttle about 105–115 m up after flying level (the flight model run headless, on flat ground)', unit: 'm', better: 'higher', device: 'node, src/player.js', source: 'docs/systems/movement-and-camera.md', rows: [
        { where: 'carried on before touching down (before: a fall, and a knock-down)', before: 5.5, after: 416 },
      ] },
    ], see: 'Fly level and let go of RT / R2: you glide down a long way; let go climbing steeply and the nose drops over into a glide. Hold LT / L2 while flying to hang there and shoot.' },
    { match: 'With a keyboard the jets are the left mouse button', see: 'With a keyboard and mouse: click the game to capture the pointer, then hold the left mouse button (or jump and keep SPACE held): W / S tip the nose, A / D turn, SHIFT is faster. On a phone hold ⤒ in the air and drag on the left.' },
    { match: 'The scout drone goes up and down now', see: 'In the Antennas (?level=antennas) walk to the foot of the observation deck’s stairs and press Q (Y / △): the drone climbs toward the deck and hovers there nose up; from the deck, ask it for something on the field below and it sinks over the edge.',
      numbers: [
        { title: 'Where the drone hovers when it finds the goal: its height over your feet (headless Chrome against the dev server, the drone’s position logged every 0.1 s)', unit: 'm', better: 'higher', device: 'Mac, headless Chrome, High', source: 'docs/systems/scout.md, “Up and down”', rows: [
          { where: 'the Desert: Marrow on the ridge, 21 m up, 131 m off', before: 3.2, after: 6.6 },
          { where: 'the Antennas: at the foot of the observation deck, 10 m up, 27 m off', before: 3.3, after: 6.7 },
          { where: 'Incal’s Jets’ Chamber: the gallery 24 m overhead', before: 2.6, after: 19.4 },
        ] },
        { title: 'Toward a goal below: the Antennas’ deck, the field 12 m under it (its height over your feet)', unit: 'm', better: 'lower', device: 'Mac, headless Chrome, High', source: 'docs/systems/scout.md, “Up and down”', rows: [
          { where: 'from the observation deck', before: 3.2, after: -3.5 },
        ] },
        { title: 'scout.update while the drone is out (median of 4 pings, µs a frame; the machine shared with other agents)', unit: 'µs', better: 'lower', device: 'Mac, headless Chrome, High', source: 'docs/systems/scout.md, “Up and down”', rows: [
          { where: 'the Antennas, at the deck’s foot', before: 106.9, after: 107.2 },
          { where: 'Incal’s Jets’ Chamber', before: 131.3, after: 118.6 },
          { where: 'the Overnight Train', before: 90.0, after: 105.7 },
        ] },
      ] },
    { match: 'Indoors the drone keeps under the ceiling', see: 'On the Overnight Train or in a temple’s room, press Q (Y / △): the drone looks out from under the ceiling and short of the walls, and goes round to it instead of grinding along the ceiling.' },
    { match: 'When what the drone finds is well above or below you', see: 'At the foot of the Antennas’ observation deck press Q (Y / △): the line reads “the observation deck · 27 m, 10 m above”.' },
    { match: 'Old walls no longer carry dark dirt streaks', shots: [
      { name: 'cracks-qanat-house', caption: 'A block house in Qanat, 7 m off: the dirt streaks and blotches over its windows gone; its cracks keep clear of the windows and the door', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720, 10:00 (7 October); the before at the commit before the change. View: eye [207.4, 4.2, 418.8], target [202.2, 4.2, 423.5]' },
      { name: 'cracks-qanat-street', caption: 'Inside Qanat’s gate: the tower and the house on the right, before streaked and blotched, now a few faint hairline cracks', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720, 10:00 (7 October); the before at the commit before the change. View: eye [209.1, 4, 363.6], target [178.8, 4, 381]' },
      { name: 'cracks-market-alley', caption: 'A back alley off the Signal Market’s street: drops of grime and patches of plaster gone, fine cracks on the green wall', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720, 10:00 (7 October); the before at the commit before the change. View: the market-alley view of v0.80' },
    ], see: 'Walk up to an old house in Qanat or a shop in the Signal Market: the walls are clean but for the odd fine crack, and none comes near a window or a door. Not every building has them.' },
    { match: 'The darker smudges round the doors are gone', shots: [
      { name: 'doors-eclipse-street', caption: 'The street of lit doors off the Eclipse’s Lantern Square: the dark fans round each doorway gone, every house, table and lantern where it was', commit: '8a70f407',
        view: { level: 'eclipse', player: [2, 0, 26], eye: [4, 2.6, 24], target: [16, 2, 12], fov: 55 } },
      { name: 'doors-eclipse-town', caption: 'The Lantern Square and the wall under the upper city from above: the town laid out as before, the cellar doors clean', commit: '8a70f407',
        view: { level: 'eclipse', player: [0, 0, 30], eye: [-8, 9, 34], target: [6, 2, -30], fov: 55 } },
      { name: 'doors-qanat', caption: 'A block house in Qanat: its door in clean plaster', commit: '8a70f407',
        view: { level: 'desert', player: [209, 8, 417], eye: [207.4, 4.2, 418.8], target: [202.2, 4.2, 423.5], fov: 55 } },
    ], see: 'Walk up to a door in Qanat, at home, in the Signal Market, at Vael II’s monastery or in the City During the Eclipse: the plaster round it is the wall’s own colour.' },
    { match: 'After a dive on the jets the camera', see: 'Fly the jets high, push the left stick forward to dive head first and come down on your feet: the view eases back from looking at the ground to its usual height over the shoulder within a second. Move the right stick as you land and it stays where you put it.' },
    { match: 'People seen close, in a conversation', shots: [
      { name: 'shade-closeup', caption: 'The traveller close up in the shade on the City-Shaft’s rim at 17:00: the lit patches on his neck, cheek and coat are gone', from: 'headless Chrome against this branch’s own dev server and the commit before it, High, 1280 × 720, the camera 1 m from his face (7 October)' },
      { name: 'shade-profile', caption: 'The same, from his side: the cheek and the collar stay in the shade', from: 'headless Chrome against this branch’s own dev server and the commit before it, High, 1280 × 720 (7 October)' },
    ], see: 'Talk to someone standing in a building’s shadow (the City-Shaft’s rim late in the afternoon): faces and coats stay evenly shaded, no lit flecks along their folds.' },
    { match: 'Climbing, the traveller no longer drags', shots: [
      { name: 'climb-halo', caption: 'Climbing a villa’s shaded wall on the City-Shaft’s rim at 17:00: no dark ragged mass round his outline', from: 'headless Chrome against this branch’s own dev server and the commit before it, High, 1280 × 720, the game’s own camera (7 October)' },
    ], see: 'Climb any wall in the shade and look at the wall round the traveller; in the City-Shaft’s shaded terraces, watch people’s feet as you turn the camera.' },
    { match: 'Turning the camera quickly no longer makes distant shadows', see: 'At the City-Shaft’s rim, look across the pit and turn the camera quickly: the towers keep their shade through the turn.',
      numbers: [
        { title: 'The first frame after a quick 100° turn at the City-Shaft’s rim, 10:00, against the same view a few frames later (the light term)', unit: 'px changed', better: 'lower', device: 'Mac, headless Chrome on Metal, 1280 × 720, Handheld preset', source: 'docs/systems/rendering.md, “Shadows close up, on climbers and after a quick turn”', rows: [
          { where: 'the frame after the turn (worst of four frame phases)', before: 35148, after: 0 },
        ] },
        { title: 'What it costs: average draw calls a frame over 12 frames (the shadow maps kept over frames now hold a little more)', unit: 'draws', better: 'lower', device: 'Mac, headless Chrome on Metal, 1280 × 720', source: 'docs/systems/rendering.md, “Shadows close up, on climbers and after a quick turn”', rows: [
          { where: 'High, the rim across the pit', before: 1409, after: 1435 },
          { where: 'High, a terrace along its street', before: 983, after: 1015 },
          { where: 'Handheld, the rim across the pit', before: 952, after: 1012 },
          { where: 'Handheld, a terrace along its street', before: 571, after: 622 },
        ] },
      ] },
  ],
  '0.88': [
    { match: 'Blows land with weight', see: 'In the Arena, cut an ink blot: a brief catch and a jolt as the blade connects; the third swing of the combo sends it flying.' },
    { match: 'A foe winding up out of sight', see: 'In the Arena, turn the camera away from a blot as it comes: a round marker appears at the screen’s edge on its side.' },
    { match: 'Cut-down foes leave ink', shots: [
      { name: 'blade-whirl', only: 'after', caption: 'The whirl: the third swing, grown from the ink, the blade longer', from: 'headless Chrome against the dev server, High, 9:30 (7 October)' },
    ], see: 'Cut blots down: the count shows every 5 ink, and each step is announced as it is reached. Then press F three times quickly, or press it while running.' },
    { match: 'New controls for the blade', see: 'In the Arena: RB / R1 (F) swings, hold LB / L1 (Ctrl) to guard, click the right stick (Tab) to lock on.' },
    { match: 'Locked on, the camera keeps the foe ahead', shots: [
      { name: 'lock-spitter', only: 'after', caption: 'Locked on to a spitting blot (the gold ring), a blot lunging behind the traveller', from: 'headless Chrome against the dev server, High, 9:30 (7 October)' },
    ], see: 'In the Arena, press Tab (R3) as a wave comes in.' },
    { match: 'The push is a gun mode now', see: 'Press X (or the D-pad) until the readout says push, then aim and shoot at a crate or a blot.' },
    { match: 'Three new foes', see: 'In the Arena, waves 3, 4 and 6; out in the wilds, the later packs; winged blots in Vael and the other open-sky worlds.' },
    { match: 'A perfect parry', see: 'In the Arena, hold LB / L1 just as a blot’s ring fills: it costs no charge and the blot is stunned.' },
    { match: 'The frame freezes for an instant', see: 'In the Arena, cut a blot: the world stops dead for a few hundredths of a second as the blade connects.' },
    { match: 'The makers’ machines are rebuilt', shots: [
      { name: 'machine-breaks', only: 'after', caption: 'A machine coming apart: its shell, belt, arms and glowing glyph flying off', from: 'headless Chrome against the dev server, High, 9:30 (7 October)' },
    ], see: 'In the Arena’s fifth wave, or any temple’s rooms: break a machine with the blade.' },
    { match: 'Locked on, the traveller faces the foe and strafes', shots: [
      { name: 'strafe', only: 'after', caption: 'Locked on (the gold ring), side-stepping round a blot in a sword stance', from: 'headless Chrome against the dev server, High, 9:30 (7 October)' },
    ], see: 'In the Arena, lock on (Tab, R3) and move the stick left, right or back.' },
    { match: 'The fluid blade is a real sword now', shots: [
      { name: 'sword', only: 'after', caption: 'The sword mid-swing: the slim fluid blade on its brass guard and hilt', from: 'headless Chrome against the dev server, High, 9:30 (7 October)' },
    ], see: 'Swing the blade (F, RB / R1).' },
    { match: 'An items page, linked from the worlds list', shots: [
      { name: 'items-page', only: 'after', caption: 'The items page: each item’s picture, what it does and where it is found', from: 'headless Chrome against the dev server (7 October)' },
    ], see: 'On the title screen, choose Debug, then Items at the top. Drag an item to turn it; click it for full screen.' },
    { match: 'Fights have their own music', see: 'In the Arena, as a wave comes in: the drum starts; it fades once the wave is down.' },
    { match: 'Where a blot falls, its ink stains the ground', see: 'Cut a blot down: dark stains on the sand where it was.' },
    { match: 'In the temples the makers’ machines meet the rooms’ workings', see: 'In a temple with gusts (Vael’s Aerie), lead a machine into the hall as it blows.' },
    { match: 'On a touch screen the blade has one button again', see: 'On a phone or tablet: tap ⚔, then hold it.' },
    { match: 'A new foe, the shade', shots: [
      { name: 'shade', only: 'after', caption: 'A shade: living shadow running down a person’s body, its feet melting into print dots, the pools it left behind', from: 'headless Chrome against the dev server, High, 9:30 (7 October)' },
    ], see: 'In the Arena’s sixth wave; out in the wilds, a later pack now and then.' },
    { match: 'The Enemies setting has a Gentle choice', see: 'Settings → Enemies: Normal, Gentle or Off.' },
    { match: 'Relics out in the wilds are guarded', see: 'In the desert, walk toward a relic out in the dunes: two blots gather round it.' },
    { match: 'Foes take turns', see: 'In the Arena’s second wave, three blots come: two wind up at most while the third circles.' },
  ],
  '0.87': [
    { match: 'The fluid blade: the glove draws', shots: [
      { name: 'blade-swing', only: 'after', caption: 'The blade mid-swing, among three ink blots in the Arena', from: 'headless Chrome against the dev server, High, 10:00 (7 October)' },
    ], see: 'Anywhere with the backpack, press F (LB / L1 on a controller, ⚔ on a touch screen); press again quickly to chain the three swings.' },
    { match: 'Ink blots gather in the wilds', shots: [
      { name: 'blots-lunge', only: 'after', caption: 'Ink blots winding up: their rings drawn on the sand before they lunge, their eyes gone red', from: 'headless Chrome against the dev server, High, 10:00 (7 October)' },
    ], see: 'In the desert, walk out into the dunes well away from the camps and the ship: a few seconds later the first blot comes in.' },
    { match: 'The makers’ machines stand guard', shots: [
      { name: 'machine', only: 'after', caption: 'A makers’ machine closing in, in the Arena’s third wave', from: 'headless Chrome against the dev server, High, 10:00 (7 October)' },
    ], see: 'Go into any world’s temple: a machine stands by each room’s checkpoint stone past the first.' },
    { match: 'No blow from a foe empties a healthy bar', see: 'Settings → Enemies (on by default). Take a hit at full health: the bar never goes below a sliver.' },
    { match: 'The frame readout moved from F to F3', see: 'Press F3 in the game: the frame readout shows in the corner.' },
    { match: 'The Arena, in the worlds list', see: 'On the title screen, choose Debug, then The Arena.' },
    { match: 'The References level has the Overnight Train’s four pictures', shots: [
      { name: 'overnighttrain-refs', only: 'after', size: [1608, 448], caption: 'The fourth picture (left) and its view in the game (right): the plum carriages along the track, their windows lit, the balcony, the dust at the wheels, the two moons', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'overnighttrain-refs-dusk', only: 'after', size: [1608, 448], caption: 'The third: the train coming on at dusk, its lounge lit through the round nose, the moons low on the right, a bank of cloud on the left', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=overnighttrain and step through its four views with [ and ]; \\ lays the picture over the view.' },
    { match: 'A new world off the route, the Overnight Train', shots: [
      { name: 'overnighttrain-arrival', only: 'after', caption: 'The train waiting at its station by night: the lounge lit at the nose, the ship on the landing wagon behind, the telegraph wires', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
      { name: 'overnighttrain-lounge', only: 'after', caption: 'The observation lounge: armchairs and lamps down both rows of windows, the balcony at the end', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
      { name: 'overnighttrain-dining', only: 'after', caption: 'The dining car, its tables laid and lit, the plain running past the windows', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
      { name: 'overnighttrain-sleeper', only: 'after', caption: 'A sleeping car’s corridor, the compartments’ doors along it', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
      { name: 'overnighttrain-library', only: 'after', caption: 'The library: shelves under the windows, sofas and lamps, the door on through to the landing wagon', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
      { name: 'overnighttrain-balcony', only: 'after', caption: 'On the balcony at the nose: the track and the poles coming at you out of the dark', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
      { name: 'overnighttrain-deck', only: 'after', caption: 'The landing wagon: the ship on its deck, the railing, people come to look', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
      { name: 'overnighttrain-moons', only: 'after', caption: 'From the plain beside it: the lit carriages, the two moons ahead of the train', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
    ], see: 'At the ship’s holo table, choose the Overnight Train on the galactic map (or open the game with ?level=overnighttrain). From the ship walk forward through the porches and the carriages to the lounge at the front.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), 12 synced frames a sample, median of 3 rounds (the machine shared with other agents: compare within the run)', unit: 'ms', better: 'lower', device: 'Mac, headless Chrome, 1280 × 720', source: 'docs/systems/worlds.md, “The Overnight Train”', rows: [
          { where: 'the Signal Market’s start (the budget)', before: 2.26, after: null },
          { where: 'the Signal Market’s street (the budget)', before: 2.19, after: null },
          { where: 'by the ship', before: null, after: 1.77 },
          { where: 'the lounge', before: null, after: 1.77 },
          { where: 'the dining car', before: null, after: 1.67 },
          { where: 'on the roofs', before: null, after: 1.91 },
          { where: 'the landing wagon', before: null, after: 1.69 },
          { where: 'the balcony', before: null, after: 1.73 },
        ] },
        { title: 'Draw calls, same views', unit: 'draws', better: 'lower', device: 'Mac, headless Chrome, 1280 × 720', source: 'docs/systems/worlds.md, “The Overnight Train”', rows: [
          { where: 'the Signal Market, three views (the budget)', before: '334–693', after: null },
          { where: 'the Overnight Train, six views', before: null, after: '116–273' },
        ] },
      ] },
    { match: 'On the Overnight Train the land runs past', shots: [
      { name: 'overnighttrain-station', only: 'after', caption: 'Halted at a station: its house and lamps, the waiting people, the platform along the carriages', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
    ], see: 'Open ?level=overnighttrain and wait by a window: the train leaves its station after half a minute, runs at speed for two and a half minutes, and brakes into the next. Off the train is the running land: step off and you are put back aboard.' },
    { match: 'Climb the ladder on any porch of the Overnight Train', shots: [
      { name: 'overnighttrain-roofs', only: 'after', caption: 'Along the roofs toward the nose: the walk over the crowns, the gardens either side, the plain racing past', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
      { name: 'overnighttrain-terrace', only: 'after', caption: 'The library carriage’s roof terrace, the sky lounge’s door, its pennants', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
    ], see: 'On a porch between two carriages, climb the ladder beside the door (or the end wall itself); the plank bridges join the roofs from the lounge back to the library, whose terrace carries the sky lounge.' },
    { match: 'The Overnight Train sounds like a train', see: 'Turn the effects up and stand at a window while the train runs: the beat of the joints keeps time with its speed, slows as it brakes into a station and stops; go out on the balcony or the roofs and the rush of the air comes up; listen for the whistle as it pulls out.' },
    { match: 'The fluid blade swings like a sword', see: 'In the Arena, press F three times quickly: the three cuts, one after another.' },
    { match: 'Hold the blade button to raise your guard', shots: [
      { name: 'guard-block', only: 'after', caption: 'The guard up, an ink blot’s lunge landing on the shield of fluid', from: 'headless Chrome against the dev server, High, 9:30 (7 October)' },
    ], see: 'In the Arena, hold F (LB / L1) as a blot winds up in front of you.' },
    { match: 'A foe’s strike that lands makes the traveller flinch', see: 'In the Arena, let an ink blot’s lunge land without your guard up.' },
    { match: 'The Arena is bright now', see: 'On the title screen, choose Debug, then The Arena.' },
    { match: 'On the Overnight Train the carriages’ ceilings have round lamps', shots: [
      { name: 'overnighttrain-ceiling', caption: 'The dining car from its aisle: the long lamp strip’s beam down the ceiling (before), the round lamps (after)', from: 'the world’s own screenshots of the same view, headless Chrome, High, 22:00 (7 October)' },
    ], see: 'Open ?level=overnighttrain, walk forward from the ship into the library and on to the dining car, and look down the aisle.' },
  ],
  '0.86': [
    { match: 'A new world off the route, the City Floating in Space', shots: [
      { name: 'spacecity-arrival', only: 'after', caption: 'Out of the ship on the Pier: the bridge to the Gate Quarter, the islands round it, the planet two-thirds lit over the roofs', from: 'the world’s own screenshots, headless Chrome, High, 8:30 (7 October)' },
      { name: 'spacecity-bridge', only: 'after', caption: 'On the Market Bridge, the islands’ machinery hanging into the void below it', from: 'the world’s own screenshots, headless Chrome, High, 9:00 (7 October)' },
      { name: 'spacecity-plaza', only: 'after', caption: 'The Market’s plaza: the stalls under their awnings, the tables, the crowd, the houses heaped round it', from: 'the world’s own screenshots, headless Chrome, High, 11:00 (7 October)' },
      { name: 'spacecity-towers', only: 'after', caption: 'The Towers’ lane, the houses stacked storey on storey', from: 'the world’s own screenshots, headless Chrome, High, 15:00 (7 October)' },
      { name: 'spacecity-garden', only: 'after', caption: 'The Garden terrace and its dark trees, the far islands past its parapet', from: 'the world’s own screenshots, headless Chrome, High, 16:00 (7 October)' },
      { name: 'spacecity-balcony', only: 'after', caption: 'From the Balcony’s railing with Madame Sel: the far islands and their bridges, the planet behind them', from: 'the world’s own screenshots, headless Chrome, High, 8:30 (7 October)' },
      { name: 'spacecity-underside', only: 'after', caption: 'Off the side of a bridge: the tanks, pipes and cables under an island, the stars below (a moment later you are back on the bridge)', from: 'the world’s own screenshots, headless Chrome, High, 10:00 (7 October)' },
      { name: 'spacecity-night', only: 'after', caption: 'The Balcony at night, the planet nearly full, the windows and lamps lit', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'At the ship’s holo table, choose the City Floating in Space on the galactic map (or open the game with ?level=spacecity). Walk north off the Pier, through the Gate Quarter and over the Market Bridge; from the plaza the bridges go east to the Towers, west to the Garden and north to the Balcony.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), 90 synced frames a round, median of 7 rounds (the machine shared with other agents: compare within the run)', unit: 'ms', better: 'lower', device: 'Mac, headless Chrome, 1280 × 720', source: 'docs/systems/worlds.md, “The City Floating in Space”', rows: [
          { where: 'the Signal Market’s start (the budget)', before: 9.9, after: null },
          { where: 'the Signal Market’s crowd (the budget)', before: 8.2, after: null },
          { where: 'by the ship', before: null, after: 9.1 },
          { where: 'the Gate’s lane', before: null, after: 9.0 },
          { where: 'on the Market Bridge', before: null, after: 5.9 },
          { where: 'the plaza', before: null, after: 6.5 },
          { where: 'the Balcony', before: null, after: 7.8 },
          { where: 'looking back over the whole city', before: null, after: 5.2 },
        ] },
        { title: 'Draw calls, same views', unit: 'draws', better: 'lower', device: 'Mac, headless Chrome, 1280 × 720', source: 'docs/systems/worlds.md, “The City Floating in Space”', rows: [
          { where: 'the Signal Market, start and crowd (the budget)', before: '329–366', after: null },
          { where: 'the City Floating in Space, six views', before: null, after: '182–401' },
        ] },
      ] },
    { match: 'The References level has the City Floating in Space’s four pictures', shots: [
      { name: 'spacecity-refs', only: 'after', size: [1928, 538], caption: 'The first picture (left) and its view in the game (right): from the balcony, the arched bridge over the void, the heaped quarters, the planet’s edge', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'spacecity-refs-arches', only: 'after', size: [1928, 538], caption: 'The third: the two arches under the towers, the city running on under the great planet, its dark side mauve', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=spacecity and step through its four views with [ and ]; \\ lays the picture over the view.' },
    { match: 'Space is drawn the way the drawings draw it', shots: [
      { name: 'spacecity-sky', only: 'after', caption: 'Under the crescent: the stars printed all round, the planet’s lit edge, its dark side as black as the sky', from: 'the References’ second view of the City Floating in Space, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=spacecity&view=2; walk off the balcony’s edge with the camera and look down: the stars go on under the islands.' },
    { match: 'The References level has the Signal Market at night', shots: [
      { name: 'marketnight-refs', only: 'after', size: [1464, 408], caption: 'The first picture (left) and its view in the game (right): the screen lane at midnight, the violet face, the scarlet portrait, the planet and the desert', from: 'the views\u2019 own contact sheets, headless Chrome, High (7 October)' },
      { name: 'marketnight-refs-awning', only: 'after', size: [1464, 408], caption: 'The third: under the diagonal awning, the great scarlet portrait, the round planet, the white glyphs', from: 'the views\u2019 own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=marketnight and step through its four views with [ and ]; \\ lays the picture over the view.' },
    { match: 'The Signal Market has its night', shots: [
      { name: 'marketnight-street', caption: 'The avenue at 23:00 from the cab stop: the towers\u2019 signs and the shop signs lit as screens, the black sky', commit: '6083d8e2',
        view: { level: 'bazaar', hour: 23, player: [0, 0, 88], heading: 3.1416, eye: [0, 1.99, 97.5], target: [0, 1.79, 87.5], fov: 55 } },
      { name: 'marketnight-square', caption: 'Signal Square at 23:00: the screens round the silent tower, which stays dark under its covers, and a thinner crowd', commit: '6083d8e2',
        view: { level: 'bazaar', hour: 23, player: [8, 0, -150], heading: 3.1416, eye: [6, 2.4, -140], target: [2, 6, -200], fov: 55 } },
      { name: 'marketnight-stalls', caption: 'Along the stalls at 23:00: a lantern\u2019s warm pool on the sidewalk and the shop front, a shop sign lit lemon', commit: '6083d8e2',
        view: { level: 'bazaar', hour: 23, player: [-20, 0.3, 30], eye: [-18, 3, 30], target: [-24, 4, 0], fov: 55 } },
      { name: 'marketnight-day', caption: 'And at 10:00 the same avenue as it was (only the walkers differ)', commit: '6083d8e2',
        view: { level: 'bazaar', hour: 10, player: [0, 0, 88], heading: 3.1416, eye: [0, 1.99, 97.5], target: [0, 1.79, 87.5], fov: 55 } },
    ], see: 'In the Signal Market (?level=bazaar), set the hour past 21:00 in the developer panel\u2019s Time of day, or wait for the night. The signs light up from dusk; half the crowd is gone by midnight, only out of your sight.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), 60 frames \u00d7 7 rounds, the day and the night alternated four times at each place, the median', unit: 'ms', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, 1280 \u00d7 720', source: 'docs/systems/worlds.md, \u201cThe Signal Market at night\u201d', rows: [
          { where: 'the spawn: by day (before) and by night (after)', before: 1.51, after: 1.48 },
          { where: 'the wide view from 27 m up', before: 1.24, after: 1.19 },
          { where: 'in the crowd', before: 1.29, after: 1.3 },
          { where: 'along the stalls', before: 1.37, after: 1.39 },
          { where: 'Signal Square', before: 1.62, after: 1.58 },
        ] },
      ] },
  ],
  '0.85': [
    { match: 'A new world off the route, the City During the Eclipse', shots: [
      { name: 'eclipse-arrival', only: 'after', caption: 'Out of the ship on the esplanade at noon: the gate, the Lantern Square, the bowl and its house under the black sun', from: 'the world’s own screenshots, headless Chrome, High, 12:00 (7 October)' },
      { name: 'eclipse-square', only: 'after', caption: 'The Lantern Square: the tables by lantern light, the west wall’s terraces and its pale figures, the street of lit doors', from: 'the world’s own screenshots, headless Chrome, High, 12:00 (7 October)' },
      { name: 'eclipse-bowl', only: 'after', caption: 'Up the Great Stair: the bowl, its tiers climbing to the eclipse house, the great dome on the right', from: 'the world’s own screenshots, headless Chrome, High, 12:00 (7 October)' },
      { name: 'eclipse-overlook', only: 'after', caption: 'The overlook: the lane of tables along the parapet, the lower city lit to the rose horizon', from: 'the world’s own screenshots, headless Chrome, High, 12:00 (7 October)' },
      { name: 'eclipse-dusk', only: 'after', caption: 'The bowl at dusk, the sun back and setting', from: 'the world’s own screenshots, headless Chrome, High, 18:36 (7 October)' },
      { name: 'eclipse-night', only: 'after', caption: 'The square at night', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'At the ship’s holo table, choose the City During the Eclipse on the galactic map (or open the game with ?level=eclipse). Walk north through the gate into the Lantern Square; the Great Stair at its far end climbs to the bowl; the overlook is along the upper city’s west parapet. Mira sits by the west wall’s tables, Mother Ysolde in the bowl, Wen at the overlook.' },
    { match: 'Eclipses are drawn the way the drawings draw them', shots: [
      { name: 'eclipse-total', only: 'after', caption: 'Totality at noon: the black disc ringed with light, its corona in rays and dots, a few stars, the lamps lit', from: 'the world’s own screenshots, headless Chrome, High, 12:00 (7 October)' },
      { name: 'eclipse-partial', only: 'after', caption: 'An hour before: the moon’s bite out of the sun, the light dimming, the lamps’ pools coming up', from: 'the world’s own screenshots, headless Chrome, High, 11:00 (7 October)' },
    ], see: 'In the City During the Eclipse (?level=eclipse), the hour is noon, the middle of the eclipse. The developer panel’s Time of day (the hour) shows its phases: partial from 10:00, total from 11:15 to 12:45, the sun back by 14:00.' },
    { match: 'The References level has the City During the Eclipse’s four pictures', shots: [
      { name: 'eclipse-refs', only: 'after', size: [1928, 538], caption: 'The first picture (left) and its view in the game (right): the square under the eclipse, the tables by the walls, the stair, the round tower', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'eclipse-refs-street', only: 'after', size: [1928, 538], caption: 'The fourth: down the street, the city falling away to the horizon, the corona in long fine rays', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ] },
    { match: 'A new world off the route, the Fallen Ring', shots: [
      { name: 'fallenring-arrival', only: 'after', caption: 'Out of the ship: the great arch over the plain, the long tube and its village, the segment leaning on its crushed vermilion foot', from: 'the world’s own screenshots, headless Chrome, High, 10:30 (7 October)' },
      { name: 'fallenring-village', only: 'after', caption: 'The village built into the long tube’s side, under its overhang, a service stair climbing to the crest', from: 'the world’s own screenshots, headless Chrome, High, 15:30 (7 October)' },
      { name: 'fallenring-end', only: 'after', caption: 'The tube’s broken end: the old street inside, lamplit and planted, Oro in the garden, the ramp up from the grass', from: 'the world’s own screenshots, headless Chrome, High, 13:00 (7 October)' },
      { name: 'fallenring-crest', only: 'after', caption: 'On the crest with Emrys: the arch’s leg with its storeys bared, the plain, the cumulus', from: 'the world’s own screenshots, headless Chrome, High, 16:30 (7 October)' },
      { name: 'fallenring-band', only: 'after', caption: 'Under the low segment on its posts: the street between the two rings of houses', from: 'the world’s own screenshots, headless Chrome, High, 12:00 (7 October)' },
      { name: 'fallenring-night', only: 'after', caption: 'The village at night, its windows lit under the tube', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'At the ship’s holo table, choose the Fallen Ring on the galactic map (or open the game with ?level=fallenring). Follow the path north to the long tube’s village; its stairs climb to the crest, and its broken end is east, past the last houses. Walk toward a herd and the beasts trot off.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), a synced loop of frames, median of 3 rounds', unit: 'ms', better: 'lower', device: 'Mac (M4 Pro), headless Chrome on Metal, 1280 × 720', rows: [
          { where: 'the Signal Market’s spawn (the budget)', before: 2.19, after: null },
          { where: 'the Signal Market’s street (the budget)', before: 2.3, after: null },
          { where: 'by the ship (spawn)', before: null, after: 1.61 },
          { where: 'the path, toward the tube', before: null, after: 1.96 },
          { where: 'the tube’s village', before: null, after: 2.01 },
          { where: 'the crest', before: null, after: 1.83 },
          { where: 'under the low segment', before: null, after: 2.33 },
        ] },
      ] },
    { match: 'The References level has the Fallen Ring’s four pictures', shots: [
      { name: 'fallenring-refs', only: 'after', size: [1608, 448], caption: 'The first picture (left) and its view in the game (right): the long tube and its village, the arch’s leg behind, the tilted segment', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'fallenring-refs-arch', only: 'after', size: [1608, 448], caption: 'The third: the arch swooping to its broken vermilion end, the slanted segment over the village', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=fallenring and step through its four views with [ and ]; \\ lays the picture over the view.' },
    { match: 'A new world off the route, the Moon Foundry', shots: [
      { name: 'foundry-arrival', only: 'after', caption: 'Out of the ship on the apron: the hangar\u2019s mouth, the hung moons, the broken moon at the end of the aisle, the moon in its claws', from: 'the world\u2019s own screenshots, headless Chrome, High, 10:30 (7 October)' },
      { name: 'foundry-gantry', only: 'after', caption: 'On the gantry, 13 m up: the way straight into the broken moon, the bowl garden on the left, the moon on its pillar', from: 'the world\u2019s own screenshots, headless Chrome, High, 10:30 (7 October)' },
      { name: 'foundry-court', only: 'after', caption: 'Over the lip into the courtyard: the houses stacked under the shell\u2019s curve, mint trees, Wen counting moons', from: 'the world\u2019s own screenshots, headless Chrome, High, 10:30 (7 October)' },
      { name: 'foundry-quarter-dusk', only: 'after', caption: 'The workers\u2019 quarter at dusk: homes made in the old machinery, the polishing drum with its lit windows, the bowl garden beyond', from: 'the world\u2019s own screenshots, headless Chrome, High, 18:24 (7 October)' },
    ], see: 'At the ship\u2019s holo table, choose the Moon Foundry on the galactic map (or open the game with ?level=moonfoundry). Walk north through the hangar\u2019s mouth; the gantry\u2019s stair rises on the right of the aisle, and the gantry goes straight into the broken moon, with a branch west to the bowl garden. Dun waits at the furnace, Wen in the courtyard, Emrys on the bowl.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), a synced loop of 60 frames, median of 7 rounds', unit: 'ms', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, 1280 \u00d7 720', source: 'docs/systems/worlds.md, \u201cThe Moon Foundry\u201d', rows: [
          { where: 'the Signal Market\u2019s start (the budget)', before: 1.66, after: null },
          { where: 'the Signal Market\u2019s crowd', before: 1.51, after: null },
          { where: 'by the ship (spawn)', before: null, after: 1.51 },
          { where: 'the hangar\u2019s mouth, the widest view', before: null, after: 1.47 },
          { where: 'the gantry', before: null, after: 1.63 },
          { where: 'the courtyard', before: null, after: 1.33 },
          { where: 'the furnace', before: null, after: 1.44 },
        ] },
        { title: 'Draw calls, same views', unit: 'draws', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, 1280 \u00d7 720', rows: [
          { where: 'the Signal Market\u2019s start (the budget)', before: '361\u2013692', after: null },
          { where: 'the Moon Foundry, six views', before: null, after: '281\u2013391' },
        ] },
      ] },
    { match: 'In the Moon Foundry the last furnace still pours', shots: [
      { name: 'foundry-furnace', only: 'after', caption: 'The last furnace: the ladle tipped over the mould, the pour in bands of hot colour, the mouth glowing', from: 'the world\u2019s own screenshots, headless Chrome, High, 10:30 (7 October)' },
      { name: 'foundry-furnace-night', only: 'after', caption: 'The furnace at night', from: 'the world\u2019s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'In the Moon Foundry, walk east from the aisle near the hangar\u2019s mouth to the furnace and stand by the mould: the bands march down the stream, and the drone rises as you come close.' },
    { match: 'The References level has the Moon Foundry’s four pictures', shots: [
      { name: 'moonfoundry-refs-hung', only: 'after', size: [1938, 540], caption: 'The first picture (left) and its view in the game (right): the hung moon, the moon broken open round its courtyard, the bowl in its cradle', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'moonfoundry-refs-claws', only: 'after', size: [1938, 540], caption: 'The third: two moons in their claws, the far moon between the pillars, the bridge across', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=moonfoundry (or the worlds list, L, then the References and Tab to the Moon Foundry) and press \\ to set each picture beside its view.' },
    { match: 'A new world off the route, the Underside', shots: [
      { name: 'underside-arrival', only: 'after', caption: 'Out of the ship on the shelf’s top: its meadow, the white houses on it, the mountain’s face, the cloud beyond the edge', from: 'the world’s own screenshots, headless Chrome, High, 7:36 (7 October)' },
      { name: 'underside-stair', only: 'after', caption: 'Down the great stair cut into the cliff: the shelf’s face beside it, its houses on the ledges, the town hung under it, the banners', from: 'the world’s own screenshots, headless Chrome, High, 7:36 (7 October)' },
      { name: 'underside-walk', only: 'after', caption: 'The rope walk along the stair’s rock into the town under the shelf', from: 'the world’s own screenshots, headless Chrome, High, 7:36 (7 October)' },
      { name: 'underside-bell', only: 'after', caption: 'The Bell Deck under the middle of the rock: its stalls, the houses hung from the rock down to it, the lamps', from: 'the world’s own screenshots, headless Chrome, High, 7:36 (7 October)' },
      { name: 'underside-tip', only: 'after', caption: 'The deck at the tip of the shelf, looking out over the cloud at the far rocks and another shelf’s town', from: 'the world’s own screenshots, headless Chrome, High, 7:36 (7 October)' },
      { name: 'underside-north', only: 'after', caption: 'The timber stair up the north face, the north gallery below it', from: 'the world’s own screenshots, headless Chrome, High, 7:36 (7 October)' },
      { name: 'underside-dusk', only: 'after', caption: 'The south gallery at dusk, the sun low under the shelf', from: 'the world’s own screenshots, headless Chrome, High, 18:36 (7 October)' },
      { name: 'underside-night', only: 'after', caption: 'The Bell Deck at night, by its lamps', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'At the ship’s holo table, choose the Underside on the galactic map (or open the game with ?level=underside). From the ship, walk to the top’s south-west corner and down the great stair; the rope walk at its foot goes north in under the shelf. Zazie is on the south gallery, Kip on the basket deck below it, Tiv at the tip. The timber stair up the north face brings you back to the top.' },
    { match: 'The References level has the Underside’s four pictures', shots: [
      { name: 'underside-refs', only: 'after', size: [1608, 448], caption: 'The third picture (left) and its view in the game (right): the nests under the shelf, the banners, the baskets on their long ropes, the cloud to the edge', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'underside-refs-dusk', only: 'after', size: [1608, 448], caption: 'The fourth: at dusk, the shelf’s face lit rose, its town, the flat cloud to the horizon, the stair up the cliff', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=underside (or the worlds list, L, then the References and Tab to the Underside) and press \\ to set each picture beside its view.' },
  ],
  '0.84': [
    { match: 'A new world off the route, the Glass Dunes', shots: [
      { name: 'glass-camp', caption: 'The Glass Dunes: the west camp under its ramp of sand, the cliff of the giants behind (16:30, the Handheld preset)', commit: 'ac98118a', only: 'after',
        view: { level: 'glassdunes', quality: 'handheld', hour: 16.5, player: [-100, 2, 40], heading: -1.571, eye: [-80, 5, 55], target: [-140, 10, 25], fov: 55 } },
      { name: 'glass-billows', caption: 'The billows in the morning, a glass flow over the sand and an archway at their foot', commit: 'ac98118a', only: 'after',
        view: { level: 'glassdunes', hour: 9, player: [120, 2, 60], eye: [100, 5, 110], target: [180, 20, 20], fov: 60 } },
      { name: 'glass-night', caption: 'The west camp at night: the kiln and the floats lit, an archway glowing in the glass', commit: 'ac98118a', only: 'after',
        view: { level: 'glassdunes', hour: 22, player: [-100, 2, 40], heading: -1.571, eye: [-85, 6, 55], target: [-140, 8, 25], fov: 60 } },
    ], see: 'On the ship, use the galactic map: the Glass Dunes are charted after the route from the start, tagged “a detour”. Or open ?level=glassdunes.' },
    { match: 'In the References level (the worlds list), the Glass Dunes’ four plates', shots: [
      { name: 'glass-ref-1', caption: 'The References: the Glass Dunes’ first plate, the green wall and the camp at the foot of its ramp (\\ compares it with the plate)', commit: 'ac98118a', only: 'after',
        view: { ref: 'glass-1-wall-camp', query: 'world=glassdunes', hour: null } },
      { name: 'glass-ref-4', caption: 'The fourth plate: the wave breaking over the camp, the walls and their silhouettes behind', commit: 'ac98118a', only: 'after',
        view: { ref: 'glass-4-wave', query: 'world=glassdunes', hour: null } },
    ], see: 'Open ?level=references&world=glassdunes and step through its four views with [ and ]; \\ lays the plate over the view.' },
    { match: 'A new world off the route, the City Behind the Waterfall', shots: [
      { name: 'falls-promenade', caption: 'The promenade along the falls, the lower town climbing the back wall, the small fall at the deep end', only: 'after', from: 'the world’s own screenshots, headless Chrome, High, 10:30 (7 October)' },
      { name: 'falls-balcony', caption: 'From a balcony behind the water: the terraces of rounded houses, the cafés on the promenade', only: 'after', from: 'the world’s own screenshots, headless Chrome, High, 10:30 (7 October)' },
      { name: 'falls-night', caption: 'The deep quarter at night: the falls glowing, the houses’ lamps and lit doors', only: 'after', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'Open the ship’s galactic map: the City Behind the Waterfall is charted beside the route. Walk from the landing into the cavern, along the promenade, out onto a balcony, and down the quay’s stair to the pool.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), a synced loop of frames, median of 7 rounds', unit: 'ms', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, 1280 × 720', source: 'docs/systems/worlds.md, “The City Behind the Waterfall”', rows: [
          { where: 'the Signal Market’s spawn (the budget)', before: 2.03, after: null },
          { where: 'the landing (spawn)', before: null, after: 1.1 },
          { where: 'the promenade', before: null, after: 1.24 },
          { where: 'the deep quarter', before: null, after: 1.12 },
        ] },
      ] },
    { match: 'Waterfalls are drawn the way the drawings draw them', shots: [
      { name: 'falls-curtain', caption: 'The curtain from the cavern mouth: the bands, the pen streaks and the slits of light', only: 'after', from: 'the world’s own screenshots, headless Chrome, High (7 October)' },
    ], see: 'Stand by the parapet on the promenade and watch the water: the bands keep their places while their breaks stream down; walk toward the falls and back to hear the roar rise and fall.' },
    { match: 'The References level has the City Behind the Waterfall’s four pictures', shots: [
      { name: 'refs-waterfall-terraces', caption: 'The picture (left) and its view (right): the terraces of domes beside the great fall', only: 'after', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'refs-waterfall-pink', caption: 'The picture (left) and its view (right): the city’s slope at the pink hour, the falls on the left', only: 'after', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open the References (?level=references&world=waterfall) and press Tab for the quick menu: the City Behind the Waterfall’s four views; the backslash key (View on a pad) compares each with its picture.' },
    { match: 'A new world off the route, the Salt Harbour', shots: [
      { name: 'saltharbour-arrival', only: 'after', caption: 'Out of the ship on the open salt: the street between the hulls, the houses on the first hull, the stair tower, the terracotta hull', from: 'the world’s own screenshots, headless Chrome, High, 10:30 (7 October)' },
      { name: 'saltharbour-street', only: 'after', caption: 'Up the street: the stair tower, the houses over the shops, the sailcloth, the ship stood on its stern at the end', from: 'the world’s own screenshots, headless Chrome, High, 10:00 (7 October)' },
      { name: 'saltharbour-deck', only: 'after', caption: 'At the top of the stair: the bridge onto the first hull’s deck, the gangway across to the terracotta hull, the street far below', from: 'the world’s own screenshots, headless Chrome, High, 14:00 (7 October)' },
      { name: 'saltharbour-upright', only: 'after', caption: 'At the street’s end: the ship that stands on its stern, its ropes staked all round it, Pip and the harbour folk', from: 'the world’s own screenshots, headless Chrome, High, 12:00 (7 October)' },
      { name: 'saltharbour-dusk', only: 'after', caption: 'The street at dusk', from: 'the world’s own screenshots, headless Chrome, High, 18:36 (7 October)' },
      { name: 'saltharbour-night', only: 'after', caption: 'The street at night, the houses’ windows lit', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'At the ship’s holo table, choose the Salt Harbour on the galactic map (or open the game with ?level=saltharbour). Walk north up the street; the stair tower stands against the first hull on the left, and the gangway further north along its deck crosses to the terracotta hull. Marrow waits by the ship, Corvin on the terracotta hull’s deck, Pip under the standing ship.' },
    { match: 'The References level has the Salt Harbour’s four pictures', shots: [
      { name: 'saltharbour-refs', only: 'after', size: [1928, 538], caption: 'The first picture (left) and its view in the game (right): the market in the cleft, the gangway, the terracotta hull and its ropes', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'saltharbour-refs-curtains', only: 'after', size: [1928, 538], caption: 'The third: the curtains hung from the high gangway, the arcade along the hull’s foot', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=saltharbour (or the worlds list, L, then the References and Tab to the Salt Harbour) and press \\ to set each panel beside its view.' },
    { match: 'A new world off the route, the Forest of Antennas', shots: [
      { name: 'antennas-arrival', only: 'after', caption: 'Out of the ship: the path winding north through the masts, the great nest saucers, the dishes on their lattices, Teb by the ship', from: 'the world’s own screenshots, headless Chrome, High, 15:30 (7 October)' },
      { name: 'antennas-plaza', only: 'after', caption: 'The plaza among the workshops, under the immense receiver; the maintenance bridge crossing to its balcony; Ottla by her lamp', from: 'the world’s own screenshots, headless Chrome, High, 16:30 (7 October)' },
      { name: 'antennas-deck', only: 'after', caption: 'On the observation deck with Lune at the end of the afternoon: the forest of masts to the haze, the bridge to the receiver', from: 'the world’s own screenshots, headless Chrome, High, 17:12 (7 October)' },
      { name: 'antennas-night', only: 'after', caption: 'The workshops at night, their windows lit under the receiver', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'At the ship’s holo table, choose the Forest of Antennas on the galactic map (or open the game with ?level=antennas). Follow the path north to the workshops; the observation tower’s stair rises from the grass west of the receiver, and Lune waits on its deck. The fallen dish by the path can be walked into.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), a synced loop of frames, median of 3 rounds', unit: 'ms', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, 1280 × 720', source: 'docs/systems/worlds.md, “The Forest of Antennas”', rows: [
          { where: 'the Signal Market’s spawn (the budget)', before: 2.31, after: null },
          { where: 'the Signal Market’s street (the budget)', before: 2.42, after: null },
          { where: 'by the ship (spawn)', before: null, after: 2.16 },
          { where: 'the path, toward the receiver', before: null, after: 2.17 },
          { where: 'the plaza', before: null, after: 2.39 },
          { where: 'the observation deck', before: null, after: 2.15 },
        ] },
      ] },
    { match: 'The Forest of Antennas hums', see: 'In the Forest of Antennas, walk from the ship toward the receiver: the hum rises as the masts close in and is loudest on the plaza and the balcony; listen for the crackle of static and, now and then, a thin whistle tuning in.' },
    { match: 'In the Forest of Antennas, far-off masts, wires and lattice struts stay steady', numbers: [
      { title: 'The motion check’s pan from the ship over the masts: pixels that flicker, per 10 000 a frame', unit: 'px', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, 1280 × 720 (scripts/motion-check, the world frozen, a third of a pixel a frame)', source: 'docs/systems/rendering.md, “Thin bars at any distance”', rows: [
        { where: 'Handheld preset, the pan', before: 62.1, after: 20.0 },
        { where: 'Handheld preset, the drift', before: 8.9, after: 7.6 },
        { where: 'Handheld preset, looking far through the haze', before: 34.3, after: 31.5 },
        { where: 'High preset, the pan', before: 59.0, after: 39.0 },
      ], note: 'Before: the same world with every bar drawn at its own thickness. The masts, struts, wires and vines are pushed out to 1.5 pixels wide wherever they would be thinner; what still flickers is leaves, bushes and grass.' },
    ], see: 'Walk along the path and turn slowly: the thin struts of the far masts and the wires between them hold as lines instead of breaking into dots.' },
    { match: 'The References level has the Forest of Antennas’ four pictures', shots: [
      { name: 'antennas-refs', only: 'after', size: [1608, 448], caption: 'The first picture (left) and its view in the game (right): the path to the workshops under the immense receiver', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'antennas-refs-egg', only: 'after', size: [1608, 448], caption: 'The fourth: the great saucer over the egg and the domes, the stair to the platform', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=antennas and step through its four views with [ and ]; \\ lays the picture over the view.' },
    { match: 'The References level has the Underwater City’s four pictures', shots: [
      { name: 'refs-underwater-cafes', caption: 'The first picture (left) and its view (right): the two cafés under their domes, the towers of pods, the manta', only: 'after', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'refs-underwater-terrace', caption: 'The fourth: the great café lit warm through its window, the lamps along the drop, the open sea', only: 'after', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=underwater (or the worlds list, L, then the References and Tab to the Underwater City) and step through its four views with [ and ]; \\ lays the picture over the view.' },
    { match: 'Under a sea, the water is drawn the way the drawings draw it', shots: [
      { name: 'sea-look', caption: 'The terrace view: the haze in steps with distance, the shafts from the surface, the ripples of light on the street', only: 'after', from: 'the References’ fourth Underwater City view, headless Chrome, High (7 October)' },
    ], see: 'In the References’ Underwater City views, or under any sea: walk and look about; the shafts stay where they are in the water as you move, and the lines of light drift slowly over what faces up.' },
    { match: 'A new world off the route, the Underwater City', shots: [
      { name: 'sea-avenue', caption: 'The avenue at dusk: the shell house and the glass café, the towers of pods, the glass columns, light falling in shafts', only: 'after', from: 'the world’s own screenshots, headless Chrome, High, 18:36 (7 October)' },
      { name: 'sea-over-city', caption: 'Over the avenue, sinking back down: the canal’s bridge, the cafés, the towers and their columns', only: 'after', from: 'the world’s own screenshots, headless Chrome, High, 11:00 (7 October)' },
      { name: 'sea-cafe', caption: 'The glass café: dry and lit warm inside, the sea outside', only: 'after', from: 'the world’s own screenshots, headless Chrome, High, 11:00 (7 October)' },
      { name: 'sea-night', caption: 'The avenue at night: the shafts gone, the lamps and the cafés lit', only: 'after', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'Open the ship’s galactic map: the Underwater City is charted beside the route (or open ?level=underwater). Walk up from the ship along the lamps, into a café, over the canal’s bridge to the plaza, up the terrace’s stairs to the edge; jump and swim up among the towers.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), a synced loop of frames, median of 7 rounds', unit: 'ms', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, 1280 × 720', source: 'docs/systems/worlds.md, “The Underwater City”', rows: [
          { where: 'the Signal Market’s spawn (the budget)', before: 1.51, after: null },
          { where: 'the Signal Market’s street', before: 1.6, after: null },
          { where: 'the landing (spawn)', before: null, after: 1.53 },
          { where: 'the avenue', before: null, after: 1.62 },
          { where: 'swimming among the towers', before: null, after: 1.37 },
          { where: 'in a café', before: null, after: 1.49 },
        ] },
        { title: 'Draw calls a frame, the same places', unit: 'draws', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, 1280 × 720', source: 'docs/systems/worlds.md, “The Underwater City”', rows: [
          { where: 'the Signal Market’s spawn (the budget)', before: 596, after: null },
          { where: 'the landing (spawn)', before: null, after: 301 },
          { where: 'the avenue', before: null, after: 241 },
          { where: 'swimming among the towers', before: null, after: 128 },
        ] },
      ] },
    { match: 'Deep under a sea you walk its floor', shots: [
      { name: 'sea-swim', caption: 'Holding jump: rising off the avenue', only: 'after', from: 'the world’s own screenshots, headless Chrome, High (7 October)' },
    ], see: 'In the Underwater City, walk the avenue, then jump (A / ×) and hold it to rise toward a tower’s pods; let go over a pod’s deck to land on it. Walk into a café’s door: you are out of the water.' },
  ],
  '0.83': [
    { match: 'Once four worlds are behind you, a faint signal pulses', shots: [
      { name: 'relay-signal', caption: 'The galactic map six worlds along: the Signal Market, not charted yet, pulses as “a signal” (home’s panel says where it is)', commit: '1af87675',
        view: { level: 'edena', hud: true, save: saveAlong(6), setup: 'window.ship.map.toggle(true)', wait: 2500 } },
      { name: 'relay-charted', caption: 'Nine worlds along, the market charted: its panel says what the receiver hears from it', commit: '1af87675',
        view: { level: 'buried', hud: true, save: saveAlong(9), setup: "window.ship.map.toggle(true); window.ship.map.select(window.ship.map.entries.findIndex((e) => e.id === 'bazaar'))", wait: 2500 } },
    ], see: 'From four worlds done, open the galactic map at the ship’s holo table: the Signal Market’s place pulses, named or not. With no message waiting, the cockpit’s voicemail says where the signal comes from, and its screen reads RELAY SIGNAL. After the market, step out of the ship and back in: the held recording waits at the voicemail, and after it the father’s own.' },
    { match: 'Your mother’s note in the ship’s galley', see: 'Aboard the ship, the note pinned to the rib by the galley.' },
    { match: 'At the stone at home, the listening shell and the echo shell', shots: [
      { name: 'stone-shells', caption: 'The slab after the ending, every gift on it: the listening shell (white) and the echo shell (brass) among them now', commit: 'f333d23b',
        view: { level: 'home', eye: [-6.22, 1.25, 14.96], target: [-6.47, 0.3, 16.41], fov: 50, hour: 16, player: [-9, 0, 12],
          save: saveAlong(11, { 'ending.done': true, 'ending.keepsake': 'all', ...Object.fromEntries(GIFTS.map((g) => [`item.${g}`, true])), 'home.stone': GIFTS.map((g) => `item.${g}`) }) } },
    ], see: 'Find the listening shell and the echo shell in the makers’ boxes before you go home; or, after the ending, carry them to the stone and pay your respects.' },
    { match: 'What happened at Esk’s terraces in Viridel', see: 'The game menu’s Quests page after the terraces have gone (“What happened”). Then leave Viridel, come back, and talk to Esk on the bottom terrace.' },
    { match: 'Viridel closes with a few words of its own', see: 'Tell Mira what was under the flowers on Odile and Talo’s ship: the toast as the world’s quest ends.' },
    { match: 'In the Buried Machine, Wen has thought about the old story', see: 'After Tooth Day, talk to Wen by the great dome and ask about the last tooth; then talk to Hask on his bench.' },
    { match: 'Everyone has a name of their own now', see: 'The Hangar’s girl with the ball (Zazie), Viridel’s climbing child (Rue), the seller of views on the City-Shaft’s rim (Tobin), the Buried Machine’s listener (Ket) and boy (Jot), the keeper of Vael’s stone hand (Kesh), the spheres’ listener (Linnet) and hill-climber (Emrys), the Undertower’s guide (Hobb), Vael II’s bridge keeper (Agathe), the desert’s dune walker (Rima), stone listener (Dalia) and sketcher (Naji). The credits list them.' },
    { match: 'Vael II’s people sound more like themselves', see: 'In Vael II, talk to Brother Calix, Mother Ysolde, Ondine on the plain, Tiv at the cairn, and Agathe on the founders’ bridge once the stones come down.' },
    { match: 'Halfway down the City-Shaft, by the middle levels’ cab stop', shots: [
      { name: 'halfway-stall', caption: 'The middle levels’ promenade, ten metres from the cab stop: Perrine’s halfway tea stall, the mirror on its pole, a relic on the awning', commit: 'dab14faa',
        view: { level: 'incal', eye: [211.93, -22.0, 27.45], target: [213.92, -22.5, 33.01], fov: 55, player: [212.98, -23.7, 23.16], save: saveAlong(6, { 'item.jetpack': true }) } },
    ], see: 'Take a cab to the middle levels (or fly down to the terrace at −24 m) and walk along the promenade: talk to Perrine, wash the mirror (shoot) and push its frame round from the side until it faces up the shaft. With the Lodestar lit, its glass glows, and Ossa at the bottom has something to say.' },
    { match: 'A few quiet places have something to say now', see: 'In Vael, walk up to the fallen giant’s face on the plain; in the desert, look up at the lintel of the Givers’ Hearth’s door, look at the little mask inside the masked head in the southern dunes, and read the slate by the hut at the crashed hull, then meet Marrow again.' },
    { match: 'The City-Shaft’s terraces go all the way round the shaft now', shots: [
      { name: 'shaft-rings-above', caption: 'The shaft from above the high terrace, looking down: before, each level’s sectors sat on top of each other and most of every ring was empty; after, they go round the pit', size: [1024, 768],
        from: 'the fix’s own screenshots, the two builds side by side in headless Chrome, Handheld, the same camera and hour (7 October)' },
      { name: 'shaft-rings-across', caption: 'From the far side of the rim, across the shaft toward the spire', size: [1024, 768],
        from: 'the fix’s own screenshots, the two builds side by side in headless Chrome, Handheld, the same camera and hour (7 October)' },
    ], numbers: [
      { title: 'Draws a frame', unit: 'draws', better: 'lower', device: 'Mac, headless Chrome, Handheld preset, render scale 0.75 (averaged over 12 frames)', source: 'docs/systems/performance.md, “The City-Shaft’s terraces round the ring”', rows: [
        { where: 'the rim, where you arrive', before: 841, after: 950 },
        { where: 'the wide view down the shaft from the rim', before: 1113, after: 1201 },
      ], note: 'More of the town is in view now that the rings are whole; the railings drawn with the terraces’ iron took back 55–90 of the draws it added.' },
      { title: 'JavaScript a frame, the CPU slowed ×4', unit: 'ms', better: 'lower', device: 'Mac, headless Chrome, Handheld preset (six alternating runs, medians)', source: 'docs/systems/performance.md', rows: [
        { where: 'the rim, where you arrive', before: 23.2, after: 25.2 },
        { where: 'the wide view down the shaft from the rim', before: 25.4, after: 27.3 },
      ], note: 'A second run: 22.7 → 24.3 and 27.0 → 28.8. The city’s crowd is about as large as before (1 373 → 1 505 people), spread round the whole ring.' },
    ], see: 'In the City-Shaft, look down into the pit from the rim, or fly out over the middle on the jets: every level’s terrace now rings the shaft, with only narrow gaps between its stretches.' },
    { match: 'A new world off the route, the White Mangrove', shots: [
      { name: 'mangrove-arrival', only: 'after', caption: 'Out of the ship on the White Mangrove’s landing island at dusk: the landing stage, Bram, the walk to the great tree', from: 'the world’s own screenshots, headless Chrome, High, 17:48 (7 October)' },
      { name: 'mangrove-deck', only: 'after', caption: 'From the deck round the great tree: a house, the ring walk and a spoke, the next tree’s stair and its deck', from: 'the world’s own screenshots, headless Chrome, High, 17:48 (7 October)' },
      { name: 'mangrove-water', only: 'after', caption: 'Swimming in the black lake among the roots, the bridges and stairs overhead', from: 'the world’s own screenshots, headless Chrome, High, 18:12 (7 October)' },
      { name: 'mangrove-night', only: 'after', caption: 'The walk from the landing stage at night', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'At the ship’s holo table, choose the White Mangrove on the galactic map (or open the game with ?level=mangrove). Walk north from the landing stage to the great tree and climb its stair; Oyo is on the deck, Fen by the stair of a tree to the north-west, Bram at the landing.' },
    { match: 'The References level has the White Mangrove’s four pictures', shots: [
      { name: 'mangrove-refs', only: 'after', size: [2920, 816], caption: 'The first picture (left) and its view in the game (right): the landing stage, the lit roots, the long walk', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'mangrove-refs-causeway', only: 'after', size: [2920, 816], caption: 'The fourth: the pale causeway and the tree towers', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=mangrove (or the worlds list, L, then the References and Tab to the White Mangrove) and press \\ to set each panel beside its view.' },
  ],
  '0.82': [
    { match: 'The camera follows closer', shots: [
      { name: 'camera-desert', caption: 'Open desert, the camera as it starts: before 9.5 m back and high; after 6.4 m back, lower, the traveller a quarter of the view', from: 'the camera work’s own screenshots, before and after, the same spot, heading and hour (7 October)' },
      { name: 'camera-qanat', caption: 'Qanat, inside the main gate', from: 'the camera work’s own screenshots, before and after, the same spot and heading (7 October)' },
      { name: 'camera-market', caption: 'The Signal Market’s street, where you arrive', from: 'the camera work’s own screenshots, before and after, the same spot and heading (7 October)' },
    ], numbers: [{ title: 'The open camera, as a world starts', unit: 'm', better: 'lower', device: 'any', rows: [
      { where: 'arm (look point to camera)', before: 9.5, after: 6.4 },
      { where: 'camera height over the feet', before: 3.9, after: 3.0 },
    ], source: 'docs/systems/movement-and-camera.md' }] },
    { match: 'In closed spaces (the ship, temples', shots: [
      { name: 'camera-ship', caption: 'Inside the ship, by the hatch: before 2.6 m back over the right shoulder; after 1.9 m, at shoulder height', from: 'the camera work’s own screenshots, before and after, the same spot and heading (7 October)' },
      { name: 'camera-temple', caption: 'The desert temple’s first hall', from: 'the camera work’s own screenshots, before and after, the same spot and heading (7 October)' },
    ], see: 'Walk up the ship’s ramp, or into a corridor with a wall close on your right: the camera eases in over your left shoulder and stays there; hold LT / L2 (or the right mouse button) to aim and it moves over the right.' },
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
      { title: 'On the device: the people’s update a frame (round 1 → 7 October, with v0.77–0.80 in)', unit: 'ms', better: 'lower', device: RETROID, source: 'docs/systems/performance.md, “The Retroid, round 4”', rows: [
        { where: 'the camps', before: 5.34, after: 3.88 },
        { where: 'Qanat', before: 4.79, after: 3.94 },
        { where: 'the walk through the camps', before: 5.61, after: 4.01 },
      ] },
      { title: 'On the device: frames a second (round 1 → 7 October)', unit: 'fps', better: 'higher', device: RETROID, rows: [
        { where: 'the camps', before: 45, after: 56 },
        { where: 'Qanat', before: 49, after: 57 },
        { where: 'the walk through the camps', before: 44, after: 51 },
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
    { match: 'On the Steam Deck, a game that closes unexpectedly after you have been playing', see: 'Nothing to see while it works: if the game ever closes by itself after you have played a while (or something closes it), Steam returns to its library, and the next launch draws the way it did before instead of switching to a slower one.' },
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
      { title: 'On the device: draw calls (the Retroid’s second round → 7 October)', better: 'lower', device: RETROID, source: 'docs/systems/performance.md, “The Retroid, round 4”', rows: [
        { where: 'the wide view', before: 1326, after: 1140 },
        { where: 'the rim', before: 960, after: 868 },
      ] },
      { title: 'On the device: the G-buffer’s work on the processor a frame (round 1 → 7 October)', unit: 'ms', better: 'lower', device: RETROID, rows: [
        { where: 'the wide view', before: 8.45, after: 5.92 },
        { where: 'the rim', before: 6.67, after: 4.69 },
      ] },
    ], see: 'The towers look exactly as before (0.001–0.16 % of the pixels apart, the moving things; on the Retroid too, the same views merged and unmerged differ only where cabs, people and the airship moved): the gain is in how they are drawn.' },
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
      { title: 'On the device: the traveller’s whole update a frame, shirt and all (round 1 → 7 October)', unit: 'ms', better: 'lower', device: RETROID, source: 'docs/systems/performance.md, “The Retroid, round 4”', rows: [
        { where: 'the desert’s spawn', before: 2.81, after: 1.11 },
        { where: 'the dunes', before: 3.5, after: 1.33 },
        { where: 'the City-Shaft, wide', before: 2.99, after: 1.11 },
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
      { title: 'What the Deck drew before, on High, against its own setting', device: 'Steam Deck OLED, SteamOS 3.8', source: 'docs/systems/performance.md, “The Steam Deck”', note: 'the spawn on High was read once in Desktop Mode (v0.73); on its own setting it was measured in Gaming Mode’s X11 under gamescope at 90 Hz (v0.80); High at 1.5× is still to be measured the same way', rows: [
        { where: 'pixels drawn (thousands)', before: 2304, after: 1024 },
        { where: 'props drawn out to (m)', before: 520, after: 380 },
        { where: 'the fine shadow map (px)', before: 2048, after: 1024 },
        { where: 'the desert’s spawn (fps)', before: '17–22', after: 48 },
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
    { match: 'The loading screen’s turning pen', see: 'Open a world on a handheld and watch the pen on the loading screen: it turns without stopping. (On a busy Mac it stopped 100–240 ms at a time before. On the Retroid it turned smoothly through every load, before the change and after, with no stop over 50 ms: the stutter measured was the Mac’s.)', numbers: [
      { title: 'The pen’s longest stop through a load (a refresh is 17 ms)', unit: 'ms', better: 'lower', device: 'Retroid Pocket Nova (GeckoView 157), a screen recording of the load', source: 'docs/systems/performance.md, “The Retroid, round 4”', rows: [
        { where: 'the desert', before: 33, after: 49 },
        { where: 'the City-Shaft', before: 32, after: 32 },
      ] },
    ] },
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
