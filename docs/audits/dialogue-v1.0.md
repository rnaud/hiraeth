# Hiraeth's dialogue, reviewed (October 2026, v1.0)

<!-- audit-scores
overall: 3.42 / 5
label: the mean of the twelve areas
date: 2026-10-08
-->

The first dialogue review, run with the `dialogue-review` skill (`.claude/skills/dialogue-review/`).
It reads against the house style first: `lore/voice-guide.md`, `docs/systems/dialogue.md` and the
character sheets in `lore/characters/`. The craft of game writing comes second (`craft.md` beside
the skill).

**The corpus:** 3,075 lines across 27 worlds: 1,945 pages and 1,130 answers. That counts every
conversation and listen line, the temple guides, the parents' recordings, the stone and the
Lantern.

**How it was read:** five readers took about 11,000 words each, whole, world by world, each after
the house rules. The extractor's flags pointed where to look; most were judged, and many were thrown
out:
- "cool" meaning temperature;
- pages behind conditions, which are alternatives, not a run;
- answers that exclude each other.

No line has been changed. Every rewrite below is a proposal for the author.

## The scores

| Area | Score | In one line |
|---|---|---|
| Brevity | 4 | A median of 14–21 words a page, inside the guide's 15–45; few long pages; listen lines mostly fragments |
| Subtext | 4 | Often superb ("Was. You said was."); undone where people name feelings or morals |
| Distinct voices | 3 | The leads pass the blind swap; the supporting casts share one deadpan closer and a few templates |
| The traveller's voice | 3 | Decent, practical, now and then dry; rarely pushes back, and names the theme too often |
| Choices | 3 | Three real choices remembered well; many corridors of one answer, and a few false binaries |
| Listen lines | 4 | Short, overheard life, hints to real things, changes after the main beat |
| Tone | 4 | Humour that belongs to people, quiet beats kept quiet; a few quips and morals in the wrong place |
| Mystery | 4 | Witnesses report before believing, almost everywhere; the Lantern explains too much, too surely |
| Aliens and the translator | 3 | The murmurs, the stilt-walkers and Ummu are distinct; most tongues come out as the same fluent, wry English |
| Lore load | 3 | About 15 names a world; names too alike (Givers' House and Givers' Hearth, Teasel, Tamsy and Tessa, two Pells, Wens and Kips) |
| Quest clarity | 4 | Directions name a place, a landmark and a verb ("South ramp. Two oval doors. Push the valve, then shoot the Wick.") |
| Localisation | 2 | Buttons named in prose 19 times, three different ways; puns with no note; stale world names |

**Overall: good writing with an editing problem, not a writing problem.** The people are specific
and funny, and the quests are clear. The best lines are as good as anything in the genre's
references:
- "It was your father's voice. It was not your name." (the Market)
- "Same mark on a gift and a wound. I don't like that." (Hask)
- "Her cup is still on the shelf. Nobody uses it. Nobody decided that; it just happened." (Coralie)

What lets it down is what a second editor catches:
- the same image in many mouths;
- templates showing through;
- the theme said aloud;
- a scene's peak explained instead of felt;
- answers that no longer match the line above them;
- button names written into prose;
- continuity slips between worlds written at different times.

## The ten findings that matter most

### 1. The Lantern explains at the moment it should be felt

`src/story/lantern-data.js`, Ilen, nodes `light`, `answer`, `sign`. This is the game's emotional
peak, and it opens perfectly: "It was my father's ship." "Was. You said was."

Then, two pages after she learns her parents are dead:
- she reads his mind: "I can see the question on you. What struck your ship.";
- about eleven pages of `answer` → `sign` → `why` explain the lantern, the light and the glyph, in
  the narrator's certainty: "It says *we heard you*".

The voice guide says theories belong to speakers, and `family.md` warns against using her "to
explain a cosmology". The traveller meanwhile has mostly one answer a node.

**Rewrite** (`light`):
> ~solemn~ (She looks past you, at the scorch along the hull. She looks at it a long time.) A light did that. A singing one.
> ~sad~ It was mine. My answer. I'm sorry.

**Rewrite** (`sign`):
> ~solemn~ {glyph} Every people out there has a name for it. Odile read it as *we heard you*.
> ~whisper~ She might be wrong. It's what I wanted him to hear.

Also:
- give him one wry or deflecting answer at `name` or `brother`;
- let `answer` say "Talo said the makers built it. I only know what it does";
- fix `again`, which sends a returning player back to "A brother." as if it were news.

### 2. The oldest recording answers the traveller

`src/story/ending.js`, `FINAL_RECORDING`:
> "~happy~ We're recording this for you. In case you're grown up and far away when you need to hear it."
> "~solemn~ You don't have to bring us anything. Do you hear? Nothing."

The voice guide is explicit: the recordings never answer the current traveller; their accidental
relevance is what hurts. A tape that foresees the quest turns the father's "something of value" into
a lapse. It is also the fifth time the lesson is said aloud.

**Rewrite:**
> ~happy~ We're recording this so you can hear yourself when you're big. You won't believe how loud you were.
> ~solemn~ No, keep your spoon. The recorder doesn't need anything. Nobody needs anything. Just wave.

### 3. Oïa speaks four fluent sentences

`src/levels/overnight-train.js`. Her vocabulary is fixed at three words (the voice guide,
`lore/characters/worlds.md`), which makes this the clearest rule broken in the game:
> "~neutral~ Oïa. At home I watch the tower. Here they gave me the sky lounge, and the whole plain to watch."

**Rewrite:**
> ~neutral~ (Oïa has the sky lounge to herself. She points at the window, then the plain going by, and makes room on the bench.)
> ~curious~ (A lamp passes in the dark. Oïa waves at it. Far off, someone waves back. She looks at you: your turn.)

**Smaller, in Vael itself:** her mouthed word is *Play*, where the guide gives her "Blow". The
narrator winks at her silence ("Apparently you are invited to wait too").

### 4. Viridel's loss is blamed on the player, then forgiven for Esk

`src/story/edena-data.js`, Esk, node `sorry`:
> "~angry~ I said a little. I said one turn."

This implies the player could have saved the terraces, against `lore/continuity.md`. Only the "I
only turned it once" branch takes it back.

**Rewrite:**
> ~angry~ One turn. I said one turn. One turn did that.

Two more problems in the same thread:
- **Therapy-speak at the turning point:** Esk's `okay` opens "I hear you". **Rewrite:**
  > ~solemn~ I won't say it's all right. We say it belongs to the ground now. It's harder when it's your own hill.
- **Ilen forgives the flood on Esk's behalf** (`lantern-data.js` `broke`: "You said sorry? Then you did
  what there was to do."). The voice guide says Esk doesn't owe forgiveness. **Rewrite:**
  > ~solemn~ Then you did bring something home. Dad never said that kind weighs the most.
  > ~sad~ (She doesn't tell you it was all right. She holds your wrist a moment, then lets go.)

### 5. The writer's voice leaking: one image in many mouths

The voice guide's own warning is everyone describing the light as "a wet finger round a glass", and
that image is still in the game. It appears in the desert trader's first-hour line ("like a bowl
rubbed with a wet finger") and at the climax (`ending.js` `lightOver`). Its successors:

- **"The night the sky rang"** is said by 12 speakers in seven worlds. That includes two non-human
  peoples (Moor, the Mimmis) and the traveller himself, to people who never said it to him.
  **Proposal:** keep it in the City-Shaft, a ringing shaft, and give each culture its own name for the
  night:
  - "the falls went quiet";
  - "the noon lamps";
  - "the cables kept the note";
  - Moor's "when the high sound came";
  - the Mimmis' "when the sky made its one long note".
- **"Alone":** six detour witnesses open on a woman who came alone (Liss, Hesper, Coralie, Bertil,
  Maudie, Tamar).
- **"Learning a word":** four lines share the image (Liss "until her hand knew it", Bertil "like a new
  word", the Fallen Ring's mark, Grete). Rewrites for Coralie and Bertil:
  > ~neutral~ That window seat was taken once, all one night. A woman from up top, too tired to take her coat off, listening to the whales.
  > ~curious~ She drew the mark in soot on the floor: {glyph}. *So they'll know me,* she said.
- **"Three dots over an arc"** is narrated 12 times, 3 in Viridel alone; after the first, "the same
  mark" does.
- **Smaller echoes:**
  - "Then I lost count" (×3);
  - "my grandmother" (×4 among the traces);
  - "Mind the…" openers (10 speakers in three worlds);
  - "eleven" four times in the City-Shaft (keep Dov's: it is the keepsake);
  - "I'll frame it" (Lio, Dov);
  - "in his slippers" (the crowd, Corvin).

### 6. Buttons named in prose, three different ways

There are 19 lines; ten of them say "the gun's push mode: X or the D-pad", which is wrong on a
controller, where X interacts:
- the desert's bone, knuckle and weight;
- the City-Shaft's hoist, mirror and lamp;
- the Wick and the crane in the Buried Machine;
- Vael II's signal lamp and tiles;
- Ferro, the crates and Ummu in the Market;
- the dark pool in Lorn II;
- Sedge and Aube.

None follows remapping, and they disagree with each other:
- "aim with R, right click or LT / L2, then G, left click or RT / R2";
- "aim (LT / L2), then shoot (RT / R2)";
- "LT / L2 (or right mouse)".

**The fix is in the engine first:** a key placeholder in dialogue, for example `{key:aim}` and
`{key:mode}`, rendered through `verbKey`, which already knows the player's own keys. It doesn't
exist yet. Then the lines become story with keys:
> ~neutral~ Oil fills the dish and soaks the wick. *Shoot the Wick* to light it: aim with {key:aim}, fire with {key:fire}.

Also:
- cut Perrine's "(shoot)" asides from voiced lines;
- Ferro says "flask" where every other world says "tank".

### 7. Answers that no longer answer their line

Edits in one place left the other behind:

- **Nell** (`spheres-data.js` `hello`). Her answers are "Except what?" and "Twice as large?", but she
  never says "except" or "twice". **Rewrite:**
  > ~whisper~ I'm Nell. I watch the reflections. Everything down there is twice as large. Except one bright thing, which isn't a reflection at all.
- **Dun** (`buried-data.js` `hello`): "…my key is currently sightseeing." → "Up where?" **Rewrite the
  answer:** "~curious~ Sightseeing where?"
- **Zazie** (Hangar): "Do you charge for lessons?" → "Very new." **Rewrite:** "~playful~ First
  lesson's free."
- **Oum** (desert, unconditional): "Ama says you saw a light go over." She can be met before Ama says
  it. **Rewrite:** "~curious~ Did you see the light go over, that night?"
- **Hask** (`thumb` → `hit`): "I don't know." gets the reply meant for "Something hit it." **Rewrite**
  the reply to fit both:
  > ~tired~ Wen says it's burned on, where you were struck. Same mark on a gift and a wound. I don't like that.
- **Saba** (Lorn, the rain): both answers go to one node, so "Then I'll wait for the rain" is told
  "You could make rain with that tank".
- **Ilen** (`answer`, page 3): she answers something he never said in this scene.

### 8. Continuity slips

- **Years:** Hollin's "Forty-one years waiting for them" (`perdide2-data.js` `names`); Odile and Talo
  were struck forty years ago. **Rewrite:** "Forty years I've kept their light…"
- **Wrong worlds:**
  - "Oro, from Edena" on the Fallen Ring: the retired name; it should be Viridel.
  - "Saba… from the wood of Viridel" on the train: Saba is Lorn's.
  - "Sol, from the Garden": Sol is Viridel's.
- **Pronouns:** Senn is "she" in the script and "he" in `worlds.md`. Sol's "Odile let me help him up
  when his inventions disagreed with him" means Talo.
- **Against the finale:**
  - Maudie's lone woman plays "a man's voice" every night, but Ilen heard the father's message only at
  the lantern.
  - The Fallen Ring's mark was burned "not long ago" by "a hand that learned it", but Ilen has been
  grounded thirty years.
  - The Market's Sel says "too late for one conversation", which she can't know.
- **Too alike:**
  - "the Givers' House" (east) and "the Givers' Hearth" (south-east) in the first hour;
  - a second Pell (the Waterfall);
  - Wen and Kip, whose introductions are repeated word for word in two detour worlds each.
- **Stale documentation:** the finale now settles Ilen's fate and Odile and Talo's, but
  `lore/continuity.md` and `lore/characters/family.md` still call both unknown and give Ilen no
  dialogue. Perrine, a quest-giver, has no voice sheet.

### 9. The lesson said aloud, too early and too often

The voice guide: ordinary people "do not deliver the ending's lesson ahead of schedule". They do:

- **Hollin:** "A promise to come back costs the coming back. You'll find that out somewhere far from
  here." **Rewrite:** "~solemn~ Mind, I'm holding you to the path, not the day. Promises keep a long
  time out here."
- **Viridel's thesis, "both", in three mouths:** Vey "Both matter", Esk "Both are true", the traveller
  "Both can be true". Keep Esk's; it comes with a cutting.
- **Sefa diagnoses him**, twice: "Yours keeps stopping to look over its shoulder." Her sheet says she
  doesn't. **Rewrite:** "~curious~ Everyone walks to a tune. You keep stopping to look at the sky.
  Stay a verse. Mine's better than the sky."
- **The son's parentheses** in the recordings name the theme: "(Songs. Words. People. Do they
  count?)", "(Empty hands. He meant me too.)".
- **The ten gift lines at the stone** each tell him what the gift meant ("So many things changed when
  you stopped rushing"). That's thoughts put in his head. **Proposal:** concrete memories: "(The
  stilling lens. You set it down slowly, out of habit.)"
- **Ottla, Ket and Cael** close on universal maxims.

### 10. Templates showing through

- **The temple guides** (Teasel, Tamsy, Tessa, Agathe, Vell, Sorrel, Fisk, Wim, Hobb) share one shape:
  1. "Name. Job. Joke."
  2. Something inside woke when the sky rang.
  3. The answers: I'll go in / what is it / goodbye.
  4. "You went in! Is it all … inside?"
  5. The traveller diagnoses the place ("frightened") and closes on a moral: "She only wanted it
     quiet", "It only needed a little light".

  `temple-guides.md` says completion lines "should notice the changed place, not just congratulate".
  **Rewrite** for Wim, fussy about time:
  > ~surprised~ Back already? Or late. I can't tell any more; that's rather the problem.

  With the answer "~neutral~ It was straining against itself. It's quiet now."
- **The detour cameos:** about ten open "Name. From X. I came to see Y." A second appearance can skip
  the name and begin mid-task.
- **Goodbyes:**
  - About 105 bare goodbye answers. They push three guides' greetings to three answers that aren't
    decisions, and make "Bye." one of only two answers in a handful of nodes (Teo, Pell, Naji).
  - The best exits carry tone: "Keep them warm, Wendel.", "Walk the rim for me, Tessa.", "Light a
    lamp for it, Vell."
  - Bring the rest up to that, or cut them where B / Esc already closes the talk.
  - The Speaker's good "Walk on, Speaker." is used seven times.

## By world

- **The Desert** (the first hour). 12 real problems among 32 flags; a strong opening.
  - Every quest person gives a problem, a reason and a next step. Nour, Hessa and Marrow are distinct.
    Oum is the model witness.
  - Against it: the banned image, three button lines, Sefa's diagnosis, the House and Hearth names,
    and about 60 proper nouns in the first hour.
  - Protect Nour: "Then the light sang, the chest answered, and you crashed. I dislike how neatly that
    fits."
- **Vael.** 4 problems. Gesture-led and clear; Tam is a delight. Against it: Lark's five goodbyes, the
  narrator's winks, and Senn's pronoun.
- **Vael II.** 5 problems. The sisters are the best writing in their batch: "You were right about the
  tower. I was right about the bell. Come home for supper." Against it: three button lines, and Calix
  opening on "Welcome, welcome".
- **Lorn.** 7 problems. The humour belongs to the people (Corm: "Once a boot. It wasn't occupied. I
  checked."). Against it: Saba's four solemn pages over-explain the crystal, Sedge's garbled "That
  makes one of you", and a false rain choice.
- **Lorn II.** 5 problems. The most moving of the middle worlds. Fen: "I heard. Never went to fetch
  her." Hollin's promise is a model choice. Against it: the 41 years, and Hollin's lesson.
- **Viridel.** 8 problems. Esk's arc is strong and mostly obeys the guide, and Mira's flood lines are
  restrained. Against it: the "one turn" blame, "I hear you", the "both" thesis, and "the Singer"
  named casually before its reveal.
- **The City-Shaft.** 7 problems. The best-built web of conversations: Nima → Ossa → the lamp → Wren
  → Dov. Dov's token pays off four times. Against it: the button lines, a direction hidden in a pun
  ("Give it a shot"), and the repeated numbers and jokes.
- **The Sealed Hangar.** 5 problems. Each local has one concern; Lune labels her hypotheses. Against
  it: Zazie's and Ottla's mismatched answers, and two tellings of where the glyph came from that
  contradict each other.
- **The Buried Machine.** 6 problems. Warm, specific, funny (ages counted in teeth). Telling the wheel
  "the Hangar is still turning" is the best callback in the game. Against it: Dun, Hask, two
  door-oilers who swap, and the button lines.
- **The Garden of Spheres.** 4 problems. A gentle interlude. Emrys: "Can't talk. Climbing. (He is
  standing on the ground.)" Against it: Nell's broken opening, and Cael's moral.
- **The Signal Market.** 6 problems. The broadcast carries the world, and the crowd's echoes after it
  ("You are not alone, it said") are right. Against it: Sel's reply right after the reveal argues
  with the player, Doss's ungated line spoils the sign, and the button lines.
- **Home and the recordings.** Lou is right: literal, greedy, funny, never a tiny therapist. Tove has
  her one acknowledgment and one next step. The father is domestic and harsh in the right measure.
  Against it: the final recording, the gift lines, and the son's parentheses.
- **The Lantern.** 6 problems. See finding 1. Protect: "Did they stop waiting? You can say yes. I
  would have." and "Which is better. I didn't know there was a you to find."
- **The aliens.** The murmurs ("We are one Tullo, five times. It saves on chairs.") and the
  stilt-walkers hold their quirk. The drifters have none and speak human idiom, and the shellbacks'
  slowness joke leaks into a drifter.
- **The detour worlds.** Light and specific. Coralie's is the best detour script. The traces report
  before they believe, but sound alike (finding 5), and carry the timeline slips (finding 8).

## Patterns across the game

- **The traveller.**
  - Polite or practical, with the odd dry line: "Stay away from my ship.", "Stones don't fall up.",
    "Officially noted." could join them.
  - He rarely pushes back or deflects, repeats directions back ("Through the portal, the relay box,
    the ring."), and names the theme.
  - His openers recur in every world: "I'm looking for something of value", "Have you seen anything
    strange", "My ship has no power".
  - His best voice is in parentheses: "(sit with her, and say nothing)".
- **One register for every translator.** Monks, swamp folk, listeners and drifters all come out as the
  same wry British English ("Mind you", "rather", "darling", "Tuesday", "Give it a shot"). Give each
  tongue one quirk, as the murmurs and the stilt-walkers have: measuring in summers, no "I", dropped
  articles.
- **The deadpan closer** ("A difficult morning.", "Novel experience.", "A stable working
  relationship.") ends most comic pages. Charming in Wendel and Fen; thin when everyone uses it.

## Recommendations, ranked

1. **Fix the bugs and the slips.**
   - Findings 7 and 8: about 25 lines, and the stale lore docs.
   - *Cost: an hour or two. Each is a wrong line a player can notice.*
2. **Rewrite the Lantern's middle and the final recording** (findings 1 and 2).
   - *Cost: about 20 lines of writing.*
   - *Why:* the game now points everything at this scene.
3. **Build the key placeholder, then rewrite the 19 button lines** (finding 6).
   - *Cost: a small engine change plus the lines.*
   - *Why:* it is the remapping work's last gap.
4. **De-template:**
   - each culture's own name for the night;
   - the lone-woman witnesses varied;
   - the temple guides' completion lines noticing their place;
   - the cameo introductions;
   - the "wet finger" image retired.
   - *Cost: medium, world by world.*
5. **A pass on the traveller's voice:**
   - cut the theme-naming;
   - add a push-back or a deflection where scenes allow;
   - give the goodbyes tone or cut them;
   - turn the gift lines into memories.
   - *Cost: medium.*
6. **A quirk for each translated tongue,** the drifters first. *Cost: low per people.*
7. **The process:**
   - keep a voice sheet for every quest-giver (Perrine);
   - read one scene a world aloud before release;
   - rerun this review after any big writing pass.

## About the tool

The extractor now counts a person shared between a story and its level once; before, it was up to 40%
too many in some worlds. It no longer counts pages behind a condition as a monologue. Its flags are
starting points: of the 105 goodbye flags and 19 button flags, the button flags were all real; most
of the "long listen line" flags were not.
