# Survey crawler — the untouched Tripo export (#800, family E)

`model.glb` is Tripo's export as downloaded, never edited: task `c7b50a5d-154d-4216-abc4-0861094e2b42`, image to model
from the approved `../22d8861b-51c8-4a48-9776-9c45ee542615-0.png`, through the API on 2026-10-31
(`../../trials/familyE-tripo/generate.mjs crawler --seed 7`: model and texture seed 7). Model v3.1-20260211, textured,
PBR off, texture model v3.5-20260815 with `delight: true` (Remove Lighting), `texture_alignment: original_image`, face
limit 30,000. 28,151 triangles, one piece, one JPEG, no skeleton: a cream dome over a navy band, a round head with one
painted orange eye, six sage legs (three a side) out of pink sockets, an antenna with a knob. 30 credits. `task.json` has
the request, timings, checksums; `preview.png` is Tripo's own render. The game's body (four of its legs) is made from this
by `../../trials/familyE-tripo/prepare-crawler.mjs` and shipped by `scripts/tripo/ship-body.mjs crawler`. Source only.

The first take (`../tripo/`, task `c740ba5e-…`, 30 credits; its record and preview only) drew five legs.
