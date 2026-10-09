---
name: level-design-qc
description: Judge how Hiraeth's worlds are laid out, world by world, against level design practice (landmarks and wayfinding without UI, density of interest, loops and dead ends, the walk back, optional content's pull, verticality, pacing, onboarding at the landing), measured from the game's own data, and write docs/audits/level-design-v<version>.md with scores, maps, pictures and a ranked list of concrete edits per world. Use when asked whether the worlds are well organised or interesting, about level or world design, empty stretches, getting lost, backtracking, points of interest, or before reworking a world.
---

# The level design audit

A world is judged on how it is *laid out*, not on how it looks (the visual audit) or what its people say
(the dialogue review). Each finding is a number from the game's own data and a picture you can point at,
and ends as an edit: what to move, add or cut, where, and what it should do to the score. Each report is
`docs/audits/level-design-v<version>.md`, compared with the last.

Read first: `docs/game-brief.md` (the calm, gentle tone: we want curiosity, not a theme park),
`docs/world-principles.md` (the world notices you), `docs/fun-and-story-review.md` (problems 5 and 6:
empty travel and walking back), `docs/systems/worlds.md` for the world in question, the last
`docs/audits/level-design-v*.md`, and the "Level design (audit)" section of `TODO.md`.

## 1. The principles, distilled

Each one is a check you can make on a map or from a spot, with where it comes from.

1. **Landmarks give orientation; one big "weenie" per district.** A landmark is unique, contrasts with its
   surroundings and is seen down long sightlines; frame it with something in the foreground. Lynch's five
   elements (paths, edges, districts, nodes, landmarks) are the vocabulary. *Check:* from the landing and
   from most of the path you can see at least one landmark, and each district has one that is its own.
   Sources: [The Level Design Book, "Wayfinding"](https://book.leveldesignbook.com/process/blockout/wayfinding);
   [The Level Design Book, Disneyland study](https://book.leveldesignbook.com/studies/irl/disneyland);
   Scott Rogers, *Level Up!*, ch. 9 ("Everything I learned about level design I learned from Disneyland",
   GDC 2009); Christopher Totten, *An Architectural Approach to Level Design* (2nd ed., 2019:
   architectural weenies, prospect and refuge).
2. **Wayfinding without UI: the critical path needs the strong aids.** Players look where they move, rarely
   up, and notice contrast (colour, shape, light, motion). The Level Design Book's (unscientific) ladder of how
   many players an aid reaches: sound 15 %, sightlines 35 %, light and colour 40 %, environmental storytelling
   50 %, leading lines 55 %, repetition 60 %, breadcrumbs 80 %, hard barriers 98 %. *Check:* every leg of the
   main quest is carried by an aid of 35 % or more (its goal or a landmark by it in sight, a road, a light);
   the subtle ones (under 20 %) are kept for secrets. Here the drone's FIND is a crutch, not the aid: a leg
   that only the drone can find is blind. Source:
   [The Level Design Book, "Wayfinding"](https://book.leveldesignbook.com/process/blockout/wayfinding).
3. **The triangle rule and gravity (Breath of the Wild).** Triangles at three scales: big ones are landmarks,
   middle ones block the view and hide what's behind, small ones pace the walk; a reveal chain (a hill, then a
   structure, then the tower behind it). Places of interest are ranked by how visible and important they are so
   they *pull* you different ways and invite detours. Don't let a landmark be seen whole from A all the way to
   B: curve the approach so it shows something new (a lake, a camp at its foot). Gliding is cheap, climbing
   dear: important places sit low, viewpoints high. *Check:* optional places 30-150 m off the path (the pull),
   few beyond; a long straight leg with its goal in view the whole way is a missed reveal. Sources: Fujibayashi,
   Takizawa, Yonezu, CEDEC 2017, [Matt Walker's translation of the slides](https://gist.github.com/idbrii/e39fe96279aa1670319bfa521d907399);
   [Robert Yang, "Open world level design: spatial composition and flow in BotW"](https://www.blog.radiator.debacle.us/2017/10/open-world-level-design-spatial.html);
   [Nic Phan, "Gravity to go forward"](https://www.gamedeveloper.com/design/breath-of-the-wild-open-world-analysis-gravity-to-go-forward).
4. **Density of interest: clusters with real space between, not a honeycomb.** No studio publishes a "something
   every N seconds" rule (the "40-second rule" is forum lore: don't cite it as one). What is supported:
   playtest heatmaps showed evenly spread towers felt linear (BotW); even spacing turns exploring into a
   checklist; cluster content and leave honest empty space, but don't make the player cross it twice for
   nothing. *Check here:* the longest stretch of the critical path with nothing within 40 m, in seconds at the
   world's travel speed (anchors below); the share of the path that is empty. Sources: the CEDEC 2017 slides
   above; [ResetEra thread on the "40-second rule"](https://www.resetera.com/threads/40-second-rule-of-open-world-games.142132/)
   (as lore, not a rule).
5. **Loops and shortcuts over dead ends; a walk back shows something new.** A loop needs a reason in the world
   (a door that opens from one side). Dead ends are allowed, but every dead end pays out (a reward, a view, a
   story beat), and a dead end with treasure is short. *Check:* the legs that come back to where you were
   (most worlds end "back to the ship"): do they pass anything new? Sources:
   [The Level Design Book, "Typology"](https://book.leveldesignbook.com/process/layout/typology) and
   ["Flow"](https://book.leveldesignbook.com/process/layout/flow);
   [Room Escape Artist on Boss Keys](https://roomescapeartist.com/2017/09/10/boss-keys-analysis-zelda-dungeons/).
6. **Pacing: an interest curve with peaks and valleys.** A hook, rising peaks, a climax, a short resolution,
   nested at every scale; intensity 1-5 per beat; the calmest beat after the longest intense stretch; adjacent
   beats don't repeat the same kind; don't end on the peak. Long stretches of the same beat (three "talk to X"
   in a row) flatten it. Sources: Jesse Schell, *The Art of Game Design*, lens 61 "Interest Curve";
   ["Charting through pacing of Uncharted 2"](https://www.gamedeveloper.com/design/charting-through-pacing-of-uncharted-2-part-1---pacing-principles);
   [The Level Design Book, "Pacing"](https://book.leveldesignbook.com/process/preproduction/pacing).
7. **Critical path vs optional; secrets must be missable and must pay.** "It has to be possible to miss some
   things to make finding them meaningful" (Harvey Smith); a secret that pays nothing frustrates. Environmental
   storytelling lets the player infer what happened from staged things, and must not contradict the rules.
   Sources: [Smith and Worch, "What happened here? Environmental storytelling", GDC 2010](https://gdcvault.com/play/1012647/What-Happened-Here-Environmental)
   ([slides](https://www.worch.com/2010/03/11/gdc-2010/)).
8. **Onboarding a space: teach where failure is cheap.** World 1-1: the simplest threat first, a safe pit then
   a deadly one, built after the later levels, watched in playtests without a word. *Check:* from the landing,
   the first goal is near or in sight, a few things are within reach, a landmark gives a heading. Source:
   ["How Miyamoto built World 1-1"](https://www.gamedeveloper.com/design/how-miyamoto-built-i-super-mario-bros-i-legendary-world-1-1).
9. **Verticality and silhouettes.** Height gives prospect (seeing where to go) and refuge; readable
   silhouettes against the sky make landmarks; a world that is all one level reads flat. *Check:* the places'
   span of height, the share standing raised, the climb along the path. Source: Totten (above).

## 2. The rubric

Nine criteria, 1-5. The script scores each from its measures (the anchors below); read the maps and pictures
and move a score by one where the numbers miss something, *writing why beside it*.

| Criterion | 1 | 3 | 5 | Measure |
|---|---|---|---|---|
| **Landmarks** | none tall enough, none from the landing | a few; half the path sees one | 3+; the landing and 90 % of the path see one | `landmarks.count`, `fromSpawn`, `seenShare` |
| **Wayfinding** | under 20 % of the long legs see their goal or a landmark by it | 40-60 % | over 80 % | `guidance.guidedShare` |
| **Density** | an empty stretch over 100 s at the world's travel speed | 35-60 s | 20 s or less | `gaps.longest` / `travel.speed` |
| **Spacing** | under 12 places, a 90th-percentile neighbour over 200 m, loners | some loners | evenly clustered, no loners | `spacing` |
| **Loops** | walks back with nothing new, remote dead ends | one empty walk back | none: every return passes something new | `returns`, `remote` |
| **Optional pull** | little optional, all remote | some, half pulling | many, mostly 30-150 m off the path | `gravity` |
| **Verticality** | flat (under 30 m of range, nothing raised) | 30-80 m, some raised | 80 m+, 15 %+ raised, real climbs | `vertical` |
| **Pacing** | one kind of stop, long runs of it, a 20-minute path | 2-3 kinds, runs of 3 | varied, no runs over 2, a 10-minute path | `pacing`, `path` |
| **Onboarding** | first goal far, nothing near the landing, no heading | one of the three | first goal within 60 m, 2+ places near, a landmark in sight | `spawn`, `landmarks.fromSpawn` |

Two judged by eye, not scored by the script (write a line on each): **environmental storytelling** (does the
layout tell what happened here?) and **the reveal** (does a long leg show its goal whole the whole way, or does
the terrain hide and reveal it?).

## 3. How to measure

```sh
export PATH="/Users/anf/Library/Application Support/Zed/node/node-v24.11.0-darwin-arm64/bin:$PATH"
node scripts/level-design/audit.mjs <scratch>/level [--worlds desert,arzach] [--cell 6]
```

Node only, no browser, a second or few per world, read-only against the game: each route world is built as
the play-through builds it (`tests/playthrough-agent.js` `loadWorld`: the level, its temple, collision, the
story with its people and quests, the makers' boxes). It gathers the **places**: the ship, named people, every
quest stage's marker, the makers' boxes, the temple's door, the trial's stone and the makers' run, doors and
caves (`level.portals`), the makers' court; merged within 6 m. The **critical path**: the landing, the route's
quests stage by stage (`tests/playthrough-worlds.js` `ROUTE`; the temple's door where the route goes in), back
to the ship; through portals where that is shorter (the Hangar's gravity zones, the desert's caves:
`viaPortals`). The **landmarks**: a height grid of the collision seen from above, blobs standing 25 m over
their surroundings (`landmarksFrom`). **Sight**: a ray through the collision and over the terrain (grass and
foliage you walk through don't block it). The pure logic is `scripts/level-design/lib.mjs`
(`tests/level-design.test.js`).

It writes `report.json` (every place, the path, the landmarks, the measures, the scores), `<world>-map.png`
(relief from above, +z up: the path dark, the four longest empty stretches red, places on the route blue,
optional green, landmarks purple triangles, the landing a ring), `<world>-map.svg` (the same with names) and
`views.json`.

Then the pictures, in one browser:

```sh
node scripts/design-qc/capture.mjs <scratch>/shots --views <scratch>/level/views.json --svgs <scratch>/level [--rest 15]
```

Per world: from high above, the landing looking toward the first goal, the longest empty stretch looking along
it, and a blind leg looking toward its goal. Look at every one yourself: the numbers say where to look.

**Light-load rules** (the machine is shared): at most **one** headless Chrome (muted: `--mute-audio`, the game's
volumes at 0) and **one** dev server (PORT, default **5344**) at a time; **never** port 5173 (the author's own
server); Chrome picks its own debugging port (`--remote-debugging-port=0`), never attach to one you didn't
start; worlds run one after another with a rest between (`--rest`); the script closes both when done; run the
node audit, then the capture, never two captures at once.

## 4. Read the numbers well

- **The path is drawn straight between markers.** Real routes bend round rocks, climb, glide or fly; a stage
  inside an interior is reached through its door. Distances are a floor, seconds an estimate at the world's
  travel speed (`travel`: running 8.2 m/s; the bike 20, the bird 18, the skiff 12 once you have them).
- **A gap is measured to the nearest place of any kind,** including people who wander: look at the map.
- **Landmarks are what the collision makes tall.** A tall thing you can walk through (a light, a sign) isn't
  one; a mesa or a cliff is. A blob is not a weenie unless it is unique: check the "above" picture.
- **Odd worlds:** the City-Shaft is all vertical relief (the grid sees terraces as landmarks); the Hangar's
  zones are kilometres apart, joined by portals (the map shows only the plateau); interiors sit far overhead.

## 5. Turn findings into edits

Every edit names the world, the place (coordinates or a named site in `src/levels/<world>.js` /
`src/story/<world>-data.js`), the change, why (which principle, which measure) and the expected score change.
Rank them worst first by (score gain × players affected) / cost. The usual moves:

- **An empty stretch** on the critical path: put something on it (a person with a line, a small sight, a box,
  a reactive plant: `docs/world-principles.md`), or move the goal so the path bends past an existing place, or
  give the stretch a vehicle earlier. Re-run: the gap shrinks.
- **An empty walk back to the ship:** a loop (the last stage nearer the ship, a different way back past an
  optional place), a shortcut that opens from the far side, or a reason to return (the world changed: the
  temple's `change`).
- **A blind leg:** a landmark by its goal (tall, unique, lit at night), a leading line (a road, a channel, a
  row of stones), or the goal moved into sight from where the leg starts. Re-run: `guidedShare` rises.
- **A remote dead end:** move the place toward the path (into the 30-150 m pull band) or give the trip a
  second reason (a view, a person).
- **No landmark from the landing:** put the world's weenie in the landing's sightline; turn the landing.
- **Flat:** raise a goal onto something (a roof, a ledge, a spire), make the way to it a climb.
- **Pacing runs** (three talks in a row): merge them, or put a "go" or "do" between.

Content edits never go in the audit's commit: the audit is documentation. List them in `TODO.md` under
**"Level design (audit)"**, ranked, each with its world and expected score change; the edits come in later
batches, each re-running the audit for its world to show the change.

## 6. Write `docs/audits/level-design-v<version>.md`

- **The setup:** the commit, the date, what ran (node audit, capture), what was not checked.
- **The scores:** a table, one row per world, the nine criteria and the mean; the moves you made by eye, with
  the reason.
- **Per world:** the map (WebP, `cwebp -q 70`, ~640 px) and one or two pictures of its worst problem, the
  three worst findings with their numbers, the two judged criteria.
- **The ranked edits:** per world, worst first: what, where, why, expected change.
- **Across worlds:** what repeats (e.g. every world ends with an empty walk back).
- **Against the last report:** what changed.

Pictures go in `docs/audits/level-design-v<version>/`, only those that show a problem, WebP, under 3 MB in all.
Add the report to the `docs/audits/` line of `docs/README.md`. Documentation only: no changelog line. Commit
it after the tests and the build pass.

## 7. Tell the user

The scores per world, the three worst problems with their pictures, and the top five edits; offer the edits
as work, don't start them unasked.
