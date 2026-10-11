# Hiraeth against what makes a great game (October 2026, v1.49)

<!-- audit-scores
overall: 3.9 / 5
label: the twelve themes, weighted (themes 3-8 count double)
date: 2026-10-11
-->

The fourth audit against the twelve themes of
[what-makes-a-great-game.md](../what-makes-a-great-game.md), run with the `game-audit` skill
(`.claude/skills/game-audit/`). It follows [the v1.46 audit](game-v1.46.md) by three releases, all on the
same day. Those three releases mostly answered the v1.46 audit's own list (issues #93–#104):
- **The finale:** a last stretch at the Lantern, three lamps to answer, and the Sightings answered after it
  (v1.47).
- **The trials** now pay out on the gadget found in their own world (v1.47).
- **The new worlds:** a quest of their own by the ship, a makers' court each, props on the bare arrival
  floors and four high places (v1.47–v1.48).
- **Words:** the controls' names follow remapping, the teaching lines are French, the stale jets and Hangar
  text is gone, and the dialogue was reviewed and about 140 lines rewritten (docs/audits/dialogue-v1.48.md).
- **Temples:** two rounds of hubs, keys, locks and arenas; structure is 5 in all fourteen houses
  (docs/audits/temple-design-v1.49.md, 4.03 → 4.21).
- **Combat:** reviewed (docs/audits/combat-v1.47.md, 4.52), and its four fixes in (#106–#109).
- **Also:** the skull cave's doorway (#6), distant detail built after you arrive (#14), the Steam Deck at its
  own 1280 × 800, and a Refresh button on What's new.

**Evidence:**
- two read-only surveys of the code against every v1.46 finding, theme by theme;
- a capture pass in muted headless Chrome: the default plan (the title as a first-time player, a new game
  idling for about 70 s, settings, six worlds, Home, the Lantern, the Arena), and a second plan for the
  Underwater City, the Moon Foundry, the City Floating in Space, the Glass Dunes, the Buried Machine,
  Viridel and Lorn;
- the three audits since (combat v1.47, dialogue v1.48, temples v1.49), the device notes in
  `docs/systems/performance.md` and `docs/systems/xbox.md`, and the test runs on `main`.

**What is not verified:**
- **No outside playtest,** again. Nobody but the author has played v1.1–v1.49. Round 2's new temple rooms,
  the Lantern's lamps and the four new quests were built and tested in node and in captures; nobody has
  played them through.
- **Never heard.** Every run is muted. The Deck's lost sound (#112, fixed in v1.49) is the kind of bug only
  a listener finds; nobody heard that it was gone, or that it is back.
- **The Deck at native resolution was measured on a Mac proxy,** not the Deck ("the Deck was asleep",
  `docs/systems/performance.md:1726`).
- **The level design audit hasn't run since v1.23.** The desert's poles and road, the Buried Machine's oil
  pipe and the four high places are unmeasured (#124).
- **Not timed:** the minutes to the first fill and to the sword are still estimates.
- **The What's new key** didn't open the page from a synthetic key press in the capture, so the Refresh
  button was checked in the code only (`src/changelog-refresh.js`).

**What is verified:**
- every capture booted without a page error or console error;
- boot times, all lower than v1.46's: the desert 3.5 s (3.5), Vael 3.8 s (5.1), the City-Shaft 4.0 s (7.1),
  the Buried Machine 3.4 s, Lorn 3.8 s, the new worlds 2.3–3.1 s (2.5–3.6), the Glass Dunes 2.0 s;
- the ship's idle nudge still shows ("Look around: move with WASD, look with the mouse", capture
  `02-new-game-2`);
- the Underwater City's dock and the Moon Foundry's apron have something in the first frame now (captures
  `30-underwater`, `31-moon-foundry`).

**In progress, not counted:** two agents are at work on a fast title screen (#110), and on temple walls you
can't climb past their puzzles (#115) with every god ray a soft shaft (#116). Neither had a commit on
`main` or a branch at the time of this audit.

## The scores

| # | Theme | v1.46 | v1.49 | In one line |
|---|---|---|---|---|
| 1 | Core experience and coherence | 3 | 3 | The stale text is gone and each people names its own night; breadth still grows, and the quest log still sends you to people |
| 2 | The first five minutes | 4 | 4 | The teaching lines are French now; the fill is still the 6th of 16 stages and Debug still on the title |
| 3 | Exploration and wayfinding | 4 | 4 | Poles, a road home, an oil pipe, four high places and furnished arrivals; none of it measured since v1.23 |
| 4 | Rewarding exploration | 4 | 4 | Trials pay on the world's own gadget, courts in the new worlds, the Sightings answered; rewards are still numbers |
| 5 | Narrative and harmony | 4 | 4 | Every choice comes back at the stone, a night for each people; the pirates still forced, four temple guides off-key |
| 6 | Arc and pacing | 3 | 4 | The finale has play, every quest shows done, temple curves rose; still five worlds pulled on by the voicemail alone |
| 7 | Art direction | 5 | 5 | The furnished arrivals and the new rooms hold the style; the type split is still open |
| 8 | Audio | 4 | 4 | Unchanged in substance, never heard; the Deck's lost sound fixed |
| 9 | Game feel | 4 | 4 | Smoother legs and fewer pops, but the motion QC is still 11 of 15 red |
| 10 | Combat | 4 | 4 | Reviewed at 4.52 and its four fixes in; the veiled lock is told by opacity alone |
| 11 | Accessibility and UX | 3 | 3 | Keys follow remapping and the teaching is French; the toasts, trials and cards are English, hints in fights are paragraphs |
| 12 | Quality, performance, discovery | 3 | 3 | Faster boots, 465 test files, the Deck sharp; the Deck slower and unmeasured, the Xbox at 20 fps, 8 of 20 runs red |

Weighted (themes 3–8 count double): **3.9 / 5, up from 3.8.**

Theme 6 is the one that moved: the finale has a last stretch, the Done list is whole, the new worlds have a
thread before their temples, and the temples' curves rose. The others held, with better insides:
- theme 4 lost three of its four weaknesses;
- theme 11 lost the literal key names;
- theme 3 had its two empty arrivals and its blind pipe answered.

What holds them back is the same as at v1.46: nobody has played or heard it, and the work keeps adding
(about 214,700 lines of `src`, from 210,000) faster than it is measured.

## What happened to the v1.46 investments

| # | Investment | Status |
|---|---|---|
| 1 | Watch three people play | **Not done.** `TODO.md:8` still reads "Playtests are not listed here: the author plays all the time." Fourth audit in a row |
| 2 | Fix the quiet bugs and the stale text | **Done.** The Lantern, the night mail and the temple quests are in the Done list (`src/story/all-quests.js:20-46`, #93). No jets or Hangar on the Worlds page (#94). The slots comment says three (`src/save-slots.js:1`). Photo mode saves `hiraeth-…png` and offers the share sheet on a phone (`src/main.js:1435`). The Glass Dunes are still keyed `garage` inside, which no player sees |
| 3 | Finish the key and language plumbing | **Partly.** The gadget cards, the trials' cards and Vael's notices name your own keys (#95; `src/gadgets/bridge.js:256`, `src/story/arzach.js:252`). The teaching lines are French (`src/first-steps.js:26-27`, `src/ship/prologue.js:79-80`; #96). The toasts are not: about 277 literal, as before (#121) |
| 4 | Give the finale some play, close the threads | **Mostly done.** Three lamps to answer before Ilen comes out (`src/story/lantern-data.js:18-30`, #97). The Sightings are answered after the Lantern (`src/story/sightings.js:24-37`, #98). The detour traces stay with the WIP side worlds, by decision: their threads are answered on the route |
| 5 | Make the trials' rewards land | **Done, with one gap.** Each trial upgrades the gadget of its own world (`src/trials/upgrades.js:19-31`, #99). A trial can still be won before that gadget is found (#125) |
| 6 | The new worlds: a second thread and a first frame | **Done.** A quest by the ship in each (v1.48), a makers' court each with a charm (`src/boxes/placements.js:237-275`, #101), and props on the dock and the apron (#102; captures `30-underwater`, `31-moon-foundry`) |
| 7 | The desert's ways home | **Partly, unmeasured.** Red-strip poles out of Marrow's hollow (`src/desert-road.js:82-116`), the pilgrims' road back to the ship, a field-stone that greens. The quest is 16 stages, not 17. No level design run since (#124) |
| 8 | Check the new fight with the senses it relies on | **Done.** The combat review with a colour-vision pass at a handheld's size (#103, 4.52); stunned foes shown by stars and sway, the lock-on still with Reduce motion, the lock camera off-axis, chained flurries rationed (#106–#109) |

## 1. Core experience and coherence: 3

**Better**
- **The stale text is gone** from the players' screens: the jets' blurbs, the Hangar in the courts' notes
  (`src/finds/courts.js:14, 34, 44` now say it left the route), the slots comment.
- **One name for the night per people.** "The night the sky rang" went from about twenty speakers to the
  City-Shaft's own (dialogue v1.48, "After the rewrites").

**Weak**
- **Breadth still grows.** About 214,700 lines in `src`, against 210,000 at v1.46: six temples got new rooms,
  three courts, four quests, two makers' runs and the Lantern's lamps. Each fills a gap the last audit named,
  but the freeze it asked for didn't happen.
- **Four temple guides outside the City-Shaft still say "the sky rang"**, under the sea right after "the
  whales went quiet" (`src/temples/underwater-data.js:31`, `perdide-data.js:29`, `buried-data.js:17`,
  `bazaar-data.js:30`; #119).
- **`TODO.md` lists about 30 items as open whose issues are closed** (#6, #28, #35, #39, #42 among them; #123).

## 2. The first five minutes: 4

**Better**
- **The teaching is French in French:** the first steps, the ship's nudge, the first fill, the first fight
  (`src/i18n/fr.js`, 20 `teach.*` keys).
- **The skull cave lets you in.** Its doorway is cut to its edge (`src/desert-city.js:1198-1206`), and the real
  player is walked in on every heading (`tests/desert-cave-walk-in.test.js`). It was the author's own stuck
  point (#6).

**Weak**
- **The first fill is still the 6th stage,** of 16 now (`src/story/desert-data.js:97`), an estimated
  10–15 minutes in.
- **Debug is still on the title for a first-time player** (capture `01-title-new-player`; `src/dev-gate.js:13`),
  the author's call.
- **The title still builds a whole world** (the Underwater City behind the menu, capture `01-title-new-player`).
  A fast title is being built (#110).

## 3. Exploration and wayfinding: 4

**Better**
- **The arrivals are furnished.** The Underwater City's dock has the divers' rack, cargo and a stripe to the
  tube; the Moon Foundry's apron a moon cooling in its mould and slag carts (captures `30-underwater`,
  `31-moon-foundry`).
- **Lines to follow:** the oil pipe from the oculus to the great wheel (`src/story/buried-data.js:40-41`), the
  desert's red-strip poles to the Hearth and the pilgrims' road back to the ship.
- **Height:** the crow's nest 44 m up in the City Floating in Space, the hoist tower 80 m over the Moon
  Foundry, the belvedere in the Garden of Spheres, the cairn 90 m over the Glass Dunes.
- **The Signal Market's tower** has passages straight at it from the back lane and the side streets, and
  Madame Sel meets you where the avenue opens.

**Weak**
- **None of it is measured.** The level design audit last ran at v1.23; the desert's 3.44, the Buried
  Machine's blind leg and the four worlds' verticality 2 are all from before these fixes (#124).
- **The drone still never points at relics,** by design (`src/scout.js:103`).

## 4. Rewarding exploration: 4

**Better**
- **The trials' rewards are for the gadget you find in that world:** dune fins for the bike in the desert, the
  lens's clear glass in the Buried Machine, a fourth bomb pouch in the Garden, the long sand in the Signal
  Market (`src/trials/upgrades.js:19-31`).
- **Courts in the new worlds:** the divers' court (the bubble wand), the founders' yard (the magnet), the
  moorers' yard (the hook), each with a charm behind its gate. The wand and the hook have a use outside their
  first court at last.
- **The Sightings close:** each of the four threads gets Ilen's answer after the Lantern.
- **The temples have optional rooms,** each with a coffer of chimes (the Clockmaker's Cupboard, the Eyrie's
  coffer), and keys you find in one room for another.

**Weak**
- **The rewards are still numbers** (the hook's reach 25 → 34 m, a fourth bomb). Nothing changes what a
  gadget does.
- **A trial can be won before its world's gadget is found**, and its card describes a tool you don't have
  (`src/trials/course.js:44-57`; #125).
- **The detour traces are still out of reach** with the seven side worlds on WIP (`src/levels/names.js:47`).
  That was decided (#98): their threads are answered at the Lantern instead.

## 5. Narrative and harmony: 4

**Better**
- **Every choice comes back:** keeping Dov's token or giving it back, keeping Hollin's promise or saying no,
  each named at the stone and by Ilen (`src/story/ending.js:163-173`).
- **A night for each people:** the whales went quiet, the cables sang, the singing went over.
- **The rewrites:** the cameo visitors start with what they came to see, the shops greet in their own trade,
  Ilen explains less at the Lantern, the gifts at the stone are set down as what they are.

**Weak**
- **The quest log still sends you to people,** though the v1.48 changelog says nobody does: "Ask Hask…"
  (`src/story/buried-data.js:35`), "Ask Sister Aube…", "Find Brother Calix…" (`src/story/arzach2-data.js:48,
  50`), "Ask Nour…" (`src/story/desert-data.js:107`), and two lines ending "Ask her" (`desert-data.js:254`,
  `src/temples/underwater-data.js:77`). In Viridel the terraces' clod refuses to move until Esk has asked you
  ("ask her first", `src/story/terraces.js:333`), which also breaks "reaching the goal completes the quest"
  (#118).
- **The chime pirates are still forced on every first flight** (`src/ambush.js:26-34`, `:57`); only Enemies off
  avoids them. For a traveller who hasn't taken the blade, the game's first fight is still a space shooter.
  It is a recorded design choice (v1.45), so it is not filed again.
- **A chasm still makes a foe "gone",** and foes still burn (`src/foes.js:1134, 1173, 2732-2754`).

## 6. Arc and pacing: 4

**Better**
- **The finale has a last stretch:** the light sings to three lamps round the island one at a time; whistle
  back by each with nothing in your hands, and Ilen comes out to see who answered
  (`src/story/lantern-data.js:18-30`). It is short and has no test of the verbs, but the peak is no longer
  only a conversation.
- **The Done list is whole:** the Lantern, the night mail, every temple quest (`src/story/all-quests.js:20-46`).
- **The new worlds have a thread before their temples:** Bastien, Hedda, Rosa and Oren, each a few steps from
  the ship, each leading to the temple's door. The Glass Dunes went from 43 lines of story to about 179.
- **The temples' curves rose:** the Greenhouse 1 → 3, the Lamp-House 1 → 3, the Undertower 3 → 4, the Aerie
  4 → 5 (temple v1.49). A temple is now a house you explore, with its hardest step late.

**Weak**
- **The gap before the finale is unchanged:** Home opens after any six worlds, the finale needs the Signal
  Market, 12th (`src/story/ending.js:87-88, 105-116`). About five worlds are pulled on only by the voicemail
  (#127).
- **The desert is 16 stages,** still about twice any other world, two of them talks with Nour.
- **The late great-key room repeats** in four temples (temple v1.49, "Across the temples").

## 7. Art direction: 5

The captures hold the style everywhere: the dock's diving rack under the glass tunnel, the apron's mould and
slag carts under the hanging moons, the rose terraces against the planet. The v1.47 passes brought the
possessed machines, the late spirits and three creatures closer to their drawings.

Still open:
- **The type split.** `index.html` still has 19 monospace declarations, `src/*.js` 77 more, and the minigames
  are all mono (`src/minigames/kit/minigames.css:3`). The settings page is mono end to end (capture
  `03-title-settings-0`) (#128).
- **The arrival card and the region's name** share the bottom of the screen: in the captures of the four newer worlds
  and the Lantern, the name is a faint ghost under the father's charge card (`30-underwater`, `33-glass-dunes`,
  `16-lantern`). The
  name is meant to wait for the card (`src/main.js:1475`, `placeName.defer`); a direct boot may be the cause,
  so it is noted, not filed.

## 8. Audio: 4

Unchanged in substance, and never heard.
- **Foes** still sound unplaced: `foeWarn` and `foeHurt` take no position (`src/audio.js:1942, 1966`).
- **The music** is 106 MB in 27 files, as before.
- **The singing light's theme** is still synthesised (#27).
- **Better:** the Deck's sound is back. A measuring run had saved the music, effects and voices at zero, and
  the Deck played only the prologue's singing light (#112). Nobody noticed by ear for the whole of its life,
  which is the point of "never heard".

## 9. Game feel: 4

**Better** (v1.47): the knee no longer snaps straight at every sprinting stride, a swinging foot no longer
jumps a stair's height, the feet no longer cross on the spot, the last step of a stop no longer slides. The
worst slide at starts and stops is 15.3 cm (29.4), and pops are 8.0 a minute (10.2); the Arena's floor in the
game is 19 a minute (27).

**Weak**
- **The motion QC is still 11 of 15 red,** limits failed 47 → 46 (`docs/systems/animation.md:676-692`). The
  sprint, the stairs, the standing pivots and the run-stop are still red (#47).
- **No new number for the desert in the game,** which had 46 pops a minute at v1.46.

## 10. Combat: 4

**Better**
- **Reviewed:** 4.52 over the 22 kinds and 14 guardians (combat v1.47), the flurry, the hops and the lock-on
  for the first time, with a colour-vision pass at a handheld's size: "Nothing in a fight is told by colour
  alone."
- **Its four fixes are in:** chained flurries rationed (`src/flurry.js:25-28`), the lock camera stands off to
  one side of a small foe (`src/foes.js:124`), Reduce motion stills the lock arrows (`src/lock-reticle.js:59-64`),
  a stunned foe reels under amber stars (`src/foes.js:249-258`).
- **The dash cut through a back lands double,** with a gold ring.

**Weak**
- **A veiled lock is told by opacity alone** (`src/lock-reticle.js:36, 182`), the review's one remaining
  recommendation on states (#126).
- **The camera and lock-on scored 3** in the review, the lowest part of it.
- **Guardian hints are paragraphs** (theme 11).

## 11. Accessibility and UX: 3

**Better**
- **The keys follow you:** the gadget cards, the trials' cards and Vael's notices use `{key:…}`, so a remapped
  control or a pad shows its own name.
- **French teaching lines and input names** ("la souris", "le stick gauche").
- **Reduce motion** now covers the lock-on.

**Weak**
- **Guardian phase hints run to paragraphs:** 25 of the 51 are 140 characters or more, the longest 276, shown
  as a notice mid-fight (`src/temples/boss.js:296, 398`; #120). Against the one-line rule.
- **English everywhere else:** about 277 toasts and notices are literal English (the same as v1.46); the
  trials' and minigames' screen has no `t()` ("GO!", `src/minigames/kit/runner.js:128`); the gadget cards'
  words have no French keys; the trials' pad rows still say "RT / R2" for the throttle
  (`src/trials/index.js:44-45`) (#121).
- **Settings:** 25 rows, the developer rows among them, and "Invert the jets' pitch" for jets nobody can have
  (`src/ui.js:323, 343-344`; capture `03-title-settings-0`; #122).

## 12. Quality, performance, discovery: 3

**Better**
- **Faster boots:** the City-Shaft 7.1 → 4.0 s and Vael 5.1 → 3.8 s in this run's captures; on a handheld the
  City-Shaft opens some 13 s sooner (v1.48), from building distant detail after you arrive (#14).
- **Tests:** 465 files; the full run passes 3,331 tests (449 files and about 3,076 at v1.46).
- **The browser play-through has its ending:** the Signal Market to the Lantern, Ilen, the stone and the credits
  (`scripts/playthrough-browser.mjs:207-215`).
- **The Deck is sharp:** always 1280 × 800, no dynamic resolution (`docs/systems/performance.md:1716-1724`).
- **What's new has a Refresh button** that fetches the newest game over the air in the apps
  (`src/changelog-refresh.js`, #114).

**Weak**
- **The Deck's sharpness cost frames:** the desert's views 47 → 39 fps at the median, measured on a Mac proxy,
  not the Deck (`performance.md:1722-1726`). The JS frame is still about 20 ms in the desert and 24 ms in the
  City-Shaft, so 60 isn't in reach there (#111).
- **The Xbox is at about 20 fps** at the desert spawn, the main thread 49–51 ms (`docs/systems/xbox.md:659-668`),
  against the author's 60 (#113).
- **`main` is often red:** 8 of the last 20 test runs failed (10:17–15:04, 11 October), and each red run holds
  back a release (#117).
- **Still no outside playtest or telemetry.**

## Where I would invest

Ranked by improvement per hour of work.

1. **Watch three people play.**
   - *Cost: a day.*
   - *Why:* still first, for the fourth time. Three releases in one day reshaped six temples, the finale and
     four worlds' openings, and only their author has seen them. A stranger would show whether a temple hub
     reads as a choice or a maze, whether anyone finds the lamps' whistle, and where an unarmed traveller
     looks for the blade.
2. **The quick word fixes.**
   - The quest steps and lines that send you to a person, and the clod that waits for Esk (#118).
   - The four temple guides' "sky rang" (#119).
   - The guardian hints down to one line each (#120).
   - The jets' row in Settings (#122).
   - *Cost: an afternoon.* Each is the author's own standing rule, broken in a few places.
3. **Measure what was built.**
   - The level design audit on all twelve route worlds (#124).
   - The Deck at native resolution on the Deck itself (#111).
   - *Cost: a few hours.* Two releases of world work, and the Deck's biggest change, are unmeasured.
4. **Keep `main` green** (#117) and clean `TODO.md` (#123).
   - *Cost: an hour, then a habit.* A red run holds back a release; a stale list hides what is left.
5. **Point the late worlds at the end** (#127).
   - *Cost: medium.* The one pacing fault that three audits have named and none has moved.
6. **The rest of the language layer** (#121): the trials, the minigames, the gadget cards, then the toasts world
   by world.
   - *Cost: medium.*
7. **The Deck's and the Xbox's processor time** (#111, #113).
   - *Cost: high.* The JS frame has to fall by a third on the Deck and by two thirds on the Xbox; it is the
     largest piece of work on this list, and it is already under way.
8. **Small finds and states:** a trial that waits for its gadget (#125), a veiled lock with a shape (#126),
   the type split decided (#128).
   - *Cost: low each.*

What I would not invest in now:
- **more worlds, temple rooms or systems:** the gaps are filled; what's missing is a player and a measure;
- **the storefront** (left out by the author's choice);
- **rendering beyond the god-ray and title work in progress** (#110, #116).
