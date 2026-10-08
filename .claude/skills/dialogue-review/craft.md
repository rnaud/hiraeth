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

**Weakly sourced** (weigh lightly): the Hades priority pools (a fan's post), the advice on alien
speech (generator sites), therapy-speak in fiction (an essay).
