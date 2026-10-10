# The traveller's kit: rucksack, flask and their hooks

The traveller wears clothes built on the people's own body (`src/traveller.js`
`travellerKit`, skinned to its bones) and, on his back, an ordinary canvas
rucksack. The fluid tank (`src/fluid-tool.js`) is a slim glass flask that sits in
the rucksack's outer face. The look and its reasons:
`lore/characters/traveller-design.md`.

- **The chest frame** (`Humanoid.chestAnchor`): y 0 at the hips, the collar at
  0.76, +z forward. The rucksack (`RUCKSACK`: back face, depth, width, bottom,
  top), the flask (`TANK.at`, `TANK.scale`), the lantern (`LANTERN_AT`) and the
  makers' star (`TRAVELLER_STAR`) are all placed in it.
- **The rucksack** is rigid on `spine_03`: body, lid, lid straps and buckles,
  side pocket, bedroll, plus an outer pocket marked `pack: true`. Those pieces
  are `Humanoid.packPocket`; `FluidTool.updateWorn` hides them while the flask is
  on the back (`where === 'back'`) and shows them again when it is not found
  yet or sits in a vehicle's socket. The rucksack itself never hides.
- **The round backpack** (v1.38, the progression rewrite; `references/Core Objects/Round Backpack/`: the worn sheet,
  the sheet's first pick, the states sheets): `buildFlask` builds a glass **dome**, half a sphere 30 cm across
  (`TANK.radius` 0.19 × `TANK.scale`) standing `TANK.depth` (0.85) of its radius out of a flat brass porthole ring that
  lies against the back (the tank frame's z = 0 is the ring's plane, the dome out toward -z). The ring: a rim round the
  glass and a flange tapering back to the plate. A half hoop across the dome's equator carries three charge lights on
  its outer face (`flask.lights`: lit for the whole units of the magic bar left, as the glove's knuckles are); a boss
  under the ring; a short capped brass neck on the ring's top with a turquoise cloth tied round it; worn, a slim olive
  canvas back plate (`TANK.dome.plate`, padded, stitched round, two rivets) and two leather straps from its top corners
  up over the shoulders, buckled. No hose. The same model is the item's picture (`worn: false`, stage 0, turned so its
  dome faces the icon's camera). It replaced the Ivory and Jade flat flask
  (`references/Core Objects/Backpack Colour Explorations/03 Ivory and Jade/`).
- **Slim, lying flat** (the author on v1.38's first sphere: "it should be a bit slimmer like on the references so it's
  not protruding out so much … it's a half sphere so it lays flat on the back"): the whole pack stands 0.21 m off the
  back (plate to dome top), against v1.38's first sphere's 0.36 m. The plate's back is where the sphere's was on the
  body, so the straps and the shirt are unchanged; `tankGlassMeasure(p)` is the dome's inside test (tests).
- **Its stages** (`flask.stages`, `setStage`; src/items.js `BACKPACK_STAGES`, `backpackStage`): each strength found adds
  its parts, as the states sheet's second pick draws them. 1, the lift valve (the double jump): the valve's wheel on
  the cap, a second half ring over the dome top to bottom, two small brass fins on the band. 2, the wings: folding brass
  vanes at its sides, folded back along the ring. 3, the Warden's bellows (the wings' third strength, since v1.42; the
  debug jets count too): a second capped valve on the ring's shoulder, the glass brighter (`STAGE_GLOW`) and its nebula turning quicker
  (`STAGE_RATE`). A strength found flashes the fluid (FluidTool's item listener).
- **Its glow and level follow the magic bar**: the nebula stands at the bar's level (empty: dry glass and a dreg;
  full: up to the neck), and the glass glows from `TANK.glow[0]` empty to `TANK.glow[1]` full (`uGlow`,
  FluidTool.updateWorn), the nebula brighter with it.
- **Its fluid is a little nebula** (the author: "the new content looks like a little galaxy inside of the backpack. not
  a lava lamp anymore"; `materials.js flaskNebula`, kind 0): translucent jade-to-cyan clouds wound in a slow two-armed
  spiral round a soft bright heart, pale star specks twinkling, all lit from within. The fragment shader marches the
  dome from the glass inward (six samples, `uFluidDome` its centre and radius, `uFluidDomeK` its depth, set by
  `buildFlask`; object space through `modelMatrix`): each depth's clouds are turned a little behind the one over it, so
  the inside has depth as the view moves; the stars sit on three shells, each its own parallax, a speck never under a
  pixel (it fades instead). Above the fill line the rays see empty glass; a soft bright line marks the surface. One
  draw, no texture, no extra render target. Its colours are `uFluidBase` (`TANK.base`, or a gun mode's first tone:
  stilling's blue, ember's orange, bloom's leaf green) and the blend's first tone for the cyan wisps. The glass is lit
  from within (no shade side, `L` at least 0.92) and **inked by its outline only** (the soft-ink flag with a full pen
  line, as the makers' boxes: post.js draws no line round its clouds, its fill or its highlights). A pale glowing edge
  where the glass turns away and a window's highlight on its shoulder finish it. `TANK.straps` is empty: no leather
  band crosses it.
- **Where it sits**: `Humanoid.tankAt` overrides `TANK.at`. The coral-shirt traveller
  (`traveller-v1.js TRAVELLER_V1_TANK_AT`, z -0.1886) has no rucksack, so the dome's canvas plate sits right on his
  back. The old body keeps `TANK.at` (z -0.245), its ring on its rucksack's outer face. The side struts stand beside the
  dome (`TANK_RAIL.z` -0.07, between its ring and its top) with short brackets back to the plate, the top one at the
  dome's middle, and the ring's rim is slim, so the sword's frog behind the right shoulder stays clear
  (`tests/sword-sheath.test.js`: 1.2 cm at the least, to the ring's rim). The jets clip under the dome. A vehicle's
  socket and the hand-off keep `TANK.scale` either way.
- **The scout's dock**: without the flask, on the rucksack's lid (`kit.dock`,
  `Gear.packDock`); with it, clamped to the top of the flask's left upright
  (`TANK_RAIL`, `SCOUT_DOCK_*`), high enough that the arms don't swing into
  it in any clip. While the wings are open it hops onto the cap
  (`scoutDockPose`). The dock rides the flask into a vehicle's socket.
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
  tank's fluid, a plate on the back of the hand and three knuckle studs. Both travellers
  wear it: the people's body (`wearOutfit`) and the coral-shirt one (`createTravellerV1`, on his own
  mesh). `fluid-tool.js` shows it with the tank and only then (`glove.show`: while it is on, the
  skin's triangles under the leather are left out of its index, else they show between the
  fingers). Since v1.38 the glove is the fluid gun (a gadget, src/gadgets/gun.js): it shows once the gun is found, with
  the tank; before, the hand is bare and holds the sword's hilt alone. The knuckles light for the whole units of magic left, the plate in the mode's tone, the vial
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
  right shoulder, beside the flask's right upright: `SHEATH.at` (-0.205, 0.72, -0.215) in the chest anchor's
  frame (the tank's), leaning `SHEATH.tilt` (0.2 rad) with the pommel out over the shoulder (its top 8–9 cm
  over the collar, seen from the front) and the cup down on the shoulder blade, its flat to his back. The
  frog (`buildFrog`: a dark strip between the grip and his back, two loops round the grip, brass rivets, three
  draw calls) is carried by the chest anchor and stays there when the sword is drawn, empty. The hands are
  free at rest (`player.swordGrip` 0). The place was measured against the flask (2 cm clear) and his body
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

Tests: `tests/sword-sheath.test.js` (where it sits on the back, clear of the flask and of him in every pose, the
draw and the sheathe and their timing, a swing pressed with it on the back cutting on the same frame as one
already drawn), `tests/glove.test.js` (worn with the tank only, the skin under it, the mouth at the knuckles
in every aim, the lights, the vial lit by the fluid, no hose anywhere), `tests/traveller.test.js` (fit, rucksack, flask size and visibility, hair,
face), `tests/drone.test.js` (docks and clearance in every clip),
`tests/abilities.test.js` (the pocket while the flask comes and goes).

The scout now uses ivory outer petals, sage lower hull, pale green inner petals and aged
brass rims to match the selected kit. Its four-petal deployment, rotor parking, lens wake
and two-draw-call construction are unchanged. Reference: Folding Scout - States v2.

The ship and skull references are recorded in `references/REFERENCE-SELECTION.txt`.
The skull's lower jaw slopes into the sand at its front; the approach goes around
its solid side bones. The ship's overhead storage is decoration outside the walking
area, so it does not push the traveller onto the galley counter.
