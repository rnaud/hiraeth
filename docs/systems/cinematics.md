# Cutscenes and moments

The ship's cutscenes and the filmed first times.

## The ship's cutscenes and the burning tree
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
  bands, dunes, craters, continents, windows, a ring or a moon, a rim of air), the ship levels
  out and brakes into the air with a few pale wisps, passes the clouds in a soft white fade and
  comes down upright on its jets: a landing, not a crash (only the prologue crashes;
  docs/systems/ship-consoles.md). Hold to skip, as ever.
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

## Moments: first times, filmed (`src/story/moment.js`)
A moment is a short cinematic (6–12 s) for a first time that deserves one, composed like a comic
page: a few panels, the letterbox, a line or two, the traveller's face and hands in the line's
tone, a swell of the world's score, then back to you.
- **The helper.** `MomentStage` (one per world, `storyRt.moments`, handed to each world's setup
  as `ctx.moments`) plays one `Moment` at a time on the ship's cinematic camera and its Cinema
  (the same `ship.shot` / `ship.release` the box scene uses, the letterbox, the subtitles).
  `moments.play({ id, flag, shots, beats, onStart, onFrame, onEnd })` returns the moment, or
  null when it can't play (no ship's camera, a scene, a conversation or a story page up, the
  traveller riding or down, its flag already set): the caller then does what it always did.
  A shot is `{ dur, from, to?, ease?, clear? }`; `from` / `to` are frames `{ pos, look, fov }`,
  Vector3s or functions of the shot's time (to follow a stream's head, a face); no `to` holds.
  `shotAt(shots, t)` is pure (tested). Beats `{ t, line?, secs?, run? }` say a line (`spoken()`,
  with its tone: the traveller's face and hands take it) or run a cue. `m.face` / `m.eyes` turn
  him and his eyes; `m.look` holds a look on his face **quietly** (src/talk-face.js `look`: the
  expression only, the mouth shut, the hands still; `'smirk'` is a look of its own,
  `TONE_EXPRESSIONS.smirk`, not a dialogue tone); `faceOf(humanoid)` gives where his face
  is and looks as posed, for close-ups that never catch an ear. While one plays the idle's
  look-around waits, the game's toasts wait (`cinema.held`), input is cut (`storyRt.busy()`).
- **Once, skippable, never in the way.** Its flag is set as it starts. B / ○, the Menu button,
  Esc or a tap on the corner tag skips it, after a 0.6 s grace (the press that started it,
  mashed, doesn't end it) and on the next frame (the key opens nothing else). An error in a
  frame ends it at once; `onEnd(m, skipped)` always runs, and the state a moment shows is
  applied by its caller for sure there (and on its beats), so a skip or a failure lands the
  same as watching it. Nothing is compiled mid-shot: a moment only moves the camera and what
  already exists (measured: `renderer.info.programs` unchanged through both, High and Handheld).
- **Sound**: `sound.swell(kind, pos)` plays a phrase of the world's score over a growing pad
  while the score and the bands step back: `'motif'` the world's leitmotif on its lead,
  `'father'` the father's theme in the world's mode on its voice for it.
- **The desert's two** (`src/story/desert-moments.js`):
  - *the water's first run* (`desert.moment.flow`), when the rib comes off the channel: A, high
    beyond the gutter, the rib rolling clear past the post and the traveller; B, a long lens up
    the gutter from past its end, the crack lighting and the water coming down it (the flow
    waits for this panel, `st.flowDelay`); C, high over the gutter's end across the basin, the
    pool spreading over the dry bed round the roots, its light coming up; D, his face,
    three-quarter, lit from below: he watches, and the corner of his mouth goes up. The world's
    motif swells over it; its toast comes after. (The gutter is lit along its whole length by
    four lights, `desert-city.js` `chLights`: with one, by the rib, its unlit half read in the
    hatching as full of rubble, even with the water running down it.)
  - *the empty tank's first fill* (`desert.moment.fill`), the first wade with the dry tank: A,
    over the water at him standing in the pool; B, over his shoulder on the glass as the water
    climbs into it slowly in three colours (`tool.fillTo` holds the glass's level), its glow on
    his back; C, beside him: he lifts the glove, its knuckles light one by one, and a first glob
    (`tool.spark(dir)`, spending nothing) splashes out across the pool; D, his face: a slight
    smirk. To the father's theme. The jar fills and the controls are said (RT / R2, RB / R1) at
    its end.
  - **Show, don't tell** (players: "the character feels corny"): the traveller says nothing in
    them and reacts with his face only, a slight smirk at most; no surprised or happy faces, no
    gestures. `tests/moment.test.js` holds them to it (no line in his voice, no big look).
  - Tests: `tests/moment.test.js` (the shots, a play through, the skip and its grace, a failure,
    the stage's refusals, and both desert moments in the story: once, skipped, without a ship).

## In-engine trailer

`trailer.html` plays a 48-second trailer across the desert, City-Shaft, Vael II, Buried Machine,
Deep Wood and Garden of Spheres, using the shared ink, bloom and FXAA pipeline. Twelve shots
are authored in `src/trailer/timeline.js`; `frameAt(seconds)` supports review seeks.

`src/trailer/reference-scenes.js` reuses the reference level’s builders, ground, palette and
sun orientation: the desert sheet’s empty dunes for the opening, IMG_3779’s shaft to the water,
IMG_3797’s glowing stream, and IMG_3793’s lake arch and pyramid grove. The opening adds the
actual ship model on the horizon. Reference people are omitted; the shaft’s baked cabs are
omitted with `omitCabs` and replaced by eight moving taxis with varied colours, scales and
routes at different depths. Nine cameras stay fixed, with three moving views for contrast.

The traveller uses `loadTravellerV1` / `createTravellerV1`, matching the current game’s coral
overshirt, body, hands and cloth. `src/trailer/actors.js` stages the actual bike and bird seat
transforms and the driving/climbing clips. The opening walks toward the ship; other character action is riding or climbing.
The climb uses the game’s raycast wall contacts and hand/foot IK. Hover trails use the actual
Trail geometry, reconstructed from the authored path for seeks. Both bird views add seeded
flocks. Taxi envelopes are collision-tested along their routes; the final three shots change worlds. Cloth resets on a seek or replay. No quests or saves are loaded.
The camera respects each scene’s atmosphere and lighting; `src/trailer/world.js` passes it
into world updates and sets the tree’s fire clock explicitly so the flame remains animated.

Play starts a short arrangement of the father's theme on the game's synthesised instruments, with a scheduled engine pass, wing beats and climbing contacts sharing the same audio clock.
Export renders the 2560 × 1440 canvas (3840 × 2160 internally, FXAA then downsampled)
frame by frame at exactly 30 fps using WebCodecs, then combines VP9 frames and offline-rendered
Opus audio in WebM. GPU speed changes the export time, never the film speed or frame count.
Older browsers without WebCodecs fall back to real-time MediaRecorder (WebM or MP4). The video contains the game footage and soundtrack, with letterboxing and fades; no titles, captions or shot counters.
Sound on/off controls monitoring;
the exported soundtrack is always included. Hiding the tab pauses live playback and MediaRecorder capture.
Open `/trailer.html` on the dev server or built site. `window.trailer.draw(seconds)` is exposed
for visual review; it does not advance playback.
