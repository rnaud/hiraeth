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
  scenes (`shakeScale`), a still title view (title-world `still`: one frame), and the CSS animations that the
  `prefers-reduced-motion` queries already stopped. Not chosen yet (`null`), it follows
  `prefers-reduced-motion`. The camera has no walking bob to turn off. *Camera shake* scales the
  kicks when motion is not reduced.
- **Hold or toggle** for run and guard (src/remap.js `RUN_MODES`, `GUARD_MODES`): the controller
  reads them itself; on the keyboard the key listener turns a toggled key into one press down and,
  at the next press, one up.
- **Not by colour alone:** the lock-on reticle has one look since v1.42 (four gold arrows, only dimmed out of reach: src/lock-reticle.js); low health is hatched as well as red and
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
- **Title screen**: the name (Hiraeth, lettered: below) over one of the worlds, seen from a fixed
  camera framed like one of the covers it was designed from, and a small menu low at the left: Continue
  (the slot played last) or New game, and Saves, as compact text buttons; under them a row of icon
  buttons (`TITLE_ICONS`, inked: a gear for Settings (the same settings, `SettingsMenu({ el, title: true })`),
  a star for What's new, a beetle for Debug, corner brackets for Full screen). Each icon has an
  `aria-label` and a label shown at the row's right end on hover or focus. Full screen shows only where it
  does something: not in the Android, Deck or Xbox apps, nor in an installed web app already full screen.
  Keyboard (arrows / WASD, Enter, Esc, Delete), mouse and touch, and a controller through `Controller`:
  the main menu by `mainNavigate` (↑ ↓ down the column and into the row's first icon, ← → along the row,
  ↑ from the row back to Saves), the rest by `menuNavigate` (the save list moves by rows, left / right
  reaches a save's Delete); the confirm glyph sits inside the focused entry, in an icon's corner
  (src/pad-glyphs.js). It imports nothing that loads the game state, and marks the Android boot
  heartbeat (`markBooted`) once it is up. Styles: `src/menus.css`.
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
- **The title's lettering** (`src/title-logo.js`): HIRAETH after the masthead of the waterfall-city
  cover (`references/Title Screen/H1-waterfall-city.jpg`): monumental ivory block capitals, a fine ink
  line, a muted vermilion shadow offset down and to the right. Drawn, not set in a font: each letter is a
  few contours on a cap height of 1000 units measured off the cover (stems a third of the cap height, the
  H's narrow slits, the R's small D-shaped counter and its leg meeting the A's foot, the A's flat apex and
  small triangular counter), corners rounded and long edges bowed a hair by a seeded hand. One SVG, crisp at
  every size, the same in every language (`aria-label="Hiraeth"`); the layout thickens the ink line on a
  small screen so it never falls under 1.5 px. The Steam art uses it too (`scripts/steam-art.mjs`).
- **Layout** (`src/title-layout.js` `titleLayout`, pure; set as CSS variables on `#title`): the name across
  the upper part (at most 27 % of the height, 86 % of the width). The menu small, so the world shows (v1.6,
  the author: "much smaller, and left aligned"): entries 40–48 px tall (a touch target; `MENU`), their words
  12–15.5 px, the column at least 14 × the font wide (170–240 px; a longer word in another language widens it),
  the icons as tall, square, 6–10 px apart. Its left edge 3.5 % of the width in from the safe area (14–64 px),
  its foot 5 % of the height above the bottom (12–56 px), never under the name. Every shot leaves its lower
  left calm (the traveller stands right of the middle, the covers' focal points sit in the middle and higher);
  a shot may ask for its menu higher with `menu: 'mid'` (none does yet). The menu takes 1.6 % of 1920 × 1080
  (v1.5's six entries: 6.7 %), 2.8 % of 1280 × 720 (10.4 %), 8.6 % of a phone either way (17 %).
  `tests/title-layout.test.js` checks 16:9, 1280 × 720, 21:9, the Deck's 16:10, 4:3, a phone both ways, a tall
  Android phone and a Retroid, with two, three and four icons: on the screen, under the name, left aligned,
  low, small, touchable, readable; and the safe area.
- **The title's shots** (`src/title-shots.js` `SHOTS`): one per cover in `references/Title Screen/`
  whose world is in the game: a level, the hour, a camera (`eye`, `target`, vertical `fov` at 16:9), the
  traveller's spot and heading, and, when the cover's world is built the other way round, `mirror` (the
  Underside's); `clock` starts the level's own motion where the cover has it (the underwater mantas);
  `sky.top` / `sky.horizon` (mixed over the hour's by `sky.mix`) paint the cover's own sky, sampled off
  the cover a little bluer as the print layer warms it (v1.37: turquoise over the desert, the salt harbour,
  the sky stones and the Underside, peach over the spheres, ochre over the antennas). The covers A1, A2
  (the desert) and B2 (the underwater city) were set aside by the author: the desert keeps A4, the
  underwater city follows B4, from the same terrace.
  `shotCamera(shot, aspect)` keeps the cover's height on wider screens and its width down to 4:3, and on a
  screen held upright turns the view toward the traveller, a little wider, slid up between the name and
  the menu (a shot may give its own `portrait`). Each opening shows a different one: `chooseShot` never
  repeats the last (`localStorage` `moebius.title.shot`, a global key), the worlds the saves are in come
  three times as often, a new player may see any (`?shot=<id>` asks for one). `node
  scripts/title-shots.mjs [ids] [--sizes]` renders each shot (its own Vite on 5345, one headless Chrome)
  and writes it beside its cover into `docs/title-shots/<id>-compare.jpg`; `CAMS='[…]'` tries several poses
  on one load (a contact sheet with the cover).
- **The world behind it** (`src/title-world.js`): the shot's level built by its own code (loaded on demand:
  `TITLE_LEVELS`, not `levels/index.js`), its collision as a static BVH (for the plants and the traveller's
  feet), its water, flora and grass, its flocks and its own motion (`level.update`), drawn by the game's
  pipeline (G-buffer materials, the near and wide shadow maps once, the traveller's fine one each frame,
  bloom, the ink pass in the world's preset and look, the water's sparkle or its under-water haze, FXAA).
  The traveller is the game's own (the Player, his generated body, cape and flask), held in a stern, still
  stance as the covers draw him (`TITLE_STANCE`, `holdStance`): upright, his weight even, arms straight down
  at his sides (out 0.11 rad, the gloved right 0.15, elbows bent 0.1), hands by the thighs, the head a touch
  lowered, looking out over the world; only his breath (a hundredth of a radian in the arms) and his coat
  move. Held over the idle clip: the Player's talking calm (no glances, no captured look-about, the weight
  shift small) and the arms set in `character.poseArms`, just before the body follows the rig, so the feet
  still plant on the ground. The shots' headings stand as authored (most turn his back to us). No people,
  wildlife, foes, ship, story, weather or sound: the title's menu music plays on.
  - *Boot* (v1.37: the title answers at once): the name and the menu show at once over the paper (a cream
    page with a printed grain), wired before anything heavy runs. What can wait goes in the browser's idle
    time (`whenIdle`: `requestIdleCallback`, at most 500 ms off) and never while the player is pressing
    (`busy()`: a key, a pointer, a touch or the pad in the last `TITLE_QUIET` = 400 ms): first the sound's start
    (`new Sound(…, { autoStart: false })`, then `startIfAllowed()`: asking whether sound may start opens an
    audio context, 100–250 ms, and the one that answers is the one it plays on, not a second), then the world.
    Its build runs in a `gatedSlicer` (src/load-steps.js): 24 ms slices that stand aside while the player
    presses, the WebGL context made only in a pause; the long pieces are in steps (the desert's sand drifts,
    `SandDrifts.buildSteps` / `raiseSteps`; the traveller's body, `createTravellerV1Steps`, its overshirt
    `makeTripoClothSteps`; the title's recording balanced in `prepareSoundtrackSteps`). Its shaders are made
    as the loading screen makes them (src/warm-shaders.js `warmShadersSliced`: one object per kind of
    program, with the target the pass draws into, the G-buffer's, the post's, the water's and the shadow
    maps' with their depth-only material; the driver polled, never waited on), then what the view sees is
    drawn once unseen in eights (`WarmDraw`, its buffers and textures uploaded), the levels of detail made,
    and each program first used a slice at a time (`firstUse`), so the first frame has nothing left to wait
    for. The bug it fixed: `compileAsync` and the first frame ran in one task, 0.6–0.9 s on the Mac (7 s in a
    cold Chrome), the sound's two contexts 250 ms more before the menu showed, and presses waited.
    `window.title.timing` has the times (and `stages`, `traveller:*` among them); `node
    scripts/title-perf.mjs` measures the built game in a fresh headless Chrome a run, pressing ↓ every
    0.7 s: on the Mac (High) the menu up at 44 ms (210 before), the longest task 119 ms (699), the slowest
    press 10 ms (599), the world in at 4.2 s (2.8: it now gives way to the presses); `--cpu 4` for a
    handheld's processor, roughly. `tests/title-ready.test.js`.
  - *Print*: once the world is in, `.print` lays the covers' cream paper over it, multiplied (its whites
    cream, a printed grain), CSS alone. The game keeps its world free of a screen grain (src/post.js: it would
    swim as the camera moves); the title's camera never moves.
  - *Saves*: the world's modules (the Player, the flask, some levels' temples) read the game state as they
    load, so the slots are sandboxed first (`slots.sandbox(seed)`: the slot view reads and writes an
    in-memory save, past the prologue; the selector still reads the real ones), and once a save is chosen
    the game starts in a fresh page (`?start`), never with the title's modules. Without WebGL, on a
    software GPU or a lost context, the drawn backdrop (`BACKDROP`) shows and the game starts in the same
    page as before.
  - *Light*: resolution follows the Graphics preset, never above 1×, capped at 2.1 MP (1 MP on a touch
    screen, 0.5 MP and 30 fps on a handheld) and drops by steps if frames come slowly. Reduced motion
    draws one still frame. On continue it stops drawing (its last frame fades out with the title), frees its
    renderer and GPU context and puts the shared uniforms back. `tests/title-world.test.js` checks the
    imports, the sandbox, the hand-over and that the menu still wires up; `tests/title-shots.test.js` the
    shots and the choice.
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
    the name where you arrive shows first, issue #78: "The notices' order" below). Prompts with a place still float over it (`#prompt`).
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
- **What it says** (since the game menu, October 2026): one short line, "◆ the next step · how far"
  (`findSummary` in `src/hud.js`), for 6 s, then fades; nothing about steps already done. Until the author's
  playthrough (issue #72: "every quest hint should be a few words") the quest's overall goal stood on a small
  line over it (`findGoal` in main.js still works it out; the game menu's Quests panel shows it). **It is up the moment you ask** (October 2026,
  issue #65: it waited ~1.8 s for the drone to get there): `Scout.ping` calls `onPing(target)` at once
  and main.js puts the line on the cue then (`FIND.say + FIND.seek` s; `onFind` gives it `FIND.say` more
  when the drone is there, with the flare and the marker). The line is a function the cue asks every
  frame (`findLine`), so **its distance is how far it is now**, walking toward it or away (someone who
  walks about: where they are now, the scout's own target).
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

## The galactic map's signature search (v1.6)

The holo table's map (`src/ship/starmap.js`) with a world to find (docs/systems/story.md, "The signature
search") and power: the chart gets the class `searching`. Each findable world sits unnamed at its place on the
route inside an **uncharted region** (a dashed circle of static, 0.16 of the field's diagonal, its centre off
the world by up to half its radius, the same every time: `regionFor`), labelled UNCHARTED. The **scanner** (a
ring with a cross) follows the mouse over the field, a finger pressed on it (`touch-action: none` while
searching), the left stick (half a field-diagonal a second at full tilt) or W A S D (the arrows still step
through the charted worlds; on a pad the D-pad does, and the scanner over a charted world selects it, so A
travels). The **cues**, from `cueStrength` (0 beyond 0.45 of the diagonal, 1 on the world) through `cues()`: the
scanner's colour (violet, gold, then the route's orange), its glow, its three rings pinging on the beat (2.2 s
far, 0.75 s on it), a little jitter (none with reduced motion), the light's notes every 1.7 s at most (by
strength), the rumble's `search` beat, and the **meter** at the top right of the chart (the foot of the chart on
a phone held upright): SIGNAL, five bars and a word (silent, faint, warmer, strong, locking). The **lock**: within
`lockRadius` (6 % of the diagonal, at least 30 px or 0.6 of a planet's disc) it fills in half a second (a gold arc
round the scanner), and leaks away at 1.2 a second outside. Full: the planet resolves where it was (blur to sharp,
a gold ring), the `found` rumble, the ship's line, and a second later the map is drawn again with the world
charted and chosen. The legend becomes SIGNATURE SEARCH (`SEARCH_LEGEND`, short form on small screens), the
header counts the signatures to find, and the hint line says how to search on the device in hand.

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
- **The chimes** beside the potion (v1.5, `.chimes`): a small cyan crystal (src/chime-icon.js, since October 2026; a pierced brass disc before) and the wallet's count
  (src/chimes.js, `resources.chimes`), hidden while there are none. A change of the wallet shows the whole
  block for its 3 s (`healthHud`'s `wallet`), the count ticks up to it (`walletTick`: at least 14 a second,
  a purse of forty in about half a second; gold and a little larger while it counts) and the disc turns over.
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
  `questToastHtml`: **one short line** on a dark strip, the quest's mark (a gold ◆ for a main quest, a pale ◇
  for an errand: `head` says which) and its title in italics, the first step after it when hints are full
  (`#toast.quest`, index.html). It was three lines, "◆ New quest" in gold capitals over the title and the step
  (the author's playthrough, October 2026, issue #72: "too much visual noise"). Every step of every quest is a
  few words since then (at most 9: `tests/quest-steps.test.js`; the quest QC skill). Later steps, endings and
  every other notice stay plain.

## The notices' order (issue #78)

Stepping out of the ship for the first time, the ship's line, the objective card, Marrow's call, the camera's lesson
and the desert's opening words all came up within a few seconds. Now everything that writes on the screen by itself
takes its turn, one at a time (`NOTICE_ORDER`, `noticeMay` in `src/ship/cinema.js`; `tests/notices.test.js`):

0. **the father's charge** (`#charge-card`, lettered over the crash site), the scene's own title;
1. **the region's name** (`PlaceName`, on the cue), first on arriving and on every load: it settles while the scene
   plays (`hold`) and the others wait for it (`waiting`);
2. **a line** outside a scene (the ship's word and his answer as you step out: `Cinema.say` holds it);
3. **the objective card** (`Cinema.objective` holds it in `_objPending`);
4. **the notices** (`#toast`), each for its full time before the next (they used to overlap at 58 %);
5. **a lesson** on the cue (`src/first-steps.js`), a nudge (the scout's auto-ping), a caller's balloon or an idle
   greeting balloon (`Cinema.noticeBusy()`).

Each waits while another is up and while one ahead of it waits. Not notices: a prompt, the scout's find (asked
for), a conversation, anything inside a letterboxed scene. The crash's objective card is the desert's opening words,
so they are not said again as a notice (`Story.start({ quiet })`), and a makers' box offered on arrival
(`background`) starts without a quest card (the Quests page lists it).

## Screen sizes (resolution audit, 9 October 2026)

Checked at 1280 × 720, 1920 × 1080, 2560 × 1440, 1280 × 800 (Steam Deck), 812 × 375 (a phone on its side),
375 × 812 and 1080 × 2400: the title, the HUD, the pause menu and its settings, a conversation, the journal
and its Worlds page, with a script listing text off screen, cut, or under 10 px. In src/menus.css: the pause
menu's side is compact at `max-height: 480px` in landscape (smaller PAUSED, the save on one line, 12 px
buttons: all of them show, down to Quit to title), its buttons are smaller on a phone held upright (the
settings get the screen), and PAUSED is sized by the width too (`min(7vh, 8vw)`: it ran out of its column on
tall narrow screens). The journal's (src/game-menu.css) smallest words have a 9-10 px floor, and the title's
"Continue" world name at least 11 px. Still open (TODO.md): the touch controls' size on a phone held sideways.


## Back to the Debug menu from its pages (v1.6, `src/debug-back.js`)

Every page the Debug menu opens (the title's Debug: the worlds list alone, `?worlds=1`) has a small
**◀ Debug** button at the top left inside the safe area, in the pages' paper and ink with the cards'
offset shadow and the back button's glyph (`src/pad-glyphs.js`: B / ○ for the pad in hand, the Esc key
for the keys, an arrow alone on a touch screen); it goes to `./?worlds=1`. On the page, B and Esc do the
same while nothing else there is open. One module for all: each page's `<body data-debug-back="…">` and
`<script type="module" src="/src/debug-back-page.js">`, its title marked `class="debug-room"` so it sits
beside the button.

| Page | Options | Why |
|---|---|---|
| Motion, Character studio, Creatures & spirits, Cinematics | (none) | B and Esc mean nothing else there |
| Items | `pad-off`, `data-debug-busy="#full.open"` | its own B already goes back; Esc closes an open item first |
| What's new | `from-debug keys-off pad-off` | players open it too (the title's star): only when opened from Debug; its own B / Esc go back |
| Trailer | `fade` | the button fades while the pointer is still: nothing over the film |
| Audits | `keys-off pad-off` | its own B / Esc step back (a picture, a report, then the Debug list); in a report the button drops its glyph (B is "◀ Audits" there) |

A world opened from the Debug list (`?level=…&debugsave=1`, or from a debug page: the Arena from Creatures
& spirits) shows the button too, click or tap only and fading (`src/boot.js`): B and Esc are the game's
there. Cinematics' own "← Worlds" link gave way to it. Esc is caught before the page's own handlers (the
capture phase), so a viewer the page closes on Esc counts as open; a B held from the page before doesn't
count until let go. `tests/debug-back.test.js` checks every page of the worlds list and of the build
carries it.

## The audits page (v1.7, `audits.html`, `src/audits-page/`)

Debug → Audits reads every audit report: `docs/audits/<kind>-v<version>.md` and the cinematics QC report
(`docs/systems/cinematics-qc.md`, with the review page's verdicts from `cinematics-qc-notes.json`).

- **The dashboard** (the default view, `#/`; v1.37, `src/audits-page/dashboard.js`, data `themes.js`): a card
  per theme (each kind: the game audit's twelve themes, combat, level design, temple design, visual, temple
  visuals, ink lines, cinematics QC, dialogue, performance; a new kind gets its card by itself) with only its
  latest report (the highest version): the overall score (or, with none, a figure: the visual audit's
  findings, the budgets over, the headline's "N of M"), the change since the last earlier report with a
  score, and its items in a compact table (worlds, temples, archetypes and guardians, scenes, cinematics by
  world, budgets, findings by severity, frame times), each with its change since the last report that judged
  it (a batch combat audit judges some archetypes: the others are compared with the batch that did; rows
  are matched by name without "the" or the (…) aside, or by an id aside such as `(arzach2)`). The card opens
  the full report; **History** (its button, Y on a pad, H) unfolds the theme's overall scores as a trend
  line scaled to their range and the list of versions, each opening its report. The items come from a small
  parser per kind (`PARSERS` in `themes.js`, run at build time with the Markdown in hand: `report.theme` in
  the JSON; a kind with none uses its biggest score table with a total). Tests:
  `tests/audits-page-themes.test.js` (the latest per theme, the deltas, each parser on the real reports,
  the cards, the routes and the wiring).
- **All audits** (`#/all`, the view tab, LB / RB from the dashboard): a card a report, newest first: its kind, version and date, the overall score (or, for the
  reports with none, the visual and performance ones, its headline), a sparkline of the kind's overall
  scores and the change since the version before (▲ +0.26 since v1.4), its criteria as small bars, how
  many edits it ranked, its pictures and its open TODO items. Chips filter by kind.
- **A report**, in tabs: *Scores* (the overall, then each score table with its rows ranked as bars, the
  criteria's means and the table inked from red to green; "before" values, `2 → 3`, `4 ✎3`, `4 (was 3)`
  or an earlier version's column, as a dashed ghost bar), *Findings* (the sections that aren't setup,
  scores or edits, pictures included), *Edits* (the ranked lists), *TODO* (the items of the `TODO.md` and
  `DONE.md` sections whose `#` heading names the report's file), *Report* (all of it, with a contents
  line) and *Compare* (two versions of its kind: the overall and every row matched by name, before,
  after and the change, and the findings' severities).
- **The data** is built from the reports at build time: `scripts/audits-data.mjs` (parser:
  `src/audits-page/parse.js`, a small Markdown reader: `markdown.js`). The reports stay the source;
  each starts with a score block the skills write (`<!-- audit-scores` … `overall: 3.66 / 5`, `label:`,
  or `overall: none` and `headline:`, `date:`, `version:` … `-->`, hidden on GitHub). Score tables are
  found by their columns of 1-5 scores (not `#`, units, `ttk`, lengths or counts); the row's total is
  the column named total, mean or score, else the report's version (`v1.6`), else the last.
- **Site-only:** the build's `auditsPlugin` (vite.config.js) writes `dist/audits/audits.json` (about
  330 KB) and the reports' pictures (about 1 MB) beside the page; the over-the-air zip, the APK, the Deck
  and the Xbox package leave `audits/` out (`scripts/web-update.mjs` `AUDIT_FILE`, `scripts/site-only.mjs`),
  and a bundled game reads them from the site (`mediaSrc`). The page itself (about 30 KB) ships. A dev
  server answers the same paths from `docs/`.
- **Controller:** the D-pad or stick moves by where things are drawn (`data-grid-nav`, `menuNavigate`): the
  cards, the chips, the tabs, a report's blocks; a block taller than the screen scrolls before the focus
  leaves it, a wide table scrolls sideways. A opens a card or a picture (full size, LB / RB the others),
  B steps back (the picture, the report, All audits, the dashboard, then the Debug list), LB / RB the view
  (dashboard), the kind (All audits) or the tab (report), Y a dashboard card's History, X / Y the report
  before / after in a report, the right stick scrolls. Keys: arrows, Enter, Esc, Q / E, H, [ / ]. Every control is a button or link for mouse and touch; the header wraps on a phone upright and
  stays two short rows sideways. Tests: `tests/audits-page.test.js` (the parser on the real reports,
  that every report in `docs/audits/` appears with its block, the index, comparisons, the wiring).

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
  keys move the same way, LB / RB jump between its sections (docs/systems/dev-tools.md "The Debug menu"). The items page's cards are a grid too.
- **The item viewer full screen** (items.html, `src/items-page/`): on a handheld's 1920 × 1080 screen (about
  730 × 410 CSS px) the words covered the item. Now the bar holds the name and its buttons (◀ ▶ with LB /
  RB, turn with Y, reset with X, ✕ with B; the keys ← → R 0 Esc with the keyboard) and one short line under
  the item: its kind and its first sentence (`shortLine`, at most 90 letters). "more" (A, I or Enter) opens
  the rest in a column on the left and the item's canvas narrows beside it (`ItemViewer.show` sizes to its
  canvas). Under 480 px high everything is smaller. With a pad: the cards are a grid, A opens, LB / RB or
  ← → the other items, ↑ ↓ zoom, the right stick tilts, B closes (B on the list: back to the worlds list).
- Tests: `tests/pad-glyphs.test.js` (families, the names, the glyphs' labels and CSS, the buttons that carry
  them, `gridStep`, the worlds' cards, X / Y in menus, `shortLine`), `tests/game-menu.test.js`.

## The shop (v1.5)

The shop panel (`src/shop-panel.js`, `src/shop-panel.css`, `#shop`), opened by talking to a keeper ("Show me what
you have": the conversation emits `shop:open`) or with E at their counter (src/story/shops.js); main.js opens it
once the conversation has closed. A paper sheet over the room, the room dimmed behind it:

- **The head**: the keeper's name and title, and what they say now in a speech bubble (in their voice:
  `sound.speak` on the conversation's channel), the **wallet** (the chime and the count, redrawn on every
  `wallet` event), and ✕ to leave (B / ○, Esc). The keeper's balloon is not drawn over the panel; their goodbye
  goes over their head as it closes.
- **The wares**, a card each: the picture (an inked SVG in the HUD's style: the flask, a heart, a magic cell),
  the name, what it does, how many are left ("3 on the shelf", "2 left") and what you have ("you carry 3 / 5",
  "you have 4", "your bar: 3"), the price in chimes. One that can't be bought says why on the card ("Not enough
  chimes", the price in red; "Sold out", the picture faded and a black tag; "Your pack is full") and stays
  focusable (`aria-disabled`, not `disabled`: the pad can still land on it), and choosing it makes the keeper
  say it ("The scale says no", "That's the last of them", "Your pack is full of my cures already").
- **Buying**: a card asks first, "Buy a heart container for 50 chimes?", with **Buy** (A / ×, Enter) and **Not
  now** (B / ○, Esc) in a small sheet over the cards (the cards `inert` meanwhile); Buy pays, the chimes are
  counted out on the counter and the bell rings (`sound.purchase`; the counter bell as it opens,
  `sound.shopBell`), the keeper thanks you for that kind of ware, the card and the wallet update, the HUD shows
  the hearts and the wallet, and the counter's display loses what was sold.
- **The controller**: the cards are a grid (`data-grid-nav`: ← → between cards, ↑ ↓ in a column on a phone),
  A / × asks and buys, B / ○ backs out of the question and then out of the shop (main.js `menuRoot` returns
  `shopPanel.root`, the question while it shows; `closeControllerMenu` calls `shopPanel.back()`); the glyphs are
  in the buttons (A on the focused card, A in Buy, B in Not now and in ✕). **Keyboard**: the arrows, Enter /
  Space / E, Esc or Backspace (the panel's own capture listener; the press that opened it is ignored). **Mouse
  and touch**: tap a card, then Buy; the touch controls are hidden while it is open (`body.shopping`).
- **Screen sizes**: three cards in a row at 1280 × 720 and the Deck's 1280 × 800; under 480 px high (a phone on
  its side, 812 × 375) the same row, smaller; under 560 px wide (a phone held upright, 375 × 812) one card a row,
  the picture beside the words, the wallet and ✕ on top.
- While it is open the game is busy (`busy()`): nothing else takes the input, and the potion button is off.

Tests: `tests/shop.test.js` (the markup, the states, the question, the keeper's reactions, the wiring).
