# Sound, v1.90 (2026-10-20)

<!-- audit-scores
overall: none
headline: All 116 actions pass for recorded browser effects and engine synths; mix, response and variation pass
date: 2026-10-20
-->

Fresh sound-qc on frozen `c5449ab6c`, Node 24 on the shared Mac, 166.67 s, exit 0. One process; load 3.94 at start and 8.43 at end. No browser, speaker playback or device used. Exact command, time and load are preserved in node-execution.json. Full 116-row measures and all engine call traces: sound/sound-qc.json and sound/sound-qc.md.

## Score table

| Group | Actions | Browser OK | Engine OK | Browser vs score OK | Engine vs score OK |
|---|---|---|---|---|---|
| the body | 21 | 21 | 21 | 21 | 21 |
| the blade | 20 | 20 | 20 | 20 | 20 |
| the tool | 17 | 17 | 17 | 17 | 17 |
| the gadgets | 30 | 30 | 30 | 30 | 30 |
| the foes | 5 | 5 | 5 | 5 | 5 |
| the world | 15 | 15 | 15 | 15 | 15 |
| the menus | 8 | 8 | 8 | 8 | 8 |
| **Total** | **116** | **116** | **116** | **116** | **116** |

All key actions pass. Nothing missing, too late, too long, repetitive or alike by the QC rubric. Recorded takes decoded successfully. The comparison reference is the desert recording at gain 0.6899, p95 −25.7 dBFS; procedural score reference −24.7 dBFS.

## Mix

- Conversation voice +3.6 dB over music; ducking −4.3 dB.
- Combined fight peak −7.0 dBFS, loudness +5.4 dB over music (limit +8 dB).
- Desert recording p50/p95/max: −28.5/−25.7/−23.2 dBFS; Bazaar: −28.6/−24.8/−23.0; Home: −27.4/−24.4/−20.5.
- No mix warnings and no engine scenario exceptions.

## Against v1.87

The thirteen 0.1–1.0 dB excesses are resolved: browser 103→116 passing, engine 106→116. The individual trims in audio.js/sfx.js are effective against the recording that actually plays, not just against the score. The prior intentional distinction remains: browser recorded effects versus engine synthesized effects can have different timbre/levels inside the same acceptable band. A matching verdict does not imply identical sound.

No sound recommendation follows from this numerical pass. Listening remains necessary before judging timbre, musical fit or comfort; no listening was requested or performed. Device speakers and Unity’s real audio thread remain unchecked. Engine drive emits “Recorded soundtrack unavailable; keeping the procedural score” in its no-fetch VM; this does not invalidate the separate successfully decoded recording reference/mix measurements shown above, nor prove a production soundtrack failure.
