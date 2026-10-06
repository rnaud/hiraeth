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

Left for later: the Buried Machine's pipes and tanks; drawn trims on buildings in the cities; taxi roofs (a
car is a disc only in the middle); the temple rotunda's top lip; the petal station's glass cage, whose thin
bars collide as drawn so the audit sees collision with nothing drawn where a bar is.

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
- **The taxis** (`src/taxi.js`): a round-bellied cab in its colour with a checker band, a
  bubble of ribs over a driver in a peaked cap who looks about, a striped awning over the
  passenger bench (you ride there; the passenger gets out), V-fins that trim into turns,
  wing-tip lamps and a "for hire" sign (lit while free, blinking while it waits, dark while
  you ride), hover rings underneath. Geometry is built once per colour and shared; beyond
  ~75–95 m only the body and its glow are drawn (3 calls), beyond ~135–170 m just the body
  (2). The roof you can stand on is the awning's crest (`solid.top`). Wren's cab loses its
  driver once she has stepped out by the lamp (`driverOut`).
  **People aboard are people-sized** in a cab of any size: the driver and the passenger are
  scaled by `FIGURE_H / scale` (0.9 m seat to crown, the traveller's own), the passenger's
  hips on the bench where yours go. A passenger (`fare`) rides only in traffic: a cab that
  comes when you call (`hail`, or Wren's flying to the lamp) arrives empty, a free cab answers
  before a nearer one with a fare, and a cab back in its lane takes a new fare only out of
  sight; the "for hire" lamps are dark while a fare is aboard. Wren's cab never carries anyone
  (`fares: false`). The bazaar's cabs are the City-Shaft's size (2: at 1 the awning came down to
  the traveller's chin). `tests/taxi.test.js`.
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
