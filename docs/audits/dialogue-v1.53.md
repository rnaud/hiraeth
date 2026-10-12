# Hiraeth's dialogue, the third review (October 2026, v1.53)

<!-- audit-scores
overall: 3.68 / 5
label: the mean of the eleven areas reviewed (localisation out of scope)
date: 2026-10-12
-->

The third dialogue review, run with the `dialogue-review` skill (`.claude/skills/dialogue-review/`) in the same order
as the last two: the house rules (`lore/voice-guide.md`, `docs/systems/dialogue.md`, the sheets in `lore/characters/`,
Plumb's new one among them, `lore/continuity.md`), then `craft.md`, then the [v1.48 review](dialogue-v1.48.md), whose
findings are rechecked first, below.

**The corpus:** 3,767 lines across 30 worlds: 2,380 pages and 1,387 answers (v1.48: 3,729 lines, 2,353 pages, 1,376
answers). The extractor does not read everything new, so these were read by hand beside it: Plumb's ten lines
(`src/companion.js`), the father's thirteen window lines (`src/story/calls.js` `WINDOW`), the City-Shaft's mirror
toasts (`src/story/light-down.js`), the desert's flood cue and the makers' door (`src/story/desert-water.js`,
`desert.js`), and all 162 quest steps (`.claude/skills/quest-qc/check.mjs`).

**What is new since v1.48:**
- Plumb, the drone, with a voice sheet and ten lines;
- the Desert's giants' road (four shrines, four verses), the walking dunes' four ruins, the qanat wells, the drain's
  question (issue #158), the makers' shrine in the cave and the tree drinking at its roots (the well is gone);
- the Glass Dunes' frozen scenes (five minutes held in glass) and its mark;
- the City-Shaft's mirrors and quarters, the Buried Machine's keepers' log, Vael's bird bones and riders' shrine;
- the father's window recording, a line a world after the first homecoming (#127);
- the quest steps without hand-offs (#118, #137: the Moon Foundry's, the floating city's and the Underwater City's
  errands now end where the thing is used, and a test keeps "Ask X" out of the log);
- the renames (#141): the Rose House, Brune, Yusuf, Halden, Petra, Ines, Liesel, the Hangar's three travellers
  re-homed; the temple guides naming the night in their own world's words (#119).

**How it was read:** the Desert, the Underwater City, the Moon Foundry, the City Floating in Space, the Glass Dunes,
the aliens and the Lantern's middle whole, speaker by speaker; the other worlds through the v1.48 findings, the diff
since v1.48 and the extractor's flags, with one scene a world read aloud. The temples' rooms and the combat barks were
only sampled: other work is changing them now.

**Localisation was not reviewed** (out of scope this time, at the author's request): it has no score and no
findings, and the overall is the mean of the other eleven areas.

## The scores

Each cell is the v1.48 measured score, then this one.

| Area | Score | In one line |
|---|---|---|
| Brevity | 4 → 4 | Medians 15–20 words a page; the new writing is the tersest yet (the verses, the ruins, the frozen scenes, Plumb); 33 long hints, Joss's four-page ending |
| Subtext | 4 → 4 | The verses tell the giants' road without a gloss, the log says "Slower every tooth."; one narrator page sums the verses up, the Speaker still closes on a lesson |
| Distinct voices | 3 → 3 | The cameo template is gone; "Name. I verb." opens 32 speakers, five of the Underwater City's six; "a hand's width" in five lines of one small city |
| The traveller's voice | 3 → 3 | Reports the drain in one stiff sentence to five people ("Debris had clogged the drain."); 145 goodbye-only answers; still diagnoses the guardians |
| Choices | 3 → 3 | No new choice anywhere; the new things are looks with "(step back)"; Maelle offers two answers that mean the same and do different things |
| Listen lines | 4 → 4 | Still overheard life, still changing after the beat; one hand-off left in Ennor's |
| Tone | 4 → 4 | The new things are quiet and right (the caravan "Nobody came back for them."); the Glass Dunes 31% solemn on 13 pages, which is its point |
| Mystery | 4 → 4 | The frozen minutes, the wells and the father at the window are evidence, not explanation; his recording slips between one night and many |
| Aliens and the translator | 3 → 3.5 | Each people names the night its own way; the drifters keep their plain, uncontracted speech; nothing new written for them |
| Lore load | 3 → 4 | The renames landed and the Hangar's people are re-homed; the new desert adds a road, ruins and wells without one new proper noun; two finds still come from the Hangar |
| Quest clarity | 4 → 4 | No step sends you to a person now, and a test keeps it so; 13 steps still end by telling someone, three on main quests |
| Localisation | 3 → not reviewed (out of scope) | Out of scope: not read, not scored |

**Overall: 3.68, against v1.48's measured 3.50 and its estimated 3.67.** The v1.48 rewrites held: the night's names,
the hand-offs, the cameo introductions and the renames are fixed in the shipped strings, and the new writing since is
the best-edited batch so far: short, concrete, and leaving its meaning to the player. What drags the mean is the same
three areas as before, now with new causes:

- **a template one level down:** with the cameo introductions gone, the next one shows: nearly every quest giver opens
  on their name and their trade;
- **the traveller as a reporter:** the drain, five times in the same words, and "Goodbye, X." on almost every
  later node;
- **one world's measure in every mouth:** "a hand's width" in the City Floating in Space, and the narrator's "the
  night the singing light went over" creeping back into three people who have their own words for it.

The best new lines:
- "The camp takes its sand from everywhere else: round the mark the drifts lie untouched, the way you leave a grave, or
  a gift." (the Glass Dunes' mark)
- "*Before that, one by one they lay down along the river, and the sand drank what they spilled.*" (the third verse)
- "Past the last of the port lamps now. I keep looking up." (the father, at the window)
- "Further and further. It's back here." (Plumb)

## What was fixed since the last review

The v1.48 findings, each rechecked against the shipped strings.

| # | v1.48 finding | Now | What is left |
|---|---|---|---|
| 1 | "The night the sky rang" in every world | fixed | Only the City-Shaft says it (three speakers, nine lines). But the narrator's own phrase, "the night the singing light went over", is in Nour's, Petra's and Joss's mouths (finding 3) |
| 2 | People who send you to people | fixed | None in the conversations; the quest log's went in v1.49 (#118, #137) with a test. One listen line is left: Ennor's "Ask the pilgrims at Qanat" |
| 3 | Every cameo visitor introduces themselves the same way | fixed | No cameo opens on "Name. From X." The template one level down is finding 1 |
| 4 | The temple guides' one shape | partly fixed | They name the night in their own words (v1.49) and Anselme's "Ask her" is gone; the shape, the traveller's diagnosis and "You went in! Is it…" (four guides) stay while the temples are reworked |
| 5 | The shops' one script | as v1.48 left it | Five arrival lines rewritten then; "Show me what you have" fifteen times is the button that opens the shop, and can stay |
| 6 | Answers that don't answer | fixed | All seven hold. One new: Maelle's two answers (finding 5) |
| 7 | The lesson said aloud | mostly fixed | The "both"s, Ket's maxim, Hessa's well and the gift lines are fixed. Sabri's "Thirsty and frightened. Just like us." (a guide) and the Speaker's new "a repair that needed doing" remain |
| 8 | The Lantern's middle | as v1.48 left it | "I'll tell you what I know", her answer is what she did; still five pages and three, with one answer between, which is acceptable at the peak |
| 9 | Names too alike, people from a gone world | fixed | The seven renames shipped (#141); Lune, Ottla and Zazie re-homed. Two finds still say "the Hangar" (finding 8) |
| 10 | The same images and exits | partly fixed | The lone women and the learning-a-word image are gone. "Name. Job." openers and "Goodbye, X." exits are findings 1 and 4 |

## The ten findings that matter most

### 1. "Name. I verb." in 32 first lines

With the cameo template gone, the quest givers' own shows through. The extractor's first lines:
- the Underwater City, five of its six speakers: "Anselme. I keep the Whale-House's door.", "Bastien. I keep the lock.",
  "Brune. I grow the glow-kelp.", "Fabre. I keep the Crown's lamps.", "Maelle. I listen to the whales.";
- the Moon Foundry: "Petra. I keep the founders' ledger.", "Liesel. I mend things.", "Hedda. I pour the small moons.";
- "Halden. I carry the floats…" (the Glass Dunes), "Rosa. Every morning I chalk…", "Joss. I moor." (the floating city);
- and the older worlds: Teo, Hessa, Sabri, Rima, Pell, Naji, Hask, Ket, Sedge, Ysse, Wendel, Aube, Ysolde, Bram, Tamsy,
  Cael, Nell, Tessa, Edda, Ambrose, Sel, Sol, Basile.

The panel already shows the name; the line says it twice. The blind swap fails on the first line of every new world.
In the desert the shape is older and earns itself ("Teo. Drummer. Currently providing only the first half of the
service."), so the rewrite starts where it is thinnest, in the newest worlds: begin in the middle of what they are doing.

> ~neutral~ Your ship came down my lock like a stone down a well. A polite stone, I'll give it that. (Bastien,
> `underwater-people.js` `hello`)
> ~neutral~ (She chalks a line where the bridge meets the island.) Every morning I mark it. Every morning it's crept
> another hand's width. (Rosa)

### 2. The drain, reported five times in one sentence

The drain's new question (issue #158) is right: "Something is clogging the drain. Remove it?" But the traveller then
tells five people about it in the same clerk's words (`desert-data.js`):
- Ama `drank`: "Debris was clogging the drain."
- the Speaker `cold` and `drinking`: "Debris had clogged the water's drain." (twice)
- Hessa `full`: "Debris had clogged the drain. I cleared it."
- Ilo `tell`: "A dry pool. Debris clogs its drain. The tree's roots hang above it."

And the Speaker answers in kind: "Debris blocked the water. Then we were waiting above a repair that needed doing. I
will remember that." Nobody says "debris" aloud; the traveller is "curious, decent, able to be funny", not a report.
Each answer should be his, to that person:

> ~neutral~ Something was jammed in its drain, down there. (to Ama)
> ~neutral~ It wasn't the tree. The drain was blocked. (to the Speaker, at the Drinking)
> ~solemn~ Blocked. So we walked our circles above a repair nobody made. I will remember that. (the Speaker)

### 3. The narrator's night creeps back

v1.48 gave each people its own name for the night, and the rule went into the voice guide. Three lines written or
touched since use the narrator's phrase instead:
- Nour (`dark`): "The night the singing light went over, its fire went out…": Qanat's is *the night the light passed*;
- Petra (`temples/moonfoundry-data.js` `hello`): "The night the singing light went over, every hung moon…": the
  Foundry's is *the night the singing went over* (Hedda);
- Joss (`temples/spacecity-data.js` `hello`): "The night the singing light went over, its note ran down every cable":
  the city's is *the night the cables sang* (Rosa, Ines).

Small, but it is how the leak came back last time. **Rewrite** (Joss):
> ~sad~ The night the cables sang, the light's note ran down every one of them at once.

### 4. "Goodbye, X." on every later node

145 goodbye-only answers (v1.48 left 142). In the newest worlds nearly every `after` node ends on one, even where the
scene hands the traveller a line: Halden's three clocks agreeing ("I didn't know what to do with myself." →
"Goodbye, Halden."), Wen starting her count again from one, Bertil leaning toward his furnace for forty years, Ines's
"She isn't going mad. We both are." The exit can carry tone (`craft.md` §5): give him a reply where the line asks for
one, and leave the plain goodbyes where the talk is over.

> ~playful~ Ask a fourth. (Halden)
> ~playful~ Slowly, this time. (Wen, after "Count slowly. Moons hate being rushed.")
> ~playful~ Good company, then. (Ines)

### 5. Two answers that say the same and do different things

Maelle (`underwater-people.js` `house`), before the Whale-House's quest has begun: "I'll go." (starts it) and "I'll go
and look." (doesn't). A false binary in its purest form: the player can't tell them apart, and one of them silently
leaves the quest unstarted. Make the second one a different intention, which still reads after the quest has begun:

> ~curious~ I'll listen at its door first. (her `again` says "Listen at its door before you go in.")

### 6. The father at the window: one night, or many?

The best new writing in the game, and the recordings' rule kept: he never answers the traveller, and each line fits its
world loosely ("The roses turned to watch it go." after Viridel). But the ship introduces it as one recording, "Your
father, three years ago", the night the light came over the house (`calls.js`), and two lines speak of other nights:
- the Lorn line: "Further than last night.";
- the Glass Dunes line: "Same hour every night, a little further each time."

Keep it one night, as the rest is:
> ~whisper~ Rain on the glass, and it's still there past the rain. Further out than before.
> ~whisper~ A little further every time I look at the clock. You could set the clocks by it.

### 7. "A hand's width", five times in one small city

The City Floating in Space's measure of the drift: Rosa ("Every morning it's crept another hand's width."), Joss twice
(his hello and his balloon), Ines twice ("a hand's width a night", "Another hand's width tonight."), and the people
book. It belongs to Rosa, who chalks it, and to Joss, who measures it; Ines watches the sky. Cut hers:

> ~sad~ They hum that note night and day, and the islands drift. (Ines, `since`)
> ~sad~ Feel that? The bridge creaks. It never used to. (Ines, `again`)

### 8. Two finds from a world that is gone

The Hangar was dismissed and its people re-homed, but two finds won in the Glass Dunes still come from it
(`src/items.js`): the strong lodestone "from deep in the Hangar's floor", and the brass level "with the Major's
initials. Where down has moved, as in the Hangar's upside-down quarter…". Lore with no tie to anything the player can
reach.

> A darker lodestone dug from under the Glass Dunes' kilns; spoons follow you about.
> A brass spirit level, somebody's initials scratched on its side. Where down has moved, it shows how the floor lies.

### 9. Steps that end by telling someone

The quest log no longer sends anyone to a person (a test, `tests/quest-steps.test.js`, now keeps "Ask X" out). But 13
steps still end at one, against the standing rule that reaching the goal completes the quest:
- three main quests: "Tell Mira what you saw" (Viridel), "Tell Ume, who keeps the pole, what you heard" (the Garden),
  "The Lodestar burns again. Go down and tell Nima" (the City-Shaft);
- ten side quests: Brush, Ket, Esk (twice), Rue, Perrine, Wendel, Ivo, Cael, Ilo.

Not a line to rewrite: each needs the quest to end where the thing is done, and the person's line said as you pass (as
#137 did for the Moon Foundry). Listed here so the next quest pass takes them.

### 10. Small slips in the new desert

- **Ennor** (`content.js` desert npc 3): "Water? Ask the pilgrims at Qanat" is the last hand-off in a listen line.
- **The fourth verse's last page:** "Four giants, four verses: their whole road, read backward from Qanat." The narrator
  sums up what the player has just read; the hand pointing up the wash already says it. It is the only gloss among the
  new things, and it is said only once all four are read, so it can stay; the next pass could cut it.
- **Read aloud:** "Two notches on the stone on the elbow." trips; "Two notches, on the stone at the elbow."
- **The Speaker's exits:** "Walk on, Speaker." is still five of his answers.

> ~playful~ Water? Not from me. The pilgrims at Qanat have waited eleven days for theirs. The tree gets the first
> drink. It always has. (Ennor)

## By world

Flags are the extractor's (judged, not counted as faults).

- **The Desert** (55 speakers, 336 pages, 35 flags). Still the strongest opening, and now the richest: the giants'
  road, the ruins and the wells are each one or two terse lines that leave the story to the land ("Nobody came back for
  them."). Against it: the drain report (finding 2), Nour's night (finding 3), Ennor, "Walk on, Speaker." five times,
  "sixty years" in six lines about one chest (Nour three times, Ama, Hessa, Marrow; it is her number, and it holds).
- **Vael and Vael II** (101 and 112 pages). The great bird's bones and the riders' shrine are wordless in the right way:
  "In the niche stands a cup of water, still full." Nothing to fix.
- **The City-Shaft** (247 pages). The mirrors speak through toasts that say what happened ("Click. The beam lands on the
  next mirror down."); the quarters add no words. "The night the sky rang" is at home here.
- **The Buried Machine** (133 pages). The keepers' log is three lines and a whole history: "*Slower every tooth.*"
  Hask still opens on "Hask. I tend the Wick".
- **The Underwater City** (61 pages, 13 flags). Coralie still the best detour script; five of six speakers open on their
  name (finding 1); Maelle's twin answers (finding 5).
- **The Moon Foundry** (57 pages, 15 flags). The errands now end where they are done (#137), and read better for it. The
  three openers (finding 1), Petra's night (finding 3), Hedda's and Wen's goodbyes.
- **The City Floating in Space** (53 pages, 16 flags). Madame Sel's notes on the cables is a good scene; "a hand's width"
  (finding 7), Joss's four-page ending, Kip's "Not now.".
- **The Glass Dunes** (13 pages; 31% solemn). The frozen minutes are five lines of pure evidence, each a clock at its own
  minute, which is Halden's mystery shown, not told. Halden's opener and goodbye.
- **The aliens** (64 pages). Unchanged and holding: the stilt-walkers' one word, Ummu's capitals, the drifters' slow
  uncontracted speech.
- **Plumb** (10 lines). Exactly the sheet: two to seven words, it points before it comments, it answers its own question
  in two lines of ten. "Someone's there. Go and say hello." names nobody and sends nowhere; it can stay.
- **Home, the recordings and the window.** The window lines are the recordings' rule at its best; finding 6.
- **The Lantern** (68 pages, 54% sad or solemn). As v1.48 left it.
- **The shops, the night mail, the detours, Tansy.** Unchanged since v1.48.

## Patterns across the game

- **The traveller.** His best lines are still dry ("One well a day is enough."), but his reports are a clerk's and his
  exits are the same word. He no longer borrows other worlds' phrases.
- **The register of the new writing is the narrator's, not a person's.** The ruins, verses, frozen scenes and wells are
  all narration in parentheses or plain description, and they are good; but every new *person* since v1.48 is an old
  one rewritten. The new worlds' people book grows by looking, not by talking.
- **One-tone speakers:** none.
- **Callbacks:** the father's window grows with each world; the keepers' log changes when the Wick is lit; the wells
  change as the tree drinks. Nothing the player chooses comes back that didn't before.

## Recommendations, ranked

1. **The new worlds' openers** (finding 1). *Cost: eight first lines.* Then, if it reads better, the older worlds'.
2. **The traveller's reports and exits** (findings 2, 4). *Cost: about 15 answers.*
3. **The night's names and "a hand's width"** (findings 3, 7). *Cost: five lines, two of them a guide's.*
4. **Maelle's answers, the window's nights, the Hangar's finds** (findings 5, 6, 8). *Cost: five lines.*
5. **The report-back steps** (finding 9). *Cost: a quest pass: 13 steps, their saves (`src/save-migrate.js`).*
6. **The temple guides' shape** (v1.48's finding 4): after the temple work lands. *Cost: medium.*
7. **The process:** a check for "Name. I verb." as a first line, and for a phrase from the voice guide's list of the
   night's names said outside its world. *Cost: a few lines of the extractor.*

## After the rewrites

Asked for: the rewrites for every area scoring 3 or below (distinct voices, the traveller's voice, choices) were
applied in the same branch, after the review above was committed, with the small fixes they touch. Text only: no page,
answer, id, condition or effect added or removed; each line kept its speaker's sheet and a tone tag.

| Area | Lines | What changed |
|---|---|---|
| Distinct voices: openers (finding 1) | 8 | Bastien, Brune, Fabre, Maelle, Hedda, Liesel, Rosa and Halden start mid-task, not on their name |
| Distinct voices: the night, a hand's width (findings 3, 7) | 5 | Nour, Petra and Joss say their own world's night; Ines no longer measures the drift |
| The traveller's voice: the drain (finding 2) | 6 | Five reports in his own words to each listener; the Speaker's reply without "debris" |
| The traveller's voice and choices: exits (findings 4, 10) | 12 | Halden, Brune, Fabre, Hedda, Bertil, Wen, Rosa, Kip and Ines get a reply that follows the line before; three of the Speaker's five "Walk on, Speaker." become his own ("I'll find the fire.", "Put it in the verse.") |
| Choices: Maelle (finding 5) | 1 | "I'll listen at its door first." instead of a second "I'll go" |
| Continuity: the window, the Hangar (findings 6, 8) | 4 | The father's recording is one night; the lodestone and the brass level no longer come from the Hangar |
| Small slips (finding 10) | 2 | Ennor's hand-off; the second verse read aloud |

38 lines in 10 files: the Desert 12 (Ennor among them), the Underwater City 7, the City Floating in Space 7 (Joss's
among them), the Moon Foundry 6 (Petra's among them), the Glass Dunes 2, the father's window 2, the finds 2. The two
temple guides' lines are the only edits under `src/temples/`.

**Not applied:**
- the older worlds' "Name. I verb." openers (the desert's are its style; the rest can follow if the new ones read better);
- the report-back steps (finding 9): quest work, not text;
- the temple guides' shape, Sabri's maxim and "You went in!": the temples are being reworked;
- the fourth verse's summary page and the 130-odd remaining plain goodbyes.

**The scores, estimated.** An estimate by the same reader, not a second measured review: the next review should
measure them. Each cell is this review's measured score, then the estimate.

| Area | Estimate | Why |
|---|---|---|
| Brevity | 4 → 4 | unchanged in kind |
| Subtext | 4 → 4 | one moral softened |
| Distinct voices | 3 → 3.5 | the newest worlds no longer open alike; the older worlds' openers and the guides' shape stay |
| The traveller's voice | 3 → 3.5 | his reports are his; ten exits answer what was said |
| Choices | 3 → 3 | no new choices; one false binary gone |
| Listen lines | 4 → 4 | Ennor's hand-off gone |
| Tone | 4 → 4 | unchanged |
| Mystery | 4 → 4 | the window holds to one night |
| Aliens and the translator | 3.5 → 3.5 | unchanged |
| Lore load | 4 → 4 | the Hangar's last two traces gone |
| Quest clarity | 4 → 4 | the report-back steps remain |
| Localisation | not reviewed | out of scope |

Estimated mean of the eleven: **3.77** (measured: 3.68).
