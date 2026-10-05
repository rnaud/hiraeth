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

- [ ] Gather suitable, licensed motion data: starts, stops, turns, pivots,
  sidesteps, landings, and interactions, in addition to locomotion loops.
- [ ] Improve the traveller's transitions, foot contact, turning, and responsive
  body/head movement. Keep optional stop-motion styling disabled when evaluating
  smoothness.
- [ ] Prototype a walk → run → sharp turn → stop sequence. Verify stable planted
  feet, no abrupt pose changes, and responsive control.
- [ ] Add motion matching for locomotion, with procedural terrain corrections.
- [ ] Extend the system to nearby NPCs, varying gait, timing, posture, and
  gestures to avoid identical-looking motion.
- [ ] Scale animation work by distance: detailed motion selection and contact
  solving nearby; shared or baked animation with interpolated playback for
  distant crowds.
- [ ] Measure frame times, animation CPU cost, loading time, and memory on
  desktop and physical mobile devices with representative crowd sizes.
- [ ] Evaluate ML only if it offers a measured advantage over the conventional
  system. Account for training data, offline tooling, model delivery, and
  browser runtime compatibility.

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
- [ ] Then the Moebius-style face shader. Redo the face shaders to look more like Moebius; add a level with very
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

- [ ] Simpler far versions of people's bodies (about 12.5k triangles each, often 5–10 in view): the
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

- [ ] Each world has a massive Makers' building that works as a temple (as in Zelda).
  - Half the gadgets are found in the world and half in temples. A temple's gadget is the key
    to finishing that temple.
  - A boss at the end, with a non-lethal way to deal with it if it's organic (destroying it is
    fine if it's a robot).
  - Beating it changes something in the world: the temple covered in plants, crops growing
    again, the grove pulsing with light…

---

# Unity port (proof of concept, 2026-10-05)

The desert runs in `unity/Memento` (Unity 6, URP): exported from the web game by
`scripts/unity-export/`, the ink look ported, the opening quest playable. See `unity/README.md`.

- [x] Export, the ink look, the traveller's controller and camera, climbing, people, dialogue, quests,
  the father's charge, the chest, the bike, the burning tree, health and falls, title screen.
- [ ] The traveller's run, jump and climb clips; the helmet, face, creases and tank.
- [ ] People's costumes, capes, hair and faces; seated people; an instanced far crowd.
- [ ] The fluid tool's other modes; the box opening scene; the star box.
- [ ] The ship (prologue, interior, map), wildlife, footprints, smoke, embers, weather, sound, saves.
- [ ] FXAA, the game's own shadows; the cave's lighting.
- [ ] Connect an MCP client to the editor (the bridge package is installed; an organization policy
  blocks registering unknown MCP servers in Claude Code).
