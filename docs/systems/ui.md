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
  hatch and console, a lens); a ride's controls show for six seconds after you get on.
  The controller's button bar is gone except in photo mode; the full controls live in the
  settings (and H for the keyboard's). Story pages, item cards and toasts that teach name the
  input through a `{key:verb}` placeholder, in the keys and buttons the player holds and bound
  (docs/systems/dialogue.md, "Keys in lines"), never a button written into the prose.
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
    backpack slotting in), a ride's controls for `RIDE_HINT_MS` after you get on, what the scout
    just found, and a region's name as you cross into it (`PlaceName`: it must hold 1.5 s, and
    the name where you arrive is not shown). Prompts with a place still float over it (`#prompt`).
  - **health** (`#health`): while hurt or healing (`Fader(3)`), then fades; **stamina** as before.
  - **the tank**: the crosshair while aiming; no pips any more (the tank's level shows on the
    backpack itself, October 2026), only an "empty" notice for 3 s when it runs dry.
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

## The game menu: Items, Quests, Sketchbook, Worlds (October 2026)

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
- **Look**: the panel's name in the Start menu's comic lettering among four tabs at the top; the sheet
  of ruled paper between two side tabs naming the neighbours (with `LB / L1`, `RB / R1` on a pad); the
  cursor a gold cell in a pulsing red ring; the strip at the bottom: the picked thing's name, kind and
  words, and the buttons that do something here (`menuPrompts`: a pad's in Xbox / PlayStation form,
  which `native-pad.js` renames, the keyboard's keys, none on a touch screen). Sizes follow the viewport
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
