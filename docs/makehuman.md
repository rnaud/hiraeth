# MakeHuman / MPFB bodies: a prototype next to the Quaternius ones

The question (TODO, "Faces and bodies"): would people built from MakeHuman read better than the
Quaternius Universal Base Characters the game uses, through the same ink pass? This is the
prototype that answers it: eight MakeHuman people on the game's skeleton, with face shape keys,
as a second body source in the character studio only. The game's own people are unchanged.

**Recommendation: switch, in stages, keeping everything above the mesh.** The bodies are the
clear win: a child, a teenager, heavy people and the old come out of MakeHuman as real bodies of
their age and build, where the Quaternius ones are one adult man and one adult woman stretched by
`morph.js` (Lou is a man's body with a 1.3× head). The faces read as more human and their
expressions move the skin itself (a smile lifts the cheeks, worry raises the inner brows), while
the game's face ink still draws them the Moebius way; they are less stylised than the reshaped
Quaternius heads (no long gaunt face, realistically small eyes that close to slits at a distance),
which MakeHuman's own face targets can bring back. Animation, feet, the motion capture and the
costumes carry over almost as they are, because MakeHuman's `game_engine` rig has the game
skeleton's bone names (the Unreal mannequin's). The skin weights are no worse (no better at the
elbows and knees, fewer pinched triangles at the shoulders and hips). What a full switch would take
is listed at the end. The real costs are file size (eight baked people are 6.4 MB against 1 MB) and
the hair and face fitting; both have clear fixes.

## Licences (what the sources say)

All the data in `public/anim/mh/` comes from assets their authors publish under **CC0 1.0
Universal**; MPFB's code (GPLv3) and MakeHuman's (AGPL) are tools here and none of their code is
in the game. The exact texts, as published on 2026-10-05:

- **MPFB** (2.0.17, from extensions.blender.org; repository
  <https://github.com/makehumancommunity/mpfb2>), `LICENSE.md`:
  > C. The license for the bundled assets
  > The assets are defined as any data contributing to the output from MPFB. This includes:
  > * The base mesh and proxies * Targets and modifiers * Textures * Clothes (any MHCLO-based asset)
  > * Rigs, poses and expressions * JSON data with mesh information
  > These assets have been released under CC0 1.0 Universal. In summary this means that to the
  > fullest extent possible, it is the intention of the MakeHuman team that anyone can do whatever
  > they want with it.

  > D. Concerning the output from MPFB
  > It is the opinion of the MakeHuman team that no output from MPFB contains any trace of program
  > logic. That is, regardless of whether you use the UI as such or if you call functions of MPFB
  > via a script (such as an addon that extends MPFB), what you get is a combination of assets and
  > your own creative input. As the assets have been released under CC0, there is no limitation on
  > what you can do with this combined output.
  > To make it clear, the MakeHuman team makes no claim whatsoever over output such as:
  > * Exports to files (FBX, OBJ, DAE, MHX2...) * Graphical data generated via scripting or plugins
  > * Renderings * Screenshots * Saved model files

  The source code part: "The MPFB source (as defined per the above) is released under GPLv3."
  `LICENSE.ASSETS.md` is the full CC0 1.0 legal code.
- **MakeHuman** (<https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md>) says
  the same for its bundled assets ("The base mesh and proxies, Targets and modifiers, Textures,
  Clothes (any MHCLO-based asset), Poses and expressions ... have been released under CC0 1.0
  Universal") and for output "regardless of whether you use the UI as such or if you call functions
  of MakeHuman via a script". It adds: "If you use a third part asset, such as one downloaded from
  the asset repositories, it is your own responsibility to make sure you abide by its specific
  license."
- The site's licence page (<https://static.makehumancommunity.org/about/license.html>): "All core
  assets are shared under Creative Commons, CC0. The effective consequence of this is that you are
  free to do as you see fit with the asset or derivates of the assets. You do not need to pay
  anything, include any copyright notices nor give attribution." The MPFB FAQ "Is it really free?":
  "There are in practice no restrictions on neither output nor bundled graphical assets (all core
  asset such as the base mesh, targets and skins are shared under CC0)".
- **The asset packs used**: `makehuman_system_assets` (every asset listed CC0, author
  makehuman_system: <https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html>;
  the files' headers: "This asset was explicitly released as CC0 in september 2020"), from which
  the low-poly eyes and the eyebrows; `faceunits01` (ARKit face units) and `visemes01` (Microsoft
  visemes), both by Mika Suominen, every target's metadata `"license": "CC0"`
  (<https://static.makehumancommunity.org/assets/assetpacks/faceunits01.html>, `visemes01.html`).
- **To avoid, or to credit**: the community asset packs mix licences. Some are CC-BY (attribution
  required: for example every one of the 21 hairstyles in `hair02`); others CC0. Each pack's page
  lists the licence per asset. Older pages describe a superseded scheme (AGPL assets with a CC0
  exception only for exports from the unmodified GUI: "no longer valid for MakeHuman 1.2.0 and
  later", <http://www.makehumancommunity.org/content/license_explanation.html>). Keep to the
  bundled assets and the CC0 packs above. `public/anim/mh/LICENSE-MakeHuman-CC0.txt` records the
  sources next to the files.

## The pipeline (no GUI)

```
scripts/makehuman/fetch.sh            # Blender 4.5 LTS (unpacked, not installed), MPFB 2.0.17 into
                                      # Blender's own user folder, the CC0 packs: .local-tools/makehuman/
.local-tools/makehuman/blender.sh --python scripts/makehuman/build.py [-- --only man --tris 12000]
node scripts/makehuman/skin-audit.mjs # the skin weights in the game's clips (below)
node scripts/makehuman/glb-sizes.mjs public/anim/mh/man.glb
node scripts/makehuman/measure-quaternius.mjs   # the numbers the bodies are fitted to
```

`build.py` runs inside Blender in background mode (`-b -noaudio`), MPFB's Python services driven
directly (`HumanService`, `TargetService`, `FaceService`), about 3 s a person. Each of
`scripts/makehuman/people.json`:

1. MPFB's base mesh (hm08) with the person's macro sliders (gender, age, muscle, weight, height,
   proportions) and any targets of their own (a belly, wider hips), the `game_engine` rig with
   MPFB's weights, the low-poly eyes and an eyebrow;
2. MPFB's T-pose for that rig, the arms then made exactly straight and level, the neck and head
   turned back until the face stands as the Quaternius faces do (chin-to-forehead 0.08 rad), applied
   as the rest pose (the game's bodies are bound in a T-pose: the outfit's regions, the costumes'
   frames);
3. the ARKit face units and the visemes loaded as shape keys and carried onto the brows (MPFB's
   MHCLO interpolation), merged left with right and cut to 20 (`smile, frown, jawOpen, browInnerUp,
   browDown, browOuterUp, blink, squint, cheekSquint, eyeWide, pucker, press, stretch, v_aa, v_E,
   v_I, v_O, v_U, v_PBM, v_FV`);
4. the helper geometry dropped and the body decimated from 26 756 to 12 000 triangles (Blender's
   Decimate, symmetric, the head weighted out of it: 4 500 of the 6 000 vertices are the original
   ones, so the face's shape keys stay exact; the rest take theirs from the nearest point);
5. the eyebrow cards cut to their drawn shape (the texture's alpha, the card twice subdivided): the
   game paints flat colour, a card would read as a strip;
6. scaled so the hips stand where the Quaternius man's do (0.971 m: the game's rig puts the pelvis
   there, every body is ~1.8 m in bind space and the root's scale makes the real size, `scale` in
   the manifest) and moved so the skull is where his is front to back (MakeHuman stands ~6 cm
   further forward; the face ink's rounded light is centred there); `head` renamed `Head`;
7. measured (the face ink's landmarks, the outfit's regions, the ears, the skull's egg grown until it
   holds the whole crown) and exported as GLB: no textures, no UVs, sparse morph targets, no morph
   normals. `public/anim/mh/people.json` is the manifest.

**In the game's code** (all of it only active for a template that brings a profile):
`src/makehuman/body.js` (`prepareMakeHuman`: the bones checked, the eyeballs measured for
`eyes.js`, a `profile` with the landmarks, outfit regions, ears, head frame, `headScale` for the
hair and the face keys); `humanoid.js` reads the profile instead of its per-kind tables (`FACE`,
`OUTFIT`, `EAR_Z`, the head frame `[0, 0.1, 0.01]`) and caches costumes per body;
`src/makehuman/face-keys.js` turns an expression (`expression.js`) into shape-key weights and leaves
the ink its share (`INK_SHARE`: the creases and forehead lines stay the ink's, the mouth's bend
mostly the skin's); `materials.js` draws morph targets for meshes that have them (`vBind` stays the
rest position, so the face ink rides the moving skin). The studio (`src/studio/makehuman.js`):
*Who → Body source: MakeHuman* (whoever is shown, on a MakeHuman body; *MakeHuman person*), and
*Lineup → MakeHuman next to Quaternius* (pairs, `&mh=child,man` for a few). The GLBs are left out
of the build the APK and the web bundle ship (`vite.config.js`, `MAKEHUMAN=1` keeps them): the
prototype runs from `npm run dev`.

## The people

| id | who | macro: gender, age, muscle, weight, height (+ targets) | real height | body / brows / eyes triangles | GLB (gzip) |
|---|---|---|---|---|---|
| child | girl, 7 | 0, 0.125, 0.5, 0.5, 0.69 | 1.24 m | 11 998 / 422 / 172 | 809 KB (363) |
| teen | boy, 15 | 1, 0.277, 0.45, 0.4, 0.71 | 1.70 m | 11 998 / 602 / 172 | 804 KB (364) |
| woman | woman, 28, slim | 0, 0.523, 0.5, 0.38, 0.55 | 1.65 m | 12 000 / 1 062 / 172 | 837 KB (381) |
| man | man, 35, broad | 1, 0.577, 0.68, 0.55, 0.6 | 1.83 m | 12 000 / 1 060 / 172 | 838 KB (378) |
| heavyf | woman, 45, heavy | 0, 0.654, 0.4, 1, 0.6 + stomach-pregnant-incr 0.35, measure-hips-circ-incr 0.4 | 1.71 m | 12 000 / 1 054 / 172 | 836 KB (380) |
| heavym | man, 50, heavy | 1, 0.692, 0.4, 1, 0.5 + stomach-pregnant-incr 0.6, measure-waist-circ-incr 0.5 | 1.72 m | 11 998 / 1 060 / 172 | 835 KB (380) |
| elderm | man, 76 | 1, 0.892, 0.3, 0.42, 0.42 + stomach-pregnant-incr 0.15 | 1.66 m | 12 000 / 282 / 172 | 792 KB (354) |
| elderf | woman, 72 | 0, 0.862, 0.35, 0.58, 0.55 | 1.62 m | 12 000 / 422 / 172 | 824 KB (362) |

(MakeHuman's own weight slider at its top is only moderately heavy: a body 15% wider and deeper at
the waist; the belly and hip targets on top give the heavy people the Quaternius *heavy* build's
mass, in a body's shape rather than inflated round the bones.)

Against: the Quaternius man 12 566 + 984 (brows) + 768 (eyes) triangles, 502 KB (279 gzip); the
woman 12 812 + 1 480 + 768, 524 KB (291). Of a MakeHuman GLB's 838 KB, 396 KB are the 20 morph
targets (the face's 4 500 vertices), 70 each the positions, normals and indices, 94 the weights
(floats). Loading and preparing one takes 4–7 ms in Chrome (the Quaternius ones 7–10 ms, with
their reshape).

## Side by side, through the same ink pass

All in the studio (`studio.html?lineup=makehuman&count=8`, *Share → Faces sheet*), the Desert's
light, the game's shadows and ink; each pair is the Quaternius body made to match (`like` in
`people.json`: kind, build, height, and for the girl Lou's own body and face morphs) on the left.

![Lineup](makehuman/lineup.jpg)
![Faces at rest](makehuman/faces-neutral.jpg)
![Happy and talking](makehuman/faces-happy.jpg)
![Sad](makehuman/faces-sad.jpg)
![The man's expressions](makehuman/expressions.jpg)
![From up close to across the street](makehuman/distance.jpg)
![Dressed by the costumes](makehuman/dressed.jpg)
![The clips](makehuman/poses.jpg)

What they show:

- **Bodies.** The variety is MakeHuman's: the girl has a child's proportions (head, short legs, no
  waist), the boy a teenager's narrow frame, the heavy woman and man real bellies and hips (the
  Quaternius *heavy* build is the same body pushed out round its bones), the old a thinner chest and
  softer shoulders. At mid distance (a figure 120–170 px tall) the silhouettes are where the
  difference shows; across the street (70 px) the two sources look alike.
- **Faces.** Through the face ink (flat colour, one shadow tone, few lines) the MakeHuman heads read
  as people of their age; the Quaternius heads keep their stronger stylisation (`reshape()`: long
  lower face, hollow cheeks, big eyes), which is closer to Moebius's gaunt figures but makes every
  adult the same face. MakeHuman's eyes are realistically small: at 50 px a face they are slits where
  the Quaternius eyes still read. That is a slider (the eye-size target, or the `eyeSize` face morph).
- **Expressions.** On shape keys the expression is in the face's shape: the smile lifts the cheeks
  and the mouth's corners, sad raises the inner brows, surprise opens the jaw and lifts the brows
  (the brows' own mesh moves with them). It reads at a glance where the ink-only expression needs
  the lines. Talking uses `jawOpen` and the `aa` viseme on the syllables (the other visemes are in
  the files, unused).
- **Costumes.** Every costume piece fits as it is (hats, masks, shoulder pieces, robes, capes, held
  props): their frames are bone-relative and the robe measures the body it hangs on. The hair needed
  the skull measured per body (`headScale`): MakeHuman's skull is flatter on top and fuller over the
  temples than the Quaternius egg, so the egg is grown until it holds the crown, which leaves the
  hair a little helmet-like on some heads.

**The skin weights in the clips** (`skin-audit.mjs`: per joint, the vertices blended between its
two bones; *girth* the mean distance to the joint against the rest pose's at the worst frame of
Walk, Sprint, Climb_Up, ClimbLedge, Jump_Start and Idle, 1 = the volume kept; *pinch* the share of
the joint's triangles squeezed under 40% of their rest area at that frame):

| Body | shoulder | elbow | hip | knee |
|---|---|---|---|---|
| Quaternius man | 0.89 (climb) / 42% | 0.72 / 40% | 0.83 (ledge) / 29% | 0.76 / 49% |
| Quaternius woman | 0.91 (sprint) / 35% | 0.64 / 48% | 0.78 / 25% | 0.73 / 70% |
| MakeHuman (8 people) | 0.85–0.86 (walk) / 5–32% | 0.64–0.71 / 20–83% | 0.75–0.79 / 10–20% | 0.68–0.73 / 17–63% |

Neither skeleton has twist bones, so both are plain linear-blend skinning with the same weak
spots. MakeHuman's weights pinch fewer triangles at the shoulders and hips (the classic candy-wrapper
places: 5–32% against 35–42%, 10–20% against 25–29%) but lose a little more volume there (its shoulder rest is a T-pose from an
A-pose model, so arms hanging down cost 15%); elbows and knees are alike. In the clips, at
full-body size, nothing tears or twists visibly on either.

## What a full switch would take

1. **One parametric body, not baked people.** Ship the decimated base mesh once with the macro
   targets as morph targets (age, gender, weight, muscle, height, proportions: a few dozen deltas
   over 6 000 vertices) and bake each person on load (CPU, once per look), as `buildGeometry` does
   now; quantise positions and morph deltas (`KHR_mesh_quantization`, which three reads natively).
   About 1.5–2 MB for every person the game can make, against 6.4 MB for eight here. The builds,
   `BODY_MORPHS` and `FACE_MORPHS` become MakeHuman targets rather than radial pushes and warps.
2. **Faces.** Keep the face ink; tune its constants to MakeHuman's proportions (landmarks per body
   are already measured; the eyes bigger by a target; a child's head is relatively larger), decide
   the ink's share against the shape keys (`INK_SHARE`), and drive the visemes from the voice's
   vowels (`talk-face.js syllableOpen`). Use MakeHuman's targets for the Moebius stylisation instead of
   `reshape()` (longer lower face, hollow cheeks, heavy brow).
3. **Hair and costumes.** A scalp fitted to each skull (the hairline from the mesh, not a scaled
   egg); the beard shell round the jaw; check every hat and mask per body; the traveller's suit
   (`suitGeometry`) and his gear (`traveller.glb`, fitted to the Quaternius man) re-fitted or kept on
   the old body.
4. **The GPU crowd figure** (`crowd.js`, `crowd-shader.js`) is procedural, not a mesh, so it needs
   no export, but its proportions (`packBody`: shoulders, hips, girth) should be re-tuned to the new
   silhouettes, and a crowd person promoted to a full NPC should get the nearest body (kind, build,
   age, height) so nothing changes as they come close.
5. **Levels of detail** (`skinned-lod.js`): the levels must drop the morph targets (far away a face
   has no expression to show) and the eyes and brows as now.
6. **Animation**: unchanged (the same bone names; the legs scaled to the rig's hips; `bindBody`
   measures the legs for the stride). Check the ragdoll's capsules and the cape colliders against the
   new girths.
7. **Tests and tools**: the tests that load `human_m.glb` / `human_f.glb` and the per-kind tables
   (eyes, face ink, people, hair, talk-face, traveller, ragdoll, drone, gait), the Lab's faces
   gallery and the Unity export (`scripts/unity-export`).
