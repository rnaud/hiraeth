# Game audit v1.90 — design themes 1, 4, 5, 6

v1.90 at c5449ab6c, recommendations only, #598. These four themes remain 4/5, as in v1.87. No overall weighted score is calculated by this partial-theme contribution. The audit excludes localisation and later #599 changes. No device or sound claims.

## 1. Core experience and coherence — 4/5

The specific repeated failure—new chest locks offered before their tools—has a coherent repair across giver readiness, later acquisition offers and beacon visibility (`src/boxes/index.js:64–76,308,349,481`). Fight hosts now explain hazards through their occupations rather than one repeated bargain (`src/story/hosts-data.js:81–152`). The end card says enemies were sent back into the floor (`src/fight-temples/session.js:551`), matching the ink fiction.

The remaining risk is integration at first contact: new inventory, appearance and arrival systems still need to be judged in actual play. Source/test breadth is not a substitute for an outside player's understanding. Do not treat a reference-view ship prototype as the current playable ship; the later replacement request is outside the frozen audit.

## 4. Rewarding exploration — 4/5

Fragments now occupy identifiable landmarks; the strongest potential improvement is climbing toward something the player can name, instead of sweeping bare ledges. The scientist's first arrival is staged, with a safe-route fallback (`src/story/scientist-arrival.js:24–40,101–126`). Both require representative runtime views before a score moves.

The finite reward tail remains: all wares total 206 fragments against 288 available, and the last new ware unlocks at 150 (`src/fragment-shop.js:21–43`). This is a design opportunity, not automatically an economy error: optional surplus lets players choose which fragments to find. Recommend a late optional non-numeric acknowledgement only if collectors need renewed purpose; avoid mandatory completion and avoid moving collectible tallying back into the family's grief scene. Ten immediately available outfits are player expression, not exploration rewards.

## 5. Narrative and harmony — 4/5

The v1.87 highest-value repairs are present: distinct fight workers, a tune that stops short before Ilen, the lamp moved after the stone's intimate conversation, a drone warning that no longer points elsewhere, and consistent place/name wording. Their presence warrants retiring those particular criticisms, not declaring every voice perfected.

The main remaining source-supported concern is Ilen's count-dependent fragment page within `light`, immediately before her apology (`src/story/lantern-data.js:160–170`). Move the acknowledgement to a quieter optional exchange after the confession. Preserve the varied responses to the traveller's choices and the physical family details; these are what make the reunion specific.

## 6. Arc and pacing — 4/5

Each temple ending now shows its consequence: cistern water, returning breath, falling stones, turning machinery, restored light (`src/temples/finale.js:60–137`). This addresses repetitive punctuation along the long middle of the journey. It does not alter the final chapter's central action: answer three lamps with a whistle (`src/story/lantern-data.js:20–24,301–309`).

The Lantern's nonviolent answer is thematically right. The open question is whether three identical activations create enough anticipation before the long reunion. If play confirms the old flatness, introduce a small difference in how each response is discovered—sightline, listening position, remembered route—without a combat climax or another tool gate. The third lamp should feel like someone finally answering, not completing an arbitrary checklist. This remains a hypothesis until runtime review.

## v1.87 investment dispositions

| Investment | Status supported now | Evidence / owner |
|---|---|---|
| Watch three outside players | Not evidenced | No fresh outside-playtest record found; root may supply one. Do not count the author's screenshots or agent automation. |
| Box quest/tool gates#557 | Fixed in source and structural checks | `src/boxes/index.js:64–76,308,349,481`; quest audit. |
| Guardian reach#558 | Separate combat evidence required | Combat worker owns the current measured result. |
| Hosts, quiet beats and Plumb#559 | Largely fixed | Dialogue disposition table names each source and remaining Ilen interruption. |
| Small fixes#563 | Named prose repairs fixed | Joss, Nima, Fenna, near names, scientist count wording verified. Reduce motion/UI verification belongs to root. |
| Desert mast / far temple keys#561 | Partly fixed; measured and corrected views inspected | Desert marker now present but weakly salient at roots; Mooring local gN/sc improved, d1 distant-eye recognition uncertain; Footprint dL key route passed live input. `src/story/desert-bike.js:102–132`, `src/temples/spacecity.js:273–305`, `src/temples/spheres.js:203–204,781`. |
| Heart arrival#560 | Separate combat evidence required | Do not infer balancing from a changelog claim. |
| Distinct temple ending panels#562 | Fixed as authored scene variety; full playback not repeated | Fourteen authored `FINALES` subjects, `src/temples/finale.js:60–137`. No claim that all fourteen films were replayed in this pass. |

No confirmed “worse” disposition yet. Keep recommendations sorted by demonstrated player impact and the lowest individual criteria, not by the amount of code changed.

## Editorial/Node update after full story reading

Quest gates now have fresh structural evidence: 223-step walk/no loops and 83 targeted checks passed. All 12 level measured scores remain unchanged. Mooring's formerly obscure dependencies are made legible in source/measurement; Footprint removes one of four obscure dependencies, leaving three. Corrected views and the bounded Footprint live path support these improvements. Distant-eye recognition and later Footprint locks remain unproven in play.

Three newly verified integration findings carry more value than another general prose polish pass:

1. **An active character arc promises retired content.** Tansy's onward branch gives a letter for Hesper at uncharted Salt Harbour (`src/story/fellow-data.js:265–273`; `src/levels/names.js:48,58`; `src/ship/ship.js:388`). Full symbol search finds no reachable postal alternate. Keep the retired world retired; provide a current-route handoff or self-mailed outcome.
2. **The ending remembers choices inaccurately.** `src/story/ending.js:242,340` assumes a promise for a keepsake that also represents declining, and assumes a kept visit delivered the later parents' news. The actual branches are separate (`src/story/perdide2-data.js:38–45`). Repair these before expanding consequence writing.
3. **Tools changed while instructions did not.** Current grants are fan/magnet, but Vell says jets and the traveller says tongs; three helpers hardcode three-shot capacity despite upgrades. This is coherence across dialogue and mechanics, not merely terminology preference.

Prior report's detailed findings can be fixed while untested adjacent branches remain wrong. These are newly discovered issues in the frozen snapshot; no claim that v1.90 introduced them. The three most costly patterns are forgotten cross-system consequences, old instructions attached to new mechanics, and late emotional beats interrupted by progress accounting. Recommendations draw on source, fresh structural checks, corrected actual-game pictures and bounded live input; no fixes made.

## Final scope and priority contribution

| Theme | v1.87 | v1.90 | Why no further uplift |
|---|---|---|---|
| 1. Core experience and coherence |4|4|Box-giver repair is real, but stale tool guidance and unreachable implied delivery expose integration gaps. |
| 4. Rewarding exploration |4|4|Landmark placement and Glass Court invitation improve; optional surplus remains deliberate, and no new collector study proves a stronger reward tail. |
| 5. Narrative and harmony |4|4|Hosts/tune/stone placement improve; Hollin memory, Tansy payoff and Ilen’s count interruption remain. |
| 6. Arc and pacing |4|4|House-specific consequences improve punctuation; no full silent ending replay or outside-player pacing observation supports a higher score. |

**Invest first:** (1) watch three new players, especially the low-score Desert opening/roots and the later Footprint chain; (2) give Tansy’s letter a reachable outcome; (3) repair Hollin’s ending predicates; (4) update obsolete tool and direction strings; (5) move Ilen’s fragment acknowledgement after the apology. These outrank new systems, blanket dialogue shortening or adding map clutter.

No investment is classified “worse” merely because this review found an adjacent old defect. Named#559 prose repairs are fixed individually; the wider guidance pass is only partly fixed. Guardian reach and heart-arrival dispositions must come from the combat owner’s fresh result, not this design contribution. Outside-player observation is **not evidenced**, and agent automation does not satisfy it.

Evidence totals: 223 formal quest steps/no marker loops; 83 focused tests; 12 world measurements; 14 temple solves/zero shrine-rule violations; 64 prescribed views + 11 corrected views; 26 plans/maps; bounded Footprint early path through lens acquisition, with dR/d4/dG still closed and no guardian completion claim. Every browser context muted at construction/master 0; no sound or device evaluation. Source remains c5449ab6c.

[Preserved design evidence](README.md). This is a partial-theme contribution, not the combined game audit.
