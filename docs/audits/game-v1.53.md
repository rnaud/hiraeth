# Hiraeth against what makes a great game (October 2026, v1.53)

<!-- audit-scores
overall: 4.0 / 5
label: the twelve themes, weighted (themes 3-8 count double)
date: 2026-10-12
-->

The fifth audit against the twelve themes of
[what-makes-a-great-game.md](../what-makes-a-great-game.md), run with the `game-audit` skill
(`.claude/skills/game-audit/`). It follows [the v1.49 audit](game-v1.49.md) by four releases and 97 commits,
over one day. What landed:
- **The v1.49 list:** the quest log's hand-offs, the temple guides' night, one-line guardian notices, the
  jets' row, a trial that waits for its gadget, the hollow veiled lock, worlds seven to twelve pointed at the
  end, the type split, a fast title and the level design audit rerun (#118–#128, all closed).
- **The author's own Desert playthrough** (#149, #153–#162): a clear first sky, the first chest on a dais at the
  tree's foot, the skull facing the city with no prompt, a drain you clear yourself, the makers' shrine after the
  full pool, every major chest on a ramped mound, the ship's own music in the prologue, no animals in Qanat.
- **Plumb,** the drone, with a name, four opening lines and a lost-watch that points the way (#152).
- **The explorations** the author picked: the Desert's giants' road, walking dunes and memory of water; the
  Glass Dunes' trapped time and sunken city; the Buried Machine breathing; the City-Shaft's quarters and its
  light going down (#164, #166–#169).
- **The finale's approach and the galactic map:** the Lantern's light in every sky from the seventh world, the
  father's window line by line, the market's silent tower as the goal after Home, and a map that is one star
  with the route on orbits outward (#127, #129).
- **Words and screens:** conversations at about 3 % of the screen's height with the page whole at once (#147),
  button glyphs sized from the screen (#150), one short description an item (#165), the scout's button taught
  once (#151), names a player can keep apart (#141).
- **Devices:** the Unity preview at about 60 on the Steam Deck (round 7) and on the Xbox (Direct3D 12, vsync,
  59.5 fps at the 1440p spawn).

**Evidence:**
- two read-only surveys of the code against every v1.49 finding, theme by theme;
- three capture passes in muted headless Chrome: the default plan; a second plan for the Glass Dunes, the
  Buried Machine, the Underwater City, the Moon Foundry, the City Floating in Space, Viridel, Lorn, the Garden of
  Spheres, the galactic map and four views in the Desert's new country; a third with a save that has the father's
  charge, to settle the card question v1.49 left open;
- the audits since (level design v1.49 and its v1.52 recount, ink lines v1.53), `docs/systems/performance.md`
  and `docs/systems/xbox.md`, and the last 30 test runs on `main`.

**What is not verified:**
- **No outside playtest,** for the fifth audit running. The author played the Desert through, which gave a whole
  batch of fixes (#153–#162); nobody else has played v1.1–v1.53.
- **Never heard.** Every run is muted. The ship's new score (`src/score.js:268-276`) is checked by its test
  (`tests/prologue-music.test.js`), not by ear.
- **The Unity previews were measured, not played:** they have no menus or conversations yet (`src/changelog.js`,
  v1.51), so their 60 fps is a picture's speed, not a game's.
- **The new explorations are unmeasured.** The level design recount (v1.52) came before the Desert's v1.53
  country, the Glass Dunes' city and the Buried Machine's keepers' way.
- **The settings page wasn't captured:** the title's Settings is an icon now, so the plan's text match missed it
  (capture `03-title-settings-0` shows the title). Settings were checked in the code (`src/ui.js`).
- **The galactic map was seen once,** from the Buried Machine with eight worlds done (capture `40-starmap-0`).

**What is verified:**
- every capture booted without a page error or console error;
- boot times, on a loaded Mac (load 20–30 during the first pass, so slower than v1.49's): the desert 4.0 s (3.5),
  Vael 5.7 s (3.8), the City-Shaft 6.1 s (4.0), the Buried Machine 5.3 s (3.4), the new worlds 2.3–2.5 s
  (2.3–3.1), the Glass Dunes 4.8 s (2.0), Home 1.8 s, the Lantern 1.9 s;
- **the title paints at once,** a drawing of the game with no world behind it (capture `01-title-new-player`;
  `src/title-paint.js:1-5`);
- **the Desert opens under a clear sky** (capture `10-desert`; `src/levels/content.js:180`);
- the ship's idle nudge still shows ("Look around: move with WASD, look with the mouse", capture `02-new-game-1`);
- **the arrival card and the place name don't collide in play.** With the father's charge already given, the
  Glass Dunes and the Lantern open with the place name alone (captures `50-glassdunes-saved`,
  `51-lantern-saved`). The overlap v1.49 noted is a direct boot's, as it guessed;
- **the galactic map reads as a system:** the star at the left, the route outward orbit by orbit, the Moon
  Foundry round the Buried Machine, the next place marked (capture `40-starmap-0`);
- `main` is green: the last 30 test runs all passed (11 October 21:15 to 12 October 04:32, UTC).

**In progress, not counted:**
- the third round of the temples (#23);
- the script-time work, the per-frame JS on the Deck and the Xbox (`performance.md`, round 7, "What is left").

## The scores

| # | Theme | v1.49 | v1.53 | In one line |
|---|---|---|---|---|
| 1 | Core experience and coherence | 3 | 3 | The off-key words are gone; breadth grew faster this round than any before it |
| 2 | The first five minutes | 4 | 4 | A title that paints at once, a clear first sky, the ship's own music; the fill is the 6th of 17 stages |
| 3 | Exploration and wayfinding | 4 | 4 | Measured again (4.35, 4.55 recounted), the high places pull; the newest country is unmeasured |
| 4 | Rewarding exploration | 4 | 4 | The trial waits for its gadget, the mirrors pay a charm; most of the new country pays in sights |
| 5 | Narrative and harmony | 4 | 4 | No "Ask X" in the log, the guides' night their own; ten steps still send you back to tell someone |
| 6 | Arc and pacing | 4 | 4 | Worlds seven to twelve pull toward the end; the Desert grew to 17 stages and the peak is unchanged |
| 7 | Art direction | 5 | 5 | One typeface on the player's screen, the new country in the style, ink lines 4.72 |
| 8 | Audio | 4 | 4 | The ship has its own score; foes still unplaced, the main theme still synthesised, never heard |
| 9 | Game feel | 4 | 4 | The camera at Sable's framing, no flick past a door; the legs still 11 of 15 red |
| 10 | Combat | 4 | 4 | The veiled lock is hollow, not faint; the camera and lock-on, at 3, unreviewed since |
| 11 | Accessibility and UX | 3 | 4 | One-line guardian notices, type and glyphs sized from the screen, short item cards; English elsewhere |
| 12 | Quality, performance, discovery | 3 | 3 | `main` green 30 of 30 and 60 in both Unity previews; the shipped web build still about 40 and 20 |

Weighted (themes 3–8 count double): **4.0 / 5, up from 3.9.**

Theme 11 is the one that moved: two of its three weaknesses at v1.49 went (the paragraph notices and the settings'
stray rows), and text now follows the screen's size. The others held, most with better insides:
- theme 6 lost its oldest fault, the five worlds pulled on by the voicemail alone;
- theme 12 lost the red `main`;
- theme 3 was measured for the first time since v1.23.

What holds them back has changed shape. Nobody else has played it, as before; but this round's breadth also came
in faster than ever (about 221,500 lines of `src`, from 214,700: four worlds' explorations in one day), and the
newest of it is unmeasured.

## What happened to the v1.49 investments

| # | Investment | Status |
|---|---|---|
| 1 | Watch three people play | **Not done**, fifth audit in a row. `TODO.md:8` still reads "Playtests are not listed here: the author plays all the time." The author's own Desert playthrough found eleven things (#149, #153–#162), which is the case for strangers |
| 2 | The quick word fixes | **Done.** No "Ask X" in any `*-data.js` and the clod moves before Esk (`src/story/terraces.js:340-342`; #118). Each guide names its own night (`src/temples/underwater-data.js:31`, `perdide-data.js:29`, `buried-data.js:17`, `bazaar-data.js:30`; #119). All 81 guardian notices under 140 letters, the longest 94 (#120). The jets' row hidden until the jets, the developer rows last (`src/ui.js:328, 354-356`; #122). Four small slips remain (theme 5) |
| 3 | Measure what was built | **Mostly done.** The level design audit on all twelve route worlds, 4.35 (`docs/audits/level-design-v1.49.md`; #124), recounted at 4.55 with "raised" read over the ground (#138). The Deck measured on the Deck (`performance.md:1800-1812`). Not measured: the explorations built after it |
| 4 | Keep `main` green, clean `TODO.md` | **Partly.** `main` green: 30 of 30 runs passed (8 of 20 red at v1.49), after the crowd test's own clock (b55b485e). `TODO.md` went from about 30 stale items to 8: #9, #37, #38 and #134–#138 are closed and still listed |
| 5 | Point the late worlds at the end | **Done** (#127). The Lantern's light in every sky from the seventh world (`src/story/lantern-sky.js:14-16`), the father's window one line a world (`src/story/calls.js:192-209`), the silent tower as the goal after Home (`src/story/ending.js:123-131`) and on the map |
| 6 | The rest of the language layer | **Not done.** About 301 literal toasts and notices (277); "GO!" (`src/minigames/kit/runner.js:128`) and "RT / R2" (`src/trials/index.js:44-45`) still literal. The author has since said not to file localisation, so it is noted only |
| 7 | The Deck's and the Xbox's processor time | **Partly, by another road.** The Unity previews reach about 60 on both: the Deck 58–59 at 60 Hz with vsync (`performance.md:2012-2023`), the Xbox 59.5 with 97 % of frames on time (`docs/systems/xbox.md:392`). The web build players have is unchanged: the Deck 36–57 fps, its JS 24–27 ms; the Xbox about 20 (`xbox.md:691-695`) |
| 8 | Small finds and states | **Done.** A trial waits for its gadget (`src/trials/course.js:56-64`; #125); a veiled lock's arrows go hollow (`src/lock-reticle.js:59-64`; #126); one typeface (#128, theme 7) |

## 1. Core experience and coherence: 3

**Better**
- **The off-key words are gone:** the four guides' "sky rang", the log's "Ask X", the jets nobody can have.
- **The new country belongs to its world.** The giants' fourth verse points on toward Lorn's swamp of lights
  (`clue.desert.perdide`); the dry salt pan floods when the tree drinks (`src/story/desert-water.js:14-16`); the
  Buried Machine's keepers' log answers the Wick. Each exploration is tied to its world's quest, not laid beside it.
- **Plumb has one voice:** four terse opening lines, each said once, and a hint setting (`src/companion.js:39-58`).

**Weak**
- **Breadth grew faster than ever:** about 221,500 lines of `src` (214,700), some 3,300 of them new files for the
  explorations (`desert-giants.js`, `desert-dunes.js`, `desert-water.js`, `glass-dunes-city.js`,
  `buried-breath.js`, `shaft-quarters.js`, `shaft-mirrors.js` and others). The author picked them; but the freeze
  three audits have asked for went the other way, and none of it has been measured or played by anyone else.
- **`TODO.md` lists eight items whose issues closed** (#9, #37, #38, #134–#138). The test that keeps it tidy only
  catches items `DONE.md` already lists.

## 2. The first five minutes: 4

**Better**
- **The title paints at once:** a drawing of the game's own render with the name, no world, no WebGL
  (`src/title-paint.js:1-5`; capture `01-title-new-player`; #110).
- **A clear first sky:** no sandstorm until Qanat's first chest is opened (`src/levels/content.js:180`; capture
  `10-desert`; #139).
- **The ship sounds like the ship:** a quiet score of its own while you wake, nothing under the father's message
  (`src/score.js:268-276`; #149).
- **The first chest is the first chest:** a temple chest on a white dais at the tree's foot, on a ramp, not up the
  tree (`src/boxes/placements.js:48`; #140, #162).
- **The skull cave is clearer:** no prompt before the skull (#155), a heap of debris you clear yourself (#157,
  #158), and the shrine's door opens on the full tank (#156).
- **The scout's button is taught once,** after the first conversation (`src/scout-hint.js:17, 24`; #151).

**Weak**
- **The first fill is still the 6th stage,** now of 17: the makers' shrine door added one after it
  (`src/story/desert-data.js:96-98`). The middle is quicker (no lever, no skull prompt), but it is the third audit
  to name it.
- **Debug is still on the title** for a first-time player (the bug icon, capture `01-title-new-player`;
  `src/dev-gate.js:14`), the author's call.

## 3. Exploration and wayfinding: 4

**Better**
- **Measured at last:** the level design audit over all twelve route worlds and their temples, 4.35, and 4.55 once
  "raised" was read over the ground a place rises from (`docs/audits/level-design-v1.49.md:58-85`).
- **Its fixes are in:** the high places pull (a hill path, a sphere and a bell to the Garden's belvedere; the kiln's
  smoke and amber posts to the Glass Dunes' cairn; #134), the Buried Machine's canyon stack and rope (#136), Lorn's
  keepers' stakes (#135), Vael's bird bones and smoke (#133), Viridel's spire from Mira's (#131), and the walks home
  from the temples past something new (#132).
- **The galactic map is a system:** distance on the chart is how far along the route a world is, and the next
  place is marked (`src/ship/system.js`; capture `40-starmap-0`; #129).
- **The new country gives the Desert's long rides something to see:** the giant's hand from the ship's ramp, the
  arm across the dry wash, the sand rivers the bike rides fast, the mirage over the salt pan (capture
  `42-desert-arm-0`, the sand river).

**Weak**
- **The newest country is unmeasured.** The recount came before the Desert's v1.53 explorations, the Glass Dunes'
  city and the Buried Machine's keepers' way. The Desert is still verticality 3 (one raised place in 53,
  `level-design-v1.49.md:64`) and its onboarding 3 (`:94`).
- **The drone still never points at relics,** by design: Plumb's lost-watch points at the goal only
  (`src/scout.js:104`, `src/companion.js:152-160`).

## 4. Rewarding exploration: 4

**Better**
- **A trial waits for its gadget,** and its card no longer describes a tool you don't have (#125).
- **The City-Shaft's mirrors are a real find:** crank them, the light goes down the shaft, and a makers' chest opens
  with a charm (`src/story/light-down.js`; `src/boxes/placements.js`, `incal.sunglass`).
- **The memory of water is a small mystery the main quest answers:** the wells' voices grow nearer well by well,
  and the pan floods when the tree drinks (`src/story/desert-data.js:955-958`).
- **The giants' verses** tell a story read from Qanat outward, and the last points to the next world.

**Weak**
- **Most of the new country pays in sights:** the Glass Dunes' city and the wave give a toast each, the Buried
  Machine's keepers' way a log, the dunes' ruins a look. That suits the brief's wonder, but it is breadth that
  changes nothing you can do.
- **A promise not kept:** the uncovered doorway's "Its stair goes down into the dark" (`desert-data.js:918`) leads
  nowhere, and the ruins' `desert.ruin.*` flags are read by nothing.
- **The rewards are still numbers** (`src/trials/upgrades.js:20-32`), the new sunglass charm too (the pen's bridges
  last half as long again, `:39`).

## 5. Narrative and harmony: 4

**Better**
- **The log no longer sends you to people:** no "Ask X" left in the quest data; the steps that name a person and a
  place stay, by decision (#142), and so do four gates that wait on a person (#143).
- **Each people names its own night,** the City-Shaft alone keeping "the sky rang".
- **The chest is the same everywhere:** one major chest on one ramped mound (`src/boxes/mound.js`) in Qanat, the
  shrine, the Hearth, the mirrors and all thirteen temples; the coffers may differ (#144).
- **Names a player can keep apart:** the Rose House, Brune, Yusuf, Halden, Petra, Ines, Liesel (#141).

**Weak**
- **Ten steps send you back to tell someone after the goal is reached:** "Tell Mira what you saw", "Tell Esk the
  cutting is in", "Tell Rue what is on the crown" (`src/story/edena-data.js:54, 86, 103`), "Tell Brush what the sign
  says" (`bazaar-data.js:58`), "Tell Ket what the gauges say" (`buried-data.js:62`), "Tell Perrine the mirror faces
  up" (`incal-data.js:72`), "Tell Wendel…", "Tell Ivo…" (`perdide-data.js:49, 57`), "Tell Hollin…"
  (`perdide2-data.js:61`), "Tell Cael you walked it" (`spheres-data.js:62`). Against "reaching the goal completes
  it". Neither decision (#142, #143) covered them.
- **Four slips:**
  - the Buried Machine's arrival still says "Ask Wen, by the great dome." (`src/levels/buried.js:160`; capture
    `40-starmap`);
  - the Desert's window line names "the dry well" (`src/story/calls.js:193`), which left Qanat's square (#161);
  - the clod's refusal is two sentences (`src/story/terraces.js:336`);
  - the doorway's stair (theme 4).
- **The chime pirates are still forced on every first flight** (`src/ambush.js:26-35, 49-50`), a recorded choice.
- **A chasm still makes a foe "gone",** and foes still burn (`src/foes.js:1159, 1173, 2732-2754`).

## 6. Arc and pacing: 4

**Better**
- **The late worlds pull toward the end** (#127): the Lantern's light in every sky from the seventh world, brighter
  each world; the father's window recording one line a world after Home; the market's silent tower named as the
  goal, in the charge and on the map. The oldest pacing fault, named by three audits, is answered.
- **The galactic map shows the arc:** further out is further along.

**Weak**
- **The Desert is 17 stages,** two of them talks with Nour, about twice any other world, with the first fill the
  6th.
- **The peak is unchanged:** three lamps and a whistle at the Lantern (`src/story/lantern-data.js:18-30`), short,
  and no test of the verbs the game taught.
- **The late great-key room repeats** in the temples; round 3 is under way (#23), so not counted.

## 7. Art direction: 5

The captures hold the style everywhere: the giant's arm's sand river between the striped mesas, the Glass Dunes'
lit kiln, the Buried Machine's pipes and great wheel, the map's pale orbits.

**Better**
- **One typeface on the player's screen** (#128): `index.html` has one monospace declaration, the token itself
  (`:29`, from 19); `src/**/*.js` 22, all of them developer screens or machines' own displays (77); the minigames
  none (`src/minigames/kit/minigames.css:3`).
- **Ink lines 4.63 → 4.72** (`docs/audits/ink-lines-v1.53.md`): Viridel's far flowers drawn in their own dark shade.
- **Every shaft of light a soft wash** (#116).

**Still open**
- The City Floating in Space's bridge rails shimmer on small screens (#171).

## 8. Audio: 4

- **Better:** the ship's own score in the prologue (#149).
- **Foes still sound unplaced:** `foeWarn(kind, dur)` and `foeHurt(kind, sound)` take no position
  (`src/audio.js:1970, 1994`). A warning you can't place by ear is a warning half given.
- **The music** is 106 MB in 26 files, as before.
- **The singing light's theme** is still synthesised (`src/soundtracks.js:36-38`; #27).
- **Never heard,** as before.

## 9. Game feel: 4

**Better**
- **The follow camera at Sable's framing:** the traveller a third of the frame from just over his head, the bike
  further back (#148).
- **No flick past a door's jamb:** 174 → 70 °/s at the sleeping car (`src/changelog-media.js:905`).
- **Plumb's hop, look and shiver,** none with Reduce motion.

**Weak**
- **The motion QC is still 11 of 15 red** (`docs/systems/animation.md:650, 753`; #47), unmeasured since v1.47.

## 10. Combat: 4

**Better**
- **A veiled lock is told by its shape:** the arrows go hollow, the opacity only adds to it
  (`src/lock-reticle.js:10, 59-64`; #126).
- **Guardian notices are one line,** what to do, not why (#120).

**Weak**
- **The camera and lock-on scored 3** in the combat review (v1.47), its lowest part, and haven't been reviewed
  since. The follow camera's new framing (theme 9) is not the lock camera.

## 11. Accessibility and UX: 4

**Better**
- **One-line guardian notices:** all 81 under 140 letters, the longest 94 (25 of 51 were 140 or more).
- **Conversations read at a glance:** the type about 3 % of the screen's height on every screen
  (`--dlg: clamp(17px, 2.9vh, 46px)`, `index.html:225`), the page whole at once, no live translation (#147).
- **Button glyphs follow the screen:** the use prompt 23 → 35 px on the Deck's 1280 × 800 (`--type-key`,
  `index.html:35-36`; #150).
- **One short description an item,** at most 180 letters, its buttons inline (`tests/item-cards.test.js:11-28`;
  #165).
- **Settings:** the jets' row only with the jets, the developer rows in a group at the end; a new Drone hints row
  (on, fewer, off) (`src/ui.js:328, 348, 354-356`).

**Weak**
- **English elsewhere,** about 301 literal toasts and notices, the minigames' "GO!", the trials' "RT / R2". Noted,
  not filed, by the author's choice.
- **The longer arrivals:** the Glass Dunes' arrival notice runs to four lines at 1280 × 720 (capture
  `50-glassdunes-saved`).

## 12. Quality, performance, discovery: 3

**Better**
- **`main` is green:** 30 of the last 30 runs passed (8 of 20 red at v1.49), once the crowd test ran on a clock of
  its own (b55b485e). #117 is closed with this audit.
- **Tests:** 493 files (465), among them the author's Desert playthrough as a test (`tests/desert-playtest.test.js`).
- **The way to 60 is shown on both consoles:** the Unity preview on the Deck at 58–59 fps in the Desert, the
  City-Shaft and the Market at 60 Hz with vsync (`performance.md:2012-2023`), installed as its own Steam shortcut;
  on the Xbox 59.5 fps with 97 % of frames on time on Direct3D 12, the picture whole (`xbox.md:392`).
- **The Deck is measured on the Deck** (`performance.md:1800-1812`), v1.49's proxy caveat answered.

**Weak**
- **What players run is unchanged:** the web build on the Deck 36–57 fps, its JS 24–27 ms, "it can't be under 16.7
  at 60 Hz" (`performance.md:1816`; #111); on the Xbox about 20 (`xbox.md:691-695`; #113). The previews have no
  menus or conversations.
- **Still no outside playtest or telemetry.**

## Where I would invest

Ranked by improvement per hour of work.

1. **Watch three people play.**
   - *Cost: a day.*
   - *Why:* first for the fifth time. The author's own Desert run found eleven things in one sitting; the
     explorations, Plumb and the map have been seen by nobody else. (Not filed: the author keeps playtests off the
     tracker.)
2. **The last words against the rules** (#172, #173).
   - Ten "Tell X" steps after the goal, done at the goal instead (#172).
   - "Ask Wen", the dry well, the clod's two sentences, the doorway's stair (#173).
   - *Cost: an afternoon.* Each breaks one of the author's standing rules in a few places.
3. **Measure the new country** (#174): the level design audit on the Desert, the Glass Dunes, the Buried Machine
   and the City-Shaft after their explorations.
   - *Cost: a few hours.* Four worlds changed in a day, after the last count. The Desert's verticality 3 may have
     moved with the giant's arm.
4. **Keep `TODO.md` true** (#175): the eight closed items moved, and a check that catches them.
   - *Cost: an hour.*
5. **Place the foes by ear** (#176): `foeWarn` and `foeHurt` at the foe's position.
   - *Cost: low.* A warning you can place is a warning you can dodge.
6. **The shipped build's frame on the Deck and the Xbox** (#111, #113), or the Unity builds made whole enough to play
   (the Deck's preview ships beside the game as a second shortcut, #146).
   - *Cost: high.* It is under way (the script-time work), and the largest piece left.
7. **The Desert's length:** 17 stages, the first fill the 6th. Not filed: three audits have named it, and it is the
   author's call how the first world opens.
8. **The lock camera:** the combat review's 3, untouched since. *Cost: medium.*

What I would not invest in now:
- **more explorations, worlds or systems:** four worlds gained new country in a day; what's missing is a player and
  a measure;
- **the reward numbers:** making a gadget's upgrade change what it does is a design round of its own, and the new
  country's rewards (sights and lore) fit the brief;
- **the storefront** (left out by the author's choice);
- **the temples,** until round 3 (#23) lands.
