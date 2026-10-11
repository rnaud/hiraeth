---
name: quest-qc
description: Quality control for Hiraeth's quests — every world's main quest, errands, temple quests and makers' boxes — against the author's rules from his playthroughs: one short line per step, nobody sending you to somebody else, every quest solvable by going straight to its end, nothing asked of the player before it can be had, and every conversation answer following from what was just said. Use when reviewing, adding or changing a quest or a quest-giving conversation (src/story/*-data.js, src/temples/*-data.js, src/boxes/placements.js), or before a release; produces findings and fixes.
---

# Quest QC

The author's rules, from his desert playthrough (October 2026, issues #61, #62, #63, #72, #73). When he gives feedback
like this, it goes back in here.

1. **One short line a step.** A step's `text` is a few words, an imperative or a place: "Walk to Qanat, under the dark
   tree", "Lever the fallen rib off the channel" (at most 9 words: `tests/quest-steps.test.js`). No buttons in it (the
   controls are taught where they are first needed: a chest's card, the tool's own prompts). The quest card when a
   quest starts is one line too (its mark, ◆ main or ◇ errand, and its title; the step after it with hints full:
   `questToastHtml`), and so is the drone's find ("◆ label · how far", `findSummary`).
2. **Nobody sends you to somebody else.** A quest giver says where to go and what is there, not whom to ask next. "Ask
   Marrow at the camps", then Marrow sends you to the hollow, is one person too many: Nour says where the bike is
   herself. A chain of talk steps to different people (Sel → Kip, Lio → Tobin → Lio) is a finding; so is a line that
   ends "go and ask X" outside the step that is X.
3. **Straight to the end.** If the player can do the last thing first (they know the way, have the skill or the item,
   are already there), the quest completes. Every step that can be seen done has a goal the game sees (`flag`,
   `when`); `Quests.skipAhead` passes over the steps before a step already done. Mark a step `gate: true` when
   nothing after it is any use without it (the backpack's chest, the water up before the fire), and `ahead: false`
   when it can be done out of order without the steps before it meaning anything (a hoverbike found on a side errand).
   A talk step that only gives directions is a step to cut. `tests/quest-skip.test.js`.
4. **Nothing before it can be had.** Check every step, conversation, hint and cinematic against the progression
   (`docs/systems/progression.md`: what he starts with, which chest gives what, in which order). A step that needs the
   gun says so ("with the gun's water"); a cinematic never shows a thing used before it is found (the cinematics QC
   skill's checklist).
5. **Every answer follows from what was just said.** An answer asks about something the speaker has just named, or
   answers what they asked: "Who are the Givers?" only after someone has said "the Givers". Check each node's last
   page against its answers, and each answer against the node it leads to.
6. **Short talks.** A quest giver's talk is a few pages in their own voice, the essentials only (Nour from the open
   chest to the skull: three nodes, five pages, `tests/dialogue-playtest.test.js`). Lore is for whoever asks.

## Run

```sh
node .claude/skills/quest-qc/check.mjs                 # every quest, the flagged steps
node .claude/skills/quest-qc/check.mjs --worlds desert --all
node .claude/skills/dialogue-review/extract.mjs <scratch>/dialogue --worlds desert   # the script, to read the answers
```

`check.mjs` flags long steps, buttons in a step, hand-offs (a talk step to one person right after one to another),
steps that send you to ask someone, steps with no goal the game can see (they can't be passed over), and item steps
with no gate. Read the conversations themselves for rules 2, 5 and 6: the numbers only say where to look.

## Fix, then record

- Fix what breaks a rule in the data, keeping saves working: a step removed or renamed needs a migration (the desert's
  `STAGE_MERGE` and `DESERT_QUEST_V`, `src/story/desert.js migrateDesertQuest`; the bike's old `ask` in
  `src/story/desert-bike.js`), and the world's story test and `tests/playthrough.test.js` must still pass.
- What you leave for later goes in `docs/systems/story.md` under "Straight to the end, and nobody sends you to somebody
  else", as "Elsewhere, flagged".
- A changelog line for what a player will notice, as always.
