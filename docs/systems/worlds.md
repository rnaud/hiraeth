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
| – | **The White Mangrove** (`mangrove`, off the route) | a village in the white roots | walk, climb, swim |

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
  - a 520 m-wide pit, 580 m deep, with eight levels of terraces; each level is two or three sectors (slabs
    with their town, stalls, railings and bridges to the spire) going round the ring one after the other with a
    0.18-0.33 rad gap between them. Until October 2026 the angle never advanced between a level's sectors, so
    they were all built at the same angle, on top of each other, and 40-70 % of every ring was empty (a bug
    since the level was made, `ab4571ce`). The first sector of each level, which holds the story's places,
    the cab stops and the stair's landing, is where it always was; `tests/incal-terraces.test.js` checks the
    sectors never overlap, one slab top under every point of the ring, and every sector has its town;
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

The stalls carry goods (October 2026, toward the reference sheets): four heaps of fruit mounded over brass
bowls (a cone of the fruit's colour under fruit on its slopes, so the pile reads full), crates stacked two
or three high and a sack against a jar between them, strings of goods hanging under the awning's edge, three round pictures on the
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

## The White Mangrove (`mangrove`, off the route, October 2026)

A world to look at, after its four reference pictures (`references/The White Mangrove/`; the views:
references.md): a settlement in a mangrove of enormous bone-white trees standing on arching roots in a
black lake, houses on decks round the trunks, plank walks with lanterns, the lake's creatures glowing blue
and pink. No story to follow and no errands: three people from other worlds came to see it (Oyo, the
market's lantern seller, on the great tree's deck; Fen of the Deep Wood by a stair; Bram at the landing),
and five of the lake's folk stand on its walks and decks, each with a few toned lines of their own.

- **Off the route** (`SIDE` in `src/levels/names.js`): on the ship's galactic map from the start, after the
  route's worlds and before home, off the dotted line (`mapEntries({ side })`, src/ship/starmap.js); never
  counted toward the way home (`completedWorlds` reads `ORDER`); hidden in the worlds list until visited.
  `?level=mangrove` opens it. Its people speak Lorn II's tongue (`lang: 'perdide2'`): a world off the route
  borrows a neighbour's script (tests/scripts.test.js).
- **The layout** (`src/levels/mangrove.js`): the landing island in the south (the ship's site, its ramp
  toward the landing stage), a walk north to the great tree (r 4.5, its deck 11.3 m up), a ring walk 34 m round
  it and spokes to five trees 68 m out, each with a stair from a platform on the water up to the deck round its
  trunk (the stair off the line of the bridges), houses on each deck; rope bridges from the great tree's deck
  to three of them; thirteen trees with no deck further out and between, houses in their forks; the banks and
  the wood behind closing the world at ~300 m. The low walks run 1.2 m over the water, rail-less (you can fall
  in: the lake is 2.6 m deep and swum, and the mantle climbs back out); stairs, bridges and decks are railed,
  the railing open where a stair, bridge or house meets it (`ringDeck({ gaps })`).
- **Solid as drawn**: the trees (trunks, skirts, roots, limbs, leaves), decks, houses, stairs and walks are the
  collision (SAH BVH, ~218 k triangles, 20 k ground rays 7 ms and capsule pushes 10 ms, Lorn II's 16 and 25);
  the decked trees spring no roots over their decks (`upperRoots: false`); planks overlap a little (no gap a
  ray or a foot finds) and alternate by 6 mm (no flicker). Contact audit: climbs inside 6 (≤ 0.7 m), nothing
  else. `tests/mangrove.test.js` walks every walk, deck and stair.
- **Draws**: everything static is a dozen merged meshes (RoomKit buckets by material), the lake's 8 000
  creatures one instanced draw (a colour each), the bushes one, four boats poled round the lake (movers). No
  static mesh casts a shadow (the twilight's are lifted anyway: `uCast`).
- **The look**: `MANGROVE_LOOK` (mangrove-kit.js) on the print preset; the day lilac, the dusk violet (the
  sheets: the default hour is 17.8, the sun low behind the trees), the night indigo with its stars; fog
  weather; the swamp's ambience, footsteps on stone (the planks); bats overhead, warm motes.
- **Cost** (desktop, M-series Mac shared with other agents' jobs, Chrome on Metal, Handheld preset at render
  scale 0.75, 1280 × 720, a loop of 90 `renderFrame` + a pixel read, median ms, two rounds alternating with the
  Signal Market): the market's spawn 6.6 / 5.9 ms (363 / 598 draws, 0.43 / 0.69 M triangles); the mangrove's spawn
  5.5 / 4.9 (353 / 381, 0.74 M), the landing stage 6.3 / 4.0 (329, 0.72 M), the great tree's deck 5.9 / 3.1
  (137 / 304), out on the water 5.0 / 3.8 (161 / 289). At or under the market's frame time and draws; more
  triangles at the spawn (the trees in the view and the shadows' passes).
- **Left to make it better**: the water draws a shore's foam under the low walks (the bed map counts their
  planks as the bed: a per-mesh "not a bed" mark in water.js would drop it); the lanterns light no colour on the
  roots (the shader's local lights only lift the shade); the creatures are flat spots, not a soft glow under
  the surface; the houses can't be entered; the boats pass through the stilts.

## The Glass Dunes: a detour off the route (October 2026)

`?level=glassdunes` (`src/levels/glass-dunes.js`), built from the References' plates
(`references/The Glass Dunes/`, docs/systems/references.md "The Glass Dunes' plates") and the same kit
(`src/levels/glass-dunes-kit.js`). No quest: people, light and wind, to see whether the world is worth more.

- **Off the route** (`SIDE` in `src/levels/names.js`, the level's `side: true`): the galactic map charts the
  detours after the route, always known, off its dotted line, tagged "a detour" ("A DETOUR, OFF THE
  ROUTE" in the panel), with no signature (`mapEntries({ side })`, `src/ship/starmap.js`). They never count toward
  the route (`knownWorlds`), home or the ending: those read `ORDER` only. The ship's travel is the same as to any
  world. A detour borrows what route worlds own: the desert's crowd costume, bodies and script (Qanati), the
  desert's crabs and jerboas (the wildlife and signature tests let detours share).
- **The layout** (m, +z south): the ship on a flat in the south (`GLASS_SHIP`, 0, 250, hatch north); the valley
  runs north between the cliffs of the giants (west: the cliff profile, silhouettes of giants, a head, a beast) and
  the billows (east: domes), round a frozen wave in its middle, to the great breaking wave (north: the `curl`
  profile, its hollow over the north camp). Low glass flows cross the sand in the east; five glass mounds to climb.
  A ring of tall glass at ~610 m closes the basin in (drawn only: past the edge, `limit` 560, no shadow).
- **The glass**: `glassRidge` meshes (the face lit as any surface, its colours in its vertices: a lime foot, mint,
  a teal top, the silhouettes printed darker inside), solid as drawn (you walk round, climb and stand on them) and
  kept out of the sand drifts (`withoutDrifts`: a long ridge's one convex hull would bank sand over the valley).
  The glass and the sand print their shade flat (`shadeFlat` `GLASS_FLAT` 0.8) in the world's teal-green shadow, so
  the shade reads as the light come through the glass; the camps, stones and kilns bank sand as in the desert.
- **The camps** (`GLASS_CAMPS`): awnings on poles, rugs, crates, glass floats glowing green, a kiln with its
  chimney and lit mouth (`awningCamp`), on ramps of sand against the walls. Four glassworkers with toned lines of
  their own (`GLASS_CONTENT`), a crowd round the camps and a file of carriers walking the valley between them
  (`glassCrowdSpots`, the desert's people and clothes), glass fans in the sand that open lime as you pass
  (`WORLD_REACTIONS.glassdunes`).
- **Light and weather**: the plates' sky (`GLASS_DAY`, dusk, night), a clean sky (no cumulus, no flat clouds:
  `GLASS_WORLD_LOOK`), the desert's stepped warm haze, the low evening sun at 16:30 by default; archways glow in the
  walls' feet and the kilns and floats light the camps at night; sandstorms (`weather: ['storm']`); green glints
  in the air, birds, footprints. Sound: the defaults (wind, sand underfoot) and the desert's score.
- **Cost** (Mac, headless Chrome on Metal, the Handheld preset at render scale 0.75, no dynamic resolution, a
  tight loop of `renderFrame()`, three rounds, medians): the Glass Dunes 1.73–2.11 ms and 170–321 draws (spawn
  1.83 ms / 321, the valley 2.11 / 277, the west camp 1.73 / 237, the breaker 1.73 / 215), the Signal Market
  2.23–2.28 ms and 312–695 draws. About 0.38 M triangles drawn at the spawn on the Handheld preset (0.87 M on
  High); the static collision ~45 k triangles. The load is the game's steps (a ridge a step).
- **Tests** (`tests/glass-dunes.test.js`): the kit (finite, coloured, the face out, the ends sunk, the silhouettes
  darker), the four views, the detour on the map and off the route, the build (the cliff solid, a mound stood on
  where drawn, the ship's flat), the contact audit (5 climbs inside the arches' drawn-only rims, 1 walks through).
- **Left / next**: the glass is opaque and lit as a surface (no glow from within, no light pooling lime at a
  wall's foot beyond its colours); the silhouettes are soft vertex-colour masses (crisper shapes need finer
  meshes or a shader mask); the archways are lit panels, not passages; the breaking wave reads as a great hood
  from far but as a wall from inside its hollow; no sounds of its own (the kilns, the glass ringing in the wind),
  no music of its own.

## The City Behind the Waterfall (`waterfall`, off the route, October 2026)

`src/levels/waterfall.js` (`?level=waterfall`; a SIDE world in `src/levels/names.js`, charted on the ship's map from the
start, no quest, no relics: `manual: true`), after its four pictures (`references/The City Behind the Waterfall`,
references.md). Its pieces are in `src/levels/waterfall-kit.js`, shared with the views.

- **The layout**: a cavern running along x (−310 … 44), its back wall at z −100, its roof's lip at y 150 over the
  curtain (z 40). The **landing** (x 44 … 214), a shelf of stone outside the east mouth, open to the sky: the ship
  (`shipSite` 140, 2, its hatch toward the cavern), lamps, a low wall over the drop. The **promenade** (y 0, z −10 …
  22) the whole length of the cavern, its parapet over the pool, cafés and pots by it; three short bridges out to
  **balconies** standing behind slits in the water (`BALCONIES`, the curtain's `SHEETS` leave a gap before each),
  looking out over the valley; a stair down to a quay on the **pool** (y −17, 4 m deep: swim in it). The **lower
  town** (x −150 … 30) and the **deep quarter** (x −290 … −158): `quarter`s of six terraces each, every one a solid
  block of stone with its street, rounded houses against the riser behind (pods, vaults, rounded blocks: arched
  doors and round windows, a share lit amber, awnings, lamps), stairs climbing along the risers through gaps in the
  parapets, copper pipes up the risers and the back wall (solid: you climb them). A small fall from the roof into a
  basin at the deep end. The **valley** far below (y −230), drawn only; the ground is −600 past the edges
  (`killY` −60).
- **The falling water** (`src/waterfall-shader.js`, references.md): the curtain is one mesh of four sheets in one
  material, drawn only, casting no shadow; mist banks at its foot breathe (movers); **spray**: 70 instanced drops
  thrown up at the foot within 40 m of you (`updateSpray`); pale motes drift in from the falls (`life.motes`).
- **Light**: the roof casts its shadow; the sun comes in from the falls' side under the lip (`lightAt`: from the
  south, ~45° high, swinging a little east to west), so the promenade and the lower terraces are lit and the upper
  ones and the deep quarter sit in the cavern's teal with their lamps. Day, dusk and night colour scripts
  (`WATERFALL_DAY`, `_DUSK`, `_NIGHT`); the world's look `WATERFALL_WORLD_LOOK` (few strokes, no bounce, the teal
  haze in stepped bands); the shade printed flat per material (`cityMats({ shadeFlat: 0.8 })`).
- **Sound**: `level.roar(pos)` (0 … 1: near the curtain's foot, and the small fall) drives two new noise layers in
  `audio.js` (`roar`, a low rumble, and `hiss`, the spray), passed by main.js; the ambience `falls` adds drips; the
  footsteps are stone's.
- **People and life**: a crowd in the falls' own costume set (`costumes.js` `waterfall`: hoods and wraps, baskets)
  walks the promenade and every terrace street, sits at the cafés and leans on the parapets; four people with
  ambient lines of their own (content.js); two creatures of their own (`species.js`: the spray newt, which blows a
  bubble of spray, and the cup crab, which tips the water off its back and scuttles off).
- **Contact**: solid as drawn but for the mist (`tests/contact-audit.test.js`: feet sink 2, climbs inside 2, all in
  the mist banks); the static collision ~163 k triangles.
- **Cost** (Mac M4 Pro, headless Chrome, 1280 × 720, the Handheld preset at render scale 0.75 without dynamic
  resolution, a synced loop of 60 `renderFrame()`s closed by a readPixels, the median of 7 rounds, the machine shared
  with other agents' jobs, load 49): the Signal Market (the budget) 2.03 ms / 597 draws at its spawn, 1.95 / 572 in
  the street; the falls' landing 1.10 / 173, the promenade 1.24 / 180, a balcony 1.08 / 95, the deep quarter 1.12 /
  157, an upper terrace 1.13 / 141 (~0.6 M triangles where the Market draws ~0.7 M).
- `tests/waterfall.test.js`: registered off the route and charted, the promenade, bridges and balconies solid, the
  pool deep, the ship's shelf flat and open to the sky, the streets solid, the roar, the crowd's routes, the toned
  lines, the collision budget, the fall's material and uv, the four views.
- **Left to make it better**: the houses are tidy rows where the pictures heap small volumes, balconies, goods and
  plants at every scale; the retaining walls are plain; the roof is a few lumpy slabs, not a mass of blocky
  overhangs; nothing flows on top of the lip seen from the landing (the river feeding the falls); the falls push
  nothing (walking into the curtain from the pool you just pass through); the houses can't be entered; the inner
  fall's basin is shallow and plain.

## The Salt Harbour (`saltharbour`, off the route, October 2026)

A world to look at, after its four reference pictures (`references/The Salt Harbour/`; the views:
references.md): huge weathered ships standing on their keels in a vast dry white salt basin, made into
apartment buildings, a street between their hulls. No story to follow and no errands: three people from other
worlds came to see it (Marrow, the desert's salvager, by the ship; Corvin Sale of the City-Shaft's rim on the
terracotta hull's deck; Pip, from the bottom of the shaft, under the ship stood on its stern), six of the
harbour's folk stand in the street and on the decks with a few toned lines of their own, and a crowd walks the
street, talks at the shops and leans on the decks' rails (`crowdSpots`, crowd.js; `CROWD_LINES`).

- **Off the route** (`SIDE`, src/levels/names.js, after the White Mangrove): on the galactic map from the start,
  off the dotted line, never counted toward the way home; `?level=saltharbour` opens it. Its folk speak the
  desert's tongue (`lang: 'desert'`); Corvin and Pip the City-Shaft's.
- **The layout** (`src/levels/salt-harbour.js`, `SHIPS`): the ship lands on the open salt in the south
  (`SHIP_SITE`, 0, 92); the street runs north ~30 m wide between two hulls each side (w1, w2 to the west; e1, the
  terracotta one, and e2 to the east), a cross-street between them out to the flats at z −130, to the ship
  stood on its stern at the end (z −372, its keel's terracotta stripe toward the street, its deck turned away).
  Five more ships lie out on the flats (one stood up, one sunk deep with rounded ridges in the crust round it),
  and the basin's rim closes the world at ~450 m (`limit` 430).
- **On the hulls** (the kit's `hull().at(t, y)`: a point of the drawn, faceted side and its normal): house stacks
  out from the plating where it is widest (their storeys hang over the shops at the hull's foot), shops with
  sailcloth awnings and lanterns, arched doors (some lit), ledges of herbs at the portholes, mooring ropes fanned
  from the flanks to stakes in the salt (e1's toward the street, the upright ship's all round). Up on the decks:
  upper works, railings along the walked decks' gunwales, houses on w1's deck round its upper works, crates,
  planters and washing lines. Sailcloths stretched across the street between the hulls, tied off to them.
- **Up and across**: a timber stair tower (`TOWER`: switchback flights, landings, posts, braces) climbs w1's
  flank at its middle to its deck (40.7 m), a short bridge over the gunwale onto it; a gangway (planks, rails,
  a truss) crosses the street from w1's deck to e1's (45.6 m); two more gangways overhead are drawn and solid
  too. The decks sit 0.35 m under their gunwales (a lip you step over); the gangways' ends lie over the decks.
- **The salt** (`height`): flat, barely rolling; a bank of salt up each hull's foot (its footprint an ellipse
  where the salt cuts the hull, the bank 4 m high at the plating and gone 15 m out), the ridges round f3, the
  basin's rim. The terrain's ink is the desert's (`sandInk`) over cracks.
- **Solid as drawn**: hulls, decks, upper works, houses, balconies, shops, stairs, gangways and rails are the
  collision (SAH BVH, ~90 k triangles); portholes, doors and herbs are put on the hull's facets, not the curve
  they are cut from, so nothing stands proud of the plating by more than the audit's 6 cm (the herbs are flora:
  walked through). Contact audit: climbs inside 12 (a porthole or two on a facet's edge, ≤ 0.5 m), walks
  through 6 (≤ 1 m: the tower's braces and a balcony's washing), nothing else. `tests/saltharbour-world.test.js`
  walks the street, the tower, both decks and the gangway.
- **Draws**: every static thing is ~30 merged meshes (RoomKit buckets by material); the terrain 80 k triangles
  (1200 m at 6 m); the hulls cast the shadows (the pictures' great blue shadows on the salt).
- **The look**: `SALT_LOOK` (salt-harbour-kit.js) on the print preset: the shade printed flat in one blue-grey,
  little hatching, a warm pale haze down the street; the day deep blue over a blinding salt (default hour
  10.5), the dusk rose and terracotta, the night indigo with its stars and the lit portholes and doors; no
  weather; the desert's wind ambience, footsteps on sand; gulls overhead, salt glints in the air.
- **Cost** (desktop, M-series Mac shared with other agents' jobs, Chrome on Metal, Handheld preset at render
  scale 0.75, 1280 × 720, rounds of 90 `renderFrame` + a pixel read each, the median round, the Signal Market's
  start and crowd views measured in the same runs, alternating): first run (five rounds, the terrain then at 5 m
  cells, 135 k triangles) the market's start 7.1 / 6.3 ms (700 draws, 0.67 M triangles), its crowd 8.0 (330); the
  harbour's spawn 8.7 (317 draws, 0.61 M), the street 5.4 / 6.0 (171 / 245), the cross-street 5.7 (220), w1's deck
  6.1 (202). Second run (seven rounds, the terrain at 6 m, 80 k; the Mac busier): the market's start 9.6 / 9.4
  (698 draws), its crowd 6.1 (140); the harbour's spawn 9.1 / 9.2 (321 / 213 draws, 0.61 / 0.35 M), the street 6.6
  (173), w1's deck 3.9 (235). At or under the market's frame time, under half its draws at the spawn.
- **Left to make it better**: the hulls have no inside (the doors are drawn; a cabin you walk into would make the
  houses read as homes); the sailcloths are smooth undersides from the street (the pictures' are layered and
  folded); the crowd hauls nothing aboard (a basket at most); the ropes are drawn only and the crowd walks
  through them; the far ships have no people.


## The Forest of Antennas (`antennas`, off the route, October 2026)

A world to look at, after its four reference pictures (`references/The Forest of Antennas/`; the views:
references.md): abandoned radio masts by the thousand on a rolling plain of violet grass, great dishes tilted every
way, lattice towers joined by vine-grown cables, birds nesting on the rims, and a small settlement of rounded repair
workshops under one immense receiver. No story to follow and no errands: three people from other worlds came to hear
it (Lune, who reads the Sealed Hangar's signal, on the observation deck; Ottla, its mechanic, on the plaza; Teb, the
Signal Market's cab tout, by the ship), and five of the mast-menders stand about with a few toned lines each. Its folk
speak the Sealed Hangar's tongue (`lang: 'garage'`: a world off the route borrows a neighbour's script).

- **Off the route** (`SIDE`, `src/levels/names.js`): on the galactic map from the start, `?level=antennas`.
- **The layout** (`src/levels/antennas.js`): the ship lands on a low rise in the south (`SHIP`); a path winds 200 m
  north through the masts to the workshops round a plaza on their mound (`SETTLEMENT`: seven domes, their doors to
  the plaza, a lamp on a post, crates, a bench), under the receiver (`RECEIVER`: a navy dish 24 m round on a column,
  a turret with lit portholes, a railed balcony round it 12 m up, its face turned to the path). West of it the
  observation tower (`OBS`): one long truss stair from the grass to its railed deck 12 m up, two tall masts with
  beacons over it, and a maintenance bridge from the deck to the receiver's balcony on a lattice leg. A branch of the
  path goes west to a hamlet under a great nest saucer on its egg (`HAMLET`); a fallen dish lies tipped toward the
  path (`FALLEN`), walked into. 92 masts and dishes stand in the walked land (`forestLayout`: masts with nest saucers,
  dishes, spikes or nothing, 14-52 m; dishes 5-11 m round on lattice legs), cables and wires between neighbours, and
  2 600 more beyond, out to ~800 m, where the land rises into hills.
- **Built in cells**: each 170 m cell is its own `RoomKit` (a mesh per material and cell, so the frustum culls
  them); the dishes' tones and the workshops' (two surfaces, six and three tones) are merged per vertex in each cell
  (`mergeWithMaterials`, `S_VMAT`: a draw for all the tones of one surface); the forest beyond is four instanced
  draws (poles, saucers, dishes, flower dishes), each mast its own tone toward the haze's cream with distance; the
  bushes one instanced draw. ~125 meshes in all.
- **Collision only where walked** (31 k triangles): the terrain (exact), the workshops, the egg, the receiver's
  column, turret, balcony and dish, the decks, stair and bridge, the fallen dish, the masts on the deck. A mast or a
  dish's lattice is drawn only; an invisible cone round each leg's foot (65° steep: neither stood on, ny < 0.7, nor
  climbed, ny > 0.35, so the contact audit samples neither) keeps you out of the legs, and the bottom 3.6 m of each
  lattice is left unbraced (`latticeTower({ open })`), so you walk in under a mast between its legs and nothing drawn
  passes through you. On a slope a mast stands on the highest ground under its legs, its legs reaching the lowest.
  The vines are marked `flora` (walked through, as plants are). Contact audit: feet sink 1, climbs inside 3, walks
  through 1, each under a metre (`tests/contact-audit.test.js` KNOWN).
- **Thin bars at any distance**: the lattices, wires, vines and far masts are drawn at least 1.5 px wide wherever
  they would be thinner (`makeMaterial({ thin })`, src/thin.js; rendering.md "Thin bars at any distance"), and the
  far masts and dishes' frames draw a line in a dark shade of their own colour, not the world's black.
- **The look**: `ANTENNAS_LOOK` on the print preset (antennas-kit.js); the day pale yellow, the dusk with a violet top
  (so the dusk going to night stays violet, never brown), the night indigo with the workshops' windows and the masts'
  red beacons lit; fog weather. Two moons. Grass blades from the ground's ticks (flora-grass.js), kept off the path.
- **Sound**: the ambience `signals` (audio.md): the masts' hum (`level.hum(pos)`: 0 on the open plain, up to 0.55 by
  a mast, 1 under the receiver), static crackling in clusters, and now and then a far signal whistling as it tunes
  in; footsteps on grass. Birds overhead (two flocks), pale motes.
- **Cost** (Mac, M4 Pro, headless Chrome on Metal, Handheld preset at render scale 0.75, 1280 × 720, a synced loop of
  `renderFrame`, median of 3 rounds alternating with the Signal Market): the market's spawn 2.31 ms (361-598 draws,
  0.43-0.70 M triangles), its street 2.42 (334-656, 0.47-0.76 M); the forest by the ship 2.16 ms (350 draws, 0.82 M),
  on the path 2.17 (208-327, 0.45-0.70 M), on the plaza 2.39 (271-304, 0.59 M), on the deck 2.15 (199-313, 0.37-0.60 M).
  At or under the market's frame time and draws; more triangles by the ship, where the whole forest is in view. The
  build in node: ~350 ms.
- **Left to make it better**: the receiver doesn't turn (the folk say it does, at night); the workshops can't be
  entered; the birds on the rims are still (the flocks fly); the leaves on the vines and the bushes' blades still
  flicker a little at a distance (the motion check's residual); the cables don't sway; the far forest is the same
  four shapes; no wildlife of its own (the game's flocks and motes only); the domes are plain where the pictures
  dress them with machinery, decks and ladders.
## The Underwater City (`underwater`, off the route, October 2026)

`src/levels/underwater.js` (`?level=underwater`; a SIDE world in `src/levels/names.js`, charted on the ship's map from
the start, no quest, no relics: `manual: true`), after its four pictures (`references/The Underwater City`,
references.md). Its pieces are in `src/levels/underwater-kit.js`, shared with the views.

- **Under the sea, the game's own movement** (the choice): the whole city is under a sea whose surface is 48 m up
  (`SEA_Y`, a water body carrying `userData.sea`: water.md "A sea"). You walk its streets and the sand in the water
  (swim.js `SEA`: 0.8 of the walk), the jump kicks you off swimming, Space rises, letting go sinks you back down to
  stand where you touch ground: so the towers' pods and tops are reached by swimming up and landing on their decks.
  The traveller's pack gives air (no breath runs out down there; near the surface the water is ordinary and you can
  come up into the air). The **cafés** are air pockets (`sea.air`, one test per dome): walk in through the door and
  you are dry, the tint and the muffled sound gone, the warm room lit inside. I chose this over air-filled streets
  joined by swims: the sheets walk the traveller along open streets under the water, and the breath limit would
  have made the city a string of dashes between domes.
- **The layout**: the city's floor at y 0 (a heightfield of pale teal sand with ripples, 1 km, 4 m cells). The
  **landing** (z ~146), a sandy hollow 3 m down, rocks, kelp and bushes, the ship on the sand (`shipSite` 0, 150, its
  hatch north) and a lamplit path up to the **avenue** (x −7 … 7, z 84 … −132: paving drawn 3 cm over the bed, globe
  lamps both sides). Either side the **towers** (14, 30–58 m, a ring of pods each: open pods are decks you land on,
  `level.decks`) and **glass columns** of luminous water up to near the surface, their bubbles rising (one instanced
  mesh; only the columns within 90 m of you move). The **canal** (z −20, 16 m wide, 10 m deep: walls with a low
  parapet, kelp, rocks and fish down in it) crossed by the avenue's bridge and two footbridges. The **terrace** to
  the west (y 6, stairs up from the city): the great café, two small pink houses, pods on stalks, benches, lamps
  along its edge over the **drop** where the floor falls away 34 m into the deep. The **plaza** at the avenue's end:
  the great column in its middle, benches and lamps round it, two pink houses. Low dunes rise round the city; past
  the world's edge (300 m) the city goes on, drawn only, into the haze (`farCity`, flagged out of reach).
- **The cafés**: two glass domes on ribs (S_GLASS draws only their rim and a highlight), a shell house with two
  windows and a porthole, a pink one, the great café and three small pink houses: floors 4 cm over the street, the
  counter and a dresser of bottles, tables, chairs and pendant lamps, people at the tables (the crowd's groups); a
  shell casts no shadow on its inside and is lined warm.
- **Life**: two mantas circling (one over the avenue at 34 m, one wide at 40), five schools of small fish, the
  columns' bubbles, kelp swaying, marine snow (`life.motes`, rising slowly).
- **Light and hours**: the sun is the sun (no `lightAt`); the colour scripts `UNDERWATER_DAY`, `_DUSK`, `_NIGHT`; the
  sea's tint darkens with the night (`seaByHour`, from `uNight`), and the shafts and caustics fade out after dark,
  the lamps and the cafés' windows left.
- **Sound**: the city's ambience muffled under the water (`audio.js` `underwater()`, as anywhere under water),
  clear again in the cafés; footsteps on stone.
- **People**: a crowd in the falls' costume set (`COSTUMES.underwater = COSTUMES.waterfall`, in the city's own
  palette) walks the avenue, the canal's banks, the plaza's ring, the terrace and the landing's path, sits in the
  cafés and leans on the canal's parapet and the terrace's edge, with eight ambient lines; five people with lines of
  their own (content.js): the glass café's keeper, the bridge's lamplighter, a child by the great column, the
  terrace's gardener, someone at the landing.
- **Contact** (`tests/contact-audit.test.js`): feet sink 46, climbs inside 150, walks through 93 (the cafés' chair
  backs and the domes' ribs, drawn only; the plants on the decks are flora); the static collision ~63 k triangles.
- **Cost** (Mac M4 Pro, headless Chrome, 1280 × 720, the Handheld preset at render scale 0.75 without dynamic
  resolution, a synced loop of 60 `renderFrame()`s closed by a readPixels, the median of 7 rounds, the machine shared
  with other agents' jobs): the Signal Market (the budget) 1.51 ms / 596 draws at its spawn, 1.60 / 627 in its
  street; the landing 1.53 / 301, the avenue 1.62 / 241, the bridge 1.42 / 200, the plaza 1.38 / 206, swimming among
  the towers 1.37 / 128, in a café 1.49 / 195, the terrace 1.54 / 246 (~0.4–0.7 M triangles; the Market ~0.7 M).
- `tests/underwater.test.js`: a sea in a box (its surface over everything but its air pocket; the bed walked, the
  kick, rising, sinking back and standing, the breath never running out, landing on a ledge, a long fall breaking
  nothing, dry in the pocket), the shafts' lattice world-anchored; the world registered off the route and charted,
  one sea, every café dry inside with the sea at its door and its door open, the avenue, bridge, terrace, stairs
  and decks solid, the ship's hollow flat and clear overhead, the crowd's routes, the toned lines, the collision
  budget, the four views.
- **Left to make it better**: the city is tidy rings of pods where the pictures heap balconies, plants and figures
  in every pod; the pods can't be entered (only the cafés); nothing swims in the glass columns; the canal's water
  is the same sea (no darker water under the walkways as view 3 has it); the far city is plain cylinders; the mantas
  don't react to you; the cafés' people sit still at their tables.

## The City During the Eclipse (`eclipse`, off the route, October 2026)

A world to look at, after its four reference pictures (`references/The City During the Eclipse/`; the views:
references.md): a city of limewashed houses, domes and round towers on terraces round great stairs, at midday
under a total eclipse. The city has lit its lamps at noon and gone out to eat in its squares. No story to follow
and no errands: three people from other worlds came for the eclipse (Mira of Viridel with her water clock, by
the west wall's tables; Mother Ysolde of Vael II, in the bowl; Wen of the Buried Machine, counting the far city's
lamps at the overlook), five of the city's folk with a few toned lines, a crowd in the lake folk's pale robes
(`COSTUMES.eclipse = COSTUMES.mangrove`) strolling, talking between the tables, leaning on the overlook's parapet.

- **Off the route** (`SIDE`, src/levels/names.js, after the Underwater City): on the galactic map from the start,
  off the dotted line; `?level=eclipse`. Its folk speak the desert's tongue.
- **The layout** (`src/levels/eclipse.js`; north is −z): the ship lands on the esplanade (`SHIP_SITE` 0, 96) south
  of the gate (two domed towers, z 44). The Lantern Square (y 0): the great west wall (`WEST`) in two terraces of
  houses (5.6 m and 10.4 m) over a row of tables, lamps hung on it, the pale figures leaning out over the diners and
  hung over its parapets, a side stair along its foot to a landing and a second flight to the upper terrace; on the
  east the round tower and a street of lit doors with tables and awnings; rows of tables in the middle round a pale
  figure on its plinth. The Great Stair (`STAIR`, 8 m wide, 24 steps) climbs north to the upper city (y 6), past
  cellar doors in the wall under it. There the bowl (`BOWL`): a square of tables under six tiers climbing north
  (1.8 m each, a stair up their middle, lamps and pale figures along their edges, houses at their ends) to the
  eclipse house, a great drum under its dome between two towers; the great dome east of the bowl; on its west the
  overlook, a lane of houses and tables along the parapet over the lower city. The city stands on masonry walls
  over a plain 22 m down (`LEVEL`, `BOUNDS`) spread with the lower city's houses to the horizon (drawn only, a few
  faces each); the walls can be climbed back up.
- **The sky by the hour** (`sky.eclipse`, src/eclipse.js; rendering.md "The eclipse"): the sun on a low path of its
  own (15° at noon, toward the north: over the bowl from the square); the moon over it from 10:00 to 14:00, total
  11:15–12:45. The traveller lands at 12:00 (`defaults.hour`): the black disc and its corona, a few stars, the rose
  band round the horizon, the windows lit (uNight held at 0.5), the lamps' pools amber on the walls
  (`lampTint`, `uLampsOn`). The colour script (`ECLIPSE_PALETTES`, `eclipseScript`): a pale blue morning over a
  white city, the light dimming through the partial phase, the totality's deep blue and cold lavender, a rose dusk,
  an indigo night.
- **Solid as drawn**: walls, parapets, terraces, stairs, houses, tables and the roofs behind the streets (the
  in-city `farQuarter`s, `solid: true`) are the collision (SAH BVH, ~17 k triangles); doors, windows, lamps, flowers,
  cloths and figures are drawn only. Contact audit: feet sink 16 (the flower boxes on the roofs' edges, the figures
  hung over the parapets), climbs inside 14 (≤ 0.6 m), walks through 3 (an antenna, a pole), nothing hovers.
  `tests/eclipse-world.test.js` walks the way north, every step of the Great Stair, the bowl's tiers, the west
  wall's stairs, and finds a parapet at each edge.
- **Draws**: every static thing is merged per material (RoomKit buckets, the far city in the same buckets); the
  terrain 135 k triangles (1300 m at 5 m: the step between the levels falls inside the wall between
  them). Loads in steps (load-steps.js), ~1.6–2.2 s to the first frame in headless Chrome.
- **Cost** (desktop, M-series Mac shared with other agents' jobs, Chrome on Metal, Handheld preset at render
  scale 0.75, 1280 × 720, seven rounds of 90 `renderFrame` + a pixel read, the median round, the Signal Market
  measured in the same runs): first run, the market's start 6.7 ms (601 draws, 0.71 M triangles), its crowd 5.3
  (331); the city's arrival 7.8 (304, 0.59 M), the square 5.0 (260), the bowl 7.9 (217), the overlook 3.8 (205).
  Second run: the market 6.1 / 4.7 (696 / 329 draws); the city 5.4 / 5.0 / 5.4 / 4.4 (340 / 283 / 236 / 141). The
  rounds are bimodal on this busy Mac (4–5 ms or 7–8 ms); at or under the market's frame time, half its draws.
- **Left to make it better**: the people at the tables are simple seated shapes (the pictures' diners lean, eat,
  talk); the pale figures read as pale draped shapes more than the pictures' long-limbed watchers; the houses are
  tidy blocks and drums where the pictures heap stairs, balconies, ledges and plants; the far city has no streets;
  the houses can't be entered; the lamps' pools show as pale discs in full day (the local lights lift the shade in
  every world).

## The Fallen Ring (`fallenring`, off the route, October 2026)

A world to look at, after its four reference pictures (`references/The Fallen Ring/`; the views: references.md): a
broken orbital ring lying across a vast sage-green plain, its colossal curved segments standing as arches into the sky,
lying in the grass as tubes, leaning on their crushed ends; their cut sections showing the streets and gardens inside;
the low pieces made into villages; herds of woolly beasts grazing through. No story to follow and no errands: two people
from other worlds came to see it (Oro, who grows pyramids in Viridel, in the garden inside the tube's broken end; Emrys,
the Garden of Spheres' climber, on the tube's crest), and five of the ring folk stand about with a couple of toned lines
each. They speak Viridel's tongue (`lang: 'edena'`).

- **Off the route** (`SIDE`, `src/levels/names.js`): on the galactic map from the start, `?level=fallenring`.
- **The layout** (`src/levels/fallen-ring.js`): the ship lands on the open plain in the south (`SHIP`); a path runs 200 m
  north to the long tube lying across the grass (`TUBE`: 22 m round, 300 m long, sunk 2 m), its village along its south
  foot (rows of cabins under the overhang, built into the cut-away bottom of the hull, awnings and stalls out front),
  three service stairs up its flank to the crest (`STAIR_S`, `STAIR_RUN`: each lands where the flank is 32° from level
  and runs out far enough to clear the bulge), its east end broken open on the old street inside (a floor a metre over
  the grass, lamps, a garden, a ramp up to it). Behind it the great arch (`ARCH`: a circle through three points, its
  legs 540 m apart, its top 200 m up and leaning back, the storeys inside each leg bared behind ribs, machinery on the
  inside wall); east of the tube's end the tilted segment leans on its crushed vermilion foot (`TILTED`), trees from
  its seams. West, the low segment (`BAND`: an arc of 80 m radius) rests on timber posts 11 m over two rings of houses,
  a street between them, a stair up onto its top and the grove there; east, the vault half sunk in the grass with its
  village (`VAULT`), and behind it a great tube 44 m round broken open end-on (`BIG`). Groves of umbrella trees on the
  plain; the rest of the ring far off all round (six pieces at 1.1-1.7 km, low-poly, one draw with its vermilion bands
  another), where the land rises; cumulus banks at 0.95-1.4 km (instanced lumpy puffs).
- **The pieces** are the views' kit (`fallen-ring-kit.js`, references.md "The Fallen Ring's pictures"): `ringThrough`
  (a segment by three points of its centre line), `village`, `tree`, `serviceStair`, `grazer`, `cloudBank`.
- **Built in cells**: each 220 m cell its own `RoomKit` (frustum-culled); the flat-coloured surfaces (timber, doors,
  goods, trunks), the foliage and the awnings merged per vertex in each cell (`mergeWithMaterials`, S_VMAT); the
  windows, rails, doors, goods, collars, broken edges, inside walls and floors cast no shadow. ~120 meshes in all.
- **Solid as drawn where walked** (~90 k collision triangles): the hulls' skins (a few thousand faces each: the arc
  rows are a few metres, the section 32-40 columns, so the contact audit finds the skin where it is drawn), their broken
  edges, inside walls, floors, ribs and the houses inside, the village houses, the posts, the stairs and the floor in
  the broken end. Drawn only: the trees' crowns (flora), the awnings, the far ring, the cumulus. Contact audit: feet
  sink 2, climbs inside 13 (awnings), walks through 0 (`tests/contact-audit.test.js` KNOWN).
- **The herds** (`Herds`): 45 beasts in five herds (`HERDS`), two instanced draws (the fleece, the legs and heads);
  each walks slowly to a spot on its herd's ground and grazes there, nodding, and trots off when the traveller comes
  within 7 m; past 160 m they stand still.
- **The look**: `RING_LOOK` on the print preset (fallen-ring-kit.js): a teal-blue day, a rose dusk, a deep green-blue
  night with the windows lit; passing rain. Grass blades from the ground's ticks. A pale moon. Birds overhead (two
  flocks), pollen motes. Sound: footsteps on grass, the `birds` ambience.
- **Cost** (Mac, M4 Pro, headless Chrome on Metal, Handheld preset at render scale 0.75, 1280 × 720, a synced loop of
  `renderFrame`, median of 3 rounds alternating with the Signal Market): the market's spawn 2.19 ms (598-693 draws,
  0.67-0.70 M triangles), its street 2.30 (334-656, 0.47-0.76 M); the ring by the ship 1.61 ms (457-525 draws,
  0.37-0.61 M), on the path 1.96 (424, 0.35 M), at the tube's village 2.01 (448-670, 0.57 M), on the crest 1.83
  (416-420, 0.48 M), under the low segment 2.33 (425, 0.58 M). At or under the market's frame time and draws. Before
  the per-vertex merging and the shadow trims the same places drew 434-771 calls. The build in node: ~300 ms.
- **Left to make it better**: the pictures' interiors are dense little cities, ours a few decks of boxes and gardens;
  the hulls' fine panel work and stains are the built pen detail and the collars only; the beasts are plain lumps (no
  wool, no legs moving); the arch and the tilted segment can't be climbed; the far ring is the same plain tubes; the
  cumulus are lumpy balls that pale a little with distance; the tilted segment's foot is a clean cylinder where the
  pictures crush it; nothing moves in the villages but the people standing there.
## The Moon Foundry (`moonfoundry`, off the route, October 2026)

`src/levels/moon-foundry.js` (`?level=moonfoundry`; a SIDE world in `src/levels/names.js`, charted on the ship's map from
the start, no quest, no relics: `manual: true`), after its four pictures (`references/The Moon Foundry`, references.md).
Its pieces are in `src/levels/moon-foundry-kit.js`, shared with the views. An abandoned workshop for making miniature
moons: the moons were never finished and nobody came for them; the workers live in the old machinery.

- **The choices**: no low gravity (the pictures show a hangar under a pale sky with haze, grass and trees: the moons are
  made here, not stood on; the jump keeps the game's one gravity, `GRAVITY` in player.js, which has no world scale).
  The pictures have no molten metal (it is abandoned), so the heat is one landmark of its own, the last furnace, drawn
  the Moebius way: flat hot tones, a pour as printed bands, no shimmer.
- **The layout**: the ship lands on the apron south of the hangar's mouth (`SHIP`, z 120; nothing over it). The hangar
  (`HALL`, 340 × 338 m) is a roof 88 m up on rust pillars (a grid of 60 × 78 m, kept off the stations and the gantry),
  open on every side; its floor is level slabs (a plain material with a 9 m grid over the terrain: no terrain ink, the
  pictures' floor is clean), rails in it, the aisle's painted edges and lamps north from the mouth. Along it: the **hung
  moons** (`HUNG`, `HUNG2`: R 19 and 22, from the roof by their crowns), the **moon in the claws** (`CRADLE`, R 20), the
  **last furnace** (`FURNACE`), the **workers' quarter** (`QUARTER`: houses round a little square, a great polishing drum
  lying on its side made a home), the **broken moon** (`COURT`: R 30, its hole toward the mouth, a cradle of five claws,
  none across the opening), the **bowl garden** (`BOWL`: a plated half-shell in its cradle, two houses and trees on its
  deck), the **moon on its pillar** (`PMOON`, a lookout house under it). Spare plates of shell lie on the floor; beyond the
  hangar, 70 far moons on cradles or tall cranes stand in the haze, out of reach (instanced, `userData.floats`).
- **The gantry** (`G` = the courtyard's floor, 13.05 m): a truss stair from the aisle (`STAIR`), the railed way north
  (`WAYS.main`) straight in over the broken moon's lip, and a branch west (`WAYS.branch`, a gap in the main rail where
  it leaves) to the bowl's deck, level with its rim (`bowl({ below: 0 })`). The courtyard's floor sits just over the
  hole's lip (`lipFloor`), and the moon's edge keeps no jag round its lowest point (`moon({ cut: { sill } })`), so the
  lip stays under the floor and a threshold of planks carries you in. Lamps on posts along the way.
- **The courtyard**: houses up to four floors under the shell's curve toward the back, a terrace on the back wall with its
  stair and a house, machinery on the inner wall, mint trees; lit windows, a lamp for each of the first six.
- **The last furnace**: a banded drum with its chimney to the roof, a glowing mouth in a dark frame toward the aisle, a
  hot patch on the floor before it; west of it a jib crane on its plinth, a ladle tipped on its hook (its rim and bail),
  the pour from its lip into a small new moon half sunk in the floor, its seam glowing. The pour is one mesh of 22 rings
  coloured per vertex in three hot tones (`T.molten`), recoloured each frame so the bands march down (`updatePour`): a
  printed pour, not a light. Lights at the mouth, the ladle and the mould. It drones (`level.hum`, the masts' drone
  audio.js already had: 0.75 at its mouth, nothing past 34 m).
- **Built in cells** (115 m, a kit each, frustum-culled); the moons' ivory tones and the machinery's and homes' oranges
  are two surfaces merged per vertex in each cell (`mergeWithMaterials`, `S_VMAT`); the roof by cell, drawn only and
  casting no shadow (the pictures light everything under it; out of reach); thin bars (trusses, rails, ladders, cables)
  1.5 px wide at any distance (`thin`). ~200 meshes; built in ~300 ms in node, in steps (load-steps.js).
- **Solid as drawn** where it can be walked or touched: the floor, the pillars and their ladders, the machinery dressing
  on them (greebles, so a climber goes up over it), the cradles, the moons, the houses, the gantries' decks, rails and
  legs, the stairs, the courtyard and the bowl's deck, the furnace and the crane's plinth. Drawn only: the roof, the
  cables, the trusses' web, the trees (flora), the pour. Collision ~168 k triangles (bake ~50 ms). Contact audit: feet
  sink 22 (the trusses' web over their chords), climbs inside 2, walks through 10.
- **People**: Dun of the Buried Machine at the furnace, Wen counting moons in the courtyard, Emrys of the Garden of Spheres
  on the bowl (their own words for the place: `talk.listen`, no errands); five of the foundry's folk with toned lines (the
  Buried Machine's tongue, `lang: 'buried'`), and a crowd in the Buried Machine's clothes (`COSTUMES.moonfoundry`) in the
  foundry's colours walking the aisle, the quarter's ring, the floor, the gantry, leaning on its rail.
- **Light and hours**: `MOONFOUNDRY_SKY` (a pale blue-mint day, a peach dusk, an indigo night); two pale moons in the
  sky. At night the homes' windows, the lamps and the furnace are the light. A small flock under the roof, a few motes.
- **Sound**: the ambience `machine`, footsteps on stone, the furnace's drone.
- **Cost** (Mac M4 Pro, headless Chrome, 1280 × 720, the Handheld preset at render scale 0.75 without dynamic resolution,
  a synced loop of 60 `renderFrame()`s closed by a readPixels, the median of 7 rounds, the machine shared with other
  agents): the Signal Market (the budget) 1.66-1.78 ms / 361-692 draws at its start, 1.51 / 540 in its crowd; the
  foundry by the ship 1.51 / 391, the mouth's widest view 1.47 / 321, the aisle 1.43 / 281, the gantry 1.63 / 336, the
  courtyard 1.33 / 322, the furnace 1.44 / 299, the quarter 1.42 / 291 (0.34-0.54 M triangles; the Market 0.45-0.73 M).
- `tests/moonfoundry.test.js`: the kit (a broken moon's hole open, its craters out of it, the courtyard at the lip), the
  shifted lens, the four views; the world registered off the route and charted, the named people standing on what is
  drawn, the apron flat and clear overhead, the way in clear, the stair climbing to the gantry, the gantry and its branch
  holding all the way and clear, over the lip into the courtyard, the bowl's deck; pillars, moons and furnace solid, the
  roof out of reach, the mesh and collision budgets, the drone, the pour's bands moving.
- **Left to make it better**: the pictures' machinery is dense pen work everywhere, ours is clean; the courtyard's houses
  are stacked boxes (the pictures heap balconies, stairs and plants); the hung moons don't turn (Wen says they do, at
  night); the houses can't be entered; the floor has no grass or bushes where the third picture has them; the far moons
  are plain spheres; no wildlife of its own beyond a flock.

## The Underside (`underside`, off the route, October 2026)

An immense shelf of pale limestone jutting east from a mountain far out over a sea of cloud, and a town hung from its
underside (`src/levels/underside.js`, after `references/The Underside/`; its views in the References,
`reference-underside.js`; the shapes and the look in `underside-kit.js`, shared with them: references.md "The
Underside's pictures"). On the galactic map from the start (names.js `SIDE`), no story to follow (`story.manual`: the
page names the place and closes on the tip deck). `?level=underside`.

- **The layout** (north -z, east +x; `SHELF`, `STAIR`, `GALLERY_S`… exported for the tests): the mountain's face runs
  north-south at x ≈ 2; the shelf juts east from it, its top (y 40, a meadow laid on the rock, `MEADOW`) from z -60 to
  -230, out to its tip at x ≈ 170, its underside at y 12 with lobes a few metres lower. The ship lands on the top, its
  hatch to the south edge. **The great stair** is cut into the mountain's face south of the shelf: 190 steps from the
  top's south-west corner down to a landing jutting from the face (y 2), its parapet on the open side, lamps up it.
  **The rope walk** runs back north from the landing along the stair's rock into **the town** under the shelf (y 2):
  the south gallery along the south face, three cross decks north to the north gallery (their lanes kept clear, rows of
  timber houses along their sides), the Bell Deck across the middle one (stalls in a ring round the bell hung from the
  rock), the tip deck out past the tip, over nothing (benches, herbs, a cluster of lamps); the basket deck below the
  south gallery (y -6), out over the cloud, down a timber stair. **The timber stair** climbs the north face in ten
  switchback flights to a bridge onto the top: a loop. Below the decks the town goes on down in scaffolds, houses and
  banners out of reach (the kit's `town()` in the faces' frames, drawn only).
- **The houses**: white plaster pods (`pod`): drops hung from the underside down to the decks (round the Bell Deck, at
  the galleries' backs), bulbs hung free between the decks, eggs and domes on the faces' ledges, domes on the top;
  rows of timber houses (salt-harbour-kit's `houseStack`) along the galleries' backs and the cross decks' sides.
  Banners fall from every open deck edge, 16-44 m; five baskets go up and down their ropes (`lifts`, moved in
  `update`), others hang still.
- **Solid as drawn**: the shelf (one slab, its underside split off in a deeper stone: `splitFaces`), the mountain (its
  face beside the stair kept smooth), the stairs and their parapets, the meadow, the decks, their rails (a traveller's
  body stops at the top rail: `tests/underside-world.test.js` `fits`), the houses and the stalls. Drawn only: rods,
  struts, ropes, banners, baskets, lamps, the town below the decks, the far rocks and the far shelf, the cloud. The
  ground is nothing (-600): a fall into the cloud (under y -70) puts you back. Contact audit: feet sink 4, hover 0,
  climbs inside 0, walks through 5 (a hung house's crown up in the rock). Collision ~174 k triangles (the mountain's bulk solid too: what overlaps its face is the same rock).
- **The cloud**: three instanced puff meshes by distance (`cloudPuffs`, `puffGeo`: gently lumped, the far ones
  lumped least: Vael II's sharper lumps read as ice floes from above) on a deck, 110 m under the town.
- **People**: Zazie of the Sealed Hangar (who doesn't trust down) on the south gallery, Kip of the Signal Market on
  the basket deck, Tiv of the Sky Stones at the tip (their own words, `talk.listen`, no errands); six of the town's
  folk with toned lines (Vael II's tongue, `lang: 'arzach2'`), a crowd in the Salt Harbour's cloaks
  (`COSTUMES.underside`) walking the galleries and cross decks, gathered on the Bell Deck and the tip, at the rails.
- **Light and hours**: `UNDERSIDE_SKY` (a golden morning: the landing hour is 7:36, the low sun from the east-south-east
  lighting the south face and the tip and reaching in under the shelf; a rose dusk; an indigo night with the windows and
  lamps lit). The lamps' pools are warm (`lampTint`), faint by day and full from dusk (the level sets `uLampsOn` by the
  sun's height). A pale moon. Two flocks (white birds round the town, dark ones over the top), motes. Sound: footsteps
  on stone, the `highwind` ambience.
- **Choices made**: the playable shelf is one shelf with the pictures' two vantage points as its two stairs (the
  stone stair south of it as pictures 1 and 3 stand, the timber stair on its north face looking back as 2 and 4); the
  morning instead of the pictures' afternoon, so that the sun's path (azimuth 30° at 6:00) lights the south face the
  way in; the town's main level one walkable layer with the rest of its depth drawn only (the Handheld budget).
- **Cost** (Mac M4 Pro, headless Chrome on Metal, 1280 × 720, the Handheld preset at render scale 0.75 without dynamic
  resolution, a synced loop of `renderFrame()`s closed by a readPixels, the median of 5 rounds alternating with the Signal
  Market, the machine shared with other agents): the Market (the budget) 2.79 ms / 597-692 draws at its start, 2.83 /
  334-590 in its street, 2.47 / 312-617 far down it (0.44-0.77 M triangles); the Underside by the ship 2.38 / 282-300, on
  the great stair 2.58 / 243-371, on the rope walk 2.28 / 221-353, on the south gallery 2.33 / 198-305, the Bell Deck
  2.42 / 180-287, the tip 2.14 / 188-214 (0.57-1.04 M triangles: the cloud's puffs are most of them). Under the Market's
  frame time with half its draws; more triangles. The build in node: ~550 ms, in steps (load-steps.js).
- **Left to make it better**: the pictures' town is far denser and warmer (every balcony crowded with people and pots,
  timber lit by the low sun, stairs and ladders between many levels); ours has one walkable level and a drawn one
  under it. The shelf's underside and faces in shade read flat (the shade printed flat); the pictures' pillows of rock
  have dark creases. The mountain is big plain cliffs. The banners don't move in the wind; the baskets carry nobody;
  the far shelf's town is a sketch. No interiors.
## The City Floating in Space (`spacecity`, off the route, October 2026)

`src/levels/space-city.js`, after the pictures in `references/The City Floating in Space/` (their views:
references.md; the shapes and the look: `src/levels/space-city-kit.js`, shared with the views). A city of rounded adobe
houses in cream, salmon and coral heaped on islands that float in the black of space, joined by pale arched bridges,
their undersides hung with dark machinery and cables dangling into the void; stars all round, below as well as above
(rendering.md "Space"); a great pale planet hangs to the north over the roofs. On the galactic map from the start
(names.js `SIDE`, one entry at the end of each shared list), `?level=spacecity`.

- **The layout** (north is -z, `ISLANDS`, `BRIDGES`): the ship lands on the Pier, a round dock at the south (deck y 0).
  A bridge north to the Gate Quarter and its lane between heaped houses, washing over it; the broad Market Bridge,
  crowded, to the Market island in the middle (its plaza of stalls under awnings and tables round lamps, `PLAZA`); from
  the market east up to the Towers (y 6), west down to the Garden terrace (y -4: dark round trees, benches, an
  overlook), north to the Balcony island, whose dark teal railing looks out over the void at the far islands and the
  planet (the pictures' composition). Twelve far islands round it all, 150-500 m off and from 90 m below to 70 m above,
  some joined by bridges: drawn only, no shadows, no collision.
- **No ground**: `ground.heightAt` is -Infinity (as the Sealed Hangar); you stand on the decks, the bridges and the
  houses, found by the physics as meshes. Each island has a parapet round its edge, open where a bridge lands (the
  Balcony's north edge has the railing). Over it you fall into the void, and below `UNSAFE_Y` (-40 m, about a second
  and a half of falling) `level.unsafe` puts you back where you last stood. No jets, no mount; the game's own gravity
  (the pictures' cables and washing hang straight down: nothing there says the gravity is low).
- **The houses** (`quarter` with the world's `LANES`): each island keeps its lanes from bridge to bridge and its squares
  clear; the houses face the nearest lane, and the farther from it they stand, the more storeys they carry (`levels`),
  so the islands heap up toward their middles and backs as in the pictures. Roofs carry trees, chimneys (solid),
  antennas, clutter; awnings and washing over the lanes.
- **The sky by the hour** (`SPACECITY_SCRIPT`): black at every hour; the light warm by day, rose at dusk, the planet's
  cool light at night. The planet (`PLANET`, 44° across, plain) is lit by the city's own sun (`uSpaceSun` off), so it is
  two-thirds lit in the morning (the arrival hour, 8:30), a thin crescent through the afternoon and nearly full at
  night; its dark side a dim mauve (`uSpaceNight`), a disc against the stars. The sun crosses the sky and at night is
  under the city (you can see it below the islands); the lamps, the lit doors and windows and the glows under the
  islands are the night's light.
- **People**: Kip of the Signal Market on the Market Bridge (a courier, in a city of nothing but bridges), Nima of the
  City-Shaft sweeping the Gate's lane, Madame Sel of the Signal Market listening to the planet from the Balcony (their
  own words: `talk.listen`, no errands); five of the city's folk with toned lines (the City-Shaft's tongue), and a crowd
  in the City-Shaft's clothes (`COSTUMES.spacecity`) over the bridges, along the lanes, round the plaza, at the railing.
- **Life and sound**: no birds in space; glowing dust hanging in the light (motes). Footsteps on stone, the ambience
  `city`.
- **Built** in kits by island (each frustum-culled on its own), the bridges in one, the far islands in one; ~250 meshes,
  ~0.42 M triangles (the far islands 0.19 M: their trees one ball of a few faces, no flower boxes); built in steps in
  ~0.8 s in node. Solid as drawn where walked: decks, parapets, bridges and their parapets, houses, chimneys, the pipe
  stacks over the decks, tables, benches, crates, bollards. Drawn only: everything under the islands (you fall past
  it), the trees (flora), awnings, washing, lamps, the diners. Contact audit: feet sink 16, climbs inside 113 (awnings,
  washing and wall lamps in front of the walls they hang on; the diners at their tables; the machinery under the
  islands where the bridges' arches meet it, out of reach), walks through 0.
- **Cost** (Mac, headless Chrome, 1280 × 720, Handheld at render scale 0.75 without dynamic resolution, 90 synced
  frames a round, 7 rounds; the machine heavily shared with other agents, so the rounds spread 5-10 ms and only the
  comparison in the same run means anything): the Signal Market (the budget) median 9.9 ms / best round 5.9 / 366 draws
  at its start, 8.2 / 5.0 / 329 in its crowd; the city by the ship 9.1 / 5.9 / 366, the Gate's lane 9.0 / 6.5 / 347, on
  the Market Bridge 5.9 / 5.0 / 256, the plaza 6.5 / 5.1 / 212, the Balcony 7.8 / 4.6 / 182, looking back south over
  the whole city 5.2 / 4.6 / 401 (0.44-0.64 M triangles in view; the Market 0.44-0.67 M).
- `tests/spacecity.test.js` (the kit, the sky, the views) and `tests/spacecity-world.test.js`: registered off the route
  and charted; built without errors; the Pier flat under the ship; every island's deck and every bridge underfoot from
  end to end and clear; the way from the ship along the lanes and over the bridges to the Balcony, the Towers and the
  Garden clear; the plaza open; a parapet round every island but at the bridges; the void below unsafe, the decks safe.
- **Left to make it better**: the pictures' houses carry dense small detail (pipes, vents, signs, plants, washing by the
  dozen) and their decks crowds; ours are clean rounded blocks. The pictures' houses also step down the islands' sides
  below the decks, and their islands sit at many more heights with stairs between them; ours stand on six decks at
  three heights. The houses can't be entered; nothing moves under the islands (a lift, a cable car would suit it); the
  far islands are only seen.

## The Signal Market at night (`bazaar` after dark, October 2026)

The night sheets (`references/The Signal Market - Night`, the views: references.md "The Signal Market at night") are
the Signal Market itself: the author's prompt is "the Signal Market at night", an alien screen market at midnight.
So they are the bazaar's own night, not a world of their own: its street, story, quests, cabs and people are as they
were, and by day nothing changes (a day screenshot before and after is the same but for the walkers). After dark:

- **The billboards turn into the night sheets' screens** (`makeMaterial({ nightPaint })`, materials.js NIGHT_PAINT:
  the geometry's `aNight` attribute, its colour by night and how far it glows then, mixed in by `uNight`). Every
  poster's part (bazaar.js `poster`, its `plate(g, m, role)`) carries its night colour by its role in the picture:
  the screen (`bg`), the figure (`fig`), its dark marks and its pale ones. `nightPaint(seed)` (market-night-kit.js)
  picks the sheets' combinations for the poster's picture: a head on violet, scarlet or pink; a planet on cobalt,
  orange or emerald; glyphs on lemon, white, magenta or acid green. The towers' great signs, the shop signs, the
  forward signs all light up; the silent tower stays under its dark covers (its story).
- **The sky and the walls**: the colour script's night (`MARKET_NIGHT`) is a black-indigo sky, a dark indigo shade
  and a dim moonlight, so the towers are dark masses round their lit screens and the stars are out.
- **The lanterns light pools**: the six nearest the traveller (`NIGHT_LIGHTS`) become local lights reaching 9 m, and
  the street's surfaces (paving, sidewalks, shops, walls) take their warm apricot where they light them
  (`lampTint`, `LANTERN_TINT`); `uLampsOn` follows the night. By day the level has none of them (the shader looks at
  no light then). The Undertower's own lights stay in the list.
- **Half the crowd goes home** (`crowdAway`: crowd.js `away`, set by main.js each frame): each person by their own
  share, and only while far from the camera (over 45 m), so nobody vanishes in front of you; while gone they are
  neither drawn nor moved. Those who stay walk and talk as by day.
- **Steam off the stalls** (`Puffs`, one draw, 50 puffs over seven counters), drawn only after dark.
- **Cost** (Handheld preset, render scale 0.75, 60 frames × 7 rounds, the day and the night alternated four times
  at each place, the median; Mac M4 Pro, headless Chrome): the spawn 1.51 ms by day, 1.48 by night; the wide view
  from 27 m up 1.24 / 1.19; the crowd 1.29 / 1.30; by the stalls 1.37 / 1.39; the square 1.62 / 1.58. Draw calls are
  the same by day and night (a shadow cascade's cycle of 360 / 598 / 691 at the spawn, before and after). The night
  costs what the day does: the lights' loop is paid for by the crowd that goes home.
- `tests/marketnight.test.js`: the posters carry their night colours and glow, by day their colours are the old
  ones, the lights come only at night and leave the temple's alone, the crowd thins at night, the steam is hidden
  by day.
- **Left**: the sheets' lane is narrow and packed with screens at eye level (CRTs on crates, small terminals); the
  street's own screens are its billboards and shop signs, high or at the shops' tops; a lane of stacked screens in
  one of the back alleys would bring the sheets into the street but changes the market's layout (not done). The
  pools of light take one colour (the lanterns'), not each screen's.
