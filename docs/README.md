# Hiraeth's documentation

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
| [story-audit.md](story-audit.md) | the October 2026 story audit: every world's beat against what you can do, what was thin, pacing, what was fixed, proposals for the author |
| [fun-and-story-review.md](fun-and-story-review.md) | the October 2026 review of the experience's shape: the ending before the peak, the unanswered light, choices, pacing; ranked recommendations |
| [what-makes-a-great-game.md](what-makes-a-great-game.md) | research: what makes a great (exploration) game, in twelve themes with audit questions and sources |
| [audits/](audits/) | the audits, one file per kind and version: the game against those twelve themes ([game, v0.97](audits/game-v0.97.md), [game, v1.0](audits/game-v1.0.md)), performance ([v1.0](audits/perf-v1.0.md), [v1.40: the Arena's full pack and the props in fewer draws](audits/perf-v1.40.md)), visual quality ([v1.0](audits/visual-v1.0.md), [v1.4: the probes](audits/visual-v1.4.md), [v1.21: the probes' fixes](audits/visual-v1.21.md)), the ink lines at every distance and resolution ([v1.33: far plants, the traveller's eyes from afar, small frames](audits/ink-lines-v1.34.md)), the dialogue ([v1.0](audits/dialogue-v1.0.md)), the combat ([v1.4](audits/combat-v1.4.md), [v1.6: body telegraphs, the guardians' staged fights](audits/combat-v1.6.md), [v1.8: the enemy roster's batch 1](audits/combat-v1.8.md), [v1.9: batch 2](audits/combat-v1.9.md), [v1.13: batch 3](audits/combat-v1.13.md), [v1.16: batch 4, the machines](audits/combat-v1.16.md), [v1.18: batch 5, the shade, the roller, the marionette](audits/combat-v1.18.md), [v1.22: the whole roster, balance and sound, the curve world by world](audits/combat-v1.22.md)), the worlds' level design ([v1.5](audits/level-design-v1.5.md), [v1.9: the desert and Vael reworked](audits/level-design-v1.9.md), [v1.15: the City-Shaft, a second way home in the desert and Vael, leading lines](audits/level-design-v1.15.md), [v1.17: the round's small fixes](audits/level-design-v1.17.md), [v1.20: every way home passes something new](audits/level-design-v1.20.md), [v1.23: the loners pulled in, a high place in each flat world](audits/level-design-v1.23.md)) and the temples' design ([v1.5](audits/temple-design-v1.5.md), [v1.8: the Belfry, the Hush-House and the Lamp-House reworked](audits/temple-design-v1.8.md), [v1.12: the Undertower and the First Garage reworked](audits/temple-design-v1.12.md), [v1.16: the Builders' Greenhouse and the Aerie reworked](audits/temple-design-v1.16.md), [v1.19: the Warden's Well and the Engine-House reworked](audits/temple-design-v1.19.md), [v1.24: the Givers’ House and the Footprint reworked, the four rules across the eleven](audits/temple-design-v1.24.md), [v1.27: no gadget door beside the chest, the openings without discs, the four rules done](audits/temple-design-v1.27.md)) and their looks ([v1.31: each house its own palette, stone and light, after its picks](audits/temple-visuals-v1.32.md)); run them with the `game-audit`, `perf-audit`, `visual-audit`, `ink-lines`, `dialogue-review`, `combat-review`, `level-design-qc` and `temple-design-qc` skills (`.claude/skills/`); each starts with an `audit-scores` block, and Debug → Audits (`audits.html`, ui.md "The audits page") reads them all with their scores and compares versions |
| [design/enemy-roster.md](design/enemy-roster.md) | **proposal, awaiting the author's approval:** 21 enemy archetypes replacing the 100 world enemies and the 15 old kinds (silhouette, body plan, role, telegraphed attacks and counterplay, idle, references, world skins), the world table, the difficulty curve, what is retired, the build order; the contact sheet `design/enemy-roster-sheet.jpg` (`node scripts/enemy-roster/sheet.cjs`) |
| [design/enemy-roster-prompts.md](design/enemy-roster-prompts.md) | the Midjourney prompts for fresh reference sheets, one per archetype (four views, the wind-up pose, the silhouette, the scale figure, the joints spelled out) plus one alternate world skin each; how to run them, where to save them and how to pick |
| [world-principles.md](world-principles.md) | the fundamental world principles: the world notices you, living things, connection, restraint |
| [../lore/README.md](../lore/README.md), [../LORE.md](../LORE.md) | the writing room and the lore |

## System notes (`docs/systems/`)

| File | What |
|---|---|
| [controls.md](systems/controls.md) | keyboard, mouse, touch and the tool; remapping (your own keys and buttons); the controller layout by position, prompts; the controls of October 2026 |
| [foes.md](systems/foes.md) | the fluid blade, the ink blots in the wilds, the makers' machines in the temples, the Enemies setting, the Arena; the damage table (hearts); the enemy roster and its procedural surfaces (patterns, glow and gloss painted by the shader); building or reworking an enemy to its sheets: the `enemy-rework` skill (`.claude/skills/enemy-rework/`) |
| [movement.md](systems/movement.md) | collision, contact (what you stand on and climb is what is drawn; the contact audit), mounts that come to you, footprints, the paraglider, hazards, health and falls, the hoverbike and vehicles, the feel of the jump and stamina |
| [movement-and-camera.md](systems/movement-and-camera.md) | movement and the camera, the third feedback round: the jets fly like a plane (v0.89), aiming straight up, ragdolls that end on the ground, the jump’s shadow; the camera QC (`.claude/skills/camera-qc`) and what it fixed in tight places (v1.40) |
| [animation.md](systems/animation.md) | climbing and mantling, the rig review, ragdolls, hands, locomotion (feet, starts, stops, turns), Vael's bird (standing, folding, flying), motion capture and motion matching, the motion QC (skill `motion-qc`, `scripts/motion-qc/`), the Motion page |
| [procedural-animation.md](systems/procedural-animation.md) | procedural animation for creatures and machines: the research (IK, gaits, springs, chains, telegraph poses, LOD, the ink look) with sources, why the foes walked stiffly (measured), the locomotion kit for ~20 body plans, the phased plan; skill `procedural-animation`, `scripts/motion-audit/` |
| [characters.md](systems/characters.md) | the traveller, people of every height and build, the character studio, MakeHuman bodies, capes, costumes, the traveller's reference redesign |
| [capes-at-every-distance.md](systems/capes-at-every-distance.md) | capes and robes that look the same at every distance and through every switch of detail |
| [traveller-kit.md](systems/traveller-kit.md) | the traveller's kit: the rucksack, the flask and their hooks |
| [aliens.md](systems/aliens.md) | the non-humanoid peoples: drifters, stilt-walkers, shellbacks and murmurs; their bodies, voices, tones without a face, reactions to the tool |
| [faces.md](systems/faces.md) | the shader face, expressions and hairstyles, hair and talking faces, eyes, faces drawn the Moebius way, warmer faces |
| [rendering.md](systems/rendering.md) | how the look is built (the passes), the developer panel, time of day, the print look, drawn textures, the beauty pass, who casts a shadow, stable in motion (the motion check), thin bars at any distance, half-transparent surfaces (Lorn II's glass mushrooms), z-fighting found by geometry and kept out (the `zfight-qc` skill, `.claude/skills/zfight-qc/`) |
| [rendering.md](systems/rendering.md) | how the look is built (the passes), the developer panel, time of day, the print look, drawn textures, the beauty pass, who casts a shadow, stable in motion (the motion check), thin bars at any distance, half-transparent surfaces (Lorn II’s glass mushrooms), the Shadow Room and the shadow QC (`?level=shadows`, `.claude/skills/shadow-qc`) |
| [materials.md](systems/materials.md) | shade and hatching by surface, weathered walls, ground ink by distance, metals and the makers' inscriptions, faster surfaces and shader compiles |
| [performance.md](systems/performance.md) | phone rendering, quality, culling and the Handheld preset, rooms off the map, levels of detail, hand-overs and loads without a hitch |
| [worlds.md](systems/worlds.md) | the levels, regions and wind, interiors, the terrain, each world's places, sand drifts, the singing spheres, Qanat, the ship's deck, Home, merged and dismissed worlds (`src/levels/dismissed/`) |
| [living-world.md](systems/living-world.md) | responsive worlds, birds, wildlife, flora, brushing past plants, flowers with room to open |
| [water.md](systems/water.md) | the water look and swimming |
| [temples.md](systems/temples.md) | the makers' temples |
| [boss-hints.md](systems/boss-hints.md) | the guardians: the bar of what is left of them, the drone's hints |
| [hints.md](systems/hints.md) | hints off / subtle / full: the one setting every prompt, tip, nudge and the drone's help goes through; keys taken out of lines; the quiet glyph (audit: `docs/design/hints-audit.md`) |
| [story.md](systems/story.md) | the story's systems: quests, errands, the father's charge, every world's story, the ending, the route and the galactic map, the strike's signature, the recordings, the desert reworked, quests that fail, the fellow traveller (Tansy) |
| [progression.md](systems/progression.md) | progression: the route, the wings before the jets, the cab pass, Vael's bird |
| [dialogue.md](systems/dialogue.md) | conversations and answers, listening, alien voices and the translator, the worlds' scripts, highlights, keys in lines (`{key:aim}`), the conversation camera |
| [conversations.md](systems/conversations.md) | conversations: the camera's cut, the close shot of the traveller's face, holding still while he talks, fires kept out of the shot, who gets a balloon, the gap between two people, the translator |
| [cinematics.md](systems/cinematics.md) | the ship's cutscenes and the burning tree, moments (first times, filmed) |
| [cinematics-qc.md](systems/cinematics-qc.md) | the cinematics' quality control: the script that plays every one headless, the checklist, the scores of the October 2026 pass and what it fixed |
| [ship.md](systems/ship.md) | the traveller's ship, the angular hull of October 2026: what the selected reference fixes, the human-scale blockout (rooms, doors, ceiling, walkways), the hull's dimensions and section, the rooms inside it |
| [ship-consoles.md](systems/ship-consoles.md) | the ship's two consoles: the voicemail and the holo table |
| [scout.md](systems/scout.md) | the scout drone |
| [items.md](systems/items.md) | items, the backpack and the makers' boxes; hearts, the magic bar and potions (src/resources.js); chimes; the shops, their wares and prices |
| [interiors.md](systems/interiors.md) | buildings you walk into: the interior kit (a shopfront, its room far overhead, the doors both ways, saving inside), a shop's room |
| [gadgets.md](systems/gadgets.md) | the gadgets (v0.90): the framework (one file a gadget), the buttons, the grappling hook, ink bombs, the Gadget Yard; how to add one |
| [boxes.md](systems/boxes.md) | the makers' chests (the v1.42 redesign, the same in every world; the temples' bud): the models, the opening scene, the placements |
| [changelog.md](systems/changelog.md) | the interactive changelog: before / after pictures, numbers and how to see each change; the capture tool; why its pictures stay off the devices |
| [localisation.md](systems/localisation.md) | the game's words in the player's language (`t()`, English as the source, French): what is covered, adding a language, how to bring the dialogue in |
| [ui.md](systems/ui.md) | playing and settings (and accessibility: text size, speech background, reduced motion, hold or toggle, not by colour alone), the changelog page, a quieter screen, the title screen and saves, nothing on the screen, the game menu (items, quests, sketchbook, worlds, people), the audits page |
| [audio.md](systems/audio.md) | sound from the first frame, musicians' solos, the score world by world |
| [android.md](systems/android.md) | the APK, signing, over-the-air updates, updates from the site, GeckoView |
| [platforms.md](systems/platforms.md) | installing on iPhone, the Steam Deck |
| [xbox.md](systems/xbox.md) | the Xbox Dev Mode package: the UWP app, its updates and saves, signing, CI, deploying and measuring on the console |
| [xbox-setup.md](xbox-setup.md) | playing on your Xbox in Developer Mode, step by step: sign-up, activation, installing |
| [app-icon.md](systems/app-icon.md) | the app icon: a capture of a reference view, every size made from it |
| [references.md](systems/references.md) | the `references/` folder's layout (`levels/<World>/environment, characters, places`, the retired world enemies in `archive/world-enemies/`, the guard on its paths), the references page (`references.html`, Debug → References, on the site too: every picture by world and folder with its prompt and provenance; the deploy writes its index, thumbnails and web copies, `scripts/references-site.mjs`) and the References level: the reference sheets rebuilt as views |
| [minigames.md](systems/minigames.md) | the minigames: the runner (start card, 3-2-1, HUD, pause, results, the best in the save), the Games row and the arcade sign, how to add a game (options, a best per difficulty, games on foot), Dune skiing, Sky steps, the Canyon run, Fishing, the Ring race, the Wing drop, the shooting gallery, Ink tide, the Drum circle, the Sketch hunt; Chime pirates, the rail shooter in space that is the first flight to a new world (the trip: `src/ambush.js`) |
| [challenges.md](systems/challenges.md) | challenges in the open world: the sign, the start card, the run's clock and goal, the best, Retry, the quiet reward; each world's trial and the makers' runs (the temples' kit and pieces in the open: one a world, from the Wind hall to the Vine walk and the Bell crossing) |
| [reference-lab.md](systems/reference-lab.md) | the reference lab: reference pictures from several image AIs (OpenAI, Gemini, fal, BFL) side by side, picked into `references/` with a manifest; the keys in `.env.local`, costs, the page (dev server only) and the CLI `scripts/gen-reference.mjs` |
| [dev-tools.md](systems/dev-tools.md) | the Debug menu, the Lab, the worlds list's debug save, the clipping audit |
| [testing.md](systems/testing.md) | the tests, their shards on GitHub and the rules for heavy tests, and the play-through: the route played from the crash to home in node, old saves resumed, the page's own flows in a headless Chrome |
| [unity.md](systems/unity.md) | the desert in Unity, and the web-against-Unity benchmark |
| [engine-bridge.md](systems/engine-bridge.md) | the game's JavaScript inside Godot (GodotJS) and Unity (Puerts), the engine only drawing: the scene mirror, the platform stand-ins |

## Deployment and data

| File | What |
|---|---|
| [cloudflare.md](cloudflare.md) | the Cloudflare Worker that serves the game and its update feed |
| [notes.md](systems/notes.md) | the private notebook: one-line notes backed by GitHub Issues, Worker secrets and access setup |
| [steam-deck.md](steam-deck.md) | the Steam Deck package: install, release, its updates from the site and the settings' Updates section |
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
