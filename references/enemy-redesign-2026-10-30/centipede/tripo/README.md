# Drill-head centipede — the untouched Tripo export (#800, family A)

`model.glb` is Tripo's export as downloaded, never edited: task `7a924a40-1173-4983-8d6d-34bcc7efee6f`, image to model
from the approved `../616e0bd4-9a63-476b-9485-1e5efda02210-3.png`, through the API on 2026-10-30
(`../../trials/familyA-tripo/generate.mjs centipede`). Model v3.1-20260211, textured, PBR off, texture model v3.5-20260815
with `delight: true` (Remove Lighting), `texture_alignment: original_image`, face limit 30,000. 28,878 triangles,
17,254 vertices, one material, one 2048² JPEG, no skeleton; drawn facing +z with its neck reared and five pairs of legs.
30 credits (balance 1,535 → 1,505). `task.json` has the request, timings, checksums; `preview.png` is Tripo's own
render. The game's body is made from this by `../../trials/familyA-tripo/prepare-centipede.mjs` and shipped by
`scripts/tripo/ship-body.mjs centipede`. Source only: not shipped.
