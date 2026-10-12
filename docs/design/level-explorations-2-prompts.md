# Level explorations, part 2: reference prompts for the other eight route worlds

2026-10-11. After the first four worlds (`docs/design/level-explorations-prompts.md`: the Glass Dunes, the Desert,
the Buried Machine, the City-Shaft), the author asked to "create more references for the other existing levels".
The other eight worlds of the route, in the same form:

1. **Vael**, with the sky stones;
2. **Lorn**, with the Deep Wood;
3. **Viridel**;
4. **The Garden of Spheres**;
5. **The Signal Market**;
6. **The Underwater City**;
7. **The Moon Foundry**;
8. **The City Floating in Space**.

For each world: what it looks like today and why it feels flat, then three directions to make it more
interesting. The sources are its code in `src/levels/`, its references in `references/levels/<World>/`, the v1.49
audits (`docs/audits/level-design-v1.49.md`, `game-v1.49.md`), the level design work of v1.50 (Vael's plain
sights, Lorn's stakes, Viridel's spire and seed row, the Garden's hill path and belvedere bell, the Underwater
City's kelp tube, the City Floating in Space's Lamp Rock), and screenshots taken in the game on 2026-10-11 (the
audit's views: the landing, the longest empty stretch, a blind leg). The directions build on the v1.50 work rather
than repeat it. They keep the world's identity and story: additions and transformations, not replacements. Each
direction says how it would play (a mechanic, a loop, a reveal) and has two sheets: an establishing view and a
ground-level moment.

Plain text prompts for the reference lab (`reference-lab.html`, `scripts/gen-reference.mjs --from
docs/design/level-explorations-2-prompts.md#<id>`). A pick goes to the direction's folder, named in its section's
`Target folder:` line, under `references/levels/<World>/environment/explorations/<direction>/`. A merged world's
directions go under its first part's folder (`Vael/`, `Lorn/`), the world's name on the route.

Every prompt keeps the house style of the other reference prompts (`docs/design/fire-ice-prompts.md`) and the
world's own palette, and shows the small cloaked traveller with the round jade glass backpack for scale.

---

## Vael

**Now.** A pale peach plain 38 m up, cut by dry canyons with red-brown walls, with about 90 needle spires
(60–320 m), stone arches, 22 floating ruins, 48 hoodoos and balanced boulders. The fallen colossus, the stone hand
and the lone tower (about 275 m) stand on it; at its edge a rose cliff drops to a sea of cloud, where the sky
stones float: the monastery, the mushroom table, the island church, two aqueducts, the bell tower, Aube's hermitage
and the Founders' Belfry. You walk and glide on the plain, ride the tower's wind, then fly the great bird over the
cloud. A 5.5 km, 11-minute path. v1.50 put the great bird's bones and the riders' shrine on the plain, Aube's smoke
over the stones and the founders' lamp on the Belfry (density 3 → 4, Vael 4.44 → 4.67).

**Why it feels flat.** The plain's shapes are scattered at random over 2.6 km, so the same five (needle, hoodoo,
cone ruin, boulder on a needle, arch) repeat everywhere with no grouping and no composition, and the ground between
them is one peach floor with canyons you never walk in. The tower is in view from the porch of the Aerie, whole,
across open ground: there is nothing to go round and nothing to come over, so it is never revealed. The two halves
are stitched by a flight: the plain ends at a cliff and the stones begin in the air, and the land itself never shows
how stones "fell up". The world's themes (waiting, silence, the rider who left) are told by objects added on the
sand (the mast, the bones, the shrine), not by the land. In the game today: from the Aerie's longest stretch, a
low peach rise with a pale needle field beyond and floating ruins over it; at the tower's foot, a grey shaft among
scattered needles and the riders' camp.

### Direction A: Where the stones fall up (`falling-up`)

Toward the cliff the plain is coming apart: first cracks, then slabs tilted out of the ground, then slabs a
metre up, then whole tables of plain hanging over the cloud with the needles still standing on them, roots of
rock trailing below. The two halves of Vael become one slope from the ground to the sky. **Play:** the walk
from the tower to the riders' gate goes up this broken edge, step by step from slab to slab, gliding the
gaps; the slabs bob and turn slowly, and a few rise while you stand still on them (Vael's patience, made a
mechanic: wait and the stone carries you up). The bird is still the way across the cloud, but you come to her
on foot, out at the last stone. The reveal: looking back from the highest stone, the whole plain with the
hole it is leaving.

Target folder: `references/levels/Vael/environment/explorations/falling-up/`

#### 1. The edge that rises (`va-falling-up-establishing`)

**Main: the plain's edge breaking into stones that float up over the cloud.**

```
Environment concept art for a science fiction exploration game: a wide establishing view of the edge of a pale peach desert plain where the ground is coming apart and falling upward, seen from the plain at mid-morning. In the foreground the ground is cracked; further out great slabs of the plain tilt up out of it, then hang a few metres in the air, then float higher and higher over a sea of white cloud below a rose cliff, each slab still carrying its own bone-white needle spires, hoodoos and a little stone arch, roots and threads of red rock trailing beneath them, loose pebbles drifting up; far off, cliff-top monasteries and an island church float in the haze, and a great bird circles. A small cloaked human traveller with a round jade glass fluid backpack stands on the first tilted slab for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone-white and cream stone, peach ground, rose cliffs, white cloud, aqua sky, grey-teal shade, pale lilac haze, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 2. The stone that carries you (`va-falling-up-ground`)

**Main: standing still on a floating slab as it rises.**

```
Environment concept art for a science fiction exploration game: close up on a floating slab of pale peach rock a few metres wide, rising slowly through the air past the broken edge of a desert plain; a small bone-white needle spire leans on the slab, dust and pebbles fall up from its rim, a frayed rider's rope hangs from an old iron ring set in the stone; below, the gap and the cracked edge of the plain, other slabs at different heights around, and far below, a sea of white cloud. A small cloaked human traveller with a round jade glass fluid backpack sits patiently on the slab with folded fabric wings, waiting, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone-white and cream stone, peach rock, rose cliffs, white cloud, aqua sky, grey-teal shade, pale lilac haze, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction B: The silent canyons (`silent-canyons`)

The dry canyons are the riders' old roads, sunk below the plain: narrow, winding, walled in red rock, with
carved niches, stone ears on the walls and steps cut down to them. In a silent world sound carries in a canyon:
the riders spoke here only in whispers, and a word said aloud runs ahead of you round the bends. **Play:** the
approach to the tower goes down into a canyon and along it, so the tower is lost from view and found again: the
canyon ends at its foot and you see it rise straight up out of the cleft (the reveal the plain misses). The
loop: call into a stone ear and listen for where the echo comes back from, the way on; the bird's call, learnt
later, rings the whole canyon. The plain above stays open and bare, now a roof over a hidden world.

Target folder: `references/levels/Vael/environment/explorations/silent-canyons/`

#### 3. The roads under the plain (`va-silent-canyons-establishing`)

**Main: winding canyons cut into a pale plain, a lone tower rising out of one.**

```
Environment concept art for a science fiction exploration game: a wide establishing view from high over a pale peach desert plain cut by deep narrow winding canyons of red-brown rock, like cracks in dry clay, seen in the late afternoon; inside the canyons, far below the plain, an old road runs along the floors with carved stone steps, niches with little shrines, great carved stone ears in the walls and a few riders' streamers; the canyons all lead to a single tall slender stone tower that rises straight up out of the deepest cleft, a domed room and a spike at its top; bone-white needle spires stand on the plain above and their long shadows fall across the canyons. A small cloaked human traveller with a round jade glass fluid backpack walks the canyon road far below for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone-white stone, peach plain, red-brown canyon walls, aqua sky, grey-teal shade, pale lilac haze, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 4. The stone ear (`va-silent-canyons-ground`)

**Main: in a canyon, speaking into a great carved ear.**

```
Environment concept art for a science fiction exploration game: at the bottom of a narrow winding canyon of red-brown rock, a thin strip of aqua sky far overhead, a great ear carved into the canyon wall, its hollow taller than a person, smooth and pale inside, with a small offering of pebbles on its lip; worn steps lead on round the bend, a riders' faded streamer hangs from a peg, and ripple lines drawn faintly in the air show a whisper running away round the corner; the light is cool and the walls glow warm where the sun strikes high up. A small cloaked human traveller with a round jade glass fluid backpack leans into the ear, listening, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone-white stone, red-brown and rose canyon walls, aqua sky, grey-teal shade, pale lilac haze, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction C: The plain is a sundial (`sundial-plain`)

The needles were not scattered: the riders set them, in rings round the lone tower, and the tower is the gnomon
of a sundial as wide as the plain. Each needle is an hour; the riders' stones lie where its shadow falls; the
rider promised to come back "when the tower's shadow touches the mounting stone", and the bird waits there.
**Play:** the tower's shadow sweeps the plain through the day, a moving leading line; things happen where it
lies (a shrine opens in the shade, the hoodoo bees come out, a door in a needle lines up with the sun). The loop:
the hour stones, found one by one round the ring, each with a rider's mark. The reveal: from the tower's top,
the needles drawn in rings like a clock face, and the long shadow pointing at the bird.

Target folder: `references/levels/Vael/environment/explorations/sundial-plain/`

#### 5. The clock of needles (`va-sundial-plain-establishing`)

**Main: needles in rings round a lone tower, its long shadow across the plain.**

```
Environment concept art for a science fiction exploration game: a wide establishing view from high up of a vast pale peach desert plain in the late afternoon, where bone-white needle spires of different heights stand in great concentric rings around a single tall slender stone tower in the middle, like the hour marks of a sundial; the tower's very long shadow stretches across the plain and touches a low flat mounting stone on the outer ring, where a huge white bird with long wings sits waiting; small stone markers and riders' shrines lie in the shadows of the needles; a rose cliff and a sea of cloud on the far horizon with stones floating over it. A small cloaked human traveller with a round jade glass fluid backpack walks along the shadow for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone-white and cream stone, peach ground, rose cliffs, white cloud, aqua sky, grey-teal shade, long violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 6. The hour stone (`va-sundial-plain-ground`)

**Main: at an hour stone as the tower's shadow reaches it.**

```
Environment concept art for a science fiction exploration game: at ground level on a pale peach desert plain, a low round hour stone carved with a single rider's mark and a groove for the shadow, a bone-white needle spire standing behind it; the long straight shadow of a distant stone tower is just reaching the stone across the sand, and where it touches, a small niche in the needle's foot opens and a little lamp glows; the next needles of the ring stand in a curved row toward the horizon, the tower far off. A small cloaked human traveller with a round jade glass fluid backpack kneels by the stone watching the shadow arrive, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone-white stone, peach ground, aqua sky, grey-teal shade, long violet shadow, warm lamp glow, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

---

## Lorn

**Now.** A twilight swamp of channels and dry islands: crystal groves of glowing spikes (6–46 m), carnivorous
jaws, egg clutches, violet fungus trees, the fireflies' isle, the Great Crystal (spires to 95 m) and the crystal
cave round the Hush-House. You wade, swim and whistle the hover-skiff. 480 m on lies the Deep Wood: 420 dark
trunks of 110–170 m, 46 pale half-transparent mushrooms (the Veils), a lit path of about 410 m beside a teal stream
under root arches, moss domes, the saucer pod, the root cave and the Lamp-House. A 3 km, 6-minute path. v1.50 laid
the keepers' stakes from the cave to Hollin (a pole every 40 m with a coral glass float) and made the Great Crystal
a beacon (wayfinding 100 %).

**Why it feels flat.** The swamp is generic flat water with the same groves of spikes and jaws dotted about, and
the world's namesake reads small: the wood's trunks out-scale the Great Crystal, and nothing in the land says it is
"a piece of something that fell". The 631 m crossing is now guided, but nothing happens on it (in the game the
audit's view of it is open water and haze). The Deep Wood is one corridor under a uniform roof: a heap, a pool, an
arch, again, no clearing and no view, and for 170 m trunks the path climbs 42 m. In the game today: from the
landing a grassy bank, a lamp-lit channel and a grey wall of trunks on the horizon, the crystals at the frame's
edge.

### Direction A: The roots of the crystal (`crystal-roots`)

The Great Crystal is the tip of something huge. Its roots run under the swamp: veins of violet and teal crystal
under the water, across the whole basin, breaking the surface as the groves. In the rain the crystal sings and the
veins light under the water, a pattern converging on the Crystal like the veins of a leaf. **Play:** the rain turns
the swamp into a map: you follow a lit vein under the skiff across the crossing; where veins meet, a grove rings
and something wakes (eggs hatch, the jaws close); the splinter you carry glows near a vein. The reveal: from the
cave's heart, the whole network lit at once, and the shape it makes is the fall's splash, the place where
"something fell".

Target folder: `references/levels/Lorn/environment/explorations/crystal-roots/`

#### 7. The veins under the swamp (`lo-crystal-roots-establishing`)

**Main: glowing crystal veins under dark water, converging on a great crystal.**

```
Environment concept art for a science fiction exploration game: a wide establishing view over a twilight swamp of dark channels and low islands in gentle rain, seen from a high crystal outcrop; under the water's surface, glowing veins of violet and teal crystal branch across the whole swamp like the veins of a leaf, all converging on a huge many-pointed crystal that rises from an island in the middle, glowing from within; where veins break the surface they become groves of crystal spikes; reeds, fungus trees with violet stalks, coral carnivorous plants and pale glowing eggs line the banks; a hover-skiff glides along one lit vein. A small cloaked human traveller with a round jade glass fluid backpack stands on the outcrop in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, twilight blue, violet and coral, glowing teal and lilac crystal, muted olive moss, navy shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 8. Riding the lit vein (`lo-crystal-roots-ground`)

**Main: on a skiff over a glowing vein under the water.**

```
Environment concept art for a science fiction exploration game: low over the dark water of a twilight swamp in the rain, a small hover-skiff glides along a glowing vein of teal and violet crystal that runs just under the surface, its light rippling up through the raindrops; ahead the vein splits round a little island of crystal spikes ringing softly, faint rings drawn in the air; on the bank, a clutch of pale glowing eggs and a coral carnivorous plant with its jaws closed, reeds, a keepers' stake with a coral glass float. A small cloaked human traveller with a round jade glass fluid backpack stands on the skiff looking down at the light, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, twilight blue, violet and coral, glowing teal and lilac crystal, muted olive moss, navy shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction B: The keepers' canopy (`keepers-canopy`)

The keepers did not live on the ground: their old village is up in the Deep Wood, at 60–120 m, in the trunks.
Platforms ring the trunks, rope bridges run between them, little lamp-houses hang from the branches, and the
Veils' great pale caps are the village's squares. **Play:** the wood gets a second floor: climb a trunk by the
keepers' ladders, walk the canopy, look down through the gaps onto the lit path and the pools far below. The lamp
loop goes up there: the keepers lit the pools from above, letting a lamp down on a cord, so a dark pool is relit by
finding its winch overhead. The reveal: at the top of the tallest trunk, a view out over the canopy to the swamp
and the Great Crystal glowing on the horizon, the two halves of Lorn in one look.

Target folder: `references/levels/Lorn/environment/explorations/keepers-canopy/`

#### 9. The village in the trunks (`lo-keepers-canopy-establishing`)

**Main: a lamplit village of platforms and rope bridges high in a dark wood.**

```
Environment concept art for a science fiction exploration game: a wide establishing view inside an immense dark wood of cathedral trunks at dusk, looking across at mid-height: an old keepers' village hangs high among the trunks, round platforms ringing the trunks, rope bridges and plank walkways strung between them, little round lamp-houses hanging from branches, ladders, and the great pale half-transparent caps of giant mushrooms serving as squares with lanterns on them; far below, a teal stream and a path of lit pools glow on the forest floor; through a gap, a dusty rose sky. A small cloaked human traveller with a round jade glass fluid backpack crosses a rope bridge in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, dusty rose sky, deep indigo trunks, pale translucent mushroom caps, teal moss, warm lamp and coral glow, navy shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 10. Letting down the lamp (`lo-keepers-canopy-ground`)

**Main: on a high platform, lowering a lamp toward a dark pool far below.**

```
Environment concept art for a science fiction exploration game: on a round wooden platform high on a giant dark trunk in a deep wood, an old keepers' winch of wood and brass with a coil of cord, a glowing coral lamp being let down on the cord through a gap in the planks toward a dark pool far, far below on the forest floor; around the platform, a rope bridge leading off to a pale mushroom cap, hanging lamp-houses, moss on the rail, a few drifting spores. A small cloaked human traveller with a round jade glass fluid backpack turns the winch handle, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, dusty rose light, deep indigo trunks, pale translucent mushroom caps, teal moss, warm coral lamp glow, navy shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction C: The flooded wood (`flooded-wood`)

The swamp's water runs into the Deep Wood: the crossing does not end at a shore but in a drowned forest. Trunks
rise out of the open water, closer and closer, the roof closes overhead, the light goes from twilight blue to
rose, and the skiff threads between them under root arches into flooded clearings where shafts of light fall on
islands of moss and egg heaps. **Play:** the crossing gets a shape and a reveal (open water, then the forest's
edge, then the nave); in the wood the skiff takes you off the walking path to clearings you can't reach on foot,
each one a pause with something in it (a moss dome, the saucer's furrow, a heron's nest); the water rises and
falls with the crystal's song, opening low root arches at low water.

Target folder: `references/levels/Lorn/environment/explorations/flooded-wood/`

#### 11. Where the water enters the wood (`lo-flooded-wood-establishing`)

**Main: open swamp water running in under the trunks of a giant drowned forest.**

```
Environment concept art for a science fiction exploration game: a wide establishing view from the open water of a twilight swamp toward the edge of an immense drowned forest: giant dark trunks rise straight out of the still water, scattered at first then closer together, their roots arching above the surface like bridges, the canopy closing overhead into a dark roof; the light changes from twilight blue over the open water to warm rose and coral under the trees; pale giant mushrooms grow on the trunks, glowing pools of light lie in flooded clearings deeper in, and a line of keepers' stakes with coral floats leads in among the trunks. A small cloaked human traveller with a round jade glass fluid backpack rides a small hover-skiff in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, twilight blue, dusty rose and coral, deep indigo trunks, pale translucent mushrooms, teal moss, navy shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 12. The flooded clearing (`lo-flooded-wood-ground`)

**Main: the skiff gliding into a clearing of light among drowned trunks.**

```
Environment concept art for a science fiction exploration game: low on still dark water inside a drowned forest of giant trunks, a hover-skiff gliding out from under a low arch of roots into a round flooded clearing where a shaft of rose light falls from a gap in the canopy onto a small island of moss with a heap of pale glowing eggs and a little moss dome house; giant pale mushrooms on the trunks around, their reflections in the water, drifting spores lit in the shaft, the roots dripping. A small cloaked human traveller with a round jade glass fluid backpack ducks under the roots on the skiff, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, dusty rose and coral light, deep indigo trunks, pale translucent mushrooms, teal moss, glowing eggs, navy shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

---

## Viridel

**Now.** One rolling meadow (about ±40 m of relief) under a deep cerulean sky, inside a rim of walls 160–280 m
high 1.3–1.9 km out. On it, scattered: 48 climbable umbrella trees, 9 white step pyramids (the main one 90 m
wide), 8 clusters of white android ruins, 9 half-sunk spheres, rows of pastel ornaments on pedestals, a pond. The
landmarks: the 92 m tallest tree, Odile and Talo's crashed ship nose-down in its furrow, Mira's water clock, Esk's
tea terraces, and the Builders' Greenhouse in its hollow. A 1.3 km, 3-minute path. v1.50 put a 49 m glass spire on
the Greenhouse, seen from Mira's, and laid Sorrel's long seed row home past the ruins (Viridel 4 → 4.56).

**Why it feels flat.** The meadow is one noise field, and its places are random scatters of the same three props
(umbrella tree, pyramid, ruin cluster), so one part of it reads like the next; the Garden of Spheres has the same
three. The fixes so far are leading lines laid on the grass (the runnel, the seed row), not changes to the land,
and the height (the 92 m tree) is optional. Viridel's own story, a garden that keeps whatever falls, is told by one
ship. No environment reference has been picked for it yet. In the game today: from the landing, a green slope
with white blocks, a lilac dome and a pyramid on it; along the empty stretch, a lilac half-sphere and a line of
ornaments on pedestals across bare grass.

### Direction A: The garden of fallen things (`fallen-things`)

Odile and Talo's ship is not the only thing the garden has kept: everything that ever fell on Viridel is still
here, grown over. The meadow's hills are wrecks: an old round ship under a hill of flowers with a tree growing out
of its hatch, a satellite's dish turned into a pond, a meteor split open with a garden in it, a builders' machine
lying on its side as a terrace. **Play:** each mound is a wreck to find the door of (a hatch under the roots, a
porthole in the grass), and each holds a little of who fell; the gardeners' rule (never dig it up) makes them
puzzles of going in without cutting. The reveal: from the tallest tree, the walls round the meadow are the rim of a
crater, and the whole valley is the oldest fall of all.

Target folder: `references/levels/Viridel/environment/explorations/fallen-things/`

#### 13. The meadow of wrecks (`vi-fallen-things-establishing`)

**Main: a flowering meadow whose hills are overgrown wrecks.**

```
Environment concept art for a science fiction exploration game: a wide establishing view from the crown of a giant umbrella tree over a bright flowering meadow inside a vast ring of distant cliffs, like the rim of an ancient crater; the meadow's hills are all fallen things grown over by the garden: a round old spaceship half buried under a hill of pink and mint flowers with a tree growing out of its hatch, a great dish antenna lying in the grass filled with water like a pond, a split meteor with a garden inside, a builders' white machine lying on its side turned into terraces, a capsule nose-down in a furrow veiled in blossom; white step pyramids and umbrella trees between them, a ringed planet in a deep blue sky. A small cloaked human traveller with a round jade glass fluid backpack stands on the tree's crown in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, mint, pink, aqua, peach and lavender, fresh green grass, cream-white stone with teal accents, deep cerulean sky, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 14. The door under the flowers (`vi-fallen-things-ground`)

**Main: finding the hatch of an old ship under a hill of flowers.**

```
Environment concept art for a science fiction exploration game: at ground level on the flank of a grassy hill covered in pink, mint and peach flowers, a round hatch of an old buried spaceship shows through the turf, its rim of cream metal and teal paint just visible among the roots of an umbrella tree that has grown out of the hull; the hatch is ajar and a soft light comes from inside; a gardener in a wide hat waters the flowers beside it with a long-spouted can, a porthole peeps out of the grass further along, bees and petals in the air. A small cloaked human traveller with a round jade glass fluid backpack kneels at the hatch, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, mint, pink, aqua, peach and lavender, fresh green grass, cream metal with teal paint, deep cerulean sky, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction B: The water stair (`water-stair`)

The gardeners grow on the slope as on a stair: Viridel rises from the pond in long terraces of white stone,
each a bed of a different flower, fed by channels and little falls from the Greenhouse's hill, with sluices
between them. The runnel and the tea terraces are the first steps of it. **Play:** opening a sluice floods the
terrace below; a flooded bed blooms (a colour spreads across the slope), its stepping stones go under and a new
way opens by a channel's kerb; the order you open them in changes the way up. Height on the path at last: you
climb the stair to the Greenhouse, and the water you let down is the walk home. The tea terraces' flood (the
quest that fails) becomes the one terrace that cannot hold.

Target folder: `references/levels/Viridel/environment/explorations/water-stair/`

#### 15. The terraced slope (`vi-water-stair-establishing`)

**Main: a hillside of white stone terraces, water falling from one to the next.**

```
Environment concept art for a science fiction exploration game: a wide establishing view of a long gentle hillside built into terraces of white stone, from a pond at the bottom up to a round white house under a ribbed glass dome with a slender glass spire at the top; each terrace is a bed of a different flower, mint, pink, peach, lavender, some flooded and shining, some dry; thin white channels, sluice gates and little waterfalls run from terrace to terrace; umbrella trees and white step pyramids stand on the slope, gardeners in wide hats work the beds. A small cloaked human traveller with a round jade glass fluid backpack walks along a channel's kerb in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, mint, pink, aqua, peach and lavender, fresh green grass, cream-white stone with teal accents, clear water, deep cerulean sky, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 16. Opening the sluice (`vi-water-stair-ground`)

**Main: lifting a sluice gate, water pouring onto a terrace that blooms.**

```
Environment concept art for a science fiction exploration game: at ground level on a white stone terrace on a hillside, a small sluice gate of white stone and teal-painted wood with a wheel, just lifted; water pours out over a little lip onto the terrace below, spreading across the bed, and where it reaches, pink and mint flowers open in a wave; a row of stepping stones in the bed is going under; above, more terraces and channels climb toward a glass dome; a gardener with a hoe watches. A small cloaked human traveller with a round jade glass fluid backpack turns the sluice wheel, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, mint, pink, aqua, peach and lavender, fresh green grass, cream-white stone, teal paint, clear water, deep cerulean sky, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction C: The pyramid nursery (`pyramid-nursery`)

Oro grows pyramids, and Viridel is where they are grown: not a scatter, a nursery. Rows of white step pyramids at
every age, from knee-high seedlings in beds, to houses, to the 90 m old one with trees on its terraces, the white
androids tending them like gardeners, scaffolds of vines on the young ones. **Play:** each age is a different
climb (a step, a ledge, a stair, a slope with trees), so the rows teach climbing in order; the oldest is still
growing, and its top step moves a little each visit; the pyramid seed of Oro's quest goes into an empty bed at the
end of a row. The reveal: from the old pyramid's top, the rows draw the builders' mark across the meadow.

Target folder: `references/levels/Viridel/environment/explorations/pyramid-nursery/`

#### 17. Rows of growing pyramids (`vi-pyramid-nursery-establishing`)

**Main: white step pyramids of every size in garden rows.**

```
Environment concept art for a science fiction exploration game: a wide establishing view over a bright meadow laid out as a nursery of white step pyramids in long garden rows: in the nearest beds tiny pyramids no higher than a knee sprout from the soil like seedlings, then rows of pyramids the size of sheds and houses wrapped in vine scaffolds, then great ones with trees and flowers growing on their terraces, and at the end of the rows one huge old pyramid; slender white android gardeners tend them with watering cans and pruning poles; umbrella trees shade the paths, a ringed planet in a deep blue sky. A small cloaked human traveller with a round jade glass fluid backpack walks between the rows in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream-white stone with teal accents, mint, pink, aqua, peach and lavender, fresh green grass, deep cerulean sky, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 18. Tending a young pyramid (`vi-pyramid-nursery-ground`)

**Main: a white android watering a seedling pyramid.**

```
Environment concept art for a science fiction exploration game: at ground level in a garden bed of soft dark soil, a young white step pyramid the height of a person, its stone still fresh and slightly soft-edged, little green shoots on its steps; a slender white android gardener with a round head pours water on it from a long-spouted can, a shy young gardener in a wide hat kneels planting a small white seed-cone in the next empty bed; behind, rows of bigger pyramids with vine scaffolds and one wrapped in flowers. A small cloaked human traveller with a round jade glass fluid backpack climbs onto the young pyramid's first step, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream-white stone with teal accents, mint, pink, aqua, peach and lavender, fresh green grass, dark soil, deep cerulean sky, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

---

## The Garden of Spheres

**Now.** A near-flat garden (3–13 m of relief): an umbrella grove at the landing, a mirror lake, the 12 m pearl
sphere, a white hill of pillowed rock with three terraces and a pyramid and belvedere on top (about 82 m), a
meadow pyramid, a field of giant spheres among thin white pillars, a sphere-arch, an olive and cypress avenue to
a round plaza with a humming pole, a great yellow sphere setting on the horizon, the android wood, and the
Footprint temple. The quest splashes three spheres for the sounds they remember and carries them to the pole. A
1.5 km, 3-minute path. v1.50 laid a white path to the hill's stair and put a bell on the belvedere that the spheres
answer.

**Why it feels flat.** The path is a straight forced-flat line south (grove, arch, avenue, plaza, about 620 m)
that climbs 13 m, and every bit of height (the hill, the belvedere, the pyramids) is beside it. The verb is the
same everywhere (splash a sphere, hear a note), and the spheres barely vary, so one reads like the next. It shares
its vocabulary with Viridel (umbrella trees, white pyramids, android ruins, half-sunk spheres). The references'
strongest images are not places you can walk: the pillar forest on pink skies, the sphere with an arch through it,
the water and ruins under the spheres. In the game today: from the landing, yellow-green grass, umbrella trees, a
pale dome and a ship; from the hill, a neat green park of trees and paths round a white pyramid.

### Direction A: Where the moons fell (`moon-falls`)

The spheres are the Moon Foundry's first moons, fallen short, and the land should show the falls. Each great
sphere lies at the end of the scar it made: a long furrow ploughed through the meadow, rings of thrown-up earth
turned into terraces, a crater that filled to a lake, and one sphere cracked open on landing, a hollow room inside
it. **Play:** the craters are bowls that carry sound: walk down the ringed terraces into one and the sphere's
memory plays louder as you go down, so the path dips and climbs (height on the path). Inside the cracked sphere you
hear its last sound from within, and find the founders' mark cast on its inner shell. The reveal: from the
belvedere, the furrows all point back to the same place in the sky.

Target folder: `references/levels/The Garden of Spheres/environment/explorations/moon-falls/`

#### 19. The furrows of the fallen moons (`gs-moon-falls-establishing`)

**Main: great spheres lying at the ends of long furrows and ringed craters.**

```
Environment concept art for a science fiction exploration game: a wide establishing view from a white hill over a green garden plain where several huge pale and butter-yellow spheres lie at the ends of the long straight furrows they ploughed when they fell from the sky; around each sphere the thrown-up earth has become rings of grassy terraces, one crater is filled with a round mirror lake with a sphere half sunk in it, and one sphere has cracked open on landing, showing a hollow pale room inside; umbrella trees, cypresses and small white step pyramids grow along the furrows, all the furrows pointing back toward the same place on the horizon, where a great yellow sphere is setting. A small cloaked human traveller with a round jade glass fluid backpack stands on the hill in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, lime and yellow-green grass, deep green trees, white stone, butter-yellow and pale ivory spheres, pale blue sky, peach and pink horizon, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 20. Inside the cracked moon (`gs-moon-falls-ground`)

**Main: stepping into a sphere cracked open, its hollow inside.**

```
Environment concept art for a science fiction exploration game: at the foot of a huge pale sphere lying in a grassy crater, its shell cracked open in a great jagged doorway taller than a house; inside, a smooth curved hollow room of ivory shell lit softly by the light through the crack, with a cast founders' mark of a crescent moon on its inner wall, grass and small flowers grown in over the threshold, faint rings drawn in the air showing a sound humming inside; rings of grassy terraces climb behind, umbrella trees on the crater's rim. A small cloaked human traveller with a round jade glass fluid backpack steps in through the crack, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, ivory and butter-yellow shell, lime and yellow-green grass, deep green, white stone, pale blue sky, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction B: The pillar forest (`pillar-forest`)

From the references: a forest of thin white pillars, some 60–100 m tall, and spheres resting on their tops, linked
by narrow white walkways and stairs that wind round the shafts. The white builders copied the spheres and set the
copies up high to hear them. **Play:** the way south from the arch goes up into the pillars instead of straight
down the meadow; a sphere's note runs down its pillar and along the walkways to the next, so splashing one high
sphere rings a chain across the forest, and finding the order that rings them all is the loop (a chord across
heights). The spheres up there remember different things from the ones on the ground. Height on the path, and the
pink sky the references have.

Target folder: `references/levels/The Garden of Spheres/environment/explorations/pillar-forest/`

#### 21. Spheres on white pillars (`gs-pillar-forest-establishing`)

**Main: a forest of slender white pillars with spheres on their tops under a pink sky.**

```
Environment concept art for a science fiction exploration game: a wide establishing view of a forest of very tall slender white pillars rising from a lime green meadow under a peach and pink sky, some of them carrying great pale and butter-yellow spheres balanced on their tops, others broken off; narrow white walkways and thin bridges link the pillars at different heights, and spiral stairs wind round some of the shafts; a few umbrella trees and cypresses at the pillars' feet, a white step pyramid half hidden among them, and far off a great yellow sphere setting on the horizon. A small cloaked human traveller with a round jade glass fluid backpack crosses a walkway high up in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, white stone, butter-yellow and pale ivory spheres, lime and yellow-green grass, deep green, peach and pink sky, pale blue shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 22. The high sphere (`gs-pillar-forest-ground`)

**Main: at the top of a white pillar, beside a sphere, the note running away along the walkways.**

```
Environment concept art for a science fiction exploration game: on the small round top of a tall white pillar, a huge pale sphere resting in a stone cup, a few drops of water running down its curve; faint drawn rings ring out from it and run along a narrow white walkway to the next pillar, where another sphere glows faintly in answer; below, far down, the lime meadow, cypresses and other pillars and spheres at different heights, the sky peach and pink. A small cloaked human traveller with a round jade glass fluid backpack stands beside the sphere with one hand raised, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, white stone, pale ivory and butter-yellow spheres, lime and yellow-green grass, deep green, peach and pink sky, pale blue shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction C: What the lake remembers (`lake-memory`)

The mirror lake does not reflect the garden as it is: it shows the garden as the spheres remember it, before they
fell, with white towns that are gone, people on the shore, the spheres hanging in the sky like moons. Causeways
of white stepping stones cross it just above the water. **Play:** look down to find your way: what is in the
reflection and not on the shore is a clue (a door in the reflected hill that is a cave mouth on the real one, a
path in the water where the meadow is blank); a sphere's sound played at the lake makes its memory show more. The
loop: three memories, three things that are really there once you know where. The reveal: standing in the middle,
in the reflection the spheres are back in the sky.

Target folder: `references/levels/The Garden of Spheres/environment/explorations/lake-memory/`

#### 23. The lake that shows another garden (`gs-lake-memory-establishing`)

**Main: a mirror lake reflecting a garden that isn't there, spheres in its sky.**

```
Environment concept art for a science fiction exploration game: a wide establishing view across a still mirror lake in a green garden of umbrella trees and cypresses; on the real shore there are only meadows, a white hill and a few half-sunk pale spheres, but in the lake's reflection a different garden shows: white domed towns and step pyramids on the shore, small figures walking, and the spheres hanging in the reflected sky like moons; a causeway of white stepping stones crosses the lake just above the water. A small cloaked human traveller with a round jade glass fluid backpack stands on the first stepping stone looking down at the reflection, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, lime and yellow-green grass, deep green trees, white stone, butter-yellow and pale ivory spheres, mirror water, pale blue sky, peach horizon, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 24. Reading the reflection (`gs-lake-memory-ground`)

**Main: on a stepping stone, the reflection showing a door the shore doesn't.**

```
Environment concept art for a science fiction exploration game: close up from a white stepping stone in a still mirror lake, looking down: in the water, the reflected shore shows a white hill with an arched doorway and a lit lantern, a sphere hanging over it in the reflected sky; on the real shore beyond, the same hill is only grass and pillowed white rock with no door; water lilies and small round leaves float near the stone, a pebble dropped sends rings through the reflection. A small cloaked human traveller with a round jade glass fluid backpack crouches on the stone gazing into the water, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, lime and yellow-green grass, deep green, white stone, pale ivory sphere, mirror water, pale blue sky, peach light, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

---

## The Signal Market

**Now.** One straight avenue on dead-flat ground, about 340 m from the landing to the silent tower: a 108 m
canyon between coral, teal and cream towers of 125–255 m (one every 60 m), a back row to 310 m and a 440 m needle
behind the square. 36 stalls every 27 m, four skybridges at 19–72 m, cabs, a crowd, the quiet ones. The silent
tower (92 m, its screens under covers, the balcony at 44 m) stands on Signal Square; the way home is the
listeners' lane behind the towers. At night every billboard turns into a lit screen. A 950 m, 2-minute path; the
Undertower is under the tower.

**Why it feels flat.** The goal is in view from the first step down one straight axis, so there is no reveal; and
everything repeats on a module (a tower every 60 m, a stall every 27 m, four identical bridges, three billboards in
a cycle). The mid-distance is canyon wall: no square but the last, no side street, no bend; the height (skybridges,
balconies) is mostly beside the path, which stays on the street. The way home is a parallel straight lane of blank
walls. Its strongest picture, the night lane of screens at eye level, is only a repaint of the day, and the story's
big moment (every sign turning to the tower) is about screens the day hides. In the game today: from the landing,
a long green-grey street with a crowd, towers and a skybridge, the ringed needle at the end; on the listeners'
lane, two blank walls and a dish.

### Direction A: The screen lanes (`screen-lanes`)

Off the avenue, between the towers' feet, a warren of narrow lanes walled with second-hand screens, stacked to the
first floors, each lit its own colour (the night references, built at eye level and lit by day too, under awnings).
The menders work in them; every screen shows something different. **Play:** a picture is passed screen to screen
through the warren (a face, a planet, a glyph moving along the walls ahead of you), a moving leading line you
follow round bends and through little courts, and it leads somewhere the avenue doesn't (Wynn, the oldest sign, a
mender's stall); the warren is the way to the square and the way home, so the avenue becomes the long view and
the lanes the walk. The reveal: out of the last lane onto Signal Square at the moment the covers lift, every
screen in the lanes behind you turning the same way.

Target folder: `references/levels/The Signal Market/environment/explorations/screen-lanes/`

#### 25. The warren of screens (`sm-screen-lanes-establishing`)

**Main: narrow lanes of stacked lit screens between the market's tower feet.**

```
Environment concept art for a science fiction exploration game: a wide establishing view from a low balcony over a warren of narrow winding market lanes between the feet of giant coral and teal towers at dusk; the lanes are walled with stacked second-hand screens and monitors of every size, up to the first floors, each glowing its own saturated colour, showing faces, planets and glyphs; striped awnings, hanging cables, steam from food stalls, menders at work under lamps, little courts where lanes meet; one image of a face is passed from screen to screen along a lane like a moving light; far away down a gap between the towers, a tall dark tower with covered screens. A small cloaked human traveller with a round jade glass fluid backpack walks into the nearest lane for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, coral, teal and cream towers, near-black lane walls, saturated screen colours, violet, scarlet, cobalt, lemon and magenta, apricot lantern light, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 26. Following the picture (`sm-screen-lanes-ground`)

**Main: in a lane of screens, a face moving from screen to screen ahead.**

```
Environment concept art for a science fiction exploration game: at eye level in a narrow market lane walled on both sides with stacked old screens and monitors glowing in different colours, cables and awnings overhead; along the left wall the same calm face appears on one screen after another, leading round a bend, the screens behind it fading back to their own pictures; a mender with goggles works on an open set at a little stall, a quiet lavender figure watches from a doorway, steam and lantern light. A small cloaked human traveller with a round jade glass fluid backpack follows the face along the wall, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, near-black walls, saturated screen colours, violet, scarlet, cobalt, emerald, lemon and magenta, apricot lantern light, lilac, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction B: The market in the air (`market-in-the-air`)

The market climbs the towers: stalls on the balconies, shops hung from the skybridges, cargo baskets on cables
between them, stairs and goods lifts up the tower faces, a whole second street at 30 m and a third at 60 m.
**Play:** the way to the silent tower goes up through the market rather than down the street: from stall to stall
by stairs, a lift you pay for with an answer (the market's first rule), a basket ride across the canyon; each level
has its own trade (lanterns low, signs high, antennas at the top) and its own view of the tower, which you see
from new angles as you climb. The skybridges stop being four clones: each is a street of its own. Kip's bridge is
on the way. The way home is the long stair down the other side.

Target folder: `references/levels/The Signal Market/environment/explorations/market-in-the-air/`

#### 27. The stacked market (`sm-market-in-the-air-establishing`)

**Main: market stalls climbing the tower faces, bridges and cable baskets across the canyon.**

```
Environment concept art for a science fiction exploration game: a wide establishing view up a deep canyon street between giant coral, teal and cream towers, where the market has climbed the towers: stalls with scalloped awnings crowd every balcony, shops hang beneath the skybridges, wooden stairs and goods lifts zigzag up the tower faces, cargo baskets travel on cables across the canyon, and a second busy street runs along a gallery at mid-height and a third higher up, each with crowds and painted billboards; flying cabs pass between them; at the end of the canyon a tall dark tower with covered screens. A small cloaked human traveller with a round jade glass fluid backpack rides a cargo basket across in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, coral, teal, cream, brass and lilac, aqua sky, blue-teal shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 28. A stall on the gallery (`sm-market-in-the-air-ground`)

**Main: buying at a stall on a high gallery, the street far below.**

```
Environment concept art for a science fiction exploration game: on a narrow gallery high on the face of a coral tower in a market city, a sign-painter's stall under a scalloped awning with brushes, pots and half-painted signs hanging from a rail, a goods lift's cage arriving beside it; across the canyon another gallery street with stalls and people, a skybridge crowded with shops, cables with baskets; far below, the main street with its crowd and tram lines; up the canyon, a tall dark tower with covered screens. A small cloaked human traveller with a round jade glass fluid backpack leans on the rail, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, coral, teal, cream, brass and lilac, aqua sky, blue-teal shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction C: The old market below (`old-market`)

The avenue is a deck over the old market: a sunken street a storey or two down, the market's first one, glimpsed
through brass grilles in the paving and reached by stairs at the corners. Down there daylight falls through the
gratings in stripes, the stalls are older and fuller (the dense heaps of the references), the oldest sign hangs
over a crossing, and the first stall, where an answer was first sold, still opens. **Play:** a second way through
the world, with bends and dips where the avenue is straight and flat: you go down for the side quests and the
oldest things, up for the views. The listeners' lane becomes the old market's long back gallery, so the walk home
is underground and new. The reveal: from below, through a grille, the silent tower's foot, the Undertower's door
in the old street.

Target folder: `references/levels/The Signal Market/environment/explorations/old-market/`

#### 29. The street under the street (`sm-old-market-establishing`)

**Main: a sunken old market under the avenue's grilles, crowded and striped with light.**

```
Environment concept art for a science fiction exploration game: a wide establishing view of a sunken old market street two storeys below a great avenue of a market city, its ceiling the avenue's deck of brass gratings through which daylight falls in long stripes; the stalls down here are old and heaped high with goods, lamps, fruit, radio parts and bundles, under faded awnings; a huge old hand-painted sign hangs over a crossing, stairs climb to the light at the corners, arches lead off into side lanes, and at the far end the dark foot of a tall tower with a heavy door; people in long coats and quiet lavender figures. A small cloaked human traveller with a round jade glass fluid backpack walks down a stair in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, coral, teal, cream, brass and lilac, warm stripes of daylight, blue-teal shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 30. Through the grille (`sm-old-market-ground`)

**Main: in the old market, looking up through a grille at the avenue's crowd.**

```
Environment concept art for a science fiction exploration game: at ground level in a sunken old market, looking up through a large brass grille in the ceiling at the busy avenue above, the soles of passers-by and the legs of a stall seen against the aqua sky, a cab gliding over; stripes of light fall onto an old stall below piled with lanterns and radio parts, where an elderly seller sits under a faded awning beside a little hand-lettered board; cables, pipes and older painted signs on the walls, an arch to a side lane. A small cloaked human traveller with a round jade glass fluid backpack stands in a stripe of light looking up, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, coral, teal, cream, brass and lilac, aqua sky, warm stripes of daylight, blue-teal shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

---

## The Underwater City

**Now.** A chain of dry glass domes on the sea floor joined by straight sealed tubes, the surface 78 m up. The
Dock with its moon pool, the Avenue (the greatest dome, with Coralie's café and four more), the Garden of glow-kelp,
the Plaza and its Breathing Tower (a column of luminous water) with the lift to the Crown just under the ripples,
the Whale Gallery down a sloped tube over the drop, the divers' court. Outside: towers of salmon pods with amber
windows, luminous columns, kelp, mantas, and two whales far off in the deep until the Whale-House is done. You
never swim. A 1 km, 2-minute path along one straight spine; v1.50 added the kelp tube home past a sunken diving
bell.

**Why it feels flat.** Every space is the same object, a round dome with a level floor joined to the next by a
straight tube, so the walk is dome, tube, dome along one line. All the spectacle (the pod towers, the deep, the
whales) is behind glass and out of reach, and the whales are gone for the whole of play. The world's sense is sound
(the wrong note, the song), and the land gives it no form. The references are denser and steeper (pods on every
storey, a canyon street over dark water, an arched bridge) than the tidy rings of the game. In the game today: from
the dock's rim, pink pod towers with orange balconies and a luminous column, domes and tubes; in a tube, the glass
arch and a dome ahead in blue haze.

### Direction A: The walk on the seabed (`seabed-walk`)

The divers go outside, and so can you: a brass helmet from the divers' rack, and the seabed between the domes
becomes a place, with kelp forests, the pod towers' roots, sunken carts, and air bells on posts where you breathe
again. **Play:** an air loop: your air runs down outside and an air bell refills it, so the bells are the path and
each crossing a little venture, out of the glass and back in by another lock; outside you reach what the tubes
pass (a pod tower's door at its foot, the diving bell's insides, the lip of the drop). The reveal: on the seabed at
the drop's edge, a whale passes overhead, close, its shadow over the city.

Target folder: `references/levels/The Underwater City/environment/explorations/seabed-walk/`

#### 31. Outside the domes (`uc-seabed-walk-establishing`)

**Main: a diver walking the seabed between glass domes and pod towers, a whale overhead.**

```
Environment concept art for a science fiction exploration game: a wide establishing view on the sea floor outside an underwater city of dry glass domes joined by tubes, salmon and coral towers of pods with amber lit windows rising around; between them on the sand, a path of brass air bells on posts glowing softly, kelp forests swaying, the roots of a pod tower with a small round door, a sunken cart; light falls in shafts from the far surface; overhead, very close, a huge whale glides over the city, its shadow passing across the domes. A small cloaked human traveller with a round jade glass fluid backpack walks the seabed in a brass diving helmet in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, deep teal and blue water, salmon and coral pod towers, amber lit windows, luminous turquoise light, pale aqua glass, brass, sand, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 32. The air bell (`uc-seabed-walk-ground`)

**Main: breathing at an air bell on the seabed, a dome's lock ahead.**

```
Environment concept art for a science fiction exploration game: close up on the sea floor beside a brass air bell on a post, a glass dome-shaped hood with a pocket of air and bubbles rising from it, a little lamp glowing; tall kelp sways around, a shoal of small fish turns, and a few metres on, the round brass lock door of a glass dome with warm café lights inside and people at tables looking out; beyond, salmon pod towers and a luminous column in the blue haze. A small cloaked human traveller with a round jade glass fluid backpack in a brass diving helmet puts their head into the bell's air, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, deep teal and blue water, salmon and coral, amber lit windows, luminous turquoise light, pale aqua glass, brass, sand, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction B: The city that sings (`singing-city`)

The city was built as an instrument for the whales: great brass horns open from the domes into the sea, organ
pipes stand in the halls, the Breathing Tower is a pipe of rising bubbles, and the glass itself is tuned. Since the
wrong note the city hums out of tune, and you can see it: standing ripples in the domes' pools, bubbles rising out
of time, a shiver in the glass. **Play:** the hum is the leading line (rings in the water, bubbles in the columns
point to where the note is wrong); each hall has its pipe or horn to set right, a stop to open, a valve to close;
put right, its bubbles rise in time and its horn sounds into the sea. The loop ends at the Whale-House: the whole
city in tune, the whales answer and come to the glass.

Target folder: `references/levels/The Underwater City/environment/explorations/singing-city/`

#### 33. The instrument under the sea (`uc-singing-city-establishing`)

**Main: an underwater city of domes with great brass horns opening into the sea.**

```
Environment concept art for a science fiction exploration game: a wide establishing view of an underwater city on the sea floor built like an instrument: glass domes and tubes with great curling brass horns opening from them out into the sea, rows of tall organ pipes rising from the domes' roofs, a central tower of rising bubbles glowing turquoise, salmon pod towers with amber windows around; faint concentric rings drawn in the water spread from the horns and from the bubble tower, some of them crossed and broken; far off in the blue, two whales turning toward the city. A small cloaked human traveller with a round jade glass fluid backpack stands on a dome's walkway in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, deep teal and blue water, brass horns, salmon and coral pod towers, amber lit windows, luminous turquoise light, pale aqua glass, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 34. Tuning the hall's pipe (`uc-singing-city-ground`)

**Main: inside a dome, opening the stop of a great pipe while the pool's ripples settle.**

```
Environment concept art for a science fiction exploration game: inside a dry glass dome under the sea, a great brass organ pipe rises through the floor and out through the glass into the water, with a big wheel stop at its foot; beside it a round pool shows standing ripples in a crossed pattern, and bubbles rise in the pipe's glass window; a woman in a café apron holds her ear, a lamp-lighter with a long pole looks on, café tables and a pod tower's amber windows beyond the glass, fish outside. A small cloaked human traveller with a round jade glass fluid backpack turns the stop wheel, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, deep teal water beyond glass, brass, salmon and coral, warm café light, luminous turquoise, pale aqua glass, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction C: The canyon street (`canyon-street`)

From the references: the city does not stop at the drop, it goes down it. A street of pods stacked on every storey
clings to the canyon wall over the deep, a stair of terraces and arched bridges going down, lit cafés on ledges,
lamps getting fewer as it goes, until the Whale Gallery at the bottom by the dark water. **Play:** the route gets
a descent: down the canyon street level by level (stairs, a cable car, a bridge across the canyon to the other
wall), the light changing from turquoise to deep blue, each level a little neighbourhood; the deep is the
mid-distance, not haze. The way home is the climb back up the other wall, past what you saw across the gap.

Target folder: `references/levels/The Underwater City/environment/explorations/canyon-street/`

#### 35. The city down the drop (`uc-canyon-street-establishing`)

**Main: pods and terraces stacked down an undersea canyon wall over the deep.**

```
Environment concept art for a science fiction exploration game: a wide establishing view across an undersea canyon: on its far wall an underwater city goes down the drop in stacked tiers, salmon and coral pods on every storey with amber lit windows, glass terraces and café domes on ledges, stairs zigzagging down, a white arched bridge spanning the canyon, a small cable car between the walls; the lights get fewer and the water deeper blue toward the bottom, where a gallery dome sits by dark water; light shafts from far above. A small cloaked human traveller with a round jade glass fluid backpack stands on a glass terrace on the near wall in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, deep teal and blue water, salmon and coral pod towers, amber lit windows, luminous turquoise light, pale aqua glass, white stone bridge, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 36. A terrace over the deep (`uc-canyon-street-ground`)

**Main: on a lit café terrace on the canyon wall, the dark deep below.**

```
Environment concept art for a science fiction exploration game: on a narrow glass-walled café terrace on the side of an undersea canyon, a few small tables with lamps, a waiter carrying cups, potted glow-kelp, a stair going down past the next pods below; through the curved glass, the canyon falls away into dark blue water, the far wall's lit pods across the gap, a white arched bridge, and deep below, very faint, the shape of a whale; fish and bubbles drift. A small cloaked human traveller with a round jade glass fluid backpack leans on the rail looking down, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, deep teal and blue water, salmon and coral, warm amber café light, luminous turquoise, pale aqua glass, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

---

## The Moon Foundry

**Now.** One hangar, 340 × 338 m, under a flat girder roof 88 m up on a grid of rust pillars, open on all sides to a
plain and a haze of 70 far moons. On its level floor: two moons hung from the roof, the moon in the claws of an
orange cradle, the broken moon (30 m) cracked open round a courtyard of houses, the bowl garden, the pillar moon
with its lookout (31 m), the old hoist with decks at 27, 54 and 80 m, the last furnace and its ladle, the workers'
quarter in a polishing drum, and the Casting-House. One gantry at 13 m. A 1 km, 2-minute path: Hedda, the hoist's
first deck, the Casting-House.

**Why it feels flat.** The whole floor is one dead-level plane under a uniform roof and a regular pillar grid, and
the hoist reads as one more pillar. Its six moons are ivory spheres of similar size in similar orange cradles, so
the stations rhyme instead of contrasting; the materials are two (ivory and rust) everywhere. There is one walkway
height and it is a straight spine, so the path is the ground, one ladder, the ground. Nothing moves: a foundry with
no work going on. The story (the Casting-House pours by itself at night, the floor shakes, every hung moon turned
toward the light) leaves no mark on the floor. The references are far more layered (gantries at several heights,
homes stacked inside the shells). In the game today: from the apron, the pillars, two hung moons and the cradles
under the grid roof over a pale floor.

### Direction A: Inside the moons (`inside-the-moons`)

The unfinished moons are hollow, and people live inside them: on the inner curve of each shell, houses, stairs and
gardens climb up the walls toward the top, lit through crater windows; the broken moon's courtyard is only the
first. Gantries run from a crack in one moon to a hatch in the next, high under the roof. **Play:** the route goes
through the moons instead of round them: in at a moon's foot, up its inside (each a different kind of climb: a
spiral street, a garden terrace, a house stacked on houses), out at the top onto a gantry, across to the next. The
moons stop rhyming: each inside is its own neighbourhood. The reveal: from inside the biggest hung moon, through its
crater windows, the whole foundry floor below and every moon turned the same way.

Target folder: `references/levels/The Moon Foundry/environment/explorations/inside-the-moons/`

#### 37. The moons with people inside (`mf-inside-the-moons-establishing`)

**Main: huge hollow moons in a hangar, cut away to show houses inside, gantries between them.**

```
Environment concept art for a science fiction exploration game: a wide establishing view across an immense abandoned foundry hangar under a girder roof, where enormous unfinished ivory moons hang from cranes and rest in rusty orange cradles; each moon is hollow and partly cut away or cracked open, showing a little town built on its inner curved wall, houses with lit windows, spiral stairs, mint-green garden terraces climbing toward the top, light falling through crater windows; narrow gantries and rope walkways link a crack in one moon to a hatch in the next high under the roof; the pale floor far below with rails and small figures. A small cloaked human traveller with a round jade glass fluid backpack crosses a gantry in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, ivory moons, rust and faded orange iron, slate grey steel, mint-green gardens, warm window light, pale blue-mint sky, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 38. The street on the inner curve (`mf-inside-the-moons-ground`)

**Main: inside a hollow moon, a stair street curving up its inner wall.**

```
Environment concept art for a science fiction exploration game: inside a huge hollow ivory moon, a narrow stair street climbs along the curved inner wall of the shell, lined with small houses with orange doors and window boxes, mint trees in pots, washing lines strung across; the street curves up and over until it hangs almost upside down overhead; round crater windows let shafts of pale daylight in; through one crater, far below, the foundry floor with rails and rusty pillars; a woman beats a rug on her step. A small cloaked human traveller with a round jade glass fluid backpack climbs the stair, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, ivory shell, faded orange doors, rust iron, slate grey, mint-green plants, pale daylight, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction B: The cranes still work (`working-cranes`)

The foundry is not still: the roof's crane rails carry moons slowly across the hangar on a schedule nobody set,
gantries at four heights move with them, the cranes' cabs run along the girders. **Play:** the moving moons are
the clock and the weather: a moon passing over the floor throws a travelling shadow and closes one way while it
opens another; you ride a crane's cab or stand on a moon as it is carried to reach a high gantry (height on the
path, and a ride); the hoist is the place where the cranes are worked from, so it stands out: its gallery is the
signal box with the levers. The loop: send a moon to its cradle to open a way; the reveal: the cranes all carry
their moons toward the Casting-House at dusk.

Target folder: `references/levels/The Moon Foundry/environment/explorations/working-cranes/`

#### 39. Moons on the move (`mf-working-cranes-establishing`)

**Main: great moons carried across the hangar by roof cranes, gantries at many heights.**

```
Environment concept art for a science fiction exploration game: a wide establishing view across a vast foundry hangar where the roof is alive with machinery: big rust-orange travelling cranes run along rails on the girder roof, slowly carrying huge ivory moons on chains across the hall, their long shadows sliding over the pale floor; gantries and catwalks at four different heights cross between the pillars, some swinging with the cranes, crane cabs with lit windows; a tall iron hoist tower with a gallery of levers under the roof; small figures on the floor look up. A small cloaked human traveller with a round jade glass fluid backpack stands on top of a moving moon in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, ivory moons, rust and faded orange iron, slate grey steel, mint-green accents, pale blue-mint sky through the roof, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 40. The signal box (`mf-working-cranes-ground`)

**Main: in the hoist's gallery, pulling the lever that moves a moon.**

```
Environment concept art for a science fiction exploration game: inside a small iron signal box high at the top of a hoist tower under a foundry's girder roof, a row of tall brass and iron levers with painted tags, a dial with moon symbols, a stove and a mug; through the big windows, a rust-orange crane on the roof rails is carrying an ivory moon toward a waiting cradle far below, and gantries at different heights cross the hall; an old crane operator in overalls points. A small cloaked human traveller with a round jade glass fluid backpack pulls a lever, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, ivory moons, rust and faded orange iron, brass, slate grey steel, warm stove light, pale blue-mint sky, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction C: The night pour (`night-pour`)

The Casting-House pours by itself at night, and the floor shows it: channels in the slabs, dry by day, fill with
molten metal after dark, glowing runnels branching across the hangar to the moulds, the moulds cracking, the floor
shaking, the foundry lit only by the pour. **Play:** a day and night loop: by day the channels are dry ways you
can walk in (sunken lanes across the floor, the dips the flat floor lacks); at night they are rivers of light you
cross by the iron footbridges and the gantries, and they all lead to the Casting-House (a leading line nobody set).
Bertil's furnace, relit, adds its own runnel. The reveal: from the hoist at night, the whole floor drawn in lines of
fire converging on the tower.

Target folder: `references/levels/The Moon Foundry/environment/explorations/night-pour/`

#### 41. The foundry at night (`mf-night-pour-establishing`)

**Main: glowing runnels of molten metal across a dark hangar floor to a casting tower.**

```
Environment concept art for a science fiction exploration game: a wide establishing view from a high gantry over a vast dark foundry hangar at night: across its floor, channels cut in the slabs are filled with glowing molten metal, branching runnels of gold and orange light that all converge on a round cast-iron casting tower with a tall chimney, sparks and smoke rising; the light glows up on the undersides of huge ivory moons hanging in their cradles and from the girder roof, on rusty pillars and on small iron footbridges over the channels; a few lit windows of a workers' quarter; outside the open hall, an indigo sky with two pale moons. A small cloaked human traveller with a round jade glass fluid backpack stands at the gantry's rail in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, molten gold and orange, ivory moons, rust iron, slate grey and indigo shade, mint accents, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 42. Crossing the runnel (`mf-night-pour-ground`)

**Main: on a small iron footbridge over a channel of molten metal.**

```
Environment concept art for a science fiction exploration game: at ground level on a dark foundry floor at night, a small iron footbridge with a handrail arches over a narrow channel of glowing molten metal running in the floor slabs; the hot light glows up on the traveller and on a cracked ivory mould nearby, the floor slabs split and shaken, sparks drifting; the channel runs on ahead between rusty pillars toward a round casting tower glowing at its door; an old founder with a ladle-hook watches from a doorway. A small cloaked human traveller with a round jade glass fluid backpack crosses the footbridge, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, molten gold and orange, ivory, rust iron, slate grey and indigo shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

---

## The City Floating in Space

**Now.** Islands of peach and coral adobe floating in black space, stars above and below, a great pale planet low
in the north: the Pier where the ship lands, the Gate Quarter, the Market (a plaza of nine stalls), the Towers (up
to seven storeys), the garden terrace, the Balcony with its mast and the crow's nest at 44 m, the Moorings with the
Mooring-House, the makers' Yard, and since v1.50 the Lamp Rock, a way home. Nine straight pale bridges of 4–7.5 m,
lamps every 12 m, twelve unreachable islands far off. Fall and you are put back. A 900 m, 2-minute path; the
crow's nest against the planet is the game's best-framed landmark.

**Why it feels flat.** Every island is the same kit (a slab, a parapet, the same houses, a lamp every 9–12 m), and
the decks only range from 4 m below the pier to 14 m above it, so the city is one storey of islands joined by
straight flat bridges along a single spine. You never go under the islands, between the stacked houses or across
bridges at different heights, which the references show all the time; the void is a wall, not a space. The
islands drift apart a hand's width a night and the moorers' cables hold them, but nothing on the bridges shows the
strain. In the game today: from the pier, a long straight bridge to a cluster of coral houses with the planet
behind; along the Towers, house fronts in a row under the planet.

### Direction A: Under the islands (`under-the-islands`)

The islands have an underside, and the moorers live on it: catwalks and ladders hung under the decks among the
machinery, pipes and cables, upside-down gardens hanging into the void, little workshops in the rock, lamps
pointing down at the stars below. **Play:** a second city under the first: go down a hatch on one island, cross
under the gap on the cables' walkways, come up on another, so routes loop over and under; the cables are here, and
laying a hand on them (the quest's moment) happens where they are anchored, under the Towers. The void becomes
a space: you look down past your feet at the stars and the planet's light from below. The reveal: from the lowest
catwalk, the whole city seen from underneath, its roots of machinery and the cables strung between the islands.

Target folder: `references/levels/The City Floating in Space/environment/explorations/under-the-islands/`

#### 43. The city from below (`sc-under-the-islands-establishing`)

**Main: catwalks, hanging gardens and cables under floating islands in space.**

```
Environment concept art for a science fiction exploration game: a wide establishing view from below a city of floating islands in black starry space: the islands' undersides are rough rock and dark machinery with teal pipes, and hung beneath them are catwalks, ladders, little workshops with lit round windows, upside-down hanging gardens trailing vines into the void, lamps pointing down; thick cables strung between the islands carry walkways along them; above, the edges of peach and coral adobe houses on the decks, and a great pale peach planet low behind; stars all round, below as well as above. A small cloaked human traveller with a round jade glass fluid backpack climbs down a ladder under an island in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, slate undersides, dark teal pipes and railings, cream, peach, salmon and coral walls, warm lamp gold, black starry space, a great pale peach planet, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 44. Where the cables are anchored (`sc-under-the-islands-ground`)

**Main: on a catwalk under an island, a hand on a great humming cable.**

```
Environment concept art for a science fiction exploration game: on a narrow railed catwalk hung under a floating island in space, among dark machinery and teal pipes, a huge cable anchored to the rock with a great bronze clamp and a capstan, stretching away across the void to another island, faint drawn lines of vibration along it; a moorer in a padded coat checks the clamp with a lamp; below the grating of the catwalk, nothing but stars and the soft glow of a great pale planet. A small cloaked human traveller with a round jade glass fluid backpack lays a hand on the cable, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, slate rock, dark teal pipes and railings, bronze, warm lamp gold, black starry space, pale peach planet light, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction B: The drifting bridges (`drifting-bridges`)

A hand's width a night adds up: the bridges show it. Some are stretched and patched with planks, some have parted
and hang in two halves, some are replaced by rope bridges, cable cars or a plank laid across; the islands have
drifted to different heights so the bridges climb and drop. The moorers fight it with capstans on every island that
reel the cables in. **Play:** a loop of winding the city back: turn an island's capstan (a crank, with a moorer's
help) and you pull the next island in a little, so a broken bridge's halves meet and the way opens; the route has
gaps of every kind (a jump, a swaying rope bridge, a cable car, a gap you close). The planet behind marks the
direction the islands drift. Fewer straight lines, height between islands, and the story in every crossing.

Target folder: `references/levels/The City Floating in Space/environment/explorations/drifting-bridges/`

#### 45. A city coming apart (`sc-drifting-bridges-establishing`)

**Main: floating islands drifting apart, bridges stretched, broken and patched.**

```
Environment concept art for a science fiction exploration game: a wide establishing view of a city of floating islands of peach and coral adobe houses in black starry space, the islands drifted apart to different heights; the bridges between them show it: a stone arched bridge broken in two with its halves hanging apart, a long patched plank bridge stretched and sagging, a swaying rope bridge, a small cable car crossing a wide gap, thick cables strung taut between the islands with big capstans on the decks; lamps along everything; a great pale peach planet low behind the city. A small cloaked human traveller with a round jade glass fluid backpack crosses the rope bridge in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream, peach, salmon and coral walls, warm lamp gold, dark teal railings and pipes, slate undersides, black starry space, a great pale peach planet, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 46. Winding the island back (`sc-drifting-bridges-ground`)

**Main: turning a great capstan to pull an island in, a broken bridge closing.**

```
Environment concept art for a science fiction exploration game: on the deck of a floating island in space, a great wooden and bronze capstan with long spokes, a thick cable winding round it and running taut across the void to a nearby island; between the two islands a broken stone bridge's two halves are nearly meeting, a gap of a stride left; an old moorer with a rope over her shoulder pushes a spoke beside the traveller, coral adobe houses and lamps around, stars below the parapet, the great pale planet behind. A small cloaked human traveller with a round jade glass fluid backpack leans on a capstan spoke, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream, peach, salmon and coral walls, bronze and wood, warm lamp gold, dark teal railings, black starry space, a great pale peach planet, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction C: The stacked quarters (`stacked-quarters`)

From the references: the city is not one storey of islands but a cliff of them. The Towers become a stack of
small islands one above the other, houses built down their sides and up into the next, joined by stairs, double
arches, ladders and bridges at many heights, so a quarter is a vertical town 100 m high. **Play:** the way to the
Moorings goes up through the stack: through houses (a stair in a hall, a roof as a street, a bridge from a window),
each level a little neighbourhood, the view of the planet opening as you climb; the crow's nest is no longer the
only high place, and the walk home is down the other side of the stack. Falling is a fall to the level below, not
a reset.

Target folder: `references/levels/The City Floating in Space/environment/explorations/stacked-quarters/`

#### 47. The cliff of islands (`sc-stacked-quarters-establishing`)

**Main: small islands stacked one above another, houses and bridges at many heights.**

```
Environment concept art for a science fiction exploration game: a wide establishing view of a towering stack of small floating islands in black starry space, one above another like a cliff a hundred metres high, each covered in cubic peach, salmon and coral adobe houses that grow down its sides and up toward the next; stairs, stacked double arches, ladders and narrow bridges link them at many different heights, lamps and lit windows everywhere, washing lines and potted trees on the roofs, teal pipes and machinery hanging beneath; a great pale peach planet behind the stack. A small cloaked human traveller with a round jade glass fluid backpack climbs a stair on the lowest island in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream, peach, salmon and coral walls, warm lamp gold, dark teal railings and pipes, slate undersides, black starry space, a great pale peach planet, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 48. The roof street (`sc-stacked-quarters-ground`)

**Main: walking along rooftops of a floating quarter, the next island's houses overhead.**

```
Environment concept art for a science fiction exploration game: on a narrow street of flat rooftops high in a stacked floating city in space, coral and peach adobe walls, a potted tree, washing on a line, a little stair going up into the doorway of the house above; overhead, the underside of the next island with its houses hanging down and a double arched bridge crossing to another stack; below the parapet, more rooftops, bridges and lamps going down into the dark, and stars beneath them; a child runs ahead, the great pale peach planet fills the sky. A small cloaked human traveller with a round jade glass fluid backpack walks the roof street, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream, peach, salmon and coral walls, warm lamp gold, dark teal railings, black starry space, a great pale peach planet, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```
