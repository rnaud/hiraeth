---
name: dialogue-review
description: Review Hiraeth's dialogue and narrative tone — every conversation, listen line, recording and temple guide — against the house voice guide (lore/voice-guide.md) and the craft of game writing (craft.md beside this file): brevity, subtext, distinct voices, choices that matter, barks, tone in grief, alien speakers, lore load, quest clarity, localisation; and the story's structure against Save the Cat's beat sheet and rules of thumb (craft.md §13: logline, save-the-cat moment, the fifteen beats on the route, pope in the pool, talking the plot, the covenant of the arc). Quest structure (steps, hand-offs, straight to the end) and whether each answer follows from what was just said are quest-qc's. Writes docs/audits/dialogue-v<version>.md with findings and rewrites, or docs/audits/story-structure-v<version>.md for the structure. Use when asked to review, critique or improve the dialogue, the writing, the tone, a character's voice or a world's script, or the story's structure, arc, beats or pacing ("Save the Cat").
---

# The dialogue review

A reading of what people say, by an editor who knows the house style and the craft. It is not a
grammar pass. Every finding quotes the line, says where it is (file and node), names the problem in
the terms of `craft.md` or the voice guide, and offers a rewrite in the speaker's voice. Each review is
`docs/audits/dialogue-v<version>.md`.

## 1. Read before reading the script

These come in a fixed order, and the house rules win over the general craft where they disagree:

1. **The house:** `lore/voice-guide.md` (the conversation contract, humour, mystery, the traveller's
   answers, the recordings, the text conventions), `docs/systems/dialogue.md` (at most 3 answers,
   listen-only bystanders, tones, tongues), `lore/README.md`.
2. **Who speaks:** `lore/characters/*.md` (the voice sheets), `docs/story-bible.md`, `LORE.md`,
   `lore/continuity.md` (facts that must not change).
3. **The craft:** `craft.md` beside this file, with thirteen sections of principles and checks (§13 is the story's structure: Save the Cat, adapted).
4. **The last review,** `docs/audits/dialogue-v*.md`, if there is one: recheck its findings first.

## 2. Extract the script

```sh
node .claude/skills/dialogue-review/extract.mjs <scratch>/dialogue [--worlds desert,incal]
```

The script imports the story data, as the tone test does; it never runs the game. It writes
`<world>.md`: each speaker's conversation nodes, their pages with tones, and the answers with where
they lead. It also writes `metrics.json`: per world the pages, the words a page, the tone mix, the
one-tone speakers, the proper nouns, the node flags, and the phrases said by three or more different
speakers.

It flags what can be measured (⚑):
- long pages, hints, answers and sentences;
- monologues;
- greetings as the first line;
- goodbye-only answers;
- buttons named in prose;
- slang and therapy-speak;
- as-you-know exposition;
- heavy worlds.

**The flags only say where to look.** A long page may be the right page, and a goodbye may carry a
farewell that matters. Judge every flag against the craft before reporting it.

**Clarity (issue #626, the author: "All characters should speak in a way that makes it easy to understand them"):**
`node .claude/skills/dialogue-review/clarity.mjs <scratch>/dialogue <scratch>/clarity.json` scores every speaker 1–5
on sentence length, long words, figures of speech, objects given wants ("that plate wants a weight"), pages opening on
a pronoun and help nodes with no imperative. It points; the scores in a review are an editor's. Plumb is not in the
extract: read `src/companion.js`, `src/temples/hints.js` (and each guardian's `asks.lines`) and the ship's lines
(`src/story/signature.js`, `src/ambush.js`, `src/ship/cinematics.js`, `homecoming.js`, the `PLUMB(…)` lines of
`src/story/calls.js`), and hold every Plumb line to a ten-year-old's first read. The ledger per speaker is
`docs/audits/clarity-v<version>.md` (the first: v2.27).

## 3. Read like an editor

Read each world's script whole, speaker by speaker. Read every recording, the ending's lines
(`src/story/ending.js`: the stone, the choices, Ilen) and the Lantern (`src/story/lantern-data.js`)
too. Most of all, check what can't be measured:

- **Knowledge belongs to the speaker:** for every proper name, destination, motive or revelation,
  identify what that speaker has actually observed or been told before this line. Check fresh arrival,
  optional conversations skipped, and returning saves. A catalogue label, visited-world flag or another
  character's knowledge is not evidence. Plumb may point out a person, smoke, gate or signal to explore;
  it must not introduce an unknown person's name or a place's secret history. Use an observable
  description until an explicit introduction, rumour or quest step supplies the fact. Keep uncertainty
  explicit. Review hint toasts and lost-direction barks as well as dialogue pages. Do not fix a leak by
  granting knowledge flags or changing progression gates.
- **The conversation contract:** does each talk give a person to care about, something to try, or a
  question worth pursuing? Is a quest's next step plain enough to repeat aloud?
- **Plain instructions first:** state the observable problem or requested action before adding imagery.
  A player should be able to repeat the next step after one reading. Replace cryptic fragments,
  vague pronouns and personified mechanisms when they obscure an instruction; preserve character
  humour, terse voices and optional mystery. Do not add route facts or knowledge to make a line clearer.
- **The blind swap:** hide the names. Could two speakers in a world trade lines? Check each speaker
  against their sheet in `lore/characters/`.
- **The writer's voice leaking:** the same image from different mouths. Start from `metrics.json`'s
  repeated phrases: "the night the sky rang", told by twelve detour witnesses, is the voice guide's
  "wet finger round a glass".
- **Subtext:** feelings named outright, people explaining what both know, replies that ignore the
  answer just chosen.
- **The traveller's answers:**
  - Are they his: curious, decent, sometimes defensive, able to be funny?
  - Does each label say what he says?
  - Is there accept, push back and deflect where the scene allows it, or only politeness?
  - Is a two-answer node a false binary?
- **Quest givers and answers that follow:** the quest QC skill's rules (`.claude/skills/quest-qc/`); flag them there.
- **Choices remembered:** what comes back later, and where nothing does.
- **Tone:**
  - whole beats without a joke where the guide asks for them;
  - no quip after a loss;
  - no ending's lesson spoken early by an ordinary person;
  - each world's mix (Spiritfarer's 10–15% drama is a reference, not a rule);
  - each tag fitting its words.
- **Mystery has evidence:** a witness reports before believing. Nobody declares what the light is
  before the Lantern, and nobody declares what happened to the parents before the recordings show it.
- **Aliens and the translator:** one consistent quirk for each tongue, no human idiom unless the
  translator is lossy, and Oïa's three words.
- **Lore load:**
  - new names on first contact;
  - names in a world that are too alike;
  - lore with no tie to what the player wants or sees.
- **Listen lines:**
  - a fragment, not a lecture;
  - changes after the world's main beat;
  - no puns piling up at the end of a list.
- **Localisation and access:**
  - no sentences joined from fragments;
  - placeholders kept (`{glyph}`);
  - jokes and rhymes noted for the translator;
  - nothing essential only in a joke;
  - buttons named through the key system, never in prose (the remapping and the controller in hand
    must show).
- **Read aloud:** at least one scene a world. Note where the tongue trips.
- **Structure at the line** (craft.md §13), checked in every dialogue review, not only the structure audit:
  - **save the cat:** in each world's first talk, does he give or only ask? A line that credits him with
    a kindness he never did ("asked for nothing" after he asked for power) is a finding;
  - **talking the plot:** a speaker naming the theme or their feelings outright, outside a letter or a
    recording, is a subtext finding;
  - **pope in the pool:** a lore page with nothing else happening (no joke, task or sight);
  - **theme stated:** each world's answer to "something of value" in its own terms, never the ending's
    lesson word for word.

## 4. Write `docs/audits/dialogue-v<version>.md`

Start the report with its score block, right under the title (an HTML comment GitHub hides; the audits page,
`audits.html`, reads it: `src/audits-page/parse.js`, docs/systems/ui.md "The audits page"):

```
<!-- audit-scores
overall: the mean of the areas / 5
label: the mean of the twelve areas
date: YYYY-MM-DD
-->
```

Keep the score tables as Markdown tables with one row per area and the 1-5 scores in their own columns (a
"total" or "Mean" column for the row's mean; a change by eye as `4 ✎3`, before and after as `2 → 3`): the
page draws them as bars and compares them with the last report's by the row's name and the column's header,
so keep both the same from one report to the next. `node --test tests/audits-page.test.js` checks the block.

- **The setup:** the version, the date, the corpus from `metrics.json`'s totals (lines, pages,
  answers, worlds), and what was read whole and what was sampled.
- **Scores from 1 to 5,** each with its evidence, for:
  - brevity;
  - subtext;
  - distinct voices;
  - the traveller's voice;
  - choices;
  - listen lines;
  - tone;
  - mystery;
  - aliens;
  - lore load;
  - quest clarity;
  - localisation.
- **The ten findings that matter most,** each with:
  - the line quoted, with its file and node;
  - the problem, named in `craft.md`'s or the voice guide's terms;
  - a rewrite in the speaker's voice, keeping the `~tone~`, the page count in timed scenes, the
    placeholders and the facts in `lore/continuity.md`.
- **By world:** a short paragraph each, plus the counts of its flags.
- **Patterns across the game:** repeated images, a register drifting, one-tone speakers, the
  traveller.
- **What was fixed since the last review.**
- **Recommendations, ranked,** with the cost of each: lines to rewrite, voice sheets to write, a key
  placeholder to build.

Add the file to the `docs/audits/` line of `docs/README.md`.

**Change no dialogue unless asked.** If asked to apply the rewrites:
- keep the tone tags, so `tests/tone.test.js` still passes;
- keep the answer cap, so `tests/dialogue-choices.test.js` still passes;
- keep the listen rules, so `tests/listen.test.js` still passes;
- keep the openers and exits fixed (no first line on the speaker's own name, no bare goodbye), so
  `tests/dialogue-voices.test.js` still passes;
- change no ids, conditions or effects;
- add a changelog line for players (CLAUDE.md), in plain words, e.g. "Rewrote the Glass Dunes'
  conversations: shorter, and each witness tells the light their own way".

## 5. The story-structure audit (Save the Cat)

When asked about the story's structure, arc, beats or pacing, or to rerun it, write
`docs/audits/story-structure-v<version>.md` (the version from `src/changelog.js`'s newest entry):

1. **Read:** `docs/game-brief.md`, `docs/story-bible.md` ("The thread", "The recordings", "The ending"),
   `lore/continuity.md`, craft.md §13, the last story-structure audit (recheck its findings first).
2. **Measure:** extract the script (§2); `node .claude/skills/quest-qc/check.mjs --all` for each main
   quest's steps (laying pipe); per world, the speakers with an `after` node or changed listen lines (the
   covenant of the arc); the first talk of each world (save the cat, theme stated, the local stake). Read
   the spine whole: the prologue (`src/story/charge.js`, `src/story/signature.js`), the desert's
   main path, the recordings (`src/story/calls.js`), the first homecoming and the stone
   (`src/story/ending.js`), Tansy (`src/story/fellow-data.js`), the Market's broadcast, the Lantern.
3. **Write,** with the score block (`overall:` the mean of all scored rows; `label:` what it is the mean of):
   - the logline and the genre, scored;
   - the fifteen beats: a table with *where it lives*, *on the spine or optional*, a 1–5 score and the
     evidence (file and line);
   - the rules of thumb: a table, 1–5 each, with evidence;
   - the worlds as small beat sheets: a row per route world (local stake on landing, theme stated, the
     moment, speakers changed after, the recording), marking the gaps;
   - **recommendations, ranked,** with cost and an example rewrite in the speaker's voice, keeping the
     tones and the house rules; mark which are small safe line changes and which are design work for the
     author.
4. Apply only the small safe line changes if asked (the same rules as §4's rewrites: tones, ids,
   conditions and tests unchanged, a changelog line). Story changes stay recommendations: the author
   writes this game's story.

Add the file to the `docs/audits/` line of `docs/README.md`.

## 6. Tell the user

- the scores;
- the three worst patterns;
- the ten findings, with one rewrite shown in full;
- what you would rewrite first.

Offer the rewrites as work; don't start them unasked. The author writes this game's voice: present
rewrites as proposals.
