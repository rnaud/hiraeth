# The Desert's path through the red temple (issues #729, #730)

The author, 2026-10-28:

- #729: "Go to the red temple in the desert to recharge the battery by solving a puzzle. Then you continue the temple
  and get the gun and the sword and shield and then finally the spark stone."
- #730: "Change the skull cave to be a little temple with monsters. We just need the spark stone to restart the tree."

The red temple is the Rose House (src/temples/desert.js), the drum of rose stone east of Qanat. The skull cave is the
cave in the giant's chest under the marked skull past Qanat's back gate (src/desert-city.js, src/story/desert.js).

## Before

The main quest (`desert.power`) ran: Qanat, the chest (the empty battery), Nour, the skull, the clogged drain, the pool
(the battery filled), the makers' door (full battery), the lift valve, the keepers' stair, the roots drinking, Nour
again, the hoverbike race, the Rose House (blade, guard, gun), the spark-stone, the roots, the ship: 19 steps. The tree
wanted two things, the water up and the stone; the Rose House wanted the bike won and the double jump; the battery
filled in the skull cave.

## After: the quest chain (12 steps, one short line each)

| # | step | where | done when |
|---|---|---|---|
| 1 | Walk to Qanat, under the dark tree | the city's gate | `desert.city.entered` |
| 2 | Open the humming chest under the tree | the dais | the battery (empty) |
| 3 | Nour wants a word | Nour | she names the spark-stone and the Rose House |
| 4 | Walk east to the Rose House | its door | `temple.desert.entered` |
| 5 | Light the Givers’ bowl and fill your battery | the Hall of the Flame's font | `desert.battery.charged` |
| 6 | Take the Givers’ gun by the dry channel | the Dry Channel's ledge | the gun |
| 7 | Find the blade on the Great Hall’s balcony | the balcony | the sword |
| 8 | Cross the fire bridge and take the guard | the Guard's Hall | the shield |
| 9 | Calm the Keeper and take the spark-stone | the spring room | `desert.stone.taken` |
| 10 | Clear the giant’s skull and take the lift valve | the skull's shrine | the lift valve (passed over if had) |
| 11 | Set the spark-stone in the tree’s roots | the tree | `desert.tree.lit` |
| 12 | Meet Qanat at your ship | the ship | `desert.ship.fed` |

Nobody sends you to anybody: Nour names the place (the Rose House) and what is in it. The hoverbike is a side errand
(Marrow's, once the gun is had); the drain in the skull cave is no step: the stone set in the roots calls the water up
(the drain's debris is swept off with it), or you clear it yourself on a visit. The tree needs only the stone.

The skull is cleared on the way back from the Rose House to the tree: its mouth is past Qanat's back gate, and the
keepers' stair out of its cave comes up at the hatch in the back lane, a few steps from the roots. It comes after the
Rose House because its monsters need the blade (no foe comes for an unarmed traveller, src/foes.js `armed()`), and
before the ship because the lift valve is a core gadget (src/story/leave-gate.js: Vael's tower and the sky stones are
drawn for the double jump). The tree itself needs only the stone: set it in the roots first and the tree burns; the
quest waits at the skull's step (a `gate`) and passes the tree's step over once the lift valve is had. Had already, the
skull's step is passed over (`pass: true`). The level design audit's guidance for the Desert goes from 3.89 to 4.0
(the leg to the Rose House follows the Givers' dry channel; the skull's leg is seen from the Rose House).

## The Rose House: rooms and the lock-and-key chain

Walked into with the empty battery and nothing else (no double jump any more: src/temple-maps/makers.js).

| room | kind | what | needs |
|---|---|---|---|
| the Threshold | passage | the way in | |
| the Great Hall | hub | the balcony's hole over the caged small key, the watcher, the cistern's door | |
| the Hall of the Flame | puzzle | **teach (hands):** lean on the tar ball through the pilot flame into the hooded bowl. Lit, the bowl wakes the Givers' **font** beside it: living water rises in its basin; at it, the battery fills (**the charge**). The Dry Channel's door sinks | |
| the Dry Channel | puzzle, then chest | the **Givers' gun** on its mound on the near ledge (its chest opens once the battery is full). **Test (gun):** the Givers' weight lies on the pier across the sand, too heavy for anything but the gun's push; pushed onto the pier's plate it raises the bridge over the sand and opens the gallery's door. Climb the gallery | the charge; the gun |
| the balcony | chest, puzzle | **the Givers' blade**; **test (blade):** cut the ball into the hole: it drops onto the plate below and the small key's cage sinks; drop to the floor | the blade |
| the Machines' Hall | fight | the blade's fight (behind the small key's door) | the small key |
| the Hall of Fires | puzzle | cut the thorns, cut the burning ball to the bowl before it goes out: the bridge rises | the blade |
| the Guard's Hall | chest | **the Givers' guard** | |
| the Hall of Channels | puzzle | **twist (gun + blade):** shoot the eye high on the obelisk (once struck from a double jump) to lift the relay's lid and wake the keepers' door; then cut the ball down the long groove through the relay to the bowl | the gun, the blade |
| the Great Hall again | puzzle | **test (guard):** the watcher wakes with the guard in hand; its bolt sent back breaks it. The cistern's door's two lamps lit | the guard |
| the antechamber | passage | a refill basin before the guardian | |
| the Cistern | guardian | the Keeper: the blade's balls, the guard's block, the gun's water (the exam of all three) | blade, guard, gun |
| the spring room | puzzle, chest | **twist (gun):** push the weight onto its plate and the cage round the **spark-stone** opens | the gun |

Each new thing is used in the next room: the charge feeds the gun at once; the gun pushes the weight in the same room;
the blade cuts the balcony's ball before you leave the balcony; the guard meets the watcher on the way back through
the hub. Teach, test, twist: the gun is taught on the weight (a push), tested on the eye (a shot from below), twisted in
the spring room (the cage) and examined by the Keeper (water in its mouth).

What changed in the house (src/temples/desert.js, layout v7: src/temples/migrate.js): the font in the Hall of the Flame;
the gun's mound from the antechamber to the Dry Channel's near ledge; the Dry Channel's carried weight and double jump
replaced by a weight the gun pushes and a bridge it raises; the Hall of Channels' eye shot by the gun instead of struck
from a double jump.

## The skull cave: a little temple with monsters

The giant's chest stays the cave it was (the nave of ribs, the pool, the mural, the makers' shrine, the keepers'
stair), now a makers' hall with foes: four of the Givers' lamps stand round the pool, and three mummers and
their king (the Desert's own troupe, issue #762: src/foe-worlds.js) wait in the nave (an encounter site of its own, the `hall` kind:
src/encounters/sites.js, the level's own `sites`). Each one cut down lights a lamp; all four lit, the shrine's door
sinks and the lift valve's chest is in reach (it opened to a full battery before). The double jump is the way out, up
the keepers' stair to the hatch beside the tree, as before.

The skull's mouth lets you down once the blade is yours ("Something growls in the dark below. Not with empty hands.").
With the Enemies setting off, the hall counts as cleared.

## Saves (src/story/desert.js `migrateDesertQuest`, DESERT_QUEST_V 8)

- A save at a removed step (the skull, the drain, the pool, the makers' door, the valve, the stair, the roots, Nour's
  spark, the bike race) goes to the Rose House's step; the steps already done pass over at once (the charge, the gun,
  the blade and guard, the stone, the lift valve).
- A save at the blade or the guard without the gun goes back to the gun's step (it is now before them).
- A battery filled before (the giant's pool) counts as charged (`desert.battery.charged`).
- A save inside the Rose House keeps what it did (layout v7): past the Dry Channel, the weight is on its plate and the
  bridge up; past the Hall of the Flame, the font is woken.
- A save already in the skull cave without the blade: no monster comes, the shrine's door opens, the lift valve is
  in reach (the way out is the double jump, as before).
