# Fewer, better hats: reference prompts (issue #403, phase 2)

2026-10-16. The author: "We have too many weird hats, redesign the hats and have less of them on average." Phase 1
(docs/systems/characters.md, "Fewer hats") cut the share of people with something on the head from 81 % to 28 %
and took the oddest shapes out of the crowds. What is left is a patchwork: each world's own piece from the first
costumes, plus the "stage 3" hats (bowler, trilby, flat cap, peak cap, beanie, trapper, bandana), which read as a
twentieth-century Earth street rather than a Moebius world. This file prepares the redesign: a small coherent set
of hats per culture, **three to five at most**, from one Midjourney sheet per world.

**Nothing here is generated or modelled yet.** As CLAUDE.md asks: the author runs these prompts in Midjourney in his
own browser, hearts the sheets they like, and only the picked designs are modelled (as `HEADS` pieces in
`src/costumes.js`, fitted to the skull like the stage 3 hats, then given to each tribe's `heads` table). The picks
go to a new `hats/<id>/` folder under the references folder (made when the first pick is saved).

## What every hat must do

- **Read at crowd distance**: one clear silhouette, at most one accent (a band, a tassel, a pin). Most people are
  seen at 10–40 m, as GPU crowd figures with a few hundred triangles each.
- **Sit on the head**: fitted to the skull, its brim no wider than the shoulders. Nothing hovering over the head
  (the dropped `orb`, `flowers`), nothing taller than the head itself (`tophat`, `spire`, `wizard`, `reeds`), no
  props balanced on a brim (`lamphat`).
- **Belong to the culture**: made of what that world has (cloth, reed, felt, padded canvas, salvage), worn for a
  reason (sun, spray, dust, work, rank, faith).
- **Fit the house style**: Moebius science fiction, flat pastel colour, clean contour, no costume-party shapes.
- Hair stays the default: most people go bare-headed (the share is set per tribe: `hatOdds`).

## Which world needs it most

**The City-Shaft** (`incal`, and the City Floating in Space, which dresses the same). Its rim lost its whole fashion
when the stovepipes and spires went: the rim now wears bowlers and trilbies, the middle levels peak caps and beanies,
the bottom rag hoods, trappers and bandanas. Ten shapes over three tribes, half of them Earth street hats, none of
them saying "a vertical city of rich rims and poor depths". It is also the world with the most named people under a
hat (Corvin Sale, Lio, Nima, Ossa, Pip, Abel, Dov). Next: **the Garden of Spheres** (its spheres-on-the-head were its
identity; skull caps and circlets are placeholders), **Lorn** (the reed thatch is gone; wide soft brims stand in) and
**the Signal Market** (seven shapes in one crowd: turbans, wraps, headscarves, beanies, flat caps, peak caps).

## The sets

Each world's sheet asks for its set; the numbers are a starting point for the author's pick. Worlds that share a
costume (src/costumes.js: `COSTUMES.glassdunes = COSTUMES.desert`, …) share a sheet; they are listed together.

| Id | Worlds (level ids) | Who wears hats today (crowd share, after phase 1) | The set to design |
|---|---|---|---|
| `city-shaft` | The City-Shaft (`incal`), the City Floating in Space (`spacecity`) | 24–27 %: bowler, trilby, hood, rag hood, peak, beanie, bandana, trapper | 4: a rim hat (rank, pale lacquer), a middle-levels work cap, a bottom-of-the-shaft rag hood, a goggle band |
| `spheres` | The Garden of Spheres (`spheres`) | 23 %: skull cap, circlet | 3: a listener's cap that leaves the ears clear, a ringed band, an elder's soft cowl |
| `lorn` | Lorn (`perdide`) | 24 %: hood, brim, bandana | 3: a woven reed hat that sits on the head, a swamp hood, a knotted head-cloth |
| `signal-market` | The Signal Market (`bazaar`), the Overnight Train (`overnighttrain`) | 25–26 %: turban, wrap, kerchief, beanie, flat cap, peak | 4: a market turban (plain, no plume), a trader's cap, a porter's head-pad, a woman's headscarf |
| `desert` | The Desert (`desert`), the Glass Dunes (`glassdunes`) | 36–40 %: headcloth, wrap, straw, sun hat, kerchief | 4: the pilgrim's headcloth, a head-wrap, a modest wide sun hat (half today's cone), a glassworker's cap |
| `vael` | Vael (`arzach`) | 54 %: cowl, hood | 2: the order's cowl (a lower point than today's), a travelling hood |
| `vael-ii` | Vael II: The Sky Stones (`arzach2`) | 31 %: cowl, hood, kerchief, skull cap | 3: a monk's cowl, a sister's wimple, a novice's skull cap |
| `buried` | The Buried Machine (`buried`), the Moon Foundry (`moonfoundry`) | 40 %: padded hood, hard hat, beanie, hood, trapper | 3: the padded dome hood, a miner's hard hat (lamp flush with the brim), a knitted under-cap |
| `viridel` | Viridel (`edena`) | 25 %: straw, circlet, brim | 3: a gardener's straw hat, a band of leaves (lying flat on the hair), a sun bonnet |
| `lorn-ii` | Lorn II: The Deep Wood (`perdide2`) | 26 %: hood, brim, beanie, trapper | 3: a moss-felt hood, a lamp-keeper's cap, a quilted dusk hood |
| `mangrove` | The White Mangrove (`mangrove`), the City During the Eclipse (`eclipse`) | 25 %: hood, brim | 3: a pale lake hood, a veil-hood for the eclipse, a flat wide reed hat |
| `harbour` | The Salt Harbour (`saltharbour`), the Underside (`underside`) | 23–33 %: wrap, hood, hat | 3: a sailcloth head-wrap, a fisher's sou'wester, a sun-bleached hood |
| `falls` | The City Behind the Waterfall (`waterfall`), the Underwater City (`underwater`) | 18–20 %: wrap, hood, kerchief, beanie | 3: a spray hood, a basket-carrier's head-pad, an oiled cap |
| `antennas` | The Forest of Antennas (`antennas`) | 21 %: hood, peak, beanie | 3: a mast-mender's cap with goggles up, a climbing hood, a wire-wrapped band |
| `fallen-ring` | The Fallen Ring (`fallenring`) | 15 %: hood | 3: a herder's hood, a felt cap, a hull-worker's head-cloth |

The named people whose own sheet draws a hat keep theirs whatever the sets become (the Speaker, Sefa, Nour, Bako,
Marrow, Haddu, and every quest reference in `src/characters/quest-looks.js`); a new set may give them a better-fitted
version of the same idea, never a different hat.

## The prompts

Every prompt asks for one sheet: the set's hats each worn by a head-and-shoulders figure of that people, front and
three-quarter view, on cream paper, no lettering. Same style suffix throughout, so the sheets can be compared.

### 1. The City-Shaft (`city-shaft`): the worlds that need it most

```
Character design sheet for a science fiction exploration game: the hats of a city built down the walls of a vast vertical shaft, rich families on the sunlit rim and the poor in the dark depths. Four hats, each worn by a head-and-shoulders figure, front and three-quarter view: a rim family's hat of pale lacquered felt with a short stiff brim and a single pastel band, worn with a high collar; a middle-levels worker's soft cap with a short peak, canvas and patched; a bottom-of-the-shaft hood of layered rags close round the face, lantern-soot on the cloth; a leather goggle band worn over close-cropped hair. Every hat sits close on the skull, no taller than the head, brims no wider than the shoulders, one clear silhouette each, readable from far away. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rose, lavender and pale blue on the rim, rust and soot grey below, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels costume-party
```

### 2. The Garden of Spheres (`spheres`)

```
Character design sheet for a science fiction exploration game: the headwear of the listeners, a quiet people in pale robes who tend a garden of giant half-sunk spheres and listen to them hum. Three pieces, each worn by a head-and-shoulders figure, front and three-quarter view: a small rounded cap of pale cream cloth that leaves the ears bare, with a single dot of ochre at the crown; a thin ringed band of brass round the brow, like the rings round the spheres; an elder's soft hood falling to the shoulders, open round the ears. Every piece sits close on the head, nothing floating above it, one clear silhouette each, readable from far away. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream, pale yellow and sage, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels costume-party
```

### 3. Lorn (`lorn`)

```
Character design sheet for a science fiction exploration game: the hats of a swamp people with violet skin who live on raft-houses in the reeds and keep their accounts in knots. Three hats, each worn by a head-and-shoulders figure, front and three-quarter view: a low woven reed hat with a gently drooping brim, the reeds' ends tucked in neatly; a hood of moss-green waxed cloth, close round the face; a knotted head-cloth tied over locks and braids, a small knot at the back. Every hat sits close on the head, no taller than the head, brims no wider than the shoulders, one clear silhouette each, readable from far away. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, reed olive, moss green and lilac, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels costume-party
```

### 4. The Signal Market (`signal-market`)

```
Character design sheet for a science fiction exploration game: the headwear of a busy market town of radio towers and broadcast stalls, traders and porters from many places. Four pieces, each worn by a head-and-shoulders figure, front and three-quarter view: a neatly wound market turban of one coloured cloth, no jewel, no plume; a trader's soft round cap with a short tassel; a porter's ring-shaped head-pad for carrying baskets, worn on bare hair; a woman's headscarf of printed cloth tied at the nape. Every piece sits close on the head, no taller than the head, one clear silhouette each, readable from far away. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, coral, teal, saffron and sand, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels costume-party
```

### 5. The Desert (`desert`)

```
Character design sheet for a science fiction exploration game: the headwear of desert pilgrims and the glassworkers of the dunes, against sun and blown sand. Four pieces, each worn by a head-and-shoulders figure, front and three-quarter view: the pilgrim's headcloth, a pale cloth over the head and down the neck, tied with a twisted cord; a cream head-wrap wound loosely round the head, one end hanging; a modest straw sun hat with a shallow cone crown and a brim no wider than the shoulders; a glassworker's close cap of scorched canvas with a neck flap. Every piece sits close on the head, one clear silhouette each, readable from far away. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, golden sand, cream, ochre and indigo, lavender shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels costume-party
```

### 6. Vael (`vael`)

```
Character design sheet for a science fiction exploration game: the headwear of a silent order of riders of great birds, in white and ivory robes among red rock needles. Two pieces, each worn by a head-and-shoulders figure, front, three-quarter and back view: the order's cowl of heavy ivory cloth, rising to a low soft point behind the head and falling over the shoulders; a lighter travelling hood thrown forward against the wind. Both close round the face, no taller than a hand above the head, one clear silhouette each, readable from far away. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, ivory, bone white and a single red cord, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels costume-party
```

### 7. Vael II: The Sky Stones (`vael-ii`)

```
Character design sheet for a science fiction exploration game: the headwear of a bell monastery on floating stones, brothers and sisters in wine-red and violet habits. Three pieces, each worn by a head-and-shoulders figure, front and three-quarter view: a monk's cowl of cream wool, rounded, close round a tonsured head; a sister's white wimple shaped like a small bell; a novice's plain skull cap. Every piece sits close on the head, one clear silhouette each, readable from far away. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream, wine red, violet and pale teal, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels costume-party
```

### 8. The Buried Machine (`buried`)

```
Character design sheet for a science fiction exploration game: the work headwear of a people living in domes inside a buried machine and its moon foundry, dust, heat and dark tunnels. Three pieces, each worn by a head-and-shoulders figure, front and three-quarter view: a padded canvas dome hood with a thick rolled rim and round ear pads; a miner's hard hat with a short brim and a small lamp set flush into its front; a knitted under-cap worn alone off shift. Every piece sits close on the head, one clear silhouette each, readable from far away. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rust orange, slate blue and pale sage, warm lamp light, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels costume-party
```

### 9. Viridel (`viridel`)

```
Character design sheet for a science fiction exploration game: the hats of gentle gardeners in white and pastel, tending a garden built over the ruins of white builders' slabs. Three pieces, each worn by a head-and-shoulders figure, front and three-quarter view: a gardener's straw hat with a low crown and a soft brim; a band of woven leaves lying flat on long loose hair; a cotton sun bonnet tied under the chin. Every piece sits close on the head, nothing floating round it, one clear silhouette each, readable from far away. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, white, mint, rose and straw, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels costume-party
```

### 10. Lorn II: The Deep Wood (`lorn-ii`)

```
Character design sheet for a science fiction exploration game: the headwear of the lamp-keepers of a dark wood of giant mushrooms and moss domes, who carry lamps on poles. Three pieces, each worn by a head-and-shoulders figure, front and three-quarter view: a hood of felted moss-green cloth; a lamp-keeper's round cap with a short brim, the lamp carried on a pole beside it, never on the hat; a quilted dusk-blue hood with a soft edge. Every piece sits close on the head, one clear silhouette each, readable from far away. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, moss green, dusk blue and lilac, warm lamp glow, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels costume-party
```

### 11. The White Mangrove (`mangrove`)

```
Character design sheet for a science fiction exploration game: the headwear of the lake folk of a white mangrove, pale robes, lanterns, a violet and rose lake, and the same people in a city during an eclipse. Three pieces, each worn by a head-and-shoulders figure, front and three-quarter view: a pale lilac hood falling softly to the shoulders; a sheer veil-hood for the eclipse, the face just visible through it; a flat wide reed hat, its brim no wider than the shoulders. Every piece sits close on the head, one clear silhouette each, readable from far away. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale lilac, white and violet, a touch of lantern gold, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels costume-party
```

### 12. The Salt Harbour (`harbour`)

```
Character design sheet for a science fiction exploration game: the headwear of a sun-bleached harbour town of salt pans and sailcloth, terracotta and white, and the dock-workers under its piers. Three pieces, each worn by a head-and-shoulders figure, front and three-quarter view: a sailcloth head-wrap against the glare, one end tucked; a fisher's sou'wester of waxed cloth with a long back brim; a sun-bleached hood with a salt-stiff edge. Every piece sits close on the head, one clear silhouette each, readable from far away. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, terracotta, sailcloth cream and sea blue, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels costume-party
```

### 13. The City Behind the Waterfall (`falls`)

```
Character design sheet for a science fiction exploration game: the headwear of basket carriers and pot gardeners in a pale stone city behind a great waterfall, and of the city under the sea. Three pieces, each worn by a head-and-shoulders figure, front and three-quarter view: a spray hood of oiled rust-coloured cloth; a basket-carrier's ring head-pad on braided hair; a close oiled cap of teal cloth. Every piece sits close on the head, one clear silhouette each, readable from far away. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rust, ochre and teal on pale stone, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels costume-party
```

### 14. The Forest of Antennas (`antennas`)

```
Character design sheet for a science fiction exploration game: the headwear of the menders of a forest of giant radio masts, who climb with tools at their belts, in lilac and rust. Three pieces, each worn by a head-and-shoulders figure, front and three-quarter view: a mast-mender's close cap with brass goggles pushed up on it; a climbing hood buckled under the chin; a band of braided wire round the brow. Every piece sits close on the head, nothing sticking up from it, one clear silhouette each, readable from far away. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, lilac, rust and brass, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels costume-party
```

### 15. The Fallen Ring (`fallen-ring`)

```
Character design sheet for a science fiction exploration game: the headwear of herders and villagers living under the fallen hulls of a broken ring, in ivory, sage and faded vermilion. Three pieces, each worn by a head-and-shoulders figure, front and three-quarter view: a herder's ivory hood; a round felt cap; a hull-worker's head-cloth tied at the back. Every piece sits close on the head, one clear silhouette each, readable from far away. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, ivory, sage and faded vermilion, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels costume-party
```
