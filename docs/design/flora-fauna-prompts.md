# Flora and fauna, world by world: reference prompts

2026-10-11 (issue #9: "run a flora and fauna reference pass across every world"). One naturalist's sheet per route
world (`src/levels/names.js` ORDER), each of that world's plants and small creatures, so the plants
(`src/flora-species.js`, placed by `src/flora.js`) and the wildlife (`src/wildlife/species.js`, driven by
`src/wildlife.js`) have a drawn reference to answer to, and the four worlds that grow nothing yet (the Underwater
City, the Glass Dunes, the Moon Foundry, the City Floating in Space) have one to start from. Each sheet keeps the
species the game already has (named in the prompt, as built) and adds a few in their kind. Plain text prompts for the
reference lab (`scripts/gen-reference.mjs --from docs/design/flora-fauna-prompts.md#<id>`).

Target folders: one per world, `references/levels/<World>/environment/flora-fauna/`, given to the lab with
`--target` (the world's folder name is not the id). Vael, Lorn and Viridel take the merged world's first part's
folder (`references/levels/Vael/`, `references/levels/Lorn/`, `references/levels/Viridel/`); Viridel's level id is
`edena`.

| id | World | Target |
|---|---|---|
| `desert` | The Desert | `references/levels/The Desert/environment/flora-fauna/` |
| `vael` | Vael (and its sky stones) | `references/levels/Vael/environment/flora-fauna/` |
| `lorn` | Lorn (and the Deep Wood) | `references/levels/Lorn/environment/flora-fauna/` |
| `viridel` | Viridel (`edena`) | `references/levels/Viridel/environment/flora-fauna/` |
| `underwater` | The Underwater City | `references/levels/The Underwater City/environment/flora-fauna/` |
| `city-shaft` | The City-Shaft | `references/levels/The City-Shaft/environment/flora-fauna/` |
| `glass-dunes` | The Glass Dunes | `references/levels/The Glass Dunes/environment/flora-fauna/` |
| `buried-machine` | The Buried Machine | `references/levels/The Buried Machine/environment/flora-fauna/` |
| `moon-foundry` | The Moon Foundry | `references/levels/The Moon Foundry/environment/flora-fauna/` |
| `spheres` | The Garden of Spheres | `references/levels/The Garden of Spheres/environment/flora-fauna/` |
| `space-city` | The City Floating in Space | `references/levels/The City Floating in Space/environment/flora-fauna/` |
| `signal-market` | The Signal Market | `references/levels/The Signal Market/environment/flora-fauna/` |

What every prompt keeps: a naturalist's plate on a plain cream background, each plant and creature small and clearly
apart, the creatures beside the plants they live among, one of them caught in its surprise (the trick it plays when
scared, `src/wildlife/species.js`); the small cloaked traveller with the round jade glass backpack at one side for
scale; the house style and the world's own palette (the colours in `src/flora-species.js`'s section headings); no
lettering, so no labels on the plate.

### 1. The Desert (`desert`)

**Main: the desert's plants and creatures.**

```
Creature and plant design sheet for a science fiction exploration game: the flora and fauna of a desert of rose and ochre dunes and salt flats, drawn like a naturalist's plate on a plain cream background, each one small and clearly separated: a tall bell totem plant, a stack of rounded rose bells on a thick stem; a spiny sand candelabra cactus with upturned arms; a slender sun-lamp stalk with a glowing pale yellow bulb at its tip; a squat ribbed barrel plant; a flat white salt star rosette on the ground; a long swaying dune whip grass; a puff lizard in sandy ochre, one shown balloon-swollen and floating off; a rust-red dune crab, one dug into the sand with only its eyes up; a cream dune jerboa with huge ears, one vaulting on its tail and parachuting down on its ears. A small cloaked human traveller with a round jade glass fluid backpack stands at one side for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rose, teal, ochre and cream, restrained cream paper grain, clear readable construction, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels
```

### 2. Vael (`vael`)

**Main: the needle plain and the sky stones.**

```
Creature and plant design sheet for a science fiction exploration game: the flora and fauna of a silent world of bone-white needles and pale stone plains, with floating sky stones on its southern side, drawn like a naturalist's plate on a plain cream background, each one small and clearly separated: a tall spiral horn plant twisting like a bone shell; a pod lantern, a thin stem bending under a glowing hanging pod; a branching bone coral; a tuft of lavender quills; a flat stone mallow like pale plates on the ground; a tall pagoda reed with tiered discs; a round sky bladder plant swollen like a balloon; a peach kite flower with taut triangular petals; a white cloud puffball; a coral fan; a peach rosette; a bone kite creature, one unfolded into a paper kite riding the wind; a stiff-legged needle walker, one standing up straight as a tiny needle spire; a pale cairn crab carrying stacked pebbles, one toppled into a pile of stones; a soft cream cloud ray, one puffed into a little cloud drifting away. A small cloaked human traveller with a round jade glass fluid backpack stands at one side for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone, pale stone, peach, lavender, coral, cloud white and a touch of teal, restrained cream paper grain, clear readable construction, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels
```

### 3. Lorn (`lorn`)

**Main: the humming swamp and the Deep Wood.**

```
Creature and plant design sheet for a science fiction exploration game: the flora and fauna of a twilight swamp that hums and the deep wood north of it, drawn like a naturalist's plate on a plain cream background, each one small and clearly separated: a tall stilt fungus on thin legs, its cap faintly glowing; a cluster of organ pipe plants standing in water; an eye bulb, a stalk ending in a glowing round eye; a swamp fan; spore puffs on the ground; a glowing lantern pod tree; a candelabra plant; coral fingers; a velvet trumpet flower; shelf bracket fungi; a feather plume; a lilac eye-moth with eye spots on its wings, one splitting into three little moths that scatter; a violet spore shell, one popped open into a spray of glowing spores; a coral lantern fish leaping from one pool to another; a pale lantern grub, one gone dark leaving only two blinking eyes. A small cloaked human traveller with a round jade glass fluid backpack stands at one side for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, violet, swamp green, teal and lime glows, peach-orange, dark teal and lilac, restrained cream paper grain, clear readable construction, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels
```

### 4. Viridel (`viridel`)

**Main: the garden that grows over.**

```
Creature and plant design sheet for a science fiction exploration game: the flora and fauna of a soft garden world that keeps what falls, giant umbrella trees and still ponds, drawn like a naturalist's plate on a plain cream background, each one small and clearly separated: a giant parasol leaf on a slim stem; a tall bulb tower, a round allium head on a long stalk; tulip cups; pom-pom clover; a mat of tiny daisies; a ribbon lily with long curling leaves; a white pyramid tortoise, one with its shell unfolded into a little temple; a pink bloom mimic, one blossomed into a big flower holding still; a pale aqua pond skipper, one skipping across a pond like a thrown stone. A small cloaked human traveller with a round jade glass fluid backpack stands at one side for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, mint, pink, aqua, peach, lavender and soft yellow, restrained cream paper grain, clear readable construction, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels
```

### 5. The Underwater City (`underwater`)

**Main: the sea outside the glass, and what lives in the domes.**

```
Creature and plant design sheet for a science fiction exploration game: the flora and fauna of a city of glass domes on the sea floor, drawn like a naturalist's plate on a plain cream background, each one small and clearly separated: tall ribbons of glow-kelp with softly luminous fronds, grown in troughs; a tower of round sea pods stacked like a coral column; pink and coral fan corals; small sea anemones; a coral-red kelp crab, one backed into a coffee cup on a café table; a pale aqua glass snail, one gone as clear as glass with its eyes drawn in; a small shoal of round teal fish; a broad pale manta ray; a gentle whale seen small in the distance, singing. A small cloaked human traveller with a round jade glass fluid backpack stands at one side for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, deep sea teal, aqua, coral pink and pale glowing green, restrained cream paper grain, clear readable construction, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels
```

### 6. The City-Shaft (`city-shaft`)

**Main: the rim of the shaft and its terraces.**

```
Creature and plant design sheet for a science fiction exploration game: the flora and fauna of the dry rim and terraces of a city stacked down a great pit, drawn like a naturalist's plate on a plain cream background, each one small and clearly separated: a large lantern agave with a glowing flower spike; a fan palm; terracotta bellflowers; a blue globe thistle; a low rosemary cushion; a yellow taxi snail with a shell like a little cab, one with two jets lit on its shell flying off; a pink terrace gecko, one dashing into a crack while its dropped tail wriggles behind. A small cloaked human traveller with a round jade glass fluid backpack stands at one side for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream, terracotta, steel blue and olive, restrained cream paper grain, clear readable construction, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels
```

### 7. The Glass Dunes (`glass-dunes`)

**Main: life between the waves of glass.**

```
Creature and plant design sheet for a science fiction exploration game: the flora and fauna of a basin of amber sand walled by frozen waves of fused green glass, drawn like a naturalist's plate on a plain cream background, each one small and clearly separated: a hardy succulent with translucent green glassy leaves; a tuft of amber sand grass; a lichen that grows in the cracks of glass; a tall plant like a blown-glass bottle catching the light; a small creeping vine with bead-like fruit; a cream cog mouse with a little cog on its back, one whirling away like a spinning top; a mint-green glass hopper, one diving into a wall of glass and popping out of another. A small cloaked human traveller with a round jade glass fluid backpack stands at one side for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, amber sand, lime, mint, emerald and teal glass, restrained cream paper grain, clear readable construction, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels
```

### 8. The Buried Machine (`buried-machine`)

**Main: the dunes over the wheel.**

```
Creature and plant design sheet for a science fiction exploration game: the flora and fauna of pale dunes and a canyon over a great buried machine, drawn like a naturalist's plate on a plain cream background, each one small and clearly separated: a tall chimney stalk plant like a smoking pipe; a large round ash gourd; a cluster of rust tube worms; a teal blade leaf plant; small ash bulbs on the ground; a rust pipe beetle, one rolled into an armoured ball bouncing off; a teal spring worm, one stretched like a slinky flipping end over end. A small cloaked human traveller with a round jade glass fluid backpack stands at one side for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale sand, rust, teal and ash grey, restrained cream paper grain, clear readable construction, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels
```

### 9. The Moon Foundry (`moon-foundry`)

**Main: what grows in an abandoned foundry of moons.**

```
Creature and plant design sheet for a science fiction exploration game: the flora and fauna of a vast abandoned workshop where small moons were cast, under a great roof on rust pillars, drawn like a naturalist's plate on a plain cream background, each one small and clearly separated: a vine climbing a rusty pillar with small round pale fruit like little moons; a moss growing in the cracks between floor slabs; a pale fungus shaped like a crescent; a warm-loving fern that grows by a cooling furnace; a plant with cratered cream seed pods; an orange rail beetle, one running along a rail like a cart; a cream moon mouse, one curled up into a little moon rolling away. A small cloaked human traveller with a round jade glass fluid backpack stands at one side for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rust, warm orange, cream moons and cool slate grey, restrained cream paper grain, clear readable construction, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels
```

### 10. The Garden of Spheres (`spheres`)

**Main: the bowl of grass and the lake.**

```
Creature and plant design sheet for a science fiction exploration game: the flora and fauna of a green garden bowl round a lake, scattered with great fallen spheres, drawn like a naturalist's plate on a plain cream background, each one small and clearly separated: a tall orb lily with a round glowing head; a bead tree hung with round beads; lake rushes standing in water; small saffron cups; a string of pearls ground plant; pale bells; a pearl-white sphere mimic, one curled into a perfect sphere half sunk in the grass; a dark blue lake strider, one with its legs telescoped into tall stilts striding away. A small cloaked human traveller with a round jade glass fluid backpack stands at one side for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, lime, dark green, cream, orange and pale blue, restrained cream paper grain, clear readable construction, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels
```

### 11. The City Floating in Space (`space-city`)

**Main: the island gardens over the void.**

```
Creature and plant design sheet for a science fiction exploration game: the flora and fauna of a city of adobe houses on islands floating in the dark of space, every tree carried over a bridge in a pot, drawn like a naturalist's plate on a plain cream background, each one small and clearly separated: a small round-crowned tree in a clay pot; a trailing vine that hangs off a parapet into the void; potted flowers in coral and cream; a plant that grows along a hanging cable; a moss on the underside of an island; a salmon cable finch, one hanging upside down from a cable as it flutters back up; a golden lamp bug, one lit up like a little lamp. A small cloaked human traveller with a round jade glass fluid backpack stands at one side for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream, salmon and coral, warm lamp gold, dark teal and night violet, restrained cream paper grain, clear readable construction, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels
```

### 12. The Signal Market (`signal-market`)

**Main: the street plants and the market's creatures.**

```
Creature and plant design sheet for a science fiction exploration game: the flora and fauna of a long market street of a thousand broadcasts and signs, plants growing in enamel pots along the pavements, drawn like a naturalist's plate on a plain cream background, each one small and clearly separated: a strap palm in a big enamel pot; a street lamp flower with a glowing bloom like a streetlight; a pipe blossom growing out of an old pipe; a tin star plant with metallic star-shaped leaves; a gutter puff growing in a drain; a kerb creeper; a teal sign bug, one popping up a little glowing sign as it trundles off; a lilac-grey ticket finch, one bursting into a flurry of paper tickets. A small cloaked human traveller with a round jade glass fluid backpack stands at one side for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, enamel coral, teal, mustard, lilac and cream, restrained cream paper grain, clear readable construction, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels
```
