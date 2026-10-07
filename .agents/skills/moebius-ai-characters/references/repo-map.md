# Existing implementation and checks

Resolve these paths relative to the current Moebius/Hiraeth checkout. Inspect current code before using it; this map describes the integrated coral-shirt v1 and its review tools, not a generic character SDK.

- `scripts/tripo/README.md`: reproduction, current limitations and asset contract.
- `output/character-tripo/baseline/model.glb`: untouched downloaded baseline (git-ignored).
- `scripts/tripo/sample-colors.py`: sampled vertex colors from the source texture; Pillow needed.
- `scripts/tripo/rig-baseline.mjs`: fitted MakeHuman donor and barycentric weight transfer; writes the experimental rig and report.
- `src/characters/tripo-fit.js`: character-specific arm/digit fitting and proportional torso/ankle estimates. It preserves names/frames and updates inverse binds. Its T-pose assumptions and coefficients need review for each new character.
- `src/characters/tripo-garment-geometry.js`: shirt separation, connected trouser reconstruction, weight-field blending, inner-shirt backing.
- `src/characters/tripo-cloth.js`: regular lower-coat cage, detailed mesh mapping, fitted leg/hip collision proxies, and GPU garment deformation.
- `src/characters/tripo-cloth-sim.js`, `src/characters/tripo-cloth-worker.js`: shared simulation and worker execution; preserve CPU/GPU geometry and shadow agreement when changing the cloth.
- `src/characters/tripo-face.js`: drawn face adapter for expressions, blinking and speech on the generated face.
- `src/characters/tripo-hands.js`: runtime finger pose update and character-specific curl limits.
- `src/characters/tripo-walk.js`: walk/jog spread correction and seated lap contact.
- `src/characters/tripo-material.js`: imported-material adapter for the real game G-buffer.
- `tools/tripo-render.js`: review-only renderer using the game pipeline; the live game retains its own world lighting and render passes.
- `src/characters/traveller-v1.js`: game loader and integration; fitted skeleton, separate clothing, blended arm correction and contextual hand-pose adjustments.
- `public/characters/traveller-v1/`: tracked `model.glb`, `rig.json` and `colors.json`. Promote these matching files together after review; instructions are in `scripts/tripo/README.md`.
- `tools/tripo-{fit,garment-geometry,cloth,hands,walk}.js`: compatibility re-exports of the shared runtime modules.
- `tools/tripo-review.html`, `tools/tripo-review.js`: orbit/pan/zoom, view/focus presets, stepped motion, cloth/repairs/style comparisons and hand pose diagnostics.
- `src/materials.js`, `src/post.js`, `src/pipeline.js`, `src/shadows.js`: actual game renderer. Prefer reuse over recreating a similar-looking filter.
- `src/humanoid.js`, `src/animator.js`, `src/hands.js`: retargeting, contact IK and contextual finger poses.
- `docs/systems/characters.md`: maintained system notes.

Typical local checks, from the repo root:

```sh
node scripts/tripo/verify-rig.mjs
node scripts/tripo/audit-hands.mjs
node scripts/tripo/audit-walk.mjs walk
node scripts/tripo/audit-walk.mjs jog
node scripts/tripo/audit-cloth.mjs walk
node scripts/tripo/audit-cloth.mjs jog
node --test tests/hands.test.js tests/tripo-*.test.js tests/traveller-v1.test.js tests/materials-pass.test.js
npx vite build
```

Check required inputs before running. Scripts may assume the baseline asset and fixed output paths; parameterize or isolate them before processing another character. Never overwrite a prior character's only working export. Before a commit, follow the repo's full test/changelog requirements. Visual preview checks remain necessary even when all commands pass.
