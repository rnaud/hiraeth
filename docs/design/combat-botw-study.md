# Combat reference study: Breath of the Wild (issue #672)

2026-10-25. What Breath of the Wild's fights do that Hiraeth can learn from, studied from footage, and what to change.
It briefs the work on **#661** (defensive enemies with attack-specific openings) and **#665** (a sword-and-shield
enemy that mirrors the traveller); **#663** (attack swoosh trails) and **#664** (darkness entrances) are being built
elsewhere and are only cross-referenced. Design analysis only: no asset, model, sound or animation is copied.

## How the footage was studied (and its limits)

- **Frames, not memory.** Each video was opened muted in headless Chrome (`--mute-audio`, the player muted and paused)
  and seeked frame by frame; the captured frames were tiled into contact sheets and looked at. Coarse passes sample every
  6–15 s; one fine pass samples every 0.25 s (70–90 s of the Lynel guide) to time telegraphs and reactions.
- **No transcripts.** YouTube's caption and transcript endpoints returned nothing to a headless browser, so spoken
  commentary was not used. Where a video burns its advice into the picture as subtitles (SpaceDog), those words were
  read from the frames.
- **Timestamps** of coarse frames are ±1 s (seeks after an ad reload can land late; a few frames showed YouTube's error
  card and were discarded). Fine-pass times are ±0.1 s, but an editor's slow-motion replay (the Lynel guide, 86–89.5 s)
  is not game time and was not used for timing.
- **Text sources** fill in what frames can't show (mechanics' rules). The Zelda wikis (zeldawiki.wiki, Zelda Dungeon,
  Fandom) refused automated fetches (403/402), so no frame data from them; no source found gives BotW's parry or dodge
  windows in frames. Nothing below claims a BotW timing that was not measured from footage.

## Sources

| Source | What it shows | Studied | Times used |
|---|---|---|---|
| [100 Percent Zelda — "Lynel Basics, Attack Patterns, Strategies & More"](https://www.youtube.com/watch?v=CiSwOkat_Uw) (5:52) | Lynel attacks, perfect guard, flurry, head-shot stun and mount | frames every 8 s (0:04–5:48), every 0.25 s (1:10–1:30) | 0:20 overhead raise; 1:16.5–1:17.75 and 1:20.25–1:21.5 leap slam; 1:21.75–1:22.25 perfect guard of the slam; 1:22.5 and 1:30 the reel; 1:24 "Flurry Rush" prompt; 4:20–4:36 bow to the face → kneel → "Mount" prompt |
| [SpaceDog — "Bokoblins, Lizalfos, and Moblins — How to Avoid Getting Hit!"](https://www.youtube.com/watch?v=nVkp48cY-zg) (4:03) | per-attack dodge directions, burned-in subtitles | frames every 6 s (0:03–4:01) | 0:09, 0:15, 0:27, 0:51, 1:33 Bokoblin; 2:03, 2:09, 2:15–2:39 Lizalfos; 2:51, 3:03–3:15, 3:45–4:01 Moblin |
| [DreamyFeather — "5 Moblins and 1 Lizalfos No Damage"](https://www.youtube.com/watch?v=27yO-g4frSU) (12:54) | a group fight: spacing, turns, flurries in a crowd, weapon drops | frames every 15 s (0:10–12:40) | 0:25–1:10 group spacing; 2:10–2:40, 7:55–9:10 flurries with others waiting; 3:10 dropped weapons; 5:55–6:25 two hold back while one engages |
| [GameSpot — "Zelda BOTW Expert Breaks Down High Level Combat"](https://www.youtube.com/watch?v=99iUK141o2o) (8:01) | advanced tech (shield-jump, block reset) | frames every 10 s, first 2:40 looked at | 0:45 a hit's white burst; 1:45–2:35 shield block reset (an exploit; noted, not a lesson) |
| [critpoints — "Breath of the Wild Preview Combat Critique"](https://critpoints.net/2017/02/18/breath-of-the-wild-preview-combat-critique/) (text) | a fighting-game designer's critique of the 2017 demo | read in full | Bokoblins' wind-ups slower than the axe's start-up; no super armour; no group pressure |
| [GameWith Lynel guide](https://gamewith.net/zelda-botw/article/show/38609), [TheGamer Lynel guide](https://www.thegamer.com/legend-zelda-breath-wild-defeat-lynels-guide-steps/) (text) | Lynel move list and counters | read | charge (weapon stowed, distance first), bow at range, perfect guard stops the charge, head shot stuns |
| [ZeldaMods AIDef: BattleCloseDangerAvoidRun](https://zeldamods.org/wiki/AIDef:Action/BattleCloseDangerAvoidRun) (data) | datamined AI action used by Bokoblins, Lizalfos, Moblins | read | enemies steer round danger in battle (`DamageIgnoreDist` 3 m) |

## Findings

**Telegraphs are the whole body, held long, and the big ones leave the ground.** The Lynel lifts its crusher high over
its head before the overhead (0:20) and rears on its hind legs before a charge. Its leap slam is airborne for about
**1.25 s** before it lands (1:16.5→1:17.75, again 1:20.25→1:21.5): the most readable tell in the footage. The critique's
point holds for the small foes: a Bokoblin's wind-up is slower than the player's slowest weapon start-up, so a light
attack can always beat it out. Nothing is drawn on the ground; the weapon and the body say it all.

**Defence is a choice of answer per attack, not one button.** SpaceDog's subtitles read as a rule: a horizontal swing is
answered by a **back flip** (0:51, 3:09), a downward chop or thrust by a **side hop** (3:15, 3:45–4:01), a bare-handed
swipe by walking to one side (0:09, 2:51), and a two-handed swing can be **parried or back-flipped** (2:09). The perfect
dodge only becomes a flurry rush when the hop matches the attack. Hiraeth's flurry is earned by either hop from inside
the blow's area (`src/flurry.js` `DODGE`): fair, but it never asks the player to read *which* blow.

**A perfect guard throws the attacker off balance, visibly, and briefly.** The Lynel's slam parried at 1:21.75 gives a
radial flash on the shield, then the Lynel reels with its arms flung wide (1:22.5, 1:30): about 0.5–0.75 s of reel, then
it attacks again. The reel *is* the "now" signal. A plain guard only bounces the blow. (In BotW the perfect guard is the
"shield bash": A pressed while shielding.) Hiraeth already stuns a parried foe for 2 s (`PARRY_STUN`) and opens the
riposte, but its archetypes' bodies did not move at all on a guard (their old recoil is switched off and the
hit-reaction springs were only kicked by cuts): the opening was told by a stun circle that only starts after the clang.
**Fixed in this issue**, below.

**Openings are tied to a specific action.** The Lynel's best opening is not damage but a state: an arrow in the face
makes it kneel and offers "Mount" (4:20–4:36); a perfect-guarded charge stops it; a flurry follows a well-read dodge. Each
answer has its own window and its own reward, and the game names the prompt on screen while the window is open
("Flurry Rush" at 1:24 and through 2:10–2:40, 7:55–9:10 of the group fight).

**Disarming changes the enemy, not just its health.** Dropped weapons litter the group fight (3:10, a pick-up list of
Moblin and Lizalfos weapons). A disarmed Lizalfos fights with its tail (2:03) and a disarmed Moblin with bare hands
(2:51): a weaker, differently-answered moveset, and a run to the nearest weapon that is itself an opening.

**Groups take turns and keep their distance.** With five Moblins and a Lizalfos, one or two engage while the rest hold
4–8 m off (0:25–1:10, 5:55–6:25); a flurry on one is never interrupted by the others (2:10–2:40). The Lizalfos keeps
range and throws rather than queueing for melee (2:15–2:39). Hiraeth's `TURNS.strikers` (2) and off-screen waiting
already do this.

**Feedback.** Every hit lands with a large orange starburst at the contact (0:21, the group fight throughout); the perfect
guard with a radial white flash and streaks; the perfect dodge with a blue flash and lines. Large, bright and particle
heavy: the *timing* lessons carry over to Hiraeth, the *look* does not (see Fit). Hit-stop on ordinary hits is short; it
was not measured frame-exactly (no 60 fps source in the study), so no BotW hit-stop number is claimed.

## Fit for Hiraeth

- **Controls match.** Hiraeth already has BotW's defensive verbs on the same logic: LB / L1 guard with a 0.18 s perfect
  window, the locked-on back flip and side hop with a perfect-dodge flurry, the riposte after a parry. Lessons that refine
  *when* each verb is right (per-attack hop direction, per-attack parry outcomes) fit without a new button.
- **Art direction.** The Moebius ink look and roster rule 5 ("the body is the telegraph; nothing drawn on the ground")
  agree with BotW's body-first tells, but not with its particle storms. Answer impacts with the ink (the white-line flash,
  the family's splash), the body's own reel and the clang, never with radial streaks or screen-filling bursts. The parry's
  *off-balance pose* is the part worth taking, and it costs nothing visually.
- **Pacing.** BotW lets light attacks beat small foes' wind-ups (the critique's complaint). Hiraeth is deliberately
  stricter (`Foe.hit`: only the first two thirds of a wind-up are interruptible, `stout` foes never), which keeps it
  closer to the critique's recommendation; keep that.
- **Not taken:** mounting, weapon durability and the shield-surf / block-reset exploits (GameSpot 1:45–2:35).

## Ranked changes

| # | Change | Why (evidence) | Issue |
|---|---|---|---|
| 1 | **A guarded blow reels the attacker** (done): perfect parry a held stagger and flash, plain block a flinch with no flash | Lynel reel after a perfect guard (1:22.5, 1:30); before, archetype bodies moved 0° on a guard | **#672 small tuning** (landed here) |
| 2 | **Attack-specific perfect dodge**: each attack names the hop that answers it (`dodge: 'back'` for sweeps, `'side'` for overheads and thrusts, `'any'` for the rest); only that hop starts the flurry, the other still gets its i-frames | SpaceDog 0:51, 2:09, 3:09, 3:15, 3:45 | #661 |
| 3 | **Defensive stances with a named breaker**: a foe raises a guard (shield, shell, curled plates) that glances light cuts from the front; one specific action breaks it (the charged cut, the dash cut round its side, the parry of its bash, an ember or shot at a weak point) into a reel and a short window (0.6–1 s, BotW's reel length), never a long free stun | Lynel head shot → kneel (4:20–4:36), perfect guard stops the charge (TheGamer); the window is short (1:22.5→next attack) | #661 |
| 4 | **The window is told twice: the defence and the opening.** A stance reads by its pose (guard up, plates closed); the opening by the reel from #1 plus the existing stun circle; no on-ground marks | roster rule 5; BotW's telegraphs are all body | #661 |
| 5 | **Sword-and-shield foe mirrors the kit**: guards the traveller's light combo from the front (glance and thunk), punishes turtling with a shield bash (parryable), has a telegraphed overhead (side hop) and a wide sweep (back flip), and opens to the charged cut, the dash cut to its back and the parry | the per-attack answers above; Moblin/Bokoblin movesets (SpaceDog 3:03–3:15) | #665 |
| 6 | **Disarm on a perfect parry of its sword**: the sword flies a few metres; it fights shield-only (bash, shove) while it runs to pick it up; the pick-up is the long opening | dropped weapons (group fight 3:10); weaponless movesets (SpaceDog 2:03, 2:51) | #665 |
| 7 | **Its heaviest move leaves the ground**: a leap slam held about 1–1.25 s in the air, answered by a side hop or a perfect parry (which throws it down, #1's stagger) | Lynel leap 1:16.5–1:17.75, parried 1:21.75 | #665 (and guardians later) |
| 8 | **One mirror fighter strikes at a time**: count it as a striker under `TURNS`, and pair it with ranged or support foes rather than other duelists | group spacing 0:25–1:10, 5:55–6:25 | #665 |
| 9 | **Name the open window on screen while it is open**: a small "RB / R1" glyph by the foe during a flurry and the riposte window (BotW: "Flurry Rush" prompt), Hints full only | prompt at 1:24, group fight 2:10–2:40 | #672 follow-up (UI: needs screenshots) |
| 10 | **Trails only on the dangerous part of a swing**: no trail during the wind-up, the arc during the active frames, a fading tail in recovery; the trail must not hide a body tell | BotW reads its wind-ups from the raised weapon (0:20, 1:16) | #663 (in progress: reference only) |
| 11 | **Entrances must not overlap the first tell**: the darkness settles before the foe's first wind-up can start | (BotW's footage shows no comparable entrance; general rule from finding 1) | #664 (in progress: reference only) |

What #672 changed: `src/foes.js` (`Foes.strike` guarded branch; `Foes.react` takes `info.reel` and `info.flash`),
`tests/guard-reel.test.js`, `docs/systems/foes.md` ("Thrown back off the guard"). Shared `src/` code, so Unity draws it
through the bridge.
