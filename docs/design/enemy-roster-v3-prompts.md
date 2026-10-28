# Enemy roster v3: reference prompts for the humanoid foes

2026-10-27, issue #724 (part of #722). The author, after picking the mummers: "we have too many enemies that are
animals and low profile to the ground, we should have more that are humanoid so we can wire their animations better
rather than doing 100% procedural". The designs are in [enemy-roster-v3.md](enemy-roster-v3.md). One main-sheet prompt
each, in the house style of [enemy-roster-v2-prompts.md](enemy-roster-v2-prompts.md): the same body four times at one
scale (front, side, three-quarter, and the wind-up of its signature attack), its black silhouette under the side view,
the small cloaked traveller with the round jade backpack for scale, plain cream paper.

**One rule for all seven:** human proportions under the costume (hips, knees, shoulders and elbows where a person's are,
two arms, two legs, a head on a neck), because they are animated with the traveller's clip libraries retargeted onto
their skeleton. The strangeness is in what they wear and carry, never in the joints.

Run in the reference lab (docs/systems/reference-lab.md) with its defaults (Gemini and OpenAI), no style references:

```
node scripts/gen-reference.mjs --from docs/design/enemy-roster-v3-prompts.md#pilferer --n 2
```

Target folder: `references/enemy-archetypes/<id>/`

## Spirits

### 1. Pilferer (`pilferer`)

**Main sheet: Lorn II (the thief, after the rejected gullet).**

```
Spirit design reference sheet for a science fiction exploration game: one pilferer, a lanky thief made of living ink dressed in a long patched coat, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view running away hunched over with a small round jade shield clutched to its chest, and its snatch wind-up, crouched low on bent knees with one long arm drawn far back and its fingers spread, ready to lunge and grab. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the pilferer is 1.8 metres tall, a head taller than the traveller, thin and stooped. Body plan: human proportions, a thin person-shaped figure with hips, knees, shoulders and elbows where a person's are, slightly too-long arms ending in long four-fingered ink hands, two thin legs in wrapped puttees and soft cloth shoes; a long many-pocketed coat with the hem swinging at the shins, a big empty sack slung across its back on a rope; its head is a tin funnel worn upside down as a hood with two small white eyes shining in the dark under the rim. The manifestation: ink that wants what it sees, black ink dripping from its fingertips and the coat's pockets, nothing but wet black under the funnel. Sly and comic, a pickpocket from a folk tale, not a goblin, no teeth, no skin. Lorn palette: a moss-green and rust-red patched coat, brass buttons, a dull tin funnel, a pale canvas sack, the ink black with a teal sheen. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage goblin teeth skin gore
```

### 2. Door-bearer (`doorbearer`)

**Main sheet: Arzach II (the tank, after the shellback crab).**

```
Spirit design reference sheet for a science fiction exploration game: one door-bearer, a broad heavy figure of living ink carrying a whole wooden door as a shield, drawn four times side by side at the same scale on a plain cream background: front view with the door held up in front of it covering it from shins to eyes, side view with the door lowered at its side showing its body, three-quarter view, and its shield-slam wind-up, the door hoisted high over its head with both arms, leaning back, ready to bring it down flat on the ground in front of it. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the door-bearer is 2.2 metres tall and twice as wide as the traveller. Body plan: human proportions but heavy, a barrel chest, thick arms with clear elbows, two sturdy legs with knees bending forward and wide flat ink feet; it wears a quilted canvas coat strapped with leather belts and a riveted tin breastplate and two tin shoulder plates that can be knocked off; its head is an upturned stone mortar worn as a helmet with a narrow slit where two white eyes shine; in its right hand a short heavy mallet; the door in its left hand is weathered planks with an iron ring handle and a small round window. The manifestation: ink that keeps out, black ink seeping between the planks and from under the plates. Stubborn and slow, a doorman, not an ogre, no teeth, no skin. Cliff palette: slate blue-grey quilted coat, pale weathered door planks, terracotta-red tin plates, cream lichen on the door, the ink black with a blue sheen. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage ogre orc troll teeth skin
```

### 3. Lancer (`lancer`)

**Main sheet: Arzach (the reach foe, after the stilt heron).**

```
Spirit design reference sheet for a science fiction exploration game: one lancer, a tall thin figure of living ink carrying a very long hooked pole, drawn four times side by side at the same scale on a plain cream background: front view standing with the pole upright beside it, side view, three-quarter view, and its sweep wind-up, the pole drawn far back low behind it in both hands, its body twisted away and its weight on the back foot, ready to sweep the hook in a wide arc at knee height. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the lancer is 2.3 metres tall and the pole is 4 metres long. Body plan: human proportions, long-legged and narrow, hips, knees, shoulders and elbows where a person's are, two long arms with ink hands, two long legs in tall striped wading boots; it wears a short cape over a tight tunic and a wide circular hat like a lampshade with a fringe of hanging cords hiding its face, two white eyes in the shadow under the brim; the pole is a ship's boat-hook, a long pale shaft with a brass hook and spike at the end and ribbons tied below the hook. The manifestation: ink that keeps its distance, black ink dripping from the cords of the hat and the hem of the cape. Elegant and wary, a ferryman, not a soldier, no teeth, no skin. Wind palette: sky-blue cape, cream tunic, red-and-cream striped boots, a straw-gold hat, a pale ash pole with a brass hook, red ribbons, the ink black with a blue sheen. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage armour knight teeth skin
```

### 4. Potter (`potter`)

**Main sheet: Perdide (the lobber, after the bellows toad).**

```
Spirit design reference sheet for a science fiction exploration game: one potter, a stooped figure of living ink carrying a tall rack of clay jars on its back, drawn four times side by side at the same scale on a plain cream background: front view, side view showing the wooden back-rack full of round jars, three-quarter view, and its lob wind-up, one arm swung far back low behind it holding a round clay jar with ink sloshing out of its neck, its other arm pointing at the target, one knee lifted like a bowler. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the potter is 1.7 metres tall, about the traveller's height, bent under its load. Body plan: human proportions, hips, knees, shoulders and elbows where a person's are, two arms with clear elbows and ink hands, two legs in baggy rolled trousers and clogs; it wears a long apron stiff with dried clay and a wooden frame on its back holding eight round jars of different sizes tied with string; its head is a big round clay pot worn upside down with two eye holes, two white eyes shining in them, ink trickling from the rim. The manifestation: ink that fills things, black ink sloshing in every jar and dripping from the apron. Busy and absent-minded, a market potter, not a monk, no teeth, no skin. Marsh palette: a lilac-grey smock, an ochre clay apron, terracotta and sage-green jars, a pale wooden rack, the ink black with a violet sheen. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage teeth skin gore
```

### 5. Riser (`riser`)

**Main sheet: the Buried Machine (the ambusher, after the mound worm).**

```
Spirit design reference sheet for a science fiction exploration game: one riser, a figure of living ink wrapped like a miner that climbs up out of the ground, drawn four times side by side at the same scale on a plain cream background: front view standing, side view standing, three-quarter view half risen out of a patch of loose ash with only its chest, arms and head above the ground and both hands pressing the ground to pull itself up, and its grab wind-up, standing hunched with both arms stretched forward and its fingers hooked, lunging for the ankles. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the riser is 1.75 metres tall, about the traveller's height. Body plan: human proportions, hips, knees, shoulders and elbows where a person's are, two arms ending in big ink hands with thick fingers, two legs in heavy boots; it is wrapped in long strips of grey canvas like bandages over an old miner's coat, ash and gravel falling from the folds, a cracked brass miner's lamp strapped on its chest glowing dull orange; its head is a dented riveted iron helmet with a round glass faceplate, and behind the cracked glass two white eyes and dark ink. The manifestation: ink that waited underground, black ink oozing from between the wrappings, ash pouring off it as it rises. Patient and eerie, a lost miner, not a zombie, no rotting flesh, no teeth, no skin. Ash palette: ash-grey and dun wrappings, a rust-brown coat, a dark iron helmet, a warm orange lamp, the ink black with an amber sheen. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage zombie mummy rotting-flesh teeth skin gore
```

### 6. Tumbler (`tumbler`)

**Main sheet: the Signal Market (the flanker, after the horn lizard).**

```
Spirit design reference sheet for a science fiction exploration game: one tumbler, a quick acrobat of living ink in a patchwork harlequin costume, drawn four times side by side at the same scale on a plain cream background: front view standing with a short curved knife in each hand, side view, three-quarter view caught mid back-flip with its legs over its head, and its knife-throw wind-up, crouched low on one knee with its throwing arm cocked back beside its ear and three thin knives fanned between its fingers. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the tumbler is 1.6 metres tall, about the traveller's height, slim and light. Body plan: human proportions, slim and supple, hips, knees, shoulders and elbows where a person's are, two arms with ink hands, two legs in tight diamond-patterned hose and soft pointed slippers; a short jacket of coloured diamonds with bells on the cuffs, a stiff ruff collar; its head is a smooth white theatre mask with a painted smile and two eye holes, two white eyes shining in them, a two-pointed jester cap above it. The manifestation: ink that cannot keep still, black ink flicking off its cuffs in drops as it moves. Playful and quick, a street acrobat, not a clown monster, no teeth, no skin. Market palette: teal, coral and saffron diamonds, a gold ruff, a white mask, brass bells, the ink black with a pink sheen. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage horror clown teeth skin gore
```

### 7. Conjurer (`conjurer`)

**Main sheet: the Garden of Spheres (the trapper, after the ring centipede).**

```
Spirit design reference sheet for a science fiction exploration game: one conjurer, a tall stage magician of living ink in a long tailcoat, drawn four times side by side at the same scale on a plain cream background: front view holding a slim wand, side view, three-quarter view stepping out of a round black puddle of ink on the ground as if out of a door, and its snare wind-up, both arms raised wide with the wand high, a ring of small floating glowing cards circling it, three dark ink circles opening on the ground in front of it. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the conjurer is 2.0 metres tall including its hat, taller than the traveller. Body plan: human proportions, slim and upright, hips, knees, shoulders and elbows where a person's are, two arms in long sleeves with white gloves on ink hands, two legs in narrow trousers and pointed shoes; a long tailcoat with tails to the knees, a short cape lined in a bright colour, a very tall top hat; under the hat brim no face, a round brass stage mirror where the face should be with two white eyes shining in its dark glass. The manifestation: ink that makes tricks, its tails dripping into ink that pools under it. Theatrical and smug, a music-hall magician, not a wizard, no beard, no teeth, no skin. Pearl palette: a pearl-white tailcoat, a lilac lining, a lavender top hat with a gold band, white gloves, a brass mirror face, pale blue glowing cards, the ink black with a lilac sheen. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage wizard beard teeth skin gore
```

## Lab batches (to pick)

| Prompt | Batches | First look |
|---|---|---|
| `pilferer` | `2026-10-28-03-16-03-72be` | on-model: tin-funnel hood, patched coat, sack, long ink hands; OpenAI 1 the most Moebius, Gemini 1 lettered its views |
| `doorbearer` | `2026-10-28-03-16-03-4c85` | on-model: door with round window and ring, quilted coat, tin plates, mortar helmet; OpenAI 1 has the strongest slam pose |
| `lancer` | `2026-10-28-03-16-03-652d` | on-model: lampshade hat with cords, striped boots, boat-hook; OpenAI 1 reads best, very long legs |
| `potter` | `2026-10-28-03-16-03-b497` | on-model: pot head, jar rack, clay apron, bowler's lob; OpenAI 1 clear |
| `riser` | `2026-10-28-03-16-03-6100` | on-model: diver-like helmet, wrappings, chest lamp, rising from ash; OpenAI 1 strong |
| `tumbler` | `2026-10-28-03-16-03-3d1d` | on-model: harlequin diamonds, white mask, ruff, knives, back-flip; OpenAI 1 clear |
| `conjurer` | `2026-10-28-03-16-03-c521` | on-model: top hat, mirror face, tailcoat, ink puddle, card ring; OpenAI 1 clear |
