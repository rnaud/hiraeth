# Shellback — the untouched Tripo export (#800 phase 2a)

`model.glb` is Tripo's export as downloaded, never edited: task `5f2aa15f-678e-4969-b6d9-39852b47c598`, image to model
from the approved `../e8102be7-014a-4a03-8150-394a7f722fec-2.png`, through the API on 2026-10-30
(`../../trials/shellback-tripo/generate.mjs`). Model v3.1-20260211, textured, PBR off, texture model v3.5-20260815 with
`delight: true` (Remove Lighting), `texture_alignment: original_image`, face limit 30,000. 28,432 triangles,
16,724 vertices, one material, one 2048² JPEG, no skeleton. 30 credits (balance 1,825 → 1,795). `task.json` has the
request, timings, checksums; `preview.png` is Tripo's own render. The game-side derivative (12k triangles, a flat
1024² texture, vertex colours, landmarks) is built from this by `../../trials/shellback-tripo/prepare.mjs`. Source
only: not shipped.
