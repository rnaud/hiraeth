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
- Vael: `references/levels/Vael/` is empty (no sheets); its tower plain and bird are drawn on Vael II's.
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
  being paused, as it should be. `tests/contact-audit.test.js` (once `tests/push-fx.test.js`) fires it in every world and room, both ways.

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

## Playtest notes (2026-10-08): Dialogue

- During dialogue, when the camera points at the player's character, the character moves around.
  (2026-10-08: `player.talking` while a conversation is open; src/player.js `TALK_CALM`/`idleMotion`
  keep a fifth of the weight shift and drop the head's glances and nods, and `Animator.calm` plays no
  captured looking-about or breathing idle. On the real rig: the head's turn range 133° to 0.4°, the
  hips' sway 4.3 to 0.9 cm over 30 s, tests/talk-still.test.js.)
- The character looks around too much during dialogue. (2026-10-08: `EYE_CALM` in src/eyes.js: the
  eyes hold on the speaker whenever in reach, a tone's own gaze no longer pulling them off; with nobody
  in reach, a glance every 3–6 s, less than half as far. With the head held, above.)
- Choosing a dialogue option just plays the chosen line back. (2026-10-08: the answer beat is gone from
  `Dialogue.choose`: no echo in the panel, no mumble, no camera on him; the reply starts at once. The
  speaker's reply that opened by repeating the question (the swamp of lights) was reworded.)
- When Nour says to stand in the water, the answers offered don't match the context. (2026-10-08: her
  `pack` node now answers "Where is there any water, out here?" (a new `water` node: it stopped rising
  the night the light sang; then the crash or the ship) and "Could living water wake my ship?" (power).)
- Talking to Ama, the flame is in the way. (2026-10-08: every `Flames` registers itself; `flameVeils`
  gives its tongues as columns and `sightOf(physics, { veils })` scores a line through one as blocked,
  so the two-shot goes round any fire. Look shots ignore them.)
- Not every character should have a bubble over their head. (2026-10-08: src/story/balloons.js: a
  greeting balloon only for the one the objective points at, the opener of a waiting quest, someone with
  a conversation you have never had, or a bystander or crowd person with unheard news; shouts always.
  docs/systems/conversations.md.)

## Playtest notes (2026-10-08): the prologue and the crash landing

- [x] The intro from Dad is boring. (The recording, src/story/calls.js PROLOGUE_CALL: four lines from him
  and the cut instead of six, 34.5 → 25.5 s. "Is it on? … There you are." makes it sound live; the advice
  and the translator are one line; the boat, the school, his mother one more; then the charge word for
  word and the cut. Staged: the hum creeps in under the charge and the picture breaks up until the strike
  cuts both, so the impact answers the message. tests/prologue-call.test.js.)
- [x] A character's speech bubble shows up while the ship is still crashing. (Marrow's idle balloon: the
  hidden player sits in the parked ship near him. No balloon, crowd shout or talk prompt while a ship's
  scene plays: talkAllowed, src/ship/landing.js, in main.js and crowd.hush. tests/landing.test.js.)
- [x] A character stands too close to the ship as it crash-lands. (Marrow stood 12 m from the hull's
  centre, under its 13 m bulge; now bystanderSpot puts him 22 m out, to one side of the hatch and never
  in the furrow. Checked in headless Chrome through the prologue.)
- [x] Leaving the ship for the first time shows a prompt to go back into it. (ReboardGate,
  src/ship/landing.js: armed while aboard or walked by a scene; the ramp's "go aboard" and its E wait
  until you have been 7 m from the ramp's foot. tests/landing.test.js drives the Ship.)
- [x] The humming the game talks about is never heard. (src/story/hum.js and Sound.makersHum /
  makersHumRise: a low sung D that swells three times and lifts a fifth. It rises under the father's
  charge until the strike, sounds from the scar with the ship's "magnetic signature" line, comes from an
  unopened makers' box within 45 m every 8–12 s, and plays softly (once per 24 s) when a line, balloon,
  toast or subtitle mentions humming. About -34 dB, a footstep's loudness. tests/hum.test.js.)

## Playtest notes (2026-10-08): characters and animation

- [x] Characters' waving looks wrong. (src/npc.js set the arm's and forearm's Euler angles outright: the
  arm shot up past the head, the forearm bent about its own x, which with the arm up swung the hand to
  the face and back, and the arm snapped from the clip's pose at the start and the end. Now src/wave.js
  layWave: the upper arm out to the side and a little forward, the elbow about at the shoulder, the
  forearm up and swinging side to side, every joint slerped from the clip's pose by an eased weight.
  tests/wave.test.js. Checked in headless Chrome on Qanat's people.)
- [x] The main character's mouth opens wide and his neck moves strangely. (The captured looking-about
  idles: Animator.apply turns the rig's head to the clip's Head as read in the world, which carries the
  chest's and neck's twist our chest doesn't take, so the skull turned 105-107° on the neck, the jaw
  into the shoulder and the face stretched over it, and dropped 30° on a neck bent 46°, chin in the
  collar. limitHeadTurn eases the head's turn on the neck under HEAD_TURN (60° about it, 34° off it, eased in past 60 % of each).
  tests/head-turn.test.js plays the shipped traveller through all three idles.)
- [x] Brushing past people feels odd: they just shift in place. (Standing crowd people slid off their spot
  at up to 2-3 m/s, straight back from you, the forward walk playing as the body went sideways. Now
  crowd.js ASIDE: at most 1.1 m/s, out of your path to their side (from your own movement), and the near
  tier's body plays the captured sidestep or step back for it (NPC.sidestep) under a calm standing upper
  body, the cloth told the way they really go. tests/close-contact.test.js. Checked in the Signal Market.)
- [x] When told to look into the well, the character looks the other way. (The well's prompt is asked
  from a spot on the terrace 3.4 m from its middle, and with no `look` the traveller turned to that spot:
  standing between it and the rim, his back to the well. It now looks at wellInside, down the shaft.
  tests/desert-story.test.js.)

## Shadows and visuals (playtest 2026-10-08, done 9 October)

- [x] Marrow casts a white shadow towards the ship during dialogue; on the stairs to the big tree, shadows
  move with the camera and the character casts a white shadow. (Not the shadow maps: they follow the player
  and snap to texels as they should. The "shadows" were the spot blacks, post.js `enclosure`, a screen-space
  share of taps standing in front of a point; a tap landing on a person counted as open, so wherever a person
  stood in front of a dark mass (the ship's hull, the stair risers) the mass got a pale hole in their shape,
  offset by each tap, sliding with the camera. A tap on a person now looks past them, twice as far out, and is
  left out of the share if that lands on a person too (`occlusionShare`); crease shading (`creaseAO`) leaves
  person taps out the same way. The Unity port's Composite.shader had no person test at all and got the same
  rule. tests/occlusion-taps.test.js; checked in Qanat on the stairs, Handheld, debug view 9 before and after.)
- [x] The transition between worlds looks wrong on a white background when heading to space. (The warp,
  src/ship/cinema.js `Warp`, drew ink streaks on the paper's cream, then the next world's loading screen was
  cream too. Space now opens from the middle in the night's ink (`WARP`, `warpLook`), the streaks in cream,
  teal and red, a few stars; index.html gives the loading screen the same ink when it is reached ?via=ship.
  tests/cinema.test.js.)
- [x] Do a visual audit at different screen resolutions. (Title, HUD, pause menu, settings, a conversation,
  the journal and its Worlds page at 1280 x 720, 1920 x 1080, 2560 x 1440, 1280 x 800, 812 x 375, 375 x 812
  and 1080 x 2400, headless Chrome, screenshots plus a script listing text off screen, cut or under 10 px.
  Fixed: the pause menu's buttons ran off the bottom of a phone held sideways (Quit to title only by
  scrolling: a compact side at max-height 480 px), took two thirds of a phone held upright (smaller buttons),
  and the PAUSED title overflowed its column on tall narrow screens (sized by width too); the journal's and
  the title's smallest words (7-9 px) have a 9-10 px floor. Bigger findings are in TODO.md.)

## Playtest notes (2026-10-08): gameplay

- [x] No invisible enemies. (src/foe-presence.js measures what of a foe is drawn over its footing: at least
  0.4 m tall (or wide and flat), 0.4 m across, with a light part (pale, glowing or white-outlined) 0.2 m
  across; tests/foe-presence.test.js walks every kind through every state. It found the running shadow
  hound (a flat black pool and two 4 cm eyes: now a hump of shadow with a white outline, a glowing rim and
  lit eyes, its body white-lined as the shade's) and the tiny swarm and splinters (bigger eyes, bigger
  shards). A buried dune ray winding up its burst sank its fin and came up from nowhere: it now swims to
  its ring with the fin high (Foe.swimTo, SWIM). A foe winding up on the screen but behind a wall got no
  marker: warnSpot / hiddenFromCamera. Guards, waves and spawnKind fell back to a guessed height inside
  rocks: roomAt / openSpot (packs too). The hound's bite after stepping behind you waits 0.45 s, was 0.32.
  Checked in headless Chrome: the hound in the Eclipse, the ray in the Desert.)
- [x] The knuckles riddle is unclear. (The order is smallest finger to tallest: little, first, ring, middle.
  But the fingers were nearly the same length, the four stones the same size, every hit rang its bell
  right or wrong, and the one hint was a toast once. Now (src/story/knuckle-riddle.js): fingers clearly
  graded, stones graded 3.5-4.7 m, one to four dots cut on each knuckle, right hits stay lit and ring a
  rising scale, a miss knocks and flashes all four rust and resets; after two misses Kesh calls the order
  and the journal spells it (flag arzach.hand.hint), after three the next knuckle glints. The hand's and
  Kesh's lines mention the dots. tests/knuckle-riddle.test.js, tests/story-arzach.test.js. Checked in
  headless Chrome from in front of the palm.)

## Shadows in caves and interiors (2026-10-09)

- [x] Fix shadow artifacts in caves and interiors. (Looked at in headless Chrome with the light term (debug 5)
  and the spot masks (debug 10): the desert's two caves, the ship's deck, the City-Shaft's villas, the Signal
  Market's and the Buried Machine's temple halls, the Machine's oculus drum. Two causes. A lit seam round the
  floor of both desert caves: their domes' roughening (desert-city.js / desert-hearth.js `rough`) lifted the
  foot ring by up to 0.6 m in places, a slit the sun shone through; the foot now only goes down into the floor
  (tests/cave-seams.test.js). And dark rectangular blocks on the cave walls, in the rooms' corners and round
  their furniture, changing shape as the camera moved: the spot blacks' screen-fixed taps (next item). The
  ship's deck, the villas' and halls' light terms were clean: no acne, no light through walls. Left: a thin lit
  line under some temple hall doors seen from afar, not reproduced close up.)
- [x] Steadier spot blacks on stepped geometry. (post.js `enclosure`: its taps now lie on the surface, along
  axes tied to the world (level along it and straight up it; the world's x on level ground: `SPOT_FRAME`), each
  projected to the screen, so a point asks the same places whatever the view and every riser has as many taps
  below as above: the masses stay put as the camera moves, on 4 taps as on 8. Their radius swells 0.6-1.4×
  with two slow waves across the world (`SPOT_SWELL`), so the copies of a rib's or a jamb's edge the taps draw
  wave instead of stacking into rectangles. tests/occlusion-taps.test.js: a twin of both estimates on a
  raycast staircase (a riser at 4 taps went 0.25-0.50 across a 80° swing, crossing the 0.3 threshold; now
  0.40-0.50), the frame's and the swell's properties. Checked against the desert's sheets in the References
  (tower, sails, wreck, bridges, ribs, dish city, slot canyon: the same masses). Cost: no measurable change
  (docs/systems/rendering.md). The Unity composite takes the same estimate.)

## Touch controls at every screen size (2026-10-09)

- [x] Touch controls on a phone held sideways (812 x 375) cover the right half of the view, the button
  cluster reaching the top edge. (src/touch-layout.js: every button's place and size in one table, scaled
  by the viewport's short side over 560 px (0.64..1); ui.js TouchControls sets them inline on resize and
  when the gadget's button is added; a button never below 38 px across, growing round its own centre, its
  label never below 11 px; the stick's ring and travel scale too. The full combat cluster went from 336 x 344
  px (top at 31 px on a 375 px screen) to 226 x 235 (top at 140); 844 x 390 and 915 x 412 alike, the tall
  Android's 923 x 415 CSS px (2400 x 1080 at DPR 2.6) 249 x 259; 1280 x 800 (Deck) unchanged; upright
  375 x 812, 226 px of 375 across instead of 336. The lock button moved up 12 px and evade 6 px so no two
  buttons touch at any scale; the gadget's button sat 2 px into ping's and now sits clear. The HUD's layout
  (src/ship/cinema.js OBSTACLES) measures the buttons where they are, so the notices still keep clear.
  tests/touch-layout.test.js. Checked in headless Chrome with touch emulation at all six sizes.)
- [x] The pause menu's footer sat under the bottom at 1280 x 720 with the dev-only Debug entry (31 px, not
  one). (src/menus.css: below 760 px tall, landscape, the side's and its buttons' gaps are a little
  tighter; the footer now ends at 706 px. Checked in headless Chrome.)
## Visuals and controller menus (October 2026): the menus on a controller (done 9 October, v1.2)
- [x] Make the debug menu easier to navigate with a controller: use a grid layout and smaller level cards.
  (The worlds list, src/world-picker.js cardHtml + index.html #picker: small cards in a grid, a picture with
  its number, the name, the source and the save it opens in; the blurb and moves are the tooltip and, for
  the focused card, a strip at the foot. menuNavigate (src/controller.js) moves in 2D when the menu opts in
  with data-grid-nav: gridStep in src/menu-pad.js picks the card that way on the screen (← → stay in the
  row, ↑ ↓ the column or the nearest, ↓ past the last row wraps to the top), tolerant of the focused card
  being drawn lifted and larger. The focused card: a red frame, lifted, A on its picture, scrolled into
  view with a margin. The arrow keys move the same way. tests/pad-glyphs.test.js.)
- [x] Put button prompts inside the actual buttons in all menus, instead of in hints below them.
  (src/pad-glyphs.js: glyph(role) is a span inside the button whose label is CSS (a custom property per
  role), so a menu drawn again keeps it and native-pad.js never rewrites it. The title (A beside the
  focused entry, B in Back and Keep, X on a save's Delete, which X / □ now presses), the Start menu (B in
  Resume, A on the focused entry, the reset question), the journal (B in the ✕, now shown with a pad too;
  LB / RB on the side tabs; the strip keeps only the confirm button's verb), the galactic map (B in close,
  A in Travel and Yes, B in No; the hint lines gone), the cargo check, the restart dialog, what's new's
  Close, the worlds list's close. The Controller sends 'x' and 'y' in menus (X / □, Y / △). Keys mode shows
  the keys (Enter, Esc, Q, E or the glyph's data-key); touch hides them.)
- [x] Show button prompts that match the connected controller. (native-pad.js familyOf / padFamily from the
  Gamepad id: Xbox, PlayStation (054c, DualSense, DualShock), Switch (057e, Pro Controller, Joy-Con), the
  handheld layout (the Android app, a Retroid) as before; an unknown pad reads as Xbox. padText takes the
  family: the half of "A / ×" that matches, and its shoulders and menu buttons (L1 R1 L2 R2 Create Options;
  L R ZL ZR − +; LS RS for L3 R3 on Xbox and Switch). watchLabels now rewrites the page whenever a pad is
  listed, so conversations and prompts follow; the glyphs' labels and colours come from padGlyphs. A Switch
  pad on a computer now confirms with its A on the right (padFaces auto). The prompts in the source stay in
  Xbox / PlayStation form. Checked with simulated Xbox, DualSense, Pro Controller and Retroid pads at
  1280 × 720 and 812 × 375. tests/pad-glyphs.test.js.)
- [x] Greatly reduce text in the item debug menu; on the Retroid the item stays clearly visible. (items.html
  and src/items-page/: full screen shows the name in the bar and one short line under the item (its kind
  and its first sentence, shortLine, at most 90 letters); "more" (A, I, Enter) opens the rest in a column
  on the left and the item's canvas narrows beside it (the viewer sizes to its canvas); the hint line is
  gone, the keys and buttons are glyphs in the bar's buttons; smaller still under 480 px high. The page
  works with a pad too (a grid of cards, A opens, LB / RB or ← → the other items, ↑ ↓ zoom, the right
  stick tilts, Y turn, X reset, B close). Checked at 730 × 410 (a Retroid's CSS size), 1280 × 720 and
  1920 × 1080.)

## Fun and story: the desert's first hour shorter (done 9 October, v1.2)

- [x] **The desert's first hour shorter:** the three talk stages in a row, the empty Hearth ride.
  Already done before (c1d0dc13, the first ten minutes as World 1-1): the well heard with Nour, Ama and
  the Speaker one stage (`ask`), the dregs shot, and the bowl, camp and bell on the ride; that still left
  three talks in a row after the chest (Nour, Ama, the Speaker) and the ride's three things blinking past
  at 34 m/s. Now:
  - Nour says the Speaker's verse herself (her `quest` node; "Where the giant's eyes are marked, its mouth
    is a door"), so the `ask` stage is Ama's jar alone (`askedDone`; marker on Ama). The Speaker keeps his
    whole talk (the giants, the swamp of lights, the clue) for whoever walks with him; Nour and Ama say so.
  - Ama gives the jar on your way in if you sit at her fire before the chest (`jarEarly`); Nour then says
    "Ama's jar on your hip already" and the stage passes at once.
  - The ride: heading toward the bowl, the camp or the bell on the errand (130 m out), or the Hearth (320 m),
    a line under the view names it once (src/story/desert-way.js `CALLS`, main.js `cue`, the drone's line);
    not once it is done.
  - Measured on the game's own modules (a direct player, shortest answers): talks before the way down 4 → 3
    (after the chest 3 → 2, or 1 with the jar on the way in), pages 24 → 15, answers 10 → 6, from stepping
    out to the giant's mouth ~275 s → ~210 s (~174 s with the jar on the way in). The ride is unchanged in
    length (1.6 km, ~48 s each way at top speed) with four things named on the way out.
  Tests: tests/desert-spark.test.js (the jar alone, the jar on the way in, the call-outs), tests/desert-story.test.js.
## Cinematics, the QC pass's fixes (2026-10-09)
- [x] The Garden of Spheres' temple box sat sunk into its dais and the opening cut his head off. (The dais
  was solid only as its lathe, whose top a ray from above never lands on, so the chest stood on the floor
  under it, 0.62 m down. src/temples/spheres.js, and perdide.js / perdide2.js, sunk the same way: the dais
  solid as two cylinders, its two steps. tests/temples.test.js: every temple's chest stands on its dais top.)
- [x] The pale star's text still said it is worn on the hood. (src/items.js: "Pinned to your overshirt, or
  over the brow when a hood is up"; src/story/ending.js: "The pale star from your overshirt".
  tests/item-star.test.js.)
- [x] The City-Shaft's third panel framed a blank billboard. (The review page called the film alone, so the
  splinter never landed and LOOK UP was never shown: src/cinematics-page/runtime.js stages it as play does,
  `giveBack` on the crown's terrace with the camera looking up. Then src/story/incal-moments.js frames the
  billboard from about 45 m at 22°, so the words read.)
- [x] After the City-Shaft's moment the camera was jammed against his head. (It starts with the camera
  pitched steeply up; the moment now ends with `behind: true` (src/story/moment.js `behindHim`): the follow
  camera behind him at its usual pitch before the blend. tests/moment.test.js.)
- [x] Vael's second panel was two seconds of plain sky. (src/story/film.js `riseLook`: the long lens pitched
  down from her until the horizon sits at the frame's foot, never so far she leaves its top, widened up to 48°
  when both can't fit; she starts 90 m up instead of 120. tests/world-moments.test.js.)
- [x] Home's window seat had one angle. (src/story/home.js `seatSide`: for the second line, from the room
  beside the seat, his profile against the round window and the land through it; back to the first as he
  stands. tests/home.test.js: the lens in the room, clear of walls, him and the window in frame.)
- [x] The Lantern's light read as a dark disc far off. (The dark disc was the dusk's moon: the light itself
  was above the frame until 3 s. src/story/lantern.js: it comes from out past the crown as he sees it (a
  fixed offset could put it behind the lens), panel A frames the crown low and the light high (`frameBoth`),
  and the light never spans less than 3.2° (`orbScale`). tests/finale.test.js.)
- scripts/cinematics-qc.mjs `--probe "<js>"`: evaluates an expression in the page at every screenshot
  (`<out>/<id>/probe.json`): it found both the blank billboard (the text mesh never shown) and the Lantern's
  light (off screen).
- [x] The recordings were one slow push-in for 25-77 s. (src/ship/cinematics.js `callCuts` / `callAngle`: while
  the busts are up a recording cuts at the start of a line, at least 4.5 s apart, between the push-in behind
  his right shoulder, the two faces close from his left, his face from over the dash in the hologram's light
  (his own lines always there) and wide from the side with the window; back to the push-in as they fold, and
  after it his own lines on his face again. Words and timing untouched; 3 shots in the shortest recording,
  9 in the longest. The prologue's call keeps its single angle. tests/ship.test.js.)
- [x] The homecomings laid the tokens on one held angle for over a minute. (src/ship/homecoming.js `tombCuts`
  / `TOMB_ANGLES`: over his shoulder, his hands along the slab, his face from the headstone, Lou's face on her
  lines, at a line's start, 4 s at least each; the light, the reel and the closing line keep their shots.
  tests/ending.test.js.)
- [x] (Part of) the box opening being one camera for all 32 boxes. (src/boxes/scene.js `BOX_PLANS` /
  `boxPlan`: over the right shoulder (the first box, and the fallback), the left, from the box's side with the
  reveal from where it stood onto the item and his face, or from above; `clearPlan` falls back where a wall
  would come between. tests/boxes.test.js. A closing beat per kind of item stays in TODO.md.)

## Story: Ama calls you over for the jar; the route's people hear about Ilen (done 9 October, v1.2)

- [x] **Ama and the jar on the way in** (follow-up to 4c745687): she still waved "To the city!" as you
  passed, so few stopped for the jar. While she has it for you (`amaCallsYou`: no `desert.jar.given`, the
  tree cold), her camp shout invites you to her fire about the jar, and she calls once more at most as you
  pass near (a caller with `max: 2`, src/story/desert.js); her `hello` then asks about it ("You called me
  over. A jar?", `jarCalled`). With the jar, the old wave on.
- [x] **More of the route's people hear about Ilen** (TODO "Two or three real choices", later): once
  `calls.ilen.told`, Madame Sel, Hollin and Nour have one answer each about her; once `finale.met`, Sel hears
  that she heard it and Hollin's `after` can hear where Odile and Talo went without the promise.
- [x] **Old saves that kept Dov's token before the choice existed**: src/save-migrate.js step 3 sets
  `incal.token` 'kept' when the keepsake is there and no choice is recorded (the loader passes the
  keepsakes), so choicesMade, the Lantern's `tokenKept` and Dov's new line for a kept token see it.
  Tests: tests/desert-spark.test.js (Ama), tests/route-ilen.test.js (the Ilen lines and the old save).


## Fun and story: challenges from the temples' kit in the open (done 9 October, v1.3)

- [x] **Optional mastery challenges, the temple kit's side** (part of the TODO item, which stays open for the
  other worlds). The trials (a ride or an ability in every route world, v0.98) already had the sign, the start
  card, the clock, the best and Retry; the makers' runs join them (src/trials/kit-data.js, kit-courses.js,
  kit-run.js; `createChallenges` makes a world's trial and its runs): the temples' kit and pieces (Gust, Swing,
  Bank) stood in the open with a stand-in runtime, for good. The desert's **Wind hall** (gusts down a roofless
  hall, screens to shelter behind, three eyes to wake in one breath; Pell has a word) and Lorn's **Hush walk**
  (a causeway over the lake under three crystal pendulums, out and back dry; Sedge has a word). The quiet
  reward: the speaker's line on the results and over their head, the sign's plate keeping the best. While a
  run is on, the world's notices wait (src/ship/cinema.js `HOLD_TOASTS`). docs/systems/challenges.md,
  tests/trials-kit.test.js.
## Cinematics: the box opening's closing beat (done 9 October, v1.3)

- [x] Box openings took one of four camera plans per box (v1.2) but still the same wobbles and reveal and the
  same ending whatever the item. (src/boxes/beats.js: after the card a closing beat by kind of item,
  `beatFor` → `ITEM_BEATS` then `KIND_BEATS`: `try` (gadgets, gun modes, jets, wings, backpack: held out and
  fired once, a spray of light, a kick, its sound), `wear` (the star pinned on, a close look at it worn),
  `keep` (charms: turned over in his hand, pocketed), `fit` (tank upgrades: onto the pack, a click, shot from
  behind), `point` (the glyph lens and the listening shell: he turns toward the nearest shut box, a thread
  of light, a faint answer), `play` (the whistle and the echo shell: a few notes). Each ≤ 2 s, on a closing
  shot that keeps to the plan (`closingShot`: mirrored, swung to his side, raised); skippable (Esc / B on
  the card goes past it, in the beat ends it); a cut back to play after it. `timingFor`: a gadget's box
  wobbles three quick times, a charm's or tank part's twice and opens sooner; the side plan holds its
  reveal longer. The QC script presses A on the card (so the beat plays) and takes `--query boxPlan=<plan>`;
  every beat × plan was run. tests/box-beats.test.js, tests/boxes.test.js. The "shorter opening after the
  first few boxes" idea was not taken: the gentler two-wobble boxes pay for their beat instead.)
- [x] **Two more makers' runs.** Vael's **Feather leap** (north-west of the landing by the stone hand: a
  column of rising wind lifts open wings onto a tower's terrace, gusts down it with three screens, then a gulf
  to glide to a lower ledge; down on the plain ends it; Kesh has a word) and the Buried Machine's **Furnace
  steps** (east of the landing: eight iron pillars to jump across a glowing grate, then a door of four eyes in
  one breath, which wants the fourth chamber; Jot has a word). A run can now end on the ground under it
  (`fall`), name its own controls (`controls: 'kitwings'`) and have a bank of any size.

## The blade's captured attacks (done 9 October, v1.3)

- [x] Captured sword swings for the blade (TODO "The gameplay loop"). The three combo cuts, the guard, the flinch,
  the strafes, the whirl and the lunge were already the Sword and Shield and Great Sword packs' (v0.88–0.93);
  this adds the rest of a set: **the charged cut** (the Great Sword pack's slash, `CHARGE`: the button held
  through the first wind-up draws the sword back over the shoulder and holds it, full after 0.6 s; let go, a
  wide sweep, damage 2 / 3, staggering any foe) and **the air cut** (its jump attack, `AIR`: held at the top,
  carried in, driven down into an overhead cleave, one a jump, the whole body). Each attack's cut sits on its
  clip's fastest blade frames, measured on the traveller (tests/blade-attacks.test.js); the spark trail sweeps
  through the same window. `Animator.blendCombat` had blended nothing (the library's joints are plain nodes,
  not Bones): every swing change, the guard and the way back to locomotion now blend from the pose on screen.
  `moves.glb` +24 KB (597 → 622 KB; `until` trims the jump attack to the 1.5 s played). Not taken: the Sword
  and Shield pack's jump (no cut in it: the sword stays out to the side), the power-ups (a held pose of the
  slash itself reads better as the charge), a parry riposte (the guard's parry already opens a foe).
- [x] **The ball onto its plate, and two more makers' runs.** The stand-in runtime (src/trials/kit-courses.js
  `openRuntime`) now keeps a temple's own logic in memory (TempleLogic: a drum and its plate), and `rt.roller`
  stands the temples' Ball and Plate in the open: a ball in a straight groove that the fluid's push rolls
  along, at rest on its plate it holds it down; a new run rolls it back. The balls and plates are floors and
  walls for the traveller (the run adds them to `player.opts.dynamic`). A run's task after its gates is now
  eyes or balls (`course.task`, KitRun's `words`). The Garden of Spheres' **Sphere court** (on the meadow
  south of the mirror lake: a slalom past four stone spheres, then two white spheres rolled opposite ways
  onto their plates at a dais; Nell has a word) and the City-Shaft's **Long look** (a balcony of three stones
  out over the shaft from the rim, the ball rolled from the rim to its plate at the far end, a jump at each
  gap, no parapet: down the shaft ends it; Tobin, who sells views, has a word). Both played through in the
  game with the real push. tests/trials-kit.test.js.

## The blade's counters (done 9 October, v1.4)

- [x] **The riposte and the dash cut** (TODO "The gameplay loop"). For 0.6 s after a perfect parry the blade
  button plays **the riposte** (`RIPOSTE`, the Sword and Shield pack's slash 4: a fast overhead chop, cut
  1.30–1.43 s, 0.54 s in all): damage 3 (6 on the parried foe, which the parry stunned), it staggers anyone and
  holds them reeling 1.2 s, with a gold ring, a ring of steel as it starts and a bell as it lands. The clip's chop
  comes down 75° to the body's right (measured on the traveller), so he turns into it at once. A press during
  an evade, or within 0.15 s of its end, plays **the dash cut** (`DASH`, its attack 2: a running sweep, cut
  0.49–0.64 s) the moment the evade ends: carried past the foe on its left at up to 16 m/s, the sweep crossing
  it, damage 2; no i-frames of its own; one every 1.5 s. `moves.glb` +24 KB (621 644 → 645 908 bytes; `until`
  ships 1.8 s and 1.05 s of the two). The kick was not taken: it never moves the blade, and slash 4's chop is a
  heavier counter.

## Foes over the world's height (done 9 October, v1.4)

- [x] **Foes that use the world's height** (TODO "The gameplay loop", src/foe-height.js, docs/systems/foes.md
  "Foes over height"). A walker that can't walk straight to you plans a way over a small grid (A*, 1 m cells,
  13 m out, at most 520 cells, at most once a second): steps it walks (1.1 m), ledges a climber (blot, shade,
  stalker, hound) clambers (2.4 m) and drops it hops down (4.5 m, a heavy one 2.6 m); each clamber and drop is a
  hop with a 0.32 s crouch first. No way: it holds off 5 m out on its side, watching, and no blow is wound up at
  you out of its height reach (`STRIKE_RISE`): only a lob or a step behind you. The spitting blot (`perch`) climbs
  steps and ramps to a spot 1.7 m over you, in its reach and sight, lobs from there and won't step down off it
  while you are below and in reach. Knocked off a ledge by your cut or push (a blow counts as yours 0.9 s): from
  1.4 m it lands dazed 3.5 s with stars over it (a cut lands double), from 4.5 m it is over; the charged cut
  throws 2.2× (as the heavy third). The walkers' wall test now looks over a climbable step (it was at 0.5 m, so no
  foe climbed a step taller than that: a temple's dais stopped a machine at its foot). Not done: crystals, water
  (done next, below).
- [x] **Temple crystals and water on foes** (src/foes.js, src/foe-height.js `KNOCK.deep`, `knockedInto`). A temple's
  crystal pendulum stilled by a stilling glob (frosted, hanging there humming) is no longer air to a foe: its
  frost takes one that touches it, held `WORKS.swing.frost` 3 s, no harm, its eyes pale and a puff of frost (a
  cut lands double), and not again for 4.5 s, so it walks out of it; swinging, it knocks a foe away as before.
  A foe your cut or push carries into water 1.3 m deep or more (as deep as lifts you off your feet), off a bank
  or off a ledge from any height, is swept away: a great splash (`Waters.splash`), and it is over; the first
  time a note. Shallow water it wades; a gust's shove is not yours; a sea whose bed is walked (the Underwater
  City) is not water to knock into. The hitbox overlay's foe label now says dazed (and how long), perched,
  waiting (no way to you) and crouched / hopping. Checked in Lorn (a blot pushed off the swamp's bank, a blot
  walking into the Hush-House's stilled pendulum), headless Chrome. tests/foe-height.test.js.

## Challenges: the echo relay in the Signal Market, the vine walk in Viridel and the bell crossing in the Sky Stones (done 9 October, v1.4)

- [x] **The echo stones and horns in the open, and the Signal Market's makers' run.** The stand-in runtime
  (src/trials/kit-courses.js `openRuntime`) now carries the game's events, and `addStone` / `rt.ear` stand the
  Undertower's own `EchoStone` and `EchoEar` in the open (solid, a horn a `switch` of the stand-in's logic that
  wakes for its own note played back from the echo shell, only while a run listens; with no run on it says to
  start at the sign). A run's task can now be the horns (`kind: 'ears'`). The **Echo relay** (down the first side
  street west of the avenue: three walls hung with old dishes, then each note carried from its stone to its
  horn, every stone over 30 m from its horn; Oyo, who sells lanterns, has a word). Played through in the game
  with the real gun, shell and key. The runs' test now also keeps them clear of their world's makers' court
  (the first spot, east of the avenue, ran into it). tests/trials-kit.test.js.
- [x] **The seeds, their vine bridges and the flower-door in the open, and Viridel's makers' run.** `rt.vine`
  stands the Greenhouse's own `Seed` with a `Bridge` grown from it (`from: 'grow'`) and `rt.bud` its `Bud`; a
  bloom wakes them, for anyone, run or no run (`rt.free`), and the stand-in drives what the temple runtime
  would (`links`: a seed on grows its bridge, a bloomed bud opens; a new run takes them back). The **Vine walk**
  (four white decks in a line down the meadow's slope east of Mira's water clock, higher over the meadow the
  further they go: three 10 m gaps, a seed at each, a flower-door on the third deck; down in the meadow or the
  wings opened ends it, `noWings`; Mira has a word). Played through in the game with the real gun in bloom
  mode. The course's dispose now takes its pieces' colliders back. tests/trials-kit.test.js.
- [x] **The bell-tuned bridges and door in the open, and the Sky Stones' makers' run.** `rt.bellBridge` stands
  the Founders' Belfry's own `Bridge` from 'above' (its stones hang high over the gap: they fell up) with the
  `BellEar` that brings it down, on a bell post at the gap's edge; `rt.bellDoor` its bell-tuned `Door` with an
  ear before it. They answer the bell-note whistle within 6 m, for anyone (`rt.free`); a new run sends the
  stones back up and shuts the door. `BellEar` takes its own words now (`heard`). The **Bell crossing** (four
  decks out over the sea of cloud from the starting plateau's south rim, three 10 m gaps, a bell-tuned door on
  the last deck; the cloud or the wings end it; Sister Aube has a word). Mark 28 s over a scripted 17.2 s;
  played through in the game with the real whistle (V) in 24.8 s. tests/trials-kit.test.js.

## The galactic map's signature search and rumble (done 9 October, v1.6)

- [x] **Turn the galactic minimap into a signature-search minigame.** A world the route opens
  (src/story/route.js, same order as before) is "findable" until the player finds it on the map
  (src/story/signature-search.js `routeChart`, flag `map.found.<id>`): the map draws an uncharted region
  round it (never centred on it) and no name; a scanner (the cursor, a finger dragged over the chart, the left
  stick, W A S D) warms from violet to gold, pulses the signature's three rings faster, plays the light's notes
  louder (`signatureNotes`: `sound.lightTheme` once the opening has one, else three flute notes) and rumbles in
  threes nearer it; a signal meter (bars and a word) says the same. Half a second over the lock spot (at least
  30 px, or the planet's disc) resolves the planet; the ship says "Signature locked" and charts it. The ship
  explains it the first time (`SEARCH_LINE`, flag `signature.search.told`), the map's legend becomes SIGNATURE
  SEARCH, and the closing page's toast says a signature waits to be found (no names). Old saves keep their
  charted worlds (src/save-migrate.js step 6); the level picker and the sketchbook name only charted worlds;
  WIP worlds stay off the map. Checked in headless Chrome at 1280 × 720 and 390 × 844, with a simulated pad
  (found in about 2 s with the stick). tests/signature-search.test.js.
- [x] **Add rumble support to the game.** src/rumble.js: named patterns (hurt by hearts, a heavy foe's
  slam by distance, a hard landing, a knockdown, the potion, the charged cut, chimes, the ship's take-off, the
  search's beat, a planet found), played on the Gamepad API's `vibrationActuator.playEffect('dual-rumble')`
  (`hapticActuators` fallback: Chrome, the Deck, the Xbox app's WebView2) or the Android app's new bridge
  (AppShell `rumble`, `Rumbler.java`: the pad's own motors, or the handheld's under built-in controls;
  NATIVE_API 8, the VIBRATE permission). Settings > Controls: Controller rumble (on) and Rumble strength
  (medium), greyed out without a pad that can shake. Every rumbling cue has its picture and sound too.
  tests/rumble.test.js.

## Story clarity: the first voicemail, the singing light's theme, Qanat's repayment (done 9 October, v1.6)

- [x] **Make the years away clear in the first voicemail.** src/story/calls.js `PROLOGUE_CALL`: four lines and
  the cut, 29.4 s: "Is it on? Right. There you are. We haven't heard from you for so long." / "Your mother still
  lays your place at the table. We miss you. Both of us." / "And I'm still disappointed in you. The boat, the
  school. You leave everything half done." / "My son, make us proud. Bring back *something of value*. Until
  then, don't come home." / "Keep the translator at your ear. Nobody out there talks like—" (he pauses it).
  The key phrase is lettered as itself everywhere it is said (src/story/key-phrase.js: bold, the charge's gold,
  its ✦; dialogue.js `formatText` for the panel, choices and balloons, src/ship/cinema.js for subtitles; starred
  it is also stressed by the voice): the voicemail, the last recording, the mother's recording about Ilen, the
  market's broadcast, the Lantern, the answers "I'm looking for something of value". tests/prologue-call.test.js.
- [x] **Give the singing light a distinctive few-note theme, and restage the opening.** The theme
  (src/story/light-theme.js, `Sound.lightTheme`): five notes in D lydian at 66 a minute, A4 · D5 E5 · G♯5 ~ F♯5
  (1, ½ ½, 2 glided into from a quarter tone under, 3), one wordless high voice with a glass partial; it starts
  on the note the makers' hum lifts to. Suno can't be driven from here: the synth sings it now, and a recording
  drops into the slot without code changes (src/soundtracks.js `CUES['singing-light']`, `loadCue`, `playCue`
  with the synth's envelope; public/music/manifest.json `cues`; packaged on devices). The Suno brief (prompt,
  ~45 s, D lydian, 66 BPM, the timing to aim for) is in docs/systems/audio.md, "The singing light's theme".
  The opening (src/ship/prologue.js `OPENING_ORDER`, src/ship/cinematics.js): the theme three times under the
  voicemail, nearer each time; `pause` (he stops the reel: PAUSED on the screen, the father held mid-word, his
  face, the light appearing in the window, the theme alone); `pass` (it goes by the window, then outside past
  the hull; the ship goes dark); `drain` (the reserve, "Not enough to hold orbit"); `glide` (no fire);
  `land` (on its belly, a 52 m skid, was a 118 m furrow; no smoke after); at the hatch the ship's line and
  his: "Then track it. When we can fly, we follow it. I want to hear it again." (`LANDING_LINE`,
  `FOLLOW_LINE`). Reconciled: the ship's lines and the map's legend (LIGHT SIGNATURE), Marrow, Nour, Ama, Oum,
  Dalia, every world's "it struck my ship" answer (the City-Shaft, the Hangar, the Buried Machine, the
  Spheres, Vael II, Lorn, Lorn II, Viridel), the father's beat ("Ships go dark out there"), the people book,
  the sightings, the homecoming ("That's the light that passed my ship. I followed it all this way."), the
  relay, the Lantern (Ilen: "They drink what a ship runs on as they pass", "you came after it, all this way.
  A light can't make anyone do that"), the story bible, LORE.md, the game brief, lore/continuity.md and the
  characters' notes. Checked in headless Chrome frames (five runs; docs/systems/cinematics-qc.md, "The
  restaged opening"); no birds circle the ship in orbit any more.
- [x] **Have Qanat repay the traveller's help by repowering his ship.** src/story/desert-repay.js: once the
  tree burns, Ama, Idris, Hessa, Lula, Marrow and Nour go down to the ship and wait by the ramp; when he comes,
  each steps up in turn and pours in what their house can spare (REPAY in desert-data.js, a balloon each),
  Nour last ("You gave us back our light, child. So Qanat gives your ship its own. Now go and follow yours."),
  then `desert.ship.fed` and the ship wakes. Marrow now says the ship is drained and only Qanat ever held that
  much ("burning or cold, Qanat doesn't hand its fire to strangers"), Nour promises it ("Qanat will not let you
  leave in the dark"), Ama and the quest's texts follow; the jar alone no longer wakes it.
  tests/desert-repay.test.js, the desert story, the spark test and the playthrough.

## Completed backlog items archived from TODO (2026-10-09)

Completed status and implementation evidence below were already recorded in TODO.md; this is
a documentation cleanup, not a new runtime change. Outstanding follow-ups remain in TODO.md.

### Fun and story (docs/fun-and-story-review.md, October 2026)

- [x] **The story's peak before the ending.** Six worlds now bring a *first homecoming* (the stone, the
  light over the hill, no end card); the final chapter opens after the Signal Market and the true ending
  (the oldest recording, the end card, the credits) comes after it (src/story/ending.js, docs/systems/story.md).

- [x] **Answer the singing light, tied to Ilen**: it was her answer to the father's broadcast, sent from the
  makers' lantern with their sign ("we heard you"); it struck the ship trying to reach his voice on the reel.
  The last stretch goes to find her at the Lantern (src/levels/lantern.js, src/story/lantern-data.js).

- [x] **Two or three real choices** with consequences at the stone (Viridel's loss stays, as one of them):
  Dov's lift token (keep it, or give it back so he goes home), Hollin's promise (it costs the coming back),
  Esk's hill. The stone and Ilen both remember them (src/story/ending.js choicesMade).

- [x] **Each world's climax staged as a moment** (every route world: `src/story/<world>-moments.js`,
  docs/systems/cinematics.md).

- [x] **One trace of the singing light or of Ilen in each detour world** (and the Sightings page that
  keeps them: docs/systems/story.md, docs/systems/ui.md).


### Animation

- [x] Evaluate learned motion matching only if it measures better than the conventional system:
  measured again with Mixamo's 25 starts, stops and turns in its database (2026-10-07): it still
  slides two to five times as far as the loops (the game walks at 3.8 m/s, faster than any captured
  walking start), so the loops stay the default (`?mm=1` keeps the matcher) and the new clips play
  over them as captured starts, stops and turns (src/loco-moves.js; docs/systems/animation.md). Next:
  starts, stops and turns at the game's speeds would let the legs follow the capture too.


### Dialogue

- [x] (2026-10-07, the Retroid in the GeckoView test app: the portrait draws the person in all four
  conversations tried, 210 × 210, 280–440 colours; the Sketchbook's relic sketches and the game menu's 23 item
  pictures draw too. So in the app's engine the canvas read works and the capture path stays as it is; the blank
  disc was the device's Chrome, not measured this round. docs/systems/performance.md, "The Retroid, round 4".)
  The speaker's portrait circle shows empty on the Retroid (seen in the device's Chrome: a blank
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


### Android

- [x] (2026-10-07, docs/systems/performance.md "The Retroid, round 4": the pen never stopped over 50 ms in seven
  loads, before 6b10cc0 and after; the merged towers draw as unmerged on the Adreno; portraits, the Sketchbook and
  the item pictures draw, the pictures cost one 15–29 ms frame each for 23 frames as the Items panel opens; cab
  rides at 59–60 fps, the route planned in 0.2–0.4 ms; every world again: the traveller's update 2.7–3.6 → 1.0–1.4
  ms, the camps 45 → 56 fps, Qanat 49 → 57, the City-Shaft's rim 50 → 59. Found and fixed: dynamic resolution
  held 0.75 looking down the City-Shaft, GPU-bound at 44 fps; it probes a step down now, 53.5 fps at 0.55.)
  Next time the Retroid is attached, in the GeckoView test app (never the player's app): measure the
  loading pen through a desert and a City-Shaft load (`adb shell screenrecord`, then
  `scripts/transition-perf/pen.mjs`'s `angles()`); check the City-Shaft's merged towers (`S_VMAT`, checked
  in Firefox / Chrome Metal / SwiftShader on the Mac) draw as unmerged; the speaker's portrait and the
  Sketchbook's captures; the game menu's item pictures; a self-driving cab ride; and re-measure the camps
  and the City-Shaft with the shirt on the GPU (expected ~0.3 ms instead of 2.4).


### Steam Deck (waiting on the device: it was asleep, 2026-10-07)

- [x] Decide the Retroid's `cpuBound` guard (0.85) for the Deck preset from those numbers: kept on. On the
  Deck (Gaming Mode's X11, the desert and the City-Shaft) JS 19–28 ms a frame against GPU 6–15; dynamic held
  scale 1 at the fixed run's frame rate (performance.md, "The Steam Deck").


### The Unity bridge

- [x] The Unity player at the camps and the Market's crowd: 0.7–1.5 ms a frame behind the web (2026-10-07,
  engine-bridge.md "Speed"; level at the dunes, ahead at the City-Shaft). The script's thread is the frame
  there; next: the sound's synthesis off it, the people's bone matrices. (2026-10-07: the capes' cloth in Burst
  jobs and the sound on its own thread: the camps 6.4 ms against the web's 7.3–7.5, the crowd 3.5 against 4.2,
  every view at or under the web; engine-bridge.md "The script's frame against the web's".)

### The References level

Every reference sheet is rebuilt as views (`?level=references`, `[` / `]`, L3 / R3;
docs/systems/references.md): the desert (1–27), the City-Shaft (28–50), Vael II (51–81), the Buried
Machine (82–103), the Garden of Spheres (104–125), Lorn II (126–148) and the Signal Market (149–169);
Vael has no sheets. All six of the ranked recurring shader gaps are closed (docs/systems/references.md,
"Across the worlds"): pen detail at every scale, line weight and colour per material, haze in layers,
form-following hatching, cast shadows by world, colour variation across a wall, and the scene-level
modelling world by world, and the shader limits (DONE.md). Nothing is left open here.

## Selected reference artwork and workflow (2026-10-09)

- [x] Generated revised single-view Midjourney references, imported the user's eight favourites
  (Father, Mother, Lou, Ilen, Aunt Tove, Moustache, small floating crystal currency and angular ship),
  and copied the explicitly selected sword download `0_2 (53).jpeg`. Nine original JPEGs, prompts
  where available, source links, review notes and SHA-256 hashes are recorded in
  `references/batches/2026-10-09-selected-family-currency-ship-sword.json`.
- [x] Recorded the reference workflow in AGENTS.md and CLAUDE.md: Midjourney in the visible internal
  browser, user favourites before saving. Character, currency, ship and sword generation/integration
  remain open in TODO.md; the reference selection itself is complete.

## Combat telegraphs (v1.6, 2026-10-09)

- [x] **No attack drawn on the ground; the guardians' staged fights.** Every attack of the 15 kinds, the 100 world
  enemies and the 11 guardians is told by the body (src/telegraph.js): the attack's own pose, complete at 75 % of
  the wind-up and then held still; a spark (`ChargeGlow`) gathering on the striking part and burning white; a sound
  rising over exactly the wind-up (`foeWarn(kind, dur)`, `guardianWarn`); the eyes as before. The floor shapes (`tele`,
  the world enemies' zone tells, the guardians' discs, fans and lanes) are gone; only lobbed and thrown things keep a
  landing mark (`lob`: the spitter, the golem's hurl, the world enemies' globs, the guardians' seeds, clods, cogs,
  mortars, notes, hail). Wind-up minimums by weight (`WIND_MIN`; the hound's pounce 0.6 → 0.8 s, the blot's lunge,
  the crab's snap, the splinter, the bite), Gentle's slower wind-ups for guardians too (`TELL.slow`), the off-screen
  marker kept. The world enemies got the generic path only (they are to be replaced by archetypes). Each guardian
  now has 4-6 moves of its own, combos whose last move opens it, openings when a move misses, shock rings to jump,
  three phases with a shift (it staggers; cracks or glyph veins light: `PhaseMarks`) that add moves, and closes in
  for a close move. docs/systems/foes.md ("Telegraphs: the body, not the floor", "The guardians' staged fights"),
  docs/audits/combat-v1.6.md (guardians 3.6-3.8 → 4.0-4.8), tests/telegraphs.test.js.
- [x] From the v1.4 combat review: the hound's pounce (now 0.8 s, read from its crouch) and the guardians' shared
  template.

## The kit without its hose (v1.7, 2026-10-09)

- [x] **Remove the cable from the backpack's tank to the glove** (the author, 2026-10-09). The ribbed hose
  (`Hose` in src/fluid-tool.js: a tube re-laid every frame along a curve from the flask's collar over the right
  shoulder and down the arm into the glove's cuff, and from the cap into a vehicle's engine port while the tank sat
  in a socket) is gone, with everything that built, laid, lit or anchored it: the flask's brass elbow and pipe
  (`TANK.outlet`, `tank.outlet`), `layHoseToPort`, the hose's points and uniforms, the fluid pulse that ran down it
  (`pulse`, uFluidB.z), the shader's hose branch (fluid kind 1) and the glove's `inlet` anchor
  (traveller.js `GLOVE.inlet`, humanoid.js). The glove's brass fitting stays on the cuff (`GLOVE.fitting`), capped,
  and now holds a small glass vial (`Glove_vial_r`, `glove.vial`) that fluid-tool.js lights in the fluid's tone,
  brighter as the glass fills and flashing on a shot: with the knuckles and the plate, that is what ties the glove to
  the tank. The story lines that had water "climb your hose" pour it into the tank; the item's text, the Unity port's
  bike toast and the docs say so. Tests: tests/glove.test.js (no hose, cable or tube anywhere on the traveller, no
  inlet, no outlet; the vial lit by the fluid, small, on the cuff), tests/abilities.test.js. docs/systems/traveller-kit.md
  ("No hose").
- [x] **Replace coin currency with small floating crystals** (`references/Core Objects/Currency/Small Floating
  Crystal/reference-4.jpeg`, provenance in `references/batches/2026-10-09-selected-family-currency-ship-sword.json`).
  The pickup is procedural, from the selected image: `crystalGeometry` (src/chimes.js), an uneven six-sided prism
  3.4 cm long (`CRYSTAL.one`: the prompt's three centimetres, palm-relative, not a giant crystal) with blunt chisel
  ends, flat facets in vertex colours (cyan lit toward the sun, darker away, two lavender faces for the inner seam)
  and a soft inner light (glow 0.5); a five is `clusterGeometry`, a 5 cm paler shard with two small ones at its foot.
  `ChimeView` draws them as two instanced meshes plus the glints; they hover tilted (0.42 rad), turn round the
  vertical, bob, keep a small spark (`CRYSTAL.twinkle`) and glint every 0.9-2.2 s with a 7 cm star, so a 3 cm crystal still reads at a few metres. The
  systems are unchanged (drops, magnet, wallet, prices, `res.chimes`). The name stays *chimes*: the bible's crystals
  sing (Lorn's Great Crystal, the Lodestar splinter), so splinters that ring when taken are still chimes; no save
  migration is needed. Collection rings like glass (`Sound.crystalTing`, `CRYSTAL_PARTIALS`: inharmonic struck-glass
  partials, a 0.6 % sharp twin that shimmers, a high tick, an octave above the old brass ting) in the pickup run, the
  scatter and the sale. The HUD's icon, the shop panel's prices and wallet and the game menu's wallet draw the
  crystal (`src/chime-icon.js`, copied into index.html); the shop's strings of chimes, its back-wall sign and its
  hanging sign use the shard; Haddu's lines and the People page say what chimes are. Tests: tests/chimes.test.js
  (size, facets, closed, colours, glow, the view's tilt and turn, the icon everywhere), tests/chime-sound.test.js
  (the ting rendered silently in memory). docs/systems/items.md ("Chimes, the currency").

## The selected fluid sword (v1.7, 2026-10-09)

- [x] **Generate and integrate the selected fluid sword** from
  `references/Core Objects/Reviewed Gadgets/Fluid Sword - Selected 2026-10-09/reference-3.jpeg`
  (the user's `0_2 (53).jpeg` download). Match the broad turquoise liquid blade, wrapped grip,
  brass fittings and trailing fluid details, preserving the design in hand and during combat.
  How: modelled in code (src/fluid-sword.js), no generated mesh. The hilt: a leather grip wrapped in a spiral of
  raised bands, a brass collar that swells into a bulb with two studs and opens into an oval cup with a bead of
  fluid in it, a brass pommel with a curled tail (one merged brass mesh). The blade: the sheet's outline (narrow
  at the cup, splashing out ragged to 0.111 m within a tenth of the way, a straight leading edge, the trailing edge
  curving into a long leaning point), a lens in section, drawn by a new fluid kind in src/materials.js
  (`bladeFluid`: turquoise with cream currents and deep teal pools streaming up it, a bright ridge, a pale and a
  gold rim). It grows longer and broader as it lights, and 10 % broader with each step of ink. Through each
  attack's cut window a two-strand wake of the fluid trails off the edge and drops fly (`BladeWake`, `wakeStyle`,
  `shedDrops`: wider on the charged cut, gold in the riposte, falling with the air cut, a long streak behind the
  dash cut). Same draw calls as before (13 vs 14 lit, all passes), 2.5k triangles. Checked in the studio (in hand,
  the hilt, scrubbed swings, from the side) and in the Arena (stance, the combo, charge held and let go, riposte,
  dash cut, air cut, guard) beside the sheet; before/after pictures in the v1.7 changelog.
  docs/systems/foes.md ("The look"), docs/systems/traveller-kit.md ("The fluid sword"), tests/fluid-sword.test.js.

## The family, as their selected designs (v1.7, 2026-10-09)

- [x] **Generate and integrate the family characters** from `references/levels/Home/characters/` (the author's selected
  single-view designs: Father, Mother, Lou, Ilen, Aunt Tove and Moustache; the earlier exploration sheets not used).
  One canonical look each in `src/characters/family.js` (colours sampled from the images, hair, age, build, robe,
  boots, face and mood), worn wherever they appear: home (`home-data.js` spreads `FAMILY.lou` / `.tove`), the
  Lantern and home again (`lantern-data.js` `PEOPLE.ilen`, `ILEN_HOME`), the recordings' hologram (the father and
  the mother as busts, on MakeHuman elder bodies), the homecomings (they borrow home's people), the People page
  (portraits are taken from the people in the game) and the studio's home cast (now the whole family; the Lantern
  has a cast too). `namedLook` asks `familyLook` first (reference `family/<id>`, no chance beard). The pieces are
  procedural, on the existing MakeHuman/Quaternius bodies and animation (idle, walk, talk, sit): `family-pieces.js`
  lays the father's vest, shirt, roll-neck and lapels, the mother's wound scarf and recorder, Lou's collar and
  pockets, Ilen's shirt, coral lapels and tool belt, Tove's shawl, apron bib and tunic on the body's own surface
  (rays to the trunk's triangles: the bodies have ~70 trunk vertices) with the nearest trunk vertex's weights;
  `Humanoid.robeGeometry` gained open fronts, linings and panels (the coats, Tove's apron; a plain robe is unchanged);
  `SHINS` gained boots; `look.collarUp` keeps the shoulders clothed. Moustache (`src/dog.js`) is remodelled to his
  design and walks on the locomotion kit (`PLANS.dog`: two-bone legs, front knees forward, hocks back, a trot on
  diagonals by distance walked) with sit (hind paws step in), lie, sniff and a wagging three-link tail on springs:
  foot slide 0.43 → 0.01 m/m, the knees bending 29 % of the leg (`node scripts/motion-audit/run.mjs moustache`).
  Checked side by side with the references (front, side, back, walking, talking: `changelog-media/1.7/family-ref-*`),
  in the home level, a homecoming, the Lantern, recording 3 and the mother's Ilen recording. Tests:
  `tests/family.test.js` (looks, scenes, both body families, coats and lining, the dog's gait and poses); hair, ship,
  studio and home-family tests updated to the designs. docs/systems/characters.md ("The family"),
  docs/systems/procedural-animation.md ("Moustache on the kit"). Not modelled: Ilen's grey streaks, the mother's
  slate undersleeves, the father's coat pockets; the faces are the game's procedural faces shaped toward each drawing.

- [x] Rebuilt the father in Tripo from the approved corrected T-pose, with Remove Lighting
  enabled. Preserved source/provenance, fitted the game skeleton and thirty finger joints,
  and integrated the textured model into father holographic recordings with runtime face
  motion and a procedural load-failure fallback. Reviewed unlit, with opposite lights and
  in the ship recording. This is the stationary bust asset; walking and separate cloth remain.

## The angular ship redesign (2026-10-09)

From the selected `references/The Travellers Ship/Angular Exterior - Selected/reference-4.jpeg` (TODO.md,
"Selected characters, currency, ship and sword"). How (docs/systems/ship.md):

- **A blockout first**, the traveller as the unit (2.2 m capsule, 2.35 m ceiling, 2.25 m doors, 1.6 m doorways
  for the camera): cockpit, main room (galley, living, entry), sleeping cabin, hold, engine bay; the hull drawn
  round them: 22.2 x 7.2 x 5.45 m, the deck 2.6 m up on four legs (the prompt’s 24 x 8 m was a proposal).
- **One hull, every angle**: `src/ship/hull.js` lofts seven points a side through eight stations (wedge bow and
  windshield, chin, flat main body, tapering stern) with flat side walls round their openings; cream enamel, the
  coral stripe, lavender panels, khaki lower hull, two raked pods, the port hatch with its door and stair-ramp,
  four lift jets, the light's scorch. Compared with the reference from the same three-quarter view, the side,
  the bow and the stern (docs/systems/ship-reference/).
- **The rooms** (`src/ship/interior.js`) from the Main Interior, Cockpit and Message and Living Quarters
  references; every interaction point kept (the voicemail, the projector, the holo table, the hatch, the bed's
  waking), new ones for the threshold and boarding.
- **Everywhere**: parked in every world (the site search unchanged; a test lands it in every world and checks
  the hull's volume, the feet and the ramp), the desert crash's berm hugging the new outline, the prologue,
  arrivals, takeoff, recordings and homecomings re-aimed for the new cockpit and flown nose first, the child's
  drawing and the lines that called it round, the trailer scenes, the Unity export's data (the C# port's cameras:
  TODO.md). A quarter of the round ship's triangles; a far level of detail.


## Enemy roster: the framework and batch 1 (2026-10-09, v1.8)

- [x] The archetypes and skins tables (src/enemies/archetypes.js, src/enemies/skins.js), the world table
  (src/foe-worlds.js `WORLDS`) wired into the packs, the relics' guards, the Arena's waves and FOES list and the
  gallery; old kinds stand in for the archetypes not built yet; wildlife calm until provoked.
- [x] The 100 world enemies retired (their 15 attack patterns kept as a library: `fromPattern`), the glass splinter
  retired, the spitting blot's spit on the ink blot.
- [x] Batch 1 on the locomotion kit (src/enemies/plans/): the shellback crab, the horn lizard and the antler hound
  (one quadruped rig), the lamp tripod, the ink blot; a verlet chain for tails; scored in docs/audits/combat-v1.8.md.

## Ilen's round ship stays (2026-10-09)

- Ilen's house in the Lantern stays "the top half of her own round ship" (`src/levels/lantern.js`): the author's call,
  after the family's ship became angular. Hers is her own ship, not a piece of the family's, so nothing changes;
  her line "I know that hull… paint the stripe" still reads.

## Enemy roster: batch 2 and the kit's chains (2026-10-09, v1.9)

- [x] The locomotion kit's phase 4 (src/motion-kit/chain.js `PathTrail`, `FollowChain`, `Wave`; wave-legs.js
  `WaveLegs`): bodies on their heads' own paths, follow-the-leader with angle limits, travelling waves on a phase
  accumulator, metachronal legs on distance (docs/systems/procedural-animation.md, "Phase 4, the chains").
- [x] Batch 2 (src/enemies/plans/): the mound worm (burrower.js), the sky ray (glider.js), the signal moth (flyer.js),
  the ring centipede (centipede.js: 24 legs, 0.00 m/m of slide), the lantern jelly (floater.js), in every skin; the
  five drawn to their picked sheets. Their minds: the worm's burst from under and
  its stones and dive when up, the air cut's double; the ray's skim a parry grounds and its downdraft; the moth's dust
  that slips the lock; the centipede's ring that walls you in (`Foes.corral`), plated but for its head, its shed tail;
  the jelly's wards, mends and popped lanterns, never starting a fight (docs/systems/foes.md, "The enemy roster").
- [x] Retired: the dune ray, the sign moth's old body, the winged blot (the Arena's old waves and Ink tide field the
  sky ray). Scored in docs/audits/combat-v1.9.md (4.3–4.7). docs/systems/characters.md no longer speaks of the world
  enemies as live.

## Enemy roster: batch 3 and the kit's phase 5 (2026-10-09, v1.13)

- [x] Batch 3 (src/enemies/plans/), drawn to both its sheets and painted in every skin: the bellows toad (hopper.js:
  hop by hop on planted feet), the stilt heron (stilt.js: StiltMotor's rules as the kit's `stilt` plan, an S-neck of
  segments), the skitter swarm (skitterers.js: a quick tripod at the mid tier, a flock of eight), the root knot
  (tentacled.js: five three-segment root-arms on FABRIK). Their minds (src/foes.js): spores, the choke, the leap and
  its air cut; the open bill and the topple; the flock's ring, its one-at-a-time darts, the heap and its scatter, the
  linger; the rooted knot, its ground-running grip, its blur (docs/systems/foes.md, "Batch 3's fields").
- [x] Retired: the spitting blot, the blot swarm, the root stalker (the Arena's old waves, Ink tide and the centipede's
  shed field the new kinds). The Desert, Vael and Lorn run wholly on the new roster. Scored in
  docs/audits/combat-v1.13.md (4.3–4.8, mean 4.54).
- [x] Fewer draws: a tapering tube is one merged mesh (src/enemies/plans/kit.js): the crab 145 → 65 meshes, the lizard
  185 → 90, the hound 123 → 48.

## Hearts, potions, magic and shops: batch 4, a shop in every world (2026-10-09, v1.14)

- [x] One shop in each of the eleven route worlds, built to the author's picks in `references/shops/` (src/shop-fronts.js,
  src/shop-world.js `SHOP_STYLES`, `placeShop`), placed by the way in each world (the level design audit's empty
  stretches where it had one), its keeper with a conversation, counter lines in the world's voice and a People page
  entry (src/story/shop-data.js, people-book.js). Potions everywhere; 15 heart containers and 6 magic expansions in
  all (18 hearts of 20, a bar of 9), a little more in the later worlds, priced up the one curve at 14–31 packs of
  each world's foes (docs/systems/items.md, "A shop in every world"; docs/systems/interiors.md, "A shop in every
  world"). The rooms off the map are spared by the world's edge and the Hangar's far-off rule.

## The guardians' last phases ask for their temple's idea (2026-10-09, v1.15)

- [x] The five reworked temples' guardians (docs/systems/foes.md "The guardians' last phases"; re-scored in the
  addendum to docs/audits/temple-design-v1.12.md): the Cloud-Mother (a ring as she rises to dive brings a hanging
  stone down where she dives, held while the note sounds; in her last phase the only way she lies down to cry), the
  Lampless (lured to the Lamp-Room's pools lit earlier, by a splash or the lantern; in its last phase it shies from
  you and drinks only there, while you stand back), the Mother Snapper (three crystal pendulums over her stilled in
  turn, smallest first; in her last phase the cold in her mouth no longer eases her), the First Sign (two low dishes
  on its hall's wall carry its word down a cable; in its last phase its dish turns up and it hears only through
  them), the Clockwork Foreman (open, its hands stop at four; in its last phase its six numerals take only in the
  clock's order from four). Each taught a phase earlier, where the old way still works; tests/guardian-twists.test.js.
- [x] The antler hound's smoke mane moves (its list of flames was filled inside a comment); tests/hound-mane.test.js.

## Enemy roster: batch 4, the possessed machines, and the kit's phase 5 for machines (2026-10-09, v1.16)

- [x] Batch 4 (src/enemies/plans/), drawn to both its sheets and painted in every skin: the furnace brute (brute.js, plan
  8: a slow heavy biped dipping at each footfall, a thump in the pad; its cracked hull a new surface feature, `cracks`,
  the veins opening as it is hurt), the ring drone (hover.js: plates spinning at their own speeds, a caught cloud, arms
  lagging), the crucible cart (tracked.js: src/motion-kit/machines.js TrackDrive, a turret on a spring, a smoke column),
  the bell walker (siege.js: five spider legs, the bell and its clapper on Pendulums). Their minds (src/foes.js): stout,
  the toll's three rings, the whistle that chokes it, the drop's opening and the clapper-only rule; the cart's pour that
  stays, jammed tracks, the backing ram a wall stalls, tracks driving along the heading (docs/systems/foes.md, "Batch
  4's fields"). Their moving parts skinned on the kit's own joints (kit.js skinned, skinBy): 6–16 meshes a body.
- [x] Retired: the glass golem and the slag walker (the drone's kind is the ring drone's); src/foe-kinds.js has no
  stand-in left. Viridel runs wholly on the new roster, Lorn II all but its shade. Lorn II's wood cutter placed by hand
  by the lit path (src/foe-worlds.js PLACED, Foes.updatePosts). Scored in docs/audits/combat-v1.16.md (4.7–4.8 by eye).
- [x] The skitter flock: 5 meshes a skitter (44 before), its legs and feelers one skinned mesh; a flock of eight in view
  1248 → 312 draw calls on High, its motion unchanged (combat-v1.13 rec. 2).
- [x] The combat-review script watches a group kind as its group and a support with its escort, reads the toad's choke
  and leap, the heron's open and topple, the centipede's ring as a body attack (not a lob), and batch 4's answers
  (combat-v1.9 rec. 3, combat-v1.13 rec. 3).

## Two more temples rebuilt round one idea: the Builders' Greenhouse and the Aerie (2026-10-09, v1.16)

- [x] The Builders' Greenhouse (nothing grows in the shade: louvres, sunbeams, the eye and the disc that wake only in
  the sun, the sun-ball, the seed-ball, the Gardener's footstones) and the Aerie (one wind, out wherever no stone stops
  it: the hall's stone, the Wind Well, the raft, the tailwind and the perch's column, the Elder's two vents), each
  after the author's picked hall and doorway (references/temples/), their guardians' last phases on the idea
  (docs/systems/foes.md); re-scored in docs/audits/temple-design-v1.16.md (1.89 → 3.78 each, average 2.80 → 3.14).
  Engine: drums with `stops`, `when` on latched elements, `Sunbeam`, seed-balls, `Gust` / `Updraft` `when` and a
  gust's `carry`; tests/temples.test.js and tests/guardian-twists.test.js play them, failures first.
## Enemy roster: batch 5, the late spirits and the roller, and the kit's last plans (2026-10-09, v1.18)

- [x] Batch 5 (src/enemies/plans/), drawn to both its sheets and painted in every skin: the shade reworked (humanoid.js,
  plan 9: a cloak worn by nothing on two empty boots, its cloak on lagging springs, its ribbons continuous strips on
  verlet chains, the hem's smoke white-lined), the pearl roller (roller.js, plan 16: a rippling foot by distance, the roll
  locked to the ground, a wobble on a spring), the marionette (strings.js, plan 21: a puppet hung from a knot of smoke as a
  pendulum, its four strings one mesh skinned between the knot and what they hold). Their minds (src/foes.js): the shade's
  feint and its step through its shadow to your side that an ember stops (`lights`, `dark`, `at: 'beside'`); the roller's
  roll that glances everything, bounces off one wall back at you, stalls on the next, bounces off a guard stunned, and
  its last roll's shattering ring (`rolls`, `bounces`, `onParry: 'bounce'`, `shatter`); the marionette's strings on a
  creature (a calm one too: driven, its eyes black, quicker, unstaggered by light blows), cut with the blade, the
  boomerang or an ember to free it, its yank that lifts you and its dance alone (`puppeteer`, `possess`, `alone`, `lift`);
  the calm modes `pace` and `hang` (docs/systems/foes.md, "Batch 5's fields").
- [x] No stand-in is left: every archetype is built, the shade's old body (src/shade.js ShadeBody) is retired, and every
  world runs wholly on the new roster (tests/archetypes-batch5.test.js). The Garden of Spheres' glass puppet placed by the
  white archway in the android wood (src/foe-worlds.js PLACED). The Arena's waves add the roller, the marionette with
  creatures to drive, the shade with a roller. Scored in docs/audits/combat-v1.18.md (4.3–4.8 by eye, mean 4.50); the
  shade answers combat-v1.4's "one cut, only the blade" (3.0 → 4.3).

## Two more temples rebuilt round one idea: the Warden's Well and the Engine-House (2026-10-09, v1.19)

- [x] The Warden's Well (the tower breathes through its vanes: the discs and the slot on splashed vanes, the great vanes
  turned by the jets' wash, the lidded eyes, the two irises, the ball pushed over a gap from the air, two vanes at once
  in the crown, the warden's hatch opened by a vane's draught) and the Engine-House (a ball in the teeth stops the
  engine there: the pistons' crank unjammed, the hammer jammed, the piston-eyes held up, one crank and then two, the
  Tooth-Warden's gear), each after the author's picked hall and doorway (references/temples/), their guardians' last
  phases on the idea (docs/systems/foes.md); re-scored in docs/audits/temple-design-v1.19.md (2.00 → 3.89, 2.11 →
  4.00, average 3.14 → 3.49). Engine: a held `vane` element, `Vane`, `Iris`, a `Switch`'s lids, a `Ball` gap's lip,
  `Hammer`, a `Bank`'s piston eyes on a stroke; the shaft's breath fixed (it let riders sink off its crest);
  tests/temples.test.js and tests/guardian-twists.test.js play them, failures first.

## The visual probes' findings (docs/audits/visual-v1.4.md; 2026-10-10, v1.21)

- [x] A dark copy of the traveller on the wall behind him in room corners (Handheld): the look past a person (twice as
  far) reached the corner's other wall, in front of the point; leaving the tap out was no better (1 of 4 taps closing,
  under the 0.3 threshold, became 1 of 3). Now every spot tap is read first and a tap on a person stands for what the
  person hides: the planes of what is seen two and four times as far out and of the other taps, met along its own ray,
  the nearest between the person and the point's own surface (post.js `spotLoop`, `planeAlong`, `spotBehind`; the
  Unity composite too). The probes' corner 6442 px → 0; twins of a corner and a stair with a person in front in
  tests/occlusion-taps.test.js (docs/systems/rendering.md, "The visual probes' findings fixed").
- [x] A hairline of sky at the Givers' Hearth's floor edge (44-73 px, debug 5): not the door cut. `rough` pushes the
  dome's foot ring out as well as down (17.4-19.8 m) and the floor ended at 18 m: a gap all round between its edge and
  the wall. The floor now runs 3.5 m past the hall under the whole foot (src/desert-hearth.js `HEARTH.floorOut`,
  `hallDome`); the giant's heart had the same gap in four places, its floor now runs to ROOM + 4. The seams probe:
  no sky-white line left; tests/cave-seams.test.js.
- [x] Hovering makers' drones in the temple halls drew a jagged spot-black halo on the wall behind them: foes are now
  movers (gHatch.a + 64, materials.js `MOVER`: the 'foe-' and 'arch.' material keys), seen past by the spot taps and
  the crease shading as people are, their own pockets kept (post.js `notStanding`). The incal hall's machine: no halo.
- [x] Small square steps in the spot mass at the temple halls' pillar feet (Edena, High): checked with an orbit swing
  (±32°, every frame saved) on the rebuilt Greenhouse hall: the masks hold still (p95 step 0 at its four spots); the
  notches are copies of the leaves and corners in front, fixed to the surface. Nothing to fix.
- [x] A spot-black blob in the traveller's own cast shadow on the sand by the ship: his gear (the shield bracer, the
  sword and its frog, the tank's jets) was built after he was tagged hero, so the taps took the shield by his hand
  for something over the sand. materials.js `keepHero` tags what is added under him later (not his fluid, inked as
  print); main.js uses it. Left: a clean stripe where the dune's foot creases, as in any shade. tests/scout.test.js.
- [x] The probes (.claude/skills/visual-audit/probes.mjs, scripts/visual-probes/lib.mjs): the orbit's swing narrows
  (×0.75, 0.5, 0.25: `orbitScale`) until the eye, pulled in front of a wall, keeps 85 % of its distance at every step;
  the ghost check's noise from three takes with nobody moving (`noiseAcross`), its silhouette from the normals too
  (a cream robe on a pale wall); foot rays at 0.3 m too (`floorSlits`: furniture on legs is no slit); `--people
  marrow` puts a story person where the traveller stood; known spots for his shadow by the ship; `--save-all`. The
  side worlds were run at Handheld (docs/audits/visual-v1.21.md). tests/visual-probes.test.js.
- [x] world.js `jitter`'s `vertical` noise lifted a foot ring as well as lowered it: y = 0 now only goes down, as
  `rough` does; tests/shell-seams.test.js runs it with its vertical noise (the guard against any world using it is gone).

## Enemy roster: batch 6, balance and sound (2026-10-10, v1.22)

- [x] Batch 6 (docs/design/enemy-roster.md step 8): a hurt and a burst per archetype in its sound family
  (src/foe-voices.js, src/audio.js foeHurt / foeBurst; tests/foe-voices.test.js renders them in memory), combat-v1.4
  rec. 2 and combat-v1.18 rec. 2 (the roller's rolling rumble and glassy shatter, the marionette's paper and strings).
- [x] The route's curve rises to the Signal Market (combat-v1.4 rec. 3): the places by stage (1–2, 2–3, 3–5, 4–5, the
  Market alone 5–6), Viridel's, the Hangar's and the Garden's own, groups with fillers from the third stage, the late
  worlds weighted to their late kinds, three strikers at once, quicker turns and heavier blows in the last three
  (src/foes.js `TURNS.late`, `HARM_BY_STAGE`); measured world by world with the combat-review script's new `--packs` (docs/audits/combat-v1.22.md).
- [x] The moves' niches (combat-v1.4 rec. 1): the combo's third swing 3, the air cut double on a hovering foe, the full
  charge 0.85 s; the charged cut was the fastest kill for 19 of 22 kinds, now 4 (the air cut 11, the combo 4, the shot
  2, the riposte 1).
- [x] A shot that does nothing says so (combat-v1.4 rec. 4): a glance, a spark and a tick, no flinch.
- [x] The damage table re-checked against every attack (combat-v1.6 rec. 2): the drone's ram is a dive (¾), the shade's
  cut its sword (¾, a 0.95 s wind-up); the crucible cart's slag tuned (combat-v1.16 rec. 2: 7.1 → 4.4–5.2 bars a minute
  on a still traveller).

## The last two temples, the visual probes' temple findings, the dives that miss (2026-10-10, v1.24)

- [x] The Givers' House and the Footprint reworked round one idea each (docs/audits/temple-design-v1.24.md: 2.11 →
  4.22, 2.22 → 4.33; the eleven's average 3.49 → 3.87), their guardians' last phases on it; the four rules checked
  across the eleven (TODO.md "Temple design (audit)" keeps what is left). tests/temples.test.js,
  tests/guardian-twists.test.js, tests/temple-design.test.js.
- [x] A miss-opening for the Lampless, the Elder and the Cloud-Mother: a dive that misses wedges them, open longer than
  after one that lands (5.4 s; her hang aloft + `ROOST.miss`; 4.4 s, her last phase still only on a held stone), told by
  a `missHint`; the Lampless's dust a shock ring you jump (combat-v1.6). tests/telegraphs.test.js.
- [x] The Lorn temple's crystal pendulums drew a jagged spot-black halo on the wall behind them (visual-v1.21, finding 1):
  `Swing` makes its crystal and its arm with `{ mover: true }`.
- [x] Dark triangles of the Givers' Hearth's dome hung across the passage's mouth (visual-v1.21, finding 2): `cut()`
  splits a triangle that straddles the opening down to 0.3 m and drops only the small ones inside
  (src/desert-hearth.js). tests/cave-seams.test.js (nothing inside the mouth, the rest of the dome whole).
- [x] The Signal Market's shop "lit white inside" (visual-v1.21, finding 6) was the probe's: a foe in the Undertower
  knocked the traveller out mid-run, a traveller down stays where he fell whatever teleports him, and the shop's light
  term was read with him (and the shadow maps) 3 km below. The probes now run with enemies off, get him up before each
  move and skip a probe where he doesn't stand (.claude/skills/visual-audit/probes.mjs `standsAt`); the shop itself was
  shaded like the others all along.
- [x] The traveller's face redrawn the Moebius way (v1.25; TODO: "redo the character's face to match the references
  more closely and feel less cartoony / anime, the eyes in particular"). The generated head's painted face was a 3D
  render's: wide almond eyes open round a whole iris with a bright white, a catchlight and a lash line all round; a
  rosy rounded nose tip with no line; pink painted lips; airbrushed skin. `src/characters/head-ink.js` covers the
  painted eyes, evens the skin to one hue and draws the sheets' face in the head's rest coordinates: narrower eyes
  (0.93 the width, 0.69 the height) whose heavy upper lid cuts a flat dark iris, a lid crease, a light lower lid, no
  shine; one nose line on the side turned from the camera into a hook round each wing; a mouth line and a lower-lip
  stroke. The blink is drawn (one arc), raised brows open the eyes wide, the gaze moves only the iris
  (docs/systems/faces.md, "His face redrawn the Moebius way"). tests/head-ink.test.js, tests/traveller-v1.test.js.

## Enemy roster: the art against the sheets (2026-10-10, v1.26)

- [x] The roster's contact sheet rebuilt from the 21 picked sheets (`node scripts/enemy-roster/sheet.cjs`: sheet-1 over
  sheet-2, each sheet's own black silhouette found as its largest patch of plain black, or archetypes.json's `sil` crop).
- [x] The biggest gaps against the sheets (docs/design/enemy-roster.md "Status"; the `enemy-rework` skill): the antler
  hound's lofted lean body (a deep chest, a narrow waist, muscled thighs, a longer neck and muzzle, a wider crown); the
  shade's cloak a long drape in folds; the lantern jelly's tall dome, the cloud jelly's in lobes; the crucible cart's
  draped canvas, toothed sprockets and winding smoke; the bell walker's yoke a flat riveted band; the brute's plated
  fingers and its fists meeting for the slam; the marionette's knot pouring down in a funnel; and painted: the anchor
  crab's barnacles in crusts, the blot's streaked shine, the centipede's rivets, the cistern jug's ochre marks (three new
  options of the foe surface: clustered spots, a streaked gloss, rivets; src/foe-surface.js).
  Cost (`node scripts/enemy-roster/bench.mjs`, a pack of the eleven changed held in view, Mac M4 Pro headless, two
  alternating runs each, before = the main branch): draw calls 1691 → 1671 on High and 1636 → 1614 on the Deck preset
  (the jelly's eight puffs gone, the cart's teeth one more), triangles +2.3 % (604k → 618k), CPU 5.6–6.7 → 5.8–6.0 ms on
  High and 5.4–5.6 → 5.6 ms on the Deck preset, GPU within the run-to-run spread (4.4–7.6 → 4.4–8.4 ms High, 2.0–4.0 →
  2.0–3.1 ms Deck).
- [x] The Desert's cistern pump placed (src/foe-worlds.js `PLACED`): a lamp tripod on the mineral basin's far shore.
- [x] A blade swing across a lantern jelly's thread of light breaks its ward (combat-v1.9 rec. 2): a target half-way
  from its lantern to the foe it guards (src/foes.js `support`, `cutWard`), the jelly keeping its lantern.
- [x] The combat-review script: a clapper-only foe's time to kill through its openings (combat-v1.16 rec. 4; the bell
  walker's combo ∞ → about 13 s), and each kind framed side-on for the contact sheet.
