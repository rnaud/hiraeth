# Hiraeth's dialogue, the sixth review (October 2026, v1.87)

<!-- audit-scores
overall: 4.18 / 5
label: the mean of the eleven areas reviewed (localisation out of scope)
date: 2026-10-19
-->

The sixth dialogue review (issue #556, the design half of the full audit), run with the `dialogue-review` skill in the
same order as the last five: the house rules (`lore/voice-guide.md`, `docs/systems/dialogue.md`, `lore/characters/`,
`lore/continuity.md`), then `craft.md`, then [the v1.66 review](dialogue-v1.66.md), whose findings are rechecked first.
There was no dialogue review at v1.85, so this one covers v1.67–v1.87. Read as strictly as v1.66: an area keeps a 4 while
a named pattern stays in it. Localisation is out of scope (the author's request): no row, no findings.

**The corpus** (`extract.mjs`, the main game only: the seven discarded side worlds left out): 2,355 pages and 1,438
answers in 23 groups (the twelve route worlds and their parts, home, the Lantern, the recordings, the shops, Anselm,
the aliens, Tansy, the night mail). Medians 15–20 words a page. Besides it, read by hand: the 36 hosts (the games', the
trials' and, new, the twelve fight temples' in `src/story/hosts-data.js`), the fight temples' cards and end lines
(`src/fight-temples/`), Plumb's lines (`src/companion.js`), Anselm's shop and notebook (`src/story/scientist-data.js`),
the ending's stone and credits (`src/story/ending.js`), the rumours (`src/story/rumours-data.js`).

**How it was read:** everything new since v1.66 whole (the hosts' pass, #280; the renames, #281; the fragments' words,
#282; the plain-speech pass, v1.79; the fight temples' story, v1.86; Plumb in the dialogue box, v1.87; Fenna, Sabri and
Teasel; Anselm's new wares and Ilen's five steps, #481), with a read-only survey of the diffs; every v1.66 finding
rechecked against the shipped strings. No line was changed.

## The scores

Each cell is v1.66's score, then this one.

| Area | Score | In one line |
|---|---|---|
| Brevity | 4.5 → 4.5 | Medians still 15–20 words; Nima's and Edda's talks cut to five pages (#479); Plumb 2–7 words; the fight temples' rules card the one long text (58 words, `src/fight-temples/index.js:26`) |
| Subtext | 4 → 4.5 | The 24 old hosts start in their own work now (#280); the fight hosts say their want outright but in things ("I want my seed back."); Fenna's knees carry her reason |
| Distinct voices | 3.5 → 3.5 | The old hosts pass the blind swap; the twelve fight hosts are a new template: eight of twelve open "I ground… / I drove… / I greased…" and close "Clear the X and I'll Y again" |
| The traveller's voice | 4.5 → 4.5 | Holds; "Something drained my ship that night." keeps the facts; no bare goodbye anywhere (`tests/dialogue-voices.test.js`) |
| Choices | 4.5 → 4.5 | No new remembered answer; Ilen's five steps and Anselm's lamp are callbacks of play, not of choices |
| Listen lines | 4.5 → 4.5 | Hollis "They blink at me now. They never did."; one twin pair, Gert's and Ulric's "Hear the grinding? / the chains? Nobody's at the gear / up there." |
| Tone | 4 → 4 | The splinter pages still sit in Ilen's confession; now Anselm's lamp walks into the parents' stone; Nima's joke tagged angry |
| Mystery | 3.5 → 4 | Anselm and Marrow hedge now ("I think", "I'd say"); but Anselm's tune is "the whole tune, as the light sang it" before Ilen gives it back |
| Aliens and the translator | 4 → 4 | Unchanged: no alien line added |
| Lore load | 3.5 → 4 | The near names renamed with a test (#281); three new near pairs it misses (Nuri/Nour, Ozren/Opal, Hollis/Hollin); "makers'" now said of people's mills |
| Quest clarity | 4.5 → 4 | Fitz's rule fixed; but Plumb's hint lines ("Look.", "This way.") now point at nothing from a dialogue box, and the fight temples name buttons in prose |

**Overall: 4.18, against v1.66's 4.09** (+0.09). The three v1.66 recommendations were all done (#280, #281, #282) and
held. What keeps the score down is the same shape as v1.66: a block of people written at once for one system, this time
the twelve fight hosts, and a new system's words (Plumb in a box, the fight temples' cards) written for another context.

The best new lines:
- "West of the camps, ink comes up through a makers' floor. Not water. I don't dig there." (Sabri, `src/temples/desert-data.js`)
- "The carts roll to a stop. Greta is already at the grease pot." (the Tooth Gallery's end, `src/fight-temples/buried.js` `quiet`)
- "A miss breaks your streak, and so does a parasol. Those are my customers." (Fitz, `HOSTS.gallery`)
- "The galleries are a long climb for these knees. I got as far as the high bridge." (Fenna, `why`)
- "Rebuilt my bike twice this week. The canyon keeps the bits it likes." (Kamal, `HOSTS.canyon`)

## What was fixed since the last review

| # | v1.66 finding | Now | What is left |
|---|---|---|---|
| 1 | The 24 hosts in one template (#280) | **fixed** | Each starts in their work; Tibor's rewrite went in word for word. The rules page still says "Every gate in order" in four (Bilal, Amos, Wil, Rudi) and "Every ring" in two (Pia, Gil) |
| 2 | Names alike in one world (#281) | **fixed, with a test** | Ysolt → Elva, Felix → Amos, Ostra → Dagny, Nadir → Bilal, Ilka → Aziza, Ansgar → Rudi, Anselme → Achille, Darro → Kamal; `tests/names.test.js`. New near pairs (finding 5) |
| 3 | The Desert's three roses | **fixed** | Kamal's "red canyon"; the Rose House and the rose-stone house are one place |
| 4 | Ilen's splinters inside her confession | **partly** | Now before "It was mine. My answer. I'm sorry.", but still in `light`, in five versions; the "none" one keeps "you know" (finding 3) |
| 5 | The fragments explained before the Lantern | **mostly** | Anselm "Bits of it that broke off, I think."; Marrow "Something the light dropped when it passed, I'd say". Anselm's line before it is still flat fact ("A fragment of the singing light."), and the quest's outro too ("A splinter of the singing light, warm in your hand.", `desert-data.js` `desert.splinter`) |
| 6 | Fitz's rule | **fixed** | |
| 7 | "Struck" / "hit" | **holds** | |
| 8 | "Good night" | **holds** | |
| 9 | The writer's voice (hand's width, the sky sang) | **mostly** | Pia's and "the sky sang" gone; Joss's and Rosa's "hand's width" both still in the Floating City |
| 10 | Small things | **mostly** | The shops' "Goodbye." gone; "No of 96" now "None yet."; the lore page names each people's night. A Qanat child and Anselm still say "the light went over" |

`lore/continuity.md` still describes the makers' glyph as "three dots over an upward-bowing arc"; the game adopted the
open-corner mark (b653f6eb4), and Ilen says "An open corner beside a shorter upright." Continuity drift, not a line.

## The ten findings that matter most

### 1. The fight hosts: one template for twelve people (distinct voices)

`src/story/hosts-data.js:81-152`, the hosts of the twelve fight temples, rewritten in v1.86 so that each says what the
floor does and what they want back: the right idea (the game audit's #483). But eight open on their old trade in the
same verb form ("I ground…", "I drove those cranes…", "I greased…", "I trimmed…", "I banked…", "I weighed…", "I kept the
seed cellars…", "I lock…") and eight close on one sentence:

> ~neutral~ … Clear it and I'll grind again. (Gert) · Clear the bays and I'll tap the crucibles again. (Marta) ·
> Clear the bays and I'll go back to my levers. (Ulric) · Clear it and I'll load the carts again. (Greta) ·
> Clear the halls and I'll trim them again. (Sabine) · Clear the sheds and I'll bank my kilns. (Ozren) ·
> Clear the decks and I'll weigh oil again. (Osric) · Clear them out and I can lock up. (Lettie)

"Nobody at the gear / at the levers" comes five times (Gert's page and balloon, Ulric's page, two blurbs). Craft §3 (the
blind swap: Ulric and Osric could trade second pages). The end lines show the way: each place's own picture ("The carts
roll to a stop. Greta is already at the grease pot."). **Rewrites** (second pages, tones kept):

> Ulric: ~tired~ A ring on the deck, a load's coming. Don't be under it. Seven loads a day, and not one ordered.
> Osric: ~neutral~ Oil spreads, you step off. Before the spark, not after. I'd like to weigh something that isn't trouble.
> Gert: ~neutral~ Ankle-deep and crawling. Rust on the floor means a stone's rolling your way. Empty it, and there's flour by spring.

### 2. Anselm's lamp at the parents' stone (tone)

`src/story/ending.js:369` (`tombLines`): "~solemn~ (Anselm carries his lamp up from the ship and sets it in the round
window. Every splinter you found glows in it.)" It sits between Ilen's "I kept it." and her words on your choices: a
collectible tally in the game's quietest beat, the v1.66 finding 4 pattern again. **Rewrite:** move it after the stone's
closing lines and drop the count: "~solemn~ (Behind you, the round window is lit. Anselm's lamp.)"

### 3. The tune makes the song whole before Ilen does (mystery)

`src/story/scientist-data.js:48`: "~happy~ The whole tune, as the light sang it. Ask me and I'll play it.", and `:137`
"…the light's song comes out of it, whole." It is on sale at 150 fragments found, when Ilen herself would only hear
"a whole handful"; the house rule is that only she says what the light is and gives the song back. **Rewrite:**
"~curious~ As much of it as I've pieced together. It stops short. Ask and I'll play it." / "~happy~ (He turns a brass key
on his box. The light's song comes out, and stops short of its end.)"

### 4. "Makers'" said of people's places (lore load)

Plumb at the first Blade Gate, "~curious~ Makers' gate. Blades mean keep out. Something got in." (`src/companion.js:62`),
and the rumours' "Ink comes up through an old makers' floor {dir}" (`src/story/rumours-data.js:211-220`). The fight
temples are Gert's mill and Ulric's depot (the bible's spring-houses, `docs/story-bible.md:624-661`); "makers'" is the
game's word for the makers' houses and courts. The tag ~curious~ also undersells a line Plumb means as a warning.
**Rewrite:** "~whisper~ Blades on a gate. Keep out. Something got in." / "~whisper~ Ink comes up through an old floor
{dir}. {Who} asks everyone who passes."

### 5. Three near names the test misses (lore load)

`tests/names.test.js` checks names within a world by first letters and edit distance; it passes **Nuri** (`HOSTS.cistern`,
the Desert) beside **Nour**, **Ozren** (the Kiln Yard) beside **Opal** (both of the Glass Dunes' kilns, the same palette and
headcloth), and **Hollis** (Viridel) beside **Hollin** (Lorn). Suggestions (the author names people): Jalil, Mirek
(another colour), Abner.

### 6. Plumb's hint lines in a dialogue box point at nothing (quest clarity)

Since v1.87 Plumb's important lines open in the dialogue box, but they were written for a drone that flies off as it
speaks: "Look.", "Over here.", "This way.", "The goal is over here." (`src/companion.js`) read as empty in a box, the last as
UI talk. Four house lines share one shape, "That plate wants a weight", "A lock wants your key", "That bridge wants
waking", "That vane wants turning". **Rewrites:** "~curious~ That plate wants a weight. I'll show you." /
"~playful~ Scenic route? {place}'s the other way." / "~curious~ That bridge is asleep. I'll show you."

### 7. Nima's joke under the wrong tone (tone)

`src/story/incal-data.js:140`, `PEOPLE.nima` `hello`, the page merged when her talk was cut (#479): "~angry~ Mind the dust. I
just did that bit. Looking up, are you? Careful. Residents look down, to check who's poorer." The joke is voiced angry.
**Rewrite:** "~playful~ Mind the dust, I just did that bit. Looking up, are you? Residents look down, to check who's poorer."

### 8. Fenna: one place with two names, one minute said four times (lore load, brevity)

She says "the old city"; the quest's label says "The pearl city's upper gallery" (`src/story/glassdunes.js`). The clock's
minute is in her balloon ("Nobody has told me its minute"), the toast, the quest's outro and her `after` page. The Glass
Dunes now has two people who set "floats" (Halden's carriers, Fenna's posts). **Rewrite:** the label "The old city's
upper gallery"; her balloon "~curious~ The old city's clock stopped too. Nobody's climbed up to read it."

### 9. The fight temples' cards (quest clarity, the key system)

`src/fight-temples/session.js:539, 541, 618` and `view.js:160`: "Foes felled 23" (in a game that sends them "back into
the floor"), "This run: 1234 (the same rooms and waves again: ?seed=1234)" (a URL parameter shown to players), "No
lock-on in here: aim with the right stick or the mouse", and the fail line's "A roll (B / ○)", a fixed string that won't
follow remapping. **Rewrites:** "Sent back into the floor: 23"; cut the seed line; "No lock-on in here: {key:aim} aims";
"A roll ({key:evade}) takes you through a blow".

### 10. Anselm's and Ilen's loose counts (quest clarity, tone)

Anselm's `hereLine` says "A little singing left in X." whenever half or less is left; his box "beeps" in one line and
"ticks" in two (`finder`, `meet`, notebook page 3); Ilen's "a few" covers up to 95 fragments, and her "none" page still
says "you know". **Rewrites:** "~neutral~ Some singing left in X." for 20–50 % (keep "A little" under 20 %); "~playful~ My
little box. It ticks faster the closer you get."; Ilen "~whisper~ It sheds as it sings. Splinters of the song, all along
the way. Nobody stops for them."

## By world (the flags are the extractor's, judged, not counted as faults)

- **The Desert** (57 speakers, 349 pages, 13 flags). Sabri's ink line is the batch's best; Nuri is finding 5; the
  splinter's outro finding 5 of v1.66.
- **The City-Shaft** (250 pages, 8). Nima's tone (finding 7); Edda's and Ossa's cuts read well.
- **Vael** (115 + 113 pages, 5). The renames read naturally (Elva, Amos); Wenna's fight-host page ends on "I want my … back".
- **Lorn** (132 + 109, 10). Teasel's "Gert's mill floods ink now" names a host the player may not have met, and the mill is
  flooded with water, the ink coming up through it.
- **Viridel, the Garden, the Buried Machine, the Moon Foundry, the Underwater City, the Floating City** (157, 91, 135,
  59, 63, 55 pages; 1–10 flags each). Unchanged but for their fight hosts; Joss and Rosa's twin "hand's width".
- **The Glass Dunes** (18 pages in the extract, plus its people in `glassdunes-people.js`): Fenna (finding 8).
- **The Signal Market and the night mail** (185, 42). Fitz fixed; Edda at five pages.
- **The Lantern** (73, over 30 % sad or solemn, as it should be). Ilen's five splinter steps (finding 10, and v1.66's 4).
- **Anselm and the shops** (21, 92). The shop lines short and his ("There. Don't read it while I'm watching."); finding 3.

## Patterns across the game

- **Written in a block, again.** The twelve fight hosts were written in one pass for one system and share a shape, as the
  24 game hosts did at v1.66. Their fix took an afternoon then; it would now.
- **Words written for one context, shown in another.** Plumb's flying hints in a dialogue box; the fight cards' buttons in
  prose. Both are new systems reusing old strings.
- **The mystery's edge moved to the shop.** The speakers hedge now; the wares (the tune, notebook page 4: "he thinks the
  light is looking for someone") are where the light is explained before Ilen.
- **The traveller** holds; **one-tone speakers:** none.

## Recommendations, ranked

1. **The fight hosts' pass** (finding 1): twelve people × two pages, their balloons and the five "nobody at the gear".
   *Cost: an afternoon of lines.* Distinct voices 3.5 → 4. #559.
2. **The quiet beats and the tune** (findings 2, 3, 10's Ilen): three lines moved or rewritten. *Cost: an hour.* Tone and
   mystery 4 → 4.5. #559.
3. **Plumb's box lines and the fight cards' words** (findings 6, 9): a dozen strings and two key placeholders. *Cost: an
   hour.* Quest clarity back to 4.5. #559.
4. **The names and small ones** (findings 4, 5, 7, 8, 10's Anselm): three renames, a tone tag, Fenna's label. In
   #563.
5. **v1.57's left-overs** (the guides' shape, one remembered choice a world): the author's call, as before.
