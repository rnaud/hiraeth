# The traveller's kit: the makers' battery, its hooks, his clothes

The traveller wears clothes built on the people's own body (`src/traveller.js`
`travellerKit`, skinned to its bones; the game's traveller is B3, `src/characters/traveller.js`). The fluid's
source is **the makers' battery** (`src/fluid-tool.js`, issues #728, #799), a slim glass cell in a leather bracer on his
right forearm, just above the glove (`src/battery-bracer.js`). Nothing is worn on his back but the sword's frog. The look and its reasons: `lore/characters/traveller-design.md`.

- **The chest frame** (`Humanoid.chestAnchor`, on `spine_03`): y 0.74 at the collar, +z forward, his left +x. The
  old body's rucksack (`RUCKSACK`), the sword's frog (`SHEATH`), the wings' root (`WING_ROOT`) and the makers' star
  (`TRAVELLER_STAR`) are placed in it.
- **The hip frame** (`Humanoid.hipAnchor`, issue #728): the same frame at rest, carried by the **pelvis**, so what
  hangs on his belt goes with his hips (a run's twist of the chest leaves it be). The lantern charm
  (`src/boxes/effects.js LANTERN_AT`, on his belt at the small of his back) hangs from it (the hip battery did too, until #799). On B3 its y = 0 is 0.7 m over his feet; his belt is at about 0.28.
- **The old body's rucksack** is rigid on `spine_03`: body, lid, lid straps and buckles, side pocket, bedroll and an
  outer pocket (`Humanoid.packPocket`). Since #728 nothing sits in it: the pocket always shows.
- **The makers' battery** (`buildFlask`; `references/characters/battery/bracer/`, the author's pick on 2026-10-30: "I
  like the battery embedded into the glove, that makes sense and it's easy to do"): a slim **turquoise glass cell**
  (`TANK.radius` 0.95 cm, 6 cm of glass) of **lavender fluid**, between two **domed brass end caps** (`TANK.profile`,
  1.2 cm in radius: a knob on the end, a dark ring round each and a dark rim where it meets the glass), and **two brass
  rails** standing off its sides and looping over the caps into their ends (a dark binding round each at the middle).
  8.8 cm end to end, 3 cm across the rails (`TANK.scale` 1). **No hose, no cord**: the glove just below it on the same
  hand drinks from it. The item's picture is the same cell, tipped as the reference lies and shown at the size the hip
  battery was (`src/boxes/model.js tankModel`). It replaced the round backpack (v1.38–2.33: a glass dome on the back;
  `references/Core Objects/Round Backpack/`) and then the hip battery (v2.34–2.38, issues #728, #745: a 23 cm cylinder
  on a belt clip at his left hip, which swung, slid and tucked out of his arm's and thigh's way, `battery-hang.js`).
- **The bracer** (`src/battery-bracer.js`, issue #799): a brown **leather bracer** round his **right forearm**, the
  gloved one, from under his shirt's rolled sleeve (its hem 7 cm down the forearm) to a hand's width above the wrist
  (`BRACER.y` 9–19 cm down the forearm from the elbow, the wrist at 25.9), laced over a **slit** on the little
  finger's side (`BRACER.open`: the hilt lies back along the forearm there as he cocks his wrist for the first cut),
  two **darker straps** with brass buckles round it, rolled edges, brass eyelets down the slit. The cell lies
  lengthwise along the **back of the forearm** (`BRACER.roll`, -0.4 rad round the bone: out from him as his arm hangs),
  its foot toward the wrist, half sunk in a darker bed and held by **two brass brackets** over the glass's ends
  (`cellFrame`). Everything is **rigid on the forearm's bone** (`lowerarm_r`), so it goes wherever the forearm goes,
  in every clip, and it shows in **every pose**: nothing tucks it away, nothing swings it. Sliding the cell into a
  vehicle's socket leaves the empty bracer on his arm (`updateDock`, `seatCell`).
- **Fitted to his forearm** (`fitBracer`, `FluidTool.refit`): the bind pose of his drawn skin and sleeves carried by the
  forearm's bone (half their weight or more; the glove left out), in the bone's frame, at 9 stations along it and 24
  angles round it: the furthest of him from the bone at each, gaps filled from their neighbours, widened a bin each way
  and smoothed along it, plus `BRACER.margin` (2.2 mm) and, down its last 2.5 cm, a flare of up to 2.8 mm (the wrist's
  skin turns with the hand). So B3 and v2 each get their own fit, and an outfit with a sleeve there would too: the tool
  fits it again when his drawn meshes change (checked every half second). The forearm takes half the wrist's roll
  (`Humanoid.shareWristRoll`), so its skin stays inside the leather as the hand turns. The aiming pose's left hand,
  cupped under the gun hand, sits 7 mm lower to clear it (`Humanoid.aimAt`). A part found in a box flies to it
  (`beats.js FIT_ARM`, his right forearm as it hangs), and the two films that look at it close (src/story/desert-moments.js:
  the first fill's close shot, the Font Room's) look at his right forearm from his side.
- **Measured** (`tests/battery-bracer.test.js`, on v2 in his own clothes and on B3, every pose he takes: standing, the
  gaits, the sprint, talking, the title's stance, jumping from a stand and from a run, aiming the gun standing and
  walking, the evade, every cut of the blade on its captured clip, climbing, the ledge, riding, sitting on a bench,
  swimming, gliding, the dodge roll): his forearm's own skin at least 1.3 mm inside the leather on v2 (0.8 on B3); his
  right hand, the glove and the hilt in his fist at least 2.1 mm clear on v2 (B3 lays the hilt 0.6 mm into its wrist
  end in a frame of the first cut's wind-up); the rest of him at least 4 mm clear on v2 in every pose but the fast ones
  (0.1 mm on B3), but for v2's open shirt, which the game moves as cloth and whose hem grazes the leather by up to
  2.1 mm in the sprint. In the fast moves (the cuts, the evade, the roll) his other hand, his body, his thigh or his
  folded upper arm come within 5–18 mm of the bare forearm, and so touch the bracer or the cell, at most 10.5 mm deep
  on v2 (the riposte's thigh), in up to half the frames of those moves. Shown in every one of them.
- **Its stages** (`flask.stages`, `setStage`; src/items.js `BACKPACK_STAGES`, `backpackStage`): each strength found
  adds a little brass. 1, the lift valve (the double jump): a valve wheel on the top cap's outer face. 2, the wings: a
  brass band round the glass's middle. 3, the Warden's bellows (the debug jets count too): a second valve on the foot's cap,
  the glass brighter (`STAGE_GLOW`) and its fluid quicker (`STAGE_RATE`). A strength found flashes the fluid.
- **Its fluid shows the magic bar** (`materials.js batteryFluid`, kind 0 with `uFluidDomeK` under 0, set by
  `buildFlask`; Unity: `Figure.hlsl batteryFluid`): flat print tones as the reference draws them. The lavender
  (`uFluidBase`, `TANK.base`) stands at the bar's level (`uFluidA.x`, sloshing with his moves), full at `TANK.full`,
  three quarters up the glass, so a band of **turquoise glass** always shows over it, as in the reference; empty
  (`tool.empty`, the desert's battery as it comes out of its box) the glass is turquoise with a dreg of lavender at
  its foot. A paler line marks the surface, a few slow blobs of the blend's tones drift in it (the colour bands
  magical water adds), the turquoise shows round the fluid where the glass turns away, and a pale streak runs down
  the glass facing out (`TANK.highlight`). A gun mode leans the lavender toward its first tone (`MODE_TINT`, 0.35:
  stilling bluer, ember warmer); the push, the gun's default, leaves it as it is (`MODES.push.keepFluid`). The glass
  glows from `TANK.glow[0]` empty to `TANK.glow[1]` full. Lit from within and **inked by its outline only**, as the
  round backpack's glass was.
- **The wings come from nothing on his back** (`fluid-kit.js WING_ROOT`, `FluidWings`): their roots are an empty frame
  between his shoulder blades, where the round backpack's shoulders were (so the lobes keep their size and timing);
  folded, nothing is drawn there.
- **The jets come from under his boots** (`FluidJets`, `JET_SOLE`): no nozzle, nothing worn. Each flame of fluid is
  laid each frame 7.5 cm under its foot bone (the sole), pointing down his up; nothing shows until they fire.
- **Vehicles**: boarding a powered one, he slides the battery out of its bracer and clicks it into the vehicle's socket
  (`HANDOFF`: the same timings, an arc of 0.3 m and a small turn on the way; the socket, `bike.js buildSocket`, a brass
  ring and two clamps sized to it); stepping off, he slides it back into the bracer. While it is in a socket the tool is
  unavailable, and the vehicle's engine glows in its tones.
- **No scout on him**: the drone is not carried (v1.73, issue #294: it comes out of a light when it is
  needed, docs/systems/scout.md).
- **Hair** (`travellerHair`): a scalp shell plus deterministic clumps
  (`clump`): broad, flat, leaf-shaped sheets laid along the skull egg, tapering
  to a point, with a wave and a lift at the end. Each has vertex colours for its
  lighter strand lines, which the outfit material multiplies into the hair colour.
- **Boots** (`F.boot`): lofted round the body's own foot points (sections heel to
  toe, a rounded box each), a shaft fitted to the ankle, a thin sole; the toes
  are skinned to the ball bone, the shaft to the shin. Nothing of traveller.glb
  is drawn any more (it only keys `travellerKit`'s cache).

- **The fluid glove** (`fluidGlove`, `GLOVE`; `Humanoid.wearGlove`): the glove the fluid comes out
  of, on the right hand, after the coral-shirt sheets. Its leather is the skin's own hand (every
  triangle from `GLOVE.cuff` up the forearm to the fingertips) pushed out along the welded normals,
  with the skin's weights, so it bends with every finger; a pale band round the cuff, a capped brass
  plate on the back of the hand and three knuckle studs; its cuff, 5.4 cm up the forearm, stops just under the
  bracer (the brass fitting and the little **vial** of the fluid that stood on it went with #799: the battery is right
  there). Both travellers
  wear it: the people's body (`wearOutfit`) and the coral-shirt one (`createTravellerV1`, on his own
  mesh). `fluid-tool.js` shows it with the battery and only then (`glove.show`: while it is on, the
  skin's triangles under the leather are left out of its index, else they show between the
  fingers). Since v1.38 the glove is the fluid gun (a gadget, src/gadgets/gun.js): it shows once the gun is found, with
  the battery; before, the hand is bare and holds the sword's hilt alone. The knuckles light for the whole units of magic left, the plate in the mode's tone (a body's glove with
  a vial, `glove.vial`, lights it in the fluid's second tone; the traveller's has none now); the shot,
  the push and a dry press leave from `glove.muzzle`, just in front of the knuckles (the aiming fist's front). It replaces the old wrist bracer, whose brass
  barrel and lens lay along the back of the hand and read as a phone held in it; the old hero's
  handheld screen (`Gear`) is gone too: nothing is held in the hand.

- **No hose** (October 2026, the author's call): the ribbed hose from the flask's collar over the right
  shoulder and down the arm into the cuff (`Hose` in `fluid-tool.js`, re-laid every frame along a curve
  through the shoulder, elbow and the glove's `inlet` anchor, and from the cap into a vehicle's engine port
  while the tank sat in its socket) is gone, with the flask's brass elbow and pipe (`TANK.outlet`), the
  glove's `inlet` anchor and the shader's hose branch (fluid kind 1, its running pulse). It was true to the
  references but stiff in play: it bent poorly round the shoulder and through the aiming poses. The tank and
  the glove read as one kit through the glove's own fitting and its vial lit with the same fluid, the
  knuckles and plate in its tones. The story's lines that had the water "climb your hose" now pour it into
  the tank.

- **The fluid sword** (`src/fluid-sword.js`, held by `src/fluid-blade.js`; the selected design,
  `references/Core Objects/Reviewed Gadgets/Fluid Sword - Selected 2026-10-09/reference-3.jpeg`): the hilt in
  the right fist (`src/blade-grip.js fistGrip`, its origin the grip's middle) is a leather-wrapped grip (`HILT`:
  a spiral of raised bands, grooves between), a brass collar over the index that swells into a bulb with two
  studs and opens into an oval cup with a bead of fluid always in it, and a brass pommel with a curled tail.
  Out of the cup, only while it is lit for a cut, the broad turquoise blade (`bladeEdges`, `bladeGeometry`).
  Drawn, unlit, the fist holds the hilt alone. Three draw calls held, four lit, five through a cut (the
  wake). How it looks and trails: `docs/systems/foes.md`, "The look".

- **On his back** (October 2026, the author: "hide the sword at rest, like move it back to your back?";
  `src/sword-sheath.js`; reseated by issue #763): out of a fight the hilt, its blade withdrawn, sits in a leather
  **frog** on his right shoulder blade, slung diagonally: `SHEATH.at` (-0.12, 0.68, -0.161) in the chest anchor's
  frame, leaning `SHEATH.tilt` (0.45 rad) with the pommel up by his right shoulder and the cup down toward his
  spine, and `SHEATH.lean` (0.25 rad) with his back as it slopes from the shoulders (the cup further back), its
  flat to his back. The frog (`buildFrog`: a dark strip between the grip and his back, two loops round the grip,
  brass rivets, three draw calls) is carried by the chest anchor and stays there when the sword is drawn, empty.
  The hands are free at rest (`player.swordGrip` 0). Until #763 the hilt stood where the round backpack's flask
  had held it (-0.205, 0.72, -0.215): once the backpack went (#728) it hung 6 cm off his back with nothing under it.
  The place is measured on B3 and on v2 (`tests/sword-sheath-seat.test.js`, the hip battery's test's 22 poses:
  standing, the gaits, the sprint, talking, the title's stance, climbing, the ledge, riding, the jump, the bench,
  swimming, gliding, the roll): the frog's strip 0.7 cm off his back on B3 and 0.8 cm on v2 in every pose (his back
  where the spine carries it moves with the chest anchor), none of him nearer. Each Wardrobe outfit is checked in
  eight of the poses; one with something on its back stands the frog off it along its flat (`SHEATH_OUT`, the
  outfit worn read by `fluid-blade.js` each frame): the gravity ranger's pack 3.3 cm, the salt pilgrim's hood 2.2,
  the storm courier's folded hood 1.5, the festival vest 0.5. The salt pilgrim's robe, a loose skinned skirt, swings
  up behind the cup when he sits or springs (into it by up to 2 cm, as it goes through his tunic). No strap holds
  the frog: a strap over the shoulder would want its own fit to every outfit. The title screen and the studio show
  it there too (studio: "Draw from the back" scrubs the draw).
- **The draw and the sheathe** (`SheathState`, `DRAW`, `SHEATHE`; the moment is the blade's own: `bladeDrawn`
  in `docs/systems/foes.md`): drawn, the right hand reaches back over the shoulder (`Humanoid.reachBack`:
  the arm solved to the hilt, the elbow up and out, the fist's grip point onto the grip, blended over the
  frame's pose by `reach`), takes the hilt and brings it round: 0.34 s, the arm out over the first 38 %, the
  hilt changing hands over 38–56 % (the world's blend of the frog's place and the fist's), the arm its own
  again by the end. Put back the same way in 0.36 s. With the arms busy (climbing, swimming, gliding, riding,
  aiming the gun, knocked down, a scene) it flies back to the frog in 0.15 s with no reach. A swing pressed
  with it on the back is never held up: the swing starts on the press, with its own timing and cut, and the
  hilt is in the fist within `DRAW.quick` (0.12 s, the arm only starting back toward it), before any attack's
  cut opens (the riposte's wind-up 0.12 s, a first swing's 0.22); the blade lights only once the hilt is
  in the fist. Before, the hilt grew out of the glove's cuff into the fist.

Tests: `tests/battery-bracer.test.js` (the battery in its bracer on his right forearm, carried by its bone, fitted to
v2 and B3, the forearm inside it and the rest of him clear of it in every pose, shown in all of them, the empty bracer
while the cell is in a vehicle; nothing on his hip or back), `tests/flask.test.js` (its shape, colours, stages, the item's picture), `tests/sword-sheath.test.js`
(where it sits on the back, clear of the battery and of him in every pose, the
draw and the sheathe and their timing, a swing pressed with it on the back cutting on the same frame as one
already drawn), `tests/glove.test.js` (worn with the battery only, the skin under it, the mouth at the knuckles
in every aim, the lights, the battery above it lit by the fluid, no hose anywhere), `tests/traveller.test.js` (fit, rucksack, the battery's place, hair,
face), `tests/drone.test.js` (nothing of the drone on him),
`tests/abilities.test.js` (the battery found, its hand-off into a vehicle and back, the jets and the wings).

The scout now uses ivory outer petals, sage lower hull, pale green inner petals and aged
brass rims to match the selected kit. Its four-petal deployment, rotor parking, lens wake
and two-draw-call construction are unchanged. Reference: Folding Scout - States v2.

The ship and skull references are recorded in `references/REFERENCE-SELECTION.txt`.
The skull's lower jaw slopes into the sand at its front; the approach goes around
its solid side bones. The ship's overhead storage is decoration outside the walking
area, so it does not push the traveller onto the galley counter.
