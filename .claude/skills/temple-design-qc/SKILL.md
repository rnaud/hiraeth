---
name: temple-design-qc
description: Judge the design of Hiraeth's temples (the makers' dungeons) against dungeon and puzzle design practice (lock-and-key structure, the dungeon item and its reuse, teach-test-twist, steps that combine two verbs, how far and how hidden each clue is from its lock, backtracking and changing state, the guardian as the final exam, difficulty curve, how alike the temples are), measured from each temple's logic and layout, and write docs/audits/temple-design-v<version>.md with scores, plans, pictures and a ranked list of concrete edits per temple. Use when asked whether the temples or their puzzles are too simple, too obvious, too alike, or before designing or reworking a temple.
---

# The temple design audit

The author's complaint that started it: "the temples so far seem very simplistic, with puzzles that are almost
painfully obvious." This audit makes that measurable: every temple's puzzle graph is built from its own data,
every step gets an obviousness score, and every finding ends as an edit to a room, a lock or a key. Each
report is `docs/audits/temple-design-v<version>.md`, compared with the last.

Read first: `docs/systems/temples.md` (the kit, the pieces, the logic), `docs/game-brief.md` (gentle, never
punishing: harder must not mean fiddlier or deadlier), `docs/fun-and-story-review.md` (problem 5: the temple
kit stays in the temples), the temple's own file (`src/temples/<world>.js`: its "Inside" comment, `LOGIC`,
`layout`, the guardian), the last `docs/audits/temple-design-v*.md`, and `TODO.md` ("Temple design (audit)",
and "Combat telegraphs": a separate batch replaces the guardians' ground-drawn telegraphs with body telegraphs
and enriches their fights; this audit points at it, it doesn't redo it).

## 1. The principles, distilled

1. **A dungeon is a lock-and-key graph, and its shape matters.** Draw it: rooms, locks, keys, the boss at the
   end. A chain of one-door-at-a-time rooms is "follow the path"; branches, a hub with spokes, keys found in one
   wing for a lock in another and shortcuts back are "find the path". Ocarina's hub-and-spoke was copied for
   years until the dungeons looked alike (Twilight Princess's are near-identical): repeating one template is
   itself a weakness. Sources: Mark Brown, *Boss Keys* (GMTK, 2016-2018), [playlist](https://www.youtube.com/playlist?list=PLc38fcMFcV_ul4D6OChdWhsNsYY3NA5B2),
   e.g. [Ocarina of Time](https://www.youtube.com/watch?v=6LO8Z1DkDqc), [A Link Between Worlds](https://www.youtube.com/watch?v=E7sm-0nGV34);
   [Room Escape Artist's summary](https://roomescapeartist.com/2017/09/10/boss-keys-analysis-zelda-dungeons/).
2. **The dungeon item, used three ways and in the fight.** A classic Zelda dungeon starts from "a theme and an
   item, like fire and bombs" (Aonuma). Miyamoto asked that each new move be used "in at least three different
   situations, and also in boss fights" (Twilight Princess). *Check:* the gadget opens three or more locks, in
   different contexts (a door, a bridge, a hazard, a mechanism, the guardian), and at least one with an older
   verb. Sources: [Aonuma, Le Monde interview](https://nintendoeverything.com/aonuma-on-zelda-breath-of-the-wild-full-le-monde-interview-translation/);
   [Nintendo Dream, February 2007](https://www.zeldadungeon.net/wiki/Interview:Nintendo_Dream_February_2007).
3. **Teach, test, twist (kishōtenketsu).** One core idea; introduce it where failure is cheap, develop it
   with risk, twist it (a surprise that follows the rules), conclude. Leave room between the test and the twist.
   Sources: [Christian Nutt, "The structure of fun" (Koichi Hayashida)](https://www.gamedeveloper.com/design/the-structure-of-fun-learning-from-i-super-mario-3d-land-i-s-director);
   [GMTK, "Super Mario 3D World's 4 step level design"](https://www.youtube.com/watch?v=dBmIkEvEBtA).
4. **The aha: the catch, the assumption, the revelation.** A good puzzle makes the goal clear and the method
   not; it has a catch that blocks the obvious solution, often leans on an assumption it then breaks, and pays
   with a revelation. Find a mechanic's "truth" ("if X, what follows?") and build the puzzle that shows it, not
   combinatoric filler; test every mechanic against every object; a surprise must follow the rules; a puzzle is
   recognisable as a puzzle. Sources: [GMTK, "What makes a good puzzle?"](https://www.youtube.com/watch?v=zsjC6fa_YBg);
   [Blow and ten Bosch, "Designing to reveal the nature of the universe"](https://marctenbosch.com/news/2011/11/designing-to-reveal-the-nature-of-the-universe/)
   ([write-up](https://www.gamedeveloper.com/design/indiecade-inside-jonathan-blow-s-puzzle-design-process));
   Scott Kim, ["What is a puzzle?"](https://cs.wellesley.edu/~cs215/Lectures/L17-IntroGamesJigsawPuzzle/ScottKim-What_is_a_Puzzle.pdf):
   the fun is the flash of insight; if the solver already has it, the puzzle is dead.
5. **Non-obvious without being obscure: the dials.** Bob Bates' dials: how much information, how direct, how
   many solutions, and **proximity: the closer the clue to the lock, the easier**. Hide the solution in plain
   sight; pair a mechanic with a clue placed elsewhere so the solve is seeing how the two fit; combine two known
   verbs; misdirect, but don't cheat (a red herring should be recognisable as one in 30-60 s); design the
   solution first, then block the obvious routes. And Gilbert's rules: show the problem before the solution, no
   arbitrary puzzles, no dead states, events that open an area are logically tied to it. Sources: Bob Bates,
   ["Designing the puzzle"](http://www.lucasstyle.com/tutorials/Designing_The_Puzzle.pdf);
   [Damien Allan, "Designing video game puzzles"](https://www.gamedeveloper.com/design/designing-video-game-puzzles);
   [Ron Gilbert, "Why adventure games suck"](https://grumpygamer.com/why_adventure_games_suck/);
   [The Codex, escape room rules](https://thecodex.ca/13-rules-for-escape-room-puzzle-design/);
   [GDC Online, "Making puzzles and writing work together"](https://www.gamedeveloper.com/design/gdc-online-making-puzzles-and-writing-work-together).
6. **A dungeon that changes state.** Brown's favourite dungeons change the whole dungeon (the Water Temple's
   levels, Stone Tower's flip, the Sandship's time): the most satisfying and the hardest to design. Backtracking
   is good when you cross the space in a changed state or from a new angle, by a shortcut back. Source:
   *Boss Keys* (above), [Brown interviewed by Zelda Dungeon](https://www.zeldadungeon.net/we-interviewed-mark-brown-of-game-makers-toolkit/).
7. **Difficulty rises within and across.** Fractal curves: each dungeon rises to its boss, the campaign rises
   across dungeons; small dips inside a rise. Sources: Schell, *The Art of Game Design*, lens 61;
   ["Anticitizen One: Half-Life 2's relative player strength"](https://www.gamedeveloper.com/design/anticitizen-one-examining-half-life-2-s-variation-of-relative-player-strength).
8. **The guardian as the final exam.** The fight asks for the dungeon's item, used as the temple taught it and
   then twisted, under pressure; clear tells, simpler mechanics than the puzzles, ending as the inevitable
   result (a fight drags past ~10 minutes). (A common reading of Zelda, supported by Miyamoto's "and also in
   boss fights"; no Aonuma quote calls it an exam.) Source: [The Level Design Book, "Pacing"](https://book.leveldesignbook.com/process/preproduction/pacing).
   The guardians' telegraphs and fight richness are the "Combat telegraphs" batch in `TODO.md`.

## 2. The rubric

Nine criteria, 1-5; the script scores each from its measures, you move one by a point where the plan or the
pictures show something it misses, with the reason written beside it.

| Criterion | 1 | 3 | 5 | Measure |
|---|---|---|---|---|
| **Structure** | a chain: no loops, no hubs, no backtracking, nothing reversible | a hub or a loop, one backtrack | hub and spokes or several loops, keys fetched across wings, a changing state | `structure` |
| **Teach → test → twist** (the gadget) | taught only | taught and tested | taught, tested, twisted (combined or in a new context), examined by the guardian | `mechanics['gadget:<item>']` |
| **Combination** | no step combines two verbs | 15-30 % of steps do | half or more | `comboShare` |
| **Non-obvious** | mean obviousness 4.5+ (painfully obvious) | 3.3-4 | 2.5 or less, with no step at 1.5 or under (obscure) | `obviousness` |
| **Clue / lock decoupling** | every key in the lock's room, in sight | 15-30 % elsewhere or hidden | half or more, fairly | `decoupledShare` |
| **Dungeon item** | found at the end or start, used once | used 2-3 times in one context | mid-way, 3+ locks, 3+ contexts, with an older verb | `gadget` |
| **Guardian exam** | doesn't ask for the gadget | asks for it, one verb | asks for the gadget twisted and a second verb, 2+ phases, body tells | `guardian` |
| **Identity** | the same skeleton as another temple | 60-80 % alike | its own shape and traversal | `skeleton`, `mostAlike` |
| **Difficulty curve** | flat or falling | rising a little | rising steadily to the guardian | `curve` |

**Obviousness, per step** (`obviousness()` in the lib): start at 5 (painfully obvious: the key beside the lock,
in sight, one verb, nothing else to try) and take off: a room away (-1 a room, at most -2), out of sight of
the lock (-1), over 20 m (-0.5), two verbs combined (-1), an order or a timing to find (-0.5), hidden until
revealed (-0.5), things in the room that are not its key (-0.5). Aim for 2.5-3.5 on most steps; 1.5 or less is
a warning (obscure), not a goal.

## 3. How to measure

```sh
export PATH="/Users/anf/Library/Application Support/Zed/node/node-v24.11.0-darwin-arm64/bin:$PATH"
node scripts/temple-design/audit.mjs <scratch>/temple [--temples desert,incal]
```

Node only, a second for all eleven, read-only: each temple's rooms are built as the game builds them
(`TempleRuntime` with its `layout`, no world round it), and every piece the layout places is recorded (its
class and options). From `LOGIC` and the pieces (`scripts/temple-design/lib.mjs`, `tests/temple-design.test.js`):
the **puzzle graph** (rooms placed at their marks and pieces; every door and bridge, every link that needs an
item, is a lock; its keys are what its condition names, a ball for a plate it is meant for, the singing stone
for an echo ear); per lock, the **mechanics** (weight, push, shot, sequence, `gadget:<item>`, with `volley` and
`reveal` as qualifiers), and per key its distance in **rooms** and **metres** and whether it is **in sight**
from where you stand to face the lock (a ray through the temple's walls, floors and shut doors); the
**traversal** pieces per room (discs, winds, gusts, swings, pits, glass); the solve order (`logic.js`
`solve`). Then the measures and scores above, the temple's **skeleton** (one letter a step: B base verbs, C the
chest's room, G the gadget alone, X a combination, R a reveal, T a traversal the gadget makes, K the guardian)
and how alike every two temples are.

It writes `report.json`, `<id>-plan.svg` (a top-down plan: rooms, pieces, each lock's line to its keys,
coloured by obviousness, dashed when out of sight) and `views.json` (each temple's two most obvious steps, from
where you face the lock). Then the pictures, in one browser:

```sh
node scripts/design-qc/capture.mjs <scratch>/shots --views <scratch>/temple/views.json --svgs <scratch>/temple [--rest 15]
```

**Light-load rules** (the machine is shared): at most **one** headless Chrome (muted) and **one** dev server
(PORT, default **5344**) at a time; **never** port 5173; Chrome picks its own debugging port; never attach to a
Chrome you didn't start; temples run world by world with a rest between; the script closes both.

What it can't see: wall climbs (any wall can be climbed, so a climb isn't in the data), how readable a lamp
or a glyph is, and the guardian's fight beyond its definition (`needs`, `requires`, its phases' words, its
attacks' shapes). Play one temple through in the game (`docs/systems/dev-tools.md`) before scoring its
guardian by more than the numbers.

## 4. Turn findings into edits

Each edit names the temple, the room, the lock and the keys (`LOGIC` ids), the change, why (principle and
measure) and the expected score change. Rank worst first by (score gain × how many players meet it) / cost;
prefer edits that use pieces the kit already has (`docs/systems/temples.md`). The usual moves, each a real
change to `LOGIC` and `layout`:

- **Move the key away from its lock** (decoupling, non-obvious): the plate for the gadget door goes in the
  room before, or behind a window you can see through but not walk through; the eye sits over a balcony seen
  from the lock but reached from another room. Keep it findable again (Gilbert) and in sight from *somewhere*.
- **Combine the gadget with an older verb** (combination, teach-test-twist): ember a rope that drops a ball
  onto a plate; ride a disc that only the bell stops; push a ball through a gust; light a brazier with the
  lantern's light reflected; a vine that grows only where the lens shows soil.
- **Branch the graph** (structure): two wings off a hub, each holding one key of a door at the centre
  (`{ all: [...] }` over elements in different rooms); the order is the player's.
- **A shortcut back** (structure, backtracking): a door that opens from the far side once the gadget is had
  (`latch`, `oneWay` links), so the walk back to an earlier lock is short.
- **Change the temple's state** (structure): a reversible element the whole temple reads (a water level, a
  turned floor: `opens` with `any` / `not`, a non-latched door), used twice in different states.
- **A catch, then the revelation** (non-obvious): the obvious move fails for a visible reason (the ball rolls
  back off a tilted plate; the bell bridge falls again when you step off) and the second verb fixes it.
- **The guardian asks for the twist** (guardian exam): the phase uses the gadget the way the twist room did,
  plus one older verb; its tells on the body (TODO "Combat telegraphs").
- **Break the shared skeleton** (identity): no two temples open with "push the ball, ride the disc"; give each
  its own first room from its world's idea.

Content edits never go in the audit's commit. List them in `TODO.md` under **"Temple design (audit)"**,
ranked; each later batch re-runs the audit for its temple and keeps `tests/temples.test.js` passing (every
temple solved, its gadget mid-way and needed for every later room).

## 5. Write `docs/audits/temple-design-v<version>.md`

Start the report with its score block, right under the title (an HTML comment GitHub hides; the audits page,
`audits.html`, reads it: `src/audits-page/parse.js`, docs/systems/ui.md "The audits page"):

```
<!-- audit-scores
overall: the average of the temples' means / 5
label: the average of the eleven temples' means
date: YYYY-MM-DD
-->
```

Keep the score tables as Markdown tables with one row per temple and the 1-5 scores in their own columns (a
"total" or "Mean" column for the row's mean; a change by eye as `4 ✎3`, before and after as `2 → 3`): the
page draws them as bars and compares them with the last report's by the row's name and the column's header,
so keep both the same from one report to the next. `node --test tests/audits-page.test.js` checks the block.

- **The setup:** the commit, the date, what ran, what was not checked (climbs, readability, the fights).
- **The scores:** one row per temple, the nine criteria and the mean; your moves by eye with the reason.
- **Across the temples:** the skeletons side by side, how alike they are, what repeats.
- **Per temple:** the plan (WebP) and a picture of its most obvious step, its steps with their obviousness
  and why, the gadget's arc, the guardian's link.
- **The ranked edits:** per temple, worst first: what, where (`LOGIC` ids, room), why, expected change.
- **Against the last report.**

Pictures in `docs/audits/temple-design-v<version>/`, WebP, only those that show a problem, under 3 MB in all.
Add the report to the `docs/audits/` line of `docs/README.md`. Documentation only: no changelog line.

## 6. Tell the user

The scores per temple, the worst three problems with pictures, the top five edits; offer them as work.
