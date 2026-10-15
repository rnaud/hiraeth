# The makers' mark, second pass: the makers' inscriptions

2026-10-15, issue #342. The first pass (`docs/design/makers-mark-prompts.md`, eight directions, batches of
2026-10-15 11:28–11:33 under `references/makers-mark/`) missed: the author "didn't like any of the references".
They came out as clean modern logos and app icons on a design-sheet grid (a wifi sign, a planet icon, a nut, a
tombstone, star ratings), with no mystery, no craft and no sense of a lost people. Those batches are rejected in
the lab ("the author didn't like any; redone in v2").

This pass asks for something else: **an inscription of the makers**, the sign a vanished, far more advanced people
cut into what they left, as Moebius would draw one in his desert science-fiction albums: hand-drawn, cryptic,
beautiful, with a story in it. Every prompt draws it **in place** (carved or inlaid into a temple door or a
standing stone in a Moebius scene) with a **study of the mark alone on cream paper** beside it, like a page from
an explorer's notebook.

## What the mark has to carry

- **What it says.** *We heard you* (`docs/story-bible.md`, "The glyph"): Ilen's answering light carried it and
  scorched it into the ship's hull, and the scar's field beats slowly **in threes** (`src/story/signature.js`).
  It is an answer, not a name: a sign of attention and reply.
- **Whose.** The makers: nobody has seen one. They made the giants walk, built the temples, left gifts in chests
  for travellers who would come a long way after them, and marked everything they made with it. The pale
  four-point star is a separate sign of theirs (a traveller) and stays on the chests.
- **How locals read it.** Most of the world names hang on its three parts and its curve: the bird's track (Vael),
  the Three Notes (Vael II), the Hush, three drops of rain over a shut mouth (Lorn), the Welcome, three lamps over
  a hull (Lorn II), the Maker's Thumb (Buried Machine), the Footprint (Garden of Spheres), the First Sign (Signal
  Market). About thirty dialogue lines say "three dots over an arc" outright.
- **So:** "three" and "a curve" stay available, not forced. The table says what each direction would cost the
  writing if picked.

## What every prompt asks for

- An inscription or sigil of a vanished, far more advanced people, hand-drawn, cryptic and beautiful, with a story
  in it.
- Drawn in context: carved or inlaid into a temple door or a standing stone in a Moebius scene; beside it, a
  cream-paper study of the mark alone (large, with one or two smaller sketches and faint construction lines).
- Not a logo, not an app icon, not an emoji, not a face: no eyes, no mouth.
- **Compact** (the author, on this pass: "I want to make sure the logo fits in a square or a 16:9 box, nothing too
  too wide"): the mark itself fits a square or at most a 16:9 box, never a long horizon line, a wide band or a
  tall column. A frieze is the mark repeated, not the mark.
- Rebuildable in the game from strokes, arcs and dots: moderate complexity, no fine filigree.
- Moebius / Franco-Belgian ligne claire, fine pen lines, flat pastel colour. No other games or brands named.

Run (from the main checkout, so the batch shows in the lab; default providers; no `--refs`; two pictures each):
`node scripts/gen-reference.mjs --prompt "<the prompt below>" --target references/makers-mark-v2/<id>/ --ar 1:1 --n 2`.

| Id | Direction | Keeps three / a curve | If picked, the writing |
|---|---|---|---|
| `geoglyph` | A line drawing on a desert floor, seen from above | three stone rings on one long curve | "dots over an arc" holds loosely; the Footprint and the bird's track gain |
| `resonance` | A struck note: three arcs spreading from one point | three arcs, no dots | sweep "three dots" to "three rings"; the Three Notes fits best of all |
| `listening` | A cupped curve receiving three falling points | yes, both | nearly none: three points over a curve stays true; the Hush fits |
| `interlace` | One line passing three times through a curve | three passes, one curve | sweep "dots"; the names on "three" survive |
| `gnomon` | A sundial: an axis, its arc, three hour marks | three marks on an arc | small: "three marks on an arc" |
| `crystal` | A faceted seal cut like a jewel | three bright facets | a sweep of every "dots over an arc" line and most names |
| `script` | One letter of the makers' writing, with siblings | depends on the letter | a sweep, plus a line or two that it is one of their letters |
| `starmap` | Three bodies and their orbits, a navigator's mark | three bodies, curved paths | small: "three lights on their paths"; the Welcome's three lamps fit |
| `threshold` | A compact mark that repeats along a lintel | the unit keeps both | none for the unit; new lines could mention the band |
| `free` | The most beautiful mark for these makers | open | unknown until seen |

## The directions

### 1. Geoglyph (`geoglyph`)

Target folder: `references/makers-mark-v2/geoglyph/`

**A line drawing ploughed into a desert floor, seen from high above.**

```
A page from a Moebius science-fiction album, square. Left two thirds: seen from high above, a vast ancient line drawing scraped into the pale ochre floor of a desert, the sign of a vanished, far more advanced people who answered a call long ago; its lines are shallow trenches of darker sand edged with small stones, softened by wind, older than any town. The sign, seen whole from above as a compact figure about as wide as it is long: one slow curve that hooks back on itself like a spiral's first turn, three rings of standing stones set along the curve at unequal spaces, and one short straight line running out from the last ring, as if pointing the way home. A lone traveller in a long coat and his small grounded ship stand tiny beside one of its lines for scale; long shadows; at the edge of the drawing one weathered standing stone carries the same sign cut small into its face. The sign itself is compact: it fits inside a square, or at most a box 16:9 wide, never a long line, a wide band or a tall column. Right third: a study of the sign alone on cream paper in black pen, drawn large, with one smaller quick sketch of it and faint pencil construction lines, like a page of an explorer's notebook. The sign is hand-drawn, cryptic and beautiful, an inscription with a story in it: not a logo, not an app icon, not an emoji, not a face, no eyes, no mouth. Built from a handful of strokes, arcs and dots, moderate complexity, no fine filigree. Franco-Belgian ligne claire, fine pen lines, flat pastel colour, sparse hatching, cream paper grain. Avoid: text, lettering, labels, watermark, photorealism, 3D render.
```

### 2. Resonance (`resonance`)

Target folder: `references/makers-mark-v2/resonance/`

**A struck note spreading as three nested arcs from one point: "we heard you" as sound.**

```
A page from a Moebius science-fiction album, square. Left two thirds: the tall round door of an ancient temple of a vanished, far more advanced people, pale weathered stone set in a cliff, a lone traveller in a long coat standing small before it; inlaid across the door in dull copper and pale jade stone is their sign, which means "we heard you": a single small point low at one side, like the spot where a bell was struck, and three arcs spreading out from it like a note travelling through still air, each arc wider and fainter than the last, the first one whole, the second broken once, the third broken into three long strokes as if the sound is reaching far away. The arcs lean to one side, not a fan, not a signal icon. A faint ripple shivers in the dust in front of the door. The sign itself is compact: it fits inside a square, or at most a box 16:9 wide, never a long line, a wide band or a tall column. Right third: a study of the sign alone on cream paper in black pen, drawn large, with one smaller sketch of it and faint pencil construction lines showing the arcs' centres, like a page of an explorer's notebook. The sign is hand-drawn, cryptic and beautiful, an inscription with a story in it: not a logo, not an app icon, not a wifi symbol, not an emoji, not a face, no eyes, no mouth. Built from a point and a few arcs, moderate complexity, no fine filigree. Franco-Belgian ligne claire, fine pen lines, flat pastel colour, sparse hatching, cream paper grain. Avoid: text, lettering, labels, watermark, photorealism, 3D render.
```

### 3. Listening (`listening`)

Target folder: `references/makers-mark-v2/listening/`

**The shape of attention: a cupped curve receiving three falling points.**

```
A page from a Moebius science-fiction album, square. Left two thirds: a tall standing stone of dark blue-grey rock on a windy plateau of pale grass and lilac distances, a lone traveller in a long coat resting a hand on it; cut deep into its face is the sign of a vanished, far more advanced people, which means "we heard you", the grooves filled with pale gold: the shape of attention, abstract, one deep cupped curve like a crescent standing up on one of its tips, opening sideways towards the upper left like a hollow held up to catch something, never a bowl lying flat; three small points falling into its opening from the side in a slanting line, each one closer to the curve than the one before, the last almost touching its inner edge, a fine trail behind each point like the path of a drop. It is asymmetric and it does not look like anything living, nor like a smile. The sign itself is compact: it fits inside a square, or at most a box 16:9 wide, never a long line, a wide band or a tall column. Right third: a study of the sign alone on cream paper in black pen, drawn large, with one smaller sketch of it and faint pencil construction lines, like a page of an explorer's notebook. The sign is hand-drawn, cryptic and beautiful, an inscription with a story in it: not a logo, not an app icon, not an emoji, not a face, not a smile, no eyes, no mouth, no ear. Built from one curve, three dots and short strokes, moderate complexity, no fine filigree. Franco-Belgian ligne claire, fine pen lines, flat pastel colour, sparse hatching, cream paper grain. Avoid: text, lettering, labels, watermark, photorealism, 3D render.
```

### 4. Interlace (`interlace`)

Target folder: `references/makers-mark-v2/interlace/`

**One line passing three times through a curve, a knot.**

```
A page from a Moebius science-fiction album, square. Left two thirds: the great sealed door of an ancient temple of a vanished, far more advanced people, half buried in red dunes, its surface a single slab of cream stone worn smooth; carved in deep relief at its centre is their sign, which means "we heard you": one continuous line that comes in from one side, passes three times through a wide open curve, weaving over and under it like a cord threaded through a ring, and leaves again on the other side, its two ends tapering to fine points; where it crosses the curve the relief shows clearly which strand lies on top. A lone traveller in a long coat stands small at the foot of the door, a lizard-like mount behind him. The sign itself is compact: it fits inside a square, or at most a box 16:9 wide, never a long line, a wide band or a tall column. Right third: a study of the sign alone on cream paper in black pen, drawn large with the over-and-under crossings drawn clearly, with one smaller sketch of the knot pulled open and faint pencil construction lines, like a page of an explorer's notebook. The sign is hand-drawn, cryptic and beautiful, an inscription with a story in it: not a logo, not an app icon, not an emoji, not a face, no eyes, no mouth, not a Celtic knot. Built from one line and one curve, moderate complexity, no fine filigree. Franco-Belgian ligne claire, fine pen lines, flat pastel colour, sparse hatching, cream paper grain. Avoid: text, lettering, labels, watermark, photorealism, 3D render.
```

### 5. Gnomon (`gnomon`)

Target folder: `references/makers-mark-v2/gnomon/`

**A sundial: an axis and its arc, with three marks of hours.**

```
A page from a Moebius science-fiction album, square. Left two thirds: on a high bare mesa under a huge pale sky with a ringed moon, a squat standing stone of pale sandstone, its flat top and one face carved by a vanished, far more advanced people with their sign, which means "we heard you"; the sign is a sundial of their own kind: a single straight axis leaning at a slant, a wide arc swung round its foot like the path of a shadow, and three short deep notches cut across the arc at uneven spaces, three hours of some long-ago day; the real shadow of a bronze pin set in the stone falls exactly on the middle notch. A lone traveller in a long coat sits on the rock nearby, watching it. The sign itself is compact: it fits inside a square, or at most a box 16:9 wide, never a long line, a wide band or a tall column. Right third: a study of the sign alone on cream paper in black pen, drawn large, with one smaller sketch of it and faint pencil construction lines of the arc's centre and the axis' angle, like a page of an explorer's notebook. The sign is hand-drawn, cryptic and beautiful, an inscription with a story in it: not a logo, not an app icon, not a clock face, not an emoji, not a face, no eyes, no mouth, no numerals. Built from one straight line, one arc and three short strokes, moderate complexity, no fine filigree. Franco-Belgian ligne claire, fine pen lines, flat pastel colour, sparse hatching, cream paper grain. Avoid: text, lettering, labels, watermark, photorealism, 3D render.
```

### 6. Crystal (`crystal`)

Target folder: `references/makers-mark-v2/crystal/`

**A faceted seal, cut like a jewel into the stone.**

```
A page from a Moebius science-fiction album, square. Left two thirds: the dark basalt door of an ancient temple of a vanished, far more advanced people, deep in a canyon of violet shadow, a lone traveller in a long coat lifting a lantern towards it; set into the door at eye height is their sign, which means "we heard you", cut like a jewel into the stone: a flat faceted seal of a few large clean facets, its outline an irregular elongated lozenge, not a regular polygon; three of its facets are inlaid with pale jade crystal and catch the light, the others are polished black stone, and the facet lines run on past the seal's edge as fine cuts into the door. The sign itself is compact: it fits inside a square, or at most a box 16:9 wide, never a long line, a wide band or a tall column. Right third: a study of the sign alone on cream paper in black pen, drawn large as a flat facet diagram with the three bright facets washed pale jade, with one smaller sketch of it and faint pencil construction lines, like a page of an explorer's notebook. The sign is hand-drawn, cryptic and beautiful, an inscription with a story in it: not a logo, not an app icon, not a diamond icon, not an emoji, not a face, no eyes, no mouth. Built from a dozen straight cuts at most, moderate complexity, no fine filigree. Franco-Belgian ligne claire, fine pen lines, flat pastel colour, sparse hatching, cream paper grain. Avoid: text, lettering, labels, watermark, photorealism, 3D render.
```

### 7. Script (`script`)

Target folder: `references/makers-mark-v2/script/`

**One character of the makers' writing, among a few of its siblings.**

```
A page from a Moebius science-fiction album, square. Left two thirds: the lintel and jambs of an ancient temple doorway of a vanished, far more advanced people, cream stone streaked with rust, a lone traveller in a long coat looking up at it; along the lintel runs a short line of six or seven characters of their unknown writing, cut deep and even, each character built from a few strokes, arcs and dots with the same pen logic, like a real alphabet nobody can read; at the centre of the line one character is larger and set inside a carved oval cartouche, and that is their sign, which means "we heard you": a curve and three marks arranged like a letter, elegant and strange. The sign itself is compact: it fits inside a square, or at most a box 16:9 wide, never a long line, a wide band or a tall column. Right third: a study page on cream paper in black pen: the sign drawn large, and below it a row of the sibling characters drawn small with faint stroke-order arrows and construction lines, like an explorer copying an inscription into a notebook. The writing is hand-drawn, cryptic and beautiful, with a story in it: no letters or numerals of any human alphabet, no runes, no hieroglyphs of Earth, not a logo, not an app icon, not an emoji, not a face, no eyes, no mouth. Each character built from a few strokes, arcs and dots, moderate complexity, no fine filigree. Franco-Belgian ligne claire, fine pen lines, flat pastel colour, sparse hatching, cream paper grain. Avoid: readable text, labels, watermark, photorealism, 3D render.
```

### 8. Star map (`starmap`)

Target folder: `references/makers-mark-v2/starmap/`

**Three bodies and their orbit paths, a navigator's mark.**

```
A page from a Moebius science-fiction album, square. Left two thirds: a ring of tall standing stones on a salt flat at dusk, a lone traveller in a long coat and his small grounded ship beside them, stars coming out; the largest stone carries, inlaid in thin bands of brass and pale blue glass, the sign of a vanished, far more advanced people, which means "we heard you", drawn as a navigator's chart mark: three small round bodies of different sizes, each on its own fine orbit path, the three paths overlapping as long open ellipses, and one bold curving course line threading through all three bodies and out past the edge, as if plotted by someone who crossed between them. The sign itself is compact: it fits inside a square, or at most a box 16:9 wide, never a long line, a wide band or a tall column. Right third: a study of the sign alone on cream paper in black pen, drawn large like a page torn from a star pilot's log, with one smaller sketch of it and faint pencil construction lines and tick marks, like a page of an explorer's notebook. The sign is hand-drawn, cryptic and beautiful, an inscription with a story in it: not a logo, not an app icon, not an atom symbol, not a planet icon, not an emoji, not a face, no eyes, no mouth. Built from three dots, three ellipses and one curve, moderate complexity, no fine filigree. Franco-Belgian ligne claire, fine pen lines, flat pastel colour, sparse hatching, cream paper grain. Avoid: text, lettering, labels, watermark, photorealism, 3D render.
```

### 9. Threshold (`threshold`)

Target folder: `references/makers-mark-v2/threshold/`

**A compact mark made to repeat along a doorway's lintel, like a stamp pressed again and again.**

The first run ("a curve and three marks that close on themselves") came out as four faces, a round curve with
dots and bars inside it (batch `2026-10-15-12-23-09-6c1c`, discarded); the prompt below is the redo: angular, an
arch on a stroke, the three bars outside the arc and nothing inside it.

```
A page from a Moebius science-fiction album, square. Left two thirds: a wide, low doorway of an ancient temple of a vanished, far more advanced people, its massive pale lintel crossing the whole picture, jungle roots and blue shade around it, a lone traveller in a long coat about to step through; along the lintel runs a carved frieze made of their sign, which means "we heard you", repeated side by side with a small gap between repeats: the sign is one compact, self-contained mark, angular and architectural: a short upright stroke, a single arc springing from its top and coming down beside it like half an archway, and three short parallel bars stacked outside the arc along its back, nothing at all inside the arc, each repeat whole and separate like a stamp pressed again and again, never a continuous wave, never round like a head; at the very centre over the doorway one repeat is larger, cut deeper and inlaid with pale jade. The sign itself is compact: it fits inside a square, or at most a box 16:9 wide; only the frieze made of its repeats is long. Right third: a study page on cream paper in black pen: the single sign drawn large inside a faint square, and below it a short strip of four repeats with faint pencil construction lines showing their spacing, like a page of an explorer's notebook. The sign is hand-drawn, cryptic and beautiful, an inscription with a story in it: not a logo, not an app icon, not a Greek key, not an emoji, not a face or a head in profile, no eyes, no mouth, no dots inside a round shape. Each unit built from a curve and a few dots or strokes, moderate complexity, no fine filigree. Franco-Belgian ligne claire, fine pen lines, flat pastel colour, sparse hatching, cream paper grain. Avoid: text, lettering, labels, watermark, photorealism, 3D render.
```

### 10. Free (`free`)

Target folder: `references/makers-mark-v2/free/`

**The most beautiful and mysterious mark these makers could have left.**

```
A page from a Moebius science-fiction album, square. Left two thirds: in a vast, silent landscape of pale rock arches and drifting blue haze, a single monolith of cream stone stands alone, a lone traveller in a long coat small at its foot; on its face, cut and inlaid with a thread of pale glowing jade, is the sign of a vanished, far more advanced people, the most beautiful and mysterious sign they could have left: the mark of a people who heard a voice calling from very far away and sent an answer back. Imagine it freely, as a sigil with a story in it: a line that comes from far off and turns, a pause, an answer going back; it may hold three of something and one curve, or not. The sign itself is compact: it fits inside a square, or at most a box 16:9 wide, never a long line, a wide band or a tall column. Right third: a study of the sign alone on cream paper in black pen, drawn large, with one smaller sketch of it and faint pencil construction lines, like a page of an explorer's notebook. The sign is hand-drawn, cryptic and beautiful: not a logo, not an app icon, not an emoji, not a face, no eyes, no mouth, no letters of any human alphabet. Built from strokes, arcs and dots, moderate complexity, no fine filigree. Franco-Belgian ligne claire, fine pen lines, flat pastel colour, sparse hatching, cream paper grain. Avoid: text, lettering, labels, watermark, photorealism, 3D render.
```
