# TODO

Open work only. Finished items move to DONE.md (with how they were done); the changelog
(src/changelog.js) says when they reached players.

# Questions for the author

- [ ] The push's rings and spray (RB / R1) were missing in every room off the map and are back
  (DONE.md). Were they also missing **outdoors**, in the open world? Nothing in the code says they
  were, and no one has seen it; if they were, that is a second bug and wants looking at.
- [ ] A character standing on a flying cab floats: a cab's solid top is its awning's crest, 1.4 m
  over the cab in the middle (`src/taxi.js` `get solid`). Should anyone be able to stand on a cab at
  all? If yes, on the awning or on the cab's own roof?

# Contact: what is left

The second pass made every world collide as it is drawn (DONE.md; docs/systems/movement.md,
"Contact"). What the audit still finds, and why it was left:

- [ ] The Buried Machine's **great wheel**: it turns for ever once the story turns it, and its spokes
  are seven to its many teeth, so no still shape is right at every angle; its collision stays a disc
  of the rim. That is most of what the audit still finds in any world (69 feet sink, 49 climbs
  inside, 102 climbs off). Exact wants a *turning* collider (`src/physics.js`, `src/carriers.js`),
  which nothing else needs yet.
- [ ] The Buried Machine's **cross-wall opening rims**: solid, `SandDrifts` gives them a footprint
  and banks sand right across the passage you have to walk through.
- [ ] **Lorn II's bank roots and whip roots**: solid, the 26 bank roots alone doubled every collision
  query (bake 60 → 120 ms, 20 k ground rays 25 → 50 ms, 20 k capsule pushes 46 → 93 ms) for about one
  audit sample. They sprawl 10–40 m off the path.
- [ ] Smaller, each with its reason in movement.md: the Garden's olive and cypress trunk colliders
  inside their drawn trees (flora, brushed past), Lorn's gates of Jaws (organic halves on a box
  collider), the temple rotunda's oculus trim (drawn-only on purpose: solid it caught rays dropped
  through the oculus), and the sand skirts, whose tessellated mesh and the terrain's analytic height
  part by up to 0.2 m (0.78 m at the worst corner).

# Carried over

## The References level

Every reference sheet is rebuilt as views (`?level=references`, `[` / `]`, L3 / R3;
docs/systems/references.md): the desert (1–27), the City-Shaft (28–50), Vael II (51–81), the Buried
Machine (82–103), the Garden of Spheres (104–125), Lorn II (126–148) and the Signal Market (149–169);
Vael has no sheets. All six of the ranked recurring shader gaps are closed (docs/systems/references.md,
"Across the worlds"): pen detail at every scale, line weight and colour per material, haze in layers,
form-following hatching, cast shadows by world, colour variation across a wall. What is left is the
scene-level modelling and a few shader limits:

- [ ] Shader limits left:
  - Spot blacks (`uSpot`) fill the shaded pockets our scenes have; the sheets' interiors are dense
    small machinery at every scale, so most of their black masses have no geometry to sit in here yet.
    Vael II's spawn on High pays +1.7 ms for them (its many shaded overhangs).
  - IMG_3774's cast shadows are near-black ink masses with a hard edge: a world-level "ink shadow"
    option is missing (`uCast` lightens, it does not blacken).
  - Flat shadow per material: the City-Shaft's trees go grey-blue with `uShadowFlat` on, so the world
    does not use it.
  - The half-tone cannot tell a back wall inside another's cast shadow (it reads as half-tone, the
    panel's is full shadow).
  - Paper grain is screen-fixed, kept light (`uPaper` 0.7); the sheets' is heavier and on the page.
  - The gorge panels' walls are in cast shadow from the rim; ours are form-shaded.
  - Canyon and cliff walls (IMG_3774 p5, IMG_3773 p3, IMG_3772 p3) have many vertical cracks and
    strokes down the face; our strata draw horizontal beds with sparse fissures.
  - Weathering and drifts: stains round the doors are not drawn (the doors are separate meshes); the
    dust band at a wall's foot is hidden where sand banks against it; home's and the Market's walls
    carry no weathering yet.
  - The print preset keeps its cumulus bank and clouds (the worlds' own; the views turn them off).
  - Vael II: the needles' and stalks' terminator is a clean band on the sheets, while flat facets with
    flutes break ours into lit islands in the shade; the crevasses' walls are lit red-brown and hatched
    on the sheets, ours dark; its cloud puffs are pre-shaded vertex colours (not the flat print), its
    planets stay (the sheets have none), and dusk and night keep the old blue shadow.
  - The Garden of Spheres: the canopies' undersides want dense radiating *branch* lines and foliage as
    clusters of small inked leaf masses (the form hatching radiates, but the shapes are smooth lumps);
    the white stone's shade a flat pale blue with almost no strokes; the spheres' printed crescent
    whatever the sun.
  - Lorn II: roots and bushes as dense hatched masses.
- [ ] Scene-level, world by world (modelling, not shading):
  - Vael II: the overhangs' drips and stalactites, the cracked eggs, the cave mouth's framing, the
    monasteries' detail (arcades, cypresses, roofs), the mushrooms' lean, the bird's standing pose
    (buildBird's rest pose lies low), the cloud sea's cauliflower detail.
  - The Garden of Spheres: the white hill's sculpted rock, the ruins' arcades, the robot, the hedges'
    fruit, the plaza's paving are sketches.
  - Lorn II: the nest in the great cap, the caves' framing, the roots' tangle, the banks' bushes.
  - The Signal Market: the crowd, the stalls' goods, the cabs.
  - The Buried Machine: the trench's pipe mass, the city's clustered hanging towers, the drum's
    interior machinery and arcades, the oval tunnel's interior, the moon cave and the rock ledge.
  - The City-Shaft: the game's is a round cream-and-blue pit with a spire, terraces and a hill-town,
    the sheets' a canyon of pink and cream stacked houses with water below; the views' houses are
    boxes (no pipes, balconies, laundry or plating under the overhangs), the cabs and blimps simple
    capsules.

## MakeHuman bodies

Stages 1–3 are done (DONE.md, docs/makehuman.md): one parametric body, the Desert, then every world,
the Lab's faces gallery, the face keys in one texture for every body, the headwear.

- [ ] The props the desert's sheets show that the kit lacks (docs/makehuman.md, stage 2).
- [ ] `scripts/unity-export` still reads the Quaternius bodies. **Reconciled:** the C# port's own game
  logic is retired (the JS bridge draws the live scene instead), so the export is only the bench
  scene's. The live question is the bridge's, below: it does not load MakeHuman bodies yet.

## Animation

- [ ] Measure frame times, animation CPU cost, loading time and memory on the Retroid with
  representative crowds (desktop headless Chrome done in the Bazaar and the City-Shaft,
  docs/systems/animation.md, "Locomotion"). **Blocked**: no Android device is attached
  (`adb devices` is empty).
- [ ] Evaluate learned motion matching only if it measures better than the conventional system
  (motion matching exists, `?mm=1`, but measures behind the loops: the data, not the method, is
  short). **Blocked on the author**: Mixamo's starts, stops and turns are pending their downloads
  (docs/mixamo-shopping-list.md).

## Dialogue

- [ ] The speaker's portrait circle shows empty on the Retroid (seen in the device's Chrome: a blank
  yellow disc — that is `person.color ?? '#d8a24a'`, the chip's background, with `img.hidden` left
  true or the image blank). **Not reproduced on the desktop**: a headless Chrome 154 (the device's
  version) at the Handheld preset and device pixel ratio 2 draws the person — 210 × 210, 265 distinct
  colours, the commonest only 29 % of the pixels. So the Handheld preset and the pixel ratio are
  ruled out. What is left to suspect is the device's GPU: `captureView` reads the WebGL canvas with
  `drawImage` and the renderer has no `preserveDrawingBuffer`, which comes back blank on some Android
  drivers. **To tell the two apart, one observation from the device would settle it**: do the
  sketchbook's keepsake pictures (the same capture path, JPEG, no isolate and no backdrop) also come
  out blank there? If they do it is the canvas read; if they do not it is something in the
  portrait-only path (`isolate`, the backdrop, `shrinkInto`).

## Android

- [ ] On the Retroid: GeckoView with the real buttons, the upgrade over the installed app, the cave's
  FPS and the shader cost. **Blocked**: no Android device is attached.
- [ ] Make the repository private once the new APK (NATIVE_API 6) is installed and the Steam Deck has
  launched twice: then remove android.yml's TRANSITION step and the GitHub web.json uploads, and Pages
  (docs/cloudflare.md). **Blocked on both prerequisites**: neither can be checked without the devices.

## The Unity bridge

The C# port's own game logic is retired in favour of the JS bridge (2026-10-06: Unity + Puerts chosen;
the game's JS runs in Unity, which only draws: docs/systems/engine-bridge.md). Its stages 1–4 are done
(DONE.md): the cheaper scene sync, the platform layer, sound, the tool, the drone, weather, life,
glows and lines, the crowd's GPU figures, the cave's rounded walls, and players for macOS, Linux (the
Deck's) and Android. What still differs from the web (engine-bridge.md, "What still differs"):

- [ ] The Signal Market's façades lack the web's newer surface marks (the port's Surface shader
  predates them), and its light pillar.
- [ ] The web's grass blades (flora-grass.js) and wind streaks (wind.js) are not built in the VM.
- [ ] The web wakes the answering flowers by the traveller's nearness sooner.
- [ ] Some of the web's people are MakeHuman bodies the bridge does not load yet.
- [ ] Run the Unity APK on the Retroid once it builds through the bridge
  (`scripts/bench/android-run.sh`). **Blocked**: no Android device is attached.
- [ ] Connect an MCP client to the editor. **Blocked**: an organization policy blocks registering
  unknown MCP servers (the configured UnityMCP server also fails to connect). The editor is driven in
  batch mode instead (`scripts/unity-export/unity-batch.sh`).
