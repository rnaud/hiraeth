# The temple guardians: reference prompts

2026-10-10. Each of the eleven makers' temples has a guardian at its heart (docs/systems/temples.md; the bodies in
`src/temples/guardians.js`, the fights in `src/temples/boss.js`, the moves and the last phases in
[../systems/foes.md](../systems/foes.md), "The guardians' staged fights" and "The guardians' last phases"). They were
modelled from the little wildlife kit with no picture to aim at. These are references for each: a design sheet (the
body, its signature pose, its silhouette) and the guardian in its own hall at the fight's key moment, the moment its
last phase asks for the temple's one idea ([../audits/temple-design-v1.27.md](../audits/temple-design-v1.27.md)).
Plain text prompts for the reference lab (`reference-lab.html`, `scripts/gen-reference.mjs --from
docs/design/guardian-prompts.md#<id>`, the arena `#<id>/v2`); a pick goes to the folder below.

Target folder: `references/guardians/<id>/`

What every prompt keeps: the temple's palette and materials from the picked hall and entrance
([temple-prompts.md](temple-prompts.md), the picks in `references/temples/<temple>/`), the makers' glyph (three dots
over an arc that bows upward, carved, never a smile) where the body or the hall carries it, the house style, the
cloaked traveller with the round jade fluid backpack (an adult of ordinary height, never "small": the guardian's
size is said as so many times their height), and no lettering. Organic guardians are frightened, not evil: they are
calmed, never hurt; the machines are old, broken and still at their post.

- **Main: design sheet.** The same body four times at one scale on plain cream paper: front, side, three-quarter, and
  its signature pose (the wind-up the game telegraphs, or its last phase's pose); a solid black silhouette under the
  side view; the traveller beside the front view for scale. The joints spelled out for the modellers.
- **v2: in its arena.** The guardian in its hall during the fight's key moment, a wide 16:9 scene.

| Id | Temple (world) | Guardian | Body | Last phase asks |
|---|---|---|---|---|
| `keeper` | the Givers' House (the Desert) | the Keeper of the cistern | a bone-shelled beast on six long legs, heron neck, soft muzzle | a burning tar ball rolled down a spoke to it |
| `elder` | the Aerie (Vael) | the Elder | the oldest great bird, feathers gone to stone | the wind sent up beside her, ridden with her |
| `cloud-mother` | the Founders' Belfry (Vael II) | the Cloud-Mother | a pale sky-whale with sail fins and a fringe of cloud | a stone that fell up, rung down where she dives |
| `mother-snapper` | the Hush-House (Lorn) | the Mother Snapper | a house-sized rooted snapping plant, crystal crown | three crystal pendulums stilled low to high |
| `lampless` | the Lamp-House (Lorn II) | the Lampless | a great pale moth with glyph eye-spots | a lit pool, and you standing back |
| `gardener` | the Builders' Greenhouse (Viridel) | the Gardener | a moss giant on root legs, a white stone face | bloomed only in the sunbeam |
| `warden` | the Warden's Well (the City-Shaft) | the warden | a tall three-legged machine, ring of vents, lamp-eye, crown hatch | hovering over a turning vane to lift its hatch |
| `foreman` | the First Garage (the Sealed Hangar) | the Clockwork Foreman | a brass drum with a clock-face chest, two hammers | six lamps hit in step, counted round from four |
| `tooth-warden` | the Engine-House (the Buried Machine) | the Tooth-Warden | a rust-iron machine on four legs, four vents | a ball rolled into the great gear's teeth |
| `echo` | the Footprint (the Garden of Spheres) | the Echo | a glowing core in three glass rings, a long veil | the walker's print, seen through the lens |
| `first-sign` | the Undertower (the Signal Market) | the First Sign | a mast on three legs with a listening dish for a head | its word played through the wall dishes |

### 1. The Keeper of the cistern, the Givers' House (`keeper`)

**Main: design sheet.**

```
Character design sheet for a science fiction exploration game: the Keeper of the cistern, a great pale gentle beast of the makers, drawn four times at one scale on plain cream paper. A rounded shell of ivory bone plates in overlapping rows over a rose belly, faint turquoise glyph marks of three dots over an upward arc glowing on the shell; six long legs in two tripods, each a straight thigh and a thinner shin with a forward-bending knee and a small dark hoof; a long heron-like neck in five rings, alternating bone plate and warm tan skin; a head with a long soft muzzle, a lower jaw that drops open, two small dark eyes, a flat brow plate with two short horns swept back; a short curled tail. About four and a half metres tall at the back and eleven metres from muzzle to tail. Views: front, side, three-quarter, and its signature wind-up: reared up on its four hind legs, forefeet raised high and neck drawn back before it stamps; a solid black silhouette of the side view beneath it. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands beside the front view for scale, an ordinary adult, the beast's back more than twice their height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, ivory bone, rose belly, warm tan skin, rose and ochre accents, turquoise glyph glow, deep lavender shadows, restrained cream paper grain, clear readable construction, fully visible bodies, evenly spaced views, no scenery, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels numbers scenery
```

**In its arena: the fire rolled down the spoke.**

```
Interior concept art for a science fiction exploration game: the cistern hall at the heart of an ancient temple of the makers, a vast round drum of rose stone under a low dome, a single shaft of dusty light through its oculus. Four stone grooves run like spokes from the walls in to the dry basin in the middle, each passing a tall bronze brazier on the rim; one brazier burns with a cool ember-orange flame, and a tar ball rolled past it has caught, rolling down its spoke wreathed in small flames toward the basin. By the basin's edge the Keeper, a great pale beast with a shell of ivory bone plates, six long legs and a heron's neck, has stopped in its fear and lowered its long soft muzzle to the fire, mouth open, panting, the turquoise glyphs on its shell brightening. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the spoke's head, a stream of clear glowing water arcing from the nozzle into the beast's open mouth, dwarfed by the beast and the hall. Friezes of three dots over an upward arc round the drum, old dry channels under the walls. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rose and ochre stone, ivory bone, ember orange, turquoise traces, deep lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 2. The Elder, the Aerie (`elder`)

**Main: design sheet.**

```
Character design sheet for a science fiction exploration game: the Elder, the oldest of the great birds, so old her feathers have turned to stone, drawn four times at one scale on plain cream paper. A heavy rounded body of bone-white stone feathers on two long thin legs like a heron's, the visible joint the backward-bending ankle halfway down, long splayed three-toed feet; a long curved neck; a longer straight beak of warm ochre; small dark eyes under a heavy brow; broad wings of overlapping stone feathers with rose-mauve tips that fold flat against her sides, each feather a carved slab, faint teal glyph lines running along the wings like the lines on a wing. About seven metres tall standing, a wingspan of some sixteen metres. Views: front with wings folded, side, three-quarter, and her signature wind-up: wings flung wide and raised, neck pulled back, about to beat a gale; a solid black silhouette of the side view beneath it. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands beside the front view for scale, an ordinary adult, the bird four times their height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone white stone, ochre beak, rose-mauve feather tips, teal glyph glow, peach light, rose-mauve shadows, restrained cream paper grain, clear readable construction, fully visible bodies, evenly spaced views, no scenery, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels numbers scenery
```

**In its arena: flying the wind with her.**

```
Interior concept art for a science fiction exploration game: the roost at the top of a great white temple of the makers, a round floor of bone-white stone banded in ochre, open to an aqua sky, ringed by a crown of tall stone feathers leaning outward. Two round vents in the floor, a stone ball in a groove between them pushed into one; out of the other a column of wind rises, drawn as pale spiralling streams of dust and loose feathers. In the column the Elder, a huge old bird of stone feathers with a long ochre beak, lifts off at last with her rose-tipped stone wings spread, the teal glyph lines on them lit, and beside her a cloaked adult human traveller of ordinary height with a round jade fluid backpack rides the same wind on wide translucent wings of glowing fluid spread from the backpack, wingtip to wingtip with her, dwarfed by her. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone white, ochre bands, aqua sky, peach light, teal glow, rose-mauve shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 3. The Cloud-Mother, the Founders' Belfry (`cloud-mother`)

**Main: design sheet.**

```
Character design sheet for a science fiction exploration game: the Cloud-Mother, a great pale sky-whale that rose with the floating stones and has not come down, drawn four times at one scale on plain cream paper, floating. A long soft body of pale lavender-grey skin over a cream belly, small dark gentle eyes far forward, a long mouth that opens wide when she cries; two pairs of long soft fins like sails that row the air, a broad tail fluke; a fringe of small white cumulus puffs along her spine like a cloud she carries; faint turquoise glyph spots of three dots over an upward arc along her flanks. About thirteen metres long and five tall. Views: front, side, three-quarter, and her signature wind-up: risen high and arched nose-down, fins swept back, about to dive; a solid black silhouette of the side view beneath it. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands on the ground beside the front view for scale, an ordinary adult, the whale's body three times their height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale lavender grey, cream belly, cloud white, turquoise glyph glow, warm bronze accents, rose and lavender shadows, restrained cream paper grain, clear readable construction, fully visible bodies, evenly spaced views, no scenery, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels numbers scenery
```

**In its arena: the stone rung down where she dives.**

```
Interior concept art for a science fiction exploration game: the top hall of a round tower of bone-white stone, a high dome with an oculus onto a pale gold sky, great stones that fell up hanging under the dome. The Cloud-Mother, a great pale lavender-grey sky-whale with sail-like fins and a fringe of cloud along her back, dives nose-first out of the dome; below her one great stone has come down through the air to the floor, held there while a clear ringing note spreads through the hall, drawn as pale concentric rings of sound from a cloaked adult human traveller of ordinary height with a round jade fluid backpack, who stands well back with a little bell-shaped whistle of blue-glazed clay to their lips, dwarfed by her. She is about to land on the stone and lie there crying. Friezes of three dots over an upward arc, small bells carved in niches. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone white stone, warm bronze, blue glaze, pale sky light, lavender grey, rose and lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 4. The Mother Snapper, the Hush-House (`mother-snapper`)

**Main: design sheet.**

```
Character design sheet for a science fiction exploration game: the Mother Snapper, the oldest carnivorous plant of the swamp, as big as a house and rooted to the floor, drawn four times at one scale on plain cream paper. A fat green bulb sunk in a ring of broad lobed leaves lying flat; out of it a long flexible neck made of a chain of green beads, each bead a joint; a great head of two hinged jaws, rose red outside with pale pink lips and deep crimson inside, each rim ringed with cream teeth like a flytrap; a crown of violet crystal shards growing from the top of the head, faintly glowing. About six metres tall with her neck raised, her bite reaching twelve metres along the floor. Views: front, side, three-quarter, and her signature wind-up: neck coiled high and head drawn back, jaws open, about to lunge; a solid black silhouette of the side view beneath it. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands beside the front view for scale, an ordinary adult, the plant more than three times their height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, moss and leaf greens, rose red, pink, crimson, cream teeth, violet crystal glow, deep indigo shadows, restrained cream paper grain, clear readable construction, fully visible bodies, evenly spaced views, no scenery, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels numbers scenery
```

**In its arena: the pendulums stilled low to high.**

```
Interior concept art for a science fiction exploration game: a round hall under a low ribbed dome of violet stone, swamp crystals growing up through the floor, dusk light through an oculus. Rooted in the middle the Mother Snapper, a house-sized carnivorous plant, her long neck of green beads raised and her great rose-red jaws ringed with cream teeth open, a crown of violet crystal on her head. High over her three crystal pendulums of three sizes hang from the ribs, out of order: the smallest has just been stilled by a burst of pale icy blue frost and hangs motionless and lit, ringing true in faint rings of sound, the middle one swinging still dark, the biggest beyond. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the edge of her reach, a stream of pale icy blue fluid arcing up from the nozzle to the next pendulum, dwarfed by her. Carvings of three drops of rain over a shut mouth on the walls. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, violet stone, teal and violet crystal glow, icy pale blue, moss green, rose red, deep indigo shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 5. The Lampless, the Lamp-House (`lampless`)

**Main: design sheet.**

```
Character design sheet for a science fiction exploration game: the Lampless, a great pale moth that drank the light of a lighthouse of the makers and is frightened of how dark it made everything, drawn four times at one scale on plain cream paper, hovering. A thick soft furred body of lavender white, a furred collar round a small head with large dark navy compound eyes and a short curled tongue; two long feathered antennae; four broad wings, the fore pair pale lavender and the hind pair deeper violet, each with a round eye-spot shaped as the glyph of three dots over an upward arc that glows warm gold; six thin jointed legs tucked under. A body three and a half metres tall, a wingspan of about ten metres. Views: front with wings spread, side, three-quarter, and its signature wind-up: wings swept high and forward, body tipped down, about to swoop; a solid black silhouette of the side view beneath it. A cloaked adult human traveller of ordinary height with a round jade fluid backpack, a little glowing lantern charm at the hip, stands beside the front view for scale, an ordinary adult, the moth's wings six times their width. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, lavender white fur, pale violet wings, warm lamp gold eye-spots, deep navy, coral glints, deep blue shadows, restrained cream paper grain, clear readable construction, fully visible bodies, evenly spaced views, no scenery, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels numbers scenery
```

**In its arena: lured to the lit pool.**

```
Interior concept art for a science fiction exploration game: the lamp-room at the top of a dark tower of the makers, almost black, a great dark lamp in a cage of glass panes in the middle and the night wood far below through them. Round the room three round pools in carved stone rims, two dark, one lit with a soft gold light rising from its water. Over the lit pool the Lampless, a great pale moth with four broad lavender wings and glowing gold glyph eye-spots, hangs low with its wings half folded, drinking the pool's light down its curled tongue, the light draining up into it. A cloaked adult human traveller of ordinary height with a round jade fluid backpack, a little glowing lantern charm at their hip making a soft circle of light, stands well back from it across the room, still, watching, dwarfed by the moth. Friezes of three lamps over a hull. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, deep blue-violet darkness, warm lamp gold, lavender wings, moss green, coral glints, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 6. The Gardener, the Builders' Greenhouse (`gardener`)

**Main: design sheet.**

```
Character design sheet for a science fiction exploration game: the Gardener, the moss giant the white builders left to keep their greenhouse, gone wild and bare, drawn four times at one scale on plain cream paper. A great hunched mound of thick moss in three greens on four short legs of gnarled root, two long arms of root and moss reaching the ground, each ending in a spread of root claws; set into the front of the mound a calm face of clean white builders' stone, smooth, two deep eye hollows and a carved glyph of three dots over an upward arc on its brow; brown bare patches on its back where nothing grows, and over a few of them small leaf-green shoots and petal-pink flowers just coming up. About seven metres tall and nine wide. Views: front, side, three-quarter, and its signature pose: kneeling spent, arms down, its bare back turned up to the sky; a solid black silhouette of the side view beneath it. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands beside the front view for scale, an ordinary adult, the giant four times their height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, moss greens, bark brown, bare earth brown, white stone, leaf green, petal pink, soft blue shadows, restrained cream paper grain, clear readable construction, fully visible bodies, evenly spaced views, no scenery, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels numbers scenery
```

**In its arena: blooming its back in the sun.**

```
Interior concept art for a science fiction exploration game: a round glasshouse of clean gridded white stone under a great ribbed glass dome, four dead garden beds round the walls, one bed already flowering. A louvre in the dome has turned and a single broad sunbeam falls on one quarter of the floor; there the Gardener, a hunched moss giant with a face of white stone and long root arms, kneels spent with its bare brown back turned up into the light. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands on a round footstone at the edge of the sunlit quarter, a stream of leaf green and petal pink glowing fluid arcing from the nozzle onto the giant's back, where flowers burst open in the sun, dwarfed by the giant. The rest of the hall in soft shade, dust in the beam. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, white stone, sunlit glass, moss greens, leaf green, petal pink, sky blue, soft blue shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 7. The warden, the Warden's Well (`warden`)

**Main: design sheet.**

```
Character design sheet for a science fiction exploration game: the warden, a tall old guardian machine of the makers, broken and still at its post, drawn four times at one scale on plain cream paper. A tall drum body of pale steel-blue plates banded in dark navy on three long jointed legs, each with a hip, a knee bending outward and a flat round foot; round its waist a ring of three hinged vent covers over glowing furnace mouths; a narrower drum above and a domed head with one big round golden lamp-eye; on its crown a round vent under a hatch hinged at one side, brass trim and rivets, the makers' glyph of three dots over an upward arc engraved on its chest. About nine metres tall. Views: front, side, three-quarter, and its signature wind-up: legs braced, side vents shut, crown hatch flung open and a column of orange glow venting straight up out of it, the flare; a solid black silhouette of the side view beneath it. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands beside the front view for scale, an ordinary adult, the machine five times their height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale steel blue, dark navy, cream, brass, golden lamp glow, vent orange, lavender shadows, restrained cream paper grain, clear readable construction, fully visible bodies, evenly spaced views, no scenery, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels numbers scenery
```

**In its arena: the draught that lifts the hatch.**

```
Interior concept art for a science fiction exploration game: the top hall of a makers' tower, a tall round drum of cream stone banded in steel blue with slit windows and a dark blue crown, four great vanes like bellows fans set in the floor between the columns. The warden, a nine-metre machine of pale steel-blue plates on three jointed legs with a golden lamp-eye, has backed onto one vane, its side vents shut, the hatch on its crown slammed shut. A cloaked adult human traveller of ordinary height with a round jade fluid backpack hovers over the vane beside it on twin jets of cyan glowing fluid, level with its crown, and the jets' wash spins the great vane, its draught rising and lifting the hatch on the machine's crown, a glow inside; the traveller aims a splash down into it, dwarfed by the machine. Friezes of three dots over an upward arc. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream stone, steel blue bands, dark blue, brass, cyan jet glow, golden lamp light, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 8. The Clockwork Foreman, the First Garage (`foreman`)

**Main: design sheet.**

```
Character design sheet for a science fiction exploration game: the Clockwork Foreman, the makers' machine that kept the time of everything that turns, wound wrong, drawn four times at one scale on plain cream paper. A squat round drum of polished brass on four short stout legs with flat feet; its whole chest a great clock face of cream enamel under a glass cover hinged at the top, two teal hands racing, and round the face six round amber lamps in place of numerals, no numbers or letters anywhere; two thick jointed arms each ending in a heavy brass hammer; on its crown a little brass bell on a post that it strikes; teal trim, rivets, a dark navy underside, the makers' glyph of three dots over an upward arc stamped on its back. About eight and a half metres tall. Views: front, side, three-quarter, and its signature pose: both hammers raised high over its head about to strike its crown bell, the glass over its face swung up and the six lamps glowing; a solid black silhouette of the side view beneath it. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands beside the front view for scale, an ordinary adult, the machine five times their height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, brass, cream enamel, teal accents, amber lamp glow, dark navy, warm light, deep umber shadows, restrained cream paper grain, clear readable construction, fully visible bodies, evenly spaced views, no scenery, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels numbers scenery
```

**In its arena: six lamps in step, round from four.**

```
Interior concept art for a science fiction exploration game: the makers' clockwork workshop, a round hall of pale stone banded in brass, great cogs turning in recesses and in a pit round the floor, warm light from high round windows. The Clockwork Foreman, a squat brass machine with a great clock face for a chest and two hammer arms, stands spent after striking, the glass over its face swung up, its two hands come round to point at four o'clock; round the face six round amber lamps, no numerals, the ones at four and six o'clock lit and ringing in step, drawn as small rings of sound, the next one about to be hit. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands before it firing quick bright splashes of glowing fluid at the lamps one after another round the dial, a coil on the backpack glowing, dwarfed by the machine. A small stopped clock over the hall's doorway shows four. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale stone, brass, teal accents, amber lamp glow, warm window light, deep umber shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels numbers
```

### 9. The Tooth-Warden, the Engine-House (`tooth-warden`)

**Main: design sheet.**

```
Character design sheet for a science fiction exploration game: the Tooth-Warden, the makers' machine that minds a buried engine and has been jamming it, drawn four times at one scale on plain cream paper. A tall drum body of riveted rust-red iron plates banded in blue-grey on four long jointed legs, each with a hip, a knee bending outward and a heavy round foot; round its waist four vents spaced evenly, each a round furnace mouth behind a hinged iron cover; a narrower drum above and a domed head with one big round golden lamp-eye; a toothed collar like a gear's rim round its middle; brass rivets and pipes, scorch marks, the makers' glyph of three dots over an upward arc engraved on its chest. About nine metres tall. Views: front, side, three-quarter, and its signature pose: all four vent covers flung open, the vents glowing ember orange, its body turning; a solid black silhouette of the side view beneath it. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands beside the front view for scale, an ordinary adult, the machine five times their height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rust red iron, blue-grey bands, brass, ember orange glow, golden lamp light, deep umber shadows, restrained cream paper grain, clear readable construction, fully visible bodies, evenly spaced views, no scenery, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels numbers scenery
```

**In its arena: the ball in the great gear's teeth.**

```
Interior concept art for a science fiction exploration game: the engine's heart inside a drum of rust-red iron, a round hall whose floor is one great iron gear set flush, its teeth round the rim, pistons and crank wheels in the walls, embers glowing in the gaps, a ring window high above letting down cool daylight. The Tooth-Warden, a nine-metre machine of riveted rust-red iron on four jointed legs with a golden lamp-eye, stands on the gear, which has just stopped dead: a stone ball rolled down a groove from the west wall sits jammed in the gear's teeth. All four of the machine's vents have swung open facing outward at once, glowing ember orange. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the groove's end, four quick splashes of glowing fluid flying toward the four vents, a fourth chamber on the backpack lit, dwarfed by the machine. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rust red iron, blue-grey bands, ember orange glow, brass, cool teal daylight, deep umber shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 10. The Echo, the Footprint (`echo`)

**Main: design sheet.**

```
Character design sheet for a science fiction exploration game: the Echo, a being of sound left behind by a giant walker that set the garden's spheres down and went on, drawn four times at one scale on plain cream paper, floating. A round glowing core of warm cream light, about three metres across, with three thin rings of pale blue glass tilted at different angles turning round it like an armillary sphere; under it a long soft veil of hanging translucent lavender panels that sway like a jellyfish's skirt; faint glyph marks of three dots over an upward arc etched round each ring. About five metres tall from the top ring to the veil's hem. Views: front, side, three-quarter, and its signature pose: its three rings locked together into one flat glowing lens in front of the core, the chord; a solid black silhouette of the side view beneath it. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands on the ground beside the front view for scale, an ordinary adult, the Echo three times their height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, warm cream core glow, pale blue glass, lavender veil, pale aqua glow, peach light, lavender shadows, restrained cream paper grain, clear readable construction, fully visible bodies, evenly spaced views, no scenery, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels numbers scenery
```

**In its arena: the print that answers.**

```
Interior concept art for a science fiction exploration game: a round hall inside a giant pale sphere half sunk in the earth, curved white walls rising into a dome. The Echo, a glowing cream core in three tilted rings of pale blue glass trailing a long lavender veil, floats in the middle singing three notes at once, drawn as three sets of rings of sound. Round the hall three great resonant white spheres on low plinths all glow at once. Half the picture is seen plainly, the three spheres alike; half is seen through a round glowing lens, and there only one sphere wears a softly lit three-toed footprint on its face. A cloaked adult human traveller of ordinary height with a round jade fluid backpack holds a round makers' lens to one eye and turns the nozzle toward the sphere with the print, dwarfed by the hall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, white sphere stone, pale glass glow, pale blue, lavender, peach light, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### 11. The First Sign, the Undertower (`first-sign`)

**Main: design sheet.**

```
Character design sheet for a science fiction exploration game: the First Sign, the oldest broadcasting machine of the makers, made to say one line into the dark and stuck on one word of it, drawn four times at one scale on plain cream paper. A tall slender mast of teal-grey plates on three long jointed legs splayed like a tripod, each with a knee and a flat foot; thick old cables trailing from its foot; for a head a great round listening dish of cream enamel on a brass yoke that tilts and turns, a ring of small pale yellow lamps round the dish's rim, a brass horn at its focus pointing back into the dish; dark slate joints, brass rivets, the makers' glyph of three dots over an upward arc engraved on the back of the dish. About twelve metres tall. Views: front, side, three-quarter, and its signature pose: its dish lowered and tipped forward to listen, the lamps dim; a solid black silhouette of the side view beneath it. A cloaked adult human traveller of ordinary height with a round jade fluid backpack stands beside the front view for scale, an ordinary adult, the machine seven times their height. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, teal grey, dark slate, brass, cream dish, pale yellow lamp glow, coral glints, deep blue shadows, restrained cream paper grain, clear readable construction, fully visible bodies, evenly spaced views, no scenery, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels numbers scenery
```

**In its arena: its word through the wall dishes.**

```
Interior concept art for a science fiction exploration game: a deep round hall in the makers' foundations under a market city, blue-grey stone blocks older than anything above, faint coloured light from the market's signs falling through gaps far overhead. In the middle the First Sign, a tall mast on three legs with a great cream listening dish for a head, has turned its dish up to the dark, its ring of lamps flickering. On the hall's wall a low makers' dish, and high above it its twin, with an old cable running from the twin down across the floor to the machine's foot. A cloaked adult human traveller of ordinary height with a round jade fluid backpack holds up a pale spiral shell at the low dish, a word flowing out as glowing rings into it, the rings coming out of the high twin and running down the cable toward the machine like beads of light, dwarfed by the machine. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, blue-grey stone, teal grey, brass, cream dish, coral light, teal glints, deep blue shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```
