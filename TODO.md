# TODO

Open work only. Finished items move to DONE.md (with how they were done); the changelog
(src/changelog.js) says when they reached players.

# Player feedback, part 3 (2026-10-05)

## Docs

- [ ] README.md much shorter; the per-system notes, measurements and history into `docs/`.

## The ship and travel

- [ ] Remove the lines leading to the cockpit: just a glowing light on the console and a button prompt to
  get started.
- [ ] The central console opens the galactic map.
- [ ] Travelling to another planet is not a crash landing.
- [ ] Don't tell me I'm playing a recording of my dad (it defeats the purpose): I just press the voicemail
  button.

## The desert's story

- [ ] The quest shouldn't just appear: someone I talk to gives me a hint about where to go.
- [ ] Nour doesn't start talking by herself: she makes a sound so it's clear I should go and talk to her.
- [ ] The traveller doesn't say "how is it that I can understand you" (it's obvious).
- [ ] The spark-stone goes into my inventory instead of floating around.
- [ ] The cave filling cinematic: the bottom half of the pipe still has stuff in it, so it doesn't look
  unclogged.
- [ ] Cinematics show, don't tell: the traveller reacts with at most a slight smirk, nothing corny.

## Conversations

- [ ] The camera doesn't spin round when a conversation starts: it cuts straight to the right angle.
- [ ] Too close to someone when a conversation starts: step me (or them) back to a good distance.
- [ ] The alien script turns into English faster.

## The makers' boxes

- [ ] Don't mention the makers' boxes until I find my first one.
- [ ] Redesign them: a box with no edges, and a shader with a ray of light travelling across its surface.
- [ ] Opening: it floats and shakes slightly, like a pokéball, before dissolving.
- [ ] The tree's pedestal looks bad: higher up (harder to reach) and fancier.

## The traveller

- [ ] More casual, not a space suit, a backpack as originally. The fluid backpack slimmer.
- [ ] Build on the new reference (`references/main character/new*.JPG`, the coral-jacket redesign): thinner
  cheeks, scruffier hair, and whatever else brings him closer to it.

## Movement and camera

- [ ] The jetpack flies like Superman: I can orient up, or down (I can't point down now).
- [ ] Inside a temple I sometimes can't aim all the way up: the camera gets stuck pointing up.
- [ ] Ragdolling down a long fall, the fall sometimes stops, the traveller stands up in mid-air, then keeps
  falling.
- [ ] Always a slight shadow under the traveller while jumping, for precise platforming.

## HUD, menus and bosses

- [ ] "J to close" makes no sense on Android with a controller; B closes the menu too.
- [ ] No three pills for the gun's level: it already shows on the backpack.
- [ ] The drone's second pointer doesn't make sense (the drone already heads the way to go): remove it.
- [ ] Bosses show a damage bar: show a health bar.
- [ ] The vents boss: the vents only open a few times, then not any more.
- [ ] The drone can give a hint about what to do against a boss.

## Progression

- [ ] The jetpack comes in the later half of the game, not the second world unlocked; the winds and gliding
  come first.
- [ ] After picking up the jetpack it isn't clear what to do next.
- [ ] Taxis don't answer until I get a taxi pass in a quest.
- [ ] Vael: the big bird can't be seen or ridden until the quest where I learn the whistle. The top of the
  tower is not a screen but a little flute for the special whistle.
- [ ] The bird walks with a walking animation on the ground; taking off it leaps before it flaps.

## People

- [x] Robes still fly through people until I get close. (A cape simulated every 2nd or 3rd frame, further off or on a 30 fps handheld, now lives all the time since its last update and is carried along with its wearer between updates, pinned and pushed by the collar and limbs on their way, so it no longer streams out behind or lets legs and arms through; the robe under a cape is a collider; the crowd's figures wear the full people's wide cape over their arms and robe, and their robes swing as the full ones do; body girths are measured on the full mesh at every level of detail. tests/robes.test.js)
- [ ] Every world on MakeHuman bodies; more variety in headwear: hats, goggles, scarves…
- [ ] Alien species on the planets: non-humanoid characters (people, not animals).

## The app

- [ ] A new icon for the app.

# Carried over

## The References level

- [ ] Recreate every reference sheet as views (`?level=references`, `[` / `]`, L3 / R3; README "The
  References"). Done: the desert (views 1–27) and the City-Shaft (28–50), DONE.md. In progress, one world at
  a time: Vael → Vael II → the Buried Machine → the Spheres → Lorn II → the Signal Market.
  - Shader findings left:
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
      fade to a pale blue haze with depth (our fog is by distance); a few lit faces at grazing angles show a
      dotted texture.
  - Scene-level: the game's City-Shaft is a round cream-and-blue pit with a spire, terraces and a hill-town,
    the sheets' a canyon of pink and cream stacked houses with water below; the views' houses are boxes (no
    pipes, balconies, laundry or plating under the overhangs), the cabs and blimps simple capsules.

## MakeHuman bodies

- [ ] Stages 1 and 2 (the Desert) done (DONE.md). The other worlds; the face keys' morph textures shared
  between a template's bodies (three makes one per geometry: ~1 MB each body that comes close); the Unity
  export on MakeHuman bodies (blend shapes for the face keys); the Lab's faces gallery.

## Animation

- [ ] Measure frame times, animation CPU cost, loading time and memory on desktop and the Retroid with
  representative crowds (desktop headless Chrome done in the Bazaar and the City-Shaft, README).
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

- [ ] The worlds' own scripts beyond the opening (unity/README.md, per world): the hover-skiff, riding the
  cabs, the temples, the reel's recordings at the console, the homecoming, the Hangar's zone presets, the
  reactive scenery.
- [ ] Run `scripts/bench/android-run.sh` on the Retroid (the APK has never run on a device).
- [ ] The crowd's near tier as the web's (full bodies for the nearest few within 12.5 m, the mid figure
  beyond): the port still gives full bodies out to 55 m.
- [ ] The EditMode story test and the batch play-through still walk the desert's old opening quest.
- [ ] The desert's smaller things: the errands near the start, the reactive flowers, the scout drone, hover
  trails; swimming's strokes, diving and breath.
- [ ] Connect an MCP client to the editor (an organization policy blocks registering unknown MCP servers).

## Later

- [ ] The JS bridges: our JS game code inside Godot (GodotJS) and Unity (Puerts), the engine only rendering.
