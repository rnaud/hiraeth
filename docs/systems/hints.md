# Hints: off, subtle, full

The game teaches by its world (Zelda, Outer Wilds): the screen says as little as it can. Every kind of
help goes through one setting, **Settings → Game → Hints** (`src/ui.js` `hints`, saved; `src/hint-level.js`):

| kind (`hintsFor(kind)`) | what it is | off | subtle (default) | full |
|---|---|---|---|---|
| `teach` | the first prompt for a genuinely new verb, once: the camera, the potion, the fight's three verbs, the hoverbike's call, a gadget's own verb | no | yes | yes |
| `words` | the use prompt's sentence ("talk to Ilen", "galactic map"); its button glyph shows at every level | no | no | yes |
| `keys` | a control named in a line ({key:verb} in a toast, a quest step, a conversation, the drone's hints) | no | no | yes |
| `tip` | explanations after the fact, how to beat each foe, the world's edge, "it burns", a gadget's status said again, the ink count, where to look in the menu | no | no | yes |
| `objective` | the quest's next step pushed onto the screen, a quest card's first step, the gold column over a world's goal | no | no | yes |
| `nudge` | a line or a ping that comes by itself (the sphere's "give it a splash", the jets' auto-ping) | no | no | yes |
| `puzzle` | the drone's hints in a guardian's fight, asked for (Q, R3) | never | one line opens after each stretch of struggle (`STRUGGLE`: 40, 100, 180 s in the phase) | all at once |

Not hints, at every level: the scout's ping (the objective, on request, and its marker), the Controls
page (every control), the item cards (a new tool's card teaches its verb: `keyText(…, { teach: true })`),
the quest log, region names, the update toast.

**How the pieces read it.**

- `keyText` (`src/prompt-keys.js`), the one place every shown line resolves its `{key:verb}`s, runs
  `quietKeys` unless hints are full: a parenthesis naming a control goes, the clause after a colon that
  names one goes, "with {key:x}" after three words goes, and a sentence that is only controls goes. A toast
  left empty is skipped (`main.js` `showToast`). `{ teach: true }` keeps them.
- `quietOr(quiet, plain)`: a story line that said what happened and then what to do says only what
  happened, unless hints are full (the shove tips, "push it from the side", "Look up at the light").
- The floating use prompt (`src/story/index.js` `placePrompt`) and the cue (`src/hud.js` `cueText`) are
  the button alone (`#prompt.glyph`, `#cue.glyph`: a small badge, no pill) unless hints are full.
- `openHint(hint, secs)` and `Struggle` (`src/temples/hints.js`): main.js counts the seconds in the
  guardian's phase; with no line open yet the drone only watches (`◇ …`).
- The first steps (`src/first-steps.js`): the camera's line on subtle, the jump's on full only. The ship's
  prologue nudge (move and look, after 20 s without input) is left as it is: the minimal first-run teaching.

Settings saved before the setting (`hintsV` < 1) start on subtle once (`migrateSettings`). The audit of
every hint and what was decided: `docs/design/hints-audit.md`. Tests: `tests/hint-level.test.js`, and
the hint-level halves of `tests/first-run.test.js`, `tests/hud.test.js`, `tests/hints.test.js`,
`tests/key-placeholder.test.js`, `tests/feel.test.js`, `tests/foes.test.js`, `tests/boxes.test.js`.
