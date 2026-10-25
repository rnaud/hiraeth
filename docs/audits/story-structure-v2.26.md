# Story structure audit v2.26: Save the Cat, adapted (2026-10-25)

<!-- audit-scores
overall: 4.0 / 5
label: the mean of 29 rows: the logline, the genre, the fifteen beats and twelve rules of thumb
date: 2026-10-25
-->

The first story-structure report (issue #632), written with the dialogue review's new section on Blake Snyder's
*Save the Cat!* (`.claude/skills/dialogue-review/craft.md` §13, run as `SKILL.md` §5). It scores the whole game's story
against the fifteen-beat sheet and the book's rules of thumb, read for an exploration game: the beats that must come in
order are scored on the **spine** (the prologue, the desert, the first homecoming after six worlds, the Signal
Market's broadcast, the Lantern, the stone); every route world is also read as a small beat sheet of its own.

**Corpus.** `extract.mjs` on main at v2.26 (`cb97e3eae`): 31 groups, 3,922 lines, 2,478 pages, 1,444 answers.
Read whole: the prologue (`src/story/charge.js`, `src/story/signature.js`), the desert's main path (Ama, Nour, the
crowd), the recordings and the window log (`src/story/calls.js`), Tansy (`src/story/fellow-data.js`), the Glass Dunes,
the first homecoming and the stone (`src/story/ending.js`), Home (`src/story/home-data.js`), the Lantern
(`src/story/lantern-data.js`). Sampled: the first talk of every route world. Measured: every main quest's steps
(`.claude/skills/quest-qc/check.mjs --all`) and, per world, the speakers whose talk changes after the beat. Nothing
was played: this is a reading, and the scores are an editor's judgement with the evidence beside each.

**In one paragraph.** The spine is very good: the opening and final images mirror each other (a son alone with a
disappointed voice; the oldest recording saying they were proud already), the catalyst is one clear event, the
midpoint (the stone, Lou, the light over the hill, "once more") raises the stakes and starts a clock, and the finale
turns the theme into the last verb (he answers the light with his own breath, empty-handed). The weak stretch is
**Bad Guys Close In**: worlds seven to eleven repeat the first catalyst ("the night the light passed, X broke") instead
of pressing harder, and the first of them is the thinnest world on the route. The second weakness is the **B story on
the main path**: Lou's cards and Tansy carry the theme but are invisible or optional before the midpoint.

## The logline and the genre

> **Logline:** a son who left everything half done is sent out to bring back something of value, and follows a
> singing light across twelve worlds to learn that what his parents wanted back was him.

| Item | Score | Evidence |
|---|---|---|
| Logline | 4 | One sentence with hero, flaw, goal, irony and stakes fits the built game (`docs/game-brief.md` premise; the father's "You leave everything half done", `src/story/charge.js:84`; the broadcast's "Come with empty hands", `src/story/bazaar-data.js:468`). Not 5: it is written nowhere in the docs, so nothing tests new work against it. |
| Genre: Golden Fleece with a Rites of Passage inside | 4 | The road (twelve stations, each with its own lesson word on the reel), the prize re-read at the end ("It isn't what you asked for. It's what I have.", `src/story/ending.js:394`), grief learned late. The team is the thin part: Plumb by design never changes, Tansy is four optional meetings, Lou is off screen until the midpoint. |

## The fifteen beats

| Beat | Where it lives | Spine or optional | Score | Evidence |
|---|---|---|---|---|
| Opening Image | the prologue: a dark cockpit, a recorded father, a song passing | spine | 5 | "We haven't heard from you for so long… Until then, don't come home." (`charge.js:82–86`), and he pauses his father to listen to something else: the flaw and the call in one picture. |
| Theme Stated | minor speakers' answers to "something of value"; the empty tank | spine (desert) and every world | 4 | Early and unheard, by people who aren't the hero: the banner bearer's "The important bit is apparently the carrying" (`desert-data.js:1153`), the makers' first gift an empty tank (Nour, Ama), then each world's own answer (Lorn "listen before you decide what it's worth", `perdide-data.js:438`; Viridel "You may have to be happy with what it becomes", `edena-data.js:152`; the Buried Machine "Here we value things that last", `buried-data.js:109`). Not 5: seven of the route's places offer no answer of their own (Vael, Vael II, Lorn II, the Underwater City, the Glass Dunes, the Moon Foundry, the City Floating in Space). |
| Set-Up | the charge, "half done", the reel | spine | 4 | The flaw is planted and paid off at home (the half-built small house Tove finished; "Finish something", `calls.js:174`). Lou, the biggest thing he left half done, is unplanted on purpose (the reel never names her), so the midpoint reveal lands but the set-up has a deliberate gap. |
| Catalyst | the light drains the ship | spine | 5 | One event, shown, in the first minute; continuity forbids any line saying it struck him (`tests/signature.test.js`). |
| Debate | the desert: can the ship fly? | spine | 3 | The inner debate is one line long and answered at once ("Then track it. When we can fly, we follow it.", `signature.js:78`), which is right for the house (his choice). The outer debate is mechanical and long: 19 main steps before the first takeoff, against 3–8 in every other world. |
| Break into Two | the first takeoff, a world picked on the map | spine | 4 | His choice, made with the player's hand; Plumb credits it ("You asked me to follow the singing light", `signature.js:81`). Not 5: the takeoff follows Qanat's gift rather than a decision scene of his own. |
| B Story | the reel, Tansy, Lou's drawings of his cards | reel spine, Tansy optional, Lou hidden | 3 | The reel is an excellent B story (one recording a world, ageing as it plays). But Lou's cards, which she drew one by one (`home-data.js`, "One drawing for every card"), are never written on screen, and Tansy is met only in the first four of her stops. |
| Fun and Games | worlds two to six | stations | 5 | Each world delivers a new toy and a new people (wings in Vael, the jaw-bed's patience in Lorn, the garden, the city under glass, the jets in the City-Shaft). |
| Midpoint | the first homecoming after six worlds | spine | 5 | False victory (home, everything on the stone) and the stakes raised (the light comes over the hill: "Not home yet. Not all the way.", `ending.js:307`), with a clock: "Once more. Then I'm staying." (`ending.js:325`). |
| Bad Guys Close In | worlds seven to eleven | stations | 2 | No rising pressure: the window log grows by a line a world (`calls.js` `WINDOW`), the light brightens in the sky, but the worlds' catalysts repeat the first one rather than raise it (see "The worlds as small beat sheets"). The Glass Dunes, first after the midpoint, has 18 pages in all. The flaw is tested only in Tansy's fourth meeting ("home or on past the last chart"). |
| All Is Lost | the broadcast and "For when he asks" | spine to the true ending | 4 | A felt whiff of death: the sister who never came home, the father's same words said twice (`calls.js:417`, 519–531). On the only path to the Lantern. Not 5: the parents' death, the bigger loss, was spent at the midpoint, so this low point is a second, smaller one. |
| Dark Night of the Soul | "Not here. Not yet." | spine to the true ending | 3 | The right beat and the right words (`calls.js:404`), but two lines and a held recording; the player can play it at the next console a minute later. |
| Break into Three | the light's trace past the Market | spine | 4 | A and B meet: the light, Ilen and the father's message turn out to be one thing. The trace is told by Plumb rather than chosen, but the choice to go is the player's. |
| Finale | the Lantern | spine | 5 | The lesson becomes the method: no tool, no fight, he whistles back to the light by three lamps (`docs/story-bible.md`, "The last stretch"), then Ilen comes out: "You answered it." |
| Final Image | the stone, the oldest recording | spine | 5 | The mirror of the opening: the parents young, "We are proud of you already", and Lou's "Was that you? The little one, waving?" |

Beats mean: **4.07**.

## The rules of thumb

| Rule | Score | Evidence |
|---|---|---|
| Save the cat | 4 | The main quest is itself the save-the-cat: he relights Qanat's tree before his ship is seen to, and the city repays him (`src/story/desert-repay.js`). Ama's empty jar for the pilgrims and Oum, lost in the western dunes, are kind errands in the first minutes. His first answers, though, are self-interest ("My ship has no power. I need to find some." to Ama and Nour). One line credited him with a kindness he never did: Nour's "and asked for nothing", after he had asked her for power: **rewritten in this pass** (below). |
| Pope in the pool | 4 | Lore usually rides on a joke or a job: Ama keeps fainting pilgrims upright during the Speaker's verses, age in the Buried Machine is a string of the wheel's slivers (Hask wears his as a belt), Tam mimes the needle spire and falls off it on purpose. Bare lore pages remain in the template openings of the later worlds (the three-page "I do X / that's the house / the night the light passed"). |
| Double mumbo jumbo | 4 | One magic, the makers: giants, boxes, backpack, temples and the singing light all trace to them, the Lantern ties the light to them, and the fragments are the light's own splinters (Ilen: "Bits of my song"). The one second force is the dark, the ink that seeps up into foes (`docs/story-bible.md`, "The spring-houses"): the makers only kept it out, and the main story never meets it, so on the route it reads as a separate magic. The chime-pirates are mundane. |
| Laying pipe | 3 | 19 main steps in the desert before the first takeoff (box, Nour, the skull, the drain, the tank, the door, the valve, the stair, the tree, the bike race, the Rose House's blade, guard, push gun and spark-stone, the ship); every other world's main quest is 3–8. Much of it is tutorial pipe (each verb taught), but the Rose House's three weapon steps sit between the story's question (will the tree burn?) and its answer. |
| The black vet | 3 | The singing light carries many jobs: it drains the ship, marks the route by its signature, marks the givers on the map (`signature.js` `GIVERS_LINE`), sheds fragments, sings over the round house, and is Ilen's answer. Each is felt, but the givers' marks and the fragments are mechanics wearing the light's coat. |
| Watch out for that glacier | 4 | Each world's stake is on screen when you land (the cold tree, Tooth Day today, the stopped clocks, the islands drifting a hand's width a night). The route itself has no clock until the midpoint's promise, which suits an exploration game. |
| The covenant of the arc | 4 | The father changes across the reel (scolding to "We are proud of you already"), Nour lets go of the box, Ilen comes home, Lou leaves a space at the edge of her drawing, Tansy decides; most givers have an `after` node (counts below). Plumb is fixed on purpose (a plumb bob). |
| Keep the press out | 5 | Fame stays local: Qanat will sing about him "all the way home"; Hesper's harbour book; nobody beyond a world comments on the traveller. |
| The hero leads | 4 | Following the light is his choice, kept by continuity and a test; nobody hands him to somebody else (quest-qc rule 2). The later worlds' first talks offer "I'll go in and look." Weak where an answer only thanks. |
| The bad guy | 3 | No villain, by design: the opposition is time, distance and his habit of leaving things half done. It is set up (the charge) and paid off (the stone), but flat between: after the midpoint nothing makes it worse. |
| Talking the plot | 4 | Subtext is strong across the script; feelings are rarely named. The broadcast states the theme outright, which a letter may. A few lines explain what the player has just seen (the homecoming's "That's the light that passed my ship. I followed it all this way.", `ending.js:319`). |
| Primal | 5 | Home, dead parents, a child waiting, a lost sister; and every world's local stake is water, light, warmth, time or someone lost. |

Rules mean: **3.92**. All 29 rows: **4.0**.

## The worlds as small beat sheets

A route world is a small story: a stake on view at landing, a theme stated in its own terms, the temple and the
world's moment (its finale), and the world changed after (speakers with an `after` node or changed lines, out of the
world's speakers). "Template" marks the three-page opening shared by the later worlds.

| World (route order) | Stake on view at landing | Its own answer to "of value" | Speakers changed after | Gap |
|---|---|---|---|---|
| The Desert | the cold tree, the dry roots | the banner's carrying; the empty tank | 8 of 57 | the crowd changes, few named givers do |
| Vael (and Vael II) | the waiting bird; the cloud creeping up | none | 4 of 17; 7 of 12 | no theme line |
| Lorn (and Lorn II) | the crystal's song; forty years of lamps | "listen before you decide what it's worth" | 7 of 11; 5 of 8 | |
| Viridel | the garden; the tea terraces (fail) | "be happy with what it becomes" | 7 of 12 | |
| The Underwater City | the whales sent off | none | 5 of 6 | template opening |
| The City-Shaft | the Lodestar going out | "Worth it" (the light seen top and bottom) | 10 of 32 | |
| The Glass Dunes | the clocks stopped | none | 2 of 8 | thinnest world, first after the midpoint |
| The Buried Machine | Tooth Day | "we value things that last" | 9 of 13 | |
| The Moon Foundry | the house pours by itself | none | 4 of 7 | template opening |
| The Garden of Spheres | the spheres remember | partial ("Long, and worth it.") | 5 of 13 | |
| The City Floating in Space | the islands drifting | none | 4 of 6 | template opening |
| The Signal Market | the silent tower | the broadcast | 4 of 27 | the crowd hardly changes |

The pattern behind the Bad Guys Close In score: from the fifth world on, three openings share one shape
(`underwater`, `moonfoundry`, `spacecity` hello nodes): a keeper names their job, points at the house, and says
"the night the light passed" something broke. That repeats the game's first catalyst rather than raising it, so the
second half feels like more of the first.

## Recommendations, ranked

1. **Make the second half press (Bad Guys Close In, the bad guy).** *Design, medium.* Let his flaw cost something after
   the midpoint and let time bite. Three ways, any one enough:
   - the window log (`calls.js` `WINDOW`) gains his own line each world, counting Lou's promise down. After the
     Glass Dunes: `YOU('~whisper~ (Once more, I told her. This is the once.)')`;
   - one late world asks him to finish something at a cost or leave it half done (the Moon Foundry, whose recording
     word is *finish*, is the natural place), and the stone remembers it like Dov's token;
   - the reel wears: from the seventh world on, a recording loses a word the way recording 4 does, and he notices.
2. **Give the second half's openings their own catalysts.** *Writing, small to medium.* Rewrite the template
   openings so each world's trouble is its own, not the light's passing again. Example, the Moon Foundry's keeper
   (`moonfoundry-people.js`, hello, keeping the tones and the page count):
   `'~neutral~ (She looks up from a ledger the size of a door.) Thirty-two moons ordered. Thirty-one delivered. Somebody has to keep the founders' book.'`,
   `'~solemn~ That's *the Casting-House*. The last moon was poured in there and never collected.'`,
   `'~sad~ Since the singing went over, it pours at night by itself. Nobody ordered it. The floor shakes.'`
3. **Fill the Glass Dunes (the first world after the midpoint).** *Writing and design, medium.* 18 pages, two people
   who change. One more giver with a stake of their own (a glassworker's clock that stopped at her daughter's
   minute), and a theme line: `'~tired~ Value? Out here it's the minute you were in when the glass came down.'`
4. **Show the cards to Lou before the midpoint (the B story on the main path).** *Design, small.* After each world
   the ship's console shows a card going into the post slot, addressed to "the small house on the hill" with no name
   and one line in his hand (his `you` lines from the reel would do). The midpoint keeps its reveal (who reads them),
   and her drawings at home pay off something the player saw him do.
5. **Lengthen the Dark Night by a held beat, not lines.** *Cinematics, small.* After "Not here. Not yet." hold the
   console dark and let him sit until the player moves (`calls.js:404`), the way the stone holds; the recording waits.
6. **Shorten the desert's pipe.** *Quest design, medium.* The Rose House's blade, guard and push gun are three steps
   between "the tree needs the spark-stone" and the stone. Folding them into one step ("Take what the Givers left
   in the Rose House") keeps the teaching and halves the wait. Needs a save migration (quest-qc, "Fix, then record").
7. **Write the logline into `docs/game-brief.md`.** *Docs, trivial.* So new worlds and lines can be checked against it.
8. **Give the missing worlds a theme line.** *Writing, small each.* Vael, the Underwater City, the Moon Foundry and the
   City Floating in Space have no answer to "something of value" in their own terms. One line each from a minor
   speaker, never the ending's lesson. Vael (silent people): `'~whisper~ (She holds up an empty hand, closes it, and puts it to her ear.)'`.
9. **Let the main path meet the dark once (double mumbo jumbo).** *Writing, small.* The ink that seeps up into foes is
   the makers' to keep out, but only the fight hosts say so. One line where a route temple's guardian falls would
   join the two: a keeper's `'~solemn~ The house kept the dark under the floor. It still does, now you've woken it.'`
10. **Talking the plot at the homecoming.** *Writing, optional.* `ending.js:319` could trust the picture: Lou has just
    named the light, so `YOU('~solemn~ That's the one. I followed it all the way here.')`. Low priority: he is
    explaining to a child, which is fair.

## Applied in this pass (small and safe)

- **Nour, the desert's repayment** (`src/story/desert-data.js`, `nour.drinking`, the path where the Rose House's
  weapons are already taken): "You gave us back our light, child, and asked for nothing." became "You gave us back
  our light, child, before you saw to your own ship." He had asked her for power in their first talk; the new line
  credits the kindness he did do (the tree before his ship) and keeps the tone (`solemn`), the condition and the
  rest of the page. `LORE.md`'s quotation follows it.

Everything else above is left for the author: the story is his.
