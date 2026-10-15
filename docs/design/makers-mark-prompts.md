# The makers' mark: reference prompts for a new sign

> **Superseded by the second pass, `docs/design/makers-mark-prompts-v2.md`.** The author liked none of these
> eight (they came out as modern logos and icons); their batches are rejected in the lab. Kept as history.

2026-10-15, issue #342. The makers' mark (the glyph) is drawn on every temple door, frieze, glyph stone and plate
(`glyphGeometry` in `src/story/sign-text.js`, the Rose House's flatter `signGeometry`, and the dots-over-arc
shapes across `src/temples/`). Today it is three dots over an upward-bowing arc, and even flattened it reads as a
frowning face. The author: "Can we do a pass at references for the makers' mark to see if we can redesign it with
something a bit nicer and more interesting?"

**What the mark is in the story** (`docs/story-bible.md`, "The glyph", "The boxes", "Local names"):

- **Whose.** The makers: a vanished, far more advanced people nobody has seen. They made the giants walk, built
  the temples (their ancient high-technology test chambers) and left gifts in chests for travellers who would
  come a long way after them. They marked everything they made with it: temple doors and friezes, glyph stones,
  the giants' bones, the Lodestar's facets, the Major's machine, Viridel's android ruins, the oldest market sign.
- **What it says.** *We heard you.* Ilen's answering light carried it and scorched it into the ship's hull; the
  scar's field beats slowly **in threes**. The pale four-point star is a separate sign of theirs (a traveller, "a
  small light, a long way from home") and stays on the chests.
- **How locals read it.** Each world has its own name, and most hang on its three parts and its curve: the bird's
  track (Vael), the Three Notes (Vael II), the Hush, three drops of rain over a shut mouth (Lorn), the Welcome,
  three lamps over a hull (Lorn II), the Maker's Thumb (Buried Machine), the Footprint (Garden of Spheres), the First
  Sign (Signal Market). A hand that only learned it draws it wavering (the Fallen Ring); it is chalked, cast on a
  plate, fused into glass sand.
- **So the new mark should keep** a "three" (three dots, beats, strokes or points) and one curve or line it sits on
  wherever it can: the dialogue says "three dots over an arc" in some thirty lines, and a mark that keeps both
  keeps most of the local names true. A direction that drops them is still worth seeing; it means a sweep of the
  dialogue and sightings if picked.

**What every prompt asks for.** A design sheet of ONE emblem family on cream paper: the mark large and centred,
3–4 smaller variants or weights of it, the mark carved into dark slate, the mark as a thin glowing line circuit on
a dark machined door, and the mark tiny along a frieze band (to show it stays readable small). Simple enough to
rebuild in the game from a few strokes, arcs and dots; symmetric (or deliberately asymmetric); a sign at a glance,
never a face ("no eyes, no mouth, not a face, not an emoji"); at home on old stone and on futuristic circuitry; in
the Moebius / Franco-Belgian ligne claire look.

Run (from the main checkout, so the batch shows in the lab; default providers Gemini and OpenAI; no `--refs`):
`node scripts/gen-reference.mjs --prompt "<the prompt below>" --target references/makers-mark/<id>/ --ar 1:1`.
The prompts below are already in the form sent (no `--ar` or `--no` inside).

| Id | Direction | In one line |
|---|---|---|
| `horizon` | Three stars over a horizon | the current mark made flat, wide and elegant: three points over a planet's rim |
| `orbit` | Orbital | rings, a moon, an eclipse: three bodies on one orbit |
| `seal` | Geometric seal | nested circles, a triangle, a hexagon: an exact compass-drawn seal |
| `stroke` | Calligraphic stroke | one unbroken brush or pen stroke, a signature, with three marks |
| `elements` | The game's elements | wind, water, light, sound and the jade fluid in one sign |
| `hand` | The maker's hand | an abstract tool or hand mark: three points pressed, one sweep |
| `gate` | The gate | the arch as a portal, three lights at its threshold |
| `path` | Constellation | a dotted path, three bright points joined by a line of small dots |

## The directions

### 1. Three stars over a horizon (`horizon`)

Target folder: `references/makers-mark/horizon/`

**Main: the current mark grown up, flat, wide and calm.**

The first run of this prompt (three points floating over a bowed curve) still read as a frowning face once carved
on a square slate (batch `2026-10-15-11-28-34-d412`); the prompt below is the redo: the points sit on the line
and rise out of it, the line nearly straight and far wider than the points.

```
Emblem design reference sheet for a science fiction exploration game: the sign of a vanished, far more advanced people who marked their doors, stones and gifts with it; it means "we heard you". The emblem: a long, almost straight horizontal line like a planet's horizon seen from orbit, very slightly curved, eight times wider than the whole emblem is tall, its ends tapering to hairlines; on it, close together at its middle, three small stars rising out of the line, each one touching or cut by the horizon like a sun half risen, the middle one higher and a touch larger. Nothing floats free above the line, there is no gap between the stars and the horizon. Calm, wide and elegant, like three suns rising over the rim of a world. Laid out as a clean grid on a plain cream paper ground: top, the emblem large and centred in black ink; beside it four smaller variants of the same emblem (a heavy weight, a hairline weight, one with the curve as a double line, one with the three points as four-point stars); bottom row, the emblem carved into a dark slate tablet with crisp chamfered cuts; the emblem as a thin glowing pale jade line circuit inlaid in a dark machined metal door; and the emblem tiny, repeated along a narrow stone frieze band, still crisp and readable. Built from only a few clean strokes, arcs and dots, simple enough to redraw with a ruler and compass. Symmetric. Clearly a symbol, a sign: no eyes, no mouth, not a face, not an emoji, not a smile or frown, no letters. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, flat luminous pastel colour, sparse delicate hatching, restrained cream paper grain. Avoid: text, lettering, labels, watermark, existing logos or brands, photorealism, 3D render, faces.
```

### 2. Orbital (`orbit`)

Target folder: `references/makers-mark/orbit/`

**Main: an astronomical sign, rings, a moon, an eclipse.**

```
Emblem design reference sheet for a science fiction exploration game: the sign of a vanished, far more advanced people who marked their doors, stones and gifts with it; it means "we heard you". The emblem: an astronomical sign, a circle partly eclipsed by a crescent, with one thin tilted elliptical orbit ring around it and three small dots spaced along the ring like moons in three positions of one journey. Quiet and exact, like a diagram of a passing light drawn by an astronomer. Laid out as a clean grid on a plain cream paper ground: top, the emblem large and centred in black ink; beside it four smaller variants of the same emblem (a heavy weight, a hairline weight, one with two orbit rings, one simplified to the crescent, the ring and the three dots); bottom row, the emblem carved into a dark slate tablet with crisp chamfered cuts; the emblem as a thin glowing pale jade line circuit inlaid in a dark machined metal door; and the emblem tiny, repeated along a narrow stone frieze band, still crisp and readable. Built from only a few clean circles, arcs and dots, simple enough to redraw with a ruler and compass. Deliberately asymmetric, balanced. Clearly a symbol, a sign: no eyes, no mouth, not a face, not an emoji, no letters, not a planet logo. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, flat luminous pastel colour, sparse delicate hatching, restrained cream paper grain. Avoid: text, lettering, labels, watermark, existing logos or brands, photorealism, 3D render, faces.
```

### 3. Geometric seal (`seal`)

Target folder: `references/makers-mark/seal/`

**Main: a compass-drawn seal of nested shapes.**

```
Emblem design reference sheet for a science fiction exploration game: the sign of a vanished, far more advanced people who marked their doors, stones and gifts with it; it means "we heard you". The emblem: an exact geometric seal drawn with compass and ruler, an outer circle, a hexagon or a triangle set inside it, a smaller circle at the centre, and three small dots placed at three of the inner corners, the lines of even width with small precise gaps where they cross. It looks engineered and ancient at once, like a maker's stamp on a precision instrument. Laid out as a clean grid on a plain cream paper ground: top, the emblem large and centred in black ink; beside it four smaller variants of the same emblem (a heavy weight, a hairline weight, one with only the circle, triangle and dots, one with the hexagon outline alone around the dots); bottom row, the emblem carved into a dark slate tablet with crisp chamfered cuts; the emblem as a thin glowing pale jade line circuit inlaid in a dark machined metal door; and the emblem tiny, repeated along a narrow stone frieze band, still crisp and readable. Built from only a few straight lines, circles and dots, simple enough to redraw with a ruler and compass. Symmetric. Clearly a symbol, a sign: no eyes, no mouth, not a face, not an emoji, no letters, no occult pentagram, no all-seeing eye. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, flat luminous pastel colour, sparse delicate hatching, restrained cream paper grain. Avoid: text, lettering, labels, watermark, existing logos or brands, photorealism, 3D render, faces.
```

### 4. Calligraphic stroke (`stroke`)

Target folder: `references/makers-mark/stroke/`

**Main: one unbroken stroke, a signature.**

```
Emblem design reference sheet for a science fiction exploration game: the sign of a vanished, far more advanced people who marked their doors, stones and gifts with it; it means "we heard you". The emblem: a single unbroken calligraphic stroke, like a signature made in one breath, a long low sweep that swells and thins, rising in one gentle loop or hook, with three small quick dabs set beside it, like a musician's mark or a flourish under a name, but no letter of any alphabet. Graceful, human, confident. Laid out as a clean grid on a plain cream paper ground: top, the emblem large and centred in black ink; beside it four smaller variants of the same emblem (a heavy brush weight, a fine pen weight, an even-width line version for machining, a hesitant hand-drawn copy that wavers); bottom row, the emblem carved into a dark slate tablet as a single grooved channel; the emblem as a thin glowing pale jade line circuit inlaid in a dark machined metal door; and the emblem tiny, repeated along a narrow stone frieze band, still crisp and readable. Built from one stroke and three dots, simple enough to rebuild from a few arcs. Deliberately asymmetric. Clearly a symbol, a sign: no eyes, no mouth, not a face, not an emoji, not a letter, not a word, not a sports logo swoosh. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, flat luminous pastel colour, sparse delicate hatching, restrained cream paper grain. Avoid: text, lettering, labels, watermark, existing logos or brands, photorealism, 3D render, faces.
```

### 5. The game's elements (`elements`)

Target folder: `references/makers-mark/elements/`

**Main: wind, water, light and sound in one sign.**

```
Emblem design reference sheet for a science fiction exploration game: the sign of a vanished, far more advanced people who marked their doors, stones and gifts with it; it means "we heard you". The emblem joins the world's elements in a few lines: a single drop of fluid at its heart, three short curved lines rising from it like sound waves or wind, and a small ray of light above, all held together as one compact upright sign, like a drop that sings. Laid out as a clean grid on a plain cream paper ground: top, the emblem large and centred in black ink, the drop filled with luminous jade green; beside it four smaller variants of the same emblem (a heavy weight, a hairline weight, one with the three lines as concentric ripples, one simplified to the drop and the three lines); bottom row, the emblem carved into a dark slate tablet with crisp chamfered cuts; the emblem as a thin glowing pale jade line circuit inlaid in a dark machined metal door; and the emblem tiny, repeated along a narrow stone frieze band, still crisp and readable. Built from only a few clean strokes, arcs and dots, simple enough to redraw with a ruler and compass. Symmetric. Clearly a symbol, a sign: no eyes, no mouth, not a face, not an emoji, no letters, not a wifi icon, not a flame logo. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, flat luminous pastel colour, sparse delicate hatching, restrained cream paper grain. Avoid: text, lettering, labels, watermark, existing logos or brands, photorealism, 3D render, faces.
```

### 6. The maker's hand (`hand`)

Target folder: `references/makers-mark/hand/`

**Main: an abstract tool or hand mark.**

```
Emblem design reference sheet for a science fiction exploration game: the sign of a vanished, far more advanced people who marked their doors, stones and gifts with it; it means "we heard you". The emblem: an abstract maker's mark, the trace a hand and a tool leave, not a drawing of a hand: three short parallel strokes pressed side by side like three fingertips or three chisel cuts, set above or within one open curved sweep like a palm's edge or a tool's arc, the strokes slightly different in length. It reads like a craftsman's stamp struck into finished work. Laid out as a clean grid on a plain cream paper ground: top, the emblem large and centred in black ink; beside it four smaller variants of the same emblem (a heavy weight, a hairline weight, a struck-metal stamp version, a simplified three strokes and one curve); bottom row, the emblem carved into a dark slate tablet with crisp chamfered cuts; the emblem as a thin glowing pale jade line circuit inlaid in a dark machined metal door; and the emblem tiny, repeated along a narrow stone frieze band, still crisp and readable. Built from only a few clean strokes and one arc, simple enough to redraw with a ruler and compass. Symmetric or slightly asymmetric. Clearly a symbol, a sign: no eyes, no mouth, not a face, not an emoji, no letters, no drawn hand or fingers, no claw marks. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, flat luminous pastel colour, sparse delicate hatching, restrained cream paper grain. Avoid: text, lettering, labels, watermark, existing logos or brands, photorealism, 3D render, faces.
```

### 7. The gate (`gate`)

Target folder: `references/makers-mark/gate/`

**Main: the arch turned into a portal.**

```
Emblem design reference sheet for a science fiction exploration game: the sign of a vanished, far more advanced people who marked their doors, stones and gifts with it; it means "we heard you". The emblem: a doorway sign, a tall narrow arch drawn as one clean line standing on a short level base line, like a portal seen from the front, with three small dots inside the opening stacked or in a row at its threshold, as if light is waiting on the other side; a second thinner arch may echo the first inside it. Welcoming and architectural. Laid out as a clean grid on a plain cream paper ground: top, the emblem large and centred in black ink; beside it four smaller variants of the same emblem (a heavy weight, a hairline weight, one with a double arch, one simplified to the arch, the base and three dots); bottom row, the emblem carved into a dark slate tablet with crisp chamfered cuts; the emblem as a thin glowing pale jade line circuit inlaid in a dark machined metal door; and the emblem tiny, repeated along a narrow stone frieze band, still crisp and readable. Built from only a few clean straight lines, arcs and dots, simple enough to redraw with a ruler and compass. Symmetric. Clearly a symbol, a sign: no eyes, no mouth, not a face, not an emoji, no letters, not a keyhole, not a tombstone. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, flat luminous pastel colour, sparse delicate hatching, restrained cream paper grain. Avoid: text, lettering, labels, watermark, existing logos or brands, photorealism, 3D render, faces.
```

### 8. Constellation (`path`)

Target folder: `references/makers-mark/path/`

**Main: three bright points joined by a dotted path.**

```
Emblem design reference sheet for a science fiction exploration game: the sign of a vanished, far more advanced people who marked their doors, stones and gifts with it; it means "we heard you". The emblem: a small constellation, three bright points of different sizes set at the corners of an uneven triangle or along a gentle rising curve, joined by a fine dotted path like a route drawn across a star chart, one end of the path trailing off into smaller dots as if the journey goes on. It reads as a map of a long way travelled. Laid out as a clean grid on a plain cream paper ground: top, the emblem large and centred in black ink; beside it four smaller variants of the same emblem (a heavy weight, a hairline weight, one with the path as a solid thin line, one with the three points as small four-point stars); bottom row, the emblem carved into a dark slate tablet with crisp drilled dots and a fine groove; the emblem as a thin glowing pale jade line circuit inlaid in a dark machined metal door; and the emblem tiny, repeated along a narrow stone frieze band, still crisp and readable. Built from only a few dots and fine lines, simple enough to redraw with a ruler and compass. Deliberately asymmetric, balanced. Clearly a symbol, a sign: no eyes, no mouth, not a face, not an emoji, no letters, not a zodiac sign. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, flat luminous pastel colour, sparse delicate hatching, restrained cream paper grain. Avoid: text, lettering, labels, watermark, existing logos or brands, photorealism, 3D render, faces.
```
