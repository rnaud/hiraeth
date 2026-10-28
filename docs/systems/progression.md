# Progression: the route, the sword and the backpack's strengths, the cab pass, Vael's bird

## First planet: one House, after the race (v1.92, #603)

The fresh main route fills the backpack at Qanat, earns the lift valve, then wins
Kamal's hoverbike at the red-rag hollow before entering the Rose House. The same
House now supplies the blade on the balcony, the guard beyond the fire bridge,
and the push gun beyond the shield watcher's gate. After the Keeper, a final
push-weight lesson opens the spark-stone cage. Its stone returns to the tree;
Qanat's repayment still powers the ship. The older progression notes below are
history, not the current route.

`desert.bike.found` remains ownership; `desert.bike.race.won` records the new win.
The House entry accepts either, or `desert.rose.legacy` for a pre-v7 save already
carrying weapons or past that part of the route. It never grants a new bike or
removes inventory during migration. Quest version 7 maps `hearth` to `rose` and
`gear` to `blade`, retaining all box IDs, `desert.hearth.open`, and
`desert.stone.taken`. Temple layout version 6 returns existing interior visitors to
their named checkpoint because the cistern moved behind the enlarged gun room.
Previously earned guns mark their relocated chest open. Old Hearth interior
positions settle outside the Rose House.
The old distant Hearth and way-stone landscape retain their original coordinates,
but no longer provide a second main-route portal or gun/stone reward.

Two renewable fluid basins are available: one beside the gun before the Keeper,
and one beside the final weight. The weight rejects hands, blade and plain fluid;
the acquired gun's push moves it, and the cage latches open. Save restoration
restores that open state and does not duplicate a taken stone. Both hosts use the
same temple geometry, story interactions and portal eligibility callback.


## The route (`src/levels/names.js`, `src/story/route.js`)

`ORDER` is the route: the desert, Vael, Lorn, Viridel, the Underwater City, the
City-Shaft, the Glass Dunes, the Buried Machine, the Moon Foundry, the Garden of
Spheres, the City Floating in Space, the Signal Market (twelve places since v1.40:
Vael II and Lorn II are parts of Vael and Lorn, the Sealed Hangar and the Atelier
are dismissed, docs/systems/worlds.md "Merged and dismissed worlds"; three
detours joined, "Three detours on the route"). The desert is always known, then the next two unfinished worlds
(`AHEAD`). `AFTER` can hold a world back, uncounted, until another is done (empty
now: Vael II waited for Vael's bird until it became part of Vael).

- **The wings first.** Vael is the second world. Its Aerie holds the fluid wings,
  and its main quest rides the wind up the lone tower on them.
- **The City-Shaft on the wings, in the later half.** The City-Shaft is sixth (the seventh of fourteen places), and it
  is charted only once four worlds are done. Since v1.42 no world in play wants the jets: the City-Shaft's air pillars
  (src/shaft-pillars.js, docs/systems/worlds.md) carry the wings back up the shaft, to the palace and its crown, and its
  Warden's Well holds the Warden's bellows (`wardenbellows`, the wings' third strength: their steady wash turns the
  makers' great vanes). From v1.38 to v1.41 that chest held the Warden's harness (`harness`), jets that fired in the
  City-Shaft only; step 11 of src/save-migrate.js gives a save that had it the bellows. The jets anywhere
  (`jetpack`) were too strong for the worlds as they are drawn (the author, 2026-10-10): a debug item, given only by
  the dev menu's Cheats (L3 + R3, F2, `); no box, shop or quest holds it, and there is no
  fallback box of it. `tests/route.test.js` still checks that no world before the City-Shaft wants them.
- **After the route:** the first homecoming at six worlds, and the final chapter (the Lantern, past the
  Signal Market) once the market is heard: docs/systems/story.md, "Two homecomings".
- Saves keep what they have: items are flags, and worlds already visited or done stay on the chart. The one thing
  taken away is the debug jets (step 9 of src/save-migrate.js: a save that owned them had the Warden's harness instead,
  and `jets.lost`; step 11 turns that harness into the Warden's bellows, `harness.lost`).

## Empty hands (v1.44): the sword and the shield found in the Rose House

From the author (issues #74, #7): "The Givers' House can't be solved now that I don't have the push gun. Remake this so
it uses what I have so far (double jump) and make me find the sword and the shield in the temple." He starts with
nothing in his hands; the order in the desert is:

| what | where | why there |
|---|---|---|
| the backpack | Qanat's chest on its dais at the tree's foot (`desert.backpack`; on the tree's ledge until v1.49) | unchanged |
| the lift valve (the double jump) | by the giant's pool (`desert.lift`) | unchanged; the Rose House's sand pit wants it (Sabri says so if it isn't had) |
| the Givers' blade (`sword`) | the Rose House's Sword Chamber, half-way (`desert.temple.sword`, the temple's gadget) | the house's dungeon item: thorns, a ball a cut sends far, an eye to strike, the Keeper's spokes |
| the Givers' guard (`shield`) | the Rose House, the Watcher's Hall over the Hall of Fires' bridge (`desert.temple.shield`, a `find`) | the Givers' watcher's bolt, sent back into its eye (the hall's east door), the Keeper's charge |
| the fluid gun, with ember mode (`fire`) | the Givers' Hearth, the Givers' room off its hall (`desert.gun`; v1.45, issue #83) | its stone ball wants the push; nothing in the house needs it, before or after. Ember mode, the house's old key, comes with it (`with`, docs/systems/boxes.md): in v1.44 it had a chest of its own beside the gun's |

The house is off the main quest's line (Sabri starts it), so the order is the player's: the house before the Hearth
or after it, both work (the house never asks for the gun; the Hearth never asks for the blade). Until v1.56 a
traveller could leave the desert without going in and go on unarmed (no foe came for him); since v1.57 (issue #217) the
ship waits for the blade and the guard (below, "Core gadgets: the ship waits for them").
Until v1.44 they waited by the ship in the next world instead (`FALLBACKS`, slots 1 and 4), and the author landed in
Vael beside two free chests (issue #91: "chests should always feel earned").

**Chests earn their place (v1.45, issue #91).** The fallback boxes by the ship (the backpack, the lift valve, the gun)
are the desert's main quest's three finds, and the ship doesn't fly until that quest is done (`ship.powered`), so a run
never sees one: they are for a save brought in another way (the worlds menu). Every other chest is a world's own. Measured
from each route world's ramp foot (flat metres, then height): the nearest are the makers' courts, each a gadget's showcase
on its own paved square away from the landing (the City-Shaft's 37 m behind the landing on the plateau, Viridel's 41 m,
Vael's 49 m and 6 m up its rise), and Lorn's breathing reed, 22 m out but 28 m up Wendel's lookout, a climb in five
pitches; everything else is 60 m or more away, most in temples. (v1.48, issue #101: the three worlds of v1.40 have a
court each now; since v1.86 (#518) its puzzle wants a gadget you have when you reach it, most of them earned in that
same world's house, see docs/systems/gadgets.md; its chest, a charm for that gadget, waits behind the gate its puzzle
opens, src/finds/courts.js `boxAt`, so even the nearest chest there is earned.) `tests/boxes.test.js` checks that a run's save (the
desert done, the house skipped) finds nothing by the ship.

**Nothing to fight before the blade.** Unarmed (main.js `tool.swordOn`, from the items), no pack comes in from the
wilds, no placed encounter wakes and no temple's machines stand (src/foes.js `armed()`); they
come the moment the blade is his. The blade button and the guard do nothing without them, and neither is drawn on
him, in the game or its cinematics (`tool.swordOn`, `tool.shieldOn`; a game on foot lends them,
src/minigames/kit/onfoot.js; the title screen and the studio draw their own traveller, armed). The evade is always
his. Each is taught once when its chest opens (`hint.sword`, `hint.shield`).

**Saves** (src/save-migrate.js step 13, `migrateGivers`, after step 12's Solange): every save from before keeps the sword and the shield, past
the house or not (since v1.38 both were his from the start: nobody loses a weapon), their chests open; a save with
ember mode finds the Hearth's chest open; the old house's doors and fires go (the save comes in at the door of the
remade house), unless the Keeper was calmed (its doors open, its fires lit). A save from before the items still gets
the backpack (src/boxes/index.js's legacy rule doesn't count the two). Step 14 (`migrateGunChest`, v1.45) gives a save
that opened either of the Hearth's two v1.44 chests, or has the gun or ember mode, both, the gun's chest open (the gun in
hand if nothing else was). `tests/save-migrate.test.js`.

## Core gadgets: the ship waits for them (v1.57, `src/story/leave-gate.js`)

From the author (issue #217): "I shouldn't be able to leave the desert without getting all the core gadgets from that
level. I was able to leave without a sword and shield right now." A world's core gadgets are what the worlds after it
are built for; the ship's `travel` (src/ship/ship.js, after the power check) asks `leaveRefusal(world, to, has)` and,
while one is missing, stays down: a beep and one line in the ship's voice naming what is still to find and where
("Not yet. The Givers' blade and the Givers' guard are still in the Rose House."), `travel:refused` emitted, and the
quest that leads there started if it wasn't (main.js: the Rose House's `temple.desert`, the Aerie's `temple.arzach`),
so the quest log and the scout show the way. Nobody is handed off to anyone: the line says the place.

| world | core gadgets | why |
|---|---|---|
| the desert | the backpack, the lift valve, the fluid gun; the Givers' blade and guard | the first three are the main quest's (the ship has no power before them); the blade and the guard, off its line in the Rose House, are what every foe and every temple's switches want |
| Vael | the fluid wings (the Aerie) | Vael's own tower, the City-Shaft's air pillars, the trials that are flown |

Every other world's temple gadget is the key to that temple's own rooms and its gifts in the open are extras: nothing
past their world wants them, so those worlds are left whenever. Each core gadget's chest stands in its own world, so a
save is never kept where it can't get them (it is standing in their world); saves already past the desert are not
touched, and if one comes back unarmed, the house is there. The debug saves (src/debug-save.js) open every chest of the
worlds before theirs, so they leave as before. The play-through (tests/playthrough-agent.js `shipTurn`) reports a world
it could not leave. Tests: `tests/leave-gate.test.js`.

**The main quest carries the gate** (v1.60, issue #232). The desert's main quest used to end at "Meet Qanat at your
ship", and only the console said the blade and the guard were still wanted. Its last step is now
`coreStage('desert', …)` (src/story/leave-gate.js): "Take the blade and guard from the Rose House" (the marker on the
Rose House's door), met once nothing off the main quest's own line is missing (`missingCore` holds no gadget with a `quest`). It is `ahead: false` (having them early skips nothing before it)
and `pass: true` (src/story/quests.js `landing`: had already when the quest reaches it, it is passed over, never shown),
so a run that took them first sees the quest end at the ship as before. The ship wakes when Qanat has fed it
("The ship hums awake."; src/story/desert.js `wake`), the quest ends (and the galaxy opens, `world.desert.done`) when
nothing is missing: a done main quest always means the ship can go, and the gate's line stays for whoever tries the
console first. Vael's main quest ends the same way on "Take the fluid wings from the Aerie" (the tower's wind wants
them, so a run never sees it). No save moves: the stages before are as they were; a save whose quest ended without the
blade before v1.60 keeps it ended, the gate still refusing and starting the Rose House's quest.

**The Rose House before Qanat's gift** (v1.68, issue #278, the level design audit v1.66). With the step last, a run
that had not been in the Rose House was fed at the ship, sent 483 m out to its door and walked back the same way past
nothing new. The step now comes before the gift: light the tree, "Take the blade and guard from the Rose House" (a leg
out east from the tree), then "Meet Qanat at your ship" (the way back, past the Givers' field-stone), and the gift is
the quest's end. It is a `gate` too (an old save fed before the Rose House doesn't end the quest past it), and Qanat
sets off for the ship only once the blade and the guard are had (`setupRepay`'s `ready`; Ama and Nour say where they
are while the step is on). Had first, the step is passed over and the gift follows the tree as before. Old saves
(`desert.quest.v` 6, `GIFT_AFTER_GEAR`): one waiting for the gift without them goes back to the Rose House's step; one
at that step already (fed, the old order) stays there and ends with them (`tests/playthrough-saves.test.js`).

## The progression rewrite (v1.38): the sword alone, then the backpack's strengths

From the author: "We shouldn't get the triple jump automatically, it should be a double jump, have a flip animation
when doing the second jump and be an item I get to make the backpack stronger. Same for the fluid gun, we shouldn't
get that by default. By default we should just get the sword."

| what | where | why there |
|---|---|---|
| the fluid sword (and the shield's guard) | from the start | the one thing he carries off the ship |
| the backpack (the round tank, empty) | Qanat's chest on its dais at the tree's foot (`desert.backpack`), the main quest's `box` stage | as before: the story's first find, a container until the pool |
| the lift valve: the double jump with a flip, the backpack's first strength | a makers' chest beside the giant's pool (`desert.lift`), the new stage `valve` after `fill` | the tank first fills there, so its first strength wakes beside the water; nothing in the desert before it asks for a second jump, and Vael's tower steps and Vael II's sky stones (each a double jump above the last), Viridel's crown and the kits after it are drawn for it |
| the fluid gun (a gadget) | a makers' chest in the Givers' Hearth's hall (`desert.gun`), the new stage `gun` before `stone` | its first use is right there: the push that rolls the stone ball and lifts the grille; everything before it (the rib, the drum) is done by hand, and every world after it wants shots |
| the wings, the second strength | Vael's Aerie (unchanged) | |
| the Warden's bellows, the third strength (the wings' steady wash, v1.42; the Warden's harness, jets for the City-Shaft only, v1.38 to v1.41) | the Warden's Well (unchanged chest, `incal.temple.jetpack`) | the temple's great vanes turn under it, the shaft's air pillars carry the wings; the jets anywhere are a debug item |

The old boost (a powered jump on every press in the air while the bar lasted: with three units, three more jumps)
is gone; the double jump costs nothing and comes once each time you leave the ground. Every place that wanted a
boost-jump wanted one (the tower's steps, the sky stones: `tests/story-arzach.test.js`, `tests/story-arzach2.test.js`
hop them with the double jump), so the levels are unchanged. Gun modes, temples' guardians, drums and the makers'
runs that shoot or push need the gun (`needs: ['gun', …]`, src/resources.js `meetsWith`); the Rose House (the
desert's temple, off the route) says so when walked into without it.

**Saves** (src/save-migrate.js step 8): the backpack and a tank that had been filled (it could boost) → the lift
valve, its chest open; past the Hearth (its grille up, the stone taken, the tree lit, the desert done, another world
started, a gun mode or the wings found, the Rose House entered) → the gun too, in hand unless another gadget was.
An earlier save follows the new order. `tests/save-migrate.test.js`.

**Completability** (`tests/playthrough.test.js`): the agent opens the two chests on the way (`openBox`: somewhere to
stand by its front, E), checks the double jump and the gun are not had before them, and shoots or pushes only with
the gun and fluid in the tank; the Hearth's ball wants the gun. The route plays to the end, both homecomings
included.

## After the bellows (`src/temples/incal.js`)

Opening the chest in the Bellows Chamber (room id `jets`) unstops the plinth under it: a draught (an `Updraft`,
`when: { gadget: true }`) rises up through the oculus, the only way on, and on up through each iris as it opens. An
`UpGuide` piece says what to do a moment after the box's card (`BELLOWS_NEXT`), and the drone flies up and points
(`game.emit('scout:ping')`, handled in `main.js`). The temple quest gets a `use` stage (`QUEST.use` in the temple's
words, done when `def.used(rt)`, `upUsed`: you reached the gallery). (The jets until v1.42: `JetGuide`, `JETS_NEXT`.)
The playthrough (`tests/playthrough.test.js`) plays the City-Shaft with no jets at all: its light quest's `palace` and
`look` stages ride the spire's and the crown's air pillars for real (`ridePillar`, tests/playthrough-worlds.js), and
tests/temples.test.js plays the Warden's Well on the wings and the bellows, room by room, the warden broken over a
vane.

## The cab pass (`src/taxi.js`, `src/story/incal-data.js`)

Without the item `cabpass` (flag `item.cabpass`), `taxi.refuses(player, how)`
says no to a hail (the whistle, a glob) and to boarding. It shows
`Taxi.refusal` (the City-Shaft's text names Lio) at most every few seconds, and
calls `Taxi.onRefuse`, which starts the quest `incal.pass`. Lio sends you to
Tobin, the seller of views, for the fare he owes. Bring the coin back and Lio gives the pass
(`quests.give('cabpass')`). `ITEMS.cabpass` (kind `pass`, `quest: true`) lists
it in the gear. A `free` cab (Wren, the old cab at the bottom's lamp) never asks. In
the depths, once you know Wren, a hail brings Wren.

## Vael's bird, the wind and the flute (`src/story/arzach.js`, `src/bird.js`)

- The bird is `dormant` (not drawn, not boardable, deaf to the whistle:
  `onDormantCall` says why) until `arzach.bird.called`. Older saves that had
  ridden her (`arzach.rode`) keep her. A save on the old `ride` stage moves on to
  `tower`.
- `WIND`: a column of rising air beside the tower's balcony. Open wings in it
  are lifted (`windLift`), and at its top they are turned onto the balcony.
  Without wings it only says where wings are.
- The window is a deep stone arch now, not a flat panel. On the sill lies the
  rider's flute (`fluteModel`, item id `whistle` from older saves). Taking it
  sets the map clue. Playing it plays `RIDER_CALL` (`audio.tune`). The bird
  comes down from high over the haze to the balcony's open rim and bows. From
  then on, calling a bird plays the same tune (`main.js` `onWhistle`).
- Her ground gait (`GAIT`): legs stepping in turn, a bob, a sway and wings
  folded while you walk her. Take-off (`TAKEOFF`) is a crouch, then a leap with
  the wings opening, and the first wingbeat only at the top of the leap.
- Her landing (`LANDING`, `Bird.approach`): within `height` m of the ground and sinking (or within
  `ttc` s of it), her legs come down and reach forward, the wings flare and the body tips nose up;
  ridden, the flare brakes her and holds the last metre's sink to `touch` m/s. Over the last metre
  the legs swing back so the toes meet the ground level. Each foot finds the ground under it on its
  own ray (`FOOT`, on a slope one leg reaches down, the other draws up; standing and walking too).
  Touching down she sinks into her knees (`dip`, `settle`), wings half open, then walks out what is
  left of her speed (`runout`). Called down beside you or circling down riderless, the same.
  `tests/birds.test.js` lands her on flat and sloped ground.
