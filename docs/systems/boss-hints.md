# Guardians: the bar and the drone's hints

**The bar** (`src/temples/boss.js` `guardianBar`, drawn by `runtime.js` `meterHud`): what is left of the
guardian, full when it wakes and going down as the fight goes your way. A machine's bar is its
*health*; a living guardian's is its *unrest* (it is calmed, never hurt). The meter underneath is
unchanged (0 → 1, damage or calm); the bar shows `1 - meter`. It sits above the cue line.

**The drone's hint** (`src/temples/hints.js`, `src/scout.js`): while a temple's guardian is awake and
you are inside, a ping (Q, R3 with no foe in reach, touch "ping") asks for a hint instead of the objective.
`guardianHint(rt)` gives the scout `{ id, lines, at }`:

- `id` is the temple and the phase (`incal.1`): a new phase starts its lines over;
- `lines` are three per phase in `BOSS_HINTS[templeId].phases[i]`: a nudge, plainer, plainest. Each
  ping on the same id says the next; the last one stays. The gentle way first wherever the game has
  one; a weary guardian waiting for your hand gets one line, its `touch` prompt;
- `at()` is where the lens points, followed while it moves: `BOSS_HINTS[id].at(g, phase)` (an unlit
  brazier, a dead bed, the hidden vent, the glowing sphere) or the guardian's weak point,
  `model.mouth`.

**When the lines open** (`openHint`, the Hints setting: `docs/systems/hints.md`): on subtle (the default)
none at first (the drone only watches, `◇ …`), then one more after each stretch of the phase
(`STRUGGLE`: 40, 100, 180 s, counted by main.js's `Struggle`); on full all three at once; off, never. A
line naming a button writes it `{key:verb}`, taken out unless hints are full.

The drone rises over your shoulder (`HINT`), turns its lens on `at()` with a short beam, chirps
(`sound.drone('hint')`) and calls `onHint(line)`; main.js puts it on the cue for `HINT.say` seconds.
No flare is dropped. A find (no guardian) has no beam and no beak: the drone's own heading points
the way, and the flare marks the spot.

A new temple adds its guardian's lines to `BOSS_HINTS` (`tests/bosses.test.js` checks every temple
has three per phase).

**Per-phase open lines**: a phase may carry its own `openHint` (the warden's crown); the open line is
said once per phase.
