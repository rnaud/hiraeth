# The makers' temples

Each world's dungeon: its gadget, its keeper, how the temples are built.

Each world has one great building of the makers, a Zelda-style dungeon with a
gadget half-way through and a keeper at its heart (LORE.md, "Temples", has the
design for every world). All eleven are built: the desert's **Givers'
House**, the City-Shaft's **Warden's Well**, Vael II's **Founders' Belfry**, the
Buried Machine's **Engine-House**, the Garden of Spheres' **Footprint**, Lorn
II's **Lamp-House**, Lorn's **Hush-House**, Vael's **Aerie**, the Sealed Hangar's
**First Garage**, Viridel's **Builders' Greenhouse** and the Signal Market's
**Undertower**. Everything lives in `src/temples/`:

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
  has grown up it: `when`), `EchoStone` (a singing stone: splash it and it sings
  its note, game event `'note'`) and `EchoEar` (a brass horn that lights its
  element when its own note is played back close by: game event `'echo'`; the
  `NOTES` low / mid / high each have a degree and a colour). `Bank` takes any
  number of eyes and a window, with its own words (`full`, `fade`): six in 4.6 s
  is the First Garage's (two tanks in one breath, the quick coil's refill).
  Moving parts are `userData.dynamic` (no tiling or levels of detail).
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
  or `'break'`. **`guardians.js`**: the Keeper's and the warden's bodies.
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
  door and the makers' cogs in the cliff below: the escapement's disc, the
  winding well's counterweight (only the ball's weight: `drumOn`), the **quick
  coil**, banks of six eyes, the **Clockwork Foreman** (`foremanModel`: hit its
  six numerals inside one breath when its face opens); after, the clock keeps
  the true time and the cogs turn. The **Builders' Greenhouse** (`edena.js`) in
  the meadow hollow north of the white ruins, far from the tea terraces: the
  stone seed and the eye, the root-wall and the rising disc, **bloom mode**,
  budded doors, the vine bridge, the glass a vine has to grow up, the
  **Gardener** (`gardenerModel`: bloom the four dead beds, then its bare back
  when it kneels; a hand on its brow); after, flowers and vines on every slab of
  the white ruins (`level.edena.ruins`, two instanced pools whose counts grow)
  and on the dome. The **Undertower** (`bazaar.js`) through an old doorway in
  the silent tower's back (reworked from the temple design audit: "Notes that
  travel" below): the singing ball and the dish pair over the cable pit, the
  riding well and its horn for the low stone, the **echo shell**, the low note
  carried up to the door, the held pillar bridge, the far door that listens
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
- **Items**: `fire` moved into the Givers' House, `jetpack` into the Warden's
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
- **The pool-orb** (the Lamp-House, from the same audit): a `Ball` with `lamp: { id }` is a glass orb of
  pool water. Stood by at rest with the lantern for `hold` s it glows for `lasts` s; at rest on its plate
  while it glows it lights element `id` (a lantern `switch`, shown by a `LightEar` with `reach: 0`, which
  only glows once something else has lit it). Rolled in dark it lights nothing and is tipped back out (no
  dead state), and it only locks in its socket once its lamp is lit.
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
- Pieces can be `hidden` (Door, Switch, Bridge): only the glyph lens shows them.
  (`hidden: 'lantern'`: only the lantern charm's light.) `LightEar`: a lamp that
  wakes when you stand by it with the lantern; a temple with `dark: true` sets
  `player.inDark` inside, and the lantern charm glows there day or night.
  A shut door can't be climbed (you slip off it). `Bank`: four eyes that wake only
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
