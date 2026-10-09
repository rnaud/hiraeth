---
name: combat-review
description: Rate how good Hiraeth's combat is and how interesting each enemy is — telegraphs, counterplay, use of space and the kit, threat against fairness, identity, how foes combine; the moves (combo, charged cut, air cut, riposte, dash cut, guard and parry, gun modes), feedback, the difficulty curve across worlds and the lock-on camera — by driving the Arena headless and reading the tuning, and write docs/audits/combat-v<version>.md with scores and recommendations. Use when reviewing combat feel, a foe's design, a new enemy, or before a release.
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

```sh
node .claude/skills/combat-review/arena.mjs <scratch>/combat [--kinds blot,crab] [--watch 24] [--version 1.4]
```

PORT (default 5333) and CDP (Chrome's debugging port, default 5338). For each kind, in the Arena (`?level=arena`):
- **watch**: it is called in (`foes.setPractice`), locked on, and fights a scripted player standing still (his health
  topped up, every hurt counted) for `--watch` s: the **wind-ups as seen** (its state `wind`, per attack: median s), the
  **attacks a minute**, the **health a minute** a still player loses (a threat measure: 1.0 is a full bar a minute);
- **time to kill** with each move (`scripts/combat-review/lib.mjs movesFrom`, from the game's own tuning): the light
  combo (1, 1, 2 over three swings), the full charged cut, the air cut, the riposte (on a stunned foe; its time adds one
  of the foe's attack cycles to wait for the parry), the dash cut (its cooldown), and the gun's shot, ember and push
  (tank charges, cooldown and refill). Each blow goes through `Foes.hurt` with the move's damage and source, so armour,
  shells, weak points and immunities answer as in play; ∞ means that move can't kill it alone;
- **a contact sheet**: each kind at the height of its wind-up, tiled 4 across (`telegraphs.png` / `.webp`) in the order
  of the table.

It writes `combat.json`, `combat.md` (the scored tables) and the contact sheet. Guardians are scored from their tuning
(telegraphs, attacks, openings, phases); play their temples for the rest (`?level=<world>` and the temple's door, or the
dev menu's temple jump).

## 2. The rubric, per foe (1-5 each)

| | 1 | 3 | 5 |
|---|---|---|---|
| **Readability / telegraph** | strikes with no tell, under 0.35 s | a clear tell around 0.5-0.7 s | a tell of the body and the floor ≥ 0.95 s, never confused with another attack |
| **Counterplay variety** | only the blade, one answer | two answers (guard, a gun mode) | many: a weak point, a parry effect, a mode that changes it, terrain |
| **Space, height and the kit** | flat ground, walks at you | uses range or a ledge | climbs, perches, flies, burrows, lobs, makes you jump or move |
| **Threat vs fairness** | harmless, or hurts hard on a short tell | a real threat on a fair tell | dangerous when ignored, always answerable |
| **Visual / audio identity** | a recoloured blot | its own tone or sound | a silhouette and a sound you know with your eyes shut |
| **Combines with others** | redundant with another kind | fits a pack | changes how the others must be fought (a ranged one behind melee, a shield…) |

The script's automatic scores: readability from the wind-up seen; counterplay from its answers (`takes`, `weak`, shells,
splits, parry effects…) and its attacks; space from its movement and attack shapes; fairness from the threat against the
telegraph; identity from its own tone and sound (confirm on the contact sheet: shape matters most); combines from how many
worlds field it and how rare its role is. Each comes with its reason (`combat.md`, "Why each foe scored as it did").

**Guardians** (the temples' bosses, `src/temples/boss.js`; organic ones are calmed, machines broken): readability (their
floor telegraphs, 0.8-1.7 s+), counterplay (attacks, the opening after them, the temple's own way to calm or break it),
space (shapes, tracking, the arena), fairness (damage against telegraph; the knock-down), phases (how the fight changes).

## 3. The combat as a whole (1-5 each, with reasons)

- **Responsiveness**: input buffer (`BLADE.buffer`), chain window (`BLADE.chain`), each swing's wind-up (`SWINGS[i].wind`),
  cancels (guard and evade out of a swing), the time from a press to the hit.
- **Feedback**: hit-stop and camera kick (`src/feel.js` `hitStop`, `kick`, `slowMo` on the last), sounds per foe, sparks
  and armour's thunk, the flash on a foe hit, the riposte's gold ring, the health bar's bite.
- **Move variety**: light combo, charged cut, air cut, riposte, dash cut, guard and parry, the gun's modes: is each one
  the best answer somewhere (the time-to-kill table: a move no foe wants is dead weight)?
- **Difficulty curve across worlds**: walk the route (`ORDER`) with each world's roster (`src/foe-worlds.js`): the leads'
  hp, threat and telegraph by world; does it rise, teach one idea at a time, and peak at the end?
- **Camera and lock-on**: `LOCK` (reach, lose), the flick to switch (`FLICK`), the reticle, the camera during a lock and
  with several foes; play it with a pad.

## 4. Write `docs/audits/combat-v<version>.md`

- **The setup:** commit, the date, how long each kind was watched, what was played by hand.
- **The scores:** the foes' table and the guardians' (from `combat.md`, with the scores you changed marked and why), the
  combat-as-a-whole table, and the contact sheet (`docs/audits/combat-v<version>/telegraphs.webp`, under 1 MB).
- **The best and the weakest foes**, and why.
- **Recommendations**, most valuable first: each a change to a foe or a system with the evidence (a score, a number).
  Put them in `TODO.md` as items, not fixes.
- **Against the last report**: what moved.

Add it to the `docs/audits/` line of `docs/README.md`. Documentation only: no changelog line, no tuning changes unless
asked.

## 5. Tell the user

The top three foes and the bottom three with their scores, the combat-as-a-whole scores, and the three recommendations
you'd do first.
