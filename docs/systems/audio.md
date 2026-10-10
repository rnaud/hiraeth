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

## The hum (v1.0)

Everyone on the route talks about humming (the chest on the great tree, Vael's stones, the bell, the
pole), and the scar on the hull beats in threes; before v1.0 nothing hummed. `Sound.makersHum({ vol, pos })`
(`src/audio.js`) is that one sound: a low sung D3 (two reedy oscillators a breath apart and the octave
under, a closed-mouth "mm" formant, a slow vibrato) that swells three times and lifts a fifth on the
third, about four seconds, about -34 dB at vol 1 (a footstep's loudness, under the score).
`makersHumRise(dur)` is the same voice growing in threes over `dur` and returns `{ stop() }`.
When it plays (`src/story/hum.js`, pure):
- the prologue: it rises under the father's charge (`callHum`, `callHumLevel`) while the picture
  breaks up, under the singing light's theme (below), carries on through the pause and the pass, and
  winds down with the ship's power; it sounds once more, faintly, with the ship's line about the
  magnetic signature (`src/ship/cinematics.js`);
- an unopened makers' box within `HUM.reach` (45 m) sings it every 8–12 s, louder near
  (`Sound.boxHum(k, far)`, from `src/boxes/index.js`);
- a line on the screen that speaks of humming (a conversation's line, the `words` event of
  `src/story/dialogue.js`; a subtitle or toast, `Cinema.onWords`; the balloon up) plays it at 0.7,
  at most once every `HUM.gap` (24 s: `HumCue`, main.js).
`tests/hum.test.js` renders it on engine/webaudio.js: heard (over -48 dB) and subtle (under -30).

## The singing light's theme (October 2026)

The light has a few notes of its own, so a player who heard it in the prologue knows it again. Pure in
`src/story/light-theme.js` (`LIGHT_THEME`, `lightThemeNotes`, `lightCues`, `lightEnvelope`), sung by
`Sound.lightTheme({ vol, transpose, bend, pan })` (`src/audio.js`).

- **The motif**: five notes in D lydian at 66 a minute, about six seconds:
  `A4 (1 beat) · D5 E5 (½ + ½) · G♯5 (2, glided into from a quarter tone under) · F♯5 (3, held, fading)`.
  It starts on A, the note the makers' hum lifts to on its third swell (D3 up a fifth), so the two are kin:
  the hum is the light's low breath, the theme its voice. It climbs through the raised fourth (G♯, the
  lydian note), and settles on F♯, the major third, unresolved. The father's theme (`FATHER_THEME`) is the
  same key and another shape: the light sings his key, not his tune (Ilen sang his message into it).
- **The voice**: one wordless high voice, legato, sliding between notes (a sine and a soft triangle a
  breath apart, an "oo" band-pass, a vibrato that opens on the long notes), a glass partial an octave over
  it, a lot of room. About -25 dB at the charge's volume (the score's level), the hum under it.
- **Where**: the prologue only for now (docs/systems/cinematics.md, "The restaged opening"): three times
  under the voicemail, nearer each time; once alone in the pause; once in the pass, loud, its pitch falling
  two semitones as it goes by (`bend`), panned left to right.
- **A recording replaces it without code changes**: `src/soundtracks.js` `CUES['singing-light']` is the
  slot (`public/music/singing-light.mp3`, packaged on devices: `ON_DEVICE_THEMES`). If the file is there it
  is loaded when the prologue starts (`loadCue`) and played once from the voicemail's start (`playCue`),
  its gain following the synth's rise (`lightEnvelope`: faint, nearer, nearest, alone, loudest in the pass),
  and the synth stays quiet. Add its record to `public/music/manifest.json` `cues` (`source`: the Suno
  link). `tests/soundtracks.test.js`, `tests/hum.test.js`, `tests/prologue-call.test.js`.

### The Suno brief

- **Title**: Hiraeth - The Singing Light. **File**: `public/music/singing-light.mp3`.
- **Length**: about 45 s, instrumental, not a loop (the opening plays it once: the voicemail 29 s, the
  pause 7 s, the pass 5 s, then out). Trim silence at the head to under 0.5 s.
- **Key and tempo**: D lydian, 66 BPM, free and floating (no drums, no pulse but the drone's).
- **Style** (the soundtrack's direction, as in `manifest.json`): `D lydian, 66 BPM; wordless high voice,
  glass harmonica, very quiet low D drone swelling in threes; a five-note call, distant then near,
  otherworldly and tender, Moebius dream sci-fi`.
- **Prompt**: "Instrumental, about 45 seconds, D lydian, 66 BPM, no drums, no lyrics. A single wordless
  high voice, a soft 'oo' like a wet finger round the rim of a glass, sings one five-note phrase: A4, then
  D5 and E5 quickly, a slow glide up into G sharp 5, settling on a long F sharp 5 that fades. Under it a very
  quiet low D drone that swells three times and lifts a fifth. The phrase comes three times, each nearer and
  louder (far and high, nearer, close), then once alone and clear over near silence, then a last time loud
  and bright as it rushes past, its pitch bending down, and fades to nothing. Lots of air and reverb;
  strange and tender, never menacing."
- **Timing to aim for** (seconds from the start; the game's envelope rides on top): first statement
  ~4.5 (faint, an octave up), second ~15, third ~21 (the charge), alone ~30 (the pause), the pass ~38,
  silent by ~45.
- **Check**: drop it in, replay the opening (`?level=desert&prologue=1`): the theme's statements should
  land under the father's lines and the pass should peak as the light goes by the window.

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

`src/soundtracks.js` maps completed worlds to local MP3s in `public/music/` (on a device only the desert's and the title's are
local; the others are downloaded once: "The themes on a device" below).
`manifest.json` records each Suno source and musical direction. Only the current
world loads after audio starts. Decode/download failures retain the procedural
score, including on engine bridges without an audio decoder. The title has its
own recording (below). Recordings are balanced to -27 dB RMS (with a peak cap), with the last
two seconds crossfaded into the opening for looping, then faded in over two seconds.
They use the existing music bus: volume, mute, menu hush, musician ducking,
underwater filtering and background suspension still apply. Ambience, bands and
combat continue independently. Disposing a world cancels its outstanding download.

## The title's music (October 2026)

The title screen plays its own recording, **Hiraeth - Distant Home** (`public/music/title.mp3`, `TITLE_THEME` in
`src/soundtracks.js`; `manifest.json` "title": made in Suno by the author, no song link, so `source` is null).
Direction: D lydian, 72 BPM, instrumental, no drums, meant to loop; glass harmonica and celesta carrying a slow
five-note call, warm low strings, a soft distant wordless voice, nylon guitar, hand bells, a quiet low D drone.
The file: 2 min 52 s, 48 kHz stereo VBR MP3 at about 164 kb/s (3.6 MB), as Suno gave it, less 0.6 s of
near-silence at the start (whole MP3 frames dropped, its Xing/LAME header fixed, not re-encoded). About
-18 dB RMS and -5 dB peak; it opens on a fade-in (full by 3 s) and ends on a fade-out over its last 3 s.

- **Start**: `new Sound('title', { score: false, titleTheme: true })` (`src/title.js`). The procedural menu
  music (`MENU_SCORE`, `menuMusic`) plays from the title's first sound; `Sound.start` also calls
  `loadTitleTheme`, which reads `music/title.mp3` (`themeSources`: the bundle's file, on the web the site's),
  decodes it and balances and joins it like a world's theme (`prepareSoundtrack`: -27 dB RMS with a peak cap,
  the last two seconds crossfaded into the opening).
- **Takeover** (`Sound.playTitleTheme`): the recording loops on the menu bus, faded in over two seconds while the
  procedural tune (its own gain, `menuSynth`, and its small room) fades out under it; its scheduler stops once
  the last notes have faded and doesn't come back. The recording goes into the bus dry. The menu bus keeps the
  music volume (`setVolumes`), mute and the guard (master), so the settings work as before.
- **Leaving**: `choose()` turns the menu music off (the bus fades out, ~1 s) and disposes the title's sound;
  the world's own sound (its theme, or the opening) starts in the game. Back on the title (a new page), it loads
  again.
- **Fallback**: a failed download, a file that doesn't decode, an engine bridge without a decoder
  (`engine/webaudio.js`), or the title gone before it arrives: the procedural tune simply goes on.
- **On a device** it is in the package (`ON_DEVICE_THEMES`), as the desert's is: it is the first thing a launch
  plays, so it must not wait for the background download.
- Level on the menu bus (measured in headless Chrome, music at 0.8): the procedural tune about -27 dBFS, the
  recording about -34, the same level as a world's recording on the music bus.
  Tests: `tests/soundtracks.test.js`.

## The themes on a device (October 2026)

The APK and the Steam Deck package carry one recorded world theme, the desert's (`ON_DEVICE_THEMES`,
`src/music-store.js`): the first world has its music offline from the very first session. They carry the
title's music too (above) and the singing light's cue. The other 24
(99 MB) stay on the site (`scripts/site-only.mjs` `leftOff`, the over-the-air zip too; the web build is
unchanged, it reads its own `music/`).

- **The download** (`themeDownloader`, started by the title and by every world after its first frame,
  `startThemeDownload`): every theme the device hasn't got, one file at a time, 1.5 s apart, at low
  fetch priority, from 8 s after the page is up (never during a load; each world is a new page, so a
  world's loading never shares the network with it). The world being played comes first. Each file is
  kept as a Blob in IndexedDB (`hiraeth-music` / `themes`, key: the file name). The music never
  changes (a new recording gets a new name), so nothing is checked again. Offline, with Data Saver, or
  when the site fails, it stops and goes on from the next missing file when the page is back online
  (the `online` event), two minutes later, or on the next open; a file cut off halfway is fetched again
  from its start. A full disk only means it tries later.
- **A world's theme** (`loadSoundtrack`, `src/soundtracks.js`): the bundle's (`music/<file>`), else the
  kept copy (`themeSources`); a copy that doesn't decode is dropped for the download to fetch again.
  Neither: the procedural score plays, and the theme comes in when the download lands it, through the
  moments (`trackOn` false, so `Sound.musicMomentsUpdate` starts and fades it in at the next moment the
  theme plays, `src/music-moments.js`), never on top of what is playing.
- **Installs from before** (every theme in the bundle): the download takes each from the bundle first
  and keeps it, without a request to the site (see `docs/systems/android.md`, "The music, downloaded
  once", for the one update that has to carry them for that).
- **Settings > Updates** (Android and the Deck) says "Music: 18 of 25 downloaded" while some are missing
  (`themeProgressText`), nothing once all are there.
- A device is `bundledGame()` (`src/levels/reference-sheets.js`): GeckoView's 127.0.0.1:41730, the
  WebView fallback's https://localhost, the Deck's moebius://game. Tests: `tests/music-store.test.js`.

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
  state from frame to frame and calls the Sound's `jump`, `land` (both feet on the surface underfoot,
  stone, grass or sand (below), then a body thump scaled by the fall speed, a spray of sand on sand),
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

## The surface underfoot, and the loud ones (playtest, 8 October 2026)

- **Footsteps follow the surface.** `Physics.groundAt` notes what its ray met in `physics.groundKind`
  (`groundKind(hit, b, hasBase)`): `'ground'` for the world's own (the heightfield, or the meshes of a
  world that has none) and `'built'` for a mesh standing on the heightfield (rocks, roofs, floors,
  stairs) or a collider added later (`addCollider`: the ship, rooms; `addMover`). The Player keeps it as
  `player.footing` each frame, main.js hands it to `sound.update({ footing })`, and `footSurface(level,
  footing)` makes it a surface: built is stone, the ground the world's `GROUND` (grass, sand, stone).
  `step` and `land` play it (`step(speed, { surface })` to choose). A world under a gravity of its own
  (the Spheres' little worlds) counts as ground.
- **The levels** (the game's own Sound rendered by engine/webaudio.js, the loudest 100 ms in dBFS;
  `tests/sound-mix.test.js` keeps them): the desert wind calm about -54, gusting while walking -47, a
  sandstorm -40 (`AMBIENT_WIND` 0.22); the mount's whistle -30 (`WHISTLE`), the train's -31; the water
  welling up (`waterRise`) -36; a synthesised footstep about -42 and the music about -27 for reference.
- **`waterRise({ dur, vol })`**: water or oil welling up: slowed noise through a low-pass that opens and
  surges, with small sine bubbles gliding up an octave; the desert's cave channel and city well and the
  Buried Machine's oil dish play it instead of the quest `whoosh`.


## The foes' voices (v1.22, the enemy roster's step 8)

Every archetype sounds like itself when a blow lands and when it comes apart (combat-v1.4 rec. 2: until v1.21 the
whole roster shared two sets, the machine's clang and the ink's splat). All synthesised on the Web Audio graph, no
samples: `src/foe-voices.js` holds the data, `src/audio.js` plays it.

- **`FOE_VOICES[kind]`**: `{ family, hurt, burst }`, the family being the archetype's `sound`
  (src/enemies/archetypes.js). A voice is a few layers of four recipes, each `at` s after the blow: `noise` (filtered
  noise whose filter can glide: a wheeze, a whoosh, steam), `tone` (an oscillator gliding: a yelp, a whine, a string),
  `ring` (struck partials: `GLASS`, `BRONZE`, `CRACKED`, `CLAY`), `clicks` (a run of short bandpass ticks: a clack, a
  rattle, paper crinkling). A hurt lasts under 0.4 s, a burst under 1.6 s.
- **The families**: the crab's **shell** (two hard clacks; the dome cracking and its legs clattering), the roller's
  shell (a knock and a glassy ring; a glassy shatter over a low rumble), the skitters' and the centipede's **chitin**
  (a beetle's tick; plates rattling down the body), the toad's **bellows** (a wheeze swept down; the sac popping and
  sighing empty), the lizard's **scale** (a hiss and a chirp; its horn's small blare), the heron's **clay** (a glazed jug
  knocked and a squawk; the jug breaking), the root knot's **roots** (wood creaking, a twig snapping; a splintering
  crack and a groan), the jelly's **glass** (a wet bloop and its lanterns ringing; a bubble bursting), the moth's
  **paper** (crinkling; paper torn and a lantern's tink), the ray's **hide** (a leathery slap; a long falling whoosh),
  the worm's **earth** (grit and a groan; sand pouring), the tripod's **steam** (an iron clank and a jet; the boiler
  bursting), the cart's **slag** (sizzling and the pot's dull bong; boiling over), the bell's **brass** (the bronze
  struck; the bell cracking, its partials pulled apart and beating), the drone's **tin** (its whine jolted and a plate
  pinged; the whine spinning down), the brute's **iron** (a deep cracked clang; a crunch and a rumble), the blot's
  **ink** (the old splat, kept), the shade's **cloth** (its empty cloak swished, a whisper; fluttering down with a sigh),
  the hound's **smoke** (a yelp and a huff; a howl into a splat), the marionette's **strings** (a string twanged and
  paper crumpled; the strings snapping one by one).
- **Calls**: `foeHurt(kind, sound)` and `foeBurst(kind, sound)` (src/foes.js passes the foe's kind and its def's
  sound; `voiceOf` falls back to the def's sound, the makers' machine's clang, then the ink's). **`foeGlance()`**: a
  blow that does nothing (a shot on armour, a cut off a shell or the bronze, a rolling shell): a spark's bright tick
  over a dull thunk, with the sparks (src/foes.js `Foe.hit` returns `'glance'` for a shot or an ember a kind takes
  nothing from, unless it does something else: the cart's crust, the shade or the hound lit).
- `sweep` and the struck partials set their gain silent before their first event (the engine's renderer starts a
  source on a block: no click at full level).
- Tests: `tests/foe-voices.test.js` renders every voice in memory on the engine's Web Audio (never a speaker): each
  archetype has its own hurt and burst in its family, each sounds, stays under the old sets' level and dies away, the
  families' character (the clack short, the bronze ringing on with the bell's partials, the roller's glass partials
  over a rumble, hisses brighter than thuds), every two hurts apart by loudness over time and brightness, and the
  glance.
