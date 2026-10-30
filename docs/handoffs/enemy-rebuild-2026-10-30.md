# Enemy rebuild handoff — 30 October 2026

Tracking issue: https://github.com/rnaud/hiraeth/issues/800

## User request and scope

Rebuild the in-game enemies to follow the newly selected references, including proper
rigging/articulation, animation, attacks, hit detection, sounds, spawning and gameplay
wiring. Compare direct in-game modeling with Tripo for **four enemies**, then rebuild
the rest directly in code. This handoff records the request; no enemy was rebuilt in
this reference-exploration commit.

“Directly” means models authored by the coding agent with the game's existing model
builders, materials and animation systems. Do not turn this into a wholesale Tripo
migration. For the four trials, implement both approaches and compare them before
choosing which variant to retain. Use the direct approach for the remainder unless
the author changes that instruction.

The reference manifest contains **41 concept directions, 45 selected images**:
29 existing archetype IDs (two alternative directions for `grunt`) and 11 new
concepts. The original review covers 32 built types / 137 world appearances.
`lizard`, `heron` and `marionette` were dismissed; do not resurrect them because the
request says “all”. Review their encounter references when retiring/replacing them.
The 13 models formerly marked Keep are now also in rebuild scope: those historical
Keep records mean the old model was acceptable, not that it is exempt from this task.
Temple guardians and the separate archived 100-enemy atlas are outside this ordinary
enemy catalogue; do not silently expand the scope to them.

## Start here

- Read `AGENTS.md` and `.agents/skills/hiraeth-ai-characters/SKILL.md`, including its
  procedural quality and non-humanoid guidance. Check current local handoff/device
  rules if available. Start from current `origin/main` in an isolated worktree.
- **Canonical selections:** `tools/enemy-review-references.js`. Each choice has a
  Midjourney job, **zero-based** image index, source URL and preview URL. Multiple
  selections are alternatives, not pieces to combine indiscriminately. Earlier
  seven-creature art is superseded by the approved new-style passes.
- **Portable feedback:** import `enemy-rebuild-2026-10-30.feedback.json` beside this
  document using the review page's Import feedback button. It preserves all 178
  visible records (137 appearances + 41 concepts), with literal notes and decisions.
  Browser localStorage alone is not a handoff; the committed JSON is the snapshot.
- Run a separate Vite server on an available port 5400–5499 and open
  `/tools/enemy-review.html`. Never use/stop port 5173. The earlier session used 5446;
  that server is not a durable dependency. Views cover references, current models,
  new concepts and kept-enemy explorations. Models and reference images are separate.
- Art is currently linked from Midjourney, **not vendored as full-resolution source
  assets**. Only the approved shellback review preview is archived in
  `references/enemy-redesign-2026-10-30/`; see its README. Direct CDN archiving returned HTTP 403 during handoff preparation.
  Download the selected original through the visible internal Midjourney browser
  before modeling; preserve its job/index and untouched source. The 640px review
  URL is a preview, not proof of full-resolution modeling input. The source links
  remain usable if CDN thumbnails fail. Do not substitute an unselected variant.
- Reference generation stays in visible internal Midjourney. New corrective views
  or T-poses still need the author's selection before saving/integration. Existing
  selected art and the rebuild itself are authorized by the current request.

## Four-enemy comparison (eight prototypes)

These four are the handoff's proposed representative sample; the user specified the
number and the two methods, not the individual species.

| Enemy / existing ID | Coverage | Approved concept key |
|---|---|---|
| Shellback / `crab` | Multi-legged organic shell, moving limbs and combat contacts | `shellback` |
| Broad-pawed hound / `hound` | Quadruped gait, pounce, wide paws and body clearance | `hound` |
| Wood cutter / `brute` | Articulated biped machine, saw/clamp tools, heavy attacks | `keep-brute` |
| Dune mummer / `mummer` | Organic biped, face, hands, held weapon and humanoid clips | `keep-mummer` |

For each, build a direct/code model and a Tripo model from the **same selected
reference**, at the same intended size. Present them side by side in the real game
renderer, with the same camera, lighting, materials and animation/attack states.
Keep trial variants isolated from live roster selection until compared; do not
replace a model merely because mesh generation succeeded.

Record fidelity to silhouette, face/eyes, palette and proportions; gameplay-distance
readability; animation and weapon-contact quality; cleanup/rigging time; service
credits/cost; triangles, materials/draw calls, texture memory, shipped bytes and
frame/animation cost. Test idle, walk/run, turn, attack windup/strike/recovery, hurt,
stagger, death and any special action from front/side/rear. Record source/job IDs,
exports and scripts so another agent can reproduce the trial. Recommend the winner
per enemy, supported by pictures and motion evidence, then integrate the chosen
variant. The other 25 existing IDs and new concepts use direct modeling by default.

For Tripo: follow the skill's verified neutral T-pose requirement for humanoids
before spending generation credits; prepare selected rest views for non-humanoids
and machines using suitable rigs, not a humanoid skeleton forced onto every body.
Use lighting-neutral colour and Remove Lighting when available; inspect the actual
base colour under unlit/opposite lighting. Preserve originals, optimize derivatives,
check topology/weights/joints, and do not ship the service's raw maximum-size export.
Trial #768 is useful pipeline evidence, but its old red grunt is not this task's
approved new identity. Reuse sound/rig infrastructure, not superseded artwork.

## Art and implementation contract

- Scavengers Reign simplicity in Hiraeth's muted Moebius world: broad masses, sparse
  contours, few flat colours, simple dot/slit eyes and posture-led expression.
  BotW informs practical readability. One creature plus one functional concept.
- No bird enemies, capes/trailing cloth, thin weight-bearing legs or oversized back
  loads. Broad feet/paws and hands; shoulder/hip clearance; obvious moving joints.
  Floating enemies must read as separate from the ground. Bell walker uses the
  selected clean-background revision, not the earlier scenery-heavy batch.
- Respect the recent #741 size pass: compare beside the traveller and at real combat
  distance; do not restore tiny foes from old dimensions or shrink them to fit a
  flattering gallery camera. Preserve current combat and progression fixes.
- Keep existing IDs, world skin mappings and encounter/save compatibility where
  possible. Adapt animation and hit shapes to the new anatomy rather than grafting
  a new mesh onto incorrect old timings. Retain legible counterplay and difficulty.
- Wire idle/locomotion, aggro, attacks, projectile origins, weapon sockets, hurtboxes,
  contact windows, warnings, block/parry/interrupt responses, damage, stagger,
  knockback, death/ragdoll/debris, drops, target/lock-on bounds and cleanup/disposal.
  Test state transitions and complete loops, not only isolated gallery poses.
- Wire sounds for movement/servo/footfall, aggro/vocalization, windup/attack, hit,
  armour/block/parry, hurt, death and unique powers. Reuse the approved sound work
  from #771; verify trigger timing, positional attenuation, trims, layering and
  concurrency. No silent attacks, duplicated hurt cries or loops surviving despawn.
  Keep previews muted before loading; hearing a review requires explicit permission.
- Validate real world spawns, Arena/practice selection, skins, camp/elite variants,
  bestiary/gallery data and world/temple encounters that use ordinary enemies.
  New concepts need distinct IDs, role/counterplay and deliberate world placement;
  no automatic replacement of similar kept robots (surveyor ≠ inspection tripod,
  compass warden ≠ ring drone). Boar is a separate future enemy, never the grunt.
- Unity parity is part of gameplay work. Verify web/Unity material, silhouette,
  articulation, attack/contact timing and sound wiring, using comparable pictures.
  Do not label a web-only prototype as complete cross-platform implementation.

## Open choices and staged work

The `cistern-forager` and `salt-drifter` are still liked **grunt alternatives**, not
one settled identity. Build the four-method trial without waiting on this; resolve
the grunt choice with the author before finalizing that archetype. The dew gatherer
has two liked designs; select one coherent anatomy for its model rather than mixing
both. Boar stays in the later/new-enemy backlog. Other new designs have references
but no final encounter placement; establish those roles as part of their integration.

Suggested order: establish baseline/evidence → four dual-method trials → land their
chosen variants → direct rebuilds by locomotion family → new enemies → full roster
world/encounter/audio/performance regression. Ship reviewable batches with evidence,
not a single mass replacement. Track each entry from selected → prototype → rigged
→ combat/sound wired → web/Unity verified → integrated. The old reference-selection
page is not itself a completed implementation tracker.

## Code and existing work to inspect

- `src/enemies/archetypes.js`, `skins.js`, `plans/index.js`, `plans/`, `frame.js`,
  `fight.js`, `attacks.js`, `wield.js`; `src/foe-body.js`, `src/foe-worlds.js` and
  `src/foes.js` for runtime/roster integration.
- `src/foe-sounds.js`, `src/foe-voices.js`, `src/foe-sound-trims.js` for current audio.
- `docs/systems/foes.md`, `docs/systems/audio.md`, `docs/systems/engine-bridge.md`,
  `scripts/tripo/README.md`, and the character skill's repository map.
- #722 combat/counterplay work; #724 humanoid clip animation; #768 existing Tripo
  grunt trial; #771 enemy sounds (closed); #741 recent enemy size corrections.
  Inspect current main rather than copying assumptions from older docs.

## Verification and completion gates

- Targeted model, rig, attacks, audio, encounter and disposal regression tests, then
  required affected-test hook. Test concurrency 2; wait if system load exceeds 25.
- `node scripts/bridge-gaps.mjs`, `node --test tests/reference-paths.test.js`, and
  `npx vite build` before commits; do not bypass hooks or selected CI failures.
- Actual reviewed in-game before/after images and useful motion/audio test evidence.
  Concept pictures never count as implementation evidence. Every player-visible
  change gets the current changelog entry and media; run `node scripts/changelog-md.mjs`.
- Record device/preset, counts and measured budgets. Serialise Unity builds and
  respect device restrictions; do not wake locked devices or change settings/saves.
- Complete only when the intended roster works in game with attacks and sounds,
  approved references are recognizable in motion, Unity parity is checked, and all
  outstanding deviations/placement decisions are explicit.

## Reference inventory

Generated from the canonical manifest at handoff time. Option numbers below are
human-facing (1–4); the source code and feedback use zero-based indices.

| Concept | Existing ID / new | Decision | Selected source(s) |
|---|---|---|---|
| Shellback (shellback) | crab | selected | [option 3](https://www.midjourney.com/jobs/e8102be7-014a-4a03-8150-394a7f722fec?index=2) |
| Bellows toad (bellows-toad) | toad | selected | [option 1](https://www.midjourney.com/jobs/c5a76758-e908-4034-acc5-7b88452dcb71?index=0) |
| Drill-head centipede (centipede) | centipede | selected | [option 4](https://www.midjourney.com/jobs/616e0bd4-9a63-476b-9485-1e5efda02210?index=3) |
| Reed knot (reed-knot) | rootknot | selected | [option 2](https://www.midjourney.com/jobs/0de92fb6-aa84-4252-b110-fd96a9913888?index=1) |
| Cloud jelly (cloud-jelly) | jelly | selected | [option 2](https://www.midjourney.com/jobs/0cdfba00-da12-409f-8fd5-03de262f50ca?index=1) |
| Lamp moth (lamp-moth) | moth | selected | [option 2](https://www.midjourney.com/jobs/5b88e9ea-3cc5-4ea8-ab97-4431bfb5584b?index=1) |
| Storm ray (storm-ray) | ray | selected | [option 1](https://www.midjourney.com/jobs/4fc2da68-aa8c-4a93-bc00-5f1795b5e039?index=0) |
| Dune worm (dune-worm) | worm | selected | [option 4](https://www.midjourney.com/jobs/ca727e90-9d58-49d2-a060-bbbd815e325f?index=3) |
| Foundry fencer (fencer) | fencer | selected | [option 2](https://www.midjourney.com/jobs/dd52ce4f-1165-4d5c-b09b-a459cf2baa4d?index=1) |
| Mobile ink blob (blob) | blot | selected | [option 3](https://www.midjourney.com/jobs/eb43fb37-f063-47ab-9a4f-212ba29d443b?index=2) |
| Broad-pawed hound (hound) | hound | selected | [option 2](https://www.midjourney.com/jobs/5d7b275f-a6fd-4e34-a0fe-7c6d4ebc850a?index=1) |
| Cistern forager (cistern-forager) | grunt | shortlist | [option 2](https://www.midjourney.com/jobs/e7f4d3f5-de8c-4c1e-8c6c-69804bac7b85?index=1), [option 1](https://www.midjourney.com/jobs/509d2563-8e51-4650-8bd1-13b032b0fff9?index=0), [option 1](https://www.midjourney.com/jobs/c4086168-5ecf-4644-9163-3fc1645be0aa?index=0) |
| Salt-flat drifter (salt-drifter) | grunt | shortlist | [option 4](https://www.midjourney.com/jobs/504390cd-9735-4e47-9526-abe8fe95f29f?index=3), [option 3](https://www.midjourney.com/jobs/e0af33a3-1cce-4a8e-8820-054651a5f08f?index=2) |
| Root crusher (hulk) | hulk | selected | [option 3](https://www.midjourney.com/jobs/69ae4d9f-9bdb-4eab-998a-08bdf543617d?index=2) |
| Pod stalker (prowler) | prowler | selected | [option 3](https://www.midjourney.com/jobs/5d011893-58f1-4c33-a34d-ac8df1a99842?index=2) |
| Resonator chief (warlord) | warlord | selected | [option 3](https://www.midjourney.com/jobs/b7d9aa56-69bf-44a7-becc-6a2e9737b4bf?index=2) |
| Cistern keeper (sentinel) | sentinel | selected | [option 1](https://www.midjourney.com/jobs/395884ff-9eec-4903-ba5c-e910310ff88d?index=0) |
| Clay-pot boar (boar) | NEW | reserved | [option 4](https://www.midjourney.com/jobs/221148a3-5cfa-4c0d-a595-7816f210f56e?index=3) |
| Dew gatherer (dew-gatherer) | NEW | selected | [option 2](https://www.midjourney.com/jobs/fee16b22-fbf9-4250-a225-8179ef4fa67d?index=1), [option 4](https://www.midjourney.com/jobs/7e1ddd98-bd37-45c2-8128-61192ea5d24a?index=3) |
| Tripod surveyor (tripod-surveyor) | NEW | selected | [option 4](https://www.midjourney.com/jobs/1cb3a983-41de-4c96-9b19-cd143990c114?index=3) |
| Plumb walker (plumb-walker) | NEW | selected | [option 2](https://www.midjourney.com/jobs/ef3b0203-c81d-4f64-bd85-1253a5598144?index=1) |
| Kiln beetle (kiln-beetle) | NEW | selected | [option 2](https://www.midjourney.com/jobs/d83c3f89-4602-41ca-a8e5-bad7f9ce5a5f?index=1) |
| Compass warden (compass-warden) | NEW | selected | [option 1](https://www.midjourney.com/jobs/c397331d-8fc5-470e-bbbb-6cd4e453ada9?index=0) |
| Puff keeper (puff-keeper) | NEW | selected | [option 2](https://www.midjourney.com/jobs/7ae3347a-d68f-4d71-928a-cab8ec66cff2?index=1) |
| Shovel mole (shovel-mole) | NEW | selected | [option 2](https://www.midjourney.com/jobs/57f66563-892d-4373-a2d6-83c631e7e9b0?index=1) |
| Cistern ram (cistern-ram) | NEW | selected | [option 2](https://www.midjourney.com/jobs/ea19bfb0-518c-4868-b2f5-41db51095ec8?index=1) |
| Pebble hare (pebble-hare) | NEW | selected | [option 3](https://www.midjourney.com/jobs/31d4e042-743f-422b-a815-95c153d539fc?index=2) |
| Seed splitter (seed-splitter) | NEW | selected | [option 2](https://www.midjourney.com/jobs/c0860859-bd12-43ff-8228-782a68ec39fd?index=1) |
| Seedpod skitter (keep-skitter) | skitter | selected | [option 2](https://www.midjourney.com/jobs/711f83a4-63bc-4576-b299-458c14ce5bac?index=1) |
| Pearl roller (keep-roller) | roller | selected | [option 2](https://www.midjourney.com/jobs/f586ce93-9d9c-4203-a22c-2731075f1065?index=1) |
| Inspection tripod (keep-tripod) | tripod | selected | [option 1](https://www.midjourney.com/jobs/9bb4fd97-30dd-471d-8ac0-c8da599468ee?index=0) |
| Crucible walker (keep-cart) | cart | selected | [option 4](https://www.midjourney.com/jobs/13ed7341-1960-43e2-8f12-8b8481c2bd68?index=3) |
| Bell walker (keep-bell) | bell | selected | [option 2](https://www.midjourney.com/jobs/b4852320-c23b-4bf7-a8e2-10c9ede8cabd?index=1) |
| Spool drone (keep-drone) | drone | selected | [option 1](https://www.midjourney.com/jobs/e708a0d0-e805-46fd-aee5-4c328202ff41?index=0) |
| Wood cutter (keep-brute) | brute | selected | [option 1](https://www.midjourney.com/jobs/a1860f49-ecc5-4922-91f6-94b031e5e9a7?index=0) |
| Hollow woodsman (keep-shade) | shade | selected | [option 4](https://www.midjourney.com/jobs/91fff498-280d-4229-bae9-e270dee52ba4?index=3) |
| Cinder wisp (keep-wisp) | wisp | selected | [option 4](https://www.midjourney.com/jobs/885e3431-b1b8-4db6-ad7b-c772cd14d530?index=3) |
| Dune mummer (keep-mummer) | mummer | selected | [option 2](https://www.midjourney.com/jobs/ad94a6b0-55ba-461e-9577-d745036565ae?index=1) |
| Mummer king (keep-mummerking) | mummerking | selected | [option 2](https://www.midjourney.com/jobs/71c2e792-5ceb-40f7-966d-19b12c1b10a6?index=1) |
| Pendulum oracle (keep-oracle) | oracle | selected | [option 2](https://www.midjourney.com/jobs/b4b39e06-0115-4b08-8d3b-1e017919b98c?index=1) |
| Survey crawler (keep-crawler) | crawler | selected | [option 1](https://www.midjourney.com/jobs/22d8861b-51c8-4a48-9776-9c45ee542615?index=0) |
