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

## The panel reads at a glance (issue #147, October 2026)

After the author compared it with Sable's: the words bigger, shown whole, and the answers lighter.
- **The type from the screen's height**: everything in `#dialogue` (index.html) is in em of `--dlg`,
  `clamp(17px, 2.9vh, 46px)` times the text size: 21 px at 720, 23 at the Deck's 800, 31 at 1080, 42 at
  1440 (15 and 19 px before), never under 17 px (the Retroid's 410 CSS px). The panel is 46 em wide, about
  64 letters a line; the portrait, the name (1.05 em), the answers (0.95 em) and the page-turn mark
  scale with it. A phone held upright takes it from the width (`clamp(15px, 4.5vw, 22px)`). A screen
  480 px tall or less sets the lines a little closer and the panel lower.
- **Never off the screen**: the box grows with the page rather than the type shrinking, but a page and
  its answers too tall for a short screen (the longest node on the Retroid, a big text size) are drawn
  just small enough for the portrait's top to stay in view (`Dialogue.fit`, `--fit`).
- **The page whole, at once**: no letters typed, no caret, no words turning out of the speaker's script.
  The voice still says the page at its own pace (`revealed` is the voice's place in it: syllables, mouths,
  the camera's coverage), the answers are there with the words, and a press turns the page or picks an
  answer straight away (it used to finish the line first). The translator's only trace is a 0.3 s fade
  of a foreign speaker's page as it comes (`.dlg-text.heard`; none with Reduce motion). The engines'
  panel gets the page whole too (`screen.dialogue.shown` its length, `done` true): the Unity bridge's
  `BridgeHud.cs` uses the same sizes on its 720-tall canvas.
- **Answers without boxes**: their words on the paper in a softer ink, the red mark beside each; the
  one under the pad, the mouse or a finger in full ink with a red ink line under its words. Nothing
  moves when one is picked. `tests/dialogue-legibility.test.js`.
- **The name, plain** (issue #208): the speaker's name in bold ink capitals on the paper's first line,
  beside the portrait (`.dlg-tag`, 1.05 em): no black caption box, nothing slanted, and no subtitle (a
  person's `title` is no longer shown, nor sent to an engine's panel; `BridgeHud.cs` draws it the same).
- **The first answer by default** (issue #211): when the answers come up, the first is focused whatever
  is in hand (it was only with a pad, and lost when one node's answers led straight to the next's), so
  E, Enter or A / × says it; the mouse over another moves the focus there, so the underlined answer is
  always the one a press picks.

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
  same alien syllables for the same word in a given tongue; `src/voice-synth.js` sings them
  as one continuous voice on a `voices` bus (issue #323: docs/systems/audio.md, "The people's voices"). A page's
  voice starts with it and the reveal follows the voice (`revealAt`); balloons and crowd
  shouts play short versions (at most two at once, silent past 26 m); calls are voiced
  through the one hook in `cinema.say`.
- **Tones** (`src/story/tone.js`): every line is tagged, `'~sad~ …'` or `{ text, tone }`,
  from `neutral, happy, sad, angry, scared, surprised, curious, tired, solemn, playful,
  whisper, shout`. Tags are stripped wherever text is shown, and `tests/tone.test.js`
  checks every line in the game has one.
- **Tongues** (`LANGUAGES`, by level id): Qanati, Shaft cant, the Vael hush, cloud-monk
  chant, Hangar clatter and so on, each written in its own script (*The worlds' scripts*
  below). The traveller's translator gives you their words in yours at once (the panel
  shows the page whole, a brief fade its only trace; until issue #147 the words came in
  their script and turned into yours a moment after they were said).

## Openers, exits and remembered answers (the dialogue review v1.57, issue #202)

What the review measured and the rewrite fixed, kept fixed by `tests/dialogue-voices.test.js`:
- **Nobody opens on their own name.** The panel shows it (and no longer a subtitle, issue #208), so a first
  line starts in the middle of what they are doing ("Mind the roots; I've just swept them."), not "Hessa.
  Keeper of the tree." The desert's drummer keeps his ("Teo. Drummer."); things you look at name themselves.
- **No bare goodbye.** The traveller's last answer replies to the page before it, or is a gesture
  ("(laugh with her)", "(look up at the tower)"); B / Esc already closes a talk. Where the page before is
  one of two conditional pages, the exit fits both, or there are two exits with the same conditions.
- **Remembered answers**: a choice that sets a flag (`do: { set: { 'desert.marrow.warned': true } }`) and a
  page that reads it later (`{ if: { flag: 'spheres.cael.said', is: 'short' }, text }`): Marrow, the Speaker
  (Ilo's three answers), Cael, Nima, Madame Sel, Hask, Mother Ysolde, Bastien, Hedda, Rosa and Halden, beside the older ones (Ilo, Dov,
  Hollin, Esk, Tansy; the people book reads Ilo's too, `src/story/people-book.js`).
- **Each people's own night**, as the voice guide lists them; the Garden's drifters call it the pulling night.

## The worlds' scripts
`src/story/scripts.js` writes a line in the speaker's script. The tongues page shows each
word in it as it is said, turning into English a moment later (`revealHtml` in
`src/story/dialogue.js`: a word turns `LAG` letters after it is said, its English fading in
under its glyphs over `FADE` more; 5 and 5). The conversation panel did too until issue #147;
it now shows the page in English at once (*The panel reads at a glance*, above).
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
- **No reflow**: each run of non-blank characters (`lineChunks`) is drawn as an inline `<svg>`
  exactly as wide as its English in the panel's face (`wordWidth`: measured on a canvas, set by the
  dialogue with `setWordMeasure`; `n ch` where nothing measures, as while the panel was mono).
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
  (`src/remap.js`). The gun's push is `{key:mode}`: "D-pad ↑ held" on a pad (the wheel, v1.86), never X.
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
roots are asked from the square 2.6 m out from the bark; they pass `city.roots`, the bark knee high:
`tests/desert-story.test.js`; the well before them, until v1.49, passed its shaft for the same reason).

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

## Knowledge-safe exploration hints (#627)

Unopened quest and giver targets retain their original journal labels and positions, but supply a
separate `hintLabel` to the shared Scout used by web and Unity. `opensWith` and `givenBy` accept
`hint` (an observed description, optionally a function) and `knownWhen` (an explicit acquired-fact
condition). Without such proof, the default is “Someone to talk to”; entering a world does not
reveal a person's identity. World openers supply observable descriptions drawn from their actual NPC placement or appearance.
Unidentified portal routes say “Through the doorway” rather than leaking a destination name.
Plumb's lost barks consume the same safe Scout label. Accepted quest stages retain their established
directions and old saves need no migration. This is a hint-presentation repair, not a complete rewrite
of NPC dialogue or journal/map discovery. Review dialogue knowledge using the updated dialogue skill.

## Clear instructions (#626, first pass)

Plumb’s mechanism hints name an object and an action rather than requiring a metaphor
to be decoded. The first dialogue pass also clarifies the Speaker’s water explanation,
Bastien’s outside route, Rosa’s cable instruction, Achille’s sound clue, Wen’s ledger
answer and carrier route, Lark’s first-hall gust timing, and Sorrel’s garden question. Tone tags, authored dialogue-array page counts, choices, IDs, conditions and effects remain unchanged. The shorter generated Plumb warning intentionally fits one panel.
The voice guide and dialogue-review skill require practical meaning before figurative
colour, without inventing a speaker’s knowledge. This is a bounded first pass; the
remaining dialogue inventory still needs editorial review. Shared story data feeds both hosts.

## Clear instructions (#626, temple follow-up)

Fisk’s repeat hint now distinguishes the full four-vent volley from a bomb’s partial
coverage. Petra names the molten channels controlled by the shared pour taps and
explains that a cradled moon creates an opening for a splash on the Founder’s heart.
These are three instruction edits across four authored pages; their tones, page counts,
choices, conditions and effects remain unchanged. The shared dialogue data serves web
and Unity. This bounded follow-up does not complete the remaining dialogue review.

### Mechanic-specific guide corrections (#626)

Wim’s Clock-House directions name the returning boomerang and its multi-target use, rather than the retired speed tool. Tessa’s answer names a splash at the answering sphere and the lens mark when lights are ambiguous. These are text-only corrections in the existing conversation nodes: page counts, tones, choices, quest effects and save IDs remain unchanged. Both hosts consume the same dialogue data.

### Hush-House and Lamp-House repeat hints (#626)

Teasel names the overhead jangling crystals as the cold tool’s target, rather than
leaving “what she hears” implicit. Briony describes a bubble taking light from a
lit pool, delivery while the moth hangs low, and standing back while it drinks.
This describes one supported method; the moth’s pool-lure route remains valid.
These two one-page edits preserve tones, entry conditions, replies, quest effects
and save IDs. The Mother’s later melody and final touch remain separate steps.
Shared dialogue data supplies both hosts; this is a bounded clarity pass, not a
review of every conversation.

### Compact enamel presentation (direction D)

The conversation renderer uses one dark outer panel, a small integrated portrait,
a brass speaker label and plain stacked choices. The selected reply has a brass
diamond; keyboard numbers and the controller confirm badge keep their existing
input meanings. No inner frame or choice boxes are added. Portrait sources, tone,
page/reveal state, choice availability and saved dialogue progress are unchanged.
The longest text page still reserves stable space between pages. Future replies
occupy no invisible rows: the panel grows only when those choices become available.
At narrow widths the portrait and name occupy a compact header above full-width
words; text-size fitting and plain black-on-white speech remain available.
The same layout is drawn by BridgeHud.DrawTalk in Unity. Muted web review covered
keyboard/controller presentation, three real pages, early-key rejection, narrow
Larger text, touch presentation, plain speech and private-save reload. Five native
Editor transactions reviewed seventeen original panels, including the old-renderer
comparison, three-page controller flow, narrow Larger text and plain speech.
Native narrow fitting may reduce type size on longer pages. These staged private
reviews do not claim physical-controller, installed-device or portrait-identity
coverage. Reviewed web and native pictures accompany the v2.21 changelog line.

### Whale-House repeat hint (#626)

Achille’s visited-house `inside → near` branch names the ball and matching
footstone, the floor beside the dish, and the spring-boots jump and stomp while
the Listener is listening. Standing clear of the ball avoids using it as a
support. The relay still reaches the Listener after its existing delay; the
hint does not change that timing, any puzzle condition, or the conversation’s
two pages, replies, neutral tone or save effects.

The v2.23 after-only browser picture shows the complete hint and actual portrait
after ordinary nearby interaction and production save/reload. The review staged
a prior visit, learned tutorials and one initial nearby position; it does not
prove the walked approach or puzzle completion. The native editor review also
verified the complete conversation, ordinary replies and production save/reload
across two VM boots at 1280×960 with normal text and keyboard input. It does not
claim installed-device coverage; Achille’s existing torso material differs
between browser and native rendering.

### Joss and Hobb repeat hints (#626)

Joss’s inside → pull hint identifies the thrown anchor as the tether target. Hobb’s inside → note hint identifies the makers’ hourglass as the tool for keeping and replaying a nearby sung note. Adjacent pages, replies, tones and progression are unchanged. Actual staged browser conversations and normal-keyboard native Editor conversations were reviewed through their replies and production save/reload. Each native case used two fresh VM boots; all sixteen original panels were inspected. The after-only native pictures show the revised lines. These checks do not claim walked approaches, puzzle completion, installed devices or character-material parity.
