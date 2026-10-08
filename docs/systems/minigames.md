# Minigames

Small games played apart from the journey (v0.92): each in its own little arena built on the fly, or in a
corner of an existing world. The first two are **Dune skiing** (`src/minigames/ski.js`) and **Sky steps**,
the platformer (`src/minigames/platformer.js`); then the **Drum circle**, a rhythm game (`src/minigames/drums.js`),
and the **Sketch hunt** in the Signal Market (`src/minigames/sketchhunt.js`).

## Playing one

- **The worlds list** (Debug on the title, L in play) has a **Games** row under the pages
  (`src/world-picker.js` `gamesRow`): each opens the game's page, `?game=<id>`.
- **In a world**, an arcade sign: `placeGameMarker(world, gameId, pos)` (`src/minigames/kit/marker.js`) stands
  a glowing post with "play …" on the interact button; it opens `?game=<id>&from=<level>`. A game names its
  own: `markers: [{ level, at: [x, y, z], heading }]` (y `null`: on the ground), placed by `main.js` in that
  world (the drum circle's by the pilgrims' small fire in the Desert, the sketch hunt's on the market's pavement).
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
| `results` | the score, its lines, the best, a "New best!" stamp; Retry (R) and Quit |

While a game runs the runner takes the pad's menu buttons (`padAction`) and the keys that would open the
worlds, photo mode, the scout, the sketchbook or lock-on; the game buttons (A / ×, the triggers, the stick)
reach the game through the merged controls only while it runs. **Quit** goes back to `?level=<from>` (the
place saved as you left), or to the worlds list.

**Scores** (`kit/scores.js`): `score: { kind: 'time' }` (lower is better, shown `1:23.45`) or
`{ kind: 'points', unit }`; kept in the save's flags as `minigame.<id>.best` and `minigame.<id>.plays`. A time
trial not finished keeps nothing; points count even when the lives run out.

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
  `action` / `actionPressed`, `tuck` (RT / R2, Shift), `brake` (LT / L2, the stick pulled back). It is
  `NO_INPUT` until GO and after the finish. Move the traveller yourself: set `player.pos`, `vel`, `heading`,
  `onGround` and call `player.finishFrame(dt, speed)` for the clips (the platformer), or pose the rig
  (`player.char`) and call `player.humanoid.update()` (the skier).
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
  Under 0.28 it is not a sketch of it. The readout asks the collision world whether the subject can be seen; the
  sketch also asks what is drawn (a few rays through the scene: the stalls, the railings, the crowd in the way).
- A subject can be sketched again to do better. Each counts its best ×100; the whole list done early adds two
  points a second left (`huntScore`). The sketches are the frames (`ctx.capture`) turned to sepia ink on the
  page (`toSketch`), and the results show them as a two-page spread with their stars.

