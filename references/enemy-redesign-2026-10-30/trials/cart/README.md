# The crucible walker (`cart`), #800 family D

Reference: `../../keep-cart/13ed7341-1960-43e2-8f12-8b8481c2bd68-3.png` (approved: "a four-legged crucible alternative to the
welding cart, with a compact pouring spout and contained heat chamber"). The author picked Tripo for the four trial foes;
this foe went straight to the Tripo route (no direct body) and replaces the cart's welding cart in the game, which stays
as `legacyCartModel` (src/enemies/plans/tracked.js).

- **Generation:** Tripo task `9d5f38fe-d4e4-4e25-83d2-24cee48106e3`, image to model, H3.1, texture v3.5 with Remove Lighting,
  PBR off, 30k face target: 28,848 triangles, a 2048² texture; **30 credits** (balance 1,335 → 1,305). Untouched in
  `../../keep-cart/tripo/` with `task.json`. The export read as its reference at once: the pot with its rim and orange
  brew, the eye unit with its one eye and three vents, four stubby legs with their bands and broad feet.
- **Prepare** (`../cart-tripo/prepare.mjs` on `../machine-tripo/prep.mjs`): 2 m to the rim, centred between the feet; 12,000
  triangles by the geometry alone; parts by geometry: the pot (a surface of revolution, its radius per height measured round
  it), the brew (its upturned floor inside the rim), the eye unit (proud of the pot over its front, turned onto the front),
  each leg's thigh (proud of the pot over its corner), shin and foot (planes at the knee band, 0.52 m, and the ankle's,
  0.21 m: the dark texels' heights were noisy corner to corner); a vertex two parts share is copied, one a part, so the eye
  unit slides away from the pot without taking its triangles. The pot round the unit set true to its profile (Tripo's
  fillet left a ridge and bent normals the ink drew as a slot). Repainted flat in the reference's sampled colours (sage
  `#98a88b`, bands `#40573c`, brew `#d09770`, the eye and vents near black); COLOR_0; the weights in the GLB (each part on
  its own bone, 5 cm blends at the knees and ankles, the thigh's crease into the pot blended by its height over it).
  `public/enemies/cart/body.glb` 572 KB (16-bit indices, no picture) and `landmarks.json`.
- **Rig and motion** (`src/enemies/plans/cart-tripo.js`, `plans/tripo-rigid.js`): the kit's four legs on the mesh's
  (`kitLegs`), the plan `crucible` (a trot on diagonal pairs). Walk audit (`../motion-audit.mjs cart@garage`): slide
  0.008 m a metre (worst 0.8 cm) at full pace, 0.012 at half, cadence 2.6 steps a second, groups [0,3] [1,2]. The pot turns
  about its middle (1.1 m: a blow's tip about the ground had swung its legs 5 cm under the floor). Its steps every 0.4 m,
  trimmed to the foes' level (crucible -6.2 dB: -21.0 dB against the target -21).
- **Gaze:** the eye unit turns about the pot's axis toward the traveller (±1.2 rad), the lens its own part in the eye's
  state colour; tested both sides.
- **Kept:** id, def, both attacks with their windows (pour 1.2 / 0.6 / 0.4, ram 1.3 / 0.9 / 0.05, its reverse and stall),
  the jam, the douse, the trail, two plates (now strapped to the pot's flanks), the weak point (now its eye), every skin
  with its dress (torches, hoops, ember brew, luggage), death (comes apart rigid: the blends let go on the vertex's own part),
  the lying body, the Arena warm-up.
- **Checks:** Arena arrivals 16.8 ms worst, no new programs, every look (as before). Defend (`combat-review/defend.mjs --per 90`):
  the pour blocks from 0.5 s and parries at 0.12 s (before: 0.06–0.12 s); the ram passes the still traveller in both. Dodge:
  the back flip off its ram starts a flurry. Bench (six ore carts, the Buried Machine): draws 558 → 381 (High), 409 → 291
  (Deck); CPU 7.0 → 6.1 ms and 6.0 → 5.4 ms; triangles +3.5 %. Unity (`-fight machines`): both looks draw the Tripo body, the
  pour winds up and pours. Tests: `tests/cart-tripo.test.js`.
- **Still off:** Tripo's crease noise on the legs draws a few ink scratches close up; the spout is the model's own small
  piece (the reference shows none); the eye's state colours show on its lens only.
