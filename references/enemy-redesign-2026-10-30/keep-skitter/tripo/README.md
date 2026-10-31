# Seedpod skitter — the untouched Tripo export (#800, family A)

`model.glb` is Tripo's export as downloaded, never edited: task `118d9422-ffa9-436d-8a27-b220f908afb4`, image to model
from the approved `../711f83a4-63bc-4576-b299-458c14ce5bac-1.png`, through the API on 2026-10-30
(`../../trials/familyA-tripo/generate.mjs skitter`). Model v3.1-20260211, textured, PBR off, texture model v3.5-20260815
with `delight: true` (Remove Lighting), `texture_alignment: original_image`, face limit 30,000. 29,096 triangles,
17,213 vertices, one material, one 2048² JPEG, no skeleton; eight legs. 30 credits (balance 1,505 → 1,475). `task.json`
has the request, timings, checksums; `preview.png` is Tripo's own render. The game's body is made from this by
`../../trials/familyA-tripo/prepare-skitter.mjs` and shipped by `scripts/tripo/ship-body.mjs skitter`. Source only.
