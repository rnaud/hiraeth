# Quest QC, v1.87 (2026-10-19)

<!-- audit-scores
overall: 4.88 / 5
label: the mean of the seven rules over sixteen places (the twelve route worlds, the Lantern, Anselm, the fight temples, the space ports)
date: 2026-10-19
-->

The third written report of the `quest-qc` skill (`.claude/skills/quest-qc/SKILL.md`), run for issue #556 on main at
v1.87 (`f12bba095`). It follows [the v1.85 report](quest-v1.85.md) (4.94) by a day. This pass finds and files; it fixes
nothing (the audit's brief). The places and rules are as at v1.85, so the rows compare. The seven side worlds are left
out, as at v1.85.

## The setup

- **The checks.** `node .claude/skills/quest-qc/check.mjs --walk`: 223 steps (157 in the story, 43 in fourteen temples,
  23 boxes' hints; v1.85: 220), **3 flagged, the same three as v1.66 and v1.85** (the Desert's `gun` gate, harmless; Esk's
  "Tell Esk it's only a trickle", the quest that fails; the night mail's "Ring the bell and board the train", played by
  the train). **The markers walked: nothing loops.**
- **The tests.** `quest-steps`, `quest-skip`, `answers-follow`, `marker-walk`, `tone`, `quest-needs`,
  `dialogue-playtest`, `all-quests`, `quest-givers`, `short-talks` (new, #479), `keeper-direction` (new, #478), `hosts`,
  `dialogue-voices`, `dialogue-choices`: **73 tests, all green.**
- **Reading.** Everything new since v1.85 that gives, words or gates a quest: the fight temples' hosts and rumours
  rewritten into the story (v1.86), Fenna's errand (#475), the courts' gates and the little chests' locks with their box
  quests (#518), Anselm's new wares (#481, #520), Plumb's talk in the dialogue box (#543), and the three reworked houses'
  `QUEST` lines and locals (the Lamp-House, the Greenhouse, the Mooring-House, #477). A read-only survey of the code
  rechecked every v1.85 finding with file and line.

## The scores

Each rule 1-5 per place: 5 nothing breaks it; 4 one finding a player meets; 3 several, or one on a main quest that
stops play. v1.85 → v1.87.

| Place | Short steps | Nobody sends you on | Straight to the end | Nothing before it’s had | Answers follow | A marker moves on | Short talks | **Mean** |
|---|---|---|---|---|---|---|---|---|
| The Desert | 5 | 5 | 5 | 4 | 5 | 5 | 5 | **4.86 → 4.86** |
| Vael (with the sky stones) | 5 | 5 | 5 | 5 → 4 | 5 | 5 | 5 | **5 → 4.86** |
| Lorn (with the Deep Wood) | 5 | 5 | 5 | 5 → 4 | 5 | 5 | 5 | **5 → 4.86** |
| Viridel | 5 | 5 | 5 | 5 → 4 | 5 | 5 | 5 | **5 → 4.86** |
| The Underwater City | 5 | 5 | 5 | 5 → 4 | 5 | 5 | 5 | **5 → 4.86** |
| The City-Shaft | 5 | 5 | 5 | 5 → 4 | 5 | 5 | 4 → 5 | **4.86 → 4.86** |
| The Glass Dunes | 5 | 5 | 5 | 5 → 4 | 5 | 4 → 5 | 5 | **4.86 → 4.86** |
| The Buried Machine | 5 | 5 | 5 | 5 → 4 | 5 | 5 | 5 | **5 → 4.86** |
| The Moon Foundry | 5 | 5 | 5 | 5 → 4 | 5 | 5 | 5 | **5 → 4.86** |
| The Garden of Spheres | 5 | 5 | 5 | 5 → 4 | 5 | 5 | 5 | **5 → 4.86** |
| The City Floating in Space | 5 | 5 | 5 | 5 → 4 | 5 | 5 → 4 | 5 | **5 → 4.71** |
| The Signal Market (with the night mail) | 5 | 4 → 5 | 5 | 5 → 4 | 5 | 4 → 5 | 4 → 5 | **4.57 → 4.86** |
| The Lantern | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5** |
| Anselm Thrum (the ship, every world) | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5** |
| The fight temples | 5 | 5 | 5 | 4 → 5 | 5 | 5 | 5 | **4.86 → 5** |
| The space ports | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **5** |

**Mean: 4.88** over sixteen places (v1.85: 4.94). Every v1.85 finding was fixed and is now tested (#478, #479, #480).
What fell is one new pattern repeated in eleven worlds: the little chests' new locks (#518) made box quests that can be
given before their tool.

## The findings

1. **Box quests given before their tool can be had** (rule 4, eleven worlds; the Desert's was 4 already). #557.
   - Since #518 every court's box waits behind its puzzle's gate and every little chest on a climb has a small lock. The
     tool is earned on the route by the time you *leave* the world (`tests/little-chests.test.js:51`, `at <= here`), and
     in most worlds it is the world's own temple's: Vael's court and `arzach.hush` (the hook, the Belfry), Lorn's court
     and `perdide2.moss` (the stilling) and `perdide.reed` (the bubble wand, the Lamp-House), Viridel's `edena.pouch`
     (the bloom), the City-Shaft's court (the bridge pen), the Glass Dunes' (the boomerang), the Buried Machine's court and
     `buried.resin` (the bombs), the Garden's court and `spheres.shell` (the lens), the Moon Foundry's court and
     `moonfoundry.bellows` (the magnet), the Floating City's `spacecity.starthread` (the tether), the Underwater City's
     `underwater.pearl` (the spring boots), the Signal Market's court (the recall), the Desert's `desert.star` (ember).
     Courts: `src/finds/courts.js:54-77`; locks: `src/boxes/placements.js` (`lock: { tool }`).
   - But the box quests are given by the temple's local as soon as you have found any box, with no look at the tool:
     `ready: () => boxesFound(g) && !spent(b)` (`src/boxes/index.js:317`). A player who takes the quest on arrival walks to
     a gate of jaws, a ring or a cracked wall they cannot open yet.
   - It contradicts the changelog's own line, "every court's puzzle uses a tool you already have when you reach that
     world" (`src/changelog.js:135`), and the author's words in #518 ("I should have all the tools available at that
     moment in the game to open them").
   - **Fix:** hold each box quest until its tool is had (its court's `needs` or its lock's `LOCK_ITEM[tool]`), as
     `quest-needs.js` holds the world quests; or give it at the temple's end.
2. **Joss still puts the Anchor-Warden "at the top"** (rule 6, the City Floating in Space). #563.
   - "A machine at the top is letting the cables out." (`src/temples/spacecity-data.js:58`, the `inside` answer). Since
     #477 the Warden's floor is at ground level east of the Capstan Hall (`src/temples/spacecity.js:173`, `FLOOR.y = 0`).
     The keeper step itself ("Past the Cord Loft: what lets the cables out", `:12`) is right. `tests/keeper-direction.test.js`
     reads the keeper steps and enter lines, not the locals' answers.
3. **Plumb's word at the first Blade Gate, then a flight elsewhere** (rule 5, noted). After "Makers' gate. Blades mean keep
   out. Something got in." (`src/companion.js:62`), the end of the talk sends Plumb to the current goal
   (`src/host/game-host.js:278-282`): `bladegate` has no point of its own (`companion.js:70-72`). #563.
4. **Marrow keeps calling after Plumb has started the quest** (rule 2; noted at v1.85, not filed, unchanged:
   `src/story/desert.js:821`). One line each in a newcomer's first minute.
5. **The temples' step template** (rule 1; noted, as at v1.66 and v1.85).

## The v1.85 findings, rechecked

| # | Finding | Status |
|---|---|---|
| 1 | The Clock-House's and the Undertower's keeper steps say down (#478) | **Fixed and tested.** "Climb to what winds itself up" (`src/temples/garage-data.js:13`), "Go up to the voice in the high hall" (`bazaar-data.js:11`), the enter line "far overhead" (`bazaar.js:1286`); `tests/keeper-direction.test.js` checks every house's keeper step and enter line against its arena's height. The Lamp-House's "Go up to them" passes it |
| 2 | Edda 12 pages, Nima and Ossa 9 (#479) | **Fixed and tested.** Five pages each the short way; `tests/short-talks.test.js` holds every giver to six pages and 45 words a page |
| 3 | The Signal Market's first step hands you on (#479) | **Fixed.** "Hear Madame Sel out by the landing" (`src/story/bazaar-data.js:46`) |
| 4 | The fight temples' card before the kit; rumours of a game you can't play (#480) | **Fixed.** The card speaks of what you own (`coloursLine`, `src/fight-temples/session.js:111-117`); a host whose run can't be had is not rumoured (`waiting`, `src/story/rumours.js:107-108`) |
| 5 | Marrow keeps calling | **Unchanged** (finding 4) |
| 6 | The temples' step template | **Unchanged** |

## Patterns

- **The tests now catch what the reading found at v1.85** (up and down, long talks, the card), and they hold.
- **A new gate arrives without its quest gate, again.** At v1.66 it was the hosts' Play, at v1.85 the fight temples' card,
  now the little chests' locks: rule 4 is where new systems slip. `tests/little-chests.test.js` checks that the tool is
  earned in the world; nothing checks *when the box's quest is given*.
- **Words beside a step still go stale when a house is rebuilt:** the keeper lines are tested now, the locals' answers
  are not (Joss).

## What I'd do next

1. Hold the box quests until their tool is had (finding 1), with a test beside `little-chests.test.js`.
2. Joss's answer, and extend `keeper-direction.test.js` to the locals' answers that name a floor (finding 2).
3. Plumb's Blade Gate point (finding 3).
