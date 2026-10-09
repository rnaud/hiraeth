# Challenges in the open world

Optional places where the verbs combine and skill shows (docs/fun-and-story-review.md, problem 5). Two kinds,
one system: each world's **trial** (its ride or its ability: the hoverbike, the wings, the bird, the skiff, the
jets, the gun; docs/systems/minigames.md, "Trials in the worlds") and the **makers' runs**, short chains of the
temples' own pieces stood out in the open (October 2026, v1.3). None is on the critical path; nothing asks you
to do one.

## The system (`src/trials/`)

- **A sign in the world.** Every challenge has a makers' post in its colour a few steps from its start (the
  arcade sign's model, `gameMarkerModel`); a makers' run's has a name plate (`signPlate`) that shows the
  makers' mark until you have a best, then your best. The interact button (X / □, E) says "try the …";
  nothing lists them on a menu: you come across them.
- **The start card.** The sign opens the minigames' runner (`src/minigames/kit/runner.js`) in the world
  (`drives: false`, `def.trial`): the name, one line on what it is, the rules, the controls (Xbox /
  PlayStation form on a pad), the makers' mark and your best. Start: you are put at the line, 3, 2, 1, GO.
- **During the run** the screen holds only the clock and the goal (`ctx.status`: "gate 2 / 5", "wake the eyes
  1 / 3") and the gates ahead (the next with a beam over it). The world's notices wait for the results
  (`.mg-hud:not(.off)` holds the toasts: src/ship/cinema.js `HOLD_TOASTS`); riding, the cue already shows no
  button hints (DONE.md, playtest notes).
- **The end.** Finished: your time, the makers' mark (beaten or not), "First finish." the first time; the best
  is kept by the runner (`minigame.<id>.best`, kit/scores.js `recordScore`). Failed: the reason ("Knocked out",
  "In the water", "Off the bike", "Off your feet"), nothing kept. Retry starts a clean run (a new session after
  the last one's `end()`); Quit leaves you where you are.
- **The reward.** A trial's first finish gives an upgrade to a gadget (src/trials/upgrades.js). A makers' run's
  is quiet: someone who lives nearby has a word for you (`voice` in its data: the first finish, the makers'
  mark beaten for the first time, a later run), on the results card and over their head as a shout
  (`npc.shout`), and the sign's plate keeps your best.
- **Main.js** makes them with `createChallenges({ levelId, scene, physics, player, items, game, foes, npcs,
  sound, notice, surfaceAt, open })`: the world's trial and its makers' runs, `{ list, byId(id), running,
  update, dispose }` (`window.trials` in the console). `createTrials` still makes the trial alone (its tests).

## The makers' runs

Data in `src/trials/kit-data.js` (`KIT_TRIALS`, id `kit-<world>`, mode `kit`), built by
`src/trials/kit-courses.js` (`COURSES`): the temple kit (`TempleKit`: hall, slab, stairs, column, glyph) in the
world's temple palette, and the temple pieces (`Gust`, `Swing`, `Bank`, `Updraft`) given a small stand-in for their
temple's runtime (`openRuntime`: the frame, the materials, the traveller, a logic that only says yes while a
run listens). They stand there for good, run or no run: the hall gusts and the crystals swing for anyone
passing, and as workings (src/workings.js) they throw foes about too. The collision is the kit's proxy, added
with `physics.addCollider`. The rules are pure (`src/trials/kit-run.js`): `KitRun` (the gates in order, then
the bank if there is one: it only listens once every gate is behind you, so nobody wakes it from the door or
climbs round the outside), `outOfRun` (a knockout; the water on a causeway; `fall`: the ground under a run
up in the air, once its first gates are behind you and past a point along it; `onFoot`: up on the jets for
more than 1.5 s ends it, `offFeet` the words), `voiceLine`. `controls` names the start card's controls
(`kitwings`: walk, jump, the wings; the default `kit`: walk, jump, aim, splash).

| run | where | goal | the sign | mark | wants | who speaks |
|---|---|---|---|---|---|---|
| **Wind hall** (`kit-desert`) | a roofless makers' hall on the dune crest west of the landing, door to the south, steps down to the sand (origin −135, 21.4, −64) | walk its 46 m through the gusts (every 5 s: streaks, then a shove back down the hall; calm behind each of the four screens and under the porch), then wake the three eyes over the porch inside 4 s | east of the steps | 42 s | the fluid gun | Pell, the counter of bones, at the foot of the dune |
| **Hush walk** (`kit-perdide`) | a causeway 42 m out over the deep lake south of Lorn's landing, three arches each with a crystal of the Hush swinging across it (2.6, 3.0, 2.8 s) | out to the round stone and back to the shore; a crystal knocks you into the lake, which ends the run; a stilling burst stops one for 6 s | on the shore, west of the causeway | 48 s | nothing | Sedge, the reed-cutter, in the reeds by the shore |
| **Feather leap** (`kit-arzach`) | a plinth, a makers' tower and a lower ledge on the plain north-west of Vael's landing, east of the stone hand, running north to south (origin −104, 25, −202) | up the column of rising wind at the tower's foot on open wings (it tops out under the screens: no gliding over them) onto the terrace 12 m up; across it through the gusts (every 5 s, three screens turn and turn about, the parapet behind you); glide the 27.5 m gulf to the ledge 6 m lower. Down on the plain once past the first gate ends it | east of the steps up to the plinth | 45 s | the wings | Kesh, who keeps the stone hand (a story local: `src/story/arzach-data.js` LOCALS) |
| **Furnace steps** (`kit-buried`) | a platform, eight iron pillars over a glowing grate 4 m down, and a landing before a sealed door, on the sand east of the Buried Machine's landing, running south (origin 40, 11, 66) | jump pillar to pillar (gaps 1.8–2.4 m, steps up under a metre, zigzag) to the landing; down on the grate ends it; then wake the door's four eyes in 2.6 s | on the sand by the stair | 34 s | the fourth chamber | Jot, nine teeth old, by the landing |

Fair on a controller and on touch: walking, jumping, aiming and the splash are all the run asks; the gust's
rhythm is shown before it blows (0.8 s of streaks), the crystals swing in plain sight, every screen leaves a way
past it about 2.9 m wide, and the eyes' 4 s is three shots with a tank to spare. The feather leap's gulf wants
a plain glide (27.5 m at the wings' 15 m/s sinks about 4.4 m of its 6), and its gate on the ledge is wide; a
walking jump carries about 3 m, so the furnace's pillars are each well inside one.

**Adding one:** an entry in `KIT_TRIALS` (its world, `course`, `origin` and `yaw`, the sign and the start in
the course's frame, the mark, `needs`, `wet`, `voice` with a tone on every line) and, for a new kind of
course, a builder in `COURSES` returning `{ gates: [[x, y, z, r]] (local), bank, swings, gusts, bounds,
clear }`. Pick a spot with nothing standing on it, nobody living there and clear of where the ship lands
(the test checks the people and `findShipSite`: Vael's search puts the ship at −99, −57, which the first try at
the feather leap stood on). Someone who speaks is a world's own person (`id` in CONTENT) or a story local
(LOCALS, standing on the world's spawn spots in order; in the game the story gives them their `def.id`).

## Tests

`tests/trials-kit.test.js`: the rules (gates, then the bank; the falls; the voice and its tones), the data
(route worlds, beside their trials, the speaker living there), each run built in its world with real
collision and water (the sign on the ground, the start and the gates over the floor, nobody standing in it,
its pieces workings) and played through with the session as the runner drives it: start, a fall or a
knockout, Retry from the first gate, the gates, the bank, the finish (its lines, the word on the card and
over the speaker's head, the best in the save), a slower second run keeping the first best; the hall's gust
(shoved in the open, calm in a lee, a way past every screen, the walls holding) and the Hush walk's crystal
(it knocks you off sideways; stilled, it hangs harmless; a Retry sets it swinging); the feather leap's column
(it lifts open wings over the parapet, not a walker), its screens and gusts and a gulf the wings can cross; the
furnace steps' pillars (each a floor, each a jump from the last), the grate under them, the door's four eyes.
Each run is clear of its world's ship. The trials:
`tests/trials.test.js`, `tests/trials-worlds.test.js`.

## Next

A makers' run in the other route worlds, each from its own temple's kit. Every one left wants a new piece in
the stand-in runtime (`openRuntime`): Lorn's deep wood (the lantern charm's lamps, `LightEar`), the Hangar
(eye banks with riding discs: `level.dynamic`), the Garden of Spheres and the City-Shaft (a stone ball rolled
onto its plate: the logic's drums and plates), the Signal Market (echo stones and ears), Viridel (seeds that
grow vine bridges: the logic's bridges), the sky stones (bell ears).
