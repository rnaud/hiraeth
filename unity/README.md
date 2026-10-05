# Memento in Unity: the desert, a proof of concept

`unity/Memento` is a Unity 6 (6000.6, URP 17) port of the web game's first
world, the desert, built from the web game itself: a Node script builds the
desert headlessly exactly as the game does at load and exports it; Unity reads
the export and draws it through the same G-buffer and ink composite as
`src/materials.js` and `src/post.js`, ported to HLSL. It plays from the ship's
prologue through the opening quest, "The Tree That Drinks", to the ship that
hums, with the people dressed and animated as on the web, the fluid backpack,
the makers' boxes, sound and voices, wildlife, weather and saves.

The same viewpoints, web game (left) and Unity (right), rendered headlessly
(`views.mjs`, `Batch.Shots`):

| web (three.js) | Unity (URP) |
|---|---|
| ![](docs/web-city.jpg) | ![](docs/unity-city.jpg) |
| ![](docs/web-start.jpg) | ![](docs/unity-start.jpg) |
| ![](docs/web-camps.jpg) | ![](docs/unity-camps.jpg) |
| ![](docs/web-tree.jpg) | ![](docs/unity-tree.jpg) |
| ![](docs/web-plume.jpg) | ![](docs/unity-plume.jpg) |
| ![](docs/web-cave.jpg) | ![](docs/unity-cave.jpg) |
| ![](docs/web-traveller.jpg) | ![](docs/unity-traveller.jpg) |
| ![](docs/web-ama.jpg) | ![](docs/unity-ama.jpg) |
| ![](docs/web-nour.jpg) | ![](docs/unity-nour.jpg) |

(The Unity world shots show the world alone, outside play, so there are no
people. The three portraits on the Unity side come from the play-through.) In
play, from the scripted play-through (`Batch.Play`):

| | |
|---|---|
| ![](docs/play-recording.jpg) the prologue: the father's recording, the parents' hologram | ![](docs/play-impact.jpg) the impact |
| ![](docs/play-camps.jpg) the camps, the seated people round the fire | ![](docs/play-far_crowd.jpg) the city from afar, the far crowd instanced |
| ![](docs/play-climbing.jpg) climbing the burning tree's buttress | ![](docs/play-chest_apart.jpg) the makers' chest comes apart |
| ![](docs/play-tank.jpg) the tank on his back | ![](docs/play-splat.jpg) a glob of fluid splashed |
| ![](docs/play-gliding.jpg) the fluid wings | ![](docs/play-wildlife.jpg) a dune crab |
| ![](docs/play-star.jpg) the star box's keepsake | ![](docs/play-furrow.jpg) the prologue: the crash's furrow |
| ![](docs/play-procession.jpg) the procession on its loop | ![](docs/play-riding.jpg) the hoverbike |
| ![](docs/play-glide.jpg) the arms out under the wings | ![](docs/play-jets.jpg) the jets' flames and drops |
| ![](docs/play-embers.jpg) an ember glob: the camp fire flares, a bramble burns | ![](docs/play-fog.jpg) a fog bank |

The holo table, the rain, the sun rays (web left, Unity right):

| web (three.js) | Unity (URP) |
|---|---|
| ![](docs/web-holo.jpg) | ![](docs/unity-holo.jpg) |
| ![](docs/web-rain.jpg) | ![](docs/unity-rain.jpg) |
| ![](docs/web-rays.jpg) | ![](docs/unity-rays.jpg) |

## Run it

1. Export the desert (from the repository root; needs the web game's
   `node_modules`):

   ```sh
   node scripts/unity-export/export-desert.mjs
   ```

   This writes `unity/Memento/Assets/StreamingAssets/desert/` (world.json,
   world.bin, story.json, about 400 MB, not committed) and copies the
   characters (`public/anim/*.glb`) to `StreamingAssets/anim/`. Run it again
   whenever the desert changes on the web side.
   The sounds are recorded from the web game in a second step (headless Chrome
   against a dev server on its own port; writes `StreamingAssets/sound/`, also
   not committed):

   ```sh
   npx vite --port 5238 --strictPort &
   PLAYWRIGHT=/path/to/playwright-core/index.mjs node scripts/unity-export/record-sounds.mjs
   ```
2. Open `unity/Memento` in Unity 6000.6 (Hub: Add project from disk). The first
   import resolves the packages (URP, Input System, glTFast, MCP for Unity).
3. Once, or after pulling: menu **Memento → Set up project** (URP settings, the
   ink renderer feature, the scenes). Already done in the committed project.
4. Open `Assets/Memento/Scenes/Title.unity` (or `Desert.unity`) and press Play.
   Loading the export takes a few seconds.

### Controls (as in the web game)

| | keyboard + mouse | controller (Xbox / PlayStation) |
|---|---|---|
| move | WASD | left stick |
| look | mouse (hold the right button in the editor) | right stick |
| run | Shift | L3 |
| jump, climb off | Space | A / × |
| talk, use, get on / off the bike, whistle for it | E | B / ○ |
| shoot (the backpack's fluid) | G, left click (cursor locked) | RT / R2 |
| push | C, middle click | RB / R1 |
| gun mode | X | D-pad ← → |
| boost; wings (with the glider) | Space again in the air; hold while falling | A / × again; hold |
| skip a cinematic | hold Esc | hold Y / △ |
| choose an answer | 1–3, ↑ ↓ + Enter | D-pad + A / × |
| sketchbook (journal); track a quest in it | Tab, J; ↑ ↓ + Enter | View; D-pad + A / × |
| close a panel | Esc | Y / △ |
| pause menu (settings) | Esc, P | Menu |
| controls in the status box | H | |
| hoverbike | W / S go and brake, A / D steer, Shift boost | left stick, RT / R2 go |

### From the command line

`scripts/unity-export/unity-batch.sh <Method> [args]` runs one of the entry
points in `Assets/Memento/Editor/Batch.cs` in batch mode (with graphics, so
cameras render on Metal) and prints the log's errors and `Memento:` lines:

```sh
scripts/unity-export/unity-batch.sh Setup                 # project settings, renderer feature, scenes
node scripts/unity-export/views.mjs > /tmp/views.json      # fixed viewpoints, web coordinates
scripts/unity-export/unity-batch.sh Shots -shots /tmp/views.json -out /tmp/shots   # PNGs of the world
scripts/unity-export/unity-batch.sh Play -out /tmp/play    # the scripted play-through (below)
scripts/unity-export/unity-batch.sh Probe                  # collision checks at the story's places
scripts/unity-export/unity-batch.sh UiKit -out /tmp/kit    # the UI kit alone (shapes, text, spacing) on a canvas
```

Unity's EditMode tests (`Assets/Memento/Editor/Tests`, the story run by the C#
ports of the quest and dialogue systems):

```sh
Unity -batchmode -projectPath unity/Memento -runTests -testPlatform EditMode -testResults /tmp/results.xml
```

`Play` enters play mode and lets `BatchDriver` drive the pad: the title
screen (and its settings; `-noTitle` skips it), New game, the prologue
(waking, the recording, the impact, the crash, stepping out), a run and a jump, the camps and Ama (the prompt over her, her answers chosen with the D-pad),
the sketchbook and the pause menu, the city gate, the climb up the burning
tree's buttress to the makers' chest, Nour, the well, Ama's jar, the Speaker at
the head of the procession, the skull's mouth into the cave, the push that
clears the rib, the pool that fills the jar, the hoverbike under the tarp, the
camp fire that burns, a fall that knocks you over, the ship that hums, the
galactic map at its console and its "Travel to …?". Along
the way it runs the box scenes, the tank, a shot and a splat, the stun mode, a
boost, the wings, the wildlife, the star box and Nour back on her bench, counts
the sounds played, and writes a save and reads it back. It saves a frame at
each step and exits 0 only if the quest is done. The EditMode tests also check
the voices' syllable plans against `voice.js`, the people's dress against the
export, the boxes and the recorded sounds; `UiTests` the portraits' backdrops,
the star chart's layout, the planets and the region names against the web's.

## How it is built

### The export (`scripts/unity-export/`)

- `build-world.mjs` builds the desert the way `main.js` does (and the tests:
  `tests/desert-story.test.js`): `createDesert`, the physics, the ship at its
  arrival point, the crowd, the story's people (`createStory`), the makers'
  boxes, the hoverbike and the flora, with a small DOM stub (`shim.mjs`).
  Colour management is off, as in the game: colours are display values.
- `export-desert.mjs` walks the scene and writes:
  - **static surfaces** merged by material and by 256 m tile (positions,
    normals, vertex × instance colours, uvs, cloth folds; for plants the
    wind-sway anchor and bend), every flora instance included;
  - **materials**: the `makeMaterial` options read back from each shader's
    uniforms (colours, mode: plain / terrain / strata / water, faceted,
    strata size, grid, glyphs, biomes, ripples, sand ink, ticks, glow, folds,
    scrub, pattern: facade / tiles / leaves / cracks, palette, sides, sway);
  - **the terrain** as its heightfield (561 × 561), rebuilt in Unity with the
    same triangle layout, so `HeightAt` matches `world.js` exactly;
  - **collision**: what `physics.js` bakes (every mesh not under `noCollide`,
    the city's invisible proxies, the flora's trunks), in tiles, both sides;
  - **moving things** in their own frame: the hoverbike, the tarp, the makers'
    chests, the fallen rib, the pool, the stream, the well's water, Teo's drum;
  - **the look**: the post pass's uniforms with the "Moebius print" preset and
    the time-of-day palette at every quarter hour (`timeofday.js`), planets;
  - **the story's places** (the gate, the ledge, the well, the camps, the
    giant's door, the cave, the pool, the ship's ramp…), **portals** (the
    skull's mouth and the passage), **the people** (palettes, scale, routes,
    seats), the crowd and the procession's route, the tree's flame, the local
    lights;
  - `story.json`: `src/story/desert-data.js` as data (people and their
    conversations, quests, things, crowd lines, items), and the ship's
    prologue (`cinematics.js`: the call's pages, the timeline, the crash
    path, the map's worlds and order);
  - **the people** (`people.mjs`): every figure exactly as the web game dresses
    it (the traveller with the fluid kit, the story's people, the 132 of the
    crowd through `pooledNPC`). That means node trees, skinned meshes with
    their bind poses (deduplicated), and each material's figure uniforms
    (outfit zones, trims, skin, face kit, eyes, creases, glass, the hero flag,
    the tank's fluid, dissolve). Capes come with their drape. The postures the
    clips lack (seated on an edge, on a kerb, leaning on a rail or a wall) are
    baked on each rig. The animation clips are exported as the web game plays
    them, sampled at 30 fps from its own retargeting (`Animator` +
    `Humanoid.update` + `poseHands`) for each body kind;
  - the crowd's far figures (`crowd.js` figureGeometry) and their packed looks,
    the items (the backpack, the star), the box scene's timings, the parents'
    hologram busts, the birds, the wildlife species, the smoke column, embers
    and camp smokes, the weather kinds and the ship in its frames (space,
    parked, the crash path, hatch and ramp).
- `record-sounds.mjs` renders every effect the desert plays (and 150 s of the
  desert's score) through the game's own `Sound` class into an
  `OfflineAudioContext`, so the WAVs are what the browser plays.
- Coordinates: three.js is right-handed, Unity left-handed. Everything is
  mirrored across x (as glTFast does for the characters), windings flipped,
  headings become Unity yaw `-h`. The shaders mirror positions back before every
  procedural pattern, so the dunes, strata, ripples, cracks and sky land exactly
  where they do on the web.
- `views.mjs` writes fixed viewpoints (web coordinates) for side-by-side shots;
  `web-shots.mjs` shoots the web game from them with headless Chrome
  (`?level=desert`, the camera pinned to the same eye and target; needs
  playwright-core and a dev server), `unity-batch.sh Shots` the Unity side.
  The pairs are in `docs/` here.

### The look (`Assets/Memento/Shaders`, `Assets/Memento/Rendering`)

- `MementoFeature` is a URP renderer feature (RenderGraph). After URP's main
  light shadows it draws every `LightMode = MementoGBuffer` pass into three
  targets, as `src/pipeline.js`: albedo + light term (half-lambert × cast
  shadow, clamped under the toon threshold), world normal + linear view depth,
  hatching / stipple + drawn detail + flags (glow, hero, figure). Then one
  full-screen pass inks the page into the camera target.
- `Surface.shader` + `MementoCommon.hlsl` port `materials.js`: sand patches and
  regions (`biome.js`), strata bands with their far-distance average, façades
  with windows and shutters, roof tiles, leaves, rock cracks, fissures, glyphs
  and grids, sand blobs, ground ink by distance (`ground-ink.js`: ripples, wind
  lines, grains, salt-flat cracks), sand scuffs, cloud shadows, local lights,
  the surface-anchored power-of-two hatching (single, cross, form-following
  rings and height contours) and stipple, plant sway in the wind and away from
  the traveller, the printed outfit zones of the people. Shadows come from URP
  (4 cascades over 700 m, 4096²).
- `Composite.shader` ports `post.js`: ink lines from the Laplacian of 1/z,
  normal creases, albedo and shadow edges, with the wobble, pen pressure,
  broken interior lines anchored in the world, lines thinning with distance and
  fog, people's lines by their size on screen, the hero's outline; two-tone cel
  shading with the lavender shadow tint; hatching in shade fading with
  distance; crease shading; banded fog and aerial perspective; the printed sky
  (flat colour, dome dots, the cumulus bank, the sun and moon discs, a planet,
  flat inked clouds with hatched undersides); paper fibre and the vignette.
  Colours stay the game's display values and are converted to linear at the end.
- **Figures** (`Figure.hlsl`, in `Surface.shader`): the printed outfit zones and
  trims drawn from the bind pose (uv3 / uv4), the drawn face (ink lines, lips,
  brows following the mood), eyeballs with their gaze, cloth creases, the
  bubble helmet's glass (discarded where it would hide the face), the tank's
  lava lamp (bands of fluid, a charge each) and the box scene's dissolve.
  `Crowd.hlsl` (keyword `MEMENTO_CROWD`) ports `crowd-shader.js`: the far
  figures posed and dressed in the vertex shader from their packed look.
  `Hologram.shader` is the parents' bust in the ship (scanlines, flicker,
  colour).
- **The glow** (`Bloom.shader`): the glowing surfaces are gathered at a
  quarter of the resolution, blurred, and blurred again at an eighth. The
  composite lays them on as flat-ringed halos (`post.js` createBloom). Each
  pass has its own property block. Then comes **FXAA** (`FXAA.shader`).
  Shadows use URP's low soft-shadow filter, the closest to the web's.
- **Instanced draws** (`Graphics.RenderMeshPrimitives`, drawn in the G-buffer
  pass): smoke puffs (`MEMENTO_PUFFS`: the column, the camp fires' smoke,
  dust), the far crowd, the wildlife's parts (`MEMENTO_INSTMAT`); `Wisp`,
  `Mote` and `Print` draw the blown sand, dust motes and footprints.
- The composite also has the cinema globals (fade, eyelids, letterbox, the
  alarm red), the sandstorm's tint and a glow debug view (`debug 9`).
- `Flame.shader` is the burning tree's fire (`flames.js` FlameBody): three
  lathe shells of flat bands, licked and torn by a scrolling noise, self-lit;
  it turns to the cool palette when the tree drinks.

### The play (`Assets/Memento/Runtime`)

- `Game` / `Play`: the desert scene's bootstrap (world, look, sun, camera, the
  traveller at the ship's ramp, the HUD, the crowd, the story, the bike),
  the use prompt, B / ○ to use, the push, the portals.
- `WorldLoader`: reads the export, builds meshes, materials and colliders.
- `MementoLook`: the time of day and the preset as shader globals; turns the sun.
- `Player` (`player.js`): walk 3.8, run 7.2, jump 13 under gravity 32, step
  0.6 m; climbing (push into a steep wall; up / down / sideways, stamina) and
  mantling over the top; health, the fall rules (tumble from 26 m/s, fatal from
  48), fire, a limp knock-down (a simplified ragdoll) and Restart.
- `CameraRig` (`player.js` CameraRig): the 9.5 m arm over a look point 1.8 m
  up, swinging behind the heading, pulled in front of walls and kept off the
  ground; a two-shot while talking.
- `Figures` / `Figure`: `FigureLibrary` builds the people from the export
  (shared meshes, bind poses, materials). Each figure's motion is blended as
  `animator.js` does it (idle, walk, jog, run by speed with the gait's phase,
  jump, fall, climb, glide, ride, talk), with the baked postures laid over
  it. The face's expressions follow each line's tone (`TalkFace`: mood, brows,
  the mouth opening on the voice), and the eyes look at you. `Cape` simulates
  the capes (Verlet within 30 m, the baked drape beyond). `FarCrowd` draws the
  crowd past 55 m as instanced figures. (`Characters` is the old glTFast
  path, kept as a fallback.)
- `FluidTool` (`fluid-tool.js`): three charges, the glob shot on an arc and its
  splat, the push, the boost, the wings with the glider, the gun modes
  (stilling, ember) and the tank's colours (the living water adds one).
  People shout, freeze or are shoved; the wildlife flees. Gliding, the arms
  open out under the wings (`Figure.SpreadArms`: player.js spreadArms, a
  two-bone reach over the clip). The jets (`fluid-kit.js` FluidJets, with the
  jetpack item another world's box gives on the web): hold A / × in the air to
  thrust on the tank's fluid, the two nozzles spitting flames banded in its
  tones, a pale core in each, drops falling off them.
- `Flammables` (`flammable.js`): what an ember glob sets alight. The camp fires
  flare up tall for a moment; the dry brambles at the edge of each camp (three a
  camp, drawn as the web's) burn away and grow back a minute later. The flames
  are `story/flames.js` Flames: tongues of flat colour bands, moved every frame.
- `BoxScene` (`box-scene.js`): the makers' chest wakes, rises, comes apart
  (dissolve) and leaves its item hovering, then the card comes up. The star
  box (its keepsake) opens the same way.
- `ShipScene` (`ship/`, `cinematics.js`): the prologue (waking in the bunk,
  the father's recording with the parents' coloured hologram, the impact, the
  fall, the streak and the furrow, the dust clearing, the hatch, stepping
  out), then boarding the crashed ship, the console and the galactic map.
  `StarMap` (`starmap.js`) draws the chart on the HUD's canvas: the worlds on
  their dotted route round home's sun (`chartLayout`: a ring, or a snake of
  rows on a small screen), the orbits, each world a drawn planet (`PlanetArt`,
  `planets.js`: body, shadow, its mark, the highlight, rings and moons) with its
  name, its tag, the strike's signature badge and the done star; the chosen
  world's panel, the signature legend, and "Travel to …?" (the other worlds
  are not in this port). `HoloTable` (`holotable.js`): over the deck's table the
  desert turns, drawn by `Shaders/Planet.shader` (approach.js planetMaterial:
  the dune stripes, the hatched crescent, the highlight, self-lit), with its teal
  rim and two scan rings; it flickers on emergency power, stutters in the
  alarm, dies in the fall.
- `Sounds` / `Voice`: the recorded clips (3D where placed) and the score.
  The continuous layers are synthesised in `OnAudioFilterRead` (the wind and
  its howl in the storm, the cloak, the bike's engine, the fires' crackle).
  Voices work as in `voice.js`: each line is planned into syllables (per
  language: the desert's, home's, the ship's mechanical one) and sung by a
  small synth, its pitch and pace set by the line's tone, the mouth moving
  with it.
- `Puffs` / `FireFx`: the burning tree's landmark smoke column, its embers, the
  camp fires' smoke. `Ambient`: the weather (calm, wind, and the sandstorm that
  tints the page and hides the distance; the rain's slanted ink strokes and the
  fog banks, which the desert does not have itself but another world or the
  panel can bring: `forced`), wind-blown sand, birds in flocks,
  dust motes, footprints in the sand. `Wildlife` (`wildlife.js`): puff
  lizards, dune crabs and jerboas, with their gaits, wariness and surprises.
- `Save`: the flags, keepsakes, position and the tank's colours, as JSON in
  `persistentDataPath` (autosaved). The title offers Continue / New game.
- `Story.cs`: `GameState` (flags, events, keepsakes), `Quests` (`quests.js`:
  stages advancing on flags and arrivals, the objective and its marker),
  `DialogueRunner` (`dialogue.js`: entries, conditions, effects, pages, at
  most three answers, `once`, `next`), tones (`tone.js`).
- `DesertStory` (`story/desert.js`): the people at their places (Ama by the
  fire, the musicians, Ilo, Marrow, Hessa at the well, Nour on her bench, the
  people of Qanat, Oum on her stone, the Speaker ahead of the procession), the
  things to look at (the well, the stele, the skull's brow, the mural), the
  makers' chest on the ledge (the backpack), Qanat gathering, Teo's drum, Oum
  and Ilo following you, the rib (heaved, or pushed with the backpack), the
  stream and the rising pool, the jar, the ship; fire hurts.
- `Npc`, `Crowd`: people walking their routes or standing, lines over their
  heads; the procession walking its loop round the city in rows.
- `Bike` (`bike.js`, `story/desert-bike.js`): the tarp, waking it with the
  backpack, a hover spring over the ground, banking, braking, whistling it over.
- `Hud`, `TitleScreen` and `Runtime/UI`: the screen (below).

### The screen (`Hud.cs`, `TitleScreen.cs`, `Runtime/UI`)

uGUI built in code on a **camera-space canvas** of the game camera (1280 × 720
reference, scaled by height), so it is drawn by the camera after the ink
composite and is in every frame the camera renders, the batch shots too. The
styles are the web game's (`index.html`, `src/menus.css`):

- `Ui` is the kit: the palette, the fonts (the system's Menlo, Avenir Next and
  Futura, Roboto on Android, Unity's own as the last fallback), boxes with
  their ink frame and hard offset shadow (`Panel`; frames and rounded pills are
  generated 9-sliced sprites), text measured for manual layout, `Spaced`
  (CSS letter-spacing as a mesh effect), `Sketch` (lines, dashes, dots, rings,
  ellipses, triangles with a feathered pixel), `StrokeFont` (thin capitals
  drawn as pen strokes, for what the web sets in Avenir Next Ultra Light: the
  system offers Unity only the regular and bold weights). The text uses
  `Shaders/UIText.shader`, uGUI's own with the glyph coverage corrected for
  the linear page (blended in linear, dark ink on paper reads thin).
- `Hud`: the status box (the region from `biome.js`, gauges, the objective
  line, or the father's charge in its gold tag), the prompt floating over what
  B / ○ would use with its round key badge, speech balloons, the toast, the
  health bar, the knock-out sheet, the conversation panel (the portrait chip,
  the name tag across the top edge, the words resolving with their caret, at
  most three answers, the red "more" pointer), the charge's lettered card, the
  makers' box card, the ship's subtitles, hint and hold-to-skip bar, the
  tool's mode flash with its charges, the frame time.
- `Portrait`: the chip's portrait, rendered by a second camera through the same
  ink pipeline with only the person on its layer, against the flat tone
  `portrait-bg.js` picks for them (the composite's `_Backdrop`).
- `Journal`: the sketchbook: the father's charge card, the gear, the quest log
  (choose one and track it), the makers' boxes.
- `PauseMenu` and `Settings`: the Start menu (Menu / Esc; the game holds still):
  the gold side with its stamped brand, Resume / Sketchbook / Quit to title,
  and the settings on ruled paper (FXAA, camera sensitivity and invert Y, music,
  effects, voices, mute, the frame time, a fresh start), kept in PlayerPrefs.
- `StarMap` and `PlanetArt`: the galactic map (below, with the ship).
- `TitleScreen`: an overlay on the desert scene (the `Title` scene is the
  "sketching the world…" page, `Loading`, which opens it): the desert at golden
  hour drifting behind a soft paper veil, MEMENTO in thin capitals with its pen
  rule and gold dot, the airy menu (Continue with a save, New game, Settings,
  Quit), then the play starts in the same scene.

Everything is driven by the pad's own navigation (`Pad.NavDown`, `NavXDown`,
`ConfirmDown`, `BackDown`, `MenuDown`), so a controller reaches every screen
and the batch play-through can too.

| web (three.js) | Unity (uGUI) |
|---|---|
| ![](docs/web-ui-title.jpg) | ![](docs/unity-ui-title.jpg) |
| ![](docs/web-ui-hud.jpg) | ![](docs/unity-ui-hud.jpg) |
| ![](docs/web-ui-talk.jpg) | ![](docs/unity-ui-talk.jpg) |
| ![](docs/web-ui-journal.jpg) | ![](docs/unity-ui-journal.jpg) |
| ![](docs/web-ui-pause.jpg) | ![](docs/unity-ui-pause.jpg) |
| ![](docs/web-ui-map.jpg) | ![](docs/unity-ui-map.jpg) |

| | |
|---|---|
| ![](docs/play-charge.jpg) the father's charge, lettered over the crash | ![](docs/play-boxcard.jpg) the makers' box card |

## A standalone build

```sh
scripts/unity-export/unity-batch.sh BuildMac -out /tmp/Memento.app     # (default unity/Memento/Builds/macOS/Memento.app, git-ignored)
/tmp/Memento.app/Contents/MacOS/Memento -smoke /tmp/smoke -logFile /tmp/smoke/player.log
```

`Batch.BuildMac` puts the shaders the game finds by name into the always-included
list, sets the player (a 1280 × 720 resizable window) and builds the `Title`
scene (the loading page) and the desert; the export travels in
`StreamingAssets` (about 430 MB). With `-smoke folder` the player checks
itself (`SmokeTest.cs`): it shoots the title once the desert has loaded under
it, picks New game, shoots the prologue, skips it, shoots the desert and quits.

### What an Android build would need

- The editor's Android Build Support module (SDK, NDK, OpenJDK) from the Hub
  (only macOS and WebGL support are installed here), IL2CPP for ARM64, Vulkan
  first (the instanced crowd, puffs and wildlife read structured buffers in the
  vertex shader, which many GLES drivers do not allow).
- The export out of `StreamingAssets`: on Android those files sit inside the
  APK, where `File.ReadAllBytes` and `Directory.GetFiles` cannot reach them
  (`WorldLoader`, `Sounds`, `FigureLibrary` read them so). Copy them out to
  `persistentDataPath` on the first run (UnityWebRequest), or ship them as a Play
  Asset Delivery install-time pack: at about 430 MB the export is far over the
  base APK's limit. A lighter export (the static world's far tiles merged or
  dropped, the people's clips at 15 fps) would help the handhelds' memory too.
- The G-buffer's normal + depth target is RGBA32F: on mobile GPUs a half-float
  normal with depth in its own R32F target would halve the bandwidth.
- Fonts: Menlo and Avenir Next are Apple's; `Ui` falls back to Roboto and
  Droid Sans Mono, or a bundled open font (e.g. JetBrains Mono, Jost) could be
  shipped in the project for the same look everywhere.
- The pad's prompts in the handheld's names (the web's `native-pad.js` rewrite)
  and the Android back button as B / ○.
- The web game's Capacitor app (`android/`) is a separate thing and stays as it is.

## What is missing (next steps)

- **The traveller**: thrusting on the jets keeps the jump's pose (the web's
  rig leans into the flight).
- **The people**: the far figures have no brows (too small to see on the web too).
- **The ship**: the map's other worlds can be chosen but not travelled to; the
  ship's interior takes the sun through its hull in places.
- **Not ported**: the dev menu, the
  observatory and the masked head's chamber (exported, not playable), the
  other worlds, Android. The web title's own vista scene (the desert stands
  in for it); mouse clicks on the menus (they take the keyboard and the pad).
- **The look**: shadows are URP's, with a filter close to the web's
  hand-rolled cascades but not the same. (Sun rays are in the composite,
  `_Rays`, off in the desert's "Moebius print" preset as on the web;
  `MementoLook.rays` is the web panel's slider.) The crowd's mid-distance
  figures cast their shadows (the shadow pass poses them as the G-buffer does).

## Connecting an MCP client to the editor

The project includes the Unity side of **MCP for Unity** (CoplayDev,
`com.coplaydev.unity-mcp`, from
`https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity`, in
`Packages/manifest.json`). It runs a small bridge inside the editor that an
MCP client talks to through its Python server.

1. Open the project in the Unity editor (the bridge only runs in the editor,
   not in batch mode). **Window → MCP for Unity** shows the bridge's status.
2. Install the server side once: it needs Python 3.10+ and `uv`
   (`brew install uv`). The window's **Auto-Setup** can write the client
   configuration for Claude Code, Claude Desktop, Cursor or VS Code; or add it
   by hand, e.g. for Claude Code:

   ```sh
   claude mcp add unityMCP -- uvx --from "git+https://github.com/CoplayDev/unity-mcp@main#subdirectory=Server" mcp-for-unity
   ```

   (check the package's README for the current command; organisation policies
   may require the server to be approved first).
3. With the editor open and the bridge running, the client can read the scene,
   the console, run menu items (Memento → Set up project), enter play mode and
   take screenshots.
