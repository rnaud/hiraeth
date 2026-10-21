# Selected ElevenLabs sound masters

These eleven original WAV exports were starred and selected by the author on 21 October 2026.
They are generated ElevenLabs Sound Effects v3 outputs, **not CC0**. `downloaded-manifest.json`
preserves the download identities/prompts/hashes; `manifest.json` adds runtime groups, selected
footstep intervals, headroom and pitch-preserving deck fitting. Older starred combat alternatives
are not included in this runtime selection.

Rebuild runtime derivatives with `python3 scripts/sfx/import-approved.py` from the repository root.
Only `public/sfx` derivatives ship. These unmodified stereo 48 kHz masters remain editable sources.
The three footstep prompts requested four steps but the exports contain extra contacts; measured
20 ms RMS clusters identify four non-overlapping individual contacts in each chosen master.

The two six-second deck cues use `atempo=1.428571428571`, then exact 4.2-second padding/trimming,
so the hydraulic sound fits the mechanism without a six-semitone pitch rise. Idle/thrust loops use
a 150 ms end-to-start crossfade. Numeric boundaries and silent decoding do not imply an auditory
preference judgement; the user selected the source takes.
