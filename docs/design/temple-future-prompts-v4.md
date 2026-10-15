# The temples as ancient high technology: reference prompts (v4, text only)

2026-10-14, issue #342, fourth pass. v3 ([alien-temple-prompts-v3.md](alien-temple-prompts-v3.md)) built each house
as the body of a non-human maker (cactus folds, wasp comb, fungus gills, sponge, a jellyfish bell). Two temples were
skinned from those picks and the author turned the look down: "I don't like the alien looks, what I wanted is
something that looks futuristic, not organic." So the skins are reverted and the references redone here.

**The direction.** Each temple is a test chamber left by a vanished, far more advanced people: ancient high
technology, quiet and exact. Precise machined geometry (monolithic slabs, crisp chamfered edges, concentric rings,
hexagonal and circular panels), dark slate stone or dark metal, and thin glowing line circuits in **one accent colour
per temple**, taken from its world's palette. Plates and pieces float in the air, held by nothing visible. Pedestals
and terminals light up, platforms lift, doors slide aside or iris open. The interiors are clean and sparse: the
puzzle machinery is the decoration. Every piece of the game's puzzles is drawn as technology (balls as polished
spheres in machined grooves, eyes as lens terminals, keys as glowing tablets, bells as resonator rings).

**What stays.** The house's job and its pieces, its guardian (drawn as a machine, or a figure that fits a machine
house), the traveller for scale (a cloaked adult human with a round jade fluid backpack), and the makers' glyph,
written as "three small dots in a row above a shallow arc, a symbol, not a face" (v3's Gemini drew it as a face).
**What goes.** Every organic form as architecture: no flesh, ribs, bone, fungus, hive, comb, shell, coral, sponge or
plants. And no plain modern sci-fi: the style is still Moebius and Franco-Belgian ligne claire (fine pen contours,
flat luminous pastel colour, sparse hatching), a clean sci-fi Moebius like the machinery of his Airtight Garage and
the architecture of the Incal, not a 3D-game render.

Run (from the main checkout, so the batch shows in the lab; default providers Gemini and OpenAI; no `--refs`):
`node scripts/gen-reference.mjs --prompt "<the prompt below>" --target references/temples/future/<id>/ --ar 16:9
--comparison <the current hall's picture>`. `--comparison` only puts the current temple beside the candidates in the
lab; it is not sent to the providers. The prompts below are already in the form sent (no `--ar` or `--no` inside).

| Id | Temple (world) | Accent glow | The chamber, in one line |
|---|---|---|---|
| `rose-house` | the Rose House (the Desert) | ember orange | a dry cistern of slate slabs, a stepped circular basin, four brazier terminals and a flame held in a ring |
| `aerie` | the Aerie (Vael) | pale peach | an open shaft of floating ring platforms round a column of wind driven by a turbine in the floor |
| `founders-belfry` | the Founders' Belfry (Vael II) | cobalt blue | a resonator chamber: stacked bronze rings round a silent core, slabs held in the air by standing waves |
| `hush-house` | the Hush-House (Lorn) | violet | a damped chamber of dark acoustic panels, four suspended crystal resonators, a gate of shutter jaws |
| `lamp-house` | the Lamp-House (Lorn II) | warm gold | a dark hall of three circular basin terminals, orb sockets, plates that appear only in lamplight |
| `builders-greenhouse` | the Builders' Greenhouse (Viridel) | leaf green | a glass-and-slate sun engine: hexagonal panes, mirror louvres, a light bridge printed across a chasm |
| `wardens-well` | the Warden's Well (the City-Shaft) | cyan | a vertical shaft of terraced slate rings, lens terminals on hidden ledges, turning vanes, an iris crown |
| `clock-house` | the Clock-House (the Glass Dunes) | teal | an orrery chamber: nested rings over a chasm, a column of stopped sand, a ring of six lens terminals |
| `engine-house` | the Engine-House (the Buried Machine) | amber | a machine hall of piston slabs over a glowing pit, a jammed crank gear, a drop hammer, four lenses |
| `footprint` | the Footprint (the Garden of Spheres) | pale blue-white | a white sphere chamber of ringed walkways, half drawn only in the lens's light, print-plates for spheres |
| `undertower` | the Undertower (the Signal Market) | coral | a deep listening hall of dish arrays and horn terminals across a cable pit, three tuned spheres |
| `casting-house` | the Casting-House (the Moon Foundry) | ivory-white | a round casting chamber: a moon on a magnetic rail through a flame ring to a cradle that tips a door |
| `mooring-house` | the Mooring-House (the City Floating in Space) | teal | a capstan station open to the void: a great ring winch, light-cables slack to far islands |
| `whale-house` | the Whale-House (the Underwater City) | aquamarine | a sounding station on the sea floor: a nine-metre window, dish terminals, a horn array |

## 1. The Rose House, the Desert

What it is about: the makers' cistern in the high dunes, where their walking water-giants came to drink and from which
the fields of Qanat once took their water (the Givers' House). Its pieces: the dry drinking basin with its pale tide
line, the spout, four cold braziers lit with ember mode by tar balls rolled through the never-dying pilot flame, the
Givers' blade in its chest. Its guardian: the Keeper of the cistern, a six-legged beast with a heron's neck, asleep in
the dry basin; here a machine.

Target folder: `references/temples/future/rose-house/`
Comparison (the current hall): `references/temples/givers-house/sheet-1.jpg`

### The Rose House, ancient high technology (`rose-house`)

```
Interior concept art for an exploration game: the Rose House, a cistern in the high desert dunes built by a vanished and far more advanced people, where their walking water-giants once came to drink and from which the fields below took their water; inside it is a quiet test chamber of ancient high technology. A vast square hall of monolithic dark slate slabs with crisp chamfered edges, dusted with rose and ochre desert sand at the joints; thin glowing ember orange line circuits run in straight lines and right-angled turns across the floor and up the walls, most of them dark. In the middle, a great circular basin sunk in concentric stepped rings, dry, a pale tide line round its rim, a square spout slab overhead with a dead light in its mouth. At the four corners stand four tall brazier terminals, machined slate obelisks with a round cup at the top, three cold, one burning with an ember orange flame. By the basin, a never-dying pilot flame hangs inside a floating machined ring. A polished dark sphere rolls along a straight machined groove in the floor toward the flame. Thin slate plates float in the air above the basin, held by nothing. Folded asleep in the dry basin, the Keeper: a tall machine on six long jointed legs of dark metal with a long crane neck and a single round lens for a head, its plates still. On a low pedestal a sealed chest with a glowing seam. The makers' sign is engraved on the spout slab: a long, low, very flat arch, five times wider than it is tall, with three tiny dots in a tight row resting just above its crest, like three stars over the curve of a planet's horizon; an abstract geometric symbol, not a face, no eyes, no mouth. A cloaked adult human traveller of ordinary height with a round jade fluid backpack walks beside the groove, dwarfed by the hall. The room is clean, sparse and silent: the machinery is the only decoration. Clean science-fiction drawing in the manner of Moebius's Airtight Garage and the Incal, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, flat luminous pastel colours, dark slate, rose sand, ember orange glow, warm daylight from a slot in the roof, deep lavender shadows, restrained cream paper grain, clear readable construction. Avoid: organic or biological forms, flesh, ribs, bones, fungus, hive, shells, coral, plants as architecture, cactus, a face, photorealism, 3d render, glossy game render, text, watermark, lettering, labels.
```

## 2. The Aerie, Vael

What it is about: the makers' house on Vael's plain where the great birds were given their wings. Its gadget: the
fluid wings, ridden up a column of rising wind; gusts down its halls, the Gulf crossed on a tailwind. Its guardian:
the Elder, the oldest great bird, her feathers gone to stone.

Target folder: `references/temples/future/aerie/`
Comparison (the current hall): `references/temples/aerie/sheet-1.jpg`

### The Aerie, ancient high technology (`aerie`)

```
Interior concept art for an exploration game: the Aerie on the high grass plain of Vael, built by a vanished and far more advanced people as the place where the great birds were given their wings; inside it is a quiet test chamber of ancient high technology for learning to fly. A tall cylindrical shaft of dark slate, its wall made of precise vertical slabs with crisp chamfered edges, open at the top to a pale aqua sky. From a great circular grille in the floor, a turbine of machined blades drives a column of rising wind straight up the middle of the shaft, drawn as pale streams of dust and ribbons; thin glowing pale peach line circuits ring the grille and climb the wall in concentric bands. Round the column, flat circular and hexagonal platforms float at different heights, each with a glowing peach rim, held in the air by nothing, some tilted; across the shaft a long gap with one narrow ledge on the far side. A row of slots in the wall breathes gusts across the gap. On the highest floating ring perches the Elder: a great bird built of overlapping stone-grey metal plates like feathers, wings folded, a single calm lens for an eye, watching. The makers' sign is cut into the floor grille: a long, low, very flat arch, five times wider than it is tall, with three tiny dots in a tight row resting just above its crest, like three stars over the curve of a planet's horizon; an abstract geometric symbol, not a face, no eyes, no mouth. A cloaked adult human traveller of ordinary height with a round jade fluid backpack rides the column upward on wide translucent wings of glowing fluid, dwarfed by the shaft. The room is clean, sparse and silent: the machinery is the only decoration. Clean science-fiction drawing in the manner of Moebius's Airtight Garage and the Incal, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, flat luminous pastel colours, dark slate, pale peach glow, ochre sand on the ledges, aqua sky, rose-mauve shadows, restrained cream paper grain, clear readable construction. Avoid: organic or biological forms, flesh, ribs, bones, fungus, hive, shells, coral, nests, plants as architecture, a face, photorealism, 3d render, glossy game render, text, watermark, lettering, labels.
```

## 3. The Founders' Belfry, Vael II

What it is about: the makers' bell tower on the cloud stacks, built to hold down the stones that fall up. Its pieces:
the great silent bell, the door that stands open only while the bell rings, the bridge stones that come down out of
the air while the note lasts; its gadget the little bell-note whistle of blue-glazed clay. Its guardian: the
Cloud-Mother, a pale sky-whale with sail fins and a fringe of cloud.

Target folder: `references/temples/future/founders-belfry/`
Comparison (the current hall): `references/temples/founders-belfry/sheet-2.jpg`

### The Founders' Belfry, ancient high technology (`founders-belfry`)

```
Interior concept art for an exploration game: the Founders' Belfry on the cloud stacks of Vael II, built by a vanished and far more advanced people to hold down great stones that fall upward into the sky, by sound; inside it is a quiet test chamber of ancient high technology. A tall round chamber of dark slate and dark bronze. In its centre hangs the bell, not a cup but a resonator: a stack of thick concentric bronze rings around a silent dark core, floating a hand's width apart, held by nothing; thin glowing cobalt blue line circuits run round each ring. In the far wall a tall door of two heavy slabs stands slid apart while a note sounds, the note drawn as pale concentric cobalt rings spreading through the room. Beyond the door, over open cloud, square slabs of stone hang in the air, each held in place by pale rings of standing sound; a row of them has come down level to make a bridge while the note lasts. On a low hexagonal pedestal lit from within rests a tiny whistle of blue-glazed clay. Far out in the clouds, the vast pale shape of the Cloud-Mother, a sky-whale with long sail fins and a fringe of cloud, glides past. The makers' sign is engraved on the lowest ring: a long, low, very flat arch, five times wider than it is tall, with three tiny dots in a tight row resting just above its crest, like three stars over the curve of a planet's horizon; an abstract geometric symbol, not a face, no eyes, no mouth. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the door with the whistle at their lips, dwarfed by the chamber. The room is clean, sparse and silent: the machinery is the only decoration. Clean science-fiction drawing in the manner of Moebius's Airtight Garage and the Incal, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, flat luminous pastel colours, dark slate, warm bronze, cobalt blue glow, pale sky light, rose and lavender shadows, restrained cream paper grain, clear readable construction. Avoid: organic or biological forms, flesh, ribs, bones, fungus, hive, shells, coral, plants as architecture, a church bell tower, a face, photorealism, 3d render, glossy game render, text, watermark, lettering, labels.
```

## 4. The Hush-House, Lorn

What it is about: the makers' house on the cave island in the twilight swamp, made for keeping quiet (the Hush:
three drops of rain over a shut mouth). Its pieces: the Choir, four singing crystals of four heights sung low to high;
its gadget the stilling mode, a frost glob that stills a gate of snapping jaws and three crystal pendulums. Its
guardian: the Mother Snapper, a house-sized snapping thing with a crystal crown; here a machine.

Target folder: `references/temples/future/hush-house/`
Comparison (the current hall): `references/temples/hush-house/sheet-1.jpg`

### The Hush-House, ancient high technology (`hush-house`)

```
Interior concept art for an exploration game: the Hush-House on a cave island in a twilight swamp, built by a vanished and far more advanced people for keeping quiet, where four crystals still wait to be sung low to high; inside it is a quiet test chamber of ancient high technology. A long hall lined floor to vault with dark slate acoustic panels: deep square coffers and stepped wedges with crisp chamfered edges that swallow every echo, thin glowing violet line circuits running in their seams. Over a still black pool in the middle hang four long hexagonal crystal resonators of four lengths in machined slate collars, the first two glowing teal and violet with faint rings of sound, the other two dark. Across a side passage, a gate of heavy interlocking slate shutters like closing jaws snaps open and shut; beside it three crystal pendulums swing on thin rods from a machined beam. At the far end, the Mother Snapper sleeps: a house-sized machine of great hinged slate jaw plates shut tight, a crown of pale crystal prisms on top, anchored to the floor by heavy cables. The makers' carving on a panel: three small drops in a row above a short straight line, a symbol, not a face. A cloaked adult human traveller of ordinary height with a round jade fluid backpack throws a glob of pale icy blue frost-fluid at the snapping shutters, dwarfed by the hall. The room is clean, sparse and silent: the machinery is the only decoration. Clean science-fiction drawing in the manner of Moebius's Airtight Garage and the Incal, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, flat luminous pastel colours, dark slate, violet glow, teal crystal light, icy pale blue, deep indigo shadows, restrained cream paper grain, clear readable construction. Avoid: organic or biological forms, flesh, ribs, bones, fungus, hive, shells, coral, sponge, leaves, plants as architecture, a face, photorealism, 3d render, glossy game render, text, watermark, lettering, labels.
```

## 5. The Lamp-House, Lorn II

What it is about: the makers' dark tower in the shallows of the swamp wood, where light wakes what waits for it (the
Welcome: three lamps over a hull). Its pieces: the Hall of Dark Pools, three pool-lamps woken with light, glass orbs
of pool water rolled to sockets, moss stones that rise only in the lantern's light; its gadget the lantern charm. Its
guardian: the Lampless, a great pale moth with glyph eye-spots.

Target folder: `references/temples/future/lamp-house/`
Comparison (the current hall): `references/temples/lamp-house/sheet-1.jpg`

### The Lamp-House, ancient high technology (`lamp-house`)

```
Interior concept art for an exploration game: the Lamp-House in the shallows of a dark swamp wood, built by a vanished and far more advanced people as a place where light wakes whatever waits for it; inside it is a quiet test chamber of ancient high technology. A dark square hall of dark metal and slate, nearly black, built of monolithic slabs with crisp chamfered edges. Set in the floor are three wide circular basin terminals of dark water ringed in machined bronze, two unlit, one waking with a warm gold light rising from its depth up into the dark; thin warm gold line circuits run out from it across the floor toward the others. Along one wall a row of round machined sockets, and in it small glass spheres full of dark water. Over the basins, square stepping plates float in the air, but only where a light falls are they solid and drawn, elsewhere just a faint outline. Hanging from the ceiling, wings folded flat like two great panels, the Lampless: a great pale moth-shaped machine of thin white plates, a round lens on each wing in the shape of the makers' sign. The makers' sign on the lintel: three small lamps in a row above a long shallow hull, a symbol, not a face. A cloaked adult human traveller of ordinary height with a round jade fluid backpack, a small glowing lantern charm at their hip, walks in a soft circle of gold light that makes the plates around them solid, dwarfed by the hall. The room is clean, sparse and silent: the machinery is the only decoration. Clean science-fiction drawing in the manner of Moebius's Airtight Garage and the Incal, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, flat luminous pastel colours, deep blue-violet darkness, dark slate, warm gold glow, moss green glints, restrained cream paper grain, clear readable construction. Avoid: organic or biological forms, flesh, ribs, bones, fungus, mushrooms, hive, shells, coral, roots, plants as architecture, a face, photorealism, 3d render, glossy game render, text, watermark, lettering, labels.
```

## 6. The Builders' Greenhouse, Viridel

What it is about: the makers' greenhouse in the meadow hollow, where the garden is told to go on (the Builders' mark).
Its pieces: the Vine Gulf, a vine bridge grown across a chasm from a seed, a vine up a smooth wall to a flower-bud
door; louvres that swing sunbeams onto carved eyes and seeds; its gadget bloom mode. Its guardian: the Gardener, a
moss giant on root legs with a white stone face, bloomed only in the sunbeam. Here the house is a machine for sunlight;
the living things are what the traveller brings, not the building.

Target folder: `references/temples/future/builders-greenhouse/`
Comparison (the current hall): `references/temples/builders-greenhouse/sheet-1.jpg`

### The Builders' Greenhouse, ancient high technology (`builders-greenhouse`)

```
Interior concept art for an exploration game: the Builders' Greenhouse in a meadow hollow of the garden world Viridel, built by a vanished and far more advanced people where the garden was told to go on growing; inside it is a quiet test chamber of ancient high technology that steers sunlight. A high hall of dark slate slabs with crisp chamfered edges under a roof of precise hexagonal glass panes in a dark metal lattice, the sun coming through. Hanging from the roof, rows of tall rectangular mirror louvres on machined pivots turn and swing beams of sunlight across the hall; one beam falls on a round lens terminal in the wall that glows leaf green, thin leaf green line circuits running from it. A deep straight-edged chasm splits the floor; from a small glowing seed pod on a pedestal at its near edge, a bridge of hexagonal leaf green light panels is being printed out across the gap, plate after plate. On the far side a smooth slate wall rises to a round door closed like an iris of petal-shaped metal blades. In a shaded alcove kneels the Gardener: a tall slate automaton with heavy legs, a smooth white oval mask for a face, dormant. The makers' sign above the iris door: a long, low, very flat arch, five times wider than it is tall, with three tiny dots in a tight row resting just above its crest, like three stars over the curve of a planet's horizon; an abstract geometric symbol, not a face, no eyes, no mouth. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the chasm's edge, a stream of leaf green and petal pink glowing fluid arcing onto the seed pod, dwarfed by the hall. The room is clean, sparse and silent: the machinery is the only decoration. Clean science-fiction drawing in the manner of Moebius's Airtight Garage and the Incal, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, flat luminous pastel colours, dark slate, leaf green glow, petal pink, white sunbeams, sky blue through the glass, soft blue shadows, restrained cream paper grain, clear readable construction. Avoid: organic or biological forms, flesh, ribs, bones, fungus, hive, shells, coral, foam, vines or plants as architecture, a face, photorealism, 3d render, glossy game render, text, watermark, lettering, labels.
```

## 7. The Warden's Well, the City-Shaft

What it is about: the makers' tower on the rim of the City-Shaft, a well turned on its end (the palace seal; the Three
Who Look Up). Its pieces: the Lamp Gallery, carved eyes on high shelves hidden from the floor and reached only by
flying up on the fluid jets; vanes that turn the riding discs while they spin, a closing crown; its gadget the
Warden's bellows. Its guardian: the warden, a tall three-legged machine with a ring of vents, a lamp-eye and a crown
hatch.

Target folder: `references/temples/future/wardens-well/`
Comparison (the current hall): `references/temples/wardens-well/sheet-1.jpg`

### The Warden's Well, ancient high technology (`wardens-well`)

```
Interior concept art for an exploration game: the Warden's Well on the rim of a city built down a great shaft, a well of a vanished and far more advanced people turned on its end, whose hidden eyes can only be reached by flying; inside it is a quiet test chamber of ancient high technology. A towering vertical shaft of dark slate built of stacked rings, each ring a band of precise slabs with crisp chamfered edges, rising out of sight; thin glowing cyan line circuits climb the wall in vertical lines and ring bands. Here and there a deep ledge juts out under an overhang, and in it, hidden from the floor, a round lens terminal, one already lit cyan. Between the rings, great flat rectangular vanes of dark metal turn slowly on machined axles, moving the air up the shaft. Far above, the shaft closes in an iris of dark metal blades, half shut, warm light at its centre. Far below, a round flat riding disc with a glowing rim turns on its axle. On a wide ledge stands the warden: a tall machine on three long jointed legs, a ring of vents round its drum body, a single lamp-eye and a hatch on its crown, still at its post. The makers' sign engraved on a ring: a long, low, very flat arch, five times wider than it is tall, with three tiny dots in a tight row resting just above its crest, like three stars over the curve of a planet's horizon; an abstract geometric symbol, not a face, no eyes, no mouth. A cloaked adult human traveller of ordinary height with a round jade fluid backpack flies up the shaft on twin jets of cyan glowing fluid toward a hidden ledge, dwarfed by the well. The shaft is clean, sparse and silent: the machinery is the only decoration. Clean science-fiction drawing in the manner of Moebius's Airtight Garage and the Incal, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, flat luminous pastel colours, dark slate, steel blue metal, cyan glow, cream stone trims, warm light from above, lavender shadows, restrained cream paper grain, clear readable construction. Avoid: organic or biological forms, flesh, ribs, bones, fungus, hive, honeycomb, wasp nest, shells, coral, plants as architecture, a face, photorealism, 3d render, glossy game render, text, watermark, lettering, labels.
```

## 8. The Clock-House, the Glass Dunes

What it is about: the makers' clockwork house in the Glass Dunes, where everything takes its beat and every clock
stopped at four. Its pieces: the Clock Gallery, a stopped clock over a chasm of turning works, a ring of six carved
eyes lit in turn counted round from four; the escapement's swinging disc; its gadget the quick coil (banks of eyes
inside one breath). Its guardian: the Clockwork Foreman, a brass drum with a clock-face chest and two hammers.

Target folder: `references/temples/future/clock-house/`
Comparison (the current hall): `references/temples/first-garage/sheet-1.jpg`

### The Clock-House, ancient high technology (`clock-house`)

```
Interior concept art for an exploration game: the Clock-House in the Glass Dunes, built by a vanished and far more advanced people as the house where everything takes its beat, and where every clock stopped at the count of four; inside it is a quiet test chamber of ancient high technology. A tall round hall of dark slate slabs with crisp chamfered edges round a deep chasm. Over the chasm hangs the clock: a column of clear glass in which a stream of glittering pale sand has stopped mid-fall, wrapped by a nest of thin concentric metal rings of different sizes, each tilted on its own axis like an orrery, floating, motionless; thin glowing teal line circuits run round each ring. Below them a great flat disc on a long arm swings out over the chasm, frozen at the end of its swing. Set into the round wall, a ring of six round lens terminals, four glowing teal, two dark. A walkway of floating square plates crosses toward the clock. On a ledge stands the Clockwork Foreman: a squat brass drum machine on short legs with a round glass dial on its chest and two heavy hammers folded at its sides. The makers' sign engraved on the walkway's first plate: three small dots in a row above a shallow arc, a symbol, not a face. A cloaked adult human traveller of ordinary height with a round jade fluid backpack fires quick bright splashes of glowing fluid at the lenses, a brass coil on the backpack glowing, dwarfed by the clock. The room is clean, sparse and silent: the machinery is the only decoration. Clean science-fiction drawing in the manner of Moebius's Airtight Garage and the Incal, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, flat luminous pastel colours, dark slate, brass, clear glass, glittering sand, teal glow, warm light, deep umber shadows in the chasm, restrained cream paper grain, clear readable construction, no numbers. Avoid: organic or biological forms, flesh, ribs, bones, fungus, hive, snail shell, shells, coral, plants as architecture, a face, clock numerals, photorealism, 3d render, glossy game render, text, watermark, lettering, labels.
```

## 9. The Engine-House, the Buried Machine

What it is about: the makers' engine drum out of the dunes, the engine house that turns a great buried wheel (the
Maker's Thumb). Its pieces: the Furnace, a chasm over embers, pistons that rise and fall like steps, a crank stopped by
a ball in its teeth, a great hammer over a walkway, a bank of four eyes; its gadget the fourth chamber of the
backpack. Its guardian: the Tooth-Warden, a rust-iron machine on four legs with four vents.

Target folder: `references/temples/future/engine-house/`
Comparison (the current hall): `references/temples/engine-house/sheet-1.jpg`

### The Engine-House, ancient high technology (`engine-house`)

```
Interior concept art for an exploration game: the Engine-House under the dunes, the engine of a vanished and far more advanced people that once turned a great buried wheel, now stopped; inside it is a quiet test chamber of ancient high technology. A long high machine hall of dark metal and slate slabs with crisp chamfered edges, navy and blue-grey, its floor split down the middle by a straight pit glowing amber far below, heat haze rising. Across the pit stands a row of square piston slabs at different heights, rising and falling like steps; thin glowing amber line circuits run along their sides and across the floor, the oil-light pulsing slowly. Near the far end a great toothed crank wheel of machined metal is jammed, a polished dark sphere caught in its teeth. A huge rectangular drop hammer hangs over a narrow walkway. In the wall, four round lens terminals in a square, two glowing amber. Crouched in an alcove, the Tooth-Warden: a heavy machine of rust-red plates on four legs with four vents on its back, asleep. A cool shaft of teal daylight falls from a round hole far above. The makers' sign stamped on the crank's hub: a long, low, very flat arch, five times wider than it is tall, with three tiny dots in a tight row resting just above its crest, like three stars over the curve of a planet's horizon; an abstract geometric symbol, not a face, no eyes, no mouth. A cloaked adult human traveller of ordinary height with a round jade fluid backpack, four glowing chambers on it, one newly lit, throws four quick splashes of glowing fluid at the lenses, dwarfed by the hall. The room is clean, sparse and silent: the machinery is the only decoration. Clean science-fiction drawing in the manner of Moebius's Airtight Garage and the Incal, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, flat luminous pastel colours, navy metal, dark slate, rust red, amber glow, brass, cool teal daylight, deep umber shadows, restrained cream paper grain, clear readable construction. Avoid: organic or biological forms, flesh, ribs, bones, worms, fungus, hive, shells, coral, plants as architecture, a face, steampunk clutter, photorealism, 3d render, glossy game render, text, watermark, lettering, labels.
```

## 10. The Footprint, the Garden of Spheres

What it is about: the makers' great sphere half sunk in the meadow, the print of a giant's foot. Its pieces: the Hall
of the Unseen, a bridge of pale glass that only the glyph lens shows, the walkers' prints of two, three and four toes,
spheres rolled onto the right print, a still pool; its gadget the glyph lens. Its guardian: the Echo, a glowing core in
three glass rings with a long veil, found by the walker's print seen through the lens.

Target folder: `references/temples/future/footprint/`
Comparison (the current hall): `references/temples/footprint/sheet-1.jpg`

### The Footprint, ancient high technology (`footprint`)

```
Interior concept art for an exploration game: the Footprint in the Garden of Spheres, a giant pale sphere half sunk in a meadow, built by a vanished and far more advanced people where one of their walking giants set its foot, and where half of what is built can only be seen through a lens; inside it is a quiet test chamber of ancient high technology. A vast spherical chamber of smooth white panels, its curved wall divided into precise hexagonal and circular plates with crisp chamfered edges; concentric ring walkways circle it at different heights, thin glowing pale blue-white line circuits running along their edges. A wide gap opens between two walkways over nothing. In the floor plates are sunk round pressure plates shaped as prints of two, three and four long toes, and on some of them rest polished white spheres. Through a round glowing lens in the foreground the hidden half of the chamber appears, drawn in soft pale light: a bridge of pale glass plates across the gap, thin floating rings and struts linking the walkways where plain sight shows only air, a hidden lens terminal glowing. Floating at the centre of the sphere, seen only through the lens, the Echo: a glowing white core inside three slowly turning glass rings, trailing a long pale veil of light. A shallow round pool lies still in the lowest plate. The makers' sign on the core's lowest ring: three small dots in a row above a shallow arc, a symbol, not a face. A cloaked adult human traveller of ordinary height with a round jade fluid backpack holds a round makers' lens to one eye at the gap's edge, stepping onto the unseen bridge, dwarfed by the sphere. The room is clean, sparse and silent: the machinery is the only decoration. Clean science-fiction drawing in the manner of Moebius's Airtight Garage and the Incal, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, flat luminous pastel colours, white panels, pale blue-white glow, pale glass, peach light, sage, lavender shadows, restrained cream paper grain, clear readable construction. Avoid: organic or biological forms, flesh, ribs, bones, fungus, hive, shells, onion layers, coral, plants as architecture, human footprints, five toes, a face, photorealism, 3d render, glossy game render, text, watermark, lettering, labels.
```

## 11. The Undertower, the Signal Market

What it is about: the makers' foundations under the market city, older than anything above (the First Sign; the tuning
mark), where a note is carried back. Its pieces: the Gallery of Voices, singing stones of three sizes, brass horns that
light when their own note is played back, receiving dishes that carry a note across a pit of ancient cable, a bridge
raised by a note carried back; its gadget the echo shell. Its guardian: the First Sign, a mast on three legs with a
listening dish for a head.

Target folder: `references/temples/future/undertower/`
Comparison (the current hall): `references/temples/undertower/sheet-1.jpg`

### The Undertower, ancient high technology (`undertower`)

```
Interior concept art for an exploration game: the Undertower deep under a crowded market city, foundations older than anything above, built by a vanished and far more advanced people to carry a note across what cannot be crossed; inside it is a quiet test chamber of ancient high technology. A deep cavernous hall of dark blue-grey slate slabs with crisp chamfered edges, across a wide square pit filled far below with bundles of ancient cable glowing faintly where a note runs through them. On both sides of the pit stand receiving dishes of fine machined brass on slender pedestals, turned to face each other, thin glowing coral line circuits running down their stems into the floor. On the near side three polished spheres of three sizes sit in machined cups, one just splashed and humming in coral rings of sound; on the far side a tall brass horn terminal lights coral in answer. Square stepping plates rise out of the pit toward it, floating. Tall beside the far dish stands the First Sign: a slender machine mast on three legs with a round listening dish for a head, turned toward the sound. Far above, through slots in the roof, faint coloured light from the market's signs. The makers' sign engraved on the largest dish's base: a long, low, very flat arch, five times wider than it is tall, with three tiny dots in a tight row resting just above its crest, like three stars over the curve of a planet's horizon; an abstract geometric symbol, not a face, no eyes, no mouth. A cloaked adult human traveller of ordinary height with a round jade fluid backpack holds up a pale spiral echo shell, a note flowing out of it as glowing rings toward the dish, dwarfed by the hall. The room is clean, sparse and silent: the machinery is the only decoration. Clean science-fiction drawing in the manner of Moebius's Airtight Garage and the Incal, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, flat luminous pastel colours, blue-grey slate, brass, coral glow, teal glints, deep blue shadows, restrained cream paper grain, clear readable construction. Avoid: organic or biological forms, flesh, ribs, bones, fungus, hive, shells as architecture, coral reef, roots, plants as architecture, a face, photorealism, 3d render, glossy game render, text, watermark, lettering, labels.
```

## 12. The Casting-House, the Moon Foundry

What it is about: the founders' round casting tower under the hangar's roof, where the first moons were poured; since
the singing light passed it pours by itself at night and its moons crack. Its idea: where a moon rests, the house
leans (its doors, its hoist and its bridges held by a moon's weight in a cradle). Its hub, the Pouring Floor: a round
hall under a cracked moon, the founders' iron moon on its rail through the house's pilot flame to the great hooded
cradle under the sealed Founders' Door; its gadget the founders' tongs, that alone roll the iron moons. Its guardian:
the Last Founder, the casting machine at its bottom whose crucible doors swing open when it pours. (v3 had no new
prompt for it: its v2 pick, now set aside, was a scale with claw cradles.)

Target folder: `references/temples/future/casting-house/`
Comparison (the current hall): `references/temples/alien/base/casting-house.jpg` (the Pouring Floor, in game)

### The Casting-House, ancient high technology (`casting-house`)

```
Interior concept art for an exploration game: the Casting-House in the Moon Foundry, the round casting tower where a vanished and far more advanced people poured the first small moons; inside it is a quiet test chamber of ancient high technology in which every door and bridge is held by the weight of a moon. A tall round hall of dark iron-brown slate slabs with crisp chamfered edges; thin glowing ivory-white line circuits run in rings round the floor and up the wall. Overhead, a great pale cracked moon hangs in the air inside a floating ring of dark metal, held by nothing. Across the floor runs a straight machined rail; on it waits a round polished iron moon. Halfway along, the rail passes through the house's pilot flame, a tall cool ember flame held inside a floating machined ring. At the rail's end, a great hooded cradle of dark metal, a shallow machined cup on a pivot, sits under a tall sealed door of two heavy slabs, the door's seam glowing faintly; beside it a small test cradle tips under a little stone moon and its own small door has slid half open. Below, through a square grating in the floor, the glow of the Last Founder, a great casting machine with heavy crucible doors. The makers' sign engraved on the great cradle: a long, low, very flat arch, five times wider than it is tall, with three tiny dots in a tight row resting just above its crest, like three stars over the curve of a planet's horizon; an abstract geometric symbol, not a face, no eyes, no mouth. A cloaked adult human traveller of ordinary height with a round jade fluid backpack holds the founders' tongs, long jointed copper pincers with a glowing tip, ready to roll the iron moon along the rail, dwarfed by the hall. The room is clean, sparse and silent: the machinery is the only decoration. Clean science-fiction drawing in the manner of Moebius's Airtight Garage and the Incal, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, flat luminous pastel colours, dark iron-brown slate, ivory-white glow, ivory moon, ochre, copper, warm flame light, deep umber shadows, restrained cream paper grain, clear readable construction. Avoid: organic or biological forms, flesh, ribs, bones, claws, eggs, fungus, hive, shells, coral, plants as architecture, a face, photorealism, 3d render, glossy game render, text, watermark, lettering, labels.
```

## 13. The Mooring-House, the City Floating in Space

What it is about: the makers' house on the Moorings whose great capstan holds all the city's islands together by the
moorers' cables; since the singing light ran down every cable at once, the Anchor-Warden lets them out and the islands
drift apart. Its pieces: the Capstan Hall, the dead great capstan, its cables slack, rings on the walls, the moorers'
weight high on a cleat; its gadget the tether, that pulls home what is out on a cable over the stars. Its guardian:
the Anchor-Warden, a machine that throws its anchor out over the void.

Target folder: `references/temples/future/mooring-house/`
Comparison (the current hall): `references/temples/alien/base/mooring-house.jpg` (the Capstan Hall, in game)

### The Mooring-House, ancient high technology (`mooring-house`)

```
Interior concept art for an exploration game: the Mooring-House in a city of adobe islands floating in space, the house of a vanished and far more advanced people whose great capstan holds all the islands together by long cables, now stopped, its cables slack, the islands drifting apart; inside it is a quiet test chamber of ancient high technology. A round hall of dark slate slabs with crisp chamfered edges, its far side open to the star-black void through a tall rectangular frame, other islands and a great pale planet beyond. In the middle stands the capstan: a great ring winch of machined dark metal, wide as a house, its drum banded with thin glowing teal line circuits, dark and stopped. From it run thick cables out through slots in the wall and away across the void to far islands, slack and sagging. Round the wall, teal-lit ring handles to catch hold of; high up where a cable leaves the wall, a heavy machined weight hangs on a cleat, out of reach. A few square plates float in the air between the capstan and the open frame. At the open edge stands the Anchor-Warden: a tall machine of brass and dark iron holding a great anchor on a chain, ready to throw it out over the void. The makers' sign engraved on the capstan's lid: a long, low, very flat arch, five times wider than it is tall, with three tiny dots in a tight row resting just above its crest, like three stars over the curve of a planet's horizon; an abstract geometric symbol, not a face, no eyes, no mouth. A cloaked adult human traveller of ordinary height with a round jade fluid backpack, holding on to a ring handle, aims a thin glowing tether of fluid at the weight on its cleat, dwarfed by the capstan. The room is clean, sparse and silent: the machinery is the only decoration. Clean science-fiction drawing in the manner of Moebius's Airtight Garage and the Incal, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, flat luminous pastel colours, dark slate, teal glow, ochre and brass, cream, coral glints, star-black void, lavender shadows, restrained cream paper grain, clear readable construction. Avoid: organic or biological forms, flesh, ribs, bones, jellyfish, tentacles, fungus, hive, shells, coral, plants as architecture, a face, a knight, photorealism, 3d render, glossy game render, text, watermark, lettering, labels.
```

## 14. The Whale-House, the Underwater City

What it is about: the makers' sounding-house on the sea floor, where the makers talked with the whales; since the
light came down singing one note, something in the house sings it back and calls the whales off. Its idea: the note
crosses what you cannot (water stops at glass, a note does not; a dish carries it on only with a weight on its
footstone). Its signature room, the Tank Hall: the sea let in behind a wall of glass nine metres tall, a dish by the
glass woken by a ball on its footstone, its twin up on the shelf beside an ear; its gadget the whale-horn, one deep
note. Its guardian: the Listener, the makers' old listening machine built to hear the whales from far off, calmed
when it spreads its great ear. (Like the Casting-House, its v2 pick, a nacre shell, is set aside.)

Target folder: `references/temples/future/whale-house/`
Comparison (the current hall): `references/temples/alien/base/whale-house.jpg` (the Tank Hall, in game)

### The Whale-House, ancient high technology (`whale-house`)

```
Interior concept art for an exploration game: the Whale-House on the sea floor of an underwater city, the sounding-house where a vanished and far more advanced people talked with the whales; inside it is a quiet test chamber of ancient high technology. A long hall of dark sage-green slate slabs with crisp chamfered edges; one whole wall is a window of glass nine metres tall in a precise frame of dark metal, holding back the deep blue sea, a great whale passing far out in the water. Thin glowing aquamarine line circuits run along the frame and across the floor. Beside the glass stands a round receiving dish of machined brass on a square footstone, a polished sphere rolling toward the footstone along a straight machined groove; high on a ledge above the glass, its twin dish beside a tall listening terminal. Along the wall, a row of brass horn terminals with round mouths, dark. Through the glass, out on the sea floor, the Listener: a great listening machine of dark plates, its huge fan-shaped ear of overlapping metal panels half spread. The makers' sign engraved on the footstone: a long, low, very flat arch, five times wider than it is tall, with three tiny dots in a tight row resting just above its crest, like three stars over the curve of a planet's horizon; an abstract geometric symbol, not a face, no eyes, no mouth. A cloaked adult human traveller of ordinary height with a round jade fluid backpack raises a curled brass whale-horn to sound its one deep note into the dish, drawn as slow wide aquamarine rings, dwarfed by the hall. The room is clean, sparse and silent: the machinery is the only decoration. Clean science-fiction drawing in the manner of Moebius's Airtight Garage and the Incal, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, flat luminous pastel colours, dark sage slate, aquamarine glow, coral band, brass, deep sea blue glass, lavender shadows, restrained cream paper grain, clear readable construction. Avoid: organic or biological forms, flesh, ribs, bones, nacre, shells, fungus, hive, coral, plants as architecture, a face, a robot knight, photorealism, 3d render, glossy game render, text, watermark, lettering, labels.
```

## The run, read (2026-10-14)

Fourteen batches, OpenAI GPT Image and Gemini, one each, no image reference. All 28 pictures got the direction:
machined slate or dark metal halls, one glow colour each, floating plates, lens terminals, iris doors, nothing
organic; none is the current building redrawn. OpenAI draws the finer Moebius line; Gemini is flatter and more
comic-strip, still ligne claire. What failed was the glyph: written "three small dots in a row above a shallow arc",
both providers drew a frown or a smile under two or three eyes in ten of the fourteen. Those ten were redone once with
the glyph described as "a long, low, very flat arch, five times wider than it is tall, with three tiny dots in a
tight row resting just above its crest, like three stars over the curve of a planet's horizon; an abstract geometric
symbol, not a face, no eyes, no mouth" (the wording in their prompts above). The arch now comes out long and flat
with the dots small, and reads as a sign. Set on a round boss (the Engine-House crank hub) it still reads as a face:
next time put it on a flat slab. The first-round batches of those ten stay in the lab beside the redo.

| Temple | Batch (look at) | First round | Read |
|---|---|---|---|
| `rose-house` | `2026-10-15-02-14-24-d62e` | `2026-10-15-02-11-01-3e0a` | Square slate hall, four obelisk braziers (one or two lit), stepped round basin, flame in a floating ring, sphere in its groove, a six-legged crane-necked Keeper. |
| `aerie` | `2026-10-15-02-14-24-7a5e` | `2026-10-15-02-11-01-c505` | Round shaft open to the sky, turbine grille, floating disc and hexagon platforms with peach rims, gust slots, the plated stone Elder on the top ring. |
| `founders-belfry` | `2026-10-15-02-14-24-f536` | `2026-10-15-02-11-01-1107` | A stack of floating bronze rings round a dark core in cobalt rings of sound, slab door open on cloud, bridge slabs held in rings, the sky-whale. |
| `hush-house` | `2026-10-15-02-11-01-6d54` | | Coffered acoustic hall, four hanging crystal resonators (two lit) over a black pool, shutter-jaw gate, three pendulums, the jaw-plated Mother Snapper with a crystal crown. |
| `lamp-house` | `2026-10-15-02-11-32-3f21` | | Near-black hall, three bronze-ringed basins (one gold), a row of orb sockets, plates solid only in the lantern's light, a white-plated moth machine overhead. |
| `builders-greenhouse` | `2026-10-15-02-14-24-aab4` | `2026-10-15-02-11-32-cd69` | Hexagon-glass roof, hanging mirror louvres, a lens terminal lit green, a bridge of green light plates printed from the seed pod, iris door, the white-masked automaton. |
| `wardens-well` | `2026-10-15-02-14-53-a2f6` | `2026-10-15-02-11-32-c9ea` | A ringed shaft rising to a metal iris, turning vanes, lens terminals in hidden alcoves, the riding disc, the three-legged warden, jets of cyan. |
| `clock-house` | `2026-10-15-02-11-34-984e` | | A column of stopped sand inside tilted orrery rings over a chasm, a pendulum disc, six lenses (four lit), floating step plates, the brass Foreman. |
| `engine-house` | `2026-10-15-02-14-53-e467` | `2026-10-15-02-12-00-3412` | Long navy hall, piston slabs over an amber pit, a giant gear jammed by a sphere, a drop hammer, four lenses, the rust-red Tooth-Warden; the glyph on the hub still a face. |
| `footprint` | `2026-10-15-02-12-01-9b43` | | A white sphere of ringed walkways, toe-print plates with spheres, the lens showing the glass bridge and the Echo in its rings. |
| `undertower` | `2026-10-15-02-14-53-8e05` | `2026-10-15-02-12-06-d907` | Slate hall over a cable pit, brass dishes facing across it, three tuned spheres (one humming coral), stepping plates, the dish-headed First Sign, market light through the roof. |
| `casting-house` | `2026-10-15-02-14-55-fb2e` | `2026-10-15-02-12-06-d917` | The cracked moon in a floating ring, the iron moon on its rail through a ringed flame, the cradle under a tall seamed door, the test cradle, the Last Founder glowing below a grating. |
| `mooring-house` | `2026-10-15-02-15-21-16eb` | `2026-10-15-02-12-30-3936` | A great ring winch banded in teal, slack cables out to adobe islands under a pale planet, ring handles, the weight on its cleat, the Anchor-Warden with his anchor. |
| `whale-house` | `2026-10-15-02-15-22-4682` | `2026-10-15-02-12-30-765e` | A long sage slate hall, a two-storey window on the sea with a whale, the dish on its footstone and its twin on the shelf, a row of horn terminals, the fan-eared Listener outside. |

24 batches in all (14 + 10 redone), 48 pictures, $1.80 ($0.041 OpenAI, $0.034 Gemini each).
