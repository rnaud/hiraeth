# A shop in every route world: reference prompts

2026-10-09. Only the desert has a shop so far (Haddu's Chimes & Cures by Qanat's main gate: `src/shop-world.js`,
`src/story/shop-data.js`, docs/systems/items.md "Shops", docs/systems/interiors.md "A shop"); the later worlds'
shops sell the same three wares up the same price curve. These are references for one shop in each of the eleven
route worlds (`ORDER` in `src/levels/names.js`), each in its world's own architecture, palette and culture
([../story-bible.md](../story-bible.md), [../../lore/characters/worlds.md](../../lore/characters/worlds.md)). Plain
text prompts for the reference lab (`reference-lab.html`, `scripts/gen-reference.mjs --from
docs/design/shop-prompts.md#<id>`, the interior `#<id>/v2`); a pick goes to the folder below.

Target folder: `references/shops/<id>/`

Each entry has two prompts: the **front** (main), the shop as a player meets it on the path, with its emblem (no
letters: each world writes its own way, so the sign is a picture), its awning, a few wares in view and the keeper
glimpsed; and the **interior** (`v2`), the counter, the shelves and the keeper. The wares are the same everywhere,
shown as each world would keep them: **healing potions** (small corked flasks of red cure, red to the shoulder),
**heart containers** (a small red heart that beats when held, each on its own cushion or in its own case) and
**magic expansions** (a glowing teal vial in a brass cradle). Every prompt keeps the house style, the small cloaked
traveller with the round jade fluid backpack for scale, and no lettering anywhere.

## The keepers

For the shops' builders: a keeper for every world, in its people's manner (the names are new and used nowhere
else in the game; the desert's is the existing Haddu).

| Id | World (level id) | Shop | Keeper | Who they are |
|---|---|---|---|---|
| `desert` | The Desert (`desert`) | Haddu's Chimes & Cures, by Qanat's main gate | **Haddu** | (existing) a broad, slow chime-weigher in a deep teal coat over saffron, red fez, brass monocle, a hand bell rung for every sale; forty Drinkings behind the counter |
| `vael` | Vael (`arzach`) | the Wind-Shelf, a stone shelter in a hoodoo's foot on the way to the lone tower | **Brin** | a tall, quiet woman in layered peach and ochre wraps, a scarf over her mouth; says one word at a time (as Vael does), prices drawn in a tray of sand with a stick, wares hung on cords that turn in the wind |
| `vael-ii` | Vael II: The Sky Stones (`arzach2`) | the Almonry, a hatch in the monastery's gatehouse on the cliff | **Sister Perpetue** | the monks' almoner, round and brisk, a grey habit and a white wimple like a bell; a row of little bells over the hatch, one rung for every sale; seals each flask with wax pressed with the Three Notes |
| `lorn` | Lorn (`perdide`) | Nettle's Float, a raft-house moored in the reeds of the channel | **Nettle** | an old, long-armed swamp woman under a wide reed hat and a waxed moss-green cape; keeps her accounts as knots on cords at her belt (Lorn writes in knots); the Hush painted on her door so the snappers leave her be |
| `lorn-ii` | Lorn II: The Deep Wood (`perdide2`) | the Welcome-Shelf, a moss dome on the lit path | **Rowan** | a plump, flustered lamp-keeper's cousin in a quilted dusk-blue coat who has kept a shop stocked for travellers for thirty years and never had one; everything dusted daily; three little lamps hung over the door (the Welcome) |
| `viridel` | Viridel (`edena`) | Clover's Potting House, built against a fallen white builders' slab under an umbrella tree | **Clover** | a tall, gentle gardener-apothecary in a leaf-green smock and a wide straw hat, petals in her hair, pruning shears at her belt; sells only what the garden gives and digs up nothing |
| `city-shaft` | The City-Shaft (`incal`) | Fausta's Basket-Shop, a narrow house on the middle terraces by the cab stop | **Fausta** | a brisk, sharp-eyed apothecary in a rust apron and rolled sleeves who sells to every level by a basket on a rope over the void (up to the rim at rim prices, down to the bottom at bottom ones) |
| `hangar` | The Sealed Hangar (`garage`) | the Quartermaster's Hatch, a cabin of riveted plate on the plateau, under the keep | **Odo** | the Major's quartermaster, stocky, in a faded blue boiler suit with brass buttons and a peaked cap; issues everything against requisitions the Major signed decades ago and stamps each one |
| `buried-machine` | The Buried Machine (`buried`) | Mott's Tooth-Counter, a small dome among the domes | **Mott** | an old dome-woman with brass goggles pushed up on her forehead and a rust-orange quilted apron; counts on an abacus of gear teeth and dates every sale by the wheel's tooth |
| `spheres` | The Garden of Spheres (`spheres`) | the Listening Stall, a round white pavilion in the shade of a half-sunk sphere by the cypress avenue | **Hale** | a lean, soft-spoken old man in a cream robe with a tuning fork on a cord; listens to every ware before he sells it (a cure that hums flat is poured away) |
| `signal-market` | The Signal Market (`bazaar`) | Pashka's Cure-Stall, a stall in a tower's foot on the market avenue | **Pashka** | a big round lavender-skinned trader with four arms and a voice that carries; an illustrated board over the stall shows a heart and a flask and lights up for every sale |

### 1. The Desert: Haddu's Chimes & Cures (`desert`)

**Main: the shop beside the way up to Qanat's main gate.**

```
Environment concept art for a science fiction exploration game: a small desert shop beside the sandy way from the pilgrims' camps up to the main gate of an old mud-brick city, seen from the path in late afternoon light. A squat building of rose and ochre mud brick with a low dome and rounded corners, a deep teal and saffron striped cloth awning on poles over its door, a hanging painted sign shaped like a large floating cyan crystal beside a small red flask, strings of small cyan crystals hanging along the awning's edge catching the sun; on a bench under the awning a few corked flasks of red cure, a small red heart on a cushion and a glowing teal vial in a brass cradle. In the shadow of the doorway a broad, slow shopkeeper in a deep teal coat over saffron, a red fez and a brass monocle, a little hand bell in his hand. Behind, the city's wall and gate climbing the slope, a few robed pilgrims on the way, sand banked against the walls. A small cloaked human traveller with a round jade fluid backpack walks up the path toward the shop for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, golden sand, rose and ochre brick, teal and saffron cloth, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Interior: Haddu at his counter.**

```
Interior concept art for a science fiction exploration game: inside a small desert shop out of the sun, a cool room of rose plaster under a low dome, light falling through lattice windows in patterns on the floor. Across the room a wooden counter with a teal band, on it a little brass scale weighing a small cyan crystal, a row of corked flasks of red cure, two small red hearts each on its own embroidered cushion, two glowing teal vials in brass cradles; behind it shelves of clay jars and glass bottles, a large floating crystal painted on the back wall, strings of cyan crystals hanging by the door, a woven rug, a bench and big pots. Behind the counter a broad, slow, amused shopkeeper in a deep teal coat over saffron, a red fez, a brass monocle, a hand bell raised to ring a sale. A small cloaked human traveller with a round jade fluid backpack stands at the counter for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rose plaster, teal and saffron, warm lamp light, cool lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 2. Vael: the Wind-Shelf (`vael`)

**Main: a stone shelter in the foot of a hoodoo.**

```
Environment concept art for a science fiction exploration game: a tiny silent shop on a bone-white world of needle spires, seen from the path on a warm peach sand plain under an aqua sky. The shop is a shelter carved into the foot of a mushroom-capped hoodoo, a smooth round opening with a stone shelf for a counter, a pale ochre cloth stretched on two poles for an awning snapping in the wind; instead of a sign a long cord hangs from the cap with a single white feather and a small cyan crystal turning on it. Wares hang from cords under the cap and turn slowly in the wind: corked flasks of red cure, a small red heart in a little net, a glowing teal vial in a brass cradle. At the opening a tall quiet woman in layered peach and ochre wraps, a scarf over her mouth, one hand raised in greeting, a tray of raked sand beside her with a stick. Balanced boulders on needles and a lone tower far off in the haze. A small cloaked human traveller with a round jade fluid backpack walks toward it for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone white, warm peach sand, aqua sky, ochre bands, rose-mauve shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Interior: inside the hoodoo, nearly empty and quiet.**

```
Interior concept art for a science fiction exploration game: inside a small round room carved out of the foot of a pale hoodoo, smooth bone-white walls with fine ochre bands, a round opening onto a bright peach sand plain, wind blowing a curtain of ochre cloth. A long curved stone shelf is the counter; on it, set far apart with great care, three corked flasks of red cure, one small red heart on a folded peach cloth, one glowing teal vial in a brass cradle; above, cords hang from the ceiling with feathers and small crystals that turn in the draught, a few niches cut in the wall hold more flasks. A shallow tray of raked sand on the counter with a price drawn in it as a few lines and dots. Behind the counter a tall, still woman in layered peach and ochre wraps, a scarf over her mouth, pointing at a flask with one finger. Spare, calm, lots of empty space. A small cloaked human traveller with a round jade fluid backpack stands at the counter for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone white, peach and ochre, aqua light from the door, rose-mauve shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 3. Vael II: the Almonry (`vael-ii`)

**Main: the hatch in the monastery's gatehouse.**

```
Environment concept art for a science fiction exploration game: the almonry of a cliff-top monastery above a sea of cloud, seen from the end of a stone aqueduct path, bone-white needle rocks and great balanced stones floating in the sky behind. The monastery's gatehouse is rose stone built into an overhanging cliff, round towers with small conical roofs; in its wall a wide arched hatch with a wooden counter-board let down, a short slate canopy over it, and above the hatch a carved beam hung with a row of seven small bronze bells of different sizes, the shop's only sign. On the counter-board clay flasks of red cure sealed with wax, a small red heart in a wooden box lined with cloth, a glowing teal vial in a brass cradle. Leaning out of the hatch a round, brisk nun in a grey habit and a white wimple shaped like a bell, reaching up to ring one of the little bells. A small cloaked human traveller with a round jade fluid backpack walks along the aqueduct toward the hatch for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rose cliffs, bone white stone, peach and pale gold light, white cloud sea, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Interior: the almoner's room behind the hatch.**

```
Interior concept art for a science fiction exploration game: inside a monastery almonry, a narrow vaulted room of rose stone with a deep arched hatch open onto bright cloud and sky, a wooden counter-board under it. Along the walls tall shelves in niches: rows of clay flasks of red cure each sealed with a blob of wax, a few small red hearts on cushions in little open wooden boxes like reliquaries, glowing teal vials in brass cradles on a high shelf; a ledger of knotted ribbons, a candle, a stamp and a pot of wax on a writing desk; a row of small bronze bells hangs from a beam over the hatch. A round, brisk nun in a grey habit and a white bell-shaped wimple presses a wax seal onto a flask, sleeves rolled. Light falls through a small round window in a soft cool beam. A small cloaked human traveller with a round jade fluid backpack stands at the counter-board for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rose stone, grey and white cloth, bronze bells, pale gold candle light, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 4. Lorn: Nettle's Float (`lorn`)

**Main: a raft-house moored in the reeds.**

```
Environment concept art for a science fiction exploration game: a small floating shop moored in the reeds of a twilight swamp, seen from a hover-skiff channel at dusk. A raft-house of grey weathered planks and bound reed bundles with a steep thatched roof, a lantern of glowing violet crystal hanging from its eave, a little landing stage with a mooring post; instead of a sign a long cord of knots hung with small cyan crystals and a carved wooden flask dangles from a pole; on the door a painted mark of three drops over a closed mouth. Under the eave, nets hold jars and corked flasks of red cure, a small red heart in a lidded basket, a glowing teal vial in a brass cradle. Leaning in the doorway an old long-armed swamp woman under a wide reed hat and a waxed moss-green cape, knotted cords at her belt. Around, humming crystal growths, giant pale fungus trees with glowing caps, carnivorous plants with closed jaws, glowing eggs in the reeds, still dark water mirroring the lanterns. A small cloaked human traveller with a round jade fluid backpack steps from a skiff onto the landing for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, violet and teal dusk, moss green, glowing crystal light, deep indigo shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Interior: inside the raft-house.**

```
Interior concept art for a science fiction exploration game: inside a small floating swamp shop, a low room of weathered planks and reed-bundle walls under a steep thatch, the floor rocking gently, a hatch in the floor showing dark water. A plank counter on two barrels; behind it nets and shelves crammed with jars of pickled roots, bundles of dried reeds, corked flasks of red cure hanging by their necks on strings, two small red hearts each in its own lidded reed basket, glowing teal vials in brass cradles; long cords of knots hang from a peg like a ledger. A violet crystal lamp and a jar of fireflies light the room; through a round window, glowing fungus caps and humming crystals outside. Behind the counter an old long-armed swamp woman with a wide reed hat and a waxed moss-green cape tying a knot in a cord to count a sale, a snapping plant in a pot beside her, its jaws shut. A small cloaked human traveller with a round jade fluid backpack stands at the counter for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, weathered grey wood, moss green, violet crystal light, warm firefly gold, deep indigo shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 5. Lorn II: the Welcome-Shelf (`lorn-ii`)

**Main: a moss dome on the lit path.**

```
Environment concept art for a science fiction exploration game: a small shop in a moss dome on a lit path through a deep violet wood under giant pale mushrooms at dusk. The dome is round and green with moss, a round wooden door painted blue, a little porch of flat stones; over the door three small lamps hang from a sagging cord above a carved wooden boat hull, the shop's sign; a striped blue awning on poles, swept clean. On a table under the awning a neat row of corked flasks of red cure, a small red heart under a glass cover, a glowing teal vial in a brass cradle, everything dusted and arranged as if waiting a long time for a guest. A plump flustered man in a quilted dusk-blue coat holds up a lamp on a pole and waves, surprised. Lit pools glowing along the path, violet trunks, crystal reeds, root arches, glowing egg heaps. A small cloaked human traveller with a round jade fluid backpack wades out of a lit pool toward the shop for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, violet trunks, pale mushroom cream, moss green, warm lamp gold, coral glow, deep blue shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Interior: thirty years ready for a traveller.**

```
Interior concept art for a science fiction exploration game: inside a small moss dome, a round snug room with curved walls of woven roots and moss, a round window onto the dusk wood, many small lamps lit everywhere. A polished wooden counter curving round one side, a guest book left open, a feather duster; shelves behind full of neatly labelled jars and boxes without words, corked flasks of red cure in perfect rows, two small red hearts each under a glass dome, glowing teal vials in brass cradles, a kettle and three cups set out for guests, a made-up cot in a niche. Everything spotless and slightly old-fashioned, as if kept ready for travellers for thirty years. Behind the counter a plump flustered man in a quilted dusk-blue coat polishing a flask, smiling too widely, a lamp on a pole leaning beside him. A small cloaked human traveller with a round jade fluid backpack stands at the counter for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, moss green, warm lamp gold, dusk blue, coral accents, soft violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 6. Viridel: Clover's Potting House (`viridel`)

**Main: a potting house against a fallen white slab.**

```
Environment concept art for a science fiction exploration game: a little gardener's shop built against a fallen white slab of clean gridded stone under a giant umbrella tree, in a bright colourful garden meadow with step pyramids and white android ruins in the distance. A glass-and-timber potting house leans on the white slab, vines and flowers climbing over both, a green and white striped awning; its sign is a painted wooden board cut in the shape of a curling vine with one leaf and a small flask. On staged shelves under the awning, potted seedlings and seed jars beside corked flasks of red cure, a small red heart nestled in moss in a terracotta saucer, a glowing teal vial in a brass cradle among the leaves. A tall gentle woman in a leaf-green smock and wide straw hat, petals in her hair, pruning shears at her belt, waters the pots. A small cloaked human traveller with a round jade fluid backpack walks along the meadow path toward it for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, thin even lines, flat colour, luminous flat pastel gouache colours, white stone, leaf greens, petal pink, sunflower yellow, sky blue, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Interior: the potting benches.**

```
Interior concept art for a science fiction exploration game: inside a small glass potting house leaning on a white stone slab, sun falling through the panes in bright squares, vines grown in through the roof. Long wooden potting benches serve as the counter, covered with soil, trowels, seed packets without words and pots; behind, shelves of glass cloches and jars: corked flasks of red cure set among seedlings, two small red hearts nestled in moss under glass cloches like rare plants, glowing teal vials in brass cradles hung among hanging baskets of ferns; a watering can, bundles of drying herbs, a tea pot. The white slab forms the back wall, its clean grid and a faint carved glyph of three dots over an arc. Behind the bench a tall gentle woman in a leaf-green smock and a wide straw hat, petals in her hair, wrapping a flask in a leaf. A small cloaked human traveller with a round jade fluid backpack stands at the bench for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, thin even lines, flat colour, luminous flat pastel gouache colours, leaf greens, petal pink, white stone, sunlit glass, soft blue shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 7. The City-Shaft: Fausta's Basket-Shop (`city-shaft`)

**Main: a narrow house on the terrace edge, its basket over the void.**

```
Environment concept art for a science fiction exploration game: a narrow three-storey shop wedged on the edge of a terrace in a city stacked down the walls of an immense pit, seen along the terrace promenade. Cream walls with a window grid and green shutters, a terracotta hipped roof with a roof garden, a terracotta-and-cream striped awning over a shopfront counter; a wooden crane arm juts from the top floor over the void with a rope and a wicker basket hanging far down toward the levels below, another basket coming up; the sign is a wrought-iron bracket hung with a cut-out mortar and pestle beside a small flask. On the counter corked flasks of red cure, a small red heart in a tin box, a glowing teal vial in a brass cradle. A brisk sharp-eyed woman in a rust apron with rolled sleeves leans out of an upper window hauling the rope. Around, cream villas and terracotta domes stacked on blue-grey steel viaduct terraces, cypress trees, washing lines, a flying taxi passing, the shaft dropping away to turquoise water far below. A small cloaked human traveller with a round jade fluid backpack walks along the promenade railing toward the shop for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream and pink walls, terracotta, blue-grey steel, cypress green, turquoise depths, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Interior: the counter and the rope.**

```
Interior concept art for a science fiction exploration game: inside a narrow apothecary shop on a city terrace, a tall thin room with a tiled floor, a cream-plastered wall with tall shuttered windows and through them the far wall of an immense pit stacked with houses. A marble-topped counter; behind it floor-to-ceiling wooden drawers and shelves reached by a rolling ladder: corked flasks of red cure in rows, two small red hearts each in a velvet-lined tin box, glowing teal vials in brass cradles; a rope runs down through a hole in the ceiling to a wicker basket on the counter being filled for another level, with a little bell on the rope. A brisk sharp-eyed woman in a rust apron with rolled sleeves packs the basket and calls up the rope. A small cloaked human traveller with a round jade fluid backpack stands at the counter for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream plaster, terracotta tiles, polished wood, blue-grey steel beyond, warm daylight, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 8. The Sealed Hangar: the Quartermaster's Hatch (`hangar`)

**Main: a riveted cabin on the plateau.**

```
Environment concept art for a science fiction exploration game: a quartermaster's store on a paved plateau in a strange pocket universe, seen from the path beneath a keep hung with cables, aerials and pipes with valve wheels, a windmill turning beyond. The store is a cabin of riveted pale green metal plate with rounded corners, a roll-up shutter raised over a service hatch, a little tin awning on struts, a stovepipe; its sign is a stencilled emblem painted on the plate, a cog with a flask inside it. Crates and drums stacked beside it; on the hatch's ledge corked flasks of red cure in a wire rack, a small red heart in a padded steel case with its lid open, a glowing teal vial in a brass cradle. A stocky quartermaster in a faded blue boiler suit with brass buttons and a peaked cap leans on the ledge with a clipboard and a rubber stamp. A glowing round portal stands at the plateau's edge, a ring habitat and an upside-down city faint in the sky. A small cloaked human traveller with a round jade fluid backpack walks up for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale green plate, brass, rust red pipes, cream paving, blue sky, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Interior: the stores behind the hatch.**

```
Interior concept art for a science fiction exploration game: inside a quartermaster's store, a long cabin of riveted metal plate with a curved ceiling, a hatch open on the bright plateau. A steel counter with a ledger, a rubber stamp, an ink pad and a spike of old requisition slips; behind it steel shelving to the ceiling with stencilled crates, numbered bins and pigeonholes: corked flasks of red cure in wire racks, two small red hearts each in its own padded steel case, glowing teal vials in brass cradles in a locked glass cabinet; a pressure gauge, pipes along the ceiling, a wall clock that has stopped, a calendar of a year long past. A stocky quartermaster in a faded blue boiler suit with brass buttons and a peaked cap stamps a slip with great ceremony. A small cloaked human traveller with a round jade fluid backpack stands at the counter for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale green plate, steel grey, brass, rust red, warm bulb light, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 9. The Buried Machine: Mott's Tooth-Counter (`buried-machine`)

**Main: a small dome among the domes.**

```
Environment concept art for a science fiction exploration game: a small shop in a riveted dome half sunk in pale dunes, among other domes and pipes rising from the sand, seen from the path in soft cream daylight. The dome is pale grey-blue iron with an oval door and a lit round porthole, a ring of pipe and a small chimney on top, a rust-orange canvas awning on iron struts; over the door hangs the shop's sign, a single huge rusty gear tooth on a chain beside a small flask. On a shelf under the awning corked flasks of red cure, a small red heart in a brass bell jar, a glowing teal vial in a brass cradle. An old woman with brass goggles pushed up on her forehead and a rust-orange quilted apron sits on an upturned drum by the door, an abacus of gear teeth on her knees. Beyond, a trench showing blue-grey machine strata and pipe bends, a great ring wall on the horizon, and an upside-down city hanging in the sky. A small cloaked human traveller with a round jade fluid backpack walks over the sand toward it for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale cream dunes, blue-grey iron, rust orange, sage sky, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Interior: under the ribbed iron.**

```
Interior concept art for a science fiction exploration game: inside a small riveted iron dome, ribbed walls curving up to a round skylight, warm amber lamps, pipes and a pressure gauge along the wall, sand drifted in by the oval door. A curved counter made from a great iron gear segment; behind it shelves bolted to the ribs: corked flasks of red cure in a rack, two small red hearts each under its own brass bell jar, glowing teal vials in brass cradles; on the wall a big round calendar wheel with one tooth marked for each year, a row of small gear teeth hung on nails. An old woman with brass goggles pushed up on her forehead and a rust-orange quilted apron flicks a gear tooth along her abacus to count a sale. A small cloaked human traveller with a round jade fluid backpack stands at the counter for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, blue-grey iron, rust orange, brass, warm amber light, pale sand, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 10. The Garden of Spheres: the Listening Stall (`spheres`)

**Main: a white pavilion in a sphere's shade.**

```
Environment concept art for a science fiction exploration game: a small round white pavilion in the shade of a giant pale sphere half sunk in a green meadow, beside a cypress avenue leading to a round stone plaza, white pyramids and umbrella trees with gill undersides in the distance. The pavilion has slender white columns and a shallow dome, a pale blue cloth awning between two columns; its sign is a round white disc painted with a single circle and a ring, hung beside a row of small glass bells that ring in the breeze. On a white stone counter corked flasks of red cure, a small red heart on a round cushion, a glowing teal vial in a brass cradle, a tuning fork lying beside them. A lean soft-spoken old man in a cream robe holds a flask to his ear, a tuning fork on a cord round his neck. The sphere's crescent of light and its great curve above, a mirror lake glinting behind. A small cloaked human traveller with a round jade fluid backpack walks slowly up the avenue for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, white stone, meadow yellow-green, cypress green, pale blue sky, peach clouds, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Interior: inside the pavilion, every ware listened to.**

```
Interior concept art for a science fiction exploration game: inside a small round white pavilion, slender columns around a circular room open to a green meadow on one side, the pale curve of a giant half-sunk sphere filling the view outside. A round white stone counter in the middle; around the walls curved shelves: corked flasks of red cure each standing on its own small glass dish, two small red hearts on round cushions, glowing teal vials in brass cradles; tuning forks of many sizes hung on a rack, glass bells along the eaves, a mirrored pebble in a bowl of water. A lean soft-spoken old man in a cream robe strikes a tuning fork and holds it beside a flask, listening with his eyes closed. Soft even daylight, a calm hush. A small cloaked human traveller with a round jade fluid backpack stands at the counter for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, white stone, pale blue, meadow green, peach light, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 11. The Signal Market: Pashka's Cure-Stall (`signal-market`)

**Main: a stall in a tower's foot on the market avenue.**

```
Environment concept art for a science fiction exploration game: a busy cure-stall in the foot of a coral tower on a crowded alien market avenue, seen from the street among the crowd. Coral and teal towers rise on both sides hung with illustrated billboards, cables, service pipes and skybridges, flying taxis overhead. The stall has a deep coral awning, a counter of teal-painted metal and a big illustrated picture board over it showing a red heart and a red flask in bright drawn panels, with a speaker grille and a ring of small bulbs; strings of goods hang under the awning. On the counter heaps of corked flasks of red cure in a crate, a small red heart in a little glass case, glowing teal vials in brass cradles. Behind it a big round lavender-skinned trader with four arms, holding up a flask in one hand and calling out to the crowd. Lavender inhabitants and other aliens pass. A small cloaked human traveller with a round jade fluid backpack stands in the street looking up at the board for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, coral, teal, cream, lavender, warm bulb light, blue shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Interior: behind the board.**

```
Interior concept art for a science fiction exploration game: inside a crowded market cure-shop under a coral tower, a deep low room behind a stall counter open to a bright busy street. Every surface covered: teal metal shelves and hanging racks, small glowing screens showing drawings of hearts and flasks, a speaker grille, cables along the ceiling, a little fan; corked flasks of red cure in crates and hanging by their necks, two small red hearts each in a lit glass case like jewels, glowing teal vials in brass cradles on a turntable. A big round lavender-skinned trader with four arms works at once: one hand takes chimes, one wraps a flask, one points at the screens, one waves to the street. A small cloaked human traveller with a round jade fluid backpack stands at the counter for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, coral, teal, lavender, screen glow, warm bulb light, blue shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```
