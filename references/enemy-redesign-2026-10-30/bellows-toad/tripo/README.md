# Bellows toad — the untouched Tripo export (#800, family A)

`model.glb` is Tripo's export as downloaded, never edited: task `6183568d-3cf2-4acc-807f-fd7784f5c672`, image to model
from the approved `../c5a76758-e908-4034-acc5-7b88452dcb71-0.png`, through the API on 2026-10-30
(`../../trials/familyA-tripo/generate.mjs toad`). Model v3.1-20260211, textured, PBR off, texture model v3.5-20260815 with
`delight: true` (Remove Lighting), `texture_alignment: original_image`, face limit 30,000. 28,326 triangles,
16,722 vertices, one material, one 2048² JPEG, no skeleton. 30 credits (the task's `credits_consumed`; the account's
balance read 1,625 before and 1,565 after, other agents' generations running at the same time). `task.json` has the
request, timings, checksums; `preview.png` is Tripo's own render. The game's body is made from this by
`../../trials/familyA-tripo/prepare-toad.mjs` and shipped by `scripts/tripo/ship-body.mjs toad`. Source only: not shipped.
