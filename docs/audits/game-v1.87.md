# Hiraeth against what makes a great game (October 2026, v1.87)

<!-- audit-scores
overall: 4.2 / 5
label: the twelve themes, weighted (themes 3-8 count double)
date: 2026-10-19
-->

The eighth audit against the twelve themes of [what-makes-a-great-game.md](../what-makes-a-great-game.md), run with the
`game-audit` skill (`.claude/skills/game-audit/`) for issue #556, the design half of the full audit (#467 was the last).
It follows [the v1.85 audit](game-v1.85.md) by a day and two releases: **38 changelog lines** (v1.86 28, v1.87 10),
against 501 between v1.59 and v1.85. What landed, in short:
- **The v1.85 list:** the fight temples written into the story (#483) and reviewed (#482, then #532–#534), the surplus
  fragments given wares and an ending that counts them (#481, #519, #520), the review page's fourteen temple endings and
  the two climaxes that filmed walls (#490, #491, #528, #529), the Glass Dunes' west on a path and Lorn's Hush-House in
  sight (#475, #476), the Footprint's lens, three houses reordered (#477), the long talks and the keepers' up and down
  (#478, #479, #480).
- **New:** the courts' and little chests' locks (#518), a controller layout with a gadget wheel that pauses the game
  (#511, #512, #524), Plumb talking in the dialogue box (#543), the Unity version's menus at parity (#264).

**Evidence:**
- three read-only surveys of the code against every v1.85 finding, theme by theme (story and pacing; feel, UX, quality;
  combat), plus one of the dialogue;
- one muted headless Chrome pass of the default plan (18 views, port 5590, at `f12bba095`);
- the design half's other audits, run beside this one on the same commit: level design
  ([level-design-v1.87.md](level-design-v1.87.md)), temple design ([temple-design-v1.87.md](temple-design-v1.87.md)),
  quests ([quest-v1.87.md](quest-v1.87.md)), dialogue ([dialogue-v1.87.md](dialogue-v1.87.md)), cinematics
  ([cinematics-v1.87.md](cinematics-v1.87.md)) and combat ([combat-v1.87.md](combat-v1.87.md));
- the last 30 test runs on `main` and the open issues.

**What is not verified:**
- **No outside playtest,** for the eighth audit running. Nobody but the author has played the reworked houses, the fight
  temples since their retune, the new controller layout or Plumb's talk.
- **Never heard.** Every run is muted; the mix (#530) and the glove's sounds (#531) are judged by their numbers.
- **No device.** The technical half of #556 measures the frames on the Retroid, the Deck and the Xbox.
- **No localisation question** (the author's wish), and the seven discarded side worlds are not audited.

**What is verified:**
- every capture booted with no page error and no console error;
- boot times on the Mac (load 25–48 during the pass, higher than v1.85's 6–16): the Desert 4.7 s, Vael 5.2, Lorn 5.6,
  Viridel 3.7, the Underwater City 3.6, the City-Shaft 6.8, the Glass Dunes 4.6, the Buried Machine 4.4, the Moon
  Foundry 4.2, the Garden 6.3, the City Floating in Space 4.6, the Signal Market 4.9, Home 3.1, the Lantern 2.6, the Arena
  2.7 (v1.85: 2.4–6.1, the same range);
- `main`: 19 of the last 30 test runs green, 5 red and 5 cancelled (27 of 30 green at v1.85). Each red was fixed by the
  next push or two.

## The scores

| # | Theme | v1.85 | v1.87 | In one line |
|---|---|---|---|---|
| 1 | Core experience and coherence | 3 | 4 | The fight temples and the fragments are in the story now; two short versions; but the chests' locks came without their quest gate |
| 2 | The first five minutes | 4 | 4 | Unchanged: the first fill the 6th of 18 steps, two steers in the first minute; R3's camera turn taught nowhere but Controls |
| 3 | Exploration and wayfinding | 5 | 5 | 4.73 over twelve worlds (4.68), the best yet: the Glass Dunes' west on posts, Lorn's house lit |
| 4 | Rewarding exploration | 4 | 4 | The fragments buy a notebook, a lamp, a tune and a chart, and the ending counts them; box quests sent before their tool |
| 5 | Narrative and harmony | 4 | 4 | The spring-houses in the bible; the fight hosts one template; the tune makes the song whole before Ilen does |
| 6 | Arc and pacing | 4 | 4 | Unchanged: the Lantern's peak still three lamps and a whistle |
| 7 | Art direction | 5 | 5 | Every world in the captures holds the style |
| 8 | Audio | 4 | 4 | The recordings' mix and the glove's sounds fixed (#530, #531); the light's theme still synthesised (#27 closed, not planned) |
| 9 | Game feel | 4 | 4 | The pose after stopping guarded (#551 open); no motion QC since v1.66 |
| 10 | Combat | 4 | 4 | The fight temples' curve and hazards fixed; the lock camera green; five guardians' blows land past their bodies |
| 11 | Accessibility and UX | 4 | 4 | The wheel pauses the game; still no colour-blind option; the fight temples' camera pull ignores Reduce motion |
| 12 | Quality, performance, discovery | 3 | 3 | 784 test files (713); 19 of 30 runs green; the Deck's web journey now unreachable; no playtest |

Weighted (themes 3–8 count double): **4.2 / 5, up from 4.1** (75 / 18 = 4.17; v1.85 74 / 18 = 4.11).

The one movement is theme 1. At v1.85 the score was held by breadth arriving faster than anyone plays it and new systems
built beside the story. This time the versions were short (28 and 10 lines) and the two systems beside the story, the
fight temples and the fragments, were woven in. The pattern is not gone: the little chests' locks (#518) came with a
quest that can be given before its tool, which is the same slip the quest QC has found at every audit.

## What happened to the v1.85 investments

| # | Investment | Status |
|---|---|---|
| 1 | Watch three people play | **Not done**, eighth audit in a row. Not filed: the author keeps playtests off the tracker |
| 2 | The review page's gaps: the temple endings (#490) and the two climaxes (#491) | **Done.** The fourteen are on the page as "Temple endings" (`src/cinematics-page/catalog.js:10-12`), QC'd and fixed (#528, #529, after a revert for a slow test); both climaxes back to tech 5 with a test that no solid stands between a lens and its subject |
| 3 | The Glass Dunes' west and Lorn's legs (#475, #476) | **Done.** The Glass Dunes 4.22 → 4.67, Lorn and Vael 4.67 → 4.78 ([level design](level-design-v1.87.md)) |
| 4 | Give the surplus fragments an answer (#481) | **Mostly done.** Notebook pages, the hold's lamp, the tune and a chart (`src/fragment-shop.js:32-35`): 206 of the fragments now buy something, 82 still nothing, and nothing new comes on sale past 150. Ilen answers in five steps (`src/story/lantern-data.js:69-75`), the lamp goes in the round window and the credits count them (`src/story/ending.js:369, 463`), at the true ending only (the first homecoming counts nothing) |
| 5 | Review the fight temples' combat and write them into the story (#482, #483) | **Done.** [combat-fight-temples-v1.85.md](combat-fight-temples-v1.85.md) (3.74), its curve and hazards fixed (#532, #533) and the crowd made readable (#534); the spring-houses in `docs/story-bible.md:624-661`, every host wanting their place back. #535 (move variety) set aside by the author |
| 6 | The Footprint's lens and the houses alike (#477) | **Done.** The Footprint 1.8 → 2.55 obviousness; the Lamp-House and the Greenhouse no longer 69 % like another ([temple design](temple-design-v1.87.md), 4.40 as before) |

## The design half, in numbers

| Audit | v1.85 | v1.87 | The movement |
|---|---|---|---|
| Level design (twelve route worlds) | 4.68 | 4.73 | The Glass Dunes 4.22 → 4.67, Lorn and Vael 4.67 → 4.78; the Desert 4.22 the weakest, its 263 m blind leg still |
| Temple design (fourteen houses) | 4.40 | 4.40 | #477's reworks traded points inside their rows; the Mooring-House's three far keys, the Footprint's last obscure steps |
| Quests (sixteen places) | 4.94 | 4.88 | Every v1.85 finding fixed and tested; box quests given before their tool in eleven worlds (#518's locks) |
| Dialogue (eleven areas) | 4.09 (v1.66) | 4.18 | The hosts, names and fragments' words of v1.66 fixed; the twelve fight hosts a new template, Anselm's lamp at the parents' stone |
| Cinematics | 4.57 | 4.53 | All 112 played, the fourteen temple endings for the first time in a full pass: every v1.85 issue held (the 98 others 4.62), but the endings are one film in every house, interest 3.4 (#562) |
| Combat (kinds and guardians) | 4.63 (v1.63) | 4.51 | The kinds hold (4.61, the ember wisp added); the guardians 4.66 → 4.34: five land blows past their bodies (#558), the Mother Snapper a puzzle by design; the fight temples' curve fixed (the Sunken Hall 2.58 → 0.42 of his hearts) |

## 1. Core experience and coherence: 4

**Better**
- **The fight temples belong to the story:** the makers built them over springs where the dark wells up, the people by
  their doors want their mill, cranes or gardens back (`src/story/hosts-data.js:81-152`), Plumb, Sabri and Teasel speak of
  the ink (`src/companion.js:62`, `src/temples/desert-data.js:18`), each run ends with the place going quiet and its
  keeper coming back in (`src/fight-temples/session.js:534-537`); `tests/fight-temples-story.test.js`.
- **The fragments have an end:** the count is hidden (#519), Anselm sells what a collector wants (#520), the ending counts
  them.
- **Versions a player can take in:** v1.86 28 lines, v1.87 10 (v1.84 61, v1.85 49).

**Weak**
- **New gates still arrive without their quest gate:** every court's and little chest's lock (#518) needs a tool the box
  quest doesn't wait for (finding 1 of the [quest QC](quest-v1.87.md)).
- **What you see in a fight temple is still a clearing:** the ink thrown with a "wet thump" (`src/fight-temples/kill-fx.js:9-12`),
  "Foes felled 23" on the card, beside a story that says nothing living is hurt (`docs/story-bible.md:646-648`).

## 2. The first five minutes: 4

- **Unchanged:** the first fill is the 6th of 18 steps (`src/story/desert-data.js:108`), Plumb steers to the village and
  Marrow to the singing fragment in the same minute (`src/companion.js:56-57`, `desert-data.js:146-150`), the first goal
  212 m off (onboarding 3 in the level design audit). Captures `02-new-game-0…3`: the ship, "Look around: move with WASD,
  look with the mouse", the walk out.
- **The new controller layout teaches itself:** D-pad → for Plumb after the first talk (`src/scout-hint.js:41-48`), the
  wheel through the mode prompt "D-pad ↑ held" (`src/prompt-keys.js:80`). But R3 turning the camera behind you
  (`src/main.js:1760-1762`) is only on the Controls page.
- **Plumb's talk is rare** (lost: 180 s without progress, then 300 s between; never while riding or fighting;
  `src/companion.js:163-176`) and cannot fire in the first minute.

## 3. Exploration and wayfinding: 5

4.73 over the twelve worlds, the best measured ([level-design-v1.87.md](level-design-v1.87.md)): every long leg guided
in eleven worlds, no empty walk back anywhere. Left: the Desert's roots → the hollow, 263 m blind on the bike, ranked at
v1.66 and v1.85 and never done.

## 4. Rewarding exploration: 4

- **Better:** the fragments buy things that are not numbers (a notebook a page at a time, a lamp that brightens, the tune,
  a chart that marks the rest on the Map); every little chest is now a puzzle's reward (#518), four courts that had no
  chest have one.
- **Weak:**
  - **Box quests point at locks you can't open yet:** in eleven worlds the box's tool is that world's own temple's, but
    its quest is given as soon as you have found any box (`src/boxes/index.js:317`). #557.
  - 82 fragments still buy nothing, and the first homecoming never counts them.
  - The upgrades are still numbers (`src/items.js:289-319`); the new court charm (the recall reaches further) is another.

## 5. Narrative and harmony: 4

- **Better:** the dialogue review rose 4.09 → 4.18: the old hosts in their own voices, the near names renamed with a test,
  the fragments' words hedged ([dialogue-v1.87.md](dialogue-v1.87.md)); every quest giver held to six pages
  (`tests/short-talks.test.js`).
- **Weak:** the twelve fight hosts share one template ("Clear the X and I'll Y again", eight of twelve); Anselm's tune is
  "the whole tune, as the light sang it" before Ilen gives the song back; his lamp walks into the parents' stone between
  two of Ilen's lines. #559.

## 6. Arc and pacing: 4

Unchanged: the peak is three lamps and a whistle at the Lantern (`src/story/lantern-data.js:57, 300`), the finale waits
on the Signal Market (`src/story/ending.js:75, 106-117`). The temple endings are now reviewed and frame their reward.

## 7. Art direction: 5

The captures hold the style in every world (the Desert's village under its plume, Lorn's lamps and crystals, the Glass
Dunes' green glass and clock, the Lantern at dusk). The outfits (#540–#549) and the Blender traveller (#493) are work in
progress beside the game, not yet in it.

## 8. Audio: 4

- **Better:** the recordings raised from −27 to −21 dB RMS, voice over music 9.5 → 3.6 dB (#530,
  `src/changelog.js:316-323`); every glove mode its own sound, the repeated ones varied (#531); Plumb's chirp.
- **Weak:** the singing light's theme is still the synth (`public/music/manifest.json:202-206`; #27 closed as not planned).
  All judged by numbers; nothing heard.

## 9. Game feel: 4

- The traveller's talking pose let go at once (v1.87); a ragdoll keeps its fall (v1.86). #551 (the pose after a walk)
  stays open until the author confirms.
- **Weak:** no motion QC since v1.66 (`docs/audits/motion-v1.66.md`); the fight temples' combo a third quicker than the
  world's (`QUICK_CUT`, `src/fluid-blade.js:130`).

## 10. Combat: 4

- **Better:** the fight temples' curve is the right way up: the skilled bot loses 0.42 of his hearts in the Sunken Hall
  (2.58 at v1.85), 0.59 in the Flooded Gallery (2.0), and clears the Kiln Yard it could not (#532, #533; the
  [combat review](combat-v1.87.md)); the crowd is readable (#534); the lock camera gives way at a wall (#256), camera and
  lock-on 3 → 4; foes look at you (#508).
- **Weak:**
  - **five guardians' blows land 1.6–2.7 m past their bodies** (the Gardener, the Listener, the Foreman, the
    Tooth-Warden, the Last Founder): #319 made it green at v1.71 and no test kept it (#558);
  - the fight temples' harm leaves out two shops' hearts, 13 % low from Lorn on (#560);
  - the Kiln Yard still the spike (0.98 of his hearts, its tiles 44 % of it);
  - #535 (the combo and the roll the whole fight in the fight temples) set aside by the author;
  - no combat review has been played with a pad.

## 11. Accessibility and UX: 4

- **Better:** the wheel waits while you choose (#524), so no foe hits you meanwhile; the Quests page marks the tracked
  quest (#516); Plumb's mark is a shape, a hop and a chirp, not a colour alone (`src/scout.js:66-76`).
- **Weak:**
  - no colour-blind option, as before;
  - the fight temples' camera pull toward a hazard (`src/fight-temples/session.js:164-170`) doesn't read Reduce motion;
  - the house map's chest says "View shows its rooms now." (`src/temples/pieces.js:3469`), a button in prose, and since
    #487 the house map is only in that menu;
  - the Quests page says "the scout finds it" (`src/i18n/en.js:448`), the code's word for Plumb.
  These in #563. (What's new's "how to see it" notes for v1.85–v1.86 still say to open the Map from the
  Start menu, `src/changelog.js:128`, and to switch modes with "RT / R2 held, then the D-pad", `:304`; released entries
  are history, so noted only.)

## 12. Quality, performance, discovery: 3

- **Better:** 784 test files (713); the v1.85 findings now have tests (`keeper-direction`, `short-talks`,
  `fight-temples-story`); the Unity version's menus at parity (#264).
- **Weak:**
  - **`main` red more often:** 19 of the last 30 runs green, 5 failed, 5 cancelled, clustered on 19 October's batches
    (gh). Each was fixed within a push or two, as the memory's rule asks, but a red `main` stops the release.
  - **The Deck's web journey is now unreachable:** the Unity build starts a new journey (`docs/steam-deck.md:215-218`),
    and since #484 removed the web shortcut "no shortcut reaches" the old saves (`:228`). The author's decision; noted.
  - The Xbox still a preview; no playtest, no telemetry.

## Where I would invest

Ranked by improvement per hour of work.

1. **Watch three people play.**
   - *Cost: a day.*
   - *Why:* first for the eighth time. The controller layout, Plumb's talk, three reworked houses and the retuned fight
     temples are all unplayed by anyone else.
2. **Hold the box quests until their tool is had, #557** (quest finding 1).
   - *Cost: an hour.* The author's own rule from #518; eleven worlds; a test beside `little-chests.test.js`.
3. **The guardians' blows past their bodies, #558** (combat).
   - *Cost: an afternoon.* Five guardians fail the fairness measure #319 made green; a test would keep it.
4. **The fight hosts', Anselm's and Plumb's words, #559** (dialogue findings 1–3, 6, 9).
   - *Cost: an afternoon of lines.* The same pass the game hosts had at v1.67.
5. **The small fixes, #563** (Joss's "at the top", "View" in prose, Reduce motion in the fight
   temples, the near names).
   - *Cost: an hour or two.*
6. **The Desert's blind leg and the Mooring-House's far keys, #561** (level and temple design).
   - *Cost: a few hours each.*
7. **The fight temples' hearts on arrival** (#560) and **the temple endings' third panel** (#562).
   - *Cost: an hour for the count; a day for fourteen panels of their own.* The second is the author's call.

What I would not invest in now:
- **more systems:** the gates and locks of #518 show what a new system costs in quest rules;
- **the reward numbers:** a design round of its own, as before;
- **combat move variety in the fight temples** (#535): set aside by the author;
- **the side worlds** (discarded) and **localisation** (left out).
