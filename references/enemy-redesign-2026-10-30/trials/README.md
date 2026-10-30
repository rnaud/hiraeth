# Enemy rebuild trials (#800 phase 2)

The four trial foes, each as **current** (today's body), **direct** (built in game code) and **Tripo** (generated, then
put on the game's own rig family), compared in the real Arena with the game's renderer, light and ink. Phase 1's
pictures (`../baseline/`) are the current column. Nothing here is in the game's roster: the variants stand in for an
archetype's builder only in this page and these scripts (`src/enemies/plans/index.js` `TRIAL_BUILDERS`, empty in
the game). Web only: nothing the Unity build loads.

## The trial page

`PORT=5486 node references/enemy-redesign-2026-10-30/trials/serve.mjs`, then open
`/references/enemy-redesign-2026-10-30/trials/arena.html` (its own Vite, never 5173). Query: `foe=crab|hound|brute|mummer`,
`variant=current|direct|tripo|side`, `mode=idle|walk|turn|attack|hurt|death|fight`, `cam=q|side|front|rear|close|player`,
`quality=high|handheld`, `ui=0` (pictures). The page is muted when the Sound is built (`characterReview`, `hiraeth.muted`,
every volume 0; checked before anything plays), the traveller cannot be hurt, saves stay in the page's memory.
**Side by side** puts current, direct and Tripo 3 m apart on one clip clock (the same state at the same moment).
The panel picks the attack, the skin, the camera, and toggles a clay view (textures and colours off: baked light shows).
Only the shellback has direct and Tripo bodies so far; the hound, wood cutter and mummer show current only.

![the trial page](shellback/trial-page.webp)

## The scripts

| Script | What |
|---|---|
| `variants.js` | `use(kind, variant)`, `preload()`, `inventory(group)`; the page, the capture and the bench all switch through it |
| `../baseline/baseline-shots.mjs --variant v [--extra]` | phase 1's capture, the same spot, camera, light and eight-frame strips; `--extra` front, flank, rear and clay stills; `side` the row of three |
| `../../../scripts/enemy-roster/bench.mjs --variant v` | the Arena bench with the pack built in that variant |
| `bench-trial.mjs`, `bench-table.mjs` | 1 and 6 of each variant and an empty control, High and Handheld, two rounds reversed; the table |
| `motion-audit.mjs` | `scripts/motion-audit`'s straight walk of each variant, full and half pace, in node |
| `sheet.mjs` | the stills at an equal size beside the approved reference |
| `page-shot.mjs` | a picture and the report of the trial page (a check that it loads, builds every variant and stays muted) |
| `shellback-tripo/generate.mjs` | the Tripo generation (API, the key from `.env` unprinted); the untouched export and the task record go to `../shellback/tripo/` |
| `shellback-tripo/prepare.mjs` | that export into the trial asset: the game's frame and size, the flat texture, vertex colours, the 12k LOD, the landmarks |
| `shellback-tripo/model.js` | the Tripo body on the crab's rig (the custom skin) |

## Shellback (`crab`), phase 2a

Reference: `../shellback/e8102be7-014a-4a03-8150-394a7f722fec-2.png` (approved). Home skin arzach2. All pictures in
`shellback/`, captured 2026-10-30 on this branch, muted headless Chrome on this Mac (Apple M-series, Metal), High
preset, 1280×720, 10:00, clear; looked at one by one.

![stills](shellback/compare-stills.webp)

Strips (eight frames, game time in the labels): `crab-<variant>-<idle|walk|turn|attack|hurt|death>.webp`, the row of
three on one clock in `crab-side-*.webp`; stills `crab[-<variant>]-still-<3q|front|flank|rear|clay|clay-front>.webp`
(current: `crab-still-*`). The current strips are phase 1's (`../baseline/crab-*.webp`; re-captured here to check the
switch: mean difference 1.0/255 on the idle strip, WebP noise).

### What each is

- **Direct** (`src/enemies/plans/shellback.js`): an ochre lathe dome with a darker lip, a pale face peering out under
  it (two slit eyes in their own material, a short mouth), a fat green collar roll, six thick cream legs with round
  knees on broad red slipper feet, two big red pincers hanging in front, a hinged finger behind each blade. Every limb,
  the face and the collar one skinned mesh on the kit's joints (`skinBy`, colours as vertex tints); the dome, two scutes
  and the eyes their own. On the walker plan as today; the same snap/spin/burrow poses, guard tuck, flip, crack (the
  dome comes off) and death. The home skin wears the reference's colours; the six other skins keep their world's palette
  on the new body (the author may want them recoloured to the reference too); their props merged a material.
- **Tripo** (task `5f2aa15f-678e-4969-b6d9-39852b47c598`, image to model, H3.1, `texture_version` v3.5 with
  `delight: true` = Remove Lighting, PBR off, 30k face target; 28,432 triangles, 2048² JPEG; untouched in
  `../shellback/tripo/model.glb`). `prepare.mjs`: scaled to the direct body's 1.55 m crown, a 1024² texture
  flattened to nine colours (median filter, then k-means snap), COLOR_0 sampled from it, 12,000 triangles
  (meshoptimizer, zone borders and UV seams kept), landmarks measured from the mesh's leg columns. `model.js`: the kit's
  walker legs fitted to those landmarks (measured thigh and shin lengths), a custom skin, no humanoid skeleton: thigh,
  shin and foot bones framed in each leg's bend plane (`SkinLegs`, the Keeper's route), the dome, face and collar on the
  body, each claw an arm and a blade; every vertex weighted to its nearest part and blended over 5 cm at the joints.
  The dome cut out as its own mesh (it cracks off), the two scutes copied off its front in its own texture, two slit
  eyes over the painted ones. Other skins: the mesh's colour roles recoloured from the skin's palette (vertex colours).

### Comparison

| Measure | Current | Direct | Tripo |
|---|---|---|---|
| Fidelity to the reference | slate dome on thin pointed legs, claws held high, eye stalks: not the reference | the reference's parts and colours; dome a little low and round, pincers slimmer, legs faceted (7-sided kit cylinders) | the closest silhouette: the half-egg dome, the face and collar under the lip, plump legs and slippers, the curved pincers; dome longer than the reference (Tripo's reading) |
| At combat distance (14 m, ink) | reads as a crab | reads: ochre dome on red feet | reads: ochre dome on red feet; legs a busier yellow-green in shade |
| Baked light (clay, unlit) | – | none (procedural) | clean geometry; a little shading survives in the flattened colours (a yellow-green band on the legs' shaded side, a darker rim) |
| Drawn meshes · triangles (one body, one pass) | 33 (67 built, batched) · 8,480 | 5 · 7,544 | 5 · 12,353 |
| Materials · texture memory | 8 · 0 | 4 · 0 | 3 · 5.33 MB (1024² RGBA8 + mips) |
| Shipped bytes (raw · gzip) | `walker.js` 18.6 · 7.1 KB | `shellback.js` 19.4 · 7.5 KB | `tripo-lod.glb` 480 · 300 KB + `model.js` 19.9 · 7.5 KB + landmarks 2.3 KB (source export 1.39 MB) |
| Draws over the empty Arena, High, 1 · 6 | +99 · +594 | **+15 · +90** | **+15 · +90** |
| Triangles all passes, High, 1 · 6 | +23.7k · +150.8k | +21.1k · +134.0k | +35.2k · +220.3k |
| Draws, Handheld, 1 · 6 | +66 · +396 | +10 · +60 | +10 · +60 |
| Triangles all passes, Handheld, 1 · 6 | +17.1k · +102.5k | +15.1k · +90.4k | +24.9k · +148.7k |
| CPU ms, High, 1 · 6 | +0.15 · +1.30 | +0.35 · +0.65 | +0.45 · +0.85 |
| CPU ms, Handheld, 1 · 6 | +0.30 · +1.05 | +0.45 · +0.55 | +0.30 · +0.70 |
| GPU ms | not separable from the empty Arena at this load (deltas of either sign up to 4 ms, as in phase 1): no GPU claim | | |
| Walk (foot joints), full · half pace: slide m/m, worst | 0 · 0, 0 | 0 · 0, 0 | 0.012 · 0.018, 3 cm |
| Reach / lift (share of leg), cadence Hz, full pace | 0.21 / 0.23, 2.6 | 0.21 / 0.22, 2.5 | 0.18 / 0.22, 3.75 |
| Gait | alternating tripods [0,2,4] [1,3,5] | the same | the same; its legs 0.89 m (the mesh's) against 1.32 m, so quicker steps |
| Deformation | rigid parts | rigid parts in one skin (no stretch) | weights normalised, bind round trip < 0.1 mm, a shin bent alone moves only its leg (tests); a dark seam where the dome is cut from the body shows from the side; the knees fold smoothly, the claw blade is rigid |
| Snap (wind, strike, recover) | the near claw opens and draws back, snaps | the near pincer rears up and forward, finger open, then chops down shut | the near pincer rears up and forward, chops down; no moving finger (fused in the mesh) |
| Hurt, death, lying body | as #797 | the same recipe: rings off the dome, then down on its belly, the pincers forward, dust | the same |
| Kept (both) | id `crab`, def and attacks, windows, guard, shell, sounds (`walker`/`shell`), deaths, size floor, ARMOUR plates, gaze, tells | ✓ | ✓ |
| Time (agent) | – | about 1 h (model 35 min, look fixes 25 min) | about 1.3 h (generation 1.5 min wall; prepare and inspection 25 min; rig and skin 35 min; fixes 15 min) |
| Tripo credits | – | – | **30** (balance 1,825 → 1,795; no rig credits: the rig is the game's) |

(Bench: 28 runs, two rounds reversed, load 4.7–25.5, `shellback/bench.jsonl`; walk: `motion-audit.mjs`. The audit's
own "lowest point" measure reads the direct body's flat red soles as sliding, 0.06–0.09 m/m: a flat sole has no
single lowest vertex and it hops heel to toe; its foot joints do not slide. The Tripo skin's bones sit outside the
kit's chains, so only its foot joints are measured.)

### Recommendation

**Tripo for the look, direct for the pipeline, one call for the author.** Side by side the Tripo body is the closer
picture of the approved shellback: its dome, face, collar, legs and pincers have the reference's soft, plump shapes;
the direct one has the right parts and colours but reads stiffer (faceted legs, slimmer pincers, a lower dome). On
cost both cut the crab's draws by 85 % (+15 against +99 a body on High; six: +90 against +594), which is what this
foe needed whatever won; Tripo carries 64 % more triangles, a 5.3 MB texture and 300 KB gzipped, and walks on shorter
legs (quicker steps, a slight 1–2 cm/m foot drift from the ankle frame). It has no moving pincer finger, a dark seam
where the dome is cut, and the other six world skins are recoloured from vertex colours rather than painted.

My recommendation: **take the Tripo shellback**, with three cleanups before it lands: close the dome seam (cut the dome
along the lip, not by colour), split the pincer's inner finger off as its own bone, and bake the leg shading out of the
flat palette (one cream, one shade). The direct body stays as the fallback and as the template for the other 25
foes, which the brief already builds direct.

### Not done

- The combat review's `defend.mjs` / `dodge.mjs` and the sound QC renders on the new bodies (their attacks, windows and
  sound keys are the crab's own, unchanged; the poses that carry the contact were checked in the strips and tests).
- Unity: neither body is wired there; the trial is web only. The Tripo asset carries COLOR_0 for the engines' VMs.
- The other three trial foes (phase 2b and on). The mummer's T-pose was picked by the author on main (`0c2c1b7bc`,
  `../keep-mummer/tpose/`), so its Tripo trial can go ahead.
