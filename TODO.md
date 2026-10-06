# TODO

Open work only. Finished items move to DONE.md (with how they were done); the changelog
(src/changelog.js) says when they reached players.

# Player feedback, part 3 (2026-10-05)

## Docs

- [x] README.md much shorter; the per-system notes, measurements and history into `docs/`. (README.md is ~110 lines: what the game is, running, URL parameters, tests, shipping, the layout; the rest moved unreworded into `docs/systems/<topic>.md` and `docs/archive/`, indexed in `docs/README.md`.)

## The ship and travel

- [x] Remove the lines leading to the cockpit: just a glowing light on the console and a button prompt to
  get started. (The floor chevrons, their hint and the dark cable strip to the dash are gone; the voicemail
  button on the dash pulses and lights the dash, the round screen above it glows "1 NEW MESSAGE", and at the
  console the prompt says "E voicemail": pressing it starts the father's message.)
- [x] The central console opens the galactic map. (E at the holo table in the middle of the deck opens it,
  locked without power; the cockpit dash is only the voicemail now. No other key opens the map in play.)
- [x] Travelling to another planet is not a crash landing. (The arrival brakes into the air through the
  clouds, comes down upright on its jets and settles at rest on its feet: no entry fire or smoke trail, no
  shaking, no roar, a soft touchdown; the homecoming lands the same way. The prologue's crash is unchanged.)
- [x] Don't tell me I'm playing a recording of my dad (it defeats the purpose): I just press the voicemail
  button. (Prompt "E voicemail"; the ship says "Good morning. You have one new message." and "First new
  message." / "New message." / "End of message."; the reel search starts only from the fourth message, after
  the third has given their age away; the sketchbook and home's lock text say "message on the ship's voicemail".)

## The desert's story

- [x] The quest shouldn't just appear: someone I talk to gives me a hint about where to go. (Marrow waits at the
  ship and calls you over; the quest starts in his talk, the drone finds him till then; every world's main quest now
  starts in a talk with its first person: quests.opensWith)
- [x] Nour doesn't start talking by herself: she makes a sound so it's clear I should go and talk to her. (she comes
  over and calls "Psst. Child." every few seconds with a psst-and-hum sound, turned to you; the talk is on the prompt)
- [x] The traveller doesn't say "how is it that I can understand you" (it's obvious). (the choice and Nour's
  translator answer are gone; no other world had one)
- [x] The spark-stone goes into my inventory instead of floating around. (hidden while carried, listed under "In your
  pack" in the gear page and the Quests page, out of your hand into the well)
- [x] The cave filling cinematic: the bottom half of the pipe still has stuff in it, so it doesn't look
  unclogged. (it was the dark: one light by the rib left half the gutter unlit, hatched like rubble; four lights now)
- [x] Cinematics show, don't tell: the traveller reacts with at most a slight smirk, nothing corny. (no lines, no
  surprised or happy faces, no talking hands in the desert's two; a quiet 'smirk' look at the end)

## Conversations

- [x] The camera doesn't spin round when a conversation starts: it cuts straight to the right angle. (A hard cut in and out, no blend; a new angle mid-talk is a cut too, kept to page turns, a blocked view, or one every 2.5 s; small drifts still eased.)
- [x] Too close to someone when a conversation starts: step me (or them) back to a good distance. (src/story/spacing.js: about 1.45 m, scaled for children and giants, more for the seated; the traveller is placed back, or round them, as the camera cuts in, never into a wall, off a ledge, up a step or onto a bystander; if he can't, a standing NPC steps back instead; he is turned to face them.)
- [x] The alien script turns into English faster. (LAG 14 → 5 letters, FADE 12 → 5: the line is all English about 0.2 s after the last word instead of 0.55 s, still word by word.)

## The makers' boxes

- [x] Don't mention the makers' boxes until I find my first one. (Nothing about them before a box is opened: the per-world box quests, their toast, the sketchbook's "Item boxes" page, the empty gear page's line and the pilgrim's roof-box line all wait for the first; the world's other boxes are offered a few seconds after it.)
- [x] Redesign them: a box with no edges, and a shader with a ray of light travelling across its surface. (One smooth rounded shell, inked by its outline only; the star and side compasses painted in its own shader, and a thin glowing line of light that sweeps across and wraps round it, pass after pass, with a short trail.)
- [x] Opening: it floats and shakes slightly, like a pokéball, before dissolving. (It floats up turning a corner to the camera, then three small wobbles about its heart with rests between, each a knock and a pass of the ray, a still moment, then the dissolve.)
- [x] The tree's pedestal looks bad: higher up (harder to reach) and fancier. (A carved makers' stone dais 7 m up the trunk on a pier, reached in two climbs: the root to its shoulder, then the pier; a drum ringed with light, two lamps and a stone halo with the glyph.)

## The traveller

- [x] More casual, not a space suit, a backpack as originally. The fluid backpack slimmer. (An everyday
  canvas rucksack always worn, in place of the radio box; the tank is a flat glass flask set into its outer
  face, 22 cm off the back instead of 34; no suit seams, boot buckles or ringed collar left; the drone docks on
  the flask's upright, out of the arms' way.)
- [x] Build on the new reference (`references/main character/new*.JPG`, the coral-jacket redesign): thinner
  cheeks, scruffier hair, and whatever else brings him closer to it. (A leaner face with slim cheeks and a
  narrow jaw; a curly mop of broken locks with a parted fringe and lighter lock edges; a bunched cotton cowl,
  soft slouched desert boots with sand soles, a tiny hidden earpiece.)

## Movement and camera

- [x] The jetpack flies like Superman: I can orient up, or down (I can't point down now). (RT / R2 with the
  stick flies where the camera looks: look up to climb, down to dive, straight down head first; the stick
  at rest hovers, A / × held rises; the body lies flat along the flight, arms ahead; low flight skims
  rising ground; diving into the ground lands.)
- [x] Inside a temple I sometimes can't aim all the way up: the camera gets stuck pointing up. (The tight
  rooms' look-up limit, ~36°, held the aim too; aiming now goes to ~86° anywhere and eases back after.)
- [x] Ragdolling down a long fall, the fall sometimes stops, the traveller stands up in mid-air, then keeps
  falling. (The ragdoll ended after 3.5 s wherever it was; now only on the ground. The landing hurts like
  any fall, and the camera keeps up.)
- [x] Always a slight shadow under the traveller while jumping, for precise platforming. (A patch of shade
  straight under you whenever you are off the ground, inked like a shadow, shrinking with the height.)

## HUD, menus and bosses

- [x] "J to close" makes no sense on Android with a controller; B closes the menu too. (The sketchbook, what's new, the worlds picker and the skip tags name the pad's back button, printed B, or nothing on touch: prompt-keys.js closeHint; B closes the Start menu from any page; the controller's back closes the panel on top first, the sketchbook before a conversation or a moment under it.)
- [x] No three pills for the gun's level: it already shows on the backpack. (ToolHud: no pips, no refill seconds; nothing beside the traveller while the tank is short or the jets burn; only "empty" for 3 s when it runs dry.)
- [x] The drone's second pointer doesn't make sense (the drone already heads the way to go): remove it. (No beak, no beam on a find; the flare stays. Also fixed its aim, which the capsule sweep zeroed every frame, so it now really faces what it found.)
- [x] Bosses show a damage bar: show a health bar. (boss.js guardianBar: full at the start, going down; "health" for a machine, "unrest" for a living guardian; lifted above the cue line.)
- [x] The vents boss: the vents only open a few times, then not any more. (The Warden's Well: in its second phase its side vents stay shut by design and only the crown opened, unseen from the floor and told once. Now its crown hatch swings up with a column of glow every time, the phase has its own open line, and any side vent counts in the first phase; tests/bosses.test.js. Also fixed: the Gardener could never be calmed, bloom reached it as water.)
- [x] The drone can give a hint about what to do against a boss. (src/temples/hints.js: a ping in a guardian's fight chirps, turns the lens beam on the weak point or the thing to use, and says a line; three lines a phase, plainer each ping; the weary guardian asks for your hand.)

## Progression

- [x] The jetpack comes in the later half of the game, not the second world unlocked; the winds and gliding
  come first. (New route: desert, Vael (wings, and the wind up its tower), Vael II (after Vael), Lorn, Lorn II,
  Viridel, then the City-Shaft (jets) as the seventh, and after it the worlds that want jets; tests check it.)
- [x] After picking up the jetpack it isn't clear what to do next. (A line says what they're for, the drone
  flies up to point, rings rise through the oculus, and the temple quest says "fly up through the ceiling".)
- [x] Taxis don't answer until I get a taxi pass in a quest. (Cabs refuse hails and boarding without a cab
  pass; Lio on the rim writes one for the fare Hask owes him; the pass is in the gear; Wren still stops.)
- [x] Vael: the big bird can't be seen or ridden until the quest where I learn the whistle. The top of the
  tower is not a screen but a little flute for the special whistle. (She's hidden until her call is played;
  the window is a stone arch; a modelled flute on the sill plays a five-note call that brings her down.)
- [x] The bird walks with a walking animation on the ground; taking off it leaps before it flaps.
  (A procedural gait: legs stepping, a bob and sway, wings folded; take-off is a crouch, a leap, and the
  first wingbeat at its top.)

## People

- [x] Robes still fly through people until I get close. (A cape simulated every 2nd or 3rd frame, further off or on a 30 fps handheld, now lives all the time since its last update and is carried along with its wearer between updates, pinned and pushed by the collar and limbs on their way, so it no longer streams out behind or lets legs and arms through; the robe under a cape is a collider; the crowd's figures wear the full people's wide cape over their arms and robe, and their robes swing as the full ones do; body girths are measured on the full mesh at every level of detail. tests/robes.test.js)
- [x] Every world on MakeHuman bodies; more variety in headwear: hats, goggles, scarves… (every level in `MH_WORLDS`, one commit a world, the children given their ages; 15 new headwear, 5 face and 3 neck pieces on the skull egg, hair squashed under hats on MakeHuman heads, a fit test on seven heads, each world's set drawn apart so named people keep their looks; the studio's headwear lineups; docs/makehuman.md stage 3)
- [x] Alien species on the planets: non-humanoid characters (people, not animals). (Four peoples with procedural bodies, no skeleton: drifters in the Garden of Spheres, stilt-walkers in Vael, shellbacks in Lorn II, murmurs in the Signal Market, three or four each. Each has its own idle and movement, voice and script, tones shown as glow and gesture, a portrait and two-shot, listen-only talk with quest hints, its own reaction to the fluid tool, levels of detail and shadows. docs/systems/aliens.md)

## The app

- [x] A new icon for the app. (A capture of the References' dish city, view 22, through the game's ink;
  `node scripts/icons.mjs all` re-captures it and makes every Android, web and Steam Deck size, with an
  adaptive foreground, sky background and themed silhouette; four other views kept in `docs/icon/`;
  docs/systems/app-icon.md.)

# Carried over

## The References level

- [ ] Recreate every reference sheet as views (`?level=references`, `[` / `]`, L3 / R3; docs/systems/references.md, "The
  References"). Done: the desert (views 1–27), the City-Shaft (28–50), Vael II (51–81) and the Buried Machine
  (82–103) the Garden of Spheres (104–125), Lorn II (126–148) and the Signal Market (149–169), DONE.md; Vael has no
  sheets (`references/Vael/` is empty). Every sheet is done; the recurring shader gaps, ranked, are in
  docs/systems/references.md ("Across the worlds").
  - Shader findings left:
    - The six recurring gaps (docs/systems/references.md "Across the worlds"): (1) pen detail at every scale
      done (`detail`, docs/systems/materials.md); (4) form-following hatching done (`form`, a per-vertex axis
      in merged geometry: caps radiate, cylinders wrap); (6) colour variation across a wall done (`patches`: big flat world-anchored patches on every wall
      with built pen detail, edges ramped under the colour-edge threshold); (2) line weight per material, (3) haze layers, (5) cast-shadow strength by
      the post side.
    - Spot blacks (`uSpot`) fill the shaded pockets our scenes have; the sheets' interiors are dense small
      machinery at every scale, so most of their black masses have no geometry to sit in here yet.
      Vael II's spawn on High pays +1.7 ms for them (its many shaded overhangs).
    - The Buried Machine's sheets: clouds as soft cream masses with a few thin lines (ours inked lumps);
      the hanging city's recesses mostly lit (ours one shaded mass); the canyon floor's dense stippling
      and the dunes' long shaded slopes as flat sage bands are not drawn.
    - The print preset keeps its cumulus bank and clouds (the worlds' own; the views turn them off).
    - The half-tone can't tell a back wall inside another's cast shadow (it reads as half-tone, the panel's is
      full shadow).
    - Paper grain is screen-fixed, kept light (`uPaper` 0.7).
    - Drifts are in the desert, Vael, the Buried Machine and the views (the desert's only outside Qanat's
      paved streets); weathering is on the desert city, house fronts and the views, not yet on home's or the
      Market's walls.
    - The gorge panels' walls are in cast shadow from the rim; ours are form-shaded.
    - Canyon and cliff walls (IMG_3774 p5, IMG_3773 p3, IMG_3772 p3) have many vertical cracks and strokes
      down the face; our strata draw horizontal beds with sparse fissures.
    - IMG_3774's cast shadows are near-black ink masses with a hard edge (a world-level "ink shadow"
      option is missing).
    - Flat shadow per material (the City-Shaft's trees go grey-blue with `uShadowFlat` on, so the world
      doesn't use it yet); the shaft sheets' faces carry fine vertical cracks and pipes; the deep shaft views
      fade to a pale blue haze with depth (our fog is by distance).
    - Worn walls: stains round the doors are not drawn (the doors are separate meshes); the dust band at a
      wall's foot is hidden where sand banks against it.
  - Vael II, shader-level left: the sheets hatch a cap's underside along its ribs, radiating from the
    stalk, dense and dark; ours are parallel strokes (no radial coordinate in merged geometry: a
    per-vertex axis would do it). The clouds' outlines and shade: the sheets draw them in thin,
    lighter lines with soft lilac pockets, ours in the same black line as rock, so near puffs read
    as boulders (an outline weight / colour per material is missing). The needles' and stalks'
    terminator is a clean band on the sheets; flat facets with flutes break ours into lit islands in
    the shade. The sheets hardly show cast shadows on the plain (a mushroom throws none); ours are
    full. The crevasses' walls are lit red-brown and hatched on the sheets, ours dark. The paper's
    grain and the lines' weight as before (heavier, even).
  - Vael II, scene-level: the overhangs' drips and stalactites, the cracked eggs, the cave mouth's
    framing, the monasteries' detail (arcades, cypresses, roofs), the mushrooms' lean, the bird's
    standing pose (buildBird's rest pose lies low), the cloud sea's cauliflower detail.
  - Vael II world, left: its cloud puffs are pre-shaded vertex colours (not the flat print), its
    planets stay (the sheets have none), dusk and night keep the old blue shadow.
  - Garden of Spheres, shader-level left: the canopies' undersides drawn as dense radiating branch lines and
    foliage as clusters of small inked leaf masses (ours smooth lumps); the white stone's shade a flat pale
    blue with almost no strokes; the spheres' printed crescent whatever the sun. Scene-level: the white hill's
    sculpted rock, the ruins' arcades, the robot, the hedges' fruit, the plaza's paving are sketches.
  - Lorn II, shader-level left: the reeds' outlines dominate their pale blades (an outline weight per
    material); the far wood's layered mist (fog by distance gives one tint); roots and bushes as dense hatched
    masses. Scene-level: the nest in the great cap, the caves' framing, the roots' tangle, the banks' bushes.
  - Signal Market, shader-level left: fine line detail on every wall (seams, vents, lettering), painted
    billboards, far towers fading to a warm haze. Scene-level: the crowd, the stalls' goods, the cabs.
  - Buried Machine, scene-level: the trench's pipe mass, the city's clustered hanging towers, the drum's
    interior machinery and arcades, the oval tunnel's interior, the moon cave and the rock ledge are sketches.
  - Scene-level: the game's City-Shaft is a round cream-and-blue pit with a spire, terraces and a hill-town,
    the sheets' a canyon of pink and cream stacked houses with water below; the views' houses are boxes (no
    pipes, balconies, laundry or plating under the overhangs), the cabs and blimps simple capsules.
  - The ink pass's share of the ranked gaps (docs/systems/references.md, "Across the worlds"):
    - [x] 2. Line weight and colour per material. (`makeMaterial({ line, lineTint })`, `LINE`, packed over the light
      term in RT0.a; post.js 1b gives a line its owner's weight and a dark shade of its colour: the clouds, Lorn II's
      reeds and crystals, foliage, glass, the Market's billboards; docs/systems/rendering.md, "Lines by material".)
    - [x] 3. Haze in layers by depth and fog by height. (post.js 4b: `uHazeLayers` / `uHazeTone` stepped bands by
      distance, `uHeightFog` / `uHeightFogTone` integrated along the ray; set for Lorn II, the desert, the Market,
      Vael II and the City-Shaft's pit, and their views; docs/systems/rendering.md, "Haze by depth and height".)
    - [x] 5. Cast shadows by world. (post.js `uCast`: a cast shadow, told from form shade by facing the sun, lifted
      toward the light on open ground and elsewhere by the world's and the view's amounts, its strokes and edge
      line with it; Vael II and Lorn II lift most of theirs on open ground, the Garden of Spheres a little, the
      desert's sheets keep theirs dark with the spot tier; docs/systems/rendering.md, "Cast shadows by world".)
- [x] A quick menu to jump to any reference, with a tiny picture of its panel. (`src/levels/reference-picker.js`:
  every view grouped by world and sheet, thumbnails cut from the sheets with each view's crop on a canvas,
  built on the first opening; Tab, X / □ on a pad or the "views" button opens it, B / ○ or Esc closes;
  mouse, arrows and Enter, d-pad or stick and A / ×; docs/systems/references.md, "The quick menu of views".)

## MakeHuman bodies

- [ ] Stages 1 and 2 (the Desert) done (DONE.md); stage 3 done: every world, the Lab's faces gallery, the face
  keys in one texture for every body (docs/makehuman.md). Left: the Unity export on MakeHuman bodies (blend
  shapes for the face keys); the props the desert's sheets show that the kit lacks.

## Animation

- [ ] Measure frame times, animation CPU cost, loading time and memory on desktop and the Retroid with
  representative crowds (desktop headless Chrome done in the Bazaar and the City-Shaft, docs/systems/animation.md, "Locomotion").
- [ ] Evaluate learned motion matching only if it measures better than the conventional system (motion
  matching exists, `?mm=1`, but measures behind the loops: the data, not the method, is short; Mixamo's
  starts, stops and turns are pending, docs/mixamo-shopping-list.md).

## Dialogue

- [ ] The speaker's portrait circle shows empty on the Retroid (seen in the device's Chrome: a blank
  yellow disc).

## Android

- [ ] On the Retroid: GeckoView with the real buttons, the upgrade over the installed app, the cave's FPS
  and the shader cost.
- [ ] Make the repository private once the new APK (NATIVE_API 6) is installed and the Steam Deck has
  launched twice: then remove android.yml's TRANSITION step and the GitHub web.json uploads, and Pages
  (docs/cloudflare.md).

## Unity port

The C# port's own game logic is retired in favour of the JS bridge (2026-10-06: Unity + Puerts chosen; the
game's JS runs in Unity, which only draws: docs/systems/engine-bridge.md). Its open items are closed (DONE.md);
what remains is the bridge's:

- [ ] The bridge, stage by stage (docs/systems/engine-bridge.md): a cheaper scene sync, the platform layer
  (HUD, menus, conversations in Unity), sound, the fluid tool, drone, weather, wildlife, glows and lines, the
  crowd's GPU animation, the cave's rounded walls; player builds for macOS, Linux (the Deck) and Android.
- [ ] Run the Unity APK on the Retroid once it builds through the bridge (`scripts/bench/android-run.sh`).
- [ ] Connect an MCP client to the editor (an organization policy blocks registering unknown MCP servers).

## Later

- [x] The JS bridges: our JS game code inside Godot (GodotJS) and Unity (Puerts), the engine only rendering. (The game's modules bundled into the engines' V8 with browser stand-ins, the three.js scene mirrored each frame: in Godot through a first port of the ink look, in Unity through the C# port's own; the desert plays in both, side-by-sides and frame times against the web and a recommendation in docs/systems/engine-bridge.md. Unity + Puerts chosen; since then: a 2.5-3.3x cheaper sync, the platform layer with the HUD and conversations in uGUI, and the rest of the picture and the play: the game's own sound on a Web Audio shim, life, weather, the tool and the drone, local lights, motes, prints, GPU instances; the desert, the City-Shaft and the Signal Market side by side; players for macOS (IL2CPP), Linux (the Deck's, Mono) and Android (IL2CPP ARM64, run in an emulator), measured against the web.)
