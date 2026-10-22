# Hints: off, subtle, full

Automatic advice boxes are disabled at every hint level (v1.95, #611). Press Plumb’s button for advice. Interaction prompts, item cards, conversations and essential status notices remain. Requested help and optional world markers use **Settings → Game → Hints** (`src/ui.js` `hints`, saved; `src/hint-level.js`):

| kind (`hintsFor(kind)`) | what it is | off | subtle (default) | full |
|---|---|---|---|---|
| `teach` | the first prompt for a genuinely new verb, once: the camera, the potion, the fight's three verbs, the hoverbike's call, a gadget's own verb | no | yes | yes |
| `words` | the use prompt's sentence ("talk to Ilen", "galactic map"); its button glyph shows at every level | no | no | yes |
| `keys` | a control named in a line ({key:verb} in a toast, a quest step, a conversation, the drone's hints) | no | no | yes |
| `tip` | explanations after the fact, how to beat each foe, the world's edge, "it burns", a gadget's status said again, the ink count, where to look in the menu | no | no | no |
| `objective` | the gold column over a world's goal; no pushed next-step card | no | no | yes |
| `nudge` | an unsolicited line or delayed ping | no | no | no |
| `puzzle` | the drone's hints in a guardian's fight, asked for (Q, D-pad →) | never | one line opens after each stretch of struggle (`STRUGGLE`: 40, 100, 180 s in the phase) | all at once |

Not hints, at every level: the scout's ping (the objective, on request, and its marker), the Controls
page (every control), the item cards (a new tool's card teaches its verb: `keyText(…, { teach: true })`),
the quest log, region names, the update toast.

**How the pieces read it.**

- `keyText` (`src/prompt-keys.js`), the one place every shown line resolves its `{key:verb}`s, runs
  `quietKeys` unless hints are full: a parenthesis naming a control goes, the clause after a colon that
  names one goes, "with {key:x}" after three words goes, and a sentence that is only controls goes. A toast
  left empty is skipped (`main.js` `showToast`). `{ teach: true }` keeps them.
- `quietOr(quiet, plain)`: a story line that said what happened and then what to do says only what
  happened at every setting. Advice remains available through requested Plumb help.
- The floating use prompt (`src/story/index.js` `placePrompt`) and the cue (`src/hud.js` `cueText`) are
  the button alone (`#prompt.glyph`, `#cue.glyph`: a small badge, no pill) unless hints are full.
- `openHint(hint, secs)` and `Struggle` (`src/temples/hints.js`): main.js counts the seconds in the
  guardian's phase; with no line open yet the drone only watches (`◇ …`).
- Automatic first-step, scout-teaching and prologue-idle lines are not displayed. Their internal progression is retained for old saves. The Controls page and requested help still explain controls.

Settings saved before the setting (`hintsV` < 1) start on subtle once (`migrateSettings`). The audit of
every hint and what was decided: `docs/design/hints-audit.md`. Tests: `tests/hint-level.test.js`, and
the hint-level halves of `tests/first-run.test.js`, `tests/hud.test.js`, `tests/hints.test.js`,
`tests/key-placeholder.test.js`, `tests/feel.test.js`, `tests/foes.test.js`, `tests/boxes.test.js`.

## Historical teaching state (retained for save compatibility)

The following v1.51/v1.87 teaching states are still recognised, but their automatic cues are no longer displayed.

### The scout's button, after the first conversation (issue #151, v1.51)

`src/scout-hint.js`: the first time a conversation closes (`dialogue:end`) where the scout can go somewhere (off
the ship, not in a minigame, the prologue done, `scout.getTarget()` something), the cue at the bottom says, 1.2 s
later and for 6 s of its own (it waits behind a find, a prompt or a region's name), "{key:scout} shows where your
next quest is": Q, D-pad → (its own button since v1.86, issue #512; R3 only locks on)
or ping. A `teach` line: subtle and full, never off. Said once a save (`teach.scout`, set when it is said); a ping
of your own first (Q, D-pad →) counts as learnt. It is the game's prompt, independent of the drone's own lines.
`tests/scout-hint.test.js`.

### Plumb's talk, the first time (issue #543, v1.87)

The first time Plumb comes to your shoulder with something critical to tell you (its red mark: docs/systems/scout.md,
"Plumb talks to you"), the cue says "{key:scout} talks to Plumb" for 6 s, once a save (`teach.plumb`; a `teach`
line: subtle and full). The critical lines themselves (lost, a makers' house's step, a Blade Gate) are no longer on
the cue: they are Plumb's talk, opened with that button.

## One message at a time (#605)

Plumb speaks the ship’s navigation and status lines, including the recording announcements; the ship itself has no speaking role. Parent recordings retain their speakers. `Cinema.say` queues ordinary lines for their full reading duration; authored recording timelines explicitly replace the previous beat. Conversations temporarily hide and pause queued speech. Context cues yield to speech and status notices, and native toasts keep the same full reading duration as the web. Scene exit clears waiting lines. Quest acknowledgements retain their title without pushing the next instruction.
