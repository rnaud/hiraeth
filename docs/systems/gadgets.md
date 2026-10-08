# Gadgets

Zelda-like things the traveller carries besides the backpack's tool (v0.91): one in hand at a time, used
with its own button. The first two are the grappling hook and the ink bombs; more come one file each.
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
  a crate) and the gates they lower. What moves or breaks must be flagged `noCollide` when the level builds
  it (the yard kit does), or the level's baked collision keeps a copy of it.
- **`hud.js`**: the chip in the lower left (the gadget's own picture, drawn once by `src/item-icons.js`,
  its name, its count, the button), the reticle, the wheel, and on a touch screen the ◆ use button.
- **`sfx.js`**: the sounds, from the game's synth (`Sound.sweep` / `burst`).

## The buttons

| | pad (by position) | keyboard / mouse | touch |
|---|---|---|---|
| use (press, hold, let go) | Y / △ (`PadGadget`) | T, the middle mouse button | ◆ |
| next gadget (a tap) | D-pad ↑ (`PadGadgetPick`) | B (Shift + B: the one before) | tap the chip |
| the wheel (held 0.32 s) | D-pad ↑ held, the left stick points | B held, W A S D point | |

With nothing in hand Y / △ is still the scout's ping, and the D-pad's ↑ the bell-note whistle while no
gadget is owned (`gadgets.claims('ping' | 'bell')`, main.js); V still rings the bell. The game menu's Items
panel takes a gadget in hand too (`onUse`).

## Adding a gadget

1. Write `src/gadgets/<id>.js`; its default export:
   ```js
   export default {
     id: 'magnet', name: 'Lodestone glove', glyph: '⊂', order: 30,   // order: its place in the wheel and the yard
     text: 'what it is', use: 'what it does (prompts in Xbox / PlayStation form: Y / △)',
     model: () => group,          // about 0.3 m, makeMaterial materials (inked by the post pass)
     create: (ctx) => instance,   // ctx: player, physics, camera, rig, tool, foes, wind, world, fx, hud, bursts, sfx, sound, notice, aimAt, gadget(id)
     yard(kit) {},                // its props in its Gadget Yard bay
   };
   ```
   The instance may have `press()`, `hold(dt)`, `release()`, `control(dt, input)` (before the traveller
   moves), `update(dt)` (every frame, in hand or not), `aiming` (true: the camera comes over the
   shoulder; call `ctx.aimAt(point, dir)` each frame to turn the traveller), `hud()` (`{ count, max, note }`),
   `equip()`, `unequip()`, `cancel()`, `dispose()`.
2. Its bay: `yard(kit)` places things in the bay's own frame (about 14 m across, +z toward the middle of
   the yard, -z away, y up from the ground): `kit.block(size, centre)`, `steps`, `pole`, `anchor(p, {
   normal })`, `cracked(size, centre, { shape: 'boulder' })`, `crate(centre, { metal })`, `plate(at)`,
   `gate(size, centre, { plates })`, `target(at)`, `lamp(at)`, `pen(centre, r, count)`, `flag(colour)` (a
   banner and the gadget's model large on a plinth). Ten bays stand round the ring (`YARD.bays`), in the
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
every 5 s). Tests: the throw's angle and range against the maths, the bounce, the falloff, the pouch, a
blast on a foe, a crate, a cracked wall (solid, then not) and the traveller, a bomb thrown, bouncing and
chaining.

## The bubble wand (`bubble.js`)

Hold the use button to aim (the wand in hand, the reticle on what it would catch: "a foe", "a crate", "a
bomb", "yourself"); let go to blow. One bubble at a time: another press pops it. The bubble flies to what
the aim found (13 m/s; a crate or a bomb near the line is found with a wider assist, `cone` 0.12 rad), or out
along the aim (10 m/s, slowing, popping on the first wall it meets) and closes round the first thing it
touches. Carried, it rises at `BUBBLE.rise` 1.25 m/s, easing to a hover `maxRise` 7 m over where it caught
its load (`riseSpeed`), and drifts on at `drift` 0.7 m/s the way it was blown (a gust or the fluid's push
adds to it, then dies back into the drift). It pops after `life` 6 s:
- **a crate** (`Prop.held`: no gravity; its velocity is the bubble's, so the world's own collision slides it
  along a ledge's side): it falls where it is. The yard's lift puzzle: float a crate over the ledge and drop
  it on the floor plate up there, and the alcove's gate beside it sinks.
- **a foe**: helpless inside (stunned, still, turning slowly; its strike broken off); let go it falls, and
  from higher than `fall` 3.5 m it lands hard (one cut). A machine is too heavy: the bubble bursts on it.
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
runtime, new ones only while you are away). `level.gadgets: 'all'` grants every gadget on arrival.
