# Enemy rebuild from an approved reference (#800)

The short recipe for rebuilding a roster foe with Tripo, one body family at a time. The full version, kept in step
with this one, is `.claude/skills/enemy-rework/references/tripo-rebuild.md`; the trials' record with every number and
picture is `references/enemy-redesign-2026-10-30/trials/README.md`, its scripts beside it. The author picked Tripo for
all four trials (shellback, hound, wood cutter, dune mummer), each after fixes. Copy the closest trial's folder.

## Generate

- Source: the approved original in `references/enemy-redesign-2026-10-30/<concept>/` (`tools/enemy-review-references.js`).
- **Humanoids: a T-pose first, picked by the author.** Prompts in a `docs/design/…-prompts.md` with a `Target folder:`
  line (template `docs/design/enemy-tpose-prompts.md`); the reference lab with the approved image as `--refs`
  (`node scripts/gen-reference.mjs --from <doc>#<id> --refs <approved.png>`); picks committed to `<concept>/tpose/`
  with the lab's manifest. Non-humanoids: the approved image, or a picked rest view if it hides a limb.
- Tripo API through `scripts/reference-lab/providers/tripo.mjs`; key `TRIPO_3D_API_KEY` from the main checkout's
  `.env`, never printed. Request: `model: 'v3.1-20260211'`, `texture_version: 'v3.5-20260815'`, `delight: true`
  (Remove Lighting), `pbr: false`, `face_limit: 30000`, `texture_alignment: 'original_image'`, `export_uv: true`.
  Image-to-model, or multiview-to-model (front, back, left cut from the sheets onto squares of their cream).
- Rig when the family uses it: `rig-check` (free), then biped `v1.0-20240301` / `mixamo` or quadruped
  `v2.5-20260210` / `tripo`. About 30 credits a generation, 25 a rig; stop at the brief's credit floor.
- Untouched exports and `task.json` (source sha256, request, task ids, credits, balance before and after, file
  hashes) in `<concept>/tripo/`. Fixes reuse the export.

## Prepare (`prepare.mjs`, deterministic)

Game frame and size; **parts cut by geometry, never by colour** (lip curves, fitted spheres, planes at joints,
triangles split on the cut); **repainted by part in the reference's flat colours**, UV-island gaps filled from the
nearest island, painted eyes and baked shading removed (check in the clay view); **a 10–15k LOD** with meshoptimizer
by geometry alone (colour-weighted decimation keeps crease noise); **COLOR_0** for Unity; texture 512–1024²;
landmarks measured from the mesh or the rig's joints.

## Rig by family

- Many-legged: a custom skin on the game's legs (`SkinLegs` bend-plane bones, nearest-part weights blended at joints).
- Four-legged: Tripo's quadruped weights gathered onto the game's bones; its skeleton not trusted.
- Machine: rigid parts cut at the joints, weights blended across each cut so bends stay closed; parts come apart in death.
- Two-legged: Tripo's biped rig posed directly by the game's clips (`humanoidSkeleton` joints at Tripo's, its weights
  folded onto them); never a hidden skeleton copied over.

## Must-haves

Gaze (eyes or head their own parts turned to the traveller by `src/enemies/gaze.js`: the author's rule); claws and
jaws on their own bones; tools separate from the hand, each world its own; sockets and grips held through every clip
(tested every 0.1 s); each world skin's palette and props fitted to the mesh. Keep everything in
`docs/handoffs/enemy-rebuild-2026-10-30-baseline.md` section 1 (ids, skins, size floor, attacks and windows, sounds,
deaths, warm-up, model contract, Unity).

## Evidence and landing

Trial page `references/enemy-redesign-2026-10-30/trials/arena.html` (own port 5400–5499, muted), `variants.js`;
strips and stills (`baseline/baseline-shots.mjs --variant`), the sheet beside the reference, gaze shots, close-ups,
the walk and pounce audit, the bench (1 and 6, High and Handheld), `tests/<foe>-trial.test.js`, the foe's own
README. After the author's pick, land one foe at a time: replace the archetype's builder (`src/enemies/plans/`, the
asset in `public/enemies/<concept>/`, loads awaited) or add a new id when the author keeps the old; Arena warm-up;
Unity (vertex colours, a batch picture against the web); the changelog with before/after pictures and the reference.

## Pitfalls

sRGB COLOR_0 bytes classified as linear; painted eyes left in the texture (or an eye finder fooled by pale texels);
fused fingers (Tripo's biped has none: hold by the hand's centre); skinned meshes squashed under a shadow pool; four
agents conflicting in one shared README (one README a foe).
