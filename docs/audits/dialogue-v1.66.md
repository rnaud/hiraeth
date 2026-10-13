# Hiraeth's dialogue, the fifth review (October 2026, v1.66)

<!-- audit-scores
overall: 4.09 / 5
label: the mean of the eleven areas reviewed (localisation out of scope)
date: 2026-10-13
-->

The fifth dialogue review (issue #226), run with the `dialogue-review` skill in the same order as the last four: the
house rules (`lore/voice-guide.md`, `docs/systems/dialogue.md`, `lore/characters/`, `lore/continuity.md`), then
`craft.md`, then the [v1.57 review](dialogue-v1.57.md), whose findings are rechecked first. Read as strictly as v1.57:
an area keeps a 4 while a named pattern stays in it, and gets no 5 while anything in it still needs a pass.

**What changed in the skill since v1.57:** quest structure (one line a step, nobody sending you to somebody else,
straight to the end) and whether each answer follows from what was just said moved to the quest QC skill. This review
scores **quest clarity** only as the skill's own area (are directions plain, are the rules said right) and lists any
answer that doesn't follow for quest QC instead of scoring it.

**The corpus:** 3,890 lines across 31 worlds, 2,462 pages and 1,428 answers (v1.57: 3,859, 2,445, 1,414), plus what
the extractor does not read: the 24 hosts of the games and trials and the 16 makers' posts (`src/story/hosts-data.js`,
about 90 lines, read by hand), the Givers' watcher's five lines (`src/temples/desert.js`), Anselm's shop lines
(`THRUM_SHOP_LINES`), the ship's leave-gate line, the desert batch's teaching lines and the lore page's own words
(`src/lore-page/lore-text.js`, not dialogue, read for continuity).

**How it was read:** everything new since v1.57 whole (v1.58–v1.66: the HUD rework's lines, the desert batch with
Marrow's splinter and *Something Singing*, the Givers' watcher, every host, the Tripo Keeper's house, Anselm's shop
and renamed meeting, Ilen's splinter lines, the detours' sights in the Garden and the City Floating in Space, the
lore page); then every world's extracted script whole again, speaker by speaker, with one scene a world read aloud.
Combat barks not read (other work owns them). Localisation not reviewed (the author's request): no row, no findings.

## The scores

Each cell is v1.57's score, then this one.

| Area | Score | In one line |
|---|---|---|
| Brevity | 4.5 → 4.5 | Medians still 15–20 words a page; the hosts' pages are a breath each (a line of place, a line of rules); the 23 long hints and 26 "monologues" are the same ones as v1.57, judged the same way |
| Subtext | 4.5 → 4 | The 24 hosts open on exposition in the third person ("The salvagers ride the dunes…", "On Tooth Day the dome folk dive…"), told to someone who didn't ask; a named pattern, so a 4 |
| Distinct voices | 4 → 3.5 | The hosts are one template: line 1 a custom of the place, line 2 the rules, and in ten of them the rules line drops the voice ("Every gate in order.", "On foot, gate to gate round the garden, against the clock."); the blind swap fails across worlds |
| The traveller's voice | 4.5 → 4.5 | Six bare "Good night"s had slipped past the test (now fixed, and the test catches them); he twice said the light *struck* or *hit* his ship, against the continuity (fixed); "Play." / "Not now." to every host is the button, and reads as one |
| Choices | 4.5 → 4.5 | Unchanged in kind; Ilen now hears how many splinters you picked up (a callback of play, not of an answer); Marrow's splinter question is offered, not forced |
| Listen lines | 4.5 → 4.5 | The hosts' balloons are the best new lines in the batch ("One hundred and four stones. One fewer each spring.", "Dum, tek, tek. Dum, tek."); the old lists unchanged |
| Tone | 4 → 4 | Ilen's splinter page sits inside her confession, between "I'm sorry." and his answer: a collectible tally in the game's quietest beat; the Lantern and home still not reread aloud (v1.57's recommendation 2) |
| Mystery | 4 → 3.5 | The fragments are explained before the Lantern: Anselm ("Where it passed, it shed splinters of its song.") and Marrow ("A splinter of the light that went over") say as fact what Ilen alone should say is hers; the lore page narrates every world's night in the City-Shaft's words |
| Aliens and the translator | 4 → 4 | Unchanged: each tongue's quirk holds; no alien line added |
| Lore load | 4.5 → 3.5 | 24 new names in one batch, several nearly another's in the same world: Ysolt and Mother Ysolde, Brother Felix and Brother Calix (Vael), Ostra and Ossa (the City-Shaft), Nadir and Naji, Ilka and Ilo (the Desert), and Anselm Thrum, Anselme (the Whale-House) and Ansgar; the Desert adds seven hosts, *the Still Oasis*, *the Rose Canyon* beside *the Rose House*, *the Long Dune* |
| Quest clarity | 4.5 → 4.5 | Directions still name a place and a verb; the watcher's lines name the guard's key; one host's rule is wrong (Fitz: "A miss ends your run": a miss ends the streak) |

**Overall: 4.09, against v1.57's 4.32** (−0.23). Nothing v1.57 fixed came undone; what fell is the new writing. The
hosts (issue #248) were written as one block, fast, in one shape, and they carry the three drops: subtext, voices,
lore load. The fragments (v1.60–v1.62) moved the mystery a little earlier than the Lantern. Both are text passes, not
system work (*Recommendations*).

The best new lines:
- "One hundred and four stones. One fewer each spring." (Sister Clem, the sky steps)
- "(A tally is scratched below. The newest time is forty years old.)" (the Deep Wood's race buoy)
- "They've never fallen on anyone." (Opal, of the glass waves)
- "Lately that's every night." (Gil, of racing when the whales are quiet)
- "Its own bolt cracks its eye. The east door sinks open." (the Givers' watcher)

## What was fixed since the last review

The v1.57 findings, rechecked against the shipped strings.

| # | v1.57 finding | Now | What is left |
|---|---|---|---|
| 1 | "Name. I verb." first lines | holds | The test keeps it; Anselm's meeting now opens mid-chase ("Don't drop it!", v1.61) |
| 2 | 139 bare goodbyes | holds, six more found | "Good night, Vell." (×2) and the night mail's four "Goodnight"s slipped past the test's list; fixed here, and the test now catches "good night" |
| 3 | The traveller diagnosing guardians | holds | The Rose House's after-talk ("It was crying in the dark. Then it drank, a long time.") is his report still |
| 4 | The guides' "You went in!" | holds | |
| 5 | Eleven remembered answers | holds | All eleven read; none broken by the batch |
| 6 | A lesson said aloud early | holds | |
| 7 | Another people's night | mostly holds | New slips: Marrow's new splinter line ("the light that went over"; the desert says *passed*); the lore page (not spoken) tells every world's night as "the night the sky rang"; two near-echoes, "when the sky sang" (the market's old trader, Pim in the Deep Wood) |
| 8 | The guides' shape | left | Unchanged: quest machinery, for the temple design QC |
| 9 | Small callbacks | left | Unchanged |
| 10 | Small things | partly | Orrin Thrum's self-introduction gone with his rename to Anselm (v1.61); the fourth verse's summary page stays |

## The ten findings that matter most

### 1. The hosts: one template for 24 people (distinct voices, subtext)

`src/story/hosts-data.js` `HOSTS`. Every person host says two pages: a custom of the place in the third person, then the
rules. The first page tells the player something nobody asked about ("as you know", craft §2), and starts in the
place's history, not in what the host is doing (the voice guide: "Start a person in the middle of what they are
doing"). The second page, in ten of them, is the start card's rules read out:

> ~neutral~ On your hoverbike, through every gate to the bottom, against the clock. (Nadir, `trial-desert`)
> ~neutral~ On foot, gate to gate round the garden, against the clock. (Aurel, `trial-spheres`)
> ~neutral~ Every gate in order. Don't step off into the dark. (Pia, `trial-spacecity`)
> ~neutral~ Down through the gates, then up the column at its end to climb out. (Tibor, `trial-buried`)

Craft §3 (the blind swap) and §10 (objective lines that drop the voice). The best of them already do the right thing:
Opal's "They've never fallen on anyone.", Gil's "Lately that's every night.", Sister Clem's stones. **Rewrite**,
one shown in full (Tibor, the Buried Machine; two pages kept, tones kept, facts as `trials/data.js`):

> ~neutral~ Tooth Day. Wings on, and down the canyon for luck. My father did it every year. Once with a goat.
> ~playful~ Through every gate to the bottom, then ride the column up and out. Don't stop to look at the pipes.

and the shape for the others: start in their work (Nadir: "~playful~ Sand in your teeth yet? It's a dune line: gate to
gate, down to the basin. Most of us come back."), keep the rules in their mouth (Aurel: "~neutral~ Walk it, gate to
gate. The spheres don't hurry, but the clock does.").

### 2. Names that sound like another's in the same world (lore load)

The hosts test checks "one name, one person" (`tests/hosts.test.js`), not names that nearly match. Craft §9: "invented
names in one world that share a first letter and a length". Vael now holds **Ysolt** (the wind ladder) and **Mother
Ysolde**, **Brother Felix** and **Brother Calix**; the City-Shaft **Ostra** and **Ossa**; the Desert **Nadir** and
**Naji**, **Ilka** and **Ilo**. Across the game, the scientist renamed from Orrin in v1.61 (#229) is **Anselm**, beside
the Whale-House's door-keeper **Anselme** (and the Moon Foundry's host **Ansgar**): the rename that was made so that one
name would be one person made two. **Rewrite:** rename the hosts, whose names nothing else uses (Ysolt → Wenna, Brother
Felix → Brother Amos, Ostra → Dagny, Nadir → Faris, Ilka → Sabah, Ansgar → Rudi: suggestions; the author names
people), and rename either Anselme (one temple guide, `src/temples/underwater-data.js`) or Anselm Thrum.

### 3. The Desert's new place-names (lore load)

Seven hosts in the Desert (Yusra, Darro, Ilka, Zayd, Hamid, Tarek, Nadir) on top of its 56 speakers, and their places:
*the Still Oasis*, *the Rose Canyon*, *the Long Dune*, *the Painted Mesa*. *The Rose Canyon* sits beside *the Rose
House* and Qanat's *rose-stone* house: three roses for two places. The voice guide: "without asking players to learn
five unexplained nouns in one breath". **Rewrite:** Darro's "~playful~ Qanat's salvagers race old hoverbikes round the
red canyon under the cliffs. Three laps, two chasms." (the start card keeps its name).

### 4. Ilen's splinters, inside her confession (tone)

`src/story/lantern-data.js` `PEOPLE.ilen` node `light`:

> ~sad~ It was mine. My answer. I'm sorry.
> ~whisper~ It sheds as it sings, you know. Splinters of the song, all along the way. Nobody stops for them.

The game's quietest admission is followed, before he can answer, by a page on the collectibles ("you know" is the
as-you-know tic). Craft §7: a beat without a joke or an aside. The answers ("Your answer?") then follow the splinter
page, not "My answer" (listed for quest QC). **Rewrite:** move the three conditional pages to `brought`, where he is
asked what he brought, keeping their conditions and tones:

> (brought) ~playful~ Something of value. He told me too. Go on, then. What did you bring?
> ~whisper~ (She tilts her head toward the ship.) Something in your hold is singing. Bits of my song. (some)

### 5. The fragments explained before the Lantern (mystery)

`src/story/scientist-data.js` `meet`: "~curious~ Where it passed, it shed splinters of its song. They hide where nobody
goes." and `src/story/desert-data.js` Marrow `splinter`: "~playful~ That? A splinter of the light that went over,
singing on the sand…". The voice guide: theories belong to speakers; continuity: no one but Ilen explains the light.
Both say what the splinters are as fact, and Marrow in another people's words (the desert's night is *passed*).
**Rewrite:** Anselm "~curious~ Where it passed, I think it shed bits of itself. They sing, and they hide where nobody
goes." Marrow "~playful~ That? Something the light dropped when it passed, I'd say, singing on the sand *forty paces
from your ramp*. I don't pick up things that sing."

### 6. Fitz's rule is wrong (quest clarity)

`HOSTS.gallery`: "~playful~ Splash every target. A miss ends your run, and never the folk with parasols." A miss, or a
parasol splashed, ends the **streak** (`src/minigames/gallery.js` `scoreHit`), not the run; and "and never the folk"
has lost its verb. **Rewrite:** "~playful~ Splash every target you can. A miss breaks your streak, and so does anybody
with a parasol."

### 7. The traveller said the light struck his ship (fixed)

`src/story/edena-data.js` Mira `tell` and `mark`: "My ship has the same mark. Something struck it, on the way here.";
`THINGS.scar` `mine`: "It hit them too."; `src/story/buried-data.js` Hask `thumb`: "No. Something hit it." with Hask's
"Hit it, yes." The continuity: "the light passes the ship close and drains its power (nothing strikes it: the glyph is
scorched where it brushed by)". He knows what happened; locals may say crash. **Applied:** "The light brushed it, on
the way here.", "It brought them down too.", "No. Something brushed it." / "Brushed it, yes. Wen says it's burned on,
where the light went by." (Hask's flag and its values unchanged.)

### 8. "Good night" as a bare goodbye (fixed)

`src/temples/incal-data.js` Vell `hello` and `walks` ("Good night, Vell."), `src/story/night-train-data.js` Edda
`after`, Solange `stranger`, `chalk`, `after`. The voice guide's rule from v1.57 (end on something he would say to
that line, or a gesture); the test's list knew "goodbye", "bye", "see you", "farewell", "walk on". **Applied:** to
Vell's "I'll try something unusual and stop talking.": "(listen to the pacing)"; after "Now I see red through the
window slits.": "Keep the rim lit, Vell."; to Edda counting nights: "Count them to spring, then."; to Solange's "Sit,
if you like. Hold on.": "(sit, and hold on)"; to "A train should have one thing nobody can explain.": "Then keep it.";
her `after` (two conditional pages): "(wave, and start for the ladder)", which fits both.
`tests/dialogue-voices.test.js` now catches "good night" too.

### 9. The writer's voice, again (distinct voices)

- A third "hand's width" in the City Floating in Space: Joss's and Rosa's (kept by v1.53) and now Pia's "before the
  islands drift another hand's width" (a host, and stale once the Mooring-House is done). **Rewrite:** "~playful~
  Couriers run the oil bills bridge to bridge. Late oil, dark lamps, cross customers."
- "It leans back": Rosa's parapet (the Floating city) and Liss's lantern posts (the Mangrove Walk). Keep Rosa's.
- "When the sky sang" for the City-Shaft's "the sky rang": the market's old trader (`CROWD_TALK.square.1`) and Pim
  (`KEEPERS.1` `strange`), whose people have their own nights (every sign showed the mark; the pools went dark).

### 10. Left from v1.57, and small things

- The guides' shared node shape (v1.57 finding 8) and the small callbacks (finding 9): unchanged.
- Ten of fifteen shopkeepers' exits end on a tacked-on "Goodbye." ("Ring one for me. Goodbye.", "Keep it lit.
  Goodbye.", "Tooth nine hundred and twelve. Goodbye."): not bare, so the test passes, but one template. Drop the word.
- The lore page (`src/lore-page/lore-text.js`) narrates "the night the sky rang" for the light, the makers, Lorn, the
  Underwater City (whose people call it the night the whales went quiet), the Moon Foundry and the Floating city.
- Anselm's count reads "No of 96." for a save with none found (`tallyLines`, `cap(say(0))`): only the test fixture
  reaches it today.

## By world

Flags are the extractor's, judged, not counted as faults.

- **The Desert** (56 speakers, 342 pages, 13 flags, as v1.57). Marrow's splinter node is one line and the errand is
  his to offer, well judged; its words are finding 5. The seven hosts are finding 3. The watcher's lines are plain and
  name the key through the placeholder. The bike's outro, "Your pack calls it, and it comes.", follows the controls.
- **The City-Shaft** (253 pages, 6). Unchanged and still the best-edited; Vell's exits fixed (finding 8); Ostra is
  finding 2.
- **Vael** (arzach 115 pages, 3; arzach2 113, 2). The merge put Ysolt beside Ysolde and Felix beside Calix. Ysolt's
  whispered two lines and "…" balloon are right for the plain.
- **The Buried Machine** (135, 3). Hask's "hit" fixed; Tibor's host lines rewritten in finding 1.
- **Viridel** (155, 7). Mira's answer fixed (finding 7); Linden's "We tend the garden. Mostly it tends itself." is a
  good joke on the keepsake's maxim.
- **The Garden of Spheres** (90, 1). The four detours' sights are one silent line each, well made ("Arches with no rooms
  behind them. The wood grew in where the floors were.").
- **Lorn and Lorn II** (132, 6; 109, 4). The race buoy is the batch's best object; Pim's "when the sky sang" (finding 9).
- **The Signal Market** (187, 7). Fitz (finding 6), Vesna and Quill; the broadcast untouched.
- **The Underwater City, the Moon Foundry, the City Floating in Space** (62, 1; 58, 0; 54, 1). Anselme and Ansgar
  (finding 2); Pia's hand's width (finding 9); the Floating city's four sights are good, the sapling's "for the Balcony"
  a small story.
- **The Glass Dunes and the Clock-House** (14, 0; 19, 1). Unchanged.
- **The night mail** (49, 3). Four exits fixed (finding 8).
- **The shops and Anselm** (92, 5; 19, 2). Anselm's shop lines are short and in his voice ("Fitted. Twice would be
  greedy."); the keepers' "…. Goodbye." (finding 10).
- **The aliens, home, the recordings, Tansy** (64, 4; 78, 1; 31, 1; 104, 8). Unchanged; read whole; nothing new found.
- **The Lantern** (71, 7; over 30% sad or solemn, as it should be). Finding 4.
- **The detours** (the Mangrove, the Salt Harbour, the Forest of Antennas, the Underside, the Overnight Train, the
  Waterfall, the Eclipse, the Fallen Ring). Unchanged; Liss's "They lean back" (finding 9).

## Patterns across the game

- **Written in a block, in one shape.** The hosts are 24 people written at once for one system, and they share one
  shape the way the guides did in v1.48. The same risk will come with every system that adds people by the dozen.
- **Names by the batch.** 24 names at once, with no check against the names already in each world. The hosts test
  catches the same name; nothing catches the near one.
- **The mystery's edge.** The fragments' writing (Anselm, Marrow, the quest outro, the lore page) says what the
  splinters are; the house's rule is that only Ilen says what the light is.
- **The traveller.** His voice holds; his two slips were facts (struck, hit), not tone.
- **One-tone speakers:** none.

## Recommendations, ranked

1. **The hosts' pass** (findings 1, 6, 9's Pia): 24 people × 2 pages, in `hosts-data.js`. *Cost: an afternoon of
   lines; no system change.* Subtext 4 → 4.5, distinct voices 3.5 → 4, quest clarity holds.
2. **Rename the near names** (finding 2) and the Desert's roses (finding 3), with a test: names in one world may not
   share their first three letters. *Cost: six hosts' names, one person's, a few lines of test.* Lore load 3.5 → 4.5.
3. **The fragments' words** (findings 4, 5): Ilen's three pages moved to `brought`, Anselm's and Marrow's hedged.
   *Cost: five lines.* Tone and mystery back to 4.
4. **The small ones** (finding 9, 10): the shops' "Goodbye.", "leans back", "the sky sang", the lore page's nights.
   *Cost: a dozen lines.*
5. **v1.57's left-overs:** the guides' shape with the temple design QC; the Lantern and home read aloud for rhythm; one
   choice a world that changes a later scene. *Cost: medium; the author's call.*

## Issues filed, and what was fixed after this review

- [#280](https://github.com/rnaud/hiraeth/issues/280): recommendation 1, the hosts in their own voices.
- [#281](https://github.com/rnaud/hiraeth/issues/281): recommendation 2, the near names and the Rose Canyon.
- [#282](https://github.com/rnaud/hiraeth/issues/282): recommendations 3 and 4, the fragments' words, the lore page's
  nights and the small repeats.
- **Fixed in the same pass** (v1.66, with the [quest QC](quest-v1.66.md), which owns the answer-follows rule):
  - Ilen's three splinter pages now come before "It was mine. My answer. I'm sorry.", so "Your answer?" follows her
    answer. They stay in `light`, which keeps the confession whole and the pages' conditions unchanged (finding 4).
  - Fitz's rule is the gallery's own (finding 6).
- **Recommendation 5 stands.** It is v1.57's, and the author's call.
