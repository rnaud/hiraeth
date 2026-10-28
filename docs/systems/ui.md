# Screens, menus and the HUD

The title screen and saves, settings, the pause menus, the empty screen while playing, the changelog page.

## Playing

- **Continue:** your world, position and time of day are saved every few
  seconds; the picker shows a Continue button.
- **Settings (O, Esc or ⚙; the title's Settings):** saved in `localStorage` `hiraeth.settings.v1`
  (`src/ui.js` `Settings`, `DEFAULTS`), in five groups and, in play, a sixth for the author:
  - *Screen and text:* the language (`lang`: English, Français), graphics (`quality`: Auto,
    Handheld, Steam Deck, Low, Medium, High), the text size (`textSize`: Small, Normal, Large,
    Larger), a solid background behind speech (`speechBg`), the FPS readout (`showFps`, F3);
  - *Camera and motion:* camera sensitivity, invert Y, invert the jets' pitch (`invertFlight`;
    shown only while the debug jets are owned, `hasJets`, issue #122), reduce motion (`reduceMotion`), camera shake (`shake`, 0..1);
  - *Controls:* the controller's face layout (`padFaces`), run (`run`: L3 until you stop, hold,
    toggle), guard (`guard`: hold, toggle), and a way to the Controls page, where each verb's key
    and button can be moved (`keys`, `pad`: docs/systems/controls.md, "Remapping");
  - *Sound:* music, effects, voices, alien voices, mute (M);
  - *Game:* enemies (Normal, Gentle, Off), hints; in play only: restarting the save from the prologue;
  - *Developer* (in play only, last, below the reset): the developer panel (the dev gate's own switch,
    so always there) and the dev menu (`data-dev`: only with the gate on, `src/dev-gate.js`).

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
  `prefers-reduced-motion` queries already stopped (the game menu's every animated rule, the map's loading pen
  among them: `tests/reduce-motion-css.test.js`, issue #235), and the chime pirates' hit with no shake and no
  flare (`shakeScale`, issue #230). Not chosen yet (`null`), it follows
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
- **Ending:** every world's story told for a closing page (all its relics too, until they went in v2.34: issue #732).
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
  for the tab in `sessionStorage` (`hiraeth.input.v1`): a new world is a new page, and a browser
  lists a pad only after its first press there, so the touch buttons used to come back on every
  world loaded with a controller. A remembered pad holds until the screen or keys are used, or a
  pad that was listed goes away. The title screen and the worlds list remember a pad press too.
- **Round button badges** (`src/prompt-keys.js`): `keyBadge('E')` is
  `<b class="key">E</b>`, a small ink circle (a pill for "X / □"); `badgeLine()` badges the
  button at the start of each " · " part of a status line. The badge holds the plain
  button name, so `native-pad.js` still renames it in place.
- **The talk prompt beside the person** (v1.65, issue #241: "Button prompts to talk to people should be right next
  to them just below shoulder level, not above their heads"; `src/talk-prompt.js`, `placePrompt` in
  `src/story/index.js`, `tests/talk-prompt.test.js`): a person's interactable has `beside()` (`shoulders`: their
  rig's upper arms, `TALK.below` 0.1 m under the joints; no rig, by their height, 1.3 m standing, 0.95 seated, an
  alien under its face); `besideAnchor` moves the middle of the shoulders out along the camera's right by half the
  body's width as seen (at least `TALK.half`) and `TALK.out` more, and `tagPlace` sets the tag's left edge 6 px from
  there, its middle on that height, reading outward. Near the screen's right edge it takes their other side (and
  keeps it for that person), always inside the screen. Things (a lens, a crank, a sign) keep their prompt over them;
  `at` (for an engine's own prompt, `screen.prompt`) is the middle of the shoulders.
- **Conversations** (`src/story/dialogue.js`): the speaker's name is plain ink on the
  paper's first line next to the portrait, with no box and no subtitle (issue #208); no hint
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
  the journal at once (the game menu's Sketchbook panel showed it until v1.62), and opens when the conversation
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
  the device as `hiraeth.dev`; `?dev=0` forgets it). Players see neither. The Dev menu (\`) and
  `?level=<id>` work as before. `tests/first-run.test.js` checks the gate.
  Playtest 2026-10-08 ("the language switched to French and the debug menu disappeared"): the gate is
  meant, and came in that same day, so the entries went from the author's device until the Developer
  panel is ticked. Nothing reads their words (they are found by `data-a`): with the gate on they stay
  through a change of language, on the title and in the Start menu (`tests/menus-settings.test.js`). `ALWAYS_DEV` is off since v2.32 (#708).
  **L3 + R3 on the title** (F2 or \` on the page; issue #734) turns the gate on or off on this device
  (`toggleDevMode`, kept as `?dev=1` keeps it): the title's What's new and Debug tools and the Saves
  screen's debug saves come and go with it. The engines' title (`engine/menus.js` `titleAction`) answers
  the pad's chord the same way and says "L3 + R3 debug off" in its hint while it is on.
- **The Settings on a controller** (`src/menu-pad.js`, through `menuNavigate` in src/controller.js, the
  menus' A in main.js and title.js, `SettingsMenu.back`): ↑ ↓ move; ← → change a slider or a dropdown, a
  step a push, repeating while held, but never with the push that brought the focus onto it (the
  Controller tells `menuNavigate` whether a push is fresh); A / × opens a dropdown (its row tinted, the dropdown
  yellow in a red frame: `.pad-open`), the directions go through its choices, A / × keeps the one shown
  (applied then, once), B / ○ puts the old one back, and B / ○ again leaves the menu. The Language dropdown (`data-pad="open"`) changes only once
  opened: playtest 2026-10-08, holding → from the menu's last button stepped onto it (the first setting)
  and the same push, repeating, turned every menu French. Nothing reads the device's language: English
  unless chosen. `tests/menus-settings.test.js`.
- **The sidebar and its page** (issue #210, v1.58: "moving left and right on the menu does nothing? I would expect
  it to go from the sidebar to the right panel; up and down on the sidebar should wrap around"). The Start menu and
  the title's Settings are a sidebar (`.menu-nav`) and the page it shows (`.panel`): `menuNavigate` steps them by
  `sideStep` (src/menu-pad.js). ↑ ↓ on the sidebar go round its entries only (Resume above Quit to title), → goes
  into the page (where you left it, else its first control), ↑ ↓ there go round the page's controls, ← goes back to
  the sidebar's entry for that page. In these menus a dropdown changes only once opened with A / × (← → on it closed
  move between the sidebar and the page); a slider keeps ← → for its value. B / ○ with a pad goes from the page
  back to the sidebar first, then closes; Esc and the mouse close at once. The arrow keys and W A S D move the same
  way in the game's Start menu (they did nothing before).
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
  repeats the last (`localStorage` `hiraeth.title.shot`, a global key), the worlds the saves are in come
  three times as often, a new player may see any (`?shot=<id>` asks for one). `node
  scripts/title-shots.mjs [ids] [--sizes]` renders each shot (its own Vite on 5345, one headless Chrome)
  and writes it beside its cover into `docs/title-shots/<id>-compare.jpg`; `CAMS='[…]'` tries several poses
  on one load (a contact sheet with the cover).
- **The title's drawing and the game behind it** (v1.49, issue #110: "something that loads very very quickly"). The
  title builds no 3D world any more. Its shot is a **vector drawing** of the game's own render of it
  (`public/title-vectors/<id>.svg`, 35-180 kB, a third of that compressed): `node scripts/title-vectors.mjs [ids]
  [--preview]` traces each still (`docs/title-shots/stills/<id>.jpg`, `scripts/title-shots.mjs --stills`, the mirrored
  shots flipped) into flat colour and ink (`scripts/title-trace.mjs`): 18 colours by k-means, plus the ones they fit
  worst (a red coat, a green orb), the ink's pixels left out of them; speckle away (a majority filter, pieces under
  14 cells merged); each colour's outline along the cells' edges, simplified and drawn through its edges' midpoints
  (the frame's corners kept), stroked in its own colour so no seam shows; the sky one rectangle under all; and the
  ink, the still's own line work at full size (pixels darker than both sides across them: a pen line, never a dark
  sea), closed, thinned to centre lines and drawn as 1.8-unit pen strokes. `src/title-paint.js` puts it up with the
  name, laid out as the menu will lay it, the moment the page's script runs (`src/boot.js` calls `paintTitle()`
  before anything else; it imports only the shots, the lettering, the layout and the slots); the cover's paper shows
  until the drawing is in, the print's grain is multiplied over it, and the singing light crosses its sky now and
  then (CSS, `#title .light`, still with reduced motion). The menu joins the same screen when `src/title.js` has
  loaded (it no longer waits for the 430 kB changelog: the version comes from `src/version.js`, written into the
  build by `vite.config.js`; nor for three.js: `src/feel.js` has none). Without the drawing: the drawn land
  (`BACKDROP`).
  Once the menu answers, the **game loads behind it** (`src/title-hold.js`): the save Continue plays (a new
  player's first empty slot, the prologue) is made active and `src/main.js` loads under the title. It must not
  hear the player meanwhile: every input listener added to the window or the document from then on is wrapped to
  ignore what comes while the hold lasts (`holdInput`; the title's own were added before), its sound doesn't start,
  what it writes to the save stays in memory (`slots.holdWrites()`; `commitWrites()` once that save is chosen,
  `dropWrites()` if another is), and its build stands aside (a `gatedSlicer`) within `BEHIND_QUIET` (1.5 s) of a
  press and all the while the player is in the saves, the settings or a question (its load has steps of 0.35 s on
  a desktop, 1.4 s on a processor four times slower, which a press would wait through). It stops at its first
  frame's door (`hold.arrive()`, `await hold.go`). Continue on that save releases it: the title fades out over the
  game's first frame (`hold.played()`), at once if the load is done, else after a quiet mark where the menu was (a
  turning pen and the load's stage). Any other choice (another save, a new game in another slot, a setting or the
  language changed, that save deleted, the load failed) opens the game in a fresh page (`?start`), as before.
  `window.title.timing`: `start` (the script), `painted`, `picture`, `shown` (the menu), `game` (the load began).
  `node scripts/title-boot.mjs [--presets high,handheld] [--cpu 1,4] [--net 4g] [--press ms]` measures a built game:
  from the navigation, the first pixel, the script, the title's paint, its picture, its menu, and the game's first
  frame after Continue. Mac (M4 Pro), headless Chrome, median of three: the name and drawing painted 12-16 ms after
  the script runs (45-50 ms with the processor slowed four times, 17 ms on a mobile connection), Continue at 8 s
  playing in 0.7 s (4.8 s before), 6.5 s at ×4 (12.9 s); `scripts/title-perf.mjs --cpu 4` with ↓ every 0.7 s: the
  slowest press 19-26 ms while the game loads behind. Tests: `tests/title-paint.test.js`.
  `?vista=live` builds the old live world instead (below; no game behind it), to compare.
- **The world behind it** (`?vista=live` only, since v1.49; `src/title-world.js`): the shot's level built by its own code (loaded on demand:
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
    (v1.37-v1.48; the drawing above replaced it.) `window.title.timing` has the times (and `stages`, `traveller:*` among them); `node
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
  each progress key under the active slot (`hiraeth.game.v1` in slot 2 is
  `hiraeth.s2.game.v1`): the game state, the sketchbook, the saved position and the reactive
  world's memory all read and write through it. The active slot is `hiraeth.slot`, pinned
  for the page on first read. Settings, mute, the pad layout, the changelog's seen mark and
  the update toast stay global. A per-slot `meta` key keeps the time played (counted while
  the game runs, not paused) and when it was last played. `summary(n)` reads a slot's raw
  saves for the selector (world, worlds done, items found; no relics since v2.34); the worlds' names come
  from `src/levels/names.js`, which has no imports. The single save from before the slots is
  copied into slot 1 once (`migrate()`); the old keys are left as they were, so an older
  build (an over-the-air update rolled back) still finds its save.
- **Pause menus**: Menu / Start (O, Esc) opens the Start menu, now full screen (Resume,
  Settings, Controls, Photo mode, What's new, Quit to title, where you are and the time played, the settings,
  and "Restart this save from the prologue", which asks inline rather than with
  `confirm()` and forgets only this slot). View / Select (J) opens the game menu (below): the items, the quests,
  the map and a makers' house's map are there alone since issue #487 (the Start menu had Items, Quests, Map and
  House map entries too, the author: "they are already in the select menu"). Start and
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
  that fades out and closes as the game loads. **One music at a time** (v1.65, issue #243: "When in the pause
  menu we should not play both the level and menu music"): under any menu that pauses the game (the Start menu,
  the game menu, What's new: main.js `sound.menuMusic(paused())`) the world's own music bus (`music`: the score,
  a recorded soundtrack, the fight's drums) goes to nothing while the effects and voices stay hushed at
  `MENU_HUSH`; it comes back at its volume as the menu closes. The music slider moved in the menu, the score's
  per-frame level (`listen`) and a new start (`start`) all keep it out while `menuOn`. `tests/menu-music.test.js`.

## Nothing on the screen; the scout finds the objective (v0.62)

The author's rule: no icon or text stays on the screen while you play. To find the quest you send
the drone; for the quest log you open the menu. Tests: `tests/hud.test.js`, `tests/scout.test.js`.

- **No status box** (`#hud` / `#status` and `updateHud`'s status line are gone; `src/hud.js`). The
  world's name, the objective and its distance, relics x/5, the charge line and the gauges no
  longer sit in the bottom-left corner. What is left comes only when it matters, then fades:
  - **the cue** (`#cue`, `cueText`, `Cue`): one short line at the top since issue #306, first in the hints'
    stack ("Hints: one look, one place" below) for what the use button does right
    here when it has nothing to float over (the ship's ramp, hatch and console, a lens, the
    battery slotting in), nothing while riding (a ride's controls are in the settings), what the scout
    just found, and a region's name as you cross into it (`PlaceName`: it must hold 1.5 s, and
    the name where you arrive shows first, issue #78: "The notices' order" below). Prompts with a place still float over it (`#prompt`).
  - **hearts, magic, potion** (`#health`, v1.5): while a heart is missing, the magic bar is spending or
    refilling, a fight is on (`body.combat`) or you are down (`Fader(3)`), then fades; **stamina** as
    before. See "Hearts, the magic bar and the potion" below.
  - **the battery**: the crosshair while aiming; the level is the HUD's magic bar (and the battery's own glass at his
    hip), and an "empty" notice for 3 s when the battery runs dry (the desert's).
  - **the frame readout** is off by default (`showFps: false`; settings saved before `hudV: 1`
    lose the old default once, `migrateSettings`); F, the settings or `?fps=1` (this session
    only) turn it on. `scripts/handheld-perf` sets it.
  - **the menu's button** (`#gear`): only on a touch screen, small (30 px) and faint at 45 %
    opacity; the keyboard has O / Esc, a pad Menu. The touch worlds button is gone (the menu's
    Debug entry has it), and the keyboard help (H) is the menu's Controls page.
  - The scout's floating label (`#scout-label`) is gone: the cue says what it found.
- **The scout finds the objective** (`Scout.ping`, `FIND` in `src/scout.js`): Q, D-pad → on a pad
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
  the ship from more than 25 m away; else nothing. It never pointed at a relic (they went in v2.34). While the world's lead giver waits (v1.68: docs/systems/story.md, "Quests are given") it finds them
  first. A quest with `background: true` (the makers' boxes) is only
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

## The game menu: Quests, Map, Items, Worlds, People (October 2026; the Sketchbook's page went in v1.62)

The author's call: the sketchbook becomes a game menu after Ocarina of Time's pause screen, with
distinct panels and clear controller navigation, an Items panel and a Quests panel, in the game's own
look; and the current quest is only its overall goal and its next step. Code: `src/game-menu.js` (the
panels, the cursor, the page), `src/game-menu-data.js` (what fills them, from the save),
`src/game-menu.css`, `src/item-icons.js`; tests: `tests/game-menu.test.js`.

- **Opening it**: whatever opened the sketchbook — View / Select, J, the touch ❏ — on the **Quests**
  (`DEFAULT_PANEL`, v1.58, issue #213: "default menu should be the quest one"); the Start menu no longer opens
  it on a panel (issue #487). It draws into `#journal`: `Journal.toggle(on, panel)` in `src/quest.js`
  opens it; the journal still keeps the story pages, errands and the observatory (an old save's relics, unread). It pauses the
  game like the Start menu; each panel keeps its cursor.
- **Panels** (`PANELS`), side by side in a ring, in this order since v1.58 (the **Wardrobe** last since v1.88: its own
  section below): **Quests**, **Map** (below),
  **Items** (the gear as large tiles, each with its name under its picture, as many a row as fit, the cursor
  moving by where they are drawn, `data-grid-nav`; a tile for every item there is, the empty ones dashed and
  unnamed; under them what you carry for the quests and the father's keepsakes), **Worlds**, **People**.
  **Quests** (the father's charge, then each
  quest under way, the tracked one first: its title, its goal, "Next" and its step, nothing more;
  the tracked one framed in red on a pale red paper with a ◉ TRACKING tag, and the cursor's card on any other
  quest under way saying A / × TRACK at its right (`trackPrompt`: the pad's own button, Enter on the keyboard;
  issue #516: "not clear which quest is currently tracking and how to track another one"; the engines' rows
  carry `tracked` and `track` for BridgeMenu.Chrome.cs `QuestCard`);
  pending errands; on the right "Done", a short list of finished and failed titles, `ENDED` of each,
  "and n more"), **Worlds** (the worlds you know in the route's order,
  one a row since v1.58 so ↑ ↓ go between them (issue #213: "the worlds tab I can't go up and down"): their
  picture from `thumbs/`, ✓ story, makers' boxes found, the blurb, "you are here"; *Travel here* on
  the ones you can fly to, below).
- **The Sketchbook's page is gone** (v1.62, issue #213: "The sketchbook is confusing about its purpose. I don't
  know why it's there at all."): `PANELS` has five, the tab and its side-tab neighbour with it; `sketchesPanel`,
  `sketchesData` and their styles went. Nothing a save holds is lost or changed: the journal (src/quest.js) still
  keeps the story pages, the relics' and errands' sketches and the observatory's, and the Sightings are still
  written down (`sight.*`, src/story/sightings.js: the Lantern answers them). Where they show now: each world's
  story in the Worlds full view (its relics by name until v2.34), the errands under Quests (pending) and
  People (delivered: the toast says "… to see it under People"), the story page as it opens. An old caller asking
  for the `sketches` panel lands where it was (`MenuState.show` ignores an unknown id). The controls' words say
  "items, quests, worlds" (src/bindings.js, the `ctl.*` strings).
- **Fast travel from the Worlds page** (v1.62, issue #213: "I want fast travel from the worlds page to the world's
  landing only"; `src/fast-travel.js`, `tests/fast-travel.test.js`): a world you have been to (`journal.seen`),
  not the one you are in (a merged world's parts are that world), with the ship powered, has a gold *Travel here*
  tag on its row; in its full view A / × *Travel here* closes the menu and sends the ship there by the galactic
  map's own way (`ship.travel`: the take-off from where it is parked, then the arrival at that world's landing as
  on any arrival, `?level=<id>&via=ship`; the saves as they are; a first flight's pirates never, since it has been
  visited). The leave gates hold (src/story/leave-gate.js, issue #217): leaving the desert without the blade and
  the guard, or Vael without the wings, the ship's own line shows under the button ("Not yet. The Givers' blade and
  the Givers' guard are still in the Rose House.", `.fnote`) and the quest that leads there starts if it hadn't
  (`travel:refused`). Nowhere else: the worlds you have not reached are still found on the holo table's map.
- **Look**: the panel's name in the Start menu's comic lettering among five tabs at the top (four until v1.5); the sheet
  of ruled paper between two side tabs naming the neighbours (their LB / RB glyphs inside them, Q / E with
  the keys; the ✕ carries B / Esc: v1.2, below); the cursor a gold cell in a pulsing red ring; the strip
  at the bottom: the picked thing's name and kind on one line (its words are in its full view since v1.58:
  they covered the item on a handheld), and what the confirm button does here (`menuPrompts`: its glyph and
  the verb, none on a touch screen). Sizes follow the viewport
  (`vh` clamps): 1280 × 720 and the Retroid's 730 × 410 CSS px both fit; a long panel scrolls inside
  its sheet with the cursor.
- **Controls**: LB / L1 and RB / R1 turn the panels (`Controller` sends `tabPrev` / `tabNext` in a
  menu); the stick or the D-pad moves the cursor (`moveCursor`: along a row; off its end onto the side
  tab, once more turns, as on the N64; up / down to the next row with that column, wrapping); A / ×
  opens the thing picked full screen (an item, a keepsake, a sketch, a sighting, a world, a finished quest:
  below), makes a quest the tracked one (`quests.choose`), opens a person's page, or zooms the map round its
  cursor; B / ○ goes back out of what it opened, then closes the whole menu from any panel. Keyboard: Q / E
  or [ ] turn, arrows or WASD move, Enter or Space confirm, Esc or Backspace back, J closes. Mouse: the tabs,
  the side tabs, a click picks, a click on the picked one confirms; hovering picks. Touch: a tap picks and
  says what it is, a second tap confirms; the ✕ closes.
- **The full view** (v1.58, issue #213: "I should be able to press A to see them bigger. The explanation
  should only be present when the item is full screen, and not overlap on top of the item"): `fullHtml`, over
  the sheet on its own paper: Back (B / Esc), the picture large on the left (the item's own render, the
  sketch, the world's picture, the sighting's note; a ? for one not found), and on the right its name, kind,
  "in use", its words, its facts (a world: the story, the
  makers' boxes, the fragments once the first is found, the people met there: `worldFacts`) and its action on
  A / × (`itemUse`: an item's gun mode taken, a gadget taken in hand, the fragment finder switched on or off,
  issue #196; `onUse`). On a narrow or upright screen the picture goes over the words, never under them.
  ← → (or ◀ ▶) the one before and after in the panel, the cursor following; ↑ ↓ scroll the words; B / ○
  back to the panel, on the one shown. Each cell says what it shows in `full` ({ pic, sub, text, facts, use }).
- **The Sightings** (`src/story/sightings.js`, after Outer Wilds' ship log; *their page went with the Sketchbook's in
  v1.62: the save still writes them down*): the open threads the
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
  their world's flat colour) shrunk to 128 px WebP and kept in `localStorage` (`hiraeth.portraits.v1`, not
  per slot: a portrait is not progress), the latest replacing the one before so a new costume shows.
  Someone met before v1.5 gets theirs at the next conversation, or while the page is open in their world
  (`pumpPortraits` in main.js, one a frame, people within 60 m); until then their initial on their world's
  colour.

### The Map (v1.58, issue #205: "a proper map to the current level I can access from select button")

The second panel, one RB / R1 (E) from the Quests where the menu opens, and an entry of its own in the Start
menu: a panel of the game menu rather than a screen of its own, so it opens with View / Select (on Android the
handheld's Select, through native-pad.js like every pad button), pauses the game and closes with B as the rest
of the menu does. Code: `src/world-map.js` (the ground and the marks, pure but for the canvas), `mapPanel` in
`src/game-menu.js`, `mapSource` in `src/main.js`, the Map section of `src/game-menu.css`; tests:
`tests/world-map.test.js`.

- **The ground**: the world's collision sampled straight down on a grid (`HeightGrid`, `Physics.groundAt`:
  the heightfield and every collider, so the city's domes, the temples' walls and the floating islands all
  show; 180 × 180 rays for the whole map, 120 for a zoom), started `MAP.up` (70 m) over the highest of the
  places that frame it, so a dome or a temple room far overhead is left out. The rays run `MAP.budget` (6 ms)
  a frame while the Map shows (`pausedFrame` → `worldMap.pump`; the physics' ground mover is put back after),
  and the map is drawn once into a canvas and kept for the page (`WorldMap`); until then "Drawing the map…"
  and how far. The rectangle shown (`mapBounds`) frames where you land, the ship, the temples' doors, the people
  and every box (opened or not: they frame it, a closed one is never drawn), padded, its short side 160 m to
  1.6 km, inside the world's `limit` where it fits, at the page's shape (below).
- **As wide as the page** (v1.66, issue #272: "draw the map larger (it leaves wide empty margins in the page)"):
  the map is no longer a square. `GameMenu.mapBoxAspect` measures the page's box for it (`.gm-body` inside its
  padding, less the sheet's 10 px shadow, `MAP_SHADOW`) and rounds its width over its height to a tenth, 0.6 to
  2.4 (`mapAspect`, `MAP.aspects`); `mapSource({ aspect })` frames a rectangle of the world that shape, the same
  places at its middle and more of the world to their sides (about 2.1 at 1280 × 720, 1.8 at 1440 × 900, 2.2 at
  the Retroid's 730 × 410, 1.5 at 4:3), its rays `MAP.cells` across the short side and as many more the long
  way, its canvas `MAP.size` (640 px) the short side. The CSS lays the sheet in with container units
  (`width: min(100cqw - 10px, (100cqh - 10px) * var(--a))`, and its height so), so a box a little off its step
  is letterboxed by a few pixels. The menu measures once it shows (the first draw, hidden, is a square; a frame
  later `mapFit` draws it again at the box's shape) and on a resize; a new shape starts the whole map again,
  the cursor on the traveller. `MapView.aspect`: a step of the stick or the D-pad goes as far down on the sheet
  as across, the pick's reach is of the view's height on a wide map, the scale bar about as long as on a square
  one. Tests: `tests/world-map.test.js` (the shapes, the rectangle, the fill at the four sizes).
- **The ink** (`drawTerrain`): five bands of ochre to pale by height, shaded from the north-west in four steps,
  smoothed; contour lines (`contourStep`: 1, 2, 5, 10 … m, about twelve, every fifth darker); the pen's lines
  traced round with marching squares: the steep places (a cliff, a wall, a dome's rim), the edge of the void
  (where a ray finds nothing: dotted paper, the City Floating in Space) and of open water (teal, deeper
  darker; a world's sea, the Underwater City's, is not open water); a double frame, N, a scale bar.
- **The marks** (`mapMarks`, HTML over the canvas so they stay sharp): you (a red arrow turned the way you
  face), the way on (the scout's objective, `nextObjective` without the doorways), the other quests under way at
  their steps (v1.65, `quests`: `Quests.objectives()`, a gold ◇; one at the way on's own place is the way on), the
  people with a quest for you not talked to yet (v1.68, issue #273, `givers`: `Quests.giverMarks()`, a gold ◉ in a
  breathing ring, "the ship heard the light on them", the Map's line `GIVERS_NOTE` under them: docs/systems/story.md,
  "Quests are given"), your
  ship, the makers' temples (at their doors), the people met here, the boxes opened, and the rumours told and not
  found yet (v1.76, issue #340, `rumours`: a soft plum circle on the map's plane, `.gm-area`, round where the thing
  should be but never centred on it, a small ? with the rumour's short name under it: docs/systems/story.md,
  "Rumours"). Something inside a temple's or a shop's room (built far from the ground) is drawn at its door
  (`mapAt`). Never a fragment of the singing light itself (unless Anselm's chart is bought: v1.86, issue #520, a small
  ✧ for each still hiding in the world, kind `fragment`, src/fragments.js `chartMarks`; docs/systems/fragments.md), nor
  a box still closed. No name is written on the map at rest but a rumour's.
- **No list; a cursor, a zoom** (v1.65, issue #244: "using the left stick should move around the map. There should
  be no list under it. I should be able to zoom in and out ... Hovering over an item tells me what it is"): the map is
  the whole sheet. `MapView` (src/world-map.js) holds a cursor (a small ink ring, gold over a mark) and a zoom, 1 to
  `VIEW.maxZoom` (6), in the map's own units; the view pans to keep the cursor `VIEW.edge` inside it and never leaves
  the map. The left stick moves the cursor smoothly (`VIEW.pan`: 0.6 of the view a second at full tilt: the
  controller hands the stick and the triggers to `GameMenu.mapAnalog` each frame in a menu, `menuAnalog`, and keeps
  the D-pad's steps); the D-pad, the arrows or WASD step it (`VIEW.step`); RT / R2 zooms in and LT / L2 out round the
  cursor as far as they are pressed (`VIEW.zoomRate`), A / × twice as close (at the closest, the whole map), B / ○
  the whole map first, then closes; the keys' − and +, the mouse wheel (round the mouse, the map holding still under
  it) and the − / + buttons in the corner (the triggers' glyphs in them on a pad). The mouse moves the cursor, a drag
  (a finger's or a held button's) moves the map, a tap puts the cursor there. The mark under the cursor (`pick`: the
  nearest within `VIEW.pick` of the view, the traveller last) is ringed and named beside it on a dark label, its name
  and one line ("the ship · 12 m south-east"), on the side with room; the strip says the same, else the world's name.
  The scale bar follows the zoom. Zoomed in twice or more and still for 0.4 s, the part in view is drawn again sharper
  (`detailWindow`: half as wide again as the view, on a grid of a quarter view; `mapSource({ detail })` →
  `detail: { canvas, u0, v0, s }`, laid over the whole map's canvas; the last `MAP.keep` kept). Each opening of the
  menu starts on the whole map, the cursor on the traveller. The fragments found here are counted in a corner once
  the first is found (as the Worlds panel does: how many found, never of how many, issue #519).
- **The data** stays as it was for an engine's menus (engine/menus.js reuses `mapPanel`): `mapPanel(data)` still
  returns `{ html, rows }` with a row a mark (`act: 'zoom'`) and takes `zoom` (a mark's id) as before; new and
  optional are `data.span` (m across the whole map), `data.detail`, `data.aspect` (its width over its height,
  v1.66) and the marks' `quest` kind. The engine's own map stays square (engine/game.js asks no shape); the view
  it hands the Unity bridge carries `map.aspect`, and BridgeMenu.cs draws the map at that shape beside its rows.
- Web only: the Unity bridge draws the HUD and the conversation (BridgeHud.cs), never the menus.

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
far, 0.75 s on it), a slow wander, never a shake (`wander`, `WANDER`: a smooth curve of up to 0.3 px faint to 1.6 px locking, at 0.2–0.45 Hz; it was a fresh random offset every frame, up to 4 px, issue #353; none with reduced motion), the light's notes every 1.7 s at most (by
strength), the rumble's `search` beat (soft while the signal is faint: its strength grows with the square of it), and the **meter** at the top right of the chart (the foot of the chart on
a phone held upright): SIGNAL, five bars and a word (silent, faint, warmer, strong, locking). The **lock**: within
`lockRadius` (6 % of the diagonal, at least 30 px or 0.6 of a planet's disc) it fills in half a second (a gold arc
round the scanner), and leaks away at 1.2 a second outside. Full: the planet resolves where it was (blur to sharp,
a gold ring), the `found` rumble, the ship's line, and a second later the map is drawn again with the world
charted and chosen. The legend becomes SIGNATURE SEARCH (`SEARCH_LEGEND`, short form on small screens), the
header counts the signatures to find, and the hint line says how to search on the device in hand.

**Nothing found by itself** (issue #204, v1.58: "it auto found the first planet because of where the cursor
was"). The scanner used to start in the middle of the field (and a pointer released from the game's lock sits
there too), so a world hidden near the middle locked half a second after the map opened. Now each opening puts
the scanner by the ship's own world (`scanStart`: that spot, else the middle, else a ring round it, the first at
least `SEARCH.clear` = 2.5 lock radii from every hidden world, else the farthest), and the lock builds only once
the scanner has been swept `SEARCH.arm` (5 % of the diagonal) since the map opened (`searchArmed`; the cues
still answer before). The mouse's first move after opening only says where it is; its moves count from then on.
Tests: `tests/signature-search.test.js`.

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
  and hatched. Hidden without the battery (and for the desert's dry battery).
- **When**: `healthHud` returns null at rest (the rule "nothing on the screen"): shown while a heart is
  missing, the bar is not full, a fight is on or you are down, and 3 s after; at once on a hurt, a
  knockdown or a drink. `screen.health` (platform.js) carries `{ value, low, hearts, max, magic, magicMax,
  potions, infinite }` (an engine draws it; the Unity bridge still draws the share as a bar).
- **Notices** never cover it: `#health` heads `OBSTACLES` (src/ship/cinema.js), the whole block, potion
  and bar included.
- Checked at 1280 × 720, the Deck's 1280 × 800 and a phone's 812 × 375 (changelog pictures, v1.5).

Tests: `tests/resources.test.js` (the SVG's quarters and lines, the bar, the markup), `tests/hud.test.js`.

## The key counter (issue #274)

"I should have a key counter on my screen. Like Zelda." Inside a temple that keeps keys, top left (`#keys` in
index.html, main.js `updateKeys`, `src/hud.js keysHud`, `KEY_SVG` / `GREAT_KEY_SVG`): a small brass key inked as the
hearts are (an ink outline, a cream glint, the hard drop shadow) and `×N`, the small keys in hand (src/temples/runtime.js
`keyCount`: found less those in a lock; a key still rising out of its chest counts once it arrives); the great key
beside it (a bigger key with a jade bow) once it is yours and until it is in its lock. Shown all the while you are in
the house, at none too (faded), as Zelda's is; never outside, nor in a conversation, a ship's scene or photo mode. It
sits at the hearts' place and moves under them while they show (`#health.on ~ #keys`). On a key more the key hops
and the count swells (`got`). `screen.keys` (platform.js) carries `{ small, big }` for an engine; the Unity bridge
draws "KEY ×N" under its health bar (BridgeHud.cs `DrawKeys`). Tests: `tests/key-chests.test.js`.

## The House map (issue #405, #487)

Inside a makers' house the game menu (View / Select, J) has a **House map** panel after Map (src/game-menu.js
`panelsFor`, `housePanel`, `GameMenu.houseTurn`; the house's view from `sources.house()`, main.js, taken as the menu
opens). Until issue #487 it was a page of the Start menu ("the house map should only be available to the select
menu"); nothing else opens it now. The panel: the house's name, a tab a floor (1F, 2F, B1; a red dot on yours, a tap
picks one), ▲ ▼ beside them, the floor's name, and the floor drawn on a canvas in ink and paper (src/house-map.js
`drawHouseMap`). ▲ ▼ (the D-pad, the arrows, W / S) go a floor up or down, held at the top and the bottom; LB / RB
(Q / E) turn the panels as everywhere in the game menu; ◀ ▶ rest on the side tabs, then turn. It opens on your floor
each time. The strip names the floor and the house. The rooms you have
stood in are solid; once the house's little map chest is open, the rest show faint; before it, only those you have
seen. The traveller, the doors, the great key's and the guardian's are marked; the key along the foot says which is
which. The engines draw the same picture (engine/menus.js `houseKey`, BridgeMenu.cs `DrawHouse`). How the plan is
read: docs/systems/temples.md, "The house's map".

## The Wardrobe (issue #571)

The game menu's last panel, one LB / L1 from the Quests (`PANELS`): the author's "a menu that shows the traveller on
the right side, and on the left side we can pick different sword colours (that we unlocked) and different outfits".
Code: `src/wardrobe.js` (the lists, the save, the preview, the camera and the sword in his hand; `wireWardrobe`, shared by
main.js and engine/game.js), `src/game-menu.js` `wardrobePanel` and `GameMenu.wardrobe*`, `src/game-menu.css`
(`.gm-wardrobe`); tests: `tests/wardrobe.test.js`.

- **On the left**, two lists, a line each (the pack's line: a mark or a swatch, the name, WEARING on the one worn):
  **Outfit**, his own clothes and the five of the v2 traveller (`OUTFITS`, the ids of
  `data/characters/traveller-v2/outfits.json`), each with an `unlock` (null: his from the start; `{ flag }` won: nine
  are the games' prizes since issue #668, docs/systems/minigames.md "Outfits as prizes"; one not his shows its name
  marked ?, dashed, with nothing to do, and under it "Not yours yet · Won at <where>: <what to do>."); **Blade**, the
  colours won (`bladeColours`: src/kit-colours.js, the makers' jade always and one more for each fight temple
  cleared). With B3 (the game's traveller until v2 is the default) the Outfit list is a line, "The outfits need the
  new traveller."; without the sword, the Blade list is "No sword yet.". One column of rows: ↑ ↓ go through both.
- **On the right**, the traveller drawn live: each frame the page shows (main.js `wardrobeFrame` in `pausedFrame`),
  the game's own frame from a camera on him (`wardrobeShot`: his whole height and upright blade, 28°, 4.8 m off), him alone against the
  paper (`captureView` with `keep`, `backdrop` and `into` the page's canvas, the lines at the world's weight). He turns on his own (`Turntable`: 0.32 rad/s, waiting 2 s after a hand turned him); the right
  stick turns him (src/controller.js hands it to the page's `menuAnalog` as `rx`), and so does a drag (mouse or
  finger) on the picture. He holds a separate preview sword blade up in his right fist (issue #586, `PageGrip`, `previewSword`),
  using the body’s fitted `fistGrip` and two-bone arm solver. The hilt rests at waist height and the upright blade stays clear of his face as the camera turns.
  The gameplay sword is hidden while previewing; its equipped/drawn/sheath state and save are untouched.
  `PageGrip.put` restores exact arm/finger rotations and hand-driver state before the next idle pass and when leaving;
  `leave` restores the gameplay sword’s previous visibility. The shared code drives B3 and v2 in both hosts.
- **The preview follows the cursor**: what is saved, with the highlighted line in its place (`previewOf`): on an
  outfit he wears it (the v2 Wardrobe swaps it live: `dress.wear`, one at a time), on a colour the held preview sword
  takes it. **A / × wears it**: saved (`wardrobe.outfit`, `kit.colour.sword` in the save's flags) and on him in the
  world at once (the outfit already on, `applyKitColours` for the sword). **B / ○ closes the menu** and turning to
  another panel leaves it: him back in what is saved, the held preview sword put away (`leave`). The outfit saved is the
  one the world dresses him in as it loads (main.js: the save's, unless `&outfit=` names one).
- **Unity** (engine/menus.js, BridgeMenu.Wardrobe.cs, BridgeRunner.Wardrobe): the same rows and preview; engine/game.js
  draws him each frame the page shows (`wardrobeCapture`: his drawables and the sword's on a layer of their own for
  the portraits' camera, into one picture BridgeMenu shows in its frame). The engines use v2 by default too; when
  explicitly testing B3, the outfits' line says they need the new traveller. The sword beside him draws whole there since its blade's material is
  bound a buffer: the blade and the shield are drawn by the Surface shader's fight variant (HIRAETH_FIGHT), which
  declares the foes' `_SkinData` buffer, and the blade's material had none; Metal skips a draw whose buffer is unbound
  ("requires a ComputeBuffer at index 3"), so the blade drew only in a fight, after a foe's draw had bound one
  (WorldLoader: `NoSkinData`, an empty slot of its own; `tests/wardrobe.test.js`). `-wardrobe -out dir` photographs
  the page, `-wardrobe-yaw r` holds him at r rad round (as the web's pictures pin him) and `-set-flags
  kit.colours.ember,…` gives him the colours the web's pictures have.
- **His light** (issue #578): the world's sun, its colour and direction at that hour and place, but none of the
  world's shadows, wherever he stands (under the ship, against a wall, under a cloud), so the outfit and the blade's
  colour read the same everywhere. `captureView`'s `own` (the Wardrobe's alone): its frame draws the shadow maps with
  `keep` alone round him (`ownShadowPass`: the fine or hero map and the near one, him and the held preview sword; the
  still meshes' batch, which `isolate` does not hide, left out), so his own shadow still falls on him as in the world,
  and the clouds' shadows are off for the picture; every map is drawn again on the world's next frame. In Unity the
  same: BridgeRunner.Wardrobe sets `HiraethShadows.OwnCam` and his renderers, and that camera's shadow pass draws the
  fine map of them alone (`PrepareOwn`), reads no other map (`SetGlobals`) and no clouds' shadows; `EndOwn` after.
  (Before, Unity's preview read the world's maps, the main camera's: under the ship he came out grey.) Without a fine
  map (Unity's handheld presets) no map is read there: the sun alone, where the web's handhelds keep their hero map.
  `-wardrobe-at x,z` sets him down there first (`unity-wardrobe-world.png`), to try it in a shadow and in the sun;
  `tests/wardrobe.test.js`.
- **He is not frozen**: the world stands still under the menu, so he would too; on the page he breathes and looks
  about a little over the pose the menu opened on (`PageIdle`, `PAGE_IDLE`: the chest's breath and sway, the head's
  glances and nod, the shoulders with the breath; the upper body's bones only, turned about his own frame's axes, so
  his feet stay planted), put back as he was when the page is left. The page's `tick` poses him before each picture,
  in both hosts.

## Notices and the quest card (playtest 2026-10-08)

- **Notices** (`#toast`, queued by `Cinema.toast`, `src/ship/cinema.js`) are one short line on a dark strip since
  v1.65 (issue #221: "right now it's a cream colored background, hard to read. also they are too wide, too verbose
  and appear too often"): cream on ink at 90 % (over 7 : 1 however bright the world behind; a button named in it in
  gold, over 4.5 : 1: `tests/notice-pace.test.js`), `--type-s`, at most 32em wide (40 before; 60 % of a phone held
  sideways). The scenes' hint (`#cine .hint`) and the objective card look the same. Under Solid speech background:
  white on black.
- **They come less often** (`src/notice-pace.js`, `NoticePace`): a hint (`{ kind: 'hint' }`: the foes', the
  gadgets' and the hazards' notices, the lessons main.js shows; or any notice naming a control, `{key:verb}`) waits
  `PACE.gap` (20 s) after the last hint went up, while other notices may go ahead of it; one still waiting after
  `PACE.stale` (45 s), or whose `done()` says the player has done it, goes unsaid; with Hints off, none; and the same
  words twice within `PACE.again` (3 min) are said once (a quest's start excepted). A notice cut short by the dark
  comes back as it was.
- **Every hint line is one line**: the `teach.*` and `hint.*` lines, the `quietOr` pairs, the story's `hint()`s, the
  tips and the foes' first-meeting notes at most 72 letters as seen (a `{key:verb}` counted as 3), and a world's
  arrival words at most 112, said alone without the story's title before them (src/quest.js `showPage`): two short
  lines (`tests/hint-lines.test.js`).
- **Never on the hearts**: `#health` (the hearts, the potion and the magic bar) is one of the layout's `OBSTACLES` whether it shows or not
  (it comes the moment you are hurt). `layoutCinema` places a top item centred when it can, else slides
  it sideways along its row to the free span nearest the centre (`slide`: a phone's buttons down the
  right), else the next row down; `Cinema.layout` sets its `left` as well as its `top`. On a narrow
  portrait phone the cue sits below the hearts and the magic bar (62 px down) until the stack places it. Tests: `tests/hints.test.js`.
- **A quest's start looks different**: `Quests.startToast` (and the villagers' errands, `Errands`) call
  the toast with `{ kind: 'quest', head, title, step }`; the queue keeps it, and the toast is drawn as
  `questToastHtml`: **one short line** on a dark strip, the quest's mark (a gold ◆ for a main quest, a pale ◇
  for an errand: `head` says which) and its title in italics, the first step after it when hints are full
  (`#toast.quest`, index.html). It was three lines, "◆ New quest" in gold capitals over the title and the step
  (the author's playthrough, October 2026, issue #72: "too much visual noise"). Every step of every quest is a
  few words since then (at most 9: `tests/quest-steps.test.js`; the quest QC skill). Later steps, endings and
  every other notice stay plain.

## Hints: one look, one place (issue #306)

The author: "All hints and quest announcements should be with a black or dark black background … sometimes I see hints
at the top of the screen, sometimes at the bottom. They should only be one way of doing it." The notices, the quest
card, the objective card and the scenes' hint were dark strips at the top; the cue (lessons, the scout's find, Plumb's
word, the use button with nothing to float over), the floating prompt and photo mode's keys were cream paper at the
bottom. Now every one of them is the same strip and, but for the floating prompt, in the same place:

- **One look** (`src/hint-look.js` `HINT`, index.html's `--hint-bg` charcoal at 96 %, `--hint-ink` cream,
  `--hint-accent` turquoise for a button's name, `--hint-radius`): `#toast` and `#toast.quest`, `#objective .t`,
  `#cine .hint`, `#cue`, `#prompt`, `#photo`, `#controller-hint`. A button's badge on the strip is cream with the ink
  letter. A region's name stays letters on the land (a title, not a hint), the button alone (hints subtle) a glyph.
  Solid speech background: white on black.
- **One place**: the top centre. `Cinema.layout` stacks the cue first, then the notices, the scenes' hint and the
  objective card in the order they came (`layoutCinema`, round the hearts, the buttons, the letterbox); the cue calls
  it as it shows (`Cue.onChange`), so nothing slides under it. The top because most were there already, the bottom is
  the speakers' (subtitles, the conversation panel, a phone's buttons), and a phone already had the cue up there. Photo
  mode's line is there too (a pad's line instead of the keys' when one is in hand). The use prompt floats over whoever
  it is about, in the same look, and over whatever it is about (issue #350, v1.75: "the button prompt for the voicemail
  is at the top of the screen instead of being next to the machine"): aboard, the ship's E was the cue's line at the
  top; now `Ship.promptTag` gives its words and the point they float at (beside the voicemail button, over the holo
  table's planet, in the hatch; the prologue's walk to the voicemail too), and the story's floating prompt shows it
  (`rt.extraPrompt`, src/story/index.js, over a person's: E is the ship's there), in the web game and the engines
  (engine/game.js). The desert observatory's lens floats over its dial. The cue keeps only what has nothing to float
  over (a scene's own E, the flute you hold). `tests/ship.test.js`, `tests/engine-ship.test.js`.
- **The Unity bridge** (`BridgeHud.cs`) draws its toast and cue the same: the strip's colours (`HINT_ENGINE`), the
  cue at the top and the toast under it.
- Tests: `tests/hint-look.test.js` (every kind on the variables, nothing cream left on them, the top for all but the
  prompt, the stack's order, the bridge's colours).

## The notices' order (issue #78)

Stepping out of the ship for the first time, the ship's line, the objective card, Marrow's call, the camera's lesson
and the desert's opening words all came up within a few seconds. Now everything that writes on the screen by itself
takes its turn, one at a time (`NOTICE_ORDER`, `noticeMay` in `src/ship/cinema.js`; `tests/notices.test.js`):

0. **the father's charge** (`#charge-card`, lettered over the crash site), the scene's own title: one line since v1.65,
   "✦ BRING BACK SOMETHING OF VALUE" (issue #222: "your father's charge, something of value, bring back something of
   value ... always should have only 1 line about the objective"; it was a kicker, a title and the quote), and no
   objective card after it ("why do we have this and another objective card ... right after"): the way on is Marrow
   by the ship, his balloon and the scout;
1. **the region's name** (`PlaceName`, on the cue), first on arriving and on every load: it settles while the scene
   plays (`hold`) and the others wait for it (`waiting`);
2. **a line** outside a scene (the ship's word and his answer as you step out: `Cinema.say` holds it);
3. **the objective card** (`Cinema.objective` holds it in `_objPending`): one line, the step itself after a gold ◆, on the
   notices' dark strip, no "OBJECTIVE" over it and not tilted (v1.65, issue #222; a homecoming's "Follow the light to the
   Signal Market's silent tower");
4. **the notices** (`#toast`), each for its full time before the next (they used to overlap at 58 %);
5. **a lesson** on the cue (`src/first-steps.js`), a nudge (the scout's auto-ping), a caller's balloon or an idle
   greeting balloon (`Cinema.noticeBusy()`).

Each waits while another is up and while one ahead of it waits. Not notices: a prompt, the scout's find (asked
for), a conversation, anything inside a letterboxed scene. The crash's objective card is the desert's opening words,
so they are not said again as a notice (`Story.start({ quiet })`), and a makers' box given in a talk
(`background`) starts without a quest card (the Quests page lists it).

## Nothing slanted (v1.65, issue #222: "make sure nothing is slanted in the UI")

No panel, card, tag, stamp, heading or portrait is drawn tilted any more: the few degrees of `rotate()` the paper
sheets had (the pause menus', the game menu's tabs, the people's cards, the story page, the restart card, the shop,
the minigames' boxes and stamps, the box card, the stamina wheel, the gadget chip) are gone. Turns that mean
something stay: a 45° diamond, a quarter or half turn, an arrow turned the way you face, a spinner, the potion tilting
as you drink, the title's cape in the wind. `tests/no-slant.test.js` reads every style.

## Screen sizes (resolution audit, 9 October 2026)

Checked at 1280 × 720, 1920 × 1080, 2560 × 1440, 1280 × 800 (Steam Deck), 812 × 375 (a phone on its side),
375 × 812 and 1080 × 2400: the title, the HUD, the pause menu and its settings, a conversation, the journal
and its Worlds page, with a script listing text off screen, cut, or under 10 px. In src/menus.css: the pause
menu's side is compact at `max-height: 480px` in landscape (smaller PAUSED, the save on one line, 12 px
buttons: all of them show, down to Quit to title), its buttons are smaller on a phone held upright (the
settings get the screen), and PAUSED is sized by the width too (`min(7vh, 8vw)`: it ran out of its column on
tall narrow screens). The journal's (src/game-menu.css) smallest words have a 9-10 px floor, and the title's
"Continue" world name at least 11 px. Still open (TODO.md): the touch controls' size on a phone held sideways.

## Type (issue #128, v1.51)

One face for what a player reads, named once in index.html's `:root` (and in `src/typefaces.js` for canvases
and for styles shown outside the game's page):
- **`var(--face)`** (`FACE`): Avenir Next, then Futura, Helvetica Neue, Roboto (Android, the Deck). The cue,
  the prompts, the notices, the balloons, the conversation panel, the item card, the gadget chip, the restart
  card, the minigames and trials (their cards, HUD and labels), the settings, the game menu, the shop, the
  ship's scenes and map, the button glyphs. Numbers are in it too, `font-variant-numeric: tabular-nums` where
  they count (a timer, a score, the chimes, the potions).
- **`var(--face-title)`** (`TITLE_FACE`): Futura heavy, for names and headings: PAUSED, a game's title and its
  score, the 3-2-1, the item's name on its card, a name board, the warp's title.
- **`var(--face-mono)`** (`MONO_FACE`): only the debug and dev panels (the Debug menu, the dev menu, the foe
  spawner, the hitboxes, the input display, the References, the frame-time readout) and a machine's screen in
  the world (the ship's console, the Arcade's score board). `tests/typefaces.test.js` lists these and fails on
  a monospace anywhere else.

Sizes follow the screen's height, as the conversation panel's `--dlg` (2.9 % of it, issue #147):
`--type` (2.4 %, 15–36 px: the cue, a notice, the restart card, the story pages' hint, subtitles) and
`--type-s` (1.9 %, 13–28 px: the prompts, the item card, the minigames' cards, the settings, the game menu).
Both include `--ts`. A component's other sizes are in `em` of these, its boxes too (a notice at most 40 em
wide, a game's card 34 em), so a 1440p screen gets the same layout as a 720p one, larger.

**Buttons follow the screen too (issue #150).** A button's letter is sized from the screen's height, not from
the words round it: `--type-key` (2.2 %, 14–34 px) is the round badge's (`.key`: the use prompt, the cue; the
use prompt's button alone, hints subtle or off, is 1.15 of it), and `--glyph-min` (1.6 %, 11–24 px) the least a
glyph inside a menu's or a card's button is (`src/pad-glyphs.js`: `max(--glyph-min, .68em)`, 10 px on a page
that sets none; the title screen sets 10 px: its words are in px of their own). Measured in headless Chrome, the
use prompt's badge: 28 px round on the Retroid's 730 × 410, 32 at 720p, 35 on the Deck's 1280 × 800 (23 before),
64 at 1440p; a card's A 21 / 22 / 24 / 43 px. The conversation's answers keep their badge in em of `--dlg`; with
a pad in hand, a page that a press turns shows the confirm button on the panel's bottom edge beside the red
pointer (`.dlg-next`, as the name sits on its top edge). `tests/prompt-scale.test.js`.

The conversation panel's scripts (`src/story/scripts.js`) drew each word `n ch` wide while the panel was mono;
now `setWordMeasure` (set by the dialogue, a canvas in the panel's face) gives each word its English width in
`em` (bold inside a highlight), so a word still turns into English without moving the line. Without a canvas
(node's tests, tools/tongues.html) a word is still `n ch`.


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
- **Qualified comparisons:** an `audit-scores` block may include `comparison: <reason>` when
  a changed rubric, reviewer method or display precision makes a numerical delta misleading.
  The dashboard and All audits cards show that explanation, retain current and historical scores,
  and omit difference arrows and cross-version trend lines. Comparison tables retain the values
  without numerical deltas. Comparison explanations wrap within narrow cards. Cinematic id prefixes
  are labelled "Scene groups" because they mix worlds with arrival/finale and other scene families.
  Diagnostic priority/rank columns are not quality scores, and visual
  coverage counts are not severity findings. The frozen v1.90 review uses these qualifications
  for the unchanged weighted game result, reassessed combat and separate 0–3 creature rubric.
- **Historical parser coverage:** the dashboard tests explicitly freeze reports through v1.87 and
  its 119 verdicts in a compact test fixture. Separate current-publication checks cover all 17
  v1.90 report kinds and the 111 live cinematics plus separately judged trailer.
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
- **Score tables, for the skills that write reports:** Markdown tables with one row per item (a theme, a world,
  a temple, a foe kind, a view…), the 1-5 scores in their own columns, a "total" or "Mean" column for the
  row's mean, a change by eye as `4 ✎3`, before and after as `2 → 3`, and the earlier version's column beside
  this one's (`v1.49 | v1.53`) where the report compares. The page compares rows by name and columns by
  header with the last report's, so keep both the same from one report to the next. A report with no
  overall score (performance, visual) writes `overall: none` and a one-line `headline:` instead of `label:`.
  Add the report to `docs/README.md`'s audits list. `node --test tests/audits-page.test.js` checks the block.

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
  tabs; the strip keeps the confirm button's verb only, `menuPrompts`; A on the cursor's quest to track it), the galactic map (B in close, A in
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
  `hiraeth.padFamily.v1`); else the platform's (`platformFamily`: the Deck's app, `hiraeth:`, Steam's
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
- **Anselm Thrum's shop** (v1.62, issue #185: his upgrades for fragments of the singing light, docs/systems/
  fragments.md): the same panel, opened by his "Show me what you have" aboard (`shop:open` { shop: 'thrum' }, the
  entry from `storyRt.scientist.shopEntry()`, `kind: 'fragments'`). The wallet is the fragments you hold (a pale
  splinter, `FRAGMENT_SVG`, not the chime), the prices are in fragments, the cards are his seven upgrades
  (`upgradeWare`: the name from src/items.js, a line of what it does, `thrum.<id>`; the picture the items page's own
  render once drawn, `itemIcons.pump` while it is open, a fragment until then); one already had says *Fitted*, one
  whose gear you lack *Needs the blade first* (the battery, the wings, the guard), one too dear *Not enough fragments*,
  and choosing it makes him say so (`THRUM_SHOP_LINES`, src/story/scientist-data.js). The question: "Light chamber:
  buy it for 10 fragments?"; bought, the light's rise (`sound.fragmentTaken`), no bell and no coins.

Tests: `tests/shop.test.js` (the markup, the states, the question, the keeper's reactions, the wiring).


### Sound effects diagnostic (v1.98)

Developer controls → **Toggles → Sound effects** enables the opt-in source panel.
It shares `screen.sfxTrace` between the web and Unity HUD: recent sound occurrences,
playing loops, source labels and mute status. It never changes the sound mix.
See [audio.md](audio.md#developer-sound-source-overlay) for provenance and trace scope.


### Enamel hint panels (approved direction C)

The shared hint family uses a charcoal fill, thin inset cream frame and turquoise left tab,
with the existing typeface and ivory control badges. Quest announcements show their existing
category above their title; their automatically suppressed step remains empty. The requested
quest direction remains its single existing step. This is a rendering change, not new advice:
Plumb, notice priority, timings, prompts and quest progression retain their owners.

`src/hint-look.js` supplies the web/engine palette. The browser uses the existing HUD selectors;
`BridgeHud.Hints.cs` caches one frame/tab per Unity panel. Region names and glyph-only prompts
have neither decoration, and solid speech mode remains plain black and white. Larger text and
narrow windows wrap; a Cue size observer reflows the following notices and disconnects when
disposed. `screen.toast` carries only existing quest kind/head/title with an empty step;
the engine queue retains that metadata during dialogue interruption/replay.

Validation uses explicitly staged presentation states through the actual Cue, Cinema and
context-prompt renderers, with muted private stores. These pictures demonstrate HUD appearance,
not earned quest or traversal outcomes. The approved concept is design provenance only;
actual browser and Unity pictures are the release evidence.

The enamel C panels separate the existing quest mark or controller badge from left-aligned words with a fine divider. Quest panels have a modest brass rivet, a capped horizontal minimum width and growing height for wrapped text; no title is invented for the scout’s one-line result. Unity uses the same column layout with normal-weight local hint text. Plain solid, place and glyph modes retain their existing exceptions. These are presentation choices, not completion-state inference or additional automatic advice.

### One look for every message (issue #687)

The author: "I would expect all HUDs to be matching our new in-game HUD design." Every message the screen shows uses the
enamel of directions C (the hint strips) and D (the conversation panel): `src/hud-look.js` holds the tokens (`ENAMEL`:
C's charcoal strip, D's dark panel, ivory words, a brass hairline and brass labels, ivory key badges with dark letters,
turquoise for the main button's tab and good news) and index.html's `:root` carries them as `--en-*` (`ENAMEL_VARS`).
Modules whose CSS is written in JavaScript build their boxes with `enamelCard()` (a card: the father's charge after the
voicemail, the subtitles, a makers' box's card, the warp's title, a game's words over a person, the fishing catch and
journal, the sketch hunt's list) and `enamelStrip()` (a strip: the skip tags, a game's tags, the fishing prompt, the
sketch hunt's reading, the drums' socket keys, the gadget wheel's name); index.html (the knock-out card, the balloons)
and `src/minigames/kit/minigames.css` (the start, pause and results cards, the clock and score, the flashes, the 3-2-1)
use the variables. The charge keeps its single line (issue #222) with the ✦ in a column of its own behind a fine divider;
the plain speech setting keeps black and white. Gauges (the fishing meter, the hearts, the magic bar, the stamina wheel: since
issue #710 an enamel ring of its own, `STAMINA_RING`, docs/systems/movement.md),
the region's name lettered on the land (C's own exception), the sketch hunt's viewfinder and full-screen menus are not
messages and keep their looks.

`HUD_MESSAGES` lists each message, its file and selector; `tests/hud-look.test.js` reads each rule and fails on one not
built from the tokens or still on cream paper with a hard offset shadow. Unity draws the same from
`BridgeHud.Hints.cs` (`EnamelCard`, `EnamelStrip`, `EnamelPaint`, the `En*` colours): the charge, the subtitles, the
skip, the warp's title, the knock-out card, the box card and its skip, the balloons, the chips, a game's clock, score,
flashes, 3-2-1, words and tags, the drums, the sketch hunt and the fishing, and the game card in `BridgeMenu.cs`.
`engine/ui-poses.js` has `charge`, `voicemail`, `restart`, `boxcard`, `chips` and `toast` for `-ui` pictures.

### A card's prompts and the item card (issue #695)

The author, on the box card's cream "[Enter] Continue" pill: "I don't like the extra padding, border and different color
for the button, just show me the button and what it does next to it", with Breath of the Wild's item card for reference.
A button on a card is now a prompt: the button's glyph (`src/pad-glyphs.js`: the pad's own as an ivory disc with its
letter, the key's outline, nothing on touch) and the word after it, in the card's own ink, small, at the card's bottom
right, with no fill, border or padding. It stays a `<button>` (a click, a tap, the focus). `enamelPrompt(sel)` in
`src/hud-look.js` writes the style; `HUD_PROMPTS` lists the box card's Continue, the knock-out's Restart and a game's
Start / Resume / Retry / Quit / links, and `tests/hud-look.test.js` fails on one boxed again. A game's buttons carry the
button that answers each (`promptRole` in `src/minigames/kit/flow.js`: Enter / A the main one, Esc / B Quit where back
quits, R / Menu Retry on the results, [ ] / LB RB the Arcade's links); the line of keys under them went. Where a card has
several, the one a pad is on is underlined (issue #507's one mark), and a pad on another button hides the main one's A.

The box card follows the BotW card: the item's picture at the left in a paper disc with a brass ring (the Items page's
own, `public/item-pictures/<id>.webp`, `itemPicture(id)`; none rather than an invented one for a find without one, a
temple's map, where the makers' star stays before the name), its name, a brass hairline, its one line (`itemLine`), and
the prompt at the bottom right. Like BotW's it is about half the screen wide (`min(46vw, 720px)`, never past the screen
less 24 px; the author: "Why is it so narrow and with so little padding?") with generous margins (1.2em 1.6em, a 6em
picture, 1.2em between it and the words), its CSS in `src/hud-styles/box-card.js`. It keeps the enamel panel of every other card. `cardState` carries the item's `id`;
Unity draws the picture from `BridgeMenu.Picture(id)`, the prompts with `BridgeHud.CardPrompt` (BridgeHud.Hints.cs) on
the box card, the knock-out and the game card (BridgeMenu.cs).


### Public title and administration

The web title keeps play, saves, settings and fullscreen. Its changelog and Debug
entrypoints are in `/admin/` (see `analytics.md`), protected by the notebook
password, and on the title itself in dev mode (L3 + R3 on the title, above). `src/dev-gate.js` defaults developer entries off in production; explicit
dev mode and local builds still expose development tools. The native title already
uses play/saves/settings and its native update control.
