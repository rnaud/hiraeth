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
  instead, `wrong` what it says when it won't wake), `Jaw` (a gate of snapping jaws:
  a stilling glob stills it open for good), `Swing` (a crystal pendulum over a
  bridge that knocks you off; a stilling glob stops it a while), `Updraft` (a
  column of rising wind that lifts the fluid wings, holds you near its middle
  and lets you go at its top), `Gust` (gusts down a hall that shove you back,
  but not behind its screens), `BellEar` (the bell-note
  whistle sounded near it), `Platform` (a riding disc, a dynamic solid you stand
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
  arena (docs/systems/foes.md, "The guardians' last phases"). **`guardians.js`**: the Keeper's and the warden's bodies.
- **`runtime.js`**: one temple alive: builds the rooms (the world's `layout`),
  the building outside (`exterior`) with its doorway in and the ways out
  (portals), marks and pits (and a net under the whole temple), the chest's site
  (the box system places it: `PLACEMENTS` entries with `temple`), the guardian
  and its meter on screen, and the world change (`change`: `set(on)`, `update`).
- **`index.js`**: `attachTemple(levelId, scene, level)` (called by the level's
  `create`: joins portals, lights, `init`, `dynamic`, `update`, clears the
  world's own trees and rocks round the building) and `setupTempleStory(ctx)`
  (from `src/story/index.js`: the temple's quest, its local, the locators).
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
  the Listening Passage's door, the held pillar bridge, the far door that listens
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
- **Items**: `fire` moved into the Givers' House (and out again in v1.44, to the Givers' Hearth: the house holds the
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
  the Hall of Dark Pools through the doorway (`gap` on the door `d1`: it stops at the shut door), so light is
  carried before the chest, and the gallery's niche twists it with the lantern where no pool is. Since v1.27 the
  socket's lamp wakes moss-stones sunk in the dark pool instead of a disc (a `Bridge` with `glow`: drawn glowing, as a
  hidden bridge is, but there for everyone).
- **Shortcuts back** (v1.12): the Hush-House's Pendulum Gallery has a keeper's ledge along its east wall from the
  far landing to a gate by the near one, its footstone (`ps`) behind the gate: a second link between the two
  landings (`ds`) that only the far side can open, so the walk back never means the pendulums again.
- **Notes that travel** (the Undertower, from the same audit; its idea: a note travels, the dishes carry
  it across a hall, the shell in your pocket, one note at a time). A `Dish` is a pair of the makers'
  receiving dishes: a `'note'` sung or an `'echo'` played within `reach` (4.5 m) of the near dish's mouth
  comes out of the far one's 0.6 s later, as the same event marked `relayed` (a dish never passes on
  another's). It carries only while `when` holds (a ball's weight on its footstone, `drumOn`); dark, it
  says so and carries nothing. An `EchoEar` may hear a stone's own song (`hears: 'note'` or `'both'`), be
  set on a tall stand (`stand`, `size`), and hold its element for `hold` seconds like a held bell (the
  gallery's great horns: the pillar bridge, `{ any: [e1, e3] }`, stands while either rings, so the far
  side's own horn is the way back). A `Ball` with `sings: note` is a singing ball: a splash makes it sing.
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
  on the far door's vane; the Climb's ball crosses a slot (`Ball` `gap`, the slot a `Bridge`) only while the vane in
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
- **The Givers' House remade for empty hands** (v1.44, issues #74 and #7). The house is walked into with the backpack
  and the lift valve's double jump only (docs/systems/progression.md), and its gadget is the **Givers' blade** (`sword`),
  half-way, with their **guard** (`shield`) a little after: no gun, no gun mode anywhere in it
  (`tests/temples.test.js` solves it with `['backpack', 'doublejump']`). New parts it brought, any temple can use:
  - a `Ball` with `shove` rolls ahead of you when you walk into it along its groove (at most `SHOVE`, 2.6 m/s: hands),
    and with `blade` a cut of the sword sends it rolling at `BALL_CUT` (7.5 m/s); a drum's logic `roll: 'hand' | 'sword'`
    says what moves it (logic.js `rolls`; left out, the gun's push, as before);
  - a `Bramble` with `cut` falls to the sword (its element `needs: ['sword']`); a `Switch` with `blade` wakes only to
    a cut (a splash says it wants striking); a `Gust` with `guard` breaks on the shield raised into it
    (`player.guarding()`, `player.guardDir()` from src/fluid-blade.js), and you walk on into it at `guardPace`;
  - a `Flame` with `when` (and `lid`) burns only while its condition holds, under a stone lid until then;
  - a hooded `Brazier` catches from its burning ball as the ball rolls in slow (where it is, not where it last lay);
  - a `find` element: a second chest (`{ type: 'find', item, box }`, logic.js `find` / `isFound`, the layout's
    `finds` sites, src/boxes/placements.js `findSite`): the guard on the Hall of Fires' far landing;
  - a guardian's attack with `guard: true` is taken by the shield (boss.js `strike`, through `player.guard`), and
    `def.onBlock(g, a, perfect)` answers: the Keeper, jarred, pants;
  - a temple's `encounter: { room, extra }` (src/foes.js placeMachinesIn: the room's mark's machine and `extra` more),
    and `def.onUpdate(rt)` each frame: the Sword Chamber's doors `dc` and `dk` (opens: null) are held while its
    machines stand and you are in it (`chamberHeld`), so taking the blade wakes them and the way out waits until
    they are broken; a load puts the unbroken ones back, and nobody is shut out (the doors hold only with you inside).
  The rooms: the Hall of the Flame leans its ball by hand through the pilot flame into the hooded bowl (`b0`, the
  door `d1`); the Dry Channel is a sand pit with one pier, 9 m of air either side (one jump is about 6 m, the double
  jump 13), its side walls glazed against climbing (`Glazed`), and a plate on the pier's head (`pp`) wakes the
  chamber's door at the top of the gallery (`dc`, across the pit); the Sword Chamber holds the blade, its north door
  (`dk`) sinks for the blade in hand, the thorns over the chest ball's groove (`bw0`) are the blade alone, and its ball (`ball3`, a fire on its groove) leaned on goes out before the Hall of
  Fires' bowl (`b3`) while a cut gets it there burning (`CHEST_BALL`); the far landing holds the guard (`guard`); the
  Hall of Winds' bellows blow west down it (a `Gust` `guard`, out to `WING.lee`), and at its far end, out of the
  wind, a ball cut down the long groove burns out short of the far door's bowl (`b4`) unless the eye high on the end
  wall (`e10`, struck from a double jump) has lifted the relay fire's lid, and woken the keepers' door `sc`; the
  Keeper's spokes run from the basin out to hooded bowls on the rim, a fire half-way (`HEARTH_FIRE`): cut out, a
  ball lights its bowl (its first phase); a guard against its charge jars it and it pants, and water from your tank
  at its mouth (an interactable, `temple.desert.water`) calms it (its second); a ball cut back in from a lit bowl
  rolls burning to it (its last, and the only way it pants then). Ember mode comes with the fluid gun now, in the Givers' Hearth.
- **The Givers carried their fire** (the Givers' House, from the v1.24 audit; the house's one fire, the pilot flame,
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
  Passage's cradle a room on, and a second iron moon whose rail runs under that door (`gap` on the door) through the
  furnace's pilot flame into the hooded mould (the twist); the founders' press (`Hammer`, `hm`, until the founder is
  stopped) over the bridge; the Weighing Hall's keepers' pan and lidded eye, the keepers' door back onto the hub (the
  shortcut). The **Last Founder** (`founderModel`, a robot): splash its molten heart when its crucible doors open; from
  its second phase an iron moon in its casting cradle (`mA` on `pA`) makes it stop to look (a splash counts twice); in
  its last it tips the moon out as it shifts and the water only takes with the moon back in. After: its one whole moon
  hangs from the jib over the door and the chimney's glow is steady (`change`). Ilse, who keeps the founders' ledger, is
  its local.
- **Pulling things home across the void** (the City Floating in Space's Mooring-House, `spacecity.js` +
  `spacecity-data.js`, v1.40; its guardian's body `guardian-anchor.js`). A round adobe drum with the moorers' great
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
  Before the horn: the Sounding Hall is the hub (the west door's ball; the Pool Room's ball rolled across the whole hall
  under the east door's lidded eye; the Horn Door wants the pool's eye, splashed over a glass wall you can't climb, and
  the Shell Room's eye, unlidded by its ball). The Horn Chamber's try (a little horn that answers); the Song Passage's
  door held while its horn rings (`hold`: a short run, a room on); the Tank Hall's twist: a ball on the footstone wakes a
  `Dish` whose twin on the shelf says the note to the shelf's ear across the water, and while that ear rings the tank's
  glass is climbable (`Glass` `rungs: true`: brass rungs slide out of its frame instead of a vine, and back in when its
  `when` fails); the keepers' door from the landing (the loop back); the landing's dish, woken by its ball, carries the
  note to its twin high over the Listener's Door, whose ear (out of the horn's reach from the floor, and deaf without
  that ball) opens it: the key seen from the lock, reached elsewhere. The **Listener** (`listenerModel`, organic): when
  it spreads its great ear, sound the horn close by; from its second phase it shuts its ear to anything near and only the
  hall's dishes reach it (`ARENA_DISHES`, a ball on a footstone each); shifting into its last it knocks the balls off.
  After: the lamps in the house's horns and along its seam are lit (`change`), and the whales come back to the glass
  (`src/story/underwater.js`, `level.whalesNear`). Anselme, who keeps its door, is its local.
- **The lens shows where the walker set things down** (the Footprint, from the same audit). What is real carries the
  walker's print (`printGeometry(toes)`: three toes, like the Footprint itself); look-alikes carry two or four. The
  Lens Chamber's `Mural` (lens only, the element `mural` of type `clue`, which a gate names in `clue` so the audit
  counts it as a key a room back) shows the print; the Hall of the Unseen's `LensStones` are a field of stepping stones
  only the lens shows, the walker's holding, the rest crumbling a moment after you step on one (you fall, back to the
  mark; it rises again). A `Plate` may carry a `print` and be `hidden` (only the lens shows it): on the far landing the
  sphere's `stops` are two plain prints and the walker's. Since v1.27 the Hall of Spheres opens with the idea before the
  lens: one sphere whose `stops` are carved prints of two, three and four toes, and three prints by the wall to stand
  on; the door wants the sphere on the walker's and you on the walker's (`solve` tries a ball's stops with you standing
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

The climbs the houses keep (`rt.kit.climbWhy` lists them): the Givers' House's gallery (the Dry Channel's way up to the
Sword Chamber, its glyph handholds), the Warden's Well's Climb (the block's face to the balcony), the Clock-House's
Winding Well block (to the ledge and the door of two keyholes), the Hush-House's and the Lamp-House's root-walls (from the
riding disc and the moss-stones to the landing at 9) and the Lamp-House's loft of roots (the third pool), the
Greenhouse's Glass Stair root-wall (to the sun-disc) and its two glasses (the Vine Gulf's and the Seed Vault's: climbed
once a vine is up them, the `Glass` piece slipping you off till then), and the Whale-House's tank glass (its rungs). The
other seven houses have none. `tests/temple-climb.test.js` pushes a real `Player` into the wall beside every lock's
doorway, both faces, and into whatever a key stands up on, in every temple: he never takes hold.

## Hubs, keys and arenas (v1.48, issue #23)

A temple to explore, not a corridor of rooms in order: a hub with wings, keys found in one room for locks in another,
rooms that shut behind you until their foes are beaten, optional rooms with a reward. The kit's pieces for it, any
temple can use:

- **Keys** (`logic.js`, element `key { kind: 'small' | 'big', room, when? }`; piece `Key`): a key of the house's brass
  turning over a plinth, in a cage of brass bars that sinks once its `when` holds (the step that earns it). Walk up to it
  and it is yours (`logic.find`, flag `found.<id>`). A small key turns any small lock (Zelda's: `keys('small')` is the
  keys found less those put in a lock); the great key the guardian's door.
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

The **Warden's Well** (`incal.js`, 4.22, structure 2): its Climb is the hub, its ways west and east south of the block
(`WING.a`). West the **Ash Store** (an arena in the tower's old ash), east the **Vane Room** (a chasm whose stones stand
only while the small vane on its far wall turns, `VANES.wing` s: splash it from this side and cross before it slows; the
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
past the Vine Gulf, west off its far side, the **Seed Vault** (`VAULT`): one louvre, one ball, two seeds at the foot of a
wall of glass; the vine climbs it only from both seeds, so the ball brings the sun to one, then the other. The great key on
the ledge at the top opens the door past the bud (`dB`) into the Glasshouse. Its Cold Frame's eyes and the Glass Stair's
eye now come before their balls in `LOGIC`, so the marker points at an eye that can wake before the ball's other plate
(it went back and forth between the plates; the playthrough now plays the Greenhouse and the Engine-House to their
guardians, and reports a temple it walks eighty steps in without getting anywhere).

The **Undertower** (`bazaar.js`, 3.89 after round 1, its curve 5 → 3) likewise: the Listening Passage's horn is deaf until
a ball is on its footstone (an `EchoEar` whose element has a `when` says `deaf` while it does not hold), and past the
Gallery of Voices, west off its far side, the **Choir** (`CHOIR`): two horns, the great key caged between them. The far
one hears only a stone's own low song through a pair of dishes (`hears: 'note'`, a ball on the near dish's footstone), the
near one the high note played back, the high stone at the far end; the shell keeps the last note, so the low stone sung
by the near dish is caught too. The great key opens the far door (`d4`, its two lamps as before).

The **Lamp-House** (`perdide2.js`, 3.67, structure 3, its curve 1): the **Kennel**, east off the Hall of Dark Pools, is an
arena in the dark (`KENNEL`; the small key, for the Lamp Passage's door, a room past the chest); past the Dark Gallery, east
off its far side, the **Wick Room** (`WICK`): two niches, two pool-orbs, one lantern, the great key behind a grille (`cW`)
that lifts for good only while both niches burn. A niche's lamp burns only while its orb glows: its element has `hold`
(the orb's time) and a `when` (its orb home), and the orb's piece puts it out when its glow ends (`Ball` `lamp`), so the
second orb has to be lit and rolled home inside the first one's glow. The great key opens the gallery's far door (`d4`).
The audit (`scripts/temple-design/lib.mjs`) sorts a lock whose keys want the gadget after the chest wherever its room is,
and leaves out a door that opens with another (`{ open }`) as a step of its own.

The **Founders' Belfry** (`arzach2.js`, 4.0, structure 4) had a hub of two stone stores already, a ball in each; its west
store is an arena now (its archway `dSW` shuts behind you; won, the small key), so the Hall of Stones' door takes the key
and the east ball's weight (`drumOn`, where it was the plate pressed: standing on it yourself no longer latches it).

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
  (`mode: 0, grid, plates`: the Givers' House, the Engine-House, the Undertower), big smooth panels (the Well, the
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
