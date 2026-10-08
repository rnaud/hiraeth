# The living world: reactive scenery, wildlife and flora

What notices the player: responsive clusters, birds, wildlife, each world's plants, brushing past them.

## Feathered birds (v0.21)

Ambient flocks now draw an instanced body/head/beak/tail and two feathered wings
(three draw calls per flock). Desert birds circle lower and closer at a smaller
scale; distance scaling is capped at 1.7 times their base size.
The Vael mount has overlapping secondary and primary feathers, articulated
shoulders and wrists, folded resting wings, a hooked beak, a fan tail and talons.
Static feather geometry is merged within each moving joint. Tests cover flock
scaling, wing folding, takeoff and the rider seat transform.

## Responsive worlds (v0.22)

Walk near the new clusters or look toward them. Each responds gradually,
passes one delayed pulse to its neighbors, and settles after you leave.

| World | Response |
| --- | --- |
| Desert | Salt blooms open, turn turquoise and release a brief cloud of spores. |
| City-Shaft | The makers' listening stones wake along the terraces and recognize returning visits. |
| Vael | Tall pale fronds turn toward visitors and take on a lavender tint. |
| Hangar | Brass-bound listening stones stir and pass amber signals, including in the other gravity zones. |
| Viridel | Larger flowers unfold, turn pink and turn toward the player. |
| Lorn | Fungi shrink away, glow turquoise and release spores. |
| Signal Market | Listening stones along the shopfronts, and medallions on selected billboards, wake with changing glyphs. |
| Atelier | Pale paper-like growths open and pick up a soft teal glow. |

The three small lights/seeds recur across living and mechanical objects. The
makers' listening stones (a seed-shaped carved stele on a plinth, a brass rim, three
brass-set lenses) never show words: waking, their tall face fills with light and a
line of glyphs in the makers' manner, chosen by encounter history: the makers' mark
between two strokes (a first meeting), the mark twice (again), the mark under two
ripples (heard of you in another world). Encounters persist
in `moebius.encounters.v1`; visiting another world can change a first greeting.
Reset progress clears that memory. Returning plants retain a faint glow.

`src/reactive-world.js` owns sensing, delayed propagation, local gravity placement,
rendering and save handling. Occlusion checks run five times a second near the
player. Geometry is grouped within each object, distant clusters are hidden,
and spores share a pool capped at 72. Menus and photo mode pause reactions.
The new scenery has no collision so it does not block established routes.

Verification includes reaction/cooldown/occlusion/memory tests, placement checks
against every world's actual collision geometry, and browser checks of plant
and screen behavior. Performance on a physical iPhone still needs confirmation.

### Wildlife, the tool, crowds and fixes (v0.31)
- **Wildlife** (`src/wildlife.js`, `src/wildlife/`): every world has 2–3 species
  (11–14 creatures), each with its own surprise when scared: the desert's puff
  lizard balloons up and floats away, Vael's bone kite unfolds into a paper
  kite, Viridel's pyramid tortoise raises its shell into a temple, and so on.
  Sprinting, hard landings, passing vehicles and darts scare them; the ray stuns
  them. Creatures that leave return out of view 14–28 s later, sleep beyond
  140 m, and update coarsely beyond 60 m.
- **The tool** (`src/blaster.js`): a hitscan paralyze ray (40 m, energy gauge)
  and a ballistic foam dart that follows the level's gravity. Anything can
  register in `src/targets.js` (`registerTarget`) to be hit; levels can add
  their own through `level.targets`.
- **City crowds** (`src/crowd.js`, `src/crowd-shader.js`): one CPU simulation
  drives 586 people in the Signal Market and about 1,400 in the City-Shaft, in
  talking circles of 2–5, strolling pairs, rail leaners and edge sitters.
  Mid-distance people are one GPU-posed `InstancedMesh` (`makeMaterial({ crowd:
  true })`), the far tier is coarser, and a pool of 4 full NPCs is swapped in
  within 9 m. Only people within 35 m cast shadows. Levels opt in with
  `level.crowdSpots()`.
- **Desert** (`src/desert-landmarks.js`, `src/desert-sites.js`): dune and ridge
  relief is Gaussian-smoothed, so the hoverbike stays down at boost
  (`tests/dunes.test.js`). It adds the landmarks from the reference pages:
  - in the golden dunes, a half-buried leviathan, a crashed hull with a salvage
    camp, the traveller's camp and sail tents;
  - in the rose canyons, a rose gorge with suspension and rope bridges, and an
    umbrella grove;
  - on the salt flats, a petal station, turquoise salt lagoons, a telegraph line
    and a radio-dish array.
- **Fixes:**
  - Fast movement is swept in sub-steps, with an escape when the player is
    embedded. Vehicles sweep too, and dismounting picks a free spot.
  - The scout drone flies with damped steering and terrain clearance.
  - Climbing knees bend toward the wall.
  - Hover trails stay above the ground and out of walls.
  - NPCs have bare hands unless gloves are requested.
  - The BVH worker fallback rebuilds collision from the scene instead of
    building an empty tree.
- **Performance:**
  - `tileScene` now also tiles large merged and instanced props, as children of
    the original. Before, a merged mesh touching the 24 m fine cascade was drawn
    whole in every shadow pass.
  - Small-prop tiles beyond 520 m are skipped in all passes.
  - Uncapped frame times on the reference Mac are 3.0–7.0 ms in every world.

## Flora: every world's own plants, in clumps
- **Species** (`src/flora-species.js`, built with the small kit in `src/flora-kit.js`): each world
  has five or six plants of its own, drawn in its palette and never shared (the desert's bell
  totems and sand candelabras, the rim's lantern agaves and fan palms, Vael's spiral horns and
  pod lanterns, the Sky Stones' pagoda reeds and sky bladders, the plateau's bolt cacti and
  periscope trees, the Buried Machine's chimney stalks and ash gourds, Viridel's parasol leaves
  and bulb towers, the Garden of Spheres' orb lilies and bead trees, Lorn's stilt fungi and
  organ pipes, the Deep Wood's lantern pods and candelabras, the Signal Market's potted strap
  palms and lamp flowers, plus the small flowers, cushions and tufts at their feet). A plant is one
  geometry painted one flat colour per part (vertex colours), so it is one instance; the tall
  stems sway (`makeMaterial({ sway })`, the tip moves, the base stays). Large plants (3–8 m) are
  solid: a cylinder per trunk goes into the collision (`physics.addCollider`), so you bump into
  and can climb them; small ones you walk through.
- **Placement** (`clusterScatter`, pure, in `src/flora.js`): clump centres are darts thrown over
  the world's regions (`FLORA_WORLDS`), kept apart and thinned by a slow noise; each clump is a
  dense patch of one species, thickest at its heart, with a few companions (`with`) round its
  rim; the large plants stand in small groves with their companions at their feet; a few loners
  grow between. The desert also prefers species by region (totems in the rose canyons, salt
  stars on the flats).
- **Where nothing grows** (`buildFlora`, run in `main.js` once the collision, the ship and the
  people exist): a plant needs gentle open ground (the heightfield, or a ray onto the real
  geometry on the rim, the plateau, the stone tables and the pavements); not on a rock or a
  roof, not under anything, not in deep water (reeds and swamp plants may wade), not on the
  places a level lists in `level.floraAvoid` (paths, the pond, the canyon, the lake, the city's
  paving), and not on `floraKeep`'s spots: the spawn, the ship's site and ramp, everyone's
  standing place, the crowd, the boxes, the relics, the story's goal, portals and the reactive
  plants.
- **Drawing**: one InstancedMesh per species. Plants are filed by 32 m cell, and each frame
  `Flora.update` keeps the cells in view within the species' distance (60 m for ground cover
  up to 420 m for the large plants), plus those just behind you for their shadows; the mesh is
  only refilled when that set changes. So a world's flora is about six draw calls per pass,
  wherever you are. Ground cover casts no shadow; small plants stay out of the far cascade.
  The presets: `floraFar` (Handheld 0.65, Low 0.8) shortens the distances and `floraDensity`
  (Handheld 0.55, Low 0.75) grows fewer small plants per clump when the world loads.
- Viridel's even scatter of 3500 identical flowers is gone, and the desert's ochre scrub now
  grows in thickets; both keep their old random draws, so everything placed after them stays
  where it was.

## Brushing past plants (`src/brush.js`)
Plants used to be shoved aside by the traveller's position and speed this frame: up to a metre
at chest height when walking, snapping back the moment you were past. Now a plant you pass leans
a little away from you and springs back with a light wobble, like something brushed.
- **A damped spring per plant, with no state of its own.** Each plant is a spring
  (`BRUSH.freq` 2.3 Hz, `damping` ζ 0.4: one small overshoot) driven by the touch of the feet,
  stronger the closer (`brushTouch`) and the faster (`brushPace`: 3 cm standing in it, about 10 cm
  walking, 16 cm running, at the tip of a 1.3 m plant). Its lean now is the touch over the last
  0.9 s convolved with the spring's impulse response. `BrushTrail` keeps the traveller's path (14
  samples 65 ms apart, the newest following the feet) and gives each sample its pace times the
  kernel's weight for its age (normalised, so a steady touch is the steady lean and nothing flickers
  as the samples shift); the vertex shader (`BRUSH_GLSL`, `brushLean`) sums the samples' touch on
  the plant. Plants further from the path than its circle (`uBrushBound`) skip the loop.
- **Where it bends:** a small plant from its foot, the tip most (its height from `swayH`, the
  species' geometry); a large one (`swayLarge`) only parts its low leaves round your legs, the trunk
  and crown still. Grass blades use the same sum (`GRASS_BRUSH`): they part round the feet and
  spring back.
- `tests/brush.test.js` walks past a plant: the peak lean, how quickly it comes, the overshoot,
  the settling, the steps between frames, closer and faster, standing still, riding.

## Flowers with room to open (`bloomRoom`, `src/reactive-world.js`)
The waking flowers spread their petals as they wake, and up to about twice as wide again in the
traveller's fluid; placed near the spawn, the people, the relics and the goal, they opened into
walls, rocks, the tree in Qanat and each other. Now, where a flower is placed, twelve rays go out
round its bloom (at the bloom and a little above, for the tips) and one up over it (`bloomRays`).
`bloomRoom` reads them: the flower leans away from what is close (up to 0.3 rad, `BLOOM.maxTilt`,
a group under its root), its petals and its stem's growth open only as far as the room left with
12 cm to spare, and a stirred stem swings less. Once all are placed, each also keeps clear of its
neighbours (of their petals open awake, or half the way to them: `fitBlooms`). A spot with room
for less than 60 % of the open flower (`BLOOM.least`; a shy fungus, which rests open, needs all of
it) is given up after two steps away from the wall. The flora keeps clear of each flower's reach.
`tests/reactive-world.test.js` puts a wall through a world's flowers and blooms them all.

## The world's chemistry (v0.98)
`src/chemistry.js` holds a few general rules by which the world's systems act on each other without
the traveller (Breath of the Wild's chemistry), in place of per-scene scripts. It reads the target
registry (`src/targets.js`), so anything that registers a `kind: 'flammable'` target (the
`Flammables` spots, the temples' `Bramble`, which reports `burning()`), a `kind: 'ember'` one or a
foe takes part. `main.js` builds it after the foes and runs `chemistry.update(dt, player.pos)` next
to `flammables.update`; the rules look only within 140 m of the traveller, 8 times a second
(`CHEM.hz`), the embers fly every frame (12 at most).
- **Fire spreads.** A burning spot lights the dry brambles and unlit lamps near it after 0.45–1.5 s
  (nearer: sooner). `spreadReach(windDir, windSpeed, from, to)`: 2.2 m edge to edge in still air,
  up to 2.2x straight downwind and 0.35x upwind in a full wind (2.5 m/s, a windy world's breeze),
  times the fire's heat (a flared camp fire 2, a bramble 1, a lamp 0.45); a lamp catches at 0.6x.
  A burnt bramble cannot catch till it has grown back, a lamp just put out not for 20 s
  (`BURN.relight`). No more spreads while 10 fires burn or are about to (`CHEM.maxSpread`;
  `BURN.maxLit` is 14). The wind is the world's own, `player.wind` (set from the sky's slowly
  turning wind and the weather in `main.js`).
- **The wind carries embers.** A burning bramble throws embers on the wind now and then (more in
  a stronger wind); a gust of the fan through one (`Flammables.onGust`) no longer blows it out but
  throws six embers down the gust. They fly as the fluid tool's glow dots (`emberStep`, the same
  drag and fall) and light the dry bramble they come down on. A gust still blows out lamps, flares
  and the yard's fire.
- **Creatures flee fire.** Every fire calls `wildlife.scare(p, r, life)` (6 m, +2 per heat): a
  fright that lasts a moment, read by `disturbanceFor` like a sprint, so the creatures play their
  surprise and run.
- **Foes and fire.** A foe touching a fire takes it (its target's `onHit('fire')`, at most once a
  second). Lit (by a fire, or by an ember glob: the chemistry wraps each foe target's `onHit` to
  note it), it sets alight the dry brambles it walks into for 4 s.
- **Stilling and bloom.** Flammables accept `'stun'` (a stilling glob puts a fire out; a bramble
  keeps what is left of it, charred) and `'bloom'` (a burnt bramble grows back at once, also from a
  bloom glob landing beside it: `'tool:bloom'`). A burning bramble stays a target while it burns.
- The desert camps' three brambles stand in a short hedge 3.5 m apart at the camp's edge, so one
  alight lights the next, and a camp fire flared lights the hedge when the wind blows that way.
- The temple's bramble only takes part through its own `hit('fire')` (the logic's `light`), so the
  fire never solves or blocks a temple in a way the player's ember could not.
`tests/chemistry.test.js`: the pure rules, a row of brambles burning downwind and not upwind, the
cap in a thicket, a lamp catching, stilling and bloom, a creature frightened, a foe target given
the fire, a lit foe lighting a bramble, the gust's and the wind's embers, a temple bramble.
