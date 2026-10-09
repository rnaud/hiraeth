# Done

What has been built, moved out of TODO.md (2026-10-05). The changelog (src/changelog.js) says when each
change reached players. Newest sections at the bottom.

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
  smoothness. *(src/feet.js, src/locomotion.js; docs/systems/animation.md, "Locomotion")*
- [x] Prototype a walk → run → sharp turn → stop sequence. Verify stable planted
  feet, no abrupt pose changes, and responsive control. *(tests/gait-sim.js,
  tests/locomotion.test.js: slide per contact 1.96 → 0.16 m, sink 10 → 0 cm,
  turn response unchanged at 0.30 s)*
- [x] Add motion matching for locomotion, with procedural terrain corrections.
  *(Built: src/motion-match.js: features, search, inertialised jumps, speed
  warping, feet.js on top. Measured against the loops (docs/systems/animation.md, "Motion capture"):
  a tie on runs, 180° turns at a run and turning on the spot, better on stops
  from a slow walk, worse on starts (the controller outpaces every captured
  start), tight walking turns and stairs. So the loops stay the default and
  matching is a dev-menu switch (?mm=1); Mixamo's starts, stops and turns are
  what it lacks.)*
- [x] Extend the system to nearby NPCs, varying gait, timing, posture, and
  gestures to avoid identical-looking motion. *(Gait, timing and posture per
  person; gestures are still the shared wave and talk clips. People near you may
  also walk one of 12 captured CMU walks of their own, picked by pace and build:
  docs/systems/animation.md, "Motion capture".)*
- [x] Scale animation work by distance: detailed motion selection and contact
  solving nearby; shared or baked animation with interpolated playback for
  distant crowds. *(Feet and lean near, poses every 2nd / 3rd frame further,
  simplified skinned bodies far: src/skinned-lod.js.)*

### Success criteria

- Movement looks continuous through changes of speed and direction.
- Feet remain stable during contact; hands maintain intended grips.
- Player input stays responsive rather than waiting for an animation to finish.
- Nearby NPCs have convincing, varied motion; distant crowds remain visually
  smooth within the game's performance budget.
- Use the traveller prototype and device measurements to decide whether more
  animation tooling or a different engine is justified.

### References

---

# Player feedback backlog (2026-10-04)

Grouped by area.

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
  docs/systems/performance.md, "Rooms off the map draw only themselves". To confirm on the Retroid: the cave at 60 with the rest.)

---

# Player feedback backlog, part 2 (2026-10-04)

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
- [x] The benchmark against the web game (`scripts/bench/`, `docs/benchmark-web-vs-unity.md`): shared
  viewpoints, the players' benchmark mode, a quiet-machine gate, `mac-run.sh`; a WebGL (WebGPU) build.
- [x] An Android build (`BenchBuild.Android`: `com.rnaud.memento.unity`, IL2CPP ARM64, Vulkan + GLES3, the
  export gzipped inside and copied out on first launch).
- [x] The capes cost ~55 ms a frame at the camps (`Cape.Collide` read `Transform.position` / `lossyScale`
  in its inner loops): now one Burst job a frame (`CapeSystem`: the bodies read once, near and in view only,
  every other frame past 12 m), ~0.25 ms at the camps.
- [x] Levels of detail and culling as the web's (the exporter bakes the web's draw units and their levels,
  `statics.mjs`; `WorldDetail` picks them by screen-space error; props culled by size and distance; the flora
  by cell, instanced; the bodies' skinned levels; the crowd's mid / far / distant tiers) and the web's three
  shadow cascades on its schedule (`MementoShadows`, in place of URP's): 0.4–1.5 M triangles a frame.
- [x] The Mac benchmark player in IL2CPP (`BenchBuild.Mac`; `-mono` for the old one).

---

# Desert story rework (2026-10-05, web only)

All of this is for the web game; the Unity port follows later if we move to Unity.

- [x] The magic backpack starts empty: no fluid until you reach the skull and fill it there. Clearing
  the rubble on the way must work without it (another way through: climb, lever, push by hand…).
  (Done: `tool.empty`; the keepers' pole levers the rib off, three heaves; docs/systems/story.md, "The desert reworked".)
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
  each eye, are folded away and the upper lids lifted; docs/systems/faces.md, "Warmer faces".)
- [x] Prototype MakeHuman / MPFB bodies (CC0 exports): a few people of different ages and builds with face
  shape keys for expressions, on the game's skeleton, next to the Quaternius bodies through the same ink
  pass in the character studio. (Eight people, Body source and a comparison lineup in the studio:
  docs/makehuman.md, which recommends switching in stages.)

---

# Controls (2026-10-05, web)

- [x] The gun shoots in a straight line, not an arc, and shows no trajectory.
- [x] The jetpack fires with R2; the gun only works after L2 to aim.
- [x] The jetpack steers like the bird: point in any direction with the left stick.
- [x] B jumps off the bird or the hover car.
- [x] The ragdoll kicks in from a little higher up.

# Later

---

# Android app engine (2026-10-05)

# Dialogue (2026-10-05)

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
  shader; ~10 cm walking instead of ~1 m. src/brush.js, docs/systems/living-world.md, "Brushing past plants".)*
- [x] Most structures cast shadows. (Audited every world: nearly everything already cast; the far
  map skipped every tile of instanced props, so boulders, globes and pillars past 220 m cast
  nothing: now only tiles of small ones are skipped. Perdide's great crystal casts though it glows.
  docs/systems/rendering.md, "Who casts a shadow".)
- [x] Grass pops in: in the distance it should fade into something smaller and cheaper, not appear at a line.
  *(Tuft by tuft: shrinking, thinner, into the ground's colour and without outline; a sparse far
  layer of two-blade tufts carries the meadow ~2.2× as far; the patch no longer jumps when the
  camera turns. Fewer triangles on every preset (High 109 k → 102 k, reach 35 → 78 m). docs/systems/materials.md,
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
  as the room left, neighbours included; tight spots move a step or are skipped. docs/systems/living-world.md, "Flowers
  with room to open".)*
- [x] Make it clear when you hit an invisible wall (the traveller just stutters as you push on).
  Done: the world's edge (`src/edge.js`) takes the outward speed away (a smooth slide, no running on the spot);
  the traveller faces it and leans into the wind, wisps and ink hatching where you touch it, a line the first time.
- [x] Each world's music more thematic. (`src/score.js`, `src/score-voices.js`: each world its own
  mode, tempo, metre, instruments, leitmotif and colour; the father's theme in every one; sections in
  seeded arcs, filled by walking and riding, thinned by standing still, roofs and night. Offline
  renders: `scripts/render-score.mjs`. docs/systems/audio.md, "The score, world by world".)

# References level (2026-10-05)

# Transitions and moments (2026-10-05, web)

- [x] Walking into a building, a cave or the ship (where you're moved into another space) is janky:
  make the hand-over smooth and free of stutter. (`src/passage.js`: every door, cave mouth, temple
  door, hatch, Lab door and Hangar portal goes through one hand-over: its destination drawn ahead
  of time, unseen, at load; a sheet of paper sweeps across; behind it the traveller is carried
  through still walking, mid-stride, the camera in its place behind; a few frames held while the
  new place settles. It used to land at a dead stop with the camera snapped in to 2 m. The ship's
  and the houses' indoor framing eases the camera level instead of jumping. docs/systems/performance.md, "Hand-overs and
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
  controls. docs/systems/cinematics.md, "Moments: first times, filmed".*

# HUD (2026-10-05, web)

- [x] No persistent icon or text on the screen: the status box (place, objective, distance,
  relics, gauges) is gone. Health shows while hurt or healing, stamina while not full, the tank's
  pips beside the traveller while aiming, shooting, using the jets, refilling or switching mode,
  each fading after; the FPS readout is off by default (a setting, F, `?fps=1`); the gear only on
  touch, small and faint; the keyboard help is the menu's Controls page. Prompts only near
  something usable (the cue line for the ones with nothing to float over), toasts as before.
  *Done: `src/hud.js`, docs/systems/ui.md, "Nothing on the screen; the scout finds the objective".*
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

# Parts of open items (2026-10-05)

## MakeHuman bodies

- [x] Stage 1 (behind the studio's Body source and the game's `?mh=1`; the default people stay
  Quaternius): one parametric body for everyone (`public/anim/mh/body.json` + `.bin`, 1.7 MB, 1.0
  gzipped: MakeHuman's macro corners compressed, made into anyone on load, `src/makehuman/`); each
  world's people by age, build and their world's proportions; MakeHuman's own ten CC0 hairstyles as
  closed shells of a few locks with strand lines, and a beard from the jaw's skin, fitted to every
  head; eyes opened and a little bigger; the Moebius face as MakeHuman targets (resting smile, finer
  brows, warm shade and a child's bare face kept); the skinned levels of detail for shape-keyed
  bodies. Comparison images in docs/makehuman/.
- [x] Stage 2, the Desert (its people are MakeHuman bodies by default, `?mh=0` the Quaternius ones):
  every desert look checked on children, teenagers, grown-ups, the heavy and the old (the named ones
  closer to their character sheets: Bako, Nour, Marrow, Sefa, the Speaker); the story's children are
  children (Ilo, Kito; Lou at home) at MakeHuman's height for their age, a woman as much shorter than a
  man as before; the traveller kept on his own body; the crowd figure's shoulders and hips matched and a
  promoted crowd person given their age (an elder) and build; the cloth colliders and the ragdoll from
  each body's own girths; a scalp under every hairstyle (the crown holes) and lighter strand lines on
  dark hair; the body in one file, shipped (+1.0 MiB in the over-the-air zip). docs/makehuman.md, docs/makehuman/desert-*.

## The References level

- Done so far (for review): `?level=references` (worlds list), the six panels of IMG_3775 as views
  (`src/levels/reference-views.js`) framed like their panels, `\` / View compares (corner, overlay,
  left-half wipe), `?view=<n>`, `?look=desert` (the desert's own palette and preset). docs/systems/references.md, "The
  References". Composition is close; the scenes are sketches (the skull, the tower's cap, the sails'
  membranes, the hull's machinery are simpler than drawn).
- Shader pass after the review (2026-10-05, for review; docs/systems/materials.md, "Shade and hatching by surface",
  "Weathered walls"; docs/systems/worlds.md, "Sand banked against things"):
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
- The other desert sheets (IMG_3772: 6 panels, IMG_3773: 8, IMG_3774: 7) are views 7–27
  (`src/levels/reference-desert.js`, builders in `reference-kit.js`); compositions are sketches
  (the umbrellas' undersides, the helmets' machinery, the blue heads' plating are simpler than
  drawn).
- Done from that list (for review): slip faces hatched again (`SHADE.slip`), the desert's far haze a
  pale warm band (`uHaze`, `DESERT_LOOK`), its cumulus bank and clouds off.
- The City-Shaft (IMG_3778–3782: 1 + 5 + 5 + 5 + 7 panels) are views 28–50 (`reference-shaft.js`).
  - Shader-level, done: flat printed shadows (`uShadowFlat`, the views use it), the façades' window
    share (`windows`), views at a pitch and roll. On the world: fewer windows, less hatching, no
    cumulus.
- Vael: `references/Vael/` is empty (no sheets); its tower plain and bird are drawn on Vael II's.
- Vael II, the Sky Stones (IMG_3783–3788: 5 + 5 + 5 + 6 + 6 + 4 panels) are views 51–81
  (`reference-vael2.js`; docs/systems/references.md, "Vael II's sheets").
  - Shader-level, done: a material's own flat print (`shadeFlat`: the world's rock, plain and
    buildings at 0.85, its people, bird and flowers keep their shade); strata rock hatched down its
    faces; no cross-hatched rings under caps (wood grain). On the world: a clean sky, no bounce, a
    grey-teal shade, the needles with few strokes and no beds.
- Spot blacks, the third tier of value (the author's ask; docs/systems/references.md): a shaded point
  enclosed at a pocket's scale (G-buffer depth and normals, 8 fixed taps, 4 on the handheld, hard
  threshold) filled with the world's darkest tone, cast shadows darkened toward it by a per-world knob
  (`uSpot`, `uSpotTone`: every preset, a world's `defaults.look`, a view's `look`; `makeMaterial({ spot })`
  per material; never faces, people, grass, lights or glass). On in Moebius print; IMG_3774's views and
  the Buried Machine (world and views) print their cast shadows darker.
- The Buried Machine (IMG_3789–3792: 5 + 6 + 6 + 5 panels) are views 82–103 (`reference-buried.js`):
  huts, pipes, oval walls and doorways, tanks, machinery, the drum, the hanging city, the ring, derricks,
  cloud. `?look=buried`.
- The Garden of Spheres (IMG_3793–3796: 4 + 6 + 6 + 6 panels) are views 104–125 (`reference-spheres.js`):
  umbrella trees with branches under their canopies (greebles for the spot blacks), pyramids, spheres and
  arches, the white hill, ruins, olives, cypresses, the plaza, lakes. On the world (`SPHERES_LOOK`): no bounce
  under the canopies, the white stone's shade the pale blue, green spot blacks. `?look=spheres`.
- Lorn II (IMG_3797–3800: 6 + 6 + 5 + 6 panels) are views 126–148 (`reference-lorn.js`, sheets "Lorn II / …"):
  trunks, giant mushrooms, eggs and pools, reeds and crystals, domes, root arches, caves, the saucer and the
  skiff, backlit at dusk with no cast shadows. The References' views' local lights now reach the shader. On
  the world: the giant mushrooms pale in their own shade. `?look=lorn2`.
- The Signal Market (IMG_3801–3808: 1 + 1 + 1 + 1 + 6 + 3 + 4 + 4 panels) are views 149–169
  (`reference-market.js`): towers with pipes and machinery, billboards, skybridges, stalls, cabs, cables, a
  crowd, the traveller. On the world: walls and shops shade flat in the street's teal (`MARKET_FLAT`).
  `?look=bazaar`. The recurring gaps across all the worlds: docs/systems/references.md.
- Gap 1, pen detail at every scale (docs/systems/materials.md): built surfaces' seams, joints, vents, hatches,
  plates and bolts, organic surfaces' grain strokes, drawn at a coarser scale with distance so they keep their
  size on screen; on every weathered building, the Buried Machine's rust, the worlds' trunks and stalks.
- Worn by time (the author's ask, docs/systems/materials.md): grime streaks, chips with the plaster lip's
  shadow, cracks with a shadow side, dust at the wall's foot (post.js), per building, lighter on the
  handheld; on in every world's plaster, mud and stone buildings. The "fuzzy dots" on view 2's dish
  column (and the "dotted texture on grazing lit faces") were faceted normals from imprecise derivatives
  far from the origin: now from the camera-relative position.

# The Unity C# port's open items, closed (2026-10-06)

Superseded by the JS bridge (Unity + Puerts, the game's own JS driving Unity: docs/systems/engine-bridge.md),
so none of these will be built in C#:

- The worlds' own scripts beyond the opening (the hover-skiff, riding the cabs, the temples, the reel's
  recordings at the console, the homecoming, the Hangar's zone presets, the reactive scenery).
- The crowd's near tier as the web's (the port gave full bodies out to 55 m).
- The EditMode story test and the batch play-through walking the desert's old opening quest.
- The desert's smaller things (the errands near the start, the reactive flowers, the scout drone, hover
  trails; swimming's strokes, diving and breath).

# Player feedback: hands, shadows, the push, contact, the bird and the rocks (2026-10-06)

- Investigate the traveller's hands rotating while gliding; keep their pose and orientation
  appropriate to the glide instead of twisting unexpectedly. (The hand bone kept its last local turn
  and the glide's arm IK, which keeps a hand's world turn, fed the forearm's change back into it every
  frame: ~10° a frame of spin. The retarget now resets each wrist to its rest turn on the forearm, and
  the glide turns the hands open, palms down, thumb edge a little up, blended with the wings; the jets'
  hands are steady too. Test in tests/hands.test.js.)
- Fix the darkened shadows looking blocky and shifting as the camera moves. Shadows on stationary
  surfaces should remain stable when only the camera moves; verify while panning and moving the camera.
  (Measured: moving only the camera changes no shadow map; the blockiness was the edge itself. The shadow
  lookup is now a sliding tent filter, same taps, and its lit fraction is steepened about a half so the toon
  cut keeps shadows their true size. The spot tier's darkening follows the shade's antialiased edge instead
  of a hard step that crawled. Checked in the desert and Vael II on High and Handheld, panning, orbiting and
  walking. The cost is within noise. docs/systems/rendering.md, "Smooth cast-shadow edges".)
- Restore the missing visual effect when pushing objects with R1 (RB / R1 on the controller). (The push's rings and spray were hidden in every room off the map (temples, the cave, the Hearth) since the interior culler of 2026-10-05 judged them by bounds cached while empty; unculled instanced effects are now measured where they are, other unculled meshes stay drawn. Pad RB and keyboard C checked on a person, crates, a creature and the temple's ball. tests/interior-cull.test.js)
- Fix feet sinking into the moving platforms and other platforms in Vael II's Belfroy. Audit
  standing and landing contact across all worlds, including moving platforms, so visible platform tops
  and collision surfaces agree and feet do not disappear into them. (The feet asked only the baked collision,
  which leaves out moving floors: they found the floor under the disc and reached through it, ~0.3 m; now they
  see `level.dynamic()` solids (src/carriers.js) and held feet ride with the disc. A disc's 3 cm-a-frame rise
  read as a stair, so the drawn body lagged ~15 cm into it: StepLag takes out the carried motion. The Belfry's
  ledge trims, the discs' rim band, pressure plates and the temple kit's wall caps, frames, kerbs and columns
  now collide as drawn. New contact audit (src/contact-audit.js, `contactAudit()`, tests/contact-audit.test.js)
  compares drawn and collision tops and walls in every world, with a regression line and a known list;
  docs/systems/movement.md "Contact".)
- When the ridden bird approaches the ground, have it extend its legs and feet in preparation,
  then land properly with its feet contacting the ground. (A landing phase from her height and sink:
  legs down and forward, wings flared, nose up and braking, the last metre's sink held to ~2 m/s, toes
  level at contact; each foot on its own ground ray, so on slopes too; a sink into the knees and a few
  steps of run-out. Also when called down or circling down riderless. Tests in tests/birds.test.js.)
- Fix the mismatch between Vael's visible rocks and their climbing hitboxes: the traveller goes
  through roughly half of some rocks while climbing. Align climbing contact with the visible surfaces
  and check the affected rocks throughout the level. (Vael II's rock collided as coarse stand-ins, up to 2 m
  inside the drawn needles, boulders, mounds and table rims; it now collides as drawn (~390 k triangles), and
  the audit's climb check is clean across the level (4618 places to ~2); Vael's rock already collided as
  drawn. Also made exact: Lorn II's trunks, caps and arches, the Garden of Spheres' spheres and umbrella
  trees, the desert's umbrella grove, the temple towers' lathes. Left: the desert's Hearth butte and Givers'
  House tower, the Buried Machine, see movement.md.)

# Player feedback, part 3: the docs, the ship, the desert, conversations, the boxes, the traveller, movement, the HUD, progression, people, the app (2026-10-05)

## Docs

- README.md much shorter; the per-system notes, measurements and history into `docs/`. (README.md is ~110 lines: what the game is, running, URL parameters, tests, shipping, the layout; the rest moved unreworded into `docs/systems/<topic>.md` and `docs/archive/`, indexed in `docs/README.md`.)

## The ship and travel

- Remove the lines leading to the cockpit: just a glowing light on the console and a button prompt to
  get started. (The floor chevrons, their hint and the dark cable strip to the dash are gone; the voicemail
  button on the dash pulses and lights the dash, the round screen above it glows "1 NEW MESSAGE", and at the
  console the prompt says "E voicemail": pressing it starts the father's message.)
- The central console opens the galactic map. (E at the holo table in the middle of the deck opens it,
  locked without power; the cockpit dash is only the voicemail now. No other key opens the map in play.)
- Travelling to another planet is not a crash landing. (The arrival brakes into the air through the
  clouds, comes down upright on its jets and settles at rest on its feet: no entry fire or smoke trail, no
  shaking, no roar, a soft touchdown; the homecoming lands the same way. The prologue's crash is unchanged.)
- Don't tell me I'm playing a recording of my dad (it defeats the purpose): I just press the voicemail
  button. (Prompt "E voicemail"; the ship says "Good morning. You have one new message." and "First new
  message." / "New message." / "End of message."; the reel search starts only from the fourth message, after
  the third has given their age away; the sketchbook and home's lock text say "message on the ship's voicemail".)

## The desert's story

- The quest shouldn't just appear: someone I talk to gives me a hint about where to go. (Marrow waits at the
  ship and calls you over; the quest starts in his talk, the drone finds him till then; every world's main quest now
  starts in a talk with its first person: quests.opensWith)
- Nour doesn't start talking by herself: she makes a sound so it's clear I should go and talk to her. (she comes
  over and calls "Psst. Child." every few seconds with a psst-and-hum sound, turned to you; the talk is on the prompt)
- The traveller doesn't say "how is it that I can understand you" (it's obvious). (the choice and Nour's
  translator answer are gone; no other world had one)
- The spark-stone goes into my inventory instead of floating around. (hidden while carried, listed under "In your
  pack" in the gear page and the Quests page, out of your hand into the well)
- The cave filling cinematic: the bottom half of the pipe still has stuff in it, so it doesn't look
  unclogged. (it was the dark: one light by the rib left half the gutter unlit, hatched like rubble; four lights now)
- Cinematics show, don't tell: the traveller reacts with at most a slight smirk, nothing corny. (no lines, no
  surprised or happy faces, no talking hands in the desert's two; a quiet 'smirk' look at the end)

## Conversations

- The camera doesn't spin round when a conversation starts: it cuts straight to the right angle. (A hard cut in and out, no blend; a new angle mid-talk is a cut too, kept to page turns, a blocked view, or one every 2.5 s; small drifts still eased.)
- Too close to someone when a conversation starts: step me (or them) back to a good distance. (src/story/spacing.js: about 1.45 m, scaled for children and giants, more for the seated; the traveller is placed back, or round them, as the camera cuts in, never into a wall, off a ledge, up a step or onto a bystander; if he can't, a standing NPC steps back instead; he is turned to face them.)
- The alien script turns into English faster. (LAG 14 → 5 letters, FADE 12 → 5: the line is all English about 0.2 s after the last word instead of 0.55 s, still word by word.)

## The makers' boxes

- Don't mention the makers' boxes until I find my first one. (Nothing about them before a box is opened: the per-world box quests, their toast, the sketchbook's "Item boxes" page, the empty gear page's line and the pilgrim's roof-box line all wait for the first; the world's other boxes are offered a few seconds after it.)
- Redesign them: a box with no edges, and a shader with a ray of light travelling across its surface. (One smooth rounded shell, inked by its outline only; the star and side compasses painted in its own shader, and a thin glowing line of light that sweeps across and wraps round it, pass after pass, with a short trail.)
- Opening: it floats and shakes slightly, like a pokéball, before dissolving. (It floats up turning a corner to the camera, then three small wobbles about its heart with rests between, each a knock and a pass of the ray, a still moment, then the dissolve.)
- The tree's pedestal looks bad: higher up (harder to reach) and fancier. (A carved makers' stone dais 7 m up the trunk on a pier, reached in two climbs: the root to its shoulder, then the pier; a drum ringed with light, two lamps and a stone halo with the glyph.)

## The traveller

- More casual, not a space suit, a backpack as originally. The fluid backpack slimmer. (An everyday
  canvas rucksack always worn, in place of the radio box; the tank is a flat glass flask set into its outer
  face, 22 cm off the back instead of 34; no suit seams, boot buckles or ringed collar left; the drone docks on
  the flask's upright, out of the arms' way.)
- Build on the new reference (`references/main character/new*.JPG`, the coral-jacket redesign): thinner
  cheeks, scruffier hair, and whatever else brings him closer to it. (A leaner face with slim cheeks and a
  narrow jaw; a curly mop of broken locks with a parted fringe and lighter lock edges; a bunched cotton cowl,
  soft slouched desert boots with sand soles, a tiny hidden earpiece.)

## Movement and camera

- The jetpack flies like Superman: I can orient up, or down (I can't point down now). (RT / R2 with the
  stick flies where the camera looks: look up to climb, down to dive, straight down head first; the stick
  at rest hovers, A / × held rises; the body lies flat along the flight, arms ahead; low flight skims
  rising ground; diving into the ground lands.)
- Inside a temple I sometimes can't aim all the way up: the camera gets stuck pointing up. (The tight
  rooms' look-up limit, ~36°, held the aim too; aiming now goes to ~86° anywhere and eases back after.)
- Ragdolling down a long fall, the fall sometimes stops, the traveller stands up in mid-air, then keeps
  falling. (The ragdoll ended after 3.5 s wherever it was; now only on the ground. The landing hurts like
  any fall, and the camera keeps up.)
- Always a slight shadow under the traveller while jumping, for precise platforming. (A patch of shade
  straight under you whenever you are off the ground, inked like a shadow, shrinking with the height.)

## HUD, menus and bosses

- "J to close" makes no sense on Android with a controller; B closes the menu too. (The sketchbook, what's new, the worlds picker and the skip tags name the pad's back button, printed B, or nothing on touch: prompt-keys.js closeHint; B closes the Start menu from any page; the controller's back closes the panel on top first, the sketchbook before a conversation or a moment under it.)
- No three pills for the gun's level: it already shows on the backpack. (ToolHud: no pips, no refill seconds; nothing beside the traveller while the tank is short or the jets burn; only "empty" for 3 s when it runs dry.)
- The drone's second pointer doesn't make sense (the drone already heads the way to go): remove it. (No beak, no beam on a find; the flare stays. Also fixed its aim, which the capsule sweep zeroed every frame, so it now really faces what it found.)
- Bosses show a damage bar: show a health bar. (boss.js guardianBar: full at the start, going down; "health" for a machine, "unrest" for a living guardian; lifted above the cue line.)
- The vents boss: the vents only open a few times, then not any more. (The Warden's Well: in its second phase its side vents stay shut by design and only the crown opened, unseen from the floor and told once. Now its crown hatch swings up with a column of glow every time, the phase has its own open line, and any side vent counts in the first phase; tests/bosses.test.js. Also fixed: the Gardener could never be calmed, bloom reached it as water.)
- The drone can give a hint about what to do against a boss. (src/temples/hints.js: a ping in a guardian's fight chirps, turns the lens beam on the weak point or the thing to use, and says a line; three lines a phase, plainer each ping; the weary guardian asks for your hand.)

## Progression

- The jetpack comes in the later half of the game, not the second world unlocked; the winds and gliding
  come first. (New route: desert, Vael (wings, and the wind up its tower), Vael II (after Vael), Lorn, Lorn II,
  Viridel, then the City-Shaft (jets) as the seventh, and after it the worlds that want jets; tests check it.)
- After picking up the jetpack it isn't clear what to do next. (A line says what they're for, the drone
  flies up to point, rings rise through the oculus, and the temple quest says "fly up through the ceiling".)
- Taxis don't answer until I get a taxi pass in a quest. (Cabs refuse hails and boarding without a cab
  pass; Lio on the rim writes one for the fare Hask owes him; the pass is in the gear; Wren still stops.)
- Vael: the big bird can't be seen or ridden until the quest where I learn the whistle. The top of the
  tower is not a screen but a little flute for the special whistle. (She's hidden until her call is played;
  the window is a stone arch; a modelled flute on the sill plays a five-note call that brings her down.)
- The bird walks with a walking animation on the ground; taking off it leaps before it flaps.
  (A procedural gait: legs stepping, a bob and sway, wings folded; take-off is a crouch, a leap, and the
  first wingbeat at its top.)

## People

- Robes still fly through people until I get close. (A cape simulated every 2nd or 3rd frame, further off or on a 30 fps handheld, now lives all the time since its last update and is carried along with its wearer between updates, pinned and pushed by the collar and limbs on their way, so it no longer streams out behind or lets legs and arms through; the robe under a cape is a collider; the crowd's figures wear the full people's wide cape over their arms and robe, and their robes swing as the full ones do; body girths are measured on the full mesh at every level of detail. tests/robes.test.js)
- Every world on MakeHuman bodies; more variety in headwear: hats, goggles, scarves… (every level in `MH_WORLDS`, one commit a world, the children given their ages; 15 new headwear, 5 face and 3 neck pieces on the skull egg, hair squashed under hats on MakeHuman heads, a fit test on seven heads, each world's set drawn apart so named people keep their looks; the studio's headwear lineups; docs/makehuman.md stage 3)
- Alien species on the planets: non-humanoid characters (people, not animals). (Four peoples with procedural bodies, no skeleton: drifters in the Garden of Spheres, stilt-walkers in Vael, shellbacks in Lorn II, murmurs in the Signal Market, three or four each. Each has its own idle and movement, voice and script, tones shown as glow and gesture, a portrait and two-shot, listen-only talk with quest hints, its own reaction to the fluid tool, levels of detail and shadows. docs/systems/aliens.md)

## The app

- A new icon for the app. (A capture of the References' dish city, view 22, through the game's ink;
  `node scripts/icons.mjs all` re-captures it and makes every Android, web and Steam Deck size, with an
  adaptive foreground, sky background and themed silhouette; four other views kept in `docs/icon/`;
  docs/systems/app-icon.md.)


# The JS bridges (2026-10-06)

- The JS bridges: our JS game code inside Godot (GodotJS) and Unity (Puerts), the engine only rendering. (The game's modules bundled into the engines' V8 with browser stand-ins, the three.js scene mirrored each frame: in Godot through a first port of the ink look, in Unity through the C# port's own; the desert plays in both, side-by-sides and frame times against the web and a recommendation in docs/systems/engine-bridge.md. Unity + Puerts chosen; since then: a 2.5-3.3x cheaper sync, the platform layer with the HUD and conversations in uGUI, and the rest of the picture and the play: the game's own sound on a Web Audio shim, life, weather, the tool and the drone, local lights, motes, prints, GPU instances; the desert, the City-Shaft and the Signal Market side by side; players for macOS (IL2CPP), Linux (the Deck's, Mono) and Android (IL2CPP ARM64, run in an emulator), measured against the web.)

# Contact, the second pass: every world solid where it is drawn (2026-10-06)

The author's requirement was no feet sinking anywhere, and the first pass left the desert's Hearth butte and
Givers' House tower, the Buried Machine and the cities on coarse stand-ins. What was done, with the numbers
and what is still left, is in docs/systems/movement.md, "Contact".

- The audit was answering half the question: its tops are sampled on the *collision*, so anything drawn with
  no collision of its own was never sampled. `auditContact` samples the drawn walkable faces too now
  (*walks through*), and leaves out a moving solid's own meshes, a guardian's model with them.
- Three bugs came out of the desert: `Kit.both()` took its copy of a non-indexed geometry after `add()` had
  already transformed it in place, so every proxy without an explicit stand-in sat at twice the kit's origin
  (the Hearth's hall had no collision where it is drawn); Qanat's dry well collided as a closed cylinder whose
  cap was an invisible floor 1.1 m over the terrace; and `NPC.move` leaned on whatever it walked into instead
  of walking along it, so a villager could never round the well to the gathering at the tree's foot.
- Made exact: the desert (the butte, the tower, the leviathan, the hull, the giant, the petal station,
  Qanat's houses and the giant's cave), the Buried Machine (the trench's pipe strata, collars, tanks and ribs,
  the drum's rail, windows and porthole, the Engine-House's gantry, ember floor, pipes and bands), the Garden
  of Spheres (the hill's boulders, the pillars, the monoliths, the android wood's ruins and statue, the
  Footprint's heel), Lorn and Lorn II (the Hush-House's dome, ribs and crystals, the Lamp-House's bands and
  pool-lamps, the root heaps, the cave gate, the arches' roots, the glass dome's ribs, the drapes over the
  root cave), the Signal Market (the tower billboards, the awnings, the fascias), Viridel (the glass dome and
  its ribs), the First Garage (the clocks, the escapement wheels, the floor dial) and home (the houses' bands,
  window frames, chimney cap, ceiling dome).
- The temple kit's rotunda cornice, which overhangs its wall by 0.4 m, is solid, which cleans every temple.
- The cost, measured: a few ms a world on the BVH's bake (the Buried Machine 24 → 31 ms, the desert 60 → 69),
  ground rays and capsule pushes unchanged within noise. The collision budgets of the Buried Machine, the Deep
  Wood and the Garden are raised in their tests with those measurements beside them.

# Player decisions and menu redesign (2026-10-06)

- Flying cabs are self-driving. Players ride seated inside the cab, not standing on its roof
  or awning. Remove driver characters and references to human drivers; preserve usable boarding,
  destination selection, travel and disembarking with the player correctly seated during the ride.
  This answers the earlier question about where passengers should stand.
  (Done: no driver in any cab; an open cabin with a seat under the canopy, the traveller seated in
  it, hands resting; the dash asks where to and the cab flies itself to the stop, where you step
  out. Wren is the old cab itself. docs/systems/movement.md "Riding a cab", tests/cab-ride.test.js.)
- Replace the sketchbook interface with a game menu inspired by Ocarina of Time, with multiple
  distinct panels and clear controller navigation. Include an Items panel showing collected items
  and a Quests panel. Use the game's own visual style and assets.
  (Done: four panels, Items, Quests, Sketchbook, Worlds, turned with LB / RB, a cursor over each,
  A / × uses or looks, B / ○ closes; items drawn from their own models; docs/systems/ui.md, "The game menu".)
- Simplify the current quest presentation: show only the overall goal and the next actionable
  step, updating as progress changes. Do not show the full quest log or accumulated history in the
  current quest view. Apply this to the Quests panel and any current-quest summary shown in play.
  (Done: each quest's goal, src/story/quest-goals.js, and its current step only, in the Quests panel
  and on the scout's find; finished quests a short list of titles; the Start menu's old quest log is gone.)

# Questions for the author, answered (2026-10-07)

- The push's rings and spray (RB / R1) were missing in every room off the map and are back
  (DONE.md). Were they also missing **outdoors**, in the open world? Nothing in the code says they
  were, and no one has seen it; if they were, that is a second bug and wants looking at.
  Answered without the author: no. In the running game (headless Chrome, keyboard C and a fake pad's
  RB), every world's open air and every room off the map (the desert's four, one each in the other
  temple worlds, Viridel's two) drew the push's three rings and its spray, and nothing hid them at draw
  time; the only misses were a push made while a conversation opened (Lou at home), which is input
  being paused, as it should be. `tests/push-fx.test.js` fires it in every world and room, both ways.

# Contact, the third pass: what the second left (2026-10-07)

The second pass made every world collide as it is drawn (above; docs/systems/movement.md, "Contact").
What the audit still found after it, and how each was settled:

- The Buried Machine's **great wheel**: it turns for ever once the story turns it, and its spokes
  are seven to its many teeth, so no still shape is right at every angle; its collision stays a disc
  of the rim. That is most of what the audit still finds in any world (69 feet sink, 49 climbs
  inside, 102 climbs off). Exact wants a *turning* collider (`src/physics.js`, `src/carriers.js`),
  which nothing else needs yet. Done: `physics.addMover` (the drawn wheel, ~8 k triangles, its own BVH
  in its own frame, synced each frame), carrying you standing or climbing (`moverCarrier`); the audit
  69 → 37 feet sink, 102 → 11 climbs off, 18 → 0 unseen floor (what is left there is sand and the rims);
  queries unchanged (movement.md, "Moving colliders").
- The Buried Machine's **cross-wall opening rims**: solid, `SandDrifts` gives them a footprint
  and banks sand right across the passage you have to walk through. Done: solid, and the drifts' mask
  is 0 on the way through each opening (`passageMask`: the opening's width at the floor, 11 m either
  side; the wall's own drift crossed it too, up to 0.57 m); climbs inside 50 → 36.
- **Lorn II's bank roots and whip roots**: solid, the 26 bank roots alone doubled every collision
  query (bake 60 → 120 ms, 20 k ground rays 25 → 50 ms, 20 k capsule pushes 46 → 93 ms) for about one
  audit sample. They sprawl 10–40 m off the path. Done: solid as drawn in the main BVH, with the arches'
  splayed feet (154 → 172 k triangles; walks through 21 → 5). The doubling did not reproduce: measured
  before and after in one process, interleaved, fastest of 9–15 (a single run swings 2–3× on a busy
  machine), the bake is +4–11 ms, rays and capsules round the spawn unchanged, along the path rays
  +5–18 %, capsules +11–15 %. Lighter shapes (capsule chains, a BVH of their own) would cost more: the
  roots line the whole path, so a second BVH is a second traversal for every query there.
- Smaller, each with its reason in movement.md: the Garden's olive and cypress trunk colliders
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

# Parts of open items (2026-10-07)

## The References level

- Shader limits:
  - Spot blacks (`uSpot`) fill the shaded pockets our scenes have; the sheets' interiors are dense
    small machinery at every scale, so most of their black masses have no geometry to sit in here yet.
    Vael II's spawn on High pays +1.7 ms for them (its many shaded overhangs). Done (October 2026): a kit of small
    machinery (`src/levels/greeble-kit.js`: pipe runs, valves, conduits, casings, plates, cables; rock knobs) dresses
    the Buried Machine's drum and trench walls, the City-Shaft's terrace undersides, the Market's back alleys (solid
    as drawn) and Vael II's cap undersides (drawn only), and the Buried Machine's and Vael II's views; each world
    within ~0.5 ms at Handheld (references.md, "Small machinery at every scale").
  - IMG_3774's cast shadows are near-black ink masses with a hard edge: a world-level "ink shadow"
    option is missing (`uCast` lightens, it does not blacken). Done: `uInkShadow` (rendering.md, "Ink shadows").
  - Flat shadow per material: the City-Shaft's trees go grey-blue with `uShadowFlat` on, so the world
    does not use it. Done: the world prints flat at 0.8, its trees say `shadeFlat: 0`, people keep their shade.
  - The half-tone cannot tell a back wall inside another's cast shadow (it reads as half-tone, the
    panel's is full shadow). Done: `castBeyond`, one shadow tap toward the sun (materials.md, "The half-tone and
    another's cast shadow"); built walls only.
  - Paper grain is screen-fixed, kept light (`uPaper` 0.7); the sheets' is heavier and on the page.
    Done: removed (it read as a filter stuck to the screen), with the vignette; the lines' wobble turns with the world.
  - The gorge panels' walls are in cast shadow from the rim; ours are form-shaded. Done: IMG_3775 p3's sun
    low from the right (the walls cast through the shadow maps), so the right rim's shadow falls across the gorge and
    up the left wall, the pillar further down catching the sun over it; the world's rose gorge casts the same by its hour.
  - Canyon and cliff walls (IMG_3774 p5, IMG_3773 p3, IMG_3772 p3) have many vertical cracks and
    strokes down the face; our strata draw horizontal beds with sparse fissures. Done: a strata material's
    `cracks` (materials.md, "Cracks down a cliff's face"), on in the views' canyons and the desert's gorge and cliffs.
  - Weathering and drifts: stains round the doors are not drawn (the doors are separate meshes); the
    dust band at a wall's foot is hidden where sand banks against it; home's and the Market's walls
    carry no weathering yet. Partly done (October 2026): the doors of Qanat, home, the Market's shops and Vael II's
    monasteries have their stains (src/door-stain.js; materials.md, "Stains round the doors"); home's and the Market's walls have been weathered since
    v0.69 (`weathered` 0.6–0.8). The dust band is drawn on the sand bank's top edge where sand banks against a
    weathered wall (materials.md, "Dust at the foot").
  - Vael II: the needles' and stalks' terminator is a clean band on the sheets, while flat facets with
    flutes break ours into lit islands in the shade; the crevasses' walls are lit red-brown and hatched
    on the sheets, ours dark; its cloud puffs are pre-shaded vertex colours (not the flat print), its
    planets stay (the sheets have none), and dusk and night keep the old blue shadow. Done (October 2026,
    world and views; references.md, Vael II's): needles and cap tables shaded by a flute-free twin's smooth
    normals; the plain's steep faces red-brown, never spot black, hatched down in light (`CREVASSE`); the cloud
    printed flat by the real sun (`CLOUD_PRINT`); dusk and night shadows in the day's grey-teal
    (`SKY_STONES_DUSK`, `_NIGHT`); the views already hung no planets (`planets: []`, now tested).
  - The Garden of Spheres: the canopies' undersides want dense radiating *branch* lines and foliage as
    clusters of small inked leaf masses (the form hatching radiates, but the shapes are smooth lumps);
    the white stone's shade a flat pale blue with almost no strokes; the spheres' printed crescent
    whatever the sun. Done (October 2026, world and views): veins drawn as forking boughs (`FORM.veins`), the
    world's undersides veined; foliage as clusters of welded leaf masses (`leafCrown`); `WHITE_SHADE` (flat,
    hatch 0.08); the views' spheres printed in two tones with their crescent (references.md, the Garden's).
  - Lorn II: roots and bushes as dense hatched masses. Done (October 2026, world and views): a hatch over 1
    is a hatched mass (`HATCH_DENSE`: closer, heavier strokes that a half-tone keeps), `ROOT_INK` and
    `BUSH_INK` (references.md, Lorn II's).
  - The print preset keeps its cumulus bank and clouds (the worlds' own; the views turn them off). Decided
    (October 2026): left as it is. The clouds belong to the worlds (their skies, their drifting cloud shadows,
    the desert's few flat clouds); the views stay clean (`CLEAN_SKY`) to match their panels.
- Scene-level, world by world (modelling, not shading):
  - Vael II: the overhangs' drips and stalactites, the cracked eggs, the cave mouth's framing, the
    monasteries' detail (arcades, cypresses, roofs), the mushrooms' lean, the bird's standing pose
    (buildBird's rest pose lies low), the cloud sea's cauliflower detail. (Done, October 2026: drips
    rooted in the undersides and printed in their shade, cracked eggs and stones, the cave mouth hung
    with stalactites, arcades, eaves, finials and cypresses, leaning tables, the bird on long legs with
    her wings folded along her sides (`poseWings`), knobbly cloud; docs/systems/worlds.md, animation.md.)
  - The Garden of Spheres: the white hill's sculpted rock, the ruins' arcades, the robot, the hedges'
    fruit, the plaza's paving are sketches. Done (October 2026, world and views, `src/levels/garden-kit.js`):
    pillows of stone round the terraces, arcades of round arches, a robot of 28 parts, fruit hedges, paved
    rings whose joints the ink draws; the views' framing checked panel by panel.
  - Lorn II: the nest in the great cap, the caves' framing, the roots' tangle, the banks' bushes. Done
    (October 2026, world and views, `src/levels/wood-kit.js`): roots as braided strands, cave mouths framed in
    tangled arches with hanging roots and feet, bushes of leaf clumps, a woven nest of eggs under a ribbed dome.
  - The Signal Market: the crowd, the stalls' goods, the cabs. Done (October 2026): the views' crowd of
    people in coats, hoods and hats with the quiet ones, full stalls with sellers, the game's own cabs; the
    world's stalls heaped with goods (docs/systems/references.md, worlds.md). The sheets' stalls stay denser.
  - The Buried Machine: the trench's pipe mass, the city's clustered hanging towers, the drum's
    interior machinery and arcades, the oval tunnel's interior, the moon cave and the rock ledge. Done
    (October 2026, views and world): `pipeMass`, clustered `hangingTower`s, drums with arcades, machinery
    and vaulted or flat ceilings, `ovalTunnel`, `archPortal` and the moon, `rockLedge`; the world's trench
    walls U-bends, its drum's arcade and machinery, its city in clusters (references.md, worlds.md).
  - The City-Shaft: the game's is a round cream-and-blue pit with a spire, terraces and a hill-town,
    the sheets' a canyon of pink and cream stacked houses with water below; the views' houses are
    boxes (no pipes, balconies, laundry or plating under the overhangs), the cabs and blimps simple
    capsules. Done (October 2026): the views' blocks carry pipes, balconies with washing and plating under
    their overhangs, blimps, the game's cabs; the world keeps its round pit (the story, quests and cab stops
    stand on it) with half its walls pink, drainpipes, washing, plating under the terraces, three blimps and
    turquoise water at the bottom, within 0.2 ms a frame on Handheld (worlds.md).

## MakeHuman bodies

- The props the desert's sheets show that the kit lacks (docs/makehuman.md, stage 2). **Done:** Nour's
  gourds, keys and disc staff, Marrow's salvage bag and pack (no cloak: his sheet's coat), the bells on Sefa's
  hem, her oud's tassels and the oud kept out of her cloak, the Speaker's copper bell and streamers.

- `scripts/unity-export` still reads the Quaternius bodies: settled (2026-10-07). The C# port's own game
  logic is retired, so the export only feeds the old bench scene; the live game in Unity is the JS bridge,
  which loads the MakeHuman bodies as main.js does (95ca5e8, docs/systems/engine-bridge.md).

## Animation

- Measure frame times, animation CPU cost, loading time and memory on the Retroid with
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

## Dialogue

- Facial expressions and talking for the coral-shirt traveller (author, 2026-10-07). Done: his face is drawn
  in his body's shader over the painted one (`src/characters/tripo-face.js`, faces.md "The coral-shirt traveller's drawn face"). His face
  (`src/characters/traveller-v1.js`, the Tripo body) has no expression rig, so he shows none of the
  tone expressions the people's bodies get (`src/expression.js`, `TONE_EXPRESSIONS`;
  `Humanoid.setExpression`, docs/systems/faces.md) and his mouth doesn't move with the voice. Give
  his face the same channels (smile, open, brow, browTilt, squint, gaze, blink and the mouth on the
  syllables), as morph targets or a drawn face layer over the mesh, so conversations and reactions
  read on him as on everyone else, up close and in the dialogue portrait.

## Android

- Make the repository private (done 2026-10-07 on the author's word: the Retroid runs a NATIVE_API 6
  app; android.yml's TRANSITION step, the GitHub web zips and web.json, and the Pages workflow removed).

## The Unity bridge

- The Signal Market's façades lack the web's newer surface marks (the port's Surface shader
  predates them), and its light pillar. (2026-10-06: the port's Surface and composite brought up to
  materials.js / post.js — weathering, pen detail, colour patches, plating, lit windows, each surface's
  shade, spot blacks, ink shadows, lines by material, haze by depth and height, the world-anchored
  wobble, pebbles, no paper grain or vignette; the pillar is the jetpack box's beacon: the makers'
  boxes now built in engine/game.js. Not ported: hatching that follows the form, `S_FORM`.)
- The web's grass blades (flora-grass.js) and wind streaks (wind.js) are not drawn. (2026-10-06:
  `engine/mirror.js` kind `instgeo` — a plain mesh on an InstancedBufferGeometry: its instance count,
  its attributes when they move, only the range rewritten — and op 12/13 to the port's Surface
  `MEMENTO_GRASS`, now grass-shader.js's own fades (thinning by rank, the blend into the ground, the
  far layer growing in); `buildGrass` + `grass.update(camera)` back in engine/game.js. The wind is the
  web's own (wind.js: the traveller's push, the plants' uWind), its wisps a mesh in the mirrored
  scene on the port's Memento/Wisp, their points and alpha a frame through op 8.)
- The web wakes the answering flowers by the traveller's nearness sooner. (2026-10-06: two causes. The
  bridge paused the answering plants (and the animals) at a fixed view, which main.js doesn't; and a
  material's colour and glow changed after it was sent never reached Unity, so a waking flower opened
  but stayed its quiet green. The mirror now sends a material's live colour and glow (op 15, to every
  copy the port made of it: lamps, beacons, the temples' lights too), and a view settles 1.5 s.)
- Some of the web's people are MakeHuman bodies the bridge does not load yet. (2026-10-06: engine/game.js
  loads the world's MakeHuman people as main.js does (`usesMakeHuman`, `loadPeople`: the story's people,
  the crowd's pooled bodies, everyone the story makes); body.bin read through the host, packed with the
  players. Their faces' shape keys (FACE_KEYS, a texture the port's Surface doesn't read) stay at rest.)
- What the bridge still leaves out (engine-bridge.md, "The web's newer look and the rest of the world"):
  - Some people near the camera held their things out sideways in Unity. (2026-10-07: the crowd's
    GPU figures, not the full people: the port's Crowd.hlsl read the costume with the old packing
    (mask + 8 × piece + 128 × prop), so it showed the wrong pieces, several props at once. Ported again
    from crowd-shader.js (costumes.js packDress, CROWD_BODY, the cape's arm clearance, the seated robe);
    a test reads the shader's limits against costumes.js.)
  - The coral-shirt traveller's overshirt cloth steps on the VM's thread (the web: a Worker): its sim
    as a C# job. (2026-10-07: tripo-cloth.js `CLOTH_HOST.offload`: the module works out the frame's packet
    (targets, capsules, bones), the cage's steps, the garment's vertices and normals are a Burst job
    (BridgeCloth.cs, op 17; engine/cloth.js the same in JS, tested against the module). The camps' script
    update went from 13.6 to 4.8 ms a frame, the frame from 22.9 to 11.1, both on a loaded machine.)
  - Hatching that follows the form (`S_FORM`: its per-vertex axis). (2026-10-07: the axis per vertex in
    the geometry (flag 64, TEXCOORD5/6), Surface's formHatch, the dark caps' veins as branches, the
    denser hatch (HATCH_DENSE), the lifted shade's keep.)
  - The makers' boxes' star and ray (`MAKERS_BOX`). (2026-10-07: boxMarks, boxRay, the outline-only
    ink; the ray's clock sent live, op 18.)
  - The MakeHuman faces' shape keys (`FACE_KEYS`). (2026-10-07: the key texture's deltas, scaled by
    the head, as the mesh's blend shapes (BridgeHost.FaceKeys); each face's weights a frame they move, op 19.)
  - The overshirt's lining colour. (2026-10-07: back faces in it, `_Lining`; the trousers' repaired
    band in their fabric, in the vertex colours.)

## Playtest notes (2026-10-08): sound

Levels measured with the game's own Sound rendered by engine/webaudio.js (the loudest 100 ms, dBFS);
tests/sound-mix.test.js holds them.

- [x] The desert wind is far too loud. (2026-10-08: `AMBIENT_WIND` 0.4 → 0.22, and a storm adds less and
  opens the band-pass less (src/audio.js `update`): calm -46.7 → -54.1 dB, gusting while walking -42.4 →
  -47.5, a sandstorm -32.3 → -40.5, under the footsteps' and the music's level.)
- [x] The whoosh of water filling up sounds bad and is too loud. (2026-10-08: the water no longer plays the
  quest whoosh (a band-pass hiss swept to 3 kHz): `Sound.waterRise` is slowed noise through a low-pass
  that opens a little and surges, with small sine bubbles gliding up through it, at -36 dB instead of
  -22.9. The cave channel and the city well (src/story/desert.js) and the Buried Machine's oil dish use it;
  the whoosh itself is half as loud and sweeps to 2.2 kHz.)
- [x] The vehicle whistle is far too loud. (2026-10-08: calling the mount / hailing a taxi was a pure tone
  near 3 kHz at 0.11, the loudest sound in the game: `WHISTLE` 0.03, -20.8 → -30.2 dB; the train's
  whistle 0.05 → 0.03, -27.1 → -31.5 dB.)
- [x] Leaf footsteps play on every surface. (2026-10-08: the step's sample was the world's ground
  (`GROUND`), grass everywhere in a grassy world. Physics now says what its ground ray met
  (`groundKind`: 'ground', the heightfield or a world's only meshes; 'built', a mesh standing on the
  heightfield or a collider added later, the ship and rooms); Player keeps it as `footing`, `sound.update`
  turns it into the surface (`footSurface`: built → stone), and steps and landings play it. Sampled over
  a 240 m square round each spawn, the grassy worlds read 0.4–26 % stone, the desert all sand.)

## Playtest notes (2026-10-08): HUD and prompts

- On-screen hints are too obvious and hide the health bar. (2026-10-08: the notices, the cue and the
  scenes' hint are quieter: translucent paper, a thin line, no shadow, narrower. The health bar is
  always one of the layout's obstacles (src/ship/cinema.js OBSTACLES), and a notice slides sideways
  along its row before it moves down, so on a phone held sideways it wraps left of the touch buttons
  instead of being pushed off the bottom of the screen. tests/hints.test.js.)
- Starting a new quest should show a hint that looks different from the others. (2026-10-08: a quest's
  or an errand's start is its own card, ink with a gold rule, "◆ New quest" over the title and the first
  step (Quests.startToast, questToastHtml); the other notices stay plain.)
- Don't show button hints when getting into a vehicle. (2026-10-08: the cue says nothing while riding;
  the ride lines (hud.ride.*, hud.pad.*) are gone; the settings' Controls page still lists them, and the
  cab's dash asks where to by itself.)
- Loading a new level shows the touch controls again. (2026-10-08: each world is a new page, which
  started from nothing, and a browser lists a pad only after it is pressed there. What is in hand is now
  remembered for the tab (src/input-mode.js, sessionStorage), and a keyboard hides the touch buttons as
  a controller does. tests/input-mode.test.js.)

## Playtest notes (2026-10-08): menus and settings

- [x] The galactic map lists the WIP levels that were never vetted or finished. (The twelve detours built
  in October 2026 are listed in `WIP` (src/levels/names.js); the ship's map gets `CHARTED_SIDE`, the
  detours minus `WIP` (none for now), and the Sightings page leaves their slots out. The worlds list
  (L, Debug), the dev menu and `?level=` still open them; taking a world out of `WIP` charts it.)
- [x] Dropdown values in Settings can't be changed with a controller. (src/menu-pad.js: A / × opens a
  dropdown, the D-pad or stick goes through its choices, A / × keeps one, B / ○ puts the old one back;
  left / right still step dropdowns and sliders. Checked end to end with a simulated pad on the title.)
- [x] The language switched to French and the debug menu disappeared. (French: holding → from the
  menu's last button stepped onto Language, the first setting, and the same push, repeating, changed
  it; now a control never changes with the push that landed on it, and Language only changes once
  opened with A. Nothing read the device's language. The debug entries had been hidden
  from players that same day (src/dev-gate.js: a dev build, ?dev=1 or Settings → Developer panel); with
  one of those on they stay through a change of language, title and Start menu (tested in a player's
  build), and they were never keyed on English words. They are shown to everyone for now (ALWAYS_DEV).)

