# Screens, menus and the HUD

The title screen and saves, settings, the pause menus, the empty screen while playing, the changelog page.

## Playing

- **Continue:** your world, position and time of day are saved every few
  seconds; the picker shows a Continue button.
- **Settings (O, Esc or ⚙):**
  - graphics quality: low / medium / high;
  - mouse and touch sensitivity, and invert Y;
  - music and effects volume, and mute;
  - reset progress;
  - the developer shader panel is hidden unless you enable it here.
- **Touch:** a floating stick on the left, drag on the right to look, and
  buttons for jump, interact, run, sketchbook and worlds. Low graphics by
  default.
- **Ending:** find all seven story pages and all 35 relics for a closing page.
  It unlocks an eighth world, **The Atelier**: a blank page with pencil
  sketches of every landmark and the artist at his table.

## Changelog

Press **N**, or use the button in settings, for what's new in each version
(`src/changelog.js`; add an entry at the top for every release). After an
update, a note points to it once. The same release notes are in
[changelog.md](../../changelog.md); keep it in sync when adding a release.

## A quieter screen: conversations and prompts
- **No button reminders.** (Since v0.62 there is no status box at all: "Nothing on the screen" below.) The status box (`updateHud` in `src/main.js`) showed the place,
  gauges, the objective and relics, and a prompt only for what is right here (the ship's
  hatch and console, a lens); a ride's controls show for six seconds after you get on.
  The controller's button bar is gone except in photo mode; the full controls live in the
  settings (and H for the keyboard's). Story pages, item cards and toasts name no keys.
- **A controller means no touch buttons.** `body.controller` hides `#touch` and the gear.
  A connected pad (the Retroid's own controls via `native-pad.js`) counts as in use until
  the screen or the keys are touched, so a handheld starts with a clean screen.
- **Round button badges** (`src/prompt-keys.js`): `keyBadge('E')` is
  `<b class="key">E</b>`, a small ink circle (a pill for "X / □"); `badgeLine()` badges the
  button at the start of each " · " part of a status line. The badge holds the plain
  button name, so `native-pad.js` still renames it in place.
- **Conversations** (`src/story/dialogue.js`): the speaker's name sits in a caption box
  across the panel's top edge next to the portrait, larger on a 1080p screen; no hint
  line, no translator tag (the words still in their script at the caret remain), and a small pointer
  when a press turns the page. While talking, the status box, floating prompt, button bar
  and gear are hidden.
- **Portraits** (`src/story/portrait-bg.js`): the sketch is the person alone (`isolate()`
  hides everything else for the shot), against one flat colour: the world's own pastel
  tone, or another of that world's tones when they wear something close to it
  (`backdropFor`). `captureView(…, { keep, backdrop, fov })` draws it; the composite's
  `uBackdrop` uniform (`src/post.js`) paints the sky pixels flat.
- **Story pages wait for the talk to end** (`Story.showPage` in `src/quest.js`): a world's
  closing page, which comes a moment after the last line, used to open over the
  conversation and stay up while A turned the pages under it. It is now drawn and kept in
  the sketchbook at once, and opens when the conversation closes (`story.waitFor`); a
  controller press goes to whatever is on top (`menuRoot`).

## The title screen, five saves and the pause menus
- **Boot order** (`src/boot.js`, the page's entry): the title screen (`src/title.js`) runs
  first and only then loads `src/main.js`, so the save slot chosen there is the one every
  store reads. A world asked for directly skips it and plays the current slot:
  `?level=<id>` (the ship's arrivals, the dev shortcut), `?prologue=1`, `?ending=1`, and
  `?start` (a save started over from the Start menu; the URL is cleaned so a reload goes
  back to the title). Quit to title is just a load of the bare page.
- **Title screen**: the name in comic lettering over a live view of the land above the
  clouds (below), then Continue (the slot played last),
  Saves, Settings (the same settings, `SettingsMenu({ el, title: true })`) and, in a desktop
  browser, Full screen. Keyboard (arrows / WASD, Enter, Esc, Delete), mouse and touch, and a
  controller through `Controller` + `menuNavigate` (the save list moves by rows, left /
  right reaches a save's Delete). It imports nothing that loads the game state, and marks
  the Android boot heartbeat (`markBooted`) once it is up. Styles: `src/menus.css`.
- **The title's vista** (`src/title-vista.js`): a golden-hour view over a sea of cloud, drawn
  by the game's own pipeline (G-buffer materials, the ink pass of `post.js` in the 'Moebius
  print' style, the sky with two pale moons). Mushroom tables, needle spires, balanced stacks
  and bobbing floating stones from the Sky Stones' rock builders (`src/levels/sky-stones-kit.js`,
  shared with `arzach2.js`) stand to either side of the menu, rose mesas close the horizon, a
  few birds circle (`life.js` Flock). The camera (`vistaCamera(t)`, pure) sweeps slowly round
  the great table and back every 4 minutes, high over the cloud, the sun to one side.
  - *Boot*: the menu shows at once over a CSS sky gradient; the module is imported after the
    menu has painted, builds in small steps (`buildVista`, yielding so input keeps working),
    compiles its shaders (`compileAsync`), and fades its canvas in on the first frame. The
    heartbeat doesn't wait for it. Picking a save before it is ready aborts the build.
  - *Light*: the sun's shadow map is drawn once (one wide cascade; nothing in it moves);
    resolution follows the Graphics preset, never above 1×, capped at 2.1 MP (1 MP on a touch
    screen, 0.5 MP and 30 fps on a handheld, with fewer puffs and coarser rock there), and drops
    by steps if frames come slowly. Reduced motion draws one still frame.
  - *Fallback*: no WebGL, a software GPU (SwiftShader / llvmpipe) or a lost context shows the
    drawn SVG backdrop (`BACKDROP`) instead.
  - *Clean hand-over*: it touches no save. On continue it stops drawing (its last frame fades
    out with the title), then frees its renderer and GPU context (`forceContextLoss`) and puts
    the shared surface uniforms (sun, shadow maps, hatching style) back as they were, before
    `main.js` makes its own renderer. `tests/title-vista.test.js` checks the imports, the
    resolution caps, the camera path and the build budget.
- **Save slots** (`src/save-slots.js`): `slotStorage` is a localStorage look-alike that files
  each progress key under the active slot (`moebius.game.v1` in slot 2 is
  `moebius.s2.game.v1`): the game state, the sketchbook, the saved position and the reactive
  world's memory all read and write through it. The active slot is `moebius.slot`, pinned
  for the page on first read. Settings, mute, the pad layout, the changelog's seen mark and
  the update toast stay global. A per-slot `meta` key keeps the time played (counted while
  the game runs, not paused) and when it was last played. `summary(n)` reads a slot's raw
  saves for the selector (world, worlds done, relics, items found); the worlds' names come
  from `src/levels/names.js`, which has no imports. The single save from before the slots is
  copied into slot 1 once (`migrate()`); the old keys are left as they were, so an older
  build (an over-the-air update rolled back) still finds its save.
- **Pause menus**: Menu / Start (O, Esc) opens the Start menu, now full screen (Resume,
  Sketchbook, What's new, Quit to title, where you are and the time played, the settings,
  and "Restart this save from the prologue", which asks inline rather than with
  `confirm()` and forgets only this slot). View / Select (J) opens the sketchbook. Start and
  Select work over a conversation or one of the ship's scenes too (holding B still skips a
  scene). While one of them (or What's new) is open, `frame()` skips the world entirely:
  player, people, crowds, wildlife, vehicles, the ship's scenes and the world's clock
  (`simT`) stop, nothing is drawn, presses don't leak into the game, and the time played
  stops counting.
- **Menu music** (`Sound.menuMusic(on)` in `src/audio.js`): the world's music, effects,
  voices and their reverb now run through one `world` bus, hushed to `MENU_HUSH` under a
  menu while a calm score of its own fades in on a separate bus: a slow pad in D lydian
  (I-V-vi-IV), a music box arpeggio and a falling melody every 32 beats, flute then bell
  (`MENU_SCORE`, `menuBeat(b)`). The title screen plays it on a `Sound('title', { score: false })`
  that fades out and closes as the game loads.

## Nothing on the screen; the scout finds the objective (v0.62)

The author's rule: no icon or text stays on the screen while you play. To find the quest you send
the drone; for the quest log you open the menu. Tests: `tests/hud.test.js`, `tests/scout.test.js`.

- **No status box** (`#hud` / `#status` and `updateHud`'s status line are gone; `src/hud.js`). The
  world's name, the objective and its distance, relics x/5, the charge line and the gauges no
  longer sit in the bottom-left corner. What is left comes only when it matters, then fades:
  - **the cue** (`#cue`, `cueText`, `Cue`): one short line at the bottom (at the top on a phone,
    where the toasts make room for it: cinema.js `OBSTACLES`) for what the use button does right
    here when it has nothing to float over (the ship's ramp, hatch and console, a lens, the
    backpack slotting in), a ride's controls for `RIDE_HINT_MS` after you get on, what the scout
    just found, and a region's name as you cross into it (`PlaceName`: it must hold 1.5 s, and
    the name where you arrive is not shown). Prompts with a place still float over it (`#prompt`).
  - **health** (`#health`): while hurt or healing (`Fader(3)`), then fades; **stamina** as before.
  - **the tank** (`ToolHud.gaugeShown`, `body.tool-gauge`): the crosshair and the pips while
    aiming; without aiming, the pips alone beside the traveller (main.js `placeToolGauge`, left of
    the shoulders as the stamina wheel is right) while the tank is short (a shot, a boost, the
    jets burning: the pip being burnt shows what is left of it, until the refill), on a mode
    switch, and an empty tank for `GAUGE_DRY` s; `GAUGE_LINGER` s after, it fades.
  - **the frame readout** is off by default (`showFps: false`; settings saved before `hudV: 1`
    lose the old default once, `migrateSettings`); F, the settings or `?fps=1` (this session
    only) turn it on. `scripts/handheld-perf` sets it.
  - **the menu's button** (`#gear`): only on a touch screen, small (30 px) and faint at 45 %
    opacity; the keyboard has O / Esc, a pad Menu. The touch worlds button is gone (the menu's
    Debug entry has it), and the keyboard help (H) is the menu's Controls page.
  - The scout's floating label (`#scout-label`) is gone: the cue says what it found.
- **The scout finds the objective** (`Scout.ping`, `FIND` in `src/scout.js`): Q, Y / △ on a pad
  (on foot and now riding or flying too: controller.js sends `ping` from the top button in the
  ride context), the touch "ping". It hops off its dock as before, flies to a lookout (`lookout`:
  `FIND.out` m towards the objective from over your head, a little more at speed, carried with
  your velocity; right over it when it is nearer than `FIND.near`), hovers and points its beak and
  a thin lit **lens beam** at it (`updateBeam`: out to the objective or the first thing in the
  way, at most `FIND.beam` m), drops a **flare** on the spot (`Flare`: a column of its light
  shooting up and a ring that rings out, sized by the distance so it reads from far away, gone
  after `FLARE.life` s), chirps (`sound.drone('found')`) and calls `onFind(target, metres)`:
  main.js puts "◆ Madame Sel, under the silent tower · 320 m" on the cue for 5 s (`findText`,
  `roughDistance`) and shows the quest marker for `MARKER_SECONDS`. After `FIND.point` s it comes
  home and docks as before (`returnT` drives the safe recall now). Phases: docked → launch → seek →
  point → return. Nothing to find (`getTarget()` null): `shrug()`, the eye opens, it lifts a few
  centimetres off the dock and shakes itself (`FIND.shrug` s), "Nothing to find here".
- **What it finds** (`nextObjective`): the tracked quest's objective (or the main quest's, or the
  first active one: `Quests.objective`), routed through doorways; while the observatory expedition
  is under way its steps first; then the world's story goal (its beacon); once the story is told,
  the ship from more than 25 m away; else nothing. It never points at a relic any more: they are
  yours to find. A quest with `background: true` (the makers' boxes, offered on arrival) is only
  tracked when nothing else is or when you choose it, so a box doesn't take the scout from the
  quest you are on.
- **The quest marker** (`QuestMarker`, the cyan diamond over the tracked objective) no longer hangs
  in the air all the time: `reveal()` shows it for `MARKER_SECONDS` after a find, then it fades.
  **The world's beacon** (the gold column over a world's story goal, `Story.beacon`) stays: it is
  part of the landscape, not the screen (a lighthouse you see across the dunes, drawn in the
  world's ink and light), it is the one way a world without step-by-step quests shows its goal
  before you think of asking, and it goes when the story is told.
- **The menu's pages** (`SettingsMenu.page`): Quests, Settings (where it opens) and Controls, from
  the side column. **Quests** (`o.quests()`, `questsPageHtml`): "Where to" (what the scout would
  find, and how far), the father's charge and the quest log (the sketchbook's own sections:
  `chargeJournalHtml`, `quests.journalHtml()`, steps done struck through, finished ones stamped,
  failed ones under their own heading), and what you carry. Active quests are focusable
  (`data-nav`, which `menuNavigate` steps onto): confirm or a click tracks one (`o.onTrack`).
  **Controls** (`controlsList`, `controlsHtml`): every control for the pad (in Xbox / PlayStation
  form), the keyboard and touch, the one in your hands first; H opens the menu there. B / ○ or
  Esc on a page goes back to the settings, then out. The title's settings have Controls too.
  The sketchbook (View, J) is unchanged.
