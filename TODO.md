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

- [ ] Prologue camera clips into everything at the start and glitches while
  moving around.
- [ ] Crash landing on the first planet: the planet's shader keeps sliding
  around during the crash.
- [ ] Achievement overlay stays up during a conversation: pressing A advances
  the dialogue (seen with Nima) but never dismisses the overlay.
- [ ] Jetpack in the tube/cylinder level: got stuck against the ground and
  could not get out.
- [ ] The bell rope goes through the building when I ring it.
- [ ] Edena: the door to the crashed ship sits a few metres away instead of
  being part of the ship; it rains inside the ship. It must never rain indoors.
- [ ] Perdide: looking inside the tooth flowers you can see through them (no
  inside faces / texture).
- [ ] The drone on my back clips into the backpack.
- [ ] Clipping pass: check that most things don't sink into surfaces.
- [ ] Building textures and windows flicker when the camera moves.
- [ ] I can't always look all the way up at the sky: the camera stops short.
- [ ] Shed / feather site: looking at the stone hand does nothing; unclear
  what to do there.

## Controls (Retroid Pocket layout)

- [ ] Map the buttons by position on the Retroid Pocket (B is the bottom
  button): B jump, A interact, L2 aim, R2 shoot, Select gear menu (everything
  I carry), Start options menu, Y call my mount, X ping.
- [ ] Action and call-out/ping must be different buttons.
- [ ] Mounts and taxis: R2 moves forward, the stick tilts up/down/left/right.
- [ ] Hover car: deadzone on steering when driving forward; it turns too
  easily now.

## HUD, menus and prompts

- [ ] Too much on screen: remove all the button reminders.
- [ ] With a controller (e.g. Retroid Pocket), show no on-screen buttons.
- [ ] Button prompts use a small rounded icon, not a square.
- [ ] The speaker's name sits at the top when talking to someone.
- [ ] In conversations, remove "translated · XXX" (it's obvious) and remove the
  double controller hint; no hint at all there.
- [ ] Portraits in conversations: just the person against a coloured
  background, not the environment.
- [ ] Special places, hints and objectives are coloured in dialogue more often.
- [ ] Clearer in the menu when a quest is complete.
- [ ] Level screenshots (level select) should be smaller.
- [ ] Don't show the "updated" screen on every level.
- [ ] Select and Start screens pause the game, full screen, with their own
  menu music.
- [ ] Health bar and fall damage.

## Galactic map and travel

- [ ] Confirm before travelling to another planet.
- [ ] Simplify the map: don't show what the worlds look like.
- [ ] The description text overlaps the place names; fix the layout.
- [ ] Only the next world is known; worlds unlock as you go (maybe two at first
  so there's a choice).
- [ ] Remove the teleport doors to other levels now that we have the ship.
- [ ] The cutscene between levels shows the approach to the planet from space.
- [ ] The landing cutscene has no sound at all; add it.
- [ ] Ship take-off and landing: the smoke comes from the wrong places.
- [ ] The door opening outside the spaceship animates oddly; fix it.

## Camera

- [ ] When the camera pans out for a dialogue, make sure nothing is in the way.
- [ ] If the character looks at something, the camera goes behind them looking
  at it.

## Drone

- [ ] The drone points where we're going, up and down as well, with a trail so
  it's easier not to lose it.
- [ ] It matches my speed walking, driving and flying: it heads towards the goal
  but stays around me.

## Characters

- [ ] Rebuild the traveller on the same skeleton as the other characters so
  animations don't break; put the outfit on top.
- [ ] People of different heights, body types and genders.
- [ ] Redo the face shaders to look more like Moebius; add a level with very
  large faces to test and refine them.
- [ ] Ragdoll when falling, or when pushing people with the gun.
- [ ] Hologram of the parents: a true hologram, not a 2D drawn render.
- [ ] Most animals are too small and hard to notice: make them bigger.

## Gift boxes

- [ ] Much bigger boxes.
- [ ] They levitate before opening, dissolve into nothing with a shader, and the
  item levitates in the centre.
- [ ] Hidden at interesting, hard-to-reach places (except on level 1). On level
  2 one is just outside the ship.

## World, levels and materials

- [ ] The burning tree is one large flame, drawn with a flame shader rather than
  3D geometry.
- [ ] Dry sand looks low resolution and pops in while moving and driving;
  redo the shader with a different look by distance.
- [ ] Cracked ground looks fuzzy in the distance and pops in while walking;
  make it a shader.
- [ ] A test level for materials: metal, rock, clouds, etc.
- [ ] No hover bike until I first find it; add a mission to find it.
- [ ] Redesign the taxis and the hover car.
- [ ] More flowers and plants, some large; each planet has its own flora (no
  reuse), and plants grow in clusters instead of being scattered (as in Edena).
- [ ] Level 2: the area of the man by the trees is crowded and hard to see; the
  trees are too low.
- [ ] The great wheel: when it turns, it clears the sand around it, then keeps
  turning.
- [ ] Airtight level: walking into the portals animates off and feels jarring.
- [ ] Garden of spheres: if the spheres play music, make them play, and trigger
  them by shooting at them rather than looking.
- [ ] Rename the Incal: nothing in the game named after Moebius works.
- [ ] The recharge wait once on the ground is 2 seconds.

## Audio

- [ ] The man who says he plays music should actually play an eerie tune.

## Quests and story

- [ ] Fewer pure fetch quests: add more to each, like pushing something with the
  gun or lighting something, with a small puzzle.
- [ ] Story: the hero listens to recordings of their parents made before they
  died, and the parents weren't happy with them. The recordings don't always
  fit or react to what you do; the hero believes they relate to each planet.
  Over the game it becomes clear they're old, and that the hero is trying to make
  them proud after their death. Final scene: bring back all the collected items,
  tokens of having grown up, and place them on their tomb.
- [ ] The hero always faces the recording when one starts.

## Performance

- [ ] Performance pass on the Retroid Pocket, with it connected for testing.
