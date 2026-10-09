# Interiors: buildings you walk into

A reusable way to enter a building and play inside it (v1.5, batch 3; batch 4 puts a shop in every world
with it). Code: `src/interior-kit.js` (the kit), `src/interiors.js` (the rooms and portals it builds on),
`src/shop-world.js` (a shop made with it). Tests: `tests/interiors.test.js`, `tests/shop.test.js`.

## Why this mechanism

The game already had rooms reached through doors: the desert's masked-head chambers, the cave in the giant's
chest, the Givers' Hearth, the temples' halls, Viridel's ship. All of them are rooms built far over the map and
reached through a pair of portals in the level's `portals`, and everything a room needs already keys off that
list: the passage (`src/passage.js`: the room drawn ahead by `WarmDraw` at load and again as you come near, the
paper sweep, landing still walking), the culling both ways (`RoomCuller` hides the rooms while you are out,
`InteriorCuller` the map while you are in: main.js finds them as the portals' destinations more than 200 m over
the ground), no whistling the mount or hailing a taxi into one, the scout routing its finds through the door
(`viaPortal`), the camera's tight framing (`inTightRoom`) and no rain indoors (`src/shelter.js`). The houses of
Home (`src/levels/home-houses.js`) are the other way, rooms inside their own walls, but a room that must fit
inside its building can't be larger than it, and nothing culls it. So the kit generalises the first way.

## The kit

```js
const it = buildInterior(scene, {
  id: 'shop.qanat', label: 'Haddu’s Chimes & Cures',   // label: the cue's place name inside
  doorLabel: 'shop door',                               // the scout: "Through the shop door"
  slot: 0,                                              // where its room is built (fixed per world)
  door: { at, heading },                                // the threshold on the ground; heading: out of the door
  front: { w, d, h, sink, wall, wall2, trim, dome, awning: [c1, c2], sign, signSub, emblem, windows },
  room: { w, d, h, windows, wall, floor, ceiling, furniture, lamp },   // src/interiors.js buildRoom's options
});
level.portals.push(...it.portals); level.lights.push(...it.lights);
```

- **The door in the world** (`buildShopfront`, or `front: false` for a door that belongs to something else): a
  plastered house in Qanat's own strata (weathered, no block grid) sunk `sink` m into the ground (the desert
  sinks it to the lowest ground under its corners), a plinth course and a parapet, a little dome on the roof, the
  door as a recess 0.6 m deep with a jamb frame and a step, two lattice windows; what shows through them is the
  warm lit inside (a self-lit sheet: no shadow). Over the door a striped awning with a scalloped hem; over that a
  name board, painted on a canvas in the game's monospace (block letters where there is no canvas: node's tests);
  beside it a hanging sign on a bracket, turned along the street: the shop's emblem (`emblem: 'chime'`, a
  pierced brass disc). A lantern by the door goes into the level's lights. The body is solid: you can climb it
  and stand on its roof.
- **The room** (`buildRoom`) is built at `interiorSlot(slot)`: `INTERIOR.y` 3000 m up (over every temple's
  rooms, whose origins reach 2400 m), 90 m apart in rows of 20. Real walls with door and window openings (the
  sun's shadow map lays bright patches through them), a floor, a ceiling, a lamp, furniture. What you see out of
  its door is the street's daylight: a self-lit sheet beyond the doorstep (`veil`), past where the way out
  takes you, not the sky over the slot.
- **The ways through** are `portalPair`'s: a step into the door's recess lands you just inside the room facing
  in; walking out of the room's door lands you 2.6 m in front of the street door facing out, too far to be sent
  straight back in.
- **Inside**, `interiorAt(p)` says which interior a point is in (the room's box, a little margin, its doorstep).
  main.js uses it so the world behaves: the cue names the building as you step in (`PlaceName`, after the usual
  1.5 s hold) and says nothing as you step back out into the street you left (`update(name, now, { quiet })`);
  the air and light are the street's at the door (`level.atmo` at `door.at`, not at the slot far overhead); the
  sound's altitude is 0 (no high-altitude wind indoors). The HUD otherwise behaves as anywhere (hearts, magic and
  wallet when they change). The scout's lookout spot is ray-cast, so it stays under the room's ceiling, and a
  find outside is "Through the door". There is no compass in the game (the scout is the way to find things).
- **A save inside loads inside**: the save keeps the world position; the slot is fixed and the same room is
  built in the same place on every load, its floor under you (tests: "a save made inside loads inside").
- **Cheap**: one merged mesh per material for the shopfront and for the room's furniture, the wares a few small
  meshes; the room is drawn ahead once (`WarmDraw`), and culled whenever you are not in it.

## A shop

`buildShop(scene, { def, slot, door, front })` (`src/shop-world.js`) is the kit furnished as a shop, 8 × 7 m and
4.2 m high: a counter across the room (`SHOP_ROOM.counter`) with a teal band and a little brass scale, the wares
laid out on it (as many corked flasks as the potion shelf holds, a heart on a cushion and a teal magic cell in a
brass cradle for each one left: `shop.show(view)` hides what is sold, src/story/shops.js keeps it to the stock),
shelves of jars behind, a large chime painted on the back wall, strings of chimes hanging by the door, lattice
windows in the side walls, a rug, a bench, pots, and two lights more than the lamp (the counter, the door). The
keeper stands behind the counter (`shop.keeper`); `shop.counter` is where E looks at the wares. What the shops
sell and the panel: docs/systems/items.md, "Shops"; docs/systems/ui.md, "The shop".

The first shop is **Haddu's Chimes & Cures** in the desert, beside the way from the pilgrims' camps up to
Qanat's main gate (camp-local −17, −42, at (204, 320): 21 m short of the gate and 17 m off the straight way, so it is passed on
the way in and in nobody's quest), its door turned to the path and a little toward the camps you come from.
`level.shops` lists a world's shops; `floraAvoid` and `clearInstances` keep its ground clear.

## A shop in every world (v1.14, batch 4)

Every route world has one shop now (`SHOPS` in src/shop.js; what they sell: docs/systems/items.md, "A shop in every
world"), each built to the author's picked references in `references/shops/<world>/` (the front, and the interior
from the prompt's v2; the prompts and the keepers in docs/design/shop-prompts.md). The desert's keeps the kit's
plastered house; the others have a front and a room of their own:

- **The fronts** (`src/shop-fronts.js`, `FRONTS[style]`, built by `buildStyledFront` through `buildInterior`'s
  `front.build`): the same frame as `buildShopfront` (the threshold at the origin on the ground, +z out, the body
  behind it sunk into the ground, solid), the door an opening 1.3–1.5 m wide and 2.3–2.5 m high (arched where the
  picture's is) with the lit inside showing through it and a solid back behind, so the passage, the culling, the
  scout and the camera work as at Haddu's. A builder draws round its own middle and says where its door is
  (`door`: x); the front is set over so the door is at `at`. Pieces are merged by colour (`src/shop-kit.js`
  `buckets`: one mesh a colour, walked-through pieces noCollide), so a front is about 30 meshes.
- **The rooms** (`SHOP_STYLES` in src/shop-world.js): the kit's room (`buildRoom`) in the world's walls, floor, light
  and windows, its counter (`box`, `curved` toward the door, `plank` on barrels, a gear's teeth round its foot), what
  stands on its shelves and hangs from its ceiling. The counter's line, its top (1.04 m) and the wares on it are the
  same in every shop (`layWares`: as many flasks as the shelf holds, a heart on what holds it, a magic cell in its
  cradle), so the panel, the stock on the counter and the keeper's place work alike; only the wares are hearts or
  cells (nothing on a shelf looks like stock that isn't), and a shop shows only what it sells.
- **Placing one** (`placeShop(scene, { def, at, heading })`, called late in the level's build, after its scatter and
  its sand): the shop at slot 0 (one a world), the instanced rocks and plants cleared from its ground and from the
  way to its door (`shop.clears`), `shop.avoid(levelsFloraAvoid)` for the flora; the level adds `shop.portals`,
  `shop.lights` and `shops: [shop]`. The Hangar also gives its scout the door in its own portals' shape
  (`navigationPortals`); its "too far out" rule and the world's edge (Player `opts.limit`, which the Market and Lorn
  II keep under the slot's 900 m) spare a body inside a room (`interiorAt`, `inTightRoom`).

| World | Shop (style) | After the pick | Where |
|---|---|---|---|
| Vael | the Wind-Shelf (`hoodoo`) | a bone-white hoodoo with a mushroom cap and an ochre band, a carved arched face, an ochre sail on a pole, wares on cords, a feather and a crystal for a sign; inside a round-feeling room of niches, a curved stone counter, the sand tray, feathers and crystals on cords | (52, −104), on the walk from the landing to the lone tower, 11 m off it |
| Vael II | the Almonry (`almonry`) | the gatehouse in rose stone between two round towers under slate cones, an arched door, the hatch with its counter-board, slate canopy and seven bronze bells; inside rose stone niches of wax-sealed flasks, the bell rail over the counter, the knotted ledger and a candle | (−224, −197) on the cliff-top before the monastery, facing the start plateau |
| Lorn | Nettle's Float (`raft`) | a raft-house of grey planks and reed bundles on floats, a steep thatch, a landing stage and post, a violet crystal lantern, the Hush over the door, the knot cord with crystals and a carved flask; inside a plank counter on barrels, the water hatch, knot cords, nets, flasks by their necks, a snapping plant | (27, 13) on the landing island's east shore, its deck over the channel |
| Lorn II | the Welcome-Shelf (`mossdome`) | a moss dome, a blue door open in a stone arch, a brass porthole, a blue-and-cream striped stall, three little lamps over the door (the Welcome) under a carved boat board, a lamp-post; inside root ribs, warm lamps, a curved counter with a teapot, an arch of shelves | (−10, −65) on the lit path's west bank |
| Viridel | Clover's Potting House (`potting`) | a lean-to of wood and glass against a leaning white builders' slab under an umbrella tree, a green-and-cream awning, a brass scroll bracket with a flask in a ring and a leaf, a ladder of pots, a pedestal with the heart in a pot; inside white panels, a workbench, bell jars of seedlings, teal globes and ferns, the makers' mark | (62, −92), halfway from Mira down to the fallen ship |
| The City-Shaft | Fausta's Basket-Shop (`basket`) | a narrow three-storey cream house, terracotta roof, green shutters, a rose-striped awning over the shop window, the crane with baskets on a rope, an iron bracket with a mortar and a flask; inside a marble counter, a wall of drawers, shelves and a rolling ladder, the basket on its rope with a bell | the middle terrace beside the middle levels' cab stop (and Perrine's mirror), on the promenade (`SHOP` in src/levels/incal.js; the town's houses kept off it) |
| The Sealed Hangar | the Quartermaster's Hatch (`kiosk`) | a cabin of riveted sage plate, a door and a serving hatch with a rolled shutter under a corrugated awning, a rack of flasks, the gear-and-flask stencil, pipes and a valve wheel, crates and a drum, a chimney; inside shelf units of crates, a glass cabinet, clocks, the stamp and the requisitions | (13, 86) beside the way from the landing to the keep |
| The Buried Machine | Mott's Tooth-Counter (`rivetdome`) | a riveted grey-blue dome, an arched door in a thick frame, a porthole, the pipe ring and a chimney, a rust canvas on struts, the gear tooth on its chain, a shelf of wares; inside plate ribs, a skylight, a counter ringed with gear teeth and its abacus, a big rusty gear | (−1, 28) between the landing and Wen's great dome |
| The Garden of Spheres | the Listening Stall (`pavilion`) | a round white pavilion on a low plinth, a colonnade under a flat-rimmed dome, a blue swag and glass bells, a white disc and a tuning fork; inside open to the meadow, a round counter with a basin, tuning forks on a rail, glass bells on a ledge | (13, −175) beside the path from the grove to the sphere-arch |
| The Signal Market | Pashka's Cure-Stall (`stall`) | a teal stall in a coral tower's foot, a long counter of flasks, the heart in a glass case, vials, a red conical awning hung with bulbs, the illuminated board (a heart and a flask among bulbs); inside glowing screens, flasks on cords, coral, lit cabinet windows | (−25, −23.5) on the avenue's west pavement, between two of the market's stalls |

**What differs from the picks.** The game's shops are walked into, so the pictures' hatches and stalls served over a
counter (Vael's shelf in the hoodoo's opening, the almonry's hatch, the quartermaster's hatch, Pashka's stall) have
a door beside them as well; their rooms are the kit's box room (the hoodoo's, the domes' and the pavilion's round
rooms are suggested by curved counters, ribs, arches and niches). No keeper has four arms (Pashka) or holds their
prop (Brin's stick, Hale's fork, Mott's abacus is on the counter); the Market's board does not light up at a sale;
Lorn's front has no pick (its interior's) and follows its prompt. Tests: `tests/shop-worlds.test.js` (every
front, and every world as the play-through builds it: on the ground, the way clear, in and out, the keeper, the
scout, no rain), `tests/shop.test.js` (one shop a world, the stock under the caps, the prices against the packs,
every keeper's lines toned, every room's counter).
