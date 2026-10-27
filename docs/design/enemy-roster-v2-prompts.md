# Enemy roster v2: reference prompts for the camp tribe and the thief

2026-10-27, issue #722 (recommendation D14). The designs are in [enemy-roster-v2.md](enemy-roster-v2.md): the
mummers (the camp tribe), their chief the mummer king, and the gullet (the thief). One main-sheet prompt each, in the
house style of [enemy-roster-prompts.md](enemy-roster-prompts.md): the same body drawn four times at one scale (front,
side, three-quarter, and the wind-up pose of its signature attack, the pose the game uses as its telegraph), its solid
black silhouette under the side view, the small cloaked traveller with the round jade backpack for scale, plain cream
paper, no scenery, the joints spelled out for the procedural rig, and the common tail written out in full.

Run in the reference lab (docs/systems/reference-lab.md) with its defaults (Gemini and OpenAI), no style references:

```
node scripts/gen-reference.mjs --from docs/design/enemy-roster-v2-prompts.md#mummer --n 2
```

The author picks; the pick goes to the target folder as `sheet-1.jpg` with its manifest, and an alternate skin is
written from the picked sheet afterwards (as the roster's other archetypes were).

Target folder: `references/enemy-archetypes/<id>/`

## Spirits

### 1. Mummer (`mummer`)

**Main sheet: the Desert, the dune mummers.**

```
Spirit design reference sheet for a science fiction exploration game: one mummer, a small creature of living ink dressed up in cast-off junk, drawn four times side by side at the same scale on a plain cream background: front view holding a club, side view holding a tent-pole spear, three-quarter view holding a short bow made of a bent spring and a cord, and its club wind-up with both arms raised high and the club drawn back behind its mask, leaning back on its heels so its round belly sticks out. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the mummer is small, only 1.1 metres tall including its mask, the top of its mask level with the traveller's chest, so the traveller is clearly taller than it in every view. Body plan: a squat round body of patched sackcloth and rags stitched together and stuffed with ink, two short bowed stick legs bound in rag with knees bending forward and flat three-toed ink feet, two long thin arms reaching to its knees with clear elbows and three-fingered ink hands gripping the weapon haft, a short neck; its whole head is a big found mask, a dented brass coffee pot turned on its side with two eye holes, two small white eyes shining in the holes. The manifestation: dressed-up ink, black ink seeping from the seams of the sack and dripping from the cuffs, nothing but wet black under the mask. Funny and a little sad, a toy-like folk-play actor, not a goblin, not an orc, no teeth, no ears, no skin. Desert palette: sun-faded indigo and ochre rags, rope bindings, a dented brass mask, a pale driftwood club, the ink black with a violet sheen. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage goblin orc pointed-ears teeth green-skin
```

### 2. Mummer king (`mummerking`)

**Main sheet: the Desert, the dune mummers' king (the troupe's chief).**

```
Spirit design reference sheet for a science fiction exploration game: one mummer king, the big chief of a troupe of small ink creatures dressed up in junk, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view, and its throw wind-up, bending back with both arms raised high holding a small kicking mummer above its crown, ready to hurl it. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the king is 2.6 metres tall and much wider than the traveller. Body plan: a heavy pear-shaped body built of junk, an old wooden barrel for a chest bound with rope and patched sackcloth, two short thick legs wrapped in rags with knees bending forward and wide flat ink feet, two long heavy arms with clear elbows and big three-fingered ink hands; its head is a big copper cauldron worn as a mask with two eye holes and two white eyes shining in them, a wooden cart wheel worn on top as a crown with its spokes sticking up, a long curved brass horn slung on a strap across its back, and a long wooden door beam carried as a club. The small mummer it holds is a squat sack creature with a coffee-pot mask. The manifestation: dressed-up ink, black ink seeping from the barrel's staves and the seams of the rags, nothing but wet black under the cauldron. Comic and grand, a folk-play king, not an ogre, not an orc, no teeth, no skin. Desert palette: sun-faded indigo and ochre rags, a dark oak barrel, a green-patina copper cauldron, a pale cart wheel, a bright brass horn, the ink black with a violet sheen. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels scenery collage ogre orc troll teeth green-skin
```

### 3. Gullet (`gullet`)

**Main sheet: Lorn, the reed gullet.**

```
Spirit design reference sheet for a science fiction exploration game: one gullet, a tall eyeless thirsty creature shaped like a long soft throat, drawn four times side by side at the same scale on a plain cream background: front view, side view, three-quarter view with a small round jade shield clearly visible floating inside its see-through belly, and its gulp wind-up, stretched to its full height and leaning far forward with its mouth flared wide open toward the ground in front of it, and leaves, sand and drops of water flying from the ground INTO its open mouth, curved streaks pointing toward the mouth as it sucks them in like a vacuum, nothing coming out. Beneath the side view its solid black silhouette. A small cloaked human traveller with a round jade fluid backpack stands beside it for scale; the gullet is 2.2 metres tall, only a little taller than the traveller, its mouth just above the traveller's head. Body plan: an upright soft tube made of stacked rings with a clear crease between each ring so it can bend anywhere like a neck, standing on one wide round sucker foot like a snail's, a cuff of six soft flaps around the mouth at the top that open like a flower, a long thin tongue coiled inside the mouth, and a rounded belly bulge halfway up; no eyes, no limbs, no teeth. The manifestation: ink gone glassy with thirst, its skin dark smoked glass you can see into, so whatever it has swallowed glows inside it. Lorn palette: smoked green-black glass-ink skin, reed-stem rings, a cuff of pale water-lily flaps, a warm lamp-yellow glow inside the belly, drips of ink at its foot. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, whimsical technology, clear readable construction, fully visible bodies, evenly spaced views, no lettering --ar 3:2 --no photorealism 3d-render text watermark lettering labels scenery collage teeth eyes worm-head gore
```

## Lab batches (2026-10-27, Gemini and OpenAI, two each, no style references; to pick)

| Prompt | Batches | First look |
|---|---|---|
| `mummer` | `2026-10-27-22-43-54-569b` (first wording), `2026-10-27-22-45-00-4cfa` (scale spelled out) | all on-model (coffee-pot mask, patched sack, stick legs, club up behind the mask); in the first batch every mummer came out taller than the traveller, so the scale line was sharpened; in the second, OpenAI's two have it right (the traveller beside each view), Gemini 1 still too big, Gemini 2 lettered its views |
| `mummerking` | `2026-10-27-22-43-54-3591` | all four on-model and at scale; OpenAI's are the richest drawings, Gemini's upright cart-wheel crown reads best in black |
| `gullet` | `2026-10-27-22-43-54-c4af` (first wording), `2026-10-27-22-45-00-9c69` (scale and suction spelled out) | the body reads (ringed glass tube, flower cuff, the shield seen in its belly), but every one is about twice the asked size, and in most wind-ups the leaves fly out of the mouth instead of in; OpenAI 1 of the second batch shows the suction best |
