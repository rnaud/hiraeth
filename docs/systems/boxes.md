# The makers' chests (v1.42 redesign; the boxes of v0.63 before them)

Code: `src/boxes/` (chest (the models), model, scene, index, placements), the shader block `MAKERS_BOX` in
`src/materials.js`, the desert's pedestal in `src/desert-city.js`. Tests: `tests/boxes.test.js`.

## The look: one chest in every world

The author's picks (`references/Core Objects/Chests/`, prompts in `docs/design/chest-prompts.md`): "the chest should be
the exact same in all worlds". There are two kinds and the placement says which (`chestKind`: a placement with
`temple` gets the temple chest, every other the makers'); nothing about a chest depends on its world.

- **The makers' chest** (`sheet/sheet-1.jpg`; `chest.js` `MAKERS_CHEST`): hip high and wider than tall, a rounded shell
  of pale cream ceramic like a river stone (a superellipsoid, rounder on top, flatter underneath); the makers' pale
  gold four-point star on its top (painted by the shader, its points across longer than front to back); a thin brass
  band round it a little under the middle, standing proud of the shell, with a brass hinge on either side; on the band
  at the front a round glass lens of jade fluid in a brass ring, a two-armed swirl with a bright heart and a highlight
  (the glass backpack's jade). It opens in two: the shell over the band parts on the side hinges like petals, lined
  inside in pale jade.
- **The temple chest** (`temple/sheet-*.jpg`; `TEMPLE_CHEST`), the chest at the heart of each temple: a bud of white
  stone on a low round foot ringed in gold, six petals edged in gold, a gold four-point star with a jade heart on each,
  the jade glass of its heart (a swirling sphere) glowing in the seams between them. It opens like a flower: the
  petals fall outward from the foot and the heart rises and gives itself to the item; a jade disc glows in the foot.
- **Cheap for the Xbox.** Each kind is one vertex-coloured geometry (position, normal, colour; no uv), built once and
  shared by every chest of that kind (`chestGeometry`). A closed chest is **one mesh**; the opening parts (the bowl and
  two halves, or the foot, six petals and the heart) are swapped in only while it opens (`setOpen`). All of it is in
  the chest's one material: the same options as the old blue box but `vertexColors`, which doesn't split the program
  (`userData.sharesProgram`, `scripts/three-program-keys.mjs`), so **no new shader program** (the test checks the
  defines and the shader against the old box's). Measured in the desert (High, 1280 × 720): a chest costs the same 3
  draws as the old box, and the programs linked are unchanged (71–72 with the views shown).
- **A colour over 1 is a light.** In the `MAKERS_BOX` block, what a vertex colour has over 1 is its glow (emissive,
  woken with the star as you come near: `uBoxA.y`), its albedo brought back under 1: the lens, the bud's seams and
  heart, the stars' jade hearts, the linings. Nothing else in the game draws with this material.
- **Outline only.** The material sets the soft-ink flag (+8 in `gHatch.a`, with a full pen line in `r`), so `post.js`
  draws its silhouette and nothing inside it: no crease, colour or shadow-boundary lines (the band, the lens and the
  gold are colour, not ink), and no hatching. A tone of its own over the form (paler where it turns up) keeps it round.
- **The star** is painted in the shader on the makers' chest's top: `uBoxA.z` is its reach in metres (0: none, the
  temple chest, whose stars are its inlay). `uBoxA.y` is the marks' and the lights' glow. (The compasses on the old
  box's sides are gone.)
- **The ray.** A thin line of pale jade light crosses the shell pass after pass, a short trail behind it.
  Each pass is a plane sweeping along another direction (golden-angle turns), so the line wraps
  round the whole shell. `uBoxA.w` is its clock in passes (the line crosses in the first 80% of
  a pass, then rests); `uBoxA.x` its strength. Its core and the star are emissive, so they
  keep their colour in shade and feed the bloom.
- index.js winds the clock: one pass every `RAY_PASS.far` s, quickening to `RAY_PASS.near`
  close up, where the ray, the star and the lens brighten and the chest hums and shudders.

## The opening (scene.js)

`approach → wake → rise → wobble → dissolve → reveal → card → beat → out` (`TIMES`). It floats up
`LIFT` m, turning a corner toward the camera, and hangs there breathing; then the **wobbles**
(`WOBBLES`, like a caught pokéball deciding): three quick rocks about its heart, each with a
small squash, a knock (`sound.boxWobble(i)`) and one pass of the ray across it, with still
rests between them and a last still moment before it opens. The **opening** is the dissolve phase in stages
(`OPENING`, shares of it): over its first half the chest parts (`setOpen`: the makers' halves swing out on their
hinges, the temple's petals fall open and its heart rises), motes of jade light stream up out of it (`buildMotes`,
the sheets' column of light) and the item grows out of the light at its centre; from 55 % it comes apart from the top
down in the dissolve, the motes thinning through the reveal and gone during the card.

The camera takes one of four plans per box (`BOX_PLANS`, `boxPlan(id)`: a stable hash of the box's id;
the desert's first box always the first): **shoulder**, low over his right shoulder, then beside him;
**left**, the same over his left; **side**, from the box's flank at its height with him in profile, then
a cut to past where the box stood, back at the item and his face; **high**, from above his shoulder down
on the box, then beside him. Where a plan's lens would stand behind a wall or a cliff (`clearPlan`: rays
from his chest), the box falls back to the first plan. (The cinematics QC pass: the same shots for all 32.)

**The card** (`card.js`): the item's name, what it is and what it does, or, for a placement with `found` (an i18n key:
the desert's backpack, `box.found.backpack`), one short line said instead (it carries a tone, stripped when shown; FR in
`src/i18n/fr.js`). Its buttons name what to press with the menus' glyphs (`src/pad-glyphs.js`): `A / ×` (Enter on the
keyboard) on Continue, `B / ○` (Esc) on Skip, nothing on touch (v1.41).

**The closing beat** (`beats.js`, v1.3): after the card, a short beat that depends on what the box held
(`beatFor(id, def)`: `ITEM_BEATS`, then `KIND_BEATS` by the item's kind), on a closing shot that keeps
to the plan (`closingShot`: mirrored for **left**, swung toward his side for **side**, raised for
**high**), each at most `MAX_BEAT` (2 s):

| Beat | Items | What happens |
|---|---|---|
| `try` | gadgets, gun modes, the jets, the wings, the backpack | held out in his right hand, it fires once: a spray of light ahead, a kick back, its sound (the mode's own shot) |
| `wear` | cosmetics (the pale star) | pinned on; a close look at it worn on his lapel |
| `keep` | charms | turned over in his fingers, then pocketed with a soft chime |
| `fit` | tank upgrades (coil, chamber) | over his shoulder onto the pack, a click; shot from behind him |
| `point` | the glyph lens, the listening shell | held up, he turns (≤ 70°) toward the nearest box still shut (`pointAt`), a thread of light that way, a faint answer |
| `play` | the bell-note whistle, the echo shell | to his lips: the bell's note, or a few notes on the shell; notes of light rise |

The item is granted as the beat starts (the star is on him for its look). The item asks for its own
timing too (`timingFor`): a gadget's box wobbles three quick times, the last the biggest; a charm's or a
tank part's only twice, gentler, opening 0.7 s sooner (it pays for the beat); the **side** plan holds its
reveal 1.15 s (it cuts to a new angle there). E / A on the card plays the beat; Esc / B on the card goes
past it, and in the beat ends it. After a beat the camera cuts back to play (its closing shot faces him,
and a blend would swing through him) and hands back in 0.5 s; `fit`, shot from behind, blends.
`?boxPlan=<name>` forces a plan (the QC script's `--query boxPlan=high`).

## Nothing before the first

`boxesFound(game)` is true once any `box.*` flag is set (a box opened, a temple's chest, an old
save's backpack). Until then nothing tells of the boxes: the per-world box quests and their
toast wait, the sketchbook has no "Item boxes" page, the empty gear page says only "Nothing
yet", and the Qanat pilgrim who tells of the roof box keeps quiet. The world's other box quests
start `BOX_QUEST_DELAY` s after the first box opens (the story's own box in the desert, or a
fallback by the ship).

## The tree's pedestal (desert)

The backpack's box stands high on the burning tree (`city.ledge`): a climb in two pitches, up
the buttress root's face onto its shoulder (`ledge.shoulder`, 3.2 m), then up the plumb face of
a carved stone pier to an eight-sided dais (`ledge.dais`, 7.2 m) whose front is flush with the
pier (the mantle is clear). On the dais, a drum ringed with the makers' light carries the box;
lamp posts flank it and a stone halo with the glyph stands behind it, half in the bark. The
makers' stone (`M.makers`) is pale, bedded and carved with their inscriptions, banded in their
blue. The drum is tall enough that the box shows over the dais's edge from the top of the stairs.
