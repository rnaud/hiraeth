# Characters: the traveller, the people, costumes, capes, the studio and MakeHuman

The traveller and the people: bodies, outfits, costumes by world, cloth, the character studio and the MakeHuman bodies.

The repository skill [hiraeth-ai-characters](../../.agents/skills/hiraeth-ai-characters/SKILL.md)
captures the generation, rigging, cloth and integration workflow for future characters.

## The traveller: generated character v1 (v0.72)

The default playable traveller is the reviewed coral-shirt Tripo character, without
an integrated backpack. `src/characters/traveller-v1.js` loads the tracked asset
bundle in `public/characters/traveller-v1/` through Vite's base URL. The GLB,
rig parameters and matching per-vertex sampled colours ship with the game; no
runtime request depends on Downloads or the ignored `output/` experiment folder.
The old suited traveller remains the asset-load fallback.

The module fits the MakeHuman template with the same rest-joint procedure as the
export, hides the donor render meshes, and binds the generated surface to the
Humanoid skeleton. Gameplay retains its existing clip animation, feet/contact IK,
equipment anchors and contextual hand poses. Ground-motion arm corrections blend
with walk/jog/sprint weights, before Humanoid posing; the source wrists receive the
same rotation. Climbing, aiming, story overlays and riding keep their own contact
poses. The preview's lap pose is deliberately not applied to vehicle controls.

Shared code lives in `src/characters/tripo-*.js`; the `tools/` files re-export it
so the review and regeneration scripts use the same fitting, clothing, materials
and hand fixes. The lower overshirt, reconstructed trousers and opaque inner-shirt
backing are built at load time. The simulation retains state between locomotion
clips. Its detached CPU skinning proxies copy the real mesh's inverse world bind,
so the coat follows translation and rotation away from the review's origin.

The surfaces use the real game G-buffer material, world lighting, hero shadows
and post-processing. Repair colours are explicitly linearized before the shader
converts to the game's printed RGB, independent of global Three.js colour mode.
`Gear` recognizes the character's own outfit and retains gameplay attachment
points while hiding the legacy helmet, belt and radio-pack meshes. Earned fluid
equipment can still attach normally.

Validation (until 2026-10-14, when the game's traveller had been B3 for a day and these tests went):
`tests/traveller-v1.test.js` used the shipped asset to check binding,
arbitrary spawn transforms, cloth following a moved/rotated root, game materials,
equipment anchors, preservation of interaction poses and colour consistency.
The existing `tests/tripo-*.test.js` cover fitting, fingers and garment repairs.
Visual review still matters. This v1 has no generated facial-expression rig,
no cloth self/hand/environment collision, and no independently simulated sleeves;
seated hems and tight hand grips remain iteration areas. The body file is 4.8 MB and the head's
2.0 MB (see "What the traveller costs" below), plus 0.9 MB of repair colour data.

### His hands at the ends of his sleeves (October 2026, v1.6)

On the Motion page, from the front: one hand floated across the coat at the hip, twisted in, the other
hung under its sleeve on a thin, turned wrist. Not the overshirt (it is skinned to the same 53 bones as
the body, the sleeves are the body's own mesh, rolled to mid-forearm), not the levels of detail (never
within 3 m of him, and the page builds none), not a separate hand mesh. Two things in the pose:
`Humanoid.update` swung his forearms from the T-pose on their own, so each rolled up to 90° off its
upper arm and the forearm, the rolled sleeve and the wrist wrung round (now `hingeElbows`: the forearm
bends on the elbow as the upper arm carries it, and takes half the clip's wrist roll,
`shareWristRoll`); and the standing layer's belt hook drew a hand across to a belt hidden under his
open overshirt (now `beltHook: false` for him). Details and the measures: [animation.md](animation.md),
*Hands*; `tests/hands-sleeves.test.js`.

### His fingers curl toward his palms (October 2026, v1.7)

After that fix his fingers still looked wrong: by his thighs they bent back from the palm, fanned, the
tips crossing. Three causes, all on the coral-shirt body alone:

- **His skin slipped off his finger bones.** `createTravellerV1` fitted the MakeHuman template to the
  generated mesh (`fitDonorToSurface`: bones moved, bind matrices recomputed), but it fitted the
  *cached* template (`makeBody` caches one per person). Every body cloned from a template shares its
  bind matrices, so the next traveller built (the game's, after the title's; the Motion page's second)
  fitted the already fitted template again and rewrote the earlier one's binding under it: the third
  one's fingers were bound 7.7 cm off their bones. Now `makeBody(data, params, { fresh: true })` gives
  him a template of his own.
- **His rig's fingers are bent at rest.** The fitted knuckles and joints sit on the hand's surface,
  not on a line: bent up to 30° at rest, toward the palm or away, not the same on both hands. The hand
  poses (`HAND_POSES`, each joint's bend in degrees) were laid over that, so some joints bent back
  and others curled twice as far. `Hands.rig` now measures each joint's bend at rest and, on a rig
  with a joint bent back more than `HANDS.straighten` (5°), straightens it first (`J.zero`), so a
  pose's numbers are each joint's bend from a straight finger, the same on both hands. The Quaternius
  bodies' fingers are straight at rest and the MakeHuman people's curl only toward the palm: theirs are
  left as they were, and so are the props they hold.
- **Undriven pages left his fingers at rest.** `skeleton.pose()` in `createTravellerV1` wiped the
  relaxed pose, and `softenTripoHands` slerped the fingers 20% toward the rest on every call: once a
  frame after `Hands.update` in the game, but the only thing writing them on the title, the Motion
  page and the trailer, where they sank into the bent-back rest. The traveller's smaller thumb is now
  `Hands.reach` (`TRIPO_REACH`, part of every write, never accumulating), and the title, the Motion
  page and the trailer drive his hands as the game does.

`fingerFlex(humanoid, side)` (src/hands.js) gives each joint's bend now, + toward the palm, measured
about the hand's crosswise axis, so a mirrored rig reads the same on both hands.
`tests/hands-fingers.test.js` checks the bind against the rest after three travellers, the poses
straight and alike on both hands, every joint's bend over the idle, a walk, a run, talking in every
tone, the title stance, the blade and shield and the glove's aim (relaxed: never below -2°, curled 30°
or more a finger; never below -8° or past 125°), and the relaxed fingertips 2–7 cm out on the palm's
side, nearer the palm than straight and short of a fist.

### What the traveller costs (October 2026, v1.0)

Measured in Chrome on the M3 Pro (`scripts/bench/traveller.mjs`, the desert, hour 10; the machine was
busy, so the frame times are a guide only).

**What was in the files.** The body's `model.glb` was 10.2 MB: geometry 4.3 MB (56 486 vertices,
99 208 triangles, 53 joints, no shape keys or animations), a 4096² base-colour JPEG (1.7 MB) and two
4096² maps nothing reads (Tripo's roughness JPEG, 1.3 MB, and normal PNG, 2.1 MB; the ink material
reads only the base colour), plus the pre-fit positions no primitive uses (0.7 MB). The head's was
3.2 MB: 33 374 vertices, 48 423 triangles, a 4096² JPEG (1.5 MB). As drawn he is 124–127 k triangles
(body 61–64 k, head 45 k, overshirt 17.5 k, the rest 3 k), 34 draws a frame at Handheld and 51 at
High, and his meshes are 223 k triangles a frame at Handheld (the G-buffer and the shadow passes) and
431 k at High: 31–40 % of every view's triangles, the same 16 m away as up close.

**Now.**
- **Files** (`scripts/tripo/slim-traveller.mjs`, from the untouched exports kept in
  `data/characters/traveller-v1/`): the geometry byte for byte the same (colors.json and the runtime
  fitting index its vertices), the unused maps and accessors gone, the base colour at 2048²
  (JPEG q90, 4:4:4). Body 10.2 → 4.8 MB, head 3.2 → 2.0 MB (13.3 → 6.9 MB; gzipped 10.1 → 3.9 MB);
  the head's `reference.png` (1 MB, a review tool's) moved to `data/` too.
- **Textures:** 4096² sampled no finer than 2048² anywhere he is seen. Rendered in one frame with each
  (the face close shot at High on a Retina-sized 2560 × 1440 frame, full body, and at Handheld), the
  pictures differ by under 0.1 / 255 on average (0.01 % of pixels by more than 8). GPU memory for his
  textures 179 → 45 MB (two RGBA8 textures with mips; Chrome's graphics footprint fell 125 MiB); their
  upload on the main thread during the load 350–430 → 90–100 ms; the decode (off the thread) about
  350 → 250 ms.
- **Levels of detail** (`src/characters/traveller-lod*.js`, built in a worker, ~1 s on the Mac, after
  he is made): meshoptimizer's simplifier makes coarser index lists over the same vertices (body
  64 k → 32 k / 16 k / 7.6 k / 3.2 k triangles at 1.4 / 3.3 / 9.2 / 37 mm, head 45 k → 23 k / 11 k /
  5.4 k, overshirt 17.5 k → 8.7 k / 4.4 k / 2.1 k), appended to each geometry's index and picked by
  its draw range: the skin, face keys, cloth cage, shaders and shadow passes are untouched. A level is
  drawn where its error is under half the preset's `lodPx` on screen, and **never with the camera
  within 3 m of his feet** (the conversations' close shots and two-shots are always full). The glove's
  own index (Humanoid.wearGlove) gets its own levels. His triangles a frame: Handheld 223 k → 68 k
  (full body at 3.3 m) / 64 k (behind him, the game's camera) / 41 k (16 m); High 431 k → 235 k /
  220 k / 125 k; the face close shot unchanged. Compared in one frame, the follow view differs in
  0.3 % of pixels (a few ink dots on the shirt), indistinguishable side by side.

**Not measured:** the Retroid and the Deck (not connected); the frame-time gain (his GPU time on the
Mac is about 0.5 ms at Handheld, under the busy machine's noise); the load's total on a device.

## Legacy traveller fallback: a person in a suit (v0.43)

The traveller is a normal 3D character: Quaternius' male human (`human_m.glb`,
reshaped like the NPCs), with the NPCs' own skeleton, bind pose, weights, face
and eyes, in its natural proportions and idle stance, dressed on top
(`src/traveller.js`, `Humanoid` option `outfit`, given `traveller.glb` for the
gear's art). Nothing is re-bound or stretched, so every animation (clips,
foot planting, climbing and mantle IK, gliding, aiming, kneeling, riding, the
ragdoll) poses it exactly as it poses an NPC.

- **The suit** is painted on the body by the outfit shader (`MODE_OUTFIT`:
  lavender suit, salmon gloves on the hands, salmon boots, the folds of
  `src/creases.js` at the human's own joints), on a baggy copy of the body
  (`suitGeometry`): every vertex stands off along its welded normal by its
  region's `TRAVELLER.swell` (most on the legs and trunk, gathered into the
  boots and the glove cuffs, the inner legs less, none on the head or feet).
  The same vertices and weights as the NPC body, only further out.
- **The gear** is the rigid art of `traveller.glb`, moved once onto this body
  and skinned to one bone each, the way costume pieces are: the bubble helmet
  centred on the head (`TRAVELLER.helmet`, the face inside), the headphones'
  cups just off the ears, the scarf on the shoulders under the chin, the radio
  pack (with its pouches and a long antenna) against the suit's back, the
  boots round the feet with their soles just under the ground (their shafts
  follow the shin).
- **The extras** are built on the suit's surface and skinned like the suit
  beneath them: the gauntlet cuffs of the gloves, the pack's shoulder straps,
  the belt with its pouches on the hips, the trouser cuffs gathered over the
  boots. Pieces of one colour share one skinned mesh (`userData.ranges` says
  which vertices are which piece).
- **His face** is the people's head warped by his own face morph (`TRAVELLER.face`,
  `Humanoid.setFace`: younger and fuller than the modelled face, see *Hair, faces that
  talk*), with his own hair under the helmet's liner (`travellerHair`).
- **Hooks:** `Humanoid.headAnchor` is the skull's centre, `chestAnchor` sits
  0.74 below the collar and as far back as the pack moved (the fluid tank goes there), `Humanoid.glove` is the fluid glove on the right hand
  (its meshes, the cuff's lit vial and the anchor of the fluid's mouth: [traveller-kit.md](traveller-kit.md)).
  `Humanoid.packPocket` (the rucksack's outer pocket; the radio pack until October 2026) shows
  until the flask is found and while it sits in a vehicle (`fluid-tool.js`). The scout is not carried on him (docs/systems/scout.md).
- `tests/traveller.test.js` checks the body is the NPCs' (skeleton, weights,
  bind pose, face), the fit (helmet centred, headphones on the ears, cuffs at
  the wrists, pack on the back, feet in the boots, soles on the ground), the
  idle and kneel poses bone for bone against an NPC's, rigid pieces, gait
  retargeting at 120 phases, wall contact and the gear hooks.
  `/tools/rig-review.html` shows the build per clip.

## People of every height, build and kind (v0.39)

The body is part of a person's look (`dressFor` in `src/costumes.js`), drawn
after everything else so the rest of each look is what it was, and seeded like
it, so everyone looks the same on every visit:

- **Kind** (`'m'` / `'f'`): crowds draw it per person, level NPCs alternate (or take
  `kind` from their data), story people use `def.kind`. Women's bare heads get long
  hair, a bun or a tail (`HEADS.long`, `HEADS.bun`); about a third of the men a beard
  (`MASKS.beard`, only on a bare face). Tribes can weight headwear per kind
  (`headsF` / `headsM`: the desert, the rim, the bazaar). Story people whose kind
  isn't given get no hair swap or beard.
- **Build** (`BUILDS`: slender, slim, average, broad, stout, heavy since issue #402, see *Body shapes* below; women and men have their own odds).
  Full NPCs reshape their body mesh round its bones (`buildGeometry` in
  `src/humanoid.js`, cached per build; `Humanoid.setBuild` swaps it on a pooled
  body); the skeleton, head, hands and feet stay as they are, so headwear, masks
  and the foot planting still fit. Shoulder pieces widen with the build, robes
  measure the body they hang on, cape colliders grow with the girth.
- **Height** (`HEIGHT`: 0.85–1.15, a triangle round 1, women ×0.95; stretched to 0.82–1.18 since issue #402) on top of the
  tribe's size; people leaning on a railing keep nearly its height. Bodies scale
  from their feet. A story person with `scale` keeps exactly that.
- **The GPU crowd** gets the same body from a per-instance `aBody` (female, shoulder
  width, girth: `packBody`): the shader narrows a woman's shoulders, widens her
  hips and adds a bust, widens and fills the torso (the belly forward), thickens
  limbs and moves the shoulder and hip pivots; capes and robes follow.
- `/tools/people-review.html?world=bazaar` shows a row of a world's people as full
  NPCs with the same looks as crowd figures behind (`&builds=1`: every build of
  both kinds). `tests/people.test.js` covers the mix, the seeding, the pieces and
  the builds.

## The character studio

A page of its own for the people alone, to tune bodies, outfits, faces and
expressions without loading a world: `studio.html` (open it with `npm run dev`
at `/studio.html`, on GitHub Pages at `…/hiraeth/studio.html`, or from the title
screen: **Character studio**, the small entry under Debug). It is the second
entry of the build (`BUILD_INPUT` in `vite.config.js`), so it ships in the web
bundle and the Android app too. It loads only the people's assets (the two
bodies, the clip library `anim/ual.glb`, `anim/traveller.glb`); a world's story
data (`src/story/<world>-data.js`) and its sky (the Lab's rooms,
`src/levels/lab-rooms.js`) come in when picked.

**It draws with the game's own pipeline**, so what you see is what the game
draws: the same shadow cascades with the game's sizes (`src/shadows.js`), the
G-buffer materials (`src/materials.js`, with the figure flag that makes
`post.js` thin a small person's ink), the ink pass (`src/post.js`) and FXAA. The
render targets and the subject's screen size (`uSubject`) are shared with
`main.js` through `src/pipeline.js`. The people are the game's own classes: the
traveller is a `Humanoid` in its outfit with its `Gear` (hero-marked), everyone
else an `NPC` (`src/npc.js`) restyled to the look, with its cloth cape. A studio
render of Kip or Nima matches a `captureView` of the same person in the game.

The panel (left; under the picture on a tablet), every setting kept in the URL:

- **Who**: the traveller, a story person of any world (their palette, head, cape
  and look from the story data, dressed by `costumes.js` as the game does), a
  crowd person by world and seed (`crowdLook`), or a blank body (m / f). In the
  City-Shaft, *Where* picks the tribe by depth (`zoneIncal`).
- **Lineup**: the world's story people side by side, or N crowd people with
  their GPU crowd figures (`crowd-shader.js`) a row behind; *GPU crowd twin* puts
  the figure next to one person.
- **Body**: the build (`BUILDS`) and the morphology sliders of `src/morph.js`
  (`BODY_MORPHS`): height, shoulder width, chest, belly, hips, arm / leg / neck
  thickness (radial, on the mesh, like the builds), neck length, arm and leg
  length, head, hand and foot size (on the bones, uniform scales; longer legs
  lift the pelvis, `Humanoid.lift`). `Humanoid.setMorph(morph)`.
- **Outfit**: hair or headwear (`HEAD_IDS`, the hairstyles first), beard, mask,
  shoulder piece, held prop, cloth pattern, robe hem and flare, cape length and
  width, satchel; colour pickers for every palette slot, with the world's
  palette as swatches; the cape's cloth simulation on / off (off: the baked
  drape) and the wind.
- **Face**: variants (`FACE_PRESETS`) and the sliders of `FACE_MORPHS`: eye
  size, spacing and height, nose length and width, jaw, chin, cheeks, brow
  ridge, face length, head width (bind-space warps of the head, eyes and brows,
  `morph.js warpFace`; the face ink's landmarks move with them), and the drawing
  of `faceInk` (age lines, mouth width, freckles, lid line weight: `uFaceKit`).
  `Humanoid.setFace(face)`.
- **Expression**: a dialogue tone (`src/story/tone.js`), how much of it, talking
  (the mouth on the syllables), blinking, what the eyes follow (the camera, the
  red ball you can drag, glances, or fixed gaze sliders), and the expression's
  own sliders: smile, mouth open, brow (furrow – raise), brow tilt (anger –
  worry), squint. See "Expressions and hairstyles" in [faces.md](faces.md).
- **Animation**: the game's blend (standing, walking, jogging, running, talking,
  seated) or any clip of the library as authored; speed, pause and scrub; walking
  over the floor; the traveller's feet planting (`plantFeet`, as the player's;
  the game's NPCs don't plant theirs); the hands (by what they do, or any pose
  of `HAND_POSES`, see *Hands* in [animation.md](animation.md)).
- **Light and ink**: the hour (default: the world's own), turning the sun round
  the person, the world's light (`lightAt`: the Signal Market is lit from
  straight above, the City-Shaft and the Buried Machine's canyon more steeply),
  the world's sky or a flat colour (the portrait backdrop), the floor, the ink
  preset (the world's touches, or any of `PRESETS`), the post pass's debug views
  (`DEBUG_VIEWS`, with *Drawn detail* showing the faces' ink alone), hatching,
  shadow detail (next to the traveller, further off, the handheld preset) and
  the render scale.
- **Views** (over the picture): full body, bust, face, close-up, hands (the right hand up
  close), far away (the status line
  gives the person's height on screen: `post.js` thins a figure's ink between
  70 and 260 px), turntable. Drag to orbit, wheel or pinch to zoom.
- **Share**: copy the settings as JSON (paste the `morph`, `face`, `look`,
  `expression` into the code), copy the link, save the image.

### MakeHuman bodies: a prototype in the studio (`scripts/makehuman/`, `src/makehuman/`)

Would MakeHuman people read better than the Quaternius ones? Eight of them (a girl of 7, a boy of
15, a woman and a man, two heavy people, two old ones) are built headless by MPFB, the MakeHuman
add-on, in Blender's background mode (`scripts/makehuman/fetch.sh` gets Blender, MPFB and the CC0
asset packs into `.local-tools/makehuman/`; `build.py` makes `public/anim/mh/<id>.glb` and the
manifest `people.json`): MPFB's `game_engine` rig, which has the game's own bone names, T-posed and
scaled to the game's hips, the body decimated to 12 000 triangles with the head whole, and the ARKit
face units and visemes as 20 shape keys. `src/makehuman/body.js` (`prepareMakeHuman`) makes one a
Humanoid template with a *profile* (its face landmarks, outfit regions, ears, skull) that
`humanoid.js` reads instead of its per-kind tables; `face-keys.js` puts a tone's expression on the
shape keys (the face ink draws its share on the moving skin: `materials.js` draws morph targets for
meshes that have them). In the studio: *Who → Body source: MakeHuman* and *Lineup → MakeHuman next
to Quaternius*. Only the studio uses them, and the build leaves `anim/mh/` out (`MAKEHUMAN=1` keeps
it). The licences, the measurements (triangles, sizes, `skin-audit.mjs`'s skin weights in the
clips), the screenshots and the recommendation: docs/makehuman.md. `tests/makehuman.test.js`.
(The eight baked people are gone: stage 1 below makes them, and anyone else, from one body.)

### MakeHuman bodies, stage 1: one parametric body, MakeHuman's own hair (`?mh=1`)

The switch to MakeHuman goes in stages; stage 1 is in, behind the studio's *Body source* and the
game's `?mh=1` (the game's default people stay Quaternius, the traveller always: his suit and gear
are fitted to his body). docs/makehuman.md has the numbers, the pictures and what is left.

- **One body for everyone** (`scripts/makehuman/build.sh`: `build.py` in Blender's background mode,
  MPFB driving MakeHuman; `public/anim/mh/body.bin` (stage 2: its header in it), 1.7 MB, 1.0 gzipped, against 6.4 MB
  for the prototype's eight people). The reference person is decimated once (12 000 triangles, the
  head and now the hands kept finer) and every other shape of the full mesh maps onto that low mesh.
  MakeHuman blends its macro targets multilinearly between corners (gender × age 1/11/25/90 ×
  muscle × weight, height and proportions leaning each gender and age), so the build samples exactly
  those 100 corners and packs their principal components (27, int16 then int8: no head point off by
  more than 4 mm at any corner); a few targets of the reference go as sparse deltas (a belly, hips and
  waist for the heavy, the face's targets). `src/makehuman/shape.js` turns who someone is into
  MakeHuman's sliders (`personParams`: kind, years, build `MH_BUILDS`, their world's proportions
  `WORLD_BODIES`) and those into the corners' weights (`nodeWeights`); `src/makehuman/body.js`
  (`makeBody`, ~10 ms) makes the points, the skeleton (each bone at this person's joints, turned as
  the reference's), the skinned body, eyes and brows with the face keys as morph targets, measures
  the landmarks the face ink, the outfit and the hats need (`measure`), and hands Humanoid a profile.
- **The game's people** (`src/makehuman/people.js`): `main.js` passes `[man, woman]` templates where it
  passed the Quaternius pair; `NPC` asks the family for the person's own (`templateFor`: a story
  child or elder by `def.age`, an elder's face, their build; their world). A pooled crowd body is a
  grown-up of average build that takes each person's build as it goes (`profile.buildGeometry`, the
  MakeHuman shape on the same skeleton). A child stands as tall as the story says (`heightFix`), keeps
  only the ink of a Quaternius face morph (`filterFace`), and its face is drawn bare (`profile.young`).
- **Hair** (`scripts/makehuman/hair.py`, `src/makehuman/hair.js`): MakeHuman's ten CC0 hairstyles,
  fitted by MPFB, their alpha cards cut to the strands, thickened and voxel-remeshed into closed
  shells with the style's cut, smoothed, decimated (2 000–3 300 triangles); the cards grouped into a
  few big locks, a shallow groove along each border and, in the game, each lock its own normals there,
  turned into the groove (`creaseNormals`): the ink pass draws the borders as a few strand lines. The
  beard is the same kind of shell made from the jaw's own skin (the lips clear). Each shell vertex is
  bound to the low body (triangle, barycentric weights, offset), fitted on load to any head, weighted
  to the head, neck and upper spine only. The game's hairstyles map to the nearest one (`MH_HAIR`; the
  topknots, buns and crest keep the game's own pieces on top; hats keep the game's cap under them).
- **Faces**: MakeHuman's eyes opened (the upper lids lifted, the eyeballs 5% bigger, its eye-scale
  target) so they read at a distance; the Moebius face as MakeHuman targets on grown-ups
  (`HIRAETH_FACE`: a longer chin, lean cheeks under clear cheekbones, a long straight narrow nose, a
  firmer brow); the warmer faces kept (the resting smile on the shape keys, the brows tapered, the warm
  shade, a child's bare face).
- **Levels of detail** (`src/skinned-lod.js`): shape-keyed bodies get levels too, built without the
  keys (far off a face has no expression to show); up close the full mesh, keys and all.
- **The studio**: *Lineup → MakeHuman: every age and build* (`&mh=child,elder` for some ages) and
  *every hairstyle* (and the beard), *Outfit* `l.mhHair` forces a style; the pairs lineup is the
  presets of `src/studio/makehuman.js` (`MH_PRESETS`). `tests/makehuman.test.js`.

### MakeHuman bodies, stage 2: the Desert's people (`MH_WORLDS`, `?mh=0`)

The Desert's people (story and crowd) are MakeHuman bodies by default; `?mh=0` brings back the
Quaternius ones to compare, `?mh=1` puts any world's people on MakeHuman (`usesMakeHuman` in
`src/makehuman/people.js`; the other worlds followed in stage 3, below).
docs/makehuman.md has the checks, the numbers and the pictures.

- **The file**: `public/anim/mh/body.bin` is one file now (its JSON header in front: `pack.py`,
  `unpackBody`), asked for as the page starts and parsed in about 1 ms (the arrays are views on it); the
  build ships it (1.75 MB, 1.06 MiB compressed; `MAKEHUMAN=0` leaves it out).
- **Heights** (`personTemplate`): every MakeHuman sample has its hips where the Quaternius man's are,
  which made a MakeHuman woman 5 % taller than a man: a grown-up's root scale is corrected
  (`heightFix`, `Q_TOP`) so heights mean what they meant. The young stand as tall as MakeHuman makes
  their age beside the grown-ups (`trueScale`); the story says who is a child (`def.age`, `def.years`:
  Ilo 8, Kito 9, Lou 7.5) and a small story person without an age is one (`CHILD_SCALE`).
- **The crowd**: a crowd body come close takes its person's build and age (an elder's shape on the
  pooled skeleton: `Humanoid.setBuild(build, years)`, `profile.yearsOf`) and stands as tall as its
  figure; its 16 shapes (4 builds, grown-up and elder, each kind) are made ahead while the page is idle
  (`MakeHumanPeople.warm`); the GPU figure's women's shoulders and everyone's hips moved to the full
  bodies' joints (`CROWD_BODY` in `src/crowd-shader.js`).
- **Cloth and ragdolls** (`src/humanoid.js` `segmentGirths`, `CAPSULES`, `CAPSULE_MARGIN`): on a MakeHuman
  body the cape's colliders are its own girths (each segment's 90th percentile from its bone) plus
  the margin the Quaternius colliders leave over their skin, at the body's size (a heavy belly, a
  child's thin arms); the ragdoll's particles likewise (`ragdollRadii`).
- **Hair**: a scalp under every style (`hair.py` `scalp_of`: the head's skin the shell lies over;
  `hair.js` `scalpOf` draws it 1.5 mm off the skin in the hair's colour), so the skin no longer shows
  through the crowns of short02 and short04; the locks' borders are drawn lighter on dark hair
  (`HAIR_EDGE`), so the strand lines read in shade.
- **Memory and frame time**: a body's reshaped copies (its builds, its faces) share its triangles, skin
  and face keys' arrays (`reshapeCopy`); the keys' morph textures were one per geometry (three's: stage 3
  shares one texture between every body).
  A costume's colours are parsed once a role and a hair shell's weights set at once (`dress`), so a
  crowd body re-dressing as it comes close costs no more than a Quaternius one. Measured at the camps
  and Qanat on High and Handheld (CPU 4x slower): the same frame time as the Quaternius bodies, +30 to
  +60 MB of JS heap (docs/makehuman.md has the table).
- **The traveller** stays on his own Quaternius body: his suit, gear and helmet are fitted to it, he
  is the stranger from the sky, and at a conversation's distance the helmet and visor frame his face.
- The named people follow their character sheets (`references/levels/The Desert/characters/`).
  `tests/makehuman-desert.test.js`.

### MakeHuman bodies, stage 3: every world, one face-key texture, more headwear

docs/makehuman.md (stage 3) has the checks, the numbers and the pictures; `tests/makehuman-worlds.test.js`.

- **The face keys in one texture** (`src/makehuman/body.js` `keyTexture`, `face-keys.js` `bindKeys`,
  `materials.js` `FACE_KEYS`): each part's keys (body, eyes, brows) are one half-float texture array for
  every body (a layer a key, a texel a vertex, the reference head's deltas); each body's material reads it
  in its vertex shader, scaled by its own head (`uKeyScale`), with its own weights, set before each draw
  from the geometry it draws (a level of detail has none). three.js made a morph texture per geometry
  (about 1 MB each body that came close, and a CPU copy): at the camps 39 textures and 30 MB of heap fewer.
- **Headwear** (`src/costumes.js`): hats wide and narrow (`brim`, `straw`, `trilby`, `bowler`), caps
  (`peak`, `flatcap`, `beanie`, `trapper` with ear-flaps, `aviator`, `skullcap`), cloths (`bandana`,
  `kerchief`), `circlet`, a miner's `helmet`, a hood thrown back (`hooddown`, its folds in the chest frame:
  `HEADS[].chest`); masks `glasses`, `shades`, `scarfmask`, `facewrap`, `monocle`; shoulder pieces
  `neckerchief`, `muffler`, `neckgoggles`. Built on the skull egg (`shell`, `rim`, `visor`, `lathe`,
  `faceCloth` round the measured faces), so they sit on any skull the head frame is scaled to
  (`profile.headScale`). The crowd's packing has room for 16 masks and 16 shoulder pieces
  (`MASK_ID_LIMIT`, `BODY_ID_LIMIT`).
- **Hair under a hat** (`HEADS[].cover`, `squashUnder`, `hair.js` `squashHair`): on a MakeHuman body a hat,
  cap or band over part of the head is worn over the person's own hairstyle (`look.under`, `underOf`):
  the shell pressed in to the hat's inside where it covers (a hairline round the skull, `t` off it, a flat
  crown's `top`), easing out below its edge, so long hair falls from under a brim. A hood, wrap or
  headcloth still hides it.
- **Each world its own** (a tribe's `more`): the new pieces are drawn apart from a tribe's own weights
  (`more()` in `dressFor`, by a draw of their own), so the crowds wear them and everyone drawn before,
  every named person, keeps their look; named people wear new pieces only where their story says so.
- **The worlds on MakeHuman** (`MH_WORLDS`): every level now (the Desert in stage 2; the Signal Market first in
  stage 3, then the others one by one); `?mh=0` brings back the Quaternius bodies anywhere. The story's
  children are given their ages (`def.age`, `def.years`; a spawn spot's `age` / `years`), and a child or a
  teenager grows no beard (NPC passes `young` to `namedLook`).
- **The studio**: *Lineup → MakeHuman: every headwear* (*MakeHuman person*: the face pieces, the shoulder
  pieces, or the world's own set), round a woman, a man, a girl, a boy, a heavy old woman and an old man.
- **The fit test** (`poking` in the test): rays from the skull's centre to every point of the skin and
  of the hair under the headwear; a point past a piece (and not inside a closed one) pokes through. The
  new pieces: none through on children, teenagers, grown-ups, the old and the heavy.

### Who wears which body (issue #271)

| who | body | where it is chosen |
|---|---|---|
| the traveller | his own: the accepted B3 body ("Traveller B3 body", below), built on a MakeHuman template | `main.js` `createTraveller` (`characters/traveller.js`); the Quaternius man only if it fails to load |
| story people, walkers, the family, the minigames' and trials' people, the recordings' holograms | MakeHuman, each by age, build and world (`MakeHumanPeople.templateFor`) | `main.js` `peopleT` (NPC, `createStory`, `ship.attach`, the minigames' `people`) |
| the crowd near (`CROWD_BUDGET.pool`, 4 full bodies) | MakeHuman, a grown-up of average build taking each person's build and age | `pooledNPC` |
| the crowd beyond them | the GPU figure (`crowd-shader.js`), matched to the MakeHuman joints (`CROWD_BODY`) | `crowd.js` |
| guardians, creatures, foes | their own bodies | not people |

`usesMakeHuman` says yes in every world, one not made yet too; `?mh=0` brings back the old Quaternius
bodies to compare. The studio's *Body source* defaults to MakeHuman (the game's); `source=quaternius` shows
the old ones. Still on the Quaternius bodies: the native Unity export (`scripts/unity-export`, docs/makehuman.md
"What a full switch would take"); the engine bridge draws the game's MakeHuman people.
`tests/makehuman-worlds.test.js` ("every person of the game on a MakeHuman body").

Measured again for the issue (Mac, headless Chrome on the GPU, 1280 × 720, the spawn, walking and turning
12 s, three runs alternating `?mh=0` and the default, medians; 60 fps throughout): the City-Shaft (18 people,
about 1 500 in its crowd) High CPU 8.9 → 9.3 ms, GPU 15.8 → 15.2 ms, Handheld CPU 8.3 → 8.7, GPU 8.7 → 8.2;
the Signal Market High CPU 5.9 → 5.8, GPU 12.2 → 11.7, Handheld CPU 5.4 → 5.7, GPU 7.2 → 7.3 (Quaternius →
MakeHuman): within the runs' spread, as in stage 3.

## Capes at a distance, and people up close (v0.39)

- **Capes hang at rest far off** (`src/cape.js`). Cloth is only simulated near the
  camera (70 m, 30 m on the Handheld preset); further off a cape used to stay in
  the air where it was last simulated, and drop from its stiff cut as you came
  near. Now each cape has a *drape*: the cloth at rest on that body, in the
  collar's space. Out of range the cloth eases onto it over half a second and the
  mesh is parented to the collar (`Cape.rest` / `hang`), so it walks with its
  wearer at no cost. Coming close, the simulation starts from the drape
  (`reset`). The drape is baked by letting the cloth settle, heavily damped
  (`Cape.bake`, ~1 ms, one a frame), shared by capes of one cut on one kind of
  body (`NPC.drapeKey`: kind, build, standing or seated), and refreshed from the
  simulation while the wearer stands still and the cloth is at rest. A crowd
  person promoted to a full NPC gets the shared drape, so their cloth no longer
  drops in front of you. The capsule collisions are plain arithmetic now, a third
  cheaper and with the same result.
- **Nobody shakes when you walk into them or talk nose to nose.** Nothing stops
  you walking into people, and the way to you was an atan2 of a few centimetres:
  every small step swung them round and back. `holdAim` (`src/crowd.js`, also used
  by `src/npc.js`) follows you from 0.7 m out and holds its way inside 0.25 m.
  A standing crowd person steps out of your way round you, not through you (the
  offset turns, its way held while you stand on their spot), and their pace is
  smoothed so the walk doesn't flicker on and off. A walker keeping clear of you
  judges the lane from where they'd walk without the step, along their path rather
  than their heading (turned to greet you, that is you), so they step aside once.
  The two-shot keeps its last good line between you when you stand too close for
  one. `tests/close-contact.test.js` and `tests/cape.test.js` cover them.

## Capes on a few (issue #347)

The author: "Too many characters wear capes, it shouldn't be more than 10%. Simplify the outfits for everyone
else." Counted over everyone the game dresses (`node scripts/cape-census.mjs`: the story's and the temples'
people, the hosts, the shopkeepers, the walkers, a 240-person sample of each world's crowd), 81 % wore a cloth
cape or a cape over the shoulders (the desert's `mantle`, Lorn's `reedcape`, the shaft's `tatters`: `CAPELETS`);
every crowd of the Salt Harbour, the lake, the ring and the silent ones. Now 6 % (the most, the silent ones of
Vael, 14 %).

- **Who wears one** (`caped` in `dressFor`, `src/costumes.js`): the elders (a face of the `elder` type) and
  those who walk with a staff (pilgrims, processions, monks), at the tribe's odds (`T.capeOdds.meant`, 0.1 for
  the Major's mechanics to 0.4; default `CAPE_ODDS`), anyone else hardly ever (`other`, 0.02; none among the
  mechanics and the dome people). The length is the one drawn from `T.capes`, or its longest. It is decided
  from a hash of the look already drawn, not the stream, so nobody's other pieces move.
- **Everyone else** wears their tunic and trousers, skirt or robe: a cape over the shoulders becomes the tribe's
  plain neck piece (`T.plain.body`: the desert's and the harbour's neckerchief, the lake's scarf, the lamp-keepers'
  muffler, the mast-menders' tool belt; the crowd's figure carries it, `worldPieces`), and in the tribes that work
  with their hands a share of those who lost a cape wear an apron's bib (`T.plain.apron`, the `bib` trim).
- **The story's capes**: a person's `cape:` is theirs. Kept where a sheet or the story draws one: Bako, Sefa,
  Nour, the Speaker and the desert's two keepers Ama and Hessa, Halden who carries the Glass Dunes' floats from camp to camp, the quest references that wear one (Oïa, Kesh,
  Sister Aube, Ondine, Cael, Saba, Fen: `quest-looks.js`), Nettle (her shop's design) and Solange, who rides the
  roofs. Everyone else's went to 0 (the dismissed Sealed Hangar's left as they were) (and a cape over the shoulders with it, unless their `look.body` names one).
  Haddu, Tansy and Anselm Thrum wear the coats their notes describe instead (`look.robeOpen`, `robeRole`,
  `robeHem`: the family's open coats, now passed through `dressFor`).
- The Glass Dunes' frozen figures: only the glassworker (her sheet) and the carrier in the storm keep theirs.
- `tests/cape-share.test.js`: capes on ≤ 10 % of everyone and ≤ 15 % in any world, the sheets' capes kept,
  the plain looks and the streams unchanged, the capes on the elders and staff-bearers. The cape tests' Sel and
  Hask fixtures carry their own capes (their reference designs wear robes); `tests/engine-unity.test.js` runs the Glass Dunes (Halden's cape reaches BridgeCape) instead of the Hangar, whose mechanics wear none now.

## Skirts on a few (issue #370)

The author: "Too many characters have skirts. Simplify." A robe from the belt down (`s.robe`, the hem's height:
a knee-length skirt or a long robe; an open coat, `robeRole: 'cloak'` / `robeOpen`, is no skirt: `wearsSkirt`)
was on 62 % of everyone the game dresses (`node scripts/cape-census.mjs --skirts`), every one of Vael's silent
ones, the bell monastery and the listeners. Now 11 %.

- **Who keeps one** (`robed` in `dressFor`, `src/costumes.js`): a robe the story or a reference sheet sets
  (`look.robe`) is theirs. Otherwise the elders and those with a staff at `robeOdds.meant`, anyone else at
  `robeOdds.other` (default `ROBE_ODDS` 0.35 / 0.06; the desert's pilgrims 0.08; the orders whose robes are
  their habit, Vael's silent ones, the bell monastery and the listeners, 0.6 / 0.2). Everyone else wears
  trousers in their legs' colour. Decided from a hash of the look already drawn, like the capes, so nobody's
  other pieces move; the Unity port dresses people with the same JS (`scripts/unity-export/people.mjs`).
- `tests/skirt-share.test.js`: skirts on ≤ 15 % of everyone and ≤ 20 % in a world (the three orders ≤ 50 % and
  ≥ 20 %), the sheets' robes kept, the streams unchanged, robes kept more often by the elders and staff-bearers.

## Fewer hats (issue #403)

The author: "We have too many weird hats, redesign the hats and have less of them on average." Something on the
head (a hat, a cap, a hood up, a wrap: `wearsHat`; hair and a hood thrown back are not) was on 81 % of everyone
the game dresses (`node scripts/cape-census.mjs --hats`, `--who` for the named people), every one of the Buried
Machine's and the Moon Foundry's crowds. Now 28 %.

- **Who keeps one** (`hatted` in `dressFor`, `src/costumes.js`): the headwear drawn is kept at the tribe's
  `hatOdds` (default `HAT_ODDS` 0.3); otherwise the person goes bare-headed in the hair that was under it
  (`s.under`, the tribe's hairstyle). Decided from a hash of the look already drawn, like the capes and skirts, so
  nobody's other pieces move. Kept whatever the odds: `look.head` (a quest reference sheet, `quest-looks.js`; the
  story's `look`), and a story head that names a piece of its own rather than the generic `hood` / `hat` / `wrap`
  (`GENERIC_HEADS`): the Speaker's tall hat, Sefa's cap, Nour's sun hat, Marrow's rag hood, Haddu's fez. Bako's
  head-wrap (on his sheet) is now `look.head`.
- **Where the culture asks for more**: the desert (`hatOdds` 0.45: sun and sand, its headcloths; the Glass Dunes
  dress as the desert), the Buried Machine and the Moon Foundry (0.38: padded hoods and hard hats are the mine's
  work gear), Vael's silent ones (0.55: the cowl is their order's habit) and the bell monastery (0.4). Crowds
  elsewhere: 15–33 %.
- **The oddest shapes out of use** (taken out of the tribes' tables and `as` maps; the pieces stay in `HEADS` for
  the sheets that wear them): the rim's `tophat` and `spire` (now `bowler`, `trilby`), the Garden of Spheres' `orb`
  (`skullcap`, `circlet`), Lorn's `reeds` (`brim`, `hood`), the `lamphat` of Lorn II and the White Mangrove (`hood`,
  `brim`), the Hangar's and the Forest of Antennas' `antenna` (`peak`, `beanie`, `hood`), Viridel's `flowers` (they
  floated round the head: `straw`, `circlet`), the Signal Market's `fez` (`turban`, `flatcap`). The `wizard` hat was
  already only on sheets (the Speaker, Ume, Hollin). Contact sheet of every headwear and the before / after crowds:
  issue #403.
- `tests/hat-share.test.js`: ≤ 33 % of everyone, each crowd ≤ 30 % (+5) unless its culture asks for more, the
  dropped shapes on nobody but the sheets, the sheets' and the story's own heads kept, the streams unchanged.
- **Next**: a smaller, coherent set of hats per world, from sheets the author picks (`docs/design/hat-prompts.md`):
  done, "The hat sets" below.

## The hat sets (issue #439)

The author picked one sheet per culture in the reference lab (issue #437; `references/hats/<set>/sheet-1.jpg`), and
each set's two to four hats are modelled as `HEADS` pieces in `src/costumes.js` (`set`: the sheet; `HAT_SETS` lists
them, `HAT_SET_WORLDS` the worlds each dresses). 47 pieces, 15 sets:

| Set | Worlds | Pieces |
|---|---|---|
| city-shaft | the City-Shaft, the City Floating in Space | `rimhat` (the rim: pale lacquer, flat crown, short brim, a band), `workcap` (the middle levels: soft patched cap, short peak), `soothood` (the depths: rag hood wound round the chin), `goggleband` (leather band, lilac goggles up) |
| spheres | the Garden of Spheres | `listenercap` (the ears clear, a brass dot), `ringcap` (the same, a brass ring), `eldercowl` (to the shoulders, a gold edge) |
| lorn | Lorn | `reedhat` (low woven reed), `swamphood` (moss, tied at the chin), `knotcloth` (lilac, knotted) |
| signal-market | the Signal Market, the Overnight Train | `marketturban` (plain, wound), `tasselcap` (a trader's, brass tassel), `headpad` (a porter's flat coil, seated on the crown), `printscarf` (printed, tied at the nape) |
| desert | the Desert, the Glass Dunes | `pilgrimcloth` (to the shoulders, a twisted cord), `desertwrap` (one end down the side), `conehat` (a modest straw cone over a white cloth), `glasscap` (the glassworker's canvas, ear flaps) |
| vael | Vael | `ordercowl` (a low soft point behind, over the shoulders), `windhood` (a light hood, wound round the neck) |
| vael-ii | Vael II | `monkcowl` (rounded, close round the face, a thick roll round the neck), `wimple` (the sisters' bell), `novicecap` (violet) |
| buried | the Buried Machine, the Moon Foundry | `domehood` (padded, a rolled rim, rust ear pads), `minerhat` (its lamp flush), `knitcap` (sage) |
| viridel | Viridel | `gardenstraw` (a mint ribbon), `leafband` (woven leaves on the hair), `bonnet` (a pink lining, tied under the chin) |
| lorn-ii | Lorn II | `mosshood`, `keepercap` (a brass button; the lamps stay on their poles), `duskhood` (a rolled edge) |
| mangrove | the White Mangrove, the City During the Eclipse | `lakehood` (lilac, a brass pin), `veilhood` (long, a gold edge), `flatreedhat` (flat, wide, a finial) |
| harbour | the Salt Harbour, the Underside | `sailwrap` (knotted behind), `souwester` (the long back brim), `salthood` (a stiff edge, a scarf) |
| falls | the City Behind the Waterfall, the Underwater City | `sprayhood` (rust, to the collar), `ringpad` (a basket-carrier's coil seated round a bun), `oilcap` (teal) |
| antennas | the Forest of Antennas | `mendercap` (brass goggles up), `climbhood` (buckled under the chin), `wireband` (braided wire) |
| fallen-ring | the Fallen Ring | `herderhood` (ivory, to the shoulders), `feltcap` (sage, a vermilion edge), `hullcloth` (vermilion, tied behind) |

- **Shapes**: fitted to the skull egg like stage 3's hats (`shell`, `rim`, `visor`, `lathe`), so they sit on every
  head the skull is measured on, every age and build (#402: the builds leave the head alone). The hoods are one new
  shape, `hoodShell`: cloth `t` off the skull from an oval face opening (`brow` over the eyes, down the cheeks `face`
  degrees round) to the crown, hanging below the skull to its hem (`drop`, `flare`, a soft `point` behind for Vael's
  cowl); `hoodNeck` closes it under the chin (the close hoods: Lorn, Lorn II, the falls, the mine, the ring, Vael,
  the monastery's wimple, the depths' rags), `hoodEdge` rolls its edge. Hats over hair carry a `cover` (the hair
  squashed under them); hoods have none (the hair inside). `tests/makehuman-worlds.test.js` rays every piece's skin
  and hair on seven MakeHuman heads (a man, a woman, a girl of 8, a boy of 15, the old and heavy, a broad man) in
  three hairstyles: none through.
- **Colours**: each piece carries its sheet's own (`HEADS[].hats`); a crowd person in one gets one of them, from a
  hash of the look, at the very end of `dressFor` (nothing drawn or hashed before it moves). A story person's own
  hat colour (`palette.hat`) is kept. Brass, the white cloth under the desert's cone and the clay of ear pads and
  edges are fixed colours (`FIXED.brass`, `ivory`, `clay`: the crowd shader's zones 16-18, web and Unity alike).
- **Who wears them**: each tribe's `heads` (and `headsF`, `more.heads`, `as`) name its set in place of the generic
  shapes, the hats' weights summing to what they were and in the same order, so exactly the same people are under a
  hat as before (#403's share: 28 % of everyone, `node scripts/cape-census.mjs --hats`), drawn from the same streams.
  The Eclipse and the Underwater City weigh their own piece most (the veil-hood, the oiled cap). Named people whose
  own head is a piece (`look.head`, the reference sheets; the Speaker, Sefa, Nour, Marrow, Haddu) keep theirs; a story
  head that is the generic `hood` / `hat` / `wrap` is now the set's (Ama's wrap, Haro's straw cone, Ket's dome hood).
- **The crowd figure**: 101 head ids now, so `HEAD_ID_LIMIT` is 128 (`aDress.x = id + 128 × hair cap`) and the
  figure's costume codes step by it (`aRig.z = slot × 128 + id`: crowd.js, crowd-shader.js, glass-dunes-figures.js,
  the Unity port's `Crowd.hlsl`). A world bakes only its own set; the figures stay under 2 500 / 600 triangles.
- **Studio**: `studio.html?lineup=mhheadwear&mh=hats`: every piece on a grown woman and man in turn, labelled with
  its set, in its sheet's colour (the contact sheet). Tests: `tests/hat-share.test.js` (the sets, their worlds and
  nothing else in them, the same people under a hat, the colours last), `tests/makehuman-worlds.test.js` (the fit).

## Body shapes: thin to round (issue #402)

The author: "Add people with different body shapes so they don't all look the same (more slender, fatter)". The
four builds were there, but MakeHuman's sliders kept them close (its heaviest weight is only moderately heavy) and
on screen everyone was the same lean figure; heights varied by a few centimetres.

- **Six builds** (`BUILDS` in `src/costumes.js`, slender to heavy): `slender`, `slim`, `average`, `broad` (the
  muscled one), `stout`, `heavy`. Each is a MakeHuman shape (`MH_BUILDS` in `src/makehuman/shape.js`: muscle, weight
  and the belly, hips and waist targets) with its own girths on the mesh over it (`MH_BUILDS[].morph`: morph.js's
  radial body keys, shoulders, chest, belly, hips, arms, legs, neck, within the studio's slider ranges), so a slender
  person reads as thin and a heavy one as round from across a square. Children take none of a build's girths, a
  teenager some (`buildMorphShare`); a story person's own `def.morph` multiplies them (`withBuildMorph`). The
  skeleton, head, hands and feet are untouched, so hats, masks, held props and the foot planting fit every build.
  The Quaternius bodies (`?mh=0`) have the two new ones too (`BUILD_SHAPE`).
- **Who has which** (`buildFor` in `dressFor`): from a hash of the look already drawn, like the capes, skirts and
  hats, so no draw of a crowd's stream moves (the old build's draw is still made and thrown away). At the odds of
  `BUILD_ODDS` (a man's and a woman's) times the world's lean (`WORLD_BUILDS`, from the people their notes describe):
  the desert's pilgrims, Vael's silent ones, the lake folk and the rope-town under the rock leaner; the Signal
  Market, the Salt Harbour, the Moon Foundry, the city at its tables and the ring's herders sturdier; the mechanics
  and the miners broad. Children and teenagers are seldom heavy. A build the story sets (`look.build`) is kept.
  `node scripts/cape-census.mjs --builds [--who]` prints each world's shares and the named people's builds.
- **Heights** spread further (`HEIGHT.stretch` 1.4, 0.82–1.18 of the tribe's size, was 0.85–1.15): the height
  drawn is stretched last, so everything seeded by it (eyes, face, cape, hat, skirt, build) stays as it was.
- **Clothes follow** on their own: a tunic and trousers are painted on the body (the outfit shader), a robe
  measures the body it hangs on, the cape's colliders are the body's own girths (`segmentGirths`), shoulder and
  chest pieces widen with `BUILDS[].width` and `girth`. The stout and the heavy hold their hanging arms a little out
  from their sides (`BUILDS[].armOut`, rad, `Humanoid.update`: the more the arm hangs, the more), clear of the belly
  and hips; gestures, props and the seated poses are left as they are. Gait: the new builds have their own stride,
  bob and sway (`gaitStyle`); the heavyset captured walks suit the stout too.
- **The crowd figures** carry the same body for nothing (no draw call): `packBody` puts the build's belly, hips and
  limbs (`bodyShapeCode`, 31 steps of 0.05 each) over the female bit of `aBody.x`; `crowd-shader.js` (and the
  port's `Crowd.hlsl`) widen the belly forward and to the sides, the hips and their pivots, thicken the limbs and hold
  a fuller figure's arms out (`CROWD_BODY.armOut`, `hipPivot`, `bellyF`).
- **Named people**: the shopkeepers' builds follow their notes: Brin, Nettle, Hale and Amaro slender; Burdock, Odo and
  Odette stout; Gunnar broad; Pashka and Sister Perpetue stay heavy; Anselm Thrum slender (his drawn height kept so
  his eyes and face stay his). Everyone else without a build of their own draws one as the crowd does.
- **Checked**: the studio's `lineup=mhbuilds` (every build of one kind), the crowd lineups of every world before and
  after, three named people up close; walkers of each build in node (planted feet slip 1.4–1.8 mm a frame, as the
  average's; the hands' joints 3–9 cm clear of the trunk and thighs walking, 5–15 standing); Unity's crowd from the
  same JS and the ported shader. `tests/body-shapes.test.js`: every build in every crowd, the worlds' leans, the
  streams unchanged, the named builds, the crowd packing (and the HLSL's numbers), the rig's limits (girths within
  the sliders, ordered thin to round, the skeleton and head untouched, a child's arms as they hang).

## Seated capes fall onto the seat

Seated people's capes used to fan out round them like wings: the cloth's floor was a plane at
the seat's height, as wide as the world, and the bends that give a standing cape its long
vertical folds held the cloth out flat like a board, so the lower half lay spread round them
(Nour's ~1.2 m out, its hem level with her shoulders).
- **The ground round the seat** (`groundField` in `src/cape.js`): once for each seat, heights
  on a grid round the hips (±0.96 m, 12 cm, probed with `Physics.groundAt` from just above the
  seat, in the body's frame). The cloth rests on the bench top beside and behind the hips and
  falls over its edges to the ground. At a step (an edge) the grid is a set of columns: a point
  well under a column's top is beside it and goes out sideways, not up onto it (cloth hanging
  down a bench's side climbed onto it). A ledge or a kerb is the same field: the cloth lies on it.
- **No bends seated** (`Cape.seatedK`): the cloth folds where it meets the seat and the ground.
  Standing and walking capes keep their bends and the plain floor under the feet.
- **Who:** story people with a `seat` (`NPC.seatField`), the crowd's sitters (poses 3 and 4,
  `updatePuppet`), and the studio's stool. The shared drape key carries the field's shape
  (`drapeKey(pose, field)`: `sig`, to 5 cm), so people on one kind of seat share a drape and
  others bake their own. A person's first frame puts them on their seat at once (the drape is
  baked then). Probing costs ~0.2 ms a seat, the cloth's step no more than standing.
- **The seat itself, seen or not** (`SEATED.seat`, `groundField(…, seat)`): the field always has the
  seat under the hips (a stool, a crate the physics doesn't see), and where the physics finds
  nothing just under the hips `NPC.seatField` lays the field over what is drawn there too
  (`DrawnSurfaces` round the seat, `trianglesGround`): Sel's cape fell through her crate, its hem
  out under the far side.
- **Soft, one-sided bends and a gathered cut** (`SEATED.bend`, `fold`, `hem`): with no bends the
  cloth crumpled into folded shards where it met the seat; with bends holding it straight it stood
  out over the bench and off a ledge in stiff sheets. Seated, a bend only pushes two points two rows
  (or columns) apart when they come closer than `fold` of their rest, so the cloth bends freely but
  never creases back on itself; and the seated cut's hem is narrower (`localSeat`, `seatRest`), so it
  hangs down the back and pools behind instead of spreading its whole width along a long bench. A
  seated bake settles longer and less damped (`SEATED.bake`, `bakeDamp`: the standing one let the
  cloth come only ~40 cm down from its cone). A point pushed out beside a step keeps its velocity
  (its last place moves with it: pushed alone it flew out sideways).
- `tests/cape.test.js` measures seated capes (Nour on her bench, Sel on a stool the physics
  doesn't see and on her drawn crate, Bako and Sefa on a camp log bench, Hask on a broad ledge): the
  spread from the body's axis, cloth standing up over the seat, how far the hem hangs below the
  collar, the share of it inside the seat and creased into shards, near and far.

## Seated robes sit on the seat, not in it

A robe's lower part follows the thighs at three quarters of their swing (`robeGeometry`), which
reads well walking; seated, the thighs forward, it stood out from the lap as a ring round the knees,
through the bench under and in front of them. Seated people now wear the robe shaped and weighted
for sitting (`Humanoid.sitRobe`, called by `NPC.posture` for poses 3 and 4: story people with a
`seat` and the crowd's sitters): under the hips wholly with the thighs, snug over the lap and close
under them behind; past the knees with the shins, flaring from there to the hem, so it falls in
front of the shins (a short robe flares the less the less of it hangs past the knees: `ROBE_SEAT`
in `crowd-shader.js`). The costume keeps a second geometry with the seated positions, normals and
weights (the colours and index shared) and swaps it in; its levels of detail follow. The crowd's
figures do the same in their shader, whose robe also no longer went through the arms' turn (part 11
fell into the branch for parts 6..9: it swung out with the right arm on a walker and went up over
a sitter's head). `tests/seated-robes.test.js`.

## Costumes, the close camera and subtitles (v0.37)
- **Costumes** (`src/costumes.js`, keyed by level id): each world has one or more tribes
  (headwear, mask, shoulders, prop, robe, cape, pattern, skins, palette), seeded by world
  and person id. Full NPCs get them as one merged skinned mesh (`Humanoid.dress()`); the
  GPU crowd reads them from `aDress` and per-world figure geometry (`figureGeometry`),
  with a shared `TRIM_GLSL` for cloth patterns. Quest people can set a `look:` override.
- **Camera** (`CameraRig` in `src/player.js`): close over the shoulder (2.6 m) wherever
  `tightness()` finds walls and a roof around the player, `rig.indoor` / `rig.tight` are
  set, or the player is in an `interiors.js` room; 9.5 m in the open.
- **Cinema layout** (`layoutCinema()` and `Subtitles` in `src/ship/cinema.js`): hint,
  toasts, objective card, subtitle and skip bar each get their own place and never
  overlap each other, the HUD, the touch buttons, a conversation or the box card. Toasts
  queue and wait while the screen is dark or a panel is open.
- **Update status** (v0.38): `WebBundles` records each update check (`check`: checking,
  current, downloading, ready, apk, offline, error; `latest`: the newest build seen) and
  `AppShell.info` reports it; `updateStatus()` in `src/native-app.js` shows it under the
  build label in the settings. `NATIVE_API` went to 3 for this.
- **The changelog** is `src/changelog.js`; `changelog.md` is generated from it with
  `node scripts/changelog-md.mjs` and `tests/changelog.test.js` keeps them in sync (see
  CLAUDE.md).

## Traveller reference redesign (v0.63)

The current character follows the [three reference sheets and visual direction](../../lore/characters/traveller-design.md): coral overshirt, cream cropped trousers, scruffy dark hair and a round satchel. `src/traveller.js` builds the clothing on the unchanged human animation rig; `src/traveller-style.js` owns its palette. `src/fluid-tool.js` fits the compact green tank and preserves its scale through vehicle handoffs. The earned star and lantern mounts live in `src/boxes/effects.js`.

For a complete preview, open `studio.html?backpack=1`; the **Fluid backpack** checkbox uses isolated state and never grants items to the game save. The traveller and drone tests cover skin weights, garment fit, movement, and the resized pack’s handoff.

## Generated guardian pilot: Cistern-Keeper

The first non-humanoid candidate is the desert's Cistern-Keeper. The reference
prompt is `prompts/cistern-keeper-reference.txt`. The character skill now routes
non-humanoids to `.agents/skills/hiraeth-ai-characters/references/non-humanoids.md`.
No generated guardian asset has been accepted or integrated, and generated-mesh
animation is not yet verified. On 12 October 2026, the first Midjourney batch
(`6c582ac0-5269-4b03-9bb3-a7904c035635`, candidate 0) used text derived from the
procedural model but no existing art input. The user rejected that direction as
too far from prior references and insufficiently Moebius-like. A Tripo H3.1 job
(`5b827de1-92db-4924-8cbe-715ca3baec01`, 50 credits) had already been submitted;
it is an unaccepted experiment, not an integration candidate. Do not start more
Tripo jobs until the user explicitly approves a Midjourney reference.

The actual guardian artwork was subsequently found on `origin/main`, absent
from this October 8 checkout. The author's picks were added October 10 in
`b234a50f` and `e728c41c`. Canonical Keeper sources are
`references/guardians/keeper/sheet-1.jpg` (design views) and `sheet-2.jpg` (arena),
with generation provenance in that folder's `manifest.json` and prompts in
`docs/design/guardian-prompts.md`. All eleven guardians have dedicated sheets.
Use these boss-specific sources, not the previously suggested environment or
bird-rider sheets. The two Keeper sheets differ in proportions and shell details;
resolve the intended identity before combining views. Read-only copies from
`origin/main` at `517265054349832f54c6812d797d74eebf37e91e` are cached under
`output/character-tripo/guardian-reference-source/keeper/` for review.

After the user approved those sources, two image-conditioned Midjourney batches
were generated. The first combined the design sheet as an image prompt and the
arena sheet as a style reference, but produced stocky proportions and inconsistent
limb counts. The focused revision used only the design sheet and asked to extract
its third standing creature (`prompts/cistern-keeper-reference-v3.txt`). Candidate 0
of job `2af1aa1c-37b7-4842-a7d7-986d2666e828` is saved as
`references/guardians/cistern-keeper/reference-v3-1.png`. It preserves six distinct
legs, the tall ringed neck, ivory plates and rose belly. Its mouth is more open
than requested. The user approved this candidate on 12 October 2026 and requested moving to an
updated worktree before continuing. The subsequent Tripo test is recorded below.

The approved reference was tested in Tripo H3.1 job
`04b940f6-4bf4-4d3a-8fc2-46eb9b825670`: 50 credits, 50K target triangles,
4K texture, Remove Lighting on, PBR off. The untouched source under
`output/character-tripo/keeper-v3/source.glb` is 5,376,284 bytes, 47,220 triangles,
26,811 vertices, one mesh/material, no skin or clips. Six legs and a distinct
open jaw survive generation. The local `review.html` supports unlit, clay,
neutral light and the shared game ink renderer; albedo lighting neutrality is
not yet certified.

A further 20-credit **Other** auto-rig was rejected. GLB export has 27 skin
joints but missing rest transforms and effectively all vertices weighted to the
root. FBX retains 53 bones and more weights, but 29 bones have no vertex influence;
an isolated `bone_3` rotation visibly stretches unrelated legs. Preserve both
untouched exports and audits in that output folder. `review.html?rig=fbx` offers
isolated joint selection (0.45-radian Z rotation) to reproduce the defect.
A custom six-leg/neck/jaw rig is required before game integration. The 80 existing
temple, guardian-motion and guardian-twist tests passed; they are a procedural
baseline, not generated-mesh animation acceptance. This test spent 70 credits total.

The subsequent hosted **Walk** preset test also failed twice during retargeting
(tasks `df0c89e6-de6b-41c8-bdad-337826889062` and
`e1ec2729-18cd-4408-ae37-6e8f639b8562`), both with Tripo’s “Invalid user input”
error. No animation was produced; the balance remained 2,875 credits. This
confirms the service could not provide a working walk in this test; it does not
identify whether anatomy support or a service defect caused the rejection.

### Custom procedural animation pilot (12 October 2026)

`public/guardians/keeper-v1/model.glb` now contains a fitted 26-bone skin:
six independent thigh/shin/foot chains, body, five neck joints, head and jaw.
It is rebuilt from the untouched source by `node scripts/tripo/rig-keeper.mjs`;
the script checks the source SHA before applying this creature's measured anatomy.
`src/characters/keeper-fit.js` owns those measurements and smooth weight fields.
`src/characters/keeper-creature.js` binds it to the existing `GuardianLegs` and
`GUARDIAN_PLANS.keeper`, including independent supported footfalls, world-space planted feet,
body springs, turning lag and the encounter's telegraph frame. Measured segment
lengths override the kit's proportional defaults; existing callers keep their defaults.
Independent leg bones stay outside the body tell frame so its crouch/tilt does not
move a planted foot twice. The neck and jaw remain attached to the body.

Run the dev server and open `/tools/keeper-review.html`. Choose a motion, enter
seconds and press **Go** for repeatable paused poses, or **Play** for a continuous
cycle. Front/side/back/three-quarter, clay, unlit, neutral lighting and the shared
game G-buffer/ink renderer use the same rig. **Reverse light** switches to neutral
lighting. **Encounter controller** runs the actual boss controller against a dummy
player; its combat effects are hidden in this isolated material review. Walk at
2.4 s, stamp at 1.5 s, sweep at 1.3 s and open mouth at 3 s are useful checkpoints.

The first walk used synchronized tripods. After motion review, the generated Keeper
opts into the shared planner's `independent` mode: one lift per decision, at least
140 ms between starts, at most two non-neighbouring legs airborne. Other guardians
retain their original gait. A `flowing` arc has zero lift/drop endpoint velocity and
keeps its predicted landing fixed during the swing; planted feet still use terrain
samples. Lower foot clearance, a little more knee bend and more body damping remove
the high bob and near-straight knee snaps. Walk review speed is 0.9 m/s.

Sweep yaw now eases across strike/release rather than switching its amplitude in
one frame. Review attacks include recovery between six-second cycles. The preview
substeps simulation at no more than 1/60 s, caps render pixel ratio at 1.25, and only
resizes on CSS viewport changes (avoiding repeated resize with fractional pixels).
The visible FPS counter reports this browser, not a mobile/device performance claim.

The mouth is closed at rest with a measured hinge at source [-.411,.842,0] and a
1.04-radian closing rotation. The old weight boundary caught the upper lip while
missing part of the hanging lower jaw; changing only the closing angle exposed that
error. The corrected lower-jaw field leaves the upper muzzle fixed. Use **Jaw closed**
and **Jaw open** with **Head close-up** at the same time to inspect independently of
neck motion. Tests now assert actual upper-muzzle preservation and lower-lip rise,
not merely that vertices outside the assigned weights stay still.

The derived mesh is 2,969,532 bytes (source 5,376,284), with unchanged 47,220 triangles
and 26,811 vertices, one surface/material and a 2K JPEG texture. The texture's
estimated RGBA GPU storage including mipmaps drops from about 85.3 MiB at 4K to
21.3 MiB at 2K; device performance and LOD remain unmeasured. All motion is runtime
procedural; the GLB contains the skin, **no baked animation clips**.

`tests/keeper-creature.test.js` checks every vertex's bind roundtrip and normalized
weights, meaningful influence of all joints, isolated leg/jaw vertex displacement,
world-space foot targets during translated/rotated walking, reachable mouth poses,
finite deformation across all attack definitions, repeatable reset and real encounter
updates. Visual review covers walking, stamp, sweep and lowered open mouth from
multiple angles, with rear clay inspection. Evidence is in ignored
`output/character-tripo/keeper-v3/`. This was the animation pilot; since issue #267 the
Rose House fights it ("The Keeper in the Rose House" below). Full temple combat, fluid hits, final touch,
phase glow, mobile performance and lighting-neutral texture acceptance remain open.

The pilot was moved to the `codex/guardian-keeper` worktree after pulling main
at `8821ba5996eca5d75e2f564067be93a82a788f26`. Upstream renamed the character
skill to `hiraeth-ai-characters`; the guardian guidance is now merged into that
skill, preserving its newer validation requirements. The motion inventory below
was recorded in the original October 8 checkout; reconcile it against the
updated guardian controller, Keeper encounter and model; that reconciliation informed the custom pilot above.

The current model in `src/temples/guardians.js` has six hip/knee chains, five neck
segments, a head and opening jaw, body rise/tilt/sink, and shell glow. Its
replacement must retain the `Guardian` controller contract in `src/temples/boss.js`
and the gameplay definition in `src/temples/desert.js`: sleep, wake, moving fight,
stamp, sweep, burrow, open, weary, resolved, and reset. The mouth is a world-space
fluid target and final interaction anchor. Verify it after root translation,
rotation and jaw motion, including in the actual cistern arena.

Generation sequence: inspect one Midjourney batch for six distinct legs and
consistent anatomy; upload one accepted reference to Tripo; preserve its untouched
export and job identifiers; inventory the mesh and rig before selecting a custom
skin or articulated-part adapter. Do not use the traveller's MakeHuman fitting
coefficients. Existing temple tests establish gameplay behavior only; acceptance
also requires real mesh deformation and visual review in the game renderer.

### Its walk, its blows and its shadow (v1.69, issues #314, #315, #287)

The skin shuffled: `KEEPER_GAIT` now lifts its feet 0.17 of a leg (was 0.08; 0.15 in v1.69), a reach span of 21 % of the leg
(16 %; v1.71), on shorter, quicker strides (`drift` 0.17,
`stepTime` 0.24–0.4 s), the shell rides them on softer springs and rolls over them (`roll`), and it turns no faster
than its feet can step it round (`turn`, the wrapper's `turnRate`). Its blows land on its bones (`hitParts`), the lock
aims at its mouth (`lockAt`) and a contact shadow lies under it (`shadow`): docs/systems/foes.md, "The first guardian, fair".

### The Keeper in the Rose House (issue #267, October 2026)

The fitted skin is the Rose House's guardian now, in the temple and in the Arena's ring:
`src/temples/guardian-generated.js` `keeperGuardian()` is what `desert.js` and
`arena-guardians.js` build. The temple is built at once and the GLB arrives a moment later
(`loadKeeperV1`, loaded once), so the model starts as the procedural `keeperModel()` and the skin
swaps in under the same `Guardian`: the wrapper owns `pos`, `heading` and `mouth` (the fight's
targets and the water and touch prompts read them), its gameplay sizes are fixed for either body
(radius 2.9, height 4.4, mouth hit sphere 1.3, the old one's), and the phase marks the fight laid
in the old tell rig move to the skin's, remapped onto its narrower shell. The skin's group takes
the old one's place in the temple: the kit plans feet in the world through the group's own
matrix, so a body's group is never nested in another (nested, every foot was planted 2400 m up,
the height of the temples, and the legs stood on the creature's back). A failed load keeps the
procedural Keeper for good. The Unity bridge loads GLBs through the same loader from
`StreamingAssets/hiraeth-js/public`; `BridgeBuild.Common` copies `guardians/keeper-v1/model.glb`
(without it the bundle falls back too).

What changed on the skin for the fight: the shell carries the old body's calm glyphs (the makers'
sign laid where a ray from above meets the bind-pose shell, one mesh on the body bone, glowing
with the calm meter). At the fight's 2.2 m/s the one-foot-at-a-time gait could not keep up (a hind
leg was dragged straight behind, 7° of knee), so the planner takes a `fast` gait: the pilot's
independent steps at a walk, tripods above 1.4 m/s (back below 1.12), changed while every foot is
down; the homes sit a quarter of the way in under the hips, steps are a little longer and higher
(drift 0.3, reach 0.6, lift 0.08 of the leg) and the body 0.4 m lower. An independent brace not
begun within 0.3 s of a wind-up's lock waits, so no foot is lifting as a stamp lands. The motion
audit (`tests/motion-guardians.test.js`, "keeper (generated)", on its own bones through
`walk.mjs boneLegs`): slide 0.009 m/m, worst contact 0.03 m, knees 70° mean and 46° least,
tripods `[[0,3,4],[1,2,5]]` at the fight's pace, cadence 0.75 → 0.47 steps/s at half.
`tests/keeper-guardian.test.js` plays the fallback, the swap under a live fight, the tells
(each ≥ 1.2 s, #258) over planted hind feet, the glyphs, and the real cistern fight on the skin:
the guard's jar, a shot into its open mouth, the tank's water, a hand on its brow. The Keeper has
no second verb (#257's `asks` are other guardians'); the guard is its own.

Cost, procedural → skin: 40 → 2 draws a pass (the skin and its glyphs), 6,910 → 49,596
triangles, a 2.97 MB GLB and a 2K texture (~21 MiB on the GPU with mipmaps). Device frame
times are not measured yet.

The far tier's canned cycle (`gait.js canned`) left a swinging foot's `from`/`to` at its last
planned step: the body rides on them, so a temple guardian 160 m from you (2400 m up) sank its body
toward the ground under it and came back up when you neared. Fixed for every walker.

### Leg bones in their bend plane (`src/characters/creature-legs.js`)

The kit aims its rigid segments with the shortest turn from +Y (`ik.js aim`), which is
ill-defined for a segment pointing nearly straight down: a small change spun the Elder's thighs
and the Keeper's shins half a turn about their length in one frame (up to 180°; the wobble of
#237). `SkinLegs` frames each thigh and shin in its leg's bend plane instead (+Y along it, +Z
toward the pole the kit keeps fixed to the body) times the bone's own rest offset, so the bind
pose is exact; a planted foot keeps the heading it landed with and turns to the body's over its
swing; `curl` folds the toes about the ankle. Largest per-frame turn of a leg bone walking and
turning at 60 fps: 180° → 8°.

## Tripo character review experiment

### Tripo head replacement, 8 October 2026

The playable traveller now loads the approved H3.1 head-and-hair export from
`public/characters/traveller-v1/head-v2/model.glb`. This is a real replacement,
Tripo job `931197c2-0e35-40a7-82d6-051783349826`, generated from the original
character references. The untouched source, settings and hash are recorded in
`head-v2/provenance.json` (now `data/characters/traveller-v1/head-v2/`: head-v3 replaced it and, since issue #300,
the game no longer ships it); generation details are in `scripts/tripo/README.md`.

`src/characters/tripo-head.js` fits a clone at runtime (uniform scale 0.32,
offset [-0.001, 1.455, -0.006]). Only a throat cylinder inside the lower neck is widened to fill the scarf;
the hidden display foot is trimmed. A height-only flare initially caught the low
chin and pushed it forward by roughly 11 mm. The throat mask now excludes the
jaw, and low jaw vertices are weighted fully to Head instead of the neck blend. After clothing extraction, the old head
triangles and unused vertices are removed. The separate head uses the same
53-bone fitted skeleton and inverse binds as the body: the skull is rigid on
`Head`, with a smooth neck blend to `neck_01`. The body, hand articulation,
clothing simulation and equipment anchors keep their existing implementations.

The skull/hair shape is preserved. Six runtime shape keys move the lids, smile,
brows, brow tilt, asymmetry and lower mouth; corresponding normal deltas follow
them. The existing Humanoid expression, blink and TalkFace speech channels drive
these keys. Since v1.25 the face itself is drawn over the texture's painted one
(`src/characters/head-ink.js`, docs/systems/faces.md, "His face redrawn the
Moebius way"): the gaze moves only the drawn iris, so the two gaze keys are gone.
Speech adds a small shaded mouth opening in the new material. The old
`tripo-face.js` repaint is only retained for loading the original body without
a replacement head (legacy tests/tools), and never touches the new head.

The distributed GLB remains the **unrigged original export**; binding, neck fit,
shape keys and mouth ink are built by the game. This is a stylized surface face,
not anatomical eyeballs or an oral cavity. Large mouth openings remain a drawn
approximation. Character Studio (`studio.html?view=face`) and the live game use
this same integration. The isolated `tools/tripo-head-review.html` retains the
original unrigged study. Tests cover source preservation, removed old geometry,
neutral binding at arbitrary spawns, actual head-bone displacement, eye aperture
closure, speech and material cloning. Native engine facial shader parity has not
been validated for this new head.

Verification on 8 October, including the chin regression and latest main: 1,869 tests passed (`node --test
--test-concurrency=4 tests/*.test.js`), and Vite build passed. Browser checks
covered the Desert game, moving walk/jog poses, a seated head turn and expressions
in Character Studio. Screenshots are under `output/character-tripo/head-v2/`
(`integrated-main-character.jpg`, `integrated-walk.jpg`, `integrated-jog.jpg`,
`integrated-seated.jpg`, `in-game-desert.jpg`). The test game's Mute setting was
verified on before the remaining gameplay checks.

`/tools/tripo-review.html` is a local development preview of the generated coral-shirt character
without a backpack. `scripts/tripo/` fits MakeHuman arm joints to the generated surface before
transferring skin weights and exporting a matte GLB. The viewer uses the same fitted donor
and exercises game animations. Torso/ankle positions are still estimates, and hands and
extreme poses need review. See `scripts/tripo/README.md` for reproduction and limitations.

Regeneration outputs remain local and ignored by Git. The accepted v1 snapshot is now
shipped as the default traveller (see above); the review remains available for further
iteration. Facial expressions and more natural extreme poses remain unfinished.

The Tripo review separates the original textured lower shirt from a regular simulation cage
(`tools/tripo-cloth.js`), with fixed-step constraints, hip/leg collisions, and a plain lining.
It reconstructs connected upper trousers with a shared crotch seam, exact lower-leg boundaries,
and a continuous hip/thigh weight field across the repair. Collision axes follow the trouser
volume rather than the rearward donor joint centers, avoiding an inflated back. An opaque
inner-shirt backing closes missing geometry exposed above the waistband. Front/side/back walking and raised-knee jogging poses were visually checked.
The rebuilt trousers have simpler detail; sleeves remain skinned and seated poses still
stretch excessively. The preview's Next pose control advances and settles repeatable poses. Drag-to-orbit, zoom,
pan, reset and body-part focus controls support inspection. Live hand poses use a reduced thumb
(`TRIPO_REACH`) because the generated thumb only approximates the donor rig; the fingers take the
full poses from their straightened rest (*His fingers curl toward his palms* above). Jogging
still exposes unnatural hem stretching.
Cloth is runtime-only; the downloadable GLB has no simulation. `scripts/tripo/audit-cloth.mjs`
checks numerical stability and collision-capsule clearance, not complete mesh intersection.

The review's **Game style** toggle (`tools/tripo-render.js`) reuses the game material G-buffer,
Moebius print composite, fine character shadows and FXAA. It preserves texture/cloth repairs
and swaps only rendering materials, retaining camera and animation state. Lighting is fixed
for comparison; world-specific looks and atmosphere are not loaded.

Walk/jog arm styling narrows the source clips without changing elbow bend. The Seated preview
uses the driving clip for body/legs, but places hands palm-down over the thighs with two-bone
IK and aligned forearm roll (`tools/tripo-walk.js`), rather than reaching for a steering wheel.

Digit fitting now precedes weight transfer; `scripts/tripo/audit-hands.mjs` checks all 30
joints for meaningful influence and actual mesh displacement. `src/hands.js` derives an
incoming-segment curl axis for terminal phalanges on leafless rigs, which were previously
skipped. Hand pose diagnostics expose open, relaxed and fist poses; full contact grips still
need refinement on the generated mesh.

## Cloaks over the arms (October 2026)

Hands and arms poked through capes: Bako's and the Speaker's arms lay over their cloaks, Nour's hand hung on
the outside of hers. The cloth kept out of each collider by its nearest way out, so a cape falling from the
collar inside the arms stayed under them, and the hands had no colliders at all. Now:

- **The hands are colliders** (`CAPSULES` in `src/humanoid.js`: wrist to the middle of the fingers, measured
  on each body as the others are).
- **The cloth goes over the forearms and hands** (`CAPE_OVER`; `cape.js` `OVER`). Seen from the body's upright
  line through the feet, a forearm shades a wedge in toward the body; cloth in that wedge (or in the arm) goes
  out to the arm's far side, and so does cloth up to `OVER.reach` (10 cm) beside it. The cloth is coarse (10 ×
  8 points), and a face between two points either side of a hand otherwise ran through it.
- Not the upper arms (lifting the shoulders' cloth pulled the front edges onto a robe's legs once hung), and not
  seated: the hands rest in the lap, and lifting the cloth over them stood it out over the seat.
- Not the back panel's cloth (`Cape.backCol`: the columns within 45° of straight behind at rest): it only goes
  round an arm, as round any limb. Nour stopping short in front of you swung her cloak on forward over the
  forearms that hold her staff, and lifting the back's cloth out over them kept it lying in front of her, a sheet
  held out at you (October 2026, issues #59 and #64). The engines' cloth does the same (`engine/cape-job.js`,
  `BridgeCape.cs`: the description's last `cols` numbers).
- **The ambient wind never blows a cape out in front of its wearer** (`behindWind`): the part of it toward the way
  they face is turned to blow behind, so whoever stands with the wind at their back has it streaming behind or
  beside them. Their own motion still swings it. `tests/cape-behind.test.js`.

Measured in the studio on MakeHuman bodies (the share of hand and forearm points with the cloak between them
and the body, idle / walking / talking): Bako 84 / 71 / 51 % → 0, the Speaker 65 / 64 / 51 → 0, Nour 41 / 31 /
33 → 0, Ama and Hessa talking 42 and 31 → 0. Seated people still rest their forearms on the cloak in their
laps. `tests/cape-arms.test.js`.

**From the front, the chest pieces stay in sight** (`tests/cape-front.test.js`: the share of the pieces facing
you that the cloak covers). A cloak may hide every chest piece from behind; from the front, where the sheets
draw them, it must not. Bako's satchel lay inside his cloak's left edge (31 % of it covered); a piece worn over
the cloak now has capsules the cloth goes *under* (`BODY_BULK` in `src/costumes.js`, the bag and its strap;
cape.js `OVER`, a collider's `under`), so the bag lies on the cloak (5 %; three-quarters 21 %). Nour's gourds and
keys 0 % (three-quarters 12 %), Hessa's keys 0 %, Ama's fringe 1 % from the front; three-quarters the cloak's near
edge crosses the keepers' hips (no sheet draws them), and the test holds only the sheets' pieces there.

## A second carried slot and leg pieces (October 2026)

- **The back** (`BACKS`, `look.back` in `src/costumes.js`): a piece carried on the back, in the chest frame
  behind the body, beside the held prop. With `look.stow` it is the held prop put away: while walking (faster
  than `STOW_AT`, 0.3 m/s, `src/npc.js`; the studio does the same) the held and the slung pieces swap
  (`Humanoid.stow`: each is its own mesh, built only for such a look), the hand lets go (`hands.js npcHands`),
  and the cloth colliders follow: the held prop's `PROP_BULK` while in hand, the slung piece's `BACK_BULK`
  while on the back. Sefa's oud hangs on its strap over her cloak as her sheet draws her walking (`under`: the
  cloth goes in behind it; it hangs a cloth's thickness out from the back's own collider, since further in the
  two pushed the cloth back and forth and the cloak flew open); Marrow's pack moved from his chest piece to his
  back (a cape would go over a pack). The oud is one model (`oudParts`) carried two ways (`slung`), its tassels
  hanging straight down from the pegbox either way.
- **Leg pieces** (`SHINS`, `look.shins`): built in a shin frame (the knee at the origin, the ankle at
  `-len`, `r` the shin's measured girth, `segmentGirths`), rigid on each calf bone, so they follow the legs.
  Marrow's wrapped shins: a bulky wrap from the ankle to under the knee, wound in bands, its end tucked in
  (`FIXED.linen`).
- Named people only (no tribe draws them), so the crowd's figures and their packing are untouched.
  `tests/desert-props.test.js`.
- **Bako's bag, as his sheet draws it**: no longer a dark box on a thin strap but a big soft canvas shoulder bag
  (`FIXED.canvas`) slouching at his left hip over his coat, its flap folded over the top with a toggle on its
  edge, on a wide flat strap across the chest and over his right shoulder (`softBox`: a box rounded toward an
  ellipsoid and sagging below; `strapRibbon`: a flat band along a path round the body). Its cloth colliders are
  two flat capsules across its width, so its inner side meets the body's own collider: from the front 0.2 %
  of it behind the cloak, three-quarters 1 %.

## The desert's own pieces (October 2026)

Four held props (`ney`, `oud`, `hook`, `bellstaff`) and three worn ones (`satchel`, `fringe`, `keys`),
with a `braidcap` head, drawn from the Desert's character sheets (docs/makehuman.md). They go to named
people only, never into a tribe's weights, so the crowd figure never bakes them. `bellstaff` is the
kit's `staff` and `bell` reused rather than copied. Every held prop needs an entry in `PROP_GRIPS`
(`src/hands.js`) or `tests/hands.test.js` fails. The chest pieces outgrew sixteen: `BODY_ID_LIMIT` is
32 and `src/crowd-shader.js` reads the prop from 512. Marrow's hand-cart is world geometry, not a
piece: it stands in the camps (`src/desert-city.js`) at his pitch.

A second pass (docs/makehuman.md, "The rest of what the sheets draw") added `gourds` and `scavbag`
(chest), `discstaff` (held), the bell staff's streamers, the oud's tassels, and two small systems:

- **Bells on a cape's hem** (`src/cape.js`, `bells` / `BELLS`; a look's `capeBells`, drawn from no random
  number so nobody else's look changes): one small mesh, a child of the cape's, so it is in the cape's own
  space whether the cloth is simulated (world), hung (the anchor's) or carried between updates
  (`follow`); each bell is placed on a hem point along the cloth's fall there, every time the cloth's points
  are written (`ringBells`). `tests/desert-props.test.js`.
- **Bulky held props push cloth** (`PROP_BULK` in `src/costumes.js`: capsules in the hand frame;
  `Humanoid.propCapsules`, added to `capsules()`): the oud's bowl and neck, so Sefa's cloak swings round
  it instead of through it. A cape baked round one has its own drape key (`~oud`). The radii cover the
  bowl's rim, not just its depth: the cloth's faces between points cut a little inside the colliders.


## Quest reference outfits

`src/characters/quest-looks.js` selects a consistent design from the first standing
figure in sheet 0 of each `references/<world>/characters` set. It covers 46 existing
human characters in the ten quest worlds after the Desert. The Desert retains its
existing bespoke outfits. Stable story ids are retained even when the sheet names
differ (Kesh, Jot, Rue, Linnet, Emrys, Robin). Lore-only subjects such as the Major,
Odile, Talo and the departed bird rider do not introduce new encounters.

`namedLook` applies those canonical colours and proportions; `quest-pieces.js`
provides the individual head silhouettes, tunics, padded suit sleeves, tools and
worn equipment. Humanoid binds them to the same bones on MakeHuman and Quaternius
bodies. The costume cache includes reference identity so shared base hats or grips
cannot share another character’s geometry. Existing robes and capes keep their
animation and cloth simulation. These are procedural interpretations of the sheets,
not imported generated meshes; the game's face rigs and hand articulation remain.

Older levels attach names to already-created locals through `NPC.identify` when
story interactions bind. This applies the same reference look without replacing
routes, scale, body, or quest state. The Studio includes those locals and street
vendors in each cast. Wren uses the cab's `reference: 'wren'` option for her 991
plate and riveted patches; ordinary taxis retain their shared original geometry.

Validation: `tests/quest-references.test.js` checks cast coverage, both body
families' skin weights and moving tools, late identification, costume isolation,
and Wren's trim. Review full-body cast sheets and walking/seated poses in
`studio.html?lineup=cast&world=buried&source=makehuman` (change the world as needed).

## Prominence: the crowd a step quieter (October 2026, v1.42)

The author: "most world characters should look a bit less colourful so that the quest and main characters really
stand out". Every look carries a `tier` (`PROMINENCE` in `src/costumes.js`), applied to its clothes (`TIER_COLOURS`:
cloak, cloth, legs, hat, accent; never skin, hair or eyes) after the whole look is drawn, so no random draw moves and
nobody changes shape:

| Tier | Who | Clothes |
|---|---|---|
| `background` | the crowd (`crowdLook`) and the pooled bodies it lends them | saturation ×0.66, at most 0.4, lifted 16% toward a pastel lightness |
| `local` | a spawn spot's walker without a story (`NPC` with no `def`) | ×0.74, at most 0.46, 12% |
| `named` | a story person (the default for `namedLook`) | as the story colours them |
| `quest` | anyone with a reference look (`QUEST_LOOKS`, the family: forced), Tansy and the shopkeepers (`tier: 'quest'` on their defs) | as drawn |

The colours are moved in sRGB HSL, the hue kept, so a background person wears the same palette as before, softer.
A story person's def can set `tier` to move them. Lorn has no crowd (all its people are named), so it does not
change. Test: `tests/prominence.test.js` (the tiers' order; hue kept; in Qanat, the Signal Market and Lorn the
crowd's loudest colours are below the story people's; reference colours kept exactly).


## Calm by the ship (issue #84)

The author, about to leave: "people around my ship are moving too much". Round the parked ship (`shipCalmZones` in
`src/npc.js`: 18 m about the hull, 16 m about the ramp's foot, set by main.js from `ship.restPos` and `ship.rampFoot`):

- **no strollers**: the crowd's walking routes are cut where they would run through it (`calm` in `buildPeopleSteps`,
  `src/crowd.js`; a procession's loop is left whole). Measured at load: the Underside had 3 strollers on 2 routes by
  the ship, the City During the Eclipse 1, now none; the other crowded worlds had none there already;
- **slower idles** (`SHIP_CALM.idle`, 0.55): anyone standing there, a story person (Marrow at the wreck, Qanat's
  gift-bearers in their half ring) or a crowd person close up, plays their idle at that pace;
- a story person on a route there walks it slower (`walk`, 0.7) and waits three times as long at each turn (`pause`).

Tests: `tests/ship-calm.test.js`.

## Gestures while people talk (issue #197, v1.61)

"During dialogs characters can be more emotive and take poses depending on the conversation." As someone says a
line, their body above the hips takes a gesture in the line's tone, from Mixamo's captured conversation clips.

- **The clips** (`public/anim/gestures.glb`, 224 KB, gzip 88 KB; loaded with the moves after the game starts,
  `loadMotionLibrary`): 29 Mixamo clips on the Y Bot rig, the author's downloads of 12 October 2026 (Acknowledging,
  Angry Gesture, Annoyed Head Shake, Arm Gesture, Disappointed, Excited, Sad Idle ×2, Shaking Head No, Standing
  Arguing (its first 10 s of 20.8), Surprised, Talking ×4, Thankful, Thinking, Waving, Yelling) and ten from the
  *Gestures Pack Basic* (being cocky, dismissing gesture, happy hand gesture, hard and lengthy head nods, head nod
  yes, look away gesture, relieved sigh, sarcastic head nod, thoughtful head shake; its acknowledging, angry
  gesture and two head shakes are the singles again, its weight shift an idle: left out). Table:
  `scripts/mocap/gesture-clips.json`; built by `node scripts/mocap/build-gestures.mjs --from <folder of the FBX>`
  (the pack read from `data/mocap/packs/gestures-basic.zip`, kept as the other packs are; the singles are not kept).
- **Retargeting**: as every captured clip (`scripts/mocap/fbx.js`, `retarget.js`: Mixamo's bones mapped onto the
  UAL skeleton the Animator plays, so one clip serves every body: the traveller, the people's MakeHuman and
  Quaternius bodies, the Tripo-fitted ones), standing (the root held at its mean), the head's own turn kept.
  Only the body above the hips is stored (spine, neck, head, arms, hands: 11 tracks): a gesture's own steps and
  bounces (Excited hops, Arguing steps about) would slide the planted feet. The hips' turn is folded into the
  spine's first joint, its twist about the vertical held within 23° (`TWIST`), so a bow or a lean from the hips
  still shows. Loops (the four Talkings, the Sad Idles, Thinking) have their last 0.4 s bent onto their first
  frame (they ended within 1° of it already). **Keyframe reduction**: each track keeps only the frames a slerp
  between its kept neighbours misses by over 0.57° (Douglas–Peucker; 26 % of the frames), each reduced channel
  with times of its own, in two views every channel shares (`scripts/mocap/glb.js` `keys`; a view each made the
  JSON half the file): 376 KB with every frame, 224 KB reduced.
- **The layer** (`src/talk-gesture.js`): `talkGestures.drive(animator, { speaking, tone, key, text, listening,
  seated })` from the conversation (`src/story/index.js`, beside the talking faces; `Dialogue.faces()` gives each
  page's `key` and `text`), stepped by the Animator itself (`Animator.layTalk`, after the mixer, before a petting
  or a flinch) and laid on by `overlayMove` above the legs, the head turning with it (`headW`, within `HEAD_TURN`).
  A new page picks a clip for its tone, never the clip that body played last; a one-shot plays to its end (one
  over 5 s from somewhere in it, 4.5 s at most) and a line still being said carries on with a talking loop; a loop
  lasts the line and 0.8 s more; each change crossfades (two layers at most, in over 0.3 s, out over 0.45). The
  one listening nods at 40 % of the other's lines (Acknowledging, Head Nod Yes or the lengthy nod, 0.5–1.2 s in,
  at 0.8). Only on foot and standing about: walking, the air, climbing, riding or a whole-body move (a kneel, a
  get-up) let it go. Seated: the arms and the head only (the back stays on the seat), at 0.75, the seated pose's
  arms lifted off the lap by the gesture's weight (`NPC.posture`). A whisper at 0.6; Excited at 0.8 (its fists in
  front of the belly came close to the slimmest body). `?gestures=0` switches it off, to compare.
- **The tone map** (`TONE_GESTURES`; every tone of `src/story/tone.js` has two clips at least):

  | Tone | Clips |
  |---|---|
  | neutral | Talking ×4, Arm Gesture |
  | happy | Happy Hand Gesture, Thankful, Excited |
  | playful | Being Cocky, Excited, Sarcastic Head Nod, Happy Hand Gesture |
  | sad | Sad Idle ×2, Disappointed |
  | tired | Relieved Sigh, Sad Idle, Disappointed |
  | solemn | Thinking, Thoughtful Head Shake, Lengthy Head Nod |
  | angry | Angry Gesture, Standing Arguing, Dismissing Gesture, Yelling |
  | shout | Yelling, Angry Gesture, Standing Arguing |
  | scared | Surprised, Look Away Gesture |
  | surprised | Surprised, Excited |
  | curious | Thinking, Arm Gesture, Talking |
  | whisper | Talking, Head Nod Yes |

  The words pick over the tone (`INTENTS`, read off the line's start): no, never, I can't, don't… → Shaking Head
  No or Annoyed Head Shake (angry: Annoyed Head Shake, Dismissing Gesture); hello, welcome, farewell, goodbye… →
  Waving; yes, of course, very well, all right… → Acknowledging, Head Nod Yes, Hard Head Nod; "thank you"
  anywhere → Thankful.
- **What it costs**: the layer's own time (`Animator.layTalk`) for three people in a conversation, one speaking and
  two listening: 0.014 ms a frame in Node; in headless Chrome on the Mac at the Handheld preset with the CPU slowed
  4× (the machine under heavy load) 0.13 ms; the people's whole update 1.06–1.10 ms without against 1.08–1.26
  with (noise). **The engine bridge** (Unity on the Xbox, the Retroid and the Deck; issue #264) loads
  `anim/gestures.glb` alone (`engine/game.js`: `attachMotion` on the clip library; no moves, walks or matching
  database, so the traveller's `locoMoves` stays off there) and the people gesture as on the web. Measured in the
  Unity bundle's VM (Node, the Desert, Ysa's conversation): `layTalk` 0.014-0.021 ms a frame for the two bodies
  talking, nothing out of a conversation (the layer is dropped once idle); the game's update 2.49 ms without against
  2.60 ms with over the same 190 frames (four runs each, within their noise), the world's build unchanged. The
  Xbox's script runs about 5× the VM's time on the Mac (its update ~12.5 ms at the desert spawn against ~2.5), so
  ~0.1 ms there while talking. `-js-off gestures` leaves them out, for a before-and-after on a device. In the Unity
  player itself (the editor's batch run on the Mac, Puerts' V8, the Desert, Ama's conversation, `-talk ama -bench 5
  -split`, issue #197): `layTalk` 0.018 ms a frame (`split.talkGestures`, a gesture laid on every one of the 1 043
  frames); the people's update 1.05 ms against 0.97 with `-js-off gestures`, the game's 2.68 against 2.49 (one run
  each). Its frames of the conversation (`-talk ama -talk-seq 12`) beside the web's: the same two-shot, the speaker
  in her gesture. The mouth on the syllables is the story's own talkFaces, as on the web; its face's ink (`uMood`) and
  the MakeHuman shape keys (op 19) reach Unity live (that two-shot shows her from behind).
- **Checked** in the running game (headless Chrome, the Desert, Marrow and the traveller, each clip held at six
  moments: no broken limbs, the feet where they stood, the hands in front of the body; Disappointed turns the
  head away and down, as captured). Tests: `tests/talk-gesture.test.js` (every tone mapped, every clip in the file
  and looping as listed, the words' picks, never twice in a row, a conversation's crossfades and nods, the clips on
  the traveller, MakeHuman and Quaternius bodies: the feet within 1 cm of standing still, the hands off the
  trunk's line, the face within 95° of the chest; seated; let go walking; nothing without the clips; the cost).
- **Provenance and terms**: docs/motion-data.md ("Mixamo").

## The family (October 2026, v1.7)

The traveller's family wears one canonical look each, from the user's selected single-view designs in
`references/levels/Home/characters/` (provenance: `references/batches/2026-10-09-selected-family-currency-ship-sword.json`;
the earlier exploration sheets are not used). `src/characters/family.js` holds them: `FAMILY_LOOKS` (colours
sampled from the images, hair, robe, boots, face and mood, and the pieces' `kit`), `FAMILY` (the story's body
fields: kind, age and years, scale, Lou's child morph and face) and `DOG_LOOK` (Moustache's colours).

| who | where | the look |
|---|---|---|
| Father | the recordings' hologram (busts), the studio's home cast | slate-blue coat to the knee, open over a rust vest, cream shirt and navy roll-neck; charcoal trousers, brown ankle boots; short grey hair, clean-shaven, a long lined face; his flight cap in his hand |
| Mother | the recordings, the studio | cream tunic to below the knee, slate trousers, soft brown boots; a long teal scarf lined in coral wound at the throat, its ends down her front; the oval recorder at her belt; silver hair in a low bun |
| Lou | home (`src/story/home-data.js`), the homecomings | golden-yellow tunic with two coral patch pockets and a striped collar, rust-red trousers, tan mid-calf boots; chestnut hair with a fringe in two messy bunches; a folded drawing in her hand |
| Ilen | the Lantern (`src/story/lantern-data.js`), home after the true ending (`ILEN_HOME`) | a long faded-teal coat lined in coral, open over a cream shirt; a narrow tool belt, two pouches and a trowel; charcoal trousers, tall boots; dark hair in a low bun |
| Aunt Tove | home (on the garden bench) | heavy build; a lavender shawl over the shoulders, its point at the front; olive undersleeves, a dusty-blue tunic to the shin under a pale apron; indigo trousers, brown boots; silver bun |

**How it is wired.** The story data spreads `FAMILY[id]` into its people (they keep their words); the hologram's
`PEOPLE.father` / `.mother` are built from it too (on MakeHuman, the elder body of their years:
`templateFor`). `namedLook` asks `familyLook(world, id)` first (home and the Lantern only), so the look is the
same wherever they appear and nothing is drawn at random (no chance beard); the look's `reference` is
`family/<id>`. `quest-pieces.js questPieces` hands those to `family-pieces.js`.

**The pieces** (`src/characters/family-pieces.js`). The MakeHuman bodies are light (about 70 trunk vertices
between belt and neck), so a piece laid on the trunk cannot follow its points: `Surface` casts a ray out from the
trunk's axis at each height and angle (48 × 48) to the farthest trunk triangle (no arm, head or shin corner;
the clavicles left out, so pieces stay off the shoulders), and `surfacePatch` lays a grid on it a few millimetres
out, at least as fine as that grid (a coarser piece over a finer one cuts across the folds and sinks into it).
Each vertex takes the skin weights of the nearest trunk vertex, so the vest, lapels, scarf, shawl, apron bib
and belt bend with the spine. Held things (the cap, the drawing) are in the hand frame; Lou's bunches in the
head frame.

**The robes** (`Humanoid.robeGeometry` options, from the look's `robeOpen`, `robeLining`, `robeRole`,
`robeHem`, `robePanels`): an open front (the legs between the coat's flaps), a lining just inside it, panels laid
over it (Tove's apron). Linings and panels use the robe's own row heights, so a lining never cuts out through
it. A robe without these is unchanged (test). **Boots**: `SHINS.ankleboots`, `midboots`, `boots` (a leather shaft
up the shin, the body's foot in the boot colour, `look.boot`). **Collar** (`look.collarUp`): the outfit shader
paints skin above the neck line, which on MakeHuman bodies bared the tops of the shoulders; the family's line
is raised to the neck (the NPC's body material and the hologram's).

**Checks**: `tests/family.test.js` (each look's colours, hair, age and parts; every scene's people use them;
both body families skinned to the trunk and following it; the open coats' gap and lining; the dog's legs and
poses). Comparison sheets (reference, front, side, back, walking, talking) are in
`changelog-media/1.7/family-ref-*.webp`. Known limits: the faces are the game's procedural faces shaped toward
each drawing (long, lined, strong nose; Lou round with small level eyes), not the drawings themselves; Ilen's
grey streaks, the mother's slate undersleeves and the father's lapel pockets are not modelled; the hologram
shows the parents as the elderly designs even in the oldest recordings; robe fronts swing with the thighs, so a
hand can touch the skirt.

### Moustache, the dog (`src/dog.js`)

The selected design (a lean, long-legged, sandy wire terrier, a long white moustache and beard, white brows,
one ear folded) is modelled in flat vertex colours; his legs are on the locomotion kit
(docs/systems/procedural-animation.md, plan 6's `dog` table). Behaviours as before (follow, sniff, sit, bark,
petted, lie), now posed on the kit: sitting moves the hind feet's homes in under him and tips the body back
about the shoulders; lying moves the forepaws ahead and the hind paws aside and lowers the body; sniffing drops
the neck and head; the tail is three links on springs (the root swings with the wag, the tip lags); the ears flop
on springs. Measured with `node scripts/motion-audit/run.mjs moustache moustache-hurry`.

### Reference quality review

The character creation skill now includes procedural fit and enemy attachment review in `.agents/skills/hiraeth-ai-characters/references/procedural-quality.md`. Reproduce the screening captures with `scripts/character-quality-shots.mjs` and `scripts/enemy-quality-shots.mjs`; outputs and coverage are under `output/character-local/quality-pass`. These are review aids, not automated visual acceptance. Full-body sheets fit current posed bounds including tools and headwear. Padded seams follow their torso surface, lantern poles have explicit hangers, local transforms preserve anchors, and replacement headwear retains body-family beard behavior.


Review record (2026-10-08, `codex/quest-character-rebuild`):

- 48 cast sheets: 12 Studio casts (77 entries, including supporting people), idle/front, walk/side, seated/rear and talk/three-quarter. The 46 reference-driven looks are procedural interpretations, not exact imported likenesses.
- 25 crowd sheets: four seeded bodies per playable world, walking. This samples each world's costume family; it does not exhaust every random combination.
- Three traveller views: idle, walk and run. The Studio's seated story pose only affects NPCs, so it is not evidence of seated traveller support.
- 58 enemy views: all six foe families in idle/wind/strike and all ten guardian builders in idle, representative attack wind-up/strike, and open states. Saved `coverage.json` and `enemy-coverage.json` record the exact captures; `index.html` and `enemies.html` display them.

Repairs found through inspection: floating lanterns and lamp stems; separated balanced stones; a misplaced wizard-hat orb; pack cones transformed about the wrong origin; padded seams outside the torso; missing procedural beards; Nima's short hem; Wendel's obscuring headwear and Hollin/Robin's mismatched mushroom additions; detached wing roots and machine/guardian joints; shared mutable enemy warning materials; and shade inversion when recoil overwrote Euler angles after a quaternion turn. The shade regression exercises a complete turn including recoil.

The reviewed snapshots show these repairs working. They are not a guarantee of zero clipping across all frames, collision situations, cloth wind conditions, crowd seeds, fallback body shapes, or guardian attacks. Fine face details and garment volumes remain stylized approximations. The 100 world enemies built from those references afterwards are retired: the enemy roster's 21 archetypes replace them, each in its worlds' skins (docs/design/enemy-roster.md; foes.md, "The enemy roster"). The guardians are unchanged.

## Generated father (October 2026)

The father’s holographic recordings use `public/characters/father-v1/model.glb`:
25,220 triangles, a 2K colour texture and the game’s 53-bone skeleton. The approved
T-pose, untouched Tripo export, sampled vertex colours and generation provenance
are in `data/characters/father-v1/`. `src/characters/father-fit.js` fits this asset’s
forward-facing palms and all thirty finger joints; it does not change the traveller fit.

`src/characters/father-v1.js` builds independent instances and adds subtle runtime
blink/jaw morphs. The export contains skinning, but these morphs and the speaking
performance are supplied by the game. `Hologram` loads the asset asynchronously,
replaces any early procedural father and retains that fallback on load failure.
The texture passes through the existing hologram shader, bust clipping and scan lines.

The generated coat remains fused to the body. Below the waist the mesh follows the
pelvis rigidly, avoiding tears between trousers and coat in this stationary recording
role. This is not a walking NPC or a simulated cloth asset. Face motion is stylized,
not a phoneme rig. Painted crease/ink lines remain, although no broad directional
shadow was apparent in unlit inspection; opposite-light inspection changes shading.

Review locally at `tools/father-review.html` (unlit, matte, hologram; rest/idle/talk;
flat/relaxed/fist) and `cinematics.html#call.1` for the actual ship recording. Bind-pose,
independent-instance, texture, speech and all thirty finger influence checks live in
`tests/father-v1.test.js`. Browser review used the internal browser on port 5174.

The recording derivative is 1.50 MB (previously 4.56 MB), with 14,931 vertices
and one draw call. `scripts/tripo/slim-father.mjs` removes hidden geometry below
0.90 m and unused payload, retaining all surviving vertex attributes and skeleton.
The 2K colour map uses approximately 22.4 MB with RGBA8 mipmaps, versus 89.5 MB
for 4K. Full-body source stays in data; the reproducible full working rig is under
output. The review page can compare both. These reductions do not constitute a
measured mobile FPS gain. Budget checks live in `tests/father-v1.test.js`.

Motion correction: loose-coat slice medians had misplaced both shoulders, while
colour-based weight patches split neighbouring surface vertices. The father now
uses measured shoulder/chest joint centres and a continuous anatomical weight
field with a broad elbow blend. The mouth is at y=1.613 m and eyes at 1.682 m,
measured with the preview guides; speech displacement is zero above y=1.625 m.
Tests exercise 36 seconds of real idle/talk/idle animation, edge stretch and
upper-face isolation. Neutral clay and isolated mouth controls expose defects
that final hologram shading can hide. Crease lines remain from the generated
texture and mesh; reducing texture resolution changes cost, not that art style.

The speech morph also has a strict lower boundary at y=1.596 m; throat, scarf
and collar vertices remain unchanged. For the generated father, gaze adds only
a head turn: the procedural torso sway/turn and speech nod layer are disabled,
leaving the base clip responsible for body motion. Matched-time left/right gaze
regressions check torso/shoulder/neck world transforms and actual skinned chest,
scarf-base and shoulder vertices while requiring a real head turn. `char.head`
also retargets the neck, so father gaze is applied to `Head` after retargeting.
The skull blend ends below the jaw; the outer raised collar is excluded from the
neck core. The preview’s paused Gaze control switches direction without advancing
the base performance, exposing clothing shifts that a moving clip could hide.

The chin extends down to approximately y=1.575, so skull weights follow a sloping
jaw boundary, with the gaze pivot inside the neck at (0, 1.58, 0.035). The fused
neck's short transition still needs a shared runtime correction: 328 vertices use
interpolated gaze rotation and 16 passes of pinned edge/bend constraints. UV seam
duplicates share solver nodes. This keeps the jaw/collar boundaries fixed while
preventing the neck from collapsing under combined yaw/pitch. Positions reset from
rest every frame and when switching the review to rest; translated/rotated spawns
are covered. The exported GLB contains the fitted rig/weights; the correction,
like the face keys, runs in `father-v1.js` in both game and review. The review now
measures animation CPU time separately from render submission.

### Elder generated guardian review (12 October 2026)

The approved Elder reference now has a fitted 23-joint Tripo skin and runtime
animation in `src/characters/elder-creature.js`. `/tools/elder-review.html` runs
walking, turning, folded/spread wings, hovering wingbeats, the closed/open beak,
all Elder attack families and rest states. Its encounter mode uses the actual
Guardian controller and `ELDER` phases. No automatic humanoid rig or service
animation is used. See `scripts/tripo/README.md` for reproduction and budgets.

The independent leg frames follow measured two-bone IK, while shoulder/elbow/tip
chains and neck/head/beak/tail remain under the body telegraph frame. Airborne
motion suppresses the planted-foot body-height offset that would otherwise cancel
hover. Anatomical weight masks exclude the belly from the legs, the tail from the
wing roots, and the front neck from the beak; full-cycle edge checks caught each
of those failures during fitting. `tests/elder-creature.test.js` also exercises
all three real encounter phases, anchors, rest reset and closed-beak isolation.

Imported meshes may opt into softer per-material ink with `userData.inkLine` and
`userData.inkTint`; absent values retain the previous character renderer defaults.
The Elder uses these through the shared G-buffer adapter, preserving texture
linework instead of adding heavy black lines over every feather. This does not
remove painted lighting. Full temple integration, wind/vent interactions, final
touch, lighting-neutral albedo and device/LOD acceptance remain separate stages.


**Checkpoint status: prototype; the three reported defects repaired, not yet accepted.** User
review on 12 October found a turned face, wobbling leg joints and rigid extended legs in hover.
The repairs (issue #237):

- **The head.** The source skull and beak are turned 42° to her left on the neck (the jaw hinge
  axis was already measured turned). `ELDER_STRAIGHT` turns neck1–neck3 and the skull 8°, 12°,
  12° and 11° about their parents' up: the beak is within 2° of her heading, the head 0.08 m off
  her middle (0.28 before), the chest untouched, the neck's worst edge 4.6 cm longer. On top she
  looks toward you (`kit.eye`, ±0.55 rad on a spring, the last neck joint and the skull).
- **The legs.** The wobble was the shortest-arc frames above (a thigh flipped 180° in a frame),
  made worse by the source's two legs standing differently: each leg's bend plane from its own rest
  knee bent the two in different planes. Both bend in one mirrored plane now, the mean of the two,
  on mirrored homes; lengths stay each leg's own. The walk passes the motion audit's walker checks
  ("elder (generated)": slide 0.016 m/m, worst 0.05 m, knees 74°/36°, cadence 0.8 → 0.45), measured
  on the pad of each foot, not the tips of her long toes.
- **Flight.** The fight lifts her to her hover in one frame; she rises to it over about 1.5 s
  (`pose.alt`), her body drawn up from where she stood, wings beating, her feet planted until she
  is clear (the kit stands her on the floor under her, not at the hover), then hips, hocks and toes
  fold her feet up under her (the kit's tuck above 1, the toes curled 1.1 rad), and she comes down
  the same way, her feet let down and planted under her as she lands.

`tests/elder-creature.test.js` checks each (beak ahead and the gaze, mirrored planes and no leg
bone turning more than 11° a frame, the folded legs and the feet's skin drawn up, no body jump
across take-off and landing). Still open before she replaces the Aerie's Elder: a full-arena
review (vents, wind, hit effects, the final touch in the temple), the painted lighting in the
texture, device frame times and LOD. Tracked in
[GitHub issue #237](https://github.com/rnaud/hiraeth/issues/237).

### Traveller portrait head and cloth ink (issue #198, 12 October 2026)

The user accepted the generated head-v3 mesh and requested cleanup and integration,
including the grey hair highlights from the source. The canonical face is
[the hearted portrait](https://www.midjourney.com/jobs/0e2c1f43-d155-46f9-99c7-9b17585bd585?index=0).
[Lula dialogue 1](https://www.midjourney.com/jobs/87383b2b-3d65-440c-9f69-16e6d50142b7?index=0)
guides the clothing lines. The first local face-ink pass on head-v2 was rejected:
its eyebrows read as two strokes and its proportions remained too far from the
portrait. That face overlay is not used on the new head.

A Midjourney edit used the exact portrait as its sole reference, job
`45195791-bc77-4833-8cb3-ee565eb6da5e`. The user selected and hearted option 3
(index 2). The portrait supplies Tripo's front input; the selected turnaround
supplies left, right and back. These generated unseen views are interpretations.
Mechanical crops remove clothing and align crowns/chins without redrawing faces.
References, exact inputs, crop recipe and provenance remain under
`data/characters/traveller-v1/head-v3/`. The three approved original Midjourney
images (portrait, turnaround option 3 and Lula dialogue), prompts and job links
are also archived for browsing and future iteration in
`references/main character/Portrait study - 2026-10-12/`.

Tripo H3.1 job `3bdf5bce-cf91-4737-9dc9-be8b06c813c0` used fixed four-view slots,
Ultra Mesh, 50k target, 4K texture, Remove Lighting on, PBR and Generate Parts off.
One generation used 50 credits (2,825 → 2,775). The untouched source GLB is
3,617,184 bytes, 49,583 triangles, 32,852 vertices, one primitive/material and one
4096² JPEG, without rig, animations or morphs. Its SHA-256 and inventory are beside
it. `/tools/tripo-head-v3-review.html` still displays this source with unlit, clay,
opposing neutral lights and game ink, beside each reference. It creates no audio.
The source had lost most grey hair strokes, weakened nose/lip lines and retained
fixed chin hatching; world ink added duplicate painted contours.

`node scripts/tripo/prepare-portrait-head.mjs` makes the shipped derivative.
Positions, indices and UVs remain byte-identical; only skin normals are smoothed.
The atlas is reduced to 2048², sampled colours regenerated for native VMs, and a
connected hair attribute added. Grey strokes in the four approved drawings are
projected into a 1024² R8 UV mask, blended by view direction and padded across UV
island borders. The shipped GLB is 2,325,756 bytes; atlas plus hair mask use an
estimated 22.67 MiB decoded with mipmaps, versus the source atlas's 85.33 MiB.
Triangle count is retained for this close-view hero head; no extra draw call.

`portrait-head.js` fits the skull uniformly to the traveller and extends/flares
only the low neck below the visible jaw to meet the scarf. Skinning uses the
existing Head/neck_01 skeleton. The visible jaw remains rigid with the skull,
including combined pitch/yaw. Measured head-v3 eyelid, lip and chin landmarks
bound its six runtime face morphs and normal deltas. Speech leaves nose, throat,
hair and clothing still; gaze shifts native eye paint without moving skin. Blinks
close the original eye opening. Humanoid and TalkFace retain their shared contract.
The preserved and shipped GLBs remain unrigged: fitting, weights, morphs and
shader behavior are constructed at runtime. The mouth opening is drawn ink, not
an anatomical cavity.

The face shader preserves the generated eyes and continuous brows, reduces skin
colour variation, removes fixed under-chin hatching and writes nose/lip contours
to the existing detail channel once. Generic head hatching is disabled. The hair
mask blends near-black locks into muted grey strokes; these stay fixed to the
surface under motion, while world light still shades its volume. It adds one R8
sample and 1.33 MiB including mipmaps. `uPortraitHairAmount` supports a matched
on/off review. The shared loader wires this head into game, studio and motion
review; Unity's asset packaging includes the new GLB, colours and masks.

`data/characters/traveller-v1/ink/cloth-strokes.json` holds 20 measured surface
paths for collar, opening, sleeves, cuffs and scarf. They were traced on paused
studio views and raycast onto the actual rest triangles, not inferred from every
crease. `node scripts/tripo/bake-cloth-ink.mjs` bakes their surface distance into
unchanged UVs, including both sides of seams. `traveller-cloth-ink.js` loads the
2048² R8 mask (39 KiB shipped, 5.33 MiB with mipmaps). Body and moving overshirt
share it: one sample, no new geometry, draw calls or CPU deformation. Skin and
reverse lining are excluded. It writes the existing detail channel; mipmaps and
projected-size coverage keep distant marks from crawling.

The changelog has bust and Lula before/after pairs, plus a same-pose hair-mask
on/off pair. Before is the original face/cloth ink; after is the integrated head
and cloth mask. Bust settings and dialogue setup match across separate boots;
small conversation pose differences remain. Review uses the real G-buffer, world
light, ink composite and antialiasing. Startup and all audio buses were muted.
Numerical tests cover preserved source shape, neutral bind away from origin,
blink closure, unaffected speech regions, hero material cloning, TalkFace return
to idle and visible jaw/skull edge lengths through combined head rotations.
Final game-material captures also cover neutral/open/closed eyes and front,
three-quarter, profile and rear views. The shared studio played idle → talk → idle,
walking, jogging, running and sitting through several phases without browser
errors; the real Lula conversation was captured with all four audio buses at zero.

The accepted mesh is closer to the selected portrait, not an exact reconstruction:
nose profile, lower-face angles and some large hair locks still differ. The mask
recreates reference linework on the accepted locks rather than changing their
geometry. Native engine VMs skip the browser-decoded ink masks and retain sampled
vertex colours; their separate shaders do not yet reproduce the new ink treatment.
Bare-VM game boot passes with this fallback. Device-specific GPU performance
remains unmeasured. Reproduction commands and historical head-v2 notes are in
`scripts/tripo/README.md`; the current face contract is in `faces.md`.

### The face's ink (v1.63, issue #198)

The v1 portrait head kept the generator's face paint: blotchy baked shading, scratchy nose
marks and weak lips, which the world's light then shaded again. Against the approved front
portrait (`head-v3/reference/front.png`) the face now carries the drawing's own pen work:
one long side line down the nose and two short bridge ticks, the nose's wings and nostrils,
one stroke for the mouth, a short line under the lower lip and the chin's mark, the jaw
drawn against the throat with fine vertical hatching beneath it, over one flat skin colour
(the world's toon light gives the single shadow tone). The painted eyes, their lash lines
and the continuous brows stay as v1 had them; no new references were made.

- **The portrait's lines, lifted once.** `node scripts/tripo/bake-face-ink.mjs` samples the
  front reference through the same projection the hair mask uses (833 px a unit, crown at
  80 px), keeps dark thin marks and drops broad dark masses (hair, pupils, brows), the eyes,
  the brows, the ears' edge and everything under the jaw. It writes
  `public/characters/traveller-v1/head-v3/face-ink.png`, 512 × 584 over source-front
  x −0.25…0.25, y 0.05…0.62 (`PORTRAIT_FACE_INK.box`): red the lines that last (mouth,
  nose), green the finer ones (lower lip, chin, philtrum, bridge ticks, freckles). The ink
  is the reference's pixels, not a redrawing. The freckles are too light for the line
  threshold, so on the cheeks small round dots darker than the skin round them (a 5 px
  box mean, at most 6 px across: a shadow shape's edge is as dark but long) are kept at
  full strength; the nose's side line above its wings is drawn at 0.72 of the reference's
  darkness (it read heavier than the drawing's). Tests check every inked texel lands on the
  head's front skin and none on hair, eyes or brows.
- **On the mesh's own features (v1.64, issue #266).** The mesh Tripo made from the portrait
  does not match it: its nose is longer, wider and about 2.6 mm right of the centre line, its
  mouth lower, its lower lip fuller. Laid on unmoved, the mouth line sat on the upper lip
  (4.0 mm above where the lips part on average, 5.6 at worst), the nostrils on the nose's
  front (5.4 mm above its lower outline), the wings 2–3 mm inside their grooves and the lower
  lip's stroke 7.7 mm up on the lip. `scripts/tripo/face-landmarks.mjs` measures the shipped
  mesh in source-front space (front raycasts on a BVH, 0.26 mm steps): the nose's centre line
  (where its normal turns), the tip and the corner under it, the valley between the lips column
  by column and the corners where it fades, the grooves round the wings and the nose's lower
  outline, the lower lip's lower edge (its normal turned furthest down) and the hollow under it.
  The bake moves the portrait's own strokes onto them with a thin-plate warp through pairs of
  points (the mouth line column by column onto the parting, the wings' hooks onto the grooves,
  the nostrils 3 mm above the outline, the side line by the nose's centre line, the lip's
  stroke on its edge, the chin's mark 2 mm under the hollow), the eyes, brows, cheeks, freckles
  and jaw held where they are. The nostrils are baked 1.6 times as dark: on the nose's
  underside, sampled slantwise, they thinned out. Now the mouth is 0.1 mm off the parting on
  average (0.5 at worst), the wings within 0.2 mm of their grooves, the lip's stroke within
  0.8 mm of its edge. In rest space they ride the shape keys: on the morphed face of talking,
  happy, sad and angry the mouth line stays within 0.4 mm of the parting on average (1.4 at
  worst, talking).
- **The nose's side line on the nose's edge (v1.67, issue #276).** v1.64 placed the side line as
  far left of the nose's centre line as the portrait draws it (0.025 units, 6.6 mm). On this mesh
  the nose's front is narrow (its normal turns past x −0.55 only 3.4–4 mm out) and its side wall
  steep (normal x about −0.8), so the line lay 4–5 mm out on the side wall: foreshortened from in
  front it looked right, but from three-quarters and the side it ran down the middle of the
  shaded side, well behind the edge where the model's own toon shadow begins, and in profile
  down the cheek behind the bridge. `face-landmarks.mjs` now measures `noseSide`, each side's
  edge between the front and the side wall row by row (the normal's x past `NOSE_EDGE`, 0.55,
  smoothed over three rows), and the bake moves the side line onto it (four pairs, the
  portrait's line a straight fit, the edge smoothed over 0.015 so the facets put no kinks in it),
  the bridge's two hatching ticks moved with it onto the side wall and baked 1.8 times as dark,
  as the portrait has them: seen from the side they are the side view's strokes behind the
  bridge. In profile the edge is a millimetre inside the nose's outline and the line would
  double it, so on its own side it gives way as the view's z in the head's frame falls through
  0.34–0.16 (about 70–80° round: `PORTRAIT_FACE_INK.side`). Now the line is within 0.3 mm of the
  edge row by row, and within 0.6 mm of it on screen at every yaw to 75°
  (`tests/portrait-face-ink.test.js`).
- **Seen from the side.** Laid on from in front, a line on skin the view sees more squarely
  than the front does (the wings' grooves from the side) comes out wider, so the threshold
  rises with that ratio (`steep`: the view's dot with the normal over the rest normal's z, 1.15
  to 2.2, up to 0.82). The near nostril's outer end gives way once the view is 17–33° round to
  its side (`nostrils`), as a drawing hides it behind the wing (it read as a ring round the
  wing). `uHeadView`, the view's direction in the head's own frame, is set in the head's
  `onBeforeRender` on the material being drawn (the passes draw clones of it).
- **Drawn in rest space.** `wearPortraitHeadFace` samples it with the rest position's
  x/y, only where the rest normal faces forward, so it rides the blink, smile and speech
  morphs and never smears onto the underside of the nose or jaw. The lines go to the ink
  detail channel (over 1: a pen line), not the albedo, so the colour-edge pass does not
  outline both sides of them. The threshold rises with magnification (the lines narrow
  close up instead of growing into bars) and each weight fades in by the face's height
  on screen, as shown (divided by the pixel ratio, so the supersampled conversation
  portrait counts its own size): the major lines between 22 and 45 px, the fine ones and
  the hatching between 90 and 170 px. In a gameplay or two-shot view the face is under
  30 px and draws none of them.
- **The jaw from the geometry.** A front projection would fill the jaw's underside, so
  the jaw is the crease where the rest normal's y crosses −0.45, near the measured jaw
  curve y = 0.142 + 4x², 1.7 px wide, and only on the skull's side of the step back to the
  throat: measured on the mesh, the chin's front is at z ≈ 0.32 and the throat under it at
  0.14–0.17 (0.05 at |x| 0.12), so the throat is z < 0.2 − 0.3|x| (`throat`). That keeps
  the jaw one clean contour (the throat's own downward-facing top would otherwise cross the
  same normal value: a second, stubble-like line). The hatching is on the throat alone,
  below and behind the jaw, never on the chin or the jaw's underside: vertical strokes
  0.0085 units apart, darkest just under the jaw and gone 0.09 down the neck, darker in
  shade and still faint in light, as the reference always draws that shadow. Front-on the
  scarf covers most of the throat, so only a short band shows under the chin. From the side the silhouette carries the
  jaw and the crease keeps to the front and the jaw's corner.
- **Skin.** Within the face and everything under y 0.3 the source paint gives way to the
  one skin colour, except in the eye and brow zones where only near-black marks (lashes,
  brow hair) stay.
- **Cost.** 9.2 KB shipped, about 0.76 MiB on the GPU with mipmaps (RG8), one texture
  sample and a few dozen ALU ops on the head's single draw; no geometry, draw call or
  CPU work. `loadClothInk(url, 2)` reads the red and green channels.
- **Close-ups.** `pipeline.js setSubject` dropped the subject when the camera came within
  half a metre of the body's middle (the studio's close-up), and post.js then took the
  hero's fine ink out; the subject now stays, sized as at half a metre.
- **Native engine VMs** skip the mask like the hair and cloth masks (sampled vertex
  colours only); the Unity bridge's own ink shader would need the PNG decoded natively
  and this snippet (rest-space sample, normal crease, hatch) ported to show it.

Checked in the studio (front, three-quarter, side, close-up, face, bust, full and far, the
happy, angry and sad tones and talking) and in a Desert conversation (two-shot and his
portrait chip) against the reference; `tests/portrait-face-ink.test.js` (since #266 also each stroke against
the mesh's landmarks, at rest and in each expression).


### Elder natural-wing replacement (13 October 2026)

The user approved the four-view OpenAI natural-wing sheet in
`references/guardians/elder/reference-v3-natural-wings.png`. The front, true
profile and back are exact crops; the three-quarter image is only a cross-check.
The first multiview Tripo run and its free retry put frontal features on the
nape. With this asset, moving the left-facing profile from Right to Left while
keeping Front and Back unchanged removed that conflict. The reviewed source is
job `908b4352-b947-48e5-9502-d490428eb922`, preserved untouched as
`references/guardians/elder/source-v3.glb`; provenance and its SHA-256 are in
`tripo-v3-corrected.json`. No service auto-rig was used.

`node scripts/tripo/rig-elder-v3.mjs` reproduces the 23-bone skin from that source.
The mesh already faces +Z and has a centred frontal neck with a curved profile;
no corrective neck warp is applied. `elder-v3-fit.js` measures the new joints,
and `elder-v3-creature.js` applies that fit. Main’s separately maintained v1
checkpoint remains unchanged.
The lower bill is split and capped at its actual seam. Connected lower-body
surface islands keep the tail, legs and rear toes independent; proximity alone
had incorrectly blended neighbouring surfaces during flight tuck.

The shipped review asset is 2,657,108 bytes, 47,784 triangles, 28,724 vertices, one material/draw
call and a 2K JPEG colour map (about 21.33 MiB RGBA with mipmaps on the GPU).
The untouched source has 47,610 triangles and 28,540 vertices. Fifteen v3 tests
check actual skinned deformation, planted feet, head gestures, stable leg bends,
flight tuck/landing and closed/open bill poses. Front/back/profile and motion
were also reviewed in the game's ink shader in the Codex in-app browser.
`tools/elder-review.html` now loads v3. The rejected v2 derivative and failed test
are archived under ignored `output/character-tripo/elder-v2`, outside shipping.

The user approved the animated result and requested temple replacement. The
Aerie encounter, restored rooftop perch and Arena now use `elderGuardian()`
from `guardian-generated.js`. It shares the Keeper’s asynchronous wrapper: the
procedural fallback remains playable while the bundled GLB loads, or if loading
fails/stalls. No game startup awaits it. The model’s position, mouth target,
phase marks and gameplay sizes remain stable through replacement. Per-instance
materials are disposed on exit without disposing shared cached skin geometry.

`tests/elder-guardian.test.js` constructs the actual elevated Aerie and verifies
loading, shader/skin selection, flight tuck, calming by flying alongside, final
touch beyond body collision, resolved perch and disposal. The silent temporary
progress review is `/?level=arzach&guardianReview=elder`; audio is muted at
construction. The Keeper’s existing real-cistern tests still cover water, guard
and final touch. No changes replace its newer main-branch integration.
Texture-lighting neutrality and device performance: "The Elder, accepted" below (issue #237).

The live temple’s heavier shadow hatching obscured the authored feather ink,
which was clear in the isolated preview’s lighting. V3 sets a local material
shade profile (12% hatch, 25% shade lift, 80% hue retention) through
`inkShade`; it still receives world lighting, shadows and contours. The profile
is shared by the preview and gameplay. It does not alter the Keeper or other
characters. The v3 runtime stays separate from main’s v1 repair checkpoint.


### The Elder, accepted (14 October 2026, issue #237)

The rest of #237's checklist, on the live `elder-v3` skin (the Aerie, its crown perch and the Arena since 45599a95).

**How she was looked at.** `tools/elder-drive.js` is the review's motions (the review page, the sheets and the audit
share it): an attack runs as the fight times it (its own `wind`, `active`, `recover`; `view.move` as the fight hands
it over), from her guard. `node scripts/tripo/elder-sheets.mjs --out <dir> [--root <tree>] [motion…]` draws a contact
sheet per cycle (a column a moment; rows front, side and back in the game's ink, three-quarters in clay and unlit;
`--rows`, `--zoom`; `lod` / `lodFar` her levels side by side). `node scripts/tripo/elder-cycles.mjs [motion…]` measures
each cycle in node on the shipped skin: per part (body, neck, head, each wing, tail, each leg) the worst change of a
vertex's speed in a frame (a **pop** when it is over half the part's top speed), how far the part moves (frozen under
5 cm), the floor, and the tearing (the most a sampled edge is off its length, cm). Before / after: the peck's head
82 → 10 m/s in a frame, buffet 46 → 5, gale 47 → 10, feathers 47 → 3, dive 76 → 7, take-off 40 → 6, worn out 40 → 0.1
(a thigh flipping); tears: peck 30 → 12 cm, sleep 24 → 10, worn out 24 → 9, the fight 30 → 13; no pops left but the
stamp's foot stopping on the floor (its blow). `tests/elder-cycles.test.js` holds them.

**What was wrong, and what she does now** (`src/characters/elder-v3-creature.js`):
- **Her moves were the kit's and the fight's, not hers.** The kit's generic strike pose (a spring with `r` 1.2) jolted
  her whole body 0.4 m in a frame at every blow; the fight's tell rig reared her 0.8 m for the stamp and lifted her
  2.8 m for the dive (her legs tucked as if flying); the gale and the feathers were posed as the buffet (`pose:
  'buffet'`). Now her plan keeps only the kit's braced stance, `tellWeight` 0 (boss.js poseRig), and `ELDER_POSE` holds
  each move's wind-up (reached by 80 % of it, held) and blow (`ELDER_RAMP` 0.22 s after it leaves her); the links pose as
  their moves (`MOVE_POSE`).
- **The peck** stretches the neck out (`reach`: the lower neck forward, the upper back), tips her over her feet and lifts
  the skull against it: the beak 1.1 m up, 3.5 m ahead, 50° down (it was 128°: curled under her breast).
- **The stamp** raises her left foot alone (the kit's per-leg `lift`, `STAMP_FOOT` in the body's frame from where it
  stands), her body over the other leg, and brings it down faster and faster (an ease-in), wings flared.
- **Gale**: reared back, wings high, then hard beats through the blow (`gust`: deeper, quicker, on a wing phase of its
  own, so a change of rate never jumps). **Feathers**: spread wide and shivering, then flung forward. **Buffet**: cupped
  forward, clapped down. **Dive**: rises beating, then stoops, wings swept back, beak first.
- **States**: `restPose` (wake: head up, a stretch of both wings with a hiss, folded to her guard over `ELDER.wakeTime`;
  sleep, the bill bowed with the neck; worn out, hunched with her wings half open and panting; afraid and open, looking
  up, trembling). Her breath (`BREATH`, a period and depth per state), a ruffle every 6.7 s at rest, glances.
- **No target jumps**: every pose key on a critically damped spring (`ELDER_SPRING`; the blow's slightly underdamped), and
  a crossfade of the targets over `ELDER_FADE` 0.35 s whenever her move or state changes; her pose starts at her guard
  (a reset spread her wings flat for a frame).
- **Take-off and landing**: the fight put her 3.5 m up in a frame when her phase took her aloft; `Guardian.place` eases
  a body with `rises` (Hz) up and down (a jump over 6 m, a teleport, is still at once); her feet hang as her `air`
  eases in (they hung in a frame).
- **Turns**: `turnRate` 3 rad/s (she spun 12 rad/s to face you as a move began) and `turnAccel` 7 rad/s² (boss.js
  turnTo: from still to full speed over 0.4 s, her wingtips 13 m/s at once before).
- **The legs' frames**: each segment is framed about the leg's bend-plane normal (from the pole), not toward the pole:
  worn out, her lowered breast swung a thigh back along its pole and it flipped half a turn in a frame.
- **Deformation** (`elder-v3-fit.js elderWeights`, rebuilt by `scripts/tripo/rig-elder-v3.mjs`): where the tail hangs
  over the backs of the thighs the body holds them (`rump`: thigh and tail pulled one surface 4–5× apart as a foot rose);
  the skull over a wider band of the neck's top and the throat; a nod shared over the upper neck (`ELDER_NOD`: the skull
  alone tore the throat 60 cm open at the peck's blow); a fold shared along the wing (`ELDER_FOLD`, more at the elbow and
  wrist). Left: linear blending's own stretch round the rump in the tuck (15 cm in the hover and the dive) and the
  shoulders when folded (9 cm).
- **Anchors on her skin**: `part('wings')` and `part('feet')` are vertices of her skin as drawn (the farthest of each
  wing's last joint; the foot's nearest where it stands), skinned from her whole mesh's own arrays whatever level is
  drawn (the joints lay 0.43 and 0.26 m off her surface); the mouth rides the jaw (0.11 m inside the bill, the lock's
  target and the peck's hit sphere).

**In the real Aerie** (`scripts/bench/elder.mjs`, the game at `?level=arzach&guardianReview=elder`, the build served on
6237): 60 s of the fight on her skin, every move of all three phases seen (peck, peck2, buffetEnd, stamp, gale, diveEnd,
buffet, dive), 5 blows landing on the traveller, the fronts and the stamp's shock drawn where her body strikes, her phases'
take-offs eased. The combat review's guardian run (`.claude/skills/combat-review/guardian.mjs --ids arzach`): ok, as
before (every blow on her body, the lock on her beak). The calm by flight, the vents' wind, the final touch and the
perch: `tests/elder-guardian.test.js` (the elevated Aerie, round 5's new loop in it).

**Her colour map** (`scripts/tripo/elder-delight.mjs`, run by the rig script): Tripo's Remove Lighting left broad grey
shading and darkened creases; each pixel is sorted (softly, on its neighbourhood's colour: a hard sort patched the JPEG's
blocks) into cream, pink and tan; within each colour the slow brightness (a blur of that colour's pixels alone, so the
atlas's islands don't bleed) is brought 80 % of the way to its lit value, and creases 2–10 px wide are lifted by 60 %;
lines under 2 px, the eye and the pink wing ends (painted pink to mauve: their 5 % spread is not light) are left as they
were. The slow brightness's spread (10th–90th percentile over the median): cream 0.15 → 0.03, tan 0.14 → 0.04.

**Levels of detail**: `src/skinned-lod.js` takes any skinned body now (`{ model, char: { root } }`, its own `min` /
`max`): hers, `ELDER_LOD` cells of 1/16 to 1/4 m, 47.8k triangles whole, 32.5k, 18.4k, 6.8k (thin toes break up at the
last: only past ~120 m on Handheld, ~240 m on High, where she is a few dozen pixels tall). Only the game's skin
registers them (`lod: true` in `elderGuardian`). Cost: `docs/systems/performance.md`, "The Elder's cost".

## Traveller B3 body (13 October 2026)

The user approved the OpenAI B3 slender-young-adult proportions and matching left
and back T-poses, then the Tripo result. Inputs, source export and provenance are
in `references/main character/Body study - 2026-10-13/`. Tripo H3.1 job
`c8bf8b97-1dc1-420e-b81a-ed47e61ef479` used Front/Left/Back, 50 credits, Ultra Mesh,
50k triangle target, 4K texture, Remove Lighting on and PBR off. The untouched
source is 3,427,108 bytes, 47,161 triangles, 29,288 vertices, one material, no rig.

`node scripts/tripo/prepare-traveller-b3.mjs` creates the runtime files under
`public/characters/traveller-b3/`. The source shape is uniformly scaled to 1.75 m;
`traveller-b3-fit.js` records the measured 53-joint MakeHuman fit with 0.314 m
shoulder-pivot spacing and palm-forward finger chains. `rig-baseline.mjs
--traveller-b3` uses this continuous anatomical weight field, not the old body's
surface fit. The source has fused shirt/trouser seams: a hard cloth-color weight
override tore adjacent triangles. One continuous field avoids that tear; fingers
blend neighboring chain fields across their webs. All thirty finger joints have
measured influence and actual vertex displacement.

The rigged GLB is 2,812,392 bytes with the same geometry, 53 bones, one material and
a 2048² JPEG (about 21.33 MiB decoded with mipmaps). At runtime the generated head
is removed and the accepted `traveller-v1/head-v3` portrait is fitted uniformly
at scale .280 and offset [-.001, 1.487, -.006]. Its geometry, hair mask, face ink,
blink and speech driver are reused. The old body retains its original .264 fit.
`portrait-head.js` keeps the per-instance fit with the mesh so shader coordinates,
morphs and gaze agree. Each instance's render/face setup leaves the cached source geometry untouched. Final rendered geometry differs from
the raw body budget because the source head is removed and the portrait added.

Open `/tools/traveller-b3-review.html` on port 5174. This silent review uses the
real Animator/Humanoid/Hands and game G-buffer/ink/shadow pipeline. It includes
idle, walk, jog, climb, seated and bind poses, short motion crossfades, side/back
views, hand and collar close-ups, unlit/clay and opposing light controls. The
wrist driver maps measured palm/finger axes from the clip to B3 and shares the
final roll with the forearm once. The earlier fixed 90-degree correction shared
roll twice and did not align the anatomical axes exactly.

The hand repair restricts neighboring digit blending to the palm/web; distal
fingers have effectively exclusive chains. Each phalanx follows its own joint
until the next knuckle, avoiding rubber-like bending halfway along the bone.
B3 thumb roll/in signs and flexion axes are fitted to its palm-forward source,
with 65% of the shared thumb pose. Both hands can be inspected in open, relaxed,
fist and pointing poses, including paused T-pose; camera focus follows either
hand. Automatic hands resolve immediately when paused. Generated knuckle
geometry remains angular at close range; exhaustive prop-contact inspection remains pending.

Jogging reduces the neck control's forward pitch by 55%, weighted by the actual
jog crossfade. The skull keeps its existing world orientation and the torso keeps
its clip motion. This avoids moving the entire portrait forward with the source
clip's 35–50 degree neck lean. Tests cover the full jog cycle at a rotated spawn,
independent fingertip movement, palm-axis retargeting, thumb opposition and
repeatable finger poses.

Validation: `tests/traveller-b3.test.js` checks bind roundtrips at arbitrary
spawns, every digit's real deformation, and 24 phases each of five complete
motion loops. Worst sampled body edge ratios (>3 mm rest edges) were 2.29 idle,
2.69 walk, 3.49 jog, 4.57 climb and 3.28 seated-source loop; these bound tears,
not cloth quality. Browser inspection covered front/back walking, side jogging,
raised-arm climb, seated lap hands, fist in clay and head/collar profile. The
source texture and opposite lighting still need full final acceptance.

The user accepted B3 and requested it as the playable traveller. The canonical
`characters/traveller.js` entry now builds it in the game, title world, native
engine bridge, studio, motion page and trailer. The earlier v1 builder remains
for historical tools and regressions. The clothing and live integration follow-ups
below supersede the initial fused-shirt prototype. The exported rig GLB has no
baked clips, replacement portrait, reconstructed layers or cloth simulation;
those are assembled at runtime. Deep lunges and floor recoveries still stretch
the generated upper garment. Device profiling and exhaustive equipment-contact
inspection remain limitations.


### B3 full-library review and neck attachment follow-up

The review now uses `traveller-b3-motion.js` in both browser and mesh tests:
16 UAL game clips, 35 captured actions, 29 conversational gestures, 12 segmented
character walks and 108 segmented motion-matching takes (200 stored clips).
Nine additional scenarios call the game's actual procedural pose functions:
glide, hovering/flying with jets, treading water, breaststroke, crawl, front/back
flip and side hop. The two baked legacy clips in `anim/traveller.glb` belong to a
different old skeleton and are not runtime Animator inputs. They are not counted.
The selector groups every entry; Motion sheet provides 14 clay contact-sheet
pages with 15/50/85% phase controls. Cameras follow airborne/floor-level bodies
and the face/hand close-ups. These previews create no audio system.

The full audit samples 33 points through every clip/scenario (6,897 poses), both
body and portrait vertices, plus selected transitions. It writes the per-motion
report to `output/character-tripo/body-b3/motion-audit.json`. Isolated clip audits
use the same source tracks and full hip orientation for captured actions; they
are not a world-controller/contact/weapon-equipment acceptance test. Contact
sheets at 50% covered every stored clip, with extra early/late recovery poses
and individual animated neck/hand checks. Do not claim every rendered frame was
manually inspected.

This exposed excess trouser-centre stretching and head-attachment stretching.
The central upper trouser region now blends toward the pelvis instead of being
pulled entirely by both thighs. B3's skull pivot moved from the skull centre to
[0, 1.535, -.028] at the neck. Its head skin transition spans 1.450–1.523 m.
The inherited 32% neck-base flare is disabled only for B3, leaving the approved
face geometry unchanged. The original neck lining is retained inside the scarf,
its top tucked inward and its skin colour matched to the portrait in both
standard/unlit and game-ink materials. Removing that lining creates holes inside
the scarf, so it must not simply be cut away with the old head.

Deep lunges and floor recoveries still stretch the fused clothing. The numeric
limits guard against regression, not realistic cloth or exact prop contact.
B3 is now accepted for play; these deep-pose limitations remain visible in the review.

The old-head cut now ends at 1.515 m rather than 1.495 m, preserving the raised
coral rear collar. A mesh regression checks that those fabric vertices survive
unchanged. The neck lining tucks inward by up to 45%; the pale rear lining is
also matched to the portrait skin. Front and back idle and back jogging were
checked in the in-app browser. This is not a new open shirt design.

Review transitions preserve outgoing clip clocks. Actions and gestures clamp at
their final frame instead of wrapping non-looping poses (the held sword block
had produced a 35 cm mesh jump at its loop boundary). Play restarts a completed
one-shot. The seven selected transition pairs pass a per-frame continuity check.

Final validation on 13 October: all 209 scenarios × 33 poses passed the finite
vertex/deformation audit. Worst sampled edge ratios were 5.365 for the fused
body and 2.305 for the portrait neck, down from the initial 6.621 and 5.110.
These ratios are regression bounds, not cloth-quality scores. All 36 targeted
character/material tests and 22 changelog tests passed; the production build
passed. No browser warnings or errors appeared during the final collar check.

### B3 contextual fingers and walking clearance

The joint-influence checks passed while the review still sent only a generic
relaxed context to talking clips. B3 now passes speech strength, beat and tone
through the existing hand driver for Talk, all conversation clips, and the Talk
checkbox. Explicit diagnostic hand poses remain authoritative. The review keeps
looping conversation clips looping according to `GESTURE_CLIPS`; only one-shot
gestures hold their final pose. Finger drift follows the review time, and paused
poses reset lag/tightness so seeking or returning from a grip is deterministic.

`Hands.poses` optionally overrides a character's fitted pose angles without
mutating the shared pose definitions. B3 uses a more even resting finger arc,
less extra spread (its mesh is already fanned) and a thumb closer to the index.
Its speech pose opens the fingers more gently. Other bodies retain the shared
library, including full grip/fist/point articulation.

The original walk styling only narrowed arms and did not account for B3's trouser
width. B3 allows a small outward correction and keeps an 18-degree upper-arm
clearance in the walk. This preserves elbow bend and fore/aft swing, applies the
matching wrist rotation, and blends with the locomotion weight. The common
walk-style defaults remain unchanged for other characters.

A new regression poses the actual body mesh at 60 phases of the complete walking
loop and checks both hand triangle sets against the posed trouser/lower-shirt
triangles using BVHs. An initial 13-degree setting still failed at 18 hand/phase
pairs; the final fit has no intersections at those 120 checks. Speech regressions
measure real fingertip displacement, tone response, idle return, and repeatable
paused poses, with the held base torso unchanged. This does not certify equipment
contact or all the other clips' clothing intersections. Front and three-quarter
ink/clay views were checked at the previous collision phases for both hands.

The final hand follow-up passed all 34 targeted hand/character tests (including
the 209-scenario, 6,897-pose mesh audit), 22 changelog tests and the production
build. The final in-app preview emitted no warnings or errors.

### B3 cloth, side/back clearance and seated stability

The initial B3 preview had a fused skinned shirt: v1's cloth had not been ported.
B3 now uses `makeTripoCloth` with an explicit measured fit and the existing 90 Hz
cage solver. The lower coral panels are separated, ink-dark seam neighbours stay
with the panels, and the missing hidden waist/inner shirt are reconstructed.
The original textured trousers are retained beneath the moving shirt; only the
hidden missing waist is backed. Replacing their upper band exposed a differently
shaded repair and looked like a second pair of trousers. Newly cut edges interpolate bone
influences; selecting an endpoint's weights made tiny waist edges tear apart.
That interpolation repair also applies to the shared garment cutters.

B3's shirt attaches at 1.20 m with an 18 cm gradual skin-to-cloth transition.
Its cage ends at .825 m and its hip/thigh contacts use the fitted B3 proportions.
The hidden waist is narrower than v1's initial borrowed fit and tucked inside
the seated rear hem. Pinned normals and the ink treatment match the upper shirt.
Detailed per-vertex capsule projection is disabled for B3: it collapsed the
fused source's nearby inner/outer folds onto one surface, causing side/back
flicker and seated chatter. The collision-aware cage still drives the garment;
cloth is not frozen for the driving pose. Hand clearance comes from fitted arm
motion, not competing inward cloth forces. Walk/jog upper-arm clearance is now
22/38 degrees, with bounded outward correction and blended wrist orientation.

The B3 review uses the CPU garment path so tests can inspect the same triangles
that are displayed. The playable B3 uses the existing worker/GPU path (or native
cloth offload), with the same cage and disabled detail-fold projection. Mobile
profiling remains pending. The shared B3 motion driver
updates cloth after body, wrist and finger posing. A seek resets simulation;
paused frames preserve the settled cloth. Shirt physics and Underlayers switches,
and the Shirt / waist focus, expose these layers for review. Static motion sheets
show sampled poses, not a settled simulation of every action.

New regressions sample 60 phases after two warm-up cycles: both hands against
shirt/torso for walk, jog and sprint (360 hand/phase checks), and shirt against
reconstructed trousers for idle, walk, jog and drive (240 checks). All pass with
zero triangle intersections. A held driving pose settles below 0.025 mm maximum
vertex movement per 60 Hz frame in its final measured second. These bounds do
not certify prop contact, every extreme motion's cloth, or a seat/cockpit mesh.
The silent in-app review checks front, both sides and rear, in ink and clay.

The targeted character/hand/cloth checks include all 209 scenarios × 33
body/head poses. A procedural-cloth regression verifies that flight/swim setup does not reset
the solver through its intermediate idle pose on every frame. The review's cloth
is stepped once after the final procedural pose, preserving continuity.

### B3 default-body comparison

The body review now opens with a second, unfitted MakeHuman adult male body
beside B3. It uses the average macro settings (male, age 25, midpoint muscle,
weight, height and proportions), its own skeleton and the same clip catalogue,
clock, playback and hand controls. It does not inherit B3's fitted proportions,
neck correction or arm-clearance settings. Both are drawn at the same world
scale and camera depth; their heights are not normalized. The reference has no
traveller accessories and is shaded as a plain mannequin.

Default body toggles the comparison. Skeleton shows both rigs, Clay removes
texture distraction, and T-pose exposes proportions. Camera-relative placement
keeps the bodies side by side when switching to profiles/back or orbiting.
Motion sheets remain B3-only. This is a reference body, not a claim that the
stock body's every deformation is ideal.


### B3 opaque inner layer and bowed-head chest fit

The reconstructed inner T-shirt now spans .92–1.34 m, with a .155 m half-width
and .100 m half-depth. Closed end caps and matching torso weights maintain
coverage inside the original open shirt and retained trousers. A regression
checks closed edges and opaque material, then casts 1,920 rays through actual
skinned geometry over 96 idle/walk/jog/drive poses. This guards against seeing
through the torso; it is not a full collision audit of every outer-shirt fold.

The old height-only neck weights bent the upper chest with the bowed head,
reducing sampled front/back thickness by roughly 10% in Sad Idle. The rebuilt
B3 mesh now restricts neck influence to the neck base, with a smooth transition
into the collar and head. The ribcage keeps its shape without suppressing the
expressive neck motion. Both sad idles are sampled at 65 phases, checking five
actual front/back vertex pairs against a 2% depth tolerance. Side views in clay
with the default body comparison accompany this check in the interactive changelog.


### B3 playable integration and seated hands

The canonical builder preserves origin/rest binding even when the player spawns
far from the origin, and yields between build stages for title loading. The game
retains its glove, fluid muzzle, chest/tank and scout anchors, authored interaction
poses, and asynchronous body/head/cloth LOD generation. Per-vertex head colours
are loaded for the native renderer. Anatomical wrist alignment is shared between
clip playback, get-up, procedural flight/swimming and rides. Cab passengers use
the fitted lap reach; bike/skiff control-hand positions are left intact. Walking
arm and jog-neck corrections yield to aiming, climbing, mantle, swimming, flight,
boarding and scene overlays.

The seated hands initially intersected the moving shirt in 351 of 360 sampled
hand/frame checks. Their reach is now 72% down the thigh with 17.5 cm lift and
2.5 cm outward clearance. A B3-specific relaxed thumb in the seated `limp` pose
removes the remaining lap penetration. Three cycles (180 frames, both hands and
distal wrists, actual shirt/lap triangles) have zero intersections. The ordinary
cab pose is checked separately for palm orientation and fitted wrist targets.
The live Arena view confirms B3, equipment and worker/GPU cloth render together;
walk/run controls exercise the real Player updates. `?level=arena&characterReview=b3`
starts muted before audio construction and sandboxes progress. Its panel displays
master, music, effects and voice values; all were zero in the in-app browser.

Runtime budget for one near-camera hero: 60,264 vertices / 94,222 triangles across
body, portrait, overshirt, trousers repair and inner shirt; five visible base
material draws plus the cloth shadow and equipped items. The body/source stage
is reduced from the 3,427,108-byte 4K export to the 2,812,392-byte 2K rigged body;
its original head and hidden faces are cut at runtime. Body + rig + colour data
are 3,206,131 bytes; including the existing portrait, portrait colour data and
ink masks, the loaded character assets total 6,426,454 bytes (animations and
MakeHuman template shared separately). Both colour atlases are 2048²; hair is
1024² R8 and face ink 512×584 RG8, about 44.76 MiB decoded including mipmaps,
excluding geometry, skin palettes and render targets. This keeps the base hero
under the chosen 100k-triangle / 6.5 MB / 45 MiB texture envelope. Existing runtime
LODs reduce distant draws. No mobile-frame-time claim is made from the desktop
preview; on-device profiling remains outstanding.

Validation includes the 209-entry / 6,897-pose full mesh audit, walking/jogging and
seated triangle-contact checks, all thirty digit chains, sad-idle chest depth,
opaque inner-layer coverage, translated/rotated cloth, gameplay pose priorities,
GPU collision settings and cab palm targets. The interactive changelog saves
both the accepted review and actual playable-game evidence.

## The traveller in Blender (issue #493, not in the game yet)

The traveller as an outfit-swappable game character, made by a script so it can be remade:
`scripts/blender/traveller/` (Blender 5.2, run headless). The game still draws B3; nothing loads these
files yet. The author picks from the previews before anything is switched over.

    node scripts/blender/traveller/export-donor.mjs <work>/donor.json
    Blender --background --factory-startup --python scripts/blender/traveller/build_b3.py -- \
        --donor <work>/donor.json --out data/characters/traveller-v2
    Blender --background --factory-startup --python scripts/blender/traveller/previews.py -- \
        --blend data/characters/traveller-v2/traveller.blend --out <dir>

`data/characters/traveller-v2/` holds `traveller.blend` (the source, with the body's cage and the vertex
groups for authoring), `traveller.glb` (every part a named mesh on one skin, shape keys, UVs, B3's and
head-v3's own textures), `manifest.json` (the parts and their triangles, each material's palette key or
source texture, the body areas each garment hides, the bones, the sockets) and `previews/`.

**Phase 2: the look taken from the approved assets** (`build_b3.py`). The first pass modelled him
(`build.py`: lofted clothes, MakeHuman's face) and read as generic; this one reuses what was approved.

- **Garments: B3's own surface, cut** (`b3cut.py`). Each B3 vertex is labelled by its colour
  (`colors.json`) and where it is (coral: the shirt; cream above 0.965 m: the tee, below: the trousers;
  sand under 0.205 m: the boots; the neck band: the scarf; skin past the sleeves and at the ankles), ink
  lines take their neighbours' label, islands under 60 faces join their surroundings, and B3's split
  glTF verts are welded first so labels and seams cross its UV seams. The painted edges are ragged and
  the triangles big, so the cut is not along the triangles: each label's score is diffused over the mesh
  and the triangles are split where one label's score meets the next (UVs and weights interpolated),
  label by label. Each piece keeps B3's folds, collar, laced boots, UVs, texture (its own copy of the
  material, to tint alone) and B3's own skin weights on the 53 bones; each cut edge is turned in 4 mm
  (`lip`). B3's head and the neck lining above the scarf go.
- **Backing** where B3 has no cloth (it was fused): under the shirt, the tee's back and sleeves and the
  trousers' top are phase 1's pieces (`garments.py`), drawn 1 cm inside the shirt, in the B3 piece's
  colour, weighted from the body, joined to their B3 piece.
- **Head: head-v3** with its texture and painted eyes, placed and skinned as `traveller-b3.js` does
  (B3_HEAD_FIT; Head and neck_01 by `portrait-head.js`'s skull blend). The six game keys (`blink smile
  brow browTilt asymmetry open`) are `portrait-head.js`'s own formulas, baked as shape keys: as small as
  the game's (the game's shader draws the lids and mouth over them). Its hair (its hair mask's faces) is
  its own mesh, decimated to 9 k triangles; under it the head's hair faces sink 7 mm and go dark (the
  scalp), decimated alone.
- **Body:** phase 1's quad body (below), weighted by bone heat, then drawn in under B3's clothes as a
  smooth field (`inside_smooth`), in B3's skin colour. Dressed, the loader leaves out its hidden areas
  (`outfits.default.hides`, the previews do the same); his visible hands, forearms and ankles are B3's
  skin piece (`Skin`, kind `skin`).
- **Cost:** about 86 k triangles (head 17 k, hair 9 k, shirt 20 k, trousers 13 k, body 11 k), under B3's
  94 k as drawn; `tests/traveller-blender.test.js`.

**Phase 1's pieces, still used:**

- **One skeleton.** The game's 53 bones by their own names (`Root`, `pelvis` … `ball_r`), at the B3 fit
  (`traveller-b3-fit.js` through `export-donor.mjs`), so the clips, the hands' driver and the procedural
  motion need no mapping (`rig.py`). The game binds by name.
- **Body** (`body.py`): a quad cage lofted round the bones (the left half, mirrored), three loops round
  each elbow, knee and knuckle, four fingers and a thumb out of a ten-vert palm, subdivided once: every
  face a quad.
- **Body areas.** Every body vertex has an area (`_AREA` in the GLB, `area_*` groups in the .blend:
  chest, belly, hips, neck, and per side upperarm, forearm_upper, forearm_lower, hand, thigh, knee, shin,
  shin_lower, ankle, foot). A garment hides an area when it covers 97 % of it (a ray out along each body
  normal meets it within 10 cm; `covered_<garment>` groups); `outfits.default.hides` is the whole outfit's.
  A loader leaves out the body's triangles whose three verts are all in hidden areas.
- **Kit sockets:** empties on the game's anchors (`socket_chest`, `_tank`, `_sheath`, `_lantern`,
  `_star` on spine_03 in the chest anchor's frame, `socket_grip_l/_r`, `socket_head`; traveller-kit.md).
  The flask, the sword and the glove stay built in code and hang there.
- `build.py` still makes phase 1's all-modelled version (MakeHuman's head with eyes and brows apart,
  lofted clothes), not kept in the repository.

### Outfits

A new outfit is new garment meshes on the same body and skeleton; the body never changes.

1. **Model** each piece as its own mesh over the base body (or, as phase 2 does, cut it from an approved
   generated character: `b3cut.py`, labels by colour, a smooth cut, a lip on each edge) in its rest pose (T-pose), in its own layer
   (1 next to the skin, 2 over that, 3 outermost), never closer than about 5 mm to the layer under it.
   In `garments.py` that is a builder cut from the body's cage (`cut`: the parts and heights it covers),
   grown out (`inflate`), with its hems, cuffs and collar extruded, added to `SPEC` and `BUILDERS`;
   modelled by hand, keep quads and the cage's loops at the elbows and knees.
2. **Weight** it: a piece cut from a skinned source keeps its own weights; otherwise from the body: `rig.transfer_weights` (the nearest body verts' mix, then smoothed). Where
   a piece hangs away from the limb under it (a long hem, a cape, a skirt), give it a `sample` that reads
   the weights from where it hangs from (the hips), not from what it covers (the thighs). Then look at it
   posed (`previews.py --only posed`) and clean by hand where it pinches.
3. **Mask:** nothing to set by hand: the build measures which body areas each piece covers and writes
   them to the manifest. Check the list (an area only partly covered stays drawn); split an area in
   `garments.area_of` if a new hem line cuts one in two.
4. **Materials:** one per colour region, named for it, with its palette key in `MATERIALS` (build.py).
