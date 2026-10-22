# The makers' temples

Each world's dungeon: its gadget, its keeper, how the temples are built.

Each world has one great building of the makers, a Zelda-style dungeon with a
gadget half-way through and a keeper at its heart (LORE.md, "Temples", has the
design for every world). All eleven are built: the desert's **Givers'
House**, the City-Shaft's **Warden's Well**, Vael II's **Founders' Belfry**, the
Buried Machine's **Engine-House**, the Garden of Spheres' **Footprint**, Lorn
II's **Lamp-House**, Lorn's **Hush-House**, Vael's **Aerie**, the Sealed Hangar's
**First Garage**, Viridel's **Builders' Greenhouse** and the Signal Market's
**Undertower**. Reference pictures (the reference lab's prompts, the author's picks beside them): each temple's
hall and entrance, `docs/design/temple-prompts.md` (`references/temples/<id>/`); three more rooms of each,
`docs/design/temple-interior-prompts.md` (`references/temples/rooms/<room>/`); the guardians' design sheets and
arenas, `docs/design/guardian-prompts.md` (`references/guardians/<id>/`). Everything lives in `src/temples/`:

- **`kit.js`**: the architecture. `TempleKit` batches render meshes per material
  (noCollide) and hidden collision proxies, in a local frame; pieces: `hall` (walls
  with doorways cut in them, an oculus, columns, a glyph frieze), `rotunda` (a round
  hall, gaps at any height), `stairs`, `ramp`, `bridge`, `shaft`, `slab`, `ledge`,
  `column`, `glyph`, `frieze`, and `templeMaterials(palette)`.
- **`pieces.js`**: the parts that move or answer: `Door` (sinks into the floor;
  lamps on its lintel show how much of its condition is met; `bell: true` for a
  bell-tuned door), `Plate`, `Ball` (a stone ball in a groove the fluid's push rolls:
  the pushable block), `Brazier` (ember only), `Bramble` (thorns: burn them; they
  prick you back), `Switch` (an eye a splash wakes; `crystal: h` a singing crystal
  instead, `wrong` what it says when it won't wake), `Jaw` (a gate of snapping jaws, two leaves of square interlocking slabs:
  a stilling glob stills it open for good), `Swing` (a crystal pendulum over a
  bridge that knocks you off; a stilling glob stops it a while), `Updraft` (a
  column of rising wind that lifts the fluid wings, holds you near its middle
  and lets you go at its top), `Gust` (gusts down a hall that shove you back,
  but not behind its screens), `BellEar` (a bell rung near it: `struck`, a bell struck only, a clapper's blow or
  a `HookBell`, the pull-ring the grappling hook rings), `Platform` (a riding disc, a dynamic solid you stand
  on), `Bridge` (stones rise out of a chasm; `from: 'grow'`: a vine bridge that
  grows out from its near end), `Mark` (a checkpoint), `Pit`; and for the last
  three temples `Seed` (a husk in a stone ring that only a bloom glob wakes),
  `Bud` (a flower-door: a great bud over a doorway, petals hinged round its rim,
  that a bloom glob opens; it can be held shut behind you as an arena's door),
  `Glass` (a greenhouse pane you slip off when you try to climb it, until a vine
  has grown up it: `when`), `Sunbeam` (a louvre in the roof and its beam, on whichever spot its condition picks), `EchoStone` (a singing stone: splash it and it sings
  its note, game event `'note'`) and `EchoEar` (a brass horn that lights its
  element when its own note is played back close by: game event `'echo'`; the
  `NOTES` low / mid / high each have a degree and a colour). `Bank` takes any
  number of eyes and a window, with its own words (`full`, `fade`): six in 4.6 s
  is the First Garage's (two tanks in one breath, the quick coil's refill).
  `Weight` (a block of the house's stone carried in both hands onto a plate: below, "Weights on the plates"),
  `Vane` (a vane of the makers' bellows, lit only while it turns) and `Iris` (blades in a ceiling) are the Warden's
  Well's, `Hammer` (an engine's piston-hammer over a walkway) the Engine-House's (below). Moving parts are `userData.dynamic` (no tiling or levels of detail).
- **`logic.js`**: the puzzle as pure state (`TempleLogic`): plates and what
  stands on them, balls on their rails, latched elements, doors and bridges from
  conditions (`{ all }`, `{ pressed }`, `{ lit }`, `{ drumOn }`, `{ item }`,
  `{ resolved }`…), rooms reachable from the entrance, `next()` for the marker and
  the scout. Saved in the save slot's flags under `temple.<id>.*`. `solve(def)`
  plays a temple through as a player would; `withhold` proves its gadget is the key.
  A latched element may come `after` another (the Hush-House's crystals, low to high, the first by the
  door; and its pendulums' notes, stilled in turn: a `Swing` with an `id` lights it when stilled, or rings
  flat out of turn, and still stops either way, so the walk across still works).
- **`boss.js`**: `Guardian`: sleep, wake, fight, open, shift, weary, resolved; a meter in
  phases (`calm` for an organic guardian, `damage` for a robot), three fighting phases with a shift between
  (it staggers, its marks light, new moves); a staged fight of 4-6 moves, combos and openings read from the
  body, every move told by the body, only thrown things marking where they land (docs/systems/foes.md, "The
  guardians' staged fights"), then struck: `knockDown` +
  `hurt` in hearts (½ to 1: docs/systems/foes.md, the damage table), never taking you from more than a
  heart to nothing (`strikeDamage`); a knockout puts the keeper
  back to its phase's start. `final: 'touch'` (an interactable: a hand on its brow)
  or `'break'`. A temple may hook it (`onStrike`, `onCatch`, `onReset`, `openFor`: how long a combo's end leaves
  it open). In the five reworked temples its last phase asks for the temple's idea, with pieces of its own in the
  arena (docs/systems/foes.md, "The guardians' last phases"). Six guardians' second phase asks for a second verb
  before the gadget (`phase.asks`, v1.63: the guard, the push, a splash or a perfect dodge against one move; foes.md,
  "A second verb"). **`guardians.js`**: the Keeper's and the warden's bodies.
- **`runtime.js`**: one temple alive: builds the rooms (the world's `layout`),
  the building outside (`exterior`) with its doorway in and the ways out
  (portals), marks and pits (and a net under the whole temple), the chest's site
  (the box system places it: `PLACEMENTS` entries with `temple`), the guardian
  and its meter on screen, and the world change (`change`: `set(on)`, `update`).
  Once the guardian is resolved the house's ending is filmed (`finale.js`: docs/systems/cinematics.md, "A temple's
  ending, filmed").
- **`index.js`**: `attachTemple(levelId, scene, level)` (called by the level's
  `create`: joins portals, lights, `init`, `dynamic`, `update`, clears the
  world's own trees and rocks round the building) and `setupTempleStory(ctx)`
  (from `src/story/index.js`: the temple's quest, its local, the locators; the local gives the quest and is
  the world's lead giver on the map, the quest starting otherwise only as you go in: docs/systems/story.md,
  "Quests are given", v1.68).
  `TEMPLES` and `GADGETS` (the 50/50 plan). **`migrate.js`**: whoever already owns
  a temple's gadget finds its chest open. Per world: `desert.js` + `desert-data.js`,
  `incal.js` + `incal-data.js`, `arzach2.js` + `arzach2-data.js`, `buried.js` +
  `buried-data.js`, `spheres.js` + `spheres-data.js`, `perdide2.js` +
  `perdide2-data.js`, `perdide.js` + `perdide-data.js`, `arzach.js` +
  `arzach-data.js`, `garage.js` + `garage-data.js`, `edena.js` +
  `edena-data.js`, `bazaar.js` + `bazaar-data.js` (layout, logic,
  guardian, outside, change, words; a change may have a `late` step, run after
  the level's own movers). `rt.isNight()` (from the story's `isNight`, main.js)
  is there for a change that keeps the night (the Signal Market's tower).
- **A level with its own navigation list** (the Hangar's gravity portals, `{ pos,
  to, toUp, toFwd }`, which `src/levels/garage.js` walks itself to send you
  through): `attachTemple` leaves that list (`level.garage.portals`) alone and
  gives `level.navigationPortals` a copy with the temple's doorways in the same
  shape (`navigationPortal`), so the scout, the flora, the reactive world and
  the wildlife read them alike (the last two skip `temple` doorways: no seeds
  or cog mice in the temple's rooms). The doorways the game walks through go in
  `level.portals`, as everywhere.
- **The last three**: the **First Garage** (`garage.js`) on the plateau's rim
  west of the keep, a stair-house of the makers with a stopped clock over its
  door and the makers' cogs in the cliff below (reworked from the temple design
  audit, v1.12: the makers' clock counts round from where its hand points, and
  every clock in the house stopped at four): the escapement's three eyes woken
  in turn from its hand (`after`), the winding well's counterweight rolled in
  from the escapement's landing (only the ball's weight: `drumOn`), the **quick
  coil**, banks of six eyes, the last in turn round the handless clock from four
  (`Bank` `order`: out of turn they all go dark; the clue is the little clock over
  the gallery's way in, the well's, and the one over the door), the **Clockwork Foreman** (`foremanModel`: hit its
  six numerals inside one breath when its face opens); after, the clock keeps
  the true time and the cogs turn. The **Builders' Greenhouse** (`edena.js`) in
  the meadow hollow north of the white ruins, far from the tea terraces (reworked
  from the temple design audit, v1.16: "Nothing grows in the shade" below): the
  eye that wakes only in the sun the ball's louvre lets in, the Glass Stair's one
  ball and two plates (the eye, then the disc), **bloom mode** and the bud in a
  sunbeam, the seed in the shade and the sun-ball, the seed-ball rolled into the
  light at the glass's foot, its vine into the bud, the **Gardener**
  (`gardenerModel`: bloom the four dead beds, then its bare back when it kneels,
  in the sun; a hand on its brow); after, flowers and vines on every slab of
  the white ruins (`level.edena.ruins`, two instanced pools whose counts grow)
  and on the dome. The **Undertower** (`bazaar.js`) through an old doorway in
  the silent tower's back (reworked from the temple design audit: "Notes that
  travel" below): the singing ball and the dish pair, whose note raises the
  pillars over the cable pit (v1.27: no disc), the riding well and its horn for
  the low stone, the **echo shell**, the chamber's low stone carried a room on to
  the Listening Passage's door, the listening pillars (each rises for the high note played back near it, v1.74), the far door that listens
  through a dish, the **First Sign** (`signModel`: it cries one word of its
  line; when it lowers its dish, play the word back into it and it says the
  next); after, a lamp on the silent tower, and once a night it speaks the line.
- **Bloom mode** (`src/fluid-kit.js` MODES.bloom, item `bloom`): a fourth gun
  mode after ember, leaf green and petal pink in the tank, slow as sap. Targets
  that `accept` `'bloom'` grow; to everything else it is plain fluid. A bloom
  glob that lands on the world emits `'tool:bloom'`, and `src/boxes/effects.js`
  plants a few flowers there from the seed pouch's pool.
- **The echo shell** (`src/echo-shell.js`, item `echo`): it keeps the last
  `'note'` sung within 18 m (saved: flag `echo.held`) and V (Y / △ with no gadget in hand) plays it
  back (`'echo'` { pos, note }) with the bell (`effects.ring()`).
- **The brass level** (item `level`, the Hangar's gift in the open, on the keep's
  wall where the quick coil was): where down has turned (the upside-down quarter
  and the ring), a little bubble level at the screen's right edge shows how the
  floor lies under the view (`effects.js`, it needs the camera).
- **Items**: `fire` moved into the Rose House (and out again in v1.44, to the Givers' Hearth: the house holds the
  `sword` and the `shield` now; since v1.45 it comes with the gun, in one chest), `jetpack` into the Warden's
  Well, `bell` into the Founders' Belfry, `cell` into the Engine-House, `lens` into
  the Footprint, `lantern` into the Lamp-House, `stun` into the Hush-House, `glider` into the Aerie,
  `coil` into the First Garage; new tools in the last two: `bloom` (the Greenhouse) and `echo`
  (the Undertower); new gifts in the open: `level` (the Hangar's keep wall), `resin` (the
  Buried Machine's chimney ring: climbing tires you half as fast,
  `player.climbK`), `soles` (the City-Shaft's pillar: `player.fallGuard`) and
  `hush` (Vael's spire: creatures don't hear you walk up, `player.hush`, read by
  `src/wildlife.js`) and `shell` (the Spheres' grove canopy: every few seconds
  the unopened boxes within 45 m answer softly, a `'bell'` event with `soft: true`
  that bell-tuned doors ignore), `moss` (Lorn II's root arch: a small light
  round your feet after dusk), `pouch` (Viridel's canopy: flowers come up in
  your footsteps, one recycled instanced pool in `src/boxes/effects.js`) and
  `reed` (Lorn's mossy rise: twice the breath under water, `player.breathK`, read
  by `src/swim.js`) and `scarf` (Vael II's balanced stack: the wings sink slower,
  `player.sinkK`).
- **Held bells** (the Founders' Belfry, reworked from the temple design audit): a `bell` element with
  `hold: s` is not latched. Its `BellEar` rings it for s seconds (rung again, the note starts over; at
  2.5 s left it says `fading` and rumbles), then calls `logic.quiet(id)`: a door it holds shuts (but
  not on whoever stands in the doorway: it waits for them to step through) and stones from `'above'`
  fall up again, far ones first. Nothing of a held bell is saved; the marker only points at one a shut
  door waits for (`logic.awaited`). A `Ball` may roll farther (`friction`, 1.6 by default; its plate's
  dip always holds it), cross a bridge (`gap: { bridge, from, to }`: it stops at the lip while the
  bridge is up, and drops if the bridge goes from under it, a new one rolling out where its groove
  starts) and stay put once home (`lock`). The Belfry's bridge opens on `{ any: [the held bell, the
  ball on the far plate] }`, so the ball's weight holds it for good. The audit reads a held bell as a
  timing and as a state that changes back (`scripts/temple-design/lib.mjs`).
  Before the whistle (v1.27) the house teaches it with its own bell: in the Stone Stair a `Ball` with `strike: { at }` is
  a clapper; rolled to rest on its plate in the founders' bell's mouth it strikes the bell (a game `'bell'` event at
  `at`; a splash on it as it lies there strikes again), whose held element `e0` (`when` the ball is in the mouth) brings
  down a `FallUpStone` (arzach2.js: a `Platform` that comes down only while its `held` condition holds and falls up
  again, carrying its rider, when it fails) to lift you to the high door. The Bell Chamber's own bell is a try (three
  stones from `'above'` come down round the dais while it rings; nothing waits on them); the held door is a room on, in
  the Bell Porch.
- **The pool-orb** (the Lamp-House, from the same audit): a `Ball` with `lamp: { id }` is a glass orb of
  pool water. Stood by at rest with the lantern for `hold` s it glows for `lasts` s; at rest on its plate
  while it glows it lights element `id` (a lantern `switch`, shown by a `LightEar` with `reach: 0`, which
  only glows once something else has lit it). Rolled in dark it lights nothing and is tipped back out (no
  dead state), and it only locks in its socket once its lamp is lit. With `lamp.pool: { id, at, reach }` it also
  drinks a lit pool's light, resting beside it: the Root Stair's disc (v1.12) waits for such an orb, rolled from
  the Hall of Dark Pools through the doorway until v1.77 (`gap` on the door `d1`: it stopped at the shut door; since
  then the orb, its small pool and the socket are on the Root Stair's own near floor), so light is
  carried before the chest, and the gallery's niche twists it with the lantern where no pool is. Since v1.27 the
  socket's lamp wakes moss-stones sunk in the dark pool instead of a disc (a `Bridge` with `glow`: drawn glowing, as a
  hidden bridge is, but there for everyone).
- **Shortcuts back** (v1.12): the Hush-House's Pendulum Gallery has a keeper's ledge along its east wall from the
  far landing to a gate by the near one, its footstone (`ps`) behind the gate: a second link between the two
  landings (`ds`) that only the far side can open, so the walk back never means the pendulums again. (v1.53: the gate
  opens once the Nursery off the far landing is won, its footstone gone: "Round 3" below. v1.83, issue #409: the ledge
  and the gate are gone; the pendulums, sung in turn from the far side, rest for good.)
- **Notes that travel** (the Undertower, from the same audit; its idea: a note travels, the dishes carry
  it across a hall, the shell in your pocket, one note at a time). A `Dish` is a pair of the makers'
  receiving dishes: a `'note'` sung or an `'echo'` played within `reach` (4.5 m) of the near dish's mouth
  comes out of the far one's 0.6 s later, as the same event marked `relayed` (a dish never passes on
  another's). It carries only while `when` holds (a ball's weight on its footstone, `drumOn`); dark, it
  says so and carries nothing. An `EchoEar` may hear a stone's own song (`hears: 'note'` or `'both'`), be
  set on a tall stand (`stand`, `size`), and hold its element for `hold` seconds like a held bell (until v1.74
  the gallery's great horns held the pillar bridge so; now the pillars listen themselves: `Pillars`, round 6
  below). A `Ball` with `sings: note` is a singing ball: a splash makes it sing.
  A `Bridge` with `pillar` rises as tall pillars; a bridge from below that shuts sinks, the far stones
  first, and waits for whoever stands on it. `EchoStone` `shape: 'egg'` is the gallery's eggs.
- **Nothing grows in the shade** (the Builders' Greenhouse, from the v1.16 audit). A `Sunbeam` is a louvre in the roof
  and the beam through it: thin pale rays to a pool of light, falling on the first of its `spots` whose condition
  holds (or `pick()`'s), swinging over in a second or so when that changes. The light is the logic's: a latched
  element may take only `when` a condition holds (`logic.js`), so the Potting Hall's eye wakes only with the ball on
  its louvre's plate (`when: { drumOn }`), and a `Seed` or a seed-ball bloomed outside its `when` sprouts pale and
  folds back (`shade`). A drum may rest on several plates (`stops: { plate: t }`; the Glass Stair's one ball and two
  plates: the sun on the eye, or on the disc, a `Platform` that rides only `when` it holds). A `Ball` with `seed`
  is a seed-ball: a bloom glob grows it where it lies if its element's `when` holds (in the far sunbeam at the
  glass's foot), and grown it roots and rolls no more. A `Bud` with `bloom: null` is opened by something else (the
  vine climbing into it: `d4` opens on `seed2`). The Gardener's dome louvre is a `Sunbeam` with `pick`: the quarter
  whose footstone (`fs1`-`fs4`) was last stood on (`rt.gardenSun`).
- **One wind** (the Aerie, from the same audit): a stone in a vent's mouth stops the wind there, and it comes out of
  another. `Gust` and `Updraft` take `when` (they blow only while it holds; a still updraft's rings settle, and
  `still` says why when you open your wings over it), and a `Gust` carries an open-winged traveller along its way
  (`carry` m/s: a tailwind) instead of shoving them back. The Hall of Winds blows until its stone (`ballW`, pushed up
  the hall through the gusts) sits in its vent (`pH`); then the Wind Well's column rises and the feather raft rides
  up on it to the Wing Chamber (`raft`, a door the logic opens on the same stone). The Gulf's tailwind blows once its
  stone is out of the throat on the high balcony (`tail`: `not` on `drumOn`, a state that changes back), and the
  column beside the perch once the perch's stone is out of its own (`rise`). The Roost's two vents share one stone
  (`ROOST`).
- **The lee, and the marks read** (issue #216, the author: "If I'm behind a wall I shouldn't get pushed by the wind
  in the Aerie. Also not sure what the device at the entrance with the maker's sign is."). The Hall of Winds' shelter
  boxes were narrower than its screens and only 2 m deep, and behind the far wall there were none: 3 m behind a
  screen a gust shoved you 4.5 m. A `Gust` with `lee` (m, the hall's 3.5) now also asks whether anything solid stands
  that close upwind of you, at your chest (one ray against the wind, `Gust.lee`; the foes' working asks it too): a
  screen, a wall, the stone. Its streaks show it: half of them low at a body's height (`floor`, `streaks` 64), and a
  streak whose leading end is in a lee (its lane sampled every 0.5 m once, `leeLanes`) is not drawn. The "device"
  was a `Mark`, the checkpoint glyph stone every temple has: it lit silently. Now its glyph flares as it wakes, and
  the first one of a save says what it is (`MARK.line`, once: the `temple.markTold` flag). Tests:
  `tests/aerie-lee.test.js`.
- **The tower breathes through its vanes** (the Warden's Well, from the v1.19 audit; the tower was built to keep the
  shaft breathing, and the breath turned its machines). A `Vane` is one of the makers' bellows, in a floor (facing
  up) or on a wall (`wall`, `yaw`): its element (type `vane`, logic.js: held like a held bell, lit only while it
  turns) drives what names it only as long. A splash spins a small one for `coast` seconds, slowing (`fading` warns);
  a `great` one only rocks to a splash (`heavy`) and turns under a steady wash: open wings with the Warden's bellows
  (`wardenbellows`, v1.42; the debug jets burning do it too) within `reach` metres over its face, and `linger` s after.
  Each great vane has an `Updraft` through its frame (`VANES.breath`, `HALL.breath` m): it bears open wings and holds
  you over the vane, and rising air holds you still enough to aim (player.js `hovering`, fluid-tool.js `bodyFree`).
  The way up is a draught over the chest's plinth (`when: { gadget: true }`), rising on through each iris as it opens
  (`heights`, the Updraft's: the first condition that holds sets its top). The Turning Floors' discs ride
  on the vane on its pillar beside the island (over the far door until v1.77); the Climb's ball crosses a slot (`Ball` `gap`, the slot a `Bridge`) only while the vane in
  the well's floor turns (the gap's `lip` says why it stops); the gallery's eye has stone lids (`Switch` `lids`:
  shut while its `when` fails) that the great vane in the floor lifts, and opens the `Iris` in the ceiling (blades
  that slide back into it, solid while shut); the loft's ball is pushed over a gap from the air, hovering over the
  loft's great vane, and on its plate opens a second iris onto the crown, whose eye wants two vanes turning at once
  (`when: { all: [vS, vC] }`: the small vane splashed first, then the great one hovered over before it slows). Since
  v1.27 the small one (`vS`, 15 s) stands on a post in the loft below, seen from the crown down through the second iris
  and splashed from the loft: a key a room away, in sight of its lock.
  The audit reads a vane as a splash (or its item) and a timing, a state that changes back, and a ball's `gap` as a
  key of its plate's lock (`scripts/temple-design/lib.mjs`). The warden's hall has four (`rt.hallVanes`,
  docs/systems/foes.md).
- **A ball in the teeth stops the engine there** (the Engine-House, from the v1.19 audit; the Tooth-Warden jams the
  whole engine, and the makers' own jams are stone balls rolled into a crank's teeth). What a crank drives stops where
  it stands while a ball sits in its notch: the Piston Hall's pistons ride only while the valve is open and the ball
  is out of their crank (`ball0` on `pY`, a drum with two stops: rolled back into `pZ` they stop again); the Crank
  Hall's `Hammer` (an iron head slamming onto the walkway, knocking you into the pit) runs while its door `h1` is shut
  and hangs up still once the gantry's ball is in its crank (`pJ`); a `Bank` with `stroke: { period, up }` stands its
  eyes on pistons (`piston: { drop, phase, jam }`) that rise in turn, each up for `up` s of the period, hittable only
  while up, held up while its `jam` holds (its `unmet` line when four woke but the bank's `when` fails). The Fourth
  Chamber's four share one crank (one ball holds all four up); the Furnace's two west pistons have a crank each, the
  other two are caught in turn. The cranks are a `Cranks` (buried.js: wheels that turn unless jammed, rods to their
  pistons) and the hall's great gear a `Gear`; the Tooth-Warden turns on it (docs/systems/foes.md).
- **The Rose House remade for empty hands** (v1.44, issues #74 and #7). The house is walked into with the backpack
  and the lift valve's double jump only (docs/systems/progression.md), and its gadget is the **Givers' blade** (`sword`),
  half-way, with their **guard** (`shield`) a little after: no gun, no gun mode anywhere in it
  (`tests/temples.test.js` solves it with `['backpack', 'doublejump']`). New parts it brought, any temple can use:
  - a `Ball` with `shove` rolls ahead of you when you walk into it along its groove (at most `SHOVE`, 2.6 m/s: hands),
    and with `blade` a cut of the sword sends it rolling at `BALL_CUT` (7.5 m/s); a drum's logic `roll: 'hand' | 'sword'`
    says what moves it (logic.js `rolls`; left out, the gun's push, as before);
  - a `Bramble` with `cut` falls to the sword (its element `needs: ['sword']`); a `Switch` with `blade` wakes only to
    a cut (a splash says it wants striking); a `Gust` with `guard` breaks on the shield raised into it
    (`player.guarding()`, `player.guardDir()` from src/fluid-blade.js), and you walk on into it at `guardPace`
    (no temple uses it since issue #245);
  - a `Sentry` (the Givers' watcher, issue #245): a bronze eye on a stone foot, a latched `switch` element with
    `needs: ['shield']`. Asleep until it can be used and you stand in its `zone`, then it turns to you, holds a beam
    on you that narrows (`SENTRY.aim` s, following you `track` of it, then locked) and fires a bolt down it
    (`SENTRY.speed`). Awake it is a target with `lock` and its own `lockRange` (src/targets.js; src/fluid-blade.js
    `lockTarget`), so the guard turns to it from across the landing as to a foe; a cut or a splash only rings its
    bronze (`shrug`). The bolt is taken by `player.guard(from)` (any block, perfect or not: the shield's own cost and
    feedback); blocked, it flies back into the eye and the element is lit, which opens its door. Not blocked, it hurts
    (`DAMAGE.blow`, spared) and knocks you back; stepped away from once the beam locks, it misses. Its first wake says
    how to meet it in one line (`woke`). Its beam is drawn to the first thing of yours it meets (issue #485,
    `src/beam-stop.js` `beamStop`): the raised shield when it would take the bolt (`player.shieldFace(from)`, the
    block's own test), else your body (an upright cylinder, `BODY`), else `SENTRY_BEAM_PAST` m past where it aims or
    a wall. The mesh's length is all there is, so Unity's mirror draws it the same;
  - a `Flame` with `when` (and `lid`) burns only while its condition holds, under a stone lid until then;
  - a hooded `Brazier` catches from its burning ball as the ball rolls in slow (where it is, not where it last lay);
  - a `find` element: a second chest (`{ type: 'find', item, box }`, logic.js `find` / `isFound`, the layout's
    `finds` sites, src/boxes/placements.js `findSite`): the guard in the Watcher's Hall;
  - a guardian's attack with `guard: true` is taken by the shield (boss.js `strike`, through `player.guard`), and
    `def.onBlock(g, a, perfect)` answers: the Keeper, jarred, pants;
  - a temple's `encounter: { room, extra }` (src/foes.js placeMachinesIn: the room's mark's machine and `extra` more,
    while `on(rt)` holds): the Rose House's until v1.77, its Sword Chamber's doors held while its machines stood; since
    issue #336 its fight is an arena of its own, the Machines' Hall (`ARENAS`, below).
  The rooms (since v1.77, issue #336: "The Rose House as shrines" below): the Hall of the Flame leans its ball by hand
  through the pilot flame into the hooded bowl at its groove's end (`b0`, the door `d1`); the Dry Channel is a sand pit
  with one pier, 9 m of air either side (one jump is about 6 m, the double jump 13), its side walls glazed against
  climbing (`Glazed`), and a plate on the pier's head (`pp`) wakes the chamber's door at the top of the gallery (`dc`,
  across the pit); the Sword Chamber holds the blade and nothing else, its north door (`dk`) sinks for the blade in hand;
  the Machines' Hall past it is the house's one fight (`arM`, its doors `dk` and `dm` held while its machines stand); in
  the Hall of Fires the thorns over the ball's groove (`bw0`) are the blade alone, and its ball (`ball3`, a fire on its
  groove) leaned on goes out before the bowl on the chasm's lip (`b3`, the bridge `br1`) while a cut gets it there
  burning (`CHEST_BALL`); over the bridge the Watcher's Hall holds the guard (`guard`), and with it in hand the Givers'
  watcher (`sentry`, `SENTRY_AT`) in the middle of the hall wakes: its bolt sent back off the guard breaks it and opens
  the east door (`dw`) into the Hall of Channels (the old Hall of Winds: its bellows' wind is gone, issue #245;
  `src/temples/migrate.js` `LAYOUTS.desert` breaks the watcher for a save already past it). Down the hall's middle a ball
  cut along the long groove burns out short of the bowl at its end (`b4`) unless the eye high on the obelisk beside the
  groove (`e10`, struck from a double jump) has lifted the relay fire's lid, and woken the keepers' door `sc` back to the
  Hall of Fires (`WING`: caught again at the relay it gets to the bowl with 2 s of its flame left, where it had a fifth of
  a second until issue #311; gone out with the lid still on, it says where the fire is, Ball `tar.short`); the
  Keeper's spokes run from the basin out to hooded bowls on the rim, a fire half-way (`HEARTH_FIRE`): cut out, a
  ball lights its bowl (its first phase); a guard against its charge jars it and it pants, and water from your tank
  at its mouth (an interactable, `temple.desert.water`) calms it (its second); a ball cut back in from a lit bowl
  rolls burning to it (its last, and the only way it pants then). Ember mode comes with the fluid gun now, in the Givers' Hearth.
- **The Rose House as shrines** (v1.77, issue #336: "The rooms should be much bigger, higher ceilings, larger doors…
  Think shrines in Breath of the Wild"; the rules in `docs/design/temple-redesign.md`). Every hall 36 m across (the Hall
  of Channels 36 by 75), the chest's round hall 26, ceilings 18 to 24 m (`ROOMS`), doors 7 by 9 (`DOOR`); the props as
  they were (the balls, the bowls, the plates, the weight, the chests, the eye, the jumps and the grooves' lengths, so
  every timing holds). Each room has its kind in `LOGIC.rooms` (`kind`: puzzle, combat, chest, passage, guardian), and
  `src/foes.js` places machines only in a `combat` room's, round its mark's `foes` spot (`Mark` `foes`): the Machines'
  Hall, an arena (`ARENAS`; won, its way on `dm` opens; the blade taken, "something in the walls is waking" beyond the
  north door). Each puzzle stands in the middle of its own hall: the Hall of the Flame's groove down its middle, the
  pier in the pit's, the Hall of Fires' ball, fire, thorns and bowl in one room (they rolled through the chamber's north
  door before), the watcher in the middle of its hall, the Hall of Channels' groove down its middle and the eye on an
  obelisk beside it (it was high on the end wall, the bowl through the east doorway). The Hall of Fires', the Machines'
  Hall's and the Watcher's Hall's east walls are one wall, the Hall of Channels' west (two walls there drew their faces in
  one plane: `tests/zfight.test.js`). Old saves: past the old chamber's fight, the Machines' Hall is won; one that stood
  in the old rooms is taken to its last mark (`migrate.js` desert v4, `desert.js` `RELAID`). Tests:
  `tests/temple-rules.test.js` (no rule broken), the on-foot walk and the play-through in `tests/temples.test.js` and
  `tests/temple-playthrough.test.js`, `tests/door-bypass.js`, `tests/zfight.test.js`. The Hall of Fires' groove
  (`FIRES.x`) runs down the hall's middle (x 0, it was 5 m east of it until a follow-up in v1.77), its fire, thorns and
  hooded bowl with it; the bridge and the north door stay at `FIRES.bridge`, west of the bowl.
- **The Rose House round its Great Hall** (v1.83, issue #406; the first house per `docs/design/temple-best-practices.md`:
  G4, G6, a small key). The Threshold opens into the **Great Hall** (`ROOMS.hall`, 44 by 84 m under 30 m), the hub you
  come back to three times; a **balcony** 7 m up its west side (`ROOMS.balcony`). From the door you see the cistern's
  door at the far end (`d3`, two lamps: the watcher broken and the Hall of Channels' bowl lit), the watcher asleep before
  it (`sentry`, room `hall`), the small key's little chest caged on the floor (`kS`), and the east door with its keyhole
  (`dE`, `lock: 'small'`). The west wing (`XW`): the Hall of the Flame through an archway, the Dry Channel behind it,
  whose gallery's door (`dc`, the pier's plate, the double jump on its link) opens onto the balcony. On the balcony the
  blade on its mound and a ball too heavy for hands (`ballK`, `blade` only, `needs: ['sword']`) at the head of a groove
  that ends over an open hole (`Ball` `hole` without a `gate`: an open hole, `DROP`); cut, it drops onto the plate on
  the floor below (`pK`, `through: 'hole'`, the author's #401 ruling) and the key's cage sinks. Then the drop: off the
  balcony's edge, 7 m, back to the floor unhurt (`{ a: 'balcony', b: 'hall', oneWay: true }`). The key opens the east
  wing (`XE`, its floors at 0): the Machines' Hall (the arena, its doors `dE` and `dm` held), the Hall of Fires, the
  Guard's Hall (the guard; its doorway into the Hall of Channels open), the Hall of Channels (`XC`: the eye and the
  relay; the eye wakes the keepers' door `sc` back to the Hall of Fires). Back in the hall with the guard, the watcher
  wakes; its bolt sent back breaks it, and with the bowl lit the cistern's door opens onto the antechamber (its mark the
  guardian's checkpoint) and the cistern, now at floor 0. Gone: the Sword Chamber (its `dk`, which opened for the blade
  in hand) and the Dry Channel's `landing` room (the double jump is on `dc`'s link). Design audit 4.33 → 4.78: six
  steps (the cage, `d1`, `dc`, `br1`, `sc`, `d3`), mean obviousness 3.44 → 2.42, none painfully obvious (three
  before); rules broken: none. Old saves (`migrate.js` desert v5): past the old Machines' Hall, the ball dropped and the
  key taken and turned; one that stood inside is taken to its last mark; `save-migrate.js` `GIVERS_DONE` for the old
  remade house. Tests: the on-foot walk in `tests/temples.test.js` (the locked door, the ball through the hole, the drop
  unhurt, the key turned, the watcher in the hall, the antechamber's mark), `tests/temple-playthrough.test.js`,
  `tests/sentry.test.js`, the rules, z-fights and the house map.
- **The Warden's Well as shrines** (v1.77, issue #336, the second house redone to the rules). The Turning Floors 30 m
  across (its depth and the discs as they were), the Climb a round well 34 m across, the Ash Store and the Vane Room
  30 m square under 18 m, the Bellows Chamber's round hall 20 m, the drum of the gallery, the loft and the crown 36 m
  across with each floor 17 m over the last and the crown 18 m high, the Flue 35 m across, every door 7 by 9 (`ROOMS`,
  `FLOORS`, `VANES.ceil` / `crown`, `CLIMB`). Every puzzle stands in the middle of its room: the Turning Floors' vane on
  a pillar out of the drop beside the island (it was over the far door), the Vane Room's on a post in its chasm (it was
  on the far wall), the Climb's block a chord north of the well's middle (`CLIMB.face`: its vane at the face's foot
  within 20 m of the door it opens), the two lidded eyes on pillars in the drum's floors beside their great vanes, a
  shelf under each eye hiding it from the floor (`eyePillar`; they were on the drum's wall), the loft's ball on a raised
  walk on two piers (it was a shelf on the east wall), the crown's little vane on an arm off a post at the first iris's
  rim, out under the second iris on the high door's side (seen from the high ledge), the Flue's little vane on a post
  beside its draught, its great key on a pier off no wall, and a landing under the crown's doorway (the flue too wide to
  glide across from its middle). The rooms are tagged (`LOGIC.rooms` `kind`): the Ash Store is the house's one fight,
  its machines round its middle (`Mark` `foes`) among four columns; none stand by a puzzle, nor by the high door's stone
  (`src/foes.js`: in a tagged house a mark of no room of its logic has none). The warden, its hall and its fight, the
  story's lines, the two ways up from the gallery, the keys and every vane's timing as they were. Old saves: one that
  stood in the old rooms is taken to its last mark (`migrate.js` incal v4; `runtime.js` reads `temple.<id>.relaid` for
  every house now). Temple design audit: 4.56 before and after.
- **The Founders' Belfry as shrines** (v1.77, issue #336, after the Rose House). Every hall 36 m across (the stone stores
  30 by 36, the Hall of Echoes 36 by 50), the Stone Stair and the Bell Chamber round halls 34 m across, her hall 42,
  ceilings 18 m or more (`arzach2.js` `ROOMS`), doors 7 by 9 (`DOOR`); the upper house (the landing, the chamber, the
  porch, the Hall of Echoes, her hall) on a floor 8 m up (`UP`, 16 before), so the Ringers' Walk's ledge (`RING.y` 16) is
  16 m over the stair's floor and 8 over the landing. The props, the bridge's chasm (20 m), every groove's length and
  every bell's hold as they were. Tagged rooms (`LOGIC.rooms` `kind`): the hub, the landing, the walk and the antechamber
  are passages, the west store the one fight (`arW`, its keepers round its middle: the store's mark's `foes`), the rest
  puzzles; the Bell Porch is a room of its own past the chamber's north door, which sinks for the whistle in hand (`dP`, as the Rose House's `dk`; `porch`, the bell `e1` hung in its middle),
  the antechamber too (`ante`, between the far door `d4` and her hall). Each puzzle in the middle of its room: the east
  store's groove down its middle; the founders' bell (`RING.bell`) and its ball in the middle of the stair's floor, the
  landing a block round its north wall (`RING.landing`, the lift and the eye `s1` on its face); the Hall of Echoes' chasm
  across its middle, the ball's plate `p3` on the far lip in the ball's own room (it was the far side's, `echoesFar`: a
  ball rolled into another room). The great key's cage (`kB`) stands by the ledge's edge straight out from the founders'
  bell, which it waits on: in sight below it and under 20 m (the temple design audit's last step at 1.0, two rooms off and
  out of sight, is 1.5 now), the walk's mark in its doorway onto the ledge. Her hall is measured by her stones
  (`HallStones`, her element's id). Old saves: one that stood in the old rooms is taken to its last mark (`migrate.js`
  arzach2 v4, `arzach2.js` `RELAID`). Tests: `tests/temple-rules.test.js` (no rule broken), the on-foot walk in
  `tests/temples.test.js`, the play-through, door-bypass, way-back, ball-room, zfight.
- **The Builders' Greenhouse as shrines** (v1.77, issue #336). The Potting Hall 36 by 41 m, the Shade House, the Cold
  Frame, the Seed Vault and the Bud Passage 30 m square, the Vine Gulf 36 by 60, the Glass Stair and the Seed Chamber
  round halls 34 m across (the Glasshouse 40 as it was), every ceiling 18 m or more, doors 7 by 9 and the buds too
  (`edena.js` `ROOMS`, `DOOR`, `WING`, `VAULT`). The props, the climbs (the root-wall and both glasses 9 m), the vine
  bridge's chasm (22 m), every groove's length and every timing as they were. Tagged rooms (`LOGIC.rooms` `kind`): the
  Threshold, the landing, the vault's top, the antechamber and the way out are passages, the Shade House the one fight
  (`arW`, its keepers round its middle among four columns: its mark's `foes`), the rest puzzles; the Bud Passage is a room
  of its own (`bud`, past the Seed Chamber's north door, which sinks for the bloom in hand: `dS`, as the Belfry's `dP`;
  `ballB`, `pB`, `bud1` its own, the chamber keeps the bloom and its try `seed0`). Each puzzle in the middle of its room: the Potting Hall's eye `s1` on a pillar behind the benches (it was
  on the east wall), the Cold Frame's eyes on posts behind their seed trays (they were on its end walls), the Glass Stair's
  eye `s2` on the south face of the landing, a block from the root-wall's back up to the north door (it was high on the
  wall), passed by the disc on its way up; the Seed Vault's glass the face of a ledge 9 m deep out in the room
  (`VAULT.face`), its seeds and its ball's groove before it (they were by the east wall); the Bud Passage's ball over 20 m
  from its bud; the Vine Gulf's lips 16 m out from its walls (`ROOMS.gulf` `lip`, `far`, `glass`), the sun-ball and the
  seed on the near one, the seed-ball before the glass on the far one. The pots are solid as drawn (their rims stood over
  nothing). Old saves: one that stood in the old rooms is taken to its last mark (`migrate.js` edena v5, `runtime.js`
  relaid). Temple design audit: 4.11 before and after (the skeleton `XALBXCXXXXLK` → `XALBXCRXXXXLK`, 67 % → 62 % like the
  nearest; mean obviousness 3.38 → 3.44). Tests: `tests/temple-rules.test.js`,
  the on-foot walk and the old saves in `tests/temples.test.js`, the play-through, door-bypass, way-back, ball-room,
  pit-void, zfight, contact audit.


- **The Aerie as shrines** (v1.77, issue #336, the fifth house redone to the rules, after the Founders' Belfry and the Builders' Greenhouse). The Hall of Winds 30 by 66 m under 18
  (`HALL`): its stone's groove as long as it was (37.8 m, every push in the calms as it was), down the middle of the floor
  to the vent's throat, a grate short of the far wall (`pH`; it was in the corridor's mouth, through the hall's door), the
  vent's mouth over the far door, six rows of screens 9.4 m apart. The Wind Well a round hall 36 m across and 50 high
  (`WELL`), the raft by its east wall, the floor's second vent by the Moult's door 9 m off its middle; the Wing Chamber's
  round hall 26 m (`WING`, a chest's). The gulf vent's stone moved off the high balcony (against the well's wall) into a
  room of its own past it, the **Vent Hall** (`TOP`, 30 m square under 18, the `top` room's mark there now): its grate in
  the middle, a hood over it and a pipe along the roof to the vent's mouth over the gulf's door; the small key's door in
  its north wall. The balcony reaches out over the well to two metres from the column's edge (`BALCONY.depth` 11.4), so
  the glide off the column is as short as it was. The Moult and the Eyrie 30 m square (`STACK`), the Moult's middle under
  the vent's shaft, four columns to fight round, 18 m high; the Eyrie's ledge reaches out to 4 m short of the gap's vent
  (the gap, the column and the perch six metres over the ledge as they were), the stone's groove on it in the middle of the
  hall, the coffer's shelf by the door, the perch against the west wall on a buttress out of the dark. The Gulf 30 m
  across (`GULF.half`, its way back's passage outside it with it), every door 7 by 9 (`DOOR`), each of the Moult's, the
  small key's and the great key's in a hall's wall. The rooms are tagged: the Moult is the house's one fight, its keepers
  round its middle (`Mark` `foes`); the Gulf's lips are passages, the perch a puzzle. The Elder and her Roost, the story's
  lines, the circuit round the stack (down the vent's shaft, out by the Moult's door), the keys, every vent and every
  crossing as they were. Old saves: one that stood in the old rooms is taken to its last mark (`migrate.js` arzach v4).
  Rules broken: 35 before, none now. Temple design audit: 4.33 before and after (mean obviousness 3.08 both).
- **The Undertower as shrines** (v1.77, issue #336). Every hall 30 to 36 m across under 18 m of stone or more (the Hall of
  Dishes 36 by 52 over its cable pit, the Cable Store and the Tuning Room 30 square, the Choir 32 by 46, the Listening
  Passage 30 square, the Gallery of Voices 36 by 56), the Cable Well a round hall 34 m across, the Shell Chamber 28, the
  First Sign's Hall 40 as it was (`bazaar.js` `ROOMS`); doors 7 by 9 (`DOOR`), the great lock into the antechamber 6 by 9
  (`LOCK`: the antechamber is the camera QC's close room, and through a 7 m doorway its close camera read the room wide
  and was pulled in off the west wall in one frame, `tests/camera-qc-lock.test.js`). The props, the two pits (16 and
  20 m), the discs, the pillars and every groove's length as they were. Tagged rooms: the Threshold and the landing
  passages, the Shell Chamber the chest's alone, the Cable Store the one fight (`arW`, its keepers round its middle: the
  store's mark's `foes`, at the end of a cable tunnel under the Choir's floor), the rest puzzles. The Listening Passage is
  a room of its own (`listen`, the passage's horn `e0`, its ball and footstone in its middle) behind the chamber's north
  door, which sinks for the shell in hand (`dL`, as the Belfry's `dP`). Each puzzle in the middle of its room: the
  dishes on stone stands in the floor (they hung on the walls), the Tuning Room's ball down the middle of that room
  (`ballT`, it rolled in from the well: a ball through a door), the far door's horn `e2` and the far dish on a pier in
  the middle of the gallery's far landing (they were over the door), the Choir's horns, ball and key in the middle of
  its floor. A drum of cable lies across the Tuning Room between the key's cage and the stones, so the far horn's stone
  is found, not seen from the cage (the temple design audit's decoupling). The guardian's hall is measured by `SignFoot`
  (the dark ring and the cables at the First Sign's foot, its element's id). Old saves: one that stood in the old rooms
  is taken to its last mark (`migrate.js` bazaar v5). Tests: `tests/temple-rules.test.js` (no rule broken), the on-foot
  walk and the old save in `tests/temples.test.js`, camera-qc-lock, the play-through, door-bypass, way-back, zfight.
- **The Mooring-House as shrines** (v1.77, issue #336). The Capstan Hall a round hall 36 m across under 28 m (`R1`, so
  the balcony at the Gallery's height, 11 m, still has 17 over it), the Winch Room, the Lamp Shaft and the Cord Loft 34 m
  across 40 m out along the hall's radials (`WING`, `LOFT`), the Drift 48 by 30 (`DRIFT`), the Balance 32 by 36
  (`BALANCE`), the Rope Store 30 m square under 16.6 (`STORE`, its roof over the Balance's wall top), doors 7 by 9
  (`DOOR`), doorways a little narrower than their passages (`HOLE`, `PASS`: no face shared). The props, every groove's
  length (the winch's 11 m, the Drift's 10.2, the Balance's 10.5, the balcony's 4.5, so `PERCH.plateAt` stays 0.167), the
  Drift's gap (17.6 m) and its far landing's 6 m, the 10 m between the Balance's landings, the pan, the updrafts, the
  Capstan Floor and the Anchor-Warden as they were. Each puzzle in the middle of its room: the counterweight's groove down
  the Winch Room's middle to its socket; the lamp-eye on top of a pier beside the shaft's draught (`SHAFT_PIER`: the top's
  lip 2.5 m from the draught's middle, as the balcony's was; the eye 3 m in from every edge, so the top hides it from the
  floor); the Mooring Passage folded into the Cord Loft, its ring `r1` hung over the loft's floor on a chain to the Drift's
  door, the try `t0` on a post by the chest; the Drift's cable-rail out from the middle of a wider near landing; the
  Gallery's ring `r5` on a davit over the landing, still 14 m from the north lip (out of the tether's reach); the
  balcony 10 m deep, its cable-rail out from its lip toward the capstan (`PERCH`), the cradle beside it; the moorers'
  weight on a mast in the hall (`CLEAT.mast`). The moorers' corridor runs along x from the Gallery to the hall's wall
  (`MOOR`, `MOOR_A` where it meets it). Tagged rooms: the stage, the far landing, the ante and the way out passages, the
  Rope Store the one fight (its keepers round its middle among four drums of cable, solid with their cable), the rest
  puzzles; the Capstan Floor is measured by its two doors (`d6`, `d7` carry `room: 'arena'`). Old saves: one that stood in
  the old rooms is taken to its last mark (`migrate.js` spacecity v3, `relaid`). Rules broken 54 → 0; temple design
  audit 4.22 before and after (mean obviousness 3.38 → 3.31); its z-fights 3 → 0.
- **The Whale-House as shrines** (v1.77, issue #336, the eighth house redone to the rules). The Sounding Hall 48 by 36 m
  under 20 (`ROOMS.hall`), its wings 30 m square under 18 (`ROOMS.wing`), the Horn Store 30 m square (`STORE`, a short
  passage from the hall's south door), the Horn Chamber a round hall 34 m across (`ROOMS.horn`), the Tank Hall 40 by 30
  under 22 with the glass, the tank and the shelf down its middle (`ROOMS.tank`), the keepers' landing behind the
  keepers' door a hall 30 m square under 20 (`ROOMS.landing`, the gallery's room: its mark the first), the Gallery of
  Horns over the shelf; the Throat 7 m wide down to a floor 24 m under the house (`AY`: the Listener's Hall 18 m high
  under the rooms over it), the antechamber a passage (`K.corridor`). Every door 7 by 9 (`DOOR`). Each puzzle in the
  middle of its room: the hall's ball rolls into the cradle at the foot of a pillar whose eye, lidded till then, opens the
  west door (`eD`, `d1`); the Pool Room's ball (once rolled out through its door and across the hall, `b2`) rolls across
  the dry half into a cradle by the glass, which opens the east door across the hall (`d2`, the house says so:
  `onUpdate`); the pool's eye on a pillar out in the water, the shell's on a pillar before the great shell; the passage
  horn (`e4`) in the Horn Chamber by its north door, the Song Passage's door at the passage's far end as long a run as it
  was; the tank's ball and dish in the middle of the floor; the landing's ball and dish in its south-west quarter, under
  20 m from the Listener's Door, and its eye a horn now (`eK` needs the horn: the landing is a puzzle room after the chest
  and asks for it); the ear that opens the Listener's Door high on a column of its own before the door (`eL`, its room the
  hall's), its dish's twin beside it. The dishes and horns standing on the floor are solid as drawn (`dishSolid`,
  `earSolid`), and the whorls by the walls all their chambers. The rooms are tagged: the Horn Store is the house's one
  fight, its keepers round its middle among four columns (`Mark` `foes`). The Listener and its fight, the story's lines,
  the small key and its arena, every horn's hold and every climb as they were. Old saves: one that stood in the old rooms
  is taken to its last mark (`migrate.js` underwater v3). Rules broken: 52 before, none now. Temple design audit: 4.44
  before and after (5 5 5 4 5 5 4 3 4; the skeleton `BXXCLBXXK` → `XBXCLGXXK`, mean obviousness 2.86 → 2.71).
- **The Casting-House as shrines** (v1.77, issue #336, after the Mooring-House). The Pouring Floor a round hall 36 m across under
  22 (`FZ`, `FR`), the Mould Room 34 m square under 18 (`MX`, `MW`, `MD`), the Sand Room 30 m square under 18 (`SAND`),
  the Tong Chamber a round hall 34 m across (`TR`), the Casting Furnace 46 by 36 m (`FX0`, `FX1`, `FD`, its channel 10 m
  wide down its middle), the Weighing Hall 34 by 42 under 22 (`WX0`…`WZ1`), the Last Casting as it was (40 m); every
  door 7 by 9 (`DOOR`), each doorway closed by a short `corridor`. The upper floor (the Crucible Stair's landing, the
  chamber, the furnace's lips, the Weighing Hall's gallery) is 11 m up now (`UP`, it was 9), so the cold passage under
  the furnace is as tall as its doors. Each puzzle in the middle of its room: the stone moon for the great mould lies in
  the Mould Room and rolls across it (it was rolled in from the Pouring Floor through the doorway: `m1` room `moulds`),
  the seam-eye on a post beside the mould, the hoist's pan on a dais in the middle (it was a shelf on the north wall);
  the founders' moon's rail, its flame and the great cradle down the floor's middle, the cradle before the Founders' Door
  (it stood in the door's mouth); the test scale off the wall. The Pincer Passage is folded into the Tong Chamber: the
  east door into the furnace is chained to a cradle out on the chamber's floor (`mP`, `pP`); the hot moon's rail runs
  along the furnace's near lip, its flame and its hooded mould as far along it as they were (`mH` room `furnace`, no
  `gap`: it was rolled from the passage under the shut door). The Weighing Hall's pan stands at the end of a pier out
  from the gallery over the middle of the hall (`mB` starts on the pier: it was rolled in from the furnace's far
  landing), its eye on an iron post in the hall (it was over the keepers' door). The rooms are tagged: the Sand Room is
  the house's one fight, its keepers round its middle among the bins (`Mark` `foes`); the Crucible Stair, the far lip
  and the cold passage are passages. The Last Founder and its fight, the story's lines, the small key and the Founders'
  Door, the founders' moon's and the hot moon's rails (their flames and their moulds as far along them), the hoist, the press
  and the way back as they were. Old saves: one that stood in the old
  rooms is taken to its last mark (`migrate.js` moonfoundry v3). Rules broken: 51 before, none now. Temple design audit:
  4.44 before and after (mean obviousness 2.58 both). Z-fights in the house 20 → 0.
- **The Lamp-House as shrines** (v1.77, issue #336). The Hall of Dark Pools 36 by 40 m under 26, the Root Stair 37 by
  46 over its dark pool (its near floor 20 m deep, the pool 10, the root-wall the rest, its top 9 m up), the Kennel 30 m
  square, the Dark Gallery 36 by 56 over its chasm (20 m, the moss-stones as long as they were), the Wick Room 30 by 40,
  the Lantern Chamber a round hall 34 m across; every ceiling 16 m or more over the floor, doors 7 by 9 and the Wick
  Room's grille too (`perdide2.js` `ROOMS`, `DOOR`, `KENNEL`, `WICK`, `ROOT_WAY`). The pools, the orbs, the niches,
  every groove's length and every orb's glow as they were. Tagged rooms (`LOGIC.rooms` `kind`): the Threshold, the
  alcove behind the grille and the way out passages, the Kennel the one fight (`arK`, its keepers round its middle among
  four columns: its mark's `foes`), the rest puzzles; the Lantern Chamber is one (the chest in its middle, the try `l0`
  by the dais and the Lamp Passage's lamp `l1` beside the way north, both on posts; the passage is the corridor through
  its north wall to the gallery's door `d2`). (A room of its own past a door for the lantern in hand, as the Belfry's
  porch, cost the house's design score a step: the chest at 29 % of the steps and a skeleton 67 % like the Footprint's,
  4.0.) Each puzzle in the middle of its room: the third pool `s3` on a loft of roots out from the west wall, 4.3 m back
  from its edge so the floor never sees it; the pool-orb `orb5`, its small pool `s5` and its socket on the Root Stair's
  near floor (the orb rolled through the hall's door to the socket before: `door_thread`); the Dark Gallery's hidden eye
  `s4` on a post over the near floor (on the wall over the way in before) and the far door's niche on the far floor (in
  the west wall); the Wick Room's niches and the great key in the **wick-house** in the middle of its floor (`WICK.face`:
  two blocks either side of the key's alcove, a niche in each block's face, the orbs' grooves before them; the niches
  were in the east wall). The ledge of roots runs along the Root Stair's east wall over the pool to the keepers' door
  (`ROOT_WAY`). The Root Stair is half a metre wider each side than the Hall of Dark Pools: as wide, their side walls lay
  one in the other through the wall between them (two z-fights). The Lamp-Room is measured by its lure pools (`LurePools`
  carries the guardian's id). The Lampless and its fight, the story's lines, the small key and the great one, the loop
  back up through the keepers' door as they were. Old saves: one that stood in the old rooms is taken to its last mark
  (`migrate.js` perdide2 v4). Rules broken: 51 before, none now. Temple design audit: 4.22 before, 4.33 after
  (decoupling 5 → 4: the orb's step in its own room now; the curve 3 → 5; mean obviousness 2.83 → 3.08). Tests:
  `tests/temple-rules.test.js`, the on-foot walk and the old save in `tests/temples.test.js`, zfight, contact audit.
- **The Hush-House as shrines** (v1.77, issue #336, the last house). The Threshold 30 m square, the Choir 36 by 54 under
  27, the Bog Well a round hall 36 m across (its near landing and its root-wall's face as far from its middle as they
  were, so the disc's ride is as long), the Stilling Chamber 34 m round, the Snapping Passage 30 m square,
  the Pendulum Gallery 36 by 48 (the chasm, the bridge and the pendulums as they were), the Nursery 30 m square; every
  ceiling 18 m or more over its floor, doors 7 by 9 and the gate of jaws too (`perdide.js` `UP`, `DOOR`, `ROOMS`). The
  upper floor stays at 9 m (`UP`): the balcony's way no longer runs over the Choir's door, so its 9 m clears. Tagged rooms
  (`LOGIC.rooms` `kind`): the far landing and the way out passages, the Nursery the one fight (`arN`, its keepers round
  its middle among four seed-beds: its mark's `foes`), the rest puzzles. The Stilling Chamber is one (the chest in its
  middle, and the Snapping Passage beyond its open way still its room in the logic, its three mouths `j1`..`j3`, so it is
  34 m round; a room of its own past a door for the stilling mode in hand, as the Undertower's Listening Passage, cost
  the house's design score a step: the chest at 29 % of the steps, 4.22). Each side mouth stands in a **shrine** out on
  the passage's floor (`SHRINE`: a block of stone either side of the
  way to the gate, the mouth in a niche of its face, its crown's crystal on its cap; in the passage's walls before). The
  door's crystal `c1` stands out on the Threshold's floor and the Choir's three in its middle. The way to the great key:
  a **ledge** along the Bog Well's west wall from the root-wall's top (`LEDGE`) to the well's west door (`dL`, the small
  key's; it stood on a ledge round the well over the water before, a cloister past it, issue #356), then a **walk** south
  outside the Choir's west wall (`WALK`, a hall 9 m wide at 9 m) and in through the wall onto the **balcony**, a gallery
  down the Choir's west side on three piers (`BALCONY`: it lay over the Choir's door at its north end before). Its groove
  runs down the balcony's middle through the snapper's mouth in the wall across it (`dJ`, a `bridge` since: a gate in the
  room's middle, not a door between rooms, so the ball's `gap` is no thread through a doorway) to the cage's footstone,
  as long as it was (16 m; the mouth 12.5 m along it), its hold as it was. The keeper's ledge along the gallery's east wall
  is 7.4 m wide for its 7 by 9 gate (`KEEPER`). The Mother's hall is measured by its two doors (`d3`, `d5` carry `room:
  'hall'`). The Mother and her fight, the story's lines, the keys, every crystal's order, the pendulums' beat, the
  disc's ride and the climbs as they were. Old saves: one that stood in the old rooms is taken to its last mark
  (`migrate.js` perdide v3). Rules broken: 36 before, none now. Temple design audit: 4.33 before and after (mean
  obviousness 3.08 → 2.83: the passage's middling mouth out of the gate's sight behind its shrine). Z-fights in the house
  9 → 2. Tests: `tests/temple-rules.test.js`, the on-foot walk and the old save in `tests/temples.test.js`, zfight,
  contact audit, door-bypass.

- **The Clock-House as shrines** (v1.77, issue #336). The Escapement and its far landing one hall 32 by 59 m under 22
  (`ESC`: the pit 22 m long as it was, the disc's ride as it was), the Winding Well a round hall 36 m across (`WELL`, the
  climb's face 8 m north of its middle, 10 m high: `UP`, the upper house's floor, a metre higher so the Pendulum Hall's
  way out clears the way in under it), the Pendulum Hall, the Striking Room, the Mainspring Room and the Winding Passage
  30 m square (`WING`, `MAINSPRING`, `WIND`), the Coil Chamber 26 m round (`COIL`), the Clock Gallery 36 by 34
  (`GALLERY`: the chasm, the bridge and the great pendulum's beat as they were, `GALLERY_BEAT.pivot` `UP + 16`), doors 7
  by 9 (`DOOR`; the Cupboard a passage 12 m square under 10). Each puzzle in the middle of its room: the escapement's dial
  and its three eyes on a tower out in the pit beside the disc's way (`DIAL`); the counterweight's groove up the landing's
  east side to its socket there (`LANDING.ball`: it ran on through the well's doorway, so the plate `p1` is the landing's
  now, a room and out of sight from the door it opens); the Clockmaker's clock a tall case standing on the landing
  (`LANDING.clock`: its dial was over the Cupboard's door); the hour track down the Striking Room's middle, each plate's
  clock on a post, the striking eye on an obelisk; the mainspring and its six eyes on a stele in the middle of its room
  (`MAINSPRING.stele`), its weight's groove from the way in; the Winding Passage a room of its own past the chamber's north
  door (`dP`, the coil in hand: every room after the chest asks for it), its six eyes round the makers' great escape
  wheel on a stele in the middle; the gallery's great clock and its six eyes hung on rods from the roof over the bridge's
  far end (`GALLERY.clock`: it was on the far wall). Tagged rooms: the Threshold, the far side of the gallery, the
  Cupboard and the way out passages, the Coil Chamber the chest's, the Pendulum Hall the one fight (its keepers round its
  middle among four columns), the rest puzzles; the Foreman's Workshop is measured by its two doors (`d4`, `d5` carry
  `room: 'hall'`). Old saves: one that stood in the old rooms is taken to its last mark (`migrate.js` garage v3,
  `relaid`); `dP` opens for the coil, so a save past the chest finds it open. Rules broken 49 → 0; temple design audit
  4.22 before and after (decoupling 4 → 5: the counterweight a room from its door; curve 4 → 3: the north door's step,
  the simplest, comes mid-way).
- **The Engine-House as shrines** (v1.77, issue #336). The Piston Hall 32 by 36 m under 20 (`PH`, its gantry 7 m up along
  the north wall), the Crank Hall 32 by 36 under 18 (`CRANK`, the pit across it wall to wall), the Fourth Chamber a round
  hall 34 m across (`CHAMBER`), the Boiler Room and the Governor Room 30 m square under 18 (`WING`), the Crank Passage a
  room of its own 30 m square behind the chamber's north shutter, a third piece of `dS` (`PASSAGE`, logic room `crank`), the Furnace 34 by 58 with an
  18 m near lip and a 20 m far lip either side of the 20 m chasm (`FURNACE`), the Tooth-Warden's hall as it was (`HALL`,
  r 20) past a corridor antechamber; every door 7 by 9 (`DOOR`), each doorway joined by a short `corridor`. The pistons'
  heights and steps, the walkway (6.4 m), the bridge (20.2 m), every groove's length and the stroke as they were. Each
  puzzle in the middle of its room: the valve's eye `s1` on a post out in the Piston Hall by the way in (it was on the
  south wall); the hammer's ball `ballJ` on the Crank Hall's near landing, its 11 m groove down the floor into the crank
  (it lay on the Piston Hall's gantry and was rolled through the corridor), the crank wheel at the groove's end behind an
  iron casing (`CRANK.casing`) that hides its notch from the walkway; the chamber's four eyes `k0` on iron posts round the
  chest, two either side of the way to each shutter; the Crank Passage's pistons, parapet, crank and ball across its
  middle (they flanked its door); the Governor Room's anvil (in an iron frame for its hammer), groove and pistons' parapet
  round the middle of its floor; the Furnace's two balls and cranks out on the deeper near lip, its pistons 6.4 m past the
  far lip's edge as before. Tagged rooms: the Threshold, the shutters' way, the far landing and the way out passages, the
  Boiler Room the one fight (its keepers round its middle among four cold boilers, `Mark` `foes`), the rest puzzles; the
  Crank Passage's mark is placed after the wings' so the machines' ids by mark stay as they were. Old saves: one that stood
  in the old rooms is taken to its last mark (`migrate.js` buried v3, `relaid`). Rules broken 41 → 0; temple design audit
  4.33 → 4.56 (non-obvious 3 → 4, mean obviousness 3.33 → 3.08: the hammer's ball hidden behind the casing, the Crank
  Passage's ball behind its parapet from the door; curve 4 → 5; skeleton `XBCGXALXLK`, 70 % like the Casting-House
  as before); its z-fights 0 → 0.
- **The Footprint as shrines** (v1.77, issue #336). The Hall of Spheres 32 by 40 m under 18 (`ROOMS.spheres`), the Still
  Pool 32 m square over its pool (its near ledge 8 m deep, the pool 19.2 long as it was, `ROOMS.pool`), the Lens Chamber
  a round hall 34 m across (`ROOMS.lens`), the Hall of the Unseen 32 by 40 over its 20 m chasm (`ROOMS.unseen`: the near
  ledge 6 m, the far landing 14), the Keepers' Gallery a hall 30 by 66 m east of both (`ROOMS.gallery`: a passage built
  wall by wall on the west before; east now, since the white hill's tree stands under the west side and `tests/spheres.test.js`
  reaches its canopy from the sky), the Keepers' Lodge 30 m square (`ROOMS.lodge`, `LODGE`); every ceiling 18 m over its floor,
  every door 7 by 9 (`DOOR`), short passages between the halls (`K.corridor`). Each puzzle in the middle of its room:
  the Hall of Spheres' groove down its middle and its three prints to stand on in a row beside it (by the east wall
  before), the groove as long as it was; the stilling stone at the near ledge's edge, now 8 m out into the room
  (`POOL`: the stone, the sphere and the edge as far apart as they were, issue #311); the mural on a stele beside the
  chest (on the chamber's wall before); the far landing's eye (`s2`) on a pillar rising out of the chasm by the near lip,
  its face toward the far landing, so from the near ledge you see its back (high on the near wall before, and in the
  Lens Chamber's room: now the far landing's, so that room asks for the lens too); the gallery's eye (`ssc`) on a post
  9 m before the keepers' door, facing it. The rooms are tagged: the Lodge is the house's one fight, its keepers round
  its middle among four columns (`Mark` `foes`); no machine by a puzzle any more (there was one by five marks: the hall's, the pool's, the chamber's, the chasm's and the antechamber's). The
  Echo's Hall is measured by its two doors (`d4`, `d5` carry `room: 'hall'`). The Lens Chamber has 32 stones, not 28
  (with 28 a porthole lay 2 cm from a stone by the keepers' door: a z-fight). The Echo and its fight, the story's lines,
  the small key, every groove's length, the stones' rows and the shortcut back as they were. Old saves: one that stood
  in the old rooms is taken to its last mark (`migrate.js` spheres v3). Rules broken: 36 before (both 3, size 5, ceiling
  4, unmeasured 2, door 5, centred 12, foes 3, gadget 2), none now. Temple design audit: 4.33 before and after (5 5 5 4
  5 5 4 3 3; the skeleton `XXCRRLK` as it was, mean obviousness 2.9 → 3.0).
- **The Footprint across four floors** (v1.82, issue #401; the plan: `docs/design/temple-best-practices.md` part 4). The
  author: "1 temple should have more verticality, like be on multiple levels so that the non linear path is not just
  about the horizontal layout". The house goes down: four floors 18 m apart (`WELL.floors`: F0 the rim, F1, F2, F3 the
  heel's floor) round the **Heel Well**, one round wall 40 m across from the heel's floor to over the rim, open to the sky
  (`K.rotunda` with `well: true`: its balconies are rooms, measured by the rules as one round space), a balcony on every
  floor (`ringShape`, `slabOf`: a ring 6 m wide, drawn with 128 sides and solid with 48; F1's east arc cut off by two
  gaps). Toes off the well, stacked where a hole or a floor demands it (`ROOMS`): F0 the Threshold, the Hall of Spheres
  (west), the Keepers' Lodge (east); F1 the Still Pool (north, its 6 m pool over the Echo's Hall) and the Sounding Toe
  (east, over the Hall of the Unseen); F2 the Lens Chamber (west, under the Hall of Spheres), the Hall of the Unseen and
  its vault (east); F3 the great door, the antechamber and the Echo's Hall (north). From the rim's edge the great door is
  in sight at the bottom on the way in (`tests/footprint-floors.test.js`, a ray beside the pier). The pieces:
  - **Drops** (`Catch`): three, each into a pool: an `Iris` in the rim's floor over F1's pool (`d1`: the Hall of Spheres'
    answer opens it, where the hall's door used to), an open hole through the rim and F1's balcony over F2's pool, and
    the well itself over the heel's pool. Over a pool, falling faster than `CATCH.slow`, its water takes the fall in the
    last metres (a wade's speed: nothing hurt, a splash); it slows the fall a few frames before the water, so it works
    whichever runs first, the house or the traveller (in the game the boxes' effects set `fallGuard` every frame, so a
    guard would not hold). Off a balcony's edge where no pool waits: a hard landing, as anywhere.
  - **The great lift** (`GreatLift`, `LiftSphere`): a disc in the well's middle with the great sphere on it, between the
    rim and F2 (`LIFT`), its rails of light from top to bottom. Stepped on, after 0.9 s it carries you to the other floor
    (stay on and it stays); its plate on the other floor's pier (`pUp`, `pDown`) calls it. Its element is a drum with two
    stops, `pUp` (t 0) and `pDown` (t 1), `roll: 'hand'`: the house's one state, seen from every balcony. Up: F1's two
    bridges stand (`bW`, two `Bridge`s, one element) and the Lodge's door can open; down: the third lamp of the Unseen's
    far door. Leaving, its sphere is off both plates (t 0.1 or 0.9), so what waits for it shuts at once; saved half-way, it
    finishes the trip. A pool on its disc too (a fall onto it from the rim).
  - **The Sounding Toe** (`SOUNDING`): a sphere in a groove whose end is an iris over a round hole in the floor (`hT`,
    open while you stand on the walker's print among a two- and a four-toed one: `pH`). Pushed from the print, it rolls
    to the end (friction 0.25: one push carries it) and drops through onto the plate in the Hall of the Unseen below
    (`pT`), and the Unseen's door opens (`dT`). `Ball` `hole: { gate, to, stand }`: at its groove's end with the gate
    open it falls (`startHole`, `throughHole`) and lies at `to` for good, its t 1 meaning fallen; up on its groove it is
    never saved past `HOLE_REST` (0.93), so a ball resting on the shut hatch is not on the plate below. The rules let a
    `through` drum's plate be another room's (`scripts/temple-design/rules.mjs`: the author's ruling, a hole is not a
    door, and nor is the lift's shaft).
  - **The spiral** (`Spiral`, `SPIRAL`): 80 stones only the lens shows, two turns round the well's middle from F2 to
    the rim, each 0.45 m over the last (a step, never a jump), a landing onto each balcony. Revealed once the lens has
    looked at the well's middle; then solid (one collider). It is the way up that leaves the great sphere where it is,
    and the Lodge's eye (`sL`, under the rim's pier, facing the spiral's second turn) is seen from it: its room is
    `helix`, a puzzle room after the chest.
  - **The last lift** (`Platform`, always running) from F2's balcony down to the heel's floor, south: the way back up
    from a fall into the well.
  The steps: the Hall of Spheres (the sphere on the walker's print, you on the walker's print) opens the first drop; on
  F1, in either order, the Sounding Toe (over the bridges while the great sphere is up) and the Still Pool (its berth
  raises the stones to a coffer on the far ledge, `cF`, and opens the Lens Chamber, `dL`); down to F2 by the second drop
  or the lift; the lens; raised over the well, the spiral; the Hall of the Unseen's stones, the far landing's hidden print
  and its eye; up the spiral to the Lodge's eye; the Lodge (its door: the eye and the great sphere up) and its small key;
  down with the great sphere; the far door (the small key, the eye, the print, the great sphere down) and the vault's
  great key; the last lift; the great door (`dG`, the arena's door now) and the Echo, whose three resonant spheres stand
  on galleries 6 m up round its hall. Eleven steps a player takes (the design audit counts ten locks, was five; mean
  obviousness 3.0 → 1.8; score 4.33 as before). The logic:
  `solve()` tries two balls at once when nothing else is left (the far door wants the great sphere down and the sphere on
  the print, neither alone opens it), and the marker (`logic.next`) asks for a ball's stop only if it opens something or
  shuts nothing (`worthMove`: never the great sphere down while it only lights one lamp and sinks F1's bridges), the lift
  last in the list, so it is called only when nothing else is left. Tests: `tests/footprint-floors.test.js` (every drop
  fallen, the spiral climbed stone by stone, both lifts ridden, the whole house on foot with a real traveller),
  `tests/temple-playthrough.test.js` (the lift called from its plates, the Sounding Toe's sphere pushed from its print),
  the solver's, the rules' (none broken), the way back's, z-fights 2 → 0. Old saves: past the old far door, the new
  doors as done and the great key in the great door (`migrate.js` spheres v4); one that stood in the old rooms, to its
  last mark.
- **The Footprint made readable** (v1.85, issue #477; `docs/audits/temple-design-v1.85.md`: seven of its ten steps at
  1.5 or under). Played through, the lens's reveal did not read from its locks: the spiral showed only to a lens raised
  into the well's middle (its one point, 18 m over F2, out of a level look's cone), and the murals that said which stones
  hold were two rooms and 50–93 m back. The puzzles are as they were; the cues moved to the locks:
  - **The walker's trail** (`trail`, a `Mural` with `wall: false`, `trailPrints()`, `TRAIL`): through the lens, prints on
    from the Lens Chamber's floor out of its door and round F2's balcony (r 16.8, stepping over the second drop's pool) to
    the spiral's foot, the last two turned to the well. The spiral's clue (`clue: 'trail'`, room `bal2`).
  - **The spiral seen from where you stand** (`Spiral.lookAt`): its middle, its two landings and the stones a quarter and
    three quarters up, so a lens raised at the trail's end, or from the rim looking down, shows it.
  - **The print again by the chasm** (`hold`, a small `Mural` on the Hall of the Unseen's near wall): the stones' clue in
    their own room (`br1`'s `clue: 'hold'`).
  - **The first drop in sight of its puzzle** (`AT.dropA` -120° → -82°): the rim's iris now opens just outside the Hall
    of Spheres' door, seen through it; F1's pool under it moved with it.
  The rules' "pieces in the middle" leaves a clue out (it is read where it is drawn, not worked: `rules.mjs`). Audit:
  mean obviousness 1.8 → 2.55, steps at 1.5 or under 7 → 4 (`dT`, `dL`, `dR`, `d4`: keys a floor or more away, the
  house's structure), non-obvious 3 (capped while more than one step is obscure), the curve 5 → 4 (the reveals' measured
  difficulty was their clues' distance: 4.25 → 2.25 for the chasm), the score 4.33 → 4.22.
- **The Aerie round a great hall** (v1.83, issue #407; the approved best practices, `docs/design/temple-best-practices.md`
  G4 and G6 and its Aerie row). The Wind Well is the house's great hall: 62 m across where it was 36 (`WELL.r` 31), its
  three floors seen at once: the floor (the hub), the **Feather Gallery**, a ring 7 m wide round the wall 16 m up
  (`WELL.gallery`, `annulus`, in the house's map as a `ring` chart note), and the high balcony at 32, now a pier 21 m
  out on a wedge (`BALCONY.depth`). A **Long Passage**, 38 m and 7 wide (`PASSAGE`), joins the Hall of Winds to it. The
  raft rises beside the gallery's inner edge; the Wing Chamber opens off the gallery behind a shutter (`dW`). The stack's
  rooms (the Moult, the Eyrie, the perch) moved west with the wall (`SHIFT`, 13 m); everything else is where it was
  from its room. The pieces:
  - **The Fledgery** (`FLEDGE`, room `fledge`, south off the gallery over the passage): a stone (`bD`) in a groove ending
    at a square hole in its floor; rolled in, it drops down a tube onto the grate in the passage's floor (`pD`, `Ball`
    `hole` with no gate element: always open; the drum `through: 'hole'`), the grate's breath stops, and the shutter lifts
    (its lamp). One more step before the wings: the chest at 29 % of the steps (it was 17 %). A fall down the hole is
    the Fledgery's pit (back to its mark). The house's map chest moved here, early (`house-map.test.js`: the first third).
  - **The Fledging Sill** (`SILL`, G6): between two tall feathers on the gallery, a marked drop to the well's floor onto
    the makers' breath (`Cushion`, the Footprint's `Catch` done with wind: over it, falling faster than `SILL.slow`, the
    fall is slowed in its last metres; a rush, nothing hurt), an always-on soft updraft over a grate. The logic's
    `gallery → well` one-way link.
  - **The look down onto the Moult**: the Eyrie's vent shaft (`STACK.chute`) is a well 9.2 m across (it was 6.8), its rim
    lit, at the foot of the ledge's edge; the Moult's key cage moved under it. From the ledge you see the Moult's floor and
    its key before you go in.
  - The guardian's checkpoint: the antechamber's mark by the great door, as before. The gallery has a mark of its own.
  Audit: 6 → 7 steps, skeleton `BCXAXLXXXLK` → `BBCXAXLXXXLK`, mean obviousness 3.08 → 3.0, decoupled 4 → 5, loops
  2 → 3, the scores 4.56 before and after; rules broken: none before or after. Old saves: with the wings or anything
  after, the Fledgery's stone dropped (`migrate.js` arzach v5); one that stood in the old rooms, to its last mark (a
  spent `relaid`, null, is set again by a later version: `migrateTempleLayouts`). Tests: `tests/temples.test.js` (the
  logic, the migration, the house on foot with the Fledgery and the sill), `temple-playthrough` (the stone rolled for
  real), `house-map`, `temple-maps`, `ball-room`, `way-back`, `zfight`.
- **The Builders' Greenhouse round the Palm House, the builders' water its state** (v1.83, issue #411; the approved best
  practices, `docs/design/temple-best-practices.md` G1, G2, G4, G6 and its Greenhouse row). The Potting Hall and the
  Glass Stair are one great hall, the **Palm House** (`ROOMS.potting`), 36 by 78.4 m, its walls 34 m under a vault of
  greenhouse glass on white ribs. Its **gallery** (`GALLERY`, room `landing`) runs 18 m up round three sides on columns,
  with a **bridge** across the middle between its arms, open over the floor: both floors seen at once, the hub of both.
  The room ids `potting` and `landing` are kept (a save's last mark holds); `stair` is gone.
  - **The water** (G1, `SLUICE`, `HIGH` / `LOW`): a drum of two stops, `wHigh` (t 1, the start: up in the high troughs,
    the gallery's and the upper rooms') and `wLow` (let down into the low channels, the floor's and the wings'),
    `roll: 'hand'`, `verb: 'sluice'`, set from `rooms` (logic.js, issue #408). `Sluice` keeps it: a wheel turned moves it
    at once for the logic, and the water runs `SLUICE.run` (3 s) for the eye (`Sluice.k`). **Cheap to change:** a
    `SluiceWheel` (a valve wheel on a white post, the use button: "send the water up" / "let the water down") by the
    floor's hub, on the gallery's north band and in the Bud Passage, where the upper floor first wants the water up.
    **Readable everywhere:** a `WaterGauge` (a cage of trim round a column of water standing in its upper or lower bulb)
    in every room but the guardian's, one on every wheel; `Trough`s that brim or lie dry (the bridge's and the upper
    rooms' high, the floor's rill and the vault's channel low); a `Fall` from the bridge's spout into the cistern while the
    water is down. All share one water material.
  - **What it does:** up, the bud, the Vine Gulf's near seed and the bridge's vine seed can grow; down, the Seed Vault's
    seed can, and the Cold Frame's disc rides (`WaterLift`, a `Platform` that sinks to the floor when its column drains).
    The disc is the way up (`lift`, latched for the logic: once ridden the way up is always one wheel away), so the water
    is set down, up and down again on the way. A seed or a bud that fails says what it lacks, the sun or the water
    (`why` on `Seed`, `Bud` and a seed-ball, pieces.js: the text under that key).
  - **The floor** (the hub): the ball's louvre wakes the eye over the potting benches, which opens the **Cold Frame**'s
    door (`dE`, its lamp). The Shade House west (the arena, a small key, the Seed Vault's door); the Cold Frame east (one
    ball, two eyes, a small key) with the disc in its south-west corner, up to a landing and a door onto the gallery's east
    arm (`FRAME_LIFT`).
  - **The bridge:** one ball, two plates, two louvres: east, the sun on the eye on its post (`s2`), which the Seed
    Chamber's door wants with both small keys (`d1`, the old Glass Stair's door); west, on the **vine that stays**' seed
    (`seedS`, `VINE`): grown with the water up, its vine comes down the glass of a pier under the bridge's north edge
    (`Glass` with `down`) and stays, a climb back up from the floor for good (`vineS`, latched; a shortcut: `shortcut` on
    the element, the Temple maps page says so).
  - **G6:** the east arm's `drop` has no parapet; under it the **cistern** (`BASIN`, `Basin`: the Footprint's `Catch`
    over a long pool) takes the fall, a splash, nothing hurt. The Seed Vault's ledge has a window in the Palm House's west
    wall, a 9 m drop back to the hub (a one-way link). The guardian's checkpoint: the antechamber's mark (`ante` a
    checkpoint now).
  - **G2, the late step with an older tool:** the Seed Vault's louvre is turned by a stone `Weight` lying high on the
    ledge's lip over the glass (`wV`, `needs: ['hook']`): the grappling hook pulls it down into your hands, set on its
    plate (`pVw`) the sun swings onto the seed (`sdA`, `weightOn`), and with the water down the bloom grows the vine up to
    the great key. One seed where there were two and a ball.
  - **The skippable steps** (the Temple maps page found five): the four beds are the guardian's first phase (`requires`
    on the Gardener, so the solver blooms them in the fight); the chamber's seed is a try (`try`), the house's map a reward,
    the vine that stays a shortcut, each listed with its reason. The disc no longer rides on a ball beside it (the v1.74
    audit's edit 3). The chamber's north door still sinks for the bloom in hand: every room past the chest wants it.
  Audit: 9 → 10 steps, skeleton `XALBXCRXXXXLK` → `XXABLCXRXXXXLK`, combinations 7 of 9 → 8 of 10, mean obviousness
  3.44 → 2.75 (painfully obvious 1 → 0), decoupled 3 → 7, loops 1 → 3, the score 4.11 → 4.33 (non-obvious 3 → 4,
  decoupling 4 → 5, curve 3 → 4, identity 3 → 2: 71 % like the Undertower); rules broken: none before or after. The
  audit's own changes, all additive (`scripts/temple-design/lib.mjs`): a house state set elsewhere counts from its nearest
  setter, and a gauge of it in the lock's room (a piece with `shows`) puts it in sight; a weight wanted by a `when`
  (`weightOn`) is a key, its verbs the carry and its `needs`. Old saves (`migrate.js` edena v6): past the eye, the Cold
  Frame's door open; past the old stair's door, the bridge's eye woken; past the vault, its weight on its plate; one that
  stood inside, to its last mark. Tests: `tests/greenhouse-water.test.js` (the house on foot: every wheel turned with the
  use button, the disc ridden, the drop into the cistern, the weight hooked down and carried, both vines climbed, the
  window's drop, the Gardener calmed; the water's look), `temples.test.js` (the logic, the migration),
  `temple-playthrough`, `temple-maps`, `house-map`, `temple-rules`, `way-back`, `zfight`.
- **The Builders' Greenhouse's shape: the gadget first** (v1.86, issue #477; shape 1 of the four proposed on the issue,
  the Givers' House's: the Greenhouse read 69 % like the Undertower, both opening with pushes before the chest). The
  makers' chest stands on its mound in the middle of the Palm House's floor (`CHEST`, the second room; the redesign's rule
  "not in the first room" holds), and the house is about the bloom from there on:
  - **The first step a seed's, before any push**: the Cold Frame's door is a flower-door (`dE`, a `Bud` with `bE`) in the
    Palm House's east doorway, the vault's sun on it through a louvre over the east arm: bloom it. The floor's ball, its
    louvre and the eye behind the benches are gone.
  - **The Cold Frame's trays**: a seed in each tray under the louvre's two spots (`sC1`, `sC2` need the bloom now; eyes on
    the posts before), one ball, two plates, the key wants both in flower.
  - **The Seed Chamber's seed is a step** (`seed0`, a try before): in the oculus's sun in the middle, in a trough wet only
    with the water up. You come up the Cold Frame's disc with the water let down, so the gallery's wheel outside the door
    sends it up first; bloomed, the north door (`dS`, the bloom in hand before) sinks.
  - Without the bloom only the Shade House's fight is open off the hub, and the Seed Vault behind it, whose seed wants the
    bloom (`tests/temples.test.js` `GADGET_FIRST`: the chest may be the second room; the rooms it leaves open are a fight's).
  Audit: skeleton `XXABLCXRXXXXLK` → `CGXABXXLXXXXLK`, 69 % → 57 % like its nearest (the Givers' House), identity 2 → 3; ten
  steps, combinations 8, curve 4 (first third 2.17, last 3.92); dungeon item 5 → 4 (the rubric wants the chest mid-way, at
  30–65 % of the steps: this shape puts it first), so the score holds at 4.33; rules broken: none. No save is moved (the
  chest's flag and every latch hold; a save past the eye's door kept it open). Sorrel's "inside" answer says what the first
  hall holds. Tests: `tests/greenhouse-water.test.js` (the chest first, the flower-door bloomed, the trays, the Seed
  Chamber's seed dry until the gallery's wheel sends the water up), `tests/temples.test.js`.
- **The Mooring-House round its moored room** (v1.83, issue #417; the approved best practices,
  `docs/design/temple-best-practices.md` G1, G2, G4, G6 and its Mooring-House row). The Drift, the Cable Walk and the
  Balance are one great hall, the **Mooring Hall** (`MH`), 57 by 73 m, its walls 34 m up, open to the stars over its void;
  its floors all seen at once: the **east landing** (y 0, the room `drift`, its id kept) from the loft, its apron under the
  gallery out to the room's shaft; the **gallery** (`GALLERY`, y 11) along the south wall in two halves (`moor` east,
  `moorW` west) with the room's shaft between them; the **west landing** (`WEST`), its lower part (y 0, `west`) where the
  gangway lands and its upper part (y 6, `westS`) by the west door, the **Cable Walk** between. The west landing stands
  behind a moorers' screen of bars (and an invisible wall) up to 16 m, the gangway's gate in it (a twin of `br2`): nothing
  glides in past the gangway and the walk. The **Chain Locker** (`LOCKER`, `locker`) north off the east landing; the
  Rope Store moved 4 m north with the hall's south wall (`STORE`).
  - **The moored room** (G1, `ROOM`, `MooredRoom`): a round room of the makers, 13 m across, its ribs, roof and capstan of
    dark iron, hung on the house's great cable in the shaft; docked low (its floor at the east landing's) or high (at the
    gallery's, bridging its halves). The drum `mooring`, two stops `mLow` (t 0) and `mHigh` (t 1, the start), `roll:
    'hand'`, `verb: 'moor'`, set from `rooms` (the hub's lever in the Capstan Hall, the west landing's lever, and with the
    tether at the docks). The room's floor is a riding disc (a moving solid, as the Footprint's great lift: no
    `physics.addMover`, which the engines do not sync); its walls are kept by hand (`keep()`: no one passes its ribs, in or
    out, but at a doorway that faces a dock it is docked at, east at either, west only high). Under way it is at neither
    stop (t 0.45 or 0.55, saved: a save left under way finishes the trip), so everything that waits on it shuts; docked,
    the drum is at the stop. A **gate at each dock** (`dockL` a `Door`, `dockH` and `dockW` a `DockGate`, which rises:
    the gate below would meet a sinking one) opens while it is docked there.
  - **Set from:** its own capstan (the use button, "send the room up / down"), which waits a breath (`ROOM.wait`, 2.2 s)
    before it casts off, so you can step off and stay; a `MooringLever` in the Capstan Hall (`LEVERS`, usable before the
    tether: the state is taught before the chest) and on the west landing's lower part; and the tether at a moorers' ring on
    a post at each dock (`DOCK_RINGS`, `DockRing`: it calls the room home to that dock; its line to the room is drawn).
  - **Readable everywhere:** one lamp material for the house (`stateLamp`, `STATE_LOOK`): amber while the room is low,
    starlight blue while it is high, between them under way; a `MooringGauge` (a little room riding between two brass
    collars on an iron post) in every room but the guardian's; the levers' arms up or down; the counterweights themselves.
  - **What it changes** (every counterweight in the house hangs on the same cable: the room low, they rise; high, they
    sink), on all the floors: low, the Lamp Shaft's counterweight (`ShaftWeight`, a carrier while it rests) is hauled up
    off the grating and the void's breath blows (`breath`, an `Updraft` with `when`), the Chain Locker's shutter (`dL`)
    and the Rope Store's (`dR`, its arena door too) rise, the Cable Walk (`cw`, with its catch `rW` pulled) hangs level;
    high, the loft's ring comes down within the tether's reach (`r1`, moved by a `Hoist`), the gangway draws taut with its
    ball home (`br2`, latched once taut), the coffer's cage can sink (`cC`, with its weight).
  - **The rides** (the links `ride`, `drift → moor`, and `rideW`, `moor → moorW`): latched for the logic once the room has
    been there with you (a ring at your dock calls it back whenever you want it), as the Greenhouse's disc.
  - **The way through** (13 locks for the audit, was 8; skeleton `BBBCGXXLXXLK` → `XBBBCXXXXXXXXLXLK`): the winch's ball
    (`g1`); the hub's lever, the room low: the breath up the shaft (`breath`) to the lamp-eye (`d1`); the chest; the hub's
    lever again, the room high: the loft's ring (`d2`); in the Mooring Hall the east landing's ball home (the gangway taut,
    `br2`); the ring calls the room down, its capstan carries you up (`ride`); out west onto the gallery's west half, turn
    the capstan and step off: the room sinks, the Rope Store's shutter rises (`dR`); the arena, its small key; the west
    half's ring calls the room home, the only way back east (`rideW`); the moorers' gate (`sc`); on the balcony the ball
    home and (G2: the tether and the lens at once) the ring only the lens shows (`rL`, `hidden`; its chain to the roof is
    there for anyone to see, ending in nothing): the great key (`kB`); the cradle down; the room called down again: the
    Chain Locker (`dL`), its ball pushed OUT over the well (`ballK`) brings the west door's ring down (`rK`, a `Hoist`):
    pulled, the west door's chain lets go (`gN`, push then pull, the Balance's twist); over the gangway, the walk's catch,
    the room low (the west lever, if it is not): up the Cable Walk (`cw`); the west door, the great door (`d6`).
  - **G6:** the gallery's east half has a gap in its railing with a lit sill (`GALLERY.drop`): 11 m down onto a ring of the
    void's breath on the east landing (`GALLERY.catch`, the Aerie's `Cushion`), nothing hurt, a one-way link `moor →
    drift`; and the balcony's cradle down to the hub, as before. The antechamber's mark a few steps from the Capstan
    Floor's door, as before.
  - **The two obvious steps reworked:** the loft's ring (4.5 before, hung in plain reach over the door it opens) now hangs
    on the house's cable, set a room away; the coffer's cage (5, the weight beside it) wants the room high too.
  Audit: 8 → 13 steps, combinations 4 of 8 → 10 of 13, mean obviousness 3.31 → 2.85 (painfully obvious 2 → 0), decoupled
  4 → 8, loops 1 → 2, the score 4.22 → 4.22 (combination 4 → 5, decoupling 4 → 5, curve 5 → 3: the state's first steps,
  set a room away, come early; identity 3: 59 % like the Aerie, it was 75 % like the Hush-House); rules broken: none
  before or after. Old saves (`migrate.js` spacecity v4): past the west door, the locker's ring, the walk's catch, the
  gangway and the rides as done; past the great key, the lens's ring pulled; past the loft's door, the breath; one that
  stood inside, to its last mark. Tests: `tests/mooring-room.test.js` (the house on foot with a real traveller: every lever
  and capstan worked with the use button, every ring pulled from where he stands, the room called and ridden both ways, the
  step off before it casts off, the drop unhurt, the lens's ring, the locker's push then pull, the Cable Walk, the
  Anchor-Warden; its walls; a save left under way), `tests/temples.test.js` (the logic both ways, the state's doors, the
  saves), `temple-playthrough` (the room set at a lever or called at a dock's ring with the tether; walked in with the lens),
  `carry`, `temple-design`, `temple-maps` (`makers.js`: "Send the moored room up / Bring it down"), `house-map`, `zfight`.
- **The Mooring-House's last twist** (v1.85, issue #477: its curve had flattened, 5 → 3, the tether's uses one context).
  The great key's ring on the balcony (`rL`, only the lens shows) hangs on the house's cable the other way round from the
  loft's: hauled up under the roof while the room is high (`PERCH.ringUp`, a `Hoist`), down within the tether's reach with
  the room low (`when: LOW`). Ball home, ring seen, the cage still holds and the balcony's gauge says why: back on the
  gallery, turn the room's capstan and step off (the Rope Store's lesson), and come back. Audit: the great key's step 3 →
  5.5 in complexity, the curve 3 → 4 (first third 2.44, last 3.88), the score 4.22 → 4.33; no step newly obscure (2.5).
  With it, `stretch` (the cables' and chains' drawing) got its own scratch vector: called with the shared one as the
  cable's foot, it drew the moored room's cable, the rings' chains and the shaft's counterweight's off by the house's
  middle, so the rings hung from nothing.
- **The Mooring-House's shape: the guardian met early** (v1.86, issue #477; shape 4 of the four proposed on the issue: the
  Mooring-House and the Casting-House read 71 % alike). The Capstan Floor moves east of the Capstan Hall, between it and
  the Cord Loft (`FLOOR`: its middle, its gaps' angles `a` to the loft and `hub` to the hall, its windows, `out`), and the
  house ends back where it began:
  - **Seen from the first visit**: the hall's east wall opens on a short passage to the floor, barred by the Warden's gate
    (`d7`, a `BarGate`: iron bars from floor to lintel on brass rails, a `DockGate` whose slab is bars; solid to the feet,
    open to the eye). The Anchor-Warden stands beyond them from the start, facing the door it waits for.
  - **The way in** is the great door off the Cord Loft (`d6`, the great key; the antechamber `ante` a short passage off the
    loft's east-south-east gap, reached before the tether and empty: `tests/temples.test.js` `ANTE_EARLY`). Stopped, the
    Warden's gate opens from inside (`opens: { resolved: true }`, the link `arena → hall`): back into the hub; a door east
    (`d8`) is the way out into the world, as every house's.
  - **The Anchor Hold** (`HOLD`) where the Capstan Floor stood, past the west door: a round hall over the void, barred
    windows, a well in its middle; the Warden's spare anchor-ball (`bA`) out over the well on a cable-rail, pulled home with
    the tether onto its footstone (`pA`), draws back the bar of the moorers' gate (`sc`: the Rope Store's small key and
    `opens: { drumOn: ['bA', 'pA'] }`, a lamp for it on the lintel). So the west section (the Chain Locker, the gangway, the
    Cable Walk, the west door) comes before the balcony and the great key, and the great key comes down the cradle to the
    hub, a room from the great door. The tether outside the moored rooms, a ball's path (the v1.85 audit's edit 3).
  - The coffer moved round the hall to the south-east (`CLEAT.coffer`), clear of the gate's passage; the skin's floating
    plates and two islands for the new floor; the house's talk ("at the top of the house", the keeper step's "Go up", the
    enter line's "overhead") says where it is now (`tests/keeper-direction.test.js`).
  Audit: skeleton `XBBBCXXXXXXXXLXLK` → `KXBBBCXXXXXXXXLXLK` (the gate's K first, the hall's index), 71 % → 67 % like its
  nearest (the Casting-House); the Casting-House 71 % → 67 %. 14 steps, 11 combinations, curve 4 (first third 2.85, last
  4.35); the moorers' gate is a far step now (obviousness 1.0: its bar's anchor four rooms off, out of sight, a lamp on
  the gate for it) and the chest falls to 29 % of the steps (dungeon item 5 → 4), so the score 4.33 → 4.22; identity 3
  either side (its traversals' half point). Rules broken: none. Old saves (`migrate.js` spacecity v5): past the moorers'
  gate, the hold's ball home; one that entered, to its last mark. Every pair of houses now reads 70 % alike or less:
  `tests/temple-design.test.js` checks it (the audit run whole). Tests: `tests/mooring-room.test.js` (the Warden in sight
  through its bars from the hall; the hold's ball pulled for real; the moorers' gate with its key and its bar; the great
  door off the loft; the Warden; out through its gate into the hall), `tests/temples.test.js`.
- **The Mooring-House's far keys brought near** (v1.87, issue #561, the v1.87 design audit's first edit: three steps at
  obviousness 1.0–1.5, their keys rooms away and out of sight). Each lock's answer is read from where you stand at it:
  - **The Chain Locker past the west door** (`LOCKER`: its middle on the west door's axis, its floor the upper landing's,
    `y`; its well, rail and ring from its middle): the west door is open now, into the locker, and the locker's far door is
    `gN` (the ring `rK` with its ball `ballK` out in the far cup), on to the Anchor Hold, moved 31 m west (`HOLD.x` from
    the locker's). Its shutter `dL` is gone (the room was always low by then: the Cable Walk wants it). From the far door
    the ball and the ring are in sight (gN 1.0 → 4.0).
  - **The moorers' gate two keyholes** (`sc`: `lock: 'small', keys: 2`, no `opens`): the Rope Store's key and the Anchor
    Hold's (`kH`), in a cage across the hold's well from the anchor-ball. The cage wants its lamp-eye (`eH`, a `Switch` with
    `lids`: shut till the anchor-ball is home, `when`), splashed awake: the tether and the gun's first mode at once. The gate
    is a keyhole now (no puzzle of its own: a lock says plainly what it wants); the hold's cage 4.0.
  - **The great door sees its lamp-eye** (`D1_WINDOWS`): two glazed windows on the line from the great door to the eye on
    the pier's top, one in the Capstan Hall's wall beside the shaft's gate (two stones, 6.4–10 m up) and one in the Lamp
    Shaft's over its gate (9.6–12.2 m); the eye moved 1.2 m off the pier's radial and up on a 1 m stone (`SHAFT_PIER.side`,
    `stone`), so the line clears the gate's passage, and still hidden from the shaft's floor by the top's edge. A `Pane` in
    each window: its glass (`glazing`) marked `seeThrough` for the audit's sight lines (`scripts/temple-design/audit.mjs`
    leaves such meshes out), and a block of its own in the physics, so a splash from the hub meets the glass (d1 1.5 →
    2.5; the eye still woken from the pier's top).
  Audit: 14 → 13 steps, mean obviousness 2.64 → 3.19 (obscure 3 → 0), non-obvious 3 → 4, dungeon item 4 → 5 (the chest at
  31 %), curve 4 → 3 (the far keys' distance was most of the late steps' complexity; the hold's eye keeps a rise, first
  third 2.44, last 3.38), the score 4.22 → 4.33. Rules broken: none. Old saves (`migrate.js` spacecity v6): a last mark in
  the old locker (before the gangway), the gangway taut and the walk's catch pulled, so the way back east is open; one
  that entered, to its last mark. Tests: `tests/far-keys.test.js` (the audit's floor for these locks, the eye seen through
  the glass and the glass solid, the old saves), `tests/mooring-room.test.js` (the locker, the hold's eye and key, the
  gate's two keys, on foot), `tests/temples.test.js`.
- **The Footprint's Lens Chamber a keyhole** (v1.87, issue #561): its door (`dL`) opened from the Still Pool's berth, two
  rooms up and out of sight (obviousness 1.0); it is a small lock now, its key (`kP`) on the pool's far ledge beside the
  coffer, seen across the water from the near side, reached over the stones the berth raises. One small key before the lens
  and one after (the Lodge's, for the far door), so neither can open the other's door first. Audit: 10 → 9 steps (the door
  a keyhole, its key's step the stones, 4.0), mean obviousness 2.55 → 2.72, obscure 4 → 3 (`dT`, `dR`, `d4` stay: not this
  issue's), the score 4.22 as before. Old saves (`migrate.js` spheres v5): past the chamber, its key in its door. Tests:
  `tests/footprint-floors.test.js`, `tests/far-keys.test.js`.
- **The Lamp-House round its Lamp Hall, its great lamp the house's state** (v1.83, issue #410; the approved
  recommendations: `docs/design/temple-best-practices.md`, G1, G2, G4, G6). The Hall of Dark Pools is the **Lamp Hall**
  (`ROOMS.pools`, its id kept), 36 by 64 m under 34, its **gallery** (`GALLERY`, the room `hallUp`) along the west wall
  9 m up on columns, open over the floor, so both floors are seen at once; the great lamp's balcony juts out from it
  (`GALLERY.pier`), a pool-lamp on its end (`s8`). Every room past it (the Root Stair, the Lantern Chamber, the Dark
  Gallery, the Lamp-Room, the Wick Room) stands 24 m further north (`SHIFT`); the Kennel keeps its place. The loft of roots
  (`LOFT`) stays on the west wall, 12 m short of the gallery and a metre lower: no jump between them.
  - **The great lamp** (`GREAT_LAMP`, `GreatLamp`), hung from the roof in the middle of the hall in a brass cage with eight
    shutters, is the house's one state: `lG` its kindling (a bubble of `s8`'s light burst on its glass: it catches behind
    its shutters, gold at their seams) and the drum `lamp` its shutters, `lampDark` (t 0, the start) or `lampLit` (t 1),
    `roll: 'hand'`, `verb: 'lamp'`, set from several rooms (logic.js `rooms`, issue #408). `LIT` is kindled and open;
    `DARK` its shutters shut. A lever pulled before it is kindled opens its shutters on nothing (`toggle` says so).
  - **Cheap to change** (G1): a `LampLever` by every hub (`LEVERS`: the hall's floor between the Kennel's way and the Wick
    Room's, its gallery by the balcony, the Lantern Chamber by the Lamp Passage), pulled with the use button; on the Dark
    Gallery's far floor the hook at the pipe's ring (`hb.pipe`, a `HookBell`; `PipeLight` opens the shutters).
  - **Readable everywhere** (G1): one lamp material for the house (`stateLamp`, `LAMP_LOOK`): warm while it is lit, cold
    slate-blue while it is dark; a `LampGauge` (a lamp on a bronze post) in every room but the guardian's, the levers'
    knobs, the lamp-doors' lintel lamps; lit, the great lamp blazes over the hall (`GreatLamp.light`, 48 m) and the skin's
    gold lines wake round it. Shut ways say what they want when you come up to them (`LampWord`, `LightCurtain.said`).
  - **What it opens, on both floors**: lit, the Kennel's lamp-door (`dK`, in the hall's wall, in sight of the lamp) and the
    Lamp Passage's (`d2`), both for good; a curtain of its light bars the Wick Room's way (`cur`, a `LightCurtain`: a Door
    drawn as a sheet of light, fading into its sill while dark). Dark, the curtain falls, and the Dark Gallery's moss-stones
    rise and take root (`br1`: dark once the Lamp Passage's door has opened, latched). On the far floor the far door's lamp
    (`l2`) wakes to a bubble of the great lamp's light, which pours from its pipe into a basin there (`pv`, a held bell,
    `PIPE.hold` 9 s) while the valve is open: the hook at the pipe's ring opens it, and the shutters with it. The hook and
    the bubble at once, an older tool and the house's own (G2).
  - **The chasm is wider than the hook reaches** (27 m, `HOOK.range` 25): no reeling over it, and the pipe's ring is out of
    the hook's reach from the near lip.
  - **The ledge** (`LEDGE`): from the Root Stair's root-wall top a ledge runs back south along its west wall at 9, to a
    lamp-door through the walls into the gallery (`dC`); its lamp is the one by the chamber's dais (`l0`, a try before):
    a bubble of the fount's light wakes it.
  - **The drop** (G6): the gallery's edge has no parapet for 10 m (`GALLERY.drop`), nor the balcony's end: 9 m down to
    the hall's floor, the hub, unhurt (a `oneWay` link `hallUp → pools`). The far floor has a mark of its own; the
    antechamber's is a few steps from the Lamp-Room's door.
  - **The way through** (nine locks for the audit, was six; skeleton `BXCGGLLK` → `BBXCGXXBLLK`): the three pools (`d1`);
    the orb to the socket (`disc`); the wand; the lamp by the dais (`dC`); kindle the great lamp and open its shutters (the
    Kennel `dK` and the Lamp Passage `d2` open); the drop; the Kennel's key; dark at the floor's lever (`cur`, and far off
    the moss-stones, `br1`); the Wick Room's two orbs at once and the key (`cW`); up the keepers' door; over the moss-stones;
    the hook at the ring and a bubble of the poured light to the far door's lamp, the great key (`d4`). Played the other
    way (the Dark Gallery first, lit), the moss-stones lie sunk and the chamber's lever a room back darkens it.
  - **The scout**: the great lamp's glass until it is kindled (`LampGlass`, `lG`), then the nearest lever, or the pipe's
    ring once the hook is carried (`GreatLamp.center`). The temple maps' steps say "Open / Shut the great lamp's
    shutters" and "Light the lamp / the pool-lamp / the great lamp" (`makers.js`: a `LightEar` reads as a lamp).
  - **The audit** (`scripts/temple-design/lib.mjs`): a house-wide state's key, where it is not set in the lock's own room,
    is the nearest room it is set from (no other house's numbers move). The temple maps page: a state set back after the
    guardian is no extra if it was set before it too (the Belfry's bell, the Lamp-House's lamp).
  Tests: `tests/lamp-house.test.js` (the house on foot with a real traveller and a real bubble wand: every lever pulled with
  the use button, the ring hooked, every bubble blown and flown, the drop unhurt, the Lampless calmed; the other way round;
  the lamps' colours; the scout), `tests/temples.test.js` (the solver both ways, every step needed, the state's ways, the
  saves), `tests/temple-playthrough.test.js` (the lamp set at a lever, the valve's ring hooked from its `from`; the house
  walked in with the hook). Old saves: `migrate.js` perdide2 v5 (past the Lamp Passage's door: the ledge's door open and
  the great lamp kindled and lit; past the far door: its lamp lit; one that stood inside: to its last mark).
- **The Lamp-House's shape: the great key mid-way, then the way back** (v1.86, issue #477; shape 2 of the four shapes
  proposed on the issue: the houses had converged on one order, "a few base steps, the chest, combinations, the great key,
  the guardian", and the Lamp-House read 69 % like the Engine-House). The Kennel moves before the wand, the great key comes
  straight after it, and the great lamp is kindled on the way back:
  - **The Kennel's lamp-door wakes to a pool-orb** on the Lamp Hall's floor (`oK`, `pK`, `lK`; `KENNEL_ORB`: its groove up
    the floor from the near pool `s1`, the Root Stair door's, to a socket whose lamp is on a post in sight of the door).
    Light the pool, let the orb drink, roll it home before it fades. The orb is taught here, tested over the Root Stair's
    pool, twisted in the Wick Room (two at once, with bubbles). The great lamp no longer opens the Kennel: lit, it opens
    the Lamp Passage alone. The Kennel's small key is in hand before the wand.
  - **The great key straight after the wand**: down the ledge's door (`dC`), off the gallery's edge, the Wick Room in the
    dark (its curtain down: the lamp still cold), the two orbs and the small key in the grille. Then up the keepers' door,
    the ledge back to the balcony, the great lamp kindled and lit (the Lamp Passage open, the Wick Room curtained behind
    you), darkened again for the moss-stones, the far floor, the far door.
  Audit: skeleton `BBXCGXXBLLK` → `BBXXCGLXBLK`, 69 % → 62 % like its nearest (the Engine-House), identity 2 → 3; nine steps,
  combinations 5, curve 4 (first third 2.33, last 3.5), the score 4.33 → 4.44; rules broken: none. No save is moved (a lamp
  lit before opened the Kennel's door for good). Tests: `tests/lamp-house.test.js` (the walk in the new order: the orb
  rolled for real, the Kennel before the wand, the great key in the dark, the lamp kindled on the way back),
  `tests/temples.test.js` (the order, the orb wanted).
- **The Founders' Belfry round the Great Belfry, its bell the house's state** (v1.83, issue #408; the approved
  recommendations: `docs/design/temple-best-practices.md`, G1, G4, G6). The Stone Stair is gone: past the Hall of Stones
  the **Great Belfry** (`ROOMS.nave`), 40 by 66 m under 32, its gallery 8 m up round three sides (`GALLERY`: the north
  band a block of stone from the floor up, the arms down the long walls on columns), open over the floor, so both floors
  are seen at once; the great key's ledge (`RING.ledge`) high on its west wall, the Ringers' Walk's end. The rooms after it
  (the Bell Chamber, the porch, the Hall of Echoes, her hall) stand 32.6 m further north (`SHIFT`), the walk 3 m further
  west (`RING.x`). The room ids `stair` and `landing` are kept for its floor and its gallery (a save's last mark holds).
  - **The founders' bell** (`FOUNDERS`), hung in the middle of the hall, is the house's one state: a drum of two stops,
    `bellStill` (t 0, the start: its stones fell up) and `bellRung` (t 1), `roll: 'hand'`, `verb: 'bell'`, set from
    several rooms (logic.js `rooms`: a room's id, or `{ room, needs }`, issue #408: `inReach`). `FoundersBell` keeps it:
    rung at once, every stone it holds comes down; stilled, its hum fades for `FOUNDERS.fade` (10 s) and only then do they
    fall up (a pull while it fades rings it on). Its clapper, under its mouth, glows and swings while it rings.
  - **Cheap to change** (G1): a `BellLever` by every hub (`FOUNDERS.levers`: the Hall of Stones by its door on, the Great
    Belfry's floor by its way in, its gallery by the high door), pulled with the use button; upstairs the hook at a bell's
    ring (`FOUNDERS.rings`): the founders' own (`hb.founders`, from the gallery), the porch's bell (`hb.e1`) and the Hall
    of Echoes' (`hb.e2`, from either lip), which answer it.
  - **Readable everywhere** (G1): every lamp of the house shares one material (`stateLamp`, `STATE_LOOK`): warm amber
    while it rings, cold slate-blue while it is still, flickering as it fades. A `BellGauge` (a bell-lamp on a bronze post)
    in every room but the guardian's, the levers' knobs and lamps, the clapper; stones that fell up hang under the Great
    Belfry's roof and lie along its walls while it rings (`StateStones`); the skin's note spreads from the founders' bell
    and the Hall of Echoes' while it rings (`skin.U.bells` 3 and 4).
  - **What it stands, on both floors**: rung, the great stone (`FallUpStone` `lift`) is down on the floor; stilled it falls
    up to the gallery's north band with whoever stands on it (the floor's lever is 45 m from it: pull it and run while the
    hum fades). Rung, the porch's slab sinks (`d3`, latched the first time it rings once the chamber's north door is open)
    and the Hall of Echoes' bridge comes down (`br1`; the ball rolled across onto `p3` holds it for good); still, the spur
    to the Ringers' Walk falls up out of the chasm level with it (`spur`, a `Bridge` from `'below'`). The far door's slab
    sinks while it rings (`d4`: the great key, the ball on its plate and the bell rung; its own bell `e3` is gone).
  - **The great key** lies free by the ledge's edge (v1.74's cage, `cage:kB` at 1.0 then 1.5, cut): the ledge
    is its lock, its chest seen from the floor at the way in, the founders' bell in sight from it.
  - **The drops** (G6): every edge of the ledge drops onto the gallery (8 m), and the west arm's edge has no parapet for
    14 m (`DROP`), down to the hall's floor, the hub (8 m): unhurt, a `oneWay` link `landing → stair`. The antechamber's
    mark is a few steps from her hall's door, and the far lip has a mark of its own (`echoesFar`).
  - **The way through**: the arena and the ball in the stores and the hall's door (`d1`); the eye under the gallery's north
    band from the floor (`s1`, `d2`); ring, still and run onto the great stone; the hook; the porch's bell rung (`d3`);
    the ball across the held bridge; stilled from the near lip, the spur and the walk to the great key; down to the
    gallery or the floor, round again; the far door rung open from the far lip. Eight locks for the audit (was nine:
    `LBBCRGXLK` → `LBBCRXXXLK`).
  - **The scout** asks for the bell last (`bell` and the chamber's try `eT` after every other element), so it points at a
    stone to roll or a key first; then at the nearest place the bell is set from (`FoundersBell.center`: a lever, or a
    ring once the hook is carried). The temple maps' steps say "Ring the house's bell" / "Still the house's bell".
  - **The audit** (`scripts/temple-design/`): a drum's `verb` names its mechanic (`bell`, not `push`); a house-wide state
    set from the lock's own room counts as a key there, the nearest piece placed with `sets: <drum>` in that room, with
    what that room's entry needs (`gadget:hook` upstairs); a room where it is set only with the gadget is a puzzle room
    (rules.mjs). runtime.js `roomsPast` walks a one-way link only the way it goes. migrate.js: a flag cleared to null counts
    as unset (`relaid` used up once is set again when the house is remade again).
  Tests: `tests/belfry-bells.test.js` (the house on foot with a real traveller: every lever pulled with the use button,
  every ring hooked from where he stands, the stone ridden in the fade, both drops unhurt, the far door rung open, the
  Cloud-Mother calmed; the lamps' colours both ways), `tests/temples.test.js` (the solver both ways, the state's doors,
  the saves), `tests/temple-playthrough.test.js` (the bell set for real: a lever pulled, or a ring hooked from its
  `from`), the rules (none broken), way back, unstrand. Old saves: `migrate.js` arzach2 v5 (past the porch: its slab sunk;
  one that stood inside: to its last mark).
- **The Hush-House with no fight at all** (v1.83, issue #409; the approved best practices,
  `docs/design/temple-best-practices.md`: G3a, G4, G6). `src/temples/perdide.js`:
  - **The Choir is the great hall** (`ROOMS.choir`, 44 by 66 m under 30 m, the hub): its floor, its gallery 9 m up the
    west side (`BALCONY`, the great key's cage on it) and the great door in its east wall (`dG`) all seen at once from
    the way in. Every room north of it stands 12 m further on (`C2`). The Threshold's door into it (`d0`) opens to the
    smallest crystal by the way in: the first note, sung at the door.
  - **The small key is the pendulums' song**: its cage (`kS`, `FAR_KEY`) on the Pendulum Gallery's far landing sinks
    once the three are stilled in turn from that side (`w1`..`w3`, as before), and then the pendulums rest for good
    (`rt.galleryWings`, `hush()`): the bridge is a walk both ways. The Nursery's fight, the keeper's ledge and its gate
    are gone; the house has no arena (`ARENAS = []`, no `combat` room: `tests/temple-rules.test.js` `NO_FIGHT`).
  - **The sill** (`SILL`, G6): a gap in the gallery's parapet by the great key, between two crystal posts, a lit edge
    along it; under it the black pool on the Choir's floor, whose still water takes the 9 m fall (`Catch`, exported
    from `spheres.js`). The link `balcony → choir` is `oneWay`.
  - **The great door** (`dG`, a big lock in the Choir's east wall): the great key, and the Choir hushed. The three
    crystals sung at the start hum on, and it will not open over them: each is stilled with the stilling mode, high to
    low (`h4`, `h3`, `h2`, `after`; a `HushNote` piece takes the stilling glob for its crystal's `Switch`, whose
    target it replaces). The hush the Mother's hall asks for, taught where nothing strikes.
  - **The Mother's hall** (`ROOMS.hall`, round, 22 m, at the Choir's floor) through an antechamber with the house's
    last mark (`ante`, 6 m from her door).
  - **The Mother Snapper outwitted** (`MOTHER`, `outwit: true`; `hush()` every frame as the temple's `onUpdate`). She
    is blind: her one move, a lunge (half a heart), is struck only at a sound, aimed through `Guardian.listen`
    (`boss.js`: a point she turns to and aims at instead of you) and begun by her temple (`begin(P, null, 'lunge')`:
    a phase may have no moves of its own). She hears her three pendulums jangle at the end of each swing, and you when
    you run, roll or land a jump within `HEAR.r` (16 m) of her; never a walk. **Hushed** (her first phase, to 0.45):
    each pendulum stilled hangs frosted and silent for good (`motherFrost`, `CALM.hush` each, whenever it was done).
    **The lullaby** (to 0.9): the four notes splashed low to high (`motherNote`), the first a crystal at her root
    (`RootNote`) that her head covers while she listens (`cover`, 4.5 m): a splash there only wets her jaws until a
    sound elsewhere turns her head. A note out of turn rings flat, the notes so far fade with their calm, and she
    strikes at it: before the first note that costs nothing, the decoy. Weary, a hand on her head. Globs on her take
    nothing (`motherHit`, dull). Knocked out before her hall is hushed, the frost falls off (`motherReset`).
  - **In the Arena** she spars as she fought before (`motherSpar()`, `src/arena-guardians.js`).
  Eight steps (the Threshold's door, the Choir, the Bog Well's eye, the passage's mouths, the crossing, the far
  landing's song, the gallery's ball, the great door's hush), then the Mother. Design audit 4.56 → 4.56 (the chest at
  38 % of the steps, was 33; the curve 4 → 4; mean obviousness 2.83 → 3.06; two steps painfully obvious, was one: the
  Threshold's door and the crossing); the redesign's rules: none broken. Tests: `tests/mother-snapper.test.js` (the
  Mother in her hall at 60 and 30 frames a second with real globs: never struck while walking), `tests/temples.test.js`
  (the house on foot, the drop unhurt, the solver, old saves), `tests/engine-mother-snapper.test.js` (the engines'
  build). Old saves (`migrate.js` perdide v4): with the Nursery won or its key, the pendulums sung; past the old far
  door, the great door open and hushed; one that entered, the Threshold's door open and taken to its last mark.
- **The Warden's Well round its Well, the house's breath its state** (v1.83, issue #413; the approved recommendations:
  `docs/design/temple-best-practices.md`, G1, G2, G3c, G4, G6, and the house's row: ways down, a view down the shaft, its
  obvious steps). `src/temples/incal.js`:
  - **The house's breath** (G1): the drum `breath`, `breathIn` (t 0, the start) or `breathOut` (t 1), `roll: 'hand'`,
    `verb: 'breath'`, set from several rooms (`rooms`: the Climb, the Vane Room's far floor, the gallery, the loft, the
    crown); `OUT` and `IN` its two conditions. `Breath` keeps it (its `setters`, the scout's nearest lever, the line said,
    the shared lamp's colour); a `BreathLever` by every hub (`LEVERS`), pulled with the use button; a `BreathGauge` in every
    room but the way in and the guardian's (`shows: 'breath'`): three rings of light in a glass tube drifting up, cyan,
    while it breathes out and down, amber, while it breathes in. Out: the draughts rise (the plinth's up the Well, `rise`,
    `iris`, `iris2`, `lift`, each latched once made), the balcony's door opens to its key (`d1`), the Vane Room's
    breath-stones stand (`stones`) and the great key's cage can sink (`kG`). In: the crown's ring hangs down on its chain
    (`CrownRing`, `RING`), and the crown's eye wants it (`s4`).
  - **The Well** (G4): the gallery, the loft and the crown are one drum 36 m across and 64 m tall, its floors rings round an
    open core (the irises gone: the loft's hole 7.2 m across its radius, the crown's 7, a `Rim` of light round each while the
    draught is let on through it). From the crown's rim the plinth is 57 m straight down. The loft's raised walk stands on
    piers clear of the core; the high ledge and the high door are 16 m over the crown (`FLOORS.hall`), past its great vane's
    breath: the core's draught carries you there (`lift`).
  - **The Turning Floors**: each disc rides on its own small vane (`v1` on the island's pillar, `v1b` high on a pillar by the
    far ledge, 30 m off); `discs` wants both.
  - **Two small keys, two doors** (G3c): the Climb's ball over the slot onto its plate while the vane below turns sinks the
    cage of `kC`; the Ash Store's arena gives `kW`. The balcony's door (`d1`, to the Bellows Chamber) and the east way's
    (`dV`, to the Vane Room) take one each: either first.
  - **The Vane Room**: the chasm 17 m across (`VANE_ROOM`, wider than the pen's longest plank), the breath-stones' pier in
    its middle; on the far floor a great vane (`vR`, the fan's) and the great key's cage, which sinks while it turns and the
    house breathes out. Crossed before the fan, the key is in sight in its cage; the fan brings you back (the solver's room
    order puts the room after the chest: `tests/temples.test.js` `BACK_TO`).
  - **The crown's eye** (G2): its lids lift only while the ring is tugged with the hook (`rS`, a held bell, `VANES.ring`
    14 s; let down only while the house breathes in) and its great vane turns in the fan's gust (`vC`), the house breathing
    in. Then out again, and the draught to the ledge.
  - **The ways down** (G6): `SoftFloor` zones break a fall onto the plinth, the gallery's, the loft's and the crown's floors
    and the Flue's foot (`CATCH`). The **Flue** runs from the crown down to the Bellows Chamber's floor: off the crown's
    landing or the gallery's west doorway, 57 or 24 m down, unhurt; at its foot a passage to the chamber's west wall and a
    `Valve`, a door that opens from the flue's side only (from the chamber it stays shut and says so). One-way links:
    `crown → gallery`, `loft → gallery`, `ledge → crown`, `crown → flue`, `gallery → flue`, `flue → jets`.
  - **The way through** (ten locks for the audit, was nine; skeleton `BTLCTXXXXLK` → `BXLLXCXXXXXLK`): both vanes and the
    discs; the Climb's ball and `kC`; the Ash Store, `kW` and the pen; a door (`dV` or `d1`); the house breathing out; the
    stones and two planks; the balcony's door; the fan; back across for the great key; the gallery's eye; the loft's ball;
    breathing in, the ring and the crown's vane, the eye; breathing out, the draught to the ledge; the high door.
  - **The temple maps**: "Let the house breathe out / in, at a breath lever"; the four hall vanes the guardian asks for in
    its own hall are its fight's steps, no extras (`makers.js`).
  Tests: `tests/wardens-well.test.js` (the house on foot with a real traveller, a real gust fan and a real bridge pen: every
  lever pulled, the ring hooked, the planks drawn, every drop fallen with his hearts counted, the valve, the warden, the
  shaft's breath), `tests/temples.test.js` (the solver both ways, without the hook, every step wanted, the choice of door,
  the saves), `tests/temple-playthrough.test.js` (the house walked in with the hook). Old saves: `migrate.js` incal v5 (past
  the balcony's door: `kC` taken, the Vane Room's door unlocked, the house breathing out; past the eye or the high door:
  the Well's ways made; one that stood inside: to its last mark).

**Playthrough coverage limitation (#628):** `tests/temple-playthrough.test.js` checks every temple's
puzzle progression with real pieces and timed physical ball interactions, but its travel helper
teleports between reachable spots and some actions use explicit logic shortcuts. It is not proof of
a complete ordinary-input journey. The Whale-House's `tests/whale-tide.test.js` adds continuous
physical traversal through its tide route, but seeds the boots and resolves some later interactions
directly. `tests/engine-whale-tide.test.js` separately checks ordinary input through the actual native
host for rising-water swimming, dais escape, tide lowering and the boots' deep-ear stomp. None of
these should be reported as a full input-driven temple ending or device acceptance.

- **The Whale-House round the Sounding Hall, the tide its state** (v1.83, issue #412; the approved best practices,
  `docs/design/temple-best-practices.md` G1, G2, G4, G6 and its Whale-House row, the research's alternative #401 house).
  The **Sounding Hall** (`HALL`) is the great hall, 48 by 76 m and 43 high from the Sound's floor: the **quays** (y 0) round
  its south, west and east sides; the **deep floor** (`DEEP`, 11 m under them) between them, down a stair from the south
  quay; the **Sound** (`SOUND`), a moat across the hall 5 m deeper still, always water enough to fall into; the **dais**
  (y 0) beyond it; the **gallery** (`GALLERY`, y 10) over the dais behind a screen of the great horn's pipes (0.9 m apart:
  you see through them, you can't pass them, and no bounce of the boots lands you behind them). The quays and the deep
  floor are one room (`hall`, the hub: a key on the deep floor is in the same room as a door on the quay); the dais
  (`dais`, the Horn Door, the drop back) is the second hub. Room ids kept: `hall`, `gallery` (now the shelf, the High Walk
  and the gallery), the wings; the keepers' landing is gone.
  - **The tide** (G1, `TIDE`, `HIGH` / `LOW`): a drum of two stops, `tLow` (t 0, the start: the sea out) and `tHigh` (the
    sea in), `roll: 'hand'`, `verb: 'tide'`, set from `rooms` (logic.js, issue #408). `Tide` keeps it: a valve turned moves
    it at once for the logic, and the water runs `TIDE.run` (13 s, slow enough that a swimmer afloat rides up on it:
    src/swim.js's spring to the surface lags 0.3 m at 0.85 m/s). **Cheap to change:** a `TideValve` (a brass valve wheel
    on a post, a lamp on its cap; the use button: "let the sea in" / "let the sea out") on the south quay, on the deep
    floor, on the dais and on the gallery, and in the two rooms the water lifts you out of or strands you in without one:
    the Shell Room and the Tank Hall. **Readable everywhere:** a `TideGauge` (a brass cage round a column of the sea, coral
    rings at its two marks, a lamp on top) in every room but the guardian's; every gauge's and valve's lamp turns from
    coral (out) to the sea's blue (in) as the tide runs; coral high-water lines round the deep floor, the Sound, the Shell
    Room and on the tank's glass, the low line on the Sound's walls, and a tide staff in the Sound ringed every metre.
  - **The water you swim in** (`TideWater`): the Sounding Hall's and the Shell Room's sea, a sheet from wall to wall that
    stands at its `low` mark (the Sound only) or its `high` (0.6 m under the quays and the Shell Room's ledge, so you climb
    out onto them), between as it runs. It is a body src/water.js finds in the scene (`userData.water`, moved with it:
    `waterMoves`): you wade, swim, dive with the breath meter, fall into it unhurt, and the camera keeps off its surface
    and takes the underwater look under it, all as in any lake. It is drawn as the house draws water (flat, lit from
    within, seen from both sides), not with the world's water shader, whose passes the Unity build doesn't have
    (docs/systems/bridge-gaps.md): the same picture there. The tank's sea is seen through the glass the skin draws as the
    open sea: over the part of the pane the tide has left, the tank's empty dark, and a lit line at its top (`TideGlass`).
    Two channels show it too (`TideColumn`): along the Pool Room's south wall and round the Horn Chamber's foot.
  - **What it does:** in, it lifts you up to ledges (the Shell Room's ledge, the dais across the Sound) and fills the tank,
    so the ear on the tank's floor hears a stomp by the glass through the water (`e5`, `when: HIGH`, held while it rings:
    the rungs). Out, it bares the deep floor, and its doors, which hold the sea back while it is in, open: the Shell Room's
    floor door (`d2`, the Pool Room's ball as well), the Horn Store's (`dS`, its horn `eSt` too) and the Listener's
    (`dL`, its ear `eL` too). On the way it is let in, out, in and out again.
  - **The deep floor:** its ball into the cradle at the pillar's foot (the cradle in sight from the west door over the
    quay's lip) wakes the eye for the west door, up on the quay (`d1`). The **Shell Room** sinks to the deep floor's level:
    in at its floor door with the tide out; its shell's eye wakes the Horn Door's second lamp and the ledge's door onto the
    east quay (`dE`, latched, from inside); its valve lets the sea in and the water lifts you to the ledge's stage (no
    parapet there) and out (`ledgeE`: `dE` open and `HIGH`): the second way round. So the Pool Room's ball is the only way
    in the first time.
  - **G6:** off the dais's edge into the Sound (11 m, a one-way link to the hall), and the **Drop**, a 5 m gap in the
    gallery's pipes with a coral lip, 21 m down into the Sound (one-way, gallery → hall): any water deep enough breaks a fall
    (src/swim.js `SWIM.cushion`), so no `Catch` is needed. The guardian's checkpoint: the antechamber's mark.
  - **G2, the late step with an older tool:** the Listener's door's ear hears the gallery's dish (`dishG`), which carries
    only with the stone weight on its footstone (`wG` on `pG`, `weightOn`); the weight lies on a post's capital under a
    horn's bell hung from the roof, its rim 1.25 m over the capital: nobody stands there, and the grappling hook (the
    Founders' Belfry's) brings it down. The hook and the boots at once, and then the tide out for the door.
  - **The way back from the Tank Hall:** a dish by the Song Passage's door, its twin over the passage horn in the Horn
    Chamber (no element: a stomp by it is the horn's note, `e4`). The Throat now runs west from the deep floor, under the
    Pool Room, to the Listener's Hall turned to face it (`A`: its own frame).
  - **The solver:** a ball's stop is chosen for an eye it lets be woken only if that eye's room is in reach then
    (logic.js `solve`, the score's `usable`): the tank's ear, out of reach behind the passage's locked door, would have kept
    the tide in when the Horn Store wanted it out. Every other house solves as before. The scout's target for the tide is
    the way out once the Listener is calmed (`Tide.center`).
  Audit: 7 → 9 steps, skeleton `XBXCLGXXK` → `BXXBXCXLXXK`, combinations 4 of 7 → 6 of 9, loops 1 → 3, hubs 1 → 2, the
  chest at 43 → 56 % of the steps, mean obviousness 2.71 → 2.83, the score 4.44 → 4.44 (curve 4 → 5, non-obvious 4 → 3:
  three steps at 1.5 or less, the keys a wing or a floor away from their doors; identity 3, 62 % like the Warden's Well);
  rules broken: none before or after. Old saves (`migrate.js` underwater v4): past the Horn Store, its horn stomped; past
  the old Listener's door, the weight on its footstone, the ear heard and the tide out; one that stood inside, to its last
  mark. Tests: `tests/whale-tide.test.js` (the house on foot with a traveller who swims: every valve turned with the use
  button, the water ridden up, the Sound swum, the dais's edge and the Drop fallen into the water unhurt, the rungs
  climbed, the weight hooked off its post and carried, the Listener calmed; the tide's look everywhere, the deaf ear, the
  breath meter and the camera under it), `temples.test.js`, `temple-playthrough` (and the route's, `playthrough-agent.js`:
  the arena's own work first while its guardian is awake), `temple-maps`, `house-map`, `temple-rules`, `way-back`,
  `zfight` (19 → 6).
- **The Casting-House round its Pouring Hall, the pour its state** (v1.83, issue #416; the approved recommendations:
  `docs/design/temple-best-practices.md`, G1, G2, G4, G6 and the house's row). `src/temples/moonfoundry.js`:
  - **The pour** (G1): the drum `pour`, `pourOn` (t 1, the start: the house pours by itself) or `pourCold` (t 0),
    `roll: 'hand'`, `verb: 'pour'`, set from several rooms (`rooms`: the hall's floor and gallery, the landing, the Mould
    Room, the Sand Room, the furnace, the Weighing Hall); `POURED` and `COLD` its two conditions. `Pour` keeps it (its
    `setters`, the scout's nearest tap, the line said, the one lamp material every tap, gauge and gate lamp shares, the
    iron's level `k` running in or draining over `POUR.run` s); a `PourTap` by every hub (`POUR.taps`), turned with the use
    button; a `PourGauge` in every room but the guardian's and the two short passages (`shows: 'pour'`): a glass column, its
    iron up while it pours. Poured: the great `Crucible` over the hall's north end tips and its stream falls into the
    basin; the runnels cut in the hall's floor (`RUN`, `RUNS`: the Runner from gate to gate, the spine up to the basin)
    fill and burn (the night pour's rule outside: a fire hazard that throws you up and out to the nearer side, a quarter
    heart a bite, never a fall back to a mark); the four heat-gates shut (`gW`, `gE` in the hall's walls, `dR` the Sand
    Room's, `cF` the furnace's far gate: `opens: COLD`), a `PourFall` of three streams down each one's face into a gutter
    that burns too; and the moulds are cast. Cold: the gates open, the runnels drain into dry lanes with steps down
    (`RUN.steps`), crossed by flush plates (`RUN.plates`, two before the gates).
  - **The casts** (teach, test, twist): a stone moon in the Mould Room's great mould and the pour let in opens its north
    door (`dM`); the same on the Crucible Stair's landing opens the north door to the Tong Chamber (`gT`, its counterweight
    cast); in the furnace the hot moon lights the hooded mould (`bH`, the pilot flame always lit) and the pour casts the
    bridge (`brH`). The founders' moon drawn across the spine into the great cradle on the hall's floor, the pour round it,
    with the great key opens the Founders' Door (`dF`, a great lock now). Each a latched door, wherever the pour was let in
    from: `logic.js` solve() counts a latching door a stop would open (its one change: no other house's solve log moves).
  - **G2**: the great key's cage (`kG`) in the Weighing Hall sinks once both pans of the great scale weigh: the pier's iron
    moon (the glove, `mB`) and the stone weight (`wS`, `needs: ['hook']`) hooked off its column's capital 19 m up and
    carried into the floor pan (`pS`).
  - **G4**: the Pouring Hall (`HALL`) 44 by 72 m under 34, its gallery 11 m up round three sides reached from the Crucible
    Stair's landing (a 30 m square hall now, the landing a puzzle room), the crucible, the runnels and the Founders' Door
    all seen from the way in. **G6**: the sill (`SILL`), a gap in the gallery's west arm over a bed of moulding sand
    (`Catch`); the antechamber's mark 6 m from the founder's door.
  - **The skippable wing, needed**: the small key (the Sand Room's) opens the door down to the Weighing Hall (`dW`), whose
    great key the Founders' Door wants. Deliberately optional: the map, the Tong Chamber's try (`mT`, `try`) and the
    keepers' door back to the hub (`eS`, `shortcut`: the long way round is through the furnace and down the sill).
  - **The temple maps**: "Let the pour in / Stop the pour, at a tap" (`makers.js`).
  Twelve locks for the audit (six before; skeleton `XBCXXXLK` → `BBBXBXCXXXBLXLK`). Tests: `tests/casting-pour.test.js`
  (the house on foot with a real traveller: every tap turned with the use button, the runnel's burn, the dry lane and its
  steps, every moon rolled or drawn, the hoist, the press, the weight hooked off its capital, the sill dropped from unhurt;
  the pour read the same everywhere), `tests/temples.test.js` (the solver both ways, the hook carried in, the arena's key
  for `dW`, old saves), `tests/temple-playthrough.test.js` (walked in with the hook; a house-wide state may be asked for
  twelve times). Old saves: `migrate.js` moonfoundry v4 (past the old Mould Room's door: the landing's moon cast; past the
  Founders' Door: the Weighing Hall done, the small key in its door; one that stood inside: to its last mark).
- **The Undertower round the Great Well, the line its state, the exam of the whole game** (v1.83, issue #418; the approved
  best practices, `docs/design/temple-best-practices.md` G1, G2, G3d, G4, G6 and its Undertower row). `src/temples/bazaar.js`:
  - **G4, the great hall:** the round Cable Well is gone; the **Great Well** (`ROOMS.well`, room `well`) is 42 by 64 m under
    42, over three floors seen at once (`WELL`): its floor (F0, the hub), its **gallery** 12 m up round the west, east and
    north sides (`landing`: the north band a block of stone from the floor up, the arms on columns, open over the floor), and
    its **high balcony** 24 m up over the north end (`top`), on the band's wall and two piers. West off the floor the Cable
    Store's passage, east the Tuning Room (8 m further east), north off the gallery the Shell Chamber (r 17 now, 28 m
    before), west off the gallery's arm the Choir's gate, east off the balcony the Bellows. The rooms after the chamber
    stand on F2 (the Listening Passage, the Gallery of Voices, the First Sign's hall). The ids `gallery` and `galleryFar`
    are kept (a save's last mark holds).
  - **G1, the line** (`SPEAK` / `QUIET`, `LINE_LOOK`): the First Sign's one word let into the makers' cables or shut out, a
    drum of two stops (`lineQuiet` t 0, the start; `lineSpeaking`), `roll: 'hand'`, `verb: 'relay'`, its room the Hall of
    Dishes' far landing and `rooms` the gallery, the balcony, the Listening Passage and the First Sign's hall (logic.js,
    issue #408). `LineRelay` keeps it (`rt.line`; its scout's `center` the nearest lever): **the great horn** hung in the Great
    Well's middle (`WELL.horn`), its ring, throat and the cables out to the walls lit in one lamp material (`lineLamp`:
    coral while the house speaks, slate while quiet); while it speaks it says the word every `LINE_LOOK.every` s (the
    game's `note` `sign.0`, caught by the sand within `LINE_LOOK.reach`, a ring of light going out from its mouth).
    **Cheap to change:** a `RelayLever` by every hub (`LEVERS`: the far landing by the way into the Great Well, the gallery's
    north band, the balcony's west end by the davit, the Listening Passage by its door, the First Sign's hall by its door), the use button ("let
    the word into the cables" / "shut the word out of the cables"). **Readable everywhere:** a `LineLamp` (a small brass horn
    on a post, its mouth the lamp) in every room but the Threshold's, the pit hall's near side, the far landing of the
    gallery and the Crown; the levers' knobs; the horn's word, heard. **What it sets, on three floors:** speaking, the
    Cable Store's door (`dS`, a cable door, and the arena's), the great lift (`lift`, woken the first time and running from
    then on: a latch, so the house quiet never strands anyone on either floor), the Bellows' door (`dB`, with the Choir's
    small key) and their draught; quiet, the horns on the cables hear: the Listening Passage's (`e0`), the Choir's two
    (`hA`, `hB`), and the First Sign in its puzzle. The way through sets it speaking, quiet, speaking, quiet
    (`tests/temples.test.js`).
  - **The hourglass's ride** (`Counterweight`, `WEIGHTS`): a block of the house's stone on its cable, a loose weight (the
    hook's rule, #432) and the level's `recallables` (`src/gadgets/recall.js`: the house adds its adapters to the level).
    Knocked off its ledge (a shot, a push, a blast: `slide`) it tips off and goes down its cable at `WEIGHTS.pace`; hooked,
    it is dragged at that pace; the recall hourglass sends it back along its path with you on it (a moving collider). Left
    `WEIGHTS.back` s off its ledge with nobody on it, its cable draws it home. **Taught** in the Shell Chamber (`SHELF`):
    the way on is a walkway 12 m up on a pier, its counterweight on it (`cwShell`, the element `knock`, its words on the
    Temple maps page `noun` / `act`): knock it off, stand on it, turn the hourglass on it.
  - **G2, one step each for the older tools, each with the hourglass:** **the hook**: the high counterweight (`cwTop`)
    hangs from a davit over the balcony's lip, its top level with the balcony, seen whole from the gallery's west arm: hook
    it down to you, stand on it, ride it back up (`landing → top`, `needs: ['hook', 'recall']`). **The lens**: the Gallery of
    Voices' listening pillars still rise for the high note played back near them, and they are there only through the seeing
    lens (`Pillars` `hidden`, pieces.js: risen but unseen, nothing to stand on; seen once, for good): `needs: ['recall',
    'monocle']`. **The bombs**: the Choir's near horn is black and hears only a blast's boom, and only played back (`hB`,
    `NOTES.boom`; a blast in the house is a note, `gadget:blast` → `note` 'boom', and by the horn it says so): with the far
    horn's low song through the dishes, the small key's cage (`kC`). **The wings**: the Bellows' horn (`hW`, held 12 s)
    wants the First Sign's word played back, caught from the great horn while the house speaks; while it rings and the house
    speaks the bellows blow (`draught`, an `Updraft` 24 m), and the wings ride it up to the **Crown**, a ledge high on the
    shaft's wall with the great key free on it (`bellows → crown`, `needs: ['glider']`).
  - **G6:** the gallery's west arm has no parapet over `WELL.drop` (12 m to the floor, unhurt); the balcony's lip has an open
    stretch (`WELL.gap`) over a heap of old cable on the floor (`CableHeap`, the Footprint's `Catch` done with cable: 24 m,
    nothing hurt); off the Crown the bellows' breath takes the fall. The guardian's checkpoint: the antechamber's mark.
  - **G3d, the First Sign: two fights and a puzzle between them** (`FIRST_SIGN`, `signWord`, `onUpdate`): its first fight
    as before (its word, SOMEBODY, played back when it lowers its dish, twice). Its **puzzle** (`puzzle: true`, no moves):
    it turns its dish up and floods the cables with its word (the house speaks: `LineRelay.set`), and hears nothing until
    the word is shut out at its hall's relay; then it turns its dish to the stone of the word it wants next (three
    `WordStone`s round the wall: OUT THERE, IS TALKING, TO YOU; `Guardian.listen`) and listens, as long as it takes (every
    `SIGN_WAIT` s it swings round to the stone again): the word caught from that stone, played back into its dish, in order.
    Its **last fight**: it hears only through its cables, the low wall dishes (its second verb, the dodge of its beam,
    here now). In the Arena it spars its three fights as before (`signSpar()`); the guardians' fight-through test lends a
    puzzle phase its temple's `puzzleHand` (the word shut out) and takes its openings.
  - **The three painfully obvious steps, cut:** the second disc's horn by the low stone (5): the great lift runs on the
    line now; the chamber's north door for the shell in hand (4.5): the walkway's counterweight; the listening pillars (5):
    seen only through the lens.
  Thirteen steps for the design audit (see the best-practices doc's As built); a player takes about twenty. Old saves
  (`migrate.js` bazaar v6): past the chamber's old door, the walkway's counterweight knocked; an old great key kept; one
  that stood inside, to its last mark. Tests: `tests/undertower-line.test.js` (the house on foot with a real traveller:
  every lever pulled, both counterweights ridden under the hourglass, the hook's aim and drag, the lens's pillars, the
  bomb's boom, the bellows' draught on the wings, the drops unhurt, the First Sign's three phases), `temples.test.js` (the
  logic, the line set both ways, each older tool needed, the migration), `temple-playthrough` (the levers pulled for real),
  `guardian-twists` (its puzzle and its last fight), `guardian-completable`.
- **The Clock-House round its great hall, the hour its state** (v1.83, issue #414; the approved recommendations:
  `docs/design/temple-best-practices.md`, G1, G2, G4, G6 and its Clock-House row). The round Winding Well and its wall to
  climb are gone: the **Winding Well** (`WELL`, the room id `well` kept) is a square hall 64 m across under 36, the hub of
  both floors, the **Escapement's stair** in its middle and the **great clock** on its west wall. The rooms north of it
  (the Coil Chamber, the Winding Passage, the Clock Gallery, the Foreman's) moved north with its wall; the Pendulum Hall
  and the Striking Room stand east of it now (`WING`), each with a floor door onto the hall and a high door at the upper
  floor's height (`UP`).
  - **The hour** (`HOUR`, LOGIC `hour`): a drum of three stops, `two` (t 0), `four` (0.5, the start: every clock in the
    house stopped at four) and `six` (1), `roll: 'hand'`, `verb: 'hour'`, set from several rooms (logic.js `rooms`, issue
    #408). `GreatClock` keeps it. Its hand runs on, never back (`turn(hour)`: the logic at once, the stair easing round at
    `HOUR.turn` rad/s at most, so six on to two goes the long way round, past eight, ten and twelve).
  - **The Escapement's stair** (`STAIR`): 23 steps round a still brass column from the floor to a crown at `UP`, and the
    arm, the clock's hand, out from the crown to 23.5 m. It turns as one with the hand (`hourAngle`: twelve lies toward
    the west-north-west, so two points due north, four and six at the east wall). The steps and crown are one moving
    collider (`physics.addMover`), the arm another, hinged on the crown's edge (`ARM_PIVOT`): what stands on it is carried
    round (src/carriers.js). The arm meets a dock (`DOCKS`, `HourDock`, the logic's bridges `st2`, `st4`, `st6`): a slab off
    the wall at `UP` with a round tip on the hand's line (`dockTip`), its lamps lit when the arm is there and still. At two
    the north dock and the north door to the chest (`d2`, two small keys); at four the Pendulum Hall's high door; at six
    the Striking Room's loft.
  - **The clock wound** (`WOUND`): the winding's counterweight (`COUNTER`, `ball1`) lies on the hall's floor now (it lay on
    the Escapement's far landing for the north door); rolled into its socket it winds the great clock. Until then the
    arm stands upright from the crown (`GreatClock.raised`), no dock is met (`st2`, `st4` and `st6` want `WOUND` with their
    hour) and a lever only clanks; wound, the hand comes down level, pointing at the hour. From the north dock the socket
    is in sight below.
  - **Cheap to change** (G1): an `HourLever` by the stair's foot, at the crown's arbor (its middle: it turns round it), on
    the Escapement's far landing (the lower hub): each turns the hand on two hours (A / ×); one on every dock brings the
    arm round to that dock's hour (`to`), so nobody is left on a dock with the arm away.
  - **Readable everywhere** (G1): an `HourGauge` (a clock face, its hand turning with the great clock's, a lamp ring of
    the hour's colour: `HOUR.colors`, teal two, gold four, coral six, shared by `hourLamp`) in every room but the
    guardian's; the great clock's face on the west wall; the floor's dial round the stair's foot with the three hours lit;
    the levers' knobs and the arm's tip lamp.
  - **What the hour changes, on both floors:** the dock the stair meets; the Striking Room's eye (`sS`) wakes only for
    the ball on the hour track's plate of the hour the clock says (its `when`: two, four or six), and the key it frees is
    up on the loft (`WING.loft`, room `strikeLoft`), reached at six; the Clockmaker's clock's lids lift only at four
    (`c1`–`c3`: and the mainspring wound); the Clock Gallery's six eyes are counted round from the hour (`galleryOrder`,
    a Bank `order` that is a function now, pieces.js). On the way the hour is set two, six, two, four, two.
  - **The Pendulum Hall** (an arena): in by its high door off the dock at four (`dW`), its doors shut while its keepers
    stand; won, the key's cage on the landing sinks and its floor door (`dWo`) opens back onto the hall: a loop.
  - **G2, the hook and the boomerang at once:** the gallery's eyes sit behind brass shutters while its striking train is
    still (`StrikingTrain`, LOGIC `train`, a held bell, `TRAIN.hold` 12 s); the grappling hook at the ring under the great
    clock (`hb.train`, a `HookBell`, hooked from the near landing, 22 m) runs it, the shutters swing off, and six in a
    breath, three on the boomerang's locks, in turn from the hour.
  - **G6:** every dock's edge drops 10 m to the hall's floor, unhurt (`oneWay` links to `well`), and the loft's edge to
    the Striking Room's floor. A mark on every dock; the antechamber's mark by the Foreman's door, as before.
  - **The way through** (the solver): the pit's eyes; the counterweight (the clock wound, the hand down at four); up the
    stair to the Pendulum Hall, its keepers and key, out by its floor door; the ball on four, the eye; on to six, the
    loft's key; on to two, the north door; the boomerang; the passage's eyes; the train hooked and the gallery's eyes from
    two; the Mainspring Room; four from the landing's lever, the Clockmaker's clock and the great key; two again; the
    great lock; the Foreman.
  - **The scout:** the counterweight before the hour (the hour is the last element, so anything else to do comes first),
    then the nearest lever (`GreatClock.center`); the train's ring once the hook is carried. The temple maps' steps say
    "Turn the great clock on to six, at a lever: the stair's arm meets the dock at six" and "Run the clock's striking train
    … at its ring". Which hour is worth setting next: `TempleLogic.stopFor(drum)` (logic.js, additive), the first stop
    that, tried, brings a room not in reach within reach or lets a waiting eye wake; the play-through and the route's
    playthrough agent (tests/playthrough-agent.js) ask it for a state of several stops.
  - **The audit** (all houses run together): steps 7 → 9 (skeleton `BAXLCRGXXLK` → `BAXXXXLCRGXXLK`), combinations 3 of
    7 → 6 of 9 (the counterweight with each hour: the docks want both), mean obviousness 3.07 → 3.22, decoupled 5 → 4,
    loops 1 → 5, the score 4.22 → 4.33 (combination 4 → 5, curve 3 → 4, decoupling 5 → 4; identity 3: 57 % like the Aerie). Each dock is a
    lock whose keys are the counterweight and a lever in the hall: G1's "cheap to change" reads as obvious, as the Belfry's bell. Rules broken: none before or after. Its climb is gone (`tests/temple-climb.test.js`: no climb now).
  Tests: `tests/clock-house.test.js` (new: the house on foot with a real traveller and a real boomerang: every lever pulled
  with the use button, the stair climbed step by step, the arm walked out to each dock, the turn ridden on the crown, the
  ring hooked from where he stands, both drops fallen unhurt, the Foreman set right; the old on-foot walk in
  `tests/temples.test.js` replaced by it), `tests/temples.test.js` (the hub, the hour's ways, old saves),
  `tests/temple-playthrough.test.js` (the hour set at a lever, several pulls for three stops; a stop that wakes something
  or reaches a new room first; the train's ring hooked from its `from`), `temple-maps`, `house-map`, `hook-reach`,
  `door-bypass`, `way-back`, `zfight`, `key-chests`. Old saves: `migrate.js` garage v4 (past the north door: the hand at two,
  the counterweight home; one that stood inside: to its last mark).
- **The Engine-House round its Engine Hall, the engine's clutch its state** (v1.83, issue #415; the approved
  recommendations, `docs/design/temple-best-practices.md`: G1, G2, G3b, G4, G6). `src/temples/buried.js`:
  - **The Engine Hall** (`EH`, G4) is the Piston Hall grown to 44 by 70 m under 32 (its room id kept, `pistons`), its
    **gallery** (`GALLERY`, room `gallery`) 7 m up round the north end and along the west wall, open over the floor. The
    great engine stands in its middle (`ENGINE`, `GreatEngine`); its valve's eye (`s1`) on a post by the way in, a stone ball
    in its crank's teeth (`ball0`, `lock`: out, it stays out). Woken (`RUN`), its flywheel turns and the hall's three pistons
    ride up to the gallery (`pumps`, `Platform` `when: RUN`), whichever shaft has the power.
  - **The state** (G1): the engine's clutch, a drum of two stops (`shaft`: `shaftLow` 0, `shaftUp` 1, starting up; `roll:
    'hand'`, `verb: 'power'`, saved). `UPPER`/`LOWER` (the running engine and the clutch) drive the pieces; the logic of the
    rooms past the engine reads the clutch alone (`UP_SHAFT`, `LOW_SHAFT`: by then the engine runs, for good). Upper: the
    Crank Hall's bulkhead (`dU`) rises, its hammer runs (`PoweredHammer`), the Crank Passage's and the Furnace's pistons
    rise in turn (`Bank` `drive`, new and additive in `pieces.js`). Lower: the boilers' firebox door (`dF`), the governor's
    shutter (`dG`, held up by a ball in its crank, `bD`, then latched), the Governor Room's pistons and hammer. **Cheap to
    change:** a `PowerLever` (A / ×) by every hub (`LEVERS`: the hall's floor by the engine, the gallery by the drop, the
    Fourth Chamber, and the Crank Passage past the hammer). **Readable everywhere:** a `PowerGauge` in every room but the
    guardian's, two lamps on a post, the upper one amber over the lower one blue, one lit (both dark while the engine is
    still), the same two lamps on the gearbox and every lever; the shaft with the power turns, the other stands, and the
    clutch arm on the gearbox points up or down. On the way it is set down (the firebox, the Governor Room) and up (the
    bulkhead, the passage, the Furnace), and down again for the great key if it was left.
  - **The Boiler Keeper** (`KEEPER`, G3b, the house's mini-boss): the Boiler Room (east, the lower floor) is the house's one
    fight and the only way to the chest. Its arena has a `keeper` (`src/foes.js placeMachinesIn`, new and additive: an
    arena's `{ kind, def, size }` is its room's one foe, at its mark's `foes`; `Foe` takes a `def` laid over its kind's,
    its own combos first): a furnace brute in its own skin (`brute@perdide2`), drawn 1.3 times its size, 16 hearts of
    harm. Its slam is the lesson: both fists high for 1.5 s, down, a quake along the floor (jump it), then stuck for 2.4 s
    (`opens`, `stuck`: the blade lands double). The Tooth-Warden's stomps and slam end the same way, its vents open: the
    bombs then. Beaten, the small key's cage sinks and the door north (`dC`) opens onto the Fourth Chamber.
  - **The rooms moved** (its own shape: the Engine Hall the hub of both floors; the lower floor east, the Boiler Room, the
    Fourth Chamber north of it, the Governor Room north of that; the upper floor north of the gallery, the Crank Hall, the
    Crank Passage, the Furnace, the Tooth-Warden's hall). The chamber's four eyes (`k0`) roll up its shutter west back into
    the hall (`dS`, the loop) and the governor's with its ball and the lower shaft. The Crank Passage's ball now lies on the
    pistons' far side, in sight of its door.
  - **G2, the late step**: the Furnace's bridge (`br1`) wants four eyes in a breath, the bombs, and the two east pistons
    stand only while their clutch bites (`cF`, a held bell, `CLUTCH.hold` 14 s): its ring (`hb.clutch`, a `HookBell`) hangs
    over the far lip's edge, hooked from the near lip (`BellEar` `ringId`). The house is walked in with the hook
    (`tests/temple-playthrough.test.js` `CARRY`, `tests/temples.test.js` `OLDER`).
  - **G6**: the gallery's west arm is open over the floor for 10 m between two posts (`GALLERY.drop`, `oneWay`
    `gallery → pistons`): 7 m down, unhurt. The guardian's checkpoint: the antechamber's mark by its door, and a mark on the
    Furnace's far lip.
  - **The temple maps**: "Send the engine's power to the upper / lower pistons, at a clutch lever" (`makers.js`).
  Nine steps (was six): the hall's pistons, the bulkhead, the hammer, the firebox door, the chamber's shutter, the
  governor's shutter, the great key's cage, the passage's door, the Furnace's bridge; the arena before the chest. Design
  audit 4.56 before and after: skeleton `XBCGXALXLK` → `XBBXACGXXLXLK`, combinations 4 of 6 → 6 of 9, mean obviousness
  3.08 → 2.83, decoupling 4 → 8 keys apart, the chest at 44 % of the steps, identity 70 % like the Casting-House → 69 %
  like the Lamp-House; the redesign's rules: none broken. Tests: `tests/engine-house.test.js` (the house on foot with a
  real traveller: every lever pulled with the use button, every ball pushed, the drop fallen unhurt, the ring hooked, the
  warden stopped, the pipe-cart; the Boiler Keeper placed by a real `Foes`, its slam's wind-up and its fists stuck, the
  blade double; the gauges and levers), `tests/temples.test.js` (the solver both ways, every step needed, the state, old
  saves), `tests/temple-playthrough.test.js`. Old saves: `migrate.js` buried v4 (with the bombs or past them: the keeper
  beaten, its door open; with the great key or past the Furnace: the governor's shutter up and its ball home; one that
  stood inside: to its last mark). The Unity bridge carries it as it is (the same JS); the brute's surface patterns are
  #264's known gap, listed in `engine/bridge-gaps.js`.
- **The Givers carried their fire** (the Rose House, from the v1.24 audit; the house's one fire, the pilot flame,
  never went out; the rooms below as they were until v1.44). A `Ball` with `tar: { burns }` is a tar ball: an ember glob lights it, and so does rolling it past a
  fire beside its groove (any piece with a `fire` point within its `fireReach`: a `Flame`, the pilot flame sunk in the
  floor, or a lit `Brazier`); it burns `burns` s, its flames shrinking, then goes out. A `Brazier` with `hood: { ball }`
  takes no ember: only its ball, at rest in its mouth (its plate) and burning, lights it; cold, the mouth tips the ball
  back out (`tipBack`). A ball with `thorns: { id, at }` stops against a `Bramble` across its groove, or burns through
  it if it burns. The Hall of the Flame teaches it before the gadget (the ball through the pilot flame into the bowl by
  the door, `b0`, whose element has no `needs`: only `when` the ball is there); the Dry Channel's flame is behind its
  ball (back through it first, then into the thorns over the bridge's sockets, `bw2`); the chest's thorns `bw0` are
  the gadget alone, and the chest's ball rolls on through them to the Hall of Fires' bowl (`b3`, the bridge); in the
  Hall of Channels a ball lit at the start burns out short of the far door's bowl (`b4`): the relay brazier `b10` by
  its groove lights it again as it passes, and wakes the keepers' door `sc` back to the near ledge. The Keeper turns
  to fire (`HEARTH_FIRE`, `rt.spokes`: a tar ball in each of four spokes, rolled in past its rim brazier). A link may
  be held by a latched element itself (thorns over a doorway): `logic.js` keeps it shut until it is lit.
- **Where a moon rests, the house leans** (the Moon Foundry's Casting-House, `moonfoundry.js` + `moonfoundry-data.js`,
  v1.40; its guardian's body `guardian-founder.js`). A round casting tower on the hangar's east side, its chimney up to
  the girders; inside, every door, hoist and bridge is held by a moon's weight in a cradle. Stone moons (test casts) roll
  for a plain push; iron moons (`Ball` `heavy: 'tongs'`, `iron`; their drum `needs: ['tongs']`) only for a push made with
  the **founders' tongs** (item `tongs`); an iron moon with `tar` rolled through a pilot `Flame` comes out hot and lights a
  hooded mould (`Brazier` `hood`). The Pouring Floor is the hub: the founders' moon seen from the first step, too heavy,
  rolled at the end through its flame into the great cradle under the Founders' Door; the Mould Room's seam-eye wakes over
  the stone moon rolled in from the hub; the hoist runs while its pan holds a weight (you in it rise nothing: a `Watch`
  says so; the stone moon stands in); the Tong Chamber's try (an iron moon into a cradle nothing waits on); the Pincer
  Passage's cradle a room on (since v1.77 on the chamber's floor, above), and a second iron moon whose rail ran under
  that door (`gap` on the door; since v1.77 on the furnace's near lip) through the furnace's pilot flame into the hooded
  mould (the twist); the founders' press (`Hammer`, `hm`, until the founder is
  stopped) over the bridge; the Weighing Hall's keepers' pan and lidded eye, the keepers' door back onto the hub (the
  shortcut). The **Last Founder** (`founderModel`, a robot): splash its molten heart when its crucible doors open; from
  its second phase an iron moon in its casting cradle (`mA` on `pA`) makes it stop to look (a splash counts twice); in
  its last it tips the moon out as it shifts and the water only takes with the moon back in. After: its one whole moon
  hangs from the jib over the door and the chimney's glow is steady (`change`). Petra, who keeps the founders' ledger, is
  its local.
- **Pulling things home across the void** (the City Floating in Space's Mooring-House, `spacecity.js` +
  `spacecity-data.js`, v1.40; its guardian's body `guardian-anchor.js`; since v1.83 the Drift, the Cable Walk and the
  Balance are the Mooring Hall round the moored room: "The Mooring-House round its moored room" above). A round adobe drum with the moorers' great
  capstan on its roof, on the Moorings (`ISLANDS.moorings`, a rising bridge from the Towers); inside, floors that stop
  short over the stars. **Tether mode** (item `tether`, a gun mode: the push's cone, its targets handed `'tether'` and
  the way back to the hand) rolls any `Ball` toward you and wakes a moorers' ring (`Switch` `pull: true`, element
  `needs: ['tether']`); a drum with `needs: ['tether']` is a ball out on its cable-rail where nobody can stand behind it.
  The Capstan Hall is the hub: the Winch Room's counterweight lifts the Lamp Shaft's gate, the void's breath (`Updraft`)
  lifts the wings to the lamp-eye that opens the great door; the Cord Loft's chest and its try (a ring that lowers a
  lamp); the Mooring Passage's ring a room on; the Drift's ball pulled home off its cables raises the gangway to a far
  landing six metres higher than any glide; the Balance (the twist): one ball, pushed OUT to its far cup the balance's
  pan (a `Platform`, `gW`) rides up to the Moorers' Gallery, pulled HOME it frees the west door with the Gallery's ring
  (on a davit, seen from the door, out of reach but from the Gallery); the same ring opens the moorers' gate back to the
  hall's balcony and its cradle (the shortcut, a `oneWay` link). The **Anchor-Warden** (`anchorModel`, a robot):
  when its drum stalls after a throw, pull its anchor home (`rt.anchorPull`, a target that accepts `'tether'`); in its
  second phase the anchor hooks over a bollard; in its last it lies out over the void past a window, out of reach:
  push its bars (`rt.windAnchor`) to wind it in, then pull. After: the great cables from its roof to the Towers, the
  Balcony and the far island hum taut, lamps along them, and the capstan turns (`change`). Joss the moorer is its local.
- **The note crosses what you cannot** (the Underwater City's Whale-House, `underwater.js` + `underwater-data.js`, v1.40;
  its guardian's body `guardian-listener.js`). A great whorled shell on the sea floor at the end of the last tube (its
  flat facade seals the tube's end, `WHALE_HOUSE`), brass horns curling out of it. Your water stops at glass; a note
  goes through glass and water. The **whale-horn** (item `horn`) sounds one fixed note, the deep one (`NOTES.deep`, an
  `'echo'` from `effects.js`), and the house's `EchoEar`s with `note: 'deep'` (elements `needs: ['horn']`) answer it.
  Before the horn: the Sounding Hall is the hub (v1.77: the west door's eye on a pillar, lidded till the hall's ball is
  in its cradle; the Pool Room's ball in its cradle by the glass for the east door; the Horn Door wants the pool's eye,
  splashed over a glass wall you can't climb, and the Shell Room's eye, unlidded by its ball). The Horn Chamber's try (a
  little horn that answers); the Song Passage's door held while the horn by the chamber's north door rings (`hold`: a
  short run); the Tank Hall's twist: a ball on the footstone wakes a
  `Dish` whose twin on the shelf says the note to the shelf's ear across the water, and while that ear rings the tank's
  glass is climbable (`Glass` `rungs: true`: brass rungs slide out of its frame instead of a vine, and back in when its
  `when` fails); the keepers' door from the landing (the loop back, its horn); the landing's dish, woken by its ball, carries the
  note to its twin high on the Listener's column before the Listener's Door, whose ear (out of the horn's reach from the floor, and deaf without
  that ball) opens it: the key seen from the lock, reached elsewhere. The **Listener** (`listenerModel`, organic): when
  it spreads its great ear, sound the horn close by; from its second phase it shuts its ear to anything near and only the
  hall's dishes reach it (`ARENA_DISHES`, a ball on a footstone each); shifting into its last it knocks the balls off.
  After: the lamps in the house's horns and along its seam are lit (`change`), and the whales come back to the glass
  (`src/story/underwater.js`, `level.whalesNear`). Achille, who keeps its door, is its local.
- **The lens shows where the walker set things down** (the Footprint, from the same audit). What is real carries the
  walker's print (`printGeometry(toes)`: three toes, like the Footprint itself); look-alikes carry two or four. The
  Lens Chamber's `Mural` (lens only, the element `mural` of type `clue`, which a gate names in `clue` so the audit
  counts it as a key a room back) shows the print; the Hall of the Unseen's `LensStones` are a field of stepping stones
  only the lens shows, the walker's holding, the rest crumbling a moment after you step on one (you fall, back to the
  mark; it rises again). A `Plate` may carry a `print` and be `hidden` (only the lens shows it): on the far landing the
  sphere's `stops` are two plain prints and the walker's. Since v1.27 the Hall of Spheres opens with the idea before the
  lens: one sphere whose `stops` are carved prints of two, three and four toes, and three prints beside it to stand
  on (by the wall until v1.77); the door wants the sphere on the walker's and you on the walker's (`solve` tries a ball's stops with you standing
  on each plate). The Still Pool's sphere floats (`Ball` `current`: the water
  draws it back unless a plate stills it, `pS`); the keepers' gallery runs from the far landing back to the Lens
  Chamber, its door (`sc`, hidden) opened by an eye on its far side. The Echo's resonant spheres wear the print on the
  one that answers (docs/systems/foes.md).
- **A room on** (v1.27, the temple design audit's third rule): no temple's chest room has a gadget door any more. Its
  way on is open into a short room of its own (the Belfry's Bell Porch, the Engine-House's Crank Passage, the
  Undertower's Listening Passage, the Greenhouse's Bud Passage, the Hush-House's Snapping Passage, the Lamp-House's Lamp
  Passage, the First Garage's Winding Passage), and the old door, with its key, stands at that room's far end: the
  gadget's first lock, where a miss costs nothing. The chest room keeps a try where one was cheap (a target that
  answers the gadget and locks nothing: the Bell Chamber's bell and its stones, the Fourth Chamber's four still eyes,
  the Seed Chamber's seed in the sun, the Lantern Chamber's lamp, the Shell Chamber's low stone). In the logic the
  passage is part of the chest's room (the way between is open, and nothing past the passage opens without the gadget).
- Pieces can be `hidden` (Door, Switch, Bridge, Plate): only the glyph lens shows them.
  (`hidden: 'lantern'`: only the lantern charm's light.) `LightEar`: a lamp that
  wakes when you stand by it with the lantern; a temple with `dark: true` sets
  `player.inDark` inside, and the lantern charm glows there day or night.
  A shut door can't be climbed (its collider is `noClimb`). `Bank`: four eyes that wake only
  together inside a breath (the fourth chamber's key). A `Platform` may start part
  way along its path (`phase`), and keeps a rider on it as it goes down. A world
  change may bring moving floors of its own (`solids()`, like the pipe-cart).
- **Tests**: `tests/temples.test.js` checks the logic, the solver (every built
  temple solved, its gadget mid-way and needed for every later room), the
  guardians, the 50/50, the migration, the words' tones, the buildings in their
  worlds, and plays each temple on foot with a real `Player` in the real level
  geometry: pushing the ball, riding the discs, climbing, lighting, flying, the
  keeper calmed or broken, the way out and the world change. The First Garage's
  banks are shot at the real magic bar's pace (`Reserve`, `resources.magicPace`: three units, refilling
  1 s after the last shot and full in 4 s; 0.5 s and 2 s with the coil), so the test proves six
  eyes in 4.6 s want the coil (and the Engine-House's four in 2.6 s want the fourth chamber's unit:
  `needs: ['magic:4']`, a capacity, not an item, `tests/resources.test.js`); the Hangar's portals are checked to still send
  you through; the echo shell and bloom mode have tests of their own.
- In the browser, `temples.<world>` is the runtime (its `logic`, `guardian`,
  `piece(id)`), for poking at from the console.

## No climbing but the climbs (v1.49, issue #115)

A climb past a puzzle trivialises it, so a temple's walls are not climbed. The runtime's kit (`rt.kit.noClimb`) bakes
the interior's collision proxy `userData.noClimb`; the solids built inside `K.climbable(why, fn)` go into a second proxy
(`userData.climb`), and `Physics` keeps both as a climb mask (`climbMask`, built only in a world with a temple):
`climbable(p, r)` lets a climber's chest take hold only where the nearest wall is a marked climb. `startClimb` asks it
(through `noClimbNear`), and `updateClimb` holds a climb to it, so you can't shuffle off a climb wall onto the walls round
it. Pieces' colliders (doors, brambles, gates, bridges) are added `noClimb`. The exteriors stay climbable.

The climbs the houses keep (`rt.kit.climbWhy` lists them): the Rose House's gallery (the Dry Channel's way up to the
Sword Chamber, its glyph handholds), the Warden's Well's Climb (the block's face to the balcony), the Hush-House's and the Lamp-House's root-walls (from the
riding disc and the moss-stones to the landing at 9) and the Lamp-House's loft of roots (the third pool), the
Greenhouse's Glass Stair root-wall (to the sun-disc) and its two glasses (the Vine Gulf's and the Seed Vault's: climbed
once a vine is up them, the `Glass` piece slipping you off till then), and the Whale-House's tank glass (its rungs). The
other eight houses have none (the Clock-House's Winding Well block went in v1.83, issue #414: the Escapement's stair turns
in its place). `tests/temple-climb.test.js` pushes a real `Player` into the wall beside every lock's
doorway, both faces, and into whatever a key stands up on, in every temple: he never takes hold.

## Hubs, keys and arenas (v1.48, issue #23)

A temple to explore, not a corridor of rooms in order: a hub with wings, keys found in one room for locks in another,
rooms that shut behind you until their foes are beaten, optional rooms with a reward. The kit's pieces for it, any
temple can use:

- **Keys** (`logic.js`, element `key { kind: 'small' | 'big', room, when? }`; piece `Key`): a key of the house's brass
  in a little makers' chest (below), in a cage of brass bars that sinks once its `when` holds (the step that earns it).
  Open the chest and it is yours (`logic.find`, flag `found.<id>`). A small key turns any small lock (Zelda's:
  `keys('small')` is the keys found less those put in a lock); the great key the guardian's door.
- **The key's little chest** (issue #274, the author: "When I get a key in a temple there should be a sound effect, it
  should be in a little chest. And I should have a key counter on my screen. Like Zelda"; until then the key turned over
  a stone plinth and was taken by walking up to it). The makers' chest, the same model and opening as every chest
  (`buildBox(id, { scale })`, src/boxes/model.js), set down at `KEY_CHEST.small` (1.0; the great key's 1.3; a box's is
  1.9) on the floor where the plinth stood, a low collider round it, its cage round it (`cageH`: the Engine-House's
  great key's reaches up to the hammer that runs on it). Its interactable (`temple.<id>.<key>`, "open the chest", only
  once the cage is down) opens it, and the key is yours at once (saved); the rest is a short scene of its own, not a
  box's (`KEY_CHEST`, 2.4 s, the player free all through): the latch clicks (`Sound.boxLatch`), the halves part over
  0.55 s with the chest's light (`ChestLight`, its column `KEY_CHEST.height` of a box's, `reach`), its lamp and its
  linings lit, the key rises out of the light turning (at `KEY_CHEST.key` of the plinth key's size) and rings
  (`Sound.keyGet`), hangs, and flies up into the counter at 1.9 s (`flying` until then, so the counter counts it as it
  arrives; the notice says what it is). Left open and quiet, on a load too. Its floor: flat out past its cage, with
  room to stand before it (`tests/key-chests.test.js`, every key of every temple; the Seed Vault's great key moved up
  onto the ledge's trim it stood 0.2 m into).
- **The key counter** (`rt.keyCount()`: the small keys in hand and the great key, a key still flying not yet in;
  `src/hud.js keysHud`, index.html `#keys`, main.js `updateKeys`): shown while you are inside a house that keeps keys,
  at none too, under the hearts when they show (docs/systems/ui.md). A key going into a lock clicks softly
  (`Sound.keyTurn`, where a clank was), and the lock letting go chimes.
- **Locks**: a `door` with `lock: 'small' | 'big'` (and `keys: n`, n keyholes) opens only once its keyholes are filled
  and its `opens` (if any) holds. The `Door` wears a brass lock plate, a keyhole lit for each key in; walk up to it with
  a key and the key goes in (no button), one a keyhole (flag `unlocked.<id>`, the count). Without one it says what it
  wants, once. The marker (`logic.next`) points at a lock a key fits before anything else. Design the keys so none can be
  wasted: every small lock opens toward rooms that need no other small key, or there are as many keys as keyholes on
  the way (`solve` with `reverse` and `forbid` checks a hub either way round and each wing alone).
- **Arenas** (element `arena { room }`, latched; the temple's `arenas: [{ el, room, zone: { min, max }, doors, extra,
  shut, won }]`, `runtime.js updateArenas`): step into the zone while its element is unlit and its foes stand
  (`src/foes.js placeMachinesIn`: the room's mark's machine and `extra` more, `rt.machines` by room) and its doors are
  held shut; once none stands (or none came: the Enemies setting off) the element is lit for good and the doors let go.
  A door that opens on it (`opens: { lit }`) is the arena's way out; a key may wait on it (`when`). Knocked out in it,
  you wake at its mark and the fight goes on (the broken stay broken).
- **Coffers** (element `cache { room, when? }`; piece `Coffer`): a little brass-bound coffer in an optional room; E opens
  it and a purse of chimes spills out (game event `'temple:cache'`, `src/chimes.js` `PURSE.cache`, once per save: flag
  `res.cache.<id>.<el>`). Nothing waits on it; it sits last in the elements, so the marker never points at it.
- **`K.corridor(a, b, y, { w, h })`** (`kit.js`): a short covered passage along x or z between two rooms, a hub's spoke.
- A **Mark** is never taken through a shut door (a ray from you to it): a mark just past a locked door, within its 4 m,
  once made a fall put you on the far side of the lock.
- **Old saves**: `migrate.js LAYOUTS` brings a save from a temple's old layout to its new one once (`temple.<id>.layout`):
  past the point a new lock or wing sits before, the keys are in the lock and the wing counts as done.
- **The audit** (`scripts/temple-design/lib.mjs`) reads them: a key's cage is a step of its own (its `when`, in its room),
  a lock a key alone opens and an arena's way out are not puzzles (a key from afar is no obscurity: the lock says what
  it wants), keys fetched across rooms count toward the structure, and the skeleton writes `L` for a key lock and `A` for
  an arena.

The **Clock-House** (`garage.js`) was the first reworked (its audit 2.89, the lowest; structure 2). Its Winding Well is
the hub: west the **Pendulum Hall** (an arena: two keepers and the mark's; won, the key's cage on the landing sinks and
a door above opens onto the ledge over the climb, a loop back to the hub), east the **Striking Room** (the hour track: a
ball and three plates at two, four and six, each with its little clock; on four, the house's hour, which the well's clock
shows, the striking eye's lids open, and woken it lets the key out), either order; the door over the climb (`d2`) takes
both keys and the counterweight. After the chest, the **Mainspring Room** east off the Clock Gallery's near landing (a
ball rolled in from the landing winds the spring, then six eyes round it in one breath: the coil with an older verb)
holds the great key for the Foreman's door (`d4`, also the arena's door while it fights), seen locked across the bridge
first. Off the Escapement's far landing the optional **Clockmaker's Cupboard** (its little clock has lost its hand:
four, eight, twelve, round from the house's hour, a quiet lesson for the gallery's great clock) holds a coffer.

The **Builders' Greenhouse** (`edena.js`, 3.67, structure 2) next: its Potting Hall is the hub. West the **Shade House**
(an arena in the dark: no louvre, dead pots; won, the small key's cage sinks), east the **Cold Frame** (one louvre, one
ball, two plates, an eye over each seed tray: an eye woken in the sun stays awake, so the ball serves both in turn, and
the key wants both, the lesson the Glass Stair's one ball and two plates then turns). The Glass Stair's door (`d1`)
takes both keys and the Potting Hall's eye in the sun.

The **Undertower** (`bazaar.js`, 3.78, structure 2): its Cable Well is the hub. West the **Cable Store** (an arena among
drums of spare cable), east the **Tuning Room** (a pair of dishes across the room: the near one deaf until a ball rolled in
from the well, a room back, is on its footstone; a low and a high stone by its mouth; the far horn wants the high note, its
ring the high one's colour, as the well's own horn is told by its colour). A door in the passage from the landing into the
Shell Chamber (`dK`) takes both keys.

The **Warden's Well** (`incal.js`, 4.22, structure 2; since v1.83 two doors of a small key each at its hub, "The Warden's Well round its Well" above): its Climb is the hub, its ways west and east south of the block
(`WING.a`). West the **Ash Store** (an arena in the tower's old ash), east the **Vane Room** (a chasm whose stones stand
only while the small vane on its post in the chasm turns, on its far wall until v1.77, `VANES.wing` s: splash it from this side and cross before it slows; the
key on the far side, and back the same way). The door at the balcony's end (`d1`) takes both keys and the ball on its plate.

Round 2 (issue #23) varies the shape, so the reworked houses stop sharing one template (two wings off a hub before the
chest, one door of two keyholes). The **Engine-House** (`buried.js`, 4.0, structure 2) is a hub *past* its chest: the
Fourth Chamber's four still eyes, once a try that opened nothing, sit two by each of its two shutters, west and east
(one element `dS`, two `Door` pieces: a second piece of an id is its twin, `runtime.js` `twins`, and opens with it), so
the fourth chamber's first lock opens the hub. West the **Boiler Room** (an arena among cold boilers; won, the small
key's cage sinks and its flue opens, north and east into the Crank Passage beside its door: a loop back), east the
**Governor Room** (the great key caged on an anvil under a hammer; one ball between two cranks, the hammer's and the
one under four eyes on pistons. Rolled to the pistons', they stand for four in a breath, but the hammer runs down on the
cage; rolled back, the eyes stay awake and the cage sinks: `kB`'s `when` wants both). The Crank Passage's door (`d3`)
takes the small key and its eyes, the Tooth-Warden's (`d4`) the great key. The audit reads a lock that wants one ball at
two of its stops as an order to find (`sequence`). The wings' marks are placed after all the others, so the machines'
ids by mark (`foes.<id>.m<i>`) stay as old saves knew them.

The **Aerie** (`arzach.js`, 3.78, structure 3) is a stack: rooms off its Wind Well at its foot and up its height. The
**Moult**, west off the floor, is an arena (the small key, before the chest: the way north off the high balcony takes it);
a ledge round the well's west wall from the high balcony leads to the **Eyrie** (`STACK`), two vents and one stone, both
throats on its ledge: as the stone starts the wind comes out of the ledge's own vent, a column beside a shelf with a
coffer; rolled into that vent's throat, the column rises out of the gap's foot instead, past the great key's perch six
metres over the ledge (the Roost's two vents and one stone, taught a house early). The Roost's door takes the great key.
The marker (`logic.next`) now also points at a ball whose stop holds a door shut (`holdsShut`: a gate that wants it
`not` there), so it no longer stops pointing at the Gulf's vent stone.

The **Builders' Greenhouse** (`edena.js`, 3.78 after round 1, its curve 1) gets its late steps up: the Bud Passage's bud is
in the shade until a ball turns the passage's louvre onto it (the bloom with the push, where it was the bloom alone), and
past the Vine Gulf, west off its far side, the **Seed Vault** (`VAULT`; moved in round 4, below): one louvre, one ball, two seeds at the foot of a
wall of glass; the vine climbs it only from both seeds, so the ball brings the sun to one, then the other. The great key on
the ledge at the top opens the door past the bud (`dB`) into the Glasshouse. Its Cold Frame's eyes and the Glass Stair's
eye now come before their balls in `LOGIC`, so the marker points at an eye that can wake before the ball's other plate
(it went back and forth between the plates; the playthrough now plays the Greenhouse and the Engine-House to their
guardians, and reports a temple it walks eighty steps in without getting anywhere).

The **Undertower** (`bazaar.js`, 3.89 after round 1, its curve 5 → 3) likewise: the Listening Passage's horn is deaf until
a ball is on its footstone (an `EchoEar` whose element has a `when` says `deaf` while it does not hold), and past the
Gallery of Voices, west off its far side, the **Choir** (`CHOIR`; moved in round 4, below): two horns, the great key caged between them. The far
one hears only a stone's own low song through a pair of dishes (`hears: 'note'`, a ball on the near dish's footstone), the
near one the high note played back, the high stone at the far end; the shell keeps the last note, so the low stone sung
by the near dish is caught too. The great key opens the far door (`d4`, its two lamps as before).

The **Lamp-House** (`perdide2.js`, 3.67, structure 3, its curve 1): the **Kennel**, east off the Hall of Dark Pools, is an
arena in the dark (`KENNEL`; the small key, for the Lamp Passage's door, a room past the chest); past the Dark Gallery, east
off its far side, the **Wick Room** (`WICK`; moved in round 4, below): two niches, two pool-orbs, one lantern, the great key behind a grille (`cW`)
that lifts for good only while both niches burn. A niche's lamp burns only while its orb glows: its element has `hold`
(the orb's time) and a `when` (its orb home), and the orb's piece puts it out when its glow ends (`Ball` `lamp`), so the
second orb has to be lit and rolled home inside the first one's glow. The great key opens the gallery's far door (`d4`).
The audit (`scripts/temple-design/lib.mjs`) sorts a lock whose keys want the gadget after the chest wherever its room is,
and leaves out a door that opens with another (`{ open }`) as a step of its own.

The **Founders' Belfry** (`arzach2.js`, 4.0, structure 4) had a hub of two stone stores already, a ball in each; its west
store is an arena now (its archway `dSW` shuts behind you; won, the small key), so the Hall of Stones' door takes the key
and the east ball's weight (`drumOn`, where it was the plate pressed: standing on it yourself no longer latches it).

Round 3 (issue #23, v1.53) takes the houses round 2 left: the lowest (the Hush-House), the five with no arena, the shapes
still most alike, and a great key that need not sit in a room off the last puzzle hall.

The **Hush-House** (`perdide.js`, 3.67, the lowest; its middle cheap): the Snapping Passage has two more mouths of jaws in
its walls (`MOUTHS`), each crowned with a crystal (small, middling, the gate's the biggest), and they still only in the
Choir's order (`j1`..`j3`, `after`; a `Jaw` stilled out of turn rings flat and says so, `wrong`); the smallest keeps a
coffer in its niche. West off the Pendulum Gallery's far landing, the **Nursery** (`NURSERY`) is an arena; won, its small
key's cage sinks and the keeper's gate along the gallery's east wall opens (`ds`, `{ lit: 'arN' }`: its footstone was a
step of nothing). The small key opens a door of one keyhole on top of the Bog Well's root-wall (`dL`), on a ledge round
the well's west wall at 9 m (`LEDGE`) that goes south through the well's wall over its door and the Choir's north wall
onto a **balcony** over the Choir's first crystals (`BALCONY`): the great key, seen from the Choir's floor at the start,
behind a wall across it, and a ball in a groove that runs through a snapper's mouth in that wall to the cage's footstone.
Shut, the mouth spits the ball back (`Ball` `jaws`); stilled, it opens, but its element has `hold` (`Jaw`: the frost
thaws, it warns, and the jaws snap shut again), so the ball has to go through before it wakes, and it is stilled again
to walk through. The far door (`d3`) takes the great key. The great key is in the first half, reached by a loop back
past the chest, not off the last hall. (Since v1.77 the side mouths stand in shrines on the passage's floor, the ledge's
door is the well's west door at the end of a short ledge, and the balcony runs down the Choir's west side, reached by a
walk outside its wall: "The Hush-House as shrines" above.)

The **Mooring-House** (`spacecity.js`, 4.22; no arena, 78 % like the Warden's Well): south off the Moorers' Gallery the
**Rope Store** (`STORE`) is an arena; won, its small key opens the moorers' gate (`sc`, a small lock now: the Gallery's
ring opened it before). Inside the gate, on the Capstan Hall's balcony over the hub the house began in, the great key's
cage and a ball out along a cable-rail round the hall's wall (`PERCH`): pulled home onto the cage's footstone (the
Drift's lesson again), with the Gallery's ring pulled (its chain holds the cage too), the cage sinks; the Capstan Floor's
door (`d6`) takes the great key. A loop back to the first half, past the Balance, not a room off the last hall. `solve`
now also prefers a ball's stop that brings a lock a key in hand fits within reach (the Balance's ball home, toward the
great lock past the west door).

The **Clock-House** (`garage.js`, 3.78; its curve 2, its hardest steps first): the Mainspring Room no longer holds the
great key. Wound (its weight home, six eyes in a breath), the mainspring starts the house's little clocks again: the
Clockmaker's Cupboard's three eyes, back off the Escapement's far landing, are lidded until it runs (`when: { lit: 'k3' }`;
a `Switch`'s `unmet` says why, a `Bank`'s `woke` says what it started), and the great key is in the cupboard now, beside
its coffer. The way back down is the Pendulum Hall's: over the climb's ledge, down its stair. A state the whole house
reads, and a loop back to the first half. (Since v1.74 the Mainspring Room itself is in the first half, across the
Escapement's landing from the Cupboard: round 6 below.)

An arena in the three houses that had none, each its small key for a later door that keeps its own condition: the
**Whale-House**'s Horn Store, off the Sounding Hall's south wall, a wing of the hub (`underwater.js` `STORE`; the Song
Passage's door `d4` takes the key, a room past the chest, with its horn's note); the **Casting-House**'s Sand Room, south off the Mould Room before the
chest (`moonfoundry.js` `SAND`; its key carried from the first rooms to the last door, the Founders' Door `dF`, with the
founders' moon hot in its cradle); the **Footprint**'s Keepers' Lodge, west off the Keepers' Gallery (`spheres.js`
`LODGE`; the Hall of the Unseen's far door `d4` takes it with its eye and the sphere on the walker's print). Each wing's
side that meets its hall is that hall's own wall (`omit`), so no two walls lie face on face (tests/zfight.test.js).

Round 4 (issue #23, v1.60) takes the three houses that still kept their great key in a room off the last puzzle hall and
had no loop (the Undertower, the Lamp-House, the Greenhouse; the v1.53 report's ranked edits 2 and 3). In each the great
key's room moves back into the first half, seen (or shut) on the way in and worked with the gadget on the way back, and a
keepers' door out of it closes a loop. Each in its own shape:

The **Undertower** (`bazaar.js` `CHOIR`, `WALK`): the **Choir** stands over the Cable Store at 12, between the two hubs.
Its keepers' gate opens off a walk round the Cable Well at 12 (one floor with the landing; the well's raised gap at
`CHOIR.gap`, stacked over the way west), and its door onto the Shell Chamber's west gap goes with the gate (`dC`, `{ open:
'dG' }`). The gate listens through a horn at the far end of its cable (`hG`, on the Hall of Dishes' far landing: the cable
runs from it along the floor, into the well and up its wall to the gate), for the middle note played back. The singing
ball across the pit sings it, and its dish brings the note over the landing; the gallery's middle egg is the other
source. Inside, the far horn (`hA`) hears the low stone through the dish pair (the ball on the near dish's footstone) and
the near one (`hB`) wants the high note: nothing in the Choir sings it, the Cable Well's high stone does, on the floor
below the gate (the shell catches it from the walk). The Store's roof is shut now (the Choir's floor is over it). The
Choir's elements come after the gallery's in `LOGIC`, so the marker sends you through the gallery first and back for the
far door's key. The audit's clue for an echo ear is the nearest stone of its note: the singing ball 45 m away for the gate.

The **Lamp-House** (`perdide2.js` `WICK`, `ROOT_WAY`): the **Wick Room** is east off the Hall of Dark Pools (beside the
Kennel, north of it, past the hall's last column), open and dark on the way in. The Kennel's small key goes into its
grille (`cW` `lock: 'small'`; the Lamp Passage's door `d2` is its lamp alone again), which lifts once both niches burn: the
lantern comes back down for the great key (since v1.77 the niches and the grille in the wick-house in the middle of its
floor, `WICK.face`). A stair up its north wall to a balcony at 9, and a keepers' door (`dU`, `{ open:
'cW' }`) through the Root Stair's east wall onto a ledge of roots inside it (`ROOT_WAY.ledge`), on to the root-wall's top:
the way back up to the chamber without the moss-stones and the climb.

The **Builders' Greenhouse** (`edena.js` `VAULT`): the **Seed Vault** is north off the Shade House, beside the Glass Stair;
its door (`dV`, `{ lit: 'arW' }`) is the arena's second way out, so it is seen, seeds in the shade, before the bloom. Its
glass is on its east side now, the great key on the ledge at 9, and beside it a keepers' door (`dV2`, `{ open: 'vineV'
}`) through the Glass Stair's west wall onto a ledge inside it (`VAULT.inner`) and the root-wall's top, by the sun-disc:
the way back up to the landing.

Old saves (`migrate.js LAYOUTS`: bazaar v4, perdide2 v3, edena v4): with the great key already found, or past the far door,
the moved room counts as done and its doors stand open; a Lamp-House save whose Kennel key went into the passage's door
has it back in hand for the grille. Each house's on-foot test in `tests/temples.test.js` walks the new route (the drops
off the landings cost nothing: under `FALL.tumble`), and the logic tests check the loop's links and that the keepers'
doors open only with the gadget.

Round 5 (issue #23, v1.74) takes the three houses the v1.66 report still found without a loop (the Aerie, the Founders'
Belfry, the Warden's Well; `structure.cycles` 0, or only the way back over the Aerie's Gulf), each in a shape of its own,
neither two wings off a hub nor the great key in a room off the last hall:

The **Aerie** (`arzach.js` `STACK.chute`): **a circuit round the stack, flown down and ridden up, its way the one stone's**.
The vent at the Eyrie's gap's foot is the top of a shaft (`K.shaft`, round, open at the top: its stones stop inside its
capping trim) down through the Moult's roof, the Moult moved west under it (`STACK.moult.x`). While the Eyrie's stone sits
in that vent's throat (`pU`, as it starts) its air is still, and the shaft is a way down (`chute`, a gate on `{ drumOn: [bE,
pU] }`, a `oneWay` link that needs the wings: drop into its mouth, open the wings in the shaft); in the other throat
(`pC`) the wind rises out of it past the great key's perch, as before. The Moult's door onto the well's floor (`dM`) is
shut till the Moult is won (`{ lit: 'arM' }`, the arena's way out), so its small key comes after the wings, and the raft
and the column take you up again. The gap's dark floor and its pit are four pieces round the vent's mouth. `solve` scores
a ball's stop that brings a room never reached before over one that only trades a room for another, and the marker points
at a ball's stop only for a door that leads somewhere out of reach now (`awaitedStop`), so it no longer sends you back to
the stone once the Moult's door is open. (Vael's level init now runs the temples' and the stones that rise both, in the
game's steps and in `init`: the game had never made the risers solid, nor the tests the Aerie's doors.)

The **Founders' Belfry** (`arzach2.js` `RING`; since v1.83 round the Great Belfry, its bell the house's state: "The
Founders' Belfry round the Great Belfry" above): **a ring through both halves of the house, back over the first from the
second**. Half-way over the Hall of Echoes a spur of the same stones runs off the bridge to a doorway in its west wall
(`spur`, a bridge on `{ lit: 'e2' }`: the ball on the far plate holds the bridge for good, and nothing but the bell holds
the spur: ring, and run). Through it the **Ringers' Walk** goes back south outside the house past the porch and the Bell
Chamber, up a stair, and east through the Stone Stair's west wall (the stair 28 m high since v1.77) onto a ledge round its
north-west wall 8 m over the landing (out of any jump's reach from it or from the great stone). On it the great key, in a
tall cage (`cageH`) whose top shows over the ledge's edge from the way into the stair at the start; it sinks only while
the founders' bell in the middle of the stair's floor rings (`when: { lit: 'e0' }`), the bell the house's first ball strikes: with that
ball still in its mouth it hears the whistle now from anywhere in the stair (`RING.hear`), so it is rung from the ledge,
the first room's own bell met again from above. (The marker counts a caged key as waiting for what its `when` names.) A parapet runs along the ledge but where the landing is under it: drop onto
the landing (a `oneWay` link), and climb the house again in its new state, the porch's bell rung, the bridge held by the
ball, to the far door (`d4`), which takes the great key with its ball and its bell. `migrate.js LAYOUTS.arzach2` v3: past
the far door, the great key is in it.

The **Warden's Well** (`incal.js` `FLUE`; until v1.83: since issue #413 the Flue is the way back down, "The Warden's Well round its Well" above): **two ways up from the gallery, meeting at the crown**. The **Flue**, the tower's
old breath-way, is a round shaft outside the Lamp Gallery's west wall from the gallery's floor to over the crown's, a
doorway into each (gaps in both drums, their walls overlapping between). A little vane on a post beside its draught (`vT`, 14 s; on its south wall until v1.77)
sends a draught up its middle while it turns (`draught`, a gate on `{ lit: 'vT' }`; an `Updraft` with that `when`): splash
it from the floor and ride up; half-way, a pier west of the draught holds the great key (`kG`); the vane slows while you
take it, so it is splashed again from the pier, and the draught carries you on up to the landing under the crown's west doorway. The high
door (`d3`) takes the great key with the eye's two vanes, so both ways are needed and either goes first: the irises' for
the eye's little vane in the loft, the flue's for the key. Down from the crown into the flue is a drop (a `oneWay` link,
no item: the wings make it a glide). `migrate.js LAYOUTS.incal` v3: past the high door, the great key is in it.

Round 6 (issue #23, v1.74) does the rest of that report's ranked edits: the Undertower's and the Clock-House's shapes
(identity 2: their runs after the chest read like other houses'), the two doors that scored 1.0 (obscure), and the
Aerie's too-obvious start.

The **Undertower** (`bazaar.js`, `pieces.js Pillars`): **the listening pillars**. The Gallery of Voices' great horn at the
chasm's edge (`e1`, held 12 s) and its twin on the far side (`e3`) are gone, and with them the pillar bridge they raised
(`br1`): each pillar listens itself now, a little horn ringed in the high note's colour on its side. A pillar rises while
the high note, played back near it (the shell's `'echo'`, not a stone's own song), still rings: `HOLD.pillar` s (6) from
the last time it heard it within `HOLD.reach` (6.5 m, across the floor), and it waits for whoever stands on it before it
sinks. Another note near them and they say what they listen for. So the way over is carried, the shell in your pocket:
play the note at the edge, step out, play it again further on, and the pillars ahead rise as you go (`{ a: 'gallery', b:
'galleryFar', needs: ['echo'] }`, a traversal the gadget makes: the audit's `T`, its `Pillars` a traversal piece of its
own). The far side's high egg is the way back. The middle egg now stands nearest the chasm (the high one, taller, hid it
from the far door that wants its note).

The **Clock-House** (`garage.js` `CUPBOARD`, `GALLERY_BEAT`): **the clock it starts in sight, and the gallery's beat**.
The Mainspring Room moves from the Clock Gallery's near landing (four rooms from the Cupboard whose clock it starts: the
Cupboard's door scored 1.0) to the Escapement's far landing, east, its doorway facing the Cupboard's across the landing:
from the Cupboard's door you see the slack spring and its six eyes through both doorways (its weight waits at its way in,
`ballM` in the room). Seen on the way in, wound on the way back with the coil; then the Cupboard's lids lift, a room away
and in sight (its door now names all three of its eyes). The gallery's east wall has its pendulum niche back. And over
the gallery's bridge hangs the **great pendulum** (a `Swing` with `bob: 'disc'`, a brass bob, `gentle`: it knocks you
back along the bridge and does not hurt), swinging along it once in 6 s: its bob sweeps low over the bridge's middle and
rises at either end of its swing, so you cross under it as it swings away, in its beat. The house's own traversal (its
escapement's disc, its gallery's pendulum): the audit's identity counts two traversals of its own.

The **Casting-House** (`moonfoundry.js`): its keepers' door (`dS`, the shortcut back onto the Pouring Floor) is written
from the side it is opened from, `{ a: 'scales', b: 'floor' }`: its eye over it and its pan up on the gallery are the
Weighing Hall's, and it is shut from the floor. Measured from the floor it read as the house's most obscure step (1.0,
its keys a room away behind the door); from the hall, 2.5. (The audit's skeleton writes the chest's `C` before the first
step that wants the gadget, wherever its rooms are, so such a door is not written before the chest.)

The **Aerie** (`arzach.js` `WELL_VENT`): **a catch at the start, and the Moult's air**. The Wind Well's column lifts open
wings off the chest's balcony and lets them go just over it (`WELL_VENT.low`, 17.5 m: its `low` line says why): the
well's floor has a second vent by the Moult's door, its stone (`bF`) beside it on a short groove, and while its throat is
open half the wind breathes out there, in a low column of its own. Glide down, roll the stone into its throat (`pF`), and
the whole wind rises to the crown (an `Updraft`'s `heights`): `{ a: 'well', b: 'top', door: 'column', needs: ['glider'] }`
(the main column's piece has the id), where the wings alone took you up before (the audit's most obvious step, 5). And
the column out of the vent at the Eyrie's gap's foot comes up the shaft out of the Moult: it rises only while the
Moult's door onto the well is open too (`lift` and its `Updraft` want `{ open: 'dM' }`; an `Updraft`'s `still` may be a
list of `[condition, line]`, the first that holds said: here why it is still). So the circuit has its order: down the
still shaft into the Moult, out by its door, up again, and the stone into the other throat for the great key. The glide
from the higher ledge back down onto the perch is no link any more (no way back, nothing there to go back for; the audit
counted it as a step, the house's most obvious). `migrate.js LAYOUTS.arzach` v3: a save already up there has the floor's
stone in its throat.

## Room for the camera (issue #195, `ANTE`, `K.vestibule`)

The author: "Most of the temple rooms are too small … I want rooms to feel bigger so the camera doesn't move and shake
every time we are in a cramped space." A probe walked the traveller and the close camera through every room (each
checkpoint stone's room, a full turn by hand and four walks out and back; the numbers in
docs/systems/movement-and-camera.md, "Small rooms"). The halls were roomy; the cramped ones were the **antechambers**,
the short passage between the last hall's door and the guardian's round hall: 5.6 m across, 4 m deep, 7 m high, the camera
pulled in to under 0.8 m behind the head in a tenth of every turn. In the eight houses that build it the same way
(the Belfry, the Footprint, the Engine-House, the Lamp-House, the Hush-House, the Clock-House, the Greenhouse, the
Undertower) it is now one piece of the kit, `K.vestibule(z0, y)`: `ANTE` 8.8 m across, 7.4 m deep, 8.5 m high, its walls
run on into the round hall's wall; the guardian's hall stands 4 m further on (its centre `end + 1.2 + r`, everything in it
placed from that), its doorways as they were. The Mooring-House's ante (a corridor) is 8.8 m wide and 7.6 m high. The
puzzles' rooms are unchanged (no jump, timing, wind, ball or checkpoint distance moved); the halls' marks for the
antechamber stand in its middle. `tests/room-size.test.js` holds the vestibule's size; the on-foot walks in
`tests/temples.test.js` walk into the guardians' halls 4 m further on.

## How far a push rolls a ball (issue #522)

The author: "The push gun should be stronger so I don't have to push balls so many times." A push of the gun sends a
ball along its groove at `BALL_PUSH.base + BALL_PUSH.per × strength` m/s (src/temples/pieces.js; strength 1 at the
hand, 0 at the push's 6 m reach): 4.5 + 12 since, 4.2 + 4.5 before. From close behind (strength about 0.65) that is
12 m/s instead of 7: about 1.7 times as far; from the far end of the reach about as soft as before, so a ball is still
eased onto a stop mid-groove from further back. A tether's pull keeps the old figures (`BALL_TETHER`). Off a groove's end
a ball comes back a quarter of its speed but never faster than `END_BOUNCE` (2.2 m/s, the hardest old push's): a plate
by the end still catches a ball sent hard at it. `tests/ball-push.test.js` rolls every pushed ball of every temple onto
each plate its puzzle wants, with the old push and the new, by a player who steps a metre back each time it rolls past:
the rolls of two pushes or more took 85 pushes, now 51 (the longest: the Aerie's hall stone, 37.8 m, 4 → 2; Edena's
first ball, 21.5 m, 5 → 3); a short hop to a stop mid-groove now wants the softer push from further back (the
Clock-House's first hour, 3.7 m: 1 → 4 for that player; a careful one still lands it with one).

## Room to push every ball, and always a way back (issue #275)

The author: "A lot of the 'push this ball' puzzles feel a bit cramped. In Vael I basically have to jump over them or
almost fall to do them … If I cross the chasm to go to a door and I don't have the key I can't go back?"

**Room behind a ball.** `scripts/ball-room.mjs` measures every `Ball` of every temple and of the makers' runs out in the
worlds (the Sphere court, the Moon roll, the Long look, the Orb walk). Along the stretch of its groove its puzzle rolls it
(its start to its plate; to the stops a condition wants it on, both ways when there are two; off a stop only wanted
left, as the Aerie's vents), every half metre, the floor round it is sampled at the groove's level on a 25 cm grid (a
drop or a face over a step is an edge, a seam a boot steps over is floor, doors and bridges open, thorns cut): is there a
push spot with `NEED` (0.8 m: his radius and a margin) clear of every edge and wall, behind the ball within 60° of its
groove (the push's 0.8 of a straight one), in reach (the fluid's 6 m; a hand or a cut, next to it), in sight, with a
metre of run-up behind it, on the floor you come in on (the piece with the room's mark on it; a pocket behind the ball
you would jump over or squeeze past it to reach doesn't count)? `node scripts/ball-room.mjs [temple…|courses]` prints each
ball's clearance (the most room every sample keeps a spot at); `--map <temple> <ball> <t> <dir> [need]` draws its floor;
`--profile <temple> <ball>` the clearance sample by sample. `tests/ball-room.test.js` holds every ball to `NEED`, but three
pushed from where nobody stands by design (the Warden's Well's loft ball, from the air; the Footprint's floating sphere,
from the bank; the Long look's, a run over the drop on purpose). Fixed with it: the Aerie's three (the Eyrie's stone off
the gap's lip and the south wall, `STACK.groove`; the high balcony a metre deeper, `BALCONY.depth`, its stone's groove
east; the perch's stone in from its rim, `GULF.stone`), and the balls that started against a wall, now a metre or so along
their grooves (`start`): the Engine-House's gantry, cell, furnace and hall balls and the Governor Room's groove half a metre
short of the parapet, the Clock-House's counterweight, the Greenhouse's sun-seed, the Mooring-House's winch ball, the
Casting-House's shelf moon, and the Orb walk's second orb two metres in from the lip.

**The way back.** A crossing that doesn't come back (a glide over a gulf, a wind that carries you, a drop) is a logic link
with `oneWay: true`. `stranded(L)` (`logic.js`) lists the rooms you can get to that can't get back to the entrance: the
links walked the way they go through the doors as they stand, and where that finds nothing, the house solved on from that
room (a stone rolled there may open its way out). `tests/way-back.test.js` solves every temple in order, the other way
round and with each key left where it lies, and asks it after every step: nobody is ever stranded. The Aerie's Gulf was
(its two crossings go one way; over them without the great key, nothing took you back, and a fall put you back at the far
mark): `GULF.way` is a doorway in the higher ledge's east wall onto a sill, a 7 m drop (no jump climbs it) into a passage
outside the gulf's wall, back along it and up stairs through a doorway onto the near lip, beside the door you came in by
(room `gulfWay`); the great lock says where it is. The test walks it with a real `Player`, and jumps at the sill from
below.

## Played through for real (issue #311)

The author: "After I get the shield I can't roll the fiery ball to the pillar. It always turns off before reaching its
target. We need to make sure all temples are solvable through a play through." The solver proves a house as a state
machine (a ball "rolled onto its plate" is a number set), and the walk-throughs put a ball back at its start by hand
when a try went wrong: neither saw that the Hall of Channels' ball, cut from its start with the relay lit, reached the
far door's bowl with a fifth of a second of its flame left (the plate's dip holds it to a crawl for its last metre and a
half, and the bowl only catches once it is slow), so any route but the perfect one went out on the way.

`tests/temple-playthrough.test.js` plays every temple through as its logic asks next (`logic.next()`, the drone's own
choice), with its real pieces and a real `Player`, and every ball moved by real hits from where he can stand: the fluid's
push from behind it (its strength from how far he stands, as the cone gives it, `1 - distance / range`), the tether's pull
from in front, the blade's cut, his hands walked into it, a splash's nudge for the last metre; each from a spot on the
floor near the groove's level, clear of walls, inside the push's cone and in sight (the cone's own occlusion test), or
hovering on the bellows where the house means it (the Warden's Well's loft shelf), or from the plate that stills a pool.
The ball's own physics and timers run in real time (friction, the plates' dips, the bridges, the jaws, a pool's current,
a tar ball's flame, an orb's glow); what a ball lights (a hooded bowl, a lamp) must be lit by it arriving, and with
`SPARE` (1 s) of its flame or glow still left; where it came cold, it is rolled back through its fire from where it lies,
never put back. The plates are stood on, the eyes struck or splashed (a bank of eyes caught as they rise, inside its
window), the small vanes splashed, the seeds bloomed, the pendulums stilled, the keys taken from their chests and carried
to their locks, the arenas walked into; the guardian is resolved once what it requires is done (its fight has its own
tests). What the driver can't work for real (the great vanes the bellows turn, the bells and ears that hear a note, the
watcher's bolt) is done through the logic and listed (`TEMPLE_LOG=1` prints each house's steps, margins and those).
Found and fixed with it: the Hall of Channels' ball (`WING`: it burns 6 s, the relay at x 16: 2.2 s to spare, and still
out 2 m short with the lid on); the Footprint's stilling stone, from whose middle the push's line to the floating sphere
ran into the ledge's edge (only its last 20 cm worked): the stone at the ledge's edge and the sphere a little farther out
(`POOL`).

## No way round a shut door (issue #356, `tests/door-bypass.js`)

The author: "In the Hush-House there is a locked door but I can just jump around it?" Every door of a house's links (a
door of stone, one the logic can't go round by another link) is shut with every other door open, and from each side of
it the walker's flood (steps, the double jump's climbs, falls that don't hurt, never into a pit, with room for the
traveller's capsule) must not reach the other; from within 4 m the real traveller walks on every way; and round a
locked door (a key's) he also jumps, double jumps (at its highest and late) and, after the Rose House, opens the wings,
from within 10 m of it and from anywhere within 8 m of the other side. Found and fixed: the Hush-House's ledge door
(`LEDGE`: the double jump went over its 4.4 m, a jump from the root-wall's top round its post onto the ledge beyond; the
ledge past it a cloister, walled on the water's side in slits of 0.55 m and roofed at the lintel; since v1.77 the door
is 7 by 9 in a passage through the well's west wall, nothing to go round),
the Builders' Greenhouse's great lock (it stood in the antechamber's open end, 8.8 m wide: walked round), the
Mooring-House's Capstan door and its other doorway, the Casting-House's arena door and the guardians' halls' ways out
(a rotunda's gap is cut by whole stones, so up to a metre wider than its door: jumped through beside it); and the
Capstan Floor's four windows, open over the void for the Warden's anchors, out of which the wings carried you round to
the Capstan Hall's walkways and back in past its great lock: a second rail at 2 m and iron bars over it
(`WINDOW_BARS`, 0.75 m apart; the anchors still go out under them and your aim reaches them). A door in an
opening wider or taller than itself takes a `frame: { side, top }` (src/temples/pieces.js Door): stone that wide either
side of it and that tall over it, drawn and solid.
## No hook past a lock (v1.83, issue #432, `tests/hook-reach.test.js`; the boots: issue #433; the wings: issue #436)

Found by the Lamp-House rework: the grappling hook reeled you onto any ledge in its 25 m reach, so a house's galleries,
chasms and shafts could be crossed before the step meant to open them. Inside a house the hook now takes only what the
house set there for it (docs/systems/gadgets.md, "In the makers' houses"): rings (`HookRing`, a piece of its own: a room
that wants a hook point declares one, `rt.hookAnchors`), weights and crates, bells and foes; never bare stone. The open
world keeps the free hook.

The check: for every lock of a house's links (a door, a bridge, or a gap that wants an item; not one the logic goes round
by another link), shut with every other door open, the walker floods each side (tests/house-walk.js, shared with the
door-bypass test); from every spot of one side, his glove where it would be, every hold the hook takes in the house in
reach and in plain sight reels him in (on a floor he stands on it; on a wall he hauls over its top as `tryMantle` probes,
or climbs it if it is one of the house's climbs, to its top; the reel's line must have room for his body), and where he
lands must not be the other side, nor walk on into it. Today no house has a ring or a too-heavy loose thing, so it
passes everywhere; a ring added later is checked. `HOOK_FREE=1` runs the old rule as well (a fan of 280 aims from every
spot, 2.5 m apart, within reach of the other side) and lists what it would skip. On the fourteen houses at 889012aca:

| house | what the old hook skipped |
|---|---|
| the Warden's Well | the vane chasm both ways without its bridge; the jets' shaft up to the gallery without the fan |
| the Lamp-House | the Dark Gallery's chasm (`br1`) from its near lip to the far one's face, 24.5 m even at 27 m across |
| the Aerie | the Eyrie's gap to its key's ledge (`lift`) both ways without the wings |
| the Builders' Greenhouse | the Glass Stair to its landing (and the vault's top) without the lift; the Vine Gulf (`vine1`) both ways |
| the Undertower | the dishes' gap (`disc`) both ways; the gallery's gap without the hourglass, both ways |
| the other nine | nothing (the Aerie's raft to the Wing Chamber, found on the house before #407, is gone with its rework) |

Each was fixed by the rule itself: the hook no longer takes the stone it bit, and no house data changed.

**The spring boots** (v1.83, issue #433, `tests/boots-reach.test.js`). Found by the Undertower rework: a full wind threw
you 14.3 m up, a chain of three bounces 23.7 m, and every reworked house has galleries 10–12 m up. Inside a house the
boots now give only the tap's hop (2.4 m, under a plain jump's 2.6; docs/systems/gadgets.md, "Spring boots", "In the
makers' houses"); the open world keeps the full launch. The check shares the hook's sides (house-walk.js `lockSides`):
from every spot of one side, 2.5 m apart, a launch straight up to the boots' height, stopped by what is over his head,
the double jump at its top (+3.5 m); then the wings down and on at 6 m a metre down (the glide's flattest is 6.25), by a
straight glide, a glide then a drop, or a drop then a glide, with room for his capsule all the way (a ray first, then the
capsule every 0.5 m); a landing on the other side, none of his own side within a stride, is a skip. A spot from which a
plain jump does the same is not counted against the boots (`BOOTS_LOG=1` lists those). `BOOTS_FREE=1` runs the old
launch as well. On the fourteen houses at 94817f4a6 (the Whale-House reworked):

| house | what the old boots skipped (23.7 m, the double jump, the wings) |
|---|---|
| the Warden's Well | the turning discs (`discs`) both ways, from the threshold and from the climb; the vane chasm (`stones`) without its bridge |
| the Founders' Belfry | the Echoes' chasm (`br1`) both ways |
| the Footprint | the pool's stones (`stones`) from the first balcony; the Unseen's chasm (`br1`) both ways |
| the Engine-House | the furnace chasm (`br1`) both ways |
| the Lamp-House | the Dark Gallery's chasm (`br1`) both ways, from 15.8 m under its roof |
| the Aerie | the Eyrie's gap to its key's ledge (`lift`, which wants the wings) |
| the Clock-House | the escapement's discs (`discs`) both ways |
| the Builders' Greenhouse | five of its locks under a roof 27 m up: the landing's door (`d1`) from the seed vault, the bud door (`d3`), the Vine Gulf (`vine1`), the far door (`d4`) from the hall, the great lock (`dB`) |
| the Undertower | the dishes' gap (`disc`) both ways; the gallery's gap without the hourglass |
| the Mooring-House | the Capstan door (`gN`) and the arena door (`d6`) both ways, over their walls |
| the Rose House, the Hush-House, the Casting-House, the Whale-House | nothing |

A rule and not house fixes: with the wings, a launch's reach is a cone some 150 m across, so every gallery, balcony or
far lip under a roof open over a floor was in it; ceilings over every launch line would have changed every room. With
the hop no launch goes higher than a jump, so the check passes in every house, and a later change to the rule is checked.

**The wings over the chasms** (v1.84, issue #436, `tests/wings-reach.js`; found by the boots' check): a running
jump, the double jump at its top and the wings (6.1 m up, a glide of 6.25:1) carried the traveller about 45 m on the
level, over the bridge and gate chasms of nine houses both ways. Inside a house the wings now glide heavier
(docs/systems/gadgets.md, "The wings in the makers' houses": 6 m/s on, a metre down for every metre on, unless moving air
holds them); the open world keeps its glide. The check shares the hook's sides (house-walk.js `lockSides`) and flies the
real traveller (src/player.js, driven as tests/door-bypass.js drives him) for every lock but the wings' own
(`needs: ['glider']`, the Aerie's): from every spot of its near side (the link's `a`; the far side is had only through
the lock, so the way back, a drop off a walkway into the room under it, is no skip), 2.5 m apart, within the wings' reach
of the far side, toward its nearest spot and 0.35 rad either way, a run-up, the jump, the double jump at its top or late
in its fall, and the wings held open with the stick let go; where he comes to stand must not be the far side, unless the
same jumps without the wings get there too; since #444 that fails as well (a bare jump over a lock; `WINGS_LOG=1` lists them
as it goes). `WINGS_FREE=1` flies the open
world's glide as well and lists what it crosses. On the fourteen houses at 75b95f7ed (the Engine-, Mooring-, Clock- and
Casting-Houses and the Undertower reworked):

| house | what the open world's glide crossed (running jump, double jump, wings) |
|---|---|
| the Warden's Well | the turning discs (`discs`); the vane chasm (`stones`) without its bridge |
| the Founders' Belfry | the Echoes' chasm (`br1`) |
| the Footprint | the pool's stones (`stones`); the Unseen's chasm (`br1`) |
| the Engine-House | the furnace chasm (`br1`) |
| the Lamp-House | the Dark Gallery's chasm (`br1`) |
| the Clock-House | the gallery's chasm (`br1`) |
| the Builders' Greenhouse | the Vine Gulf (`vine1`) |
| the Undertower | the dishes' gap (`disc`); the Gallery of Voices' gap without the recall and the lens |
| the Mooring-House | the gallery's halves without the moored room (`rideW`); the Cable Walk (`cw`) (the gangway, `br2`, was the walker's: #444) |
| the Rose House, the Hush-House, the Aerie, the Casting-House, the Whale-House | nothing |

With the rule nothing crosses in any house. The narrowest was the Undertower's dishes' gap, 17 m, a metre past a running
jump and the double jump alone: the reason the ratio is 1 and not the 2–2.5 that clear the 25–30 m chasms. Found on the
way: the Mooring-House's gangway gap (`br2`) "crossed from the Chain Locker's side by a running jump and a late double
jump alone". It was not (issue #444): the walker (house-walk.js `walk`) had stepped off the east landing's railing onto
the hall's north wall's face, a cell exactly on its plane; the ray down from there runs inside the wall and meets the
underside of its foot (4 m under the floor) as ground, and a body on the face's plane is pushed nowhere (the push's
direction is zero). The flood ran along inside the wall, over the void and under the west landing, and the traveller flew
from it. The real gap is 20 m; a running jump and the double jump from the lip come down level with it some 9 m short. The
walker now refuses a floor met from inside a solid (a ray down from just over it meets the face from behind:
`Physics.rayHit` `front`), `tests/house-walk.test.js` keeps it so, and the reach check fails on any bare jump over a
lock. The house is unchanged. The Aerie's designed glides on still air (off the gallery into the Wind
Well's column, off the Eyrie's ledge into its column, off the column's top over the Gulf's second leg) now go through
the makers’ breath (`WingAir`) over each while its column rises, and the Gulf's first leg through its gust (held a stride
before it, `AIR_LEAD`): its walk on foot passes unchanged, and the Roost breathes all round the Elder. One other designed
glide needed its air: the Warden's Well's, off the top of the draught to the high ledge (the drum breathes at the ledge's
height while the draught rises that far).

## Weights on the plates (v1.76, issue #337, `Weight`)

The author: "I should be able to pick up and put down small objects, that should be put to use for puzzles. Like grab a
box from afar with the grappling hook, then put it down on a switch so I can go through a door." A `Weight` (pieces.js)
is a block of the house's stone the traveller carries in both hands (src/carry.js); its logic element `{ type: 'weight',
room, plate, needs?, optional? }` holds its plate down while it sits on it, saved (`weight.<id>`), and a plate's door
without a latch is open only so long. Two houses have the pattern: the Rose House's Dry Channel (its pier longer, the
plate at one end and the Givers' weight at the other: the plate no longer latches the chamber's door, the weight holds it;
`migrate.js` desert v3 puts it there for a save past that door) and the Mooring-House's Capstan Hall (a coffer caged by
the east wall, its plate, and the moorers' weight high on a cleat where only the grappling hook reaches it: a reward,
`optional`). The playthrough test carries every weight on the way for real. docs/systems/carry.md has the rules.

## The gadgets earned inside (issues #375, #377, docs/design/gadget-temples.md)

The author: "Gadgets should never be in a chest out in the wild. They should be earned, like in a temple … then a couple of
rooms that make me use the gadget to exit the place", and "a lot of the temple gadgets are … very topical like more mana or
a tool to calm the guardian. They should be tools that help with puzzles in the temple and help with the guardian fight."
Each house whose chest held a topical thing holds one of the real gadgets now (src/gadgets/), its rooms after the chest
and its guardian answering that gadget's verb; the topical thing went to the makers' court whose box the gadget left
(src/boxes/placements.js, `court: true`), or into the gadget. The box ids stay (the saves' flags), `TEMPLE_BOXES`
(migrate.js) says what each holds now.

- **The Founders' Belfry: the grappling hook** (the bell-note whistle before). Every founders' bell hangs a `HookBell`
  (pieces.js): a brass ring round a red heart on a short chain under its lip (on the founders' bell, on its crown), drawn
  like the Gadget Yard's rings. The hook's bite on it (hook.js: a target's `onHit` with `mode: 'hook'`) swings it and
  rings the bell, a game `'bell'` event marked `struck`; the house's `BellEar`s are `struck: true`, so the whistle (a
  charm in Vael's court now) no longer rings them, and a clapper ball's blow still does. Two bells are new: the Hall of
  Echoes' over the chasm's east side (`BELL2`, hooked from either lip or the bridge) and the far door's beside it; and four
  round the Cloud-Mother's hall (`HALL_BELLS`): hooked near her as she cries she calms, hooked as she rises to dive a
  hanging stone comes down. Hooking her instead frightens her. The walk-through rings every bell from where the player
  can, in the hook's reach and sight (`tests/temples.test.js`).
- **The Engine-House: ink bombs** (the fourth chamber before). Its banks of four eyes in one breath want the bombs: the
  bar holds three shots, and a bomb's blast wakes the eyes it reaches (kit.js `blast`: a target's `onHit` 'push',
  `mode: 'bomb'`; between two of the chamber's posts, both). A bomb that meets a guardian's target goes off on it
  (bomb.js, as on a foe): on the Tooth-Warden's open vent it takes that vent and the two beside it (`TOOTH_WARDEN` vents
  count a bomb's blast), a splash the last.

- **The Lamp-House: the bubble wand** (the lantern charm before, back in Viridel's court). The house's idea stays (light
  wakes what waits for it, and light can be carried), and the bubble carries it: `src/carried-light.js` keeps the lit
  places (`registerLight`: the pool-lamps, `Switch` `light`; a `LightEar`'s glass once it burns; a pool-orb while it
  glows; the Lantern Chamber's `LightFount`; the Lamp-Room's lit pools) and what drinks light (`registerDrinker`: a dark
  `carried` lamp's glass, a dark `carried` orb, the Lampless hanging low). A bubble blown in a light takes it and glows
  (a gold halo, bubble.js `takeLight`); glowing, it bursts on a drinker it meets, and wherever it bursts it emits
  `'bubble:light'` { pos }: a `carried` `LightEar` within `CARRY.reach` of its glass lights, a `carried` orb (`Ball`
  `lamp.carried`) glows its `lasts` s. The chamber's two lamps (the try and the Lamp Passage's) take the fount's light;
  the Dark Gallery's moss-stones (`br1`, no longer hidden) rise for good once their lamp, hung over the chasm on a chain
  (`lM`, `MOSS`), drinks a bubble of the near floor's pool-lamp (`s6`); the far orb a bubble of the far pool-lamp's (`s7`);
  the Wick Room's two orbs bubbles of the wick-house's pool-lamp (`sW`), both burning at once as before; the eye on the
  post is a plain one. The Lampless drinks a bubble of light burst on it as it hangs low (0.15 a bubble; in its last
  phase not while you stand within `LURE.back`); the lit pools still lure it.
- **The Whale-House: the spring boots** (the whale-horn before, retired: a save that has it still sounds it). In the house a
  stomp of the boots (springs.js's `'gadget:stomp'` event) is the deep note: the house's `onConnect` turns each stomp inside it
  into the `'echo'` the horn sent (`STOMP_NOTE`), so its `EchoEar`s, its dishes and the Listener hear it as they heard the
  horn, and every ear past the chest and the Listener need the boots. Over the Tank Hall's glass a screen of the house's
  shell now runs to the roof, with a hatch at the top of the rungs (`hatch`, `HATCH`) that opens with them: no bounce of the
  boots clears the glass, only its rungs while the shelf's ear rings.
- **The Warden's Well: the gust fan** (the Warden's bellows before, in Lorn's court now: open wings still climb faster with
  them, and a save's bellows still wash a vane). A `Vane` takes the fan's `'gust'` (its target `accepts` it): a great one,
  too heavy for a splash, turns `VANE_GUST` (5) s a gust, a small one as long as a splash. Every great vane, the draughts
  and the warden need the fan: the gallery's and the loft's vanes, the crown's two at once, the hall's four (its last phase's
  hatch lifts over the one it backs onto, fanned from beside it, its bulk not in the gust's way).
- **The Clock-House: the boomerang** (the quick coil before, in Lorn II's court now). Its banks of six eyes in one breath
  (`Bank`) and the Foreman's six numerals want the boomerang: a tank holds three shots, its locks strike three more in one
  throw (an eye is a target the boomerang strikes as a glob would), and in the order they were locked, so the Clock
  Gallery's six in turn from four are three locks in turn and three splashes. The walk-through throws a real boomerang.
- **The Casting-House: the magnet glove** (the founders' tongs before, retired). Its iron moons are `Ball`s with `heavy:
  'magnet'`: no push moves them (nor a tether); each registers itself as loose iron (`src/gadgets/metal.js` `registerIron`),
  which the glove takes with its crates and machines (magnet.js `candidates`): held, the moon rolls along its groove toward
  the point the glove holds (`magnetTo`, at most `MAGNET_ROLL` 6 m/s), tapped it is thrown along it (`magnetShove`). Every
  moon past the chest and the Last Founder's cradle need the glove.
- **The Footprint: the seeing lens** (the glyph lens before, in the Buried Machine's court now). A piece `hidden: true` (a
  `Door`, a `Switch`, the `LensStones`) is `revealed` once the raised lens has looked at it (`src/gadgets/hidden.js`
  `LENS_VIEW`: lens.js writes its raise and the camera's eye and view every frame; `lensSees`: within 34 m and 0.6 rad of
  the view's middle), and stays (the temple's flag `seen.<id>`); a hidden `Plate`'s print, the Lens Chamber's mural and the
  Echo's print on its answering sphere show only while the lens looks (`lensUp`). The house's stones, eyes, door and
  guardian need the lens.
- **The Undertower: the recall hourglass** (the echo shell before, retired: its work folded in). `src/echo-shell.js` keeps a
  note for whoever has the shell or the hourglass (`teach.sandCaught`); the hourglass turned with nothing under its aim emits
  `'recall:note'` (recall.js), which `src/boxes/effects.js` plays back as the shell's `'echo'`, and so does Y / △. The
  chamber's door, the horns, the listening pillars, the Choir and the First Sign need `recall`; so does the Signal Market's
  Echo relay (`src/trials/kit-courses.js addEar`).
- **The Warden's Well's Ash Store: the bridge pen** (the City-Shaft's court before). A temple find (`pen`, `type: 'find'`,
  its box `incal.bridge`, `ready` once the arena `arW` is won, `sealed` before); the Vane Room's vane and its stones went, and
  its chasm (`WING.gap`, 8 m) `needs: ['bridge']`: a plank there for its key, another back. The walk-through draws real
  planks (bridge.js `press`/`hold`/`release`) and waits for the first to wear away.
- Old saves: `src/save-migrate.js` step 29 (`BOXES_375`: an opened chest or court box gives what it holds now;
  `FOLDED_375`: the shell, the horn, the tongs give their gadget), and `TEMPLE_BOXES` opens a temple's chest for a save
  that owns its gadget. No box outside a temple holds a gadget (`tests/temples.test.js`, the gadget plan's test).
- Never stranded on load (`runtime.js unstrand`, the house's first frame after a save puts the traveller back inside: main.js, and engine/game.js for the Unity version, mark it `loaded`): the room he stands
  in is the nearest mark's or room piece's (`roomNear`); if it lies past one of the house's gadget gates (`gateItems`: an
  item its chest or a find gives that a link or an element wants; `roomsPast`: the rooms walked to through links whose
  `needs` are met and doors that are open or open without what is lacking, `wants`) without that gadget, then past the
  chest (or the find) the gadget is given; else he is put at the last mark on the near side, or the entrance's, and it
  becomes his checkpoint. `tests/temple-unstrand.test.js`: every gate of every house, earned and not.
- The backpack's third stage (`BACKPACK_STAGES`, the tank's look) is the gust fan, the Warden's Well's gift now; the
  bellows, in Lorn's court earlier on the route, are no stage.

## The house's map (issue #405, recommendation G5; `src/house-map.js`, `src/temples/house-plan.js`)

A little chest in every makers' house holds its map. Its element is `map: { type: 'map', room, at, yaw }` at the end
of the house's `LOGIC.elements` (its place in the kit's local metres): the runtime puts a `MapChest` there after the
layout (pieces.js: a key's little makers' chest with a rolled map in it, `MAP_CHEST.line` said once it is open, the
tone left off; never counted with the keys) and `logic.find` keeps it (`temple.<id>.found.map`). Nothing waits on it,
so the solver takes it on the way (`take map`) and the Temple maps page lists it as an extra. It stands in a room of
the first third of the house's stages, not the way in, by a wall, at least 5 m off the solution's walk, on flat floor
with room before it (tests/house-map.test.js, tests/temples.test.js with the key chests); `logic.next` (the scout's
ping) never points at it.

The map itself is read from what the layout built, never drawn by hand, so a house remade (#401's Footprint, #383's
ways in) maps as it is:

- **The kit's chart** (`TempleKit.chart`, kit.js): every hall, round hall, corridor and wall (with its doorways) and
  every slab, stair, ramp, bridge, shaft and antechamber, as the kit builds them; the runtime keeps the pieces as
  placed (`rt.placed`). The Temple maps page reads the same (src/temple-maps/record.js). A floor a layout builds
  itself goes in with `K.chartNote`: the Footprint's balconies round the Heel Well (`ring`: an arc between two radii,
  its drops' holes), its great lift (`lift`) and the lift's piers, so its four floors map as they stand.
- **The plan** (`housePlan`, read once: `rt.housePlan()`): floors from the rooms' heights (`floorsOf`, shared with the
  page), each shape on its floor; a floor's room the one whose mark stands on it (else its middle, else the nearest);
  a wall on every floor it rises past (a well's, a tall hall's), belonging to the rooms beside it; the doors from the
  links (a lock's kind; the guardian's: the door into its hall or into the open rooms before it).
- **Rooms seen**: inside, a few times a second, the room you stand in (`roomAt`: the smallest floor under you within
  a storey) is kept as `temple.<id>.been.<room>`; the way in and the rooms where something was done count too (a
  save from before).

The game menu's **House map** (View / Select; only inside a house, a panel after Map; the Start menu's page until
issue #487) draws a floor at a time: the rooms seen washed and
inked, the rest faint and dashed once the map is yours (none of them before), the ways up hatched with their arrows,
a floor below's tall walls thin, the doors shut (brown) or open (empty), a lock's keyhole until its key is in, the
great key's door a gold diamond, the guardian's door ringed in red and its hall marked, you as the world map's red
arrow, and the key along the foot. A tab a floor (1F the ground floor, 2F up, B1 down), ▲ ▼ between them (LB / RB
turn the game menu's panels), on your own floor each time it opens. A house deeper than wide is turned a quarter, its way in on the left.

## Several boxes, drawn and solid (issue #358, `tests/temple-kit-both.test.js`)

`K.both(mat, geo, proxy)` draws `geo` and makes it solid (or `proxy` instead, a stand-in). Several boxes go as an
array, `K.both(mat, [a, b, c])`, each drawn and solid; a fourth argument throws. Five calls had passed their boxes
loose: the first was drawn but not solid, the second solid but not drawn, the rest neither. Fixed: the Hush-House's
side mouths (their niches' sides and lintels), the Lamp-House's lamp niches (one side and no roof each; the second
niche's drawn wall walked through on the way to the great key), the great key's alcove (its sides) and the far
door's lamp niche, and the Mooring-House's Rope Store (its drums on one iron each). The newly drawn sides and roofs
sit a few centimetres into the walls round them, clear of the walls' faces (`tests/zfight.test.js`).

## A deadly pit looks it (issue #312, `src/pit-void.js`)

The author: "Make it clearer when the pit is deadly when I fall … like in the Rose House": the Dry Channel's sand looked
like a floor to land on, and put you back at the mark. Every `Pit` now fills with the makers' dark from below
(`pitVoid`, made for each pit by `runtime.js`): drawn as a wash over the finished picture (src/veil.js `addWash`), its
box's inside faces, each pixel finding where its ray meets the scene inside the box. What lies flat in it (a floor,
sand, water: whatever you would land on is where it puts you back) goes all dark, the walls darker the deeper they go
(`PIT_VOID.fade` 7 m, in `steps` 4 flat tones, as the pictures shade), and on the floor slow pale rings in the house's
glow colour turn round the pit's middle; the traveller falling into it sinks into the dark too. Nothing in front of the
box (a ledge, a bridge over it, the traveller on the lip) is touched, and a pit's box ends under its lip, so its top
metres of wall keep their stone. A pit already deadly by its own look says so (`own`) and takes none: the Casting-House's
molten channel. A drop with a floor to land on (a stair well, Vael's cleft round the lone tower) has no pit, and no dark.
The worlds have the same under their kill height (`level.voidY`, else a finite `killY`: `worldVoid`, main.js), seen only
where you look down into nothing: in the City Floating in Space, rings over a lighter dark (`WORLD_VOID.dark` 0.35) under
the islands, its stars still showing; a world with ground under every drop shows none. Cost: one draw a pit on the
screen, a few ALU a pixel. `tests/pit-void.test.js`: every temple's pit has its dark (one each, no more), the molten one
none, a world without a kill height none.

## Each house its own look (v1.31)

The temple visual pass (docs/audits/temple-visuals-v1.32.md): every house was drawn with the same kit in the same
strata stone, cream frames and cyan glyphs, nearly all of it in the shade, and the shade was the world's (Vael II,
the City-Shaft and the Garden print theirs flat in grey-blue or sage), so six of the eleven read as one blue-grey
house. Now each temple's `PALETTE` (its world file) carries, besides its colours, what makes it its own, read by
`templeMaterials` (`kit.js`):

- **`look`**: `makeMaterial` options over the defaults. `all` goes to every surface of the house, its paint too
  (`M.paintLook`: the vertex-coloured paint mesh is the house's own, still one mesh): its shade kept in its own hue
  (`shadeFlat` low, `shadeHue` high), lifted (`shade`), its spot blacks fewer (`spot`), the lamps' pools in a colour
  (`lampTint`: the Lamp-House's amber). `wall` / `floor` change the stone itself: ashlar in staggered blocks
  (`mode: 0, grid, plates`: the Rose House, the Engine-House, the Undertower), big smooth panels (the Well, the
  Belfry, the Garage), cracked beds (the Hush-House), riveted iron (`detail: 'built'`). `trim` makes the frames a
  material of their own (the Garage's brass); `fitting` and `glyph` colour the pieces' fittings (door bands, plate
  rims, braziers) and the frieze apart from the pieces' own glow.
- **`bands`** `[{ at | y, h, color, every, look }]`: courses of another stone or paint across every plain wall and
  round hall (the Well's steel blue, the Aerie's ochre, the Garage's brass inlay, moss at the Lamp-House's and the
  Hush-House's foot). The wall's drawn blocks are cut at them (`TempleKit.banded`) with no faces where the pieces
  meet (inside the wall they read as tops to stand on); the collision is the whole block as before.
- **`ornament`** `{ kind, color, color2 }`: a small thing by every frieze glyph (`ORNAMENTS`: a bell in a lit niche,
  a lamp, crystals, a slot of the market's light, a slit window, a clock, a valve on a strap, a porthole, a feather, the
  makers' mark, a pane between ribs, a moorers' ring, a little whorled shell), drawn as a relief no more than 5 cm proud of the wall, within the contact
  audit's tolerance (drawn only, as the frieze is).
- **`light`** `{ shadow, light, sun, fog }`: the house's own light inside. `templeLight` moves the world's colour
  script's shade and light tints to the house's (all the way by day, 0.8 at dusk, 0.55 at twilight, 0.3 at night:
  a house is no lamp) and keeps its sky; `attachTemple` hands it over with `level.atmo` while the traveller is inside
  the temple's bounds (as the Lab's rooms hand theirs: main.js `updateSky`), and the world's again outside.

The pieces and the puzzles are untouched: the same rooms, collision and logic (the Lamp-House's six lamps sit lower
and reach farther, light only). Cost: two to seven draw calls more in a frame (paint and bands share the house's paint
mesh), frame time within the machine's spread (the audit's "Cost"). `tests/temple-visuals.test.js`.

## Futuristic skins (v1.77, issue #342, `src/temples/skins/`)

A house may wear a skin of its own module (`def.skin`, a function `(rt) => ({ dress, done, brazier })`, run by
`skins/index.js houseSkin` round the layout; `?noskin=1` or `rt.noSkin` builds the house without it). Look only: the
same rooms, doors, collision, pieces and logic (`tests/temple-skins.test.js`).

Every sign in a skinned house is the adopted makers' mark, the shared `story/sign-text.js glyphGeometry` (the open
corner beside a shorter upright): the friezes, the threshold, the doors' medallions and each house's own places (the
Rose House's spout slab and obelisk terminals, the Belfry's bells, the Casting-House's cradles' hoods and moon ring). A
skin gives it its colour, glow and setting (lit in the house's accent, inlaid, in a lens), never a shape of its own.
`tests/makers-mark.test.js` finds every mark in each built house by its vertex signature (its outline up to size and
pose) and fails if anything else stands in a house's glyph light, or if a skin declares its own sign geometry.

### In Unity (v1.78, `skins/skin-shader.js`)

The skins' surfaces are GLSL spliced into the surface shader, which the Unity port can't run. So each skin declares its
pattern once, `skinShader(id, { pars, defines, glsl, bodies, ink, emit, emitAt })`: its uniforms, its helpers, its bodies
(each replaces `vec3 albedo = uColor;`), and how its pen lines and glow join the surface's. Two things are made from that one declaration:
- **the web's shader**: `spliceSkin(m, SHADER, body)` splices it as each skin did by hand. Every skinned material's
  fragment shader in all 13 houses is the same text as before, character for character (checked against a snapshot when
  the declarations went in; `tests/temple-skin-patterns.test.js` checks the splice). The material carries
  `userData.skinPattern = { skin, body }`.
- **the port's HLSL**: `scripts/unity-export/skin-hlsl.mjs` translates the same GLSL (types, `mix`/`fract`/`dFdx`/`mod`/`atan`,
  one-number constructors, whole-vector `==`, reserved names, each skin's functions prefixed `s<n>_`) into
  `unity/Hiraeth/Assets/Hiraeth/Shaders/SkinPatterns.hlsl`: one function per body, and `skinSurface()`, a switch on the
  pattern's number. The test fails if the file is out of date: `node scripts/unity-export/skin-hlsl.mjs`.

A pattern's number is its skin's place in `SKIN_ORDER` × 8 + its body's place + 1. Its uniforms go as vec4 slots in pars
order (`skinLayout`: a scalar or vector one slot, an array one per element; at most 64): `engine/ink-spec.js` sends
`skin: { body, data }`, `port-format.js` `skinPattern` / `skinData`, `WorldLoader.MakeMaterial` puts the data in a
`ComputeBuffer` of the material's own (`_SkinData`, kept out of UnityPerMaterial for the SRP Batcher; only `_SkinBody`
is in it) and turns on `HIRAETH_SKIN`. Uniforms that change after the house is built (the Belfry's bells, the Lamp-House's
lantern and lit pools) go live: the mirror repacks them every other look and sends op 21 when they move.

**One variant for all of them.** `HIRAETH_SKIN` is one more keyword in the vertex kinds' set (so it never combines with
the crowd, the flora, instancing or VMAT) and is lean by itself (no glass, water, terrain or wall marks).
`BridgeRenderer.Lean` gives a skin material no LEAN/PLAIN keyword, and only that combination compiles the patterns. That
adds two programs (prepass or not), whatever the number of skins (#16). The build's G-buffer variant space goes from 112 to
128, the 16 new ones mostly empty. The Deck's load shows `19× Hiraeth/Surface|HIRAETH_SKIN` in the Rose House. A skin
material on an InstancedMesh (the Lamp-House's floating plates, the Casting-House's frames) is baked rather than drawn
with `HIRAETH_INSTMAT`. The skin's facet normal comes from the object's frame (`facetO`), not from the world position
a few kilometres up. `-no-skin-pattern` draws the surfaces plain, for a before-and-after on one build; `-surface-debug 7`
shows a skin's glow, pen lines and number.

**What it costs.** On the Steam Deck's Unity player (Vulkan, 1280 × 800, uncapped) in the Rose House, the GPU's time per frame
goes from 8.3–8.7 ms to 8.7–9.1 ms (+0.3–0.55 ms) across four views, every one still over 100 frames a second.

**How close.** At the same resolution (the web's High renders at 1.5×; compare it at `renderScale` 1) the patterns land
on the same pixels in Unity (same hashes, same layout), in all 13 houses. Thin lit lines come out somewhat dimmer in
Unity: their coverage depends on the pixel's size (`fwidth`), which reads ~5–10 % larger there, and the composite's light
core starts at 0.62. The skins' drawn-only dressing and their per-house light (`rt.skin.light`, through the look) already
reached Unity as meshes and look values.
These differences seen in the comparisons are not the skins': the deadly pits' dark wash (`src/pit-void.js`: the Clock-House's and the
Footprint's pools) is not drawn in Unity; the local lights' pools are lost in the editor's batch shots to
`HiraethLook.CullLightsToView` (`-no-light-cull` brings them back).

### The Warden's Well (`skins/wardens-well.js`)

After `references/temples/future/wardens-well/sheet-1.jpg` and `sheet-2.jpg`: a shaft of dark slate rings, cyan lines,
lavender-grey floors, lens terminals in alcoves, tiers of turning vanes, an iris at the top.

- **Surfaces.** The wall, `wallGlyph` and floor materials become the surface shader with its albedo, first pen lines
  and glow replaced (as `landmark-materials.js stone()` does; `emit` takes the pattern's `skGlow`, so bloom carries it):
  - `slate` (walls): tall 4.8 m courses of long staggered panels (about 6.4 m, a whole number round a drum), few
    joints, close tones, a soft fall of light down each, a soft chamfer; every second course a dark ring groove, most
    lit cyan; cyan circuits up the walls, jogging sideways every 13 m, a lit square at some; ceilings in 3.2 m rings of
    slabs round the room's middle (`uSkP.w`), a cyan ring round the oculus.
  - `metal` (doors, the climb's face, the irises' blades): 1.6 m machined panels, chamfered, a cyan seam down some.
  - `plates` (floors): lavender-grey 3.2 m plates (sheet-1's) in rings round a round room's middle or a grid in a
    hall, a cyan inlay 1.6 m in from the walls; a floor's underside slate rings.
  - The kit's rooms go to the shader (`uSkR`, up to `WELL_ROOMS`), so a drum's slabs run round it without a seam. The
    pieces' copies (`floorObj`, `wallGlyphObj`: a riding disc, a door's slab, an iris's blades) take the pattern in their
    own frame, so it moves with them.
  - The glows breathe slowly (`uTime`), rising up the shaft.
  - **Crisp lights** (`WELL.emit`): every light sits just over the post pass's halo start (0.62, `post.js`): the slit
    windows 0.67, glyphs 0.72, vane rings 0.7, rims 0.74, lenses 0.76, the patterns' lines 0.78 (`SK_LINES`, after the
    line is drawn at full colour), so the halo stays a thin edge and never blooms into soft blobs.
- **Paints.** `M.bands` a dark plinth, a dark slate frieze course and cream courses every 8.4 m. The glyphs, the
  frieze's marks, the vanes' rings and the gallery's floor rings are cyan glow, the slit windows cyan light panels, the
  caps cream, the pieces' glows (`rt.P.glow`) cyan. incal.js reads these from `rt.skin.paints`. The band's sign is
  the shared open-corner mark, sized to fit the shallow band; the frieze glyph itself uses the same `sign-text.js glyphGeometry`.
- **Dressing**, drawn only (5 InstancedMeshes: `noCollide`, `keepBuried`, `dynamic`, out of the shadow passes):
  - lens terminals in alcoves (`NICHE`: a 3.9 m square frame standing 1.3 m out of the wall, dark reveals and back,
    a cream sill, a lit lens of cyan rings round a pale core at its back), two a room over head height, none in a room
    with an eye to strike;
  - great wedge vanes (`VANE`: 8 m long, 1.4 m wide at the axle to 3.6 m at the tip, cream rimmed) on axles out of the
    tall drums' walls, tiers every 11 m, up to five a tier, turning slowly (`SkinMotion`), none in the Warden's Hall;
    each kept clear by boxes along its length (so a drum's middle stays clear), off the draughts' columns (the
    flight's air, every `Updraft`'s whole height and 2.5 m round it), and off the posts, piers and the Climb's block;
  - an iris of sixteen metal blades round each round room's oculus, and a cyan rim at its lip.
  - Everything is kept off doorways, everything drawn on the walls, every floor's height and every piece, by boxes.
- **Presets.** On Low, Handheld and the Deck (`uWearLite`) the shader leaves out the slabs' tones, the chamfers and
  the circuits' jogs, and only half the vanes are drawn (every other one, `mesh.count`), standing still.
- **Cost** (this Mac, muted headless Chrome, 1280 × 720, 7 rooms, skin off → on): draw calls High 318 → 315, Low
  329 → 335; triangles 726 k → 637 k on High (the glowing glyphs leave the shadow passes); frame time within the
  machine's spread (High 11.2 → 9.9 ms, Low 6.7 → 6.7 ms). Dressing ~20–30 ms to build. The second pass (bigger
  panels, crisp lights, alcoves, 21 vanes for 7) costs nothing measurable: first skin → now, calls High 318 → 315, Low
  337 → 335, triangles 635 k → 634 k; the lights' glow went under the shadow passes' self-lit 0.8, so `done()` marks
  their meshes `castShadow = false` to keep them out of those passes as before.
- **Unlike the pictures:** the slabs are flat-shaded, not cut in relief (the chamfers are painted); the alcoves stand
  out of the wall rather than being cut into it; none of the vanes hang in a drum's middle (the flight's air), and the
  Lamp Gallery's drum has none (its puzzles fill it); the warden's ledge and the tripod robot are the guardian's own
  model, unchanged.

### The Aerie (`skins/aerie.js`)

After `references/temples/future/aerie/sheet-1.jpg` and `sheet-2.jpg`: a round shaft of dark slate open to the sky,
thin pale peach circuits ringing it, a turbine in the floor's grille driving the wind, ochre sand on the ledges,
floating discs and hexagons with glowing rims.

- **Surfaces** (the surface shader's albedo, pen lines and `emit` replaced, as the Well's; the picks' pixels sampled:
  walls #45494c–#595c61, floors #6f6863–#837977, ledges #c39e79–#d5b58b, and the game's shots match them):
  - `slate` (walls): tall vertical slabs, one to three 1.35 m cells wide (`skJ`), a joint across only every 11–19 m,
    staggered; each its tone, a chamfer lit down its left edge and shaded down its right (painted). Every 6.5 m a pair
    of thin peach lines rings the wall (most lit), and from some joints a line climbs to the next pair, stepping
    sideways once. Hatching 0.15 (sparse, as the picks' shadows).
  - `metal`: the doors and the hall's screens (1.6 m panels, a peach seam down some) and the trim (kerbs, caps, the
    stone feathers, the Moult's columns: a lighter slate, no seams).
  - `plates` (floors): at a room's own floor warm grey plates in rings round a round room's middle (two peach rings
    1.6 m in from the wall, one round the middle, four spokes) or a grid in a hall (an inlay 1.6 m in); anything higher
    (a ledge, a balcony, the perch, a lip, the raft) ochre sand, its sides darker sand.
- **Glows** (peach `#ffbe98`, `AERIE.emit` 0.67–0.76, just over the post pass's 0.62): the trim's flat rings round the
  vents' throats, the stones' cups and the perch, the vent mouths' and the great eye's rims (`sortTrim`, by shape, moved
  to a lit batch); the winds' own rings (`Updraft`'s); the wing lines up the well (arzach.js's, recoloured); the frieze's
  feathers become a row of lit `slot`s (the picks' slots that breathe the gusts); the frieze glyphs, the threshold's,
  the doors', the plates' and the raft's are the shared makers' mark (`sign-text.js glyphGeometry`), lit peach.
- **Dressing**, drawn only (7 InstancedMeshes: `noCollide`, `keepBuried`, `dynamic`, out of the shadow passes):
  turbines (`TURBINE`: 26 pitched blades between a hub ring and a frame) in the four great vents' grilles, clear of
  the plate in the middle, spinning up while their wind rises and running down when a stone stops it; a lit rim along
  every raised slab's edges (`raisedEdges`); a lit line round each great band of the well; floating discs and hexagons
  (sand tops, darker sides, a lit rim) in two tiers round the well, high round the Roost and along the gulf's walls,
  kept off every doorway, piece, floor, wind column (3.5 m round its whole height) and the gusts' air.
- **Presets.** On Low, Handheld and the Deck (`uWearLite`) the shader leaves out the slabs' tones, chamfers and the
  climbing circuits; half the floating plates are drawn.
- **Cost** (this Mac, muted headless Chrome, 960 × 540, the same 10 views, `?noskin=1` → skin, means of the views'
  medians): draw calls High 213 → 214, Low 219 → 225 (one view, over the well, swings 190–350 either way from run to
  run); triangles High 401 k → 328 k, Low 387 k → 313 k (the lights leave the shadow passes, the frieze glyphs become
  the lighter sign); frame time High 5.9 → 6.1 ms, Low 6.7 → 5.0 ms, within the shared machine's spread. Dressing
  ~35 ms to build.
- **Unlike the pictures:** the turbines stand on the floor rather than sunk in a pit; the vents' crossing bars stay
  over them; the stone feathers (round the crown, in the hall and over the gulf) are kept, in slate; the Elder is the
  guardian's own model.

### The Whale-House (`skins/whale-house.js`)

After `references/temples/future/whale-house/sheet-1.jpg` and `sheet-2.jpg`: a hall of dark sage slate, the great
window on the sea, brass dishes and rows of horn terminals, aquamarine lines.

- **Surfaces** (the surface shader's albedo, pen lines and `emit` replaced, as `landmark-materials.js` `stone()`
  does), green slate as drawn, its shade deeper (the house's `look` with no lift): the walls tall slabs 1.9 by
  7.5 m, few horizontal joints, set off column by column, each with a lit and a shaded chamfer and a fine pen seam
  (round halls patterned round their middle: the kit's plan); the floors mid-dark plates 3 by 2 m; big ceiling
  plates. Thin aquamarine lines are inlaid: up the walls from the floor with a 45° jog to a
  ring lens, along stretches of the walls' foot, and along the floor's seams in runs with 45° jogs and lensed
  ends. They are emissive (`emit`: lit in the dark, haloed by the post's bloom) and a slow pulse runs along them.
- **The house's own colours, swapped**: frames, lintels and columns dark metal; the coral course a dark slate one;
  the frieze's little shell a lens terminal (`porthole`: an aquamarine disc in brass); the whorled shells dark
  metal with brass bands (their shape and solids as they were); the pillars' coral bands and the floor rings
  glowing aquamarine; the water deep blue (`underwater.js` reads `rt.skin.mats`). The house's dishes and ears
  (`Dish`, `EchoEar`) wear the skin's brass, their materials swapped after the layout (`brassPieces`: their meshes,
  rings, logic and lights as they were).
- **Brass** (`mats.brass`; the horns' own `brassHorn` coloured by vertex): warm gold in the metal shader's tones (bright
  where it sees the horizon, dark below), lifted toward the light (`glow` 0.38, under a lamp's 0.62) so it keeps its
  gold in the rooms' shade; the horns' lips 1.3 times as bright, their collars and posts darker, their mouths near
  black down the throat, in the horns' one draw on every preset.
- **Its own light** (`skin.light`: `index.js` `attachTemple` reads `rt.skin?.light ?? def.palette.light` for the colour
  script inside): a cool grey shade (`#a5aeae`) and a neutral light where the house's own palette has a teal shade, so
  the slate keeps its green and the brass its gold. Without the skin (`?noskin=1`) the house's own.
- **The great windows** (`rt.skinGlass`, the Tank Hall's and the Pool Room's): a heavy dark metal frame on the
  room's side (posts kept off doorways and the rungs' columns, a sill, a header over the Pool Room's only: the
  tank's is climbed), lit lines along it; the Glass piece's pane drawn as the sea (`seaMaterial`: deep blue, darker
  below, slanted shafts of light, motes; the sea floor, the Listener's fan of an ear and a whale with its flipper,
  fluke and throat grooves on two planes 10 and 24 m behind the pane, each pixel looked through to them, so they slide
  behind the glass as you walk: `whFar`) and its grid (`mullions`: the piece's bars mesh given four heavy posts, at
  its ends and a third and two thirds where the frame's posts stand, a head and a sill, for its 1.6 by 2 m grid) dark
  metal. Its logic and collider are untouched (the piece's group is walked through).
- **Dressing, drawn only** (6 InstancedMeshes: noCollide, keepBuried, out of the shadow passes, never tiled):
  a row of up to seven big brass horn terminals (bells 1.2 m across, dark mouths) on slate footings along the
  longest clear wall of every big hall, a lit circuit down the wall to each from a slate shelf over the row, brass
  dish horns on the shelf; tall slate listening slabs with a ring lens and a lit strip along the other walls and
  round the round halls; the great windows' frames. Placed from `TempleKit.plan`, kept
  off every doorway, piece and thing drawn on the walls by boxes; their feet 5 cm into the floor (no shared plane).
- **Lighter presets** (`uWearLite`: Low, Handheld, the Deck): no chamfers, the floors' second set of lines and the
  walls' foot lines left out, the footings' small lenses hidden.
- The makers' glyph (the open corner and shorter upright) is the shared `glyphGeometry`, on the doors and friezes as
  in every house; the pieces (dishes, ears, balls, the glass's grid) keep their own looks.
- Cost (1280x720, this Mac, six rooms): -7 to +10 draw calls on High, -14 to +1 on Low; fewer triangles (the
  friezes' shells were heavier than the lenses); frame time no worse (within the run's noise). `tests/temple-skins.test.js`.

### The Hush-House (`skins/hush-house.js`)

After `references/temples/future/hush-house/sheet-1.jpg`: a sound-damping hall of dark indigo slate, deep square
coffers up its walls and over its vaults, thin violet circuits in their seams, warm grey floor plates, long hexagonal
crystal resonators in slate collars over the black pool, the gates of jaws heavy slate shutters.

- **Surfaces** (the surface shader's albedo, first pen lines and `emit` replaced, as `landmark-materials.js stone()`
  does; the values sampled from the pick: its lit slate `#4f506c`, floors `#807679`):
  - `coffer` (walls): up to a dado 4.2 m over the room's floor (`HUSH.wall.dado`, the floor from the kit's recorded
    rooms) tall plain slabs, a dark groove over them lit violet in most; above, square coffers 4.8 m across (a whole
    number round a round room): a flat frame, a bevel down into the coffer lit at its foot and shaded at its head, a
    field, a second step (`skCoffer`, proportions by the coffer's size); some seams lit violet in runs of three
    coffers up and four across. Vaults coffered 4.8 m from the room's middle, a violet ring round each oculus.
  - `metal` (doors, the root-wall's face): 2.2 m machined panels, chamfered, a violet seam down some.
  - `plates` (floors): the pick's warm grey stone in 3 m plates, rings round a round room's middle, a grid in a hall,
    a few seams lit violet in runs, a violet inlay 1.6 m in from the walls; a floor's underside coffered.
  - `shutter` (the jaws' slabs, in their own frame): the slabs' tones by turns, a chamfer lit along each one's top, a
    pen line in every joint (its pitch the piece's own, `jaw.slabs.s`).
  - Hatching sparse (`hatch` 0.18 on the walls), every light just over the post pass's 0.62 halo start (`HUSH.emit`:
    lines 0.78, glyphs 0.72, rings 0.7, the resonators 0.68 breathing ±0.03), so lines stay crisp.
- **The house's own drawing**, redirected while the layout runs (the skin wraps `K.add` until `done()`: drawn only, the
  solids untouched): the bog's water a still black pool, the roots (tubes in the floor's material) heavy cables, the
  crystals grown through the floors teal and violet by turns. The house's light is the pick's cool lavender
  (`rt.skin.light`), not the dusk's rose.
- **The jaws** (the Snapping Passage's gate, its two mouths, the balcony's), square shutters as the pick draws them
  (v1.78): the piece itself (`pieces.js Jaw`, `jawSlabs(w, h)`) draws each leaf as a stack of square slabs about 0.9 m
  tall and 0.8 m deep, chamfered, each pointed toward the middle, every other one reaching 8 % of the gate's width (at
  most 0.35 m) past it so the two leaves interlock (4 cm apart at the points when shut), a thinner seam on every point,
  a stile at the hinge. What is drawn is what collides: the leaves are their own colliders (`physics.addMover`, all
  their meshes), and the still slot down the middle runs floor to lintel, since the points leave chinks at every joint.
  The skin dresses them: the slabs in the `shutter` pattern, the seams violet and lit, the stiles dark slate; stilled,
  the slabs frost pale blue (`SkinMotion`, from the jaw's `frost`). Without the skin (`?noskin=1`) they are the same
  shutters in the house's old rose, so collision is the same either way. Opening width, timing, what stills them and
  the logic are unchanged. `tests/temples.test.js` ("a shut gate of jaws collides as its two halves are drawn") casts
  rays jamb to jamb at every slab and joint, at three angles of the snap, against the drawing and the collision, and
  checks the square corners at the foot and under the lintel. No teeth: the pick shows none.
- **Dressing**, drawn only (two merged meshes: `noCollide`, `keepBuried`, `dynamic`, out of the shadow passes):
  stepped acoustic wedges (`WEDGE`: three slabs 0.5, 1 and 1.5 m out) every 4.2 m under the vault of every hall and
  round room 14 m tall or more; eight resonators (a rod into the vault, a machined collar, a long hexagonal crystal):
  four in a row over the Bog Well's water, longest first, the first two lit teal and violet with faint rings round them
  and the others dark, as drawn, and four round the Stilling Chamber's oculus; a stepped hexagonal plinth under each
  crystal grown through a floor. Kept off doorways, pieces and everything standing out of the walls by boxes.
- **Lighter presets** (`uWearLite`): no coffer bevels or slab tones, the walls' coffers along the face's axis (no search
  for the round room), every other wedge and no rings (the meshes' draw ranges).
- **Unlike the pick**: the coffers are painted, not cut in relief (the wedges are the relief); the jaws' slabs
  interlock by turns rather than meeting in one zigzag; the Mother Snapper, her crown and the pendulums are the
  guardian's and the pieces' own, unchanged; the makers' glyph is the shared `glyphGeometry`.
- Cost: (this Mac, muted headless Chrome, 1280 × 720, 9 views, skin off → on, the machine loaded): draw calls High 305 → 304,
  Low 320 → 319; triangles 481 k → 462 k on High, 388 k → 351 k on Low (the lights leave the shadow passes); frame and
  GPU time within the run's noise (GPU High 5.1 → 5.4 ms, Low 1.6 → 1.6 ms). Dressing ~15–40 ms to build.
  `tests/temple-skins.test.js`.
### The Engine-House (`skins/engine-house.js`, v1.78)

After `references/temples/future/engine-house/sheet-1.jpg` and `sheet-2.jpg`: a machine hall of navy slate and dark
metal, thin amber circuits, a pit glowing amber under the walkway, lens terminals in a square. The values are the
picks' (sampled: slate about L 40–60 of 255, `ENGINE_SKIN`).

- **Surfaces** (the surface shader's albedo, first pen lines and `emit` replaced; the kit's rooms in `uSkR`, up to
  `ENGINE_ROOMS`, so a round room's slabs run round it):
  - `wall` (walls, ceilings, the casing and parapets): tall 2.4 by 6.4 m slabs, each column's joints set off its own
    way, a lit and a shaded chamfer, hatching cut to 0.15; an amber circuit in some columns (up from the floor, a
    chamfered corner, across, up to a small lens), a foot line along some stretches. In a pit (`uSkPitA/B`: the
    boxes of the embers, found from the ember material's batch) the slabs warm to amber toward the embers (`emit`
    0.5 at most, under the halo) and a lit line runs down every column.
  - the machine (`wallGlyph`: the gantry, the doors' leaves): darker metal, 1.8 by 3.2 m panels, denser circuits; a
    door's leaf (in its own frame, `machineObj`) a lit seam up its middle.
  - `floor`: 2.4 by 1.6 m plates, lines along the seams with 45° jogs ending in lenses, a border line 1.5 m in from
    each room's walls (a passage's along its length), an amber line 14 cm under every landing's lip (`uSkLips`).
    The riding discs and the bridge take the plates in their own frame (`floorObj`), a lens in the middle.
  - Lines emit 0.72–0.80 (a slow pulse travels along them): crisp, just over the post pass's 0.62.
- **The house's own** (`buried.js` reads `rt.skin`): the embers' material amber light (`skin.mats.ember`; the pits'
  dark and its spiral are `pit-void.js`'s, drawn over them as in every house, in the house's amber glow); the
  Tooth-Warden's colours (`skin.warden`: darker rust-red plates on navy; its round body is the shared
  `sentinelModel`, not the picks' boxy one); the hammers' heads dark metal (`rt.P.wall2`); the trims, pipes and
  frames dark blue steel paint, the bands gone, the balls polished dark steel, the fittings brass; the frieze's
  ornament a thin lit ring on the slate (its well is the wall's own material: a dark disc 1 cm off a round room's
  chord z-fought); the rooms' light cool and the sun teal (`skin.light`).
- **The sign**: the kit's glyphs (friezes, the threshold) and the doors' medallions are the shared makers' mark
  (`sign-text.js glyphGeometry`), lit pale amber, on the walls only.
- **Dressing**, drawn only (5 InstancedMeshes: `noCollide`, `keepBuried`, `dynamic`, out of the shadow passes): in
  each hall 14 m high or more a square of four round lens terminals on a dark plate (two lit) on its longest clear
  wall, a lit line down to the floor; chamfered slate pilasters (1.5 m wide, 62 % of the room's height) along the halls'
  and round rooms' walls, a lit line up each and a lens at its head. Kept off doorways, pieces and everything drawn
  on the walls by boxes (`Keep`), their feet 5 cm into the floor.
- **Lighter presets** (`uWearLite`: Low, Handheld, the Deck): no chamfers, panel tones, foot lines or second floor
  lines; the pilasters' lenses hidden (`SkinLife`).
- **Cost** (this Mac, 10 rooms, skin off → on): the picture's own pass +5 draws on High (191 → 196), +4 on Low;
  shadow passes the same; triangles 443 k → 435 k on High, 371 k → 357 k on Low; frame time within the noise of a
  busy machine. Built in about 30 ms.
- **Unlike the pictures:** no teal shaft of daylight (the oculus' sun spot is teal-tinted only); the giant crank wheel,
  the drop hammer and the pistons are the house's pieces, smaller and round; the pits read as the game's dark void with
  amber walls rather than a bright amber floor; the warden keeps its round body.
### The Lamp-House (`skins/lamp-house.js`, v1.78)

After `references/temples/future/lamp-house/sheet-1.jpg`: a near-black hall where light wakes what waits for it.
`skin: (rt) => lampHouseSkin(rt, { rooms: ROOMS })` on `perdide2.js`'s def (the rooms tell it which hall is which).

- **Surfaces** (albedo, first pen lines and `emit` replaced): blue-black wall slabs 3.4 by 9.5 m with chamfers and
  few joints (sampled: the sheet's walls `#17181e`, the game's now about `#19181e`), hatching cut to a fifth; dark
  slate floor plates 2.4 m; thin gold lines up the walls (a 45° jog to a small lens) and along the floor's seams,
  and two rings and their spokes round every basin (`uLhPool`: the four pools and the three lure pools).
- **The lines wake to light** (`uLhSrc`, 16 points the skin's `SkinLife` gathers each frame: the lantern you carry,
  7.5 m; a lit pool or eye; a woken lamp; a lit lure pool; the great lamp once the house is lit): near one a line is
  gold and glows (emit 0.76, just over the post's halo start); far from all it is a dull bronze inlay (0.3–0.45).
  The house stays dark and the lantern's role is what you see: the floor lights up round you and fades behind you.
- **The house's own, swapped**: frames, lintels, columns and posts dark metal; the moss course gone for a dark one
  (paint); the roots dark bronze conduits; `rt.P.glow` gold while the layout runs (eyes, door signs, orbs); the
  basins' rings (the trim's annuli round each pool, found by size and place) machined bronze; their water black with
  faint rings that glow when lit; the lure pools black, gold as they take the light; the gallery's lantern-shown
  stones (`br1`) pale plates edged in gold; a soft gold `LightShaft` over each of the four pools once lit (not on the
  lighter presets). The hanging lamps by the friezes stay (a lens there z-fought the round halls' facets).
- **The Lampless** (`machineMoth`, once the guardian exists): its body a fuselage of octagonal white segments ringed
  in bronze with a keel, each wing's oval squared off into a flat plate (a superellipse), edged in bronze, its panels
  by turns paler; its sign in a round bronze-rimmed lens on each wing; its feelers bronze. Same groups, motion, hits.
- **Dressing, drawn only** (3 InstancedMeshes: noCollide, keepBuried, out of the shadow passes): a row of up to seven
  bronze sockets with blue-black glass spheres along the longest clear wall of each big hall, each with its tile of
  a dark panel (2 cm joints: no shared faces); the panels' gold lines and the sockets' small lamps (one draw; the
  lamps left out on Low by `count`); square plates floating 13 m and more over the floors (not over the Lamp-Room or
  the Kennel), drawn as a faint gold outline (`plate` body: uv edges) and solid only where a light is under them
  (`lhWakeUp`: the body discards elsewhere). Kept off doorways, pieces and small wall blocks (the Kennel's stalls).
- **Lighter presets**: no chamfers, no second set of floor lines or basin spokes, no shafts, no socket lamps.
- Not changed: the makers' glyph is the shared `glyphGeometry` (on the doors it still reads as a frowning face: a
  shared-code change for every house), the pieces' own shapes. Cost (9 views, this Mac): +15 calls on High on
  average (+11 to +30), +9 on Low, triangles a little fewer, 60 fps held. `tests/temple-skins.test.js`.

### The Undertower (`skins/undertower.js`)

After `references/temples/future/undertower/sheet-1.jpg` and `sheet-2.jpg`: a hall of dark blue-grey slate, brass dishes
facing each other across a cable pit, bronze spheres, coral circuits, the First Sign a mast with a listening dish.

- **Surfaces** (the surface shader's albedo, pen lines and `emit` replaced, as `landmark-materials.js` `stone()`
  does; `UNDERTOWER_SKIN`, values sampled from the sheets): the walls tall slate panels (2.6 by 9 m, each column's
  joints set off its own way, half the joints left out: few, tall slabs), a lit and a shaded chamfer, inked seams,
  hatching cut to 0.15; floors and ceilings 3.2 by 2.2 m plates. Thin coral lines (2.6 to 3.4 cm, never under a
  pixel) rise up the walls from the floor with a 45° jog to a ring lens and run along the floor plates' seams with 45°
  jogs to lensed ends; they pulse slowly and emit at 0.76 (just over the post's 0.62 halo start: crisp). The round
  halls go to the shader (`uUtRound`), so their panels run round them.
- **The house's own:** frames and courses dark slate paints (in the kit's paint mesh: no draw of their own), the
  frieze's slots thin coral slits, the glyphs coral; `M.trimMat` brass and `M.stoneMat` bronze while the layout runs,
  so the fittings are brass and the singing balls and eggs bronze (their rings keep their notes' colours); the dishes'
  cream bowls and the horns brass after it, the dishes' lenses coral; the dishes on the walls brass (`bazaar.js` reads
  `rt.skin.mats.brass`); the First Sign in `rt.skin.sign`'s colours (a brass mast and dish, coral lamps:
  `signModel(colours)`). Its own light (`rt.skin.light`): a clear slate-blue shade instead of the house's deep violet.
  Brass and bronze smooth-shaded with a low reflection (the flat-shaded bowls broke into stripes).
- **Dressing**, drawn only (5 meshes: `noCollide`, `keepBuried`, `dynamic`, out of the shadow passes): paler slate
  monoliths with a coral slit and a lens along the big halls' walls (on the landings in a pit's hall: `rt.skinPits`)
  and between the round halls' stones (instanced); brass collars round the dishes' stands (`rt.skinStands`, recorded
  by `bazaar.js stand()`), coral lines up their stems and out across the floor to a lens where the floor is clear of
  grooves, plates and pieces; 46 cables in each cable pit, out of its walls, along its floor and up the far wall, kept
  off the pillars' line, coral sparks drifting along them (the `cable` body). The lights are baked into two meshes (the
  finest, on the floor, hidden on the lighter presets).
- **Lighter presets** (`uWearLite`): no chamfers, no floor's second set of lines or walls' foot lines, the floor lines
  from the stands and their lenses hidden.
- Not changed: the makers' glyph (three dots over an arc) is the shared `glyphGeometry`, on the doors, the friezes, the
  glyph stones and the eggs, as in every house; the pieces' notes' colours; the rooms, collision, pieces and logic.
- **Unlike the pictures:** the monoliths stand straight (the drawings' walls lean and step); the pit is darker (the
  rooms' lamps light the floors in pools); the stepping plates are the house's own pillars; the floors' coral lines are
  finer than drawn and fade at a distance.
- Cost (1280 × 720, this Mac, six rooms, skin off → on): the dressing 5 draws on High, 4 on Low; whole frames within
  the counts' spread (-7 to +22 on High, -13 to +4 on Low); fewer triangles (the glyphs leave the shadow passes); frame
  time no worse (High 2.9 to 4.1 ms → 2.9 to 3.4, Low 1.8 to 2.1 → 1.7 to 1.8, the quiet runs). Dressing ~25–100 ms
  to build. `tests/temple-skins.test.js`.
### The Mooring-House (`skins/mooring-house.js`, v1.78)

After `references/temples/future/mooring-house/sheet-1.jpg` and `sheet-2.jpg`: round halls of dark slate round a
stopped ring winch banded in teal, cables slack out to the islands under the planet. `skin: mooringHouseSkin` on
`spacecity.js`'s def; its layout reads `rt.skin.house` (the paints, the capstan's drum, the starlight lines, the
warden's colours) and draws the same solids either way. Values sampled from the picks (walls L 58–85, `MOORING_SKIN`).

- **Surfaces** (albedo, first pen lines and `emit` replaced; the kit's rooms in `uSkR`, up to `MOORING_ROOMS`):
  - `wall`: violet-grey slabs 2.6 by 7.2 m, each column's joints its own, lit and shaded chamfers, hatching 0.15, a
    rare teal circuit (density 0.22); one dark ledge course at three fifths of the walls (`M.bands`).
  - `floor`: in a round room plates in rings 2.6 m apart round its middle (the picks' concentric floor), in halls
    2.6 m plates with a few line runs; a teal border 1.5 m in; round the capstan's foot (`uSkHub`) a dark well ring,
    a teal line at its lip and twelve short spokes to lenses; a teal line under every landing's lip over the void.
  - `drum` (the capstan's body and lid): dark teal-slate panels banded with thin teal runs with 45° jogs and a few
    lenses, the lid rings round a lens; its cable wrap left off (drawn only), its bars and base dark iron.
  - Lines emit 0.72–0.78 with a slow pulse: crisp, just over the post's 0.62.
- **The house's own**: brass muted, iron near black, cables dark (paints); the starlight lines and the frieze's
  moorers' rings' line teal (the skin's glow); the ornaments' rings dark metal; the glyph pale teal (the shared
  open-corner mark, its shape left as it is); the fittings (the weight's bands, the doors') brass, the balls and the
  weight dark steel; the Anchor-Warden ochre brass on dark iron, its dome iron, its eye teal (`anchorModel(skin.house.warden)`);
  the light lavender shade and cream light (`skin.light`).
- **Dressing**, drawn only: ring lights (a dark rounded bezel, a flat teal ring and lens) at 1.9 m round the round
  rooms and the floored halls, one every 6.5 m, off doorways and pieces; a slate-framed dark slot with a teal sill where
  each of the Capstan Hall's six cables meets the wall. Both merged into the kit's paint and glow batches (no draws of
  their own). Square slate plates floating 10–22 m up over the big rooms and the void halls, a teal lens on each face,
  bobbing (two InstancedMeshes, out of the shadow passes, `MOORING_PLATES`); eight islands of the city's adobe in the
  void (overhead, seen up through the Drift's and the Balance's open tops; out of the Capstan Floor's west windows),
  each with a slack cable to the house (one mesh, `dynamic`, no shadow, `MOORING_ISLANDS`; kept out of the pits'
  boxes, whose wash would ink them, and their own mesh so the z-fight audit doesn't stand on them).
- **Lighter presets**: no chamfers, panel tones or floor line runs; the plates still, their lenses hidden (`SkinLife`).
- **Cost** (15 views, this Mac): the picture's own pass +0 to +3 draws, every pass about the same (157 → 155 High,
  170 → 164 Low), triangles 488 k → 438 k (High), frame time +0.5 ms (3.95 → 4.56 High). Built in about 18 ms.
- **Unlike the pictures:** the capstan stays the house's own size (a drum 6 m across, not a house), so the drum reads
  as a big machine rather than the hall's floor; no sunken well round it (painted on the floor); no wall-mounted
  weight bracket (the weight stays on its mast); the Anchor-Warden keeps its capstan body, not the picks' humanoid
  robot; the planet is the world's sky, seen only where the house is open.


### The Clock-House (`skins/clock-house.js`, v1.78)

After `references/temples/future/clock-house/sheet-1.jpg`: a tall round hall of dark slate round a chasm, a column of
stopped sand in tilted brass orrery rings, a pendulum disc on its arm, six lens terminals, warm light and teal glow.

- **Surfaces** (the surface shader's albedo, first pen lines and `emit` replaced, as the other skins): the walls dark
  slate (`#565b63`, the pick's value) in tall 2.4 m slabs, a joint across only every 9 m (staggered by column), a lit
  and a shaded chamfer, a thin brass strip in every third joint; a dark plinth with a thin teal line along its top; a
  brass rail and the drawing's warm cream drum above 78% of a room's height (lit a little from within, 0.36, so it keeps
  its warmth in the shade); the ceilings cream plates. Under every landing's lip (the Escapement's pit, the gallery's
  chasm) narrow umber slabs darkening into the deep: the kit's plan gives each hall without a floor its walking level
  (its landings' tops, `roomsOf`), handed to the shader with the rooms (`uSkY.z`, up to `CLOCK_ROOMS`). Floors warm
  grey plates (3 m in a hall, rings round a round room's middle), chamfered, a brass and a teal line inlaid round each
  hall and round the middle of a round room, a teal line down each passage; a landing's face a pale lip over a brass
  line. The machined faces (`wallGlyph`: doors, steles, the climb's block, the clock cases, the dial's tower) 1.6 by
  4.8 m panels, a teal seam every 9.6 m (a door's between its leaves). The teal lines emit 0.74 (just over the post
  pass's 0.62 halo start) and breathe.
- **The house's own, swapped**: its brass darker and warmer (`#a07a42`, the frames, the dials' rims, the escape wheel:
  the layout's own `metal('#d8a24a')` batch moved into the skin's), its columns and the chest's mound slate, its dark
  the drawing's umber, the glyphs teal light (out of the shadow passes), no little clocks along the frieze (the lens
  terminals are the ornament now). The pieces' surfaces in the skin's in their own frame (`floorObj`, `machineObj`:
  the doors' slabs, the bridge's plates), the Escapement's riding disc brass (the drawing's pendulum disc). The
  Foreman's drum all brass with a pale teal dial (`skin.foreman`, passed to `foremanModel` by `garage.js`). The rooms'
  light warm with an umber shade (`skin.light`).
- **Dressing**, drawn only (four merged, vertex-coloured meshes, brass, teal, dark and sand, and the glass:
  `noCollide`, `keepBuried`, `dynamic`, out of the shadow passes), placed from the kit's plan and kept off every
  doorway, piece (and a moving one's path) and everything the layout drew:
  - **the clock** twice: over the Escapement's pit (east of the riding disc's way, hung from its beam) and high in the
    Winding Well under its oculus (hung from the ring round it, well over every walkway): a column of glass
    (`landmark-materials.js glazing`: only its rims and a streak drawn, a pale wash over it after the flush), a stream
    of pale sand stopped mid-fall inside it, grains stopped in the air under it, a heap on its foot, thin brass rings
    each tilted on its own axis round it with a teal circuit dashed round each, stepped brass collars with teal rings;
    under the pit's a stack of discs, a shaft into the dark and a brass disc on a long arm frozen at the end of its
    swing (inside the pit, under the landings: not a floor);
  - **lens terminals** in sixes round the great round rooms (on the stones' middles, the ring turned to miss the most
    doorways and things) and in rows along the great halls' long walls: a bolted brass rim, a dark bezel, a teal core
    with a pale heart, two of every six dark with a grating;
  - square slate plates edged in brass floating deep in the gallery's chasm (7–9 m under the bridge, in the pit).
- **Lighter presets** (`uWearLite`): the slabs' tones and chamfers left out, and the dressing's finest parts (bolts,
  gratings, dashes, grains, the cage's rods) not drawn (each mesh's draw range stops short of them).
- **Cost** (this Mac, muted headless Chrome, 1280 × 720, the skin off → on in two loads, the camera pinned): draw calls
  +3 in most rooms on High and Low (−5 to +12 over thirteen rooms; the Pendulum Hall's swing with its keepers);
  triangles 60–90 k fewer a frame on High (the frieze's little clocks gone, the lit glyphs out of the shadow passes);
  frame time within the run's noise (the Winding Well at load 15: High 5.4 → 5.2 ms and 5.0 → 5.0, Low 2.6 → 2.7 and
  2.6 → 2.6). The dressing takes 40–110 ms to build (the machine idle to busy).
- **Unlike the picture**: the room is the house's shrine halls and drums, not one round hall over a chasm, so the
  clock hangs in two of them rather than being the room; the walkway of floating plates is the gallery's bridge as it
  was (its plates in the skin’s plates) and a few plates far down the chasm; the pit's dark (`pit-void.js`) keeps the
  house palette's blue; the makers' mark on the doors and friezes is the shared `glyphGeometry` (the open-corner mark), left as it is.
### The Footprint (`skins/footprint.js`, v1.78)

After `references/temples/future/footprint/sheet-1.jpg`: a white sphere of smooth cream panels, ringed walkways with
pale blue-white lines along their lips, round lens terminals of teal glass, thin rings under the oculi. Kept light
and pale as its pick (sampled: lit cream `#e7d7c7`, lavender shade): the house's own light (peach light, lavender
shade) is kept.

- **Surfaces** (the surface shader's albedo, first pen lines and `emit` replaced, as the Well's): `plaster` walls in
  4.5 m courses of 4.6 m panels (a whole number round a round room), fine seams, a soft chamfer, a round or an
  octagonal plate set in about a third of the panels above the lowest course, a lit line along the walls' foot;
  ceilings in rings of plates with a lit ring round the oculus (a lit frame round a hall's square one: the halls'
  oculi handed to the shader in `uFpY.zw`); `plates` floors, cream, in rings round a round room and a grid in a hall,
  a lit inlay 1.6 m in from the walls and a lit line along every ledge's lip at the floors' height (the pits' edges);
  `metal` doors, pale machined panels with a lit seam down some. Hatching cut to 0.15 on the walls, 0.4 on floors.
- **The house's colours swapped**: trim, columns and fittings cream (the sage door bands and plate rims pale grey),
  the grooves and pit floors lavender-grey, the glyphs a deeper blue (`#82c9ec`) to read on cream, the pieces' glow
  (`rt.P.glow`: plates, door medallions, the stones the lens shows) pale blue-white. The frieze's portholes are left
  out (`M.ornament = null`): the lens terminals stand on the walls instead. A hidden door's slab (`sc`) takes the
  walls' own panels, so it reads as plain wall until the lens shows it.
- **Dressing, drawn only** (5 InstancedMeshes: noCollide, keepBuried, out of the shadow passes): walkways 3 m deep
  round every tall room (`walkLevels`: at 10.4 m over the doorways and 1.8 m over the frieze, never within 1.5 m of
  its glyphs or 2.5 m of the ceiling), lathed rings in the round rooms, straight runs in the halls, columns piercing
  them as a gallery's; broken only by a glyph or a piece (never over a door: a break would show the hidden one), each
  with a lit line along its lip; two lens terminals a tall room (none where an eye is to be struck); a thin ring
  under each oculus, and a tilted one turning inside the Lens Chamber's.
- **Lighter presets** (`uWearLite`): no panel tones, chamfers or plates; the floating rings not drawn.
- Not matched: the pool stays dark (the pits' void, `src/pit-void.js`, keeps a deadly drop reading as one); the Echo
  and the makers' glyph are shared code (`guardians.js`, `glyphGeometry`), unchanged; no glass bridge is added (the
  stones the lens shows are the house's own `LensStones`).

### The houses' air (v1.79, issue #372, `src/temples/air.js`)

Each skinned house has an air, a light and a sound of its own while you are inside (the plan, house by house:
`docs/design/temple-ambience.md`). `HOUSE_AIR[id]`: its theme, one or two `layers`, its `light`, its `sound`.
- **The air**: each layer a `life.js Motes` (one draw, points round the camera that wrap in a box `box` m wide and
  `tall` × box high, `rise` m/s (negative falls: drips, the Clock-House's sand), `wind`, `sway` (the drift's wobble),
  `glow` (no rim, a halo, blinking: embers, sparks, glints), `alpha`). `HouseAir` (main.js; engine/game.js with
  `host: scene`, so the bridge mirrors the points as the world's motes) builds a house's layers the first time you go in
  (`rt.inside`), shows them only there and hides the world's motes inside (the desert's sand stops at the door). Low-detail
  presets (the handheld, Low, the Deck) build `AIR_LOW` (half) of each. `?noair=1` leaves it out, for a before and after.
- **The light**: the house's own lights (`rt.ownLights`, the layout's) have their reach eased by `lightPulse`
  (`flicker` a fire's, `breathe` a slow swell, `blink` a signal's two pulses and a rest, `tick` a clock's), put back
  as built on the way out. Both renderers take the local lights from `level.lights` each frame. `houseAir.still` holds
  them at their reach as built: a fixed view's picture (engine/game.js `pin`, scripts/design-qc/capture.mjs), so the web
  and Unity side by side catch the same pool of light (issue #264).
- **The sound**: `houseAir.sound` goes to `Sound.update` as `house` (src/audio.js): a low roar (`roar`, `roarF`: a
  furnace, the sea), the drone (`hum` at `humF`), wind (`howl`), and `houseTick(bed)` on the score's beat in place of
  the world's ambience (`fire`, `furnace`, `forge`, `gusts`, `bells`, `drips`, `filament`, `deep`, `vanes`, `ticks`,
  `glass`, `cables`, `signals`: crackle, a struck anvil or bell's `ring`, a `drip` and its echo, a far `moan`, a
  cable's `creak`).
- **In Unity**: the points reach the port's `Hiraeth/Mote` quads; its shader now draws a glow as the web's (no rim, a
  soft halo, brighter, blinking, each quad on a phase of its own) and an alpha (BridgeRenderer `_Glow`, `_Alpha`, the
  quad sized × (1 + 0.8 glow) as `gl_PointSize`). The world's fireflies and glowing motes gain their halo there too.
- `tests/temple-air.test.js`: every skinned house has one and nothing else, the budgets, the fire houses' embers, the
  pulse's bounds, inside only (lights back, the world's motes back), every bed sounding on the in-memory Web Audio.


## Landmarks seen from the approach (14 October 2026)

All fourteen current temples now use the author's Midjourney favourites in
`references/temples/landmarks-2026-10-14/`. Its manifest preserves each full-size
selected image, original prompt, job URL/index and checksum. These exterior
references guide the full exterior forms, foundations, entrances and ornament;
the earlier interior references and puzzles remain in place. Both houses in each merged world are included,
and the Clock-House is built in the Glass Dunes, under its saved `garage` id.

`landmarks.js` builds the structural silhouettes in each exterior's existing
`TempleKit` frame. The individual exterior keeps its portal connection, approach and live
story props. The Aerie's threshold and staircase rise together onto its broader
terraces. Its surrounding random spires are kept outside the 82 m wing clearance;
named quest spires remain. The crane hook, returning bird and capstan attach to
their new supports. Solid geometry uses `K.both`: the drawn curves and openings match the
collision. Parts merge per material: two to six surface batches per landmark.
`landmark-materials.js` separates cut stone (staggered joints, block tone variation and fine worn edges),
glazed ceramic, brushed brass/copper/iron and pearly shell. These reuse the game's
surface shader and flat reflection tones, with a material-owned shadow print so
coral, cobalt and teal remain visible under each world's atmosphere. No bitmap
textures are loaded.

The Greenhouse, Footprint and clock cover use `glass` rims in the G-buffer and a
translucent tint in `Veils`, tested against the scene depth. `glaze` marks the source
mesh `noBatch` so the wash follows its visibility after static batching. Its glass
collision is unchanged. The Greenhouse contains planting benches, plants and
trusses at different depths; restored growth follows the new elliptical windows
and interior beds instead of the old dome's spherical coordinates.

The Lamp-House has an amber glass chimney, brass lamp holders and a smaller
self-lit core. A warm pilot lights the saucer before restoration; the existing
world-change hook raises it to a near-white lamp, expands its existing local light
from 18 to 100 m (reaching the water) and starts the sweeping beam. There is no
additional per-frame updater or additional local-light slot. The core and glass
wash retain separate intensities.

| Temple | Selected silhouette |
| --- | --- |
| Rose House | Rose fins with a turquoise oculus above a stepped cistern |
| Aerie | Continuous swept stone wings, split needle, tall turquoise arch and broad ochre terraces |
| Founders' Belfry | Two rose pylons framing a suspended bronze bell |
| Hush-House | Four tall pale lavender choir fins around a crystal |
| Lamp-House | Dark buttressed tower, broad ivory saucer and amber lantern cage |
| Builders' Greenhouse | Tall glass bud between swept ivory ribs above a wide glasshouse and coral eaves |
| Warden's Well | Cream terraces, cobalt flues and a brass-rimmed pale aperture |
| Clock-House | Giant working teal clock between cream uprights |
| Engine-House | Ivory exhaust blades around an edge-on copper flywheel |
| Footprint | Three sage prongs and a tall amber lens with a turquoise crescent inlay |
| Undertower | Pale stepped pylons and a large bronze receiving dish |
| Casting-House | Ivory split chimney and open ochre crescent mould |
| Mooring-House | Low coral house under three teal mooring legs |
| Whale-House | Solid nautilus shell with spiral chambers, broad coral lip and an open vaulted mouth |

The clock's original hands still tell time; the capstan, cables, casting crane,
lamps, returning bird, growing greenhouse and water channels keep their existing
story hooks. The Belfry's founders' lamp is mounted on its left pylon. Wider
crowns have wider flora clearances where needed. `temple-landmarks.test.js` checks
asset coverage, finite/bounded geometry, visible-to-solid surface agreement and
the Belfry's open sky gap; the existing temple playthroughs check the journeys.

The second reference pass measures scale against the retained entrances. `LANDMARK_SCALE`
and `landmarkFrame` enlarge the structural shells around the walking plane without
scaling the portals: the Belfry is 1.7 times taller, the Footprint 1.65, the Warden's
Well 1.5, and the Greenhouse 1.35. Door frames stay at their original scale and
horizontal location; the Rose House's threshold rises with its new steps. The Greenhouse's windows, planting benches and restored growth share its
larger frame; its stairs are 28 m wide. Hush-House's wider canopy has an open colonnade,
and the Undertower has stepped blue-grey shoulders and three recessed arch frames.
The Clock-House has bronze door leaves. Rose House is vermilion stone; the Engine-House
combines ivory stone, navy iron and red riveted metal with copper machinery.

The Whale-House uses continuous rounded shell sweeps, a flared folded lip and a
scalloped whorl with spiral sutures. Surface lines follow the curved skin, and the
structural collision uses those same sweeps. All shells stay below 24,000 triangles.

Approaches are part of this pass: local clouds surround the Belfry's plinth; the
Lamp-House stands farther east in the shallows with a longer continuous line of
stepping stones and a clearing through the forest. The Warden's rim forecourt
excludes ambient villas and trees while retaining its named paths and places.
The underwater city's two flanking pod towers sit farther to the side of its temple view. The existing root cave, travel tubes,
quests and interior rooms stay connected.

The foundation pass gives the Rose House twelve full elliptical stair tiers,
with its threshold 6 m higher and a central flight down to sampled sand. Its fins
meet the top terrace; no outer drum hides the treads. The Greenhouse hill widens
across the facade within its existing outer boundary, retaining the playable water
stair's terrain cut. The exterior stair samples its actual far landing, and the
garden beds are short, grounded terraces placed clear of the water stair.

Lorn's terrain supports the Hush-House's whole colonnade on a level moss island.
The Lamp-House has three splayed stone feet sunk into a shallow basin, with its
front pair flanking the causeway and a solid apron joining the original threshold.
The Engine-House's ten thick red elbows start outside the enlarged drum, have
flanged joints and end below sampled sand. The Footprint replaces its old small
heel-sphere and projecting porch with a broad rounded entrance mass and six low
lobed roots under the wings; its original doorway and three water-filled toes remain.
Regression checks cover exposed stair treads on every side, dry foundation contact,
submerged feet, the connected causeway, outer pipe/root collision and all fourteen
temple thresholds.


The surroundings pass uses `temples/vistas.js` for entrance-oriented clearings,
with prop radii included so a tree's canopy cannot hang into the opening. Natural
worlds omit ambient scenery before batching; their procedural draws are retained
where possible. Flora and background crowds also leave the forecourts clear.
Named paths, caves, garden stairs, travel tubes and quest structures remain.

The Belfry's decorative start-plateau stacks move onto the needle plateau. The
Warden's nearby skyline towers are omitted. The Glass Dunes' tall eastern billows
stand 60 m farther back; the carriers' stopped minute remains beside the route in
a low glass outcrop. The Engine-House's court moves to the side of its approach, on a level sand pad protected from drifts.
The market's two rear tower rows step back, the Casting-House gains an open roof
bay and fewer surrounding pillars, and scenic islands and pod towers move away
from the Mooring-House and Whale-House. Attached bridges and affected collectible
positions move with their scenery, retaining the existing save slots.

The clearings preserve the forest's random sequence and the garden's tree instance
numbers, keeping distant climbing routes stable. Authored sandfall mesas and the
market's listening crowd remain. The keepers' stakes go around the wider Hush-House,
service steps connect the rear market balconies, and the Glass slalom passes west
of the enlarged Clock-House. The Mooring-House's outer apron meets the island deck;
only its inner doorway platform is raised. Collectibles keep their save slots and
are checked for footing, reachability and separation from quest routes.

The Rose House shares `ROSE_SITE` with the desert height field. A flat terrace
extends 112 m from its centre and blends into the dunes by 200 m; the drift mask
also excludes its foundation. The real-world threshold test samples the outer
stair ring against the final terrain after drift accumulation, rather than only
testing the model on an artificial flat plane.

## The doorways (v1.82, issue #383)

Every landmark reference draws its house's door alike: a dark opening set deep in the wall, framed two or three times,
each frame a step wider and nearer than the one inside it, on a threshold of its own. The houses had a flat dark shape
on the facade and a square collider behind it, so a round or pointed door glowed as a rectangle. `temples/portal.js`
builds the way in from one outline (`openingPoints`: `round`, `pointed` as `landmarks.js arch()`, `rect` with its top
corners cut, `oval`):

- **frames** (`layers`, each `step` wider and `recess` nearer; the innermost the reveal, `back` deep; all reaching `into`
  the wall behind the dark, and `foot` below the sill onto a lower apron or the water), drawn and solid in the house's own
  landmark material, so they batch with it;
- **a line of light** round the innermost frame's face, round the outermost's, and along the threshold's front edge: one
  colour a house (`inlayMaterial`, flat and lit; the Hush-House uses its crystal's own glow), the makers' high technology;
- **a threshold plate** 7 cm over the sill, the **dark** on it and a solid in the opening's own shape behind it;
- **the door's shape for its light**: `door.top`, the opening's heights across (`openingTops`), which the runtime passes
  to the portal (`runtime.js`), so the glow (`door-light.js`, `thresholds.js openingAt`) fills the drawn opening exactly,
  at any size, instead of what `fitDoor` measured (it capped a door at 11 m and found the square collider).

Where the landmark draws an arch round the door (the Warden's Well, the Engine-House, the Casting-House) its opening is
cut a little inside the portal's outer frame; the Undertower's pink pylon is cut round three round frames, the outer two
standing out of the pylons; the Greenhouse's ivory pylon round its two. Each house, from its reference:

| House | Door | Frames | Light |
| --- | --- | --- | --- |
| Rose House | round, 7 × 10.4 | three, vermilion stone | turquoise (the oculus) |
| Aerie | pointed, 6 × 17.8 | two, teal ceramic, in the ochre arch | pale peach |
| Founders' Belfry | round, 4.4 × 7.6 (the gallery's small door; the square portico gone) | two, ivory stone | cobalt |
| Hush-House | round, 4.4 × 5.6, under the canopy | three, lavender ceramic | the crystal's |
| Lamp-House | round, 4.3 × 7.4 (the square portico gone) | two, slate, down to the water | warm amber |
| Builders' Greenhouse | rect, 3.4 × 8.6 | two, ivory, in the pylon | leaf green |
| Warden's Well | pointed, 5.5 × 15 | two, cream, in the landmark's arch | cyan |
| Clock-House | rect, 3.4 × 6.6, the bronze leaves in it | two, brass | teal |
| Engine-House | oval, 5.2 × 9.6 | three, riveted iron, in the plinth's arch | amber |
| Footprint | rect, 4.6 × 8.4 | three, teal ceramic, out of the heel | pale blue-white |
| Undertower | round, 4.8 × 8.6, 5 m deep | three, blue-grey, in the pink pylon | coral |
| Casting-House | round, 7.4 × 11 | two, blue iron, in the drum's arch | ivory |
| Mooring-House | pointed, 4.6 × 7.4 (the square portico gone) | two, adobe | teal |
| Whale-House | round, 4.4 × 6.6, sealing the tube's end | three, coral | aquamarine |

Each portal adds one draw (its light); the frames and plate merge into the house's own batches. Checked by
`tests/thresholds.test.js` (the Rose House's light is its door's shape), `tests/zfight.test.js` (no house gained a
fight; the City's own count moved 19 → 20 with its batches, the Mooring-House's still 0), the temple playthroughs
(every door walked into), and `tests/contact-audit.test.js` (what you climb is what is drawn). The contact audit now
samples each face from a seed of where it lies (`contact-audit.js reseed`), so a piece added in one place no longer
moves every other face's samples.

## Rose House doorway and sliding surfaces (v1.93, #608–#609)

The exterior portal now occupies the recess between the red fins: its dark plane is at
local z=9.5 m, and its frame reaches back to z=2.5 m to overlap the central wall.
The original stairs and upper terrace remain the approach. The entry threshold and
water over the terrace follow the new doorway; `outside.channelOrigin` retains the
established irrigation route through the dunes so moving the entrance does not shift
that channel off its bed.

The Rose skin gives moving `Door.slab` meshes a separate machined material with
`uSkObj=1`. Its slab joints and circuits use `vObjPos` and `vObjNormal`; static
architecture retains its world-relative pattern. This changes only the authored
surface coordinates: normal lighting and shadow calculations still use the world
position and normal. The same skin definition generates Unity's `SkinPatterns.hlsl`.
Portal collision/roof continuity, the terrace floor, the distant channel, and actual
slab motion are covered by the temple portal, skin and Desert water regressions.

## Futuristic skins: the Rose House (v1.77, issue #342)

The Rose House wears the author's futuristic picks (`references/temples/future/rose-house/sheet-1.jpg`, `sheet-2.jpg`):
a Givers' test chamber of dark slate and ember light, over the same rooms. Its skin is `src/temples/skins/rose-house.js`
(`skin: roseHouseSkin` on the house's def; the hooks are `src/temples/skins/index.js`). `?noskin=1` shows the house without it.

- **Surfaces** (the surface shader's albedo, first pen lines and `emit` replaced, as `landmark-materials.js` `stone()`
  does): the walls monolithic slabs of warm violet-grey slate (the picks' value and hue, sampled from the sheets) (4.2 m by about 6, staggered per column, each its own tone), a chamfer round each
  (lit above, shaded below), a pen line in every joint, rose sand caught in some; the makers' marked faces (doors, the
  gallery's face, the pier, the obelisk, the braziers) a finer machined slab. Warm sandstone floor plates, split in halves and
  quarters, rose sand drifted over them. The cistern's basin in stepped rings round its middle, a pale tide line under
  its rim. Along each face's own direction, so the round rooms' stones pattern as the straight walls do.
- **Circuits**: thin lines (4.5 cm, never under a pixel) in long straight runs up the slabs and through the floor plates,
  two strips to a slab column, each run on one of three lanes across its strip (so a third of the joints go straight on
  and the rest turn at right angles); most lit ember orange in runs of three segments, the rest dark grooves, a small lit
  node where a lit run turns or ends. Lit pixels set the surface's `emit` at 0.68 to 0.8, breathing slowly: just over the
  post pass's 0.62 halo start, so the bloom stays tight round the line.
- **Glows**: the frieze's ornament becomes the `slot` light panels (lit and dark by turns), the frieze glyphs, the doors' and
  the plates' are the shared makers' mark (`src/story/sign-text.js glyphGeometry`) lit ember, as are the spout slab's
  (2.4 m) and each obelisk terminal's (half a metre, between its lit bars), and an ember line runs down each groove. Daylight falls through slots along
  the great halls' ceilings (the picks' roof stopping short of the walls): a lit strip 1.5 m wide just under the ceiling
  along each wall, clear of the lintel and of anything standing up to the ceiling (`ROSE_SKIN.slot`; drawn only, the
  lighting rig untouched).
- **Dressing**, drawn only (three merged meshes, vertex-coloured so the dark lenses go with the slate and the daylight
  slots with the ember lines: `noCollide`, `keepBuried`, `dynamic`, out of the shadow passes): slate obelisks with a cold
  cup in the corners of the great halls, thin slate plates floating high under the ceilings, a thin flat hoop floating
  over every pilot flame, its inner edge lit, the spout slab hanging over the cistern with the sign and a dead lens.
  Kept off every doorway, archway, piece and the eyes to strike by keep-out boxes from the kit's plan and the pieces.
- **Braziers** (`rt.skin.brazier`): an obelisk terminal round the same hooded bowl and fire (two cheeks round a low mouth on
  the groove, a square cup, a cowl, the obelisk behind with the sign), its circuit lit with the bowl (`rt.skin.lit`).
- **Lighter presets** (Low, Handheld, the Deck: `uWearLite`): no dark circuits or panel insets, softer chamfers, and the
  floating plates hidden.

`tests/temple-skins.test.js` checks it wears the skin, and that its collision and climbs are vertex for vertex those of
the house without it (`rt.noSkin`), every piece where it was, and the dressing out of every doorway.
## Futuristic skins: the Founders' Belfry (v1.77, issue #342)

Its skin is `src/temples/skins/founders-belfry.js` (`skin: foundersBelfrySkin`; `?noskin=1` or `globalThis.__noHouseSkin`
shows the house without it). After `references/temples/future/founders-belfry/sheet-1.jpg` and `sheet-2.jpg`: dark slate, warm bronze, cobalt light.

- **Surfaces**: the wall, floor and door materials swapped for the skin's, their albedo, glow and first pen lines
  spliced into the surface shader (as `landmark-materials.js` `stone()`). Walls: dark slate in tall slabs 2.6 m wide
  (a joint across only every 6 m from the floor), each vertical seam edged with thin bronze, chamfered (a pale bevel
  down one edge, a dark one down the other); a ledge band 4.4 m up, a bronze rail under it; a pilaster every 7.8 m with
  a warm lit slot at its foot; a cobalt circuit round each room 1.1 m up that jogs between two heights, a lens where it
  jogs. Hatching on walls, doors and columns is cut to a fifth (`hatch`), as the sheet's sparse shadows. Floors:
  slate plates; round rooms in rings of plates round their middle with bronze and cobalt rings, halls with a bronze and
  cobalt border and a medallion in the middle, passages a cobalt line down their length. Doors: two heavy slate
  leaves in four slabs, a cobalt seam down the middle. The kit's plan (`TempleKit.plan`) hands the shader the rooms
  (`uSkR`, `uSkY`: up to 16, the round ones first) so round walls and floors are patterned round their middle.
- **The note**: while a founders' bell rings (its `BellEar` held or lit) or the whistle sounds, pale cobalt rings
  spread from it over every floor and wall near it, from the shader (`uSkBell`, set each frame by `BelfryNote`), and
  three faint cobalt rings hang in the air round the bell (one drawn-only mesh a bell, hidden while it is quiet).
  Every cobalt surface and lit slot is a light to the post pass (it writes `emit` just over the 0.62 the halo starts
  at, so the halo stays tight) and breathes slowly.
- **The bells** (`arzach2.js` `hang` asks `skin.bell`): not cups but resonators, four heavy chamfered bronze rings
  a ring's height apart round a dark core seen through every gap, held by nothing (no rod), a thin cobalt band round
  each and round the lowest's underside, and
  the shared makers' mark (`glyphGeometry`, 0.34 of the bell's scale) on the lowest, under its cobalt line.
- **Dressing**, drawn only, in the kit's batches (one draw for all the bronze, one for all the cobalt; the cobalt out
  of the shadow passes): a column of four lens terminals on a cobalt line beside every doorway 5 m or taller, on the
  face toward a room, kept off every piece and glyph. The frieze ornament a lens in a bronze ring; the frieze band dark
  slate; the trim (frames, caps, rims) bronze, the columns slate; the pieces' glow cobalt. The chest's mound
  (`skin.pedestal`, its collider as it is) is drawn as the sheet's hexagonal slate pedestal, a bronze edge round its
  top and a lit panel on each side.
- **Lighter presets** (Low, Handheld, the Deck: `uWearLite`): no tone per panel and no chamfers. Thin lines are never
  under about a pixel wide, so they hold at a low resolution. Draw calls are the house's own (the bronze and cobalt
  batches take the place of the bells' and the ornaments' own).
- The makers' glyph on the doors, the frieze and the bridge stones is the shared `glyphGeometry` (`story/sign-text.js`),
  now using the approved open-corner design.

## Makers’ mark comparison (local prototype, October 2026)

Open `/makers-mark.html` on the development server to compare the five hearted Midjourney
candidates in the Rose House. `src/makers-mark/candidates.js` contains clean relief interpretations
of the saved drawings in `references/makers-mark/selected-2026-10-15/` (provenance in its manifest).
The picker switches candidate; surface and distance controls keep the camera and lighting consistent.
The door, glyph stone, wall frieze and exterior landmark use the actual world, renderer and materials.
All candidates fit the same allotted square while retaining their own proportions. The existing mark
is available as a baseline. The other four candidates remain archived silhouette explorations.

Option 4, **Open corner**, was approved on 15 October and is now the production default.
`?markReview=1&mark=<id>` still selects alternatives; `mark=current` preserves the previous baseline.
Shared SVG, relief geometry, curved-surface ink and carved shader inscriptions use the chosen silhouette.
The narrative descriptions now match its open shoulder and shorter upright. The review seeds an ephemeral save before world loading; slot storage is also isolated
from initialization onward. Audio starts muted in the Sound constructor even when saved preferences
are audible. The embedded view does not accept game input. The review page is a development entry,
not a new production navigation item. Unit coverage: `tests/makers-mark.test.js`.

Every mark outside the shared code draws it through `glyphGeometry` (or `markOnSurface` on a curved
face): the kit's `ORNAMENTS.mark` (the Rose House's small carved sign under each lit one, seen without
its skin), the Lantern's tower, the stone face on the sky stones, Talo's post, the Buried gauges, the
scarf and the Home pebble. `tests/makers-mark.test.js` fails if any source but `src/makers-mark/`, the
review fallbacks and the skins (`src/temples/skins/`, which draw their own signs after their drawings)
draws a run of three dots with a partial ring under it.
  left as it is.

## Futuristic skins: the Casting-House (v1.78, issue #342)

The Casting-House wears the author's futuristic picks (`references/temples/future/casting-house/sheet-1.jpg`,
`sheet-2.jpg`): the founders' casting hall as ancient high technology, dark iron-brown slate and ivory light, over the
same rooms. Its skin is `src/temples/skins/casting-house.js` (`skin: castingHouseSkin` in `moonfoundry.js`); the house's
collision, climbs, pieces and logic are vertex for vertex the same without it (`tests/temple-skins.test.js`).

- **Surfaces** (the surface shader spliced, as the other skins): walls of dark iron-brown slate in slabs 1.6 m wide and
  about 7 m tall (a tone each, a lit chamfer down one edge, a shaded one down the other), the values sampled from the
  picks; a thin ivory line round every wall 1 m over its floor and again 1 m over the upper floor (11 m: `CASTING.up`,
  the house's `UP`, so a tall room's walls carry two tiers), and from some slab joints a line climbing from it, stepping
  sideways once, to a small lens terminal. The floor's height comes from that constant, not a search of the rooms per
  pixel (the shader's cost). Floors warm brown plates, in rings round a round room's middle with ivory rings and spokes
  inlaid, a hall's with an ivory border. The doors machined metal panels with an ivory seam down their middle (where
  the two slabs meet). The dark plinth band stays; the rust bands and the frieze course are gone, as the picks' clear walls.
- **The cracked moons** (the house's ivory paint, found by colour in the paint batches): a shader of their own, 3D cells
  cracked apart in two tones of ivory, lit 0.5 (bright, no halo); the great moon over the Pouring Floor 1.35 times
  larger, its three chains and every moon's old dark seam taken out of the paint batches. The founders' iron (claws,
  rails, columns, chains) is warmed to the picks' dark brown metal in the same pass.
- **The grating** (`CASTING.grate`, local m): in the Pouring Floor beside the great cradle, drawn by the floor's own
  shader (no mesh, no draw): dark iron bars in a frame over the amber glow of the Last Founder far below, brightest at
  its heart, the rings of its crucible doors dark in it; an ivory line round it half a metre out.
- **Dressing**, drawn only, two draws for the whole house (`skin: machined frames and rings` in the trim's metal, `skin:
  their lights` in ivory, instanced, out of the shadow passes): every door's slab frame (jambs and a lintel over its
  lamps, the opening's top corners chamfered, deeper on a round room's side where its wall bows out, an ivory line up
  each jamb and under the lintel); the great moon's floating ring, tilted, an ivory line round its inside and the
  makers' mark (0.42 m, to fit the ring's band) on its face toward the way in; two floating rings over each pilot flame, clear of the moons on their rails.
- **The cradles** (`skin.brazier`): each hooded cradle drawn as sheet-2's machined half-pipe open to the rail on two legs
  and a plinth, a tall hood behind with a stepped cap, an ivory line round its mouth and the makers' mark on the hood;
  the sign brightens (0.4 → 0.8) once the hot moon lights it (`SkinCradles`). The fire, the hood's mouth and its logic
  are the piece's own.
- **The sign**: the frieze's glyphs, the doors' medallions, the bridge stones' and every other piece's are the shared
  makers' mark (`glyphGeometry`), lit ivory.
- **Lighter presets** (`uWearLite`): no tone per slab, no chamfers, no climbing circuits, the moons one tone; the foot
  lines, inlays, grating and dressing stay. Draw calls are the house's own (−6 to +5 a view), triangles about 95k fewer
  (measured when the skin still redrew the signs, lighter than the glyphs).
