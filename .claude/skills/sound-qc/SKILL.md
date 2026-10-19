---
name: sound-qc
description: Check that every player action and game event in Hiraeth is answered by a sound that is heard, sits in the mix, starts at once, is short enough and never machine-guns — the footsteps, jump, landings, roll, climb, wings, swimming, every cut of the blade (the press, the swings, hits landed, blocked, on armour), the shield, lock-on, the gun and the tool, hurts, the knock-out, potions, pick-ups, keys, chests, doors, levers, quests, the menus, the conversation's answers and the photo — by finding each in the code (browser and engines), rendering it on the in-memory Web Audio (engine/webaudio.js) with and without the recorded takes, driving the engines' build of the game with scripted keys, and checking the mix (the music, a voice over it, ducking, a fight's loudest moment); a table per action: OK / missing / too quiet / too loud / too late / too long / repetitive / alike. Use when the game "feels flat" or an action is silent, after adding a sound or an action, after touching src/audio.js, src/sfx.js, src/foley.js or engine/webaudio.js, for Unity sound parity, or before a release.
---

# The sound QC

Every press a player makes should be answered by a sound (game feel: docs/systems/audio.md, "Sound QC", the checklist
and its sources). The QC lists the actions (scripts/sound-qc/actions.mjs, found in the code: the bindings, src/foley.js,
src/fluid-blade.js, the tool and the glove's modes, the gadgets (fire, hold, switch), the foes and the fight temples,
the menus, the quests), and for each says whether the game asks for a sound,
how loud it comes out against the music, how soon after the press, how long, and how much its repeats differ.

Nothing is played out loud: every sound is rendered to numbers on the in-memory Web Audio (engine/webaudio.js, the
shim the engines play through). No browser, no device, no port.

## 1. Run it

```sh
node .claude/skills/sound-qc/run.mjs <scratch>/sound-qc [--only hit,the menus] [--no-drive] [--no-samples] [--score-ref]   # ~6 min
```

Node 22.12 or newer. On the shared Mac: while `uptime`'s 1-minute load is over 25, wait before running (it is one
node process, ~1 core). Writes `sound-qc.md` (the table and the mix) and `sound-qc.json` (every measure, the driven
calls); exits 1 while a key action (★) is not OK. `--only` takes ids or groups; `--no-drive` skips the game (the
quick loop while tuning a sound: ~1 min).

## 2. What it does

1. **The code.** Each action names where the browser's game asks for its sound (`web`: files and patterns, all must
   match) and the engines' (`engine`: `'shared'` for a module engine/game.js builds too, or its own wiring there). A
   sound wired in src/main.js only is missing in Unity until engine/game.js does the same. What the one game setup
   wires for both hosts (src/host/game-host.js: the hurts' answers, `hurtReactions`; the fight, `wireFight`: the
   potion, the drops, the flurry) is looked for there and in each host's use of it. tests/sound-qc.test.js fails when a
   pattern stops matching (issue #499: a refactor had turned six heard sounds "missing"): move the pattern with the call.
   The gadgets' sounds are their own synths in src/gadgets/ (`KIT`, actions.mjs `loadKit`), played on the Sound.
2. **Each sound alone** (scripts/sound-qc/render.mjs): the game's own Sound, calm, its score off, the call made, two
   seconds rendered (a cue four and a half) and the same render without it subtracted (the wind's bed); six takes on
   different seeds. Twice: with the recorded takes (public/sfx/, decoded by macOS `afconvert` into
   `$TMPDIR/hiraeth-sound-qc-takes`: what the browser plays) and without (the synth alone: what the engines play,
   engine/unity/music.js decodes only the music).
3. **In the game** (scripts/sound-qc/drive.mjs, scenarios.mjs): engine/game.js bundled and run in a bare V8 context with
   its sound on (what Unity runs), in the desert with its foes; a scenario presses keys as a player would (F the blade,
   Ctrl the guard, Alt the roll, Space, Tab, Q) and every call into the Sound is written down with its frame. The
   press column is the frame of the first call that counts, plus the sound's own onset.
4. **The mix**: the reference is what plays (Music: Always, issue #474): the desert's Suno recording, decoded by
   afconvert as the takes are, at the gain the engines give it (src/theme-levels.js; the browser's prepareSoundtrack
   measures the same), once round its loop through the music bus, the 95th percentile of its 50 ms windows. The
   procedural score is the fallback (no afconvert, or `--score-ref`) and is measured beside it (a Moment where no
   recording plays); the report also counts every verdict against the score, so the music's level and a sound's own
   are told apart. Then three worlds' recording and score, a conversation's voice alone, the music bus under a
   conversation (ducking), a fight's loudest moment (the heavy third landing as a blow lands on him).

## 3. Thresholds (scripts/sound-qc/lib.mjs, tested by tests/sound-qc.test.js)

Levels are K-weighted (the curve LUFS is measured through), the loudest 50 ms, in dB against the music's reference.

| role | band against the music | longest | what |
|---|---|---|---|
| impact | -12 .. +5 | 1.5 s | a hit landing, a block, a hurt, a hard landing |
| action | -18 .. +2 | 1.2 s | a swing, a jump, a roll, the shield, a shot |
| foley | -26 .. -8 | 0.8 s | footsteps, a grab, cloth |
| ui | -24 .. -6 | 0.6 s | the menus, the lock-on: short, quiet, one family |
| cue | -14 .. +4 | 4 s | a reward or a step done |
| warn | -26 .. -6 | 0.8 s | a warning that repeats (the heartbeat) |

- **too late**: over 30 ms from the call to its first sound, or over 100 ms from the press to it in the game (the
  ~100 ms of a response that feels immediate; the blade's press was 133 ms before issue #379: the wind-up was silent).
- **repetitive**: six takes within 1 dB and 2 % of brightness (spectral centroid) of each other: a sound that
  machine-guns. The recorded takes vary by their group's spread (src/sfx.js); a synth needs `Sound.vary()`.
- **alike**: two sounds that should differ (a hit and a block, a confirm and a back, a quest's start, step and end,
  the first cut and the heavy third) within 5 % brightness, 50 ms and 1.5 dB of each other.
- **too long**: to the last 50 ms within 30 dB of its loudest. **missing**: nothing asks for it, or silent when asked.
- No sample over -1 dBFS.

## 4. Reading it, and the usual causes

- **everything too loud by about the same**: the music's level, not the sounds (the recordings play about 7 dB under
  the procedural score round 1 balanced the effects to, issue #499): read the "against the procedural score" line for
  each sound's own fault.
- **missing in the engines only**: the call is made in src/main.js (BodyFoley, interactHooks, onDrink, waters): wire
  the same in engine/game.js. Check it there with the drive (the `press` column fills in).
- **too quiet in the engines only**: the browser hears a recorded take, the engines its synth stand-in (the hurt's was
  a 40 ms burst). Give the synth body: the same layers the recording has.
- **repetitive**: a synth with fixed frequencies: multiply them by `this.vary(0.06)` (±6 %, about a semitone).
- **a peak over 0 dBFS in the engines**: a gain left at its default 1 until its first event leaks into the block a
  source starts in (fixed in engine/webaudio.js, issue #379: scheduled events inside a block are sampled exactly).
- The levels are a guide, not the ear: listen on the music page (`music.html`, Effects) before believing a number.

## 5. Where it stands

docs/systems/audio.md, "Sound QC", holds the before / after tables of each round and what is left. When you change a
sound: run it before and after, put the table there, and the numbers in the changelog's media (docs/systems/changelog.md).
