# The scout drone

The folding drone that leads the way to the objective (sending it: docs/systems/ui.md, "Nothing on the screen").

## The scout keeps pace (v0.39)

(Until v0.62 the scout guided all the time; since then it goes out only when sent, the ping:
docs/systems/ui.md, "Nothing on the screen", and "Up and down" below.) `fly(dest, max, up, dt, carry)`
still adds your velocity as a feed-forward, so out on a bike or a bird it keeps ahead instead of
trailing, and it lays a thin glowing `Trail` that dissolves once it is home. It gives up and flies home
when it is more than `FIND.near + FIND.out + 20` m (41 m) from you.

## Up and down (v0.89)

Until v0.89 the scout only ever went out sideways: `lookout()` started 3.2 m over your feet, took the
way to the goal, **dropped its vertical part** and went `FIND.out` m along what was left. A goal on a
tower's deck, a rooftop, the floor above or a cave below got the same spot as one across a plain, at your
own height; only the lens (and the body's `PITCH`) tilted at it. Straight under a goal it just hovered
over your head. Indoors that spot (3.2 m up, 7 m out) was often in the ceiling or behind a wall, so it
pressed against them.

`lookoutSpot()` (exported, pure, `tests/scout.test.js`) now picks the height too, over your feet along
the world's up (gravity wells included):

- **above**: 2.2 m over the goal's level, at most `FIND.climb` (6.5 m) over your feet, or up to
  `FIND.shaft` (20 m) when the goal is steeply overhead (twice as high as it is far, blending in from
  45°): up a shaft, through Incal's oculus, up the side of a tower you stand under;
- **below**: it sinks by how much deeper than `FIND.level` (4 m) the goal is, at most `FIND.dive` (6 m)
  under your feet (a few steps down is still your floor);
- **further out the more it climbs or sinks** (`FIND.spread`, 0.5 m per m), so it stays in the camera's
  view behind you: in the Desert, 7 m out and 9 m over your feet is off the top of the screen;
- **in the open**: three legs from your head (up to the higher of the two heights, out along the
  ground's plane, down to the goal's height), each cut 0.6 m short of the first thing a ray meets, so the
  spot is under the ceiling, short of the wall, over the floor; then lifted out of the heightfield (the
  rays only see meshes). The flight goes straight there when it can see it, else to the legs' corner it
  can see (the top of the climb, the edge), so it rises up the shaft before it goes out over the rim.
- A guardian's hint stays at `HINT.rise` by you, as before (the fight is all round).

The find's line says how far up or down when that is a good part of the way (`findText`, `target.rise`:
"The observation deck · 27 m, 10 m above" only once the height is more than 6 m and 30 % of the
distance), and a flare far below you rises 12 m past your feet (`Flare.drop(at, up, below)`).

Measured in headless Chrome (the hover's height over your feet, before → after): the Desert, Marrow on
the ridge 21 m up and 131 m off, 3.2 → 6.6 m; at the foot of the Antennas' observation deck (10 m up,
27 m off) 3.3 → 6.7 m; Incal's Jets' Chamber, the gallery 24 m overhead, about 3 → 19.4 m (under the
dome's ceiling); from the deck to the field 12 m below, +3.2 → −3.5 m; a 2.8 m room in the tests, from
pressed against the ceiling to 0.6 m under it. `scout.update` while it is out: about 0.1 ms a frame on the
Mac either way (it casts 4–6 more rays a frame, only while it is out).

Known limits: there is no path-finding. A goal far below the edge of the deck you stand on (the
Underside's tip deck from the upper deck) gets a spot over your own floor, its lens and the flare's
column pointing down; a goal upstairs from a room gets a spot under the ceiling, lens up.

## The scout drone folds (v0.46)

The scout is a folding drone (`src/drone.js`), built like a seed pod: an
ivory lower hull with a blue rim, a rubber foot and one big brass-rimmed lens,
and an upper half of four blue shell petals hinged on the rim, with a small
rotor on the inner face of each and a whip antenna in the middle. Folded, the
petals close into a dome over the rotors (blades parked along the petals), the
antenna is drawn in to its brass bead, and the lens squints to a slit: a 21 cm
egg. Unfolded, the petals swing out and down into vanes (`PETAL_OPEN`, so the
rotors stand upright), the rotors spin up with a pale blur ring, the antenna
springs up and sways with the drone's accelerations, and the lens lights.

- **One draw call** for the drone: the painted parts (`vehicle-kit.js` paint)
  merged into one `SkinnedMesh` on 15 bones (hull, petals, rotors, blur rings,
  antenna rod and bead), bound folded; the glowing lens is its own small mesh.
- **`DroneFold`** is the state machine (`folded`, `unfolding`, `open`,
  `folding`): the eye opens, then the petals bloom, then the rotors spin up
  once the vanes are out; closing, the rotors spin down and park with their
  blades along the petals before the petals shut, and the eye closes last. It
  can reverse at any point; `snap()` jumps (teleports, recalls).
- **Coming and going**: it comes out of a small light and winks out (below, "It comes when it is
  needed"). Until v1.73 it rode a dock on his back, the rucksack's lid or the flask's left upright;
  that dock, its moods and their clearance tests were taken out after #294 (the author's call).
- **Flying**, the body stays near level (pitch at most `PITCH`) and leans into
  its speed (the lit beak that pointed at the goal is gone, October 2026: the
  drone's heading is the only pointer).
- `tests/drone.test.js` checks the fold's order, the folded shape (rotors
  inside the shell, its foot `DRONE_BELLY` under its centre) and the open one
  (rotors upright), and its coming and going.

## Plumb's own mind (v1.51, issue #152)

The drone has a name, Plumb, and a character (`lore/characters/plumb.md`).
`src/companion.js` gives it two small behaviours of its own, wired in
`main.js` (`updatePlumb`, each frame after the weather):

- **Lost** (`LostWatch`, `LOST`): a clock runs while you walk about in the
  world (on foot or riding; not in a scene, a menu, a fight or a minigame) with
  no progress: a quest step, an item, a chest, a talk, or a ping you asked for
  start it over. Each never-visited place (a 24 m cube) gives 40 s back, so
  exploring is not being lost; walking 40 m further from the goal than you were
  at the last progress runs it 1.5× faster. Standing still is never lost (60 m
  walked at least). At 3 minutes (6 with "fewer") it says one line, chosen by
  why (`still`, `away`, `circling`: 150 m walked in three places or fewer), and
  pings (the ping's own flight, flare and find line follow). Then it rests
  5 minutes (12 with "fewer"). It only speaks when the cue is empty and no
  notice is up.
- **Opening** (`Opening`): five lines, each once per save (flags
  `drone.said.<id>`): `out` and `recharge` (the first steps out of the crashed ship: the village on the horizon,
  someone there to help us recharge; issue #434, below), `person`
  (an unmet person within 8 m before you have talked to anyone), `chest` (the
  first chest opened, said once its scene is over), `pointer` (the first time it
  finds you lost, in place of a lost line). None names a button: the R3 line
  after the first talk is the hint system's (issue #151).

The setting "Drone hints" (`settings.droneHints`: on | fewer | off) and Hints
off (`droneSay`) quiet the lines and the pointing; the ping on request stays. The lines (`DRONE_LINES`) carry their tones and show on the cue
after the drone's ◇. `tests/companion.test.js` checks the threshold, the
cooldown, the setting, and each opening line once.

## It comes when it is needed (v1.73, issue #294)

The drone is no longer carried on the traveller: on its dock on the flask it sat by his face in every
close-up (the cinematics QC v1.66). The author: "move the drone off the character altogether for now.
It should just appear when I need it." So `Scout` (`src/scout.js`) is `away` (nothing drawn: play,
talks, portraits, menus and the studio all show him without it) until it is called:

- **It comes** (`APPEAR`, phase `appear`): every ping (Q, R3, the touch ping; Plumb's own when you are
  lost; a guardian's hint; a world's nudge, `scout:ping`) brings it out of a small inked light (an
  octahedron of its glow, `scout.light`) over your left shoulder, 0.55 m to the side, 0.35 m back and
  0.5 m over your head (`appearSpot`: in the camera's view behind you, lower under a ceiling, short of
  a wall). It grows there in 0.42 s, carried with you, folded, its eye waking, and blooms from half
  grown; then it flies its errand as before (seek, point).
- **It goes** (phase `leave`): done (or sent away, or lost), it rises where it is for 0.8 s, folding, and
  winks out into its light (0.3 s). Boxed in, it winks out and comes again once (`recall`).
- **Nothing to find**: it comes out of its light folded, shakes itself, no, and winks out (1.7 s).
- **In a scene**: `update(dt, paused, gone)`; main.js passes `gone` while a talk, a filmed moment, a ship
  scene or a box opening is under way, and a drone that is out is gone at once (it is no part of the
  shot). A teleport leaves it behind the same way.

Its lines (Plumb's, `src/companion.js`) still come on the cue with its ◇. `tests/drone.test.js` ("off him") checks nothing of it on him or drawn while idle, the light
and the growing by his shoulder, the bloom only once grown, the job and the going, and the scene
hiding it; `tests/scout.test.js` the phases of a find, a shrug, a hint and a recall.

## A name, a voice, and help when you look lost (v1.84, issue #434)

The author: "The drone should have a name and a personality. From time to time it should give me hints about where to
go next, or a hint about how to defeat a boss. In the prologue we should see the drone leave its charging station…"

- **Its name on its lines**: every line of its own, and a guardian's hints, show on the cue as `◇ Plumb: …`
  (`shown`, `DRONE_NAME`). The character, in three lines, is in `docs/story-bible.md` ("The drone: Plumb").
- **The prologue** (`src/ship/prologue-drone.js`, the prologue's `drone` stage, 5.2 s between `settle` and `hatch`):
  its charging cradle hangs on the cabin's port wall forward of the hatch (`src/ship/interior.js` `DOCK`: a shelf, a cup,
  its charge ring lit, a pilot light that goes dark with the ship, the cable down the wall). In orbit it sleeps there;
  after the landing the camera in the amber cabin holds the cradle while it wakes (`WAKE`: the eye at 1.0 s, the bloom
  at 1.6, out of the cup at 2.3), then pushes in on him as it comes to his ear (4.1). It rides at his shoulder through
  the hatch and down the ramp; at the end the director emits `drone:out` with where it is and the scout takes over
  there (`Scout.escort`, phase `escort`, `ESCORT.secs` 60 s at `appearSpot`, a ping sends it off, else it winks out;
  skipped, it comes out of its light). The step out is a **walk**: `ship.autopilot(…, { walk: true })` holds the
  stick at `AUTO_WALK` (0.06: ~1.5 m/s, under the walk clip's top), only in the prologue's first step out.
- **Its first word**: once outside, the opening's `out` brings `recharge` with it (`FOLLOWS`): "Best bet? The village on
  the horizon." "Someone there might help us recharge." The second points (`OPENING_POINTS`: `village`): main.js (and
  engine/game.js) emit `drone:village`, which starts the desert's main quest (src/story/desert.js; its first step is
  "Walk to Qanat, under the dark tree"), and ping, so it flies off toward Qanat, whose camps and great tree stand in the
  first step out's view. Marrow still calls you over until you meet him.
- **Where to go** (`placeOf`, `PLACE_LINES`): a lost line names the objective when it is a place ("The giant's skull is
  over here"): a label starting "The" / "Your", or "Name, description" whose name is no one's; never a person, never a
  doing, at most 28 characters.
- **A makers' house** (`StepWatch`, `HOUSE`, `HOUSE_LINES`; `droneWorld` reads the house you are in and
  `logic.next()`): 150 s (300 on fewer) on one step of its solver, a line on the kind of thing that waits (a switch, a
  plate, a ball, a lock…) and the ping's flight to it; then 240 s (480) of rest. Inside, the lost watch rests.
- **A guardian** (`FightWatch`): as the struggle in one phase passes 40, 100 and 180 s (`STRUGGLE`; fewer from the
  second), it pings by itself, the hint's flight: the lens on the weak point and the phase's next line
  (src/temples/hints.js), once a threshold.
- **Never chatty**: `GAP` 45 s (90 on fewer) between any two of its own lines, besides each watch's cooldown; Hints off
  or Drone hints off and it says nothing on its own.

Tests: tests/companion.test.js (the name, the first word, places, the house, the guardian, the gap), tests/scout.test.js
(escort), tests/prologue-drone.test.js (the beat, the walk, the hand-over), tests/desert-story.test.js (the quest on its
word). In the engines the same code runs (engine/game.js's `updatePlumb`); the opening's sequence has the beat's three
beats, the walk and the line (`plumb`).
