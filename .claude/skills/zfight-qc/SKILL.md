---
name: zfight-qc
description: Find and fix z-fighting in Hiraeth (two faces of different looks lying in one plane, flickering and striping as the camera moves), world by world and temple by temple, by geometry in node (no GPU), and keep it from coming back (tests/zfight.test.js). Use when the author reports flicker, stripes, shimmering patches or "z-index fighting" on walls, floors, trims or doorframes, after building or reworking a temple or a set of buildings, or to report the counts per world.
---

# The z-fighting audit

The author's report that started it (issue #75): "The Givers' House also has a ton of visual artifacts of z index
fighting. Do we have a way to fix this systematically for the whole game?" Two faces that lie in the same plane and
overlap are drawn in an order the depth buffer can't decide: they stripe and flicker as the camera moves. Same
material, same colour: nothing shows. Different looks (a trim over a wall, a slab's end in a wall's face, a band of
paint over a course of stone): it shows.

## 1. How it is found (scripts/zfight)

- `lib.mjs` (pure): `trianglesOf(root)` (every visible static mesh's triangles in world space, each with its look: the
  material, and for the temples' vertex-coloured paint the colour too), `coplanarOverlaps(tris)` (bucketed by plane:
  two looks whose planes are within `eps` 4 mm, parallel, facing the same way or either drawn double-sided, and
  sharing more than `minArea` 0.05 m² once projected into the plane: one **site** per pair of looks per 3 m),
  `visibleSites(sites, ray, { stand })` (only those someone could see: from places to stand round each site, a floor
  under them, no ceiling on their head, not inside a wall, a clear line to the site on the side its faces look out of;
  inside a temple's box only in a room, under its roof with walls all round). A face whose material has
  `polygonOffset` is drawn pulled toward the eye and fights nothing.
- `audit.mjs`: each world built as the game builds it, its totals and its temples', the worst sites.
- `list-temple.mjs <id>`: one temple's sites in its own frame (local metres, as its layout is written), and from where
  each is seen. `--all` the hidden ones too, `--dynamic` the moving pieces too.

```sh
export PATH="/Users/anf/Library/Application Support/Zed/node/node-v24.11.0-darwin-arm64/bin:$PATH"
node scripts/zfight/audit.mjs --worlds desert,arzach --worst 10 [--out report.json]
node scripts/zfight/list-temple.mjs desert
```

Node only, read-only, a few seconds a world (the City-Shaft's city is the slow one, several minutes: run it alone).
What it can't see: moving pieces' fights while they move, instanced props (grass, rocks), a site seen only from a
spot nobody stands on that it takes for a floor (a roof's top outside a temple), and LOD copies drawn one at a time
(two levels of detail of one building, both counted).

## 2. How to fix one (in order of preference)

1. **Set one face off the other** by `Z_GAP` (2 cm, src/temples/kit.js): a frame reaching 2 cm into its opening over
   the wall's reveal, a sill 2 cm under the floor laid through the doorway, a roof's edge 2 cm inside the walls' outer
   face, a wall's end at an open side 2 cm short of the far face of the wall that closes it. Collision moves with it
   (it's the same geometry): a 2 cm step nobody feels.
2. **Start or end a piece inside the solid it meets** (a corridor's walls and slab from inside the hall's wall, not on
   its face; a block under its top slab, not up through it).
3. **Leave the hidden face out** (the kit's `capless` courses: no faces where one course meets the next).
4. **polygonOffset** on a decal's material (`polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2`,
   as src/splat-decal.js and src/sand-drifts.js do): only for true decals (a print, a stain, a ground drift). It is GL
   state, not a new shader, but a material of its own costs a draw; and the Unity port carries it as an `Offset`
   state (docs/systems/xbox.md): keep it rare.

Fix in the kit (src/temples/kit.js) when the fault is the kit's: every temple gets it. Fix in the layout when it is the
layout's (a slab placed flush on a wall's face).

## 3. Keep it fixed

`tests/zfight.test.js` holds every temple to its count (`ZFIGHT_BASELINE`), the Givers' House at none. Lower a
baseline when a fix lands; a new site in a temple fails the test with where it is and the command to list them.
The worlds outside the temples are counted by `audit.mjs` and reported in docs/systems/rendering.md "Z-fighting"
(not tested: a world takes seconds to build, the City-Shaft minutes).

## 4. Check it in the game

A site the finder lists can be looked at: `scripts/design-qc/capture.mjs` with a views file (eye and target in world
metres; a temple's local point is `rt.kit.world(x, y, z)`), muted headless Chrome, never port 5173. Stripes show best
from a grazing angle and a few tens of metres away, where the depth buffer is coarsest.
