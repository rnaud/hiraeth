# Hiraeth’s performance (October 2026, v1.90)

<!-- audit-scores
overall: none
headline: all 178 Mac views meet frame-time budgets and all loads are under 6 s; device payload grows 30.5% with the Blender traveller and outfits; 57 Retroid views meet the handheld floor, with two notable 60 fps deficits
date: 2026-10-21
-->

Full performance audit for #598, frozen at `c5449ab6c`. The playable caravan replacement (#599) is later work and is excluded. Compared with v1.87’s published report. Raw evidence is in the coordinator’s `full-audit/perf` scratch folder.

## Setup and limits

M4 Pro, Chrome headless, ANGLE Metal Apple M4 Pro, 1280 × 720, uncapped, hour 10, clear weather. Both presets use the built production bundle. Browser audio and game audio were muted before loading. Fifteen worlds and 89 views per preset include route worlds, Home, Lantern, Arena, temple rooms and shops; discarded side worlds are excluded.

Other agents ran no builds, tests, browsers or Unity during measurement. Load was approximately 3–7, on AC power, with no thermal warnings reported. The strict quiet check still failed at load 5.36 and because the author’s dev server remained open; their browser preview may also have been active. These are useful current budget checks, **not controlled speedup measurements** against v1.87, whose sweep ran at load 11–35. No same-session old-build A/B was performed. GPU timer readings were available but sometimes inconsistent under ANGLE; frame times are the primary evidence.

## Size

All MB below mean MiB, matching the previous report. The first-load figure is the compressed HTML and its immediate script/style requests, not all assets required to enter a world.

| What | v1.87 | v1.90 | Change |
|---|---:|---:|---|
| dist in all | 195.72 MB | 240.91 MB | +23.1% |
| to devices, excluding site-only files | 145.26 MB | 189.50 MB | +30.5% |
| bundled assets, excluding on-demand themes | 46.08 MB | 90.33 MB | +96.0% |
| web APK | 121.10 MB | 147.43 MB | +21.7% |
| Unity APK archive | 111.63 MB | 150.43 MB | +34.8% |
| Unity Linux archive | 186.30 MB | 209.35 MB | +12.4% |
| Unity Linux unpacked | 331.30 MB | 370.09 MB | +11.7% |
| Xbox archive | 75.10 MB | 98.06 MB | +30.6% |
| JavaScript gzipped | 4.07 MB | 4.13 MB | +1.4% |
| CSS gzipped | 0.02 MB | 0.02 MB | +0.6% |
| music | 106.20 MB | 106.23 MB | +0.0% |
| legacy bodies and characters | 7.70 MB | 7.73 MB | +0.4% |
| animations | 8.80 MB | 8.79 MB | -0.1% |
| first load, gzip | 71.3 KiB | 73.0 KiB | +2.4% |

The generic size tool groups the new `data/characters/traveller-v2` assets under “other”. A supplementary census separates **37.94 MB in 33 files** for the Blender traveller and all outfits. They ship uncompressed in the Unity APK. This is the main reason for the 44.24 MB increase in device assets. Relevant commits: `c4a9022a2` and `374ae5b55` for the new traveller, `78ea2405a` for ten outfits, and `4f04a068e` for Salt Pilgrim fit. The reference caravan GLB adds another **3.58 MB** (`5c3aa95e6`, `bf17792a8`); it is currently included in the web device payload even though it is a review prototype. No new playable ship is included in these numbers.

The +10% device-payload allowance is exceeded, with this named content reason. The +5% first-load allowance is met. This is a content-cost finding, not evidence of a runtime slowdown. Keep the accepted outfits; profile packaging and avoid carrying review-only assets if reducing download size becomes the next priority.

The remaining web areas are sound effects **0.36 MB** (75 files; not separately recorded in v1.87), item pictures **0.16 MB**, world thumbnails **1.85 MB**, icons **1.15 MB**, HTML **0.17 MB**, and JavaScript **11.75 MB raw / 4.13 MB gzip**. The old report’s broad “other” category was 57.6 MB; the current tool reports 102.64 MB before separating the new assets above. The largest files are the Spheres theme 4.81 MB, traveller model 4.72 MB, Moon Foundry theme 4.53 MB and Lorn theme 4.52 MB. Music still dominates the full download.

### Unity packages

Published release metadata confirms both packages were built from `c5449ab6c`. Both package checks pass: no build leftovers and no duplicated built-in shader payload above 2 MiB. APK ZIP entry totals are 150.33 MB; the complete archive is 150.43 MB including ZIP overhead. Linux is 209.35 MB compressed and 370.09 MB unpacked; the tool’s “packed” label for tar input is its unpacked listing, not the download size.

| Area | v1.87 APK packed | v1.90 APK packed | v1.90 Linux unpacked |
|---|---:|---:|---:|
| bodies, guardians, animations (legacy paths) |21.2|21.16|21.16|
| shaders and settings |20.8|21.27|15.72|
| game code |17.9|17.92|82.58|
| JS bundle |16.2|16.47|16.47|
| engine |13.5|13.48|50.82|
| music |7.0|7.04|106.21|
| V8 |5.9|5.92|32.36|
| built-in resources |0.3|0.34|0.55|
| pictures |2.9|2.93|2.93|
| pipeline lists |1.6|1.56|1.56|
| new traveller and outfits (subset of other) |not separately carried|37.94|37.94|

## Frames and loads

The median is across outdoor benchmark views; temples and shops remain in the full 89-view budget check. Columns compare published v1.87 medians with this run, **not a causal performance delta**. The previous report has the earlier view-level timings. “Worst p95” includes every measured view in that world.

### High preset on this Mac

| World | Median fps v1.87 → v1.90 | Slowest outdoor view, fps | Worst p95 ms | Max draws | Max programs | Load (s) |
|---|---:|---|---:|---:|---:|---:|
| The Desert | 109 → 162.7 | camps 151.5 | 7.6 | 544 | 104 | 4.08 |
| Vael | 110 → 171.1 | crowd2 151.5 | 7.6 | 465 | 106 | 4.53 |
| Lorn | 98 → 174.9 | start 142.9 | 8.3 | 554 | 127 | 4.95 |
| Viridel | 91 → 230.1 | start 212.8 | 7.4 | 674 | 104 | 3.08 |
| The Underwater City | 78 → 180.9 | start 161.3 | 11.2 | 442 | 104 | 3.00 |
| The City-Shaft | 73 → 131.7 | wide 100 | 11.2 | 592 | 112 | 4.82 |
| The Glass Dunes | 121 → 202.1 | start 200 | 5.9 | 562 | 107 | 3.63 |
| The Buried Machine | 111 → 163.9 | start 163.9 | 7.6 | 367 | 116 | 3.79 |
| The Moon Foundry | 133 → 208.4 | wide 200 | 8.4 | 524 | 111 | 3.13 |
| The Garden of Spheres | 137 → 175.5 | start 172.4 | 6.8 | 351 | 112 | 3.68 |
| The City Floating in Space | 76 → 190.5 | crowd 185.2 | 6.7 | 427 | 98 | 3.63 |
| The Signal Market | 103 → 187.3 | start 178.6 | 9.6 | 617 | 110 | 3.37 |
| Home | 152 → 238.1 | start 238.1 | 6.9 | 349 | 64 | 2.20 |
| The Lantern | 127 → 222.2 | boot 222.2 | 5.6 | 180 | 61 | 1.97 |
| The Arena | 108 → 172.4 | pack 172.4 | 7.4 | 1450 | 108 | 2.36 |

### Handheld preset on this Mac

| World | Median fps v1.87 → v1.90 | Slowest outdoor view, fps | Worst p95 ms | Max draws | Max programs | Load (s) |
|---|---:|---|---:|---:|---:|---:|
| The Desert | 135 → 190.9 | spawn 181.8 | 6.8 | 454 | 105 | 4.13 |
| Vael | 154 → 215.2 | start 196.1 | 5.8 | 359 | 108 | 4.25 |
| Lorn | 145 → 252.6 | start 200 | 5.7 | 457 | 128 | 5.48 |
| Viridel | 182 → 282.2 | start 263.2 | 4.5 | 403 | 105 | 2.91 |
| The Underwater City | 185 → 257.9 | start 238.1 | 5 | 346 | 106 | 2.71 |
| The City-Shaft | 115 → 170.9 | start 153.8 | 9 | 507 | 114 | 4.37 |
| The Glass Dunes | 179 → 274.4 | start 232.6 | 5 | 505 | 109 | 3.55 |
| The Buried Machine | 208 → 307.8 | start 270.3 | 4.4 | 304 | 118 | 3.53 |
| The Moon Foundry | 227 → 312.5 | start 270.3 | 4.4 | 396 | 113 | 3.03 |
| The Garden of Spheres | 227 → 339.1 | start 294.1 | 4.2 | 283 | 113 | 3.40 |
| The City Floating in Space | 182 → 270.3 | start 232.6 | 5.1 | 373 | 100 | 3.23 |
| The Signal Market | 192 → 282.2 | start 232.6 | 5 | 413 | 112 | 2.91 |
| Home | 227 → 333.3 | start 303 | 4 | 273 | 66 | 1.83 |
| The Lantern | 455 → 588.2 | boot 588.2 | 2.6 | 150 | 62 | 1.57 |
| The Arena | 127 → 200.0 | pack 200 | 6.2 | 1015 | 110 | 2.13 |

No page errors and no shader programs compiled during any recorded view. High’s maximum p95 is 11.2 ms; Handheld’s is 9.0 ms. Maximum load is 4.95 s at High and 5.48 s at Handheld. The Handheld preset here is still running on the Mac, not a measurement of the Retroid.

The old Desert startup stall is no longer reproduced: spawn 158.7 fps/p95 7.6 ms at High and 181.8 fps/p95 6.8 ms at Handheld. `6352c9ee8` (#564) added the water-surface BVH and checked the bake budget every 16 texels. This supports retiring the prior observed stall in this build; it does not establish device performance. High’s largest observed heaps remain Vael 897 MB and City-Shaft 842 MB (previous 882/823 MB), worth targeted memory work if a device shows pressure. A different-day heap comparison does not prove a leak.

## Retroid Unity — 21 October 2026

Installed official v1.90 Unity package: version code **2808**, recorded source **c5449ab6c**, SHA-256 `d55c3837abfb37ac159a0955ddf439058fe09213d15199eb6a8528d6839a7c80`. Package identity is recorded in `installed-version.txt` and `apk-sha256.txt`. Runs explicitly used `-bundle none -no-updates -mute`, six seconds per view, 1280×960 output at 60 Hz, dynamic render scale 0.5–0.67 with FSR. This is a physical Retroid result, unlike the Mac Handheld-preset sweep. There was no new side-by-side old-build run, so this is a current-budget check, not a causal speedup claim.

**57 views / 13 worlds, including Home.** Most views stay near the 60 Hz cap. City-Shaft wide remains the clear deficit at **47.8 FPS**, worst per-view p95 **25.11 ms**; Floating City start is **57.7 FPS**, worst p95 **18.95 ms**. Do not describe all views as locked 60. All original PNGs were inspected: world silhouettes/materials remain coherent, with visible reduced-resolution softness and several contact/occlusion caveats documented in DEVICE-VISUAL-REVIEW.md.

FPS below is `1000 / mean(raw frame milliseconds)` for each view, then the median of those view FPS values per world. “Worst FPS” is the smallest view mean FPS, not the slowest individual frame. P95 is the maximum recorded per-view `frameP95`, not a percentile of pooled world frames. Near-cap 60.1 is timing/rounding, not meaningful headroom.

| World | Views | Median view FPS | Worst view / FPS | Worst p95 ms | First node / settled s | Battery °C before→after | Reported view scale range |
|---|---:|---:|---|---:|---|---|---|
| arzach | 4 | 60.1 | crowd / 60.1 | 17.13 | 9.90 / 11.39 | 26→26 | 0.500–0.500 |
| bazaar | 4 | 60.1 | crowd2 / 60.1 | 17.26 | 7.42 / 7.57 | 29→30 | 0.500–0.591 |
| buried | 6 | 60.1 | keepers / 60.1 | 17.82 | 8.46 / 8.46 | 28→28 | 0.500–0.585 |
| desert | 5 | 60.1 | cave / 60.1 | 17.86 | 9.56 / 9.66 | 26→26 | 0.500–0.627 |
| edena | 4 | 60.1 | wide / 60.1 | 17.84 | 7.49 / 7.49 | 27→27 | 0.500–0.670 |
| glassdunes | 7 | 60.1 | crowd / 60.1 | 17.89 | 8.27 / 8.27 | 27→28 | 0.500–0.596 |
| home | 3 | 60.1 | wide / 60.0 | 17.86 | 5.74 / 5.80 | 30→30 | 0.670–0.670 |
| incal | 4 | 59.6 | wide / 47.8 | 25.11 | 10.93 / 11.81 | 25→26 | 0.500–0.549 |
| moonfoundry | 4 | 60.1 | crowd / 60.1 | 17.92 | 7.10 / 7.10 | 28→29 | 0.500–0.627 |
| perdide | 4 | 60.1 | start / 60.0 | 18.17 | 9.59 / 9.75 | 26→27 | 0.500–0.658 |
| spacecity | 4 | 60.1 | start / 57.7 | 18.95 | 7.54 / 7.62 | 29→29 | 0.500–0.500 |
| spheres | 4 | 60.1 | crowd / 60.1 | 17.98 | 7.73 / 8.81 | 29→29 | 0.500–0.500 |
| underwater | 4 | 60.1 | crowd / 59.8 | 17.24 | 6.92 / 6.92 | 27→27 | 0.500–0.543 |

Load figures are the exact engine log’s “first node … after launch” and “world settled … after launch” fields, not a stopwatch to controllable play. They range **5.74–10.93 s** for first node and **5.80–11.81 s** for the logged settled marker. These force-stopped application launches do not establish cold-install or cold-filesystem load times. Per-world total session duration also contains measurements/screenshots and must not be relabelled load time.

The battery readings span **25–30°C**. Only battery temperature was captured: **SoC thermal status/throttling telemetry is absent**, and these short world runs are not a thermal soak. Do not infer “no throttling” from a cool battery. Per-view render-scale summaries are reported values, not exact frame-by-frame minima; FSR sharpness does not restore native-resolution fine ink detail.

Home’s three measured frames all have Lou’s dialogue panel open; preserve this fixture caveat when comparing against unobstructed gameplay. A fourth Home PNG is a portrait, not a fourth benchmark view. The visual ledger covers all **58 PNGs**.

Current priority remains targeted City-Shaft wide profiling and Floating City start validation, keeping both frame time and image sharpness visible. The broad Mac sweep still does not justify a general renderer rewrite. Original data is `current/<world>/unity-bench.json`, load evidence `unity.log`, battery samples `battery-before.txt`/`battery-after.txt`, and the full aggregate is `current-summary.json`. Save restoration and separate physical-touch results are owned by the device operator’s session report and must be integrated from that evidence, not inferred from this visual/metrics review.

Fresh saves were backed up before each device session and restored byte-for-byte afterwards; Unity was stopped. The separate mirrored touch attempt was inconclusive and does not close #574. No device settings or volume were changed.

## Unmeasured work

Xbox and Steam Deck checks remain closed at the author’s request. No portal/door hitch trace, cold-install timing, thermal soak, Deck preset on Mac or outside-player timing was performed. Retroid Lantern and Arena were not in this 13-world sweep. No native ship-replacement claim follows from this frozen v1.90 audit.

## Next investments

1. **Download size:**37.94 MB of new character/outfit assets explains most growth. Check compression/asset sharing and exclude the 3.58 MB review-only caravan from device packaging where feasible. Preserve the approved outfits and visual quality.
2. **Targeted Retroid work:** profile City-Shaft wide and validate Floating City start against the 60 fps target, with image sharpness alongside timing. #574 still needs a verified physical touch gesture; mirrored input was inconclusive.
3. **Memory:** investigate Vael and City-Shaft retention and world transitions before adding further large assets.
4. **No broad Mac frame-rate rewrite:** all 178 current views and all 30 loads meet their budgets. Revisit only if a specific interaction or target device demonstrates a problem.
