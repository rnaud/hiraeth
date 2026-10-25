# The scout drone

In v1.95 (#605/#611), Plumb speaks ship/navigation status and answers requested advice. Automatic opening observations and wandering tips no longer appear on the cue or trigger a hint ping; their progression flags remain compatible. The historical internal rules below still drive the companion’s state. Critical advice remains available through Plumb’s button.

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
  finds you lost, in place of a lost line). None names a button: the D-pad → line
  after the first talk is the hint system's (issue #151).
  Later, once per save the same way (`ONCE`): `bladegate`, the first time a fight temple's host (and so its
  Blade Gate) is within 12 m: "Makers' gate. Blades mean keep out. Something got in." (issue #483; the check is
  `wireCompanion`'s, shared by the web and the engines).

The setting "Drone hints" (`settings.droneHints`: on | fewer | off) and Hints
off (`droneSay`) quiet the lines and the pointing; the ping on request stays. The lines (`DRONE_LINES`) carry their tones and show on the cue
after the drone's ◇. `tests/companion.test.js` checks the threshold, the
cooldown, the setting, and each opening line once.

## It comes when it is needed (v1.73, issue #294)

The drone is no longer carried on the traveller: on its dock on the flask it sat by his face in every
close-up (the cinematics QC v1.66). The author: "move the drone off the character altogether for now.
It should just appear when I need it." So `Scout` (`src/scout.js`) is `away` (nothing drawn: play,
talks, portraits, menus and the studio all show him without it) until it is called:

- **It comes** (`APPEAR`, phase `appear`): every ping (Q, D-pad →, the touch ping; Plumb's own when you are
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
- **Its first word**: once outside, the opening's `out` brings `recharge` with it (`FOLLOWS`): "Where to? That village on
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

## Plumb talks to you (v1.87, issue #543)

The author: "Plumb should talk to you like a real character, not just a hint at the top of the screen (when it has
something critical to tell you, with the same button we use to ping Plumb to go to the next quest marker)."

**What counts as critical** (`src/companion.js` `CRITICAL`): the lines of its own that send you somewhere.

| id | when | example |
|---|---|---|
| `still`, `away`, `circling` | you look lost (the lost watch; the first time, the pointer line) | "Lost? A little." / "The giant's skull: this way." |
| `house` | minutes on one step of a makers' house (`StepWatch`) | "Put something heavy on that plate. I'll show you." |
| `bladegate` | danger: the first fight temple's Blade Gate within 12 m (`ONCE`) | (a whisper) "Those blades mark a dangerous entrance." / "Be careful." |

Everything else of Plumb's stays on the cue as before: the opening's chatter (`out`, `recharge`, `person`, `chest`:
they come before the button is taught, and `recharge`'s flight starts the desert's quest by itself) and a guardian's
hints, by themselves or asked for (a fight is no time for a conversation). Other characters are unchanged.

**The flow** (`src/host/game-host.js` `wireCompanion`, the web and the engines alike):

1. A critical line is not put on the cue. `Companion.update` keeps it as `pending` (`{ id, line, pages, bark, point }`) and
   returns `{ hail }`; while one waits, nothing else of its own is said (the lost and house watches and the opening's
   chatter wait; a guardian's hint does not).
2. When nothing else is up (the host's `canSpeak`), not in a fight and not riding, Plumb comes out of its light at your
   shoulder (an escort, `Scout.escort`) and `Scout.hail(true)`: it turns to you and hops every 1.7 s, a red inked "!"
   of its glow over it (`HAIL`, `scout.mark`, a mesh in the scene so the engines draw it too), and calls
   (`sound.drone('call')`, two rising chirps). The first time in a save the cue says "{key:scout} talks to Plumb"
   (`src/scout-hint.js` `plumbHintDue`, `teach.plumb`; hints subtle or full).
3. Plumb's button (D-pad →, Q, the touch ping) asks `plumbStep.press()` first: with a talk waiting it opens it in
   the dialogue box and returns true; otherwise false and the host pings exactly as before. The talk is a
   listen-only conversation (`plumbTalk`): Plumb's name and colour (`PLUMB_PERSON`), its line in one to three pages
   (`talkPages`: split at its sentences, none under three words), each with the line's tone. `Scout.talk()` puts the
   drone 1.05 m before your face (`TALK`), open and facing you, floating, a little bob on each syllable (`express`,
   from the talk's faces); `plumbNpc` is its stand-in for the conversation: the two-shot frames it, the traveller
   turns to it, and its portrait is drawn close on the drone from your side (the engines draw the same kept objects).
   A talk with Plumb sets no `met.` flag (`person.companion`).
4. When the talk closes (`dialogue:end`, id `plumb`) Plumb flies toward the goal: `scout.ping()`, the find's line,
   the flare and the marker, as the button always does. A talk with nowhere to point (`point` null: the Blade Gate's
   warning, said at the gate) ends there: Plumb goes home (`Scout.home`), no flight (#563).

**The pointing word is a bark** (v1.87, issue #559). Lines written for a drone that flies as it speaks ("Look.", "This
way.", "Over here.", "The pool is back here.") point at nothing from a dialogue box. `splitBark` takes a critical line's
last sentence off when it only points (`POINTING`): the box gets the rest (`pages`), and the pointing word (`bark`) goes
on the cue as Plumb flies off after the talk, the frame after `dialogue:end` (`wireCompanion`'s step returns it, the
host shows it 3.2 s as Plumb's other lines, then the find's line). A line that is whole without it keeps its words in the
box ("Put something heavy on that plate. I'll show you.", "Long way round? {place} is the other way."). The sequence `plumb-talk`
(engine/sequences.js) records both: the gate's talk and no flight, a lost talk, its bark, the find.
5. Unanswered for `HAIL.secs` (40 s) it lets the talk go and winks out. A scene, a teleport or a ping of a world's own
   puts it away (and a fight sends it home); it comes back to your shoulder after, the talk still waiting.

The talk opens two frames after the press (`OPEN_FRAMES`): the drone is put before your face at once, and an engine
draws a portrait from the scene as last sent to it, so Unity's chip was empty when both came in one frame. The mark
is made the first time it is wanted (`Scout.mark`): one made with every scout shifted the engines' seeded run of a
fight temple (the `fight-crowd` sequence's foe warnings).

Tests: `tests/companion.test.js` (the pages, the queue, the button with and without a talk, put away and let go),
`tests/scout.test.js` (the hops, the mark, the talk's spot through a scene), `tests/scout-hint.test.js` (the button's
line), and the `plumb-talk` sequence (`engine/sequences.js`, `tests/sequences-plumb.test.js`): the engines' stream held
to the web's beat by beat (the mark with nothing of Plumb's on the cue, its two pages under its name, the find after);
run in Unity's batch too on 19 October, its four beats the web's, the mark, the box and the portrait drawn.

## It shows you (issue #662)

Plumb drifts out on its own to the person or thing your quest wants, while you dawdle near it: it comes out of its light,
hovers beside it a while, its lens on it and its ring lit, then goes. The rules are pure (`src/drone-attend.js`,
`tests/drone-attend.test.js`); `wireCompanion`'s `attendStep` (`src/host/game-host.js`) drives them for the web and the
engines alike, and `Scout.attend()` / `unattend()` fly it (phase `attend`, `src/scout.js`).

- **What can be shown** (`attendCandidates`, from the quests, src/story/quests.js): the tracked objective (what the ping
  finds, weight 3), the people still waiting to give a quest (the Map's giver marks, 2), and every other quest's step
  with a place (1.4). Only people and things: a stage to `talk`, to `bring` (the item, then the one it goes to), or one
  marked `at` without a `goto`; places to walk to never. The fragments are never shown (they are secrets).
- **Which one** (`AttendPicker`): in range (`ATTEND.range` 22 m), on your floor (within `floor` 3.5 m up or down along the
  world's up), in sight (a ray from your head to 1.2 m over it, `sees`), not reached (`reached` 3 m flat), not shown lately
  (`again` 75 s, 180 on "fewer"). Score: the weight, less up to half of it with distance; the tracked step 18 m off still
  beats a giver 6 m off.
- **Steady** (hysteresis): the one shown is kept past `range` up to `keep` (30 m), out of sight up to `blind` 1.5 s
  (someone walking behind a post), at least `hold` 5 s, and only a rival `switchBy` 1.4 times better takes its place: two
  near-equal targets never flip-flop as you walk between them.
- **Let go**: done (gone from the quests: talked to, taken, the step moved on), reached, on another floor, too far, out of
  sight, or shown `show` 14 s: it goes home and that target is marked shown.
- **When** (`AttendGate`): you stand or walk slowly (under `slow` 2.4 m/s) for `settle` 1.6 s, on foot, calm (no talk,
  scene, menu, photo, ship scene: the host's `calm`), not in a fight, nothing else of Plumb's under way (a talk waiting or
  open, a ping's flight, an escort), and `rest` 6 s after its last outing. Once out a brisker walk keeps it out; running
  (over `fast` 4.2 m/s for `hurry` 0.4 s), riding or a fight sends it home (rises and winks out); a talk or a scene puts it
  away at once. Sent home by you, the target is not marked shown.
- **Where** (`attendSpot`): `over` 1.85 m over its feet, `toward` 0.8 m back toward you and `side` 0.7 m to its right as
  you see it: beside a person's head, under a bark's bubble, in the camera's view; lower under a ceiling.
- Drone hints off (or Hints off) and it never goes. `scout.autoAttend = false` turns it off: the sequences' runs set it
  (engine/sequences.js `SequenceRun`), their streams were recorded before it and its timing hangs on how long a beat
  stands still.
