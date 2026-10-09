# Screens, menus and the HUD

The title screen and saves, settings, the pause menus, the empty screen while playing, the changelog page.

## Playing

- **Continue:** your world, position and time of day are saved every few
  seconds; the picker shows a Continue button.
- **Settings (O, Esc or ⚙; the title's Settings):** saved in `localStorage` `moebius.settings.v1`
  (`src/ui.js` `Settings`, `DEFAULTS`), in five groups:
  - *Screen and text:* the language (`lang`: English, Français), graphics (`quality`: Auto,
    Handheld, Steam Deck, Low, Medium, High), the text size (`textSize`: Small, Normal, Large,
    Larger), a solid background behind speech (`speechBg`), the FPS readout (`showFps`, F3);
  - *Camera and motion:* camera sensitivity, invert Y, invert the jets' pitch (`invertFlight`),
    reduce motion (`reduceMotion`), camera shake (`shake`, 0..1);
  - *Controls:* the controller's face layout (`padFaces`), run (`run`: L3 until you stop, hold,
    toggle), guard (`guard`: hold, toggle), and a way to the Controls page, where each verb's key
    and button can be moved (`keys`, `pad`: docs/systems/controls.md, "Remapping");
  - *Sound:* music, effects, voices, alien voices, mute (M);
  - *Game:* enemies (Normal, Gentle, Off); in play only: the developer panel, the dev menu, and
    restarting the save from the prologue.

### Accessibility (the Basic tier of the Game Accessibility Guidelines)

`applyAccess(settings)` (src/ui.js) runs when the settings load and on every change, and hands
each choice to what uses it:

- **Text size:** the root's `--ts` (0.85, 1, 1.2, 1.45). Every font size of the conversation panel,
  the balloons, the prompts, the cue, the toast, the story pages, the restart card (index.html),
  the Start menu, the title and the game menu (menus.css, game-menu.css) is
  `calc(<size> * var(--ts, 1))`; sizes in `em` follow their parent. A new style for words on the
  screen should do the same.
- **A solid background behind speech** (`html.speech-solid`): the conversation panel, its answers,
  the balloons, the cue and the toast on plain white with black ink and a heavier frame (no ruled
  paper behind the words).
- **Reduce motion** (`html.reduce-motion`, src/feel.js `setMotion`): no hit-stop, no slow motion,
  no camera kick (the foes', the blade's, the gadgets', the minigames'), no shake in the ship's
  scenes (`shakeScale`), a still title view (title-vista `still`), and the CSS animations that the
  `prefers-reduced-motion` queries already stopped. Not chosen yet (`null`), it follows
  `prefers-reduced-motion`. The camera has no walking bob to turn off. *Camera shake* scales the
  kicks when motion is not reduced.
- **Hold or toggle** for run and guard (src/remap.js `RUN_MODES`, `GUARD_MODES`): the controller
  reads them itself; on the keyboard the key listener turns a toggled key into one press down and,
  at the next press, one up.
- **Not by colour alone:** the lock-on reticle's states differ in shape (src/lock-reticle.js
  `reticleShape`: doubled chevrons winding up, a burst at the strike, chevrons turned round (tips in) round a
  hollow ring when open, all dashed when out of reach); low health is hatched as well as red and
  pulsing, a winded stamina wheel has a "!" beside it; a clash on the Controls page has a ⚠, the
  other verb's name and a dashed frame. The quest markers are shapes already (◆ ◇ ✦ ✉, ✓ and ·).
- **Language:** docs/systems/localisation.md.
- **Touch:** a floating stick on the left, drag on the right to look, and
  buttons for jump, interact, run and the game menu (❏). Low graphics by
  default.
- **Touch controls' size:** every button's place and size lives in one table, `src/touch-layout.js`
  (drawn for a screen 560 px or more on its short side: a tablet, the Deck). `touchScale(w, h)` is the
  short side over 560, between 0.64 and 1, so a phone held sideways (812 x 375) keeps the cluster in
  the lower right corner (226 x 235 px with every button showing) and upright leaves the left side
  free. `touchLayout(k)` scales places and sizes round each button's centre; no button goes under
  38 px across nor its label under 11 px. ui.js `TouchControls` sets them inline (and `--tk` on
  `#touch`) on resize and when a button is added later (the gadget's); the stick's ring and travel
  scale too. index.html only colours and hides the buttons. The HUD keeps clear by measuring them
  (src/ship/cinema.js `OBSTACLES`). `tests/touch-layout.test.js`: no two buttons touch at any scale,
  the cluster stays in the corner at the phone sizes.
- **Ending:** find all seven story pages and all 35 relics for a closing page.
  It unlocks an eighth world, **The Atelier**: a blank page with pencil
  sketches of every landmark and the artist at his table.

## Changelog

Press **N**, or use the button in settings, for what's new in each version
(`src/changelog.js`; add an entry at the top for every release). After an
update, a note points to it once. The same release notes are in
[changelog.md](../../changelog.md); keep it in sync when adding a release.
Its **See what changed** opens the interactive changelog over the game: each line with its
before / after pictures, numbers or how to see it ([changelog.md](changelog.md)).

- **A first visit is not an update** (`src/first-run.js`, from `src/boot.js` before the title
  writes anything): with no seen version and no save in any slot (nor the save from before the
  slots), this version is marked seen silently, so a new player is not greeted with "Updated to
  v…". A player with an older seen mark, or a save, still gets the toast once.

## Teaching by the room: the ship and the first steps
- **The ship's walk** (`src/ship/cinematics.js` walk, `NUDGE` in `src/ship/prologue.js`): the room
  teaches first: the voicemail button blinks and chimes, and at the console the cue says what the
  use button does ("E voicemail", a pad's X / □). Only if the message is still unplayed after
  20 s, one quiet line at the top for 6 s, once: how to move and look (the input in your hands,
  `verbKey`) if you haven't moved, else where the message is, with a chime.
- **The desert's first steps** (`src/first-steps.js`, main.js's cue): out of the ship and before
  the chest, the cue says "Look around with …" once if the camera hasn't been touched after 6 s,
  and "Jump with …" once after 25 m walked without a jump; each for 5 s. Using the camera or the
  jump first counts it as learnt (`teach.look`, `teach.jump`, per save).
- **Teaching prompts name the input** (`verbKey(verb, kind)` in `src/prompt-keys.js`): the
  keyboard's keys, the pad's buttons in Xbox / PlayStation form (from `src/bindings.js` PAD, so the
  gun's mode is the D-pad, never X), or the touch buttons.

## A quieter screen: conversations and prompts
- **No button reminders.** (Since v0.62 there is no status box at all: "Nothing on the screen" below.) The status box (`updateHud` in `src/main.js`) showed the place,
  gauges, the objective and relics, and a prompt only for what is right here (the ship's
  hatch and console, a lens); nothing while riding (no button hints as you get on, playtest
  2026-10-08: the settings' Controls page lists a ride's buttons).
  The controller's button bar is gone except in photo mode; the full controls live in the
  settings (and H for the keyboard's). Story pages, item cards and toasts that teach name the
  input through a `{key:verb}` placeholder, in the keys and buttons the player holds and bound
  (docs/systems/dialogue.md, "Keys in lines"), never a button written into the prose.
- **A controller means no touch buttons.** `body.controller` hides `#touch` and the gear.
  A connected pad (the Retroid's own controls via `native-pad.js`) counts as in use until
  the screen or the keys are touched, so a handheld starts with a clean screen.
- **What is in hand** (`src/input-mode.js`, `InputMode`; tests `tests/input-mode.test.js`): `pad`,
  `keys` or `touch`, from the controller's activity, trusted key presses (not the touch buttons'
  synthetic ones, nor typing in a field, nor code-less keys a handheld may send), mouse clicks and
  touches. It sets `body.controller` and `body.touch` (the touch layout and buttons only while the
  fingers are what is in use: a keyboard on a touch-screen laptop hides them too) and is remembered
  for the tab in `sessionStorage` (`moebius.input.v1`): a new world is a new page, and a browser
  lists a pad only after its first press there, so the touch buttons used to come back on every
  world loaded with a controller. A remembered pad holds until the screen or keys are used, or a
  pad that was listed goes away. The title screen and the worlds list remember a pad press too.
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
  the sketchbook (the game menu's Sketchbook panel) at once, and opens when the conversation
  closes (`story.waitFor`); a controller press goes to whatever is on top (`menuRoot`).

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
- **The debug entries are the author's** (`src/dev-gate.js` `devMode()`): the title's Debug
  button (the worlds list) and the Start menu's "Debug: worlds" show only with the same switch as
  the in-game Developer panel (Settings → Developer panel, `settings.devPanel`), in a dev build
  (`npx vite`, `import.meta.env.DEV`), or after opening the game once with `?dev=1` (remembered on
  the device as `moebius.dev`; `?dev=0` forgets it). Players see neither. The Dev menu (\`) and
  `?level=<id>` work as before. `tests/first-run.test.js` checks the gate.
  Playtest 2026-10-08 ("the language switched to French and the debug menu disappeared"): the gate is
  meant, and came in that same day, so the entries went from the author's device until the Developer
  panel is ticked. Nothing reads their words (they are found by `data-a`): with the gate on they stay
  through a change of language, on the title and in the Start menu (`tests/menus-settings.test.js`). For now `ALWAYS_DEV` (src/dev-gate.js) shows them to everyone.
- **The Settings on a controller** (`src/menu-pad.js`, through `menuNavigate` in src/controller.js, the
  menus' A in main.js and title.js, `SettingsMenu.back`): ↑ ↓ move; ← → change a slider or a dropdown, a
  step a push, repeating while held, but never with the push that brought the focus onto it (the
  Controller tells `menuNavigate` whether a push is fresh); A / × opens a dropdown (its row tinted, the dropdown
  yellow in a red frame: `.pad-open`), the directions go through its choices, A / × keeps the one shown
  (applied then, once), B / ○ puts the old one back, and B / ○ again leaves the menu. The Language dropdown (`data-pad="open"`) changes only once
  opened: playtest 2026-10-08, holding → from the menu's last button stepped onto it (the first setting)
  and the same push, repeating, turned every menu French. Nothing reads the device's language: English
  unless chosen. `tests/menus-settings.test.js`.
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
  Items, Quests, What's new, Quit to title, where you are and the time played, the settings,
  and "Restart this save from the prologue", which asks inline rather than with
  `confirm()` and forgets only this slot). View / Select (J) opens the game menu (below; its
  Items and Quests entries open it on that panel). Start and
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
    backpack slotting in), nothing while riding (a ride's controls are in the settings), what the scout
    just found, and a region's name as you cross into it (`PlaceName`: it must hold 1.5 s, and
    the name where you arrive is not shown). Prompts with a place still float over it (`#prompt`).
  - **hearts, magic, potion** (`#health`, v1.5): while a heart is missing, the magic bar is spending or
    refilling, a fight is on (`body.combat`) or you are down (`Fader(3)`), then fades; **stamina** as
    before. See "Hearts, the magic bar and the potion" below.
  - **the tank**: the crosshair while aiming; the level is the HUD's magic bar (and the tank's glass on the
    backpack), and an "empty" notice for 3 s when the tank runs dry (the desert's).
  - **the frame readout** is off by default (`showFps: false`; settings saved before `hudV: 1`
    lose the old default once, `migrateSettings`); F, the settings or `?fps=1` (this session
    only) turn it on. `scripts/handheld-perf` sets it.
  - **the menu's button** (`#gear`): only on a touch screen, small (30 px) and faint at 45 %
    opacity; the keyboard has O / Esc, a pad Menu. The touch worlds button is gone (the menu's
    Debug entry has it), and the keyboard help (H) is the menu's Controls page.
  - The scout's floating label (`#scout-label`) is gone: the cue says what it found.
- **The scout finds the objective** (`Scout.ping`, `FIND` in `src/scout.js`): Q, R3 on a pad
  with no foe in reach (on foot, riding or flying: controller.js sends `lock`, main.js pings when
  `foes.cycleLock()` finds nothing to lock on to), the touch "ping". It hops off its dock as before, flies to a lookout (`lookout`, `lookoutSpot`:
  `FIND.out` m towards the objective from over your head, a little more at speed, carried with
  your velocity, and up or down toward its height since v0.89, in the open: docs/systems/scout.md,
  "Up and down"; right over it when it is nearer than `FIND.near`), hovers facing it (no beak or beam
  on a find since October 2026: its heading is the pointer; the beam is kept for boss hints,
  docs/systems/boss-hints.md), drops a **flare** on the spot (`Flare`: a column of its light
  shooting up and a ring that rings out, sized by the distance so it reads from far away, gone
  after `FLARE.life` s), chirps (`sound.drone('found')`) and calls `onFind(target, metres)`:
  main.js puts "◆ Madame Sel, under the silent tower · 320 m" on the cue for 5 s (`findText`,
  `roughDistance`) and shows the quest marker for `MARKER_SECONDS`. After `FIND.point` s it comes
  home and docks as before (`returnT` drives the safe recall now). Phases: docked → launch → seek →
  point → return. Nothing to find (`getTarget()` null): `shrug()`, the eye opens, it lifts a few
  centimetres off the dock and shakes itself (`FIND.shrug` s), "Nothing to find here".
- **What it says** (since the game menu, October 2026): the cue gives the quest's overall goal on a
  small line over "◆ the next step · how far" (`findSummary` in `src/hud.js`, `findGoal` in main.js:
  the quest's goal from `src/story/quest-goals.js`, the observatory's, the world's story title), for
  6 s, then fades; nothing about steps already done.
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
- **The menu's pages** (`SettingsMenu.page`): Settings (where it opens) and Controls, from the side
  column; its Items and Quests open the game menu on that panel (`o.onBook(panel)`; until October
  2026 Quests was a page of its own with the whole quest log). **Controls** (`controlsList`, `controlsHtml`): every control for the pad (in Xbox / PlayStation
  form), the keyboard and touch, the one in your hands first; H opens the menu there. B / ○ or
  Esc on a page goes back to the settings, then out. The title's settings have Controls too.

## The game menu: Items, Quests, Sketchbook, Worlds, People (October 2026)

The author's call: the sketchbook becomes a game menu after Ocarina of Time's pause screen, with
distinct panels and clear controller navigation, an Items panel and a Quests panel, in the game's own
look; and the current quest is only its overall goal and its next step. Code: `src/game-menu.js` (the
panels, the cursor, the page), `src/game-menu-data.js` (what fills them, from the save),
`src/game-menu.css`, `src/item-icons.js`; tests: `tests/game-menu.test.js`.

- **Opening it**: whatever opened the sketchbook — View / Select, J, the touch ❏ — and the Start
  menu's Items and Quests (on that panel). It draws into `#journal`: `Journal.toggle(on, panel)` in
  `src/quest.js` opens it; the journal still keeps the relics, story pages, errands and the
  observatory. It pauses the game like the Start menu, and opens where you left it.
- **Panels** (`PANELS`), side by side in a ring: **Items** (the gear's grid, a slot for every item
  there is, the empty ones dashed and unnamed; under it what you carry for the quests and the
  father's keepsakes; beside it the picked one large), **Quests** (the father's charge, then each
  quest under way, the tracked one first: its title, its goal, "Next" and its step, nothing more;
  pending errands; on the right "Done", a short list of finished and failed titles, `ENDED` of each,
  "and n more"), **Sketchbook** (first the Sightings, below; then a row per world you know: its story
  page, its relics, a ? until found; then the observatory's sketch and the errands'), **Worlds** (the worlds you know in the route's order,
  their picture from `thumbs/`, ✓ story, relics and makers' boxes found, "you are here").
- **Look**: the panel's name in the Start menu's comic lettering among five tabs at the top (four until v1.5); the sheet
  of ruled paper between two side tabs naming the neighbours (their LB / RB glyphs inside them, Q / E with
  the keys; the ✕ carries B / Esc: v1.2, below); the cursor a gold cell in a pulsing red ring; the strip
  at the bottom: the picked thing's name, kind and words, and what the confirm button does here
  (`menuPrompts`: its glyph and the verb, none on a touch screen). Sizes follow the viewport
  (`vh` clamps): 1280 × 720 and the Retroid's 730 × 410 CSS px both fit; a long panel scrolls inside
  its sheet with the cursor.
- **Controls**: LB / L1 and RB / R1 turn the panels (`Controller` sends `tabPrev` / `tabNext` in a
  menu); the stick or the D-pad moves the cursor (`moveCursor`: along a row; off its end onto the side
  tab, once more turns, as on the N64; up / down to the next row with that column, wrapping); A / ×
  uses or looks: a gun mode's item takes that mode (`onUse` → `tool.setMode`), a quest becomes the
  tracked one (`quests.choose`), a sketch is held up over the sheet (any move puts it back); B / ○
  closes the whole menu from any panel. Keyboard: Q / E or [ ] turn, arrows or WASD move, Enter or
  Space use, Esc or J close. Mouse: the tabs, the side tabs, a click picks, a click on the picked one
  uses; hovering picks. Touch: a tap picks and says what it is, a second tap uses; the ✕ closes.
- **The Sightings** (`src/story/sightings.js`, after Outer Wilds' ship log): the open threads the
  player wonders about, at the top of the Sketchbook. Four blocks, one a thread (`THREADS`): *the
  singing light*, *the makers' sign* (three dots over an arc), *the father's signal*, *someone came this
  way before*; each with its count. A trace met is a note on its own paper: a short line in plain words
  (`line`) and, under it, the world and who said it; each thread's notes have their own colour on the
  left edge. One not met yet is a dashed "?" slot, with its world's name once you know that world (else
  nothing: "somewhere further on" in the strip). The met ones come first. The notes are a grid of
  `SIGHT_COLS` (5) a row, so a row on screen is a row of the cursor's; the strip shows the whole line,
  the thread, the world and who, and the thread's question (`ask`). `sightingsData({ game, known,
  titles })` fills it (`menuSources` takes `game`); `tests/sightings.test.js`.
- **The items' pictures** (`ItemIcons`): each item's own model (`buildItemModel`, the one that hovers
  out of its box; every item has one now, the charms and the cab pass included) drawn by the game's
  pipeline alone against the slot's paper (`captureView` with `keep` and `backdrop`, as portraits are),
  one a frame while the menu is open (`pausedFrame`), kept for the session. Until its picture is ready
  a slot shows its kind's mark; a blank capture keeps the mark.
- **The quests' goals** (`src/story/quest-goals.js`): one line per quest (`QUEST_GOALS`, or the quest's
  own `goal`), else a rule: a temple's "Find what the makers left in …", a makers' box's "Find the
  makers' box and open it", else its title. `Quests.summary()` gives each active quest's goal and
  current step and the ended ones by title; `journalHtml()` is the same as text. The steps already done
  are never shown, in the menu or in play.

### People (v1.5)

The fifth panel, after Worlds: who the named people of the route are, as far as the traveller knows them.
Code: `src/story/people-book.js` (the book and the rules), `peopleData` in `src/game-menu-data.js`,
`peoplePanel` and the page handling in `src/game-menu.js`, `src/portrait-cache.js`, the People section of
`src/game-menu.css`; tests: `tests/people-page.test.js`.

- **Spoiler-safe by construction.** A person is listed only once you have talked to them (`met.<id>`, set by
  the conversation panel); nobody unmet, no silhouettes. Each part of their story (`BOOK[world]`: `story`, a
  list of `'text'` known once met or `[cond, 'text']`) shows only once the save holds what unlocks it: a flag
  their conversation sets, a quest stage (`{ quest, past: stage }`, `done`, `failed`), a once-only answer
  (`said.<id>.<node>.<i>`). The conditions read the save's flags only (`test`), so the page works in any
  world. The text retells what they say in their own conversations, shortened; no new lore. `now` (the first
  that holds): where they are and how they are doing. English only for now, like the dialogue (TODO fr); the
  page's own words are in `src/i18n` (en, fr).
- **The cards**: grouped by world in the route's order (`WORLD_ORDER`: `ORDER`, then home and the Lantern);
  each the person's portrait, name and a one-line role. As many a row as fit (`auto-fill`); the D-pad moves
  by where the cards are drawn (`data-grid-nav` → `GameMenu.gridMove` → `gridStep`, `src/menu-pad.js`); past a
  row's end the side tab, as on the other panels; the strip says where they are now.
- **A person's page** (A / ×, or a click / second tap): Back (with the B / Esc glyph), the portrait large,
  name, role and world; "What you know", "Now", "What you chose" (Dov's token, Hollin's promise, Esk's hill,
  what Ilo was told: `CHOICES`), "Between you" (`interactions`: how many conversations, `talks.<id>`, counted
  since v1.5 and 1 for someone met earlier; their quests and how they stand, `QUESTS_OF`; things given either
  way, `GIFTS`; errands, `ERRAND_PEOPLE`; keepsakes, `KEEPSAKE_FROM`). ← → (or the ◀ ▶ buttons) go to the
  person before / after, ↑ ↓ scroll the page, B / ○ or Esc back to the cards (`GameMenu.back()`, before
  closing the menu: main.js `closeControllerMenu`, `Journal`'s Esc), on the card just read. LB / RB still
  turn the panels. One column under 720 px wide (the portrait beside the name).
- **Portraits** (`PortraitCache`): the portrait each conversation takes (`dialogue.shot`, just them against
  their world's flat colour) shrunk to 128 px WebP and kept in `localStorage` (`moebius.portraits.v1`, not
  per slot: a portrait is not progress), the latest replacing the one before so a new costume shows.
  Someone met before v1.5 gets theirs at the next conversation, or while the page is open in their world
  (`pumpPortraits` in main.js, one a frame, people within 60 m); until then their initial on their world's
  colour.

## Hearts, the magic bar and the potion (v1.5)

Where the health bar was (top left, `#health` in index.html; `updateHealth` in main.js, `healthHud`,
`heartsSvg`, `magicHud` in `src/hud.js`; the numbers in `src/resources.js`):

- **The hearts**: one inline SVG, a Moebius heart per container: a thick ink outline (`.ho`, 2.1 of 20
  units), cream inside, the red fill clipped to its quarters (the quadrants round the middle, filled as a
  clock goes from bottom left), a cream highlight, a hard ink drop shadow. A part-filled heart shows its
  quarter lines, so a quarter reads even at the smallest size; the last heart pulses (and its fill is
  dashed: not by colour alone) at one heart or less. Their height is `--hh`: `clamp(17px, 3vh, 24px)`
  times the text size (22 px at 720 px tall, 17 px on a phone held sideways). Redrawn only when the hearts change.
- **The potion** beside them: a corked flask with red in it and its stock (`∞` until the shops; a count
  later, faded at none). It tilts as you drink. On a touch screen it is the potion button (`pointer-events`
  only while shown).
- **The magic bar** under them: an inked bar `2.35 × --hh` wide per unit (three units at the start, longer
  with expansions), a tick per unit (a unit is what a shot costs), teal fill; short of one unit it is pale
  and hatched. Hidden without the backpack (and for the desert's dry tank).
- **When**: `healthHud` returns null at rest (the rule "nothing on the screen"): shown while a heart is
  missing, the bar is not full, a fight is on or you are down, and 3 s after; at once on a hurt, a
  knockdown or a drink. `screen.health` (platform.js) carries `{ value, low, hearts, max, magic, magicMax,
  potions, infinite }` (an engine draws it; the Unity bridge still draws the share as a bar).
- **Notices** never cover it: `#health` heads `OBSTACLES` (src/ship/cinema.js), the whole block, potion
  and bar included.
- Checked at 1280 × 720, the Deck's 1280 × 800 and a phone's 812 × 375 (changelog pictures, v1.5).

Tests: `tests/resources.test.js` (the SVG's quarters and lines, the bar, the markup), `tests/hud.test.js`.

## Notices and the quest card (playtest 2026-10-08)

- **Notices** (`#toast`, queued by `Cinema.toast`, `src/ship/cinema.js`) are quiet: translucent paper,
  a 1 px line, no shadow, 12 px, at most 560 px wide (60 % of a phone held sideways). The cue and the
  scenes' hint got the same lighter frame.
- **Never on the hearts**: `#health` (the hearts, the potion and the magic bar) is one of the layout's `OBSTACLES` whether it shows or not
  (it comes the moment you are hurt). `layoutCinema` places a top item centred when it can, else slides
  it sideways along its row to the free span nearest the centre (`slide`: a phone's buttons down the
  right), else the next row down; `Cinema.layout` sets its `left` as well as its `top`. On a narrow
  portrait phone the cue sits below the hearts and the magic bar (62 px down). Tests: `tests/hints.test.js`.
- **A quest's start looks different**: `Quests.startToast` (and the villagers' errands, `Errands`) call
  the toast with `{ kind: 'quest', head, title, step }`; the queue keeps it, and the toast is drawn as
  `questToastHtml`: an ink card with a gold rule, "◆ New quest" (or New errand) in gold capitals over
  the title in italics and the first step (`#toast.quest`, index.html). Later steps, endings and every
  other notice stay plain.

## Screen sizes (resolution audit, 9 October 2026)

Checked at 1280 × 720, 1920 × 1080, 2560 × 1440, 1280 × 800 (Steam Deck), 812 × 375 (a phone on its side),
375 × 812 and 1080 × 2400: the title, the HUD, the pause menu and its settings, a conversation, the journal
and its Worlds page, with a script listing text off screen, cut, or under 10 px. In src/menus.css: the pause
menu's side is compact at `max-height: 480px` in landscape (smaller PAUSED, the save on one line, 12 px
buttons: all of them show, down to Quit to title), its buttons are smaller on a phone held upright (the
settings get the screen), and PAUSED is sized by the width too (`min(7vh, 8vw)`: it ran out of its column on
tall narrow screens). The journal's (src/game-menu.css) smallest words have a 9-10 px floor, and the title's
"Continue" world name at least 11 px. Still open (TODO.md): the touch controls' size on a phone held sideways.


## The menus on a controller: grids, glyphs in the buttons, the pad's own names (October 2026, v1.2)

- **Glyphs in the buttons** (`src/pad-glyphs.js`): a menu's buttons carry their own prompt instead of a hint
  line under them. `glyph(role, { focus, key })` is an empty `<span class="glyph" data-glyph="…">` put inside
  the button; its label is CSS, a custom property per role on `:root` (`--g-ok`, `--gc-ok` its colour,
  `--gz-ok` its size), set by `installGlyphs()` (once per page: `src/boot.js`, the items page) from the pad in
  hand and refreshed whenever native-pad.js works the labels out again (`onLabels`, a pad connected or gone,
  the "Controller buttons" setting). So a menu drawn again keeps its glyphs, native-pad.js never rewrites them
  (it skips `[data-glyph]`), and screen readers skip them (`aria-hidden`). Roles, by position as the prompts
  are written: `ok` and `back` (the menus' confirm and back, printed A and B whatever the layout), `x`, `y`,
  `lb`, `rb`, `lt`, `rt`, `view`, `menu`, `l3`, `r3`, `dpad`. `focus: true` shows it only on the button a pad
  has focused (the entry A would press). With the keyboard (`body:not(.controller)`) a glyph shows its key,
  `GLYPH_KEYS` (Enter, Esc, Q, E) or its own `data-key`, drawn as a key cap; a role without one hides; on a
  touch screen (`body.touch`) none show. Where: the title (A beside the focused entry and save, B in Back and
  Keep, X on a save's Delete: X / □ deletes, the Controller now sends `x` and `y` in menus), the Start menu
  (B in Resume, A on the focused entry, the reset question), the journal (B in the ✕, LB / RB on the side
  tabs; the strip keeps the confirm button's verb only, `menuPrompts`), the galactic map (B in close, A in
  Travel and Yes, B in No), the cargo check, the restart dialog, what's new's Close, the worlds list and the
  items page. Conversations keep their answer badge (`choiceHtml`), now in the pad's own names (below).
- **The pad's family** (`src/native-pad.js` `familyOf`, `padFamily`): from the Gamepad id, Xbox (045e,
  XInput, and any pad we don't know), PlayStation (054c, DualSense, DualShock), Switch (057e, Pro Controller,
  Joy-Con), or the handheld layout (the Android app, a Retroid, `?pad=android`). `padText(text, layout, faces,
  family)` keeps the matching half of "A / ×" and the family's own shoulder and menu names (L1 R1 L2 R2,
  Create / Options; L R ZL ZR, − / +; LS / RS for L3 / R3 on Xbox and Switch); the Android layout is as
  before. `watchLabels` rewrites every text on the page, always.
- **One button, never the pair** (October 2026; the author saw "A / ×" on the Steam Deck): a browser lists a
  pad only after its first press on the page (each world is a new page), and Steam Input's pads too, so
  until then there was no family and the prompts stayed as written, both halves. Now `pageFamily` picks one:
  the pad listed now; else the family of the last pad listed on this device (`rememberFamily`, localStorage
  `moebius.padFamily.v1`); else the platform's (`platformFamily`: the Deck's app, `moebius:`, Steam's
  browser or a Steam pad on the list, ids with Valve's 28de, "Steam Virtual Gamepad", "Steam Deck": Xbox
  letters, as Steam draws them; the Android app its handheld names; anything else Xbox's, the standard's own).
  `padText` with no family shows the Xbox half too, so no caller can print the pair. With the keyboard or the
  touch screen in hand the button glyphs show the key or nothing (CSS), and a prompt written as text keeps
  that one half. The interactive changelog page runs `watchLabels` as well. `tests/prompt-pairs.test.js`
  renders every prompt string (the language files, the bindings, the changelog, every literal in `src/`)
  for each case (Xbox, PlayStation, Switch, handheld, keyboard, no pad listed, a remembered DualSense, a
  Steam virtual pad, the Deck's app) and fails on any "A / ×" pair left. A Switch pad on a computer reports positions with A on the right:
  `padFaces` auto now says 'nintendo' for it, so it confirms with A (right) and backs out with B (bottom), as
  on a Switch. `padGlyphs({ family, faces, layout })` (pure) gives each role's label and colour (Xbox's
  green A, red B…, PlayStation's shapes a little larger). The source's prompts stay in Xbox / PlayStation
  form.
- **Grids** (`gridStep` in `src/menu-pad.js`, through `menuNavigate`): a menu whose root (or an ancestor)
  has `data-grid-nav` moves in 2D, to the card that way on the screen: ← → within the row (by a third of the
  card at least, so the focused card drawn lifted and larger doesn't count its column as "to the right"),
  ↑ ↓ to the column's card or else the nearest that way, ↓ past the last row wraps to the first, the column
  kept. Other menus keep moving in their order. The worlds list (`#picker`, `cardHtml`) is a grid of small
  cards (a picture with its number, the name, the source, the save it opens in; the blurb and moves in the
  strip at the foot for the focused card), the focused one lifted in a red frame with A on it; the arrow
  keys move the same way, LB / RB scroll a page. The items page's cards are a grid too.
- **The item viewer full screen** (items.html, `src/items-page/`): on a handheld's 1920 × 1080 screen (about
  730 × 410 CSS px) the words covered the item. Now the bar holds the name and its buttons (◀ ▶ with LB /
  RB, turn with Y, reset with X, ✕ with B; the keys ← → R 0 Esc with the keyboard) and one short line under
  the item: its kind and its first sentence (`shortLine`, at most 90 letters). "more" (A, I or Enter) opens
  the rest in a column on the left and the item's canvas narrows beside it (`ItemViewer.show` sizes to its
  canvas). Under 480 px high everything is smaller. With a pad: the cards are a grid, A opens, LB / RB or
  ← → the other items, ↑ ↓ zoom, the right stick tilts, B closes (B on the list: back to the worlds list).
- Tests: `tests/pad-glyphs.test.js` (families, the names, the glyphs' labels and CSS, the buttons that carry
  them, `gridStep`, the worlds' cards, X / Y in menus, `shortLine`), `tests/game-menu.test.js`.
