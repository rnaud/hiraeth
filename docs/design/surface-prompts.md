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

## Part 2 (issue #677, 2026-10-26)

Three materials the seven picks don't cover, asked for by the author after #669. Same rules as above.

### 8. The Underwater City's sea-weathered walls (`sea-walls`)

```
Surface design sheet for a science fiction exploration game, the walls of a city built under the sea and sealed under great glass domes: smooth rounded walls and domes of pale coral pink and shell-cream render, softly weathered by damp sea air, faint white salt bloom gathered along the base and under ledges, a few horizontal tide lines of a slightly darker tone where water once stood, sparse tiny barnacle-like dots and pale green growth stains in the shaded corners only, round porthole windows with brass rims, repaired patches of a fresher pink. Three panels side by side: a large square-on swatch of the wall; a curved street of these domed houses seen from a walker's height with a small figure for scale, blue-green light falling through the glass above; a strip showing the marks simplifying with distance, tide lines and patches staying, dots and salt gone far. Calm and readable, flat colour dominant, marks sparse and fine. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, coral pink, shell cream, sea green and a touch of brass, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render photo-texture text watermark lettering labels fish seaweed
```


### 9. Lorn's pale weathered stone (`pale-stone`)

```
Surface design sheet for a science fiction exploration game, the pale stone buildings of a quiet lamp-lit town in a misty wetland: walls, terrace columns and steps of pale bone-white and ash-grey limestone laid in large soft-edged blocks of slightly different tones, rounded worn arrises, fine vertical rain streaks below sills and cornices, a darker damp band at the foot of the walls, a few hairline cracks, sparse pitting, an occasional block replaced with a warmer one. Three panels side by side: a large square-on swatch of the wall; a terrace hall of this stone seen from a walker's height in soft mist with a small figure and a hanging lamp for scale; a strip showing the marks simplifying with distance, block joints and the damp band staying, cracks and pits gone far. Calm, quiet, flat colour dominant, marks sparse and fine. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, bone white, ash grey, a little lavender in the shadows and a warm lamp glow, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render photo-texture text watermark lettering labels moss vines
```


### 10. The Glass Dunes' buried city (`buried-city`)

```
Surface design sheet for a science fiction exploration game, an old city half buried under glassy dunes: the tops of pale sandstone walls and domes rising out of the sand, sand drifted against them in soft slopes, the walls scoured smooth and banded by the wind, their upper edges worn round, tall windows half full of sand with glints of fused glass in the frames, fine sand ripples, thin lines where the sand meets the stone, a few blocks sand-blasted lighter. Three panels side by side: a large square-on swatch of a scoured wall meeting the sand; a wide view of the buried city's roofs and windows across the dunes with a small figure for scale; a strip showing the marks simplifying with distance, sand lines and window shapes staying, scour bands and ripples gone far. Calm, wide, flat colour dominant, marks sparse and fine. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale sand, apricot, honey and a cool glass blue, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render photo-texture text watermark lettering labels ruins rubble skulls
```


### 11. The Desert's dome-city shells (`desert-domes`)

```
Surface design sheet for a science fiction exploration game, the great shell domes and towers of a far city in a desert: smooth domes of white ceramic, sea-teal and burnt orange, built of large curved panels set in rings that follow the dome's curve, the seams fine and slightly raised, a few panels of a slightly different tone, wind-polished tops, a faint band of sand-scour near the ground, a few small round vents and a thin maintenance ladder. Three panels side by side: a large swatch of the curved panelling; a cluster of these domes and a tower rising from the dunes, seen from far off with a small figure for scale; a strip showing the marks simplifying with distance, panel rings staying, seams and vents gone, flat colour far. Calm, clean, flat colour dominant, marks sparse and fine. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, ceramic white, sea teal, burnt orange and pale sand, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render photo-texture text watermark lettering labels tiles bricks
```

### 12. Viridel's water channels (`water-channels`)

```
Surface design sheet for a science fiction exploration game, the narrow irrigation channels that run between white stepped tea terraces: clear teal water in stone-lined channels, its surface drawn with a few calm flowing pen lines along the current, a pale line of light along each edge, small ripples where the water drops over a lip, the stone lip wet and darker, a little cream foam gathered at the corners, a faint reflection of the white steps. Three panels side by side: a large swatch of the channel seen from above; terraces with many channels seen from a walker's height with a small figure for scale; a strip showing the marks simplifying with distance, edge lights staying, flow lines and ripples gone far. Calm and readable, flat colour dominant, marks sparse and fine. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, teal, white stone, cream and a touch of leaf green, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render photo-texture text watermark lettering labels fish boats
```

## Part 4 (issue #690, 2026-10-26)

The second census ([docs/audits/surfaces-v2.30.md](../audits/surfaces-v2.30.md)) found two untreated materials with
real screen time that no picked sheet covers; the rest of what is still flat only needs code with an existing pick.
Same rules as above.

### 14. Garden beds and tilled soil (`garden-beds`)

```
Surface design sheet for a science fiction exploration game, the planted beds of terraced tea gardens and a small homestead garden: dark tilled soil raked in straight furrows, low rows of seedlings and tea bushes as small rounded tufts in tidy lines, a few bare patches of drier, paler earth, scattered pebbles each with a tiny shadow, narrow footpaths of trodden earth between the beds, crisp pale stone kerbs edging each bed, a little wet darkness along an irrigation runnel. Three panels side by side: a large swatch of a bed seen from above at close range; stepped terraces of these beds seen from a walker's height with a small figure and a watering can for scale; a strip showing the marks simplifying with distance, rows and kerbs staying, furrows and pebbles gone far, flat colour far. Calm, tidy, flat colour dominant, marks sparse and fine. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, umber, olive, sage green and cream stone, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render photo-texture text watermark lettering labels flowers vegetables fruit people tools
```

### 15. The Rose House's red stone halls (`rose-house`)

```
Surface design sheet for a science fiction exploration game, the floors and walls of the first shrine of a vanished civilisation, cut from rose-red desert stone into precise ancient high technology: large floor slabs of rose and terracotta stone set in a strict grid with fine recessed joints, every slab its own close tone, thin inlaid lines of warm amber light running between some slabs and turning at right angles, a few small round sockets and a circular plate in the floor, tall wall panels of darker plum-red stone set at slightly different depths with crisp chamfered edges, a band of engraved geometric signs, very fine tooling marks, a faint polish where feet pass. Clean, precise, timeless, futuristic, never ruined. Three panels side by side: a large swatch of floor meeting wall; a long hall of this stone seen from a walker's height with a small figure and a brazier for scale; a strip showing the detail simplifying with distance, slabs and light lines staying, tooling marks gone far. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rose, terracotta, plum and a single amber light accent, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render photo-texture text watermark lettering labels moss vines roots organic rot ruins rubble
```
