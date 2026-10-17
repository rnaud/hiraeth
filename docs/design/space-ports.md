# Space ports in the cities: plan and reference prompts (issue #397, phase 1)

2026-10-17. The author: "Cities should have space ports." Today the ship sets down on a bit of open ground in
each city (`level.shipSite`, or `SITE_OVERRIDES` in `src/ship/sites.js`), and nothing says that a city of a
star-faring people sees ships come and go. This file plans a port for every city: where it goes, what it does
for that city, what it holds, and whether the landing moves. Its prompts, one per city, are in
[space-port-prompts.md](space-port-prompts.md).

**Built (v1.84, issue #441).** The author picked a sheet for each city in the reference lab (issue #437,
`references/space-ports/<id>/sheet-1.jpg`), and all nine ports are drawn after them from one shared kit: the data in
`src/levels/ports.js`, the kit in `src/levels/port-pad.js` and `src/levels/port-craft.js`, how it works in
docs/systems/worlds.md, "Space ports". The v1.83 stand-in on the Pier (issue #397) is gone, the Pier port of its sheet in
its place. What is below is the plan as it was written before the picks; where the built ports differ, the code and
docs/systems/worlds.md say what is.

## The rule for every port: the landing does not move

Each city's landing was placed with care: the arrival view out of the ramp (`scripts/arrival-views.mjs`), the
first quest-giver a few steps away (Bastien at the lock, Rosa on the Pier, Halden by the discs, Madame Sel by
the landing), the contact audit over the hull's whole plan (`tests/contact-audit.test.js`) and the sequences'
arrival fixtures. So **in every city the port grows round the ship's present site**: the pad is laid under the
hull, the docks, cranes, staff and cargo stand round it where the ground is free, and the quest-giver stays where
players meet them. What changes for the first walk in is only what you see round the ship: the city's traffic,
a harbourmaster, cargo on its way somewhere. Two cities could later change the arrival itself (the Underwater
City's lock, the City-Shaft's cradle), and both are noted below as options, not as part of this phase. **Both built
(v1.84, issue #451)**: the landing site and the walk off the ramp unchanged, the berth's step added to the arrival
and the take-off (docs/systems/worlds.md, "Space ports", Berths).

Sight lines to keep in every port: nothing taller than the ship's hull between the ramp's foot and the city's
landmark in the arrival view (the numbers per city below come from the serendipity map's data,
`src/serendipity-page/collect.js`: distance from the landing, as the crow flies).

## City by city

### The City-Shaft (`incal`)

- **Today**: the ship lands on the east rim (331, 200, −10), the shaft's 274 m-wide void to the west. Corvin
  Sale 47 m, the Warden's Well 69 m, the makers' court 80 m, Lio's dispatch mast 92 m, the cab rank 118 m; the
  Lodestar hangs over the shaft's middle, 274 m off.
- **The port: the Rim Docks.** A run of cantilevered cradles bolted to the rim over the drop, the ship's pad the
  biggest of them; Lio's dispatch mast becomes the port's tower, its lamp signalling the cabs. The city's own
  cabs are the small craft: queued at a stand by the pad, rising out of the shaft on the cab lanes.
- **Holds**: cradles and a gantry crane on rails along the rim, cab stands, a dock warden in the rim's lacquered
  uniform, crates and baskets lowered into the shaft on cables (the ration for the guard starts here).
- **Look**: the rim's rich pastel lacquer and brass over iron, everything hung over the void.
- **Landing**: stays. Keep the view west across the shaft to the Lodestar clear of cranes. Option for later: the
  ship settling into a cradle that swings it in over the rim (a cinematic change, the takeoff too). **Built (v1.84,
  issue #451)**: the cradle hangs between towers past the bow and the stern; the ship sets down in it swung out toward
  the shaft and it swings in over the rim's paving (the villas in front of the ramp keep the swing to about 9 m).

### The Signal Market (`bazaar`)

- **Today**: the ship lands south of the market (20, 0, 151); Doss 22 m, Madame Sel "by the landing" 25 m (the
  main quest's first step), the lantern sellers' gallery 69 m, the silent tower 326 m north up the avenue. The
  market already flies cabs up the avenue's middle.
- **The port: the Callsign Apron.** A paved apron at the market's south end under a thicket of antenna masts
  and signs that announce each arrival, the cab stand where the avenue's cabs turn round, stalls selling to
  crews as they step off.
- **Holds**: the apron's painted pad, a mast of call-sign boards (every ship's sign in lights), a callsign clerk
  at a window who logs every ship (the harbourmaster), crates of radios and antenna parts, two parked freighters.
- **Look**: the market's sea-green paving and coral and slate walls; signs everywhere, one board left dark.
- **Landing**: stays. Keep the axis north up the avenue to the silent tower clear; Madame Sel stays at the
  apron's gate.

### The Underwater City (`underwater`)

- **Today**: the ship stands on the Dock's dome (5.4 east of 0, 134); the lock takes it down. Bastien at the lock
  11 m (the main quest's first step), the divers' rack 15 m, the moon pool 20 m, the pod tower's door 49 m.
- **The port: the Dock itself, made a port.** A surface pontoon ring round the dome where ships set down, the
  lock shaft under it; inside, the moon pool where the city's pods and subs come and go.
- **Holds**: the pontoon's pad and bollards, the lock's great doors, pods gliding outside the glass on lanes,
  Bastien as the lockkeeper (he already is), divers' cargo nets and air bells.
- **Look**: coral pinks and sea teals under glass, brass lock gear, the pods round like bathyscaphes.
- **Landing**: stays. Option for later: show the ship going down the lock (the arrival's last shot). **Built (v1.84,
  issue #451)**: four columns on the ring, the ship set down on the lift's plate 12 m up and lowered onto the dome.

### The City Floating in Space (`spacecity`): the stand-in is here

- **Today**: the ship lands on the Pier, a round dock at the city's south (0, 0, 128). Rosa on the Pier 8 m (the
  main quest's first step), Amaro's Oil-Lamp Shop 20 m, the telescope at the Pier's end 35 m; the bridges north
  to the Gate, the Market and the Mooring-House 295 m off.
- **The port: the Pier port.** The Pier is already the city's landing; the port makes it a harbour of the
  moorers: iron cradles hung off its rim on cables, small lamp-boats moored in them, a harbour lamp-mast, the
  craft of the islands circling slowly between them.
- **Holds**: the pad's ring round the ship, two to four docks, a harbourmaster with a chalk-board log (Rosa
  chalks the bridges; the harbour needs its own), oil casks and lamp crates for the islands, craft on loops.
- **Look**: cream, salmon and coral adobe, dark teal iron (the Balcony's railing), the moorers' cables.
- **Landing**: stays (the stand-in proves it: the docks either side of the bridge, the ring under the hull, the
  ramp's view north and Rosa untouched).

### The Glass Dunes (`glassdunes`)

- **Today**: the ship lands at the valley's south (0, 0, 250); Halden "by the discs" 26 m (the main quest's
  first step), the window in the sand (domes below) 49 m, Marit's Kiln-Stall 79 m, the Clock-House 186 m east.
- **The port: the Float Yard.** The makers' landing discs are already there beside the ship: the port is the
  glassworkers' yard round them, where float-sledges load the glass floats and carriers' craft land.
- **Holds**: the makers' discs as the pad (the one place the makers' ancient high tech belongs in a port here),
  racks of glass floats, the carriers' float-sledges and a skiff with a glass hull, a yard boss with a tally.
- **Look**: sand gold, bottle-green glass in breaking waves, the camps' canvas; the discs pale stone with a line
  of light.
- **Landing**: stays; keep the view east to the Clock-House and its clock.

### The City During the Eclipse (`eclipse`, off the route, in progress)

- **Today**: the ship lands on the esplanade south of the gate (0, 0, 96); Mira 74 m, the Lantern Square past the
  gate, the top of the bowl 214 m.
- **The port: the Lantern Esplanade.** A ceremonial landing terrace: limewashed pylons with lamps lit at noon,
  lamp-bearers who walk a ship in under the black sun, a small craft or two with lantern sails.
- **Holds**: the terrace's pad marked in lamps, pylons and a signal tower with a mirror, a lamp-bearer master,
  baskets for the feast's tables.
- **Look**: limewash white and rose under the corona's light, lamps everywhere, long eclipse shadows.
- **Landing**: stays, the gate on the ramp's axis.

### The Salt Harbour (`saltharbour`, off the route, in progress)

- **Today**: the ship lands on the open salt south of the street (0, 0, 92); Marrow 15 m, Hesper 86 m (she keeps
  the harbour book), the terracotta hull's deck 158 m.
- **The port: the Salt Quay.** A harbour that lost its sea and found ships of another kind: a landing field
  staked out on the salt with the old mooring ropes, a crane made of a ship's mast and boom, the harbour book
  kept at a window in a hull.
- **Holds**: the staked pad and its rope ring, the mast crane, Hesper as the harbourmaster (she already is), sea
  chests and herb crates, a sand-skiff on runners and a small hopper craft.
- **Look**: white salt, terracotta and weathered blue hulls, sailcloth overhead.
- **Landing**: stays; keep the view north up the street to the ship standing on its stern.

### The City Behind the Waterfall (`waterfall`, off the route, in progress)

- **Today**: the ship lands on a stone shelf outside the cavern's east mouth (140, 0, 2); the promenade and its
  balconies over 230 m west, Aldo 233 m.
- **The port: the Falls Ledge.** A carved landing shelf with a docking niche cut into the cliff, spray over it,
  small craft that fly out through the slits in the falls.
- **Holds**: the shelf's pad, a niche with a gantry, a ledge keeper, crates hauled into the cavern on a cable.
- **Built** (v1.84, #441, #447): a docking niche cut into the cliff north of the ship, ahead of its nose (an arch 20 m
  wide on a lit hall, a loading dock with steps; `waterfall.js` `NICHE`), a gantry bolted over it with a crate on its
  cable, crates on the dock and at its foot, puddles and moss, two darts parked, two in flight, Tully at the niche.
- **Look**: wet grey stone, moss, the white falls and the sunlit valley below.
- **Landing**: stays; the cavern's mouth on the ramp's axis.

### The Buried Machine (`buried`)

- **Today**: the ship lands at the stokers' town (−3, 5, 101.5); Jot 26 m, Mott's Tooth-Counter 32 m, Wen by the
  great dome 65 m (the main quest's first step), the great wheel 248 m.
- **The port, if any: a freight stage.** A town of stokers, not a city of travellers: at most a loading stage for
  the oil and the teeth the town trades, an ore hopper on a crane. Lowest priority.
- **Landing**: stays.

## What's shared and what's each city's

Shared (one kit, `src/levels/port-pad.js` grown from the stand-in, every piece data-driven):

- **the pad**: a ring and chevrons round the ship's site, landing lights, a place for a number or a sign;
- **the docking frame**: a cradle, a post with a jib or a gantry, a cable, a lamp;
- **the craft family**: the cab's body as the small craft (re-skinned per city), plus a picked freighter and a skiff;
- **traffic**: loops and lanes over the city as data, craft moored or parked baked into the city's meshes;
- **cargo**: crates, casks, nets, baskets from the kits the cities already have;
- **the harbourmaster's spot**: a person with a log, one or two lines, standing clear of the ramp.

Each city's own: the palette and materials, the pad's surface (painted deck, makers' discs, salt and stakes,
lamps, a pontoon), the frame's build (iron and cable, brass lacquer, ship masts, limewash pylons, carved stone),
the craft's skins and shapes, the staff's costume, the cargo's goods, and the port's sound.

## The prompts

One sheet per city, in [space-port-prompts.md](space-port-prompts.md), run in the reference lab (issue #437): the
port seen from above three-quarter, a close view of the pad with the ship's size shown, and the small craft, in the
game's look. The author picks the sheets worth modelling in the lab's Pick mode.

## After the picks (phase 2)

1. Commit the picked sheets (the lab saves each in `references/space-ports/<id>/` with its manifest).
2. Grow `port-pad.js` into the shared kit (the picked craft and frames as pieces) and give each city its `PORT`
   data in its level, in the city's materials.
3. Replace the Pier's stand-in with the picked design; then the City-Shaft, the Signal Market, the Underwater
   City and the Glass Dunes (the route's cities), then the side worlds as they leave WIP.
4. A harbourmaster per port (one or two toned lines, no hand-offs) and the craft's sound.
5. Check each city's arrival view (`scripts/arrival-views.mjs`), the contact audit, the quests' first steps, the
   draw calls, and Unity picture against picture.
