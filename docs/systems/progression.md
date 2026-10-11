# Progression: the route, the sword and the backpack's strengths, the cab pass, Vael's bird

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
  the world debug menu's toggle (L3 + R3, F2) and the dev menu; no box, shop or quest holds it, and there is no
  fallback box of it. `tests/route.test.js` still checks that no world before the City-Shaft wants them.
- **After the route:** the first homecoming at six worlds, and the final chapter (the Lantern, past the
  Signal Market) once the market is heard: docs/systems/story.md, "Two homecomings".
- Saves keep what they have: items are flags, and worlds already visited or done stay on the chart. The one thing
  taken away is the debug jets (step 9 of src/save-migrate.js: a save that owned them had the Warden's harness instead,
  and `jets.lost`; step 11 turns that harness into the Warden's bellows, `harness.lost`).

## Empty hands (v1.44): the sword and the shield found in the Givers' House

From the author (issues #74, #7): "The Givers' House can't be solved now that I don't have the push gun. Remake this so
it uses what I have so far (double jump) and make me find the sword and the shield in the temple." He starts with
nothing in his hands; the order in the desert is:

| what | where | why there |
|---|---|---|
| the backpack | Qanat's chest on the tree's ledge (`desert.backpack`) | unchanged |
| the lift valve (the double jump) | by the giant's pool (`desert.lift`) | unchanged; the Givers' House's sand pit wants it (Sabri says so if it isn't had) |
| the Givers' blade (`sword`) | the Givers' House's Sword Chamber, half-way (`desert.temple.sword`, the temple's gadget) | the house's dungeon item: thorns, a ball a cut sends far, an eye to strike, the Keeper's spokes |
| the Givers' guard (`shield`) | the Givers' House, the Hall of Fires' far landing (`desert.temple.shield`, a `find`) | the bellows' wind in the Hall of Winds, the Keeper's charge |
| the fluid gun | the Givers' Hearth (`desert.gun`, unchanged) | its stone ball wants the push; nothing in the house needs it, before or after |
| ember mode (`fire`) | the Givers' Hearth, across the hall from the gun (`desert.hearth.fire`) | the house's old key; the Givers kept their fire there |

The house is off the main quest's line (Sabri starts it), so the order is the player's: the house before the Hearth
or after it, both work (the house never asks for the gun; the Hearth never asks for the blade). A traveller who
leaves the desert without going in finds the blade and the guard by the ship in the next world (`FALLBACKS`, slots 1
and 4), as the backpack's other finds.

**Nothing to fight before the blade.** Unarmed (main.js `tool.swordOn`, from the items), no pack comes in from the
wilds, no relic's guards rise, no placed encounter wakes and no temple's machines stand (src/foes.js `armed()`); they
come the moment the blade is his. The blade button and the guard do nothing without them, and neither is drawn on
him, in the game or its cinematics (`tool.swordOn`, `tool.shieldOn`; a game on foot lends them,
src/minigames/kit/onfoot.js; the title screen and the studio draw their own traveller, armed). The evade is always
his. Each is taught once when its chest opens (`hint.sword`, `hint.shield`).

**Saves** (src/save-migrate.js step 13, `migrateGivers`, after step 12's Solange): every save from before keeps the sword and the shield, past
the house or not (since v1.38 both were his from the start: nobody loses a weapon), their chests open; a save with
ember mode finds the Hearth's chest open; the old house's doors and fires go (the save comes in at the door of the
remade house), unless the Keeper was calmed (its doors open, its fires lit). A save from before the items still gets
the backpack (src/boxes/index.js's legacy rule doesn't count the two). `tests/save-migrate.test.js`.

## The progression rewrite (v1.38): the sword alone, then the backpack's strengths

From the author: "We shouldn't get the triple jump automatically, it should be a double jump, have a flip animation
when doing the second jump and be an item I get to make the backpack stronger. Same for the fluid gun, we shouldn't
get that by default. By default we should just get the sword."

| what | where | why there |
|---|---|---|
| the fluid sword (and the shield's guard) | from the start | the one thing he carries off the ship |
| the backpack (the round tank, empty) | Qanat's chest on the tree's ledge (`desert.backpack`), the main quest's `box` stage | as before: the story's first find, a container until the pool |
| the lift valve: the double jump with a flip, the backpack's first strength | a makers' chest beside the giant's pool (`desert.lift`), the new stage `valve` after `fill` | the tank first fills there, so its first strength wakes beside the water; nothing in the desert before it asks for a second jump, and Vael's tower steps and Vael II's sky stones (each a double jump above the last), Viridel's crown and the kits after it are drawn for it |
| the fluid gun (a gadget) | a makers' chest in the Givers' Hearth's hall (`desert.gun`), the new stage `gun` before `stone` | its first use is right there: the push that rolls the stone ball and lifts the grille; everything before it (the rib, the drum) is done by hand, and every world after it wants shots |
| the wings, the second strength | Vael's Aerie (unchanged) | |
| the Warden's bellows, the third strength (the wings' steady wash, v1.42; the Warden's harness, jets for the City-Shaft only, v1.38 to v1.41) | the Warden's Well (unchanged chest, `incal.temple.jetpack`) | the temple's great vanes turn under it, the shaft's air pillars carry the wings; the jets anywhere are a debug item |

The old boost (a powered jump on every press in the air while the bar lasted: with three units, three more jumps)
is gone; the double jump costs nothing and comes once each time you leave the ground. Every place that wanted a
boost-jump wanted one (the tower's steps, the sky stones: `tests/story-arzach.test.js`, `tests/story-arzach2.test.js`
hop them with the double jump), so the levels are unchanged. Gun modes, temples' guardians, drums and the makers'
runs that shoot or push need the gun (`needs: ['gun', …]`, src/resources.js `meetsWith`); the Givers' House (the
desert's temple, off the route) says so when walked into without it.

**Saves** (src/save-migrate.js step 8): the backpack and a tank that had been filled (it could boost) → the lift
valve, its chest open; past the Hearth (its grille up, the stone taken, the tree lit, the desert done, another world
started, a gun mode or the wings found, the Givers' House entered) → the gun too, in hand unless another gadget was.
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
