# The ember wisp: the fireball foe (issue #398)

2026-10-16. The author: "add a floating monster, it sends a fireball, you have to hit with your sword to send the ball back
and hit it". Its mechanic is built (src/fireballs.js, src/foes.js, docs/systems/foes.md "The ember wisp's fireball") on a
**stand-in body** (src/enemies/plans/ember.js: two lids of dark shell round a glowing coal). Its real body waits for the
author to pick a design sheet from the prompts below (`art: 'pending'` in src/enemies/archetypes.js). Once a sheet is picked, save it as
`references/enemy-archetypes/wisp/sheet-1.jpg` with its manifest, and rebuild the body with the enemy-rework skill.

## Role

**Bombardier** (archetype 22, the roster's fifth spirit, tier 2, ranged). It is the one foe whose own attack is the answer
to it. It stays out of the blade's reach, 4.2 m up, and backs off when you close in. So the fight is about one timed cut
rather than chasing it. It teaches reading a projectile's arrival, much as the shade teaches the parry. In a pack it gives the
others' blows a rhythm to work round: a ball comes in every few seconds, and you deal with it while you fight the rest.

- **Fireball.** The shell opens like a clam's, the coal swells and turns white-hot, and the body rears back, with a crackle
  rising over 1.05 s. Then a slow ball (6.5 m/s) flies at you, homing gently. **Answer:** cut it as it arrives and it flies
  back, faster, into the wisp. The wisp is stunned and drops to the sand, where cuts land double. A perfect parry also
  sends it back. A plain guard puts it out, and an evade or a late step aside lets it fly past.
- **Flare** (when you get under it). The lids clench shut and the seam glows red for 1.0 s, then a burst of heat
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

These are for Midjourney in the author's browser, made the way the existing sheets were
(docs/design/enemy-roster-prompts.md, "What every prompt keeps"): four views at one scale, the wind-up pose that the
game uses as its telegraph, the black silhouette under the side view, the small traveller for scale, cream paper, and the
house style's common tail. Run each at the default model (add `--v 8.2` if the default has moved). The author picks.
The chosen sheet becomes `sheet-1.jpg`, and an alternate skin is run from it with the image URL pasted first, as for the
other archetypes.

**1. The clam shell (closest to the stand-in).**

```
Spirit design reference sheet for a science fiction exploration game: one ember wisp, a small floating spirit, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its fireball wind-up with its shell opened wide like a clam and the coal inside swollen white-hot, the body reared back. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands below it for scale; the wisp is the size of a pumpkin and hovers four metres up, well above the traveller's head. Body plan: a round shell of hardened black ink in two lids hinged at the back, cracked all over with thin orange light showing through the cracks, a single fin along the upper lid's crown, two small pale eyes low on the upper lid, a glowing coal in the middle, and a short tail of smoke beads hanging beneath; no limbs. The manifestation: a borrowed fire, the dark cupped round a stolen coal, a lamp where no lamp should be. Moon Foundry palette: ink-black and soot-violet shell, brass rim on the lids, molten orange and butter-yellow coal, pale cream eyes. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels scenery collage flames-everywhere
```

**2. The lantern husk (a found object the dark wears).**

```
Spirit design reference sheet for a science fiction exploration game: one ember wisp, a floating spirit, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its fireball wind-up, its iron cage-shell splitting open along its ribs, a coal swelling white-hot inside, smoke streaming upward. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands below it for scale; the wisp hovers four metres up, above the traveller's head. Body plan: a hollow, cracked lantern-like husk of black ink with curved ribs like a birdcage, a ring of small holes round its waist, one long smoke ribbon trailing behind it, two pale slit eyes in the dark between the ribs, an ember coal floating at its heart. The manifestation: the dark wearing a lamp's shape to copy the singing light, glowing from inside, cold outside. Palette: ink-black ribs with violet sheen, ember orange coal, gold sparks, a cream glow on the ribs nearest the coal. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**3. The ink moth-lamp (wings that fold round the coal).**

```
Spirit design reference sheet for a science fiction exploration game: one ember wisp, a floating spirit, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its fireball wind-up with its four stiff ink petals opened outward like a flower around a white-hot coal, the body tilted back. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands below it for scale; the wisp hovers four metres up. Body plan: four curved petals of hardened black ink closed into a bud around a glowing coal, a thin ring of light round the bud's waist, two small round pale eyes on the front petal, three drips of ink hanging from its base like a tassel; it bobs slowly, no limbs. The manifestation: the dark folded round a stolen ember, a false flower of light. Palette: glossy ink-black petals with deep violet shadows, a thin white-gold ring, orange and yellow coal, pale lilac eyes. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin** (run once a main sheet is picked; the image URL pasted first):

```
[sheet-1 image URL] Use the attached sheet only for the creature's shape, anatomy, proportions and poses; repaint it completely in a new colour scheme that reads as a different colour at a glance: none of the attached sheet's colours may remain. The same ember wisp, same shell and coal, redrawn as Lorn II's marsh wisp: a mossy dark green-black shell with pale lichen, a brass rim, the coal a cold green marsh-light, pale green eyes. Front, side and three-quarter views and the opened wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering scenery collage
```

## What a picked sheet must keep (for the rework)

- **Readable from 10 m:** one opening that shows the coal swelling (the telegraph), and one point of glow it throws from.
- **A body under 1.3 m across,** so that lying stunned on the sand it reads as down and within reach.
- **No legs or arms:** it floats. Its smoke or tail is the secondary motion.
