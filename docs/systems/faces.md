# Faces, eyes, expressions and hair

How faces are drawn, how they talk and emote, eyes, hairstyles.

## Shader face (v0.28)
`src/face.js` draws sparse eyes, brows, nostril marks and a mouth in the head's
rest coordinates. The sculpted head supplies the silhouette; old fixed ink meshes
are hidden at runtime. Face materials have no image map. Each traveller owns
blink, smile, mouth-opening, brow and gaze uniforms, which remain live after hero
material cloning. `finishFrame` drives automatic blinks and exertion; the rig review
page exposes Blink and Smile sliders using the same GLSL. These shader expressions
are game-side and are not embedded into the GLB export.

Movement now uses separate acceleration and braking rates, prevents repeated foot
locks before lift-off, requires a wall hit to acquire a climbing hold, adds reaching
clearance, and releases ledge grips into the animation before standing.

## Flat printed outfit and Moebius face (v0.29)
The traveller GLB no longer contains an image. The generated body's painted
texture had baked-in shading and creases, so `scripts/flatten-traveller-outfit.mjs`
sampled it once per vertex and matched each sample to the reference palette in
`src/traveller-style.js`. It then removed small islands and wrote the zones as
`COLOR_0`. The script also relaxed the lumpy generated normals and removed the
5.8 MB image (9.0 → 3.8 MB). Run it last, after either merge script:
`node scripts/flatten-traveller-outfit.mjs input.glb public/anim/traveller.glb`.
In the game shader, blended vertex colours snap to the nearest palette ink, so
zone edges stay crisp. Equipment materials use the same palette by name.

Shadow and folds are drawn by the shader. `src/creases.js` places folds in
bind-pose space using the skeleton's real limb segments: chevron folds at the
elbows and knees, gathered elastic cuffs with pleats at the wrists and ankles,
pulls from the crotch and armpits, and the front zip. Fold arcs lengthen in shade.

The face (`src/face.js`) uses tapered pen strokes: almond lids with solid pupils
that close into a lowered arc, light brows, one hooked line down the nose, a
mouth with a lower-lip stroke and smile ticks, and a chin mark. Fine hatching
follows the shadow edge, and deep shade is left flat. Face normals blend toward
a head sphere, giving one clean terminator. Face cast shadows are sampled outside
the helmet, so the headphones cannot cut ragged shapes across it. The post pass
now draws the player's face and folds at full strength once the figure is large
enough to read; previously they were faded to about a fifth.

## Expressions and hairstyles

`src/expression.js` gives every dialogue tone an expression (`TONE_EXPRESSIONS`:
smile, open, brow, browTilt, squint, gaze) and `expressionFor(tone, { talking, t })`
adds the mouth's movement while speaking. `Humanoid.setExpression(e)` draws it:
the face ink (`uMood` / `uMood2` in `materials.js faceInk`: the mouth's corners
bend up or down, it opens into a dark shape, the bags and the nose-mouth folds
lift with a smile, frown creases, lines across the forehead), the brows'
geometry (`morph.js browPositions`: raised, lowered and drawn together, inner
ends up or down), the lids (a squint narrows them, `updateEyes`) and the gaze.
Neutral values draw the face exactly as before, so the game can wear the tone of
each spoken line when it wants to. Each person's materials are their own
(`Humanoid.ownMaterials`, as `NPC.restyle` makes them).

Hairstyles sit on the skull's own shape (`costumes.js scalp`, an egg fitted
to both bodies' heads, cut along a hairline over the brow, round the temples to
the nape) instead of the round cap that read as a bowl cut; the tribes wear them
(see below). *Hair* in the outfit list has **bare: their people's hair**, the
style the person's tribe would give their bare head. `tests/studio.test.js`
covers the URL state, the build entry, the morphs, the expressions and the hair.

## Hair, faces that talk, the traveller's face

- **Hair on the skull** (`src/costumes.js`). `scalp()` is a shell over the skull egg
  from a hairline: high over the brow, the temples' corners, lifted round the ears with a
  sideburn in front of them, down to the nape (`hairline`); thicker toward the crown
  (`crown`), lifted at the brow (`quiff`), lumpy (`bump`), or open at the crown (`top`, a
  tonsure). `curtain()` is hair falling from it round the back and sides, open at the face.
  The **hair cap** under every hat and most styles (`hairCap`) is a scalp now, so even the
  hats have a hairline under them. Seventeen styles (`HAIR_IDS`): `short`, `hair` (a
  topknot), `tail`, `long`, `bun`, `crop`, `shaved`, `bald`, `curls`, `braid`, `flow`,
  `locks`, `crest`, `bob` (with a fringe), `twin` (two buns), `swept`, `tonsure`. A style
  draws the shared cap and its own pieces (`parts`); a full body draws its own shape of the
  hair instead of the cap (`base`: the curls' knots, the quiff), the crowd figure keeps the
  cap, so its vertex count stays where it was (each world's figure: within a few vertices
  of before, `tests/costumes.test.js` keeps the budget).
- **Each people its own hair** (`tribe.hair: { m, f }`, weights). A bare head (`'hair'` or
  `'short'` in a tribe's `heads`, or a story person's) is drawn in the tribe's styles, a man's
  or a woman's (`hairstyleOf`, from the draw the look already made, so every other part of a
  look is what it was): close crops, curls and braids in the desert; swept hair, bobs and
  pinned buns on the City-Shaft's rim, ponytails in the middle levels, shaved heads at the
  bottom; tonsures in the bell monastery; crests and twin buns among the mechanics; long
  loose hair in the garden; bald heads and buns among the listeners; locks and braids in the
  swamp; curls, crops and braids in the market. The beard (`MASKS.beard`) is a shell round
  the jaw now, up the cheeks to the sideburns, the mouth clear.
- **The crowd shader** packs the head id as `id + 64 × hair cap` (`HEAD_ID_LIMIT`, was 32),
  so there is room for more styles; a world's figure bakes only the styles its tribes can
  give (`crowd.js worldPieces`), not the generic ones.
- **Faces that talk** (`src/talk-face.js`). While someone says a line they wear its tone
  (`expressionFor`), their mouth opening and shutting on the syllables the voice sings (the
  vowel sets how wide: `syllableOpen`; each syllable shuts as the next begins); after the
  line they keep the look a moment (`TALK_FACE.hold`), then ease back to their face at rest
  (`Humanoid.restExpression`); one tone blends into the next. `talkFaces.drive(h, { speaking,
  tone, mouth })` each frame, `talkFaces.update(dt)` once (main.js). Driven: the person you
  talk to (a story person or a crowd person's pooled body) and the traveller on his pages
  and when he answers (`Dialogue.faces()`: the conversation's syllables are timed on its
  own clock, `mouth(who)`, `answering()`), and the one villager within 12 m whose balloon is
  up (`NPC.balloonFace`, from the plan its mumble was sung with: `speakBalloon` returns it).
  During a conversation the traveller's eyes are on the other's face (`player.eyeTarget`).
  Everyone's materials are already their own (`NPC.restyle`; the traveller's by `markHero`),
  so a moving face costs a few uniforms a frame; `setExpression` re-poses the brows' geometry
  only when the brows move, and a face at rest is let go.
- **The traveller's own face** (`TRAVELLER.face`, `Humanoid.ownFace`): he is about
  twenty-six, so not the people's modelled face (long, hollow-cheeked, lined): fuller
  cheeks, a shorter lower face, a smaller nose, a softer brow, a wider jaw, larger eyes,
  hardly a line, a few freckles; at rest the corners of his mouth a little up
  (`TRAVELLER.rest`). His hair is his own (`travellerHair`: a short cut and a tousled fringe
  falling over the brow from under the helmet's liner). The studio shows him with it (its
  face sliders go on top of it).
- **The enamel star** (the box item `star`, `src/boxes/effects.js`) sat where the old hood
  was and poked out through the top of the bubble helmet; on the traveller it is pinned on
  the liner over his fringe, inside the glass (`TRAVELLER_STAR`).
- `tests/hair.test.js` (every style on both skulls and in the crowd, the hairline, each
  people's own set, story people, the 64-id packing, the parents),
  `tests/talk-face.test.js` (syllables, the tone on and off, the set of faces, a
  conversation's faces, the brows and the materials on a real body), `tests/traveller.test.js`
  (his face, his hair inside the helmet, the star inside the glass).

## Eyes: a white, an iris, a pupil, and blinking

People's eyes were solid ink: up close, each a black almond. They are now drawn the
ligne-claire way (`src/eyes.js`): a cream white, an iris in the person's own colour with a
darker rim, a round dark pupil and a small highlight, the iris following the gaze and the
lids closing over it to blink. One GLSL helper (`EYE_GLSL`, `eyeIris`) draws the iris for all
three kinds of people, and its detail goes with the size on screen: a few pixels across, the
iris is one dark dot on the white; smaller still the whole eye is one dark mark, so a face at
a distance (or in the 160 px dialogue portrait) still has eyes.

- **Colour**: `IRIS` (browns most, hazels, greens, greys, blues), `s.eyes` in `dressFor`, seeded
  by the rest of the look rather than drawn from its random stream, so every look (and a crowd's
  later ones) is what it was; a story palette may set `eyes`.
- **Full NPCs**: the human model's eyeballs are shaded by `MODE_EYE` (`materials.js`). The
  reshape narrows them and stretches them below the eye line, so `eyeballOf` records their
  centre and radii and the shader finds each point's direction on the round eye; the iris
  sits where that direction meets the gaze. `Humanoid.updateEyes(dt, target)` turns a world
  point into the eyes' bind space (through the head bone's skinning) and `EyeLook` aims them:
  clamped to the eyes' reach (`EYE_REACH`), a quick saccade rather than a drift, glances
  around when nothing is in reach, a blink every 2–6 s (now and then a double one). The model's
  lids open on the lower part of the ball, so the gaze is turned down by `EYE_TILT`. NPCs look
  at the player's face when near or talking (`npc.js`, only within 40 m of the camera); the
  lids are the person's skin (`NPC.restyle` sets the iris and the skin on their own copy of
  the eye material).
- **Crowd figures**: a small flat almond on the head (`CROWD_ZONES.eye`), the iris colour
  packed in `aBody.w` (`packBody`), a blink on the shader's clock per seed. The fragment shader
  draws the white and the iris only on those triangles.
- **The traveller**: the drawn face (`face.js`) keeps its lid strokes; `portraitEyes` fills the
  opening with the white and a slate-blue iris (`TRAVELLER_IRIS`, `uIris`) that moves with
  `uGaze`, ringed by a fine line once the face is large enough.
- `tests/eyes.test.js` covers the colours, the gaze clamping, the blink timing, the eyeballs
  and the aim through the skeleton, and the crowd's eye triangles.

## Faces drawn the Moebius way

The people's faces were a modelled head with a few faint marks and the same dense surface hatching
as everything else. They are drawn now the way Moebius draws a face in his ligne-claire work (Vael,
The Sealed Hangar, The Lodestar, Viridel): flat colour, one shadow tone, very few precise lines.

- **The ink** (`src/face-ink.js`, `FACE_INK_GLSL`, in `materials.js` for the people's skin,
  `MODE_OUTFIT`): pen strokes in the head's rest coordinates, placed by the face's landmarks
  (`uFace`, moved by the face morphs) and bent by the expression (`uMood`, `uMood2`), so they ride
  the skinned head. The eyes: a fine crease over the lid, a flick at the outer corner, a tick under
  the lower lid and at the tear duct. The nose: one line down the shadow side of the bridge into a
  hook round the wing (`uMood2.y`, the side turned from the sun: `Humanoid.updateNoseSide`), a
  lighter hook on the lit side, two dark nostrils. The mouth: a single line with a tick at each
  corner (level at rest, up with a smile, down when sad: see Warmer faces), a lower-lip tick, the dark opening; an arc over the chin.
  The ears: a curl round the rim and one inside. Sparse hatching that follows the face: the inner
  socket, under the brow's end, the hollow under the cheekbone (more on hollow cheeks: `uFaceKit2.z`),
  under the lip, a few dashes along the shadow's edge. Age lines by `lines`: bags, crow's feet, the
  folds from the nose, a cheekbone line; frown creases and forehead lines with the brow.
- **Young faces are drawn bare** (`faceYouth`, `uMood2.z`, on the skin and the eyes): an explicit
  `face.young`, else read from the face's proportions (a short lower face, big eyes, a small nose,
  a soft brow and chin, a big head), age lines taking it back. A child's face (home's Lou: 1) keeps
  light lids, a tiny nose hook, a short soft mouth and a few small freckles: no hatching, no folds,
  no bridge line, no forehead lines, no dashes at the shadow's edge; the traveller (about 0.57)
  keeps a little of each; every grown face draws as before. The brows are one flat stroke
  (`facePart`: no surface hatching inside them), and the shadow-edge dashes keep to a narrow band at
  the terminator (a face turned from the light is flat, not hatched all over).
- **Constant on screen, thinner with distance.** Widths are CSS pixels (a 1.3 px pen up close,
  0.7 on a small face); the detail comes in three steps by the face's height on screen
  (`FACE_LOD`): the mouth and the nose hook from 14 px, the small marks from 40 px, hatching and age
  lines from 90 px, and hatching only while its strokes are 3.5 px apart or more. On top of that
  post.js still thins a distant person's inner ink, so a far face is two eye marks, never noise.
  The face ink is written over 1 in `gHatch.b`: post.js draws it as a pen line (up to 0.92 ink),
  darker than the rest of the drawn detail.
- **Flat colour, one shadow tone.** No surface hatching above the chin (`FACE_FLAT_GLSL`; the neck
  keeps its own), none on the eyeballs. The head is lit as one rounded volume (`FACE_ROUND_GLSL`:
  the normals blend 0.72 of the way to a tall egg round the face, so the mouth and brow face
  forward), so its shade is one clean shape split down the nose instead of the low-poly mesh's
  shards; the ink pass sees the same rounded normals, so the facets draw no creases across it. A face's pixels carry a flag
  (`gHatch.a` + 16): post.js draws no line round its shade and no crease shading over it (the
  sockets are hatched instead).
- **Eyes** (`eyes.js`, `materials.js eyeball`): a crisp lash line along the lid's edge, heavier
  toward the outer corner, coming down with the blink; the iris a flat colour ringed by a pen
  circle, a round pupil, a small highlight.
- **Brows** (`humanoid.js taperBrows`): pulled to their own arched centre line, half as tall as
  modelled at the inner end, a fifth at the outer: one tapered stroke each.
- **Anyone can wear a face** (`NPC` options and spawn spots): `face` (morph.js `FACE_MORPHS`),
  `expression` (worn at rest: `Humanoid.restExpression`), `facing` (stand turned that way).
- **The studio**: a **Close-up** view (eyes to chin), **Lineup → every world's faces** (the
  traveller and a story person of each world; the crowd seed picks which), and **Share → Faces
  sheet**: each person alone, framed on the face, in a grid (`studio.sheet({ cols, w, h, view })`;
  `zooms: [1, 2, 4, ...]` draws the first person from further and further, at 1:1, each cell
  giving the face's height on screen: the distance ladder).
- **The Lab's faces gallery** (`?level=lab`, `LAB_FACES`): twelve giants (4x) in an arc facing
  the hub, every face variant (`FACE_PRESETS`, now in morph.js, and the traveller's) with an
  expression, men and women, and a walkway at the height of their faces (`FACE_WALK`), up a ramp,
  each one's face and expression written on it in front of them.
- `tests/face-ink.test.js`: the detail steps, the nose's side, the shaders, the uniforms on a body,
  the brows' taper, an NPC's own face and facing, the gallery (every variant, facing the hub, the
  walk solid in front of each face, the ramp).

## Warmer faces

The people read somber: long hollow-cheeked faces, heavy dark brows, half-shut lids, mouth corners
ticked down and a blue-violet shade over the skin. They stay ligne claire, but kind by default now.

- **A face at rest is a kind one** (`src/expression.js`): `PEOPLE_REST` (a slight smile, the brows a touch
  raised) is every body's `restExpression`, and each person rests in a mood of their own (`REST_MOODS`:
  kind, amused, curious, calm, stern), drawn from their people's odds (`costumes.js` tribe `moods`; most
  kind, amused or curious; the bell monks and the bottom of the shaft a little sterner; the two gate guards,
  Haro and Dov, stern by design: `look.mood`). A tone goes from there and back, so sad and angry still read.
- **Their face comes with their look** (`costumes.js faceFor`, seeded on its own stream so the rest of a
  look is what it was): a shape of their people's (`morph.js FACE_TYPES`: as modelled, rounder, longer, an
  elder's lines; few, as each is a warped copy of the body), their own age lines, mouth width and now and
  then freckles. `NPC.restyle` puts it on, crowd bodies too (the last face's brow copy is let go); a story or
  spawn face (`def.face`, `def.rest`) still wins. `FACE_PRESETS` are gentler, with a new *Kind* one.
- **The modelled face is gentler** (`humanoid.js reshape`): the lower face 17% longer, not 22
  (`LOWER_FACE`), lean cheeks instead of hollow ones, a lighter brow ridge, and the upper lids lifted off the
  irises (`UPPER_LID`; the eyeball's own lid rests out of sight under the rim, the eyes reach up less,
  `EYE_REACH`), so the eyes are open, with a clearer catchlight (`eyes.js`).
- **Brows** are a finer stroke (`taperBrows`), the hair's colour softened toward the skin (`browColour`), and
  the model's upper lashes, which the brow mesh carried and the taper pulled into a second heavy arc over the
  eye, are folded away (`LASH`).
- **The ink** (`face-ink.js`): the mouth's corner ticks are level or up at rest and go down only when sad
  (`MOUTH_CORNER`); a lighter lid crease; age lines start further up the range (an ordinary face is smooth,
  an elder's lined); the smile's own marks (crow's feet, bags, folds) only past the resting smile; forehead
  lines only past the brows' resting lift; less hatching in the sockets and under the cheekbones.
- **A warm shade** (`post.js FACE_SHADE`): a face's pixels (the skin, the neck under it, the eyes' whites)
  are shaded in the world's shadow tint's darkness turned to a warm skin tone, not its blue-violet; less so
  at night. The parents' holograms draw a lighter lid and a mouth a little up.
- `tests/warm-faces.test.js`; `tests/face-ink.test.js` checks the lashes are folded and measures the brows'
  taper across the stroke.

## The coral-shirt traveller's drawn face

The game's traveller is the Tripo body (`src/characters/traveller-v1.js`): one mesh with his face
painted into its texture and no expression rig, so he wore none of the tones. Choice (2026-10-07): a
face drawn in his body's own fragment shader, not morph targets or a retopologised head. The GLB stays
as it is, the paint's look is kept, and the cost is one box test per pixel of his body and four
uniforms a frame.

- **Where** (`src/characters/tripo-face.js`, `TRIPO_FACE`): in the head's bind space (`vBind`, skinned
  with the head as the paint is), measured off a front orthographic render of the painted texture. The
  centre line is x = -0.001, the eyes at y 1.6415 (x ±0.033), the brows from x 0.011 to 0.062 round
  y 1.66, the mouth at y 1.5805. Only in front of z 0.035, since the back of the head has the same x, y.
- **Covering the paint**: over each painted feature's oval, a pixel that isn't skin (more than ~0.03
  from the skin colour round it, sRGB as the texture holds it) is painted with that skin. The paint's
  soft edges go with it, and the skin's own pixels are kept. The lid band between brow and eye has a
  slightly darker fill.
- **Drawing it again, in the same hand**: thick black brows, square at the inner end and tapering
  out; an almond of white with a large dark iris, a pupil and a catchlight (dropped once the face is
  too small for it); a heavy upper lid line with a flick past the outer corner and a fine lower lid;
  a mouth line with corner ticks and a lower-lip stroke, which opens into a dark shape with teeth at
  the top. Widths are in metres with a floor of about 0.6 px, so the face still reads in a portrait
  circle.
- **The channels** (`tripoFaceState`, pure): `smile` turns the corners up or down, widens the mouth
  and lifts the lower lids. `open` drops the lower lip. `brow` raises the brows, or lowers them and
  draws them together; raised past 0.4 it also widens the eyes. `browTilt` moves the inner ends up
  (worry) or down (anger). `squint` brings both lids in. `gaze` and the eyes' own glances move the
  irises (clamped to the eye). The blink shuts the upper lid onto the lower one, which draws a single arc.
- **Plumbing**: `Humanoid.drawnFace` (set by `createTravellerV1`). `setExpression` passes the
  expression on, and `updateEyes` passes the blink, the squint and the look before `EYE_TILT`. So
  `talkFaces.drive` (the conversations, the moments, his answers) works on him unchanged. He rests
  with `TRAVELLER.rest` (a little smile). The uniforms are looked up on the mesh's material each push,
  because `markHero` gives the player copies of his materials.
- **Cost**: at the Handheld preset in headless Chrome on the Mac, the GPU time with the face on and
  off was the same within noise (about 6.9 against 7.1 ms over the normal follow camera). The CPU
  work is a few multiplies a frame with no allocation, and none of it touches the cloth worker.
- `tests/tripo-face.test.js` checks each channel on the state, the blink and gaze, and the shader's
  uniforms. On the real body it checks the expression, the blink and the talking mouth reaching his
  material, through `markHero`.
