# Conversations, voices and scripts

Conversation nodes and answers, listening, highlights, alien voices and the translator, the worlds' scripts, the conversation camera.

## Conversations: at most three answers

No conversation node offers more than three answers at once, and almost all offer
one or two (the few threes are real decisions: what to tell Ilo, what to say to
Sel, which stone goes on Tiv's cairn). Secondary questions sit one node deeper
instead of all on the greeting, and a goodbye is left out where every answer
already ends the talk (B / Esc always closes it). `tests/dialogue-choices.test.js`
walks every tree in the game, tries every combination of the conditions on a
node's answers (flags, items, quest stages, function conditions), and checks the
cap, the average (at most two) and that no node was stranded by the trimming.

## People outside the quests only talk

Bystanders and the crowd ask you nothing: you listen. Their talk is
`talk: { listen: [...] }` instead of nodes (`src/story/dialogue.js` `pickListen`):
each talk says one entry (a line, or two or three lines) with no answers, and the
next press closes the panel. Talk again for the next entry, round the list, never
the same one twice running; where they are in it is kept in the save
(`heard.<id>`, or `heard.<person.heard>` for crowd people, who share a zone's id).
An entry can wait for a condition (`if`, a hint that goes stale once the box is
opened or the quest done) or be news (`after`: said first, once, as soon as it
holds; the temple woken, the world's main quest done), and can carry effects
(`do`: Bako plays his ney). The lines are hints about real things in the world
(where a box sits, the trick of a puzzle, the temple's door), the world's own
wisdom, brush-offs and jokes. Quest people (anyone whose talk gives, starts,
advances or reads a quest step) keep their conversations. `tests/listen.test.js`
checks that every bystander and crowd person is listen-only, that their lines
have tones, fit one to three lines, vary and react to progress.

## Answers: the mark in its own column

An answer is a flex row (`choiceHtml`): a fixed column for its mark, then its
words, which wrap beside the mark and never under or over it. The column holds
three marks stacked in one grid cell and the body's input class shows one: the
keyboard's number, a plain › for touch, and with a controller the confirm
button's badge (`confirmKey()`, renamed by `native-pad.js`) on the focused
answer and › on the others. The old mark shrank its `font-size` to 0 to swap the
number for a `::before` mark, which took its `em` width down to nothing, so on
the Retroid (touch and controller at once) the mark sat on the answer's first
letters.

## Alien voices and the translator
- `src/story/voice.js` plans each line's syllables (pitch path, formants, timing), the
  same alien syllables for the same word in a given tongue; `src/audio.js` renders them
  on a `voices` bus. Dialogue syllables play as the text reveals; balloons and crowd
  shouts play short versions (at most two at once, silent past 26 m); calls are voiced
  through the one hook in `cinema.say`.
- **Tones** (`src/story/tone.js`): every line is tagged, `'~sad~ …'` or `{ text, tone }`,
  from `neutral, happy, sad, angry, scared, surprised, curious, tired, solemn, playful,
  whisper, shout`. Tags are stripped wherever text is shown, and `tests/tone.test.js`
  checks every line in the game has one.
- **Tongues** (`LANGUAGES`, by level id): Qanati, Shaft cant, the Vael hush, cloud-monk
  chant, Hangar clatter and so on, each written in its own script (*The worlds' scripts*
  below). The traveller's translator turns the words into yours a moment after they are
  said (no label: the effect says it).

## The worlds' scripts
`src/story/scripts.js` writes a line in the speaker's script; the dialogue panel shows
each word in it as it is said and turns it into English a moment later
(`revealHtml` in `src/story/dialogue.js`: a word turns `LAG` letters after it is said,
its English fading in under its glyphs over `FADE` more; 5 and 5, docs/systems/conversations.md).
- **One script a world** (`SCRIPTS`, by tongue): Qanati, a cursive abjad joined along the
  baseline, right to left (the desert); runes with dots between words (City-Shaft); a
  bird's track a word, a dot for each word the voice leaves out (Vael); an abugida
  hanging from a headline (Vael II); stamped stencil letters (Hangar); gear teeth on a
  rail, right to left (Buried Machine); a vine with leaves and buds (Viridel); round
  logograms (Spheres); knots on a cord (Lorn); lamps on a cord, right to left (Lorn II);
  a sign-painter's alphabet that underlines names (Signal Market); a shorthand (the
  atelier). Home speech and the ship need no translation (`scriptOf` → null).
- **Like a real script**: 20–40 glyphs each, built from a few base strokes and marks.
  A word is always written the same way (hashes, no randomness), so words recur. Letter
  scripts use a cipher giving the commonest letters the simplest glyphs; syllable and
  word scripts pick with a Zipf weighting. Each script has its own punctuation.
- **No reflow**: the panel's font is monospaced, so each run of non-blank characters
  (`lineChunks`) is drawn as an inline `<svg>` exactly as many `ch` wide as its English.
  Inside that box a script lays out its glyphs its own way: one a letter, consonants
  stretched along a joining stroke, one logogram a word. Stage directions and narration
  aren't spoken, so they show in English at once.
- **Cheap**: a word is one svg with two paths (strokes, fills), ink and stroke inline,
  cached; only the two or three words near the caret are drawn, and the panel's HTML is
  only replaced when it changes. Plain SVG and CSS, so it works on old Android WebViews.
- **The test page**: `tools/tongues.html` on the dev server shows every script with a
  sample line, the same line half said, and its glyphs (`?still`, `?only=desert`,
  `?size=30`). `tests/scripts.test.js` checks every world has a script, determinism, the
  word boxes, the frequency weighting and the translator's timing.

## Highlights in the dialogue
- **`*words*` in the story text are highlights**: the places to go or remember, the next
  thing to do, key items and the hint that solves a puzzle ("Go to *the back gate*",
  "*Fill the jar*"). `formatText` (`src/story/dialogue.js`) draws them bold in a warm red
  on a pale yellow mark, in the panel, in the choices and in the balloons over people and
  the crowd (`npc.js` / `crowd.js` use `formatText` too, so no star ever shows).
- **A long span is a quotation** (`isQuote` in `src/story/voice.js`: more than eight words,
  or more than one sentence): a letter or a recording, drawn as before (`em.quote`, the
  yellow mark only). Narrated things voice only their quotations, never a highlight; the
  broadcast (`narrator: true`) voices every starred word.
- **Writing them**: a few words, no wording changes, the tone tag and `{motifs}` outside
  the stars; usually one or two per page that gives a direction, none in flavour or lore.
  `tests/highlight.test.js` checks that every star in the story data pairs up.

## Keys in lines (October 2026)
- **A line never names a button.** It writes the verb as a placeholder, `{key:aim}`, and
  the player reads the input in their hands: "aim with R or the right mouse button" on a
  keyboard, "LT / L2" on a controller (a Retroid's own "L2", a Nintendo-style pad's
  letters), "◎" on a touch screen, always the key or button the player bound it to
  (`src/remap.js`). The gun's push is `{key:mode}`: the D-pad on a pad, never X.
- **Verbs** (`verbKey` in `src/prompt-keys.js`): `move`, `look`, `jump`, `interact`, `aim`,
  `fire`, `mode`, `blade`, `guard`, `evade`, `lock`, `call` (whistle the mount or a taxi),
  `gadget`, `whistle` (the bell-note), `thrust` (the jets), `run`, `scout`. An unknown verb
  shows as its own word.
- **Where it works**: everything that goes through `formatText` (the panel, its choices,
  things you look at, balloons), the toasts, hints and objective card (`src/ship/cinema.js`),
  the cue and the scout's find (`badgeLine`, `keysHtml`), the game menu's quest steps and item
  cards, the box card, the trials' rewards and the items page. As HTML it is a
  `<kbd class="kp pad-raw">`: the name is already the bound one, so native-pad.js does not
  rename it again, only into a handheld's names. `{glyph}` and the other motifs are apart.
- **Re-drawn when the input changes hands**: the conversation panel and the balloons keep a
  `keySig()` (the input kind and the bindings) and draw a line holding a placeholder again
  when it changes (a pad picked up mid-conversation). A toast is resolved as it shows.
- **The voice skips it** (`spokenMask` in `src/story/voice.js`), the speaker's script leaves
  it out (`lineChunks`), the reveal never shows half of one, and the i18n tables keep it
  (`t()` fills only `{word}` names). Keep it outside the `*stars*`.
- `tests/key-placeholder.test.js` checks the resolution, and that no line in the story data,
  no item card and no toast names a button in prose.

## The conversation camera keeps a clear view

`src/story/shot.js` picks where the camera stands while you talk to someone or look at
something, so nothing comes between it and what it frames. `pickTwoShot` (talking) and
`pickLookShot` (a thing: no two-shot, the camera behind the traveller's shoulder looking past
them at it) each try a fan of candidate eyes: both sides, several angles round the pair,
distances and heights, and over the shoulder as a last resort. Each is scored by
`sightOf(physics)`: rays from the eye to the faces (or the thing) against the level's BVH and
the heightfield, a ball test for an eye pressed into a wall, bystanders' capsules (NPCs and
crowd people near you) and the two people's own bodies (the traveller's back must not hide
the other face or the thing); every step away from the ideal framing costs a little. The
cheapest wins. `Dialogue.frameCamera` asks again every 0.6 s (people walk into shots); a small
change is eased, a new angle is a cut (never a swing round the pair; docs/systems/conversations.md), and pulls the camera in along a line it was scored on if something still
cuts it. A thing whose `at` is only where you stand (the foot of the stone hand) passes the
part to look at as `dialogue.start(def, null, at, look)`. While a conversation is open
`player.faceToward` turns the traveller to the person or the thing (to `look` when there is one, else
to `at`: so a thing asked from a spot beside it must pass its `look`, or he turns to that spot. Qanat's
well is asked from the terrace 3.4 m out from its middle; standing between there and the rim he turned
his back on it. It passes `wellInside`, down the shaft: `tests/desert-story.test.js`).

## The speaker's portrait, and when it comes back empty (October 2026)

The circle at the panel's corner is a shot of whoever is speaking, alone against one flat colour of
the world's (`src/story/index.js` `portrait`, `src/story/portrait-bg.js`, `main.js captureView` with
`keep`, `backdrop` and `css`). `captureView` renders the frame and then reads the WebGL canvas with
`drawImage`; the renderer has no `preserveDrawingBuffer`, and some drivers hand that read back empty.
An empty portrait used to show as a flat disc of the world's backdrop with nobody in it (reported on
the Retroid, in its own Chrome). `captureView` now measures a portrait before returning it — every
pixel clear, or every pixel the same colour, means the capture came back empty — and returns nothing,
so the panel falls back to the speaker's initial on their colour, as it does when there is no
renderer at all.

`node scripts/portrait-check.mjs [--level …] [--preset …] [--dpr …]` opens a world in a headless
Chrome against the production build, talks to the four nearest people and measures each chip: a drawn
person is hundreds of distinct colours with no colour over about half the pixels. On the Mac's GPU at
the Handheld preset and device pixel ratio 2 — the device's preset and ratio, and the same Chrome
version — the portraits draw. So the preset and the ratio are not the fault; what is left to suspect
is the driver's canvas read. The fallback is also the test: if the circle on the device now shows the
initial letter, the capture is coming back empty there.
