---
name: dialogue-review
description: Review Hiraeth's dialogue and narrative tone — every conversation, listen line, recording and temple guide — against the house voice guide (lore/voice-guide.md) and the craft of game writing (craft.md beside this file): brevity, subtext, distinct voices, choices that matter, barks, tone in grief, alien speakers, lore load, quest clarity, localisation. Writes docs/audits/dialogue-v<version>.md with findings and rewrites. Use when asked to review, critique or improve the dialogue, the writing, the tone, a character's voice or a world's script.
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
3. **The craft:** `craft.md` beside this file, with twelve sections of principles and checks.
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

## 3. Read like an editor

Read each world's script whole, speaker by speaker. Read every recording, the ending's lines
(`src/story/ending.js`: the stone, the choices, Ilen) and the Lantern (`src/story/lantern-data.js`)
too. Most of all, check what can't be measured:

- **The conversation contract:** does each talk give a person to care about, something to try, or a
  question worth pursuing? Is a quest's next step plain enough to repeat aloud?
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
- change no ids, conditions or effects;
- add a changelog line for players (CLAUDE.md), in plain words, e.g. "Rewrote the Glass Dunes'
  conversations: shorter, and each witness tells the light their own way".

## 5. Tell the user

- the scores;
- the three worst patterns;
- the ten findings, with one rewrite shown in full;
- what you would rewrite first.

Offer the rewrites as work; don't start them unasked. The author writes this game's voice: present
rewrites as proposals.
