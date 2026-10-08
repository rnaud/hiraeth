# Minigames

Small games played apart from the journey (v0.92): each in its own little arena built on the fly, or in a
corner of an existing world: **Dune skiing** (`src/minigames/ski.js`), **Sky steps**, the platformer
(`src/minigames/platformer.js`), the **Canyon run** (`src/minigames/canyon.js`) and **Fishing**
(`src/minigames/fishing.js`).

## Playing one

- **The worlds list** (Debug on the title, L in play) has a **Games** row under the pages
  (`src/world-picker.js` `gamesRow`): each opens the game's page, `?game=<id>`.
- **In a world**, an arcade sign: `placeGameMarker(world, gameId, pos)` (`src/minigames/kit/marker.js`) stands
  a glowing post with "play …" on the interact button; it opens `?game=<id>&from=<level>`. The desert has two
  (`src/levels/desert.js`): Fishing on the shore of the mineral basin (`desert-vistas.js` `BASIN`), the Canyon run
  under the lavender cliffs by the rope bridge.
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
  start(ctx) { …; return { update(dt, input, { live, phase, t }) {}, end() {} }; },
};
```

- `build` is a level builder like the worlds' (`yield` between big steps); `arenaLevel()` (`kit/world.js`)
  fills in everything a level needs (the desert's print sky, no reactions, the ship far away). Mark meshes
  that need no collision `userData.noCollide`.
- `start(ctx)` begins a run (and again on every Retry, after the last run's `end()`): put the traveller and the
  camera where they start and return the session. `ctx` has `scene`, `camera`, `player`, `physics`, `level`,
  `sound`, `wind`, `sfx` (`kit/sfx.js`: tick, coin, gate, miss, jump, spring, land, crumble, checkpoint, hurt,
  finish, lose), `time`, `addTime(s)`, `score`, `setScore`, `addScore`, `setLives(n, max)`, `status(text)` (the
  right-hand box), `flash(text, 'good' | 'bad' | 'big')`, `finish({ score, failed, title, lines })`, `kick(k)`,
  `setFov(f)`, `speed(k)` (ink streaks at the screen's edges), `add(object)` (taken out on Quit), `best()`,
  `state` (the save: `flag(name)` / `set(name, value)`, for what a game keeps besides its best).
- An arena is `peaceful` (`arenaLevel`): no ink blots come out of the sand in a game (`src/foes.js`).
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
