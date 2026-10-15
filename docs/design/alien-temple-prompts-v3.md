# Alien-built temples, house by house: reference prompts (v3, text only)

> Superseded 2026-10-14 by [temple-future-prompts-v4.md](temple-future-prompts-v4.md): the author turned the organic
> "alien" look down ("futuristic, not organic"); v4 draws the temples as ancient high technology.

2026-10-14, issue #342, third pass. v2 ([alien-temple-prompts-v2.md](alien-temple-prompts-v2.md)) sent every prompt
with the temple's current hall as an image reference, and its prompts began "the same … as the reference picture":
so the providers drew variants of the existing picture, the alien push a layer of texture over the building we
already have. The author kept two of them (the Casting-House and the Whale-House, already picked into
`references/temples/alien/`); the other twelve v2 batches are turned down in the lab ("a variant of the base picture,
redone from text in v3").

So here the twelve other houses are written again as **pure text prompts, no image reference**. Each one stands alone
and starts from what the house is about in the game: what it is for in its world, who made it, its gadget and puzzle
pieces, its guardian. Then the makers are taken at their word: nobody has seen one, and they were never human (story
bible, "The boxes"). Each house gets one guess at their bodies and senses (fliers, listeners, things that see in the
dark, colonies, drifters in the void) and is built the way such a people would build, so the architecture is new,
not the current building: no columns, arches, stairs or doorways of human shape, no right angles unless the idea needs
them. What stays: the house's job and its pieces (braziers, crystals, eyes, discs, the guardian), its palette, the
glyph (three dots over an arc that bows upward; the Hush's three drops over a shut mouth, the Lamp-House's three
lamps over a hull), the cloaked adult traveller with the round jade fluid backpack, and the Moebius style tail.

Run (from the main checkout, so the batch shows in the lab; default providers Gemini and OpenAI; no `--refs`):
`node scripts/gen-reference.mjs --prompt "<the prompt below, cleaned>" --target references/temples/alien/<id>/ --ar 16:9
--comparison <the current hall's picture>`. `--comparison` only puts the current temple beside the candidates in
the lab, for the author to see how far the new one is from it; it is not sent to the providers. (`--from` reads its
document under the checkout the script runs in, so until this file is on main the prompts go in as `--prompt`, cleaned
the same way: `--ar` read off, the `--no` list turned into "Avoid: …".)

| Id | Temple (world) | The makers, in this house | The new architecture, in one line |
|---|---|---|---|
| `rose-house` | the Rose House (the Desert) | slow mineral-weepers who store water in their own bodies | a pleated vessel like a dry barrel cactus seen from inside, its folds once swollen with water |
| `aerie` | the Aerie (Vael) | fliers who never stood on anything | a hollow bone hung in the wind, its inside a lattice of struts like the marrow of a bird's bone, nests like swallows' |
| `founders-belfry` | the Founders' Belfry (Vael II) | listeners who lived by hearing alone | the hall is the inside of the bell itself, a thin bronze-and-bone skin, its stones held outside by rings of sound |
| `hush-house` | the Hush-House (Lorn) | feelers of vibration, for whom noise was pain | a vast sponge of violet stone, all pores and felted crystal fibre that drink sound, the choir crystals hanging like icicles |
| `lamp-house` | the Lamp-House (Lorn II) | eyes made for the dark, lit from within | the hollow of a great fungus, hung with translucent gill curtains, the pools cupped like lily pads |
| `builders-greenhouse` | the Builders' Greenhouse (Viridel) | gardeners who fed on light | a cluster of huge translucent cells like foam or frogspawn, the louvres hanging liquid lenses that steer the sun |
| `wardens-well` | the Warden's Well (the City-Shaft) | a hive of wasp-like fliers | a vertical paper-stone wasp comb, the shelves cell mouths, the vanes wing membranes, the crown a papery dome |
| `clock-house` | the Clock-House (the Glass Dunes) | a people who counted time by flowing sand and turning rings | a snail-shell spiral hall round a clock of falling glass sand and nested turning rings like an orrery |
| `engine-house` | the Engine-House (the Buried Machine) | burrowers that moved like worms through rock | a peristaltic engine: a ringed iron tunnel whose segments squeeze in turn like a worm's body |
| `footprint` | the Footprint (the Garden of Spheres) | three-toed walkers for whom up and down meant nothing, who saw a light we cannot | spheres nested inside spheres like a cut onion, the hidden half of each shell shown only by the lens |
| `undertower` | the Undertower (the Signal Market) | a singing colony, like a coral | a reef of hollow pipes, horns and sea-fan dishes grown under the city, cables hanging like roots |
| `mooring-house` | the Mooring-House (the City Floating in Space) | weightless drifters who held things with long arms | a medusa's bell afloat in the void, the capstan its nucleus, the cables its trailing arms |

## 1. The Rose House, the Desert

What it is about: the makers' cistern in the high dunes, where their walking water-giants came to drink and from which
the fields of Qanat once took their water (the Givers' House). Its pieces: the dry drinking basin with its pale tide
line, the spout, four cold braziers lit with ember mode by tar balls rolled through the never-dying pilot flame, the
Givers' blade in its chest. Its guardian: the Keeper of the cistern, a bone-shelled beast on six long legs with a
heron's neck, asleep in the dry basin. The makers here: slow creatures that wept mineral and kept water inside their
own bodies, so their house is a body that holds water.

Target folder: `references/temples/alien/rose-house/`
Comparison (the current hall): `references/temples/givers-house/sheet-1.jpg`

### The Rose House, built by the makers (`rose-house`)

**Main: the drinking-house, a vessel that once held a sea.**

```
Interior concept art for a science fiction exploration game: the Rose House, a cistern in the high desert dunes where the walking water-giants of a vanished people came to drink, and from which the fields below once took their water. Its makers were never human: slow creatures who wept mineral and kept water inside their own bodies, and they built the house the way they were made. There are no columns, arches, stairs or doorways anywhere. The inside is one enormous pleated vessel, like a dry barrel cactus seen from within: deep accordion folds of translucent rose and ochre mineral rise all round and close overhead to a cluster of small turquoise pores letting in thin shafts of daylight; the folds once swelled full of water and are now dry, creased and cracked, with fine capillary channels running through them like veins. At the bottom lies a broad shallow drinking trough shaped for a giant's lapping tongue, its sides marked with a pale tide line, empty. Standing out of the folds on long stalks, four tall seed capsules of rose glass, three dark, one glowing ember orange inside; at the trough's edge a never-dying pilot flame burns in a knot of fused glass. Curled asleep in the dry trough, the Keeper of the cistern: a great pale beast with a shell of bone plates, six long folded legs and a heron's neck laid along the rim. The makers' sign, three dots over an arc that bows upward, grown into the mineral like a fossil. A cloaked adult human traveller of ordinary height with a round jade fluid backpack climbs along a fold, dwarfed by the vessel, a small burning ball rolling ahead of them. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rose and ochre mineral, ivory bone, ember orange, turquoise light, deep lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels columns arches stairs
```

## 2. The Aerie, Vael

What it is about: the makers' house on Vael's plain where the great birds were given their wings. Its gadget: the
fluid wings, ridden up a column of rising wind; gusts down its halls, the Gulf crossed on a tailwind. Its guardian:
the Elder, the oldest great bird, her feathers gone to stone. The makers here: fliers who never stood on anything,
so the house has no floor to stand on.

Target folder: `references/temples/alien/aerie/`
Comparison (the current hall): `references/temples/aerie/sheet-1.jpg`

### The Aerie, built by the makers (`aerie`)

**Main: the wind house, a hollow bone hung in the sky.**

```
Interior concept art for a science fiction exploration game: the Aerie on the plain of Vael, the house where a vanished people gave the great birds their wings, and where a column of rising wind still lifts whoever comes. Its makers were never human: fliers who never stood on anything in their lives, and they built for bodies that hang, cling and glide. There are no floors, stairs, columns or doorways. The house is a vast hollow bone hung in the wind: its inside is a lattice of thin bone-white struts and braces crossing at every angle like the marrow of a bird's bone seen up close, banded in ochre, open to an aqua sky through the gaps; clusters of rounded nest-cups cling to the struts like swallows' nests of ochre clay, each with a round opening; thin membranes stretched between struts like kites break the gusts. Up through the middle of the lattice spirals the column of wind, drawn as pale streams of dust, loose feathers and ribbons twisting upward. Clinging to a high strut, wings half spread, the Elder: the oldest great bird, her feathers turned to pale stone, watching. The makers' sign, three dots over an arc that bows upward, carved where the struts meet. A cloaked adult human traveller of ordinary height with a round jade fluid backpack rides the column upward on wide translucent wings of glowing fluid, dwarfed by the lattice. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone white, ochre bands, aqua sky, peach light, rose-mauve shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels stairs columns floor
```

## 3. The Founders' Belfry, Vael II

What it is about: the makers' bell tower on the cloud stacks, built to hold down the stones that fall up. Its pieces:
the great silent bell, the door that stands open only while the bell rings, the bridge stones that come down out of
the air while the note lasts; its gadget the little bell-note whistle of blue-glazed clay. Its guardian: the
Cloud-Mother, a pale sky-whale with sail fins and a fringe of cloud. The makers here: listeners who lived by hearing
alone, so the traveller stands inside the instrument.

Target folder: `references/temples/alien/founders-belfry/`
Comparison (the current hall): `references/temples/founders-belfry/sheet-2.jpg`

### The Founders' Belfry, built by the makers (`founders-belfry`)

**Main: inside the bell.**

```
Interior concept art for a science fiction exploration game: the Founders' Belfry on the cloud stacks of Vael II, built by a vanished people to hold down the great stones that fall upward into the sky, by the sound of a bell. Its makers were never human: blind listeners who lived by hearing alone, and they did not build a tower round a bell; the hall is the inside of the bell itself. The traveller stands under an immense curved dome of thin bronze and bone, translucent where the sky shows through it, flaring out to a wide open rim far below where the cloud sea begins; its inner skin is ridged with fine growth rings like a shell, and a great clapper shaped like a seed hangs from the crown, still. Through the open rim, out in the bright air, huge stones float upward, each held in place by pale concentric rings of standing sound drawn in the air like ripples on water; a few have sunk down into a row of stepping stones while a note lasts. One narrow slit in the bronze skin has parted like a membrane while the note sounds. On a ledge of the rim lies a tiny whistle of blue-glazed clay. Far out in the clouds, the vast pale sail fin of the Cloud-Mother, a sky-whale fringed with cloud, passes. The makers' sign, three dots over an arc that bows upward, raised on the bronze like a casting mark. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands on the rim with the whistle at their lips, a clear note spreading from it in rings, dwarfed by the bell. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone white, warm bronze, blue glaze, pale sky light, rose and lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels tower columns
```

## 4. The Hush-House, Lorn

What it is about: the makers' house on the cave island in the twilight swamp, made for keeping quiet (the Hush:
three drops of rain over a shut mouth). Its pieces: the Choir, four singing crystals of four heights sung low to high;
its gadget the stilling mode, a frost glob that stills a gate of snapping jaws and three crystal pendulums. Its
guardian: the Mother Snapper, a house-sized rooted snapping plant with a crystal crown. The makers here: feelers of
vibration, for whom noise was pain, so the house is a thing that drinks sound.

Target folder: `references/temples/alien/hush-house/`
Comparison (the current hall): `references/temples/hush-house/sheet-1.jpg`

### The Hush-House, built by the makers (`hush-house`)

**Main: the Choir, inside a house that drinks sound.**

```
Interior concept art for a science fiction exploration game: the Hush-House on a cave island in a twilight swamp, a house a vanished people made for keeping quiet, where four crystals still wait to be sung low to high. Its makers were never human: soft creatures who felt the world by its trembling, for whom every noise was pain, and they built a house that drinks sound. There are no columns, arches, stairs or doorways of human shape. The inside is one vast sponge of violet stone: walls, floor and vault are all pores and hollows of every size, lined with hair-fine felted crystal fibres frosted icy blue, soft as moss, swallowing every echo; tunnels wind off through the sponge in every direction. From the vault hang four great crystals of four lengths like icicles over a still black pool, the first two glowing teal and violet and singing in faint rings, the others shut and dark. Across one tunnel a gate of green leaf-jaws stands open and snapping, and beside it three crystal pendulums swing on threads. Deep in a hollow, the crowned head of the Mother Snapper, a house-sized rooted snapping plant with green leaf-jaws and a crown of crystal, lies closed. The makers' carving, three drops of rain over a shut mouth, pressed into the sponge. A cloaked adult human traveller of ordinary height with a round jade fluid backpack throws a glob of pale icy blue frost-fluid at the snapping jaws, dwarfed by the hall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, violet stone, teal and violet crystal glow, icy pale blue, moss green, deep indigo shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels columns ribs dome
```

## 5. The Lamp-House, Lorn II

What it is about: the makers' dark tower in the shallows of the swamp wood, where light wakes what waits for it (the
Welcome: three lamps over a hull). Its pieces: the Hall of Dark Pools, three pool-lamps woken with light, glass orbs
of pool water rolled to sockets, moss stones that rise only in the lantern's light; its gadget the lantern charm. Its
guardian: the Lampless, a great pale moth with glyph eye-spots. The makers here: eyes made for the dark, bodies lit
from within, so they grew their house like a fungus.

Target folder: `references/temples/alien/lamp-house/`
Comparison (the current hall): `references/temples/lamp-house/sheet-1.jpg`

### The Lamp-House, built by the makers (`lamp-house`)

**Main: the Hall of Dark Pools, the hollow of a great fungus.**

```
Interior concept art for a science fiction exploration game: the Lamp-House in the shallows of a dark swamp wood, a house a vanished people made where light wakes whatever waits for it. Its makers were never human: creatures with eyes made for the dark and bodies that glowed from within, and they grew their house like a fungus rather than building it. There are no columns, arches, stairs or doorways of human shape. The inside is the hollow of one immense fungus: from its vault hang hundreds of thin translucent gill curtains in long soft folds, faintly blue-violet, parting into lanes; the floor rises and falls in soft rounded mounds like the top of a mushroom cap. Three round pools are cupped in the floor like water in lily pads, dark and still: two unlit, one waking with a warm gold light rising from its depth that shines up through the gills above it. Little glass orbs full of dark pool water rest in a row of round sockets like eggs in a nest; moss stones in the pools show only where light falls on them. Hanging folded among the gills, the Lampless: a great pale moth with eye-spots shaped like the makers' sign. A carving of three lamps over a hull grown into the cap. A cloaked adult human traveller of ordinary height with a round jade fluid backpack, a small glowing lantern charm at their hip, walks between the curtains in a soft circle of light, dwarfed by the hall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, deep blue-violet darkness, warm lamp gold, moss green glow, coral glints, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels columns arches tree-roots
```

## 6. The Builders' Greenhouse, Viridel

What it is about: the makers' greenhouse in the meadow hollow, where the garden is told to go on (the Builders' mark).
Its pieces: the Vine Gulf, a vine bridge grown across a chasm from a seed, a vine up a smooth wall to a flower-bud
door; louvres that swing sunbeams onto carved eyes and seeds; its gadget bloom mode. Its guardian: the Gardener, a
moss giant on root legs with a white stone face, bloomed only in the sunbeam. The makers here: gardeners who fed on
light, so the house is a foam of cells that steer the sun.

Target folder: `references/temples/alien/builders-greenhouse/`
Comparison (the current hall): `references/temples/builders-greenhouse/sheet-1.jpg`

### The Builders' Greenhouse, built by the makers (`builders-greenhouse`)

**Main: the Vine Gulf, inside a foam of light.**

```
Interior concept art for a science fiction exploration game: the Builders' Greenhouse in a meadow hollow of the garden world Viridel, the house where a vanished people told the garden to go on growing. Its makers were never human: gardeners who fed on light as plants do, and they built a house for steering sunlight, not for walking in. There are no columns, frames, panes, stairs or doorways of human shape. The house is a cluster of huge translucent cells like a heap of soap foam or frogspawn, each bubble-wall thin, pearly and faintly green, meeting its neighbours in soft curved seams; the sun comes through all of them. Hanging inside the cells, great round liquid lenses like drops of water slowly turn and swing beams of sunlight across the hall, one beam falling on a carved white eye. A deep chasm splits the floor of the largest cell; at its near edge a living vine bridge has just grown from a seed, leaves and pink blossoms unfurling across the gap; on the far side a second vine climbs a smooth cell wall to a great closed flower bud filling a round opening. In a shaded cell kneels the Gardener, a moss giant on root legs with a smooth white stone mask for a face, dormant. The makers' sign, three dots over an arc that bows upward, set where three cells meet. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the chasm's edge, a stream of leaf green and petal pink glowing fluid arcing onto the seed, dwarfed by the foam. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, white, leaf green, petal pink, pearly sunlit cells, sky blue, soft blue shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels glass-panes metal-frame columns
```

## 7. The Warden's Well, the City-Shaft

What it is about: the makers' tower on the rim of the City-Shaft, a well turned on its end (the palace seal; the Three
Who Look Up). Its pieces: the Lamp Gallery, carved eyes on high shelves hidden from the floor and reached only by
flying up on the fluid jets; vanes that turn the riding discs while they spin, a closing crown; its gadget the
Warden's bellows. Its guardian: the warden, a tall three-legged machine with a ring of vents, a lamp-eye and a crown
hatch. The makers here: a hive of wasp-like fliers who lived up and down, never across, so the well is their comb.

Target folder: `references/temples/alien/wardens-well/`
Comparison (the current hall): `references/temples/wardens-well/sheet-1.jpg`

### The Warden's Well, built by the makers (`wardens-well`)

**Main: the Lamp Gallery, a comb stood on end.**

```
Interior concept art for a science fiction exploration game: the Warden's Well on the rim of a city built down a great shaft, a well of a vanished people turned on its end, whose hidden eyes can only be reached by flying. Its makers were never human: a hive of wasp-like fliers who lived up and down, never across, and they chewed and layered their house like paper. There are no floors, stairs, columns or doorways of human shape. The well is a towering vertical comb of cream paper-stone: its walls are packed with hexagonal cell mouths of every size, stacked up and up out of sight, the stone laid in thin wavy layers banded in steel blue like a wasp's nest; some cells jut out as deep hoods hiding a carved stone eye from the floor, one eye already glowing. Between them hang great vanes of thin translucent membrane veined like insect wings, fanning slowly and moving the air up and down the shaft. Far above, the comb closes into a dark blue papery dome with a puckered opening like a nest's mouth, warm light leaking through its layers. Far below, a round stone riding disc turns. Clinging to the comb on three long legs, the warden: an old machine with a ring of vents round its body, a lamp-eye and a crown hatch, still at its post. The makers' sign, three dots over an arc that bows upward, pressed into the layers. A cloaked adult human traveller of ordinary height with a round jade fluid backpack flies up the comb on twin jets of cyan glowing fluid toward a hooded cell, dwarfed by the well. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream paper-stone, steel blue bands, dark blue dome, warm light, cyan jet glow, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels stairs columns windows
```

## 8. The Clock-House, the Glass Dunes

What it is about: the makers' clockwork house in the Glass Dunes, where everything takes its beat and every clock
stopped at four. Its pieces: the Clock Gallery, a stopped clock over a chasm of turning works, a ring of six carved
eyes lit in turn counted round from four; the escapement's swinging disc; its gadget the quick coil (banks of eyes
inside one breath). Its guardian: the Clockwork Foreman, a brass drum with a clock-face chest and two hammers. The
makers here: a people who counted time by flowing sand and turning rings, not by a dial.

Target folder: `references/temples/alien/clock-house/`
Comparison (the current hall): `references/temples/first-garage/sheet-1.jpg`

### The Clock-House, built by the makers (`clock-house`)

**Main: the Clock Gallery, a clock of falling glass.**

```
Interior concept art for a science fiction exploration game: the Clock-House in the Glass Dunes, the house of a vanished people where everything takes its beat, and where every clock stopped at the count of four. Its makers were never human: they counted time by flowing sand and turning rings, never by a face with hands, and their clock is a thing you stand inside. There are no columns, arches, stairs, dials or numbers anywhere. The hall winds round and down like the inside of a snail shell, its pale stone wall spiralling inward, banded in brass inlay. At the spiral's centre, over a deep chasm, hangs the clock: a tall column of clear glass through which a slow stream of glittering dune sand falls, stopped mid-fall, wrapped by a nest of thin brass and glass rings of different sizes, each tilted on its own axis like an orrery, motionless; below them a great brass disc on a long arm swings out over the chasm like a pendulum, frozen at the end of its swing. Set into the spiral wall round the clock, a ring of six round carved stone eyes, four glowing teal, two dark. Standing silent on a ledge, the Clockwork Foreman: a brass drum on short legs with a round glass face on its chest and two hammers folded. The makers' sign, three dots over an arc that bows upward, set where the spiral begins. A cloaked adult human traveller of ordinary height with a round jade fluid backpack fires quick bright splashes of glowing fluid at the eyes, a brass coil on the backpack glowing, dwarfed by the clock. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale stone, brass, clear glass, glittering sand, teal accents, warm light, deep umber shadows in the chasm, restrained cream paper grain, clear readable construction, no lettering, no numbers --ar 16:9 --no photorealism 3d-render text watermark lettering labels numbers clock-face gears columns
```

## 9. The Engine-House, the Buried Machine

What it is about: the makers' engine drum out of the dunes, the engine house that turns a great buried wheel (the
Maker's Thumb). Its pieces: the Furnace, a chasm over embers, pistons that rise and fall like steps, a crank stopped by
a ball in its teeth, a great hammer over a walkway, a bank of four eyes; its gadget the fourth chamber of the
backpack. Its guardian: the Tooth-Warden, a rust-iron machine on four legs with four vents. The makers here: burrowers
that moved through rock like worms, so their engine squeezes rather than turns.

Target folder: `references/temples/alien/engine-house/`
Comparison (the current hall): `references/temples/engine-house/sheet-1.jpg`

### The Engine-House, built by the makers (`engine-house`)

**Main: the Furnace, inside an engine that crawls.**

```
Interior concept art for a science fiction exploration game: the Engine-House under the dunes, the engine of a vanished people that once turned a great buried wheel, and is stopped. Its makers were never human: long burrowers that moved through rock the way worms do, by squeezing ring after ring of their bodies, and their engine works the same way. There are no columns, arches, stairs, beams or doorways of human shape. The hall is a vast curving tunnel of riveted rust-red iron rings, each ring a thick segment banded in blue-grey, the rings swelling and pinching along the tunnel like the body of a worm; some rings have squeezed shut, some stand wide, and the floor rises and falls over them in iron humps that serve as steps. Down the middle of the floor a long slit opens on a chasm of glowing embers far below, heat haze rising, thick ember-orange oil-light pulsing slowly through pipes that run between the rings like veins. Near the far end a great toothed iron collar is jammed, a round iron ball caught in its brass teeth, and a huge iron weight hangs over a narrow walkway. In the wall, four round carved eyes in a square, two glowing. Crouched in a hollow between two rings, the Tooth-Warden: a rust-iron machine on four legs with four vents on its back, asleep. A cool shaft of teal daylight falls from a round hole far above. The makers' sign, three dots over an arc that bows upward, stamped into the iron like a thumbprint. A cloaked adult human traveller of ordinary height with a round jade fluid backpack, four chambers on it, one newly lit, throws four quick splashes of glowing fluid at the eyes, dwarfed by the tunnel. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rust red iron, navy iron, blue-grey bands, ember orange glow, brass, cool teal daylight, deep umber shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels pistons columns flywheel
```

## 10. The Footprint, the Garden of Spheres

What it is about: the makers' great sphere half sunk in the meadow, the print of a giant's foot. Its pieces: the Hall
of the Unseen, a bridge of pale glass that only the glyph lens shows, the walkers' prints of two, three and four toes,
spheres rolled onto the right print, a still pool; its gadget the glyph lens. Its guardian: the Echo, a glowing core in
three glass rings with a long veil, found by the walker's print seen through the lens. The makers here: three-toed
walkers for whom up and down meant nothing and who saw a light we cannot, so half their house is invisible to us.

Target folder: `references/temples/alien/footprint/`
Comparison (the current hall): `references/temples/footprint/sheet-1.jpg`

### The Footprint, built by the makers (`footprint`)

**Main: the Hall of the Unseen, spheres within spheres.**

```
Interior concept art for a science fiction exploration game: the Footprint in the Garden of Spheres, a giant pale sphere half sunk in a meadow where a walking giant of a vanished people once set its foot, and where half of what is built can only be seen through a lens. Its makers were never human: three-toed walkers for whom up and down meant nothing, who walked on every surface and saw by a light we cannot see. There are no floors, columns, arches, stairs or doorways of human shape. The inside is spheres nested inside spheres, like an onion cut open: thin white shells one inside the next, each open in great round holes so the eye sees through layer after layer, all curving, none level; prints of two, three and four long toes walk up, across and over every shell as if gravity meant nothing; small white stone spheres rest in some of the prints. A wide gap opens between two shells over nothing. Through a round glowing lens in the foreground the hidden half of the house appears, drawn in soft pale light: a bridge of pale glass across the gap, delicate translucent shells and spokes linking the spheres where plain sight shows only air, a hidden carved eye glowing. Floating at the centre of the innermost sphere, seen only through the lens, the Echo: a glowing core in three slowly turning glass rings trailing a long veil. Still water fills the bottom of one shell. The makers' sign, three dots over an arc that bows upward, on the innermost shell. A cloaked adult human traveller of ordinary height with a round jade fluid backpack holds a round makers' lens to one eye at the gap's edge, stepping onto the unseen bridge, dwarfed by the spheres. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, white sphere stone, pale glass glow, pale blue, peach light, sage, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels hands columns
```

## 11. The Undertower, the Signal Market

What it is about: the makers' foundations under the market city, older than anything above (the First Sign; the tuning
mark), where a note is carried back. Its pieces: the Gallery of Voices, singing stones of three sizes, brass horns that
light when their own note is played back, receiving dishes that carry a note across a pit of ancient cable, a bridge
raised by a note carried back; its gadget the echo shell. Its guardian: the First Sign, a mast on three legs with a
listening dish for a head. The makers here: a singing colony, many small voices that grew together like a coral, so
the foundations are a reef of pipes.

Target folder: `references/temples/alien/undertower/`
Comparison (the current hall): `references/temples/undertower/sheet-1.jpg`

### The Undertower, built by the makers (`undertower`)

**Main: the Gallery of Voices, a singing reef under the city.**

```
Interior concept art for a science fiction exploration game: the Undertower deep under a crowded market city, foundations older than anything above, built by a vanished people to carry a note across what you cannot cross. Its makers were never human: a singing colony of countless small voices that grew together like a coral reef, and they grew their house as a reef of sound. There are no columns, arches, stairs, walls or doorways of human shape. The cavern is a forest of hollow pipes of blue-grey stone and brass grown up from the floor and down from the roof like a coral reef of organ pipes, from thin as reeds to wide as towers, their mouths flared, ringed and fluted; between them open sea-fan dishes of fine brass lace stand on stalks, turned to one another across a deep pit. Ancient cables hang from the roof into the pit like the roots of the city above, pale and branching, glowing faintly where a note runs through them. On the near side three round singing stones of three sizes sit in stone cups, one just splashed and humming in rings of sound; a coiled brass horn on the far side lights coral in answer; stepping stones rise out of the pit toward it. Tall among the pipes stands the First Sign: a slender mast on three legs with a listening dish for a head, turned toward the sound. Far above, through gaps in the roof, faint coloured light from the market's signs. The makers' sign, three dots over an arc that bows upward, cut into the largest pipe. A cloaked adult human traveller of ordinary height with a round jade fluid backpack holds up a pale spiral shell, a note flowing out of it as glowing rings toward the dish, dwarfed by the reef. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, blue-grey stone, brass, coral light, teal glints, deep blue shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels columns ear
```

## 12. The Mooring-House, the City Floating in Space

What it is about: the makers' house on the Moorings whose great capstan holds all the city's islands together by the
moorers' cables; since the singing light ran down every cable at once, the Anchor-Warden lets them out and the islands
drift apart. Its pieces: the Capstan Hall, the dead great capstan, its cables slack, rings on the walls, the moorers'
weight high on a cleat; its gadget the tether, that pulls home what is out on a cable over the stars. Its guardian:
the Anchor-Warden, a machine that throws its anchor out over the void. The makers here: weightless drifters of the
void who held things with long trailing arms, so the house is a medusa that holds a city.

Target folder: `references/temples/alien/mooring-house/`
Comparison (the current house): `references/temples/landmarks-2026-10-14/spacecity.jpg` (the exterior: the v2 base,
an in-game render of the Capstan Hall, is not on main)

### The Mooring-House, built by the makers (`mooring-house`)

**Main: the Capstan Hall, inside a medusa that holds a city.**

```
Interior concept art for a science fiction exploration game: the Mooring-House in a city of islands floating in space, the house of a vanished people whose great capstan holds all the islands together by long cables, now stopped, its cables slack, the islands drifting apart. Its makers were never human: weightless drifters of the void who held what they loved with long trailing arms, and they grew their house like a jellyfish. There are no floors, columns, arches, stairs or doorways of human shape. The house is a vast translucent bell like a medusa's, afloat over the star-black void, its thin cream walls faintly glowing, veined with coral and teal canals that run down from the crown; through the bell the stars and other islands show. At its heart hangs the capstan, a round ochre and brass core like a nucleus, its lid teal, stopped; from it the cables trail out through the bell's rim like a jellyfish's long arms, slack and drifting, running away across the void to far islands. Round the inside of the bell, teal rings to catch hold of; high up where a cable leaves the wall, the moorers' weight hangs on a cleat, out of reach. Clinging to the outside of the rim, the Anchor-Warden: a machine of brass and dark iron holding a great anchor on a chain, ready to throw it out over the void. The makers' sign, three dots over an arc that bows upward, on the capstan's lid. A cloaked adult human traveller of ordinary height with a round jade fluid backpack, holding on to a ring, aims a thin glowing tether of fluid at the weight on its cleat, dwarfed by the bell. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream, coral, teal rings, ochre and brass, star-black void, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels columns smile knight
```

## The run, read (2026-10-14)

Twelve batches, OpenAI GPT Image and Gemini, one each, no image reference (24 pictures, $0.90). The v2 batches of
these twelve houses are turned down in the lab. Every picture is a new building, none the current hall redrawn; none
needed a second run.

| Temple | Batch | Read |
|---|---|---|
| `rose-house` | `2026-10-14-22-28-07-6bc7` | Both: a pleated rose vessel closing to a turquoise pore cluster, four seed-capsule braziers (one lit), the Keeper asleep in the trough. OpenAI the finer drawing, the pilot flame in its glass knot. |
| `aerie` | `2026-10-14-22-28-07-4ed0` | Both: a lattice of bone struts open to the sky, ochre swallow-nests, kite membranes, the wind column ridden on fluid wings, the Elder clinging to a strut. OpenAI's stone-feathered Elder is the closer one. |
| `founders-belfry` | `2026-10-14-22-28-07-3130` | Both put the traveller inside the bell with a seed clapper, stones floating in sound rings, the Cloud-Mother's fin, the slit parted. Gemini's glyph reads as a frowning face. |
| `hush-house` | `2026-10-14-22-28-07-6268` | Both: a violet sponge of pores and frost fibre, four hanging crystals over a black pool, the leaf-jaw gate and pendulums, the drops-over-a-shut-mouth carving. OpenAI also has the Mother Snapper and the frost throw. |
| `lamp-house` | `2026-10-14-22-28-33-9169` | Both: gill curtains, cupped pools (one gold), orbs in sockets, the moth. OpenAI the more fungal; Gemini's curtains read a little like tree trunks. |
| `builders-greenhouse` | `2026-10-14-22-28-34-24b1` | Both: a foam of pearly cells, hanging liquid lenses with beams, the vine bridge and the bud door, the Gardener with his white mask. Gemini's glyph a frowning face again. |
| `wardens-well` | `2026-10-14-22-28-35-2d44` | Both: a vertical wasp comb banded in steel blue, a hooded cell's eye lit, wing-membrane vanes, the three-legged warden, the jets. Gemini has the puckered nest-mouth crown. |
| `clock-house` | `2026-10-14-22-28-35-a34d` | Both: a spiral well round a column of stopped sand inside tilted brass rings, a pendulum disc over the chasm, six eyes (four lit), the Foreman. The walls stay plainer stone than the rest: the mildest alien push of the run. |
| `engine-house` | `2026-10-14-22-28-57-c21a` | OpenAI: a ringed iron tunnel with swelling humps, an ember slit, the jammed toothed collar with its ball, the hanging weight, the Tooth-Warden in a hollow. Gemini is closer to a riveted sewer tunnel, the peristalsis less clear. |
| `footprint` | `2026-10-14-22-29-04-0c9f` | Both: nested open shells, the glass bridge and the Echo shown through the lens. Gemini draws human five-toed footprints (wrong); OpenAI's are long-toed prints. |
| `undertower` | `2026-10-14-22-29-04-d419` | Both: a reef of pipes and flared horns, sea-fan dishes over the pit, hanging root-cables, three singing stones, stepping stones, the First Sign. |
| `mooring-house` | `2026-10-14-22-29-04-02a7` | Both: a medusa's bell in the starfield, the capstan its nucleus, the cables trailing like arms to far islands, the weight on its cleat, the Anchor-Warden with his anchor outside. Gemini's capstan glyph is a frowning face. |

Across the run Gemini draws the glyph as a face (two dots for eyes): worth a line in the next prompt ("three dots in a
row, not a face").
