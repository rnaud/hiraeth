# Family G in a T-pose: reference prompts (the mummer king, the sentinel, the hulk)

2026-10-31, issue #800, family G of the enemy rebuild (two-legged humanoid foes). Tripo models and rigs best from a clean
T-pose; the author, for the dune mummer, "you can do the t-pose yourself", and for this family, while asleep: keep going
with your own recommendations. So these sheets are generated in the reference lab and picked by the agent (the cleanest:
a true T-pose, the approved design held, nothing baked into the hands), the reason written in each foe's README
(`references/enemy-redesign-2026-10-30/trials/<foe>/README.md`); the author can override. Same template as the dune
mummer's (`docs/design/enemy-tpose-prompts.md`): front and back side by side 16:9, a left profile 1:1, strict T-pose,
empty open hands, flat even light, no props, plain cream ground. Derived work of a picked design, so each run passes the
approved picture as its reference:

```
node scripts/gen-reference.mjs --from docs/design/enemy-tpose-prompts-family-g.md#mummerking-tpose \
  --refs references/enemy-redesign-2026-10-30/keep-mummerking/71c2e792-5ceb-40f7-966d-19b12c1b10a6-1.png
```

## The mummer king

Target folder: `references/enemy-redesign-2026-10-30/keep-mummerking/tpose/`

Approved: `references/enemy-redesign-2026-10-30/keep-mummerking/71c2e792-5ceb-40f7-966d-19b12c1b10a6-1.png`. What every
prompt keeps: a big heavy stout masked chief, one tall rounded pear-shaped body that is head and torso at once with no
neck, muted teal-green, darker below; three short rounded ochre-orange crown rods standing up on the top of its head, the
middle one tallest; a large pale cream oval mask on the upper front with two small black oval eyes; a round terracotta
patch low on the belly; thick muscular teal-green arms; huge blocky cream padded gauntlets with salmon shading; short
thick legs, darker teal below the knee, round terracotta knee pads; cream boots with terracotta cuffs. The paddle club is
left out.

### 1. Front and back (`mummerking-tpose`)

**Main: front view and back view side by side, arms straight out.**

```
Character model sheet for 3D modelling and rigging, two full-body views side by side on a plain light cream background: on the left the front view, on the right the back view, both the same size and standing on the same level line. The exact creature of the reference image, the mummer king, with the same proportions, colours and details: a big heavy stout masked chief, one tall rounded pear-shaped body that is head and torso at once with no neck, muted teal green, a little darker low on the belly; three short rounded ochre-orange crown rods standing straight up on the top of its head, the middle one the tallest; a large smooth pale cream oval mask on the upper front of the body with two small black oval eyes and nothing else on it; a round terracotta patch low on the front of the belly; thick muscular teal-green arms; huge blocky cream padded gauntlets with salmon shading on the knuckles, the hands broad and open; short thick legs, darker teal below the knee, with round terracotta knee pads; cream boots with terracotta cuffs. It stands in a strict T-pose: both arms held straight out to the sides at shoulder height, perfectly horizontal, palms facing down, hands open, flat and empty, fingers together; legs straight and a little apart, feet flat and pointing forward. The back view shows the smooth back of the pear body without the mask, the crown rods from behind, the backs of the arms, gauntlets and boots. Empty hands, no club, no paddle, no weapon, no props. Even flat lighting, no cast shadows, no ground shadow, orthographic view with no perspective, the whole body in frame with a margin all round, clean fine ink contours and flat colours as in the reference --ar 16:9 --no club paddle weapon stick props shadow ground-shadow perspective background-scenery text lettering labels watermark extra-limbs
```

### 2. Side view (`mummerking-tpose-side`)

**Main: the same T-pose seen from the side.**

```
Character model sheet for 3D modelling and rigging, one full-body side view (left profile) on a plain light cream background. The exact creature of the reference image, the mummer king, with the same proportions, colours and details: a big heavy stout masked chief, one tall rounded pear-shaped body that is head and torso at once with no neck, muted teal green, a little darker low on the belly; three short rounded ochre-orange crown rods standing straight up on the top of its head; a large smooth pale cream oval mask on the upper front of the body with two small black oval eyes, seen edge-on in profile; a round terracotta patch low on the front of the belly; thick muscular teal-green arms; huge blocky cream padded gauntlets with salmon shading; short thick legs, darker teal below the knee, with round terracotta knee pads; cream boots with terracotta cuffs. It stands in a strict T-pose: both arms held straight out to the sides at shoulder height, perfectly horizontal, palms facing down, hands open and empty, so from the side the near arm points straight at the viewer and is seen end-on; legs straight and a little apart, feet flat and pointing forward. Show the depth and curve of the pear body, how far the mask and the belly stand forward and how the boots reach forward. Empty hands, no club, no paddle, no weapon, no props. Even flat lighting, no cast shadows, no ground shadow, orthographic view with no perspective, the whole body in frame with a margin all round, clean fine ink contours and flat colours as in the reference --ar 1:1 --no club paddle weapon stick props shadow ground-shadow perspective background-scenery text lettering labels watermark extra-limbs
```

## The sentinel

Target folder: `references/enemy-redesign-2026-10-30/sentinel/tpose/`

Approved: `references/enemy-redesign-2026-10-30/sentinel/395884ff-9eec-4903-ba5c-e910310ff88d-0.png` (the cistern
keeper). What every prompt keeps: a squat heavy ceramic robot; a big rounded barrel torso of pale pink ceramic with one
horizontal seam round its middle; a short upright cylinder head set on the top front of the torso, a black visor slit
across it with one small amber eye; dark purple-black ball joints at the shoulders, elbows and knees; pale pink ceramic
cylinders for the upper arms, forearms and thighs; a dark slate-teal pelvis band; slate-blue cylinder shin guards with a
band; broad flat pointed slate-blue feet; dark grey fists. The shield and the blade are left out.

### 3. Front and back (`sentinel-tpose`)

**Main: front view and back view side by side, arms straight out.**

```
Character model sheet for 3D modelling and rigging, two full-body views side by side on a plain light sand background: on the left the front view, on the right the back view, both the same size and standing on the same level line. The exact robot of the reference image, the ceramic cistern keeper, with the same proportions, colours and details: a squat heavy ceramic robot; a big rounded barrel torso of pale pink ceramic with one horizontal seam line round its middle; a short upright cylinder head set on the top front of the torso, with a black visor slit across it and one small amber eye in the slit; dark purple-black ball joints at the shoulders, the elbows and the knees; pale pink ceramic cylinders for the upper arms, the forearms and the thighs; a dark slate-teal band of a pelvis under the barrel; slate-blue cylinder shin guards with a band round them; broad flat pointed slate-blue feet; dark grey robot hands. It stands in a strict T-pose: both arms held straight out to the sides at shoulder height, perfectly horizontal, palms facing down, hands open, flat and empty; legs straight and a little apart, feet flat and pointing forward. The back view shows the smooth back of the barrel and the head without the eye, the backs of the joints, arms and legs. Empty hands, no shield, no spear, no blade, no weapon, no props. Even flat lighting, no cast shadows, no ground shadow, orthographic view with no perspective, the whole body in frame with a margin all round, clean fine ink contours and flat colours as in the reference --ar 16:9 --no shield spear blade weapon props shadow ground-shadow perspective background-scenery text lettering labels watermark extra-limbs
```

### 4. Side view (`sentinel-tpose-side`)

**Main: the same T-pose seen from the side.**

```
Character model sheet for 3D modelling and rigging, one full-body side view (left profile) on a plain light sand background. The exact robot of the reference image, the ceramic cistern keeper, with the same proportions, colours and details: a squat heavy ceramic robot; a big rounded barrel torso of pale pink ceramic with one horizontal seam line round its middle; a short upright cylinder head set on the top front of the torso, with a black visor slit and one small amber eye facing forward; dark purple-black ball joints at the shoulders, the elbows and the knees; pale pink ceramic cylinders for the upper arms, the forearms and the thighs; a dark slate-teal pelvis band; slate-blue cylinder shin guards with a band; broad flat pointed slate-blue feet reaching forward; dark grey robot hands. It stands in a strict T-pose: both arms held straight out to the sides at shoulder height, perfectly horizontal, palms facing down, hands open and empty, so from the side the near arm points straight at the viewer and is seen end-on; legs straight and a little apart, feet flat and pointing forward. Show the depth of the barrel, where the head sits on its front and how the feet reach forward. Empty hands, no shield, no spear, no blade, no weapon, no props. Even flat lighting, no cast shadows, no ground shadow, orthographic view with no perspective, the whole body in frame with a margin all round, clean fine ink contours and flat colours as in the reference --ar 1:1 --no shield spear blade weapon props shadow ground-shadow perspective background-scenery text lettering labels watermark extra-limbs
```

### 4b. Side view, the arms end-on (`sentinel-tpose-side2`)

**Main: the side view again (the first run drew the near arm pointing backwards), with the picked front sheet as a second reference.**

```
Character model sheet for 3D modelling and rigging, one full-body side view (left profile, facing left) on a plain light sand background. The exact robot of the reference images, the ceramic cistern keeper, seen exactly from its left side: a squat heavy ceramic robot; a big rounded barrel torso of pale pink ceramic with one horizontal seam line round its middle; a short upright cylinder head on the top front of the torso, the black visor slit and its one small amber eye at the left edge facing left; a dark slate-teal pelvis band; pale pink thigh cylinders; dark purple-black ball knees; slate-blue cylinder shin guards; broad flat pointed slate-blue feet pointing left. It stands in the same strict T-pose as the front view: both arms stick straight out sideways from the shoulders, one toward the viewer and one away, so in this side view the near arm is seen exactly end-on as a circle: only the round purple-black shoulder ball and the round end of the near arm and its dark grey fist, overlapping the side of the barrel at shoulder height; no arm reaches forward or backward, nothing sticks out to the left or right of the body at shoulder height. Legs straight, feet flat. Empty hands, no shield, no spear, no blade, no weapon, no props. Even flat lighting, no cast shadows, no ground shadow, orthographic view with no perspective, the whole body in frame with a margin all round, clean fine ink contours and flat colours as in the reference --ar 1:1 --no shield spear blade weapon props arm-pointing-forward arm-pointing-backward shadow ground-shadow perspective background-scenery text lettering labels watermark extra-limbs
```

## The hulk

Target folder: `references/enemy-redesign-2026-10-30/hulk/tpose/`

Approved: `references/enemy-redesign-2026-10-30/hulk/69ae4d9f-9bdb-4eab-998a-08bdf543617d-2.png` (the root crusher).
What every prompt keeps: an enormous heavy hunched brute, muted teal-green skin; a massive rounded back and shoulders; a
small rounded head low at the front under the shoulders with two short black slit eyes and a dark mouth below; a pale
cream chest and belly; huge thick arms, long, the forearms ending in big rust-red knuckled fists; short thick legs on
broad feet with terracotta toes. In the T-pose the hunch is straightened as far as it goes: the arms out, the head forward.

### 5. Front and back (`hulk-tpose`)

**Main: front view and back view side by side, arms straight out.**

```
Character model sheet for 3D modelling and rigging, two full-body views side by side on a plain light cream background: on the left the front view, on the right the back view, both the same size and standing on the same level line. The exact creature of the reference image, the root crusher, with the same proportions, colours and details: an enormous heavy brute with muted teal-green skin and smooth simple forms; a massive rounded back and broad shoulders; a small rounded head low at the front between the shoulders, with two short black slit eyes and a dark mouth under them, no neck; a pale cream chest and belly; huge thick long arms, the forearms ending in big rust-red knuckled hands; short very thick legs on broad feet with terracotta toes. It stands in a strict T-pose: both arms held straight out to the sides at shoulder height, perfectly horizontal, palms facing down, hands open, flat and empty, fingers together; legs straight and a little apart, feet flat and pointing forward; the head facing forward. The back view shows the smooth broad teal back, the backs of the arms, hands and legs. Empty hands, no rock, no root, no weapon, no props. Even flat lighting, no cast shadows, no ground shadow, orthographic view with no perspective, the whole body in frame with a margin all round, clean fine ink contours and flat colours as in the reference --ar 16:9 --no rock root weapon props shadow ground-shadow perspective background-scenery text lettering labels watermark extra-limbs
```

### 6. Side view (`hulk-tpose-side`)

**Main: the same T-pose seen from the side.**

```
Character model sheet for 3D modelling and rigging, one full-body side view (left profile) on a plain light cream background. The exact creature of the reference image, the root crusher, with the same proportions, colours and details: an enormous heavy brute with muted teal-green skin and smooth simple forms; a massive rounded back and broad shoulders; a small rounded head low at the front of the shoulders, with two short black slit eyes and a dark mouth, seen in profile; a pale cream chest and belly bulging forward; huge thick long arms ending in big rust-red knuckled hands; short very thick legs on broad feet with terracotta toes. It stands in a strict T-pose: both arms held straight out to the sides at shoulder height, perfectly horizontal, palms facing down, hands open and empty, so from the side the near arm points straight at the viewer and is seen end-on; legs straight and a little apart, feet flat and pointing forward. Show the depth of the chest and belly, the rounded back and how far forward the head sits. Empty hands, no rock, no root, no weapon, no props. Even flat lighting, no cast shadows, no ground shadow, orthographic view with no perspective, the whole body in frame with a margin all round, clean fine ink contours and flat colours as in the reference --ar 1:1 --no rock root weapon props shadow ground-shadow perspective background-scenery text lettering labels watermark extra-limbs
```
