# Fight temples (issue #341)

> "Create a new fight temple concept in each world that looks and feels like a Diablo game. 3D isometric camera
> angle, lots of monsters with low hp, to create more diversity in gameplay. This unlocks new colors for the
> backpack and sword and shield." (the author)

A temple of another kind beside each world's makers' temple: no puzzle, no guardian, no gadget, only a fight, seen
from high above at a fixed angle, through a few linked rooms of many weak foes. It is short (three to five minutes),
optional, replayable for a best time, and it pays in looks: a world's colours for the backpack, the sword and the
shield. The makers' temples and the fights in the open are untouched.

**Built: the desert's, the Sunken Hall** (v1.76). How to play it: in the desert walk west from the pilgrims' camps
to the stone doorway half sunk in the sand (128, 300) and ask Wafa, who keeps watch on its step; or Debug → Games →
The Sunken Hall (`?game=fight-desert`), or the Arcade's sign.

## The template

A fight temple is a minigame played on foot (docs/systems/minigames.md: `drives: false`, so the walking, the blade,
the guard, the evade and the fluid gun are the usual ones), made by one factory over the world's table:

```js
// src/minigames/fight-<world>.js
export default fightTempleGame(<WORLD>_FIGHT);      // src/fight-temples/index.js
```

| piece | file | what |
|---|---|---|
| the table | `src/fight-temples/<world>.js` | rooms (rectangles on whole metres, 2 m apart: the wall between), the doors (from a room's side, its width), each room's ink springs, pillars, waves (`[kind, n, { tough }]`), the palette of its stone and ink, the hour, the doorway in the world (`entrance`), the colours it gives (`colours`, an id of `src/kit-colours.js`) |
| the rules | `src/fight-temples/rules.js` (pure) | the iso camera (`ISO`, `isoOffset`, `followIso`), the walls seen through (`SEE`, `inTheWay`, `easeSee`, `seeOpen`, `seeHoleCuts`), the walls from the rooms (`wallBoxes`, `doorGap`), the aim (`AIM`, `pickTarget`, `stickToGround`), the waves (`LIGHT_HP`, `roomWaves`, `CROWD`, `release`), the loot (`LOOT`) |
| the rooms | `src/fight-temples/rooms.js` | the level from the table: the sand (flat in the rooms, banked to the walls' tops behind the far walls, a trench behind the near ones), a mesh a wall and a pillar, each with its own see-through materials, the springs, the gates (movers), the basin, the altar, the reliquary |
| the run | `src/fight-temples/session.js` | the camera, the aim, the rooms and waves, the loot, the reward |
| the doorway | `src/fight-temples/index.js` `entranceModel` | the game's sign in its world (kit/marker.js uses a game's `marker.model`; solid) |
| the host | `src/story/hosts-data.js` | the person by the doorway who offers it (Play / Not now) |

**The camera.** Fixed, as Diablo IV's (issue #365): from the south-east (`ISO.yaw` π/4, never turned by the player),
57° over the horizon (0.995 rad), 28 m out, a 31° lens (little perspective: the orthographic feel; about 15.5 m of
the floor tall on the screen at him). v1.76 had 51.6° (0.9 rad), 27 m and a 30° lens (14.5 m tall). Blizzard gives
no figures for Diablo IV's camera; players describe a fixed angle with no rotation, steeper than Diablo I–III, and a
tight zoom, and estimate it at 55–60° down: ours sits in the middle. It follows the traveller with a soft lead the
way he moves (0.32 s of his speed, 2.6 m at most). CameraRig still runs; the session holds its yaw on the iso line
(a getter on the rig, put back at the end), so the stick and WASD walk him relative to the screen, and puts the
camera on the line after the rig every frame. Its numbers live in `ISO` alone (the lock-on camera is CameraRig's,
untouched).

**Seen through** (issue #365; v1.76 cut them down to stubs). Walls and pillars between the camera and him (his body
at two heights and a ring 1.6 m round him at his knees: `inTheWay`, `sightPoints`) have a hole cut in them round him:
`materials.js` `makeMaterial({ seeThrough: id })` compiles `SEE_HOLE`, a cone from the eye to his chest (`SEE_HOLE`'s
point, 1.1 m over his feet), so the hole is a circle on the screen, `SEE.radius` 3.4 m across at him, in what stands
nearer the eye than he does only, its foot (`SEE_LOOK.foot`: below 0.3 m over the floor) kept so the wall's place still
reads; a pillar's hole is four times as wide (`SEE.pillar`), the whole of it down to its foot (a hole through one left
its cap's corners hanging in the air). It opens over `SEE.in` 0.2 s and closes over `SEE.out` 0.3 s (`easeSee`, `seeOpen`: each wall's and pillar's own
`uSeeK`, one material per wall, its cap course and its glyph band, `rooms.js`), the others stay solid. A clean cut,
its edge a little uneven as if cut by hand: the ink pass draws one line round it (a dither's dots each drew a black
ring and the rim read as grime). Not in the sun's shadow maps (an orthographic view): the walls still shade the floor.
`seeHoleCuts` (rules.js) mirrors the shader for the tests. The sand is banked only behind the far walls (behind the
near ones a 3.5 m trench, then the bank), so nothing but a wall that can be seen through stands in the line.

**The roll and the wide cut** (issue #365). In here B / ○ (Alt, the touch ↶) is a dodge roll (`fluid-blade.js`
`ROLL`, set on the blade by the session and taken off at the end):
a tucked forward roll 0.42 s long, up to 9.5 m/s (about 3.3 m), along the stick or the way he faces (never the
evade's backstep), i-frames from 0.02 to 0.34 s (Gentle 0.4), 0.75 s from one roll's start to the next; the pose is
`jump.js` `ROLL_FLIP`, a front flip on the ground about a 0.6 m pivot, tucked hard. Jumping is disabled: the session’s input filter clears Space and PadJump before movement reads them.
A / × does not roll, and the touch jump button and jump control hints are hidden.
The blade's cut takes every foe in a wider, longer cone too (`WIDE_CUT`: 3.9 m, 1.5 rad
either side, against the swing's own 2.9 m and 1.15 rad), the cone's line of sight keeping out any foe behind a wall.
Outside the fight temples neither is set: the evade and the swing are as they were. Tests: `tests/fight-roll.test.js`.

**The controls.** The left stick walks up and across the screen. The aim is the right stick (twin-stick), or a ring
on the floor that the mouse moves (pointer captured), or the way he walks. The blade and the gun take the foe in the
aim's cone (`pickTarget`: within 6.5 m for a cut, 18 m for a shot, 0.7 rad either side, nearer and more on the line
first; anything within 1.6 m whatever way): `FluidTool.lockOn` and `updateAimPoint` are wrapped for the run, so the
blade's soft lock, its swing's tilt and the shot's line all go to it; with nobody there a swing goes the way you aim.
RT / R2 (or G) alone fires a quick shot (the aimed shot, LT held, as ever); the guard and the parry are the usual
ones, the evade a roll (above). On the floor: a chevron at his feet the way he aims, a warm ring under the foe taken, the mouse's ring.
The crosshair is hidden (`body.fight-iso`), and the lock-on is off (the cone takes its place; a lock would turn the view off the line).

**The foes.** The world's own kinds (src/foe-worlds.js), as `Foes.add` makes them (their world's skins and stage:
`level.foes.partAt`), lighter: a light one has one or two cuts of health (`LIGHT_HP`), strikes half as hard
(`LIGHT_HARM`), sees the whole room and keeps after you, holds no high ground. A wave's foes come up out of the ink
springs farthest from you, three every 0.45 s, as long as fewer than `CROWD.cap` heads stand (24; a skitter is half;
Gentle 14 and seven tenths of each wave). The tough ones (`{ tough: true }`) keep their full health and harm and come
last. A room cleared: a heart back, its gate sinks (a mover: its collider goes down with it). The last room's last
wave is the tough one; then the reliquary rises on the altar.

**The loot.** A heart now and then (5 %, 16 % at half your hearts or fewer, never at full), drawn in as you pass; a
chime from a light foe a quarter of the time, six from a tough one, a purse for each wave, room and the finale
(`ctx.drop`: the world's chime field, into the wallet). Once the colours are won, half the chimes: the hall is not a
mine.

**The reward.** Taking the reliquary wins the world's colours (`unlockColours`: the save's `kit.colours.<id>`) and
wears them on every piece at once; the results say so. In Items, a Colours strip over the gear: a button a piece
(backpack, sword, shield), A / × the next colour won for it (`kit.colour.<piece>`). A palette paints the backpack's
brass, its canvas plate, the cloth at its neck and its straps (the fluid keeps its gun mode's colour), and the
sword's and the shield's water (`src/kit-colours.js`).

**The budget.** Measured on this Mac in headless Chrome at Handheld (1280 × 720): the hall empty, cpu 2.2 ms, gpu
3.8 ms, 83 draw calls; with 30 foes standing (the cap and the wave's own), cpu 4.9 ms, gpu 6.7 ms, 912 draw calls,
95th percentile 18.3 ms at a 60 Hz refresh, against about 1 770 draw calls in the desert's own view. A foe's parts are
drawn instanced (src/part-batch.js); `tests/fight-temples.test.js` holds the meshes a foe under 40 with the crowd full.

**Adding a world's.** A table (`src/fight-temples/<world>.js`: copy the desert's, its rooms on whole metres 2 m
apart, the doors on a room's far side so the gates are seen), a one-line game file, a palette in `KIT_COLOURS`
(`world: '<world>'`), a host in `hosts-data.js`, a doorway spot by a settlement. The tests that hold the desert's
(the camera never blocked, every room shut but for its doors, the waves, a run to the reward) are written over the
table: add the new one to them.

## The other worlds (one line each)

| world | fight temple | its foes | its colours |
|---|---|---|---|
| Vael | **The Wind Cloister**: a roofless monastery court on a cliff, its gates the riders' old stalls; gusts through the arches shove the crowd | sky rays, herons, blots; a crab of the sky stones at the end | Rider's slate (blue-grey brass, white water) |
| Lorn | **The Drowned Mill**: four flooded rooms of a reed-cutters' mill, the water ankle-deep, the toads lobbing from the millstones | bellows toads, root knots, skitters; a shade at the end | Reed and rust |
| Viridel | **The Seed Vault**: the white builders' greenhouse cellars, beds of sleeping eyes that wake the moths | signal moths, root knots, a furnace brute at the end | Leafglass |
| the Underwater City | **The Flooded Gallery**: sealed halls under the glass, the lamps flickering as the jellies ward the crabs | crabs, lantern jellies, sky rays; a lamp tripod at the end | Pearl and tide |
| the City-Shaft | **The Lift Depot**: a stack of cab bays, each room a platform the cranes lower the next wave onto | lamp tripods, horn lizards, toads; two shades at the end | Cab yellow |
| the Glass Dunes | **The Kiln Yard**: the glassworkers' cooling sheds, the floor glass that cracks under a brute | furnace brutes, glass crabs, worms; a drone pair at the end | Furnace glass |
| the Buried Machine | **The Tooth Gallery**: a gear-house between the canyon's teeth, rails across it the carts run on | mound worms, crucible carts, centipedes, skitters | Brass tooth |
| the Moon Foundry | **The Pour Floor**: the casting bays, a pour every minute across one room's floor (step off the channels) | crucible carts, skitters, lizards; a brute at the end | Moon slag |
| the Garden of Spheres | **The Quiet Orchard**: the spheres' walled gardens at dusk, the hounds running in the trees' long shadows | rollers, centipedes, antler hounds; a marionette at the end | Orchard dusk |
| the City Floating in Space | **The Oil Exchange**: the islands' lamp-oil depot, its rooms joined by short bridges over the dark | ring drones, moths, rollers; a lamp tripod at the end | Lamp oil |
| the Signal Market | **The Back Rooms**: the market's shuttered shops after hours, a bell walker tolling in the last | lizards, hounds, marionettes; a bell walker at the end | Signal neon |
