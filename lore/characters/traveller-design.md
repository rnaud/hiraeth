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
hair**. The second pass answered them. On seeing it the author found him
further from the sheets: the hair read as **dreadlocks**, he should wear an
**overshirt with a little scarf**, and the **boots** were too big. The third
pass below answers that.

## The person

About twenty-six; lean, long-limbed, narrow through the body. A mop of dark,
uneven hair and a warm, expressive face. He looks as though he packed in ten
minutes and has been putting off unpacking for several years. His clothes have
travelled further than his confidence. Avoid the broad chest and padded limbs
of a space suit. The impression is an unprepared young adult, not a soldier.

The face is lean rather than round: slim cheeks under the cheekbones, a narrow
jaw and a small pointed chin, the face a little long, a straight nose, dark
brows, a few freckles, a slight smile at rest. The hair is short-to-medium,
black, tousled: a soft mass of broad clumps, each tapering to a point and drawn
with a few strand lines, a fringe of curls tumbling over the forehead with gaps
between them, a few broken tufts off the crown, short curls flicking out over
the ears and at the nape. Never ropes, tubes or long hanging locks (they read
as dreadlocks), and never a smooth cap or a helmet of hair.

He can be capable without looking industrious. Keep his curiosity, dry humor,
and tendency to help strangers. The scruffy appearance does not rewrite his
family history or turn him into a fool.

## Recognizable shapes and colors

- An open, oversized, faded coral overshirt worn over an ivory undershirt: a
  shirt collar standing round the neck with its points open on the chest,
  lapels, sleeves rolled to the forearm, the hem hanging loose to the upper thigh.
- Loose, straight cream trousers, rolled into a cuff above a bare ankle.
- Low, close-fitting sand suede ankle boots, the shaft just over the ankle
  bone, a rounded toe and a thin darker sole (no seams, buckles or slouch).
- A little tan neckerchief wrapped snug at the throat, its point showing in front.
- A small, round khaki satchel on a diagonal brown strap.
- An ordinary canvas rucksack in dusty olive, worn every day: a lid with two
  leather straps and buckles, a side pocket, an outer pocket, a lavender bedroll
  under it, slim shoulder straps that run under the arms, and the turquoise and
  lavender cloth ties knotted to its top corners.
- Bare head and forearms; the translator is a tiny dark earpiece lost in his hair.
- Once earned, the fluid tank is a slim, flat glass flask sunk into the
  rucksack's outer face (where the outer pocket was), held by two leather bands
  and two leather-bound uprights, its brass neck and valve out over the lid; a
  hose down the outside of the right arm into the cuff of a dark leather glove,
  a plate on its back and three knuckles lit by the fluid: the glove is what
  shoots (no device in the hand).
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
so portraits, studio views and the playable model agree; lighter strand lines
are drawn along each clump, so the hair stays readable as hair in its dark mass.
The boots are built round the body's own feet (the toes on the ball bone, the
shaft on the shin), close enough to stay slim and still keep the feet inside.

The rucksack is built in `src/traveller.js` (`rucksack`, `RUCKSACK`) and rides
the chest frame, like the flask. The flask (`src/fluid-tool.js`, `TANK`) is
the sheets' squat glass jar, about 26 × 29 cm and 14 cm deep, green living
fluid standing at the charges, a dark collar, brass fittings and leather tabs
over the shoulders (docs/systems/traveller-kit.md). The outer
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
