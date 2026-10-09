---
name: perf-audit
description: Measure Hiraeth's performance — frame rate and frame times per world, draw calls, memory, load times, build and download size — on this Mac and, when connected, on the Retroid and the Steam Deck; compare with the last report and with the budgets; write docs/audits/perf-v<version>.md. Use when asked about FPS, performance, build size, loading times, "is it faster/slower", or before a release.
---

# The performance audit

The game's numbers, measured the same way each time and compared with the last report, so a
regression has a name, a size and a commit. Each report is `docs/audits/perf-v<version>.md`. It builds
on the measuring tools that already exist (`docs/systems/performance.md` explains each); it adds two
scripts of its own, `fps.mjs` and `size.mjs`, beside this file.

## 0. Before measuring

- **A quiet machine.** Numbers taken while agents, test runs, builds or Unity are busy are noise. Check
  `uptime` and `ps`. `scripts/bench/lib.mjs` has `quietCheck()` (the benches wait behind it). If the
  machine can't be quiet, say so in the report and compare only within one session (see A/B below).
- **The shipped bundle, not the dev server:** `npx vite build` first. Every script here serves `dist/`.
- **Rules for every run:** muted (`--mute-audio`, the game's volumes at 0), never port 5173 (the
  author's dev server), never SwiftShader (`fps.mjs` refuses a software renderer), the same preset,
  resolution, hour (10) and weather (clear) as the last report.
- **Read** the last `docs/audits/perf-v*.md` and the newest sections of `docs/systems/performance.md`:
  what was measured, on which device, at which preset, and the budgets below.

## 1. Build and download size

```sh
npx vite build
node .claude/skills/perf-audit/size.mjs --out <scratch>/size.json [--against <last report's size.json>]
```

Report the following:
- the total, and what goes to the devices (everything but the changelog pictures);
- each area: code, music, sound, animations and bodies;
- JS and CSS, gzipped;
- the **first load**: what `index.html` needs before the title;
- the biggest files.

The APK's size is on the release: `gh release view v<version> --json assets`. Each change goes with
the commit that made it (`git log --stat`).

## 2. Frames and loads on this Mac

```sh
node .claude/skills/perf-audit/fps.mjs --preset high     --out <scratch>/fps-high.json
node .claude/skills/perf-audit/fps.mjs --preset handheld --out <scratch>/fps-handheld.json
```

This covers every world. For each world it records:
- the load (navigation to the game booted);
- at each benchmark view: the frame time's median, 95th percentile and worst, the fps, draw calls,
  triangles, shader programs and the JS heap.

It is uncapped, so the fps is the frame's real cost, not the screen's 60.

Deeper tools, when a number moves:
- `scripts/transition-perf/loading.mjs`: a load's long tasks and stalls;
- `scripts/transition-perf/transitions.mjs`: hitches through doors, caves and portals;
- `scripts/bench/passes.mjs`: the cost pass by pass, with A/B toggles;
- `scripts/bench/web-load.mjs`: memory and crowds;
- `scripts/lab-perf/lab-perf.mjs`: materials.

Each script's header gives its exact command.

**A/B for a regression.** Measure the last release and HEAD in the same session, back to back, from
`git archive` copies, as `scripts/changelog-shots.mjs` extracts commits. Absolute numbers from
another day are only a guide.

## 3. On the devices (only if connected; ask before installing anything)

- **The Retroid (Android):** if `adb devices` lists it, run `scripts/bench/android-worlds.mjs` (in
  GeckoView, the app's engine, at the Handheld preset). Its header and `docs/systems/performance.md`,
  "Every world on the Retroid", explain the setup. `scripts/handheld-perf/measure.mjs` gives a walk with
  temperatures.
- **The Steam Deck:** if it can be reached, run `scripts/bench/deck-run.sh start`, then
  `scripts/bench/deck-worlds.mjs` (at the Deck preset).
- **Not connected:** say so. The last device numbers stand, with their date and version.

## 4. Budgets: flag anything past them

| What | Budget |
|---|---|
| Retroid, Handheld preset | every world's median ≥ 55 fps, worst view ≥ 40 |
| Steam Deck, Deck preset | median ≥ 40 fps |
| Mac, High preset | 95th percentile under 16.7 ms |
| Loads | Mac, shipped bundle: under 6 s a world; Retroid: under 12 s |
| Shaders | no new programs compiled after the first frames at a view (a hitch) |
| Build | what goes to the devices may grow by at most 10% a release, and the first load by at most 5%, without a named reason |

Change a budget in this table only when the author decides, and say so in the report.

## 5. Write `docs/audits/perf-v<version>.md`

Start the report with its score block, right under the title (an HTML comment GitHub hides; the audits page,
`audits.html`, reads it: `src/audits-page/parse.js`, docs/systems/ui.md "The audits page"):

```
<!-- audit-scores
overall: none
label: (none: the headline says it)
date: YYYY-MM-DD
-->
```

A performance report has no overall score: write `overall: none` and, instead of `label:`, `headline:` with
the budgets met and missed in one line.
Keep the score tables as Markdown tables with one row per world or view and the 1-5 scores in their own columns (a
"total" or "Mean" column for the row's mean; a change by eye as `4 ✎3`, before and after as `2 → 3`): the
page draws them as bars and compares them with the last report's by the row's name and the column's header,
so keep both the same from one report to the next. `node --test tests/audits-page.test.js` checks the block.

- **The setup:** the machine and how quiet it was, the GPU string, the presets, the resolution, the
  commit.
- **Size:** the table and its changes.
- **Frames and loads:** a world per row, with each number against the last report's, regressions in
  **bold**, and anything past budget flagged.
- **Devices:** measured now, or the last numbers with their date.
- **Regressions:** each one's cause, if found, with the commit, measured by A/B where possible.
- **Where to look next,** ranked.
- **What was not measured.**

Keep the raw JSON out of the repository; its numbers go in the report. Add the file to the
`docs/audits/` line of `docs/README.md`. A report is documentation only: no changelog line. Commit it
if asked, after the tests and the build pass.

## 6. Tell the user

- the headline changes (fps, load, size) against the last report;
- anything past budget;
- the likely cause of each regression;
- what was not measured, such as devices not connected or a busy machine.
