# Broad-pawed hound — the untouched Tripo exports (#800 phase 2b)

`model.glb` is Tripo's export as downloaded, never edited: task `09f5de9e-79ff-4d16-ab12-be8784944eb4`, image to model
from the approved `../5d7b275f-a6fd-4e34-a0fe-7c6d4ebc850a-1.png`, through the API on 2026-10-30
(`../../trials/hound-tripo/generate.mjs`). Model v3.1-20260211, textured, PBR off, texture model v3.5-20260815 with
`delight: true` (Remove Lighting), `texture_alignment: original_image`, face limit 30,000. 28,584 triangles, 16,660
vertices, one material, one 2048² JPEG, no skeleton. 30 credits.

`rigged.glb` is Tripo's quadruped rig of that model, as downloaded: the free rig check said `riggable: true,
rig_type: quadruped` (task `85e8e6f9-3e8c-4414-8bae-357ba7df1950`), then the rig (task
`66154a67-3bdc-426a-88ff-f1dc00b93ee9`, rig model v2.5-20260210, spec `tripo`), 25 credits (balance 1,735 → 1,710).
The same mesh with a 54-joint skeleton and weights: spine, neck, head, tail and four limb chains, but the left hind
leg twice over (`bone_20…25` and `bone_47…53`), stray tail branches (`bone_42…45`) and many unnamed joints. Its
weights are kept in the trial (gathered onto the game's own bones), its skeleton is not.

55 credits in all for this foe. (The account balance went 1,795 → 1,735 over the generation: another agent's task ran
in the same minute; this task's own `credits_consumed` is 30.) `task.json` has the requests, task ids, timings and
checksums; `preview.png` is Tripo's own render. The game-side derivative (12k triangles, a flat 1024² texture, vertex
colours, weights on the game's bones, landmarks) is built from `rigged.glb` by
`../../trials/hound-tripo/prepare.mjs`. Source only: not shipped.
