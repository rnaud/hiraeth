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
  out and brakes into the air with a few pale wisps, passes the clouds in a soft white fade and
  comes down upright on its jets: a landing, not a crash (the prologue's is a forced landing on its belly;
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
    view dims; "Power draining."
  - `drain` (4.8 s): the hum winds down; "Main power drained. Emergency reserve only."; the amber reserve
    comes on; "Not enough to hold orbit. Taking us down."; the planet swings up into the window; white.
  - `glide` (5.2 s): over the desert, the dark ship comes down in a long shallow fall with a thin vapour
    behind it, no fire; the reserve's jets only at the very end.
  - `land` (3.6 s): down on its belly, a short skid through the dunes (`SITE_OVERRIDES.desert.crash.length`
    52 m, was 118), dust, still. No smoke after (the ship never burned).
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
- **Stepping out** (`ReboardGate`): while you are aboard or a scene or the autopilot walks you, the
  ramp's "go aboard" (prompt and E) is held until you have been 7 m from its foot once.
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
    his back; C, over his shoulder, the tank's lights coming on one by one: the chest beside the
    pool hums back (`sound.boxAnswer`) and he turns to it (the lift valve's, found from
    `PLACEMENTS`); D, his face: a slight smirk. To the father's theme. The jar fills and the tank's
    words are said at its end. Until the author's playthrough (October 2026, issue #70) C ended
    with him lifting the glove and firing a first glob over the pool: he has nothing to fire with
    until the gun in the Givers' Hearth. No cinematic shows a thing used before it is found (the
    cinematics QC skill's checklist).
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

