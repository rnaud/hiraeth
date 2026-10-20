# The traveller's ship, redesigned: reference prompts (issue #573)

2026-10-20. The author: "Do some redesigns of the traveler's ship to be more interesting. Put it in references
and I'll check later and decide if we redesign it fully or not." Nothing is modelled from these: they are options
for the author to look at, heart, and decide whether the ship gets a full redesign.

**Today's ship** (docs/systems/ship.md): the angular hull picked on 2026-10-09
(`references/The Travellers Ship/Angular Exterior - Selected/reference-4.jpeg`), built twice the blockout's size
for room inside (issue #338): a long faceted box, low and broad, 52 m long, 16.8 m wide, 12 m tall, a wedge bow
with a wide windshield, worn cream enamel, lavender panels on the aft half, one coral stripe, two slender cream
engine pods rising from the stern like fins, short splayed legs, a side door with a steep stair-ramp. It reads
as a well-made box: a calm silhouette, nothing a player remembers it by, nothing about it that says who lives in
it or how it lands. The inside is what has to stay plausible: the cockpit at the bow (the pilot's seat, the
console where the recordings play), the main room (the galley, the dining table, the reading corner, the
workbench), the lab, the living quarters (the bunk in its alcove), the hold by the hatch where Anselm stands.

**The directions.** Eight exterior redesigns, each more interesting in one different way, all still a small ship
one traveller lives in, his family's, with those rooms inside. Each is one view of one ship, front-left
three-quarter, landed on the same pale desert with the traveller at the foot of the ramp, so the options compare
side by side.

| Id | What makes it interesting |
|---|---|
| `heron` | how it lands: high on long jointed legs, a long stair folding down from its belly |
| `lighthouse` | its silhouette: standing upright, its rooms stacked as floors, a glass cupola on top |
| `sail-barge` | a signature feature: great ribbed light-sails that open over the hull when it is parked, to drink light |
| `caravan` | lived in: an awning, a porch at the top of the ramp, plants, a washing line, patched panels |
| `ring-drive` | a signature engine: a great open ring round the stern that the hull threads through |
| `bathyscaphe` | its character: an old deep-sea bathyscaphe, a float hull over a porthole cabin, a glass-ball cockpit |
| `heirloom` | its story: three generations of ship bolted together, a different faded enamel for each |
| `clamshell` | it changes when parked: its upper hull opens like a beetle's wing-cases into two shade wings |

**Running them.** Text alone (new designs, so no `--refs`), Gemini and OpenAI (the lab's defaults), two pictures
each: `node scripts/gen-reference.mjs --from docs/design/ship-redesign-prompts.md#<id> --n 2`. The batches wait
in the reference lab (`reference-lab.html` on a dev server, Debug → Reference lab), To pick; **Pick all** goes
through them one at a time. A pick goes to its direction's folder with its `manifest.json`; **None of them…**
turns a direction down with a reason.

## The results (2026-10-20, to pick)

All eight ran, Gemini (`nano-banana-2.1`) and OpenAI (`gpt-image-2`), two pictures each: 32 candidates, about
$1.20. Every one is in the lab, To pick; nothing is dropped. The overview,
`references/The Travellers Ship/redesign/options-2026-10-20.jpg`, puts them all on one sheet under today's ship
(the picked reference and three views of the game's hull in the Desert), each row Gemini 1, 2 then OpenAI 1, 2.

The strongest, for a full redesign:

1. **`heirloom`**, OpenAI 1 and 2. The best idea and the best fit: the ship tells the family's story from outside
   (the grandparents' yellow pod as the cockpit with the scar across it, the parents' cream living box, the
   lavender lab with its observatory dome, odd engines), it keeps today's colours and stripe, and its modules are
   the rooms already inside (cockpit, main room, lab, hold), so the interior maps onto it with little change.
   The asymmetric silhouette is the most memorable of the eight at arrival distance.
2. **`heron`**, OpenAI 1 (Gemini 1 for the tallest stance). The landing becomes the ship's character: high on four
   jointed legs, a long stair folding down from the belly, a pool of shade under it to stand in. The hull stays
   close to today's (cream, lavender, coral, a long deck with a wraparound bow window), so it is the smallest step
   from the current model, and the legs give the arrival and the take-off something to animate.
3. **`caravan`**, OpenAI 2. The most lived-in: an awning over a porch at the top of the ramp, a table and chairs,
   plants, a water tank, washing on a line, patched panels. It says one person lives here better than any other,
   and its porch and props could be added to whichever hull is chosen, even today's.

Also strong: `ring-drive` (the cleanest single signature, the ring reads from anywhere; Gemini 2 and OpenAI 2),
`sail-barge` (the light-sails tie to the ship drinking light and being drained by it; OpenAI 2) and `clamshell`
(a real transformation when parked; the OpenAI pair). `bathyscaphe` is charming but busy and drifts towards
steampunk brass; `lighthouse` is a striking silhouette but stacks the rooms on floors, where today's interior is
one long deck, so it means rebuilding the inside too.

Target folder: `references/The Travellers Ship/redesign/<id>/`

Every prompt shares the scale line (the traveller, the ship's size, the door) and the style suffix, so the sheets
compare. The Midjourney flags stay: the lab turns `--ar` into the aspect ratio and `--no` into a closing
"Avoid: …".

## The prompts

### 1. The heron (`heron`)

**Main: standing high on long legs, the stair folded down.**

```
Vehicle concept art for a science fiction exploration game: ONE small inherited family spaceship that a single traveller lives in, seen whole in one exterior view from the front left, landed on a pale peach desert plain under a clear pale aqua sky. Its landing is its character: the ship stands high on four long slender jointed legs like a wading heron, each leg bent backwards at a knee and ending in a broad round foot pad, the hull held about eight metres above the sand with a pool of lavender shadow under it; in flight the legs fold up into long grooves along the belly. The hull is a compact faceted lens, broad and shallow, with a wide wraparound cockpit window at the bow, a row of small square windows along the side and two short engine nacelles at the stern. From the middle of the belly a long light stair unfolds down to the sand in three hinged flights with thin rails, its hatch open above it. Worn cream enamel, muted lavender panels, a single coral stripe, faded paint, a dark scorched scar on its flank, a small antenna and a hatch on the roof. Inside it (not shown) a cockpit at the bow, a main room with a galley, a dining table and a reading corner, a small laboratory, a bunk room and a cargo hold: the hull is deep enough for them on two decks, its windows where those rooms would be. Shared scale: a cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the foot of the stair, small against the ship; the ship is about 45 metres long and its hull about 12 metres deep, the hatch about 3 metres tall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream and lavender, coral accent, peach sand, aqua sky, lavender shadows, restrained cream paper grain, clear readable construction, spacious calm composition, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels collage cutaway turnaround diagram multiple-ships fighter saucer
```

### 2. The lighthouse (`lighthouse`)

**Main: an upright ship, its rooms stacked as floors.**

```
Vehicle concept art for a science fiction exploration game: ONE small inherited family spaceship that a single traveller lives in, seen whole in one exterior view from the front left, landed upright on a pale peach desert plain under a clear pale aqua sky. Its silhouette is its character: the ship stands on its tail like a lighthouse or a stout old rocket, a tall rounded tower of a hull, broader at the base, on four splayed fin-legs with round pads. Its rooms are stacked as floors and read from outside: at the top a glass cockpit cupola in a ribbed frame with a small antenna mast, below it a floor of living quarters with a ring of round windows and a narrow balcony walkway round it with a rail, below that a floor with a laboratory's wide window and a small telescope hatch, and at the foot the cargo hold, from which a broad ramp is let down to the sand under a hinged door. Three engine bells under the base between the legs. Worn cream enamel, muted lavender bands, a single coral stripe spiralling once round the hull, faded paint, a dark scorched scar on one side, ladder rungs up the hull. Inside it (not shown) a cockpit at the top, a main room with a galley, a dining table and a reading corner, a small laboratory, a bunk room and a cargo hold. Shared scale: a cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the foot of the ramp, small against the ship; the ship is about 40 metres tall and 16 metres across at its widest, the hold's door about 3 metres tall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream and lavender, coral accent, peach sand, aqua sky, lavender shadows, restrained cream paper grain, clear readable construction, spacious calm composition, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels collage cutaway turnaround diagram multiple-ships fighter saucer
```

### 3. The sail barge (`sail-barge`)

**Main: a long low hull, its light-sails open over it.**

```
Vehicle concept art for a science fiction exploration game: ONE small inherited family spaceship that a single traveller lives in, seen whole in one exterior view from the front left, landed on a pale peach desert plain under a clear pale aqua sky. Its signature is its sails: the ship is a long low hull like a river barge or a sand yacht, a rounded boat-like bow with a wide cockpit window, a long covered cabin roof with a row of windows, and when parked it opens great ribbed light-sails to drink the sunlight: three tall fan-shaped sails of thin translucent cream membrane on folding spars, rising from the roof like a junk's sails, half open and catching the light, thin rigging lines to a short mast. Two small engine pods low at the stern. It stands on short sturdy legs with flat pads; a side ramp with rope-like rails comes down from a door amidships. Worn cream enamel hull, muted lavender sails' ribs, a single coral stripe along the gunwale, faded paint, a dark scorched scar on its flank. Inside it (not shown) a cockpit at the bow, a main room with a galley, a dining table and a reading corner, a small laboratory, a bunk room and a cargo hold, all on one long deck. Shared scale: a cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the foot of the ramp, small against the ship; the hull is about 45 metres long and 10 metres tall, the sails rising another 20 metres, the door about 3 metres tall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream and lavender, coral accent, peach sand, aqua sky, lavender shadows, restrained cream paper grain, clear readable construction, spacious calm composition, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels collage cutaway turnaround diagram multiple-ships fighter saucer
```

### 4. The caravan (`caravan`)

**Main: a ship that is a home, set out for a stay.**

```
Vehicle concept art for a science fiction exploration game: ONE small inherited family spaceship that a single traveller lives in, seen whole in one exterior view from the front left, landed on a pale peach desert plain under a clear pale aqua sky. It is a home first: a broad, rounded, slightly boxy hull like an old travelling caravan, a wide cockpit window at the bow with a sun visor, a side door amidships at the top of a short ramp, and set out around it for a stay: a striped canvas awning unrolled from the hull over a little porch deck at the top of the ramp, a folding table and two mismatched chairs under it, a hanging lamp, potted plants in crates along the rail, a big water tank strapped to the side, a washing line strung from an antenna to a pole with a shirt and a towel on it, a small round perch by the door for a little drone, a ladder to the roof where a solar panel is propped up. Patched mismatched hull panels, hand-painted repairs, rivets, a rounded engine pair at the stern, short sturdy legs with round pads. Worn cream enamel, muted lavender panels, a single coral stripe, teal and rust awning, a dark scorched scar on its flank. Inside it (not shown) a cockpit at the bow, a main room with a galley, a dining table and a reading corner, a small laboratory, a bunk room and a cargo hold. Shared scale: a cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the foot of the ramp, small against the ship; the ship is about 40 metres long and 12 metres tall, the door about 3 metres tall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream and lavender, coral and teal accents, peach sand, aqua sky, lavender shadows, restrained cream paper grain, clear readable construction, spacious calm composition, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels collage cutaway turnaround diagram multiple-ships fighter saucer
```

### 5. The ring drive (`ring-drive`)

**Main: a hull threaded through a great open ring.**

```
Vehicle concept art for a science fiction exploration game: ONE small inherited family spaceship that a single traveller lives in, seen whole in one exterior view from the front left, landed on a pale peach desert plain under a clear pale aqua sky. Its signature is its engine: round the stern stands a great open ring, as tall as the ship, held on three slender spokes, its inner face lined with pale teal glowing segments, and the hull's tapering tail threads through the middle of it; when landed, the ring's lower edge rests on the sand as the ship's rear foot. The hull itself is a smooth elongated teardrop with a faceted underside, a broad sloping cockpit window at the rounded bow, a row of oval windows along the side, a door amidships with a gentle ramp to the sand, and two short forward legs with round pads. Worn cream enamel, muted lavender panels, a single coral stripe running from the bow into the ring, faded paint, a dark scorched scar on its flank. Inside it (not shown) a cockpit at the bow, a main room with a galley, a dining table and a reading corner, a small laboratory, a bunk room and a cargo hold, on one deck the length of the hull. Shared scale: a cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the foot of the ramp, small against the ship; the hull is about 45 metres long and 12 metres tall, the ring about 22 metres across, the door about 3 metres tall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream and lavender, coral and pale teal accents, peach sand, aqua sky, lavender shadows, restrained cream paper grain, clear readable construction, spacious calm composition, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels collage cutaway turnaround diagram multiple-ships fighter saucer
```

### 6. The bathyscaphe (`bathyscaphe`)

**Main: an old deep-sea vessel for space.**

```
Vehicle concept art for a science fiction exploration game: ONE small inherited family spaceship that a single traveller lives in, seen whole in one exterior view from the front left, landed on a pale peach desert plain under a clear pale aqua sky. Its character is an old deep-sea bathyscaphe made for space: a long rounded float hull on top like a fat cigar with small stabiliser fins at the back, and slung under it a heavier cabin with rows of round brass-rimmed portholes; at the bow of the cabin a big glass ball cockpit in a riveted brass frame, a pilot's seat visible inside it; riveted curved plates, hatches with hand-wheels, a few round pods like ballast tanks along the sides, two ducted propeller-like engines at the stern. It sits on four short stubby legs with round pads; a hinged ramp comes down from a round door in the cabin's side. Worn cream enamel, muted lavender float hull, a single coral stripe, brass fittings gone green at the edges, faded paint, a dark scorched scar on its flank. Inside it (not shown) a cockpit in the glass ball, a main room with a galley, a dining table and a reading corner, a small laboratory, a bunk room and a cargo hold. Shared scale: a cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the foot of the ramp, small against the ship; the ship is about 45 metres long and 14 metres tall, the round door about 3 metres across. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream and lavender, coral accent, aged brass, peach sand, aqua sky, lavender shadows, restrained cream paper grain, clear readable construction, spacious calm composition, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels collage cutaway turnaround diagram multiple-ships fighter saucer
```

### 7. The heirloom (`heirloom`)

**Main: three generations of ship bolted together.**

```
Vehicle concept art for a science fiction exploration game: ONE small inherited family spaceship that a single traveller lives in, seen whole in one exterior view from the front left, landed on a pale peach desert plain under a clear pale aqua sky. Its story is in its hull: three generations of ship joined into one, asymmetric and characterful. At the bow the oldest part, a small round grandparents' pod with a big curved cockpit window, its pale yellow enamel the most faded, a dark scorched scar across it; behind it, joined by a ribbed collar, a boxy middle module the parents added for living in, cream enamel with a single coral stripe and a row of square windows, a side door with a ramp down to the sand; behind that a newer, slimmer module in muted lavender with a small observatory dome and a telescope slot on its roof, the laboratory; at the stern a mismatched pair of engines on different pylons, one older and rounder than the other. Each part has its own landing legs of a different make with round pads, flexible gangway bellows and bundled cables between the modules, hand-painted repairs and rivets. Inside it (not shown) a cockpit in the old pod, a main room with a galley, a dining table and a reading corner, a small laboratory, a bunk room and a cargo hold. Shared scale: a cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the foot of the ramp, small against the ship; the ship is about 45 metres long and 12 metres tall, the door about 3 metres tall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, faded yellow, cream and lavender, coral accent, peach sand, aqua sky, lavender shadows, restrained cream paper grain, clear readable construction, spacious calm composition, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels collage cutaway turnaround diagram multiple-ships fighter saucer
```

### 8. The clamshell (`clamshell`)

**Main: the upper hull opened into two shade wings.**

```
Vehicle concept art for a science fiction exploration game: ONE small inherited family spaceship that a single traveller lives in, seen whole in one exterior view from the front left, landed on a pale peach desert plain under a clear pale aqua sky. It changes when it is parked: a smooth rounded wedge of a hull whose two great upper panels are hinged along the spine and, once landed, lift open like a beetle's mechanical wing-cases into two broad shade wings over either side, revealing rows of pale radiator fins, coolant pipes and the tops of two engines underneath, and casting wide shadows on the sand; under the near wing a door with a ramp comes down into the shade. A wide wraparound cockpit window at the bow, a row of small windows along the lower hull, short sturdy legs with round pads. The panels are machined and precise, made of plates and hinges, not organic. Worn cream enamel outside the wings, muted lavender on their undersides, a single coral stripe along the lower hull, faded paint, a dark scorched scar on its flank. Inside it (not shown) a cockpit at the bow, a main room with a galley, a dining table and a reading corner, a small laboratory, a bunk room and a cargo hold, all in the lower hull under the wings. Shared scale: a cloaked adult human traveller of ordinary height with a round jade fluid backpack stands at the foot of the ramp, small against the ship; the ship is about 45 metres long and 12 metres tall with the wings closed, the door about 3 metres tall. Moebius science-fiction, Franco-Belgian ligne claire, exquisite fine pen contours, sparse delicate hatching only in shadows, luminous flat pastel gouache colours, cream and lavender, coral accent, peach sand, aqua sky, lavender shadows, restrained cream paper grain, clear readable construction, spacious calm composition, no lettering --ar 16:9 --no photorealism 3d-render text watermark lettering labels collage cutaway turnaround diagram multiple-ships fighter saucer
```
