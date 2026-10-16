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

**Built: Vael's, the Wind Cloister** (v1.80): on the rose cliff by the riders' monastery over the cloud (walk north-east of
the monastery, past the Almonry), its host Sister Maud; or `?game=fight-arzach`. Below: "The Wind Cloister".

**Built: Lorn's, the Drowned Mill** (v1.80): on the dry hillside south-east of the landing, its host Gert; or
`?game=fight-perdide`. Below: "The Drowned Mill".

**Built: the Moon Foundry's, the Pour Floor** (v1.80): on the open floor just south of the workers' quarter, its host
Marta; or `?game=fight-moonfoundry`. Below: "The Pour Floor".

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
The blade's cut takes every foe a drawn crescent covers (`WIDE_CUT`, issue #368: the crescent of the sword's water
laid as the swing goes, out to 2.6 m from him, and what it covers is exactly what is cut, a wall between keeping a foe
out; v1.77 took a 3.9 m, ±1.5 rad cone with nothing drawn; the sword drawn 1.25 m long in there: docs/systems/minigames.md
"The Sunken Hall as a game"). Outside the fight temples neither is set: the evade and the swing are as they were. Tests: `tests/fight-roll.test.js`.

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

**Wells, gorged ones, geysers, the rank** (issue #368, docs/systems/minigames.md "The Sunken Hall as a game"): a
spring wells up (an ember ring) 0.7 s before foes come out of it; a table's `{ gorged: true }` is a bigger light foe
with more health that leaves a heart and an ember shard (8 s of double cuts); a room's `geysers: { every, n }` opens
ink pools on the floor under and near him that burst after 1.25 s (half a heart, two cuts to foes in them); the last
three of a wave stand under pillars of light; a foe out of the room is put back; the results rank the run S to C by
the hearts lost and the time against the table's `par`.

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

## The hazards, the looks (v1.80)

The desert's geysers are spots under him; the other worlds' hazards run on **lanes** (`src/fight-temples/hazards.js`): a
strip the whole room long, `w` wide (2.4–3.4 m), across the room at `at`, going `dir` along it. A room's table:
`hazard: { kind, every, n, lanes: [{ along: 'x' | 'z', at, w, dir }] }`. Every `every` s of a wave (the last wave
`HAZARD.last` 0.75 of it, Gentle 1.6 times as rarely and half the harm) `n` lanes go, the one he stands in (else the
nearest him) first (`pickLanes`). Each kind warns on the floor, then acts, and a roll's i-frames take him through, as a
blow's (`player.dodge`); every kind hurts the foes in it too, so the crowd can be led in. The first room of a temple has
none: it teaches the crowd; there are more, and sooner, deeper in (the tests hold both).

| kind | warns | then | him | the foes in it |
|---|---|---|---|---|
| `gust` (Vael) | pale chevrons run down the lane the way it will blow, 1.1 s | the wind blows 0.7 s | shoved along it 11 m/s, a quarter heart, a flinch | buffeted (a cut), carried at 15 m/s toward the wall at its end, slammed there (another) |
| `stone` (Lorn) | the lane's edges in rust, a millstone rising at its head, 1.4 s | it rolls the length of the room at 8.5 m/s | a heart, thrown out of its way | crushed (three cuts); flyers above it |
| `pour` (the Foundry) | the channel's rims glow, flickering faster, 1.5 s | slag runs down it at 14 m/s and lies 3.6 s, then crusts over | half a heart a tick (0.7 s) in it | a cut a tick; flyers above it |

The pour's channels are cut into the floor from the start (a dark groove, its rims in the cap's colour), so the floor
is read before the fight. `S.hazards` (the session) gives the lanes under way to the checks, and `start(room, lane)`.

A table's look: `ground` (the terrain material's options: the desert's `ripples`/`sandInk`, or none), `outside: 'cliff'`
(a ledge round the walls, then the rock falls 34 m to the cloud: `rooms.js CLIFF`), `water` (a sheet over the rooms and
doorways at 3.5 cm, pale ripple rings on it; flat, not the lakes' mirror, which washed white from this high), `pillar`
(`dress.js pillarModel`: the desert's `column`, Lorn's `stack` of millstones, the Foundry's iron `post`), `dress`
(`dress.js`: what stands round the hall, only on the far side of the walls from the camera, never between a room and
it: `farSpots`), `sky` and `look` (the world's, handed to `arenaLevel`), and the palette's `glyph` (the springs' rings,
the gates' marks), `pale`, `gust`, `slag`/`slag2`/`crust`. The doorway's `entrance`: `{ at, heading, level?, near }`
(`level`: the part of a merged world it stands in, its frame; `near`: the settlement it stands by, for the tests).

## The Wind Cloister (Vael, `src/fight-temples/arzach.js`)

The riders' old monastery court on a spur of the cliff, roofless, its stalls empty, the sea of cloud far under its walls
(`outside: 'cliff'`; the pennant poles and two broken arches on the ledge behind, `dress: 'cloister'`), in pale stone and
slate with a sky-blue glyph, at 9.4 in the morning. The doorway is on the rose cliff by the riders' monastery over the
cloud (the sky stones' frame: `entrance.level 'arzach2'`, (-215, 76.8, -172), its height given, the ground the markers
find being the plain's under the cliff), facing the monastery; Sister Maud, who sweeps the cloister, offers it.

| room | shape | waves | gusts |
|---|---|---|---|
| the riders' stalls | 16 × 12, two stall posts | blots and a ray; blots and two herons | none |
| the cloister | 22 × 22, its arcade's six columns, a spring in the middle | rays and blots; herons, blots, a gorged ray; blots, rays, a gorged heron | two lanes east and west, one every 6.5 s |
| the bell walk | a narrow gallery 20 × 10 | herons, rays, blots; blots, rays, a gorged blot | three short lanes across it, two every 5 s |
| the old roost | 24 × 24, four columns, the altar | rays, blots, herons, a gorged ray; a crab of the sky stones and two herons whole, blots, rays, a gorged heron and blot | four lanes, both ways, two every 5 s |

133 foes, par 4:10; Rider's slate (blue-grey brass, white water). Played through by the scripted player (nothing
hurting it, stepping out of the lanes): 2:28 to the reliquary, all 133, 28 gusts.

## The Drowned Mill (Lorn, `src/fight-temples/perdide.js`)

The reed-cutters' old mill, its floors under a hand of water (`water`), its pillars stacks of millstones, reed beds, the
great wheel and sluice posts on its banks (`dress: 'mill'`), at 17.6 under Lorn's ringed planet. The doorway is on the
dry hillside south-east of the landing (20, -45), facing it; Gert, who ground the reed-cutters' meal, offers it.

| room | shape | waves | millstones |
|---|---|---|---|
| the mill race | 12 × 16, long | skitters and a toad; root knots, skitters, a toad | none |
| the wheel pit | 20 × 16, two stacks | skitters and toads; root knots, skitters, a heron, a gorged toad; toads, skitters, a gorged root knot | two lanes east and west, one every 7 s |
| the grinding floor | 24 × 18 (its door off-centre), two stacks | herons, toads, skitters; root knots, skitters, toads, a gorged heron | three lanes rolling down toward the camera, two every 6 s |
| the miller's hall | 22 × 22, four stacks, the altar | toads, skitters, root knots, a gorged toad; a shade out of the Deep Wood and a whole root knot, skitters, toads, herons, a gorged root knot and toad | four lanes, both ways, two every 5.5 s |

143 foes, par 4:20; Reed and rust. The toads lob from afar while the skitters swarm: the stones are for the swarm.
Scripted run: 3:24, all 143, 39 stones (it was crushed four times: it steps out only once a stone is coming).

## The Pour Floor (the Moon Foundry, `src/fight-temples/moonfoundry.js`)

The casting bays under the house, where the moons' metal was poured and the house still pours by itself: ivory walls,
brass caps, iron posts, crucibles and hoist frames on the banks, slag cooling in the dust (`dress: 'foundry'`), under the
Foundry's own sky and look and its two moons. The doorway is on the open floor just south of the workers' quarter
(-102, -6), facing it; Marta, who tapped the crucibles, offers it.

| room | shape | waves | the pour |
|---|---|---|---|
| the tapping bay | 14 × 14 | skitters and lizards; a cart, skitters, a lizard | none |
| the casting bays | 24 × 20, four posts between three channels | lizards, skitters; carts, skitters, a gorged lizard; skitters, lizards, a gorged cart | three channels down it, one every 6.5 s |
| the mould floor | 20 × 14, two channels along it, a dry middle the door opens onto | lizards, skitters, a cart; skitters, lizards, a gorged skitter | one every 5.5 s |
| the great crucible | 24 × 24, four posts, the altar | carts, lizards, skitters, a gorged lizard; a furnace brute and two whole carts, skitters, lizards, a gorged cart and skitter | four channels, both ways, two every 5 s |

147 foes, par 4:20; Moon slag (ivory brass, molten water). Scripted run: 2:40, all 147, 18 pours.

## The other worlds (one line each)

| world | fight temple | its foes | its colours |
|---|---|---|---|
| Vael | **The Wind Cloister** (built, v1.80, above): a roofless monastery court on a cliff, its gates the riders' old stalls; gusts through the arches shove the crowd | sky rays, herons, blots; a crab of the sky stones at the end | Rider's slate (blue-grey brass, white water) |
| Lorn | **The Drowned Mill** (built, v1.80, above): four flooded rooms of a reed-cutters' mill, the water ankle-deep, the toads lobbing from the millstones | bellows toads, root knots, skitters; a shade at the end | Reed and rust |
| Viridel | **The Seed Vault**: the white builders' greenhouse cellars, beds of sleeping eyes that wake the moths | signal moths, root knots, a furnace brute at the end | Leafglass |
| the Underwater City | **The Flooded Gallery**: sealed halls under the glass, the lamps flickering as the jellies ward the crabs | crabs, lantern jellies, sky rays; a lamp tripod at the end | Pearl and tide |
| the City-Shaft | **The Lift Depot**: a stack of cab bays, each room a platform the cranes lower the next wave onto | lamp tripods, horn lizards, toads; two shades at the end | Cab yellow |
| the Glass Dunes | **The Kiln Yard**: the glassworkers' cooling sheds, the floor glass that cracks under a brute | furnace brutes, glass crabs, worms; a drone pair at the end | Furnace glass |
| the Buried Machine | **The Tooth Gallery**: a gear-house between the canyon's teeth, rails across it the carts run on | mound worms, crucible carts, centipedes, skitters | Brass tooth |
| the Moon Foundry | **The Pour Floor** (built, v1.80, above): the casting bays, a pour every minute across one room's floor (step off the channels) | crucible carts, skitters, lizards; a brute at the end | Moon slag |
| the Garden of Spheres | **The Quiet Orchard**: the spheres' walled gardens at dusk, the hounds running in the trees' long shadows | rollers, centipedes, antler hounds; a marionette at the end | Orchard dusk |
| the City Floating in Space | **The Oil Exchange**: the islands' lamp-oil depot, its rooms joined by short bridges over the dark | ring drones, moths, rollers; a lamp tripod at the end | Lamp oil |
| the Signal Market | **The Back Rooms**: the market's shuttered shops after hours, a bell walker tolling in the last | lizards, hounds, marionettes; a bell walker at the end | Signal neon |

## The next ones, written up (for later)

Each on the same template: a table, a hazard of its own (a new `kind` in `hazards.js` where none of the four fits), a
look (`ground`, `pillar`, `dress`), a host and a doorway by a settlement, its world's kinds light, gorged ones from the
second room, two or three tough ones at the end.

**Viridel: the Seed Vault.** The white builders' greenhouse cellars under the Builders' Greenhouse: white tile, glass
beds of sleeping eyes along the walls (`pillar` a glass bed on a plinth, `dress` the greenhouse's ribs over the far
walls, its light coming down green). Foes: signal moths (a swarm of three, one cut), root knots, a blot or two; at the
end a furnace brute out of the boiler room. Hazard **`bloom`** (lanes): a bed's eyes open down a lane (a row of pale
irises lighting one by one, 1.2 s), then they flash: him blinded a moment (the moths' flash: `Foes.blind`), the moths in
it drawn to it and stunned (a cut), so you herd moths into a lane before it opens. Rooms: the potting cellar (no
eyes), the long bed (two lanes along it), the boiler room (pipes as pillars, the lanes across), the seed safe (both
ways, the altar a seed drawer). Reward: Leafglass (green glass brass, clear water with a green core). Door: by the
gardeners' stair at the foot of the water stair.

**The Underwater City: the Flooded Gallery.** Sealed halls under the glass, the lamps on the walls flickering. Foes:
glass crabs, lantern jellies (they ward the crabs: a crab beside a jelly takes no cut until the jelly is down), sky rays;
at the end a lamp tripod. Hazard **`dark`** (a room-wide one, a new kind): every so often the lamps go out for 3 s, all
but the lit discs under the lamps on the floor; in the dark the foes see no farther than 6 m and he only what a lamp or
a jelly lights, so you fight from the discs; the jellies glow, so they are seen and taken first. Rooms: the airlock, the
fish market (stalls as pillars), the long gallery (the glass wall the camera looks through: no wall on the near side,
the sea beyond), the whale-watch (the altar under the dome). Reward: Pearl and tide. Door: by the lamplighters' quay.

**The City-Shaft: the Lift Depot.** A stack of cab bays: each room a platform, the next wave lowered onto it by a crane
(the cab coming down is the spring: its shadow grows on the floor for 1.4 s, then it lands and opens). Foes: lamp
tripods, horn lizards, bellows toads; at the end two shades. Hazard **`drop`** (spots, like the geysers): a crane lets a
load fall on a ring of the floor that tightens as it comes (1.2 s; a heart, three cuts to the foes under it). The rooms
are platforms with a drop to the shaft round them (the cliff of Vael's, here a shaft: `outside: 'shaft'`, its far wall
of windows lit), joined by short bridges (doors with rails). Reward: Cab yellow. Door: on the middle terrace beside the
cab stand.

**The Glass Dunes: the Kiln Yard.** The glassworkers' cooling sheds: a floor of glass tiles over a red glow. Foes:
furnace brutes (the light wave's only big kind: one in a wave, two cuts), glass crabs, mound worms; at the end two
clock-house drones. Hazard **`crack`** (tiles, a new kind): a brute's slam, a worm's breaking through and a long fall
crack the tiles round it (drawn: a white star), and a cracked tile stood on for 0.8 s breaks: a pit to the kiln's glow
for 6 s (half a heart, out at its edge); foes walk into them. The floor is a grid of 2 m tiles (`ground` none, the tiles
drawn), the pillars kiln chimneys, the dress the sheds' glass roofs over the far walls. Reward: Furnace glass. Door:
by the kiln-masters' yard at the glassworks.

**The Buried Machine: the Tooth Gallery.** A gear-house between the canyon's teeth. Foes: mound worms, crucible carts,
centipedes, skitters; no single tough one at the end but three centipedes whole. Hazard **`cart`** (lanes): rails cut
across the floor (drawn from the start, as the pour's channels), and an ore cart comes down a rail with its lamp lit
(the lamp on the rail's far end blinks 1.3 s first): a heart and thrown, every foe on the rail run down; the rails also
carry the carts the foes ride (a crucible cart's charge runs along its rail). Rooms: the tooth gate, the gear pit (a
great gear turning in the middle, solid, a pillar that turns), the rail yard (five rails), the tooth hall. Reward:
Brass tooth. Door: under the canyon's first tooth by the lift.

**The Garden of Spheres: the Quiet Orchard.** The spheres' walled gardens at dusk, rows of trees whose long shadows lie
across the paths (the hour 18.6). Foes: rollers, centipedes, antler hounds (they run in the shadows: only there can
they step behind you); at the end the glass marionette. Hazard **`shade`** (lanes that move): the trees' shadows sweep
across the room as a sphere rolls overhead (a lane of shade crossing the floor at 2 m/s): in it the hounds are fast and
unseen but for their eyes; out of it they are slow and lit: you keep to the light and cut them as they come out. Rooms:
the gatehouse, the orchard (trees in rows: the pillars), the lawn (no cover), the round garden (the altar a sundial).
Reward: Orchard dusk. Door: at the white archway's garden gate, off the round plaza.

**The City Floating in Space: the Oil Exchange.** The islands' lamp-oil depot: its rooms platforms over the dark, joined
by short bridges (doors with rails), oil drums as pillars. Foes: ring drones (their harpoons), signal moths, rollers; at
the end a lamp tripod. Hazard **`spill`** (spots that spread): a drum knocked over (by a roller's bowl or a cut) spills
a pool that spreads to 2.5 m; the drones' sparks light it: a lit pool burns (half a heart a tick, two cuts to foes) for
4 s; you can light it yourself with the fluid gun's ember. The first hazard the player starts. Rooms: the weigh house,
the drum yard, the cable bridge (narrow, long), the clearing house. Reward: Lamp oil. Door: on the oil quay by the
bill-runners' office.

**The Signal Market: the Back Rooms.** The market's shuttered shops after hours, their signs dark: narrow rooms, many
doors, crates as pillars. Foes: horn lizards, antler hounds, marionettes (strings: they pull you a little toward
them); at the end a bell walker tolling. Hazard **`toll`** (room-wide rings): the bell walker's toll is heard from the
first room on (it walks the market above): a ring of sound spreads from a sign on the wall (its neon flicking on 1 s
first) across the room at 6 m/s; caught in its edge: a flinch and a quarter heart, foes stunned 1 s (cut them then);
a roll through the ring takes him through. In the last room the walker itself tolls, from where it stands. Rooms: the
shuttered row, the sign-painter's (signs as pillars, lit), the stockroom (crates in a maze), the counting house.
Reward: Signal neon. Door: in the back alley behind the sign-hanger's yard.

What each needs that is not built: a hazard kind (`bloom`, `dark`, `drop`, `crack`, `cart`, `shade`, `spill`, `toll`:
`dark` and `toll` room-wide rather than on lanes, `crack` and `spill` changing the floor), two looks (`outside: 'shaft'`,
the Kiln Yard's tiles), and for the Flooded Gallery a near wall left out (the camera looking through the glass).
