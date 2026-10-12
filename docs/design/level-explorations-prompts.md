# Level explorations: reference prompts for four existing worlds

2026-10-11. The author asked for "more explorations and references for the existing levels, the green dune for
example feels a bit boring and I'd like to see what else we can come up with to make the level interesting.
let's do that with 4 levels at first to see what we get". Four worlds to start with; **any of them can be swapped**
for another:

1. **The Glass Dunes**, the "green dune" the author named;
2. **The Desert**, the first world and the first impression;
3. **The Buried Machine**, the lowest level-design score on the route (4.33 in `docs/audits/level-design-v1.49.md`);
4. **The City-Shaft**, also 4.33: huge, but its rim walk is long and samey.

For each world: what it looks like today and why it feels flat (from its code in `src/levels/`, its references in
`references/levels/<World>/`, the v1.49 audits, and screenshots taken in the game on 2026-10-11), then three
directions to make it more interesting. They keep the world's identity and story: additions and
transformations, not replacements. Each direction says how it would play (a mechanic, a loop, a reveal) and has
two sheets: an establishing view and a ground-level moment.

Plain text prompts for the reference lab (`reference-lab.html`, `scripts/gen-reference.mjs --from
docs/design/level-explorations-prompts.md#<id>`); a pick goes to the direction's folder, named in its section's
`Target folder:` line, under `references/levels/<World>/environment/explorations/<direction>/` (under
`environment/`: a world folder holds only `environment/`, `characters/` and `places/`,
`tests/reference-paths.test.js`). The lab reads one `Target folder:` line per section here
(`scripts/reference-lab/prompts.mjs` `targetFor`: an entry takes the last one above it).

Every prompt keeps the house style of the other reference prompts (`docs/design/fire-ice-prompts.md`) and the
world's own palette, and shows the small cloaked traveller with the round jade glass backpack for scale.

---

## The Glass Dunes

**Now.** A basin of amber sand, 1.5 km across, walled by dunes of fused green glass: the cliffs of the giants
(west), the billows (east), a frozen wave in the middle and the great breaking wave over the north camp. Two camps
of awnings, five glass mounds, two archways through the glass, the Clock-House east of the valley. The critical
path is 437 m (one minute) and climbs 4 m; the breaker's cairn stands 93 m up but 368 m off the path (optional
pull 3, verticality 3).

**Why it feels flat.** The same two materials everywhere: amber sand on the floor, opaque green glass on the walls,
and one valley between them, so every view down it reads the same. The glass is a wall, not a material: you can't
see into it (the "silhouettes inside" are painted shade), nothing happens in it, and the clock story (every clock
stopped at its own minute) leaves no trace in the land. Nothing at mid-distance between the walls, no reason to
leave the sand path, no height on the path and no surprise past the first look. In the game today (the landing,
mid-valley): a flat floor of sand, mint walls with dark blobs for the silhouettes, a plain mint arch; from the
landing the whole level is seen at once.

### Direction A: Time trapped in the glass (`trapped-time`)

The glass is the night the light passed, set solid. Inside the frozen waves things stand caught mid-moment:
a caravan of carriers mid-step, a flock of birds mid-wingbeat, a sandstorm's own dust held in a curl, a
glassworker reaching for a falling float. **Play:** the glass is clear where it is thin; the low sun, and
the traveller's lamp at night, shows what is inside. Each trapped scene is one of the stopped minutes (the
clocks' story told by the land): find them along the walls, and the last, in the breaking wave, is the
moment the light passed itself. The loop is reading the walls; the reveal is walking *into* a hollow wave
and seeing the scene from inside it.

Target folder: `references/levels/The Glass Dunes/environment/explorations/trapped-time/`

#### 1. Trapped time, from above (`gd-trapped-time-establishing`)

**Main: a valley of clear green glass waves with scenes frozen inside them.**

```
Environment concept art for a science fiction exploration game: a wide establishing view of a valley of amber sand walled by huge frozen waves of translucent green glass, seen from a high glass ridge at late afternoon. The glass is clear enough to see deep into it: inside the waves, caught mid-moment and lit by the low sun shining through, a caravan of cloaked carriers frozen mid-step with their loads, a flock of long-tailed birds held mid-wingbeat, a curl of sandstorm dust suspended like smoke in the glass, a tall broken clock tumbling; the biggest wave at the far end breaks over a hollow with a small camp of fabric awnings at its foot. Luminous mint and lime light pools on the sand below each wall. A small cloaked human traveller with a round jade glass fluid backpack stands on the ridge in the foreground, tiny against the view. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, emerald, mint and lime glass, warm amber sand, peach and grey-teal sky, deep teal shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 2. Inside the wave (`gd-trapped-time-ground`)

**Main: the traveller close to a glass wall, a figure frozen inside it.**

```
Environment concept art for a science fiction exploration game: at ground level beside the foot of a towering wall of translucent green glass, the low evening sun shining through it. Inside the glass, a metre beyond the surface and perfectly still, a glassworker in a long apron is frozen mid-reach toward a glowing float falling from her hands, her scarf held in the air, a little dust and sand suspended round her like stars; further in, fainter, the shapes of a pack animal and a stopped clock face. Bands of mint and lime light fall through the glass onto the amber sand, and the glass's thin edge glows. A small cloaked human traveller with a round jade glass fluid backpack stands with one hand flat on the glass, looking in, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, emerald, mint and lime glass, warm amber sand, peach light, deep teal shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction B: The singing ridges (`singing-ridges`)

The glassworkers have bored the crests of the waves into pipes, and the wind plays the dunes: wind organs
on the ridges, chimes of glass hung from poles, long flutes running down the slopes, each ridge a note.
**Play:** the valley sounds different everywhere, so you can find your way by ear; the high crests are
reachable by sand ramps and rope ladders the glassworkers' camps keep, and from up there you see the whole
basin (height on the path, the cairn becomes the organ's top pipe). A loop: the organs are out of tune since
the clocks stopped; tuning a ridge (closing or opening its stops) carries one more note across the valley,
and when all play together the Clock-House's chime answers. The sandstorm becomes an event: the whole valley
sings at once.

Target folder: `references/levels/The Glass Dunes/environment/explorations/singing-ridges/`

#### 3. The organ valley (`gd-singing-ridges-establishing`)

**Main: green glass ridges crowned with wind organs.**

```
Environment concept art for a science fiction exploration game: a wide establishing view of a basin of amber sand between long ridges of translucent green glass, seen from the sand at the valley's mouth on a windy afternoon. The glassworkers have made the dunes into instruments: rows of tall glass organ pipes rise along the ridge crests like coral, long fluted channels run down the glass slopes, tall poles carry clusters of hanging glass chimes, and a great horn of green glass opens on the highest crest like a flower; ribbons and thin streams of sand blow off the pipes' mouths, showing the wind. Rope ladders and ramps of sand climb to the crests, and a small camp of fabric awnings sits at a ridge's foot. A small cloaked human traveller with a round jade glass fluid backpack walks the sand path in the foreground for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, emerald, mint and lime glass, warm amber sand, peach and grey-teal sky, deep teal shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 4. Tuning a ridge (`gd-singing-ridges-ground`)

**Main: on a glass crest, at an organ's stops.**

```
Environment concept art for a science fiction exploration game: up on the crest of a high ridge of green glass, close up, a wind organ built by glassworkers: a cluster of tall glass pipes of different heights fused into the crest, each with a sliding brass stop and a little cloth flag, a lever wheel to open and close them, glass chimes swinging on a pole beside it, sand streaming from the pipes' mouths in the wind. Beyond, far below, the amber valley and the other ridges with their own organs, a camp of awnings small at their feet. An old glassworker in goggles and a long scarf holds her ear to a pipe. A small cloaked human traveller with a round jade glass fluid backpack turns a stop, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, emerald, mint and lime glass, warm amber sand, brass, peach and grey-teal sky, deep teal shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction C: The glass city under the sand (`sunken-city`)

The basin is the roof of a makers' city. Its towers poke out of the sand as the "mounds"; in places the
sand has blown off a clear window of glass in the valley floor and you look straight down into lit streets
below. **Play:** the open windows in the floor are the mid-distance landmarks (each a glimpse of something
below: a square, a clock tower, a stair), and the wind moves the sand so they open and close. A sinkhole by
the Clock-House leads down into the city's streets, where the light comes through the sand-roof in green
shafts and the Clock-House turns out to be the top of its tallest tower. The reveal: looking up from the
city at the traveller's own footprints in the sand on the glass.

Target folder: `references/levels/The Glass Dunes/environment/explorations/sunken-city/`

#### 5. Windows in the sand (`gd-sunken-city-establishing`)

**Main: the valley floor with clear glass windows into a city below.**

```
Environment concept art for a science fiction exploration game: a wide establishing view of a valley of amber sand between walls of translucent green glass, seen from a low glass mound. In the valley floor the wind has swept the sand off great patches of clear green glass, like frozen ponds, and through them you look straight down into a city buried below: domes, round towers, lit streets and bridges, a square with a clock tower, all glowing faintly emerald under the sand. The tops of the city's tallest towers break through the sand as smooth glass spires and domes. Sand pours in thin streams over the edges of a broken window into the depths. A small cloaked human traveller with a round jade glass fluid backpack kneels at the edge of the nearest window, looking down, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, emerald, mint and lime glass, warm amber sand, peach and grey-teal sky, deep teal shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 6. The streets under the sand (`gd-sunken-city-ground`)

**Main: in the buried city's streets, the sand-roof overhead.**

```
Environment concept art for a science fiction exploration game: at street level in an old city buried under a desert of green glass, the sky replaced by a vast ceiling of translucent glass with sand drifted over most of it, so the light falls through the clear patches in long shafts of mint and lime onto the streets. Round houses and arcades of pale stone and green glass, a dry fountain, a tall clock tower whose top disappears through the ceiling, little piles of sand that have trickled down onto the steps, glowing glass floats left on a doorstep; through a clear patch overhead, far up, the soles of a passing glassworker's boots. A small cloaked human traveller with a round jade glass fluid backpack walks down the empty street for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, emerald, mint and lime light, pale stone, warm amber sand, deep teal shade, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

---

## The Desert

**Now.** Open orange dunes ridden on the bike, with Qanat round its burning tree, the pilgrims' camps at its gate,
the giant's skull and the cave in its chest, Marrow's hollow, the riders' red-strip poles out to the Hearth (1.16 km),
the pilgrims' road home, mesas and banded towers on the skyline. A 5.7 km, 12-minute path; score 4.

**Why it feels flat.** One ground everywhere: the same apricot sand from the ship to the horizon, with the
interest at the ends (Qanat, the mesas) and nothing at mid-distance: of 37 optional places one sits 30–150 m off
the path, 25 on it and 11 far. From the bike the dunes are smooth and low, so there is no height to climb and no
dip to come over; the giants' story (they carried the water and lay down where they could go no further) is
told by one skull and one ribcage, and the water that has not risen leaves no mark on the land. Nothing changes
when the tree drinks except the tree. In the game today (the landing, the ride to the Hearth): Qanat and its
smoke straight ahead, then a long apricot slope with a red-strip pole on it and mesas far off, nothing between.

### Direction A: The giants' road (`giants-road`)

The giants did not lie down in one place: they fell one by one along their road from the swamp of lights, and
the desert is their long procession. Bones every few hundred metres in a line toward the horizon: a hand
half-buried like a ruin, an arm lying as a bridge over a dry wash, a spine you climb like a stair to a
lookout on its skull, a jaw the pilgrims shelter under. **Play:** the line of giants is the mid-distance
landmark the desert lacks, a path to ride, and height on the way (ride up an arm, jump off a shoulder on the
bike). Each giant carries a pilgrims' shrine with a verse of the Speaker's old words, and reading them in order
is the giants' story told by the land; the last one points toward Lorn.

Target folder: `references/levels/The Desert/environment/explorations/giants-road/`

#### 7. The road of fallen giants (`de-giants-road-establishing`)

**Main: a line of colossal fallen giants across the dunes toward the horizon.**

```
Environment concept art for a science fiction exploration game: a wide establishing view of an orange desert of dunes, seen from a high dune at morning, where a procession of colossal giants fell one after another on a long journey: their pale bones and great stone-like bodies lie in a line that winds away to the horizon, each one half-sunk in the sand, a skull here, a ribcage there, a great hand rising out of a dune like a ruin, a long arm lying across a dry riverbed like a bridge, a curled spine climbing a slope like a stair; little pilgrims' shrines with cloth banners and small fires sit in their shade, and far off a city of white domes round a tall burning tree sends up a smoke column. A small cloaked human traveller with a round jade glass fluid backpack stands beside a hoverbike on the dune in the foreground, tiny against the view. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, warm ochre and apricot sand, bone white, pale sky blue, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 8. Up the giant's arm (`de-giants-road-ground`)

**Main: riding up a fallen giant's arm that bridges a dry wash.**

```
Environment concept art for a science fiction exploration game: close at ground level in an orange desert, a colossal fallen giant's arm lies across a dry riverbed like a bridge, its pale weathered bone and stone skin cracked and patched with sand, the giant's great hand open on the far bank with its fingers sunk in a dune; pilgrims have tied strips of red and white cloth along it and set a small shrine with a carved verse stone and a brazier on its elbow; the dry wash below is lined with salt stains and old water marks. A small cloaked human traveller with a round jade glass fluid backpack rides a low hoverbike up the slope of the arm, sand spraying, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, warm ochre and apricot sand, bone white, red cloth, pale sky blue, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction B: The walking dunes (`walking-dunes`)

The desert is not still. Great dunes walk across it in the wind, and as they move they cover some things and
uncover others: a buried caravan, a stair going down, the top of an old windcatcher. Sand pours over the mesas'
edges in slow sandfalls, and sand rivers run between the dunes that the bike can ride like a current. **Play:**
the land is different each time you come back from Qanat (a storm or a night moves a dune and shows a new ruin);
the sand rivers are fast lanes to ride and the dunes' steep slip faces are jumps. Sand-sailors in kite rigs ride
the wind alongside, a moving thing at mid-distance. The reveal: a dune walks off a giant's face as you watch.

Target folder: `references/levels/The Desert/environment/explorations/walking-dunes/`

#### 9. The dunes on the move (`de-walking-dunes-establishing`)

**Main: tall wandering dunes, sandfalls and sand rivers.**

```
Environment concept art for a science fiction exploration game: a wide establishing view of an orange desert in a strong wind, seen from the top of a mesa in the afternoon: huge crescent dunes with sharp crests march across the plain with long plumes of sand streaming off their tops; between them run rivers of flowing sand, rippled and fast, curving like real rivers; over the edge of a banded mesa pours a slow golden sandfall; one dune has just moved off an old ruin, showing a buried caravan of carts and the top of a tall windcatcher tower; a few sand-sailors in light kite rigs skim along a sand river. Far away a city of white domes round a tall tree. A small cloaked human traveller with a round jade glass fluid backpack stands on the mesa edge in the foreground, tiny against the view. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, warm ochre and apricot sand, banded rust and cream mesas, pale sky blue, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 10. Riding the sand river (`de-walking-dunes-ground`)

**Main: on the bike, riding a sand river past an uncovered ruin.**

```
Environment concept art for a science fiction exploration game: low at ground level in an orange desert, a river of flowing rippled sand curves between two tall dunes, sand streaming off their crests in the wind; on its bank a wandering dune has just slid off an old stone doorway with a carved lintel and a stair going down into the dark, sand still pouring off its steps; a sand-sailor on a light board with a striped kite skims past. A small cloaked human traveller with a round jade glass fluid backpack rides a low hoverbike along the sand river, leaning into the curve, a wake of sand behind, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, warm ochre and apricot sand, striped kite, pale sky blue, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction C: The memory of water (`water-memory`)

The water that has not risen left its marks everywhere: dry riverbeds and their pale banks, salt pans that
shimmer with mirages, a line of old qanat wells (round shafts with windcatchers) running from the giants to
the city, dry cisterns people have turned into a hamlet. **Play:** the wells are a leading line and a listening
loop (put your ear to a shaft: the water moving below, nearer each time, the way Nour listens); the mirages
on the salt pans show the desert as it was when the water ran (boats, reeds), and fade when you ride in. The
reveal: when the tree drinks, the water rises in the wells, and the salt pan by the camps floods into a
shallow mirror lake for the procession to walk through.

Target folder: `references/levels/The Desert/environment/explorations/water-memory/`

#### 11. The old water's marks (`de-water-memory-establishing`)

**Main: dry riverbeds, salt pans and a line of old wells crossing the desert.**

```
Environment concept art for a science fiction exploration game: a wide establishing view of an orange desert at midday, seen from a high dune: a dry riverbed winds across it with pale banks and old boats lying stranded on their sides, a white salt pan shimmers with a mirage that shows the same place long ago as a blue lake with reeds and sails; a long line of round stone well shafts, each with a small windcatcher tower, runs straight across the dunes toward a far city of white domes round a tall burning tree; a hamlet has been built inside an old dry cistern, its arches and stairs going down. A small cloaked human traveller with a round jade glass fluid backpack stands beside a hoverbike in the foreground, tiny against the view. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, warm ochre and apricot sand, salt white, pale turquoise mirage, pale sky blue, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 12. Listening at the well (`de-water-memory-ground`)

**Main: at an old qanat well on the salt pan, the mirage behind.**

```
Environment concept art for a science fiction exploration game: at ground level on the edge of a white salt pan in an orange desert, a round old well shaft of carved stone with a little windcatcher tower over it, ropes and a clay jar at its lip, pilgrims' cloths tied to it; behind, the salt pan shimmers and a mirage hangs over it showing a lake that is not there, with reeds and a small sailing boat; a line of other wells runs away toward the horizon. An old woman in layered robes sits on the well's rim listening, and a small cloaked human traveller with a round jade glass fluid backpack kneels with his ear to the stone, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, warm ochre and apricot sand, salt white, pale turquoise mirage, pale sky blue, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

---

## The Buried Machine

**Now.** Pale cream dunes under a sage sky with domed huts and pipe elbows breaking the surface; a sand ramp down
into a trench whose walls are the machine (blue-grey pipe strata, rust-red cylinders and hatches); cross-walls
with oval openings to the oculus, a teal drum open to the sky; the great wheel sunk to its axle in the dunes east
of the canyon; overhead, far up, the hanging city upside down; a ring of arches on the horizon. Score 4.33.

**Why it feels flat.** The canyon is a corridor: once you are down the ramp the walls hide everything (landmarks
3 in the v1.49 audit: 57 % of the path sees one), and the walls are the same rust and pipe all the way along.
The machine is dead scenery: nothing moves in it but the wheel at the end, so "something inside is still alive"
is told and never seen. The hanging city, the world's best idea, is a backdrop: no line connects it to the
ground, and you never go up or in. In the game today (the landing, the canyon floor): the dunes with pipe
elbows and huts read well, with the arches' ring and the hanging lamps far off; down in the canyon the view is
walls on both sides and a strip of sky. Blind legs (Wen → the rust canyon, Wen → the Engine-House) and a walk home
the same way.

### Direction A: The Other Half hangs down (`hanging-city`)

Tie the ground to the city overhead. Cables, chains and old lift shafts hang down from the upside-down city
into the canyon and the dunes, some anchored to the machine, some swinging free; a gondola basket on a chain
stops just above the dunes; rivets and rust flakes fall like slow snow under it. **Play:** the cables are the
beacons the canyon lacks (seen from the floor, they say where the city is), and a climb: ride a lift basket
up a cable to a dangling platform halfway, from where the whole machine reads as one shape, and drop back
down on the jets. The story's "other half" becomes literal: the cables tighten as the wheel turns.

Target folder: `references/levels/The Buried Machine/environment/explorations/hanging-city/`

#### 13. The cables of the Other Half (`bm-hanging-city-establishing`)

**Main: cables and lift shafts hanging from an upside-down city into a machine canyon.**

```
Environment concept art for a science fiction exploration game: a wide establishing view of pale cream dunes under a sage green sky, a long trench cut into them whose walls are an ancient machine of blue-grey pipes and rust-red cylinders; far overhead, a whole city hangs upside down in the sky, its towers pointing down like stalactites, and from it hundreds of cables, chains and thin lift shafts hang all the way down to the ground, some anchored into the machine walls with great rusted clamps, some swinging free with gondola baskets and platforms on them, rust flakes drifting down under them like slow snow; small domed huts and a colossal half-buried cog wheel on the dunes. A small cloaked human traveller with a round jade glass fluid backpack stands on a dune in the foreground, tiny against the view. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale cream sand, sage sky, blue-grey pipes, rust red and teal, peach glow, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 14. The lift basket (`bm-hanging-city-ground`)

**Main: on the canyon floor at a cable's foot, a lift basket waiting.**

```
Environment concept art for a science fiction exploration game: on the floor of a canyon whose walls are an ancient machine of rust-red cylinders, hatches and blue-grey pipes, a thick cable hangs straight down from the sky into a great rusted clamp, and an old lift basket of riveted iron and wicker hangs from it a step above the sand, with a lever, a lamp and a small bell; looking up along the cable it climbs to an upside-down city hanging far overhead in a sage green sky, other cables and dangling platforms beside it; rust flakes drift down. A dome keeper in a patched coat holds the basket's door open, and a small cloaked human traveller with a round jade glass fluid backpack steps in, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale cream sand, sage sky, blue-grey pipes, rust red and teal, warm lamp glow, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction B: The machine breathes (`machine-breathes`)

Show that the machine is alive. Its walls move: great pistons slide in and out of the canyon walls in a slow
cycle, vents breathe steam in rhythm, oil runs in a thin waterfall from a broken pipe into a pool, a wall of
gears turns and opens an oval door once a minute. The dome people's maintenance gangways run along the walls
at mid-height, with ladders, pressure gauges and oil cans. **Play:** a rhythm to read: the doors and pistons
make a timing route along the canyon (a piston's top is a step up to the gangway when it is out), the gangways
give height and a view over the canyon's rim (the landmarks the floor can't see), and the breathing gets
faster as you near the oculus, a warmer-colder guide. Light the Wick and the whole canyon breathes at once.

Target folder: `references/levels/The Buried Machine/environment/explorations/machine-breathes/`

#### 15. The living canyon (`bm-machine-breathes-establishing`)

**Main: a machine canyon with moving pistons, steam vents and gangways.**

```
Environment concept art for a science fiction exploration game: a wide view down a long canyon whose walls are a vast ancient machine, seen from a high gangway at the canyon's rim: great pistons as big as houses slide out of the rust-red walls, steam breathes from round vents in slow white puffs, a wall of giant gears turns to open an oval door, a thin waterfall of dark amber oil falls from a broken blue-grey pipe into a shining pool on the sand floor; narrow maintenance gangways with railings, ladders and pressure gauges run along both walls at mid-height, little figures of dome keepers on them with oil cans; at the far end a teal drum open to the sky with a glowing peach porthole. A small cloaked human traveller with a round jade glass fluid backpack walks the gangway in the foreground, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale cream sand, sage sky, blue-grey pipes, rust red and teal, amber oil, white steam, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 16. Between the pistons (`bm-machine-breathes-ground`)

**Main: at the canyon floor, a piston sliding out as a step.**

```
Environment concept art for a science fiction exploration game: at ground level on the sandy floor of a canyon whose wall is a living ancient machine, a giant round piston slides slowly out of the rust-red wall, its polished top making a step up to a narrow gangway above with a pressure gauge and a hanging oil can; beside it a round vent breathes a puff of white steam, and an oval door in a wall of gears is turning half open, a warm peach light inside; oil drips and pools on the sand. A small cloaked human traveller with a round jade glass fluid backpack waits, ready to jump onto the piston, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale cream sand, blue-grey pipes, rust red and teal, amber oil, white steam, peach glow, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction C: The tooth calendar (`tooth-calendar`)

The great wheel is the dome people's calendar, and its teeth are their history. Each tooth that has turned
up out of the dunes is carved and painted with its year (a birth, a flood, the year the city above dimmed);
the wheel's rim, half buried, makes a giant stair of teeth across the dunes, and sinkholes in the sand
show the gear train going down into halls of turning wheels under the dunes. **Play:** walk the wheel's rim as
a path over the dunes (height, and a line from the domes to the wheel), read the years tooth by tooth (the
world's story told by the land), and go down a sinkhole into the gear hall, where one tooth is hollow and a
dome keeper lives in it. Lighting the Wick turns the wheel one more tooth, and a new, blank year comes up out
of the sand: the traveller's.

Target folder: `references/levels/The Buried Machine/environment/explorations/tooth-calendar/`

#### 17. The wheel of years (`bm-tooth-calendar-establishing`)

**Main: a colossal cog half buried in the dunes, its teeth carved with years.**

```
Environment concept art for a science fiction exploration game: a wide establishing view of pale cream dunes under a sage green sky, a colossal rusted cog wheel sunk to its axle in the sand, its great teeth rising out of the dunes in a curve like a stair, each tooth carved and painted with pictures of a year (a birth, a flood, a dimming city, a festival of lanterns), small figures climbing the teeth and tying ribbons; round sinkholes in the dunes beside it show more giant gears turning below in a warm amber light; a village of domed huts at its foot, and far overhead an upside-down city hangs in the sky. A small cloaked human traveller with a round jade glass fluid backpack walks along the top of the teeth in the foreground, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pale cream sand, sage sky, rust red and blue-grey iron, teal, warm amber glow, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 18. The hall under the wheel (`bm-tooth-calendar-ground`)

**Main: in the gear hall under the dunes, a hollow tooth lived in.**

```
Environment concept art for a science fiction exploration game: inside a vast dim hall under desert dunes, giant rusted gear wheels turning slowly at different heights, shafts of pale light falling through round sinkholes in the sand ceiling far above, sand trickling down in thin streams; one enormous hollow gear tooth has been made into a little home with a round door, a lamp, a hanging plant and a ladder, its outside painted with a calendar of small pictures; an old dome keeper sits at its door with a pot of oil. A small cloaked human traveller with a round jade glass fluid backpack crosses a narrow iron catwalk between the gears, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, rust red and blue-grey iron, teal, warm amber and peach lamp glow, pale cream light, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

---

## The City-Shaft

**Now.** A city stacked down a 600 m pit: terraces round the wall (the rich at the sunny top, the poor in the
depths), an acid lake at the bottom, a central spire with rings and bridges, floating pads and self-driving cabs on
circular lanes, the Lodestar over the palace. You go round on foot, down the lamplighters' drops on the jets and up
the air pillars. A 2.8 km, 6-minute path; score 4.33.

**Why it feels flat.** The rim walk is the same terrace again and again: the same pink-and-cream wall on one side,
the same void on the other, the same houses repeating round a circle, so it reads as one long curve with no
quarters (the climb from the Upward Shrine to the crown is 200 m with nothing near; the crown → Nima leg is
blind). The pit is the world's drama, but you go *round* it and never *across* it: the spire stands alone in the
middle, and the cabs' lanes are the only thing that crosses. The light story (the Lodestar fading, "nobody looks
up") has no light in the land to follow. In the game today (the landing on the rim, the crown, the shaft from
above): the rim is a sunny plaza of towers and topiary; looked down into, the terraces are rings of the same
blue-grey grid all the way to the lake.

### Direction A: Across the void (`across-the-void`)

Span the pit. Rope bridges and sagging cable walks cross from the terraces to the spire; a fallen tower lies
right across the shaft, wedged between the walls, with a market built along its back; cable cars and
basket ferries run on lines strung from rim to rim; washing lines and prayer flags fill the gaps between.
**Play:** the rim walk becomes a choice of crossings, shortcuts and loops (out by the fallen tower, back by the
ferry), each crossing a set piece with the drop beneath it; the jets save you when a bridge sways. The spire
stops being alone: it is the knot all the lines tie to.

Target folder: `references/levels/The City-Shaft/environment/explorations/across-the-void/`

#### 19. The lines across the pit (`cs-across-the-void-establishing`)

**Main: a vast city shaft crossed by bridges, cables and a fallen tower.**

```
Environment concept art for a science fiction exploration game: a wide establishing view across an enormous vertical shaft lined with a stacked city of pink and cream terraces, seen from a high terrace at the rim: rope bridges and sagging cable walks cross the void from the terraces to a tall central spire with rings; a whole fallen tower lies wedged across the shaft from wall to wall, with a long market of awnings built along its back; cable cars and wicker basket ferries hang from lines strung from rim to rim, prayer flags and washing lines between them; little flying cabs on their circular lanes; far below a turquoise acid lake glows in haze, high above a blue sky. A small cloaked human traveller with a round jade glass fluid backpack stands at the rim's railing in the foreground, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pink and cream walls, terracotta, turquoise depths, sky blue, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 20. On the fallen tower (`cs-across-the-void-ground`)

**Main: walking the market on the back of a tower that lies across the shaft.**

```
Environment concept art for a science fiction exploration game: on the back of an old tower that has fallen and lies wedged across a vast vertical city shaft, its windows now facing the sky, a narrow market street of stalls and striped awnings built along it, a cook stall steaming, lanterns on strings, a child looking over the edge; on both sides the drop falls away hundreds of metres to a turquoise lake in haze, and the stacked pink and cream terraces of the city rise on the shaft's walls ahead and behind; a cable car glides past below. A small cloaked human traveller with a round jade glass fluid backpack walks down the market street for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pink and cream walls, terracotta, striped awnings, turquoise depths, sky blue, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction B: The quarters of the rim (`rim-quarters`)

Break the circle into quarters, each with its own shape and colour so you always know where you are: the
hanging gardens (terraces spilling green over the edge), the cab-wrights' cliff (cabs parked in the wall
like birds in a cliff, workshops and cranes), the bell quarter of the Upward Shrine (bells hung out over the
void on beams, rung by the wind), the balcony market cantilevered out on stilts and cables. **Play:** each
quarter is a landmark from across the pit and a stop on the walk (density on the long legs), each has a
local errand that sends you to the next, and the bells give a sound to walk toward. Seen from the bottom the
quarters stack into one picture of the city's classes.

Target folder: `references/levels/The City-Shaft/environment/explorations/rim-quarters/`

#### 21. Four quarters round the shaft (`cs-rim-quarters-establishing`)

**Main: the shaft's wall in distinct quarters: gardens, cab cliff, bells, balconies.**

```
Environment concept art for a science fiction exploration game: a wide establishing view across an enormous vertical shaft lined with a stacked city, seen from a terrace on one side, the far wall clearly divided into different quarters: on the left hanging gardens spilling green vines and trees over the terraces' edges with waterfalls; in the middle a sheer cliff where little flying cabs are parked in holes in the wall like birds in a cliff, with workshops, cranes and ladders; on the right a quarter of great bronze bells hung out over the void on long wooden beams under small pagoda roofs; below them a market of balconies built out on stilts and cables; a tall spire with rings in the middle of the shaft, a turquoise acid lake glowing far below. A small cloaked human traveller with a round jade glass fluid backpack leans on a railing in the foreground, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pink and cream walls, garden greens, bronze, turquoise depths, sky blue, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 22. The bell quarter (`cs-rim-quarters-ground`)

**Main: walking the terrace under bells hung out over the void.**

```
Environment concept art for a science fiction exploration game: at ground level on a narrow terrace of a vast vertical city shaft, the bell quarter: great bronze bells hang out over the void from long wooden beams under small tiled roofs, their ropes tied off on the railing, prayer ribbons streaming in the updraft, a bell keeper in long robes polishing one; the terrace street is lined with pink and cream houses with round doors, steps going up and down; across the shaft the far wall's hanging gardens and the cliff of parked flying cabs. A small cloaked human traveller with a round jade glass fluid backpack reaches up to a bell's rope, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pink and cream walls, bronze, garden greens, turquoise depths, sky blue, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

### Direction C: The light that goes down (`light-down`)

The poor of the depths have no sun, so the city passes it down: a chain of great mirrors and lenses on the
terraces' edges catches the sunlight at the rim and throws it from mirror to mirror down the shaft; a beam
crawls round the wall through the day like a sundial's shadow, and where it lands a market opens and
washing comes out. Some mirrors are broken or turned away since the Lodestar faded. **Play:** follow the beam
(a moving leading line), turn mirrors back (a loop that lights a new terrace each time, the lamplighters'
work by day), and the reveal: from the acid lake at the bottom, looking up, the whole chain lit at once
and the Lodestar at its head. It makes "look up once a day" a thing you do.

Target folder: `references/levels/The City-Shaft/environment/explorations/light-down/`

#### 23. The chain of mirrors (`cs-light-down-establishing`)

**Main: sunlight thrown down a city shaft from mirror to mirror.**

```
Environment concept art for a science fiction exploration game: a wide establishing view down into an enormous vertical shaft lined with a stacked city of pink and cream terraces, seen from the rim in the morning: great round mirrors and brass lenses on swivelling frames stand on the terraces' edges all the way down, and a beam of warm sunlight zigzags from mirror to mirror down into the depths, lighting a patch of terrace far below where a market has opened in the light; some mirrors are cracked or turned away, leaving their levels dim and blue; a tall spire with rings in the middle of the shaft and a faint star-like light turning above it; a turquoise lake far below. A small cloaked human traveller with a round jade glass fluid backpack stands beside the first great mirror in the foreground, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pink and cream walls, warm golden sunbeam, brass, turquoise depths, sky blue, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```

#### 24. Turning a mirror (`cs-light-down-ground`)

**Main: on a dim lower terrace, turning a great mirror back into the beam.**

```
Environment concept art for a science fiction exploration game: on a dim lower terrace deep in a vast vertical city shaft, a great round mirror on a brass swivel frame with a crank wheel stands at the terrace edge, half turned; the traveller cranks it and a beam of warm sunlight from far above catches it and is thrown across onto the opposite wall, lighting up a row of washing lines, window boxes and people coming out of their doors to stand in it; the rest of the terrace is in cool blue shade with little lamps; far above, the bright rim of the shaft and other mirrors. A small cloaked human traveller with a round jade glass fluid backpack works the crank, for scale. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, pink and cream walls, warm golden sunbeam, brass, cool blue shade, turquoise depths, violet shadows, restrained cream paper grain, clear readable construction, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels
```
