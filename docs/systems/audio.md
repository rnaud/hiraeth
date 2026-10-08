# Sound and music

Starting the sound, musicians' solos, each world's score.

## Sound from the first frame (v0.39)

Each world is a new page, and browsers only let a page's sound start after a
press. `Sound.mayStart()` (`src/audio.js`) asks whether a context would run
now (`navigator.getAutoplayPolicy`, else a probe context's state); if so the
sound starts with the world, as it does in the Android app (its WebView plays
without a gesture). Otherwise it waits for the first key, click or pad press,
since a suspended context would only queue sounds to burst out at once. The
ship's arrival sets its engines every frame, so they come in even when the
sound starts partway through.

## Musicians' solos (v0.39)

Bands (`sound.setBands`) play on the score's beat around a place. A solo is
free-time: `sound.solo(pos)` (`src/audio.js`) plays `SOLO_TUNE`, three breaths
in a hijaz mode on one reed voice that glides into each note from a quarter
tone under, over a low drone, with a lot of reverb. It joins the bands for
distance and panning, and hushes the other bands and the score while it lasts.
In the desert, asking Bako to play emits `music:solo { who: 'bako' }` from his
conversation (`src/story/desert-data.js`), and `src/story/desert.js` starts it
at his seat.

## The score, world by world (v0.57)

Each world's music is data in `src/score.js` (`SCORES`): a mode on a root, a tempo and a
metre, a chord progression, an instrument palette, a percussion pattern, a colour of its
own and a short leitmotif. `scoreBeat(world, beat, act)` says what plays on a beat; it is
pure (a seeded random per beat), so `tests/score.test.js` checks it, and `Sound.schedule()`
(`src/audio.js`) plays it. The instruments are in `src/score-voices.js`: two or three
oscillators a note, detuned twins instead of LFOs where they can, nothing beyond what
Chrome / WebView 109 has.

| World | Mode | Tempo | Instruments | Leitmotif | Colour |
|---|---|---|---|---|---|
| Desert | D hijaz | 60, in 8 | ney, oud, reed drone, frame drum (walking) | "the tree drinks": up through the augmented second, back down like water | the city's slow bell |
| City-Shaft | F lydian | 80 | muted horn, vibes, walking pizzicato bass, brushes | "look up": through the raised fourth | the Lodestar's shimmer |
| Vael | A yo pentatonic | 46 | breathy shakuhachi-like flute, wind through stone, the stones' hum; no drums | "the waiting bird" | the bird's far cry |
| Vael II | B♭ dorian | 44 | the monks' drone, a choir, flute, hand bells; no drums | four notes falling like a bell's change | the great bell tolling |
| Sealed Hangar | C whole tone | 84, in 7 | soft analog lead, sequenced pulse, clock tick and tock | a question left hanging | the signal's three blips |
| Buried Machine | B hungarian minor | 54 | low brass drone and pad, horn, anvils, clanks | "one tooth a year": a semitone at a time | the wheel's tooth |
| Viridel | G mixolydian | 72, in 6 | harp, strings, flute, harmonium, water drops | a vine unfolding to the octave | the water clock's bell |
| Garden of Spheres | A major pentatonic | 60 | glass harmonica, bells, mallets, the pole's hum, the walking drum | the bell sphere's phrase, mirrored every other time | far voices |
| Lorn | E phrygian | 54 | wet-glass crystal drone, low clarinet, marimba, log drum and knocks | the crystal's phrase, round the flat second | an egg glowing |
| Lorn II | E♭ aeolian | 58, in 3 | oboe, clarinet, bassoon drone, marimba, woodblocks | "the lamps are kept": up to the fifth, waiting | a lamp lighting |
| Signal Market | E lydian dominant | 96 | street shawm, santur, electric piano, darbuka, claps, walking bass | "you are not alone": a call and its answer | radio call signs |
| Home | D♭ major | 54 | felt piano, strings, harmonium, kalimba | the father's theme, and the line that brings it home | a music box |
| Atelier | C major | 60 | felt piano, music box, strings | up to the octave, back to the fifth | a pencil on paper |

- **Form.** The music runs in sections of a few bars (`sectionAt`), six to an arc (about a
  minute and a half): `rest` (the drone and the colour), `open` (pad and motif), `grow`
  (pad, plucks, drums), `full` (everything), `memory` (the father's theme over the pad),
  `echo` (the motif's first half on the pluck), `thin`. The first arc is fixed (the motif at
  once, then the father's theme); later ones are drawn per world from a seeded random, so
  the order never settles into a loop. The motif shifts a step up or down, or an octave,
  from one statement to the next.
- **The father's theme** (`FATHER_THEME`): the charge's shape (`Sound.charge`), up a third,
  up to the fifth, down a step, back to the fifth. `fatherIn(score)` snaps it into each
  world's mode (in Vael it climbs to the fourth, in the Hangar's whole tone to the
  tritone); it plays in the first arc and in every other one after, on the world's own
  voice for it (the duduk in the desert, the bone whistle on Vael, a singing bowl in the
  Buried Machine...). At home it is the world's own tune.
- **Activity** (`Sound.follow`, eased each frame from `sound.update`): `move` (walking
  speed), `ride` (a mount, a vehicle, the wings or the jets), `still` (seconds standing),
  `indoor` (`src/shelter.js`), `night`, `storm`. Walking or riding adds the plucks and
  the drums to any section; after half a minute standing still the drums and bass drop out;
  indoors there are no drums, bass or colour; night and storms bring it all down. The
  Hangar and the Market keep a quiet pulse even standing still.
- **Levels.** `level` evens the worlds out (each renders to about -27 dB RMS).
- **Offline renders** (`scripts/render-score.mjs`): the game's own `Sound` in headless,
  muted Chrome, an `OfflineAudioContext` swapped in, along a little walk (standing, walking
  from 10 s to 36 s, standing): `PLAYWRIGHT=…/playwright-core/index.mjs node
  scripts/render-score.mjs <outDir> [seconds]` writes `score_<world>.wav` (`MUSIC_ONLY=1`
  without the ambience and wind, `WORLDS=` to choose). It starts its own dev server (port
  5847).


## The Forest of Antennas' signals (October 2026)

The ambience `signals` (`AMBIENCE.antennas`): static crackling in clusters of two to six clicks on the beat
(`ambienceTick`), now and then a far signal tuning in (`tuning`: a thin sine gliding down to its note and wavering,
under a second), and the masts' hum: a 98 Hz drone and its second harmonic 196.6 Hz a little off, so it beats slowly,
through a low-pass, with a faint band of static over it (the `static` noise layer), its level the world's
`level.hum(pos)` (main.js passes it every frame: 0 on the open plain, ~0.5 by a mast, 1 under the receiver), halved
indoors. Quiet by design (the hum at most 0.022, the static 0.012): it sits under the score.

## The rails (the Overnight Train, October 2026)

A level that carries you on a train says so with `level.rails(pos)` → `{ speed, full, out, roof, whistle, halt }`
(main.js passes it to `sound.update` as `rails`; src/levels/overnight-train.js). `Sound.railsUpdate`:

- **the beat over the joints**: every 26 m of rail one carriage's two bogies pass a joint, two axles each, ta-dum …
  ta-dum (`clack`: a dull low knock and a short ring of steel), scheduled up to 0.25 s ahead on the audio clock so the
  beat stays even; its period is 26 m over the speed, so it slows as the train brakes and stops at a halt;
- **the rumble** (a noise layer low-passed at 90–210 Hz) and **the rush** of the air (band-passed 0.7–1.6 kHz), both by
  the speed, louder outside (`out`: the balcony, the porches, the deck; `roof`) and softer indoors (shelter);
- **the whistle** (three sawtooth notes through a band-pass, swelling and falling over 2.4 s) each time `whistle`
  counts up: the level counts one as it pulls out of a station and one as it starts to brake;
- the world's ambience is `rails`: now and then another train's horn far across the plain while it runs.

## Recorded soundtracks (v0.94)

`src/soundtracks.js` maps completed worlds to local MP3s in `public/music/`.
`manifest.json` records each Suno source and musical direction. Only the current
world loads after audio starts. Decode/download failures retain the procedural
score, including on engine bridges without an audio decoder. The title keeps its
own music. Recordings are balanced to -27 dB RMS (with a peak cap), with the last
two seconds crossfaded into the opening for looping, then faded in over two seconds.
They use the existing music bus: volume, mute, menu hush, musician ducking,
underwater filtering and background suspension still apply. Ambience, bands and
combat continue independently. Disposing a world cancels its outstanding download.

## Scoring the moments (October 2026)

With a recorded theme loaded, Settings > Music plays decides when it plays. **Moments** (the default)
keeps it for arrivals, interiors and moments, and lets the ambience carry the open world between them;
**Always** plays it all the time, as before. `MusicMoments` (`src/music-moments.js`, pure) holds the
state; `Sound.musicMomentsUpdate` (from `sound.update`, every frame) turns it into the recording's fades
(in over 3 s, out over 10 s; a theme stopped after its fade starts again from its opening).

- **Arrival**: the theme plays for 150 s from the world's first sound.
- **Indoors** (`s.indoor`, src/shelter.js): it plays, and lingers 20 s after you step out.
- **Moments** (`sound.musicCue('moment', { delay })`, 110 s): a story moment's `swell()` (after its
  phrase), the father's `charge()`, a box's `fanfare()`, `homage()`, the spheres' song, a relic found
  (src/quest.js), a world's story done, a keepsake (`game.on('keepsake')` in main.js).
- **Back by itself**: after 5 to 8 minutes of quiet it returns for 90 s.
- **Between**: the procedural score plays only its light layers (`lightScore`: drone, pad, a sparse
  pluck, the colour, the echo, all softer; no melody, bass or drums), over the ambience. Before the
  recording has loaded, or without one, the full procedural score plays as before.

`tests/music-moments.test.js` checks the state machine and the light layers.

## Recorded effects: the body's foley (October 2026)

The traveller's body used to be silent apart from the synthesised footsteps. Now it is heard through a
small bank of CC0 recordings (`public/sfx/`, 74 mono MP3s at 64 kb/s, about 360 KB; sources in
`public/sfx/manifest.json` and docs/credits.md), with the synth as the fallback.

- **The bank** (`src/sfx.js` `SampleBank`, `sound.bank`): `SFX` lists each group (its takes, level and
  pitch / level spread). `Sound.start` preloads it 0.8 s in, four files at a time; a group asked before
  it is ready starts loading and returns false, so the caller plays its synth. A failed fetch or decode
  (offline with a file missing, an engine bridge with no decoder) stays on the synth. Every play takes
  the next of a shuffled round of takes (never the same one twice running) with a little random pitch
  and level, so footsteps and combos never machine-gun. Everything goes into the effects bus: the
  Effects volume and mute apply. `sound.sample(group, { vol, rate, at, pos })` pans toward `pos` and
  softens it with distance (`placeAt`).
- **When** (`src/foley.js` `BodyFoley`, `foley.update(player, dt)` in main.js): it watches the player's
  state from frame to frame and calls the Sound's `jump`, `land` (both feet on the level profile's
  ground, stone, grass or sand, then a body thump scaled by the fall speed, a spray of sand on sand),
  `grab` (the climb), `mantle`, `wings` (open / fold), `jets` (lighting), `evade` (the roll),
  `knockdown` and `getUp`. Hurts come from Player `onHurt` (`sound.hurt`: a pained grunt or a sharp
  breath, and the blow on the body), pick-ups from `interactHooks.onUse` (src/interact.js: prompts
  that pick up, take, gather or collect) and relics.
- **Breaths** are soft and occasional: about one jump in five, more when out of stamina, often on a
  mantle, sometimes on the third cut, never two within 4.5 s (`FOLEY.breathGap`); voices never overlap
  (`Sound.vocal`).
- **The blade**: each swing has its whoosh by the combo's step (the third a heavier, lower one), a hit
  a wet ink splat and a body blow (heavier on the third), a block a splat and a knock, all layered over
  the fluid's own synth. Footsteps, swimming strokes, splashes, the box's creak and knocks and the
  bird's wingbeats use the recordings too.
- `node scripts/sfx-build.mjs <sources>` remakes the files from the downloads (sox and lame); the
  recipe in it names every source. `tests/sfx.test.js` checks the files, the variation, the round
  robin and the fallback; `tests/foley.test.js` the events.
