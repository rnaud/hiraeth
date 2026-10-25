# Surface detail: reference prompts (issue #669)

2026-10-25. The surface audit ([docs/audits/surfaces-v2.27.md](../audits/surfaces-v2.27.md)) ranked seven
representative materials whose surfaces are weak or untreated. Each gets one batch in the reference lab (issue #437;
docs/systems/reference-lab.md), text alone, Gemini and OpenAI:
`node scripts/gen-reference.mjs --from docs/design/surface-prompts.md#<id>`. The author picks in the lab's Pick mode
(or turns a batch down with a reason); a pick goes to its material's folder, `references/surfaces/<id>/`, with its
`manifest.json`. **Nothing is implemented until the picks are in**, and only the picked direction is.

## What every sheet must give the implementation

- **A material, not a scene**: the surface square-on in a big swatch, then the same surface in place at a
  walker's height with a small figure for scale, then how its marks simplify with distance (dense near, a few marks
  in the middle distance, flat colour far). The shader draws by distance (`detailLod`), so the sheet should too.
- **Procedural-friendly**: marks that come from a rule (courses, cells, strokes along a direction, scattered
  marks, tone per piece), not painted one-offs.
- **Calm**: flat colour stays the main read; pen marks are sparse and fine, so a whole plaza or hall is not noise and
  silhouettes in front of it stay readable.
- **The house style**: Moebius science fiction, ligne claire, flat pastel colour, no photographic texture.
- **The makers' temples** are futuristic ancient high tech (BotW-shrine-like), never organic: no moss, roots, vines
  or rot on them.

Target folder: `references/surfaces/<id>/`

### 1. Paved plazas and streets (`paving`)

```
Surface design sheet for a science fiction exploration game, the paving of the plazas and streets of pale cities: large flagstones of cream, sand and pale rose stone laid in courses of uneven length with staggered joints, now and then a slab a shade warmer or cooler, a few cracked slabs and a patched one, slightly worn rounded edges, fine grit gathered in the joints as sparse pen stipple, a smoother worn path where people walk, an inset brass survey disc and a narrow drainage channel. Three panels side by side: a large square-on swatch of the paving; the same plaza seen from a walker's height with a small figure for scale; a strip showing the marks simplifying with distance, dense near, a few joints in the middle distance, flat colour far. Calm and readable, flat colour dominant, marks sparse and fine. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream, sand, pale rose and a touch of brass, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render photo-texture text watermark lettering labels grass moss
```

### 2. The makers' temple walls (`temple-walls`)

```
Surface design sheet for a science fiction exploration game, the inner walls of an ancient high-tech shrine built by a vanished civilisation: tall monolithic panels of dark slate and blue-grey stone-like composite, set at slightly different depths so each casts a thin shadow on the next, every panel its own close tone, crisp chamfered edges catching a pale highlight, recessed seams, thin inlaid lines of soft warm light running along the courses and turning at right angles, a band of engraved geometric signs, sparse fine machining marks and a few tiny circular sockets. Clean, precise, timeless, futuristic. Three panels side by side: a large square-on swatch of the wall; a tall hall of these walls seen from a walker's height with a small figure for scale; a strip showing the detail simplifying with distance, panels and light lines staying, fine marks gone far. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, slate grey, blue-grey, a single peach or cyan light accent, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render photo-texture text watermark lettering labels moss vines roots organic rot ruins
```

### 3. The makers' temple floors (`temple-floors`)

```
Surface design sheet for a science fiction exploration game, the floors of an ancient high-tech shrine built by a vanished civilisation: large machined plates of pale grey and lavender-grey composite cut in concentric rings round a central disc and divided by radial joints, plates of slightly different tones, fine engraved border lines a hand in from each joint, thin inlaid lines of soft light along some rings, a few small round sockets and a recessed service hatch, very fine machining marks, a faint worn sheen where feet pass. Clean, precise, futuristic, timeless. Three panels side by side: a large swatch seen from straight above; the same floor of a round hall seen from a walker's height with a small figure for scale; a strip showing the detail simplifying with distance, rings and light lines staying, fine marks gone far. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale grey, lavender-grey, slate, a single peach or cyan light accent, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render photo-texture text watermark lettering labels moss vines roots organic rot ruins
```

### 4. Shop and room interiors (`interiors`)

```
Surface design sheet for a science fiction exploration game, the walls and floors of small shop rooms in a peaceful alien town: glazed ceramic floor tiles laid by hand with slightly uneven grout lines, a few tiles of another pastel tone and one chipped corner, painted plaster walls with soft repainted patches and a darker dado band at waist height, a tiled skirting, faint scuffs near the counter and the door. Three panels side by side: a large square-on swatch of wall over floor; the inside of a small shop seen from the doorway with a shopkeeper at the counter for scale; a strip showing the marks simplifying with distance, tiles and bands staying, grout and scuffs gone far. Homely, calm, flat colour dominant, marks sparse and fine. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, mint, cream, terracotta and pale blue, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render photo-texture text watermark lettering labels
```

### 5. Industrial and painted walls (`industrial-walls`)

```
Surface design sheet for a science fiction exploration game, the walls of the work buildings of a foundry town under a vast iron shed: painted sheet-metal panels with rows of rivets, rendered concrete blocks with formwork lines, faded paint and repainted rectangles of a slightly different colour, thin rust streaks running down from bolts and ledges, soot gathered under eaves and round vents, a few dents, blank riveted plates. Three panels side by side: a large square-on swatch of the wall; a block of these work buildings seen from a walker's height with a small figure for scale; a strip showing the marks simplifying with distance, panels and repaints staying, rivets and streaks gone far. Lived-in and worn but calm, flat colour dominant, marks sparse and fine. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rust orange, burnt sienna, slate blue and sand, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render photo-texture text watermark lettering labels graffiti
```

### 6. Open ground at middle distance (`open-ground`)

```
Surface design sheet for a science fiction exploration game, the open ground of a desert planet seen from a walker's height to the horizon: salmon and ochre sand and packed earth, soft wind ripples gathered in drifts, scattered pebbles each with a tiny shadow, cracked dry patches, faint tracks, larger soft patches of a slightly different tone, a few long pen lines following the fall of the slopes. Three panels side by side: a large swatch of the ground seen from above at close range; a wide view across rolling ground with a small figure for scale, the marks thinning with distance; a strip showing the marks simplifying with distance, dense near, broad tone patches and a few long lines in the middle distance, flat colour far. Big calm shapes, flat colour dominant, marks sparse and fine. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, salmon, ochre, pale sand and lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render photo-texture text watermark lettering labels grass
```

### 7. Worked timber (`timber`)

```
Surface design sheet for a science fiction exploration game, the worked timber of posts, planks, benches and market stall frames in a quiet alien village: long grain strokes along each plank, a few knots, split ends, nail holes and dark iron straps, sun-bleached tops and darker undersides, planks of slightly different tones, one painted plank with flaking pastel paint. Three panels side by side: a large square-on swatch of planks and a post; a market stall and a bench of this timber seen from a walker's height with a small figure for scale; a strip showing the marks simplifying with distance, planks staying, grain and knots gone far. Calm, flat colour dominant, marks sparse and fine. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, warm ochre, grey-brown, bleached cream and one faded teal, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render photo-texture text watermark lettering labels
```
