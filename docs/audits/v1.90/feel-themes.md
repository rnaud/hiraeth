# v1.90 game themes 2, 9, 10 and 11 — final evidence

Frozen source: `c5449ab6c`, audit-v190. Source review plus completed Node metrics and completed skilled and normal-masher combat browser runs. Fresh theme judgments are stated below; the combat judgment includes the final bounded defence/contact diagnostics. Prior v1.87 scores were 4/5 for each of these themes; those are comparison values, not current scores.

## 2 — The first five minutes

Confirmed source improvement: R3 recenter now teaches its action once when hints permit (`src/host/game-host.js:744–748`). This resolves the former “only in Controls” source finding; Fresh standard virtual-pad R3 through the real controller path set the teaching flag once across two presses. The queued notice appeared after the objective card, reading “No foe near: RS turns the camera behind you.” The later screenshot was inspected. This verifies routing and visible teaching, not physical-controller comfort. First tank fill remains the sixth stage (`src/story/desert-data.js:108`) after city, chest, Nour, skull and drain. Do not infer minutes from a stage count. An outside first-time playtest is still needed to judge comprehension and pace; no recommendation to reorder the opening solely from this count.

## 9 — Game feel

The matching stop repair now suppresses moving-pose weight after a settled dwell (`src/animator.js:832–842`). Same-day #597 before/after keyboard and Unity evidence exists in the sibling durable validation directory, but is labelled prior task evidence, not the full new motion audit. Fresh deterministic Node suite: default 16/16 green, optional matching 4/16 green, improving from 1/16 but still 12 failed scenarios. Fresh world runs are steady in all six cases: default has modest terrain/pivot threshold failures, while matching fails all three. CPU ×4 is separately cadence-confounded in Desert/Bazaar; it is not a handheld measurement. Fresh repeated settled-stop traces show matching weight 0 at all eight late samples and an upright side view; the old long-idle freeze was not reproduced. Source fixes do not justify copying a green verdict across optional matching.

## 10 — Combat

New clean-roll reward and gorged charged/riposte bonus have real mechanical niches, supported by prior #535 wiring evidence. A 6 HP gorged heron can fall to opening cut plus full charge before the quick chain's next cycle; a stunned riposte has greater burst. This does not establish general DPS superiority or twelve-temple variety. Fresh guardian 60 Hz reach checks pass the five previously penalized bosses; three generic-bot puzzle-opening failures are separately classified. A 30 Hz reach alarm disappears with dense body-path sampling, so it is not carried as a game failure. Skilled temple curve is 12/12 complete: ten unassisted and two assisted (Lift Depot and Oil Exchange). Normal masher completes five comparison worlds without assistance or knockouts. Kiln skilled loss 13.25/12 exceeds the masher’s 9/12 and takes longer, so bot rolling/exposure confounds a blanket difficulty-spike conclusion. Dense-body occlusion remains independently visible. Corrected Gentle 5 now clears without assistance, with lower harm in every comparison. All 23 ordinary foes, 42 guardian phase frames and 14 own halls have fresh visual evidence; corrected 48 route packs stay within bounds. The final defence scan is complete: 194 trials across 59 attack rows, with 27 attacks and parts of the timing grid unmeasured. The full qualification is in combat-v1.90.md.

## 11 — Accessibility and UX

Confirmed source improvement: fight-temple hazard framing chooses a fixed frame under reduced motion (`src/fight-temples/session.js:168–169`), resolving the former ignored-setting finding. Fresh actual-hazard toggle confirms camera settles to (.0142, .0076) m and zoom 1.000588 after 4.185 s while preserving the tell. Settings expose text scale, plain speech background, reduced motion/system preference, shake, keyboard/pad remapping, run and guard toggles (`src/ui.js:56–64,75–79`). No colour-blind mode found in the settings schema or current source text search. That absence alone is not proof of unreadable cues: existing ink outlines and shape cues must be inspected in actual frames. No audible listening, physical pad trial or device check is in this audit assignment.

## Outstanding evidence

Run queue and resource conditions: plan.md. New playable caravan #599 is outside this frozen snapshot. Combat score and final recommendation synthesis are complete; bounded missing cells remain explicit in signoff.json.

## Supplemental fixture notes

The first recenter attempts used Tab, whose keyboard handler only locks (`src/main.js:2218`); R3 additionally recentres and teaches (`main.js:1804–1807`). The virtual-pad run is the valid R3 evidence. The initial snapshot preceded the queued hint, but the later snapshot shows it; a “firstPrompt:false” summary field is not a missing-hint verdict. Earlier paused/Tab runs remain archived.

Fresh staged full-charge comparisons hit the actual opponent through input: gorged 5 damage versus ordinary 3, with equal normal-state HP loss and no stun multiplier. Clean-roll callback occurred through an actual Alt roll; at a partially filled reserve it rose from 2.6 to the cap 3 and the bright state appeared. Full-charge fixtures freeze other opponents and position the target to make the strike repeatable; they do not prove whole-run move diversity. Fresh CUA staged perfect-parry/riposte trace is verified: guardAge 0.1355 s, one incoming 5-damage riposte, targetHP 100→90 from the expected stun ×2 multiplier. The initial 120 s wide-view fixture never produced a camera shift and is not a pass. The corrected targeted real-hazard check below verifies reduced-motion settling.

### Narrow larger-text HUD — confirmed finding

Full-page CUA image `cua-qa/accessibility-large-text-full-page.png` was independently inspected: at 640×720 and scale 1.45, the timer covers the top-left hearts/reserve and the room label clips beyond the right edge. This layout fails while the reduced-motion camera check passes. Source anchors: `src/minigames/kit/minigames.css:7–16` keeps a three-column single-row grid, nowrap boxes and a 6.2 em timer minimum. Recommend responsive reflow/reserved resource space; no implementation change made. Repeated access capture retains real tell and settles to (.0142, .0076) m, zoom 1.000588 at 4.185 s; no need further rerun.


## Current theme judgments

| Theme | Fresh v1.90 /5 | Prior v1.87 /5 | Reason |
|---|---:|---:|---|
|2 First five minutes|4|4|R3 teaching now verified visually through the real virtual-pad path; broad opening still lacks a fresh outside novice comprehension trial.|
|9 Game feel|4|4|Ordinary motion and settled stops work; optional matching retains substantial contact failures. Fresh six-world baseline cadence steady.|
|10 Combat|4|4|Reach improvements, meaningful reward/charge niches and fresh temple/roster/pack evidence. Final bounded defence matrix confirms contacts while retaining 27 unsampled rows; Spacecity contact-overlay coverage remains unresolved. Crowd visibility and close framing still constrain the experience.|
|11 Accessibility/UX|3|4|Reduced-motion hazard response repaired, but actual narrow larger-text view obscures resources and clips the room label. This new confirmed failure outweighs a blanket carry-forward 4.|

Prior investment dispositions with exact evidence and limitations: investment-dispositions.md. These judgments are based on fresh observations and source qualifications, not an inherited score. No physical gamepad, audible listening or fresh novice study is claimed. The separate native/device owner supplies any device conclusions; they are not silently folded into this Mac feel audit.
