# Movement, mounts, vehicles, hazards and health

Collision, the mounts and vehicles, gliding, footprints, the feel of the jump and stamina, fire and spines, falls and health.

## Collision

`src/physics.js` bakes every static mesh of the level into one world-space
geometry with a [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)
BVH. Moving things, plants and the desert heightfield are flagged
`userData.noCollide`; the heightfield keeps its own exact lookup.
- **Characters:**
  - a downward ground ray lets you step onto anything lower than 0.6 m and
    stand on rocks, mesa tops, roofs and domes;
  - a capsule from step height to the head is pushed out of walls and
    ceilings, and you slide along walls.
- **Bike and taxis** use the same rays and capsules.
- **Camera:** a line-of-sight ray pulls it in front of walls, so it never
  clips inside buildings.

## Contact: what you stand on and climb is what is drawn (October 2026)

The author's feedback: feet sank into the riding discs and ledges of Vael II's Founders' Belfry, and the
traveller climbed half inside some of Vael's rocks. Four causes, four fixes:

- **The feet looked through moving floors.** The body stands on `level.dynamic()` solids (a temple's riding
  disc, a pressure plate, a taxi's roof: `Player.moveStep`), but the feet (`feet.js plantFeet`) asked the
  baked collision, which leaves out everything that moves: they found the floor under the disc, the hips came
  down and the legs reached through it (~0.3 m). `src/carriers.js` `standGround(physics, solids)` answers the
  feet's two questions (`heightAbove`, `groundNormal`) with the solids' tops counted, and a held foot moves
  with what carries it (`plantFeet(..., { carry })`).
- **A disc's rise read as a stair.** At 2 m/s a riding disc lifts the root 3.3 cm a frame, over `StepLag`'s
  3 cm step threshold: the drawn body lagged ~15 cm under the root as it rose (and floated over it going
  down). `StepLag.update(..., carried)` takes out what a carrier moved; `Player._ridden` is that motion.
- **Drawn-only trims over floors.** The Belfry's stair ledges carried a 0.3 m trim drawn 0.2 m over the
  collision; the discs' rim band stood 0.14 m proud of their top; a pressure plate's disc stood 0.17 m over
  the floor. The ledges' trims collide now, the rim band is flush, a plate is a moving solid whose top follows
  its disc. The temple kit's wall caps, door frames, stair kerbs and columns (its own lathe) collide as drawn.
- **Coarse stand-ins inside drawn rock.** Vael II's rock collided as a coarse copy (a table's every other ring
  at 18 sides, a needle's hexagon, a boulder's bare icosahedron, an unlumped mound): up to 2 m inside the drawn
  surface. It collides as drawn now (`src/levels/arzach2.js` `add`), ~390 k triangles (from ~57 k; Incal has
  ~920 k; the BVH builds in a worker: ~+150 ms on the desktop load). The same for the Deep Wood's trunks, caps
  and arches (~130 k), the Garden of Spheres' spheres and umbrella trees (~157 k: the giant sphere's 20-sided
  stand-in lay 4.9 m under its drawn top), the desert's umbrella grove, and the temple towers' lathes (the
  Belfry's, the Buried Machine's, the Deep Wood's). Vael (the first) already collided as drawn.

**The contact audit** (`src/contact-audit.js`; `await contactAudit()` in the running game prints the world's
report) samples the collision by area: on walkable faces a ray down from 1 m above meets the collision and the
drawn surfaces (*feet sink*: drawn above, *feet hover*: drawn below, *unseen floor*: nothing drawn); on faces you
can grab (within ~20° of vertical, above step height), a ray in from 0.75 m out along the face (*climbs inside*:
drawn in front, or the climber's side itself inside drawn rock; *climbs off*: drawn behind); each moving solid's
drawn top over its disc (`solid.flat`: to its rim). Drawn means visible, opaque meshes where they are now, not
walk-through scatter, flora, water, things that float on purpose, shadow casters or the heightfield's mesh.
`tests/contact-audit.test.js` runs it on made-up scenes and on every world: Vael and Vael II must be clean
(the rock as drawn), every disc and plate flush, and no world may grow past its known count (the list and what
is left are in the test). The real traveller (`tests/gait-sim.js`) rides a rising disc with his soles at rest
height over its top, and on Vael II's rock lands with his feet on the drawn surface.

**The desert, made exact (October 2026).** The Givers' Hearth butte and the lip of rock round its foot, the
Givers' House's drum, its fins' caps and the sunken leviathan, the crashed hull and its salvage camp, the
fallen giant and the petal station all collided as coarse stand-ins up to 3.7 m inside what is drawn; they
collide as drawn now. Three bugs came out with them:
- **A proxy moved twice.** `Kit.both(mat, geo)` in `src/desert-hearth.js` and `src/desert-city.js` took its
  copy of the geometry *after* `add()`, which transforms a non-indexed geometry in place: every proxy with no
  explicit stand-in (the Hearth's chimney, the hall, the nine marked stones on the way) sat at twice the kit's
  origin, so the Hearth's hall had no collision where it is drawn. The copy is taken first now, as the other
  two kits already did.
- **An invisible floor over Qanat's well.** The dry well was drawn as a ring but collided as a closed
  cylinder, whose top cap capped its mouth 1.1 m over the terrace. It collides as the ring it is, its dry
  bottom solid.
- **A walker leaning on a wall for ever.** `NPC.move` pushed out of what it walked into and tried again from
  the same place; walking almost straight at a round kerb (Qanat's well, between the stairs and the gathering
  at the tree's foot) it never got round. It now walks along what it is pushed out of, on a side chosen once
  and kept until it is free.
The tree's roots over the terrace were drawn 1 m proud with no collision (feet sank 1.9 m into them); they are
solid and lie about 0.4 m proud, low enough to step over, so the terrace is still walked round.
Qanat's houses, domes and tower-houses and the cave of the giant's heart (its basin, its rough dome and the
ribs arching over it) collide as drawn too.
The cost: the desert's collision 194 k → 228 k triangles, its BVH 60 → 64 ms to bake on the desktop, ground
rays and capsule pushes unchanged. `node scripts/contact-report.mjs [world…]` prints the audit for every world
with its collision triangle count.

**Every world made exact (October 2026, the second pass).** The audit was answering only half the question:
its tops are sampled on the *collision*, so anything drawn with no collision of its own — a root over the
sand, a trim on a roof — was never sampled at all. It now samples the drawn walkable faces too and looks for
solid ground under each (**walks through**: a drawn top more than the tolerance over the ground within 1.2 m
of it; further than that it is a thing in the air, a cloud or a hanging city, not a floor). A moving solid's
own meshes are left out of the still surfaces, a guardian's model with them (`solidObjects` follows
`v.model.group`).

With that, every world's coarse stand-ins came out:

| world | feet sink | climbs inside | collision triangles | BVH |
|---|---|---|---|---|
| desert | 57 → 8 | 186 → 23 | 194 k → 238 k | 60 → 66 ms |
| Buried Machine | 270 → 69 | 833 → 49 | 51 k → 125 k | 24 → 31 ms |
| Garden of Spheres | 91 → 6 | 120 → 6 | 157 k → 181 k | 49 → 63 ms |
| Lorn | 61 → 13 | 35 → 7 | 40 k → 47 k | 15 → 10 ms |
| Deep Wood (Lorn II) | 97 → 8 | 5 → 1 | 130 k → 154 k | 38 → 33 ms |
| Signal Market | 7 → 4 | 86 → 2 | 9 k → 24 k | 6 → 8 ms |
| First Garage | 5 → 0 | 34 → 13 | 63 k → 75 k | 17 → 15 ms |
| Viridel | 18 → 3 | 31 → 7 | 75 k → 86 k | 29 → 19 ms |
| home | 23 → 0 | 15 → 3 | 20 k → 24 k | 11 → 7 ms |

Ground rays and capsule pushes are unchanged everywhere within noise. The temple kit's rotunda cornice, which
overhangs its wall by 0.4 m, is solid now, which cleans up every temple at once.

Left for later, with the reason (the third pass, below, settled all but the taxis and balls):
- ~~**The Buried Machine's great wheel**~~ collides as drawn and turns (moving colliders, below).
- ~~**The cross-walls' opening rims**~~ are solid, their passages kept clear of sand (below).
- ~~**Lorn II's bank roots and whip roots**~~ are solid as drawn (below).
- ~~**The Garden's olive and cypress trunks**~~ collide as drawn (below).
- ~~**Taxi roofs and the guardians' balls**~~ have their own shapes (below). The guardians themselves stay
  upright cylinders: they rear, lunge and swim, and nobody stands on one.
- ~~**The temple rotunda's oculus trim** and **the gates of Jaws**~~: the trim is solid over its ceiling, the
  jaws snap as moving colliders (below).
- ~~**The sand skirts**~~ collide where they are drawn over the ground (below).

### Moving colliders (October 2026, the third pass)

The rule for what collides: **exact where the player can touch it, light approximations elsewhere, and never
a big cost to every collision query.** The Buried Machine's great wheel turns for ever once the story turns it,
and its spokes are seven to its forty teeth, so no still shape is right at every angle; it collided as a still
disc of its rim (feet stood on air over the spokes' gaps and sank into the teeth). It is a **moving collider**
now: `physics.addMover(object)` takes the meshes under `object` as drawn, in the object's own frame, into their
own BVH (the wheel: its gear, trims, rivets and boss, ~8 k triangles), and every query meets them where the
object stood at the last `physics.syncMovers(dt)` (main.js, once a frame before anyone moves): a ray is turned
into the mover's frame and its hit back; a capsule's shapecast gets the mover's boxes and triangles turned into
the world's. A query nowhere near it pays one box test, as for any added collider. `moverVelocity(e, p)` is how
fast its surface moves at p (what moved it since the last sync, over dt), and `src/carriers.js`
`moverCarrier` makes that a carrier: standing on it (`physics.groundMover`, set by `groundAt`) or climbing it
(`rayHit(...).mover`) carries you as a riding disc does, the feet and the step lag with you. The audit samples
a mover where it stands. The Buried Machine: 69 → 37 feet sink, 102 → 11 climbs off, 18 → 0 unseen floor;
ground rays and capsule pushes unchanged (`tests/buried.test.js`, `tests/mover.test.js`).

**The cross-walls' openings.** The heavy rims round the two cross-walls' oval openings were drawn-only: solid,
`SandDrifts` footprinted their foot and banked sand across the way through. They are solid now and the drifts'
mask is 0 on the way through each opening (`passageMask` in `src/levels/buried.js`: a strip as wide as the
opening at the floor, from 11 m before the wall to 11 m past it, feathered over 2 m); the wall's own drift had
crossed it too (up to 0.57 m), and is gone there as well, while it still banks against the wall either side.
Climbs inside 50 → 36 (`tests/buried.test.js` walks the traveller through both).

**Lorn II's roots.** The 26 bank roots, the whip roots twisting round the arches and the arches' splayed feet
were walk-through, because solid the bank roots had measured as doubling every query. They collide as drawn in
the main BVH now (154 → 172 k triangles; walks through 21 → 5; `tests/perdide2.test.js` checks every drawn
root top has collision under it). The doubling did not reproduce. Measured before and after in one process,
interleaved, the fastest of 9–15 runs (on a busy machine a single run swings two or three times over, which
`COST=1 node scripts/contact-report.mjs` now allows for, fastest of `REPS`): the bake +4–11 ms, ground rays and
capsule pushes round the spawn unchanged, along the path rays +5–18 % and capsules +11–15 %. Lighter stand-ins
were weighed and would cost more, not less: the roots line the whole path, so a BVH of their own would be a
second traversal for every query there, and capsule chains a test per capsule. Capsule pushes now skip an added
collider (a door, the wheel) whose box is nowhere near the capsule (`shapecast`'s `bounds`).

**The smaller ones.**
- *The Garden's olives and cypresses* stood on stand-ins: an upright 0.4 m post 3 m tall for an olive's leaning
  trunk (out of the drawn bark at the top, turned the other way from the drawn boughs), a 0.9 m post 6 m tall
  inside a cypress's 14 m flame, so you walked half a metre into the foliage and the climber hung inside it.
  Both collide as drawn now (`instanced(..., { solid: true })` in `src/levels/spheres.js`): the olive's trunk
  and its two boughs, leaning and turned as each instance is; its crown stays walk-through; the whole cypress,
  a dense flame. ~181 k → ~201 k triangles, the bake +4 ms, queries unchanged; climbs off 234 → ~10.
  Climbed up an olive's trunk you came out inside its crown. The crown (~640 faces of leaf masses a tree, 155 k
  for the 243) stays walk-through, with a 20-faced blob of its core standing in for it inside the leaves
  (~5 k triangles in all; `userData.standIn`: the audit counts the crown as drawn over it, so the metre of leaves
  round the blob shows as feet sink and climbs inside). A climb stops under a ceiling over the head
  (`updateClimb`), and a mantle needs room to stand that is not inside a closed solid (`tryMantle`: neither met
  from within, `rayHit(...).front`, nor with the way up leaving through a solid's back), so you stop under the
  crown or climb its leaves and stand on top (`tests/spheres.test.js`).
- *The gates of Jaws* (Lorn's Hush-House) were a box the size of the doorway, the two round halves up to 0.75 m
  inside it. While shut each half is a moving collider (`addMover(half, { all: true })`: the pieces flag their
  meshes noCollide to stay out of the bake) that snaps with the drawn half, and a thin still slot down the
  middle (inside the lips when they meet) keeps the way when they gape; the bite (a hazard) is unchanged. Open
  (stilled) they are walk-through, as before: laid back against the jambs they would narrow the way and stand
  over the next room's mark.
- *The rotunda's oculus trim* was drawn-only, because solid it caught what is dropped or flown up through the
  oculus. It is solid where it lies on the ceiling now, and its 0.3 m lip over the opening stays drawn-only, so
  the oculus is exactly as open to the collision as the ceiling's own hole (the one place the audit still sees:
  0.3 m, on purpose).
- *The sand skirts.* Each skirt point is on the ground's height (ground + field + lift), but a triangle is flat
  between its points and the height is not: where the ground bends (the canyon floor turning up into its walls),
  across a fillet's curve, over the crease where two drifts meet, the drawn sand stood up to a metre over where
  the feet stood (between the points, not at them: 29 711 of the desert's 29 811 *vertices* agreed within 6 cm,
  which is why it looked like a hundred stray points). `SandDrifts.raise` now gives the skirts a hidden collision
  mesh of just those triangles (`misfits`: any of seven points on it more than 6 cm over the height, and not
  inside a smaller footprint, where it is inside a solid): desert ~7 k of its 70 k skirt triangles, Vael ~9 k of
  101 k, the Buried Machine ~45 k of 176 k (the canyon). The cost: the bake +15 ms in the Buried Machine, queries
  unchanged within noise. Sand-skirt *walks through* 46 → 6 in the desert and 80 → 28 on Vael, the Buried
  Machine's feet sink 34 → 16.
- *Climbs over banked sand.* Sand banks highest right at a wall's face, and the climber hangs 0.27 m out (0.48 m
  without the animator), where the bank is lower: his knees and hands went into the drawn sand, and climbing down
  he stood under it. `Player.climbFloor` is the ground just off the face when it stands over his feet by no more
  than a step (not a sill passed on the way): he takes hold standing on it (`startClimb`), never hangs below it
  (`updateClimb`), and climbing down onto it he stands (`tests/sand-drifts.test.js`). The audit still counts these
  walls as *climbs inside* (it compares surfaces, not the climber).
- *Long curved footprints.* A footprint was each part's convex hull, and the Buried Machine's canyon walls are one
  solid each, so their hulls reached right across the canyon and sand banked in straight lines across its floor
  (along the hulls' chords). `footprintsOf` now cuts a part whose hull spans open ground (`footPieces`: an outline
  more than `DRIFT.gap` 3 m from every edge of the foot) in two across its long axis, the halves overlapping by
  1.5 m, and each half again, until each piece's hull follows the foot. The pieces of one part are siblings: outside
  a piece but inside a sibling is inside the solid (no sand), and inside a piece the band under the wall runs along
  its faces only (`faceEdges`), not along a seam, so the seams raise nothing inside the walls (checked in the game
  and in `tests/sand-drifts.test.js` on a bent wall). The canyon floor's sand over 10 cm 133 → 40 of 3 502 samples
  (what is left banks against the machinery standing on the floor); the desert's largest footprint 167 → 49 m
  round, skirts +17 k drawn triangles there (70 → 87 k), the Buried Machine's +13 k, Vael's +8 k.

**Shaped moving solids.** A moving solid was a disc: `{ pos, r, top, bottom }`, its top level out to `r`. A cab's
top was its canopy's crest all round (you stood 1.4 m over its nose) and a rolling ball's its crown (on air at its
sides). A solid may now say its own shape: `topAt(x, z)` (its top there, or -Infinity off it) and `pushOut(p, r)`
(a character beside it moved out of it), with `r` the radius it all fits in; `src/carriers.js` `solidTop` reads
either kind for the feet, `Player.moveStep` for the body, the audit over a grid across it.
- *A cab* (`src/taxi.js`): its top is the drawn cab's own, a grid of rays straight down the built model taken once
  (`cabTop`: hull, canopy, sign, windscreen, fins and wings; not the lamps, the seat or a passenger), read in the
  cab's frame as it is posed and found again along the vertical when it banks; beside it you are pushed out of an
  ellipse round its hull, not a cylinder 1.45 of its lengths round. The seated rider is the vehicle's own and is
  never pushed. The City-Shaft's 85 cabs: carrier mismatches 660 of ~1 400 samples → ~200 of ~6 900 (what is left
  is the canopy's and the hull's edges, within a grid cell).
- *A rolling ball* (`src/temples/pieces.js`): a dome 3 cm over the stone (its glowing bands), out to 0.92 of its
  radius (past that too steep to stand on); beside it, out round it below its crest.
(`tests/shaped-solids.test.js`.)

**What the collision costs a frame (October 2026).** Every query on the world's `Physics` in the running game
(the traveller's, the camera's, the people's and the creatures', all on the same instance), timed per frame while
the traveller walks from the spawn for 12 s, Chrome's CPU throttled ×4, the Handheld preset; the day's tree
(before the third pass and the References scenes) against today's, served side by side and interleaved, two runs
each (ms a frame, mean):

| world | collision triangles | before | after |
|---|---|---|---|
| Garden of Spheres | 181 k → 227 k | 0.21–0.24 | 0.25 |
| Lorn II | 154 k → 191 k | 0.23–0.26 | 0.37–0.50, then 0.25–0.32 split by area |
| Buried Machine | 125 k → 176 k (+8 k turning) | 0.40 | 0.21–0.26 |
| desert | 238 k → 251 k | 0.34 | 0.23–0.25 |
| City-Shaft | 931 k → 935 k | 1.10 | 0.79–1.31 |

Only Lorn II got measurably slower: its roots and the arches' strands are long thin tubes along the whole path,
and a BVH split at the middle of each node's box lets their boxes overlap. It now builds split by area (SAH,
`level.collision = { strategy: 'SAH' }`, `Physics.create(..., o)`), which queries them as fast as before them
(20 k capsule pushes along the path 215 → 75 ms in node) for about 0.25 s more to build, in the worker while
loading. Other worlds keep the quick build. The measuring script lives outside the repo; it wraps each query
method (outermost call only) and reads per-frame sums.

## Mounts come to you

- **Hoverbike:** whistle (E) and it drives over on autopilot. If it's
  further than 220 m away, it first comes in from 140 m off to the side of
  the view. It brakes into a spot beside you.
- **Bird:** whistle in the air (falling, gliding, jumping off something
  high) and it swoops in from behind and below, faster than you fall,
  catches you and flies on. On the ground it lands beside you as before.

## Footprints

Footprints are boot-sole decals that multiply the G-buffer albedo
underneath. A print is a darker shade of whatever it's on (sand, moss,
stone, tiles) and fades back in. It doesn't touch normals or depth, so it
isn't outlined.

The prints are one instanced mesh, rewritten every frame (`userData.dynamic`, dynamic usage) and
never frustum-culled. Until v0.73 `fitBounds` gave it fixed bounds round its empty pool at load, a
1 m sphere at the origin, so the prints vanished whenever the camera turned that spot out of view
(`tests/footprints.test.js`). The footstep sound comes from the same step and never stopped.

## Paraglider

The canopy is in fixed cells: cream, salmon towards the tips and one blue
cell in the middle. Nothing scrolls or pulses as you fly. It folds away
when you mount.

## Hazards: fire and spines (v0.39)

`src/hazards.js` keeps the things that hurt while you touch them: volumes with a
kind and a damage rate (share of the health bar a second). `updateHazards` (main.js,
once a frame) takes that rate from the traveller in small bites through
`player.hurt`, says what it is the first time ("It burns!"), and spines push you
back out. The burning tree registers its flame's volume (`flameHazard`, from just
over the fork to the tip); flora species with `hurts: 'spikes'` (the desert's sand
candelabra, the Hangar's bolt cactus) register a cylinder round each plant.

## Health and falls (v0.39)

The traveller has a health bar (`player.health`, 0..1). Landings are judged by
their speed into the ground (a drop of h m lands at about √(64 h) m/s); riding,
gliding and the jets land softly enough not to count. Up to `FALL.tumble`
(32 m/s, about 16 m; it was 26 m/s, 10 m, until October 2026) a landing costs nothing. Harder ones knock you over
(`player.knockDown`): the body goes limp into a ragdoll tumble, lies a moment
and gets up, and `fallDamage(speed)` takes a little of the bar (at most
`FALL.worst`, and a fall that isn't fatal never takes the last of it). Only
`FALL.lethal` (48 m/s, about 36 m) or more is fatal. `player.hurt(k, why)` is
the way in for every other hurt (`opts.onHurt`; the desert's fire and spines
take small bites); whatever empties the bar knocks you out (`opts.onKnockout`):
you go limp and stay down (`player.dead`), the screen dims and a small panel
asks to **Restart** (`#restart`, main.js; Enter / Space / E, A / × on a pad,
a click or a tap), which puts you back where you last stood safely, whole again
(`player.restart()`, `opts.onRestart`). After `FALL.wait` s without a hurt the
bar refills (not while knocked out). The bar (`#health`, top left) only shows
while you are hurt or down. While down you have no control, the fluid tool is
put away and the camera follows the body on the ground, lower and softer
(`rig.down`). Physics tests that drop the player from great heights pass
`health: false` (no hurts, no knockdowns).

## Finding the hoverbike, and the vehicles redrawn
- **The hoverbike has to be found** (`src/story/desert-bike.js`): a new game starts on
  foot. Marrow the salvager hid the bike under a tarp in a hollow between the ship and the
  camps (`STORY.bike`; a broad dip, `HOLLOWS` in `src/desert-landmarks.js`), marked by a red
  rag on a pole. Until then `Hoverbike.rest()` lays it there dormant: no "ride" prompt, no
  whistle, no push from the tool, no physics. The errand `desert.bike` ("Something Faster
  Than Walking") starts with Rook near the ship, with Marrow ("Got anything faster than
  walking?"), or once Nour has sent you on; E pulls back the tarp, and with the backpack a
  second E wakes it (`wake()`): the tank swings into its cradle and you're riding.
  Flags: `desert.bike.uncovered`, `desert.bike.found` (for good, per save; a dev-menu box).
  Old saves (`migrateBike`, once): anyone who had the backpack could already ride, so they
  keep the bike; a save without the backpack never rode it and finds it like a new game.
- **Painted vehicles** (`src/vehicle-kit.js`): plain-coloured parts are merged into one
  vertex-coloured mesh per shading (`Paint`), so a vehicle of thirty parts is two draw
  calls; the ink pass outlines the colour boundaries. Moving and glowing parts are small
  meshes of their own. A builder returns `{ root, body, seatAnchor, socket, port, lights,
  jets, animate }`: `lights` are what the fluid lights (`Hoverbike.makePowerLights`), `jets`
  where the hover trails stream from, `animate(dt, vehicle)` the moving details.
- **The hoverbike** (`buildBike`): a long-nosed orange fuselage with a cream beak, teal jet
  fairings, a padded saddle, swept bars and a windscreen, a rudder that turns with the
  steering, a pennant that flutters faster with speed, a hover plate that glows. Seat, bars
  and socket are where they were (9 draw calls, was 17).
- **The skiff** (`buildSkiff`, Lorn): an open boat with a deck and a cream gunwale, its prow
  curled up with a swinging lantern, a teal float on outrigger arms, a striped lateen sail
  that fills with speed and trims into turns.
- **The cabs** (`src/taxi.js`) drive themselves: nobody sits up front. A round-bellied body in
  its colour with a checker band, open on top in the middle (`CABIN`): a cabin lined in cream,
  a cream dash with a small glowing screen (the cab's voice) and a low windscreen ahead of it,
  a striped canopy over it on four posts. A round sensor eye glows on the nose. V-fins that
  trim into turns, wing-tip lamps and a "for hire" sign (lit while free, blinking while it
  waits, dark while you ride), hover rings underneath. Geometry is built once per colour and
  shared; beyond ~75–95 m only the body and its glow are drawn (3 calls), beyond ~135–170 m
  just the body (2). The roof you can stand on is the canopy's crest (`solid.top`).
  **Seated, people-sized**: the seat (`SEAT`: a red cushion and back, a base down to the
  well's floor, a footrest half a metre under the cushion) is built in metres and drawn at
  `1 / scale`, so it fits you in a cab of any size; a passenger is `FIGURE_H / scale` (0.9 m
  seat to crown, the traveller's own) on the same cushion. You ride in it (`seatTransform`: your
  hips on the cushion), in a seated pose of your own (`Player.animateSeated`: upright against
  the back, thighs level, shins to the footrest, hands resting on the thighs, `RIDE_GRIPS.taxi`
  relaxed; he looks about and sways into the turns). A passenger (`fare`) rides only in traffic:
  a cab that comes when you call (`hail`, or Wren flying to its lamp) arrives empty, a free cab
  answers before a nearer one with a fare, and a cab back in its lane takes a new fare only out
  of sight. Wren never carries anyone (`fares: false`). The bazaar's cabs are the City-Shaft's
  size (2). `tests/taxi.test.js`, `tests/cab-ride.test.js`.
- **Riding a cab** (`src/taxi.js`, `src/story/cab.js`): getting in (E, B / ○) seats you and the
  cab waits (`aboard`); its dash asks where to, as a conversation (`dialogue.start`, the cab's
  voice: `CAB_VOICE`, the ship's chirp; words in `src/story/cab-lines.js`), so a stop is chosen
  like any answer: the mouse, 1–9 or the arrows and E / Enter, or the stick / d-pad and A / ×.
  The world's stops are `level.cabStops` (`{ id, name, at, heading, step, depths? }`: where it
  hovers, where you step out; `depths`, below the smog, only for Wren): the Signal Market's four
  (`CAB_STOPS`: the lantern market, the skybridge over the old sign, Signal Square, the cream
  balcony), the City-Shaft's five (`shaftCabStops`: the rim by the ship, the high terrace, the
  middle levels, the palace gate, the bottom terrace by the call-lamp). A stop chosen,
  `goTo(stop)` picks the first of its world's candidate paths that is clear all along
  (`planRoute`: five rays per leg, the centre, either side, above and below, `clearPath`), from
  where it is or, failing that, from 6 or 15 m higher (rising clear of a parapet first): the
  City-Shaft's go out to a ring of open air, up or down it and round it, at a few rings and
  heights (`shaftRoutes`); the market's fly up the avenue at the first clear cruising height
  (`cruiseRoutes([30, 48, 58, 12])`). No clear path: the cab says so and asks again. It flies
  the path itself (`route`: up to 38 m/s, braking for the stop, facing the way it goes, turning
  to the stop's heading as it comes in), still sweeping itself against the level; held up by
  something it did not see, it stops and asks again. There it says where you are (a toast) and
  waits: E / B / ○ steps you out onto the stop's own spot (`exitAt`: however high it hovers;
  not yet gone anywhere, back where you got in); SPACE / X / □ asks again, on the way too
  (another stop); A / × jumps off on the way, refused far up without wings or jets. RT and the
  stick do nothing: it drives itself. The ride camera watches from beside and a little above
  (`taxi.shot`, `CameraRig.follow`), where you see the traveller seated under the canopy; the
  cue says the keys again for each stop reached. `tests/cab-ride.test.js`.
  `tests/hoverbike-quest.test.js` covers the quest, the migration and the budgets.

## Feel: the jump by its phase, one stamina, the world's edge (October 2026)

From the author's notes (TODO.md, "Feel and look"). Tests: `tests/feel.test.js`.

- **The jump by its phase** (`src/jump.js`, `Animator.update`'s air branch, `Player.animateClips`).
  `jumpPhase({ airT, vy, h, jumped })` weighs five phases from the time in the air, the vertical
  speed and the height above the ground (`_groundH`, the ground ray of the last collision step):
  the **push** (a real jump, `_jumped`, for its first third of a second: the late part of
  `Jump_Start`, from just past the crouch into the tuck), **rising** and **the top** (|vy| under
  1.5 m/s: the tucked `Jump_Loop`), **falling** (arms rising and opening, the legs parting) and
  **reaching** (the time to the ground, `timeToGround(h, vy)`, under a third of a second: the
  first frame of `Jump_Land`, legs long and forward, so the landing clip carries on from it). The
  clips blend by those weights; `JumpLayer` eases them (no snaps) and lays a light procedural pose
  over them (arms, thighs, knees, chest, head: never the hands). On landing, a squash
  (`landSquash(speed)`: the body dips up to 17 cm, the planted feet bend the knees), shorter for a
  hop, longer after a drop, lighter at a run or when the landing clip already crouches. Nothing
  changes where you go: jump height, timing and air control are as before.
- **One stamina** (`src/stamina.js`, `player.stamina` 0..1). Sprinting on foot (L3 / Shift)
  spends `STAMINA.sprint` a second (about 12 s from full), climbing what it always did (fast
  climbing `STAMINA.climbFast` times more), the front crawl `SWIM.sprintCost`. It comes back on
  the ground once nothing has spent it for `STAMINA.delay` s, faster standing than walking, and
  afloat; never in the air or on the wall. Run dry, you are **winded** (`player.winded`): no
  sprint (a jog), no fast climb, no new hold on a wall until it is back to `STAMINA.recover`; on
  the wall it lets go, as before. The sprint is 8.2 m/s (7.2 before: +14 %).
- **The stamina wheel** (`#stamina` in index.html, `updateStamina` in main.js): a small inked ring
  beside the traveller's shoulders (projected each frame), paper and ink with an offset shadow,
  the arc green while it fills and red, pulsing, while winded. It shows only while the stamina
  isn't full (and a moment after), never while riding, talking or in a scene. The HUD's text
  gauges for climbing and stamina are gone.
- **The world's edge** (`src/edge.js`). Each world is held within ±`limit` m (`Player` opts, the
  level's `limit`); the old clamp left the velocity alone, so the traveller ran on the spot and
  stuttered. `keepInside` now takes the outward velocity away, so you stop or slide along the edge
  at your speed along it. `EdgePush` eases how hard the stick pushes into it (`player.edge.k`),
  the traveller turns to face it and leans into it with a forearm up (`EdgePush.pose`), the wind's
  ink wisps stream in from it (`WindStreaks.edgeGust`), a patch of slanted hatch strokes shimmers
  on the edge right in front of you (`EdgeInk`, drawn with the wisps' material, depth-tested
  against the G-buffer), and the first lean of a session shows a line (`EDGE_HINTS`, per world,
  or the level's own `edgeHint`).
