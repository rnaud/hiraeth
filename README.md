# Memento

A three.js exploration game in ligne claire, formerly the Moebius / Sable shader PoC
(the repository and internal ids keep the old name).

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
reactive scenery, observatory lenses within 30 m, cruising
taxis and Lorn's carnivorous plants.

## Controller

Connect a standard Xbox, PlayStation or compatible gamepad, then press a button
while the game is focused. Keyboard and touch remain available (unchanged).

The layout is by **position**, so a Retroid Pocket (letters printed Nintendo-style:
B at the bottom, A on the right, Y left, X top) and an Xbox pad put the same action
under the same thumb (`src/controller.js`, from a Retroid player's feedback):

| | bottom (Xbox A, Retroid B) | right (Xbox B, Retroid A) | left (Xbox X, Retroid Y) | top (Xbox Y, Retroid X) |
|---|---|---|---|---|
| walking | jump (again in the air: boost; hold: jets / wings) | interact, talk, get on | call the mount (whistle, hail a taxi) | ping |
| riding | hop / flap / rise | get off | | |

- **Walking:** left stick moves; click it (L3) to run, until you let the stick go.
  Right stick looks; hold LB / L1 and the right stick zooms. LT / L2 aims the fluid
  tool, RT / R2 shoots (an aimed shot while LT is held, a quick shot without), RB / R1
  pushes, D-pad left / right changes the gun mode, up the worlds, down photo mode,
  R3 sounds the bell-note whistle. View / Select opens the sketchbook on your **gear**
  (every item and what it does, `gearHtml` in `src/items.js`); Menu / Start the settings.
- **The pad's interact never whistles.** On the keyboard E still falls back to the
  whistle when nothing is near; on a pad that is the left button's (`player.callMount`).
- **Riding** (context `'ride'`, `padRide()`): RT / R2 is an analog throttle, LT / L2
  brakes and reverses, the left stick steers (pushing it forward does not drive), and on
  the bird and the taxi it tilts too: forward dives / goes down, back climbs. RB / R1 or
  L3 boosts the hoverbike and skiff. On the ground a squeeze of RT lifts the bird off.
- **Menus** confirm with the button printed **A** and go back with **B**, each platform's
  habit: Xbox bottom / right, Retroid right / bottom. View and Menu close too. While
  **talking**, the interact button also carries the conversation on (so on Xbox, B to
  talk and B again does not walk away). Photo: sticks fly / look, LB / RB lower / raise,
  confirm saves, back or D-pad down leaves.
- **Where the letters are** (`src/native-pad.js` `padFaces`): Android reports buttons by
  printed letter (KEYCODE_BUTTON_A is index 0), so on a Nintendo-labelled handheld
  index 0 is the right button; `toPositions()` moves them to the standard positions.
  Auto picks Nintendo letters for the Android app and handhelds (Retroid, Anbernic,
  AYN), Xbox for Xbox / PlayStation pads and computers. The setting **Controller
  buttons** overrides it: A at the bottom (Xbox, PlayStation), A on the right (Retroid,
  Nintendo), or A on the right with a Retroid switched to its own Xbox style (letters
  Nintendo, reported by position). It replaces the old Swap A/B.
- **Prompts** are written by position in Xbox / PlayStation form ("A / ×" is the bottom
  button); `padText()` prints the pad's own letter (a Retroid's bottom button reads "B").
  Menu prompts use `confirmKey()` / `backKey()`, and code reading raw pad buttons (the
  galactic map, the homecoming, skipping a scene) uses `padIndex('ok' | 'back')`.

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
reopen it at any time, or **1–9** while it's open (later worlds are clicked).
It lists only the worlds you know of (see "The galactic map and the route"
below); `?level=<id>` and the dev menu still open any world. Each level is a module in
`src/levels/`, registered in `src/levels/index.js`.

| # | Level | Tagline | Getting around |
|---|---|---|---|
| 1 | **The Desert** (`desert`) | after *Sable* (Shedworks) | walk, climb, glide, hoverbike |
| 2 | **The City-Shaft** (`incal`) | a city stacked down a pit | jetpack, climb, flying taxis |
| 3 | **Vael** (`arzach`) | a silent world of needles | the flying bird, climb |
| 4 | **The Sealed Hangar** (`garage`) | a pocket universe that keeps turning | portals, shifting gravity, jetpack |
| 5 | **Viridel** (`edena`) | a garden that keeps what falls | climbing with stamina |
| 6 | **Lorn** (`perdide`) | a twilight swamp that hums | hover-skiff, wading, caves |
| – | **Vael II: The Sky Stones** (`arzach2`) | stones that fell up | the flying bird, climb |
| – | **The Buried Machine** (`buried`) | a machine under the dunes | climb, jetpack |
| – | **The Garden of Spheres** (`spheres`) | spheres that answer | walk, climb |
| – | **Lorn II: The Deep Wood** (`perdide2`) | the wood under the swamp | hover-skiff, wading, caves |

Nothing in the game is named after a Moebius work (v0.39): the worlds, people and
places all have names of their own. The level ids (`arzach`, `edena`, `garage`,
`perdide`, `incal`, …) are only internal and stay as they were, so saves keep working.

The picker lists worlds in the order of `LEVELS`. Each second take sits after
its original, and progression follows `ORDER` in `src/levels/content.js`.
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
  - flying taxis, landing pads, cables and an acid lake at the bottom;
  - **jetpack:** hold Space in the air for about 10 s of thrust; you lean forward into the flight when steering;
  - **E** hails a taxi, then gets in. Driving: W/S throttle, A/D steer,
    Space up, Shift down.
  - taxis are solid: you bump into their sides, and you can land on a roof
    and ride along; a taxi left idle for 30 s flies back into traffic.
- **Vael:**
  - a bone-white world of needle spires, stone arches, floating ruins and a
    lone tower;
  - **E** whistles for the bird. Flying: A/D bank, W dive to gain speed, S
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
- **Travel:** by the ship (its galactic map, `src/ship/starmap.js`). The
  stone gates and the walk off the edge of a world are gone (v0.38).
- **Sound** (`src/audio.js`): everything is synthesised with Web Audio, with
  no audio files.
  - Each world has its own lead instrument and a recurring melody, played
    every 16 beats and varied each time:
    - desert: duduk and kalimba;
    - city-shaft: reed and marimba;
    - Vael: flute;
    - Hangar: analog synth;
    - Viridel: strings and celesta;
    - Lorn: FM bells.
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
  - Chimes for relics and page turns.
  - Sound starts on your first click, and **M** mutes.
- **Weather** (`src/weather.js`): each world alternates clear spells with
  its own weather, ramping in and out over a few seconds. You can force it
  from World → weather.
  - Sandstorms: a warm haze swallows the distance, and streaks of sand race
    across the screen.
  - Rain: slanted ink strokes falling over the scene.
  - Fog banks in the city-shaft and on Lorn.
  - Weather drives the wind on the cloak and the sound.
  - **Shelter** (`src/shelter.js`): the weather stays outdoors. Every
    `interiors.js` room and the traveller's ship are registered interiors
    (`addIndoors(test)` adds more); with the camera or the player in one, no
    rain or sand is drawn and the rain is a muffled drumming on the roof
    (the `rainRoof` sound layer). Under a roof (a ray straight up from the
    camera hits something within 30 m) the rain strokes skip everything
    nearer than `dryReach(roof height)` (`uRainNear` in the post pass), so
    the rain still falls out past the edge.
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

## The rider (v0.14, the Vael-style look; NPCs still wear capes)

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
- **Travel between worlds** is by ship only (v0.38): the gates and the
  seamless edge crossings were removed. The edge of a world is a wall now
  (`player.opts.limit`).

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
  - swaying flowers in Viridel;
  - footprints in sand.
- **The character:** a real human body (Quaternius' Universal Base
  Characters, CC0) dressed as the Vael rider: tunic, trousers, belt and
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
  - Vael: a fallen stone colossus and a giant hand rising from the plain;
  - the city-shaft: the Lodestar and its dark twin above the palace;
  - the Hangar: a cathedral of turning gears and pistons;
  - Viridel: Odile and Talo's crashed ship;
  - Lorn: the Great Crystal and its stone ring.
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

Geometry is merged by street block and material for culling. Collision tests
cover the avenue, bridge decks, climbing ledges, relic platforms and quest
altitude. Browser checks cover rendering and story completion; phone-sized
layout checks do not establish performance on physical iPhone hardware.


### Feathered birds (v0.21)

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

### Conversations: at most three answers

No conversation node offers more than three answers at once, and almost all offer
one or two (the few threes are real decisions: what to tell Ilo, what to say to
Sel, which stone goes on Tiv's cairn). Secondary questions sit one node deeper
instead of all on the greeting, and a goodbye is left out where every answer
already ends the talk (B / Esc always closes it). `tests/dialogue-choices.test.js`
walks every tree in the game, tries every combination of the conditions on a
node's answers (flags, items, quest stages, function conditions), and checks the
cap, the average (at most two) and that no node was stranded by the trimming.

### The father’s charge

"Bring back something of value", the father's last words on the prologue's
recording, is the journey's own quest (`src/story/charge.js`). Its state is read
off the save: given (`charge.given`, or any save past the prologue), out in the
worlds, home on the map (after six worlds), brought home (`ending.done`). It has
its own mark (✦, gold; a world's main quest is ◆, an errand ◇):

- a title card when it is given, as the dust settles over the crash: the words
  SOMETHING OF VALUE lettered on a band of paper with a pen line and a gold dot,
  and its own sound (`sound.charge()`, a low fifth under three climbing notes). An
  older save gets the card once, at its first quiet moment (`charge.card`);
- a card pinned at the top of the sketchbook: his words, the step now, how many
  worlds, and what you carry (the keepsakes);
- a gold tag on the HUD's objective line: for a while after a keepsake is earned
  ("✦ Something of value: Teo's walking rhythm"), and whenever nothing nearer is
  asked of you.

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
- **Vael II** (`arzach2`): plateaus and needle forests above a cloud sea, linked
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
- **Lorn II** (`perdide2`): violet trunks and pale mushrooms at dusk, with
  crystal reeds, glowing egg heaps and lit pools along a wadeable path. The path
  passes root arches, moss domes and a sunken saucer, and ends at a coral-lit
  root cave with the teal skiff moored outside.

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

### The traveller's story begins (v0.32)
Design: `docs/game-brief.md` (the brief and its working decisions) and
`docs/story-bible.md` (each world's story, quests, keepsake and clue). Shared
story state is `src/game-state.js`: persistent flags, keepsakes and an event bus.
Every system talks through it, and its header lists the flags and events.
- **The ship** (`src/ship/`): a 26 m round ship with a walkable interior (bunk
  corner, galley, entry, cockpit round a holo table; see "The ship's deck" below). It has its own
  collider (`physics.addCollider`) and lands at each world's arrival point
  (`level.shipSite`, `SITE_OVERRIDES` in `sites.js`, or a site search near the
  spawn). In the desert it lies crashed at (58, 48), with a furrow behind it.
  E at the cockpit console plays a waiting call home, or opens the galactic map
  (`starmap.js`). The map is locked until `ship.powered`. Travel loads
  `?level=<id>&via=ship`.
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
| Vael | climb the tower with boost-jumps, blow the rider's whistle | the bird's promise (person) |
| Vael II | fetch the clapper from the floating island, ring the bell: the cloud sinks 16 m | the bell's note (song; it then sounds when you shoot) |
| Hangar | carry the signal through all three zones to the Major's desk | the Major's note (knowing) |
| Buried Machine | push the oil valve, shoot the wick, stand in the light (amber band); the wheel turns a tooth | a rust gear tooth (thing) |
| Viridel | open Odile and Talo's overgrown ship, play their log, part the flowers over the scorch | Mira's words (word) |
| Garden of Spheres | listen at three spheres, then at the plaza's pole | the chord of the spheres (song) |
| Lorn | make the Great Crystal sing (rain or three shots), carry its splinter to the cave (violet band) | a singing splinter (thing) |
| Lorn II | relight three dark pools; the saucer answers; it is Odile and Talo's pod | Hollin's lamps (person) |
| City-Shaft | carry the splinter from the bottom to the palace; the Lodestar brightens | "Look up once a day" (word) |
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
- **The bird's promise:** with `bird.promise` set, the whistle calls the Vael
  bird in worlds with open sky and no mount (Viridel, the Garden of Spheres, Home).

## The scout keeps pace (v0.39)

While guiding, the scout (`src/scout.js`) leads `guideLead(speed)` metres
towards the goal from where you are (6 m standing, up to 15 m flat out), and
`fly(dest, max, up, dt, carry)` adds your velocity as a feed-forward, so it
stays ahead on a bike or a bird instead of trailing. It faces the goal itself
(`aim`, pitch included) with a lit cone off the lens, and lays a thin glowing
`Trail` that dissolves once it is home. It only gives up and flies back when
it is more than 27 m from you.

## The scout drone folds (v0.46)

The scout is a folding drone (`src/drone.js`), built like a seed pod: an
ivory lower hull with a blue rim, a rubber foot and one big brass-rimmed lens,
and an upper half of four blue shell petals hinged on the rim, with a small
rotor on the inner face of each and a whip antenna in the middle. Folded, the
petals close into a dome over the rotors (blades parked along the petals), the
antenna is drawn in to its brass bead, and the lens squints to a slit: a 21 cm
egg. Unfolded, the petals swing out and down into vanes (`PETAL_OPEN`, so the
rotors stand upright), the rotors spin up with a pale blur ring, the antenna
springs up and sways with the drone's accelerations, and the lens lights.

- **One draw call** for the drone: the painted parts (`vehicle-kit.js` paint)
  merged into one `SkinnedMesh` on 15 bones (hull, petals, rotors, blur rings,
  antenna rod and bead), bound folded; the glowing lens is its own small mesh.
- **`DroneFold`** is the state machine (`folded`, `unfolding`, `open`,
  `folding`): the eye opens, then the petals bloom, then the rotors spin up
  once the vanes are out; closing, the rotors spin down and park with their
  blades along the petals before the petals shut, and the eye closes last. It
  can reverse at any point; `snap()` jumps (teleports, recalls).
- **Launch and landing** (`DOCKING` in `scout.js`): it hops off the dock still
  folded, eye open, straight out along the dock's line (`out`: away from the
  surface and back from you), blooms once clear, then flies. Coming home it
  folds on the way in, lines up at the end of that line, and glides down it
  onto the dock in the dock's frame (so it keeps up as you move), turning to
  sit flush. If the dock itself jumps on the body (the radio pack giving way to
  the tank), it glides over, folded.
- **Flying**, the body stays near level (pitch at most `PITCH`) and leans into
  its speed; the lit beak turns on a pivot at the lens to point all the way up
  or down at the goal.
- **Docks** (`DOCK_ON_TOP`, `DOCK_ON_SIDE`): on the radio pack's flat top, foot
  down, lens looking back at the camera (`kit.dock` is where the foot rests,
  `gear.js` adds `DRONE_BELLY`); once the tank is found, clamped by its foot to
  the tank's left rail just under the top bracket, above the lantern
  (`SCOUT_DOCK_*` in `fluid-tool.js`). The dock is a child of the tank's group,
  so it rides into a vehicle's socket with it, but not the tank's growing in
  when found. While the fluid wings are open the rail is in their way, so it
  hops up onto the cap between their roots and back (`scoutDockPose`).
- `tests/drone.test.js` checks the fold's order, the folded shape (rotors
  inside the shell) and the open one (rotors upright), the docked shape inside
  a clearance volume over the pack and beside the tank (on the rail, off the
  glass, clear of the bracket, the lantern and the antenna), no arm, hand or
  the helmet through it in every clip (idle, walk, jog, sprint, jumps, drive,
  climbing, the ledge) on the pack, the rail and the cap, the cap clear of the
  open wings, and the launch and landing paths.

## Hazards: fire and spines (v0.39)

`src/hazards.js` keeps the things that hurt while you touch them: volumes with a
kind and a damage rate (share of the health bar a second). `updateHazards` (main.js,
once a frame) takes that rate from the traveller in small bites through
`player.hurt`, says what it is the first time ("It burns!"), and spines push you
back out. The burning tree registers its flame's volume (`flameHazard`, from just
over the fork to the tip); flora species with `hurts: 'spikes'` (the desert's sand
candelabra, the Hangar's bolt cactus) register a cylinder round each plant.

## Health and falls (v0.39)

The traveller has a health bar (`player.health`, 0..1). Landings are judged by
their speed into the ground (a drop of h m lands at about √(64 h) m/s); riding,
gliding and the jets land softly enough not to count. Up to `FALL.tumble`
(26 m/s, about 10 m) a landing costs nothing. Harder ones knock you over
(`player.knockDown`): the body goes limp into a ragdoll tumble, lies a moment
and gets up, and `fallDamage(speed)` takes a little of the bar (at most
`FALL.worst`, and a fall that isn't fatal never takes the last of it). Only
`FALL.lethal` (48 m/s, about 36 m) or more is fatal. `player.hurt(k, why)` is
the way in for every other hurt (`opts.onHurt`; the desert's fire and spines
take small bites); whatever empties the bar knocks you out (`opts.onKnockout`):
you go limp and stay down (`player.dead`), the screen dims and a small panel
asks to **Restart** (`#restart`, main.js; Enter / Space / E, A / × on a pad,
a click or a tap), which puts you back where you last stood safely, whole again
(`player.restart()`, `opts.onRestart`). After `FALL.wait` s without a hurt the
bar refills (not while knocked out). The bar (`#health`, top left) only shows
while you are hurt or down. While down you have no control, the fluid tool is
put away and the camera follows the body on the ground, lower and softer
(`rig.down`). Physics tests that drop the player from great heights pass
`health: false` (no hurts, no knockdowns).

### Ragdolls (`src/ragdoll.js`)

A ragdoll for the people's skeleton (`humanoid.js`), cheap enough for the
handheld: fifteen joint particles (pelvis, chest, head, hips, knees, ankles,
shoulders, elbows, wrists) moved by position-based dynamics in sub-steps of at
most 1/90 s. The trunk is held rigid, the limbs by their bone lengths, with a
few limits (knees bend forward only, thighs don't swing far behind the hips,
the head stays on the neck, elbows and knees never fold flat). Each particle
lands on the ground under it (one `heightAbove` ray per sub-step, from where it
was, so nothing overhead counts as ground, along any "up"), with friction that
lets it come to rest on slopes up to ~20°; the trunk is pushed out of walls as
a capsule once a frame. `apply(humanoid)` turns the whole body with the trunk
and aims neck, legs and arms along their segments; `snapshot` / `blend` blend
any two poses.

`Knockdown` is the whole of being knocked over, for the traveller and for
people: the limp fall (blended in from the pose they had over 0.12 s), lying
a moment once still (`KNOCK.lie`), and the get-up (`KNOCK.rise`: a blend from
lying there into `Humanoid.kneel` that rises to standing, facing the way the
body lay). `toppleVelocities` starts it: everything carries on along the way it
was going and the top tips over that way, with a random little twist.

People: the fluid tool's push knocks a full NPC right over when it is close and
hard (`KNOCKOVER.strength`, the push's strength 1 point-blank .. 0 at the
cone's reach; at most `KNOCKOVER.most` bodies down at once); from further off
they stumble as before. Crowd people with a body of their own (the near tier)
go over too: `crowd.holdShove` keeps the person's place on the body while it
lies there, and once it is up they walk back to their spot. The instanced crowd
further off keeps its cheap stumble. Nobody seated or in conversation is
knocked over.

## Water and swimming

Every body of water in every world is drawn by one water look and can be swum in.

**The look** (`src/water-shader.js`, compiled into the surface shader for every
`MODE_WATER` material: the `WATER` define, hooked into `materials.js` in four places).
Like the rest it only writes the G-buffer; post.js prints it:
- **Depth bands**: three flat tones by the water column under each point (pale
  shallows `color2`, the water `color`, a deeper saturated tone), inked by post.js
  like contour lines. In the shallowest band the bed shows through (`o.bed`, by
  default the shallows' tone gone sandy), with a faint wobbling caustic net close up.
- **The shoreline**: a pale foam band about 30 cm wide wherever the water meets
  anything (its width is measured in metres from the depth's slope, so it is as
  crisp on a beach as on a wall), and a broken lapping line a metre out that
  breathes in and out.
- **Ripples**: short pen dashes along wave crests across the wind (`uWind`),
  drifting downwind, at two scales; and rings spreading round whatever touches the
  water (`uWaterRings`, a ring buffer of 12).
- **The sky**: at grazing angles the sky's horizon and zenith colours (post.js's
  `uSkyHorizon` / `uSkyTop`) in two flat steps.
- **Sparkle**: horizontal dashes of sun toward the sun, twinkling, only where the
  water is lit. They are not drawn in the G-buffer (post.js would ink round each
  one: black specks): the shader marks them in the length of the normal it writes
  (`WATER_MARK`: water's normals are 1.012 long, plus 0.05 at a glint; post.js only
  uses directions), and `Waters.renderOver` paints them white over the finished page.
- **From below** the surface is a pale bright ceiling with its ripples (water is
  drawn from both sides).
- `waterPrint: true` (the Garden's mirrored shore) is a flat printed shape lying on
  the water: its own colour with the ripples, no depth, not swimmable.
- The handheld's low detail (`uWaterLite`, main.js `applyDetail`) keeps one scale
  of waves and drops the caustics and the sparkle.

**The bodies** (`src/water.js`, `Waters`, one per level, main.js). At load it finds
every `MODE_WATER` mesh (and any mesh with `userData.water = true`: the desert
cave's magic pool, which keeps its fluid look; `userData.waterMoves` refreshes its
box as it rises). Each gets its own copy of the material, drawn from both sides.
- `surfaceAt(x, z, y)`: the water there for something at height y (the lowest
  surface above y - 0.6, else the highest one under it): `{ y, body }` or null.
  Streams slope: it raycasts the water mesh itself. `floorAt(x, y, z)`: the highest
  surface under y; hoverbikes and skiffs skim on it (`bike.js` `surface`).
- **Bed maps**: the depth bands and the foam come from a half-float map of the bed
  under each body, baked from the collision world (`physics.groundAt` from 1.5 m
  over the surface, so rocks and walls standing in the water count and bridges
  overhead don't), a few rows a frame (`BED.budget` ms), nearest body first,
  from the middle rows outward. Texels down to 0.3 m on small pools, 256 a side at
  most. Bodies wider than `BED.huge` (Lorn's swamp) get a 300 m map round the player,
  baked again once you are 70 m off its centre. A 256² map is ~25 ms of rays in all.
- **Rings and splashes**: the player wading (each step: a ring, a few drops, a slosh,
  no footprint) and swimming, the strokes, going in and out (bigger the faster you
  fall), vehicles skimming, creatures standing in water, the fluid tool's globs
  going in. White drops are instanced and inked like everything else.
- **Under water**: the camera is kept 22 cm off the surface (never a half-and-half
  lens: `keepCamera`, after the rig); under it, `renderOver` sinks the page into
  the water's colour in three flat bands with distance, with slow light shafts
  looking up, and the sound goes through a low-pass (`audio.js underwater`).

**Swimming** (`src/swim.js`, `swimFrame` called by `player.update` before walking;
`SWIM` holds the numbers):
- Water over the feet slows the walk (to half at the chest). Where it is 1.3 m deep
  you float: the feet hang `SWIM.ride` under the surface, the head above it.
- Swim camera-relative (2.5 m/s, slow to start and stop); Shift / L3 sprints on
  stamina in a front crawl (4.6 m/s). Treading water when still, a breaststroke
  when moving: procedural poses on the rig (`swimPose`; the clip library has no
  swim), the body lifted so its back breaks the opaque surface.
- **Diving**: hold Z or Ctrl, or swim forward looking down (a pad has no button
  spare); under water you swim where you look, Space / A rises, letting go floats
  you back up.
- **Breath** (`player.breath`, bubbles under the health bar): 22 s of air under
  water, back in ~2 s at the surface. Out of air you are pushed up and can't dive
  again until you have breathed, and every 1.2 s a small hurt (`player.hurt`,
  'drown') that never takes the last 10 % of the bar.
- **Climbing out**: push into a ledge at the surface and the mantle pulls you out
  (`tryMantle`, up to ~1.5 m over the water); a higher wall, you climb it. Space at
  the surface: up onto a ledge in front, else a kick up out of the water (then the
  jets and the wings work again; never in the water). The fluid tool works at the
  surface.
- Where the bed rises to 1.1 m under the surface you stand up and wade out.
- **Falls**: water 1.6 m deep or more breaks any fall (`player.cushioned`): no
  tumble, no hurt. The levels' old "unsafe" deep water (Lorn, the Garden) no
  longer sends you back to dry ground while you are in water.
- Getting off a vehicle over deep water drops you in: you swim.
- The Lab's water sample at the end of the materials row is a swimming pool: a ramp
  up to the rim, a beach, 3.8 m at the deep end, a rock through the surface and one
  just under it, a low wall to climb out over and a high one, and a 10 m tower to
  jump from. `tests/swim.test.js` covers the states, the breath, climbing out,
  falls, the bed maps and the bike.

## The Lab (v0.39)

In the Lab, `[` and `]` (L3 and R3 on a pad) call `level.jump(∓1)`: a fade, then the
previous or next world's room, the hub between the last and the first. The title's and the
Start menu's **Debug** entry opens the worlds list (`?level=lab&worlds=1` from the title).


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

## The traveller: a person in a suit (v0.43)

The traveller is a normal 3D character: Quaternius' male human (`human_m.glb`,
reshaped like the NPCs), with the NPCs' own skeleton, bind pose, weights, face
and eyes, in its natural proportions and idle stance, dressed on top
(`src/traveller.js`, `Humanoid` option `outfit`, given `traveller.glb` for the
gear's art). Nothing is re-bound or stretched, so every animation (clips,
foot planting, climbing and mantle IK, gliding, aiming, kneeling, riding, the
ragdoll) poses it exactly as it poses an NPC.

- **The suit** is painted on the body by the outfit shader (`MODE_OUTFIT`:
  lavender suit, salmon gloves on the hands, salmon boots, the folds of
  `src/creases.js` at the human's own joints), on a baggy copy of the body
  (`suitGeometry`): every vertex stands off along its welded normal by its
  region's `TRAVELLER.swell` (most on the legs and trunk, gathered into the
  boots and the glove cuffs, the inner legs less, none on the head or feet).
  The same vertices and weights as the NPC body, only further out.
- **The gear** is the rigid art of `traveller.glb`, moved once onto this body
  and skinned to one bone each, the way costume pieces are: the bubble helmet
  centred on the head (`TRAVELLER.helmet`, the face inside), the headphones'
  cups just off the ears, the scarf on the shoulders under the chin, the radio
  pack (with its pouches and a long antenna) against the suit's back, the
  boots round the feet with their soles just under the ground (their shafts
  follow the shin).
- **The extras** are built on the suit's surface and skinned like the suit
  beneath them: the gauntlet cuffs of the gloves, the pack's shoulder straps,
  the belt with its pouches on the hips, the trouser cuffs gathered over the
  boots. Pieces of one colour share one skinned mesh (`userData.ranges` says
  which vertices are which piece).
- **His face** is the people's head warped by his own face morph (`TRAVELLER.face`,
  `Humanoid.setFace`: younger and fuller than the modelled face, see *Hair, faces that
  talk*), with his own hair under the helmet's liner (`travellerHair`).
- **Hooks:** `Humanoid.headAnchor` is the skull's centre, `chestAnchor` sits
  0.74 below the collar and as far back as the pack moved (the fluid tank and
  the scout's dock go there), `Humanoid.forearm.r` is the bracer's frame on the
  forearm (+y to the hand, -x the thumb's side, scaled out round the sleeve).
  `Humanoid.radioPack` is shown until the fluid tank is found (`fluid-tool.js`);
  the scout docks on the pack's top, then on the tank's side.
- `tests/traveller.test.js` checks the body is the NPCs' (skeleton, weights,
  bind pose, face), the fit (helmet centred, headphones on the ears, cuffs at
  the wrists, pack on the back, feet in the boots, soles on the ground), the
  idle and kneel poses bone for bone against an NPC's, rigid pieces, gait
  retargeting at 120 phases, wall contact and the gear hooks.
  `/tools/rig-review.html` shows the build per clip.

## People of every height, build and kind (v0.39)

The body is part of a person's look (`dressFor` in `src/costumes.js`), drawn
after everything else so the rest of each look is what it was, and seeded like
it, so everyone looks the same on every visit:

- **Kind** (`'m'` / `'f'`): crowds draw it per person, level NPCs alternate (or take
  `kind` from their data), story people use `def.kind`. Women's bare heads get long
  hair, a bun or a tail (`HEADS.long`, `HEADS.bun`); about a third of the men a beard
  (`MASKS.beard`, only on a bare face). Tribes can weight headwear per kind
  (`headsF` / `headsM`: the desert, the rim, the bazaar). Story people whose kind
  isn't given get no hair swap or beard.
- **Build** (`BUILDS`: slim, average, broad, heavy; women and men have their own odds).
  Full NPCs reshape their body mesh round its bones (`buildGeometry` in
  `src/humanoid.js`, cached per build; `Humanoid.setBuild` swaps it on a pooled
  body); the skeleton, head, hands and feet stay as they are, so headwear, masks
  and the foot planting still fit. Shoulder pieces widen with the build, robes
  measure the body they hang on, cape colliders grow with the girth.
- **Height** (`HEIGHT`: 0.85–1.15, a triangle round 1, women ×0.95) on top of the
  tribe's size; people leaning on a railing keep nearly its height. Bodies scale
  from their feet. A story person with `scale` keeps exactly that.
- **The GPU crowd** gets the same body from a per-instance `aBody` (female, shoulder
  width, girth: `packBody`): the shader narrows a woman's shoulders, widens her
  hips and adds a bust, widens and fills the torso (the belly forward), thickens
  limbs and moves the shoulder and hip pivots; capes and robes follow.
- `/tools/people-review.html?world=bazaar` shows a row of a world's people as full
  NPCs with the same looks as crowd figures behind (`&builds=1`: every build of
  both kinds). `tests/people.test.js` covers the mix, the seeding, the pieces and
  the builds.

## The character studio

A page of its own for the people alone, to tune bodies, outfits, faces and
expressions without loading a world: `studio.html` (open it with `npm run dev`
at `/studio.html`, on GitHub Pages at `…/moebius/studio.html`, or from the title
screen: **Character studio**, the small entry under Debug). It is the second
entry of the build (`BUILD_INPUT` in `vite.config.js`), so it ships in the web
bundle and the Android app too. It loads only the people's assets (the two
bodies, the clip library `anim/ual.glb`, `anim/traveller.glb`); a world's story
data (`src/story/<world>-data.js`) and its sky (the Lab's rooms,
`src/levels/lab-rooms.js`) come in when picked.

**It draws with the game's own pipeline**, so what you see is what the game
draws: the same shadow cascades with the game's sizes (`src/shadows.js`), the
G-buffer materials (`src/materials.js`, with the figure flag that makes
`post.js` thin a small person's ink), the ink pass (`src/post.js`) and FXAA. The
render targets and the subject's screen size (`uSubject`) are shared with
`main.js` through `src/pipeline.js`. The people are the game's own classes: the
traveller is a `Humanoid` in its outfit with its `Gear` (hero-marked), everyone
else an `NPC` (`src/npc.js`) restyled to the look, with its cloth cape. A studio
render of Kip or Nima matches a `captureView` of the same person in the game.

The panel (left; under the picture on a tablet), every setting kept in the URL:

- **Who**: the traveller, a story person of any world (their palette, head, cape
  and look from the story data, dressed by `costumes.js` as the game does), a
  crowd person by world and seed (`crowdLook`), or a blank body (m / f). In the
  City-Shaft, *Where* picks the tribe by depth (`zoneIncal`).
- **Lineup**: the world's story people side by side, or N crowd people with
  their GPU crowd figures (`crowd-shader.js`) a row behind; *GPU crowd twin* puts
  the figure next to one person.
- **Body**: the build (`BUILDS`) and the morphology sliders of `src/morph.js`
  (`BODY_MORPHS`): height, shoulder width, chest, belly, hips, arm / leg / neck
  thickness (radial, on the mesh, like the builds), neck length, arm and leg
  length, head, hand and foot size (on the bones, uniform scales; longer legs
  lift the pelvis, `Humanoid.lift`). `Humanoid.setMorph(morph)`.
- **Outfit**: hair or headwear (`HEAD_IDS`, the hairstyles first), beard, mask,
  shoulder piece, held prop, cloth pattern, robe hem and flare, cape length and
  width, satchel; colour pickers for every palette slot, with the world's
  palette as swatches; the cape's cloth simulation on / off (off: the baked
  drape) and the wind.
- **Face**: variants (`FACE_PRESETS`) and the sliders of `FACE_MORPHS`: eye
  size, spacing and height, nose length and width, jaw, chin, cheeks, brow
  ridge, face length, head width (bind-space warps of the head, eyes and brows,
  `morph.js warpFace`; the face ink's landmarks move with them), and the drawing
  of `faceInk` (age lines, mouth width, freckles, lid line weight: `uFaceKit`).
  `Humanoid.setFace(face)`.
- **Expression**: a dialogue tone (`src/story/tone.js`), how much of it, talking
  (the mouth on the syllables), blinking, what the eyes follow (the camera, the
  red ball you can drag, glances, or fixed gaze sliders), and the expression's
  own sliders: smile, mouth open, brow (furrow – raise), brow tilt (anger –
  worry), squint. See below.
- **Animation**: the game's blend (standing, walking, jogging, running, talking,
  seated) or any clip of the library as authored; speed, pause and scrub; walking
  over the floor; the traveller's feet planting (`plantFeet`, as the player's;
  the game's NPCs don't plant theirs).
- **Light and ink**: the hour (default: the world's own), turning the sun round
  the person, the world's light (`lightAt`: the Signal Market is lit from
  straight above, the City-Shaft and the Buried Machine's canyon more steeply),
  the world's sky or a flat colour (the portrait backdrop), the floor, the ink
  preset (the world's touches, or any of `PRESETS`), the post pass's debug views
  (`DEBUG_VIEWS`, with *Drawn detail* showing the faces' ink alone), hatching,
  shadow detail (next to the traveller, further off, the handheld preset) and
  the render scale.
- **Views** (over the picture): full body, bust, face, far away (the status line
  gives the person's height on screen: `post.js` thins a figure's ink between
  70 and 260 px), turntable. Drag to orbit, wheel or pinch to zoom.
- **Share**: copy the settings as JSON (paste the `morph`, `face`, `look`,
  `expression` into the code), copy the link, save the image.

### Expressions and hairstyles

`src/expression.js` gives every dialogue tone an expression (`TONE_EXPRESSIONS`:
smile, open, brow, browTilt, squint, gaze) and `expressionFor(tone, { talking, t })`
adds the mouth's movement while speaking. `Humanoid.setExpression(e)` draws it:
the face ink (`uMood` / `uMood2` in `materials.js faceInk`: the mouth's corners
bend up or down, it opens into a dark shape, the bags and the nose-mouth folds
lift with a smile, frown creases, lines across the forehead), the brows'
geometry (`morph.js browPositions`: raised, lowered and drawn together, inner
ends up or down), the lids (a squint narrows them, `updateEyes`) and the gaze.
Neutral values draw the face exactly as before, so the game can wear the tone of
each spoken line when it wants to. Each person's materials are their own
(`Humanoid.ownMaterials`, as `NPC.restyle` makes them).

Hairstyles sit on the skull's own shape (`costumes.js scalp`, an egg fitted
to both bodies' heads, cut along a hairline over the brow, round the temples to
the nape) instead of the round cap that read as a bowl cut; the tribes wear them
(see below). *Hair* in the outfit list has **bare: their people's hair**, the
style the person's tribe would give their bare head. `tests/studio.test.js`
covers the URL state, the build entry, the morphs, the expressions and the hair.

### Hair, faces that talk, the traveller's face

- **Hair on the skull** (`src/costumes.js`). `scalp()` is a shell over the skull egg
  from a hairline: high over the brow, the temples' corners, lifted round the ears with a
  sideburn in front of them, down to the nape (`hairline`); thicker toward the crown
  (`crown`), lifted at the brow (`quiff`), lumpy (`bump`), or open at the crown (`top`, a
  tonsure). `curtain()` is hair falling from it round the back and sides, open at the face.
  The **hair cap** under every hat and most styles (`hairCap`) is a scalp now, so even the
  hats have a hairline under them. Seventeen styles (`HAIR_IDS`): `short`, `hair` (a
  topknot), `tail`, `long`, `bun`, `crop`, `shaved`, `bald`, `curls`, `braid`, `flow`,
  `locks`, `crest`, `bob` (with a fringe), `twin` (two buns), `swept`, `tonsure`. A style
  draws the shared cap and its own pieces (`parts`); a full body draws its own shape of the
  hair instead of the cap (`base`: the curls' knots, the quiff), the crowd figure keeps the
  cap, so its vertex count stays where it was (each world's figure: within a few vertices
  of before, `tests/costumes.test.js` keeps the budget).
- **Each people its own hair** (`tribe.hair: { m, f }`, weights). A bare head (`'hair'` or
  `'short'` in a tribe's `heads`, or a story person's) is drawn in the tribe's styles, a man's
  or a woman's (`hairstyleOf`, from the draw the look already made, so every other part of a
  look is what it was): close crops, curls and braids in the desert; swept hair, bobs and
  pinned buns on the City-Shaft's rim, ponytails in the middle levels, shaved heads at the
  bottom; tonsures in the bell monastery; crests and twin buns among the mechanics; long
  loose hair in the garden; bald heads and buns among the listeners; locks and braids in the
  swamp; curls, crops and braids in the market. The beard (`MASKS.beard`) is a shell round
  the jaw now, up the cheeks to the sideburns, the mouth clear.
- **The crowd shader** packs the head id as `id + 64 × hair cap` (`HEAD_ID_LIMIT`, was 32),
  so there is room for more styles; a world's figure bakes only the styles its tribes can
  give (`crowd.js worldPieces`), not the generic ones.
- **Faces that talk** (`src/talk-face.js`). While someone says a line they wear its tone
  (`expressionFor`), their mouth opening and shutting on the syllables the voice sings (the
  vowel sets how wide: `syllableOpen`; each syllable shuts as the next begins); after the
  line they keep the look a moment (`TALK_FACE.hold`), then ease back to their face at rest
  (`Humanoid.restExpression`); one tone blends into the next. `talkFaces.drive(h, { speaking,
  tone, mouth })` each frame, `talkFaces.update(dt)` once (main.js). Driven: the person you
  talk to (a story person or a crowd person's pooled body) and the traveller on his pages
  and when he answers (`Dialogue.faces()`: the conversation's syllables are timed on its
  own clock, `mouth(who)`, `answering()`), and the one villager within 12 m whose balloon is
  up (`NPC.balloonFace`, from the plan its mumble was sung with: `speakBalloon` returns it).
  During a conversation the traveller's eyes are on the other's face (`player.eyeTarget`).
  Everyone's materials are already their own (`NPC.restyle`; the traveller's by `markHero`),
  so a moving face costs a few uniforms a frame; `setExpression` re-poses the brows' geometry
  only when the brows move, and a face at rest is let go.
- **The traveller's own face** (`TRAVELLER.face`, `Humanoid.ownFace`): he is about
  twenty-six, so not the people's modelled face (long, hollow-cheeked, lined): fuller
  cheeks, a shorter lower face, a smaller nose, a softer brow, a wider jaw, larger eyes,
  hardly a line, a few freckles; at rest the corners of his mouth a little up
  (`TRAVELLER.rest`). His hair is his own (`travellerHair`: a short cut and a tousled fringe
  falling over the brow from under the helmet's liner). The studio shows him with it (its
  face sliders go on top of it).
- **The enamel star** (the box item `star`, `src/boxes/effects.js`) sat where the old hood
  was and poked out through the top of the bubble helmet; on the traveller it is pinned on
  the liner over his fringe, inside the glass (`TRAVELLER_STAR`).
- `tests/hair.test.js` (every style on both skulls and in the crowd, the hairline, each
  people's own set, story people, the 64-id packing, the parents),
  `tests/talk-face.test.js` (syllables, the tone on and off, the set of faces, a
  conversation's faces, the brows and the materials on a real body), `tests/traveller.test.js`
  (his face, his hair inside the helmet, the star inside the glass).

## Capes at a distance, and people up close (v0.39)

- **Capes hang at rest far off** (`src/cape.js`). Cloth is only simulated near the
  camera (70 m, 30 m on the Handheld preset); further off a cape used to stay in
  the air where it was last simulated, and drop from its stiff cut as you came
  near. Now each cape has a *drape*: the cloth at rest on that body, in the
  collar's space. Out of range the cloth eases onto it over half a second and the
  mesh is parented to the collar (`Cape.rest` / `hang`), so it walks with its
  wearer at no cost. Coming close, the simulation starts from the drape
  (`reset`). The drape is baked by letting the cloth settle, heavily damped
  (`Cape.bake`, ~1 ms, one a frame), shared by capes of one cut on one kind of
  body (`NPC.drapeKey`: kind, build, standing or seated), and refreshed from the
  simulation while the wearer stands still and the cloth is at rest. A crowd
  person promoted to a full NPC gets the shared drape, so their cloth no longer
  drops in front of you. The capsule collisions are plain arithmetic now, a third
  cheaper and with the same result.
- **Nobody shakes when you walk into them or talk nose to nose.** Nothing stops
  you walking into people, and the way to you was an atan2 of a few centimetres:
  every small step swung them round and back. `holdAim` (`src/crowd.js`, also used
  by `src/npc.js`) follows you from 0.7 m out and holds its way inside 0.25 m.
  A standing crowd person steps out of your way round you, not through you (the
  offset turns, its way held while you stand on their spot), and their pace is
  smoothed so the walk doesn't flicker on and off. A walker keeping clear of you
  judges the lane from where they'd walk without the step, along their path rather
  than their heading (turned to greet you, that is you), so they step aside once.
  The two-shot keeps its last good line between you when you stand too close for
  one. `tests/close-contact.test.js` and `tests/cape.test.js` cover them.

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
  Each placement's `hint` makes a small quest (`box.<id>`, "A Makers' Box"):
  it starts `BOX_QUEST_DELAY` s after you arrive while the box is shut, its one
  step says where to look and points the scout at the box (locator `box.<id>`),
  and the `box.<id>` flag finishes it. The desert's first box is the story's.
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
- **Tongues** (`LANGUAGES`, by level id): Qanati, Shaft cant, the Vael hush, cloud-monk
  chant, Hangar clatter and so on, each with its own glyph script. The traveller's
  translator resolves the glyphs at the caret into your words (no label: the effect says it).

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
  pushes, and the prompts follow. (Replaced by the positional layout and the "Controller buttons"
  setting, see Controller.)
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
- Known: on desktop Metal (ANGLE), Lorn II and the Buried Machine run about 1 ms slower
  per frame than before despite fewer draws (still over 200 fps here); the desert and the
  City-Shaft are about 1 ms faster.

### Measured on the Retroid Pocket Nova
The handheld itself: Snapdragon QCS8550, Adreno 740 (up to 680 MHz), a 1280×960
60 Hz screen at 2× (640×480 CSS px). Measured in the device's Chrome 154 (ANGLE on
OpenGL ES), Handheld preset, with the game served from a Mac over USB. Note: the app
itself runs in the system WebView, which on this unit is still version 109; it was not
measured (a release build can't be inspected, and no side-by-side debug build was installed).

Before this pass (build `1cecfda`), 20 s each, walking forward while the camera sweeps
left and right; load is navigation to first frame:

| Where | Load | Median ms | 95th % | 99th % | fps | Draws | Triangles | Scale | GPU busy |
|---|---|---|---|---|---|---|---|---|---|
| Title screen (3D view) | 0.1 s | its 30 fps cap, 1.2 ms CPU a frame | | | | | | 834×598 px | 26 % |
| Ship interior (prologue) | 5.7 s | 16.7 | 18.1 | 18.8 | 60 | 214 | 0.40 M | 0.9 | 77 % |
| Desert, open dunes | 5.5 s | 16.8 | 18.3 | 19.6 | 60 | 540 | 0.74 M | 0.85–0.9 | 69 % |
| Desert, Qanat streets | 5.8 s | 16.8 | 19.7 | 34.3 | 59 | 349 | 0.81 M | 0.8–0.9 | 90–99 % |
| City-Shaft rim | 6.4 s | 16.4 | 22.4 | 37.3 | 57 | 1057 | 3.3 M | 0.75 | 99 % |
| City-Shaft, bottom terrace | 6.5 s | 16.5 | 33.9 | 37.5 | 57 | 902 | 2.6 M | 0.7 | 99 % |
| Vael | 4.3 s | 16.5 | 19.0 | 19.7 | 60 | 423 | 0.54 M | 0.75 | 67 % |
| Vael II | 4.5 s | 16.7 | 19.1 | 35.8 | 58 | 439 | 0.86 M | 0.8–0.85 | 99 % |
| Hangar | 4.1 s | 16.6 | 18.3 | 19.3 | 60 | 581 | 0.56 M | 0.75 | 65 % |
| Buried Machine | 4.3 s | 16.6 | 18.4 | 19.5 | 60 | 402 | 0.84 M | 0.8–0.85 | 75 % |
| Viridel | 4.1 s | 16.6 | 18.5 | 19.2 | 60 | 503 | 0.67 M | 0.75 | 70 % |
| Spheres | 4.9 s | 16.6 | 19.1 | 20.4 | 60 | 507 | 1.0 M | 0.8–0.85 | 81 % |
| Lorn | 4.7 s | 16.6 | 19.1 | 20.0 | 60 | 472 | 0.64 M | 0.8–0.9 | 76 % |
| Lorn II | 5.2 s | 16.8 | 35.0 | 36.3 | 54 | 491 | 1.5 M | 0.75 | 99 % |
| Bazaar | 4.4 s | 16.6 | 18.5 | 19.7 | 60 | 481 | 0.79 M | 0.75–0.8 | 78 % |

No world throttled in these runs (thermal status 0 throughout; the GPU reached 72–74 °C and
held 680 MHz). Where the 95th percentile sits at ~34 ms, every few frames missed the 60 Hz
refresh while the average stayed over 54 fps, so dynamic resolution kept the scale (or even
raised it): a steady stutter.

What costs what (`bench.mjs`: the frame timed in a tight loop at a fixed 0.75 scale; relative
numbers): on the bottom terrace the near shadow map was 7 of 29 ms (about 550 draws and
1.6 M triangles, every frame) and the far map (every 4th frame) 1–2 ms; the ink pass, flora, crowd, NPCs
and the ground ink were each within the noise (≤ 1 ms); 0.5× instead of 0.75× saved 5 ms.
In Qanat: near shadows 4 of 31 ms, the ink pass ~1.7 ms, resolution 0.5× −7 ms (fill rate).

Changed for the Handheld preset:
- **Dynamic resolution counts missed refreshes** (`adaptScale` in `perf.js`, `steady` / `hold`
  in the preset): three or more frames in half a second over 1.5× the quickest is "too slow"
  however high the average; it climbs only through windows with none, and after such a drop
  waits 20 s before trying higher. Bottom terrace: 95th percentile 33.9 → 20.3 ms (settling at 0.65).
- **The near shadow map refreshes every other frame** (`nearEvery: 2`, as Low already did;
  never on the far map's frame): half its cost on average.
- **The City-Shaft's trees** (all presets) were one mesh per terrace and kind, each a full ring
  round the shaft, so no pass could leave any out; they are now split into eighths of the ring
  (same trees: placements, sizes and colours unchanged, `tests/incal-trees.test.js`), still drawn
  right across the shaft (`userData.drawFar`). At the bottom terrace: 0.13 M fewer triangles in
  the view and 0.18 M fewer in the near shadow pass.

To repeat (`scripts/handheld-perf/`): enable USB debugging on the device, then
`adb reverse tcp:5219 tcp:5219`, `adb forward tcp:9339 localabstract:chrome_devtools_remote`,
`npx vite build && npx vite preview --port 5219 --strictPort --host`, open
`http://localhost:5219/` in the device's Chrome (`adb shell am start -a android.intent.action.VIEW
-d http://localhost:5219/ com.android.chrome`), and run
`node scripts/handheld-perf/measure.mjs <label> [desert,qanat,...] [seconds]` (one JSON line per
place) or `node scripts/handheld-perf/bench.mjs <place> [base,noNear,...]`. `ANDROID_SERIAL`
picks the device. The tab keeps its own storage (not the app's saves). Afterwards
`adb reverse --remove-all` and `adb forward --remove-all`.

### Levels of detail far away (`src/lod.js`, `src/lod-core.js`)
A distant building, rock or plant is drawn with a coarser copy of itself, never coarser than the
Graphics preset allows on screen (`lodPx` in `QUALITY_PRESETS`: 1 px for Auto, Medium and High,
1.5 for Low, 2 for Handheld; High's 1.5× resolution makes it finer, dynamic resolution coarser).
- **The copies** (`simplify`; the clustering itself, on plain arrays, in `lod-core.js`): vertex
  clustering on a grid. Every vertex in a cell moves to one point, where it best fits the planes
  of the triangles round it (a quadric: corners and edges stay put); a triangle left with two
  corners in one cell goes. So that nothing shows: nothing merges across separate pieces (a
  decal stays on the ground, a bench's legs under its seat); normals (26 directions), colours
  and the shaders' own attributes are never blended; a point where two colours meet keeps its
  place (colour edges are inked); a face that would turn over keeps its corners; long thin parts
  (poles, cables, antennas, limbs) only thin out along their length, by cell and by eighths round
  their own centre, both ends kept; the tiles of one mesh (`tileScene`) keep their shared border.
  The error stays under a cell, so a level whose cell is under `lodPx` pixels looks the same,
  outline included.
- **Choosing** (`LodManager`, `pickLevel`): every static mesh worth it (merged blocks and kits,
  rocks, instanced props; never the terrain, which is dug into, nor people, vehicles or anything
  that moves) has levels whose cells double, 2^j of its own units. Each frame, before the passes,
  its distance (to its bounding sphere) gives the cell that fits and the mesh swaps its geometry
  for the coarsest ready level under it: no extra objects or draw calls; instances, materials,
  visibility and bounds untouched. A level holds until the distance is ~10 % past its band either
  way (no flicker on the edge). It is built the first time it is wanted, in a web worker
  (`lod-worker.js`, 7 kB), two at a time; until then the finer one draws. A level that would keep
  more than 80 % of the triangles isn't kept.
- **Shadows**: in the far cascade's pass each mesh goes at least down to the map's texel (1.1 m):
  what the map can't resolve it doesn't need (`shadowPass` / `viewPass`).
- **Sets that sort their own instances**: flora draws its far cells from a second mesh with a
  coarser copy of the plant (`farLevel`, at most 55 % of the triangles); the crowd's far figures,
  past the same rule, become a distant figure simplified to 0.1 m (cape and robe, which the
  shader shapes, as they are); the desert's smoke column swaps its puffs for 80-face ones once
  their facets are under `lodPx` (`sphereError`). The ship's smoke, flame and dust pools (490
  balls of 180 triangles, drawn in every world) are hidden while none is alive.
- **Collision is untouched**: the physics was baked from the full meshes at load, and a level
  points back at its source (`userData.lodSource`), which `physics.js` bakes instead.

Measured in headless Chrome (Metal, 1600×900 at render scale 1) from four fixed views per world:
at the spawn, 12 m up looking back, 120 m up over the widest vista, 400 m up looking down on the
world. Millions of triangles summed over the four views, before (build `4d23384`) and after:

| World | Medium, all passes | Medium, the view | Handheld, all passes | Handheld, the view | Handheld, the view from 400 m up | Draw calls, Handheld |
|---|---|---|---|---|---|---|
| Desert | 4.07 → 3.75 (−8 %) | 2.50 → 2.23 (−11 %) | 3.00 → 2.66 (−11 %) | 2.38 → 2.09 (−12 %) | 0.44 → 0.37 (−17 %) | 1780 → 1772 |
| City-Shaft | 9.61 → 8.66 (−10 %) | 5.03 → 4.39 (−13 %) | 5.69 → 4.73 (−17 %) | 3.99 → 3.31 (−17 %) | 1.83 → 1.51 (−18 %) | 3104 → 3093 |
| Hangar | 2.43 → 1.92 (−21 %) | 1.18 → 0.78 (−34 %) | 1.60 → 1.10 (−31 %) | 1.15 → 0.73 (−36 %) | 0.35 → 0.21 (−40 %) | 1375 → 1365 |
| Vael | 2.46 → 2.06 (−16 %) | 1.39 → 1.02 (−26 %) | 1.73 → 1.33 (−23 %) | 1.33 → 0.96 (−28 %) | 0.30 → 0.20 (−34 %) | 1350 → 1338 |
| Vael II | 3.87 → 3.42 (−12 %) | 2.14 → 1.75 (−18 %) | 2.47 → 1.99 (−19 %) | 1.88 → 1.44 (−23 %) | 0.44 → 0.32 (−28 %) | 1318 → 1306 |
| Viridel | 3.24 → 2.81 (−13 %) | 1.68 → 1.31 (−22 %) | 2.19 → 1.77 (−19 %) | 1.63 → 1.25 (−23 %) | 0.38 → 0.27 (−29 %) | 1565 → 1553 |
| Lorn | 2.92 → 2.50 (−15 %) | 1.47 → 1.09 (−26 %) | 1.98 → 1.56 (−21 %) | 1.43 → 1.04 (−27 %) | 0.32 → 0.20 (−36 %) | 1624 → 1613 |
| Lorn II | 7.38 → 6.93 (−6 %) | 2.39 → 2.02 (−16 %) | 3.57 → 3.13 (−12 %) | 2.04 → 1.66 (−19 %) | 0.48 → 0.37 (−23 %) | 1220 → 1201 |
| Buried Machine | 3.76 → 3.30 (−12 %) | 2.09 → 1.70 (−18 %) | 2.70 → 2.25 (−17 %) | 2.06 → 1.66 (−19 %) | 0.54 → 0.41 (−23 %) | 1348 → 1336 |
| Spheres | 5.17 → 4.71 (−9 %) | 2.53 → 2.15 (−15 %) | 2.92 → 2.48 (−15 %) | 2.04 → 1.65 (−19 %) | 0.41 → 0.31 (−25 %) | 1505 → 1488 |
| Bazaar | 3.83 → 3.13 (−18 %) | 2.35 → 1.81 (−23 %) | 2.28 → 1.63 (−28 %) | 1.78 → 1.24 (−30 %) | 0.49 → 0.32 (−36 %) | 1303 → 1284 |
| All | 48.72 → 43.18 (−11 %) | 24.75 → 20.27 (−18 %) | 30.11 → 24.64 (−18 %) | 21.72 → 17.04 (−22 %) | | |

Of that, the idle puff pools are about 0.35 M per world (88 k in every view); the levels
themselves, measured in one page with `lodPx` off and on, take 4 % (Medium) to 6 % (Handheld) of
all triangles, 7 to 10 % in the widest views, up to 17 % in the Bazaar and 11 % in the Hangar and
City-Shaft. Most of what's left far away is already as plain as it can be at a pixel or two
(boxes, long extruded rings, the people's 12.5 k-triangle skinned bodies, which are not touched).
Draw calls don't change (the puffs: three fewer).

Frame time on this Mac doesn't move (the same-page A/B is within ±0.5 ms): it is bound by draw
calls and fill, not triangles. Where vertices do cost it shows: in SwiftShader (software
rendering, so vertex work is CPU time; 480×360, Handheld) the City-Shaft from 400 m up went from
467–496 to 347–373 ms a frame, the Hangar from 110–129 to 66–72, the Bazaar from 99–132 to 71–81,
the desert vista from 119–135 to 109–115 (two runs each; nearer views gain 5–20 %). The handheld's
GPU sits between the two (the near shadow map was 7 of 29 ms on the City-Shaft's bottom terrace,
1.6 M triangles), so the Retroid should gain on the wide views; not yet measured there.
Screenshots of every view with the levels off and on differ in at most 0.10 % of the pixels on
Handheld and 0.07 % on Medium: single pixels of distant people and thin lines; no holes, no
popping (the tests check bounds, outline rays, closed shapes staying closed, no turned faces,
rods and seams, hysteresis, and that the collision is the same).

Tried and left out, for not paying:
- **Merged shadow casters** (every static caster of a 96 m region drawn as one mesh in the near
  and far passes): the City-Shaft's high view went from 767 to 564 draw calls in the near pass and
  412 to 222 in the far one, but the frame time didn't move (shadow draws share one material and
  are cheap), and at ground level the regions drew more triangles than the culled members did.
- **Cheaper far shading**: switching every material's drawn detail off (glyphs, grids, patterns,
  creases, folds, scrub, ripples) everywhere saved 0–0.3 ms, within the noise; far objects cover
  few pixels, so far-only would save less still.
- **Impostors** for the farthest landmarks: what's left far away is draw calls and the ink pass,
  which a card wouldn't remove, and a card can't keep the ink outline steady as the view turns.

### The galactic map and the route (v0.38)
- **The route** (`src/story/route.js`, `knownWorlds`): the worlds open up in `ORDER`. The
  desert (the crash) is always known, then the next `AHEAD` (2) worlds that are not done,
  so there is always a choice of two. Finishing a world (`world.<id>.done` or its story
  page) brings in the next one, and the closing page's toast names it ("New on the ship's
  map: …"). Worlds you have visited, or stand in, stay known. Home opens on its own
  (`src/story/ending.js`). The level picker (L) and the sketchbook (J) apply the same rule; `?level=<id>` and the
  dev menu bypass it.
- **The map** (`src/ship/starmap.js`): unknown worlds are faint unnamed dots along the
  route. Known worlds are drawn planets in flat colours (`src/ship/planets.js`, no
  screenshots): a shadow crescent, an ink outline and one mark each (dunes, bands,
  craters, a ring, a moon, lit windows); ✦ marks a discovery, a dashed ring a world not yet
  visited. The chart is a grid: the field (the route) and a side column with the info
  panel (under the field on a phone held upright), so the panel never covers a name.
  `chartLayout(n, W, H)` places the worlds in pixels for the field's size: a ring round
  home when it fits at 80% scale or more, else a snake of rows. The tests check that no
  two footprints (disc, two lines of name, a tag) overlap at the measured field sizes.
- **Travel asks first:** choosing a world opens "Travel to X?" with Yes / No (Enter / Esc,
  a click, A / × and B / ○). The press that asks never answers: held keys repeat
  (`e.repeat`), the pad needs a fresh A, and a Yes within 150 ms of the question is ignored.
  B or Esc in the question says no and leaves the map open.
- **The gates are gone:** the stone gates (`Gate` in `quest.js`), the page-turn transition
  and the edge crossings (`via=gate`, `via=edge`) were removed; the scout's last objective is
  "Back to the ship". Ship sites no longer keep clear of the old gate spots; the City-Shaft and the market,
  where that moved the ship, pin it where it stood (`SITE_OVERRIDES`).

### The strike's signature: why these worlds
- **The reason for the route** (`src/story/signature.js`, the lore in `LORE.md`). Whatever
  struck the ship in the prologue left a magnetic signature in the glyph-shaped scar on its
  hull, a slow pulse in threes. The ship charts only the worlds whose field carries the same
  pulse (`SIGNATURE_WORLDS`: every world in `ORDER`, each with a reading and the place it is
  strongest), and reads the trace further on from each one you finish (the route's unlock
  rule, unchanged). Home has none: the ship knows that way by heart.
- **Where it shows:** the ship says it as the emergency power comes on after the crash
  (`CRASH_LINE`, the prologue's hatch), the first time the map opens with power (`MAP_LINE`,
  flag `signature.told`), and out of the jump the first time it comes to a world
  (`arrivalLine`, flag `signature.<id>`); the toast for newly charted worlds says the
  signature reads there too (`revealNote`). On the map (`src/ship/starmap.js`) every
  signature world wears a small glyph badge, the panel gives its reading ("matches the
  scar", then where it is strongest once visited), and a dashed box beside the chart
  explains it (a short form on small screens). A few locals notice it in their own words
  (compasses in Qanat, the City-Shaft and the Hangar, the antenna dish in the market, Saba
  at the Great Crystal). `tests/signature.test.js` checks that every destination carries it.

### A quieter screen: conversations and prompts
- **No button reminders.** The status box (`updateHud` in `src/main.js`) shows the place,
  gauges, the objective and relics, and a prompt only for what is right here (the ship's
  hatch and console, a lens); a ride's controls show for six seconds after you get on.
  The controller's button bar is gone except in photo mode; the full controls live in the
  settings (and H for the keyboard's). Story pages, item cards and toasts name no keys.
- **A controller means no touch buttons.** `body.controller` hides `#touch` and the gear.
  A connected pad (the Retroid's own controls via `native-pad.js`) counts as in use until
  the screen or the keys are touched, so a handheld starts with a clean screen.
- **Round button badges** (`src/prompt-keys.js`): `keyBadge('E')` is
  `<b class="key">E</b>`, a small ink circle (a pill for "X / □"); `badgeLine()` badges the
  button at the start of each " · " part of a status line. The badge holds the plain
  button name, so `native-pad.js` still renames it in place.
- **Conversations** (`src/story/dialogue.js`): the speaker's name sits in a caption box
  across the panel's top edge next to the portrait, larger on a 1080p screen; no hint
  line, no translator tag (the glyphs resolving at the caret remain), and a small pointer
  when a press turns the page. While talking, the status box, floating prompt, button bar
  and gear are hidden.
- **Portraits** (`src/story/portrait-bg.js`): the sketch is the person alone (`isolate()`
  hides everything else for the shot), against one flat colour: the world's own pastel
  tone, or another of that world's tones when they wear something close to it
  (`backdropFor`). `captureView(…, { keep, backdrop, fov })` draws it; the composite's
  `uBackdrop` uniform (`src/post.js`) paints the sky pixels flat.
- **Story pages wait for the talk to end** (`Story.showPage` in `src/quest.js`): a world's
  closing page, which comes a moment after the last line, used to open over the
  conversation and stay up while A turned the pages under it. It is now drawn and kept in
  the sketchbook at once, and opens when the conversation closes (`story.waitFor`); a
  controller press goes to whatever is on top (`menuRoot`).

### Highlights in the dialogue
- **`*words*` in the story text are highlights**: the places to go or remember, the next
  thing to do, key items and the hint that solves a puzzle ("Go to *the back gate*",
  "*Fill the jar*"). `formatText` (`src/story/dialogue.js`) draws them bold in a warm red
  on a pale yellow mark, in the panel, in the choices and in the balloons over people and
  the crowd (`npc.js` / `crowd.js` use `formatText` too, so no star ever shows).
- **A long span is a quotation** (`isQuote` in `src/story/voice.js`: more than eight words,
  or more than one sentence): a letter or a recording, drawn as before (`em.quote`, the
  yellow mark only). Narrated things voice only their quotations, never a highlight; the
  broadcast (`narrator: true`) voices every starred word.
- **Writing them**: a few words, no wording changes, the tone tag and `{motifs}` outside
  the stars; usually one or two per page that gives a direction, none in flavour or lore.
  `tests/highlight.test.js` checks that every star in the story data pairs up.

### The title screen, five saves and the pause menus
- **Boot order** (`src/boot.js`, the page's entry): the title screen (`src/title.js`) runs
  first and only then loads `src/main.js`, so the save slot chosen there is the one every
  store reads. A world asked for directly skips it and plays the current slot:
  `?level=<id>` (the ship's arrivals, the dev shortcut), `?prologue=1`, `?ending=1`, and
  `?start` (a save started over from the Start menu; the URL is cleaned so a reload goes
  back to the title). Quit to title is just a load of the bare page.
- **Title screen**: the name in comic lettering over a live view of the land above the
  clouds (below), then Continue (the slot played last),
  Saves, Settings (the same settings, `SettingsMenu({ el, title: true })`) and, in a desktop
  browser, Full screen. Keyboard (arrows / WASD, Enter, Esc, Delete), mouse and touch, and a
  controller through `Controller` + `menuNavigate` (the save list moves by rows, left /
  right reaches a save's Delete). It imports nothing that loads the game state, and marks
  the Android boot heartbeat (`markBooted`) once it is up. Styles: `src/menus.css`.
- **The title's vista** (`src/title-vista.js`): a golden-hour view over a sea of cloud, drawn
  by the game's own pipeline (G-buffer materials, the ink pass of `post.js` in the 'Moebius
  print' style, the sky with two pale moons). Mushroom tables, needle spires, balanced stacks
  and bobbing floating stones from the Sky Stones' rock builders (`src/levels/sky-stones-kit.js`,
  shared with `arzach2.js`) stand to either side of the menu, rose mesas close the horizon, a
  few birds circle (`life.js` Flock). The camera (`vistaCamera(t)`, pure) sweeps slowly round
  the great table and back every 4 minutes, high over the cloud, the sun to one side.
  - *Boot*: the menu shows at once over a CSS sky gradient; the module is imported after the
    menu has painted, builds in small steps (`buildVista`, yielding so input keeps working),
    compiles its shaders (`compileAsync`), and fades its canvas in on the first frame. The
    heartbeat doesn't wait for it. Picking a save before it is ready aborts the build.
  - *Light*: the sun's shadow map is drawn once (one wide cascade; nothing in it moves);
    resolution follows the Graphics preset, never above 1×, capped at 2.1 MP (1 MP on a touch
    screen, 0.5 MP and 30 fps on a handheld, with fewer puffs and coarser rock there), and drops
    by steps if frames come slowly. Reduced motion draws one still frame.
  - *Fallback*: no WebGL, a software GPU (SwiftShader / llvmpipe) or a lost context shows the
    drawn SVG backdrop (`BACKDROP`) instead.
  - *Clean hand-over*: it touches no save. On continue it stops drawing (its last frame fades
    out with the title), then frees its renderer and GPU context (`forceContextLoss`) and puts
    the shared surface uniforms (sun, shadow maps, hatching style) back as they were, before
    `main.js` makes its own renderer. `tests/title-vista.test.js` checks the imports, the
    resolution caps, the camera path and the build budget.
- **Save slots** (`src/save-slots.js`): `slotStorage` is a localStorage look-alike that files
  each progress key under the active slot (`moebius.game.v1` in slot 2 is
  `moebius.s2.game.v1`): the game state, the sketchbook, the saved position and the reactive
  world's memory all read and write through it. The active slot is `moebius.slot`, pinned
  for the page on first read. Settings, mute, the pad layout, the changelog's seen mark and
  the update toast stay global. A per-slot `meta` key keeps the time played (counted while
  the game runs, not paused) and when it was last played. `summary(n)` reads a slot's raw
  saves for the selector (world, worlds done, relics, items found); the worlds' names come
  from `src/levels/names.js`, which has no imports. The single save from before the slots is
  copied into slot 1 once (`migrate()`); the old keys are left as they were, so an older
  build (an over-the-air update rolled back) still finds its save.
- **Pause menus**: Menu / Start (O, Esc) opens the Start menu, now full screen (Resume,
  Sketchbook, What's new, Quit to title, where you are and the time played, the settings,
  and "Restart this save from the prologue", which asks inline rather than with
  `confirm()` and forgets only this slot). View / Select (J) opens the sketchbook. Start and
  Select work over a conversation or one of the ship's scenes too (holding B still skips a
  scene). While one of them (or What's new) is open, `frame()` skips the world entirely:
  player, people, crowds, wildlife, vehicles, the ship's scenes and the world's clock
  (`simT`) stop, nothing is drawn, presses don't leak into the game, and the time played
  stops counting.
- **Menu music** (`Sound.menuMusic(on)` in `src/audio.js`): the world's music, effects,
  voices and their reverb now run through one `world` bus, hushed to `MENU_HUSH` under a
  menu while a calm score of its own fades in on a separate bus: a slow pad in D lydian
  (I-V-vi-IV), a music box arpeggio and a falling melody every 32 beats, flute then bell
  (`MENU_SCORE`, `menuBeat(b)`). The title screen plays it on a `Sound('title', { score: false })`
  that fades out and closes as the game loads.

### The ship's cutscenes and the burning tree
- **The close camera in the ship** (`CameraRig` in `src/player.js`): close in, the arm is
  checked with a cone of five rays (`coneClear`), not one, so it can't slip between a bunk's
  posts; the lens is then pushed out of anything within `LENS_R` (a sphere cast with
  `physics.pushCapsule`). Where a wall cuts the arm short the camera climbs up under the
  ceiling and looks down (`INDOOR_PITCHES`, picked for the room each gives, eased), and when
  you aren't turning it, it swings round to the nearest side with room (`swingClear`). The
  shoulder offset and the pitch are eased, so walls beside you no longer shake the view. An
  invisible skirting at the foot of the curved hull (`SKIRT`, `src/ship/model.js`) stops the
  step-up walking you up the wall. `tests/ship-camera.test.js` turns round at spots aboard.
- **Planets that turn** (`strataObject` in `src/materials.js`): strata bands in the object's
  own space, for the prologue's planet seen through the window as the ship tumbles.
- **Engines** (`src/ship/exhaust.js`): flame out of the three bells under the hull
  (`THRUSTERS`) and, where the jets meet the ground, dust in the ground's own colours blown
  flat out from under the ship, stronger the lower it is (`blast`); a puff under each foot
  on touchdown and lift-off. `Ship.floorAt` finds the ground from under the hull (from above,
  the parked ship's own collider is in the way).
- **The hatch** (`setDoor`, `setRamp`): the door pops out of its frame, then slides up the
  hull on its track (a turn about the ship's axis, so it never passes through it); the ramp
  is nested sections that slide out of the doorway, tip down on the hinge, then telescope to
  the ground one after another (`rampPhases`, `poseRamp`). Each phase eases.
- **The approach from space** (`ArrivalDirector`, `src/ship/approach.js`): an arrival opens
  with ~7 s (`APPROACH`) out in space: the destination planet grows ahead in the galactic
  map's colours and mark (a shader writing the G-buffer: flat body, a hatched crescent,
  bands, dunes, craters, continents, windows, a ring or a moon, a rim of air), the ship dives
  into the air in a sheet of fire and a white flash, falls through the world's own sky, and
  then lands as before. Hold to skip, as ever.
- **The burning tree** (`FlameBody (3D: three nested noise-displaced shells, torn open toward the top; was FlameSheet, a card)` in `src/story/flames.js`): one great flame drawn by a
  fragment shader on a card that turns to the camera: flat bands from a pale core to a red
  rim, inked, tongues scrolled up a noise field. It writes a depth that bulges toward the
  camera, so the tree's limbs reach into the fire. Same interface as `Flames`
  (`intensity` for the flares, `setPalette(COOL_FIRE)` for the feast).
- **The tree's bark is a closed solid** (`taper` and the trunk's lathe in `src/desert-city.js`):
  the roots, limbs and the buttress's roots are tubes wound outward and capped at both ends
  with a low rounded tip, each starting well inside the trunk; the trunk's lathe is shut under
  the terrace and by a low crown over the top. (The tubes used to be inside out and open, so
  you saw into the roots; the giant's arm and the cave's ribs and roots share `taper` and were
  fixed with them.) `tests/desert-tree.test.js` welds the bark mesh and checks it has no open
  edges and no flipped faces, and casts rays from the terraces, stairs and trunk: every first
  hit is bark seen from outside.

### Ground ink by distance, steady façades, fine lines on distant people
- **Ground ink** (`src/ground-ink.js`, used by `MODE_TERRAIN` in `src/materials.js`): every
  mark on the ground has a real width in metres. Close up it is a crisp pen line (1 to
  ~1.7 px, anti-aliased from its screen-space gradient, so it holds at grazing angles);
  once it is thinner than a pixel it is drawn lighter instead of thinner, so a patch of
  ground holds the same ink at every distance; once a pattern is too dense to draw it
  hands over to exactly that average tone. Nothing switches on with distance any more
  (the old pixel-width fade made ripples and cracks pop in a band ahead of you).
  Sand: grains near → wind ripples (1.6 m) → long wind lines over the dunes (9 m) → tone;
  in the dotted print style, world-sized dots replace the old pixel-sized stipple on sand.
  Salt flats: small crust cracks near → the big dried-mud polygons → tone; the Voronoi
  search returns the border normal, so crack width comes from the true screen gradient.
  `penLine` / `lineField` have JS twins that `tests/ground-ink.test.js` checks.
- **Flat walls far from the origin** (`vObjRel` in `materials.js`): facet normals came from
  screen derivatives of positions hundreds of metres out (a merged city), whose low bits
  are rounding noise; times those coordinates, the hatching on Qanat's walls turned into
  speckle that changed every frame. The derivative now uses the position measured from
  the camera, and a facet takes a single stroke projection.
- **Façades** (`facade`, `strata`, `gridLines`, `roofTiles`): window glass and shutters are
  anti-aliased and fade into the wall's average tint once windows are a few pixels; the
  wall direction comes from the vertex normal (no jitter); strata bands, window grids and
  roof rows hand over to their average colour or tone before they get dense enough to
  shimmer. Hard tone edges stay hard on purpose: post.js inks them as one solid line.
- **People far away** (`uFigure`, packed as +4 in `gHatch.a`; `post.js`): character
  materials (humanoids, costumes, the crowd) are flagged. Where an inked pixel's kernel
  touches a person, the lines are redrawn by the figure's height on screen: a narrower
  kernel and a lighter outline that stays on the background side once small, and the
  inner lines, drawn detail and hatching fading first. Distant figures keep their
  colours with a fine outline; only pixels that already have ink pay the extra taps. The
  player keeps its own mask (`uHero`).

### Finding the hoverbike, and the vehicles redrawn
- **The hoverbike has to be found** (`src/story/desert-bike.js`): a new game starts on
  foot. Marrow the salvager hid the bike under a tarp in a hollow between the ship and the
  camps (`STORY.bike`; a broad dip, `HOLLOWS` in `src/desert-landmarks.js`), marked by a red
  rag on a pole. Until then `Hoverbike.rest()` lays it there dormant: no "ride" prompt, no
  whistle, no push from the tool, no physics. The errand `desert.bike` ("Something Faster
  Than Walking") starts with Rook near the ship, with Marrow ("Got anything faster than
  walking?"), or once Nour has sent you on; E pulls back the tarp, and with the backpack a
  second E wakes it (`wake()`): the tank swings into its cradle and you're riding.
  Flags: `desert.bike.uncovered`, `desert.bike.found` (for good, per save; a dev-menu box).
  Old saves (`migrateBike`, once): anyone who had the backpack could already ride, so they
  keep the bike; a save without the backpack never rode it and finds it like a new game.
- **Painted vehicles** (`src/vehicle-kit.js`): plain-coloured parts are merged into one
  vertex-coloured mesh per shading (`Paint`), so a vehicle of thirty parts is two draw
  calls; the ink pass outlines the colour boundaries. Moving and glowing parts are small
  meshes of their own. A builder returns `{ root, body, seatAnchor, socket, port, lights,
  jets, animate }`: `lights` are what the fluid lights (`Hoverbike.makePowerLights`), `jets`
  where the hover trails stream from, `animate(dt, vehicle)` the moving details.
- **The hoverbike** (`buildBike`): a long-nosed orange fuselage with a cream beak, teal jet
  fairings, a padded saddle, swept bars and a windscreen, a rudder that turns with the
  steering, a pennant that flutters faster with speed, a hover plate that glows. Seat, bars
  and socket are where they were (9 draw calls, was 17).
- **The skiff** (`buildSkiff`, Lorn): an open boat with a deck and a cream gunwale, its prow
  curled up with a swinging lantern, a teal float on outrigger arms, a striped lateen sail
  that fills with speed and trims into turns.
- **The taxis** (`src/taxi.js`): a round-bellied cab in its colour with a checker band, a
  bubble of ribs over a driver in a peaked cap who looks about, a striped awning over the
  passenger bench (you ride there; the passenger gets out), V-fins that trim into turns,
  wing-tip lamps and a "for hire" sign (lit while free, blinking while it waits, dark while
  you ride), hover rings underneath. Geometry is built once per colour and shared; beyond
  ~75–95 m only the body and its glow are drawn (3 calls), beyond ~135–170 m just the body
  (2). The roof you can stand on is the awning's crest (`solid.top`). Wren's cab loses its
  driver once she has stepped out by the lamp (`driverOut`).
  **People aboard are people-sized** in a cab of any size: the driver and the passenger are
  scaled by `FIGURE_H / scale` (0.9 m seat to crown, the traveller's own), the passenger's
  hips on the bench where yours go. A passenger (`fare`) rides only in traffic: a cab that
  comes when you call (`hail`, or Wren's flying to the lamp) arrives empty, a free cab answers
  before a nearer one with a fare, and a cab back in its lane takes a new fare only out of
  sight; the "for hire" lamps are dark while a fare is aboard. Wren's cab never carries anyone
  (`fares: false`). The bazaar's cabs are the City-Shaft's size (2: at 1 the awning came down to
  the traveller's chin). `tests/taxi.test.js`.
  `tests/hoverbike-quest.test.js` covers the quest, the migration and the budgets.

### The singing spheres, the wheel that keeps turning, and the ring's skin

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

### The recordings, the hologram and the stone
- **No calls home** (`src/story/calls.js`; the arc in docs/story-bible.md, "The
  recordings"). The traveller plays old recordings of his parents on the cockpit console,
  one waiting after each finished world (`calls.<n>`, as before, so saves carry over). He
  asks the reel for the world's word (`REEL`: water, looking up, quiet, bell…) and it plays
  the one match: a line that fits loosely, never an answer. How old they are shows a little
  more each time (`AGE[n]`: a worn date stamp, his own child's voice behind them, "logged
  nineteen years ago", a worn tape), and the console's screen shows the stamp
  (`recordingLabel`). Recording `ENDING_WORLDS` is the last on the reel ("Come home", logged
  "eleven days before the house went quiet"); later ones come from the reel's oldest side
  (`OLDER`). Once-only beats (`calls.beat.<id>`) still follow the journey, and Ilen is a
  recording of the mother's labelled "For when he asks" (`calls.ilen.*`, as before). HUD:
  "E play a recording".
- **The hologram** (`src/ship/hologram.js`): the parents are the game's own people (the
  human bodies, dressed by `costumes.js`, played by the mocap library) projected as
  **coloured busts**: head, neck, shoulders and the top of the chest (`BUST`: cut across the
  chest in the figure's own frame, falling apart into grains below it, the bottom edge just
  over the lens). Each mesh keeps its own colours: `holoLook` reads its ink material (the
  body's clothes by region, as `MODE_OUTFIT`; costume vertex colours; the eyes; plain
  colours) and redraws it in light: two flat tones, a breath of the projector's tint, an
  edge line of paler light, thin climbing scanlines, flicker, slices that slide sideways
  now and then (more when torn up by the prologue's impact), the face's ink lines and a
  mouth that opens with the voice. `PEOPLE`: the father with short brown hair, a full
  trimmed beard (the `beard` mask) and a moustache (`addMoustache`, on the head bone), a
  rust-red shirt; the mother with her long dark hair down (`flow`), a teal scarf over a lilac
  top; the child in yellow. Their hair sits on their own skulls, with a hairline (`costumes.js
  scalp`, see *Hair, faces that talk*), and the beard follows the jaw.
  `show({ face })` turns each bust to the traveller's eyes every frame;
  their heads nod on stressed words, tilt, glance aside or at the other one talking, the
  shoulders breathe and sway. A faint cone and the lens's rings fit the lens (`lens`).
  It is not in the G-buffer: `HOLO.render` draws `HOLO.scene` after the composite into a
  target of its own with a depth buffer (a face hides the back of its head), depth-tested
  by hand against the G-buffer so the traveller in front still hides it, then lays it over
  the frame, slightly translucent, with a soft bloom of its own colours. `callShot` frames
  it from behind his right shoulder and pushes in on the busts' faces (`CALL_FACE`) while
  the hologram is up (`st.close`); `faceRecording` keeps him turned to it. At the stone the
  three busts (`REEL_HOLO`) rise over the reel, looking up at him.
- **The stone** (`src/levels/home.js` `buildTomb`, `src/ship/homecoming.js`,
  `src/story/ending.js`): nobody waits at the door; the window is dark. The cargo check lists
  everything (`tokenList`: the keepsakes, then the makers' small gifts, not the backpack,
  jets or wings). He walks to the parents' stone in the front yard and sets each token on
  the slab (`tombSlots`, `tokenModel`; one short line each, `tombLines`, on a brisk
  `tombTimeline`), last the reel (`reelModel`), which plays `FINAL_RECORDING`, the oldest,
  as a hologram of the three of them over the stone. Then the closing line, an end card and
  the credits ("Left on the stone"). `ending.keepsake` is `all`; saves that ended with one
  keepsake chosen keep it. Coming back later, the stone keeps its tokens.

### Flora: every world's own plants, in clumps
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

### Eyes: a white, an iris, a pupil, and blinking

People's eyes were solid ink: up close, each a black almond. They are now drawn the
ligne-claire way (`src/eyes.js`): a cream white, an iris in the person's own colour with a
darker rim, a round dark pupil and a small highlight, the iris following the gaze and the
lids closing over it to blink. One GLSL helper (`EYE_GLSL`, `eyeIris`) draws the iris for all
three kinds of people, and its detail goes with the size on screen: a few pixels across, the
iris is one dark dot on the white; smaller still the whole eye is one dark mark, so a face at
a distance (or in the 160 px dialogue portrait) still has eyes.

- **Colour**: `IRIS` (browns most, hazels, greens, greys, blues), `s.eyes` in `dressFor`, seeded
  by the rest of the look rather than drawn from its random stream, so every look (and a crowd's
  later ones) is what it was; a story palette may set `eyes`.
- **Full NPCs**: the human model's eyeballs are shaded by `MODE_EYE` (`materials.js`). The
  reshape narrows them and stretches them below the eye line, so `eyeballOf` records their
  centre and radii and the shader finds each point's direction on the round eye; the iris
  sits where that direction meets the gaze. `Humanoid.updateEyes(dt, target)` turns a world
  point into the eyes' bind space (through the head bone's skinning) and `EyeLook` aims them:
  clamped to the eyes' reach (`EYE_REACH`), a quick saccade rather than a drift, glances
  around when nothing is in reach, a blink every 2–6 s (now and then a double one). The model's
  lids open on the lower part of the ball, so the gaze is turned down by `EYE_TILT`. NPCs look
  at the player's face when near or talking (`npc.js`, only within 40 m of the camera); the
  lids are the person's skin (`NPC.restyle` sets the iris and the skin on their own copy of
  the eye material).
- **Crowd figures**: a small flat almond on the head (`CROWD_ZONES.eye`), the iris colour
  packed in `aBody.w` (`packBody`), a blink on the shader's clock per seed. The fragment shader
  draws the white and the iris only on those triangles.
- **The traveller**: the drawn face (`face.js`) keeps its lid strokes; `portraitEyes` fills the
  opening with the white and a slate-blue iris (`TRAVELLER_IRIS`, `uIris`) that moves with
  `uGaze`, ringed by a fine line once the face is large enough.
- `tests/eyes.test.js` covers the colours, the gaze clamping, the blink timing, the eyeballs
  and the aim through the skeleton, and the crowd's eye triangles.

### Faces drawn the Moebius way

The people's faces were a modelled head with a few faint marks and the same dense surface hatching
as everything else. They are drawn now the way Moebius draws a face in his ligne-claire work (Vael,
The Sealed Hangar, The Lodestar, Viridel): flat colour, one shadow tone, very few precise lines.

- **The ink** (`src/face-ink.js`, `FACE_INK_GLSL`, in `materials.js` for the people's skin,
  `MODE_OUTFIT`): pen strokes in the head's rest coordinates, placed by the face's landmarks
  (`uFace`, moved by the face morphs) and bent by the expression (`uMood`, `uMood2`), so they ride
  the skinned head. The eyes: a fine crease over the lid, a flick at the outer corner, a tick under
  the lower lid and at the tear duct. The nose: one line down the shadow side of the bridge into a
  hook round the wing (`uMood2.y`, the side turned from the sun: `Humanoid.updateNoseSide`), a
  lighter hook on the lit side, two dark nostrils. The mouth: a single line with a tick at each
  corner (down at rest, up with a smile), a lower-lip tick, the dark opening; an arc over the chin.
  The ears: a curl round the rim and one inside. Sparse hatching that follows the face: the inner
  socket, under the brow's end, the hollow under the cheekbone (more on hollow cheeks: `uFaceKit2.z`),
  under the lip, a few dashes along the shadow's edge. Age lines by `lines`: bags, crow's feet, the
  folds from the nose, a cheekbone line; frown creases and forehead lines with the brow.
- **Constant on screen, thinner with distance.** Widths are CSS pixels (a 1.3 px pen up close,
  0.7 on a small face); the detail comes in three steps by the face's height on screen
  (`FACE_LOD`): the mouth and the nose hook from 14 px, the small marks from 40 px, hatching and age
  lines from 90 px, and hatching only while its strokes are 3.5 px apart or more. On top of that
  post.js still thins a distant person's inner ink, so a far face is two eye marks, never noise.
  The face ink is written over 1 in `gHatch.b`: post.js draws it as a pen line (up to 0.92 ink),
  darker than the rest of the drawn detail.
- **Flat colour, one shadow tone.** No surface hatching above the chin (`FACE_FLAT_GLSL`; the neck
  keeps its own), none on the eyeballs. The head is lit as one rounded volume (`FACE_ROUND_GLSL`:
  the normals blend 0.72 of the way to a tall egg round the face, so the mouth and brow face
  forward), so its shade is one clean shape split down the nose instead of the low-poly mesh's
  shards; the ink pass sees the skin's own facets for its creases. A face's pixels carry a flag
  (`gHatch.a` + 16): post.js draws no line round its shade and no crease shading over it (the
  sockets are hatched instead).
- **Eyes** (`eyes.js`, `materials.js eyeball`): a crisp lash line along the lid's edge, heavier
  toward the outer corner, coming down with the blink; the iris a flat colour ringed by a pen
  circle, a round pupil, a small highlight.
- **Brows** (`humanoid.js taperBrows`): pulled to their own arched centre line, half as tall as
  modelled at the inner end, a fifth at the outer: one tapered stroke each.
- **Anyone can wear a face** (`NPC` options and spawn spots): `face` (morph.js `FACE_MORPHS`),
  `expression` (worn at rest: `Humanoid.restExpression`), `facing` (stand turned that way).
- **The studio**: a **Close-up** view (eyes to chin), **Lineup → every world's faces** (the
  traveller and a story person of each world; the crowd seed picks which), and **Share → Faces
  sheet**: each person alone, framed on the face, in a grid (`studio.sheet({ cols, w, h, view })`;
  `zooms: [1, 2, 4, ...]` draws the first person from further and further, at 1:1, each cell
  giving the face's height on screen: the distance ladder).
- **The Lab's faces gallery** (`?level=lab`, `LAB_FACES`): twelve giants (4x) in an arc facing
  the hub, every face variant (`FACE_PRESETS`, now in morph.js, and the traveller's) with an
  expression, men and women, and a walkway at the height of their faces (`FACE_WALK`), up a ramp,
  each one's face and expression written on it in front of them.
- `tests/face-ink.test.js`: the detail steps, the nose's side, the shaders, the uniforms on a body,
  the brows' taper, an NPC's own face and facing, the gallery (every variant, facing the hub, the
  walk solid in front of each face, the ramp).

### Qanat's tree ledge, solid terraces, and the dry cave
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
- **The dry cave**: the giant's chest has no water until the rib is pushed off the channel:
  damp stains in the basin and the gutter, a pale tide line where the pool stood. Then the
  stream runs out of the crack down the channel (`cave.setWater(flow, level)` reveals it
  segment by segment with a draw range), and the pool fills the basin from its lowest point,
  widening up its sides (its radius follows the basin's profile, `cave.basinR`). A save with
  the channel already open finds it full (`tests/desert-cave.test.js`).

### The conversation camera keeps a clear view

`src/story/shot.js` picks where the camera stands while you talk to someone or look at
something, so nothing comes between it and what it frames. `pickTwoShot` (talking) and
`pickLookShot` (a thing: no two-shot, the camera behind the traveller's shoulder looking past
them at it) each try a fan of candidate eyes: both sides, several angles round the pair,
distances and heights, and over the shoulder as a last resort. Each is scored by
`sightOf(physics)`: rays from the eye to the faces (or the thing) against the level's BVH and
the heightfield, a ball test for an eye pressed into a wall, bystanders' capsules (NPCs and
crowd people near you) and the two people's own bodies (the traveller's back must not hide
the other face or the thing); every step away from the ideal framing costs a little. The
cheapest wins. `Dialogue.frameCamera` asks again every 0.6 s (people walk into shots), eases
to the new pick, and pulls the camera in along a line it was scored on if something still
cuts it. A thing whose `at` is only where you stand (the foot of the stone hand) passes the
part to look at as `dialogue.start(def, null, at, look)`. While a conversation is open
`player.faceToward` turns the traveller to the person or the thing.

### The clipping audit

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

### The ship's deck: flat, smaller, lived in, a holo table in the middle
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

### Materials: metal, light, the makers' inscriptions and grass blades
- **Metal** (`makeMaterial({ metal })`, `METALS` in `src/materials.js`; the `METAL` block): `painted`,
  `steel`, `chrome`, `brass`, `copper` and `iron`, plus `brushed: true` (with `brushAxis`). The
  view reflected off the surface looks at the sky, the bright horizon or the ground, and each is
  one flat tone, a little wavy (chrome also gets the dark band just under the horizon); brass and
  copper tint every tone with their own colour. The sun's highlight is one crisp near-white shape
  with a paler ring round it; post.js inks its edge like any colour edge. Brushed metal gets fine
  streaks along its axis (in object space, so they ride with it), a few hairlines in the drawn
  detail, and its highlight stretched across them. The sky is the post pass's own (`uSkyTop`,
  `uSkyHorizon` and `uNight` are shared uniforms now); the ground is the level's terrain colour
  (`setEnvGround`, main.js). Used on the ship, the vehicles (`paintMaterial({ metal })`), the
  backpack's tank and bracer, the boxes' items, the gear and trinkets, the Hangar's machines,
  pipes, gears, crown and pistons, the listening stones' brass, the Buried Machine's steel and
  rusted iron, the City-Shaft's railings and gilded palace, the market's brass and painted steel,
  the bell, the observatory, the desert's hulls, dishes and masts.
- **Light** (`createBloom` in `src/post.js`, run between the G-buffer and the composite): the
  glowing surfaces (glow over 0.62 in `gHatch.a`: crystals, lamps, signal lamps, portals, the
  makers' mark; the local lights' pools stay under it) are gathered at a quarter of the
  resolution (4×4 texels each, so a small lamp isn't lost) and blurred, then again at an eighth
  for a wider halo. The composite draws a light as a bright flat core whose inner ink lines go
  and whose outline thins, then two flat rings of its colour round it (a printed glow, over the
  ink) and a soft wash of that colour on what is near; stronger at night. Seven small passes,
  about 1/16 of the pixels. Façades (`pattern: 'facade'`) light some windows at dusk, one after
  another, and those glow too.
- **The makers' inscriptions** (`makeMaterial({ glyphs })`, `src/glyphs.js`): the makers marked
  everything they made (LORE.md, "The glyph"). On upright faces, each row of the wall's grid
  (`glyphs`: a cell in metres, or the grid's) carries a frieze between two incised border lines:
  a row of their signs (the ∩ under three dots opening every sixth, rings, the two moons, the pale
  star, a staff under an arc, three over a line, a door, a sun on a staff); on the odd rows a
  cell now and then holds a seal, a framed panel with the mark. They are carved: each stroke is
  a groove whose part under the rim on the light's side drops into the shadow tone (post.js inks
  that edge like a cast shadow), with a fine outline round the cut; they fade once a groove is
  under ~1.5 px. Only the makers' work carries them: Qanat's gate lintel and the giant's door,
  the masked head's chamber and its doorway, the standing stones, the observatory, the
  Builders' ruins in Viridel (the City-Shaft's billboards and the artist's page lost theirs).
  The layout is integer arithmetic, mirrored in JS for `tests/materials-pass.test.js`.
- **Grass blades** (`src/flora-grass.js`, `src/grass-shader.js`; `makeMaterial({ grass })`): on
  the grounds drawn with grass ticks (Viridel, the Garden of Spheres, home, Lorn's mosses, their
  Lab rooms, the Lab's meadow), a fixed set of tufts (three wide tapered blades each, 9 triangles)
  covers a square patch round the camera. Each tuft has its offset in the patch; as the camera
  moves the ones falling off one side reappear a patch further on (`wrapPatch`), so blades stay
  put in the world and only those that wrapped are placed again (the height, the slope, the
  paths, the water, and a 1 m mask of where something is built: one ray down per cell, cached).
  The vertex shader bends them with the wind (the plants' gust front) and parts them round the
  traveller's feet (`uBrush`), thins them with distance and sinks them into the ground towards
  the patch's edge, where the ground's own inked ticks take over. Lit like the ground, each tuft
  a shade darker or lighter than it. **Soft ink**: the blades write +8 in `gHatch.a`, and post.js
  draws their outline in a darker shade of the green instead of black, only on the blade's own
  side (half as wide), with no crease, colour-edge or shadow-edge lines and no hatching on them
  (and the crease shading ignores them, which had greyed the ground between them); one tuft in
  eight keeps a real pen line, for the hand-drawn feel. One draw call, no shadows.
  `GRASS_QUALITY`: High 26 m and ~12 k tufts, Medium/Auto 22 m and ~7.7 k, Low 15 m, Handheld
  13 m and ~2 k tufts (about 18 k triangles).
- **The Lab** shows them all: the materials row has steel, brushed, chrome, brass, copper, iron,
  painted, the carved inscriptions and a lamp beside the glow, and a meadow past the water pool.

## The desert in Unity (a proof of concept)
`unity/Memento` is a Unity 6 (URP) port of the desert, built from this game rather than
beside it (the details, how to run it and what is missing: `unity/README.md`).
- **Export** (`scripts/unity-export/export-desert.mjs`): the desert is built headlessly as
  `main.js` builds it (the level, the ship, the story's people, the boxes, the bike, the
  flora; `build-world.mjs`, with the tests' DOM stub) and written out: static surfaces merged
  by material and 256 m tile, the `makeMaterial` options read back from each shader's
  uniforms, the terrain heightfield, the collision `physics.js` bakes, the moving things, the
  time-of-day palette and the "Moebius print" preset, the story's places, portals, people,
  crowd and procession, and `desert-data.js` as `story.json`. Unity's frame mirrors x; the
  shaders mirror it back before every pattern, so the page lands where it does here.
- **The look**: a URP renderer feature draws the same G-buffer (albedo + light, normal +
  depth, hatching + flags) and one ink composite, `materials.js`, `ground-ink.js`,
  `biome.js` and `post.js` ported to HLSL; side-by-side shots match the web closely.
- **The play**: the traveller (glTFast, his own clips), walk / run / jump / climb / mantle,
  the camera rig, the people and the procession (Quaternius bodies in their palettes, UAL
  clips), conversations with tones and at most three answers, quests and the journal, the
  father's charge, the makers' chest on the ledge, the rib, the pool and the jar, the
  hoverbike under the tarp, the burning tree's fire and its burn, falls and knock-downs.
  `scripts/unity-export/unity-batch.sh Play` plays the opening quest end to end in batch mode.
- The project carries the Unity side of MCP for Unity (CoplayDev) so an MCP client can drive
  the editor; see `unity/README.md`.

### Home: two houses you walk into, a garden, Lou, Tove and the dog
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

### A quest that fails, fewer fetch quests, and the lore made one story

- **Quests can fail** (`src/story/quests.js`): `quests.fail(id)` ends a quest as `'failed'`
  (its flag `quest.<id>`; also `failed.<id>` = its title, for the charge). A failed quest is
  over like a finished one (not active, never tracked, `isEnded`), can't be restarted or
  retried, runs `onFail` instead of `onDone`, toasts "Failed: …" with three falling notes
  (`sound.fail`), and the sketchbook files it under its own **Failed** heading with a dashed
  earth-brown rule, a crossed **✗ Failed** stamp and its `failOutro`. Dialogue can test it
  (`{ quest, failed: true }`) and do it (`{ fail: id }`). A quest marked `major` toasts as
  "Quest" and wears ◆ like a main one. The father's charge card lists failed quests under
  "What you could not mend" (`chargeState({ failed })`, fed by main.js from the flags).
- **Viridel's tea terraces** (`src/story/terraces.js`, quest `edena.terraces`, Esk in
  `edena-data.js`; LORE.md, "The quest that fails", says why Viridel): four terraces on the
  white builders' steps down into the dry hollow south-east of the landing (`TERRACES` in
  `src/levels/edena.js`; flora and grass keep off them), Esk's tea bushes in rows (instanced),
  the builders' cistern on the rise with its gate and wheel. The steps are built from the ground
  up (`terraceLayout`: each step's top is level along x and at least 1.2 m over the one below),
  white walls with the makers' inscriptions, earth tops, a stone ramp up each wall at the north
  end; they collide through `physics.addCollider`, in three parts: the sides, the lane (the
  middle the flood takes) and the gate. The quest: push three clods out of the runnels, top
  first (a lower one slumps back); at Esk's asking water the roots on the gate's wheel (shoot),
  then one shove (push). The flood is scripted, ten seconds: the gate tears loose, a white sheet
  of water runs down the lane (a strip revealed by `drawRange`), each step of the lane sinks and
  goes as the front passes (its collider dropped), the lane's bushes are swept down into the
  hollow, the mud fan grows, the cistern empties (`sound.rumble`). What is left is built from the
  start and shown after: the mud lane with a stream, the fan and a muddy pond, the gate's slab
  and wheel and broken wall blocks in the mud (colliding), uprooted bushes. `edena.terraces.flooded`
  rebuilds it like that on every visit (and a save that stopped mid-flood comes back flooded).
  Then Esk blames you, you say sorry, she says it belongs to the ground now, and it fails. Mira,
  Sol and Vey each say a word about it once; a recording afterwards has the father on breaking
  things (`calls.js` beat `broke`), and Viridel's own recording gets a different answer
  (`REEL.edena.youAfter`). At the stone the traveller names it, once, after the space for Ilen
  (`tombLines(tokens, { broke })`, from `edena.terraces.flooded`).
  `tests/story-terraces.test.js` runs it end to end and reloads it.
- **Hands-on steps in the fetch quests** (each one solvable with a plain shot and push; ember
  shots work where lighting fits; existing stage ids kept, so old saves carry on):
  - - *Teo's drum* (desert, `src/story/desert-errands.js`): it stands on its rim under the ribcage,
    pinned against a rib's foot by a knuckle of spine; shoved toward the rib the knuckle only
    jams tighter, shoved from the side it rolls off and the drum rolls out like a wheel (by
    hand before the backpack). Stage `free`; flag `desert.drum.freed`.
  - *The mask in the sand*: sand has drifted over its eyes like lids; a splash washes one clear
    but the wind sifts it back in seven seconds: clear both at once and it looks at you. Stage
    `eyes`; flag `desert.mask.eyes`.
  - *A ration for the guard* (City-Shaft, `src/story/incal.js`, the prop in `src/levels/incal.js`):
    the tin hangs in an old goods hoist's basket out over the void; shoot out the rusted pin,
    then push the weight round the post (along the arm it only rocks). Stage `hoist`; flags
    `incal.hoist.pin`, `incal.hoist.in`.
  - *A letter across the aqueduct* (Vael II, `src/story/arzach2.js`): Ondine answers with the
    tower's old signal lamp: light it (shoot), turn its tiller notch by notch (push from the side)
    until it faces the carved bell toward the rose cliff, and a light answers from Ysolde's
    window. Stage `lamp`. *The bell's clapper* lies under tiles that fell up with it: push them off.
  - *The keeper's key* (Buried Machine, `src/story/buried.js`): the crane's jib hangs out over
    the drop; free its rusted collar with a splash, then ratchet it round with side-on pushes
    (the pawl only turns one way) until the hook is over the platform. Stage `swing`.
  - *The moss-dome latch* (Lorn II, `src/story/perdide2.js`): with the latch back, moss in the
    frame keeps Pim's door from shutting: wake the moss lamp over it (shoot), then push the door
    shut. Stage `shut`. *Whose skiff?*: Fen asks you to bring the skiff home once: light the lamp
    on his berth post, step off on his landing and nudge the empty skiff in. Stage `home`.
  - *Mira's water clock* (Viridel, `src/story/water-clock.js`): the Hangar's errand of a brass
    gear now ends on the clock: fit it (E), then fill its leaking bowl with three quick splashes
    so it tips and rings (quest `edena.clock`).
  - Left as they were, already hands-on: the bird's feathers and the stone hand, the cairn,
    the machines and Pip's ball, the gauges, the seed (watered), the pools, the fireflies, the
    plants, the spheres and the pebble, the crates and the oldest sign. The other between-world
    errands stay light parcels (a greeting gives, a greeting takes), on purpose.
- **The lore, one story** (LORE.md, section 10, has every decision): the light passed every
  world the same night, the night the ship was struck, and climbed away; Ilen's message is
  thirty years on the way; recording 4 is an old one made for him at ten; Odile and Talo were
  struck twice and went on across the swamp; the spheres came down out of the sky and the
  white builders copied them; the Hangar's board and Lorn II's Welcome draw the ∩; the bell
  whistle is clay, not a second bone whistle; the Atelier no longer claims an unlock; Ivo's
  Footprint points at the chest that exists; a few wrong directions are put right.
- **People who share a name have ids of their own** (`hask.buried`, `ossa.buried`,
  `pip.garage`, `lio.edena`, `hollin.perdide2`, `pim.perdide2`, `aube.spheres`, `ivo.perdide`;
  Clemence's old id `malvina` is `clemence`), so meeting one no longer marks the other in the
  credits or the mother's "who did you meet". `src/save-migrate.js` brings old saves up once
  (flag `save.migrated`): a "met" carries over to the renamed person if the save has been to
  their world; Clemence's flags move outright. `tests/save-migrate.test.js`.
