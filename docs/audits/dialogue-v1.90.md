# Dialogue audit v1.90

<!-- audit-scores
overall: 4.14 / 5
label: the mean of eleven dialogue criteria, excluding localisation
date: 2026-10-20
-->

Recommendations only for #598, frozen at **c5449ab6c**. The lowest criterion is now **quest clarity 3.5**; the prior weakest, **distinct voices 3.5**, improves to 4 after the fight-host rewrite. Mean 4.14 versus 4.18 is a broader editorial finding, not evidence that v1.90 introduced every defect found here.

The full main-route story data, merged world parts, temple locals, hosts, companion, aliens, ending, calls, home, Night Mail, shop and rumours were read. Extraction: 2,374 spoken pages/1,438 answers/24 groups; comparable prior scope: 2,360/1,438/23 versus 2,355/1,438/23. All 91 heuristic flags have dispositions; 83 targeted tests passed. Retained inactive Odo content is excluded from findings. Read log and exact flag ledger accompany this report.

Localisation, audible performance, devices and post-snapshot #599 changes are excluded. Context-sensitive Plumb flight and final-stone timing are source-confirmed repairs but not newly interactively replayed in this report; no experience-based score uplift depends on them. Static pictures are not a dialogue playthrough. The recommendations below name current source lines and preserve existing authored choices.

**Highest-impact remaining work:** give Tansy’s letter a reachable outcome, make the ending remember the actual Hollin choices, and update obsolete tool guidance. These are integration/meaning defects, not reasons for another blanket brevity pass. Exact paths and proposed remedies appear below.

## Prior findings, lowest criterion first

| v1.87 finding | Disposition at this snapshot | Evidence / residual |
|---|---|---|
| Twelve interchangeable fight hosts; distinct voices 3.5 | Fixed in the reviewed strings | `src/story/hosts-data.js:81–152`. Ulric's unwanted loads, Greta's wasted well-greased rails, Sabine's individually trimmed wicks and Osric's oil books now anchor the rules in distinct work. Their pages do not survive a blind swap unchanged. Similar neutral/tired tags alone are not a voice defect. |
| Anselm's lamp interrupts the parents' stone | Fixed in source | `src/story/ending.js:302,382–385`: a lit window after the last conversation, with no collectible count. Check the sequence itself before claiming experiential improvement. |
| The tune is whole before Ilen gives it back | Fixed | `src/story/scientist-data.js:49,141`: both shop and playback description explicitly stop short. |
| “Makers'” conflates inhabited fight floors with makers' temples | Fixed in the named warning/rumour | `src/companion.js:64`, `src/story/rumours-data.js:213`: “Blades on a gate” and “an old floor”. The spring-house history can remain; this is clarity at the point of invitation. |
| Nuri/Nour, Ozren/Opal, Hollis/Hollin | Fixed in source; 83 focused checks passed | Omar, Mirek, Abner at `src/story/hosts-data.js:69,137,107`; additional near-name rules in `tests/names.test.js:143–201`. |
| Plumb's pointing words trapped in a dialogue box | Fixed implementation, runtime confirmation pending | `src/companion.js:95–107` separates the pointing bark; `src/host/game-host.js:282–289` only sends him out when the line has a destination. |
| Nima's joke tagged angry | Fixed | `src/story/incal-data.js:140` now playful, retaining the residents-looking-down joke. |
| Fenna's two names for one city, repetitive minute | Mostly fixed | `src/story/glassdunes-people.js:32,46`: label now “The old city's upper gallery”; balloon asks for a reading rather than repeating its minute. Quest outro and her return response still both state seven-to; some duplication provides confirmation, so do not treat every repeated fact as a fault. |
| Fight cards expose seed / fixed buttons / “Foes felled” | Fixed in named strings; rendering check pending | `src/fight-temples/session.js:551,629` says “sent back into the floor” and uses `{key:roll}`; `src/fight-temples/view.js:160` uses `{key:look}`. The seed remains developer-only. |
| Loose fragment counts, “beeps”/“ticks”, Ilen's “you know” | Mostly fixed | `src/story/scientist-data.js:37,72–80` consistently ticks and distinguishes some from a little; `src/story/lantern-data.js:163` no longer says “you know”. Ilen's count-dependent interruption remains. |

Glyph continuity is only partly fixed: `lore/continuity.md` now describes the open-corner glyph, but the whole read found current Hask/Bertil arc references below. Historical design paragraphs alone are not evidence; those live dialogue lines are.

## Selected line-level proposals (priority ranking below)

### Give Ilen's confession an uninterrupted landing

At `src/story/lantern-data.js:160–170`, the scorch prompts her to identify the singing light; a completion-dependent fragment page intervenes before “It was mine. My answer. I'm sorry.” The acknowledgement is valuable, but its placement asks the player to think about collection progress at the moment her responsibility becomes clear.

Keep the confession's three sentences and its existing answers together. Move the same five conditional acknowledgement pages to a later optional exchange after `reel`, or a return conversation, without changing the flags or rewarding only completionists. A possible connecting answer after the reunion has settled: `~curious~ The splinters I found. Can you still hear them?` The reply can retain each existing count branch. This is a branch relocation, not a request to shorten every grief passage. Cost: small writing change, moderate branch/save verification.

### Distinguish two people measuring the same slow disaster

Joss measures “a hand's width a night” (`src/temples/spacecity-data.js:20,32,93`); Rosa chalks the bridge and gives almost the same measure (`src/story/spacecity-people.js:144`). Both can witness one physical fact without sharing its sentence. Keep Joss's practical measure; let Rosa describe her work: `~neutral~ (She chalks a line where the bridge meets the island.) Yesterday's line is out over the dark now. I make another.` This preserves drifting bridges without adding lore. Cost: one page and consistency check.

### Let the unfamiliar mill be introduced before its owner's name

Teasel's balloon still says “Gert's mill floods ink now. Reeds won't grow by it.” (`src/temples/perdide-data.js:17`). A player may not know Gert, and the mill's water and ink are separate environmental facts. Suggested same-length functional replacement: `~tired~ Ink comes up through the old mill's floor. No reeds worth cutting by it now.` Preserve the reed-cutter's concern and leave Gert for the host encounter. Cost: one line; verify actual mill fiction.

## Strong passages to protect

Ilen's “Was. You said was.” makes the player's tense carry the loss. Her “Mum always said I had his hands” admits a new sibling through an ordinary family detail. Fenna's knees explain why she asks for a climb. The rewritten fight hosts explain danger without ceasing to be workers. Preserve these when addressing length flags: automated brevity warnings are prompts for reading, not deletion instructions.

### Additional whole-read finding: Ama answers a different question

`src/story/desert-data.js:266–271`: the traveller asks “Can it be lit again?” but the shared `giants` node answers “From the giants under the city, the old songs say.” That reply fits the other incoming question (“Draws it up from where?”), not this one. Keep the existing shared reply and change only the `tree` choice to `~curious~ Where does its water come from?`, since the preceding page already names water feeding the fire. No page count, state or lore changes. This is a semantic answer-follow finding a proper-noun checker can miss; it belongs in both dialogue clarity and quest rule 5. It is a small, non-blocking mismatch rather than a progression failure.

### Additional continuity finding: a recording heard becomes a visit over the house

Nour's `sister` reply (`src/story/desert-data.js:654–660`) infers “Then it sang over your house long before it sang over ours” from the traveller saying his parents heard singing when Ilen's ship went quiet. The mother's recording actually describes the last sound **from Ilen's ship** (`src/story/calls.js:526`); the separate father-at-the-window recording places singing over home three years ago (`:542–546`). Nour can speculate, but this unqualified inference blurs two clues separated by decades. Suggested reply: `~solemn~ Then your family heard that song long before we did.` Keep her next “Perhaps” line as speculation, and do not disclose Ilen's answer early. Cost: one line plus chronology review.

### Additional conversational finding: Calix receives an answer to no question

`src/story/arzach2-data.js:208–211`, Calix's `why` node ends “Every morning, just out of reach.” The traveller can answer “I do. I’ll bring it back.” No preceding sentence asks whether the traveller has an ability or intention, so “I do” reads as a remnant of an earlier version. Suggested same-branch replacement: `~happy~ I’ll bring it back.` Preserve `goto: 'bring'` and all directions. This is a minor conversational polish item, lower priority than Ama's genuinely mismatched question or Nour's chronology inference.

### Additional world reading: Vael and the sky stones

Both complete story-data files have now been read, including optional errands and scenery. Preserve Oia's abbreviated speech and physical directions, Ysolde's thirty letters and reluctant supper invitation, Ondine recognising crossed sevens, and Tiv's sensible-feet metaphor: these do distinct character work without an explanatory biography. Calix's maintenance ritual gives the bell quest a lived-in emotional stake. The cairn's failed-placement response clearly describes the correct order without punishing experiment. The early-feather convergence remains an unscored runtime hypothesis. The lamp’s contradictory cardinal wording is confirmed by the source/map coordinates below; no physical aiming defect is alleged.

### Direction finding: the signal lamp names the opposite compass direction

The lamp's correct-notch description says “north, toward the monastery” (`src/story/arzach2-data.js:309`); its successful-turn toast repeats “north” (`src/story/arzach2.js:240`). The actual lamp starts at tower `(70,-1500)` plus `(8.5,8.5)`; the answering lamp is near Ysolde `(-244,-246)` (`src/levels/arzach2.js:62,941`, `src/story/arzach2.js:96,116–118`). The destination is predominantly positive Z, while the map explicitly defines north as negative Z (`src/world-map.js:89–93`). The runtime `aim0` correctly derives the vector, so this is stale direction prose, not an aiming defect. Replace “north” with “south” in both displayed lines (or omit the cardinal and retain the carved bell/rose cliff anchor). Verify the visible map and lamp together during capture before final rating. The explanatory source comments also disagree, but only the two player-facing lines count as findings.

### City-Shaft reading

The complete 858-line `incal-data.js` has been read, including crowd state changes and Wren. Its class-specific interpretations of one glyph are productive disagreement rather than lore drift. Protect Dov's practised denial, the optional returned-token decision, Pip's counting, and Perrine acknowledging a mirror repaired before meeting her. These are particularly good examples of small consequential choices and changed return dialogue. No new blocking dialogue defect established from this whole read.

### Garden of Spheres reading

Complete `spheres-data.js` read. Linnet's listening, Nell's reflected garden, Emrys's need to climb and Cael's slow walk make a coherent quiet culture without making every resident speak identically. Cael remembers whether the traveller called the road long or short; Ume's apology treats the ship's draining as frightening rather than immediately explaining it. Protect the sound-based mystery and written descriptions. The line “He’ll want to climb something about the chord” is intentionally peculiar character comedy, not a grammar defect to flatten. Silent review can judge the textual bell/voices/drum descriptions and quest response, but cannot judge their audible recognition or musical payoff.

### Lorn swamp reading

Complete `perdide-data.js` read. Wendel and Corm disagree through how they treat living things, with Corm conceding affection only privately after the patience errand; this is useful character friction. Saba differentiates observation (“two hundred and thirteen”) from theory (“I think”), preserving uncertainty about the Answerer. Wendel's explicit limitation—“Around this particular bed, at least. Use judgment elsewhere”—prevents a poetic keepsake becoming unsafe universal gameplay advice. The repeated rain/fluid instructions occur at first explanation and return reminders, so repetition alone is not a brevity fault. Ysse's repeated concern with dust/elbows reads as a consistent keeper rather than a second Saba. Deep Wood was also read in full; its assessment follows.

### Deep Wood reading

Complete `perdide2-data.js` read, completing both Lorn story-data parts. Hollin's promise is the strongest example in this subset of dialogue creating an action beyond the quest list: returning after another completed world changes his response, and declining the promise still receives a welcome. Keep both outcomes and the later parents' news. Fen's difficult address, Bram's sitting and Pim's unreasonable round roof distinguish three versions of reluctance. The saucer's final page states a reconstruction as fact rather than inviting inference; consider its clarity against the actual discovery order during full route review, not as a confirmed continuity error. Its names, garden and scar are concrete clues that should remain visible.

### Buried Machine reading

Complete `buried-data.js` read. Teeth as birthdays are carried through Wen, Hask and Jot, then revised when the wheel keeps turning; the optional final conversation explicitly retains an annual festival rather than leaving the age system contradictory. Hask's fear belongs to him and is no longer a mandatory handoff. Protect his “same mark on a gift and a wound”, the practical soot stakes of Dun's errand, and Tull's unconfirmed warm window. These connect mechanical work to culture without resolving every mystery. No new high-priority defect established in this whole read.

### Direction finding: Vey sends the player inside after uncovering the outside scar

Vey's `opened` node (`src/story/edena-data.js:354–358`) says “Go inside and look”; her `after` calls the closing flowers those “over the hatch”. The active veil actually covers the external scorch, and the next interaction stands nine metres out from that flank (`src/story/edena.js:61–68,87–109`). Opening it normally follows reading the cabin log already. Suggested second `opened` page: `~curious~ No cutting. No tearing. They made room. *Look beneath the flowers on the flank.* Then let them close again.` Suggested `after`: `~solemn~ The flowers are closing over the scar. By spring they’ll be thicker. Leave them that much.` Preserve the prior hatch directions, which are correct earlier. This is a small but actionable reversal at the central reveal, not a request to change the physical sequence.

### Viridel reading

Complete `edena-data.js` read. Esk's failed repair distinguishes intent, consequence and later limited trust; the later cutting does not erase the lost hill. Preserve that restraint and the explicit acknowledgement that the traveller turned the gate only once. Mira, Vey and Sol apply the same garden belief with different degrees of sympathy and certainty. The ship's recorded approach and the player's own comparison of the scars make a stronger revelation than an NPC explaining the Singer. Vey's stale inside/outside instructions above are the local repair to prioritise.

### Underwater City reading

Complete `underwater-people.js` read. Bastien's lock greeting follows the revised sea-port arrival and remembers the traveller's well joke; verify it against the actual lift landing. Fabre's inability to imagine the surface and Brune's ears popping give the vertically arranged city personal scale. Maelle translates whale song cautiously rather than promising literal directions. Pipe and Whale-House progression must be checked with the new sea-floor route, while the writing itself clearly separates the city's wrong note from the distant whales. This source reading does not assess the new wildlife animation or sea rendering.

### Continuity finding: two current conversations still describe the retired glyph

The continuity document is repaired, but the complete corpus read found surviving player-facing references: Hask says the builder “pressed three fingers into soft iron and drew an arc” (`src/story/buried-data.js:201`); Bertil says he poured the glyph plate twice “to get the arc right”, and the traveller answers “It’s a good arc” (`src/story/moonfoundry-people.js:132–134`). `lore/continuity.md:42–44` explicitly distinguishes the current open corner/short upright from the retired dots-over-arc drawing. Different local names and beliefs are welcome; a craftsman's literal description and matching answer should agree with the displayed mark.

Suggested Hask page: `~solemn~ {glyph} The Maker’s Thumb. They say its builder bent a finger into soft iron and set a thumb beside it. Every gauge carries it.` This retains the local hand-making myth without three old dots or an arc. Suggested Bertil final page: `~solemn~ I didn’t ask who they were. I poured it twice to get the corner clean.` Matching answer: `~neutral~ It’s a clean corner.` No flags, page counts or identities change. Prior disposition therefore becomes **partly fixed** for glyph continuity: the document is fixed, these current dialogue lines are not.

### Moon Foundry reading

Complete `moonfoundry-people.js` read. Wen retains her counting habit as a visitor rather than becoming an unrelated guide. Hedda's unsolicited small moon provides an immediate physical mystery; Liesel and Bertil's teasing ties an optional delivery to work and affection. Preserve these, and correct only the retired literal glyph shape above. Temple keeper/ledger dialogue remains part of the separate temple corpus read.

### Glass Dunes and Floating City reading

Both complete people files read. Fenna's repair removes the old-city/pearl-city label ambiguity, and her return confirms the reading without the earlier balloon giving it away. Halden's personal work is present, though the introductory main-quest pattern—odd occurrence, follow physical clue, enter house—closely resembles Hedda, Bastien and Rosa; judge this as pacing across worlds, not four isolated voice failures. The Floating City's visitor conversations preserve Sel's listening and Kip's courier enthusiasm across locations. Retain their changing understanding of cables as antennas. Rosa's repeated hand-width measure remains the specific small differentiation opportunity already recorded.

### Continuity finding: Wynn gives the outage the message's age

Wynn says “Thirty years I’ve sat under these dishes, and the tower hasn’t said a word” (`src/story/bazaar-data.js:348`). Sel dates the silence to the singing light's passage (`:107`), and eleven-year-old Kip has held that last cylinder since that same night (`:201–225`). A thirty-year outage cannot fit that courier's history. The message travelled thirty years; the tower was not necessarily silent for that journey.

Suggested one-page replacement: `~whisper~ Thirty years I’ve listened under these dishes. Not a word since the night the sky rang. I keep them turned to the tower anyway, in case it starts again.` Preserve Wynn's decades of commitment and the recent shared catastrophe. No progression or lore addition needed. This is higher priority than the minor orphaned reply, because it contradicts the chronology of the central revelation.

### Small copy correction: the oldest sign has three words

`src/story/bazaar-data.js:377` introduces “four words: WE HEARD YOU.” Change only “four” to “three”. The glyph is explicitly above the words, so counting it as a fourth word does not follow the sentence. Cost negligible; retain the sign's wording and later Brush response.

### Signal Market reading

Complete 554-line main data, crowd and broadcast read. Sel allows silence and later remembers it; Kip's frightened avoidance explains the stalled delivery without requiring a morality lecture; the quiet ones use screens and bodily listening rather than generic enigmatic human speech. The broadcast earns its eight pages through the father's reversal of his demand, while the final narration repeats the recognition already established at its opening. Do not mechanically shorten the emotional pause; verify silent cadence in context. The specific chronology/count defects above can be corrected independently of that scene.

### High-priority state finding: the ending misremembers Hollin's promise

Two stone lines conflate choices the game deliberately distinguishes. `src/story/ending.js:242` describes a person keepsake as “Someone you promised to visit again.” Hollin gives his keepsake even when the traveller declines (`src/story/perdide2-data.js:42–45`); its own stored text correctly says “You didn’t promise.” Use that conditional keepsake text, or a truthful generic description such as “Someone who kept a place for you.”

At `src/story/ending.js:340`, Ilen says “Hollin knows where Odile and Talo went now” whenever the visit promise is kept. But `promiseDue` (`src/story/perdide2-data.js:38–39`) allows an ordinary return after another world, before the Lantern revelation; delivering the news is a separate optional conversation. Keep the visit acknowledgement and replace its second sentence with “Hollin knows he kept his word”, or gate the parents' news on its actual delivered flag. These are higher priority than conversational filler: an ending that remembers an unchosen promise or undelivered revelation weakens its otherwise meaningful choice accounting. Cost: two conditional strings and focused branch checks, no new scene.

### Extraction scope and counts

The corrected main-game extraction includes the Clock-House keeper under its retained `garage` data id, plus the Overnight Train's four listen-only bystanders. It produces **2,374 spoken pages and 1,438 answers across 24 groups**. The 23-group comparison excluding those 14 train barks is 2,360 pages / 1,438 answers, versus v1.87's 2,355 / 1,438. The expanded scope is deliberate: the train is a current reachable sub-level, not one of the seven discarded worlds. Ninety-one automated flags were individually classified: 25 monologues, 6 nodes over three answers, 21 long hints, 10 exclamation warnings, 6 long sentences, 19 long answers, 4 slang warnings. Dynamic ending, hosts, companion and rumours remain separately read supplements. The extractor does not import `*-people.js` directly, so the complete Glass Dunes people file is independently read rather than mistaken for only 18 pages of content.

### Home, Night Mail, shops and rumours

Complete Home, Night Mail, shop data (including counter lines), and rumour data now read. Lou's changed drawings and the dusted empty shelf make return visits matter without demanding total completion. Tove's “Yes. You should have” allows discomfort before welcome; retain it. Edda's four-page letter response and Solange's five-page reply include silent physical action and the train's exit direction: the length flags do not establish a pacing fault. Their reunion remains a promise rather than a performed happy ending, which fits the optional errand's scale.

The shops share a transactional template intentionally; individual material economies (Fausta's basket, Marit's cooling, Amaro's oil, Mott's teeth) distinguish their optional topic and counter language. All four flagged instances of “cool” are literal glassworking, so reject the slang classification. “Show me what you have” repeated 17 times is a predictable action label, not voice leakage. Distinguish this from two story characters sharing an evocative image. Shop extraction includes retained Odo content for the dismissed Hangar; it is not evidence of a present route NPC and is excluded from new findings.

Rumours name local work and perceptions rather than the light's explanation. Their common structure serves generated navigation; the different after-effects of the passing light remain intact. Localisation is deliberately excluded; no recommendation is made about string assembly or translation.

### High-value clarity finding: old tools and fixed tank capacity survive in guidance

Vell still promises “old jets inside” (`src/temples/incal-data.js:44`), while the actual chest grants the fan (`src/temples/incal.js:1168`). Suggested continuation: `~playful~ There is supposed to be a gust fan inside. People below could use those. Stairs are an unfair way to distribute sky.` The actual placement grants `fan` (`src/boxes/placements.js:102`), migration maps the legacy box id to `fan` (`src/save-migrate.js:297`), and the registered displayed name is “Gust fan” (`src/gadgets/fan.js:158`); this is not merely an alias misunderstanding. Petra correctly describes a magnet glove, but the traveller answers “Tongs. Got it.” (`src/temples/moonfoundry-data.js:54`); replace with `~happy~ A magnet glove. Got it.` Runtime explicitly marks the tongs box id as legacy (`src/temples/moonfoundry.js:1197`).

Ferro (`src/story/bazaar-data.js:241`), Wim (`src/temples/garage-data.js:60`) and Fisk (`src/temples/buried-data.js:56`) all assert the player's tank holds three shots. The capacity is variable: `src/resources.js:140–144` adds purchased expansions and item upgrades; `src/items.js:108–111` explicitly advertises four shots. Preserve the useful mechanics, omit the false inventory assumption. Ferro: “One shot a bulb. Light all three before the first fades.” Wim: “Six targets before they reset. You’ll want to strike more than one at a time.” Fisk: “Four targets. Hit two at once: the makers kept ink bombs in there for stubborn engines.” This is a single maintenance pass across tool-specific hints, higher priority than Calix's filler or the three/four-word typo.

Sabri's incidental balloon still calls the fight floor a “makers’ floor” (`src/temples/desert-data.js:18`). Thus the earlier named Plumb/rumour fixes are real, but the vocabulary pass is **partly fixed overall**. Change this occurrence to “an old floor”; keep her well-digger's distinction between ink and water.

### Highest-priority reachable-content finding: Tansy's final errand points off the playable map

`src/story/fellow-data.js:267–273`, node `m4.letter`: “Will you take this to my aunt? Hesper, at the Salt Harbour”, with “I’ll take it to her” and an actual `saltletter` grant. Salt Harbour is deliberately discarded (`src/levels/names.js:48,58`), and the ordinary ship uses the filtered empty side-world list (`src/ship/ship.js:388`). The main-route four-meeting arc therefore promises an action the ordinary map cannot finish. The home branch's meal invitation (`:281`) is less actionable but also points toward an unavailable epilogue. Existing tests call `CONTENT.saltharbour` directly (`tests/fellow.test.js:188–193`), bypassing the map and masking this integration gap.

Do **not** restore or audit the discarded world as a remedy. Keep the choice and Tansy's uncertain onward journey; route the letter through an existing reachable postal service, or let her hand it to a postal hulk herself and give the player a copy. Minimal prose candidate if self-mailing is chosen: `~solemn~ I found a postal hulk for Hesper's letter. It says where I went, and that I'm well. And the bit about the bird.` Replace the delivery promise with a response about keeping in touch; change item/outcome flags coherently and validate a normal map journey. This is a medium implementation/writing task, more valuable than further line trimming. Classify as **not fixed**, not a newly introduced v1.90 regression without history proof.

Tansy's apparent six-to-eight-page monologues also overcount `world`/`notWorld` alternatives: the runtime filters these before showing them. Do not report all 25 raw monologue flags as 25 player interruptions. Her remembered advice, refusal and deferred signature are strong; preserve them while repairing the unreachable payoff.

Salt-letter path verification: repository-wide `src` search for `saltletter`, `fellow.letter.given` and `HESPER_AFTER` finds only the grant, Hesper’s consume/flag action, its people-book acknowledgement and Salt Harbour’s import/spread. No postal alternate exists in the frozen source. Search output preserved as `tansy-path-search.txt`. The four-meeting current route is active; only its final recipient is retired.

### Alien and companion reading

All alien lines and companion source read. Stilt-walkers' terse words remain supported by stage directions; shellbacks' slow bodily humour differs from drifters' long perspective and the murmurs' collective speech. A literal reference to feet or threads is more convincing than a phonetic accent and should be protected. The Mimmis' “tower never talked” sits beside Wynn's thirty-year assertion and Sel's recent silence; include it in the same Signal Market chronology review rather than inventing another isolated style issue.

Plumb's house hints are short and functional. The fixed pointing bark is visible in the data contract, while the Blade Gate warning has no destination. The cue/talk flight was not interactively replayed in this pass; source reading alone cannot judge whether its timing feels distracting.

## Ten recommendations, highest impact first

| Rank | Recommendation | Why before lower-ranked work | Estimated scope |
|---|---|---|---|
|1|Give Tansy's letter a reachable recipient/outcome|An active route choice promises an unavailable action|Medium: one outcome/handoff and normal-route test|
|2|Make the stone remember the actual Hollin choices|The ending currently claims an unmade promise or undelivered news|Small: conditional lines and branch tests|
|3|Refresh tool names and variable-capacity hints|Players are sent looking for retired equipment or told their upgrade does not exist|Small: five guidance locations, inventory variants|
|4|Resolve Signal Market's contradictory tower history|Recent outage and child courier conflict with 30 years/never-spoke claims|Small writing pass across Sel/Kip/Wynn/Mimmis|
|5|Point Vey's uncovered-scar instruction outside|The central revelation's hint sends players back inside|Small: two lines, reveal-route check|
|6|Correct the signal lamp's opposite compass word|Displayed instruction contradicts actual map direction|Small: two strings and map comparison|
|7|Complete the live glyph-shape vocabulary pass|Literal craft descriptions still name the retired glyph|Small: Hask/Bertil plus contextual search|
|8|Let Ilen's confession finish before fragment accounting|Collection acknowledgement interrupts responsibility and apology|Moderate: relocate existing branches, save variants|
|9|Make Ama's shared reply answer the chosen question|An optional question currently receives an unrelated origin answer|Small: one answer label|
|10|Keep Nour's inference consistent with the recordings|The line conflates ship transmission and singing over home|Small: one sentence, chronology recheck|

Rosa/Joss's shared measure, Calix's orphan “I do”, Teasel's unfamiliar mill-owner name, and the three/four-word sign typo are lower-priority polish; retain them as appendix candidates rather than crowding out reachable-state defects. Sabri's remaining “makers’ floor” belongs in the tool/vocabulary maintenance pass.

Full automated flag dispositions are in `dialogue-flag-dispositions.md`: 91 occurrences individually listed, including literal-cooling slang false positives and world-filtered monologue overcounts. Eighty-three targeted checks passed; none tests the normal-map availability of Tansy's final recipient or Hollin's ending claims, so those passing checks do not contradict the recommendations.

## Editorial scores

These eleven areas exclude localisation, matching the prior report. Mean **4.14/5**, versus 4.18. This measures the written dialogue and branch contracts; silent visual review does not judge vocal performance.

| Area | Score | In one line |
|---|---|---|
| Brevity | 4.5 → 4.5 | Short pages remain; no long-page flags; world-filtered Tansy alternatives explain apparent long runs. |
| Subtext | 4.5 → 4.5 | Hollin's welcome, Tove's guarded forgiveness and Tansy's letters retain concrete emotional action. |
| Distinct voices | 3.5 → 4 | Fight hosts' occupational rewrite fixes the prior lowest criterion; remaining shared imagery is local. |
| The traveller's voice | 4.5 → 4.5 | Curious, sometimes resistant, able to be funny; no need for a general rewrite. |
| Choices | 4.5 → 4 | Meaningful branches persist, but the ending misremembers Hollin and Tansy's delivery cannot resolve through the normal map. |
| Listen lines | 4.5 → 4.5 | Short bodily/local observations; extra words usually carry usable landmarks. |
| Tone | 4 → 4 | Grief beats remain restrained; Ilen's collection interruption still weakens confession pacing. |
| Mystery | 4 → 4 | Tune fix protects the reveal; chronology/glyph inconsistencies still deserve correction. |
| Aliens and the translator | 4 → 4 | Bodily/world-specific quirks coherent; no audible performance judgement. |
| Lore load | 4 → 4 | Most names attached to work/places; stale literal glyph details remain. |
| Quest clarity | 4 → 3.5 | Several confirmed mismatched directions, obsolete tools, variable-capacity assertions and unreachable implied errand. |

## Extraction by group

Counts are extraction scope, not all reachable branches shown to one player. The independently read dynamic supplements and `*-people` sources supplement this table. The 14 Night Mail bystander pages expand the comparable prior 23 groups to 24; inactive Odo shop content is retained by extraction but excluded from recommendations.

| Group | Spoken pages | Answers | Median page words | Raw flags |
|---|---|---|---|---|
| aliens | 64 | 0 | 17 | 4 |
| arzach | 115 | 67 | 16 | 3 |
| arzach2 | 114 | 83 | 20 | 2 |
| bazaar | 185 | 87 | 16 | 8 |
| buried | 136 | 97 | 18 | 3 |
| desert | 349 | 214 | 18 | 13 |
| edena | 158 | 119 | 18 | 10 |
| fellow | 104 | 23 | 19 | 8 |
| home | 78 | 14 | 15 | 1 |
| incal | 250 | 133 | 17 | 7 |
| lantern | 73 | 32 | 16 | 7 |
| night-train | 42 | 22 | 16 | 2 |
| perdide | 133 | 126 | 16 | 6 |
| perdide2 | 110 | 91 | 17 | 4 |
| scientist | 21 | 14 | 17 | 2 |
| shop | 92 | 94 | 18 | 5 |
| spheres | 91 | 64 | 17 | 1 |
| garage | 19 | 16 | 16 | 1 |
| moonfoundry | 59 | 43 | 18 | 0 |
| spacecity | 55 | 42 | 20 | 1 |
| underwater | 63 | 48 | 20 | 1 |
| recordings | 31 | 0 | 14 | 1 |
| glassdunes | 18 | 9 | 20 | 0 |
| overnighttrain | 14 | 0 | 19 | 1 |

## Preserved audit evidence

Evidence was collected on 2026-10-20 at frozen commit `c5449ab6c`; this final report was consolidated on 2026-10-21 without rerunning the audit. [Evidence inventory and limitations](design-v1.90/README.md) preserve the raw measurements, classified flags, source reading and bounded live-path record. [Prioritized design recommendations](design-v1.90/recommendations.md) separate quality criteria from lock-level obviousness heuristics. Later ship changes and any separately collected device results are outside this report’s scores.
