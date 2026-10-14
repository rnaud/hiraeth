# Alien-built temples, house by house: reference prompts (v2)

> Superseded for twelve houses by [alien-temple-prompts-v3.md](alien-temple-prompts-v3.md) (text only, no base
> picture: the base made these batches variants of the existing hall). The Casting-House and Whale-House picks stay.

2026-10-14, issue #342, second pass. The first pass ([alien-temple-prompts.md](alien-temple-prompts.md), six generic
directions) was dismissed by the author: "the references don't make sense … we should make references that are based
on the existing temples from each world. The prompt needs to focus on what these temples are about." Its six lab
batches are turned down in the lab ("none of them"), so they have left the pick queue.

So here each of the fourteen temples gets one prompt about **that** temple: who made it (the makers, whom nobody has
seen: they made the giants walk with their water across the worlds and marked everything with the glyph, three dots
over an arc that bows upward, *we heard you*; story bible, "The boxes"), what the house is for in its world, its
gadget, its signature room and puzzle pieces, its guardian, its palette and architecture. Then the push: what its
materials, shapes and machines would look like if the makers truly were not human (bodies that are not ours, senses
that are not ours, building by growing, singing, casting or breathing rather than cutting), while it stays
recognisably that temple: the same room, the same pieces in the same places, the same colours.

**The base image.** Every prompt runs with the temple as it is as its first reference (`--refs`, which the lab shows
as the base picture beside the candidates): the author's picked reference of its most characteristic hall
(`references/temples/<temple>/sheet-N.jpg`, the hall the house was built toward), or, for the three houses with no hall
reference yet, an in-game render of that hall (headless Chrome, `scripts/design-qc/capture.mjs`, High, noon), saved in
`references/temples/alien/base/`. The second reference is the temple's picked exterior landmark
(`references/temples/landmarks-2026-10-14/<world>.jpg`) so the alien hand reads in the same silhouette.

Run: `node scripts/gen-reference.mjs --from docs/design/alien-temple-prompts-v2.md#<id> --refs <base>,<landmark>`
(default providers, one batch per temple). Picks go to `references/temples/alien/<id>/`.

What every prompt keeps: the house style line, the cloaked traveller with the round jade fluid backpack (an adult of
ordinary height, never "small", dwarfed by the room), the glyph (or the house's own carving: the Hush's three drops
over a shut mouth, the Lamp-House's three lamps over a hull), no lettering. What every prompt changes: only the hand
that built it.

| Id | Temple (world) | Room (base) | The alien hand, in one line |
|---|---|---|---|
| `rose-house` | the Rose House (the Desert) | the Cistern | a drinking-house for the water-giants, its rose stone laid down in layers like a reef, the basin a palate, the braziers stamens |
| `aerie` | the Aerie (Vael) | the Wind Well | a house for fliers with no stairs at all: a throat that breathes, walls of stone barbs like a feather's vane, perches for nests |
| `founders-belfry` | the Founders' Belfry (Vael II) | the Bell Chamber | a tower that is an instrument: tuned ribs, a grown bronze seed-pod bell, stones tethered by rings of standing sound |
| `hush-house` | the Hush-House (Lorn) | the Choir | a house for keeping quiet, grown as a crystal ribcage: the choir crystals vocal folds, the dome a gill that drinks sound |
| `lamp-house` | the Lamp-House (Lorn II) | the Hall of Dark Pools | a lighthouse for eyes made for the dark: pools as retinas, roots as nerves, lamps of living water |
| `builders-greenhouse` | the Builders' Greenhouse (Viridel) | the Vine Gulf | a greenhouse where light itself is gardened: glass veined like a leaf or a wing, louvres that open like stomata |
| `wardens-well` | the Warden's Well (the City-Shaft) | the Lamp Gallery | a well that breathes: shelves like gill plates, vanes as lungs, the iris of stone blades a pupil |
| `clock-house` | the Clock-House (the Glass Dunes) | the Clock Gallery | a clock for a time that is not ours: a spiral dial counted from four, glass-and-brass gears, the escapement a heart |
| `engine-house` | the Engine-House (the Buried Machine) | the Furnace | an engine built like a body: pistons as vertebrae, the crank a jaw, the drum a gizzard of riveted iron |
| `footprint` | the Footprint (the Garden of Spheres) | the Hall of the Unseen | a house built in a light we cannot see, by three-toed walkers: the lens shows the other half of the architecture |
| `undertower` | the Undertower (the Signal Market) | the Gallery of Voices | a listening-house: cables as nerves, dishes as ears, the singing stones a larynx in the foundations |
| `casting-house` | the Casting-House (the Moon Foundry) | the Pouring Floor (render) | a foundry that lays moons like eggs: the house a scale, cradles like claws, the pilot flame tended like a hearth-organ |
| `mooring-house` | the Mooring-House (the City Floating in Space) | the Capstan Hall (render) | a spinner's house: the capstan a spindle, the cables spun like silk out over the void, rings to hook claws in |
| `whale-house` | the Whale-House (the Underwater City) | the Tank Hall (render) | a house grown as a shell to talk with whales: nacre walls, horns coiled like a cochlea, glass of living membrane |

## 1. The Rose House, the Desert

The makers' cistern in the high dunes, where the water-giants drank (the Givers' House, the mark between the giant's
eyes). Its hall: the dry basin with its tide line, the muzzle-shaped spout, four cold braziers lit with ember mode,
burning tar balls rolled through the never-dying pilot flame; the Givers' blade waits in its chest. Its guardian is
the Keeper of the cistern, a bone-shelled beast on six long legs with a heron's neck, asleep in the dry basin. Rose and
ochre stone, ember orange, ivory bone, turquoise traces, lavender shadows. Exterior: rose fins round a turquoise oculus
over a stepped cistern.

Target folder: `references/temples/alien/rose-house/`
Base: `references/temples/givers-house/sheet-1.jpg` (the Cistern), `references/temples/landmarks-2026-10-14/desert.jpg`

### The Rose House, made by an alien hand (`rose-house`)

**Main: the Cistern, redrawn as the giants' drinking-house of a people not human.**

```
Interior concept art for a science fiction exploration game: the same cistern hall as the reference picture, the heart of the Rose House in the desert, the place where the makers' walking water-giants came to drink, now drawn as if its makers were truly not human. The vast round drum of rose stone is not cut and stacked but laid down in thin fused layers like a reef or a termite mound, its walls rippled in long rose and ochre strata that curve without a single right angle; the dry basin in the middle is shaped like the palate of an enormous lower jaw, its pale tide line still on its sides; the spout on the far wall is a long soft muzzle of glazed rose ceramic grown out of the wall, dry. The four tall braziers round the walls are bronze stamens on slender stalks, one just caught with a small cool ember-orange flame where a burning splash struck it; a stone groove leads to a sunk ring holding the never-dying pilot flame. Doorways are tall narrow slots sized for six long legs, not for people. Curled asleep in the basin, the Keeper of the cistern: a great pale beast with a shell of bone plates carved with dim glyphs, six long folded legs, a heron's neck laid along the rim. The makers' sign, three dots over an arc that bows upward, pressed into the strata like a seal. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands on the rim, dwarfed by the hall, a thin stream of glowing fluid arcing to the brazier. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rose and ochre stone, ivory bone, ember orange, turquoise traces, deep lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

## 2. The Aerie, Vael

The makers' white house on Vael's plain, where the great birds were given their wings (the bird's track). Its hall:
the Wind Well, a shaft where a column of rising wind lifts the fluid wings (its gadget), gusts down the halls broken by
low curved screens; the Gulf crossed on a tailwind. Its guardian is the Elder, the oldest great bird, her feathers gone
to stone. Bone white, ochre bands, aqua sky, peach light, rose-mauve shadows. Exterior: swept stone wings, a split
needle, a turquoise arch, broad ochre terraces.

Target folder: `references/temples/alien/aerie/`
Base: `references/temples/aerie/sheet-1.jpg` (the Wind Well), `references/temples/landmarks-2026-10-14/arzach.jpg`

### The Aerie, made by an alien hand (`aerie`)

**Main: the Wind Well, redrawn as a house built by fliers for fliers.**

```
Interior concept art for a science fiction exploration game: the same wind well as the reference picture, the shaft at the heart of the Aerie on Vael where the makers gave the great birds their wings, now drawn as if its makers were truly not human and flew. There are no stairs anywhere: the tall round shaft of bone-white stone is built of thousands of overlapping stone barbs like the vane of a single enormous feather, each course banded in ochre and angled so the wind combs through it; ledges are perches and shallow nest-cups, not floors; the shaft narrows and swells like a throat that breathes, and the crown of tall stone feathers round the rim leans out to an aqua sky. Up the middle rises the column of wind, drawn as pale spiralling streams of dust, feathers and ribbons; low curved stone screens like folded wingtips stand on the floor far below. High up a balcony juts from the wall like a beak beside a carved stone eye. Perched on one of the highest barbs, the Elder: the oldest great bird, her feathers gone to pale stone, watching. The makers' sign, three dots over an arc that bows upward, carved where the barbs meet like the lines on a wing. A cloaked adult human traveller of ordinary height with a round jade fluid backpack rides the column upward on wide translucent wings of glowing fluid, dwarfed by the shaft. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone white, ochre bands, aqua sky, peach light, rose-mauve shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

## 3. The Founders' Belfry, Vael II

The makers' bell tower on the cloud stacks, built to keep the stones that fall up held down (the Three Notes). Its
hall: the Bell Chamber, the silent bell in the oculus, the door that stands open only while the bell rings, the bridge
stones that come down out of the air while the note lasts; its gadget the little bell-note whistle of blue-glazed
clay. Its guardian is the Cloud-Mother, a pale sky-whale with sail fins and a fringe of cloud. Bone white stone, warm
bronze, blue glaze, pale sky light, rose and lavender shadows. Exterior: two rose pylons framing a suspended bronze
bell.

Target folder: `references/temples/alien/founders-belfry/`
Base: `references/temples/founders-belfry/sheet-2.jpg` (the Bell Chamber), `references/temples/landmarks-2026-10-14/arzach2.jpg`

### The Founders' Belfry, made by an alien hand (`founders-belfry`)

**Main: the Bell Chamber, redrawn as a tower that is one instrument, built by people who hear rather than see.**

```
Interior concept art for a science fiction exploration game: the same bell chamber as the reference picture, the heart of the Founders' Belfry on the cloud stacks of Vael II, a tower the makers built to hold down stones that fall up, now drawn as if its makers were truly not human and lived by hearing. The whole round hall is an instrument: its bone-white walls are tall tuned ribs of different lengths like the bars of a giant xylophone, curving up into the oculus; the great ancient bell hanging silent in the oculus against the sky is not cast but grown, a ribbed bronze seed-pod with a thin translucent bronze membrane for a mouth. Out in the chasm beyond the far door great stones hang in the air, each held in a cage of pale standing rings of sound instead of chains. On a low dais a tiny whistle of blue-glazed clay shaped like a bell. The tall stone door has just sunk open while a clear note spreads through the room, drawn as pale concentric rings, the lamps on its lintel lit; small bells sit in every niche like seeds in a pod. Far out through the door, the vast pale fin of the Cloud-Mother, a sky-whale fringed with cloud, passes. The makers' sign, three dots over an arc that bows upward, cut into the ribs. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands by the door with the whistle at their lips, dwarfed by the hall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone white stone, warm bronze, blue glaze, pale sky light, rose and lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

## 4. The Hush-House, Lorn

The makers' dome on the cave island in the twilight swamp, a house for keeping quiet (the Hush: three drops of rain
over a shut mouth). Its hall: the Choir, four singing crystals of four heights sung low to high; its gadget the
stilling mode, a frost glob that stills a gate of snapping jaws and three crystal pendulums. Its guardian is the
Mother Snapper, a house-sized rooted snapping plant with a crystal crown. Violet stone, teal and violet crystal glow,
icy pale blue, moss green, deep indigo shadows. Exterior: four tall pale lavender choir fins round a crystal.

Target folder: `references/temples/alien/hush-house/`
Base: `references/temples/hush-house/sheet-1.jpg` (the Choir), `references/temples/landmarks-2026-10-14/perdide.jpg`

### The Hush-House, made by an alien hand (`hush-house`)

**Main: the Choir, redrawn as a crystal ribcage grown to keep a swamp quiet.**

```
Interior concept art for a science fiction exploration game: the same choir hall as the reference picture, the heart of the Hush-House in the twilight swamp of Lorn, a house the makers made for keeping quiet, now drawn as if its makers were truly not human. The great low ribbed dome is not built of stone but grown, a ribcage of violet crystal whose ribs fan out like the gills of a mushroom and drink in sound, frost-pale where they meet; the four tall crystals of four heights standing in a curved row on the floor are vocal folds, paired translucent violet and teal blades that part and hum, the first and second glowing and drawn singing in faint rings, the others shut and dark. Swamp crystals grow through the floor like teeth through a gum; the oculus far above is a crystal iris open to dusk; the stone door at the far end has lamps on its lintel. Moss hangs between the ribs. In the dark beyond an arch, the crowned head of the Mother Snapper, a house-sized rooted snapping plant with green leaf-jaws and a crown of crystal, lies closed. On the ribs, carvings of three drops of rain over a shut mouth. A cloaked adult human traveller of ordinary height with a round jade fluid backpack splashes the third crystal with a stream of pale icy blue fluid, dwarfed by the crystals, the tallest three times their height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, violet stone and crystal, teal glow, icy pale blue, moss green, deep indigo shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

## 5. The Lamp-House, Lorn II

The makers' dark tower in the shallows of the swamp wood, where light wakes what waits for it (the Welcome: three
lamps over a hull). Its hall: the Hall of Dark Pools, three pool-lamps woken with light, one up a loft of roots, glass
orbs of pool water rolled to sockets, moss stones that rise only in the lantern's light; its gadget the lantern charm.
Its guardian is the Lampless, a great pale moth with glyph eye-spots. Deep blue-violet dark, warm lamp gold, moss
green, coral glints. Exterior: a dark buttressed tower, a broad ivory saucer and an amber lantern cage.

Target folder: `references/temples/alien/lamp-house/`
Base: `references/temples/lamp-house/sheet-1.jpg` (the Hall of Dark Pools), `references/temples/landmarks-2026-10-14/perdide2.jpg`

### The Lamp-House, made by an alien hand (`lamp-house`)

**Main: the Hall of Dark Pools, redrawn as a lighthouse for eyes made for the dark.**

```
Interior concept art for a science fiction exploration game: the same hall of dark pools as the reference picture, the heart of the Lamp-House in the swamp wood of Lorn II, the makers' tower where light wakes what waits for it, now drawn as if its makers were truly not human and saw in the dark. The hall is almost black and shaped like the inside of a great eye: the three round pools in the floor are retinas of still dark water ringed with soft carved irises, two dark, one just waking with a soft gold light rising from its depth; the twisted roots climbing the west wall to a high loft run like optic nerves into the walls and glow faintly where they touch the lit pool; the lamps are bulbs of living water held in stone cups like eyelids. Moss stones in the dark pools show only where the light touches them. Overhead in the dark, the folded pale wings of the Lampless, a great moth with eye-spots shaped like the glyph, hang from the vault. A glass orb of pool water rests in a groove in the floor. Friezes of three lamps over a hull. A cloaked adult human traveller of ordinary height with a round jade fluid backpack, a little glowing lantern charm at their hip, stands at a pool's rim, dwarfed by the hall, their light a soft circle round them. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, deep blue-violet darkness, warm lamp gold, moss green glow, coral glints, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

## 6. The Builders' Greenhouse, Viridel

The white builders' greenhouse in the meadow hollow, where the garden is told to go on (the Builders' mark). Its
hall: the Vine Gulf, a vine bridge grown across a chasm from a seed, a vine up a wall of glass to a flower-bud door;
louvres in the roof that swing sunbeams onto eyes and seeds; its gadget bloom mode. Its guardian is the Gardener, a
moss giant on root legs with a white stone face, bloomed only in the sunbeam. White stone, leaf green, petal pink,
sunlit glass, sky blue, soft blue shadows. Exterior: a tall glass bud between swept ivory ribs above a wide glasshouse.

Target folder: `references/temples/alien/builders-greenhouse/`
Base: `references/temples/builders-greenhouse/sheet-1.jpg` (the Vine Gulf), `references/temples/landmarks-2026-10-14/edena.jpg`

### The Builders' Greenhouse, made by an alien hand (`builders-greenhouse`)

**Main: the Vine Gulf, redrawn as a greenhouse where light itself is gardened.**

```
Interior concept art for a science fiction exploration game: the same chasm hall as the reference picture, the Vine Gulf in the Builders' Greenhouse of Viridel, where the makers told the garden to go on, now drawn as if its makers were truly not human and fed on light. The roof is not ribbed glass on a frame but one great translucent membrane veined like a leaf or a dragonfly's wing, its veins carrying faint sap-light; the louvres in it open like stomata, each a pair of lips that turn to swing a sunbeam across the hall. The clean white walls are gridded like honeycomb, the stone pots along them are seed trays with many small hollows as if for many fingers. Across the chasm a living vine bridge has just grown from a seed at the near edge, leaves and pink blossoms unfurling; on the far side a wall of smooth glass panes like a wing with a second vine climbing it to a great closed flower bud over a doorway, its petals hinged round the rim. In the shade of one corner kneels the Gardener, a moss giant on root legs with a white stone face, dormant. The makers' sign, three dots over an arc that bows upward, set in the veins. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the chasm's edge, a stream of leaf green and petal pink glowing fluid arcing onto the seed, dwarfed by the hall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, white stone, leaf green, petal pink, sunlit glass, sky blue, soft blue shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

## 7. The Warden's Well, the City-Shaft

The makers' tower on the rim of the City-Shaft, a well turned on its end (the palace seal; the Three Who Look Up). Its
hall: the Lamp Gallery, eyes on high shelves hidden from the floor and reached only by flying up on the fluid jets;
the bellows vanes that turn the riding discs while they spin, an iris of stone blades in the crown; its gadget the
Warden's bellows. Its guardian is the warden, a tall three-legged machine with a ring of vents, a lamp-eye and a crown
hatch. Cream stone, steel blue bands, dark blue crown, warm slit-window light, cyan jet glow. Exterior: cream terraces,
cobalt flues and a brass-rimmed pale aperture.

Target folder: `references/temples/alien/wardens-well/`
Base: `references/temples/wardens-well/sheet-1.jpg` (the Lamp Gallery), `references/temples/landmarks-2026-10-14/incal.jpg`

### The Warden's Well, made by an alien hand (`wardens-well`)

**Main: the Lamp Gallery, redrawn as a shaft that breathes.**

```
Interior concept art for a science fiction exploration game: the same tall drum hall as the reference picture, the Lamp Gallery of the Warden's Well on the rim of the City-Shaft, a well of the makers turned on its end, now drawn as if its makers were truly not human and breathed air in a way we do not. The drum is a lung: its cream walls rise in soft overlapping folds banded in steel blue, and the stone shelves jutting from them at different heights are gill plates, each hiding a carved stone eye from the floor, one eye already glowing; between them the makers' vanes turn like fans of thin pale stone membrane, breathing the shaft's air up and down; tall slit windows are long breathing pores letting in warm light. The dark blue crown far above closes with an iris of curved stone blades like a pupil. On the floor far below, a riding stone disc and a ball in its groove. Standing on three long legs against the wall, the warden, an old machine with a ring of vents round its body, a lamp-eye and a crown hatch, still at its post. The makers' sign, three dots over an arc that bows upward, in friezes between the folds. A cloaked adult human traveller of ordinary height with a round jade fluid backpack flies up the drum on twin jets of cyan glowing fluid, turning toward the next shelf to splash its eye, dwarfed by the well. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream stone, steel blue bands, dark blue, warm slit-window light, cyan jet glow, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

## 8. The Clock-House, the Glass Dunes

The makers' clockwork stair-house (the First Garage, built in the Glass Dunes now), where everything takes its beat
and every clock stopped at four. Its hall: the Clock Gallery, a stopped clock face over a chasm of turning cogs, a ring
of six eyes lit in turn counted round from four; the escapement's swinging disc; its gadget the quick coil (banks of
eyes inside one breath). Its guardian is the Clockwork Foreman, a brass drum with a clock-face chest and two hammers.
Pale stone, brass, teal accents, warm window light, deep umber shadows. Exterior: a giant working teal clock between
cream uprights.

Target folder: `references/temples/alien/clock-house/`
Base: `references/temples/first-garage/sheet-1.jpg` (the Clock Gallery), `references/temples/landmarks-2026-10-14/garage.jpg`

### The Clock-House, made by an alien hand (`clock-house`)

**Main: the Clock Gallery, redrawn as a clock for a time that is not ours.**

```
Interior concept art for a science fiction exploration game: the same clock gallery as the reference picture, the heart of the Clock-House in the Glass Dunes, the makers' house where everything takes its beat and every clock stopped at four, now drawn as if its makers were truly not human and counted time another way. The enormous clock face on the far wall is not a circle of twelve but a spiral dial of pale stone with one long brass hand, its marks counted out from the fourth turn of the spiral; round it a ring of six carved stone eyes, four glowing, two dark. Down in the chasm the gears are of brass and clear glass, nested inside each other, turning at different speeds, and the escapement is a great slow heart of brass and pale stone that swings and beats; pendulums hang in recesses like long seed pods. The walls are pale stone banded in brass inlay that runs in spirals, not lines. Standing silent to one side, the Clockwork Foreman, a brass drum on short legs with a clock face for a chest and two hammers folded. The makers' sign, three dots over an arc that bows upward, set at the spiral's start. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the chasm's edge firing quick bright splashes of glowing fluid at the eyes, a brass coil on the backpack glowing, dwarfed by the clock. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale stone, brass, clear glass, teal accents, warm window light, deep umber shadows in the chasm, restrained cream paper grain, clear readable construction, no lettering, no numbers --ar 16:9 --no photorealism 3d-render text watermark lettering labels numbers
```

## 9. The Engine-House, the Buried Machine

The makers' engine drum out of the dunes, the engine house of a great buried wheel (the Maker's Thumb). Its hall: the
Furnace, a chasm over embers, pistons in the walls that rise and fall like steps, a crank stopped by a ball in its
teeth, a great hammer over a walkway, a bank of four eyes; its gadget the fourth chamber of the backpack. Its guardian
is the Tooth-Warden, a rust-iron machine on four legs with four vents, stopped by a ball rolled into the great gear's
teeth. Rust red iron, navy iron, blue-grey bands, ember orange, brass, cool teal daylight. Exterior: ivory exhaust
blades round an edge-on copper flywheel.

Target folder: `references/temples/alien/engine-house/`
Base: `references/temples/engine-house/sheet-1.jpg` (the Furnace), `references/temples/landmarks-2026-10-14/buried.jpg`

### The Engine-House, made by an alien hand (`engine-house`)

**Main: the Furnace, redrawn as an engine built like a body.**

```
Interior concept art for a science fiction exploration game: the same furnace hall as the reference picture, the heart of the Engine-House in the Buried Machine, the makers' engine that turns the great buried wheel, now drawn as if its makers were truly not human and built machines the way bodies are built. The drum of rust-red iron is a gizzard: its riveted plates curve in overlapping scales banded in blue-grey, and the huge pistons standing in their cylinders round the walls are a spine of iron vertebrae, each disc stepping up from the last; the giant crank is a hinged iron jaw with teeth of brass, the connecting rods tendons, the pipes and valve wheels a tangle of veins that pulse faintly with ember light. A chasm across the floor glows with embers far below like a slow stomach fire, heat haze rising; bridge plates fold against its far lip like ribs. On the far wall a bank of four carved round eyes in a square, two glowing. Crouched in a recess, the Tooth-Warden, a rust-iron machine on four legs with four vents on its back, asleep. A ring window high above lets in a cool shaft of teal daylight. The makers' sign, three dots over an arc that bows upward, stamped like a thumbprint into the plates. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands on the near lip, four quick splashes of glowing fluid flying toward the eyes, a fourth chamber on the backpack lit, dwarfed by the engine. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rust red iron, blue-grey bands, ember orange glow, brass, cool teal daylight, deep umber shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

## 10. The Footprint, the Garden of Spheres

The makers' great sphere half sunk in the meadow, the print of a giant's foot (the Footprint, under every sphere). Its
hall: the Hall of the Unseen, a bridge of pale glass that only the glyph lens shows, the walkers' prints of two, three
and four toes, spheres rolled onto the right print, a still pool; its gadget the glyph lens. Its guardian is the Echo,
a glowing core in three glass rings with a long veil, found by the walker's print seen through the lens. White sphere
stone, pale glass glow, pale blue, peach light, lavender shadows. Exterior: three sage prongs and a tall amber lens
with a turquoise crescent inlay.

Target folder: `references/temples/alien/footprint/`
Base: `references/temples/footprint/sheet-1.jpg` (the Hall of the Unseen), `references/temples/landmarks-2026-10-14/spheres.jpg`

### The Footprint, made by an alien hand (`footprint`)

**Main: the Hall of the Unseen, redrawn as a house half built in a light we cannot see.**

```
Interior concept art for a science fiction exploration game: the same hall as the reference picture, the Hall of the Unseen inside the Footprint in the Garden of Spheres, a giant pale sphere half sunk in the earth where a maker's walking giant once set its three-toed foot, now drawn as if its makers were truly not human and saw a light we do not. Half the picture is seen plainly: smooth curved white walls rising into a dome, pressed all over with prints of two, three and four long toes, walking up the walls and across the dome as if gravity meant nothing to the walkers, and a deep empty chasm splitting the floor. The other half is seen through a round glowing lens: there the hall's other architecture appears, drawn in soft light, a bridge of pale glass across the chasm, tall translucent ribs and arches standing where the plain half shows only air, a hidden carved eye beside the far door glowing, a frieze of three dots over an arc that bows upward lit on the wall. Still water in a sunken pool behind, a pale riding disc. Floating near the dome inside the lens's circle only, the Echo, a glowing core in three slowly turning glass rings trailing a long veil. A cloaked adult human traveller of ordinary height with a round jade fluid backpack holds a round makers' lens to one eye at the chasm's edge, stepping onto the unseen bridge, dwarfed by the hall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, white sphere stone, pale glass glow, pale blue, peach light, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

## 11. The Undertower, the Signal Market

The makers' foundations under the market city, older than anything above (the First Sign; the tuning mark). Its
hall: the Gallery of Voices, singing stones of three sizes, brass horns that light when their own note is played back,
receiving dishes that carry a note across a pit of ancient cable, a bridge raised by a note carried back; its gadget
the echo shell. Its guardian is the First Sign, a mast on three legs with a listening dish for a head. Blue-grey stone,
brass, coral light, teal glints, deep blue shadows. Exterior: pale stepped pylons and a large bronze receiving dish.

Target folder: `references/temples/alien/undertower/`
Base: `references/temples/undertower/sheet-1.jpg` (the Gallery of Voices), `references/temples/landmarks-2026-10-14/bazaar.jpg`

### The Undertower, made by an alien hand (`undertower`)

**Main: the Gallery of Voices, redrawn as the makers' listening-house, an ear under the city.**

```
Interior concept art for a science fiction exploration game: the same gallery as the reference picture, the Gallery of Voices in the Undertower deep under the Signal Market, the makers' foundations older than anything above, where a note is carried back, now drawn as if its makers were truly not human and spoke by sound alone. The whole gallery is an ear: its blue-grey stone walls curve in folds like the inside of an outer ear, the bundles of ancient cable running along them and down into the chasm are nerves, pale and branching, glowing faintly where a note runs through them; the great brass horn on its stand at the chasm's edge is coiled like a cochlea, its bell turned to the chasm. On the near side three singing stones of different sizes on plinths are a larynx of stone, one just splashed and humming in rings of sound; across the gap a stone door with three lamps over it. The first bridge stones rise out of the chasm in answer. Tall in the shadow by the far wall stands the First Sign, a slender mast on three legs with a listening dish for a head, turned toward the sound. Through gaps in the ceiling, faint coloured light from the market's signs far above. The makers' sign, three dots over an arc that bows upward, cut where the cables enter the stone. A cloaked adult human traveller of ordinary height with a round jade fluid backpack holds up a pale spiral shell, a note flowing out of it as glowing rings toward the horn, dwarfed by the gallery. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, blue-grey stone, brass, coral light, teal glints, deep blue shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

## 12. The Casting-House, the Moon Foundry

The founders' round casting tower under the hangar's roof, where the first moons were poured; since the singing light
passed it pours by itself at night and its moons crack. Its idea: where a moon rests, the house leans (its doors, its
hoist and its bridges held by a moon's weight in a cradle). Its hub, the Pouring Floor: a round hall under a cracked
moon, the founders' iron moon on its rail through the house's pilot flame to the great hooded cradle under the sealed
Founders' Door; its gadget the founders' tongs, that alone roll the iron moons. Its guardian is the Last Founder, the
casting machine at its bottom whose crucible doors swing open when it pours. Dark iron-brown stone banded in ember
orange, ivory, ochre, copper, warm pilot-flame light. Exterior: an ivory split chimney and an open ochre crescent mould.

Target folder: `references/temples/alien/casting-house/`
Base: `references/temples/alien/base/casting-house.jpg` (the Pouring Floor, in-game), `references/temples/landmarks-2026-10-14/moonfoundry.jpg`

### The Casting-House, made by an alien hand (`casting-house`)

**Main: the Pouring Floor, redrawn as a foundry that lays moons like eggs.**

```
Interior concept art for a science fiction exploration game: the same round hall as the reference picture, the Pouring Floor of the Casting-House in the Moon Foundry, the round casting tower where the makers poured the first moons, now drawn as if its makers were truly not human and made moons the way a creature lays eggs. The whole house is a scale: the round hall of dark iron-brown stone banded in ember orange hangs from its chimney like a pan from a beam, its floor very slightly tilted toward the great hooded cradle under the sealed Founders' Door; the cradles are claws of dark iron with copper talons that close round a moon; overhead, a pale cracked moon hangs from the vault in a net of iron like an egg in a sling. A rail runs across the floor through the house's pilot flame, a tall cool ember flame tended in a copper cup like a hearth-organ, to the cradle; on the rail a round iron moon waits, and beside it a little test scale with a stone moon in its small cradle. Doorways are low and wide, for broad bodies on many legs. Glimpsed below through a grating, the glow of the Last Founder, the casting machine whose crucible doors swing open when it pours. The makers' sign, three dots over an arc that bows upward, cast in relief on every cradle. A cloaked adult human traveller of ordinary height with a round jade fluid backpack holds the founders' tongs, long jointed copper pincers, ready to roll the iron moon, dwarfed by the hall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, dark iron-brown stone, ember orange bands, ivory moon, ochre, copper, warm flame light, deep umber shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

## 13. The Mooring-House, the City Floating in Space

The makers' round house on the Moorings, its great capstan holding all the city's islands together by the moorers'
cables; since the singing light ran down every cable at once, the Anchor-Warden lets them out and the islands drift
apart. Its idea: pulling things home across the void. Its hub, the Capstan Hall: a tall round hall round the dead great
capstan, its cables slack, rings on the walls, the moorers' weight high on a cleat; its gadget the tether, that pulls
home what is out on a cable over the stars. Its guardian is the Anchor-Warden, a machine that throws its anchor out
over the void. Cream stone, teal cable rings, coral courses, brass and ochre capstan, star-black void. Exterior: a
low coral house under three teal mooring legs.

Target folder: `references/temples/alien/mooring-house/`
Base: `references/temples/alien/base/mooring-house.jpg` (the Capstan Hall, in-game), `references/temples/landmarks-2026-10-14/spacecity.jpg`

### The Mooring-House, made by an alien hand (`mooring-house`)

**Main: the Capstan Hall, redrawn as a spinner's house that holds a city together.**

```
Interior concept art for a science fiction exploration game: the same round hall as the reference picture, the Capstan Hall of the Mooring-House in the City Floating in Space, where the makers' great capstan holds all the city's islands together by their cables, now drawn as if its makers were truly not human and spun their cables as a spider spins. The great capstan in the middle is a spindle, an ochre and brass drum with long bars, its lid teal, stopped; the cables leaving it are not rope but spun thread, many fine pale strands twisted into thick slack lines that sag across the hall and run out through the walls toward the other islands; the tall round walls of cream stone banded in coral and teal are woven rather than laid, their courses spiralling up like a cocoon, set with rings and hooks sized for claws, not hands. High up, the moorers' weight hangs on a cleat where a cable meets the wall, out of reach; a caged coffer stands by a plate on the floor. Through a gap in the weave, the black void full of stars. Folded on a ledge high above, the Anchor-Warden, a machine of brass and dark iron holding a great anchor, waiting. The makers' sign, three dots over an arc that bows upward, on the capstan's lid. A cloaked adult human traveller of ordinary height with a round jade fluid backpack aims a thin glowing tether of fluid at the weight on its cleat, dwarfed by the hall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream stone, coral courses, teal rings, ochre and brass, star-black void, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

## 14. The Whale-House, the Underwater City

The makers' sounding-house of shell and glass on the sea floor, where the makers talked with the whales; since the
light came down singing one note, something in the house sings it back and calls the whales off. Its idea: the note
crosses what you cannot (water stops at glass, a note does not; a dish carries it on only with a weight on its
footstone). Its signature room, the Tank Hall: the sea let in behind a wall of glass nine metres tall, a dish by the
glass woken by a ball on its footstone, its twin up on the shelf beside an ear; its gadget the whale-horn, one deep
note. Its guardian is the Listener, the makers' old shell-creature built to hear the whales from far off, calmed when
it spreads its great ear. Sage green stone, coral band, teal course, brass frames, sea blue glass. Exterior: a solid
nautilus shell with spiral chambers, a broad coral lip and an open vaulted mouth.

Target folder: `references/temples/alien/whale-house/`
Base: `references/temples/alien/base/whale-house.jpg` (the Tank Hall, in-game), `references/temples/landmarks-2026-10-14/underwater.jpg`

### The Whale-House, made by an alien hand (`whale-house`)

**Main: the Tank Hall, redrawn as a shell grown to talk with whales.**

```
Interior concept art for a science fiction exploration game: the same tank hall as the reference picture, inside the Whale-House on the sea floor of the Underwater City, the makers' sounding-house where they talked with the whales, now drawn as if its makers were truly not human and lived in the sea. The hall is the inside of a grown shell: its sage green walls are smooth nacre laid in curving growth lines, banded in coral and teal, with no straight edge anywhere; the wall of glass nine metres tall holding back the sea is a living membrane in a frame of brass ribs like a jellyfish's bell, faintly iridescent, the deep blue sea behind it with the brass outline of a whale drawn in the water. Beside the glass a round receiving dish shaped like a scallop shell stands on a footstone, a stone ball rolling toward it along a groove; high on a shelf above the glass its twin dish and a listening ear of coiled shell. Brass speaking-horns curl out of the walls like the whorls of a cochlea. Far through the glass, the vast pale ear of the Listener, the makers' old shell-creature, half open. The makers' sign, three dots over an arc that bows upward, inlaid in pearl. A cloaked adult human traveller of ordinary height with a round jade fluid backpack raises a curled brass whale-horn to sound its one deep note into the dish, drawn as slow wide rings, dwarfed by the hall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, sage green nacre, coral band, teal, brass, deep sea blue glass, pearl, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

## The run, read (2026-10-14)

Fourteen batches, OpenAI GPT Image and Gemini, one each, the base and the landmark as references (28 pictures,
about $1.05). Hit: it reads as that temple, same room and pieces, made by a hand that is not human. Partial: that
temple, but the alien push is light (close to a redraw of the base). Miss: the alien idea is lost, or something breaks
the house's rules.

| Temple | Batch | OpenAI | Gemini | Read |
|---|---|---|---|---|
| `rose-house` | `2026-10-14-22-07-38-ac04` | hit | hit | Both: reef-laid strata walls, stamen braziers, the muzzle spout, the Keeper asleep in the basin. Gemini has the oculus and warmer strata (a small signature mark bottom right); OpenAI the pilot flame in its ring. |
| `aerie` | `2026-10-14-22-08-07-674a` | hit | hit | Feather-barb walls, nest-cups, a beak balcony, no stairs: the strongest alien reading of a temple's idea. Gemini adds the stone Elder on a barb; OpenAI barely shows her. |
| `founders-belfry` | `2026-10-14-22-08-34-6e61` | partial | partial | Both stay very close to the picked Bell Chamber (ribbed walls, a pod-ish bell, stones in rings of sound, the Cloud-Mother through the door in OpenAI). Reads as the Belfry, not much as alien. |
| `hush-house` | `2026-10-14-22-09-02-3775` | hit | hit | A crystal ribcage dome, the four choir crystals, the Mother Snapper in an arch, the drops-over-a-shut-mouth carving. OpenAI's ribs are the more alien; Gemini's crystal iris oculus is good. |
| `lamp-house` | `2026-10-14-22-09-32-30d2` | partial | partial | The dark pools, the roots, the orb in its groove and the Lampless moth overhead are all there; the "eye" idea (pools as retinas, roots as nerves) barely shows. Gemini's arches and bulb lamps are the more organic. |
| `builders-greenhouse` | `2026-10-14-22-09-59-8990` | hit | hit | A veined leaf-membrane roof, louvres like stomata (Gemini's with their sunbeams), seed trays, the vine bridge and bud door. Gemini's Gardener has a human old man's face; OpenAI's white mask face is the right one. |
| `wardens-well` | `2026-10-14-22-10-28-3c6e` | partial | hit | Gemini: soft folded walls, shelves like gill plates, the warden on the floor, the iris crown. OpenAI is a clean redraw with an iris crown and a small warden. |
| `clock-house` | `2026-10-14-22-10-54-956d` | hit | partial | OpenAI: a spiral dial with one hand, a glass-and-brass escapement in the chasm, pendulums in glass pods, the Foreman. Gemini's dial still has twelve ticks. Both draw the six eyes as realistic eyeballs, not carved stone eyes. |
| `engine-house` | `2026-10-14-22-11-22-20c1` | miss | hit | Gemini is the best of the run: a scaled iron gizzard, a crank as a toothed jaw, vertebra pistons, veins, the Tooth-Warden asleep in a recess. OpenAI is a plain redraw of the Furnace. |
| `footprint` | `2026-10-14-22-11-49-e00a` | hit | hit | Exactly the idea: half the hall plain, half through the lens with arches, the glass bridge and the Echo in its rings. OpenAI's prints are clear three-toed walkers' prints; Gemini's read as hands. |
| `undertower` | `2026-10-14-22-12-15-a42b` | hit | partial | OpenAI: walls folded like an outer ear, a cochlea horn, nerve-like cables, the First Sign on its legs. Gemini keeps the cochlea horn but is otherwise the base redrawn. |
| `casting-house` | `2026-10-14-22-12-47-5c2c` | partial | partial | The moon in its sling, claw cradles, the rail through the pilot flame are there; Gemini adds a crab-like Last Founder holding a moon. Both keep the in-game render's flat game look (the base pulls them there), less Moebius than the rest. |
| `mooring-house` | `2026-10-14-22-13-12-d92d` | hit | miss | OpenAI: woven cocoon walls, cables of spun thread, the Anchor-Warden on a ledge, a tether to the weight. Gemini draws the glyph as a smile on the capstan (the house rule: never a smile) and the warden as an armoured knight. |
| `whale-house` | `2026-10-14-22-13-41-db0b` | hit | partial | OpenAI is among the best: nacre walls, a ribbed membrane wall of glass with the brass-line whale, scallop dishes, cochlea horns, the Listener's coil behind the glass. Gemini copies the render's flat look and the robot, and draws a real whale. |

Overall: the illustrated bases (eleven houses) give finished Moebius pictures; the three in-game renders as base pull
the providers toward the game's flat look (Casting-House, Gemini's Mooring- and Whale-House). Where both miss the push
(the Belfry, the Lamp-House), a second run could lead with the alien idea before the room, or drop the base to the
landmark only.
