# Enemy roster: Midjourney prompts for fresh archetype sheets

2026-10-09. The author approved fresh reference sheets for the 21 archetypes in
[enemy-roster.md](enemy-roster.md) ("Decisions"), because several of the borrowed reference crops show a different
body from the archetype's: the antler hound stands on two legs in its reference, the crucible cart walks on legs
instead of tracks, and the ink blot has no concept of its own. Each archetype gets one prompt for its main sheet
(its body plan, in the skin of the first world it appears in) and one short prompt for one alternate world skin.

## What every prompt keeps

- **The house style**, reused word for word from the existing prompts: the enemy briefs
  (`references/*/enemies/sources.json`: "Moebius science-fiction ligne claire, fine ink contours, warm ivory paper,
  fully visible bodies, no text"), the gadget sheets (`references/batches/*.json`: "Moebius fine ink drawing, flat
  gouache, cream background") and the title covers (`references/Title Screen/selections.json`: "exquisite fine pen
  contours, sparse delicate hatching, luminous FLAT gouache colour fields, restrained cream paper grain"). The
  enemy roster's own style line (`references/enemy-roster.json`) adds "ancient ivory/brass machinery, ink-black/violet
  spirits".
- **The layout:** the same body drawn four times at one scale (front, side, three-quarter, and the wind-up pose of
  its signature attack, the pose the game uses as its telegraph), a solid black silhouette under the side view (the
  roster's first rule: silhouette first), and the small cloaked traveller with the round jade backpack standing
  beside it for scale, on plain cream paper with no scenery.
- **The joints spelled out**, because the bodies are built for the procedural rig
  (docs/systems/procedural-animation.md): knees and hocks and which way they bend, foot shapes, pistons and
  hinges on the machines, and for the spirits how the dark shows itself (each one differently, as the roster
  requires).
- **The flags.** The earlier enemy sheets and title covers carried no `--v` flag: they ran on Midjourney's default
  model at the time, V8.2 (`references/enemy-roster.json`, `"model": "8.2"`). These prompts do the same; if the
  default has moved on by the time they are run, add `--v 8.2` so the new sheets match the old ones. The aspect is
  `--ar 16:9` for long or low bodies and `--ar 3:2` for tall ones. The `--no` list follows the title covers'
  hyphenated form. No `--sref`: the title covers' style references are landscapes and would pull scenery in.
- **Sizes** are the roster's where it gives one (the centipede 4–6 m, the heron's 2.5 m legs, the tripod 3.5 m, the
  bell 4 m, the brute 3.5 m, the blot 0.8 m); the others are proposals for the modellers, measured against the
  1.7 m traveller.

The common tail every main prompt ends with (written out in full in each prompt below, so each can be pasted alone):

> Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only
> in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear
> readable construction, fully visible bodies, evenly spaced views, no lettering

## How to run

For Codex (which made the earlier Midjourney sheets) or the author:

1. **Run the main prompt** for an archetype as written. Re-roll until one of the four images shows all four views
   and the silhouette with the body plan right (the leg count, the joints, the tracks, the strings…).
2. **Pick by silhouette first.** Cover the colour: does the black shape read as this archetype and nothing else
   in the roster, from across a room? Then the joints: can a modeller see where each leg bends and what the foot is?
   Then the wind-up pose: is the telegraph obvious? Colour and charm come last; a skin can fix the palette.
3. **Save it** as `references/enemy-archetypes/<id>/sheet-1.jpg` (the full-size upscale), with ids as in
   `scripts/enemy-roster/archetypes.json`: `crab`, `skitter`, `centipede`, `toad`, `lizard`, `heron`, `roller`,
   `rootknot`, `jelly`, `moth`, `ray`, `worm`, `tripod`, `cart`, `bell`, `drone`, `brute`, `blot`, `shade`,
   `hound`, `marionette`.
4. **Run the alternate skin** with the chosen sheet-1's Midjourney image URL pasted at the very start of the prompt
   (an image prompt), so the new skin keeps the same body. Save it as `sheet-2.jpg`, and number any later skins on.
5. **Record it** in `references/enemy-archetypes/<id>/manifest.json`, in the shape of the old `sources.json`:

   ```json
   {
     "archetype": "crab",
     "date": "2026-10-10",
     "service": "Midjourney",
     "model": "8.2",
     "sheets": [
       {
         "file": "sheet-1.jpg",
         "skin": "Vael II: cliff crab",
         "prompt": "<the exact prompt as run, flags included>",
         "job": "<job id>",
         "jobUrl": "https://www.midjourney.com/jobs/<job id>?index=<n>",
         "chosen": 2,
         "why": "the clearest silhouette; the leg joints read in the side view"
       }
     ]
   }
   ```

   Keep the original export; a better re-roll is a new file (`sheet-1b.jpg`) and a new manifest entry, never an
   overwrite. Write down anything on the sheet that is *not* a design requirement (a stray prop, a wrong leg count
   on one view), as the old sources did in `notes`.
6. When all 21 are in, point `scripts/enemy-roster/archetypes.json` at the new sheets and rebuild the contact sheet
   (`node scripts/enemy-roster/sheet.cjs`).

---

## Creatures

### 1. Shellback crab (`crab`)

**Main sheet: Vael II, the cliff crab.**

```
Creature design reference sheet for a science fiction exploration game: one shellback crab, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its shell-spin wind-up with all six legs pulled under the body and the front of the shell tilted up, rocking. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale, the shell reaching the traveller's chest. Body plan: a low wide domed shell wider than it is tall, about 1.6 metres across; six walking legs splayed out sideways like a table, each leg with a clearly drawn knee joint bending out and up above the shell rim and a pointed hooked foot tip; two raised pincers on jointed arms, one larger than the other; two eye stalks between the pincers. Reads as a black lump with two hooks on top. Vael II palette: slate-blue shell flecked with pale lichen, ivory underside and joints, apricot pincer tips, cool blue-grey shadow. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin: the Salt Harbour, the anchor crab.**

```
[sheet-1 image URL] The same shellback crab, same six jointed legs, same domed shell and pincers, redrawn as the Salt Harbour's anchor crab: barnacles crusting the shell, a tangle of old rope and a small iron anchor caught on its back, cream, turquoise and rusty coral with flat lavender-blue shadows. Front, side and three-quarter views and the shell-spin wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering scenery collage
```

### 2. Skitter swarm (`skitter`)

**Main sheet: the Desert, the dune skitters.**

```
Creature design reference sheet for a science fiction exploration game: the skitter swarm, a flock of fist-sized creatures. Across the top, one skitter drawn large four times: front view, side view, three-quarter view, and its rush wind-up reared up on its back legs with its front legs raised, clicking. Below, ten identical skitters running as one rippling line, and three of them piled into a wobbling heap; beneath them the solid black silhouette of the flock. A small cloaked human traveller with a round jade fluid backpack stands beside the flock for scale, the skitters no higher than the traveller's ankle. Body plan of one skitter: a smooth round dome body the size of a fist, six short hooked legs with one clear knee joint each bending up above the dome, pointed feet, two tiny black eyes at the front rim, two short feelers. Desert palette: sand-gold domes with ochre bands, ivory legs, turquoise eye glints, warm cream shadows. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin: the Moon Foundry, the furnace beetles.**

```
[sheet-1 image URL] The same skitter swarm, same fist-sized domes on six hooked jointed legs, redrawn as the Moon Foundry's furnace beetles: dark iron-grey domes with a glowing ember-orange seam down the back, cream enamel legs, soot-black shadows. One skitter large in front, side, three-quarter and reared-up views, then a rippling line of ten and a small heap, on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering scenery collage
```

### 3. Ring centipede (`centipede`)

**Main sheet: the Buried Machine, rust-banded with a drill-bit head.**

```
Creature design reference sheet for a science fiction exploration game: one ring centipede, drawn at the same scale on a plain cream background: a full side view stretched out straight, a top-down view coiled into a complete ring, a three-quarter view of the head, and its pincer-lunge wind-up with the head reared high and the front segments bunched up like a spring. Beneath the straight side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the body is five metres long and the head as tall as the traveller's waist. Body plan: fourteen armoured ring segments of equal size in a follow-the-leader chain, each segment with one pair of short legs, each leg with a clear knee joint and a pointed foot, the legs shown in a rippling wave down the body; a heavy crab-like head with two big pincers and a small drill-bit snout; a short tapering tail. Coiled, it makes a crescent or a perfect ring. Buried Machine palette: rust-orange segment bands on ash-grey plates, a steel drill-bit head, slate-violet shadows. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin: the Fallen Ring, the orbital centipede.**

```
[sheet-1 image URL] The same ring centipede, same fourteen segments with a jointed leg pair each, same crab-like head and pincers, redrawn as the Fallen Ring's orbital centipede: teal enamel plates edged in cream, a polished gold head, small bolts along each segment, deep blue shadows. Straight side view, coiled ring from above, head in three-quarter and the reared lunge wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering scenery collage
```

### 4. Bellows toad (`toad`)

**Main sheet: Lorn, the spore toad.**

```
Creature design reference sheet for a science fiction exploration game: one bellows toad, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its spore-lob wind-up rearing back with its huge throat sac swollen to twice its size and gone translucent, a round glob of spores visible inside. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale, the sitting toad as tall as the traveller's shoulder. Body plan: a squat pear-shaped body sitting upright like a fat old man; short thick front legs with elbows and broad three-toed hands; powerful folded hind legs with a clearly drawn knee bending forward and an ankle bending back, long webbed feet flat on the ground; a wide mouth and heavy-lidded eyes on top of the head; the deflated throat sac hanging in folds. Lorn palette: mottled moss-green skin with pale lilac spots, a cream belly, the throat sac pale lilac, violet shadows. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin: the City-Shaft, the pressure toad.**

```
[sheet-1 image URL] The same bellows toad, same squat pear body, same jointed folded hind legs and webbed feet, same throat sac, redrawn as the City-Shaft's pressure toad: slate-blue skin, a small brass valve and pressure gauge growing from its back, the swollen sac holding hot water with a wisp of steam, ivory belly, pink accents. Front, side and three-quarter views and the swollen-throat wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering scenery collage
```

### 5. Horn lizard (`lizard`)

**Main sheet: the City-Shaft, the pipe lizard.**

```
Creature design reference sheet for a science fiction exploration game: one horn lizard, drawn four times side by side at the same scale on a plain cream background: top-down view, side view, three-quarter view, and its blare wind-up with the front half lifted off the ground, throat sac swelling and the horn's mouth glowing. Beneath the side view its solid black silhouette, long and flat like a stretched S. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the lizard is three metres long with its tail, so low that its back only reaches the traveller's knee. Body plan: a monitor lizard or salamander hugging the ground, belly almost touching the earth; four short sprawling legs splayed out to the sides with elbows and knees bent outward like a crocodile's, four splayed toes; a long low neck stretched forward level with the back, never raised, and a flat wedge-shaped head; its snout itself grows into a narrow curved brass horn fused to the skull like bone, about as long as the head, curling slightly up and ending in a small flared mouth; a long heavy tail lying on the ground and coiling into a tight spiral at its tip. Nothing about it stands upright or tall: it is a low creeping animal, not a dinosaur. City-Shaft palette: dusty terracotta and rose scales with darker mottled bands, ivory belly plates, the horn tarnished brass with verdigris at the seams, slate-blue shadows. Strange and alien rather than cute. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage dinosaur long-neck upright cartoon
```

**Alternate skin: the Signal Market, the coin lizard.**

```
[sheet-1 image URL] The same horn lizard, same long low four-legged body with jointed legs, same curled tail and trumpet snout, redrawn as the Signal Market's coin lizard: teal scales, a polished brass horn hung with little pierced coins on strings, cream belly, warm amber accents. Front, side and three-quarter views and the reared blare wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering scenery collage
```

### 6. Stilt heron (`heron`)

**Main sheet: the Desert, the cistern heron.**

```
Creature design reference sheet for a science fiction exploration game: one stilt heron, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its spear wind-up with the long neck drawn back into a tight S, the bill pointed straight forward and the body leaning back. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale, reaching only to its knee joint. Body plan: two very long thin stilt legs 2.5 metres high, each with a clearly drawn backward-bending ankle joint halfway up like a bird's, and wide three-toed wading feet; a slim body shaped like a round cream clay water jug with a narrow mouth at the top; a long S-curved neck rising from the jug's mouth; a small head with a long straight spear bill. Tall and thin, nothing else is this vertical. Desert palette: cream glazed clay body with ochre painted bands, sand-gold legs, a turquoise bill tip, warm cream shadows. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin: Vael, the ridge runner.**

```
[sheet-1 image URL] The same stilt heron, same 2.5 metre stilt legs with backward-bending ankles and three-toed feet, same S-neck, redrawn as Vael's ridge runner: a slim feathered pale blue body instead of the jug, folded wings that can flare, a hooked bill, rust-red crest feathers, ivory legs. Front, side and three-quarter views and the S-neck spear wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering scenery collage
```

### 7. Pearl roller (`roller`)

**Main sheet: the Sealed Hangar, the ball-bearing snail.**

```
Creature design reference sheet for a science fiction exploration game: one pearl roller, a snail with a shell bigger than itself, drawn at the same scale on a plain cream background: unrolled in front view, side view and three-quarter view, then rolled up into a perfect ball, then its bowl wind-up with the eye stalks sunk and the shell rocked back on its foot. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale, the shell as tall as the traveller's chest. Body plan: a nearly spherical spiral shell 1.4 metres across; a soft muscular foot underneath with ripples along its sole; two long eye stalks and two short feelers; no legs; rolled up, the foot and head tuck completely inside the shell's opening and it becomes a sphere. Sealed Hangar palette: a polished steel shell with an oily rainbow sheen along its spiral groove, a dark teal foot, black-teal shadows. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin: the Garden of Spheres, the pearl shell.**

```
[sheet-1 image URL] The same pearl roller, same spherical spiral shell, soft foot and eye stalks, same rolled-up ball, redrawn for the Garden of Spheres: a lustrous pearl shell in ivory, blush pink and pale gold, its spiral faintly glowing, a pale lilac foot. Unrolled front, side and three-quarter views, the rolled ball and the rocking wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering scenery collage
```

### 8. Root knot (`rootknot`)

**Main sheet: Lorn, the reed knot.**

```
Creature design reference sheet for a science fiction exploration game: one root knot, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its grip wind-up with two root-arms plunged into the ground in front of it and its broad cap tipped forward. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the knot is 2.5 metres tall. Body plan: a broad mushroom cap over a bulb-shaped body; five long root-arms around its base, each a jointed tapering limb with two clear bends like elbows, each tip spread into a small fan of rootlets planted in the ground; a skirt of short tendrils between them; no legs, the body is carried between the planted arms; two small pale eyes under the cap's rim. From far off, a tree that shouldn't be there. Lorn palette: a pale lilac cap with cream gills, a reed-green bulb, ochre roots, violet shadows. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin: Lorn II, the root crawler.**

```
[sheet-1 image URL] The same root knot, same broad cap, bulb body and five jointed root-arms with planted rootlet tips, redrawn as Lorn II's root crawler: a deep teal cap with softly glowing turquoise gills, dark bark-brown roots, a red-brown bulb, small brass-coloured spores drifting. Front, side and three-quarter views and the arms-plunged grip wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering scenery collage
```

### 9. Lantern jelly (`jelly`)

**Main sheet: Vael II, the cloud jelly.**

```
Creature design reference sheet for a science fiction exploration game: one lantern jelly floating in the air, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its ward pose with one lantern swollen bright and a thin thread of light running from it out to the side, the bell pulsing tight. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands below it for scale, the jelly hovering well above the traveller's head. Body plan: a soft puffy bell-shaped cap 1.5 metres wide; long trailing threads hanging three metres down, gently waving; three small paper lanterns hanging on cords beneath the bell, each glowing; no legs, no face, only two soft dark eye-spots on the bell's rim. From far off, a floating lamp. Vael II palette: pale pink puffy bell like a cloud, ivory threads, apricot paper lanterns glowing warm, pale aqua and cool blue-grey shadow. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin: the Underwater City, the porcelain jelly.**

```
[sheet-1 image URL] The same lantern jelly, same bell cap, long threads and three hanging lanterns, redrawn as the Underwater City's porcelain jelly: a glazed porcelain-white bell with fine blue painted rings, the lanterns small round glass fishing floats glowing buttery yellow, coral-pink threads, ultramarine shadows. Front, side and three-quarter views and the ward pose on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering scenery collage
```

### 10. Signal moth (`moth`)

**Main sheet: Lorn II, the lamp moth.**

```
Creature design reference sheet for a science fiction exploration game: one signal moth, an alien creature that hovers upright in the air, drawn four times side by side at the same scale on a plain cream background: wings folded into a tall tent, side view, three-quarter view, and its flash wind-up with both wings snapped wide open like two signal panels and their eye-spots blazing white. Beneath the open-wing view its solid black silhouette, a broad triangle. A small cloaked human traveller with a round jade fluid backpack stands below it for scale; the open wings span 1.8 metres. Body plan: not an insect from a natural history book but an otherworldly lamp creature: its body is a slender upright paper-lantern shape, ribbed and translucent, with a warm light burning inside it; two pairs of wings made of thin stretched membrane on fine rods, like the sails of a kite or the slats of a signal lamp, hinged at the shoulder; two long antennae ending in small glowing bulbs; six long thin dangling legs with clear knee joints and hooked feet, folded under it like a hanging lantern's fringe; a small hooded face with two dark eyes. Lorn II palette: dusty grey-lilac membrane wings lit from behind so their rods glow amber, two round red eye-spots, the lantern body warm honey-gold, deep teal shadows. Strange, delicate, mysterious. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage realistic-insect specimen-plate entomology
```

**Alternate skin: the Forest of Antennas, the signal moth.**

```
[sheet-1 image URL] The same signal moth, same upright body, two pairs of hinged wings, jointed folded legs, redrawn for the Forest of Antennas: cream wings with fine copper circuit-like veins, its antennae two small dish shapes instead of feathers, pale green eye-spots, copper and verdigris accents. Folded front view, side, three-quarter and the wings-open flash wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering scenery collage
```

### 11. Sky ray (`ray`)

**Main sheet: Vael, the storm ray.**

```
Creature design reference sheet for a science fiction exploration game: one sky ray flying, drawn at the same scale on a plain cream background: seen from above with wings spread flat, front view, side view showing how thin it is, and its skim wind-up banking hard with the wings swept back and the tail lifted. Beneath the top view its solid black silhouette, a broad flat diamond with a whip tail. A small cloaked human traveller with a round jade fluid backpack stands below it for scale; the wings span four metres. Body plan: a broad flat diamond-shaped body that is all wing, the wing edges rippling in a slow wave from root to tip; a short blunt head with two eyes on top and a small mouth beneath; a long thin whip tail made of small linked segments; no legs. Vael palette: rust-red back with ivory belly, pale blue wing edges, a cream tail, cool blue-grey shadows. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin: the Glass Dunes, the glass manta.**

```
[sheet-1 image URL] The same sky ray, same flat diamond wing-body and segmented whip tail, redrawn as the Glass Dunes' glass manta: faceted and see-through like cut glass, pale aqua and lilac reflections, bright white glints on the facets, a sand-gold underside. Top view, front, side and the banking skim wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering scenery collage
```

### 12. Mound worm (`worm`)

**Main sheet: the Desert, the dune worm.**

```
Creature design reference sheet for a science fiction exploration game: one mound worm, drawn at the same scale on a plain cream background: hidden as a travelling sand mound with only a dorsal fin showing; standing upright out of its hole in front view, side view and three-quarter view; and its eruption pose bursting straight up out of the ground with sand flying. Beneath the upright side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; standing up it is 2.5 metres tall and one metre thick. Body plan: a fat grub made of thick stacked rings, a bulbous front end tapering to a pointed drill tail; a round mouth ringed with small grinding teeth; a tall thin dorsal fin along its back; no legs; tiny dark eyes. Upright it reads as a stack of rings. Desert palette: sand-gold rings with ochre bands, an ivory fin, a turquoise-tinted mouth, warm cream shadows. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin: the Buried Machine, the drill grub.**

```
[sheet-1 image URL] The same mound worm, same thick stacked rings, toothed mouth and dorsal fin, redrawn as the Buried Machine's drill grub: slate-violet rings with ash-grey bands, its tail a spiralled steel drill bit, rust flecks, soot shadows. The sand mound with fin, upright front, side and three-quarter views and the eruption pose on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering scenery collage
```

---

## Possessed machines

Each prompt names the machine's own sign of possession, from the roster; none has a black blob on its shoulder.

### 13. Lamp tripod (`tripod`)

**Main sheet: the City-Shaft, the inspection tripod.**

```
Machine design reference sheet for a science fiction exploration game: one lamp tripod, an ancient makers' machine possessed by a dark spirit, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its beam wind-up with the searchlight's shutter narrowed to a bright cone and a harpoon bolt loaded under the lamp. Beneath the side view its solid black silhouette, a lighthouse on stilts. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; it is 3.5 metres tall, the traveller reaching its knee. Body plan: a tall round ivory boiler with a big searchlight lamp on top; three thin jointed legs, each with a hip hinge, a knee that bends outward, a visible brass piston between thigh and body, and a small round flat foot pad; riveted panels. The possession: a round porthole window in the boiler with the dark pressed against the glass from inside, two white eyes and inky fingers smearing it; its steam vents puff black. City-Shaft palette: ivory enamel and polished brass, slate-blue accents, pink rust, the possession ink-black and violet. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin: the Underwater City, the diving bell.**

```
[sheet-1 image URL] The same lamp tripod, same three thin jointed piston legs and searchlight, redrawn as the Underwater City's diving bell on legs: the boiler a riveted copper diving bell with several small portholes, the dark eyes and smeared fingers at the glass of each, coral-pink and turquoise paint, buttery yellow lamp, black bubbles rising. Front, side and three-quarter views and the narrowed-beam wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering scenery collage
```

### 14. Crucible cart (`cart`)

**Main sheet: the Sealed Hangar, the welding cart.**

```
Machine design reference sheet for a science fiction exploration game: one crucible cart, an ancient makers' machine possessed by a dark spirit, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its pour wind-up with the crucible tilted forward on its turret, the pouring lip glowing and the smoke leaning the same way. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; it is two metres wide and as tall as the traveller. Body plan: a squat open crucible pot, wider than it is tall, with a pouring lip on one side, sitting on a slow turntable turret; underneath, two caterpillar tracks with clearly drawn road wheels and sprockets, no legs; small springs between tracks and chassis; two short jointed welding-torch arms at the sides. The possession: boiling over, ink froths over the crucible's rim like a pot left on the fire, and a column of black smoke rises out of it with two white eyes in it. Sealed Hangar palette: black-teal and gunmetal steel, patched canvas covers, a glowing orange lip, the brew ink-black and violet. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin: the Moon Foundry, the crucible cart.**

```
[sheet-1 image URL] The same crucible cart, same squat pot on a turret, same caterpillar tracks with road wheels, the same ink boiling over the rim with eyes in its smoke, redrawn as the Moon Foundry's crucible cart: cream enamel with chipped edges, soot-darkened brass, no torch arms, glowing ember slag at the lip. Front, side and three-quarter views and the tilted pour wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering scenery collage
```

### 15. Bell walker (`bell`)

**Main sheet: the Signal Market (the archetype's bell body).** The Market's own skin, a signboard on legs,
can follow as a third sheet once the bell body is fixed.

```
Machine design reference sheet for a science fiction exploration game: one bell walker, an ancient makers' machine possessed by a dark spirit, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its toll wind-up reared back on its rear legs with the clapper swung high inside the bell. Beneath the side view its solid black silhouette, a bell on legs. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the bell is four metres tall, the traveller reaching its rim. Body plan: a great bronze bell hung in a riveted yoke; five short spider legs around the yoke, each with a hip hinge, a high knee bending up and out and a pointed foot; a visible pendulum clapper inside. The possession: the clapper is the spirit, a black body with two white eyes swinging inside the bell, its thin arms hooked over the rim; ink drips from the bell's mouth. Signal Market palette: aged bronze with teal verdigris, brass yoke hung with little coins and patched cloth pennants, warm amber accents, the spirit ink-black and violet. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin: the Salt Harbour, the dock winch.**

```
[sheet-1 image URL] The same bell walker, same five short jointed spider legs round a riveted yoke, redrawn as the Salt Harbour's dock winch: instead of a bell a big weathered winch drum in the yoke, its heavy chain and hook swinging below as the clapper, the black spirit with white eyes clinging to the chain, cream, turquoise and rusty coral, salt crust. Front, side and three-quarter views and the reared toll wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering scenery collage
```

### 16. Ring drone (`drone`)

**Main sheet: the City-Shaft, the rust drone.**

```
Machine design reference sheet for a science fiction exploration game: one ring drone, an ancient makers' machine possessed by a dark spirit, hovering, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its harpoon wind-up with the plates parted and a harpoon on a reel sliding out between them. Beneath the side view its solid black silhouette, a floating cake stand. A small cloaked human traveller with a round jade fluid backpack stands below it for scale; the discs are 1.2 metres across, hovering at head height. Body plan: a stack of three flat round discs on a central spindle, a small gap between each, each disc free to spin; three thin dangling arms under the bottom disc, each with an elbow joint and a small claw; small vents round each rim. The possession: a caught cloud, black smoke trapped between the plates like a held breath, leaking out at the gaps, with two white eyes drifting in it. City-Shaft palette: weathered brass plates with pink rust, ivory enamel rims, slate-blue shadow, the smoke ink-black and violet. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin: the Garden of Spheres, the ring drone.**

```
[sheet-1 image URL] The same ring drone, same three stacked discs on a spindle with jointed dangling arms, the same smoke with eyes trapped between the plates, redrawn for the Garden of Spheres: pearl-white plates with fine gold rims, gold arms, a faint prism shimmer on the discs. Front, side and three-quarter views and the parted-plates harpoon wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering scenery collage
```

### 17. Furnace brute (`brute`)

**Main sheet: Lorn II, the wood cutter.**

```
Machine design reference sheet for a science fiction exploration game: one furnace brute, an ancient makers' machine possessed by a dark spirit, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its slam wind-up with both huge fists raised high over the top of its body and the torso arched back. Beneath the side view its solid black silhouette, a wardrobe with fists. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; it is 3.5 metres tall, the traveller reaching its hip. Body plan: a huge ivory barrel torso with no head; two massive arms long enough to reach the ground, with shoulder ball joints, thick elbows and big three-fingered fists; short thick legs with a knee bending forward and broad flat elephant-like feet; panels and rivets. The possession: ink in the cracks, the hull cracked all over like a dropped jar, black ink seeping from every seam and running down its limbs like tar, the widest cracks glowing violet. Lorn II palette: old ivory hull with brass fittings, grown through with dark roots and moss, a rusted saw blade in one fist, deep teal shadows. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin: the Glass Dunes, the furnace walker.**

```
[sheet-1 image URL] The same furnace brute, same headless barrel torso, long jointed arms with huge fists and short legs, the same ink seeping from violet-glowing cracks, redrawn as the Glass Dunes' furnace walker: plated in thick faceted glass over a sand-gold furnace hull, a glowing orange furnace door in its chest, pale aqua glints. Front, side and three-quarter views and the fists-raised slam wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering scenery collage
```

---

## Spirits

The dark itself, a different shape each time; none is the tall clawed biped with a smoke skirt.

### 18. Ink blot (`blot`)

**Main sheet: the Desert, sand-edged.**

```
Spirit design reference sheet for a science fiction exploration game: one ink blot, a small creature of living black ink, drawn at the same scale on a plain cream background: a flat puddle on the ground, then stood up into a squat wobbling drop in front view, side view and three-quarter view, then its lunge wind-up coiled down into a flattened spring, then reared up tall and thin to spit. Beneath the standing side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the blot is 0.8 metres tall, at the traveller's thigh. Body plan: no limbs at all, a glossy ink drop that squashes and stretches, with two round white eyes; small splashes and droplets flying off its edges; it pools where it lands. The manifestation: it is loose ink itself, no borrowed body. Desert palette: deep ink-black with violet highlights, its bottom edge taking the colour of sand-gold ground, cream eyes. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage
```

**Alternate skin: the Sealed Hangar, rust-edged.**

```
[sheet-1 image URL] The same ink blot, same limbless squashing ink drop with two white eyes, redrawn for the Sealed Hangar: its edge stained rust-orange and oily teal where it touches the floor, a few metal shavings stuck to it, gunmetal reflections. The puddle, standing front, side and three-quarter views, the coiled lunge and the tall spit pose on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering scenery collage
```

### 19. Shade (`shade`)

**Main sheet: Lorn II, the hollow woodsman.**

```
Spirit design reference sheet for a science fiction exploration game: one shade, an empty hooded cloak worn by nothing, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its cut wind-up with the ink sword drawn back over its shoulder and the hood turning toward the viewer. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the shade is 2.2 metres tall. Body plan: an upright humanoid shape made only by the cloak: shoulders, sleeves with bent elbows, a gauntlet-like cuff where the sword hand would be, and below the hem two empty boots with clear knee bends visible through the cloth; no face, only two white eyes in the dark of the hood; long cloak strips trailing. The manifestation: the cloak hangs empty, its hem breaking into drifting smoke, and the sword is poured liquid ink. Not a skeletal clawed figure. Lorn II palette: a pointed hood of rough bark, a moss-green and deep teal cloak, a brass buckle, the smoke and sword ink-black and violet. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels scenery collage skeleton claws
```

**Alternate skin: the City During the Eclipse, the pilgrim.**

```
[sheet-1 image URL] The same shade, same empty cloak with jointed sleeves and empty boots, two white eyes in the hood, ink sword and smoking hem, redrawn as the Eclipse's pilgrim: a tall round pilgrim's hood with a brass crescent moon at its peak, a violet and dusk-blue cloak, a small lantern on its belt, pale gold trim. Front, side and three-quarter views and the sword-back cut wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering scenery collage skeleton claws
```

### 20. Antler hound (`hound`)

**Main sheet: the Garden of Spheres, the halo hound.**

```
Spirit design reference sheet for a science fiction exploration game: one antler hound, a four-legged beast made of shadow, drawn at the same scale on a plain cream background: front view, side view, three-quarter view, its pounce wind-up crouched low with the antlers dipping forward and the shoulders bunched, and a flat shadow on the ground with the hound's head and antlers rising out of it. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; it stands 1.4 metres at the shoulder and its antlers are wider than its body. Body plan: a lean deer-like hound on four long legs, front legs with elbows bending back and wrists bending forward, hind legs with a high hock joint angled back like a dog's, small round paws; a deep chest and narrow waist; a long muzzle; a crown of branching antlers wider than its body; smoke streaming off its back like a mane. The manifestation: a shadow cast by nothing, it rises out of a flat shadow on the ground and sinks back into it, its body a matte deep black with two white eyes. Garden of Spheres palette: the shadow ink-black and violet, a thin pearl-and-gold halo ring caught in its antlers, faint gold glints. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage biped standing-upright
```

**Alternate skin: the White Mangrove, the driftwood hound.**

```
[sheet-1 image URL] The same antler hound, same lean four-legged body with back-angled hocks, same wide antler crown and smoke mane, rising from a flat shadow, redrawn as the White Mangrove's driftwood hound: bleached bone-white driftwood antlers, the black body dripping like wet ink, sage and lilac smoke, small turquoise eye glow. Front, side and three-quarter views, the crouched pounce wind-up and the shadow on the ground on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering scenery collage biped
```

### 21. Marionette (`marionette`)

**Main sheet: the Garden of Spheres, the glass puppet.**

```
Spirit design reference sheet for a science fiction exploration game: one marionette, a puppet hanging in mid-air from strings, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its strings wind-up with both arms lifted, the fingers curled, and two extra strings unspooling downward from its hands. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the puppet is two metres tall and its feet hang a metre off the ground. Body plan: a thin rigid wooden-puppet figure with ball joints at the shoulders, elbows, wrists, hips, knees and ankles, all clearly drawn; hanging limp with the head tipped forward; four long strings from its head, hands and back rising straight up into a knot of black smoke far overhead. The manifestation: the puppeteer, the spirit is the hand you never see, the strings vanish up into the smoke, and the puppet has no eyes of its own. Garden of Spheres palette: a clear glass puppet with faint prism reflections, fine silver threads, pearl ball joints, the smoke knot ink-black and violet. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels scenery collage feet-on-ground
```

**Alternate skin: the Signal Market, the parcel puppet.**

```
[sheet-1 image URL] The same marionette, same jointed puppet hanging off the ground on four strings rising into a knot of black smoke, redrawn as the Signal Market's parcel puppet: its limbs and body made of brown paper parcels tied with string, a paper-bag head, teal and brass wax seals, amber accents. Front, side and three-quarter views and the arms-lifted strings wind-up on plain cream paper, black silhouette below, small cloaked traveller with a round jade backpack for scale. Moebius science-fiction ligne claire, exquisite fine pen contours, sparse hatching, flat pastel gouache, cream paper grain, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering scenery collage feet-on-ground
```
