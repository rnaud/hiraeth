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
     create: (ctx) => instance,   // ctx: player, physics, camera, rig, tool, foes, relics, flammables, world, fx, hud, bursts, sfx, sound, notice, aimAt
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
every 5 s). Tests: the throw's angle and range against the maths, the bounce, the falloff, the pouch, a
blast on a foe, a crate, a cracked wall (solid, then not) and the traveller, a bomb thrown, bouncing and
chaining.

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
coming home it glances off walls (4 at most, then it passes through). Its sounds are its own (`snd`).
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
strokes, the bay (the plate only metal presses).

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
(grey) its puzzle (above). `level.gadgets: 'all'` grants every gadget on arrival.
