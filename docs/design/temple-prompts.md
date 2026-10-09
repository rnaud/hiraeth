# The makers' temples: reference prompts

2026-10-09. Each route world has one great house of the makers, a dungeon with a gadget half-way and a keeper at its
heart (docs/systems/temples.md; the design of each in LORE.md, section 11; the three reworked ones' "one idea" in
[../audits/temple-design-v1.8.md](../audits/temple-design-v1.8.md)). They were built from blocks (`src/temples/kit.js`)
with no picture to aim at. These are references for each temple's most characteristic hall, the one where its idea
and its gadget show, and for its entrance in its world. Plain text prompts for the reference lab
(`reference-lab.html`, `scripts/gen-reference.mjs --from docs/design/temple-prompts.md#<id>`, the entrance
`#<id>/v2`); a pick goes to the folder below.

Target folder: `references/temples/<id>/`

What every prompt keeps: the makers' gentle, very old architecture in the world's own materials, the glyph (three
dots over an arc that bows upward, carved, never a smile) in friezes, the house style, the cloaked traveller
with the round jade fluid backpack (an adult of ordinary height, never "small"; temple halls are big, so the hall
dwarfs them, and any local in the picture is said to be the traveller's height, close by), and no
lettering. The main prompt is the hall as a wide interior concept; the second (`v2`, "Entrance") is the door and the
approach as a player first sees it.

| Id | World | Temple | Hall chosen (main) | Gadget |
|---|---|---|---|---|
| `givers-house` | The Desert | the Givers' House | the Cistern: the dry spout, the four cold braziers, the Keeper asleep in the basin | ember mode |
| `aerie` | Vael | the Aerie | the Wind Well: a column of rising wind lifting the fluid wings | fluid wings |
| `founders-belfry` | Vael II | the Founders' Belfry | the Bell Chamber: the silent bell in the oculus, the door that stands open only while the bell rings | bell-note whistle |
| `hush-house` | Lorn | the Hush-House | the Choir: four singing crystals of four heights, sung low to high | stilling mode |
| `lamp-house` | Lorn II | the Lamp-House | the Hall of Dark Pools: three dark pool-lamps, one hidden on a loft of roots | lantern charm |
| `builders-greenhouse` | Viridel | the Builders' Greenhouse | the Vine Gulf: a vine bridge grown across a chasm, a vine up the glass wall | bloom mode |
| `wardens-well` | The City-Shaft | the Warden's Well | the Lamp Gallery: a well turned on its end, eyes on high shelves reached by jets | fluid jets |
| `first-garage` | The Sealed Hangar | the First Garage | the Clock Gallery: a chasm, a stopped clock face, a ring of six eyes | quick coil |
| `engine-house` | The Buried Machine | the Engine-House | the Furnace: a chasm over embers, the engine's pistons in the walls, a bank of four eyes | fourth chamber |
| `footprint` | The Garden of Spheres | the Footprint | the Hall of the Unseen: a bridge of pale glass only the lens shows | glyph lens |
| `undertower` | The Signal Market | the Undertower | the Gallery of Voices: singing stones, brass horns, a bridge raised by a note carried back | echo shell |

### 1. The Givers' House, the Desert (`givers-house`)

**Main: the Cistern, the dry heart of the house the water came from.**

```
Interior concept art for a science fiction exploration game: the cistern hall at the heart of an ancient temple of the makers, a vast round drum of rose stone under a low dome with an oculus letting down a single shaft of dusty light. In the middle a great stone basin lies dry, a pale tide line on its sides; on the far wall a carved stone spout shaped like a long soft muzzle above the basin, dry, the stone under it only faintly damp. Around the walls four tall bronze braziers stand cold; one has just caught, a small cool ember-orange flame leaping from it where a burning splash of fluid struck it. Curled asleep in the dry basin, a great pale beast of the makers: a shell of bone plates carved with dim flickering glyphs, six long folded legs, a swan's neck laid along the basin's rim. Friezes of three dots over an upward arc run round the drum; old channels lead out under the walls. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands on the rim, dwarfed by the hall, the braziers twice their height, a thin stream of glowing fluid arcing from the backpack's nozzle to the brazier. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rose and ochre stone, ivory bone, ember orange, turquoise traces, deep lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Entrance: the drum half sunk in the high dunes.**

```
Environment concept art for a science fiction exploration game: an ancient temple of the makers half sunk in high golden dunes, seen from the dune crest on the way from an old mud-brick desert city whose walls and burning tree show far behind. A great drum of rose stone with a heavy cornice and vertical fins round it and a low pink dome on top, sand banked high against one side; its door, a tall dark opening framed in carved stone with a frieze of three dots over an upward arc, faces the city, a short stair dug clear of the sand leading down to it. Dry stone channels run out from under the door toward the city and vanish into the sand, the dry outlines of old fields beyond. A cloaked adult human traveller of ordinary height with a round jade fluid backpack walks down the dune toward the door, dwarfed by the drum. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, golden sand, rose stone, pink dome, pale turquoise sky, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 2. The Aerie, Vael (`aerie`)

**Main: the Wind Well, where the birds were given their wings.**

```
Interior concept art for a science fiction exploration game: the wind well inside an ancient white temple of the makers where great birds were given their wings, a tall round shaft of bone-white stone banded in ochre, open to an aqua sky far above through a crown of tall stone feathers leaning out round the rim. Up the middle rises a column of wind, drawn as pale spiralling streams of dust, feathers and ribbons lifting round and round. Glyph lines run up the walls like the lines on a wing; high up, a small balcony juts from the wall beside a carved stone eye. A cloaked adult human traveller of ordinary height with a round jade fluid backpack rides the column upward on wide translucent wings of glowing fluid spread from the backpack, dwarfed by the shaft, circling toward the balcony; below, the floor and a wall's carved ledges far beneath. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone white, ochre bands, aqua sky, peach light, rose-mauve shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Entrance: the great steps on the plain.**

```
Environment concept art for a science fiction exploration game: a great white temple of the makers standing alone on a warm peach plain among bone-white needle spires and mushroom-capped hoodoos, seen from the path in low light. A broad plinth with wide shallow steps, a great drum and a narrower drum on top banded in ochre, glyph lines running up the drums like the lines on a wing, and on the summit a crown of tall stone feathers leaning outward round a perch; a high round doorway at the top of the steps. On the lowest step a quiet woman sweeps sand with a long broom, and a cloaked adult human traveller of ordinary height with a round jade fluid backpack stands beside her at the foot of the steps; she is an adult of the same height as the traveller, and both are dwarfed by the temple, the doorway many times their height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone white, warm peach sand, ochre bands, aqua sky, rose-mauve shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 3. The Founders' Belfry, Vael II (`founders-belfry`)

**Main: the Bell Chamber, where things hold only while the bell rings.**

```
Interior concept art for a science fiction exploration game: the bell chamber inside a round tower of bone-white stone built by the makers to keep floating stones down, a tall circular hall with an oculus in its vaulted ceiling and a great ancient bronze bell hanging silent in the oculus against the sky. On a low dais in the middle a tiny whistle of blue-glazed clay shaped like a bell. On the far side a tall stone door has just sunk open while a clear ringing note spreads through the room, drawn as pale concentric rings of sound rippling out from the traveller, the lamps on its lintel lit; through it, glimpsed beyond, a chasm where great stones hang in the air above their places. Carved friezes of three dots over an upward arc, small bells carved in every niche, a stone ball resting in a groove in the floor. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands by the door with the whistle to their lips, dwarfed by the hall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone white stone, warm bronze, blue glaze, pale sky light, rose and lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Entrance: the tower out of the cloud.**

```
Environment concept art for a science fiction exploration game: a tall round tower of bone-white stone rising straight out of a sea of white cloud, seen from the rim of a rocky plateau. A long narrow stone bridge leads from the plateau's edge to a gallery that rings the tower at its door; the door is a tall arch with a carved bell over it. At the top an open belfry with a great bronze bell, and round it big stones hanging in the air where they fell up, more floating stones and bone-white needle rocks across the sky, a rose-cliff monastery on a far plateau. At the bridge's near end a woman keeper stands beside a cloaked adult human traveller of ordinary height with a round jade fluid backpack, the keeper an adult of the same height as the traveller; both are dwarfed by the tower, its door arch many times their height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone white, white cloud sea, rose cliffs, bronze, peach and pale gold sky, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 4. The Hush-House, Lorn (`hush-house`)

**Main: the Choir, where the makers sang from low to high.**

```
Interior concept art for a science fiction exploration game: the choir hall inside a great low ribbed dome of violet stone, the makers' temple in a twilight swamp, lit from within by singing crystals. Four tall crystals of four heights stand in a curved row on the floor like a choir, smallest to biggest, translucent violet and teal; the first and second glow and hum, drawn as faint rings of sound, the others still dark. Swamp crystals grow up through the floor and the ribs; an oculus far above with a crystal crown lets in dusk light; a stone door with lamps on its lintel waits at the far end. On the walls carvings of three drops of rain over a shut mouth. A cloaked adult human traveller of ordinary height with a round jade fluid backpack splashes the third crystal with a stream of glowing fluid, dwarfed by the crystals, the tallest three times their height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, violet stone, teal and violet crystal glow, moss green, deep indigo shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Entrance: the dome on the cave island.**

```
Environment concept art for a science fiction exploration game: a great low dome of ribbed violet stone on a small island in a twilight swamp, seen from a hover-skiff channel at dusk. An oculus at its top crowned with a large crystal, swamp crystals growing up through the dome and around it, a stone porch facing the channel with a carved mark of three drops over a shut mouth above its dark door, flat stepping stones to it through the shallows. Carnivorous plants with closed jaws, glowing eggs in the reeds, giant pale fungus trees with glowing caps, a reed-cutter in a boat keeping his distance. A cloaked adult human traveller of ordinary height with a round jade fluid backpack steps onto the stepping stones, dwarfed by the dome, its porch door twice the traveller's height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, violet stone, teal crystal glow, moss green, dusk rose sky, deep indigo shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 5. The Lamp-House, Lorn II (`lamp-house`)

**Main: the Hall of Dark Pools, where light wakes what waits for it.**

```
Interior concept art for a science fiction exploration game: a dark hall inside a tapering tower of the makers in a deep swamp wood, almost black, lit only by the small warm glow of a lantern charm carried by the traveller. In the stone floor three round pools set in carved rims, two dark, one just waking with a soft gold light rising from its water; against the west wall a loft of great twisted roots climbs to a high ledge, the edge of a third pool just visible on top of it, glowing faintly. Moss-covered stones, a riding stone disc over a dark pool beyond an arch, a stone door with dark lamps on its lintel. A glass orb of pool water rests in a groove in the floor. Friezes of three lamps over a hull. A cloaked adult human traveller of ordinary height with a round jade fluid backpack, a little glowing lantern charm at their hip, stands at a pool's rim, dwarfed by the dark hall, their light making a soft circle round them. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, deep blue-violet darkness, warm lamp gold, moss green, coral glints, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Entrance: the dark tower in the shallows.**

```
Environment concept art for a science fiction exploration game: a dark tapering tower of the makers standing in the shallows of a deep violet wood at dusk, under giant pale mushrooms, seen from the end of a lit path. The tower is banded, with a glass lamp-room and a cap at its top, the lamp dark; a causeway of flat stones leads out across the water to its low door. Along the path behind, lit pools glowing in the moss, root arches, moss domes, crystal reeds; a girl of about twelve with a notebook counts the lamps at the causeway's start, a head shorter than the traveller beside her. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands there about to walk out, dwarfed by the tower, its low door a little above head height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, violet trunks, pale mushroom cream, dark slate tower, warm pool gold, coral glow, deep blue shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 6. The Builders' Greenhouse, Viridel (`builders-greenhouse`)

**Main: the Vine Gulf, where the garden is told to go on.**

```
Interior concept art for a science fiction exploration game: a chasm hall inside a great greenhouse of the white builders, clean gridded white stone walls and a ribbed glass roof high above full of bright daylight. Across the chasm a living vine bridge has just grown from a seed at the near edge, leaves and pink blossoms unfurling along it; on the far side a tall wall of smooth greenhouse glass panes with a second vine climbing up it from a seed at its foot, and at its top a great closed flower bud over a doorway, its petals hinged round the rim. Dead sticks in stone pots along the walls; dust in the light. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the chasm's edge, a stream of leaf green and petal pink glowing fluid arcing from the nozzle onto the seed, dwarfed by the hall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, white stone, leaf green, petal pink, sunlit glass, sky blue, soft blue shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Entrance: the glass dome in the meadow hollow.**

```
Environment concept art for a science fiction exploration game: a round house of clean gridded white stone under a great ribbed glass dome, several panes broken, standing in a flat meadow hollow of a bright colourful garden world, giant umbrella trees and white step pyramids beyond. Bare sown beds in neat rows round it where nothing has come up; a tall doorway of white stone with a frieze of three dots over an upward arc; a woman in a straw hat kneels by the nearest bed with a bag of seed, and a cloaked adult human traveller of ordinary height with a round jade fluid backpack stands beside her; standing she would be the traveller's height. Both are dwarfed by the dome, the doorway about twice their height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, white stone, glass, meadow yellow-green, leaf greens, petal pink, sky blue, soft blue shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 7. The Warden's Well, the City-Shaft (`wardens-well`)

**Main: the Lamp Gallery, a well of the makers turned on its end.**

```
Interior concept art for a science fiction exploration game: a tall round drum hall inside a makers' tower, cream stone banded in steel blue, rising so high its top is lost in light from tall slit windows. Stone shelves jut from the walls at different heights, each hiding a carved stone eye set in the wall above it from anyone on the floor; one eye already glows. The floor far below, a stone disc, a ball in its groove. A cloaked adult human traveller of ordinary height with a round jade fluid backpack flies up the drum on twin jets of glowing fluid from the backpack, dwarfed by the great well, turning toward the next shelf to splash its eye, a faint trail spiralling below. Carved friezes of three dots over an upward arc, a dark blue crown far above. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream stone, steel blue bands, dark blue, warm slit-window light, cyan jet glow, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Entrance: the makers' tower on the rim.**

```
Environment concept art for a science fiction exploration game: a stepped drum tower of cream stone with steel-blue bands, tall slit windows and a dark blue crown ringed with carved glyphs, standing on the rim of an immense pit city, seen across a paved forecourt. Its door is a tall dark arch at the top of a short flight of steps, an unlit lamp on a post beside it and a woman lamplighter with a long pole, an adult of the same height as the traveller. Beyond the rim's parapet the shaft drops away, cream villas and terracotta roofs stacked on blue-grey steel terraces, a golden palace on a central spire, flying taxis and blimps in the haze. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands near the lamplighter at the foot of the steps, both dwarfed by the tower, the door arch about three times their height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream stone, steel blue, dark blue, terracotta, gold, hazy turquoise depths, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 8. The First Garage, the Sealed Hangar (`first-garage`)

**Main: the Clock Gallery, where everything takes its beat.**

```
Interior concept art for a science fiction exploration game: a gallery inside the makers' clockwork house, pale stone banded in brass, a deep chasm across its middle with great cogs and an escapement turning slowly in the dark below. On the far wall an enormous stopped clock face of pale stone with brass hands, round it a ring of six carved stone eyes; four glow, two are dark. Retracted bridge stones wait in the chasm's walls. Pendulums and brass gears in recesses, a frieze of three dots over an upward arc, warm light from high round windows. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the chasm's edge, firing quick bright splashes of glowing fluid at the eyes in rapid succession, a coil on the backpack glowing, dwarfed by the clock. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale stone, brass, teal accents, warm window light, deep umber shadows in the chasm, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Entrance: the stair-house with the stopped clock.**

```
Environment concept art for a science fiction exploration game: a round stair-house of the makers on the rim of a paved plateau in a pocket universe, pale stone banded in brass under a teal cap, a great clock over its door stopped at a wrong hour. Under it, set into the plateau's cliff, enormous makers' cogs half out of the rock. Beside the door a lean-to porch with an old workbench, tools and a dusty little old car under a sheet. A windmill, a keep hung with cables and aerials, pipes with valve wheels behind; a glowing round portal at the plateau's edge, an upside-down city faint in the sky. By the porch an old man winds a clock on a post, and a cloaked adult human traveller of ordinary height with a round jade fluid backpack stands beside him, the old man an adult of the same height as the traveller; the house's door is about twice their height, the workbench at their waists. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale stone, brass, teal cap, rust red pipes, cream paving, blue sky, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 9. The Engine-House, the Buried Machine (`engine-house`)

**Main: the Furnace, the engine that turns the wheel.**

```
Interior concept art for a science fiction exploration game: a furnace hall inside a drum of rust-red iron, the engine house of a great buried wheel, a chasm across the floor glowing with embers far below, heat haze rising. The walls are machinery: huge iron pistons standing still in their cylinders, a giant crank and connecting rods, pipes and valve wheels, riveted plates banded in blue-grey. On the far wall a bank of four carved round eyes in a square, two glowing; bridge plates folded against the chasm's far lip. A ring window high above lets in a cool shaft of daylight. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands on the near lip, four quick splashes of glowing fluid flying toward the eyes, a fourth chamber on the backpack lit, dwarfed by the engine. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rust red iron, blue-grey bands, ember orange glow, brass, cool teal daylight, deep umber shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Entrance: the iron drum out of the dunes.**

```
Environment concept art for a science fiction exploration game: a tall drum of rust-red iron standing out of pale dunes, banded in blue-grey, a ring window high on its face, pipe elbows going into the sand round its foot and a teal cap on top; its oval door faces a hollow among small riveted domes. A man greases the door's hinges with a pot and brush, an adult of the same height as the traveller, the oval door about twice their height. Beyond, a trench of blue-grey machine strata, a great ring wall on the horizon, and an upside-down city hanging in a sage-green sky. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands a few steps from him by the door, both dwarfed by the drum. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale cream dunes, rust red iron, blue-grey bands, teal cap, sage sky, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 10. The Footprint, the Garden of Spheres (`footprint`)

**Main: the Hall of the Unseen, seen through the glyph lens.**

```
Interior concept art for a science fiction exploration game: a hall inside a giant pale sphere half sunk in the earth, its curved white walls rising into a dome, a deep chasm splitting the floor. Across the chasm a bridge of pale glass that only shows through a lens: half the picture seen plainly, the chasm empty, and half seen through a round glowing lens, the glass bridge outlined in soft light with the hidden carved eye beside the far door glowing and a frieze of three dots over an upward arc lit up on the wall. Still water in a sunken pool behind, a pale riding disc. A cloaked adult human traveller of ordinary height with a round jade fluid backpack holds up a round makers' lens to one eye at the chasm's edge, dwarfed by the hall, stepping onto the unseen bridge. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, white sphere stone, pale glass glow, pale blue, peach light, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Entrance: the great print in the meadow.**

```
Environment concept art for a science fiction exploration game: an enormous three-toed footprint pressed into a green meadow, its rim of white stone, as if something walking through the sky had stepped here; at its heel a great pale sphere half sunk in the ground with a round-headed door facing an umbrella grove, seen from a high bank. Umbrella trees with gill undersides, white pyramids, other giant spheres on the horizon, a cypress avenue. A cloaked adult human traveller of ordinary height with a round jade fluid backpack and a woman of the same height walk side by side along the print's white rim toward the sphere's door, which is about twice their height; both are dwarfed by the sphere. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, meadow yellow-green, white stone, pale sphere, cypress green, pale blue sky, peach clouds, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 11. The Undertower, the Signal Market (`undertower`)

**Main: the Gallery of Voices, where a note is carried back.**

```
Interior concept art for a science fiction exploration game: a gallery deep under a market city in the foundations of the makers, blue-grey stone blocks older than anything above, bundles of ancient cable running along the walls and down into a chasm. On the near side three singing stones of different sizes on plinths, one just splashed and humming, drawn as rings of sound; at the chasm's edge a great brass horn on a stand, its bell turned to the chasm; across the gap a stone door with three lamps over it. Through gaps in the ceiling, faint coloured light from the market's signs far above. A cloaked adult human traveller of ordinary height with a round jade fluid backpack holds up a pale spiral shell, a note visibly flowing out of it as glowing rings toward the horn, the first bridge stones rising out of the chasm, dwarfed by the gallery. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, blue-grey stone, brass, coral light, teal glints, deep blue shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

**Entrance: the old doorway in the silent tower's back.**

```
Environment concept art for a science fiction exploration game: an old doorway of blue-grey makers' stone at the foot of a tall silent broadcast tower in a crowded alien market city, seen from the back of the square at dusk, where the bright paving gives way to huge ancient blocks older than any sign. Thick old cables run from the doorway into the ground; the tower rises above, stacked and dark, among coral and teal towers covered in lit illustrated billboards, skybridges and flying taxis. An old man lies on the paving with his ear to the stones, listening, and a cloaked adult human traveller of ordinary height with a round jade fluid backpack stands beside him by the doorway, which is about twice the traveller's height; the tower dwarfs them both. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, blue-grey stone, coral and teal towers, warm sign light, lavender dusk, deep blue shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```
