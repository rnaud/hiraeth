---
name: combat-review
description: Rate how good Hiraeth's combat is and how interesting each enemy is — telegraphs, counterplay, use of space and the kit, threat against fairness, identity, how foes combine; the moves (combo, charged cut, air cut, riposte, dash cut, guard and parry, gun modes), feedback, the difficulty curve across worlds and the lock-on camera — by driving the Arena headless and reading the tuning, and write docs/audits/combat-v<version>.md with scores and recommendations. Use when reviewing combat feel, a foe's design, a new enemy, or before a release. Telegraph timing and fairness are judged here; poses and motion in procedural-animation; building an enemy in enemy-rework.
---

# The combat review

A judgement of the fight, not a bug hunt: how readable, varied and fair each foe is, and how the whole combat feels,
scored on a fixed rubric so two reviews can be compared. Each report is `docs/audits/combat-v<version>.md`, compared with
the last. Numbers come from the Arena run and the tuning; **every automatic score is a starting point**: confirm or
override it by eye (the contact sheet, the pictures) and by playing, and say which you changed and why.

**The roster is growing** (a much larger set of enemies is on its way): nothing here names a kind. The script takes
every kind `src/foe-spawner.js` lists (`SPAWN_KINDS`, with each def from `src/foes.js` `FOES`) and every guardian it finds
in `src/temples/*.js` (any export with `phases` and `attacks`). With dozens of kinds, run it in batches (`--kinds`), and
group the report by world or by role rather than one long table.

Read first:
- `docs/systems/foes.md` (the kinds, attacks, "Staying in the fight", heights, the Arena) and `src/foe-kinds.js`'s header
  (what an attack may hold);
- `docs/systems/traveller-kit.md`, `docs/systems/controls.md` (the moves and their buttons), `src/fluid-blade.js` (the
  blade's timing: `BLADE`, `SWINGS`, `CHARGE`, `AIR`, `RIPOSTE`, `DASH`, `GUARD`, `EVADE`);
- `src/foe-worlds.js` (who fights where: the rosters), `src/temples/boss.js` (the guardians);
- the last `docs/audits/combat-v*.md`.

**Rules:** muted, never port 5173, one headless Chrome and one dev server at a time, closed when done; the script changes
no game code (it calls `foes.setPractice`, `foes.hurt` and reads state, nothing more).

## 1. Drive the Arena

Three scripts beside this file, each one Vite server and one muted headless Chrome, closed at the end (PORT and CDP
env vars; never 5173). Results so far and why each measure exists: docs/systems/foes.md, "The combat review's measures".

| script | purpose | key flags | writes |
|---|---|---|---|
| `arena.mjs <out>` | every kind watched against a still player, times to kill, the contact sheet, the guardians drawn | `--kinds a,b` `--watch 24` `--group role\|world` `--version 1.4` `--guardians no` `--drive 8` `--live-cap 40`; PORT 5333, CDP 5391 | `combat.json`, `combat.md` (the scored tables), `telegraphs.png`, `guardians.png` (and `.webp` when `cwebp` is there) |
| `arena.mjs <out> --packs route\|desert,arzach --ttk <kinds run>/combat.json` | the difficulty curve: each world's packs, world by world | `--pack-count 4` `--pack-watch 20` `--pack-look still\|lock` `--pack-clear` `--clear-cap 90` `--clear-dodge` `--dodge-watch 30` | `packs.json`, `curve.md` |
| `arena.mjs <out> --rescore <run>/combat.json [--moves-now]` | the scores and tables again from a run's numbers, no browser (after the rubric changed) | `--moves-now`: the times to kill re-timed with the moves as `lib.mjs movesFrom` times them now (the run's own tuning kept) | `combat.json`, `combat.md` in `<out>` |
| `dodge.mjs <out>` | the perfect dodge, foe by foe: does a hop inside the window start a flurry? | `--kinds` `--guardians no` `--side` `--wait 9`; PORT 5335, CDP 5393 | `dodge.json` (and a summary line) |
| `defend.mjs <out>` | guard, parry and evade at set leads, attack by attack | `--kinds` `--per 45` `--group role\|world` `--guard 0.5,0.3,…` `--evade 0.35,0.25,…`; PORT 5337, CDP 5395 | `defend.json`, `defend.md` |
| `guardian.mjs <out>` | **the guardians played** (node, no browser: each in its own temple, its real def, hooks and body): pace, tells, recovery, openings per phase, hitboxes against its posed mesh (`scripts/combat-review/reach.mjs`, also `tests/guardian-reach.test.js`), the lock point, its shadow; and the traveller's sidestep locked on | `--ids desert,incal` (`src/arena-guardians.js` ids; `all`) `--secs 90` `--grid 0.5` `--fps 60` (30: a handheld's frames; the body is sampled at the frames only) `--strict` (exit 1 on a FAIL) | `guardians.json`, `guardians.md` (FAIL lines) |

Method notes:
- Every kind starts from the Arena's spawn (the hops walk the traveller to the wall otherwise, where foes stand idle),
  and the time to kill strikes "from the front" into the foe's face; a kind that never winds up in its watch is watched
  once more (combat-v1.61: four silent kinds in a row in one full run).
- **Watch** (`arena.mjs`): each kind called in (`foes.setPractice`), locked on, against a still player whose health is
  topped up and every hurt counted: the wind-ups as seen (state `wind`, median s per attack), attacks a minute, health
  a minute (1.0 is a full bar a minute, in hearts over the traveller's hearts).
- **Time to kill** per move (`scripts/combat-review/lib.mjs movesFrom`, from the game's tuning): the light combo, the
  charged cut, the air cut, the riposte (plus one attack cycle to wait for the parry), the dash cut, the gun's shot,
  ember and push. Each blow goes through `Foes.hurt`, so armour, shells, weak points and immunities answer as in play;
  ∞ means that move can't kill it alone.
- **Puppeteers** (any kind with `puppeteer`): the s until its strings drop on a host, the host driven (`--drive`), the
  strings cut (`Foes.cutStrings`), the s until it strings again; to free is that wait plus a rope-cutting blow.
  **Rollers** (any attack with `rolls`): the share spent rolled up, and the gun and the combo dealt live (`--live-cap`).
- **Packs** (`src/foe-worlds.js` `packOf`, seeded): each world's skin and turns (`foes.stage`); hearts and attacks a
  minute, the time to kill (from `--ttk`), the hearts on arrival (`heartsOnArrival`), the cost (hearts a minute × the time
  to kill, a share of those hearts). The still player under-reads a big pack: `--pack-look lock` turns the camera to
  each striker, `--pack-clear` has a scripted traveller lock on, run in and deal each member's best move (a floor: he
  never misses or guards), `--clear-dodge` hops back at every blow inside the dodge window, `--dodge-watch` adds seconds
  of only that (how flurries chain).
- **Dodge** (`dodge.mjs`): when a blow is due inside `src/flurry.js` `dodgeLead`, back (or D: `--side`) and jump; every
  foe should dodge into a flurry; a timeout means it never struck within `--wait` s.
- **Defend** (`defend.mjs`): at each blow (`src/flurry.js` `foeThreat`), one try at a set lead: guard (Ctrl, held) or
  evade (Alt, tapped), read from `Player.guard` ('perfect' a parry, true a block), `Player.dodge`, `Player.hurt`. A row
  per attack: P, B, E, H, · (missed anyway), the furthest lead the guard holds from, the parry's and evade's windows
  (against `GUARD.perfect`, `EVADE.iframes`). A missing parry window, an evade that never takes, or a guard that can't
  hold from 0.3 s is a finding.
- **Guardians** are scored from their tuning (telegraphs, attacks, openings, phases) **and played** (`guardian.mjs`,
  since v1.69: the Keeper's playtest, issues #314–#316, found what the tuning hid: blows landing up to 13.7 m from its
  body, the lock 5.6 m under its mouth, no opening at all in its last phase, a combo's blows under a second apart, no
  shadow in its hall, and the traveller's sidestep drifting off it). Every phase is played 90 s in three manners: a
  still traveller (takes every blow), one who **dodges** every blow (in the air through its live window) and one who
  **guards** every blow. Its FAIL lines, each a finding (open an issue):
  - a phase with **no opening** (under 1 a minute) for the dodger or the guard, its temple's own rules included
    (`def.openFor`: the Keeper's dark);
  - an own move's **wind-up** under 0.8 s, a link under 0.6 s, a combo's next blow under 1.2 s after the last, under
    0.8 s from a strike to its next move's wind-up (the **recovery**, openings counted inside it);
  - **hitboxes against the mesh**: each move at its strike, the floor its hit takes (the game's own test,
    `Guardian.wouldHit`: its bones' spheres for a move with `parts`, its posed mesh's for a body without bones, its
    `blast`'s beam or front where it is now, else its shape at `points()`) against the floor its mesh and its drawn blow
    (`Guardian.blast.meshes()`) sweep at the traveller's height over the blow (since v1.71, issue #319, measured on the
    hall's floor; the body touching a traveller across his column's 0.45 m footprint): over 15 % of the hit more than 1 m
    from its body, or any hit more than 1.5 m from it, fails (since v1.87, issue #558, a test too: `tests/guardian-reach.test.js`); "body not hit" is what of its body strikes nothing (legs that only walk);
  - the **lock point** more than 0.6 m from its weak point (`model.mouth`; the lock aims at `GuardianLock.aim`);
  - look for a skin **facing away** from its heading (issue #319: the Keeper's and the Elder's faced π − heading in
    their halls): `tests/guardian-fairness.test.js` checks it; in a shot, its glow and its lowered head on your side;
  - a mesh of its body kept out of the **shadow** passes, or no contact shadow under it (`Guardian.ground`; a temple's
    hall gets no sun: look at it in its hall, not in the Arena);
  - the traveller's **sidestep**: a 2 s strafe or a side hop locked on carrying him more than 0.25 m off the foe.
  Look at it too: the hitbox overlay (F4, `src/hitboxes.js` `guardianHitboxes`) draws a guardian's blow on its bones
  (orange winding, red live), its weak point and the lock's mark; shoot it from the side in its own hall
  (`?level=<world>&debugsave=1`, the dev menu's temple jump, or `level.temples` and `player.teleport`), mid wind-up and at
  the strike, and the lock from the game's camera.

### The fight temples (`fight-temples.mjs`, since v1.85)

The twelve fight temples (`src/fight-temples/`, docs/design/fight-temples.md) are a combat of their own: a fixed
isometric camera, the roll on B / ○, no jump, the wide cut (`WIDE_CUT`) and the quicker combo (`QUICK_CUT`), waves of
light foes (`LIGHT_HP`, `LIGHT_HARM`: their first attack only), gorged and tough ones, a hazard a world, ranks and par
times. Play them, don't read them:

| script | purpose | key flags | writes |
|---|---|---|---|
| `fight-temples.mjs <out>` | each temple played through in headless Chrome (`?game=fight-<world>&seed=<n>`) by a scripted traveller on the game's own keys, with the hearts he has on arriving in that world (`lib.mjs heartsOnArrival`): the clear time against par and the rank, the hearts lost by cause (each kind, each hazard), the knock-outs (refilled, so the run goes on), the wind-ups as seen, blows a minute, the crowd, each room's time and harm, frame times, the page's errors (Tab pressed now and then: the lock must do nothing in here) | `--worlds desert,bazaar` `--bot skilled\|masher` (skilled: rolls out of blows due in 0.22 s and out of the hazard; masher: walks in and cuts) `--gentle` `--seed 4821` `--cap 420`; PORT 5482, CDP 5483 | `fight-<bot>.json`, `shots/` (each room at its fullest, each hazard's first warning, the results card) |

Score each temple as a whole on the same six criteria as a foe (its waves as one foe: the telegraphs of what it fields
and its hazard's warning; the answers the room asks for; the use of its space and hazard; harm against hearts on
arrival; its look and hazard as its identity; how its kinds combine), and judge the curve by the hearts lost against
the hearts on arrival, temple by temple along the route (`src/levels/names.js` `ORDER`). The script's sticks go on the
keyboard object past its proxy (`main.js latchedInput` latches anything set through it to `true`): a right stick of
`true` aimed the cut at NaN and froze the page.

## 2. The rubric, per foe (1-5 each)

| | 1 | 3 | 5 |
|---|---|---|---|
| **Readability / telegraph** | strikes with no tell, under 0.35 s | a clear tell around 0.5-0.7 s | a tell of the body ≥ 0.95 s (its pose, the glow on its striking part, the rising sound; a landing mark only for what is thrown), never confused with another attack |
| **Counterplay variety** | only the blade, one answer | two answers (guard, a gun mode) | many: a weak point, a parry effect, a mode that changes it, terrain |
| **Space, height and the kit** | flat ground, walks at you | uses range or a ledge | climbs, perches, flies, burrows, lobs, makes you jump or move |
| **Threat vs fairness** | harmless, or hurts hard on a short tell | a real threat on a fair tell | dangerous when ignored, always answerable |
| **Visual / audio identity** | a recoloured blot | its own tone or sound | a silhouette and a sound you know with your eyes shut |
| **Combines with others** | redundant with another kind | fits a pack | changes how the others must be fought (a ranged one behind melee, a shield…) |

The script's automatic scores: readability from the wind-up seen; counterplay from its answers (`takes`, `weak`, shells,
splits, parry effects…) and its attacks; space from its movement and attack shapes; fairness from the threat against the
telegraph; identity from its own tone and sound (confirm on the contact sheet: shape matters most); combines from how many
worlds field it and how rare its role is. Each comes with its reason (`combat.md`, "Why each foe scored as it did").

**Guardians** (the temples' bosses, `src/temples/boss.js`; organic ones are calmed, machines broken; staged fights since
v1.6): readability (the body tells of its own moves, 0.8-1.35 s+; a combo's links ≥ 0.6 s; a floor-drawn attack that
isn't a lob costs a point), counterplay (moves, combos, the openings after them or after a miss, the temple's own way
to calm or break it), space (shapes, tracking, dives, shock rings, lobs), fairness (links and wind-ups against damage;
the knock-down), phases (how many, and whether each adds moves). From `guardian.mjs`, override the tuning's scores:
fairness is at most 2 with a phase without openings, a blow landing over 1.5 m from its body or the lock off its weak
point; at most 3 with a combo's blows under 1.2 s apart or over 3 hearts a minute to a still traveller. The first
guardian on the route (the Keeper) is a teacher: every phase open after every move, a combo of two at most before its
last phase. `arena.mjs` also draws `guardians.webp`: each guardian
in an Arena ring, phase by phase, at 85 % of the phase's first move (`--guardians no` skips it).

## 3. The combat as a whole (1-5 each, with reasons)

- **Responsiveness**: input buffer (`BLADE.buffer`), chain window (`BLADE.chain`), each swing's wind-up (`SWINGS[i].wind`),
  cancels (guard and evade out of a swing), the time from a press to the hit.
- **Feedback**: hit-stop and camera kick (`src/feel.js` `hitStop`, `kick`, `slowMo` on the last), sounds per foe, sparks
  and armour's thunk, the flash on a foe hit, the riposte's gold ring, the health bar's bite.
- **Move variety**: light combo, charged cut, air cut, riposte, dash cut, guard and parry, the gun's modes: is each one
  the best answer somewhere (the time-to-kill table: a move no foe wants is dead weight)?
- **Difficulty curve across worlds**: walk the route (`ORDER`) with each world's roster (`src/foe-worlds.js`): the leads'
  hp, threat and telegraph by world, and the `--packs` run's cost share; does it rise, teach one idea at a time, and peak
  at the end (the Signal Market)?
- **Camera and lock-on**: `LOCK` (reach, lose), the flick to switch (`FLICK`), the reticle, the camera during a lock and
  with several foes; play it with a pad. Here lock-on is judged as a combat tool; the lock-on camera's motion (pops,
  spins, the foe hidden behind him) is camera-qc's (its `arena-lock` scenarios).

## 4. Write `docs/audits/combat-v<version>.md`

Start the report with its score block, right under the title (an HTML comment GitHub hides; the audits page,
`audits.html`, reads it: `src/audits-page/parse.js`, docs/systems/ui.md "The audits page"):

```
<!-- audit-scores
overall: the mean of every foe's and guardian's total / 5
label: what the overall is the mean of
date: YYYY-MM-DD
-->
```

Keep the score tables with one row per foe kind or guardian. How the page reads them (columns, marks, comparing with
the last report): docs/systems/ui.md, "The audits page", "Score tables, for the skills that write reports".
`node --test tests/audits-page.test.js` checks the block.

- **The setup:** commit, the date, how long each kind was watched, what was played by hand.
- **The scores:** the foes' table and the guardians' (from `combat.md`, with the scores you changed marked and why), the
  combat-as-a-whole table, and the contact sheet (`docs/audits/combat-v<version>/telegraphs.webp`, under 1 MB).
- **The best and the weakest foes**, and why.
- **Recommendations**, most valuable first: each a change to a foe or a system with the evidence (a score, a number).
  Open them as GitHub issues (TODO.md's tracker), not fixes.
- **Against the last report**: what moved.

Add it to the `docs/audits/` line of `docs/README.md`. Documentation only: no changelog line, no tuning changes unless
asked.

## 5. Tell the user

The top three foes and the bottom three with their scores, the combat-as-a-whole scores, and the three recommendations
you'd do first.
