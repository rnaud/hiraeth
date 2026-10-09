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
