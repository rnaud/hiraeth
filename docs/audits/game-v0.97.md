# Hiraeth against what makes a great game (October 2026, v0.97)

This audit measures Hiraeth against the twelve themes in
[what-makes-a-great-game.md](../what-makes-a-great-game.md). The evidence comes from four sources:

- the code;
- the design docs;
- headless-Chrome captures of the title, a new game's first 100 seconds, and five worlds;
- the earlier [fun-and-story-review.md](../fun-and-story-review.md) (v0.86).

That review is about the story's shape. This audit is broader, and checks what has happened to the
review since.

No one outside the project has played the game yet, so every score below comes from reading and
looking, not from watching players. That is itself the first finding.

## The scores

| # | Theme | Score | In one line |
|---|---|---|---|
| 1 | Core experience and coherence | 3 | A clear, moving essential experience, but scope grows faster than focus |
| 2 | The first five minutes | 2 | A beautiful ship, but nothing taught; the first fluid moment comes at stage 9 |
| 3 | Exploration and wayfinding | 4 | Landmarks, a beacon, a drone on request; worlds that notice you |
| 4 | Rewarding exploration | 3 | Route worlds are full; detour worlds are empty and gadgets are hidden |
| 5 | Narrative and harmony | 4 | A real ending and a slow reveal, but no choices and an unanswered mystery |
| 6 | Arc and pacing | 2 | The ending can come before the story's peak; the desert is long; the climaxes are unstaged |
| 7 | Art direction | 5 | Unmistakably Moebius in every capture |
| 8 | Audio | 4 | 25 recorded themes and ambience per world; the adaptive layers are lost under the recordings |
| 9 | Game feel | 4 | Deeply tuned; measured on the Retroid; feedback is mostly quiet |
| 10 | Combat | 3 | Rich and readable, but it doesn't use the world and it pulls on the tone |
| 11 | Accessibility and UX | 2 | Enemies Off / Gentle is good; no remapping, text size, motion options or localisation |
| 12 | Quality, performance, discovery | 3 | Excellent tests and phone performance; no playtests, telemetry or storefront; dev UI shown to players |

Weighted for an exploration game (themes 3–8 count double), Hiraeth sits at about **3.4 / 5**.
The craft is far ahead of the design: the art, rendering, animation, performance and tests are at
or near the top of the indie bar. What holds the game back is not polish but shape. The order
things happen in, what the player decides, and what the player is taught are all weaker than the
craft.

## 1. Core experience and coherence: 3

**Strong**
- The brief's essential experience is clear and unusual: *a son trying to make dead parents proud,
  learning what counts as something of value, in worlds that notice him*. `world-principles.md` is
  a genuine design rule set (approach, react, settle; the world is connected; restraint).
- The MDA targets are Discovery, Sensation, Fantasy and Narrative, and the reactive world, the
  vistas and the recordings serve them directly.

**Weak**
- **Breadth is outrunning depth.** The game has:
  - 30 levels, of which 11 are route worlds, 12 detour worlds, Home, the Atelier and 5 dev worlds;
  - 42 quests, 10 minigames, 14 kinds of foe and 10 gadgets;
  - about 149,000 lines of JS.
- Since the fun-and-story review (v0.86), **none of its eight ranked recommendations has been
  started** (`TODO.md`, "Fun and story"). Eleven releases went to combat, gadgets, minigames,
  soundtracks and colour.
- Koster's test asks what the player is still learning in hour two. Here the answer is new places,
  not new patterns.
- Several systems serve no target aesthetic in play:
  - the 10 gadgets exist only in the debug Gadget Yard (`src/boxes/placements.js` places none);
  - the minigames sit in their own arenas, with signs in only three worlds;
  - most charms are passives that matter nowhere outside their own world.

## 2. The first five minutes: 2

**Strong**
- The title screen, a live vista under the thin HIRAETH wordmark, is a postcard in its first
  second.
- The player has control about 10 s after New Game (`src/ship/prologue.js:39-53`).
- The ship's interior is warm and readable, with a lit "1" on the message sign.
- The cutscene can be skipped (hold Esc or B).

**Weak**
- **Nothing is taught by the world or on the screen.** Moving, the camera, jumping, climbing and
  interacting are never prompted (`docs/systems/ui.md:36`: "Story pages, item cards and toasts name
  no keys"). The controls are listed only on a menu page.
  - In the capture, a new player who stands still for 100 s in the ship gets no nudge at all.
  - World 1-1 teaches without text, but it teaches by design: a safe space with one obvious thing
    to try. The ship's cockpit can be that space, with a nudge after idling, the interact prompt on
    the dash, and the ramp as the exit.
- **The first fluid moment comes at stage 9** of the desert's main quest (`src/story/desert-data.js:79`).
  The backpack comes at stage 2, but empty. Before the fill come:
  - four talk or visit stages in a row (`elder`, `well`, `ama`, `speaker`);
  - a lever puzzle.
  The signature mechanic, the lava-lamp tank, is therefore the last thing a first-hour player meets.
  The review asked for it within 10 minutes. It hasn't moved.
- **A first-time player is greeted with "Updated to v0.97 · what's new is in the settings".**
  `src/changelog.js:1125` reads "never seen a version" as "updated". The toast shows on a brand-new
  profile, over the arrival banner (both are visible in the desert and mangrove captures).
- **The title menu shows DEBUG to every player** (`src/title.js:157`). The game menu also lists
  "Debug: worlds".
- On the toasts' wording, the backpack's FILLED toast says "push with X or the D-pad". On a
  controller, X has been interact since v0.93 (`src/story/desert.js:484`, `src/bindings.js`).

## 3. Exploration and wayfinding: 4

**Strong**
- Every world has a gold story beacon as its weenie, and big silhouettes (the hanging city, the
  rib-cage giant, the Lodestar, the mangrove trees) organise each view.
- The scout drone points only when pinged (since v0.62). That is the restrained, player-chosen
  wayfinding the research recommends, and the earlier review's request for it was already out of
  date.
- The world notices you: reactive flora, screens, crowds and creatures (`living-world.md`).

**Weak**
- **Systems mostly add, not multiply.** Fire lights lamps and burns brambles, and stilling freezes
  creatures. But the elements rarely act on each other without the player (wind on fire, creatures
  on scenery), so emergent moments are rare. The building block for this is `targets.js`, with its
  `kind: 'flammable'`.
- **Long empty traversals** (the review's list) are still in:
  - Vael's 2.6 km plain;
  - the 1.65 km Hearth ride;
  - the 330 m climb back down in the Buried Machine.
  BotW's gravity rule is to put a small thing to find every 30–60 s of travel.

## 4. Rewarding exploration: 3

**Strong**
- Each route world has a full set:
  - a main quest and two side quests, ending in a keepsake;
  - five relics;
  - a temple with a guardian and a gadget;
  - a box, a reel line and a closing page.
- The tank's colour bands, one for each world's source, are a lovely physical record of the journey.

**Weak**
- **The twelve detour worlds are tourism.** Each has a viewpoint page and a few flavour lines, but no
  relic, quest, box, or trace of the light or of Ilen. A grep over all twelve level files finds
  nothing. They are the most beautiful places in the game and give the player no reason to stay.
- **Nothing records what the player wonders about.** The quest log shows only the next step. Outer
  Wilds' Ship Log shows open threads: who mentioned the light, where, and what is still unexplained.
  This game is built on recurring signs (the glyph, the singing light, the father's signal), so a
  "sightings" page in the Sketchbook would turn those scattered clues into something the player
  collects.
- **Rewards after the core tools are quiet passives.** The visible upgrades (the gadgets) are not in
  the game.

## 5. Narrative and ludonarrative harmony: 4

**Strong**
- The ending is earned and specific: Lou running to meet him, the keepsakes set on the stone, the
  oldest recording.
- The recordings make a fine slow-reveal engine: they are old, then the parents are dead, then there
  is Ilen.
- Every line carries a tone, and alien tongues pass through a translator.
- Viridel's tea terraces, which fail whatever you do, are a brave idea.

**Weak**
- **No choice shapes anything.** The stone reacts to three things only: Ilen, the terraces and Lou
  (`src/story/ending.js:180-196`). A story about "what counts as something of value" asks the
  player to value something, and the player never has to.
- **The singing light is still unanswered**, although it appears in nearly every world
  (`story-bible.md:67-70`, "open question"). In Tunic's terms the players stay in phase 2 (they
  know it exists) for the whole game and never reach phase 3 (understanding it).
- **The blade can pull against the theme.** The brief's verbs are gentle and its guardians are
  calmed. Since v0.87 the game has gained a sword, three-hit combos, lock-on and slow motion on the
  last kill. The foes are ink and machines, so nothing truly dies, and Enemies Off exists. Even so,
  a "make us proud" story would be well served by combat that is framed in its terms (cleaning the
  ink, quieting the machines). Otherwise the highest-juice action in the game has nothing to do with
  its question. See theme 10.

## 6. Arc and pacing: 2

**Weak (the most important theme to fix)**
- **The credits can come before the story's peak.** `ENDING_WORLDS = 6` (`src/story/ending.js:42`).
  A player who goes straight on can see the ending without:
  - the jets (world 7);
  - the Signal Market's revelation of Ilen (world 11);
  - the clue chain from the Hangar to the Buried Machine.
  In Journey's terms the climax comes halfway up the mountain.
- **The interest curve is front-loaded and flat.** The desert alone takes 1.5–2 h, and every other
  main quest takes 8–20 min. In a first world where the tank fills late, the first valley is the
  longest one.
- **Only two moments are filmed, both in the desert** (`src/story/desert-moments.js`). The climaxes
  of the ten other worlds go unstaged: the bird coming down, the bell, the wheel, the broadcast. The
  moments system exists, so each one is cheap.
- **Sessions.** A five-minute phone session can end on a payoff (a relic, a vista, a reel line), but
  only if the player knows where one is. The drone points at the objective, never at relics.

## 7. Art direction: 5

**Strong**
- Every capture would stop someone scrolling: the desert's rib-cage giant under floating stone, the
  City-Shaft's towers, the White Mangrove at dusk, the title's mushroom-rock plain.
- Shade is coloured, never black, which is the v0.95 colour pass applying the Team Fortress 2
  principle world by world.
- The References level rebuilds the reference sheets, and all six recurring shader gaps are closed.
- Line weight and hatching are set by material.

**Weak**
- **The type is split.** The title and the arrival banner use a fine, spaced sans that suits
  Moebius. The toasts and speech use a typewriter mono that looks like a developer console.
- **The arrival banner covers the middle third of the screen** for several seconds on every arrival,
  with toasts stacking above it. That is the one moment a new world should be seen.
- Open, from `TODO.md`: the traveller's face reads anime more than Moebius, and caves and interiors
  show shadow artifacts.

## 8. Audio: 4

**Strong**
- There are recorded instrumental themes for all 25 worlds. Each world has its own ambience bed,
  and musicians play solos and bands in the world.
- Menus have their own music.
- Speech is babble in each world's language, shaped by tone, as in Animal Crossing. That suits text
  dialogue.

**Weak**
- When a recorded track plays, the procedural score's activity layers (move, ride, still, night,
  storm) are skipped (`src/audio.js:512`). Only the combat layer survives. The music no longer meets
  the moments, so a discovery, a vista or a keepsake sounds like any other minute.
- Silence is not designed: the music plays all the time. BotW and Journey let ambience carry the
  open world and save the music for the moments. A setting, or a per-world rule that keeps the
  recording for arrivals, climaxes and interiors, would make each one land.
- The public music folder is 103 MB. Check how the web build loads it on the first visit.

## 9. Game feel: 4

**Strong**
- There is real depth of tuning:
  - jump feel, stamina, mantling, starts, stops and turns;
  - capes at every distance;
  - jets that fly like a plane.
- Hitstop is 60–140 ms, scaled by the blow (`src/fluid-blade.js:250,480`, `src/foes.js:904`). That
  is within the 35–120 ms guidance, with only the perfect parry at the edge.
- The camera kick settles in 0.28 s, and slow motion falls on the last foe.
- An input buffer, magnet step-in and evade-to-cut chaining all serve competence.

**Weak**
- There is no option to turn down shake, hitstop or slow motion; see theme 11.
- Feel is tuned by the author alone. Competence is a player's feeling, and nobody else has reported
  it.

## 10. Combat: 3

**Strong**
- The parts are well made:
  - 14 kinds of foe, each with its own counter, a note on first contact, and armour feedback;
  - a reticle that reads wind-up (red, closing), openings (pale blue) and immunity (dimmed);
  - off-screen foes that wait their turn;
  - an Enemies setting of Normal, Gentle or Off.
- That is the readability and fairness checklist done properly.

**Weak**
- **It could happen in an empty box.** The Arena is the main place combat is shown, and `foes.md`
  itself lists the gap: no foe uses height or the temple kit. Shadow of the Colossus is the model
  for an exploration game, with the foe as a place to climb and the fight as a puzzle. The temple
  guardians are closer to that than the field foes are.
- **The challenge has no stakes.** A hit never takes a healthy bar below 8%, and a knockout restarts
  you where you last stood safely. That suits the tone, but then combat's job is texture, not test.
  If so, its weight in the roadmap (most of v0.87–v0.97) is out of proportion.
- Wind-ups lean on colour: red for a strike, blue for an opening. The chevrons closing in give a
  second, shape-based cue, which is good. Check the pair for colour-blind players.

## 11. Accessibility and UX: 2

**Strong**
- Enemies Gentle / Off, camera sensitivity and invert, separate sliders for music, effects and
  voices, controller glyph sets, and aria labels on the touch buttons.
- Strict "nothing on the screen" restraint, with photo mode.

**Missing**, against the Basic tier of the Game Accessibility Guidelines:
- **remapping**: `src/bindings.js` is a fixed table;
- **text size and a background for speech**;
- **motion options**: shake, hitstop, slow motion, camera bob. `prefers-reduced-motion` is honoured
  only by the title vista;
- **colour-only cues**: see theme 10;
- **hold or toggle** for run and guard;
- **an interactive tutorial**: see theme 2;
- **localisation**: English only, strings inline, no i18n layer. A Moebius game has an obvious
  French audience. Moving the strings out is the expensive part, and it gets more expensive with
  every world added.

The menu has stale or debug-facing edges:
- "Debug" on the title screen;
- "Debug: worlds" in the game menu;
- `docs/systems/ui.md`'s settings list is out of date;
- `src/save-slots.js:1` says five slots when there are three.

## 12. Quality, performance, discovery: 3

**Strong**
- 275 test files and about 1,800 tests run before every commit, including a play-through of the
  whole route in node and in a browser.
- On the Retroid (Handheld preset), most worlds run at 56–60 fps, with the City-Shaft's wide view at
  43.
- Loads take 4–16 s. In the captures the worlds booted in 3.3–9.4 s on a Mac.
- Over-the-air updates, with signing-key discipline.
- An in-game changelog with before and after pictures.

**Weak**
- **No playtests, no telemetry, no feedback channel.** The review's own advice ("playtest with two or
  three new players before building the big ones") is still unchecked. Nothing in `src` records
  where players stop, so nobody can tell whether anyone reaches Home before the market.
- **No storefront.** There is no Steam or itch.io page copy, no trailer, no GIFs and no one-line hook.
  The hook writes itself: *"a Moebius comic you can walk into: Sable meets Outer Wilds."*
- **Photos save as a download** (`src/main.js:973-976`). There is no `navigator.share`, so on Android
  a photo goes no further than the device.
- **Deck performance is only partly measured.** The Deck preset has been run in two worlds.

## Where I would invest

These are ranked by improvement per hour of work. Items 1–3 are cheap and change what every player
experiences; items 4–6 are the medium bets that make the game great rather than beautiful.

1. **Watch three people play the first hour, and add opt-in, local-first progress telemetry**
   (which stage, which world, when they quit). Everything below is a hypothesis until then, and
   the last eleven releases were built without that information.
   - *Cost: a day.*
   - *What it settles: whether the desert, the missing tutorial and the early ending really lose
     players.*

2. **Fix the arc.**
   - Open Home only after the Signal Market, or make six worlds a "first homecoming" with a chapter
     after it. The players who see the credits will then have flown the jets and heard of Ilen.
   - Stage each world's climax with the existing moments system.
   - *Cost: low to medium.*
   - *Why: theme 6 is the weakest theme an exploration game is judged on.*

3. **Rebuild the first ten minutes as World 1-1.**
   - The ship becomes the safe room that teaches look, move and interact, with a nudge after 20 s of
     idling.
   - The first splash of fluid comes within ten minutes: fill the tank a little early, then fill it
     fully at stage 9.
   - Merge the four talk stages, and put things to find on the Hearth ride.
   - Fix the "Updated to" toast for new players, hide Debug outside dev builds, and keep the arrival
     banner off the middle of the view.
   - *Cost: low.*
   - *Why: this is where reviews and refunds are decided.*

4. **Make the verbs multiply in the open world, and stop adding breadth.**
   - Put the 10 gadgets into world boxes.
   - Give each route world one optional mastery challenge from the temple kit and its vehicle, built
     like the minigames but placed in the world, with a visible reward.
   - Give foes height and the temple workings.
   - Freeze new worlds, new foe kinds and new minigames until this is done.
   - *Cost: medium, and it can be done world by world.*
   - *Why: hour two should teach new patterns, not just new places.*

5. **Turn the mystery into a collection, then answer it.**
   - Add a Sightings page in the Sketchbook for every trace of the light, the glyph and the father's
     signal.
   - Place one trace in each detour world, which turns tourism into a side mystery.
   - Then the author decides what the light is, with Ilen as the obvious link, and the last stretch
     goes to find it.
   - Add two or three real choices that the stone remembers.
   - *Cost: low for the page and traces; the answer is a writing decision, then about one world of
     work.*

6. **The Basic accessibility tier.**
   - Remapping (the bindings table is already the single source).
   - A text-size setting and a background behind speech.
   - A motion setting (shake, hitstop, slow motion), a second cue alongside colour, and hold or toggle
     for run and guard.
   - Then pull the strings into one table for a French translation.
   - *Cost: medium.*
   - *Why: these are the four commonest complaints, and localisation only gets dearer as the game
     grows.*

7. **Score the moments, not the minutes.**
   - Let ambience carry the open world.
   - Keep the recorded themes for arrivals, climaxes and interiors, and bring back the adaptive layers
     between them.
   - *Cost: low to medium.*

8. **Be findable.**
   - An itch.io page with a ten-second hook trailer and three GIFs.
   - Share from photo mode (`navigator.share` on Android).
   - A short public demo: the desert's first hour once item 3 is done.
   - *Cost: low.*
   - *Why: the art style is the biggest asset, and nobody outside can see it yet.*

What I would not invest in now: more worlds, more foe kinds, more colour passes, or further
rendering work. Those are already at the level where more of them won't change what a player
remembers.
