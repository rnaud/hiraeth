# The traveller’s motion, v1.90

<!-- audit-scores
overall: none
headline: Default motion passes 16 Node cases but retains small world transition failures; optional matching remains unstable; repeated settled stops recover correctly
date: 2026-10-20
-->

Frozen source `c5449ab6c`. Fresh deterministic 60 Hz B3 run completed in 37.43 s, exit 0 (runner exits on default failures only). Full log, JSON and SVG worst-frame sheets in motion-node/. Browser baseline, CPU stress pass and repeated actual keyboard stops are reported below. Incidental per-frame costs are not device measurements.

## Node findings

Default moves: 16/16 green, unchanged from v1.87. Optional matching: 4/16 green versus 1/16 previously. Now green: turn on spot, slow walk, standing still, standing pivots. Twelve matching failures remain. The stopped-pose repair improves measured stops but does not make optional matching generally acceptable. Some short/repeated transitions still fail the 1.1 s settle threshold; inspect their recorded bones and phase boundaries before assigning cause.

| scenario | way | verdict | slide p50 / p95 / max (cm) | held (cm) | sink (cm) | pops /min | jolts /min (max cm) | boundary max (cm) | start / stop / turn (s) | pivot slip (cm), crossed | matcher µs mean / p95 | matching share |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| walk → run → 180° turn → stop | moves | green | 0.6 / 3.7 / 3.7 | 0.8 | 0.0 | 1.0 | 1.0 (3.2) | 2.8 | 0.12 / 0.95 / 0.17 | - | 1 / 1 | 0 % |
| walk → run → 180° turn → stop | mm | **red**: slideP95, slideMax, pops, jolts, boundary | 0.8 / 20.6 / 20.6 | 0.8 | 0.0 | 6.0 | 11.0 (6.6) | 5.9 | 0.13 / 0.35 / 0.17 | - | 43 / 125 | 44 % |
| walk, 90° turn, stop | moves | green | 0.2 / 0.8 / 0.8 | 0.8 | 0.0 | 0.0 | 0.0 (0.0) | 1.2 | 0.12 / 0.90 / 0.13 | - | 0 / 1 | 0 % |
| walk, 90° turn, stop | mm | **red**: slideP95, slideMax, jolts, boundary | 0.7 / 18.2 / 18.2 | 0.9 | 0.0 | 3.0 | 5.0 (8.1) | 8.1 | 0.13 / 0.93 / 0.13 | - | 18 / 80 | 46 % |
| turn round on the spot | moves | green | 2.4 / 3.9 / 3.9 | 0.1 | 0.0 | 0.0 | 0.0 (0.0) | 1.7 | 0.05 / 0.23 / - | 0.0, 0 % | 1 / 1 | 0 % |
| turn round on the spot | mm | green | 0.7 / 4.0 / 4.0 | 0.0 | 0.0 | 0.0 | 0.0 (0.0) | 2.0 | 0.05 / 0.98 / - | 0.0, 0 % | 16 / 87 | 22 % |
| up the ramp, stand | moves | green | 0.2 / 0.8 / 0.8 | 1.5 | 0.1 | 2.0 | 0.0 (0.0) | 2.1 | 0.12 / 0.90 / - | - | 1 / 2 | 0 % |
| up the ramp, stand | mm | **red**: pops, jolts, boundary | 0.8 / 1.2 / 1.2 | 1.8 | 0.0 | 5.0 | 11.0 (9.2) | 9.2 | 0.13 / 0.58 / - | - | 17 / 66 | 68 % |
| stairs up, stand, down | moves | green | 0.2 / 1.0 / 1.0 | 1.1 | 0.0 | 3.0 | 2.0 (3.7) | 2.5 | 0.12 / 0.90 / - | - | 0 / 1 | 0 % |
| stairs up, stand, down | mm | **red**: pops, jolts, boundary | 0.4 / 4.0 / 11.3 | 0.8 | 2.4 | 7.0 | 7.0 (25.1) | 18.8 | 0.13 / 1.00 / - | - | 16 / 72 | 52 % |
| slow walk (half stick), stop | moves | green | 0.8 / 1.5 / 1.5 | 1.0 | 0.0 | 0.0 | 0.0 (0.0) | 1.9 | 0.15 / 0.87 / - | - | 0 / 0 | 0 % |
| slow walk (half stick), stop | mm | green | 0.9 / 1.8 / 1.8 | 1.2 | 0.0 | 1.0 | 1.0 (3.2) | 2.8 | 0.15 / 0.97 / - | - | 13 / 63 | 60 % |
| jog, 45° and back, stop | moves | green | 0.2 / 0.8 / 0.8 | 0.8 | 0.0 | 0.0 | 0.0 (0.0) | 2.0 | 0.12 / 0.90 / - | - | 0 / 0 | 0 % |
| jog, 45° and back, stop | mm | **red**: jolts, boundary, stop | 0.8 / 1.8 / 8.7 | 1.8 | 0.0 | 1.0 | 6.0 (5.9) | 5.9 | 0.13 / 1.33 / - | - | 13 / 72 | 59 % |
| stand still 6 s | moves | green | 0.1 / 0.1 / 0.1 | 0.1 | 0.0 | 0.0 | 0.0 (0.0) | 0.0 | - / - / - | - | 0 / 0 | 0 % |
| stand still 6 s | mm | green | 0.1 / 0.1 / 0.1 | 0.1 | 0.0 | 0.0 | 0.0 (0.0) | 0.0 | - / - / - | - | 2 / 11 | 6 % |
| gaits: walk → jog → sprint → jog → walk → stop | moves | green | 0.8 / 3.5 / 3.7 | 1.7 | 0.0 | 0.0 | 0.0 (0.0) | 1.0 | 0.15 / 0.87 / - | - | 0 / 0 | 0 % |
| gaits: walk → jog → sprint → jog → walk → stop | mm | **red**: slideMax, pops, jolts, boundary | 0.8 / 5.3 / 42.1 | 0.9 | 0.0 | 5.0 | 9.0 (5.1) | 5.1 | 0.15 / 0.97 / - | - | 17 / 76 | 66 % |
| starts and stops, walk and run | moves | green | 0.8 / 4.3 / 4.8 | 1.3 | 0.0 | 2.0 | 0.0 (0.0) | 2.2 | 0.18 / 0.95 / - | - | 0 / 0 | 0 % |
| starts and stops, walk and run | mm | **red**: pops, jolts, boundary, stop | 0.5 / 4.3 / 7.6 | 1.2 | 0.0 | 5.0 | 5.0 (5.5) | 5.5 | 0.15 / ∞ / - | - | 14 / 78 | 46 % |
| setting off the other way: a walk and a jog from standing, reversed, a jog at 90° | moves | green | 0.3 / 5.3 / 7.3 | 1.3 | 0.6 | 3.0 | 0.0 (0.0) | 2.4 | 0.05 / 0.90 / - | 0.6, 0 % | 0 / 0 | 0 % |
| setting off the other way: a walk and a jog from standing, reversed, a jog at 90° | mm | **red**: slideP95, held, boundary | 0.6 / 6.6 / 7.3 | 2.5 | 0.6 | 3.0 | 3.0 (6.9) | 6.9 | 0.05 / 0.97 / - | 2.5, 0 % | 13 / 80 | 43 % |
| pivots standing: 90° each way, 180° | moves | green | 2.9 / 5.5 / 5.5 | 0.4 | 0.0 | 1.0 | 0.0 (0.0) | 1.5 | 0.05 / 0.77 / - | 0.2, 1 % | 0 / 0 | 0 % |
| pivots standing: 90° each way, 180° | mm | green | 2.9 / 5.5 / 5.5 | 0.4 | 0.0 | 1.0 | 0.0 (0.0) | 1.4 | 0.05 / 0.77 / - | 0.2, 1 % | 7 / 22 | 6 % |
| pivot 180° at a jog, and at a sprint | moves | green | 0.6 / 3.8 / 4.4 | 1.0 | 0.0 | 1.0 | 0.0 (0.0) | 2.4 | 0.12 / 0.95 / 0.18 | - | 0 / 0 | 0 % |
| pivot 180° at a jog, and at a sprint | mm | **red**: slideP95, slideMax, pops, jolts, boundary | 0.8 / 17.3 / 17.9 | 1.1 | 1.4 | 7.0 | 9.0 (7.7) | 7.7 | 0.13 / 0.62 / 0.18 | - | 18 / 85 | 46 % |
| curve: the stick round a circle at a jog | moves | green | 0.1 / 0.8 / 0.8 | 0.8 | 0.0 | 0.0 | 0.0 (0.0) | 0.9 | 0.12 / 0.90 / - | - | 0 / 1 | 0 % |
| curve: the stick round a circle at a jog | mm | **red**: slideP95, slideMax, pops, jolts, boundary, stop | 1.2 / 20.0 / 23.3 | 0.8 | 0.5 | 5.0 | 14.0 (6.8) | 6.8 | 0.13 / ∞ / - | - | 16 / 79 | 48 % |
| down the ramp, stop on it | moves | green | 0.2 / 2.2 / 2.2 | 1.3 | 1.3 | 2.0 | 1.0 (4.7) | 2.4 | 0.12 / 0.90 / - | 0.0, 0 % | 0 / 1 | 0 % |
| down the ramp, stop on it | mm | **red**: slideP95 | 0.4 / 6.1 / 6.1 | 0.1 | 1.4 | 2.0 | 1.0 (3.5) | 2.8 | 0.10 / 1.07 / - | 0.0, 0 % | 14 / 71 | 64 % |
| stairs at a run | moves | green | 1.0 / 3.6 / 3.6 | 0.5 | 0.0 | 1.0 | 2.0 (4.2) | 2.8 | 0.12 / 0.95 / - | - | 0 / 0 | 0 % |
| stairs at a run | mm | **red**: slideP95, pops, jolts, boundary | 1.0 / 9.3 / 9.3 | 0.5 | 0.0 | 5.0 | 6.0 (21.6) | 5.1 | 0.12 / 0.32 / - | - | 12 / 59 | 54 % |

## Coverage limits

Actual world worst-frame sheets and selected matching Node diagrams were inspected. Three worlds, CPU stress and repeated keyboard stops are complete below. No Unity, device, physical controller or moving-platform runtime trial is claimed.

## Fresh steady browser world run

Medium quality, frozen c5449ab6c, six cases across Desert/Bazaar/Arena. All cadence checks are **steady**: zero long frames in the three default cases and in Bazaar/Arena matching; one in Desert matching. No browser errors. Runner exit 1 is the QC verdict, not a crash. The prior Desert UNSTEADY condition is resolved in this run.

Default path: all three world cases fail a strict metric despite Node 16/16 green—Desert jolts 6/min; Bazaar transition boundary 3.5 cm; Arena sprint-pivot boundary 3.9 cm (limit 3 cm). Full-sized default worst-frame sheets inspected; Arena identifies mixamo_running_turn_180 and the left ball boundary at 7.82 s. Matching fails all three world cases, with boundaries 7.8/6.0/6.9 cm plus pops/jolts; Desert/Bazaar sliding also fails. Arena’s short-stop metric is infinite, which is qualified by the completed settled-stop trace below; it does not establish a recurrence of the long-idle freeze.

| scenario | way | verdict | slide p50 / p95 / max (cm) | held (cm) | sink (cm) | pops /min | jolts /min (max cm) | boundary max (cm) | start / stop / turn (s) | pivot slip (cm), crossed | matcher µs mean / p95 | matching share |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| desert-dunes | moves | **red**: jolts | 0.6 / 4.1 / 6.8 | 1.8 | 1.6 | 3.0 | 6.0 (5.0) | 2.3 | 0.17 / 0.98 / 0.17 | 0.2, 0 % | 1 / 0 | 0 % |
| desert-dunes | mm | **red**: slideP95, pops, jolts, boundary | 1.0 / 7.6 / 9.0 | 1.1 | 1.7 | 6.0 | 14.0 (7.8) | 7.8 | 0.17 / 0.98 / 0.17 | 0.3, 0 % | 35 / 100 | 51 % |
| bazaar-street | moves | **red**: boundary | 0.7 / 5.0 / 6.5 | 1.3 | 0.7 | 0.0 | 1.0 (3.5) | 3.5 | 0.07 / 0.98 / 0.17 | 1.3, 0 % | 1 / 0 | 0 % |
| bazaar-street | mm | **red**: slideP95, pops, jolts, boundary | 1.4 / 6.7 / 9.1 | 1.3 | 1.4 | 7.0 | 12.0 (6.0) | 6.0 | 0.07 / 1.02 / 0.17 | 1.2, 0 % | 34 / 100 | 52 % |
| arena-floor | moves | **red**: boundary | 0.6 / 4.3 / 6.7 | 1.0 | 0.0 | 0.0 | 2.0 (3.9) | 3.9 | 0.17 / 0.97 / 0.17 | 0.3, 0 % | 0 / 0 | 0 % |
| arena-floor | mm | **red**: pops, jolts, boundary, stop | 1.2 / 3.8 / 4.5 | 1.7 | 0.0 | 12.0 | 11.0 (6.9) | 6.9 | 0.17 / ∞ / 0.17 | 0.3, 0 % | 39 / 200 | 57 % |


## CPU ×4 stress diagnostic

Completed the same six cases with Chrome CPU throttling. Desert and Bazaar were UNSTEADY (617/632 and 338/411 frames over 22 ms); their enlarged errors are cadence-confounded and must not replace the steady baseline or be presented as handheld measurements. Arena remained steady: default boundary 3.9 cm repeats the baseline, while matching reached 14.6 cm sliding p95, 60.0 cm maximum and 10.1 cm boundary. Full raw metrics and worst frames are retained in `motion-world-cpu4/`. Runner exit 1 records failed QC, with all cases completed. No physical device conclusions.

## Actual repeated keyboard stops

Four 400 ms W presses at the reported Desert position (344.67, 8.64, 271.16), then 8.5 seconds released after each, completed without browser errors. The character moved about 1.3 m each cycle. Matching was enabled; all eight late samples (roughly 4.5 and 8.6 s settled) had matching weight exactly zero. The final side image shows upright standing with relaxed arms; the old frozen walking pose did not recur. See `settled-stop/poses.json`, `summary.json`, and `stop-3-3.jpg`. This does not erase short-transition failures or establish every moving-platform condition.

Held-input/continuing-motion rest protection is separately tested in `tests/motion-matching.test.js:76–83`; source passes steering and desired velocity into matching (`src/player.js:2701–2709,2795–2801`). Carrier displacement is added to position separately at player.js:1803, rather than to locomotion velocity. These are code/test observations, not a new physical moving-platform trial.

## Recommendations

Keep optional matching distinct from the default quality verdict: it still fails 12/16 deterministic cases and all three steady world cases. Prioritize contact continuity and fallback/return transitions before enabling it broadly. Instrument candidate jumps/inertial offsets (`src/motion-match.js:618–634`) alongside matcher lag/weight and phase synchronization (`src/animator.js:860–874`) on the preserved pivot and circular-jog cases. This is a diagnostic recommendation, not proof that one tuning constant causes every failure. Preserve the settled-idle fix.

For default motion, focus narrowly on the captured sprint-turn's left foot boundary (3.5 cm Bazaar, 3.9 cm Arena) and Desert's calf jolts. Do not destabilize all gait transitions to remove a small local defect. Node-green alone is insufficient; rerun the same steady world cases after any future change. CPU ×4 Desert/Bazaar results require a stable cadence before they can support separate animation judgments.

Browser provenance: the steady world runs, CPU-throttled runs and repeated keyboard-stop captures were the earlier Chrome audit runs. They were not recaptured in the later internal Codex browser phase.
