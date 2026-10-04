# Moebius / Sable — three.js shader PoC

**Play it:** https://rnaud.github.io/moebius/

A third-person exploration world with a "ligne claire" look inspired by Moebius
and the game *Sable*. Its foundation is a world that feels organic, responsive,
mysterious and connected.

## Fundamental world principles

These principles guide future levels, creatures, scenery and interactions.

### The world notices you

Your presence should matter even when you are simply walking, looking or waiting.
A place should reveal signs that it has noticed you, without requiring an
interaction button. Responses can depend on your distance, movement, attention
or previous visits.

### Living things behave like living things

Plants and flowers may turn toward you, change color, open or close, release
spores, shiver, or glow differently as you pass. Different species should have
distinct temperaments: curious, shy, slow to wake, or quick to startle. Give
responses an approach, a reaction and a gradual settling back, with enough
variation to feel organic.

### Technology belongs to the same living world

Screens may wake as you approach, change their message, or seem to recognize
you. Signs, lights and old machines should have their own ways of responding.
Their behavior should suggest a relationship with the surrounding life and with
the people who once used them.

### Mystery comes through behavior

Let players notice patterns before explaining them. A flower might glow in the
same rhythm as a distant antenna; a screen might repeat a symbol seen on a
creature. Leave room to wonder what these connections mean and to discover more
through exploration.

### The world is connected

Reactions should sometimes reach beyond the thing you approached: spores wake
nearby flowers, light passes along a row of plants, or one screen's message
appears farther down the street. Repeated colors, sounds, symbols and behaviors
can connect different places. Some encounters should leave a subtle memory that
the player can recognize when returning.

### Keep reactions quiet enough to notice

Use restraint, pauses and contrasting responses. A small turn of a leaf or a
single changed word can carry the moment. Preserve the ability to read the
landscape and find your way, especially on a phone.

**Design check:** What notices the player here? How does it respond? What might
that response reveal about its connection to the rest of the world?

These principles guide the reactive scenery introduced in v0.22 and future
additions to the world.

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

**The tool:** hold right mouse (or **R**) to aim, click (or **G**) to fire, and
**X** (or middle click) to switch modes. On a gamepad, LT aims, RT fires while
aiming and the D-pad switches; on touch, use **◎ ✺ ⇄**. The paralyze ray
freezes wildlife and people briefly. Foam darts activate things from afar:
reactive scenery, observatory lenses within 30 m, the world gate, cruising
taxis and Perdide's carnivorous plants.

## Controller

Connect a standard Xbox, PlayStation or compatible gamepad, then press a button
while the game is focused. Keyboard and touch remain available.

- Left stick: move, climb, steer; right stick: camera.
- A / ×: jump, glide, flap or ascend; X / □: interact, whistle, mount/dismount.
- Y / △: scout ping; RT / R2 or left-stick click: run/boost (descend in taxis).
- LB/RB: zoom out/in. D-pad up: worlds; down: photo mode.
- View / Share: sketchbook; Menu / Options: settings.
- Menus: D-pad or left stick selects; left/right adjusts settings; A / × confirms;
  B / ○ returns; right stick scrolls.
- Photo: sticks fly/look, LB/RB lower/raise, A / × saves, B / ○ exits.

On browsers that require a touch or click to enable audio, tap the page once.
Controller logic and browser integration are tested with simulated standard pads;
physical controller testing is still needed on iPhone.

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
reopen it at any time, or **1–9** while it's open (later worlds are clicked). Each level is a module in
`src/levels/`, registered in `src/levels/index.js`.

| # | Level | After | Getting around |
|---|---|---|---|
| 1 | **The Desert** (`desert`) | *Sable* (Shedworks) | walk, climb, glide, hoverbike |
| 2 | **The City-Shaft** (`incal`) | *L'Incal* (Jodorowsky & Moebius) | jetpack, climb, flying taxis |
| 3 | **Arzach** (`arzach`) | *Arzach* (Moebius) | the flying bird, climb |
| 4 | **The Airtight Garage** (`garage`) | *Le Garage hermétique* (Moebius) | portals, shifting gravity, jetpack |
| 5 | **Edena** (`edena`) | *Le Monde d'Edena* (Moebius) | climbing with stamina |
| 6 | **Perdide** (`perdide`) | *Les Maîtres du temps* (Laloux & Moebius) | hover-skiff, wading, caves |
| – | **Arzach II: The Sky Stones** (`arzach2`) | after *Arzach* | the flying bird, climb |
| – | **The Buried Machine** (`buried`) | after Moebius | climb, jetpack |
| – | **The Garden of Spheres** (`spheres`) | after *Le Monde d'Edena* | walk, climb |
| – | **Perdide II: The Deep Wood** (`perdide2`) | after *Les Maîtres du temps* | hover-skiff, wading, caves |

The picker lists worlds in the order of `LEVELS`. Each second take sits after
its original, and progression follows `ORDER` in `src/levels/content.js`.
The reference pages for the four v0.30 worlds are in `references/`
(IMG_3783–3800).

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
  unless you're moving the mouse. On a stick, `bikeSteer()` ignores sideways
  drift while you drive forward (a 0.32 deadzone, 0.12 otherwise) and curves
  small pushes gently, so it doesn't swerve.

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
- **Ending:** find all seven story pages and all 35 relics for a closing page.
  It unlocks an eighth world, **The Atelier**: a blank page with pencil
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

## Steam Deck

A Linux package with automatic updates and Steam library integration is built by
[the Steam Deck workflow](.github/workflows/steam-deck.yml). See the
[installation and release guide](docs/steam-deck.md).

## Changelog

Press **N**, or use the button in settings, for what's new in each version
(`src/changelog.js`; add an entry at the top for every release). After an
update, a note points to it once. The same release notes are in
[changelog.md](changelog.md); keep it in sync when adding a release.

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
The gate leads back to the desert; Perdide now leads into the market.

Geometry is merged by street block and material for culling. Collision tests
cover the avenue, bridge decks, climbing ledges, relic platforms and quest
altitude. Browser checks cover rendering and story completion; phone-sized
layout checks do not establish performance on physical iPhone hardware.


### Feathered birds (v0.21)

Ambient flocks now draw an instanced body/head/beak/tail and two feathered wings
(three draw calls per flock). Desert birds circle lower and closer at a smaller
scale; distance scaling is capped at 1.7 times their base size.
The Arzach mount has overlapping secondary and primary feathers, articulated
shoulders and wrists, folded resting wings, a hooked beak, a fan tail and talons.
Static feather geometry is merged within each moving joint. Tests cover flock
scaling, wing folding, takeoff and the rider seat transform.


## Responsive worlds (v0.22)

Walk near the new clusters or look toward them. Each responds gradually,
passes one delayed pulse to its neighbors, and settles after you leave.

| World | Response |
| --- | --- |
| Desert | Salt blooms open, turn turquoise and release a brief cloud of spores. |
| City-Shaft | Terminals wake along the terraces and recognize returning visits. |
| Arzach | Tall pale fronds turn toward visitors and take on a lavender tint. |
| Garage | Machines stir and pass amber signals, including in the other gravity zones. |
| Edena | Larger flowers unfold, turn pink and turn toward the player. |
| Perdide | Fungi shrink away, glow turquoise and release spores. |
| Signal Market | Shopfront terminals and selected existing billboards wake with changing messages. |
| Atelier | Pale paper-like growths open and pick up a soft teal glow. |

The three small lights/seeds recur across living and mechanical objects. Screens
say WE SEE YOU, AGAIN or HEARD according to encounter history. Encounters persist
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

### Character animation review

With `npm run dev` running, open `/tools/rig-review.html`. Choose Walk, Jog,
Run, or Climb and step through the 120 samples with the slider or frame buttons.
Front, side and back views show the flat-coloured model with joint overlays;
**12-frame sheet** creates a downloadable contact sheet. This uses the game's
actual `Animator` and `Humanoid` classes, before terrain foot placement.
`tests/traveller.test.js` compares every gait phase to the source animation,
including hand direction, palm twist, limb lengths, boot pitch and loop seams.

The review also has **Face close-up** and **Face views** for head turnarounds.
To rebuild the face, run Blender with `scripts/refine-traveller-face.py --
input.glb output-directory`, then run `python3 scripts/merge-traveller-face.py
input.glb output-directory/character.glb public/anim/traveller.glb`. The second
step copies only the new facial meshes and preserves the shipped rig data.

The v0.27 equipment pass uses `scripts/refine-traveller-equipment.py --
input.glb output-directory`, followed by `python3 scripts/merge-traveller-equipment.py
input.glb output-directory/character.glb public/anim/traveller.glb`. Use the same
input for both commands. It rebuilds gloves, boots and the radio pack, smooths
local elbow/knee/hip weights, and preserves the original skeleton and animation
buffers. New parts are batched into nine meshes by material. Fingers have a
fixed relaxed pose; they do not have separate animation joints.

Desert materials opt into `sandInk`: broad flat color, sparse curved strokes
anchored to the surface, and existing slope/shadow hatching. Dot stippling and
round albedo flecks are disabled for these surfaces. Strokes fade when too small
to resolve, rather than growing into distant dots. Other terrain styles retain
their own settings.

### Shader face (v0.28)
`src/face.js` draws sparse eyes, brows, nostril marks and a mouth in the head's
rest coordinates. The sculpted head supplies the silhouette; old fixed ink meshes
are hidden at runtime. Face materials have no image map. Each traveller owns
blink, smile, mouth-opening, brow and gaze uniforms, which remain live after hero
material cloning. `finishFrame` drives automatic blinks and exertion; the rig review
page exposes Blink and Smile sliders using the same GLSL. These shader expressions
are game-side and are not embedded into the GLB export.

Movement now uses separate acceleration and braking rates, prevents repeated foot
locks before lift-off, requires a wall hit to acquire a climbing hold, adds reaching
clearance, and releases ledge grips into the animation before standing.

### Flat printed outfit and Moebius face (v0.29)
The traveller GLB no longer contains an image. The generated body's painted
texture had baked-in shading and creases, so `scripts/flatten-traveller-outfit.mjs`
sampled it once per vertex and matched each sample to the reference palette in
`src/traveller-style.js`. It then removed small islands and wrote the zones as
`COLOR_0`. The script also relaxed the lumpy generated normals and removed the
5.8 MB image (9.0 → 3.8 MB). Run it last, after either merge script:
`node scripts/flatten-traveller-outfit.mjs input.glb public/anim/traveller.glb`.
In the game shader, blended vertex colours snap to the nearest palette ink, so
zone edges stay crisp. Equipment materials use the same palette by name.

Shadow and folds are drawn by the shader. `src/creases.js` places folds in
bind-pose space using the skeleton's real limb segments: chevron folds at the
elbows and knees, gathered elastic cuffs with pleats at the wrists and ankles,
pulls from the crotch and armpits, and the front zip. Fold arcs lengthen in shade.

The face (`src/face.js`) uses tapered pen strokes: almond lids with solid pupils
that close into a lowered arc, light brows, one hooked line down the nose, a
mouth with a lower-lip stroke and smile ticks, and a chin mark. Fine hatching
follows the shadow edge, and deep shade is left flat. Face normals blend toward
a head sphere, giving one clean terminator. Face cast shadows are sampled outside
the helmet, so the headphones cannot cut ragged shapes across it. The post pass
now draws the player's face and folds at full strength once the figure is large
enough to read; previously they were faded to about a fifth.

### Four new worlds (v0.30)
Each new world is self-contained in `src/levels/<id>.js`. The module exports its
journal content (`<ID>_CONTENT`, imported by `content.js`) and has its own test in
`tests/<id>.test.js`. Visible rock and props generally render without collision;
hidden coarse copies collide instead. Static collision for each world is under 60k triangles.
- **Arzach II** (`arzach2`): plateaus and needle forests above a cloud sea, linked
  by aqueducts and natural bridges. The rocks are built from noisy horizontal rings:
  fluted needles that fuse like drips, egg-stone stacks, mushroom tables with
  ribbed and hatched undersides, and overhanging rose cliffs with monasteries.
  Below the cloud deck counts as unsafe and returns you to your last footing.
  The peach plain leads to the lone tower.
- **The Buried Machine** (`buried`): domes and pipes on pale dunes, a trench
  that exposes blue-grey machine strata, a rust canyon with oval doors and lit
  portholes, and the oculus drum with its balcony goal. A ring wall with a rim
  city stands on the horizon, and an upside-down city hangs overhead.
- **The Garden of Spheres** (`spheres`): umbrella trees with gill undersides,
  white pyramids and an overgrown terraced hill with stairs, and giant spheres
  whose crescents face the light. It also has a sphere-arch, a mirror lake with
  projected reflections (correct from the south shore), and a cypress avenue to
  the round plaza.
- **Perdide II** (`perdide2`): violet trunks and pale mushrooms at dusk, with
  crystal reeds, glowing egg heaps and lit pools along a wadeable path. The path
  passes root arches, moss domes and a sunken saucer, and ends at a coral-lit
  root cave with the teal skiff moored outside.

### Wildlife, the tool, crowds and fixes (v0.31)
- **Wildlife** (`src/wildlife.js`, `src/wildlife/`): every world has 2–3 species
  (11–14 creatures), each with its own surprise when scared: the desert's puff
  lizard balloons up and floats away, Arzach's bone kite unfolds into a paper
  kite, Edena's pyramid tortoise raises its shell into a temple, and so on.
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

### The traveller's story begins (v0.32)
Design: `docs/game-brief.md` (the brief and its working decisions) and
`docs/story-bible.md` (each world's story, quests, keepsake and clue). Shared
story state is `src/game-state.js`: persistent flags, keepsakes and an event bus.
Every system talks through it, and its header lists the flags and events.
- **The ship** (`src/ship/`): a 26 m round ship with a walkable interior (bunk
  room, galley, entry hall, cockpit around a reactor column). It has its own
  collider (`physics.addCollider`) and lands at each world's arrival point
  (`level.shipSite`, `SITE_OVERRIDES` in `sites.js`, or a site search near the
  spawn). In the desert it lies crashed at (58, 48), with a furrow behind it.
  E at the cockpit console plays a waiting call home, or opens the galactic map
  (`starmap.js`). The map is locked until `ship.powered`. Travel loads
  `?level=<id>&via=ship`, and the gates still work.
- **The prologue** (`prologue.js` state machine, `cinematics.js` director)
  plays on a new game: waking in the bunk, the father's call, the impact, the
  crash landing seen from outside, stepping out. `?prologue=1` replays it; hold
  Esc to skip. "Reset progress" starts a new game.
- **Calls home** (`src/story/calls.js`): six calls, one waiting after each
  completed world. The father reacts to the latest keepsake's kind; the mother
  joins from the third.
- **The fluid backpack** (`src/fluid-tool.js`): a lava-lamp tank (`#ifdef FLUID`
  in `materials.js`), a hose and a wrist bracer. Shoot (G / click while aiming),
  push (C / middle click / pad B) and boost (jump again in the air) share three
  charges, and all three refill 2 s after the last use (for the jets, 2 s after landing). Hits reach `targets.js` as `'shoot'` and
  `'push'` (with `info { colours, strength, shove }`). `tool.refill({ addColour,
  tone })` adds a colour band for good.
- **Conversations and quests**:
  - `src/story/dialogue.js`: data-driven conversation trees, with conditions,
    choices and effects.
  - `src/story/quests.js`: quests with goto / talk / bring / flag stages,
    markers, HUD, the Q ping, and a journal section.
  - `src/interact.js`: decides who gets the E key. The ship wins inside it and
    at its ramp. Otherwise the nearest person, vehicle or thing wins, and only
    after that the player's whistle.
- **The desert story** (`src/story/desert.js`, `src/desert-city.js`, `magic-water.js`):
  "The Tree That Drinks" (see the story bible). It has the city of Qanat with the
  burning tree, the pilgrims' camps with positional music, a 72-person procession
  on a 2.1 km loop and the cave in a giant's chest. Pushing the fallen rib clears
  the channel; the tree drinks and the water refills the tank with a new colour.
  Bringing the water to the ship powers it. There are three side quests.

### Every world's story (v0.33)
Each world has a story module (`src/story/<world>.js` and `<world>-data.js`,
registered in `WORLDS` in `src/story/index.js`). Each has named people with
conversations, a main quest that ends in a keepsake and sets `world.<id>.done`,
two side quests, reactions and a clue to another world. Story pages are
`manual: true` and close when the main quest does. The story bible has the
walkthroughs and local names; each data file's header lists its flags.

| World | Main quest | Keepsake |
|---|---|---|
| Arzach | climb the tower with boost-jumps, blow the rider's whistle | the bird's promise (person) |
| Arzach II | fetch the clapper from the floating island, ring the bell: the cloud sinks 16 m | the bell's note (song; it then sounds when you shoot) |
| Garage | carry the signal through all three zones to the Major's desk | the Major's note (knowing) |
| Buried Machine | push the oil valve, shoot the wick, stand in the light (amber band); the wheel turns a tooth | a rust gear tooth (thing) |
| Edena | open Stel and Atan's overgrown ship, play their log, part the flowers over the scorch | Mira's words (word) |
| Garden of Spheres | listen at three spheres, then at the plaza's pole | the chord of the spheres (song) |
| Perdide | make the Great Crystal sing (rain or three shots), carry its splinter to the cave (violet band) | a singing splinter (thing) |
| Perdide II | relight three dark pools; the saucer answers; it is Stel and Atan's pod | Hollin's lamps (person) |
| City-Shaft | carry the splinter from the bottom to the palace; the Incal brightens | "Look up once a day" (word) |
| Signal Market | tune the antenna (three shots at once), play the recording: the father's voice | "You are not alone" (word) |

### The ending (v0.34)
- **Calls home** (`src/story/calls.js`): 11 calls, one per finished world. Each
  call reacts to what happened, and each reaction is heard once
  (`calls.beat.<id>`): the world just finished, clues, the bell's note, the
  bird's promise, the people met, and quiet keepsakes compared with things.
  After the broadcast the father deflects "Ilen"; later the mother tells the
  truth in a call of her own.
- **Homecoming** (`src/story/ending.js`, `src/ship/homecoming.js`): after
  `ENDING_WORLDS` (6) worlds, a call asks you home and the galactic map shows
  Home. The sequence:
  1. Take off and come out of the jump in orbit.
  2. Choose one keepsake (or nothing) at the cargo check.
  3. Descend and land at home.
  4. The parents react: the father according to the keepsake's kind, the mother
     always the same.
  5. Credits list every world and the people you met.

  The choice is stored as `ending.*`, and play continues afterwards.
  `?level=home&ending=1` replays it.
- **Home** (`src/levels/home.js`, hidden): a dusk dome house under two moons,
  with an umbrella tree, a washing line in the backpack's colours, and a landing
  ring painted with the glyph. The parents are there to talk to.
- **The bird's promise:** with `bird.promise` set, the whistle calls the Arzach
  bird in worlds with open sky and no mount (Edena, the Garden of Spheres, Home).

## The scout keeps pace (v0.39)

While guiding, the scout (`src/scout.js`) leads `guideLead(speed)` metres
towards the goal from where you are (6 m standing, up to 15 m flat out), and
`fly(dest, max, up, dt, carry)` adds your velocity as a feed-forward, so it
stays ahead on a bike or a bird instead of trailing. It faces the goal itself
(`aim`, pitch included) with a lit cone off the lens, and lays a thin glowing
`Trail` that dissolves once it is home. It only gives up and flies back when
it is more than 27 m from you.

## Sound from the first frame (v0.39)

Each world is a new page, and browsers only let a page's sound start after a
press. `Sound.mayStart()` (`src/audio.js`) asks whether a context would run
now (`navigator.getAutoplayPolicy`, else a probe context's state); if so the
sound starts with the world, as it does in the Android app (its WebView plays
without a gesture). Otherwise it waits for the first key, click or pad press,
since a suspended context would only queue sounds to burst out at once. The
ship's arrival sets its engines every frame, so they come in even when the
sound starts partway through.

## Musicians' solos (v0.39)

Bands (`sound.setBands`) play on the score's beat around a place. A solo is
free-time: `sound.solo(pos)` (`src/audio.js`) plays `SOLO_TUNE`, three breaths
in a hijaz mode on one reed voice that glides into each note from a quarter
tone under, over a low drone, with a lot of reverb. It joins the bands for
distance and panning, and hushes the other bands and the score while it lasts.
In the desert, asking Bako to play emits `music:solo { who: 'bako' }` from his
conversation (`src/story/desert-data.js`), and `src/story/desert.js` starts it
at his seat.

## Android (offline APK)
The game is also packaged as an Android app, for handhelds such as the Retroid
Pocket. Their built-in controls work through the Gamepad API.
- **Release workflow** (`.github/workflows/android.yml`): every push to `main`
  builds the web game, wraps it with Capacitor (`capacitor.config.json`,
  `android/`) and builds a signed release APK. The APK is published to the
  GitHub release for the newest version in `src/changelog.js` (`v0.34` and so
  on, via `scripts/release-info.mjs`). Pushes within one version replace that
  release's APK; adding a changelog entry starts a new release. Next to the APK the release gets `latest.json` (APK URL, versionCode,
  native level) and `web.zip` + `web.json` (the game itself: version, build = run
  number, sha256, URL, `minNative`), all from `scripts/release-info.mjs`. Download
  `moebius-v<version>.apk` from the repository's Releases page and open it on
  the device to install. Allow installing from your browser or file manager
  the first time.
- **Signing:** one fixed release key, so new builds install over old ones and
  keep your progress. The key is in the repository secrets
  `ANDROID_KEYSTORE_BASE64` (a PKCS#12 keystore, alias `moebius`) and
  `ANDROID_KEYSTORE_PASSWORD`. A local backup is in `.local-tools/android-signing/`,
  which is git-ignored. Keep it: losing the key means the next APK has to
  replace the app with an uninstall, which deletes your saves.
- **The app** runs fullscreen and immersive in landscape, keeps the screen on,
  and plays sound without an extra tap. `versionName` is the game version and
  `versionCode` is the workflow run number.
- **Local build** (needs JDK 21 and the Android SDK):
  ```
  npm run build && npx cap sync android && (cd android && ./gradlew assembleDebug)
  ```

### Items, boxes and the backpack (v0.35)
- **Items** (`src/items.js`): the backpack, fluid jets, fluid wings, the stilling
  and ember modes, and the boxes' special items. Each is stored as a game flag
  `item.<id>`. `items.has/grant/revoke` take effect live.
- **Boxes** (`src/boxes/`): a dark blue chest with a pale star, after
  `references/box-opening.webp`. It glows, hums and shudders as you approach,
  and E opens it. Since v0.39 the chests are set down `BOX_SCALE` (1.9×) larger,
  and the opening scene (`scene.js`) has them wake, lift `LIFT` metres off the
  ground turning slowly, and come apart from the top down: every box material is
  made with `makeMaterial({ dissolve })`, whose `DISSOLVE` block discards the
  surface by world-space noise as `uDissolve.x` goes 0 → 1, with a burning edge
  (the box leaves the shadow pass meanwhile). The item grows out of the light
  at its centre and hovers there with a card showing its name, what it is and
  what it does. Then the item is granted, and the box is gone for good (no
  collider either).
  Placements are in `placements.js`: the backpack lies near the desert crash
  site as the first quest stage, and every world has a box. Fallback boxes
  appear by the ship if you reach a world without what it needs. Special item
  effects are in `effects.js`. `migrateSave` gives saves from before v0.35
  the backpack.
- **Backpack-powered abilities** (`src/fluid-tool.js`, `src/fluid-kit.js`,
  `src/flammable.js`):
  - With no backpack there is no tool, and vehicles won't start.
  - The jets drain the same reserve (0.3 charges per second) and work in any
    world. The wings bloom from the tank and are needed to glide.
  - X cycles through the modes you own: shoot, stilling (freezes) and ember
    (lights `level.flammables`). A target that doesn't list a mode in
    `accepts` gets `'shoot'`, so every puzzle works in every mode.
  - Riding the hoverbike or skiff moves the tank into the vehicle's socket.
- **Dev menu** (`src/dev-menu.js`, the backquote key or settings): items,
  boxes, flags, teleport. Also `?items=all|none|a,b`.

### The makers' boxes, Android controls and updates (v0.36)
- **The boxes** are artifacts of the makers, the people of the glyph (see "The
  boxes" in the story bible). The backpack's box stands in the Givers' shrine
  in Qanat (231, 391). Opening it brings six villagers and Nour, the eldest,
  whose conversation sends you on the rest of `desert.power` (stages `city →
  box → elder → well → ama → speaker → down → …`). Saves are migrated: `items.v`
  2 marks the box open for anyone who has the backpack, and `desert.quest.v` 2
  maps the old stages.
- **Android controls** (`android/.../GamepadBridge.java`, `src/native-pad.js`):
  the activity reads the built-in controller and hands it to the page as a
  Standard Gamepad. With it the prompts use Android button names (A B X Y, L1
  R1 L2 R2, Select, Start); `?pad=android` forces them in a browser.
- **Updates** (`android/.../Updater.java`): on launch the app reads
  `latest.json` from the newest release (uploaded by the workflow with the APK:
  versionCode, version, APK URL). It offers newer builds and hands them to the
  system installer; the same key keeps the save.

### Alien voices and the translator
- `src/story/voice.js` plans each line's syllables (pitch path, formants, timing), the
  same alien syllables for the same word in a given tongue; `src/audio.js` renders them
  on a `voices` bus. Dialogue syllables play as the text reveals; balloons and crowd
  shouts play short versions (at most two at once, silent past 26 m); calls are voiced
  through the one hook in `cinema.say`.
- **Tones** (`src/story/tone.js`): every line is tagged, `'~sad~ …'` or `{ text, tone }`,
  from `neutral, happy, sad, angry, scared, surprised, curious, tired, solemn, playful,
  whisper, shout`. Tags are stripped wherever text is shown, and `tests/tone.test.js`
  checks every line in the game has one.
- **Tongues** (`LANGUAGES`, by level id): Qanati, Shaft cant, the Arzach hush, cloud-monk
  chant, Garage clatter and so on, each with its own glyph script. The traveller's
  translator shows "translating · <tongue>" and resolves the glyphs at the caret.

### Over-the-air updates and the handheld pass (v0.37)
- **Game updates without an APK** (`android/.../WebBundles.java`, `src/native-app.js`):
  - On launch, when online, the app reads `web.json` from the newest release in
    the background.
  - It downloads a newer build that this app can run, checks it against its
    sha256 and unpacks it to the app's files (`web/<build>/`).
  - The new build is used from the next launch, or right away with *restart now*
    in the settings. The settings also show what's running (`web build 14 · app 12`).
  - Capacitor serves it at the same `https://localhost` origin, so saves are shared.
  - A build that doesn't reach its first frame (`window.__moebiusBooted`) within
    30 s falls back to the game in the APK and is never tried again.
  - Old builds are deleted.
- **APK updates** (`Updater.java`) are offered only when the native side changed,
  that is when `latest.json`'s `native` is above the app's `WebBundles.NATIVE_API`.
  - Bump `NATIVE_API` whenever the Java bridge changes. From then on, web builds
    need that APK (`minNative`), and the APK offer comes first.
  - Apps older than this one still get the APK offer once.
- **Swap A/B (confirm/back)** in the settings: B confirms and jumps, A goes back and
  pushes, and the prompts follow.
- **Pause and resume:** leaving the app (home, recents, power) releases the
  controls, stops the sound and pauses the page. Coming back restores fullscreen
  and the sound. On a handheld the sound starts with the first controller input.
- **Testing a debug build:** `adb shell am start -n com.rnaud.moebius/.MainActivity
  --es webManifest <url>`. Debug builds otherwise skip over-the-air updates.

### Costumes, the close camera and subtitles (v0.37)
- **Costumes** (`src/costumes.js`, keyed by level id): each world has one or more tribes
  (headwear, mask, shoulders, prop, robe, cape, pattern, skins, palette), seeded by world
  and person id. Full NPCs get them as one merged skinned mesh (`Humanoid.dress()`); the
  GPU crowd reads them from `aDress` and per-world figure geometry (`figureGeometry`),
  with a shared `TRIM_GLSL` for cloth patterns. Quest people can set a `look:` override.
- **Camera** (`CameraRig` in `src/player.js`): close over the shoulder (2.6 m) wherever
  `tightness()` finds walls and a roof around the player, `rig.indoor` / `rig.tight` are
  set, or the player is in an `interiors.js` room; 9.5 m in the open.
- **Cinema layout** (`layoutCinema()` and `Subtitles` in `src/ship/cinema.js`): hint,
  toasts, objective card, subtitle and skip bar each get their own place and never
  overlap each other, the HUD, the touch buttons, a conversation or the box card. Toasts
  queue and wait while the screen is dark or a panel is open.
- **Update status** (v0.38): `WebBundles` records each update check (`check`: checking,
  current, downloading, ready, apk, offline, error; `latest`: the newest build seen) and
  `AppShell.info` reports it; `updateStatus()` in `src/native-app.js` shows it under the
  build label in the settings. `NATIVE_API` went to 3 for this.
- **The changelog** is `src/changelog.js`; `changelog.md` is generated from it with
  `node scripts/changelog-md.mjs` and `tests/changelog.test.js` keeps them in sync (see
  CLAUDE.md).

### Steady shadows, view culling and the Handheld preset (v0.38)
- **Shadows** (`src/shadows.js`): each cascade is a `Cascade` whose centre snaps to its
  shadow-map texel grid in light space, with a fixed size and a quantised sun direction,
  so shadows no longer swim as the camera moves. The maps are depth textures with
  hardware comparison (`sampler2DShadow`), and the filter widens to the pixel's footprint.
  Bias and normal offset are set in texels per cascade.
- **Culling** (`src/perf.js`, `shadows.js`): `fitBounds` gives instanced meshes real bounds
  so they cull; `ShadowCuller` skips casters whose shadows can't reach the view;
  `SmallCuller` drops props by projected size; `RoomCuller` hides off-map rooms (ship,
  caves) unless the camera is near. Draw calls fall 10–36% across the worlds.
- **Graphics presets** (`QUALITY_PRESETS`, `resolveQuality`, `detectHandheld` in
  `perf.js`): Handheld (75% resolution with dynamic scaling, no fine cascade, 4-tap shadows,
  no crease shading or cloud shadows, shorter crowd and prop ranges, a lighter ink pass)
  is chosen by Auto on Android and mobile GPUs. The F readout shows ms (CPU and GPU where
  the browser allows), render scale, draw calls and triangles.
- Known: on desktop Metal (ANGLE), Perdide II and the Buried Machine run about 1 ms slower
  per frame than before despite fewer draws (still over 200 fps here); the desert and the
  City-Shaft are about 1 ms faster.

