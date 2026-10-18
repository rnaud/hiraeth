# Hiraeth's performance (October 2026, v1.85)

<!-- audit-scores
overall: none
headline: Mac High p95 under 16.7 ms in every world but the City-Shaft's wide view (16.9); loads 3-6.2 s (the City-Shaft 11.0 → 5.6 s), Lorn and the Garden 6.2 s at the line; the devices' numbers from performance.md, not measured; the Unity packages +49 % (APK) since v1.66
date: 2026-10-18
-->

The fourth report of the perf-audit skill (`.claude/skills/perf-audit/SKILL.md`), for issue #467 (the technical part of
the full audit, as #226 at v1.66): every route world, Home, the Lantern and the Arena on this Mac at High and Handheld,
the build sizes against v1.66's, an A/B of three worlds against v1.66 in one session, and the devices' numbers as
docs/systems/performance.md last recorded them.

## The setup

- **The Mac:** M4 Pro, Chrome on ANGLE Metal (`ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro)`), headless and muted,
  uncapped, 1280 × 720, hour 10, clear, the GPU timer query on.
- **Not quiet:** other agents' audits, tests and builds ran alongside. Load average at each run: High 4 → 14
  (12:12-12:25), Handheld 14 (12:26, ten worlds) and 17-33 (16:26-16:28, the last five: two network outages cut the
  first run), the A/B 20-28 (16:30-16:38). Frame times under this load are only good for comparisons inside one session;
  draws, programs, heap and sizes are exact whatever the load.
- **The build:** `npx vite build` of main `8f01feae5` (v1.85). v1.66: `git archive v1.66` built the same way in a scratch
  folder, measured with this checkout's `fps.mjs --root` (it boots v1.66's build).
- **The tool's views:** `scripts/bench/viewpoints-worlds.json`, as v1.66 after its fix of Vael's views.

## Size (v1.66 → v1.85, `size.mjs`)

| What | v1.66 | v1.85 | change |
|---|---|---|---|
| dist/ in all | 194.66 MB | 193.58 MB | −0.6 % |
| to the devices (all but the site's own files) | 147.37 MB | 145.02 MB | −1.6 % |
| in the APK and the Deck package (not the themes fetched on demand) | 48.19 MB | 45.85 MB | −4.9 % |
| the web APK on the release | 122.74 MB | 121.02 MB | −1.4 % |
| **the Unity APK on the release** (`hiraeth-unity.apk`) | 88.55 MB | 131.93 MB | **+49 %** (v1.75 92.2, v1.80 113.7, v1.84 131.5) |
| **the Unity Linux player** (`hiraeth-unity-linux.tar.gz`, the Deck) | 300.5 MB | 428.8 MB | **+43 %** (v1.75 303.6, v1.80 420.1, v1.84 428.7) |
| JavaScript, gzipped | 3.29 MB | 3.99 MB | +21 % |
| CSS, gzipped | 0.02 MB | 0.02 MB | |
| first load (index.html and what it asks for), gzipped | 70.9 KB | 71.3 KB | +0.6 % |
| music | 106.2 MB | 106.2 MB | |
| bodies and characters | 12.4 MB | 7.7 MB | −4.7 MB: `characters/traveller-v1` 13 → 3.3 MB, the new body `traveller-b3` 3.4 MB |
| animations | 8.8 MB | 8.8 MB | |
| other | 54.1 MB | 55.7 MB | +1.6 MB (the guardians: the unused `elder-v1` gone, #300, the Aerie's `elder-v3` 2.9 MB) |

Both builds measured by this checkout's `size.mjs` (`--dist` for v1.66's). The web's share went down: the traveller's
body slimmed and #300's unused Elder came out, and the first load held (+0.6 % over 19 releases). The JS grew
21 % (0.7 MB gzipped: the one game setup, the engines' parity work, the minigames). **The Unity packages are the
devices' default now (the Deck, the Xbox, the Retroid later) and grew 49 % (APK) and 43 % (Linux) since v1.66**, most of it
between v1.75 and v1.84 (about 4-5 % a release, inside the 10 % budget each time, but no release named a reason): #500.

## Frames and loads on this Mac, High (v1.66 → v1.85)

| World | Median fps | Worst view: fps (p95, ms) | Main thread, ms | Most draws | Programs |
|---|---|---|---|---|---|
| The Desert | 125 → 154 | qanat-tree 103 (16.4) → camps 133 (8.5) | 7.7 → 5.9 | 617 → 517 | 93 → 102 |
| Vael | 90 → 154 | crowd2 79-88 (14-32) → crowd2 124 (10.5) | 10.4-11.3 → 5.9 | 526 → 422 | 87 → 104 |
| Lorn | 154 → 141 | crowd 98 (14.7) → crowd 105 (12.7) | 6.2 → 6.1 | 614 → 597 | 105 → **124** |
| Viridel | 114 → 179 | wide 74 (29.7) → crowd2 149 (11.4) | 8.3 → 5.1 | 654 → 658 | 95 → 101 |
| The Underwater City | 104 → 137 | crowd 60 (32.6) → start 121 (12.4) | 9.2 → 6.8 | 516 → 482 | 86 → 99 |
| The City-Shaft | 76 → 81 | crowd 54 (34.2) → wide 70 (**16.9**) | 13.3 → 10.0 | 874 → 599 | 97 → 107 |
| The Glass Dunes | 130 → 133 | crowd 88 (15.6) → start 127 (10.6) | 7.3 → 7.0 | 726 → 570 | 89 → 104 |
| The Buried Machine | 132 → 121 | start 84 (14.9) → start 115 (11.4) | 7.2 → 7.1 | 395 → 379 | 100 → 112 |
| The Moon Foundry | 171 → 145 | boot 114 (14.0) → wide 135 (10.6) | 5.6 → 6.0 | 540 → 520 | 93 → 108 |
| The Garden of Spheres | 147 → 141 | crowd2 132 (10.8) → start 115 (12.0) | 6.5 → 6.2 | 504 → 361 | 97 → 108 |
| The City Floating in Space | 128 → 139 | crowd 94 (15.2) → start 114 (10.5) | 7.5 → 6.8 | 402 → 430 | 84 → 95 |
| The Signal Market | 111 → 132 | start 89 (13.4) → start 97 (13.7) | 8.7 → 6.9 | 677 → 634 | 93 → 104 |
| Home | 152 → 161 | start 152 (8.0) → start 139 (8.5) | 6.2 → 5.9 | 326 → 355 | 59 → 61 |
| The Lantern | 161 → 116 | boot 161 (8.6) → boot 116 (12.7) | 5.5 → 8.0 | 159 → 186 | 57 → 58 |
| The Arena (full pack) | 104 → 119 | pack (11.5 → 10.1) | 9.1 → 7.9 | 1 449 → 1 459 | 102 → 105 |

The machine was quieter than v1.66's (load 4-14 against 8-25), so most of the rise is the load's; the A/B below is the
comparison that counts. The main thread fell in most worlds (the CPU rounds #446-#460: one walk of the scene a frame,
the people out of view, fewer draws), the City-Shaft's 13.3 → 10.0 ms, and the draws with it (874 → 599). **Programs
rose in every world, by 2-19** (Lorn 105 → 124, Vael 87 → 104, the Glass Dunes 89 → 104): the surfaces' new paths since
v1.66; none was compiled while recording (no hitch).

The temple halls, first rooms and shops: 102-158 draws, 132-256 fps, p95 4.9-11.1 ms (the City Floating in Space's temple
the slowest, 139 fps, p95 11.1; v1.66's Viridel temple 78.7 fps, p95 30.1, is 238 fps, p95 8.0). **Loads: 3.0-6.2 s;
the City-Shaft 11.0 → 5.6 s; Lorn 6.2, the Garden of Spheres 6.2 and the Buried Machine 6.0 at or just over the
6 s budget.** JS heap after a collection: 160-670 MB, **Vael 879 and the City-Shaft 818 MB** (v1.66: 774 and 763).

### Handheld (load 14; the last five worlds 17-33)

| World | Median fps | Worst view: fps (p95, ms) | Most draws | Load s |
|---|---|---|---|---|
| The Desert | 159 | spawn 147 (7.9) | 369 | 4.5 |
| Vael | 179 | crowd2 152 (7.6) | 279 | 5.3 |
| Lorn | 195 | start 149 (8.3) | 391 | 5.5 |
| Viridel | 202 | start 185 (7.2) | 325 | 3.7 |
| The Underwater City | 189 | crowd 167 (6.9) | 328 | 3.6 |
| The City-Shaft | 130 | start 98 (11.9) | 434 | 5.5 |
| The Glass Dunes | 199 | start 159 (7.5) | 447 | 4.2 |
| The Buried Machine | 228 | start 182 (6.9) | 261 | 4.6 |
| The Moon Foundry | 193 | wide 167 (7.1) | 341 | 3.7 |
| The Garden of Spheres | 206 | start 159 (7.4) | 241 | 4.9 |
| The City Floating in Space | 208 | start 196 (6.0) | 337 | 4.1 |
| The Signal Market | 204 | start 192 (6.0) | 349 | 4.7 |
| Home | 233 | crowd 217 (5.4) | 229 | 3.8 |
| The Lantern | 417 | boot 417 (3.5) | 138 | 3.5 |
| The Arena (full pack) | 167 | pack 167 (8.3) | 957 | 2.8 |

v1.66 at Handheld (load 25-42): median 83 (the City-Shaft) to 278 fps, p95 under 16 ms, 119-951 draws, loads 2.8-8.3 s.
Now every world's p95 is under 12 ms and every load under 5.6 s.

### The A/B: v1.66 → v1.85, High, one session, each its own build (load 20-28)

fps (p95 ms) in two turns each, views as named:

| World | View | v1.66 | v1.85 |
|---|---|---|---|
| The Lantern | boot | 116 (11.8), 115 (11.9) | 175 (7.1), 114 (11.9) |
| Home | start | 149 (10.2), 132 (11.3) | 196 (6.3), 132 (11.2) |
| Home | crowd | 147 (9.3), 141 (9.9) | 182 (8.3), 135 (10.4) |
| Lorn | start | 96 (12.6), 100 (11.3) | 112 (15.3), 89 (15.7) |
| Lorn | crowd | 104 (10.8), 104 (11.1) | 109 (13.3), 94 (13.7) |
| Lorn | load (s) | 7.1, 6.5 | 6.7, 6.4 |

The Lantern's 161 → 116 in the table above is the session's, not the build's: v1.66 reads 115-116 under the same load.
Lorn is the one to watch: its fps are the same, its p95 2-4 ms longer in both turns and the GPU timer's reading at its
start and crowd views 9.4-9.9 ms on v1.66 against 17.6-23.0 on v1.85 (the timer query is noisy under load: its crowd2 view
reads the other way round). Programs 105 → 124 there. Not called a regression on these numbers; a quiet-machine run of
`scripts/bench/passes.mjs` on Lorn is the next step (below).

## Devices (not measured: another agent holds the Retroid and the Deck)

The last numbers, from docs/systems/performance.md:
- **Steam Deck, Unity (the default there):** "The Steam Deck, round 12" (2026-10-15, D18, Deck preset, 1280 × 800,
  uncapped): every route world and Home 66-108 fps median (the City-Shaft 66, worst view 61; Lorn 72; the desert 78),
  1 % lows 47-72; the web 52-90. Since then rounds 13-14 (the 90 Hz hold, the first-use stall gone: no stall over 50 ms in
  a warm launch), #455 and #457 (the desert's spawn 72.6 → 75.1, the City-Shaft's start 57.1 → 58.1, Underwater 85.7 →
  90.9 fps). **Within the budget (median ≥ 40) everywhere.**
- **Retroid, Unity:** "Unity on the Retroid: every world" (2026-10-16, Handheld at 0.75): medians 52-60 fps, worst
  views 35.8 (the City-Shaft), 46.8 (Lorn), 49.2 (Lorn II), 50-60 elsewhere. Round 12 (2026-10-18) found main slower
  since build 2570 (Lorn's start 20.5 → 22.8 GPU ms, the City-Shaft's wide view 42.5 → 38.1 fps): issue #469, fixed on main while this audit ran (45a08e9e7: the test switch `-far-debug` had been left on every Surface pixel), not remeasured here.
  **Past the budget:** the City-Shaft's median 56.7 (≥ 55: ok) but its worst view 35.8-38 (< 40); the Signal Market,
  Underwater and Lorn II medians 52-57.
- **Retroid, GeckoView (the web):** the same session: medians 57-60, worst views 37.0 (the City-Shaft) to 59.4.
- **Loads on the Retroid:** "The Retroid, round 6" (2026-10-12): cold and warm under 12 s but the City-Shaft.

## Against the budgets

| Budget | Result |
|---|---|
| Retroid, Handheld preset: every world's median ≥ 55 fps, worst view ≥ 40 | Not measured; the last numbers (2026-10-16/18): **over** in the City-Shaft's wide view (35.8-38 fps, Unity), Unity's medians in the Signal Market, Underwater and Lorn II 52-57 (#404, #469) |
| Steam Deck, Deck preset: median ≥ 40 fps | Not measured; the last numbers: ok in every world (66-108, Unity) |
| Mac, High: p95 under 16.7 ms | ok but the City-Shaft's wide view (**16.9 ms**); v1.66 was over in four worlds |
| Loads: Mac under 6 s a world | **At the line:** Lorn 6.2 s, the Garden of Spheres 6.2, the Buried Machine 6.0 (the A/B's Lorn 6.4-6.7; v1.66's own 6.5-7.1); the City-Shaft 11.0 → 5.6 |
| Shaders: no new programs after the first frames at a view | ok: none compiled while recording, at any view of either preset |
| Build: the devices +10 % a release, the first load +5 % | ok for the web (−1.6 %, +0.6 % over 19 releases); the Unity packages +49 % / +43 % over 19 releases (2-2.6 % a release, with no reason named) |

## Where to look next

1. **The Unity packages' growth** (the APK 88.6 → 131.9 MB, the Linux player 300 → 429 MB since v1.66): what each
   release added (StreamingAssets, the pipeline lists, the captured moves), and whether the themes fetched on demand or
   unused worlds' data ride along: #500.
2. **Lorn on the Mac's GPU and its 124 programs** (the most of any world: +19 since v1.66): `scripts/bench/passes.mjs`
   on a quiet machine, against v1.66; it is also the Retroid's slowest Unity view after the City-Shaft (#469).
3. **The loads at 6 s** (Lorn, the Garden, the Buried Machine): `scripts/transition-perf/loading.mjs` for their long
   tasks.
4. **The heap in Vael and the City-Shaft** (879 and 818 MB, +105 and +55 MB since v1.66): `web-load.mjs` on a quiet Mac.
5. The Retroid's City-Shaft wide view under 40 fps: #404 holds it (remeasure after #469's fix).

## What was not measured

The devices (Retroid, Deck, Xbox: their numbers are performance.md's, dated above); a quiet machine; the Deck preset
on the Mac; doors and portals (`transitions.mjs`); loads' long tasks; the side worlds (WIP, left out by the tool); the
Unity player on the Mac (no Mac bench exists for it: the Unity side of this audit is the visual check's pictures in
visual-v1.85 and the device rounds above).
