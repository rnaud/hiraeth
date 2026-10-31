# Family E on Tripo bodies (#800): the droids — the tripod, the drone, the crawler

The machines, rebuilt one at a time by the skill's recipe (`.claude/skills/enemy-rework/references/tripo-rebuild.md`,
the machine family: rigid parts cut at their joints, each blended across its cut), each from its approved image, each
landed in the game replacing its archetype's body. The replaced builder stays in the repository under a `-legacy` name,
standing in where the new body is not loaded, so its look can come back as a foe of its own.

## The scripts

| Script | What |
|---|---|
| `generate.mjs <tripod\|drone\|crawler> [--dry] [--seed N]` | the Tripo generation (H3.1, texture v3.5, Remove Lighting, 30k faces): the untouched export and `task.json` (credits, the balance before and after) into the concept folder's `tripo/` (`tripo-seed<N>/` for another take from the same image); refuses to run again |
| `grid-views.mjs <glb> <out.png> [--box …] [--bones] [--clay]` | a GLB in four orthographic views with a labelled grid (its own frame: Tripo's raw export or a prepared body); `--bones` each triangle in its bone's colour (the cuts) |
| `islands.mjs <glb> name=#hex …` | the export's colour islands (each vertex's nearest role, the connected pieces of each): where the balls, brackets, shins and lenses are |
| `pick-colours.mjs <image> name:x,y …` | the approved image's flat colours, measured |
| `prep-machine.mjs` | the shared prepare steps: the stray pieces dropped, the game's frame, family A's decimation and `splitAlong`, each triangle's colour role from its texels, the lone ones folded, **the skin's weights baked** (JOINTS_0 / WEIGHTS_0 as bytes: rigid by part, blended across each cut by its signed distance) |
| `prepare-<foe>.mjs` | one foe's asset: `<foe>-lod.glb`, `<foe>-landmarks.json`, `<foe>-texture.png` (the trial's; the game ships no picture) |
| `../../../../scripts/tripo/ship-body.mjs <foe>` | the game's file, `public/enemies/<id>/body.glb`: 16-bit indices, the triangles grouped by colour role, COLOR_0, the baked weights, the landmarks beside it |
| `foe-shots.mjs <dir> <name>=<kind@skin>[:pose:at:yaw:pitch:zoom] …` | a foe alone in the creatures gallery, one PNG a view (the game's own body), for looking while it is built |
| `pair-shots.mjs <before> <version> <name>=<kind@skin>[:pose:at:yaw:pitch:zoom] …` | family A's changelog pairs with the camera's pitch and zoom (a tall old body and a squat new one in one frame) |
| `media.mjs <version> ref\|png <name> <file>` | the approved image as the line's reference picture; a Unity picture as an after-only one |
| `warm-check.mjs <kind>` | family A's Arena warm-up check, listing each new program at an arrival and, for a slow frame, every frame's time and the programs by then |

## The inspection tripod (`tripod`)

Reference: `../../keep-tripod/9bb4fd97-30dd-471d-8ac0-c8da599468ee-0.png` (approved). Three takes, 90 credits (balance
1,245 → 1,065 with the drone's and the crawler's, generated at the same time): the first (`../../keep-tripod/tripo/`, task
`225ad0dd-…`) fused the hidden third leg into a stray tusk behind the hub and built the picture's shadow as a disc; seed 7
(`tripo-seed7/`, task `75908627-…`, the body) and seed 23 (`tripo-seed23/`, task `3c283e55-…`) drew three clean legs.
Home skin `incal` (the City-Shaft's inspection tripod).

- **What it is**: Tripo's 28k-triangle body at 3.1 m to the top of its head (the legacy's lamp at 3.1 m: its beam comes
  from as high, the lens 2.63 m up), cut to 13,113 triangles (12,000 decimated, the cuts adding the rest). The frame: the
  axis its legs stand round (the two in front either side of it, the third behind), not the head's: Tripo turned the lamp
  head 107° off it on its round neck, so the head (all over the neck's top, cut exactly there) is turned back about the
  neck to face ahead. Its parts by geometry: the head; the hull (the neck's dark rings, the round hub and its sockets, the
  sage cap under it); each leg's thigh (its dark hip ball, the sphere round it and all past its middle, and the sage
  bracket out to the knee), shin (from the shin block's inner face out, and everything under the bracket's foot) and
  foot (under the shin's foot: the dark ankle ball and the dome). The reference's three flat colours (the cream, the
  sage, the joints' near-black); the front legs' shins cream over sage brackets and the back leg all sage, as the
  reference draws them (Tripo had one front shin sage and the back one cream: repainted by part). The painted lenses
  (orange at both ends of the head) painted out: the lens is the model's own disc.
- **The rig** (a machine's): the hip, knee and ankle cuts blended over 6 cm either side (the baked weights: bytes in the
  file, renormalised to exact floats at the build); the head rigid on its neck. The motion kit's machine plan (a wave, one
  leg at a time, in hard straight moves) on `SkinLegs` bones fitted to the measured hip ball, knee bolt and ankle ball,
  each leg's bend plane from its knee; its poses smaller than the plan's (the knees ride over the hips: sunk 0.24 m on
  its legs in a wind-up it folded its shins in under the hub); its first stance the kit's own stagger (squared, as the
  toad's, a pack of them stepped in unison: `tests/motion-plans.test.js`). The head yaws and tips a little on its neck in notches: it sweeps as it patrols, turns
  to the traveller once it has noticed him (`gaze: []` asks the foes for where he is) and holds as it aims; the light
  under the lens tips the rest of the way. Four shutter leaves close round the lens in the beam's wind-up, the harpoon
  gun slides out under the hub, a front leg lifts for the stamp (steam from its hip), six valves round the neck rattle
  for the vent, black steam from the back of the head. Armour (#722): three plates round the hub between the legs. Its
  defeat's sag 0.55 m (the hub rides a metre up; 0.95 m put it through the ground).
- **Kept**: id, def, attacks, windows, the lamp's light (`model.lamp`, `SPOT`), the weak lens, the armour, the possessed
  twitch, sounds (`steam` / `machine` steps), the death recipe (its sag refitted) and lying body, every skin's dress
  (the enamel as a slate strip pair down the column, the drill under the lens, portholes on the head's sides, the key on
  the hub and bubbles, gyroscope rings round the head, the pump's handle and pipe).
- **Measured**: bind round trip < 0.1 mm, a knee bent alone moves only its own vertices (`tests/tripod-tripo.test.js`).
  Six tripods in the City-Shaft (two runs each, alternating, load 6–16): draws +932 → +159 (High), +625 → +110
  (Handheld); triangles +152k → +252k and +100k → +168k; the script's time a frame +3.1 → +0.8 ms and +2.4 → +1.0 ms; the
  GPU time not separable at this load. 8 drawn meshes a body (3 skinned roles, the fittings, the lens, 3 plates) against
  the legacy's 127. Arena warm-up: its five skins compile nothing of their own at arrival; one program comes at
  each arrival, the lamp light's shaft (its wash), as for the legacy tripod (on main, 698441032: one program each skin,
  and a 317 ms first frame once its beam is on the traveller), not this body's. Dodge: a back flip into the flurry
  (beam). Defend: the beam blocked from 0.5 s, parried at 0.06–0.12 s, evaded at 0.08–0.25 s; held 2 m off him by
  hand (as `defend.mjs --near 2` does), the stamp and the vent blocked from 0.5 s and parried at 0.06–0.12 s. Sound unchanged: the
  `steam` voice and the `machine` steps on target (`scripts/sound-qc/foe-levels.mjs --check`).
- **Unity**: `-fight tripod` (`engine/unity/game.js`) in the editor's batch mode, muted, the Library cloned: the Tripo
  body (8 meshes), the home skin and the Underwater skin, its lens on the traveller and its beam's shaft, as on the web.
- **Still off**: the head's flat drum has Tripo's own lumps at its back (the exhaust); the shins show the game's light as
  lilac shade on their lit side's edges; the lens's light shaft compiles at each arrival (the legacy's too).

## The spool drone (`drone`)

Reference: `../../keep-drone/e708a0d0-e805-46fd-aee5-4c328202ff41-0.png` (approved). One take (`../../keep-drone/tripo/`,
task `e25f40fd-…`), 30 credits. Home skin `incal` (the City-Shaft's rust drone).

- **What it is**: Tripo's 28.5k-triangle body, its plates 1.4 m across (the ring drone's were 1.2 m), its lowest point
  0.25 m over the model's origin (the foe's hover lifts it as before), cut to 12,794 triangles; its parts by geometry: a
  level cut at each plate's flat face where it meets the core (the core's caps go with the plates), the core between;
  the slate cap and the olive pod by geometry too (over the top plate's face, under the bottom one's). The reference's
  four flat colours; the painted eye (an orange oval with a black slit) painted out. No arms: the reference's note.
- **The rig** (rigid parts, none bent): the hover plan's springs as before; the top plate spins on the axis; the bottom
  plate holds its nozzle ahead as it hunts, turns slowly as it idles; both lock and spin up for the ram; for the harpoon
  they part like jaws round the core (dark discs close the faces that part). The core turns to the traveller (yaw only:
  its flat rim would touch the plates), its eye sliding on. The harpoon (one mesh) comes out of the nozzle on its line,
  the nozzle's reel ring clicking round; the caught cloud leaks from the gap. The plates one mesh where one material.
- **Kept**: id, def, attacks, windows (the harpoon's tell reworded to its nozzle), the tether, hiding between strikes,
  the circle calm, sounds (`tin` / `hover`), the flyer's death recipe and lying body, every skin's dress (tinted plates,
  pearl, a dish and feed horn on three struts, stripes, tilted plates).
- **Measured**: bind round trip < 0.1 mm, each part's bone carries its vertices (`tests/drone-tripo.test.js`). Six drones in
  the City-Shaft (two runs each, alternating, load 5–16): draws +108 → +127 (High), +73 → +86 (Handheld): the ring drone
  was already five skinned meshes, the new one is seven drawn and three casting; triangles unchanged (+237k, +158k); the
  script's time not separable at this load. Arena warm-up: its seven skins compile nothing at arrival (first frames
  1.3–2.6 ms). Dodge: a back flip into the flurry. Defend: the harpoon blocked from 0.5 s, parried at 0.06–0.12 s,
  evaded at 0.08–0.15 s; the ram (its dive) blocked from 0.3 s and missing him the other tries, as the ring drone's on
  main does (the same run there: blocked at 0.3 s, missed or evaded otherwise). Sound unchanged.
- **Unity**: `-fight drone`: the Tripo body (10 meshes), the home skin and the Antennas' relay drone, its plates parting
  for the harpoon, as on the web.
- **Still off**: a few more draws than the ring drone's; the eye's slit is its own mesh; the plates' painted seams are flat.

## The survey crawler (`crawler`)

Reference: `../../keep-crawler/22d8861b-51c8-4a48-9776-9c45ee542615-0.png` (approved). Two takes, 60 credits: the first
(`../../keep-crawler/tripo/`, task `c740ba5e-…`) drew five legs; seed 7 (`../../keep-crawler/tripo-seed7/`, task
`c7b50a5d-…`) six, three a side, symmetric. Its one skin is the Arena's (`desert`, the droids' family; roster v4).

- **What it is**: Tripo's 28k-triangle body at 0.66 m to the top of its antenna's knob as built (×1.5 grown, #741: the
  knob at the traveller's hip, 0.99 m; the dome under it, 0.81 m), cut to 11,631 triangles. Four legs, the reference's
  note's ("four-legged anatomy remains the target"): the front and middle pairs kept, the back pair cut off at their
  sockets' mouths (their roots in the sockets by colour near the socket's middle too), a dark port closing each. Its
  parts by geometry: the head (the round front under the dome's lip: a plane behind it, its sides and top bounded), the
  antenna (a cylinder over the dome's top), the body (dome, band, belly, sockets), each leg's thigh (round its own line
  out of the socket to the knee), shin and foot (under the ankle's stem). The reference's five flat colours; the
  painted eye (one orange dot) painted out: two eyes are the model's own, small and burnt orange.
- **The rig**: the hip, knee, ankle and head cuts blended over 2 cm; the kit's crawler plan (the quick trot on diagonal
  pairs) on `SkinLegs` bones fitted to the measured socket, knee and ankle, each leg's bend plane from its knee; the
  first stance the kit's own (a squared one stepped a pack in unison). The head turns to the traveller and the eyes
  slide on; the antenna sways and sparks for the call (reared on the hind pair); the band is the seam that blinks red
  through the blast's fuse; the call's front legs paw.
- **Kept**: id, def, attacks (bite, call, blast), windows, its size class (`CRAWLER_SIZE.top` 0.54 as built), sounds
  (`servo` / `crawler`), the machine's death recipe (its sag unchanged) and its burst into pieces, its tier (the droids'
  scorch), the Arena-only skin.
- **Measured**: bind round trip < 0.1 mm; a knee bent alone moves only its shin (`tests/crawler-tripo.test.js`). Six
  crawlers in the Arena (it is fielded nowhere else; in a world that does not field it its body is not loaded and the
  legacy stands in; two runs each, load 13–23): draws +90 → +126 (High), +60 → +86 (Handheld); triangles +92k → +210k:
  the legacy dome was five meshes and 5k triangles (measured with the ports a mesh of their own: one draw fewer each since). Arena warm-up: compiles nothing at arrival (2.8 ms). Dodge: a back
  flip into the flurry. Defend (held 1.4 m off him, `defend.mjs --near 1.4`): the bite blocked from 0.5 s, parried at
  0.06–0.12 s, evaded at 0.08–0.15 s; the blast (low health only) left to `tests/droids.test.js`. Sound unchanged.
- **Unity**: `-fight crawler`: the Tripo body (11 meshes), standing and winding up its bite, as on the web.
- **Still off**: more draws and triangles than the legacy dome; a few sage shards left at the dropped sockets' rims;
  the call's rearing is the plan's steep one.

