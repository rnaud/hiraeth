# The Lab and the clipping audit

Developer levels and checks: the Lab, the clipping audit.

## The Lab (v0.39)

In the Lab, `[` and `]` (L3 and R3 on a pad) call `level.jump(∓1)`: a fade, then the
previous or next world's room, the hub between the last and the first. The Start menu's
**Debug** entry opens the worlds list over the world you're in. The title's opens it alone
(`?worlds=1`, `src/world-picker.js`): `boot.js` draws the cards without loading `main.js`,
so no world is built behind it (about 1 s on the dev server; on the Lab it took about 15 s).
`?level=<id>&worlds=1` still opens a world with the list up. The list's top row links the game's other
pages (`PAGES` in `src/world-picker.js`: the character studio, Motion, the trailer, What's new, Items). The
items page (`items.html`, `src/items-page/`) shows every item of `src/items.js` with its picture
(`public/item-pictures/<id>.webp`: `node scripts/item-pictures.mjs [ids]` has the game draw them as its menu
does), what it does and where its boxes are (`src/boxes/placements.js` notes, the fallbacks by the ship). Its
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
