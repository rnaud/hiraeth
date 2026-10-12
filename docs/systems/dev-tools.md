# The Debug menu, the Lab and the clipping audit

Developer levels and checks: the Debug menu, the Lab, the worlds list's debug save, the clipping audit.

## The Debug menu (v1.11, `src/world-picker.js`, `src/world-picker.css`)

The title's **Debug** (and the Start menu's, and L in play) opens the Debug menu: alone at `?worlds=1` (the
"◀ Debug" buttons' `DEBUG_MENU_HREF`, nothing built behind it), or over the world (`main.js`). It is one
page in sections, each a heading with one line, in this order (`menuSections`):

| Section | What is in it |
| --- | --- |
| **Play** | Continue (the world this save was left in), then the route's worlds (`ORDER`) in story order, each in the debug save |
| **Story places** | the finished worlds off the route: Home, the Lantern, the Atelier (in your save) |
| **Test rooms** | the `dev: true` levels: the Lab, the Arena, the Gadget Yard, the Arcade, the References, the Shadow Room (`?level=shadows`: rendering.md, "The Shadow Room and the shadow QC") |
| **Worlds in progress** | the `WIP` worlds (off the galactic map) |
| **Games** | the minigames (`gamesRow`), each with its best |
| **Pages** | `PAGES` (What's new, Audits, Items, Creatures & spirits, Character studio, Motion, Cinematics, Trailer, and References, `references.html`, tagged "reference material"), `MAYBE_PAGES` (pages listed once they answer, `probePages`; none now) and on the dev server `DEV_PAGES` (the reference lab, tagged "dev server"; a build never lists it) |
| **This build** | version, build number and commit (`__HIRAETH_BUILD__`, defined by `vite.config.js` `gitBuildInfo`; the Android / Deck app's build line in the app), dev server or build, and the debug save's note |

Worlds are cards (picture, number, name, source, the save it opens in; `cardHtml`); everything else is a
row (name, one line, a tag; `rowHtml`), the same paper, ink, offset shadow and red focus frame. The cards are
numbered in the order shown (`pickOrder`): 1–9 open the route's first nine. The sticky header holds the title,
the **filter** and close, and a chip a section (a click scrolls there; the one in view is lit).

- **Keys**: typing a letter (or `/`) filters (every word must be in an item's name, line or id); Enter opens
  the first match, Esc clears the filter and then closes; PgUp / PgDn the section before / after; the arrows
  move in the grid. In play, L still opens and closes it (L closes only while no filter is typed), and the
  letters typed on it are the filter's, not the game's.
- **A controller**: the D-pad moves in 2D (`data-grid-nav`), A opens, B goes back (out of the filter first),
  LB / RB jump between sections (their glyphs either side of the chips), Y opens the filter. The text box is
  out of the D-pad's way (a handheld would open its keyboard): only Y reaches it.
- **The way back**: the item opened is remembered for the tab (`sessionStorage` `hiraeth.debugMenu.last`); the
  menu opened again (◀ Debug on a page, B from a world) focuses it and scrolls to it, so it comes back to the
  section it was left from. Every link and its URL are as before (`pickHref`, `gameHref`, the pages' files).
- **Sizes**: the sections' grids fill the width; under 620 px the filter takes a line of its own and the
  headings' lines go under them; under 480 px tall (a handheld on its side) it tightens. `tests/world-picker.test.js`.

## The world debug menu (v1.33, `src/world-debug.js`)

**L3 + R3** (both sticks, in either order; in play or riding) or **F2** opens a menu over the world you are in;
the same again, B / Esc or its close button shut it. It is available wherever the Debug menu is (every build,
for now). It is drawn by the Debug menu's own code and CSS (`fillPicker` given `sections`; `#wdebug` shares
`src/world-picker.css` with `#picker`): the sticky header with the filter (type, or Y on a pad) and a chip a
section (LB / RB, PgUp / PgDn), rows a controller moves through in 2D (`data-grid-nav`), the confirm glyph on
the focused row. It is drawn again each time it opens (people move, quests go on).

| Section | What is in it, and where it comes from |
| --- | --- |
| **Landing** | the ship (`ship.arrivalSpot()`: the foot of its ramp), the level's `spawn` |
| **Quests** | every stage of this world's quests where its marker stands (`quests.where(stage)`: `goto`, `at`, `talk`, the locators) |
| **People** | the world's people (`npcs`, not the crowd's pooled walkers) |
| **Temple** | outside its door (`temple.doorOut`), inside the door (`arrival`), each room's mark (`marks`), the gadget's chest, the guardian's arena (at its edge) |
| **Shops** | outside (where the shop's way out lands) and at the counter (`level.shops`) |
| **Sights** | the level design's `sights`, `beacons` (at their foot) and the start of each leading line (`lines`) |
| **Runs & trials** | the trial (`TRIALS`), the makers' runs (`kitTrialsFor`), the makers' court (`level.finds.court`) |
| **Places** | each door into a room, cave or hall (`level.portals`, not the temples' or the shops'), outside and inside; the story's goal (`CONTENT[id].story`); the desert's named places (`src/desert-sites.js`) |
| **Finds** | the makers' boxes (`boxes.list`), the relics not yet found |
| **Cinematics** | this world's entries of the Cinematics page (`cinematics-page/catalog.js`, `cinematicsFor`): its moments and its boxes' films are played in place (`stageCinematic`, the review page's own staging) and you are put back where you stood when it ends; the ship's recordings and takeoff while the ship is here; an arrival reloads the world by ship; the prologue and homecomings open the Cinematics page |
| **Quest stage** | each of this world's quests, main first, with its stages and "done": `applyQuestJump` sets the flags the stages before it wait for (as the debug save does, `questJump`), clears those of it and after, then `quests.set` (its hooks run); a warning names the save it changes (the debug save, or save N), and a row reloads the world |
| **Notes** | Screenshot to a Notes draft (issue #8, `src/issue-draft.js`): the frame drawn right after the menu closes (`grabFrame` in the loop, 640 px wide, a JPEG under 88 KB) and where the game is (world, position, heading, build, commit, preset, device, tracked quest and stage, hour, save), kept on the device and sent to the notebook as a draft for the Notes page; the device's pairing code while it waits, and a row to send what still waits (`docs/systems/notes.md` "Screenshot drafts") |
| **Toggles** | the hitbox overlay (what L3 + R3 did until v1.33; F4 still), the input display (F6), god mode (`player.opts.health = false`, this session), endless potions (`res.potions.infinite`, in the save), full hearts, the sky's clock running or still, six times of day, and back to the Debug menu |

A teleport (`landingSpot`, then `passage.go`: the paper sweeps across as at a door) sets you on solid ground
near the point, from just over it (under a low ceiling, not on the roof over it), with room to stand, out of
the doorways' discs (with `portalCool` held, so no door takes you on), over `killY`; a point in the air (a
beacon's foot, the fallen-up tiles over the cloud) takes the floor under it or the nearest within 60 m. A room's
mark and a door's far side are landed on as they are, which needs nothing from the passage: the rooms are real
geometry off the map, and the temple notices you inside by itself. Nowhere to stand: a toast, and you stay.
`tests/world-debug.test.js` (the gathering, the landing, the quest jump, the films, the rows, the controller) and
`tests/world-debug-worlds.test.js` (every route world built with its story: every kind there and every point landed
on; desert 122 points, the others 49–71).

## The Lab (v0.39)

In the Lab, `[` and `]` (L3 and R3 on a pad) call `level.jump(∓1)`: a fade, then the
previous or next world's room, the hub between the last and the first. The Start menu's
**Debug** entry opens the worlds list over the world you're in. The title's opens it alone
(`?worlds=1`, `src/world-picker.js`): `boot.js` draws the cards without loading `main.js`,
so no world is built behind it (about 1 s on the dev server; on the Lab it took about 15 s).
`?level=<id>&worlds=1` still opens a world with the list up. Its Pages section links the game's other
pages (`PAGES` in `src/world-picker.js`, see "The Debug menu" above). The
items page (`items.html`, `src/items-page/`) shows every item of `src/items.js` in 3D: its model
(`buildItemModel`) drawn by the game's own pipeline (`viewer.js`: the G-buffer, a fine shadow map with the near
and far ones made and switched off, the ink pass, FXAA) on the slots' paper. One renderer for the page: each
card's canvas gets a picture as it scrolls into view and again while it is dragged; a click opens the
full-screen view (live, drag to turn, wheel or pinch to zoom, ← → the other items, R turns it on its own, Esc).
Without WebGL the cards keep the game's own pictures (`public/item-pictures/<id>.webp`: `node
scripts/item-pictures.mjs [ids]`). With them: what it does and where its boxes are (`src/boxes/placements.js`
notes, the fallbacks by the ship). Its
pictures are `public/thumbs/<id>.jpg`, one per world: `node scripts/world-thumbs.mjs [ids]` takes them
again (each world from its start at its own hour, headless Chrome as `scripts/changelog-shots.mjs`).


`?level=lab` (`src/levels/lab.js`) is a developer's world (`dev: true` in
`src/levels/index.js`): always in the worlds list (L) for testing, never on the route. A
row of pedestals shows every surface `makeMaterial` can draw (`LAB_MATERIALS`:
flat, smooth, rock strata, cracked, facade, tiles, leaves, brush, grid, glyphs,
glow, a lamp, the metals: steel, brushed, chrome, brass, copper, iron, painted, and the box dissolve
breathing in and out) on a
sphere, a cube and a turning knot, with a water pool, a meadow of grass blades and a cloud at the ends.
Behind the spawn, the faces gallery: twelve villagers 4× life size on plinths
(`LAB_FACES`, `content.js`; `spawnNPCs` passes `scale`, `face`, `expression`, `facing`),
every face variant with an expression, facing the hub, and a walkway at the height of
their faces up a ramp, for working on faces close up (see *Faces drawn the Moebius way*). Add a surface to `LAB_MATERIALS` to see it beside the others.

**Biome rooms.** Behind the faces an arc of little doorways (`LAB_DOORS`), one per
world with its name on a board over the lintel and a veil in that world's sky
colour, leads to a compact sample of each world (`src/levels/lab-rooms.js`,
`ROOMS`): ~190 m across, with that world's ground (its terrain material on a 420 m
heightfield, or its own meshes: the Hangar's floating plateau, the Sky Stones'
tables over a sea of cloud), rock formations and landmarks, a few buildings and
props, its flora (`level.flora`: one part per room, the world's species in clumps
over the room's disc, `flora.js` `buildFlora`), up to four of each of its creatures
(`level.wildlife`, passed to `Wildlife` as `defs`, anchored on the room) and two
or three of its people dressed for their world (`LAB_PEOPLE`, `world` on the NPC
spot). Where a world's builders stand alone they are called with the room's group
and ground (`desertMesa`/`desertArch`/`desertMushroom`/`desertRibcage` in
`world.js`, `hangarHouse`/`hangarTower`/`hangarMachine` in `garage.js`,
`edenaTree`/`edenaPyramid`/`edenaRuins` in `edena.js`, the Sky Stones' `table`,
`needle`, `boulder` and `bridge`, the Deep Wood's `shroomParts`/`lathe`, Lorn's
`jawShell`, the City-Shaft's `sectorGeometry`, the Buried Machine's
`cylBetween`/`elbow`, the Garden's `paintFaces`/`CRESCENT`; they were hoisted out of
their levels unchanged); the rest are sketches in the world's own colours.
A room is built with a `RoomKit` (`src/levels/lab-kit.js`) that merges its static
geometry per material, so a room is a few dozen draw calls.

The rooms lie on a ring 2.6 km round the hub (`ROOM_RING`, ~1.5 km apart). Only the
room you are in is drawn (the others' groups and the hub are hidden; their plants
and creatures are past their drawing and sleeping distances, their people past
260 m). Walking into a door is the Hangar's portal pass: a quick fade, out the
other side at your own pace, 11 m in front of the door so the camera clears it.
Each room's atmosphere switches as you enter: `level.atmo` hands main.js its
colour script (`atmo.script`) and haze, and `level.zoneAt` its ink preset, look,
planets and hour (main.js applies a zone's `look`, `planets` and `hour` when the
zone changes). Straying over a room's banks or off its edge puts you back at its
door. `tests/lab.test.js` walks through every door and back.

## The debug save (v0.89)

A world on the route (`ORDER`) picked in the worlds list opens in the **debug save**: as if every world
before it had been played through, and the world itself not yet. The card's link is
`?level=<id>&debugsave=1` (`pickHref` in `src/world-picker.js`; the number keys too); `src/boot.js`, before
the game reads a save, calls `seedDebugSave(id)` (`src/debug-save.js`) and drops the parameter, so a reload
goes on with the save. A line under the pages says so, and each card says which save it opens
("debug save · 6 worlds done before it", "in your save").

**The player's saves are never written.** The debug save has a slot of its own, `DEBUG_SLOT` ('debug', keys
`hiraeth.sdebug.*`, `src/save-slots.js`): seeding clears it, writes the game state and the sketchbook into it
and makes it the active slot. The ship's flights stay in it; the title never lists it (Continue, New game and
Saves are the three slots), so choosing a save there goes back to yours. The Start menu reads "Debug save"
while you are in it. Picking another world starts the debug save again from scratch.

`progressBefore(id)` (pure) builds it from the game's data, world by world in route order:

- the world's quests (`QUESTS`, `src/story/<world>-data.js`) done and the flags their stages wait for set; a quest
  a conversation fails (`{ fail }`: Viridel's terraces, which always give way) failed;
- what its conversations do, anywhere in its data (`dialogueEffects`): the flags they set (the first value
  written: Hollin's promise is 'yes'), the gear they give (the cab pass), the keepsakes;
- its people met (`peopleOf`, and the temple's local); its temple entered and resolved, its quest done;
- its boxes (`PLACEMENTS`) open, their items owned, the box quests done;
- the tank's colour bands its magical water adds (`TANK_BANDS`: the desert's pool, Lorn's crystal, the Wick's
  amber, Oyo's lantern), the flags and the keepsake its main quest's end sets in code (`WORLD_ENDS`: the ship
  powered, the bird's promise; the keepsakes are exported from the data files), `world.<id>.done`, its story page;
- the ship: the signature read on arrival, the recordings played at the console in turn (`calls.js`, with what
  they set), the errands delivered or still carried (`ERRANDS`);
- since v1.58 (issue #203: "unlocked everything in all the previous levels"): its trial run and its reward held
  (`TRIALS`, `src/trials/data.js`; a retired reward left out), and its fragments of the singing light found
  (`FRAGMENTS`): Orrin Thrum met (`frag.met`, `met.thrum`: he is aboard) and each of his upgrades the count
  reaches fitted where its gear is held (`FRAGMENT_ITEMS`, `needs`): before the Glass Dunes, 48 fragments, the
  heart, the finder, the edge and the light chamber.

The chosen world, and every one after it, is untouched: it opens at its start (no saved position), its
quests, boxes and temple waiting. Left out: relics and the sketchbook's pictures (drawn as you find them) and
quest things carried in a pack.

**From the title's Saves screen** (v1.58, issue #203: "a debug saves option in the save menu that restarts the
game at a specific level"): under the three saves, on dashed red paper and tagged DEBUG, "Debug: start at a
world" (`debugSavesHtml` in `src/title.js`; shown with the same gate as the Debug entries, `devMode`): **Into**
(A / × or a click turns it: the debug save, the player's untouched; Save 1, 2, 3), then every world of the route
with its picture and how many worlds before it are done. Choosing one goes to `debugSaveHref(id, slot)`
(`src/save-slots.js`: `?level=<id>&debugsave=1`, and `&debugslot=<n>` for a player's slot), which `src/boot.js`
seeds before the game reads a save (`seedDebugSave(id, { slot })`) and drops. A player's slot that holds a save
is asked about first ("Replace Save 2?", the save it holds and the world: B keeps it); an empty one is written at
once. Nothing else is written: the game loading behind the title keeps its writes in memory until the page goes
(`holdWrites`), so its save on the way out never lands in the slot it was loading. The pad moves down the saves,
Into and the worlds; the keyboard's arrows and Enter, the mouse and touch too. The desert's debug save is a new journey past the prologue. Off the route (the
Lab and the other dev worlds, the side worlds, home) a card opens the world in the save being played, as
before; so does `?level=<id>` typed by hand. `tests/debug-save.test.js` reads the story's code for the grants
that are not data (an `onDone`'s `game.set`, `addKeepsake`, a tank band, an item granted or given in code) and
fails when one is not covered.

## The clipping audit

(Its sibling, the **contact audit**, `await contactAudit()`, compares the surfaces you stand on and climb
with what is drawn there: [movement.md](movement.md), "Contact".)

`src/clip-audit.js` lists what sinks into the ground, floats above it or stands in a wall.
In the running game, `await clipAudit()` prints a report for the world you are in
(`clipAudit({ print: false })` returns it: `{ checked, counts, offenders }`);
`tests/clip-audit.test.js` runs it on made-up scenes and on the Signal Market. It checks:
people (story NPCs and the crowd: feet on the ground, the body out of walls, not inside a
solid), boxes (all four corners of the footprint on the ground), relics and the things you
look at (not inside a solid), and every small prop the level and its story placed (a unit is
the largest group under 25 m across; each instance of an instanced mesh is one). A prop must
be held by something: a thin slab just outside one of its faces has to touch the collision
BVH, the terrain, any drawn mesh (moss pads, a hanging city's roof: `drawnBVH`) or another
prop; a walk-through prop (noCollide) must not stand inside a solid, judged by its middle
when it is a trunk or a post, otherwise only when wholly inside (by its own axis for a leaning
blade or a tumbled rock). Effects (see-through, animated: `userData.dynamic`), motes under
12 cm and things marked `userData.floats` (bobbing orbs, floating stones, the sea of cloud,
Incal's landing pads) are left out. "Inside a solid" uses `physics.buried(p)`: `embedded()`
and an odd number of surfaces crossed on the way out, and not over a solid whose floor is
under the terrain (a landmark half sunk in the dunes).

What it found is fixed at the source: `dropBuriedFlora(scene, physics)` (called once the
physics exists) drops instances of walk-through flora buried in a solid or wholly under the
terrain (Incal's terrace trees also round their crowns, `dropBuriedInstances(..., { ring })`);
crowd spots must not be inside a solid (`standable`), and a crowd route is sampled every
1.5 m with the side lanes checked for posts and pillars; a box placed on a ledge or a rounded
stone is moved (up to 1.2 m, `settle` in `src/boxes/index.js`) to where all four corners meet
the ground. Known and left: the Hangar's upside-down quarter (its props "float" by world down),
props resting on water, and stones buried inside Vael II's mesas (unseen). Across the twelve
worlds the audit went from 139 offenders to 85 (crowd 21 to 1; Incal 34 to 4, the Buried City
15 to 4, Viridel 19 to 8).

The traveller's own kit, checked in idle, walk, run and jump poses (by
sampling of the arm bones against the tank's profile): the arms never reach into the tank;
the right hand, with the bracer, hung into the hip in the idle sway and now hangs a little
out (`idleLayer`). NPC capes collide with the traveller's body capsules when they stand
within 2.2 m (`NPC.clothCapsules`), so a seated elder's cape no longer drapes through your legs.

## Design audits: level and temple

Two read-only measuring tools behind the `level-design-qc` and `temple-design-qc` skills (`.claude/skills/`):
`scripts/level-design/audit.mjs` builds each route world in node (as the play-through does) and measures its
places, critical path, empty stretches, walks back, landmarks and sight lines; `scripts/temple-design/audit.mjs`
builds each temple's rooms and measures its puzzle graph (locks, keys, mechanics, clue distance and sight, an
obviousness score per step). Both score a rubric and plan camera views; `scripts/design-qc/capture.mjs` shoots
them in one muted headless Chrome (PORT 5344, never 5173). Pure logic: `scripts/*/lib.mjs`, tested in
`tests/level-design.test.js` and `tests/temple-design.test.js`. Reports: `docs/audits/level-design-v*.md`,
`docs/audits/temple-design-v*.md`.

### How the level design measure grew

What `scripts/level-design/audit.mjs` learned to read, version by version (moved from the skill, which keeps
only the list of hints a level can give):

- **v1.9:** three hints a level or quest may give: a level's **`sights`** (`[{ name, at }]`: things to stop for
  that are neither people nor quests, a bowl to fill, a wreck: counted as optional places), its **`beacons`**
  (`[{ name, top, height }]`: tall see-through markers the collision doesn't make tall, a smoke column, a chimney
  past the map's edge: aimed at as landmarks), and a quest stage's **`ends`** (a locator: where a stage whose
  marker moves on is done, "ask Marrow, then find his bike in the hollow"). And a leg over 200 m between two stops
  on the ground is **draped** over the ground under it (up to 70 m down), so a ride across a basin is measured
  down in the basin, not in the air over it.
- **v1.15:** a level's **`lines`** (`[{ name, points, auto }]`: leading lines on the ground, a row of marked
  stones, a dry channel, cairns, the red stair): a leg is **guided** by one that starts within 60 m of it and ends
  by its goal (or where the goal comes into sight), and a leg a line runs along from beside its start (30 m) to
  beside its goal (30 m) is **walked along it** (`followLines`: the stop gets the line's points as `via`, so the
  path, the gaps and the walks back follow the line). A quest stage whose words send you along one names it
  (`via: 'the marked stones'`) and is walked along it from farther off; a line marked `auto: false` is followed
  only where a stage names it (a way home lit for the way home). The **loner** rule scales with the travel
  speed: 18 s from anything (150 m running, 366 m on the bike, `lonelyFor`).
- **v1.17:** a portal marked `oneWay` (a hatch that only lifts from below) is not assumed to be walked back, and
  a route step `{ act, at, label }` (`tests/playthrough-worlds.js` `ROUTE`) is a stop where `at` stands (a talk if
  it is a person: Vael's route starts by meeting Oïa beside the landing, who opens the main quest).
- **v1.20:** a stage may name the line its words send you **home** along (`home: 'the lantern stones'`: the walk
  back to the ship after the last stage that names one follows it, as a named `via` does), and where its person
  **stands** by the time you get there (`stands: 'hollinEnd'`, a locator: Hollin walks down to the root cave
  while you are at the saucer; without it the audit measures him where he stood at the start).
- **v1.46:** a goal looked at **steeply** (more than 40° up or down, `steepness`) is seen as it would be: far
  overhead, when the ray stops on what carries it, within max(15 m, a tenth of the leg) of it (the balcony under
  Vael's window, the City-Shaft palace's legs under its crown): `goal overhead`; far below, past the floor at your
  feet (12 m stepped through, the crow's nest's own deck): `goal below`. And every eye steps out of what it
  stands inside within 0.8 m of it: a line's points are its markers, so the walk along it passed through each
  post or cairn and saw nothing (the Glass Dunes' float-posts: 35 % of the path saw a landmark, 88 % since).
- **v1.49:** a merged world (`src/levels/names.js` `PARTS`: Vael carries the sky stones, Lorn the Deep Wood) is
  read with its parts: their quests' places, their trials, courts and temples' doors, and a route step
  `{ temple: 'done', id }` goes in at that part's temple (`templeFor`; before, Vael's Belfry was measured at the
  Aerie's door, 1.1 km off).
- **v1.50:** a line may be **ridden** (`ride`: m/s, the City-Shaft's cab home): its length is weighed at that
  speed against the walk; and a temple whose last way out, past its guardian, comes out somewhere else (the arena
  exit's `to`: the Whale-House's keepers' hatch) is gone on from there, the hop to it not walked.
- **v1.53 (#174):** a level may give its mount's fast **`lane`** (`(x, z)` → `{ k, river }`: the desert's sand
  rivers), and the path's stretches in one are timed at the bike's speed with the lane's gain (`laneRuns`,
  `metrics.lanes`); and every room behind a doorway on the map that is built off it (the city under the Glass
  Dunes' sand, 2.6 km up) is reported with where you land, its way out, the walk across and where that leaves
  you (`offMapRooms`, `metrics.rooms`). Its places stay off the map: the door stands for the room.
- **v1.55:** the eye steps out within 1.5 m, not 0.8 (the City-Shaft crown's marker stands on the axis of the
  palace's needle, 1.2 m round: from there it saw nothing at all; no other world's numbers moved).

## Temporary profiles (issue #220)

Every test and script that makes a temp dir or starts a browser with a profile goes through `scripts/temp-dirs.mjs`:
`tempDir(prefix)` instead of `mkdtempSync`, `ownProcess(spawn(CHROME, …))` for the browser, `tempPath(path)` for a
temp file of its own naming (Playwright's `launchPersistentContext` profiles: `scripts/bench/browser.mjs`). At exit,
however the run ends (an error, a timeout, `process.exit`, SIGINT / SIGTERM / SIGHUP; only SIGKILL escapes), the
browser and its helpers are killed and the directory removed: headless Chrome profiles are 300–800 MB each, and the
ones failed and stopped runs left filled 17 GB of TMPDIR in a day. `tests/temp-dirs.test.js` ends a run every way
(with a real headless Chrome where one is installed) and checks nothing is left, and fails on any `mkdtempSync`,
unowned `--user-data-dir` browser or pid-named temp file outside the helper (an output kept on purpose says
`temp-dirs: an output` on its line). Scratch scripts of your own: import the helper too.

