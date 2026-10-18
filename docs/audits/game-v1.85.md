# Hiraeth against what makes a great game (October 2026, v1.85)

<!-- audit-scores
overall: 4.1 / 5
label: the twelve themes, weighted (themes 3-8 count double)
date: 2026-10-18
-->

The seventh audit against the twelve themes of
[what-makes-a-great-game.md](../what-makes-a-great-game.md), run with the `game-audit` skill
(`.claude/skills/game-audit/`) for issue #467, the design half of the full audit (#226 was the last). It follows
[the v1.59 audit](game-v1.59.md) by 26 releases and six days: **501 changelog lines** (v1.60–v1.85), `src` at 287,824
lines (233,450 at v1.59). What landed, in short:
- **The v1.59 list:** the newcomer's Saves screen (#227), the fragments in the story (#228, #229), the pirates' words and
  shake (#230), the placed sounds' slider (#231), the leave gates as quest steps (#232), the blind legs and the ship's
  tight spots (#233, #234), a combat review (#236, `combat-v1.61.md`). All closed.
- **The temples rebuilt twice:** loops (#23, v1.73–v1.74), then the shrine redesign (#336, v1.77–v1.83): great halls,
  big doors, the gadgets moved between houses, a house map in each, a short film at each end.
- **New beside the route:** twelve fight temples (top-down, a world's colours as the prize, v1.76–v1.84), the fragments
  tripled to 288 (#317), benches at views, two games, the space ports at every landing and the hat sets (v1.84).
- **The first minutes:** Plumb, the drone with a name (#434), a wide first landing and a first step turned to the best
  view (#327), people give the quests instead of the arrival (v1.68), nobody gives a quest before it can be done (#328).
- **The devices:** the Steam Deck switched to the Unity build (v1.79), the Retroid and the Xbox's Unity builds
  measured; the world's recording now plays all the time (#474, v1.85).

**Evidence:**
- two read-only surveys of the code against every v1.59 finding, theme by theme (story and pacing; feel, UX, quality);
- one muted headless Chrome pass of the default plan (18 views: a new player's title and first minute, settings, the
  twelve route worlds from their debug saves, Home, the Lantern, the Arena), port 5490, at `8f01feae`;
- the design half's other audits, run beside this one on the same commit: level design
  ([level-design-v1.85.md](level-design-v1.85.md)), temple design ([temple-design-v1.85.md](temple-design-v1.85.md)),
  quests ([quest-v1.85.md](quest-v1.85.md)) and the cinematics ([cinematics-v1.85.md](cinematics-v1.85.md)), with their
  headless captures (cut twice by network outages and re-run);
- the last 30 test runs on `main` and the open issues.

**What is not verified:**
- **No outside playtest,** for the seventh audit running. Nobody but the author has played v1.60–v1.85. The temples were
  rebuilt twice, twelve fight temples added and three worlds' places relaid since anyone else held a pad.
- **Never heard.** Every run is muted; the voices, the menu sounds and the always-on music (#474) are judged by code.
- **No device.** The technical half (#467's other agent: perf, visual, shadows, z-fighting, sound, camera) measures the
  frames; this audit cites the changelog's device numbers and does not repeat them. The Deck, the Retroid and the Xbox
  were not touched.
- **The fight temples were not played,** in the capture or by hand: read in the code only.
- **No localisation question.** The author wants no French or other-language work for now, so theme 11's localisation
  question is left out of the score and of the findings.

**What is verified:**
- every capture booted with no page error and no console error;
- boot times on the Mac (load 6–16 during the pass): the Desert 5.6 s, Vael 5.7, Lorn 6.1, Viridel 3.7, the Underwater
  City 3.1, the City-Shaft 5.2, the Glass Dunes 3.7, the Buried Machine 4.4, the Moon Foundry 3.6, the Garden 4.7, the
  City Floating in Space 4.7, the Signal Market 3.0, Home 2.4, the Lantern 2.6, the Arena 3.2 (v1.59: 2.0–6.2, the same
  range);
- `main`: 27 of the last 30 test runs green (three red today, each fixed by the next push).

## The scores

| # | Theme | v1.59 | v1.85 | In one line |
|---|---|---|---|---|
| 1 | Core experience and coherence | 3 | 3 | The v1.59 threads are woven in; 501 lines in six days, and the fight temples and side worlds' ports built beside the story |
| 2 | The first five minutes | 4 | 4 | A clean title, Plumb and a wide first landing; the first fill still the 6th of 18 steps, behind a slower walk out |
| 3 | Exploration and wayfinding | 5 | 5 | 4.68 over twelve worlds (4.71); house maps and benches; the Glass Dunes' new west and Lorn's rebuilt house unguided |
| 4 | Rewarding exploration | 4 | 4 | Fragments in the new country, hinted by people; 192 of 288 now buy nothing, and the ending never counts them |
| 5 | Narrative and harmony | 4 | 4 | No quest before it can be done, plain talk, names apart; the fight temples' ink splashes have no place in the story |
| 6 | Arc and pacing | 4 | 4 | Every temple ends on a film and the Undertower is the exam; the Lantern's peak is still three lamps and a whistle |
| 7 | Art direction | 5 | 5 | Fourteen temples rebuilt to their sheets, ports and hats; every world in the captures holds the style |
| 8 | Audio | 4 | 4 | The slider fixed, a voice instead of beeps, menu and quest cues, ducking; the light's theme still synthesised, never heard |
| 9 | Game feel | 4 | 4 | About twenty foot and turn fixes, a stagger, doors at your pace; no motion QC since v1.66 to prove them |
| 10 | Combat | 4 | 4 | Reviewed at 4.63, the lock camera fixed, the grapple; the fight temples' own rules unreviewed |
| 11 | Accessibility and UX | 4 | 4 | The pirates honour Reduce motion, rich settings; still no colour-blind option (localisation left out, above) |
| 12 | Quality, performance, discovery | 3 | 3 | 713 test files, 27 of 30 green, the Deck on Unity; the Xbox a preview, a Deck journey starts again, no playtest |

Weighted (themes 3–8 count double): **4.1 / 5, as at v1.59** (74 / 18 = 4.11).

Nothing moved. Every v1.59 investment but the playtest is done, and each fix held. What holds the score is the same
shape as at v1.53 and v1.59: breadth arriving faster than anyone plays it (v1.84 alone has 61 lines against CLAUDE.md's
10–15 a version), and new systems built beside the story rather than in it. This time those are the fight temples and
the surplus fragments.

## What happened to the v1.59 investments

| # | Investment | Status |
|---|---|---|
| 1 | Watch three people play | **Not done**, seventh audit in a row. Not filed: the author keeps playtests off the tracker (`TODO.md:9`) |
| 2 | Keep the newcomer's screens clean (#227, #221, #222) | **Done** for #227: one folded "Debug" row (`src/title.js:141`, `:228`). **Partly** for #221 and #222: the father's charge is one line with no second card, notices one short line, hints at most every 20 s (`src/changelog.js:1717-1718`); not re-counted |
| 3 | Weave the fragments in (#228, #229) | **Done.** Re-picked over the new country, 25 m or more off the route (`src/fragments-data.js:14-38`, `tests/fragments-poi.test.js`); a bible entry (`docs/story-bible.md:563-575`); Anselm Thrum, Tilde; Ilen's line for none, some or all (`src/story/lantern-data.js:156-158`) |
| 4 | Make the words match the rules (#230, #232) | **Done.** "They want our hull." (`src/ambush.js:69`); the core gadgets' step in the Desert's and Vael's quests (`src/story/leave-gate.js:55-57`), and the Rose House now before Qanat's gift |
| 5 | The placed sounds' slider (#231) | **Done.** `spot()` on the effects bus (`src/audio.js:1131-1140`) |
| 6 | The lock camera and a combat review (#236) | **Done.** `combat-v1.61.md`, 4.51 → 4.63; the arena lock green at 1.24 cm; the back-to-the-wall fix (#256) |
| 7 | The blind legs and the ship's spots (#233, #234) | **Done.** Both legs guided at v1.66; the camera over the shoulder in the cockpit, hatch and bunk (capture `02-new-game-1`) |
| 8 | The loose ends (#235) | **Closed** |

## The design half, in numbers

| Audit | Last | v1.85 | The movement |
|---|---|---|---|
| Level design (twelve route worlds) | 4.71 (v1.66) | 4.68 | The Desert 3.89 → 4.22 (#278: no walk back); the Glass Dunes 4.78 → 4.22 (its new west lies 280–435 m off the path); Lorn 4.78 → 4.67 (the rebuilt Hush-House out of sight) |
| Temple design (fourteen houses) | 4.34 (v1.74) | 4.38 | The shrine redesign keeps every structure at 5 and breaks no room rule; the Footprint's lens steps measure obscure; three houses alike in shape |
| Quests | 4.98 (v1.66) | 4.94 | No step before it can be had, no marker that points back; the Clock-House's and the Undertower's keeper steps say "down" to a guardian upstairs (#478), three talks of 9–12 pages (#479), the fight temples' card (#480) |
| Cinematics | 4.51 (v1.66) | 4.57 | All 104 run; every v1.66 issue held. The fourteen temple endings (v1.79) are not on the review page (#490); the Moon Foundry's and the Floating City's climaxes now film walls (#491) |

## 1. Core experience and coherence: 3

**Better**
- **The v1.59 threads are in:** the fragments have a bible entry, their scientist a name of his own, and Ilen answers
  them; the pirates' words match their rules; the leave gates are quest steps.
- **Hints say where, not who** (v1.79), and the people who only talk point at fragments, games and places (v1.71).

**Weak**
- **Breadth, again:** 501 player-facing lines in six days. Four versions run far over the 10–15 a version CLAUDE.md asks
  (v1.84 61, v1.78 57, v1.77 47, v1.81 28), so a version no longer reads as one release a player can take in.
- **The fight temples sit beside the story,** as the fragments did at v1.59: twelve houses, one a world, with no entry
  in `docs/story-bible.md` (no "fight temple" or "Sunken Hall" in it), paying a world's colours for the kit
  (`src/fight-temples/index.js:1-4, 26`). The makers' houses are calmed; these are cleared, and "ink splashes out with
  a wet thump" (`src/changelog.js:97`). Nobody in the story says what they are (#483).
- **The side worlds still get work nobody can reach:** all seven WIP (`src/levels/names.js:42-47`), yet they got music
  (v1.70) and ports (v1.84). The author has since stopped port work there; noted, not filed.

## 2. The first five minutes: 4

**Better**
- **A clean title:** New Game, Saves and four icons; the debug list folded away (capture `01-title-new-player`).
- **Plumb wakes in its cradle** and points to the village (#434); the first landing on each world comes down into a
  wide view, and the first step out turns to the best one (#327).
- **The ship's camera keeps its distance** by the bunk (capture `02-new-game-1`, against v1.59's `ship-bunk.webp`).

**Weak**
- **The first fill is still the 6th step,** now of 18 (`src/story/desert-data.js:94-142`), and the walk down the ramp is
  a walk now, not a run (#434). By choice, as before; not filed.
- **Two steers in the first minute:** Plumb toward the village, Marrow toward the singing fragment by the ship
  (`desert-data.js:145-151`). Both are one line; nobody has watched a newcomer choose.
- **The Desert's first goal is still 212 m from the landing** (level design onboarding 3).

## 3. Exploration and wayfinding: 5

**Better**
- **Measured, all twelve:** 4.68 (4.71 at v1.66). The Desert's walk back from the Rose House is gone (#278: loops 3 → 5,
  pacing 3 → 4), Viridel still 5.
- **A house map in every makers' house** (v1.82), benches at the views (v1.77), "Travel here" on the Worlds page.

**Weak** (filed from the level design audit: #475, #476)
- **The Glass Dunes' new west is out of reach of the route:** the folded ravine, the prism crossings and the pearl city
  (#426) lie 280–435 m off the critical path and 157 m from each other, three loners; the world's main quest is a
  437 m, one-minute walk that passes none of them.
- **Lorn: the legs to the rebuilt Hush-House are blind** (wayfinding 5 → 4): the splinter → the cave's south mouth
  (389 m) and the light across the water → the temple (189 m) see neither their goal nor a landmark by it.

## 4. Rewarding exploration: 4

**Better**
- **The fragments are where the new country is**, 25 m or more off the route, 24 a world (#317), with people who hint at
  them and a soft circle on the map (v1.71).
- **Optional pull** stays 4–5 in eleven worlds; Vael has 21 places in the 30–150 m band and none remote.

**Weak**
- **192 of the 288 fragments buy nothing.** Anselm's seven upgrades cost 96 in all (`src/items.js:280-310`,
  `tests/fragments.test.js:67`), kept when the count was tripled (#317, the author's: the prices stay). Past the 96th
  the only answer is Ilen's line for "every splinter" (`lantern-data.js:158`); the homecoming and the ending never
  count them (no "fragment" in `src/story/ending.js` or `src/ship/homecoming.js`). #481 (keeping the prices).
- **The rewards are still numbers:** a heart, a harder blade, a shot, the glide, stamina, the block's cost. Only the
  finder changes what you do. Not filed: a design round of its own, as before.
- **The fight temples pay colours** for the backpack, sword and shield: a reward of its own kind, the first cosmetic
  one. Good, if a player knows the kit has colours to find.

## 5. Narrative and harmony: 4

**Better**
- **Nobody gives a quest before it can be done** (#328, `src/story/quest-needs.js`), and hosts don't offer a run before
  it can be had (v1.66).
- **Quest givers speak plainly** (#369) and no two names in a world look alike (v1.73).
- **The quests hold** (quest QC 4.94, [quest-v1.85.md](quest-v1.85.md)): no step before it can be had, no marker pointing back.

**Weak**
- **The fight temples' tone:** cleared rooms of many foes, each "felled in a cut or two", ink splashing, in a game whose
  guardians are calmed (`docs/game-brief.md`). With no line in the story to place them, a player meets a second genre (#483).
- **The quest-needs gate covers the core gadgets** (`quest-needs.js:5-8`); the gadgets moved between houses in v1.80
  (the hook, the bubble wand, the lens, the pen) are gated inside the temples and the trials. The quest QC's reading found
  no world quest that asks for one early.

## 6. Arc and pacing: 4

**Better**
- **Every temple ends on a short film** (#366): the guardian at rest, the reward, the house lighting, the way out.
- **The Undertower is the exam of the whole journey** (v1.83), and the Desert's gate and gift come in the right order.
- **Three worlds' endings show their point** (the whale at the glass, the last moon, the cables taut; v1.73).

**Weak**
- **The peak is unchanged:** three lamps and a whistle at the Lantern (`lantern-data.js:55-59`). With the middle of the
  game twice as full as at v1.59, the end is smaller beside it.
- **The finale still waits on the Signal Market,** the twelfth world, and the way home on any six (`src/story/ending.js:5,
  19-21, 75`). Unchanged, not a regression.

## 7. Art direction: 5

The captures hold the style in every world: the Desert's village under the drinking tree, Lorn's crystal and lamps, the
City-Shaft's rim, the Glass Dunes' green hills and clock, the Floating City under its moon, the Lantern at dusk.

- **Better:** the fourteen temples rebuilt as the makers' high-tech halls from picked sheets (v1.77, v1.83; the author's
  "futuristic, never organic"), the ports, the hat sets; the Retroid's lines kept crisp by FSR (v1.81).
- **Open:** the visual audit (the technical half) reports on halos and artefacts.

## 8. Audio: 4

- **Better:** the placed sounds on the effects bus (#231); speech a gliding voice instead of beeps (v1.73); the menus,
  the quest, the lock-on and the photo have their sounds (v1.81); the music ducks under speech; each world's recording
  plays the whole time (#474, Moments under Settings).
- **Weak:** the singing light's theme is still synthesised (#27, `docs/systems/audio.md:74-81`); and everything is
  judged unheard. The sound QC is in the technical half.

## 9. Game feel: 4

- **Better:** about twenty foot, knee and pivot fixes (v1.69–v1.80), the hit stagger (v1.71), felled foes lying down
  (v1.70), doors you walk through at your pace (v1.81), the sword kept lit through a fight (v1.82).
- **Weak:** the last motion QC (v1.66) had 11 of 15 scenarios red, and motion polish is closed (#47, the author's), so
  the gain is unmeasured. The fight temples' sword is a third quicker than the sword outside (`src/changelog.js:95`): the
  same button feels two ways.

## 10. Combat: 4

- **Better:** the review at 4.63 (`combat-v1.61.md:272-276`), guardians' tells at 1.2 s and a second verb for six, the
  lock camera off the walls (#256), the grapple at a locked foe, the ember wisp.
- **Weak:** **the fight temples are a combat system of their own, never reviewed:** B rolls through every hazard, no
  jump, a wide cut, a quicker combo, waves of many light foes (`src/fight-temples/session.js`; `src/changelog.js:95-98`).
  The author chose the rules (the Sunken Hall); nobody has judged how they play. #482.

## 11. Accessibility and UX: 4

- **Better:** the pirates honour Reduce motion and the shake slider (`src/minigames/pirates.js:540, 596`); remapping,
  hold or toggle, foes Gentle or Off, drone hints, text size, a plain background behind speech (capture
  `03-title-settings-0`).
- **Weak:** no colour-blind option, as before (`src/i18n/en.js:24-105`). A saved "Moments" music choice went to
  "Always" once (#474, the author's call). The localisation question is left out (above).

## 12. Quality, performance, discovery: 3

- **Better:** 713 test files (519); 27 of the last 30 runs green; the Steam Deck on Unity, the Desert 52 → 78 fps and
  its warm load 46 → 14 s (`src/changelog.js:594-610`); the AYN Thor about 60 fps (v1.81).
- **Weak:**
  - **The Deck's Unity build starts a new journey** (`src/changelog.js:594`): a Deck player's saves stay in "Hiraeth
    (web)". The author's decision at the switch; noted, not filed.
  - **The Xbox is still a preview,** 42–53 s to load a world (`src/changelog.js:17`).
  - **No playtest, no telemetry.** The tests prove what the author thought of.

## Where I would invest

Ranked by improvement per hour of work.

1. **Watch three people play.**
   - *Cost: a day.*
   - *Why:* first for the seventh time. The temples were rebuilt twice and twelve fight temples added since anyone but
     the author played. (Not filed: the author's to do.)
2. **Put the review page's gaps on it: the fourteen temple endings** (#490), and the two climaxes that film walls (#491).
   - *Cost: an hour or two.* A film that isn't on the page isn't reviewed; fourteen were added in one release.
3. **The Glass Dunes' west and Lorn's Hush-House legs** (#475, #476).
   - *Cost: a few hours each.* The west was built to the hearted plates and then left off every path; Lorn's legs went
     blind when its house was rebuilt.
4. **Give the surplus fragments an answer** (#481).
   - *Cost: an afternoon.* The prices stay (#317); the count can be met at the stone, by Ilen, or in the ending.
5. **Review the fight temples' combat and write them into the story** (#482, #483).
   - *Cost: a day for the review, an hour for the bible entry.* Twelve houses with their own rules and tone, unjudged.
6. **The Footprint's lens steps and the three houses alike in shape** (#477).
   - *Cost: medium.* The measure says seven of its ten steps are obscure; one play-through says whether that is true.

What I would not invest in now:
- **more systems:** the fight temples, the ports and the hats came in one week; the middle of the game is full, and its
  threads to the story are thin;
- **the reward numbers:** a design round of its own, as before;
- **the side worlds,** until the author decides they ship;
- **the storefront** (left out by the author's choice).
