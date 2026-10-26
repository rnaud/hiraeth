# The mix and one route's pacing, v2.28 (2026-10-25)

<!-- audit-scores
overall: none
headline: Six mix defects fixed with numbers (stacked clangs, the shards' stack, the weather under a voice, two repeats); the Desert's first fragment made audible where the game says it sings
date: 2026-10-25
-->

Issue #638 ("Game feel 6/6: exploration pacing and a clear, restrained sound mix"), branch `claude/issue-638` from
`8d9d0cd6d`. Two parts: the mix's hierarchy and its repeated events, measured offline; and one short route's pacing,
measured from the game's data. Muted throughout: everything is rendered to numbers on the in-memory Web Audio
(`engine/webaudio.js`); no browser, no device, nothing played out loud. Numbers are not a listening verdict.

## How it was measured

- `node .claude/skills/sound-qc/run.mjs` (the full sound QC, 116 + 3 new rows), before and after; its reference is the
  Desert's recording at the engines' gain, −25.7 dBFS (95th percentile of 50 ms windows).
- `node scripts/sound-qc/mix-638.mjs` (new, this issue): the hierarchy (each sound alone, K-weighted loudest 50 ms in
  dBFS), stacks (the same event called n times in one frame, as the game does for n foes), six takes' spreads, and the
  ambience bed with and without a line holding the floor. Before = the same script on `8d9d0cd6d` (changes stashed).
- `node scripts/level-design/audit.mjs <scratch>/level --worlds desert` and `tests/playthrough-agent.js loadWorld` for
  the route; distances are straight lines on the ground.

## The mix: hierarchy

Loudest 50 ms, dBFS (after; the sound-QC's level against the music in brackets).

| sound | dBFS | role |
|---|---|---|
| a clean hit landing | −8.4 (+3.7) | decisive contact |
| a conversation's voice | −14.9 (RMS +3.6 over the music, the music ducked −4.3 dB under it) | dialogue |
| the guard's clang | −16.7 (−1.6) | contact |
| a cut on armour | −15.9 (−0.3) | contact |
| a pickup | −17.8 (+4.0; −17.0 before its trim) | reward |
| a discovery | −16.8 | reward |
| the temple clock's tick / last seconds | −23.8 / −24.2 (−8.0 / −6.8, the warn band −26..−6) | warning |
| a footstep, sprinting / walking | −26.5 / −28.1 (−13.3 walking, foley band −26..−8) | movement |

The order is the one the issue asks for: contact and reward over the voice's peaks, the voice clearly over footsteps
(13 dB) and the clock, walking the quietest thing the player makes. Nothing here needed moving except the six defects
below.

## The mix: defects found and fixed

| defect | before | after | fix |
|---|---|---|---|
| three guarded foes met by one swing: three clangs stacked | −6.8 dBFS (louder than a clean hit) | −16.7 (one clang) | `CONTACT_GAP` 0.07 s on `foeGlance` and `foeArmour` |
| three armoured foes in one swing | −8.0 | −15.9 | same |
| the shards' ring cutting four foes in one frame: four slash-hits | −3.1 dBFS, 4 calls | −8.4, 1 call | one `fluidSlashHit` a pass (`SpellCaster.shardsCut`) |
| the clang's six takes alike (machine-gun) | 0.3 dB / 2.1 % brightness | 0.1 dB / 6.0 % | ±6 % pitch (`pitched()`), placed where it struck |
| a hop's landing too loud for movement, and alike | −7.1 vs the music (band to −8), 0 dB / 1.3 % | −9.3, 1.9 dB / 70.9 % | his soft-landing breath 1.5 dB down, ±2.5 % rate, ±12 % level |
| the pickup over its band, and alike | +4.5 (band to +4), 0 dB / 0.4 % | +4.0, 0.3 dB / 2.3 % | 0.5 dB down, ±3 % rate, ±6 % level |
| the weather doesn't step back for a voice | storm wind −38.0 dB RMS under a line; voice 15.9 dB over it | −44.1; 22.0 dB over | `AMBIENCE_TALK_DUCK` ×0.5 on wind, howl, rain, roof rain, falls; the bed's occasional events wait |

No new samples, imports or generated sounds: levels, take spreads and rate limits only. The temple clock, the spells'
reused sounds (one call per cast) and the foes' entrances and attack trails (no sound of their own) were checked and left.
Still open in the full sound QC, all from before this change: the heavy third's swing +2.4 against the music (band to
+2) and the shield opening's takes alike (1.9 %); the engines' fallback column "missing" for recorded-only actions, which
is the decode-disabled fallback, not current Unity.

## One route: the landing to Qanat, in the Desert

The first route a new player walks: from the ramp's foot (122.6, 362.6) to the Speaker under the dark tree (195.1,
339.3), 76 m. Measured on the audit's map and places:

- **Landmark:** Qanat's dark tree and the camps' smoke, ahead along the spawn's heading (the audit: 6 landmarks seen
  from the landing, 90 % of the path sees one).
- **Approach:** 76 m, straight; Marrow at 7 m, the camps' people at 51–60 m off the line.
- **Choice:** none that the player can perceive. The errand "Something Singing" (Marrow: *"It sings by the stone cairn
  beside your ship"*; the traveller asks *"What's that singing out on the sand?"*) sits at the pilgrims' cairn 31.2 m
  from the ramp's foot, behind and to the right, and 41.8 m from Marrow. A fragment sang only within 26 m, its song
  placed with a 30 m reach (so ~20 m in practice). From the ramp and from Marrow it was silent: the line asked about a
  sound that wasn't there, and the only optional pull at the landing had no cue. `docs/systems/fragments.md` said "you
  hear the nearer one sing from the ramp (26 m)", true before the controlled landing moved the ship.
- **Reveal / payoff:** taking it gives the toast and the light's phrase; the second fragment on the next cairn (39 m
  further along the pilgrims' road) was silent from the first's cairn, so the payoff led nowhere.

The Desert's optional pull is the lowest of its scores (3: 8 of 51 optional places pulling, 28 remote).

### The edits (two, both a localized cue, no marker)

1. **The first fragment carries 48 m** (`FRAGMENT_CARRY` in `src/fragments-data.js`, its song placed with a 54 m
   reach). From the ramp's foot it is a faint call behind you (song level k = 0.35) while the tree stands ahead: a
   local choice at the first step. From Marrow (k = 0.13) his line now answers something heard.
2. **The second carries 48 m too**: once the first is taken (the payoff keeps its full phrase interval), the next calls
   from 39 m down the pilgrims' road, then the road turns back to the ship (56 m from the ramp): a short loop that
   rewards the detour and returns the player where the main route starts. Every other fragment still sings within
   26 m (`tests/fragments.test.js`).

Not done, by choice: no new geometry, markers or HUD; the city route is unchanged. Whether players now take the detour
unprompted and can describe it is a playtest question (#638's acceptance), not a number.

## What was not checked

- Listening: no sound was heard; the numbers are offline renders.
- Unity: every change is in the shared modules the engines build (`src/audio.js`, `src/action-sfx.js`,
  `src/foes.js`, `src/spells/caster.js`, `src/fragments.js`; `engine/game.js` uses them as they are). The sound QC's
  engine column (engine/game.js bundled, sound on, samples disabled) shows the same clang and armour levels. Not built or
  run in the Unity editor or on a device.
- The fragment's song was not checked in the running game's browser; its reach and level are the same calls the
  tests make.
