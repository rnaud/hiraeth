# Fight temples (issue #341)

> "Create a new fight temple concept in each world that looks and feels like a Diablo game. 3D isometric camera
> angle, lots of monsters with low hp, to create more diversity in gameplay. This unlocks new colors for the
> backpack and sword and shield." (the author)

A temple of another kind beside each world's makers' temple: no puzzle, no guardian, no gadget, only a fight, seen
from high above at a fixed angle, through a few linked rooms of many weak foes. It is short (three to five minutes),
optional, replayable for a best time, and it pays in looks: a world's colours for the backpack, the sword and the
shield. The makers' temples and the fights in the open are untouched.

In the story they are the makers' **spring-houses**, floors laid over the places where the dark wells up, built over and
forgotten; the hosts want their places back (`docs/story-bible.md`, "The spring-houses", issue #483).

**Built: the desert's, the Sunken Hall** (v1.76). How to play it: in the desert walk west from the pilgrims' camps
to the gatehouse with the crossed blades on its roof (128, 300; the Blade Gate, issue #384) and ask Wafa, who keeps watch by it; or Debug → Games →
The Sunken Hall (`?game=fight-desert`), or the Arcade's sign.

**Built: Vael's, the Wind Cloister** (v1.80): on the rose cliff by the riders' monastery over the cloud (walk north-east of
the monastery, past the Almonry), its host Sister Maud; or `?game=fight-arzach`. Below: "The Wind Cloister".

**Built: Lorn's, the Drowned Mill** (v1.80): on the dry hillside south-east of the landing, its host Gert; or
`?game=fight-perdide`. Below: "The Drowned Mill".

**Built: the Moon Foundry's, the Pour Floor** (v1.80): on the open floor just south of the workers' quarter, its host
Marta; or `?game=fight-moonfoundry`. Below: "The Pour Floor".

**Built in v1.81:** Viridel's **Seed Vault** (on the plateau west-south-west of the Builders' Greenhouse, by the top of the
water stair; its host Hollis; `?game=fight-edena`), the City-Shaft's **Lift Depot** (on the middle terrace by its cab
stop; Ulric; `?game=fight-incal`), the Buried Machine's **Tooth Gallery** (east of the domes; Greta; `?game=fight-buried`)
and the Signal Market's **Back Rooms** (in the back alley west of the sign-hanger's ladder; Lettie; `?game=fight-bazaar`).
And the Underwater City's **Flooded Gallery** (in the Dock hall; its host Sabine; `?game=fight-underwater`).
And the Glass Dunes' **Kiln Yard** (by the north camp's awnings; Ozren; `?game=fight-glassdunes`).
And the Garden of Spheres' **Quiet Orchard** (west of the round plaza; Wenna; `?game=fight-spheres`).
And the City Floating in Space's **Oil Exchange** (on the Towers' deck; Osric; `?game=fight-spacecity`).
Below, each under its name.


## Each run its own (issue #386, v1.82)

> "each time I walk into the fight temple it should be in a different order" (the author)

A temple's table is now its **theme**, and every visit draws its own **run** from it (`src/fight-temples/generate.js`
`drawRun(def, seed)`, called by the game's build: `index.js`). The run is a table of the same form, so `rooms.js`,
`session.js`, the hazards and the tests read it as they read a hand-laid one:

- **The order.** The entrance stays first and the room with the altar (and the tough ones) last; the rooms between are
  shuffled.
- **The layout.** The rooms are laid out afresh, each off the last one's north or west side (the far sides: its gate
  is seen), one wall (2 m) on, slid along so the two overlap by 6 m or more with the 4 m door in the overlap, never
  closer than a wall to any room before it, within 74 m of the middle (the hall's ground is 170 m across), on whole
  metres (`layOut`). A draw that will not lay out is drawn again from the same seed.
- **The rooms' insides.** Each room is mirrored across x, z, both or neither (its springs, pillars, hazard lanes, signs
  and lamps with it, the lanes' ways flipped; the entrance only across x, its spawn with it), and a room with more than
  three springs loses one half the time (`pieceOf`, `mirrorPiece`, `placePiece`). A sign the new layout put in a
  doorway is hung again on a wall with no door.
- **The waves.** Each wave is drawn from the theme's foes (`foePool`: the light kinds weighted by how many the table
  brings, the kinds it gorges, the last wave's tough ones) for the **budget** the table's wave at that place in the run
  had (`waveCost`: a light foe its heads × its cuts, a gorged one 4, a tough one its health), so the difficulty curve is
  the table's whatever the order; the gorged ones where the table had them, the tough ones in the last wave
  (`drawWave`). Within half the cheapest foe of the budget, every wave.
- **The seed.** `?seed=<n>` replays a run (the same seed, the same rooms, layout and waves: a seeded mulberry32,
  `rngOf`); without it a fresh one (1 … 999 999, `seedOf`). The results card and the card of a run lost give it
  ("This run: 48213 (… ?seed=48213)"). Retry replays the same run (the level is built once a visit); the best time is
  the temple's, whatever the run.

In the engines it is the same JS (engine/game.js builds the game's level through the same `build`): no location there,
so a fresh seed each time.

### A theme (a new world's temple in a few lines)

`fromTheme(t)` makes a full table from a short theme: `rooms` another temple's table (its rooms are the pieces, its
waves the budget curve, not the foes), `foes` `{ light: { kind: weight }, gorged: [kinds], tough: [[kind, n, { tough:
true }]] }`, `hazard` one of hazards.js's kinds (its lanes, signs or lamps laid in each room by the room's own shape,
off its pillars and altar: `hazardLayout`; as often as the pieces' own came), and the look, host and door as any
table (`palette`, `pillar`, `dress`, `sky`, `entrance`, `colours`, its host in hosts-data.js). The twelve built tables
are themes as they are (their waves read as pools and budgets); `tests/fight-generate.test.js` plays a short theme of
every hazard kind over three temples' rooms.

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
| the doorway | `src/fight-temples/entrance.js` `entranceModel` | the Blade Gate, the game's sign in its world, one gatehouse dressed in each world's palette (kit/marker.js uses a game's `marker.model`; solid; its opening's light through `Thresholds.addDoor`; docs/systems/minigames.md) |
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
The roll is on the face button printed B, wherever the pad has it (issue #442, `rules.js` `rollInput`): B / ○ on Xbox
and PlayStation pads; with Nintendo letters (the Retroid, a Switch pad: `native-pad.js` `padFaces`) the bottom button,
the jump's place, and the right one (printed A there, the evade's own elsewhere) does nothing. The card's row is
`rollKey` (in Xbox form by position, so the page prints the pad's B). The touch jump button and jump hints are hidden.
The blade's cut takes every foe a drawn crescent covers (`WIDE_CUT`, issue #368: the crescent of the sword's water
laid as the swing goes, out to 2.6 m from him, and what it covers is exactly what is cut, a wall between keeping a foe
out; v1.77 took a 3.9 m, ±1.5 rad cone with nothing drawn; the sword drawn 1.25 m long in there: docs/systems/minigames.md
"The Sunken Hall as a game"). Outside the fight temples neither is set: the evade and the swing are as they were. Tests: `tests/fight-roll.test.js`.

**The quick cut, the roll's cancel and readable kills** (issue #442). The combo is quicker in here (`fluid-blade.js`
`QUICK_CUT`, set on the blade as `quick` beside `roll`): wind-ups × 0.65, cuts × 0.9, follow-throughs × 0.55, the pause
after the third × 0.6, the clips played through the same frames faster: the cuts 0.32 / 0.35 / 0.50 s (were 0.47 / 0.51
/ 0.75), the pause 0.24 s (0.4). Only in here: the crowds of one- and two-cut foes want a quick blade, while the world's
fights (guardians, parries, the charged cut) are tuned to the combo as it is. The roll cuts a swing off (`rollCancels`):
pressed in its wind-up, its follow-through or a charge, it rolls that frame and the swing is dropped; pressed during
the cut's own active frames (about 0.12 s) the cut lands and the press is kept (`ROLL.buffer`, 0.2 s), so the roll comes
the frame they end. Why not at any time: the combat review's fairness rule is that a move is answerable but committed;
taking back a wind-up when a foe's tell starts is the reaction the author asked for, and a hit that could always be
rolled out of the instant it lands would cost nothing. The evade elsewhere still only leaves a follow-through.

A kill reads from the iso camera (28 m off; `kill-fx.js`): at the killing blow the body is thrown back along it
(7 m/s easing out, about a metre, kept in the room and off the pillars) and its own defeat (`enemies/defeat.js`) runs
1.6 times as fast, so it lands with the blow; a thin ring of the world's glow snaps out on the floor; 14 big drops of
its ink fly along the blow; a wet thump (`Audio.foeKill`) under its cry; and a star of ink spreads on the floor in 0.1 s,
lies 2.4 s, then dries into the floor's colour and shrinks away over 0.9 s. In a crowd every kill is thrown and stains,
but only 4 in any 0.3 s ring, splash and thump (one thump in the same few frames), so a cut through eight is eight
marks, not a blaze. Two instanced meshes (24 splats, 24 rings): two draws at most.

What the Diablo games do, for this: **Diablo II** lets whatever you kill keel over and lie on the ground, the corpse
staying put (corpses were a resource there: Corpse Explosion, Revive) ([GamesBeat, on corpses in Diablo III](https://gamesbeat.com/creating-corpses-making-bodies-matter-in-diablo-3/);
[Diablo Wiki, Corpse Explosion](https://diablo.fandom.com/wiki/Corpse_Explosion)). **Diablo III** made the death the
spectacle: pre-animated deaths handed to physics, bodies flung by a blow, torn apart by critical hits, a Barbarian's
bash sending a skeleton across the screen, often with no body left (a Havok ragdoll system Erin Catto built to give
"lots of death variation", [GDC 2012 slides](https://box2d.org/files/ErinCatto_Ragdolls_GDC2012.pdf); GamesBeat above);
corpses came back with the Necromancer, kept uniform and capped on screen so they read "at a glance". **Diablo IV**
layers "death kits": how a monster dies follows what killed it (shattered when frozen, burnt to the bone by fire), with
blood flying, the bodies lying a while ([Icy Veins, GamesRadar hands-on](https://icy-veins.com/forums/topic/47854-diablo-4-gamesradar-hands-on-death-kits-difficulty-and-more));
its louder on-death effects drew complaints of clutter and were toned down. So: not a fade alone; the blow's
direction and weight shown at once, a mark that stays, and the noise kept down in a crowd. Ours is that in ink: the
knock and the quick fall, the splat that stays and dries (no corpse to tidy: the stain is the mark), the ring and the
splash only within a budget. Tests: `tests/fight-feel.test.js`.

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
the hearts lost and the time against the table's `par` (the hearts lost weighed against the hearts on arrival, below).
The shard's double cuts are "the blade runs bright" (never "fury"); the results card's first line is the place's own,
the table's `quiet` ("The ink sinks back into the floor. Wafa comes down the stair."), the scores under it, and the
run's title says the house "is quiet" (issue #483).

**Harm along the route** (issues #532, #533; `src/fight-temples/harm.js`). Every blow and every hazard in a temple is
scaled by `fightHarm(world)`: the hearts a traveller has on arriving in that world (`arrivalHearts`: the start's 3 and
every heart container sold in the worlds before it, a merged world's part's shop counted in its world (issue #560: the
Almonry's in Vael, the Welcome-Shelf's in Lorn), 3 in the desert … 17 in the Signal Market; the combat review plays
with the same), over `FIGHT_HARM.ref` (12), times a rise of `FIGHT_HARM.rise` (half) from the first world to the last.
So each temple costs a like share of his hearts, a little more the further he is: the Sunken Hall's blows strike at a
quarter of their own, the Back Rooms' at 2.1 times. It takes the place of the stage's `HARM_BY_STAGE` in here (`Foes`
`harmScale`); a table's `stage` still sets how many strike at once, and its `harm` would set its scale by hand. The
hazards take the same scale but never above their own (`hazardScale`, `FIGHT_HARM.hazards` 1): the rise is the foes',
and a hazard learnt in one room should not cost more in the next world (at 1.6–1.9 times, the oil, the shade and the
toll took more than the crowds of the last temples). One blow takes at most a heart in here (`FIGHT_HARM.blow`, `Foes`
`harmCap`): at the Oil Exchange's scale a tough tripod's stamp was 1.7 hearts. A hurt
is counted in quarter hearts, and every light blow used to round up to a quarter (half a skitter's quarter-heart nip
too): the hurts now go through one purse a run (`harmBank`, `Foes.harmBank`, the session's `hurtBy` for the geysers and
hazards), which carries what is under a quarter to the next hurt and pays whole quarters. So a table's `lightHarm`
(0.4 in the Flooded Gallery, the Kiln Yard and the Oil Exchange) means four tenths, and Gentle's half is half. The rank
counts the hearts lost against `RANK.per` (10) hearts: with 3 hearts an S is 0.3 lost, with 15 it is 1.5.

**The loot.** A heart now and then (5 %, 16 % at half your hearts or fewer, never at full), drawn in as you pass; a
chime from a light foe a quarter of the time, six from a tough one, a purse for each wave, room and the finale
(`ctx.drop`: the world's chime field, into the wallet). Once the colours are won, half the chimes: the hall is not a
mine.

**The reward.** Taking the reliquary wins the world's colours (`unlockColours`: the save's `kit.colours.<id>`) and
wears them on every piece at once; the results say so. In Items, a Colours strip over the gear: a button a piece
(backpack, sword, shield), A / × the next colour won for it (`kit.colour.<piece>`), each named by the house it came
from (`colourName`: "Ember · the Sunken Hall", issue #483). A palette paints the backpack's
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
`HAZARD.last` 0.75 of it, but for the dark, `STEADY`; Gentle 1.6 times as rarely and half the harm, through the run's purse: above) `n` lanes go, the one he stands in (else the
nearest him) first (`pickLanes`). Each kind warns on the floor, then acts, and a roll's i-frames take him through, as a
blow's (`player.dodge`); every kind hurts the foes in it too, so the crowd can be led in. The first room of a temple has
none: it teaches the crowd; there are more, and sooner, deeper in (the tests hold both).

The hearts in the table are each kind's own, before the temple's scale ("Harm along the route", above). The lying
ground (slag, a pit, oil) waits `HAZARD.enter` (0.45 s) after he steps in before its first tick, so crossing it at a
walk costs nothing (issue #533).

| kind | warns | then | him | the foes in it |
|---|---|---|---|---|
| `gust` (Vael) | pale chevrons run down the lane the way it will blow, 1.1 s | the wind blows 0.7 s | shoved along it 11 m/s, a quarter heart, a flinch | buffeted (a cut), carried at 15 m/s toward the wall at its end, slammed there (another) |
| `stone` (Lorn) | the lane's edges in rust, a millstone rising at its head, 1.4 s | it rolls the length of the room at 8.5 m/s | 0.6 of a heart (a heart until v1.85), thrown out of its way | crushed (three cuts); flyers above it |
| `pour` (the Foundry) | the channel's rims glow, flickering faster, 1.5 s | slag runs down it at 14 m/s and lies 3.6 s, then crusts over | 0.4 heart a tick (0.7 s) in it, the first tick 0.45 s after stepping in (`HAZARD.enter`; half a heart until v1.85) | a cut a tick; flyers above it |
| `cart` (the Buried Machine) | the lamp on a cart at the rail's head blinks faster, 1.3 s (the rails drawn from the start) | the cart runs the rail at 11 m/s | three quarters of a heart (a heart until v1.85), thrown aside | three cuts; flyers above it |
| `bloom` (Viridel) | a row of sleeping eyes down the lane opens one by one from its head, 1.2 s | they flash white, 0.35 s | dazzled (`Foes.blind` 0.6 s), a quarter heart | stunned 1.2 s and a cut; moths from 1.2 m beyond its edge drawn in |
| `drop` (the City-Shaft) | **spots**, not lanes: a ring tightens on the deck under him and round him (`geyserSpots`, 3.2 m apart), a load's shadow growing, 1.3 s | the crane's load lands, lies 1.4 s, sinks | 0.4 of a heart (half until v1.85), thrown out | three cuts to all under it |
| `toll` (the Signal Market) | a sign on a wall (`hazard.signs`) flickers on, 1 s | a ring of sound spreads from it at 6 m/s across the room | its edge passing him: a flinch, a fifth of a heart (a quarter until v1.85) | its edge passing: stunned 1 s and a cut |
| `spill` (the City Floating in Space) | a pool of oil spreads on the deck under him and near him (within 3.6 m: on the screen), a spark at its rim, 1.4 s | it burns 2.6 s | 0.12 heart a tick (1 s) in it, the first 0.45 s after stepping in (v1.85, issue #533: a quarter every 0.8 s for 3 s) | a cut a tick; flyers above it |
| `shade` (the Garden of Spheres) | its edge glows on the side it will come from, 1 s (`hazard.lanes`: only `along` and `dir`) | a 4 m band of shade sweeps the room end to end at 2.4 m/s | a fifth of a heart a tick (1.2 s) in it (a quarter until v1.85) | in it they can't be aimed at (`phased`) |
| `crack` (the Glass Dunes) | the floor's 2 m glass tiles drawn; a tile under him and tiles near him crack, 1.1 s: its edge lit in the glyph's tone (flickering faster in the last half), a dark star of cracks spreading across it (a white star until v1.85, all but unseen on the pale glass: issue #482) | they break: pits to the kilns' glow, 2.6 s | 0.15 heart a tick (0.9 s) in one, the first 0.45 s after stepping in (v1.85, issue #533: a quarter, 3.5 s) | a cut a tick |
| `dark` (the Underwater City) | the room's lamps (`hazard.lamps`, posts with globes, their discs drawn) flicker faster, 1.2 s | the room goes dark 2.6 s, no sooner in the last wave (`STEADY`): the floor black but for the discs (2.8 m) | out of the light a tenth of a heart a second, 1.2 s first (v1.85, issue #533: dark 3.6 s of every 5.25 in the last wave, 2.4 m discs, a quarter a second after 0.6 s) | in a lamp's disc a cut a second |

`drop` and `toll` have no lanes (`ON_LANES`): a load is begun on `{ spot }`, a toll on `{ sign }` (the signs farthest from
him first, so the ring is seen coming). Since v1.81 the gust is drawn as it blows too: fourteen long white streaks race
down the lane at waist and head height, the lane's floor flashes pale, sixty flecks fly with it.

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

## The Seed Vault (Viridel, `src/fight-temples/edena.js`)

The white builders' cellars under the Builders' Greenhouse: white tile and green glass, boiler pipes for pillars
(`pillar: 'pipe'`), the greenhouse's white ribs and potted trees over the far walls (`dress: 'greenhouse'`). Rooms: the
potting cellar (no eyes), the long bed (12 × 24, two beds down it), the boiler room (four pipes, a bed each way), the
seed safe (four beds round the altar, two at a time). Foes: moths (most of them, a cut each), blots, root knots; a
furnace brute and a whole root knot at the end; 151 in all, par 4:10; Leafglass. The bloom is what moths are for:
they are drawn into a bed's flash from a little way off.

## The Lift Depot (the City-Shaft, `src/fight-temples/incal.js`)

The old cab bays on a ledge of the shaft: iron decks (`outside: 'cliff'`, the drop of the shaft round them), iron posts,
the shaft's far wall of lit windows and three crane jibs round it (`dress: 'shaft'`). Rooms: the cab stand, the first
bay (two loads at a time), the second bay (its door off to one side), the dispatch floor (two at a time, more often). Foes: horn
lizards in pairs (most), bellows toads, lamp tripods made light; two shades at the end; 111, par 4:10; Cab yellow. The
loads come down on him and round him, so he keeps moving and leads the crowd under the rings.

## The Tooth Gallery (the Buried Machine, `src/fight-temples/buried.js`)

A gear-house between the canyon's teeth: brass and rust, iron posts, the teeth standing round it and a great gear half
sunk (`dress: 'teeth'`); rails laid across its floors from the start. Rooms: the tooth gate, the gear pit (two rails
across it), the rail yard (four short rails across a narrow room, two carts at a time), the tooth hall (rails both ways
round the altar). Foes: skitters in swarms, mound worms, horn lizards, crucible carts; three centipedes whole at the end;
150, par 4:10; Brass tooth.

## The Back Rooms (the Signal Market, `src/fight-temples/bazaar.js`)

The market's shuttered shops after hours, at dusk: stacked crates for pillars (`pillar: 'crate'`), the shops' neon on
poles and awnings over the far walls (`dress: 'market'`), signs dark on the rooms' walls until they toll. Rooms: the
shuttered row, the sign-painter's (two signs), the stockroom (a little maze of crates, two signs), the counting house
(four signs, two rings at a time). Foes: horn lizards, antler hounds, moths, marionettes; the bell walker itself and a
whole marionette at the end; 123, par 4:10; Signal neon. The ring is rolled through, not run from.

## The Flooded Gallery (the Underwater City, `src/fight-temples/underwater.js`)

Sealed halls under the glass: pale walls, the domes' white ribs, kelp and rising bubbles round them (`dress: 'deep'`),
the lamps on their posts. Rooms: the airlock, the fish market (stalls for pillars, four lamps), the long gallery (three
lamps down a narrow hall), the whale-watch (five lamps, one on the altar). Foes: glass crabs, lantern jellies, sky rays; a
lamp tripod and a whole crab at the end; 110, par 4:10; Pearl and tide. Its doorway in the Dock hall's air, east of its
middle (its height given), Sabine by it. The fight is fought from the lamps, the crowd drawn into their light.

## The Kiln Yard (the Glass Dunes, `src/fight-temples/glassdunes.js`)

The glassworkers' cooling sheds, floored in glass tiles over the kilns (drawn as a 2 m grid), kiln chimneys for pillars
(`pillar: 'chimney'`), chimneys and glass shards in the dunes round them (`dress: 'kiln'`). Rooms: the packing shed, the
cooling shed (four chimneys), the annealing floor (open, two tiles at a time), the great kiln (two, more often). Foes:
glass crabs, mantas, mound worms, a furnace walker or two made light; two clock-house drones and a whole walker at the
end; 110, par 4:10; Furnace glass. Its doorway at the west end of the north camp's awnings, Ozren by it.

## The Quiet Orchard (the Garden of Spheres, `src/fight-temples/spheres.js`)

The spheres' walled gardens at dusk: white walls, a grass floor, trees for pillars (`pillar: 'tree'`), rows of trees and
spheres on their stands beyond the walls (`dress: 'orchard'`). Rooms: the gatehouse, the orchard (six trees), the lawn
(open, the shade along it), the round garden (the shade from any side). Foes: antler hounds most of all, pearl rollers,
centipedes and shades made light; the glass marionette and two whole hounds at the end; 112, par 4:10; Orchard dusk.
Its doorway west of the round plaza, outside its hedge, Wenna by it. Keep to the light, ahead of the shade or behind it.

## The Oil Exchange (the City Floating in Space, `src/fight-temples/spacecity.js`)

The islands' lamp-oil depot on its rock over the dark (`outside: 'cliff'`, the rock under it, cables and lamps off its
edge: `dress: 'islands'`), oil drums stacked for pillars (`pillar: 'drum'`). Rooms: the weigh house, the drum yard, the
cable deck (its door off to one side), the clearing house (two pools at a time, more often). Foes: ring drones, signal moths,
pearl rollers; a lamp tripod and two whole drones at the end; 121, par 4:10; Lamp oil. Its doorway on the Towers' deck,
in its far corner from the bridges, Osric by it. The flyers are over the fire: the rollers are the ones to burn.

## The other worlds (one line each)

| world | fight temple | its foes | its colours |
|---|---|---|---|
| Vael | **The Wind Cloister** (built, v1.80, above): a roofless monastery court on a cliff, its gates the riders' old stalls; gusts through the arches shove the crowd | sky rays, herons, blots; a crab of the sky stones at the end | Rider's slate (blue-grey brass, white water) |
| Lorn | **The Drowned Mill** (built, v1.80, above): four flooded rooms of a reed-cutters' mill, the water ankle-deep, the toads lobbing from the millstones | bellows toads, root knots, skitters; a shade at the end | Reed and rust |
| Viridel | **The Seed Vault** (built, v1.81, above): the white builders' greenhouse cellars, beds of sleeping eyes that wake the moths | signal moths, root knots, a furnace brute at the end | Leafglass |
| the Underwater City | **The Flooded Gallery** (built, v1.81, above): sealed halls under the glass, the lamps flickering as the jellies ward the crabs | crabs, lantern jellies, sky rays; a lamp tripod at the end | Pearl and tide |
| the City-Shaft | **The Lift Depot** (built, v1.81, above): a stack of cab bays, each room a platform the cranes lower the next wave onto | lamp tripods, horn lizards, toads; two shades at the end | Cab yellow |
| the Glass Dunes | **The Kiln Yard** (built, v1.81, above): the glassworkers' cooling sheds, the floor glass that cracks under a brute | furnace brutes, glass crabs, worms; a drone pair at the end | Furnace glass |
| the Buried Machine | **The Tooth Gallery** (built, v1.81, above): a gear-house between the canyon's teeth, rails across it the carts run on | mound worms, crucible carts, centipedes, skitters | Brass tooth |
| the Moon Foundry | **The Pour Floor** (built, v1.80, above): the casting bays, a pour every minute across one room's floor (step off the channels) | crucible carts, skitters, lizards; a brute at the end | Moon slag |
| the Garden of Spheres | **The Quiet Orchard** (built, v1.81, above): the spheres' walled gardens at dusk, the hounds running in the trees' long shadows | rollers, centipedes, antler hounds; a marionette at the end | Orchard dusk |
| the City Floating in Space | **The Oil Exchange** (built, v1.81, above): the islands' lamp-oil depot, its rooms joined by short bridges over the dark | ring drones, moths, rollers; a lamp tripod at the end | Lamp oil |
| the Signal Market | **The Back Rooms** (built, v1.81, above): the market's shuttered shops after hours, a bell walker tolling in the last | lizards, hounds, marionettes; a bell walker at the end | Signal neon |


**All twelve built** (v1.82): every route world has its fight temple; the hazards' kinds are the template's for any world added later.
