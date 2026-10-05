# Memento's documentation

The repository's [README](../README.md) says what the game is and how to run, test and ship it.
Everything else is here.

- **Design** at the root of `docs/`: what the game is meant to be.
- **System notes** in `docs/systems/`, one file per topic: how each part works, where its code
  is, what its tests check. A new system gets a short section in the file of its topic (or a
  new file here, listed below).
- **The archive** in `docs/archive/`: superseded notes and old measurements, kept as they were.

Until October 2026 all the system notes were one long README, written version by version; it
was split into the files below without rewording (the old README is in git history, at
`29db3c7:README.md`). Inside a file the sections still follow the order they were written in.
References to other sections read `docs/systems/<file>.md, "Section"`.

## Design

| File | What |
|---|---|
| [game-brief.md](game-brief.md) | the brief and its working decisions |
| [story-bible.md](story-bible.md) | each world's story, quests, keepsake and clue |
| [world-principles.md](world-principles.md) | the fundamental world principles: the world notices you, living things, connection, restraint |
| [../lore/README.md](../lore/README.md), [../LORE.md](../LORE.md) | the writing room and the lore |

## System notes (`docs/systems/`)

| File | What |
|---|---|
| [controls.md](systems/controls.md) | keyboard, mouse, touch and the tool; the controller layout by position, prompts; the controls of October 2026 |
| [movement.md](systems/movement.md) | collision, mounts that come to you, footprints, the paraglider, hazards, health and falls, the hoverbike and vehicles, the feel of the jump and stamina |
| [animation.md](systems/animation.md) | climbing and mantling, the rig review, ragdolls, hands, locomotion (feet, starts, stops, turns), motion capture and motion matching, the Motion page |
| [characters.md](systems/characters.md) | the traveller, people of every height and build, the character studio, MakeHuman bodies, capes, costumes, the traveller's reference redesign |
| [faces.md](systems/faces.md) | the shader face, expressions and hairstyles, hair and talking faces, eyes, faces drawn the Moebius way, warmer faces |
| [rendering.md](systems/rendering.md) | how the look is built (the passes), the developer panel, time of day, the print look, drawn textures, the beauty pass, who casts a shadow |
| [materials.md](systems/materials.md) | shade and hatching by surface, weathered walls, ground ink by distance, metals and the makers' inscriptions, faster surfaces and shader compiles |
| [performance.md](systems/performance.md) | phone rendering, quality, culling and the Handheld preset, rooms off the map, levels of detail, hand-overs and loads without a hitch |
| [worlds.md](systems/worlds.md) | the levels, regions and wind, interiors, the terrain, each world's places, sand drifts, the singing spheres, Qanat, the ship's deck, Home |
| [living-world.md](systems/living-world.md) | responsive worlds, birds, wildlife, flora, brushing past plants, flowers with room to open |
| [water.md](systems/water.md) | the water look and swimming |
| [temples.md](systems/temples.md) | the makers' temples |
| [story.md](systems/story.md) | the story's systems: quests, errands, the father's charge, every world's story, the ending, the route and the galactic map, the strike's signature, the recordings, the desert reworked, quests that fail |
| [dialogue.md](systems/dialogue.md) | conversations and answers, listening, alien voices and the translator, the worlds' scripts, highlights, the conversation camera |
| [cinematics.md](systems/cinematics.md) | the ship's cutscenes and the burning tree, moments (first times, filmed) |
| [scout.md](systems/scout.md) | the scout drone |
| [items.md](systems/items.md) | items, the backpack and the makers' boxes |
| [ui.md](systems/ui.md) | playing and settings, the changelog page, a quieter screen, the title screen and saves, nothing on the screen |
| [audio.md](systems/audio.md) | sound from the first frame, musicians' solos, the score world by world |
| [android.md](systems/android.md) | the APK, signing, over-the-air updates, updates from the site, GeckoView |
| [platforms.md](systems/platforms.md) | installing on iPhone, the Steam Deck |
| [references.md](systems/references.md) | the References level: the reference sheets rebuilt as views |
| [dev-tools.md](systems/dev-tools.md) | the Lab, the clipping audit |
| [unity.md](systems/unity.md) | the desert in Unity, and the web-against-Unity benchmark |

## Deployment and data

| File | What |
|---|---|
| [cloudflare.md](cloudflare.md) | the Cloudflare Worker that serves the game and its update feed |
| [steam-deck.md](steam-deck.md) | the Steam Deck package: install and release |
| [makehuman.md](makehuman.md) | the MakeHuman / MPFB bodies pipeline (pictures in `makehuman/`) |
| [motion-data.md](motion-data.md) | motion data: sources, terms, what is shipped |
| [mixamo-shopping-list.md](mixamo-shopping-list.md) | the Mixamo clips the matcher lacks |
| [benchmark-web-vs-unity.md](benchmark-web-vs-unity.md) | the web game against the Unity port, on the Mac and the Retroid |
| [credits.md](credits.md) | third-party animation, bodies and motion capture, and their licences |

## Archive (`docs/archive/`)

| File | What |
|---|---|
| [traveller-looks.md](archive/traveller-looks.md) | the rider (v0.14) and the lavender-suited hero (v0.15), before the traveller of today |
| [retroid-measurements.md](archive/retroid-measurements.md) | the Retroid Pocket Nova measured in October 2026 (WebView 109 against Chrome 154, frame times per world) and how to repeat it |
