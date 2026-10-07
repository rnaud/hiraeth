# The worlds and their places

The levels, the terrain, regions and wind, interiors, each world's places, sand drifts, the ship's deck, Home.

## Levels

Opening the page with no `?level=` shows a **level picker**. Press **L** to
reopen it at any time, or **1–9** while it's open (later worlds are clicked).
It lists only the worlds you know of (see "The galactic map and the route"
in [story.md](story.md)); `?level=<id>` and the dev menu still open any world. Each level is a module in
`src/levels/`, registered in `src/levels/index.js`.

| # | Level | Tagline | Getting around |
|---|---|---|---|
| 1 | **The Desert** (`desert`) | after *Sable* (Shedworks) | walk, climb, glide, hoverbike |
| 2 | **Vael** (`arzach`) | a silent world of needles | the wings, the flying bird (after her call), climb |
| 3 | **Vael II: The Sky Stones** (`arzach2`) | stones that fell up | the flying bird, climb |
| 4 | **Lorn** (`perdide`) | a twilight swamp that hums | hover-skiff, wading, caves |
| 5 | **Lorn II: The Deep Wood** (`perdide2`) | the wood under the swamp | hover-skiff, wading, caves |
| 6 | **Viridel** (`edena`) | a garden that keeps what falls | climbing with stamina |
| 7 | **The City-Shaft** (`incal`) | a city stacked down a pit | jetpack, climb, flying taxis (with a pass) |
| 8 | **The Sealed Hangar** (`garage`) | a pocket universe that keeps turning | portals, shifting gravity, jetpack |
| 9 | **The Buried Machine** (`buried`) | a machine under the dunes | climb, jetpack |
| 10 | **The Garden of Spheres** (`spheres`) | spheres that answer | walk, climb |
| 11 | **The Signal Market** (`bazaar`) | a market where everything talks | walk, taxis (with a pass) |

Nothing in the game is named after a Moebius work (v0.39): the worlds, people and
places all have names of their own. The level ids (`arzach`, `edena`, `garage`,
`perdide`, `incal`, …) are only internal and stay as they were, so saves keep working.

The picker lists worlds in the order of `LEVELS`. Each second take sits after
its original, and progression follows `ORDER` in `src/levels/names.js` (wings before jets since October 2026: docs/systems/progression.md).
The reference pages for the four v0.30 worlds are in `references/`
(IMG_3783–3800).

- **The Desert:**
  - dunes, mesas, giant skeletons and monolith rings;
  - three regions: golden dunes, rose canyons and salt flats;
  - wind-blown sand and cloud shadows;
  - **E** whistles for the hoverbike, once you have found it (Marrow hid it under a tarp).
- **The City-Shaft:** (styled after a Moebius hill-town plate)
  - a dense Mediterranean town: cream villas with window grids, terracotta
    hipped roofs and domes, roof gardens, and cypress and olive trees,
    packed onto blue-grey steel viaduct terraces;
  - arched viaducts span the void, and a vast blue grid saucer hangs over
    the far side;
  - the sun comes in steeper inside the shaft so the terraces stay lit, and
    the spawn has a railing overlooking the town;
  - a 520 m-wide pit, 580 m deep, with eight levels of terraces;
  - a central spire with rings, bridges and a golden palace on top;
  - **the red stair** (`STAIR` in `src/levels/incal.js`): the way down on foot to the high terrace,
    where Nima (the drone's first find) sweeps. A cream gate with a terracotta lintel in a gap of the rim's
    parapet near the makers' pillar; a top landing flush with the rim; five terracotta flights with landings
    down the shaft's wall on steel brackets, a red pipe rail on the void side (as the plates' red stairs);
    a steel landing along the terrace's end, where no house is kept (`lane`). `places.stair.path` is its
    centre line; `tests/incal-stair.test.js` walks it down and up with a real `Player`, and glides it;
  - flying taxis, landing pads, cables, three blimps drifting round the shaft and turquoise water at the
    bottom (a flat printed tone: the water shader's reflection pass cost the handheld ~2 ms a frame there);
  - **toward its reference sheets** (docs/systems/references.md): half the walls pink among the cream
    (`PASTELS`, `RUST`), drainpipes and gutters on some houses, washing hung over balcony rails, ribs,
    machinery and a pipe under each terrace's slab. That small work draws from its own random numbers
    (`work`), so the town's layout, the terraces and the story's places are as they were, and it goes into
    the iron and the stalls' cloth buckets: no draws of its own (the blimps are three, left out of the far
    shadow cascade). Handheld, M4 Pro, interleaved: frame time within 0.2 ms at the rim, the crowd and
    across the shaft, ~+3 % triangles;
  - **jetpack:** hold Space in the air for about 10 s of thrust; you lean forward into the flight when steering;
  - **E** hails a taxi, then gets in (once Lio has written you a pass: docs/systems/progression.md). Driving: W/S throttle, A/D steer,
    Space up, Shift down.
  - taxis are solid: you bump into their sides, and you can land on a roof
    and ride along; a taxi left idle for 30 s flies back into traffic.
- **Vael:**
  - a bone-white world of needle spires, stone arches, floating ruins and a
    lone tower;
  - **E** whistles for the bird (once you've played her call on the tower's flute). Flying: A/D bank, W dive to gain speed, S
    pull up, Space flap.
- **The Sealed Hangar:** three zones joined by glowing portals. Each has its
  own gravity, and the ink style switches when you cross between them:
  - **Brask's plateau:** normal gravity, Moebius style;
  - **the upside-down quarter:** a city hanging under a slab, where gravity
    pulls you up; Animated ink style;
  - **the ring:** a cylinder habitat lit through a slit in its roof, where
    gravity points outward so you walk all the way round; Sable style.
- **Viridel:**
  - flat colours and thin lines, light stipple only;
  - giant umbrella trees (climb the trunk and stand on the canopy), step
    pyramids and white android ruins with glyphs.
- **Lorn:**
  - a twilight swamp with inked water;
  - crystal forests and egg clutches that glow;
  - carnivorous plants that snap when you get close;
  - a crystal cave lit from within;
  - wade into the deep water and swim (or **E** whistles for the
    hover-skiff).

**Climbing works everywhere:**
- push into a steep wall to grab it;
- W/S climb, A/D shuffle sideways, Shift climbs faster, Space jumps off;
- reaching the top pulls you up over the edge;
- stamina runs out after about 20 s on the wall (the same stamina sprinting spends: see "Feel" in [movement.md](movement.md)).

**Gravity:**
- the player moves in a local frame (up, forward, right);
- the "forward" direction is carried along smoothly as "up" changes, so the
  controls and camera don't spin;
- the camera rolls with gravity.

## Regions, drawn details and wind

- **Regions** (`src/biome.js`): golden dunes, rose canyons and salt flats.
  A smooth field drives several things:
  - ground colours, in the shader;
  - terrain shape: flat salt pans, sharper canyon ridges;
  - where props cluster;
  - the fog density and horizon tint around the player.
- **Drawn details** are written into `RT2.b` as roughly 1 px ink lines. Each
  fades out before it gets dense enough to shimmer:
  - wind ripples on sand;
  - dried-mud cracks on the salt flats (Voronoi borders);
  - fissures on mesa faces;
  - grid lines, and the makers' carved inscriptions on their stones and buildings (`src/glyphs.js`).
- **Cloud shadows**: each ground point is projected along the light onto a
  drifting cloud layer about 300 m up. Its cover uses the same threshold as
  the sky's clouds, so shadows move with the wind and get the same two-tone
  shading and hatching as cast shadows.
- **Wind-blown sand** (`src/wind.js`): inked wisps that skim the ground in
  gusts, plus dust behind the bike. They are drawn after the composite pass,
  and each one tests itself against the G-buffer depth so it hides behind
  dunes and rocks.
- **Hoverbike** (`src/bike.js`): it rides on a hover spring, drifts a little,
  banks into turns and pitches with the ground. The camera swings behind it
  unless you're moving the mouse. On a stick, `bikeSteer()` ignores sideways
  drift while you drive forward (a 0.32 deadzone, 0.12 otherwise) and curves
  small pushes gently, so it doesn't swerve.

## Interiors, crowds and the glider

- **Interiors** (`src/interiors.js`): rooms are real geometry, with walls
  that have door and window openings, so the sun's shadow map throws light
  patches inside. Each has furniture and a glowing lamp.
  - **City:** three villas behind the spawn you walk straight into.
  - **Desert:** a carved doorway in front of the masked head leads to a
    glyph chamber under an oculus.
  - **Viridel:** a hatch in the crashed ship's hull, under an arch of flowers,
    opens onto its cabin (`hullHatch` places it round the hull where its
    sill clears the meadow; `portalPair` gives the way in without a doorway).
  - Rooms that can't fit inside their building are built high above the
    map and reached through doorway portals.
- **City street life:**
  - a promenade along every terrace edge, with villagers walking it;
  - market stalls with awnings and goods;
  - laundry lines strung across the walkways;
  - passengers riding in the taxis.
  Only the nearest speaker's balloon shows, and far villagers update at a
  quarter rate or are hidden.
- **Paraglider:** hold Space while falling, or Shift+Space in jetpack
  worlds, to open a striped wing.
  - You fly forward with momentum: A/D bank and turn, W dives (up to
    30 m/s), and S flares.
  - The glide ratio is about 6:1, and the camera swings behind you.

## World passes after the books

- **Vael:** warm peach sand, an aqua sky, rose-mauve shadows, mushroom-capped
  hoodoos and boulders balanced on needles.
- **Viridel:** a ligne-claire look via `defaults.look` (thin even lines, flat
  colour, little hatching, no dots). Also great spheres half-sunk in the
  meadow and rows of ornaments on white pedestals.
- **Lorn:** giant fungus trees (violet stalks, softly glowing caps that
  light the swamp) and reeds along the waterlines.
- **The Hangar:** pipes with valve wheels and pumps, aerials, cabins, and
  cables slung from the keep, all over a paved plateau.

A world can tweak its default preset with `defaults.look` (post uniforms).

## The Sleeping Observatory (v0.16)

Meet the blue-cloaked traveler beside the desert camp (west of the starting
point). They give you a sketch of the observatory, about 830 m east of camp.
Ride there, then climb the six receding terraces. Each terrace is a place to
rest; three carry fragments of the keeper's story. In the open chamber,
stand beside each lens and press **E** (or tap the touch E button) to turn it.
Aim all three beams at the central receiver. Each aligned beam lights a ring
and illuminates the room. The roof unfolds over five seconds, a constellation
appears, and the moment goes into the sketchbook. Glide back to the traveler to
finish the expedition.

The existing masked-head story remains available. The new expedition keeps
its sketch, discovered fragments, lens positions and completion in the same
journal save; old saves pick up the expedition without resetting progress.
Implementation: `src/observatory.js`. Run `node --test tests/observatory.test.js`
for puzzle, save-state and collision checks.

## World

The terrain is a 4 km × 4 km heightfield with domain-warped ridged dunes and
a ring of mountains to close the horizon (`src/world.js`). Props are placed
procedurally:
- terraced, striped mesas
- mushroom rocks
- arches
- giant ribcage skeletons with tusks
- monolith rings with floating orbs
- floating islands
- a dome-and-spire city
- about 9k instanced boulders and desert plants

Collision uses simple circles against the props, plus an exact height
lookup on the terrain mesh.

## The Signal Market (v0.20)

Open `?level=bazaar` or choose world 7. Inspired by the supplied city reference
sheets: a long market avenue framed by coral and teal towers, relief billboards,
service pipes, cables, awnings, lavender inhabitants and a walking crowd.
Four solid skybridges overlook the street. Twelve taxis circulate overhead,
with one parked beside the entrance for immediate boarding.

Follow the avenue to the stacked broadcast tower. Its cream balcony is 44 m
above the street; use the jetpack, climb the blue resting ledges, or hail a taxi.
Reaching the console completes **The Last Broadcast**. Five relics are spread
between the market, a stall roof, two bridges and the balcony. The scout, saves,
sketchbook, controller and touch controls use the existing game systems.

The stalls carry goods (October 2026, toward the reference sheets): five brass bowls heaped with fruit
and jars on each counter, strings of goods hanging under the awning's edge, three round pictures on the
counter's front; their own random numbers, the existing buckets (no draws of their own), low-poly.

Geometry is merged by street block and material for culling. Collision tests
cover the avenue, bridge decks, climbing ledges, relic platforms and quest
altitude. Browser checks cover rendering and story completion; phone-sized
layout checks do not establish performance on physical iPhone hardware.

## Four new worlds (v0.30)
Each new world is self-contained in `src/levels/<id>.js`. The module exports its
journal content (`<ID>_CONTENT`, imported by `content.js`) and has its own test in
`tests/<id>.test.js`. Visible rock and props generally render without collision;
hidden coarse copies collide instead, except where you stand and climb on them: Vael II's rock, the
Deep Wood's trunks, caps and arches and the Garden of Spheres' spheres and umbrella trees collide as drawn
(~390 k, ~130 k and ~157 k triangles; the coarse copies sat up to metres inside the drawn surface:
[movement.md](movement.md), "Contact"). The other worlds' static collision is under 60k triangles.
- **Vael II** (`arzach2`): plateaus and needle forests above a cloud sea, linked
  by aqueducts and natural bridges. The rocks are built from noisy horizontal rings:
  fluted needles that fuse like drips, egg-stone stacks, mushroom tables with
  ribbed and hatched undersides, and overhanging rose cliffs with monasteries.
  Below the cloud deck counts as unsafe and returns you to your last footing.
  The peach plain leads to the lone tower.
  Since October 2026 the tables `lean` (`table({ lean: [rx, rz] })` tips the piece about its neck, so the
  cap stays where asked and the stalk slants under it), hang `drips` (stalactites, `drips()` in
  `sky-stones-kit.js`: each rooted in the underside as drawn at its angle, outline and ribs included, its
  root closed well up in the rock, its normals bent toward the underside's so it prints in its shade;
  drawn only, in a mesh of their own that the contact audit passes by), and boulders take a `crack`
  (two clefts round the egg and a seam). `tests/sky-stones-kit.test.js` checks no drip hangs under its cap
  by a gap.
- **The Buried Machine** (`buried`): domes and pipes on pale dunes, a trench
  that exposes blue-grey machine strata, a rust canyon with oval doors and lit
  portholes, and the oculus drum with its balcony goal. A ring wall with a rim
  city stands on the horizon, and an upside-down city hangs overhead.
  Toward its reference sheets (October 2026): inverted U-bends stand on the trench walls' long blue-grey
  runs (the pipe mass of IMG_3789 p1; solid, climbed as drawn, five-sided to keep the collision near
  185 k triangles), the drum has an arcade of small dark bays under its rim over a cornice, slits and
  panels between its tall windows and machinery at its wall's foot (flush or solid), and the city's inner
  towers have two to four lesser towers packed round them, each ending in a bulb and a spike. All of it
  draws from its own random numbers, so the layout and the story's places keep theirs.
- **The Garden of Spheres** (`spheres`): umbrella trees with gill undersides,
  white pyramids and an overgrown terraced hill with stairs, and giant spheres
  whose crescents face the light. It also has a sphere-arch, a mirror lake with
  projected reflections (correct from the south shore), and a cypress avenue to
  the round plaza.
- **Lorn II** (`perdide2`): violet trunks and pale mushrooms at dusk, with
  crystal reeds, glowing egg heaps and lit pools along a wadeable path. The path
  passes root arches, moss domes and a sunken saucer, and ends at a coral-lit
  root cave with the teal skiff moored outside.

## Sand banked against things

In a sandy world what stands on the ground sits in it (`src/sand-drifts.js`). While a world is
built, `SandDrifts.open()` collects the solids its builders add (the desert's Kits in
`desert-city.js` and `desert-landmarks.js`, the Lab kit `RoomKit` in the references): each is cut at
its foot (the vertices in its bottom band, joined by the triangles they share, so an arch's two feet
stay apart and no drift runs across its passage), each part's convex hull a footprint (posts,
crates, slabs and anything off the ground skipped). Round each, a drift: `rise` at the wall (higher
facing the wind, `SAND_WIND`, wandering along the wall), falling off along (1 − u)² to nothing
`reach` × rise out, so it meets the ground tangent and never steepens into the terrain's rock colour
(`maxSlope`); a share of corners carry a bigger drift. The skirts are one mesh per 160 m square
(culled by the view), drawn in the ground's own material (`driftMaterial`: same marks, same
patches) with a polygon offset, and collided (you walk up them). Their pixels carry +32 in
`gHatch.a`; post.js draws the line where they meet a wall in a darker shade of the sand and lighter.
Where there's no drift (past its reach, or a `mask`: none in Qanat's paved streets) no skirt is
built. A world that builds its meshes its own way hands the whole scene over after it is built
(`addScene`: every collided mesh in world space, a merged mesh's parts apart; render copies that a
hidden collider stands for are skipped): Vael and the Buried Machine. In the desert 206 footprints
(57 k triangles), Vael 214 (102 k), the Buried Machine 231 (138 k). `tests/sand-drifts.test.js`.

## The singing spheres, the wheel that keeps turning, and the ring's skin

- **Garden of Spheres** (`src/story/spheres.js`): every great sphere is a fluid target
  (`kind: 'orb'`) and rings one glass note when it is shot or pushed, in the garden's
  pentatonic scale, bigger spheres lower (`orbDegree(R)` in `spheres-data.js`,
  `Sound.orbNote(degree, pos)`); notes are placed by the camera (`Sound.placeAt`, the ear
  set in `listen`). The three that remember now wake when splashed, not when you stand
  still beside them: each plays its phrase (`Sound.remembered('bell' | 'chant' | 'drum')`)
  and then keeps its band. The pole on the plaza is a target too: splashed with all three
  sounds it plays them back as a little tune (`Sound.spheresSong`, `SPHERES_SONG` in
  `src/audio.js`: the bell carrying the melody over the voices and the drum, the ney
  answering once the mirrored pebble is set) before the band holds the chord.
- **The great wheel** (`src/story/buried.js`): once it has turned its tooth, the sand round
  it slides away over `CLEAR_TIME` s in a haze of dust, the heap against its faces and a
  long hollow along its plane (`wheelSand(x, z)` in `src/levels/buried.js`, applied with
  `wheel.clear(k)` through `Terrain.setHeights`, which reshapes the drawn ground, its exact
  lookup and so the collision, and sums the normals again the way three.js does). Then it
  keeps turning at `SPIN` rad/s, shedding sand off its teeth. `buried.wheel.turned` keeps
  both on later visits.
- **The Hangar's ring** (`src/levels/garage.js`): its skin faces the axis (`facingIn`), the
  side you walk on. With the cylinder's own outward faces, every point inside the ring read
  as the inside of a solid to `physics.embedded` whenever a ray along the axis grazed an end
  rim, and the unstick pushed jet-fliers out through the skin, where they were pinned
  against the hull. Outside the skin is now `unsafe` (back where you last stood), respawns
  stand you the way that place's gravity is up, and `Player.unhang` puts back anyone wedged
  in mid-air (off the ground, no jets or wings, not falling for `HANG.time` s).
  `tests/ring-jets.test.js`.

## Qanat's tree ledge, solid terraces, and the dry cave
- **The makers' ledge** (`src/desert-city.js`, `city.ledge`): the backpack's box no longer
  stands under the little blue shrine; it sits on a plank shelf jutting out of the burning
  tree's trunk 3.2 m over the top terrace, left of the dry well, on a buttress root whose flat
  face you climb (push into it). The shelf reaches 2 m past the chest's centre, so the climb's
  last reach (`player.js` `tryMantle`, a 1.6 m ray at head height) clears the chest and ends in a
  pull-up onto the planks in front of it. `ledge.box` / `ledge.yaw` place the box
  (`src/boxes/placements.js`), `ledge.foot` is where you start the climb, `ledge.at(x, y, z)`
  is ledge-local (x across, z out from the chest), `ledge.bench` is Nour's bench below it.
  When it opens, Qanat gathers at the tree's foot looking up; Nour waits there while you are
  still up on the shelf (and calls you down), then comes to you (`src/story/desert.js`).
- **Feet on the paving**: the terraces' lips were full discs 22 cm over the colliders, so feet
  sank into every tier; they are now flush bands, and the colliders are as round and as wide
  as the lip. The plaza and avenue paving sit 2 cm proud of the ground. The trunk's collider
  is the bark itself (it was a cone up to 0.7 m outside it). `tests/desert-story.test.js`
  raycasts the drawn surfaces against the ground.
- **The dry cave**: the giant's chest has no water until the rib is off the channel (levered, or pushed with a full tank):
  damp stains in the basin and the gutter, a pale tide line where the pool stood. Then the
  stream runs out of the crack down the channel (`cave.setWater(flow, level)` reveals it
  segment by segment with a draw range), and the pool fills the basin from its lowest point,
  widening up its sides (its radius follows the basin's profile, `cave.basinR`). A save with
  the channel already open finds it full (`tests/desert-cave.test.js`).

## The ship's deck: flat, smaller, lived in, a holo table in the middle
Player feedback: the traveller bobbed up and down walking the deck, the hatch's doorway
shimmered, the reactor column filled the middle, the deck felt too big for one pilot.
- **One flat plane** (`src/ship/interior.js`): an invisible collider disc at `DECK` lies under
  the drawn floor; the drawn pieces (the inlay round the table, a teal ring, the boards) meet
  edge to edge in that plane. The bob came from a skirting ring 18 cm high across every
  doorway of the old corridor and from furniture under the step height (`STEP`, 0.6 m in
  `src/player.js`): stools, the bench, the bed, pots, boots. Low furniture now gets an
  invisible block `BLOCK_H` (1.1 m, the height of the hull's skirting) over its footprint, so
  the capsule meets a wall and walks round it. The desert crash lies upright (`sites.js`
  pitch and roll 0; the furrow, the sand and the sink still say "crashed"): a tilted hull
  tilted the deck. `tests/ship-deck.test.js` checks every point of the deck (any surface under
  a step must be one the capsule cannot stand at) and walks across it at one height.
- **The doorway**: the threshold (`hull.js`) starts at the deck's edge (`FLOOR_R`) instead of
  overlapping it, and the hatch's reveal has no sill of its own (`holeReveal(..., { sill: false })`):
  three surfaces used to share one plane and flickered as the camera moved. A test casts down
  across the doorway and finds one drawn surface in each place.
- **Smaller**: built-in units stand round the hull (`unit()`: a body, a lid to the hull, side
  panels following its curve), their fronts at `UNIT_R` (7.05 m), so the open floor is about
  13 m across. Four short ribs (`RIBS`, from `RIB_R`) mark the corners: the bunk corner (the
  queen bed, a nightstand, a chest of drawers, the desk and its chair with a jacket over it, a
  bookcase, a wardrobe, drawings and notes pinned up, nothing over the bed), the galley (the
  counter with stove, sink, kettle, bread, mugs and plates; a pantry with notes on it; crates
  strapped down; the table and its three stools; herbs drying), the entry (lockers, the bench,
  coats, crates, a tool board), the cockpit (instrument racks either side of the window).
  Cables and conduits run under the ceiling. The small things are one vertex-coloured mesh
  (`Paint` from `src/vehicle-kit.js`, `interior.props`): one draw call.
- **The holo table** (`src/ship/holotable.js`): in the middle, a small planet turns over the
  table's glass: the world the ship is at (in the prologue, the desert it falls toward), drawn
  with the approach's planet shader (`planetMaterial`, now with `uFreq` and `uInkK` for a
  planet seen small) in the galactic map's colours, a teal rim and two scan rings. It turns its
  lit face to the camera after a cinematic has placed it (`Ship.update`), flickers on emergency
  power and goes dark with the ship. The table's glass is the old reactor's `core` material.

## Home: two houses you walk into, a garden, Lou, Tove and the dog
- **The place** (`src/levels/home.js`, `home-houses.js`, `home-garden.js`, `home-drawings.js`):
  the round house (the parents') now has a doorway cut through its dome (`domeShell` drops the
  shell's triangles in the opening; a terracotta arch tunnel frames it, the painted band breaks
  for it) and a dark, dusty, still room inside: the father's chair turned to the round window
  with his cap on the arm, the mother's scarf on the coat stand, the photo on the side table,
  the recorder under the mast with its spindle bare, her lamp under the window, dust sheets, and
  dust specks hanging in the light (one instanced draw). Its door is shut until you push it
  (`doorLeaf`: not solid; a shut door holds you in its tunnel). Across the yard, the small house
  (the traveller's own, where Lou and Tove live): a drum of wall blocks with open door and
  windows, a terracotta dome roof, the lamp and the hearth lit; a kitchen table, the hearth and
  the dog's basket, two beds behind a curtain, Lou's shelf (a copy of every keepsake, from
  `tokenModel`, as they are collected: `level.home.furnish`), her crayon drawings by the door
  (one canvas-painted sheet per world you wrote to her from), a window seat. Both rooms are
  real geometry inside the walls you see, not portals. The garden: three raised beds (cabbages,
  carrots and a bean teepee, squashes, built with the flora kit and swaying with the wind), a
  border of flowers you can pick (instanced per kind; a picked one is scaled away, back next
  visit), a picket fence with two gates, stepping stones, a bench, a watering can. A swing
  hangs from the umbrella tree; home has its own flora on the hill (`SPECIES.home`, the yard
  kept clear by `floraAvoid`).
- **Indoors** (`level.indoorAt`): both houses register with the shelter (`addIndoors`), so no rain
  or sand is drawn in them, and the level sets `CameraRig.indoor` while you are in one (the
  ship's over-the-shoulder camera), and lets go when you step out.
- **Cloth that hangs** (`src/hanging-cloth.js`): the capes' Verlet cloth with its top edge
  pinned in the world (all of the top row, pegs, or any `(row, col)` rule: the flag on the
  landing ring's mast is pinned along its pole edge). The wind pushes along each point's normal
  (face-on billows, edge-on barely stirs) with a flutter running across it and the gusts; it
  collides with the traveller's capsules (`Humanoid.capsules`) when you are near, and with a
  floor; `pleats` presses folds into a curtain at rest. `Cloths` simulates only those near the
  camera and lets the rest sleep. Home has the washing (five pieces on pegs), Lou's bunting
  between the two houses, the flag, the curtain in front of the beds and the scarf (both
  indoors: a breath of wind at most, until you brush past).
- **Lou, Tove and Moustache** (`src/story/home.js`, `home-data.js`, `src/dog.js`): Lou is a full
  NPC built as a child (her def's `morph`, `face`, `rest`, `gait`, `body`, `brows`, which
  `src/npc.js` applies to any story person; the studio shows them, `?who=npc&world=home&npc=lou`):
  about 1.2 m and five heads tall in the studio's count (Tove is 6.6), a head 1.3 times the size on
  short arms and legs (the morph's child ranges: `torsoLength` shortens the spine by moving its
  bones closer, `headSize` up to 1.55, leg and arm length down to 0.68 / 0.72), a round, soft,
  waistless middle on the people's slighter, flatter body (`body: 'm'`) while her voice stays a
  girl's (`kind: 'f'`, `age: 'child'`), a round face with a short lower face, big low-set eyes, a
  small nose, no lines, light brows and a ready smile at rest, two buns, a dotted dress. She walks
  with short quick steps and breaks into a run early (`gait.stride`, `gait.pace` scale the clips'
  stride and thresholds) and never stands still (`gait.fidget`: shifting from foot to foot,
  swinging her arms, twisting, bouncing on her toes). Once a visit she runs to meet you and asks what you brought; what she
  says follows how many keepsakes you have (`keepsakeBand`) and the newest world you wrote to
  her from (`DRAWING_LINES`); she sees a flower in your hand. Then she goes about her day (the
  border, the swing, the stone, her door). Tove sits on the garden bench. Moustache, a scruffy
  medium dog built like the wildlife (one painted geometry per moving part), follows you
  everywhere a couple of metres off your shoulder (trot, gallop to catch up, into the houses),
  noses about and sits when you stand still, barks at the bird and the scout drone, and E pets
  him. NPCs have a `hush` flag now: no balloons over a scene.
- **Paying your respects** (`Moment` in `src/story/home.js`): E at the stone. You are set in front
  of it and kneel (`kneelPose`, laid over the clip through `player.overlay`, a hook run before
  the humanoid follows the rig; the feet stay where the pose puts them), the bars come down, a
  low shot frames you and the slab, a short tune plays (`sound.homage`), and: you lay the flower
  you picked (kept on the stone: `home.flowers`, the newest nine), or after the ending set down
  what you have found since (the slab makes room and each goes to its place, the way the ending
  set everything down: `home.stone`, `laidTokens` / `unlaidTokens` / `layTokens`), or rest your
  hand on it. A quiet line, a word to them, and you rise. Esc hurries it. The window seat is the
  same kind of moment, sitting (`sitPose`), looking out at the ring.
- **The ending, with Lou** (`src/ship/homecoming.js`, `tombLines(tokens, { lou })`): she runs down
  the path to meet you, waits for you there, walks with you to the stone and stands at your
  left; she leaves her drawing against the headstone (kept: `home.lou.drawing`), and after the
  oldest recording asks "Was that you? The little one, waving?". Her lines are subtitled LOU and
  voiced as a child, close by (`CALL_VOICES.lou`, no radio). The credits name Lou, Tove and
  Moustache "in the small house". `tests/home.test.js`, `tests/home-family.test.js`.
  The reel knows her too, never by name ("the little one"): one line from the mother in
  recording 5 ("She has your hands, love") and one from the father in the last recording
  (`src/story/calls.js`; `tests/ending.test.js`).
