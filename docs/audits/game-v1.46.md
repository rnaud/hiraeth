# Hiraeth against what makes a great game (October 2026, v1.46)

<!-- audit-scores
overall: 3.8 / 5
label: the twelve themes, weighted (themes 3-8 count double)
date: 2026-10-11
-->

The third audit against the twelve themes of
[what-makes-a-great-game.md](../what-makes-a-great-game.md), run with the `game-audit` skill
(`.claude/skills/game-audit/`). It follows [the v1.0 audit](game-v1.0.md) and 46 releases since, built in
three days. The biggest changes:
- **Progression:** you start with empty hands, and the sword and the shield are found in the Givers'
  House (v1.38, v1.44).
- **Worlds:** Vael, Lorn and the Glass Dunes are merged worlds; the Underwater City, the Moon Foundry and
  the City Floating in Space are new route worlds; the Overnight Train moves.
- **Combat:** the flurry, the hops and an Ocarina-style lock-on.
- **Between worlds:** the chime-pirates rail shooter.
- **Quests and the screen:** quests complete on their goal, nobody sends you on to somebody else, hints
  are one line, and one notice shows at a time.
- **Finds, rendering and speed:** chests that earn their place, the air pillars, shadows, and the still
  meshes drawn in a few batches.

**Evidence:**
- three read-only surveys of the code, against every v1.0 finding and every open issue;
- a capture pass in muted headless Chrome:
  - the default plan: a first-time title, a new game left idle for about 70 s, settings, six worlds,
    Home, the Lantern and the Arena;
  - a second plan for what is new: the three new worlds, the train, the Glass Dunes, the pirates and
    the desert's screen;
- the level design audit's script (`scripts/level-design/audit.mjs`), run on all twelve route worlds,
  the three new ones for the first time;
- the docs and the device numbers in `docs/systems/performance.md` and `docs/systems/xbox.md`.

**What is not verified:**
- **No outside playtest.** No one but the author has played any of v1.1–v1.46. That's about 54,000 new
  lines of JS: the empty-hands start, three worlds, the pirates, the flurry. The author's own
  playthroughs drove much of it (issues #58–#91), which is a real change, but it is one player who
  knows the game.
- **Never heard.** No one has heard any of the sound or music; every run is muted.
- **Not timed.** The minutes to the first fill and to the sword are estimates from stage counts
  (10–15 and 25–40 minutes).
- **Not audited since they were built:**
  - the flurry, the hops and the lock-on (the last combat audit is v1.22);
  - the three new worlds have no level design report: only the script's numbers below.

**What is verified:**
- every capture booted without a page error or console error;
- boot times: the desert 3.5 s, Vael 5.1 s, the City-Shaft 7.1 s (the slowest), the new worlds
  2.5–3.6 s, the pirates 1.2 s;
- the ship's idle nudge was caught this time ("Look around: move with WASD, look with the mouse").

## The scores

| # | Theme | v1.0 | v1.46 | In one line |
|---|---|---|---|---|
| 1 | Core experience and coherence | 3 | 3 | Empty hands makes every tool a find; breadth grew another 35% with three worlds, a shooter and a train |
| 2 | The first five minutes | 3 | 4 | You step out facing Qanat, one notice at a time, the fill at stage 6; the teaching lines are still English |
| 3 | Exploration and wayfinding | 4 | 4 | The merged worlds joined, foes swept away in water; the desert fell to 3.44 and the climb back is unchanged |
| 4 | Rewarding exploration | 4 | 4 | The sword and shield are real finds and chests earn their place; trials, Sightings and traces are unchanged or worse |
| 5 | Narrative and harmony | 4 | 4 | Empty hands rhymes with the ending, foes go in a puff; a forced space fight on every first flight |
| 6 | Arc and pacing | 3 | 3 | The finale is still one conversation; the gap before it grew to about five worlds |
| 7 | Art direction | 5 | 5 | The three new worlds hold the style; the type split is still open |
| 8 | Audio | 4 | 4 | Unchanged in substance; foes synth and not placed; never heard |
| 9 | Game feel | 4 | 4 | Quicker swings, mid-air combos, hops; the motion QC is 11 of 15 red |
| 10 | Combat | 3 | 4 | Dodge into a flurry, a clear lock-on, nothing to fight before the blade; the new moves are unaudited |
| 11 | Accessibility and UX | 3 | 3 | The "push with X" lines are gone, new literal key names came in; 305 English toasts |
| 12 | Quality, performance, discovery | 2 | 3 | Devices measured again, 449 test files, an author's feedback channel; still no outside playtest |

Weighted (themes 3–8 count double): **3.8 / 5, up from 3.7.**

The gains are in themes 2, 10 and 12. Most of the three days answered the author's own playthrough of the
desert (issues #58–#91), and it shows in the first minutes and the fight. The scores that held hide
movement inside them:
- theme 6 got worse inside its 3: a longer gap before the finale, and a forced shooter before every new
  world;
- theme 4 lost the detour traces;
- theme 3's desert fell in the level design audit.

## What happened to the v1.0 investments

| # | Investment | Status |
|---|---|---|
| 1 | Watch three people play, add opt-in telemetry | **Not done.** `TODO.md:8` now reads "Playtests are not listed here: the author plays all the time". The Notes page and the screenshot drafts (v1.46, `worker/drafts.js`) are a feedback channel for the author only. No telemetry in `src` |
| 2 | Measure v1.0 on the Retroid and the Deck | **Mostly done.** Every world on the Deck again, the Retroid in GeckoView: the merged worlds at 58–60 fps (972e9c5a; issue #19's comment). The Xbox desert spawn went 18 → 21 fps (v1.45, `src/static-batch.js`), short of its 30 fps aim |
| 3 | Finish the prompt and language plumbing | **Partly.** All 11 "push mode: X or the D-pad" lines and "aim with R… then G" are gone. New literal pad names came in (theme 11). Toasts still skip `t()`. The debug entries are shown to everyone by the author's call (`src/dev-gate.js:13-14`). The Lantern is still missing from `ALL_QUESTS` |
| 4 | Give the finale some play, close the threads | **Not done.** `src/story/lantern-data.js:38-45` is still one stage; `src/story/sightings.js:23-28` has only `ask` |
| 5 | Frame combat in the story's terms | **Partly.** Foes go out in "a little puff of pastel smoke", small creatures trot off dazed, and nothing fights you before the blade (`docs/systems/progression.md`, "Nothing to fight before the blade"). A chasm still makes a foe "gone" (`src/foes.js:236`), and foes still burn |
| 6 | Make the trials' rewards land | **Not done.** `src/trials/upgrades.js:18-29` is unchanged. The desert's trial still upgrades the lens from world 8, the Buried Machine's the bombs, the Spheres' the recall |
| 7 | The desert's real fill earlier | **Partly.** The fill is stage 6 of 17, not 7 of 14, and Ama's jar errand is gone. But the quest grew to 17 stages, and the early shot of dregs went with the gun (`src/story/desert.js:146`) |

## 1. Core experience and coherence: 3

**Better**
- **Empty hands** gives the game a spine. The sword, the shield, the backpack, the double jump and the gun
  are each found, in order, and each is taught once when its chest opens (`docs/systems/progression.md`,
  "Empty hands"). It is the clearest the verbs have been.
- **Merges and dismissals.** Vael took in the Sky Stones and Lorn took in the Deep Wood; the Hangar and the
  Atelier left the route (`src/levels/names.js`).

**Weak**
- **Breadth kept growing.** `src/` is about 210,000 lines of JS against 156,000 at v1.0. v1.40 added three
  full route worlds, and v1.43–v1.45 added the pirates, the moving train and the night mail. There are
  twelve route worlds again.
- **Stale text after the merges and the jets,** some of it in front of players:
  - the Worlds page's blurb still says "The makers' jets wait in their tower on the rim" for the City-Shaft
    (`src/levels/index.js:42`, shown by `src/game-menu-data.js:93`), but the jets are debug-only since
    v1.38;
  - the Glass Dunes' boxes and temple are still keyed `garage`;
  - `src/finds/courts.js:6-15` still names the Hangar.
- **`TODO.md` lists done work as open:** #7 (the sword found, v1.44) and #8 (the drafts, v1.46).

## 2. The first five minutes: 4

**Better**
- **The landing.** You step out facing Qanat, 70 m nearer: its first goal is 212 m off, not 391 m
  (9f55e63f; capture `10-desert`).
- **One notice at a time.** `NOTICE_ORDER` in `src/ship/cinema.js` (`docs/systems/ui.md`, issue #78). The
  capture of the landing shows only the region's name and one line.
- **Straight to the point.**
  - Nour points you at the skull: no jar, no Speaker's verse (issue #63).
  - The fill is the 6th stage (`src/story/desert-data.js:84-120`).
  - Steps already done are skipped (`Quests.openAhead`).
- **The ship's nudge** shows, using the player's own inputs (capture `02-new-game-2`).

**Weak**
- **The teaching lines are English only.** `src/first-steps.js:26-27` and `src/ship/prologue.js:79-80` are
  outside `t()`.
- **Debug is on the title for a first-time player** (capture `01-title-new-player`; `ALWAYS_DEV = true`). It
  is the author's call, recorded in `src/dev-gate.js:13`, but it is the first menu a stranger sees.
- **The first fluid moment is later in kind.** The early shot of old dregs went with the gun. The first
  thing the fluid does is the pool, an estimated 10–15 minutes in.

## 3. Exploration and wayfinding: 4

**Better**
- **The merged worlds are joined:** the riders' gate and lanterns, the rope-way stones, the keepers' light,
  the float-posts and the wave's cairn (v1.44, `docs/systems/worlds.md`, "The merged worlds' crossings").
- **A foe knocked into water** is swept away (`src/foes.js:535`).
- **The drone** names its goal at once, and the distance counts down live (issue #65).
- **The new worlds score well** in the level design audit: the Underwater City 4.44, the Moon Foundry 4.11,
  the City Floating in Space 4.22.

**Weak**
- **The level design mean fell, 4.38 → 4.20** (v1.23's eleven worlds against today's twelve). The desert went
  4 → **3.44**:
  - its loops score 2: three walks back, two with nothing new;
  - wayfinding 3: only 50% of its long legs see their goal;
  - a 398 m empty stretch.

  The empty-hands rewrite added stages without adding ways home.
- **The Buried Machine's climb back** to the wheel is unchanged (`src/story/buried-data.js:40`; issue #42).
- **Height is the weak criterion in the newer worlds.** Verticality is 2 in the Moon Foundry, the City
  Floating in Space, the Glass Dunes and the Garden of Spheres.
- **The arrival views of two new worlds are mostly empty floor:**
  - the Underwater City's dock is a wide bare tiled plaza before the tunnel (capture `30-underwater`);
  - the Moon Foundry's apron is a broad field of bare ground, with the foundry 150 m off (capture
    `31-moon-foundry`).

  The script scores their density 5 because it measures the path, not the first frame.
- **The drone still never points at relics,** by design (`src/scout.js:103`).

## 4. Rewarding exploration: 4

**Better**
- **The sword and the shield** are the best finds in the game now: half-way through and at the end of the
  Givers' House, each the key to the house's next rooms.
- **Chests earn their place.**
  - No free chests by the ship.
  - Courts are 37–49 m from the ramp, everything else 60 m or more, mostly in temples.
  - Nothing is fired from a chest before you have something to fire it with.

  (`docs/systems/progression.md`, "Chests earn their place"; issues #81, #83, #91.)
- **More uses for gadgets.** Bombs crack shellbacks and carts; the boomerang pops lanterns and cuts
  marionette strings (`src/enemies/archetypes.js`).

**Weak**
- **The trials' rewards** are still numbers on a gadget, and three still come before you own the gadget
  (`src/trials/upgrades.js:18-29`).
- **The Sightings threads** never close after the Lantern answers them (`src/story/sightings.js:23-28`).
- **The detour traces are gone from play.** All seven side worlds are on the `WIP` list
  (`src/levels/names.js:46`), so the twelve traces v1.0 counted can't be met, except the train's chalk mark.
- **The new worlds are thinner in finds:**
  - two chests each, against three in the older worlds;
  - no gadget court;
  - the bubble wand and the hook still have no use outside their court.

## 5. Narrative and harmony: 4

**Better**
- **Empty hands rhymes with the ending.** "Come with empty hands. Just come." (`src/story/lantern-data.js:12`)
  is now how the game opens.
- **Unarmed, nothing fights you.** Combat starts only when you take the blade, and the blade's house is off
  the main line.
- **Foes go in a puff of smoke,** and small creatures are bonked and trot off.
- **Nobody sends you to somebody else** in any world (v1.46, issue #85). Conversations are shorter and say
  where things are.
- **The father's first message after the desert** is bitter and coherent ("Nobody ever comes", issue #90).

**Weak**
- **The chime pirates are forced on every first flight** (`src/ambush.js:24-31`; not skippable since v1.45),
  pay chimes per kill and grow fiercer. For a traveller who has chosen not to take the blade, the first
  fight of the game is a mandatory space shooter. Only Enemies off avoids it.
- **Viridel is still not a choice** (`src/story/edena-data.js`).
- **Saying no to Hollin, or keeping Dov's token,** still gets no line at the stone: `choiceLines` speaks
  only for `kept` and `made` (`src/story/ending.js:166-167`).
- **A chasm still makes a foe "gone",** and foes still burn.

## 6. Arc and pacing: 3

**Better**
- **The credits** name every world, the new three with their temple people (`src/story/ending.js:380-388`).
- **The desert's beats are tighter:** one person at a time, straight to the end.

**Weak**
- **The finale is still one conversation** (`src/story/lantern-data.js:38-45`). It is the peak the twelve
  worlds point at, and there is still nothing to do there.
- **The gap before it grew.** Home opens after any six worlds, but the finale needs the Signal Market, now
  12th. That leaves about five worlds pulled on only by the voicemail.
- **The desert is 17 stages** against 7–10 elsewhere, still about twice any other world.
- **The forced pirates** add a fixed few minutes before each of eleven first arrivals.
- **The Done list is missing quests.** `src/story/all-quests.js` still has no Lantern. It also lacks the
  night mail and every temple quest, which are built at run time (`src/temples/index.js:232`). For the
  Glass Dunes and the three new worlds the temple quest is the whole main thread, so their main quests never
  show as done outside their world.
- **The new worlds' stories are thin.** Each is its temple's quest plus two errands of one or two stages
  (`src/story/underwater-people.js`, `moonfoundry-people.js`, `spacecity-people.js`). The Glass Dunes has 43
  lines of story. `src/story/incal-data.js` is 804.

## 7. Art direction: 5

The captures hold the style everywhere, the three new worlds included: the Underwater City's glass tunnels,
the Moon Foundry's hanging moons and the City Floating in Space's rose terraces against the planet.

Better: shadows in tight places. The Shadow Room and its QC took the contact gaps on the Deck and Handheld
from 9–51 cm to 0–3 cm (v1.45). The cave's lit seams are fixed.

Still open:
- **The type split.** `index.html` has 19 monospace declarations: the cue, the restart card, the panels.
  Now the quest goal is in Avenir inside the mono cue, and the pirates' card is mono (capture `35-pirates-0`).
- **The traveller's face** is redrawn, and the close-up during conversations is gone; that's fewer close
  views, not a fix.

## 8. Audio: 4

Unchanged in substance since v1.0, and never heard.
- **Foes:** each kind has its own voice (`src/foe-voices.js`), but all synthesised and not placed:
  `foeHurt` and `foeWarn` take no position (`src/audio.js:1937, 1961`).
- **The music** is 106 MB (`public/music`, 27 files), up from 103. The packaged builds carry three themes
  and fetch the rest (`src/music-store.js`).
- **The singing light's theme** is still synthesised in the game (issue #27).

## 9. Game feel: 4

**Better** (v1.39–v1.42):
- quicker swings without the odd first wind-up, a held charge, mid-air combos, and strafing without pops;
- the back flip and the side hop, with dodge frames;
- the camera steady in tight places (the camera QC).

**Weak**
- **The motion QC is 11 of 15 red** (`docs/systems/animation.md`). Pops went 19.1 → 10.2 a minute, but the
  desert still has 46 a minute in the game, and the slide at starts and stops got worse (21.9 → 29.4 cm).
  Issues #47 and #57.
- **The feel is still tuned by one person.**

## 10. Combat: 4

**Better**
- **A perfect dodge opens the flurry:** 3.5 s of slow time, untouchable, a 6 m pull-in
  (`docs/systems/foes.md`).
- **The lock-on** is four gold arrows, Ocarina-style. The gun aims at the locked foe.
- **No red warning on wind-ups:** the body shows the blow.
- **It fits the theme better:** puffs of smoke, nothing to fight before the blade, Enemies off for those who
  want no fights.
- **The v1.22 combat audit** scored the roster 4.51.

**Weak**
- **The new moves aren't audited.** The flurry, the hops and the lock-on came after v1.22.
- **No colour-vision check** of the gold arrows, the reticle states or the body telegraphs, and none at a
  handheld's size with Reduce motion on.
- **Still no stakes, by design:** a knockout restarts you where you last stood safely.

## 11. Accessibility and UX: 3

**Better**
- **The "push mode: X" lines are gone** (none left in `src`).
- **A quieter screen:** one notice at a time, one-line hints, no "press Y to go back to the ship".
- **The conversation panel** never moves while you read.

**Weak**
- **New literal key names** that don't follow remapping or the pad. `keyText` (`src/game-menu.js:440`)
  rewrites only `{key:…}` placeholders, so these stay fixed:
  - ten gadget and item cards with "RT / R2 (T, or the middle mouse button)": `src/gadgets/bridge.js:255`,
    `recall.js:149`, `springs.js:170`, `lens.js:126`, `magnet.js:176`, `fan.js:159`, `gun.js:62` and others;
  - the trials' control cards (`src/trials/index.js:39-46`);
  - Vael's notices ("hold A / ×", `src/story/arzach.js:253-254`).
- **305 toasts and notices pass literal English,** none through `t()` (about 243 at v1.0). The French
  layer's 407 keys cover menus only, while three worlds of text came in.
- **The settings page grew to 25 rows,** the developer rows beside them.
- **Stale:** `src/save-slots.js:1` still says five slots (`SLOT_COUNT = 3`).

## 12. Quality, performance, discovery: 3

**Better**
- **Tests:** 449 test files and about 3,076 tests, up from 295 and 1,980.
- **Devices measured again:**
  - the Retroid in GeckoView: the merged worlds at 58–60 fps;
  - every world on the Deck;
  - the Xbox's load split into phases: 139.7 s cold, 29 s warm, 51 s after a relaunch.
- **The Xbox's frame:** 18 → 21 fps at the desert spawn, with draws 945 → 355 from the static batches.
- **A feedback channel for the author:** the Notes page files GitHub issues, and the debug menu saves a
  screenshot as a draft (v1.46).

**Weak**
- **Still no outside playtest or telemetry.** Investment 1 from v0.97 and v1.0 is still open, and the
  author has written it off (`TODO.md:8`).
- **The Xbox misses its 30 fps aim:** 21 fps, main thread 46 ms.
- **The browser play-through** (`scripts/playthrough-browser.mjs`) has no ending checks. It still expects
  "the drone finds Marrow by the ship", which may be stale since the desert's rewrite.
- **Photo mode** still downloads `moebius-….png` (`src/main.js:1394`): the old name, and no share.

## Where I would invest

Ranked by improvement per hour of work.

1. **Watch three people play.**
   - *Cost: a day.*
   - *Why:* still first. Forty-six releases changed the start, the progression and the fight, and only
     their author has played them. The author's own playthrough produced about thirty issues in a day (#58–#91); a
     stranger's would find the ones he can't see: where the unarmed player looks for the blade, whether
     the pirates read as a welcome or a toll.
2. **Fix the quiet bugs and the stale text.**
   - Put the Lantern, the night mail and the temple quests in the Done list.
   - Update the Worlds page's blurbs (the jets, the Hangar, `garage`).
   - Fix the five-slots comment and photo mode's file name.
   - *Cost: an hour or two.*
3. **Finish the key and language plumbing.**
   - `{key:…}` placeholders in the gadget cards, the trials' cards and Vael's notices.
   - Route the toasts and the teaching lines through `t()`.
   - *Cost: low to medium.*
4. **Give the finale some play, and close the threads.**
   - A short last stretch on the Lantern's island with the verbs.
   - Answered Sightings threads after Ilen.
   - Put the detour traces somewhere a player can reach while the side worlds are WIP.
   - *Cost: medium.*
5. **Make the trials' rewards land:** re-order them, or upgrade a gadget already owned.
   - *Cost: low.* Third time on this list.
6. **Give the three new worlds a second thread and a first frame.**
   - A quest beyond the temple, and a gadget court each.
   - Something in the empty floor at the Underwater City's dock and the Moon Foundry's apron.
   - *Cost: medium.*
7. **The desert's ways home.**
   - Two of its three walks back pass nothing new since the rewrite (loops 2, 3.44 overall).
   - Seventeen stages is still twice any other world.
   - *Cost: medium.*
8. **Check the new fight with the senses it relies on.**
   - A colour-vision pass over the lock-on, the reticle and the telegraphs.
   - A combat review of the flurry, the hops and the lock-on.
   - *Cost: low.*

What I would not invest in now:
- **more worlds or systems:** three worlds came in after the last audit asked for a freeze;
- **the storefront** (left out by the author's choice);
- **more rendering work** beyond what the shadow, visual and ink-line QCs already list.
