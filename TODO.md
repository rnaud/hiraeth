# TODO

## Smooth, procedural character animation

Improve the traveller and NPCs with natural, responsive movement and seamless
transitions between animations. Keep the current Three.js setup for the initial
prototype; an engine migration is not required.

### Approach

- **Animation blending:** transition between idle, walking, running, stopping,
  jumping, and interactions without visible snapping. Preserve motion momentum
  across transitions rather than relying only on simple crossfades.
- **Procedural animation:** adapt feet to slopes, keep hands on climbing holds
  and objects, lean into turns, and add gaze, posture, and body reactions.
- **Motion matching:** select the next segment of animation using the current
  pose, foot contacts, velocity, and intended movement trajectory. Start with
  conventional motion matching, which does not require machine learning.
- **Optional learned motion matching:** evaluate a trained model only after
  establishing animation quality and measuring runtime costs. Browser inference
  is possible, but model size, device support, and performance must be tested.

### Existing foundations

The player animator already blends idle/walk/jog/sprint with a shared gait phase
and stride-based playback speeds. Player movement also includes procedural foot
and climbing contact. Crowds use a separate, cheaper animation system. Extend
these foundations and share animation logic where practical.

### Implementation stages

- [x] Gather suitable, licensed motion data: starts, stops, turns, pivots,
  sidesteps, landings, and interactions, in addition to locomotion loops.
  *(Done with CMU: 141 takes of 33 subjects, its terms and citation in
  docs/motion-data.md, converted by scripts/mocap/ (ASF/AMC, BVH, Mixamo FBX onto
  the library's skeleton) into public/anim/walks.glb and locomotion.glb. Mixamo
  pending the author's downloads: docs/mixamo-shopping-list.md, which the
  pipeline picks up from data/mocap/mixamo/.)*
- [x] Improve the traveller's transitions, foot contact, turning, and responsive
  body/head movement. Keep optional stop-motion styling disabled when evaluating
  smoothness. *(src/feet.js, src/locomotion.js; README "Locomotion")*
- [x] Prototype a walk → run → sharp turn → stop sequence. Verify stable planted
  feet, no abrupt pose changes, and responsive control. *(tests/gait-sim.js,
  tests/locomotion.test.js: slide per contact 1.96 → 0.16 m, sink 10 → 0 cm,
  turn response unchanged at 0.30 s)*
- [x] Add motion matching for locomotion, with procedural terrain corrections.
  *(Built: src/motion-match.js: features, search, inertialised jumps, speed
  warping, feet.js on top. Measured against the loops (README "Motion capture"):
  a tie on runs, 180° turns at a run and turning on the spot, better on stops
  from a slow walk, worse on starts (the controller outpaces every captured
  start), tight walking turns and stairs. So the loops stay the default and
  matching is a dev-menu switch (?mm=1); Mixamo's starts, stops and turns are
  what it lacks.)*
- [x] Extend the system to nearby NPCs, varying gait, timing, posture, and
  gestures to avoid identical-looking motion. *(Gait, timing and posture per
  person; gestures are still the shared wave and talk clips. People near you may
  also walk one of 12 captured CMU walks of their own, picked by pace and build:
  README "Motion capture".)*
- [x] Scale animation work by distance: detailed motion selection and contact
  solving nearby; shared or baked animation with interpolated playback for
  distant crowds. *(Feet and lean near, poses every 2nd / 3rd frame further,
  simplified skinned bodies far: src/skinned-lod.js.)*
- [ ] Measure frame times, animation CPU cost, loading time, and memory on
  desktop and physical mobile devices with representative crowd sizes.
  *(Desktop headless Chrome measured in the Bazaar and the City-Shaft (README);
  the Retroid and loading time / memory still to do.)*
- [ ] Evaluate ML only if it offers a measured advantage over the conventional
  system. Account for training data, offline tooling, model delivery, and
  browser runtime compatibility. *(Open: motion matching now exists to compare
  against, but measures behind the loops; the data, not the method, is short.)*

### Success criteria

- Movement looks continuous through changes of speed and direction.
- Feet remain stable during contact; hands maintain intended grips.
- Player input stays responsive rather than waiting for an animation to finish.
- Nearby NPCs have convincing, varied motion; distant crowds remain visually
  smooth within the game's performance budget.
- Use the traveller prototype and device measurements to decide whether more
  animation tooling or a different engine is justified.

### References

- [Motion matching and learned motion matching](https://www.theorangeduck.com/page/learned-motion-matching)
- [Three.js animation system](https://threejs.org/manual/pages/animation-system.html)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)

---

# Player feedback backlog (2026-10-04)

Grouped by area. Checked items are done; the changelog says when.

## Bugs

- [x] The skull's cave has no water until the passage is unblocked; feet no longer sink into
  the tree's platform; the first box sits on a ledge up the tree, not in a gazebo.

- [x] Prologue camera clips into everything at the start and glitches while
  moving around.
- [x] Crash landing on the first planet: the planet's shader keeps sliding
  around during the crash.
- [x] Achievement overlay stays up during a conversation: pressing A advances
  the dialogue (seen with Nima) but never dismisses the overlay.
- [x] Jetpack in the tube/cylinder level: got stuck against the ground and
  could not get out.
- [x] The bell rope goes through the building when I ring it.
- [x] Edena: the door to the crashed ship sits a few metres away instead of
  being part of the ship; it rains inside the ship. It must never rain indoors.
- [x] Perdide: looking inside the tooth flowers you can see through them (no
  inside faces / texture).
- [x] The drone on my back clips into the backpack.
- [x] Qanat's domed roofs: you sank into them (they had no real collider); now solid.
- [x] Chatter balloons drew over the dialogue choices; hidden while you talk.
- [x] A whistle when calling the mount or hailing a taxi.
- [x] Clipping pass: check that most things don't sink into surfaces. (`clipAudit()`; 139 offenders → 85 across the worlds)
- [x] Building textures and windows flicker when the camera moves.
- [x] I can't always look all the way up at the sky: the camera stops short.
- [x] Shed / feather site: looking at the stone hand does nothing; unclear
  what to do there.

## Controls (Retroid Pocket layout)

- [x] Map the buttons by position on the Retroid Pocket (B is the bottom
  button): B jump, A interact, L2 aim, R2 shoot, Select gear menu (everything
  I carry), Start options menu, Y call my mount, X ping.
- [x] Action and call-out/ping must be different buttons.
- [x] Mounts and taxis: R2 moves forward, the stick tilts up/down/left/right.
- [x] Hover car: deadzone on steering when driving forward; it turns too
  easily now.

## HUD, menus and prompts

- [x] The title screen's background in 3D: a beautiful view of the land above the clouds.

- [x] A title screen, and a save selector (up to 5 saves) at the start of the
  game: continue a save, start a new one, or delete one.

- [x] Too much on screen: remove all the button reminders.
- [x] With a controller (e.g. Retroid Pocket), show no on-screen buttons.
- [x] Button prompts use a small rounded icon, not a square.
- [x] The speaker's name sits at the top when talking to someone.
- [x] In conversations, remove "translated · XXX" (it's obvious) and remove the
  double controller hint; no hint at all there.
- [x] Portraits in conversations: just the person against a coloured
  background, not the environment.
- [x] Special places, hints and objectives are coloured in dialogue more often.
- [x] Clearer in the menu when a quest is complete.
- [x] Level screenshots (level select) should be smaller.
- [x] Don't show the "updated" screen on every level.
- [x] Select and Start screens pause the game, full screen, with their own
  menu music.
- [x] Health bar and fall damage.

## Galactic map and travel

- [x] Confirm before travelling to another planet.
- [x] Simplify the map: don't show what the worlds look like.
- [x] The description text overlaps the place names; fix the layout.
- [x] Only the next world is known; worlds unlock as you go (maybe two at first
  so there's a choice).
- [x] Remove the teleport doors to other levels now that we have the ship.
- [x] The cutscene between levels shows the approach to the planet from space.
- [x] The landing cutscene has no sound at all; add it.
- [x] Ship take-off and landing: the smoke comes from the wrong places.
- [x] The door opening outside the spaceship animates oddly; fix it.

## Camera

- [x] Prologue: a normal queen bed, not a bunk; the camera at the traveller's level like
  Uncharted (not up under the ceiling pointing at the floor), and free to tilt.

- [x] When the camera pans out for a dialogue, make sure nothing is in the way.
- [x] If the character looks at something, the camera goes behind them looking
  at it.

## Drone

- [x] The drone points where we're going, up and down as well, with a trail so
  it's easier not to lose it.
- [x] It matches my speed walking, driving and flying: it heads towards the goal
  but stays around me.

## Characters

- [x] Rebuild the traveller on the same skeleton as the other characters so
  animations don't break; put the outfit on top.
- [x] People of different heights, body types and genders.
- [x] Faces: proper eyes with a white, an iris and a pupil (not solid black).
- [x] Then the Moebius-style face shader. Redo the face shaders to look more like Moebius; add a level with very
  large faces to test and refine them. (The giant faces are in `?level=lab`; the shader
  is still to do.)
- [x] Ragdoll when falling, or when pushing people with the gun. Falls: ragdoll first,
  less damage; only a really high fall kills, then ask to "Restart".
- [x] People shake uncontrollably when pushed while walking, or when you talk to them
  too close.
- [x] Robes look stuck from afar and only fall properly up close.
- [x] Hologram of the parents: a true hologram, not a 2D drawn render.
- [x] Most animals are too small and hard to notice: make them bigger.

## Gift boxes

- [x] A quest in each world that leads you to its hidden box (2026-10-04: each box's
  quest starts when you land and points the scout at it).

- [x] Much bigger boxes.
- [x] They levitate before opening, dissolve into nothing with a shader, and the
  item levitates in the centre.
- [x] Hidden at interesting, hard-to-reach places (except on level 1). On level
  2 one is just outside the ship. (City-Shaft: now on a makers' pillar on the rim. The
  other worlds' boxes were already on climbs; the safety-net boxes by the ship only
  appear when you arrive without something the world needs.)

## World, levels and materials

- [x] Climbing into the flame burns, losing health while you stay; same for spikes and cacti.
- [x] The flame runs at one steady pace (it raced and juddered with distance and the flare).

- [x] Plants react to the player walking through them (they part and lean away).
- [x] Plants react to the wind (sway with the world's wind direction and strength, gusts).
- [x] The desert tree's flame: a 3D shape (not a flat card) with a glowing, living fire
  shader on it.

- [x] The burning tree is one large flame, drawn with a flame shader rather than
  3D geometry.
- [x] Dry sand looks low resolution and pops in while moving and driving;
  redo the shader with a different look by distance.
- [x] Cracked ground looks fuzzy in the distance and pops in while walking;
  make it a shader.
- [x] A test level for materials: metal, rock, clouds, etc. (`?level=lab`; a real metal
  surface is still to do)
- [x] No hover bike until I first find it; add a mission to find it.
- [x] Redesign the taxis and the hover car.
- [x] More flowers and plants, some large; each planet has its own flora (no
  reuse), and plants grow in clusters instead of being scattered (as in Edena).
- [x] Level 2: the area of the man by the trees is crowded and hard to see; the
  trees are too low.
- [x] The great wheel: when it turns, it clears the sand around it, then keeps
  turning.
- [x] Airtight level: walking into the portals animates off and feels jarring.
- [x] Garden of spheres: if the spheres play music, make them play, and trigger
  them by shooting at them rather than looking.
- [x] Rename the Incal: nothing in the game named after Moebius works. (The Lodestar; Arzach →
  Vael, Edena → Viridel, Perdide → Lorn, the Airtight Garage → the Sealed Hangar, Major
  Grubert → Major Brask, Malvina → Clemence, Stel and Atan → Odile and Talo; taglines
  instead of credits. Internal level ids unchanged.)
- [x] The recharge wait once on the ground is 2 seconds.

## Audio

- [x] The man who says he plays music should actually play an eerie tune.

## Quests and story

- [x] Fewer pure fetch quests: add more to each, like pushing something with the
  gun or lighting something, with a small puzzle.
- [x] Story: the hero listens to recordings of their parents made before they
  died, and the parents weren't happy with them. The recordings don't always
  fit or react to what you do; the hero believes they relate to each planet.
  Over the game it becomes clear they're old, and that the hero is trying to make
  them proud after their death. Final scene: bring back all the collected items,
  tokens of having grown up, and place them on their tomb.
- [x] The hero always faces the recording when one starts.

## Testing

- [x] The Lab big enough to hold everything: a copy of each biome (flora, fauna,
  rock formations, buildings…), with little doors to switch between them.

## Performance

- [x] Outlines of distant characters on the Retroid keep the same line width, so
  far figures turn into dark silhouettes: thin and lighten lines with distance.

- [x] Performance pass on the Retroid Pocket, with it connected for testing. (First pass: hitch-aware
  resolution, near shadows every other frame, City-Shaft trees split. Still to do with the device:
  re-measure every world, a thermal soak, and measure inside the app's own WebView 109.)

- [x] The cave with the fluid always has bad FPS, though it's a small space. (The rooms reached through
  portals are built a kilometre over the map and the whole desert below was still drawn behind the walls:
  in the cave 425 draws and 0.47 M triangles, 0.27 M of them terrain smaller than a pixel. Now a room off
  the map draws only itself (perf.js InteriorCuller, every world's temples and chambers): 87 draws and
  0.09 M triangles; the passage hides the dome behind it; the fluid's shader without a scratch array.
  README, "Rooms off the map draw only themselves". To confirm on the Retroid: the cave at 60 with the rest.)

---

# Player feedback backlog, part 2 (2026-10-04)

To start after the current work lands. Ordered from easiest to most complex.

## Quick fixes

- [x] The night lantern on the backpack's frame stays floating beside your back when the tank goes
  into the hoverbike's socket.
- [x] The traveller's face inside the helmet is the plain male face the people use, and reads gaunt and
  older: give them their own, younger face. (A white star shape also pokes above the helmet in some
  tank shots.)
- [x] Spaceship: the floor is flat, so the traveller doesn't bob up and down walking the deck.
- [x] Spaceship: the texture at the entrance shimmers.
- [x] The desert's big tree: you can see inside the roots (missing faces / open trunk).
- [x] Taxis: why are the riders giants? A taxi that comes to pick you up arrives empty.
- [x] Dialogue choices: 3 at most, usually 1 or 2 (with a test that checks every node).
- [x] Highlight "Bring back something of value", the father's first major quest: it is the
  heart of the game (in the journal, the HUD and the moment it's given).

## Tools

- [x] A character studio page (`studio.html`): people rendered with the game's own ink pass, with
  dropdowns for bodies, outfits and faces, sliders for morphology, face features, hair and
  expressions, every animation, lineups, and looks saved in the URL. For nailing the character
  designs and the face shaders without loading the game.

## Screens and presentation

- [x] Hair: everyone's hair is the same rounded cap, so it reads as a bowl cut (very visible on the
  parents' holograms). Real hairstyles. (Six real styles exist in the studio: crop, shaved, bald, curls,
  braid, flow. Still to do: give them to the tribes and the parents.)
- [x] Use the new face expressions in conversations (each line's tone drives the face).

- [x] Redesign the screens that say "Hello", "again", etc.: they feel out of place (find
  which cards these are and give them the airy title-screen look).
- [x] Holograms (the father's and all others): in colour, not blue; torso and face, not full
  body. The father has a beard.

## Lore

- [x] A reason to visit these planets and not others: they all carry the same magnetic
  signature as the thing that hit the ship (the map and the scout show it).
- [x] LORE.md: a summary of the story and the lore in one place, to read and edit.

## Spaceship

- [x] Replace the big structure at the centre of the ship with a small holo table that shows
  the planet we're on now.
- [x] Make the main deck a bit smaller, so it feels right for one pilot.
- [x] Make the inside of the ship nicer and fuller overall.

## Performance

- [x] LOD: distant structures cost as much as near ones. Add levels of detail (simpler meshes
  and no outlines far away, impostors for the farthest) for buildings, rocks and flora.

- [x] Simpler far versions of people's bodies (about 12.5k triangles each, often 5–10 in view): the
  next big triangle saving.

## Materials

- [x] A pass on materials: metal looks terrible, glow doesn't glow, glyphs are unclear (decide
  what they're for), grass is still a flat texture (small shader-driven blades instead).

## Drone

- [x] Remake the drone: a better design that folds, so it tucks neatly onto the outfit when
  it's on the traveller.

## Water

- [x] Better water shaders, and swimming.

## Home level

- [x] Make it nicer: pay homage at the tomb, real cloth physics for the hanging cloths, a
  little garden, and a home you can enter. The traveller has a daughter and a dog.

## Story

- [x] A major quest you fail despite trying, and the attempt harms the local people. They
  blame you; you say sorry; they accept it, and you have to move on.

## Temples

- [x] Each world has a massive Makers' building that works as a temple (as in Zelda).
  - Half the gadgets are found in the world and half in temples. A temple's gadget is the key
    to finishing that temple.
  - A boss at the end, with a non-lethal way to deal with it if it's organic (destroying it is
    fine if it's a robot).
  - Beating it changes something in the world: the temple covered in plants, crops growing
    again, the grove pulsing with light…
  - Built in 8 worlds (desert, City-Shaft, Vael, Vael II, Buried Machine, Spheres, Lorn, Lorn II).
- [x] Temples still to build: the Sealed Hangar (coil, a Clockwork Foreman; its portal list needs
  adapting), Viridel (needs the bloom mode), the Signal Market (needs the echo shell).

---

# Unity port (proof of concept, 2026-10-05)

The game runs in `unity/Memento` (Unity 6, URP): every world exported from the web game by
`scripts/unity-export/`, the ink look ported, the desert's opening quest playable, the other worlds
reached by ship. See `unity/README.md`.

- [x] Export, the ink look, the traveller's controller and camera, climbing, people, dialogue, quests,
  the father's charge, the chest, the bike, the burning tree, health and falls, title screen.
- [x] The traveller's run, jump, climb, glide and ride clips (the web's retargeting, baked); the suit,
  helmet, headphones, scarf, tank, drawn face and eyes, expressions from the lines' tones.
- [x] People's costumes, capes (simulated near, draped far), hats, hair and faces; seated people; the
  instanced far crowd.
- [x] The fluid tool (shoot, push, boost, wings, the stilling and ember modes); the box opening scene;
  the star box.
- [x] Sound: the web's effects and score recorded from Web Audio, wind / engine / crackle synthesised,
  the voices planned and sung as `voice.js`.
- [x] The ship: the prologue (the recording and hologram, the impact, the crash), boarding, the
  console and the map.
- [x] Wildlife, birds, footprints, wind-blown sand, dust motes, the smoke column, embers, camp smoke,
  the sandstorm; saves (Continue / New game).
- [x] FXAA, the glow, a shadow filter close to the web's; the cave's lighting.
- [x] The HUD and menus in uGUI on a camera-space canvas (in the batch shots): the status box with the
  charge's gold tag, the floating prompt, balloons, toasts, the conversation panel with its portrait chip,
  the charge and box cards, the sketchbook, the pause menu and settings, the airy title over the desert;
  all reachable with a controller.
- [x] The glide's arms-out pose (a two-bone reach over the clip); the jets' thrust flames and drops.
- [x] The holo table's planet shader; `starmap.js`'s drawn chart (planets, orbits, signature badges, the
  panel, "Travel to …?").
- [x] Shadows for the crowd's mid-distance figures.
- [x] The rain and fog weather kinds, the flammables (camp fires flare, brambles burn and grow back), sun
  rays in the composite.
- [x] The observatory (the traveller's expedition: ledges, lenses, the roof, the pages), the masked head's
  chamber, Teo's drum under its knuckle, the mask's eyes, the relics, the quest marker, the people near the
  start, a close camera in tight rooms.
- [x] A standalone macOS build that runs (`Batch.BuildMac`, a smoke test); a note on what Android would need.
- [x] Every world exported (`export-all.mjs`: one export per level id, a content-addressed shared store) and
  flown to from the galactic map: the web's unlock rules (route.js, ending.js homeOpen), the takeoff, the jump,
  the loading page, the approach from space, the entry, the fall, the landing at each world's site, the walk out.
- [x] Each world from its export: its quests and start flags, people and conversations, locators, things to use,
  targets for the fluid, boxes, story page; city crowds pooled (with their conversations), the cabs on their lanes,
  swimming and wading, the air and the sun by place, each world's score and tongue.
- [x] The look of the other worlds: metals, the new water and its bed, grass blades with soft ink, up to three
  printed planets with rings and craters; batch shots of every world against the web's (`views-worlds.mjs`, `-tour`).
- [x] The City-Shaft's main quest to its end; the Hangar's turned gravity and portals; Vael's bird; every world's
  opening step, and the fluid's stages, in the batch play-through.
- [ ] The worlds' own scripts beyond that (unity/README.md, per world): the hover-skiff, riding the cabs, the
  temples, the reel's recordings at the console, the homecoming, the Hangar's zone presets, the reactive scenery.
- [x] The benchmark against the web game (`scripts/bench/`, `docs/benchmark-web-vs-unity.md`): shared
  viewpoints, the players' benchmark mode, a quiet-machine gate, `mac-run.sh`; a WebGL (WebGPU) build.
- [x] An Android build (`BenchBuild.Android`: `com.rnaud.memento.unity`, IL2CPP ARM64, Vulkan + GLES3, the
  export gzipped inside and copied out on first launch).
- [ ] Run `scripts/bench/android-run.sh` on the Retroid (the APK has never been run on a device).
- [x] The capes cost ~55 ms a frame at the camps (`Cape.Collide` read `Transform.position` / `lossyScale`
  in its inner loops): now one Burst job a frame (`CapeSystem`: the bodies read once, near and in view only,
  every other frame past 12 m), ~0.25 ms at the camps.
- [x] Levels of detail and culling as the web's (the exporter bakes the web's draw units and their levels,
  `statics.mjs`; `WorldDetail` picks them by screen-space error; props culled by size and distance; the flora
  by cell, instanced; the bodies' skinned levels; the crowd's mid / far / distant tiers) and the web's three
  shadow cascades on its schedule (`MementoShadows`, in place of URP's): 0.4–1.5 M triangles a frame.
- [x] The Mac benchmark player in IL2CPP (`BenchBuild.Mac`; `-mono` for the old one).
- [ ] The crowd's near tier as the web's (full bodies for the nearest few within 12.5 m, the mid figure
  beyond): the port still gives full bodies out to 55 m, the most of what the camps draw.
- [ ] The EditMode story test and the batch play-through still walk the desert's old opening quest; the
  web's desert rework (the cold tree, the empty tank, the spark-stone) isn't ported yet.
- [ ] The desert's smaller things: the errands of the people near the start, the reactive flowers, the
  scout drone, hover trails; swimming's strokes, diving and breath.
- [ ] Connect an MCP client to the editor (the bridge package is installed; an organization policy
  blocks registering unknown MCP servers in Claude Code).

---

# Desert story rework (2026-10-05, web only)

All of this is for the web game; the Unity port follows later if we move to Unity.

- [x] The magic backpack starts empty: no fluid until you reach the skull and fill it there. Clearing
  the rubble on the way must work without it (another way through: climb, lever, push by hand…).
  (Done: `tool.empty`; the keepers' pole levers the rib off, three heaves; README "The desert reworked".)
- [x] The big tree is not burning at first. It only stands there until the well is filled with the
  magic liquid. (Done: `city.setLit`; the well fills while you watch, the tree stays cold.)
- [x] Then a second quest: find the special glowing rock, the only thing that can spark the liquid
  into flame, and bring it back to light the tree. (Done: the spark-stone, set in the well.)
- [x] The glowing rock is in a cave far away: to reach it you first need to find the hover car
  (the hoverbike errand), which makes the long trip possible. (Done: the Givers' Hearth, ~1.6 km out.)
- [x] A little puzzle in that cave to get the rock. (Done: the dark hall, the ball, the grille, the shelf.)

---

# Faces and bodies (2026-10-05, web; after the Lab performance fix)

- [x] Warmer faces on the current bodies: a slight resting smile by default, lighter and softer brows,
  mouth corner ticks that don't turn down at rest, warmer face shadows (skin, not the world's blue-violet
  shade), gentler face presets; tuned in the character studio and checked in every world. (Each person
  rests in a mood and wears a face shape of their people's; the model's lashes, a second heavy arc over
  each eye, are folded away and the upper lids lifted; README "Warmer faces".)
- [x] Prototype MakeHuman / MPFB bodies (CC0 exports): a few people of different ages and builds with face
  shape keys for expressions, on the game's skeleton, next to the Quaternius bodies through the same ink
  pass in the character studio. (Eight people, Body source and a comparison lineup in the studio:
  docs/makehuman.md, which recommends switching in stages.)
- [ ] Switch the base bodies to MakeHuman (docs/makehuman.md, "What a full switch would take"): one
  parametric body with the macro targets, the face ink and hair fitted to it, the crowd figure and the
  levels of detail matched; animations and motion data kept.
  - [x] Stage 1 (behind the studio's Body source and the game's `?mh=1`; the default people stay
    Quaternius): one parametric body for everyone (`public/anim/mh/body.json` + `.bin`, 1.7 MB, 1.0
    gzipped: MakeHuman's macro corners compressed, made into anyone on load, `src/makehuman/`); each
    world's people by age, build and their world's proportions; MakeHuman's own ten CC0 hairstyles as
    closed shells of a few locks with strand lines, and a beard from the jaw's skin, fitted to every
    head; eyes opened and a little bigger; the Moebius face as MakeHuman targets (resting smile, finer
    brows, warm shade and a child's bare face kept); the skinned levels of detail for shape-keyed
    bodies. Comparison images in docs/makehuman/.
  - [ ] Stage 2: costumes re-checked per body (hats, masks, robes on the heavy and the children), the
    traveller's suit and gear (`suitGeometry`, `traveller.glb`) re-fitted or kept on the Quaternius
    body, the GPU crowd figure's proportions (`packBody`) matched and a promoted crowd person given
    their nearest MakeHuman body (age, build), the ragdoll's capsules and the cape colliders against the
    new girths, the Unity export, the Lab's faces gallery, then the flip world by world (`?mh=1` the
    default per world).

---

# Controls (2026-10-05, web)

- [x] The gun shoots in a straight line, not an arc, and shows no trajectory.
- [x] The jetpack fires with R2; the gun only works after L2 to aim.
- [x] The jetpack steers like the bird: point in any direction with the left stick.
- [x] B jumps off the bird or the hover car.
- [x] The ragdoll kicks in from a little higher up.

# Later

- [ ] The JS bridges: our JS game code running inside Godot (GodotJS) and inside Unity (Puerts), with the
  engine only rendering.

---

# Android app engine (2026-10-05)

- [ ] Stop depending on the device's system WebView: the Retroid's firmware only allows its built-in
  `com.android.webview` 109 (`dumpsys webviewupdate`), and Google's WebView (even Beta) can't replace it.
  Options: launch the game through Chrome (a Trusted Web Activity: Chrome's current engine, updates for free,
  needs Chrome installed) or ship an engine inside the app (GeckoView: self-contained, +50–80 MB). Carry the
  saves over from the current app once. Measured (docs/benchmark-web-vs-unity.md, "On the Retroid"): the
  game's JS costs 21–32 ms a frame in WebView 109 against 12–13 ms in Chrome 154 (V8 10.9 vs 15.4, and the
  firmware keeps the WebView off the fast cores), so the WebView runs 30–45 fps wherever there are people,
  Chrome a steady 60 at the same pixels; the load is 21 s against 14 s. Dynamic resolution can't close it.

# Dialogue (2026-10-05)

- [ ] The speaker's portrait circle shows empty on the Retroid (seen in the device's Chrome: the chip is a blank
  yellow disc).

- [x] The choice numbers (1, 2, 3) overlap the answers' text (seen on the Retroid). (The mark's span went to
  font-size 0 for the controller/touch mark, so its em width collapsed and the mark sat on the first letters;
  now each answer is a flex row with the mark in its own column, and a controller shows the confirm button.)
- [x] People who aren't part of a quest offer no answers: you just listen. A small hint, a piece of wisdom
  about their world, a brush-off ("get lost"), or something funny; then the talk ends. (`talk: { listen }`:
  every bystander and crowd person in seven worlds, a different entry each talk, news after the temple and
  the main quest.)

---

# Feel and look (2026-10-05, web)

- [x] Plants move too much when you walk past: a light brush as you pass, not a big shove.
  *(A small quick lean away that springs back with a light wobble, by how close and how fast you
  pass: each plant a damped spring driven by your last second of steps, summed in the vertex
  shader; ~10 cm walking instead of ~1 m. src/brush.js, README "Brushing past plants".)*
- [x] Most structures cast shadows. (Audited every world: nearly everything already cast; the far
  map skipped every tile of instanced props, so boulders, globes and pillars past 220 m cast
  nothing: now only tiles of small ones are skipped. Perdide's great crystal casts though it glows.
  README "Who casts a shadow".)
- [x] Grass pops in: in the distance it should fade into something smaller and cheaper, not appear at a line.
  *(Tuft by tuft: shrinking, thinner, into the ground's colour and without outline; a sparse far
  layer of two-blade tufts carries the meadow ~2.2× as far; the patch no longer jumps when the
  camera turns. Fewer triangles on every preset (High 109 k → 102 k, reach 35 → 78 m). README
  "Grass into the distance".)*
- [x] Jump animation by phase: take-off, the top, falling back down (it looks static through the whole jump).
  Done: `src/jump.js` blends Jump_Start / Jump_Loop / Jump_Land by the vertical speed and the time to the
  ground (push, tuck, the top, the fall with the arms out, reaching for the ground), plus a landing squash.
- [x] The gun's blob impact follows the surface it hits, not a flat decal floating in front of it.
  (Projected onto the drawn triangles round the hit, wrapped over steps, rocks and trunks:
  `splat-decal.js`.)
- [x] Hands are stiff and flat: give them the natural arc of a relaxed hand, and let them move.
  (`src/hands.js`: the fingers were never posed; a relaxed arc at rest, poses by context (running,
  climbing, riding, the gun, props), gestures in the line's tone, blended, with a little drift and lag.)
- [x] The faces in the dialogue box's portrait are badly aliased. (Drawn at the circle's size,
  supersampled and shrunk by halves, saved as PNG.)
- [x] The alien text in the dialogue box lacks variety: it should look like a real written language
  (each world its own script) before it turns into English. Done: `src/story/scripts.js`, a script
  a world (an abjad, runes, an abugida, knots, logograms…, some right to left), drawn as inline SVG
  the English word's width; words turn into English one by one behind the caret; all of them on
  `tools/tongues.html`.
- [x] One stamina bar shared by running and climbing; running a little faster.
  Done: `src/stamina.js` (sprint, climbing and the crawl share it; winded when dry), an inked wheel beside the
  traveller while it isn't full; the sprint is 8.2 m/s (+14 %).
- [x] Flowers that open shouldn't clip into walls and other things.
  *(Rays round each bloom where it's placed: it leans away from what is close and opens only as far
  as the room left, neighbours included; tight spots move a step or are skipped. README "Flowers
  with room to open".)*
- [x] Make it clear when you hit an invisible wall (the traveller just stutters as you push on).
  Done: the world's edge (`src/edge.js`) takes the outward speed away (a smooth slide, no running on the spot);
  the traveller faces it and leans into the wind, wisps and ink hatching where you touch it, a line the first time.
- [x] Each world's music more thematic. (`src/score.js`, `src/score-voices.js`: each world its own
  mode, tempo, metre, instruments, leitmotif and colour; the father's theme in every one; sections in
  seeded arcs, filled by walking and riding, thinned by standing still, roofs and night. Offline
  renders: `scripts/render-score.mjs`. README, "The score, world by world".)

# References level (2026-10-05)

- [ ] A level called "references" that recreates the reference images' scenes exactly, to check the
  shaders against the intended look; `[` and `]` (L3 / R3 on device) switch between them. First
  `references/The Desert/environement/IMG_3775.JPG` (six panels), then stop and review.
  - Done so far (for review): `?level=references` (worlds list), the six panels of IMG_3775 as views
    (`src/levels/reference-views.js`) framed like their panels, `\` / View compares (corner, overlay,
    left-half wipe), `?view=<n>`, `?look=desert` (the desert's own palette and preset). README "The
    References". Composition is close; the scenes are sketches (the skull, the tower's cap, the sails'
    membranes, the hull's machinery are simpler than drawn).
  - Shader findings (what the panels do that materials.js / post.js can't yet):
    - One shadow tint multiplies every albedo. The panels' shadows are near-neutral (×0.55–0.7 of the
      lit colour, a touch warm on sand), and each surface gets its own: the tower cap's underside is a
      soft half-tone (×0.85) where the ground under it goes to ×0.4. The desert's blue-grey tint
      (#93a6cf) turns bone and sand blue (`?look=desert`). A per-material shadow tone, or a half-tone
      between light and shadow, would do it.
    - Hatching appears only in shadow and thickens with darkness, so every large shaded area (the
      cap's underside, the hull's shade, the dishes' backs) becomes a field of strokes. The panels
      hatch rock as a texture along its strata (the gorge walls, lit or not) and never hatch sand,
      bone or metal in shade (flat tone). A per-material hatch amount (and hatching on lit rock) is
      missing.
    - Ground marks: the sand ripples draw dense parallel wavy lines over every mid-distance dune and
      the print preset's pen dotting scatters coarse dots over all sand and rock. The panels' sand is
      flat colour with a few long crest lines and sparse scuffs; their pink rock has crack lines, not
      dots (terrain mode has no crack/fissure mark).
    - Lines: our outlines are heavier and even; the panels' are thin and broken, with solid black
      accents in crevices (between the ribs, inside the hull). Crest lines on soft dunes only appear
      where the slope breaks sharply.
    - Sky: the print preset's cumulus bank and flat clouds are on by default (the panels' skies are
      clean, the views turn them off); our sky dots read as a regular screen and the flat sky still
      lightens just above the horizon, where the panels' skies are an even grainy tint down to it.
      The paper grain is much weaker than the panels'.
    - The `grid` pattern on the hull reads as a regular lattice; the panel's plating is irregular.
    - The water draws even ripple strokes and pale ellipses everywhere; the panel's lake is large pale
      shallow shapes, inked round, darker in the cliff's shadow.
  - Shader pass after the review (2026-10-05, for review; README "Shade and hatching by surface",
    "Weathered walls", "Sand banked against things"):
    - Fixed: a shade per surface (`makeMaterial({ shade, shadeHue })`, `SHADE`): a lift and an own
      hue packed over the hatch strokes, a half-tone on forms turned from the sun and the ground's
      bounce under overhangs (`uHalftone`, `uBounce`, `uShadeKeep`: Moebius print only). The desert
      look no longer turns bone and sand blue; the tower cap's underside is a light half-tone.
    - Fixed: hatching by surface (`hatch`: metal and sand fewer, the views' bones and sails flat), no
      cross-hatching on lifted shades, strata rock with runs of strokes along its beds in the light.
    - Fixed: rarer ripple patches and wind lines, the print's coarse dots only in patches, fissures on
      bare rock ground (terrain `pattern: 'cracks'`: the lake's pink rock).
    - Fixed: the print preset's lines thinner and broken (1.0 / 0.55), dune crests only where the slope
      breaks (`uNormalThresh` 0.3), solid ink in the deepest crevices (`uCrevice`).
    - Fixed: the flat sky's tint down to a narrow band on the horizon, its dots a grain, the paper's
      tooth (`uPaper`).
    - Fixed: plating (`plates: true`) on the views' and the desert's hulls, its station, the ship.
    - Fixed: the water's crests in wind patches, gone far off (`WATER_INK`); the lake view's broad pale
      shallows.
    - Added (the author's two): weathered walls (`weathered`: cracks from storeys' tops and feet and
      window corners, plaster patches; on for house fronts, Qanat's walls, the views' huts; never
      metal, glass or the makers' work), and sand banked against things (`src/sand-drifts.js`: the
      desert's and the views' solids, a fillet higher facing the wind, collided, its meeting line
      drawn softly).
    - Left: the print preset keeps its cumulus bank and clouds (the worlds' own; the views turn them
      off). The half-tone can't tell a back wall inside another's cast shadow (it reads as half-tone,
      the panel's is full shadow). Paper grain is screen-fixed, kept light (`uPaper` 0.7). Drifts are
      in the desert, Vael, the Buried Machine and the views (the desert's are only outside Qanat's
      paved streets); weathering is on the desert city, house fronts and the views, not yet on
      home's or the Market's walls. The gorge panels' walls are in cast shadow from the
      rim; ours are form-shaded (lighter now, with the half-tone).
  - The other desert sheets (IMG_3772: 6 panels, IMG_3773: 8, IMG_3774: 7) are views 7–27
    (`src/levels/reference-desert.js`, builders in `reference-kit.js`); compositions are sketches
    (the umbrellas' undersides, the helmets' machinery, the blue heads' plating are simpler than
    drawn). New shader-level differences they show:
    - Shaded dune slip faces (IMG_3774 p3, IMG_3773 p1) are a dark flat tone covered in dense
      directional strokes; our sand now hatches little in shade (`hatch` 0.55), right for the flat
      dunes of IMG_3775 but too little for a slip face. A slope-dependent sand hatch would cover both.
    - Canyon and cliff walls (IMG_3774 p5, IMG_3773 p3, IMG_3772 p3) are drawn with many vertical
      cracks and strokes down the face; our strata draw horizontal beds with sparse fissures
      (`fissures`: one run per 9 m). A denser, varied vertical crack mark for strata.
    - IMG_3774's cast shadows are near-black ink masses with a hard edge; ours are the shadow tint
      (a view could darken its tint; a world-level "ink shadow" option is missing).
    - Far dunes on the horizon are a pale lilac-cream band (IMG_3774 p1, p7): aerial perspective
      that turns the far ground toward a light warm tone, not the sky's.
  - Done from that list (for review): slip faces hatched again (`SHADE.slip`), the desert's far haze a
    pale warm band (`uHaze`, `DESERT_LOOK`), its cumulus bank and clouds off.
  - The City-Shaft (IMG_3778–3782: 1 + 5 + 5 + 5 + 7 panels) are views 28–50 (`reference-shaft.js`).
    - Shader-level, done: flat printed shadows (`uShadowFlat`, the views use it), the façades' window
      share (`windows`), views at a pitch and roll. On the world: fewer windows, less hatching, no
      cumulus.
    - Shader-level, left: flat shadow per material (the world's trees go grey-blue with it on, so the
      world doesn't use it yet); the sheets' faces carry fine vertical cracks and pipes (weathering is
      sparse beside them); the deep shaft views fade to a pale blue haze with depth (our fog is by
      distance, not by depth down the shaft); a few lit faces at grazing angles show a dotted
      texture (to look into).
    - Scene-level: the game's City-Shaft is a round cream-and-blue pit with a spire, terraces and a
      hill-town, the sheets' a canyon of pink and cream stacked houses with water below; the views'
      houses are boxes (no pipes, balconies, laundry or the plating under the overhangs), the
      cabs and blimps simple capsules.

# Transitions and moments (2026-10-05, web)

- [x] Walking into a building, a cave or the ship (where you're moved into another space) is janky:
  make the hand-over smooth and free of stutter. (`src/passage.js`: every door, cave mouth, temple
  door, hatch, Lab door and Hangar portal goes through one hand-over: its destination drawn ahead
  of time, unseen, at load; a sheet of paper sweeps across; behind it the traveller is carried
  through still walking, mid-stride, the camera in its place behind; a few frames held while the
  new place settles. It used to land at a dead stop with the camera snapped in to 2 m. The ship's
  and the houses' indoor framing eases the camera level instead of jumping. README, "Hand-overs and
  loads without a hitch"; measured with `scripts/transition-perf/transitions.mjs`.)
- [x] (added) The loading screen between worlds stutters while the level is built. (`src/load-steps.js`:
  every world's build, the collision bake, the people, the flora and the warm-up run in slices of
  24 ms with the main thread given back between them; the first frame's uploads are done behind the
  loading screen. The pen already turned on the compositor: checked through a 900 ms task.
  `scripts/transition-perf/loading.mjs`.)
- [x] A few moments deserve a little cinematic: the first time the magic water flows into the basin in
  the cave, and the first time you fill the tank and discover what it does.
  *Done: a reusable moment helper (`src/story/moment.js`: panels, eases, holds, the letterbox, a
  skip with B / Menu / Esc / a tap, once per save, falling back to the old behaviour), and the
  desert's two (`src/story/desert-moments.js`): the rib rolling off, the crack, the water down the
  gutter and spreading over the basin, his face, to the world's motif; the empty tank filling in
  three colours, the bracer's rings, a first glob, his face, to the father's theme, then the
  controls. README, "Moments: first times, filmed".*

# HUD (2026-10-05, web)

- [x] No persistent icon or text on the screen: the status box (place, objective, distance,
  relics, gauges) is gone. Health shows while hurt or healing, stamina while not full, the tank's
  pips beside the traveller while aiming, shooting, using the jets, refilling or switching mode,
  each fading after; the FPS readout is off by default (a setting, F, `?fps=1`); the gear only on
  touch, small and faint; the keyboard help is the menu's Controls page. Prompts only near
  something usable (the cue line for the ones with nothing to float over), toasts as before.
  *Done: `src/hud.js`, README "Nothing on the screen; the scout finds the objective".*
- [x] The drone finds the quest: Q / Y / △ / touch ping (on foot, riding, flying) sends the scout
  a little way towards the objective (or over it when near); it hovers, points its lens beam at
  it, drops a flare there for a few seconds, chirps, names it and the distance on the cue, then
  docks. Nothing to find: a shrug, "Nothing to find here". *Done: `Scout.ping` / `FIND`,
  `Flare`; it finds the tracked or main quest's step, the observatory, the story goal, the ship.*
- [x] The quest log in the menu: a Quests page (where to go, the father's charge, current quests
  and their steps, done ones struck through, failed ones marked), reachable by controller, a
  quest chosen there tracked. The sketchbook is unchanged. *Done: `SettingsMenu.page('quests')`.*
- [x] The world's beacon: kept (it is in the world, a landmark, and the only sign of a goal in a
  world without step-by-step quests); the cyan quest marker, which did hang in the air, now shows
  only for a while after the drone has found the objective (`QuestMarker.reveal`).
