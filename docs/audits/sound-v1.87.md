# Sound, v1.87 (2026-10-20)

<!-- audit-scores
overall: none
headline: 103 of 116 actions OK in the browser and 106 in the engines against the recording that plays (v1.85: 65 of 71 and 66 of 71 against the score); all 116 OK against the score; the 13 left too loud by 0.1-1.0 dB over their bands; nothing missing, late, repetitive or alike
date: 2026-10-20
-->

The sound-qc skill (`.claude/skills/sound-qc/SKILL.md`) on main at v1.87, for issue #556, against the v1.85 run
(docs/systems/audio.md, "The v1.85 run": the first full audit's sound part lived there; this is its first report of its
own). Every sound rendered on the in-memory Web Audio (engine/webaudio.js), with the recorded takes (the browser) and
without (the synth: the engines and Unity), and the engines' game driven with scripted keys. Nothing was played out loud.

## Setup

- main `3da6e2539` (v1.87), node 24, `node .claude/skills/sound-qc/run.mjs <dir>` (877 s, the Mac at load 11-35).
- The list: 116 actions (v1.85: 71; #499 added the glove's modes, the gadgets, a foe's telegraph, the fight temples).
- The reference: the desert's recording (`desert-bayati.mp3` at the engines' gain 0.69), -25.7 dBFS at the 95th
  percentile of its 50 ms windows (v1.85 measured against the procedural score, -24.7: the recording then played at
  -31.6, issue #530 raised it 6 dB). The score's verdicts are kept beside it.

## Per group (the score table)

OK of the group's actions, against the recording that plays (and against the score):

| group | actions | browser OK | engines OK | browser OK vs the score | engines OK vs the score |
|---|---|---|---|---|---|
| the body | 21 | 18 | 19 | 21 | 21 |
| the blade | 20 | 17 | 19 | 20 | 20 |
| the tool | 17 | 16 | 16 | 17 | 17 |
| the gadgets | 30 | 26 | 26 | 30 | 30 |
| the foes | 5 | 4 | 4 | 5 | 5 |
| the world | 15 | 14 | 14 | 15 | 15 |
| the menus | 8 | 8 | 8 | 8 | 8 |
| **in all** | **116** | **103** | **106** | **116** | **116** |

v1.85: 65 / 71 browser and 66 / 71 engines against the score, the six not OK the QC's own stale patterns (#499).

## Not OK against the recording (all "too loud", by how much over the band's top)

| action | role | browser (dB vs the music) | engines | over the band by | ★ |
|---|---|---|---|---|---|
| the combo's heavy third | action | +3.0 | -3.5 (OK) | 1.0 (browser) | ★ |
| the double jump's lift | action | +2.8 | +2.8 | 0.8 | |
| the low-health heartbeat | warn | -5.2 | -5.2 | 0.8 | ★ |
| a perfect dodge's flurry | cue | +4.6 | +4.6 | 0.6 | |
| a mark on its way (the boomerang's aim) | ui | -5.6 | -5.6 | 0.4 | |
| the heavy third landing | impact | +5.3 | +4.0 (OK) | 0.3 (browser) | ★ |
| the fan swung | action | +2.3 | +2.3 | 0.3 | ★ |
| a quest's step done | cue | +4.3 | +4.3 | 0.3 | ★ |
| a fight temple's room cleared | cue | +4.3 | +4.3 | 0.3 | |
| the gun's shot | action | +2.2 | +2.2 | 0.2 | |
| a bomb going off | impact | +5.2 | +5.2 | 0.2 | |
| a swimming stroke | foley | -7.9 | -13.1 (OK) | 0.1 (browser) | |
| the boomerang caught | foley | -7.9 | -7.9 | 0.1 | |

The same thirteen, to the tenth of a dB, as the "after" of #530 (docs/systems/audio.md, "The music raised"): nothing in
the sounds or the music has moved since. Nothing missing, late (every driven press under 100 ms to its first sound but the
landings and the heartbeat, which answer an event, not a press), repetitive or alike; no sample over -1 dBFS.

## The mix

| | p50 | p95 | max |
|---|---|---|---|
| the desert's recording | -28.5 | -25.7 | -23.2 |
| the bazaar's recording | -28.6 | -24.8 | -23.0 |
| home's recording | -27.4 | -24.4 | -20.5 |
| (the desert's score) | -28.1 | -24.6 | -22.3 |

- a conversation's voice +3.6 dB over the music (v1.85: +9.5 against the recording then); ducking -4.3 dB (the same);
- a fight's loudest moment +5.7 dB over the music (limit +8; v1.85 +11.6), peak -6.3 dBFS (the same).

## The v1.85 findings, one by one

| v1.85 | now | evidence |
|---|---|---|
| six heard sounds called missing (the QC's patterns, #499) | **fixed** | nothing missing in 116 rows; tests/sound-qc.test.js holds the patterns |
| the mix measured against the score, not the recording that plays (#499) | **fixed** | the reference is the desert's recording at the engines' gain |
| the gadgets' own sounds not measured (#499, #531) | **fixed** | 30 gadget rows, 26 OK against the recording, 30 against the score |
| the recordings ~7 dB under the score: every effect too loud over the music (#530) | **partly fixed** | raised 6 dB: 26 → 103 of 116 OK in the browser; 13 rows over by 0.1-1.0 dB (above) |
| Unity plays no recorded effect: its body is the synth stand-ins | not fixed (by design) | engine/unity/music.js "Only music"; the heavy third is 6.5 dB quieter in the engines than in the browser (-3.5 against +3.0), a swim stroke 5.2 dB |

## Findings

| # | severity | what | cause | fix |
|---|---|---|---|---|
| 1 | only when listening | thirteen effects 0.1-1.0 dB over their bands against the music that plays, five of them key actions (the heavy third and its landing, the heartbeat, the fan, a quest's step) | the effects were balanced to the score, which still sits 1.0 dB over the desert's recording; #530 raised the recordings 6 dB, the author's call ("about 6"), not the 7 that would clear them | trim each by its overage (+0.2 dB of margin) in src/audio.js / src/sfx.js, or the recordings' target 1 dB higher: #566 |
| 2 | look | the heavy third and a swim stroke much quieter in the engines (Unity) than in the browser (6.5 and 5.2 dB) | the browser plays a recorded take, the engines the synth stand-in (by design: Unity plays music only) | none: inside the band in both; noted for parity |

## What was not checked

Listening (the levels are a guide, not the ear: `music.html`, Effects), the devices' own outputs (the Deck's, the Xbox's,
the Retroid's speakers), Unity's real audio thread (the engines' build of the game on the in-memory Web Audio stands for
it), and the side worlds' sounds.
