# What the new surface materials cost (October 2026, v2.31)

<!-- audit-scores
overall: none
headline: of fifteen new patterns only the ground's middle distance costs a measurable frame (1.0–1.9 ms at 1920 × 1080 High, fixed to 0.85–1.25) and paving watches at 0.8; none adds a program, a load second or a Unity variant
date: 2026-10-27
-->

Issue #694. The author: “are all the materials we created performant?” Every surface pattern landed between 24 and
26 October (#669, #677, #685, #686, #691, #693, #696): paving (`S_PAVING`), the interiors (`S_INTERIOR`), sheet metal
(`S_SHEET`), timber (`S_TIMBER`), the ground's middle distance (`S_GROUNDMID`), sea walls (`S_SEAWALL`), pale stone
(`S_PALESTONE`), the buried city (`S_BURIED`), the domes (`S_DOMES`), water channels (`S_CHANNEL`), rock tops
(`S_ROCKTOP`), Lorn's crystals (`S_CRYSTAL` and their new geometry), garden beds (`S_BEDS`), the makers' machined
finish (`mkFinish`) and the painted relief (`uRelief`).

## Verdict per pattern

| Pattern | Where it covers most | Cost measured (worst view) | Verdict |
|---|---|---|---|
| ground's middle distance `S_GROUNDMID` | Vael, the Buried Machine, Home, the Glass Dunes (the open ground) | High 1920 × 1080: +1.0 to +1.9 ms; Handheld 2560 × 1440: up to +0.9 | **fixed**: 0.85–1.25 ms on High (same picture), Handheld 0.1–0.6 |
| paving `S_PAVING` | Moon Foundry, Underwater City, City-Shaft, Signal Market | High 1080: +0.8 (Underwater crowd2, Moon Foundry crowd2); Handheld 1440: up to +0.4 | **watch** (Retroid unmeasured) |
| rock top `S_ROCKTOP` | Vael, Moon Foundry | +0.4 (Vael crowd2, within noise elsewhere) | fine |
| pale stone `S_PALESTONE` | Vael, Home, City-Shaft, Lorn | +0.4 at most, mostly ±0.2 | fine |
| painted relief `uRelief` | everywhere | ±0.2 (one +0.4 in the Glass Dunes, not repeated) | fine |
| sheet metal `S_SHEET` | Moon Foundry, City-Shaft, Signal Market | +0.2 at most | fine |
| timber `S_TIMBER` | six worlds | +0.2 at most | fine |
| garden beds `S_BEDS` | Viridel, Home | +0.2 at most | fine |
| Lorn's crystals `S_CRYSTAL` | Lorn | +0.2 at most; triangles +2–17 % since #693 | fine |
| sea walls `S_SEAWALL` | Underwater City | +0.2 at most | fine |
| buried city `S_BURIED` | Glass Dunes | +0.1 at most | fine |
| machined finish `mkFinish` | every temple, makers' courts | +0.1 to +0.3 in the temples | fine |
| interiors `S_INTERIOR` | every shop and room | shops +0.0 to +0.5 with every pattern off (High 1080) | fine |
| domes `S_DOMES`, channels `S_CHANNEL` | the Desert's far dome city, its water channels | in no benchmark view (the domes kilometres off); their GLSL the smallest of all | fine, not measured on screen |

“Cost” is the frame time with the pattern on minus off, in the same page at the same pinned camera (below). Every
number on the Mac; the Retroid was not connected.

## Setup

- **Machine**: MacBook Pro, M4 Pro, Chrome headless on the GPU (`ANGLE Metal Renderer: Apple M4 Pro`), muted
  (`--mute-audio`, the game's volumes 0), uncapped (no vsync, no frame-rate limit), hour 10, clear weather. Another
  agent (#699) ran its own work at times: every run waited for a 1-minute load average under 10 and the load is
  given with every table (3–12, once 25 in the Signal Market's shop at 1080p, that row discounted).
- **Build**: the shipped bundle (`npx vite build`) of `dd821e458` (origin/main, 26 October) with the switches below.
- **How on/off was measured**: `?marksAb=1` and `window.__marks(list)` (`src/mark-switch.js`, new): each surface
  material recompiled without the listed patterns' defines (the machined finish returning before it draws, the relief's
  uniform 0), then on again, **in the same page at the same camera**; `.claude/skills/perf-audit/fps.mjs --ab` records
  each variant 3 s after 1.5 s of warm-up, three rounds in a rotating order, and the tables give the median frame time
  of the three. Every route world's four benchmark views (`scripts/bench/viewpoints-worlds.json`), its temple's door
  and first room, and a shop; Home has three views and no temple.
- **Why 1920 × 1080 too**: at 1280 × 720 the Mac's frame is bound by its CPU (the callbacks' time within 0.2 ms of the
  whole frame), so a fragment cost hides. High at 1920 × 1080 draws 2880 × 1620 (render scale 1.5): 4.7 million pixels,
  the GPU the bottleneck, which is what a handheld's GPU sees relative to its power. The handheld runs at 2560 × 1440
  draw 1920 × 1080, a Retroid's own pixels.

## Every new pattern on → off, per world

The four outdoor views' median frame time with everything on, then everything off; the median of their four
differences and the largest; that view's 95th percentile; the temple's and the shop's difference; the draws and
triangles (unchanged by the switch: only the shaders change).

### High, 1280 × 720

| World | Views | Median on → off (ms) | Δ median | Δ largest (view) | p95 on → off, that view | Temple Δ | Shop Δ | Draws | Triangles | Load |
|---|---:|---|---:|---|---|---:|---:|---:|---:|---|
| Desert | 4 | 7.9 → 7.5 | +0.1 | +0.7 (spawn) | 9.8 → 9.4 | +0.6 | −0.1 | 285 | 906k | 6.3–7.7 |
| Vael | 4 | 7.5 → 7.2 | +0.5 | +0.6 (wide) | 7.7 → 7.3 | +0.4 | +0.5 | 341 | 897k | 6.2–8.5 |
| Lorn | 4 | 7.8 → 7.6 | +0.2 | +0.2 (start) | 10.1 → 10.8 | +0.6 | −0.2 | 327 | 1300k | 7.3–12.1 |
| Viridel | 4 | 6.3 → 6.3 | +0.1 | +0.7 (crowd2) | 7.6 → 6.9 | +0.5 | +0.1 | 333 | 907k | 6.8–9.9 |
| Underwater City | 4 | 7.3 → 6.8 | +0.3 | +0.8 (start) | 9.4 → 10.9 | +0.4 | +0.2 | 270 | 925k | 7.4–9.3 |
| City-Shaft | 4 | 9.8 → 9.4 | +0.1 | +0.7 (crowd2) | 10.8 → 10.2 | +0.5 | +0.2 | 410 | 4509k | 6.3–9.1 |
| Glass Dunes | 4 | 6.3 → 6.2 | −0.2 | +0.5 (start) | 8.9 → 8.3 | +0.1 | −0.1 | 326 | 966k | 6.2–8.3 |
| Buried Machine | 4 | 7.3 → 6.7 | +0.7 | +1.0 (start) | 10.1 → 9.6 | +0.3 | +0.2 | 222 | 1193k | 7.4–9.5 |
| Moon Foundry | 4 | 5.7 → 5.5 | +0.1 | +0.3 (wide) | 6.7 → 6.2 | +0.1 | +0.4 | 250 | 570k | 6.6–9.5 |
| Garden of Spheres | 4 | 6.0 → 5.8 | +0.1 | +0.1 (crowd2) | 7.7 → 7.7 | +0.2 | +0.3 | 249 | 1696k | 6.1–9.8 |
| Space City | 4 | 5.7 → 5.5 | +0.1 | +0.2 (crowd) | 6.8 → 6.6 | +0.1 | +0.1 | 269 | 934k | 4.6–8.4 |
| Signal Market | 4 | 6.3 → 6.0 | +0.2 | +0.3 (crowd2) | 7.7 → 7.4 | +0.1 | +0.2 | 281 | 1305k | 4.3–6.7 |
| Home | 3 | 5.2 → 5.0 | +0.2 | +0.5 (start) | 7.0 → 6.2 | – | – | 260 | 993k | 5.2–7.2 |

### Handheld, 1280 × 720

| World | Views | Median on → off (ms) | Δ median | Δ largest (view) | p95 on → off, that view | Temple Δ | Shop Δ | Draws | Triangles | Load |
|---|---:|---|---:|---|---|---:|---:|---:|---:|---|
| Desert | 4 | 5.8 → 5.7 | +0.1 | +0.2 (spawn) | 6.8 → 6.5 | +0.0 | +0.0 | 227 | 570k | 5.5–8.5 |
| Vael | 4 | 5.1 → 5.2 | −0.0 | +0.1 (crowd) | 6.0 → 5.9 | +0.0 | −0.1 | 255 | 529k | 5.7–11.1 |
| Lorn | 4 | 4.5 → 4.3 | +0.1 | +0.2 (crowd) | 5.8 → 5.4 | +0.0 | +0.0 | 258 | 814k | 5.5–9.2 |
| Viridel | 4 | 3.5 → 3.5 | +0.1 | +0.5 (start) | 4.6 → 4.0 | +0.1 | +0.1 | 288 | 535k | 4.1–6.2 |
| Underwater City | 4 | 4.0 → 4.0 | +0.1 | +0.2 (crowd) | 5.0 → 4.6 | +0.2 | −0.1 | 249 | 687k | 6–8.9 |
| City-Shaft | 4 | 6.4 → 6.2 | +0.0 | +0.5 (start) | 8.0 → 7.6 | −0.1 | +0.1 | 341 | 3046k | 6.8–9.5 |
| Glass Dunes | 4 | 4.0 → 3.8 | +0.1 | +0.3 (wide) | 4.5 → 4.3 | +0.1 | +0.0 | 299 | 656k | 6.5–8.5 |
| Buried Machine | 4 | 3.8 → 3.8 | +0.0 | +0.2 (wide) | 4.4 → 4.2 | +0.1 | +0.0 | 190 | 885k | 6.2–8.1 |
| Moon Foundry | 4 | 3.4 → 3.3 | +0.1 | +0.2 (wide) | 4.1 → 3.9 | +0.0 | +0.0 | 229 | 388k | 6.5–8.9 |
| Garden of Spheres | 4 | 3.4 → 3.3 | +0.1 | +0.4 (start) | 4.8 → 4.4 | +0.0 | +0.0 | 206 | 1023k | 6.6–7.9 |
| Space City | 4 | 4.0 → 3.8 | +0.2 | +0.3 (start) | 5.8 → 5.4 | −0.2 | +0.1 | 242 | 640k | 6.4–10.7 |
| Signal Market | 4 | 3.8 → 3.7 | +0.0 | +0.2 (crowd2) | 4.5 → 4.4 | +0.1 | +0.0 | 251 | 703k | 5.9–7.4 |
| Home | 3 | 3.2 → 3.1 | +0.2 | +0.2 (wide) | 3.7 → 3.5 | – | – | 204 | 487k | 6.5–7.6 |

### High, 1920 × 1080 (fragment-bound)

| World | Views | Median on → off (ms) | Δ median | Δ largest (view) | p95 on → off, that view | Temple Δ | Shop Δ | Draws | Triangles | Load |
|---|---:|---|---:|---|---|---:|---:|---:|---:|---|
| Desert | 4 | 10.7 → 10.9 | −0.4 | −0.1 (camps) | 14.2 → 13.1 | +0.4 | +0.3 | 285 | 1014k | 7.2–10 |
| Vael | 4 | 13.4 → 11.6 | +1.7 | +2.2 (start) | 17.7 → 14.4 | +0.4 | +0.1 | 342 | 957k | 7.2–12.2 |
| Lorn | 4 | 12.4 → 12.3 | +0.4 | +0.4 (crowd2) | 14.1 → 14.6 | +0.4 | +0.2 | 324 | 1387k | 7.6–9.2 |
| Viridel | 4 | 10.1 → 9.9 | +0.2 | +0.7 (crowd) | 11.8 → 16.6 | +0.3 | +0.4 | 334 | 966k | 8.4–12.8 |
| Underwater City | 4 | 13.1 → 12.7 | +0.4 | +0.6 (crowd) | 14.7 → 14.3 | +0.4 | +0.5 | 275 | 956k | 7.6–11.4 |
| City-Shaft | 4 | 13.6 → 12.9 | +0.7 | +0.8 (wide) | 34.4 → 28.8 | +0.3 | +0.2 | 412 | 4560k | 7.3–9.8 |
| Glass Dunes | 4 | 11.3 → 10.3 | +1.0 | +1.3 (crowd2) | 13.5 → 12.1 | +0.3 | +0.0 | 326 | 1028k | 5.6–9.7 |
| Buried Machine | 4 | 13.8 → 12.5 | +1.4 | +1.7 (start) | 15.9 → 14.7 | +0.5 | +0.2 | 229 | 1246k | 5.5–10.5 |
| Moon Foundry | 4 | 8.6 → 9.6 | +0.3 | +0.6 (crowd2) | 11.8 → 11.3 | +0.3 | +0.9 | 256 | 637k | 7.9–15.6 |
| Garden of Spheres | 4 | 11.1 → 10.9 | +0.1 | +0.3 (start) | 13.4 → 13.2 | +0.3 | +0.4 | 249 | 1736k | 7.4–9.3 |
| Space City | 4 | 10.6 → 10.2 | +0.3 | +0.6 (start) | 12.7 → 12.4 | +0.3 | +0.3 | 281 | 1019k | 6.7–10.5 |
| Signal Market | 4 | 11.7 → 10.6 | +0.9 | +1.9 (start) | 15.1 → 25.7 | +0.3 | +0.2 | 285 | 1360k | 7.5–24.8 |
| Home | 3 | 10.4 → 9.0 | +0.9 | +1.4 (wide) | 11.5 → 10.3 | – | – | 260 | 1069k | 7.9–9.4 |

At 720p every world is within half a millisecond but the Buried Machine (+0.7 median, its start view +1.0), and the
Handheld preset shows nothing measurable anywhere (±0.2). At 1080p four worlds stand out, Vael (+1.7), the Buried
Machine (+1.4), the Glass Dunes (+1.0) and Home (+0.9): the four with the ground's middle distance. The Signal
Market's +0.9 came with a load average of 10–25; measured again on a quiet machine below it is +0.3 to +0.6 (paving).
The Desert's negative median is noise (its views ±0.4 on both sides). The 95th percentiles move with the medians:
no pattern makes a frame spike.

## Per pattern, High 1920 × 1080

Each pattern off alone against all on, in the worlds where it covers the most (load average 3–6):

| Pattern | Worlds, views measured | Δ per view (ms, on − off) | Largest (where) |
|---|---|---|---|
| ground's middle distance | Vael, Buried Machine, Glass Dunes, Home (15) | Vael +1.3 +1.3 +1.9 +1.7; Buried Machine +1.4 +1.4 +1.6 +1.5; Glass Dunes +0.0 +1.3 +1.2 +0.8; Home +1.0 +0.9 +1.7 | +1.9 (Vael crowd2) |
| rock top | Vael, Moon Foundry (8) | Vael +0.0 +0.2 +0.4 +0.1; Moon Foundry −0.1 +0.0 +0.0 +0.1 | +0.4 (Vael crowd2) |
| pale stone | Vael, Home, City-Shaft, Lorn (14) | Vael +0.0 +0.2 +0.4 +0.0; Home −0.2 +0.1 +0.1; City-Shaft −0.1 −0.1 −0.1 −0.3; Lorn −0.1 −0.1 +0.1 | +0.4 (Vael crowd2) |
| relief | Vael, Signal Market, Buried Machine, Viridel, Glass Dunes, Home, City-Shaft, Moon Foundry, Lorn, Underwater City (38) | Vael +0.0 +0.2 +0.1 +0.0; Signal Market −0.1 +0.1 +0.0 +0.1; Buried Machine +0.0 −0.1 +0.0 +0.0; Viridel −0.1 +0.0 +0.0 +0.0; Glass Dunes −0.2 +0.4 −0.1 +0.0; Home −0.1 +0.1 +0.1; City-Shaft −0.1 +0.0 +0.1 −0.3; Moon Foundry −0.1 +0.0 +0.0 +0.1; Lorn +0.0 −0.1 +0.1; Underwater City +0.0 −0.2 +0.1 +0.0 | +0.4 (Glass Dunes crowd) |
| paving | Signal Market, Viridel, City-Shaft, Moon Foundry, Underwater City (20) | Signal Market +0.4 +0.6 +0.6 +0.3; Viridel −0.1 +0.2 +0.0 +0.1; City-Shaft +0.0 +0.4 +0.7 −0.1; Moon Foundry −0.1 +0.2 +0.8 +0.6; Underwater City +0.2 +0.4 +0.8 +0.1 | +0.8 (Underwater City crowd2) |
| sheet metal | Signal Market, City-Shaft, Moon Foundry (12) | Signal Market +0.1 +0.1 +0.0 +0.1; City-Shaft −0.1 −0.1 +0.1 −0.3; Moon Foundry +0.1 +0.1 +0.0 +0.2 | +0.2 (Moon Foundry wide) |
| timber | Buried Machine, Glass Dunes, City-Shaft, Moon Foundry, Lorn, Underwater City (23) | Buried Machine +0.0 +0.0 +0.0 +0.0; Glass Dunes −0.2 +0.1 −0.2 +0.0; City-Shaft −0.1 −0.2 +0.0 +0.2; Moon Foundry −0.2 +0.0 +0.0 +0.0; Lorn −0.2 −0.1 +0.0; Underwater City −0.1 −0.2 +0.1 +0.0 | +0.2 (City-Shaft wide) |
| garden beds | Viridel, Home (7) | Viridel −0.1 +0.2 +0.0 +0.1; Home +0.0 +0.1 +0.0 | +0.2 (Viridel crowd) |
| buried city | Glass Dunes (4) | Glass Dunes −0.3 +0.1 −0.1 +0.1 | +0.1 (Glass Dunes crowd) |
| Lorn's crystals | Lorn (3) | Lorn −0.1 −0.2 +0.2 | +0.2 (Lorn wide) |
| sea walls | Underwater City (4) | Underwater City +0.0 −0.1 +0.2 +0.0 | +0.2 (Underwater City crowd2) |

The ground's middle distance is the whole of the four worlds' cost (Vael's +1.3 to +1.9 all of it; rock tops, pale
stone and the relief add nothing measurable there). Paving is the only other pattern over half a millisecond in any
view, in the views where flagstones fill the lower half of the screen (Moon Foundry crowd2 +0.8, wide +0.6; Underwater
crowd2 +0.8; City-Shaft crowd2 +0.7; Signal Market +0.3 to +0.6).

In the temples, at 1920 × 1080 High, the machined finish alone: Moon Foundry +0.2 / +0.3 (door / first room), Lorn
+0.2 / +0.2, Space City +0.1 / +0.2; the relief there 0.0. Handheld, 2560 × 1440, paving alone: Moon Foundry +0.0 to
+0.2, Underwater +0.1 to +0.3, Signal Market +0.0 to +0.1, City-Shaft −0.1 to +0.6 (its start view, noisy) and +0.4
(wide).

## Programs, compile and load

`fps.mjs` per world, everything on and then `?marks=0` (every pattern compiled out), two loads of each, interleaved,
High 1280 × 720, with the temple and the shop visited:

| World | Programs, on → off | With the temple and the shop | Load (s), on → off | Machine load |
|---|---|---|---|---|
| Desert | 114 → 114 | 114 → 114 | 4.3, 4.6 → 4.4, 4.5 | 8.3 |
| Vael | 116 → 116 | 116 → 116 | 4.9, 4.8 → 5.0, 4.9 | 10.3 |
| Lorn | 133 → 133 | 133 → 133 | 5.2, 5.3 → 5.3, 5.4 | 8.7 |
| Viridel | 112 → 112 | 112 → 112 | 3.3, 3.3 → 3.4, 3.4 | 8.3 |
| Underwater City | 114 → 114 | 115 → 115 | 3.2, 3.2 → 3.2, 3.3 | 8 |
| City-Shaft | 123 → 123 | 123 → 123 | 5.0, 5.0 → 5.0, 4.8 | 7.7 |
| Glass Dunes | 113 → 113 | 113 → 113 | 3.9, 3.8 → 4.0, 3.9 | 8.1 |
| Buried Machine | 122 → 122 | 122 → 122 | 4.3, 4.1 → 4.3, 4.2 | 9 |
| Moon Foundry | 119 → 119 | 119 → 119 | 3.8, 3.5 → 3.6, 3.5 | 9 |
| Garden of Spheres | 117 → 117 | 117 → 117 | 4.0, 3.8 → 4.0, 3.9 | 8.6 |
| Space City | 104 → 104 | 104 → 104 | 3.8, 3.7 → 3.8, 3.7 | 10.2 |
| Signal Market | 117 → 117 | 117 → 117 | 3.4, 3.4 → 3.5, 3.4 | 8.5 |
| Home | 69 → 69 | 69 → 69 | 2.4, 2.4 → 2.4, 2.3 | 7.6 |

No pattern adds a program: each material that wears one was already a program of its own, and with its define gone it
stays one (three keys a program on its defines and its shader's text, and the materials differ in others). The game
compiles every program at the load (src/warm-shaders.js), so the cost of a bigger program would show in the load: the
loads are the same within 0.2 s, and no program was linked while a view was recorded (`new_programs` 0 in every row;
`broken_programs`, new in fps.mjs, 0). Triangles and draws do not depend on the switches; Lorn's crystal geometry
(#693) is the one new geometry: Lorn's views carry 1735k / 1594k / 774k / 1007k triangles on High today, the +2–17 %
measured when it landed (docs/systems/materials.md, “Their shapes”), with the same draws.

## The fix: the ground's middle distance

`groundMid` (src/surface-marks.js) draws the open ground's broad pale patches (a tone) and, near, their crackled pen
border, wind dashes, slope lines and pebbles (ink), on every pixel of the terrain. Measured by parts (each part cut out
of a build of its own, the same A/B, Vael and Home at 1080p High): the tone 0.5–0.6 ms of the 1.4, the pebbles
0.2–0.3, the rest of the ink 0.3–0.5. The pale field (`groundMidPale`, three octaves of value noise) was worked out
twice a pixel, for the tone and again for the border's ink.

- **All presets, the same picture**: the surface shader works the field and its derivative out once (`gmV1`, `gmF1`)
  and hands them to `groundMidTone` and `groundMid` (web: materials.js; Unity: Surface.shader, hoisted to before the
  terrain's branches; SurfaceMarks.hlsl regenerated).
- **Handheld only** (`uWearLite`): the near wind dashes and the near pebbles are left out (the coarse stones out to
  200 m stay), as paving already drops its grit and pits there. A look change on the Handheld preset only, at the feet.
  A third step, the field's finest octave left out on the handheld, was measured and **dropped**: it moved the patches'
  outlines and softened their pen borders visibly for a tenth of a millisecond.

Before → after, the same A/B (`--ab groundmid`), two loads of each build interleaved, the median of six pairs:

| Preset, window | World, view | Cost before (ms) | after (ms) |
|---|---|---:|---:|
| High, 1920 × 1080 | Home, wide | 1.65 | 1.15 |
| High, 1920 × 1080 | Home, start | 0.95 | 0.85 |
| High, 1920 × 1080 | Home, crowd | 1.00 | 0.85 |
| High, 1920 × 1080 | Buried Machine, wide | 1.30 | 1.00 |
| High, 1920 × 1080 | Buried Machine, start | 1.25 | 0.95 |
| High, 1920 × 1080 | Buried Machine, crowd2 | 1.40 | 1.25 |
| High, 1920 × 1080 | Buried Machine, crowd | 1.25 | 1.00 |
| High, 1920 × 1080 | Vael, wide | 1.60 | 1.20 |
| High, 1920 × 1080 | Vael, start | 1.50 | 1.15 |
| High, 1920 × 1080 | Vael, crowd2 | 1.40 | 1.00 |
| High, 1920 × 1080 | Vael, crowd | 1.35 | 1.10 |
| Handheld, 2560 × 1440 | Home, wide | 0.15 | 0.00 |
| Handheld, 2560 × 1440 | Home, start | 0.40 | 0.10 |
| Handheld, 2560 × 1440 | Home, crowd | 0.40 | 0.25 |
| Handheld, 2560 × 1440 | Buried Machine, wide | 0.50 | 0.50 |
| Handheld, 2560 × 1440 | Buried Machine, start | 0.90 | 0.60 |
| Handheld, 2560 × 1440 | Buried Machine, crowd2 | 0.75 | 0.55 |
| Handheld, 2560 × 1440 | Buried Machine, crowd | 0.55 | 0.30 |
| Handheld, 2560 × 1440 | Vael, wide | 0.00 | 0.00 |
| Handheld, 2560 × 1440 | Vael, start | 0.35 | −0.10 |
| Handheld, 2560 × 1440 | Vael, crowd2 | 0.70 | 0.65 |
| Handheld, 2560 × 1440 | Vael, crowd | 0.35 | 0.25 |

High's picture is unchanged (the same arithmetic; pictures before and after differ only where the walker, the grass
and the clouds moved between loads). The Handheld's is checked in pictures (changelog-media/2.31/groundmid-handheld-*).
At 1280 × 720 on the Mac the cost was nothing measurable before and stays so.

## Unity: variants and the slow Android builds

- **No new variant.** Every new pattern is a uniform branch in Surface.shader (`UNITY_BRANCH if (WALLK && _Paving.x >
  0.0)`, `_Interior`, `_Sheet`, `_Timber.w`, `_SeaWall`/`_PaleStone`/`_Buried`/`_Channel`, `_RockTop.w`, `_Beds.w`,
  `_Domes.w`, `_FacetMarks`; the ground's middle distance on `_GroundMid.w` in the terrain path; the relief on the
  global `_Relief`). The machined finish lives in each skin's generated body (SkinPatterns.hlsl), inside the existing
  `HIRAETH_SKIN` variant. The keyword sets are as they were: the G-buffer pass's 8 × 2 × 2 × 7 × 2 = 448 combinations,
  228 kept for Vulkan and 132 for OpenGL ES 3 by BridgeShaderStrip (360 in the APK), the shadow pass 8 + 8.
- **But each variant got bigger, and every one is compiled again.** A change to any file Surface.shader includes
  changes every variant's source, so the shader cache misses all 360. The CI logs (`gh run view --log`, the
  “Compiling shader "Hiraeth/Surface"” lines) show the cold compile growing with the shader's code:

| Android run (date, commit) | Surface's source (SkinPatterns + SurfaceMarks) | CPU time, 360 variants | Wall time to the last variant |
|---|---|---:|---:|
| 39440111606 (20 Oct, 8b3889ca3) | 176 KB + 0 | 5419 s (15 s a variant) | 22 min |
| 39711823738 (22 Oct, 000cb60f0) | 177 KB + 0 | 7630 s (21 s) | 32 min |
| 40295225744 (26 Oct, e87f10816: #669, #677, the machined finish) | 221 KB + 11 KB | 11 661 s (32 s) | 49 min |
| now (dd821e458: + #685, #686, #691, #693, #696) | 245 KB + 42 KB | not yet built | (more) |

  The uniform branches cost nothing at run time when not taken, but the compiler builds them into every variant whose
  walls keep their marks (`WALLK`): every new pattern is compiled about 300 times, twice (Vulkan and GLES 3). The
  machined finish is pasted into each futuristic skin's body (13 copies, +45 KB of SkinPatterns.hlsl).
  This change (the ground's middle distance) edits SurfaceMarks.hlsl and Surface.shader too: the next Android build
  compiles all 360 again, once.
- **Stripping that would help** (proposed, not done: it needs the bridge's `leanWhy` counts from a device to confirm
  no material asks for these): on Android, BridgeRenderer.Lean never gives a skin (`HIRAETH_SKIN`) a LEAN or PLAIN
  keyword, never gives `HIRAETH_PLAIN` without a LEAN keyword, and never `HIRAETH_PLAIN` with `HIRAETH_LEAN_SLIM`
  (only under the test flag `-slim-on-plain`). Leaving those out in BridgeShaderStrip: Vulkan 26 + 14 + 14 = 54 of
  228, OpenGL ES 3 14 + 14 = 28 of 132, **82 of 360 (23 %)**; the skin variants are the biggest (every skin's body), so
  about a quarter of the CPU time: **a cold Android build ~49 → ~37 min**. Larger, the author's call: dropping OpenGL
  ES 3 from the APK (GLES 3 is the APK's fallback for a device without Vulkan; worth it only if no targeted device lacks Vulkan) takes 132 variants and
  5077 of the 11 661 CPU seconds: **~49 → ~27 min**, both together **~20 min**.
- **The Linux player recompiles Surface on every run**: its 132 variants are compiled cold in every run checked
  (10.5–25.7 min: “Local cache hits 0” in 39819310491, 39908104963, 40113048989, 40129059081, 40146100697), even when
  the Android job hit its cache for all 360. Its Library is restored, so the shader cache is lost or not keyed the same
  (the Linux sysroot package is added after the Library's key is taken); worth a look, it is the Linux job's longest
  step.

## The Retroid, the Steam Deck and the Xbox

The Retroid was not connected (`adb devices` empty, 26 October 19:45): not measured, not woken. The Deck and the Xbox
were not part of this check. On the Mac the Handheld preset's cost of every pattern together at the Retroid's own
pixel count (2560 × 1440 Handheld, 1920 × 1080 drawn) is 0.1–0.8 ms, the ground's middle distance most of it; a
Retroid's GPU is several times slower than the M4 Pro's, so the Retroid should be measured next with the Unity app
(`scripts/bench/android-worlds.mjs`-style, Vael's and the Buried Machine's views, `?marks` has no Unity side: compare
against the last release instead).

## Where to look next

1. The Retroid: Vael, the Buried Machine, Home and the Glass Dunes (the ground's middle distance), the Moon Foundry and
   the Underwater City (paving), Handheld, in the Unity app.
2. Variant stripping in BridgeShaderStrip (82 of 360 variants, ~12 min a cold Android build), after a device's
   `leanWhy` confirms the combinations are never asked for.
3. The Linux job's Surface cache that never hits (10–26 min a run).
4. Paving if the Retroid shows it: its tones and joints already fade by size on screen; an earlier fade on the handheld
   (the joints across a course under 20 px instead of 16) would be the cheap step.

## What was not measured

- Any device (the Retroid not connected; the Deck and the Xbox not in scope).
- Unity's frame cost of the patterns (no on/off switch on that side) and its shader compile on this Mac (the change's
  variants were not built here; CI builds them).
- The domes and channels on screen (no benchmark view frames them).
- The GPU's own time per frame: ANGLE on Metal's timer queries were inconsistent (a GPU time above the frame's), so the
  frame interval, measured uncapped, is the number given.
