# Wood cutter — the untouched Tripo export (#800 phase 2b)

`model.glb` is Tripo's export as downloaded, never edited: task `32ba0f6c-65ed-4cb9-8685-bdfb19b47047`, image to model
from the approved `../a1860f49-ecc5-4922-91f6-94b031e5e9a7-0.png`, through the API on 2026-10-30
(`../../trials/woodcutter-tripo/generate.mjs`). Model v3.1-20260211, textured, PBR off, texture model v3.5-20260815 with
`delight: true` (Remove Lighting), `texture_alignment: original_image`, face limit 30,000. 29,103 triangles,
17,541 vertices, one material, one 2048² JPEG, no skeleton. **30 credits** (the task's `credits_consumed`; the account
went 1,765 → 1,710 over the same minutes because another trial's task ran alongside). `task.json` has the request,
timings, checksums; `preview.png` is Tripo's own render. The game-side derivative (12k triangles, a flat 1024² texture
of five colours, vertex colours, landmarks) is built from this by `../../trials/woodcutter-tripo/prepare.mjs`. Source
only: not shipped.
