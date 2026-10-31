# Spool drone — the untouched Tripo export (#800, family E)

`model.glb` is Tripo's export as downloaded, never edited: task `e25f40fd-10e8-48c5-8abc-61733fd0cdd1`, image to model
from the approved `../e708a0d0-e805-46fd-aee5-4c328202ff41-0.png`, through the API on 2026-10-31
(`../../trials/familyE-tripo/generate.mjs drone`). Model v3.1-20260211, textured, PBR off, texture model v3.5-20260815
with `delight: true` (Remove Lighting), `texture_alignment: original_image`, face limit 30,000. 28,536 triangles, one
piece, one JPEG, no skeleton: two thick plates, a slate cap, a dark core with a painted orange slit eye, a nozzle on the
lower plate, an olive pod under it. 30 credits. `task.json` has the request, timings, checksums; `preview.png` is Tripo's
own render. The game's body is made from this by `../../trials/familyE-tripo/prepare-drone.mjs` and shipped by
`scripts/tripo/ship-body.mjs drone`. Source only.
