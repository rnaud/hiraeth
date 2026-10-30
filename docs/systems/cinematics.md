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
- **Engines** (`src/ship/exhaust.js`): flame out of the four bells under the hull
  (`THRUSTERS`) and, where the jets meet the ground, dust in the ground's own colours blown
  flat out from under the ship, stronger the lower it is (`blast`); a puff under each foot
  on touchdown and lift-off. `Ship.floorAt` finds the ground from under the hull (from above,
  the parked ship's own collider is in the way). The flame has its own pool (`Ship.jets`, no
  drag) and goes where the ship goes (`carryJets`: the live tongues move with the model each
  frame), so only its jet speed takes it away from the bells (v1.45, issue #89: the landing
  comes down at up to 220 m/s, and faster at the start of its last stretch than at the end of
  the fall before it, so the flame left in the air stood up through the hull). The desert's
  forced landing fires its reserve jets the same way, a swell's reach under the belly.
  `tests/cutscenes.test.js` flies the landing's curve and checks no tongue rises over the bells.
- **The hatch** (`setDoor`, `setRamp`): the door pops out of its frame, then slides up the
  hull on its track (a turn about the ship's axis, so it never passes through it); the ramp
  is nested sections that slide out of the doorway, tip down on the hinge, then telescope to
  the ground one after another (`rampPhases`, `poseRamp`). Each phase eases.
- **The approach from space** (`ArrivalDirector`, `src/ship/approach.js`): an arrival opens
  with ~7 s (`APPROACH`) out in space: the destination planet grows ahead in the galactic
  map's colours and mark (a shader writing the G-buffer: flat body, a hatched crescent,
  bands, dunes, craters, continents, windows, a ring or a moon, a rim of air), the ship levels
  out and brakes into the air with a few pale wisps, passes the clouds in a soft white fade, flies in nose first, hovers
  over its spot and comes straight down on its jets: a landing, not a crash (the prologue's is a forced landing on its
  belly; docs/systems/ship-consoles.md). Hold to skip, as ever.
- **Take-off and landing as a lander flies them** (v1.75, issue #354: "When the ship flies away it should go up with
  boosters then forward. The reverse for landing. Arrive then land vertically for the final part"; `src/ship/flight.js`,
  pure numbers). **The take-off** (`TAKEOFF`, `takeoffPose`): straight up off its feet on the belly's jets to a hover
  22 m up in 2 s (15 until the ship grew to twice its size, issue #338), eased in and out, the dust blown out under it; then the nose dips (0.14 rad) as the jets tip it forward
  and it powers away along its bow, 340 m by the end of its 5.2 s, climbing 80 m, the nose coming up to 0.12 rad; the
  warp opens at 4.4 s, well away (~180 m). Filmed low, 40 m out from the hatch and 26 m behind the stern, so the lift
  reads side on and the going away crosses the frame (it used to climb straight up, faster and faster, from in front).
  **The landing** (`LANDING`, `landingPose`): in nose first along its bow from 300 m back and 175 m up, slowing all
  the way with its nose flared up (0.12 rad at most), to a hover 32 m over its spot in 3.6 s; it hangs there 0.35 s;
  then straight down in 2.6 s (smootherstep: onto its feet under 1 m/s, touchdown called 0.1 s before the end). The
  short arrival flies the glide out of the clouds seen from the side (`APPROACH.sky`, 135 m out from the hatch side,
  80 m up) and the rest in the low shot by the ramp, now aimed half way down to its spot (`LAND_LOOK`) so the ground it
  comes down to stays in the frame. The first arrival's wide flies the glide in its establishing shot (`wideFlight`:
  from 150 m up, from as far back as `wideBack` finds keeps it in the frame for the last 60 % and in front of the lens
  all the way, 240 m in every world now) and the hover and drop (2.8 s) in the low shot. #299's touchdown dust is
  unchanged. **Unity**: the export writes `ship.flight` (the two tables) and `ShipTravel.cs` evaluates the same
  curves (`TakeoffPose`, `LandingPose`, its fallbacks the same numbers: tests/unity-ship-points.test.js); its first
  arrival's wide is still not wired. Tests: `tests/cutscenes.test.js` (up first with no step forward, then away along
  the bow; in, a hover, straight down, no speed at touchdown; the director's take-off; the flame under the bells on the
  new curve), `tests/arrival-view.test.js` (every world's wide glides in from 150 m back or more).
- **Berths: the lock and the cradle** (v1.84, issue #451; `src/levels/port-berth.js`, pure numbers). In a port with a
  `berth` (docs/systems/worlds.md, "Space ports") the landing sets the ship down on the berth out and a step of its own,
  after the landing and before the ramp, brings it to its rest; leaving, a step after the seal carries it out and the
  lift-off starts from there. The Underwater City's lock lowers it 12 m down its columns in 3.6 s (raises it in 2.8);
  the City-Shaft's cradle, swung out 0.72 rad on 13 m arms, swings it in, past its rest by a quarter of the swing and
  back, in 3.8 s (out in 2.6). Each eased to a standstill at both ends; filmed from the port's own lens (`shot`, in the
  hull's frame). The ship's rest, its ramp and the walk out are as before; a world without a berth plays the same steps
  as before (the sequences' indices hold). Tests: `tests/port-berth.test.js`. (Since issue #572 the Underwater City's
  lock stands on its sea port's deck over the water, not on the Dock's dome under it.)
- **Over a sea** (issue #572). The scenes' lenses that stand on the ground (the landing's low shot, its dust, the hatch,
  the step out, the take-off's) stand on the sea's surface where the world lies under one (`Ship.viewGround`): off the
  Underwater City's sea port the ground is the sea floor 80 m down, and they filmed the landing and the take-off from
  under the water, looking up the lift's shaft. The first arrival's views were picked again over the sea
  (`scripts/arrival-views.mjs`, its ground the same; the landmark the lift's house on the deck: the sea hides the city).
  The sequence `sea-port` (engine/sequences.js) plays the landing, the lock, the ramp and the ride down on every side.
- **The first arrival in each world** (issue #327: "the landing view and the first exit out of the ship should show a
  beautiful view of the landscape with points of interest visible"; `src/ship/arrival-view.js`). Two views per route
  world, picked from its own data and kept in `src/ship/arrival-views.js`:
  - **The establishing descent.** The first time the ship comes down in a world, the short drop out of the clouds
    (`APPROACH.sky`) gives way to a wide shot of 6.4 s (`WIDE`): big sky, the world's landmarks laid out in depth, and
    the ship gliding in nose first along its bow into the frame, from 150 m up to a hover 30 m over its rest (since
    v1.75, issue #354; before, a fall from 260 m drifting 70 m forward), the camera drifting a little. The landing's own
    low shot then brings it straight down those last 30 m in 2.8 s and settles it on its feet.
  - **The first step out.** He walks two steps out and turns toward the world's best view (`exitStops`), and the camera
    drifts for 3.6 s (`REVEAL`) from a little round, higher and further out into the rig's own framing behind him, a
    little high (`Ship.revealView`). Control is his all the while: a move, a new button or a turn of the camera cuts it
    short and eases back to the rig in half a second (the skip still held from the arrival does not).
  - **Once per world per save**: the flags `arrival.wide.<world>` (set as the arrival starts, skipped or not) and
    `arrival.view.<world>`. Later arrivals are the short one, as before. The desert's first step out is the prologue's
    (its `stepout` and `objective` stages, and its skip); a later arrival there by ship has the establishing descent once.
  - **The landmarks** (`MARKS`, by world, from the level's data: its beacons, its temple's door and house, the town's
    tree, the sundial's needles or the forest's pillars as one; `main` ones must be in both views): each aimed at down
    its height (`AIM_AT`), seen when a point of it is in the frame with a clear line to it, and, in the step out, not
    behind the traveller himself (`behindFigure`).
  - **Picked in the game** by `node scripts/arrival-views.mjs` (headless, muted Chrome on port 6327 by default, never
    5173): the ship stands where the game puts it, and the sightlines (`losOf`, `clutter`) are cast against everything
    the game draws (`sightPhysics`: every opaque mesh, the big instanced things, less glass, water and the sky), the
    terrain too. The wide is scored by the landmarks it shows (the main ones a must, kept off the edges for the drift),
    the ship in the lower two thirds as it comes down, nothing standing in front of it (`blocked`), no wall of trunks or
    towers just past it (`mass`), the share of open sky and the frame's balance; the exit by its landmarks, nothing within
    30 m filling the frame and the rig's slight high angle (`EXIT_PITCHES`: lower only where the main landmark stands high
    overhead, the Lodestar, the canyon stack). Per-world camera ranges where the default reads badly (`VIEW_OPTS`: nearer
    and lower in the Underwater City's sea and the Moon Foundry's haze, over the roofs in the Signal Market). Run it again
    when a world's landing or landmarks move: a ship that no longer stands where its views were picked arrives the short
    way (`arrivalViews`), and `tests/arrival-view.test.js` fails first.
  - **The Unity bridge**: `scripts/unity-export/export-world.mjs` writes the views with the ship's points
    (`ship.arrival`: the wide's lens and drift, the exit's heading, pitch and swing, mirrored to Unity's frame, the
    timings and the flags), so `ShipTravel.cs` can play the same first arrival (not yet wired there).
  - `tests/arrival-view.test.js` builds every route world and projects its landmarks into both views (the wide at the
    start and the end of its drift, the ship in its frame; the step out with the real `CameraRig` settled there), and
    plays the arrival twice in a save (the first long, the second short; a new save long again), the skip, and the
    drift cut short by the stick and by turning the camera.
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

## The prologue's message and the forced landing (v1.0; restaged October 2026)

- **The father's message** (`PROLOGUE_CALL`, `src/story/calls.js`) is four lines and the cut, 29.4 s:
  made years after he left, it greets him as if live ("There you are. We haven't heard from you for so
  long."), says they miss him, that he is still a disappointment ("You leave everything half done"),
  and gives the charge word for word with its condition ("Bring back *something of value*. Until then,
  don't come home."; the key phrase lettered in gold), then the translator, cut mid-word: the traveller
  pauses it. `tests/prologue-call.test.js`.
- **The restaged opening** (`src/ship/prologue.js` `OPENING_ORDER`, `src/ship/cinematics.js`): nothing
  strikes the ship.
  - `call`: the singing light's theme (docs/systems/audio.md, "The singing light's theme") is heard
    three times under his words, each nearer (`lightCues`: faint and an octave up under the greeting,
    nearer under "still disappointed", nearest under the charge); the makers' hum rises under the
    charge as before, and the screen's static and the hologram's glitch with it.
  - `pause` (7.2 s): a click; he has paused it. The call screen reads PAUSED, its spools stopped; three
    shots: the father held still mid-word (`bust`), his face lit by it, listening (`listen`), then wide
    (`window`): him, the frozen bust and the window, where the light comes out of the dark. The theme
    sings once alone (`PAUSE_THEME_AT`).
  - `pass` (5.4 s): over his shoulder out of the window, the light comes on, growing, and goes by on the
    right; cut outside, wide from the ship's right side: it brushes past the hull and rushes away past
    the lens. Sung loud, its pitch falling as it goes (`bend`), panned across. As it passes the ship goes
    dark (`setPower('dead')`, the core's glow drained, the screen to static, the picture torn) and the
    view dims; "Losing power!"
  - `drain` (4.8 s): the hum winds down; "Main power gone. Only the reserve is left."; the amber reserve
    comes on; "Not enough power to stay up here. Taking us down."; the planet swings up into the window; white.
  - `glide` (5.2 s): over the desert, the dark ship comes down in a long shallow fall with a thin vapour
    behind it, no fire; the reserve's jets only at the very end.
  - `land` (3.6 s): down on its belly, a short skid through the dunes (`SITE_OVERRIDES.desert.crash.length`
    52 m, was 118), dust, still. No smoke after (the ship never burned).
  - `drone` (5.2 s, issue #434): inside, the reserve's amber light; Plumb wakes in its charging cradle by the hatch,
    blooms, lifts out of the cup and comes to his ear, the camera pushing in from the cradle to the two of them
    (src/ship/prologue-drone.js; docs/systems/scout.md). It rides at his shoulder from here, and he walks (not runs)
    down the ramp in `stepout` (`autopilot(…, { walk: true })`).
  - `hatch`: once the charge's card has gone, the ship: "Whatever passed us drained the core and left a
    magnetic signature on the hull. I can track its pulse." and he answers: "Then track it. When we can
    fly, we follow it. I want to hear it again." (`LANDING_LINE`, `FOLLOW_LINE`, src/story/signature.js:
    both play on past the hand-back, and after a skip, so the choice is his and never lost).
  The light is the ship's own puffs (`flame`, pale gold and cyan), a cluster at its head and a thin trail,
  lighting what is near (one of the level's point lights); `lightFrame` draws it on its way (ship-local,
  out of the dark ahead, nearest a few metres off the cockpit's right, away behind), drawn only within
  ~450 m. Birds no longer circle the ship in orbit (main.js: no flocks while the player is high over the
  map). Checked with headless Chrome frames from the voicemail to the step out (the cinematics-qc pass:
  docs/systems/cinematics-qc.md).
- **Nobody talks over a ship's scene** (`talkAllowed`, `src/ship/landing.js`): while `ship.playing`
  main.js picks no balloon and places no talk prompt, and `crowd.hush` keeps the crowd's shouts down.
  (The hidden traveller rides in the parked ship during the landing, so Marrow greeted him through it.)
- **Marrow at the wreck** stands at `bystanderSpot`: 22 m from the hull's centre (it is 13 m round),
  the hatch's way turned 0.7 rad to a side, never in the skid behind the landing's `travel`.
- **Boarding** is your own walk (issue #775): up the ramp on your feet and into the rooms, where the ship counts
  you aboard (`Ship.update`: `inside`, `ship:enter`, the rooms' close camera). There is no "go aboard" prompt or
  button (issue #87, "useless") and, since #775, no walk the ship takes over at the ramp's foot (it was
  `Ship.walksIntoRamp` / `walkAboard` on the autopilot, with `ReboardGate` holding it back after stepping out). E at
  the ramp is yours (talk, pick up). Stepping out (E by the hatch) still walks you down the ramp.
  `tests/landing.test.js`.

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
  is and looks as posed, for close-ups that never catch an ear. `behind: true` puts the follow camera
  back behind him at its usual pitch as it ends (`behindHim`), for a moment started by looking up. While one plays the idle's
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
- **The desert's four** (`src/story/desert-moments.js`):
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
    his back; C, over his shoulder, the tank's lights coming on one by one: the chest beside the
    pool hums back (`sound.boxAnswer`) and he turns to it (the lift valve's, found from
    `PLACEMENTS`); D, his face: a slight smirk. To the father's theme. The jar fills and the tank's
    words are said at its end. Until the author's playthrough (October 2026, issue #70) C ended
    with him lifting the glove and firing a first glob over the pool: he has nothing to fire with
    until the gun in the Givers' Hearth. No cinematic shows a thing used before it is found (the
    cinematics QC skill's checklist).
  - *the battery fills in the Font Room* (`desert.moment.font`, issue #784: "Filling the battery up should feel like a
    big moment"), when the lever at the dry pool's heart is pulled in the Rose House (`FONT_FILM`, 10.8 s; his feet are
    planted at the lever before it starts): A, wide and high from by the doorway, the lever over and the four spouts
    pouring; B, low at the kerb across the fluid rising round his boots, the pool's light coming up on him; C, close
    behind his hip on the battery as the fluid climbs into the glass (`tool.fillTo`), then the lens tilts up past it to
    the makers' mark on the far wall as it lights (`sound.boxAnswer`, the motif, a far rumble: the makers' door to the
    Dry Channel sinks); D, his face lit from the pool, turned up to the mark, a slight smirk. To the father's theme.
    The charge is applied on C's beat and for sure at its end (`charge`), the toast after.
  - *the tree catching* (`desert.moment.lit`, issue #239: "it should be from afar, so I can really see the scale of
    what's happening. It starts at the ground level, but then zooms out"), when the spark-stone is set in the roots
    (`setStone`; `LIT`, 10.2 s): A, low on the ground beside him, the stone going from his hand into the wet roots; B,
    from where A's push ends the lens backs off down the avenue and rises, tilting after the spark up the bark; C, one
    long pull back and up to 150 m out and 62 m high, the whole tree over Qanat's roofs as the fire grows out of its
    crown. One move from B on, no cut; on the side of the avenue away from anyone beside him (Hessa, who sweeps by the
    roots, steps back to the far end of her sweep as it starts). The motif swells as the tree catches. The lighting
    runs on its own clock (`LIGHT` in desert.js), so skipped or unseen the tree catches the same; nobody's lines are
    added (Hessa's and Nour's shouts are the lighting's own). `tests/moment.test.js` ("#239").
  - **Show, don't tell** (players: "the character feels corny"): the traveller says nothing in
    them and reacts with his face only, a slight smirk at most; no surprised or happy faces, no
    gestures. `tests/moment.test.js` holds them to it (no line in his voice, no big look).
  - Tests: `tests/moment.test.js` (the shots, a play through, the skip and its grace, a failure,
    the stage's refusals, and both desert moments in the story: once, skipped, without a ship).

### Every world's climax, filmed (October 2026)
The audit (docs/audits/game-v0.97.md, theme 6): only the desert's first times were filmed; the other ten
climaxes went unstaged. Each now has its moment, in `src/story/<world>-moments.js`, listed with its id,
flag and beat in `WORLD_MOMENTS` (`src/story/film.js`, which also holds the shared pieces: `closeUp`
on his face, `orbit`, `from`, `faceAt`, `facing`). The rules are the desert's, and one more, Journey's:
**the controls come back at the climax**, while the thing is still happening (she is still bowed, the
bell still tolls, the wheel still turns), never after a tail. Each is 8–10 s, four panels, the last
his face, three-quarter; he says nothing (a slight smirk at most; Viridel's is solemn, then sad;
the broadcast's still). The state each shows is its world's own, run on its own clock; the moment
only frames it, applies it on a beat and again for sure in `onEnd`, and holds the climax's toasts
for its end. When it can't play, the world does what it always did. Measured: no program compiled
mid-shot (`renderer.info.programs` unchanged). Tests: `tests/moments-<world>.test.js` each (played
once at the climax, the traveller held, the panels framing what they should, no lines, the swell, a
skip landing the same, no ship: as before) and `tests/world-moments.test.js` (the registry).

**A shot that keeps seeing its subject (v1.85, #491).** A lens set by hand goes stale when its world is rebuilt
round it: the Moon Foundry's wide sat inside the jib over the Casting-House's door (the moment's pull-in, a ray
from the look out to the lens, met the jib 2 m from the look and put the lens in it), and the floating city's
capstan panel filmed a leg of the Mooring-House's new tripod. film.js has the pieces for it, all shared with the
engines: `sightClear(pos, at, { physics, roots, near, skip })` (nothing solid, or drawn by `roots`, between a lens
and its subject, short of the subject's own `near` m), `clearShot(shot, { subject, ...sight })` (a shot of plain
frames checked at both ends and its middle; when blocked, swung round the subject's upright by the smallest turn,
then lifted, until clear; it returns the shot with `clear: false`, the pull-in no longer needed), `backdrop` and
`openCloseUp` (the face shot on the side of him with the most room behind his head). The two climaxes' tests
hold every lens of A–C to `sightClear` against the world as built now, its houses and its port.

- **Vael** (`arzach.moment.bird`, 10.2 s), the rider's flute played: A, low behind him and off his
  side, the haze where the call goes, a speck far out answering with a cry; B, a long lens from
  beside him panning up as she comes down out of the haze, wings wide (the world's motif), the horizon
  and the haze's towers kept at the frame's foot (`riseLook` in film.js: the look pitched down from her,
  the lens widened up to 48° when both can't fit); C, his
  face turned to where she lands; D, the two of them as she lowers her neck and opens her wings (from
  out past her and high when he is on the sill; side-on, the clearer side, on the plain). Her first
  bow is longer (5.6 s, `bow.len`), so control comes back with her still bowed in front of you. She
  is called, flies and bows on the world's clock; the moment only starts her nearer and asks for the
  bow at D if she is late. The flute's toast comes at its end.
- **Vael II** (`arzach2.moment.bell`, 9.8 s), the first pull with the clapper hung: A, wide from
  beyond the cliff's edge, the monastery, the first note, the monks' shouts; B, level with the
  belfry through its arch, the bell swinging and tolling, to the father's theme (it recalls the
  harbour bell at home); C, from the cliff's lip down across the sea of cloud to the aqueduct as the
  cloud settles round the piers; D, his face, turned out over the cloud. The cloud is held until the
  bell is heard (`bell.hold`), then settles over 8 s (`bell.settleFor`) and is still going down as
  control comes back.
- **Lorn** (`perdide.moment.crystal`, 9.8 s), the splinter first raised in the crystal cave's heart
  (in place of its page): A, wide down the cave from behind him, the dark ring; B, over his shoulder
  (the one away from Ysse) across the ring: one crystal answers, then another, then a third, a light
  coming up in each, then the whole ring takes the phrase (the caller's beat: the keepsake,
  `perdide.heart.rung`, the tank's crystal-violet band); C, high under the vault, a slow arc over the
  singing ring, and far off the phrase once more, thin, like a voice calling; D, his face lit from
  below, looking up into it. To the father's theme. The cave is still singing when control comes
  back; the world's closing words wait for the moment.
- **Lorn II** (`perdide2.moment.pools`, 10 s), the third dark pool lit: A, past the pool at him as it
  lights in his colours; B, out over the deep pool at the half-sunk saucer as it blinks back, three
  short and one long, its thin beam going up (`perdide2.saucer.answered` on its beat; the blink now
  starts at the start of its phrase, `st.blink0`); C, behind and above him, the lit pool and the
  keepers' lamps along the path; D, his face, turned to the light across the water. The world's
  motif swells from the saucer, still blinking as control comes back.
- **Viridel** (`edena.moment.terraces`, 8.8 s), the failure: the cistern's wheel turned one notch,
  the gate torn loose: A, the wall and its wheel from low on the south terraces as it cracks and
  gives; B, a high long lens down the lane following the water's front as the white walls and the
  tea go, step by step; C, low in the hollow looking back up at the raw lane between the terraces
  that held; D, his face turned to it: solemn, then sad, nothing said. The father's theme as the gate
  goes. The flood runs on its own ten-second clock (`terraces.js`, `api.onFlood`); control comes back
  while the water is still on the slope, and it finishes the same, watched, skipped or never filmed.
  While it plays, the flood's toasts that only say what the panels show stay silent (`told()`).
- **The City-Shaft** (`incal.moment.lodestar`, 9 s), the splinter given back from the palace's crown:
  A, low at his shoulder as it climbs past the needle; B, wide and low from beside the dome as it
  reaches the Lodestar and the light flares (the world's motif); C, across the shaft, a billboard that
  has stopped selling and says LOOK UP (picked in play, its line of sight clear; framed from about 45 m
  at 22° so the words read); D, his face from a little below, the sky behind. The light is still rising,
  the city still looking up, as control comes back, the camera behind him (`behind`: it starts pitched
  steeply up at the light); a skip mid-climb lands the splinter at once. The review page stages it as
  play does (`giveBack`, on the crown's terrace beside the needle, the camera looking up): calling the
  film alone never lit the light, so the billboards stayed blank. Without the ship, the old slow look up
  (`st.cine`).
- **The Sealed Hangar** (`garage.moment.signal`, 10 s), as Lune's talk closes with the stamped signal:
  A, low along the ring's floor, the two of them small in the great drum; B, from by Lune's feet up the
  curve to the slit, the sun in it (the motif); C, from above between them: nine dots of light come on
  one by one on the floor, three by three, the signal read at last; D, his face looking down at them.
  The dots stay, shimmering, as control comes back (gone after 40 s, or once he walks off); they are
  made at setup from the board's lit material.
- **The Buried Machine** (`buried.moment.wheel`, 9.4 s), the Wick lit before the wheel: A, low behind
  him, the rusted arc over him as it creaks back and lurches (the motif on the lurch); B, low where the
  teeth come up out of the dune, the sand pouring off; C, far out on the dunes, the wheel small and,
  high over it, the hanging city rocking like a cradle; D, his face. The turn starts with the moment
  and runs on its own clock (the tooth goes round at 7 s); control comes back as the wheel eases into
  its endless turn, the sand still sliding into its hollow; its two toasts at the end.
- **The Garden of Spheres** (`spheres.moment.chord`, 8.6 s), the pole singing back the three sounds:
  A, wide and low across the plaza's rings, the pole's lit crown, him small at its foot; B, high over
  the plaza, turning, ring after ring of light running out over the stones; C, low behind the pole, a
  long lens down the garden to the great sphere answering with its halo; D, his face turned to the
  horizon. Under it the pole's own tune, the glass bell carrying it; as its last note lands the
  world's motif (the bell's phrase) swells; control comes back with the halo still up.
- **The Signal Market** (`bazaar.moment.broadcast`, 9.6 s), the recording slotted in: the lead-in,
  not the broadcast. A, low where the avenue opens into the square, up the silent tower as its dark
  covers lift row by row; B, high up the avenue, the signs on the towers glowing white; C, from the
  tower's face down over the square: the market stopped, every head turned up; D, his face, the
  white screen behind him, still. The father's theme swells as his face comes up and runs on under
  the voice: control comes back as the hiss gives way to it, and the broadcast's conversation opens
  at the moment's end, watched or skipped (bazaar.js holds the cast's own timings while it plays).
- **The Underwater City** (`underwater.moment.whales`, 9.6 s), out of the Whale-House: A, down the last tube at
  him small by the door; B, inside the Whale Gallery, wide from its floor: the dome's ribs and glass, and a whale
  come up against it (`galleryWide`); C, closer at the glass, its flank sliding past; D, his face. Calmed, the
  first whale's loop comes in to the glass (`pull`) and rises 7 m more at its glass end (`lift` in
  `underwater-kit.js whale`), and the moment stages its pass (`level.whaleToGlass`, a jump along its loop while A
  looks down the tube), so B and C always find it there: from 12 m off and under the Gallery's floor it was a shape
  in the dark water (QC v1.66, issue #295).
- **The Moon Foundry** (`moonfoundry.moment.moon`, 9.6 s), out of the Casting-House: A, wide from the floor; B,
  under the jib, the whole moon rising from the door's foot onto the hook (`liftShot`); C, up at the hung moon as it
  turns round on its crown; D, his face. The change (`src/temples/moonfoundry.js`) holds the lift and the turn for
  the film (`show()`, `turn()`; unfilmed, they go after `CHANGE.wait` s): the hung moons are their own groups now
  (`level.hungMoons`), each facing the house, and turn once round over 14 s, back to facing it ("every hung moon
  turns to it", said and never shown before).
- **The City Floating in Space** (`spacecity.moment.cables`, 9.6 s), out of the Mooring-House: A, wide from over the
  void; B, high over the roof against the cables' way out, the great capstan turning with every cable leaving it
  taut (`capstanShot`), the lamps lighting one by one out along them (the change's `run()`, `LAMP_RUN`); C, beside
  the great cable to the Towers, its lamps running toward the city; D, his face.

The three ran 7.4–7.6 s in three panels until the v1.66 pass; `tests/moments-<world>.test.js` holds each to 8–10 s,
its fourth panel framing its beat (the whale in frame and at the glass, the moon rising onto the hook and the hung
moons turning, the capstan and its cables in frame with the lamps lighting), and the face last.

### A temple's ending, filmed (v1.79, issue #366)

"Temples should end on a cinematic. Cinematic should have the level's music playing." Every house (all fourteen) ends
the same way once its guardian is resolved (`src/temples/finale.js`): one shape, its details read from the house, a
moment on the ship's camera (letterbox, skip tag; B / ○, Menu, Esc or a tap skips it after the grace), once per save
(`temple.<id>.finale`), 11 s (`FINALE`), four panels, the last two each house's own (issue #562):

- **A, keeper** (3.2 s): the guardian whole as its resolution plays out, from behind him and a little round, him small in
  the foreground, the arc drifting on; a keeper too big for its hall at that reach gets a wider lens (to 68°).
- **B, reward** (2.4 s): low over the floor where its purse fell (the hosts' `purseAt`, `chimes.js purseSpot`: between
  him and it, short of its drawn body, so it lies in the open), the chimes floating up, the keeper beyond. Of the
  lenses round the purse (swung, drawn back, lifted, the look leaning toward the keeper) the first out of its body and
  of solids, 2.6 m off him and not through him, that sees the chimes past everything (the keeper's own body too:
  `sightClear` with it not skipped) with the keeper beyond in the frame; its lens as long as that allows (v1.85, #528).
- **C, house** (2.9 s; issue #562): the house's own panel, what the guardian's waking changes in its hall, happening
  now (`FINALES[id].sign`): the Rose House's cistern filling under its dry spout, the Warden's Well's four great vanes
  spinning up, the Belfry's hung stones sinking to its floor, the Footprint's spheres singing in turn then all three,
  the Engine-House's great gear turning again and throwing the ball out of its teeth, the Lamp-House's lamp catching,
  the Hush-House's crystals thawing and swinging in time, the roost's second vent breathing, the Clock-House's four
  stopped wall clocks racing round to the true time, the water welling up in the Greenhouse's beds, the Undertower's
  word stones singing the rest of the line, the Mooring-House's barred gate rising onto the hub, the Casting-House's
  iron moon glowing white-hot in its cradle and cooling, the tide spreading out of the Listener's pool over its floor.
  Each sign names its subjects (`at(rt)`: where, how big, what of it the lens may look through, a look that moves for a
  stone coming down or a column rising) and a lens (`lens`: over it, out from it, the push in, the rise); of the
  subjects (the one nearest him first, `pri` first) and the lenses swung round each from the hall's side and lifted,
  the first whose ends and middle are in the house, out of the keeper's body and of solids, off him, and see the subject
  past everything (the keeper too: `sightClear`, then `drawnHit` from the lens) is taken; its lens fits the subject and
  only lengthens as it moves in. Until #562 every house showed its hall from high up and ended on the makers' mark
  over a door: the same shot fourteen times (the v1.87 audit, interest 3.4).
  **Held back for its panel**: the house draws its change itself, reading `rt.calmK` (`TempleRuntime`: 0 before the
  guardian is resolved, then `rt.finaleK ?? 1`); the film sets `rt.finaleK` 0 through A and B and 0..1 over C, and
  `null` after (so the change is all there, and stays: on a reload too). The houses' `def.onCalm(rt, k, dt, t)` runs
  after their update each frame once resolved (the dials, the beds, the tide, the vanes, the crystals, the vents, the
  moon); the desert's spring, the Belfry's stones and the Lamp-House's lamp read `rt.finaleK` in their own easing; a
  sign's `run(rt, k)` (from `rt.finaleRun`, after the house's update) plays a beat of the film's own (the Footprint's
  spheres, the Undertower's stones, the Whale-House's dishes ringing), `end` tidies it, and a `hold` door (the Mooring-
  House's gate) waits for C as the way out waits for D. A skip ends the film: the change comes at once.
- **D, way** (2.5 s): the way out, the door whose condition is `{ resolved: true }` (`wayOut`, the nearest the arena's
  middle; `FINALES[id].door` where a house has two: the Mooring-House's way east, `d8`), seen from inside the hall:
  from behind what C showed (its basin, its vane, its cradle, its tide in the foreground, 7–19 m from the door) where
  that sees the door past the keeper, else from the hall at `FINALES[id].way` (back, up, turn), else straight on from
  as far back as its passage lets the lens (up to 11 m, as before). Its lens fits the doorway and its frame; it moves in
  a little. The logic holds the door shut (`logic.force`) until 0.4 s into this panel, then it sinks (1.8 s); he turns
  to it (`m.face`), so the follow camera comes back behind him looking at it. The house's glyphs come up over this
  panel (`rt.litWant`, eased by `TempleRuntime.glowUpdate`: `uGlow` + 0.35, back down over 2.5 s after).
  `way.clear` (the Whale-House, issue #567: the Listener comes to rest on its shell five metres before the door, and D
  was framed past it, the shell half the frame and a pod before the door's foot): the lens must also see the doorway
  whole (nine points across and up it, past everything drawn), and the keeper's body as it stands through D (its box)
  must stay off the doorway's part of the frame (a grid of 16 × 9 rays, a margin round the doorway) and take a fifth
  of the frame at most; such a house also tries lenses from over the keeper's body and further round (±0.9 rad). The
  Whale-House's D now looks at its door from the gap between the shell and the wall.
- **B's nudges** (`FINALES[id].reward`): the Whale-House's keeper's drawn box takes in the floor beside him, the
  Listener's shell 12 m high over it: a step toward it put the purse under the shell, and from low by the floor its
  underside filled the top half of the frame (the v1.87 audit). The purse now lands a step to his side, or behind him,
  clear of a body nearer than a step (`purseSpot`, src/chimes.js; never at his feet, where he would take it unseen),
  and `away: true` frames it close and high (4–6.5 m out, 4.5–7.5 m up, a 40° lens) from the far side of the purse from
  the keeper's middle: him, the chimes on the floor by him and the shell's foot beside. The same framing is used wherever
  the purse lands beside or behind him rather than a step toward the keeper (the Footprint's Echo, its rings wide).

The **music**: as it starts, `sound.musicCue('moment')` brings the world's recorded theme in under it (src/music-moments.js,
faded in over 3 s where it had gone quiet; inside a temple it is usually on already, indoors); without a recording the
procedural score's moment plays. `rt.finaleLog` (and a console line, `[temple finale]`) says whether the theme was
loaded and on.

**Hooked** in `TempleRuntime.onBossResolved` (`rt.onFinale`, set by `setupOneTemple` with the story's `moments`), after
the logic is resolved and before the doors and `temple.<id>.done`: the world's closing words that the flag sets off
wait for it (`story.waitFor` is a conversation or a moment, main.js and engine/game.js), the guardian's line and the
"outside" toast wait in the toasts (`cinema.held`). It can't play (no ship's camera, a scene up): the door opens at once,
as before. A skip or a failure opens the door in `onEnd`. **Framing from data**: each lens is kept inside the house's
bounds, clear of its drawn walls (`drawnHit`: a raycast of the house's meshes, since a wall high over a passage is drawn
and not solid, so the moment's own collider pull-in misses it) and out of the **keeper's body** (`keeperBox`: the
world box of its shown, opaque meshes, skinned ones posed, not a column of its radius: the Mother Snapper's leaves,
the Lampless's wings and the Listener's shell reach far past it). Calmed, it walks on to its rest as the film plays
(boss.js), so each panel keeps out of its body as it will stand then, moved and turned (`reachOf`). A's arc is swung
round it and lifted until its lens sees the keeper and has the whole of it in 68° at most (`fitFov`); C is swung round
its subject until it sees it (above). A shaft of light between a lens and the keeper (a `Sunbeam`'s `cone()`, `washes`)
is hushed to `FILM_HUSH` of its wash while the film looks through it, at once on a cut (the Greenhouse's sun washed
the Gardener pale in C, #529). The hand-back (`behind: { avoid }`, `behindHim`): the follow camera behind him, swung
the least it can until its arm is out of the keeper's body as it stands at the end (the Listener's shell, #529); `FINALES` holds each
house's beat, its own panel (`sign`) and its nudges (`side`, `door`, `way`, `reward`).
**Unity** plays it from the same story (engine/game.js: the ship's cinema as the screen's 'cine').
Tests: `tests/temple-finale.test.js` (all fourteen built: every panel frames its subject, from inside, not through a
drawn wall or the keeper; A–C each a lens out of solids and the keeper's drawn body that sees its subject, B past the
keeper's own body; the purse short of the body; the hand-back out of it; the Greenhouse's sun hushed; once; the theme cued; the door held to its panel; a skip and no ship; since #562 every house its own C and D from inside
its hall, its change held through A and B and happening in C, a skip landing it at once, the Whale-House's purse close
and in the frame), and `tests/engine-temple-finale.test.js` (the Aerie's in the engine bundle: its vents held, then
both breathing in C).

### After the v1.66 pass: framing fixes (issues #296–#299)

- **The stone** (`src/ship/homecoming.js`): the setting-down's angles (`TOMB_ANGLES`) are framed on where each of
  them stands (`TOMB_SPOTS`: him, Lou at his left, Ilen at the slab's right-hand end), and everyone is set on
  their spot under the cut to the stone; nobody is across the frame's edge in any angle (`tests/ending.test.js`
  projects each; the hands' insert alone may take his arms). Lou's close is from where she turns as she speaks
  (to him), low; the hands' from the slab's front right (from its left end Ilen stood in line). The reel's recording
  cuts between the busts and his face (`reelCuts`), and the reel's angle stands off his arm and the drone. The cargo check's step back is eased in and out (it popped 0.6 m at either end).
- **The recordings** (`src/ship/cinematics.js callFrame`): a cut between the push-in ('over') and the window angle,
  both behind his right shoulder, read as a jump cut (the fov 49 → 36 from nearly the same spot); the lens now
  moves across over `CALL_EASE.s` (0.6 s) instead.
- **The window seat** (`src/story/home.js`): the first angle rises with him as he stands (`seatWide`,
  `SEAT_RISE`), so his head stays under the letterbox; the second (`seatSide`) is tight on his profile and the
  pane, the room's curved wall behind him (its pale inner face in the sun read as a white patch) kept out.
- **Touchdown** (`src/ship/exhaust.js touchdownDust`): as the engines cut, the dust they blew settles within
  0.7 s (`Puffs.settle`, each puff shrinking from the size it has) and a small, pale puff rises at each foot, so
  the ship's feet read within a second (`tests/cutscenes.test.js`). Every arrival and the homecomings' landing.

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

## Cinematics quality control

Open `cinematics.html` (also in Debug → Cinematics). Its searchable collection contains every
registered world moment, the Lantern's arrival, both homecomings, the two quiet scenes at home,
all recordings, every destination's ship approach, departure, every authored makers' box and the
trailer. The previews run the game's own directors and world effects in one iframe. Replay reloads
that world with a fresh scene; Pause freezes the simulation, Sound toggles monitoring, and Fullscreen
expands the preview. Interactive story sequences retain their normal controls and skip prompts.
The trailer has its own timeline controls.

`src/cinematics-page/catalog.js` derives moments and boxes from their content registries. Its
`runtime.js` stages the traveller and prerequisites before invoking the real sequence; it does not
replace the camera tracks. `?cinematicReview=<id>` uses in-memory slot storage for progress,
migrations and slot metadata, so replay cannot overwrite a player's saves or active slot. Notes
and Pass / Needs work decisions are stored separately in this browser and exported as JSON.
Deep links use the cinematic id in the page hash. This is a review tool, not a deterministic video
exporter: world simulation and interactive beats run live.

The same list is played headless by `scripts/cinematics-qc.mjs` (frames, the HUD, the lens, loudness,
the skip), with the checklist in `.claude/skills/cinematics-qc/SKILL.md`; the scores and fixes of each
pass are in [cinematics-qc.md](cinematics-qc.md).

## The jump to space (src/ship/cinema.js `Warp`, playtest 2026-10-08)

The take-off's last second hands over to the warp, then the page goes to `?level=<id>&via=ship`. The warp
drew ink streaks on the paper's cream and the loading screen after it was cream too: a white page between
the dusty climb and the next world. Now space opens out of the middle of the screen in the night's ink
(`WARP.space`, #151a2b: a disc with an inked rim growing to the corners over `WARP.open`, 0.9 s, `warpLook`),
the streaks in cream with a little teal and red, a few fixed stars, the course card still on paper. An inline
script in index.html gives `#loading` the class `space` (the same ink, the pen in cream) when the URL says
`via=ship`, so the dark carries on until the arrival. tests/cinema.test.js checks the contrast, the disc's
growth and both ends.

