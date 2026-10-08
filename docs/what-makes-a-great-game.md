# What makes a great game: the research (October 2026)

Online research into what makes games great, gathered as a framework to audit Hiraeth against
(the audits themselves are in [audits/](audits/), one per version; run one with the `game-audit` skill, `.claude/skills/game-audit/`). Weighted toward exploration and atmospheric
games: Journey, Breath of the Wild, Outer Wilds, Shadow of the Colossus, Sable, Tunic, Hollow
Knight, Firewatch, Proteus, ABZÛ, Death Stranding. Twelve themes; each has its principles, the games
that show them, and the questions to ask. Sources are at the end.

Caveat: several talks (Designing Journey, Outer Wilds at GDC, Firewatch, BotW at CEDEC) are known
through write-ups, not the recordings, so quotes may be paraphrased. Hitstop and telegraph timings
are practitioners' rules of thumb, not standards. The Steam review study uses 2016 data.

## 1. Core lenses: what the game is for

- **MDA** (Hunicke, LeBlanc, Zubek, 2004). Designers build mechanics, which produce dynamics, which
  produce aesthetics. Players meet the game in the opposite order. Of the eight aesthetics, an
  exploration game aims mainly at **Discovery, Sensation, Fantasy and Narrative**, with some
  Submission (relaxed play). Challenge comes second. Judge each mechanic by the aesthetic it serves.
- **Flow** (Csikszentmihalyi; Jenova Chen's *Flow in Games*). Challenge should follow skill.
  Chen prefers difficulty the player chooses (dive deeper, or surface) to hidden adjustment.
- **Self-determination theory / PENS** (Ryan, Rigby, Przybylski). Enjoyment follows from three
  needs being met:
  - **autonomy**: meaningful choice;
  - **competence**: controls you can master, with clear feedback;
  - **relatedness**.
  In the studies, competence and intuitive controls turn out to be one factor: the controls are
  the competence.
- **Motivation models.** Quantic Foundry's Immersion–Creativity cluster (Discovery, Story, Fantasy,
  Design) is the natural audience for an exploration game, more than Mastery or Competition.
- **Koster, *A Theory of Fun*.** Fun is learning patterns. Boredom begins once the patterns run out.
  A good game teaches everything it has before the player stops.
- **Schell's lenses**, especially:
  - Essential Experience;
  - Curiosity ("what questions does the game put into the player's mind?");
  - Surprise;
  - the Interest Curve.

Questions:
- What is the essential experience, in one sentence?
- Which systems feed it, and which pull against it?
- Where are the meaningful choices?
- What is the player still learning in hour two?

## 2. The first five minutes

- **World 1-1** (Miyamoto, Tezuka). The first level teaches everything without text. The first
  enemy is the Goomba because a Koopa was too much for an opening. A safe gap comes before the
  deadly one. 1-1 was built last, so that it teaches what the later levels need. The team watched
  testers in silence.
- **Kishōtenketsu** (Hayashida, Mario 3D Land / 3D World), one idea per level:
  1. introduce it safely;
  2. develop it;
  3. twist it;
  4. conclude, then drop it.
- **Bounded tutorial spaces.** BotW's Great Plateau has a clear exit goal. Tunic's manual teaches
  through discovery.
- **The opening carries the commercial weight.** In a study of Steam reviews, most negative reviews
  are posted within the first seven hours, and Steam refunds within two.

Questions:
- How many seconds and text boxes come before the first moment of wonder?
- Is each control introduced in a safe place before it is tested?
- Can a new player read the first goal without text?
- Where does a silent tester stall?

## 3. Exploration: curiosity, landmarks, the see → go → discover loop

- **The triangle rule** (BotW, CEDEC 2017). Large triangles are landmarks. Medium ones block lines
  of sight and hide what lies behind them. Small ones set the tempo. Cresting a hill is a reveal.
- **Gravity.** Points of interest sit low and paths cut through ridges, so players drift toward
  content. Nintendo used playtest heatmaps to place things where nobody went.
- **Weenies** (Disneyland, via Scott Rogers). A big landmark visible from far off organises each
  zone; Journey's mountain is always in view. The Level Design Book adds a warning: too much
  signposting feels like a theme park, so leave some wilderness unsigned.
- **Multiplicative design** (BotW's chemistry engine). A few consistent rules that combine beat
  additive one-off content.
- **The loop.** Arriving somewhere shows you the next thing. Curiosity is built in stages: Outer
  Wilds' Beachum says players can only be curious about something specific once they know what is
  around them.
- **Getting lost on purpose.** Hollow Knight makes you earn your maps. ABZÛ guides by composition,
  light and fish, so players feel they are exploring but never lost.

Questions:
- Is a big landmark always in view?
- Does arriving show the next point of interest?
- Do the world's systems multiply, or is each interaction scripted once?
- Where does nobody go?

## 4. Rewarding exploration; knowledge as progression

- **Outer Wilds** removed collectibles and upgrades: understanding is the reward, and knowledge is
  the only thing that persists. Its Ship Log keeps the open threads.
- **Tunic** (Shouldice, GDC 2023). A secret has three phases: not knowing, knowing it exists,
  understanding it. Loose ends make a finite game feel bottomless.
- **Self-determination theory.** Extrinsic loot can crowd out intrinsic curiosity. Grindy currency
  sits badly in a contemplative game.

Questions:
- What does going off the path pay?
- Are there things seen but not yet understood?
- Is there a record of what the player knows and still wonders about, so coming back after a week
  is easy?

## 5. Narrative, environmental storytelling, ludonarrative harmony

- **Jenkins**, "Game Design as Narrative Architecture". Space tells a story in four ways:
  - evoked: drawing on associations the player already has;
  - enacted: events staged in a place;
  - embedded: clues to decode in the scene;
  - emergent.
- **Ludonarrative dissonance** (Hocking, on BioShock). When the mechanics reward the opposite of the
  story's theme, the player is pulled out. The aim is verbs that embody the theme.
- **Design by subtraction** (Ueda, Ico / Shadow of the Colossus). Remove until one feeling remains.
  In Ico, holding Yorda's hand *is* the relationship.
- **Firewatch.** Speaking or staying silent changes the relationship. The ending not depending on
  those choices deflated some players (Emily Short).
- **Restraint.** Journey has no words. Sable's stories are everyday ones.

Questions:
- Does the theme come through the mechanics, or only through dialogue?
- What does each place tell you with no text?
- Does any reward loop contradict the theme?
- What could be subtracted?

## 6. Emotional arc and pacing

- **Journey** (Chen, GDC 2013). The emotion was planned for each stretch, then playtested. When the
  arc failed, the team lowered the mountain, lengthened the final area, and gave control back in
  the climax.
- **Schell's interest curve.** Peaks and valleys rising to a climax. Cut dead time, keep intended
  rest.
- **Sessions.** Poki's 2026 study puts typical browser play loops at 30 seconds to 3 minutes.
  A phone session of five minutes should be able to end on a payoff.

Questions:
- Draw the intended curve for a full play-through and for one ten-minute session, then compare it
  with what playtesters do.
- Where is the slog?
- Does the climax take control away when it should give it back?

## 7. Art direction: cohesion over fidelity, readability

- **Sable** (Shedworks, GDC 2022) is the closest precedent for a Moebius-styled 3D game. Its flat
  palette and fine line art lose depth cues, so outline opacity fades with distance.
- **Team Fortress 2** (NPAR 2007). Silhouettes are tested as black shapes. Shadows shift warm to
  cool and are never black.
- **ABZÛ.** Composition, colour and placement of detail lead the eye.
- **Ueda.** A cohesive style means removing what does not fit it.

Questions:
- Would ten random screenshots all read as the style, and stop someone scrolling?
- Does depth read?
- Are foes and interactables known by silhouette?
- Does the style hold on the lowest preset?

## 8. Audio: soundscape, silence, adaptive music

- **BotW.** Sparse piano and mostly no overworld music: the environment's sound is the score.
- **Proteus.** "Every object is singing": flora, fauna and the time of day change the music.
- **Adaptive techniques.** Vertical layering for intensity and horizontal resequencing for state.
  Hollow Knight resequences by area and layers in combat. Journey's score adapts so that skipped
  areas still sound intended.
- **Accessibility.** No essential information by sound alone. Separate sliders. Subtitles for
  speech.

Questions:
- With the screen off, can you tell where you are?
- Is silence used on purpose?
- Does the music meet the moments that matter?

## 9. Game feel and juice

- **Swink, *Game Feel*.** Polish (animation, sound, particles, camera) changes the feel without
  changing the simulation.
- **Vlambeer, "The Art of Screenshake"**, and **"Juice it or lose it"**. Many small cues add up.
- **Juice and tone.** In a contemplative game juice should be quiet: easing, cloth, dust, a soft
  camera lag. Too much costs immersion.

Questions:
- Does simply moving feel good for a minute with no goal?
- Is input latency consistent on a mid-range phone?
- Is feedback scaled to each action's importance?

## 10. Combat in an atmospheric adventure

- **Telegraphs.** Anticipation, action, recovery. Players need more than about 0.3 s to react, and
  up to seconds on a busy phone screen. Pair animation with sound and VFX, and never rely on red
  alone.
- **Hitstop.** Roughly 35–90 ms, scaled to the blow. Past about 120 ms it reads as a dropped frame.
- **Enemy roles** (Level Design Book): grunt, swarm, tank, sniper and so on. Each needs a
  silhouette readable at ten metres or more. Mixed groups should make new situations, and ranged
  foes make the terrain matter.
- **Shadow of the Colossus.** The boss is the level, and climbing is the puzzle: combat as the
  exploration of a creature.
- **Fit.** Sable has no combat. Journey has threat without fighting. Tunic's combat is demanding,
  but optional and comes with assists.

Questions:
- Can every attack be predicted by sight and sound?
- Does combat use the world, or could it happen in an empty box?
- Does it fit the theme?
- Can a player who dislikes it turn it down?

## 11. Accessibility, UX, controls, touch

- **Game Accessibility Guidelines, Basic tier.** Among its items:
  - remappable controls and adjustable sensitivity;
  - an interactive tutorial;
  - self-paced text, readable default text size, high contrast;
  - no information by colour or sound alone;
  - subtitles, separate volumes, a sensible field of view;
  - saved settings and a choice of difficulty.
  The four commonest complaints are remapping, text size, colour blindness and subtitles.
- **Xbox Accessibility Guidelines** add motion settings (motion sickness), photosensitivity,
  time limits, and UI navigation and focus.
- **Celeste's Assist Mode.** Granular, explained at the start, adjustable any time, and worded
  without judgement.
- **Touch.** Split zones and generous hitboxes. Buffered input with visible acknowledgement.
  A left-handed layout. Haptics never the only cue. Controller support, because virtual
  dual sticks are the weakest layout.

Questions:
- Go through the Basic list item by item.
- Is there a motion or shake option?
- Is text readable on a 6-inch screen?
- Is there a combat assist?

## 12. Quality, performance, retention, discovery

- **Bugs.** In the Steam review study, design is cited in 57% of negative reviews and bugs in 17%.
  Crashes, freezes and save loss are what hurt; cosmetic glitches are forgiven.
- **The web.** Browser players expect to play at once. Measure:
  - the time to first control;
  - how stable frame times are;
  - throttling on mid-range Android.
- **Discovery** (Chris Zukowski). 80–90% of success is the product: genre, hook, art style.
  Name an anchor ("Sable meets Outer Wilds, drawn like Moebius"). Put the hook in a trailer's first
  seconds. Demos, festivals and streamers matter.
- **Shareability.** 2–4 s GIF loops of one idea each. A photo mode turns players into marketers.
  A distinctive style is a large advantage.

Questions:
- How long is it to first control, cold?
- Are there any crashes, soft-locks or lost saves?
- Is there a one-line hook?
- What brings a player back tomorrow?

## Using it

Score each theme from 1 to 5 against its questions, on evidence: silent playtests in the Miyamoto
way, players' paths, and recorded first ten minutes on a phone and on a desktop. For an
exploration-first game, weight themes 3–8 most. Judge combat mainly on whether it fits the game.

## Sources

**Frameworks**
- MDA: https://users.cs.northwestern.edu/~hunicke/MDA.pdf
- PENS: https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/
- Flow in Games: https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf
- Quantic Foundry: https://quanticfoundry.com/gamer-motivation-model/
- Koster: https://www.raphkoster.com/games/presentations/theory-of-fun/
- Schell: https://artificials.ch/lens-6-the-lens-of-curiosity/ and https://game-studies.fandom.com/wiki/Interest_Curve

**Onboarding and level design**
- World 1-1: https://www.gamedeveloper.com/design/how-miyamoto-built-i-super-mario-bros-i-legendary-world-1-1
- Kishōtenketsu: https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design
- BotW's triangles: https://kotaku.com/breath-of-the-wilds-biggest-design-secret-lots-of-tria-1819113140
- BotW's gravity: https://www.gamedeveloper.com/design/breath-of-the-wild-open-world-analysis-gravity-to-go-forward
- BotW's chemistry engine: https://www.thumbsticks.com/gdc-17-breath-of-the-wild-science-lies/
- Wayfinding: https://book.leveldesignbook.com/process/blockout/wayfinding
- Disneyland: https://book.leveldesignbook.com/studies/irl/disneyland

**Exploration and knowledge**
- Outer Wilds: https://media.gdcvault.com/GDC+2021/beachum_gdc_2021(1).pdf and https://www.gamedeveloper.com/design/live-die-repeat-how-i-outer-wilds-i-piques-curiosity-in-an-ambivalent-solar-system
- Tunic: https://www.gdcvault.com/play/1029384/
- Hollow Knight: https://www.superjumpmagazine.com/getting-lost-by-design-in-hollow-knight/
- Death Stranding: https://www.gamedeveloper.com/design/a-design-discussion-on-death-stranding

**Narrative and emotion**
- Jenkins: https://paas.org.pl/wp-content/uploads/2012/12/09.-Henry-Jenkins-Game-Design-As-Narrative-Architecture.pdf
- Hocking: https://clicknothing.com/2007/10/07/ludonarrative-d/
- Journey: https://gdcvault.com/play/1017700/Designing and https://adventuregamers.com/article/designing_journey
- Ueda: https://shmuplations.com/ueda/
- Firewatch: https://emshort.blog/2016/02/12/firewatch-campo-santo/

**Art and audio**
- Sable: https://www.gamedeveloper.com/marketing/how-shedworks-refined-the-art-of-sable-in-pursuit-of-readability
- Team Fortress 2: https://steamcdn-a.akamaihd.net/apps/valve/2007/NPAR07_IllustrativeRenderingInTeamFortress2.pdf
- ABZÛ: https://www.gdcvault.com/play/1024409/Creating-the-Art-of-ABZU
- BotW's audio: https://nintendoeverything.com/breath-of-the-wild-composers-on-changing-up-zeldas-music-formula-and-more/
- Proteus: https://www.gamedeveloper.com/audio/the-sound-and-music-of-proteus---an-academic-case-study
- Adaptive music: https://www.thegameaudioco.com/making-your-game-s-music-more-dynamic-vertical-layering-vs-horizontal-resequencing

**Feel and combat**
- Game Feel: http://mycours.es/gamedesign2014/files/2014/10/Game-Feel-Steve-Swink-chapter-1.pdf
- The Art of Screenshake: https://www.youtube.com/watch?v=AJdEqssNZ-U
- Juice it or lose it: https://www.gdcvault.com/play/1016487/juice-it-or-lose
- Hitstop: https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/
- Telegraphing: https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing and https://gdkeys.com/keys-to-combat-design-1-anatomy-of-an-attack/
- Enemy design: https://book.leveldesignbook.com/process/combat/enemy

**Accessibility and touch**
- Game Accessibility Guidelines: https://gameaccessibilityguidelines.com/basic/
- Xbox Accessibility Guidelines: https://learn.microsoft.com/en-us/xbox/accessibility/guidelines
- Celeste's Assist Mode: https://gameaccessibilityguidelines.com/celeste-assist-mode/
- Suzy Cube's touch controls: https://www.gamedeveloper.com/design/lessons-from-suzy-cube-mobile-controls-that-feel-great
- Touch layouts study: https://www.yorku.ca/mack/ec2017.html

**Quality and discovery**
- Steam reviews study: https://link.springer.com/article/10.1007/s10664-018-9627-4
- Steam refunds: https://store.steampowered.com/steam_refunds/
- Poki: https://poki.com/en/c/faq
- Steam page checklist: https://howtomarketagame.com/wp-content/uploads/2020/03/SteamPageChecklistv1.pdf
- Marketing GIFs: https://presskit.gg/field-guides/game-marketing-gifs-guide
