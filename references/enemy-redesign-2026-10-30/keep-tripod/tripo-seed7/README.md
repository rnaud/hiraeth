# Inspection tripod — the untouched Tripo export (#800, family E)

`model.glb` is Tripo's export as downloaded, never edited: task `75908627-606e-4432-80ae-51fdb4f03bbf`, image to model
from the approved `../9bb4fd97-30dd-471d-8ac0-c8da599468ee-0.png`, through the API on 2026-10-31
(`../../trials/familyE-tripo/generate.mjs tripod --seed 7`: model and texture seed 7). Model v3.1-20260211, textured,
PBR off, texture model v3.5-20260815 with `delight: true` (Remove Lighting), `texture_alignment: original_image`, face
limit 30,000. 28,218 triangles, one material, one JPEG, no skeleton; three legs, the lamp head turned 107° off their
axis on its round neck, the picture's shadow built as a flat disc. 30 credits. `task.json` has the request, timings,
checksums; `preview.png` is Tripo's own render. The game's body is made from this by
`../../trials/familyE-tripo/prepare-tripod.mjs` and shipped by `scripts/tripo/ship-body.mjs tripod`. Source only.

The two other takes from the same image (their task records and previews only, in `../tripo/` and `../tripo-seed23/`,
30 credits each; their models not kept): the first fused the hidden third leg into a stray tusk behind the hub; seed 23
drew three legs as seed 7 did, with the lamp head turned further off their axis.
