# Hiraeth's performance (October 2026, v1.87)

<!-- audit-scores
overall: none
headline: one regression: the desert's first ~7 s after a load at 28-37 fps on the Mac (CPU 27-35 ms a frame) since #553's water, the bed maps' raycasts; otherwise no change against v1.85 in one session (Lorn, the City-Shaft, the Glass Dunes); the Unity APK 131.9 → 111.6 MB and the Linux player 428.8 → 186.3 MB (#500); the devices not measured (busy with #536)
date: 2026-10-20
-->

The fifth report of the perf-audit skill (`.claude/skills/perf-audit/SKILL.md`), for issue #556 (the technical part of
the full audit, as #467 at v1.85): every route world, Home, the Lantern and the Arena on this Mac at High and Handheld,
the build sizes and the Unity packages against v1.85's, an A/B of four worlds against v1.85 in one session, a bisection
of the one regression it found, and the devices' numbers as docs/systems/performance.md last recorded them.

## The setup

- **The Mac:** M4 Pro, Chrome on ANGLE Metal (`ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro)`), headless and muted,
  uncapped, 1280 × 720, hour 10, clear, the GPU timer query on.
- **Not quiet, and busier than v1.85's:** two other audits, a Unity batch run and device work alongside. Load at each run:
  High 11-35 (23:33-23:48), Handheld 19-34 (23:49-00:02), the A/B 22-28 (00:02-00:10), the desert's A/B and bisection
  24-45 (00:10-00:45). v1.85's High ran at 4-14. **The frame times and loads of the sweep below are the load's as much
  as the build's:** the A/B is the comparison that counts; draws, programs, heap and sizes are exact whatever the load.
- **The build:** `npx vite build` of main `3da6e2539` (v1.87). v1.85: `git archive v1.85` (`8f01feae5`) built the same
  way in a scratch folder, measured with this checkout's `fps.mjs --root`.
- **The tool's views:** `scripts/bench/viewpoints-worlds.json` (Vael's crowd view moved off its dune in #504).

## Size (v1.85 → v1.87, `size.mjs`)

| What | v1.85 | v1.87 | change |
|---|---|---|---|
| dist/ in all | 193.58 MB | 195.72 MB | +1.1 % (+2.14 MB: the site's own, the changelog's and audits' pictures) |
| to the devices (all but the site's own files) | 145.02 MB | 145.26 MB | +0.2 % |
| in the APK and the Deck package (not the themes fetched on demand) | 45.85 MB | 46.08 MB | +0.5 % |
| the web APK on the release | 121.02 MB | 121.10 MB | +0.1 % |
| **the Unity APK on the release** (`hiraeth-unity.apk`) | 131.93 MB | **111.63 MB** | **−15 %** (#500: Unity's built-in resources 19.8 → 0.3 MB, the dead shader copies gone) |
| **the Unity Linux player** (`hiraeth-unity-linux.tar.gz`, the Deck) | 428.8 MB | **186.3 MB** packed, 331.3 MB unpacked | **−57 %** (#500: IL2CPP's C++ and symbols left out, the shaders once) |
| the Xbox package (`hiraeth-unity-xbox.zip`) | 78.6 MB | 75.1 MB | −4.4 % |
| JavaScript, gzipped | 3.99 MB | 4.07 MB | +2.0 % |
| CSS, gzipped | 0.02 MB | 0.02 MB | |
| first load (index.html and what it asks for), gzipped | 71.3 KB | 71.3 KB | +0.0 % |
| music | 106.2 MB | 106.2 MB | |
| bodies and characters | 7.7 MB | 7.7 MB | |
| animations | 8.8 MB | 8.8 MB | |
| other | 55.7 MB | 57.6 MB | +1.9 MB (site-only pictures) |

**The Unity APK by area** (`unity-size.mjs`, MB packed; v1.85's from performance.md, "What the Unity packages carry"):
bodies, guardians and animations 21.2 → 21.2; shaders and settings 20.4 → 20.8; game code (IL2CPP) 17.8 → 17.9; the JS
bundle 16.0 → 16.2; the engine 13.5 → 13.5; music 7.0 → 7.0; V8 5.9 → 5.9; the Android app 3.4; pictures 2.9; pipeline
lists 1.5 → 1.6; **Unity's built-in resources 19.8 → 0.3**. `--check` passes on both packages (no IL2CPP leftovers, no
`unity_builtin_extra` over 2 MB). **The Linux player** unpacked: music 106.2 MB (every world's theme, the discarded side
worlds' seven among them, ~30 MB), game code 82.2, engine 50.8, V8 32.4, bodies 21.2, the JS bundle 16.2, shaders 15.5.

The web's share to the devices held (+0.2 %), the first load to the byte. The JS +2 % gzipped (the outfits, the pose
guards, the fight temples' camera, Plumb's talk). #500's fix took a fifth off the Unity APK and more than half off the
Deck's download.

## Frames and loads on this Mac, High (v1.85 → v1.87, the sweep; read with the load above)

| World | Median fps | Worst view: fps (p95, ms) | Main thread, ms | Most draws | Programs |
|---|---|---|---|---|---|
| The Desert | 154 → 109 | camps 133 (8.5) → **spawn 37 (37.1)** | 5.9 → 8.0 | 517 → 510 | 102 → 102 |
| Vael | 154 → 110 | crowd2 124 (10.5) → start 100 (11.7) | 5.9 → 8.0 | 422 → 471 | 104 → 104 |
| Lorn | 141 → 98 | crowd 105 (12.7) → crowd 54 (32.7) | 6.1 → 8.1 | 597 → 559 | 124 → 124 |
| Viridel | 179 → 91 | crowd2 149 (11.4) → crowd2 84 (30.0) | 5.1 → 7.8 | 658 → 676 | 101 → 101 |
| The Underwater City | 137 → 78 | start 121 (12.4) → wide 70 (30.3) | 6.8 → 10.2 | 482 → 482 | 99 → 99 |
| The City-Shaft | 81 → 73 | wide 70 (16.9) → wide 69 (30.2) | 10.0 → 11.8 | 599 → 599 | 107 → 107 |
| The Glass Dunes | 133 → 121 | start 127 (10.6) → start 100 (14.9) | 7.0 → 7.9 | 570 → 568 | 104 → 104 |
| The Buried Machine | 121 → 111 | start 115 (11.4) → crowd2 106 (15.0) | 7.1 → 8.6 | 379 → 382 | 112 → 113 |
| The Moon Foundry | 145 → 133 | wide 135 (10.6) → start 66 (32.7) | 6.0 → 6.4 | 520 → 524 | 108 → 108 |
| The Garden of Spheres | 141 → 137 | start 115 (12.0) → start 125 (18.2) | 6.2 → 6.7 | 361 → 357 | 108 → 109 |
| The City Floating in Space | 139 → 76 | start 114 (10.5) → start 75 (32.1) | 6.8 → 12.6 | 430 → 429 | 95 → 95 |
| The Signal Market | 132 → 103 | start 97 (13.7) → crowd2 81 (28.7) | 6.9 → 7.6 | 634 → 631 | 104 → 105 |
| Home | 161 → 152 | start 139 (8.5) → start 141 (9.8) | 5.9 → 6.2 | 355 → 355 | 61 → 61 |
| The Lantern | 116 → 127 | boot 116 (12.7) → boot 127 (13.4) | 8.0 → 7.0 | 186 → 186 | 58 → 58 |
| The Arena (full pack) | 119 → 108 | pack (10.1 → 12.9) | 7.9 → 8.9 | 1 459 → 1 458 | 105 → 105 |

Draws and programs are the same world for world (±1 program, ±50 draws where the views changed); no program compiled
while recording at any view. The heap after a collection: 164-882 MB (Vael 882, the City-Shaft 823: v1.85 879 and 818).
The frame times fell with the load (11-35 against 4-14): the p95 spikes to 28-33 ms in seven worlds are single views
sharing the GPU with the other agents' Chrome and Unity; the A/B below runs both builds through them. **The desert's
spawn is the exception:** 37 fps with the main thread at 26.7 ms, on both presets (Handheld 46 fps, 21.5 ms), against
v1.85's 154 and 6.2: a regression, found and bisected below.

The temple halls, first rooms and shops: 102-159 draws, 92-217 fps, p95 6.1-27.5 ms (the Glass Dunes' temple hall 92
fps, p95 27.5, and the City-Shaft's first room and shop 15.5-16.4: the load's). **Loads 3.6-9.1 s** (v1.85: 3.0-6.2);
the A/B's own loads show no change between the builds (below): the load average's, not the build's.

### Handheld (load 19-34)

| World | Median fps | Worst view: fps (p95, ms) | Most draws | Load s |
|---|---|---|---|---|
| The Desert | 159 → 135 | spawn 147 (7.9) → **spawn 46 (27.2)** | 369 → 454 | 4.5 → 7.8 |
| Vael | 179 → 154 | crowd2 152 (7.6) → wide 152 (7.8) | 279 → 363 | 5.3 → 5.1 |
| Lorn | 195 → 145 | start 149 (8.3) → start 135 (10.1) | 391 → 461 | 5.5 → 6.3 |
| Viridel | 202 → 182 | start 185 (7.2) → crowd 179 (6.7) | 325 → 403 | 3.7 → 4.5 |
| The Underwater City | 189 → 185 | crowd 167 (6.9) → wide 182 (6.6) | 328 → 380 | 3.6 → 4.8 |
| The City-Shaft | 130 → 115 | start 98 (11.9) → start 89 (13.7) | 434 → 512 | 5.5 → 7.8 |
| The Glass Dunes | 199 → 179 | start 159 (7.5) → start 164 (7.7) | 447 → 510 | 4.2 → 4.4 |
| The Buried Machine | 228 → 208 | start 182 (6.9) → start 192 (6.5) | 261 → 316 | 4.6 → 4.7 |
| The Moon Foundry | 193 → 227 | wide 167 (7.1) → start 182 (6.9) | 341 → 393 | 3.7 → 4.2 |
| The Garden of Spheres | 206 → 227 | start 159 (7.4) → crowd2 208 (5.7) | 241 → 287 | 4.9 → 5.7 |
| The City Floating in Space | 208 → 182 | start 196 (6.0) → crowd2 179 (6.7) | 337 → 374 | 4.1 → 4.4 |
| The Signal Market | 204 → 192 | start 192 (6.0) → start 179 (6.8) | 349 → 423 | 4.7 → 3.8 |
| Home | 233 → 227 | crowd 217 (5.4) → crowd 204 (5.6) | 229 → 277 | 3.8 → 2.2 |
| The Lantern | 417 → 455 | boot 417 (3.5) → boot 455 (3.2) | 138 → 154 | 3.5 → 2.0 |
| The Arena (full pack) | 167 → 127 | pack 167 (8.3) → pack 127 (9.5) | 957 → 1 019 | 2.8 → 3.7 |

Every world's p95 under 14 ms but the desert's spawn. **Handheld's draws rose 40-90 in every world** (the desert 369 →
454, Lorn 391 → 461, the City-Shaft 434 → 512): #492 (v1.86) draws the near shadow map every frame on every preset, so
the busiest frame now always holds the near map's casters (it held them every other frame before). The author's call
(shadows every frame everywhere: if a device misses its rate, shrink the map, never half rate); the cost on the devices
is #492's and #525's measured "2 fps in the City-Shaft on the Retroid, nothing elsewhere".

### The A/B: v1.85 → v1.87, High, one session, each its own build (load 22-28)

fps (p95 ms), two turns each, views as named:

| World | View | v1.85 | v1.87 |
|---|---|---|---|
| Lorn | start | 109 (17.4), 122 (16.3) | 116 (11.5), 82 (26.2) |
| Lorn | crowd | 127 (9.1), 122 (9.4) | 97 (14.9), 125 (9.2) |
| Lorn | load (s) | 7.8, 6.7 | 6.2, 7.3 |
| The City-Shaft | start | 84 (14.1), 81 (14.0) | 75 (17.2), 81 (14.8) |
| The City-Shaft | wide | 86 (17.2), 91 (13.1) | 89 (13.2), 87 (17.1) |
| The City-Shaft | load (s) | 6.3, 6.2 | 5.9, 7.2 |
| The Glass Dunes | start | 127 (9.4), 115 (10.6) | 97 (16.0), 124 (10.2) |
| The Glass Dunes | crowd2 | 152 (14.1), 175 (6.9) | 159 (7.5), 175 (7.3) |
| The Glass Dunes | load (s) | 4.9, 4.8 | 5.6, 4.6 |
| **The Desert** | **spawn** | **98 (14.8, cpu 9.6), 102 (29.1, cpu 9.2)** | **33 (49.0, cpu 31.0), 36 (35.3, cpu 27.8)** |
| The Desert | qanat-tree | 103 (11.0), 58 (33.5) | 114 (9.9), 96 (14.5) |

Each pair of turns overlaps but the desert's spawn: its main thread three times as long in both turns, the other three
worlds within the session's spread (Lorn and the Glass Dunes' starts each read once slow, once as v1.85). The Glass
Dunes' rework (#475, #498) cost nothing measurable.

## The regression: the desert's first seconds (#553's water)

**What a player sees:** for about seven seconds after the desert loads, from ~3 s to ~10 s, the game runs at 26-33 fps on
this Mac (the main thread 30-37 ms a frame), then settles at 80-90 (the same view, a camera pinned at the spawn,
DPR 1, High, `scripts/bench/mac-spawn.mjs` with the view's camera, a readout a second). The bench caught it because its
first view is measured 2 s after the boot. A handheld's CPU is 4-8 times slower: the same work there is a long stutter
on every arrival in the desert, and again whenever the traveller walks up to a water body whose bed map isn't made yet.

**The commit:** a bisection of v1.85..HEAD, each step built from its own `git archive` and measured at the spawn
(`fps.mjs --worlds desert --extras 0`): `1eacb44f8` 99 fps, `660d276e3` 97, `3e032b42f` 96, `8b0ec2cad` 97, `0a781a8e4`
80, **`078ea1fec` 29**, `8e17250f5` 29 (cpu 9.4-13.5 ms → 33.5-35.2). `078ea1fec` is #553: "the desert's water lies in its
beds; the Rose House's water runs down its steps".

**The cause** (a CPU profile of those seconds, 6.7 s, 180 frames): 32 ms of JS a frame, of which three's brute-force
`Mesh.raycast` (`getVertexPosition` 7.8 ms, `intersectTriangle` 3.6, the triangle loop 5.8) under
`Water.bakeStep → bakeRows → surfaceOf` (src/water.js 205-255): the water bodies' bed maps, baked a row at a time with a
budget of 1.5 ms a frame (`BED.budget`). The budget is checked only after each whole row (up to 256 texels), and each
texel of a body that isn't flat raycasts its mesh without a BVH. #553 rebuilt the desert's channels and the Givers'
outflow as strips laid every metre over the ground and down every tread (`stripAlong`, `alongGround`), many more
triangles in sloping (not flat) water meshes: one row now costs 25-35 ms, every frame, until every map is made.

**The fix:** check the budget inside the row (every 8-16 texels); and give a sloping water mesh a BVH (the physics'
`MeshBVH` is already loaded) or read its surface from its own path (a strip's height along its line) instead of a
raycast. Issue filed (below); the engines bake the same maps through the same code (src/water.js runs in engine/game.js),
so Unity on the devices has it too, unmeasured. **Issue #564.**

## Devices (not measured: busy with #536)

The Retroid, the Steam Deck and the Xbox were held by #536 (the Surface pipelines, on all three) throughout this audit:
not measured (device busy with #536). The last numbers, from docs/systems/performance.md:
- **Retroid, Unity:** #404 round 15 (2026-10-19, release 2740, levels of detail for the big still meshes, dynamic
  resolution under FSR): 23 of 25 views at 60 fps; the City-Shaft's wide view and the Floating City's start still under
  60 (#404 open). Loads: logo to title 3.6 s, a world straight from launch 6.6-10 s (the desert and the City-Shaft the
  slowest) (the night's decisions, 2026-10-19).
- **Steam Deck, Unity:** "The Steam Deck, round 12" (2026-10-15) and rounds 13-14: every route world and Home 66-108 fps
  median (the City-Shaft 66), within the budget.
- **Xbox, Unity:** not measured since the v1.85 audit (#536 is its first-frame work).

## Against the budgets

| Budget | Result |
|---|---|
| Retroid, Handheld preset: every world's median ≥ 55 fps, worst view ≥ 40 | Not measured (device busy with #536); the last numbers (#404 round 15, 2026-10-19): 23 of 25 views at 60, two under |
| Steam Deck, Deck preset: median ≥ 40 fps | Not measured (device busy with #536); the last numbers: ok in every world (66-108, Unity) |
| Mac, High: p95 under 16.7 ms | **over at the desert's spawn** (37.1 ms: the regression above, both presets); the sweep's other spikes (28-33 ms in seven worlds) are the load's: the A/B's turns of the same views read 9-17 ms |
| Loads: Mac under 6 s a world | Not measured on a quiet machine: 3.6-9.1 s at load 11-35; the A/B reads the same for both builds (Lorn 6.2-7.8 s, the City-Shaft 5.9-7.2, the Glass Dunes 4.6-5.6) |
| Shaders: no new programs after the first frames at a view | ok: none compiled while recording, at any view of either preset |
| Build: the devices +10 % a release, the first load +5 % | ok: the web +0.2 %, the first load +0.0 %; the Unity packages −15 % (APK) and −57 % (Linux) |

## Where to look next

1. **The desert's bed maps** (the regression above, #564): the budget inside the row, a BVH or the strip's own height. Then
   rerun `fps.mjs --worlds desert` and the Retroid's desert arrival.
2. **The heap in Vael and the City-Shaft** (882 and 823 MB, unchanged since v1.85): `web-load.mjs` on a quiet Mac.
3. **The Linux player's music** (106 MB unpacked, the seven discarded side worlds' themes about 30 MB of it): left in
   while the side worlds stay in the debug menu; drop them if the Deck's download matters.
4. **A quiet-machine sweep** to replace this report's frame times and loads (the A/B says nothing regressed but the desert).
5. The Retroid's City-Shaft wide view and the Floating City's start under 60: #404 holds them.

## What was not measured

The devices (Retroid, Deck, Xbox: held by #536); a quiet machine; the Deck preset on the Mac; doors and portals
(`transitions.mjs`); loads' long tasks; the side worlds (discarded, left out by the tool); the Unity player on the Mac.
