# Minigames

Small games played apart from the journey (v0.92), eleven of them: each in its own little arena built on the
fly, or in a corner of an existing world. **Dune skiing** (`src/minigames/ski.js`), **Sky steps**, the
platformer (`src/minigames/platformer.js`), the **Canyon run** (`src/minigames/canyon.js`), **Fishing**
(`src/minigames/fishing.js`), the **Ring race** (`src/minigames/rings.js`), the **Wing drop**
(`src/minigames/wingdrop.js`), **The shooting gallery** (`src/minigames/gallery.js`) and **Ink tide**
(`src/minigames/waves.js`), both played on foot with the blade and the fluid gun, the **Drum circle**, a
rhythm game (`src/minigames/drums.js`), and the **Sketch hunt** in the Signal Market
(`src/minigames/sketchhunt.js`), and **Chime pirates**, the rail shooter in space that is also the first flight to a new
world (`src/minigames/pirates.js`, below "Pirates between worlds").

## Playing one

- **The Debug menu** (Debug on the title, L in play) has a **Games** section
  (`src/world-picker.js` `gamesRow(games, state)`): each opens the game's page, `?game=<id>`, its best in the
  save beside its name (`gameBest`: a best of each difficulty shows the one chosen last).
- **In a world**, an arcade sign: `placeGameMarker(world, gameId, pos)` (`src/minigames/kit/marker.js`) stands
  a glowing post with "play …" on the interact button; it opens `?game=<id>&from=<level>`. The desert has
  Fishing's on the shore of the mineral basin (`desert-vistas.js` `BASIN`), the Canyon run's under the lavender
  cliffs by the rope bridge, the Ring race's and the Wing drop's on the shelves at the ends of the hanging
  bridge (`src/levels/desert.js`); the Signal Market the shooting gallery's on the west pavement a few steps from
  the start (`bazaar.js` `GALLERY_SIGN`, kept clear of the crowd); the Arena Ink tide's by the way in. A game
  may name its own: `markers: [{ level, at: [x, y, z], heading }]` (y `null`: on the ground), placed by `main.js`
  in that world (the drum circle's by the pilgrims' small fire in the Desert, a few steps from the child who
  sits there, whose "talk" would win the button; the sketch hunt's on the market's pavement; Dune skiing's on
  the crest of the tall golden dune north-west of the Desert's start, `[-108, null, 124]`; Sky steps' on the
  west rim of the Sky Stones' start plateau, `[-52, 40.33, -61]`: there the ground found from high up is not the
  plateau's, so its height is given). Stand at a sign and the button must say "play …" (QA: every sign checked,
  and Quit puts you back by it).
- **The Arcade** (`?level=arcade`, a developer's world in the Debug list): a sign for every game round one plaza, to
  try them one after another (below, "The Arcade").
- A game page skips the title (`save-slots.js` `DIRECT_PARAMS` has `game`) and plays in the save slot in use.
  It writes no position to the save (`main.js` `writeSave`), so the save still resumes where you left the world.

## How it runs

`src/main.js` builds the game's level instead of a world (`kit/world.js` `levelMetaFor`): the game's own
`build(scene)` generator under its host's id (`host`, default `'arena'`: the Arena's save corner, sound and
empty story; its beacon and the parked ship are taken out of the picture), or the level named by `world`.
Once everything is built, `MinigameRunner` (`kit/runner.js`) takes the traveller and the camera over: the
frame calls `minigame.update(dt, controls)` instead of `player.update` and the camera rig. The runner owns:

| phase | what |
|---|---|
| `intro` | the start card: name, blurb, one-line rules, the controls (the pad's in Xbox / PlayStation form when a pad is in use, else the keys; redrawn when the input changes), the best so far. A / × or Enter starts, B / ○ or Esc quits |
| `count` | 3, 2, 1, GO (`kit/flow.js` `COUNT`): the session runs and draws, without input |
| `play` | the clock (`ctx.time`, with penalties); Menu / Esc (or the ❚❚ button on a touch screen) pauses: Resume, Retry, Quit. The game's pause freezes the world as the full-screen menus do (`paused()`) |
| `finishing` | `ctx.finish()` was called: the score is kept, 1.7 s to coast |
| `results` | the score, its lines, the best, a "New best!" stamp (only for beating a best kept before); Retry (R) and Quit |

While a game runs the runner takes the pad's menu buttons (`padAction`) and the keys that would open the
worlds, photo mode, the scout, the sketchbook or lock-on; the game buttons (A / ×, the triggers, the stick)
reach the game through the merged controls only while it runs. **Quit** goes back to `?level=<from>` (the
place saved as you left), or to the worlds list.

**Scores** (`kit/scores.js`): `score: { kind: 'time' }` (lower is better, shown `1:23.45`) or
`{ kind: 'points', unit }`; kept in the save's flags as `minigame.<id>.best` and `minigame.<id>.plays`. A time
trial not finished keeps nothing; points count even when the lives run out. `recordScore` keeps a best only
above nothing (`keepable`: a run of 0 points is counted, never kept); `isNew` (the stamp) is a real
improvement over a best kept before, the first best kept is `first` (no stamp: nothing was beaten).

**Retry** starts a new session (`start` again after the last one's `end()`): what a session made for its run
(its skis, sprays, trails, fish, a drop's thermals) must leave with it, geometry and all, or every Retry piles
up GPU buffers. `kit/dispose.js` `disposeTree(...objects)` takes them out and disposes their geometries (the
materials are the cached `makeMaterial` ones); the runner does it for whatever went through `ctx.add`, a game's
`end()` for what it put in the scene itself (a `Dots`' mesh, a `Trail`'s). `src/foes.js` `remove` lets a foe's
shapes go too (each wave of Ink tide left them), and its floor warning's own glow material (`Telegraph.dispose`,
`materials.js` `releaseMaterial`: out of the cache; the outline is one shared material): 200 foes made and let go
leave the material count flat (`tests/minigames-waves.test.js`). QA: `renderer.info.memory.geometries` stays flat over three
Retries in every game.

## The Arcade

A developer's plaza for trying the games (`src/levels/arcade.js`, `?level=arcade`, `dev: true`, next to the Gadget
Yard in the Debug worlds list). A round paved court inside a ring of mushroom-capped pillars, a glowing basin and
a hooped spire in the middle.

- **The signs**: `kit/arcade.js` `arcadeSigns(GAMES)` puts one per game of the registry on a ring 14 m out, over
  270° from the south-west round the north to the south-east (the way in is the south), each facing the middle;
  a new game file gets its sign by itself. `placeGameMarker(…, { plate })` hangs a name plate on the post (the
  game's name and its best, `bestText`: drawn on a canvas when the level is built, so a new best shows on coming
  back). The interact button at a sign opens `?game=<id>&from=arcade`.
- **Coming back**: started from the Arcade, Quit is **Back to the Arcade**, `?level=arcade&back=<id>`
  (`arcadeHref`); the level puts the traveller at that sign's `stand`, facing it, and says `keepSpawn` so
  `main.js` does not move him to the place saved as he left.
- **The games board** (`src/levels/arcade-board.js` `ArcadeBoard`, the level's `quickMenu` as the References' list
  of views: `main.js` routes the pad to it and keeps the game still while it is open): every game, its line and its
  best; choose one to open it. Opened from the board by the way in (interact), **Tab**, **D-pad ↓** (the mount's
  call: there is no mount here), or the small "games" button (touch, mouse); B / ○ or Esc closes.
- **Next and previous**: `main.js` gives the runner `links: arcadeLinks(from, id)` (null unless `from=arcade`).
  The runner's `host.links` is generic: `{ quit: { label, href }, extra: [{ id, label, sub, href, step }] }`;
  the extra links are buttons on the start card, the pause card and the results (before Quit, under its label),
  and a link with a `step` is also **[ / ]** and **LB / RB** on any card. The Arcade's are Previous game and Next
  game (the games' order, round: `cycleGame`), each with the game's name under it.
- Tests: `tests/arcade.test.js` (a sign for every game file there is, facing the middle and in reach of its stand;
  the plaza built in node with its signs' interactables and the board; the way there and back; next and previous
  round all ten and back).

## How to add a game

One new file, `src/minigames/<id>.js`; the registry (`src/minigames/index.js`) finds it through Vite's glob, so
nothing else needs editing. (Restart a dev server started with `watch: null` to see a new file.) Its default
export:

```js
export default {
  id: 'kite', order: 3,                 // lower-case-with-dashes; order in the Games row
  name: 'Kite race', blurb: 'One line for the list and the card.',
  rules: 'One or two sentences: how to win, what costs you.',
  controls: { pad: [['Left stick', 'steer'], ['A / ×', 'flap']], keys: [['A  D', 'steer'], ['Space', 'flap']], touch: [...] },
  score: { kind: 'time' },              // or { kind: 'points', unit: 'pts' }, or { …, format: (v) => text }
  hud: { timer: true, score: false },   // what the HUD shows (default: by the score's kind)
  color: '#71d7cf',                     // the arcade sign's glow
  build: function* (scene) { …; return arenaLevel({ ground, spawn, name, hour, … }); },   // its own arena
  // or: world: 'desert' (an existing level; put the traveller where you want in start)
  start(ctx) { …; return { update(dt, input, { live, phase, t, raw }) {}, pause(on) {}, end() {} }; },
  // optional:
  options: [{ id: 'level', label: 'Difficulty', choices: [['easy', 'Easy'], ['hard', 'Hard']], default: 'easy' },
            { id: 'offset', label: 'Timing', min: -200, max: 200, step: 10, unit: 'ms', default: 0, hint: '…' }],
  bestBy: 'level',                      // a best for each value of that option (minigame.<id>.<value>.best)
  drives: false,                        // played on foot: the usual walking and camera, the game's update after them
  markers: [{ level: 'desert', at: [x, null, z], heading }],   // its arcade signs in the worlds
};
```

- `build` is a level builder like the worlds' (`yield` between big steps); `arenaLevel()` (`kit/world.js`)
  fills in everything a level needs (the desert's print sky, no reactions, the ship far away). Mark meshes
  that need no collision `userData.noCollide`.
- `start(ctx)` begins a run (and again on every Retry, after the last run's `end()`): put the traveller and the
  camera where they start and return the session. `ctx` has `scene`, `camera`, `player`, `physics`, `level`,
  `sound`, `wind`, `sfx` (`kit/sfx.js`: tick, coin, gate, miss, jump, spring, land, crumble, checkpoint, hurt,
  finish, lose), `time`, `addTime(s)`, `score`, `setScore`, `addScore`, `setLives(n, max)`, `status(text)` (the
  `setFov(f)`, `speed(k)` (ink streaks at the screen's edges), `add(object)` (taken out on Quit), `best()`,
  `state` (the save: `flag(name)` / `set(name, value)`, for what a game keeps besides its best).
- An arena is `peaceful` (`arenaLevel`): no ink blots come out of the sand in a game (`src/foes.js`).
  right-hand box), `flash(text, 'good' | 'bad' | 'big')`, `finish({ score, failed, title, lines, html, wide })`
  (`html`: a block of the game's own on the results, `wide` a wider card: the sketch hunt's page), `kick(k)`,
  `setFov(f)`, `speed(k)` (ink streaks at the screen's edges), `add(object)` (taken out on Quit), `best()`,
  `option(id)` (the start card's choice), and the world's own: `rig` (the camera rig), `capture(eye, look, w, h,
  { fov })` (a frame drawn from another viewpoint, a JPEG data URL: main.js `captureView`), `npcs`, `crowd`,
  `wildlife`, `flora`, and `people` (`{ lib, humans }`: what a game's own `NPC`s are made of).
- **Options** (`def.options`, `kit/flow.js`): rows of choices or a stepper on the start card, kept in the save's
  flags (`minigame.<id>.opt.<option>`); changing one starts the session again with it. `bestBy` keeps a best of
  each value. `hud.countdown: s` shows the time left of `s` seconds in the clock's box instead of the time taken.
- `update`'s third argument has `raw`, the merged controls (a game reading buttons of its own: the drum
  circle's four face buttons, `PadJump` / `PadE` / `PadEvade` / `PadGadget`); `pause(on)` is called when the
  pause card opens and closes (the drum circle stops its song and picks it up again).
- `update(dt, input)`: `input` is `kit/input.js` `readInput`: `x`, `y`, `jump` / `jumpPressed` / `jumpReleased`,
  `action` / `actionPressed`, `tuck` (RT / R2 or Shift: where they mean the same), `trigger` (RT / R2 alone),
  `boost` (Shift, RB / R1, L3 on a pad, the touch screen's run toggle: the Ring race's boost), `brake` (LT / L2,
  the stick pulled back).
- **A touch screen** (`def.touchButtons`, `kit/flow.js` `touchButtons`): the on-screen buttons a game keeps
  (`'jump'`, `'run'`, `'aim'`, `'fire'`, `'blade'`, `'guard'`, `'evade'`, `'lock'`, `'mode'`, `'use'`, `'ping'`,
  `'book'`; src/ui.js `TouchControls`), the others hidden while it runs; default jump and run for a game that
  drives, all of them on foot; `[]` none (the drum circle's sockets are tapped). They are hidden while a card is
  up, and on a short screen (a phone held sideways, under 560 px) the card is compact, its buttons always in
  sight. `controls.touch` names them by their glyphs (⤒, run, ◎, ✺, ⚔, ◇, ↶, ◉). It is
  `NO_INPUT` until GO and after the finish. Move the traveller yourself: set `player.pos`, `vel`, `heading`,
  `onGround` and call `player.finishFrame(dt, speed)` for the clips (the platformer), or pose the rig
  (`player.char`) and call `player.humanoid.update()` (the skier).
- **Gear for the run** (`kit/gear.js` `lendItems(ids)`): the registry (`src/items.js`) answers yes for the
  lent items until the returned function is called (the session's `end()`), so the fluid tool draws the tank,
  the jets' nozzles or the wings on the back; nothing is written to the save. Set the traveller's own flight
  state for the pose and the sound (`player.jetFlight`, `thrusting`, `jetPower`; `gliding`, `glideTurn`) and
  call `player.finishFrame(dt, speed)`.
- **On foot** (`drives: false`): the usual play runs (walking, the blade, the guard, the evade, the fluid gun,
  the lock-on on R3 / Tab) and the session's `update` comes after the camera; `ctx` also has `tool`, `foes`,
  `rig`, `settings`, `state`. `body.mg-onfoot` keeps the crosshair. `kit/onfoot.js`: `lendTool(tool, { max,
  delay, mode })` lends the backpack for the game (worn and full even on a save that has not found it; its tank's
  size held against the save's upgrades; `back.set({ max, delay })` for a boon; `back()` puts it all back),
  `tune(table, changes)` changes a tuning table (BLADE, EVADE…) for the game, `standAt(player, pos, heading, rig,
  yaw)`. `kit/labels.js` `WorldLabels`: a "+20" floating up from a point, a speech balloon, a label over a thing.
  `hud.countdown: s` shows the clock counting down. A game's page tells no story (its host's goal is not reached).
- Keep the rules pure where you can (a step function on plain objects) and test them in
  `tests/minigames.test.js`; play the game in headless Chrome through a virtual pad (override
  `navigator.getGamepads`; setting `window.input.stick` every frame does not work: main.js latches taps).

## Dune skiing (`ski.js`)

A kilometre of dune (`courseHeight`: a valley wandering down the fall line, rollers, four lips at the ends of
the steep pitches, dunes beyond; a 1400 m terrain at 2.5 m cells, whose exact mesh height is the ground). The
skier is `skiStep`: gravity along the slope, the edges killing the sideways slide and turning most of it into
speed (`SKI.keep`: a carve keeps its momentum; a skid on LT / L2 does not), drag cut by the tuck (about
75 km/h standing, 105 tucked on the average slope), take-off when the ground falls away faster than a body
thrown along it, a pop on A / ×, spins with the stick in the air, landings clean within ~52° (a spin landed
clean takes a second off) or sloppy (most of the speed lost). Seventeen gates on alternate sides
(`courseGates`; a miss +3 s), pennants turned teal as passed. Sand sprays off the edges (the fluid tool's
`Dots`), the field of view widens with the speed, and past the line the camera swings round to the front.

## Sky steps (`platformer.js`)

A course of stones in a plane (z = 0), seen from the side with a long lens (36°). The course is data
(`COURSE`: blocks, one-way slabs, drifting stones, crumbling stones, springs, 40 glyph coins, three banners,
the gate) and its world is pure (`PlatWorld`); the body is `platStep` (`PLAT`): run 8.6 m/s, a 2.9 m jump cut
to half its rise when the button is let go, more gravity on the way down, coyote time 0.11 s, a 0.13 s jump
buffer, carried by drifting stones, thrown by springs (higher with the button held). A fall below the course
costs a life and starts you at the last banner; out of lives ends the run with the glyphs' points. At the gate:
10 a glyph, 50 a life left, and (60 − seconds) × 6. The feet stand on the stones through a ground of the
course's own (`player._feetGround`). `botInput` plays the course; the tests run it at 120, 60, 30 and 20 fps
and require the gate with no fall.

## Canyon run (`canyon.js`)

The hoverbike (`src/bike.js` `buildBike`, the desert's own model; the rider posed as `animateRiding` does) round
the Rose Canyon, three laps. The canyon is one closed loop (`makeTrack`: a ring of 172 m wobbled by three sines,
1024 samples, about 1.24 km round) and `nearest(track, x, z)` gives any place's `s` along it and `d` across it
(> 0 outward). On it `profileHeight(K, s, d)`: a floor 20–32 m wide that rises and falls, a sand bank 4.5 m wide,
then cliffs 7 m out to a plateau 20–35 m up; two chasms right across (13 and 15 m) each after a wooden kicker
3.4 m high; four sand drifts covering 55–60 % of the floor from one wall (a sand fence on each crest). The ground
is a 720 m terrain at 2 m cells whose cliffs stand 4 m further out (`shift`) behind banded strata faces built
on the loop, so the coarse triangles never poke through; natural arches span the canyon, hoodoos line the rims.

The bike is `bikeStep` (`BIKE`): the desert bike's throttle, steering, drift and hover spring on that height,
a hop on A / × that flies free of the spring (12 m/s: it clears a drift), the bank's sand dragging harder the
higher you ride up it, the cliff's foot throwing you back (the speed × 0.55), a drift bogging you down (× 0.5),
a boost pad (four, pale plates with three ink chevrons) flinging you to 46 m/s with a 52 m/s top for 1.6 s, and
a fall into a chasm (`fell`: back at the last checkpoint, +2 s). Its own motor sound (a sawtooth through a
low-pass, by the speed), the jets' fluid trails (`src/trail.js`), sand thrown off the banks and the drifts.

The race is `raceStep`: five splits a lap (the fifth is the line) from the unwrapped progress, in order, so no
shortcut counts; each split is flashed against the best run's (`minigame.canyon.splits`, kept when a run beats
it) and each lap against the best lap (`minigame.canyon.lap`). `botInput` drives it (the middle, onto the pads,
round the drifts): the tests run it three laps at 120, 60, 30 and 20 fps (about 1:42, no wall, no fall).
`window.__canyonBot = true` lets it drive the page (the screenshots).

## Fishing (`fishing.js`)

Three minutes at the end of a pier over the Still Oasis: a 300 m arena of dunes round a pond 27 m across
(`oasisHeight`, its bed 4.6 m deep in the middle), drawn by the water's own look (`src/water.js` finds the mesh:
the bed's bands, the foam at the shore and round the pier's posts, the rings), palms, reeds, lily pads, two
leaning monoliths and a stone ring across the water. The traveller sits on the pier's end, legs over the water;
the rod is six segments from the hand that bend toward the fish, the line twelve that sag when it is slack.

- **Cast**: hold A / × (Space) and the meter swings up and down (`castPower`, 1.3 s a sweep); let go and the
  float flies `castDistance` = 4–22 m where the stick aims (±0.6 rad), a ring on the water showing where.
- **The bite**: the pond's fish are printed shadows that wander their zones (shallow, mid, deep). One within
  8.5 m of the float comes to it; it nibbles (`biteSchedule`: its kind's count, the float dips, small rings),
  then takes the bait (the float goes under). Strike in its kind's window (0.34–0.6 s, `hookResult`); too soon
  and it takes fright, too late and the bait is gone. A / × while waiting reels in.
- **The fight** (`fightStep`, `FIGHT`): the fish rests and runs, each run one way or the other (its `turns`),
  some leap (the line jerks unless you give slack). RT / R2 reels; the tension rises with the reel and the fish's
  pull and falls with the stick held against the run (which also tires it and gives less line). Over 0.8 the
  line glows red and strains (a second of full red snaps it); a slack line for 2.2 s lets it slip the hook; 40 m
  out it is gone. In at 1.3 m: landed.
- **Eight kinds** (`SPECIES`): glass minnow, lantern carp, ribbon eel, whistling perch, bishop fish, sky-eye ray,
  shellback, and the Old Hermit (rare, 11–16 kg, a little house on its back), each its own model, weights
  (`rollWeight`, the heavy rarer), pull, speed, stamina, rests, runs, nibbles and strike window; the deep holds
  the heavy ones (`pickSpecies`).
- **Score** the weight landed (`score.format`: `4.3 kg`); a fight under way when the time runs out is finished.
  **The journal** (`recordCatch`, `minigame.fishing.journal`: `{ id: { n, best } }`) is drawn in the corner,
  each kind's heaviest; the catch is held up on the line with a card ("new in the journal").
- `botFight` plays a fight well (reels when easy, eases off at 0.66, holds against the runs): the tests land
  every kind with it, snap the heavy ones reeling flat out and lose them all left slack. `window.__fishBot = true`
  lets it fight in the page.
## Ring race (`rings.js`)

The Needle Field: a sand floor (`fieldHeight`), about a hundred sandstone needles (tapered columns of beds,
some with a hoodoo's cap, `courseField`: seeded, a pair flanking nine of the rings, the rest anywhere clear of
the flight line by 14 m), seven floating rocks round the high part, a start mesa with a pad. Twenty rings
(`RING_POINTS`, hand-placed: a slalom down the field, a climb to 110 m, a dive to 30, the long way home; 50 to
110 m apart, about 1.6 km), each `{ c, n, R: 6.5 }` facing along the line. The flyer is the jets' own model
(`flyStep`: `jetSteer`, `jetNose`, `jetStep`, `jetDroop` from `src/player.js`, `boost` on all the way: the
race-tuned jets fly at 31 m/s), lifting off the pad on the first squeeze. The tank burns `RACE.burn` (0.09) a
second at full throttle (about 11 s), each ring gives back `RACE.topUp` (0.28); dry, you glide.
`raceStep`: the rings in order; the next one passed or missed (`crossRing`: through its plane within R, or
within 6 R outside it), or one of the two after it went through (those between are missed: +5 s each).
`hitAt`: the sand, a needle or a rock with the body's 0.7 m reach is a crash: +3 s, again from the last
ring passed, flying on its way, the tank at least 0.4 full. The boost (`boost`: Shift, RB / R1, run on a touch
screen) flies at `RACE.surge` (1.28) of the jets' speed for `RACE.surgeBurn` (2.1) the burn: 31 m/s to 40, the
tank in about 5 s instead of 11 (under thrust `jetStep` is linear in the velocity: the surge flies it scaled).
Boosting on the straights with a quarter of the tank kept back is worth about 4 s on the ~54 s course (the tests'
pilot: 50.0 s against 53.9, never dry); boosting every straight to the last drop runs dry and glides for ~4.5 s,
losing most of that; boosting all the way runs dry and comes down. The camera chases behind the nose (tipped with it,
rolled a third of the bank); the arrow hangs at the top of the view (4.2 m ahead of the camera) pointing at
the next ring. **The ghost**: the run's track every 0.1 s and its ring splits, kept on this device
(`localStorage` `moebius.minigame.rings.ghost`, `packGhost`: ~8 KB) when it beats the ghost or the best; the
next runs fly it beside you (`ghostAt`) and flash the split at each ring. `botInput` flies the course; the tests
run it at 120, 60 and 30 fps and require every ring, no crash, about 55 s.

## Wing drop (`wingdrop.js`)

The Painted Mesa (`MESA`: r 36 m, its top at 62 m) with a bullseye painted on it (`TARGET.bands`: 1.6, 6, 11,
17, 24 m), smaller mesas and needles round it. Three drops a round (`dropPlan(i, seed)`, a new seed each
round): a start 280–370 m out and 130–160 m over the top, a wind of 1.5 m/s on the first growing to 5 on the
last (which blows mostly against you), three thermals between (r 15–21 m, lift 5–7 m/s, up to 230 m over the
top) and three star gates (one high in the first thermal, one off the line, one on the final approach).
The glider (`glideStep`, `WING`): a free fall to 44 m/s until A / × opens the wings (by themselves at 45 m
over the ground: −50 style); then an airspeed the stick asks for (12 neutral, 21 full forward, 4.5 full back),
a sink least at 11.5 m/s (2.4 m/s: a glide of about 5 to 1) and growing with the square away from it,
the thermals' lift (`thermalLift`: strongest in the middle, nothing past the edge or over the top), the wind
carrying you. The flare: the stick back within 4 m of the ground (fading out by 10 m) holds the sink off while
the speed lasts, so pulled in the last metre or two you touch down at ~1.5 m/s; too early and you are slow
and sinking again by the time you land. Flown into the mesa's side under its rim, the wings fold and you fall.
Landed, the camera is `landingShot` (`LANDING_SHOT`): up and back on the far side of you from the target's
middle, looking down over you at the bullseye; on the last drop the look is moved aside so you stand in the
left third, clear of the results card. While the camera is inside a thermal its swirls are left out (a stroke a
metre off the lens is a wedge across the view) and more motes rise round you instead. The star gates are
R 5.2 m; `starPilot` (a pilot for one or every star: climbs in the thermal under the high one, swings out and
comes back through along the gate's way, S-turns off height) shows each star of each drop can be flown through
(`tests/wingdrop-stars.test.js`), and threads the high star in the page through the virtual pad.
`scoreLanding`: aim `500 × (1 − d / 24)^1.2` on the target (+100 in the bull; 25 on the mesa off it), style 200
for a landing soft (`vy` 1.5 m/s or less) and slow (5 m/s or less across), a tumble (`vy` > 7) no style and half
the aim, 100 a star. The swirls are dashed ink helices round each column, turned at the lift's rate so they
seem to rise, drawn as pale hairlines while the camera is inside one. `botInput` (opens at once, glides at the
target, circles off height it has too much of, flares at 1.4 m) lands every drop of three seeds on the mesa,
gently, at 60 and 30 fps.
## The shooting gallery (`gallery.js`)

A fairground stall of the Signal Market (its paving, its plaster, its striped valance, a lit sign, shopfronts
round it), built as its own little level; the afternoon sun comes from over the shoulder into the booth
(`lightAt`). The traveller stands behind the counter (`STAND`, held there) with the stall's tank lent: six shots,
full again a second after the last (`GALLERY.tank`). Painted cutouts (`cutout`: fish and birds with bullseyes,
ink-blot figures, and the friends: Auntie Lumé under her parasol, a cat) slide along two brass rails or flip up
behind a low fence; four plates spin on sticks (they shatter and come back), two bells swing from the beam on long cords (`BELLS`: down at ~4.3 m, in the view
over the rails)
(`swing`). `GalleryDirector` says what comes out when over the minute (`galleryPlan`: busier toward the end, the
last 15 s with golds every 4 s and faster rails). Scoring is `scoreHit`: rail 10, fast rail 15, pop-up 25,
plate 20, bell 30, gold 100, friend −50; the multiplier (`comboMult`) goes up a step every three hits in a row
to ×5, and a miss ends the run. A shot is a miss when no target takes it within 1.5 s (`ShotLedger`, from the
tool's `tool:fire`). The stallkeeper, a round barker in a boater with a speaking-trumpet, calls out
(`KEEPER_LINES`, every line toned) in the market's patter (`planLine`, lang `bazaar`), in a balloon. A bot in
headless Chrome (hold LT, turn the rig toward the next target with a lead, pulse RT) scores about 1,500.

## Ink tide (`waves.js`)

A basin of sand (`basinHeight`: a flat floor, a low rim, the shore down under a sea of ink whose tide lines close
in while a wave is on), six broken pillars for cover, four ink springs. The game's foes are its own
(`level.foes.own`: on whatever the Enemies setting, nothing from the wilds, `noInk`: the blade does not grow from
them, src/foes.js). `waveKinds(n)`: a budget of `waveBudget(n)` (2 + 1.6 a wave) spent on the kinds come in so
far (`FIRST`: blot 1, spitter 2, swarm 3, machine 4, winged blot 5, shade 6, then the worlds' own kinds,
`src/foe-kinds.js`, one every wave or two: sign moth 7, dune ray 8, root stalker 9, salt crab 11, rust drone 12,
slag walker 14, glass golem 15, shadow hound 17; the new kind first, the heavier ones likelier later, a world kind
come in within two waves a little likelier; `COST`). Group kinds come whole for one cost (`GROUP`: five swarm,
three moths, two hounds). The crowd is capped (`waveCap`: 6 + n; Gentle 5 + n/4) by `heads` (a swarm's blots count
nothing, a golem counts as the three splinters it breaks into); Gentle (or Off) spends seven tenths, and the foes
themselves are gentle (src/foes.js `GENTLE`). They come up out of the springs farthest from you and keep after
you; whatever a foe breaks into (a golem's splinters) is adopted into the wave (`KILL.splinter`), so the wave is
cleared only when they are down too. Every kind works on the basin: the floor is sand (a ray swims under it and
bursts up), drones hover over it, and the hounds run as shadows among the six pillars' long shadows (the hour is
17.4). Style:
`KILL` points × the chain (`chainMult`: a quarter more for each foe cut down within 3 s of the last, to ×3), 30 a
perfect parry, 5 a block (`player.guard` heard), 100 a wave untouched; the score is `tideScore` (150 a wave
cleared + style). Between waves: 35% health back and three boons on plinths that rise ahead of you
(`boonChoice`, `BOONS`: a longer blade, a deeper tank, quick refill, a heavy hand, second wind, light feet, a keen
guard, and from wave 7 (`from`: once the moths have come) steady eyes, which cuts a flash's white and a harpoon's
or a root's hold as `Foes.blind` / `Foes.strike` land them (wrapped for the run, put back at its end);
`boonTunings` turns them into BLADE / EVADE / GUARD / FALL / tank values, put back when the game ends;
the longer blade is drawn longer too: `fluid-blade.js` builds the mesh at `BLADE.length` and stretches it each
frame to `bladeLength(state)`, the tuned length with the reach step on top):
walk onto one; after 14 s the next wave comes anyway. Knocked out, the run ends (the points kept).
## Drum circle (`drums.js`, the rules in `rhythm.js`)

A camp in a hollow of the dunes at dusk (its own arena): a fire in a ring of stones (`story/flames.js`), seven
logs round it, a goblet drum at each, tents. Six villagers drum on the logs and four dance, all `NPC` bodies
the game poses itself (`poseSeated`, `poseDancer`); the traveller sits on the near log with his own drum, his
hands the player's strokes. The **song** is the desert's (`score.js` D hijaz: the tanpura's drone, a sine
bass, the oud's riff, the ney's tune, the villagers' frame drum `darbuka` / `knock`, a shaker, a handbell; played
by `score-voices.js` and `Sound.instrument` into a bus of the game's own, the world's score hushed under it):
100 beats a minute, 34 bars in six sections (`SECTIONS`: a lead-in, the groove, the tune, a break, the whole
circle, the end), 82 s. The **chart** is written once at sixteen steps a bar (`BARS`: D dum, T tek, K ka, C clap,
B dum and clap) and thinned by `LEVELS`: Easy keeps the beats on three lanes (no clap; ka and clap folded onto the
others), Normal the eighths on four, Hard every step, chords included (121 / 172 / 205 notes).

- **Lanes** (`LANES`): the face buttons by position, A / × at the bottom (the dum), B / ○ right (tek), X / □
  left (ka), Y / △ top (a clap); the arrows or W A S D on the keys (the same diamond); a touch screen taps the
  sockets themselves. The glyphs (the PlayStation shape of their button in their Xbox colour) roll in along four
  spokes to sockets on the drum's ring (`ringLayout`), drawn on a canvas over the scene; the combo sits in the
  ring over the fire.
- **Timing**: the backing is scheduled on the audio clock 0.35 s ahead (a 40 ms interval and each frame, as the
  score's own `schedule`), beat 0 two beats after GO. The song time heard now is `heardSongTime`: the context's
  output timestamp (`getOutputTimestamp`: which context time leaves the speaker at which page time), else its time
  less `outputLatency + baseLatency`. A press is timed by its own event (`keydown` / `pointerdown` `timeStamp`, the
  pad's `timestamp` when it changed this frame), set against what was heard then, less the **Timing** offset (the
  start card's stepper, ±200 ms; the glyphs are drawn as heard, the offset moves only the judging). The results
  give the median error and the offset that would centre it (`timingAdvice`).
- **Judging** (`judgePress`, `sweepMisses`): within 50 ms perfect (100), within 110 ms good (40), a glyph 160 ms
  gone is missed; a press near nothing is a stray (the drum sounds, nothing breaks). Each hit in a row adds to the
  combo, ×2 from 10, ×3 from 20, ×4 from 30 (`multiplier`). `fervour(combo)` (0..1 over 40 in a row) is how hard
  the circle dances (the arms go up, the dancers turn on the spot) and how high the fire burns.
- **Pause**: the song stops (its bus cut) and picks up a bar and a half before where it stopped.
- `tests/minigames-drums-sketch.test.js` plays every level through with a perfect drummer at 60 fps (all perfect),
  a late and patchy one (goods, misses, the advice +80 ms), and checks the windows in pieces as the scheduler
  takes them.

## Sketch hunt (`sketchhunt.js`, the rules in `framing.js`)

Three minutes in the Signal Market (`world: 'bazaar'`, `drives: false`: you walk, run, ride the cabs as ever)
with a list of six things to sketch, drawn from `POOL` by `pickList`: one of each kind (an animal, a strange
plant, someone doing something, a landmark from a given side, a thing) and a sixth, a person always among them,
never the same twice; what the world can't show just now is left off. The subjects are the world's own: the
ticket finches and sign bugs (`wildlife`), the lamp flowers, strap palms, pipe blossoms and tin stars (`flora`),
the crowd at what they are doing (sitting on the kerb, leaning on a counter, on a skybridge seen from below,
talking in a circle: `crowd.people`' poses and groups), the silent tower from Signal Square or from far down the
avenue, a skybridge from right under it, the old sign, a cab in flight, a shop screen square on, a paper lantern.

- **The sketchbook**: hold LT / L2 (the right mouse button, R; the ✎ button on a touch screen) and the view goes
  to the traveller's eyes through the sketchbook's frame, looking where the rig looks (straight up allowed); LB /
  RB (the wheel, Z / C) zoom from 18° to 62°; RT / R2 (a click, G) sketches. A readout under the frame says which
  subject on the list it holds and how good a sketch it would be.
- **The score of a sketch** (`frameScore`, 0..1): its size (its radius over half the frame's height, against the
  subject's own `fill`, 0.6 by default, on a log scale), its centre (how far from the middle), and the side it is
  seen from (`from`: a direction and an angle; `'normal'` for each screen's own face) and where you stand (`eye`).
  Under 0.28 it is not a sketch of it. The readout and the sketch both ask the collision world and the crowd
  (`framing.js` `crowdInWay`: each body an upright capsule round its feet, sitters short; a dot product a body,
  so the readout asks it every time it looks) whether the subject can be seen; the sketch also asks what is
  drawn (a few rays through the scene: the stalls, the railings).
- A subject can be sketched again to do better. Each counts its best ×100; the whole list done early adds two
  points a second left (`huntScore`). The sketches are the frames (`ctx.capture`) turned to sepia ink on the
  page (`toSketch`), and the results show them as a two-page spread with their stars.


## Pirates between worlds (`pirates.js`, the rules in `pirates-rules.js`, the trip in `src/ambush.js`)

**Chime pirates** (v1.43), a rail shooter in space, is the flight between the take-off and the landing the first time
the ship goes to a world never visited: pirates are after the chimes aboard (the ship's voice: "They are after your
chimes!"). It is also an ordinary game (Debug → Games, the Arcade's sign: `?game=pirates`).

- **The rail** (`railPoint(s, u, v)`): the ship flies at `FLY.speed` (42 m/s) along a long gentle wander down -z
  (slopes under 0.3: `railX`, `railY`); it moves only across it, `u` right and `v` up within a 13 × 7.5 m box,
  steered as the jets fly (the stick forward dives; the "Invert flight" setting climbs). Everything that flies with
  the ship (the pirates, their shots, the bolts) is kept relative to it (`ds` ahead); the rocks, the mines and the
  repair rings hang still in space at an absolute `s`. Pure: `runStep(S, input, dt)` returns the step's events
  (`shot`, `kill`, `hurt`, `deflect`, `blast`, `lock`, `say`, `part`, `win`, `dead`, …), which the game draws.
- **The run** (`SCRIPT`, about 2½ minutes): skiffs in a sweeping line and in a V, raiders that overtake from under
  the ship and hold ahead, firing, a hauler laying mines, two teal repair rings, then the captain's galleon
  (`BOSS`): two brass gun pods (bursts of aimed shots), and once both are down the armoured bridge opens (rings of
  slow shots, skiffs from its hold). Left alone for `BOSS.stay` (75 s) it breaks off, and the run ends all the same
  without its bounty: a run always ends. Rock belts (`BELTS`, `courseRocks(seedOf(destination))`): one layout per
  destination, never a wall (the test checks every 60 m leaves most of the box open).
- **The ship**: six pips of hull (the runner's lives); a rock, a shot, a ram or a mine costs one, then 1.1 s
  untouchable (it blinks). A tap of A / × (Space, the touch ✺) fires the twin bolts; RT / R2 held streams them,
  slower; **held**, the shot charges (0.7 s) and locks the pirate nearest the aim (`findLock`, the coral LOCK
  brackets): let go and the gold shot homes in and bursts (9 m: everything in it, their shots too; a bonus for each
  kill past the first). **The barrel roll** (B / ○, LB / L1, X / □, Shift or E, the touch ↶) shoves the ship aside
  and turns shots away while it spins. Scores: `POINTS`; a pip left at the end is worth 50.
- **Gentler, fiercer**: the Enemies setting's gentle fires half as often and slower; each ambush met before
  (`ambushCount`) fires 6 % more often (`heat`, up to ten).
- **Drawn cheaply, no new shader**: the family ship's own model (`buildShipModel`, a quarter size, its rooms
  hidden); every pirate, rock, bolt, shot, spark and mote of dust is one of a few instanced meshes of the game's one
  material, coloured per instance (as the puffs and the dots are: the instancing variant every world compiles); the
  galleon a few plain meshes; the sky the City Floating in Space's look (its stars and nebula, `INK_SPACE`, the
  destination's planet ahead in its galactic-map colour), so the ink pass's parts are the ones that world compiles.
  Measured (headless Chrome on the Mac, High, 1280 × 720): **1.5 ms of CPU and 7.5 ms of GPU a frame, ~50 draw
  calls, ~55k triangles**, in the waves and against the captain alike (the City Floating in Space's start: 6.7 / 9.2
  ms, 600 calls); no program on the page that the City Floating in Space, the Arena or the Desert don't build.
  The traveller waits hidden under the start (the shadows are placed round him, off the action: nothing there casts).
- **The trip** (`src/ambush.js`): `ambushDue({ to, flag, seen, settings })` is true for the first flight to a world
  the journal has never seen (old saves have their worlds seen: no migration), not home or the Lantern, not with the
  setting off ("Pirates on the first flight to a new world", `settings.ambush`) or Enemies off. The ship's take-off
  asks main.js (`ship.departure(to)`) and goes to `?game=pirates&to=<world>&from=<here>` instead of the landing; the
  loading screen there is space's ink too (index.html). On that page main.js marks `ambush.<world>` 'met' at once (a
  crash or a closed tab never sends you round it again), 'won' on a win (`host.onResult`), 'skipped' on leaving
  otherwise; every way out lands at the world, `?level=<world>&via=ship`. The runner's `host.links` (`transitLinks`):
  the start card says where you are going and the ship's warning (`links.intro`), Quit is **Skip the fight**, a win's
  main button **Fly on to <world>** (`links.win`), and after two failed runs Skip comes first (`links.quit.mainAfterFails`,
  `kit/flow.js resultActions`).
- Tests: `tests/pirates.test.js` (the rail, the rocks, the pilot `botInput` winning at 120, 60, 30 and 20 fps in two
  to three minutes, an idle ship lost, the charge's lock and burst, the roll, the rings, the captain breaking off, the
  controls, the shapes), `tests/ambush.test.js` (which trips, the pages, the cards' buttons, the lines' tones, the
  wiring); the playthrough wins each ambush on the way (`tests/playthrough-agent.js shipTurn`) and checks that every
  first flight to a new world is ambushed and none home. `minigame.session.forward(t)` flies the run ahead by the
  pilot (the screenshots); `globalThis.__piratesBot = true` lets the pilot fly the page.


## Trials in the worlds (v0.98, `src/trials/`)

(With the makers' runs, the temples' kit in the open, they make the challenges: docs/systems/challenges.md.)

One optional **mastery trial** in each route world, built from what that world gives you, played where it stands
(not on a game page): the Desert's **Dune line** (the hoverbike, down into the basin), Vael's **Wind ladder** (the
wings up two columns of rising air and through rings between them), the Sky Stones' **Stone circuit** (the bird,
round the Needles, the great Table and the Monastery), Lorn's **Reed race** and Lorn II's **Lagoon laps** (the skiff;
the gust fan fills its sail), Viridel's **Eye garden** (eight sleeping eyes to splash), the City-Shaft's **Shaft
climb** (the wings, up the halfway air pillar from the middle terrace to the rim, v1.42; the jets before), the Glass
Dunes' **Glass slalom** (the Hangar's Pillar slalom that was), the Buried Machine's **Canyon dive** and the Signal Market's
**Avenue run** (on the jets until the jets became a debug item; on the wings since v1.43, each with columns of rising
air to climb again: the slalom four, the dive one on the rim and one at the canyon's end to climb out, the avenue one at
its head and one halfway), the Garden of Spheres' **Garden round** (on foot), and the three of v1.40 (the Underwater
City's **Tube run**, the Moon Foundry's **Floor round** and the floating city's **Courier's round**, on foot). No trial
wants the jets.

- **Data** (`data.js` `TRIALS`): mode, the sign, the start, gates (`[x, y, z, r]`, or `ground: true` laid `up` m over
  the ground or the water), eyes, wind columns, an easy pace (the par), the reward. **Rules** (`course.js`, pure): a
  gate is passed when the body's path this frame comes within its radius (`segmentDistance`), in order;
  `lacks` (the items, a mount found: the desert's bike only once uncovered), `inMode` (still on the mount),
  `parTime` (the course at the easy pace × 1.6 + 5 s: a first try that keeps going beats it).
- **In the world** (`index.js` `createTrials`, made by main.js): a sign (the arcade sign's model, in the trial's
  colour; a floating buoy in the lagoon, ridden up to) whose interact opens the start card. main.js makes a
  `MinigameRunner` for `trialGame(T)` (drives false: the usual play runs; its `navigate` just drops it, so Quit leaves
  you in the world). The session puts you at the line (on your mount if it wants one), holds you through 3, 2, 1,
  shows the next three gates (the next with a beam over it), counts gates or eyes, and ends the run if you are
  knocked out or off your mount for 3 s. The wilds' packs keep away while it runs. Gadgets stay in hand
  (`def.trial`): the fan into the skiff's sail.
- **Wind columns** (`winds.js` `WindColumn`): a temple Updraft in the open, a ring of stone at its foot; it lifts open
  wings and is a working (src/workings.js), so foes are thrown up by it too.
- **Best and reward**: the best time is the runner's (`minigame.trial-<world>.best`); the first finish sets
  `trial.<world>.done` and grants the reward (src/items.js items with `trial`), shown on the results card and the
  item's card. The rewards are upgrades to the gadgets (`upgrades.js` `UPGRADES`: the hook's line 34 m, a fourth
  bomb, a fourth spring bounce, five fan hops in the air, four boomerang locks, bubbles half as long again, half as much
  ink again in the pen, the magnet's reach 26 m, the lens clouding half as fast, 12 s of recall), set on the tuning
  tables while owned (`syncUpgrades`, before the gadgets are made and on every grant); the market's is a ribbon.
- **Fair courses** (`check.js` `checkCourse`): every gate in the open, the way between them clear, a ride with no
  wall or cliff on it (water all the way for the skiff), a glide never asking more than 1 : 5.2 without a column.
  `tests/trials-worlds.test.js` runs it in every world; `tests/trials.test.js` the pure parts.
