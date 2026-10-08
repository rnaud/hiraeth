# Visual audit · v1.0 · 8 October 2026

Base: `c4f553ce` (pulled from main). The working tree also contains the cinematic review page;
no renderer or world-art fixes were made during this audit. This is the first `visual-v*.md`
report, so it establishes a baseline rather than claiming regressions or verified fixes.

## Setup and coverage

Used `.claude/skills/visual-audit/SKILL.md` and its `views.mjs`: **234 stills in 25 worlds**,
1280 × 720, High, hours 7, 12, 18.5 and 22, clear weather, hidden HUD, muted Chrome.
Real GPU verified: **ANGLE Metal, Apple M4 Pro**. Every still was inspected in labelled contact
sheets, with close views for the cave and traveller. The final capture set has no page exceptions.
Lorn was recaptured after a temporary Vite import error while the review page was being created;
the replacement data is included in [measurements.json](visual-v1.0/measurements.json).

The script uses up to three existing benchmark views per route world and up to six portal views.
The twelve side worlds and Lantern have no benchmark views in that file, so their four pictures
are spawn views. A portal's destination can be outside; “inside” in a filename is not proof of
interior coverage. Home has no portal views. This is a broad survey, not a certification of every
room, surface, cinematic frame or device.

## Findings

| Severity | Where | Picture / evidence | Observation, likely cause and next check |
|---|---|---|---|
| Noticeable | Moon Foundry, NPC `ivo`, (-83.11, 13.06, -146.17), noon, High | [The building hiding the NPC](visual-v1.0/moonfoundry-hidden-npc.webp) | The live clipping audit reports the NPC inside a solid; a camera looking at the reported position from 5 m away sees the opaque building instead. Likely content placement/route intersects the bowl-area geometry (`src/levels/moon-foundry.js:121`), rather than a shader failure. Move the spawn/route onto a verified exterior walkable point and check the full route. |
| Noticeable | Desert, first-flow cinematic, second panel, daytime, High | [Cave ribs and walls](visual-v1.0/desert-cave.webp) | Dense rib strokes produce visible nested interference bands while the floor and wall are covered in very fine hatching. The lit ribs look busier than their surrounding forms. Likely sampling interaction in the surface hatching (`src/materials.js:1007`, `:1085`, `:1110`; `HATCH_AA` at `:149`). Compare the exact shot with hatching disabled, then vary internal scale before adjusting the fade. This capture demonstrates the pattern; the precise shader cause remains a hypothesis. |
| Only when looking | Desert, spawn pan, 09:30, High | [Motion heat map](visual-v1.0/desert-pan-heat.webp) | Fine detail on the rib cage and small ground props is the main temporal hotspot. Mean flicker 31.30 per 10,000 pixels, peak 32.29. Frame-strip inspection shows small line/detail changes, not a whole-scene flash. Likely thin surface strokes and ink edges (`src/materials.js:149`, `src/post.js:364`). Run feature-off comparisons before changing either. |

**Counts: 0 breaks the picture, 2 noticeable, 1 only when looking.** These are first-baseline findings, not proven regressions. The Moon Foundry NPC needs a placement fix; the two sampling findings need shader A/B confirmation.

No “breaks the picture” defect was established in this survey. No NaN-magenta, crushed-black
or blown-white threshold was triggered. All thirteen automatic flags were dominant-colour flags:
Vael (2), Hangar (3), Buried Machine (4), Spheres (1), Home (3). Most are deliberately broad sand,
grass or roof planes, not missing rendering.

One capture-quality issue deserves correction before the next audit:
[Hangar crowd2](visual-v1.0/garage-occluded-view.webp) points into a nearby wall, and the Desert's
spawn benchmark looks against a hull. These are poor audit viewpoints, not demonstrated gameplay
camera failures. Update `scripts/bench/viewpoints-worlds.json` and `scripts/bench/viewpoints.json`
against current geometry. Do not “fix” the renderer to satisfy a dominant-colour threshold.

The traveller's face is present and readable in the tank-fill close-up, with no empty portrait or
obvious eye clipping in that shot. The open TODO about its style and eyes remains an art-direction
question; this audit does not mark it resolved. The desert cave retains coloured shade, but this
limited comparison does not clear the wider TODO about shadows in caves/interiors.

## Motion checks

Used the skill's `scripts/motion-check/serve.mjs` and `record.mjs`, built game, High,
1280 × 720 at DPR 1, muted real GPU, 36 deterministic frames per path. Captured pan and zoom for
Desert, City-Shaft and Buried Machine; reviewed decoded frame strips and heat maps.

| World / path | Mean flicker / 10,000 px | Peak | Interpretation |
|---|---:|---:|---|
| Desert pan | 31.30 | 32.29 | Small-detail hotspot around ribs and props; see finding above. |
| City-Shaft pan | 16.54 | 21.71 | Lower than the other two pans in this sample. |
| Buried Machine pan | 26.37 | 27.84 | Detail on the machinery; further isolation needed. |
| City-Shaft zoom | 849.16 | 2061.63 | Camera passes foreground geometry; not comparable to a slow pan. |
| Buried Machine zoom | 1098.31 | 1711.14 | Strong perspective/occlusion changes across machinery, not proof of an LOD pop. |

The zoom residual peaks were 8425.85 and 3899.68 pixels per 10,000 above the threshold,
respectively. Inspection shows foreground objects leaving the frame and large changes in visible
surface area. These are diagnostic spikes, not confirmed shadow/cascade failures. Desert zoom
was skipped by the tool because it found no suitable wall. The short 36-frame runs are screening
passes; longer paths, quick turns, climbers and a full-world motion survey remain unchecked.

Raw stills are in `/tmp/moebius-visual-audit`; raw motion clips, frame images and JSON in
`/tmp/moebius-motion/{desert,incal,buried}`. Those scratch paths are local and temporary.
Only finding pictures and small measurement data are retained here, below the 3 MB limit.

## Clipping and contact baseline

Clipping uses the live world's `clipAudit`. Contact uses `scripts/contact-report.mjs` across all
25 surveyed worlds (plus Atelier, which reported no contact flags). Counts below are candidates,
not confirmed visible bugs: contact counts are sample hits, multiple hits can describe one object,
and intentional floating structures, rotated gravity and moving carriers need contextual review.
There is no previous visual report to compare counts against. Follow-up close views checked the Fallen Ring and Moon Foundry NPC flags. The Fallen Ring NPC was visible above the surface in its sampled pose, so its numeric flags were not promoted to a confirmed visual finding; the Moon Foundry NPC was occluded by its building, as recorded above.

| World | Pictures | Clipping flags | Contact flags (sample hits) |
|---|---:|---|---|
| desert | 18 | box: 1, thing: 1, prop: 6 | feet sink 4, feet hover 2, climbs off 15, climbs inside 14, walks through 39, carrier hovers 16, carrier sinks 9 |
| arzach | 15 | prop: 52 | feet sink 6, climbs inside 6, climbs off 2, walks through 39, carrier hovers 9 |
| arzach2 | 15 | npc: 1, box: 1, prop: 40 | feet sink 1, climbs inside 4, climbs off 8, carrier hovers 32, carrier sinks 5 |
| perdide | 15 | box: 1 | feet sink 3, climbs inside 4, climbs off 8, walks through 7 |
| perdide2 | 15 | box: 1, prop: 12 | feet sink 5, climbs inside 1, climbs off 1, walks through 1, carrier hovers 6 |
| edena | 17 | thing: 1, prop: 7 | feet sink 4, climbs inside 6, climbs off 4, walks through 28, carrier hovers 25 |
| incal | 15 | relic: 1, prop: 6 | unseen floor 1, climbs off 2, carrier hovers 93, carrier sinks 109 |
| garage | 15 | prop: 16 | feet sink 4, climbs inside 10, climbs off 8, walks through 2, carrier hovers 24, carrier sinks 1 |
| buried | 15 | box: 1, thing: 1, prop: 2 | feet sink 24, unseen floor 1, feet hover 1, climbs inside 27, climbs off 13, walks through 4, carrier hovers 24, carrier sinks 1 |
| spheres | 15 | box: 1, prop: 10 | feet sink 63, feet hover 18, unseen floor 4, climbs inside 36, climbs off 30, walks through 211, carrier hovers 29, carrier sinks 4 |
| bazaar | 15 | crowd: 2, prop: 3 | feet sink 3, climbs inside 4, climbs off 1, carrier hovers 31, carrier sinks 5 |
| mangrove | 4 | 0 | feet sink 1, climbs inside 6 |
| glassdunes | 4 | 0 | climbs inside 1, walks through 2 |
| waterfall | 4 | 0 | feet sink 2 |
| saltharbour | 4 | 0 | feet sink 2, climbs inside 24, walks through 4 |
| antennas | 4 | prop: 3 | climbs inside 3, walks through 1 |
| underwater | 4 | prop: 3 | feet sink 57, climbs inside 175, walks through 94 |
| eclipse | 4 | 0 | feet sink 16, climbs inside 13, walks through 3 |
| fallenring | 4 | npc: 2 | feet sink 2, climbs inside 13 |
| moonfoundry | 4 | npc: 1 | feet sink 22, climbs inside 2, walks through 10 |
| underside | 4 | 0 | feet sink 4, walks through 4 |
| spacecity | 4 | 0 | feet sink 16, climbs inside 105 |
| overnighttrain | 4 | prop: 2 | feet sink 2, climbs inside 1, walks through 1 |
| home | 12 | 0 | climbs inside 3, walks through 13 |
| lantern | 4 | 0 | feet sink 5, climbs inside 4, walks through 1 |
## Next work and limits

Prioritize the Moon Foundry NPC placement, then an A/B of the cave's hatch sampling, then the Desert pan's thin-detail shimmer.
Repair the obstructed benchmark views and add authored interior/landmark views for the side
worlds before drawing broader conclusions from this survey. The larger contact counts in the
Spheres, Underwater City and moving carriers deserve targeted placement checks.

Not checked: Android/Steam Deck hardware, Handheld/Low presets, all character expressions,
portrait library, every door/cave, every reference-sheet comparison, every cinematic to completion,
all hours between samples, full motion survey and close climbing/rapid-turn shadow stress tests.
The new `cinematics.html` supports subsequent shot-by-shot QC; playback smoke tests are not a
claim that all 91 entries have passed visual quality control.
