# Quest QC, v1.66 (2026-10-13)

<!-- audit-scores
overall: 4.98 / 5
label: the mean of the six rules over fourteen places (4.8 before this pass's fixes)
date: 2026-10-13
-->

The first written report of the `quest-qc` skill (`.claude/skills/quest-qc/SKILL.md`), run for issue #226 on main at
v1.66 (`cfcb5f41`). Until now the skill's passes left their notes in `docs/systems/story.md` ("Straight to the end,
and nobody sends you to somebody else") and in the tests. This report has no earlier one to compare with: the
"before" in the table is this pass's reading before its own fixes.

**What changed in the skill:**
- It now owns quest structure and the answer-follows rule. The dialogue review (`dialogue-review`, whose
  [v1.66 report](dialogue-v1.66.md) ran beside this one) hands those findings here.
- What is left for later goes in a GitHub issue, not in `story.md`.

## The setup

- **The corpus.** 52 quests and 157 steps in the story data (`src/story/*-data.js`, `*-people.js`), the fourteen
  temples' quests (`src/temples/*-data.js` `QUEST`), the makers' boxes' hints (`src/boxes/placements.js`), and the
  new talks since v1.57:
  - the hosts of every game, trial and makers' run (`src/story/hosts-data.js`, v1.65);
  - Anselm Thrum's meeting and shop (`src/story/scientist-data.js`);
  - Marrow's first-fragment errand (`desert.splinter`, #247);
  - the ship's core-gadget step (`src/story/leave-gate.js`, #232);
  - Ilen's splinter pages (`src/story/lantern-data.js`).
- **The checks.** `node .claude/skills/quest-qc/check.mjs`, then a scan of my own for talk → talk across every world.
  The tests' version of that scan, `tests/quest-steps.test.js`, covers three worlds only.
- **Reading.** The conversations were read through the dialogue review's extract
  (`.claude/skills/dialogue-review/extract.mjs`) for rules 2, 5 and 6.
- **The tool, sharpened** (`check.mjs`):
  - **"can't skip"** no longer flags talk and bring steps. They are done by doing them (`docs/systems/story.md`), and
    flagging them buried the four real ones under 27.
  - **"gate?"** no longer flags a step marked `ahead: false`.
  - Flagged steps went from 31 to 4. The four that remain:
    - the desert's `gun`, harmless, because the stone after it wants the gun's push;
    - Esk's "Tell Esk it's only a trickle", the quest that fails, kept;
    - the night mail's two train steps, played by the train itself.

## The scores

Each rule 1-5 per place: 5 nothing breaks it; 4 one finding a player meets; 3 several, or one on a main quest that
stops play. Before → after this pass's fixes.

| Place | Short steps | Nobody sends you on | Straight to the end | Nothing before it’s had | Answers follow | Short talks | **Mean** |
|---|---|---|---|---|---|---|---|
| The Desert | 5 | 4 → 5 | 5 | 4 → 5 | 4 | 5 | **4.5 → 4.83** |
| Vael (with the sky stones) | 5 | 5 | 5 | 4 → 5 | 5 | 5 | **4.83 → 5** |
| Lorn (with the Deep Wood) | 5 | 5 | 5 | 4 → 5 | 5 | 5 | **4.83 → 5** |
| Viridel | 5 | 5 | 5 | 4 → 5 | 5 | 5 | **4.83 → 5** |
| The Underwater City | 5 | 5 | 5 | 4 → 5 | 5 | 5 | **4.83 → 5** |
| The City-Shaft | 5 | 5 | 5 | 4 → 5 | 5 | 5 | **4.83 → 5** |
| The Glass Dunes | 5 | 5 | 5 | 4 → 5 | 5 | 5 | **4.83 → 5** |
| The Buried Machine | 5 | 5 | 5 | 4 → 5 | 5 | 5 | **4.83 → 5** |
| The Moon Foundry | 5 | 5 | 5 | 4 → 5 | 5 | 5 | **4.83 → 5** |
| The Garden of Spheres | 5 | 5 | 5 | 4 → 5 | 5 | 5 | **4.83 → 5** |
| The City Floating in Space | 5 | 5 | 5 | 4 → 5 | 5 | 5 | **4.83 → 5** |
| The Signal Market (with the night mail) | 5 | 4 | 5 | 4 → 5 | 5 | 5 | **4.67 → 4.83** |
| The Lantern | 5 | 5 | 5 | 5 | 4 → 5 | 5 | **4.83 → 5** |
| Anselm Thrum (the ship, every world) | 5 | 5 | 5 | 5 | 4 → 5 | 5 | **4.83 → 5** |

The quests the author kept ending with their person score 5, not 4: Ume, Esk, Brother Calix, Madame Sel, Ilen, the
cab (`tests/quest-steps.test.js` `ENDS_WITH_SOMEONE`).

**Mean: 4.8 → 4.98.** The one rule every world broke is the hosts' (rule 4). The v1.65 batch put a host beside every
trial and makers' run, and each one offered Play whatever the traveller carried. "Open your wings. Up the columns,
through the rings." was said to a traveller with no wings, and Play was then refused by the notice ("Wind ladder: It
wants the fluid wings. Come back with it.").

## The findings

1. **The hosts offer Play before the run can be had** (rule 4, every world; fixed).
   - **Where:** `src/minigames/kit/hosts.js` `hostTalk`, `src/trials/index.js`. The trials' and makers' runs' hosts
     offered **Play** before the gadget or mount: the desert's dune line before the hoverbike, the skiff race before
     the skiff, the gliding trials before the wings, the makers' runs before their temple's gadget.
   - **Fix:** the spot now passes the trial's `lacks()`. While it says something, the host adds it as a last page,
     "It wants the hoverbike. Come back with it.", and offers only "I'll come back with it.".
   - **Not affected:** the games' own hosts (fishing, the canyon, the rings, the wing drop, the gallery), which lend
     what they need.
   - **Test:** `tests/hosts.test.js`.
2. **"Find old Oum in the western dunes"** (rule 2, the desert's `desert.oum`; fixed).
   - **The problem:** a step that starts "Find" and a person's name. The test missed it because the name came after
     "old".
   - **Fix:** the step is now "Search the western dunes for old Oum" (a place first, its person the one you look for),
     and `tests/quest-steps.test.js` sees a name after "old", "young" or "little".
3. **Anselm Thrum's "Come aboard, then."** (rule 5; fixed).
   - **The problem:** the answer was replied to with "On your ship, if you'll have me", the reply to the other answer
     ("Where will I find you?"). An invitation was answered as if it were a question.
   - **Fix:** each answer has its own reply (`meet.aboard`: "I hoped you'd say that…"). `tests/fragments.test.js`.
4. **Ilen's "Your answer?"** (rule 5, the Lantern's `light` node; fixed, found by the dialogue review).
   - **The problem:** the splinter pages came after "It was mine. My answer. I'm sorry.", so the answer followed a page
     about the fragments.
   - **Fix:** her answer is the node's last page again. `tests/fragments.test.js`.
5. **Marrow's "What's that singing out on the sand?"** (rule 5, the desert's Marrow, `fire` and `mean` nodes; fixed in v1.69, #279: offered from `wreck` and `hello`, and `tests/answers-follow.test.js` checks rule 5 over all the story data).
   - **The problem:** offered after a page about Qanat's fire, or about the mark on the hull. The traveller can hear
     the fragment 40 m off, so the question is about what he hears, not what Marrow said.
   - **Proposal:** offer it from `wreck` and `hello` only. Small enough to be in the hosts' and fragments' wording
     issue the dialogue review proposes.
6. **The desert's main quest now ends with an errand out and back** (rule 3 and the level design audit; #278).
   - **The order:** "Meet Qanat at your ship", then "Take the blade and guard from the Rose House" while they are
     missing.
   - **Rule 3 holds:** the step is passed over when they are had, and a player who did the Rose House first goes
     straight to the end.
   - **The problem:** a player who didn't is fed at the ship, sent away and walked back (the level design audit's
     loops 5 → 3).
7. **The night mail's chain** (rule 2, `bazaar.nightmail`; the report-back fixed in v1.69, #279: done at Solange's answer).
   - **The chain:** Edda → the bell → Solange → off → Edda: a courier errand between two people.
   - **Why it stands:** each step names the thing carried, and the train's halt is its own goal.
   - **But:** "Bring Edda her grandmother's answer" sends you back to tell someone. That breaks the standing rule
     "reaching the goal completes the quest", and the errand is not on the kept list because a bring step is no talk
     (`ENDS_WITH_SOMEONE`'s rule).
   - **Proposal:** the errand ends when Solange's answer is in your hand, and Edda reads it when you pass. In #279.
8. **The temples' steps are one template** (rule 1; noted).
   - **The template:** "Find what the makers left in X", "Go up to what … at the top", fourteen times.
   - **Why it stands:** each is short and names a place. It is the dialogue review's to judge as voice.
   - **The checker:** `check.mjs` read only the story data (since #279 it reads the temples' steps and the boxes' hints too). The temples' and boxes' lines are checked for length
     only, by `tests/quest-steps.test.js`.

## Patterns

- **Rule 4 is where new content slips.** Each new batch of talk (the hosts, the fragments) is written at once, and a
  line that sends you to use a thing is written before anyone checks when the thing is had. A host's offer is a quest
  in small.
- **The tests carry rules 1-3 now** (`quest-steps`, `quest-skip`, `dialogue-playtest`, `all-quests`). Rule 5 has no
  test beyond the desert's playtest. It took a reading to find all three answer-follows slips, each in talk written
  since v1.57.

## What I'd do next

1. The desert's ending ([#278](https://github.com/rnaud/hiraeth/issues/278), with the level design audit) and the night mail's report-back ([#279](https://github.com/rnaud/hiraeth/issues/279)).
2. Extend `check.mjs` to the temples' `QUEST` lines and the boxes' hints. The same flags, cheap.
3. A rule-5 test: every answer that names a thing (a proper noun, "the singing") is offered only on a node whose pages
   name it. It would have caught findings 3-5. In #279, with findings 5 and 7 and `check.mjs` over the temples and boxes.
