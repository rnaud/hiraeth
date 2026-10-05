# The traveller: visual direction

The three user-supplied character sheets of 2026-10-05 are the visual reference:
[one](../references/traveller/reference-1.jpg),
[two](../references/traveller/reference-2.jpg), and
[three](../references/traveller/reference-3.jpg).
Use the first two for clothes and bearing, and the third for the fluid equipment.
His existing history and voice remain in [the family sheet](family.md).

The author's notes on the first build of this look (third round of feedback):
more casual, nothing of a space suit, **a backpack as he first had**, the fluid
tank **slimmer**; then, from the sheets, **thinner cheeks** and **scruffier
hair**. The second pass below answers them.

## The person

About twenty-six; lean, long-limbed, narrow through the body. A mop of dark,
uneven hair and a warm, expressive face. He looks as though he packed in ten
minutes and has been putting off unpacking for several years. His clothes have
travelled further than his confidence. Avoid the broad chest and padded limbs
of a space suit. The impression is an unprepared young adult, not a soldier.

The face is lean rather than round: slim cheeks under the cheekbones, a narrow
jaw and a small pointed chin, the face a little long, a straight nose, dark
brows, a few freckles, a slight smile at rest. The hair is a black, curly mop
of broken locks: a fringe parted over the brow and falling to both sides, curls
lifting off the crown at odd angles, a few strays, shaggy over the ears and
ragged at the nape. Never a smooth cap or a helmet of hair.

He can be capable without looking industrious. Keep his curiosity, dry humor,
and tendency to help strangers. The scruffy appearance does not rewrite his
family history or turn him into a fool.

## Recognizable shapes and colors

- An open, faded coral overshirt reaching the upper thighs, soft collar, pushed-up sleeves.
- An ivory shirt and loose cream trousers, rolled above the ankles.
- Worn, soft sand-colored desert boots with slouched tops and sand-brown soles (no seams or buckles).
- A loose beige cotton cowl bunched round the neck, one end tucked down the chest.
- A small, round khaki satchel on a diagonal brown strap.
- An ordinary canvas rucksack in dusty olive, worn every day: a lid with two
  leather straps and buckles, a side pocket, an outer pocket, a lavender bedroll
  under it, slim shoulder straps that run under the arms, and the turquoise and
  lavender cloth ties knotted to its top corners.
- Bare head and forearms; the translator is a tiny dark earpiece lost in his hair.
- Once earned, the fluid tank is a slim, flat glass flask sunk into the
  rucksack's outer face (where the outer pocket was), held by two leather bands
  and two leather-bound uprights, its brass neck and valve out over the lid; a
  hose, and a dark right-wrist bracer lit by the fluid.
- The makers’ star is pinned to the jacket lapel; the scout perches on the
  flask's left upright, beside the neck; the lantern hangs off that upright, below.

The glass and lights provide the strange technology. Keep the rest ordinary,
comfortable and slightly untidy. Avoid a bubble helmet, large headphones, tall
antenna, radio boxes, a harness down to the belt, multiple belt pouches,
armored shoulders, or matching uniform pieces.

## Runtime interpretation

The playable model keeps the existing human skeleton, hand poses and movement.
Reduced clothing padding gives it a leaner silhouette. The open jacket is
skinned through the chest and hips, with its lower panels following the thighs.
Its color remains readable at gameplay distance. Hair is deterministic geometry,
so portraits, studio views and the playable model agree; each lock's edges print
a little lighter, so the strands stay readable in the dark mass.

The rucksack is built in `src/traveller.js` (`rucksack`, `RUCKSACK`) and rides
the chest frame, like the flask. The flask (`src/fluid-tool.js`, `TANK`) is
flattened to about 23 × 15 cm and stands about 22 cm off his back in all,
against 34 cm for the old round tank; its three charge bands stay in full view
from behind, the leather bands sit below the fluid and at its brim. The outer
pocket shows while the flask is not on his back (not yet found, or in a
vehicle's socket); the rucksack itself always stays on. Without the flask the
scout docks on the rucksack's lid; with it, on top of the flask's left upright,
high enough that the swinging arms never reach it (the slim pack brings the
dock close to the body), hopping onto the cap while the wings are open. Item
ownership still controls whether the tool is worn; the redesign grants no
equipment.

In `studio.html`, enable **Fluid backpack** to review the complete look (off: the
rucksack alone). The preview uses isolated equipment state and does not change
the player’s save. Review front, side and back at idle and while walking; check
climbing, kneeling, hand poses and vehicle handoff whenever these meshes or
anchors change.

The traveller stays on the people's Quaternius body for now: his clothes, hooks
and poses are fitted to its skeleton, and nothing in the sheets needs a body
the Quaternius one cannot give him.
