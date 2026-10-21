# Design recommendations, lowest scores first

Design contribution to the combined #598 synthesis. Frozen **c5449ab6c**, v1.90; recommendations only. This covers dialogue, formal quest rules, level design, temple design and game themes 1/4/5/6. It is **not a full-game score**. The combined report incorporates the separate feel, visual and performance findings; they are not scored here. Localisation, devices and later #599 changes are excluded.

## Lowest lock-level heuristic values

These are current measurements from `temple/report.json`, separate from the quality criteria below. **Obviousness runs from 1 (very indirect/possibly obscure) to 5 (very obvious)**, using key distance, room separation, sightlines, combined verbs and hidden-state rules. A low value is a prompt to inspect a relationship, not automatically a bad puzzle; a high value can mean triviality. Do not average these numbers with quality scores, where higher is better.

| Raw obviousness | All current locks at that value (world IDs preserved) |
|---|---|
| **1/5** | `desert`: `d3`; `edena`: `vineV`; `underwater`: `dH`; `incal`: `d3`; `buried`: `br1`; `spheres`: `dR`, `d4` |
| **1.5/5** | `perdide2`: `d2`; `underwater`: `d2`, `dL`; `garage`: `cage:kE`; `spheres`: `dT`; `bazaar`: `dG` |
| **2/5** | `desert`: `cage:kS`, `sc`; `arzach2`: `d1`, `d4`; `perdide`: `d1`, `d2`, `cage:kS`; `perdide2`: `cW`; `edena`: `vineS`, `d1`; `garage`: `dC`; `buried`: `cage:kB`; `moonfoundry`: `dS`, `dF`; `spacecity`: `d2`; `bazaar`: `draught`, `d4` |

Evidence is graph/source measurement, with screenshots supporting selected relationships. Footprint (`spheres`) dT **1.5** was actually solved during the bounded live path and its upstairs drop made sense. Footprint dR/d4 **1** were not played: their later lens/lift reasoning remains a hypothesis for newcomer testing, not observed frustration. No other locks listed here receive a claim of live completion from this audit.

Completeness check: the table lists every current lock-level obviousness value at or below 2 across all 14 houses. At the comparable criterion level, the only raw 1/2 is **Belfry identity 2**, explicitly adjusted to **3** for its current bell/pole architecture; there are no other raw 1/2 quality criteria concealed by these four audit means or the four contributed game themes. These are scoped design results, not a claim about pending visual/feel/performance scores.

## Lowest individual criteria

| Criterion | Score | Evidence strength | What the score warrants |
|---|---:|---|---|
| Desert onboarding | **3/5** | Source/route measurement plus actual arrival and corrected roots/gate screenshots; no newcomer observation | First goal 212 m away and six early action stops. The return marker exists but is weakly salient at roots, competing with smoke/flames. Preserve the journey; test recognition before adding more guidance. |
| Glass Dunes optional pull | **3/5** | Route measurement plus corrected fork/entrance screenshots | 15 of 36 optional places are remote. The Court’s lamp/post approach is visibly improved; do not repeat the old missing-invitation claim or force the optional Court onto the main route. |
| Footprint non-obviousness | **3/5** | Graph/source, corrected lock views, **bounded live play through lens acquisition** | dT’s upstairs drop made sense while played; dL’s new pool-key route works. Later dR/d4 remain unplayed hypotheses. Test those relationships before simplifying the house. |
| Founders’ Belfry non-obviousness | **3/5** | Graph/source and screenshots, no complete live path | Several direct steps leave room for a more meaningful later combination; no observed player frustration or proven need for a redesign. |
| Whale-House non-obviousness | **3/5** | Graph/source and sound-hall screenshots, no complete live path | Hidden dH/dL relationships deserve a real-input check before changing their distance or adding arrows. |
| Temple identity, most houses | **3/5** | Skeleton comparisons plus visual/source judgement | Common structure persists, but similarity alone is not sameness of play. Belfry’s raw graph score **2** is adjusted to **3** from current bell/pole architecture; it is not a new regression. Whale identity is **4**. |
| Dialogue quest clarity | **3.5/5** | Complete scoped source/editorial review, branch/path searches and targeted tests; not all lines replayed | Definite mismatches include inaccessible delivery, obsolete equipment, directions and capacity claims. These are more actionable than speculative geometric changes. |

The remaining relevant criteria are **4/5**: dialogue choices, tone, mystery, lore load and distinct voices; game themes 1/4/5/6; most guardian exams and selected combination/item criteria. Distinct voices improves **3.5 → 4** after the host rewrite. No guardian receives a subjective uplift from still images or solver success.

## Ranked actions by demonstrated impact and likely cost

Estimates are planning ranges, including focused validation; they are not implementation commitments.

1. **Give Tansy’s letter a reachable outcome — roughly half a day.**
   - Definite source integration gap: `src/story/fellow-data.js:267–273` grants `saltletter` for Hesper, but Salt Harbour is discarded (`src/levels/names.js:48,58`; ship filtering `src/ship/ship.js:388`). Full consume-path search found no reachable postal alternate; the existing test directly loads the discarded content.
   - Use an existing reachable postal handoff, or let Tansy mail it and give the traveller a copy. Preserve her choice/letter arc and the author’s retirement of the world. Validate the ordinary map route and old-save outcomes.
   - This belongs above cosmetic score improvements: an active promise currently cannot be fulfilled through normal travel.

2. **Make the ending remember the actual Hollin choices — 1–3 hours.**
   - Definite source/branch mismatch: `src/story/ending.js:242,340` assumes an accepted promise and delivered parents’ news. The keepsake also exists after declining; an ordinary return can keep the promise before the news is known (`src/story/perdide2-data.js:38–45`).
   - Use the actual keepsake/choice and news flags, or truthful generic lines. Check declined, kept-without-news and news-delivered variants. No new scene needed.

3. **Refresh obsolete tool and direction wording — 2–4 hours as one focused pass.**
   - Definite source/runtime-contract evidence: Vell says jets while the chest and migration grant the Gust fan (`src/temples/incal-data.js:44`, `src/boxes/placements.js:102`, `src/save-migrate.js:297`); Petra answers “Tongs” after a magnet-glove explanation (`src/temples/moonfoundry-data.js:54`). Ferro/Wim/Fisk assume three-shot capacity despite upgrades (`src/story/bazaar-data.js:241`, `src/temples/garage-data.js:60`, `src/temples/buried-data.js:56`; `src/resources.js:140–144`).
   - Correct Vey’s post-opening instruction to the external scar (`src/story/edena-data.js:354–358`; runtime `src/story/edena.js:61–109`), and the Signal Market lamp’s opposite compass word (`src/story/arzach2-data.js:309`, `src/story/arzach2.js:240`). Preserve actual mechanics and valid earlier directions.
   - Include Ama’s mismatched question (`src/story/desert-data.js:266–271`). Verify each relevant inventory/reveal state rather than changing generic terminology everywhere.

4. **Observe three new players at the weakest decisions — about one day.**
   - Evidence gap, not another automated test: Desert first objective/roots return; Glass Court fork; Footprint dR/d4 after the lens lesson. Agent source knowledge and controlled input do not measure discovery or frustration.
   - Record their first chosen direction, what they recognise and where they infer a cause. Use results to decide whether to separate the existing mast silhouette, strengthen a fork or add persistent state feedback. Do not blanket-add waypoints.

5. **Protect Ilen’s apology from collection accounting — half a day.**
   - Definite written sequence issue, experiential severity not newly replayed: `src/story/lantern-data.js:160–170` inserts a count-dependent fragment page immediately before the apology.
   - Move the existing acknowledgement branches to an optional later exchange, preserving count variants and emotional choices. Check all branches; do not turn the reunion into a reward screen or shorten grief indiscriminately.

6. **Repair chronology and literal glyph continuity — 2–4 hours.**
   - Source-confirmed contradiction: Wynn’s thirty-year silence conflicts with the recent event and child courier (`src/story/bazaar-data.js:107,201–225,348`). Separate years spent listening from years of outage.
   - Update Hask/Bertil’s retired arc description to the current glyph (`src/story/buried-data.js:201`, `src/story/moonfoundry-people.js:132–134`; `lore/continuity.md:42–44`). Keep local interpretations distinct; correct only literal shape claims. Keep Nour’s family inference consistent with the separate recordings (`src/story/desert-data.js:654–660`; `src/story/calls.js:526,542–546`).

7. **Only after play evidence, refine remote puzzle feedback — half a day per selected relationship.**
   - Footprint dR/d4: preserve the hidden-eye, lift-height and carried-key reasoning; if players lose the causal link, keep readable confirmation at the relevant lock. Potential non-obviousness **3 → 4**, not awarded now.
   - Mooring d1: its 61.3 m eye is geometrically visible through aligned windows; recognition is unproven. Repeat the eye motif if needed rather than moving it next to the door. Keep repaired gN/sc relationships. Mooring already improves **4.22 → 4.33** overall.
   - Whale dH/dL: test the tide/spring relationship before adding direct hints. Belfry: one meaningful later hook/push combination is preferable to extra fetching solely to alter a graph score.

## Why the quest headline does not cancel the top finding

**Formal quest rules score 4.97/5**, improved from **4.88**, because the repeated pre-tool box-offer defect is repaired. Fresh checks cover **223 formal steps**, no marker loops, and **83 passing targeted tests**. Three answer/direction deductions remain in the comparable sixteen-place/seven-rule table.

Tansy’s letter is an **untracked implied errand outside that step inventory**. Its inaccessible recipient is therefore not disproved by the formal score or test success. Describe the headline as “formal quest rules,” never “all errands work.” Likewise, dialogue’s **4.14** mean reflects semantic/branch defects the structural checks do not catch.

## Results and acceptance limits to carry into the combined report

- Dialogue **4.14**; formal quest rules **4.97**; level design **4.73**; temple design **4.40 adjusted / 4.39 raw**. Game themes 1/4/5/6 remain **4** each. Do not average these into an invented full-game score.
- All 12 world measurements and 14 temple solves completed; zero shrine-rule violations. **64 prescribed views + 11 corrected views**, with invalid automatic camera frames explicitly labelled rather than treated as gameplay defects.
- Live Footprint path: one entry reposition with normal previous-world debug equipment; then physical walking/aimed input solved d1, stones, pool key, dT and dL, acquired the actual lens and revealed its mural. **dR/d4/dG remained closed; guardian and full house not completed.** No puzzle flags written. Silent browser checks had master 0 and no page errors.
- Plumb flight, ending timing and pre/post-tool invitation repairs are source/test verified, not newly replayed here. Surface-deck lift discovery and early Vael feather convergence remain explicit focused acceptance questions. No sound, device or outside-player claims.
- Keep existing strengths: the long Desert journey, optional Court, early Greenhouse bloom, nonviolent Lantern resolution, meaningful refusals and distinctive host occupations. Recommendations seek precise repairs, not new systems or blanket rewrites.

## Full reports

[Dialogue](../dialogue-v1.90.md) · [Formal quest rules](../quest-v1.90.md) · [Level design](../level-design-v1.90.md) · [Temple design](../temple-design-v1.90.md) · [Game design themes](themes.md) · [Evidence](README.md)
