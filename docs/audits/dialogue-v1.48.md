# Hiraeth's dialogue, reviewed again (October 2026, v1.48)

<!-- audit-scores
overall: 3.50 / 5
label: the mean of the twelve areas
date: 2026-10-11
-->

The second dialogue review, run with the `dialogue-review` skill (`.claude/skills/dialogue-review/`), in the same
order as the first: the house rules (`lore/voice-guide.md`, `docs/systems/dialogue.md`, the sheets in
`lore/characters/`, `docs/story-bible.md`, `lore/continuity.md`), then `craft.md`, then the
[v1.0 review](dialogue-v1.0.md), whose findings are rechecked one by one below.

**The corpus:** 3,729 lines across 30 worlds: 2,353 pages and 1,376 answers (v1.0: 3,075 lines, 27 worlds, 1,945
pages, 1,130 answers). Since v1.0 the game has gained the three newest worlds and the Glass Dunes with a main quest
each (v1.48), their temple guides (Anselme, Ilse, Joss, Wim), a cameo cast in eleven detour worlds, fifteen
shopkeepers, the night mail, Tansy the fellow traveller, the Lantern and home after it, and the key placeholders.

**How it was read:** every world's extracted script whole, speaker by speaker (`extract.mjs`, into a scratch
folder), plus the ending's lines (`src/story/ending.js`), the Lantern (`src/story/lantern-data.js`), the
recordings and the quest steps (all 164 of them, for length). The combat barks and the temples' rooms were only
sampled: other work is changing them now. The extractor's flags were judged, not counted: "cool" is a temperature
in every one of its nine slang flags, the one "therapy-speak" flag is a field's "boundary", and the 143
goodbye-only answers are judged as a pattern (finding 10), not one by one.

This section is the measured review. Nothing in it is an estimate. The rewrites were then applied (the author
asked this time), and what they changed, with an honest estimate of the new scores, is at the end under
[After the rewrites](#after-the-rewrites).

## The scores

Each cell is the v1.0 score, then this one.

| Area | Score | In one line |
|---|---|---|
| Brevity | 4 → 4 | Median 15–21 words a page; quest steps never over 9 words; the new worlds run a little long (medians of 20–22) |
| Subtext | 4 → 4 | The Lantern's peak now holds its silence ("Was. You said was."); the morals moved to the traveller's mouth and the guides' |
| Distinct voices | 3 → 3 | The leads still pass the blind swap; three templates grew: 24 cameo visitors, 15 shopkeepers, 15 temple guides |
| The traveller's voice | 3 → 3 | A few new dry answers ("Can I sit down first? It's a long bar."); still diagnoses every guardian and closes on its moral |
| Choices | 3 → 3 | Dov's token, Hollin's promise and Esk's hill now come back at the stone and from Ilen; the new worlds are corridors of "Go / Not now" |
| Listen lines | 4 → 4 | Still overheard life and real hints; they change after the main beat everywhere, the cameos included |
| Tone | 4 → 4 | Quiet beats kept quiet (Esk, the broadcast, Coralie's cup); the Lantern is 54% sad or solemn, which is right for it |
| Mystery | 4 → 4 | Witnesses still report before believing; the Lantern's middle still explains for eight pages after "Let me tell you what it is" |
| Aliens and the translator | 3 → 3 | Oïa keeps her three words now; Ummu, the shellbacks and the Mimmis say the City-Shaft's "the night the sky rang" |
| Lore load | 3 → 3 | The Givers' House and Hearth still; new pairs too alike: Maelle and Mireille in one city, Anselme and Ansel, Oren and Oro, Ilse, Ilen and Ilo |
| Quest clarity | 4 → 4 | Every step names a place and a verb; ten people still send you to someone else instead of somewhere |
| Localisation | 2 → 3 | The key placeholder is built: no button named in prose anywhere; puns and rhymes still carry no note, and one direction still hides in a pun |

**Overall: 3.50, up from 3.42, and the rise is all one area.** The engine work after v1.0 fixed localisation's worst
fault (the buttons), and most of v1.0's ten findings were fixed line by line. But the 48 versions of new writing
brought back the same three faults the first review found, at a larger scale:

- **one phrase in every mouth:** "the night the sky rang" was twelve speakers in seven worlds; it is now about
  twenty in twelve, including all three new worlds, three alien peoples, Tansy and the traveller;
- **templates showing through:** every cameo visitor introduces themselves the same way, and so do the shopkeepers
  and the new temple guides;
- **people sending you to people:** the author's own rule, broken by ten speakers.

The best new lines are as good as the first review's:
- "Fireworks, the palace said. Fireworks don't sing." (the City-Shaft's flower seller)
- "Sang the light's note back to it, all together, the way they greet each other." (Anselme, of the whales)
- "That's between me and her. It's not a long letter. It took me forty years to write, that's all." (Edda)

## What was fixed since the last review

The v1.0 findings, each rechecked against the shipped strings.

| # | v1.0 finding | Now | What is left |
|---|---|---|---|
| 1 | The Lantern explains at its peak | partly fixed | `light` and `sign` are the proposed rewrites, the mind-reading is gone, "Can I sit down first?" and "It has a funny way of bringing people" give him a wry way in, `again` no longer restarts. But `sorry` still announces "Let me tell you what it is", and `answer` and `why` still explain the lantern, the song, the sign and the reel over eight pages |
| 2 | The oldest recording answers the traveller | fixed | The tape is now a child waving at a recorder: "Nobody needs anything. Just wave." |
| 3 | Oïa speaks four fluent sentences | fixed | On the train she gestures; her mouthed word is *Blow*. One narrator wink is left: "You seem to have said the right thing." |
| 4 | Viridel's loss blamed, then forgiven for Esk | fixed | "One turn. I said one turn. One turn did that."; "I won't say it's all right."; Ilen holds his wrist and does not forgive |
| 5 | The writer's voice: one image in many mouths | partly fixed, partly worse | The wet finger is gone (the trader's axle "begging for grease"). "Three dots over an arc" is down to ten. But "the night the sky rang" spread (finding 1 below), and the lone-woman witnesses and the "learning a word" image are still six and four |
| 6 | Buttons named in prose | fixed | `{key:aim}`, `{key:fire}`, `{key:mode}`, `{key:call}` everywhere; Ferro says "tank" |
| 7 | Answers that no longer answer | fixed | Nell, Dun, Oum, Hask, Saba and Ilen all match. New mismatches appeared (finding 6) |
| 8 | Continuity slips | mostly fixed | Hollin's forty years, Oro of Viridel, Saba of Lorn, Sol, Senn's pronoun, Maudie's hiss, the Fallen Ring's old mark, Sel's "too late", the lore docs, Perrine's sheet: all fixed. The Givers' House and Hearth are still both in the first hour; the Hangar was dismissed, but three of its people still say they are from it |
| 9 | The lesson said aloud | partly fixed | Hollin and Sefa fixed, the son's parentheses gone. "Both" is still in three mouths (Vey, Esk, the traveller), the gift lines still tell him what each gift meant, Ket and Cael still close on maxims |
| 10 | Templates | not fixed, and grown | The temple guides' five beats now cover fifteen houses; the cameo introductions grew from ten to 24; goodbye-only answers from 105 to 143; "Walk on, Speaker." is still said seven times |

## The ten findings that matter most

### 1. "The night the sky rang," in every world

`metrics.json`'s repeated phrases: "the night the sky rang" 18 times, "since the night the sky" five more, and the
traveller says it twice (`perdide2-data.js` Hollin `dark`, Robin `lit`) to people who never said it to him. It was
meant to be the City-Shaft's phrase: a shaft that rings. Now the Underwater City (Bastien, Maelle, Anselme), the Moon
Foundry (Hedda), the City Floating in Space (Rosa, Tamar), the Market (Kip, Doss, Hobb), Lorn (Teasel), the falls
(Aldo), the eclipse (Ansel), Tansy and three alien peoples say it word for word. Ummu, who speaks through a screen in
capitals, says it too: "IT FELL WHEN THE SKY RANG."

The voice guide's own example of the writer leaking. Each culture should name the night by what it saw:

> ~tired~ Hear that hum in the glass? One note, all over the city, since the night the whales went quiet. (Bastien)
> ~solemn~ The night the moons turned, every hung moon on the floor turned on its hook. (Hedda)
> ~tired~ A hand's width a night, since the cables sang. (Rosa)
> ~sad~ OUR BOWL IS *UNDER THE BOXES*. IT FELL ON THE LOUD NIGHT. (Ummu)

and the traveller asks about what the speaker just said: "What happened, the night the pools went dark?"

### 2. People who send you to people

The author's rule (issues #62, #63): a quest giver says where to go, never "go and ask X". Ten still do:

| Who | The line | Where it should send you |
|---|---|---|
| Sister Aube (`arzach2-data.js` `why`) | "Ask *Brother Calix at the monastery* why." | the bell, at the white monastery |
| Mother Ysolde (`bell`) | "Ask *Brother Calix at the monastery*." | nowhere: it is a question about the bell |
| Sol (`edena-data.js` `tea`) | "Go see her. She'll pretend she isn't glad of company." | Esk's terraces, which he has just named |
| Wen (`buried-data.js` `today`) | "*Ask him.* Strangers sometimes get the answers neighbours don't." | the problem is Hask's, but say where he sits |
| Linnet (`spheres-data.js` `then`, `three`) | "Find *Ume beside the pole*. She can help you play the sounds together." | the pole: splashing it is the next step |
| Sedge (`perdide-data.js` `ship`) | "Ask *Saba at the Great Crystal*." | the crystal, east through the ford |
| Bram (`perdide2-data.js` `skiff`) | "Ask *Fen in the far dome*." | answer "whose skiff?": Fen's |
| Hollin (`rang`) | "Ask Robin beside the second dark pool." | he slept through it; say so |
| Anselme (`temples/underwater-data.js` `night`) | "Maelle in the Gallery has listened to them longer than I have. Ask her." | nothing: the scene is over |
| Ommo, an old trader (listen lines) | "Ask *Linnet, in the grove*."; "Hobb sits by it, listening. Ask him what he hears." | the thing to do |

**Rewrite** (Linnet, `then`):
> ~neutral~ After hearing all three, follow *the avenue to the round plaza*. *Splash the pole* there and it plays them together.

### 3. Every cameo visitor introduces themselves the same way

The detour worlds and the new worlds hold 24 visitors from other worlds. Nearly every first line is "Name. From
X. I came to see Y.":
- "Fen. From the far dome, in the Deep Wood. I came to see how other people live on water." (`content.js` mangrove)
- "Bram. I mind a cave mouth in the Deep Wood. I came here for the quiet." (mangrove)
- "Pip. From the bottom of the shaft. I saw the sky once, and then I came to see all of it." (saltharbour)
- "Oro, from Viridel. I grow pyramids. I came to see a thing that was built, for once." (fallenring)
- "Sol, from Viridel. I took the train to see a flat thing." (overnighttrain)
- and Lune, Ottla, Teb, Zazie, Tiv, Kip (twice, word for word), Saba, Mira, Mother Ysolde, Wen (three times),
  Emrys (twice), Dun, Nima, Madame Sel, Marrow, Corvin.

The panel already shows the speaker's name, so the name in the line is a second label. The blind swap fails: with
the names hidden, any two could trade first lines. **Rewrite** each to start in the middle of what they are doing, in
their sheet's voice:
> ~tired~ Quiet here. I came for that, and it's very quiet. I may have overdone it. (Bram)
> ~curious~ I've never seen people live on water and not mind it. I mind it every day. (Fen)

### 4. The temple guides: one shape, now fifteen times

v1.0's finding 10 named the shape: name, job, joke; something inside woke when the sky rang; I'll go in / what is
it / goodbye; "You went in! Is it all … inside?"; the traveller diagnoses the guardian and closes on its moral. The
four new guides (Anselme, Ilse, Joss and Wim, now the Glass Dunes') follow it to the letter, and the old eleven are
unchanged: "She only wanted it quiet." (Teasel), "It only needed a little light." (Tamsy), "It only needed
answering." (Tessa), "She only needed a note to answer." (Agathe), "It was stuck. I gave it its words back." (Hobb).
The phrase "you went in! is it" is in four guides' mouths.

`temple-guides.md` asks for completion lines that "notice the changed place, not just congratulate". The new four do
better on that (Anselme's whales at the horns, Ilse's ledger, Joss patting a cable "like a patient horse"). The
rewrite proposed in v1.0 for Wim still applies, and so does cutting the traveller's moral:
> ~surprised~ Back already? Or late. I can't tell any more; that's rather the problem.
> ~neutral~ (answer) It was straining against itself. It's quiet now.

*(Not applied in this pass: the temple guides are being reworked with their rooms.)*

### 5. The fifteen shopkeepers share one script

`shop-data.js`: "A customer from the sky! Come in, come in." (Haddu), "A traveller from below the cloud! Come to the
hatch, come." (Perpetue), "A traveller, from the ship!" (Marit), "A visitor from up top!" (Odette), "A traveller
across the dark!" (Amaro), then the stock read out ("Cures…, a heart…, chimes…") and "Show me what you have" fifteen
times. The stock and the button have to be there; the arrival line doesn't. Each shop's own idea (Hale's tuning fork,
Mott's dating by teeth, Gunnar's floor of cracked moons) is good and should open the talk. Two lines break the voice
guide outright:
- Hale (`topic`): "Even you. Yours is a little tired, I think." A shopkeeper diagnosing the traveller.
- Gunnar (`again`): "I slept through till the morning shift. First time in a year." Hedda says "First time in a
  year." and Ottilie "I slept straight through" in the same world.

### 6. Answers that don't answer, again

New writing, new mismatches:
- **Tull** (`buried-data.js`): the answer "The man in the helmet?" leads to a story about "an old woman, a clock on a
  cord round her neck".
- **Ysse** (`perdide-data.js` `hello`): "Dust muffles their sound." → "Hear what?"
- **Senn** (`arzach-data.js` `hello`): "The bird over the haze?" before anyone has mentioned a bird.
- **Cael** (`spheres-data.js` `walked`): "Now you've seen what the hurry misses." → "It was long." / "It was short.",
  answers to a question he never asks.
- **Corm** (`perdide-data.js` `crystal`): "Professional respect." ends one page and starts the next.
- **Sedge** (`believe`): "That makes one of you." is still garbled (v1.0).
- **Madame Sel**, in the City Floating in Space: "I know its voice: a market with a silent tower." It is her own
  market and her own tower.

### 7. The lesson, still said aloud

- **Viridel's "both":** Vey "Both matter.", the traveller "Both. I'll remember." and "Both can be true." Keep Esk's
  "Both are true", which comes with a cutting.
- **Maxims at the end of a beat:** Cael "Now you've seen what the hurry misses.", Ket "Sometimes a machine just needs
  someone to hear it.", Sabri "Thirsty and frightened. Just like us."
- **The gift lines at the stone** (`ending.js` `ITEM_LINES`) still tell him what each gift meant: "So many things
  changed when you stopped rushing.", "You learned to carry fire." v1.0 proposed concrete memories.
- **The traveller tidies a scene into its moral:** "The water was waiting for someone to clear its way." (Hessa
  `full`).

### 8. The Lantern's middle

`lantern-data.js`, Ilen, `sorry` → `answer` → `why`: after the restrained opening, `sorry` says "Let me tell you what
it is. Then be angry, if you still want to." and then she does, across `answer` (five pages: the makers built it,
it brought her in, Mum heard it, Dad's message came, she sang it back with the sign) and `why` (three pages: it sang
over the house, went looking for the voice, "Talo used to say they only know straight"). Every sentence is hedged
now, which v1.0 asked for, but it is still eight pages of explanation at the game's peak, with one answer between.
The facts are all needed somewhere; the explanation of *how* (singing the message into a light, the sign put on it,
"they only know straight") is not.

**Rewrite** (`sorry`, page 2):
> ~solemn~ I'll tell you what I know. Then be angry, if you still want to.

and cut `answer`'s fifth page down to what she did, not how:
> ~solemn~ So I sang it back. His own message, the way the lantern sings. I sent it home.

### 9. Names too alike, and people from a world that is gone

The Lore load checks: names in one world sharing a first letter and a length, and names with no tie to anything in
view.
- **In one world:** Maelle and Mireille (the Underwater City); Hessa and Hesper are a world apart, but both aunts or
  keepers of someone.
- **Across worlds, too close:** Anselme (the Whale-House) and Ansel (the eclipse); Oren (the Glass Dunes) and Oro
  (Viridel); Ilse (the Moon Foundry) beside Ilen and Ilo; Tamar (the City Floating in Space), Tamra (Qanat's weaver),
  Tamsy and Tam; Ottilie and Ottla; five W-names with a vowel and a consonant (Wen, Wim, Wren, Wynn, Wendel).
- **Still from v1.0:** the Givers' House (east) and the Givers' Hearth (south-east) in the first hour.
- **The dismissed Hangar:** Lune ("I read the signal in the Sealed Hangar"), Ottla and Zazie ("From the Hangar,
  where the floor goes round") are visitors from a world the player can never reach. Their lines are lore with no
  tie to anything.

No rename is applied here: a rename touches saves, quests and lore. The proposals are listed under
[Renames proposed](#renames-proposed).

### 10. The same images and exits across the new worlds

- **The lone woman:** six witnesses still open on a woman who came alone (Liss, Hesper, Maudie, Coralie, Bertil,
  Tamar). v1.0's rewrite for Coralie was half applied ("came in alone, very tired").
- **Learning a word:** Liss ("until her hand knew it"), Bertil ("slowly, like a new word"), the Fallen Ring's mark
  ("the way you write a word in a language that isn't yours"), Grete ("as if it was learning them").
- **"Name. Job. Joke." at the start of every new quest giver:** "Bastien. I keep the lock.", "Hedda. I pour the small
  moons.", "Rosa. Every morning I chalk…", "Oren. I carry the floats…", "Mireille. I grow the glow-kelp.", "Fabre. I
  keep the Crown's lamps.", "Ottilie. I mend things."
- **The exits:** each new quest giver's first node is a real question and "Not now." (a false binary, finding 3 of
  craft.md's §4), then a "Goodbye, X." on every later node. Of 143 goodbye-only answers, 45 are in the v1.40
  and v1.48 writing.
- **Greetings as a first line:** Calix still opens "Welcome, welcome" (v1.0), and Wen "Welcome down!", Ondine
  "Hello!" and Clover "Hello, you." do too.

## By world

Flags are the extractor's (judged, not counted as faults); "nouns" is distinct proper nouns.

- **The Desert** (48 speakers, 323 pages, 35 flags, 53 nouns). Still the strongest opening: Nour, Hessa, Marrow and
  Oum are distinct, every quest gives a problem, a reason and a step. The trader's grease-begging axle replaced the
  wet finger. Against it: the House and the Hearth, Sabri's guardian moral, the traveller tidying Hessa's well into a
  lesson, "Walk on, Speaker." seven times, and Yara's 37-word listen line.
- **Vael** (11, 94, 8 flags). Gesture-led and clear; Oïa holds her three words. Against it: Senn's answer about a
  bird nobody mentioned, Lark's five goodbyes, one narrator wink.
- **Vael II** (12, 111, 9 flags). The sisters are still the best writing of their batch. Against it: Aube and Ysolde
  both send you to Calix, Calix and Ondine open on greetings.
- **The City-Shaft** (31, 247, 19 flags). Still the best web of conversations, and the one world where "the night
  the sky rang" belongs. Against it: "Light it. Give it a shot." (a direction in a pun), "eleven" six times now, "in
  their slippers" twice.
- **The Buried Machine** (12, 129, 12 flags). Warm, specific, funny. Against it: Wen's "Welcome down!" and "*Ask
  him.*", Tull's helmet answer, Tull and Fisk both oiling doors (v1.0), Ket's closing maxim.
- **Viridel** (10, 149, 17 flags). Esk's arc is now right. Against it: Sol sends you to Esk; Esk says "the Singer"
  before anyone has named it to her; the "both" thesis; Mira's "we tend the garden" is a keepsake, not a lecture,
  and can stay.
- **The Garden of Spheres** (7, 80, 8 flags). A gentle interlude. Against it: Linnet sends you to Ume twice, Ume
  sends you to Emrys, Cael's answers follow nothing.
- **Lorn** (11, 132, 23 flags). The humour still belongs to the people. Against it: Sedge sends you to Saba; Corm's
  doubled line; Ysse's "Hear what?"; Saba's four-page `heard`; Saba calls the light "the Singer", Viridel's name.
- **Lorn II** (8, 108, 17 flags; 31% sad or solemn, over the line). Still the most moving of the middle worlds;
  Hollin's promise is now remembered at the stone. Against it: the traveller's "night the sky rang", Hollin and Bram
  sending you on to Robin and Fen.
- **The Signal Market** (24, 176, 16 flags). The broadcast still carries the world. Against it: the phrase in Kip's,
  Doss's and Ummu's mouths, an old trader sending you to Hobb, Teb's "Give it a shot".
- **The Underwater City** (6 speakers in the world, 65 pages, 11 flags; v1.40 and v1.48). Coralie is still the best
  detour script in the game; Maelle's whales "kept" the light's note, a fine image. Against it: the phrase three
  times, Maelle and Mireille, Anselme's "Ask her", Fabre's "Here. Now that you know the way up: there's something
  else."
- **The Moon Foundry** (7, 58, 16 flags). The ledger and the first moons that "fell short" into the Garden of Spheres
  are the best cross-world idea since the Buried Machine's wheel. Against it: three people who slept for the first
  time in a year, Bertil's "like a new word", "the night the sky rang".
- **The City Floating in Space** (6, 52, 14 flags). Joss and his cables are good. Against it: Madame Sel not knowing
  her own market, Rosa and Tamar's phrase, Kip's introduction copied from the Underside.
- **The Glass Dunes** (Oren, the Clock-House's Wim). Short and clear: Oren's quest is three steps and a joke
  ("Same answer, three times. I didn't know what to do with myself."). The dunes say "the night the light passed",
  their own.
- **The night mail** (6, 49, 3 flags). Edda and Solange are restrained and right. Nothing to fix.
- **Tansy** (104 pages). Her arc reads well, and she remembers his "I'm not sure any more" a world later, the best
  callback after Dov's token. Against it: "the night the sky rang", in a harbour.
- **Home and the recordings.** Lou is still right. The son's parentheses are now memories, not themes. Against it:
  the gift lines (finding 7).
- **The Lantern** (68 pages, 54% sad or solemn). See finding 8. Protect: "Two years. His message took thirty to
  reach me, and I missed them by two." and "Which is better. I didn't know there was a you to find."
- **The aliens.** The stilt-walkers ("Light. Went over. Turned. We looked up."), the Tullos and Ummu hold their
  quirks. The drifters still have none, and Slow Orm's "eleven years" is a shellback's joke in a drifter's mouth.
- **The shops** (15, 92 pages). Finding 5.
- **The detour worlds.** Light and specific; the cameo introductions (finding 3) and the lone women (finding 10).

## Patterns across the game

- **The traveller.** Polite or practical; his best new lines are dry ("Can I sit down first? It's a long bar.",
  "It has a funny way of bringing people."). He still diagnoses fifteen guardians and closes on their moral, repeats
  directions back ("The skull past the back gate. Thank you, Nour."), and borrows other worlds' phrases. In the new
  worlds he has two moods: "Where does it come from?" and "Not now."
- **One register for every translator.** Monks, swamp folk, moon-founders and divers come out as the same wry English
  ("love" from Sel, Odette and the Market; "Mind…" openers in nine worlds). The aliens are the exception that works.
- **One-tone speakers:** none (the extractor finds no speaker with a single tone).
- **Callbacks grew:** Dov's token and Hollin's promise come back at the stone and from Ilen (v1.47), Tansy remembers
  his doubt, the wheel hears that the dunes keep time again, the first moons lie in the Garden. The new worlds
  remember nothing of what you chose in them, because there is nothing to choose.

## Recommendations, ranked

1. **One name for the night per culture** (finding 1). *Cost: about 25 lines and the people book's notes.* Highest
   value per line: it is the most noticed leak in the game.
2. **No more hand-offs** (finding 2). *Cost: ten lines.* The author's standing rule.
3. **The broken answers and slips** (finding 6). *Cost: eight lines, an hour.*
4. **The Lantern's middle, with restraint** (finding 8). *Cost: four pages cut or shortened.*
5. **The cameo introductions and the lone women** (findings 3, 10). *Cost: about 20 short lines.*
6. **The lessons** (finding 7): the "both" lines, the maxims, the gift lines. *Cost: about 15 lines.*
7. **A quirk per translated tongue**, the drifters first. *Cost: a few lines a people.*
8. **The renames** (finding 9). *Cost: a decision by the author, then saves, quests and lore.*
9. **The temple guides and the shops** (findings 4, 5): after the temple work lands. *Cost: medium.*
10. **The process:** run this review again after every batch of new worlds; read one scene a world aloud; let the
    extractor flag the phrase "the night the sky rang" outside the City-Shaft.

## Renames proposed

For the author to decide; none is applied. Each touches saves (`heard.<id>`, flags), quests, the people book, lore and
the credits.

| Now | Where | Why | A proposal |
|---|---|---|---|
| The Givers' House / the Givers' Hearth | the desert, both in the first hour | v1.0's finding, still there: two "Givers'" places a few minutes apart | the temple as *the Rose House* (the pilgrims already call it "the rose-stone house") |
| Mireille | the Underwater City (kelp grower) | Maelle is in the same city, the same first letter and sound | *Brune* |
| Ansel | the eclipse detour | Anselme keeps the Whale-House | *Corentin*, or a name not in A |
| Oren | the Glass Dunes | Oro is Viridel's pyramid grower | *Halden* |
| Ilse | the Moon Foundry's ledger | Ilen must stand alone; Ilo is in the desert | *Petra* |
| Tamar | the City Floating in Space | Tamra (Qanat), Tamsy (Lorn II), Tam (Vael) | *Ines* |
| Ottilie | the Moon Foundry | Ottla (a cameo) | *Liesel* |
| "from the Hangar" | Lune, Ottla, Zazie in the detours | the Hangar is dismissed: they come from nowhere the player can go | re-home them: the Glass Dunes took the Hangar's place |

**Same-named duplicates that are plain mistakes:** none found. Every name shared between worlds (Dun, Wen, Kip, Emrys,
Madame Sel, Fen, Bram, Sol, Saba, Oro, Oyo, Mira, Mother Ysolde, Pip, Corvin Sale, Marrow, Teb, Tiv, Nima, Oïa) is the
same person on a visit, and their lines agree with their home world. The only near-mistake is Madame Sel's line about
her own market (finding 6), fixed as a line, not a name.

## About the tool

The extractor read 30 worlds this time (the new worlds' people through `src/levels/content.js`). It does not read
`*-moments.js` (the cinematics) or the balloons' `lines:` on the new worlds' locals; both were sampled by hand. A
check worth adding: a phrase list per world, so that a world's own phrase ("the night the sky rang") is flagged when
it turns up anywhere else.
