# Items, the backpack and the makers' boxes

What the traveller carries and the boxes that give it.

## Items, boxes and the backpack (v0.35)
- **Items** (`src/items.js`): the backpack, fluid jets, fluid wings, the stilling
  and ember modes, and the boxes' special items. Each is stored as a game flag
  `item.<id>`. `items.has/grant/revoke` take effect live.
- **Boxes** (`src/boxes/`): since October 2026 a smooth, edgeless dark-blue shell with a
  travelling line of light, wobbling before it dissolves, and no box quest before the first
  is found (docs/systems/boxes.md); before that a dark blue chest with a pale star, after
  `references/box-opening.webp`. It glows, hums and shudders as you approach,
  and E opens it. Since v0.39 the chests are set down `BOX_SCALE` (1.9×) larger,
  and the opening scene (`scene.js`) has them wake, lift `LIFT` metres off the
  ground turning slowly, and come apart from the top down: every box material is
  made with `makeMaterial({ dissolve })`, whose `DISSOLVE` block discards the
  surface by world-space noise as `uDissolve.x` goes 0 → 1, with a burning edge
  (the box leaves the shadow pass meanwhile). The item grows out of the light
  at its centre and hovers there with a card showing its name, what it is and
  what it does. Then the item is granted, and the box is gone for good (no
  collider either).
  Each placement's `hint` makes a small quest (`box.<id>`, "A Makers' Box"):
  it starts `BOX_QUEST_DELAY` s after you arrive while the box is shut, its one
  step says where to look and points the scout at the box (locator `box.<id>`),
  and the `box.<id>` flag finishes it. The desert's first box is the story's.
  Placements are in `placements.js`: the backpack lies near the desert crash
  site as the first quest stage, and every world has a box. Fallback boxes
  appear by the ship if you reach a world without what it needs. Special item
  effects are in `effects.js`. `migrateSave` gives saves from before v0.35
  the backpack.
- **Backpack-powered abilities** (`src/fluid-tool.js`, `src/fluid-kit.js`,
  `src/flammable.js`):
  - With no backpack there is no tool, and vehicles won't start.
  - The jets drain the same magic bar (0.3 units a second at full throttle, less
    on a light squeeze; they fly like a plane: docs/systems/movement-and-camera.md)
    and work in any world. The wings bloom from the tank and are needed to glide.
  - X cycles through the modes you own: shoot, stilling (freezes), ember
    (lights `level.flammables`) and, since the temples, bloom (grows). A target that doesn't list a mode in
    `accepts` gets `'shoot'`, so every puzzle works in every mode.
  - Riding the hoverbike or skiff moves the tank into the vehicle's socket.
- **In the game menu** (October 2026): the Items panel shows every item you have as a picture of
  its own model (`src/item-icons.js`), the empty slots for the rest unnamed; every item has a model
  now (`buildItemModel`: the charms and the cab pass were a gold gem). A gun mode's item, chosen
  there, switches the tool to it (docs/systems/ui.md, "The game menu").
- **Gadgets** (v0.90, kind `gadget`): the grappling hook, ink bombs and those to come register themselves as
  items from `src/gadgets/` (docs/systems/gadgets.md); one is in hand at a time (Y / △ uses it).
- **Gadgets in the worlds and their upgrades** (v0.98): each gadget's box is in a makers' court in one route world
  (docs/systems/gadgets.md, "In the worlds"); the items with `trial: '<world>'` are won by finishing that world's
  mastery trial, not found in a box (docs/systems/minigames.md, "Trials in the worlds").
- **Dev menu** (`src/dev-menu.js`, the backquote key or settings): items,
  boxes, flags, teleport. Also `?items=all|none|a,b`.

## Hearts, magic and potions (v1.5)

`src/resources.js` holds the traveller's resources, so the shops (heart containers, magic expansions, potions
for sale: "Shops" below) and the currency plug in without touching what spends them.

- **Hearts** (`HEARTS.start` 3, at most `HEARTS.cap` 20): the health, counted in quarter hearts. The
  current hearts are the player's (`player.hearts`, `player.maxHearts`; `player.health` the share 0..1);
  the containers are the save's (`resources.maxHearts`, main.js keeps the player to it). They never come back
  by themselves. What takes them: the damage table in docs/systems/foes.md.
- **The healing potion** (`POTION`: two hearts, a 0.9 s drink, the hearts at 0.45 s): **C** on the keyboard
  (`KEYS.potion`, movable on the Controls page), **D-pad ←** on a controller (one press, v1.11; View +
  D-pad ↓ before; `PAD.potion`, movable on the Controls page), the **flask beside the hearts** on a touch screen. `player.drinkPotion()` starts the drink
  (not at full hearts, knocked down, riding, swimming or drinking already: `cantDrink()` says which; full,
  a notice says so); main.js takes one from the stock (`resources.takePotion()`), plays the cork and the two
  swallows (`sound.potion`), tilts the HUD's flask and raises a warm glow round the traveller as the hearts
  come back (`opts.onDrink`). The first hurt that leaves you a heart short says how, once (`hint.potion`).
  Potions are a count: **3** in a new game (`POTION.start`), at most **5** carried (`POTION.cap`); the shops sell
  more ("Shops" below). Until the first shop they were infinite; `res.potions.infinite` is now only the dev
  menu's. Out of them, the notice says a shop sells more.
- **The magic bar** replaced the backpack's three charges (the tank's chambers): `MAGIC.start` 3 units,
  one unit = one old chamber = a third of the starting bar, so every cost kept its feel
  (`MAGIC_COST`): a shot (any gun mode), a push, a boost, a shield that breaks (src/fluid-blade.js), a gadget
  that carries the fluid (the boomerang's ember): **1 unit** each; the jets **0.3 units a second** at full
  throttle (ten seconds on the starting bar); the wings cost nothing (as before). It refills by itself like
  stamina: **1 s** after the last spend it starts (`MAGIC.delay`), and the starting bar goes from empty to
  full in **4 s** (`MAGIC.fill`: 0.75 units a second; a longer bar takes longer). After a jet burn it waits for
  the ground first (no endless flight). A foe cut down gives a unit back. `src/fluid-tool.js` `Reserve` is
  the bar (`use(cost)`, `drain`, `update`: the wait, then the fill); `src/boxes/effects.js` sets its length
  and pace from `resources.maxMagic` and `resources.magicPace` every frame; the HUD draws it under the hearts
  (docs/systems/ui.md), the backpack's glass still shows the level.
- **Upgrades**: the **fourth chamber** (item `cell`, the Engine-House's chest) lengthens the bar by one unit
  (`MAGIC_ITEMS`); the **quick coil** (item `coil`) quickens the refill (0.5 s wait, the starting bar full in
  2 s: `MAGIC.coil`). Expansions from elsewhere (`resources.addMagic`, the shops) add units the same way.
  What wanted the fourth chamber now wants a **capacity**: `'magic:4'` (`resources.meets`, and the temple
  solver's `meetsWith`): the Engine-House's banks of four eyes and its warden (`src/temples/buried.js`) and
  the Furnace steps makers' run (`src/trials/kit-data.js`). Four shots inside 2.6 s need four units; six in
  4.6 s need the coil (tests/resources.test.js, tests/temples.test.js).
- **The save** (game flags, so the format grows): `res.v` (the format, `RES_VERSION`), `res.hearts.extra`
  (containers), `res.magic.extra` (expansions), `res.potions` (the stock), `res.potions.infinite`. Old saves
  (src/save-migrate.js, step 4): the format is stamped; the fourth chamber and the coil are read from their own
  item flags, so a save that had them keeps a bar of four and the quick refill, and the doors that wanted the
  chamber still open; hearts are not saved (a load starts whole, as the bar did). Step 5 (the first shop): a save
  whose potions were infinite gets a full stock (the cap, 5) and finite potions, `res.v` 2; a save the dev menu
  had made infinite on purpose stays so.
- **The Arena** (src/minigames/waves.js): a wave cleared gives a heart back (`TIDE.heal`); Second wind gives
  all of them back and lends a slow mend (`TIDE.mend`, 0.1 hearts a second per pick, through `FALL.regen`);
  Deeper well lengthens the bar a unit, Quick refill shortens the wait and quickens the fill.

## Chimes, the currency (v1.5)

**Chimes** are floating crystals (since October 2026; brass discs pierced square before): long, blunt,
weathered shards of translucent mineral, **30 cm** long, knee-high (at first 3.4 cm, too small to read from a few steps;
then the coins' size, 27.5 cm, which the author found too big), that float upright over their own small shadow
and ring like struck glass when touched. They come in six worths, like Zelda's rupees, each the same shard in its
own colour (**the tiers**, below). The look is the author's picks of 9 October in
`references/Core Objects/Currency/Floating Chime/`: `one/sheet-1.jpg` (the design: "love the design but they are
too big"), the small single crystal of `five/sheet-1.jpg` ("great but only the small one") and the field of
`field/sheet-1.jpg` ("love this"; each with its prompt in a manifest.json, written in
docs/design/chime-prompts.md): broad uneven facets, a flat little cap and a blunt point, a lavender seam down its
length, a warm light at its heart. (Before that, `Small Floating Crystal/reference-4.jpeg`.) **The name stays.** The bible's crystals sing (Lorn's Great Crystal,
the Lodestar splinter that "hums like Lorn's crystal"), so splinters of a singing mineral that ring when taken
are still chimes: the name was always the sound, not the brass. So the save key (`res.chimes`), the wallet's
API, the strings (*tintes* in French) and Haddu's *Chimes & Cures* need no migration. Haddu says what they are
("shards of singing crystal, about as long as your hand"). Batch 3's shops spend them.

- **The wallet** (`src/resources.js`): `resources.chimes` (whole, at most `CHIMES.cap` 9999),
  `addChimes(n, { source, training })` (returns how many went in), `spend(n, { source })` (false and nothing
  taken when short, or for a negative or non-number amount), `canAfford(n)`, and `game.emit('wallet',
  { count, delta, source, training })` on every change. Saved as `res.chimes`; `res.chimes.earned` counts
  what was picked up out in the worlds, not the Arena's training.
- **What drops them** (`src/chimes.js`, wired by `connectDrops` in main.js): a foe cut down scatters
  `dropAmount({ kind, category })` where it fell, ±25 % (`SPREAD`), never under one:

  | Foe | Chimes |
  |---|---|
  | swarm blot, glass splinter | a 50 % chance of 1 (they come six and three at a time) |
  | sign moth | 1 |
  | ink blot | 2 |
  | spitter, winged blot | 3 |
  | dune ray, rust drone, shadow hound | 4 |
  | root stalker, salt crab | 5 |
  | makers' machine | 6 |
  | shade, glass golem, slag walker | 8 |
  | a world enemy (the 100): local creature, shadow spirit, possessed machine | 4, 6, 8 (by its category, not its family) |
  | a temple's guardian resolved (calmed or broken) | a purse of 40, once per temple (`res.purse.<id>`) |
  | a makers' run's first finish | 15, straight into the wallet (the results card says so: `firstPurse`) |

  Nothing from a foe that falls out of the world or is swept into deep water (`lost`), nor when the Enemies
  setting is Off (no foes). There are no breakable pots or crates in the game, so no other source.
- **Where** (`dropPolicy(level)`): everywhere foes are, except a game's own foes (`level.foes.own`: **Ink tide**
  sets `chimes: false` too); the **Arena** (`chimes: 'training'`, a dev world) drops them from its waves, its
  FOES list and each guardian bout in the ring (a purse a bout, `guardian:spar`), so the shops can be tried
  there: they go into the wallet but are not counted in `res.chimes.earned`.
- **The tiers** (`TIERS`, `tierOf`): 1 cyan, 5 jade, 10 amber, 20 coral, 50 violet, 100 pearl. One shard design
  for all of them: the tier is the instance colour (the geometry's vertex colours are pale greys,
  `CRYSTAL_NEUTRAL`, so any hue tints them), a size (× 1, 1.08, 1.16, 1.25, 1.36, 1.5: a hundred is 30 cm) and a
  glow (0, 0.2 … 1: the inner light and the warm heart brighter, a fifty and a hundred just over the bloom
  threshold so they carry a soft halo, the glint growing with it, a hundred's more than twice a one's, and coming up to 35 % sooner). The hues go
  round the Moebius palette and step in lightness too (pearl lightest, then amber, jade and cyan, coral, violet), and
  size and glow climb with the worth, so they are told apart where a hue is not (colour-blind players). A drop
  scatters the fewest pieces (`pieceValues`, greedy over the tiers, which is the fewest for these worths: 8 is a
  jade and three cyan, a guardian's purse of 40 two coral twenties, 186 one of each). Until October 2026 there
  were ones and fives (a paler cluster, from a drop of 10 up). The wallet is a number, so nothing to migrate.
- **The pieces** (`ChimeField`, `PIECE`): a drop scatters its tiers' pieces. Each pops out of the foe's middle in a little arc (0.45–0.7 s, up 1.1–1.9 m, landing
  0.5–1.7 m out, on the ground under it unless that is a ledge more than 4 m off), bounces, then hovers with
  `PIECE.hover` (0.2 m) of air under its lowest point, bobbing 3.5 cm (`PIECE.bob`): its centre is that much higher
  than its lowest point as it floats (`pieceBelow`, from the geometry once, times its tier's size: 10 cm for a one,
  15 cm for a hundred), so a one's centre rests 0.30 m up and a hundred's 0.35 m (`restHeight`). As in the field
  reference the air under it is about its own length and its shadow close below (from 47d28ed2 to October 2026 the
  27.5 cm shards had 0.4 m under them; before that none, and they read as lying on the sand). Upright with a slight
  lean (`CRYSTAL.tilt`, 0.12 rad; 0.42 before), turning round the vertical at 1.1 rad/s (`PIECE.turn`; 1.7 before,
  3 for the coin), it glints every 1.6–3.6 s (sooner the more it is worth: a four-point star 12 cm across on a facet a
  little above its middle, facing the camera); between glints a faint spark (`CRYSTAL.twinkle`, a tenth of the
  glint): the crystal reads by itself. After 0.45 s it can be taken: walked over (`take` 0.65 m round the feet) or
  drawn in from `magnet` 2.4 m of the traveller's middle. **Drawn in** it sets off gently (`drift` 1.2 m/s, then
  30 m/s² faster), on a curve (`swirl`: its heading turned sideways by up to 0.9 of the way to the traveller at
  the magnet's edge, falling away as the square of the distance, so it comes in straight at the end), spinning at
  6 rad/s, glowing (a soft halo), with a trail of light behind it (`PIECE.trail`: its last 12 places, one every
  28 ms, drawn as shrinking stars in the glints' mesh). Before, it shot straight in at 2 m/s and up, spinning at
  14 rad/s. Left lying it blinks for its last 5 s and is gone after 30 s. Not taken while knocked out, in a menu
  or a scene. `ChimeView` draws them all in **one instanced mesh** whatever their worth (`crystalGeometry`: seven
  sides in three bands of broad uneven facets, each ring twisted a little and a little off the axis, the middle
  band long and its sides nearly parallel, closing in a small flat cap above and a blunt point below, `CRYSTAL.one`
  30 cm long, about 11 × 9 cm across, 56 triangles; flat facets, one column of them the seam), the tier's colour in
  the instance colour, its size in the instance's scale, its glow in an instance attribute (`aChimeGlow`); the
  glints and the trails share a second, the patches of shade a third (until October 2026 a fourth for the fives'
  clusters). None casts a shadow (`userData.castShadow` false: a crystal gives light; unculled, they would be
  drawn again in every shadow pass). The shop's strings of chimes,
  the sign on its back wall and the hanging sign outside (`interior-kit.js chimeEmblem`) use the same shard at
  their own sizes, in the plain material.
- **The patch of shade under each** (`BLOB`, `blobOf`, `blobMaterial`): with no cast shadow, nothing showed the air
  under a crystal, and a floating thing with no shadow reads as resting on the ground. So `ChimeView` lays a soft
  lavender disc on the ground under each piece (`ChimeView.blobs`: one more instanced draw for the whole field, a
  20-sided disc each), 9.5 cm in radius under a one (times its tier's size), on the ground's slope (two more ground
  probes when a piece is dropped: `p.up`), 1.5 cm off it: a small soft shadow, as in the field reference. It is
  drawn into the G-buffer as the jump's shadow is (src/jump-shadow.js), but only the colour: the ground goes toward
  a lavender shade (`BLOB.tint`, 60 % at most, `BLOB.dark`), full out to 55 % of its radius (`BLOB.core`) and soft
  over the rest (blended by its strength in alpha, the other targets written at alpha 0 and the alpha channel kept:
  the light term, normals, depth and flags are left as they are), so the post pass draws no cast-shadow edge and no
  ink line round it, and it reads on sunlit sand, in shade, on grass, on the shop's floor and at night alike (until
  October 2026: 18 cm, the ground multiplied by up to 0.5, softly all the way out, a brownish smudge). It shrinks a
  little and fades as the piece bobs up (to nothing `BLOB.span`, 0.8 m, over its rest: gone at the top of the
  pop-out arc), lies under the piece's path in flight, is not drawn for a piece being drawn in, and fades out
  between 27 and 45 m from the camera (a smudge a few pixels across). Depth-tested, not writing depth, and out of
  the shadow passes like the crystals.
- **The size** (`COIN`, `CRYSTAL`): the brass coin was a disc 0.12 m in radius (25.4 cm across with its bevel), a
  five 1.45 × as wide; the first crystals as tall as it (27.5 cm, a five's cluster 38 cm). The author found those
  too big, so since October 2026 a one is 20 cm long, picked by eye from the game's own camera (7 m behind the
  traveller, 3 m up) on the desert's sand: 16 cm read as a fleck there and 18 cm barely, 20 cm still as a shard over
  its shadow. Seen in the game the same day, that was too small ("they should go up to his knees"): a one is
  **30 cm** now, its top at the traveller's knee over 0.2 m of air (`BLOB.r` 0.14 m and the glint scaled with it), a
  hundred 45 cm. The pickup reach (`take` 0.65 m) and the magnet (2.4 m), tuned for the coin,
  stay.
- **The crystal's look** (`src/crystal-shader.js`, makeMaterial `{ crystal: true }`, the `CHIME_CRYSTAL` define;
  compiled into the G-buffer shader like the dune glass, `CHIME_CRYSTAL` holds its tones and weights): each facet
  one flat tone by the live sun (from its own colour darkened with a little lavender in it, `deep`, toward its
  light: the shade side cool, as Moebius shades), the seam's faces lavender (`seam`, a fifth of the tier's colour in
  it; the geometry marks them with a negative length in `aCrystal.w`), bright edges along the facets (the geometry's
  `aCrystal`: barycentric weights, a side quad's diagonal and the flat cap's spokes held at 1 so no line crosses a
  facet; at least a pixel wide, faded out once the facets are too small on screen) with a fine ink line in them
  seen close (`ink`, the reference's pen; gone sooner than the bright line), a paler core on the facets facing you
  and a warm heart at its middle seen through them (`core` cream, `heart`: a soft spot that slides a little as it
  turns), pulsing gently (each crystal on its own beat, from its position), brighter by its tier's glow and
  brightest as it is drawn in (`aChimeGlow`, `tierGlow` added to the glow term at 1), inner lines seen through the
  facet (the view ray `refract`ed into the shard's own frame samples two sets of soft lines, so they slide as you
  walk round it or it turns), a faint rainbow fringe and a pale rim on the grazing facets, and a sparkle: the
  facet whose mirror ray meets the sun goes white and glows over the bloom threshold (a small printed halo); with
  no sun, a softer one off a light over your shoulder. Its light term stays over the toon threshold (its shade is
  its own tones) and it keeps its colour at night (its glow, under the bloom threshold). **The ink**: soft ink with
  a pen line (`gHatch.a` + 8, as the makers' boxes): post.js draws its outline only, a pen line 85 % of the way
  (the rest a darker shade of the crystal), and nothing inside it: no crease, colour-edge or shadow-edge line
  between the facets, no hatching, no spot black, no crease shading. **Cost**: thirty in view add the same three
  instanced draws as before and no shadow draws (before: four, the two near cascades); the frame with them and
  without them is within ±0.05 ms (renderFrame timed, render scale 2, High, on the Mac), as it was before. Since
  the tiers (October 2026), three draws for a whole field whatever lies about (four before: the fives' clusters
  had their own mesh), 56 triangles a crystal (28 before; 1,680 for thirty); thirty in view on the desert's sand,
  High 1280 × 720: the frame with them and without them within the run-to-run noise before and after (+0.31 and
  −0.20 ms, ±0.5 ms on a shared Mac).
- **On the screen**: the chimes beside the potion at the top left (the crystal's icon and the count,
  docs/systems/ui.md; `src/chime-icon.js`, the same drawing in index.html, the shop panel's prices and wallet
  and the game menu's), shown with the hearts whenever the wallet changes; the count ticks up to the wallet's
  (`walletTick`) and the icon turns as one rings in. Each pickup is a crystalline ting (`sound.crystalTing`: the
  partials of struck glass, `CRYSTAL_PARTIALS` 1, 2.32, 4.25, 6.63, the fundamental doubled 0.6 % sharp so it
  shimmers, an airy tail, a faint high tick at the strike; an octave above the old brass ting), climbing through a
  quick run (`sound.chimePickup`; a five or a ten rings a second note a fifth over it, a twenty or a fifty an octave
  too, a hundred a twelfth as well), a drop a few falling glassy tings
  (`chimeScatter`), a sale the same counted onto the counter before the keeper's brass bell (`purchase`). The
  game menu's Items panel shows the wallet by the Gear heading.

Tests: `tests/chimes.test.js` (drops, the tiers and the fewest pieces, the field, the magnet's curve and trail, the wallet, the HUD's icon, the crystal's size and shape, facets and colours, the view: each tier's colour, size and glow), `tests/crystal-shader.test.js` (the material's gate and uniforms, the outline-only ink, the edge attribute and the seam, one instanced draw for every tier and no shadow passes), `tests/chime-sound.test.js` (the ting rendered silently in memory).

## Shops (v1.5)

Shops sell for chimes what the walk takes out of you. Code: `src/shop.js` (what they sell, the prices, the
stock: pure over the save), `src/shop-world.js` (the building, the counter and the wares on it: docs/systems/
interiors.md), `src/story/shops.js` and `src/story/shop-data.js` (the keepers), `src/shop-panel.js` (the panel:
docs/systems/ui.md, "The shop"). Tests: `tests/shop.test.js`.

- **The wares** (`WARES`, a shop's `wares` in `SHOPS`):

  | Ware | Effect | Price | Stock |
  |---|---|---|---|
  | healing potion | one more potion (two hearts back when drunk) | 10 chimes | the shelf holds 3, one comes back every 3 minutes (`SHELF`); you carry at most 5 |
  | heart container | +1 heart for good, and the hearts filled | 50, then 80, 110, 140… (+30 each) | 1 or 2 a shop, 15 in all (below) |
  | magic expansion | +1 unit on the magic bar for good | 40, then 70, 100, 130… (+30 each) | in five shops, 6 in all (below) |

  A container's and an expansion's price rises with every one bought **in any shop** (`shop.bought.heart`,
  `shop.bought.magic`; `stepPrice`), so batch 4's shops in the later worlds go on up the same curve, and buying
  them in any order costs the same in the end. The caps still hold (20 hearts, a bar of 9).
- **Why these prices** (against the drop table above): a desert fight is three or four foes, two ink blots, a
  spitter and a dune ray, about **11 chimes** (±25 %). A **potion** at 10 is about one fight: it heals two hearts,
  and a fight that goes badly costs one or two, so buying potions with what the fights drop is break-even, never
  a farm. The **first heart container** at 50 is four or five fights (or one guardian's purse of 40 and a makers'
  run's 15): a few fights, not a grind, and the first one the player will want as soon as the shop is found.
  Each next one costs 30 more (three fights more), so the second in Qanat is 80 (about seven fights), and the
  late ones in the later worlds, where the foes drop 4–8 each, keep the same feel. A **magic expansion** is a
  little less than a heart (40, +30): a fourth unit is a shot more in a fight, as useful but less vital, and the
  Engine-House's `magic:4` doors also open with the fourth chamber.
- **Buying** (`Shop.buy(id)`): `status(id)` first: `soldout` (none left), `full` (you carry 5 potions, or the
  hearts or the bar are at their cap), `short` (not enough chimes), or `ok`; then `resources.spend` (the `wallet`
  event), the ware given (`addPotions`, `addHeartContainer`, `addMagic`), the stock taken down, and
  `game.emit('shop:bought', { shop, ware, price })`. main.js fills the hearts on a new container.
- **The save** (game flags): `shop.<id>.<ware>.sold` (a limited ware's sales), `shop.<id>.potions` and
  `.potions.t` (the shelf and its restock clock: the wall clock, so it refills between sessions; unset, a full
  shelf), `shop.bought.heart` / `shop.bought.magic`.
- **The first shop**: Haddu's Chimes & Cures in the desert, by the way from the camps up to Qanat's main gate.
  Haddu (`SHOPKEEPERS.haddu`): a broad, slow chime-weigher in a deep teal coat over saffron, a red fez, a brass
  monocle and a hand bell, who has kept shop through forty Drinkings and weighs every crystal on his little scale; a
  low, unhurried voice (0.78). Talking to him ("Show me what you have") or E at his counter opens the shop; his
  lines at the counter (`SHOP_LINES`) greet, thank you for each kind of sale, say when you are short, when it is
  sold out or your pack is full, and see you off. He is on the People page once met.
- **A shop in every world (v1.14, batch 4)**: one shop in each of the eleven route worlds (`SHOPS`, a keeper and a
  style each; `shopOf(world)`), built to the author's picks in `references/shops/` (docs/systems/interiors.md, "A shop
  in every world"). Every one sells potions (the same shelf of 3, the same restock); the containers and expansions
  are few, a little more in the later worlds:

  | World | Shop | Keeper | Hearts | Magic |
  |---|---|---|---|---|
  | The Desert | Haddu's Chimes & Cures | Haddu | 2 | 2 |
  | Vael | the Wind-Shelf | Brin | 1 | |
  | Vael II | the Almonry | Sister Perpetue | 1 | |
  | Lorn | Nettle's Float | Nettle | 1 | 1 |
  | Lorn II | the Welcome-Shelf | Rowan | 1 | |
  | Viridel | Clover's Potting House | Clover | 1 | |
  | The City-Shaft | Fausta's Basket-Shop | Fausta | 2 | 1 |
  | The Sealed Hangar | the Quartermaster's Hatch | Odo | 1 | |
  | The Buried Machine | Mott's Tooth-Counter | Mott | 2 | 1 |
  | The Garden of Spheres | the Listening Stall | Hale | 1 | |
  | The Signal Market | Pashka's Cure-Stall | Pashka | 2 | 1 |
  | **All** (`STOCK_TOTAL`) | | | **15** | **6** |

  Everything bought: 3 + 15 = **18 hearts** of the 20 (`HEARTS.cap`; the cap stays above what the shops can give),
  and 3 + 6 = **a bar of 9** (`MAGIC.cap`; with the Engine-House's cell the last expansion shows "full"). The prices go
  on up the one curve: the fifteenth heart costs 470, the sixth expansion 190 (4,590 chimes for everything). Against
  the drops: a **pack** of a world's foes (its wild kinds' drops, src/chimes.js, the pack's size by the world's stage,
  src/foe-worlds.js `BUDGET`) is about 3–4 chimes in the desert and Vael, 8–10 in the stage-1 worlds, 12–18 in the
  stage-2 and 15–21 in the last three; the tiered pieces (`TIERS`) only change how a drop looks, not its worth. Bought
  in the route's order, every container costs **14–31 packs** of the world it is sold in (the desert's first 14,
  the Market's last two 29–31), so the late ones keep the first one's feel and none is a handful of fights
  (tests/shop.test.js holds each between 8 and 35 packs, an expansion from 5). A potion stays 10, a pack or two.
  Each keeper (`SHOPKEEPERS`, `SHOP_LINES` in src/story/shop-data.js) has a conversation of Haddu's shape (hello,
  again, one thing to ask about that the People page then remembers), their counter lines in their world's voice
  (Brin's one word at a time, Odo's stamps, Pashka's shouting), every line toned; they are on the People page once met.

## The makers' boxes, Android controls and updates (v0.36)
- **The boxes** are artifacts of the makers, the people of the glyph (see "The
  boxes" in the story bible). The backpack's box stands in the Givers' shrine
  in Qanat (231, 391). Opening it brings six villagers and Nour, the eldest,
  whose conversation sends you on the rest of `desert.power` (stages `city →
  box → elder → well → ama → speaker → down → …`). Saves are migrated: `items.v`
  2 marks the box open for anyone who has the backpack, and `desert.quest.v` 2
  maps the old stages.
- **Android controls** (`android/.../GamepadBridge.java`, `src/native-pad.js`):
  the activity reads the built-in controller and hands it to the page as a
  Standard Gamepad. With it the prompts use Android button names (A B X Y, L1
  R1 L2 R2, Select, Start); `?pad=android` forces them in a browser.
- **Updates** (`android/.../Updater.java`): on launch the app reads
  `latest.json` from the newest release (uploaded by the workflow with the APK:
  versionCode, version, APK URL). It offers newer builds and hands them to the
  system installer; the same key keeps the save.
