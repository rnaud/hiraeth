# Enemy roster v4: one simple set of foes for every world

2026-10-28, issue #726 (part of #722). The author, discarding most of the v3 sheets: "the designs are too complex
and you are trying to create characters that are based on each worlds but that's not necessary. I'd rather create
enemies that are the same across all worlds but better designed and more easily recognizable."

Round 1 (black ink bodies, white masks): "a bit too simplistic now and they look too much like characters out of
hollow knight". Round 2 (wanderers in pale wrapped cloth, brass lens heads): "I don't like the drapes, I think I'd
rather we have them be droids or monsters (with a colored skin like botw). Botw has both defunct robots and monsters".

**The rules (round 3).**
- One roster, met in every world. No world costumes, no world palettes.
- Two families, as in Breath of the Wild: **monsters** with a coloured skin, and **defunct droids**, the makers' old
  machines (the same ancient high tech as the temples and the fencer).
- A monster's skin colour is its tier (#722): the base colour first, a darker banded one in later worlds. The role
  is read from the silhouette and the weapon; the sheets show the base colour.
- Human proportions for both, so the traveller's clips drive them (#724).
- Medium detail: a clear silhouette, a few well-chosen parts, no pile of trinkets. Original designs, not copies of
  any game's creatures.

Run in the reference lab (docs/systems/reference-lab.md) with its defaults (Gemini and OpenAI), no style references:

```
node scripts/gen-reference.mjs --from docs/design/enemy-roster-v4-prompts.md#grunt --n 2
```

Target folder: `references/enemy-archetypes/<id>/`

## Monsters

### 1. Grunt (`grunt`)

**Main sheet: monster, the rank and file: small, in groups, a club; picks up a bow or a spear it finds.**

```
Character design reference sheet for a science fiction exploration game: one grunt, a small stocky monster, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its attack wind-up with a crude club raised over its head in both hands. A small cloaked human traveller with a round jade backpack stands beside it for scale; the grunt is 1.3 metres tall, a little shorter than the traveller. Design: human proportions and joints, a big head with a wide flat snout, two small tusks, long pointed ears and small bright eyes, a round belly, short bandy legs, three-toed feet; smooth tomato-red skin, the base colour of its kind; a simple loincloth and one leather strap across the chest; a knobbly wooden club. Mischievous and dim, more comic than frightening. Original design, medium detail, a strong readable silhouette. Moebius science-fiction, Franco-Belgian ligne claire, fine pen contours, sparse delicate hatching in shadows, luminous flat pastel gouache colours, cream paper grain, evenly spaced views, fully visible bodies, no lettering --ar 16:9 --no photorealism 3d-render text lettering labels scenery hollow-knight white-mask drapes bandages mummy robes gore
```

### 2. Hulk (`hulk`)

**Main sheet: monster, the big one: slow heavy blows, picks up and throws grunts.**

```
Character design reference sheet for a science fiction exploration game: one hulk, a huge monster, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its attack wind-up with a long iron-bound club swung back over its shoulder in both hands. A small cloaked human traveller with a round jade backpack stands beside it for scale; the hulk is 2.7 metres tall, twice the traveller's width. Design: human proportions and joints, a hunched massive back, long heavy arms reaching to its knees, a small head with a jutting jaw, a single short horn on its brow and small eyes; smooth slate-blue skin with a pale belly, the base colour of its kind; a hide kilt and a rope belt; a long club. Slow and heavy. Original design, medium detail, a strong readable silhouette. Moebius science-fiction, Franco-Belgian ligne claire, fine pen contours, sparse delicate hatching in shadows, luminous flat pastel gouache colours, cream paper grain, evenly spaced views, fully visible bodies, no lettering --ar 16:9 --no photorealism 3d-render text lettering labels scenery hollow-knight white-mask drapes bandages mummy robes gore
```

### 3. Prowler (`prowler`)

**Main sheet: monster, the quick one: circles you, dodges, flips away, darts in; spits at range.**

```
Character design reference sheet for a science fiction exploration game: one prowler, a lean reptilian monster, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view caught mid back-flip, and its attack wind-up crouched low on bent legs with a short curved blade drawn back, its tail lashing. A small cloaked human traveller with a round jade backpack stands beside it for scale; the prowler is 1.8 metres tall standing, often crouched. Design: human proportions and joints, a long narrow lizard head with a crest of short spines, wide-set yellow eyes, a long tail, long digitigrade legs, three clawed fingers; smooth leaf-green scaly skin with a cream throat, the base colour of its kind; a single shoulder guard; a short curved blade. Quick and sly. Original design, medium detail, a strong readable silhouette. Moebius science-fiction, Franco-Belgian ligne claire, fine pen contours, sparse delicate hatching in shadows, luminous flat pastel gouache colours, cream paper grain, evenly spaced views, fully visible bodies, no lettering --ar 16:9 --no photorealism 3d-render text lettering labels scenery hollow-knight white-mask drapes bandages mummy robes gore
```

### 4. Warlord (`warlord`)

**Main sheet: monster, the rare elite: one per world at most, guards a place, every move hits hard.**

```
Character design reference sheet for a science fiction exploration game: one warlord, a tall powerful monster, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its attack wind-up with a heavy two-handed glaive drawn back for a sweeping cut. A small cloaked human traveller with a round jade backpack stands beside it for scale; the warlord is 2.5 metres tall, broad and upright. Design: human proportions and joints, a maned head like a great cat crossed with a ram, two curled horns, a heavy brow, a broad chest; smooth deep crimson skin with a dark mane, the base colour of its kind; a few plates of rough bronze armour on the shoulders and a wide belt; a long glaive. Proud and dangerous. Original design, medium detail, a strong readable silhouette. Moebius science-fiction, Franco-Belgian ligne claire, fine pen contours, sparse delicate hatching in shadows, luminous flat pastel gouache colours, cream paper grain, evenly spaced views, fully visible bodies, no lettering --ar 16:9 --no photorealism 3d-render text lettering labels scenery hollow-knight white-mask drapes bandages mummy robes gore
```

## Droids

### 5. Sentinel (`sentinel`)

**Main sheet: droid, the duellist: sword and shield, guards, parries, ripostes.**

```
Character design reference sheet for a science fiction exploration game: one sentinel, a defunct humanoid guard droid of an ancient vanished civilisation, drawn four times side by side at the same scale on a plain cream background: front view behind its shield, side view, three-quarter view, and its attack wind-up with a blade arm drawn back and its shield arm forward. A small cloaked human traveller with a round jade backpack stands beside it for scale; the sentinel is 2 metres tall, slim and upright. Design: human proportions and joints, a smooth ancient body of pale ivory ceramic panels over dark jointed limbs, one round glowing amber eye in a narrow smooth head, a round shield built into its left forearm and a straight blade extending from its right; weathered, chipped and stained with age, a little moss in the joints, glowing amber seams. Still and precise, it moves in sudden bursts. Original design, medium detail, a strong readable silhouette. Moebius science-fiction, Franco-Belgian ligne claire, fine pen contours, sparse delicate hatching in shadows, luminous flat pastel gouache colours, cream paper grain, evenly spaced views, fully visible bodies, no lettering --ar 16:9 --no photorealism 3d-render text lettering labels scenery hollow-knight white-mask drapes bandages mummy robes gore
```

### 6. Oracle (`oracle`)

**Main sheet: droid, the caster: hovers back, fires bolts of light, shields or wakes the others.**

```
Character design reference sheet for a science fiction exploration game: one oracle, a defunct hovering caster droid of an ancient vanished civilisation, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its attack wind-up with both hands raised and a sphere of amber light gathering between them. A small cloaked human traveller with a round jade backpack stands beside it for scale; the oracle is 1.8 metres tall and floats a hand's breadth off the ground. Design: a person's head, shoulders and two thin arms, its body ending in a tapering ceramic shell instead of legs; a tall smooth head with one large round amber eye; pale ivory ceramic panels over dark joints, a slowly turning ring around its shoulders; weathered, chipped and stained with age, glowing amber seams. Calm and eerie. Original design, medium detail, a strong readable silhouette. Moebius science-fiction, Franco-Belgian ligne claire, fine pen contours, sparse delicate hatching in shadows, luminous flat pastel gouache colours, cream paper grain, evenly spaced views, fully visible bodies, no lettering --ar 16:9 --no photorealism 3d-render text lettering labels scenery hollow-knight white-mask drapes bandages mummy robes gore
```

### 7. Crawler (`crawler`)

**Main sheet: droid, the scout that raises the alarm: skitters close, flashes, calls the others, self-destructs at low HP.**

```
Character design reference sheet for a science fiction exploration game: one crawler, a small defunct scout droid of an ancient vanished civilisation, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its alarm wind-up reared back on its hind legs with its eye flaring. A small cloaked human traveller with a round jade backpack stands beside it for scale; the crawler is knee-high to the traveller. Design: a round ceramic body like a half-buried dome on four jointed legs, one large round amber eye in front, a short antenna; pale ivory ceramic panels over dark joints; weathered, chipped and stained with age, glowing amber seams. Curious and twitchy. Original design, medium detail, a strong readable silhouette. Moebius science-fiction, Franco-Belgian ligne claire, fine pen contours, sparse delicate hatching in shadows, luminous flat pastel gouache colours, cream paper grain, evenly spaced views, fully visible bodies, no lettering --ar 16:9 --no photorealism 3d-render text lettering labels scenery hollow-knight white-mask drapes bandages mummy robes gore
```
