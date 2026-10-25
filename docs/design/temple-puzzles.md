# Temple puzzles: timed challenges and new puzzle types (issue #660)

The ask: timed puzzles and more varied puzzle designs in the makers' temples, with a countdown you can read in the
room (not only a number on the screen), fair retries, and every temple still completable. This note is the research,
what Hiraeth takes from it, and what was built. How the pieces work: `docs/systems/temples.md`, "The makers' trials".
The wider dungeon practice the houses already follow (lock and key, the dungeon item, teach-test-twist, clue distance)
is in `docs/design/temple-best-practices.md`; it is not repeated here.

## What the research says

**1. A timer must be heard and seen in the world, or players do not know there is one.** Portal's Test Chamber 11
first had a weighted floor button; playtesters searched for a cube. It became a pedestal button that opens the door
for a few seconds, but until the ticking sound was added playtesters still did not understand that they had to act
while the door stood open (developer commentary, as summarised by the [Portal Wiki, "Switch"](https://theportalwiki.com/wiki/Switch)).
Valve's own [mapping tutorial](https://developer.valvesoftware.com/wiki/Switch) builds the timed button with an ambient
sound, `Portal.room1_TickTock`, played while it runs. Zelda does the same: its timed switches are signalled by a ticking
clock or music while their effect lasts ([Zelda Wiki, "Switch"](https://zeldawiki.wiki/wiki/Switch); Link's
Awakening's whole [Ticking Clock](https://zeldawiki.wiki/wiki/Ticking_Clock) mechanic). *Lesson:* the countdown is a
sound and a thing in the room, started by the player's own action, and it speeds up when time is short.

**2. Show the shape of the challenge before it starts.** Valve's playtesting method (Kim Swift's GDC account,
["The secrets of Portal's huge success"](https://www.gamedeveloper.com/game-platforms/best-of-gdc-the-secrets-of-i-portal-i-s-huge-success))
and Ron Gilbert's rules (["Why adventure games suck"](https://grumpygamer.com/why_adventure_games_suck/): show the
problem before the solution, no dead ends) agree: a player should see where they have to get to and roughly how,
before the clock runs. *Lesson:* the countdown's lamps lie along the way you will run, and at rest a faint pulse runs
along them toward the goal, so the route reads before you start.

**3. Small, self-contained trials, about ten minutes, each about one idea.** Breath of the Wild replaced long dungeons
with more than a hundred short shrines, about ten minutes each, everything needed inside
([Fujibayashi, Nintendo Power podcast, via LevelUp](https://www.levelup.com/noticias/fujibayashi-explico-el-origen-del-sistema-de-shrines-en-zelda-breath-of-the-wild/);
[UX Collective, "Shrine design in Zelda: Breath of the Wild"](https://uxdesign.cc/shrine-design-in-zelda-breath-of-the-wild-f3b1093469cf)).
The GDC 2017 talk "Change and Constant" described the aim as active play that answers the player
([Nintendo Wire's write-up](https://nintendowire.com/news/2017/03/01/breath-wild-presentation-gdc-showcases-development-ideology-weird-early-concepts/)).
*Lesson:* each new puzzle is a side room of its own, one idea, with its reward in sight.

**4. Teach, test, twist, across the campaign.** Koichi Hayashida's four steps (introduce where failure is cheap,
develop, twist, conclude: [Christian Nutt, "The structure of fun"](https://www.gamedeveloper.com/design/the-structure-of-fun-learning-from-i-super-mario-3d-land-i-s-director))
and Mark Brown's *Boss Keys* on dungeon items used in several contexts. *Lesson:* the clock appears three times along the
route, each a step harder and each with one new thing, never all at once.

**5. Reveal a rule; let the world hold the clue.** Jonathan Blow and Marc ten Bosch: build the puzzle that shows what a
mechanic implies, not combinatoric filler ([“Designing to reveal the nature of the universe”](https://marctenbosch.com/news/2011/11/designing-to-reveal-the-nature-of-the-universe/)).
The Witness teaches with no tutorial text, through what the player sees: sightlines, panels and the environment hold
the keys ([Fletcher Studio on the island's design](https://fletcher.studio/blog/2017/5/26/the-witness-designing-video-game-environments)).
Bob Bates' dial of proximity (the further the clue from the lock, the harder:
["Designing the puzzle"](http://www.lucasstyle.com/tutorials/Designing_The_Puzzle.pdf)). *Lesson:* a second puzzle type
whose clue is a panel across the room from the lock: glyph tiles stepped in the order a panel shows.

**6. Failure is cheap, retry is instant, nothing is lost.** Gilbert again (no dead states), and the common practice of
timed switches that simply go back to their resting state. *Lesson:* a clock that runs out only puts things back as they
were: nothing saved, nothing to repair, wake it again. A door never closes on you; a bridge never sinks under you; a
reward once had keeps its way open.

What we could not verify first-hand: the Zelda Wiki and UX Collective pages refused automated fetching (HTTP 403), so
their points above are from search summaries; the Portal commentary is the Portal Wiki's summary, not Valve's transcript.

## How it fits Hiraeth

- **Futuristic makers' tech, never organic.** The clock is a pedestal of the house's trim with an eye on a slanted top;
  its countdown is a strip of lamps inlaid in a dark channel in the floor and two upright bars of lamps by what it holds,
  in the house's own lamp colour. The glyph tiles are low trim drums with a glyph inlaid; the panel is a slab of trim with
  the glyphs in turn and pips under each (1, 2, 3, 4): language-free, readable in a still picture.
- **The countdown is in the room.** The lamps go out from the eye's end, so the light left runs on ahead of you toward
  the way; the bars drain top down; a tick and tock each second (`Sound.templeTick`), a higher, doubled tick and a blink in
  the last three seconds, a falling clack when it stops. No HUD number.
- **Fair by construction.** A clock is a held element (`timer` in `logic.js`): lit while it runs, never saved. Woken again
  while it runs, it starts over. Doors wait for you to leave the doorway; bridges wait for you to step off; a coffer had
  holds its door or bridge open for good (`{ found }`). The glyph floor puts its steps out on a wrong tile or when its
  clock stops; nothing else changes.
- **Gentle game, optional challenge.** All three rooms are side rooms off a hub, for a coffer of chimes. The quest marker
  and the drone never point at them (`optional`); the main path of every house is unchanged, so no temple got harder. The
  early one asks for nothing new; the later ones combine the clock with the house's own gadget, so the rule "the gadget in
  every puzzle room after its chest" holds (`tests/temple-rules.test.js`).
- **Times are generous.** Each run has at least half its time spare at a jog (6 m/s): 9 s for a 28 m run, 6 s for an 11 m
  run after a 9 m gust, 22 s for about 48 m of tiles. The difficulty is in reading the room, not in reflexes.

## What was built: teach, test, twist

| Where (route order) | Room | Idea | Asks |
|---|---|---|---|
| The Hush-House (Lorn, 3rd world) | **The Quick Room**, west off the Choir's floor, before the chest | **Teach the clock.** Splash the eye; the lamps light round a stone screen to the vault's door and go out from the eye's end. Run round the screen before they do. | the gun's splash; 9 s |
| The Warden's Well (City-Shaft, 6th) | **The Wind Clock**, east off the gallery, after the chest | **Teach the glyph floor, test the clock.** Step the four tiles in the order the south wall's panel shows (one is a decoy): the clock's stone lids lift. Only the fan's gust wakes it (little vanes round the eye); the gust reaches 9 m, so gust from the lip and run: a bridge of light over an 18 m chasm (too far to jump and glide in a house) stands while the lamps last. | the fan; the glyph order; 6 s |
| The Engine-House (Buried Machine, 8th) | **The Fuse Room**, north off the Governor Room, after the chest | **Twist both.** The tiles are dead and the panel dark until a bomb's blast wakes the clock under its iron cross; only while it runs does the panel show four of the five tiles in turn, and only then do they take. Read and step them before the lamps die; out of time, the steps go out and another bomb starts it again. Done, the vault opens for good. | bombs; reading under time; 22 s |

Each new room keeps the shrine rules (28 m rooms, 7 × 9 m doors, puzzles in the middle 60 %), and is solved by the
house's solver (`solve`), so the completion tests (`tests/completion.test.js`, `tests/playthrough.test.js`,
`tests/temple-playthrough.test.js`, `tests/guardian-completable.test.js`) cover them through the logic; the pieces are
driven frame by frame in node in `tests/temple-trials.test.js`.

## Next, if wanted

- A clock on a main path (a late house's great key behind a timed bridge), once players have met the side rooms.
- A clock that starts a moving platform or a gust lane, and a glyph floor whose panel is seen only through the seeing
  lens (the Footprint).
- A playtest: do players see the side rooms' doorways, and do they read the lamps as a countdown without the notice?
