# Hiraeth against what makes a great game (October 2026, v1.90)

<!-- audit-scores
comparison: Unchanged weighted result; prior 4.2 was rounded to one decimal
overall: 4.17 / 5
label: the twelve themes, weighted (themes 3–8 count double)
date: 2026-10-21
-->

**Final frozen-baseline synthesis: 75/18 = 4.17/5.** Evidence collection is complete with the limits stated below; recommendations remain subject to the user's review. Later explicitly authorized repairs are tracked separately and do not retroactively change these scores.

This reviews frozen source `c5449ab6c`, before the separately deployed v1.91 playable caravan. It follows [the v1.87 game audit](game-v1.87.md). The full set includes design, dialogue, formal quest rules, temples, combat, motion, camera, sound, performance, creatures, rendering and cinematics. Results below distinguish inspected play, automated policies, source review and physical-device evidence.

## Final scores

| # | Theme | v1.87 | v1.90 | Evidence and qualification |
|---|---|---|---|---|
|1|Core experience and coherence|4|4|The fight temples and fragment rewards fit the story; active implied errands still need semantic review.|
|2|The first five minutes|4|4|R3 recenter teaching now verified through the real virtual-pad path. Outside newcomer comprehension remains untested.|
|3|Exploration and wayfinding|5|5|Level-design mean 4.73; 64 prescribed and 11 corrected views, 26 maps/plans. Desert and selected later decisions remain weaker.|
|4|Rewarding exploration|4|4|Formal quest rules improve to 4.97, but Tansy’s implied letter errand has no reachable recipient.|
|5|Narrative and harmony|4|4|Specific earlier prose repairs hold; Hollin’s ending predicates and Ilen’s collection interruption remain.|
|6|Arc and pacing|4|4|All 111 live scenes and the separate continuous trailer reviewed; repeated console/chest staging and weak finale reactions remain. No audience pacing study.|
|7|Art direction|5|5|Fourteen-world stills, 112 ink rows and all 87 native pairs inspected; cohesive style with qualified local rendering and population differences.|
|8|Audio|4|4|116 numerical checks pass; all playback muted, so no fresh listening judgement.|
|9|Game feel|4|4|Default Node cases and repeated settled stops pass; small world-transition failures and optional matching defects remain.|
|10|Combat|4|4|Fresh roster, guardian, pack and temple evidence; bounded defence and staged-contact gaps remain explicit.|
|11|Accessibility and UX|4|3|Reduced-motion hazard response works, but larger text hides resources and clips the room label at 640 × 720.|
|12|Quality, performance, discovery|3|4|30/30 baseline main test runs green; 178 Mac views pass. Retroid 57 views measured, but download cost and device limits remain.|

Themes 3–8 count double; denominator 18. Both the prior and current weighted totals are 75/18 = 4.1667: **4.17/5**, or **4.2/5** at the prior report’s one-decimal precision. Theme 11 falls from 4 to 3; theme 12 rises from 3 to 4. The unchanged mean does not erase either change. Theme judgments are holistic, not averages of specialist diagnostic counts.

## Every prior investment, revisited

1. **Three outside players — not evidenced.** Agent automation and the author’s reports do not substitute. Keep this off the issue tracker under the established preference.
2. **Box quest/tool gates (#557) — fixed.** Fresh 223-step formal walk and 83 targeted checks support the repair. Implied errands outside that inventory still require semantic review.
3. **Guardian reach (#558) — repaired in the measured cases.** All five old reach cases pass 60 Hz checks; the 30 Hz warning resolves with dense body-path sampling. Do not call the sampling artefact a new game defect.
4. **Hosts, quiet beats and Plumb (#559) — named repairs hold.** Tansy’s unavailable recipient, Hollin’s ending predicates and Ilen’s apology interruption are distinct current findings.
5. **Small fixes (#563) — named prose and reduced-motion repairs hold.** The actual hazard frame settles while retaining its tell. The narrow larger-text HUD collision is a new, separate defect.
6. **Desert and far keys (#561) — partial.** The return marker exists but is weak at the roots. Footprint was played through lens acquisition; later dR/d4/dG and guardian are not claimed complete.
7. **Hearts (#560) and ending panels (#562) — split disposition.** Merged arrival budgets and five Gentle comparisons are verified. The completed cinematic review accepts the authored Home endpoints and distinct consequences, but retains weak reaction framing in four sequences: Incal, the Undertower, Whale-House and Footprint. Complete endpoints do not prove audience engagement.

## Theme findings

### 1. Core experience and coherence — 4/5

The repaired chest offers now respect the tools the traveller owns, and fight hosts explain their hazards through their occupations. These improvements support the journey’s fiction. Cross-system consistency is still weaker: current dialogue can promise an unavailable delivery or describe a tool that has since changed. See the design contribution and the formal quest report. Neither source breadth nor an automated route proves that a newcomer understands the opening.

### 2. The first five minutes — 4/5

R3 recenter teaching now appears through the real virtual-pad input path, once across two presses. The opening still has six authored stages before the first tank fill; this is a sequence count, not a measured time to enjoyment. The new-game capture shows the traveller after twelve seconds, but does not establish exact time to control. Keep the opening score steady until outside players are observed.

### 3. Exploration and wayfinding — 5/5

The level-design mean is 4.73 across twelve route worlds, supported by 64 prescribed views, eleven corrected views and 26 plans or maps. Distinct landmarks and routes remain a strength. Desert’s opening and the return decision at the roots are weaker individual criteria at 3/5. The Footprint was played through lens acquisition; later locks and its guardian remain outside the completed play evidence.

### 4. Rewarding exploration — 4/5

Recognisable landmarks give climbing and detours a purpose. The formal quest walk passes 223 steps without a marker loop, with 83 focused checks. This does not cover every promise embedded in dialogue: Tansy’s letter lacks a reachable recipient on the current route. The shop’s 206-fragment total against 288 available fragments is optional surplus, not automatically an economy defect. Do not turn every optional collectible into mandatory completion.

### 5. Narrative and harmony — 4/5

The distinct workers, interrupted tune and quieter placement of the stone’s lamp repair the named earlier concerns. Three integration problems remain worth addressing: Tansy’s unavailable payoff, Hollin’s ending lines recalling choices inaccurately, and Ilen’s fragment count interrupting her apology. These findings concern existing branches; they do not show that the current release introduced them.

### 6. Arc and pacing — 4/5

The corrected opening reaches its objective through ordinary console use and a complete landing. Temple endings depict distinct consequences: restored water, breath, machinery and light; the Lantern’s nonviolent response fits the story. All 111 live scenes have accepted desktop, phone and skip evidence, with the continuous trailer assessed separately. Live cinematic technical and interest means are 4.95/5 and 4.58/5 respectively. Repeated console framing, generic orbit lead-ins and 43 variations of a chest formula limit variety. Four finales—`finale.incal`, `finale.bazaar` (Undertower), `finale.underwater` (Whale-House) and `finale.spheres` (Footprint)—lose reaction framing to foreground geometry or weak subject emphasis. Home endpoints are accepted against complete authored timelines; excluded fixture timeouts are not pacing defects. No new human-player pacing study or ten-minute interest-curve comparison was performed: automated endpoints and pictures cannot substitute for audience response. See [cinematics](cinematics-v1.90.md).

### 7. Art direction — 5/5

Fourteen-world still sets, fourteen temple palette/reference comparisons, traveller studio views and 112 ink rows sustain the flat palette and fine ink identity. Corrected gallery/Arena skitter views preserve recognizable silhouettes and attached shadows. The ink mean is 4.69/5, with the lowest row 3.33/5; matched 640 × 360 town motion shows coarser or dashed thin contours while large forms remain readable. Confirmed cap/decal fighting at inspected Incal, Buried, Arzach and Perdide sites is a local geometry problem, not a collapse of the overall style. Original walking Shadow Room threshold failures remain reported despite a narrower stationary diagnostic.

All 87 native comparisons are inspected and retain coherent architecture and palette, with material-detail and dynamic-population differences explicitly qualified. Native 1.5-second versus web 3.5-second settling is not synchronized animation evidence and does not automatically explain every different instance. Invalid original cameras remain excluded; corrected captures supply acceptance. The holistic 5/5 does not mean every rendering criterion scores five. See [visual quality](visual-v1.90.md), [ink](ink-lines-v1.90.md), [shadows](shadow-v1.90.md) and [surface overlap](zfight-v1.90.md).

### 8. Audio — 4/5

All 116 numerical audio checks pass. Conversation voice is 3.6 dB above music and the combined fight peak is −7 dBFS. Thirteen earlier numerical excesses are resolved. Every preview remained muted, so timbre, emotional impact, comfort and device sound have not received a fresh listening judgement.

### 9. Game feel — 4/5

Repeated settled stops show zero moving-pose weight at all eight late samples and an upright side view. The old long-idle freeze was not reproduced. Default deterministic motion passes all sixteen checks, but all three steady world runs miss a strict transition metric: Desert calf jolts and 3.5–3.9 cm foot boundaries in Bazaar/Arena. Optional motion matching passes four deterministic cases and retains twelve failures; it is off by default. These are distinct operating modes. Recovered long-idle behaviour does not mean every short transition is finished.

### 10. Combat — 4/5

Fresh evidence covers all 23 ordinary foes, fourteen guardians, 48 bounded packs and twelve fight temples. All five old guardian-reach cases now pass. Gorged charge, riposte and clean-roll reserve have demonstrated mechanical effects. The stricter fresh roster mean of 4.16 is not a measured decline from the older carried score. The strongest played weakness is Kiln crowd visibility: bodies obscure the traveller and floor warning. Longer bot exposure does not, by itself, support reducing enemy damage. The defence matrix covers 194 trials and 59 attack rows, with 27 attacks still unsampled.

### 11. Accessibility and UX — 3/5, previously 4

Reduced-motion framing now settles during a real temple hazard while retaining its warning. Larger text exposes a separate defect: at 640 × 720 and 145% scale, the timer covers hearts and reserve and the room label clips at the right edge. This is a confirmed usability failure in actual play. Physical controller comfort and touch gestures remain unverified.

### 12. Quality, performance and discovery — 4/5, previously 3

All thirty main-branch test runs at or before the frozen commit passed. All 178 Mac benchmark views meet their budgets, and the separate Retroid baseline meets its handheld floors across thirteen worlds. Two device views still miss 60 fps. Payload growth, first-time loading and absent newcomer observations keep this below 5/5. A trailer, photo mode and a clear project description support discovery, but do not establish audience reach or retention.

Specialist evidence: [level design](level-design-v1.90.md), [temple design](temple-design-v1.90.md), [dialogue](dialogue-v1.90.md), [quests](quest-v1.90.md), [combat](combat-v1.90.md), [fight temples](combat-fight-temples-v1.90.md), [motion](motion-v1.90.md), [camera](camera-v1.90.md), [sound](sound-v1.90.md), [creature animation](procedural-animation-v1.90.md) and [performance](perf-v1.90.md). The visual and cinematic reports are linked above. These links require the corresponding signed-off publication files, not the earlier pending drafts.

## Confirmed next-work candidates

These are recommendations from the frozen baseline, not blanket implementation authorization. The user retained review of the broad audit recommendations; separately requested v1.92 repairs must be described in their own release ledger, not counted as fixes already present in c5449ab6c.

- **Larger-text temple HUD: about ½ day.** Reflow timer, resources and room name at narrow widths while retaining the selected text size. Verify actual temple play and reduced-motion tells.
- **Tansy’s letter: about ½ day.** Give the current-route promise a reachable outcome, preserving existing saves and keeping retired Salt Harbour retired.
- **Hollin ending predicates: 1–3 hours.** Separate refusal, kept promise without parents’ news, and delivered news. Check all three endings.
- **Kiln crowd visibility: 1–2 days of focused iteration.** The traveller and floor warning are hidden in an inspected busy wave. Evaluate body spacing and existing self-marker first; do not infer a damage nerf from bot-policy comparisons.
- **Obsolete tool/direction wording: 2–4 hours.** Correct verified semantic mismatches and state-dependent capacity claims.
- **Three novice sessions: about 1 day.** Observe Desert’s first objective/roots return, the Glass fork and Footprint after the lens. Record recognition before adding more guidance.
- **Ilen’s apology: about ½ day.** Move collection accounting to a later optional exchange without removing branch variants.
- **Download cost: scope first.** Frozen payload 189.50 MiB is up 30.5%; traveller/outfits 37.94 MiB. Explore sharing/packaging without removing accepted outfits. The later ship release already removes its unused 3.58 MiB study asset.

- **Remaining movement transitions: scope the default cases first.** Three steady world cases still miss strict foot/calf transition metrics despite 16/16 default deterministic passes. Repeat those exact transitions and short walk/stops. Keep the default-off matching repair separate; its broader scope is approximately 1–2 days.

- **Confirmed overlapping faces: targeted repair.** Address only the inspected cap/decal conflicts in Incal, Buried, Arzach and Perdide; retain the original diagnostics and compare the same views.
- **Finale reactions: focused reframing.** Improve subject emphasis in the four weak sequences: Incal, Undertower, Whale-House and Footprint before extending their duration.
- **Thin ink at low raster: bounded investigation.** Preserve the established style while evaluating the specific town-motion detail loss; do not infer a universal geometry or graphics reduction.

Do not prioritise a wholesale animation rewrite, indiscriminate graphics reductions, additional content breadth, or puzzle redesign based solely on a low obviousness heuristic. Raw creature cost 1/3 is a strict microbenchmark shortfall; the complete measured mixed-foe Mac scene is 0.347 ms and no Retroid creature-pack measurement exists.

## Evidence that remains limited

No outside playtest, audible judgement, physical gamepad comfort, verified physical touch gesture, cold-install measurement or thermal soak is claimed. Retroid baseline Unity build 2808/c544 was measured independently: all 13 world medians meet 55 fps and all view means meet 40 fps; City-Shaft wide 47.8 fps and Floating City start 57.7 fps miss 60 fps. Battery 25–30°C is not a SoC thermal soak. Xbox and Steam Deck hardware qualification are excluded by request.

The newly shipped caravan is outside this frozen audit and has separate web/native validation. Its official 2810 APK passed offline identity checks, but final Retroid acceptance is awaiting manual wake/unlock. Do not use the old 57-view measurements to qualify the new model.

## Publication and scope

The frozen audit is complete with bounded missing cells and the explicit limitations above. The visual evidence includes 226 colour and 39 depth stills, motion/probe supplements, all 87 matched native pairs and all ten final web corrections. Cinematic coverage is 111 live entries plus one separately scored continuous trailer. These denominators describe different checks and must not be combined into an invented overall visual grade. Later ship changes and authorized v1.92 repairs remain outside this baseline. Publication, link checks and companion packaging are coordinator steps; this report does not authorize implementing the recommendations.
