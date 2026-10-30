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
All four trial foes (the shellback, the hound, the dune mummer and the wood cutter) have direct and Tripo bodies.

![the trial page](shellback/trial-page.webp)

## The scripts

| Script | What |
|---|---|
| `variants.js` | `use(kind, variant)`, `preload()`, `inventory(group)`; the page, the capture and the bench all switch through it |
| `../baseline/baseline-shots.mjs --variant v [--extra]` | phase 1's capture, the same spot, camera, light and eight-frame strips; `--extra` front, flank, rear and clay stills; `side` the row of three |
| `../../../scripts/enemy-roster/bench.mjs --variant v` | the Arena bench with the pack built in that variant |
| `bench-trial.mjs`, `bench-table.mjs` | 1 and 6 of each variant and an empty control, High and Handheld, two rounds reversed; the table |
| `motion-audit.mjs` | `scripts/motion-audit`'s straight walk of each variant, full and half pace, in node (`crab@arzach2` or `brute@perdide2`) |
| `sheet.mjs` | the stills at an equal size beside the approved reference (a fifth argument raises the crops for a taller foe) |
| `page-shot.mjs` | a picture and the report of the trial page (a check that it loads, builds every variant and stays muted) |
| `shellback-tripo/generate.mjs` | the Tripo generation (API, the key from `.env` unprinted); the untouched export and the task record go to `../shellback/tripo/` |
| `shellback-tripo/prepare.mjs` | that export into the trial asset: the game's frame and size, the 12k LOD, the dome cut along its lip, the texture repainted flat by part, vertex colours, the landmarks |
| `../../../src/enemies/plans/shellback-tripo.js` | the Tripo body on the crab's rig (the custom skin: legs, claws with their inner finger, the face that turns to you): the game's crab since v2.38, moved out of `shellback-tripo/model.js`; its asset `public/enemies/shellback/body.glb` (`scripts/tripo/ship-shellback.mjs` from `tripo-lod.glb`) |
| `shellback-tripo/closeups.mjs` | the gaze picture (the traveller to its left, then its right) and the snap close-up (in front and side on), a row a variant |
| `gaze-shot.mjs` | the row of three idle and watching, the traveller to one side: a picture and each body's head/eye yaw toward him (gaze.js) |
| `hound-tripo/generate.mjs [--rig]` | the hound's Tripo generation, then Tripo's free rig check and its quadruped rig; exports and record to `../hound/tripo/` |
| `hound-tripo/prepare.mjs` | the rigged export into the trial asset: frame and size, flat texture, vertex colours, Tripo's weights gathered onto the game's bones, the 12k LOD, landmarks from the rig's joints |
| `hound-tripo/model.js`, `node-source.mjs` | the Tripo hound on the quadruped plan (bend-plane leg bones, its head the gaze's bone; its horns, drips, glints and halo); the asset in node |
| `hound-tripo/skins-shot.mjs` | every world skin of the hound, current beside Tripo: three-quarter, flank and head stills, and the sheet `hound/skins/skins.webp` |
| `scripts/tripo/ship-hound.mjs` | the trial asset made into the game's (`public/enemies/hound/body.glb`: the texture at 512², the landmarks in the mesh's extras) |
| `world-shot.mjs` | a foe as the game builds it, in its own worlds as you land (three-quarter, flank, head, wide; `--attack` its wind-up and leap, its pool): a before/after by hand (`ROOT=` another tree) |
| `gaze-one.mjs` | the same check for one variant or the row, the traveller to the foe's right front (the wood cutter's gaze pictures) |
| `woodcutter-tripo/generate.mjs`, `prepare.mjs` | the wood cutter's Tripo generation (to `../keep-brute/tripo/`) and its trial asset: 2.4 m, decimated by geometry, cut into parts by geometry (Tripo's saw hand dropped), the texture repainted by part in the reference's colours with swatches, COLOR_0, landmarks (the cuts, the head's sphere, the visor, the disc) |
| `mummer-tripo/generate.mjs`, `prepare.mjs` | the dune mummer's Tripo generation and rig (to `../keep-mummer/tripo/`) and its trial asset: 1.2 m, 12k LOD on Tripo's weights, the mittens widened, eight flat colours by part, COLOR_0, the skeleton (`--no-repaint --no-widen`: phase 2's asset) |
| `mummer-tripo/model.js`, `node-source.mjs`, `closeups.mjs` | the Tripo mummer on the humanoid clip rig, Tripo's own skeleton posed directly; its source in node; the close rows (body, mask, mittens, the whack, clay) |
| `mummer-tripo/archetype.js` | the dune mummer keyed as its own enemy, `dunemummer` (`duneMummerEntry()`: id, def, skins, weapons, sounds, places), not yet registered |
| `woodcutter-tripo/model.js`, `source-node.mjs` | the Tripo wood cutter on the brute's rig family (the shared `woodcutterMotion`): rigid parts blended across the limbs' cuts, each world's own tool on the wrist, the head turning about its dome's centre; its source in node |

## Shellback (`crab`), phase 2a and its fixes

The author picked Tripo for the shellback (2026-10-30), with four fixes first: the dark seam at the dome's lip, the
inner pincer finger as its own bone, the leftover leg shading, and its look at the traveller ([the fixes](#the-tripo-fixes)).
Every picture and number in this section is of the fixed body, re-shot after them; phase 2a's are in git (`0a1fa957d`)
and in the before/after pictures.

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
  `../shellback/tripo/model.glb`). `prepare.mjs`: scaled to the direct body's 1.55 m crown, 12,000 triangles
  (meshoptimizer, zone borders and UV seams kept), the dome cut along its lip (12,592 triangles after the cut), a 1024²
  texture repainted in five flat colours (the reference's, the direct body's home skin's), COLOR_0 from it, landmarks
  measured from the mesh (the leg columns, the claws' geodesic bands, the lip's curve, the painted eyes). `model.js`:
  the kit's walker legs fitted to those landmarks (measured thigh and shin lengths), a custom skin, no humanoid
  skeleton: thigh, shin and foot bones framed in each leg's bend plane (`SkinLegs`, the Keeper's route), the collar and
  belly on the body, a face bone the gaze turns, each claw a shoulder, a blade and an inner finger; every vertex
  weighted to its nearest part and blended over 5 cm at the joints. The dome its own mesh in one flat colour (it
  cracks off), the two scutes copied off its front, two slit eyes on the face bone where the painted ones were. Other
  skins: the mesh's colour roles recoloured from the skin's palette (vertex colours).

### The Tripo fixes

![phase 2a against fixed: front, flank, three-quarter, clay](shellback/tripo-fixes.webp)

1. **The dark seam at the dome's lip: cut by geometry.** Phase 2a took the dome's triangles by colour (ochre over the
   hips + 10 cm), so the cut ran ragged half way down the dome, the strip under it skinned to the thighs; from the side
   it showed as a jagged dark band (its lit and shadowed halves apart, and an ink line along it). Now `prepare.mjs`
   finds the lip itself: the dome's outermost point in each of 48 azimuths, a closed curve through them (a Fourier
   series of order 3, the stray points of a claw's root dropped), and the cut 2.5 cm under it. Every triangle across
   the curve is split exactly on it (323 edges), and what lies over it and joins the crown is the dome, its triangles
   first in the index (`landmarks.domeTriangles`, the curve in `landmarks.lip`). The dome is drawn in one flat colour;
   nothing under the lip is ochre (its underside dark, the face and back cream). Test: every dome vertex over the cut,
   its open edge on the cut within 1 mm. The flank still: no seam.
2. **The inner pincer finger: its own bone.** Walked out from where it joins the body (geodesic bands over the claw's
   red surface), each Tripo claw is a ball against the face's side, an inner finger rising from it to a knuckle at the
   top of the arch, and the blade hanging from the knuckle in front; the jaw is the gap under the arch. Phase 2a had
   the arm's pivot in the arch and the finger and ball left on the body, so the snap stretched the claw. Now the
   shoulder's pivot is where the ball joins the body, and the blade and the finger are each a bone hinged at the
   knuckle (`landmarks.claws`; a claw's bones take only red vertices). The snap opens the jaw at the top of the wind
   (the blade forward, the finger back: 0.59 → 0.96 m tip to finger, against the direct body's 0.20 → 0.54) and slams
   it shut in the chop (0.36 m), as the direct and current crabs do; at idle it twitches. Test: opens over 1.3×, shuts
   under 0.6× of open, the finger carries red vertices only.
3. **Leftover leg shading: out of the colours.** The k-means' nine colours were two ochres, two creams, a yellow-green
   and a darker ochre at the borders besides the five roles. `prepare.mjs` now gives each cluster its role by hue and
   repaints the texture by part, one flat colour a role, the reference's own (the direct body's home skin's: ochre
   `#df9f45`, cream `#f1e2ae`, red `#c75f3a`, green `#6f9d72`, dark `#3a2c22`); the texels between the UV islands are
   filled from their nearest island, so no other colour bleeds in at the smaller mips. Test: COLOR_0 holds exactly the
   five colours. The paler cream (Tripo's was a saturated `#f4e183`) is what took the yellow-green out of the legs'
   shade: the patches still on the legs and the dome's shaded side in the stills are the game's own light and shadow
   (they are in the clay view too, as on the direct body), not the colours.
4. **Its look at the traveller (the author's).** The painted eyes are painted out of the texture (prepare.mjs measures
   them first: two slits 3 × 9 cm at x ±0.14 m); two slit eyes of their size stand in their place, a little proud of
   the face along its normal, on a face bone. The face's vertices (an ellipsoid between the claws, eased out to its
   edge) ride that bone, which `src/enemies/gaze.js` turns toward the traveller (`turn`, 0.3 rad either way, as the
   direct body turns its face 0.45), and the eyes slide on it the rest of the way (`slide`, 3.5 cm). The crab plan has
   no head and the game's crab no body twist, so nothing else follows. The direct body already looked: its face group
   turns, the eyes fixed on it (checked here: ±0.45 rad). Between him 3.4 m to its left and to its right the eyes
   move 0.17 m on the direct body, 0.22 m on the Tripo one (the face ±0.3 rad, the eyes at their 0.7 reach). Test: for
   both, the face turns his way and the eyes go his way.

![gaze: him to its left, then its right, the full view and the face](shellback/crab-gaze.webp)

![snap: rest, half wind, top of the wind, the chop, shut, recovery; in front and side on](shellback/crab-snap.webp)

Phase 2a's Tripo body in the same frames (`closeups.mjs` run on `0a1fa957d`'s asset and model):
`shellback/crab-gaze-phase2a.webp`, `shellback/crab-snap-phase2a.webp` (the whole pincer swings, the seam shows side
on). The trial page after the fixes, side by side in the snap: `shellback/trial-page.webp`. The current
crab's raised claw leaves the snap's frame (it is a metre taller): its strips show it.

### Comparison

| Measure | Current | Direct | Tripo (after the cleanups; before them in brackets) |
|---|---|---|---|
| Fidelity to the reference | slate dome on thin pointed legs, claws held high, eye stalks: not the reference | the reference's parts and colours; dome a little low and round, pincers slimmer, legs faceted (7-sided kit cylinders) | the closest silhouette: the half-egg dome, the face and collar under the lip, plump legs and slippers, the curved pincers; dome longer than the reference (Tripo's reading) |
| At combat distance (14 m, ink) | reads as a crab | reads: ochre dome on red feet | reads: ochre dome on red feet, cream legs, the dome's edge one clean line |
| Baked light (clay, unlit) | – | none (procedural) | none left in the colours (five flat ones, phase 2a's yellow-green and dark rim gone); clean geometry; the patches in the stills are the game's light and shadow, in the clay view too |
| Drawn meshes · triangles (one body, one pass) | 33 (67 built, batched) · 8,480 | 5 · 7,544 | 5 · 12,945 |
| Materials · texture memory | 8 · 0 | 4 · 0 | 3 · 5.33 MB (1024² RGBA8 + mips; the PNG is 20 KB of five colours) |
| Shipped bytes (raw · gzip) | `walker.js` 18.6 · 7.1 KB | `shellback.js` 19.4 · 7.5 KB | `tripo-lod.glb` 481 · 296 KB + `model.js` 23.6 · 8.8 KB + landmarks 3.6 KB (source export 1.39 MB) |
| Draws over the empty Arena, High, 1 · 6 | +99 · +594 | **+15 · +90** | **+15 · +90** |
| Triangles all passes, High, 1 · 6 | +25.5k · +152.8k | +23.0k · +135.9k | +38.8k · +233.1k |
| Draws, Handheld, 1 · 6 | +66 · +396 | +10 · +60 | +10 · +60 |
| Triangles all passes, Handheld, 1 · 6 | +17.1k · +102.0k | +15.2k · +90.6k | +26.1k · +155.5k |
| CPU ms, High, 1 · 6 | +0.35 · +1.00 | +0.25 · +0.80 | +0.55 · +1.00 |
| CPU ms, Handheld, 1 · 6 | +0.35 · +1.25 | +0.25 · +0.65 | +0.35 · +0.70 |
| GPU ms | not separable from the empty Arena at this load (deltas of either sign up to 3 ms, as in phase 1): no GPU claim | | |
| Walk (foot joints), full · half pace: slide m/m, worst | 0 · 0, 0 | 0 · 0, 0 | 0.012 · 0.018, 3 cm |
| Reach / lift (share of leg), cadence Hz, full pace | 0.21 / 0.23, 2.6 | 0.21 / 0.22, 2.5 | 0.18 / 0.22, 3.75 |
| Gait | alternating tripods [0,2,4] [1,3,5] | the same | the same; its legs 0.89 m (the mesh's) against 1.32 m, so quicker steps |
| Deformation | rigid parts | rigid parts in one skin (no stretch) | weights normalised, bind round trip < 0.1 mm, a shin bent alone moves only its leg (tests); the dome cut on its lip, no seam; the knees fold smoothly; the claw's blade and finger bend at the knuckle, its ball at the body |
| Snap (wind, strike, recover) | the near claw opens and draws back, snaps | the near pincer rears up and forward, finger open, then chops down shut (jaw 0.20 → 0.54 → 0.18 m) | the near pincer rears up and forward, the jaw open (blade forward, inner finger back), then chops down shut (0.59 → 0.96 → 0.36 m) |
| Looks at him (gaze) | its eye stalks lean to him | its face turns, ±0.45 rad, the eyes on it | its face turns, ±0.3 rad, and the eyes slide on it 3.5 cm (the painted ones painted out) |
| Hurt, death, lying body | as #797 | the same recipe: rings off the dome, then down on its belly, the pincers forward, dust | the same |
| Kept (both) | id `crab`, def and attacks, windows, guard, shell, sounds (`walker`/`shell`), deaths, size floor, ARMOUR plates, gaze, tells | ✓ | ✓ |
| Time (agent) | – | about 1 h (model 35 min, look fixes 25 min) | about 1.3 h (generation 1.5 min wall; prepare and inspection 25 min; rig and skin 35 min; fixes 15 min), then the four fixes about 1.5 h (the mesh's claws and lip measured 30 min, cut and repaint 25 min, bones and gaze 20 min, re-shoot and review 25 min) |
| Tripo credits | – | – | **30** (balance 1,825 → 1,795; no rig credits: the rig is the game's; the fixes no new generation) |

(Bench, re-run after the fixes: 28 runs, two rounds reversed, load 13.1–33.1 (other agents on the machine; each run
started under 25), `shellback/bench.jsonl`; the empty Arena itself draws 74 on High now against phase 2a's 87, so
compare the deltas. Walk: `motion-audit.mjs`, unchanged by the fixes. The audit's
own "lowest point" measure reads the direct body's flat red soles as sliding, 0.06–0.09 m/m: a flat sole has no
single lowest vertex and it hops heel to toe; its foot joints do not slide. The Tripo skin's bones sit outside the
kit's chains, so only its foot joints are measured.)

### Recommendation

**After the fixes (the author's pick, Tripo):** the four are done and the Tripo body keeps everything else it had
(the same mesh, legs, gait and cost: the cut adds 592 triangles, the colours and bones none). Its dome reads as one
clean shell from every side, its legs in the reference's flat cream, its jaw opens and shuts in the snap, and it looks
at the traveller with its face and eyes. Ready for the author to look at side by side again on the trial page
(`variant=side`); landing it in the game (the crab's builder, its six world skins, Unity) is the next step's.

Phase 2a's recommendation, as written then: **Tripo for the look, direct for the pipeline, one call for the author.** Side by side the Tripo body is the closer
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
- After the fixes, still off on the Tripo body: the game's shadow map draws a jagged edge across the dome's shaded
  flank and the legs (both trial bodies, the clay view too: the shadows', not the mesh's); the face sits in the dome's
  shadow, so it reads grey where the reference's is lit; the face turns only 0.3 rad (its border is eased over 10 cm
  of the fused mesh, the claws' balls beside it: more would stretch it). The texture is flat now and could be 512²
  (1.3 MB, not 5.3); the six other world skins wear their role colours, the dome flat, no props.
- The other three trial foes (phase 2b and on). The mummer's T-pose was picked by the author on main (`0c2c1b7bc`,
  `../keep-mummer/tpose/`), so its Tripo trial can go ahead.

### In the game (v2.38)

The author picked Tripo and asked for it in the game at once (2026-10-30): the crab's builder is now
`src/enemies/plans/shellback-tripo.js` `shellbackCrab` (every world, the Arena, the fight temples, the gallery; Unity),
the old slate crab (`plans/walker.js`) is gone and the direct body stays as the stand-in where the asset is not loaded.
So on this page `current` and `tripo` are the same body now. What moved and what was added (docs/systems/foes.md, "The
shellback crab"):

- The asset: `public/enemies/shellback/body.glb`, 396 KB (281 KB gzipped) against the trial's 481: the same mesh, its
  indices 16 bits, the texture 512² (nearest: still exactly the five colours; 1.33 MB with mips against 5.33), the
  landmarks in its extras. Loaded before the foes are made (src/main.js, the gallery); read at once in Unity and Node;
  Unity draws its vertex colours (`-fight shellback`).
- The skins: the home skin's palette in `src/enemies/skins.js` is the reference's now; the other six recolour the five
  roles from their palettes (the collar their `joint`), paint the dome with their own `shell` surface (the glosses made
  small: on this broad smooth dome the old ones lit two patches like eyes) and wear their dress over the dome's measured
  top: antennae, patina, barnacles with the rope and anchor, coral, glass facets, a gabled awning.
- The eyes' mesh has its origin between them (the engines' mirror sends their matrix as the face turns); each kit leg
  answers the walk audit's `lowest` with its foot bone (`tests/motion-plans.test.js`).

Measured in real worlds (Vael II and the Salt Harbour, six crabs of the world's skin against none, High and Handheld,
two rounds alternating, `scripts/enemy-roster/bench.mjs --level`): draws +594 → +91 (Vael II, High), +396 → +60
(Handheld), +758 → +146 and +504 → +96 (the Salt Harbour, its dress); triangles +153k → +240k (High, Vael II); the
script's time a frame +1.7 → +0.8 ms; GPU memory of the crabs 0.32 → 2.1 MB (Vael II, its texture) and 0.36 → 0.95 MB
(the Salt Harbour). The changelog's v2.38 line has the pictures and numbers.

Still off: the shadow's jagged edge across the dome's shaded side near its lip and on the legs (the game's shadow map on
the decimated mesh: the clay view has it too); the face in the dome's shadow, grey; the face turns only 0.3 rad.

## Broad-pawed hound (`hound`), phase 2b

Reference: `../hound/5d7b275f-a6fd-4e34-a0fe-7c6d4ebc850a-1.png` (approved). Home skin eclipse. All pictures in
`hound/`, captured 2026-10-30 on this branch, muted headless Chrome on this Mac (Apple M-series, Metal), High preset,
1280×720, 10:00, clear; looked at one by one. The same page, capture, strips, stills, walk audit and bench as the
shellback; added for this foe: the pounce in the walk audit and `gaze-shot.mjs` (the author's rule, every Tripo body
looks at the traveller).

![stills](hound/compare-stills.webp)

Strips: `hound-<variant>-<idle|walk|turn|attack|hurt|death>.webp` (the attack is the pounce), the row of three in
`hound-side-*.webp`; stills `hound[-<variant>]-still-<3q|front|flank|rear|clay|clay-front>.webp`; the gaze
`gaze-front.webp`; the page `trial-page.webp`. The current strips re-captured here match phase 1's
(`../baseline/hound-*.webp`, mean difference 1.3/255 idle, 1.1/255 walk: WebP noise). In the row's hurt strip only the
nearest body phases (the other two stand further from the traveller when the blow lands); each variant's own hurt strip
shows its phase into the pool and its rising again.

![the gaze](hound/gaze-front.webp)

### What each is

- **Direct** (`src/enemies/plans/broad-hound.js`): a long deep-chested teal-black body (a lofted trunk, the withers
  high, the waist tucked, broad haunches), a mauve saddle lying on the withers, four thick legs (one long capsule a
  segment, the kit's cylinders taken off) on big round paws with three toes, a long four-jointed tail, a lofted neck, a
  head with pointed ears, a cream capsule muzzle over a hinged jaw, two pale slit eyes in their own material and two
  cream ram's horns curling round beside the head. No mane. On the quadruped plan as today; its shadow form kept (the
  pool with the head and horns rising out of it, lying in wait, stepping behind you, phased). The pounce: crouch, head
  and horns down, then the coil (rump up, tail stiff and quivering, jaw open in a snarl, a shiver) and the leap; the
  bite opens the jaw; the rake lowers the horns to one side. Two skinned meshes (dark, light) and the eyes: 3 draws
  standing. The other skins keep their world's palette on the new body (ink, antler colour for horns and muzzle,
  smoke for the saddle) and their props (drips, a halo, gold glints, a tangle of wire horns, thicker bleached horns).
- **Tripo** (task `09f5de9e-79ff-4d16-ab12-be8784944eb4`, image to model, H3.1, texture v3.5 with `delight: true` =
  Remove Lighting, PBR off, 30k face target; 28,584 triangles, 2048² JPEG; then Tripo's free rig check, `quadruped`, and
  its quadruped rig, task `66154a67-3bdc-426a-88ff-f1dc00b93ee9`; both untouched in `../hound/tripo/`). Tripo's rig is
  not used as a skeleton (54 joints, the left hind leg twice over, stray tail branches, unnamed joints), but its
  **weights are**: `prepare.mjs` gathers each Tripo joint onto the game bone along the same stretch (body, neck, head,
  four tail joints, each leg's thigh, shin and foot) and the landmarks are the rig's own joints. Scaled to the direct
  body's 1.69 m (horns' top), a 1024² texture flattened to seven colours (median, k-means), COLOR_0, 12,000 triangles
  (meshoptimizer; the weights ride on the kept vertices). `model.js`: the kit's quadruped legs fitted to those joints,
  bend-plane leg bones (`SkinLegs`, the shellback's route), the head's bone the gaze's own node, so the head turns to
  the traveller, with two slit eyes of their own on it over the painted ones; the same shadow form, pounce, coil and
  rake as the direct (the jaw is fused: the bite and snarl nod the head). One skinned mesh and the eyes: 2 draws
  standing. Other skins: the coat's shades, the saddle and the cream recoloured from the skin's palette (vertex colours).
  The author picked it (2026-10-30); its four cleanups, below, are in every picture and number here.

### Comparison

| Measure | Current | Direct | Tripo (after the cleanups; before them in brackets) |
|---|---|---|---|
| Fidelity to the reference | a black stick-legged deer under a spiky violet mane, long antlers: not the reference | the reference's parts and colours (horns, cream muzzle, saddle, big paws, tail); legs and paws read as stacked capsules (boots more than paws), the muzzle a little like a bobbin, the tail a straight stick rising | the closest: the long body, muscled thick legs, big toed paws, the sickle tail, the saddle, the muzzle and the big cream ram's horns curling round behind the ears; the head a little narrow (Tripo's small horn crescents) |
| At combat distance (14 m, ink) | antlers and mane | a dark hound with pale horns and muzzle; reads a little toy-like | a dark hound on big paws, two big pale curls at its head; reads as the drawing |
| Baked light (clay, unlit) | – | none (procedural) | clean; the flattened colours keep the coat's five greens (a little shading in the muscle folds), no hatching printed |
| Drawn meshes · triangles (one body, one pass, standing) | 22 · 4,738 | 3 · 10,084 | 2 · 13,351 (12,224); the Garden of Spheres 4 (its glints and halo) |
| Materials · texture memory | 6 · 0 | 3 · 0 | 2 · 5.33 MB (1024² RGBA8 + mips) |
| Shipped bytes (raw · gzip) | `quadruped.js` 28.8 · 9.8 KB (with the lizard) | `broad-hound.js` 20.1 · 7.6 KB | `tripo-lod.glb` 637 · 369 KB + `model.js` 23.8 · 8.9 KB + landmarks 2.6 KB (source exports 1.23 + 1.41 MB) |
| Draws over the empty Arena, High, 1 · 6 | +18 · +93 | **+14 · +69** | **+15 · +83** (+14 · +69) |
| Triangles all passes, High, 1 · 6 | +7.3k · +22.8k | +10.0k · +37.2k | +6.3k · +37.8k (+9.6k · +37.6k) |
| Draws, Handheld, 1 · 6 | +14 · +68 | +10 · +50 | +8 · +48 (+10 · +50) |
| Triangles all passes, Handheld, 1 · 6 | +3.7k · +15.9k | +5.3k · +25.2k | +2.3k · +25.6k (+7.0k · +26.2k) |
| CPU ms, High, 1 · 6 | +0.10 · +0.05 | +0.70 · +0.40 | +0.30 · +0.75 (+0.05 · +0.40) |
| CPU ms, Handheld, 1 · 6 | +0.13 · +0.47 | −0.03 · +0.32 | +0.05 · +0.10 (−0.03 · +0.27) |
| GPU ms | not separable from the empty Arena at this load (deltas of either sign up to 2.7 ms): no GPU claim | | |
| Walk (foot joints), full · half pace: slide m/m, worst | 0.007 · 0.006, 2 cm | 0.009 · 0.012, 2 cm | **0.004 · 0.012, 2 cm** (0.010 · 0.025, 3 cm) |
| Reach / lift (share of leg), cadence Hz, full pace | 0.28 / 0.20, 3.75 | 0.28 / 0.20, 5.0 | 0.24 / 0.20, **5.0** (0.25 / 0.20, 5.9) |
| Gait | diagonal pairs [0,3] [1,2] | the same; legs 0.85 m against 1.25 m, so quicker steps | the same; legs 0.94 m (0.77 m, the mesh's) |
| Pounce (node, standing, 60 fps): planted-foot slip, bracing steps, crouch dip, leap rise, head forward | 0, 4, 0.42 m, 1.03 m, 0.36 m | 0, 4, 0.33 m, 1.01 m, 0.41 m | 0, 4, 0.35 m, 1.01 m, 0.34 m (0, 4, 0.31 m, 1.00 m, 0.30 m) |
| Looks at the traveller (gaze.js, him 1–1.5 rad to its side) | head turns, yaw 0.55 (its reach) | head turns, yaw 0.55, the eyes ride on it (test both sides) | head turns, yaw 0.31–0.55, the eyes its own parts on the head's gaze bone (test both sides) |
| Deformation | rigid parts | rigid parts in two skins (no stretch) | Tripo's weights: normalised, bind round trip < 0.1 mm, a shin bent alone moves only its leg (tests); the shoulders and hams bend smoothly in the walk and leap; the left hind leg's two Tripo chains merged onto one bone |
| Hurt, death, lying body | phase into the ink pool; legs fold, ink puff | the same recipe and pool (the body hidden under it) | the same |
| Kept (both) | id `hound`, def and attacks (pounce with its coil cue, step behind, bite, rake below two thirds), windows, reach, `phase`, sounds (`quadruped`/`smoke`), death recipe, lying body, size floor, white contour on dark worlds, drips | ✓ | ✓ |
| Time (agent) | – | about 1.2 h (model 40 min, look fixes 30 min) | about 1.3 h (generation 1 min and rig 1 min wall; prepare and weight mapping 30 min; model 30 min; fixes 15 min); the cleanups about 1 h |
| Tripo credits | – | – | **55** (generation 30, rig check 0, quadruped rig 25); the cleanups none (no new generation) |

(Bench: 31 runs, two rounds reversed, load 12.6–35 (other agents' runs; waited over 25), `hound/bench.jsonl`; at the
bench's distance the hounds run as shadows part of the time (`phase`), so its triangles are less than a standing body's.
Walk and pounce: `motion-audit.mjs hound@eclipse`. The direct row re-benched after a fix: its skinned meshes hang on
the root and were drawn squashed under the pool while it was a shadow. The Tripo row after the cleanups:
20 runs of the empty Arena, current and Tripo, two rounds reversed, load 14.4–26, `hound/bench-cleanup.jsonl`; its
current row there +20 · +93 draws on High, +11 · +66 on Handheld (the first bench +18 · +93, +14 · +68): at the bench's distance how much of the time the hounds are pools varies run to run, so the six-body draws move by ±10 either way.)

### Recommendation

**Tripo.** Side by side the Tripo hound is the reference: its long muscled body, thick legs, big toed paws, sickle
tail and saddle are the drawing's, where the direct one has the right parts but reads as a toy of stacked capsules.
Tripo's own quadruped rig was worth its 25 credits for its weights (smooth shoulders and hams, which the direct's rigid
parts and the shellback's nearest-part weights do not give) but not for its skeleton, which is untidy; the game's bones
carry the weights. Costs are even: both draw +14 a body on High against today's +18 (six: +69 against +93) and
about +10k triangles over all passes; Tripo carries a 5.3 MB texture and 370 KB gzipped. Both look at the traveller.

Cleanups before it lands: larger horns (Tripo shrank them; scale the horn vertices about their root), the halo,
glints and drips props for the Garden of Spheres' and the Mangrove's skins, a little more leg (its 0.77 m legs step at
5.9 Hz at full chase), and its world skins checked in pictures (built and tested in node only). The direct body stays
as the fallback. **The author picked Tripo (2026-10-30); the cleanups are done (below).**

### The cleanups (the author's pick, 2026-10-30)

On the Tripo body only (then; it is the game's hound since, below). No new generation (0 credits).

1. **Big ram's horns, their own shapes.** Tripo drew the horns as thin crescents hugging the ears, too small to read as
   the reference's. Scaling them about a root would have stretched the ears they are sewn to, so `prepare.mjs` takes
   them off: the two cream pieces on the head (found by colour and connection, the muzzle and the eyes' slits kept),
   every vertex welded onto the nearest skull vertex round its root (no hole), the roots kept as landmarks. `model.js`
   sweeps the reference's horns from those roots (`hornPath`: up and back over the ear, round and down behind it, the
   tip turning forward; a smooth crescent, thick through its first third, about 0.3 m tall) into the **same skinned
   mesh** on the head's bone (the cream's colour and texel): no extra draw, they turn with its look, and each world
   has its own (the Mangrove's bleached thicker, the Market's a tangle of four wires, as the current hound's antlers).
   Taking Tripo's horns off also fixed the eyes: its eye finder had picked the pale texels at the horns' roots, so the
   slit eyes sat on the temples; they now sit over the painted slits under the brow.
2. **Its worlds' props, fitted to this body.** The Mangrove: eight ink drips hanging off the chin, the neck, the chest
   and the belly, each hung from the lowest downward-facing vertex of its part there and skinned on that vertex's own
   weights (no extra draw). The Garden of Spheres: six gold glints along each horn and the pearl-and-gold halo resting
   over the horns' crown, on the head's gaze bone (one draw each, as today's hound; the white contour off, as there).
3. **A little more leg (+0.20 m).** `prepare.mjs --legs 0.2`: every vertex rises 0.2 m less its share of each leg (that
   leg's weights) times how far down the leg it lies (0 at the hip, 1 at the ankle), so the paws stay as they were on
   the ground, the body rises and the thighs and shins stretch; the rig's joints the same. Legs 0.77 → 0.94 m (the
   direct's 0.85, today's 1.25); full chase **5.9 → 5.0 Hz**, the direct's (0.15 m gave 5.0 Hz too, with more slide);
   foot slide down (0.010 → 0.004 m/m full pace, 0.025 → 0.012 half, worst 2 cm); the pounce unchanged (no slip, four
   bracing steps, 0.35 m crouch, 1.01 m leap). Standing it is 1.93 m to the horns' top (1.69 before).
4. **Every world skin in pictures** (`hound/skins/`, `skins-shot.mjs`, the same Arena spot and light; today's hound
   beside it): eclipse (home: the reference's teal-black, cream horns and muzzle, mauve saddle), mangrove (ink-black,
   bleached horns, drips, lilac saddle), spheres (black, dark horns with gold glints, the halo, white eyes; drawn
   without the white contour, for its pale world), bazaar (black, brass wire horns and a brass muzzle, a dusky
   saddle). Each looked at; the fixes they called for: the Market's three thin wires read as a loose ring (now four,
   thicker, more tangled), the halo floated high above the head (now resting on the horns, smaller), and two of the
   Mangrove's neck drips hung in the air once the neck moved (each drop now rides on the weights of the vertex it hangs
   from).

![every world skin: today's hound, then the Tripo hound three-quarter, flank and head](hound/skins/skins.webp)

### In the game (2026-10-30)

The Tripo hound is the game's hound now, the **horned hound** (the same id, def, windows, sounds, gaze, shadow form,
death and lying body): `src/enemies/plans/hound-tripo.js` (this folder's `model.js` re-exports its builder for the trial
page), its asset `public/enemies/hound/body.glb` made from `tripo-lod.glb` by `scripts/tripo/ship-hound.mjs` (texture 1024² →
512² nearest, which still reads: its seven flat colours stay flat; the horns' and drips' texels moved to the middle of
a patch of their colour, as at 512² the cream texel sat within a texel of the saddle's mauve and the horns came out
grey; the landmarks in the mesh's extras). It loads as the shellback's does (main.js and the gallery fetch it before the foes are
made, the engines and Node read it at once); the direct body (`broad-hound.js`) is its fallback. The trial page's `current` is now this body. See
docs/systems/foes.md, "The horned hound in the game". What the trial left open, done there:
- Every world skin pictured in its own world (`world-shot.mjs`: the Eclipse, the Mangrove, the Garden of Spheres and
  the Signal Market as you land, 10:00; the changelog's v2.38 pairs). The Garden of Spheres' muzzle was the horns' black:
  now pale (`muzzle` in its palette; the horns and muzzle are told apart, the horns being the vertices added after the
  mesh's).
- The shadow form's rising head wears the new swept horns (0.85 of the body's, a world's own; the home skin's in the
  texture's cream). The direct fallback's wire horns there were lifted 5 cm (a running Market hound's pool stood
  0.29 m, under the 0.3 m every flat foe shows, tests/foe-presence.test.js).
- The combat review's `defend.mjs` and `dodge.mjs` and the sound QC's foes, and Unity (vertex colours; `-fight hounds`).
- The bench in real worlds and the Arena's arrivals: the changelog's numbers (`hound/bench-worlds.jsonl`: six solid
  hounds against the empty world, the Eclipse and the Signal Market, High and Handheld, before at 192711a63, two rounds
  alternated, load 19–35; draws 358 → 28 and 432 → 28 on High, 231 → 21 and 280 → 23 on Handheld, triangles about three
  times as many, CPU and GPU ms not separable at this load; `hound/arrivals.jsonl`: no program compiled and no frame
  over 33.3 ms as a hound of any look arrives in the Arena, as before).

## Dune mummer (`mummer` on the trial page; its own enemy `dunemummer` later), phase 2 and its fixes

The author picked **Tripo** for the dune mummer (2026-10-30), with its fixes first: the olive shade merged into one
flat sage, broader mittens ([the fixes](#the-tripo-mummers-fixes)). Then a change of plan: **today's mummer (the
pot-headed sack) stays in the game as it is, and the dune mummer becomes a new, separate enemy** with its own
archetype id, `dunemummer`, not the mummer's replacement. It stays on the mummer's humanoid clip rig, and its entry is
keyed apart from the mummer's already (`mummer-tripo/archetype.js` `duneMummerEntry()`: its own id, a copy of the
mummer's def with its attacks, windows, mask and disarm, its two skins, its weapons per spawn, its sound keys, no
places yet), ready to be registered as `ARCHETYPES.dunemummer` / `SKINS.dunemummer` when the author lands it; nothing
in `src/` names it, no world's roster has it, and the mummer's id, def and skins are untouched (test). On the trial
page it still stands in for `mummer` (`foe=mummer`, `TRIAL_BUILDERS`, empty in the game). Every Tripo picture and
number in this section is of the fixed body; phase 2's are in git (`fcdac987d`) and in the before/after pictures.

Reference: `../keep-mummer/ad94a6b0-55ba-461e-9577-d745036565ae-1.png` (approved), measured off the author's T-pose
picks (`../keep-mummer/tpose/sheet-1.jpg` front and back, `sheet-2.jpg` the side; their narrower hands not taken: the
approved broad mittens are kept). Home skin desert. All pictures in `mummer/`, captured 2026-10-30 on this branch,
muted headless Chrome on this Mac (Apple M-series, Metal), High preset, 1280×720, 10:00, clear; looked at one by one.
The same page, scripts, strips and stills as the shellback (`--variant current|direct|tripo|side --extra`); the
current and direct strips are phase 2's (those bodies did not change), the Tripo and side-by-side ones re-shot.

![stills](mummer/compare-stills.webp)

Strips: `mummer-<variant>-<idle|walk|turn|attack|hurt|death>.webp`, the row of three on one clock in
`mummer-side-*.webp`; stills `mummer[-<variant>]-still-<3q|front|flank|rear|clay|clay-front>.webp`; the look in
`mummer-gaze.webp` (the traveller off to either side, every head turned to him); the page in `trial-page.webp`. Each
spawn picks its weapon (club, spear or bow) as the game does, so the single-variant captures may carry different ones.

![the look](mummer/mummer-gaze.webp)

### What each is

- **Direct** (`src/enemies/plans/dune-mummer.js`): one sage gourd that is head and body (its rings measured off the
  T-pose sheets: 0.58 m wide, 0.45 deep, widest low; 1.2 m at size 1, 1.8 m in the game), a cream oval mask high on its
  front with two black slits (its eyes: they take the wind-up's colour; small and pale on the black face when the mask
  is off), the salmon patch, short sage sleeves, big rust gauntlets with a dark wrist band, broad mittens (one block of
  fingers on the Fist's pivots: it closes round the haft), short legs in tall rust boots with sand toe caps. On the
  humanoid clip rig as today (`humanoidSkeleton`, `HumanoidDriver`, `MUMMER_MOVES`, `MUMMER_HOLD`, Wielder), its
  proportions Tripo's joint places on the same body. The gourd is one skinned mesh, the body's weight below 0.76 m and
  the head's over 0.86 m, so its top turns with the look; every other part (with the weapons, the dropped ones and the
  flown mask) one rigidly skinned mesh with vertex tints; the eyes their own: 3 meshes. The mummer's life (the weapon in
  hand, the disarm, the mask knocked flying, the rock lob, the eyes) is `mummerLife`, shared by both bodies. The
  bleached skin (glassdunes) takes its colours from its own palette (cream gourd, sky patch, saffron gloves).
- **Tripo** (multiview task `126e68e7-5536-4dc8-ac59-bad4f20e2977`: front and back cut from sheet-1, the left side
  from sheet-2, each on a square of its sheet's cream at the same body height, `../keep-mummer/tripo/view-*.png` as
  sent; H3.1, `texture_version` v3.5 with `delight: true` = Remove Lighting, PBR off, 30k face target; 28,270
  triangles, 2048² JPEG. Rig check (free): riggable, biped. Rig task `34054a6c-90f3-417f-a3f8-d0b2bb7b0d09`: Tripo's
  biped rig, Mixamo names, 23 joints, no fingers. Untouched in `../keep-mummer/tripo/model.glb` and `rigged.glb`, the
  record in `task.json`.) `mummer-tripo/prepare.mjs`: the game's frame, 1.2 m, 12,000 triangles (meshoptimizer;
  Tripo's joints and weights ride every kept vertex), the mittens widened, a 1024² texture repainted by part in the
  reference's eight flat colours, COLOR_0 from it, the joints' bind places and the mittens' centres (`skeleton.json`). `mummer-tripo/model.js` **poses the Tripo skeleton directly**: the humanoid rig's
  joints stood where Tripo's rig put its joints and the mesh skinned to them with Tripo's own weights (23 joints folded
  onto 14 bones: the hips, three spine bones and clavicles onto the torso, the neck and head onto the head's look, the
  toes onto the feet), bound in the T-pose (each limb's −y along Tripo's bone), then let down to the rig's rest. The
  clips pose those very bones: no hidden skeleton copied over (#768's adapter). The mask's triangles are cut out and
  rebuilt flat cream on their own pivot (it flies off), an ink oval in the hole (the black face), two slit eyes filling
  the recesses Tripo cut for them. The mittens are one piece: the haft goes through each mitten's measured centre
  (Wielder `at`). Other skins: each part recoloured from the skin's palette (as the direct body's roles).

### The Tripo mummer's fixes

![phase 2 against fixed: front, flank, three-quarter, rear, clay](mummer/tripo-fixes.webp)

1. **The olive shade: one flat sage.** Phase 2 snapped Tripo's texture to its own eight k-means colours: two greens
   (sage `#728c77` and the olive shade `#5b6855`), a dark brown shade at the borders, a tan shared by the chest patch's
   rim and the toe caps, a grey-sand rim round the mask. `prepare.mjs` now repaints the texture by part, as the
   shellback's did: each cluster given its part by name, then by place (the triangle's limb from its weights, the
   texel's point on the mesh): one flat colour a part, the reference's own (the direct body's home skin: sage
   `#879d88`, cream mask `#f3e4ad`, salmon patch `#c9806a`, rust gauntlets `#c46c3c` and boots `#bd6438`, sand toe
   caps `#dfb47c`, the dark wrist bands `#2a2420`, the slits' ink). The olive and the brown fold into the sage and the
   rust; the patch is split from the toe caps (its middle had been the gauntlets' rust); the thin painted folds at the
   sleeves' hems and the boots' tops are painted out (the game draws its lines), the wrist bands kept; the mask's rim
   made cream. The texels between the UV islands are filled from their nearest island (no other colour at the smaller
   mips). Test: COLOR_0 holds exactly the eight, none of the k-means' shades left. What the gourd still shows of a
   darker side in the stills is the game's own light and shadow: it is in the clay view, and on the direct body too.
2. **The mittens: broad.** Tripo read the T-pose sheets' narrower hands: a mitten tapering from 13 × 13 cm at the wrist
   to a point 15 cm out. Each vertex on a hand is pushed out from the mitten's axis by its hand weight (`WIDEN`: thicker
   toward the tip, ×1.15 at the wrist to ×1.75 at the end; broader, ×1.12 to ×1.37; 10 % longer), the wrist band,
   shared with the forearm, moving least; normals under the same stretch; the mittens' centres measured after. The
   mitten is now 15 × 16 cm across, blunt, about the gauntlet's breadth as drawn. The club stays in it: the haft through
   the mitten's centre (Wielder `at`) through idle, walk, run, every club attack and the hurt, sampled every 0.1 s, at
   worst 1.5 cm off the centre of a 9.8 cm mitten (test: under 0.35 of its radius); the spear and bow tests unchanged.
3. **The slits (from the stills).** Tripo cut each slit as a recess 1.6 cm deep with the ink at its bottom. Phase 2
   left a few of the recess's triangles on the body and put the slit eyes on the mask's box front, so close up they
   floated off its curved face beside dark holes (`mummer-close.webp`, the mask). Now every triangle touching a slit is
   the mask's, and each eye is a plug filling its recess from the bottom out to the surface (4.4 × 2.2 cm).
4. **Its own enemy, keyed apart** (the author's change of plan): `archetype.js`, above.

Unchanged: the gaze (±0.7 rad on the head bone; ±0.27 when he stands straight ahead of it), the mask knocked flying and
the black face, the weapons per spawn and the disarm, the clips and holds, the ragdoll, the walk (the motion audit's
numbers are phase 2's to the third decimal).

![close: front, three-quarter, back, the mask, both mittens, the whack's wind and strike, clay; phase 2 over fixed](mummer/mummer-close.webp)

`mummer-tripo/closeups.mjs` (the close rows), `prepare.mjs --no-repaint --no-widen` (writes phase 2's asset byte for
byte).

### Comparison

| Measure | Current | Direct | Tripo (after its fixes) |
|---|---|---|---|
| Fidelity to the reference | coffee-pot mask on an indigo patched sack, stick legs, three-fingered ink hands: not the reference | the reference's parts and colours: gourd, oval mask and slits, patch, sleeves, gauntlets, mittens, boots and toe caps; a smooth lathe, a little narrow at the top, the mask flat | the closest silhouette: the softer gourd, the mask set into it, plumper gauntlets and boots, broad blunt mittens; the reference's flat colours, the salmon patch; the mask a little narrow, set deep in the hood |
| At combat distance (14 m, ink) | reads as the pot and the sack | reads: sage gourd, cream mask, rust gloves and boots | reads the same: sage gourd, cream mask, salmon patch, rust gloves and boots |
| Baked light (clay, unlit) | – | none (procedural; the gourd's soft mottle is its surface paint) | clean geometry; none in the colours (eight flat ones by part; phase 2's olive band and brown shade gone); the darker side in the stills is the game's light, in the clay view and on the direct body too |
| The look (head on the traveller) | the pot turns, reach 0.9 rad | the head joint turns (reach 0.7), the mask, slits and the gourd's top with it | the same, on Tripo's neck and head weights (the look node is the head bone) |
| Drawn meshes · triangles (one body, one pass) | 9 · 9,738 | 3 · 11,672 | 3 · 15,517 (body 12,000; the mask, its slits and the weapons) |
| Materials · texture memory | 8 · 0 | 3 · 0 | 3 · 5.33 MB (1024² RGBA8 + mips) |
| Shipped bytes (raw · gzip) | `mummer.js` 36.5 · 11.7 KB | `dune-mummer.js` 22.4 · 8.5 KB (+ mummer.js's weapons and holds) | `tripo-lod.glb` 637 · 344 KB (its PNG 12 KB) + `model.js` 17.3 · 6.7 KB + skeleton 3.5 KB (source export 1.4 MB) |
| Draws over the empty Arena, High, 1 · 6 | +27 · +162 | **+9 · +54** | **+9 · +54** (one round-1 single run drew +15, a passing effect; round 2 +9) |
| Triangles all passes, High, 1 · 6 | +29.2k · +175.2k | +35.7k · +210.2k | +49.5k · +279.3k (round 2's single +46.6k; phase 2's +324.8k for six held one outlier run, its other round +279.2k) |
| Draws, Handheld, 1 · 6 | +20 · +108 | +6 · +36 | +6 · +36 |
| Triangles all passes, Handheld, 1 · 6 | +19.6k · +115.0k | +21.7k · +138.4k | +29.5k · +184.8k |
| CPU ms, High, 1 · 6 | +0.10 · +0.75 | −0.15 · +1.15 | +0.25 · +1.30 |
| CPU ms, Handheld, 1 · 6 | +0.30 · +1.00 | +0.40 · +0.70 | +0.30 · +0.80 |
| GPU ms | not separable from the empty Arena at this load (deltas of either sign up to 4.2 ms): no GPU claim | | |
| Walk audit (foe-slide on the clips): slide m/m · worst m, walk / run / strafe / turn (per rad) / knock | 0·0 / 0·0 / 0.054·0.09 / 0.035·0.16 / 0.063·0.34 | 0·0 / 0·0 / 0.040·0.07 / 0.041·0.12 / 0.076·0.41 | 0.002·0.003 / 0.002·0.006 / 0.047·0.11 / 0.032·0.10 / 0.017·0.06 |
| Gait, full · half pace: steps/s; lift (share of the leg) | 3.0 · 1.75; 0.42 · 0.56 | 3.25 · 2.25; 0.53 · 0.55 | 3.25 · 2.0; 0.53 · 0.56 |
| Deformation | rigid parts | rigid parts; the gourd's top twists with the look over 0.76–0.86 m | weights normalised (test); the mittens hang at rest; a knee bent alone moves only its leg (Tripo's crotch blend carries a few vertices across the middle, under 5 mm) |
| Whack (wind, strike, recover) | both arms up, the club behind the pot, down | the same clip; the club in the closed mitten throughout | the same clip; the club through the broad mitten's centre throughout, at worst 1.5 cm off it (test; no fingers to close) |
| Hurt, death, lying body | flinch; ragdoll, then the puff | the same (the ragdoll on the rig's joints) | the same |
| Kept (both) | id `mummer`, skins, def and attacks (whack, jab, volley, rock), windows, weapons per spawn and the disarm, the mask (knocked off: it runs, swings blind), sounds (`junk` / `mummer`), size ×1.5 (#741), ragdoll | ✓ | ✓ |
| Time (agent) | – | about 1.2 h (model 50 min; fixes 20 min: the gourd's winding, the eyes) | about 1.5 h (generation and rig 4 min wall; prepare 20 min; the skin on the rig 40 min; mask and slits 20 min), then the fixes about 1.3 h (the repaint and the mittens 30 min, the slits 20 min, re-shoot and review 30 min) |
| Tripo credits | – | – | **55** (generation 30, rig check 0, rig 25; balance 1,710 → 1,655); the fixes no new generation, 0 credits |

(Bench, re-run after the fixes, all three variants: 28 runs, two rounds reversed, load 13.1–35.2 (other agents' runs;
the bench waits only for under 25 before each run), `mummer/bench.jsonl`; the CPU deltas are within the run-to-run
noise at this load (phase 2's runs gave other numbers of the same size). Walk: `motion-audit.mjs mummer@desert`,
which runs `mummer-tripo/motion.mjs`: the humanoid foes' foot-slide measure (#749) with the clip library loaded; re-run
after the fixes, the same numbers. All three walk in the clip's crouched scuttle;
the gourds keep 55 % of the clip's spine lean off in their loops, `GOURD_UP`.)

### Recommendation

**Tripo for the look by a small margin; direct is close and cheaper.** Both cut the mummer's draws by two thirds (+9
against +27 a body on High; six: +54 against +162). The Tripo gourd is softer and its gauntlets and boots plumper,
nearer the drawing; the direct one has every part right and reads as cleanly at 14 m, with a flatter mask, mittens
that close and no texture (0 against 5.3 MB; 8.5 KB against 352 KB gzipped). Posing Tripo's own skeleton directly
worked: the same clips, holds, look, mask and ragdoll with no adapter and no extra CPU; the cost is a third more
triangles, the texture, and mittens that cannot close.

My recommendation: **take the Tripo mummer**, with two cleanups: snap the olive shade into the sage (one body colour:
the game shades it) and widen the mittens toward the approved broad ones (scale the hand-weighted vertices). If the
author would rather not carry a texture for a foe this common, the direct one lands as it is. Both are web only.

**The author's call (2026-10-30): Tripo, with those fixes (done, above), as a new enemy `dunemummer` beside today's
mummer.** Landing it means registering `duneMummerEntry()` as its own archetype and skins, its body from the trial
folder into `src/`, then its places in the worlds; the mummer stays as it is.

### Not done (mummer)

- Registering `dunemummer` (its archetype, skins, the asset moved into the game, a place in a world's roster), and its
  own changelog line with before/after pictures when it lands: the author's next step.
- The mask sits a little narrow and deep in Tripo's hood next to the drawing's broad flat oval (Tripo's reading of the
  sheets); the eye plugs are the eye material's dark slate, as on the direct body, rather than pure black.

- The combat review's `defend.mjs` / `dodge.mjs` and the sound QC renders on the new bodies (the attacks, windows and
  sound keys are the mummer's own, unchanged; the poses that carry the contact were checked in the strips and tests).
- Unity: neither body is wired there; the trial is web only. The Tripo asset carries COLOR_0 for the engines' VMs.
- The headshot point is the look node (the head joint, 1.29 m), as for every foe on the rig; the slits sit about
  0.25 m over it.

## Wood cutter (`woodcutter`, in the brute's slot), phase 2b and its fixes

**Its own enemy** (the author, 2026-10-30): the wood cutter is a new archetype, `woodcutter`, not the brute's replacement.
Today's 4.7 m brute stays in the game as it is (its id, def and skins untouched). The wood cutter is built on the brute's
rig family and carries its own key: `WOODCUTTER_ID` and `woodcutterArchetype(ARCHETYPES.brute)` in
`src/enemies/plans/woodcutter.js` (its own id and name, the brute's sounds and skins for now, `woodcutterDef`), and both
bodies report `archetype: 'woodcutter'`, so it can be registered on its own (archetypes.js, skins.js, plans/index.js, its
sounds and placement) when the author places it. It is in no world's roster yet; the trial page stands it in the
brute's slot (`foe=brute`) only.

The author picked **Tripo** for it (2026-10-30), with its fixes first: the reference's flat colours, a real toothed saw
disc that spins, the tool separate from the arm so each world keeps its own, the cut seams closed
([the fixes](#the-tripo-fixes-wood-cutter)). Every Tripo picture and number in this section is of the fixed body,
re-shot after them; phase 2b's are in the history (`b5b05d835`) and in the before/after picture.

Reference: `../keep-brute/a1860f49-ecc5-4922-91f6-94b031e5e9a7-0.png` (approved). Home skin perdide2 (Lorn II). The
author's size: **2.2–2.6 m** (today's brute 4.72 m); both bodies are built to 2.4 m, over the traveller (#741's floor).
All pictures in `woodcutter/`, captured 2026-10-30 on this branch, muted headless Chrome on this Mac (Apple M-series,
Metal), High preset, 1280×720, 10:00, clear; looked at one by one.

![stills](woodcutter/compare-stills.webp)

Strips (eight frames, game time in the labels): `brute-<variant>-<idle|walk|turn|attack|hurt|death>.webp`, the row of
three on one clock in `brute-side-*.webp`; stills `brute[-<variant>]-still-<3q|front|flank|rear|clay|clay-front>.webp`
(current: `brute-still-*`, re-captured with `--extra`); the gaze check `gaze-direct.webp`, `gaze-tripo.webp`,
`gaze-side.webp` (`gaze-one.mjs`: the traveller off to its right, its head turned to him); three other worlds' skins in
the row, `brute-side-skin-glassdunes.webp` (a clamp hand), `brute-side-skin-moonfoundry.webp` (the ladle),
`brute-side-skin-edena.webp` (the shears); the trial page `trial-page.webp`; phase 2b against fixed, `tripo-fixes.webp`.
The Tripo strips, stills, row, skins and gaze pictures re-captured after the fixes; the direct and current ones are
phase 2b's (unchanged bodies).

![gaze](woodcutter/gaze-direct.webp)

### What each is

- **Direct** (`src/enemies/plans/woodcutter.js`): a sage barrel of a torso with a seam across the chest and an ochre
  louvred vent on the belly, a pale dome head with one black visor slit sunk in its top, two great round pauldrons, a
  ball shoulder, upper arm, banded elbow and thick gauntlet forearm each side, a rust-red twelve-tooth saw disc on a
  clamp at the right wrist (it spins: slow idling, whining up through a wind-up, fast in a blow), an open three-fingered
  dark-green clamp on the left, short thick legs with a knee band and bolt into wide rounded clogs. The hull, head and
  limbs one skinned mesh on the kit's joints (`skinBy`, colours as vertex tints), the ochre fittings another, the disc,
  visor, vent glow and the three plates their own: 8 drawn meshes. The home skin wears the reference's colours (its moss
  and roots dropped: the reference has none); the other four skins keep their world's palette and tools (Viridel's
  shears, the Moon Foundry's ladle, the Waterfall's turbine, the Glass Dunes' second glow).
- **Tripo** (task `32ba0f6c-65ed-4cb9-8685-bdfb19b47047`, image to model, H3.1, texture v3.5 with `delight: true` =
  Remove Lighting, PBR off, 30k face target; 29,103 triangles, 2048² JPEG; untouched in `../keep-brute/tripo/model.glb`).
  `woodcutter-tripo/prepare.mjs`: turned into the game's frame, scaled to 2.4 m and centred between its feet (Tripo
  centres the box, saw and all), a 1024² texture flattened to **five** colours (k-means, then shades nearer than 40 RGB
  merged: the baked shading on the hull's greens goes), COLOR_0 sampled from it, 12,000 triangles, landmarks measured
  from the mesh's vertex slices. `model.js`: **a machine rig, not a skin**: every triangle whole in one of 15 rigid parts
  (hull, head, each arm's upper arm, forearm and hand, the saw's disc, each leg's thigh, shin and boot), each vertex
  weighted 1 to its part's joint; the arms on the direct body's pivots bound in Tripo's pose (its saw forearm held
  forward), the legs on the kit's brute plan through `SkinLegs` bend-plane bones, the head on its own pivot that the
  gaze turns, the disc on a frame along its own normal (it spins). The pauldrons cut out as the armour that falls (a dark
  ball joint under each), the breastplate copied off the chest; a slit over the painted visor and a glow over the vent.
  Other skins: the mesh's colour roles recoloured from the skin's palette; its saw is fused in the mesh, so every skin
  keeps the saw (no shears or ladle). *Phase 2b's; after the fixes (below): 10,834 triangles in 15 parts cut by
  geometry, Tripo's saw hand dropped and each world's tool built on the wrist, the texture repainted by part, the cuts
  blended.*
- **Both** share `woodcutterMotion` (the poses, the ground contact, the attacks) and `woodcutterDef` (below), so the
  comparison is of bodies only.

### The Tripo fixes (wood cutter)

![phase 2b against fixed: three-quarter, front, clay front, the saw and the head close](woodcutter/tripo-fixes.webp)

No new generation (no credits): the same Tripo export, `prepare.mjs` and `model.js` reworked.

1. **Colour: the reference's flat colours, by part.** Tripo's texture is darker and greener than the reference (its
   values low: Remove Lighting), and phase 2b kept its k-means colours (the hull `#55795e`, the knee and elbow bands
   lumped into the rust, the vent's ochre lost). Now each texel's *role* is read from its colour (sage, dark, olive,
   rust, ochre, cream; a 7 × 7 majority over the creases' specks) and painted in the reference's own colour for its
   part (the direct body's home skin, `WOODCUTTER_OWN`: sage `#7f9f88`, pale head `#e5cfbb`, ochre vent `#c8922f`,
   olive bands `#5c5c37`, dark joints `#2f4b3b`, visor `#18161c`): the head all cream but its visor's groove, nothing
   cream on the hull (the collar's inside dark), the ochre only round the vent, a crease's shade (not black) the
   surface it is on (the ink draws the creases). The texels between the islands are filled from the nearest island
   (breadth first), so no other colour bleeds in at the smaller mips; vertex colours from the repainted texture.
2. **The saw: the reference's toothed rust disc, its own part.** Tripo's saw hand (the hub, clamp and disc, its teeth
   lost to the decimation: the brown "mitten") is cut off at the wrist and dropped (1,161 triangles). The model builds
   the tool on the wrist: an olive cuff, a rust clamp and a bracket out to the hub, the direct body's twelve-tooth disc
   (`sawDisc`, 0.38 m) and a brass cap. The disc is on its own joint at the hub, its normal Tripo's turned 0.6 rad
   about the forearm toward its front (Tripo's faced straight out, edge on from the front; the reference shows its face
   to a three-quarter view), its hub 0.24 m past the wrist (the reference holds it at the forearm's end). It spins as
   the direct one: slow idling, whining up through a wind-up, fast in a blow. The slam's lowest point is now the disc's
   teeth on the ground in the ring (the test).
3. **The tool apart from the arm: each world its own.** With Tripo's hand gone, the wrist takes the skin's tool:
   Lorn II the saw; Viridel the shears; elsewhere a clamp hand (the left one's, Tripo's own, mirrored onto the right
   wrist), with the Moon Foundry's ladle in it; the Waterfall's turbine on its chest, the Glass Dunes' furnace glow
   (`WOODCUTTER_TOOLS`, the direct body's tools, now shared). The tools and the joints' balls are in the same skinned
   mesh (their colours a swatch each in the flat texture at home, `landmarks.swatches`; vertex colours elsewhere), so
   the tool costs no draw; only the turbine and the melt are meshes of their own, in their skins.
4. **The seams.** Phase 2b cut at run time by the nearest capsule: a ragged line through the colours, its saw-tooth
   edges opening dark as the legs and arms moved, and the head's cut ragged through its collar. Now (prepare.mjs, by
   geometry): the head is the dome itself, grown from its crown over the surface on the dome's fitted sphere (centre
   y 2.08 m, r 0.31 m) that faces out of it, so the cut runs in the crease against the collar; the head turns about the
   sphere's centre, which opens no gap; each arm and leg is cut across by a plane at each joint (elbows, the clamp's
   wrist, hips, knees, boot tops), and across each cut its vertices are **blended** between the two bones over 9 cm
   either side (the same weights for the corners either part has there), so a bent joint stays closed (the test: an
   elbow bent 0.8 rad, the widest seam < 0.1 mm); a dark ball inside each joint for what a strong bend shows. As it
   dies the blends let go (each vertex all its own part's) and it comes apart into clean parts, not stretched ones.
   The decimation is now by geometry alone: weighting the colour borders (phase 2b) kept the creases' noise as
   saw-toothed folds that shaded dark at the knees and boots.
5. **Within reason, else.** The visor's slit sits in the dome's own groove (measured from its painted dark), not over
   it; the dark ball at the neck is small enough not to show through the dome.

Still off: a few dark creases of Tripo's own on the boots and under the barrel (in its geometry: they show in clay);
the clamp hand's mirrored copy has the left hand's pose; the pauldrons' open edges still show a dark line from close
by; the disc's face shows to the three-quarter view, but from straight in front it is still seen at a slant.

### Reach and timing (`woodcutterDef`, laid over the brute's def as the body is built: `Foes.add` `trialDef`)

| | brute (4.7 m) | wood cutter (2.4 m) |
|---|---|---|
| body radius · chest height | 1.15 · 2.4 m | 0.7 · 1.45 m |
| slam: ring radius · centre ahead · starts from | 2.1 · 1.9 · ≤ 3.6 m | 1.45 · 1.5 · ≤ 2.7 m |
| slam quake (the ring you jump) | speed 7, reach 8, 0.5 damage | the same |
| sweep: cone range · starts from | 3.6 · ≤ 3.4 m (angle 1.3) | 2.5 · ≤ 2.4 m (the same angle) |
| hurl: landing mark radius (range 4.5–12 m) | 1.7 m | 1.4 m (a smaller slab) |
| guard: comes up within | 4.5 m | 3.2 m |
| wind, strike, contact, recover, cool, damage, knock, parry and evade answers, hp, poise, stout, speed 1.7 | – | **unchanged** |

Fair by construction: every window you read and answer is the brute's (the parry and evade contract, the guard's hold
and three blocks); only where it stands and what its arms reach is nearer, and each hit shape sits where the tool lands.
Its arms end at its knees, so the slam is a deep bend at the hips and a drop onto its knees, the saw's edge and the clamp
meeting the ground 1.4–1.6 m ahead, inside the ring centred 1.5 m ahead (`tests/woodcutter-trial.test.js` checks both
bodies: the lowest point within 3 cm of the ground, inside the ring). The quake is unchanged, so "jump the quake" works
at the same moment.

### Comparison

| Measure | Current | Direct | Tripo |
|---|---|---|---|
| Fidelity to the reference | a 4.7 m cracked ivory egg with brass, tar and moss: not the reference | the reference's parts and colours: barrel, vent, dome head and visor, pauldrons, saw and clamp, clogs; pauldrons too round, the head a little small, faceted kit limbs | **after the fixes:** the closest silhouette and proportions (head size, pauldrons sloping over the arms, boots) in the reference's sage, pale head, ochre vent and a toothed rust disc on a clamp; a few dark creases of Tripo's own on the boots (phase 2b: a darker green, a brown "mitten" of a saw, dark cut seams) |
| At combat distance (14–19 m, ink) | reads as a giant | reads: sage robot, red saw, pale head | reads: sage robot, red toothed saw, pale head |
| Baked light (clay, unlit) | – | none (procedural) | clean geometry; the flat colours carry no shading (repainted by part) |
| Size (w × h × d, idle) | 4.39 × 4.72 × 3.47 m | 2.22 × 2.39 × 1.79 m | 2.44 × 2.40 × 1.38 m |
| Drawn meshes · triangles (one body, one pass) | 11 (3 skinned) · 16,306 | 8 (2 skinned) · 6,920 | 7 (1 skinned) · 12,918 (Tripo's 10,834 with its saw hand dropped; the tool, the joints' balls, the breastplate's copy and the visor the model's; the pictures were shot at 14,070, with finer balls inside the joints) |
| Materials · texture memory | 8 · 0 | 6 · 0 | 5 · 5.33 MB (1024² RGBA8 + mips) |
| Shipped bytes (raw · gzip) | `brute.js` 23.1 · 8.4 KB | `woodcutter.js` 29.2 · 10.8 KB | `tripo-lod.glb` 417 · 241 KB + `model.js` 26.4 · 9.5 KB + landmarks 4.4 · 1.3 KB (source export 1.35 MB) |
| Draws over the empty Arena, High, 1 · 6 | +35 · +195 | +24 · +144 | **+21 · +126** (the same as phase 2b: the tool is in the skin) |
| Triangles all passes, High, 1 · 6 | +54.9k · +297.3k | **+21.5k · +124.7k** | +38.8k · +233.1k |
| Draws, Handheld, 1 · 6 | +23 · +128 | +16 · +96 | **+14 · +84** |
| Triangles all passes, Handheld, 1 · 6 | +34.7k · +196.8k | **+12.3k · +83.6k** | +24.2k · +153.1k |
| CPU ms, High, 1 · 6 | +0.30 · +1.35 | +0.30 · +1.05 | +0.70 · +1.10 |
| CPU ms, Handheld, 1 · 6 | +0.20 · +0.95 | +0.20 · +0.70 | +0.50 · +1.10 |
| GPU ms | not separable from the empty Arena at this load (deltas of either sign up to 2.5 ms, as in phase 1): no GPU claim | | |
| Walk (foot joints), full · half pace: slide m/m, worst | 0.001 · 0.003, 2 cm | 0 · 0, 0 | 0.004 · 0.007, 2 cm |
| Reach / lift (share of leg), cadence Hz, full pace | 0.19 / 0.14, 1.25 | 0.17 / 0.10, 1.75 | 0.12 / 0.12, 1.88 |
| Gait | alternate, its legs 1.15 m | the same plan scaled (`WOODCUTTER_PLAN`), legs 0.77 m | the same, legs 0.66 m (the mesh's) |
| Deformation | rigid parts in a skin | rigid parts in a skin | rigid parts cut by geometry, blended 9 cm across each limb's cut (bind round trip < 0.1 mm; an elbow bent alone moves only its forearm, hand and the blend; its widest seam < 0.1 mm: tests); the head turns about its dome's centre (no gap at the collar) |
| Gaze (#508; the author's ask) | its torso twists (no head) | **the head turns** to the traveller, the torso twists a fifth of it | **the head is its own part and turns** to the traveller |
| Gaze measured (traveller at a bearing of −0.75 rad) | yaw −0.70 | yaw −0.70 | yaw −0.70 (the gaze's limit) |
| Slam | both fists up, down onto the ground | both arms up, the saw spinning up; a deep bend, saw edge and clamp on the ground in the ring | the same motion; the tools on the ground in the ring |
| Hurt, death | stout (no stagger, on into its next move); sags and comes apart | the same; comes apart into its parts | the same; rigid again as it dies, it comes apart into its 15 parts (a dark ball in each joint) |
| Kept (both) | id `brute`, archetype, skins, attacks and windows, guard, stout, plates (2 pauldrons + breastplate), weak point (now the vent), sounds (`iron` / `brute`), breaks apart, calm (slumped, the head hanging), size floor | ✓ (keyed `woodcutter`) | ✓ (keyed `woodcutter`; each world's own tool) |
| Time (agent) | – | about 1 h (model 30 min, contact and pose fixes 30 min) | about 1.3 h, then the fixes about 1.5 h (colour 20 min, cut and seams 40 min, tools 15 min, pictures and bench 15 min) |
| Tripo credits | – | – | **30** (task record; the fixes none: no new generation; no rig credits: the rig is the game's) |

(Bench, re-run after the fixes for all three: 28 runs, two rounds reversed, load 11.6–34.7 (runs waited while it was over 25), High and Handheld on this Mac, `woodcutter/bench.jsonl`; walk: `motion-audit.mjs brute@perdide2`. GPU ms are again not separable from the empty Arena at this load: deltas of either sign up to 4.4 ms. Direct's +24 draws against phase 2b's +27 is the run's spread, its body unchanged.)

### Recommendation

**Direct for the wood cutter.** Unlike the shellback, this is the case the direct route is good at: the reference is
broad simple masses (a barrel, a dome, two shells, cylinders, a disc), and the direct body draws them in the reference's
own colours with the fewest triangles (a third fewer than Tripo's over all passes, under half of today's), no texture,
the fewest bytes, and each world's own tool; it costs six draws a body more than Tripo (+27 against +21 on High, its
fittings, disc and visor drawn apart: merging the ochre fittings and the visor into the skin would close most of it). The Tripo body
has the better proportions (the head and pauldrons especially) and its rigid parts cut cleanly at the joints, but it pays
a 5.3 MB texture and 276 KB gzipped for a darker palette, a muddy saw, visible cut seams, and a saw fused into every skin.
Both draw fewer than today's brute (+35 a body on High, six +195) at about half its height.

Before it lands: take the Tripo body's proportions into the direct one (a larger head, the pauldrons sloping down over
the arms rather than round caps), run `defend.mjs` / `dodge.mjs` on the scaled reach, and re-time the slam's blow sound to
the bite. The Tripo body stays as the fallback if the author prefers its silhouette (then: lift its palette to the
reference, cut the disc's hub off the clamp, close the seams).

**The author's pick (2026-10-30): Tripo**, with the fixes above, and the wood cutter as its own enemy (`woodcutter`)
rather than the brute's replacement. After them the Tripo body wears the reference's colours, its saw reads as a toothed
disc, every world keeps its own tool and the joints bend closed, at the same draws as before (+21 a body on High, +126
for six) and a third more triangles than direct over all passes. Before it is placed: register it as its own archetype
(its entry in archetypes.js, skins.js and plans/index.js from `woodcutterArchetype`, its sounds), choose its worlds,
run `defend.mjs` / `dodge.mjs` on the scaled reach, re-time the slam's blow sound to the bite, and wire it in Unity.

### Not done (wood cutter)

- The combat review's `defend.mjs` / `dodge.mjs` and the sound QC renders (windows and sound keys are the brute's own;
  the contact frames are checked in the strips and tests).
- Unity: neither body is wired there; web only (a trial page). The Tripo asset carries COLOR_0 for the engines' VMs.
- Its own archetype is keyed (`WOODCUTTER_ID`, `woodcutterArchetype`) but not registered, placed or given its own
  skins and sounds: the trial page builds it in the brute's slot only.
- Edena's roots (the direct body's) are not on the Tripo body; its other world dress is.
