# Space ports: reference prompts (issues #397 and #437)

2026-10-17. The prompts for the space ports planned in [space-ports.md](space-ports.md) (issue #397): one design
sheet per city, the port seen from above three-quarter, a close view of the pad with the ship's size shown, and the
small craft, in the game's look. Each port's plan (where it goes, what it holds, the landing that does not move) is in
that file, city by city.

They run in the reference lab (issue #437, docs/systems/reference-lab.md), text alone, Gemini and OpenAI:
`node scripts/gen-reference.mjs --from docs/design/space-port-prompts.md#<id>`. The Midjourney flags they were written
with stay: the lab turns `--ar` into the aspect ratio and `--no` into a closing "Avoid: …". The author picks in the
lab's Pick mode, and a pick goes to its city's folder below with its `manifest.json`; only the picked designs are
modelled.

Target folder: `references/space-ports/<id>/`

## The prompts

### The City-Shaft, the Rim Docks (`city-shaft`)

```
Environment design sheet for a science fiction exploration game: a space port on the rim of a city built down the walls of a vast vertical shaft, rich families on the sunlit rim, the poor in the dark depths, a great lamp hanging over the void. Cantilevered landing cradles of iron and pastel lacquered panels bolted to the rim over the drop, the biggest holding a long boxy starship, a gantry crane on rails along the rim, a slender dispatch mast with a signal lamp, small flying cabs with striped awnings queueing at a stand and rising out of the shaft on lanes, crates lowered on cables, a dock warden in a high collar. Three panels: the port from above three-quarter, the landing cradle close with a person for scale, three small craft side by side. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rose, lavender and pale blue lacquer with brass, rust and soot grey below, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### The Signal Market, the Callsign Apron (`signal-market`)

```
Environment design sheet for a science fiction exploration game: the space port of a crowded market of a thousand glowing signs where one tall tower is silent. A paved landing apron at the end of the market's avenue under a thicket of antenna masts and stacked sign boards, a long boxy starship parked on a painted pad, a tall board of call signs lit for each arrival with one dark, a clerk's window logging ships, flying cabs turning round at a stand, crates of old radios and antenna parts, stalls selling to crews. Three panels: the apron from above three-quarter with the avenue running off toward the silent tower, the pad close with a person for scale, three small craft and a squat freighter side by side. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, sea green paving, coral and slate walls, signs in warm yellow and cyan, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### The Underwater City, the Dock (`underwater-city`)

```
Environment design sheet for a science fiction exploration game: the port of a city of glass domes on the sea floor. A round pontoon ring on the sea's surface round a lock shaft where a long boxy starship sets down and is lowered under the sea, great brass lock doors, below in the glass dome a moon pool where small round submersible pods like bathyscaphes come and go, pods gliding outside the glass on lanes past kelp and a distant whale, divers' racks and cargo nets, a lockkeeper in a heavy coat. Three panels: the pontoon and the lock from above three-quarter, the lock's chamber cut away with the ship inside and a person for scale, three small pods side by side. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, coral pink and sea teal, brass, pale green glass, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### The City Floating in Space, the Pier port (`space-city`)

```
Environment design sheet for a science fiction exploration game: the port of a city of heaped rounded adobe houses on islands floating in the black of space, joined by pale arched bridges, cables hanging into the void, a great pale planet over the roofs. A round pier island at the city's edge where a long boxy starship lands on a ring of painted marks, iron docking cradles hung off the pier's rim on cables with little lamp-boats moored in them, a harbour lamp-mast, a harbourmaster with a chalk board, oil casks and lamp crates, small craft circling slowly between the islands. Three panels: the pier from above three-quarter with the bridge running off to the city, one docking cradle close with a person for scale, three small craft side by side. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream, salmon and coral walls, dark teal iron, warm lamp light, black starry space, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### The Glass Dunes, the Float Yard (`glass-dunes`)

```
Environment design sheet for a science fiction exploration game: the landing yard of glassworkers' camps in a sand valley walled by giant frozen waves of green glass that broke and never fell. Ancient landing discs of pale smooth stone with a thin line of soft light, made by a vanished high-tech people, a long boxy starship resting on the largest, racks of hand-blown glass floats, float-sledges loading them, a small skiff with a glass hull, canvas shades on poles, a yard boss with a tally board. Three panels: the yard from above three-quarter with a round clock-tower house in the distance, the landing disc close with a person for scale, three small craft and a float-sledge side by side. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, sand gold, bottle green glass, ochre canvas, pale stone, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### The City During the Eclipse, the Lantern Esplanade (`eclipse`)

```
Environment design sheet for a science fiction exploration game: the landing terrace of a city of limewashed houses, domes and round towers on terraces round great stairs, at midday under a total eclipse, the black sun and its corona over the roofs, every lamp lit at noon. A ceremonial esplanade before the city gate where a long boxy starship lands between rows of limewashed pylons topped with lamps, lamp-bearers in long pale robes walking the ship in, a signal tower with a great mirror, a small craft with lantern sails, baskets carried to the feast tables. Three panels: the esplanade from above three-quarter with the gate and the stairs beyond, the landing marks close with a person for scale, two small craft side by side. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, limewash white, rose horizon light, warm lamp gold, deep blue shadow, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### The Salt Harbour, the Salt Quay (`salt-harbour`)

```
Environment design sheet for a science fiction exploration game: a harbour that lost its sea, huge weathered ships standing on their keels in a vast dry white salt basin, made into apartment buildings. A landing field staked out on the salt with the old mooring ropes, a long boxy starship set down on it, a crane built from a ship's mast and boom, the harbour book kept at a window cut into a hull, sea chests and herb crates, a sand-skiff on runners and a small hopper craft, a harbour mistress in a salt-stained coat. Three panels: the quay from above three-quarter with the street of hulls running off toward a ship standing on its stern, the staked pad close with a person for scale, two small craft side by side. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, salt white, terracotta, weathered blue hulls, sailcloth cream, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### The City Behind the Waterfall, the Falls Ledge (`waterfall`)

```
Environment design sheet for a science fiction exploration game: the landing ledge of a long cavern city hidden behind a curtain of falling water, high over a sunlit valley. A broad carved stone shelf outside the cavern's mouth where a long boxy starship lands, a docking niche cut into the cliff with a small gantry, crates hauled into the cavern on a cable, spray drifting over the ledge, small gliding craft flying out through slits in the falls, a ledge keeper in an oilskin cape. Three panels: the ledge from above three-quarter with the falls and the valley, the niche close with a person for scale, two small craft side by side. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, wet grey stone, moss green, white water, sunlit valley gold, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### The Buried Machine, the freight stage (lowest priority) (`buried-machine`)

```
Environment design sheet for a science fiction exploration game: the freight stage of a stokers' town round a vast machine buried in a rust canyon, a great wheel turning one tooth a year. A loading stage of riveted iron beside the town's dome where a long boxy starship lands, an ore hopper on a crane, barrels of oil and crates of iron teeth, a stoker foreman with a whistle, steam from the canyon stacks. Three panels: the stage from above three-quarter, the pad close with a person for scale, a small freighter and a hopper craft side by side. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rust orange, soot grey, oil black, brass, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

