# The dune mummer in a T-pose: reference prompts

2026-10-30, issue #800. Phase 2 of the enemy rebuild (`docs/handoffs/enemy-rebuild-2026-10-30.md`) builds the dune
mummer twice, by code and by Tripo, from the same approved picture. Tripo models and rigs best from a clean T-pose, and
the author: "you can do the t-pose yourself". These prompts redraw the approved design
(`references/enemy-redesign-2026-10-30/keep-mummer/ad94a6b0-55ba-461e-9577-d745036565ae-1.png`) as a model sheet.
This is derived work of a picked design, so each run passes that picture as its reference:

```
node scripts/gen-reference.mjs --from docs/design/enemy-tpose-prompts.md#mummer-tpose \
  --refs references/enemy-redesign-2026-10-30/keep-mummer/ad94a6b0-55ba-461e-9577-d745036565ae-1.png
```

Target folder: `references/enemy-redesign-2026-10-30/keep-mummer/tpose/`

What every prompt keeps from the approved picture: one rounded gourd-shaped body that is head and torso at once, no
neck, sage green shading to darker olive green; a smooth pale cream oval mask on its upper front with two short
narrow black slit eyes and no other features; a flat terracotta-salmon rectangular patch on the chest under the mask;
short sage-green sleeves; big rust-orange padded gauntlets with a dark band at the wrist and broad mitten hands; short
legs in rust-orange boots with sand-coloured toe caps. The club is left out: Tripo should model empty hands.

### 1. Front and back (`mummer-tpose`)

**Main: front view and back view side by side, arms straight out.**

```
Character model sheet for 3D modelling and rigging, two full-body views side by side on a plain light cream background: on the left the front view, on the right the back view, both the same size and standing on the same level line. The exact creature of the reference image, the dune mummer, with the same proportions, colours and details: one rounded gourd-shaped body that is head and torso at once with no neck, sage green shading to darker olive green; a smooth pale cream oval mask on the upper front of the body with two short narrow black slit eyes and nothing else on it; a flat terracotta-salmon rectangular patch on the chest just under the mask; short sage-green sleeves; big rust-orange padded gauntlets with a dark band at the wrist and broad mitten-like hands; short sturdy legs in rust-orange boots with sand-coloured toe caps. It stands in a strict T-pose: both arms held straight out to the sides at shoulder height, perfectly horizontal, palms facing down, hands open and empty; legs straight and a little apart, feet flat and pointing forward. The back view shows the smooth back of the gourd body without the mask, the backs of the sleeves, gauntlets and boots. Empty hands, no club, no weapon, no props. Even flat lighting, no cast shadows, no ground shadow, orthographic view with no perspective, the whole body in frame with a margin all round, clean fine ink contours and flat colours as in the reference --ar 16:9 --no club weapon stick props shadow ground-shadow perspective background-scenery text lettering labels watermark extra-limbs
```

### 2. Side view (`mummer-tpose-side`)

**Main: the same T-pose seen from the side.**

```
Character model sheet for 3D modelling and rigging, one full-body side view (left profile) on a plain light cream background. The exact creature of the reference image, the dune mummer, with the same proportions, colours and details: one rounded gourd-shaped body that is head and torso at once with no neck, sage green shading to darker olive green; a smooth pale cream oval mask on the upper front of the body with two short narrow black slit eyes, seen edge-on in profile; a flat terracotta-salmon rectangular patch on the chest just under the mask; short sage-green sleeves; big rust-orange padded gauntlets with a dark band at the wrist and broad mitten-like hands; short sturdy legs in rust-orange boots with sand-coloured toe caps. It stands in a strict T-pose: both arms held straight out to the sides at shoulder height, perfectly horizontal, palms facing down, hands open and empty, so from the side the near arm points straight at the viewer and is seen end-on; legs straight and a little apart, feet flat and pointing forward. Show the depth and curve of the gourd body, how far the mask stands forward and how the boots reach forward. Empty hands, no club, no weapon, no props. Even flat lighting, no cast shadows, no ground shadow, orthographic view with no perspective, the whole body in frame with a margin all round, clean fine ink contours and flat colours as in the reference --ar 1:1 --no club weapon stick props shadow ground-shadow perspective background-scenery text lettering labels watermark extra-limbs
```
