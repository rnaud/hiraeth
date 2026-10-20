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

## The volumes (issue #112, October 2026)

Settings' music, effects and voices scale the `music`, `fx` and `voices` buses (`setVolumes`, `setVoices`).
Everything reaches the reverb through a bus too: the buses' own sends, the bands' gains (music volume), and
`fxRoom` (the effects volume) for the effects that keep their own room, the singing light's theme
(`lightTheme`) and the makers' hum (`_humOut`). Before, those two went into the reverb straight, so with the
effects at 0 they were still heard (about -32 dB).

**Placed sounds** (`spot(pos, { bus })`, one sound at a place, panned by `listen`; v1.60, issue #231) go on the bus
their slider names. Before, `spot` scaled them all by the music's volume, so the makers' hum (placed) and a
fragment's song played with Effects at 0, and Music at 0 silenced the fragments' cue. Now `bus: 'fx'` (the default)
goes into `fx`, its room through `fxRoom`: the makers' hum at a place (`_humOut`), a fragment's song
(`fragmentSong`), a sphere's note when the fluid strikes it (`orbNote`) and the three spheres' remembered sounds
(`remembered`). `bus: 'music'` (the music's volume, into the world and the reverb, not the ducked music bus) is the
Garden's sphere song alone (`spheresSong`, the pole's tune, the score's moment). The finder's beep was on `fx`
already; it is quiet while a conversation or a menu is up (`fragments.update(dt, t, { quiet: busy() })`).
Test: `tests/sound-mix.test.js`.

**Sat on a bench** (issue #363, `Sound.seated`, `SEATED_SWELL`): the music bus swells to twice its level (+6 dB, over
the player's own music volume, so 0 stays silent), eased in over a few seconds, the wind steps back, the theme is cued
in as for a moment, and all of it eases back as he stands. `listen()` sets the music's level every frame in every world
now (before, only where there were musicians). [worlds.md](worlds.md), "Benches"; test `tests/benches.test.js`.

**A temple's keys** (issue #274: "When I get a key in a temple there should be a sound effect"): `Sound.keyGet(big)`, a
short bright chime as the key rises out of its little chest, a quick run up the world's scale (`KEY_GET.notes`, scale
degrees, one every 75 ms) on struck bells (`keyBell`: a sine and two bright overtones, no filter dulling them), the
last note held with a shimmer over it; the great key's run lower and longer with a low bell under it. `Sound.keyTurn()`,
a key going into a lock: a soft click and a dull tumbler (a clank before). Both on the effects bus.
`tests/key-chests.test.js` renders them on the in-memory context (engine/webaudio.js): heard, bright, gone within
two seconds, the click softer than the chime.

That is what the Steam Deck played (issue #112): the Deck bench of early October (`scripts/bench/web-page.mjs`
writes `music: 0, effects: 0, voices: 0`) ran in the player's own Electron profile before `deck-run.sh` gave it
one of its own (10 October), and left those settings in the player's game: silent but for the singing light in
the prologue. The audio itself was fine: the context ran at once (Electron's autoplay), and the mp3s decode.
Settings saved with all three at 0 come back to their defaults once (`soundV`, `migrateSettings` in
`src/ui.js`). Tests: `tests/sound-mix.test.js` (silent at 0), `tests/hud.test.js` (the repair).

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
| Desert | D bayati | 56, in 8 | modelled oud, soft analog pad, low drone with the wind in it, ondes-like sine, a slow soft pulse (walking); its own moments (below) | "the tree drinks": down from the fifth through the quarter-flat second | a granular shimmer of the oud |
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
  voice for it (an ondes-like sine in the desert, the bone whistle on Vael, a singing bowl in the
  Buried Machine...). At home it is the world's own tune.
- **Activity** (`Sound.follow`, eased each frame from `sound.update`): `move` (walking
  speed), `ride` (a mount, a vehicle, the wings or the jets), `still` (seconds standing),
  `indoor` (`src/shelter.js`), `night`, `storm`. Walking or riding adds the plucks and
  the drums to any section; after half a minute standing still the drums and bass drop out;
  indoors there are no drums, bass or colour; night and storms bring it all down. The
  Hangar and the Market keep a quiet pulse even standing still.
- **Levels.** `level` evens the worlds out (each renders to about -27 dB RMS).

### Each world its own (issue #318, October 2026)

"The procedural score sounds too similar level to level." Eight worlds off the route (the Mangrove, Salt Harbour,
the Waterfall, the Forest of Antennas, the Eclipse, the Fallen Ring, the Underside, the Overnight Train) had no
`SCORES` entry and played the desert's (`scoreFor` falls back to it), and the Glass Dunes played the Hangar's note
for note. Each now has its own, after its recording's brief (`public/music/manifest.json`); the Lantern plays
home's on purpose (`SCORE_OF`). Every score shared one texture too (a drone, a pad, random sparse plucks, the
motif), so a few worlds now carry rhythms of their own:

- **`figure`**: a written ostinato on the pluck's voice in place of the random notes, `sub` notes a beat round
  `steps` (degrees over the chord, `null` a rest), fuller walking, softer standing, at night and indoors (its own
  seeded draws, so the other layers play what they did): Viridel's harp rolling in sixes, the Moon Foundry's analog
  arpeggio, the Waterfall's harp in triplets, the train's piano in swung eighths, the Fallen Ring's guitar, Salt
  Harbour's, the Atelier's music box, the Glass Dunes' harp harmonics, the Antennas' signal.
- **`swing`**: the off-beats late by that fraction of a beat (`swungAt`): the City-Shaft (0.16) and the train (0.14).
- **`reg`**: the lead's and the pluck's octaves (`{ lead, pluck }`): low bass clarinets and cellos in Lorn, the
  Mangrove, the Eclipse, under water; the Spheres' and Space City's high mallets and celesta.
- **New voices** (`src/score-voices.js`): `cello` (bowed; a drone bows in slowly), `harmonic` (harp harmonics into the
  echo), `guitar` (nylon), `handpan`, the held `deep` (the sea pressing on the glass) and `bowed` (bowed vibes),
  the `frame` drum.
- Lorn's drums in triplets; the Glass Dunes in five with two clocks ticking in six against the bar; under water
  F♯ dorian on a deep drone, an electric piano and a low cello; the Moon Foundry C dorian at 76; Space City E♭ lydian,
  a French horn over a warm pad (each as its recording is).

| World | Mode | Tempo | Instruments | Rhythm |
|---|---|---|---|---|
| Mangrove | D dorian | 64 | handpan into an echo, low bass clarinet, reeds, flute (the father) | logs and drops in triplets |
| Salt Harbour | F mixolydian | 66, in 6 | nylon guitar, harmonium, walking upright bass, bone whistle | a shanty's lilt, knock and shaker |
| Waterfall | D♭ lydian | 62 | cello drone and line, bowed vibes, harp, felt piano (the father) | the harp rolling in triplets, no drums |
| Forest of Antennas | E dorian | 68 | analog drone, bowed vibes, electric piano, an ondes for the tune | a signal's ticks in sixteenths, an echo |
| Eclipse | C♯ dorian | 50 | singing bowls held, muted strings, a felt piano, low bass clarinet | no drums, a chord every four bars |
| Fallen Ring | A mixolydian | 70 | French horn, strings, guitar | a frame drum, the guitar in eighths |
| Underside | G dorian | 64, in 3 | harmonium, harp, plucked walking bass, flute | a woodblock on the one |
| Overnight Train | B♭ major | 78 | felt piano, walking upright bass, clarinet, vibes | swung: brushes on the rails' rhythm |

**How alike they are** (`scripts/score-features.mjs`, `tests/score-distinct.test.js`): a feature vector per score
from what it plays (tempo, metre, the mode's notes and the key, the instruments, notes a second, register, where in
the beat the notes fall, drums a second) and a weighted distance between two (`DISTANCE_WEIGHTS`). Before, the
nearest pairs were 0.03 apart (two detours, both on the desert's score) and 0.77 (the Hangar and the Glass Dunes);
now the nearest is 2.66 (Viridel and Salt Harbour). The test holds every pair at 2.4 or more and every two scores
to at most half their instruments in common, and renders each score offline for 8 s (`renderFeatures`, the
in-memory Web Audio of `engine/webaudio.js`): each sounds, and none is louder (-24 dB RMS) or brighter (7 % of its
energy above 2 kHz) than the loudest and brightest before. `node scripts/score-features.mjs [--render]` prints the
features and the nearest pairs.
- **Offline renders** (`scripts/render-score.mjs`): the game's own `Sound` in headless,
  muted Chrome, an `OfflineAudioContext` swapped in, along a little walk (standing, walking
  from 10 s to 36 s, standing): `PLAYWRIGHT=…/playwright-core/index.mjs node
  scripts/render-score.mjs <outDir> [seconds]` writes `score_<world>.wav` (`MUSIC_ONLY=1`
  without the ambience and wind, `WORLDS=` to choose). It starts its own dev server (port
  5847).


### The ship's music in the prologue (issue #149)

"It doesn't make sense for the desert music to play in the prologue since it's in the ship." The ship has a score
of its own (`SCORES.ship`, "The Dark Ship": D dorian, 48 a minute, the ship's hum for its drone, a glass pad, a few
soft vibes notes, the felt piano with the father's theme, the console's three blips for its colour; no drums). It is
on the desert's tonic, so stepping out into its bayati (a near neighbour of dorian) opens a door rather than changing key. `prologueMusic(sound,
phase)` (`src/ship/cinematics.js`) runs it: `ship` from the first black through the walk to the cockpit (the desert's
moments held back: `Sound.holdTheme`, its procedural score swapped: `Sound.setScore`, which starts a score from its first section), `quiet` from the
father's message on (no score under his words and the singing light's theme; the power goes), `desert` as you step
out onto the sand (the desert's recording comes in as on arriving: the moments' `arrival`; the score in full if the
recording has not decoded), and on a skip.
A theme that finishes loading while held waits silent (`startTrack`). `tests/prologue-music.test.js`.

### The desert's music (issue #207, October 2026)

"The desert level music is not very good. It's too on the nose, almost a parody." Direction (the author): more
ambient, mysterious rather than aggressive; a melange of old-school oud music and modern electronic music, since it
is still a world of space exploration. What played before: on arriving, indoors and at moments, a Suno recording
(`desert.mp3`, D hijaz, ney, oud, reed drone and a frame drum all through it, mastered loud and dense); between
moments the procedural score's light layers (a sawtooth reed drone, triangle pads, a bright saw-and-triangle oud
pluck). That recording is retired; the desert's own score (`SCORES.desert`, "The Tree That Drinks") is rewritten, and a
new recording made to match it (below) has its slot back:

- **D bayati, 56 a minute, in 8** (`MODES.bayati`: the second a quarter tone flat, 1.5 semitones; the scale and the
  father's theme take fractional semitones as they are). The quarter tone is only in the motif, a sigh on its way
  down; the pad, the drone and the plucks keep to D, F, G, A, B♭, C (`tests/desert-music.test.js` checks it). The
  chords change every 17 s: D minor, B♭, D minor, G minor, as an open fifth or a triad.
- **The oud** (`lute`, `luteString` in `src/score-voices.js`): a Karplus–Strong string, a course of two strings 3.6
  cents apart, plucked with a softened noise burst less the comb of its pluck point, through an oud's body (peaks
  near 105 and 250 Hz, rolled off over 3.6 kHz). Six registers (110 to 835 Hz) are rendered once into 2.4 s mono
  buffers at 24 kHz, one per scheduler tick from the score's start (`prepareLute`: about 2-5 ms each on the Mac), and
  a note is a buffer source at the right `playbackRate` (within a fifth of its register) that settles into its pitch
  from a breath under it (fretless); a long note gets a second, softer stroke halfway (the risha). It carries the
  motif, the sparse plucks (a 20% chance a beat at most) and the echo of the motif.
- **The electronics**: the pad (`nebula`: two saws 14 cents apart through a lowpass opening from 360 Hz to 1.3 kHz
  and closing again over a chord, 4 s in, 5 s out); the drone (`dune`: a sine on D2 and A2, a triangle an octave
  up, and the wind singing a twelfth up: noise rung in one band of Q 18); the father's theme on `ondes` (a sine
  gliding up into each note, slow vibrato); the shimmer (`grains`, the world's colour: nine slices of the oud's
  ringing, two octaves up on the tonic, fifth, octave and fourth, scattered across the stereo field over five
  seconds); and the **echo** (`echoBus`, made once for a score with `echo`): three repeats a dotted eighth apart
  (0.8 s), each softer and darker, left, right, left. Feed-forward, no feedback loop, so the engine bridge
  (`engine/webaudio.js`) renders it the same. The oud, the ondes and the grains send into it.
- **No frame drum.** Walking brings a slow pulse (`heart`: a soft sine thump from 66 to 44 Hz; `dust`: a grain of
  sand ticking at 5 kHz), two beats and two ticks every 8.6 s; standing, indoors and between moments, none.
- **Its own moments** (`moments: true` on the score): with no recording decoded (yet, or on a bridge that can't),
  `Sound.musicMomentsUpdate` runs the same
  `MusicMoments` and sets `scoreMoment`: the score in full for the arrival (150 s), indoors and after a moment;
  between them only its light layers (`lightScore`: drone, pad, sparse plucks, the shimmer, the echo). Held back
  (the ship's prologue) or Settings > Music: Always, in full. `Sound.setScore` starts a score from its first section,
  so the step out of the ship opens on the drone and the oud's motif at once.
- **The camps' drum circle** keeps its D hijaz tune (`src/minigames/drums.js` plays it in hijaz on the desert's
  root): the villagers' song is theirs. Bako's solo is unchanged.
- **Level**: about -28 dB RMS in full (the old score -27, the recording balanced to -27), -33 between moments.
- **Its recording** (the same slot as before: `SOUNDTRACKS.desert` = `desert-bayati.mp3`, "Descent into D Bayati",
  2:45). Made in Suno by the author on 2026-10-12 from a prompt matched to this score (D bayati, 56 BPM, solo oud with
  fretless slides, warm analog pads, a D/A drone, wind, a granular shimmer, tape echoes; no drums, no build); the
  prompt is in `public/music/manifest.json`. A new name rather than `desert.mp3`: a kept copy and the caches key on
  the file name. What plays when, as for every world (`src/music-moments.js`): with Music: Always (the default since
  v1.85) the recording all the time; with Moments, the recording for the arrival's first
  150 s, indoors (and 20 s after), and for a while after a moment; between them the score's light layers (drone, pad,
  sparse oud plucks, the shimmer, the echo), the recording fading out over 10 s over them and in over 3 s (the score
  stops scheduling as it comes in, its notes ring out). In the prologue nothing
  changes: the ship's score while you wake, nothing under the father's message, the recording as you step out.
  On a device it rides in the package (`ON_DEVICE_THEMES`), 3.8 MB.
  Measured (offline, BS.1770 on the Mac; the old `desert.mp3` and the others for scale): -16.3 LUFS integrated as
  delivered (old desert -15.1, title -16.1, incal -16.2, home -10), a loudness range of 4 LU (short-term -18.8 to
  -14.3: a gentle swell from 0:00 to 1:50, no build); after the game's balancing (-9.2 dB) -25.4 LUFS, the others
  -24.3 to -25.3. No drum kit, no frame drum, no hand percussion: 7 sharp high-band hits a minute (the old recording
  120); what pulses is low and soft, a muffled thump under the oud from about 1:00, densest 1:50-2:30, like the
  score's own `heart`. Key: D throughout (the tonic 30% of the pitch energy, the bass 38%), D F G A B♭ C with the
  second mostly at E♭ and partly a real quarter-flat E (about 140-160 cents), E natural rare: bayati with a kurdi
  lean, in tune with the score (+4 cents). The loop: it fades to near silence over its last 5 s and the drone swells
  back in, so the joined loop (`prepareSoundtrack`'s 2 s overlap) breathes rather than cuts. Issue #207.
- **Cost** (the same 3-minute walk rendered offline in headless Chrome, before → after): oscillators 123 → 49 a
  minute, filters 94 → 38, buffer sources 49 → 45 (the oud's notes are buffer sources now), the offline render
  11-17% of real time → 9-12% (a loaded Mac: noisy), the scheduler 0.04-0.09 → 0.10-0.15 ms a second of music; and no 154 s recording decoded (59 MB of samples in memory, its balancing on the main thread).

`tests/desert-music.test.js`.

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
own recording (below). Recordings are balanced to -21 dB RMS (-27 until #530; with a peak cap), with the last
two seconds crossfaded into the opening for looping, then faded in over two seconds.
They use the existing music bus: volume, mute, menu hush, musician ducking,
underwater filtering and background suspension still apply. Ambience, bands and
combat continue independently. Disposing a world cancels its outstanding download.

**In Unity** (October 2026, issue #264) the same code plays them. Unity decodes the MP3 (the Web Audio shim can't),
and the game's graph still sets the place and the level: the fades, the music bus, the menu, the mute, the away.
`engine/webaudio.js` `NativeAudioBuffer`, `BridgeMusic.cs`; the balance is measured once per file into
`src/theme-levels.js` (`node scripts/theme-levels.mjs` after adding or replacing a recording). The Deck's player
carries every theme. The APK and the Xbox's carry the desert's and the title's and download the rest once.
[engine-bridge.md](engine-bridge.md), "The recorded music".

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
  decodes it and balances and joins it like a world's theme (`prepareSoundtrack`: -21 dB RMS with a peak cap,
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
- **On a device** it is in the package (`ON_DEVICE_THEMES`): it is the first thing a launch
  plays, so it must not wait for the background download.
- Level on the menu bus (measured in headless Chrome, music at 0.8): the procedural tune about -27 dBFS, the
  recording about -34 until #530, about -28 since (the recordings' target -27 → -21 dB RMS), the same level as a
  world's recording on the music bus.
  Tests: `tests/soundtracks.test.js`.

## The themes on a device (October 2026)

The APK and the Steam Deck package carry one recorded world theme, the desert's (`desert-bayati.mp3`,
`ON_DEVICE_THEMES`, `src/music-store.js`): the first world has its music offline from the very first session. They
carry the title's music too (above) and the singing light's cue. The other 24 world themes
(96 MB) stay on the site (`scripts/site-only.mjs` `leftOff`, the over-the-air zip too; the web build is
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
  Neither: the procedural score plays until the download lands it, and then the theme takes over at once:
  `startTrack` cues an arrival moment (`src/music-moments.js`), so `Sound.musicMomentsUpdate` fades it in over
  3 s and the score steps aside. (Until issue #471 it waited for the next moment, minutes away when the
  arrival's 150 s were over.) Held back (the prologue's ship) it waits for the release.
- **In Unity** (the APK and the Xbox package, which carry only the desert's and the title's) the player
  downloads the themes itself (`BridgeMusic.Fetch`, into `persistentDataPath/public/music`, the world's
  first). The engines have no page store, so `loadSoundtrack` waits through `setThemeWait`:
  `engine/unity/music.js` `themeArrival` looks for the file every 5 s where the game's fetch reads
  (`BridgeRunner.PublicRoots`) and hands it over as above. Until issue #471 nothing waited: every world but
  the desert played the procedural score for its whole first visit, its recording only from the next load.
  Inside the APK a downloaded file is read as a file (`StreamingFile.Read`), not asked of UnityWebRequest
  as a bare path.
- **Installs from before** (every theme in the bundle): the download takes each from the bundle first
  and keeps it, without a request to the site (see `docs/systems/android.md`, "The music, downloaded
  once", for the one update that has to carry them for that).
- **The music page** (`music.html`) reads the same: the bundle, the kept copy, else the site there and then, kept
  (`themeToListen`; issue #318: it read only the bundle, so a device played just the desert's and the title's there).
- **Settings > Updates** (Android and the Deck) says "Music: 18 of 25 downloaded" while some are missing
  (`themeProgressText`), nothing once all are there.
- A device is `bundledGame()` (`src/levels/reference-sheets.js`): GeckoView's 127.0.0.1:41730, the
  WebView fallback's https://localhost, the Deck's hiraeth://game. Tests: `tests/music-store.test.js`.

## Scoring the moments (October 2026)

With a recorded theme loaded, Settings > Music plays decides when it plays. **Always** (the default since
v1.85, issue #474) plays it all the time, outdoors too. **Moments** (the default from v1.0 to v1.84, still a
choice) keeps it for arrivals, interiors and moments, and lets the ambience carry the open world between them. `MusicMoments` (`src/music-moments.js`, pure) holds the
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

**The default and older saves (issue #474).** The default lives in `src/ui.js` (`DEFAULTS.musicMode`), `src/audio.js`
(`musicModeSetting`) and `src/music-moments.js` (`musicMode()`'s fallback for unset or unknown values, the
`MusicMoments` constructor; `MUSIC_MODES` lists Always first, so the engine menus' choice goes round from it).
Unity has no default of its own: `engine/unity/game.js` builds the same `Settings` and the same `Sound`.
`Settings.save()` writes every setting, defaults included, so a saved `moments` from before v1.85 was the old
default rather than a choice: `migrateSettings` turns it into `always` once (`musicV` 1); Moments picked after
that is kept.

`tests/music-moments.test.js` checks the state machine, the light layers, the default and the migration.

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
  sandstorm -40 (`AMBIENT_WIND` 0.22); the mount's whistle -30 (`WHISTLE`), the train's -31; Vael's rider's call
  on the flute (`tune`, `CALL_TUNE`; issue #488) -29, -21 before; the water
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

### Placed in space (v1.54, issue #176)

A foe's wind-up (`foeWarn(kind, dur, pos)`) and its hurt (`foeHurt(kind, sound, pos)`) come from where it is: src/foes.js
passes `() => f.chest`. `foeSpot(pos)` gives the sound its own small bus (a gain, a gentle lowpass, a stereo panner)
into the effects bus, so the effects volume and the mute rule it as before; `listen()` (each frame, from the camera)
moves it with the foe until the sound is over. `foeEar(pos)` is where it sits, by `FOE_EAR`:

- full within 6 m, down to a **floor** at 40 m and no lower (0.4 for a wind-up, a warning across a fight; 0.2 for a hurt);
- panned left/right from the camera (±0.85, as the singing spheres' `placeAt`);
- **behind**: stereo can't say behind, so it is a little duller (lowpass 16 kHz in front to 5 kHz straight behind; the
  wind-up's tick, 1.9-2.6 kHz, passes it), and a **wind-up out of view** is ×1.25 (the eye can't carry it);
- no listener yet, or no position given: straight onto the effects bus, centred (the old sound).

The Unity bridge plays it through the same Web Audio shim (engine/webaudio.js has the gain, biquad and stereo panner).
Tests (`tests/foe-voices.test.js`, the last six): the fall with distance and the floors, left/right turning with the
camera, behind duller and out of view louder but never under the floor, rendered left/right channels, the pan following
a foe that walks round, the effects volume still ruling it, and the foes passing the chest.

## The people's voices (issue #323, October 2026)

Everyone speaks their world's tongue (the translator gives you the words: `docs/systems/dialogue.md`, "Alien
voices"). Until v1.72 a line was a run of separate beeps, a fresh square / saw / triangle oscillator through two
band-passes for every syllable at 48 letters a second: hard pitch steps, buzz, gaps and clicks inside words ("super
robotic and hashed"). Now `src/story/voice.js` plans a line as speech and `src/voice-synth.js` sings it as **one
continuous voice**, a small formant synthesiser of plain Web Audio nodes.

- **The plan** (`planLine`): about six and a half syllables a second (`SYLLABLE_S`), each word's stressed syllable
  (`SPEECH[lang].stress`: first, penult or last) longer and with a pitch accent, the sentence's tone contour
  (`TONE_SHAPES`, a declination by default, a question rising at its end), a continuation rise before a comma, the
  last syllable before a pause drawn out, pauses at commas, stops, dashes and trailings-off (`PAUSES`). Syllables
  are onset + vowel (+ a coda, `SPEECH.codas`; a diphthong now and then, `diph`), `join`ed when they run on into the
  next. Each vowel has F1–F3 (`VOWELS`), scaled by the speaker, the tongue and the tone. The plan's `timbre` is the
  voice's make for the line: the glottal pulse's `tilt`, how breathy (`open`), the formants' bandwidths (`bw`), the
  high resonance (`f4`, a glassy tongue's ring), `flutter` (pitch waver, cents), `mech`.
- **The speaker** (`voiceOf`): pitch from `voice` and kind, the formants from size (`scale`) and `build`
  ('heavy' deeper and darker, 'slim' lighter), children higher and smaller-throated, elders slower, wavering
  (flutter 30 cents) and airy; women's and children's voices a little breathier.
- **The tone**: speed, range, contour and loudness as before, and `TONE_BRIGHT`: a smile lifts the formants and
  hardens the pulse (playful, happy), sadness and tiredness lower and soften them.
- **The voice** (`renderVoice`, about 28 nodes for a whole line, whatever its length; the old one made a dozen for
  every syllable): a glottal pulse (a `PeriodicWave` of 40 harmonics at n^-tilt) with Klatt's three-sine flutter and
  a vibrato on its detune → voicing level, and breath noise → aspiration level, both through an F0 low-pass and F1–F4
  band-passes in parallel, under a gentle low-pass; a separate frication noise (high-pass + band-pass, its centre
  and Q per consonant) for hisses and bursts. Each consonant (`PHONES`) is shaped in time: a stop's closure (the
  voice stops, a voice bar for b d g), burst and aspiration; a fricative's hiss; h as unvoiced vowel; a nasal's
  murmur (F2 and up shut, F1 at 260 Hz); a liquid's glide; the formants bend to the consonant's place (`locus`) and
  back. **Every parameter moves by `setTargetAtTime`**, so pitch, formants and levels glide: no step, no zipper, no
  click where syllables meet; a voice is levelled by its own pitch (a high voice's harmonics fall on F1).
- **Live**: balloons and calls play a whole plan (`Sound.speak` → `renderPlan`, a voice per chorus member); the
  dialogue's first syllable sings its page from there (`Sound.syllable`), the reveal follows the voice
  (`revealAt`: the letter being said), and turning the page or closing the talk hushes it (`hush('talk')`).
- **The engine** (`engine/webaudio.js`) tables a `PeriodicWave` once (2048 points, peak-normalised as browsers do)
  instead of summing its harmonics every sample.
- Tests: `tests/voice-synth.test.js` renders lines in memory and checks no clicks (0.5 ms of energy above 14 kHz
  ten times its neighbours'; it hears a one-sample step of 2 %), a pitch continuous within words (autocorrelation
  every 5 ms), F1 and F2 peaks where the plan put them, no drop-out inside a word, little energy above 5 kHz in a
  vowel (no buzz), every pair of 14 worlds apart in spectrum, pace or pitch, the tone heard (a question rising),
  pauses heard, and the node count. Measured against the old renderer on the same lines: clicks 1–179 a line → 0,
  syllables 9–13 a second → 5–7.
- **The Unity port** (`unity/Hiraeth`, issue #333; until then its `Voice.cs` sang the old beeps): `Voice.cs` is
  `voice.js` ported number for number (the tones and their brightness, every tongue's `LANGUAGES` and `SPEECH`,
  `voiceOf` with build, tilt, breath and flutter, `spokenMask`, `planLine`, `revealAt`); `VoiceSynth.cs` is
  `renderVoice`: the plan becomes the same `setTargetAtTime` events, each parameter a one-pole toward its target
  (the levels every sample; the pitch with its flutter and vibrato, the formants and the hiss's band every 16
  samples, where `engine/webaudio.js` sets its filters every 128), the same glottal table, resonators and frication.
  `VoiceOut.cs` streams the lines on Unity's audio thread (`OnAudioFilterRead` on a clip-less source, at the output's
  rate; nothing is rendered ahead): channels `dialogue` and `call` (a new line or `Sounds.Hush` fades the last),
  `balloon` (two at most, quiet while a conversation holds the floor). The conversation's reveal follows the voice
  (`Hud`: `Voice.RevealAt`), a page turned or the talk closed hushes it, the ship and the calls home sound through
  a speaker (radio 0.55, as `speakLine`). Measured (14 October, the Mac): a voice costs 0.9 ms of a core a second
  of speech at 48 kHz under .NET, 5.9 ms in the editor's Mono.
- **Against the web**: `scripts/unity-export/voice-reference.mjs` plans 13 lines (the desert's people, then a tongue
  of each make: the Shaft cant, the Hangar's machines, Lorn's wobble, the Vael whisper, the murmurs' chorus, the
  spheres' ring, the ship) and sings them with `renderVoice` on the engine's Web Audio at 24 kHz; the export writes
  each plan and its sound's measures into the desert's `world.json` (`voiceReference`): the loudness every 10 ms,
  the pitch every 10 ms (autocorrelation), the long-term spectrum in third-octave bands. `VoiceTests.cs` checks the
  plans syllable by syllable, then sings each line and measures it with the same code: level within 1.5 dB (it is
  within 0.3), loudness over time r > 0.9 (0.97–1.00), pitch within a semitone in 85 % of the voiced frames (95–100 %,
  median 0.00), spectrum within 2.5 dB from the line's lowest pitch up (0.4–2.3; the web's renderer is 0.2–1.7 dB
  from itself with another noise). Then the checks of `tests/voice-synth.test.js` on its own sound: no clicks at
  48 kHz in nine tongues and tones, silence before and after, no buzz above 5 kHz, every tongue sung, the hush, the
  reveal, the cost. `tests/unity-voice-reference.test.js` keeps the reference's side honest.
- The music page's **Voices** play every tongue.

## The music page (issue #270, October 2026)

`music.html` (`src/music-page/`, Debug → Pages → **Music & sounds**; on the Notes site at
https://hiraeth.alexandria-rnaud.workers.dev/music) plays every song and every sound of the game, each with a **Note**.

- **Songs: recorded**: each file of `public/music/` the game plays (`SOUNDTRACKS`, the title's `TITLE_THEME`, the
  cues of `CUES`), in the route's order, with the worlds that play it, its Suno title, direction, prompt and link from
  `manifest.json`; play / stop and a seek bar. On a device (issue #318) a song is read like a world's theme
  (`themeToListen`, `src/music-store.js`): the bundle's, else the copy the background download kept, else downloaded
  from the site there and then ("Downloading …" on the status line) and kept, so the worlds have it too; offline
  and not kept yet, the status line says so. Before, the page read only the bundle's `music/`, where a device has
  just the desert's and the title's recordings: on the Retroid only those two played.
- **Songs: each world's score**: every `SCORES` entry, played by the game's own scheduler (`Sound.schedule`) on a bus
  of its own (Stop cuts it at once) with the world's params shown, a **seed** (the arc it starts on: each arc draws its
  own order of sections), a **length**, what you are doing (standing, walking, riding, indoors, night, storm: the
  score's `act`), its ambience bed, and for a score with moments of its own its light layers alone.
- **Songs: the other music**: the menu music, the fight's layer, the musicians as each world sets them up (`setBands`,
  with their modes), and the tunes sung at a moment (the singing light's theme, a swell, the charge, the homage, Bako's
  ney, the spheres' song, the makers' hum).
- **Effects**, grouped: the traveller, the recorded takes (`src/sfx.js`, each group), water, the gun, the blade and
  the shield, calls and the scout, chests, keys and items, chimes and the shop, quests and moments, foes and guardians
  (every `FOE_VOICES` kind hurt and done, the wind-ups, the attack cues), creatures, the ship (`src/ship/sfx.js`),
  the chime pirates (`src/minigames/pirates-sfx.js`: every one of `pirateSounds`, issue #326; the test checks each is listed),
  ambience (the continuous layers of `Sound.update` held a few seconds: wind, storm, rain, the waterfall, the masts,
  the train, the bike), voices (every language of `src/story/voice.js` and the call voices), the building blocks, and
  every instrument, hit and colour of the scores. A variant is a button. The **scale** in the header is the world
  whose scale the effects and tunes sing in.

The catalogue (`src/music-page/catalog.js`) is pure: each variant is a small function of the game's `Sound`
(`(s, e) => s.keyGet(true)`), `e` the page's player (`src/music-page/player.js`: where a placed sound is put, `hold`
for a continuous layer, `later`). `tests/music-page.test.js` checks that **every method of `Sound` is played by some
entry or named in `PLUMBING`** (a new sound fails the test until it is on the page), that every recording on disk and
in the manifest, every score, sample group, foe voice, instrument, language and ship sound is listed, and plays every
variant on the engines' in-memory context (`engine/webaudio.js`): no fault, finite, heard.

Notes go the lore page's way (`src/lore-page/note-box.js`, `notes.js` `fileNote` with the page's own request): a
GitHub issue through the Worker with the notebook's session, its body naming the song or sound, its catalogue id and
its link (`…/music#s-<id>`), and the footer "Added from the Hiraeth music page." (`source: 'music'`,
`worker/issues.js` SOURCES). The canyon run's bike engine and the trailer's foley are their own pages' and not here.

## Sound QC (issue #379, October 2026)

The author: "we have no sound effect for the character when he attacks and some other key actions, which makes the
game feel less good." The sound QC (`.claude/skills/sound-qc/`: `node .claude/skills/sound-qc/run.mjs <out>`) lists
every player action and game event that should be heard (`scripts/sound-qc/actions.mjs`, found in the code), finds
where the browser's game and the engines' (engine/game.js: what Unity plays) ask for it, renders each on the
in-memory Web Audio with and without the recorded takes, drives the engines' build with scripted keys, and checks the
mix. Its thresholds and how to read it: the skill's SKILL.md.

### The checklist

What the QC holds the game to (the numbers where a source gives them; the bands of the mix are the house's own):

1. **Every action answered.** A swing, a block, a jump, a landing, a pick-up, a menu move: each a sound, layered over
   rules that stay the same (Jonasson & Purho, "Juice it or lose it", GDC Europe 2012; Nijman, "The art of
   screenshake", 2013: the first fix was the gun's sound).
2. **At once.** The whole loop from the press to feedback under ~100 ms (Swink, *Game Feel*); the sound in the frame
   the input lands, not when the animation catches up. A wind-up is answered at its start; the cut's whoosh with the cut.
3. **Anticipation and impact are separate.** The whoosh rides the swing; the impact fires on contact, on the hit-stop's
   frame, its transient clear of the rest (Dumais, "The 4 secret layers behind epic sword sound effects").
4. **Layers.** Swing (air), impact (body), texture (material), a sweetener (a low kick, a shimmer); the combo's
   finisher heavier than its first cuts.
5. **A hit, a block and a miss differ.** A landed hit crisp and bright, a block dull and metallic, a miss the whoosh
   alone (the fighting games' hit-confirm; Sakurai on hit-stop).
6. **Variation.** About ±1 semitone (±100-120 cents) of pitch and ±1 dB of level on effects (wider, ±2-3 dB, only on
   footsteps and foliage); 4-6 takes a sound in a shuffled round, never the same twice running (Wwise's randomiser,
   the "machine-gun effect"); a synth varies its pitch, filter and length every time.
7. **Voices limited and prioritised.** A cap per sound (footsteps, impacts: 2-4); the player's hits, a foe's wind-up and
   the low-health warning never stolen (FMOD's virtual voices).
8. **Ducking.** Music and ambience step back under dialogue (Quarles's example: -9 dB, 500 ms in, 1 s out; smaller,
   3-6 dB, for a moment); stacked ducks capped; no pumping (Game Developer, "Game audio theory: ducking", 2009).
9. **Loudness.** Integrated -24 LUFS on a console or a desktop, -18 on a handheld, true peak under -1 dBTP, a loudness
   range of 20 LU at most, measured over 30 minutes of play (Sony ASWG-R001; Taylor, "Loudness and how to measure it",
   GDC 2013).
10. **Falloff.** -6 dB per doubling of distance and a low-pass far off, per class; dialogue nearly flat (Audiokinetic,
    "A Wwise approach to spatial audio").
11. **UI sounds one family.** Shared timbre and envelopes, 100-300 ms, no silence before them, quiet under speech and
    music, confirm and back the same in every menu; never the only cue.
12. **Low health does not nag.** It fades or stops after a few beats, scales with what is left, comes with a picture.
13. **Silence is a tool.** Drop the music and the bed before a reveal or a guardian; keep the range, don't compress
    everything to the ceiling.
14. **Footsteps by surface and gait**, up to 5 takes a surface, landings by the height fallen.
15. **A slider per kind**: music, effects, voices (Xbox Accessibility Guideline 105).

Sources: [Juice it or lose it](https://www.gdcvault.com/play/1016487/juice-it-or-lose) ·
[The art of screenshake](https://www.youtube.com/watch?v=AJdEqssNZ-U) ·
[Loudness and how to measure it (Sony, GDC 2013)](https://media.gdcvault.com/gdc2013/slides/824764Garry_Taylor_Loudness_and_how.pdf) ·
[LUFS loudness standards](https://danmurtagh.com/lufs-loudness-standards) ·
[Game audio theory: ducking](https://www.gamedeveloper.com/audio/game-audio-theory-ducking) ·
[Wwise CUBE: balancing the final mix (randomiser values)](https://gameaudioresource.com/2019/08/26/chapter-16-a-balancing-final-mix/) ·
[FMOD virtual voices](https://documentation.help/fmod-studio-api/virtualvoices.html) ·
[FMOD event macros (stealing)](https://javierzumer.com/blog/2022/2/26/fmod-event-macros) ·
[The 4 secret layers behind epic sword sound effects](https://www.daviddumaisaudio.com/the-4-secret-layers-behind-epic-sword-sound-effects/) ·
[Hit confirm](https://wavu.wiki/t/Hit_confirm) ·
[Android audio latency](https://developer.android.com/ndk/guides/audio/audio-latency) ·
[Xbox Accessibility Guideline 105](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/105) ·
[Game Feel (Swink), reviewed](https://lizengland.com/blog/review-game-feel-by-steve-swink/) ·
*The Game Audio Tutorial* (Stevens & Raybould, Focal Press 2011).

### The first run (16 October 2026, before the fixes)

71 actions; OK in the browser 36, in the engines 28. The key actions not OK:

- **The blade's press was silent** (both): the first sound of a swing came at the end of its wind-up, 133 ms after the
  press. The cuts themselves were heard (-2..0 dB against the music), but nothing answered the press, and the synth's
  swings (the engines') repeated within 0.3 dB and 3 % of brightness.
- **The engines had no body at all**: no BodyFoley in engine/game.js, so in Unity no jump, landing, roll, climb, wings,
  jets, knock-out or getting up; no swimming (waters had no sound), no pick-up (interactHooks), no potion's healing
  chord, every step on the world's default ground (no footing). The hurt's stand-in for its recording was a 40 ms
  burst, -19 dB against the music: a blow landed on him was all but silent.
- **No menu made a sound** (open, close, move, confirm, back, tab: both), and a conversation's answer called a
  `Sound.toolClick` that did not exist. Letting the lock go, throwing what he carries and taking a photo were silent.
- **Too loud**: the recorded footsteps (-7, sprinting -5 against the music: foley sits at -8 or under), the soft
  landing, the swimming stroke, the lock-on's chirp (-3), the heartbeat (+0.6: a warning that repeats sits at -6 or
  under), the tank's empty click, the gun's shot, the double jump; **the shop's purchase peaked at +10 dBFS** in the
  engines: the shim interpolated a gain across the 128-sample block a scheduled note began in, so its default level of
  1 leaked into the samples before the note's first event (a click at full level on every delayed note of the engines).
- **Repetitive**: the potion's cork, the shield opening, the charge, the scout's blip, the potion picked up, the
  mount's whistle. **Alike**: a quest given, a step done and a quest done were the same chime. **Too quiet**: a lever.
- **The mix**: the music did not step back at all under a conversation (0 dB).

(Measured again with the QC's seeding fixed, 16 October: its takes had drawn their variation from a bare LCG whose
first draws for neighbouring seeds were 1 % apart, so every synth's takes came out alike. Before: the browser 43 of
71 OK, the engines 30.)

### The fixes (round 1, issue #379)

- **The blade** (`Sound.fluidWindup`, called by `FluidBlade.start` on the swing's first frame, not for the dash cut
  and the riposte, which have their own): the press answered at once, the grip's cloth and the fluid drawn back up the
  blade (`swish`: noise through a band that rises and falls, swelling in), deeper for the heavy third; the cut
  (`fluidSlash`) keeps its moment at the end of the wind-up, now a rising-and-falling swish with its pitch, band and
  length varied (`Sound.vary`, ±7 %), the heavy third with a low weight under it and his effort three times in four
  (`effort`: a recorded take in the browser; `grunt('effort')`, a buzz through two vowel formants and breath, where
  there are no recordings). A hit landed has a bright 30 ms crack before the splat (the hit-confirm), so it never
  sounds like a block.
- **The engines** (engine/game.js): `BodyFoley` and its update, `interactHooks.onUse` (a pick-up), `carryHooks` (set
  down, thrown), `waters.sound` and `player.onSwim`, the steps in water, `onDrink`'s healing chord, `footing` in
  `sound.update`, and the menus (`wrapMenus`). The synth stand-ins for the recordings the engines never play now have
  a body: the hurt (a knock, a low drop and `grunt('hurt')`), the knock-down, getting up, a pick-up.
- **engine/webaudio.js**: an AudioParam with an event inside a 128-sample block is computed sample by sample there;
  interpolating the block from its ends had let a gain's default 1 leak into the samples before a scheduled note's
  first event (the purchase's +10 dBFS, a click on every delayed note of a chime run).
- **The menus** (`Sound.ui(kind)`, src/ui-sound.js `uiKind`): move, confirm, back, tab, open, close, no; on a bus of
  their own to the master (`uiOut`, `UI_LEVEL` × the effects volume: the world's bus is hushed under a menu); a held
  stick ticks at most every 40 ms, the same kind twice within 60 ms once (a click and the pad's press). main.js plays
  them from the panels' toggles, the pad's menu actions and directions, the keys and clicks in a menu; engine/game.js
  wraps EngineMenus' key, action and navigate and hears it open and close. A conversation's answer calls
  `toolClick` (it did not exist).
- **New**: `lockOn(on)` (a tick and two glassy notes rising, falling as it lets go: was the gun's stun chirp),
  `quest(kind)` (start: an open fifth left hanging; step: the chime; done: bells up to a held top over a low one),
  `shutter()` (photo mode), `toss()` (a thrown carried thing), `doorOpen()` (a temple door's bolt, then the whoosh at
  0.8), a louder lever (`critter('clank')`).
- **Levels**: the recorded steps 2.5 dB down (sprinting a further 1 dB), the grab 2.5, the stroke 4.6; the heartbeat
  a third of its level (-6 against the music); the gun's shot, its mode and its empty click, the double jump's lift
  1.5-5 dB down; the heavy third's take 1 dB down. **Variation** added to the cork, the charge, the shield, the scout,
  the potion picked up, the riposte.
- **Ducking**: the music bus × `TALK_DUCK` (0.6, -4.4 dB) while a conversation's or a call's voice plays (`speak`
  sets `_duckUntil` to its end; `hush('talk')` lets it go), in over 0.3 s, back over 0.8 s.

Tests: `tests/action-sounds.test.js` (heard, bounded, varied; the menus under the hush; the lock and the quests told
apart; the duck; the shim's click), `tests/engine-sound.test.js` (the engines' game driven by keys: the press in its
frame, the body, the healing chord; the menus' kinds), `tests/sound-qc.test.js` (the QC itself).

After: 71 of 71 OK in the browser and in the engines; the press to the first sound 133 → 0 ms; the music -4.3 dB
under a conversation; the fight's loudest moment -20.0 dBFS, peak -6.3 (+4.7 against the music). The key actions:

| action | browser before → after | engines before → after (press) |
|---|---|---|
| the blade pressed | missing → OK -11.7 | missing (133 ms) → OK -11.8 (0 ms) |
| the combo's cuts | OK -2.6 / -0.9 / +0.4 → OK -1.3 / -1.2 / +2.0 | OK -2.3 / -1.6 / -1.9 → OK -3.1 / -2.0 / -4.5 |
| a cut landing | OK +2.6 → OK +2.7 | OK -2.0 → OK -0.9 |
| a footstep, sprinting | too loud -6.0 → OK -9.2 | OK -12.3 → OK -12.3 |
| a jump, landings, the roll | OK | missing → OK (-14.4, -12.9 / -5.2, -10.6) |
| taking a blow | OK +1.0 → OK -0.2 | too quiet -18.1 → OK 0 |
| knocked down | OK +1.9 → OK +2.0 | missing → OK -0.6 |
| the heartbeat | too loud +0.6 → OK -6.2 | too loud +0.6 → OK -6.2 |
| the hearts coming back | OK +2.2 | missing → OK +2.2 |
| locking on | too loud -2.6 → OK -10.8 | too loud -2.6 → OK -10.8 |
| picking something up | OK -6.5 → OK -1.0 | missing → OK -1.2 |
| a quest given / a step / done | alike +3.3 → OK -1.0 / +3.3 / +2.5 | the same |
| the menus (open, close, move, confirm, back) | missing → OK -9.4, -10.7, -15.2, -8.3, -10.6 | the same |
| an answer chosen | missing → OK -8.3 | the same |
| buying in a shop | too loud +10.2 (peak +10 dBFS) → OK -0.3 | the same |

What is left: the engines still play no recorded effect (engine/unity/music.js decodes the music only), so in Unity
the body is its synth stand-ins; the QC drives the engines' build, not the browser (main.js's wiring is checked in
the code, not pressed); no voice limits or priorities beyond `vocal`'s gap and the balloons' count; the loudness is a
50 ms window per sound against the score, not integrated LUFS over play.

### The v1.85 run (issue #467, the full audit, 18 October 2026)

`node .claude/skills/sound-qc/run.mjs` on main `8f01feae5`, judged by the code and the renders only (nothing listened
to). 71 actions: **OK in the browser 65, in the engines 66** (round 1's after: 71 / 71). The six not OK are the QC's
own, not the game's:

| action | browser | engines | what the code says |
|---|---|---|---|
| taking a blow ★ | missing | missing | heard: `hurtReactions` (src/host/game-host.js) calls `s?.hurt?.(h, why)` for both hosts since #435; the QC still looks for `sound.hurt(` in src/main.js and engine/game.js. The drive presses it (press 0 ms) |
| a potion uncorked ★, the hearts coming back ★ | missing | missing | heard: game-host.js `sound?.potion?.('open')` and `onDrink`'s `potion?.('heal')` (both hosts); the drive hears the healing chord 433 ms after the press |
| a chime picked up ★, a potion picked up | missing | missing | heard: game-host.js `chimePickup` / `potionPickup` in the drops' `onTake` (both hosts) |
| a perfect dodge's flurry | missing | OK | heard: game-host.js `startFlurry` calls `sound?.flurry?.(true)` (both hosts) |

Every level, length, onset and spread is where round 1 left it (the same numbers to 0.1 dB); nothing repetitive, nothing
alike, no sample over -1 dBFS; the mix as before (the music -4.3 dB under a conversation, the fight's loudest moment
-20.0 dBFS, peak -6.3).

Two gaps in the QC itself (#499): its code patterns still point at main.js and engine/combat.js for what moved
into the one game setup (#427, #435), so it calls six heard sounds missing; and its mix reference is the procedural
score (`the music's reference`, -24.7 dBFS), while since v1.85 (#474, Music: Always) a world's recording plays all the
time, balanced to -24.3 to -25.4 LUFS (above): the bands should be held against what plays. Not covered by the list:
the gadgets' own sounds (the hook, the bomb, the boomerang, the magnet, the bubble, the fan, the springs, the recall, the
lens: each calls the Sound in src/gadgets/, none measured). Still as round 1 left it: Unity plays no recorded effect
(engine/unity/music.js: "Only music"), so its body is the synth stand-ins.

**The QC fixed (#499, 19 October 2026).** Its patterns look for what the one game setup wires where it now lives
(src/host/game-host.js `hurtReactions` and `wireFight`, plus each host's use of them: main.js, engine/game.js,
engine/combat.js), and tests/sound-qc.test.js fails when a pattern stops matching. The list grew from 71 to 116 rows:
the glove's six modes, its stilling and ember shots, the push, the refill and the dock; the gadgets (switch, i.e. one
taken in hand; each one's fire; the held ones' hum, wind, tick and scratch: the hook, the bombs, the boomerang, the magnet
glove, the bubble wand, the fan, the spring boots, the hourglass, the lens, the pen); a foe's telegraph, a fight
temple's wave, kill, pick-up and cleared room. The mix's reference is now the recording that plays, at the engines'
gain (src/theme-levels.js), once round its loop; the procedural score is the fallback and is measured beside it.

| | browser | engines |
|---|---|---|
| before (the v1.85 run, 71 rows, against the score) | 65 / 71 | 66 / 71 |
| after, round 1's 71 rows, against the score | **71 / 71** | **71 / 71** |
| after, all 116 rows, against the score | 96 / 116 | 96 / 116 |
| after, all 116 rows, against the recording (the reference now) | 25 / 116 | 28 / 116 |

- **The music's level (#530).** The recordings play well under the score: the desert's -31.6 dBFS (the score -24.6),
  the bazaar's -30.4 (-24.4), home's -29.1 (-26.0). Every effect therefore sits about 7 dB further over the music than
  round 1 balanced it, and nearly every row comes out "too loud" against the recording. The voice is +9.5 dB over the
  music (+2.6 against the score), and a fight's loudest moment +11.6 (the limit is +8). Nothing in the sounds changed:
  against the score, round 1's 71 rows are all OK. Whether to raise the recordings, lower the effects or re-anchor the
  bands is the author's call.
- **The gadgets' own (#531)**, the 20 rows not OK against the score, all of them new: the glove's modes fluid,
  push, bloom and tether share one chirp (`fluidMode` has its own only for stilling and ember); seven synths repeat
  (the stilling shot, the hook's reel, the magnet's grab, hum, shove and let-go, and the boots wound full); out of band:
  the push +5.1, the bomb +6.1, the boots' stomp +5.5, the magnet's shove +4.6, the hook fired +2.9, and the lens, the
  hook back empty, the magnet's let-go and the boots wound full over the ui and foley bands; the boots winding is quiet
  (-30.3).
- Unchanged: nothing missing, ducking -4.3 dB, the fight's peak -6.3 dBFS, no sample over -1 dBFS.

**The gadgets fixed (#531, 19 October 2026).** The 20 rows, judged against the procedural score (the music's level is
#530 and untouched). Shared code (src/audio.js, src/gadgets/), so the engines and Unity play the same.
- `fluidMode`: a chirp per mode: fluid a wet rising sine (longer), push a low whump under a dull click, stilling high
  and glassy, ember low and warm, bloom a soft rising pair (880, then 1320 Hz), tether a taut sawtooth twang. The
  shared click is quieter (0.05 to 0.02): it set every mode's brightness and level, so the chirps could not be told apart.
- Varied (`Sound.vary`, and in src/gadgets a `vary(s)` that is 1 without a Sound): the stilling shot (pitch, gain, the
  second note's timing), the hook's reel (pitch, gain, the clicks' spacing and 5 to 7 of them), the magnet's grab, hum,
  shove and let-go, the boots wound full; also the hook fired and back empty, the push, the bomb, the boots' stomp.
- Levels: push ×0.3, the bomb ×0.4, the stomp ×0.42 (the fx bus compresses the loud ones: a cut of 10 dB in gain gives
  about 5 dB), the hook fired ×0.68, back empty ×0.5, the magnet's shove ×0.55 and let-go ×0.54, the boots wound full
  ×0.56, the lens raised ×0.46 and lowered ×0.63, stilling's chirp 0.048 to 0.026; the boots winding ×2.4.
- tests/sound-qc.test.js renders the 21 (with ember) as the QC does and holds them to OK and the six modes apart.

| row | level before → after (dB vs the score) | spread before → after (dB / brightness %) | verdict before → after |
|---|---|---|---|
| glove: fluid | -6.5 → -7.6 | 0.3 / 38.4 → 0.1 / 40.4 | alike → OK |
| glove: push | -6.5 → -9.4 | 0.3 / 38.4 → 0.2 / 7.8 | alike → OK |
| glove: stilling | -4.6 → -9.8 | 0.2 / 33.4 → 0.2 / 33.9 | too loud → OK |
| glove: bloom | -6.5 → -9.9 | 0.3 / 38.4 → 0.3 / 13.6 | alike → OK |
| glove: tether | -6.5 → -9.3 | 0.3 / 38.4 → 0.2 / 11.4 | alike → OK |
| the stilling shot | +0.4 → -0.1 | 0 / 1 → 1.9 / 27.6 | repetitive → OK |
| the push | +5.1 → -0.1 | 0.1 / 6.6 → 1.0 / 4.2 | too loud → OK |
| the hook fired | +2.9 → -1.3 | 0.2 / 3.8 → 1.6 / 0.9 | too loud → OK |
| the hook reeling in | -2.5 → -3.6 | 0.1 / 0.5 → 1.7 / 3.6 | repetitive → OK |
| the hook back empty | -5.2 → -11.7 | 0.1 / 2.6 → 1.5 / 5.1 | too loud → OK |
| a bomb going off | +6.1 → +4.2 | 0.2 / 7.4 → 0.3 / 16.6 | too loud → OK |
| the magnet's grab | -4.4 → -5.3 | 0.2 / 1.2 → 1.8 / 2.0 | repetitive → OK |
| the magnet's hum | -9.5 → -10.5 | 0 / 1.1 → 1.9 / 11.4 | repetitive → OK |
| the magnet's shove | +4.6 → -0.2 | 0.2 / 1.4 → 1.4 / 3.2 | too loud → OK |
| the magnet letting go | -5.6 → -11.8 | 0 / 0.4 → 1.8 / 1.7 | too loud → OK |
| the boots winding | -30.3 → -23.4 | 3.9 / 13.6 → 4.1 / 10.9 | too quiet → OK |
| the boots wound full | -4.0 → -9.4 | 0.1 / 1.8 → 1.6 / 3.4 | too loud → OK |
| the boots' stomp | +5.5 → +3.5 | 0.2 / 11.7 → 0.2 / 7.5 | too loud → OK |
| the lens raised | -2.2 → -8.5 | 0 / 7.2 → 0.1 / 6.1 | too loud → OK |
| the lens lowered | -5.8 → -9.5 | 0 / 2.3 → 0 / 3.3 | too loud → OK |

All 116 rows OK against the score, browser and engines (was 96 / 116); against the recording 26 / 116 web, 29 / 116
engines (was 25 and 28), the rest #530's.

### The music raised (#530, 19 October 2026)

The author's call on the music's level above: raise the recordings about 6 dB. `prepareSoundtrack`
(src/soundtracks.js) now brings each recording to `THEME_RMS` = **-21 dB RMS** (was -27), the peak cap `THEME_PEAK`
(0.8, -1.9 dBFS at the loudest sample) kept. `node scripts/theme-levels.mjs` measured the engines' gains at it
(src/theme-levels.js `THEME_LEVELS`, which Unity's streamed recordings play at) and writes beside them the target it
measured at (`THEME_TARGET`) and each recording's loudest sample at its gain (`THEME_PEAKS`). Every gain rose 6.0 dB:
none of the 26 meets the cap (the loudest sample of all, the waterfall's, -5.8 dBFS; home's -11.2; at the music bus and
the master another -5.1 dB). tests/soundtracks.test.js fails while the file was measured at another target, a
recording's peak is over the cap or would clip on the music bus, or the desert's gain is not about 6 dB over its old one.

**The master's compressor doesn't take it back.** Its threshold is -18 dBFS (src/audio.js), and the #531 work found it
squeezes the loud effects. The music sits under it:
- Chrome's own DynamicsCompressorNode, offline: the first 90 s of the recording through the music bus (0.62 × 0.8),
  its reverb send and the master (0.9), with and without the compressor (in the scratchpad, not kept). With it, the RMS
  rose +6.05 dB in the desert, +6.05 in the bazaar and +5.92 at home. Its peaks now reach -12 dBFS, inside its 30 dB soft
  knee, and the knee's make-up gain lifts everything by about 1.8 dB both before and after.
- The engines' compressor (engine/webaudio.js: a hard-knee peak follower) squeezes home's louder peaks a little: the QC
  measures the desert +5.9, the bazaar +5.6, home +4.7.
- Unity streams the recording itself at its level times the gains on its way, outside the graph's compressor
  (engine/webaudio.js `reach`): the full +6 dB.

The sound QC against the recording (`node .claude/skills/sound-qc/run.mjs`, the same commit before and after):

| | before (-27) | after (-21) | at -20 (measured, not taken) |
|---|---|---|---|
| the desert's recording, p95 of 50 ms (the reference) | -31.6 dBFS | **-25.7** | -25.0 |
| the bazaar's recording | -30.4 | -24.8 | -24.0 |
| home's recording | -29.1 | -24.4 | -23.5 |
| (the procedural score: desert, bazaar, home) | -24.6, -24.4, -26.0 | the same | the same |
| a conversation's voice over the music | +9.5 dB | **+3.6** | +2.9 |
| a fight's loudest moment over the music (limit +8) | +11.6 dB | **+5.7** | +5.0 |
| rows OK, browser | 26 / 116 | **103 / 116** | 113 / 116 |
| rows OK, engines | 29 / 116 | **106 / 116** | 114 / 116 |
| against the procedural score | 116 / 116 | 116 / 116 | 116 / 116 |

Nothing clips: no sound's sample over -1 dBFS; the fight's loudest moment peaks at -6.3 dBFS, as before; ducking under a
conversation -4.3 dB, as before. The 13 rows still out are all "too loud" by 0.3 to 1.3 dB. The desert's recording
still sits 1.1 dB under the score the effects were balanced to: the double jump's lift +2.8 (band to +2), the gun's
shot +2.2, the fan +2.3, the heavy third in the browser +3.0, its landing +5.3, the bomb +5.2, the flurry +4.6, a
quest's step and a cleared room +4.3, the heartbeat -5.2 (to -6), the boomerang's aim -5.6, its catch -7.9 and a swim
stroke in the browser -7.9 (to -8). A -20 target (7 dB) clears all but three of them; the author asked for about 6.

### The thirteen trimmed (#566, 20 October 2026)

The music stays where #530 put it (the author's call): the thirteen are trimmed instead, each by its overage and a
margin. Where the master's compressor squeezes a loud sound (the chime, the bomb, the heavy third's landing) a trim
comes back a third to a quarter as big, so those went further down until the QC read them inside their band.
The heavy third and its landing are trimmed only where their recorded takes play (the browser); the engines' synth sat
inside already.

| action | band | before (browser / engines) | trim | after |
|---|---|---|---|---|
| the combo's heavy third | action, to +2 | +3.0 / -3.5 | its take and his effort 1.2 dB | +1.8 / -3.5 |
| the double jump's lift | action, to +2 | +2.8 | 1.0 dB | +1.9 |
| the low-health heartbeat | warn, to -6 | -5.2 | 1.0 dB | -6.2 |
| a perfect dodge's flurry | cue, to +4 | +4.6 | 1.1 dB | +3.7 |
| the boomerang's aim | ui, to -6 | -5.6 | 0.6 dB | -6.2 |
| the heavy third landing | impact, to +5 | +5.3 / +4.0 | 0.9 dB where its takes play | +4.9 / +4.0 |
| the fan swung | action, to +2 | +2.3 | 0.5 dB | +1.8 |
| a quest's step, a room cleared (the chime) | cue, to +4 | +4.3 | 1.8 dB | +3.8 |
| the gun's shot | action, to +2 | +2.2 | 0.4 dB | +1.8 |
| a bomb going off | impact, to +5 | +5.2 | 1.2 dB | +4.9 |
| a swimming stroke | foley, to -8 | -7.9 / -13.1 | its take 0.3 dB | -8.2 / -13.1 |
| the boomerang caught | foley, to -8 | -7.9 | 0.3 dB | -8.2 |

`node .claude/skills/sound-qc/run.mjs`: 103 → **116 of 116** OK in the browser, 106 → **116** in the engines (against
the score 116 both, as before); a fight's loudest moment +5.7 → +5.4 dB over the music; the voice +3.6 and ducking
-4.3 dB unchanged. The engines play the same synths (src/audio.js, src/gadgets/), so Unity has the same trims.
