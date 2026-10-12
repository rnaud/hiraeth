# Hiraeth's dialogue, the fourth review (October 2026, v1.57)

<!-- audit-scores
overall: 4.32 / 5
label: the mean of the eleven areas reviewed (localisation out of scope)
date: 2026-10-12
-->

The fourth dialogue review, run with the `dialogue-review` skill (`.claude/skills/dialogue-review/`) in the same order
as the last three: the house rules (`lore/voice-guide.md`, `docs/systems/dialogue.md`, the sheets in `lore/characters/`,
`lore/continuity.md`), then `craft.md`, then the [v1.53 review](dialogue-v1.53.md), whose findings are rechecked first,
below. It was asked for in issue #202 ("We are still at 3.68 for the dialogs audit? Prioritize fixing this and getting it
above 4.0, with an aim for 4.5"): the rewrites for every area were made first, in the same branch, and this review
measures the script as it now ships. The scores are read as strictly as v1.53 read them: an area keeps a 4 while a
named pattern stays, and gets no 5 while anything in it still needs a pass.

**The corpus:** 3,859 lines across 31 worlds: 2,445 pages and 1,414 answers (on `main` before the rewrite: 3,845 lines,
2,435 pages, 1,410 answers; v1.53: 3,767). The new City Floating in Space (#194) and the Moon Foundry's explorations
(#193), which landed during the rewrite, are included.

**How it was read:** the whole extracted script, world by world and speaker by speaker, this time every world (v1.53
read five whole and sampled the rest): the Desert, the City-Shaft, Vael and Vael II, the Buried Machine, Viridel, the
Garden of Spheres, Lorn and Lorn II, the Signal Market, the Underwater City, the Moon Foundry, the City Floating in
Space, the Glass Dunes and its Clock-House, the detour worlds, the night mail, the shops, the aliens, home, the
recordings, Tansy and the Lantern. One scene a world was read aloud. The combat barks were not read (other work owns
them). The Sealed Hangar's quartermaster, Odo, is still in the data but his world was dismissed (`src/shop.js`): not
scored.

**Localisation was not reviewed** (out of scope, at the author's request): no score, no findings; the overall is the
mean of the other eleven areas, as in v1.53.

## The scores

Each cell is the v1.53 measured score, then this one.

| Area | Score | In one line |
|---|---|---|
| Brevity | 4 → 4.5 | Medians 15–20 words a page; long hints 33 → 23, the ten longest cut to a breath (Tobin's two 36-word pages, Yara's, Emrys's, the old trader's); the Lantern's and Joss's long endings stay |
| Subtext | 4 → 4.5 | The traveller reports what he saw instead of diagnosing the guardians; Sabri's "Just like us", the Speaker's "tell them about the people as well as the fuel" and Agathe's "the founders would have liked you" gone; the keepsake maxims (Nima, Mira) stay by design |
| Distinct voices | 3 → 4 | No conversation opens on its speaker's name now (it was 32 first lines, and 14 shopkeepers): each starts mid-task; the two reed-cutters and the two walkers of a world sound apart; the guides' shared shape remains |
| The traveller's voice | 3 → 4.5 | 139 bare goodbyes → 0: each exit answers the line before it or is a gesture; his reports to the guides are his ("A stone in its teeth, like your father said."); the guides' "I'll go in" / "I'm going" stay alike |
| Choices | 3 → 4.5 | Eleven answers now come back later (Marrow, the Speaker's three for Ilo, Cael, Nima, Madame Sel, Hask, Mother Ysolde, Bastien, Hedda, Rosa, Halden) beside the old ones; every world but near-silent Vael remembers something you chose; the new callbacks are one line each |
| Listen lines | 4 → 4.5 | Overheard life, changing after each world's beat; the long ones trimmed; no hand-offs, no names announced in a listen line (Rima, Basile) |
| Tone | 4 → 4 | Unchanged in kind, and the new exits keep it: a dry reply where the line invites one, a plain one after a loss ("So do I.", "They did. They arrived."); the exclamation-heavy shouts are the shouters' |
| Mystery | 4 → 4 | Evidence before belief everywhere read; the father's window holds to one night; Ume no longer names the light before her own word for it |
| Aliens and the translator | 3.5 → 4 | Each tongue keeps its one quirk: the stilt-walkers one word again (Weir's four-word line was the only break), the drifters' own name for the night (*the pulling night*), Brin's three words |
| Lore load | 4 → 4.5 | Every people names the night its own way (Hollin, Ume, Ommo and Marrow had slipped back to another's); the Hangar's traces gone; no new proper noun |
| Quest clarity | 4 → 4.5 | No quest ends on a report except the author's kept four (`tests/quest-steps.test.js`); directions name a place and a verb; the repeat hints are short |
| Localisation | not reviewed | Out of scope: not read, not scored |

**Overall: 4.32, against v1.53's 3.68** (+0.64). Above 4.0, short of the 4.5 the issue aims for; what stands between
them is in *Recommendations*. The three areas that dragged v1.53 (distinct voices, the traveller, choices, all 3) are
now 4, 4.5 and 4.5: their named causes are fixed in the shipped strings, and two of them are held by a test
(`tests/dialogue-voices.test.js`: no first line on the speaker's own name, no bare goodbye).

The best lines the rewrite gave:
- "Thirsty, in the dark, all those years. Grandmother’s one lamp a night. She knew." (Sabri, for "Thirsty and
  frightened. Just like us.")
- "A stone in its teeth, like your father said. It’s still now." (the traveller to Fisk, for "The warden was stuck.
  I stopped it.")
- "You said nothing, that night, when I asked. Forty years of other people’s words, and that was the clearest answer
  I’ve had." (Madame Sel, if you said nothing under the tower)
- "That tower and I have been studying each other for thirty years." (Ondine)

## What was fixed since the last review

The v1.53 findings, each rechecked against the shipped strings.

| # | v1.53 finding | Now | What is left |
|---|---|---|---|
| 1 | "Name. I verb." in 32 first lines | fixed | None in any conversation's first line (a test keeps it so); Teo keeps his, the desert's style. A second template the rewrite nearly made ("Forty years I’ve…" in five openers) was varied before it shipped |
| 2 | The drain reported five times in one sentence | fixed (v1.53's rewrites) | Each report his own, to each listener |
| 3 | The narrator's night creeping back | fixed | And four more slips found and fixed: Hollin ("the night the light passed" in the Deep Wood), Ume, Ommo, Marrow |
| 4 | "Goodbye, X." on every later node | fixed | 139 → 0 bare goodbyes; the extractor's two false positives ("Later…", "Leave it…") reworded too |
| 5 | Maelle's two answers that say the same | fixed (v1.53's rewrites) | |
| 6 | The father at the window, one night or many | fixed (v1.53's rewrites) | |
| 7 | "A hand's width" five times in one small city | fixed (v1.53's rewrites) | Rosa's and Joss's, as it should be; Aube's in Vael II is her own |
| 8 | Two finds from a world that is gone | fixed (v1.53's rewrites) | Odo, the Hangar's quartermaster, is dismissed with his world (not placed) |
| 9 | Thirteen steps ending by telling someone | fixed | Two left, both kept by the author (#143): Ume, and Esk's failing quest |
| 10 | Small slips in the new desert | mostly fixed | The fourth verse's summary page stays (it is the reward for reading all four) |

And v1.48's open ones: the temple guides' shape (finding 4) is half fixed: their exits, their "You went in!" (four
guides alike) and the traveller's diagnoses are each guide's own now, the node shape is not; the shops' one script
(finding 5) keeps "Show me what you have", the button that opens the shop.

## The ten findings that matter most

These are what this review found, before and after the rewrite. The first seven were fixed in this branch; the last
three are what is left.

### 1. A template one level down: "Name. I verb." (fixed)

About sixty first pages named their speaker before the panel's own name tag had finished drawing, now that the subtitle is
gone too (issue #208): "Hask. I tend *the Wick in the oculus*.", "Sedge. I cut reeds.", "Teasel. Reed-cutter.",
"Tessa. I walk this rim every day.", "Cael. I walk this road every day.", fourteen shopkeepers ("Fausta. I sell to every
level of this city…"). The blind swap failed twice in one world: Lorn's two reed-cutters, the Garden's two walkers.

> ~tired~ Mind the roots; I’ve just swept them. Usually the water rises through them and feeds the tree’s fire. (Hessa,
> `desert-data.js` `hello`)
> ~playful~ I cut them back. They take it personally. We keep the arrangement civil. (Sedge, after "Mind the reeds, they
> cut.")
> ~curious~ Toes. Most visitors think this rim is an unfinished wall, so I point them out. (Tessa)

### 2. The traveller's last word was "Goodbye" (fixed)

139 goodbye-only answers, a third of every exit: after Hask's "I might manage the walk myself next year. Might.", after
Sol's "I hope he does.", after Lark's silent laugh. Each now answers what was said, in his register (dry where it
invites it, plain after a loss), or, with Vael's near-silent people, is a gesture:

> ~happy~ I’ll walk it with you. (to Hask)
> ~solemn~ So do I. (to Sol)
> ~happy~ (laugh with her) (to Lark)

Where the page before is one of two conditional pages (the Moon Foundry's before and after the house is quiet), the
exit fits both, or there are two exits under the same conditions (Liesel, Hask, Ondine, Madame Sel).

### 3. He diagnosed the guardians (fixed)

Every makers' house ended with the traveller explaining the guardian to the person who lives beside it: "It was only
bare. It needed help to bloom.", "She only wanted it quiet.", "It only needed answering.", "It was stuck. I stopped
it." (three times). A witness reports; the meaning is theirs:

> ~solemn~ It was crying in the dark. Then it drank, a long time. (to Sabri)
> ~solemn~ She’s asleep. It’s quiet in there now. (to Teasel)
> ~solemn~ I answered it, note for note. (to Tessa)

### 4. The guides' "You went in! Is it all X, inside?" (fixed)

Four guides asked it in the same words (Fisk, Sorrel, Wim, Agathe). Each asks their own question now:

> ~surprised~ You went in. Does it smell of grease in there, or did my father exaggerate? (Fisk)
> ~surprised~ Back already? I make that eleven minutes. Or forty. Is it all clocks in there? (Wim)

### 5. Answers nobody remembered (fixed in eleven places)

Telling Marrow to stay away from his ship, telling Cael the avenue was short, saying nothing under Sel's tower: none
came back. Each now sets a flag a later page reads:

> ~playful~ Sky-person. I haven’t been near your ship. I’ve been near it at a respectful distance, which is a different
> thing. (Marrow, after "Stay away from my ship.")
> ~playful~ Still short, is it? I count your steps now, rival. You were quicker today, and you saw less. (Cael)

The Speaker hears all three of Ilo's answers (he only heard the monster before); Nima, Hask and Mother Ysolde answer
the modest or silent reply in its own words; in the newest worlds Bastien remembers "One well a day is
enough.", Hedda "I'll let it settle in first.", Rosa "I'll stay on this island for now." and Halden "I'll find out
the time myself."

### 6. A lesson said aloud by an ordinary person (fixed)

Sabri's "Thirsty and frightened. Just like us. We could have helped each other years ago." (finding 7 of v1.48, still
there), the Speaker's "tell them about the people as well as the fuel", Agathe's "I think the founders would have liked
you". Each says the thing underneath instead:

> ~solemn~ When they ask what you found here, they will mean the fuel. We did, after all, fill your ship. (the Speaker)
> ~solemn~ I’ll ring the bridge bell tonight. It has been a long time. (Agathe)

### 7. Another people's night (fixed)

The voice guide gives each people its own name for the night; four had slipped: Hollin said Qanat's "the night the light
passed" in the Deep Wood (now "the night the pools went dark"), Ume and Ommo said it in the Garden (Ume now hears the
hum before naming the Answerer; the drifters call it *the pulling night*), and Marrow said the narrator's "went over".

### 8. The guides' shape (left)

Eleven guides still share one structure: a hello with "I'll go in" / a question / an exit, an `again` with "I'm going",
an `inside` with "I'm going back", an `after` with a report and an exit. Their words are their own now; the shape is the
temples' quest machinery (`temple.<world>` starts on "I'll go in"). Rewriting it is quest work, not text: a pass with
the temple design QC, one guide at a time.

### 9. The callbacks are small (left)

Every world but Vael (whose people barely speak, which is its point) now remembers an answer, but the new ones are a
line each, and none changes what happens. Firewatch's lesson in `craft.md` §4 holds: players think a game is linear when
its choices are only remembered in passing. The next step is one choice a world that changes a later scene. *Cost:
medium; the author's call.*

### 10. Small things (left)

- The fourth verse's summary page ("Four giants, four verses: their whole road, read backward from Qanat.") is still a
  gloss, if a rewarded one.
- The extractor's 25 "monologues" are mostly conditional pages it counts together; the real ones are the Lantern's
  middle (the peak) and Joss's and Fisk's four-page endings.
- Orrin Thrum still introduces himself ("I study light: Orrin Thrum, at your service"), on his third page: the
  fragments' test wants his name said, and a stranger who appears from nowhere may give it.

## By world

Flags are the extractor's (judged, not counted as faults).

- **The Desert** (56 speakers, 341 pages, 13 flags, was 35). Still the strongest opening. Its openers keep their style
  where it earns itself (Teo, Ama's "I'm Ama" in her third sentence); Hessa, Sabri, Pell, Rook and Naji now start on
  what they are doing. The Speaker's five "Walk on, Speaker." are gone, and he hears every one of Ilo's answers.
- **The City-Shaft** (253 pages). Was already the best-edited big world; its exits now carry its voice ("Save me the
  warm half." to Perrine, "Keep to the ring, Dov."). "The night the sky rang" is at home here and nowhere else.
- **Vael and Vael II.** Lark's exits are gestures, as her speech is. Ondine and Ysolde no longer introduce themselves;
  Ysolde remembers whether you told her Ondine laughed.
- **The Buried Machine.** Hask, Dun, Ket, Tull and Fisk begin mid-task; Hask hears which answer you gave about the mark.
- **Viridel.** Sol, Oro, Vey, Esk and Rue start in their work; Esk's whole arc untouched (it is the game's best).
- **The Garden of Spheres.** Linnet, Nell, Cael, Ume and Tessa each pay attention differently again (the sheet's
  premise); Cael remembers your answer.
- **Lorn and Lorn II.** The two reed-cutters apart; Corm's four "Bye, Corm." are four replies; Hollin's four goodbyes
  are four answers to four different endings.
- **The Signal Market.** Sel, Kip, Ferro, Brush and Hobb begin on their work; Sel remembers what you said under her
  tower. The broadcast untouched.
- **The Underwater City, the Moon Foundry, the City Floating in Space.** Each exit answers its line; their guides ask
  their own questions. Bastien, Hedda and Rosa each remember a reply you gave them.
- **The Glass Dunes and the Clock-House.** Wim counts minutes even when asking how it went; Halden remembers that you
  meant to find out the time yourself.
- **The shops.** No keeper opens on their name; the Hangar's quartermaster is dismissed with his world.
- **The aliens.** Each tongue's quirk holds; nothing else changed.
- **Home, the recordings, Tansy, the Lantern.** Read whole, unchanged: nothing found that needed changing.
- **The detours.** "At home I…" opened five cameo lines; three now start on what they see.

## Patterns across the game

- **The traveller.** Curious, decent, dry when the line invites it, plain after a loss, and silent with silent people.
  He reports; he does not explain other people's guardians to them. His one repeated phrase is functional: "I'll go
  in."
- **A template avoided.** Removing names from sixty openers almost made a new one ("Forty years I’ve…" five times);
  it was varied before shipping. The next pass should watch for it.
- **One-tone speakers:** none.
- **Callbacks:** eleven new remembered answers, in eleven worlds; the people book records Ilo's (and could record more).

## Recommendations, ranked

What stands between 4.32 and 4.5:

1. **The guides' shape** (finding 8), with the temple design QC. *Cost: medium; quest machinery.* Distinct voices 4 →
   4.5.
2. **A tone pass on the Lantern and the home scenes**, read aloud with the author: the only places not reread for
   rhythm this time. *Cost: a reading.* Tone and mystery are the two areas still at 4.
3. **One choice a world that changes a later scene** (finding 9). *Cost: medium.* Choices 4.5 → 5.
4. **The process:** the extractor could flag a first line on the speaker's own name and a phrase of another world's
   night (the test covers the first; the second is by hand). *Cost: a few lines.*
