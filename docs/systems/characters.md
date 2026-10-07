# Characters: the traveller, the people, costumes, capes, the studio and MakeHuman

The traveller and the people: bodies, outfits, costumes by world, cloth, the character studio and the MakeHuman bodies.

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
seated hems and tight hand grips remain iteration areas. The asset is about 10 MB
plus 0.9 MB of repair colour data; it has no character-specific LOD yet.

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
  (its meshes, and the anchors of the fluid's mouth and the hose's end: [traveller-kit.md](traveller-kit.md)).
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
pan, reset and body-part focus controls support inspection. Live hand poses use reduced finger
and thumb curl because the generated finger anatomy only approximates the donor rig. Jogging
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
