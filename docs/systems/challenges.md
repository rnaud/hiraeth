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
world's temple palette, and the temple pieces (`Gust`, `Swing`, `Bank`, `Updraft`, `Ball` and `Plate`,
`EchoStone` and `EchoEar`, `Seed`, `Bridge` and `Bud`, `LightEar`, `Platform`) given a small stand-in for their temple's runtime (`openRuntime`: the frame, the
materials, the traveller, the game's events, and a temple's own logic kept in memory, which lights a bank or a
horn only while a run listens; woken with no run on, a horn says to start at the sign: `rt.deaf`). They stand there for good, run or no run: the hall gusts and the crystals swing for anyone
passing, and as workings (src/workings.js) they throw foes about too. The collision is the kit's proxy, added
with `physics.addCollider`. The rules are pure (`src/trials/kit-run.js`): `KitRun` (the gates in order, then
the bank if there is one: it only listens once every gate is behind you, so nobody wakes it from the door or
climbs round the outside), `outOfRun` (a knockout; the water on a causeway; `fall`: the ground under a run
up in the air, once its first gates are behind you and past a point along it; `onFoot`: up on the jets for
more than 1.5 s ends it, `offFeet` the words), `voiceLine`. `controls` names the start card's controls
(`kitwings`: walk, jump, the wings; `kitecho`: walk, aim, splash, play the shell back; the default `kit`: walk,
jump, aim, splash).

**The ball onto its plate** (`rt.roller({ id, a, b, r, plateR })`, `addRoller`): the temples' own `Ball` and
`Plate` (src/temples/pieces.js) with their logic (src/temples/logic.js, a `drum` and its `plate`, in the stand-in's
TempleLogic): a ball in a straight groove from `a` to `b`, rolled along by the fluid's push (a few metres a push,
stronger close up; a splash only nudges it, a push across the groove only rocks it), that settles into the
plate's dip at `b` and holds it down there (`home()`: at rest on its plate); a stop past the plate throws an
overshoot back. A new run rolls it back to `a` (`reset`). The balls and plates are floors and walls for the
traveller as in a temple: the run adds `course.solids()` to the player's moving solids (`player.opts.dynamic`)
and gives them back when it goes. What a run asks once its gates are behind you is `course.task`: a bank's eyes
(`kind: 'eyes'`) or the balls home (`kind: 'roll'`, its goal "roll the spheres home 1 / 2"); a ball rolled home
early waits there, and the last gate finishes the run.

**The notes carried** (`addStone`, `rt.ear({ id, note, at, yaw, reach })`, `addEar`): the Signal Market's own
`EchoStone` (splashed, it sings its note: the game event `note`) and `EchoEar` (a horn on a post, a `switch` in the
stand-in's logic, that wakes when its own note is played back from the echo shell within 7 m: the game event
`echo`, src/echo-shell.js), both solid here (a proxy round the stone and the post). The shell catches a note sung
within 18 m and holds one at a time, so a stone further from its horn than both reaches together means walking
the note over. The task is the horns awake (`kind: 'ears'`, "wake the horns 1 / 3"); a wrong note only makes a
horn shrug; a new run puts them to sleep (`reset`). The stand-in needs the game's events for these:
`buildKitCourse(T, { …, game })`.

**The vines grown** (`rt.vine({ id, seed, a, b, w, n })`, `addVine`; `rt.bud({ id, at, w, h })`, `addBud`): Viridel's
own `Seed` and a `Bridge` grown from it (`from: 'grow'`), and its `Bud` flower-door. A bloom glob wakes the seed
(plain fluid only soaks in, an ember blackens it) and the vine weaves out across the gap, a floor from the moment
it starts; a bloom opens the bud (solid while shut). These answer anyone, run or no run (`rt.free`: a seed is the
world's to grow), and what the temple runtime would do on its own the stand-in does in `links` (each frame: a
seed on grows its bridge, a bloomed bud opens, from `rt.lit`, what `onLit` has heard); a new run takes the vines
back and shuts the door (`reset`). A run's `noWings` ends it the moment the wings open (a glide would carry you
over a 10 m gap), with `offFeet` the words. The course's dispose takes its pieces' colliders back too.

**The bells heard** (`rt.bellBridge({ id, ear, reach, a, b, w, n })`, `addBellBridge`; `rt.bellDoor({ id, at, reach })`,
`addBellDoor`): the Founders' Belfry's own `Bridge` from 'above' (its stones hang high over the gap, bobbing: they
fell up) and its bell-tuned `Door`, each woken by the temple's `BellEar` (the game event `bell`, from the
bell-note whistle: src/boxes/effects.js; the listening shell's soft hum does not count). In the open each
bridge's ear stands on a bell post at the gap's near edge, reach 6 m, and the ears stand further apart than
two reaches, so one note brings down one bridge. They answer anyone, run or no run (`rt.free`, as the seeds do),
and the stand-in drives them in `links` (stones down, door open, from `rt.lit`); a new run sends the stones back
up and shuts the door. The stones are a floor the moment they start down, as in the temple.

**The lamps lit** (`rt.lamp({ id, post, reach, hold, a, b, w, n })`, `addLamp`, v1.28): Lorn II's Lamp-House's own
`LightEar` on a keeper's post (a slim column, the lamp's glow hanging at its head) and a `Bridge` of moss-stones from
below (`glow`: glowing moss, as the Lamp-House's Root Stair raises them), raised by its lamp. Stand by the post
(within 3.5 m) with the lantern charm for `hold` (1.2 s) and the lamp wakes; the stones rise out of the water, a
floor at once. The charm is asked of the traveller's items (`rt.items`, given to `buildKitCourse` by
`makeTrial`; the stand-in's logic says yes to everything else), and the lamps answer anyone who carries it, run or
no run (`rt.free`); a new run puts the lamps out and sinks the stones.

**The discs ridden** (`rt.disc(o)`: the temples' `Platform`, v1.28): a riding disc that shuttles along its path
(ping-pong, eased near its ends, a pause at each), a moving floor in `course.solids()`, so the traveller rides it as
he does a temple's (src/player.js `opts.dynamic`, handed over for good by `makeTrial`). A path may climb (the disc
run's last disc rises 4 m as it crosses).

| run | where | goal | the sign | mark | wants | who speaks |
|---|---|---|---|---|---|---|
| **Wind hall** (`kit-desert`) | a roofless makers' hall on the dune crest west of the landing, door to the south, steps down to the sand (origin −135, 21.4, −64) | walk its 46 m through the gusts (every 5 s: streaks, then a shove back down the hall; calm behind each of the four screens and under the porch), then wake the three eyes over the porch inside 4 s | east of the steps | 42 s | the fluid gun | Pell, the counter of bones, at the foot of the dune |
| **Hush walk** (`kit-perdide`) | a causeway 42 m out over the deep lake south of Lorn's landing, three arches each with a crystal of the Hush swinging across it (2.6, 3.0, 2.8 s) | out to the round stone and back to the shore; a crystal knocks you into the lake, which ends the run; a stilling burst stops one for 6 s | on the shore, west of the causeway | 48 s | nothing | Sedge, the reed-cutter, in the reeds by the shore |
| **Feather leap** (`kit-arzach`) | a plinth, a makers' tower and a lower ledge on the plain north-west of Vael's landing, east of the stone hand, running north to south (origin −104, 25, −202) | up the column of rising wind at the tower's foot on open wings (it tops out under the screens: no gliding over them) onto the terrace 12 m up; across it through the gusts (every 5 s, three screens turn and turn about, the parapet behind you); glide the 27.5 m gulf to the ledge 6 m lower. Down on the plain once past the first gate ends it | east of the steps up to the plinth | 45 s | the wings | Kesh, who keeps the stone hand (a story local: `src/story/arzach-data.js` LOCALS) |
| **Sphere court** (`kit-spheres`) | a white plinth 12 m by 46 on the meadow south of the mirror lake, running east (origin 140, 0.4, −22) | weave the slalom past four stone spheres to the arch at the far end, then roll the two white spheres onto their plates at the dais with the push: the west one up the court (8 m), the east one back down it from the far end (12 m) | by the step at its west end | 42 s | the fluid gun | Nell, who looks into the lake, on the shore to the south-east |
| **Long look** (`kit-incal`) | a balcony from the rim out over the City-Shaft, in the parapet's gap round from the spawn (origin 266, 200.3, 61.4, facing the shaft's middle) | roll the stone ball from the rim along the balcony's three stones (the gaps between them a jump; the ball crosses on an iron rail) onto its plate at the far end, 31 m; no parapet: down the shaft ends it | on the rim behind the plinth | 40 s | the fluid gun | Tobin, the seller of views, along the rim |
| **Furnace steps** (`kit-buried`) | a platform, eight iron pillars over a glowing grate 4 m down, and a landing before a sealed door, on the sand east of the Buried Machine's landing, running south (origin 40, 11, 66) | jump pillar to pillar (gaps 1.8–2.4 m, steps up under a metre, zigzag) to the landing; down on the grate ends it; then wake the door's four eyes in 2.6 s | on the sand by the stair | 34 s | the fourth chamber | Jot, nine teeth old, by the landing |
| **Echo relay** (`kit-bazaar`) | a plinth 10 m by 46 down the first side street west of the Signal Market's avenue, a few steps from the spawn, running west out past the towers (origin −42, 0.35, 75) | past three walls hung with old dishes (a way 4 m wide past each, west, east, west) to the arch at the far end; then the relay: the low and middle stones stand at the near end with the high note's horn, the high stone under the far arch with the low and middle horns (each stone 31–37 m from its horn): catch a note, carry it, play it back at its horn, three times | at the mouth of the street, by the step | 38 s | the fluid gun and the echo shell | Oyo, who sells lanterns on the avenue |
| **Vine walk** (`kit-edena`) | four decks of the white builders' stone in a line down the meadow's long slope east of Mira's water clock, running east (origin 57, −3.2, 1): level with the top, so 2 m over the meadow at the steps and 10 m at the far end | bloom the seed at each of the three 10 m gaps (its vine grows a bridge) and the flower-door in the wall on the third deck (it hides the third seed), to the arch on the last deck; down in the meadow past the first deck, or the wings opened, ends it | on the meadow beside the steps | 28 s | the bloom mode | Mira, who keeps the water clock |
| **Bell crossing** (`kit-arzach2`) | four decks of bone-white stone out over the sea of cloud from the starting plateau's south rim, each beyond the rim floating on a stone of its own, level with the plateau, running south (origin 0, 40.5, 85) | sound the bell-note whistle by the bell at each of the three 10 m gaps (its fallen-up stones come down into a bridge) and before the bell-tuned door on the last deck, to the arch past it; down into the cloud past the first deck, or the wings opened, ends it | on the plateau beside the step | 28 s | the bell-note whistle | Sister Aube, the hermit of the edge (a story local: `src/story/arzach2-data.js` LOCALS) |
| **Lamp walk** (`kit-perdide2`, v1.28) | four decks on piers out from the shore over the lake south of the deep wood's landing, a few steps from Hollin, running south-west (origin −23.7, 1.3, 31.6) | stand by the keeper's lamp at each of the three 10 m gaps with the lantern charm until it wakes (its moss-stones rise out of the water into a walkway), to the arch on the last deck; the water, or the wings opened, ends it | on the shore beside the steps | 30 s | the lantern charm | Hollin, the keeper of the lamps |
| **Disc run** (`kit-garage`, v1.28) | a platform up a stair, two islands and a landing on blocks 6 m over the Hangar's plain east of the clerk's board, running east (origin 52, 6, 38) | ride the disc shuttling across each gap (14 to 16 m; the last climbs 4 m to the landing), step off at the far side; on the landing wake the wall's three eyes inside 4 s; down on the plain, or the wings opened, ends it | on the plain beside the stair | 54 s | the fluid gun | Clemence, who remembers the Major (a story local: `src/story/garage-data.js` LOCALS) |
| **Sounding walk** (`kit-underwater`, v1.43) | a strip of the Whale-House's shell-pink floor 9 m by 24 in the Avenue's north-west, under the dome, running north (origin −30, 0.12, 26) | past two listening screens hung with dishes (a way past each, east, then west) to the arch at the far end; then wake the three brass horns: the whale-horn's deep note carries 7 m and the horns stand 9–16 m apart, so each wants its own note | on the floor by the strip's south-west corner | 30 s | the whale-horn | Coralie, who keeps the café |
| **Moon roll** (`kit-moonfoundry`, v1.43) | a plinth 12 m by 40 on the foundry floor south of the last furnace, running south (origin 78, 0.12, −22) | weave round three hoist frames to the arch at the far end, then roll the two stone moons (the Casting-House's test casts) into their cradles with the push, each its own way (8 m and 10 m) | on the floor by the plinth's north-west corner | 50 s | the fluid gun | Bertil, who pours at the last furnace |
| **Moorers' leap** (`kit-spacecity`, v1.43) | a plinth out over the Towers' east edge into the dark, a mooring post 12 m up and a landing 6 m up across a 26 m gulf, running east (origin 112, 6.1, −84) | up the void's breath (the Mooring-House's Updraft) on open wings to the post's deck, glide the gulf to the landing, then wake the capstan wall's three eyes in one breath; into the dark once past the first gate ends it | on the island by the plinth | 45 s | the wings and the fluid gun | Tamar, who minds the cables |

Fair on a controller and on touch: walking, jumping, aiming and the splash are all the run asks; the gust's
rhythm is shown before it blows (0.8 s of streaks), the crystals swing in plain sight, every screen leaves a way
past it about 2.9 m wide, and the eyes' 4 s is three shots with a tank to spare. The feather leap's gulf wants
a plain glide (27.5 m at the wings' 15 m/s sinks about 4.4 m of its 6), and its gate on the ledge is wide; a
walking jump carries about 3 m, so the furnace's pillars are each well inside one, and the long look's gaps
(1.8 m) too. The balls want only the push (the gun's mode: D-pad / X, or the touch mode button); each is pushed
from straight behind, and there is always room beside it to walk round. The marks of the sphere court and the
long look are a scripted run (walked at 5 m/s, each ball pushed as soon as it lies still, the tank's three
charges and its refill counted, pushed from a step behind) plus about 30 %: 32 and 31 s; played in the game with the real push, 31 and
36 s (the gates walked first, then the ball rolled out from the rim). The echo relay asks only for a walk, a splash
and the shell's button (Y / △ with no gadget in hand, V, or the touch ◆ button); each horn wears its note's colour
(low amber, middle teal, high rose) like its stone's bands. Its mark is a scripted run (walked at 5 m/s, half a
second for each splash and each play-back) of 21.6 s plus slack: 38 s; walked in the game at the walking pace
(3.8 m/s, no running) with the real gun, shell and key, 31 s. The vine walk wants the gun's bloom mode (D-pad /
X, or the touch mode button) and a walk; the seeds and the door take a shot from anywhere in range (the first two
can be bloomed from the start), and the vines are a floor at once. Its mark: a scripted 17.4 s (walked at 5 m/s,
half a second for the mode and each bloom) plus slack, 28 s; walked in the game, 24.9 s. The bell crossing asks
for a walk and the whistle's button (Y / △ with no gadget in hand, V, or the touch ◆ button), by each bell and
before the door; the stones carry you at once. Its mark: a scripted 17.2 s (walked at 5 m/s, half a second for
each of the four bells) plus slack, 28 s; walked in the game with the real whistle, 24.8 s. The lamp walk asks only
for a walk and a stand by each lamp (the lantern charm does the rest: no button), its stones a floor at once; its
mark a scripted 18.4 s (walked at 5 m/s to each post, its 1.2 s by it and a little) plus slack, 30 s. The disc run's
discs come to you (each rests 1 to 1.2 s at either end); its mark a scripted 43 s (walked at 5 m/s to each gap's
edge, waiting there for the disc to come to rest at your side, ridden to its far stop, and a breath for the eyes),
plus slack, 54 s.

**Adding one:** an entry in `KIT_TRIALS` (its world, `course`, `origin` and `yaw`, the sign and the start in
the course's frame, the mark, `needs`, `wet`, `voice` with a tone on every line) and, for a new kind of
course, a builder in `COURSES` returning `{ gates: [[x, y, z, r]] (local), bank, swings, gusts, bounds,
clear }`. Pick a spot with nothing standing on it, nobody living there and clear of where the ship lands
(the test checks the people and `findShipSite`: Vael's search puts the ship at −99, −57, which the first try at
the feather leap stood on), and clear of the world's makers' court (src/finds/courts.js: the first try at the
echo relay ran into the market's, east of the avenue). Someone who speaks is a world's own person (`id` in CONTENT) or a story local
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
furnace steps' pillars (each a floor, each a jump from the last), the grate under them, the door's four eyes;
the ball onto its plate (the logic's drum and plate, the push rolls it, a splash nudges it, sideways it rocks,
home it holds the plate, a reset rolls it back, the traveller's solids given and taken back); the sphere
court's grooves (opposite ways to one dais, the middle clear, the slalom's spheres solid, balls home early wait
for the last gate) and the long look's stones (floors out over the drop, open air under the gaps beside the
rail, nothing in the way, down the shaft ends it); for both, the mark against a scripted run; the echo relay's
stones and horns (a stone sings, the shell catches it near and not far, a horn stays still with no run on and
says why, wakes for its own note within reach once the walls are behind you, shrugs at another, every stone
further from its horn than both reaches, stones and posts solid, a way past every wall, its mark); the vine
walk's gaps (no jump crosses them, the meadow under them below the fall line), its seeds (a splash soaks in, a
bloom grows a floor across, only as wide as the vine; with no run on too), its door (shut and solid, a bloom
opens it), a new run taking it all back, the meadow and the wings ending it, its mark; the bell crossing's gaps
(no jump crosses them, only cloud under them), its bells (too far, or the shell's hum: nothing; by the post, the
stones come down, a floor only as wide as they are, run or no run; one note wakes one ear), its door (shut and
solid, the bell opens it), a new run sending it all back, the cloud and the wings ending it, its mark.
The lamp walk's gaps (no jump crosses them, the lake under them, deeper than wading), its lamps (no lantern: nothing,
however long; too far: nothing; a moment: not yet; a while: the stones risen, a floor only as wide as they are, run
or no run; one lamp wakes one bridge), a new run putting them out, the water and the wings ending it, its mark; the
disc run's gaps (nothing fixed across them, the plain under them), its islands and landing, each disc's stops
meeting the decks either side level with them over a whole cycle, the discs handed to the traveller as floors, the
plain and the wings ending it, its mark against a scripted ride.
Each run is clear of its world's ship and of its makers' court. The trials:
`tests/trials.test.js`, `tests/trials-worlds.test.js`.

## Next

Every route world has its makers' run now (v1.28: Lorn II's lamp walk and the Hangar's disc run finished the
eleven; v1.43: the three worlds of v1.40 got theirs, from their temples' kit: the Whale-House's horns, the
Casting-House's moons and cradles, the Mooring-House's breath of the void). A second run in a world could use what is left of its temple's kit: Viridel's greenhouse glass (a vine up
a pane too smooth to climb) would want the rest of its wall made unclimbable (`noClimb` colliders), which the
stand-in does not do yet; the Hangar's eye banks on pistons in turn (`Bank` with `stroke`), the Lamp-House's
pool-orb rolled to a lamp (a `Ball` with its `lamp`).
