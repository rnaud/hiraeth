# The craft of game dialogue: what the review checks against

This is research from October 2026, condensed: practitioners' talks, studios' style guides, and
interviews. The house style comes first: `lore/voice-guide.md` and `docs/systems/dialogue.md`. Where
this file and the house style disagree, the house wins (for example, at most 3 answers, with an
average of at most 2). Thresholds marked *proposed* are rules of thumb, not sourced. Sources are at
the end.

## 1. Brevity on the screen

- **Hard caps, from Failbetter (Fallen London):** a setup text of at most 30 words, an answer of at
  most 20, a result of at most 100. Their editor turns the counter red past 100, "because it's quite
  hard to tell when you're writing how far you've gone".
- **Comic lettering:** about 20–25 words a balloon (two sentences), 35 a panel. This matters for a
  game drawn like Moebius that speaks in balloons.
- **Subtitle accessibility:** at most 38–40 characters a line and 2 lines (IGDA, Game Accessibility
  Guidelines, Xbox Accessibility Guidelines 104).
- **Cutting:** a 62-word quest request cut to 20 words loses nothing (Slabinski). A Short Hike broke
  sentences "into little snippets".
- **House rule** (`lore/voice-guide.md`): one idea a page, roughly 15–45 words, shorter for repeat
  hints and children.

**Checks**
- a page over 45 words;
- a listen line or bark over 25;
- an answer over 12 words (Failbetter's cap is 20; 12 is *proposed* for a phone);
- a sentence over 25 words;
- 4 or more pages with no answer between them (a monologue);
- the key noun or verb coming after the first comma (put the important words first).

## 2. Every line does work; subtext over exposition

- **Know what a scene is for before writing it** (Jon Ingold, "Sparkling Dialogue"). People don't
  explain what both of them know. People answer what was actually said. Players have been "trained
  to ignore subtext", so the text must earn their attention.
- **"Don't tell them they're scared; scare them"** (Failbetter). Prefer direct speech. An NPC who
  drifts into exposition should be in trouble, so they get to the point. Tell what happens, "not how
  to feel about it".
- **"As you know, Bob":** give facts to a listener who needs them, in pieces.

**Checks**
- Each line carries character, information or mood. Flag a line with none.
- Flag feelings named outright ("I am so sad"), except as a chosen climax.
- Flag "as you know" and shared facts recited.
- Flag a reply that ignores the answer just chosen.

## 3. Distinct voices

- **"Character above all else"** (Slabinski). Even a minor NPC gets a personality.
- **A voice sheet per character:** tone, formality, vocabulary, tics, sentence length. It stops drift,
  in writing and in translation.
- **Groups set a register their members share,** for example a people, a trade or a temple.

**Checks**
- **The blind swap:** hide the names. Could two speakers trade lines unnoticed?
- **Two or three markers a speaker:** sentence length, a pet word or construction, how much they ask.
- **The writer's voice leaking:** the same distinctive image from two speakers in one world, or across
  worlds. The voice guide's own example is everyone describing the light as "a wet finger round a
  glass".

## 4. Answers and choices

- **Three options** is Ingold's ideal: "two is too binary as if there's a correct choice, and four
  lacks focus". Use **Accept / Reject / Deflect**: go along, push back, or turn aside without
  breaking the scene. Avoid filler ("What do you think?"). "Branching is action, action is
  character, character is drama."
- **Firewatch:** the options stay inside who the protagonist is, and many small choices are
  remembered. They were "too subtle for our own good": players thought the game was linear. Remo
  played through near-silent to check that it still made sense.
- **Telltale's "X will remember that"** charges a choice, then wears thin when nothing pays off: "a
  Chekhov's gun that never fires".
- **The paraphrase problem** (Mass Effect's wheel): the label must say what the traveller will
  actually say.
- **Expressive choices** (Kentucky Route Zero): they shape character and relationship, not plot.
  That's valid, if the next line acknowledges them.
- **Don't put "words in the player's mouth, thoughts in their head, or feelings in their heart"**
  (Failbetter).
- **House rule:** at most 3 answers, an average of at most 2. So **judge a two-answer node by whether
  it is a false binary,** not by its count.

**Checks**
- Every answer leading to the same next line with no acknowledgement at all.
- An answer out of character for the traveller: cruelty, sarcasm or snark, unless meant.
- An answer that doesn't answer the question it was given.
- Filler as one of only two answers.
- Each world: how many choices come back later (a callback, a changed line)? Flag a world with none.

## 5. No interrogations and no vending machines

- **Topic menus turn a talk into a checklist** (Ingold; "Designing Investigate Conversations"). Open
  on a beat of life. Let the NPC raise their own concern. Put a limit on the talk. Only offer
  questions the player has a reason to ask. Write authored scenes, "not drop-down menus".
- **"Care more about the needs of the character than the player"** (Inkle).
- **The house** already moved secondary questions one node deeper and cut goodbyes where every answer
  ends the talk. B / Esc always closes it.

**Checks**
- a hub of 4 or more "ask about" answers;
- a hub that returns unchanged after each answer;
- a goodbye-only answer that does no other work (an exit can carry tone: "I'll be back before the
  tide");
- an NPC whose first line is a greeting ("Hello, traveller!"): start in the middle of what they are
  doing.

## 6. Barks, listen lines and repetition

- **A bark answers a stimulus.** Ask what the player wants to know at that moment. Ambient people are
  overheard life, starting from what they are doing: "people don't make a habit of loitering on
  corners waiting to spout their unprompted musings".
- **Write many, keep few:** 100 drafts for 5–10 kept (Slabinski). Beware the bottom of a deep pool
  turning into puns and one-liners.
- **Swap the sets as the story moves on** (Splinter Cell: Conviction, Breath of the Wild).
  - **Hades:** starting from "what would the characters talk about and notice?", the game is never
    quick to repeat.
  - **Breath of the Wild:** lines for a first meeting, lines gated by quests, and lines for the time
    of day.
- **The house:** listen-only talk walks a list, never the same entry twice running, and entries can
  wait for a condition (`if`) or come as news (`after`) (`docs/systems/dialogue.md`).

**Checks**
- a person with one repeat line;
- a bark that is a whole sentence of lore;
- a person whose lines never change after their world's main beat;
- puns gathering at the end of a list.

## 7. Tone: register, humour in grief, sincerity

- **Spiritfarer:** about "10–15% dramatic to 85–90% whimsical". Lines were reworked when they were
  "too silly" as well as when they were too heavy. The writing came from the team's own losses and
  from visits to a hospice.
- **What Remains of Edith Finch:** players arrived heavy, so the team added whimsy. Edith speaking
  her feelings outright "was too much, and most players just tuned it out".
- **Quips undercut stakes** (Forspoken's "every monumental situation into a joke"). Humour is fine
  when it fits the tone.
- **Therapy-speak** ("the imprecise and superficial integration of psychotherapy language") makes
  characters nice, not real.
- **Register:** neither stilted archaism nor modern slang. Period voice is "seasoning, not an
  ingredient", and pop-culture references get "No." (Failbetter). Moebius's Arzach is wordless: let
  silence and image carry wonder.
- **The house:** humour belongs to somebody. Whole beats go without a joke (the witness, the second
  wreck, Esk's rows, the broadcast, the stone). Nobody but the ending delivers the ending's lesson.

**Checks**
- modern slang ("okay", "cool", "awesome", "vibe", "literally", "my bad", "no worries");
- therapy vocabulary ("process", "boundaries", "closure", "trauma", "healing journey", "valid",
  "space for");
- a joke within two lines of a loss, or a wisecrack in answer to sincerity;
- a world over about 30% sad or solemn, or with nothing light (*proposed*);
- the traveller naming the theme outright (value, home, loss);
- a tone tag that contradicts its words.

## 8. Alien voices and the translator

- **Outer Wilds' Nomai** are never heard, only read. Their texts are conversations between "strongly
  defined personalities", never lore cut loose from the mystery. Each points onward and back.
- **Chants of Sennaar:** a word left untranslated has to appear at least twice, in different
  situations. Each language is about 40–50 words.
- **The house:** each world speaks its own tongue (`LANGUAGES`), the translator turns it into yours a
  beat later, and Vael's Oïa has three words.

**Checks**
- a translated alien who uses human idiom, unless the translator is meant to be lossy;
- each world's one grammatical quirk (word order, dropped articles, a plural self), and lines that
  break it;
- an untranslated word heard only once;
- the translator explaining the speaker's own culture to them.

## 9. Exposition, lore, proper nouns

- **Every proper noun is "memory debt".** Defer names of history and geography. Tie names to stakes.
  Vary their first letters and lengths.
- **Failbetter:** release lore from vague to specific; generally don't answer mysteries; give one
  focal detail and hedged hearsay. Ambiguity works only "because the solid foundations are there".
- **Slabinski's "LOST school":** answer one question and raise two. Lore is a garnish.
- **The house:** use local vocabulary, then translate it once. A witness reports before believing.
  Theories belong to their speakers.

**Checks**
- more than 2 new names on first contact;
- more than about 8 a world (*proposed*);
- invented names in one world that share a first letter and a length;
- a line that answers the light, Ilen or the parents before its beat;
- lore with no tie to the player's goal, the speaker's want, or something in view.

## 10. Quest dialogue

- **A request needs a personal reason,** or it reads as busywork: "you know it's busywork, they know
  it's busywork".
- **The house's quest contract:** a local problem, a personal reason, and a next action the player can
  repeat in plain words. Give directions before mystery. A direction names a place, a landmark, a
  verb, and any order.

**Checks**
- the objective said more than once in one exchange (one in-character line plus one UI line is the
  budget);
- a request with no reason;
- objective lines that drop the voice ("Go north and press A");
- the essential what and where hidden only inside a joke, a metaphor or alien speech;
- a button named in prose. The house needs a key placeholder there, so the line follows remapping and
  the controller in hand.

## 11. Process, localisation, accessibility

- **Read it aloud:**
  - Failbetter's dialogue has to pass the "say-this-shit test";
  - table reads are a core skill;
  - A Short Hike's writer "had to leave the room" the first time his lines were read to him.
- **A voice sheet for each named speaker,** and a story bible: `lore/characters/*`, `docs/story-bible.md`.
- **Localisation:**
  - never build a sentence by joining fragments;
  - use named placeholders and real plurals;
  - note jokes, rhymes and genders for translators;
  - wordplay needs transcreation;
  - English left unmarked for gender still needs a gender in French.
- **Accessibility:**
  - at most 38–40 characters a line, 2 lines;
  - 15–20 characters a second for text that advances itself, and at least 1.5 s on screen;
  - one idea a sentence;
  - nothing essential only in a joke.

**Checks**
- strings joined mid-sentence;
- English plurals made by adding an "s";
- puns with no note for the translator;
- needless gendering;
- auto-advancing text on screen shorter than its characters ÷ 17 seconds;
- each world read aloud at least once;
- every named speaker with a voice-sheet entry.

## 12. Failure modes, in one list

- **Purple prose and cliché.** Failbetter bans "black as pitch" and "it was quiet. Too quiet."
- **Stilted archaism.**
- **Everyone sounds like the writer,** which the blind swap catches.
- **Quips undercutting stakes.**
- **Therapy-speak.**
- **Over-explaining the mystery.**
- **Lore cut loose from the mystery.**
- **Interrogation menus.**
- **Choices that are never acknowledged.**
- **A label that doesn't match the line.**
- **Repetitive barks.**
- **Fetch quests with no person behind them.**
- **Narration breaking the rhythm of a talk, and presentation that makes reading a chore,** as Sable
  was criticised for.

## 13. Story structure: Save the Cat, adapted to an exploration game

Blake Snyder's *Save the Cat!* (2005) is a screenwriting manual: a film's two hours cut into fifteen
beats, plus a handful of rules of thumb with memorable names. Its tools are useful here when they are
translated, because Hiraeth is not a film: the route is twelve worlds the player partly orders, the
middle is optional for whoever stops at the first homecoming, and the hero's choices are the player's.
The house rules still win (terse lines, no hand-offs, hints say where and never who, a tone on every
line, Plumb never explains the story). Each item below says what it is, how it reads in Hiraeth, and
how to score it 1–5. The review that uses it is the story-structure audit (`SKILL.md` §5).

**Three translation rules.**
- **Fix the spine, free the stations.** A beat that must land in order lives on a fixed point the player
  cannot skip or reorder: the prologue, the desert, the first homecoming after six worlds
  (`ENDING_WORLDS`), the Signal Market's broadcast, the Lantern, the stone. A beat placed in a world the
  player may take out of order is a finding.
- **Every world is a small beat sheet.** Landing (an opening image), a local stake visible within the
  first talk (a catalyst), the temple and the world's toys (fun and games), the world's filmed moment
  (its finale), the world changed (listen lines and `after` nodes: its final image), and the recording
  played on the way out (the B story's line for that world).
- **Optional beats need a floor.** If a beat lives in optional content (Tansy, the Market, the Lantern),
  the main path must still carry some version of it, or the player who skips meets a hole.

### The logline and the genre

- **Logline:** one sentence with the hero, his flaw, the goal, the irony that joins them and the stakes.
  If the game no longer fits its logline, either the game drifted or the logline is wrong. Hiraeth's:
  *a son who left everything half done is sent to bring back something of value, and follows a singing
  light across twelve worlds to learn the thing his parents wanted back was him.* Score: 5 a sentence
  every system serves; 3 true but a feature list; 1 none can be written.
- **Genre:** Snyder sorts stories into ten families by their working parts. Hiraeth is a **Golden
  Fleece** (a road, a team, a prize that turns out to be the change in the hero) with a **Rites of
  Passage** inside it (grief, learned late). A Golden Fleece needs distinct stations on the road (each
  world teaching something), a team (Plumb, Tansy, the reel, Lou by post) and the prize re-read at the
  end. Score how many of the genre's parts are carried on the main path.

### The fifteen beats, mapped

| Beat | What it does | Where it lives in Hiraeth | Check |
|---|---|---|---|
| Opening Image | the world and the hero before the change | the prologue: alone in a dark cockpit with a disappointed voice | is it the opposite of the final image? |
| Theme Stated | someone else says the lesson early; the hero does not hear it yet | the "something of value" answer in a world's first talk; the empty tank the makers give | said by a minor speaker, not the hero, before the midpoint |
| Set-Up | the hero's world and flaws; the things that need fixing | the father's charge, "you leave everything half done", the half-built house, the unknocked door | each flaw planted is paid off at home |
| Catalyst | the event that knocks the life over | the light drains the ship | one clear event, shown, early |
| Debate | can he, should he? | the desert: can the ship fly again; the follow line is his choice | the question is plain; not longer than it earns |
| Break into Two | the hero chooses the new world | the first takeoff, picking a world on the map | his choice, not an order |
| B Story | the relationship that carries the theme | the reel (the parents), Tansy, Lou's drawings of his cards | present from the break, on the main path |
| Fun and Games | the premise's promise | worlds two to six: wings, temples, strange people | each world delivers a new toy and a new place |
| Midpoint | false victory or false defeat; stakes up; a clock appears | the first homecoming: the stone, Lou, the light over the hill, "once more" | stakes and a clock both rise here |
| Bad Guys Close In | pressure from outside and inside tightens | worlds seven to eleven | each world after the midpoint presses harder than the one before |
| All Is Lost | the low point; a whiff of death | the broadcast and "For when he asks": the sister who never came home | something ends, felt, on the way to the finale |
| Dark Night of the Soul | the hero sits with the loss | "Not here. Not yet." | a pause the player feels, not one line |
| Break into Three | A and B stories meet; the way out | the light's trace past the Market: the light, Ilen and the father's message are one | the answer comes from the B story |
| Finale | the lesson used as the method | the Lantern: answering the light with his own breath, empty hands | the last verb is the theme, not a stronger weapon |
| Final Image | the opening image, changed | the stone: the oldest recording, Lou's "Was that you?" | it mirrors the opening image |

Score each beat 1–5: 5 present, placed on the spine, shown and paid off; 4 present with one weakness
(placement, length, or told rather than shown); 3 present but optional, out of order or thin; 2 implied
only; 1 missing or contradicted.

### The rules of thumb

- **Save the cat:** early, the hero does something kind that costs him, before he asks for anything, so
  we want him to win. In a game: the first required errand helps someone (Ama's empty jar for the
  pilgrims), and his first answers in a world show who he is. Check the first talk of every world: does
  he give, or only ask? Score 5 a kindness on the main path in the first minutes; 3 only in optional
  errands; 1 his first acts are all self-interest.
- **Pope in the pool:** exposition rides on something entertaining happening at the same time (a joke, a
  task, a spectacle). Check every lore page: what else is going on? Score by the share of lore pages
  carried by a joke, a task or a sight.
- **Double mumbo jumbo:** an audience accepts one piece of magic per story. Hiraeth's is the makers:
  the giants, the boxes, the backpack, the temples and the singing light all trace back to them. A
  second, unrelated magic is a finding. Score 5 everything traces to the makers; 3 one system floats
  free; 1 several.
- **Laying pipe:** too much setup before the story starts. Measure the steps and minutes before the first
  takeoff, and separate tutorial pipe (teaching a verb) from story pipe (explaining a world). Score
  against the other worlds' main quests.
- **The black vet:** one idea asked to do too many jobs (a hook stacked on a hook). Check the light and
  Plumb: each job added must be one the player can feel. Score 5 each device has one or two jobs; 3 a
  device carries four or more; 1 the jobs contradict.
- **Watch out for that glacier:** a danger that approaches too slowly to frighten anyone. Stakes must be
  present now. With no timers, each world's local stake must be visible on landing (a cold tree, a
  stopped clock, Tooth Day today), not reported as old news. Score by the share of worlds whose stake
  is on screen in the first talk.
- **The covenant of the arc:** everyone in the story changes, the hero most. In a game: the givers have
  `after` nodes, the listen lines change after the beat, the father changes across the reel. A speaker
  who stays fixed on purpose (Plumb, a plumb bob that shows which way is true) is noted, not marked
  down. Score by the share of named speakers in a world who change.
- **Keep the press out:** the story stays among the people living it; when the whole galaxy starts
  commenting, it stops being theirs. Fame stays local (Qanat's songs, a harbour's book). Score 5 no
  outside audience; lower for galaxy-wide renown.
- **The hero leads:** the hero acts from desire, not instruction; he is never told his goal by someone
  else. This is the house's own rule in other words: following the light is his choice (`FOLLOW_LINE`),
  nobody hands him to somebody else (quest-qc rule 2), and his answers say what he will do ("I'll go and
  see"), not only "thank you". Score by the share of a world's quest answers in which he decides.
- **Don't make the bad guy too bad; make him worse:** the opposition must be strong enough to be worth
  beating, and grow. Hiraeth has no villain: the opposition is time (the parents are gone), distance,
  and his own habit of leaving things half done. "Make it worse" here means the flaw costs him something
  after the midpoint and the reel stops being comfortable. Score 5 the inner opposition rises to the
  finale; 3 it is set up and paid off but flat in between; 1 nothing opposes him.
- **Talking the plot:** characters say what the story means or what they feel instead of showing it. It is
  craft.md §2's subtext rule. Two exceptions: quest steps and instructions stay plain (the house rule),
  and a letter or recording may state what its writer could never say aloud. Score by findings per
  hundred pages.
- **Primal:** the stakes should be ones a caveman would get: home, parents, a child, a sister, water,
  light, warmth. Check each world's local stake for the same. Score 5 every stake is primal; 3 some
  worlds' stakes are abstract (a ledger, a schedule); 1 the stakes need explaining.

## Sources

**Failbetter**
- https://www.failbettergames.com/useful-posts-for-writers/
- http://www.failbettergames.com/fallen-london-writer-guidelines-part-iii/
- http://www.failbettergames.com/points-of-light-pools-of-shadow-part-i/
- https://www.inverse.com/article/28228-failbetter-games-interview-sunless-skies

**Inkle and Jon Ingold**
- https://www.blog.radiator.debacle.us/2018/11/notes-on-sparking-dialogue-great.html
- https://www.gamedeveloper.com/design/designing-investigate-conversations
- https://punishedbacklog.com/interview-jon-ingold-inkle-studios/
- https://kotaku.com/developer-shows-how-to-write-good-game-dialogue-using-b-1830797912

**Craft**
- https://www.gamedeveloper.com/game-platforms/8-key-principles-of-writing-effective-game-dialogue
- https://www.helpingwritersbecomeauthors.com/as-you-know-bob/

**Barks**
- https://www.thenarrativedept.com/blog/barks
- https://www.gamedeveloper.com/design/adding-life-to-worlds-with-dialogue-barks
- https://kotaku.com/why-video-game-characters-say-such-ridiculous-things-5921878

**Quests**
- https://www.narrativedesign.net/p/write-video-game-quests

**Hades**
- https://www.gameshub.com/news/features/hades-greg-kasavin-breaks-down-supergiants-unique-approach-to-narrative-262459-2193/

**Choices**
- https://www.thegamer.com/mass-effect-dialogue-wheels-are-flawed/
- https://www.criticsatlarge.ca/2014/10/illusory-choice-memory-and-consequence.html
- https://www.thegamer.com/firewatch-linear-choices/
- https://gamingbolt.com/firewatch-interview-into-the-woods
- https://rhizome.org/editorial/2013/aug/27/kentucky-route-zero-adventure-appalachian-limbo/

**Outer Wilds**
- https://static1.squarespace.com/static/54ad82b4e4b09209a614c362/t/5c64ff82e79c702fc1349943/1550122883891/beachum_foundtext_breakdown.pdf

**Chants of Sennaar**
- https://www.gamedeveloper.com/design/immersing-players-in-the-culture-of-a-people-with-language-puzzler-chants-of-sennaar

**Spiritfarer**
- https://www.pockettactics.com/spiritfarer/interview
- https://www.gamespot.com/articles/spiritfarer-creative-director-when-creating-art-you-have-to-be-vulnerable/1100-6494493/

**What Remains of Edith Finch**
- https://www.relyonhorror.com/in-depth/interview-developer-ian-dallas-on-what-remains-of-edith-finch/

**Sable**
- https://www.siliconsasquatch.com/blog/2021/10/8/review-sable

**A Short Hike**
- https://mcvuk.com/business-news/the-first-time-somebody-was-reading-the-dialogue-i-had-to-leave-the-room-i-was-too-embarrassed-how-adamgryu-overcame-writers-block-and-creative-burnout-in-the-development-of-a-short/

**Tone**
- https://www.denofgeek.com/games/forspokens-dialog-debate-controversy-examples/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12583418/

**Proper nouns**
- https://maxonwriting.com/2022/09/26/being-a-better-writer-the-problem-with-proper-nouns-in-sci-fi-and-fantasy/
- https://mythcreants.com/blog/questions/what-should-i-avoid-while-creating-names-in-fantasy-cultures/

**Comic lettering**
- https://blambot.com/pages/comic-book-grammar-tradition

**Accessibility**
- https://gameaccessibilityguidelines.com/if-any-subtitles-captions-are-used-present-them-in-a-clear-easy-to-read-way/
- https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/104
- https://igda-gasig.org/how/game-accessibility-top-ten-se/

**Localisation**
- https://allcorrectgames.com/insights/how-to-localize-a-game-with-procedurally-generated-text/
- https://crowdin.com/blog/game-localization

**Story bibles**
- https://www.gamedeveloper.com/design/building-a-basic-story-bible-for-your-game

**Story structure**
- Blake Snyder, *Save the Cat! The Last Book on Screenwriting You'll Ever Need* (Michael Wiese, 2005), and its sequel *Save the Cat! Goes to the Movies* (2007) for the ten genres.

**Weakly sourced** (weigh lightly): the Hades priority pools (a fan's post), the advice on alien
speech (generator sites), therapy-speak in fiction (an essay).
