# Design audit reading ledger

Frozen source: c5449ab6c. Later playable-caravan work #599 is outside this audit. Localisation excluded by the author. Recommendations only. Node-only extraction, graph audits and targeted checks complete; browser capture awaiting explicit shared-resource handoff.

## Read in full

- All five assigned skills: game-audit, dialogue-review, quest-qc, level-design-qc, temple-design-qc.
- Previous v1.87 game, dialogue, quest, level-design and temple-design reports.
- CLAUDE.md, handoff agent rules, great-game framework, game brief, world principles, fun/story review, TODO.
- Voice guide, dialogue system, lore README/continuity, dialogue craft guidance, all lore character sheets, story bible, LORE.md (through final loose ends), progression system.
- Source supplementary dialogue: hosts-data.js (all hosts/trials/posts), scientist-data.js (all dynamic branches), lantern-data.js (whole reunion, aftermath and lamp sequence).
- Scientist arrival implementation and design-capture/extraction scripts.

## Partial / pending

- Worlds and temples system docs: architecture/logic/gadgets and relevant Glass Dunes/temple graph sections read; remaining per-house implementation review pending.
- Changelog since v1.87: v1.90/v1.89 read; finish v1.88. DONE relevant entries located, not full historical file.
- All extracted world scripts: pending extractor/resource handoff, then full reading. No claim of complete dialogue audit yet.
- All new measured routes, temple rules and visual captures: pending.

## Specific observations to preserve

1. Fight-host rewrite passes an initial blind-swap test: Ulric's unwanted crane loads, Greta's wasted well-greased rails, Osric's oil books and Mirek's tiles are tied to distinct work and hazards. Similar tired/neutral tones remain but alone are not evidence of interchangeable voices. Keep the voices score provisional until whole corpus reviewed.
2. Ilen's `light` node still interrupts confession with a conditional fragment-completion acknowledgement before “It was mine. My answer. I'm sorry.” This remains a possible pacing finding, not a factual inconsistency. Recommend moving the acknowledgement to a later optional exchange, retaining the confession's direct question→answer connection and preserving all branch flags. Do not delete its reward acknowledgement.
3. Ilen's `answer` node remains a deliberately long explanation: origin, her crash, conditional mother's reel, father's delayed message, her reply. Need evaluate the experiential pause before replacing it; no blanket deletion of long grief passages.
4. Scientist meeting now opens winded, not with his name; source fallback still allows unfilmed arrival if no safe approach. Browser review must choose representative normal terrain and record whether cinematic actually runs.
5. Documentation contains chronological superseded states (e.g. Glass Dunes originally a detour, old empty-hands progression). Audit current source, not obsolete paragraphs as if current bugs.
6. The Lantern's empty-handed call-and-response is thematically coherent; old concern is limited final mechanical involvement, not demand to add a fight. Any proposal should preserve hearing/answering and use a new spatial/listening choice rather than turn grief into combat.

### Continued source preparation

- Finished v1.88 changelog; entire v1.88–v1.90 range now read.
- Mooring-House implementation read through line330 (plan and full main logic); remaining architecture/guardian code pending.
- Desert story data read lines1–510 in full; continue511 onward. Found Ama's mismatched `tree` question→shared `giants` reply; recorded in dialogue and quest drafts.
- Glass Dunes people read1–95 (remaining tail pending); source-confirmed fixed Fenna label/balloon.
- Verified all ten prior dialogue findings against current named sources. New runtime/corpus scores still pending.
- Desert story data now read1–1221 complete, including all people, scenes, crowd and repayment lines. Remaining Desert supplements/temple guide still pending.
- Recordings source read1–165 and510–565; remaining166–509,566–788 pending. Extractor only walks selected exports, so dynamic mother/trace/beat branches must also be reviewed by hand.
- Recordings source now read1–788 complete, including conditional beats, older reel, both Ilen recordings, post-home window variations and all call assembly logic. No audible playback performed.
- Vael `src/story/arzach-data.js` and sky-stones `src/story/arzach2-data.js` both read in full, including side quests/scenery. Recorded Calix's orphaned “I do” as minor editorial polish; feather hand-in and lamp cardinal wording remain runtime/source follow-up candidates, not confirmed defects.
- City-Shaft incal-data.js all858lines read; initial large output truncated, missing middle recovered with explicit240–615 chunks. No unreviewed truncated section counted as read.
- Signal-lamp cardinal mismatch source-confirmed: data309 and runtime240 say north while actual tower-to-Ysolde vector is predominantly +Z (map north=-Z). Runtime angle computation is correct; recommend only displayed direction correction and verify visually.
- Garden of Spheres spheres-data.js all282lines read. No new confirmed defect; written sound descriptions reviewed, audible recognition/payoff explicitly outside silent scope.
- Lorn swamp perdide-data.js all497lines read in two complete chunks. Deep Wood part not yet read; no claim of merged-world completeness.
- Deep Wood perdide2-data.js all386lines read. Both merged Lorn story-data parts now complete; supplements/temple guide still separate pending reads.
- Buried Machine buried-data.js all433lines read in two complete chunks. Final wheel-age clarification and optional glass-country linkage considered; no new high-priority issue asserted.
- Viridel edena-data.js all559lines read in two chunks; edena.js50–120 and level scar/veil definitions checked. Vey's opened/after incorrectly refer to entering/hatch while active veil is external scar. Exact replacement recommendation recorded.
- underwater-people.js all233lines read, including main/kelp quests and post-temple replies. New arrival needs actual lift-context review; no rendering claims.
- moonfoundry-people.js all197lines read. Found surviving retired glyph arc in Bertil132–134 plus Hask buried-data201; continuity42–44 explicitly rejects old dots/arc. Recorded grouped current continuity finding and changed document-only repair conclusion to partly fixed.
- glassdunes-people.js and spacecity-people.js read in full (not just earlier Fenna excerpt). Cross-world house-introduction pattern noted for pacing, not asserted as four independent voice defects.
- bazaar-data.js all554lines read. Confirmed Wynn348 gives tower30years silence conflicting with eleven-year-old Kip's possession since outage; recommend distinguish years listening from recent silence. OldSign377 says four words for WE HEARD YOU (three). Both documented.

- Complete `src/story/ending.js` (521 lines): two incorrect Hollin choice recollections recorded; lamp order source improvement preserved. This is source reading, not a played ending.
- Quest checker with `--walk` completed: 223 steps (157 story, 43 temple, 23 boxes), three flags; markers report no loops. Full log saved in `quest-check.log`. Semantic source findings remain independent of the automated result.
- All12 level metrics/maps and all14 temple graphs/rules/solves generated successfully; full logs and JSON saved. All14 solved, zero rule flags; visual rating adjustments still pending.
- Targeted16 test files83/83 passed; no browser or audio process invoked.
- `night-train-data.js` complete197 lines read; `home-data.js` and `shop-data.js` combined read truncated, so these are NOT yet marked complete. Night Mail's four-page return and five-page letter contain physical pauses and a destination, not a demand to shorten automatically.
- All91 extractor flag occurrences inspected in consolidated flag list; context classification underway. Four “cool” flags refer literally to glass cooling, not modern slang. Exclamation marks belong to vendors, delighted children and urgent warnings; none merits automatic removal.
- Recovered full `home-data.js` read in separate untruncated output. Recovered `shop-data.js`1–285 separately;285–430 visible in preceding tail. Full shop file and complete223-line rumours data now read. Extracted figures include inactive Odo shop definition; explicitly excluded from current-route findings.
- Complete temple guide data for Belfry, Mooring-House and Footprint read. Their guards explain characteristic tools and consequences; Joss's current barred-gate description matches repaired source. Remaining11 temple guide files still pending whole read.
- All14 temple guide data files now fully read (last11 in three untruncated batches). Found remaining obsolete jets/tongs references and three fixed-capacity assertions; recorded as tool-guidance maintenance finding. Actual temple layout/logic/guardian implementation whole-read remains incomplete, separate from guide text.
- Complete316-line fellow-data read, plus relevant fellow runtime/map integration and test bypass. Unreachable Salt Harbour letter payoff recorded; main-route integration finding only. Runtime world-filter explains several raw monologue warnings.
- Complete209-line aliens-data and385-line companion implementation read. Literal alien bodily idioms (threads/foot/collective voice) are coherent; spoken cadence/audio not judged. Plumb's watches/critical split and no-flight Blade Gate path traced, awaiting visual context check.

- Continued temple implementation review: Belfry complete main layout631–940 and Ringers’ Walk, alongside previously read Inside/LOGIC/guardian; Mooring-House main layout910–1360 complete, including #561 local Chain Locker, explicit two-key shortcut, shaft window and Anchor Hold. Helper wings/guardian remaining as tracked separately. Footprint Inside16–57 and full main layout653–932 including Lodge complete, prior LOGIC/guardian excerpts retained. Engine-House Inside and LOGIC start1–180 read; remainder pending.
- Clarification: Mooring `sc` is the two-small-key shortcut (Rope Store plus Anchor Hold), distinct from the great-key perch cage. Do not conflate them in improvement attribution.
- Completed Mooring guardian365–405 and wings865–909. Rose House Inside42–78, full LOGIC141–225, guardian236–291, full main layout392–650 read. Engine-House full LOGIC and guardian through249 now read; layout pending. Aerie Inside23–84, full LOGIC112–217 and guardian219–263 read; layout pending. Warden's Well Inside27–90, LOGIC180–282 and guardian284–334 read; layout pending. Hush-House Inside25–68, LOGIC158–224, guardian237–254 read; layout pending. Lamp-House Inside27–92, LOGIC213–315 and guardian317–351 read; layout pending. Greenhouse Inside24–66, LOGIC112–230 and guardian232–269 read; layout pending. Whale-House Inside21–76, LOGIC181–279, guardian296–330 read; layout pending.

Further full reads: Garage Inside/LOGIC/FOREMAN; Casting Inside/LOGIC/LAST_FOUNDER and layout676–1073; Undertower Inside/LOGIC/FIRST_SIGN and main layout905–1186. Buried layout600–765 first half read; remainder pending. New capacity wording also occurs in live Bank feedback buried.js:736 (`bar holds three shots`), not only Fisk’s dialogue; include with variable-capacity terminology recommendation after checking exact line.


Final layout read completion: all14 main layout blocks read, including complete Buried600–925, Aerie477–795, Incal725–1035, Hush578–750, Lamp797–1020, Greenhouse832–1010, Whale565–935, Clock886–1101 and Casting676–1073. Small trailing return braces and some helper bodies were not separately reread; no claim that every helper source line was inspected. All14 recorded layouts/logic/guardian definitions were cross-checked against plans and metrics.

All64 prescribed frames and11 corrected frames inspected; invalid-camera ledger retained. Live Footprint input path completed through lens acquisition/mural, not full house or guardian; see PLAY-FOOTPRINT.md.
