# The prowler (pod stalker) in a T-pose: reference prompts

2026-10-31, issue #800, family H (the two-legged foes). Tripo models and rigs a biped best from a clean T-pose (the dune
mummer's route, `docs/design/enemy-tpose-prompts.md`). These prompts redraw the approved prowler
(`references/enemy-redesign-2026-10-30/prowler/5d011893-58f1-4c33-a34d-ac8df1a99842-2.png`, the pod stalker) as a model
sheet. Derived work of a picked design, so each run passes that picture as its reference:

```
node scripts/gen-reference.mjs --from docs/design/enemy-tpose-prowler-prompts.md#prowler-tpose \
  --refs references/enemy-redesign-2026-10-30/prowler/5d011893-58f1-4c33-a34d-ac8df1a99842-2.png
```

Target folder: `references/enemy-redesign-2026-10-30/prowler/tpose/`

What every prompt keeps from the approved picture: one heavy rounded body, the big blunt head running straight on from
it with no neck, held forward; dusky mauve-brown skin with fine wrinkle lines; a wide pale cream muzzle wrapping the
lower front of the head with one thin black mouth line; two small round black dot eyes high on the head; a sage-green
belly from the throat down between the legs; a thick tapering tail to the ground behind; long heavy arms with broad
short-fingered hands; short thick legs on broad padded feet with three big rounded toes, wrinkled folds at the wrists
and ankles. The hunch is the game's (its clips lean it forward): the sheets stand it up so the arms can be read.

### 1. Front and back (`prowler-tpose`)

**Main: front view and back view side by side, arms straight out.**

```
Character model sheet for 3D modelling and rigging, two full-body views side by side on a plain light cream background: on the left the front view, on the right the back view, both the same size and standing on the same level line. The exact creature of the reference image, the pod stalker, with the same proportions, colours and details: one heavy rounded body with a big blunt rounded head running straight on from it with no neck; dusky mauve-brown skin with a few fine wrinkle lines; a wide smooth pale cream muzzle wrapping the lower front of the head with one thin black mouth line across it; two small round black dot eyes set high and wide on the head and nothing else on the face; a smooth sage-green belly from the throat down the chest to between the legs; a thick tapering tail behind it resting on the ground, its underside sage green; long heavy arms; broad hands with short thick blunt fingers; short thick legs on broad padded feet with three big rounded toes, wrinkled folds at the wrists and ankles. It stands upright in a strict T-pose: its back straight, both arms held straight out to the sides at shoulder height, perfectly horizontal, palms facing down, hands open and empty with the fingers straight and apart; legs straight and a little apart, feet flat and pointing forward. The back view shows the smooth mauve-brown back and the back of the head, the tail running down to the ground behind the legs, the backs of the arms, hands and feet. Empty hands, nothing held, no weapon, no props. Even flat lighting, no cast shadows, no ground shadow, orthographic view with no perspective, the whole body and tail in frame with a margin all round, clean fine ink contours and flat colours as in the reference --ar 16:9 --no weapon blade stick props shadow ground-shadow perspective background-scenery text lettering labels watermark extra-limbs
```

### 2. Side view (`prowler-tpose-side`)

**Main: the same T-pose seen from the side.**

```
Character model sheet for 3D modelling and rigging, one full-body side view (left profile) on a plain light cream background. The exact creature of the reference image, the pod stalker, with the same proportions, colours and details: one heavy rounded body with a big blunt rounded head running straight on from it with no neck, the head carried forward of the chest; dusky mauve-brown skin with a few fine wrinkle lines; a wide smooth pale cream muzzle wrapping the lower front of the head with one thin black mouth line, seen in profile; one small round black dot eye high on the head; a smooth sage-green belly from the throat down the chest to between the legs; a thick tapering tail behind it curving down to rest on the ground, its underside sage green; long heavy arms; broad hands with short thick blunt fingers; short thick legs on broad padded feet with three big rounded toes, wrinkled folds at the wrists and ankles. It stands upright in a strict T-pose: its back straight, both arms held straight out to the sides at shoulder height, perfectly horizontal, palms facing down, hands open and empty, so from the side the near arm points straight at the viewer and is seen end-on; legs straight and a little apart, feet flat and pointing forward. Show the depth of the heavy body, how far the head and muzzle stand forward and how long the tail reaches back along the ground. Empty hands, nothing held, no weapon, no props. Even flat lighting, no cast shadows, no ground shadow, orthographic view with no perspective, the whole body and tail in frame with a margin all round, clean fine ink contours and flat colours as in the reference --ar 1:1 --no weapon blade stick props shadow ground-shadow perspective background-scenery text lettering labels watermark extra-limbs
```
