# The warlord (resonator chief) in a T-pose: reference prompts

2026-10-31, issue #800, family H (the two-legged foes). Tripo models and rigs a biped best from a clean T-pose (the dune
mummer's route, `docs/design/enemy-tpose-prompts.md`). These prompts redraw the approved warlord
(`references/enemy-redesign-2026-10-30/warlord/b7d9aa56-69bf-44a7-becc-6a2e9737b4bf-2.png`, the resonator chief) as a
model sheet. Derived work of a picked design, so each run passes that picture as its reference:

```
node scripts/gen-reference.mjs --from docs/design/enemy-tpose-warlord-prompts.md#warlord-tpose \
  --refs references/enemy-redesign-2026-10-30/warlord/b7d9aa56-69bf-44a7-becc-6a2e9737b4bf-2.png
```

Target folder: `references/enemy-redesign-2026-10-30/warlord/tpose/`

What every prompt keeps from the approved picture: one big egg-shaped body that is head and torso at once, no neck,
brick red-orange shading to a deep rust at the bottom; two small rounded ear knobs at the top of its sides; two narrow
heavy-lidded black slit eyes; a big smooth pale cream oval throat chamber over the lower face and upper chest; a
lighter salmon-orange belly below it; thick red-orange arms with big pale cream four-fingered hands; short thick legs in
flat oval plum-purple shoes. The forked iron staff is left out: Tripo should model empty hands (the game builds the
staff on the hand).

### 1. Front and back (`warlord-tpose`)

**Main: front view and back view side by side, arms straight out.**

```
Character model sheet for 3D modelling and rigging, two full-body views side by side on a plain light cream background: on the left the front view, on the right the back view, both the same size and standing on the same level line. The exact creature of the reference image, the resonator chief, with the same proportions, colours and details: one big rounded egg-shaped body that is head and torso at once with no neck, brick red-orange shading to a deep rust red at the bottom; two small rounded ear knobs standing out at the top of its sides; two narrow heavy-lidded black slit eyes high on the front; a big smooth pale cream oval throat chamber covering the lower face and upper chest; a lighter salmon-orange belly patch below it; thick red-orange arms; big pale cream four-fingered hands like thick gloves; short thick red-orange legs in flat oval plum-purple shoes. It stands in a strict T-pose: both arms held straight out to the sides at shoulder height, perfectly horizontal, palms facing down, hands open and empty with the fingers straight and together; legs straight and a little apart, feet flat and pointing forward. The back view shows the smooth red-orange back of the egg body without the throat chamber, the backs of the ear knobs, arms, hands and shoes. Empty hands, nothing held, no staff, no weapon, no props. Even flat lighting, no cast shadows, no ground shadow, orthographic view with no perspective, the whole body in frame with a margin all round, clean fine ink contours and flat colours as in the reference --ar 16:9 --no staff fork weapon stick props shadow ground-shadow perspective background-scenery text lettering labels watermark extra-limbs
```

### 2. Side view (`warlord-tpose-side`)

**Main: the same T-pose seen from the side.** (Every candidate drew the near hand end-on as a fist; a retry asking for
"a flat open hand, never a fist" turned the arms forward instead, so the pick is from this prompt: `tpose/manifest.json`.)

```
Character model sheet for 3D modelling and rigging, one full-body side view (left profile) on a plain light cream background. The exact creature of the reference image, the resonator chief, with the same proportions, colours and details: one big rounded egg-shaped body that is head and torso at once with no neck, brick red-orange shading to a deep rust red at the bottom; a small rounded ear knob standing out at the top of its side; a narrow heavy-lidded black slit eye high on the front; a big smooth pale cream oval throat chamber swelling forward over the lower face and upper chest, seen in profile; a lighter salmon-orange belly below it; thick red-orange arms; big pale cream four-fingered hands like thick gloves; short thick red-orange legs in flat oval plum-purple shoes. It stands in a strict T-pose: both arms held straight out to the sides at shoulder height, perfectly horizontal, palms facing down, hands open and empty, so from the side the near arm points straight at the viewer and is seen end-on; legs straight and a little apart, feet flat and pointing forward. Show the depth and curve of the egg body, how far the throat chamber and belly stand forward and how the shoes reach forward. Empty hands, nothing held, no staff, no weapon, no props. Even flat lighting, no cast shadows, no ground shadow, orthographic view with no perspective, the whole body in frame with a margin all round, clean fine ink contours and flat colours as in the reference --ar 1:1 --no staff fork weapon stick props shadow ground-shadow perspective background-scenery text lettering labels watermark extra-limbs
```
