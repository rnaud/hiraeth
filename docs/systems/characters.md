# Characters: the traveller, the people, costumes, capes, the studio and MakeHuman

The traveller and the people: bodies, outfits, costumes by world, cloth, the character studio and the MakeHuman bodies.

The repository skill [moebius-ai-characters](../../.agents/skills/moebius-ai-characters/SKILL.md)
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

Validation: `tests/traveller-v1.test.js` uses the shipped asset to check binding,
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
  0.74 below the collar and as far back as the pack moved (the fluid tank and
  the scout's dock go there), `Humanoid.glove` is the fluid glove on the right hand
  (its meshes, the cuff's lit vial and the anchor of the fluid's mouth: [traveller-kit.md](traveller-kit.md)).
  `Humanoid.packPocket` (the rucksack's outer pocket; the radio pack until October 2026) shows
  until the flask is found and while it sits in a vehicle (`fluid-tool.js`); the scout docks on
  the rucksack's lid, then on top of the flask's left upright (docs/systems/traveller-kit.md).
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
- **Build** (`BUILDS`: slim, average, broad, heavy; women and men have their own odds).
  Full NPCs reshape their body mesh round its bones (`buildGeometry` in
  `src/humanoid.js`, cached per build; `Humanoid.setBuild` swaps it on a pooled
  body); the skeleton, head, hands and feet stay as they are, so headwear, masks
  and the foot planting still fit. Shoulder pieces widen with the build, robes
  measure the body they hang on, cape colliders grow with the girth.
- **Height** (`HEIGHT`: 0.85–1.15, a triangle round 1, women ×0.95) on top of the
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
at `/studio.html`, on GitHub Pages at `…/moebius/studio.html`, or from the title
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
  (`MOEBIUS_FACE`: a longer chin, lean cheeks under clear cheekbones, a long straight narrow nose, a
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
- The named people follow their character sheets (`references/The Desert/characters/`).
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

For a complete preview, open `studio.html?backpack=1`; the **Fluid backpack** checkbox uses isolated state and never grants items to the game save. The traveller and drone tests cover skin weights, garment fit, movement, docking clearance, and the resized pack’s handoff.

## Tripo character review experiment

### Tripo head replacement, 8 October 2026

The playable traveller now loads the approved H3.1 head-and-hair export from
`public/characters/traveller-v1/head-v2/model.glb`. This is a real replacement,
Tripo job `931197c2-0e35-40a7-82d6-051783349826`, generated from the original
character references. The untouched source, settings and hash are recorded in
`head-v2/provenance.json`; generation details are in `scripts/tripo/README.md`.

`src/characters/tripo-head.js` fits a clone at runtime (uniform scale 0.32,
offset [-0.001, 1.455, -0.006]). Only a throat cylinder inside the lower neck is widened to fill the scarf;
the hidden display foot is trimmed. A height-only flare initially caught the low
chin and pushed it forward by roughly 11 mm. The throat mask now excludes the
jaw, and low jaw vertices are weighted fully to Head instead of the neck blend. After clothing extraction, the old head
triangles and unused vertices are removed. The separate head uses the same
53-bone fitted skeleton and inverse binds as the body: the skull is rigid on
`Head`, with a smooth neck blend to `neck_01`. The body, hand articulation,
clothing simulation and equipment anchors keep their existing implementations.

The accepted neutral face texture and skull/hair shape are preserved. Eight
runtime shape keys move the lids, smile, brows, brow tilt, asymmetry, lower mouth
and limited gaze; corresponding normal deltas follow them. The existing
Humanoid expression, blink and TalkFace speech channels drive these keys.
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


## The family (October 2026, v1.7)

The traveller's family wears one canonical look each, from the user's selected single-view designs in
`references/Home/characters/` (provenance: `references/batches/2026-10-09-selected-family-currency-ship-sword.json`;
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

The character creation skill now includes procedural fit and enemy attachment review in `.agents/skills/moebius-ai-characters/references/procedural-quality.md`. Reproduce the screening captures with `scripts/character-quality-shots.mjs` and `scripts/enemy-quality-shots.mjs`; outputs and coverage are under `output/character-local/quality-pass`. These are review aids, not automated visual acceptance. Full-body sheets fit current posed bounds including tools and headwear. Padded seams follow their torso surface, lantern poles have explicit hangers, local transforms preserve anchors, and replacement headwear retains body-family beard behavior.


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
