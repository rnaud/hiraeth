# #722: why the enemies feel boring (diagnosis, 2026-10-27, read-only)

Source: main at `cb97e3eae`. Evidence: the code (line numbers below), the v1.90 audit's raw Arena data
(`.local-tools/validation/v1.90/full-audit/feel/cua-qa/arena-progress.json`, `packs-accepted-summary.md`), and three
fresh muted headless-Chrome runs of my own against the real route worlds (port 5461; the scripts and raw JSON were kept
in the study's scratch folder, not in the repository: `watch.mjs` → `shots/watch.json`, `probe.mjs` → `probe/probe.json`,
`packs.mjs`). Line numbers are main at `cb97e3eae`; the fight core (issue #722, v2.33) has since moved them.

Pictures: `encounters-sheet.jpg` (rows: Desert pack 4, Buried pack 4, Signal Market packs 3 and 4; each row: idle from
14 m, then the still-player fight at 2.5, 6 and 9.5 s). Every encounter is a foe or two on open, flat ground with
nothing round them; the Market's "packs" came out as one bell walker alone and one marionette alone with nothing to string.

The v1.90 rubric (readability, counterplay, space, fairness, identity, combines) scores each foe *in isolation, against
a still player, for 24 s*. It never asks how long the foe lives under ordinary play, how many of its moves a player
ever sees, or what the encounter around it is. Those three gaps are where the boredom is.

## 1. The shape of every fight (the AI, shared by all 22)

One state machine for every kind (`src/foes.js:752-896`): `idle` → `chase` → `wind` → `strike` → `recover` → `chase`.

| Phase | What it does | Evidence |
|---|---|---|
| Idle life | A sine-wave wander on a circle 0.8–7 m round its spawn point at 12–60 % speed, or standing still (coil, root, stand, toll, hang). A few bodies add a flavour loop (the heron stabs the water, the bell tolls softly, the brute slumps, the cart tips its pot). Nothing eats, sleeps, chats, guards anything or interacts with a prop or another foe. | `foes.js:897-951`; plans `stilt.js:118`, `siege.js:199`, `brute.js:201`, `tracked.js:230` |
| Notice / alert | Instant: same frame, `idle` → `chase`. No look, no roar, no pause, no "!" beat. The first time per kind, a text tip (`meet`). Measured: 0.05 s from provoke to chase in every watch. | `foes.js:755,759`, `foes.js:3283` |
| Alarm | Only foes of the **same kind** within `calm.alarm` m wake (the jelly joins anyone). A mixed pack wakes one by one as you walk into each one's provoke radius. | `foes.js:3271-3279` |
| Approach | Straight line at you (a grid route over ledges). Lizards: the second circles behind you. Skitters ring you at 4 m. `keep` kinds back off 1.1 s then stand. Flyers hide behind cover between strikes. | `foes.js:772-822`, `988-992` |
| Attack choice | Among the attacks whose `[min,max]` covers your current distance, weighted, the last one ×0.4. At any given distance usually one move qualifies, so a foe repeats one move. | `foes.js:523-556` |
| Tempo | cool 1.1–2.8 s + wind 0.6–1.6 s + strike ≈ 0.3 s + recover 0.8–1.9 s ≈ **one attack every 4–6 s per foe** (audit: 10–15 attacks/min for 20 of 23 kinds). Fresh watches: foes spend 35–47 % of a fight in `chase`, 25–37 % in `recover`, 22–28 % winding up. | `archetypes.js` defs; `shots/watch.json` |
| Between attacks | Stand facing you in `recover`, then walk at you; if two (three from stage 3) are already striking, a slow side-step circle at reach + 1.4 m. No feints, no repositioning for an angle, no backing off to bait. | `foes.js:127`, `806-811`, `988-992` |
| Retreat / flee | None in a fight. They go home only if you leave (`giveUp` + 8 m), healing as they walk. No low-HP fear, no morale. | `foes.js:762-763`, `888-895` |
| Coordination | A strike-token cap (2, or 3 from stage 3); keep 0.3 m apart; the lizard pair's flank; the jelly's ward/mend; the marionette's strings; the skitter heap. Nothing reacts to a packmate's death (`burst` touches no other foe). No combined moves except the marionette. | `foes.js:1780-1787`, `2548-2583`, `3271` |

## 2. Reactions to the player

- **Interruptible by anything early:** any light cut in the first two thirds of a wind-up cancels it (`foes.js:1530`);
  the blot (`flinchy`) reels from every cut; the third swing (damage 3 ≥ 2, `heavyRecoil`) staggers anyone not mid-strike.
- **Every reel resets its clock:** a reel sends it to `recover` (`foes.js:1534`), and leaving `recover` draws a fresh
  1.1–2.8 s cool (`foes.js:885`). So hitting a foe doesn't just interrupt it, it postpones its next attack by a full cycle.
- **Hit-stun:** 0.2–0.55 s (`hit`), doubled on a stagger. **Knockback:** horizontal only, 4 m/s decaying at e^-6t ≈ 0.7 m a
  light cut, ≈ 1.5 m the third swing; heavy kinds ≈ 0.25 m (`foes.js:1513`). **No launch, no juggle, no knockdown** of a
  walker (only flyers are "knocked low", `KNOCKED_LOW`; the heron topples to a charged cut; the toad flips to an air cut
  on its leap). The body's flinch is 0.14 m / 0.2 rad on springs (`foe-react.js:20-21`).
- **Feel on hit is good:** hit-stop 0.06–0.15 s, camera kick, flash, splash (`fluid-blade.js:1041`, `foes.js:2472-2500`);
  the killing blow adds a per-body defeat (`enemies/defeat.js`) and slow motion on the last.
- **The foes never defend:** no foe blocks, parries, sidesteps or dodges. "Defence" is static armour: the crab's front
  shell, the bell's bronze, a rolling roller, the centipede's plates, machine immunity to the gun (`foes.js:1412-1468`).
- **Tools/elements with a real answer:** ember lights the hound/shade solid and scatters skitters; a shot chokes a toad's
  swollen throat, douses a cart, pops a jelly lantern; bloom sleeps the root knot; push breaks the ring and the heap;
  bomb cracks the crab shell and jams the cart; the whistle chokes the bell's toll; the hook yanks/pins/downs
  (`foes.js:1404-1510`, `hook-foes.js`). World hazards hurt foes too (`feelWorld`), but packs rarely stand near any (§4).

## 3. Time-to-kill and danger

The blade's combo is **1 + 1 + 3 = 5 damage in ≈ 1.7 s** (`fluid-blade.js:29`). 18 of 22 archetypes have **HP ≤ 5**, so one
combo kills them (audit: combo TTK 1.7 s for 15 kinds, 0.5 s for skitter and moth). Only the centipede (6), cart (6),
bell (6) and brute (8) survive one combo; the hound (phased while running) and the crab/bell (glances) drag on for
mechanical reasons, not because they fight back. **Foe HP never scales with the world** (no HP factor anywhere), while
the traveller grows from 3 to 17 hearts along the route (`packs-accepted-summary.md`), gains the whirl at 20 ink and the
lunge at 40 (`ink.js:14-18`), plus gadgets. Only harm scales (×1.25 / ×1.5 at stages 3–4, `foes.js:321`), and no blow takes
you from above one heart to zero (`resources.js:104`).

Measured (fresh, `shots/watch.json`): a **still** player loses 2–6.75 hearts in 16 s, so foes do hit hard if ignored; a
**mashing bot** that only walks in and swings (no guard, no dodge, my cadence slightly slower and the third swing at 2
instead of 3) cleared 7 packs with **0 hearts lost in 6 of 7**, 1.5 hearts against the bell (12 s of glances). The audit's
scripted clears: 0.7–3 s per pack in 9 of 12 route worlds, 7.2 s in Spheres (`packs-accepted-summary.md`). The audit
itself notes a "quick-only bot remains competitive". Aggression beats everything, because of §2's interrupt + reset.

## 4. Encounters

- **Where packs stand:** nowhere in particular. A pack is generated when you have been ≥ 45 m from people and ≥ 55 m
  from the ship for 3 s, at a random bearing on a ring **18–26 m round you**, on whatever ground is there
  (`foes.js:2248-2268`, `105`). It follows you, like a random-encounter bubble. Only three foes in the whole route are
  placed by hand (`foe-worlds.js:59-63`: a Desert tripod, a Lorn II brute, a Spheres marionette), plus two foes round
  each relic and the temples' machines. So the roster doc's idle ideas ("backs into a crevice", "near its nest",
  "stands in its square", "hangs under bridges", "lies under a tree") cannot happen for 99 % of foes.
- **Packs are not groups:** members are spaced 0.35 rad apart on that ring, so they spawn **6–26 m apart** (median
  spread: Desert 6 m, Lorn 8, City-Shaft 20, Buried 23, Spheres 26; `probe/probe.json`). With per-kind alarms they
  usually trickle in one at a time.
- **Late packs collapse in built-up worlds:** placing the same packs from 12 wild spots per world (`probe.mjs`), the
  Signal Market placed **28 of 185** wanted members (all 36 packs short), the City-Shaft 76 of 141, Spheres 143 of 175;
  the Desert, Lorn and Buried place ~all. In my live Market run both packs came out as **one foe alone** (a bell; a
  marionette with no creature to string, which leaves it no role). The last world plays like the first.
- **Fillers are mostly blots:** fillers exclude groups (lizard, hound, moth, skitter), anything costing > 1.5 (tripod,
  cart, brute, bell, centipede, marionette) and the shade, then add +1 blot (`foe-worlds.js:104-105`). The Market's fill
  is crab 1.5 / blot 1 → its 5–6-foe packs are a lead plus 3–4 tutorial blots and a crab (`packs.mjs`: "hound + hound +
  blot + blot + blot + crab"). Buried fills with worms and blots; Moon Foundry with wisps and blots. Average distinct
  kinds per pack: 1.3–3.0.
- **Pacing:** one pack at a time; the next only after it is gone, then 35–55 s of rest (`foes.js:2619-2621`); left behind
  85 m, it dissolves. The first pack of every visit is the world's lead alone (`foe-worlds.js:132`). Roughly one
  10-second fight per minute of walking, all the same structure, for the whole game.
- **Terrain, height, hazards, rewards:** none designed. The ground under fresh packs varied 0.7–6.5 m over 16 m (dunes,
  not features). Foes can climb/hop ledges and fall off them, and hazards hurt them, but no encounter is built round
  that. Reward: chimes (`chimes.js` DROP_OF), ink toward three blade steps, one magic unit. No chest, camp, weapon, item
  or story at a fight; relic guards are the one fight with something to win.

## 5. Per archetype

"Fires in play": attacks seen in the audit's 24 s still watch (`arena-progress.json` winds) and my route watches; others
need a distance or condition the player rarely gives. HP vs combo: blows of the 1/1/3 combo to kill from the front.

| # | Archetype | Role | Idle (calm) / provoke | HP · combo blows | Moves (fires in play **bold**) | Mid-fight state change | Special reaction to the player | Where |
|---|---|---|---|---|---|---|---|---|
| 1 | Shellback crab | tank | grazes 2.5 m, backs off; 3.2 m | 3 · glances front (audit 6 blows) | **snap**, spin (1 in 6), burrow (Underwater skin only) | flipped 2.6 s by a guarded spin; shell cracked by a bomb (permanent) | front glances light cuts; parry-flip | Vael II, Underwater, Glass Dunes, Market (filler) |
| 2 | Skitter swarm | swarm | flock grazes, scatters; must linger 2.2 s | 1 · 1 | **rush** only; pile needs ≥ 2 mates in 7 m | none | ember scatters; push kills | Desert, Lorn, Buried, Moon Foundry |
| 3 | Ring centipede | trapper | coiled still; 6 m | 6 · 4 | **lunge**, ring (1 in 5) | tail sheds 2 skitters below 2/3 from behind | plates ½ from side/back; head ×2 in the ring | Buried, Spheres |
| 4 | Bellows toad | lobber | sits still; 4 m | 3 · 3 | **lob** only; volley (City-Shaft skin); flop 1.4–6 m rarely | choke (shot in throat), flipped (air cut on leap) | climbs to high ground (`perch`) | Lorn, City-Shaft |
| 5 | Horn lizard | flanker | basks; 6 m | 3 · 3 | **bite, blare**; whip only with you behind it | none | pair flank | City-Shaft, Buried, Moon Foundry, Market |
| 6 | Stilt heron | reach | wades, stabs water, flies off if run at; 2.8 m | 4 · 3 | **spear** only; sweep < 2.2 m; buffet (skin) | toppled 3 s by a charged cut | flies off instead of fighting | Desert, Vael, Lorn |
| 7 | Pearl roller | charger | grazes; 2.4 m | 4 · 3 | **bowl** only (2.5 attacks/min); ricochet (skin); last roll < 25 % HP: **never reached by the combo** (4 → 3 → 2 → dead) | stalls on a wall; last roll | immune while rolling | Spheres, Space City |
| 8 | Root knot | grappler | rooted, cap turns; 3.6 m | 5 · 3 | **grip→lash, lash**; puff (Lorn II skin) | asleep 3 s in a bloom | rooted: no knockback | Lorn, Lorn II, Viridel |
| 9 | Lantern jelly | support | drifts; joins any fight | 3 · 3 | **ward, curtain**; mend (skins) | lanterns popped by shots | wards a neighbour (½ harm, no stagger) | Vael II, Lorn II, Underwater, Spheres |
| 10 | Signal moth | disruptor | circles its lamp; 5 m | 1 · 1 | **flash** only (dart, dust rare) | none | comes as three; dies to anything | Lorn II, Viridel, Space City |
| 11 | Sky ray | air striker | circles; 7 m | 3 · 3 | **draft, skim** | buried/surfaced (dune skins) | air cut ×2 | Vael, Vael II, Underwater, Glass Dunes |
| 12 | Mound worm | ambusher | wanders; 2.6 m (often never engages) | 4 · 3 | **erupt, dive**; spit 3.2–7 m | buried ↔ surfaced | air cut onto the mound ×2 | Desert, Buried, Glass Dunes |
| 13 | Lamp tripod | sniper | patrols 7 m; 20 m | 5 · 3 | **beam** only at range; stamp/vent within 2.6/4 m | none | immune to the gun | Desert (placed), Underwater, City-Shaft, Buried |
| 14 | Crucible cart | area denier | trundles 6 m; 10 m | 6 · 4 | **pour, ram** | jammed (bomb), crust (shot) | slag patches stay | Buried, Moon Foundry |
| 15 | Bell walker | siege | stands, soft toll; 12 m | 6 · glances unless open (audit 12 s) | **toll, drop** | open after drop / whistle choke | bronze glances everything | Market (and side worlds) |
| 16 | Ring drone | tether | circles; 14 m | 3 · 3 | **harpoon, ram** | none | hides behind cover; immune to gun | City-Shaft, Glass Dunes, Spheres, Space City |
| 17 | Furnace brute | heavy | slumped, rusted; 7 m | 8 · 6 | **hurl** at range; slam/sweep close | none | stout: not interrupted by light cuts | Lorn II (placed), Viridel, Glass Dunes, Moon Foundry |
| 18 | Ink blot | rusher / teacher | pooled; 9 m | 2 · 2 | **lunge, combo→again**; spit 4–9 m | none | flinches from every cut | every world, and most fillers |
| 19 | Shade | duelist | paces a path; 5 m | 5 · 3 | **cut, feint, step→recut** | none | ember makes it solid | City-Shaft, Glass Dunes, Spheres (lead only, never filler) |
| 20 | Antler hound | stalker | lies in shadow; 11 m | 3 · phased while running (audit 12 blows) | **step→bite, pounce**; rake < 2/3 HP | rake unlocks at 2/3 | blade passes through while it runs | Spheres, Market |
| 21 | Marionette | puppeteer | hangs; 9 m | 4 · 3 | **strings, yank**; dance when alone | host driven, strings cut | needs a creature within 14 m: alone it has no job | Spheres (placed), Market |
| 22 | Ember wisp | bombardier | drifts; 15 m | 4 · 3 | **fireball** only (flare ≤ 3.2 m, keeps 7 m) | none | cut the ball back | Lorn II, Moon Foundry |

Across the 22: **one move dominates in practice for 11** (skitter, toad, heron, roller, moth, tripod, brute, wisp, crab,
centipede, blot's lunge); **true chains exist for 3** (blot combo→again, root knot grip→lash, shade/hound step→strike);
**a low-HP behaviour exists for 3** (roller's last roll, hound's rake, centipede's shed) and the combo skips two of them.

## 6. Deaths and feel

On hit: hit-stop, kick, flash and an ink/spark splash sized by flinch/stagger/shrug; armour has its own spark and thunk.
On defeat: a per-body recipe over 0.8–1.5 s (flip, roll, topple, sag, sink, land; `defeat.js:21-44`), then a puff of
smoke, chimes, ink, a magic unit; the last foe of a fight adds slow motion. This part is good; it just happens 1.7 s
after the fight started, so it is the most-seen animation a foe has.

## 7. The top 10 reasons they are boring (ranked)

1. **They die before they can show anything.** One 1/1/3 combo (5 damage, ≈ 1.7 s) kills 18 of 22 archetypes; a foe
   attacks once every 4–6 s, so most die before their second attack and never show their other moves, combos, or
   states. `fluid-blade.js:29`; HP in `enemies/archetypes.js` (dump above); audit combo TTK 1.7 s for 15 kinds.
2. **Attacking them shuts them off.** Any cut in the first ⅔ of a wind-up cancels it, the third swing staggers
   anyone not mid-strike, and every reel restarts the 1.1–2.8 s cooldown. Mashing wins: 0 hearts lost in 6 of 7 live
   packs. `foes.js:1530`, `1534`, `885`; `shots/watch.json` mash rows.
3. **Encounters are random spawns on a ring round you, not places.** 18–26 m out at a random bearing, on whatever
   ground is there, one at a time, every 35–55 s; only 3 foes on the route are placed by hand. No camp, nest, lair,
   ambush site or guarded thing, so there is no anticipation and no use of terrain. `foes.js:105`, `2248-2268`,
   `2619-2621`; `foe-worlds.js:59-63`.
4. **Late-game packs fall apart.** In the Signal Market only 15 % of pack members can be placed (City-Shaft 54 %),
   so the final world serves lone foes; and fillers exclude every interesting kind and add a blot, so 5-foe packs are
   a lead plus tutorial blots. `foes.js:2257-2259`; `foe-worlds.js:104-105`; `probe/probe.json`; `packs.mjs`.
5. **No growth in the foes to match the traveller's.** Foe HP and AI are the same in world 1 and world 14; the
   traveller goes 3 → 17 hearts, gains the whirl and the lunge, and gadgets. Only harm scales (×1.5 at most), and the
   forgiving rule caps any blow. `foes.js:321`; `resources.js:104`; `ink.js:14-18`; no HP factor in `foes.js` /
   `foe-worlds.js`.
6. **One move per distance.** Moves are gated by `[min,max]` ranges, so at the distance a player fights from, a foe
   repeats the same move (audit winds: toad lob 6/6, heron spear 6/6, tripod beam 5/5, brute hurl 5/5, wisp fireball 5/5,
   moth flash 15/15). Signature skin moves exist only in a few skins. `foes.js:523-556`; `arena-progress.json`.
7. **Nothing changes mid-fight.** No enrage, no armour loss over time, no low-HP behaviour except three, and the combo
   skips two of those (the roller's last roll needs ≤ 1 HP: 4 → 3 → 2 → dead). No fleeing, no fear, no reaction to a
   packmate's death. `archetypes.js:257` (`below: 0.25`), `555`; `foes.js:2548-2583`; `foes.js:762-763`.
8. **Dead time between attacks.** Foes spend ~70 % of a fight walking at you or recovering in place; waiting for a
   token they shuffle sideways at half speed. No feints, baiting, repositioning or pressure from the idle ones. `foes.js:806-811`,
   `988-992`; state shares in `shots/watch.json` (chase 35–47 %, recover 25–37 %).
9. **No alert beat and no idle life.** Calm is a sine-wave wander round a spawn point; noticing is an instant switch to
   `chase` (0.05 s measured) with no reaction animation, so the moment a fight starts has no drama and the world before
   it has no story. `foes.js:752-760`, `897-951`.
10. **Reactions are shallow and one-sided.** Knockback is horizontal and short (0.25–1.5 m), no launch, juggle or
    knockdown for walkers, and the foes never block, dodge or punish: their only "defence" is static armour that makes
    the player wait (bell 12 s of glances, crab 6 blows). `foes.js:1513`, `1412-1468`; `foe-react.js:20-21`; audit TTK rows.

Not a cause: telegraphs, readability, hit feedback and defeat animations measure well (the v1.90 audit and the
pictures agree). The boredom comes from short fights, a foe that can't act, and encounters with no place or build-up.

## Method limits

- My live runs were 8 packs in 4 worlds (Lorn's run was taken over by a relic's guards and is excluded); the mash bot
  hits through `Foes.hurt` at a fixed cadence with teleport steps, so it is a floor on the player's speed, not a human.
  Its third swing dealt 2, not the game's 3, so real clears are a little faster.
- The placement probe reuses `spawnPack`'s own rules (`wild`, `roomAt`, the ±5 m height check) from 12 wild spots per
  world with a seeded rng; it doesn't spawn, so the live spawner may do slightly better with its retries every 3 s.
- Nothing was heard (all muted); nothing in Unity; no physical pad.
