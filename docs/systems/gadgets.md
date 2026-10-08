# Gadgets

Zelda-like things the traveller carries besides the backpack's tool (v0.91): one in hand at a time, used
with its own button: ten of them, the grappling hook, the ink bombs, the boomerang, the magnet glove, the recall
hourglass, the ink bridge pen, the seeing lens, the spring boots, the bubble wand and the gust fan; more come one file each.
Try them all in the Gadget Yard (`?level=gadgetyard`, the Debug worlds list), where every gadget is yours.

## The framework (`src/gadgets/`)

- **`registry.js`**: `registerGadget(def)` checks a definition (`checkGadget`), keeps `GADGETS` in
  `order`, makes it an item (`ITEMS[id]`, kind `gadget`, owned as the flag `item.<id>`: `?items=`, the dev
  menu, `items.grant`) and gives the item its model (`registerItemModel` in `src/boxes/model.js`: the game
  menu's picture, the items page, a box it may come out of one day). `nextGadget` (the round, with
  "nothing in hand" as one stop) and `wheelSlot` (the stick on the wheel) are pure.
- **`all.js`**: every module of the folder whose default export is a definition, registered
  (`import.meta.glob`, Vite only). main.js and the items page import it first, so the gadgets are items
  before anything reads `ITEMS`. Nothing keeps a list: a new gadget is one new file.
- **`index.js`** (`Gadgets`, made in main.js after the foes): an instance of every gadget, the one in hand
  (the flag `gadget.equipped`; the first found is taken in hand), the buttons, the wheel, the aim's camera
  and pose, the chip. `control(dt, ctl, paused)` runs before the traveller moves (the hook's reel sets his
  velocity and his own collision carries him), `update(dt, paused)` after the fluid tool (an aiming gadget's
  over-the-shoulder camera and arm win). A menu, a scene or a conversation cancels whatever was under way.
- **`kit.js`**: what every gadget may use: `aimRay` (the camera's ray, from past the traveller),
  `traceAim` (targets, anchors with aim assist `assistPick`, the world with its heightfield),
  `throwVelocity`, `arcPoints`, `bounce`, `blastFalloff` / `blastDamage`, `blast(ctx, center, o)`
  (foes cut and thrown, loose things thrown, cracked walls broken, the fluid tool's targets pushed, the
  traveller thrown but never hurt, a hit-stop and a camera kick: src/feel.js), `InkLine` (a pen line that
  keeps a least width, src/thin.js) and `InkBursts` (a blast's look: an ink core, a cream cloud, a star of
  ink on the ground, speed strokes, the fluid tool's ink drops; nothing transparent, each piece grows and
  shrinks away).
- **`world.js`** (`GadgetWorld`): the things gadgets play with, from `level.gadgetYard` (any level may
  give one): loose things (`Prop`: crates, metal crates; solid through `physics.addMover`, they fall,
  slide, bounce, are pushed by walking into them, and are fluid-tool targets of kind `prop`), cracked walls
  (their own collider, taken away when a blast breaks them; `regrow` s later they stand again, Infinity:
  gone; `flag`: kept in the save), anchors (rings the hook finds), floor plates (pressed by the traveller or
  a crate; `things`: only by a thing of `mass` or more) and the gates they lower, ropes (`ropes`: a crate
  hung from `top`, a target of kind `rope` that a cut drops; a load pulled off snaps it; they hang again
  after `regrow` s) and small pickups (`pickups`: a pot of the makers' ink, `amount` of ink when walked into,
  a target of kind `pickup` a gadget may carry to you). What moves or breaks must be flagged `noCollide` when the level builds
  it (the yard kit does), or the level's baked collision keeps a copy of it.
- **`hud.js`**: the chip in the lower left (the gadget's own picture, drawn once by `src/item-icons.js`,
  its name, its count, the button), the reticle, numbered lock marks (`marks`), the wheel, and on a touch screen the ◆ use button.
- **`sfx.js`**: the sounds, from the game's synth (`Sound.sweep` / `burst`).

## The buttons

| | pad (by position) | keyboard / mouse | touch |
|---|---|---|---|
| use (press, hold, let go) | Y / △ (`PadGadget`) | T, the middle mouse button | ◆ |
| next gadget (a tap) | D-pad ↑ (`PadGadgetPick`) | B (Shift + B: the one before) | tap the chip |
| the wheel (held 0.32 s) | D-pad ↑ held, the left stick points | B held, W A S D point | |

With nothing in hand the use button sounds the bell-note whistle and plays the echo shell back, once found
(`ring`, the V key's job: src/boxes/effects.js), and the chip shows the whistle; the wheel's first slot says
so. B only chooses gadgets: it is not a guard key (v0.93, docs/systems/controls.md "The layout"). The game menu's Items panel takes a gadget in hand
too (`onUse`).

## Played together

One runtime holds all ten, so what one leaves behind is everyone's problem:
- **Taken out of hand** (`unequip`) and **paused** (`control(…, paused)`: a menu, a conversation, a scene, the
  ship, a game: main.js passes `!!minigame` too, so a game's buttons never throw a bomb) every instance
  `cancel()`s; `update(dt, paused)` then hides what it drew (the magnet's field and glove, the hourglass's
  trail, the bubble wand's reticle), the lens comes down and its composite step goes off, a bubble you
  float in pops (what a bubble carries waits in it). The runtime hides the reticle and the lock marks once
  when a pause starts. A gadget hides the shared reticle only if it showed it (`_ret` / `_shown`), so one
  gadget's aim is never wiped by another's update.
- **Held** things are tagged: a crate or a bomb `held` by one gadget (the hook, the magnet, a bubble, the
  hourglass's `'recall'`, a rope) is not taken by another, and weighs nothing on a floor plate.
- **Pictures**: the chip asks for the one in hand first (`drawIcon(id)`, `ItemIcons.pump(id)`), and while the
  wheel is open the others are drawn, one a frame. More than eight in the wheel: a wider ring of smaller slots.
- **Idle cost** (nothing in use, all ten owned, M-series Mac, µs a frame for `update` + `control`): the Gadget
  Yard on High 104 + 13, on Handheld 103 + 16 (the yard's fire and pinwheels and its props are most of it:
  the fan 27–34, the world 31–34); the Signal Market on High 49 + 14 (the hourglass's history of the nearest
  cabs the most, 12). The lens's step in the composite is off (`uLens.x` 0) while it is down.

## Adding a gadget

1. Write `src/gadgets/<id>.js`; its default export:
   ```js
   export default {
     id: 'magnet', name: 'Lodestone glove', glyph: '⊂', order: 30,   // order: its place in the wheel and the yard
     text: 'what it is', use: 'what it does (prompts in Xbox / PlayStation form: Y / △)',
     model: () => group,          // about 0.3 m, makeMaterial materials (inked by the post pass)
     create: (ctx) => instance,   // ctx: player, physics, camera, rig, tool, foes, wind, relics, flammables, post, boxes, world, fx, hud, bursts, sfx, sound, notice, aimAt, gadget(id)
     yard(kit) {},                // its props in its Gadget Yard bay
   };
   ```
   The instance may have `press()`, `hold(dt)`, `release()`, `control(dt, input)` (before the traveller
   moves), `update(dt)` (every frame, in hand or not), `aiming` (true: the camera comes over the
   shoulder; call `ctx.aimAt(point, dir)` each frame to turn the traveller), `hud()` (`{ count, max, note }`),
   `equip()`, `unequip()`, `cancel()`, `dispose()`.
2. Its bay: `yard(kit)` places things in the bay's own frame (about 14 m across, +z toward the middle of
   the yard, -z away, y up from the ground): `kit.block(size, centre)`, `steps`, `pole`, `anchor(p, {
   normal })`, `cracked(size, centre, { shape: 'boulder' })` (`{ lay: true }`: a cracked floor), `crate(centre, { metal })`, `plate(at)`,
   `gate(size, centre, { plates })`, `target(at)`, `lamp(at)`, `pen(centre, r, count)`, `flag(colour)` (a
   banner and the gadget's model large on a plinth), `rope(top, { length, metal })` (a crate hung on it),
   `pickup(at)` (a pot of ink), `lantern(at)` (unlit: an ember lights it, `level.flammables`),
   `ironBlock(size, centre)` (fixed metal, `tagMetal`). Ten bays stand round the ring (`YARD.bays`), in the
   registry's order.
3. A changelog line, a test in `tests/gadgets.test.js` (or a file of its own), a short section here.
   The registry test checks every module with a default export.

## The grappling hook (`hook.js`)

Hold the use button: the camera comes over the shoulder and the reticle sits on what the hook would catch
within `HOOK.range` (25 m from the glove; a red diamond on a ring, teal on something loose, dashed "out of
reach"). Anchors are found within `cone` 0.07 rad of the aim if nothing hides them; a light crate near the
line too. Let go to fire (a tap fires at once where the camera looks); the line is checked from the glove,
so what stands in the way is what it bites. The head flies at 75 m/s, then:
- **a surface or a ring**: the reel pulls the traveller at `HOOK.pull` (26 m/s, easing over the last metres,
  `reelVelocity`) to `reelTarget`: on a floor, on it; on a wall, `stand` out from it and `hang` below the
  hook. Arrived (or stuck, or after `maxPull`), he hauls over the top (`player.tryMantle`), else takes hold
  of the wall (`startClimb`), else is pushed off it. Jump while reeling lets go: `fling` of the reel's
  speed and a hop up. Pressing again lets go too.
- **something loose** (a light crate): dragged in at 15 m/s, a little off the ground, let go at your feet.
  A metal crate is too heavy: you are reeled to it.
- **a foe**: pulled in and stunned for a moment. Anything else alive (wildlife, people): a tug (the push's
  hit, toward you).

Since the reel only sets the velocity, his own sub-stepped collision carries him round corners and along
walls in every world, the jets end and the wings fold. Tests: `reelTarget`, `reelVelocity`, `inReach`,
the aim assist through a wall, a whole reel to a wall (mantle tried, then the climb), the fling, the miss,
dragging a crate and a foe.

## Ink bombs (`bomb.js`)

Hold the use button: a bomb in the glove, a dotted arc (`arcPoints` under `BOMB.gravity` 22 m/s², from
`throwVelocity`: the aim tipped up `lift` 0.3 rad at 15 m/s, plus half the traveller's own speed) to where
it would land, and a red ring there as wide as the blast. Let go to throw. It bounces (`restitution` 0.42),
rolls (kept on the ground, slowed by `roll`) and goes off `fuse` 2.2 s after the throw, at once when it
meets a foe; another bomb in the blast goes off `chain` 0.15 s after. The blast (`kit.blast`, radius 4.5 m,
`blastFalloff` (1 - x²)²): foes take the blade's cut (`blastDamage`, up to 3: an ink blot within two
metres is gone) and are thrown, crates are thrown up and away (a metal one a quarter as far), cracked walls
in reach break, the fluid tool's other targets are pushed, the traveller is thrown back but not hurt; a star
of ink is splashed on the ground (the fluid tool's splats). Three in the pouch (`refillPouch`: one back
every 5 s). A bomb that falls off the world (`lostBomb`: `lost.drop` 12 m under where it was thrown, falling,
nothing within `lost.below` 30 m under it, looked at every quarter second) is taken away without a blast.
Tests: the throw's angle and range against the maths, the bounce, the falloff, the pouch, a
blast on a foe, a crate, a cracked wall (solid, then not) and the traveller, a bomb thrown, bouncing and
chaining.

## The recall hourglass (`recall.js`, `history.js`)

Point at something that moved in the last few seconds: its path shows as a dotted ink trail with its ghost
drawn in outline every `ghostEvery` 0.45 s of it (`outlineGeometry` round the thing's own box,
`localBox`), and the reticle says how many seconds of it there are. Press the use button and it goes back
along that path at the pace it went (`Rewind`), a gold ring turning round it and a teal line from the hand;
press again to stop it there (started with the button held, letting go stops it too). With nothing under
the aim, holding the button aims over the shoulder; letting go on something starts it. At the oldest end
(or stopped) it is let go where it is, still, and its path is forgotten (it is recorded anew from there).

- **The history** (`MotionHistory`, pure): a ring buffer per thing (`Track`: x, y, z, yaw, time), sampled
  `HISTORY.rate` 20 times a second and only when it moved `eps` since its last sample, kept `window` 8 s;
  a thing is followed only once it moves, forgotten once still for the window or gone, at most `cap` 24
  at once (a track still for longest gives its place up, never one that moved in the last second: traffic
  doesn't churn it). A track being rewound is frozen.
- **What can be rewound** (adapters: `{ key, pos, radius, object, yaw(), moving(), alive(), can(),
  begin(), place(pos, yaw, vel), end() }`): the world's loose things (`propAdapter`: `prop.held =
  'recall'`, no gravity; a crate is a moving collider, so whoever stands on it rides it, up to its ledge),
  bombs in flight (`bombAdapter`: `b.held`, bomb.js skips it, its fuse waits), the nearest `cabs` 6 cabs
  of the City-Shaft's and the Signal Market's traffic (`taxiAdapter`, reach `cabReach` 70 m: mode
  `'recall'`, then parked, back to its lane by itself), and whatever a level lists in
  `level.recallables()` (moving platforms of its own).
- Its bay: a 6 m ledge with a crate at its lip (knock it down with the hook's ring beside it or a bomb,
  stand on it, send it back up), a 3 m one to learn on, a crate on the ground.

Tests (`tests/recall-bridge.test.js`): the ring buffer, what is followed and forgotten, the rewind's pace,
a crate knocked off a ledge sent back up onto it, stopping by a second press and by letting go, a bomb's
fuse held.

## The ink bridge pen (`bridge.js`, `src/wind-screens.js`)

Hold the use button: a dotted line runs out from the traveller's feet at `speed` 11 m/s toward the point
under the reticle (`steer`; along the aim when that is near or nothing), bending at most `turn` 1.8 rad/s,
never steeper than `climb` 28° up or `dive` 20° down (`penPitch`); the big pen rides its tip, dripping ink.
It ends where it runs into something (a kerb up to `over` 0.45 m is run through: you step over it), once
laid 0.4 m onto a ledge level with it, at `max` 16 m, or when the ink runs out. Let go: it sets into a
plank (`width` 1.5 m, `thick` 0.2 m, its top on the line), drawn in from the start in a third of a second,
hand-inked (`inkGeometry`: wobbling edges, two pen lines along its top, a joint every metre, hatching down
its sides). It stands `life` 12 s, pales and drips over the last `warn` 2.5 s, then wears away from both
ends at once over `fade` 2 s (`fadeOrder`: the segments laid middle first, so `drawRange` cuts both ends).
Aimed up past `wallAim` 0.6 rad as you start, it draws a wall instead: `wallH` 2.6 m tall, up to `wallMax`
7 m across, `wallAt` 3 m ahead on the ground, hatched in long diagonals and cross-hatched toward its foot.

- **Solid**: a box per segment (`colliderGeometry`) through `physics.addCollider`, rebuilt as it wears
  (the boxes of the segments left). A wall's collider is added `noClimb`: `physics.noClimbNear` tells
  `player.startClimb` to leave it alone (you slide along it; the hook reeling you to it does not hang you on it).
  A line ends on a ledge level with it only once it has left the ground it started on (`aloft`), so drawn on
  along a plank already standing, or along a floor, it runs on. The traveller walks and climbs on it, foes walk on it and are stopped
  by a wall (their step test is a ray), bombs bounce off it, the bike drives on it.
- **Against the wind**: a wall's segments are screens (`addScreen`); `screened(pos, dir)` says whether a
  body is behind one upwind within 6 m. A temple's gust (src/temples/pieces.js `Gust`) leaves you, and the
  machines (src/foes.js `templeKit`), alone behind one.
- **Ink**: `ink` 24 m in the pen (the chip's six pips), a wall costs `wallCost` 1.4 per metre, flowing back
  at `refill` 2.5 m/s from `refillDelay` 0.8 s after drawing; a line shorter than `min` 1.2 m is not kept
  and its ink comes back. At most `keep` 3 stand at once (a fourth sets the oldest wearing away).
- Its bay: a tower with steps, an 8 m gap to a second tower, a 2.5 m rise over 5.5 m to a third with a lamp
  (a ramp), and a gap in a low wall to close. In the City-Shaft it spans the gaps between the upper
  terraces (some 10 m over a 150 m drop).

Tests: the pitch cap, the turn, the refill, the fade order, the collider's boxes, a plank across a gap
(stood on mid-gap, worn from the ends, gone, the ink back), the 16 m limit, a ramp's slope, a tap kept
nothing, a dry pen, a wall that stops a ray and shelters from a gust, the screens' reach.

## The boomerang (`boomerang.js`)

Hold the use button: the boomerang is in the glove, a dotted path shows its flight (brass and ink out,
paper and ink home) and whatever the reticle passes over within `BOOM.range` (22 m; `cone` 0.06 rad or
`near` 0.9 m of the aim, in sight of the glove) is locked on to, up to `locks` 3, each a numbered red
diamond (`hud.marks`). Lockable: every registered target but people, creatures, mounts, taxis, crates and
scenery (`NO_LOCK`), and the world's relics. Let go to throw: the path (`boomPath`: from the hand, a swing
out to the side `bend` 0.24 of the distance, then each lock in turn; with none, out to where the aim meets
the world) is a centripetal Catmull-Rom (`boomCurve`), and `plan` swings it right, else left, else nearly
straight, whichever meets no wall before it ends. It flies it at `speed` 20 m/s, then homes on the hand
(`homeVelocity`: turned toward it at `turn` 5 rad/s, more the longer it is out) at `back` 24 m/s and is
caught within `catch` 1 m. On the way (`strike`, once each):
- **a foe**: stunned `stun` 1.6 s, knocked a little along its flight;
- **a rope**: cut (`blade`); **a pickup** or **a relic**: carried back on it (a relic is laid at your
  feet, where its own pickup takes it, `src/quest.js`); **a crate**: nudged; **people, creatures**: a tap;
- **anything else** (switches, the yard's targets, the temples' crystals and gauges, lanterns): what a glob
  would do (`modeFor`). Thrown with the fluid tool in an ember, stilling or bloom mode (`CARRY`) it carries
  that mode, its trail in the mode's tones: an ember boomerang lights the lanterns it touches, a stilling
  one stills the foes.

A wall on the way out turns it home with a clink (a glancing touch, or a lock's own solid, is passed);
coming home it glances off walls (4 at most, then it passes through). Its sounds are its own (`snd`). A lock needs a line of sight from the glove or the eye
(`inSight`: the world may be met only within `ownReach(radius)` of the thing's middle, its own cage), and a
mode carried spends a charge of the tank (`tool.reserve.use()`); with none left it flies plain.
Tests (`tests/boomerang.test.js`): the path through each lock, the homing's turn rate and return, the
segment's hits, a throw stunning a foe and flipping a switch, the locks (three at most, never a taxi,
nothing behind a wall), a wall turning it back, the ember lighting a lantern, a rope cut and its crate
falling, a pot and a relic fetched, the yard's bay.

## The magnet glove (`magnet.js`, `metal.js`)

Hold the use button: the field reaches for the metal under the aim within `MAG.range` (18 m): the one the
aim lands on, else the nearest the line (`pickMetal`, `cone` 0.08 rad), seen from the traveller's eyes or
the camera. A teal reticle on loose metal, a red diamond on fixed metal. Metal is:
- **loose**: a `Prop` with `metal` (the metal crates) and the makers' machines among the foes;
- **fixed**: anything tagged where it is built, `tagMetal(mesh)` (its middle) or `tagMetal(mesh, { points,
  radius })` (spots of its own, local to the mesh: a merged mesh of many pumps), or listed in
  `level.metal`; `metalSpots(scene, level)` finds them once. Tagged so far: the Gadget Yard's iron blocks
  (`kit.ironBlock`), and in the Sealed Hangar the brass pumps on the plateau's pipes, the signal board's
  iron face and the brass plate high on the great machine's column.

Held past `tap` 0.2 s on loose metal, it is lifted and held out along the aim (`holdPoint`: `dist` from the
glove, never under the ground below it, its own collider set aside) and follows it (`followVelocity`:
`follow` 9 /s, at most `maxSpeed` 18 m/s). The camera moves it (up lifts it); the left stick (W / S) brings it
in or sends it out (`reachAfter`, `min` 2.4 to `max` 14 m) while the traveller stands. A machine held is
lifted off its feet (`foe.alt`, drawn by src/foes.js) and stunned; swung fast (over `swing` 6 m/s) into
another foe, what is held knocks it down (the blade's cut). Let go: it drops; a machine dropped from over
`drop` 2.5 m is hurt by its fall. Caught behind a wall, or out of reach, it is let go. A **tap** throws
loose metal away (`shove` 13 m/s, up a little) and knocks a machine back, stunned. On **fixed** metal, a tap
or a hold pulls the traveller to it, as the hook's reel (`reelTarget`, `reelVelocity` at `pull` 18 m/s):
at a wall he hauls over the top or takes hold of it; jump lets go. The field is drawn by `FieldLines`:
five wavy strokes bowing round the line between glove and metal (ink, red, slate), in dashes that flow
toward the glove while it pulls (one instanced mesh of thin bars, a pen line wide at any distance); the
glove itself, horseshoe up, shows in the hand while it works. Its hum pulses while it holds.

The yard's magnet bay (grey banner) is a puzzle: a floor plate in a pit walled round (`plate({ things:
true, mass: 3 })`: you cannot press it, only metal can) opens the gate of an alcove with a pot of ink; the
metal crate that presses it is up on a sheer tower: lift it down, over the pit's wall and onto the plate.
Across 11 m from a ledge an iron block stands on a pillar: pull yourself over. The middle's plate and gate
take a metal crate too. Tests (`tests/magnet.test.js`): the hold point, following, the stick, the aim's
pick, tagging, a crate lifted, held level without climbing its own top, sent out and dropped, a tap
throwing a crate and a machine, a machine lifted, dropped and hurt, the pull across a gap, the field's
strokes, the bay (the plate only metal presses). The strokes are fine pen lines (1.6 cm, `thin` 1.8 px) and
`fieldWidth` thins them toward their ends and within 5 m of the eye, so by the glove, a hand from the
camera, they are lines and not bars.
## The seeing lens (`lens.js`, id `monocle`; hidden things: `hidden.js`)

Hold the use button and the traveller holds a monocle up (`LENS.rise`); let go and it comes down. While it
is up the composite (src/post.js, step 6, a uniform branch on `uLens.x`: nothing of it runs while it is
down) draws the view through it: inside a brass ring `LENS.radius` of the screen's height across the world
is blue ink on pale paper (its value mapped from deep blue to paper, the ink lines in deep blue, the far
world fading into the paper), what glows (the hidden things, lamps) keeps its own colour, and the view
outside the ring sinks into ink. Up to eight marks (`uLensMarks`: uv, kind, size; `lensMarks` projects
them, nearest first) shimmer as dashed rings round a diamond, through whatever stands between: gold for a
find (unopened boxes and relics within `LENS.far` 90 m, buried caches), red for a foe's weak point (foes
within 32 m; seen, a foe is `exposed` for `LENS.expose` s and a blade cut on it counts double,
src/foes.js), teal for writing not yet read. It clouds over: `LENS.drain` (1/16) of the chip's meter a
second up, a third of that while he stands on a ghost path, back at `refill` after `wait` s down; empty,
it comes down and needs `again` before it rises. The camera comes over the shoulder while it is up.

What the lens shows is tagged by the world while it builds (`hidden.js`: a registry the lens adopts for
its own scene; each tagged object is kept out of the baked collision and hidden):
- `revealable(object, { solidWhenSeen: true })`: a ghost path, drawn from `LENS.see` (0.35 of the raise)
  and solid from `LENS.solid` (0.5): a stand-in collider made once (`setSolid`), put into and taken out of
  `physics.extras` as the lens rises and falls. Lower it on a ghost bridge and you fall.
- `revealable(object, { illusion: true })`: a false floor, drawn while the lens is down, never solid, gone
  under it.
- `revealable(object, { message, id })`, or `hiddenWriting(parent, at, facing, text, o)`: words in block
  letters under the makers' mark (no W: the 3 × 5 font's W reads as an H); read once (a notice, the flag
  `lens.read.<id>`) when seen within `range` m, looked at, nothing in between.
- `buried(object, at, o)`: a cache under the sand, marked through the lens; a stomp of the spring boots
  within 2.4 m brings it up (`unearth`, `riseHeight`).
- builders: `ghostPath(parent, points, o)` (a plank at each point, turned along the way, ink posts at its
  corners; `material` for a false one that looks real), `ghostBridge(parent, a, b, { sag })`.

In the worlds: inside Qanat's main gate, words on the west pylon's inner face and a stair of glass climbing
over the avenue onto the lintel (src/desert-city.js); in the Buried Machine, two stone abutments with the
makers' mark face each other across the canyon between the cross-walls (`BRIDGE_Z`), a bridge of glass
between them and words on the west one (src/levels/buried.js). Lowered while you stand on a ghost path
(`standingOn`), it holds `LENS.grace` 1.5 s more, flickering faster as it goes, with a warning
(`ghostGrace`); up again in time, it stays, and the glass rises on any meter at all meanwhile. A ghost
bridge's planks just meet (a gap is one a step's ground ray falls through). Tests (tests/lens-springs.test.js): the
meter, the raise, what shows at which raise, the ghost bridge solid only while up (and the false floor
never), the slower drain on it, clouding over, reading once, the marks' projection, a foe exposed, the
composite off by default, the cache, the yard's bay, the worlds' secrets.

## Spring boots (`springs.js`)

Hold the use button on the ground: the traveller stands and winds them (`SPRING.wind` 0.85 s; the figure
squashes, the coils under his boots shorten, a ring of ink dashes round his feet fills and turns gold when
wound; the stick only aims the launch meanwhile). Let go: `launchVelocity` sends him up to `launchHeight`
(from `minH` 2.4 m for a tap to `fullH` 14.3 m wound; v = √(2 g h), g 32), or, with the stick pointed,
forward at up to `SPRING.fwd` 11 m/s on an arc `SPRING.arc` as high. In the air:
- a press under `BOUNCE.window` (0.42 s) from the ground (`timeToLand` from `_groundH` and his speed;
  `airPress`) arms a bounce: touching down he is launched again at a full wind, `BOUNCE.gain` higher a
  bounce, `BOUNCE.max` (3) in a chain (14 → 17 → 20 → 23 m);
- a press higher up (`STOMP.min` 1.6 m) stomps: a hang of `STOMP.hang` s, a drop at `STOMP.speed` 38 m/s,
  then within `STOMP.radius` 4.5 m foes are pushed and thrown back (stunned a moment), loose things thrown
  up, cracked walls and floors within `breakR` broken (`world.breakAt`), the buried brought up, a ring of
  dust, a hit-stop and a camera kick (the event `gadget:stomp`).

No landing on them hurts: while they carry him the fall guard is raised to `SPRING.guard` each frame
before he moves (the charms set `fallGuard` again every frame, src/boxes/effects.js) and given back on
landing (the figure's lift is taken back first where nothing placed it since: photo mode, a game moving him). The coils hang under his feet (from the foot bones; the figure is lifted by their length) and
wobble (`coilWobble`, a damped spring) on each launch and landing. Tests: the heights and velocities, the
bounce and stomp rules, a full launch's height and the guard given back, a chain of three bounces, a stomp
breaking a cracked floor, pushing a foe and unearthing a cache, the stick held while winding.
## The bubble wand (`bubble.js`)

Hold the use button to aim (the wand in hand, the reticle on what it would catch: "a foe", "a crate", "a
bomb", "yourself"); let go to blow. One bubble at a time: another press pops it. The bubble flies to what
the aim found (13 m/s; a foe, a crate or a bomb near the line is found with a wider assist, `BUBBLE.assist`
0.17 rad or 1.4 m, in sight of the wand), or out
along the aim (10 m/s, slowing, popping on the first wall it meets) and closes round the first thing it
touches. Carried, it rises at `BUBBLE.rise` 1.25 m/s, easing to a hover `maxRise` 7 m over where it caught
its load (`riseSpeed`), and drifts on at `drift` 0.7 m/s the way it was blown (a gust or the fluid's push
adds to it, then dies back into the drift). It pops after `life` 6 s:
- **a crate** (`Prop.held`: no gravity; its velocity is the bubble's, so the world's own collision slides it
  along a ledge's side): it falls where it is. The yard's lift puzzle: float a crate over the ledge and drop
  it on the floor plate up there, and the alcove's gate beside it sinks.
- **a foe**: helpless inside (stunned, still, turning slowly; its strike broken off); let go it falls, and
  from higher than `fall` 3.5 m it lands hard (one cut). A machine, and any heavy foe that is not metal (a glass golem, a salt crab, a slag walker), is too heavy: the bubble bursts on it, the note worded for what it burst on (`heavyWords`).
- **a bomb** (`b.held`, src/gadgets/bomb.js): carried up with its fuse sealed; popped, `fuse` 0.3 s are
  left. The yard's cracked boulder sits on a pillar too tall for a thrown bomb's blast.
- **the traveller** (aimed at his own feet, `wantsSelf`, or pressed in the air): he floats up at 1.5 m/s,
  his drift with the stick held under `self.drift` 2.6 m/s (`control` sets his velocity before he moves and
  gives back his gravity; walls slide by, never grabbed); after `self.life` 5.5 s it sinks at 1.3 m/s and pops
  when he touches down (`selfPhase`, `selfLift`). Jump pops it (the wings may open at once), and so does a
  hurt (a foe's strike).

Spikes and flames (`hazardAt`, src/hazards.js), a fire burning (a flammable spot lit by an ember glob, the
yard's ember fire), a blade or an ember or fluid glob pop it (the bubble is a target: `kind: 'bubble'`,
accepting `blade`, `fire` and `gust`). Its look: nothing is transparent here, so it is drawn as an ink
drawing turned to the camera: a thin ink rim (`thinRing`: at least 1.4 px), a band of six pastel arcs that
turns, three inner arcs turning the other way, a tilted white meridian, a highlight and a glint, the skin
wobbling; popped, a splash of pastel and white drops. Sounds: a breath, a plop, a bright pop with a spatter.
Tests (tests/bubble-fan.test.js): the rise and the phases, a crate caught, floated and dropped, a foe lifted
and landing hard, a machine refused, a bomb's sealed fuse, the traveller's float, drift, spikes and jump,
an empty bubble on a wall, a blade and a push on a carried one.

## The gust fan (`fan.js`)

Press the use button to swing it (held, it swings again every `FAN.cool` 0.42 s). A cone of wind
(`range` 9 m, `angle` 0.5 rad) leaves the fan along the aim, mostly along the ground on foot
(`gustDirection`, `flatten` 0.7), felt the less the further (`gustStrength`: 1 near, a third at its reach).
Everything in it (`targetsInCone`, not through walls) is pushed: crates slide (`push.prop` 10 m/s, a metal one
a quarter), foes take the fluid's push (`shove` 3.6 m: knocked back and reeling a moment; a blot swarm, one
hp, is blown apart), the bomb gadget's bombs roll, a bubble drifts on, a parked hoverbike or skiff is pushed
along its keel by how squarely the gust fills its sail (`sailPush`; the skiff's sail takes it best), anything
else feels the fluid's push (people, creatures, a temple's stone ball, a switch). A target that lists
`'gust'` in `accepts` gets the mode itself: the yard's pinwheels, its fire, the bubble, and every flammable
spot (src/flammable.js `douse`: a lamp an ember lit goes out, a flare or a burning bramble stops burning).
Over the ground it throws up sand and dust; over water (`player.water.surfaceAt`), spray and splash rings.
Riding a skiff, a swing is a gust into its own sail: `sail` 9 m/s more, up to `sailMax` 30. In the air
(`hover.gusts` 3 of them before you land) the gust goes down at the ground and lifts you: at least
`hover.glide` 7.5 m/s up with the wings open, `hover.air` 4.2 without (`hoverLift`); the chip shows the
gusts left as pips.

The gust's look (`GustLook`): ink speed lines racing out along the cone, ink curls rolling up at their ends,
two open rings of ink (the wind's fronts) racing out across it, and the sand's own wind wisps (src/wind.js
`WindStreaks.spawn`, the `wind` the runtime is given) skimming out along the ground and at the fan's height;
the fan in the hand snaps open and sweeps across. Sounds: the paper's snap and a rush of air, a pinwheel's
whirr, a fire's hiss.

The yard's fan bay: three pinwheels on posts facing three ways (`spec.pinwheels`; a pinwheel turns only
blown into its face, `pinwheelCatch`, for `spin` 6 s, its lamp lit meanwhile); all three turning at once
sink their gate (`spec.windGates`: a gate with no plates whose `want` the fan sets; open 20 s after); a hut
with a fire in its doorway (`spec.embers`: Flames, a fire hazard while it burns, a target: blown out it
catches again after 12 s; an ember glob relights it) and a crate inside to blow back out; crates and a metal
one in the open; a 4.2 m ledge to hover up to. Tests: the falloff and the directions, the lift (three, then
none until you land), the sail (parked and ridden), a crate, a blot, a swarm, a bomb and a bubble in one
gust, a lamp and the yard's fire put out and relit, the pinwheels and their gate, the bays in the yard.

## The Gadget Yard (`src/levels/gadget-yard.js`)

A round yard of packed sand inside a low wall (`YARD.radius` 50 m), the ship on an apron outside its south
gap (`shipSite`), no wild packs (`level.foes.wild: false`, src/foes.js). The middle has what any gadget can
play with: a floor plate that lowers a gate into a little walled garden while a crate sits on it, crates
and a metal crate, three targets on posts (they flip and light), a cracked wall, a block with ledges. Round
the ring, each gadget's bay (`bayFrame(i)`): the hook's (red banner) has a wall with rings along its top,
two towers across a 12 m gap with a ring and two crates up on the far one, a ring on an 11 m pole and a
ledge under an overhang; the bombs' (dark blue) a cracked wall closing an alcove with a lamp inside, a
cracked boulder, a stack of crates and two metal ones, and a pen of three ink blots (kept at three by the
runtime, new ones only while you are away); the boomerang's (brass) three targets in an arc, a row of
lanterns along a wall, two crates hung on ropes from a beam and two pots of ink up on a block; the magnet's
(grey) its puzzle (above); the recall hourglass's (teal) a high ledge with a crate at its lip; the ink pen's
(night blue) towers across a gap and a ramp's rise; the lens's (blue-green) two 5 m towers with a plank bridge
between them that is an illusion, the true ghost path winding behind it, writing on the far tower and a cache
buried in the sand in front; the springs' (orange) blocks 4, 8 and 12 m high, a 20 m tower past them (three
bounces), and a little room roofed with a cracked floor, a lamp inside. `level.gadgets: 'all'` grants every
gadget on arrival.
