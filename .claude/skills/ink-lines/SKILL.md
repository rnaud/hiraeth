---
name: ink-lines
description: Evaluate Hiraeth's ink line rendering at every distance and resolution — the post-process outlines, creases, colour and shadow edges, the hatching and spot blacks (src/post.js), line weights by material (LINE), the grass's soft ink, the fluid blade's and crystals' outline-only paths, the traveller's drawn face (src/characters/head-ink.js) and the foes' surfaces — from a fixed set of scenes (plants near to far, the traveller's face at 1, 4, 10 and 25 m, a pack of foes, a temple hall, a town far off) shot at 1080p, Retina, 720p, Handheld, its dynamic floor, Steam Deck and a phone, with measured checks (line width against the object's size on screen, the share of a plant or a person that is ink, the eyes against the cheek, shimmer half a pixel over) and a rubric, and write docs/audits/ink-lines-v<version>.md. Use when lines look too heavy or too faint far away or at a low resolution, when black blobs, black eyes or grey busy foliage appear, after touching the ink pass, a material's line or the face ink, or before a release.
---

# Ink lines at every distance and resolution

The author's complaint that started it (October 2026): "Lines are too big for some vegetation, and the character's eyes
now render almost like black eyes when looking at him from afar … it should look good at all distances (the biggest
problem we have), and at lower resolutions." A pen line drawn at a fixed width is right on a figure that fills the
screen and wrong on the same figure 40 px tall: there it is a third of what it draws, and a plant made of fifty leaves
becomes a black mass. Moebius' far figures and far trees are a few thin strokes and flat colour. This audit measures
that, scene by scene and resolution by resolution, and the report is `docs/audits/ink-lines-v<version>.md`, compared
with the last.

Read first:
- `docs/systems/rendering.md`: "Lines by material", "Thin bars at any distance", "Stable in motion", "Ink lines by size
  on screen" (what this audit fixed first), the debug views (14: the lines as drawn);
- `src/post.js` block 1 (`inkLines`, the weight by depth, the people far away, 1b the line by material), the grass's soft
  ink at the end of the composite, 3b the crease shading;
- `docs/systems/faces.md` (the traveller's drawn face, detail by size) and `src/characters/head-ink.js`;
- `docs/systems/materials.md` (`LINE`, `line`/`lineTint`, the `leaves` pattern) and `docs/systems/foes.md` (foe surfaces);
- the last `docs/audits/ink-lines-v*.md`.

**Rules for every run:** muted Chrome (`--mute-audio`, volumes 0), never port 5173 (the author's dev server: the script
refuses it), the real GPU, one headless Chrome on the machine at a time (the scripts wait for others to finish; an
orphan, its runner gone for over 5 minutes, is not waited for; never kill another agent's), enemies off except in the
pack. Delete the captures when done: a full matrix is ~250 MB.

**Same picture every run**: the game's clock is taken over (frames only when stepped, from a fixed hour), each
picture of a scene is drawn again with `renderFrame()` and nothing moved (the final frame, the debug views and the
masks are one instant), and the shaders' clock (`uTime`: the plants' sway, the clouds, the lines' boil) is held at one
value. A plant scene run twice differs in 0.07 % of its pixels. What still moves between runs: the traveller's idle
and anything animated on the CPU (flags, smoke): compare those by their measures and by eye, not pixel for pixel.
To compare two builds, capture the one before with its files swapped in and the same command (debug 14 is needed in
both: carry its two lines into the old `post.js`).

## 1. The matrix

```sh
PORT=5617 node .claude/skills/ink-lines/capture.mjs <scratch>/ink [--res desk1080,handheld] [--scenes portrait-25,veg-far] [--tag before]
node .claude/skills/ink-lines/report.mjs <scratch>/ink/report.json [--before <scratch>/ink-before/report.json] [--out docs/audits/ink-lines-v<version>.md]
```

**Resolutions** (`RESOLUTIONS` in capture.mjs; CSS size, device pixel ratio, preset, render scale held fixed):

| key | what | render size |
|---|---|---|
| `desk1080` | 1920 × 1080, Medium: **the reference** (the look the author approved) | 1920 × 1080 |
| `desk1080x2` | 1920 × 1080 at DPR 2, High (scale 1 on HiDPI) | 3840 × 2160 |
| `p720` | 1280 × 720, Medium | 1280 × 720 |
| `handheld` | the Handheld preset (Retroid), 1280 × 720 at 0.75 | 960 × 540 |
| `handheld-low` | Handheld at its dynamic floor, 0.5 | 640 × 360 |
| `deck` | Steam Deck, 1280 × 800 | 1280 × 800 |
| `phone` | a phone, 390 × 844 held sideways, DPR 3, Handheld | 1899 × 877 |

**Scenes** (`SCENES`): `portrait-1/4/10/25` (the traveller facing the camera in the desert at 1, 4, 10, 25 m),
`veg-near/mid/far/farthest` (Edena's tallest plant near the start at 5, 18, 55, 120 m), `canopy-mid/far` (the Spheres'
`leaves` canopies at 25 and 80 m), `pack` (three blots and a makers' machine in the Arena at 14 m), `temple-hall` (the
desert temple's arrival), `town-far` (the start of the bench's ride to Qanat, the town up the valley). The portraits
are aimed from the head's own skinning (its face, not his heading), the camera kept over the ground; a 1 m portrait
frames head and shoulders (face ~125 px tall at desk1080), 4 m ~22 px, 10 m ~9 px, 25 m ~3 px. Each picture is shot four ways: the final frame,
debug 14 (the lines as drawn, after the fog, the haze and the grass's and lights' own fades), the albedo (debug 2) with
and without the object (its mask, without its shadow), and debug 14 again with the camera half a render pixel to the side.

## 2. The measures (`scripts/ink-lines/lib.mjs`, `tests/ink-lines.test.js`)

- **Line width** (`strokeWidth`): for each inked pixel the shorter of its run across and its run down; the median and the
  90th percentile, px of the screenshot, and the share in runs of 5 px or more both ways (blobs, not lines). Read it
  **against the object's height on screen** (`extent` of the mask): on a 30 px plant a 3 px line is a tenth of it.
- **Ink share** (`inkShare`): the ink inside the object's mask grown by the line's reach (2 px × DPR), weighted.
- **Near-black share** (`darkShare`): the share of the same area under luminance 48 in the final frame: the lines, the
  spot blacks, crevices and black eyes together, as a player sees them.
- **The eyes** (`eyeMarks`): each eye projected from the head's rest coordinates (`HEAD_INK.eye`, `HEAD_FIT`) to the
  screen with its drawn opening (half width, half height), a cheek point under it, and the face's height (brow to
  chin). The eye's dark against the cheek (∑ max(0, cheek − L) / cheek over a box 1.4 × the opening and half a pixel):
  over the face's area it is the eye's **share** of the face, which a drawn eye keeps at every size: read as × the
  1 m portrait at desk1080 (1: in proportion; a black dot on a small face is 3-20×). Over the opening (at least a
  pixel) its **density**. And the **darkest** eye pixel against the cheek (0 black: the "black eyes" of a small face).
  Under a 12 px face the eye is a pixel or less and its share is a pixel's rounding: there the darkest pixel decides.
- **Shimmer** (`shimmer`): debug 14 a half render pixel apart: the mean change over the ink (a line that slides changes
  a little, one at the edge of its threshold comes and goes) and the share of ink pixels that pop.
- **Frame ink**: the share of the whole frame that is ink (a busy view at low resolution goes grey with lines).

## 3. The rubric (`RUBRIC`, `grade`)

Each check passes (1), is borderline (0.5) or fails (0); a picture scores 5 × their mean.

| check | applies to | passes at or under | fails at or over |
|---|---|---|---|
| plant ink share | foliage | 22 % near, 18 % far | 34 % near, 30 % far |
| plant near-black share | foliage | 16 % | 30 % |
| line width on a thing under 40 px | plants, people, foes | 2 px median | 3.5 px |
| line p90 against that height | plants, people, foes | 6 % | 12 % |
| person's near-black share | the traveller (not foes: the blots are ink by design) | 18 % | 32 % |
| eye density | portraits, an opening 1.5 px tall or more | 0.9 | 1.3 |
| eyes' share of the face against the 1 m reference | portraits, a face of 12 px or more | × 1.5 | × 2.5 |
| 1 − the darkest eye pixel against the cheek | portraits, a face under 12 px | 0.6 | 0.8 |
| shimmer change / pops | every picture | 0.35 / 12 % | 0.55 / 25 % |
| frame ink | views | 9 % | 16 % |

Numbers say where to look: open the worst pictures (the report lists them) side by side with the same scene at
`desk1080`, and crop the small things up 4× (nearest neighbour) before judging. A fix must leave `desk1080` at play
distance (`portrait-4`, `veg-near`, `pack`, `temple-hall`) as it was: compare those pictures before and after pixel
for pixel (a mean change over 1 % is a look change to show the author).

## 4. What to look for, and where it comes from

- **Lines heavy on small or far things.** The kernel width is CSS px (`uLineWidth` × `uPixelRatio`): fixed on the
  screen whatever the object's size, so it eats small things; at a low render scale its least width (1 render px)
  is several CSS px. `INK_SIZE` (post.js 1a, rendering.md "Ink lines by size on screen") keeps a line off a sliver,
  lightens the outline of a thin shape, thins the lines with a small frame and carries coverage under a render pixel.
- **Foliage turning into a black mass.** A far flower's stems and petals are a kernel or two wide: its silhouette
  (the ground far behind it: a depth edge) and every crease on it covered all of it. Check `inkShare` and `darkShare`
  on `veg-far`, `veg-farthest`, `canopy-far`, and crop the flowers (the worst were Edena's tulips, clover and daisy
  mats at 40-60 m).
- **Black eyes.** The face ink's least widths (a line never under 0.85 px, the iris never under 1.2 px) and the far
  opening's dark tone: once the opening is a pixel or two tall, it was one black mark. `HEAD_INK_FAR` (faces.md, "From
  afar"): coverage, not width, carries a sub-pixel stroke, and the far opening is one warm tone.
- **Shimmer at low resolution**: lines whose kernel is one render pixel come and go as the camera moves; the motion
  check (`scripts/motion-check`) confirms in motion what the half-pixel take suggests.
- **Faces and hands of other people** (`src/face-ink.js`, `FACE_HATCH_PX`), **the grass** (soft ink, `grassInk`),
  **the fluid blade and crystals** (outline-only), **foes** (`MOVER`, their own line weights): the same checks on the
  `pack` and on the town's people.

## 5. Cost

Every fix to the ink pass is measured, the build before and after in turns (the machine is shared: several turns,
the median of each, never one number):

```sh
PORT=5617 node .claude/skills/ink-lines/cost.mjs [--res desk1080x2,handheld] [--scenes town-far,veg-far] [--rounds 9] [--out f.json]
```

It times the ink pass alone on the GPU (`EXT_disjoint_timer_query_webgl2`, exposed with
`--enable-privileged-webgl-extensions`: every `renderer.render()` of `post.scene`) and the whole frame synced by a
`readPixels`. A line change must cost nothing measurable on Handheld (the Retroid is the budget).

## 6. The report

`docs/audits/ink-lines-v<version>.md`: the matrix and the scores (report.mjs writes them between its markers), the
findings (worst first, each with its picture, scene, resolution and cause in the renderer), the fixes with before →
after numbers and pictures, the cost, and what is left. Pictures in `docs/audits/ink-lines-v<version>/` as webp
(crops, 4× nearest neighbour for small things), small. Then the TODO's open line items.
