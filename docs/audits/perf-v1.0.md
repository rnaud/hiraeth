# Hiraeth's performance (October 2026, v1.0)

The first report of the `perf-audit` skill (`.claude/skills/perf-audit/`). There is no earlier report to
compare with. The device numbers that exist are in `docs/systems/performance.md`, from before v0.98.

## The setup

- **The Mac:** an Apple M3 Pro, with Chrome on ANGLE Metal (checked: not software rendering). Headless
  and muted, with no vsync or frame-rate limit, so a frame's interval is its work.
- **The build:** commits `d1f30d2d` (High) and `ea2c58ca` (Handheld, the same game code). The shipped
  bundle (`dist/`), served by `vite preview`.
- **The views:** 1280 × 720, hour 10, clear weather. Each view gets 2 s of warm-up and 5 s of
  recording, at the benchmark views (`scripts/bench/viewpoints*.json`: 3–4 a route world, the boot
  camera in the detours, Home and the Lantern).
- **How quiet the machine was:** not benchmark-quiet. The load average was 8–17, against the benches'
  gate of 4. A virtual machine, the author's Chrome and `coreaudiod` were busy. Read every number as a
  guide, and compare worlds only within this run.
- **Devices:** not connected (no `adb`, no Deck in the SSH config). The last Retroid and Deck numbers
  stand, from `performance.md` (October, before v0.98).

## Size

### What the build holds (`dist/`, 174.5 MB)

| Area | MB | Note |
|---|---|---|
| Music, 26 themes | 102.6 | 40% of everything; arrived in v0.94 |
| Reference photos | 38.8 | site-only from `ea2c58ca` (see below) |
| Bodies and characters | 15.0 | the traveller's `model.glb` alone is 9.7 MB |
| Animations | 8.5 | |
| JavaScript | 6.1 | 2.1 gzipped |
| World thumbnails | 1.8 | |
| Icons and item pictures | 1.2 | |
| Sound effects | 0.4 | v0.98's foley; 75 files |
| First load (index.html and what it asks for) | 0.13 | 0.04 gzipped: the title appears at once |

### The APK (v1.0: 268 MB, 255.6 MiB, measured from the release)

| What | MiB | Share |
|---|---|---|
| Music | 102.6 | 40% |
| GeckoView, the browser engine built into the app (`libxul.so` 61.6, other native code, `omni.ja` 13.8) | 84.8 | 33% |
| Reference photos | 38.8 | 15% |
| Bodies and characters | 10.8 | 4% |
| Android app code (dex) | 5.9 | 2% |
| Animations | 5.0 | 2% |
| The game's JavaScript | 2.1 | 1% |
| Everything else (resources, thumbnails, icons, sound effects) | 5.6 | 2% |

**How the APK grew:** 151 MB at v0.85, 156 MB at v0.90, 264 MB at v0.94 (the soundtrack), 268 MB at
v1.0. v0.98–v1.0 added under 1 MB (the sound effects).

**Fixed in this audit (`ea2c58ca`):** the reference photos of the References level, a developer
world, were in the APK and the Deck package. Only the over-the-air zip left them out. Both now strip
them (`scripts/site-only.mjs`), and a bundled game reads them from the site as before. **The APK
should drop to about 217 MiB (227 MB);** to be confirmed when CI builds the next release.

## Frames and loads on the Mac

The median fps over a world's views, and its worst view: the fps and the 95th-percentile frame time.
Uncapped, so 120 fps means 8.3 ms of work a frame.

| World | Load, s (High) | High: median fps | High: worst view | Handheld: median fps | Handheld: worst view | Most draws |
|---|---|---|---|---|---|---|
| The Desert | 5.2 | 79 | **camps 73.5 (17.7 ms)** | 99 | qanat-tree 96.2 (13.7 ms) | 1,004 |
| Vael | 3.4 | 147 | start 114.9 (10.8) | 189 | start 151.5 (8.6) | 1,006 |
| Vael II | 4.2 | 143 | start 114.9 (10.7) | 182 | start 138.9 (9.1) | 1,019 |
| Lorn | 3.3 | 149 | start 137 (9.7) | 170 | crowd 147.1 (10.7) | 1,056 |
| Lorn II | 4.5 | 121 | start 109.9 (12.1) | 141 | start 128.2 (11) | 857 |
| Viridel | 3.2 | 172 | start 125 (9.9) | 200 | start 144.9 (12.7) | 707 |
| **The City-Shaft** | **9.3** | 81 | **wide 60.6 (33.9 ms)** | 94 | start 87.7 (14.1) | **1,543** |
| The Sealed Hangar | 3.5 | 167 | start 137 (10.6) | 244 | start 196.1 (7) | 768 |
| The Buried Machine | 5.5 | 145 | start 120.5 (11.1) | 185 | start 153.8 (8.4) | 631 |
| The Garden of Spheres | 3.6 | 145 | start 116.3 (11.3) | 164 | start 140.8 (9.6) | 779 |
| The Signal Market | 3.3 | 119 | start 98 (13) | 172 | start 129.9 (10.5) | 745 |
| The White Mangrove | 4.3 | 139 | | 167 | | 526 |
| The Glass Dunes | 2.5 | 172 | | 196 | | 576 |
| The City Behind the Waterfall | 2.8 | 161 | | 217 | | 221 |
| The Salt Harbour | 3.7 | 127 | | 192 | | 386 |
| The Forest of Antennas | 3.6 | 124 | | 159 | | 718 |
| The Underwater City | 3.0 | 124 | | 200 | | 355 |
| The City During the Eclipse | 3.0 | 121 | | 145 | | 548 |
| The Fallen Ring | 3.1 | 145 | | 145 | | 964 |
| The Moon Foundry | 3.4 | 156 | | 139* | | 481 |
| The Underside | 3.9 | 133 | | 125* | | 465 |
| The City Floating in Space | 2.9 | 143 | | 139* | | 507 |
| The Overnight Train | 2.6 | 130 | | 121* | | 364 |
| Home | 2.3 | 145 | start 142.9 (9) | 137* | start 126.6 (12.6) | 1,118 |
| The Lantern (new) | 2.3 | 179 | | 250 | | 207 |

The detour worlds have one view each, the boot camera, so their worst view is the median.

\* Slower at Handheld than at High, which the preset shouldn't cause. These were the last worlds of
the run, on a machine that had been busy for 18 minutes (heat, or other work). Re-measure them alone
before reading anything into it.

**Handheld loads:** 2.5–5 s everywhere except the City-Shaft (10.1 s).

### Against the budgets (the skill's table)

| Budget | Result |
|---|---|
| Mac, High: 95th percentile under 16.7 ms | **Over** in the City-Shaft's wide view (33.9 ms) and the desert's camps (17.7 ms); every other view is under |
| Loads under 6 s on the Mac | **Over** in the City-Shaft (9.3 s at High, 10.1 s at Handheld); all others are 2.3–5.5 s |
| Retroid: medians ≥ 55 fps, worst view ≥ 40 | Not measured. The last Retroid numbers (October) already had the City-Shaft's wide view at 43 fps |
| Build: devices +10% a release, first load +5% | v1.0 is +0.3% over v0.97 for the devices (the sound effects), and −15% once the photos go; first load unchanged |

## What this says

1. **The City-Shaft is the one heavy world.** Its frame and load are both over budget on a fast Mac,
   with 1,543 draw calls in the wide view, about 50% more than any other world. It was already the
   Retroid's worst view (43 fps) and slowest load (15.8 s). The v1.0 changes didn't make it worse, as
   far as can be told without a before (the High run is at d1f30d2d). It's the first place to spend
   effort, starting with `scripts/bench/passes.mjs`'s pass-by-pass costs at its wide view.
2. **The desert's camps are just over the line:** 17.7 ms at the 95th percentile. That's the crowd,
   the camps' fires and now the bramble hedge's fire chemistry. An A/B of `src/chemistry.js` on and off
   at the camps would show whether v0.99 added to it.
3. **Every other world is comfortably fast on the Mac:** a median of 120–250 fps. The new Lantern is
   the lightest world (207 draws).
4. **The new CPU work** (fire chemistry, foley per frame, foes' cover sampling, the 75 sound effects
   decoded during a load) doesn't show as a regression here. But the Mac hides CPU costs that the
   Retroid will feel. **Measuring v1.0 on the Retroid is the most important thing this report could
   not do.**
5. **The heap rose to 1.4–1.5 GB in the run's last worlds** (the Underside, the Overnight Train). The
   script measures every world in one browser tab, so this may be the tab's own growth, not the
   worlds. Check one world in a fresh tab before calling it a leak.

## Size: where to look next

1. **Fetch the music on demand.** v0.94 lets updates carry the soundtrack. Ship only the desert's
   theme in the APK and download each world's theme on first visit, kept for offline play. That cuts
   about 95 MB, for an APK of about 125 MB.
2. **Re-encode the music.** At about 96 kb/s, or Opus where every platform plays it, the files roughly
   halve (40–50 MB). Judge it by ear first.
3. **Compress the traveller's model** (9.7 MB, Draco or meshopt): a few MB.
4. **Keep GeckoView.** Its 85 MB buys 56–60 fps on the Retroid, where the system WebView managed 30–45
   (`docs/benchmark-web-vs-unity.md`).

## Not measured

- The Retroid and the Steam Deck: not connected.
- A quiet machine: the load average was 8–17 throughout.
- An A/B against v0.97 in the same session, so v1.0's own changes are judged by absolutes only.
- Doors, caves and portals (`scripts/transition-perf/transitions.mjs`), and long tasks during loads
  (`loading.mjs`).
- The real size of the next APK without the photos: that comes when CI builds it.
