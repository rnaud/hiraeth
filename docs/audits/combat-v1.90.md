# Combat, v1.90 — completed audit with explicit coverage limits

<!-- audit-scores
comparison: Comparison withheld: fresh reviewer method, not a measured regression
overall: 4.16 / 5
label: mean of 23 ordinary and 14 guardian totals; fresh reassessment, not comparable delta
date: 2026-10-21
-->

Frozen source `c5449ab6c`. Fresh guardian phase suite completed 33.27 s, 14 guardians, 90 simulated seconds per manner/phase, 60 fps, 0.5 m grid. Strict exit 1 is preserved, not described as all-green. Fresh browser review and scored tables are complete below. The Arena, corrected packs, guardian art/hall views, dodge and defence phases used the internal Codex browser operated through CUA; earlier Skilled/Normal temple runs used guarded Chrome as distinguished in the companion temple report.

## Fresh guardian results

| Guardian | Farthest hit from posed body m | Lock-to-mouth m | Checks |
|---|---|---|---|
| The Keeper of the cistern | 1.0 | 0 | pass |
| The warden | 0.4 | 0 | pass |
| The Elder | 0.9 | 0 | pass |
| The Cloud-Mother | 1.0 | 0 | pass |
| The Mother Snapper | 1.0 | 0 | phase 1: 0 openings a minute for a player who dodges or guards (< 1); phase 2: 0 openings a minute for a player who dodges or guards (< 1) |
| The Lampless | 1.2 | 0 | pass |
| The Gardener | 1.2 | 0 | pass |
| The Listener | 1.2 | 0 | pass |
| The Clockwork Foreman | 1.1 | 0 | pass |
| The Tooth-Warden | 0.9 | 0 | pass |
| The Last Founder | 1.2 | 0 | pass |
| The Echo | 1.0 | 0 | pass |
| The Anchor-Warden | 1.0 | 0 | pass |
| The First Sign | 0.5 | 0 | phase 2: 0 openings a minute for a player who dodges or guards (< 1) |

All five previously failing reach cases now pass: Gardener 1.2 m, Listener 1.2 m, Foreman 1.1 m, Tooth-Warden 0.9 m, Last Founder 1.2 m, below 1.5 m threshold. Every measured lock offset 0 m. Raw per-move grid results, phase openings, timings, shadows and damage are in guardians/guardians.json and guardians.md. The current result removes the old reach-based fairness cap; it does not automatically award a visual or player-experience score.

## Strict failures classified

Three no-opening rows remain: Mother Snapper phases 1/2 and First Sign phase 2. These are intended puzzle phases, not new combat opening regressions: `src/temples/perdide.js:232–243` marks Snapper outwit-only and never fought; `src/temples/bazaar.js:1353` describes the Sign’s second-phase cable/word puzzle. The generic dodger/guard simulation never performs those puzzle actions. Keep failures visible in the raw report and annotate them; do not count them as proof that a human can complete the puzzle.

Locked-on sidestep: right-0.03 m, left-0.03 m, side-hop+0.04 m, proper right hop, all under 0.25 m. Tool limitation: guardian.mjs uses `body:'v1'`, which gait-sim maps to the plain humanoid (only explicit `b3` selects the traveller). This is controller-path evidence, not full B3 pose validation.

## Completed scope

Ordinary foe watch/TTK and all 23 close/15 m/30 m visual reviews are complete. Corrected 48 packs are spatially validated. All guardian phase/locomotion images and 14 original-hall views were reviewed; 36 dodge rows and the bounded 59-row defence matrix are complete. Twelve skilled temples and five Normal/Gentle comparisons are in the companion report. Real-input charge, clean roll and ordinary/gorged riposte checks passed under recorded staged conditions. No physical pad, audible listening, Unity or device run is claimed by this feel audit. Explicit unsampled cells and fixture limits below remain unverified.

## 30 fps diagnostic: tool sampling limitation

Fresh targeted 90 s phases at 30 fps on the five repaired guardians: Foreman, Tooth-Warden and Last Founder pass; Gardener sweepL 1.6 m, Listener sweep 1.9 m/sweep2 2.0 m fail the coarse 0.5 m-grid tool threshold. These are **not confirmed gameplay regressions**. Runtime collision includes interpolated 60 Hz sweep positions, while reach.mjs:140–143 samples only the displayed 30 Hz posed body.

A finer 0.25 m diagnostic compared the same 30 Hz hit cells against independent 30/60/120 Hz body paths. Farthest distances against 30 Hz versus 120 Hz body: Gardener 1.79→0.92 m; Listener sweep2.11→1.01 m; sweep2 2.12→0.94 m. All are below 1.5 m using the denser path; phantom shares at 120 Hz 0%, 0.18%, 0%. 60 Hz body comparison agrees within 0.02 m. This supports a body-sampling false positive at low frame rates, not a revived isotropic reach expansion. The diagnostic does not prove frame-by-frame player perception or perfect collision.

Recommendation: before using this tool at lowfps, compare against a sufficiently sampled continuous body path as well as visible frame poses. Preserve both interpretations, rather than relaxing the 1.5 m threshold. Evidence: reach 30-cross-sampling.{mjs, json, log, png}, actual plot inspected; guardians-30/ contains all original failures. No implementation edits made.

## Ordinary Arena: fresh evidence

All 23 kinds completed in 750.247 seconds with normal difficulty and actual three-heart/resource budgets asserted before entry. Every kind wound up during its watch. Data includes 24-second still-player watches, move timings through the real damage rules, live roller attacks and marionette host/string behaviour. Raw data: `cua-qa/arena-progress.json`; visual judgments: `cua-qa/visual-review.md`. The three initially cropped close views were replaced by bounds-corrected captures; their originals remain as fixture evidence.

Skitter and roller received low automatic threat scores from zero harm in a short stationary watch. This does not establish a new defect: the previous report also measured zero roller harm and overrode that score using live play. The fresh live roller takes 2.13 s with three combo contacts, 2.47 s with four shot contacts, and 6.41 s with ember (three contacts, two rolled glances); push does not kill it. Corrected packs demonstrate roller pressure; skitter defence contacts remain inconclusive.

The marionette attached strings in 1.81 s, drove its crab host for 8.01 s, released the host when cut, and restrung after 9.93 s. This supports a distinct support role through observed runtime state, rather than silhouette alone. At 15 m, broad foe shapes remain distinct; at 30 m, small blot/shade/hound details become harder to identify. The drone's cloud can obscure its central body. Neither observation is presently a confirmed attack-telegraph failure. Sound identity remains unheard, so an automatic audio-identity maximum is not accepted as fresh listening evidence.

## Route-pack fixture qualification

The initial sequential route-pack batch is excluded from balance scoring. A root CUA frame at Buried 1 visibly placed traveller and foes outside the Arena wall. The runner retained the traveller's last position between packs; prior rows had state/time samples but no spatial proof. Cleared earlier rows cannot therefore be assumed uncontaminated. GlassDunes 1 had already capped both 90-second ideal clears, reporting ~540 m of attempted movement and almost no contacts. This is test setup evidence, not an impossible-pack verdict.

Original partial data and screenshot are preserved. The single affected pack passed with spawn reset: 45 attacks/min and 9.75 hearts/min, clear 1.9 s and dodgeclear 1.8 s, four contacts each. Maximum observed radius 16.48 m; actual travel about 10 m. This confirms the original cap was placement contamination. The full 48 completed with the same correction (28 m 22 s, zero bounds failures or time caps; max radius 25.66 m). Live X/Z positions are checked throughout against radius 38, inside the source Arena floor radius 40; explicit bounds failure stops acceptance. Actual displacement is recorded separately from intended step totals. No original route-pack score or clear-time comparison is accepted. The corrected replacement alone supplies current pack measures; see packs-accepted-summary.md.


## Fresh guardian art and own-hall review

All 42 phase frames and five locomotion strips inspected; generated Keeper/Elder identity asserted. Original 14 halls each retain wind/strike-side and game-lock views with actual level guardians. Initial 900 ms lock captures were too early: Keeper's mouth NDC y 1.33→.91→.897 at.9/3/6 s, with real rig fitK.80→.996→1. After 6 s all 13 remaining real locks retain the mouth and traveller. Three settled whole-body margins remain limited: Underwater's tall upper shell, Moon Foundry's chimney and Bazaar's ring crop the top. These are separate from the invalid early capture artifact and warrant a tighter camera-body bounds review, not a claim of lost lock target. Underwater's player also overlaps the shell base. Detailed per-view classifications and remaining side fixture limits are in cua-qa/visual-review.md.

The corrected packs support varied pressure: Bazaar 26.28 hearts/min and 73.6 attacks/min against a still target; Spheres dodge-bot clears average 23.10 s versus 7.22 s ideal, with armor glances and many rolls. These are controlled bots, not human DPS or encounter difficulty verdicts. Route-heart-normalized costs are lower-bound estimates, not the actual Arena's three-heart budget. Final dodge/defence findings must be read alongside them.


## Fresh real-input dodge pass

CUA phase 6 completed 326.135 s: 22 archetype kinds plus 14 guardians, 36 rows. 35 produced an actual back hop and flurry; all 14 guardians retained a real guardian lock. Wisp alone timed out. Its distant fireball is a damage 0 ball-spawn move and is excluded by foeThreat's harmful gate; its harmful flare only reaches 3.2 m while the enemy keeps 7 m (archetypes.js:591–613, flurry.js:75–87). This fixture therefore leaves projectile-arrival evasion unverified; it does not demonstrate a broken dodge. Generic machine is not in this archetype-only loop, but is represented by the Arena/defence suites. Actual normal difficulty, three hearts/resources and reserve 3 were asserted before the run; health was replenished for repeated trials, so this is input-window wiring evidence rather than survival balance. Raw 36 rows: cua-qa/dodge-progress.json; preflight: fixture-dodge.json.


## Comparison with the published v1.87 score

The prior 4.51 is not a like-for-like fresh observation baseline. Its report explicitly carried the 23 by-eye foe grades from v1.61/v1.63 (and the Wisp follow-up), awarded most identities 5 despite no listening, and kept most guardian fairness 5. The present report rejudges current silhouettes and timings, caps unheard identity at 4, and applies the skill's current still-pressure cap 3 when the fresh guardian run exceeds 3 hearts/min. The five reach failures are repaired and their old reach-specific cap 2 is removed; this is a concrete gameplay improvement even where a separate pressure cap now applies. Puzzle no-opening limits remain labelled as generic-bot coverage, not newly defective puzzles.

Consequently the fresh mean near 4.2 must not be presented as a measured decline from 4.51 or evidence that unchanged foes became worse. It is a more conservative reassessment using the same six named categories, with broader fresh play and stricter evidence qualifications. A calibrated longitudinal delta would require rescoring retained historical raw data and matched visual coverage under this exact judgment policy; those raw historical data are not in the frozen report folder. The useful comparisons are concrete dispositions and current low-scoring observations, not subtraction of headline means.

## Combat as a whole (fresh reviewer judgment, 1–5)

| Criterion | Score | Evidence and limits |
|---|---:|---|
| Responsiveness | 4 | Real input produces charge, clean roll and paired perfect parry/riposte contacts; 35 timed hop/flurry successes. No physical-controller comfort or end-to-end input latency measurement. |
| Feedback | 4 | Visible hit effects, armor glances, bright reward and riposte/contact state agree. Crowd/chain popup overlap can obscure the traveller; sounds are numerically tested but unheard. |
| Move variety | 4 | Charged gorged hit 5 versus ordinary 3 and stunned riposte 10 versus 6 create a real 6 HP breakpoint; roller armor, jelly support and marionette strings invite distinct answers. Quick-only bot remains competitive, so no claim every move is optimal everywhere. |
| Difficulty curve | 4 | Twelve worlds sampled, corrected 48 packs spatially valid, five Normal/Gentle comparisons and lower Gentle harm in all five. Two skilled paths needed assistance; Kiln crowd/exposure remains a local weakness. |
| Camera and lock-on | 3 | All 14 guardian locks retain combat anchors after settling; automated lock scenarios pass and R3 teaching works. Three close guardian upper extremities crop, crowds obscure the traveller, physical pad comfort untested. |

These five judgments describe the player systems and are separate from the roster/guardian mean. No unmeasured check is promoted to a pass.

## Final bounded defence matrix

23 kinds, 59 attack rows, 194 actual input trials in 1124.184 seconds: 73 blocks, 42 parries, 12 evades, 19 hits and 48 no-contact outcomes. Four rows sampled all ten prescribed action points; 27 rows had no selected attack within the 45-second per-kind budget. Full matrix and exact missing rows are in defence-summary.md and cua-qa/defence-summary.json. Blot lunge/combo show early guard blocks and late .06–.12 s parries. Machine quake hits through five guards, consistent with its ground-wave/jump answer rather than a universal guard failure. Skitter rush 10/10 and Bell toll 9/9 produced no contact callbacks; their defensive timing remains inconclusive. The other hits are mixed timing outcomes, not proof every attack should be blockable. Health/reserve are replenished and this is not a survival test.

Support fixtures may include an escort; global player callbacks do not identify the attacker, so those rows prove combined-fixture defensive events rather than attribution to every named support attack. Missed means no contact callback, not a failed defence. Empty cells are neither passes nor failures.

## Final targeted contact review

Three original-hall diagnostics completed with errors[] and 43 active-window samples per guardian. Arzach peck reaches 14 actual contact parts late in its active window; the initially empty early frame was a timing artifact. Underwater reaches 29 parts; the widened 95-degree diagnostic shows wind and active hand volumes fully in frame. Spacecity bars stays at 0 floor-contact parts across this staged active window. Its saved active-best frame is the initial empty overlay, not a successful contact proof. This remains an explicitly unresolved pose/overlay coverage limit; no broken gameplay attack is inferred. The source uses a body-arm attack, not a projectile substitution. Original frames and numeric samples are retained under cua-qa/hall-contact-*.json and images/. All four final images were viewed at full supplied size. Perdide 2 raised wind-up wing tip remains clipped in the earlier diagnostic side fixture; the strike frame is usable. No further broad recapture is warranted for these bounded limits.


# Fresh roster score tables

These are fresh reviewer judgments from current measures and inspected images. Final defence/contact checks are complete with their bounded limits recorded. Source-generated numerical starts are preserved separately. No score 5 for audio identity: no audible listening occurred.

| Foe | Readability | Counterplay | Space | Fairness | Identity | Combines | Mean |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ink blot | 4 | 5 | 3 | 4 | 3 | 3 | 3.67 |
| makers’ machine | 5 | 5 | 3 | 5 | 4 | 3 | 4.17 |
| shellback crab | 4 | 5 | 5 | 5 | 4 | 3 | 4.33 |
| skitter | 3 | 5 | 3 | 3 | 4 | 3 | 3.5 |
| ring centipede | 5 | 5 | 3 | 5 | 4 | 3 | 4.17 |
| bellows toad | 5 | 5 | 5 | 5 | 4 | 3 | 4.5 |
| horn lizard | 3 | 3 | 3 | 5 | 4 | 3 | 3.5 |
| stilt heron | 4 | 5 | 3 | 5 | 4 | 3 | 4 |
| pearl roller | 5 | 5 | 3 | 4 | 4 | 3 | 4 |
| root knot | 3 | 5 | 3 | 5 | 4 | 3 | 3.83 |
| lantern jelly | 5 | 5 | 4 | 5 | 4 | 5 | 4.67 |
| signal moth | 5 | 5 | 4 | 5 | 4 | 3 | 4.33 |
| sky ray | 5 | 4 | 4 | 5 | 4 | 3 | 4.17 |
| mound worm | 5 | 4 | 3 | 5 | 4 | 3 | 4 |
| lamp tripod | 5 | 5 | 3 | 5 | 4 | 3 | 4.17 |
| crucible cart | 5 | 5 | 5 | 5 | 4 | 3 | 4.5 |
| bell walker | 5 | 5 | 3 | 5 | 4 | 3 | 4.17 |
| ring drone | 4 | 3 | 5 | 5 | 4 | 3 | 4 |
| furnace brute | 5 | 5 | 3 | 5 | 4 | 3 | 4.17 |
| shade | 5 | 4 | 4 | 5 | 4 | 3 | 4.17 |
| antler hound | 5 | 4 | 4 | 5 | 4 | 3 | 4.17 |
| marionette | 5 | 4 | 4 | 5 | 4 | 5 | 4.5 |
| ember wisp | 5 | 4 | 3 | 5 | 4 | 4 | 4.17 |

Reviewer changes: Skitter fairness 2→3 because the short stationary zero-harm watch understates its actual timed rush/pack role; Roller 2→4 from live armor/glance trials and corrected Spheres pack pressure. Lizard/rootknot readability each loses 1 for low/quiet body tells in fresh strips; Drone loses 1 for cloud-obscured core. Jelly space 2→4 and counterplay 4→5 reflect the airborne curtain, groundable body and interruptible support rather than the automatic hover-only tag. Jelly and Marionette combines 3→5 for ward/mend or observed host-driving support. Wisp counterplay 2→4 and combines 3→4 because the automatic scorer omitted reflection/hook/projectile answers from its property list; this is source-supported variety, not a claim that its arrival-dodge path passed. All other numerical starts retained after the fresh silhouette/watch review.

| Guardian | Readability | Counterplay | Space | Fairness | Phases | Mean |
| --- | --- | --- | --- | --- | --- | --- |
| the Keeper of the cistern | 4 | 5 | 4 | 3 | 5 | 4.2 |
| the warden | 4 | 5 | 5 | 3 | 5 | 4.4 |
| the Elder | 4 | 5 | 4 | 3 | 5 | 4.2 |
| the Cloud-Mother | 4 | 5 | 4 | 3 | 5 | 4.2 |
| the Mother Snapper | 4 | 5 | 4 | 2 | 5 | 4 |
| the Lampless | 4 | 5 | 4 | 3 | 5 | 4.2 |
| the Gardener | 4 | 5 | 5 | 3 | 5 | 4.4 |
| the Listener | 4 | 5 | 5 | 3 | 5 | 4.4 |
| the Clockwork Foreman | 4 | 5 | 4 | 3 | 5 | 4.2 |
| the Tooth-Warden | 4 | 5 | 4 | 3 | 5 | 4.2 |
| the Last Founder | 4 | 5 | 5 | 3 | 5 | 4.4 |
| the Echo | 4 | 5 | 4 | 3 | 5 | 4.2 |
| the Anchor-Warden | 4 | 5 | 4 | 3 | 5 | 4.2 |
| the First Sign | 4 | 4 | 5 | 2 | 5 | 4 |

Guardian fairness is capped 3 when still-player pressure exceeds 3 hearts/min per skill; no old 1.5 m reach cap remains. Mother Snapper/First Sign retain 2 under the strict no-opening rubric, with an explicit puzzle-fixture qualification: the generic bot does not perform their required puzzle actions, so these are not asserted new unfairness defects. All guardian bodies/phase markers reviewed; actual-hall close framing limits are scored under camera rather than hidden in these tuning totals.

Overall mean of 23 ordinary and 14 guardian means: **4.16/5**.


## Readability evidence

The [lizard and root-knot strips in the creature-motion report](procedural-animation-v1.90.md) show the low-body and quiet-anticipation limitations behind their combat readability grades. The [fight-temple report](combat-fight-temples-v1.90.md) includes the Kiln crowd image and the separate larger-text HUD failure. These reports preserve their different rubrics and coverage limits.
