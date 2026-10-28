# The traveller's kit: the makers' battery, its hooks, his clothes

The traveller wears clothes built on the people's own body (`src/traveller.js`
`travellerKit`, skinned to its bones; the game's traveller is B3, `src/characters/traveller.js`). The fluid's
source is **the makers' battery** (`src/fluid-tool.js`, issue #728), worn at his left hip on a belt clip. Nothing
is worn on his back but the sword's frog. The look and its reasons: `lore/characters/traveller-design.md`.

- **The chest frame** (`Humanoid.chestAnchor`, on `spine_03`): y 0.74 at the collar, +z forward, his left +x. The
  old body's rucksack (`RUCKSACK`), the sword's frog (`SHEATH`), the wings' root (`WING_ROOT`) and the makers' star
  (`TRAVELLER_STAR`) are placed in it.
- **The hip frame** (`Humanoid.hipAnchor`, issue #728): the same frame at rest, carried by the **pelvis**, so what
  hangs on his belt goes with his hips (a run's twist of the chest leaves it be). The battery (`TANK.at`) and the
  lantern charm (`src/boxes/effects.js LANTERN_AT`, on his belt at the small of his back, beside the battery) hang
  from it. On B3 its y = 0 is 0.7 m over his feet; his belt is at about 0.28.
- **The old body's rucksack** is rigid on `spine_03`: body, lid, lid straps and buckles, side pocket, bedroll and an
  outer pocket (`Humanoid.packPocket`). Since #728 nothing sits in it: the pocket always shows.
- **The makers' battery** (`buildFlask`; `references/Core Objects/Makers Battery/selected-2026-10-28/`, the author's
  pick: "the one we had earlier was the best one", a hip lantern, no tether): an upright **turquoise glass cylinder**
  (`TANK.radius` 5 cm, 13 cm of glass) of **lavender fluid**, between two **rounded cream ceramic endcaps** (`TANK.profile`,
  5.9 cm in radius: a flat face, a ring sunk in it, three screws, a dark lug at each side), a **brass rim** where glass
  meets ceramic, **two brass rails** standing off its sides and looping over the caps' shoulders into their faces (a
  dark binding round each at the middle), and on its back (+z of its frame, toward him) **the clip**: two short brass
  bars out of the rims, an olive plate across them with a brass stud, and a dark hook over his belt. 23 cm endcap to
  endcap, 14 cm across the rails (`TANK.scale` 1). **No hose, no cord, no strap** (the author: no tether): the glove
  reads as fed by it through its own vial. The item's picture is the same battery without its clip (`worn: false`,
  tipped as the reference lies: `src/boxes/model.js tankModel`). It replaced the round backpack (v1.38–2.33: a glass
  dome on the back, its straps over the shoulders; `references/Core Objects/Round Backpack/`).
- **Where it sits** (`TANK.at` (0.108, 0.165, -0.186) in the hip frame, turned `TANK.yaw` -30° so its clip faces him):
  at his left hip, 60° round from his side toward his back, centred on the belt line. The place was measured on B3
  (`tests/battery-hip.test.js`): his hanging left arm passes his side at 25 cm out and swings back over the hip, so a
  battery at his side, or less than about 58° round, is in the arm's way (the sprint's swing came 1.5–6 cm into it);
  lower, the thigh's lift (climbing, the jump's tuck) reaches it. Where it is, none of him comes into its glass,
  caps or rails in any pose he takes (standing, the gaits, talking, the title's stance, climbing, the ledge, riding,
  sitting on a bench, the jump, swimming, gliding, the dodge roll): 2.2 cm at rest (his belt, behind the clip), 0.6
  cm at the closest (the roll's tuck). `Humanoid.tankAt` can still override `TANK.at` for another body.
- **Its stages** (`flask.stages`, `setStage`; src/items.js `BACKPACK_STAGES`, `backpackStage`): each strength found
  adds a little brass. 1, the lift valve (the double jump): a valve wheel on the top endcap. 2, the wings: a brass
  band round the glass's middle. 3, the Warden's bellows (the debug jets count too): a second valve beside the first,
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
- **Vehicles**: boarding a powered one, he takes the battery off his hip and clicks it into the vehicle's socket
  (`HANDOFF`: the same timings, an arc of 0.3 m and a small turn on the way; the socket, `bike.js buildSocket`, a brass
  ring and two clamps sized to it); stepping off, he clips it back on his belt. While it is in a socket the tool is
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
  fitting on the back of the wrist (`GLOVE.fitting` up the forearm) holding a small glass **vial** of the
  battery's fluid, a plate on the back of the hand and three knuckle studs. Both travellers
  wear it: the people's body (`wearOutfit`) and the coral-shirt one (`createTravellerV1`, on his own
  mesh). `fluid-tool.js` shows it with the battery and only then (`glove.show`: while it is on, the
  skin's triangles under the leather are left out of its index, else they show between the
  fingers). Since v1.38 the glove is the fluid gun (a gadget, src/gadgets/gun.js): it shows once the gun is found, with
  the battery; before, the hand is bare and holds the sword's hilt alone. The knuckles light for the whole units of magic left, the plate in the mode's tone, the vial
  (`glove.vial`) in the fluid's second tone, brighter as the glass fills and flashing as it fires; the shot,
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
  `src/sword-sheath.js`): out of a fight the hilt, its blade withdrawn, sits in a leather **frog** behind his
  right shoulder: `SHEATH.at` (-0.205, 0.72, -0.215) in the chest anchor's
  frame, leaning `SHEATH.tilt` (0.2 rad) with the pommel out over the shoulder (its top 8–9 cm
  over the collar, seen from the front) and the cup down on the shoulder blade, its flat to his back. The
  frog (`buildFrog`: a dark strip between the grip and his back, two loops round the grip, brass rivets, three
  draw calls) is carried by the chest anchor and stays there when the sword is drawn, empty. The hands are
  free at rest (`player.swordGrip` 0). The place was measured against the round backpack (2 cm clear; since #728 nothing else is on his back) and his body
  (3.3 cm clear of the skin at the least, the overshirt about 1.5 cm of that) in every pose he takes:
  standing, walking, jogging, running, talking, the title's stance, climbing, the ledge, riding, in the air,
  swimming and gliding (`tests/sword-sheath.test.js`); lower, the jog's arm and the flask's upright bracket
  reached it, higher it stood off the shoulder like a stick. The title screen and the studio show it there too
  (studio: "Draw from the back" scrubs the draw).
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

Tests: `tests/battery-hip.test.js` (the battery at his hip, carried by the pelvis, clear of him in every pose; nothing
on his back), `tests/flask.test.js` (its shape, colours, clip, stages, the item's picture), `tests/sword-sheath.test.js`
(where it sits on the back, clear of the battery and of him in every pose, the
draw and the sheathe and their timing, a swing pressed with it on the back cutting on the same frame as one
already drawn), `tests/glove.test.js` (worn with the battery only, the skin under it, the mouth at the knuckles
in every aim, the lights, the vial lit by the fluid, no hose anywhere), `tests/traveller.test.js` (fit, rucksack, the battery's place, hair,
face), `tests/drone.test.js` (nothing of the drone on him),
`tests/abilities.test.js` (the battery found, its hand-off into a vehicle and back, the jets and the wings).

The scout now uses ivory outer petals, sage lower hull, pale green inner petals and aged
brass rims to match the selected kit. Its four-petal deployment, rotor parking, lens wake
and two-draw-call construction are unchanged. Reference: Folding Scout - States v2.

The ship and skull references are recorded in `references/REFERENCE-SELECTION.txt`.
The skull's lower jaw slopes into the sand at its front; the approach goes around
its solid side bones. The ship's overhead storage is decoration outside the walking
area, so it does not push the traveller onto the galley counter.
