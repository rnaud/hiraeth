# TODO

Open work only. Finished items move to DONE.md (with how they were done); the changelog
(src/changelog.js) says when they reached players.

# Player decisions and menu redesign (2026-10-06)

- [x] Flying cabs are self-driving. Players ride seated inside the cab, not standing on its roof
  or awning. Remove driver characters and references to human drivers; preserve usable boarding,
  destination selection, travel and disembarking with the player correctly seated during the ride.
  This answers the earlier question about where passengers should stand.
  (Done: no driver in any cab; an open cabin with a seat under the canopy, the traveller seated in
  it, hands resting; the dash asks where to and the cab flies itself to the stop, where you step
  out. Wren is the old cab itself. docs/systems/movement.md "Riding a cab", tests/cab-ride.test.js.)
- [x] Replace the sketchbook interface with a game menu inspired by Ocarina of Time, with multiple
  distinct panels and clear controller navigation. Include an Items panel showing collected items
  and a Quests panel. Use the game's own visual style and assets.
  (Done: four panels, Items, Quests, Sketchbook, Worlds, turned with LB / RB, a cursor over each,
  A / × uses or looks, B / ○ closes; items drawn from their own models; docs/systems/ui.md, "The game menu".)
- [x] Simplify the current quest presentation: show only the overall goal and the next actionable
  step, updating as progress changes. Do not show the full quest log or accumulated history in the
  current quest view. Apply this to the Quests panel and any current-quest summary shown in play.
  (Done: each quest's goal, src/story/quest-goals.js, and its current step only, in the Quests panel
  and on the scout's find; finished quests a short list of titles; the Start menu's old quest log is gone.)

# Questions for the author

- [x] The push's rings and spray (RB / R1) were missing in every room off the map and are back
  (DONE.md). Were they also missing **outdoors**, in the open world? Nothing in the code says they
  were, and no one has seen it; if they were, that is a second bug and wants looking at.
  Answered without the author: no. In the running game (headless Chrome, keyboard C and a fake pad's
  RB), every world's open air and every room off the map (the desert's four, one each in the other
  temple worlds, Viridel's two) drew the push's three rings and its spray, and nothing hid them at draw
  time; the only misses were a push made while a conversation opened (Lou at home), which is input
  being paused, as it should be. `tests/push-fx.test.js` fires it in every world and room, both ways.

# Contact: what is left

The second pass made every world collide as it is drawn (DONE.md; docs/systems/movement.md,
"Contact"). What the audit still finds, and why it was left:

- [x] The Buried Machine's **great wheel**: it turns for ever once the story turns it, and its spokes
  are seven to its many teeth, so no still shape is right at every angle; its collision stays a disc
  of the rim. That is most of what the audit still finds in any world (69 feet sink, 49 climbs
  inside, 102 climbs off). Exact wants a *turning* collider (`src/physics.js`, `src/carriers.js`),
  which nothing else needs yet. Done: `physics.addMover` (the drawn wheel, ~8 k triangles, its own BVH
  in its own frame, synced each frame), carrying you standing or climbing (`moverCarrier`); the audit
  69 → 37 feet sink, 102 → 11 climbs off, 18 → 0 unseen floor (what is left there is sand and the rims);
  queries unchanged (movement.md, "Moving colliders").
- [x] The Buried Machine's **cross-wall opening rims**: solid, `SandDrifts` gives them a footprint
  and banks sand right across the passage you have to walk through. Done: solid, and the drifts' mask
  is 0 on the way through each opening (`passageMask`: the opening's width at the floor, 11 m either
  side; the wall's own drift crossed it too, up to 0.57 m); climbs inside 50 → 36.
- [x] **Lorn II's bank roots and whip roots**: solid, the 26 bank roots alone doubled every collision
  query (bake 60 → 120 ms, 20 k ground rays 25 → 50 ms, 20 k capsule pushes 46 → 93 ms) for about one
  audit sample. They sprawl 10–40 m off the path. Done: solid as drawn in the main BVH, with the arches'
  splayed feet (154 → 172 k triangles; walks through 21 → 5). The doubling did not reproduce: measured
  before and after in one process, interleaved, fastest of 9–15 (a single run swings 2–3× on a busy
  machine), the bake is +4–11 ms, rays and capsules round the spawn unchanged, along the path rays
  +5–18 %, capsules +11–15 %. Lighter shapes (capsule chains, a BVH of their own) would cost more: the
  roots line the whole path, so a second BVH is a second traversal for every query there.
- [x] Smaller, each with its reason in movement.md: the Garden's olive and cypress trunk colliders
  inside their drawn trees (flora, brushed past), Lorn's gates of Jaws (organic halves on a box
  collider), the temple rotunda's oculus trim (drawn-only on purpose: solid it caught rays dropped
  through the oculus), and the sand skirts, whose tessellated mesh and the terrain's analytic height
  part by up to 0.2 m (0.78 m at the worst corner). Done (movement.md, "The smaller ones"): the olives'
  trunks and the cypresses collide as drawn (climbs off 234 → ~10); the jaws' halves are moving colliders
  while shut, with a thin slot that keeps the way; the oculus trim is solid over its ceiling, its 0.3 m
  lip over the opening drawn-only so the oculus stays as open as before; a skirt's triangles drawn over
  the ground collide (`SandDrifts.misfits`; the error was between the skirt's points, not at them).
  A climb where sand is banked up a wall starts on the bank (`Player.climbFloor`). The canyon walls' single convex
  footprints (sand banked in straight lines across the floor) are cut into pieces that follow the foot
  now (`footPieces`; the seams raise nothing inside the walls: movement.md, "Long curved footprints").

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
  - [x] IMG_3774's cast shadows are near-black ink masses with a hard edge: a world-level "ink shadow"
    option is missing (`uCast` lightens, it does not blacken). Done: `uInkShadow` (rendering.md, "Ink shadows").
  - [x] Flat shadow per material: the City-Shaft's trees go grey-blue with `uShadowFlat` on, so the world
    does not use it. Done: the world prints flat at 0.8, its trees say `shadeFlat: 0`, people keep their shade.
  - The half-tone cannot tell a back wall inside another's cast shadow (it reads as half-tone, the
    panel's is full shadow).
  - [x] Paper grain is screen-fixed, kept light (`uPaper` 0.7); the sheets' is heavier and on the page.
    Done: removed (it read as a filter stuck to the screen), with the vignette; the lines' wobble turns with the world.
  - The gorge panels' walls are in cast shadow from the rim; ours are form-shaded.
  - [x] Canyon and cliff walls (IMG_3774 p5, IMG_3773 p3, IMG_3772 p3) have many vertical cracks and
    strokes down the face; our strata draw horizontal beds with sparse fissures. Done: a strata material's
    `cracks` (materials.md, "Cracks down a cliff's face"), on in the views' canyons and the desert's gorge and cliffs.
  - Weathering and drifts: stains round the doors are not drawn (the doors are separate meshes); the
    dust band at a wall's foot is hidden where sand banks against it; home's and the Market's walls
    carry no weathering yet. Partly done (October 2026): Qanat's doors have their stains (materials.md, "Stains
    round the doors"; other worlds' doors not yet); home's and the Market's walls have been weathered since
    v0.69 (`weathered` 0.6–0.8). Left: the dust band under banked sand.
  - The print preset keeps its cumulus bank and clouds (the worlds' own; the views turn them off).
  - Vael II: the needles' and stalks' terminator is a clean band on the sheets, while flat facets with
    flutes break ours into lit islands in the shade; the crevasses' walls are lit red-brown and hatched
    on the sheets, ours dark; its cloud puffs are pre-shaded vertex colours (not the flat print), its
    planets stay (the sheets have none), and dusk and night keep the old blue shadow.
  - [x] The Garden of Spheres: the canopies' undersides want dense radiating *branch* lines and foliage as
    clusters of small inked leaf masses (the form hatching radiates, but the shapes are smooth lumps);
    the white stone's shade a flat pale blue with almost no strokes; the spheres' printed crescent
    whatever the sun. Done (October 2026, world and views): veins drawn as forking boughs (`FORM.veins`), the
    world's undersides veined; foliage as clusters of welded leaf masses (`leafCrown`); `WHITE_SHADE` (flat,
    hatch 0.08); the views' spheres printed in two tones with their crescent (references.md, the Garden's).
  - [x] Lorn II: roots and bushes as dense hatched masses. Done (October 2026, world and views): a hatch over 1
    is a hatched mass (`HATCH_DENSE`: closer, heavier strokes that a half-tone keeps), `ROOT_INK` and
    `BUSH_INK` (references.md, Lorn II's).
- [ ] Scene-level, world by world (modelling, not shading):
  - [x] Vael II: the overhangs' drips and stalactites, the cracked eggs, the cave mouth's framing, the
    monasteries' detail (arcades, cypresses, roofs), the mushrooms' lean, the bird's standing pose
    (buildBird's rest pose lies low), the cloud sea's cauliflower detail. (Done, October 2026: drips
    rooted in the undersides and printed in their shade, cracked eggs and stones, the cave mouth hung
    with stalactites, arcades, eaves, finials and cypresses, leaning tables, the bird on long legs with
    her wings folded along her sides (`poseWings`), knobbly cloud; docs/systems/worlds.md, animation.md.)
  - [x] The Garden of Spheres: the white hill's sculpted rock, the ruins' arcades, the robot, the hedges'
    fruit, the plaza's paving are sketches. Done (October 2026, world and views, `src/levels/garden-kit.js`):
    pillows of stone round the terraces, arcades of round arches, a robot of 28 parts, fruit hedges, paved
    rings whose joints the ink draws; the views' framing checked panel by panel.
  - [x] Lorn II: the nest in the great cap, the caves' framing, the roots' tangle, the banks' bushes. Done
    (October 2026, world and views, `src/levels/wood-kit.js`): roots as braided strands, cave mouths framed in
    tangled arches with hanging roots and feet, bushes of leaf clumps, a woven nest of eggs under a ribbed dome.
  - [x] The Signal Market: the crowd, the stalls' goods, the cabs. Done (October 2026): the views' crowd of
    people in coats, hoods and hats with the quiet ones, full stalls with sellers, the game's own cabs; the
    world's stalls heaped with goods (docs/systems/references.md, worlds.md). The sheets' stalls stay denser.
  - [x] The Buried Machine: the trench's pipe mass, the city's clustered hanging towers, the drum's
    interior machinery and arcades, the oval tunnel's interior, the moon cave and the rock ledge. Done
    (October 2026, views and world): `pipeMass`, clustered `hangingTower`s, drums with arcades, machinery
    and vaulted or flat ceilings, `ovalTunnel`, `archPortal` and the moon, `rockLedge`; the world's trench
    walls U-bends, its drum's arcade and machinery, its city in clusters (references.md, worlds.md).
  - [x] The City-Shaft: the game's is a round cream-and-blue pit with a spire, terraces and a hill-town,
    the sheets' a canyon of pink and cream stacked houses with water below; the views' houses are
    boxes (no pipes, balconies, laundry or plating under the overhangs), the cabs and blimps simple
    capsules. Done (October 2026): the views' blocks carry pipes, balconies with washing and plating under
    their overhangs, blimps, the game's cabs; the world keeps its round pit (the story, quests and cab stops
    stand on it) with half its walls pink, drainpipes, washing, plating under the terraces, three blimps and
    turquoise water at the bottom, within 0.2 ms a frame on Handheld (worlds.md).

## MakeHuman bodies

Stages 1–3 are done (DONE.md, docs/makehuman.md): one parametric body, the Desert, then every world,
the Lab's faces gallery, the face keys in one texture for every body, the headwear.

- [x] The props the desert's sheets show that the kit lacks (docs/makehuman.md, stage 2). **Done:** Nour's
  gourds, keys and disc staff, Marrow's salvage bag and pack (no cloak: his sheet's coat), the bells on Sefa's
  hem, her oud's tassels and the oud kept out of her cloak, the Speaker's copper bell and streamers.
- [ ] `scripts/unity-export` still reads the Quaternius bodies. **Reconciled:** the C# port's own game
  logic is retired (the JS bridge draws the live scene instead), so the export is only the bench
  scene's. The live question is the bridge's, below: it does not load MakeHuman bodies yet.

## Animation

- [x] Measure frame times, animation CPU cost, loading time and memory on the Retroid with
  representative crowds. (Done in GeckoView, every world's start, two densest knots of people, a wide
  view and a walk: docs/systems/performance.md, "Every world on the Retroid, in GeckoView". The
  traveller's overshirt cloth had pulled every world to 17–25 fps; fixed, now 57–60 fps in ten worlds,
  44–52 in Qanat, the camps and the City-Shaft's rim, where the people cost ~5 ms a frame and the draw
  loop 5–8 ms; loads 4–14 s; 1.0–1.4 GB over the app's three processes.) Previously **blocked**: no
  Android device was attached.
  The desktop half is done (docs/systems/animation.md, "Locomotion"): frame times and the animation
  CPU in the Signal Market and the City-Shaft, and now the load and the memory for the three
  crowd worlds (`node scripts/bench/web-load.mjs`) — the Market 586 people, ready in 1.2 s, 147 MB;
  the desert 159, 2.3 s, 210 MB; the City-Shaft 1 390, 5.3 s, 300 MB; 19.0 MB over the wire.
- [ ] Evaluate learned motion matching only if it measures better than the conventional system
  (motion matching exists, `?mm=1`, but measures behind the loops: the data, not the method, is
  short). **Blocked on the author**: Mixamo's starts, stops and turns are pending their downloads
  (docs/mixamo-shopping-list.md).

## Dialogue

- [x] Facial expressions and talking for the coral-shirt traveller (author, 2026-10-07). Done: his face is drawn
  in his body's shader over the painted one (`src/characters/tripo-face.js`, faces.md "The coral-shirt traveller's drawn face"). His face
  (`src/characters/traveller-v1.js`, the Tripo body) has no expression rig, so he shows none of the
  tone expressions the people's bodies get (`src/expression.js`, `TONE_EXPRESSIONS`;
  `Humanoid.setExpression`, docs/systems/faces.md) and his mouth doesn't move with the voice. Give
  his face the same channels (smile, open, brow, browTilt, squint, gaze, blink and the mouth on the
  syllables), as morph targets or a drawn face layer over the mesh, so conversations and reactions
  read on him as on everyone else, up close and in the dialogue portrait.

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
  Meanwhile two things are in place for it: `node scripts/portrait-check.mjs [--preset …] [--dpr …]`
  measures the chip's image (a drawn person is hundreds of colours with no colour over about half;
  an empty capture is one or none), and `captureView` now refuses a blank portrait, so the panel
  falls back to the speaker's initial instead of showing an empty coloured disc. That fallback is
  also the answer to the question: **if the Retroid now shows the initial letter in the circle, the
  capture is coming back empty on the device** and the fault is the canvas read, not the framing.
  (Planned for the second Retroid round in the GeckoView test app, with the Sketchbook's captures, the game
  menu's item pictures and a cab ride; not reached: the device was taken back. The loading pen's fix is in,
  its device measurement too is still to do: docs/systems/performance.md, "The Retroid, second round".)

## Android

- [ ] On the Retroid: GeckoView with the real buttons, the upgrade over the installed app, the cave's
  FPS and the shader cost. **Blocked**: no Android device is attached. (The cave's FPS and the shader
  cost are measured, in the GeckoView test app: the cave 60 fps, GPU 41 %, docs/systems/performance.md
  "Every world on the Retroid, in GeckoView"; the game's 78 programs compile in 5.7 s one by one, 81 ms
  median, 208 worst, against 20.8 s and 367 ms in 07af71c's run. The real buttons and the upgrade over the
  installed app are still to do: the measuring never touches the player's app.)
- [x] Make the repository private (done 2026-10-07 on the author's word: the Retroid runs a NATIVE_API 6
  app; android.yml's TRANSITION step, the GitHub web zips and web.json, and the Pages workflow removed).

## Steam Deck (waiting on the device: it was asleep, 2026-10-07)

- [ ] Measure every world on the Deck, before (High at 1.5×) and after (the new Steam Deck preset,
  fixed and dynamic), in Desktop Mode and under gamescope: `scripts/bench/deck-run.sh start desktop`,
  then `node scripts/bench/deck-worlds.mjs` (docs/systems/performance.md, "Steam Deck"). Write the
  before/after table.
- [ ] Decide the Retroid's `cpuBound` guard (0.85) for the Deck preset from those numbers (left on: the
  one reading so far, the desert at 17–22 fps with the renderer at 100 %+ of a core, points to CPU-bound).
- [ ] Compare ANGLE's GL and Vulkan backends under gamescope; check the loading pen turns smoothly in a
  Deck load; check the new Updates section on the Deck itself (runtime 830001 and later).

## The Unity bridge

(Verified running on 2026-10-06: `scripts/unity-js-setup.sh` then
`scripts/unity-js-run.sh <name> -level <id> -views scripts/bench/viewpoints.json -out <dir>` plays a
world in the Unity editor through Puerts and saves a PNG a viewpoint; the desert was ready in the VM
1.2 s after launch, the Garden of Spheres 0.8 s.)

The C# port's own game logic is retired in favour of the JS bridge (2026-10-06: Unity + Puerts chosen;
the game's JS runs in Unity, which only draws: docs/systems/engine-bridge.md). Its stages 1–4 are done
(DONE.md): the cheaper scene sync, the platform layer, sound, the tool, the drone, weather, life,
glows and lines, the crowd's GPU figures, the cave's rounded walls, and players for macOS, Linux (the
Deck's) and Android. What still differs from the web (engine-bridge.md, "What still differs"):

- [x] The Signal Market's façades lack the web's newer surface marks (the port's Surface shader
  predates them), and its light pillar. (2026-10-06: the port's Surface and composite brought up to
  materials.js / post.js — weathering, pen detail, colour patches, plating, lit windows, each surface's
  shade, spot blacks, ink shadows, lines by material, haze by depth and height, the world-anchored
  wobble, pebbles, no paper grain or vignette; the pillar is the jetpack box's beacon: the makers'
  boxes now built in engine/game.js. Not ported: hatching that follows the form, `S_FORM`.)
- [x] The web's grass blades (flora-grass.js) and wind streaks (wind.js) are not drawn. (2026-10-06:
  `engine/mirror.js` kind `instgeo` — a plain mesh on an InstancedBufferGeometry: its instance count,
  its attributes when they move, only the range rewritten — and op 12/13 to the port's Surface
  `MEMENTO_GRASS`, now grass-shader.js's own fades (thinning by rank, the blend into the ground, the
  far layer growing in); `buildGrass` + `grass.update(camera)` back in engine/game.js. The wind is the
  web's own (wind.js: the traveller's push, the plants' uWind), its wisps a mesh in the mirrored
  scene on the port's Memento/Wisp, their points and alpha a frame through op 8.)
- [x] The web wakes the answering flowers by the traveller's nearness sooner. (2026-10-06: two causes. The
  bridge paused the answering plants (and the animals) at a fixed view, which main.js doesn't; and a
  material's colour and glow changed after it was sent never reached Unity, so a waking flower opened
  but stayed its quiet green. The mirror now sends a material's live colour and glow (op 15, to every
  copy the port made of it: lamps, beacons, the temples' lights too), and a view settles 1.5 s.)
- [x] Some of the web's people are MakeHuman bodies the bridge does not load yet. (2026-10-06: engine/game.js
  loads the world's MakeHuman people as main.js does (`usesMakeHuman`, `loadPeople`: the story's people,
  the crowd's pooled bodies, everyone the story makes); body.bin read through the host, packed with the
  players. Their faces' shape keys (FACE_KEYS, a texture the port's Surface doesn't read) stay at rest.)
- [ ] What the bridge still leaves out (engine-bridge.md, "The web's newer look and the rest of the
  world"): hatching that follows the form (`S_FORM`: its per-vertex axis), the makers' boxes' star and
  ray (`MAKERS_BOX`), the MakeHuman faces' shape keys (`FACE_KEYS`), the overshirt's lining; some people
  near the camera hold their things out sideways in Unity (not understood yet). And the coral-shirt
  traveller's overshirt cloth steps on the VM's thread (the web: a Worker): its sim as a C# job.
- [ ] Run the Unity APK on the Retroid once it builds through the bridge
  (`scripts/bench/android-run.sh`). **Blocked**: no Android device is attached.
- [ ] Connect an MCP client to the editor. **Blocked**: an organization policy blocks registering
  unknown MCP servers (the configured UnityMCP server also fails to connect). The editor is driven in
  batch mode instead (`scripts/unity-export/unity-batch.sh`).
