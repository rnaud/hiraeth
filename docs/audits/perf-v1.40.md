# Hiraeth's performance (October 2026, v1.40)

<!-- audit-scores
overall: none
headline: the Arena's full pack fixed (draws −47 %, ~1 ms a frame); High p95 under 16.7 ms everywhere but the City-Shaft's wide view; devices not measured; a shared, noisy Mac
date: 2026-10-10
-->

The second report of the perf-audit skill. It covers the batch of v1.8–v1.36:
- the 21 archetypes with painted surfaces, hits and defeats;
- shops in every world;
- the temples' materials and light;
- the new landmarks, lamps and makers' runs;
- the fellow traveller, the face ink and the ink-line rules;
- Lorn II's veil glass, the chimes and the blade shader;
- the guardians on the motion kit.

Then the fixes, on top of v1.39 (the Deck pass, the merged worlds), released in v1.40.

## The setup

- **The Mac:** an M4 Pro, Chrome on ANGLE Metal, headless and muted, uncapped. v1.0's report was taken on an
  M3 Pro, so absolute numbers don't compare; every comparison here is two builds in one session.
- **The tool:** `.claude/skills/perf-audit/fps.mjs`:
  - the main thread's time a frame (INSTRUMENT), and the GPU's as a guide (ANGLE answers 0 for some frames;
    those are left out);
  - draws over the recorded frames;
  - temple hall, first room and shop scenes, and the Arena with all 21 archetypes in view;
  - `--root` for the other build;
  - no back-forward cache.
- **Draws object by object:** a frame with every cascade redrawn, `renderBufferDirect` wrapped. These counts
  are exact under any load.
- **Presets:** High 1280×720 (scale 1.5), the Steam Deck preset 1280×800, Handheld 1280×720. Hour 10, clear
  weather, 2 s of warm-up and 4 s recorded.
- **Not quiet:** other agents ran alongside, with a load average of 4–50. Main-thread differences under ~0.5 ms
  between separate runs are noise. The fixes were measured by switching the batches off and on in turns in one
  page, six times each.
- **Commits:**
  - v1.7 `ac25dbd1` against v1.36 `4a2be0b0` (the regressions);
  - v1.39 main `6a92e5b8` against the fixes (the pass).

## What v1.8–v1.36 cost (v1.7 → v1.36, one session, load 4–8, High)

| World | Median fps | Worst view: fps (p95, ms) | Main thread, ms | Most draws | Programs |
|---|---|---|---|---|---|
| The Desert | 104 → 130 | camps 91 (12.4) → 114 (9.9) | 9.2 → 7.0 | 992 → 906 | 87 → 91 |
| Vael | 172 → 227 | start 139 (8.8) → 185 (6.2) | 5.1 → 3.8 | 1 073 → 713 | 66 → 70 |
| Lorn | 159 → 227 | crowd2 154 (7.7) → 204 (5.6) | 5.7 → 4.1 | 602 → 1 159 | 71 → 75 |
| Viridel | 233 → 256 | start 217 (5.5) → 200 (6.1) | 4.3 → 3.8 | 1 195 → 787 | 72 → 75 |
| The City-Shaft | 125 → 115 | wide 119 (12.3) → 97 (12.3) | 7.9 → 9.2 | 1 970 → 2 038 | 74 → 83 |
| The Buried Machine | 192 → 200 | crowd 175 (6.8) → 185 (6.8) | 5.4 → 5.1 | 628 → 784 | 71 → 80 |
| The Signal Market | 200 → 196 | wide 185 → start 170 (6.8) | 4.9 → 5.1 | 1 037 → 1 162 | 74 → 81 |
| The Arena (full pack) | 250 → 94 | pack (5.1 → 12.0) | 3.8 → 10.3 | 469 → 2 758 | 55 → 106 |

The Steam Deck preset (route worlds, main thread): 0.3–1.5 ms more (the City-Shaft 7.0 → 8.9). Handheld:
0.2–0.7 ms more. The Arena: Deck 1.9 → 7.2 ms (310 → 2 022 draws), Handheld 1.6 → 5.8 ms (317 → 1 062 draws).
The side worlds are unchanged within the noise. (The Arena's v1.7 pack spawned only 7 kinds.)

### What regressed, and why

1. **The Arena with a full pack.** The 21 archetypes are about 1 100 separate meshes: the centipede 190, the
   jelly 131, the moth 126, the tripod 124, the lizard 90, the crab 64. Each is drawn in the G-buffer and in
   every shadow map. Fixed.
2. **Programs: +2 to +9 a world** (the Arena 55 → 106). The foes' painted surfaces compile a program per set of
   features, and the shops' and temples' materials add more. Not fixed here (see the loading pass's shader
   consolidation).
3. **Shop fronts: 30–48 draws each** (one mesh per colour bucket). Fixed: at most 10 meshes; the Buried
   Machine's dome 38 → 12.
4. **The makers' runs and the wind rings:** Vael's Feather leap 144 draws, the wind column 93, the lone tower's
   wind 67. Fixed: 21, 19 and 4.
5. **The City-Shaft: +0.7–1.9 ms on every preset.** More draws: new foes, the shop, the lamplighters' drops, the
   temple's pieces. Its old weight was already the largest (~80 cabs of 6 meshes, 26 cables, 40 billboards).
   Fixed: the wide view 1 640 → 1 342 draws.
6. **Temple halls** cost little: 100–170 draws, 4–5 ms. The rooms off the map stay culled. Shop interiors cost
   160–215 draws.
7. **The heap** is 250–460 MB a world in a fresh page. v1.0's 1.4 GB was the run's single tab keeping old pages,
   not a leak.

The veil pass (~12 draws), the chimes' trails (one instanced draw) and the guardians' kit are small.

## The fixes (v1.40)

1. **A body's repeated parts in one draw** (`src/part-batch.js`).
   - Instances carry the parts' own world matrices; the matrix cache keeps unmoved parts' uploads at nothing.
   - The shadow culler judges a batch by one part's size.
   - On every foe. The Arena, all 21 kinds, off/on in turns in one page:

   | preset | main thread, ms | draws |
   |---|---|---|
   | High | 7.0 → 5.7 | 2 775 → 1 463 |
   | Steam Deck | 5.6 → 4.8 | 2 065 → 1 075 |
   | Handheld (two builds, one run each) | 6.3 → 5.0 | 1 795 → 1 017 |

   In the worlds, the batches of the wild foes cost and save about nothing (they are mostly off screen).
2. **The worlds' props:**
   - the City-Shaft's cabs batched, its cables merged, its billboards one per-vertex mesh (wide view 1 640 →
     1 342 draws);
   - every shop front's colour buckets merged per vertex;
   - the responsive world, the makers' runs and the wind rings batched;
   - the dismissed Hangar's gears merged.
   - In the median frame they save 30–220 draws on the Mac. The main thread doesn't change beyond the noise:
     reading the parts costs ~0.1 ms for 600 of them. Screenshots differ from the build before no more than two
     runs of that build.
3. **Tried and dropped:**
   - batches of one part everywhere (no draw saved, a read and an upload for every moving part);
   - foes at min 2 (their materials compiled twice: 106 → 116 programs);
   - the responsive world's per-node coloured parts (they need a per-instance glow in the shader).

### The pass, every world: v1.39 main → fixes (Steam Deck preset, load 5–8; draws exact)

| World | Main thread, ms | Most draws | Programs |
|---|---|---|---|
| The Desert | 6.4 → 6.5 | 720 → 720 | 90 → 93 |
| Vael | 4.0 → 4.2 | 1 133 → 1 043 | 76 → 79 |
| Lorn | 4.9 → 5.3 | 952 → 913 | 90 → 93 |
| Viridel | 3.4 → 3.7 | 965 → 918 | 75 → 77 |
| The City-Shaft | 7.1 → 7.0 | 1 761 → 1 353 | 83 → 89 |
| The Glass Dunes | 3.5 → 3.9 | 616 → 573 | 76 → 79 |
| The Buried Machine | 3.5 → 4.0 | 624 → 587 | 80 → 81 |
| The Garden of Spheres | 3.3 → 3.6 | 820 → 800 | 81 → 83 |
| The Signal Market | 3.8 → 4.2 | 811 → 764 | 81 → 84 |
| The Arena (full pack) | 5.5 → 4.9 | 2 068 → 1 078 | 106 → 107 |
| side worlds, Home, the Lantern | unchanged within noise | unchanged | unchanged |

(Route-world main-thread rises of 0.2–0.5 ms here are a single run each. The balanced in-page A/Bs in the same
worlds show ±0.1 ms.)

## Against the budgets

| Budget | Result |
|---|---|
| Mac High p95 < 16.7 ms | over only in the City-Shaft's wide view (11–16 ms, the high end under load) |
| Loads < 6 s | over in the City-Shaft (6.5–8 s) |
| Retroid / Deck | not measured (not connected) |
| Shaders | a foe kind met for the first time still compiles at first sight, as before; no second set any more |
| Build | not measured; +~10 KB of code |

## On the devices (TODO)

- **The Deck** (deck-worlds.mjs, Deck preset):
  - the Arena with a full pack before and after the batching (Mac: 5.6 → 4.8 ms, 2 065 → 1 075 draws);
  - the City-Shaft's wide view (1 293 → 1 120 draws).
- **The Retroid** (android-worlds.mjs, Handheld, GeckoView):
  - the same two views (1 795 → 1 017; 1 384 → 1 186 draws);
  - the first fight's compile hitch (the Arena 106 programs).

## Where to look next

1. **The City-Shaft:** 1 300–2 000 draws, 5–6 M triangles. Its repeated static props are candidates for the same
   per-vertex merge as the billboards, procedural as everything else: 86 draws of one steel box in the wide view,
   plus the lamps.
2. **Programs:** fewer distinct feature sets across a skin's parts; warm a world's foe programs during its load.
3. **The responsive world's coloured parts:** 60–115 draws, which need a per-instance colour and glow.
4. **The people:** 90–290 draws in busy views.

## Not measured

- The devices.
- A quiet machine.
- Build size.
- Doors and portals.
- The loads' long tasks.
