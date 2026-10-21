# Quest QC v1.90

<!-- audit-scores
overall: 4.97 / 5
label: the mean of the seven rules over sixteen places (the twelve route worlds, the Lantern, Anselm, the fight temples, the space ports)
date: 2026-10-20
-->

Recommendations only for #598, frozen at **c5449ab6c**. Localisation, discarded side worlds, devices and post-snapshot #599 are excluded. The seven-rule mean is **4.97**, up from 4.88: the repeated pre-tool box-offer defect is repaired. This high structural score is not a claim that all prose or implied errands are correct; Tansy’s unreachable letter sits outside the formal quest-step inventory.

Fresh checker/marker walk: **223 steps** (157 story, 43 temple, 23 box), **three classified flags, no marker loops**. Sixteen focused files: **83 passed, zero failures**, concurrency 2. Main and merged-world dialogues, temple guides and optional branches were read. Runtime footage covers all prescribed design views plus a bounded live Footprint path through lens acquisition; no all-quests live playthrough is claimed. Pre/post-tool invitation and Plumb flight are verified in source/tests, not newly replayed in this browser pass. Vael’s early-feather convergence remains an explicitly unscored interaction hypothesis.

## Scores

Same row names and rule headers as v1.87. A 5 means no established violation in the reviewed scope, not proof of exhaustive live play. Answers-follow 4 remains for Ama’s mismatched question, Vey’s stale reveal direction, and Petra’s reply naming a different tool. Other dialogue/ending defects are reported separately rather than forced into an unrelated rule.

| Place | Short steps | Nobody sends you on | Straight to the end | Nothing before it’s had | Answers follow | A marker moves on | Short talks | **Mean** |
|---|---|---|---|---|---|---|---|---|
| The Desert | 5 | 5 | 5 | 5 | 4 | 5 | 5 | **4.86** |
| Vael (with the sky stones) | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5.00** |
| Lorn (with the Deep Wood) | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5.00** |
| Viridel | 5 | 5 | 5 | 5 | 4 | 5 | 5 | **4.86** |
| The Underwater City | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5.00** |
| The City-Shaft | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5.00** |
| The Glass Dunes | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5.00** |
| The Buried Machine | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5.00** |
| The Moon Foundry | 5 | 5 | 5 | 5 | 4 | 5 | 5 | **4.86** |
| The Garden of Spheres | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5.00** |
| The City Floating in Space | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5.00** |
| The Signal Market (with the night mail) | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5.00** |
| The Lantern | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5.00** |
| Anselm Thrum (the ship, every world) | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5.00** |
| The fight temples | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5.00** |
| The space ports | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5.00** |

## What happened to the previous findings

1. **Box quests before their tools: fixed in source and fresh all-world structural checks.** `src/boxes/index.js:64–76` derives the relevant court/lock tool, `:349` gates a giver's readiness, `:308` reconsiders an arrival offer after acquisition, and `:481` gates the beacon. This addresses the original failure at the invitation, rather than merely proving a tool exists somewhere in the same world. The test should preserve three states for every affected chest: before tool, immediately after acquisition, and already-open chest on reload. Verify local direction lines as well as the central giver predicate.
2. **Joss's “at the top”: fixed.** `src/temples/spacecity-data.js:59` now places the machine behind a barred gate; the keeper step remains past the Cord Loft. The reviewed source matches the guardian's floor, and the house’s plan/current views agree with its barred-gate structure; no full guardian route completion is claimed.
3. **Blade Gate warning followed by flight to an unrelated objective: fixed in implementation.** `src/host/game-host.js:282–289` returns Plumb home for a warning with no point, and only pings a destination-bearing hint. A paired runtime check remains useful; no live flight/timing acceptance is claimed here.
4. **Marrow calls after Plumb has started the quest: unchanged, limited.** `src/story/desert.js:821` explicitly allows the call while the main quest is on `city` and Marrow is unmet. However `:794–805` makes this a once-per-opening call, not an endless repeated instruction. Recommendation: suppress the redundant call once the player is already following the village objective, or change it into an optional fragment invitation. Do not describe it as a progression blocker.
5. **Temple step template: unchanged structural pattern.** It merits house-specific wording where it clarifies a decision, not replacement merely to vary syntax. Review every current local/quest pair against the actual room plan before proposing exact edits.

## Ranked recommendations

1. Give Tansy’s letter a reachable postal outcome. Its ordinary-map recipient is retired; preserve the author’s removal of that world. Medium work, highest player impact; not counted among the 223 formal steps.
2. Correct Ama’s question to ask where the water comes from; preserve the shared reply. Small rule 5 repair.
3. Correct Vey’s post-opening instruction to the external scar, and Petra’s “Tongs” reply to “magnet glove”. Small rule 5 clarity repairs, no state migration required for strings alone.
4. Exercise Vael’s three-feather pickup before calling the bird; if the tower marker lacks the call prerequisite, show the missing action. Hypothesis, no current softlock claim or score deduction.
5. Suppress or reword Marrow’s once-per-opening call once the city objective is already underway. Optional clarity improvement, not a blocker.

## New source finding from whole-branch reading

**Desert, Ama, rule 5:** `tree.choices[0]` at `src/story/desert-data.js:266` asks whether the tree can be relit, then enters `giants` at `:270–271`, which answers where the water comes from. The other incoming branch asks exactly that, so the shared reply is correct for one path and wrong for the other. Recommendation: change the tree branch's choice to “Where does its water come from?” (tone curious), retaining the shared node and all state. Small non-blocking clarity issue; if unchanged at final review, the Desert's answers-follow row should reflect it even if the automated suite passes.

## Additional unscored branch to exercise

Vael's Shed Feathers can start on pickup (`src/story/arzach.js:293`) or Senn's account (`src/story/arzach-data.js:186–187`) before the main bird quest. Its `give` step says “Bring the feathers back to the bird” (`:73`); the hand-in is disabled while the bird is dormant (`src/story/arzach.js:340`), and that state redirects the bird marker to the tower balcony (`:526`). This may be a deliberate convergence with the main route. Before marking rules 4/6 down, test collecting all three feathers before calling the bird, then follow the marker: is the needed call action available and legible there, or is another prerequisite unexplained? Do not call this a softlock based on source alone.

## Fresh checks completed

Unmodified checker `--walk`: **223 steps**, comprising 157 story, 43 temple, 23 boxes; **three flags**, and **no marker loops**. Targeted 16-file suite: **83 passed, zero failed**, concurrency 2, 19.6 seconds. Logs `quest-check.log` and `targeted-tests.log` preserved. This confirms structural invariants, not whether every answer follows its preceding question.

Flag dispositions: Desert `gun` gate warning is not a current progression defect: `desert-spark.js:57–68` requires a push hit to move the weight and points an unarmed player to the chest; `:82–83` only enables the stone after the grille opens. The chest grants the actual gun (`boxes/placements.js:74`); adding a mandatory quest gate merely to silence the heuristic could obstruct legitimate completed-state skipping; Esk's `ask` is the deliberate consequence/apology after the player's damage, not an avoidable delivery chain; Night Mail's `board` completes through travel code rather than a static flag, so the checker cannot infer it. The latter two retain useful interaction and should not be deleted to make the count zero. Source-confirmed Ama/Vey/lamp direction issues remain clarity recommendations despite these passing metrics.

## Main-route errand outside formal quest metrics

Tansy's fourth meeting gives `saltletter` for Hesper at discarded Salt Harbour (`src/story/fellow-data.js:267–273`, `src/levels/names.js:48,58`, ship map `src/ship/ship.js:388`). This is not represented as a `QUESTS` step, so 223-step checker success cannot establish its reachability. Existing test directly loads Hesper's discarded content. Recommend a reachable postal handoff or self-mailed outcome, preserving both choice and the author's retirement of the side world. No recommendation to work on the discarded world itself.

## Preserved audit evidence

Evidence was collected on 2026-10-20 at frozen commit `c5449ab6c`; this final report was consolidated on 2026-10-21 without rerunning the audit. [Evidence inventory and limitations](design-v1.90/README.md) preserve the raw measurements, classified flags, source reading and bounded live-path record. [Prioritized design recommendations](design-v1.90/recommendations.md) separate quality criteria from lock-level obviousness heuristics. Later ship changes and any separately collected device results are outside this report’s scores.
