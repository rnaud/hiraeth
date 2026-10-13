# Hiraeth's performance (October 2026, v1.66)

<!-- audit-scores
overall: none
headline: Mac High p95 over 16.7 ms in four worlds on a machine at load 10-68 (as v1.40 measures there too: no regression found); the City-Shaft's load 11 s; Vael's views had measured a cliff since v1.39 (fixed); devices not measured; to the devices +7.5 % since v1.40
date: 2026-10-13
-->

The third report of the perf-audit skill (`.claude/skills/perf-audit/SKILL.md`), for issue #226: every route world,
Home, the Lantern and the Arena on this Mac at High and Handheld, the build sizes against v1.40's, and an A/B of the
worlds that looked slow against v1.40 in one session.

## The setup

- **The Mac:** M4 Pro, Chrome on ANGLE Metal (`ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro)`), headless and muted,
  uncapped, 1280 × 720, hour 10, clear.
- **Not quiet:** other agents' audits, builds and Unity ran alongside. Load average at each run: High 8 → 25 (13:15-13:29),
  Handheld 25 → 42 (13:29-13:42), the A/B 40 → 68 (14:15-14:25). Frame times under this load are only good for
  comparisons inside one session (the A/B below); draws, programs, heap and sizes are exact whatever the load.
- **The build:** `npx vite build` of main `0949c08a` (v1.66). v1.40: `git archive v1.40` built the same way in a scratch
  folder, its own `fps.mjs` for its own build (this checkout's `fps.mjs` can't boot it: it waits for hooks v1.40 doesn't
  have).
- **The tool's views:** `scripts/bench/viewpoints-worlds.json`. Vael's were fixed during this audit (below); the High
  row for Vael is from the A/B session's two HEAD runs on the fixed views.

## Size (v1.40 → v1.66, `size.mjs`, both builds measured by this checkout's script)

| What | v1.40 | v1.66 | change |
|---|---|---|---|
| dist/ in all | 180.91 MB | 194.66 MB | +7.6 % |
| to the devices (all but the site's own files) | 137.06 MB | 147.37 MB | +7.5 % |
| in the APK and the Deck package (not the themes fetched on demand) | 34.44 MB | 48.19 MB | **+39.9 %** |
| the APK on the release | 117.86 MB | 122.74 MB | +4.1 % |
| JavaScript, gzipped | 2.71 MB | 3.29 MB | +21 % |
| CSS, gzipped | 0.01 MB | 0.02 MB | |
| first load (index.html and what it asks for), gzipped | 57.9 KB | 70.9 KB | +22 % |
| music | 106.0 MB | 106.2 MB | +0.2 % |
| bodies and characters | 9.3 MB | 12.4 MB | +3.1 MB: the traveller's body (`characters/traveller-v1`, +3.3 MB) |
| other | 45.7 MB | 54.1 MB | +8.4 MB: the Keeper's and the Elder's Tripo bodies (`guardians/keeper-v1` 2.97 MB, `guardians/elder-v1` 3.08 MB), the title's vectors 1.11 MB, the assets' bundles +1.75 MB |

Over 26 releases the devices' share grew 7.5 % and the first load 22 % (0.8 % a release): within the budget of 10 % and
5 % a release. What the APK and the Deck package carry grew 40 %: **the Elder's 3.08 MB GLB ships to every device though
only `tools/elder-review.html` loads it** (measured on main `0949c08a`, when the Aerie still had the procedural Elder; since 45599a95 the Aerie wears `elder-v3`, 2.66 MB, and `elder-v1` is the one left unused): issue #300.
`size.mjs` measured "the devices" as everything but the changelog's pictures; it now takes the site-only rule the
release uses (`scripts/site-only.mjs`: the audits' and the lore's pictures, the reference sheets) and also gives the
APK's share (`leftOff`), and `--dist` for another build (this audit's fix).

## Frames and loads on this Mac, High (v1.36 in v1.40's report → v1.66)

| World | Median fps | Worst view: fps (p95, ms) | Main thread, ms | Most draws | Programs |
|---|---|---|---|---|---|
| The Desert | 130 → 125 | qanat-tree 103 (16.4) | 7.0 → 7.7 | 906 → 617 | 91 → 93 |
| Vael (the fixed views; A/B session, load 35-45) | 227 → 90 | crowd2 79-88 (14-32) | 3.8 → 10.4-11.3 | 713 → 526 | 70 → 87 |
| Lorn | 227 → 154 | crowd 98 (14.7) | 4.1 → 6.2 | 1 159 → 614 | 75 → 105 |
| Viridel | 256 → 114 | wide 74 (**29.7**) | 3.8 → 8.3 | 787 → 654 | 75 → 95 |
| The Underwater City (a route world since v1.40) | – → 104 | crowd 60 (**32.6**) | – → 9.2 | – → 516 | – → 86 |
| The City-Shaft | 115 → 76 | crowd 54 (**34.2**) | 9.2 → 13.3 | 2 038 → 874 | 83 → 97 |
| The Glass Dunes | – → 130 | crowd 88 (15.6; start p95 **24.4**) | – → 7.3 | – → 726 | – → 89 |
| The Buried Machine | 200 → 132 | start 84 (14.9) | 5.1 → 7.2 | 784 → 395 | 80 → 100 |
| The Moon Foundry | – → 171 | boot 114 (14.0) | – → 5.6 | – → 540 | – → 93 |
| The Garden of Spheres | – → 147 | crowd2 132 (10.8) | – → 6.5 | – → 504 | – → 97 |
| The City Floating in Space | – → 128 | crowd 94 (15.2) | – → 7.5 | – → 402 | – → 84 |
| The Signal Market | 196 → 111 | start 89 (13.4) | 5.1 → 8.7 | 1 162 → 677 | 81 → 93 |
| Home | – → 152 | start 152 (8.0) | – → 6.2 | – → 326 | – → 59 |
| The Lantern | – → 161 | boot 161 (8.6) | – → 5.5 | – → 159 | – → 57 |
| The Arena (full pack) | 94 → 104 | pack (12.0 → 11.5) | 10.3 → 9.1 | 2 758 → 1 449 | 106 → 102 |

The fps fall from v1.40's column is the machine: v1.40's numbers were taken at load 4-8, these at 8-25. The A/B below is
the comparison that counts. The draw counts are exact: every world draws fewer (v1.40's batching and the props merged
since), the City-Shaft 2 038 → 874; programs rose by 2-30 a world (Lorn 75 → 105: the Deep Wood's, the Lamp-House's).
The temple halls, first rooms and shops: 98-189 draws, 125-192 fps, p95 7-13 ms but Viridel's temple (78.7 fps, p95
**30.1**) under the same load. Loads: 3.5-5.9 s but **the City-Shaft 11.0 s** (Handheld 5.9 s) and Vael 5.9-8.3 s.
JS heap after a collection: 170-560 MB, **Vael 774 and the City-Shaft 763 MB** (v1.40: 250-460).

Handheld (same session, load 25-42): median 83 (the City-Shaft) to 278 fps (the Lantern), every world's p95 under 16 ms
(the City-Shaft 15.6), 119-951 draws, loads 2.8-8.3 s (Vael 8.3, Lorn 6.3).

### The A/B: v1.40 → v1.66, High, one session, each with its own tool (load 40-68)

fps (p95 ms) in two turns each; most draws as each tool counts them:

| World | View | v1.40 | v1.66 |
|---|---|---|---|
| The City-Shaft | start | 49 (33.6), 51 (33.8); 2 035 draws | 62 (33.4), 60 (34.3); 840 |
| The City-Shaft | crowd | 51 (34.3), 60 (34.0); 1 257 | 60 (33.6), 60 (33.8); 576 |
| The City-Shaft | wide | 44 (36.1), 50 (36.0); 2 610 | 66 (33.5), 60 (35.5); 874 |
| The City-Shaft | load (s) | 15.6, 11.0 | 7.7, 8.8 |
| Viridel | start | 80 (19.6), 89 (14.8) | 79 (15.9), 79 (14.8) |
| Viridel | wide | 112 (13.9), 133 (10.7) | 114 (10.4), 112 (12.0) |
| The Desert | spawn | 63 (33.2), 75 (16.0) | 89 (13.4), 70 (30.4) |
| The Desert | dunes | 86 (25.2), 112 (11.6) | 103 (14.9), 114 (15.4) |

Under the same load v1.40 is no faster anywhere: the City-Shaft's p95 of 34 ms is the machine's (v1.40 reads the same,
33-36 ms), and HEAD is ahead on its median (60-66 against 44-60 fps) and its load (8 against 11-16 s). No regression
found since v1.40; the over-budget p95s are this session's load. The Underwater City was a side world at v1.40 (one view):
not compared.

## Against the budgets

| Budget | Result |
|---|---|
| Retroid, Handheld preset: every world's median ≥ 55 fps, worst view ≥ 40 | Not measured (no device connected); the last numbers stand (performance.md, "Every world on the Retroid") |
| Steam Deck, Deck preset: median ≥ 40 fps | Not measured (not reachable) |
| Mac, High: p95 under 16.7 ms | **Over** in the City-Shaft (29-35 ms, every view), the Underwater City (19-33), Viridel's wide view and temple (30), the Glass Dunes' start (24), at load 8-25; v1.40 is as slow there in the same session |
| Loads: Mac under 6 s a world | **Over** in the City-Shaft (11.0 s at High; 7.7-8.8 in the A/B, v1.40 11-16) and Vael (5.9-8.3 s) |
| Shaders: no new programs after the first frames at a view | ok: none compiled while recording, at any view of either preset |
| Build: the devices +10 % a release, the first load +5 % | ok: +7.5 % and +22 % over 26 releases (0.3 % and 0.8 % a release) |

## Where to look next

1. **The City-Shaft's main thread** (13.3 ms median at High, 11.7 at Handheld, twice the next world's): the city down the
   pit, its crowd and cabs. Measure it with `scripts/bench/passes.mjs` on a quiet machine before anything else.
2. **The Elder's GLB on every device** (3.08 MB, unused in the game): #300.
3. **The heap in Vael and the City-Shaft** (763-774 MB): the merged sky stones' and the pit's geometry; `web-load.mjs`
   on a quiet Mac.
4. **Programs**: Lorn 105, the Buried Machine 100 (v1.40's 75-80): the materials' feature sets, as v1.40 listed.

## What was not measured

The devices (Retroid, Deck, Xbox); a quiet machine; the Deck preset on the Mac; doors and portals
(`transitions.mjs`); loads' long tasks; the side worlds (WIP left out by the tool). A Chrome extension's errors in the
page (`Config` of undefined, in four worlds' runs) are the profile's, not the game's.
