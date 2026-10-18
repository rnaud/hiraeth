# Quest QC, v1.85 (2026-10-18)

<!-- audit-scores
overall: 4.94 / 5
label: the mean of the seven rules over sixteen places (the fourteen of v1.66, the fight temples and the space ports)
date: 2026-10-18
-->

The second written report of the `quest-qc` skill (`.claude/skills/quest-qc/SKILL.md`), run for issue #467 on main at
v1.85 (`8f01feae`). It follows [the v1.66 report](quest-v1.66.md) (4.98 after its fixes). This pass finds and files; it
fixes nothing (the audit's brief).

**What changed in the skill since v1.66:** rule 6, "a marker reached moves on" (#349, #351), with its walk
(`marker-walk.mjs`, `check.mjs --walk`, `tests/marker-walk.test.js`); `check.mjs` reads the temples' steps and the
boxes' hints (#279); rule 5 has a test over all the story data (`tests/answers-follow.test.js`). The table gains a
column for rule 6, and two new places have rows: the fight temples and the space ports.

## The setup

- **The checks.** `node .claude/skills/quest-qc/check.mjs` and `--walk`: 220 steps (155 in the story, 43 in fourteen
  temples, 22 boxes' hints), 3 flagged, the same three kept at v1.66 (the Desert's `gun` gate, harmless: the stone after
  it wants the gun's push; Esk's "Tell Esk it's only a trickle", the quest that fails; the night mail's "Ring the bell and
  board the train", played by the train). **The markers walked: nothing loops.**
- **The tests.** `quest-steps`, `quest-skip`, `answers-follow`, `marker-walk`, `tone`, `quest-needs`,
  `dialogue-playtest`, `all-quests`, `quest-givers`: 53 tests, all green.
- **Reading.** Everything new or rewritten since v1.66 (`git log cfcb5f41..HEAD -- src/story src/temples/*-data.js
  src/boxes src/minigames src/trials src/fight-temples`): the Desert's reordered ending (#278), the night mail (#279),
  Plumb's opening (`src/companion.js`), the quests held back until they can be done (#328), the hints that say where
  (2a8d85b6), the rumours (`src/story/rumours-data.js`), the fight temples' twelve hosts and the helpers Nuri and Corra
  (`src/story/hosts-data.js`), the port staff (`src/levels/ports.js`), Anselm's lines, the boxes' notes. And all
  fourteen temples' `QUEST` lines against the rebuilt houses (#336): does "up" or "down" match where the guardian is?

## The scores

Each rule 1-5 per place: 5 nothing breaks it; 4 one finding a player meets; 3 several, or one on a main quest that
stops play. v1.66 (after its fixes) → v1.85.

| Place | Short steps | Nobody sends you on | Straight to the end | Nothing before it’s had | Answers follow | A marker moves on | Short talks | **Mean** |
|---|---|---|---|---|---|---|---|---|
| The Desert | 5 | 5 | 5 | 5 → 4 | 4 → 5 | 5 | 5 | **4.83 → 4.86** |
| Vael (with the sky stones) | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5** |
| Lorn (with the Deep Wood) | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5** |
| Viridel | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5** |
| The Underwater City | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5** |
| The City-Shaft | 5 | 5 | 5 | 5 | 5 | 5 | 5 → 4 | **5 → 4.86** |
| The Glass Dunes | 5 | 5 | 5 | 5 | 5 | 5 → 4 | 5 | **5 → 4.86** |
| The Buried Machine | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5** |
| The Moon Foundry | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5** |
| The Garden of Spheres | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5** |
| The City Floating in Space | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5** |
| The Signal Market (with the night mail) | 5 | 4 | 5 | 5 | 5 | 5 → 4 | 5 → 4 | **4.83 → 4.57** |
| The Lantern | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5** |
| Anselm Thrum (the ship, every world) | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5** |
| The fight temples (new) | 5 | 5 | 5 | 4 | 5 | 5 | 5 | **4.86** |
| The space ports (new) | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5** |

(The v1.66 means are over six rules; the new column was 5 everywhere there, so they read the same with seven.)

**Mean: 4.94** over sixteen places (4.94 over the fourteen of v1.66 alone; 4.98 at v1.66). The structure held through
26 releases of new talk: no "Ask X" step, no step before it can be had on any world's quest, no marker that points back.
What slipped is in the rebuilt temples' words and in three long talks, two of which were already there at v1.66 and
missed by its reading.

## The findings

1. **Two temple steps point the wrong way in the rebuilt houses** (rules 6 and 1; #478).
   - **The Clock-House:** "Go down to what winds itself up" (`src/temples/garage-data.js:13`). Since #336 the
     Foreman's Pendulum Hall is on the upper house's floor (`src/temples/garage.js:124` `UP = 10`, the arena `pend`).
   - **The Undertower:** "Go down to the voice under the tower" (`src/temples/bazaar-data.js:11`; the enter line too,
     `bazaar.js:1286`, "Somewhere far down, a voice"). The First Sign's hall is the house's top floor (`F2 = 24`,
     `bazaar.js:120`, the arena `:1165`), reached up through the Gallery of Voices.
   - **Why it matters:** the marker is right, so play doesn't stop; the words send a player who reads them the other way.
     The other twelve houses' "up" and "down" match their guardians' floors.
2. **Three long talks before a quest** (rule 7; #479).
   - **Edda, the night mail:** 12 pages before the letter is given (`hello` 3, `mail` 2, `mireille` 3, `take` 4;
     `src/story/night-train-data.js:53-85`).
   - **Nima and Ossa, the City-Shaft:** 9 pages each before where the splinter is, or the splinter itself; at each node
     the only answer leads on (`src/story/incal-data.js:137-170`, `:231-265`). Both were there at v1.66 and missed.
   - **Against:** Nour's three nodes and five pages (`tests/dialogue-playtest.test.js`) is the house measure.
3. **The Signal Market's first step hands you on** (rule 2; #479).
   - "Find who kept the silent tower" (`src/story/bazaar-data.js:46`), whose answer is Madame Sel, then "Get the
     cylinder back, on the second skybridge" (Kip). It starts "Find who…", which the test reads as no name; a world's
     opening talk reads "Hear X out at <place>" elsewhere.
4. **The fight temples' reward before the kit** (rule 4; #480).
   - The desert's fight temple stands west of the camps (`src/fight-temples/desert.js:44`) with no `needs` and no host
     `lacks`. Play is fine: the run lends the backpack, gun, sword and shield (`src/minigames/kit/onfoot.js:22`).
   - But its card says "New colours … for the backpack, the sword and the shield. Wearing them now"
     (`src/fight-temples/session.js:476`) to a traveller who may have neither sword nor shield yet.
   - **Smaller, in the same issue:** a rumour that a host "has a game going" (`src/story/rumours-data.js:26`) is told
     whatever he carries; the trials' hosts then say "It wants the hoverbike." Doesn't stop play.
5. **Marrow keeps calling after Plumb has started the quest** (rule 2; noted, not filed). While the step is `city` and he
   hasn't been met, Marrow's call (`src/story/desert.js` `marrowCall`) pulls toward a person the quest no longer needs,
   beside Plumb's pull toward the village. One line each; a newcomer's first minute.
6. **The temples' step template** (rule 1; noted, as at v1.66). Fourteen "Find what the makers left in X"; most keepers
   "Go up/down to what …". Short and placed; the voice is the dialogue review's.

## The v1.66 findings, rechecked

| # | Finding | Status |
|---|---|---|
| 1 | The hosts offer Play before the run can be had | **Held.** `tests/hosts.test.js` green; the fight temples' hosts are new and need nothing (finding 4 is their card) |
| 2 | "Find old Oum in the western dunes" | **Held** ("Search the western dunes for old Oum") |
| 3 | Anselm's "Come aboard, then." | **Held** (`meet.aboard`) |
| 4 | Ilen's "Your answer?" | **Held** |
| 5 | Marrow's "What's that singing out on the sand?" | **Fixed in v1.69** (#279) and held: `tests/answers-follow.test.js` |
| 6 | The Desert's ending, an errand out and back (#278) | **Fixed.** "Take the blade and guard from the Rose House" (`src/story/desert-data.js:137`) now comes before "Meet Qanat at your ship" (`:141`); the gift waits for the gear (`desert-repay.js` `repayDue`); old saves move back (`GIFT_AFTER_GEAR`, `DESERT_QUEST_V = 6`). The level design audit's loops 3 → 5 |
| 7 | The night mail's chain (#279) | **Fixed.** Three steps (`night-train-data.js:29-33`); done at Solange's answer (`:174`); Edda reads it as you pass (`:46`), not a step |
| 8 | The temples' steps are one template | **Unchanged** (finding 6 above); two of the lines are now wrong (finding 1) |

## Patterns

- **A rebuilt place keeps its old words.** The temples were rebuilt twice since v1.66 (#23, #336); their `QUEST` lines
  were written for the old houses. Nothing checks "up" against the guardian's floor. A test could: each keeper line's
  "up" or "down" against the arena's height relative to the door (`src/temples/*.js` arena `y`).
- **New systems arrive with their own talk, and rule 4 is where they slip,** as at v1.66 (the hosts then, the fight
  temples' card now).
- **The reading still finds what the tests don't:** rule 7 has a measure for the Desert only (Nour's five pages).

## What I'd do next

1. The two keeper lines and a test for up and down (finding 1).
2. Edda, Nima and Ossa to five pages or so, and the Market's first step (findings 2, 3).
3. The fight temples' card for a traveller without the kit (finding 4).
