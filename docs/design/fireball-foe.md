# The ember wisp: the fireball foe (issue #398)

2026-10-16. The author: "add a floating monster, it sends a fireball, you have to hit with your sword to send the ball back
and hit it". Its mechanic is built (src/fireballs.js, src/foes.js, docs/systems/foes.md "The ember wisp's fireball") on a
stand-in body at first; since issue #440 it wears its picked sheet (`references/enemy-archetypes/wisp/sheet-1.jpg`, the ink
moth-lamp; src/enemies/plans/ember.js, `art: 'sheet-1'`): four glossy ink petals closed into a bud round a glowing coal,
a ring of light round its waist, two lilac eyes on the front petals, three drips of ink hanging under it. Sheets 2 and 3
(the clam shell, the lantern cage) were picked as references only.

## Role

**Bombardier** (archetype 22, the roster's fifth spirit, tier 2, ranged). It is the one foe whose own attack is the answer
to it. It stays out of the blade's reach, 4.2 m up, and backs off when you close in. So the fight is about one timed cut
rather than chasing it. It teaches reading a projectile's arrival, much as the shade teaches the parry. In a pack it gives the
others' blows a rhythm to work round: a ball comes in every few seconds, and you deal with it while you fight the rest.

- **Fireball.** The four petals open like a flower, the coal swells and turns white-hot, and the body rears back, with a crackle
  rising over 1.05 s. Then a slow ball (6.5 m/s) flies at you, homing gently. **Answer:** cut it as it arrives and it flies
  back, faster, into the wisp. The wisp is stunned and drops to the sand, where cuts land double. A perfect parry also
  sends it back. A plain guard puts it out, and an evade or a late step aside lets it fly past.
- **Flare** (when you get under it). The petals clench shut and the seams glow red for 1.0 s, then a burst of heat
  spreads round it. **Answer:** step out.
- **Other answers:** the grappling hook pulls it down (it is a `flyer`), and a shot douses a ball in the air.

## Name

**Ember wisp.** Its skins are the **cinder wisp** (the Moon Foundry), the **marsh wisp** (Lorn II) and the **corona wisp**
(the City During the Eclipse).

## In the lore

It is a spirit: the dark itself, the loose ink taking a shape (docs/design/enemy-roster.md, "Spirits"). Each spirit
shows itself in its own way. The wisp is **a borrowed fire**: a shell of hardened ink cupped round a stolen coal. It is
the dark's poor copy of the singing light (docs/story-bible.md, "The thread"). The real light dipped low over every world on the
night before the ship was found, "like it was looking for something". The wisps came after it. They hang where light
is kept and copy it: over the founders' furnaces, over the Deep Wood's lit pools, where people keep lamps for travellers who
never come, and in the city where the sun has gone out. From far off a wisp looks like a lamp where no lamp should be.
Up close, it throws the fire it took. Sent back, the fire goes home to it, and the shell cannot hold it.

Where it is met, and why:

- **The Moon Foundry** (route, stage 3): the casting floor's furnaces, the one place in the game where fire is the work
  (Bertil's furnace is still warm). Cinder wisps drift over the heat. It is also in the Foundry's fight temple, the Pour
  Floor (the mould floor's second wave, and two in the great crucible's first).
- **Lorn II** (route, stage 1): the Deep Wood, whose people keep the pools lit. The marsh wisp is the old will-o'-the-wisp,
  a false light over the water.
- **The City During the Eclipse** (a side world): the corona wisp, a black shell ringed with white fire, mimicking the
  sun that has gone out.

(The roster asks each archetype to appear in three to seven worlds, so it has three.)

## Prompts for its design sheet

The prompts are in the enemy roster's prompt document, as archetype 22
([enemy-roster-prompts.md](enemy-roster-prompts.md), "22. Ember wisp", id `wisp`), in the same format as the other
archetypes' sheets: three candidate main sheets (the clam shell, closest to the stand-in; the lantern husk; the ink
moth-lamp) and the marsh wisp's alternate skin, run from the picked sheet. They run in the reference lab (issue #437,
docs/systems/reference-lab.md): text alone, Gemini and OpenAI,
`node scripts/gen-reference.mjs --from docs/design/enemy-roster-prompts.md#wisp` (and `#wisp/v2`, `#wisp/v3`). The
author picks in the lab's Pick mode; the pick becomes `sheet-1.jpg` in the archetype's folder. The alternate skin is
run afterwards with that sheet as its base (`#wisp/alt --refs <the picked sheet-1>`): batch 2026-10-17-18-05-08-badb
(OpenAI, two candidates), waiting for the author's pick.

## What a picked sheet must keep (for the rework)

- **Readable from 10 m:** one opening that shows the coal swelling (the telegraph), and one point of glow it throws from.
- **A body under 1.3 m across,** so that lying stunned on the sand it reads as down and within reach.
- **No legs or arms:** it floats. Its smoke or tail is the secondary motion.
