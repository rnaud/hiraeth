# The traveller's outfits: reference prompts

2026-10-19, issue #540. The author: "create more outfits for the traveler, create 5 references yourself
(surprise me) and then pick one and build it on blender so we can try to swap outfits in game". Five outfits
for the same young man, each a different place and job from the worlds he visits, each clearly unlike his own
clothes (the coral open overshirt over a cream tee, cream cropped trousers, sand boots, a tan neckerchief).
Plain text prompts for the reference lab, sent with his own turnaround as the base so he stays him:

    node scripts/gen-reference.mjs --from docs/design/traveller-outfit-prompts.md#<id> \
      --refs lore/references/traveller/reference-1.jpg --ar 16:9 --n 2

Target folder: `references/characters/traveller-outfits/<id>/`

What every prompt keeps: the same slim young man as the reference (messy short black curly hair, warm brown
skin, thin face), his hair and face unchanged and uncovered (no hat, hood up, goggles or mask, so the outfit can
be swapped on the game's model without touching his head), a front, side and back view at the same scale on a
plain cream background, the house style, clothes with clear shapes and colour blocks that read from above at play
distance.

### 1. The pearl diver (`pearl-diver`)

```
Character turnaround model sheet for a science fiction exploration game: the same slim young man as in the reference picture, same face and messy short black curly hair, uncovered, wearing a pearl diver's working suit instead of his usual clothes, drawn three times full-body side by side at the same scale on a plain cream background: front view, side view, back view, standing straight, arms a little away from the body. A close-fitting one-piece diving suit of deep sea-blue rubberised canvas with short sleeves and knees, pale cream stitched panels down the sides and across the chest, a low round brass collar ring at the neck, a broad cream webbing belt with two small brass-clasped pouches and a coiled line at the hip, bare forearms, rubber cuffs at the elbows, tall smooth sea-green rubber boots with a brass buckle each. Simple, fitted, game-ready clothing with clear colour blocks that read from above. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels hat hood helmet goggles mask cape
```

### 2. The lamplighter (`lamplighter`)

```
Character turnaround model sheet for a science fiction exploration game: the same slim young man as in the reference picture, same face and messy short black curly hair, uncovered, wearing a night lamplighter's uniform instead of his usual clothes, drawn three times full-body side by side at the same scale on a plain cream background: front view, side view, back view, standing straight, arms a little away from the body. A short quilted indigo jacket ending at the hips, its quilting in wide horizontal bands, a stand-up collar and cuffs piped in lamp-yellow, a row of brass toggles down the front, a lamp-yellow armband on the left sleeve, slim charcoal trousers tucked into tall black boots with a turned-down cuff, short brown leather gloves, a small brass oil can hanging from a strap at the hip. Simple, fitted, game-ready clothing with clear colour blocks that read from above. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, deep indigo and lamp yellow, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels hat hood helmet goggles mask cape
```

### 3. The glider pilot (`glider-pilot`)

```
Character turnaround model sheet for a science fiction exploration game: the same slim young man as in the reference picture, same face and messy short black curly hair, uncovered, wearing a glider pilot's flying clothes instead of his usual clothes, drawn three times full-body side by side at the same scale on a plain cream background: front view, side view, back view, standing straight, arms a little away from the body. A cropped mustard-yellow flight jacket of waxed canvas with a wide cream fleece collar lying flat on the shoulders, ribbed olive cuffs and waistband, two big patch pockets, a faded sky-blue roundel stitched on the back; olive jodhpur trousers full at the thigh and narrow below the knee, cream cloth puttees wound round the shins, short brown lace-up boots, a slim brown leather harness strap across the chest. Simple, fitted, game-ready clothing with clear colour blocks that read from above. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, mustard, olive and sky blue, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels hat hood helmet goggles mask cape scarf
```

### 4. The salt pilgrim (`salt-pilgrim`)

```
Character turnaround model sheet for a science fiction exploration game: the same slim young man as in the reference picture, same face and messy short black curly hair, uncovered, wearing a desert pilgrim's travelling robes instead of his usual clothes, drawn three times full-body side by side at the same scale on a plain cream background: front view, side view, back view, standing straight, arms a little away from the body. A long sleeveless white linen over-robe open at the front and reaching the shins, edged with a band of small turquoise and terracotta geometric stitching, a hood lying down flat on his back, under it a wrapped saffron tunic with long sleeves and a wide sash of faded rose tied at the waist, loose pale trousers gathered at the ankles, flat woven sandals with straps up the ankle, a string of small salt-white beads at the wrist. Game-ready clothing with clear colour blocks that read from above. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, white, saffron and turquoise, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels hat hood-up helmet goggles mask
```

### 5. The moss gardener (`moss-gardener`)

```
Character turnaround model sheet for a science fiction exploration game: the same slim young man as in the reference picture, same face and messy short black curly hair, uncovered, wearing a terrace gardener's work clothes instead of his usual clothes, drawn three times full-body side by side at the same scale on a plain cream background: front view, side view, back view, standing straight, arms a little away from the body. A fitted moss-green canvas waistcoat with many small pockets and a pencil in one, buttoned to the chest, over a short-sleeved ochre shirt; knee-length rust-brown shorts with deep side pockets and a canvas tool loop, thick cream wool socks folded over at mid-calf, chunky dark brown clogs-like work boots, cloth patches of faded turquoise at the knees and elbows, a short garden knife in a sheath at the belt. Simple, fitted, game-ready clothing with clear colour blocks that read from above. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, moss green, ochre and rust, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels hat hood helmet goggles mask cape
```
