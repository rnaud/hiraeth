# Moebius / Sable — three.js shader PoC

**Play it:** https://rnaud.github.io/moebius/

A small third-person desert exploration prototype. The point of it is the
rendering: a "ligne claire" look in the style of Moebius and the game *Sable*.

```bash
npm install
npm run dev     # http://localhost:5173
```

Controls: click to capture the mouse · WASD move · Shift run · Space jump ·
hold Space in the air to glide · mouse wheel zoom · Esc releases the mouse.
**F** toggles the FPS counter. **H** shows or hides the controls help (hidden by default). **E** interacts: whistle for the level's mount (or hail a taxi), get on, get
off. **Q** (or touch **ping**) launches a tiny backpack scout toward your next
objective. It waits a few metres ahead, labels the destination and returns after
five seconds; ping again to refresh it. The guide follows quest progress and
portal routes, with local obstacle avoidance. **L** opens the level picker. Each level's controls are listed below.

## Install on iPhone

Open [the game](https://rnaud.github.io/moebius/) in Safari, tap **Share → Add
to Home Screen**, leave **Open as Web App** enabled if shown, and tap **Add**.
Launch the **Moebius** icon to play without Safari's address and bottom bars.
The game fills the screen; controls account for the notch and home indicator
in portrait and landscape. An internet connection is needed to load the game.

`public/manifest.webmanifest` uses relative URLs so installation works under
GitHub Pages' `/moebius/` path and at a site root. iOS metadata and a 180 px
Apple touch icon are included. Regenerate the icons with
`python3 scripts/generate-icons.py`.

## Collision

`src/physics.js` bakes every static mesh of the level into one world-space
geometry with a [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)
BVH. Moving things, plants and the desert heightfield are flagged
`userData.noCollide`; the heightfield keeps its own exact lookup.
- **Characters:**
  - a downward ground ray lets you step onto anything lower than 0.6 m and
    stand on rocks, mesa tops, roofs and domes;
  - a capsule from step height to the head is pushed out of walls and
    ceilings, and you slide along walls.
- **Bike and taxis** use the same rays and capsules.
- **Camera:** a line-of-sight ray pulls it in front of walls, so it never
  clips inside buildings.
The panel on the right exposes every shader parameter. It also has style
presets (Moebius / Sable / Animated ink) and debug views of each G-buffer channel.

## Levels

Opening the page with no `?level=` shows a **level picker**. Press **L** to
reopen it at any time, or **1–6** while it's open. Each level is a module in
`src/levels/`, registered in `src/levels/index.js`.

| # | Level | After | Getting around |
|---|---|---|---|
| 1 | **The Desert** (`desert`) | *Sable* (Shedworks) | walk, climb, glide, hoverbike |
| 2 | **The City-Shaft** (`incal`) | *L'Incal* (Jodorowsky & Moebius) | jetpack, climb, flying taxis |
| 3 | **Arzach** (`arzach`) | *Arzach* (Moebius) | the flying bird, climb |
| 4 | **The Airtight Garage** (`garage`) | *Le Garage hermétique* (Moebius) | portals, shifting gravity, jetpack |
| 5 | **Edena** (`edena`) | *Le Monde d'Edena* (Moebius) | climbing with stamina |
| 6 | **Perdide** (`perdide`) | *Les Maîtres du temps* (Laloux & Moebius) | hover-skiff, wading, caves |

- **The Desert:**
  - dunes, mesas, giant skeletons and monolith rings;
  - three regions: golden dunes, rose canyons and salt flats;
  - wind-blown sand and cloud shadows;
  - **E** whistles for the hoverbike.
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
  - flying taxis, landing pads, cables and an acid lake at the bottom;
  - **jetpack:** hold Space in the air for about 10 s of thrust; you lean forward into the flight when steering;
  - **E** hails a taxi, then gets in. Driving: W/S throttle, A/D steer,
    Space up, Shift down.
  - taxis are solid: you bump into their sides, and you can land on a roof
    and ride along; a taxi left idle for 30 s flies back into traffic.
- **Arzach:**
  - a bone-white world of needle spires, stone arches, floating ruins and a
    lone tower;
  - **E** whistles for the bird. Flying: A/D bank, W dive to gain speed, S
    pull up, Space flap.
- **The Airtight Garage:** three zones joined by glowing portals. Each has its
  own gravity, and the ink style switches when you cross between them:
  - **Grubert's plateau:** normal gravity, Moebius style;
  - **the upside-down quarter:** a city hanging under a slab, where gravity
    pulls you up; Animated ink style;
  - **the ring:** a cylinder habitat lit through a slit in its roof, where
    gravity points outward so you walk all the way round; Sable style.
- **Edena:**
  - flat colours and thin lines, light stipple only;
  - giant umbrella trees (climb the trunk and stand on the canopy), step
    pyramids and white android ruins with glyphs.
- **Perdide:**
  - a twilight swamp with inked water;
  - crystal forests and egg clutches that glow;
  - carnivorous plants that snap when you get close;
  - a crystal cave lit from within;
  - wading into deep water puts you back on dry ground; **E** whistles for
    the hover-skiff.

**Climbing works everywhere:**
- push into a steep wall to grab it;
- W/S climb, A/D shuffle sideways, Shift climbs faster, Space jumps off;
- reaching the top pulls you up over the edge;
- stamina runs out after about 20 s on the wall.

**Gravity:**
- the player moves in a local frame (up, forward, right);
- the "forward" direction is carried along smoothly as "up" changes, so the
  controls and camera don't spin;
- the camera rolls with gravity.

## How the look is built

Three passes per frame (`src/main.js`):

1. **Shadow maps.** There are two orthographic cascades that follow the
   player and snap to texels, so shadows don't shimmer:
   - a sharp 4096² map covering ±220 m;
   - a 2048² map covering ±1150 m, so mesas shadow distant dunes. It
     refreshes every third frame.

   The comparison is done by hand in `materials.js`, and the two maps blend
   at their borders.
2. **G-buffer (MRT).** Every object uses one surface shader
   (`src/materials.js`). It does no stylisation. It only writes:
   - `RT0.rgb` = flat albedo. This is a plain colour, procedural sand
     patches with rock on slopes, or horizontal **strata bands** for mesas.
   - `RT0.a` = light term: half-lambert × cast shadow. Cast shadows are
     clamped just below the toon threshold, so the post pass can tell
     "in shadow" apart from "facing away".
   - `RT1` = world normal + linear view depth (0 means sky).
   - `RT2` = hatch strokes (single and cross), drawn on the surface itself.
     The strokes come from a triplanar projection of the object-space
     position, scaled by the object's scale. That way they stay attached to
     objects as the camera, or the object, moves.
   - Stroke spacing is measured from screen-space derivatives and snapped to
     powers of two. Each coarser level keeps every other line of the finer
     one, so when you walk away, lines fade out instead of sliding across
     the surface.
   - Faceted rocks get their normals from `dFdx/dFdy`, so they need no
     special geometry.
   - Each stroke is an isoline of a single stroke coordinate:
     - terrain uses a top-down projection, continuous across dune crests;
     - smooth objects blend the three triplanar projections at the
       coordinate level, so the stroke angle turns gradually instead of two
       patterns overlapping;
     - faceted objects use one projection per facet.
   - The same surface frame drives the **stipple** mode (Sable's
     "occasional dotting"): jittered dots whose size and count grow with
     darkness.
   - Architecture can draw object-space **grid lines** (Sable's "gridded
     lines").
   - The terrain gets **Sable-style sand blobs**: small irregular spots at
     three scales that give a sense of scale. They stay below the
     colour-edge threshold so they don't get outlined, and fade out before
     they shimmer.
3. **Moebius composite** (`src/post.js`). All the style lives in one
   full-screen shader:
   - **Ink lines** come from four signals:
     - depth discontinuities, using the Laplacian of *1/z*, which is
       exactly 0 on any plane, so there are no false lines on ground at
       grazing angles;
     - normal creases;
     - albedo boundaries, which outline strata and sand patches the way an
       inker outlines flat colour areas;
     - cast-shadow boundaries.
   - **Line style.** Lines get thinner with distance. The sample positions
     are offset by a noise field for a hand-inked wobble. "Line boil"
     re-rolls that noise at 8 fps.
   - **Two-tone cel shading.** Lit areas show the pure albedo. Shadowed
     areas show albedo × a lavender shadow tint, a very Moebius choice.
   - **Hatching** takes the surface-anchored strokes from `RT2`: pen strokes
     in the shade, and cross-hatching in the darkest areas. Hatching fades
     out with distance. The panel's "hatch anchoring" option switches back
     to the older screen-space strokes for comparison.
   - **Atmospheric perspective.** Fog blends towards the sky horizon colour,
     and lines and hatching fade with it, so distant mesas become pale flat
     silhouettes.
   - **Procedural sky** with a gradient, an inked sun disc with a halo ring,
     and flat inked clouds with hatched undersides.
   - **Paper.** Grain, fibre and a vignette.

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
  - grid lines and alien glyphs on standing stones.
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
  unless you're moving the mouse.

## Time of day

The `Time of day` folder drives sun and moon positions plus a palette
(sky, fog, light tint, shadow tint) keyed through dawn, day, dusk and night
(`src/timeofday.js`). At night the moon becomes the shadow-casting light,
as in Sable, and stars appear. The sun and moon are drawn separately. Around
the moment the light switches from one to the other, the shadow tone
converges to the light tone, so shadows fade out and back in instead of
jumping. "Hours / minute" runs the cycle. Character
poses update at 12 fps ("stop-motion anim") while movement stays smooth.

## Playing

- **Continue:** your world, position and time of day are saved every few
  seconds; the picker shows a Continue button.
- **Settings (O, Esc or ⚙):**
  - graphics quality: low / medium / high;
  - mouse and touch sensitivity, and invert Y;
  - music and effects volume, and mute;
  - reset progress;
  - the developer shader panel is hidden unless you enable it here.
- **Touch:** a floating stick on the left, drag on the right to look, and
  buttons for jump, interact, run, sketchbook and worlds. Low graphics by
  default.
- **Ending:** find all six story pages and all 30 relics for a closing page.
  It unlocks a seventh world, **The Atelier**: a blank page with pencil
  sketches of every landmark and the artist at his table.

## Interiors, crowds and the glider

- **Interiors** (`src/interiors.js`): rooms are real geometry, with walls
  that have door and window openings, so the sun's shadow map throws light
  patches inside. Each has furniture and a glowing lamp.
  - **City:** three villas behind the spawn you walk straight into.
  - **Desert:** a carved doorway in front of the masked head leads to a
    glyph chamber under an oculus.
  - **Edena:** a hatch beside the crashed ship opens onto its cabin.
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

## Story, people, sound and weather

- **Story** (`src/quest.js`, `src/levels/content.js`):
  - each world has one quiet goal, marked by a beam of light, with its
    distance in the HUD;
  - a first visit opens a wordless three-panel comic page, rendered live
    from the game, and reaching the goal opens the closing page.
- **Relics:** five per world, often on rooftops, mesas or trees you have to
  climb. Picking one up sketches the moment into your **sketchbook**: press
  **J** to open it. Progress is saved in `localStorage`.
- **People** (`src/npc.js`):
  - two to five per world, wearing the same rider design in their own
    colours, with simulated cloaks near the camera;
  - they walk their routes, stop to look at you, wave, and say a line in a
    speech balloon; shy ones run away if you charge at them.
- **Travel:** every world has a stone gate. Walk through it and the page
  turns to the next world, where you step out of its gate (desert → city →
  Arzach → Garage → Edena → Perdide → desert).
- **Sound** (`src/audio.js`): everything is synthesised with Web Audio, with
  no audio files.
  - Each world has its own lead instrument and a recurring melody, played
    every 16 beats and varied each time:
    - desert: duduk and kalimba;
    - city-shaft: reed and marimba;
    - Arzach: flute;
    - Garage: analog synth;
    - Edena: strings and celesta;
    - Perdide: FM bells.
  - Each also has its own ambience bed: city horns and passing taxis,
    birdsong, frogs and insects, ticking gears, high wind, or rustling
    paper.
  - A generative score per world: its own scale, tempo, pads, bass and
    sparse arpeggios, with reverb.
  - Wind that follows the gusts and storms, and rain.
  - Footsteps that match the ground (sand, stone, grass) and the cloak
    flutter.
  - The jetpack roar, an engine for the bike, skiff and taxis, and bird
    flaps.
  - Chimes for relics, page turns, and a whoosh at the gates.
  - Sound starts on your first click, and **M** mutes.
- **Weather** (`src/weather.js`): each world alternates clear spells with
  its own weather, ramping in and out over a few seconds. You can force it
  from World → weather.
  - Sandstorms: a warm haze swallows the distance, and streaks of sand race
    across the screen.
  - Rain: slanted ink strokes falling over the scene.
  - Fog banks in the city-shaft and on Perdide.
  - Weather drives the wind on the cloak and the sound.
- **Loading:** the world is built in stages behind an animated inked loading
  screen, and every shader is compiled before the first frame, so there's no
  hitch when it appears.

## The print look (default preset "Moebius print")

Modelled on a classic Moebius desert plate:
- a flat cerulean sky printed with fine dots, and a bank of inked cream
  cumulus sitting on the horizon;
- pen-dotted sand with pebbles, ochre scrub bushes, and blue-grey hatched
  shadows;
- fine, even ink lines, and fold lines drawn down the cape;
- the wide-brimmed pointed hat;
- a saucer tower and a pale spired city on the horizon;
- an open plain around the desert start, with landmarks set back from it;
- stroke-textured scrub;
- a heavy-wool cape that falls in long vertical folds and barely moves in
  the wind; only your own motion swings it;
- a print palette for every world: a flat sky over a pale horizon, with
  blue-grey shadows.
- **Sky dots** are placed on the sky dome (azimuth and elevation, with a
  projected cap overhead) and sized through the mapping's screen Jacobian,
  so they stay put and round as the camera turns.

## Drawn textures, lines and depth

- **Drawn patterns** (`pattern` option in `makeMaterial`), all in surface
  coordinates so they stick to the object, and faded out where they'd shimmer:
  - `facade`: windows per storey, some with arched tops, with frames, sills,
    painted shutters, dark glass and a cornice line. Used on the city houses.
  - `tiles`: rows of roof tiles with staggered joints. Used on the terracotta roofs.
  - `leaves`: little scalloped leaf arcs. Used on the trees.
  - `cracks`: a broken Voronoi crack network. Used on the boulders.
- **City silhouettes:** arched doors, iron-railed balconies and chimneys on
  the houses, plus umbrella pines among the cypresses and olives.
- **Line quality:**
  - Interior lines break into short strokes. The gaps are anchored in the
    world, so they don't crawl.
  - The player gets a heavier outline so the figure reads against the page.
- **Aerial perspective:** mid-distance layers lose saturation and drift
  towards the sky colour before the fog takes them.
- **Detail by distance:** hatching and sand dots are finer close to the
  camera and coarser far away.
- **The rider's robe:** a short, front-open skirt of heavy cloth hangs from
  the waist under the cape. It's a second cloth simulation, kicked by the
  leg capsules.

## The hero (v0.15)

After the reference plate:
- **Suit:** a baggy lavender suit. The body swells along its normals in the
  vertex shader, more on the legs, and creases are inked at the elbows,
  knees and waist.
- **Gloves:** salmon.
- **Helmet:** a glass bubble. The `glass` material discards everything but
  the grazing rim and a curved highlight streak, and it casts no shadow.
- **Headset:** blue ear cups, a mic and a gadget cluster with aerials.
- **Radio pack:** blue, with dials, a lens and a sprung whip antenna with a
  ball tip.
- **Belt:** cables loop down to a tan belt crowded with pouches, plus a
  dangling meter.
- **Handheld device:** sits in the right fist, screen towards the eyes.
- **Code:** `src/gear.js`. There is no cape. The jetpack rides behind the
  radio pack.

### Climbing and mantling

The mocap climb loops play by the direction you push: up, down, left or
right, with a hanging idle otherwise. The climber hugs the wall (hips about
0.27 m off it), and each hand and foot from the clip is ray-cast onto the
real wall surface, with two-bone IK pressing it there. Mantling plays the
ledge-climb clip timed to the pull-up, with the hands on the edge.

### Mounts come to you

- **Hoverbike:** whistle (E) and it drives over on autopilot. If it's
  further than 220 m away, it first comes in from 140 m off to the side of
  the view. It brakes into a spot beside you.
- **Bird:** whistle in the air (falling, gliding, jumping off something
  high) and it swoops in from behind and below, faster than you fall,
  catches you and flies on. On the ground it lands beside you as before.

### Footprints

Footprints are boot-sole decals that multiply the G-buffer albedo
underneath. A print is a darker shade of whatever it's on (sand, moss,
stone, tiles) and fades back in. It doesn't touch normals or depth, so it
isn't outlined.

### Paraglider

The canopy is in fixed cells: cream, salmon towards the tips and one blue
cell in the middle. Nothing scrolls or pulses as you fly. It folds away
when you mount.

## The rider (v0.14, the Arzach-style look; NPCs still wear capes)

- **Outfit:** flat blocks of colour (a body colour and a hem band), not gradients.
- **Cape:** a short cape, knee-length.
- **Clutter:** belt pouches, a canteen, a lantern, bells, a bandolier of charms,
  a bedroll with a pot and a rolled map, and a walking stick with a pennant
  (`src/trinkets.js`). The hanging pieces are damped springs, kicked by the
  body's acceleration and the gait.
- **Standing:** an idle layer on top of the Idle clip. The weight settles on
  one leg, then shifts: the hip drops, the shoulders counter-tilt and the free
  knee bends. The stance also narrows, the chest breathes, a hand hooks the
  belt and the head glances around. The foot IK keeps the feet planted.
- **Paraglider:** the hands grip the brake handles (two-bone IK) and the
  canopy rides above them. The risers are re-aimed into the fists every frame,
  and turning pulls one brake down.

## World passes after the books

- **Arzach:** warm peach sand, an aqua sky, rose-mauve shadows, mushroom-capped
  hoodoos and boulders balanced on needles.
- **Edena:** a ligne-claire look via `defaults.look` (thin even lines, flat
  colour, little hatching, no dots). Also great spheres half-sunk in the
  meadow and rows of ornaments on white pedestals.
- **Perdide:** giant fungus trees (violet stalks, softly glowing caps that
  light the swamp) and reeds along the waterlines.
- **The Garage:** pipes with valve wheels and pumps, aerials, cabins, and
  cables slung from the keep, all over a paved plateau.

A world can tweak its default preset with `defaults.look` (post uniforms).

## Changelog

Press **N**, or use the button in settings, for what's new in each version
(`src/changelog.js`; add an entry at the top for every release). After an
update, a note points to it once.

## Errands and travel between worlds

- **Errands:** in each world one villager asks you to carry something to
  someone in the next world: a jar of singing sand, a taxi token, a feather,
  a brass gear, a glass seed, a humming crystal. Greeting them hands you the
  parcel, and the HUD shows what you're carrying. Greeting the receiver
  delivers it and puts a sketch of them in the sketchbook (J, "Errands").
  The errands are defined in `ERRANDS` in `levels/content.js`.
- **Seamless travel:** walk, ride or glide off the edge of a world (past
  ~1850 m) and the page turns into the neighbouring world: the next one
  across the +x/+z edges, the previous one across −x/−z. You arrive at the
  matching edge, at the same place along it, heading inward, and still on
  the mount if you were riding and that world has one. The HUD warns you
  as you get close. The Garage (a ring world) and the Atelier have no edges.

## The Sleeping Observatory (v0.16)

Meet the blue-cloaked traveler beside the desert camp (west of the starting
point). They give you a sketch of the observatory, about 830 m east of camp.
Ride there, then climb the six receding terraces. Each terrace is a place to
rest; three carry fragments of the keeper's story. In the open chamber,
stand beside each lens and press **E** (or tap the touch E button) to turn it.
Aim all three beams at the central receiver. Each aligned beam lights a ring
and illuminates the room. The roof unfolds over five seconds, a constellation
appears, and a comic page records the moment. Glide back to the traveler to
finish the expedition.

The existing masked-head story remains available. The new expedition keeps
its sketch, discovered fragments, lens positions and completion in the same
journal save; old saves pick up the expedition without resetting progress.
Implementation: `src/observatory.js`. Run `node --test tests/observatory.test.js`
for puzzle, save-state and collision checks.

### Phone rendering

The old mobile Auto setting could fall to 0.5× of the capped device pixel
ratio: on a 3× phone that meant just one rendered pixel per CSS pixel. Ink
edges were then drawn from a nearest-filtered G-buffer without final
antialiasing. Mobile Auto now starts at 1×, uses a 0.75× floor and targets
roughly 30 fps. All quality levels composite at their own resolution and use
FXAA on the final colour before scaling to the display. Sky dots are spaced
farther apart and fade at low pixel density. High remains available in
Settings for a fixed full-resolution image on HiDPI phones.

## Performance

- **Background collision:** the collision BVH is built in a web worker.
  The game code itself takes about 0.5 s to load a world.
- **City grouping:** the city's merged town is grouped per terrace level, so
  whole levels can be culled.
- **Distance detail:** trees and roofs far above or below the camera are
  hidden, and trees stay out of the far shadow pass. That cut about 20–40%
  of the triangles per frame.

- **Auto quality** (the default on touch devices): if the frame rate stays
  under 28 fps on touch devices (40 fps on desktop) for about 3 s, the
  resolution drops in steps, down to 0.75× on touch or 0.5× on desktop;
  it climbs back when there's headroom. The current scale shows next to the
  fps counter.
- **Low detail** (Low, or Auto on touch or once it has had to drop): no
  crease shading, no cloud shadows, the near shadow cascade at half rate, and
  villagers' capes simulated only up close.

`src/perf.js` splits the terrain and the big scattered-prop sets into
260 m tiles. Each pass (the view and the three shadow cascades) then draws
only what it can see, and small props are skipped in the far cascade. That
cut the desert from about 13 M to 1 M triangles a frame.

## Beauty pass

Each of these can be toggled or tuned in the panel's **Beauty** folder.
- **Line weight like an inker:**
  - silhouettes are drawn about 1.6× heavier, while creases and colour
    boundaries are lighter;
  - a "pen pressure" noise swells and thins each line along its length.
- **Supersampled antialiasing:**
  - the whole pipeline can render at 1.5× or 2×; the final colour passes
    through FXAA and is scaled to the display;
  - stroke sizes follow, so the lines just get cleaner;
  - the default is 1× on Retina screens, which are already dense.
- **Hatching that follows form:** on slopes the strokes become height
  contours, and on smooth objects the cross-hatch wraps round them as rings.
- **Crease shading:**
  - small screen-space ambient occlusion from the depth and normal buffers;
  - it darkens building bases, crevices and canopy undersides, and adds ink
    accents where geometry closes in.
- **Skies:**
  - posterised gradient bands and sun rays at low sun;
  - per-level planets: toon-lit, cratered, hatched on the night side, with
    optional rings;
  - per-level colour scripts (`sky.script`): day, dusk and night palettes.
- **Layered haze:** distant terrain flattens into a few flat tones, like a
  printed background.
- **Shadows:** a third, very fine cascade (±12 m) around the player keeps the
  character's shadow crisp; it no longer crawls across coarse texels.
- **Local lights:** up to 8 glowing things near the player (crystals, eggs,
  portals, orbs, the jetpack flame) pool light on nearby surfaces, even in
  shadow.
- **Life** (`src/life.js`):
  - bird flocks with flapping wings;
  - drifting motes (dust, pollen, ash, blinking fireflies), drawn as
    depth-tested sprites so they don't turn into ink specks;
  - waving cloth banners;
  - acid steam rising in the city-shaft;
  - swaying flowers in Edena;
  - footprints in sand.
- **The character:** a real human body (Quaternius' Universal Base
  Characters, CC0) dressed as the Arzach rider: tunic, trousers, belt and
  boots, coloured by body region in a skinned version of the inked material.
  The red hood and a cloth cape go on top.
  - **Reshaped at load** (`reshape()` in `src/humanoid.js`) from the stock
    superhero into a gaunt Moebius figure:
    - every vertex is pulled toward the bones it's skinned to, weighted so
      the joints stay smooth;
    - the shoulders come in by moving the arm bones, then the mesh is
      re-bound;
    - the face gets narrower and longer, with a straighter nose, hollow
      cheeks and a firmer chin, and the brows are thinned.
  - **Face ink:** the shader draws fine lines in rest-pose face coordinates:
    the upper lids, light marks under the eyes, nose-to-mouth folds,
    cheekbones and the mouth.
  - **Motion:** mocap from Quaternius' Universal Animation Library (CC0).
    - Idle, walk, jog, sprint and jump clips play on a hidden copy of the
      library skeleton and are retargeted by limb direction onto our rig.
    - Locomotion blends by speed on one shared gait phase, with playback rate
      set from each clip's measured stride, so the feet don't skate.
    - Climbing, riding, gliding and jetpack keep their authored poses.
  - **The human skeleton** is aimed bone by bone along the rig every frame,
    keeping each bone's rest twist. The same body drives the NPCs, in male
    and female versions with varied skin tones.
  - **The cloak is real cloth** (`src/cape.js`): Verlet particles pinned at
    the collar.
    - Structural, shear and bend constraints keep its shape.
    - It feels gravity along the local "up" and drag from the air and wind,
      and it collides with the body and legs.
  - **Toggle:** "mocap animation" in the Time of day folder switches back to
    the procedural gait for comparison.
  - **Foot planting:** when the ball of a foot comes down in the clip, it is
    locked to the real ground where it lands and held there (no slip, no
    sinking).
    - A two-bone IK on the human legs reaches it, keeping the clip's heel
      roll, and the pelvis drops when needed.
    - Swinging feet follow the terrain, and footprints go where the foot
      landed.
    - Planted soles are tilted onto the local ground slope, and footprints
      lie along it.
  - **Climbing:** hands and feet are IK'd onto ray-cast holds on the actual
    wall, in a hand-over-hand cycle.
    - At a ledge, or where the wall leans back into a slope, an animated
      mantle hauls you over onto the top.
  - **Climbing:** keyframed hand-over-hand reaches with opposite high steps,
    plus a landing clip after real falls.
- **Villagers:** each one draws a hood, a wide hat, a head-wrap or bare hair
  (with a top-knot or ponytail), a cape length from none to floor, and
  tunic and trouser colours.
- **Hero landmarks:**
  - the desert: a colossal half-buried masked head;
  - Arzach: a fallen stone colossus and a giant hand rising from the plain;
  - the city-shaft: the Incal and its dark twin above the palace;
  - the Garage: a cathedral of turning gears and pistons;
  - Edena: Stel and Atan's crashed ship;
  - Perdide: the Great Crystal and its stone ring.
- **Softer forms:** towers and trunks get organic bulges and pinches
  (`soften()` in `src/world.js`).
- **Photo mode** (**P**):
  - WASD with Q/E flies a free camera; the mouse looks around, Shift goes
    faster;
  - H toggles the panel, and Enter saves a PNG.

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

## Credits

- Animations: [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html)
  by Quaternius, CC0. This is the full version with the climbing set, from the glTF mirror at
  [Cinevva](https://app.cinevva.com/tools/animations) (UE mannequin bone names). It has
  been trimmed to the 16 clips used here (`public/anim/ual.glb`, 219 KB): locomotion, jumps,
  driving, talking, look-around, the climb loops (idle/up/down/left/right) and the ledge climb.
- Human body: [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html)
  by Quaternius, CC0, with the Superhero male and female models and
  textures removed (`public/anim/human_*.glb`).
- License texts are in `public/anim/`.

Character rendering and scout regression checks: `node --test tests/*.test.js`.

The desert reference pass adds cream radio equipment, a softer lavender suit,
a shallow turquoise mineral basin west of camp, a suspension bridge farther
northwest, and large dish canopies above the dome village. Running and climbing
now use speeds matched to the animation; climb contacts orient palms and toes
toward the wall. The bike parks within boarding range and recalls to a clear
nearby spot if blocked or still travelling after four seconds.
