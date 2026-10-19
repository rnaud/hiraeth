// What's new, version by version (newest first). Shown in the game with N or
// from the settings menu; after an update a note points you to it once.
// Add an entry at the top for every release. A line is its text, or { text, shots, numbers, see }
// with what the interactive changelog (changelog.html) shows beside it: docs/systems/changelog.md
// (pictures and numbers for older lines live in src/changelog-media.js).

import { store } from './platform.js';
import { glyph } from './pad-glyphs.js';

export const CHANGELOG = [
  { v: '1.85', date: '2026-10-18', items: [
    // issue #474: src/music-moments.js (MUSIC_MODES, musicMode: Always the default), src/ui.js (musicMode, musicV: a saved
    // Moments from before goes to Always once), src/audio.js musicModeSetting; tests/music-moments.test.js, engine-menus.test.js
    'Each world’s own recorded music now plays the whole time you are there, out in the open as well as on arriving, indoors and at the big moments. If you liked it better the old way, with the music for the moments and quieter, lighter tunes in between, choose Moments under Settings > Music plays.',
    // issue #478: src/temples/garage-data.js, bazaar-data.js (keeper), bazaar.js enterLine, Wim's lines;
    // tests/keeper-direction.test.js (each keeper step's and enter line's up or down against the guardian's hall)
    'The Clock-House’s and the Undertower’s last steps now point the right way: their guardians wait upstairs, and the steps used to say go down.',
    // issue #480: src/fight-temples/session.js coloursLine (the save's own items, read before the run lends its kit),
    // fight-temples/index.js rules; src/story/rumours.js (a host's lacks(): not told of), story/index.js addHost;
    // tests/fight-temples.test.js, tests/rumours.test.js
    // issue #509: src/foes.js Foes.env.seen (a plain { x, y, z } from the toad's perch search, src/foe-height.js findPerch),
    // src/main.js (a foe that throws no longer ends the frame loop, as in the engines); tests/engine-lock-lorn.test.js
    { text: 'In Lorn, locking on to a bellows toad near a bank or a rise in the ground no longer freezes the game. As the toad looked for high ground to spit from, its search broke and the game stopped.',
      see: 'In Lorn, stand at the foot of a bank or a rock, lock on to a toad (R3 / Tab) and let it come for you: it climbs to the high ground to spit from, and the game carries on.' },
    'The fight temples’ end card no longer says your sword and shield wear the new colours before you have them: they take them once found. And people no longer tell of a game you can’t play yet, a trial that wants the hoverbike or a gadget you haven’t found.',
    // issue #485: src/beam-stop.js (beamStop, bodyHit), src/temples/pieces.js Sentry beamLength, src/fluid-blade.js
    // shieldFace / covers / faceFor; tests/sentry.test.js
    'In the Rose House, the watcher’s aiming beam now stops at your shield when you hold it up, and at you when you don’t, instead of running on through you and out the other side.',
    // issue #489: src/bird.js buildBird (the wings' tones by row, WING_TONE_GAP); tests/bird-wing-tones.test.js
    'Riding the bird in Vael, her wings no longer shimmer as they beat. Their feathers took turns in two tones, and seen from the saddle each wing was a bundle of thin lines crawling with every stroke; now each row of feathers is one tone.',
    // issue #468: src/world-map.js drawTerrainSteps (WorldMap.pump draws the picture a part at a time in its budget);
    // tests/world-map.test.js; docs/systems/performance.md "Stutters"
    { text: 'Opening the Map for the first time in a world no longer freezes the game for a moment: its ground is drawn a little each frame while the page says how far along it is. In the Unity version the longest frame of a trip through the menus and the Map went from about 190 ms to 29.',
      numbers: [{ title: 'Opening the Start menu, the game menu\'s pages and the Map (twice each run), the longest frame, before → after', unit: 'ms', better: 'lower', device: 'Mac (Apple M4 Pro), the Unity version (macOS development player), High, 1280 × 720, uncapped, muted', rows: [
        { where: 'first run', before: 198.0, after: 28.1 },
        { where: 'second run', before: 175.3, after: 29.3 },
        { where: 'frames over 33 ms, both runs', before: 11, after: 0 },
      ], source: 'docs/systems/performance.md, "Stutters"' }] },
    // issue #468 phase 2: src/foe-shapes.js (shareShapes, disposeOwnShapes), src/foes.js (shapes, spares, warmModels keep),
    // engine/game.js (the roster built in the load); tests/foe-shapes.test.js; docs/systems/performance.md "Stutters", phase 2
    { text: 'Foes arriving no longer freeze the game for a moment, most of all on the Retroid and in the Unity version: every foe of a kind now shares one body shape instead of building its own, and the foes a world can field are prepared while it loads. When a brute and a swarm of skitters come in, the longest frame on the Retroid is about half what it was.',
      numbers: [{ title: 'A brute and a swarm of skitters coming in (the Arena), the longest frame, before → after', unit: 'ms', better: 'lower', device: 'Retroid Pocket 5, the Unity version (Handheld, a development build), muted',
        rows: [
        { where: 'first run', before: 155.2, after: 70.2 },
        { where: 'second run', before: 142.4, after: 88.5 },
      ], source: 'docs/systems/performance.md, "Stutters", phase 2' }] },
    // issue #484: scripts/steam-deck/deck.py (choose_engine: unity always, no --engine / deckEngine kill switch;
    // launch_unity_watched, wait_for_unity, unity_failed, show_error / busy_dialog; add_shortcut / shortcut_stale take
    // launch-web and launch-unity out of shortcuts.vdf, no Electron launch); release-info.mjs webJson; tests/test_steam_deck.py
    { text: 'On the Steam Deck, Hiraeth is now one game in your library and always starts the Unity version. It no longer slips into the older web version when the Unity one is slow to start or not downloaded yet: a first start downloads it with a progress bar on the screen, and if it truly cannot start, a message says so and you are back in your library. The Hiraeth (web) shortcut leaves your library the next time the game updates while Steam is closed.',
      see: 'On the Steam Deck, start Hiraeth from the library: it opens the Unity version every time. After an update with Steam closed (or a restart of the Deck), Hiraeth (web) is no longer in the library.' },
    // issue #502: unity/Hiraeth LightAdd.hlsl, DoorLight.shader, Veil.shader (a light added to the picture in two blends as the
    // web adds it), BridgeRenderer; engine/game.js (the water's bed baked), engine/water-bed.js, engine/mirror.js (_Bed,
    // uBedBox, uBedRef), Surface.shader waterDepth; scripts/design-qc/capture.mjs (the pinned eye for the frame's updates);
    // tests/unity-light-add.test.js, tests/unity-water-bed.test.js
    'In the Unity version, the first room of every makers’ house is as light as on the web: the glow of the way you came in by brightens it as it does there, where before the whole room came out grey and dim. And Lorn’s lake has its pale shallows along the shores again, the water darkening as it deepens.',
    // issue #515: engine/game.js (the pad's 'call' to player.callMount, as main.js); tests/engine-call.test.js
    'In the Unity version, D-pad ↓ calls your mount again: in Lorn the skiff comes over to you, as it always did on the web.',
    // issue #514: src/levels/perdide.js buildSkiff (SKIFF_SHEET: the sail and its boom sheeted out; SKIFF_HULL), src/bike.js
    // Hoverbike.hull / sweepHull; tests/skiff.test.js
    'Lorn’s skiff is solid end to end: its bow, its stern and the float off its side stop at the small crystals rising from the water instead of sailing through them. Its sail is set out over the side now, so it no longer runs through your face as you ride.',
    // issue #507: src/minigames/kit/minigames.css (the main button edged, the focused one filled red), unity BridgeMenu.cs
    // BuildCard; tests/minigame-card-focus.test.js
    'In the games’ menus (the start card, the pause, the results), the button you are on is now the one drawn in colour, filled red as in the other menus. Retry, Start or Resume no longer look picked when they aren’t: a red edge at their left says which one Enter presses.',
    // issue #516: src/game-menu.js questsPanel (trackPrompt, the TRACKING tag), game-menu.css .qcard.tracked / .qtrack,
    // engine/menus.js gameView (track), unity BridgeMenu.Chrome.cs QuestCard; tests/quests-tracking.test.js
    'On the Quests page, the quest you are tracking now stands out, framed in red with a TRACKING tag, and the quest you are on shows the button to track it instead (A / × on a controller, Enter on the keyboard).',
    // issue #508: src/enemies/gaze.js (gazePart, gazeAim, gazeApply), Foes.look, each plan's `gaze`; brute.js GAZE_TWIST;
    // tests/foe-gaze.test.js, tests/foe-gaze-mirror.test.js; docs/systems/foes.md "Eyes on the traveller"
    'Creatures and machines now look at you once they have noticed you: the crab’s eye stalks lean your way, the toad’s eyes turn in their sockets, the lizard, the hound and the heron turn their heads, the wisp’s eyes slide over its petals and the brute’s brass eye follows you round as its body twists to you. Left alone, they look where they are going.',
    // issue #521: src/temples/air.js HOUSE_AIR.perdide2 (its sparks: 26 not 40, 0.028 not 0.035, glow 0.75, alpha 0.75)
    'The fireflies drifting in the dark of Lorn’s Lamp-House are fewer, smaller and softer: little sparks again, not a hall of floating lamps.',
    // issue #488: src/audio.js CALL_TUNE (tune(): 0.16 → 0.028); tests/sound-mix.test.js
    'In Vael, the rider’s call you play on the bone flute to bring the bird down is quieter: it now sits with the world’s music instead of ringing out over it.',
    // issue #522: src/temples/pieces.js BALL_PUSH (4.2 + 4.5 → 4.5 + 12 × strength), END_BOUNCE; tests/ball-push.test.js
    'The gun’s push sends the makers’ balls much further: about half the pushes for a long roll. Push from further back for a gentle nudge onto a nearby plate.',
    // issue #523: src/player.js GLIDE_SINK (still air out in the world: 2.4 → 1.9, flaring 1.3 → 1.05; houses as they were); tests/glide-open.test.js
    'Out in the open, the wings carry you about a quarter further on still air. Inside the makers’ houses they glide as before.',
  ] },
  { v: '1.84', date: '2026-10-17', items: [
    // issue #439: src/costumes.js (HEADS: the 47 pieces of the 15 hat sets, HAT_SETS, HAT_SET_WORLDS, hoodShell / hoodNeck /
    // hoodEdge; each tribe's heads; the sets' colours last in dressFor), crowd-shader.js / crowd.js / Crowd.hlsl (HEAD_ID_LIMIT 128,
    // zones brass, ivory, clay); tests/hat-share.test.js, tests/makehuman-worlds.test.js; docs/systems/characters.md "The hat sets"
    'Every people now wears hats of its own, modelled from the design sheets picked for each world: pale lacquered hats on the City-Shaft’s rim, patched caps and goggle bands in its middle levels and rag hoods at the bottom; caps that leave the listeners’ ears clear; woven reed hats and moss hoods in Lorn; plain turbans, tasselled caps, porters’ head-pads and printed scarves in the Signal Market; the pilgrims’ headcloths with their cord and modest straw cones in the desert; bell wimples at the monastery; padded dome hoods and lamp hats in the mine; and so on in every world, each in its sheet’s colours. As many people wear a hat as before, and the same people.',
    // issue #434: src/companion.js (the name on its lines, the first word, places, StepWatch, FightWatch, GAP), src/scout.js
    // escort, src/ship/prologue-drone.js and the prologue's `drone` stage, interior.js DOCK, ship.js AUTO_WALK, desert.js
    // drone:village; tests/companion.test.js, tests/prologue-drone.test.js, tests/scout.test.js
    'Your ship’s little drone has a name now, Plumb, and its lines say so. In the opening you see it wake in its charging cradle by the hatch and come to your shoulder; you walk down the ramp, not run, and once outside Plumb says your best bet is the village on the horizon, where someone might help you both recharge, and flies off toward it. After that it speaks up only when you seem lost: where to go next, a word on what waits in a makers’ house after a long while on one step, or a guardian’s weak point as a fight drags on. Never two lines within the minute, and Hints off quiets it.',
    // issue #16: unity/Hiraeth BridgeRunner (the drawn prewarm off on the Xbox, -draw-prewarm); tests/unity-xbox.test.js;
    // docs/systems/performance.md "The Xbox's load, round three"
    { text: 'On the Xbox, the Unity preview reaches the world about 9 seconds sooner each time you start it after the first: 44 s to the Desert instead of 53, 42 s to the City-Shaft instead of 51.',
      numbers: [{ title: 'Launch to the world’s first frame on the Xbox, a launch after the first, before → after', unit: 's', better: 'lower', device: 'Xbox Series X, the Unity preview (Direct3D 12), 4K TV, muted', rows: [
        { where: 'the Desert', before: 53.1, after: 44.1 },
        { where: 'the City-Shaft', before: 50.9, after: 41.9 },
      ], source: 'docs/systems/performance.md, "The Xbox\'s load, round three"' }] },
    // issue #443: unity/Hiraeth BridgePso (XboxBatch, WarmUpProgressively, -pso-progressive), StreamingAssets/hiraeth-pso/
    // Direct3D12.graphicsstate; tests/unity-xbox.test.js, tests/unity-pso.test.js; docs/systems/performance.md "The Xbox's load, round four"
    'On the Xbox, the Unity preview reaches the Desert about 7 seconds sooner, cold or warm: it starts preparing the first views’ graphics while the title shows, a few at a time, so the title and the loading screen stay smooth. The City-Shaft loads about as before.',
    // issue #404 round 10: unity/Hiraeth InstLod.cs (each instanced mesh's coarser levels, made on a worker thread, picked by
    // their stray in pixels), InstMats (Wildlife.cs) DrawLevels / CastLevels; tests/unity-instance-lod.test.js;
    // docs/systems/performance.md "Unity on the Retroid, round 10"
    { text: 'In the Unity version on handhelds, the City-Shaft runs smoother where you arrive: its far trees across the shaft are drawn with fewer triangles, too few pixels to see the difference. On the Retroid Pocket 5 the arrival view runs at 51 frames a second instead of 45.',
      numbers: [{ title: 'The City-Shaft on the Retroid, frames a second, before → after', unit: 'fps', better: 'higher', device: 'Retroid Pocket 5, the Unity version, Handheld preset (FSR 1 at 0.67 of 1280 × 960), muted', rows: [
        { where: 'the arrival view', before: 45.2, after: 51.3 },
        { where: 'the second crowd', before: 59.3, after: 60.1 },
        { where: 'the wide view', before: 37.8, after: 38.4 },
      ], source: 'docs/systems/performance.md, "Unity on the Retroid, round 10"' }] },
    // issue #404 round 11: unity/Hiraeth Surface.shader HIRAETH_LEAN_SCRUB / HIRAETH_LEAN_GLASS, BridgeRenderer.Lean (RareCount,
    // leanRare), BridgeShaderStrip; tests/unity-lean-rare.test.js; docs/systems/performance.md "Unity on the Retroid, round 11"
    { text: 'In the Unity version on handhelds, the City-Shaft’s trees and Underwater’s glass are drawn with a lighter version of their shader that gives the same picture. On the Retroid Pocket 5 the City-Shaft’s wide view, the slowest of the game there, runs at 42 frames a second instead of 38, its arrival view at 54 instead of 51, and Underwater’s arrival reaches 60.',
      numbers: [{ title: 'The City-Shaft and Underwater on the Retroid, frames a second, before → after', unit: 'fps', better: 'higher', device: 'Retroid Pocket 5, the Unity version, Handheld preset (FSR 1 at 0.67 of 1280 × 960), muted', rows: [
        { where: 'the City-Shaft, the wide view', before: 38.5, after: 42.5 },
        { where: 'the City-Shaft, the arrival view', before: 51.3, after: 54.5 },
        { where: 'Underwater, the arrival view', before: 57.8, after: 60.0 },
        { where: 'Underwater, the wide view', before: 52.1, after: 54.3 },
      ], source: 'docs/systems/performance.md, "Unity on the Retroid, round 11"' }] },
    // issue #456 round 12: unity/Hiraeth HiraethCommon.hlsl rockCracks / voronoiBorder (the web's early-outs);
    // tests/unity-retroid-r12.test.js; docs/systems/performance.md "Unity on the Retroid, round 12"
    { text: 'In the Unity version on handhelds, Lorn runs smoother where you arrive: the cracks on the forest’s far trunks, too small to draw there, are no longer worked out pixel by pixel, as the browser version already did, so the picture is the same. On the Retroid Pocket 5 the arrival view runs at 46 frames a second instead of 44, and the view toward the keepers at 50 instead of 48.',
      numbers: [{ title: 'Lorn on the Retroid, frames a second, before → after', unit: 'fps', better: 'higher', device: 'Retroid Pocket 5, the Unity version, Handheld preset (FSR 1 at 0.67 of 1280 × 960), muted', rows: [
        { where: 'the arrival view', before: 43.6, after: 46.1 },
        { where: 'the first crowd', before: 47.5, after: 50.4 },
        { where: 'the second crowd', before: 60.1, after: 60.1 },
        { where: 'the wide view', before: 60.1, after: 60.1 },
      ], source: 'docs/systems/performance.md, "Unity on the Retroid, round 12"' }] },
    // issue #469: unity/Hiraeth Surface.shader (the fragment's test switches on uniforms alone: -far-debug removed, the NaN
    // test's pixel check inside its branch), BridgeRunner; tests/unity-retroid-r13.test.js; docs/systems/performance.md
    // "Unity on the Retroid, round 13"
    { text: 'In the Unity version on handhelds, every world runs smoother again: a test left in the shader for measuring had made every pixel of the world a little slower to draw. On the Retroid Pocket 5 the City-Shaft’s wide view runs at 41 frames a second instead of 39, the Signal Market’s arrival at 54 instead of 51, Lorn’s arrival at 48 instead of 46 and Underwater’s wide view at 51 instead of 48. The picture is the same.',
      numbers: [{ title: 'The slowest views on the Retroid, frames a second, before → after', unit: 'fps', better: 'higher', device: 'Retroid Pocket 5, the Unity version, Handheld preset (FSR 1 at 0.67 of 1280 × 960), muted', rows: [
        { where: 'the City-Shaft, the wide view', before: 38.6, after: 40.9 },
        { where: 'the City-Shaft, the arrival view', before: 50.7, after: 52.8 },
        { where: 'the Signal Market, the arrival view', before: 51.4, after: 54.5 },
        { where: 'the Signal Market, the wide view', before: 55.2, after: 58.9 },
        { where: 'Lorn, the arrival view', before: 46.3, after: 48.3 },
        { where: 'Lorn, the first crowd', before: 50.1, after: 52.6 },
        { where: 'Underwater, the arrival view', before: 52.3, after: 55.5 },
        { where: 'Underwater, the wide view', before: 47.8, after: 50.8 },
      ], source: 'docs/systems/performance.md, "Unity on the Retroid, round 13"' }] },
    // issue #450: src/ragdoll.js (groundHitAt, RAG.reuse, rayAt / rayTop / rayH / rayN / rayBase), src/physics.js groundHit /
    // baseHit; tests/ragdoll.test.js; docs/systems/animation.md "Ragdolls", docs/systems/performance.md "CPU round 2 (#450)"
    { text: 'Being knocked over no longer makes the game stutter on a slow processor: the falling body looks for the ground under each limb once a frame instead of twice in every small step, and falls exactly as before. With this Mac’s processor slowed four times, as a stand-in for a handheld’s, a tumble down the City-Shaft takes 0.7 ms of each frame instead of 3.8.',
      numbers: [{ title: 'A knock-down’s fall, ms of each frame, before → after', unit: 'ms', better: 'lower', device: 'this Mac (M4 Pro), headless Chrome, the CPU slowed ×4, Handheld; the old and the new ragdoll stepped side by side from the same pose at 1/30 s', rows: [
        { where: 'the City-Shaft, run off the ledge down the shaft', before: 3.8, after: 0.73 },
        { where: 'the City-Shaft, knocked over where he stands', before: 0.65, after: 0.13 },
        { where: 'the Signal Market, knocked over', before: 0.56, after: 0.16 },
        { where: 'the Desert’s dunes, knocked over', before: 0.48, after: 0.16 },
      ], source: 'docs/systems/performance.md, "CPU round 2 (#450)": 89 ground rays a frame → 16, the fall the same to 0.01 mm' }] },
    // issue #450: src/perf.js handheld peopleLod, src/main.js offView from this frame's view (src/motion-kit/view.js viewNow /
    // inViewNow), src/npc.js; tests/deck-levers.test.js; docs/systems/performance.md "CPU round 2 (#450)"
    { text: 'On the Handheld setting, people out of your view more than 30 m away move on a quarter of the frames, as on the Steam Deck, and catch up the moment they come back into view, so nobody you can see is ever a step behind, even when you swing the camera round fast. With this Mac’s processor slowed four times, the people take about half a millisecond less of each frame in the City-Shaft.',
      numbers: [{ title: 'The people’s update, ms of each frame, before → after (two runs each)', unit: 'ms', better: 'lower', device: 'this Mac (M4 Pro), headless Chrome, the CPU slowed ×4, Handheld; the setting turned off and on in turns in the same page', rows: [
        { where: 'the City-Shaft, where you arrive', before: 1.9, after: 1.24 },
        { where: 'the City-Shaft, its densest crowd', before: 2.76, after: 2.24 },
        { where: 'the Signal Market, where you arrive', before: 2.57, after: 2.34 },
      ], source: 'docs/systems/performance.md, "CPU round 2 (#450)": people posed a frame 7.5 → 4.2 (the City-Shaft), 7 → 4.7 (its crowd), 11 → 8.8 (the Market)' }] },
    // issue #453: src/static-batch.js (unrolled, shadowReason), src/instance-merge.js, src/flat-pass.js, src/main.js
    // (crowdShadowless, crowdView); tests/static-batch.test.js, tests/instance-merge.test.js; docs/systems/performance.md
    // "CPU round 3 (#453)"
    { text: 'In the browser and the Android app, a frame asks the graphics chip for up to 23 % fewer drawings, which helps on a slow processor: distant buildings no longer drop out of their shared batch when they switch to a simpler shape, the City-Shaft’s trees and the desert’s pebbles in one place are drawn together, the crowd no longer asks for drawings of nobody, and more still things cast their shadows together. The picture is exactly the same.',
      numbers: [{ title: 'Drawing the world (the shadow maps and the view) at a quarter of the processor’s speed, ms a frame, before → after (two runs each)', unit: 'ms', better: 'lower', device: 'this Mac (M4 Pro), headless Chrome, the CPU slowed ×4, Handheld, 1280 × 633, standing at the start; the changes turned off and on in turns in the same page', rows: [
        { where: 'the Desert (377 → 319 drawings a frame)', before: 14.4, after: 13.51 },
        { where: 'the City-Shaft (435 → 359)', before: 12.44, after: 12.04 },
        { where: 'the Signal Market (388 → 299)', before: 9.93, after: 8.62 },
        { where: 'Lorn (375 → 350)', before: 10.11, after: 9.62 },
        { where: 'the Underwater City (342 → 301)', before: 8.06, after: 7.38 },
        { where: 'the City-Shaft’s densest crowd (431 → 360)', before: 10.91, after: 10.36 },
      ], source: 'docs/systems/performance.md, "CPU round 3 (#453)": whole frames 30.3 → 31.5 fps in the Desert, 40.4 → 43.5 in the Market, 49.6 → 51.9 Underwater at ×4' }] },
    // issue #442: src/fight-temples/rules.js rollInput / rollKey, index.js (the card), session.js; src/fluid-blade.js
    // QUICK_CUT, quickSwing, rollCancels, ROLL.buffer; src/fight-temples/kill-fx.js, src/audio.js foeKill; hazards.js
    // LINGERING; tests/fight-feel.test.js; docs/design/fight-temples.md "The roll, the quick cut and readable kills"
    'In the fight temples the roll is on the button printed B on every controller: B / ○ on Xbox and PlayStation pads, and the bottom button on a pad or handheld with Nintendo letters, like the Retroid, where the button printed A used to roll. A does nothing in there.',
    'In the fight temples the sword is about a third quicker: each cut of the combo draws back and follows through faster, the three cuts taking 1.2 s instead of 1.7 s, and the pause after the third is shorter.',
    'In the fight temples a roll cuts a swing off: pressed while the sword is drawn back or following through, you roll at once. Pressed during the cut itself, the cut lands and the roll comes the moment it ends.',
    'Foes felled in the fight temples are easy to see from up there: the blow throws the body back about a metre and it goes down quicker, a ring flashes on the floor, ink splashes out with a wet thump, and a star of ink stays where it fell for a few seconds before it dries away. When many fall at once each leaves its stain, but only a few ring and splash.',
    'A roll takes you through every hazard of the fight temples unharmed: gusts, millstones, ore carts, falling loads, the eyes’ flash and the toll as well as slag, oil, broken glass, the dark and the shade. Rolling across burning ground no longer flashes as a perfect dodge.',
    // issue #436: src/player.js HOUSE_GLIDE, glideSink, Player.inHouse (runtime.js connect: P.houses), src/temples/pieces.js
    // WingAir, AIR_LEAD (Updraft, Gust), arzach.js (the well's, the Eyrie gap's, the Gulf's and the Roost's breath), incal.js
    // (the drum's at the high ledge), audio.js wings
    // heavy; tests/wings-reach.js, tests/engine-wings.test.js
    'Inside the makers’ houses the wings now glide heavy: they open as a brake and come down steeply, with a lower, duller flap, so a running jump, the double jump and a glide no longer carry you over a chasm before its bridge or gate is open. Out in the world they glide as before, and moving air still carries them indoors: the columns, the gusts, the Warden’s Well’s draught out to its high ledge, and in the Aerie the breath of the Wind Well, the Eyrie’s gap, the Gulf and the Roost, so their glides work as they did.',
    // issue #427 round 2: src/host/game-host.js (wireCamera, cameraFollow, wireBenches, wireTrails, wireEdge, wireOpenings, wireSky, wirePotion, wireNudges, fragmentsLine…), engine/game.js; tests/game-host.test.js
    'In the Unity version, the camera and the world round you behave as on the web too: the camera stays out of the cabs and carriers instead of passing through them; riding the bike or the bird, the camera takes the ride’s own view, and on the jets it comes round behind and tips with you, pulling back the faster you fly; the benches are there to sit on; the hoverbike and the skiff leave their glowing trails behind them; leaning on a world’s edge, the wind streams in round you and the ink shimmers where you touch it; in the Lab each biome room puts on its own world’s look, planets and hour; a potion’s hearts come back in a warm glow, and the first time you are hurt short of hearts you are told how to drink one; where a world wants to show you the way at once, the drone points it out; and the Start menu counts the fragments of the singing light you have found.',
    // issue #440: src/enemies/plans/ember.js (the bud: petals on hinges, the ring, the cup, the drips; EMBER.open, sit),
    // skins.js and surfaces.js wisp; tests/fireball.test.js; docs/design/enemy-roster.md row 22
    'The ember wisp has its real body now, drawn from its design sheet: a pointed bud of four glossy black ink petals edged in gold, closed round its glowing coal, with a thin ring of light round its waist, two lilac eyes and three drips of ink hanging beneath. Before it throws its fireball, the petals open wide like a flower round the coal as it swells white-hot. Knocked down by its own fire, it rests just above the ground with its petals hanging open.',
    // issue #472: src/enemies/skins.js wisp.perdide2 (palette from wisp/sheet-4.jpg, the 'brass' prop), plans/ember.js
    // (a brass ring; the drips' own material under lichen), surfaces.js wisp.perdide2
    'Lorn II’s marsh wisp now wears the colours of its own design sheet: mossy green-black petals patched with pale lichen rosettes, a brass band round its waist in place of the ring of light, plain ink drips, pale green eyes and a cold green marsh-light for a coal.',
    // issue #441: src/levels/ports.js (each city's port as data), src/levels/port-pad.js (the shared kit: pad layers,
    // pieces, craft in flight, attachPort), src/levels/port-craft.js (the craft), the nine levels, content.js (the staff);
    // tests/ports.test.js; docs/systems/worlds.md "Space ports"
    'The City Floating in Space’s Pier is a real port now, drawn after its picked design: red bands round the deck, blue iron hoops hung off its rim with a moorer’s boat in three of them, a lamp-mast and the harbour hut by the bridge, and round-bellied sky-boats crossing the dark. It replaces the plain docks of the last version.',
    'The City-Shaft and the Signal Market have space ports round your ship. On the shaft’s rim, lacquered pink and lilac cradles reach out over the drop either side of your way to the edge, a gantry crane lowers a crate into the shaft, and three cabs wait at a stand. In the Market your ship stands on a ruled apron under a tall board of call-signs, one board dark, with a courier, a yellow walker and a hauler parked by it.',
    'The Underwater City and the Glass Dunes have ports too. On the Dock’s dome a coral pontoon ring with brass rims lies under your ship, with a little cupola and two pods moored, and round pods glide between the domes. In the Glass Dunes your ship stands on a pale stone landing disc in a yard of ochre canvases, racks of green glass floats, float-sledges and a glass skiff.',
    'The cities off the route have ports as well: rows of lamp-topped pylons and a mirror tower on the Eclipse city’s esplanade, stakes and old mooring ropes round your ship on Salt Harbour’s salt with a mast crane and a sand-skiff, a gantry and couriers on the Waterfall’s ledge, and a rust-orange crane with an ore bucket at the Buried Machine’s freight stage.',
    'Each port has someone who runs it: Orla keeps the Pier’s harbour book, Faro wardens the City-Shaft’s rim docks, Ludo logs the Signal Market’s call-signs, Mabyn keeps the Float Yard’s tally, Cato walks ships in on the Eclipse city’s esplanade, Tully keeps the Waterfall’s ledge and Dace loads the Buried Machine’s freight.',
    // issue #451: src/levels/port-berth.js (the berths' motion), port-pad.js buildBerth (the lock, the cradle), ports.js
    // (UNDERWATER_PORT.berth, INCAL_PORT.berth), src/ship/cinematics.js (the berth's step in the arrival and the take-off),
    // ship.js berth / berthPos; tests/port-berth.test.js; docs/systems/worlds.md "Space ports"
    'In the Underwater City your ship now comes down the Dock’s lock: it sets down on the lift’s coral plate high between four teal columns banded in brass, and the lock lowers it onto the dome before the ramp opens. When you leave, the lock lifts it up again and it takes off from there.',
    'On the City-Shaft’s rim your ship now sets down into a lacquered cradle hung between two tall towers: the cradle, swung out toward the shaft, swings it in over the rim’s paving, rocks past its place and settles before the ramp opens. When you leave, it swings the ship out again and it lifts off from the cradle.',
    // issue #435: src/host/game-host.js (wireHealth, hurtReactions, wireFight, wireAmbush), engine/combat.js, engine/game.js,
    // engine/trials.js, engine/unity/game.js; tests/game-host.test.js, tests/engine-trials.test.js
    'In the Unity version, fights answer as on the web: fire and spines burn at the web’s rate (they bit twice as fast), a blow lands with a dull thud under the cry, the hearts stay up for the whole fight, the chimes count up into the wallet, the fight temples and the games shake the camera on a hit, the chime-pirates meet the ship on its first flight to a new world, and in the Lab R3 and L3 hop between the worlds’ rooms.',
    // issue #427 round 4: src/host/game-host.js (toolGauge, wireJumpShade), src/ui.js ToolHud state, src/hud.js healthHud
    // (magicFill, magicShort), unity BridgeHud.Tool.cs, BridgeHud DrawHealth, Hiraeth/JumpShade, engine/game.js (walks.glb,
    // moves.glb, `back`), engine/unity/game.js; tests/game-host.test.js, tests/engine-trials.test.js
    'In the Unity version, the fluid gun shows what it does as on the web: aiming puts the inked crosshair in the middle of the screen with the mode’s name under it, red and turned on what it would lock, faint when the tank is empty, kicking on a hit; a mode switch shows its name beside you a moment, and a tank run dry says “empty” there. The magic bar has its ticks between units and turns pale and hatched when there is not enough left for a shot.',
    'In the Unity version, a patch of shade lies under you whenever you jump, fall or glide, so you can judge where you will land, as on the web. The traveller’s captured jumps, idles, starts and stops and the people’s own walks play there too, and “Back to the Arcade” puts you in front of the game you just played.',
    // issue #461: unity BridgeHud DrawHealth (Heart: the quarters, their lines, the glint; the flask from src/hud.js POTION_SVG,
    // scripts/engine-bundle.mjs hud-potion), engine/ui-poses.js hearts0..4, heartslow, potions, potionsnone; tests/hud.test.js
    'In the Unity version, the hearts and the potion look as on the web: a part-filled heart fills by its quarters with thin lines between them (it filled round like a clock), its glint and shadow as on the web, the last heart pulsing when you are low; the potion beside them is the corked flask with its red draught (it was a red blob), its count in the web’s heavy figures, faded when you have none.',
    // issue #447: src/levels/waterfall.js NICHE (the arch, the hall, the dock), src/levels/ports.js WATERFALL_PORT,
    // port-pad.js gantry and blots; port-craft.js skyboat, port-pad.js ring (the boat's scale); docs/systems/worlds.md
    'The City Behind the Waterfall’s landing is a proper port now, closer to its design: a docking niche is cut into the cliff ahead of your ship, its arch opening on a lit hall with a loading dock and steps up to it, a gantry bolted over it with a crate on its cable, crates on the dock and at its foot, puddles and moss on the wet stone, and a second courier parked beside the first. Tully waits by the niche.',
    'The City Floating in Space’s sky-boats are longer and rounder, as on their design: a nine-metre capsule with its top and its belly in two colours, a long low cabin with lit windows, portholes down each side, two lamps in the nose and a fin and a screw at the tail. The boats moored in the Pier’s hoops sit inside them.',
    // issue #421: src/boxes/index.js migrateSave (an engines' save: no legacy backpack, the bike back under its tarp), run by
    // engine/game.js createGame as main.js runs it; engine/sequences.js 'hoverbike'; tests/boxes.test.js
    'In the Unity version, a new game no longer hands you the desert’s hoverbike as the opening ends. It lies under Marrow’s tarp in the hollow by the red rag again, and finding it starts its errand, as on the web. A save that was given it that way gets it back under the tarp.',
    // issue #424: unity BridgeHud.Loading.cs (the page's #loading), BridgeHost.LoadStage, engine/game.js onStage;
    // tests/engine-unity.test.js
    'In the Unity version, a world loads behind the same inked page as on the web, the pen turning in its rings and a line saying what is being drawn, where the screen used to stay black.',
    // issue #422: src/prompt-keys.js leadKey, src/hud.js Cue (the cue's key apart), unity BridgeHud.Glyph.cs; tests/hud.test.js
    'In the Unity version, the use button over a person or a thing is the round button alone, as on the web, instead of a dark strip, and a hint that names a button shows the button as a badge before its words.',
    // issue #423: unity BridgeMenu.Pause.cs (the Start menu as src/menus.css .fullmenu), BridgeMenu.Chrome.cs (the game menu as
    // src/game-menu.css #journal: the desk, the tabs, the sheet, the quest cards, the strip), the page's face (Ui.Sans) for the
    // menus and the HUD; engine/menus.js (the brand, a setting's kind); tests/world-map.test.js
    'In the Unity version, the menus look like the web’s: the pause screen’s yellow side with PAUSED in big lettering and its buttons in thick ink, the settings on ruled paper with their sliders, switches and boxes, the game menu’s tabs, quest cards and strip on a warm desk, and every menu, hint and conversation in the web’s own typeface instead of a typewriter’s.',
    // issue #449: unity BridgeHud.cs DrawRestart (the page's #restart: the dim, the card, its gold button)
    'In the Unity version, the world dims behind the “You were knocked out” card as it does on the web, and the card sits high with its gold Restart button.',
    // issue #425 (and #420's cut-up shafts): unity HiraethFeature.cs _GFlip, the washes' GAt (Veil, PitVoid, DoorLight, Mote,
    // Wisp, HoloFigure); engine/sequences.js 'pits', 'skull-cave'
    'In the Unity version, the dark of the makers’ houses’ deadly pits no longer shows through walls, and the shafts of light, the doorways’ glow, the floating motes and the recordings’ figures are hidden behind what stands in front of them again: drawn straight to the screen, they had read the scene’s depth upside down.',
    // issue #420: unity Veil.shader (a laid-over wash's alpha for the linear blend); engine/sequences.js 'skull-cave'
    'In the Unity version, the shafts of light in the skull cave and the makers’ houses are as soft and pale as on the web, no longer bright white slabs.',
    // issue #264: unity Surface.shader HIRAETH_FIGHT, FoeSurface.hlsl (scripts/unity-export/foe-hlsl.mjs), engine/foe-pack.js;
    // engine/sequences.js 'foes'; docs/systems/engine-bridge.md "The fight's surfaces"
    'In the Unity version, the foes wear the patterns painted on them as on the web: the crabs’ star spots and mottling, the lizards’ scales and banded bellies, the centipede’s rivets and rust, the moths’ glowing lanterns, and the brute’s glowing cracks, which open wider as you hurt it. Before, each was its plain colours.',
    // issue #264: unity BladeSurface.hlsl (scripts/unity-export/blade-hlsl.mjs), the blade's numbers live (engine/mirror.js), aFold
    // with the bind (engine/unity/pack.js)
    'In the Unity version, your sword’s blade is living water again: turquoise with cream currents and rising bubbles, a bright wavering edge, bowing back through a swing, a ring of light running along it when it hits; the guard’s shield too. Before, it was a thin grey blade.',
    // issue #264: unity Surface.shader's see-through hole (materials.js SEE_HOLE: _See, _SeeK live), the glass's lean variant
    'In the Unity version of the fight temples, a wall or pillar between you and the camera opens a ragged hole round you, as on the web, so a fight is never hidden behind it.',
    // issue #264: unity Surface.shader _LampTint, HiraethLook _LampsOn (materials.js LAMP_TINT)
    'In the Unity version, the lamps of the City During the Eclipse, the makers’ houses and the ship’s rooms pool their own warm colour on the floor round them, as on the web, instead of a white glare.',
    // issue #448: src/flat-pass.js (the passes drawn from the scene's flat list, not a walk each), main.js renderFrame;
    // tests/flat-pass.test.js; docs/systems/performance.md "CPU round 1 (#448)"
    { text: 'In the browser and the Android app, each frame takes less work to get ready to draw on a slow processor: the world is looked over once a frame to find what is in view, instead of once for every picture the frame is made of (its shadows and the view itself). The picture is exactly the same.',
      numbers: [{ title: 'Drawing the world (the shadow map and the view) at a quarter of the processor’s speed, ms a frame, before → after', unit: 'ms', better: 'lower', device: 'MacBook Pro (M4 Pro), headless Chrome, the CPU slowed 4× (a weak handheld’s stand-in), Handheld preset, 1280 × 633, standing at the start', rows: [
        { where: 'the Desert', before: 13.34, after: 12.05 },
        { where: 'the City-Shaft', before: 10.81, after: 10.24 },
        { where: 'the Signal Market', before: 11.01, after: 9.68 },
        { where: 'Lorn', before: 13.27, after: 11.61 },
        { where: 'the Underwater City', before: 10.24, after: 9.19 },
        { where: 'the Rose House’s fight', before: 6.88, after: 5.92 },
      ], source: 'docs/systems/performance.md, "CPU round 1 (#448)"', note: 'The same build with the change off and on in turn, six rounds of 2 s each, the median of each; the pixels of a frame drawn both ways are identical.' }] },
    // issue #264: unity BridgeMenu.Shop.cs (src/shop-panel.css #shop: the bubble, the wallet, the wares' cards in a grid),
    // BridgeMenu.Arcade.cs (the Arcade's board as the page's), BridgeMenu.cs DrawCard (the page's face, the dashed rules);
    // engine/menus.js shopCols / card fields, scripts/engine-bundle.mjs (the wares' pictures as PNGs); tests/engine-menus.test.js
    'In the Unity version, the shops, the Arcade’s board and a game’s cards look like the web’s: the keeper’s line in a speech bubble and the wares as cards with their pictures and prices, the games as inked cards with their coloured dots, and the cards in the web’s typeface with their rules in a dashed box.',
    // issue #264 (#430's rows): engine/menus.js SETTINGS_ROWS (the page's groups, order and words; `when`), settingRows;
    // engine/game.js applySettings (the jets' pitch); tests/engine-menus.test.js
    'In the Unity version, Settings is laid out as on the web, in its groups (Screen and text, Camera and motion, Controls, Sound, Game) and order, and it has the web’s alien voices, run and guard, enemies and drone hints settings too.',
    // issue #264 (#430's credits): src/ship/homecoming.js Credits (the screen's 'credits' part, creditsPart), unity
    // BridgeHud.Credits.cs; tests/engine-finishable.test.js
    'In the Unity version, the true ending’s credits roll up the screen on their paper page, the worlds and the people you met, as on the web, instead of being read out a line at a time.',
    // issue #264: engine/trials.js arcadeLinks, engine/unity/game.js leaveGame; engine/game.js (a game on foot runs under its
    // card); tests/engine-trials.test.js, tests/sequences-play.test.js
    'In the Unity version, a game started from the Arcade offers the game before and after and the way back to the Arcade on its cards, and a fight temple’s start card shows its hall from above, as on the web.',
    // issue #455: engine/mirror.js `noticed`, engine/mirror-notices.js (hooks and attributes noticed), engine/scene-matrices.js
    // `track`; tests/mirror-noticed.test.js, scripts/unity-compare/mirror-stream.mjs; docs/systems/performance.md "Unity mirror: only what changed (#455)"
    { text: 'In the Unity version, each frame spends less time copying the world over to Unity: only what changed is looked at again, not every building and rock. Up to 3 more frames a second in the City-Shaft and the Signal Market. And a lamp’s brief pulse in the Underwater City, which Unity used to miss, now shows.',
      numbers: [{ title: 'Frames a second, before → after', unit: 'fps', better: 'higher', device: 'Steam Deck, the Unity version (Linux player), 1280 × 800, uncapped, the Deck’s own preset', rows: [
        { where: 'the Desert, at the ship', before: 71.8, after: 73.4 },
        { where: 'the Desert, the camps', before: 64.7, after: 66.9 },
        { where: 'the City-Shaft, the start', before: 55.6, after: 57.1 },
        { where: 'the City-Shaft, the crowd', before: 55.3, after: 58.2 },
        { where: 'the Signal Market, the start', before: 78.7, after: 80.1 },
        { where: 'the Signal Market, the crowd', before: 90.3, after: 93.1 },
        { where: 'Lorn, the start', before: 75.1, after: 75.8 },
        { where: 'Lorn, the crowd', before: 78.2, after: 78.6 },
        { where: 'the Underwater City, the start', before: 84.6, after: 84.4 },
        { where: 'the Underwater City, the crowd', before: 76.5, after: 77.5 },
      ], source: 'docs/systems/performance.md, "Unity mirror: only what changed (#455)"', note: 'The same player with the script before and after, two runs of each view (6 s measured), averaged; what Unity is sent is the same, byte for byte, as when it looks at everything every frame.' }] },
    // issue #264 surfaces B: unity/Hiraeth Surface.shader (_MirrorOn mirrorWorld, _NightOn, waterVeins, _SplatOn), HiraethCommon.hlsl
    // brushLean (op 28), BridgeRenderer.Breathe, WorldLoader; engine/unity port-format.js, pack.js, backend.js; engine/mirror.js
    // LIVE_VECTORS; engine/sequences.js grass-splats; tests/unity-surfaces-b.test.js; docs/systems/engine-bridge.md "Surfaces B"
    'In the Unity version, more of the world moves and shines as on the web: the Garden’s still lake shows the far shore and the garden it remembers upside down in it, the Signal Market’s billboards turn into lit screens after dark, the Buried Machine’s great pistons slide out of the canyon walls and its vents puff steam, Lorn’s crystal veins glow under the water, the fluid’s splats pop out and shrink away instead of standing whole, and the grass parts along the last steps you took, not only round your feet.',
    // issue #264: engine/game.js takes level.defaults.cloudShadows (as main.js)
    'In the Unity version, the worlds that have no drifting cloud shadows on the web (Lorn, Viridel, the Garden, the Signal Market and most others) have none in Unity either: Lorn’s marsh was all in shade, and Viridel’s far white tower under a cloud.',
    // issue #457: src/levels/underwater-kit.js glassColumns (later / draw, level.beforeDraw: main.js renderFrame, engine/game.js),
    // src/matrix-cache.js SubtreeList (EDITS, engine/scene-matrices.js); tests/glass-columns.test.js, tests/matrix-lists.test.js;
    // docs/systems/performance.md "The game's update on the Deck (#457)"
    { text: 'The game’s own work each frame is lighter on slow processors: the Underwater City’s rising bubbles are only worked out where you can see them, and the posing of the traveller and the people walks their skeletons faster. In the Unity version on the Steam Deck that is up to 7 more frames a second in the Underwater City and up to 2 more in the other worlds.',
      numbers: [{ title: 'Frames a second, before → after', unit: 'fps', better: 'higher', device: 'Steam Deck, the Unity version (Linux player), 1280 × 800, uncapped, the Deck’s own preset', rows: [
        { where: 'the Desert, at the ship', before: 72.6, after: 75.1 },
        { where: 'the Desert, the camps', before: 65.4, after: 67.7 },
        { where: 'the City-Shaft, the start', before: 57.1, after: 58.1 },
        { where: 'the City-Shaft, the crowd', before: 58.4, after: 60.6 },
        { where: 'the Signal Market, the start', before: 81.0, after: 82.1 },
        { where: 'the Signal Market, the crowd', before: 92.1, after: 94.3 },
        { where: 'Lorn, the start', before: 75.1, after: 76.6 },
        { where: 'Lorn, the crowd', before: 77.9, after: 77.5 },
        { where: 'the Underwater City, the start', before: 85.7, after: 90.9 },
        { where: 'the Underwater City, the crowd', before: 79.1, after: 86.5 },
      ], source: 'docs/systems/performance.md, "The game\'s update on the Deck (#457)"', note: 'The same player with the script before and after, two runs of each view (6 s measured), averaged; what Unity is sent is the same, frame for frame, except the bubbles out of view, which are no longer moved.' }] },
    // issue #460: src/physics.js dropBuriedInstancesSteps (embedded, own collider, sure; UpColumn), Physics.sure;
    // tests/buried-columns.test.js; docs/systems/performance.md "The buried-tree checks (#460)"
    { text: 'Arriving in the City-Shaft, the game’s check that no far-off tree stands inside a house takes about half the time, with the same trees in the end: on the Steam Deck it is done half a minute after you arrive instead of nearly a minute, and the frames it slowed are back to full speed that much sooner.',
      numbers: [{ title: 'The City-Shaft after the load, before → after (two runs each, averaged)', unit: 's', better: 'lower', device: 'Steam Deck, the Unity version (Linux player), 1280 × 800, uncapped; this Mac (M4 Pro), headless Chrome, the CPU slowed ×4, High', rows: [
        { where: 'the Deck: the checks done, after the first frame', before: 54, after: 31 },
        { where: 'the Deck: their script time in all', before: 12.2, after: 7.2 },
        { where: 'the Deck: the near ones, before the first frame', before: 1.64, after: 1.12 },
        { where: 'the web ×4: the checks done, after the first frame', before: 114, after: 72 },
        { where: 'the web ×4: their script time in all', before: 10.6, after: 6.7 },
      ], source: 'docs/systems/performance.md, "The buried-tree checks (#460)"', note: 'The same player (and page) with the script before and after, standing at the start; the checks share each frame’s 2 ms as before, so the frames while they run are as before (on the Deck 74–79 fps) and the ones after they end faster (from 31 s to 54 s: 80 → 94 fps). The same trees dropped in all fourteen worlds, and what Unity is sent the same, frame for frame.' }] },
    // issue #459: src/host/game-host.js wireVehicles (the vehicle's interactable, boardPrompt); unity/Hiraeth BridgeHud.cs (the
    // letterbox on the page's 1.1 s cubic-bezier, CssEase; Relayout for a batch shot), Surface.shader Offset, port-format.js /
    // ink-spec.js offset, WorldLoader; traveller-b3.js noSplat; engine/sequences.js bird, splat; tests/unity-splat.test.js,
    // tests/unity-letterbox.test.js, tests/game-host.test.js
    'In the Unity version, “ride the bird” shows over the bird when you stand by it, as on the web; a scene’s black bars slide in as slowly and smoothly as on the web’s; and the fluid’s splats lie whole on the ground the moment they land (the ground hid them, in part or all, a beat longer).',
    // issue #264 surfaces C: unity/Hiraeth Fall.hlsl (src/waterfall-shader.js fallLook), Surface.shader _FallOn (full variant:
    // BridgeRenderer.Lean "fall"), WorldLoader, engine/unity/port-format.js; tests/unity-surfaces-c.test.js;
    // docs/systems/engine-bridge.md "Surfaces C: the water"
    'In the Unity version the waterfalls fall as on the web: the great curtain over the City Behind the Waterfall and its small deep fall stream down in bands of teal, turquoise and white with pen streaks, glassy at the lip and misty at the foot, with slits you can see through; the Buried Machine’s oil fall, Viridel’s stair fall and the Glass Dunes’ sand falls too. They were flat sheets.',
    // issue #458: unity/Hiraeth WaterOver.shader (src/water.js WaterPass), HiraethFeature CompositePass, BridgeRunner.Water;
    // Surface.shader waterLook's glints (WATER_MARK); src/water.js underLook / overState; engine/game.js keepCamera, waterOver;
    // engine/unity/backend.js water; tests/unity-surfaces-c.test.js; docs/systems/engine-bridge.md "Surfaces C: the water"
    'In the Unity version the water looks as on the web from below and in the sun: under water the view sinks into the water’s colour in flat bands, and in the Underwater City pale shafts of light come down from the sea’s surface and caustics play on the floors, behind the halls’ glass too; above water the sun glints in white dashes on the water toward it (not on the Handheld, Steam Deck and Xbox presets, as on the web). Sounds are muffled under water there too, and the camera no longer stops half in, half out of the water.',
    // issue #463: engine/unity/port-format.js DECAL_OFFSET (every decal three pulls in front, the splats aside), BridgePrewarm's
    // state key with the offset; engine/sequences.js decals; tests/unity-decals.test.js; docs/systems/engine-bridge.md "Parity bits"
    'In the Unity version, the marks lying on the desert’s ground are drawn whole, as on the web: the sand river’s pale ribbon, the tide lines along the dry wash, the salt pan, the basin’s wet shore, the sand banked against things and the crash’s scrapes no longer break into jagged pieces with the ground showing through.',
    // issue #264 surfaces D: engine/unity/backend.js morphKeys / morphKeyDeltas, engine/mirror.js (morphTargetInfluences, LIVE_VECTORS
    // uHeadSpeech, uPortraitBlink, uCutMe, uLineWhite), port-format.js (portraitFace, surfD, cutMe, lineWhite, colorWrite → hidden),
    // ink-spec.js, engine/game.js; unity/Hiraeth PortraitFace.hlsl, Surface.shader (_TripoFace 2, _SurfD, the cut, the white line,
    // the plants' lean), Composite.shader (white lines, a mover's taps), HiraethLook (_HeroCut), WorldLoader, BridgeRenderer;
    // tests/unity-surfaces-d.test.js; docs/systems/engine-bridge.md "Surfaces D"
    // issue #470: engine/unity/game.js showMenu (the menus' state sent again when the canvas width changes), BridgeMenu.cs
    // (drawn again on a change of size), BridgeRunner.ScreenAs / -title-shots; tests/engine-unity.test.js;
    // docs/systems/engine-bridge.md "The title on any screen"
    'In the Unity version, the title’s name sits centred across the top on every screen, as on the web: on the Retroid’s 4:3 screen it opened pushed aside the first time, and a window resized or a screen turned kept the old layout.',
    // issue #465: unity/Hiraeth StreamingAssets/hiraeth-pso/Vulkan.graphicsstate traced again (168 states of 52 variants),
    // scripts/bench/deck-pso-trace.mjs (the detours, the moves pass, the decals' sequences); docs/systems/performance.md
    // "The Deck's pipeline list traced again (#465)"
    'In the Unity version on the Steam Deck, the first launch after an update no longer freezes for three and a half seconds just after a world with foes appears: what the game needs to draw the foes, the water from below, the waterfalls, the shade under a jump and the marks on the ground is now made ready while the world loads (that one loading takes 2–3 seconds longer).',
    'In the Unity version, the traveller’s face moves as on the web: he blinks, smiles, raises his brows and opens his mouth as he talks (it stayed still). The ship’s rooms keep their shading strokes clear instead of a grey blur; plants lean away from you along the path you walk through them; the camera pressed into the traveller leaves him out of the view; a struck foe’s lines flash white; and the shading round foes by a wall no longer darkens round them.',
    // issue #471: src/soundtracks.js (setThemeWait, a late theme cued as an arrival), engine/unity/music.js themeArrival,
    // engine/unity/game.js; unity/Hiraeth BridgeArgs.cs StreamingFile.Read (a folder's file read as one inside the APK);
    // tests/soundtracks.test.js; docs/systems/audio.md "The themes on a device"
    'Each world’s own recorded music now plays the first time you land there, on the Xbox and in the Android app too, where it is downloaded the first time it is needed: it comes in as soon as it has arrived, faded in. Before, the Unity version played the game’s synthesised score for your whole first visit to every world but the Desert, and the Android app could wait minutes for the next moment to bring it in.',
    // issue #473: scripts/tripo/bake-eye-paint.mjs (public/characters/traveller-v1/head-v3/eye-paint.png, portrait-head.js
    // PORTRAIT_EYE_PAINT), engine/boot.js encodedPicture, engine/game.js, ink-spec.js, port-format.js (phEyeBox, phEye),
    // backend.js (_EyePaint, -js-off eyepaint), mirror.js LIVE_VECTORS uHeadEye; unity/Hiraeth PortraitFace.hlsl
    // portraitEyePaint, Surface.shader, WorldLoader, BridgeRenderer, BridgeBuild; tests/unity-eye-paint.test.js;
    // docs/systems/engine-bridge.md "His eyes at the texture's detail"
    'In the Unity version, the traveller’s eyes and brows are as sharp as on the web: close up and in conversations they were soft, blurred patches, and now they show the white, the iris, the pupil and its glint and the fine lash lines. People’s eyes are drawn as on the web too: a crisp ring round the iris, a clear glint, the lids open at rest and a lash line along them.',
  ] },
  { v: '1.83', date: '2026-10-16', items: [
    // issue #406: src/temples/desert.js (ROOMS, LOGIC: hall, balcony, ballK, kS, dE, sentry in the hall, d3), pieces.js Ball
    // `hole` without a gate, migrate.js desert v5, save-migrate.js GIVERS_DONE; tests/temples.test.js, tests/sentry.test.js
    'The Rose House is built round a Great Hall now, 84 m long, with a balcony up one side. From the door you see the cistern’s door at its far end, the watcher asleep before it, and a little chest in a cage beside a locked door: the house’s first small key. Find the way up to the balcony, take the Givers’ blade there, and cut the ball into the hole so it drops onto the plate by the cage, then jump down after it. The key opens the east wing, and the watcher now guards the cistern’s door in the hall.',
    // issue #430: src/balloon-part.js, src/hud-shows.js; the balloons, objective, cargo, endCard, breath and level parts
    // (BridgeHud.Parts.cs); the Arcade's board in engine/menus.js (BridgeMenu.cs DrawArcade); tests/engine-ui-parts.test.js
    'In the Unity version, everything the web game shows on the screen now shows there too: people’s speech balloons over their heads, the homecoming’s objective, cargo check and end card, the breath meter under water, the brass level and the Arcade’s board of games. The cargo check now waits for you to press A / × as it does on the web, and the hints, prompts and hearts come and go at the same moments as on the web.',
    // issue #427: src/host/game-host.js (one game setup for both hosts: wireKit, wireDangers, wirePeople, wireChemistry, wireMount, wireVehicles, wireLessons, wireShip…), engine/game.js; tests/game-host.test.js;
    // docs/systems/engine-bridge.md "One host"
    'In the Unity version, more of the game works as it does on the web: the sword and the shield hang on the traveller only once you have found them, and foes come out of the wilds only once you carry the sword; the backpack, the sword and the shield wear the colours you won in the fight temples; fires burn you when you walk into them, spread from bramble to bramble on the wind and send the animals running, and the animals keep off the ship; where the bird answers your call, the hoverbike still waits by the ship’s ramp, and it skims over water; the deadly dark shows below a world’s edge; people give you their errands to carry, and the Quests page lists them; whoever talks near you says it with their face; and the Map marks your ship.',
    // issue #407: src/temples/arzach.js (WELL, PASSAGE, FLEDGE, SILL, Cushion, STACK.chute, the layout), migrate.js arzach v5;
    // tests/temples.test.js; docs/systems/temples.md "The Aerie round a great hall"
    // issue #411: src/temples/edena.js (ROOMS.potting the Palm House, GALLERY, BASIN, VINE, FRAME_LIFT, SLUICE, HIGH/LOW,
    // Sluice, SluiceWheel, WaterGauge, Trough, Fall, Basin, WaterLift, palmHouse, the vault's weight), pieces.js (Seed / Bud /
    // Ball `why`, Glass `down`), migrate.js edena v6, temple-maps makers.js (the sluice's words, the extras' reasons),
    // scripts/temple-design lib.mjs (a state's nearest setter, a gauge in sight, a weight's verbs); tests/greenhouse-water.test.js
    'The Builders’ Greenhouse is built round a great hall now, the Palm House, 78 m long under a glass vault, with a gallery round three sides and a bridge across its middle, and the builders’ water is the house’s state. Turn a sluice wheel to send the water up into the high troughs or let it down into the low channels; a gauge in every room shows where it stands, and seeds grow only where it runs. The Cold Frame’s disc rides up on its water to the gallery, the cistern on the floor breaks the fall when you drop from the gallery, and a vine grown down from the bridge stays: a climb back up for good. In the Seed Vault, pull the stone weight off its high ledge with the grappling hook to bring the sun to the seed.',
    'The Aerie in Vael is rebuilt round a great hall: the Wind Well is almost twice as wide, with a gallery round it halfway up, so you see its floor, the gallery and the high balcony at once, and a long narrow passage leads to it. Before the wings there is a new room, the Fledgery: roll its stone into the hole in its floor, and it drops onto a grate in the passage below and the wind lifts the Wing Chamber’s shutter. A marked drop off the gallery lands you softly back on the well’s floor, and from the Eyrie’s ledge you now look down a wide well onto the Moult before you go in.',
    // issue #410: src/temples/perdide2.js (ROOMS.pools the Lamp Hall, GALLERY, GREAT_LAMP, LEVERS, LIT/DARK, GreatLamp,
    // LampLever, LampGauge, LightCurtain, PipeLight, LEDGE, FAR), migrate.js perdide2 v5, scripts/temple-design lib.mjs (the
    // nearest room a state is set from), temple-maps makers.js; tests/lamp-house.test.js
    'The Lamp-House turns on its great lamp now. Its first hall is the Lamp Hall, 64 m long, a gallery along one wall and the great lamp hanging cold in the middle. Kindle it with a bubble of light from its balcony and open its shutters at a lever: its light runs out through the house, the Kennel’s door and the Lamp Passage’s open to it, and a curtain of it bars the Wick Room. Shut them again, at the lever by every hub, and the curtain falls and the moss-stones in the Dark Gallery rise. On the far side of the gallery, hook the ring on the lamp’s pipe and send the far door’s lamp a bubble of the light that pours out. The gallery drops you straight back to the hall’s floor.',
    // issue #413: src/temples/incal.js (OUT/IN, LEVERS, Breath, BreathLever, BreathGauge, SoftFloor, Valve, CrownRing, Rim,
    // VANE_ROOM, RING, the Well's open core, the Flue to the chamber's floor), migrate.js incal v5, temple-maps makers.js (the
    // breath's words, the guardian's own hall vanes no extras); tests/wardens-well.test.js
    'The Warden’s Well in the City-Shaft breathes now. Pull a lever by any of its hubs and the whole tower breathes out or in, and a gauge in every room shows which: breathing out, its draughts rise and stones stand in the Vane Room’s chasm; breathing in, the draughts die and a ring comes down on its chain in the crown. Its upper floors are rings round an open core, so from the crown you look 57 m straight down to the fan’s chest, and a drop down the core or the Flue lands you softly; the Flue’s valve lets you out into the Bellows Chamber. Two small keys open two doors at the hub, in either order; the great key waits across the Vane Room’s chasm for the fan; each disc on the Turning Floors rides on its own vane; and the crown’s eye wakes only while you pull its ring with the grappling hook and its great vane turns in the fan’s gust.',
    // issue #416: src/temples/moonfoundry.js (HALL, RUN, RUNS, CRUCIBLE, SILL, POUR, POURED/COLD, SCALE, Pour, PourTap,
    // PourGauge, PourFall, Crucible, the casts dM / gT / brH / dF, the heat-gates gW / gE / dR / cF, dW, kG, wS), migrate.js
    // moonfoundry v4, logic.js solve() (a latching door a stop opens), temple-maps makers.js (the pour's words); tests/casting-pour.test.js
    'The Casting-House in the Moon Foundry pours now. Its first hall is the Pouring Hall, 72 m long, a gallery round three sides and a great crucible hung over its far end, pouring molten iron into channels across the floor. Turn a tap by any of its hubs to stop the pour or let it in, and a gauge in every room shows which. While it pours the channels glow and burn (step in and you’re thrown out), and the heat-gates shut with iron spilling down them; cold, the gates open and the channels are dry lanes. A stone moon in a mould with the pour let in round it is cast, and a cast door stays open: in the Mould Room, on the stair’s landing, the furnace’s bridge and at last the Founders’ Door. The Weighing Hall is needed now: the Sand Room’s small key opens the way down to it, and its great key, freed once the great scale’s two pans weigh (an iron moon and a stone weight you pull down with the grappling hook), opens the Founders’ Door. From the gallery a gap drops you into a bed of moulding sand by the hub.',
    // issue #417: src/temples/spacecity.js (MH, GALLERY, EAST, WEST, ROOM, LOCKER, LEVERS, DOCK_RINGS, LOW/HIGH, MooredRoom,
    // DockRing, MooringLever, MooringGauge, Hoist, ShaftWeight, DockGate), migrate.js spacecity v4, skins/mooring-house.js
    // (plates, islands), temple-maps makers.js (the moored room's words); tests/mooring-room.test.js
    'The Mooring-House in the City Floating in Space is built round a great hall now, the Mooring Hall, open to the stars, and its moored room is the house’s state: a round room on a cable that docks low by the east landing or high between the gallery’s two halves. Pull a dock’s ring with the tether to call it home, or turn its capstan to ride it up or down, or step off before it goes. Every weight in the house hangs on the same cable: with the room low the Lamp Shaft’s counterweight lifts off its grating and the void’s breath blows, with the room high the loft’s ring comes down into reach, and a lamp in every room burns amber or blue to say which. The great key’s cage now hangs from a ring only the seeing lens shows, a new Chain Locker holds the west door’s chain, and a marked drop off the gallery sets you down softly on the east landing.',
    // issue #415: src/temples/buried.js (EH, GALLERY, ENGINE, LEVERS, UPPER/LOWER, GreatEngine, PowerLever, PowerGauge,
    // PoweredHammer, KEEPER, CLUTCH; the rooms moved), foes.js (an arena's `keeper`, a foe's own `def`), pieces.js Bank
    // `drive`, migrate.js buried v4, temple-maps makers.js (the clutch's words); tests/engine-house.test.js
    'The Engine-House in the Buried Machine is rebuilt round a great hall, the Engine Hall, 70 m long with a gallery round two sides, and its engine now drives one shaft at a time. Pull a clutch lever by any of its hubs and the power goes up to the pistons and the hammer of the upper floor, or down to the lower floor’s; two lamps in every room show which, amber above and blue below. The chest is guarded now: in the Boiler Room waits the Boiler Keeper, a huge furnace brute whose slam sends a quake along the floor and leaves its fists stuck, the same lesson the Tooth-Warden asks later. The Governor Room moved behind the chest, the Crank Hall behind a bulkhead that rises only with the power upstairs, and in the Furnace the two east pistons stand only while you hold their clutch with the grappling hook, so the bombs and the hook work together. A marked drop from the gallery takes you back to the floor.',
    // issue #408: src/temples/arzach2.js (ROOMS.nave, GALLERY, FOUNDERS, RUNG/STILL, FoundersBell, BellLever, BellGauge,
    // StateStones, RING), logic.js `rooms` (inReach), runtime.js roomsPast (one-way links), migrate.js arzach2 v5,
    // scripts/temple-design (a drum's verb, a state set in the lock's room); tests/belfry-bells.test.js
    'The Founders’ Belfry is built round a great hall now, the Great Belfry, 66 m long with a gallery round three sides, and its founders’ bell is the house’s state. Ring it at a lever and the stones it holds come down all through the house: the great stone to the floor, the porch’s door, the Hall of Echoes’ bridge. Still it, and once its hum fades they fall up again, the spur to the Ringers’ Walk with them. A lamp in every room glows warm while it rings and cold while it is still, there is a lever by every hub, and upstairs the porch’s and the Hall of Echoes’ bells ring it or still it with the hook. The great key now lies free on its ledge high in the hall, and from there you can jump down to the gallery and on to the floor.',
    // issue #409: src/temples/perdide.js (ROOMS, SILL, FAR_KEY, MOTHER_HALL, hush, RootNote, HushNote), boss.js `listen`,
    // migrate.js perdide v4; tests/mother-snapper.test.js, tests/temples.test.js; docs/systems/temples.md "The Hush-House with no fight at all"
    'The Hush-House in Lorn has no fight any more. The Choir is now a great hall: from the way in you see its floor, the gallery up its side with the great key’s cage, and the great door in its far wall. The small key is the Pendulum Gallery’s song: still the three in turn from the far landing and its cage sinks, and the pendulums rest so you can walk back. By the great key a marked drop takes you down into a black pool on the Choir’s floor, and the great door wants the Choir’s crystals hushed, highest first. The Mother Snapper is never fought: she is blind and strikes at sounds, so walk near her, never run; still the crystals jangling over her, then sing her the makers’ lullaby, smallest first. The first note grows at her root, under her head: make a sound somewhere else and she turns away.',
    // issue #418: src/temples/bazaar.js (ROOMS.well the Great Well, WELL, SHELF, BELLOWS, the line: SPEAK / QUIET, LineRelay,
    // RelayLever, LineLamp, Counterweight, CableHeap, WordStone, the First Sign's puzzle: signWord, onUpdate, signSpar),
    // pieces.js (NOTES boom and the word, Pillars `hidden`), migrate.js bazaar v6, hints.js, arena-guardians.js, temple-maps
    // makers.js (an element's own noun and verb, the line's words); tests/undertower-line.test.js
    'The Undertower, the last makers’ house, is rebuilt as the exam of your whole journey, round a great hall: the Great Well, 64 m long, its floor, its gallery and its high balcony all seen at once. Its state is the line: pull a relay lever by any hub to let the First Sign’s one word into the makers’ cables, or shut it out. While the house speaks, its lift, its cable doors and its bellows run and a great horn says the word; while it is quiet, the horns on the cables can hear. Every older tool has its step, each with the hourglass: knock a counterweight off its walkway and ride it back up, hook the high counterweight down and ride it to the balcony, see the listening pillars over the chasm only through the lens, catch a bomb’s boom in the sand for the Choir’s black horn, and give the bellows the First Sign’s word so their draught carries your wings up to the great key. Heaps of old cable catch your drops back to the hub. And the First Sign now stops between its two fights: it floods the cables with its word, so shut it out, then give it the rest of its line, one word at a time.',
    // body shapes (issue #402): src/costumes.js BUILDS (six), BUILD_ODDS, WORLD_BUILDS, buildFor (a hash of the look), HEIGHT.stretch;
    // src/makehuman/shape.js MH_BUILDS[].morph; humanoid.js armOut; crowd-shader.js / Crowd.hlsl aBody's belly, hips, limbs;
    // tests/body-shapes.test.js; docs/systems/characters.md "Body shapes"
    'People come in more shapes and sizes: thin as a rake, slim, broad-shouldered, stout and properly round, and taller and shorter than before, so a crowd no longer looks like one person over and over. Each world has its own mix: the desert’s pilgrims and Vael’s silent ones run lean, the market, the harbour and the foundry sturdier. Clothes, capes and robes fit every shape, and the fuller people hold their arms a little out from their sides.',
    // issue #398: src/fireballs.js (FIREBALL, Fireball, catchable), src/foes.js throwBall / updateBalls / ballLands /
    // returnBall / ballStrikes, src/enemies/archetypes.js `wisp`, src/enemies/plans/ember.js (a stand-in body);
    // tests/fireball.test.js, tests/engine-fireball.test.js; docs/design/fireball-foe.md
    'A new foe, the ember wisp: a dark shell round a glowing coal that floats out of your reach and throws slow balls of fire at you. Watch its shell open and its coal swell, then cut the ball just as it reaches you: it flies back and knocks the wisp out of the air, stunned and low enough to cut. A perfect parry sends it back too. You meet them over the Moon Foundry’s furnaces, as marsh lights in Lorn’s deep wood, in the city during the eclipse, in the Pour Floor and in the Arena. Its body is a first sketch until its drawing is chosen.',
    // issue #432: src/gadgets/hook.js (houseAt, takes, houseAnchors; the 'nohold' reticle), src/gadgets/hud.js, BridgeHud.cs,
    // src/temples/pieces.js HookRing; tests/hook-reach.test.js, tests/gadgets.test.js, tests/engine-hook.test.js
    'Inside the makers’ houses the grappling hook only catches what the makers set there for it: their rings, the weights, the bells and your foes. Bare stone won’t hold it any more, so it can’t pull you up past a puzzle onto a ledge or across a chasm; aim at a wall and the reticle turns to a cross that says “won’t hold”. Out in the world it still takes any wall or ledge in reach.',
    // issue #412: src/temples/underwater.js (HALL the Sounding Hall, SOUND, GALLERY, COLUMN, TIDE, HIGH/LOW, Tide, TideValve,
    // TideGauge, TideWater, TideColumn, TideGlass, the Shell Room's ledge door dE, the Horn Store's horn eSt, the gallery's
    // weight wG and dish, the Throat west), underwater-data.js (Achille), migrate.js underwater v4, logic.js (the solver's
    // stop: an eye in reach), temple-maps makers.js (the tide's words); tests/whale-tide.test.js
    'The Whale-House is built round a great hall now, the Sounding Hall, 76 m long, and the tide is the house’s state. Turn a valve to let the sea in or out: in, it fills every wing at once, lifts you to ledges you could not reach and fills the tank behind its glass, so a stomp by the glass carries through the water to the ear inside; out, it bares the hall’s deep floor and the doors in it, which hold the sea back while it is in. A gauge and a lamp in every room show where the tide stands, there is a valve by every landing, and you swim in it: up through the Shell Room to its ledge, across the Sound to the dais. On the gallery, pull the stone weight off its post with the grappling hook, set it by the dish and stomp, then drop through the gap in the great horn’s pipes into the Sound.',
    // issue #382: src/minigames/lens-vault.js (and -rules, -level, -arm, -hud), the screen's `visor` part (unity
    // BridgeHud.Games.cs DrawVisor); tests/minigames-lens-vault.test.js
    'A new game in the Arcade, The Lens Vault: a test of another way to play, through your own eyes. Your glove is an arm that shoots (hold the trigger for a charged shot), LT / L2 locks on and the stick circles the foe, and Y / △ raises a lens that reads what it is held on, a line about each. Four rooms of a makers’ vault: a door that opens to a shot, one only to a charged shot, one sealed until you read its lock, and a round hall to clear at the end.',
    // issue #433: src/gadgets/springs.js (launchHeight / launchVelocity `house`, Springs.inHouse); tests/boots-reach.test.js,
    // tests/engine-springs.test.js, tests/house-walk.js (lockSides)
    'Inside the makers’ houses the spring boots only hop: they won’t wind there, and a bounce goes no higher, so a launch can no longer carry you up onto a gallery or over a gap before its puzzle opens the way. Jump and press again in the air to stomp, as before. Out in the world they still throw you fourteen metres up.',
    // issue #264 (the sequences' gaps): Bloom.shader (a pixel not a number), engine/game.js mapAt, engine/mirror.js onAfterRender,
    // engine/traveller-paint.js, Marks.hlsl weatherInk and glyphCarve, BridgeHud.cs KeyGlyph and the 3-2-1, src/ship/ship.js
    // applyCamera (the lens left alone); tests/engine-unity-gaps.test.js
    'In the Unity version, the Signal Market’s broadcast no longer goes black, the Map draws its ground, a struck foe flashes and falls to its ink instead of staying white, his face close up is clean of ink blotches, Vael’s walls have fine cracks instead of dark drips, the builders’ walls in Edena carry their carved inscriptions again, the dark band round his shirt is gone, the temples’ key counter is a key, and the 3-2-1 is its proper size. In the ring race and the ski run the view now widens as you pick up speed, as it was meant to.',
    // issue #397: src/levels/port-pad.js (pad, docks, traffic as data), space-city.js SC_PORT, taxi.js (the fin's tip);
    // tests/port-pad.test.js; docs/design/space-ports.md (the plan and the Midjourney prompts for every city)
    'The City Floating in Space has a little space port on its Pier while the real one is being designed: a landing ring painted round your ship, two docks reaching out over the void either side of the bridge with a moorer’s craft in each, and small craft circling slowly over the city.',
    // issue #438: unity BridgeQuit.cs (SIGTERM/SIGINT/SIGHUP, alarm(2), Application.quitting), BridgeRunner.cs (Await and
    // Update give way to a quit, StopThreads), scripts/steam-deck/deck.py UNITY_STOP_SECONDS; tests/unity-quit.test.js. Unity only
    { text: 'On the Steam Deck, Exit Game closes Hiraeth at once, even while a world is loading: it used to leave a black screen for four seconds or more while the game crashed on its way out.',
      numbers: [{ title: 'From Exit Game to the game gone, before → after', unit: 's', better: 'lower', device: 'Steam Deck OLED, Gaming Mode, the Unity Linux player, muted, three runs each', rows: [
        { where: 'during a world’s load', before: 4.15, after: 0.43 },
        { where: 'in the desert', before: 0.91, after: 0.91 },
      ], source: 'docs/steam-deck.md, "Exit Game with the Unity player"' }] },
    // issue #414: src/temples/garage.js (WELL, HOUR, STAIR, DOCKS, COUNTER, WOUND, TRAIN, GreatClock, HourLever, HourGauge,
    // HourDock, StrikingTrain, galleryOrder), pieces.js (a Bank's order and an `unmet` may be functions), migrate.js garage v4,
    // temple-maps makers.js (the hour's words); tests/clock-house.test.js
    'The Clock-House is built round a great hall now, the Winding Well, 64 m across, and the hour is the house’s state. In its middle the Escapement’s stair turns with the great clock’s hand: at two its arm meets the north door, at four the Pendulum Hall’s high door, at six the Striking Room’s loft. Roll the counterweight home to wind the clock, then turn the hand on at a lever by the stair, on its top, on every ledge or on the Escapement’s landing. A clock face in every room says the hour, and the hour track, the Clockmaker’s clock and the gallery’s eyes count from it. In the Clock Gallery the eyes sit behind shutters now: hook the ring under the great clock to run its striking train, then throw the boomerang. Every ledge’s edge is a safe drop back to the hall’s floor.',
  ] },
  { v: '1.82', date: '2026-10-16', items: [
    // issue #399: src/hook-foes.js (each kind's `hook` class, hookOutcome, lockShot), src/gadgets/hook.js fireAtLock /
    // catchFoe, Foe.hookYank / hookPin / hookDown, src/gadgets/index.js (RT locked on); tests/hook-foes.test.js,
    // tests/engine-hook.test.js
    'Locked on, RT / R2 throws the grappling hook at your foe. Small ones are yanked through the air to land dazed at your feet, ready for a cut; big ones are held where they stand for a moment, straining against the rope; flyers are pulled down to the ground; armour rings it off. It works with the hook in hand or nothing in hand, needs a clear line to the foe, and takes a few seconds to be ready again. Before, the quick throw went where the camera looked and could reel you straight into a big foe.',
    // every visit its own run (issue #386): src/fight-temples/generate.js (drawRun, layOut, drawWave, fromTheme), index.js,
    // session.js (the seed on the cards); tests/fight-generate.test.js; docs/design/fight-temples.md "Each run its own"
    'The fight temples are different every time you go in: the rooms between the entrance and the altar come in a new order and a new layout, each turned its own way, and every wave is drawn fresh from the world’s foes, as hard as before at each point of the run. The results show the run’s number, so you can play the same one again.',
    'A new fight temple in the City Floating in Space, the Oil Exchange, on the Towers’ deck: four decks of drones, moths and rollers over the dark, where leaking oil spreads under your feet and a spark sets it burning. Step off the pool before it lights, and let the rollers burn. Its prize: the Lamp oil colours. With it every world has its fight temple.',
    // issue #391: src/thresholds.js fitDoor (the jambs looked for within 5.5 m, up to 10 by 11 m, the hole's width, its
    // top and depth measured), openingGeometry; the shopfronts', sea locks', skull's mouth's, Crown lift's and hull
    // hatch's own openings; tests/thresholds.test.js
    'The light in a doorway now fills the whole opening. A temple’s great door, its ways out, the skull’s mouth, the sea locks, the shops and the crashed ship’s hatch all used to wear a narrow sheet of it, smaller than the dark it stood in, like a cut-out in front of a hole; now it reaches from jamb to jamb and up into the arch.',
    // issue #391: src/door-light.js (one draw a door), src/thresholds.js; Unity: Hiraeth/DoorLight (port 'doorlight');
    // tests/door-light.test.js
    'And that light is new: instead of a curtain of flickering tongues, the doorway itself glows, brightest round its frame in a few flat steps, with the warm lamp of the room beyond (or the daylight, on the way out) faint in its middle. It softens as you walk up to it, so you can see into the door before you step through.',
    // issue #383: src/temples/portal.js (frames, light, threshold, the door's shape for its light), each house's exterior
    // and landmarks.js; runtime.js passes door.top; tests/thresholds.test.js, tests/zfight.test.js, tests/contact-audit.test.js
    'The makers’ houses have real doorways now, as in their drawings: each door is set deep in its wall, framed two or three times in the house’s own stone or metal with a thin line of light round it, on a threshold of its own, and shaped as drawn: round at the Rose House, the Undertower and the Casting-House, pointed at the Aerie and the Warden’s Well, a tall oval at the Engine-House. The square porches at the Belfry, the Lamp-House and the Mooring-House are gone, and the light in each doorway fills its shape instead of a square.',
    // issue #390: src/fluid-blade.js FIGHT, foeEngaged, bladeLitWant (drawn and open while a foe is awake within 10 m or
    // locked on, 3 s past the last); tests/blade-grip.test.js, tests/engine-combat.test.js
    'Your sword stays drawn and glowing for the whole fight. It used to go dark in your hand after every cut and light again for the next; now, while a foe is close and awake or you are locked on, the blade stays open between swings, through the guard, rolls and the charged cut. A few seconds after the fight is over it goes back on your back as before.',
    // issue #395: unity/…/BridgeRunner.cs HandheldScale (Handheld on Android: 960 × 540's pixels at most on a screen
    // larger than the Retroid's); tests/unity-thor.test.js; docs/systems/performance.md "Unity on the AYN Thor"
    'The Unity version on the AYN Thor runs at or near 60 frames a second in most places instead of about 40: on its 1080p screen the world is now drawn at half its width and height and scaled up to fill it, a little softer for it. Retroid players see no change.',
    // issue #392: unity/…/HiraethFeature.cs UpscalePass, Shaders/Upscale.shader (FSR 1, SGSR 1), BridgeRunner.cs
    // HandheldScale 0.67, HandheldUpscale, HandheldSharpness; tests/unity-upscale.test.js
    'The Unity version on the Retroid is sharper and faster: the world is drawn a little smaller than before and scaled up to the screen by FSR, which keeps the ink lines crisp instead of blurring them, and the slowest places run a few frames a second faster. The HUD is still drawn at the screen’s own size, so its text stays sharp.',
    // issue #384: src/fight-temples/entrance.js (the Blade Gate: six draws, its opening's light through Thresholds.addDoor),
    // kit/marker.js, the hosts beside it (hosts-data.js FIGHT_STAND), the Oil Exchange's and the Lift Depot's spots moved;
    // tests/fight-entrance.test.js
    'Every fight temple now has a small gatehouse you can pick out from far off: two crossed blades over a shield on its roof, a banner with the crossed blades on each pillar, a lit ring on the ground before its door, all in the world’s own colours, the same sign in every world. Its doorway glows like the others and is dark right up to the lintel (the old one showed a strip of sky under it). In the City-Shaft and the City Floating in Space it stands a few steps from the old door, where it has room.',
    // issue #394 (Unity): the hologram mirrored (engine/game.js, port 'holo', Hiraeth/HoloFigure, the father's picture
    // decoded by Unity: engine/boot.js engineImages, BridgeRenderer.TextureImage), the cine's eyes, the prompt drawn in
    // the walk (as a glyph unless hints are full), the charge card as the screen's 'charge', tool.swordOn;
    // tests/engine-hologram.test.js, tests/charge.test.js; scripts/unity-compare/opening.mjs
    'In the Unity version the opening plays as it does on the web: you wake with your eyes opening on the ship’s cabin instead of a black screen, the voicemail’s button shows its E as you come up to it, your father’s message rises over the dash as his hologram (there was nothing there), his charge is lettered on the sand as the dust clears, and no sword hangs on your back before you have found one.',
    // issue #401: src/temples/spheres.js (WELL, ROOMS, LOGIC, GreatLift, LiftSphere, Spiral, Catch, the layout), pieces.js
    // (Ball hole, Iris up), logic.js (solve's two balls at once, next's worthMove), migrate.js spheres v4,
    // scripts/temple-design/ (rules `through`, the well measured); tests/footprint-floors.test.js, temple-playthrough's
    // lift; docs/systems/temples.md "The Footprint across four floors", docs/design/temple-best-practices.md part 4
    'The Footprint in the Garden of Spheres now goes down: four floors round a great well, and from its rim you can see the Echo’s door at the very bottom. Drop through holes in the floors into pools that break your fall, push a sphere through a hatch onto a plate on the floor below, ride the great sphere’s lift (where it rests decides which bridges stand and which doors open), and climb a spiral of stones only the seeing lens shows. Eleven steps where there were five.',
    // issue #405 (G5 of docs/design/temple-best-practices.md): src/house-map.js, src/temples/house-plan.js (TempleKit.chart,
    // rt.placed), pieces.js MapChest, each house's LOGIC `map`, src/ui.js drawHouse, engine/menus.js HOUSE_SIDE,
    // BridgeMenu.cs DrawHouse; tests/house-map.test.js
    'Every makers’ house now has its map, in a little chest off the way on, early in the house. Open it and the Start menu’s new House map shows the whole house floor by floor, a tab for each (LB / RB): the rooms you have been in drawn in ink, the rest faint, where you stand and which way you face, the doors open or shut, the locks still waiting for a key, the great key’s door in gold and the guardian’s door ringed in red. Before you find it, the House map shows only the rooms you have seen.',
    // issue #393 (over Codex's ba8ff71a2): src/glass-dunes-masses.js (towers with scalloped tops, crowded blocks, rock
    // dwellings, crystal columns, pale floors, cottages), glass-dunes-quarter.js, -west.js, -streets.js; one set of merged
    // meshes a place; tests/glass-dunes-quarter.test.js
    // issue #426: where they stand: src/glass-dunes-quarter.js QUARTER, CLEFT, COURT (turned: placed()), glass-dunes-west.js
    // FOLDED, PRISM, PEARL (the pearl city's east stair, its east side open), the billows from z -50 (glass-dunes.js);
    // tests/glass-dunes-quarter.test.js walks the loop
    { text: 'The Glass Dunes have new places, and they now sit where they belong. A white hillside village of curved terraces, one blue house and one coral tower, leans on the giants’ cliff a short walk west of the ship, its stairs facing you as you land. South-west of the ship, a red stair climbs a cleft of rounded green glass, and its arch is the way round the giants’ cliff to the west. In the north-east corner, where the billows meet the breaking wave, a court of pale rock dwellings is dug under a green glass cave, a dark cave mouth and a tall blue door beside it. Under the sand, the buried streets by the Clock-House are pale stone towers crowded with rooms and small amber windows.',
      see: 'From the ship, look west: the village is under the cliff, the red cleft beyond it to the south-west. Walk east along the breaking wave past the north camp to find the cave court. Go down the sinkhole by the Clock-House for the buried streets.' },
    { text: 'Behind the giants’ cliff, the far west is now one way north and a loop back. Through the red cleft’s arch, a ravine of dark folded glass with a massive pale stair up its wall leads to a square where the giants’ passage comes out. From there a cleft of faceted crystal columns over gold sand, with a high bridge and a crystal arch, frames the pearl city ahead, a castle of white towers against dark glass. Its east stair takes you out through the gap between the giants and the breaking wave, back to the north camp, and from the gap you can see the castle again.',
      see: 'Go through the red cleft south-west of the ship, or the passage in the giants’ cliff by the west camp, then north through the ravine and the crystal cleft to the pearl city; leave it by its east stair.' },
    // fewer hats (issue #403): src/costumes.js hatted() (HAT_ODDS, T.hatOdds, wearsHat), decided from a hash of the look like
    // the capes; the oddest shapes out of the tribes' tables; scripts/cape-census.mjs --hats; tests/hat-share.test.js; docs/systems/characters.md
    'Far fewer people wear hats: about one in four now has something on the head, down from four in five, and the rest show their hair. The oddest hats are gone from the crowds: the tall stovepipes and spires of the City-Shaft, the balls of the Garden of Spheres, Lorn’s reed thatches, the lamp hats, the antenna helmets, Viridel’s floating blossoms and the fezzes. The desert’s headcloths, Vael’s cowls and the miners’ hard hats stay a little more common, and the people whose own design has a hat keep theirs.',
  ] },
  { v: '1.81', date: '2026-10-16', items: [
    // issue #385: engine/game.js defers the drifts' collision (DRIFT_FITS.later, late-collision mergeMax, DRIFT_FITS.most)
    // and the crowd's walks as main.js does, the flora's burial check in its own queue; tests/engine-defer.test.js. Unity
    // only: the web game already did all of this (v1.49), so it loads as before
    { text: 'In the Unity version the City-Shaft and the Buried Machine open about a second sooner on the Steam Deck: the sand banked against far walls and the strollers on the far streets are now worked out in the first seconds of play, as the web version does, while everything near you is ready from the first moment. Shrubs that had grown inside rocks are now left out, and the large plants are solid to walk into, as on the web.',
      numbers: [{ title: 'Launch to the world’s first frame in the Unity version, before → after', unit: 's', better: 'lower', device: 'Steam Deck OLED, the Unity Linux player, 1280 × 800, muted, three runs each', rows: [
        { where: 'the Buried Machine', before: 12.31, after: 11.04 },
        { where: 'the City-Shaft', before: 15.09, after: 14.01 },
        { where: 'the Desert', before: 11.76, after: 11.66 },
        { where: 'Vael', before: 11.87, after: 11.87 },
        { where: 'Lorn', before: 11.36, after: 11.41 },
        { where: 'the Signal Market', before: 9.67, after: 9.67 },
      ], source: 'the same player with the game before and after, runs interleaved, 16 October', note: 'The longest frame over the first 15 s of play stayed where it was (36–89 ms before, 49–89 after). The web version is unchanged: it already did this.' }] },
    // issue #264: the games' own panels as screen parts (src/platform.js drums, hunt, fishing, pirates), drawn by
    // unity/…/BridgeHud.Games.cs; the page's canvases not drawn in an engine (page.drawsHud)
    'In the Unity preview the drum circle, the sketch hunt, the fishing and the chime pirates show their own pieces as on the web: the drum’s ring with its glyphs rolling in, its sockets, hits and combo; the sketch list, the sketchbook’s frame and what it holds; the fishing journal, the line’s tension meter and the catch card; the pirates’ reticle, lock, captain’s bar, hull pips, missiles and radio lines. The drum circle’s camp no longer goes black once the count starts.',
    // issue #264 (docs/systems/unity-updates.md): BridgeStore.cs, the Unity-default plan's D4 / X1
    { text: 'The Unity version keeps your saves and settings in a file of their own, written so that a crash or a full disk mid-save never loses the last good one. On the Xbox a long journey no longer outgrows what the console kept for it. Saves from before move over by themselves.',
      see: 'In the Unity version, play a while, quit to the title and close the game, then open it again: Continue is where you left off. Your saves from before this version are there too.' },
    // BridgeUpdates.cs, engine/unity/updates.js: D13 / D14, X3, R4's script half
    { text: 'The Unity version now updates the game by itself, as the web version and the Android app do: on the Steam Deck, the Xbox and the Retroid it fetches the newest game when the title shows and plays it from the next start. The new Updates page (in the Start menu, and on the title under Settings) shows what is coming, its download, and Restart now. If an update ever fails to start, the game goes back to the one it came with.',
      see: 'In the Unity version, open the Start menu (Menu) and choose Updates, or Updates on the title: Check for updates, then Download and restart when a newer game is there.' },
    // D12: scripts/unity-linux-smoke.sh, scripts/wait-tests.sh in unity-android.yml
    { text: 'A new Unity version for the Steam Deck reaches it only once the game\'s checks have passed and the new version has started, loaded the desert and drawn it on a test machine.',
      see: 'Nothing to see on the Deck: a version that fails those checks simply never arrives.' },
    // issue #379, the sound QC (.claude/skills/sound-qc): src/audio.js fluidWindup, swish, effort / grunt, fluidSlash,
    // fluidSlashHit; src/fluid-blade.js start; tests/action-sounds.test.js
    { text: 'Your sword answers the moment you press: the grip tightens and the blade’s fluid draws back with a soft wet rush, then the cut whooshes through the air, never twice quite the same, the heavy third deeper with a grunt of effort behind it. A cut that lands cracks bright and short before the splat, so a hit never sounds like a block.',
      see: 'Hear it: swing the sword (RB / R1) three times in a row at the air, then at a foe.' },
    // engine/game.js (BodyFoley, interactHooks, carryHooks, waters, onDrink, footing), src/audio.js hurt / knockdown /
    // getUp / pickup stand-ins, engine/webaudio.js (an event inside a block sampled exactly); tests/engine-sound.test.js
    { text: 'The Unity preview hears your body as the web version does: jumps, landings soft and hard, the roll, climbing, the wings and jets, swimming, getting knocked down and up again, picking things up and the potion’s healing chord, and footsteps change between the ground and stone. A blow you take is no longer nearly silent there, and the shop’s chime no longer cracks.',
      see: 'Hear it in the Unity preview on the Steam Deck or the Xbox: jump off a dune, roll (B / ○), and drink a potion after a fight.' },
    // src/ui-sound.js, src/audio.js ui / toolClick, src/main.js (the panels, the pad, the keys, clicks), engine/game.js wrapMenus
    { text: 'Every menu now makes soft, short sounds: opening and closing, the cursor moving, a choice confirmed, going back and changing tabs, and choosing an answer in a conversation. They play through the menu’s hush and follow the Effects volume.',
      see: 'Hear it: open the game menu (View / Select), move along the tabs (LB / RB) and through a list, then press A / × and B / ○.' },
    // src/audio.js quest, lockOn, shutter, toss, doorOpen, critter('clank'); src/story/quests.js, src/foes.js, src/carry.js,
    // src/temples/pieces.js
    { text: 'A quest given now rings an open, waiting call, a step done the familiar chime, and a quest finished a run of bells up to a held note. Locking on to a foe ticks softly and letting go ticks back; a photo clicks its shutter; throwing what you carry swishes; a temple door thunks its bolt before it rushes open; and a lever’s clank is heard at last.',
      see: 'Hear it: accept a quest from someone and finish one; lock on with R3 / Tab near a foe and press it again to let go; take a photo in photo mode.' },
    // src/audio.js TALK_DUCK, heartbeat, the swing/step/stroke levels (src/sfx.js), fluidShoot / fluidBoost / fluidEmpty /
    // fluidMode; docs/systems/audio.md "Sound QC"
    { text: 'The music steps back a little while someone speaks to you and comes back after. Footsteps, landings, the swimming stroke and the climb’s grab sit softer under the world, the low-health heartbeat is felt more than heard, and the gun’s shot, its empty click and the double jump’s lift no longer stand out over the music. Many small sounds (the shield, the potion, the charge, the scout) now vary a little each time.',
      see: 'Hear it: talk to anyone while the music plays, then walk and sprint on sand and stone.' },
    // issue #264 D16 (docs/plans/unity-default-portables.md): engine/game.js as main.js (src/companion.js, src/first-steps.js,
    // src/scout-hint.js, src/observatory.js)
    'In the Unity preview Plumb speaks up again when you look lost, the desert teaches the camera and the jump, the scout’s find says what it is for and how far, and the sleeping observatory east of camp can be woken.',
    // D16: Composite.shader drawEclipse, drawLantern, drawSpace from the bridge's look (src/eclipse.js, src/story/lantern-sky.js)
    'In the Unity preview the City During the Eclipse has its black sun, corona and rose horizon, the City Floating in Space its nebula, and from the seventh world on the Lantern’s light hangs low in every sky.',
    // D17, the visual check (scripts/unity-compare/): what it found and fixed
    'In the Unity preview the desert’s sand is the warm orange-gold of the web game, not a pale cream.',
    'In the Unity preview the Glass Dunes’ glass holds its dark giants, heads and trees, glows mint and lime where the sun comes through, and pools that light on the sand.',
    'In the Unity preview the light in every doorway, cave mouth and temple door streams in slow rays, as it does on the web.',
    'In the Unity preview a low moon or sun no longer throws the whole land into shade: Viridel’s meadow at dusk keeps its long shadows on lit grass.',
    // issue #387: src/dev-menu.js (one menu, the game menu's frame), src/world-debug.js devTabs / keyPlaces / godLanding,
    // src/player.js GOD; engine/menus.js 'dev', engine/game.js, BridgeMenu.cs; tests/dev-menu.test.js
    { text: 'For testers: the debug menu and the old dev panel are now one dev menu, with tabs like the game menu’s. Its first tab takes you to the world’s key places (the ship, the temples, a few landmarks), the second has the frame-rate readout and a god mode to fly anywhere fast, and the rest hold every other place, the films, quest stages, items and travel. The game pauses while it is open, in the web version and the Unity preview.',
      see: 'Open it with both sticks clicked (L3 + R3), F2 or `, or the Debug menu’s “dev menu” button on a touch screen; LB / RB move between its tabs.' },
    // issue #389: src/door-walk.js (main.js, engine/game.js), Player.doorWalk, Passage's cover per hand-over, Sound.doorway;
    // tests/door-walk.test.js
    'Walking through a door no longer runs you into a wall first. The door takes you on through at your own pace, walking or sprinting, with a soft click of its latch; the page sweeps across, and you come out a few steps inside the other place with the camera behind you, then it is yours again. It all takes under a second, and turning the stick away hands it back at once. A locked door still tells you why.',
    // the Unity build's GPU on the Retroid, round 7 (issue #262): Surface.shader HIRAETH_LEAN_SLIM (BridgeRenderer.Lean, never
    // with HIRAETH_PLAIN nor on copies), BridgeShaderStrip (Android's Vulkan only), BridgePso's Android list (off unless -pso);
    // tests/unity-pso.test.js; docs/systems/performance.md "Unity on the Retroid, round 7"
    { text: 'The Unity preview on the Retroid draws the walls with marks on them a little more cheaply: up to 3 frames a second more in the City Floating in Space, and 1-2 more in the Signal Market, with the same picture.',
      numbers: [{ title: 'Frames a second in the Unity preview, before → after', unit: 'fps', better: 'higher', device: 'Retroid Pocket Nova, Handheld preset at 0.75 of 1280 × 960, muted', rows: [
        { where: 'the City Floating in Space, the wide view', before: 57.4, after: 60.1 },
        { where: 'the City Floating in Space, its start', before: 51.9, after: 54.5 },
        { where: 'the Signal Market, its start', before: 52.7, after: 54.1 },
        { where: 'the Signal Market, the wide view', before: 56.1, after: 57.4 },
        { where: 'Underwater, the wide view', before: 49.4, after: 50.1 },
        { where: 'the City-Shaft, the wide view', before: 36.9, after: 37.5 },
      ], source: 'the bridge\'s bench (-views -bench 6), 16 October, the same APK with and without the change (-no-slim); the mean rate over each view', note: 'Lorn and the desert are unchanged; GeckoView, the web version, is still ahead in Lorn, Underwater, the Signal Market and the City Floating in Space.' }] },
    // the fight temples of four more worlds (issue #341): src/fight-temples/edena.js, incal.js, buried.js, bazaar.js (the
    // tables), hazards.js (bloom, drop, cart, toll; the gust drawn as it blows), dress.js (pipes, crates; the greenhouse,
    // the shaft, the teeth, the market), story/hosts-data.js; docs/design/fight-temples.md
    'A new fight temple in Viridel, the Seed Vault, on the plateau just west of the Builders’ Greenhouse: four white cellars of moths, root knots and blots, their seed beds full of sleeping eyes. When a bed’s eyes open one by one, get off it before they flash, and bring the moths onto it. Its prize: the Leafglass colours for your backpack, sword and shield.',
    'The Wind Cloister’s gusts are easier to read: as the wind blows, long white streaks race down the lane and its floor flashes pale.',
    'In the fight temples a foe thrown up onto a wall’s top is now put back down in the room, so a wave can always be finished.',
    'A new fight temple in the City-Shaft, the Lift Depot, on the middle terrace by the cab stop: four iron bays over the drop, full of horn lizards, toads and lamp tripods, and cranes that still lower their loads. A ring tightening on the deck means a load is coming down on it: step out, or lead the crowd in. Its prize: the Cab yellow colours.',
    'A new fight temple in the Buried Machine, the Tooth Gallery, just east of the domes: four rooms of skitters, mound worms, horn lizards and carts, with ore carts that still run the rails across the floor. When a rail’s lamp blinks, get off the rail. Three whole centipedes wait at the end. Its prize: the Brass tooth colours.',
    'A new fight temple in the Signal Market, the Back Rooms, in the back alley west of the sign-hanger’s ladder: four shuttered shops of lizards, hounds, moths and marionettes, where the signs on the walls ring with the bell walker’s toll. A ring of sound spreads from each sign that lights: roll through its edge, and cut down the foes it stuns. The bell walker itself comes last. Its prize: the Signal neon colours.',
    // the last four worlds' fight temples (issue #341): src/fight-temples/underwater.js, glassdunes.js, spheres.js,
    // spacecity.js; hazards.js (dark, crack, shade, spill); dress.js (chimney, tree, drum; deep, kiln, orchard, islands)
    'A new fight temple in the Underwater City, the Flooded Gallery, in the Dock hall: four sealed halls of glass crabs, lantern jellies and sky rays, lit by lamps that flicker and go out. When they do, get under one: out of the light the cold of the deep takes a little of you each second, and the foes caught in a lamp’s light are scalded. Its prize: the Pearl and tide colours.',
    'A new fight temple in the Glass Dunes, the Kiln Yard, by the north camp’s awnings: four cooling sheds floored in glass over the kilns, full of glass crabs, mantas and worms. When the tile under you cracks white, get off it before it breaks into a pit of the kiln’s glow, and leave the crabs on it. Its prize: the Furnace glass colours.',
    'A new fight temple in the Garden of Spheres, the Quiet Orchard, just west of the round plaza: four walled gardens at dusk, full of antler hounds and rollers, where a sphere’s shadow sweeps the lawns. Keep to the light: in the shade the hounds bite and you can’t aim at them. Its prize: the Orchard dusk colours.',
  ] },
  { v: '1.80', date: '2026-10-15', items: [
    // issues #375 and #377 (docs/design/gadget-temples.md): the Founders' Belfry's chest holds the hook, src/temples/arzach2.js
    // (HookBell pull-rings under every bell, BellEar `struck`, the Cloud-Mother's four hall bells), src/temples/pieces.js
    // HookBell; the whistle into Vael's makers' court (src/boxes/placements.js arzach.hook)
    { text: 'The grappling hook is now earned in the Founders’ Belfry, in the chest past the stone stair: every founders’ bell hangs a brass ring under it, and the hook rings it from below, from across the chasm or from the ledge high over the stair, holding its door or its stones while it sounds. The Cloud-Mother is calmed by hooking the bell nearest her as she cries. The bell-note whistle that was in that chest waits in Vael’s makers’ court instead.',
      see: 'In Vael II, go into the Founders’ Belfry and through the Bell Chamber: hook the ring under the oculus’s bell (aim with LT / L2, fire with RT / R2) and three stones come down round the dais; in the porch, hook the porch’s bell and walk through while it sounds.' },
    // src/temples/buried.js (the banks need the bombs, the vents take a bomb's blast), src/gadgets/bomb.js (off on meeting a
    // guardian); the fourth chamber into the Garden of Spheres' makers' court (src/boxes/placements.js spheres.bomb)
    { text: 'The ink bombs are now earned in the Engine-House, where the fourth chamber for your magic bar used to be: its banks of four eyes still want all four in one breath, three splashes and a bomb for the rest, and a bomb thrown at the Tooth-Warden’s open vent goes off on it and takes three vents at once. The fourth chamber waits in the Garden of Spheres’ makers’ court, where the bombs used to be.',
      see: 'In the Buried Machine, open the chest in the Engine-House’s Fourth Chamber, then throw a bomb between two of the eyes on posts round it and splash the other two before they fade: the shutters roll up.' },
    // src/temples/perdide2.js (the lamps, the moss-stones' hanging lamp, the orbs and the Lampless take a bubble's light),
    // src/carried-light.js, src/gadgets/bubble.js takeLight, src/temples/pieces.js LightEar / Ball `carried`, LightFount;
    // the lantern into Viridel's makers' court (src/boxes/placements.js edena.bubble)
    { text: 'The bubble wand is now earned in Lorn’s Lamp-House, where the lantern charm used to be, and its bubbles carry light: blow one by a lit pool or the chamber’s fount and it glows, and where it bursts the light goes. The lamps out of reach, the moss-stones’ lamp hanging over the dark gallery’s chasm, the pool-orbs and the Lampless itself all drink a bubble of light. The lantern charm waits in Viridel’s makers’ court, where the wand used to be.',
      see: 'In Lorn, inside the Lamp-House, open the chest and stand by the fount of lamp-water beside it: blow a bubble (aim with LT / L2, blow with RT / R2) and send it, glowing, to the dark lamp by the dais.' },
    // src/temples/underwater.js (a stomp in the house is the deep note: onConnect; the hatch over the glass), the horn retired
    { text: 'The spring boots are now earned in the Underwater City’s Whale-House, where the whale-horn used to be: in that house of shell and water a stomp’s boom is the whales’ deep note, so stomp by its listening horns to hold the passage door, into its dishes to reach the ears beyond the glass, and by the Listener’s spread ear to calm it. The tank’s glass now rises to the roof, so only its rungs take you over. The boots’ court on the first sky stone keeps its blocks and towers to bounce on.',
      see: 'In the Underwater City, open the chest in the Whale-House’s Horn Chamber, jump by the little horn beside the pulpit and stomp (RT / R2 in the air): it hums the deep note back.' },
    // src/temples/incal.js (the vanes and the warden's hatch answer the fan), src/temples/pieces.js Vane (a 'gust' turns it,
    // VANE_GUST); the bellows into Lorn's makers' court (src/boxes/placements.js perdide.fan)
    { text: 'The gust fan is now earned in the City-Shaft’s Warden’s Well, where the Warden’s bellows used to be: a gust turns the great vanes a splash only rocks, from the floor or swung down at them from the air, so the lidded eyes, the loft’s stones and the crown’s two vanes answer it, and the warden’s hatch lifts over the vane you fan beside it. The bellows wait in Lorn’s makers’ court, where the fan used to be: open wings still climb faster with them in rising air.',
      see: 'In the City-Shaft, open the chest in the Warden’s Well and go up to the Lamp Gallery: swing the fan (RT / R2) at the great vane in its floor and watch the eye’s lids on the pillar lift.' },
    // src/temples/garage.js (the banks of six and the Foreman's numerals: three on the boomerang's locks); the coil into Lorn II's
    // makers' court (src/boxes/placements.js perdide2.boomerang)
    { text: 'The boomerang is now earned in the Glass Dunes’ Clock-House, where the quick coil for your magic bar used to be: its banks of six eyes still want all six in one breath, and a tank holds three shots, so lock three with the boomerang, throw, and splash the other three; round the handless clock its locks strike them in turn. The Foreman’s six numerals are beaten the same way. The quick coil waits in Lorn II’s makers’ court, where the boomerang used to be.',
      see: 'In the Glass Dunes, open the chest in the Clock-House’s Coil Chamber and go through its north door: hold LT / L2 and sweep across three of the eyes round the spring, throw with RT / R2, and splash the other three.' },
    // src/temples/moonfoundry.js (the iron moons heavy: 'magnet'), src/temples/pieces.js Ball magnetTo / magnetShove,
    // src/gadgets/metal.js registerIron, src/gadgets/magnet.js (loose iron among what it holds); the tongs retired
    { text: 'The magnet glove is now earned in the Moon Foundry’s Casting-House, where the founders’ tongs used to be: hold the glove on an iron moon and its field draws the moon along its rail, tap to throw it, so the cradles, the pilot flames and the Last Founder’s casting cradle all want the glove. No push moves the iron moons any more. The glove’s court in the Glass Dunes keeps its plate and iron block to try it on.',
      see: 'In the Moon Foundry, open the chest in the Casting-House and hold RT / R2 with the glove aimed at the iron moon by the dais: it rolls into its little cradle.' },
    // src/temples/spheres.js, src/temples/pieces.js revealed / lensUp, src/gadgets/hidden.js LENS_VIEW (set by lens.js); the
    // glyph lens into the Buried Machine's makers' court (src/boxes/placements.js buried.monocle)
    { text: 'The seeing lens is now earned in the Garden of Spheres’ Footprint, where the glyph lens used to be: raise it, and the house shows what it hides, the stepping stones over the chasm, the eye on its pillar, the keepers’ door, and once the lens has seen them they stay. The walker’s prints and the Echo’s answering sphere show only while you look through it. The glyph lens, which shows unopened chests from far away, waits in the Buried Machine’s makers’ court, where the seeing lens used to be.',
      see: 'In the Garden of Spheres, open the chest in the Footprint’s Lens Chamber, walk on to the chasm and hold LT / L2: the stepping stones appear over it, and stay when you lower the lens.' },
    // src/temples/bazaar.js (the chest, the doors and the horns want the hourglass), src/echo-shell.js (the hourglass keeps a
    // note), src/gadgets/recall.js ('recall:note'); the echo shell retired, the market's makers' court without a box
    { text: 'The recall hourglass is now earned in the Signal Market’s Undertower, where the echo shell used to be, and does the shell’s work there: its sand keeps the last note sung near you, and turned on the empty air it gives the note back, to the passage’s horn, the listening pillars over the chasm, the Choir’s horns and the First Sign’s dishes. The echo shell is gone from the game; if you had it, the hourglass took its place.',
      see: 'In the Signal Market, open the chest in the Undertower’s Shell Chamber, splash the low singing stone by the dais, then turn the hourglass (RT / R2) at the empty air: it sings the note back.' },
    // src/temples/incal.js (the Ash Store's find, the Vane Room's chasm `needs: ['bridge']`), src/boxes/placements.js
    // incal.bridge (a temple find, `ready` once the store is won); the City-Shaft's makers' court without a box
    { text: 'The bridge pen is now the Warden’s Well’s first prize: beat the keepers in the Ash Store and a makers’ chest among the ash opens with it. The Vane Room’s chasm has no stepping stones any more: draw a plank across with the pen to reach its key, and another to come back once the ink wears away. The pen is no longer in the makers’ court beyond the City-Shaft’s rim.',
      see: 'In the City-Shaft, go into the Warden’s Well and west into the Ash Store: once its keepers fall, open the chest on its low mound by the wall, then cross the hub east to the Vane Room’s chasm and draw a plank (RT / R2).' },
    // src/temples/runtime.js unstrand (main.js marks the load), src/items.js BACKPACK_STAGES; tests/temple-unstrand.test.js
    { text: 'A journey saved inside a temple, beyond a room that now needs a gadget, is never stuck there: if you had already opened that temple’s chest, the gadget is yours when you load; if not, you wake at the last glyph stone you can walk out from. The backpack’s round tank now takes its third look from the gust fan, not the Warden’s bellows.',
      see: 'Load a journey saved inside a temple: you stand where you saved, or, past a gadget’s room without it, at a glyph stone on the near side.' },
    // src/trials/data.js rewards, src/items.js (trial, where; three cosmetics renamed for their new runs)
    { text: 'The mastery trials’ prizes follow the gadgets to their temples, so a run never pays out for a gadget you can’t have yet: the fourth coil is the Tube run’s now, the fourth notch the Glass slalom’s, the fourth pouch the Canyon dive’s, the strong lodestone the Floor round’s, the clear glass the Garden round’s and the wide vane the Courier’s round’s. The Stone circuit, the Reed race and the Lagoon laps give a rider’s cap, a reed pin and a lagoon ribbon.',
      see: 'Open the items page: each trial’s prize says which run gives it. Finish one of the runs above again to win its new prize.' },
    // the fight temples of the other worlds (issue #341): src/fight-temples/arzach.js (the table), hazards.js (the gusts, the
    // millstones, the pour, on lanes), dress.js (each world's pillars and things round the hall), rooms.js (a cliff, a
    // flooded floor, a world's sky); src/minigames/fight-arzach.js; story/hosts-data.js; docs/design/fight-temples.md
    'A new fight temple in Vael, the Wind Cloister, on the rose cliff by the riders’ monastery over the cloud: four rooms of sky rays, herons and blots seen from high above, and gusts that blow down lanes of the floor. Pale arrows show where first; then the wind shoves you and carries every foe in it into the wall. Clear it for the Rider’s slate colours for your backpack, sword and shield.',
    // src/fight-temples/perdide.js, src/minigames/fight-perdide.js (hazards.js 'stone')
    'A new fight temple in Lorn, the Drowned Mill, on the dry hillside south-east of the landing: four flooded rooms of toads, root knots and skitters, and millstones that roll down the floor where it shows rust. Step aside or roll through, and let them crush the crowd. Its prize: the Reed and rust colours.',
    // src/fight-temples/moonfoundry.js, src/minigames/fight-moonfoundry.js (hazards.js 'pour')
    'A new fight temple in the Moon Foundry, the Pour Floor, just south of the workers’ quarter: four casting bays of carts, skitters and horn lizards, their floors cut with channels whose rims glow before they fill with slag. Stand clear, or lead the foes in. Its prize: the Moon slag colours.',
    // issue #47, sixth round: src/feet.js FEET.lateRelease, ballTurn, pushOffBrake, stepMove, src/locomotion.js WARP_HOLD;
    // scripts/motion-qc/lib.mjs (jolts at the frames' own times), .claude/skills/motion-qc/run.mjs (unsteady runs);
    // tests/motion-qc.test.js ("sixth round")
    'Turning on the spot and setting off into a jog to the side, the foot he turned on no longer hops and snaps his knee; reversing at a sprint, his feet no longer skate across the floor or swing his knee across as he comes round; and his settling steps lift before they move.',
    // the Unity build's GPU on the Retroid, round 5 (issue #262): BridgeRenderer.StaticBatch / Unbatch (static batches on
    // Android), BridgeMetrics (-variants); tests/unity-retroid-batches.test.js; docs/systems/performance.md "Unity on the
    // Retroid, round 5"
    { text: 'The Unity preview on the Retroid draws the world’s still buildings and props in fewer batches: up to 3 frames a second more in the City Floating in Space and the Signal Market, 1 more over the City-Shaft. With the frame readout on, each world’s first seconds no longer stutter once.',
      numbers: [{ title: 'Frames a second in the Unity preview, before → after', unit: 'fps', better: 'higher', device: 'Retroid Pocket Nova, Handheld preset at 0.75 of 1280 × 960, muted', rows: [
        { where: 'the City Floating in Space, the wide view', before: 54.9, after: 58.2 },
        { where: 'the City Floating in Space, its start', before: 50.9, after: 52.5 },
        { where: 'the Signal Market, the wide view', before: 55.0, after: 56.8 },
        { where: 'the Signal Market, the second crowd', before: 55.5, after: 57.3 },
        { where: 'the City-Shaft, the wide view', before: 35.8, after: 36.8 },
        { where: 'the City-Shaft, the second crowd', before: 56.7, after: 57.4 },
        { where: 'the Desert, the spawn (the slowest 1 % of frames)', before: 28.7, after: 41.8 },
      ], source: 'the bridge\'s bench (-views -bench 6), 16 October; the mean rate over each view', note: 'Lorn and Underwater are unchanged; GeckoView, the web version, is still ahead there and in the Signal Market.' }] },
  ] },
  { v: '1.79', date: '2026-10-15', items: [
    // the switch (issue #111, plan D19): scripts/steam-deck/deck.py DEFAULT_ENGINE 'unity', the Linux player's vsync
    // (BridgeRunner); docs/systems/performance.md "The Steam Deck, round 12" and "round 13", docs/steam-deck.md "The engine"
    { text: 'On the Steam Deck, Hiraeth now starts the Unity version of the game: smoother in every world, much quicker to load, and held to the screen’s 90 Hz with a new picture at every refresh. The version you played until now stays beside it in your library as Hiraeth (web), with your journey there; the Unity version keeps its own journey, so you start a new one in it.',
      numbers: [{ title: 'Frames a second on the Steam Deck (the median of each world’s views and walks), web → Unity', unit: 'fps', better: 'higher', device: 'Steam Deck OLED, Gaming Mode, plugged in, 1280 × 800, the Steam Deck preset, 90 Hz (the Unity player uncapped for this row)', rows: [
        { where: 'the Desert', before: 52.1, after: 77.6 },
        { where: 'Vael', before: 63, after: 82.5 },
        { where: 'Lorn', before: 63.3, after: 72 },
        { where: 'the City-Shaft', before: 54, after: 66 },
        { where: 'the Signal Market', before: 72.7, after: 91.7 },
        { where: 'the City Floating in Space', before: 74.4, after: 97.4 },
      ], source: 'scripts/bench/deck-engines.mjs, both builds from the same commit, 15 October', note: 'Ahead in all 13 worlds; the share of frames slower than 60 fps fell from 17–66 % to 0–17 % in the seven slowest.' },
      { title: 'Loading a world (a warm start), web → Unity', unit: 's', better: 'lower', device: 'Steam Deck OLED, the same runs', rows: [
        { where: 'the Desert', before: 46.4, after: 13.8 },
        { where: 'the City-Shaft', before: 53.8, after: 24.2 },
        { where: 'the Garden of Spheres', before: 64.5, after: 12.1 },
        { where: 'Home', before: 18.2, after: 8.8 },
      ], source: 'scripts/bench/deck-engines.mjs: the web from the navigation to its first frame, Unity from the launch to its world settled' },
      { title: 'Held to 90 Hz: frames a second, Unity uncapped → with vsync', unit: 'fps', better: 'higher', device: 'Steam Deck OLED, 90 Hz', rows: [
        { where: 'Home (uncapped, the frames ran ahead of the screen)', before: 107, after: 90 },
        { where: 'the Glass Dunes', before: 104, after: 90 },
        { where: 'the Moon Foundry', before: 105, after: 90 },
        { where: 'the Desert (under 90 either way)', before: 78.3, after: 76.1 },
      ], source: 'the same player with -vsync 0 and with its new default, 15 October', note: 'At 90.0 every refresh gets a new picture; uncapped, the frames came unevenly, 9 to 14 ms apart.' }] },
    // the Steam Deck's pipeline list (issue #111): unity/Hiraeth/Assets/StreamingAssets/hiraeth-pso/Vulkan.graphicsstate,
    // BridgePso (warmed once the script's engine is made), scripts/bench/deck-pso-trace.mjs, tests/unity-pso.test.js;
    // docs/systems/performance.md "The Steam Deck, round 14", docs/steam-deck.md "The pipeline list"
    { text: 'On the Steam Deck, the game no longer freezes for a second or two the first time it draws something new in a world. Every world’s shaders are now prepared while the game loads. The first launch after an install takes a few seconds longer, with the loading screen holding still meanwhile; every launch after it is quicker than before.',
      numbers: [{ title: 'The first launch on the Steam Deck (an empty shader cache): the longest freeze once the world is up', unit: 'ms', better: 'lower', device: 'Steam Deck OLED, Gaming Mode, 1280 × 800, the Steam Deck preset, every view and walk of the world', rows: [
        { where: 'Viridel', before: 1878, after: 0 },
        { where: 'the Desert', before: 1208, after: 0 },
        { where: 'Vael', before: 1166, after: 0 },
        { where: 'Lorn', before: 1155, after: 0 },
        { where: 'the Moon Foundry', before: 1095, after: 0 },
        { where: 'Home', before: 1007, after: 0 },
      ], source: 'the same Unity player without and with its list (-no-pso), 16 October', note: 'Six of the 13 worlds froze once, for 1.0–1.9 s; now none has a frame over 50 ms that the shaders cause. The frozen first frame of the load (4–9 s) is gone too.' },
      { title: 'Launch to the world’s first frame, before → after', unit: 's', better: 'lower', device: 'Steam Deck OLED, the same runs', rows: [
        { where: 'the Moon Foundry, a later launch', before: 13.9, after: 9.7 },
        { where: 'Vael, a later launch', before: 17.2, after: 12.9 },
        { where: 'the Desert, a later launch', before: 14.8, after: 13.2 },
        { where: 'the Desert, the very first launch', before: 22.3, after: 23.7 },
        { where: 'the City Floating in Space, the very first launch', before: 14.4, after: 21.9 },
      ], source: 'the same runs', note: 'Later launches are 0.2–4.3 s quicker in every world; the very first one is 1.4–7.5 s slower, once.' }] },
    // helping a guardian instead of fighting it, as minigames (issue #339): src/minigames/elderflight.js (the sky, the
    // camera, the Elder posed in flight), formation.js (pure: the route, her wake, the slot, the gates, the gusts, her
    // courage, botInput); story/hosts-data.js Corra; tests/minigames-helpers.test.js; docs/design/helper-guardians.md,
    // docs/systems/minigames.md "The Elder's flight"
    'A new game in Vael, The Elder’s flight: the Elder won’t fly alone, so fly at her wing from the Aerie across the sea of cloud to the riders’ Old Roost. Hold the slot in her wake, go through your ring of every wind gate beside hers, cross to the side she calls, and keep her courage up. Ask Corra at the foot of the Aerie’s steps.',
    // src/minigames/cistern.js (the court, the stones, the water, the Keeper), channels.js (pure: makeBoard with a way to
    // every trough, flowStep, turnStone, three floods, botMove); story/hosts-data.js Nuri; docs/systems/minigames.md
    'A new game in the desert, Cistern channels: under the Rose House, turn the Givers’ channel stones ahead of the water so it reaches the Keeper’s troughs before it spills. Three floods, each faster; hold RT / R2 to hurry the water for double points. Ask Nuri by the Rose House’s steps.',
    // the v1.76 prototypes taken out: src/guardian-help/, tests/guardian-help.test.js, boot.js + main.js ?guardianHelp,
    // world-picker.js Prototypes, fluid-kit.js MODES.cannon, fluid-tool.js lent / pourStream / streamCatch
    // the Unity preview's small gaps (issue #264): kit/labels.js as the screen's 'words', BridgeHud.cs DrawWords / DrawSpeed;
    // engine/game.js a driving game's camera under its card, the bird and the bike (bird.js, bike-worlds.js), canSummon,
    // globalThis.weather and the weather's calm, 'travel:refused'; docs/systems/engine-bridge.md "The words in the world"
    'In the Unity preview the games’ floating score words show over the world as on the web: “+10”, “+250”, “×3”, “spilled”, the shooting gallery keeper’s speech balloon and the Sunken Hall’s labels; the fast games’ speed lines streak in from the screen’s edges too.',
    'In the Unity preview, Cistern channels’ start card shows the whole court from above, as on the web, not the view from behind the traveller.',
    // src/minigames/canyon.js: burst() read the block's fx / fz before they were made (a wall's or a drift's burst)
    'The Canyon run no longer breaks off when the bike hits a wall or ploughs into a sand drift.',
    'In the Unity preview the hoverbike comes along to the worlds made for riding and Vael’s bird answers your call under open sky, as on the web; rain on Lorn’s Great Crystal makes it sing; and a flight turned down for a missing gadget starts the quest that leads to it.',
    'The two helping prototypes in the Debug menu (catching the Elder’s stone feathers in the Roost, the water cannon in the Keeper’s cistern) are gone: the two games above take their place.',
    // issue #376: src/bike-worlds.js trailVehicle (main.js: the trails behind the vehicle ridden, not the mount alone)
    'In Viridel and the Garden of Spheres the hoverbike leaves its glowing trails behind it again. Where Vael’s bird answers your call, the bike waiting by the ship rode without them.',
    // issue #371: src/ship/starmap.js worldToward / chartToward / DIR_KEYS, StarMap.move; engine/starmap.js move (the Unity map)
    'On the galactic map, up and down now choose a world too: every direction on the D-pad, the stick or the arrow keys picks the nearest world that way on the chart. Up and down used to step along the route, the same as left and right.',
    // skirts on a few (issue #370): src/costumes.js robed() (ROBE_ODDS, T.robeOdds, wearsSkirt), decided from a hash of the
    // look like the capes; scripts/cape-census.mjs --skirts; tests/skirt-share.test.js; docs/systems/characters.md
    'Far fewer people wear skirts and long robes: most of the crowds and townsfolk now wear trousers. Robes stay where they belong, on Vael’s silent ones, the bell monastery’s brothers and sisters and the Garden of Spheres’ listeners, on some elders and pilgrims with a staff, and on the people whose own design has one.',
    // plain speech (issue #369): townsfolk, crowd and balloon lines, hosts, shopkeepers and Anselm Thrum rewritten plainly
    // across src/story/*-data.js, src/levels/*.js, hosts-data.js, shop-data.js, scientist-data.js, rumours-data.js
    'People who aren’t part of a quest now talk plainly: Anselm Thrum, the shopkeepers, the games’ hosts and the townsfolk say what they mean, where things are and what to do, instead of riddles and sayings. The people whose quests you follow keep their own way of speaking.',
    // hints say where, not who: arrival lines (levels/perdide.js, spheres.js, content.js), townsfolk pointers
    // (desert-data, bazaar-data, aliens-data, underwater-people, buried-data, perdide-data, arzach-data), the Lorn
    // box's hint and note (boxes/placements.js), a rumour (rumour-places.js); tests/quest-steps.test.js "where, not who"
    { text: 'Hints now say where to go, not who to find: arriving in Lorn you hear the crystal is east of the landing, over the hill and through the ford, instead of who knows the way; the same for the Signal Market, the Garden of Spheres and the desert’s arrival lines, and for townsfolk who used to send you to someone sitting by the place they had just named.',
      see: 'Before, arriving in Lorn: “A huge crystal hums east of the landing. Wendel the egg-warden knows the way; Saba listens at its foot.” Now: “A huge crystal hums east of the landing, over the hill and through the ford.” Before, the Signal Market: “Sel waits at its foot with a message nobody has heard.” Now: “one silent tower at the avenue’s end with a message nobody has heard.” In Vael, rapping the stone hand: before “Kesh, beside the hand, can show you”, now “the dots on each knuckle count it out”.' },
    // the traveller's feet, issue #47's fourth round: src/player.js FACE.runMax, src/feet.js FEET.landBack 0.2 -> 0.3,
    // pivotFinish, releaseLag / releaseLagRise / releaseLagLevel, rideDownAhead, src/loco-moves.js MOVES.smooth;
    // tests/motion-qc.test.js ("fourth round"; the stairs at a run still todo)
    'Turning round at a run, his foot no longer whips round and stops dead as it lands; turning on the spot into a walk or a jog, the foot stepping round finishes its step instead of stopping in mid-air; and jogging up and down stairs, his feet rise onto the next step and come down onto the one below without his knees flicking.',
    // issue #374: src/carry.js pickUp's own `t` (the thing) hid i18n's t(), so the first pick-up's teaching line threw
    // out of the frame loop; tests/carry.test.js, tests/engine-carry.test.js, tests/i18n-shadow.test.js
    'Picking up a crate or a weight for the first time in a save no longer freezes the game: the line saying how to put it down and throw it now shows instead.',
    // the Mother Snapper's fight (issue #373): src/temples/perdide.js motherHit (MOTHER_STILLED), motherCrystal (each
    // note its share), phase two's snap every other move; guardians.js SNAP_LOOM; boss.js Guardian.landed and
    // targets.js hitTarget's info.dull (the splash of a wall, fluid-tool.js); tests/mother-snapper-fight.test.js,
    // tests/engine-mother-snapper.test.js; docs/systems/foes.md "Every glob that sounds like a hit takes"
    { text: 'The Mother Snapper’s fight can be finished from anywhere in her hall. Rearing to snap, her head now looms out over you, so a push reaches it even from the middle of the hall, and she rears to snap twice as often. Still her as she winds up and her head drops, mouth open, ready for the cold. Every stilling shot that rings bright now calms her and moves her bar, each crystal sung in turn too; one that does nothing splashes dull, as on a wall.',
      see: 'In the Hush-House, wake the Mother Snapper and shoot a stilling glob into her jaws as she rears back: her head drops spent, agape; still her mouth and the bar goes down. In her second phase stand in the middle of the hall: as she rears to snap her head comes out over you, and a push into it slams it down.' },
    // a temple's ending filmed (issue #366): src/temples/finale.js (one shape, the house's own details), runtime.js
    // onBossResolved / glowUpdate, index.js; docs/systems/cinematics.md "A temple's ending"
    'Every temple now ends on a short film once its guardian is calmed or stopped: the guardian at rest, its reward on the floor, the house from high up as its glyphs light, then the way out sinking open, with the world’s own music playing through it. B / ○ or Esc skips it.',
    // the Sunken Hall (issue #368): src/fluid-blade.js WIDE_CUT (sweeps, sweepHits, underSweep, the hall's longer sword),
    // src/slash-arc.js; src/fight-temples/rules.js GORGED, FURY, GEYSER, geyserSpots, rankFor, session.js the wells, the
    // geysers, the shards, the last few's pillars, the strays put back; docs/systems/minigames.md "The Sunken Hall as a game"
    'In the Sunken Hall you now see your sword’s sweep: each cut throws a crescent of its water round you, and what the crescent covers is exactly what it cuts. It reaches less far than before (foes fell well past anything you could see), and the sword is drawn longer in there so you can follow it from high above.',
    'The Sunken Hall’s waves are more of a fight: an ember ring wells up on a spring just before foes climb out of it, and from the second room on most waves bring a gorged one, bigger, with a pale ring at its feet, that leaves a heart and an ember shard: pick it up and your cuts land twice as hard for 8 seconds.',
    'From the second room of the Sunken Hall on, ink geysers open on the floor, one under you and more nearby: get out of the ring, or roll through it, before it bursts. Foes caught in one are cut by it, so lead the crowd in.',
    'The last few foes of each Sunken Hall wave stand under a pillar of light so you can find them, one that slipped behind a wall is put back in the room (a run could never end), and the results give you a rank from S to C by your time and the hearts you lost.',
    // (issue #372: src/temples/air.js HOUSE_AIR; docs/design/temple-ambience.md, docs/systems/temples.md "The houses' air")
    'The makers’ houses now have an air of their own: embers rise in the Rose House, the Engine-House and the Casting-House, whose lamps flicker; sand streams through the Aerie and falls slowly in the Clock-House, dust climbs the Warden’s Well, bubbles rise in the Whale-House, drips fall in the Hush-House, teal glints hang in the Mooring-House. Each house sounds like itself too (a furnace’s roar, drips, far bells, a clock’s ticks, creaking cables), and the dust and noise of the world outside stay at the door.',
    // the stairs at a run (issue #47, fifth round): src/locomotion.js StairLine / STAIR_LINE (the drawn body on the stairs'
    // line, read ahead), src/feet.js FEET.rideOver, dropKeep, softFlight; tests/motion-qc.test.js ("fifth round", StairLine)
    'Sprinting up or down stairs, his body now rides the line of the flight, rising smoothly onto it and levelling out onto the landing, instead of climbing in jerks step by step and stopping dead at the top; his kicked-back foot no longer folds up against his hip on the way, and his knees no longer flick as his feet land on the steps.',
    // the Unity build's GPU on the Retroid, round 4 (issue #262): engine/game.js (cullFar on the small props, instancesFar
    // on main.js's tiled sets: perf.js tilesInstances), engine/unity/backend.js desc.far, InstMats.far (Wildlife.cs),
    // the shadows' renderer lists on Android (BridgeRunner), HiraethShadows (another camera's plans: Home's crash);
    // tests/unity-retroid-far.test.js; docs/systems/performance.md "Unity on the Retroid: every world"
    { text: 'The Unity preview on the Retroid runs smoother where the most is drawn: small props past the distance the web version stops drawing them at are left out here too, and the shadows are drawn in far fewer batches. 44 frames a second at the City-Shaft’s start (40 before), 57 in its second crowd (51), 54 where the Desert starts (51), 47 in Lorn (44). In Lorn the ground is no longer wrongly in shadow.',
      numbers: [{ title: 'Frames a second in the Unity preview, before → after', unit: 'fps', better: 'higher', device: 'Retroid Pocket Nova, Handheld preset at 0.75 of 1280 × 960, muted', rows: [
        { where: 'the City-Shaft, its start', before: 40.3, after: 44.4 },
        { where: 'the City-Shaft, the second crowd', before: 50.7, after: 56.7 },
        { where: 'the City-Shaft, the wide view', before: 33.5, after: 35.8 },
        { where: 'the Desert, the spawn', before: 51.1, after: 54.0 },
        { where: 'the Desert, the camps', before: 52.5, after: 55.6 },
        { where: 'Lorn, its start', before: 44.2, after: 46.8 },
        { where: 'Lorn II, the wide view', before: 46.4, after: 49.2 },
        { where: 'Vael, the second crowd', before: 52.4, after: 60.1 },
      ], source: 'the bridge\'s bench (-views -bench 6), every world\'s views, 16 October; the mean rate over each view', note: 'The GPU 0.7 ms less a frame across all 69 views, up to 3 ms. GeckoView, the web version, is still ahead by 7–10 fps in the Signal Market, Lorn, Underwater and the City Floating in Space.' }] },
  ] },
  { v: '1.78', date: '2026-10-15', items: [
    'The makers now sign their work with an open corner and a shorter upright: a bold, simple mark on temple doors, carved walls, machines and the ship’s scar. The dialogue and map show the same sign, and its descriptions match what you see.',
    'The last of the makers’ old sign, three dots over an arc, is gone: the Lantern’s tower, the great stone face on the sky stones, Talo’s post in Viridel, the gauges in the buried machine, the wind-silk scarf and the makers’ pebble at Home now carry the open corner too, and so does the small sign carved under each lit one along the temple friezes.',
    // (issue #342: the skins' own "arch under three dots" gone, every skin takes story/sign-text.js glyphGeometry;
    // tests/makers-mark.test.js finds the mark in every skinned house by its vertex signature)
    'Inside the futuristic temples the makers’ mark is the new one too: the Casting-House’s cradles, doors, friezes and moon ring, the Engine-House’s and the Aerie’s friezes now carry the open corner in each house’s own light, no longer an arch under three dots.',
    // the lock-on's side-run (issue #47 after #360): src/player.js LOCK_MOVE sideRun / yawK / twist, updateStrafe,
    // sideRunTurn, sideRunTwist (the pack's strafes stepped forward and back); tests/strafe.test.js
    'Locked on to a foe, moving left or right he now runs sideways: his hips and legs turn the way he goes while his chest and head stay on the foe, and his feet stay where they land. He used to step on the spot at a frantic pace and slide across the floor, his knees and feet flicking several times a second.',
    // the walk back: src/player.js strafeRate (LOCK_MOVE rateMax, reachMax), feet.js o.reach; the feet's gait share under a step
    'Locked on, stepping back flicks his knees far less: his steps are longer instead of three and a half times too quick, and his feet no longer drag off where they land.',
    // the knees (issue #47): src/feet.js FEET.soft 0.02 -> 0.035, relockKeep, restKeep, the early touchdown only coming
    // down, a stepping foot's turn kept continuous; tests/motion-qc.test.js (the B3 test, no longer todo)
    'His knees no longer flick straight at the start of a walk, at a slow walk’s steps, walking up a slope, as he comes to a stop, or as he settles after turning on the spot.',
    // the sprint's steps (issue #47, second round): src/feet.js FEET.plantShown, landBack 0.14 -> 0.2, releaseMin / dragSpeed,
    // reachGrace; tests/motion-qc.test.js ("the sprint's steps, the 180° turns…")
    'Sprinting and setting off at a run, his feet stay where they land: they no longer slide a hand’s width on as they touch down, and the foot left behind as he sets off lifts off the floor instead of dragging along it.',
    // the pivots' crossed feet: src/feet.js FEET.stepPathGap / stepPathRate (a pivot's step round kept to its own side on its way)
    'Turning on the spot, his feet no longer cross: the foot stepping round goes round the other one.',
    // the stairs: src/locomotion.js STEP_LAG.climb / fast (the drawn body carried up a flight with it at a sprint), src/feet.js FEET.rideSpring;
    // the motion QC's recorder reads the joints against the drawn body (scripts/motion-qc/sample.mjs)
    'Running up or down stairs, his body rises and falls with the flight instead of trailing under the steps: his legs no longer fold up to reach the treads, his feet no longer sink into them, and his knees flick less as he steps down.',
    // the forearm: src/humanoid.js shareWristRoll (the roll kept on its side from frame to frame); tests/motion-qc.test.js
    'Turning round at a run or reversing a sprint, his forearm no longer flips over for a frame.',
    // the walk back: src/player.js LOCK_MOVE.backRun (the loops' gait run backwards, src/animator.js s.reverse); tests/strafe.test.js
    'Locked on, pulling back he now jogs backwards, his feet staying where they land instead of sliding most of a step each time.',
    // the running turns (issue #47, third round): src/animator.js GAIT_HOLD, src/feet.js FEET.earlyShown / dropShown,
    // src/player.js FACE.jerk, src/locomotion.js LOCO.pivotGait, src/characters/tripo-walk.js ARM_HANG; tests/motion-qc.test.js
    'Turning round at a run or a sprint, his feet no longer drop for a frame as he slows through the turn, a foot coming down mid-turn no longer slams onto the ground, his feet no longer cross as he sets off again, and his arm no longer jerks round as it swings up behind him.',
    // the landings and releases: src/feet.js FEET.landEase (and landBack reached by tanh), FEET.toeOffTail
    'At every pace his feet land more softly: each slows to a stop as it touches down instead of skidding the last few centimetres, the foot behind lets go of the ground cleanly, and his calves no longer flick as he pushes off into a sprint.',
    // the walk back: src/feet.js FEET.pushOffBack (o.reverse from src/player.js); tests/strafe.test.js (no longer todo)
    'Locked on and stepping back, his knees no longer flick at every step.',
    // a pivot's step round: FEET.footLag, FEET.landPlanted; the stairs: FEET.reachGrace's third, FEET.rideAheadSpring
    'Setting off the other way from standing, the foot stepping round no longer spins in a frame; jogging down stairs, a foot set on the step below stays there instead of sliding across it.',
    // the Sunken Hall's buttons (after issue #365): src/fight-temples/session.js (jump suppressed), index.js (controls
    // cards, touch jump hidden); tests/fight-roll.test.js
    'In the Sunken Hall, B / ○ rolls and jumping is disabled: A / × and Space do nothing, and the touch jump button is hidden. Jumping elsewhere works as before.',
    // the Footprint's futuristic skin (issue #342): src/temples/skins/footprint.js, spheres.js `skin`;
    // tests/temple-skins.test.js; docs/systems/temples.md "The Footprint"
    'Inside, the Footprint is a white sphere of the makers’ old high technology now, after the drawing picked for it: smooth cream panels with round and octagonal plates set in them, walkways ringing every tall room with pale blue-white light along their edges, lit lines along the floors, the ledges and the walls’ foot, round lens terminals of teal glass, and thin rings of light floating under the oculi. The rooms, doors and puzzles are where they were.',
    // the Steam Deck's main thread (issue #111, round 10): src/empty-instances.js, shadows.js shadowVariants and
    // ShadowCuller.begin, ship/cinema.js holdsToasts, wind.js (wisps out of the view), perf.js cullers, static-batch.js
    // opaqueSort / Watch.holds; tests/deck-main-thread.test.js; docs/systems/performance.md "The Steam Deck, round 10"
    'On the Steam Deck every world runs 2 to 7 frames a second smoother at full resolution: the Signal Market, Viridel, the Underwater City and the City Floating in Space now hold 60, and the desert, the City-Shaft, Vael and Lorn are closer to it.',
    // the Steam Deck's main thread, round 11 (issue #111): perf.js deck peopleLod / skipHidden / nearEvery 4 / nearFight,
    // main.js (npc offView, catchUpShown), engine/scene-matrices.js catchUpShown, shadows.js nearDue / farDue /
    // nearEveryNow; tests/deck-levers.test.js; docs/systems/performance.md "The Steam Deck, round 11"
    'On the Steam Deck the four slowest worlds run 3 to 4 frames a second smoother again: people out of sight in the distance, things hidden from view and the shadows near you cost the console less, and nothing on the screen looks different. In a fight the shadows near you are drawn as often as before.',
    // the Xbox's Unity preview at 4K (issue #113): unity/Hiraeth BridgeRunner Experiments / Uhd / DynamicResolution,
    // BridgeMetrics HdmiHeight, HiraethLook.PixelRatio; tests/unity-xbox.test.js; docs/systems/performance.md "4K on the Xbox"
    // the Unity preview's take-off warp and keyboard rebinding (issue #264): src/ship/cinema.js Warp (screen 'warp'),
    // BridgeHud.cs DrawWarp; engine/menus.js controlsRows (REBIND_KEYS), src/remap.js keyRouter, engine/unity/game.js keyChanges
    { text: 'In the Unity preview, flying to another world ends in the take-off’s warp as on the web: space opens out of the middle of the screen, streaks rush past and the next world’s name shows, and it stays while that world loads. The Controls page now lets you move each keyboard verb to another key too, with clashes marked and a reset.',
      see: 'In the Unity preview, travel from the ship’s holo table to another world and watch the end of the take-off. Then open the Start menu’s Controls, choose Jump under Your keys, press K, and jump with K.' },
    // the Unity-default plan's D3, D7, D8 (issue #264): engine/game.js createFragments / updateHazards, engine/menus.js
    // quality opts, BridgeRunner.Away + BridgeHost.AwayCount
    { text: 'In the Unity preview the fragments of the singing light are in every world, singing near and taken by walking into them, so Anselm has something to sell for; fire and cactus spines hurt again. Leaving the game (the Steam button, a suspend, the home button) silences it and you come back to it paused in the Start menu. Graphics now offers Steam Deck and Auto.',
      see: 'In the Unity preview on the Steam Deck, press the Steam button during play: the sound stops, and closing Steam’s menu finds the Start menu open. Walk to a fragment’s glow to take it, and open Settings > Graphics for Steam Deck and Auto.' },
    // the Unity preview finishable (issue #264, docs/plans/unity-finishable.md): engine/chart.js, engine/game.js (Story, Relics,
    // the homecoming), src/ship/homecoming.js (no page: the cargo answered, the card and credits as lines); tests/engine-finishable.test.js
    { text: 'The Unity preview can now be played to the end. Aboard, the ship flies to every world the route has opened, the ones you have never been to as well, and Home and the Lantern once they open. Coming home by ship plays the homecoming, and the true ending’s end card and credits show as lines under the picture. Each world’s closing words and the small things hidden in every world are back too, and a guardian’s fight shows its bar at the bottom of the screen, its name and its health or unrest.',
      see: 'In the Unity preview, finish the desert, power the ship and use the holo table: Vael can be found and flown to. With six worlds done and the last recording heard, fly Home.' },
    // the galactic map in Unity (issue #264): engine/starmap.js (EngineStarMap, the page's model: src/ship/starmap.js
    // chartDrawing, firstPick…), engine/menus.js 'starmap', BridgeMenu.StarMap.cs; engine/chart.js gone; tests/engine-starmap.test.js
    { text: 'In the Unity preview the holo table opens the galactic map as on the web: the worlds on their orbits round the star, the way on marked NEXT, the relay’s faint signal, and the signature search. A world not charted yet waits in an uncharted region: sweep the chart with the left stick or W A S D until the scanner warms and sings, hold it there, and the planet appears on the chart. The Worlds page flies only to worlds you have been to, as on the web, and when the ship refuses to leave without a world’s gadgets, the quest that leads to them starts.',
      see: 'In the Unity preview, finish the desert, power the ship and use the holo table: sweep the uncharted region with the left stick until the meter says locking, then choose Vael and fly.' },
    // the Unity preview's HUD on the world (issue #264): BridgeHud ToCanvas from the viewport, laid out in LateUpdate;
    // -hud-trace / -hud-old / -hud-run (docs/systems/engine-bridge.md "The HUD on the world's points")
    'In the Unity preview the stamina wheel and the floating “talk to” tag hold still beside the traveller and the person while you run, as on the web: they no longer shake, nor hang off to one side.',
    // the round backpack in Unity: Figure.hlsl nebula / flaskNebula (materials.js), the dome through port-format.js
    'In the Unity preview the backpack’s glass shows the same little green galaxy as on the web, lit from within with its stars, instead of a pale glass with dark streaks.',
    // the end of the road in Unity (docs/plans/unity-finishable.md): src/story/ending.js roadDone, ROAD (main.js's page), engine/game.js
    { text: 'In the Unity preview, telling every world’s story and keeping every small thing ends with the closing words, as on the web: the end of the road, the sketchbook full, Home on the ship’s map.',
      see: 'In the Unity preview, with every world’s story told and its small things found, the last one kept brings the lines “THE END OF THE ROAD” and “The sketchbook is full.”' },
    'The Unity preview on the Xbox now sends a 4K TV a 4K picture, still at 60 frames a second: the world is drawn as sharp as the console can keep up with, about 3520 × 1980 at the desert’s spawn and 2750 × 1550 at the City-Shaft’s rim, where it was always drawn at 2560 × 1440 and stretched by the console. The ink lines keep their weight.',
    // the Unity build's GPU on the Retroid, round 3 (issue #262): Surface.shader (each part's derivatives next to it,
    // HIRAETH_PLAIN, the lean prepass without a discard, the crowd's and grass's varyings), BridgeRenderer.Lean,
    // HiraethLook.CullLightsToView; tests/unity-retroid-gpu.test.js; docs/systems/performance.md "Unity on the Retroid:
    // what each pixel carries"
    'The Unity preview on the Retroid runs smoother again, with the same picture: 52 frames a second where the Desert starts (46 before), 54 at the camps (48), 42 at the City-Shaft’s start (37) and 35 over its wide view (28), and 51 to 60 in the Signal Market (43 to 60). Surfaces without a wall’s marks no longer carry their work, and lamps out of view no longer cost every pixel.',
    // the ship aboard in Unity (issue #264): engine/unity/port-format.js 'planet' (BridgeRenderer.cs → Hiraeth/Planet),
    // src/ship/art.js hasCanvas (engine/platform.js canvasDrawsNothing), interior.js picture's paper; the hold inside:
    // src/ship/ship.js ROOMS_R2 (isInside's far cut was 20 m, the hold reaches 26); tests/ship.test.js, engine-unity, engine-ship
    'Aboard the ship in the Unity version, the holo table shows the planet in its colours and markings. It used to be a white glowing disc. On every version, the back of the hold now counts as inside the ship: rain and blowing sand no longer reach it.',
    // the game's canvases in the engines (issue #264): engine/raster.js (paths, text in engine/glyphs.js's open fonts,
    // gradients, pictures), engine/platform.js StubCanvas, engine/unity/backend.js _texture, BridgeRenderer.Texture,
    // Surface.shader _Map; src/ship/portrait.js CallScreen.size / fps; tests/engine-raster, engine-unity, engine-ship
    'In the Unity version, the ship’s round console screen shows what it shows on the web: the voicemail’s standby, NO POWER, a new message waiting, the reels turning as a recording plays. The pictures on the walls show their drawings: the child’s drawing of the family, the mother’s note, the photo of home and the star chart. They were a dark screen and white cards. The arcade signs, the name boards and the drawings at Home are lettered and drawn too.',
    // the Arena's foe list in the engines (issue #264): engine/menus.js openFoes / foesView, BridgeMenu.cs DrawFoes,
    // BridgeHud.cs DrawFoeTab (the screen's foeTab), engine/game.js (FoeList attached); tests/engine-menus, engine-combat
    'The Unity version’s Arena has its list of foes: D-pad ↓ or K opens it, LB / RB goes through the worlds, and A / × on a foe brings it in to fight, again each time it falls. A world’s waves, the temple guardians, “Waves again” and “Clear the field” are there as on the web, and the FOES tab at the left edge says how to open it.',
    // the fight in Unity (issue #264): engine/combat.js (src/foes.js Foes, lockFollow, guardianBox, the drops, the potion,
    // the hazards, low-health, the knock-out's card), BridgeHud.cs (the hearts, the reticle, the warnings, the edges, the
    // restart card); tests/engine-combat.test.js
    'The Unity version now has the fight: the ink blots and the makers’ machines come for you, and the temple guardians wake in their arenas. Lock on with R3 or Tab: the gold arrows turn round the foe, and the camera keeps it ahead, or frames a guardian whole with you. Cuts, hops and the perfect dodge work as on the web. Fallen foes drop chimes and potions. The hearts show their quarters beside your potions and chimes. At one heart the edges of the screen pulse red. Knocked out, A / × gets you up again. Stuck in a guardian’s fight, the drone gives its hints when you ping it.',
    // the guardians' skins in the engines: src/characters/skin-colours.js, public/guardians/*/colors.json
    // (scripts/tripo/sample-colors.mjs), BridgeBuild.cs copies the Elder's skin too
    'In the Unity version, the Rose House’s Keeper and the Elder of Vael wear their own colours. The Keeper used to be white, and on a device the Elder fell back to her old body.',
    // the trials and games in the Unity build (issue #264): engine/trials.js (createChallenges, the games' signs, the hosts),
    // engine/game.js createGame({ game, from }), src/minigames/kit/runner.js cardModel / publish, engine/menus.js 'card',
    // BridgeMenu.cs DrawCard, BridgeHud.cs DrawMinigame; tests/engine-trials.test.js; docs/systems/engine-bridge.md
    { text: 'In the Unity version the trials are there: every world’s trial and makers’ runs stand where they do on the web, their hosts beside the signs, and they play with the start card, the 3-2-1, the clock and the gates, the pause and the results card, on the pad or the keys. The games played on their own grounds (the Sunken Hall, the races, fishing, the drum circle) start from their hosts too, and Quit brings you back by the sign. The Sunken Hall keeps its buttons: B / ○ rolls, no jump.',
      see: 'In the Unity build, walk up to the makers’ post of the Wind hall west of the desert’s landing, read it and choose Play: the start card, then the 3-2-1 and the clock at the top. Menu pauses it.' },
    // the light pools in the Unity build (issue #264): HiraethLook.Load keeps the local lights when the bridge's look comes
    // without them (it cleared them, and the shader had none until the next frame), PushLights; BridgeRunner.Shot culls to the picture
    'In the Unity version the pools of light round flames, braziers and lamps no longer go out: the Rose House’s flame, its fires and its cistern lost them in many frames, and lamps blinked off for a frame now and then while the hour moved.',
    // the deadly pits' dark in the Unity build (issue #264 after #312): engine/unity/port-format.js 'pitvoid',
    // Shaders/PitVoid.shader (src/pit-void.js's GLSL), BridgeRenderer; tests/engine-unity.test.js
    'In the Unity version the deadly pits fill with the makers’ dark as on the web: the Clock-House’s drops and the Footprint’s pools go deep ink below their lip, with slow pale rings turning at the bottom, so you can tell from the edge that a fall there puts you back.',
    // the futuristic skins in Unity (issue #342): src/temples/skins/skin-shader.js (each skin's pattern declared once,
    // spliced for the web as before, sent as data: engine/ink-spec.js skin, port-format.js skinPattern / skinData, op 21
    // live), scripts/unity-export/skin-hlsl.mjs → Shaders/SkinPatterns.hlsl, Surface.shader HIRAETH_SKIN (one variant);
    // tests/temple-skin-patterns.test.js; docs/systems/temples.md "In Unity"
    'In the Unity version the thirteen futuristic temples wear their skins as on the web: the Rose House’s slate panels with their ember circuits, the Warden’s Well’s rings of slabs and cyan lines, the Belfry’s, the Aerie’s, the Clock-House’s and every other house’s panels, plates, chamfers and glowing lines. They used to come out as plain walls and floors.',
    // the Aerie's futuristic skin (issue #342): src/temples/skins/aerie.js (`skin: aerieSkin` in arzach.js);
    // tests/temple-skins.test.js; docs/systems/temples.md "Futuristic skins"
    'Inside, the Aerie is the makers’ old high technology now, after the drawings picked for it: a round shaft of dark slate in tall slabs, thin pale peach circuits ringing it and climbing between the rings, warm grey floors with peach rings inlaid, a turbine of machined blades in every great vent that spins up when the wind rises, ochre sand on the ledges and balconies with a glowing rim along their edges, discs and hexagons floating high round the shafts, and a row of lit slots along every frieze. The makers’ sign on its walls is the drawings’ long low arch under three small dots. Its rooms, doors and puzzles are where they were; on the Low and handheld settings the slabs are plainer and fewer plates float.',
    // the Hush-House's futuristic skin (issue #342): src/temples/skins/hush-house.js (perdide.js `skin`; the coffer,
    // metal, plates and shutter patterns, the resonators, wedges and plinths, its own light); tests/temple-skins.test.js
    'Inside, the Hush-House is the makers’ sound-damping hall now, after the drawing you picked: walls and vaults of dark indigo slate in deep square coffers with crisp chamfered edges, thin violet circuits glowing in their seams and in the warm grey floor plates, stepped slate wedges under every vault, and long hexagonal crystals hanging in machined collars over the Bog Well’s still black water, two of them lit teal and violet with faint rings round them, the others dark. Its roots are heavy cables, its crystals stand on stepped plinths, and its gates of jaws are slate shutters with a violet seam where they meet, frosting pale blue when you still them. Its rooms, doors and puzzles are where they were; on the Low and handheld settings the walls are plainer.',
    // the jaws as square shutters (issue #342): src/temples/pieces.js Jaw (jawSlabs: the leaves' slabs, their seams, the
    // stiles; the slot floor to lintel), skins/hush-house.js shutters(); tests/temples.test.js ("a shut gate of jaws…")
    'In the Hush-House the gates of jaws (the Snapping Passage’s gate, its two little mouths and the one on the Choir’s balcony) are now square shutters, as in the drawing you picked: two stacks of heavy slabs, each pointed toward the middle, every other one reaching past it so the two sides lock together, a violet light on every point. You bump into them exactly where they are drawn. They snap, still and open as before; without the futuristic look they are the same shutters in the house’s old rose.',
    // the Engine-House's futuristic skin (issue #342): src/temples/skins/engine-house.js (its hooks in buried.js: the
    // embers' material, the warden's colours, skin: engineHouseSkin); docs/systems/temples.md; tests/temple-skins.test.js
    'Inside, the Engine-House is the makers’ old machine hall now: tall navy slate slabs and dark metal, thin amber circuits running up the walls and along the floor plates, pulsing slowly, the walls of its pits glowing amber toward the embers, squares of round lens terminals and tall slabs along the walls, and the makers’ sign drawn as a long flat arch under three small dots. Its rooms, puzzles and the way through are as they were.',
    'The Tooth-Warden wears darker rust-red plates on navy, and the Engine-House’s drop hammers are dark metal.',
    // the Lamp-House's futuristic skin (issue #342): src/temples/skins/lamp-house.js (skin: on perdide2.js's def), after
    // references/temples/future/lamp-house/sheet-1.jpg; tests/temple-skins.test.js
    'Inside, the Lamp-House looks like the makers’ high-tech lamp-house: near-black slate slabs and floor plates inlaid with thin gold lines that glow only near a light (your lantern, a lit pool, a woken lamp), so the floor wakes round you as you walk. Its pools are ringed in bronze over black water, a soft gold shaft rises from each one you light, rows of bronze sockets with dark glass spheres line its walls, and square plates float high overhead, only a faint gold outline until a light falls under them.',
    'The Lampless is a machine now: a great moth of thin white plates edged in bronze, the makers’ sign on each wing in a round lens.',
    // the Casting-House's futuristic skin (issue #342): src/temples/skins/casting-house.js (`skin: castingHouseSkin` in
    // moonfoundry.js); tests/temple-skins.test.js; docs/systems/temples.md "Futuristic skins: the Casting-House"
    'Inside, the Casting-House is the founders’ old high technology now, after the drawings picked for it: tall round halls of dark iron-brown slate in big slabs, thin ivory circuits running round the foot of every wall and climbing it in steps to small lens lights, warm brown floors with ivory rings inlaid, and the cracked moon hanging in a floating ring of dark metal with nothing holding it. The pilot flames burn inside floating machined rings, every sealed door stands in a heavy frame with a lit line round it and a glowing seam down its middle, the hooded cradles are machined cups of dark metal with the makers’ sign lit over the fire, and through a grating in the Pouring Floor the Last Founder’s furnace glows far below. Its rooms, doors and puzzles are where they were; on the Low and handheld settings the walls are plainer.',
    // the Undertower's futuristic skin (issue #342): src/temples/skins/undertower.js, bazaar.js (skin, rt.skinStands,
    // rt.skinPits, the First Sign's colours); tests/temple-skins.test.js; docs/systems/temples.md "Futuristic skins"
    'Inside, the Undertower looks like the makers’ high technology now: tall panels of dark blue-grey slate with thin coral circuits glowing in the walls and floors, polished brass dishes and horns on brass-collared stands, bronze singing balls and eggs, the cable pits full of bundled cable with coral sparks running through it, and the First Sign a brass mast with its listening dish.',
    // the Clock-House's futuristic skin (issue #342): src/temples/skins/clock-house.js (skin: in garage.js, foremanModel's
    // colours), after references/temples/future/clock-house/sheet-1.jpg; tests/temple-skins.test.js; docs/systems/temples.md
    'Inside, the Clock-House now looks like the makers’ high-tech clock: tall dark slate slabs with brass seams under a warm cream drum, thin teal lines in the floors and walls, lens terminals in sixes round the great rooms, and over the Escapement’s pit and high in the Winding Well a column of sand stopped mid-fall inside tilted brass rings.',
    'The Clockwork Foreman is all brass now, with a pale teal dial, and the Escapement’s riding disc is a brass pendulum disc.',
    // the Mooring-House's futuristic skin (issue #342): src/temples/skins/mooring-house.js (skin: mooringHouseSkin in
    // spacecity.js, whose layout takes the skin's paints, capstan drum and warden colours); tests/temple-skins.test.js
    'Inside, the Mooring-House is the makers’ old high technology now, after the drawings picked for it: round halls of dark slate in tall slabs, floors laid in rings round the great capstan, its drum bare dark metal banded with thin teal circuits, teal ring lights round the walls, dark slots where the slack cables run into the wall, square plates floating high over the halls and the void, and the city’s islands drifting in the stars outside, their cables slack toward the house. The rooms, the puzzles and the fight are as they were.',
    'The Anchor-Warden is ochre brass and dark iron now, its eye teal.',
    // the loading pen on the Deck (issue #52): src/warm-shaders.js oneAtATime (ANGLE over OpenGL: one program at a time),
    // main.js, title-world.js; tests/warm-shaders.test.js; docs/systems/performance.md "The loading pen on the Deck"
    'On the Steam Deck the loading screen’s pen keeps turning while the inks are mixed: it no longer stops for a quarter to a whole second partway through a load, and worlds load a few seconds sooner on average.',
    // the engines' ways through (issue #264, the Deck switch's first item): engine/game.js walks level.portals as main.js
    // (src/passage.js Passage, carryAcross; src/thresholds.js), the paper as the screen's 'passage' (BridgeHud.cs DrawPassage);
    // tests/engine-bridge.test.js ("the engines' ways through"); docs/systems/engine-bridge.md "Doors, caves and hatches"
    'In the Unity preview you can now go through doors as in the game: a temple’s door, a house’s doorway, a cave mouth or a hatch takes you inside, its light flaring and the sheet of paper sweeping across, and the way you came in takes you back out.',
    // the bridge's conversation portrait on a camera of its own (BridgeRunner.PortraitCamera): drawing the main camera a
    // second time into its texture left every later frame black and the chip blank (issue #264, #197)
    'In the Unity preview, talking to someone no longer turns the world black: you see the conversation as in the game, the people gesturing as they speak, and their portrait in the panel’s circle.',
    // the ship rooms' panel and brushed metal folded into the lockers' painted metal (src/ship/model.js ROOM_LIGHTS_FOLDED,
    // issue #364): two shader programs fewer in every world; ?roomlights=full for the look before
    { text: 'Worlds load a little quicker on handhelds: inside the ship, the tool boards and the engine-room hatch are now plain painted metal, which saves a moment on every load.',
      see: 'On the Retroid, each world loads about 0.2 s sooner. Aboard, the tool boards no longer have panel lines and the hatch no longer has brushed streaks.' },
    // the recorded music in Unity (issue #264, the Unity-default plan's D15): engine/webaudio.js NativeAudioBuffer and
    // nativeText, engine/unity/music.js, BridgeMusic.cs, src/theme-levels.js (scripts/theme-levels.mjs), the title's sound
    // in engine/unity/game.js, Music plays in engine/menus.js; tests/engine-music.test.js; docs/systems/engine-bridge.md
    'The Unity versions (the Xbox and Retroid previews, and the Steam Deck’s next) now play the recorded music as the web game does: each world’s theme, the title’s music and the recorded cues. They follow your music volume, go quiet under the menus, swell on a bench, and follow Music plays, now in their settings. The Steam Deck carries every theme; the Xbox and the Retroid download the ones they lack once.',
    // the engines' distant detail after the first frame (issue #16): engine/game.js DeferredWork as main.js has it (the
    // City-Shaft's trees-in-houses check, src/levels/incal.js initSteps); -js-off defer for the old load; tests/unity-xbox.test.js;
    // docs/systems/performance.md "The Xbox's load, round two"
    { text: 'In the Unity versions the City-Shaft opens about 6 seconds sooner on the Xbox: the check for trees grown into houses far from you now finishes after you arrive, as in the web game, and only what you can see is checked first.',
      numbers: [{ title: 'City-Shaft, launch to the first frame of the world', unit: 's', better: 'lower', device: 'Xbox Series X, Unity build 1.78.2399, the same script with and without (-js-off defer)',
        rows: [{ where: 'first launch (caches cleared)', before: 44.6, after: 38.8 }, { where: 'launched again', before: 44.4, after: 38.2 },
          { where: 'the collision step of the load', before: 7.6, after: 1.0 }],
        source: 'docs/systems/performance.md, "The Xbox\'s load, round two"' }] },
    'On the galactic map the makers’ mark beside each world, in the side panel and in the legend, now draws as the mark; it showed as an empty key-cap box.',
  ] },
  { v: '1.77', date: '2026-10-14', items: [
    // the Rose House as shrines (issue #336): src/temples/desert.js (ROOMS, DOOR, LOGIC.rooms kinds, the layout), the rules in
    // docs/design/temple-redesign.md, scripts/temple-design/rules.mjs + record.mjs; tests/temple-rules.test.js, tests/temples.test.js
    'The Rose House is rebuilt like a shrine: every hall is far bigger and taller (36 m across under 18 to 24 m of stone), its doors are twice the size, and each puzzle stands in the middle of its own room instead of along a wall or through a doorway. The Hall of the Flame’s ball rolls down the middle of the hall; the Hall of Fires’ ball, its fire, its thorns and its bowl are all in that hall; the Givers’ guard and their watcher have a hall of their own over the bridge; and the eye in the Hall of Channels is high on an obelisk beside the groove.',
    // the machines in their own hall (issue #336): desert.js ARENAS (arM, dm), pieces.js Mark `foes`, src/foes.js placeMachinesIn
    // (a tagged house's machines only in its combat rooms, round the middle); migrate.js desert v4, RELAID; tests/foes.test.js
    'The Rose House’s machines no longer stand by its puzzles: they wait in a hall of their own past the Sword Chamber, the Machines’ Hall, round its middle, and its doors hold behind you until they are broken. If you were inside the old house you start at its last glyph stone, and a fight you had won in the old Sword Chamber counts as won.',
    // the Warden's Well as shrines (issue #336): src/temples/incal.js (ROOMS, FLOORS, CLIMB, LOGIC.rooms kinds, the layout:
    // the vanes on a pillar and posts, the eyes on pillars, the loft's raised walk, the Flue's pier and landing);
    // migrate.js incal v4, runtime.js relaid; foes.js (no machine by a tagged house's untagged stone); tests/temples.test.js
    'The Warden’s Well is rebuilt like a shrine too: its rooms are far bigger and taller (the Climb and the tower’s drum over 34 m across, each floor of the drum 17 m high), its doors twice the size, and every puzzle stands in the middle of its room. The Turning Floors’ vane is on a pillar beside the island, the Vane Room’s on a post in its chasm, the two lidded eyes on pillars beside their great vanes, the loft’s ball on a raised walk, and the Flue’s little vane on a post by its draught, its great key on a pier.',
    'The Warden’s Well’s machines no longer stand by its puzzles: they wait only in the Ash Store, round its middle among four columns. If you were inside the old tower you start at its last glyph stone.',
    // the Aerie as shrines (issue #336): src/temples/arzach.js (DOOR, HALL, WELL, WING, TOP, STACK, LOGIC.rooms kinds, the
    // layout: the Hall of Winds' groove down its middle, the Vent Hall, the Eyrie's ledge out to its middle, the perch's
    // buttress, the Moult's columns); migrate.js arzach v4 (relaid); tests/temples.test.js, ball-room, way-back, aerie-lee
    'The Aerie is rebuilt like a shrine too: the Hall of Winds is 30 m wide and 66 long, its stone rolled up the middle of the floor to a grate, the Wind Well is 36 m across and 50 high, and its doors are twice the size. The gulf vent’s stone has a room of its own past the high balcony, the Vent Hall, in the middle of its floor, and the Eyrie’s stone sits in the middle of the Eyrie on a ledge that reaches out over the gap.',
    'The Aerie’s machines no longer stand by its puzzles: they wait only in the Moult, round its middle among four columns. If you were inside the old house you start at its last glyph stone.',
    // the arena's won line (src/temples/runtime.js updateArenas: the doors let go the moment the last foe fell, before it was won)
    'When you win a temple’s arena, the house says so as its doors sink open: that line never showed.',
    // the Founders' Belfry as shrines (issue #336): src/temples/arzach2.js (ROOMS, DOOR, UP, RING, LOGIC.rooms kinds, the
    // porch and the antechamber rooms of their own, p3 in its ball's room, the layout); tests/temple-rules.test.js REDONE
    'The Founders’ Belfry is rebuilt like a shrine too: its halls are far bigger and taller, its doors twice the size, and every puzzle stands in the middle of its own room. The east store’s ball rolls down the middle of the store; the founders’ bell hangs in the middle of the Stone Stair; the porch’s bell hangs in the middle of a room of its own; and the Hall of Echoes’ ball crosses the chasm to a plate on the far lip of the same hall.',
    // (the machines only in the west store, round its middle: LOGIC.rooms kinds, Mark `foes`; the great key's ledge 16 m over
    // the stair's floor, the founders' bell straight below it: RING.bell, RING.key; migrate.js arzach2 v4, RELAID)
    'The Belfry’s keepers wait only in the west store now, round its middle, the house’s one fight: no machine stands by its puzzles any more. From the great key’s ledge high in the Stone Stair you can now see the founders’ bell right below you. If you were inside the old Belfry, you start at its last glyph stone.',
    // the Builders' Greenhouse as shrines (issue #336): src/temples/edena.js (ROOMS, DOOR, WING, VAULT, LOGIC.rooms kinds, the
    // Bud Passage a room of its own past dS, the eyes on a pillar and posts and the landing's face, the vault's glass out in the
    // room, the layout); tests/temple-rules.test.js REDONE, tests/temples.test.js
    'The Builders’ Greenhouse is rebuilt like a shrine too: its rooms are far bigger and taller (every hall 30 to 36 m across under 18 m of stone and glass, the Glass Stair and the Seed Chamber 34 m round), its doors twice the size, and every puzzle stands in the middle of its room. The Potting Hall’s eye is on a pillar behind the benches, the Cold Frame’s two eyes on posts behind their seed trays, the Glass Stair’s eye on the face of the landing the disc rides past, the Seed Vault’s wall of glass stands out in the room with its two seeds before it, and the Bud Passage is a hall of its own past the Seed Chamber, whose far door opens for the bloom in your hand.',
    // (the machines only in the Shade House, round its middle among four columns: LOGIC.rooms kinds, Mark `foes`; the pots
    // solid as drawn; migrate.js edena v5, runtime.js relaid)
    'The Greenhouse’s keepers wait only in the Shade House now, round its middle among four columns, the house’s one fight: no machine stands by its puzzles any more. If you were inside the old Greenhouse, you start at its last glyph stone.',
    // the Undertower as shrines (issue #336): src/temples/bazaar.js (ROOMS, DOOR, LOCK, LOGIC.rooms kinds, the Listening
    // Passage a room of its own behind dL, ballT in the Tuning Room, the dishes on stands, e2 on a pier, SignFoot, the layout);
    // tests/temple-rules.test.js REDONE, tests/temples.test.js
    'The Undertower is rebuilt like a shrine too: its halls are far bigger and taller (30 to 36 m across under 18 m of stone or more, the Cable Well 34 m across), its doors twice the size, and every puzzle stands in the middle of its own room. The dishes stand on stone stands in the floor instead of hanging on the walls; the Tuning Room’s ball rolls down the middle of the room instead of in from the well; the Listening Passage is a hall of its own past the Shell Chamber, whose north door sinks once you hold the shell; and the far door’s horn and dish in the Gallery of Voices sit high on a pillar in the middle of the far landing.',
    // (the machines only in the Cable Store, round its middle: LOGIC.rooms kinds, Mark `foes`; migrate.js bazaar v5, relaid)
    'The Undertower’s keepers wait only in the Cable Store now, at the end of a long cable tunnel under the Choir, round the middle of the store among two columns: no machine stands by its puzzles any more. If you were inside the old Undertower, you start at its last glyph stone.',
    // the Mooring-House as shrines (issue #336): src/temples/spacecity.js (WING, LOFT, DRIFT, BALANCE, STORE, PERCH, CLEAT, DOOR,
    // LOGIC.rooms kinds, the layout: the Lamp Shaft's pier, the loft's hung ring, the balcony's cable-rail off its lip, the cleat's
    // mast, the Gallery's davit); migrate.js spacecity v3, runtime.js relaid; tests/temples.test.js, temple-rules REDONE
    'The Mooring-House is rebuilt like a shrine too: its halls are far bigger and taller (the Capstan Hall 36 m across under 28 m of stone, the Winch Room, the Lamp Shaft and the Cord Loft 34 m), its doors twice the size, and every puzzle stands in the middle of its room. The counterweight rolls down the middle of the Winch Room; the lamp-eye sits on top of a pier beside the void’s breath; the ring that opens the Drift hangs over the Cord Loft’s floor; the Gallery’s ring hangs from a davit over the landing; the balcony’s ball sits out on a cable-rail off its lip over the Capstan Hall; and the moorers’ weight waits on a mast in the hall.',
    'The Mooring-House’s keepers wait only in the Rope Store, round its middle among the drums of cable: no machine stands by its puzzles any more. The Anchor-Warden and its fight are as they were. If you were inside the old house, you start at its last glyph stone.',
    // the Whale-House as shrines (issue #336): src/temples/underwater.js (DOOR, ROOMS, LOGIC.rooms kinds, the layout: the
    // eyes on pillars, the Pool Room's ball in its own cradle for the east door, the passage horn in the Horn Chamber, the
    // tank's ball and dish in the middle of the floor, the keepers' landing a room with its horn and its dish, the ear on
    // the Listener's column); tests/temple-rules.test.js REDONE, tests/temples.test.js
    'The Whale-House is rebuilt like a shrine too: the Sounding Hall is 48 m wide, its wings and the Horn Store 30 m square, the Horn Chamber 34 m round, the Tank Hall 40 m wide with the glass and the tank down its middle, its doors twice the size, and every puzzle stands in the middle of its room. The west door’s eye is on a pillar in the hall, the Pool Room’s ball rolls into a cradle of its own by the glass and opens the east door, the passage horn stands in the Horn Chamber by its north door, and the ear that opens the Listener’s Door is high on a column of its own before it.',
    // (the machines only in the Horn Store, round its middle among four columns: LOGIC.rooms kinds, Mark `foes`; the landing's
    // eye a horn now (eK needs the horn); the dishes and the horns on the floor solid; migrate.js underwater v3, relaid)
    'The Whale-House’s keepers wait only in the Horn Store now, round its middle among four columns, the house’s one fight: no machine stands by its puzzles any more. The keepers’ door opens to the whale-horn from the landing behind it. If you were inside the old house, you start at its last glyph stone.',
    // the Casting-House as shrines (issue #336): src/temples/moonfoundry.js (DOOR, UP, the rooms' constants, LOGIC.rooms
    // kinds, the layout: m1 in the Mould Room, its eye on a post, the dais; the Pincer Passage folded into the Tong Chamber;
    // mH on the furnace's near lip; the Weighing Hall's pier and the eye's post); migrate.js moonfoundry v3 (relaid);
    // tests/temples.test.js, temple-rules REDONE, zfight
    'The Casting-House is rebuilt like a shrine too: its rooms are far bigger and taller (the Pouring Floor and the Tong Chamber over 34 m round, the furnace 46 m wide, every hall 18 m high or more), its doors twice the size, and every puzzle stands in the middle of its own room. The stone moon for the great mould now lies in the Mould Room and rolls across it instead of in through its doorway, the seam-eye on a post beside the mould, the hoist’s pan on a dais in the middle; the furnace’s hot moon has its whole rail on the near lip; the Weighing Hall’s pan sits at the end of a pier out over the hall, its eye on a post.',
    // (the machines only in the Sand Room, round its middle among the bins: LOGIC.rooms kinds, Mark `foes`; the door into the
    // furnace held by a cradle out on the Tong Chamber's floor; migrate.js moonfoundry v3, runtime.js relaid)
    'The Casting-House’s keepers wait only in the Sand Room now, round its middle among the sand bins, the house’s one fight: no machine stands by its puzzles any more. The Pincer Passage is gone: the door into the furnace is held by an iron moon’s cradle out on the Tong Chamber’s floor. If you were inside the old house you start at its last glyph stone.',
    // the Lamp-House as shrines (issue #336): src/temples/perdide2.js (ROOMS, DOOR, KENNEL, WICK, ROOT_WAY, LOGIC.rooms kinds,
    // the Lantern Chamber 34 m round with l0 and l1 on posts, orb5 and s5 in the Root Stair, the wick-house, the layout); tests/temple-rules.test.js
    // REDONE, tests/temples.test.js
    'The Lamp-House is rebuilt like a shrine too: its rooms are far bigger and taller (every hall 30 to 37 m across under 17 m of stone or more, the Lantern Chamber 34 m round), its doors twice the size, and every puzzle stands in the middle of its room. The third dark pool sits far back on a loft of roots out in the Hall of Dark Pools; the glowing orb and its small pool wait on the Root Stair’s own floor instead of rolling in through the doorway; the Lantern Chamber’s two lamps stand on posts beside the chest; the Dark Gallery’s hidden eye is up on a post over the near floor and the far door’s niche stands out on the far floor; and the Wick Room’s two niches and its great key are in a little house of stone in the middle of the room.',
    // (the machines only in the Kennel, round its middle among four columns: LOGIC.rooms kinds, Mark `foes`; migrate.js
    // perdide2 v4, runtime.js relaid)
    'The Lamp-House’s keepers wait only in the Kennel now, round its middle among four columns, the house’s one fight: no machine stands by its puzzles any more. If you were inside the old Lamp-House, you start at its last glyph stone.',
    // the Clock-House as shrines (issue #336): src/temples/garage.js (UP, DOOR, ESC, DIAL, LANDING, WELL, WING, MAINSPRING,
    // COIL, WIND, GALLERY, LOGIC.rooms kinds, the Winding Passage a room of its own behind dP, ball1's socket on the landing,
    // the dial's tower, the Clockmaker's clock, the steles, the hung clock); tests/temple-rules.test.js REDONE, tests/temples.test.js
    'The Clock-House is rebuilt like a shrine too: its halls are far bigger and taller (the Escapement and its landing 32 m wide under 22 m of stone, the Winding Well 36 m across, every other hall 30 m or more), its doors twice the size, and every puzzle stands in the middle of its room. The escapement’s dial and its three eyes stand on a tower in the pit beside the disc; the Clockmaker’s clock is a tall case out on the landing; the counterweight rolls up the landing to its socket there instead of through the well’s doorway; the hour track runs down the middle of the Striking Room, its eye on an obelisk; the mainspring and the Winding Passage’s six eyes each stand on a stele in the middle of their rooms; and the gallery’s great clock hangs over the far end of the bridge. The Winding Passage is a room of its own now, past a door in the Coil Chamber that opens for the quick coil.',
    // (the machines only in the Pendulum Hall, round its middle among four columns: LOGIC.rooms kinds, Mark `foes`; migrate.js
    // garage v3, runtime.js relaid)
    'The Clock-House’s keepers wait only in the Pendulum Hall, round its middle among four columns: no machine stands by its puzzles any more. The Clockwork Foreman and its fight are as they were. If you were inside the old house, you start at its last glyph stone.',
    // the Engine-House as shrines (issue #336): src/temples/buried.js (DOOR, PH, CRANK, CHAMBER, PASSAGE, FURNACE, HALL, WING,
    // LOGIC.rooms kinds, the Crank Passage a room of its own `crank`, ballJ in the Crank Hall behind its crank's casing, the
    // valve's eye on a post, the chamber's eyes on posts, the governor's pieces round its floor); tests/temples.test.js,
    // temple-rules REDONE
    'The Engine-House is rebuilt like a shrine too: its halls are far bigger and taller (the Piston Hall and the Crank Hall 32 by 36 m, the Fourth Chamber 34 m across, the furnace 34 by 58, every room 18 m high or more), its doors twice the size, and every puzzle stands in the middle of its own room. The valve’s eye sits on a post by the way in; the ball that stops the hammer now waits on the Crank Hall’s own landing, its crank hidden in an iron casing; the chamber’s four eyes stand on posts round the chest; the Crank Passage is a room of its own behind a third shutter, its pistons across the middle; the Governor Room’s anvil, ball and pistons stand in the middle of its floor.',
    // (the machines only in the Boiler Room, round its middle among four boilers: LOGIC.rooms kinds, Mark `foes`; migrate.js
    // buried v3, runtime.js relaid)
    'The Engine-House’s keepers wait only in the Boiler Room now, round its middle among four cold boilers, the house’s one fight: no machine stands by its puzzles any more. The Tooth-Warden and its fight are as they were. If you were inside the old house, you start at its last glyph stone.',
    // the Footprint as shrines (issue #336): src/temples/spheres.js (DOOR, ROOMS, LOGIC.rooms kinds, the layout: the prints
    // beside the groove, the stilling stone on a deeper ledge, the mural on a stele, the far landing's eye on a pillar out
    // of the chasm, the Keepers' Gallery a hall, the gallery's eye on a post); tests/temple-rules.test.js REDONE,
    // tests/temples.test.js
    'The Footprint is rebuilt like a shrine too: the Hall of Spheres, the Still Pool and the Hall of the Unseen are 32 m wide, the Lens Chamber 34 m round, every ceiling 18 m high and every door twice the size, and every puzzle stands in the middle of its room. The prints to stand on lie in a row beside the sphere’s groove, the stilling stone sits at the edge of a deeper ledge, the walker’s print shows on a stele beside the chest, and the eye that opens the far door stands on a pillar rising out of the chasm, facing the far landing.',
    // (the machines only in the Lodge, round its middle among four columns: LOGIC.rooms kinds, Mark `foes`; the Keepers'
    // Gallery a hall 30 by 66 m; migrate.js spheres v3, relaid)
    'The Footprint’s keepers wait only in the Keepers’ Lodge now, round its middle among four columns, the house’s one fight: no machine stands by its puzzles any more. The Keepers’ Gallery is a long hall instead of a narrow passage, its hidden eye on a post before the door back to the Lens Chamber. If you were inside the old house, you start at its last glyph stone.',
    // the Hush-House as shrines (issue #336): src/temples/perdide.js (UP, DOOR, ROOMS, LEDGE, WALK, BALCONY, SHRINE, KEEPER,
    // LOGIC.rooms kinds, the side mouths in shrines, dJ a bridge, the layout); tests/temple-rules.test.js REDONE,
    // tests/temples.test.js
    'The Hush-House is rebuilt like a shrine too, the last of the makers’ houses: its rooms are far bigger and taller (every hall 30 to 36 m across under 18 m of stone or more, the Bog Well 36 m round), its doors twice the size, and every puzzle stands in the middle of its room. The door’s crystal stands out on the Threshold’s floor; the Snapping Passage’s two little mouths sit in two shrines of stone either side of the way to the gate, instead of in its walls; the Choir’s balcony runs down its west side now, the ball’s groove down its middle, and you reach it from a ledge by the Bog Well and a walk outside the Choir’s wall.',
    // (the machines only in the Nursery, round its middle among the seed-beds: LOGIC.rooms kinds, Mark `foes`; migrate.js
    // perdide v3, runtime.js relaid)
    'The Hush-House’s keepers wait only in the Nursery now, round its middle among the old seed-beds, the house’s one fight: no machine stands by its puzzles any more. If you were inside the old Hush-House, you start at its last glyph stone.',
    // (issue #336 follow-up: src/temples/desert.js FIRES.x 5 -> 0, the groove, fire, thorns, ball and bowl moved with it)
    'In the Rose House’s Hall of Fires, the tar ball’s groove, its fire, its thorns and the hooded bowl now run down the middle of the hall instead of along its east side.',
    // the Warden's Well's futuristic skin (issue #342): src/temples/skins/wardens-well.js (the slate, metal and plate
    // patterns, their glow, the lens terminals, turning vanes, irises), incal.js `skin` and its paints; tests/temple-skins.test.js;
    // second pass closer to the sheets: 4.8 m courses of 6.4 m panels, lavender floors, WELL.emit, NICHE alcoves, VANE wedges
    'Inside, the Warden’s Well is a shaft of the makers’ old high technology now, after the drawings picked for it: tall curved courses of big smooth slate panels with few joints, thin cyan circuits climbing them and glowing ring bands, cream courses, machined metal doors and climbing face with lit seams, lavender-grey floors with cyan inlays, lens terminals glowing in recessed alcoves, tiers of great wedge-shaped vanes turning slowly on their axles out of the tall drums’ walls, and an iris of metal blades round the light at the top of each round room. Its slit windows and lights glow crisp, without soft blobs round them. Its rooms, doors and puzzles are where they were; on the Low and handheld settings the slabs are plainer and fewer vanes stand still.',
    // the Rose House's futuristic skin (issue #342): src/temples/skins/rose-house.js (desert.js `skin`), the author's picks
    // references/temples/future/rose-house; tests/temple-skins.test.js; docs/systems/temples.md "Futuristic skins: the Rose House"
    'The Rose House looks like the Givers’ high technology now, after the drawings you picked: its halls are built of great slabs of warm violet-grey slate with chamfered edges and rose sand in their joints, on warm sandstone floor plates, and thin ember circuits run in long right-angled lines up the walls and across the floor, most of them lit, ending in small glowing nodes. Daylight falls through slots along the edges of the great halls’ ceilings. Slate obelisks stand in the corners of the great halls, thin plates float under the ceilings, a thin ring with a glowing inner edge floats over each of the Givers’ flames, and a spout slab with their sign hangs over the dry cistern, its basin in stepped rings. Its braziers are slate obelisks whose circuits light up with the fire, and the Givers’ sign along the friezes is drawn large and lit, a long low arch under three small dots.',
    // the Whale-House's futuristic skin (issue #342): src/temples/skins/whale-house.js, underwater.js (skin, its materials);
    // tests/temple-skins.test.js; its own light inside (rt.skin.light, temples/index.js), the dishes' and ears' brass, the
    // windows' mullions and the sea's two far planes (whale-house.js greatWindow, seaMaterial)
    'Inside, the Whale-House looks like the makers’ high-tech sounding-house now: halls of tall green slate slabs with chamfered edges in a cool, clear light, thin aquamarine circuits glowing in the walls and floor plates, rows of big polished brass horn terminals with bright lips and dark mouths under a shelf of brass dishes, the house’s listening dishes and ears in brass too, and great windows of a few heavy dark mullions onto a deep blue sea, light falling through it, the Listener on the sea floor and a whale passing far out that slide behind the glass as you walk. Its rooms, doors and puzzles are as they were.',
    // the Founders' Belfry's futuristic skin (issue #342): src/temples/skins/founders-belfry.js (its surfaces spliced into the
    // surface shader, the note from uSkBell, the ring bells, the lens terminals), arzach2.js hang; tests/temple-skins.test.js
    'Inside, the Founders’ Belfry is an ancient machine now, as the makers built it: tall dark slate slabs edged in bronze, lit slots at their feet, a cobalt circuit glowing round every room, slate floors ringed in bronze and cobalt light, the chest on a lit hexagonal pedestal, and its doors two heavy slate slabs with a line of light between them.',
    'The Belfry’s bells are no longer cups: each is four heavy bronze rings floating apart round a dark core, a thin cobalt line round every ring and the makers’ sign on the lowest. While one rings, or your whistle sounds, faint rings of light hang round it and spread from it across the floor and the walls.',
    // the lock-on's steps in place (issue #360): src/motion-match.js loopInPlace (the strafes' and the walk back's travel out
    // of the pelvis, the loops closed); tests/strafe.test.js; docs/systems/animation.md "Locked on: the steps in place"
    { text: 'Locked on, stepping left and right (round the Mother Snapper, or any foe) is smooth now: the traveller’s body no longer slides a metre off him and snaps back three times a second, and his feet no longer jolt each time a step starts over.',
      numbers: [{ title: 'Locked on, strafing left and right at full stick (3.8 m/s), frame by frame', unit: 'cm', better: 'lower', device: 'the Mother’s Hall, muted headless Chrome, Medium, 60 frames a second, 19 s', rows: [
        { where: 'the hips’ jump off their path in a frame', before: 130, after: 3.7 },
        { where: 'the worst joint off its path in a frame', before: 66, after: 10 },
        { where: 'the hips moving against the body in a frame (Node, tests/strafe.test.js)', before: 121.6, after: 4.5 },
      ], source: 'a frame-by-frame recording of the traveller, his animation, the camera and the lock, on this branch and on the tree before it (46a9c59d), 15 October' }],
      see: 'In the Hush-House, lock on to the Mother Snapper and hold the stick left, then right: the traveller sidesteps round her without lurching back and forth, and the camera stays steady.' },
    // every guardian's fight can be won from anywhere in its hall (issue #361): src/temples/boss.js begin (a rooted one keeps
    // the asked move), sweepOf (a body blow over its part's sweep), garage.js the hammer's reach; tests/guardian-completable.test.js
    { text: 'The Mother Snapper’s fight can always be finished: in her second phase she no longer just throws seeds at you when you keep your distance, she still rears back to snap at you, so you can push her head and still her open mouth. Every guardian was played through from close by, from the middle of its hall and from its far side, at 60 and at 30 frames a second.',
      see: 'In the Hush-House, calm the Mother Snapper through her first phase, then stand back by the hall’s wall: she still rears up to snap at you every few moves (“She rears back to snap”), and a push into her head as she draws back slams it down, spent.' },
    { text: 'The Foreman’s hammer reaches you when you stand your ground: it comes close enough to land on your raised guard, even with your back to the Clock-House’s wall, and at a handheld’s frame rate it no longer passes through you without touching your guard.',
      see: 'In the Clock-House, in the Foreman’s second phase, hold your guard toward it with your back to the wall: the hammer rings off your guard and its face swings open.' },
    // the Sunken Hall played more like Diablo IV (issue #365): src/fight-temples/rules.js ISO, SEE (seeHoleCuts), rooms.js
    // (a wall's own materials), session.js (seeThrough, input); materials.js SEE_HOLE; fluid-blade.js ROLL, WIDE_CUT;
    // jump.js ROLL_FLIP; kit/runner.js filterInput; tests/fight-temples.test.js, tests/fight-roll.test.js
    'In the Sunken Hall, a wall or a pillar between you and the camera is no longer cut down to a stump: a hole opens in it round the traveller as you pass behind it and closes again once you are clear, so you always see yourself and the foes round you, and still see where the wall stands.',
    'The Sunken Hall’s camera looks down the way Diablo IV’s does: steeper (57° instead of 52°) and a little further back, so a room and its crowd fit the screen better.',
    'In the Sunken Hall, the jump button (A / ×) and B / ○ make a dodge roll: a quick tumble the way you push the stick, or the way you face, with a moment no blow can touch you. There is no jumping in there any more. Everywhere else, both work as before.',
    'In the Sunken Hall your sword reaches further and wider: a cut takes every foe in a broad arc in front of you, a step further out than before, but never one behind a wall.',
    // the guardian framing locked on (issue #359): src/lock-frame.js (LOCK_FRAME, solveFrame, frameAim, guardianBox),
    // src/player.js CameraRig.fitFrame, LOCK_ROOM.fit; main.js rig.frameWith; scripts/camera-qc/sim-guardians.mjs, the
    // camera QC's snapper-lock; tests/camera-qc-guardians.test.js; docs/systems/movement-and-camera.md
    'Locked on to a guardian, the camera now keeps the whole fight in view: you from head to feet, the guardian and the floor between you. It stands further back and a little higher the bigger the guardian is, turns aside from a wall behind you, and only by a wall does it widen its view a little. With the Mother Snapper you were cut off at the chest and its head was out of the picture.',
    // the locked aim (issue #362): src/lock-aim.js (AIM_NUDGE, AimNudge, lockAimStep), main.js (rig.look while aiming locked,
    // padLook), fluid-tool.js (no snap once nudged), bindings.js LT; tests/lock-aim.test.js
    'Aiming with LT / L2 while locked on now puts your crosshair right on the lock’s centre (a guardian’s weak point), and the right stick shifts the aim a little off it, as in Metroid Prime; let go and it comes back to the centre. Before, the aim drifted onto the target and the stick switched to another target.',
    // the benches (issue #363): src/benches.js, src/benches-data.js (where, which way, each world's kind), main.js;
    // tests/benches.test.js, tests/benches-worlds.test.js, tests/route-worlds.test.js; docs/systems/worlds.md "Benches"
    'Every world now has a bench or two where the view is worth stopping for: Qanat and its tree from the dunes, the sky stones over the sea of cloud, the swamp from the Deep Wood’s high walk, the pyramids under Viridel’s ringed moon, the City-Shaft’s spire from its north rim, the moons hanging in the foundry, the planet over the floating city, and more. Each is made the way its world makes things: a stone slab, a wooden seat with a back, or a machined one on bent metal legs.',
    'Walk up to a bench and press the interact button to sit down: the camera comes round behind you and looks out over the view, the screen clears, and the world’s music swells. Move, jump, press B / ○ or interact again to stand up, and it all comes back.',
    // the traveller's cut while the lens is in him by a uniform in the vertex shader, not a define of his own (issue #364):
    // src/materials.js uCutMe / heroCut; 8-9 surface programs fewer in every world; docs/systems/performance.md "Loads and frames since v1.60"
    'Worlds load about a second sooner on the handheld: your traveller’s clothes, skin and gear now share their shaders with everyone else’s, so every world has 8 or 9 fewer to prepare while it loads.',
  ] },
  { v: '1.76', date: '2026-10-14', items: [
    // the ship twice the size (issue #338): src/ship/hull.js SHIP_SCALE (the design D built 2x, the bow's windshield
    // brought down), interior.js (ROOMS etc. x2, the furniture at its size moved with at/grown, DINING_Z, READING_Z,
    // BENCH_Z, the back room's rug and bookcase, the hold's crates), sites.js (the hull's plan, not a disc: probeSite,
    // fromPlan; the search worlds' sites kept), landing.js planGap, cinematics.js / homecoming.js cockpitZ, flight.js
    // TAKEOFF.hover, underwater.js shipSite, ShipScene.cs (scale, cockpitShift); tests/ship-grown.test.js, room-size, contact-audit
    'Your ship is twice the size, inside and out: every room is twice as wide, long and high, the doorways and the hatch wide, the cockpit’s windshield sweeping down to the dash, while the furniture stays your size, so there is room to walk round everything. The main room gains a table to eat at by the galley, a reading corner with a bookcase and an armchair, and a workbench; the back room a big rug and a tall bookcase; the hold more crates. It lands where it did in every world, but for the Buried City and the Underwater City, where it stands a little aside to fit.',
    // the rooms' light (issue #338): materials.js ROOM_LIGHT (makeMaterial({ room }): a key in the ship's frame in place of
    // the sun, the lamps' cone and pools), interior.js LAMPS / ROOM_KEY / roomLook, model.js; Unity: Surface.shader _Room,
    // WorldLoader.cs, port-format.js, export-world.mjs ship.roomLight; tests/ship-grown.test.js
    'The ship has real light inside now. Before, every room was the same flat shade and its six ceiling lamps simply washed out whatever was near them; now soft light from the windshield gives the walls and furniture a lit side and a shaded side, and twelve warm lamps (pendants over the table, the galley, the bunk and every room, a floor lamp in the reading corner) throw pools of light on the floor beneath them. At night the lamps carry the rooms.',
    'Across all fourteen temples, new silhouettes follow the chosen reference drawings: rose fins in the desert, sweeping wings in Vael, an open bell frame, a lantern above the forest, a glass bud, a great clock, a golden lens and other unmistakable landmarks. The buildings rise much larger above their small doorways, with broader foundations and stairs, clouds around the Belfry, clearer approaches and the same journeys inside.',
    { text: 'The temples now wear finely jointed stone, glazed ceramic and reflective brass and copper: the Rose House is redder, the Engine-House wears rust-red iron, and the Whale-House has a curved, ribbed shell and coral lip. You can see the Greenhouse’s plants through its blue windows, the Clock-House has glass over its dial, and a warm pilot glows in the Lamp-House’s glass chimney before its great beacon is restored.', see: 'Visit the Greenhouse, Lamp-House or Clock-House and look through their glass. The Lamp-House’s pilot lights its saucer; after restoration, its brighter lamp reaches the water and sweeps a beam over the forest. The landmark comparison pictures above show the new surfaces in all fourteen worlds.' },
    { text: 'The Rose House has steps all around its base. The Greenhouse sits fully on its hill, with smaller garden terraces clear of the water stair, and the Hush-House stands on a broader island. The Lamp-House’s stone feet enter the water, large red pipes emerge from the Engine-House, and the Footprint rests on a broad rounded heel and spreading roots.', see: 'Walk around the six houses to see their foundations. The Rose House’s central stair reaches its raised doorway; the Lamp-House’s causeway joins its dry threshold between the submerged feet. The comparison pictures above include these changes.' },
    { text: 'Temples have more room around them: trees, rocks, nearby towers and busy foreground details stand farther back, leaving broad clear approaches. The Rose House’s full stair ring now rises above level sand instead of disappearing into the dune.', see: 'Approach the houses from a distance. The reference comparisons show the quieter surroundings; walk around the Rose House to see its exposed steps on every side.' },
    // rumours (issue #340): src/story/rumours.js (offer, the circle, what is found), rumours-data.js (the lines by world),
    // rumour-places.js (each fragment's place), dialogue.js (listen talk, the keepers' again), world-map.js mapMarks
    // `rumours`, game-menu.js / .css (.gm-area), engine/menus.js, engine/map-marks.js, BridgeMenu.cs; tests/rumours.test.js
    'People who only talk often tell you of something near them you haven’t found: a fragment of the singing light (“there’s a hum inside a ribcage south-west of the pilgrims’ resting stone”), someone with a game, or a place worth the walk, each in their own world’s way of putting it. Your Map then shows a soft circle round where it should be, never right on it, until you find it.',
    // the overshirt's shading in the engines (B3's fit: preservePinNormals, detailCollisions false): engine/cloth.js
    // (packClothDesc's flags and map.pin, clothFrame's pinned normals), BridgeCloth.cs (PinNormal, EaseNormal), tripo-cloth.js
    // offload.init; tests/cloth-offload.test.js; docs/systems/engine-bridge.md
    'In the Unity version the traveller’s overshirt is shaded right over his chest, shoulders and collar: the cloth there had dark and bright patches where its light faced the wrong way, as if the fabric were creased or turned inside out. It now catches the light as on the web.',
    // the traveller's files in the Unity players (unity/Hiraeth/Assets/HiraethJS/Editor/BridgeBuild.cs: characters/traveller-b3
    // copied into StreamingAssets, where v1's were; BridgeRunner.PublicRoots has no repository on a device); tests/unity-xbox.test.js
    'In the Unity version on a handheld or a console, the traveller is the one you play on the web: his body wasn’t packed with the game there, so he came as the old explorer.',
    // the straps swimming: src/fluid-tool.js STRAP_SWIM, strapPath(sx, swim), the straps one mesh of their own (layStraps,
    // FluidTool.updateWorn eases them by player.swim.k); tests/backpack-straps.test.js (crawl 1.8 -> 1.0 cm, breaststroke 1.4 -> 0.7)
    'Swimming, the traveller’s backpack straps no longer vanish into his shoulders as his arm comes over: they draw in toward his neck while he swims, and lie back where they were when he climbs out.',
    // carrying (issue #337): src/carry.js (pick up, put down on a plate's middle, throw, let go), src/player.js (the laden
    // walk, the hop, no sprint, double jump, wings, jets or climbing; the pose: Humanoid.handOff), src/fluid-tool.js and
    // src/gadgets/index.js (nothing else in hand meanwhile), src/gadgets/world.js (the crates carryable); tests/carry.test.js; docs/systems/carry.md
    'You can pick up small things now and carry them in both hands: the crates in the Gadget Yard and the makers’ courts, and the stone weights in the temples. Walk up to one and press X / □ to lift it, X / □ again to put it down in front of you (on a plate if one is near), or RB / R1 to throw it a few metres. Carrying, you walk slower and only hop, and the gun, the blade and your gadgets wait; a climb, the water or a fall makes you let go.',
    // the hook's pull into your hands (issue #337): src/gadgets/hook.js updateDrag, its aim on carryables; tests/gadgets.test.js
    'The grappling hook pulls a crate or a weight straight into your hands now, if it is small enough to carry; a bigger one still lands at your feet.',
    // the Rose House's weight (issue #337): src/temples/desert.js PIER, wP, dc no longer latched; pieces.js Weight; logic.js
    // weight; migrate.js desert v3; tests/temples.test.js, tests/temple-playthrough.test.js
    'In the Rose House the plate on the Dry Channel’s pier holds the door at the top of the gallery open only while something weighs it down: stand on it and the door opens, step off and it shuts again. The pier is longer now, and the Givers’ stone weight lies at its other end: carry it onto the plate and the door stays open.',
    // the Mooring-House's caged coffer (issue #337): src/temples/spacecity.js CLEAT, wC, pC, cC; pieces.js Coffer cage; tests/carry.test.js
    'In the Mooring-House a caged coffer waits on the Capstan Hall’s east side, a plate in front of it. The moorers’ weight sits on a cleat high on the wall where no jump reaches: pull it down into your hands with the grappling hook, set it on the plate, and the cage sinks.',
    // multi-box walls (issue #358): src/temples/kit.js both() takes an array; perdide.js, perdide2.js, spacecity.js;
    // tests/temple-kit-both.test.js
    'Some temple walls that were half missing are whole now: the Hush-House’s side mouths have their side walls and lintels, the Lamp-House’s lamp niches and the great key’s alcove their sides and roofs, and you can no longer walk through a niche wall you can see. The drums in the Mooring-House’s Rope Store stand on both their irons.',
    // helping a guardian instead of fighting it (issue #339, prototypes): src/guardian-help/ (elder.js, keeper.js,
    // index.js attachHelp, pose.js, hud.js, seed.js), fluid-kit.js MODES.cannon (lent), fluid-tool.js pourStream /
    // streamCatch / lent, world-picker.js Prototypes, boot.js + main.js ?guardianHelp; tests/guardian-help.test.js;
    // docs/design/helper-guardians.md, docs/systems/foes.md "Helping instead of fighting"
    'Two guardian encounters to try where you help instead of fight, in the Debug menu under Prototypes: fly beside the Elder round the Aerie’s roost, riding her wake and catching the stone feathers she sheds before they shatter on the floor; or take a water cannon into the Rose House’s dry cistern and fill its jars, the wheel’s trough and the Givers’ great tank, while the Keeper drinks, lifts the tank’s lid for you, and the water and the light come back. They play in a sandbox and change nothing in your game: the fights are as they were.',
    // the fight temples (issue #341): src/fight-temples/ (rules.js, rooms.js, session.js, desert.js), src/minigames/fight-desert.js,
    // kit/marker.js (a game's own doorway), kit/runner.js (ctx.drop), story/hosts-data.js (Wafa); tests/fight-temples.test.js;
    // docs/design/fight-temples.md, docs/systems/minigames.md
    'A fight temple in the desert, the Sunken Hall: ask Wafa by its doorway west of the pilgrims’ camps. It plays like a Diablo, seen from high above: four rooms of ink blots, skitters, worms and herons that each fall in a cut or two, wave after wave, hearts and chimes spilling as they go, and a lamp tripod in the last wave. The stick walks you up and across the screen, the right stick or the mouse aims, and your cuts and shots take the foe that way; a wall in your way drops to a stub.',
    // the kit's colours (issue #341): src/kit-colours.js, main.js (applyKitColours, onColour), game-menu.js / -data.js / .css
    // (the Colours strip); tests/fight-temples.test.js
    'Clear the Sunken Hall to win its Ember colours: copper and rust for your backpack, ember water for your sword and shield. Choose each piece’s colour in Items, on the new Colours strip over your gear.',
  ] },
  { v: '1.75', date: '2026-10-14', items: [
    // the Unity title and settings (issue #346): engine/menus.js (titleView's shot and layout, SETTINGS_ROWS, the save's
    // line), scripts/engine-bundle.mjs unityTitle, BridgeMenu.cs (DrawTitle, TitleEntry), BridgeHud.cs (access: the text
    // size, the plain background, the readout), BridgeHost.Rumble; tests/engine-menus.test.js; docs/systems/engine-bridge.md
    { text: 'The Unity version opens on the web game’s title now: one of its painted worlds behind the lettered HIRAETH, the entries small at the bottom left. Its settings gain Text size, the plain speech background, Show FPS, Reduce motion, Camera shake and controller rumble, and the Start menu names your save and the time played under its heading.',
      see: 'Start the Unity build: a painted world (a different one each time) with the cream-and-red HIRAETH across the top. In Settings, set Text size to Larger and talk to someone: the conversation’s words grow; turn on the plain background and the panel goes white with black words.' },
    // the Unity Map (issue #343): engine/raster.js (offscreen, putImageData, drawImage: drawTerrain's smooth ground),
    // engine/game.js mapSource (the shape, the quests, the sharper part), engine/menus.js (MapView: the cursor, the zoom),
    // engine/map-marks.js, BridgeMenu.cs DrawMap; tests/engine-menus.test.js, tests/engine-raster.test.js; docs/systems/engine-bridge.md
    { text: 'The Map in the Unity version is the web game’s: it fills the page, its ground drawn smooth with every mesa’s and building’s inked edge (no more blocky squares), the web’s marks for you, the ship, temples, people and quests, a north arrow and the scale; the list beside it is gone for a cursor you move with the left stick, zooming with the triggers or A, with the name of whatever it rests on beside it.',
      see: 'In the Unity build press View, then RB to the Map: move the ring with the left stick onto the ship and its name shows beside it; hold RT to zoom in, and after a moment the close view sharpens. B goes back to the whole map, then out.' },
    // take-off and landing (issue #354): src/ship/flight.js, cinematics.js TakeoffDirector / ArrivalDirector, arrival-view.js
    // wideBack; Unity: export-world.mjs ship.flight, ShipTravel.cs; tests/cutscenes.test.js, tests/arrival-view.test.js
    'Your ship takes off like a lander now: it rises straight up on its jets in a cloud of dust, hangs there a moment, then tips forward and roars away. Landing is the reverse: it flies in nose first, slows to a hover over its spot and comes straight down onto its feet. The same in the Unity version.',
    // the pirates' one reticle (issue #357): src/minigames/pirates.js drawHud, RETICLE; tests/pirates.test.js; docs/systems/minigames.md
    'In the chime pirates you aim with one reticle now, a ring round a dot where your shots will go: it tightens and turns coral when the aim assist has a pirate, sliding onto it, and the charge fills a gold ring round it. The second, distant mark is gone, and a missile’s target has a small teal pip over it instead of a big diamond round it.',
    // the Elder's moves and states (issue #237): src/characters/elder-v3-creature.js ELDER_POSE (each move's own wind-up
    // and blow, MOVE_POSE for the links), restPose (sleep, wake, weary, open, resolved), BREATH, RUFFLE, the stamp's lifted
    // foot (STAMP_FOOT), ELDER_NOD; tests/elder-cycles.test.js; docs/systems/characters.md "The Elder, accepted"
    'The Elder in the Aerie moves like a great bird now: her peck stretches her neck out and stabs down at you (it curled her head under her breast, the beak pointing back between her feet), her stamp lifts one foot high and brings it down (she leapt off the floor with both), the gale and the feather volley have wind-ups of their own (both were the buffet’s), she wakes with a stretch of both wings, and between blows she breathes, ruffles her feathers and looks about.',
    // her motion without jolts (issue #237): springs and a crossfade on her pose (ELDER_SPRING, ELDER_FADE), the kit's
    // generic strike and tell rig off for her (tellWeight 0), her take-off and landing eased (boss.js place, model.rises),
    // her turns gathered (turnTo, turnAccel, turnRate 3), the thighs framed on their bend plane (no half-turn flip), the
    // rump, throat and wing weights (elder-v3-fit.js elderWeights, ELDER_FOLD); scripts/tripo/elder-cycles.mjs
    'The Elder no longer jerks: her whole body jumped at the start of every blow, she shot 3.5 m into the air in a single frame when she took off (and dropped back the same way), spun round to face you in an instant, and a leg flipped round when she sank down worn out. Her throat, rump and shoulders no longer stretch out of shape as she bends.',
    // her colour map (issue #237): scripts/tripo/elder-delight.mjs in scripts/tripo/rig-elder-v3.mjs; her levels of
    // detail (ELDER_LOD, src/skinned-lod.js min/max); scripts/bench/elder.mjs; docs/systems/performance.md "The Elder's cost"
    'The Elder’s feathers lost the grey shadows painted into them, so the game’s own light and ink shade her; and far off she is drawn with simpler copies of herself, from two thirds of her triangles down to a seventh, and sooner on handhelds.',
    // capes on a few (issue #347): src/costumes.js caped / CAPE_ODDS / T.capeOdds / T.plain, crowd.js worldPieces, the story's
    // cape: 0, the coats (fellow-data, shop-data, scientist-data), glass-dunes-frozen.js; scripts/cape-census.mjs, tests/cape-share.test.js
    'Far fewer people wear capes: about one in fifteen now, where it was four in five. The elders and those who walk with a staff (pilgrims, monks, Vael’s silent riders) keep theirs; everyone else wears a tunic with trousers, a skirt or a robe, a scarf or a neckerchief where the mantle was, and in the working towns now and then an apron. The capes the character sheets draw stay (Bako, Sefa, Nour, the Speaker, Ama, Hessa, Oïa, Saba, Nettle), and Haddu, Tansy and Anselm Thrum wear open coats instead.',
    // the marker reached moves on (issue #349): src/story/arzach2.js (arzach2.gate.reached, GATE_REACH, the scout's ping),
    // src/story/edena.js (the crown reached), the steps' words (arzach-data.js window, perdide-data.js cave, perdide2-data.js
    // answer); tests/marker-walk.test.js (.claude/skills/quest-qc/marker-walk.mjs), check.mjs --walk; docs/systems/story.md
    { text: 'In Vael, reaching the riders’ gate on the way to Sister Aube counts now: the drone flies on to her smoke over the cloud, and the marker stays on her when you walk away, instead of sending you back to the gate. In Viridel, reaching the tallest tree’s crown is the climb done, note read or not, and a few steps now say what to do when you get there: take the rider’s flute from the tower’s window, hold up the splinter in the crystal cave, look inside what answered across Lorn’s water.',
      see: 'On Vael, once the bird has answered, walk to the riders’ gate at the plain’s edge: the drone comes out and points south to Sister Aube’s smoke. Walk back toward the tower and press Q: it still finds Sister Aube, not the gate.' },
    // the way through a door stays in its room (issue #351): src/scout.js viaPortal (spaces: src/interiors.js portalPair
    // toSpace/fromSpace, a temple's door and ways out); tests/interiors.test.js; docs/systems/story.md
    { text: 'The marker and the drone no longer send you through a shop door for nothing: on Vael and in Lorn the way to Sister Aube, the bird, the cairn’s stones and the lamp-keeper went in at one shop’s door and out of another’s, a field away, as if the two shops were joined. They point straight at where you are going now.',
      see: 'On Vael, once the bird has answered, stand at the riders’ gate and press Q: the drone points south over the cloud to Sister Aube, not “Through the shop door” back by the landing.' },
    // the ship's prompts by their objects (issue #350): src/ship/ship.js promptTag, src/story/index.js extraPrompt, main.js and
    // engine/game.js (the cue no longer says them; the prologue's walk too; the observatory's lens); tests/ship.test.js,
    // tests/engine-ship.test.js; docs/systems/ui.md
    { text: 'Aboard your ship, the button prompts float beside what they are for, like the one to talk to someone: by the voicemail button on the console, over the holo table, in the hatch, instead of at the top of the screen.',
      see: 'Go aboard and walk up to the console: “E voicemail” hangs beside the machine. Step over to the holo table and the hatch: their prompts float there too.' },
    // E to Anselm aboard (issue #352): src/ship/ship.js input, hasUse (the ship's E only by the console, the table, the hatch;
    // the engines share it); tests/ship.test.js; docs/systems/fragments.md
    { text: 'Talking to Anselm in your ship’s hold now works: the button opened nothing there, as the ship kept every press aboard for itself. Now it opens his talk and his upgrades.',
      see: 'Once you have met Anselm, go aboard and walk aft to the hold: press X / □ (E) beside him and he tells you his count, then “Show me what you have” opens his shop.' },
    // no way round a shut door (issue #356): src/temples/perdide.js LEDGE (the cloister), pieces.js Door `frame` (edena.js dB,
    // spacecity.js d6 d7 and WINDOW_BARS, moonfoundry.js dA, the guardians' exits d5); tests/door-bypass.test.js; docs/systems/temples.md
    'A locked door in a temple can no longer be got round. In the Hush-House the ledge round the Bog Well past its keyhole door is a cloister now, walled on the water’s side and roofed, so neither the double jump over the door nor a jump from the top of the root-wall round its post takes you past it. In the Builders’ Greenhouse you could walk round the great lock beside it, and in the Mooring-House jump through beside the Capstan Floor’s door: their doorways are framed in stone to the door’s edges now, as are the doors out of the guardians’ halls, and the Capstan Floor’s windows are barred, so your wings no longer carry you out over the void and back in past its great lock.',
    // Lorn's deep water (issue #355): src/player.js swimmable (SWIM.dropIn), the tumble into deep water; src/levels/perdide.js
    // SKIFF_AT, player.js / main.js mountAt; tests/swim.test.js, tests/lorn-route.test.js; docs/systems/movement.md
    'Falling or jumping into deep water swims, in Lorn and wherever there is water deep enough to float in: you are no longer put back on the bank before you even touch it. Lorn’s skiff waits afloat off the landing island’s beach, a short wade from the shore, ready to board.',
    // the galactic map's scanner (issue #353): src/story/signature-search.js WANDER, wander, cues; src/ship/starmap.js
    // drawScanner, searchUpdate; src/rumble.js search; tests/signature-search.test.js, tests/rumble.test.js
    'On the galactic map the scanner no longer shakes as you sweep for a world: it drifts gently, barely at all while the signal is faint, a little more as it locks on, and the pad’s pulses are softer while the signal is weak.',
  ] },
  { v: '1.74', date: '2026-10-14', items: [
    // the weather indoors (issue #348): engine/game.js registers the ship with src/shelter.js addIndoors as main.js does;
    // src/wind.js: no wisp in an interior, none while you are in one (hush); tests/wind-wisps.test.js, tests/engine-ship.test.js
    'No rain falls inside your ship any more in the Unity version (it rained in its rooms in Lorn), and no wisps of blown sand drift through the ship, the shops or the temples in any world: the weather stays outside.',
    // the wisps' stroke (issue #348): src/wind.js WISP, wispPx (a share of the frame's render rows, coverage under a
    // pixel, pointed ends, at most 0.8 of the ink); tests/wind-wisps.test.js; docs/systems/rendering.md
    'The wisps of sand the wind blows across the Desert are light pen strokes on handhelds and small screens, pointed at their ends: on the Retroid far ones were drawn as heavy black dashes on the dunes.',
    // the temples' last loops (issue #23, round 5): src/temples/arzach.js STACK.chute; tests/temples.test.js
    'In the Aerie the Moult is entered from above now: in the Eyrie, while the stone sits in the vent at the foot of the gap, that vent is still and its shaft goes down into the Moult. Drop in, open your wings, win the fight, and its door lets you out onto the Wind Well’s floor. Roll the stone into the other throat and the same vent blows you up to the great key.',
    // src/temples/arzach2.js RING (the Ringers' Walk), migrate.js arzach2 v3; tests/temples.test.js
    'In the Founders’ Belfry the far door takes a great key now. Half-way over the Hall of Echoes the bell brings down a spur off the bridge to a doorway in the west wall, and no ball holds it: ring, and run. Behind it the Ringers’ Walk leads back round to a ledge high in the Stone Stair, where the key’s cage shows from the stair’s floor at the start: it sinks only while the founders’ bell far below rings, and with its ball still in its mouth that bell hears your whistle from up there. Drop onto the landing and climb the house again.',
    // src/temples/incal.js FLUE, migrate.js incal v3; tests/temples.test.js
    'In the Warden’s Well a second way climbs to the crown: the Flue, a shaft off the Lamp Gallery’s west wall. Splash the little vane high on its wall and a draught rises up its middle; half-way up a ledge holds the house’s great key, which the warden’s door now wants as well as its eye. Splash the vane again from the ledge and ride on up into the crown.',
    // the listening pillars (issue #23, round 6): src/temples/pieces.js Pillars, bazaar.js; tests/temples.test.js
    'In the Undertower the great horn at the edge of the Gallery of Voices is gone: each pillar over the chasm has a little horn of its own now, and rises only while the high note, played back near it, still rings. Play it at the edge, step out, and play it again as you go: the pillars ahead rise to meet you, and the one under you waits for you. The middle note’s egg stands nearest the chasm, where the far door can see it.',
    // the Clock-House's mainspring in sight, the gallery's beat (issue #23, round 6): src/temples/garage.js, pieces.js Swing; tests/temples.test.js
    'In the Clock-House the Mainspring Room is off the Escapement’s far landing now, its doorway facing the Clockmaker’s Cupboard: from the Cupboard’s shut door you can see the slack spring that stopped its little clock. Wind it once you have the quick coil, and the Cupboard wakes. Over the Clock Gallery’s bridge a great brass pendulum swings along it: cross under it as it swings away; if it meets you, it only knocks you back.',
    // the Aerie's catch and the Moult's air (issue #23, round 6): src/temples/arzach.js WELL_VENT, migrate.js arzach v3; tests/temples.test.js
    'In the Aerie the wind up the Wind Well no longer takes your new wings straight to the top: it lets you go just over the balcony, because a second vent by the Moult’s door breathes half of it away. Roll that vent’s stone into its throat and the whole wind rises again. In the Eyrie the column past the great key’s perch only blows once the Moult below is won and its door open: the wind comes up its shaft out of the Moult.',
    // Vael's level init (src/levels/arzach.js): the falling-up edge's risers got no collider in the game
    'Past the riders’ gate on Vael, the stones that rise under you are solid again: you no longer fall through them.',
    // the traveller's starts, stops and turns at the game's speeds (issue #47): src/feet.js (pushOff, toeOff, releaseArc,
    // the drop from the ridden floor, rideAhead, pivotPlant, pivotYaw, the step's turn), src/player.js (FACE, START_STEP),
    // src/loco-moves.js (the pivot's rateEase); tests/motion-qc.test.js; docs/systems/animation.md, "Issue #47"
    'Your legs keep up with you better: the knee no longer snaps straight at every stride of a sprint, a foot no longer drops onto the slope at each step up a ramp or rises a whole stair in one go, setting off at a run starts on the foot behind, and turning round on the spot or reversing a sprint no longer twitches a foot, a knee or your arms.',
    // the Unity build's distant shimmer (issue #218): Composite.shader 1c (post.js INK_FAR), HiraethCommon.hlsl strokesLevel
    // (HATCH_AA), SMAA at Handheld (SMAA.shader, HiraethFeature.cs, BridgeRunner -aa); tests/distant-shimmer.test.js;
    // docs/systems/performance.md "Unity on the Retroid: the distant shimmer"
    'In the Unity version the far distance no longer shimmers as the camera turns: far-off lines are drawn lighter, as in the web game, so distant towns, towers and dunes stop crawling (on the Retroid, a third to three quarters less flicker far off), and on handhelds the edges are smoothed more sharply. Near lines stay as crisp as before.',
    // the gadgets and the wallet in the engines (issue #344): engine/game.js Gadgets, gadgetFoundLine, menuSources wallet/toggles,
    // useItem; scripts/engine-bundle.mjs import.meta.glob; src/gadgets/hud.js screen 'gadget'/'gadgetWheel'/'reticle'/'gadgetMarks';
    // BridgeHud.cs DrawGadget etc.; tests/engine-gadgets.test.js
    { text: 'In the Unity preview the gadgets are there: chests and the makers’ courts give them, the one you find is in your hand at once, D-pad ↑ takes another (held, the wheel), and its picture sits in the top right corner. The Items page lists every one of them, and your chimes beside the count.',
      see: 'In the Unity preview, open the chest in the Givers’ Hearth: after its card the fluid gun is in hand, its glove in the top right corner, and the Items page counts 68 slots with your chimes beside them, as the browser game does (it counted 58, with no chimes).' },
    // the box card in the engines (issue #345): src/boxes/card.js cardState, screen 'boxCard'; engine/game.js box input, busy,
    // its filmed opening; src/input-mode.js in the engine (the pad's names); BridgeHud.cs DrawBoxCard; tests/engine-gadgets.test.js
    { text: 'In the Unity preview a makers’ chest ends its opening on its card, as in the game: what you found, what it does, and A to go on (B skips the opening). Once you pick up a pad, the prompts name its buttons rather than the keyboard’s.',
      see: 'In the Unity preview, open the star’s chest in Qanat’s streets with the pad: the opening is filmed in its letterbox, then the card reads PALE STAR and its line, with an A button to continue. Walk up to someone: the prompt names the pad’s X, not the keyboard’s E.' },
  ] },
  { v: '1.73', date: '2026-10-14', items: [
    // the City-Shaft's main quest waits for the wings too (issue #328, reopened): src/story/incal-data.js needs; tests/quest-needs.test.js
    { text: 'In the City-Shaft, Nima only asks you to look into the dimming light once you have the fluid wings (the way down the shaft is flown): without them she points you to the Aerie on Vael.',
      see: 'With a save that reaches the City-Shaft without the wings, talk to Nima on the high terrace: one line, “Wings first: the Aerie, on Vael”, and no quest. With them, she gives it as before.' },
    // the drone off him (issue #294): src/scout.js (APPEAR, appearSpot, the light; phases away/appear/leave), main.js;
    // tests/drone.test.js, tests/scout.test.js; docs/systems/scout.md
    'Plumb, the drone, no longer rides on your back by your face: it comes out of a small light over your shoulder when you call it (or when it has something to show you), does its job, and winks out again. Talks, scenes and close-ups show only you.',
    // the reveal's last shot left as the ship's camera (src/ship/ship.js updateReveal; tests/arrival-view.test.js,
    // tests/engine-ship.test.js; found in the Unity preview, issue #264)
    'After the first step out of your ship in a world, and after the opening, the camera follows you again once it has drifted into its view: it stayed where it was and let you walk out of the picture.',
    // the shops in the engines (engine/menus.js openShop, shopView; engine/game.js shopPanel; BridgeMenu.cs DrawShop; issue #264)
    'In the Unity preview the shops open: Anselm sells his upgrades aboard the ship for your fragments, and every keeper their wares for chimes, on a sheet you go down with the pad, asked before you buy.',
    // names alike in one world (issue #281): src/story/hosts-data.js, src/temples/{underwater,perdide2}-data.js,
    // src/story/shop-data.js, src/minigames/canyon.js, src/save-migrate.js step 28; tests/names.test.js
    { text: 'No two people you meet in a world have names that look alike any more. The games’ hosts are the Desert’s Kamal, Aziza and Bilal, Vael’s Elva and Brother Amos, the City-Shaft’s Dagny and the Moon Foundry’s Rudi; the Whale-House’s door-keeper is old Achille, Lorn’s lamp-counter is Briony and the Welcome-Shelf’s keeper is Burdock. The Desert’s hoverbike race is run round the Two Chasms.',
      see: 'In the Desert, walk up to the canyon run’s sign: “ask Kamal about the canyon run”, and its card reads The Two Chasms. In the Underwater City, Achille sits by the Whale-House’s door; in Lorn, Briony counts the lamps by the Lamp-House and Burdock keeps the Welcome-Shelf.' },
    // photo mode in the engines (engine/game.js setPhoto, photoFly; engine/menus.js START_SIDE; BridgeHost.Photo; issue #264)
    'In the Unity preview the Start menu has Photo mode: fly the camera anywhere with the sticks, the screen clear but for its keys, and A saves the picture.',
    // the ship in the engines (engine/game.js ship.attach, input, update, hud; the cinema's screen.cine and screen.sub,
    // BridgeHud.cs DrawCine; Ship.travel's go, engine/unity/game.js flyTo; issue #264)
    'In the Unity preview your ship works: walk up its ramp and you go aboard, the console plays its messages, the holo table opens the worlds you can fly to, and flying there plays the take-off and the arrival, with their letterbox, fades and subtitles.',
    // the opening in the engines (engine/game.js playPrologue, engine/unity/game.js begin; issue #264)
    'In the Unity preview a new game opens with the prologue, as the game does: you wake aboard the ship in orbit, walk to the console for your father’s message, and come down in the desert.',
    // the Unity menus' Map list on the Retroid's 4:3: each line as tall as its words (BridgeMenu.cs Fit; issue #264)
    'In the Unity preview the list beside the Map no longer writes a long place’s name over the line under it on the Retroid: each line is as tall as its words.',
    // the recordings' closing angle (issue #297): src/ship/cinematics.js callFrame, CALL_EASE; tests/ship.test.js
    { text: 'In the recordings at the ship’s console, the view no longer jumps in to the close-up from the same spot: it glides across into it.',
      numbers: [{ title: 'Jumps in the picture the cinematics QC finds in a recording', unit: 'jumps', better: 'lower', device: 'Mac, muted headless Chrome, High, 1280 × 720 (scripts/cinematics-qc.mjs)', rows: [
        { where: 'Recording 1 · Home', before: 1, after: 0 }, { where: 'Recording 6', before: 1, after: 0 }, { where: 'Recording 8', before: 1, after: 0 },
        { where: 'Recording 9', before: 1, after: 0 }, { where: 'Recording 11', before: 1, after: 0 }, { where: 'Ilen’s recording', before: 2, after: 0 },
        { where: 'Lorn II’s recording', before: 1, after: 0 },
      ], source: 'the script’s pops on this branch and on the tree before it (259a283d), 14 October' }],
      see: 'Play a recording at the ship’s console after a few worlds: as the parents fold away, the view moves across to the close-up instead of cutting.' },
    // the touchdown's dust (issue #299): src/ship/exhaust.js touchdownDust, src/ship/fx.js Puffs.settle; tests/cutscenes.test.js
    'When your ship lands, the dust it blew up settles at once and only a small, pale puff rises at each foot: you see the ship standing on its feet within a second, not hidden behind big beige balls of dust.',
    // the window seat (issue #298): src/story/home.js seatWide, SEAT_RISE, seatSide; tests/home.test.js
    'At home, the window seat: your head stays inside the picture as you sit down and get up, and the view from beside the seat no longer has a flat white patch of wall in it.',
    // the stone's framing (issue #296): src/ship/homecoming.js TOMB_ANGLES, TOMB_SPOTS, reelCuts; tests/ending.test.js
    'Coming home, at the stone: nobody stands half out of the picture any more (you, Lou and Ilen are each wholly in a shot or out of it), Lou is filmed from where her face shows, the oldest recording cuts between your parents and your face, and the view no longer jumps as the cargo check opens and closes.',
    // three worlds' climaxes in four panels (issue #295): src/story/{underwater,moonfoundry,spacecity}-moments.js, the
    // changes in src/temples/{moonfoundry,spacecity}.js, the whales' pass (src/levels/underwater-kit.js, underwater.js);
    // docs/systems/cinematics.md; tests/moments-{underwater,moonfoundry,spacecity}.test.js
    'Three worlds’ endings show what they are about. In the Underwater City a whale comes right up against the Whale Gallery’s glass and you see it there; in the Moon Foundry the last moon rises onto its hook over the Casting-House’s door, and every hung moon over the floor turns slowly round toward it; in the City Floating in Space, over the roof, every cable runs taut out of the great capstan and its lamps light one by one out along them.',
    // the spot blacks' range (issue #301): post.js SPOT_RANGE, the Unity composite the same; docs/systems/rendering.md
    // "No spot-black halo round a thing standing before a surface"; tests/occlusion-taps.test.js
    'No more dark ragged halo round things that stand in front of a wall or a floor further back, like the crystal on its ring in the Lorn temple hall or the stone figure by the Underwater City’s ramp: it used to slide over the wall behind them as you turned the camera.',
    // the portrait head's eyes from afar (issue #302): portrait-head.js PORTRAIT_EYES_FAR; docs/systems/faces.md;
    // docs/audits/ink-lines-v1.72.md; tests/portrait-head.test.js
    'Seen from ten metres or more, the traveller’s eyes no longer show as two pale or dark dots on his face: they soften into one warm mark, as a drawing does. Close up he looks as before.',
    // the Deck's two shortcuts told apart (scripts/steam-deck/deck.py UNITY_NAME, UNITY_ART, UNITY_ICON;
    // scripts/steam-art.mjs unity; docs/steam-deck.md "The Unity preview"; the old install: --remove-old-install)
    'On the Steam Deck the Unity version is now called “Hiraeth (Unity)” in Steam and in the desktop menu, with its own icon and library pictures marked UNITY, so you can tell it apart from Hiraeth at a glance. It changes with the next update, while Steam is closed; a name or icon you gave it yourself stays.',
    // the spot blacks gone, the crease shading back without its grain (issue #322's second look): src/post.js CREASE,
    // CREASE_TAPS, quadMean; Composite.shader; tests/occlusion-taps.test.js; docs/systems/rendering.md
    'The dark, ragged patches stuck along the corners of rooms (where the ceiling meets the wall in the Desert’s shop, under the arch of your bunk in the ship, at the foot of walls in caves) are gone, and the soft shading that settles into corners, under counters and along the foot of walls is back, now smooth, with no grainy speckle crawling as you move.',
    // the ship's rooms hatched again, coarser (issue #325's follow-up): src/ship/model.js SHIP_ROOM_HATCH_PX, materials.js hatchPx
    'Your ship’s rooms are shaded with pen strokes again in the shade, drawn wider apart so they no longer shimmer as you walk about.',
    // the C# port's voices (issue #333): unity/Hiraeth/Assets/Hiraeth/Runtime/Voice.cs (voice.js's plan, ported),
    // VoiceSynth.cs (voice-synth.js's formant voice), VoiceOut.cs (streamed on the audio thread), Hud.cs (the reveal by
    // RevealAt, the hush), ShipScene.cs (the calls' speaker); scripts/unity-export/voice-reference.mjs; VoiceTests.cs,
    // tests/unity-voice-reference.test.js; docs/systems/audio.md "The people's voices"
    { text: 'In the Desert rebuilt in Unity, people speak with the new voices too, as they do in the browser: one voice a line that glides from syllable to syllable, with breath, vowels and consonants, in place of the old beeps. A conversation’s words appear as they are said, turning the page hushes the voice, and the ship and the calls home sound through a speaker.',
      see: 'In the Unity port of the Desert, talk to Ama by the fire and listen: the words come up with the voice, pausing where it pauses. Press on before she finishes and her voice fades as the page turns. Walk past the camps to hear the people around, two at most, and quiet while you talk to someone.' },
  ] },
  { v: '1.72', date: '2026-10-14', items: [
    // the people's voices as speech (issue #323): src/voice-synth.js (a formant voice, one a line), src/story/voice.js
    // (SPEECH, prosody, revealAt), src/audio.js renderPlan, src/story/dialogue.js; docs/systems/audio.md "The voices";
    // tests/voice-synth.test.js
    { text: 'People on every world speak now instead of beeping: each line is one voice that glides from syllable to syllable, with breath, real vowels and consonants, stress on its words, pauses at its commas and full stops and a question that rises. Every world’s tongue has its own sound, every speaker a voice that fits them (a child’s small and high, an old man’s wavering, a heavy one’s deep), and the tone of a line is heard: sad lines slower and darker, playful ones quicker and brighter. No more clicks between syllables, and less work for the device.',
      see: 'Talk to anyone in the Desert, then in the City-Shaft or Edena: the same kind of line sounds like a different language each time. Or open the music page (music.html), Voices, and play each world’s tongue.',
      numbers: [{ title: 'What one 20-syllable line costs', unit: 'nodes', better: 'lower', device: 'the engine’s Web Audio (engine/webaudio.js), a Desert line', rows: [
        { where: 'audio nodes made for the line', before: 220, after: 28 },
      ], source: 'counted in a render of the line, before and after (tests/voice-synth.test.js counts the new)' }] },
    // the first arrival in each world (issue #327): src/ship/arrival-view.js (WIDE, MARKS), src/ship/arrival-views.js
    // (scripts/arrival-views.mjs, picked in the game), cinematics.js ArrivalDirector's wide stage; docs/systems/cinematics.md
    // "The first arrival in each world"; tests/arrival-view.test.js
    'The first time your ship comes down on a world, it comes down into a wide view of the whole place under a big sky: the ship small as it lands, the world’s landmarks (its temple, its town, its towers and beacons) laid out behind it. Later landings there stay short, as before.',
    // the first step out (issue #327): ship.js Ship.revealView, arrival-view.js REVEAL, exitStops, pickExit
    'Your first step out of the ship on each world turns you toward its best view, and the camera drifts slowly in behind you with its landmarks in sight. Move or turn the camera and it is yours at once; it happens once a world.',
    // living foes on slopes (issue #332): src/enemies/slope.js (SLOPE, planeUnder, readSlope, tiltRoot), Foes.look and
    // beforeLegs; the kit's plane (gait.js rise, body.js, rig.js setSlope/upright, machines.js TrackDrive, wave-legs.js);
    // brute.js clearGround, humanoid.js smoke, quadruped.js placeBeads, hopper.js, roller.js, skitterers.js, centipede.js;
    // docs/systems/foes.md "On a slope"; tests/foe-slope.test.js
    'Creatures and machines standing or walking on a hillside now lean with it instead of sinking into it: the crucible cart’s tracks, a lizard’s tail, the toad, the heron’s toes, the bell walker and the tripod all stay on the ground, their feet planted on the slope while the tall ones keep upright. The furnace brute’s fists and the wood cutter’s saw no longer hang into the ground when it stands still.',
    // the chime pirates made better (issue #326): src/minigames/pirates.js, pirates-rules.js ATTACKS, pirates-sfx.js,
    // kit/flow.js hintRow; docs/systems/minigames.md "Made better"; tests/pirates-feel.test.js
    'The chime pirates’ button hints are one small dark row at the bottom right now, a button and a word each. They fade after the first few seconds, and each one goes as soon as you have used its button.',
    'The chime pirates come in kinds you can tell apart at a glance: the fighter with four blades swept forward, the gunboat with its wide brow and slung cannon, the bat-winged bomber. Each attacks its own way and warns you first: the fighter’s eye flares, the gunboat’s cannon glows before it fires a fan of three, the bomber’s bay lamps blink before a mine drops, and the captain’s turrets glow hot before a volley.',
    'Every sound of the pirate fight is new: punchier bolts, explosions with a deep thump and crackling debris, a whine before a pirate fires, a whoosh for the roll, a horn as the captain arrives and the engine humming under it all. You can hear each one on the music page.',
    'The pirate fight feels better: a downed pirate shakes the view a little and holds the action for a split second, its wreck flies apart, the guns flash as they fire, hits spark, quick kills count up a combo, and your ship leaves a short engine trail as it banks.',
    'Steering in the pirate fight is tighter: a small push makes a fine correction, letting go stops the ship where you leave it, and your shots bend onto a pirate close to your aim.',
    // the box camera kept in front of every wall, roof and gate (issue #292): src/boxes/scene.js clearLens (LENS_NEAR, the
    // swing round him, the floor probe under the roof); the review holding a yard's gate open; tests/boxes.test.js
    'The chests behind the yards’ gates (the founders’, the moorers’ and the divers’) open seen from inside their alcove: no longer through the gate’s bars with his tank filling the screen, and no more blank picture as he takes what was in them.',
    // the closing shot keeps his head in (issue #293): src/boxes/scene.js keepHead, HEAD_FRAME; beats.js the try shot's aim;
    // tests/boxes.test.js (a walled room, every beat and plan)
    'A chest’s last shot keeps you in the picture in a small room: the lift valve’s no longer ends on the open lid against the wall, the Givers’ guard on an empty corner, or the gun with you at the edge of the screen.',
    // the opening keeps his head in too (issue #334): src/boxes/scene.js keepHead with a subject (SUBJECT_FRAME, FIT_LIFT,
    // FIT_WIDEN, liftRoom), nearPlay (CUT_NEAR, NEAR_BLEND); src/boxes/index.js passes play's camera; tests/boxes.test.js
    'A chest’s opening keeps your head in the picture too: in the lift valve’s cave, under the hearth and in the yards’ alcoves the camera no longer sits at your back with your head cut off, it rises to look over your shoulder at the chest. After trying the gun, the camera eases back to you instead of jumping.',
  ] },
  { v: '1.71', date: '2026-10-13', items: [
    // what ships that no page loads (issue #300): the Elder's first body and the traveller's second head moved to data/,
    // tests/shipped-assets.test.js; docs/systems/performance.md "The City-Shaft's 13 ms, and what ships that no page loads"
    { text: 'The Android app and the Steam Deck download carry 5 MB less: two old bodies the game no longer uses (the Elder’s first prototype and the traveller’s earlier head) are left out.',
      numbers: [{ title: 'What the APK and the Deck package carry', unit: 'MB', better: 'lower', device: 'the shipped build, .claude/skills/perf-audit/size.mjs', rows: [
        { where: 'the game’s files in the APK and the Deck package', before: 53.96, after: 48.63 },
        { where: 'everything a device can get (with the music fetched on demand)', before: 153.14, after: 147.81 },
      ], source: 'node .claude/skills/perf-audit/size.mjs' }] },
    // the City-Shaft's collision on an SAH BVH built behind the load (issue #300): src/physics.js Physics.create o.later,
    // refine; src/levels/incal.js collision.later; tests/physics-refine.test.js
    { text: 'In the City-Shaft the first seconds after you arrive run smoother sooner: the far trees and strollers it finishes after the first frame are done in about half the time, and every collision check there is quicker. Nothing looks different.',
      numbers: [{ title: 'The City-Shaft after arriving: the work finished after the first frame', unit: 's', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, High, 1280 × 720, load average 10-13, two runs each', rows: [
        { where: 'until it is all done (from the first view)', before: 19.7, after: 9.5 },
        { where: 'the main thread’s time spent on it', before: 4.6, after: 2.5 },
        { where: 'the load', before: 5.4, after: 4.7 },
      ], source: 'window.deferred after ?level=incal, before and after built from archived copies, run in turn' }] },
    // every guardian fair (issue #319): src/temples/boss.js Blast, BLAST, MESH_PARTS, meshParts; every temple's moves
    // (parts / blast, gaps); the warden (incal.js) and the Elder (arzach.js, elder-v3-creature.js ELDER_POSE) paced and
    // open after every move; docs/systems/foes.md "Every guardian, fair"; tests/guardian-fairness.test.js
    { text: 'The warden and the Elder fight fairly, as the Keeper does now: a longer breath between their moves, an opening after every one, and a combo’s blows further apart. The warden’s eye fires a beam you can see, down to where you stood; its stomps send a ring of shock out round its feet that you can jump; the Elder brings her beak down at you when she pecks, and her wings send a wall of wind you can see coming. Every other guardian’s blows land the same way now: with its body, or with a beam or a wave you can see, never on a patch of floor far from it.',
      numbers: [{ title: 'How far from what the guardian draws its blow can hit you', unit: 'm', better: 'lower', device: 'the combat review’s guardian run (node, each guardian in its own hall)', rows: [
        { where: 'the warden', before: 18.7, after: 0.7 },
        { where: 'the Elder', before: 16, after: 1.3 },
        { where: 'the Cloud-Mother', before: 19.1, after: 1.5 },
        { where: 'the First Sign', before: 14.8, after: 0.8 },
        { where: 'the worst of all fourteen', before: 19.1, after: 1.5 },
      ], source: 'node .claude/skills/combat-review/guardian.mjs --ids all, before (the tree at 7edcecc9) and after' },
      { title: 'A combo’s blows, the closest two', unit: 's', better: 'higher', device: 'the same run', rows: [
        { where: 'the warden', before: 0.97, after: 1.42 },
        { where: 'the Elder', before: 0.92, after: 1.42 },
        { where: 'the closest of all fourteen', before: 0.92, after: 1.42 },
      ], source: 'node .claude/skills/combat-review/guardian.mjs --ids all' }],
      see: 'In the Warden’s Well, stand in front of the warden as its eye flares red: the beam comes down to where you stood; step aside once it stops turning and it misses. Turn on the hitboxes (F4) to see each blow drawn where it lands.' },
    // the skins' facing (issue #319): src/temples/boss.js Guardian.place sets the whole turn; guardian-generated.js swap
    { text: 'The Keeper and the Elder face you when they fight. Their bodies turned the wrong way in their halls, so the Keeper swept and the Elder pecked behind them while their blows came at you.',
      see: 'In the Aerie, wake the Elder and stand in front of her: she looks at you, and her peck comes your way.' },
    // the lock on every weak point (issue #319): src/foes.js GuardianLock.aim / aimR
    { text: 'Locked on any guardian, you are locked on its weak point: the warden’s vent, the Elder’s beak, the Foreman’s face, the Last Founder’s heart, where your shots count, instead of the middle of its body.',
      numbers: [{ title: 'How far the lock aims from the weak point', unit: 'm', better: 'lower', device: 'the combat review’s guardian run', rows: [
        { where: 'the warden', before: 2.36, after: 0 },
        { where: 'the Elder', before: 2.51, after: 0 },
        { where: 'the First Sign', before: 7.4, after: 0 },
      ], source: 'node .claude/skills/combat-review/guardian.mjs --ids all' }] },
    // the Elder's ink (issue #319): src/characters/elder-v3-creature.js (no inkLine / inkTint)
    { text: 'The Elder is drawn in the same ink as the rest of the world: a full black outline instead of a faint line in her own colour that made her look pasted on.',
      see: 'In the Aerie, look at the Elder against the wall.' },
    // shadows and openings (issue #319): boss.js GroundShadow for floaters; the lit eyes' castShadow; perdide.js seeds
    // open; arzach2.js MOTHER_GASP
    { text: 'The guardians that float, the Cloud-Mother, the Lampless, the Echo and the Elder in flight, have a shadow on the floor under them, smaller the higher they hang, so you can tell where they are over you. The machines’ lit eyes cast shadows too. Every guardian now opens up in each part of its fight: the Mother Snapper hangs her head after spitting a seed, and the Cloud-Mother gasps a moment in her last phase (a ring of the bell then calms her a little; the held stone still calms her most).',
      see: 'In the Cloud-Mother’s hall, look down under her as she swims.' },
    // creature motion (issue #287): src/characters/keeper-creature.js KEEPER_GAIT height; src/motion-kit/gait.js init
    // (the first stance from the serial, kept until the foe moves); docs/systems/procedural-animation.md "Packs out of step"
    { text: 'Creatures of a kind that wake together no longer march in step like soldiers: each sets off on its own foot. The Cistern-Keeper lifts its feet a little higher as it walks.',
      tags: ['combat'],
      numbers: [{ title: 'Two of a kind walking side by side: how in step (1 is in step)', unit: '', better: 'lower', device: 'node, scripts/motion-audit/run.mjs --pack, each pair walked after 0-15 others were made, the worst of sixteen', rows: [
        { where: 'the furnace brute', before: 0.97, after: 0.00 },
        { where: 'the root knot', before: 0.95, after: -0.16 },
        { where: 'the bell walker', before: 0.90, after: -0.15 },
        { where: 'the lamp tripod', before: 0.86, after: 0.25 },
        { where: 'the shade', before: 0.85, after: 0.36 },
        { where: 'the stilt heron', before: 0.84, after: -0.21 },
      ], source: 'node scripts/motion-audit/run.mjs --pack (docs/systems/procedural-animation.md, “Packs out of step”)' },
      { title: 'The Cistern-Keeper’s walk, on its skin', unit: '% of its leg', better: 'higher', device: 'node, scripts/motion-audit/run.mjs \'keeper (generated)\', 2.2 m/s', rows: [
        { where: 'how high a foot lifts', before: 15, after: 17 },
        { where: 'how far the leg stretches and folds', before: 19.5, after: 21 },
      ], source: 'node scripts/motion-audit/run.mjs \'keeper (generated)\'' }] },
    // the chest's card: the name and what it does (issue #329): src/boxes/card.js CARD_MAX_CH, src/items.js itemLine / does;
    // docs/systems/boxes.md "The name and what it does"
    'A chest’s card now says only what you found and what it does, on a small card in the middle of the screen that is easy to read, instead of a strip across the whole screen with a line about the makers and a description of what the thing is made of.',
    // a gadget found is in hand at once (issue #330): src/items.js grant, src/gadgets/index.js inHand / gadgetFoundLine;
    // docs/systems/gadgets.md "A gadget found is in hand at once"
    'A gadget you find is in your hand straight away, ready to use, instead of waiting until you pick it; a line after the chest says so, and the first time you carry two, that D-pad ↑ takes the other.',
    // nobody gives a quest before it can be done (issue #328): src/story/quest-needs.js, quests.blocked / heldBack,
    // dialogue.js start / startsHeld; docs/systems/story.md "Nothing given before it can be done"
    'Nobody gives you a quest you can’t do yet. In Vael, Oïa waits until you have the fluid wings before she asks you to wait with her for the bird: until then she points you to the Aerie, and its quest starts. Sister Aube waits until the bird has answered your call, Sabri until you have the lift valve, and the masked head and the hoverbike until you have the gun and the backpack. Until then they aren’t marked on the map.',
    // the Keeper's second pass (issues #320, #321, #331): src/characters/keeper-creature.js KEEPER_GAIT (stance, knees,
    // reach, clear, turn), src/motion-kit/gait.js clear / keepClear / BOW, src/temples/boss.js keepIn KEEP_IN, a.leap,
    // a.late, def.glow, def.faceYou, def.camera; src/temples/desert.js KEEPER (leap, KEEPER_LIGHT, KEEPER_GUARD.gulp);
    // src/player.js BOSS_CAM, stagger STAGGER; src/foes.js GuardianLock.steady, STEADY, bossFight; docs/systems/foes.md
    // "The first guardian, a second pass"; tests/keeper-second-pass.test.js
    { text: 'The Keeper’s six legs no longer tangle: its feet stand wider, its knees bend out to its sides, and no foot lands on another as it walks, turns or charges. Its charge is a bound, its feet off the floor.',
      tags: ['combat', 'temples'],
      numbers: [{ title: 'The Keeper’s legs: the closest two of its six come (their bones, its legs about 0.14 m thick)', unit: 'm', better: 'higher', device: 'node, the Rose House’s cistern, its fitted skin', rows: [
        { where: 'walking across its cistern', before: 0.02, after: 0.36 },
        { where: 'turning on the spot', before: 0.08, after: 0.37 },
        { where: 'its charge', before: 0.07, after: 0.48 },
        { where: 'a minute’s fight, the traveller circling it', before: 0.01, after: 0.11 },
      ], source: 'a scratch run of the fight’s own code in node over the real cistern (each pair of legs, the least distance between their thigh and shin bones, every frame), the tree before the change and after' }] },
    { text: 'Fighting the Keeper, the camera stands back and higher, so you see the whole of it and yourself. Locked on, it stays steady: it follows the Keeper’s body calmly, not its swinging head, while your aim stays on its mouth.',
      tags: ['combat', 'temples'],
      numbers: [{ title: 'Locked on the Keeper and strafing round it (50 s, a pad pushed one way then the other)', unit: '', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, High, 1280 × 720, the cistern, stepped 1/60 s a frame', rows: [
        { where: 'the camera’s sharpest turn (rad/s)', before: 4.48, after: 2.92 },
        { where: 'how sharply its turn changes, 95th percentile (rad/s²)', before: 8.8, after: 4.6 },
        { where: 'the Keeper’s mouth off the screen (%)', before: 68, after: 25 },
      ], source: 'a scratch driver of ?level=desert&guardianReview=keeper (a fake Xbox pad and the keyboard), the camera recorded each frame, before and after' },
      { title: 'How far back the camera stands', unit: 'm', better: 'higher', device: 'the same run', rows: [
        { where: 'from the traveller, the median', before: 3.05, after: 9.26 },
        { where: 'over his feet', before: 1.36, after: 3.4 },
      ], source: 'the same' }] },
    { text: 'Strafing round the Keeper locked on, it turns to face you and keeps its head on you as it steps round, instead of turning its back.',
      tags: ['combat', 'temples'],
      see: 'In the Rose House’s cistern, wake the Keeper, lock on (R3 / Tab) and walk left and right with the stick: it sidesteps round with you, its head toward you.' },
    { text: 'The Keeper stays inside its cistern: its shell and neck no longer pass through the walls. In its last phase it leaps at you instead of burrowing into the stone floor, its shadow running ahead to where it will land, then lies winded.',
      tags: ['combat', 'temples'],
      numbers: [{ title: 'The farthest the Keeper’s body reached from its cistern’s middle (the wall at 18 m)', unit: 'm', better: 'lower', device: 'node, the cistern, a minute’s fight and its moves', rows: [
        { where: 'in a fight', before: 19.4, after: 18.3 },
        { where: 'charging', before: 20.1, after: 17.9 },
        { where: 'walking', before: 18.8, after: 17.1 },
      ], source: 'the same scratch run, its skin’s vertices every sixth frame' }] },
    { text: 'The Keeper has three clear phases of two: light two braziers, then give it water twice, then twice more. While it pants it drinks as long as you keep the water coming, so one good opening can end a phase. No more glowing spark shape before its blows: its body’s wind-up shows what is coming.',
      tags: ['combat', 'temples'],
      numbers: [{ title: 'What it takes to calm the Keeper', unit: '', better: 'lower', device: 'its fight’s rules (src/temples/desert.js)', rows: [
        { where: 'calming acts (braziers lit, drinks given)', before: 10, after: 6 },
        { where: 'openings to earn, at least', before: 6, after: 2 },
      ], source: 'tests/keeper-second-pass.test.js' }] },
    { text: 'When a creature or a guardian hits you, you stagger back on your feet instead of falling limp to the ground, and nothing else hits you for a moment while you recover. You still fall when your last heart goes, or from a great height.',
      tags: ['combat'],
      numbers: [{ title: 'Locked on the Keeper, strafing round it for 50 s', unit: 'times', better: 'lower', device: 'headless Chrome, the cistern, the same run', rows: [
        { where: 'knocked to the ground', before: 2, after: 0 },
      ], source: 'the same scratch driver' }],
      see: 'Stand in front of any creature that knocks you (the Arena’s horn lizard, the Keeper’s stamp) and let it hit you.' },
    // the crease shading gone (issue #322): post.js creaseAO, uAO, uCrevice out of the composite, the presets, the worlds'
    // looks, the quality presets (ao) and the Unity bridge (Composite.shader, HiraethLook.cs); docs/systems/rendering.md
    'The grey, grainy shading that gathered in corners, along the foot of every wall and under counters, benches and pots is gone. Indoors, in the desert’s shop and everywhere else, walls and floors no longer crawl with dark speckles as you walk round; the deep pockets keep their solid ink shadows.',
    // the camera aboard (issue #324): src/player.js CameraRig.climb (BODY_CLEAR, CLIMB.max 0.95), heroCut / BODY_CUT,
    // SHORT_LOOK; materials.js uHeroCut / uCutWith; the camera QC's ship-walk; docs/systems/movement-and-camera.md
    'Walking around your ship, the camera no longer climbs up over the traveller and stares down through his head when a wall is close behind him: it stays behind him at shoulder height, and when it has to come right in against him he is left out of the picture for that moment instead of being seen from the inside.',
    // the ship's rooms still (issue #325): src/ship/model.js SHIP_ROOM_HATCH (a flat tone in shade), src/ship/interior.js
    // (12 z-fight sites -> 0), scripts/zfight/audit.mjs --ship; docs/systems/rendering.md "The ship's rooms, shimmering"
    'The rooms of your ship no longer shimmer as you walk through them: walls, ceiling, floor and furniture are a flat colour in shade instead of fine hatching that crawled, and the places where two surfaces flickered through each other (the panel over the bunk’s arch, the doorways’ frames, the console, the sofa) are fixed.',
  ] },
  { v: '1.70', date: '2026-10-13', items: [
    // ways through lit (issue #305): src/thresholds.js (washes, src/veil.js), every portal's `door`, main.js; the step
    // through: src/passage.js lead + PassageCover.light; the skull cave's landing end no longer ink (src/desert-city.js)
    'Every door, cave mouth, hatch, lift and temple door that takes you somewhere else now has a soft veil of light hanging in its opening, so you can see at a glance that you can go through; a way that won’t take you yet stays as it is. The way up out of the skull cave no longer looks like a shut black wall. Going through, the light flares and washes over the screen for a moment before the page turns.',
    // the desert's storms paced (issue #308): src/levels/content.js desert.weatherPace, src/weather.js first/clear/episode
    { text: 'Sandstorms come far less often in the desert: one every eight to fourteen minutes instead of every two or three, a little shorter, never one straight after another, and none in your first minutes there.',
      numbers: [
        { title: 'Sandstorms in the desert, a simulated week of play', unit: 'an hour', better: 'lower', device: 'node, src/weather.js run for 7 × 24 h of play', rows: [
          { where: 'storms an hour', before: 22, after: 5.1 },
        ], source: 'tests/weather.test.js' },
      ] },
    // defeats on the ground (issue #304): src/enemies/defeat.js groundStart / groundDefeat / defeatHull / belowGround,
    // Foes.defeat and Foes.falling; the crab's arms limp (plans/walker.js), the jelly's threads and lanterns on the ground
    // (plans/floater.js), the ray's bank out as it lands (plans/glider.js, defeatPose); tests/foe-hit-defeat.test.js
    { text: 'Defeated creatures and machines go down on the ground instead of sinking into it: a crab flipped onto its back, a lizard or a toad rolled onto its side, a heron toppled off its stilts lie on the sand, on flat ground and on a slope. A crab’s pincers go limp, a jelly’s threads and lanterns settle on the ground and a ray lands flat. The mound worm still dives back under its sand.' },
    // the shield's strap on the skin (issue #303): src/blade-grip.js forearmWrap / wrapFrame / wrapLift, STRAP;
    // src/shield.js wrapStrap, bendDisc; tests/strap-skin.js; docs/systems/foes.md "The strap wraps the skin"
    { text: 'The guard’s leather strap now wraps tight round your forearm, following its shape as you walk, run and fight, instead of standing off it like a loose tube, and the folded brass flower sits down on its plate on the outside of your arm rather than floating over it.' },
    // the lore page in the Debug menu, What's new's ◀ Debug (issue #291): src/world-picker.js PAGES, changelog.html, lore.html
    { text: 'The Lore page is in the Debug menu’s Pages now, beside Cinematics, Items and Music, instead of in What’s new’s header; What’s new opened by itself has the same “◀ Debug” button back as the other pages.',
      see: 'Open Debug from the title: Pages → Lore. Open What’s new from the Debug menu: “◀ Debug” at the top left takes you back.' },
    // the gun starts in push (issue #307): src/fluid-kit.js DEFAULT_MODE / startMode, FluidTool.setMode keeps the choice (flag tool.mode)
    { text: 'The fluid gun starts in push mode when you first get it, and its lesson says so: the trigger pushes, the D-pad changes the mode. Whichever mode you pick after that is the one it holds the next time you play.',
      see: 'Open the Givers’ chest in the desert’s Hearth and take the gun in hand: the label under the crosshair reads PUSH. Change to ember, quit and come back: still ember.' },
    // every hint one look, one place (issue #306): src/hint-look.js, index.html --hint-*, src/ship/cinema.js layout (the cue
    // first in the stack), BridgeHud.cs; docs/systems/ui.md "Hints: one look, one place"
    { text: 'Every hint and announcement now looks the same and sits in the same place: a dark strip at the top of the screen. The lessons, what the scout finds, what the use button does and photo mode’s keys used to be cream at the bottom; now they head the same stack as the notices, quest cards and the objective. The prompt over a person keeps its place, in the same dark look.' },
    // the music page on a device (issue #318): src/music-store.js themeToListen, src/music-page/main.js
    { text: 'On Android and the Steam Deck the Music & sounds page plays every recorded song, not only the Desert’s and the title’s: it plays the copy the game has already downloaded, or downloads it there and then and keeps it for the worlds too.',
      see: 'On the Retroid, open Debug, Pages, Music & sounds and play any world’s recording: it plays (the first time, after a “Downloading…” line if the game had not fetched it yet).' },
    // each world its own score (issue #318): src/score.js SCORES (eight new, the Glass Dunes, under water, the Moon Foundry, Space City reworked; figure, swing, reg), src/score-voices.js; tests/score-distinct.test.js
    { text: 'Every world’s composed music is its own: the Mangrove, Salt Harbour, the Waterfall, the Forest of Antennas, the Eclipse, the Fallen Ring, the Underside and the Overnight Train played the Desert’s and now each has a score after its recording, and the Glass Dunes no longer play the Hangar’s. Several worlds have rhythms of their own too: a harp rolling in sixes, an analog arpeggio, a swung train piano, triplet drums.',
      numbers: [{ title: 'How far apart the two most alike scores are', unit: '', better: 'higher', device: 'scripts/score-features.mjs: tempo, metre, mode, instruments, density, register, rhythm, drums', rows: [{ where: 'two worlds off the route', before: 0.03, after: 2.66 }, { where: 'the Hangar and the Glass Dunes', before: 0.77, after: 5.3 }], source: 'node scripts/score-features.mjs (before: the scores at 29f2810d)' }],
      see: 'Walk a while in the Mangrove, then in the Overnight Train, with Settings, Music plays: Moments (the composed score plays between the recording’s moments): a handpan over low clarinet against a swung piano and brushes.' },
    // the lock's line of sight (issue #313): src/foes.js LOCK_SIGHT, lockSight, Foes.inSight / lockHid / seesYou;
    // docs/systems/foes.md "Only what you can see"
    { text: 'You can only lock on to a foe you can see: none behind a shut door, a gate or a wall. A locked foe that goes behind one lets go of the lock a moment later, and a foe behind a shut door no longer notices you or winds up a blow at you through it.',
      see: 'In a temple, stand at a shut door with a foe in the room beyond it and press R3 (Tab): nothing locks on. Open the door and it does.' },
    // the deadly pits' dark (issue #312): src/pit-void.js, every temple Pit (runtime.js; `own` for the Casting-House's
    // molten channel), the worlds under their kill height (main.js worldVoid); docs/systems/temples.md "A deadly pit looks it"
    { text: 'A pit that puts you back at the last mark now looks it: in every temple its walls sink into a deep ink as they go down, its floor, sand or water goes dark, and slow pale rings turn on it, so you can tell from the lip that there is nothing to land on. The Rose House’s sand pit no longer looks like a floor. Drops with a floor to land on look as they did, and in the City Floating in Space faint rings turn in the void under the islands.',
      see: 'In the Rose House, look down into the Dry Channel from the near ledge, and into the chasm of the Hall of Fires. In the City Floating in Space, look over a parapet.' },
    // three times as many fragments (issue #317): src/fragments-data.js slots 8–23, scripts/fragment-spots.mjs --count 24,
    // tests/fragments-poi.test.js POI_MIN; the prices kept (src/items.js); docs/systems/fragments.md "Three times as many"
    'There are three times as many fragments of the singing light: 24 hide in every world now, 288 in all, so one is never far as you explore, and half of them sit in or on the places worth reaching. Anselm’s upgrades cost what they did, and the ones you already found stay found.',
  ] },
  { v: '1.69', date: '2026-10-13', items: [
    // the night mail done at Solange's answer (issue #279): src/story/night-train-data.js, src/save-migrate.js step 27
    { text: 'The Night Mail is done the moment Solange hands you her answer on the last roof: nothing sends you back to report. Step off at the halt as before, and Edda reads the answer when you pass her lamp.',
      see: 'In the Signal Market, take Edda’s letter, ring the bell and give it to Solange on the last roof: the errand is done there. Step off at the halt and talk to Edda.' },
    // Marrow's question at the ship (issue #279, quest QC rule 5): src/story/desert-data.js wreck / hello
    { text: 'You ask Marrow about the singing on the sand when you meet him at your ship, or when you come back to him, instead of straight after he has told you about Qanat’s fire or the mark on your hull.',
      see: 'Start a new game and talk to Marrow at the ship: the singing is the third question, beside the way to power and the mark.' },
    // Marrow's splinter line hedged (issue #282, the dialogue review v1.66's finding 5): src/story/desert-data.js splinter
    { text: 'Marrow no longer explains the singing on the sand as if he knew: it is “something the light dropped when it passed, I’d say”.',
      see: 'In the desert, ask Marrow what’s singing out on the sand before you have picked it up.' },
    // the camera QC's run to run (issue #289): the shoulder's look ahead (src/player.js sideRoom, SIDE_SPRING), the lock's
    // arm in on the spring part open; the QC stepped 1/60 s (main.js window.__stepDt), ante-lock by points, three runs;
    // docs/systems/movement-and-camera.md "Run to run"
    { text: 'The camera stays steadier when you back into a corner locked on to a foe in a temple’s small room: by the doorway out of the Undertower’s antechamber it no longer swings over the traveller’s head or loses him off the screen, and the view over his shoulder no longer jerks as you pass the edge of a wall, a door or Qanat’s shop counter.',
      numbers: [
        { title: 'The camera’s roughness, the camera QC', unit: 'cm', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome, Medium, load 20–110', rows: [
          { where: 'the antechamber locked on (worst of three runs)', before: 3.97, after: 0.93 },
          { where: 'the Arena locked on (worst of the runs)', before: 1.64, after: 0.9 },
          { where: 'Qanat’s shop', before: 1.83, after: 0.69 },
        ], source: '.claude/skills/camera-qc/run.mjs; before on the browser’s frame times, after at the even step (limit 1.5 cm)' },
        { title: 'The antechamber locked on: frames with the traveller off the screen', unit: '%', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome, Medium', rows: [
          { where: 'worst of three runs', before: 6.1, after: 0 },
        ], source: '.claude/skills/camera-qc/run.mjs ante-lock' },
      ],
      see: 'In the Signal Market’s temple, lock on to a blot in the antechamber and back into the corner by the passage to the hall: the camera stays behind and above you, both of you in the frame.' },
    // the Hall of Channels' ball (issue #311): src/temples/desert.js WING, pieces.js Ball tar.short; tests/temple-playthrough.test.js
    { text: 'In the Rose House’s Hall of Channels, the burning ball you cut down the long groove after striking the high eye now reaches the far door’s bowl with flame to spare, instead of guttering out on the way. If it goes out while the fire half-way down is still under its lid, it says so.',
      see: 'In the Rose House, past the watcher, cut the ball at the Hall of Channels’ far end before striking the eye high on the end wall: it goes out and tells you about the lidded fire. Strike the eye, then cut the ball again from wherever it lies: it reaches the bowl by the far door burning.' },
    // the Footprint's stilling stone (issue #311, found by the temple play-through): src/temples/spheres.js POOL
    { text: 'In the Footprint’s Still Pool, the stilling stone sits at the ledge’s very edge, so a push from the middle of it reaches the floating sphere. Only its far rim used to; from the rest, the ledge took the push.',
      see: 'In the Footprint, stand in the middle of the stilling stone at the Still Pool and push the floating sphere: it crosses to its berth.' },
    // the first guardian made fair (issues #314, #316): src/temples/desert.js KEEPER, KEEPER_DARK; .claude/skills/combat-review/guardian.mjs
    { text: 'The Keeper of the cistern, the first guardian, fights fairer: a longer breath between its moves, lighter blows, its sweep swinging back at you only in its last phase, and an opening after every move. In its last phase it no longer keeps its mouth shut in the dark: it gasps a moment, open for a sip of water, and a burning ball rolled to it still makes it pant long and drink deep.',
      numbers: [
        { title: 'Openings a minute, dodging every blow', unit: '', better: 'higher', device: 'the fight’s own code in node, the Rose House’s cistern', rows: [
          { where: 'first phase', before: 7.3, after: 6.7 },
          { where: 'second phase', before: 8, after: 7.3 },
          { where: 'last phase', before: 0, after: 7.3 },
        ], source: '.claude/skills/combat-review/guardian.mjs, 90 s a phase, before and after this change' },
        { title: 'Hearts a minute standing still in front of it', unit: 'hearts', better: 'lower', device: 'the fight’s own code in node, the Rose House’s cistern', rows: [
          { where: 'first phase', before: 16.3, after: 0.5 },
          { where: 'second phase', before: 15, after: 3.3 },
          { where: 'last phase', before: 15, after: 1.5 },
        ], source: '.claude/skills/combat-review/guardian.mjs, a traveller who never moves, his health kept up' },
        { title: 'From one blow of its sweep to the next', unit: 's', better: 'higher', device: 'the fight’s own code in node', rows: [
          { where: 'shortest', before: 0.97, after: 1.42 },
        ], source: '.claude/skills/combat-review/guardian.mjs' },
      ],
      see: 'In the Rose House, wake the Keeper: dodge or guard a move and it pants after it; in its last phase, water it the moment it gasps, or roll a burning ball down to it.' },
    // its blows on its bones (issue #314): src/temples/boss.js Guardian.contact, src/characters/keeper-creature.js hitParts
    { text: 'The Keeper’s blows land where its body goes: its sweep is its head, lowered to your height and swung across; its stamp, its forefeet; its charge, its head and legs. Nothing reaches you metres away from it any more.',
      numbers: [
        { title: 'The farthest a blow landed from its body', unit: 'm', better: 'lower', device: 'the fight’s own code in node', rows: [
          { where: 'sweep', before: 13.7, after: 1.1 },
          { where: 'stamp', before: 6.1, after: 1.1 },
          { where: 'charge', before: 8.9, after: 1.1 },
        ], source: '.claude/skills/combat-review/guardian.mjs, its test against its posed mesh over the blow' },
      ],
      see: 'Turn the hitbox overlay on (F4) and watch the Keeper: its blows are spheres on its head and feet, orange as it winds up, red as they land.' },
    // the lock on its mouth (issue #314): src/foes.js GuardianLock.aim, src/lock-reticle.js, src/fluid-tool.js
    { text: 'Locked on the Keeper, you lock on its mouth, the one place water calms it: the ring sits round its head, and a shot from the gun goes into its mouth.',
      see: 'Lock on the Keeper (R3 / Tab), wait for it to pant and aim the gun: the shot goes into its open mouth.' },
    // its walk and its shadow (issue #315, #287): src/characters/keeper-creature.js KEEPER_GAIT, src/temples/boss.js GroundShadow
    { text: 'The Keeper walks on higher, quicker steps, its shell rising and rolling over them, turns on the spot by stepping its feet round instead of sliding them, and has a shadow under it on the cistern’s floor.',
      numbers: [
        { title: 'Its walk at the fight’s pace (2.2 m/s)', unit: 'm', better: 'higher', device: 'the skin’s walk in node', rows: [
          { where: 'a step’s lift', before: 0.26, after: 0.49 },
          { where: 'the shell’s rise and fall', before: 0.08, after: 0.17 },
        ], source: 'its six feet over 8 s, the fight’s own animate()' },
        { title: 'A foot dragged as it turns fast', unit: 'm', better: 'lower', device: 'the skin’s walk in node', rows: [
          { where: 'turning as fast as it may', before: 0.2, after: 0 },
        ], source: 'turning on the spot: before at 2.5 rad/s (it turned up to 15), after at its limit of 1.5' },
      ],
      see: 'In the Rose House, watch the Keeper walk and turn to face you across the cistern.' },
    // the sidestep (issue #314): src/player.js orbitLock
    { text: 'Locked on, stepping, hopping or dodging to the side carries you round the foe at the distance you stood, instead of drifting away from it.',
      numbers: [
        { title: 'Distance gained from the Keeper, locked on', unit: 'm', better: 'lower', device: 'Mac, headless Chrome, the Arena', rows: [
          { where: '2 s stepping right', before: 1.55, after: -0.04 },
          { where: 'a side hop', before: 1.6, after: 0.03 },
          { where: 'a dodge to the side', before: 0.65, after: -0.01 },
        ], source: 'the keys held in the game, frame by frame, before and after this change' },
      ],
      see: 'Lock on a foe and hold left or right, then jump or dodge with it held: you circle it.' },
    // a pivot that turns into a start (issue #288): src/feet.js (pivot steps out of reach, stepLead, pivotLand,
    // pivotStepSpeed, the hips' drop); the motion QC's world course (the last stop 1.8 s, the Arena's waves held off);
    // docs/systems/animation.md "Issue #288"
    { text: 'Turning round and setting off the other way from standing, the traveller steps round cleanly: his planted foot no longer drags along the ground behind him, and his feet no longer slide as they land during the turn.',
      numbers: [
        { title: 'A planted foot’s slip, the motion QC (the Signal Market’s street)', unit: 'cm', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome, Medium', rows: [
          { where: 'the worst held foot (two runs before, five after)', before: 6.2, after: '1.1–3.2' },
          { where: 'the worst step’s slide', before: '21.4–21.8', after: '8.8–10.9' },
        ], source: '.claude/skills/motion-qc/run.mjs --worlds bazaar (limits 2 cm held, 12 cm a step)' },
        { title: 'Turning round to walk off, on the test course', unit: 'cm', better: 'lower', device: 'node, the gait harness’s course', rows: [
          { where: 'the worst step’s slide', before: 19.5, after: 8.9 },
          { where: 'a held foot’s slip', before: 3.6, after: 0.9 },
          { where: 'pivots standing: the worst step', before: 14.0, after: 5.4 },
        ], source: 'scripts/motion-qc/run.mjs, diff.mjs (default way)' },
      ],
      see: 'In the Signal Market, stand facing the camera and push the stick away from you: he turns and walks off, his feet stepping round without sliding.' },
  ] },
  { v: '1.68', date: '2026-10-13', items: [
    'The traveller has a new lighter body: narrower shoulders and arms that rest closer to his sides, with the approved face, articulated fingers, a natural neck fit and an independently moving shirt. Walking, jogging, talking and sitting use the fitted rig, with closed inner clothing and hands that clear the shirt. The body review includes the full animation library and a default body for comparison.',
    // room behind every push-the-ball puzzle (issue #275): scripts/ball-room.mjs, tests/ball-room.test.js; the Aerie's
    // Eyrie stone off the gap's lip (STACK.groove), the balcony a metre deeper (BALCONY), the perch's stone in from its rim
    // (GULF.stone); docs/systems/temples.md "Room to push every ball"
    { text: 'More room round the stone balls you push in Vael’s Aerie: the Eyrie’s stone starts away from the wall and the gap’s edge, the high balcony over the Wind Well reaches a step further out with its stone further along, and the perch’s stone lies in from the rim. You can step behind each one without jumping over it or standing on the edge.',
      see: 'In the Aerie, walk round the ledge from the high balcony into the Eyrie: there is floor behind the stone between it and the wall, and a stride between it and the drop.' },
    // the balls that lay against a wall, a metre or so along their grooves (their drum's `start`); the Governor Room's groove
    // half a metre short of the parapet (src/temples/buried.js WING.groove); the Orb walk's second orb in from the lip
    { text: 'Balls that started pressed against a wall now start a stride along their grooves, with room behind them to push from: five in the Engine-House, and one each in the Clock-House, the Greenhouse, the Mooring-House and the Casting-House, and the second orb of the Orb walk in Lorn’s Deep Wood.',
      see: 'In the Engine-House’s Furnace, the two balls by the near lip: you can stand behind each and push it into its crank without squeezing against the wall.' },
    // the Aerie's gulf: its crossings one way (logic `oneWay`), the way back (GULF.way, room gulfWay; src/temples/logic.js
    // stranded, tests/way-back.test.js, every temple checked)
    { text: 'The Aerie’s gulf has a way back: on the higher ledge, a doorway in the east wall drops into a passage that runs back along the gulf and climbs to the near side. Crossing without the great key no longer leaves you stranded, and the great lock tells you where the way back is.',
      see: 'Cross the gulf on the wind before you have the Eyrie’s great key, walk up to the great lock, then take the doorway on the ledge’s east side.' },
    // temple keys in little makers' chests (issue #274: src/temples/pieces.js Key, KEY_CHEST; Sound.keyGet), the key
    // counter while in a temple (src/hud.js keysHud, index.html #keys, runtime.js keyCount; screen.keys for an engine),
    // a lock's soft click (Sound.keyTurn)
    { text: 'Temple keys now come in little chests, the same chest you find everywhere but smaller, on the floor where the key stood. Once its cage sinks, open it: the halves part with light pouring out, the key rises out of the light with a short bright chime, and it flies into your key counter.',
      see: 'In the Clock-House, win the Pendulum Hall or wake the Striking Room’s eye, then open the little chest whose cage has sunk.' },
    { text: 'Inside a temple a key counter sits at the top left, as in Zelda: a brass key and how many small keys you hold, with the great key beside it once it is yours. It counts up as a key comes out of its chest and down as one turns in a lock, which now clicks softly instead of clanking. Outside the temples it is gone.',
      see: 'In the Clock-House, take both small keys and walk up to the door over the climb: the counter goes from 2 to 1 to 0 as the keyholes fill.' },
    // quests given by people (issue #273): src/story/quests.js givenBy / giverMarks, the temples' locals (src/temples/index.js),
    // the boxes' quests theirs (src/boxes/index.js boxLine), the Map's giver marks (src/world-map.js), the ship's line
    // (src/story/signature.js GIVERS_LINE), old saves' worlds kept as they were (src/save-migrate.js step 26)
    { text: 'Arriving in a new world no longer fills your Quests page: people give you the quests. In each world the one who keeps watch by the makers’ temple comes first, and tells you of the temple and of the chests the makers left in the open; the others follow. Until you have talked to them, the ship marks them on your map: it hears the light’s pulse on the people who saw it pass. Going into a temple or opening a chest before anyone told you still counts. Worlds you had already been to stay as they were.',
      see: 'Land in a world you have not been to and open the menu: the Quests page is empty, and the Map marks one person with a gold ring by the makers’ temple. Talk to them: the temple’s quest and the chests’ appear, and the others who have something for you are marked.' },
    // the hosts in their own voices (issue #280; the dialogue review v1.66's findings 1 and 9): src/story/hosts-data.js
    { text: 'The people who offer the games and races in each world now talk like themselves: Yusra about this morning’s catch, Darro about the bike he keeps rebuilding, Ostra about cab fares, Tibor about his father’s goat. Each explains the rules in their own words.',
      see: 'In the desert, ask Yusra about fishing by the basin, or Nadir about the dune line; on the Buried Machine, ask Tibor about the canyon dive.' },
    // the dialogue review v1.66's small ones (issue #282): Anselm hedges (src/story/scientist-data.js), the lore page's
    // nights (src/lore-page/lore-text.js), the shops' exits without "Goodbye.", Liss, the market's old trader and Pim
    { text: 'Smaller touches to the writing: Anselm says what he thinks the fragments are rather than telling you, each world on the lore page names the night the light went over in its own people’s words, the shopkeepers’ farewells end on the reply alone, and Liss, the old trader in Signal Square and Pim in the Deep Wood have lines of their own instead of repeating others’.',
      see: 'In the Deep Wood ask Pim about anything strange; on the lore page, read the Underwater City’s and the Moon Foundry’s worlds; in any shop, the last answer of a talk.' },
    // the level design audit v1.66's ways (issue #278): the desert's gear step before the gift (src/story/desert-data.js,
    // desert-repay.js `ready`, DESERT_QUEST_V 6), Zahir over the hollow (PEOPLE.zahir, STORY.lookout), the silent tower's
    // mast (src/levels/bazaar.js MAST); docs/systems/worlds.md, progression.md
    'In the Desert, once the tree burns, the Rose House comes before Qanat’s gift: while the city fills its jars, Ama and Nour send you east for the Givers’ blade and guard, and the gift waits at your ship for the ride home, past the carved field-stone. The gift ends the quest now. If you already have the blade and guard, the gift follows the tree as before.',
    'Zahir, a boy of the camps, watches the dunes from the crest over Marrow’s hollow. On the way from the tree to the hoverbike you see him on the skyline by the red rag, and he points it out.',
    'The Signal Market’s silent tower has a mast on its roof, banded coral and cream with a coral lamp on top. From the landing it is the highest thing at the end of the avenue, so you see where the market leads over its towers.',
    // z-fighting, issue #286 (scripts/zfight/names.mjs names a merged mesh's pieces): the City Floating in Space 460 -> 22
    // (src/levels/eclipse-kit.js windows over one another Z_GAP out, the roofs' lips' feet in the roof; space-city-kit.js
    // TIER_DOWN, DECK_BURY, the bridges' parapets and collars), the market in the air's treads and the old market's stairs
    // (src/market-air.js, src/market-old.js), the canyon street's bridge, stairs and glass rails (src/underwater-canyon.js),
    // the furrows' banks over their beds, the hill's landings and the craters' top steps (spheres*.js), Vael's loggias
    { text: 'Fewer flickering stripes where two surfaces lay in one another. In the City Floating in Space, windows that overlap on a wall no longer flicker between lit and dark, and the low walls round the roofs, the pads and bridges laid onto the decks and the machinery under the islands stay still. Elsewhere: the treads of the stair up to the Signal Market’s market in the air and the old market’s stairs, the bridge onto the far terrace of the Underwater City’s canyon street and its glass rails, where the Garden of Spheres’ furrows run together, the landings of the hill’s stairs and the craters’ top steps, and Vael’s loggias.',
      see: 'In the City Floating in Space, walk from your ship toward the towers and turn the camera slowly past the houses: where two windows overlap, one sits in front of the other instead of the two striping into each other.' },
  ] },
  { v: '1.67', date: '2026-10-13', items: [
    // z-fighting found by the zfight audit (docs/audits/zfight-v1.66.md; issue #226): the city under the sand's walls under
    // its glass (src/glass-dunes-city.js), the water stair's lips off the walls' faces (src/viridel-stair.js LIP.gap), the
    // screen lanes' pictures off their screens (src/market-lanes.js MOTIF)
    { text: 'Fewer flickering stripes where two surfaces met flush: round the top of the walls of the city under the Glass Dunes’ sand, at the ends of the rounded lips of Viridel’s water stair, and on the pictures of the second-hand screens in the Signal Market’s lanes, seen from a few steps back.',
      see: 'In the Signal Market, walk into the screen lanes and step back from a wall of screens, turning the camera slowly: the bars, planets and faces on the screens stay still instead of striping.' },
    // the Unity build's GPU frame on the Retroid (issue #262): the GPU instances culled by the view (InstMats.Draw),
    // the depth prepass of every opaque on Android, the Surface shader's marks worked out only where drawn, one varying
    // fewer, the overwritten targets not loaded (docs/systems/performance.md "Unity on the Retroid: the GPU's frame")
    'The Unity preview on the Retroid runs faster where the picture was heavy: 45 frames a second where the Desert starts (40 before), 60 on the dunes (49), 41 at the City-Shaft’s start (37) and 28 over its wide view (23), and 41 to 60 in the Signal Market (38 to 54), with the same picture. It no longer draws the many small things out of view, and works out each surface’s marks only where they show.',
    'The Elder of Vael now has her new feathered body in the Aerie: natural wings, a centred neck, a closed beak at rest, small head movements as she walks and legs that tuck up in flight. She returns to the rooftop perch after you calm her, and the Arena uses the same bird.',
    // the traveller's nose side line on the mesh's own edge between the nose's front and its side wall (issue #276:
    // face-landmarks.mjs noseSide, bake-face-ink.mjs), the bridge's hatching with it, the line gone in profile (portrait-head.js side)
    'The line down the side of the traveller’s nose now follows his nose: it lies where the front of his nose turns into its shaded side, so from three-quarters and the side it runs along the edge of the shadow instead of down the middle of it, and a few strokes of hatching beside it shade the bridge as in his portrait. Seen right from the side it gives way to the nose’s outline.',
    // the design audits re-run on the updated skills (issue #226): docs/audits/quest-v1.66.md, dialogue-v1.66.md,
    // level-design-v1.66.md, temple-design-v1.66.md, cinematics-v1.66.md
    // the hosts of the trials and makers' runs, told what the run lacks (src/minigames/kit/hosts.js hostTalk `lacks`)
    { text: 'The hosts of the races and the makers’ runs no longer offer Play for a run you can’t do yet: they tell you what it wants (the hoverbike, the wings, a temple’s gadget) and to come back with it.',
      see: 'In the desert before the hoverbike, ask Nadir at the dune line’s sign: he says it wants the hoverbike, and the only answer is to come back with it.' },
    // answers that follow what was just said (the quest QC's rule 5): Thrum's meet.aboard, Ilen's light node
    { text: 'Two answers that now follow what was said: Anselm Thrum takes “Come aboard, then” as the invitation it is, and Ilen ends on her own answer before you ask “Your answer?”.',
      see: 'Pick up your first fragment and answer Anselm “Come aboard, then.”; at the Lantern, ask Ilen about the light on your hull.' },
    { text: 'Fitz at the shooting gallery tells the rule as it is: a miss, or a splashed parasol, breaks your streak, not your run. And the search for old Oum is now “Search the western dunes for old Oum”.',
      see: 'Ask Fitz about the shooting gallery in the Signal Market; ask Ama or the Speaker about the old woman who fell behind.' },
    // the dialogue review v1.66's fixes: the light brushed the ship (lore/continuity.md), bare "Good night" exits
    { text: 'In Viridel and the Buried Machine the traveller says the light brushed his ship, as it did, not that it struck it; and Vell, Edda and Solange’s goodbyes answer what was said instead of a bare “Good night”.',
      see: 'In Viridel tell Mira about the mark under the flowers; in the Buried Machine ask Hask about the mark on everything; on the night mail ask Solange about the chalk and read the last answer.' },
    // the cinematics QC v1.66 (docs/audits/cinematics-v1.66.md): Vael II's face shot (arzach2-moments.js clearSide), the
    // clock's cogs (glassdunes-moments.js cogShot), the ship's ground under a lens over a void (ship.js), the review page
    // staging a merged world's climax from its own part (src/cinematics-page/runtime.js)
    'When the bell rings under the cloud, the close-up of the traveller is filmed from the side away from the rope, so it no longer hangs across his face.',
    'The Glass Dunes’ clock moment has a fourth shot, low by a great cog turning in the sand, before his face.',
    'Landing in the City Floating in Space no longer flashes black frames as the ship comes down over the void.',
    'On the cinematics review page, the sky stones’ bell and the Deep Wood’s pools play their own scenes again instead of an empty stretch of sand.',
    // the Givers' guard redone to its turnaround: the sword's water as a disc (src/blade-shader.js BLADE_DISC, src/shield.js
    // shieldMaterial, Disc), strapped round the left forearm (src/blade-grip.js forearmMount, forearmFrame), the arm braced
    // across when raised (ShieldDevice.brace); docs/systems/foes.md "In the hands"; issue #284)
    { text: 'The Givers’ guard is redrawn after its design sheet. It is strapped round your left forearm now, a brass flower on a leather bracer, and raising it brings the arm across your chest like a real shield. Open, its six brass petals spread inside a riveted ring and the fluid floods out round them as a disc of the same living green water as your sword, swirling round the hub, with its pale lemon rim. Seen from behind you it stays see-through, so you still see what you are guarding against. The guard that rises out of its chest is the same.',
      see: 'Hold LB / L1 (Ctrl on the keyboard) and turn the camera round to the front: the swirling green disc on your forearm. Let go: it folds back to the brass flower on its strap. The guard’s chest in the Rose House shows the same.' },
    // the wings and the fluid gun's glove come out of their chests as before v1.66: only the sword and the guard were
    // to be the things in use (src/boxes/model.js wingsModel, src/gadgets/gun.js; issue #283)
    { text: 'The fluid wings and the fluid gun’s glove come out of their chests as they did before 1.66: the wings as three leaves of colour on a brass rod, the glove brown with its cream cuff. Only the Givers’ blade and guard rise as the ones you use.',
      see: 'Open the wings’ chest in Vael’s Aerie or the gun’s in the Givers’ Hearth, or look at them in the menu’s Items.' },
    // the light out of an opening chest (src/boxes/light.js ChestLight: washes over the picture, src/veil.js's rays;
    // its lamp and the linings' glow; references/Core Objects/Chests/light/; docs/systems/boxes.md; issue #285)
    { text: 'Chests open with real light now instead of little glassy shapes: a soft column of jade and gold rays pours up out of the chest as its halves part, the inside of it and the undersides of its halves glow, a few motes drift up in the beam, and the light falls on the traveller and the ground round him. It swells as the chest opens and settles as the item rises.',
      see: 'Open any chest: the star’s in the desert city, or the lift valve’s in the cave under the dunes.' },

  ] },
  { v: '1.66', date: '2026-10-13', items: [
    // the see-through surfaces in the Unity bridge: the rim's cut (_Veil), the washes on Hiraeth/Veil, the shafts' own
    // meshes drawn by nothing (engine/game.js veilsFrame, port-format.js, Veil.shader; docs/systems/engine-bridge.md
    // "See-through surfaces"; issue #263)
    'In the Unity preview, see-through things are see-through again: the City-Shaft’s air pillars are glass columns with their rings and the city behind them, not white pillars, the shafts of light are soft beams instead of solid white cones, and the Glass Dunes’ lenses and windows, Lorn II’s glassy mushrooms and the overnight train’s windows show what is behind them.',
    // the lore page (lore.html, src/lore-page/, scripts/lore-data.mjs; docs/systems/lore-page.md; issues #268, #269)
    { text: 'A lore page on the game’s site: the story of the singing light, the traveller, and every world on the way in order, with its people, its temples, the gadget inside each and how it calms or stops the guardian, and every item and where it is found. The ending waits behind a fold. Signed in to the notebook, every part has a Note button that files your comment as an issue.',
      see: 'Open Lore from the What changed page or the Notes page (hiraeth.alexandria-rnaud.workers.dev/lore). Press Note on any part, write a line and send it.' },
    // the Rose House's Keeper on its fitted Tripo skin, the procedural body until it loads (src/temples/guardian-generated.js,
    // src/characters/keeper-creature.js, creature-legs.js; the planner's fast gait, src/motion-kit/gait.js; docs/systems/
    // characters.md "The Keeper in the Rose House"; issue #267)
    'The Keeper of the cistern in the Rose House has its new body, drawn from its approved design: a ribbed shell on six long legs that walks one foot at a time and breaks into a trot of three legs at a time when it comes for you, rears on its hind legs to stamp and lowers its long neck to pant and drink. The glyphs on its shell still glow brighter as it calms, and the fight is the same as before. It is the one you spar with in the Arena too.',
    // the Elder's generated body, still a preview off the Aerie (src/characters/elder-creature.js; docs/systems/characters.md
    // "Elder generated guardian review"; issue #237)
    'The Elder’s new body, still a preview and not yet in the Aerie, is closer to ready: her head faces ahead instead of turned to one side, her legs bend cleanly without wobbling at the knees, and when she takes to the air she rises over a moment, folds her legs up under her and lets them down again to land.',
    // ladders climbed without stamina (level.ladders -> physics.ladders, physics.onLadder, player.updateClimb;
    // docs/systems/movement.md "Ladders are free"; issue #252)
    { text: 'Climbing a ladder no longer tires you: the Overnight Train’s ladders to the roof walk, the cage ladders up the Moon Foundry’s pillars and the rungs up the Signal Market’s antenna mast cost no stamina, and you can take hold of one even when winded. The train’s and the foundry’s ladders also climb all the way now: they used to let go at the first rung or hoop. Climbing a wall tires you as before.',
      see: 'On the Overnight Train, climb a porch ladder to the roof walk: the stamina wheel never shows. Then climb a carriage’s side wall: it shows and empties as before.' },

    // the Rose House's bellows' wind gone: the Givers' watcher, a sentry whose bolt the guard sends back (src/temples/pieces.js
    // Sentry, src/temples/desert.js sentry / dw, src/temples/migrate.js LAYOUTS.desert; docs/systems/temples.md; issue #245)
    { text: 'In the Rose House, the Givers’ guard no longer holds back a wind. Once you have it, a bronze watcher wakes by the far landing’s east door: its eye holds a narrowing beam on you, then fires a bolt. Raise your guard as it comes and the bolt flies back into its eye; the watcher breaks and the door opens onto the Hall of Channels. A save already past the old wind finds it broken.',
      see: 'In the Rose House, cross the bridge in the Hall of Fires and open the guard’s chest on the far landing. The watcher by the east door wakes; hold LB / L1 as its beam narrows.' },
    // every game in a world starts from its host (src/story/hosts-data.js, src/minigames/kit/hosts.js, src/story/index.js
    // host; docs/systems/minigames.md "The hosts"; issue #248)
    { text: 'The games, trials and makers’ runs out in the worlds no longer start from a bare sign. Someone of the place stands by each sign, tells you in a line or two what it is, in that world’s own story, and asks if you want to play: Play or Not now. A makers’ run’s post and the lagoon’s race buoy are read instead.',
      see: 'In the Desert, walk to the pilgrims’ small fire: Hamid stands by the drum circle’s sign. “Ask Hamid about the drum circle”, hear him out, then choose Play or Not now.' },
    // the pirates between worlds: no start card (the runner's def.direct), the controls as hints at the bottom right
    // (def.hints), missiles on LT / L2 (FLY.missile, MISSILE_POINTS), the pitch in Settings → Game once beaten
    // (src/minigames/pirates.js, pirates-rules.js, kit/runner.js, src/ui.js; docs/systems/minigames.md; issue #224)
    { text: 'The chime pirates no longer open on a start screen: after the take-off the fight counts in at once, its buttons shown small at the bottom right. Your ship carries four missiles too, on LT / L2 (F on the keyboard): each locks the pirate nearest your aim, marked with a teal diamond, and chases it down; a repair ring gives one back. Once you have beaten the pirates, which way pushing up flies is in Settings, under Game.',
      see: 'Fly to a world you have never visited: the pirates’ fight starts straight after the take-off, the controls at the bottom right with your missiles under them. Press LT / L2 (or F) with a raider in the teal diamond.' },
    // the reveals: what comes out of a chest is the thing in use: the held sword, the raised guard's face, the open wings, the worn
    // glove's colours (src/boxes/model.js buildItemModel, tickItem; src/fluid-sword.js, src/shield.js buildShieldFace,
    // src/fluid-kit.js, src/gadgets/gun.js; docs/systems/boxes.md "What comes out"; issue #242)
    'What comes out of a chest now looks like what you will use. The Givers’ blade rises as the broad blade of living fluid you swing, with its brass cup, wrapped grip, flowing currents and glow, not a thin green spike; the Givers’ guard comes out open, its brass petals and bright rim of fluid as when you raise it; the fluid wings open as they do over a glide; and the fluid gun’s glove is the dark one you wear, with its lavender band and its lights. Their pictures in the menu, and those of Anselm’s upgrades for them, match.',
    // the Map as wide as the page: its shape the page's box's (src/world-map.js mapAspect, mapBounds aspect, MapView.aspect;
    // src/game-menu.js mapBoxAspect, mapFit; src/game-menu.css; docs/systems/ui.md "As wide as the page"; issue #272)
    'The game menu’s Map fills its page now instead of sitting in a square with empty paper either side: it shows a wider stretch of the world, east and west of the places you know, on a desktop screen and on a handheld alike, with the compass, the scale bar and the zoom buttons in its corners.',
    // the fragments of the singing light in and on the places of interest (src/fragments-data.js, tests/fragments-reach.js
    // pointsOfInterest, scripts/fragment-spots.mjs --poi; save step 25; docs/systems/fragments.md; issue #250)
    { text: 'Many of the fragments of the singing light have moved into the places worth reaching: under the old ribcage’s ribs and between the vertebrae of another skeleton in the Desert’s western dunes, on the top of the white hill’s pyramid in the Garden of Spheres, by the breaker’s cairn 91 m up the Glass Dunes’ frozen wave, among the whale bones at the bottom of the Underwater City’s canyon, behind the Buried Machine’s oil fall, by the City-Shaft’s great mirror, on a cap of Viridel’s pyramid nursery and inside its split meteor. 31 moved in all; the two by your ship in the Desert stay. A fragment you had already found where one moved still counts.',
      see: 'In the Desert, find the old ribcage, the great bones arching out of the sand some 370 m from your ship, and step in under its ribs; in the Garden of Spheres, climb the white hill and its pyramid’s stair to the temple on top.' },
  ] },
  { v: '1.65', date: '2026-10-13', items: [
    // the screen while playing (docs/systems/ui.md): the gadget chip (src/gadgets/hud.js, issue #240), the talk prompt
    // (src/talk-prompt.js, issue #241), the notices and their pace (index.html #toast, src/notice-pace.js, issue #221),
    // the charge's card and the objective card (src/story/charge.js, src/ship/cinema.js, issue #222)
    'The gadget in your hands is a small picture in the top right corner now, nothing else: no name, no button, no count. A thin ring round it shows how much is left, and it pops with a gold ring when you change gadget.',
    'The prompt to talk to someone sits right beside them, just below the shoulder, instead of over their head; near the edge of the screen it moves to their other side.',
    'Hints and notices at the top are a dark strip with light letters, easy to read over the bright desert, narrower and one short line each. Teaching hints come at most every twenty seconds, the same words are not said twice in a row of minutes, a hint you have already acted on is dropped, and none come with Hints off. Every hint line and every world’s arrival words were cut down to fit.',
    'Your father’s charge is one line now, “Bring back something of value”, and no second objective card follows it as you step out of the ship. The objective card is one line too, and no card, tag or panel is drawn tilted any more.',
    // the menus: one music at a time (src/audio.js menuMusic, issue #243); the Map (src/world-map.js MapView,
    // src/game-menu.js mapPanel, issue #244)
    'In the pause menu and the game menu only the menu’s music plays; the world’s music comes back when you close it.',
    'The Map has no list under it any more: the left stick moves a cursor over the map, the triggers zoom in and out round it (the mouse wheel, − and + on a keyboard), and the mark under the cursor tells you what it is and how far. The other quests you are on show their marks too.',
    // one prompt at the tree's roots for the spark-stone, over Hessa's (src/story/desert.js: the roots' thing does it all,
    // its priority above talk while the stone is in your pack; the 'roots.stone' entry gone; issue #238)
    { text: 'Fixed: coming back to Qanat’s tree with the spark-stone, there are no longer two prompts in front of the roots, one of them the wrong one. There is one, and it sets the stone, even with Hessa sweeping right beside you.',
      see: 'In the Desert, bring the spark-stone back from the Givers’ Hearth and walk up to the bare roots on the avenue’s side of the tree: one prompt, “set the spark-stone in the roots”, wherever you stand round them.' },
    // the tree's lighting filmed: from the ground by him out to the whole tree over the city (src/story/desert-moments.js
    // lit, desert.moment.lit; docs/systems/cinematics.md "Moments"; issue #239)
    { text: 'Setting the spark-stone in Qanat’s roots is filmed now: the camera starts on the ground beside you as the stone goes in, rises after the spark climbing the trunk, then pulls far back and up until the whole tree stands over the city with its fire growing out of the crown. Skip it as any other.',
      see: 'In the Desert, bring the spark-stone back from the Givers’ Hearth and set it in the tree’s roots.' },
    // the desert's first two fragments by the landing, and Marrow's errand for the nearer (src/fragments-data.js slots 5
    // and 6, src/story/desert-data.js SPLINTER; docs/systems/fragments.md "The first two, easy"; issue #247)
    { text: 'The first fragments of the singing light are easy to find in the Desert: one sings on the open sand a short walk from your ship’s ramp, another on the low rise behind it. Ask Marrow what is singing out there and he points you to the first, a small errand of its own that ends when you take it.',
      see: 'Start a new game, step out of the ship and look ahead and to the right: a pale splinter singing on the sand about 40 m away. Or ask Marrow, “What’s that singing out on the sand?”' },
    // the wildlife keeps off the parked ship, its ramp and the ground round them (src/ship/ship.js keepsOff, src/wildlife.js
    // keepOff and a refused step taken back; docs/systems/living-world.md "Off the ship"; issue #246)
    { text: 'Fixed: the desert’s lizards, crabs and jerboas no longer wander onto your ship. None climbs the ramp, walks under the hull or ends up on it, even when you chase them past it.',
      see: 'In the Desert, stand by your ship’s ramp a while, or chase the creatures near it: they go round the ship, never onto it.' },
    // the hoverbike called from the pack, not whistled for (src/bike-worlds.js callKind, src/audio.js packCall,
    // src/fluid-tool.js signal; docs/systems/movement.md "Mounts come to you"; issue #249)
    { text: 'You no longer whistle for the hoverbike: your pack calls it. Press the same button and the tank’s rings blink one after another as the pack sends it a pulse, and far off you hear the bike’s engine answer as it comes. The bird and the cabs keep their calls.',
      see: 'In the Desert, once the hoverbike is awake, walk away from it and press D-pad ↓ (E on a keyboard): the rings on your tank blink, two soft notes, and the bike’s engine answers from far off.' },
    // the makers' chests open where they stand: no float, light pouring out of them, the item over his open hand, a
    // latch and a swell instead of a creak, and left open (src/boxes/scene.js, model.js buildShaft, index.js, src/player.js
    // offerHand, src/hands.js, src/audio.js boxLatch / boxOpen; docs/systems/boxes.md; issue #223)
    { text: 'The makers’ chests open where they stand: no more floating up. A brass latch clicks, the chest rocks on the ground, its halves part and light pours up out of it, and what it kept rises out of the light and comes to float just over your open hand. It opens with a soft swell instead of a creak, and stays there, open, once you have what was inside.',
      see: 'Open any makers’ chest: the first is on the dais at the foot of Qanat’s tree.' },
  ] },
  { v: '1.64', date: '2026-10-12', items: [
    // the Unity build's menus: the title, the Start menu and the game menu from the game's own menu state
    // (engine/menus.js, unity/Hiraeth BridgeMenu.cs; docs/systems/engine-bridge.md "The menus")
    'The Unity preview opens on the title screen now, as the game does: Continue or New game, your three saves (with the Debug list folded under them) and Settings. In a world, Menu opens the Start menu and View the game menu with its Quests, Map, Items, Worlds and People, moved through with the pad as in the game, and the world waits while they are open. It keeps where you stand in your save, and you start at the foot of your ship’s ramp instead of inside the ship.',
    // the Unity build on Android at Handheld, the lean surfaces and 0.75 of the screen by default (BridgeArgs.Quality,
    // BridgeRenderer.lean, BridgeRunner; docs/systems/performance.md "Unity on the Retroid")
    'On the Retroid and other Android handhelds the Unity preview starts at the Handheld graphics, as the game’s app does, draws its surfaces more simply and runs at up to the screen’s 60 frames a second instead of 30: 37 to 60 in the Desert, at the City-Shaft’s rim, in the Signal Market and in a temple, where it ran at 9 to 30 before. The Graphics setting in its menus is kept for the next start.',
    // the face's nose and mouth lines moved onto the mesh's own nose and mouth (scripts/tripo/face-landmarks.mjs,
    // bake-face-ink.mjs, portrait-head.js; docs/systems/characters.md "The face's ink"; issue #266)
    'The nose and mouth lines sit on the traveller’s features again: the mouth line lies where his lips part, from corner to corner, even as he smiles, frowns or talks, the nostrils and the hooks of the nose’s wings are on his nose’s base instead of floating on its tip, and the short stroke under his lower lip and the mark on his chin sit under the lip. Seen from the side or three-quarters, the nostril on the near side gives way behind the wing as a drawing would show it.',
    // the Unity build's prompts in the pad's own names, the Retroid's letters moved to positions (src/native-pad.js
    // setEnginePad, padLabels; engine/unity/game.js forPad; BridgeHost.Platform, PadName; issue #264)
    'In the Unity preview the buttons on screen are named as your controller prints them: on the Retroid A, B, L1, R1, Select and Start, with jump on the bottom button as in the game’s app and the menus confirming with A; on the Xbox and the Steam Deck the Xbox letters alone. Settings has Controller buttons, for a Retroid set to its own Xbox style.',
    // the Unity menus' Items panel: the items' pictures (public/item-pictures as PNGs, scripts/engine-bundle.mjs unityPictures;
    // BridgeMenu.cs DrawTile), as many tiles a row as fit (engine/menus.js itemGrid, BridgeHost.MenuWidth), the slots to find; issue #264
    'In the Unity preview the Items panel shows each item’s picture on its tile, as the game does, and in its full view; the tiles are larger, as many to a row as the screen holds, so their names no longer break in the middle on the Retroid, and the slots still to find are drawn after them.',
    // the Unity menus' Map with its ground: the world's collision sampled straight down a few ms a frame (src/world-map.js WorldMap
    // in engine/game.js), drawn by drawTerrain into engine/raster.js PixelCanvas, sent once (BridgeHost.MapImage, BridgeMenu.SetMap); issue #264
    'In the Unity preview the Map shows the ground under its marks, drawn as the game draws it: the bands of height, the contours, the cliffs and walls inked, the water in teal, with a scale bar. It is drawn the first time you open the Map in a world, in a moment.',
    // the Unity Start menu's What's new (engine/menus.js newsRows: src/changelog.js's newest versions) and the Controls page's
    // rebinding (controlsRows, rebind: src/remap.js capturePad, as src/ui.js rebindHtml; run and guard); issue #264
    'The Unity preview’s Start menu has What’s new, the newest versions’ changes as the game lists them, and its Controls page lets you move each verb to another button as the game’s does: choose a verb, press its new button (Menu keeps it as it was), with the ones that share a button marked, Run and Guard held or toggled, and Reset to defaults.',
    // the conversations' gestures in the engines: public/anim/gestures.glb attached to the clip library (engine/game.js,
    // src/motion-match.js attachMotion; -js-off gestures without), the traveller's locoMoves off (no moves.glb there); issues #197, #264
    'In the Unity preview the people you talk to move as they speak, as in the game: a talking hand, a shrug, a wave, a sad look away by the line’s tone, and a nod now and then while they listen.',
  ] },
  { v: '1.63', date: '2026-10-12', items: [
    // the Steam Deck's main thread: three's Skeleton.update from the bones' arrays, the frame's matrices from the
    // scene's list, the room culler's verdicts and the still batches' matrices kept (src/skeleton-update.js,
    // engine/scene-matrices.js, src/perf.js, src/static-batch.js; docs/systems/performance.md "The Steam Deck, round 8";
    // issue #111)
    'On the Steam Deck the game runs faster at its full 1280 × 800: about 52 frames a second where the Desert starts (46 before), 46 at the pilgrims’ camps (42) and 50 at the City-Shaft’s rim (47), with the same picture. Each frame does less work for the people’s skeletons and for where everything in the world stands.',
    // a still batch's new level of detail copied in before the frame's passes, not during one (src/static-batch.js
    // geometryFor later, addLater; issue #111)
    'Fixed: a group of buildings and rocks far off could vanish for a frame as their distant detail changed, most often in the City-Shaft just after arriving.',
    // the traveller's face inked from his approved portrait (src/characters/portrait-head.js PORTRAIT_FACE_INK,
    // scripts/tripo/bake-face-ink.mjs; docs/systems/characters.md "The face's ink"; issue #198)
    // one id, one person: the capstan man is Ewart ('ewart', was 'bram'), Hobb and Aldo off Pell's 'pell'
    // (src/levels/space-city.js, src/temples/bazaar-data.js, src/save-migrate.js step 24, tests/people-names.test.js; issue #251)
    'Fixed: meeting the man at the capstan in the City Floating in Space no longer counts as meeting Bram, who minds Lorn’s root cave: they shared a name. The capstan man is Ewart now. Likewise Hobb, who listens at the Undertower’s stones, and Aldo on the waterfall city’s balcony each count as themselves, not as the Desert’s Pell, and Hobb greets you as a stranger the first time.',
    'The traveller’s face is inked the way his portrait is drawn: a light line down the side of his nose, its wings and nostrils, a single stroke for the mouth and a short one under the lower lip, a few freckles on his cheek, and one clean line for his jaw with fine hatching on the throat in its shadow, over one flat skin colour. The lines thin out as he gets smaller on screen, so his face stays clean from afar and in the conversation portrait.',
    // the lock camera with his back to a wall (src/player.js LOCK_ROOM, CameraRig.lockRoom; src/main.js;
    // docs/systems/movement-and-camera.md "The lock camera with his back to a wall"; issue #256)
    'Locked on with your back to a wall, the camera no longer crushes up against you and loses you off the screen. It swings out to the side with room, or rises over your shoulder in a corner, and turns to keep you and the foe in the picture together; the stick still circles the foe as before. In a temple’s antechamber and a guardian’s hall you stay in view.',
    // the open camera looks past a thin thing between him and the lens (src/player.js THIN_PAST; issue #259)
    'Running across the open desert, the camera no longer jumps in to your back and out again as it swings past a cactus: it looks past a thin trunk or post between you and it, which may hide you for a moment instead.',
    // the foes' tells read again (combat-v1.61): the hound's pounce 0.8 -> 1.0 s with a coil and a snarl
    // (src/enemies/archetypes.js, src/enemies/plans/quadruped.js, src/foe-voices.js CUES; docs/systems/foes.md; issue #260)
    'The antler hound gives you longer to see its pounce coming: it crouches, then coils with its rump up and the smoke along its back standing on end, shivers and snarls before it leaps. It pounces a little less often too.',
    // the makers' machine's quake told and rewarded (src/foes.js FOES.machine: ground, opens, stuck, cue; onParry 'chip'; issue #261)
    'The makers’ machine in the temples is fairer to fight: the floor rumbles as it raises both arms for its ground slam, a jump clears the slam and its ring, and afterwards its claws stay stuck in the floor for a moment, when your cuts land double. A perfect parry of its one-armed swing knocks a plate off it.',
    // nine guardians' quickest move 1.0-1.1 -> 1.2 s (src/temples/*.js, src/telegraph.js WIND_MIN.guardian; issue #258)
    'Nine temple guardians give you a little longer to read their quickest move: the Elder’s peck, the Cloud-Mother’s roll, the First Sign’s stutter, the Tooth-Warden’s and the warden’s stomps, the Foreman’s jab, the Mother Snapper’s snap, the Lampless’s flutter and the Echo’s ripple now wind up as long as their other moves.',
    // six guardians' second phase asks for a second verb before the gadget (src/temples/boss.js asks, the six temples;
    // docs/systems/foes.md "A second verb"; issue #257)
    'Six temple guardians ask for more than their temple’s tool in their second phase. Guard the Cloud-Mother’s wing roll and the Clockwork Foreman’s hammer, push the Mother Snapper’s head as she rears to snap, splash the Gardener as it crouches to send its roots, and dodge the Lampless’s fluttering wings and the First Sign’s beam at the last moment: each then reels open for the bell, the stilling, the lantern, the bloom, the numerals or its word.',
    // a combo's links no longer advance a guardian's rotation (src/temples/boss.js begin)
    'Fixed: a temple guardian could repeat the same combo over and over and never use its other moves (the First Sign stuttering and crying without ever firing its beam). Each now goes through its moves in turn.',
    // the Xbox's Unity preview: the frame's commands handed to C# as a view, not a fresh ArrayBuffer a frame, which
    // Puerts held until the managed collector ran and V8 collected in full every ~190 frames (engine/unity/pack.js
    // takeView; docs/systems/performance.md "The City-Shaft's rim on the Xbox, round three"; issue #113)
    'The Unity preview on the Xbox no longer catches every three seconds at the City-Shaft’s rim: it holds about 60 frames a second there (58.6 before), and only about one frame in a hundred misses the screen’s refresh (one in forty before). The Desert is steadier too.',
  ] },
  { v: '1.62', date: '2026-10-12', items: [
    // Anselm sells his upgrades for fragments, a currency (src/fragment-shop.js, src/shop-panel.js, src/story/scientist*.js;
    // docs/systems/fragments.md "His shop"; issue #185), and is aboard in every world once met (tests/thrum-aboard.test.js)
    'Anselm Thrum sells his upgrades now: talk to him in your ship’s hold and choose from his seven, each for a price in fragments of the singing light, from 3 for the finder to 30 for the guard. The fragments you hold go down as you buy; the Worlds page still counts every one you found, and the Start menu says how many you have to spend. One for gear you don’t have yet says what it needs.',
    'A save with upgrades Anselm fitted at the old counts keeps them, and holds the fragments it found less their prices.',
    'Once you have met Anselm he is in your ship’s hold in every world, even if you walked off before his last words. While the ship flies in or takes off he stays out of sight inside it, instead of standing in the air where the hold had been.',
    // the game menu's Worlds page takes you back, and the Sketchbook's page is gone (src/fast-travel.js, src/game-menu.js;
    // docs/systems/ui.md; issue #213)
    'The Worlds page can take you back: open a world you have been to and press A / × on Travel here, and your ship flies you to its landing. If the ship won’t leave yet (the Desert without the blade and guard, Vael without the wings), it says why there.',
    'The Sketchbook page is gone from the game menu, which is Quests, Map, Items, Worlds and People now. Each world’s relics are still listed on the Worlds page, and delivered errands under People.',
    'The traveller has a new face and tousled hair that follow his portrait more closely, with continuous brows and grey strokes through the dark locks. Fine ink describes his shirt collar, cuffs and folds and the layers of his scarf, following the fabric as he moves.',
    // the Xbox's Unity preview at the City-Shaft's rim, round two (unity/Hiraeth BridgeCloth, engine/mirror.js stillMatrices,
    // engine/scene-matrices.js skipHidden, src/npc.js offView, the banners' shapeAttrs; docs/systems/performance.md "The
    // City-Shaft's rim on the Xbox, round two"; issue #113)
    'The Unity preview on the Xbox stutters far less at the City-Shaft’s rim: about one frame in thirty-five misses the screen’s refresh there, where one in eleven did. The traveller’s overshirt is worked out by several cores at once, the city’s banners no longer rebuild their whole shape every frame, and the people behind the camera and whatever is hidden cost the console less.',
    // the cab's top made by its triangles at the load, not by 5 429 rays the frame you first come near a cab
    // (src/taxi.js cabTopGrid, warmTop; docs/systems/performance.md "The City-Shaft's traversal stall"; issue #255)
    'Fixed: the City-Shaft froze for nearly a second on the handheld (a third of a second on a computer) the first time you came near a cab. The cabs’ shape you stand on is now worked out while the world loads, a hundred times faster.',
    // a start the ship covers goes to the foot of its ramp (src/ship/ship.js clearSpawn, tests/route-spawn.test.js; issue #254)
    'Fixed: starting the Desert from a debug save or the worlds list put you under your ship’s ramp, boxed in with the camera pressed over your head and unable to walk. You start at the foot of the ramp now, facing Qanat, the camera behind you.',
    // the lock camera's turn eased and a small foe kept clear near in (src/foes.js LOCK_TURN, lockTurn, LOCK_VIEW;
    // docs/systems/movement-and-camera.md, the lock camera; issue #236)
    'Locked on, the camera no longer whips round when you walk past the foe: it turns after it smoothly and stops on it. A small foe chasing you as you back away now stays clear of your back instead of hiding behind it.',
    // a hop with the foe at his feet read against the camera's look (src/jump.js hopAxis; docs/systems/foes.md; issue #236)
    'Locked on with a foe right at your feet, a ring centipede curled round you, stick back and jump is the back flip again instead of a plain jump, so the perfect dodge works against it.',
    // the desert's recording back in its slot, a new one made to match its new score (public/music/desert-bayati.mp3,
    // src/soundtracks.js, public/music/manifest.json; docs/systems/audio.md "The desert's music"; issue #207)
    'The Desert has a recorded theme again, a new one made to go with its new music: a slow oud with long, sliding notes over warm synthesizer pads, a low drone and the wind, and no drums. It plays as you step out of the ship and through your first minutes on the sand, indoors and at the big moments; in between, the quieter layers of the Desert’s own music carry on, and the two fade into each other.',
  ] },
  { v: '1.61', date: '2026-10-12', items: [
    // two blind legs guided and places off the way (src/levels/space-city-ways.js STAIR_LAMP, space-city-detours.js,
    // spheres-detours.js; docs/systems/worlds.md "Two blind legs guided, and places off the way"; issue #233)
    'In the City Floating in Space a tall lamp-mast now marks the head of the moorers’ stair off the Towers’ north edge, the way down to the great cable: it shows down the Towers’ lane and from across the void.',
    'The City Floating in Space has four new things to find off the way: a telescope at the Pier’s far rail, a sapling still in its carrying pot in the Garden, a coil of old cable up the stack on the high lanes, and a bench on the washing tier facing out at the stars.',
    'The Garden of Spheres has four new things to find out in the meadow: a cairn at the head of the yellow sphere’s furrow, a ring of small stones round the white monolith past the cracked moon, a fallen column before the empty arcade in the android wood, and a lantern left lit at the white stone north of the landing.',
    // the fragments of the singing light re-placed over the new country, off the route (src/fragments-data.js,
    // scripts/fragment-spots.mjs, tests/fragments-route.test.js; docs/systems/fragments.md; issue #228), and woven into
    // the story (src/story/scientist-data.js, lantern-data.js; docs/story-bible.md; issue #229)
    'Fragments of the singing light now hide in the places the newest explorations built: on a deck of Lorn’s keepers’ canopy 70 m up and on the egg isle in the drowned wood, at the top of the Floating city’s stack, across the Underwater City’s canyon bridge and out on the seabed, up the broken moon’s stair street, on Viridel’s old pyramid and the round ship’s hill, at the far end of Kip’s skybridge. None lies on the way anyone sends you any more. The fragments you have already found still count.',
    'The scientist who keeps the fragments in your hold is Anselm Thrum now, and the woman who minds the great cable’s clamp under the Floating city’s Towers is Tilde: their old names belonged to other people in the story. Anselm no longer introduces himself when you meet; he is too busy chasing the fragment.',
    'At the end of the journey someone knows the fragments for what they are, and says so, whether you found none, some or every one.',
    // the camera aboard climbs over the shoulder in the ship's tight spots, the bunk's and the hatch's points further in
    // (src/player.js CLIMB, src/ship/interior.js; docs/systems/movement-and-camera.md "Small rooms"; issue #234)
    'Aboard your ship the camera keeps its distance in the tight spots: in the cockpit, by the hatch and beside your bunk it rises over your shoulder and looks down into the room as you turn, instead of pressing into your back. When you wake you stand a step out from the bunk, with the room and the cockpit ahead of you.',
    // the desert's music reworked: ambient, an oud over electronics, no frame drum; its recording retired (src/score.js
    // SCORES.desert, src/score-voices.js lute; docs/systems/audio.md "The desert's music"; issue #207)
    'The Desert has new music, slower, quieter and more mysterious than before: a lone oud plays a few notes at a time and lets them ring into a long echo, over soft synthesizer pads, a low drone with the wind singing in it and, now and then, a shimmer of high notes. There are no drums any more: walking brings only a slow, soft pulse. The whole score plays as you arrive, indoors and at the big moments, and only its quiet layers in between.',
    // gestures while people talk, from Mixamo's captured conversation clips by each line's tone (src/talk-gesture.js,
    // public/anim/gestures.glb, scripts/mocap/build-gestures.mjs; docs/systems/characters.md "Gestures while people talk"; issue #197)
    'People talk with their whole upper body now. As someone says a line they move with it: a wave for hello or goodbye, a shake of the head at a no, a nod for a yes, a hand on the heart for thanks, arms thrown up in surprise, a fist when angry, a hung head when sad, a hand at the chin when curious, and their hands talking along the rest of the time. The traveller does it too when he speaks, and whoever is listening nods now and then.',
  ] },
  { v: '1.60', date: '2026-10-12', items: [
    // the temples to explore, round 4: the last three great keys out of the rooms off the last halls, each with a loop
    // back (src/temples/bazaar.js CHOIR, perdide2.js WICK, edena.js VAULT; docs/systems/temples.md "Round 4"; issue #23)
    'In the Undertower the Choir and its great key have moved beside the Shell Chamber, over the Cable Store. Its door, and a keepers’ gate high on the Cable Well’s wall, open when a horn back on the first hall’s far landing, at the end of the gate’s cable, hears the middle note. Inside, the near horn wants the high note, and only the Cable Well’s stone below the gate sings it.',
    'In the Lamp-House the Wick Room is off the Hall of Dark Pools now, open and dark when you first come in. The Kennel’s small key goes into the grille over the great key, and the grille lifts once both niches burn, so you bring the lantern back down for it. A stair and a keepers’ door take you back out onto the Root Stair’s root-wall. The Lamp Passage’s door needs only its lamp.',
    'In the Builders’ Greenhouse the Seed Vault is off the Shade House now: win the Shade House and a door in its north wall opens on the vault’s two seeds and its glass, long before you have bloom mode. Come back with it for the great key, and at the top of the vine a keepers’ door lets you out onto the Glass Stair’s root-wall, by the disc.',
    // loose ends from the v1.59 game audit (docs/audits/game-v1.59.md; issues #227, #230, #231, #232, #235)
    'The Saves screen shows your three saves and one small closed “Debug” row under them: the list of every world opens only when you choose it, and moving down the saves no longer runs on into it.',
    'The chime pirates come for your hull now, not your chimes: since beating them pays chimes, the ship says their wrecks are worth chimes when they break off.',
    'Your first fight with the chime pirates follows your jets setting: if pushing forward climbs on the jets, pushing up climbs there too.',
    'With Reduce motion on, or Camera shake at 0, a hit from the chime pirates no longer shakes the view or flashes the screen’s edges red; the hull’s pips under your ship still show it. The shake also follows the Camera shake slider.',
    'Sounds that come from a place follow the Effects slider, not the Music one: the makers’ hum near a chest, a fragment’s faint song and the Garden’s spheres go quiet with Effects at 0 and keep playing with Music at 0. The pole’s tune in the Garden stays with the music.',
    'The fragment finder no longer beeps while you talk to someone or have a menu open.',
    'The Desert’s main quest no longer ends while your ship still won’t leave: if you reach the ship before the Rose House, the ship wakes and the quest’s last step asks you to take the blade and guard from the Rose House. Vael’s main quest ends the same way on the fluid wings.',
    'Arriving in Viridel no longer sends you to ask the gardeners before you look at the old ship: the arrival card just says the garden has it.',
    'With Reduce motion on, the world map’s loading pen in the game menu no longer spins.',
  ] },
  { v: '1.59', date: '2026-10-12', items: [
    // the chime pirates reworked from the author's notes (src/minigames/pirates.js, pirates-rules.js; docs/systems/minigames.md
    // "Pirates between worlds"; issue #206)
    'The chime pirates count points now: each pirate you shoot down adds to your score, and when you win on the way to a new world the results turn your points into chimes, one chime for every 20 points, about as many as before.',
    'Losing a pip of hull to the chime pirates is hard to miss: the screen’s edges flare red, the view shakes, your ship sparks and blinks, a row of pips shows under it with the lost one bursting, the pip in the corner pops, and you hear the crunch.',
    'The chime pirates’ two aiming boxes are one sight: a ring with a small diamond further down the same line your shots fly. The ring tightens and turns coral when a pirate is in line, and flashes a mark when your shots hit.',
    'The first time you meet the chime pirates, pushing the stick up dives, as in a plane, and the start card no longer offers to swap it. Once you have beaten them, the card lets you choose.',
    'The pirates’ captain flies a gunship built for space instead of a sailing ship: gull wings with a brass turret on each tip, glowing engines, a skull and crossbones on its prow, and its bridge behind armour shutters.',
    // roomier rooms and a steadier camera in them (src/temples/kit.js ANTE, src/ship/hull.js, interior.js, src/player.js
    // ROOM_FIT; docs/systems/movement-and-camera.md "Small rooms"; issue #195)
    'The rooms before each temple’s guardian are much bigger: wider, deeper and higher, so the camera has room behind you there instead of pressing into your back. The Mooring-House’s way to the Capstan Floor is wider and taller too.',
    'Your ship is roomier inside: wider rooms, a higher ceiling, wider doorways, a longer cockpit and back room, a deeper bunk alcove and a bigger hold, where Orrin keeps his jar by the crates. The hull outside grew to fit.',
    'In small rooms the camera settles: turning round, it keeps one steady distance instead of pushing in at every wall and back out at every gap, and it no longer creeps in and out by a few centimetres.',
    'Two of the Rose House’s glyph stones bring you back facing into the room, not against a wall.',
    'The Elder of Vael has an unfinished animated guardian preview with walking, wingbeats and attacks. Her face stays turned, her leg joints wobble, and her hovering legs still need to fold up like a bird; these and further motion fixes remain before temple use.',
    { text: 'The Cistern-Keeper has an experimental animation preview: its six legs now step separately with softer footfalls and smoother attack recovery. Its mouth stays closed at rest and opens for feeding and attacks.' },
    // distant shimmer (src/post.js INK_FAR, src/pipeline.js createSmaa, src/perf.js handheld `aa`; docs/systems/rendering.md
    // "Far lines that would alias"; issue #225, from #218)
    'On handhelds and phones, far-off towns, facades and forests no longer shimmer as you look round: lines on detail too small to draw at that distance are inked lighter, and the picture’s edges are smoothed more sharply.',
    // three of the explorations polished against their sheets (issues #188, #189, #190; docs/systems/worlds.md)
    'Lorn’s crystal roots now lie under the water instead of painted on it: soft-edged veins of violet and teal crystal seen through the surface, tapering into thinner twigs, fainter the deeper they run, with light flowing along them toward the Great Crystal.',
    'Viridel’s water stair looks like a gardeners’ stair now, not a fortress: warm white stone in big blocks with rounded lips, terraces that step in and out, water spilling over the edges, ferns hanging down the walls and cypresses on the terraces.',
    'The Garden’s lake shows its lost town wherever you stand: domes, towers and stepped pyramids reflected all round the water, shimmering, seen from the stepping stones and from both shores.',
    // the Xbox's Unity preview at the City-Shaft's rim (unity/Hiraeth HiraethShadows CullFor, InstMats, BridgeShadowChunks,
    // BridgeRunner -v8; docs/systems/performance.md "The City-Shaft's rim on the Xbox"; issue #113)
    'The Unity preview on the Xbox holds close to 60 frames a second at the City-Shaft’s rim, where it ran at about 45: the sun’s shadows are only drawn for what can cast them into your view, and the script runs a little faster. The picture is the same.',
    // the darkest tone only in real pockets, and no copies of the traveller in it or in the dust at walls' feet
    // the dust band at a wall's foot looks past a person on its probe (src/post.js DUST_PAST)
    'The darker dust band along the foot of weathered walls no longer leaves a pale outline of you, or of anyone standing in front of it, that followed you along the wall.',
    // the spot blacks only in real pockets (src/post.js SPOT_POCKET, spotShare; docs/systems/rendering.md "Spot blacks only in pockets")
    'The deepest darks stay in real pockets now, under balconies and eaves, between ribs, in alleys: the near-black band along the foot of every wall, every stair and the bones in the giant’s cave is gone, and with it the blotches that slid and jumped about there as the camera moved, and the dark copy of you that appeared on the ground beside a wall’s end.',
  ] },
  { v: '1.58', date: '2026-10-12', items: [
    // the ragdoll obeys the ground's slope (src/ragdoll.js; docs/systems/movement-and-camera.md; issue #214)
    'A knockdown now follows the ground: thrown against a cliff or a steep slope, the limp body stops at its foot and lies there, instead of sliding up the rock with the speed it had. The same for anyone knocked over.',
    // the mantle in two (src/player.js MANTLE; docs/systems/movement.md; issue #215)
    'Climbing onto a ledge now goes the way a body does it: hands on the edge, hauled up, a knee onto the top, then up on your feet and a step in. Push on as you get up and you are up sooner.',
    // the Aerie's hall: the lee of anything solid (src/temples/pieces.js Gust lee; docs/systems/temples.md; issue #216)
    'In the Aerie’s Hall of Winds anything solid between you and the wind now shelters you: a screen, the far wall, the stone. The pale streaks stop in its lee, so you can see where the wind can’t reach.',
    'The glyph stone by each temple’s door and in its rooms holds your place: walk up to it and its glyph flares, and after a fall you come back to it. The first one you wake says so.',
    // the needle walker plants itself first (src/wildlife/species.js needlePose; docs/systems/procedural-animation.md; issue #209)
    'Vael’s needle walkers no longer turn into a needle in mid-air: one walks on a few steps, sets its tail’s tip down on the ground, and only then stands up on it, on a slope too.',
    // the galactic map's scanner starts by the ship and must be swept first (src/story/signature-search.js scanStart,
    // searchArmed; src/ship/starmap.js; issue #204)
    'Opening the galactic map no longer finds a planet by itself: the scanner starts by the ship, clear of every uncharted region, and nothing locks until you have swept it a little, with the stick, the keys, the mouse or a finger.',
    // the Start menu's sidebar and its page (src/menu-pad.js sideStep, src/controller.js menuNavigate; issue #210)
    'In the Start menu, right now goes from the sidebar into the page it shows and left comes back; up and down go round the sidebar (from Resume up to Quit to title) and round the page. Dropdowns there open with A / × first, sliders still slide, and B / ○ steps back to the sidebar before it closes. The arrow keys move the same way.',
    // the game menu reworked (src/game-menu.js, src/game-menu.css; docs/systems/ui.md "The game menu"; issues #213, #212)
    'The game menu (View / Select) opens on your Quests now. Its items are large tiles with their names under them: press A / × on one to see it full screen, its picture large and what it is and does beside it, never over it, and use it from there (take a gun mode, take a gadget in hand, switch the fragment finder on or off). Left and right show the one before and after, B / ○ goes back.',
    'The strip at the bottom of the game menu only names what you have picked and says what A / × does: the words are in the full view now. Keepsakes, sketches, sightings and finished quests open full screen with A / × too.',
    'The Worlds page lists one world a row, so up and down go between them. A / × on one shows what you have found there and what is still to find: the story, each relic by name (a ? for the ones still hidden), the makers’ boxes, the fragments once you have found one, and the people you met.',
    // the map of the world you are in (src/world-map.js, the game menu's Map; docs/systems/ui.md "The Map"; issue #205)
    'A map of the world you are in, in the game menu right after Quests (one RB / R1 from where it opens) and in the Start menu: the ground drawn from above in ink and paper, with you and the way you face, your ship, the way on, the makers’ temples, the people you have met and the boxes you have opened. Pick one in the legend beside it to ring it on the map, and press A / × to zoom in on it.',
    // the debug saves in the title's Saves screen (src/title.js debugSavesHtml, src/debug-save.js; docs/systems/dev-tools.md
    // "The debug save"; issue #203)
    'For playtesting, the Saves screen has a debug section: start at any world of the route in a new save, with everything in the worlds before it done and held, their quests, items, gadgets, keepsakes, trials’ rewards, fragments and Orrin’s upgrades. It goes into its own debug save, or into one of your saves if you choose one (asked first if it holds a save).',
  ] },
  { v: '1.57', date: '2026-10-12', items: [
    // the Moon Foundry's picked explorations, one way through the world (src/foundry-street.js, src/foundry-cranes.js,
    // src/foundry-pour.js; docs/systems/worlds.md "The Moon Foundry: inside the moons, the cranes and the night pour"; issue #193)
    'In the Moon Foundry the broken moon’s courtyard is only the start: a stair street climbs its inner curve, landing by landing, a little house with an orange door on each, pots and washing lines, round crater windows in the shell looking down over the whole floor. From its top a hanging bridge leads to a spiral stair under the crown, and up through a round hatch onto a deck on the moon’s crown, 62 m up.',
    'The Moon Foundry’s cranes still work: two travelling cranes carry moons up and down the hall on their own timetable, cabs lit, shadows sliding over the floor, and at dusk both take their moons to the Casting-House. From the broken moon’s crown a high walk leads to the old hoist’s signal box, levers and a moon dial and a stove; from its door a small moon on chains carries you down to the lookout on the pillar. Pull the lever, or the bell-cord at the lookout, to call it. Hedda now sends you to the signal box to look at the moons.',
    'The Moon Foundry’s floor has runnels now, cut into the slabs and all leading back to the Casting-House: dry lanes you can walk down into by day, with steps here and there, and after dark full of glowing molten metal that lights the floor round it. At night cross them by the iron footbridges and the plates over the aisle; step down into one and it burns. One ends at Hedda’s mould, one at Bertil’s furnace, one at a cracked mould by the bowl garden.',
    // the City Floating in Space's three picked explorations, one way to the Mooring-House (src/levels/space-city-ways.js,
    // docs/systems/worlds.md "The City Floating in Space: under the islands, the drifting bridges, the stacked quarters"; issue #194)
    'In the City Floating in Space the cables are felt where they are anchored now, under the Towers: a stair winds down off the Towers’ north edge to a catwalk hung under the deck among the machinery, workshops with lit round windows, gardens hanging upside down into the dark and lamps pointing down at the stars. Odile minds the great cable’s bronze clamp there, and a walkway runs out along the cable over the void to the stack.',
    'Between the Towers and the Moorings now stands the stack: seven small islands one over another, from under the Towers’ deck to 80 m over it, houses round every one and more built down their sides, stairs winding round the outside from each to the next. The way to the Mooring-House goes up it, the way home down its other side and over the patched stack bridge, and its top, with its lamp, is the city’s other high place.',
    'The islands’ drift shows on the bridges now: the Moorings bridge is gone, and the bridge from the stack to the Moorings is broken, its middle span drifted out of line on its cable. Turn the moorers’ capstan beside it (A / ×) and the span swings home and the bridge is whole. Past it an old bridge hangs in two halves, and a lamp chain hangs from the stack’s roots far down into the void.',
    // the dialogue review v1.57's rewrite, across every world (docs/audits/dialogue-v1.57.md; issue #202)
    'People across every world now start talking in the middle of what they are doing, instead of opening with their name and their trade, and the two reed-cutters of Lorn and the two walkers of the Garden of Spheres no longer sound alike.',
    'When a conversation ends, your last answer now replies to what was just said, or is a nod or a laugh with the quiet people of Vael, instead of a plain “Goodbye”. Back from a makers’ house, you tell its neighbour what you saw in there rather than explaining their guardian to them, and each of them asks about your visit in their own way.',
    'More of your answers are remembered: tell Marrow to stay away from your ship, tell Cael the avenue was short or Nima that you only looked, say nothing to Madame Sel under her tower, and they bring it up later. Hask, Mother Ysolde, Bastien, Hedda, Rosa and Halden remember what you told them too.',
    'Shorter overheard lines in the desert, the City-Shaft, the Signal Market and the Garden, and every people names the night the light went over in its own words again.',
    // the conversation box simpler again (index.html #dialogue .dlg-tag, src/story/dialogue.js; issues #208, #211)
    'The conversation box is simpler again: the speaker’s name is written plainly in ink on the paper, upright, with no black caption box behind it and no description beside it.',
    'When someone has finished talking, the first answer is already picked, with a keyboard, a mouse or a touch screen as with a pad: press A / × (or E, Enter) to say it, or move to another. It stays picked when one answer leads straight to more.',
    // the hoverbike drawn where it is while ridden (src/matrix-cache.js updateWorldMatrixCached; issue #184)
    'The hoverbike shows under you again while you ride it: it had stayed behind where you got on, so you seemed to ride on nothing.',
    // the mineral basin seated in the crust (src/desert-vistas.js BASIN_CUT, BASIN_RIM; issue #200)
    'The pond under the desert’s lavender cliffs now lies down in the ground instead of on it: its water sits below the crust round it, along a shore of wet and damp sand with a lip of pale salt stones, and you can still wade across it.',
    // the core gadgets: the ship waits for them (src/story/leave-gate.js; issue #217)
    'Your ship won’t leave the desert now until you have the Givers’ blade and guard from the Rose House: it says where they are, and the Rose House goes into your quests if it wasn’t there. Vael waits the same way for the fluid wings from the Aerie.',
  ] },
  { v: '1.56', date: '2026-10-12', items: [
    // Lorn's route through the author's three picks (src/lorn-veins.js, src/lorn-flood.js, src/lorn-canopy.js,
    // docs/systems/worlds.md "Lorn: one route through the roots, the drowned wood and the keepers' canopy"; issue #188)
    'In Lorn the Great Crystal’s roots now show under the swamp: veins of violet crystal with a teal light running along them toward it, branching across the water like the veins of a leaf. One runs beside the keepers’ stakes over the open water and on into the wood, and where veins meet, a cluster of crystal breaks the water and rings as you pass.',
    'Lorn’s crossing now ends in a drowned forest: dark trunks rise out of the open water, a few at first and then closer and closer, on roots arching into it, pale trumpet fungi up their sides, and the stakes lead in under two great arches of roots. Off the lit path, the skiff finds three flooded clearings with light falling into them: a moss isle heaped with glowing eggs, a heron on her nest on a broken trunk, and a moss dome half under the water.',
    'Up in Lorn’s Deep Wood, over the second dark pool, stands the lamp-keepers’ old village: a stair winds up a great trunk from the lit path to decks 70 m up, with domed huts, hanging lamp-houses and rope bridges over the path to a giant mushroom’s cap. From the winch on its jetty you can let the keepers’ lamp down into the dark pool to light it, and a second stair climbs the tallest trunk to a lookout where the Great Crystal glows far off over the wood.',
    // the Signal Market's three picked explorations, one way through the world (src/market-air.js, src/market-old.js,
    // src/market-lanes.js, docs/systems/worlds.md "The Signal Market's explorations"; issue #191)
    'In the Signal Market the market climbs the towers now: from beside Madame Sel a stair goes up between two stalls to a gallery of lantern sellers 10 m over the street, another climbs to the sign painters’ gallery at 25 m, which runs on to Kip’s skybridge, and a third to the antenna sellers at 44 m. From its end a basket on a cable carries you over the square onto the silent tower’s cream balcony: stand still in it. Behind the antenna sellers a mast climbs to a deck at 60 m and a crow’s nest at 76 m.',
    'Under the Signal Market’s avenue lies the old market, its first street: a stair goes down out of Signal Square in front of the silent tower, and daylight falls in stripes through brass grilles in the paving onto older, fuller stalls under stone arches, a long painted sign over the crossing and the first stall, where an answer was first sold. Madame Sel sends you home that way now.',
    'From the old market a passage and a stair come up behind the east towers into the screen lanes: narrow lanes walled with stacked second-hand screens, each lit with its own picture, dead ends, the screen-mender at his bench and the biggest set in the lanes. A white picture of the market’s mark runs from screen to screen ahead of you, toward the square before the tower speaks and toward your ship after; once it has spoken, every screen in the lanes shows the same face.',
    // the Garden of Spheres' picked explorations, one way through the world (docs/systems/worlds.md "The Garden's
    // explorations"; issue #190)
    'In the Garden of Spheres a causeway of white stepping stones now crosses the mirror lake from Nell’s shore to the far one, and the water shows a garden that isn’t there: white domes, towers and stepped pyramids reflected on shores that are only grass. Once the pearl by the lake has rung its bell, the spheres hang in the lake’s sky again round the middle stone.',
    'Every great sphere in the Garden now lies at the end of the long furrow it ploughed when it fell, rows of cypresses along them, all pointing back to the great sphere on the horizon: see them from the belvedere. Past the lake, a sphere that cracked open on landing lies in a crater of white terraces: go down and in through the crack to hear its last sound from inside, and find the mark of the ones who made it. The sphere west of the arch lies in a crater too, its far voices louder the lower you go.',
    'From the cracked sphere’s crater the way to the plaza now climbs into a forest of tall white pillars: up a spiral stair, along narrow walkways from top to top past spheres set in stone cups, and down another stair near the plaza. Splash a sphere up there and its note runs down the walkways to the lower ones; from the highest, all six ring together. Linnet sends you this way now; the avenue is still there below.',
    // the Underwater City's three picked explorations, one way through the city (src/underwater-seabed.js,
    // src/underwater-canyon.js, src/underwater-song.js, docs/systems/worlds.md "The Underwater City's explorations"; issue #192)
    'In the Underwater City you can go outside now: take a brass helmet off the divers’ rack in the Dock and step out through the divers’ lock onto the sea floor. Out there your air runs down and the air bells on their posts give it back; follow them past the door at the foot of a tower of pods and a cart sunk in the sand to the edge of a canyon, while a whale glides overhead. You never swim: you walk the sea floor in heavy boots, and a fall only sinks you slowly down.',
    'The city goes down the drop now: where the bells end, a street of terraces steps down the side of a deep canyon, a storey at a time, past café domes and lamps that get fewer as you go, to the Whale Gallery on its shelf at the bottom. Towers of lit pods rise out of the dark on both walls, a white arched bridge crosses to a café on the far wall, a cable car goes back and forth, whales swim in the deep below, and the divers’ cage takes you down to the canyon’s floor.',
    'The city was built to sing to the whales, and now you can see it is out of tune: brass horns open from the domes, organ pipes crown the Plaza and the Avenue, and in the Gallery, the Plaza and the Crown a great pipe rises out through the glass, the rings in the water from its horn crossing and breaking. Turn each pipe’s stop wheel and it plays in tune; tune all three on your way to the Whale-House. Bastien now sends you out by the lock, and Brune’s cutting is an errand of its own.',
  ] },
  { v: '1.55', date: '2026-10-12', items: [
    // the fragments of the singing light, the scientist and his upgrades (src/fragments.js, src/story/scientist.js,
    // docs/systems/fragments.md; issue #196)
    'Fragments of the singing light are hidden in every world on the route, eight in each: up on ledges and high places, behind things, at the ends of side paths, never on the way anyone sends you. Each is a small pale splinter that glows and sings faintly when you come near; walk into it to take it.',
    'The first fragment you take brings Orrin Thrum, a scientist who has been on the lookout for them since the night the light went over. He moves into your ship’s hold, keeps what you bring him in a jar on his crate, and tells you how many you have and how many still hide in each world.',
    'At 5, 10, 15, 25, 50, 75 and all 96 fragments, Orrin fits something to your gear: one more heart (four to start instead of three), a finder, a blade that cuts half as hard again, one more unit of magic, wings that glide a fifth faster and sink slower, boots that run longer and rest quicker, and a guard that blocks for half the magic.',
    'At ten fragments Orrin gives you his finder: it beeps when a fragment is within 60 m, faster and higher the closer you get. Switch it off or on from your items (A / × on it).',
    'The game menu’s Worlds page counts your fragments of the singing light: all told, and how many are left in each world you know. The Start menu says it too, under where you are: how many you have and how many are left in this world.',
    // the glide from the palace's crown to Lio (src/shaft-ways.js dispatchMast; issue #201)
    'In the City-Shaft, Lio’s dispatch mast now rises behind him on the rim: a tall cream mast banded in his teal, his booth at the top with a lit window band, two cabs docked at its arms and his call-lamp over it, so from the palace’s crown you can see where to glide to find him. He sends every cab in the city from it.',
    // Vael's picked explorations, one way through the world (docs/systems/worlds.md "Vael's explorations"; issue #187)
    'In Vael the walk from the white house to the lone tower now goes down the riders’ old road: worn steps beside the riders’ shrine lead down into the plain between sheer red walls, past niches, faded streamers and great stone ears. Whisper into an ear and the whisper runs on ahead of you round the bends. The tower is lost from sight down there, until the road ends at its foot and it rises straight up out of a deep pit.',
    'The needles round Vael’s lone tower now stand in three rings on a level plain, a sundial with the tower as its pointer, an hour stone at each needle of the outer ring. Once you have the wings, the tower’s long shadow lies across the plain back toward the white house; once the bird has answered, the sun swings round and the shadow points the way to the riders’ gate; once the bell has rung, toward your ship. The hour stone it falls on lights its lamp.',
    'Past the riders’ gate the plain is breaking up at its edge: cracks, slabs tipped out of the sand, then stones of the plain hanging over the cloud, each a leap above the last, out to a highest stone with a rider’s rope on it and the whole plain behind you. Three of them rise slowly while you stand still on them, up to the next.',
    // Viridel's three explorations, one way up to the Greenhouse (src/viridel-wrecks.js, src/viridel-nursery.js,
    // src/viridel-stair.js, src/viridel-ways.js buildGreenhouseWater; issue #189)
    'In Viridel, Odile and Talo’s ship is not the only thing the garden has kept. Between it and the Greenhouse lie an old round ship under a hill of flowers, a tree growing out of its top and its hatch ajar onto a lit cabin; a great dish turned pond; a meteor split open with a garden inside; and a builders’ machine on its side, its flank grown into terraces to climb. From the tallest tree’s crown the walls close all the way round: the valley is a crater.',
    'Viridel’s pyramids are grown now, not scattered: in rows by age along the walk to the Greenhouse, from knee-high seedlings in their beds to sprouts, sheds you walk up, houses in vine scaffolds and three great ones with trees on their terraces, white androids tending them. At the rows’ end stands the old one, 44 m; climb its steep stair and the rows draw the builders’ mark across the meadow.',
    'The Builders’ Greenhouse now stands on a hill, up a water stair of white terraces in flower, a channel falling from bed to bed, and a white channel of water leads you there from the fallen ship. Three of its flights end at a sluice-gate: turn the wheel and the board lifts, the water pours down and the bed below floods and blooms over its stepping stones.',
  ] },
  { v: '1.54', date: '2026-10-12', items: [
    // the father's window recording back to the bust (reverts e7d5052e, the walking full body; the author's call)
    'Your father is a bust again in the ship’s recordings, as he is in his calls: the walking, full-length figure at the window is gone.',
    // the City Floating in Space's hanging pipes held steady (src/levels/space-city-kit.js HANG_PX, src/thin.js; issue #171)
    'In the City Floating in Space, the pipes and cables hanging under the islands no longer flicker on small screens: on handhelds and phones they stay steady thin lines as you turn, instead of breaking into pixels that come and go.',
    // foes heard from where they are (src/audio.js foeEar / foeSpot, docs/systems/audio.md "Placed in space"; issue #176)
    'A foe’s warning as it winds up a strike, and its cry when you cut it, now come from where it is: from the left or the right, softer farther off but never too faint to hear across a fight, a little duller from behind you, and a warning from a foe you can’t see a touch louder, so you can turn to meet it.',
    // the last "Tell X" steps after the goal (src/save-migrate.js step 20; issue #172)
    { text: 'Ten more errands end where you do the thing, without sending you back to tell someone: Viridel’s scorch under the flowers, Esk’s cutting, the tallest tree’s crown, the market’s oldest sign, Ket’s three gauges, the halfway mirror, the snapping bed, Ivo’s fireflies, the boat that answered across Lorn’s water, and Cael’s slow avenue. Whoever asked still has their word when you pass: Mira still tells you where Odile and Talo went, Wendel gives you his saying, Ivo his jar of fireflies, and Hollin asks you to come back.',
      see: 'In Viridel, water the flowers on the fallen ship’s flank and look at the scorch: the quest ends there, with Mira’s words as the keepsake. Walk back to Mira afterwards and she asks what you saw. In Lorn’s deep wood the quest ends at the half-sunk boat; Hollin waits in the root cave.' },
    // four word slips and two buttons named in prose (issue #173)
    { text: 'A few words put right: arriving in the Buried Machine says the Wick is unlit beyond the canyon’s oval doors instead of who to ask; your father’s window recording no longer mentions a well that is gone; a choked runnel on Viridel’s tea terraces says in one line to clear the top one first; the doorway the dune let go of no longer promises a stair into the dark; and in the City-Shaft the air pillars and the splinter’s pull name your own buttons.',
      see: 'Arrive in the Buried Machine: the opening words end “beyond the canyon’s two oval doors.” In the City-Shaft, ride an air pillar for the first time: the hint names your stick or keys.' },
    // the game's old internal names gone: memento / moebius ids renamed hiraeth (issue #130)
    { text: 'Hiraeth now carries its own name inside too, so this update starts afresh: saves and settings begin again everywhere. On Android it is a new app: install it when the old app offers the update (or from the release page), then uninstall the old one, which gets no more updates. On the Steam Deck, run the install command again. The game’s site has moved to hiraeth.alexandria-rnaud.workers.dev.',
      see: 'On Android, open the old app: it offers the new one. Once it is installed, the new Hiraeth opens on a new game; uninstall the old one from its app info. On the web, open hiraeth.alexandria-rnaud.workers.dev: the title screen offers a new game.' },
    // the ways to and from three temples (docs/systems/worlds.md "The ways in and home past the temples"; issues #178-#180)
    'In the Garden of Spheres a pale path now leads from behind your ship to the Footprint, past a little Footprint pressed in the grass and a tall white stone. Once the Echo is calm, the Footprint lets you out through a round stone at the foot of the white hill, and the hill’s path takes you home another way.',
    'In Lorn the keepers’ stakes now come out of the crystal cave and round the Hush-House to a stake beside its steps, then run on down the channel to Hollin, so the way from the house to the lamp-keeper is marked.',
    'In the Moon Foundry, rails run from beside the Casting-House’s door up the hangar’s east side and out onto the apron, with a stone test moon on a cart and a cart of cracked moons on the way: a walk back to your ship you haven’t taken yet.',
    // the desert raised (src/desert-dunes.js LOOKOUT, src/desert-giants.js; issue #181)
    'In the Desert, a ledge now winds up the lavender mesa where sand pours over the ride out, from the sand to a lookout beside the fall’s lip, 40 m up: walk it or ride the hoverbike up it, and look out over the ride and the giants down the dry wash. The giant’s arm has its verse stone up on its crown, over the middle of the wash, where you ride across high over the riverbed.',
    // the City-Shaft's first mirror and the way down to Nima (src/story/incal.js, src/levels/incal.js nimaLight; issue #182)
    'In the City-Shaft, Abel rings the bell quarter’s bells on the terrace by the first mirror the sun stops at, and has a word about why it throws the light at his wall. Once the Lodestar burns again, a shaft of its light falls on Nima’s steps on the high terrace, gold, so from the palace’s crown you can see where she is.',
    // the last two report-backs (src/save-migrate.js step 21; issue #183)
    { text: 'Two more quests end where you do the thing: in the City-Shaft, lighting the Lodestar from the palace’s crown finishes the city, and Nima calls out to you when you pass her terrace, wanting to hear what you did up there; in the Desert, going down into the giant’s chest finishes Ilo’s errand, and she shouts as you come by, wanting to hear what was down there.',
      see: 'In the City-Shaft, carry the splinter to the palace’s crown and look up: the quest ends there. Glide down to Nima’s terrace, gold in the light: she calls out, and talking to her, she tells you to look up once a day. In the Desert, take Ilo to the giant’s skull and go down through its mouth: her errand is done below, and coming back up she calls out to you.' },
  ] },
  { v: '1.53', date: '2026-10-12', items: [
    // the meadow's flowers from afar (src/flora.js FAR_LINE, materials.js lineFar; docs/audits/ink-lines-v1.53.md; issue #38)
    'Viridel’s meadow flowers seen from afar are drawn in a thin outline in a dark shade of their own colour, so a clump of tulips 50 m off reads as pink and yellow flowers, not a dark blot. Up close they keep their black ink.',
    // the Desert's picked explorations (docs/systems/worlds.md "The Desert's explorations"; issue #167)
    'Out in the dunes between the ride to the Givers’ Hearth and the marked stones home lies the giants’ road: four fallen giants down an old dry riverbed. A great hand stands out of a dune, an arm lies across the dry wash, a spine climbs a dune to its skull, and a jaw stands over the riverbed like an arch. You see them from the ride, neither on your way nor far off it.',
    'Each giant has a little pilgrims’ shrine with a verse cut in its stone. Read from Qanat outward, the four verses tell the giants’ story back to where they came from, and the last one points on toward the swamp of lights.',
    'Ride the hoverbike (or walk) up the giant’s arm from its shoulder in the sand, over its elbow and across: it carries you high over the dry wash, and the second verse waits on the elbow.',
    'Rivers of running sand wind between the dunes: one out of Marrow’s hollow along the ride toward the salt-carrier’s shade, one down the dry wash past the giants and under the giant’s arm, home toward Qanat. On the hoverbike they are fast lanes: ride with the sand and it carries you faster.',
    'The dunes walk. Out along the ride a dune has slid off an old stone doorway with a stair going down into the dark, and another off a buried caravan. Come back to the desert another time and the wind has moved them: other ruins stand clear, a windcatcher’s tower, three old arches.',
    'Sand pours off two of the mesas in slow golden falls, one over the dry wash and one right over the ride out.',
    'Where the dry wash ends, east of the camps, lies a white salt pan. From afar a mirage hangs over it, the old lake with its reeds and sails; come closer and it sinks away into the salt.',
    'A line of old qanat wells runs from the giant’s hand toward Qanat, each with a little windcatcher. Listen at one: the water under the sand sounds nearer at every well.',
    'Old boats lie stranded on their sides in the dry wash, its banks pale with the river’s old tide lines.',
    'When the tree drinks, the water comes back to the desert: the salt pan past the camps fills into a shallow mirror lake the procession walks through, and water glints in the old wells.',
    // the father whole and walking (src/characters/father-full.js, docs/systems/characters.md "The father in full"; issue #26)
    'On the window recording your father is no longer a bust: the ship’s log shows him whole, small over the projector in his long coat, walking across to the window, standing there looking up and out while he speaks, and walking back, his coat swinging with his stride.',
    // the dialogue review v1.53 (docs/audits/dialogue-v1.53.md): text only
    { text: 'Some conversations were rewritten. Under the sea, in the Moon Foundry, the City Floating in Space and the Glass Dunes, people start with what they are doing instead of their name and trade. In the desert you tell people about the blocked drain in your own words, and more talks end on a reply to what was just said. Your father’s recording at the window keeps to one night, and two finds from the Glass Dunes no longer come from a world you can’t reach.',
      see: 'In the Underwater City, talk to Bastien at the lock: “Your ship came down my lock like a stone down a well.” In Qanat, once the roots drink, tell Ama about the drain: “Something was jammed in its drain, down there.”' },
    // the temples to explore, round 3 (docs/systems/temples.md "Round 3", docs/audits/temple-design-v1.53.md; issue #23)
    'In the Hush-House’s Snapping Passage, two more mouths of jaws grow out of the walls beside the gate, each crowned with a crystal: small, middling, and the gate’s the biggest. They only still in the order the Choir taught, smallest first, so the gate you shoot first rings flat. The smallest mouth keeps a coffer.',
    'West off the Hush-House’s Pendulum Gallery, the Nursery shuts behind you until its seedlings are beaten; winning it opens the keeper’s gate back over the chasm and gives a small key. It opens a little door on top of the Bog Well’s root-wall, where a ledge runs round the well and through the wall onto a balcony over the Choir. The great key waits there behind a wall, and a ball has to roll through a snapper’s mouth in it: still the mouth, but here the frost thaws and it snaps shut again a few breaths later. The door to the Mother now takes the great key.',
    'In the Mooring-House, the Rope Store off the Moorers’ Gallery shuts behind you until its keepers are beaten, and its small key opens the moorers’ gate. Inside, on the balcony high over the Capstan Hall where you came in, the great key waits in a cage: tether the ball home along its cable-rail round the wall, with the Gallery’s ring pulled, and the cage sinks. The Capstan Floor’s door now takes the great key.',
    'In the Clock-House, the Clockmaker’s Cupboard by the Escapement has stopped: its little clock’s eyes stay lidded until you wind the house’s mainspring, far up past the chest. Then the house’s clocks tick again, the cupboard opens to four, eight and twelve, and the great key is inside it. The Mainspring Room no longer keeps it.',
    'Three more houses have a room that shuts behind you until its keepers are beaten, each with a small key for a later door: in the Whale-House the Horn Store, off the Sounding Hall, for the Song Passage’s door past the whale-horn; in the Casting-House the Sand Room, south off the Mould Room, whose key you carry all the way to the Founders’ Door; in the Footprint the Keepers’ Lodge, off the Keepers’ Gallery, for the far door over the Hall of the Unseen.',
    // the game's own update a frame (docs/systems/performance.md "The game's update", issue #111)
    'The Unity previews on the Xbox and the Steam Deck spend less time on each frame: the traveller and the people are posed without working their whole bodies out several times over, the crowds take half the time, fires and the City-Shaft’s air pillars behind the camera wait until you look at them, and the drone’s trail stops redrawing itself while docked. Nothing looks or moves differently.',
  ] },
  { v: '1.52', date: '2026-10-12', items: [
    // the Unity preview on the Xbox at a steady 60 (docs/systems/xbox.md "The Unity build on the Xbox")
    'The Unity preview on the Xbox now waits for your TV before each picture: a steady 60 frames a second, with nearly every frame on time and no tearing across the screen as you turn.',
    // the machine breathes (docs/systems/worlds.md "The Buried Machine breathes"; issue #168)
    'In the Buried Machine, the rust canyon breathes: round vents low on both walls puff steam in rhythm, slowly by the sand ramp and faster the nearer you are to the oculus, and once the Wick is lit the whole canyon breathes at once. Great pistons slide in and out of the walls high up, and past the first oval wall a thin fall of amber oil pours from a broken pipe into a pool.',
    'Past the first oval wall, the dome keepers’ way climbs the east wall: three pistons rise and fall in turn beside it (ride one up, step across when two meet) to a gangway halfway up, where a door in a wall of turning gears opens for a while every half minute. A long ramp then climbs onto the top of the second oval wall, high over the rim, with the keepers’ log and the whole canyon below; drop off either end onto the dunes.',
    'With Reduce motion on, the canyon’s great pistons, gears and steam hold still and the gear door stays open; the keepers’ pistons still rise and fall, and the wall beside them can be climbed instead.',
    // the City-Shaft's quarters (src/shaft-quarters.js, docs/systems/worlds.md "The quarters"; issue #169)
    'The City-Shaft’s ring of terraces is split into four quarters you can tell apart, from across the pit and on the promenade, and the place name says which one you are in. The hanging gardens spill green over the terraces’ edges, ivy climbs the wall and water falls from the edges.',
    'In the cab-wrights’ cliff the wall turns pink, cabs are parked in rows of holes in it like birds in a cliff, and ochre cranes swing their arms out over the void.',
    'In the bell quarter, round the Upward Shrine, great bronze bells hang out over the void on red beams under little green roofs, swaying and ringing in the rising air, with tall red banners down the wall. You hear the bells before you see them: walk toward the sound.',
    'In the balcony market, under the rim by your ship, striped awnings stand on balconies built out over the void on struts and cables, with bunting strung between them. Walk out onto one; the cab ride home flies right over them.',
    // the light that goes down (src/shaft-mirrors.js, src/story/light-down.js; issue #169)
    'A great brass mirror on the City-Shaft’s rim, past the red stair, throws the sun right across the shaft to a chain of mirrors down the bell quarter. Three have been knocked round, and the light stops at the first, a bright coin that wanders on the wall. Walk out onto each mirror’s deck and turn its crank a notch at a time until its beam lands on the mirror below. A new errand, The Light That Goes Down.',
    'When the last mirror throws the light onto the little square on the bottom terrace, stalls and washing come out into it. The makers’ chest that sat cold in the shade there opens in the sun: inside is the Lamplighter’s glass, and bridges you draw with the bridge pen stand half as long again.',
    // the Glass Dunes' picked explorations (docs/systems/worlds.md "Time in the glass, the city under the sand"; issue #166)
    'In the Glass Dunes the glass is clear where it is thin, and the night the light passed is held inside it, its people and creatures caught mid-moment: a glassworker reaching for a falling float in a shard of glass on the way to the Clock-House, birds mid-wingbeat in the frozen wave, five carriers mid-step in the billows, the storm’s dust in a curl in the cliffs. Each holds a clock stopped at its own minute; look at one to read it.',
    'Inside the breaking wave over the north camp, a cleft leads into a chamber of clear glass: you stand among the people of the minute the light passed, all looking up, its streak of light held over their heads.',
    'Three clear windows in the Glass Dunes’ sand look down on a city of domes, towers and lit streets below, its light rising off the glass; you can walk out onto them. By the Clock-House a sinkhole leads down into the city itself, under a ceiling of glass and drifted sand where the light falls in shafts, your own footprints overhead, and the Clock-House the top of its tallest tower. The ramp of sand that fell in with you takes you back up.',
  ] },
  { v: '1.51', date: '2026-10-11', items: [
    // the type split (docs/systems/ui.md "Type"; issue #128)
    'All the words on the screen are in the game’s own lettering now: the hints at the bottom, the notices at the top, the cards for what you find, the minigames and trials, the settings and the conversations no longer use a typewriter face, and the names and titles share one bold heading face. The words also grow with the screen, so they read as easily on a big TV or a 1440p monitor as on the Steam Deck or a handheld.',
    // the desert, after the author's playthrough (issues #149, #153–#158, #162)
    { text: 'The opening in your ship has music of its own: a low hum, soft glass and a felt piano while you wake and walk to the cockpit, quiet under your father’s message. The desert’s music starts when you step out onto the sand.',
      see: 'Start a new game (or open ?level=desert&prologue=1) with the sound on: in the ship you hear its own quiet music, not the desert’s ney and oud; they come in as the ramp comes down and you walk out.' },
    'No wild creatures roam Qanat’s streets and square any more: the lizards, crabs and jerboas keep to the sand outside the walls. The birds still wheel high over the city.',
    'The giant’s skull outside Qanat’s back gate has turned round: it faces the city now, so as you come out of the gate you see its painted eyes, its teeth and its mouth down the slope, and the pilgrims’ cairns lead you straight to it.',
    'The chest in the giant’s chest is no longer out in the open, shut until you could open it: it waits inside a small makers’ shrine beside the pool. Fill your tank in the pool and the shrine’s door hums with it; open the door with your full tank and it sinks into the floor, and the chest with the lift valve is inside.',
    'The great chests now stand on low round mounds you simply walk up, a gentle slope with no steps: the first chest under Qanat’s tree, the one in the giant’s chest, the Givers’ two, and the chest at the heart of every temple. No more stepping up onto a stair to reach them.',
    'No button prompt comes up in front of the giant’s skull any more: walk straight into its mouth.',
    'In the giant’s chest under Qanat, what blocks the water is plain to see now: a heap of debris, a broken piece of rib, rocks and packed sand, jammed in the drain. There is no lever or pole to find any more: look at the drain and it asks whether to remove it. Say yes and you drag it clear yourself, and the water runs.',
    // the Unity preview on the Steam Deck (docs/systems/performance.md "The Steam Deck, round 7"; issue #111)
    'On the Steam Deck, the Unity preview runs smoother: about 60 frames a second at the City-Shaft’s rim, where it ran at 45, and over 55 even looking down over the whole city; the Desert and the Signal Market hold a steady 60.',
    // Plumb, the drone's own mind (docs/systems/scout.md "Plumb's own mind"; issue #152)
    'Your drone has a name now, Plumb, and a mind of its own. Wander for a few minutes without getting anywhere and it says a short line and flies out toward where you are going; then it leaves you be for a good while.',
    'At the start of a new game Plumb says a few things, each only once: as you step out of the ship, near the first person you meet, at your first chest and the first time you lose your way.',
    'On your pack, Plumb hops when you find something, turns to look at a chest or someone you have not met yet close by, and shivers in a storm. With Reduce motion on it holds still.',
    'A new setting, Drone hints (on, fewer, off), says how often Plumb speaks up by itself. Fewer waits twice as long; turning the game’s Hints off quiets it too.',
    // the button glyphs follow the screen (docs/systems/ui.md "Type"; issue #150)
    'The buttons the game shows you grow with the screen like the words beside them: the button over someone you can talk to, the hints at the bottom, the answers in a conversation and the buttons in the menus and on the cards for what you find are clearly larger on a Steam Deck, and larger still on a big screen. With a controller in hand, a conversation now shows the button that turns its page.',
    // the scout's button, taught after the first conversation (docs/systems/hints.md; issue #151)
    'After your first conversation, a line at the bottom of the screen tells you which button sends your scout to show where your next quest is (R3 on a controller, Q on the keyboard). It says it once, and not at all if you have already found it yourself.',
    // one description for each thing you find (docs/systems/boxes.md "The card"; issue #165)
    'The card for something you find no longer splits it into “What it is” and “What it does”: each item and gadget has one short description, a line or two, that says both, with the buttons to use it right in the sentence. The same words are in your gear and on the items page.',
    // the Unity preview on the Xbox (docs/systems/xbox.md "The see-through picture", "The Unity build on the Xbox")
    'On the Xbox, the Unity preview (Hiraeth (Unity), in Developer Mode) draws the whole world now: the sand around you, the people, your ship and Qanat’s domes were missing there, only their outlines left against the sky, and the City-Shaft’s rim looked through to the depths.',
    'The Unity preview on the Xbox draws at 1440p, which the console scales to your TV, on Direct3D 12: about 73 frames a second at the Desert’s ship, where it ran at 51, with nearly every frame on time.',
  ] },
  { v: '1.50', date: '2026-10-11', items: [
    // Qanat's square (docs/systems/worlds.md "Qanat's square without the well and the stele"; issue #161)
    'Qanat’s square is clearer round its great tree: the stone well and the carved stele are gone. The water now climbs the tree’s own roots while you watch, and you set the spark-stone in the roots at the trunk’s foot, on the avenue’s side. Hessa sweeps round the roots instead of the well.',
    // the dais and Nour's bench (docs/systems/boxes.md "The tree's dais"; issue #160)
    'The makers’ dais under Qanat’s tree stands taller, three white steps instead of two, so the chest on it shows clearly from the gate and all the way up the avenue. Nour’s bench has moved out of the way: it stands a few steps off to the left of the dais, facing it, instead of right behind the chest.',
    // the galactic map (docs/systems/story.md "The map is a system"; issue #129)
    'The galactic map is a system now: one star, home on the orbit beside it, and every world on an orbit of its own, further out the further along the route, so the way on reads outward. The Moon Foundry goes round the Buried Machine, and the City Floating in Space round the Signal Market. The next place to go wears a gold NEXT, with a line out to it from your ship, and on a handheld the worlds are no longer set out in rows.',
    // the way to the end (docs/systems/story.md "Worlds seven to twelve pull toward the end"; issue #127)
    'From your seventh world on, a far light hangs in every sky: a small inked star with four long rays and a wash of gold round it, faint at first and brighter with every world you finish.',
    'After your first homecoming, each world’s recording plays a little more of your father’s, made at the window the night the light came over the house: a new line in each world, the light a little further out every time.',
    'Once you are back from home, the quest log names the goal: make the Signal Market’s silent tower speak. The galactic map marks the market NEXT, even before it is charted, and the ship’s console and recordings say the light went that way.',
    // the Steam Deck (docs/steam-deck.md "The Unity preview"; issue #146)
    'On the Steam Deck, a second game can join Hiraeth in your library: “Hiraeth (Unity preview)”, an early look at the game on a new engine, smoother in most places. It is for trying out: it has no menus or conversations yet and keeps its own progress, so Hiraeth stays the game to play. Run the installer again to add it (new installs get it at once); after that it downloads and updates by itself.',
    // the camera at a door (docs/systems/movement-and-camera.md "The lens past a door's jamb"; issue #148's follow-up)
    'Running through the Overnight Train’s doors, the camera no longer flicks round for a frame as it brushes the door frame: it comes in along its arm and slides off the frame over a few frames instead, as close behind you as before.',
    // the walks home from the temples (docs/systems/worlds.md "The walk home from the temple"; issue #132)
    'In the Underwater City, once the Listener is calm, the Whale-House lets you out through the keepers’ hatch in the divers’ court. A new glass tube runs south from there through a bed of kelp, past an old sunken diving bell, to the kelp garden: a different way home.',
    'In the City Floating in Space, a small new island, the Lamp Rock, hangs south of the Towers with its tall lamp, the moorers’ oil drums and a bench. Its two bridges take you from the Towers to the Gate: a new way home from the Mooring-House, a little shorter than back through the Market.',
    'In the Buried Machine, a row of iron vent caps runs from the Engine-House’s door to your landing hollow, the stokers’ tall whistle halfway along. Once the engine runs, puffs of steam roll along them toward your ship.',
    'In the City-Shaft, once Tobin gives you Lio’s pass, ride home: wave a cab down at the rim’s edge and it flies you out over the shaft, past the new cab rank where the cabs wait, to the stop by your ship.',
    // Viridel's Greenhouse (docs/systems/worlds.md "Viridel: the Greenhouse's spire and the long seed row"; issue #131)
    'In Viridel, a slender glass spire rises from the Builders’ Greenhouse’s dome, a pink glass bud at its top, so from Mira’s water clock you can see where the Greenhouse stands over the rise of the meadow.',
    'In Viridel, a long row of seed beds runs from the Greenhouse down the meadow, past the white ruins, to your landing, the builders’ old seed-drill standing where it stopped. Once the Gardener sleeps every bed comes up green, and Sorrel sends you home along it.',
    // Vael's plain and its blind legs (docs/systems/worlds.md "Vael: the plain's sights, Aube's smoke and the founders' lamp"; issue #133)
    'In Vael, the long walk over the plain from the Aerie to the lone tower passes two new things to turn aside for: the white bones of a great bird a rider once flew, lying across the sand, and the riders’ little shrine in the lee of a hoodoo, ringed with their streamers. Both can be looked at.',
    'In Vael, Sister Aube keeps a fire in her hermitage: from the riders’ gate its thread of smoke rises high over the sky stones, so you can fly straight to her.',
    'In Vael, Brother Calix now waits at the foot of his bell tower, and the Founders’ Belfry wears a bronze needle with a lamp on its dome, seen over the monastery roofs from there. The lamp lights when the bell rings.',
    // things to steer by (docs/systems/worlds.md "Landmarks for the blind legs"; issues #135, #136, #134)
    'In Lorn, the lamp-keepers’ old boat-way is marked again: a row of tall stakes, each with a coral float on top, leads from the crystal cave’s south mouth across the open water, past the keepers’ light, to Hollin’s island.',
    'In the Buried Machine, a tall chimney stack now rises out of the rust canyon at the foot of the sand ramp, a column of white steam leaning off its top: you see it over the domes, and from the canyon floor looking back. A rope on iron stakes runs down the ramp to its foot.',
    'Fisk now flies a long teal pennant on a tall mast beside the Engine-House’s door, so you can pick out the door from Wen’s dome over the huts.',
    'In the Garden of Spheres, a white path branches off the meadow path to the foot of the white hill’s stair, where a little sphere waits. Splash it and a bell answers from the belvedere high above, a yellow streamer flying from its mast. Climb up and ring the bell: the garden’s spheres answer it one after another, out across the meadow.',
    'In the Glass Dunes, the carriers keep a kiln burning beside the breaker’s cairn, and its smoke now stands over the far cliffs, seen from your landing. From beside the Clock-House’s door, posts with amber floats lead north and up the breaking wave’s back to the cairn, past the carriers’ sledge, their shade and a frame of wind-glass.',
  ] },
  { v: '1.49', date: '2026-10-11', items: [
    // the camera (docs/systems/movement-and-camera.md "Sable's framing on foot"; issue #148)
    'The camera follows closer on foot, the way Sable frames its rider: you stand about a third of the screen’s height, a little below the middle, with the camera just over your head looking gently down, so the ground fills the lower half and the world rises behind you. Under a roof, in a temple’s great hall, it stands higher and looks down more steeply. On the hoverbike it hangs further back and a little lower, so the road ahead reads; gliding, the jets and the cabs keep their long view.',
    // loading (docs/systems/performance.md "The drifts' collision and the crowd's strollers, later too"; issue #14)
    { text: 'The Buried Machine opens about three quarters of a second sooner: where the sand banks up against walls far from you, its footing is worked out after you arrive, nearest first, and always before you get near it.',
      numbers: [
        { title: 'Time to the Buried Machine’s first frame', unit: 's', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome, High', rows: [
          { where: 'median of three, interleaved', before: 5.04, after: 4.27 },
        ], source: 'scripts/load-breakdown.mjs, v1.48 against this build' },
      ],
      see: 'Fly to the Buried Machine: the loading screen gives way sooner, and the sand against the domes by the landing holds your feet as before.' },
    { text: 'The City-Shaft opens close to a second sooner, and on a handheld some three seconds: the people strolling its far terraces set out after you arrive, those within sight of you before you see them. The crowd is a little different: other strollers, and walks that no longer stop where they cross.',
      numbers: [
        { title: 'Time to the City-Shaft’s first frame', unit: 's', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome', rows: [
          { where: 'High (median of three)', before: 5.52, after: 4.72 },
          { where: 'Handheld, the main thread slowed four times (two runs)', before: 19.4, after: 16.1 },
        ], source: 'scripts/load-breakdown.mjs, v1.48 against this build, interleaved' },
        { title: 'The City-Shaft’s crowd at load', unit: 'ms', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome, High', rows: [
          { where: 'the crowd’s step', before: 974, after: 149 },
        ], source: 'scripts/load-breakdown.mjs, its load steps' },
      ],
      see: 'Fly to the City-Shaft and look down from the rim: the terraces below fill with people as they always did.' },
    // the Unity test build (docs/systems/water.md "In Unity"; issue #53)
    { text: 'In the Unity test build, water foams where it meets the shore and whatever stands in it, as it does in the browser: a pale band along the banks, off on phones as on the Handheld preset.',
      see: 'In the Unity test build, step off the ship in Lorn and look along the water’s edge to the right of the ramp.' },
    // sound (docs/systems/audio.md "The volumes"; issue #112)
    { text: 'The Steam Deck has its sound back: a measuring run had saved the music, the effects and the voices at nothing into the game’s settings, so all you heard was the singing light in the prologue. Those three come back to their usual levels once, and with the effects turned all the way down the singing light and the makers’ hum are silent too.',
      see: 'On a Steam Deck that had gone quiet: start the game and the title’s music plays; the settings’ Sound sliders for music, effects and voices are back up. Turn effects to 0 and play the prologue: the singing light is no longer heard.' },
    // the temples to explore, round 2: each house its own shape (docs/systems/temples.md "Hubs, keys and arenas"; issue #23)
    'The Engine-House opens out past its chest. The Fourth Chamber’s four eyes now roll up two shutters. To the west, the Boiler Room shuts behind you until its keepers are beaten, then its flue leads on into the Crank Passage. To the east, in the Governor Room, the great key lies caged under a hammer, and one ball has to stop two engines in turn to free it. The Crank Passage’s door takes the small key, and the Tooth-Warden’s door the great one.',
    'The Aerie is a tower of rooms now, stacked up its Wind Well. Off the well’s floor, the Moult shuts behind you until its keepers are beaten and gives a small key, which the way north off the high balcony now takes. A ledge round the well’s wall leads from the high balcony to the Eyrie, where one stone sits between two vents: whichever it stops, the wind comes out of the other. One wind lifts you to a coffer, the other to the great key for the Roost’s door. In the Gulf, the marker now points at the vent’s stone.',
    'In the Builders’ Greenhouse, the bud into the Vine Gulf is in the shade now: roll the passage’s ball onto its plate to turn the louvre onto it. Past the gulf, the new Seed Vault holds the great key on top of a wall of glass. Its vine only grows from both of the seeds at the foot of the glass, and the one louvre lights one seed at a time. The great key opens the door past the bud into the Glasshouse. In the Cold Frame and on the Glass Stair, the marker now points at the eye you can wake instead of sending you back and forth between the ball’s plates.',
    'In the Undertower, the Listening Passage’s horn is deaf until a ball is rolled onto its footstone. Past the Gallery of Voices, the new Choir holds the great key between two horns. The far horn only hears the low stone’s own song, carried by a pair of dishes, and the near one wants the high note played back from your shell. The gallery’s far door now takes the great key as well.',
    'The Lamp-House has two new rooms. East off the Hall of Dark Pools, the Kennel shuts behind you in the dark until its keepers are beaten, and gives the small key the Lamp Passage’s door now takes. Past the Dark Gallery, the Wick Room holds the great key behind a grille between two niches. A niche only burns while the pool-orb in it glows, so light one orb with your lantern and roll it home, then the other, before the first one fades. The gallery’s far door now takes the great key.',
    'In the Founders’ Belfry, the west stone store shuts behind you until its keepers are beaten and gives a small key. The Hall of Stones’ door takes that key and the east store’s ball.',
    // menus (docs/systems/changelog.md "Refresh"; issue #114)
    'What’s new has a Refresh button (Y / △, or R): on the website it loads the newest changes; in the Android app, on the Xbox and on the Steam Deck it fetches the newest game over the air and restarts into it, your game saved first, or tells you that you already have it.',
    // the Steam Deck (docs/systems/performance.md "The Steam Deck, round 4"; issue #111)
    { text: 'On the Steam Deck the picture is always drawn at the screen’s own 1280 × 800. It used to drop to as little as 60 % of that when a place was busy, and the desert ran at 70 %, which is why it looked soft.',
      see: 'On a Steam Deck with Graphics on Auto or Steam Deck, turn on Show FPS and frame time in the settings: the line reads 1× everywhere, the desert’s camps too.' },
    { text: 'The Steam Deck spends less of each frame on things you can’t see: the shadows more than 120 m away are drawn every eighth frame instead of every fourth, and the banners in the City-Shaft and the desert wave only near you and in view. That is 15–30 fewer draws a frame in the busy places. It still doesn’t hold 60 there: the desert’s camps and the City-Shaft need a third or more off the processor’s work each frame first.',
      numbers: [
        { title: 'Shadow draws a frame', unit: 'draws', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome, Steam Deck preset at 1280 × 800, the CPU slowed three times (the Deck was asleep)', rows: [
          { where: 'the City-Shaft, the rim', before: 137, after: 112 },
          { where: 'the City-Shaft, down the shaft', before: 165, after: 136 },
          { where: 'the Signal Market, the start', before: 109, after: 87 },
          { where: 'the desert, the spawn', before: 91, after: 74 },
          { where: 'the desert, the camps', before: 76, after: 60 },
        ], source: 'scripts/bench/deck-worlds.mjs --slow 3 --profile 1 (scripts/bench/deck-mac.mjs), the passes’ own counts' },
        { title: 'The City-Shaft’s own update a frame (its banners in it)', unit: 'ms', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome, Steam Deck preset, the CPU slowed three times', rows: [
          { where: 'the rim', before: 1.83, after: 1.07 },
          { where: 'the crowd', before: 1.81, after: 1.09 },
        ], source: 'scripts/bench/deck-worlds.mjs --profile 1, one run each on a shared machine' },
      ],
      see: 'On the Steam Deck, with Show FPS and frame time on, stand in the City-Shaft: fewer calls on the frame line. The far shadows and the banners look as before.' },
    // the temples (docs/systems/temples.md "No climbing but the climbs"; issue #115)
    { text: 'Temple walls can no longer be climbed past their puzzles. Inside the makers’ houses only the climbs their way takes still hold you: the Rose House’s gallery, the Warden’s Well’s Climb, the Clock-House’s winding wall, the root-walls of the Hush-House, the Lamp-House and the Greenhouse, the Lamp-House’s loft of roots, and the glass a vine or brass rungs climb. Before, you could climb the Engine-House’s gantry instead of riding its pistons, climb round the Greenhouse’s Glass Stair onto the landing without the sun-disc, or go up beside any locked door.',
      see: 'In the Greenhouse, climb the Glass Stair’s root-wall and push on into the round wall above it: you no longer take hold. In the Engine-House, push into the gantry’s face in the Piston Hall: the pistons are the way up.' },
    // light (docs/systems/rendering.md "Shafts of light"; issue #116)
    'Light falls in soft shafts in every temple, as it does in the skull cave: the Builders’ Greenhouse’s sunbeams from its louvres are broad pale shafts down to their pools of light instead of thin glowing bars, the Lamp-House’s beam turns over the wood as a soft shaft instead of a solid cone, and the Wick’s light rises out of the Buried Machine’s oculus the same way.',
    // the title screen (docs/systems/ui.md "The title's drawing and the game behind it"; issue #110)
    'The title screen is there the moment the game opens: its world is a drawing in the game’s own ink and flat colour, painted with the name at once, instead of a 3D world built behind the menu. Now and then the singing light crosses its sky.',
    'Continue gets you playing much sooner: while you look at the title, your world loads behind it, so Continue goes straight in. If you are quicker than the load, a small mark where the menu was shows it finishing. Choosing another save, or changing a setting first, loads as before.',
    // the quests (docs/systems/story.md "The quest log, swept"; issue #118)
    { text: 'The quest log no longer sends you to people. Its steps name the place or the thing: after Wen, the ramp down to the canyon (Hask’s fear is still his to tell, if you sit with him); at the monastery, the bell’s clapper on the floating church (Calix still says where it lies). Nobody in the desert or under the sea ends on “Ask her.” any more.',
      see: 'In the Buried Machine, hear Wen out in the great dome: the quest log’s next step is the sand ramp into the canyon, not Hask’s bench. In Vael, ride the bird up to the monastery: the next step is the clapper.' },
    { text: 'In Viridel, the silt in the tea terraces’ runnels moves for whoever gets there first: shove the top clod and Esk’s errand starts from it, with no “ask her first”.',
      see: 'In Viridel, before speaking to Sol or Esk, walk up the tea terraces south-east of the landing and shove the top runnel’s clod: it slides out and “Water for the Tea Terraces” begins at the runnels.' },
    // the new worlds' errands (docs/systems/story.md "The new worlds' carries, done where the thing is used"; issue #137)
    { text: 'In the Moon Foundry, Wen’s count is done at the top of the pillar: reach the lookout and the moons are counted there, even if Wen never asked, and Petra writes it in her ledger next time you pass. Liesel’s mended ladle-hook goes straight onto the crane at the last furnace; Bertil thanks you when you walk by. The foundry no longer sends you through four talks in a row.',
      see: 'In the Moon Foundry, climb the rungs of the pillar east of the floor, the one with a moon on top, before talking to Wen: “Thirty-One Moons” starts and is done at the lookout. Then talk to Liesel in the workers’ quarter and walk to the jib crane by the last furnace: the errand ends there, not at Bertil.' },
    { text: 'In the City Floating in Space, Madame Sel’s notes are laid on the cables under the Towers, where they are heard, instead of being handed to Ines. Laying them is your hand on the cables for Rosa’s quest too.',
      see: 'Talk to Madame Sel on the Balcony and take her notes, then cross east to the Towers and press A / × at the cables by the Moorings bridge: “The Planet’s Hum” is done there.' },
    { text: 'In the Underwater City, Brune’s kelp cutting is done as you come up into the Crown, in Fabre’s window box, and Fabre’s word down to Maelle about his lamps is no longer an errand: she has her line on it when you pass. A save that was on its way to Fabre, Bertil, Ines, Petra or Maelle moves on to the new step.',
      see: 'Take Brune’s cutting up the lift in the Plaza’s column: the errand ends as you step out in the Crown, without talking to Fabre.' },
    // the temple guides (lore/voice-guide.md, the night's names; issue #119)
    { text: 'The temple guides name the night the singing light went over in their own world’s words, as everyone else there does: under the sea the night the whales went quiet, in Lorn the dry night, in the Buried Machine the night the Tuning Star came over, in the Signal Market the night every sign showed the mark. Only the City-Shaft still says the sky rang.',
      see: 'In the Underwater City, talk to Anselme at the Whale-House’s door: “Since the night the whales went quiet, something in there sings the light’s note back at them.” Hobb under the silent tower, Teasel by the Hush-House and Fisk at the Engine-House say their own world’s night too.' },
    // the names (docs/systems/story.md "Names a player can keep apart"; issue #141)
    { text: 'A few names were too alike to keep apart, so they have changed: the desert’s temple, the Givers’ House, is the Rose House now, a different word from the Givers’ Hearth nearby; Mireille is Brune, Ansel is Yusuf, Oren is Halden, Ilse is Petra, Tamar is Ines and Ottilie is Liesel. Lune, Ottla and Zazie, whom you meet on the detours, no longer come from a world you can’t reach: they are from the Signal Market, the Glass Dunes and the City-Shaft.',
      see: 'Talk to the kelp grower in the Underwater City’s garden dome: “Brune. I grow the glow-kelp.” The quest log calls the desert’s temple the Rose House. In the Forest of Antennas, Lune on the observation deck reads signals under Madame Sel’s tower in the Signal Market, and Ottla on the plaza keeps the Glass Dunes’ kilns going; in the Underside, Zazie says down goes on for ever in the City-Shaft.' },
    // the guardians (docs/systems/boss-hints.md "One line mid-fight"; issue #120)
    { text: 'What a guardian’s fight writes on the screen is one short line you can read while dodging: what to do, not why. The hints at the start of a fight and at each change were often three or four sentences; now each says the move in a few words, and so do the lines when it wakes, opens, tires and settles. The drone still explains more if you ask.',
      see: 'In the Warden’s Well, wake the warden and let it change: the notice now reads “Only its crown hatch opens now: get above it and shoot down.” (it was four sentences). The Keeper of the cistern opens with “Light the four braziers: cut each spoke’s ball through its fire.”' },
    // the Steam Deck, measured on it (docs/systems/performance.md "The Steam Deck, round 5"; issue #111)
    { text: 'The City-Shaft runs about a seventh faster on the Steam Deck, 35 → 39–41 frames a second at the rim and looking down the shaft: its banners are drawn together, and so are its towers, and the cabs, the drones, the room checks and your shield’s disc take less of each frame. It looks the same. The desert and the Signal Market are as they were, and none of the three holds 60 yet.',
      numbers: [
        { title: 'Frames a second', unit: 'fps', better: 'higher', device: 'Steam Deck OLED, Steam Deck preset, 1280 × 800, Gaming Mode at 90 Hz', rows: [
          { where: 'the City-Shaft, the rim', before: 35.5, after: 40.9 },
          { where: 'the City-Shaft, the crowd', before: 34.6, after: 38.3 },
          { where: 'the City-Shaft, down the shaft', before: 34.8, after: 39.0 },
          { where: 'the desert, the spawn', before: 40.4, after: 40.9 },
          { where: 'the Signal Market, the start', before: 47.7, after: 47.7 },
        ], source: 'scripts/bench/deck-worlds.mjs --settle 1 --profile 1 on the Deck, main (de6bf70b) against this build' },
        { title: 'The processor’s work a frame (JS)', unit: 'ms', better: 'lower', device: 'Steam Deck OLED, Steam Deck preset, 1280 × 800', rows: [
          { where: 'the City-Shaft, the rim', before: 28.0, after: 24.0 },
          { where: 'the City-Shaft, the crowd', before: 28.5, after: 25.8 },
          { where: 'the City-Shaft, down the shaft', before: 28.6, after: 24.7 },
          { where: 'the desert, the camps', before: 27.4, after: 27.4 },
        ], source: 'the same runs; 60 needs 16.7' },
        { title: 'Draws a frame in the City-Shaft (view + shadows)', unit: 'draws', better: 'lower', device: 'Steam Deck OLED, Steam Deck preset, 1280 × 800', rows: [
          { where: 'the rim', before: 440, after: 359 },
          { where: 'down the shaft', before: 506, after: 389 },
        ], source: 'the passes’ own counts (--profile 1)' },
      ],
      see: 'On the Steam Deck, with Show FPS and frame time on, stand at the City-Shaft’s rim and look down the shaft: the frame line reads about 40 instead of 35. Fly close to a banner under a terrace: its colour, glyphs and wave are as before.' },
    // the settings (docs/systems/ui.md; issue #122)
    { text: 'Settings no longer offers to invert the jets’ pitch until you have the jets, and the developer switches have their own group at the very end, below the reset, instead of sitting among yours.',
      see: 'Open Settings (Menu / Esc) in a game: Camera and motion has no jets row; the Developer group is last. Give yourself the jets in the world debug menu (L3 + R3, F2: Toggles) and the row is back.' },
    // the lock-on (docs/systems/foes.md "The lock-on"; issue #126)
    'When the foe you are locked on to is out of your blade’s reach (a hound running as a shadow, a ray under the sand), the four arrows go hollow, just an outline, instead of only fading, so you can tell at a glance on a small screen, in bright worlds and whatever colours you see.',
    // the trials (docs/systems/minigames.md "Best and reward"; issue #125)
    { text: 'A world’s trial whose prize improves one of your gadgets now waits until you have found that gadget, so you no longer win an upgrade for a tool you haven’t got. Its sign says which one it is for.',
      see: 'In Vael before finding the grappling hook, press A / × at the Wind ladder’s sign: “Wind ladder: Its prize is for the grappling hook. Come back with it.” With the hook it starts as before.' },
    // the Desert's start (docs/systems/story.md "The first arrival is clear"; issue #139)
    'Your first steps out of the ship in the Desert are under a clear sky: no sandstorm blows in until you have opened the makers’ chest in Qanat. After that the storms come and go as before.',
    // the first chest (docs/systems/boxes.md "The tree's dais"; issue #140)
    'The first chest in Qanat no longer sits on a shelf high up the great tree: it stands at the tree’s foot on a round dais of white stone and gold, in a clearing of pale flagstones, in sight all the way up the avenue, and it is the same chest you find in the temples, opening the same way. You walk up its two steps instead of climbing. If you already opened it, it stays open.',
    // conversations (docs/systems/dialogue.md "The panel reads at a glance"; issue #147)
    'Conversations are easier to read: the words are much bigger on every screen, from a handheld to a TV, in a wider box, and each page appears whole and in your own words at once, instead of being typed out letter by letter in the speaker’s script first. A press turns the page straight away. The answers are lighter too: just their words on the paper, the one you would pick in full ink with a red line under it.',
  ] },
  { v: '1.48', date: '2026-10-11', items: [
    // loading (docs/systems/performance.md "Distant detail after the first frame"; issue #14)
    { text: 'The City-Shaft opens two and a half seconds sooner, and on a handheld some thirteen: the trees far from you are checked for standing inside a house after you arrive, the nearest first, instead of all of them before the world shows. Everything near you is checked before you see it, and a door or a portal finishes the far side before it opens.',
      numbers: [
        { title: 'Time to the City-Shaft’s first frame', unit: 's', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome', rows: [
          { where: 'High (median of three)', before: 7.76, after: 5.28 },
          { where: 'Handheld, the main thread slowed four times (two runs)', before: 31.9, after: 19.0 },
        ], source: 'scripts/load-breakdown.mjs --query defer=0 and defer=1, interleaved' },
        { title: 'The City-Shaft’s collision stage (the trees’ check was in it)', unit: 'ms', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome, High', rows: [
          { where: 'inking the collisions', before: 3398, after: 500 },
        ], source: 'scripts/load-breakdown.mjs, its phases' },
      ],
      see: 'Fly to the City-Shaft: the loading screen gives way sooner, and the trees by the landing are as they were.' },
    // the three newest worlds and the Glass Dunes (issue #101)
    { text: 'The Underwater City, the Moon Foundry, the City Floating in Space and the Glass Dunes each have a quest of their own before their temple, opened by someone a few steps from your ship: Bastien at the lock hears the wrong note in the glass, Hedda on the apron found a moon in her mould that nobody poured, Rosa on the Pier chalks the islands drifting apart a hand’s width a night, and Oren by the discs knows the minute every clock stopped. Each leads you to the temple’s door.',
      see: 'Step off the ship in any of the four and talk to whoever stands nearest it: Bastien by the moon pool, Hedda by her mould, Rosa on the Pier, Oren by the discs.' },
    'The three newest worlds have a makers’ court each: a gadget you already carry, a puzzle of its own, and a chest behind the gate it opens with a charm for that gadget. The divers’ court under its own dome west of the Underwater City’s Plaza (the bubble wand), the founders’ yard on the Moon Foundry’s apron (the magnet glove), and the moorers’ yard on a new island west of the floating city’s Gate (the grappling hook).',
    // the makers' runs (issue #45)
    'Two new makers’ runs. In Viridel, the Glass climb north-west of the white ruins: two terraces of greenhouse glass too smooth to hold; bloom the seed at each one’s foot and climb its vine. In the Deep Wood, the Orb walk on the bank east of the landing: light each pool-orb with your lantern, push it down its groove to the keeper’s lamp before the glow fades, and moss-stones rise across the gap. Oro and Hollin have a word for you at the end.',
    // the worlds' layout (issue #44)
    'In the Signal Market, Madame Sel meets your ship where the avenue opens off the landing, the silent tower down the street behind her, and goes back to her crate at its foot once she has had her say. The towers either side of Signal Square stand on legs now: a passage under each runs straight at the silent tower’s screens, from the back lane and from the side streets.',
    // the temples to explore, not corridors of rooms (docs/systems/temples.md "Hubs, keys and arenas"; issue #23)
    'The Clock-House is a house to explore now, not a corridor of rooms: its Winding Well is a hub, with the Pendulum Hall to the west and the Striking Room to the east, each holding a small key, in whichever order you like. The door over the climb wants both keys as well as the counterweight.',
    'Temples have keys and locks. A key turns over a plinth inside a cage that sinks once you have earned it. Walk up to a locked door with a key and it goes in by itself, one key for each keyhole. In the Clock-House, the Foreman’s door needs the great key, which waits in the new Mainspring Room past the chest.',
    'Some temple rooms shut behind you until their keepers are beaten. In the Clock-House’s Pendulum Hall, beating them frees the key and opens a way up onto the ledge over the climb.',
    'Off the Clock-House’s Escapement there is an optional room, the Clockmaker’s Cupboard. Its little clock has lost its hand, and the coffer inside holds chimes.',
    'The Builders’ Greenhouse opens out the same way. Off the Potting Hall, the dark Shade House shuts behind you until its keepers are beaten, and in the Cold Frame one ball has to bring the sun to two eyes in turn. Each room gives a small key for the Glass Stair’s door.',
    'The Undertower opens out round its Cable Well too. The Cable Store shuts behind you until its keepers are beaten. In the Tuning Room, a ball rolled in from the well wakes a dish that carries a stone’s high note across to a far horn. The door to the Shell Chamber takes a small key from each.',
    'The Warden’s Well opens out round its Climb. The Ash Store shuts behind you until its keepers are beaten. In the Vane Room, the chasm’s stones only stand while the vane on its far wall turns, so you splash it and cross before it slows. The door at the balcony’s end takes a small key from each.',
    // the dialogue (docs/audits/dialogue-v1.48.md)
    'Each world now names the night the singing light went over in its own words: under the sea it is the night the whales went quiet, in the City Floating in Space the night the cables sang, in the Moon Foundry the night the singing went over. Only the City-Shaft still says the sky rang, and when you ask about it you use the words you were just told.',
    'Nobody sends you off to ask somebody else any more. Sister Aube, Mother Ysolde, Sol, Wen, Linnet, Sedge, Bram and Hollin tell you where to go and what to do there, and the pilgrims and passers-by who used to point you at a person point you at the place.',
    'Visitors from other worlds no longer open by telling you their name and where they are from: Fen, Bram, Pip, Marrow, Zazie, Tiv, Kip, Saba and the others start with what they came to see. Five shopkeepers greet you with their own trade instead of the same welcome, and Hale no longer tells you that you sound tired.',
    'Answers that follow what was just said: asking Tull about the clock-winder, Ysse about her crystals’ sound, Senn about the tower, and telling Cael how long the avenue was. Madame Sel knows her own market’s voice in the City Floating in Space, and a few talks lose the moral at their end.',
    'At the Lantern, Ilen explains less: she tells you what she did with your father’s message and leaves out how a light carries a song. At your parents’ stone, each gift is set down as what it is, not as a lesson.',
    // the fight (docs/audits/combat-v1.47.md; issues #106–#109)
    { text: 'With Reduce motion on, the lock-on’s four arrows hold still at the corners of the foe you lock: they no longer turn round it, breathe or whirl in, they simply fade in where they stay.',
      see: 'Turn on Reduce motion in the settings, then lock on to a foe (R3 / Tab): the arrows appear at its corners and stay put.' },
    { text: 'Perfect dodges back to back are rationed. A single one opens the same flurry as ever, but one that follows another within a few seconds is shorter and makes you wait longer before the next: the second lasts about two and a half seconds, the third and any after under two. Pause for a few seconds and the next is whole again.',
      numbers: [
        { title: 'Hopping at every blow of a late pack for 30 seconds: time spent in flurries', unit: 's', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome, two packs a world', rows: [
          { where: 'Lorn', before: 15.9, after: 10.9 },
          { where: 'the City-Shaft', before: 17.4, after: 9.2 },
          { where: 'the Moon Foundry', before: 18.0, after: 11.3 },
          { where: 'the Garden of Spheres', before: 20.2, after: 10.2 },
        ], source: '.claude/skills/combat-review/arena.mjs --pack-clear --clear-dodge --dodge-watch 30' },
        { title: 'Share of your own time spent untouchable, chaining flurries flat out', unit: '%', better: 'lower', device: 'any (from the tuning)', rows: [
          { where: 'a flurry every time one is allowed', before: 74, after: 30 },
        ], source: 'src/flurry.js FLURRY and CHAIN' },
      ] },
    { text: 'Locked on to a small foe a few steps away, the camera no longer lines it up straight behind your back: it stands a little to one side, so the foe and its wind-up stay in view. Circling it, the camera keeps to the side it trails on.',
      numbers: [
        { title: 'Locked-on frames with the foe mostly behind the traveller', unit: '%', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome', rows: [
          { where: 'a horn lizard standing 7 m off: still, circling it, stepping back and in', before: 32, after: 0 },
          { where: 'fighting an ink blot, whenever it is 2.5 m off or more', before: 27, after: 6 },
        ], source: '.claude/skills/camera-qc arena-lock-lizard and arena-lock (foe hidden)' },
      ] },
    'A stunned foe now reels in a slow dizzy circle with little amber stars turning over its head, so you can see it is open to a double cut in any colour vision, not only by its eyes turning pale. A foe knocked off a ledge shows the same stars, now darker and easier to see on pale sand.',
    // the skull cave's doorway (issue #6)
    { text: 'The cave under the giant’s skull no longer stops you just inside: after you drop off the landing, an unseen ridge of the cave’s wall across the doorway held you in the passage. You walk or run straight in now, at any angle. You still need the double jump to get out, and the chest by the pool still waits for a full tank.',
      see: 'Go down the skull’s mouth with the backpack, drop off the landing and walk on toward the pool: nothing stops you in the doorway.' },
  ] },
  { v: '1.47', date: '2026-10-11', items: [
    // the v1.46 audit's loose ends (docs/audits/game-v1.46.md; issues #93-#100, #104)
    { text: 'The Quests page’s Done list now names every quest you have finished, wherever you are: the Lantern’s, the night mail’s and every temple’s, which for the Glass Dunes and the three newest worlds is their whole main quest.',
      see: 'Finish the Casting-House in the Moon Foundry, fly to another world and open the game menu’s Quests page: it is under Done.' },
    { text: 'The Worlds page no longer promises the makers’ jets in the City-Shaft, the Glass Dunes, the Buried Machine or the Signal Market, and the Warden’s Well asks you to ride the draught up, not to jet. Photo mode saves its pictures as hiraeth-…png, and on a phone offers them to the share sheet.',
      see: 'Open the game menu’s Worlds page and read the City-Shaft’s card; press P in a world, then take a picture.' },
    { text: 'The gadget cards, the trials’ start cards and Vael’s wind notices name your own keys and buttons: after remapping a control they show the new one, and only the controller’s names with a controller in hand, only the keyboard’s without.',
      see: 'In Controls, move Jump to another key, then walk into the wind at Vael’s lone tower, or open a trial’s sign: the card names the new key.' },
    { text: 'In French, the lines that teach the controls are French too: the first steps in the desert, the ship’s nudge, the tank’s first fill, the first fight, the hoverbike’s call, the bell, the shell and the horn, and every hint that tells you which button to press. The names of the inputs (“la souris”, “le stick gauche”) are French as well.',
      see: 'Set the Language to Français in the settings, start a new game and wait by the ship’s door: the nudge is in French.' },
    { text: 'Every trial now rewards something you can use straight away. The desert’s Dune line gives the hoverbike dune fins, a higher top speed. The Buried Machine’s run gives the seeing lens its clear glass, the Garden of Spheres’ a fourth bomb pouch, and the Signal Market’s the hourglass’s long sand: each for the gadget found in that same world.',
      see: 'Finish the Dune line on the hoverbike in the desert, then ride flat out: the bike tops out faster.' },
    { text: 'At the stone, keeping Dov’s lift token and saying no to Hollin are remembered too: the traveller names each choice, whichever way it went, and so does Ilen at the end.',
      see: 'Keep Dov’s token in the City-Shaft, or tell Hollin you can’t promise in the Deep Wood, then go home: listen at the stone.' },
    // the finale's play (docs/story-bible.md, "The Lantern"; issue #97)
    { text: 'The Lantern has a last stretch before the meeting. Once the light has come down into the crown, it sings to three lamps round the island’s shore, one at a time, its beam on the one it is singing to. Whistle back by each, with nothing in your hands, and the lamp lights. When all three are lit the light rings out, and Ilen comes out of her house to see who answered.',
      see: 'At the Lantern, walk the sand bar onto the island, then follow the beam to each lamp and press Y / △ (V) beside it.' },
    { text: 'After the Lantern, the sketchbook’s Sightings are answered: under each of the four threads, the singing light, the makers’ sign, the father’s signal and who came this way before, Ilen’s answer in her own words. The makers’ sign’s notes sit in their grid like the others again, instead of spilling off to the side.',
      see: 'Meet Ilen at the Lantern, then open the game menu’s Sketchbook: each thread has its answer under its name.' },
    // the worlds' layout, from the level design audit (issues #42, #40, #102, #19)
    { text: 'In the Buried Machine, the oil pipe the Wick’s valve feeds runs out of the oculus, along the canyon floor, up the sand ramp and over the dunes to the great wheel: once the valve is open, follow it out.',
      see: 'Open the oil valve in the oculus and light the Wick, then follow the pale pipe from the valve out of the drum.' },
    { text: 'Three high places to climb to, each in stages with a deck to rest on: in the City Floating in Space the Balcony’s mast stands on a broad iron foot and its crow’s nest is 44 m up; in the Moon Foundry an old hoist tower climbs to a gallery under the roof, 80 m over the floor; in the Garden of Spheres a white belvedere rises from the pyramid on the white hill.',
      see: 'Climb the Balcony’s mast for Kip’s lamp; in the Moon Foundry, the stepped iron tower between the moon in the claws and the pillar moon; in the Garden, up the white hill’s stairs and the summit temple’s tower.' },
    { text: 'In the Glass Dunes a tall cairn with a long streamer stands on the breaking wave’s crest, 90 m over the valley: walk up its long back from its east end and see the whole basin from the top.',
      see: 'Walk to the east end of the great breaking wave in the north of the Glass Dunes and up its back.' },
    { text: 'Arriving in the Underwater City, the Dock is no longer a bare floor: the divers’ rack with its suits and air tanks, the cargo off the last boat and a stripe painted to the long tube. On the Moon Foundry’s apron a little moon cools in its mould with a worker by it, and carts of slag stand on a siding.',
      see: 'Step off the ship in the Underwater City and in the Moon Foundry and look ahead.' },
    // the desert's ways (docs/systems/worlds.md "The desert's ways, after the empty-hands rewrite"; issue #39)
    { text: 'In the desert, tall poles with red strips lead the hoverbike out of Marrow’s hollow toward the Givers’ Hearth, the pilgrims’ lit road comes down to your ship again instead of where it used to land, and a carved field-stone stands on the dunes between the Givers’ House and your ship: once the House’s water runs, a field grows green beside it.',
      see: 'Ride out of Marrow’s hollow toward the red rocks; after the tree burns, walk the cairns down from the gate; walk home from the Givers’ House toward your ship.' },
    // the motion QC's reds in the default walk (docs/systems/animation.md "The sprint, the stairs, the pivots"; issue #57)
    { text: 'Your legs move more smoothly at a sprint, on stairs and turning on the spot: the knee no longer snaps straight at every sprinting stride, a swinging foot no longer jumps a stair’s height as it passes over an edge, your feet no longer cross as you step round, and the last step of a stop from a run no longer slides.',
      numbers: [
        { title: 'The traveller driven by scripted hands on the test course, the game’s default walk', unit: '', better: 'lower', device: 'Mac (Apple M4 Pro), node (scripts/motion-qc/run.mjs)', rows: [
          { where: 'bone flicks a minute, every gait in turn (sprint included)', before: 14, after: 10 },
          { where: 'bone flicks a minute, up and down the stairs', before: 18, after: 12 },
          { where: 'the worst slide of a stop from a run (cm)', before: 29.4, after: 15.3 },
          { where: 'frames with the feet crossed, turning on the spot (%)', before: 17, after: 6 },
          { where: 'bone flicks a minute, the mean of the 15 runs', before: 10.2, after: 8 },
          { where: 'joint jolts a minute, the mean of the 15 runs', before: 8.9, after: 6.4 },
        ], source: 'the motion QC, before and after on the same machine (.claude/skills/motion-qc)' },
        { title: 'The same course in the game, the Arena’s floor', unit: '', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome', rows: [
          { where: 'bone flicks a minute', before: 27, after: 19 },
          { where: 'joint jolts a minute', before: 24, after: 16 },
        ], source: 'the motion QC in the running game (one run each)' },
      ] },
    // the spot blacks where three planes meet (docs/systems/rendering.md "The visual probes' findings fixed"; issue #28)
    { text: 'Standing in a room’s corner, you and the people you meet no longer cut small pale notches into the dark band along the corner’s foot.',
      see: 'In the Handheld preset, walk into a corner of a desert room and turn the camera round you: the dark band where the walls meet the floor stays whole beside your legs.',
      numbers: [
        { title: 'Pale notches beside a person in a corner’s dark band (the largest, px)', unit: 'px', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome, the Handheld preset, 1280 × 720', rows: [
          { where: 'the desert room’s corner, the traveller', before: 472, after: 0 },
          { where: 'the same corner, Marrow', before: 543, after: 24 },
          { where: 'the Underwater corner', before: 300, after: 16 },
          { where: 'the Qanat tree’s stairs', before: 144, after: 21 },
        ], source: 'the visual audit’s probes (ghost check), before and after on the same spots' },
      ] },
    // the matrix cache (issue #105)
    { text: 'People no longer flicker for a frame into another pose: a body caught mid-move, a rider’s seat after the hoverbike moved, or a lantern just handed from one hand to another is always drawn where it really is.',
      see: 'Walk among the people at the desert’s camps and watch someone pick up or hand over a lantern: no frame shows it in the old hand.' },
    // the enemies against their design sheets, batch 4 (docs/design/enemy-roster.md "Status"; issue #31)
    'The possessed machines look more like their drawings: the furnace brute’s hull is cracked in a lighter net of fine lines, only some of its cracks glowing violet; the bell walker’s spirit now clings to the outside of the bell’s lip, so you can see its eyes and hands from above, and its legs are plated in riveted brass; and the ring drone’s caught cloud spreads out past its plates in curling wisps.',
    // the enemies against their design sheets, batch 5 (docs/design/enemy-roster.md "Status"; issue #33)
    'The late spirits and the roller look more like their drawings: the smoke under a shade’s cloak now hangs in flame-like tongues that curl over at their tips; the pearl roller’s spiral is on one side of its shell only, the Garden’s pearl shell rocks on brass runners as it winds up to bowl at you, and every roller leaves a glistening trail where it grazes; and the glass puppet is see-through glass now, only its edges catching the light.',
    // the dash cut (docs/systems/foes.md "The dash cut"; issue #35)
    'The dash cut comes round sooner, and a dash cut through a creature’s back lands double, with a gold ring round it: evade or hop round a foe that just struck, or catch one turned away from you, and cut.',
    // the enemies against their design sheets, batch 3 (docs/design/enemy-roster.md "Status"; issue #29)
    'Three creatures now match their drawings more closely: the skitters walk on curved, bony legs bowed out like sickles instead of straight sticks; a stilt heron you run at takes off and flies away to wade somewhere else, its legs trailing behind it (walk up to it and it still strides off); and a bellows toad’s swollen throat goes see-through as it winds up its spore lob, so you can see the glob floating inside it.',
  ] },
  { v: '1.46', date: '2026-10-11', items: [
    // nobody sends you to somebody else (docs/systems/story.md "Straight to the end"; issue #85)
    { text: 'In the Signal Market, Madame Sel tells you herself where the tower’s last recording is and how to tune the antenna, instead of sending you to find Kip and then Ferro. Kip hands the recording to anyone who asks for it.',
      see: 'Talk to Madame Sel under the silent tower: she says the cylinder is on the second skybridge. Or skip her and ask Kip what is in his bag.' },
    { text: 'In the City-Shaft, Nima says the fallen splinter lies in the Upward Shrine’s bowl, and from the shrine you carry it straight up to the palace crown: the guard at the gate is someone you pass, no longer a stop on the way.',
      see: 'Talk to Nima on the high terrace, go down to the shrine for the splinter, then go up to the crown without talking to Dov.' },
    { text: 'The City-Shaft’s cab pass is in Tobin’s pocket, written on credit: walk up to him and he hands it over. No more carrying his coin back to Lio.',
      see: 'Get refused by a cab on the rim, then walk up to Tobin by his telescopes.' },
    { text: 'In Viridel, Mira tells you where the fallen ship’s hatch is herself: you no longer have to find Vey and ask her before going in.',
      see: 'Talk to Mira by her water clock, then walk south to the ship and in under the flower arch.' },
    { text: 'In Lorn, Wendel tells you what makes the Great Crystal sing, and the song leads straight to the splinter. Saba still listens at its foot, for whoever wants to know what the new phrase means.',
      see: 'Ask Wendel about the hum, then splash the crystal’s spires three times quickly without talking to Saba.' },
    { text: 'On the Overnight Train, Edda tells you her grandmother rides the last roof, and Solange pulls the cord for the market’s halt herself: no more asking the conductor, twice.',
      see: 'Take Edda’s letter, ring the bell, climb to the last roof and give it to Solange: the train brakes for the halt a minute later.' },
    { text: 'A world’s main quest now counts what you did before anyone told you of it: fetch the splinter, sing the crystal or go into the fallen ship first, and the quest picks up from there.',
      see: 'In the City-Shaft, go down to the Upward Shrine before talking to Nima: Ossa’s splinter starts the quest at its last climb.' },
    // screenshot drafts for the Notes page (docs/systems/notes.md "Screenshot drafts"; issue #8)
    { text: 'The world debug menu can save a screenshot as a draft for the Notes page: the picture, the world, where you stand, the build and the preset. The first time, the game shows a code to enter on the Notes page to pair the device. Drafts wait on the Notes page, apart from the issues, to be written up and sent, or deleted.',
      see: 'In a world, press both sticks (or F2), open the Notes section and choose Screenshot to a Notes draft. Then open the Notes page on your phone.' },
    // the Xbox's frame rate (docs/systems/xbox.md, "Why 20 fps" and "Towards 60 on the Xbox")
    { text: 'On the Xbox the game now holds an even 30 frames a second where it can’t yet reach 60, instead of jumping between 20 and 50, and stays at the TV’s full sharpness: it no longer drops the resolution when the console’s processor, not its graphics chip, is what is slow. Its shadows are drawn as on the Steam Deck, which takes about a sixth of the work off each frame.',
      numbers: [
        { title: 'The desert’s spawn, the Xbox preset: the main thread’s time a frame', unit: 'ms', better: 'lower', device: 'Xbox Series X (Dev Mode, WebView2 150), the game served from the Mac for both builds', rows: [
          { where: 'the main thread', before: 53.6, after: 46.3 },
          { where: 'frames a second', before: 18, after: 21 },
          { where: 'the slowest frames (95th percentile, ms)', before: 66.8, after: 50.7 },
        ], source: 'the frame readout over 8 s and the animation frames over 4 s, after 12 s to settle' },
        { title: 'WebGL calls a frame at the desert’s spawn, the Xbox preset', unit: '', better: 'lower', device: 'Xbox Series X (Dev Mode, WebView2 150)', rows: [
          { where: 'WebGL calls', before: 3244, after: 2762 },
          { where: 'draws', before: 819, after: 661 },
        ], source: 'every WebGL call counted for 4 s (scripts/xbox-probes/glcount.js’s way)' },
        { title: 'The same on a slower Mac: the main thread and the pacing', unit: 'ms', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome on ANGLE Metal, 1920 × 1080, the processor slowed 2.5 times', rows: [
          { where: 'the main thread', before: 25, after: 20 },
          { where: 'frames a second', before: '37–41', after: 30 },
          { where: 'the resolution', before: 0.6, after: 1 },
        ], source: 'scripts/bench/mac-spawn.mjs’s set-up, the frame readout over 6 s' },
      ] },
    { text: 'Every world draws its buildings, rocks and props that never move in a few batches instead of one at a time: a third to a half fewer instructions to the graphics chip each frame on every device, with the same picture.',
      numbers: [
        { title: 'WebGL calls a frame, the Xbox preset, batches off and on in the same game', unit: '', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome on ANGLE Metal, 1920 × 1080 as the console', rows: [
          { where: 'the desert’s spawn', before: 3922, after: 2357 },
          { where: 'the City-Shaft', before: 3369, after: 2291 },
          { where: 'the Signal Market', before: 2528, after: 2105 },
        ], source: 'every WebGL call counted, batches off and on in turns three times (statics.enabled)' },
        { title: 'Draws a frame, the same views', unit: '', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome', rows: [
          { where: 'the desert’s spawn', before: 945, after: 355 },
          { where: 'the City-Shaft', before: 913, after: 461 },
          { where: 'the Signal Market', before: 645, after: 500 },
        ], source: 'the frame readout', note: 'The same frozen frame with the batches off and on: 0.003–0.01 % of the pixels differ, single pixels on ink edges, by at most 16 of 255 at the desert’s spawn.' },
      ] },
    { text: 'Each frame skips more work it had already done: lists of lights and colours sent unchanged at every surface, the settings of textures sent again with the people’s every move, and the walk through the parts of the world with nothing left to draw on their own. A little more time for everything else, most of all on the Xbox.',
      numbers: [
        { title: 'The desert’s spawn, the Xbox preset', unit: '', better: 'lower', device: 'Xbox Series X (Dev Mode, WebView2 150) and the Mac (Apple M4 Pro, headless Chrome)', rows: [
          { where: 'WebGL calls a frame, the console', before: 2588, after: 2493 },
          { where: 'WebGL calls a frame, the Mac', before: 2602, after: 2504 },
          { where: 'array uniforms sent, Mac with the processor slowed 4×, ms a frame', before: 2.1, after: 0.4 },
          { where: 'objects walked a pass, the Mac (props drawn by a batch, bodies’ bones skipped)', before: 5161, after: 2719 },
          { where: 'the main thread, the console, ms (the walk skipped or not, same page)', before: 52.5, after: 51.2 },
        ], source: 'every WebGL call counted for 4 s; V8’s sampling profile' },
      ] },
  ] },
  { v: '1.45', date: '2026-10-11', items: [
    // the author's desert playtest (issues #66, #68, #69, #71, #76)
    'Your backpack’s straps now run over the tops of your shoulders and down your chest to a brass buckle, instead of straight up into your collar beside your ears.',
    'Your ship now comes down closer to Qanat, on the brow of the rise in line with the camps’ lane, and you step out facing the city: its walls, domes and great tree stand in full view across the dunes, no longer half behind the sand your ship ploughed up. The camps’ smoke, the giant’s breath over the back gate and, later, the burning tree’s column are now believable sizes instead of towers over the whole desert.',
    'The desert’s few clouds no longer throw blue patches across the sand: under one, the dunes lost the sun and every shadow in them, with no cloud overhead to say why. The sand behind Qanat, and everywhere else, keeps its sunlight and its shadows.',
    'In the cave under the giant’s skull, the light through the cracks in the vault now falls in soft, broad shafts instead of thin glowing sticks, and the great tree’s roots hang from the vault as a huge braided mass: two twisting bundles splaying into a curtain of long strands over the pool.',
    'The cave under the giant’s skull now asks for the lift valve before it lets you out: the keepers’ stair has fallen at its foot, the way back up the passage is a high ledge, and the cave’s walls give no grip, so you leave with the double jump. Its chest stays shut and silent until the pool has filled your tank, and the skull’s mouth won’t take you down without your backpack.',
    'The lift valve’s chest in the cave now stands on its own round dais by the pool, at the foot of the broken keepers’ stair, in a shaft of light from a crack in the vault, with nothing piled round it: no longer on the floor at a random spot.',
    // the chime pirates (docs/systems/minigames.md "Pirates between worlds", "The controls, against Star Fox"; issue #88)
    { text: 'The chime pirates fly more like Star Fox: your ship eases into the stick’s moves, banks hard, and its nose turns the way it goes, with your shots following it, so you aim by steering. The edge of the screen slows it gently instead of bouncing it back, the camera trails a little behind so the ship moves about the screen, and the barrel roll snaps round.',
      see: 'Fly to a world you have never been to, or play Chime pirates from the Arcade: hold the stick to one side and watch the two aiming squares swing out ahead of the ship.' },
    { text: 'The pirates’ start card says which way the stick tips the ship (forward dives, as in Star Fox) and lets you choose climbs instead.',
      see: 'On the Chime pirates card, under the controls: Stick forward, Dives or Climbs.' },
    { text: 'The fight on the way to a new world can’t be skipped any more. Lose it and you start again from the last checkpoint with your hull patched, and every try is a little kinder, so you always get through.',
      see: 'Lose a pirate fight on the way to a new world: the only button is Retry from the checkpoint.' },
    { text: 'The pirate fight is about a third shorter: their captain turns up after a minute and ten seconds.',
      numbers: [{ title: 'How long the game’s own pilot takes to win the pirate fight', unit: 's', better: 'lower', device: 'Node, the pilot in tests/pirates.test.js, five destinations at four frame rates', rows: [{ where: 'on average', before: 138.5, after: 96 }], source: 'the rules before and after, flown by botInput' }] },
    { text: 'Every pirate ship you shoot down is worth chimes now, up to about 80 a fight, added to your purse when you win.',
      see: 'Shoot pirates down on the way to a new world: each one pops its chimes in teal, and the results card counts them.' },
    // the reel (docs/story-bible.md "The recordings"; issue #90)
    { text: 'The first message from your father, after the desert, makes sense now: the neighbours swore they would help him dig out the dry well, and nobody came. He is bitter about it, and your traveller keeps his thoughts to himself.',
      see: 'Finish the desert and press the blinking button on the ship’s console: the first message plays, the father alone, with no line of your own after it.' },
    // the landing's jets (docs/systems/cinematics.md "Engines"; issue #89)
    'When your ship comes down to land, the flame of its jets stays under it: it no longer shoots up through the hull as the ship drops.',
    // chests earn their place (docs/systems/progression.md; issue #91)
    'No more free chests by your ship when you land in Vael: if you left the desert without going into the Givers’ House, the blade and the guard are still waiting for you there.',
    // the Shadow Room and the shadow QC (docs/systems/rendering.md "The Shadow Room and the shadow QC"; issue #67)
    { text: 'A new test room in the Debug menu, the Shadow Room: thin poles and a grate, a colonnade, leaf cut-outs, an arch under a balcony, a stair, slopes the sun grazes, a dark house, things that move and a tall tower whose shadow crosses the yard, all along one walk. The boards by the spawn hold the sun lower, turn it round, or give it back to the clock.',
      see: 'Open the Debug menu, Test rooms, The Shadow Room. Walk up to the boards on your left at the start and press the interact button on the yellow one a few times: the sun sinks and every shadow in the yard stretches.' },
    { text: 'On the Steam Deck and Handheld settings your own shadow is whole and sharp again and starts right at your feet: it was half drawn, a grey blur round it, and often a hand’s width away from you.',
      numbers: [
        { title: 'How much of the traveller’s shadow is drawn (the Shadow Room’s whole walk, a 35° sun)', unit: '%', better: 'higher', device: 'the Mac, headless Chrome, 1280 × 720 (the shadow QC)', rows: [
          { where: 'Steam Deck', before: 65, after: 93 },
          { where: 'Handheld', before: 50, after: 92 },
          { where: 'High (unchanged)', before: 92, after: 92 },
        ], source: 'the shadow QC (.claude/skills/shadow-qc): his shadow’s true area on the ground (rays through his body as drawn) against the shade the surfaces draw there' },
        { title: 'How far from a planted foot his shadow starts (the worst spots, a 35° sun)', unit: 'cm', better: 'lower', device: 'the Mac, headless Chrome, 1280 × 720 (the shadow QC)', rows: [
          { where: 'Steam Deck', before: '9–27', after: '0–3' },
          { where: 'Handheld', before: '22–51', after: '0–3' },
        ], source: 'the shadow QC, p90 of each spot of the walk' },
        { title: 'What it costs a frame (main thread, renderFrame)', unit: 'ms', better: 'lower', device: 'the Mac, headless Chrome; the Deck’s main thread is about two to three times slower', rows: [
          { where: 'the Signal Market, Steam Deck', before: 5.45, after: 5.85 },
          { where: 'the Signal Market, Handheld', before: 4.75, after: 4.95 },
          { where: 'Edena, Steam Deck', before: 4.75, after: 4.95 },
          { where: 'Edena, Handheld', before: 4.45, after: 4.7 },
        ], source: 'the median of 4 × 40 frames at each world’s start, the traveller’s own shadow map off and on in turns (+9 to 10 draws)' },
      ],
      see: 'Set the graphics to Steam Deck or Handheld and stand in the sun: the shadow of your legs reaches your boots, and your arms and the pack show in it.' },
    { text: 'Shadows no longer come loose from what casts them: the lit strip under a balcony or along the foot of a wall, as tall as 40 cm on Handheld, is gone or a sliver of what it was.',
      numbers: [
        { title: 'Shadow at a contact drawn lit (the Shadow Room’s balcony over its wall, a 35° sun)', unit: '%', better: 'lower', device: 'the Mac, headless Chrome, 1280 × 720 (the shadow QC)', rows: [
          { where: 'High', before: 7.5, after: 0.6 },
          { where: 'Steam Deck', before: 6.0, after: 0 },
          { where: 'Handheld', before: 72, after: 25 },
        ], source: 'the shadow QC: probes shaded by something within 60 cm, drawn lit' },
      ],
      see: 'In the Shadow Room, walk through the arch and look at the wall under the balcony: its shadow starts right under the slab.' },
    // the Givers' Hearth (issue #83)
    { text: 'The fluid gun comes with both its modes now, the push and ember, in one chest in the Givers’ Hearth. That chest stands on a dais in a round room of its own off the hall, under a carved arch, the glowing floor marks leading in to it. A save that had opened either of the two old chests has the gun and ember mode both.',
      see: 'In the Givers’ Hearth, follow the glowing marks on the floor east, away from the stone ball, through the arch with the Givers’ mark over it: the chest waits on its dais under a warm light. Open it and press D-pad → to switch between the push and ember.' },
    { text: 'The Givers’ Hearth’s doorway is open now: walk in under the carved lintel and up the sand that has drifted into the passage, past little lamp-stones, to the dark inner door at its end. The old door looked blocked up by a flat black wall.',
      see: 'Ride to the Givers’ Hearth and stand in front of its porch: the passage runs back into the rock, lit inside. Walk up it to the inner door to go in.' },
    // the hoverbike after the desert (issue #86)
    { text: 'Once you have found the hoverbike in the desert, it comes with you: in Viridel, the Glass Dunes, the Buried Machine and the Garden of Spheres it waits by your ship when you land, and you can whistle for it as in the desert. Where Vael’s bird answers your whistle, the bike stands by the ship to climb on. In the worlds with no room to ride, the domes, the shaft, the islands and the streets, you go on foot.',
      see: 'With the hoverbike found, fly to the Glass Dunes: it stands by the ramp. Ride off, leave it, and whistle (D-pad ↓, or E): it drives back to you.' },
    // fire (issue #77)
    { text: 'Every fire burns you now, as Qanat’s burning tree does: the camp fires, the braziers, the temples’ flames and lit bowls, a burning tar ball, the Wick, hearths, candles and the pilgrims’ lamps. Step out of the flames and it stops.',
      see: 'In the desert, walk into the big camp fire by the pilgrims’ camp: “It burns!”, and a quarter heart goes at a time while you stand in it. Step back out and it stops. A brazier not yet lit doesn’t burn.' },
    // a quieter screen (issues #78, #79, #82, #84, #87)
    { text: 'The screen says one thing at a time: first the name of where you are, then what is said, then the objective, then each notice in turn, and a lesson or a greeting only once the screen is clear. Stepping out of the crashed ship no longer brings up the ship’s words, the objective, a call and a lesson all at once, the desert’s opening words are not said twice, and a makers’ box offered on arrival no longer has a card of its own.',
      see: 'Start a new game and skip the prologue: the region’s name, then the ship’s words and your answer, then the objective, then the camera’s lesson, one after the other.' },
    { text: 'People no longer wave at you whenever you pass: only someone with something you need to hear waves you over, once. Marrow at the wreck calls you once, and Nour says “Psst. Child.” once after the chest opens, not every few seconds until you come over.',
      see: 'Start a new game and stand by the ship: Marrow calls and waves once, then waits. In Qanat, walk past the villagers: they turn to look, nobody waves. Open the chest on the tree and come down: Nour comes to you and calls once.' },
    { text: 'The ship’s ramp has no button any more: walk up into it and you go aboard. The prompt to board at its foot is gone, and the use button there is yours, to talk or pick something up.',
      see: 'Walk away from the ship, come back and walk up into the ramp: the hatch sounds and you are walked aboard. Standing at its foot, nothing is shown.' },
    { text: 'The people round your ship are calmer: nobody strolls past the hull or the ramp any more, and those who stand there (Qanat’s gift-bearers, Marrow at the wreck) shift and breathe more slowly, so the ship’s side is a quiet place to leave from.',
      numbers: [{ title: 'Crowd strollers whose route runs by the ship (within 16 m of the ramp or 18 m of the hull), at load', unit: '', better: 'lower', device: 'headless Chrome against this branch’s own dev server, the route built with and without the calm zones', rows: [
        { where: 'the Underside', before: 3, after: 0 }, { where: 'the City During the Eclipse', before: 1, after: 0 }, { where: 'the Signal Market, the City-Shaft, Qanat', before: 0, after: 0 },
      ], source: 'window.crowd.people: strollers whose route has a point in the zones' }],
      see: 'Finish the desert’s quest and walk back to the ship: the gift-bearers in their half ring stand nearly still while you go aboard.' },
    'What you find in a makers’ chest comes first: its card is a low strip along the bottom of the screen, the name large and what it is and does small beside each other, so the thing held up in the light is never behind the words, on a handheld’s screen too.',
  ] },
  { v: '1.44', date: '2026-10-11', items: [
    // the merged worlds' crossings (docs/systems/worlds.md "The merged worlds' crossings"; issue #19)
    { text: 'At the edge of Vael’s plain stands the riders’ gate, two tall pillars of rose stone where the bird riders set off over the cloud to the stones that fell up. Once the bird has answered you, the scout leads you to it first, then on to Sister Aube.',
      numbers: [
        { title: 'How Vael, Lorn and the Glass Dunes are laid out (the level design audit, 1 to 5)', unit: '', better: 'higher', device: 'Node, the level design audit (scripts/level-design/audit.mjs), each world as the play-through builds it', rows: [
          { where: 'Vael', before: 3.78, after: 4.33 },
          { where: 'Lorn', before: 4.0, after: 4.33 },
          { where: 'the Glass Dunes', before: 3.22, after: 3.89 },
          { where: 'Vael: the longest empty stretch (s)', before: 55, after: 29 },
          { where: 'Lorn: the longest empty stretch on the skiff (s)', before: 30, after: 20 },
        ], source: 'before: the audit with its walk between two shops’ rooms through the sky fixed, so the real walks between the parts count' },
      ],
      see: 'In Vael, once the bird has answered, look south from the landing: the gate stands at the plain’s edge with the cloud beyond. Walk up to it and look at it: the riders’ names are scratched in the pillars.' },
    { text: 'A string of riders’ lanterns now crosses the cloud from the rose cliff north to the gate, with a wide stone halfway where riders waited out a fog. They light with the monks’ lanterns when the bell rings, and Brother Calix sends you home by them, to your ship on the plain.',
      see: 'In Vael, ring the bell and listen with Calix: off the monastery’s north lip the lantern stones lead over the cloud to the riders’ gate, its lantern lit too.' },
    { text: 'Knots of the monks’ old rope way still hang on little floating stones between the monastery and the floating island: Calix tells you to follow them out to the clapper, and the fallen-up tiles home.',
      see: 'In Vael, from the monastery’s east lip by the rope’s post, look east toward the island church: three small stones with frayed rope and planks hanging from them lead the way.' },
    { text: 'Between Lorn’s swamp and the Deep Wood, the keepers’ light now stands in the open water, a lamp tower on stilts that Hollin fills each evening, and the ferry bell hangs on its post off the landing island.',
      see: 'In Lorn, look north from the landing over the water: the coral lamp at the wood’s edge is the keepers’ light, on the way from the crystal cave to Hollin.' },
    { text: 'The water-way Hollin lights for you now runs on south over the open water, past the keepers’ lamp-boat, all the way to your ship.',
      see: 'In Lorn, finish the lamps and tell Hollin at the root cave: follow the lit water-way round the deep water and on south down the channel to the landing.' },
    { text: 'In the Glass Dunes, the float-posts lead from the Clock-House back to your landing flat past the float-blowers’ rack, and a cairn with a streamer stands on the frozen wave’s crest, 33 m up: walk up the wave’s back to it and see both camps from the top.',
      see: 'In the Glass Dunes, after the Clock-House Wim sends you home by the float-posts. The frozen wave is in the middle of the valley; climb its gentle north-west side to the cairn.' },
    // the story's loose ends from the merge (docs/story-bible.md; issue #20)
    { text: 'Ringing the bell under the cloud and lighting the Deep Wood’s lamps close their own pages in the sketchbook again, beside Vael’s and Lorn’s, each with its own closing words.',
      see: 'Ring Vael II’s bell and listen with Calix, then open the Sketchbook: Vael’s row has a second story picture, The Bell Under the Cloud. Lorn’s gets The Lamps Are Kept once you have told Hollin.' },
    { text: 'Each of those stories has its own recording now: after the bell you ask the reel for “bell”, and after the lamps for “lamp”, then “why”.',
      see: 'After the bell (or the lamps), go back to the ship: the voicemail blinks once the world’s own recording has played. Press it at the console.' },
    { text: 'Deep in the Buried Machine, Tull at the oval doors and the numbers scratched on the drum wall now tell of a clock-winder from the Glass Dunes who came down to see the great wheel, where they spoke of a Major from a world no longer on your way.',
      see: 'In the Buried Machine, ask Tull at the oval doors whether anyone else has come down here, then read the scratched numbers by the drum’s doorway. With Wim’s word from the Glass Dunes, the numbers say more.' },
    { text: 'Fen, in the far dome of the Deep Wood, knows the skiff you whistle for in Lorn’s swamp: it was his, lent to Odile and Talo forty years ago, and he gives it to you.',
      see: 'In Lorn, ask Bram at the cave mouth whose skiff that is, then take the skiff out to Fen’s far dome on the deep water.' },
    { text: 'On the Overnight Train, Edda’s grandmother on the last roof is called Solange now, so she is never mixed up with Mireille of the Underwater City, and the credits list the train’s people with the Signal Market’s.',
      see: 'Ring the Signal Market’s halt bell with Edda’s letter, board the train and climb to the last carriage’s roof: Solange reads the letter there. The credits show her under the Signal Market.' },
    // the three new worlds' loose ends (v1.40's batch)
    { text: 'The Arena’s list of temple guardians has the three newest too: the Listener of the Whale-House, the Last Founder of the Casting-House and the Anchor-Warden of the Mooring-House, to spar with in the ring.',
      see: 'In the Arena, open the FOES list and go down to Temple guardians: the Listener, the Last Founder and the Anchor-Warden are there. Call one and step into the ring.' },
    { text: 'The Underwater City, the Moon Foundry and the City Floating in Space each have a makers’ run of their own, built from their temple’s kit: the Sounding walk in the Avenue, three brass horns that wake to the whale-horn’s note; the Moon roll on the foundry floor, two stone moons to roll into their cradles; and the Moorers’ leap off the Towers into the dark, up the void’s breath and over the gulf.',
      see: 'The Sounding walk: the Avenue’s north-west, by Coralie’s café (it wants the whale-horn). The Moon roll: the foundry floor south of Bertil’s furnace. The Moorers’ leap: the Towers’ east edge, by Tamar (it wants the wings). Each has a makers’ sign at its start.' },
    'The films at the end of the Glass Dunes, the Underwater City, the Moon Foundry and the floating city show what they are about: a whale passes close outside the Whale Gallery’s glass, the hung moon is seen whole on its hook, the camera follows the great cable to the Towers with its lamps, and the clock’s first shot no longer jams against the house’s wall.',
    // the jets' trials outside the City-Shaft (issue #21)
    { text: 'The Glass Dunes’ Glass slalom, the Buried Machine’s Canyon dive and the Signal Market’s Avenue run are flown on your wings now, with columns of rising air to climb again on the way, so their rewards can be won: the strong lodestone, the fourth pouch and the racer’s ribbon.',
      see: 'At each trial’s stone (the Glass Dunes by the ship, the Buried Machine on the canyon’s rim north of the landing, the Signal Market at the avenue’s head), start the run, open your wings in the column of rising rings and ride it up, then glide through the rings. In the Canyon dive the column at the canyon’s end lifts you out.' },
    // the progression: empty hands, the Givers' House remade (docs/systems/progression.md "Empty hands", temples.md)
    'You set out with empty hands now. The Givers’ blade and their guard are waiting in the Givers’ House, the rose-stone drum in the dunes east of Qanat, and nothing out in the desert comes to fight you before you have the blade.',
    'The Givers’ House is remade for what you carry. Lean on its first tar ball to roll it through the old flame and into the hooded bowl. Cross its sand pit with a double jump onto the old pier and on again, and find the blade on the dais half-way.',
    'Taking the blade wakes the chamber’s machines, and its doors stay shut until you have broken them.',
    'Cut the corridor’s thorns with the blade. Cut the tar balls along their grooves too: a cut sends them rolling much faster than you can push, so they are still burning when they reach the hooded bowls.',
    'The Givers’ guard is on the far landing of the Hall of Fires. Hold it up to walk into the wind from the Givers’ bellows. At the far end of that hall, strike the eye high on the wall from a double jump.',
    'The Keeper is calmed with what you found. Cut each spoke’s ball out to light the bowls round its cistern. Take its charge on your guard, and it stops and pants: then give it water from your tank. Later, cut a burning ball down a spoke to it.',
    'Ember mode is in the Givers’ Hearth now, beside the fluid gun. If you leave the desert without the blade and the guard, they wait by your ship in the next world.',
    'Your saves keep the sword and the guard you had. A save from inside the old house starts the new one from its door, and if you had calmed the Keeper already, it stays calm.',
    // z-fighting (docs/systems/rendering.md "Z-fighting", the zfight-qc skill)
    'Doorframes, sills, roof edges and wall ends in every temple no longer flicker and stripe where two surfaces lay in the same plane. The Givers’ House has none left, and the other temples have far fewer.',
    // >>> the author’s desert playthrough (issues #58–#73)
    // capes (docs/systems/characters.md "The cloth goes over the forearms and hands")
    'Capes and cloaks hang behind the people who wear them: Nour’s cloak no longer swings out in front of her and stays there when she walks up to talk to you, and nobody’s cape blows forward over their front when they stand with the wind at their back.',
    // the conversation panel (docs/systems/conversations.md "The panel never moves while you read")
    'In conversations the words stay where they are while you read them: the panel is its full size from the first letter, and the answers come up in the room kept for them instead of pushing the words up the screen.',
    // the drone's find (docs/systems/ui.md "What it says")
    // the chests (docs/systems/boxes.md "nothing is fired before there is something to fire it with")
    'The backpack comes out of Qanat’s chest as empty as it is: its glass is dry on the card, and nothing comes up over the card while you read it. After it, he simply has it on his back: no more firing it, and no copy of it flying into him and shrinking away.',
    'Out of the chest by the giant’s pool, the lift valve goes over his shoulder onto the pack with a click instead of being fired like a gun he doesn’t have yet; the same for the other parts of the pack, and the Givers’ blade and guard from their chests in the Givers’ House. Nothing found in a chest shrinks away to nothing any more.',
    'When your empty tank first fills in the giant’s pool, the scene no longer ends with you firing water over the pool with a gun you don’t have yet: the tank’s lights come on, the chest beside the pool hums back, and you turn to it.',
    // the desert's story (docs/systems/story.md "Straight to the end, and nobody sends you to somebody else")
    'In Qanat, Nour sends you straight down the giant after the chest opens: no more fetching Ama’s jar from the camps first. Ama still gives her jar to whoever stops at her fire, and it fills at the pool too.',
    'Nobody in the desert sends you on to somebody else any more: Marrow points you at the humming chest on Qanat’s tree, Nour tells you herself where Marrow hid his hoverbike, and Rook says where it lies.',
    'Nour’s talk is much shorter, and more her own: what the chest gave you, where the water is, and the way down, in a few lines. Every answer you can give follows from what was just said: no more asking who the Givers are before anyone has named them, and the note about your empty tank no longer quotes her before she has spoken.',
    'Quests can be finished by going straight to their end: a step you have already done (the rib off the channel, the tank filled) is passed over, instead of the quest sending you back to someone first.',
    // the quest hints (docs/systems/ui.md "A quest's start looks different")
    'Quests say less, and plainly: when one begins, its card is a single line, a gold ◆ and its name (and its first step beside it with hints full), and every step of every quest is now a few words, like “Walk to Qanat, under the dark tree”. The drone’s find is one line too: the step and how far.',
    'The drone says where it is off to the moment you send it, not once it gets there, and the distance on that line counts down (or up) as you walk.',
    // <<< the author’s desert playthrough
  ] },
  { v: '1.43', date: '2026-10-10', items: [
    // the chime-pirates between worlds (docs/systems/minigames.md "Pirates between worlds")
    { text: 'Pirates between worlds: the first time your ship flies to a world you have never been to, chime-pirates come after it on the way. “They are after your chimes!” Fly on through the dark, among the stars and the drifting rocks, shoot them down, roll away from their fire, and beat their captain’s galleon before you land. Later flights to that world go straight there.',
      see: 'With a save whose ship has power, choose a world on the galactic map that you have never visited: after the take-off the pirates’ card comes up. Or open Debug → Games → Chime pirates. Steer with the left stick, fire with A / ×, hold RT / R2 for a stream of fire, roll with B / ○.' },
    { text: 'Against the pirates, hold the fire button to charge a shot: it locks onto the pirate in your sights, homes in and bursts among them. Teal rings on the way patch the ship’s hull.',
      see: 'In Chime pirates hold A / × (Space): a ring fills round the far sight and LOCK brackets close on a pirate; let go and the gold shot bursts there. Fly through a teal ring after a hit: a pip of hull comes back.' },
    { text: 'The fight on the way can be skipped from its first card, and after two lost runs Skip the fight comes first. The settings have a switch for it, Pirates on the first flight to a new world; with Enemies off there are no pirates either.',
      see: 'On the pirates’ card press B / ○ (Esc) or choose Skip the fight: the ship lands at the world. In the settings, under Game, untick Pirates on the first flight to a new world.' },
    'Chime pirates is in the Debug menu’s Games and on a sign in the Arcade, to play whenever you like.',
    // the makers' chests, after the author's picks (references/Core Objects/Chests/; docs/systems/boxes.md)
    'The makers’ chests have a new look, the same in every world: a rounded cream shell like a river stone, the makers’ star on its top, a thin brass band round it and a glowing jade lens in its front, the same jade as your backpack. When you open one, its top parts in two like petals and jade light rises out of it.',
    'At the heart of each temple the chest is a rarer one: a bud of white stone and gold, jade glowing in its seams, that opens like a flower.',
    // the conversation camera (docs/systems/conversations.md "His face, close (off since v1.42)")
    { text: 'Conversations no longer cut in close on your face: the camera stays back on both of you for the whole talk, whoever is speaking.',
      see: 'Talk to Nour in Qanat, or anyone with a sad or surprised line: the camera holds both of you in view from the first page to the last, with no zoom onto your face when you answer or take in a strong line.' },
    // the lock-on (docs/systems/foes.md "The reticle")
    'The lock-on is four gold arrows turning round the foe and pointing in at it, as in Ocarina of Time: no health bar on it, and no red while the foe winds up (its body shows you that). A new lock flies the arrows in.',
    // paved ground (docs/systems/worlds.md "Paved ground")
    'Flowers grow only where they make sense: none on Qanat’s paved square, its streets or anywhere inside its walls, and none on the Spheres’ white paths and round plaza.',
    // the way through the camps (docs/systems/worlds.md "The way through the camps")
    'The pilgrims’ camps outside Qanat are calmer on the way in: fewer tents and fewer groups of people, a clear way straight through past the big fire to the main gate, and two rows of tall banners down its sides that lead you there from the dunes.',
    // the foes warmed at the load (docs/systems/foes.md "The stutter when a new foe comes in", "Wired in v1.42")
    { text: 'No more frame drops in the Arena when a new kind of foe comes in or the first one falls: every foe the world can field is made ready while it loads.',
      numbers: [
        { title: 'A two-minute fight in the Arena (13 waves)', unit: 'ms', better: 'lower', device: 'Mac (M4 Pro), the shipped bundle in Chrome, High, 1280 × 720', rows: [
          { where: 'worst frame', before: 201.8, after: 22.1 },
          { where: 'frames over 50 ms (count)', before: 12, after: 0 },
          { where: 'GPU programs compiled mid-fight (count)', before: 27, after: 0 },
          { where: '95th percentile frame', before: 4.3, after: 4.5 },
        ], source: 'a scripted fight: the Arena’s waves round a traveller kept alive, locked on and swinging' },
        { title: 'The same fight at Handheld', unit: 'ms', better: 'lower', device: 'Mac (M4 Pro), the shipped bundle in Chrome, Handheld, 1280 × 720', rows: [
          { where: 'worst frame', before: 202.5, after: 19.3 },
          { where: 'frames over 50 ms (count)', before: 6, after: 0 },
          { where: '95th percentile frame', before: 3.4, after: 3.0 },
        ], source: 'the same fight' },
      ],
      see: 'Open the Arena (?level=arena) and fight through its waves: the first appearance of each kind of foe, and the first one you cut down, no longer hitch.' },
  ] },
  { v: '1.42', date: '2026-10-10', items: [
    { text: 'The Notes box grows as you write. Sending clears it immediately for your next thought, while pending or failed notes stay in the list.', see: 'Write several lines in Notes, then Add (or Ctrl/⌘ + Enter). Start the next note immediately; a failed send stays available to retry.' },
    { text: 'The notebook can connect to GitHub again: loading and saving no longer fail before the request is sent.', see: 'With the notebook connected, open Notes to load your issues and add a new line.' },
    { text: 'Notes is now a compact to-do list, with more room to type and a sign-in remembered across visits.', see: 'Open Notes: the entry field sits at the top, with slim margins and a compact list. Returning visits extend this device’s sign-in; Sign out forgets it.' },
    { text: 'The notebook accepts your chosen password and asks you to pause after too many sign-in attempts or rapid submissions.', see: 'After five sign-in attempts within a minute, wait a minute before trying again. An unsent note stays in the composer.' },
    { text: 'A notebook for your thoughts: see the open issues and add a new one a line at a time. Unsent notes stay on your device until you are ready to send them.', see: 'Open Notes from the Pages list, unlock your notebook, write a line and press Enter or Add. Each saved note opens its issue on GitHub.' },
    // the people's colours by how much they matter (src/costumes.js PROMINENCE; docs/systems/characters.md "Prominence")
    'The crowds in the towns wear their world’s colours a little softer now, so the people with a story to tell, the shopkeepers, Tansy and your family stand out among them.',
    // rising air (docs/systems/movement-and-camera.md "Rising air")
    { text: 'In a column of rising air your wings now carry you straight up: no more drifting on forward and out of it. Let go of the stick and it settles you onto its middle and holds you near its top; push the stick to drift out of it the way you want to go.',
      numbers: [
        { title: 'Gliding into a column of rising air and letting go of the stick', unit: '', better: 'lower', device: 'Node, the real traveller gliding into a column 6 m wide and 60 m tall (src/updraft.js, tests/updraft.test.js)', rows: [
          { where: 'how far from its middle you drift while rising, a trial’s wind column (m)', before: 5.8, after: 1.2 },
          { where: 'carried on forward out of its top within 12 s (times)', before: 1, after: 0 },
          { where: 'how high you hang at its top (m below it)', before: 6, after: 0.1 },
        ], source: 'the old columns’ code against the shared ride, the same glide in' },
      ],
      see: 'In Vael’s Aerie, or the makers’ trial columns in Vael, glide into a column of rising rings and let go of the stick: you rise straight up its middle and hang at its top; push the stick to drift out.' },
    // the City-Shaft's air pillars (docs/systems/worlds.md "The City-Shaft's air pillars")
    { text: 'The City-Shaft has pillars of rising air: pale columns of drifting rings and streaks that carry your wings straight back up the shaft. One rises beside the spire from the bottom viaduct to the palace landing, a short one lifts you from the landing past the dome to its crown, and three by the terraces’ edges climb from the depths to above the rim. Fall into one and your wings open by themselves; steer off onto any terrace on the way.',
      see: 'In the City-Shaft, look across the shaft from the rim: the pale columns are the pillars. Glide into one (or fall into it), let go of the stick and you rise; push the stick to drift out over a terrace or the rim.' },
    // the Warden's harness retired (docs/systems/progression.md, docs/systems/temples.md "The tower breathes through its vanes")
    { text: 'The City-Shaft is played on your wings now, with no jets at all: the Warden’s Well’s chest holds the Warden’s bellows instead of the harness. With your wings open they breathe a steady wind down under you that turns the makers’ great vanes. A save that had the harness has the bellows.',
      see: 'Open the chest in the Warden’s Well: the card is the Warden’s bellows, and the backpack keeps its third strength. In a save that had the harness, the gear lists the bellows instead.' },
    { text: 'Inside the Warden’s Well a draught rises from the chest’s plinth up through the ceiling, and on through each iris as it opens: ride it on your wings. A thin breath rises through each great vane and holds you over it, and in rising air your wings hold you still enough to aim and shoot.',
      see: 'In the Warden’s Well, open the chest, jump onto the plinth and hold A / ×: the draught carries you up into the gallery. Walk onto the great vane in its floor, jump and hold A / ×: you hang over it and it turns; aim with LT / L2 and splash the eye over the west shelf.' },
    { text: 'The City-Shaft’s Shaft climb is flown on your wings: from the middle terrace into the halfway air pillar, up through its rings, and out of its top over the rim.',
      see: 'Start the Shaft climb at its stone on the rim by the ship: you begin on the middle terrace; glide into the pillar and rise through the rings.' },
    // the motion QC (docs/systems/animation.md "The motion QC"; .claude/skills/motion-qc)
    { text: 'Your traveller’s legs move more smoothly: his knee no longer snaps straight and bent again as a foot leaves the ground, a landing foot no longer drops onto the ground in a single frame, his feet no longer slap flat, and turning on the spot no longer throws a foot half a metre to one side.',
      numbers: [
        { title: 'The traveller’s legs over scripted walks, runs, turns, pivots, a ramp and stairs', unit: '', better: 'lower', device: 'Node, the game’s traveller on the gait course, 15 scripted runs (scripts/motion-qc/run.mjs)', rows: [
          { where: 'pops a minute (a bone flicking in one frame), on average', before: 19.1, after: 10.2 },
          { where: 'jolts a minute (a joint jumping off its path), on average', before: 15.5, after: 8.9 },
          { where: 'the worst jolt turning on the spot (cm)', before: 20.1, after: 6.2 },
          { where: 'how far a planted step slides, 95th percentile, on average (cm)', before: 9.7, after: 7.0 },
          { where: 'runs within every limit (of 15)', before: 1, after: 4 },
        ], source: 'the motion QC before and after, the same hands on the same course' },
        { title: 'Pops a minute in the game, the same scripted run (walk, jog, sprint, a sprint reversed, a pivot, a turn)', unit: '/min', better: 'lower', device: 'headless Chrome on this Mac, Medium (.claude/skills/motion-qc)', rows: [
          { where: 'the desert’s sand', before: 53, after: 46 },
          { where: 'the Signal Market’s street', before: 53, after: 32 },
          { where: 'the Arena’s floor', before: 53, after: 29 },
        ], source: 'the motion QC in the game, before and after' },
      ],
      see: 'Jog and stop, then tap the stick to turn on the spot: the knee bends as each foot leaves the ground instead of locking straight, and the feet stay where they are as he turns.' },
    { text: 'Motion matching (the developer menu’s switch) now has the game’s own walk, jog and sprint to choose from as well as the motion capture, so it keeps up with your sprint instead of handing back to the plain animation, takes over without a seam, and slides its feet about half as far as before. It is still not as clean as the normal animation, so it stays off.',
      numbers: [
        { title: 'Motion matching over the same scripted runs', unit: '', better: 'lower', device: 'Node, the game’s traveller on the gait course, 15 scripted runs (scripts/motion-qc/run.mjs ?mm=1)', rows: [
          { where: 'how far a planted step slides, 95th percentile, on average (cm)', before: 21.5, after: 11.5 },
          { where: 'pops a minute, on average', before: 24.5, after: 13.4 },
          { where: 'jolts a minute, on average', before: 24.1, after: 14.6 },
          { where: 'the matcher’s time a frame, on average (µs)', before: 50.8, after: 20.0 },
        ], source: 'the motion QC before and after' },
      ],
      see: 'Open the developer menu, switch Motion matching on and sprint: the matcher keeps the pose through the sprint (the Motion page, motion.html, shows it side by side with the normal animation).' },
  ] },
  { v: '1.41', date: '2026-10-10', items: [
    // the glass backpack's find in Qanat (TODO.md "Qanat and the glass backpack")
    'The makers’ chest on Qanat’s tree keeps its secret now: its card says only “A glass backpack? You’ve never seen anything like it. It’s empty though?”',
    'Every makers’ box’s card shows what to press: A / × (Enter on the keyboard) beside Continue, and B / ○ (Esc) beside Skip.',
    'When the chest on the tree opens, only Nour calls out, “Hey you!”, and comes to the tree’s foot to wait for you; nobody else crowds over.',
    'Qanat’s great tree stands rooted in the middle of the town’s square, as in its picture, with no terraces or stairs under it; the houses gather closer round the square, and the well, the stele, Nour’s bench and the ledge with the chest stand at its foot.',
    // the sword (docs/systems/foes.md "The swings", "The charged cut", "Mid-air combos")
    { text: 'Your sword swings are about a quarter quicker: each cut comes out sooner and the full three-swing combo is over in well under two seconds.',
      numbers: [
        { title: 'The sword’s combo', unit: 's', better: 'lower', device: 'the blade’s tuning (src/fluid-blade.js SWINGS), the same on every device', rows: [
          { where: 'from the press to the first cut', before: 0.22, after: 0.16 },
          { where: 'from the press to the heavy third’s cut', before: 1.72, after: 1.30 },
          { where: 'the whole combo, first press to the end of the third', before: 2.28, after: 1.73 },
          { where: 'the pause after it', before: 0.5, after: 0.4 },
        ], source: 'SWINGS wind / active / recover, BLADE.cooldown' },
      ],
      see: 'In the Arena (?level=arena) call a foe and press RB / R1 three times: the three cuts follow each other faster than before.' },
    { text: 'The first swing no longer winds up strangely now and then: the sword is snatched from your back straight into the cut, and a press held a moment too long is just a swing.',
      see: 'Stand out of a fight until the sword goes onto your back, then press RB / R1 (or a left click): the first cut comes straight out, with no reach over the shoulder first. Press and hold for about a quarter of a second: still a plain swing, not a half-drawn charge.' },
    { text: 'Hold the attack button to charge your sword: the swing cuts, then you sink into your knees with the blade drawn back as motes of fluid gather into it, and once it is full you tremble with it. Let go to unleash it.',
      see: 'In the Arena hold RB / R1 (or the left mouse button): after the first cut he draws the sword back over his shoulder, crouches a little and the blade gathers drops of light; after nearly a second a ring flashes at his feet and he starts to tremble. Let go to sweep.' },
    { text: 'Mid-air sword combos: jump and attack for two quick cuts that hold you up in the air, then a third that plunges you down onto your foe.',
      see: 'In the Arena jump (A / ×) and press RB / R1 three times while in the air: two cuts keep you aloft, the third drives you down in an overhead cleave. Try it on a moth or a drone.' },
    { text: 'Locked on, stepping left and right no longer jerks between the steps: changing sides eases from one into the other, and no forward stop or turn plays under your feet any more.',
      numbers: [
        { title: 'Locked on, stepping left, right and standing still in turn (8 s)', unit: '', better: 'lower', device: 'Node, the coral-shirt traveller with the captured moves (tests/strafe.test.js’s walk)', rows: [
          { where: 'the largest turn of a bone in one frame (rad)', before: 1.64, after: 0.38 },
          { where: 'frames where a bone turned more than 0.25 rad', before: 151, after: 34 },
          { where: 'frames with a start, stop or pivot playing under the steps', before: 263, after: 0 },
        ], source: 'a script driving the real Player and Animator, before and after the fix' },
      ],
      see: 'In the Arena call a foe, lock on (R3) and walk left, then right, then left again: the steps change over smoothly.' },
    // the lock-on's mark (docs/systems/foes.md "The lock-on")
    { text: 'The lock-on mark is easier to see: bolder corners with a soft light edge that reads on dark rock and bright sand alike, a pointed marker over the foe that bobs gently, and a quick pulse as the lock lands. It is drawn larger on a handheld’s small screen and still frames a far-off foe clearly.',
      see: 'In the Arena call a foe from the FOES list and press R3 (Tab): the four corners frame it and the marker over its head points down at it. Try it on a crab across the ring, and on a small screen.' },
    // the gadget wheel (docs/systems/gadgets.md "On the screen")
    { text: 'On a controller you pick from the gadget wheel with the right stick now: hold D-pad ↑ to open it, point the right stick at a gadget and let go. The camera holds still while the wheel is open.',
      see: 'With two or more gadgets, hold D-pad ↑: the wheel opens; push the right stick toward a gadget and let go of D-pad ↑ to take it in hand.' },
    // the gun locked on (docs/systems/foes.md "The lock-on")
    { text: 'Aiming the fluid gun while locked on keeps the crosshair on your foe: the camera turns over your shoulder to hold it in the sights, and a shot near it goes to it.',
      see: 'In the Arena take the fluid gun in hand, call a foe, lock on (R3) and hold LT / L2: the crosshair settles on the foe and stays there as it moves; RT / R2 hits it.' },
    // creatures, crabs and bodies (docs/systems/living-world.md, docs/systems/foes.md "Bodies")
    { text: 'Small creatures let you come closer and run off less: they only back away when you are almost on top of them, a run or a landing startles only the ones nearby, and a sword swing that catches one bonks it head over heels. It sits a moment, dazed under twinkling stars, then trots off unharmed.',
      numbers: [
        { title: 'How close a creature lets you come', unit: 'm', better: 'lower', device: 'the creatures’ tuning (src/wildlife.js WARY), most species', rows: [
          { where: 'it starts backing away', before: '4–5', after: '1.4–2.3' },
          { where: 'walking up sets off its surprise', before: 3.2, after: 1.3 },
          { where: 'a run startles it from', before: 9, after: 5.5 },
          { where: 'the sword’s reach, for comparison', before: 2.9, after: 2.9 },
        ], source: 'WARY, BONK' },
      ],
      see: 'In the desert walk up to a puff lizard: it lets you stand right next to it. Swing the sword (RB / R1) through it: it flips over, lands dazed with stars over its head, and wanders off after a couple of seconds.' },
    { text: 'Shellback crabs are quicker to beat: they have less health, and a heavy blow (the combo’s third swing, a charged cut, a plunge from the air) bites through the shell from the front for half its harm instead of glancing off.',
      numbers: [
        { title: 'A shellback crab', unit: '', better: 'lower', device: 'the crab’s tuning (src/enemies/archetypes.js, src/foes.js SHELL)', rows: [
          { where: 'health', before: 4, after: 3 },
          { where: 'light cuts from the side or behind to beat it', before: 4, after: 3 },
          { where: 'harm of the heavy third swing from the front', before: 0, after: 1.5 },
        ], source: 'Foe.hit' },
      ],
      see: 'In the Arena call a shellback crab: a light cut still glances off its shell from the front, but the third swing of the combo or a charged cut gets through.' },
    { text: 'You can no longer walk through enemies: you bump against them and slide round their sides, while small ones like skitters are nudged aside. An evade or a dash cut still slips past.',
      see: 'In the Arena call a crab and walk straight into it: you stop at its shell. Walk into a skitter swarm and they scatter out of your way.' },
    // potions and the low-health cue (docs/systems/items.md "Hearts, magic and potions")
    { text: 'Foes sometimes leave a healing potion where they fall, more often when you are hurt or out of potions: a little red flask that pops out, lands and bobs over a warm glow until you walk over it.',
      see: 'Fight a few foes in any world with fewer than five potions: now and then one leaves a red flask; walk over it and the potion count by your hearts goes up.' },
    { text: 'At one heart or less you hear a soft heartbeat and the edges of the screen darken with it, for a few beats when you fall that low and again if you are hit there; then only a faint tint stays until you heal.',
      see: 'In the Arena let a foe hit you down to one heart: a low double thump plays six times while the screen’s edges pulse a warm red, then settles to a faint tint. Drink a potion (D-pad ←) and it fades away.' },
    // hits: the black blocks and the noise (docs/systems/foes.md "The look")
    { text: 'No more black blotches flashing round your sword in a fight: now and then, mid-swing, dark blocks would flicker over you, the foe and the glowing braziers nearby. They came from a tiny maths slip in how the blade (and a glowing foe’s rim) was lit, not from shadows, and they are gone.',
      numbers: [
        { title: 'Frames with black blocks while swinging in the Arena', unit: '', better: 'lower', device: 'Mac, headless Chrome on the GPU, Medium, 1280 × 720; a frame every ~45 ms through combos', rows: [
          { where: 'swinging into a blot (144 frames)', before: '3–5', after: 0 },
          { where: 'swinging at the air (144 frames)', before: 3, after: 0 },
          { where: 'standing still (90 frames)', before: 0, after: 0 },
        ], source: 'a script counting near-black pixels in the middle of the screen, before and after the fix' },
      ],
      see: 'In the Arena swing the sword a few dozen times near the braziers by the gate: no dark blocks flicker over the picture any more.' },
    { text: 'Hits are cleaner: a sword cut throws a few drops instead of a burst, foes splash less when struck and when they fall, and the swing’s own sparks are fewer, so you can see the fight through the effects.',
      numbers: [
        { title: 'Bits of fluid in the air through three combos into a blot', unit: '', better: 'lower', device: 'Mac, headless Chrome, the Arena, 45 samples', rows: [
          { where: 'drops at the busiest moment', before: 161, after: 99 },
          { where: 'glints at the busiest moment', before: 45, after: 25 },
          { where: 'drops and glints on average', before: 93.5, after: 56.9 },
        ], source: 'tool.drops and tool.glow counted during the same scripted combos' },
      ],
      see: 'In the Arena cut a blot a few times: each hit leaves a small splash of its own colour and a ripple up the blade, and the screen stays readable.' },
    // the Arena's floor lines (docs/systems/foes.md "The Arena")
    { text: 'The Arena’s floor lines no longer shimmer as you walk toward or away from them: the rings and ticks are painted into the sand, so a far line stays one steady band instead of breaking into crawling dashes.',
      numbers: [
        { title: 'The Arena floor’s lines walking back 4 cm a frame', unit: 'px', better: 'lower', device: 'Mac, headless Chrome on the GPU, Medium, 1280 × 720, the floor’s band of the screen, 30 frames', rows: [
          { where: 'pixels that change sharply between frames (the far rings)', before: 523, after: 171 },
          { where: 'the same with no markings at all (the floor alone)', before: 0, after: 0 },
        ], source: 'a script stepping the camera back and diffing neighbouring frames' },
      ],
      see: 'In the Arena walk slowly from the centre mark toward a gate, then back, watching the big ring on the floor: it stays a steady line.' },
  ] },
  { v: '1.40', date: '2026-10-10', items: [
    // the camera in tight places (docs/systems/movement-and-camera.md "The camera QC and what it fixed")
    { text: 'In tight places the camera no longer jumps about. Walking through the Overnight Train’s carriages it used to snap in and out at every door and porch and whip round behind your head; now it holds its place and turns to follow you through a doorway, glides in when a wall comes between you, and slides past rows of seats, window frames and compartment doors without pumping in and out. It stays inside the room it is in, rises more gently with a hop under a low ceiling, and tips down over your head when a corridor is too narrow to stand back in.',
      numbers: [
        { title: 'The camera walking through the Overnight Train, deck to balcony (42 s)', unit: '', better: 'lower', device: 'Mac, headless Chrome on the GPU, Medium, 1280 × 720, the camera QC’s scripted walk with the camera turned after the way', rows: [
          { where: 'pops (the camera in or out by more than 25 cm in a frame)', before: 14, after: 0 },
          { where: 'jumps in its path', before: 37, after: 1 },
          { where: 'turns of the view nobody asked for', before: 21, after: 0 },
          { where: 'frames with you out of the picture (%)', before: 6.1, after: 0 },
        ], source: '.claude/skills/camera-qc (run.mjs), the same scenario before and after' },
        { title: 'The other carriages’ scenarios: pops / turns nobody asked for', unit: '', better: 'lower', device: 'the same run', rows: [
          { where: 'at a run through the train', before: '15 / 33', after: '0 / 1' },
          { where: 'the sleeping car’s corridor, turned round in', before: '7 / 18', after: '0 / 1' },
          { where: 'hopping along the dining car', before: '2 / 1', after: '0 / 1' },
        ], source: '.claude/skills/camera-qc' },
      ],
      see: 'Open the game with ?level=overnighttrain and walk forward from the ship through the library, the sleeping cars and the dining car to the lounge, turning the camera after you at the doors.' },
    'The Overnight Train’s end doors are wider and its sleeping cars’ vestibules roomier, with space to turn from the corridor to the door; its windows are glazed (nobody steps out of one any more), and its strollers keep to the lounge and the landing wagon, out of the narrow aisles.',
    // the Overnight Train, running, and the night mail (docs/systems/worlds.md "The Overnight Train", docs/story-bible.md "The night mail")
    'The Overnight Train is on the move: it no longer waits at stations, it runs. The plain, the poles and the far buttes race past, signal gantries sweep their shadows along the roofs, the carriages rock gently and bump over the rail joints (watch the horizon from a window), and up on the roofs the wind blows from the nose.',
    'A new errand in the Signal Market, The Night Mail: past the landing at the south end, a line of rail runs out into the dark to a night halt, where Edda keeps the lamp. Ring the bell and the Overnight Train stops for you. Take her letter to her grandmother Mireille, who rides the roofs at the very back by her chalk mark, ask Ambrose the conductor to stop at the market, and step down with her answer.',
    'The Overnight Train has left the ship’s map: it is reached from the Signal Market’s night halt now, and a save made aboard wakes on the moving train.',
    // the performance pass (docs/audits/perf-v1.40.md, docs/systems/performance.md "A body's repeated parts in one draw")
    { text: 'Fights with many creatures run smoother: the parts of a creature that share a shape and a colour (a centipede’s legs, a jelly’s beads, a moth’s wing ribs, a tripod’s struts) are drawn together in one go instead of one by one. A full pack in the Arena takes about half the drawing work it did; the creatures look exactly as before.',
      numbers: [
        { title: 'The main thread’s time a frame, the Arena with all 21 kinds of creature in view', unit: 'ms', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome on ANGLE Metal, 1280 × 720 (the Deck at 1280 × 800)', rows: [
          { where: 'High', before: 7.0, after: 5.7 },
          { where: 'Steam Deck preset', before: 5.6, after: 4.8 },
          { where: 'Handheld', before: 6.3, after: 5.0 },
        ], source: 'High and the Deck preset: the batches switched off and on in turns in the same page, six times each (medians); Handheld: the build before and after, one run each; measured while the Mac was shared (load average 5–25): docs/audits/perf-v1.40.md' },
        { title: 'Draw calls a frame, the same view', unit: 'draws', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome', rows: [
          { where: 'High', before: 2775, after: 1463 },
          { where: 'Steam Deck preset', before: 2065, after: 1075 },
          { where: 'Handheld', before: 1795, after: 1017 },
        ], source: 'renderer.info over the recorded frames (medians)' },
      ] },
    { text: 'Busy views draw less: the City-Shaft’s flying cabs, its cables and its billboards, every shop front, the makers’ runs’ moving pieces, the wind columns’ rings and the listening stones and flowers that wake as you pass are drawn in far fewer pieces. Nothing looks different.',
      numbers: [{ title: 'Draw calls a frame', unit: 'draws', better: 'lower', device: 'Mac (Apple M4 Pro), headless Chrome, High, 1280 × 720', rows: [
        { where: 'the City-Shaft, the wide view down the shaft', before: 1640, after: 1342 },
        { where: 'the Buried Machine’s shop front (Ilse’s dome)', before: 38, after: 12 },
        { where: 'the Buried Machine, the wide view', before: 547, after: 493 },
        { where: 'the Signal Market’s start', before: 817, after: 783 },
      ], source: 'one frame with every shadow map drawn again, counted object by object (renderer.info), before and after; docs/audits/perf-v1.40.md', note: 'On the Mac the main thread’s time hardly moves in these views (the City-Shaft about 0.4 ms less at High and Handheld, within the noise on the Deck preset); the fewer draws matter most where the processor is the limit, on the handhelds.' }] },
    // the route: three detours become full worlds (docs/systems/worlds.md "Three detours on the route")
    'The route is twelve places now: three worlds you could only visit as detours are full worlds on it, each with a story, people with errands, a temple, a shop, a trial, boxes, relics and creatures of their own. The Underwater City comes fifth, after Viridel; the Moon Foundry ninth, after the Buried Machine; the City Floating in Space eleventh, just before the Signal Market.',
    // the Underwater City
    'The Underwater City is rebuilt so you never swim: it is a city of glass domes on the sea floor, joined by sealed glass tubes. Your ship comes down through the city’s lock into the Dock. Walk the long tube to the Avenue and its cafés under the greatest dome, the kelp garden, the round Plaza with its column of glowing water, and down a sloping tube to the Whale Gallery over the deep. The sea, the towers of pods, the mantas and the whales are all on the other side of the glass.',
    'A lift in the Plaza’s column carries you up to the Crown, a glass bubble just under the surface, where old Fabre keeps the city’s lamps.',
    'In the Underwater City the whales have kept away since the night the sky rang, and the glass hums one wrong note. Maelle, who listens to them in the Whale Gallery, sends you to the makers’ Whale-House on the sea floor north of the Plaza.',
    // the Moon Foundry
    'The Moon Foundry is on the route: since the night the sky rang, every hung moon has turned toward where the light went, and at night the makers’ Casting-House on the east of the floor pours by itself. Ilse, who keeps the founders’ ledger at its door, sends you in. Inside, the founders’ tongs let your push roll the iron moons a plain push can’t move, and a moon rolled through a casting flame comes out hot.',
    'At the bottom of the Casting-House the Last Founder still casts moons that crack. Splash its molten heart when its crucible opens; later it stops to look at an iron moon in its casting cradle.',
    // the City Floating in Space
    'The City Floating in Space is on the route, with a seventh island: the Moorings, up a bridge north of the Towers, and on it the makers’ Mooring-House, whose great capstan holds the islands together. Since the night the sky rang the islands drift apart a hand’s width a night. Joss the moorer sends you in, where tether mode, a fluid line that pulls things toward you instead of pushing them away, brings home balls you can’t reach and wakes the moorers’ rings.',
    'Three tall lamp-masts stand over the floating city’s roofs, on the Market, the Garden and the Balcony; you can climb the Balcony’s to its crow’s nest.',
    // people and errands
    'New errands in each of the three: carry Mireille’s glow-kelp cutting up the lift to Fabre, and take his word down to Maelle; take Ottilie’s mended ladle-hook to Bertil at the furnace, and count the moons for Wen from the lookout on the pillar; take Madame Sel’s notes to Tamar under her cables, and hang one of Kip’s lamps in the Balcony’s crow’s nest. Parcels go on along the route into and out of each world too.',
    'Each of the three speaks and writes its own way now: the Underwater City in bubble rows, the Moon Foundry in moon stamps, the floating city in knots on a cable.',
    // shops, trials, gifts
    'Three new shops: Odette’s Air-Shop in a shell house under the Avenue’s dome, Gunnar’s Crucible on the foundry floor, and Amaro’s Oil-Lamp Shop on the floating city’s Pier. The City-Shaft and the Buried Machine sell one heart container fewer, so every heart you can buy still fits.',
    'Three new trials: the Tube run through the Underwater City’s halls, the Floor round of the foundry, and the Courier’s round over the floating city’s bridges, each with a keepsake for the finish.',
    'Three new gifts in the makers’ boxes: the diver’s pearl (running tires you a third less), the pocket bellows (stamina comes back twice as fast) and the star-thread (you climb a third faster).',
    'The galactic map fits twelve worlds and home on a small screen, and the Items page lays its gear out ten to a row.',
    // fewer shader programs to compile (docs/systems/performance.md "Fewer surface programs")
    { text: 'Worlds load faster on the Xbox: fewer drawing programs to prepare (no copy for a surface that only differs in which side faces you or in its colours), and the ink pass leaves out the sky’s eclipse, space, planets and dotted clouds where a world has none. Nothing looks different.',
      numbers: [{ title: 'Preparing what the Desert’s first view draws, one program after another', unit: 's', better: 'lower', device: 'Xbox Series X, Dev Mode (app type Game), ANGLE on D3D11, every program compiled cold', rows: [
        { where: 'the programs the view draws (39 → 32): compiling', before: 34.0, after: 28.4 },
        { where: 'the same: their first draw into the picture (compiled again by the console)', before: 69.9, after: 60.5 },
        { where: 'the ink pass alone', before: 10.7, after: 6.6 },
      ], source: 'scripts/xbox-shaders.mjs --draw on the programs scripts/load-breakdown.mjs --dump took from the Desert’s spawn', note: 'Sharing small touches between surfaces made fewer programs but slower ones on the console; that part was taken out again.' }] },
  ] },
  { v: '1.39', date: '2026-10-10', items: [
    // the fight, closer to Breath of the Wild's (docs/systems/foes.md)
    'The third swing of the sword’s combo is a heavy blow with both feet on the ground: the sword raised high over a longer wind-up and brought down hard, with a nudge of the camera, for the same three hearts and the same knock back. It was a leap into the air.',
    'The lock-on’s mark is quieter: four fine ink ticks at the corners of the foe and a small diamond over its head that settles onto it, instead of thick gold chevrons over its body. It still turns coral and closes in as a blow winds up, pale blue with its ticks turned in when the foe is open, and dashed when it can’t be cut; the pips over it count what is left.',
    // merged worlds (docs/systems/worlds.md "Merged and dismissed worlds")
    'Vael and the sky stones are one world now: the needle plain lies north, and the plateaus over the cloud lie south of it. The lone tower stands where the sky stones’ tower stood. Both temples, both stories, both trials and both shops are there, and one trip to Vael covers them all.',
    'Lorn opens into the Deep Wood: go north from the swamp and it turns into the wood, its half-transparent giant mushrooms glowing among the trunks. Its lamp-keepers, its Lamp-House and its people are all there, in the same world as the swamp.',
    // the Glass Dunes on the route
    'The Glass Dunes are on the route now, in place of the Sealed Hangar, sixth on the map. East of the valley a clock tower stands in the sand, the Clock-House, its great cogs half buried round it; Wim, who winds the glassworkers’ clocks, sends you down to the Clockwork Foreman. Set it right and every clock in the dunes keeps the same time.',
    'The Glass Dunes have more to find: Marit’s Kiln-Stall by the ship, a makers’ court, makers’ boxes, a slalom round the glass pillars and a makers’ run, relics in the sand, three glassworkers to talk to, cog mice and glass hoppers, and a keepsake of their own.',
    // the route
    'The route is nine places now: the desert, Vael, Lorn, Viridel, the City-Shaft, the Glass Dunes, the Buried Machine, the Garden of Spheres and the Signal Market. The Sealed Hangar and the Atelier leave the map and the world list; their people are kept for later.',
    'Saves carry over: a save left in the sky stones or the Deep Wood wakes in Vael or Lorn where you stood, one left in the Sealed Hangar wakes at the Glass Dunes’ landing, and everything you had done there stays done.',
    // the load on a slow graphics chip (the Xbox app: docs/systems/xbox.md "The slow load")
    { text: 'A new game no longer sits for minutes on “mixing the inks…” when the graphics chip can’t keep up: the load draws what you will see first and spends at most a few seconds drawing ahead the rooms behind the doors, which are drawn as you come near them instead. On the Xbox the app also keeps its compiled shaders from one launch to the next.', see: 'On the Xbox app (or any slow graphics chip), start a new game: the loading screen goes past “mixing the inks…” in seconds rather than minutes; the second launch is quicker still.' },
    'Locked on, jump with the stick held back is a back flip away from the foe, and held to a side a quick side hop. Each slips through a blow for a moment. Not locked on, or toward the foe, jump is still a jump, and the double jump stays.',
    'Flip or hop away just before a blow lands and time slows round you for a few seconds: the foe and the world crawl, a soft pastel haze closes in at the edges of the screen, nothing can touch you, and your sword reaches it from further off, swing after swing. It works against every creature and machine and against the temple guardians.',
    'You can lock on to a temple guardian in its fight, as to any foe: the mark frames it and reads its moves, and the camera keeps it ahead.',
    'A defeated foe lies where it fell for a second, then goes out in a little puff of pastel smoke instead of shrinking away.',
    // the Steam Deck's performance pass (docs/systems/performance.md "The Steam Deck, round 2")
    { text: 'The Steam Deck runs smoother in busy places: its graphics preset draws the sun’s shadows in one pass fewer, with a sharper map near you so they look the same, people’s cloaks sway in the wind within 14 m (further off they hang still), and the game no longer recomputes the place of everything in the world each frame when it has not moved. The Deck’s processor, not its graphics chip, was what held it back.',
      numbers: [{ title: 'The main thread’s time a frame, one change at a time', unit: 'ms', better: 'lower', device: 'Steam Deck OLED, Steam Deck preset, 1280 × 800, gamescope (headless), ANGLE on GL, the Desert’s camps', rows: [
        { where: 'shadows: no fine map, a sharper near map', before: 32.7, after: 30.4 },
        { where: 'matrices only where something moved', before: 33.6, after: 32.3 },
        { where: 'shadow maps drawn unsorted', before: 32.4, after: 31.7 },
      ], source: 'scripts/bench/deck-worlds.mjs, each change toggled in the running game three times (medians)', note: 'The graphics chip’s time a frame went from 12.05 to 12.6 ms with the sharper near map; it was never the limit (8–13 ms against 17–37 ms of the main thread).' }] },
    { text: 'Loading a world on the Steam Deck is about a second quicker: the loading screen stops waiting for a signal the Deck’s graphics driver never sends, once it has found that out the first time.',
      numbers: [{ title: 'Waiting for the graphics driver during a load', unit: 'ms', better: 'lower', device: 'Steam Deck OLED, ANGLE on GL', rows: [
        { where: 'every world, from the second load on', before: '751–1544', after: 0 },
      ], source: 'the loads’ “gpu pacer” warnings over the DevTools protocol (scripts/bench/deck-worlds.mjs)' }],
      see: 'Start two worlds in a row on the Steam Deck: the second one passes “mixing the inks…” a little sooner.' },
    // the Xbox app (docs/systems/xbox.md)
    'On the Xbox the controller works on the title screen and in the game: the console told the game it never had the focus, so every press was ignored.',
    'On the Xbox, A, B and the D-pad’s right reach the game: the app reads the controller itself and passes every press on, since the console’s web view only ever saw some of the D-pad.',
    // the 100-second title (docs/systems/xbox.md "The 100-second title")
    { text: 'The title screen shows its world at once: a picture of the shot, drawn by the game ahead of time, is there from the first moment, and the living world fades in over it when it is ready. On the Xbox the picture stays: making the world there took one to two minutes on a first launch, and the menu froze for seconds at a time meanwhile. Any computer that took that long once keeps the picture from then on.',
      numbers: [{ title: 'Until the title’s world shows', unit: 's', better: 'lower', device: 'Xbox Series X, Developer Mode, WebView2 150 (ANGLE on D3D11)', rows: [
        { where: 'first launch (no shader cache)', before: '100–131', after: 'at once (the picture)' },
        { where: 'launched again (cache kept)', before: '20–46', after: 'at once (the picture)' },
        { where: 'the longest the menu froze meanwhile', before: 22.6, after: 0 },
      ], source: 'window.title.timing and long tasks over the console’s DevTools relay (scripts/xbox-devtools.mjs); first launch measured with every shader made new (B4, the underwater city)', note: 'Each of the world’s 38 graphics programs took about a second to prepare on the console, and the ink pass 22–28 s.' }],
      see: 'Open the game: the title’s world is there at once instead of plain paper; on a computer it comes alive a few seconds later.' },
    { text: 'The ink pass that draws every frame’s lines is quicker to prepare: its debug views and the handheld’s lighter version are only built in when they are used. On the Xbox that pass took 28 s to get ready before a world could show; now 16.5 s.',
      numbers: [{ title: 'Preparing the ink pass', unit: 's', better: 'lower', device: 'Xbox Series X, WebView2 150 (ANGLE on D3D11), Vael’s look', rows: [
        { where: 'compile and link, from nothing', before: 28.0, after: 16.5 },
      ], source: 'the pass compiled on the console with and without them, over the DevTools relay' }] },
    // the Arena (docs/systems/foes.md "The Arena")
    'The Arena is a real arena now: a round fighting floor of packed sand with its ring markings, a stone wall with tiers of seats round it, two gates with braziers burning beside them and banners along the top. Nothing grows or stands in the ring any more; the Ink tide sign and the hitbox board wait by the south gate.',
    'The title screen shows the build number and commit after the version, so you can tell which build a device runs.',
    // the desert's burning tree and the giant ribcage, after the picked references (docs/systems/worlds.md)
    'Qanat’s great tree is rebuilt after its picture: an enormous pale trunk, fluted and cracked, great roots flowing out over the square, one low arm arching down over Nour’s bench, and a wide crown whose leaves are the fire itself, violet, teal and gold, glowing over the city once the tree burns again. While it is cold its limbs stand bare.',
    'The makers’ chest on the tree now waits on a plank shelf on the buttress root, the makers’ glyph painted on its boards and cloths tied to its corners; pilgrims’ lanterns stand round the terrace. The climb up to it is the same.',
    'The giant ribcage south of the start is rebuilt too: a fallen giant lying on its side, a long spine of vertebrae half sunk in the sand, nine great ribs arching over you like a ruined hall, one broken, holes worn through the bone, and the skull at the head end with two horns curving up and two tusks reaching forward. A scrap of red cloth and a faint track of footprints lead to Teo’s drum under its middle rib.',
  ] },
  { v: '1.38', date: '2026-10-10', items: [
    // the progression rewrite (docs/systems/progression.md): the sword alone at the start
    'You start out with your sword alone. The backpack from Qanat’s chest is a container at first: its strengths come later, and the fluid gun is a find of its own.',
    'The double jump is the backpack’s first strength, the lift valve, in a makers’ chest beside the giant’s pool: press jump again in the air for a second jump, with a front flip. Once each time you leave the ground: the old boost that went again and again while the magic lasted is gone.',
    'The fluid gun waits in the Givers’ Hearth, by the stone ball it rolls. It is a gadget like the others: choose it with D-pad ↑ (B), aim with LT / L2 and shoot with RT / R2, and D-pad → (X) takes its next mode, push among them.',
    // the triggers and the gadget in hand (docs/systems/controls.md)
    'LT / L2 aims and RT / R2 uses whatever gadget is in hand. The hook, the bombs, the boomerang, the bubble wand and the hourglass take aim on LT and let fly on RT (RT alone uses them at once); the fan, the spring boots, the magnet glove and the ink pen work on RT; the seeing lens comes up on either. D-pad → takes the gadget’s next mode, and says so when it has none.',
    'Y / △ sounds the bell-note whistle and the echo shell whatever is in hand, and the gadget wheel holds the gadgets only. Riding, Y / △ is still the gadget in hand (the fan into a skiff’s sail).',
    'The jets fire when you hold jump in the air, on a controller too, instead of on RT / R2; with the wings found, jump held with L3 (Shift) glides.',
    'The Warden’s Well in the City-Shaft now holds the Warden’s harness: jets that fly in the City-Shaft only. The jets that flew everywhere were too strong for the worlds and are out of play (a save that had them keeps the harness).',
    // the round backpack (references/Core Objects/Round Backpack)
    'The backpack is a round glass sphere of glowing jade fluid in a brass cradle, on an olive canvas plate with leather straps. Its glow follows your magic bar, three lights on its band count the units left, and it grows with each strength: a valve wheel and fins, then folding brass vanes, then a second valve and a brighter, quicker swirl.',
    'The round backpack lies flat on your back now, half as deep: a glass dome on a brass porthole ring, as the drawings have it. Inside it a little jade nebula turns slowly round a bright heart, its clouds layered in depth and pale stars twinkling, instead of the lava-lamp swirl; it still fills and glows with your magic, and turns faster once the harness is found.',
    // saves and buttons
    'Saves keep what they earned: past the giant’s pool you have the lift valve, past the Givers’ Hearth the gun, in hand. A controller layout you changed follows: whatever you had put on Y / △ now sounds the whistle.',
    // the desert's fallen giant and the cave in its chest, after the picked references (docs/systems/worlds.md)
    'The fallen giant’s skull beyond Qanat’s back gate is rebuilt after its picture: as big as a temple and tipped face first into the sand, its eye sockets ringed in the pilgrims’ turquoise and ochre with ribbons and offerings hanging below, a row of great teeth over a dark mouth whose steps go down to a cool glow, and cairns marking the way from the gate.',
    'The cave in the giant’s chest is rebuilt too: a tall vault of ribs with rock between them, light falling through cracks onto a warm sandy floor, a round dry pool walled in stone steps with the tree’s pale roots hanging into it, and a stone trough from a crack in the wall, the great fallen bone lying across it and water glinting in the crack behind.',
    // the title screen answers at once (docs/systems/ui.md "The title screen", Boot; scripts/title-perf.mjs)
    'The title screen answers at once: its menu is up in a blink and takes every press straight away, also while the world behind it is still being made. It no longer freezes for up to a second or more as that world comes in, and the world waits while you are moving through the menu, then carries on.',
    // the title screen nearer its covers (docs/systems/ui.md "The title screen", the title's shots)
    'The title screen looks more like the covers it was drawn from: each world’s sky takes its cover’s printed colour (turquoise over the desert, the salt harbour and the sky stones, peach over the garden of spheres), and the picture is printed on cream paper with a fine grain. The underwater city now follows its other cover, and the two desert covers that were set aside no longer show.',
  ] },
  { v: '1.37', date: '2026-10-10', items: [
    // the audits page's dashboard (docs/systems/ui.md "The audits page")
    'The Audits page in the Debug menu opens on the latest scores of every kind of audit: a card each for the whole game, combat, level design, temple design, visuals, temple visuals, ink lines, cinematics, dialogue and performance, with its score, how much it moved since the audit before, and its scores per world, temple or creature, each with its own change. A card opens the full audit; History shows the earlier audits’ scores as a line and a list, and All audits lists every report as before.',
    'On the Audits page, clicking a report’s tabs or a card’s History button works again; before, it threw you back to the dashboard.',
  ] },
  { v: '1.36', date: '2026-10-10', items: [
    // the references page on the site (docs/systems/references.md "On the site")
    { text: 'The art references can be browsed from the Debug menu, on the website and in the app: every reference picture the worlds were drawn from, by world and folder, with a search, filters, and each picture full screen with its prompt and where it came from.',
      see: 'Open the Debug menu and pick References under Pages (marked “reference material”). Choose a world on the left, open a picture with A and step through them with LB / RB.' },
  ] },
  { v: '1.35', date: '2026-10-10', items: [
    // the sword reaches what it looks like it reaches
    'Your sword lands where you see it meet a creature: on its shell, its legs, its wings or its cloak, as it is drawn, instead of on an invisible ball round it. No more cuts counted through the air over a lizard’s back, nor missed on a heron’s stilts.',
    'Swings find low and hovering foes: a cut at a skitter, a lizard or an ink blot bends down to it, one at a moth a little up to it, and a swing begun a step or two away now gets you there before the blade comes through. It never turns you round: only the swing’s angle follows.',
    // you see every blow land
    'Every creature, machine and spirit shows when your sword connects: its body jolts away from the blow and squashes on springs, its ink flashes bright for a blink, and its own colours, sparks or black ink fly from where the blade struck. A heavy blow knocks it visibly further; a cut off a crab’s shell or a bell’s bronze still just sparks.',
    'Every foe goes down its own way before it bursts: the crab flips onto its back and curls its legs, the heron folds off its stilts, the jelly deflates and drifts down, the moth spirals to the ground, the worm sinks back under the sand, the machines buckle and let off steam, the shade’s cloak falls empty, the marionette’s strings snap. It can’t hurt you or stand in your way while it falls, and its chimes drop as it bursts, a second later.',
    'The hitbox overlay (F4, or the Arena’s board) draws each creature’s body as the boxes your sword is tested against.',
  ] },
  { v: '1.34', date: '2026-10-10', items: [
    // ink lines by the size of what they draw (docs/audits/ink-lines-v1.34.md, the ink-lines skill)
    'Far-off plants no longer turn into black blots: a meadow’s flowers, stems and leaves seen from a distance keep their colours under a light outline instead of being drawn over in ink. Close up they are drawn as before.',
    'The traveller’s face reads as a face from a few metres off: his eyes are small dark marks and his mouth a line, where they were black dots and a dark blot. Close up his face is as before.',
    'On smaller screens (a phone, the Steam Deck, a 720p window) and when the handheld lowers its resolution, the ink lines are thinner and lighter, in proportion to the picture.',
  ] },
  { v: '1.33', date: '2026-10-10', items: [
    // the world debug menu
    { text: 'A debug menu for the world you are in: click both sticks (L3 + R3), or press F2. It lists the world’s places by kind (the ship, every quest step, the people, the temple’s door and each of its rooms, the shops, the sights and beacons, the makers’ runs and trials, the doors into caves and halls, the boxes and relics) with a filter, and takes you to any of them, set down on the ground nearby.',
      see: 'In any world on the route, click both sticks together (or press F2). Pick “the guardian’s arena” under Temple, or a step under Quests: the page sweeps across and you stand there. LB / RB jump between the sections, Y filters, B closes.' },
    { text: 'The same menu plays the world’s cinematics where they happen and puts you back where you stood, sets any of the world’s quests to a chosen step (it warns you that this changes the save), and holds the debug switches: the hitbox overlay (which both sticks used to show; F4 still does), the controller inputs, god mode, endless potions, full hearts, the time of day, and the way back to the Debug menu.',
      see: 'Open it with L3 + R3, go to Cinematics and pick a world moment: it plays, and when it ends you are back where you opened the menu. Toggles has Hitboxes, God mode and the times of day.' },
  ] },
  { v: '1.32', date: '2026-10-10', items: [
    // the temple visual pass: each house its own stone, colours and light, after its design pictures
    'The eleven temples no longer look alike: each has its own stone, colours and light inside, after its design picture. Inside a temple the shade takes the house’s own colour instead of the world’s, so a rose house stays rose in its shadows and a cream one stays cream, and each has a small thing of its own along its friezes.',
    'The Givers’ House is warm rose stone laid in blocks, with a darker course under its frieze, the makers’ three dots over an arc cut along its walls and old green-bronze braziers.',
    'The Warden’s Well is cream stone again, banded in the makers’ steel blue with gold glyphs, with cream floors and lit slit windows over its friezes. Its shadows had turned the whole house blue.',
    'The Founders’ Belfry is bone-white stone with warm rose shadows. Its bells are old bronze, and little bronze bells hang in lit niches round its halls.',
    'The Engine-House is riveted rust iron strapped in steel blue, with grey iron floor plates, brass fittings and valve wheels on its straps.',
    'The Footprint is white plaster with pale lavender shadows and warm light, no longer sage green, with round portholes, amber glyphs and the sage of its door on its fittings.',
    'The Lamp-House is dark slate with moss at the foot of its walls and lamps hanging along its friezes, and every lamp lays a warm amber pool on the flagstones.',
    'The Hush-House is violet stone through and through, its floors no longer green, with moss at the walls’ foot and small teal and violet crystals along its friezes, under a dusky rose light.',
    'The Aerie is warm ivory banded in ochre, with long feathers carved along its walls and peach-rose shadows.',
    'The First Garage is cream marble, floors and all, with brass in its frames, thin brass lines along its walls and little brass clocks, and its eyes glow the makers’ teal.',
    'The Builders’ Greenhouse is white stone and pale sky-blue glass, its frames and ribs white instead of teal and its floors pale stone instead of green, under crisp blue shadows.',
    'The Undertower is heavy blue-grey masonry, its door frames the same stone, with grey flagstones and slots of the market’s coral and teal light along its walls.',
  ] },
  { v: '1.31', date: '2026-10-10', items: [
    // the hints pass: the world teaches, the screen says as little as it can
    'Far fewer hints. What you can use shows a small button over it, without words; a quest no longer puts its next step on the screen, the gold column over a world’s goal is gone, and the game no longer explains each foe, the world’s edge or a fire the first time you meet them. Your drone still finds the way whenever you ask.',
    'In a guardian’s fight your drone helps only after a while: ask at once and it just watches with you; the longer a phase of the fight goes on, the more it tells you.',
    'Things you look at, the guardians and the people of the worlds no longer spell out what to do: they say what is there and what is wrong, and leave the rest to you. Lines no longer name buttons, except the first time you need a new move or a new tool.',
    'A new setting, Hints (Settings, Game): Off, Subtle (the new default) or Full, which brings back every prompt, every tip and the drone’s help at once.',
  ] },
  { v: '1.30', date: '2026-10-10', items: [
    'Lorn II’s giant mushrooms are pale glass, as the wood’s pictures draw them: you see the dark trunks and the sky through their caps and stalks, their rims drawn in a soft line, the glowing ones lit from within, by day and by night. The relic mushroom and its stepping caps stay solid on top, so you can see where you land.',
    'The creatures gallery holds its view still: a sky ray, a moth or a jelly now glides, bobs and flaps in front of the camera instead of the whole picture riding along with it (or zooming in and out as it moved).',
  ] },
  { v: '1.29', date: '2026-10-10', items: [
    'The Arena no longer opens with the controller drawing over the view (it hid the fight on a small screen): F6, or View + D-pad ← in the Arena, still shows it.',
    // the temple guardians on the locomotion kit
    'The temple guardians walk on jointed legs that plant where they step and stay there until they step again: the Cistern-Keeper’s six legs in two tripods, the Gardener’s root legs, the Clockwork Foreman’s and the sentinels’ legs on their pistons, the First Sign’s, and the Elder’s long bird’s legs, which bend back. Their bodies ride on their feet, dipping and swaying as they go, and their necks and heads lag behind their turns.',
    'When a guardian rears, crouches or coils for a move, its feet stay planted: it braces them wide first, the Cistern-Keeper rears on four legs with its forelegs off the floor, the Gardener on its hind pair, and the Elder hops up to stamp. The Clockwork Foreman and the Tooth-Warden lift their feet off the floor to spin.',
    'The Cloud-Mother’s fins, the Lampless’s wings, the Elder’s stone feathers and the Echo’s veils ripple out from the body to their tips, and the Mother Snapper’s neck lags behind her lunges and whips after them.',
    // the kit's detail by distance and its stepped clock
    'Creatures on legs cost less to animate when they are far off or out of sight: far away their legs are worked out a quarter as often, and behind you not at all, catching up the moment they come into view.',
    'The lamp tripod, the bell walker and the furnace brute are drawn on twos, like a hand-drawn film: they hold each pose for a moment and then move on, so their thin legs no longer shimmer as they walk. Their strikes still snap at full speed.',
  ] },
  { v: '1.28', date: '2026-10-10', items: [
    // a fellow traveller, met along the route
    'Someone else follows the singing light: Tansy, a girl from the Salt Harbour whose compass has pointed after it since the night the sky rang. She waits a few steps from your ship in Vael, Lorn II, the City-Shaft and the Signal Market. Each time you meet she remembers what you told her the time before, and what you tell her decides whether she goes home or on past the last chart, and what she leaves in your hands.',
    'Tansy has a page in the People book that grows with every meeting. If your save had already passed one of her stops, you still meet her: she has been a world behind you, not ahead.',
    // the last two makers' runs: one in every world on the route
    'Lorn II has a makers’ run: the Lamp walk, four decks out over the lake south of the landing. Stand by the keeper’s lamp at each gap with the lantern charm and its moss-stones rise out of the water to carry you over. Hollin has a word for you at the end.',
    'The Sealed Hangar has one too: the Disc run, two islands and a landing high over the plain east of the clerk’s board, a riding disc shuttling across each gap (the last climbs up to the landing) and three eyes to wake in one breath at the end. Clemence remembers the Major riding discs like those. Every world on the route now has its makers’ run.',
  ] },
  { v: '1.27', date: '2026-10-10', items: [
    // the temples: no gadget door beside the chest (the temple design audit's third rule)
    'No temple keeps its new tool’s first door beside the chest any more. In the Founders’ Belfry, the Engine-House, the Undertower, the Builders’ Greenhouse, the Hush-House, the Lamp-House and the First Garage the way out of the chest’s room is open, into a short room of its own, and the first door that wants the new tool waits at its far end, where a miss costs nothing.',
    'Where the chest’s room had room for it, it now has something to try the new tool on that locks nothing: the Bell Chamber’s bell brings three stones that fell up down round the dais while it rings, the Fourth Chamber has four still eyes to wake in one breath, the Seed Chamber a seed in the sun that flowers, the Lantern Chamber a lamp that wakes to your lantern, and the Shell Chamber a low singing stone whose note you carry to the next door.',
    // their own first rooms
    'The Founders’ Belfry’s Stone Stair has no riding discs any more: one great stone that fell up hangs at the top of the well. Roll the stone ball into the founders’ bell low by the way in: while the bell rings the great stone comes down to the floor, and when it falls quiet the stone falls up again, with you on it if you are quick. Splash the eye under the landing on the way up.',
    'In the Undertower’s Hall of Dishes, the singing ball’s note, carried over by the dishes, now raises the makers’ pillars out of the cable pit instead of waking a disc.',
    'In the Lamp-House’s Root Stair, the glowing orb no longer wakes a disc: its lamp raises moss-stones out of the dark pool, glowing, to walk across.',
    'The Footprint’s Hall of Spheres now opens with the walker: one sphere in a groove past three carved prints, and three more by the wall. Set the sphere down on the walker’s print, three toes like the Footprint outside and the print carved over the door, and stand on the walker’s print by the wall.',
    // a key from elsewhere
    'In the Warden’s Well’s crown, the little vane is no longer on the crown’s wall: it stands on a post in the loft below, seen down through the second iris. Splash it there, then fly up to the great vane and hover before it slows (it now spins for 15 seconds).',
  ] },
  { v: '1.26', date: '2026-10-10', items: [
    // the enemies, closer to their design sheets
    'The antler hound now looks like its drawing: a lean, long body with a deep chest and a narrow waist, muscled thighs, a longer neck and muzzle and a wider crown of antlers, where it was a ball on sticks.',
    'The shade’s cloak hangs as a long soft drape, narrow at the shoulders and falling in folds past its knees to a torn hem, instead of a stiff flared cone.',
    'The lantern jelly’s bell is a tall dome now, its sides bulging over its rim, and the cloud jelly’s swells in soft lobes.',
    'The crucible cart’s canvas sags over it and hangs over its tracks in folds, its drive wheels have teeth, and its smoke climbs in a taller, winding column flecked with soot.',
    'The bell walker’s bell hangs in a flat riveted band of brass, not a round tube.',
    'The furnace brute’s fingers are plated like a gauntlet’s, and its fists meet over its head as it winds up its slam.',
    'The marionette’s knot of smoke pours down in a twisting funnel of ink into its strings.',
    'The Salt Harbour’s anchor crabs wear their barnacles in crusted patches of cream rosettes.',
    'The ink blot’s wet shine runs in curving streaks.',
    'The ring centipede’s plates are riveted along their edges.',
    'The cistern heron’s clay jug has its ochre marks between its two painted lines.',
    // the fights
    'A blade swing across the thread of light a lantern jelly holds to another creature now breaks its ward; the jelly keeps its lantern and may ward again.',
    'In the Desert, an old lamp tripod of the makers, the cistern pump, now keeps watch on the far shore of the mineral basin under the lavender cliffs.',
  ] },
  { v: '1.25', date: '2026-10-10', items: [
    // the traveller's face, drawn the way his sheets draw him
    'The traveller’s face is drawn the way his sheets draw him, not like a toy: smaller, narrower eyes under a heavy upper lid that cuts the top of a dark iris, a crease over the lid and no shine; a straight nose drawn with one line down its side and a hook round each nostril; a mouth that is one line; one even skin colour instead of a rosy nose and painted lips. He still blinks (now one clean stroke), looks about, smiles, frowns and talks, and his eyes go wide when he is surprised.',
  ] },
  { v: '1.24', date: '2026-10-10', items: [
    // the guardians: a dive that misses
    'The Lampless, the Elder and the Cloud-Mother now pay for a dive that misses, as the Keeper does for a stamp: dodge it and the Lampless catches its wings on the floor, the Elder drives her beak into it, the Cloud-Mother ploughs in on her fins, and each stays down a while longer than after a dive that lands. The Lampless’s dust now also runs out along the floor in a ring you can jump.',
    // the pictures
    'The crystal pendulums of the Hush-House no longer drag a jagged black halo across the wall behind them as they swing.',
    'In the Givers’ Hearth, no dark corner of the dome hangs across the passage’s mouth any more: the doorway is cut cleanly through the rock.',
    // the last two temples rebuilt round one idea each (the temple design audit), their guardians ending on it
    'The Givers’ House is rebuilt round one idea: the Givers carried their fire. In the Hall of the Flame the house’s one fire that never went out burns in the floor on a tar ball’s groove: roll the ball through it and on into the hooded bowl by the door, which no ember can reach. Let it burn out on the way and the bowl tips it back cold. In the Dry Channel the riding disc is gone: dry thorns choke the bridge’s sockets at the end of a groove, and the flame is behind the ball.',
    'With ember mode you are the fire. The corridor out of the Chest Chamber is choked with thorns, and the tar ball by the chest rolls burning through them and on into the bowl that raises the Hall of Fires’ bridge. Beside the far landing a new Hall of Channels has a groove so long the ball burns out before its end, unless the brazier beside it lights it again as it passes; that brazier also opens a keepers’ door back to the near ledge.',
    'The Keeper now turns to fire. Four spokes run in from the cistern’s braziers, each with a tar ball that catches as it rolls past its lit brazier. In its second phase a burning ball rolled to rest beside it makes it pant at once; in its last it will not pant in the dark at all, only by a fire you roll to it.',
    'The Givers’ House after the picked pictures: its doorway in a stepped frame of carved stone under a panel with three deep round holes over an arc; in the cistern, four tall bronze braziers on tripods, the Givers’ muzzle over the basin and the old channels’ mouths at the foot of the wall. The sand drifts in the Dry Channel now lie on the sand below, not in the air over it.',
    'The Footprint is rebuilt round one idea: the lens shows where the walker set things down. In the Still Pool a sphere floats, and the stirring water draws it back to you unless you stand on the stone that stills it; pushed across then, it settles in its berth and stepping stones rise (the riding disc is gone). Through the lens, the Lens Chamber’s wall shows the walker’s print, three toes like the Footprint itself, and its prints lead on over the floor.',
    'The Hall of the Unseen no longer has a plain glass bridge: the lens shows a field of stepping stones, each carrying a print, and only the walker’s three-toed ones hold; the rest crumble under you. On the far landing a sphere’s groove runs past prints of two and four toes and the walker’s, which only the lens shows, and the far door also wants an eye high on the wall you came from, across the chasm. A keepers’ gallery leads from there back to the Lens Chamber, its door opened from its far side.',
    'The Echo now ends on the print. Through the lens the sphere that answers its note wears the walker’s print; in its last phase it sings three notes at once, all three spheres glow, and only the print tells you which to splash.',
    'The Footprint after the picked pictures: a band of sage green round its round-headed door, the door’s round boss over it and white slabs along the print’s rim to the porch; inside, broken rock under the chasm’s lips and two pillars topped with spheres by the far door.',
  ] },
  { v: '1.23', date: '2026-10-10', items: [
    // the worlds, fifth round of the level design audit: the loners pulled in, a high place in each flat world, the blind legs
    'In Vael II, Ondine no longer waits alone far out on the plain: every day she walks out along the long aqueduct as far as the floating island, and you find her there, under the island church, beside the parapet stone where she scratches a mark for each day. Ask her why she stops there.',
    'One of the riders’ lantern stones fell up with the bell’s clapper. Its lantern burns over the island church’s porch while the clapper lies there, a point of light in the sky seen from the monastery, and goes out when you pick the clapper up.',
    'Lorn has a high place: Wendel’s lookout, a teal crystal grown in steps on the rise east of the landing. Climb it column by column, a short climb and a rest each time, to its top 30 m up, where the makers’ box from the rise now waits and the whole swamp lies below you.',
    'From Saba’s stone by the Great Crystal, the crystal cave’s crown now shows through a gap in the landing island’s crystal grove, so you can see where the cave is before you set off for it.',
    'In the Deep Wood, five dead giant stalks stand in the shallows west of the landing, broken off a climb apart: the lamp-keepers’ old lookout. Climb them one after another to the top, 30 m up, where the keepers’ lamp lights again with the water-way and you can see both their ways at once.',
    'In the Garden of Spheres, Emrys, who climbs everything, now stands on top of the meadow pyramid by the head of its stair, in sight of the path to the sphere-arch, shouting about the view. Go up and he will show you the whole garden.',
    'A white meadow path now runs from the sphere-arch round the meadow pyramid to the grove, and Ume sends you home by it, past a little sphere at the pyramid’s foot that Emrys practises on, his handprints all the way up its side.',
    'Halfway down the cypress avenue, two small spheres face each other across the road: splash one and the other rings back.',
    'In Viridel, Oro’s pyramid seed now rolls down to the pond’s south shore, in sight of the way to the fallen ship and the white runnel, instead of hiding on its far west bank.',
    'In the Sealed Hangar, Gaspard, who walked round the ring, now rests his feet on the plateau in sight of the signal board and the portal, not alone far out at its edge.',
    'In the Signal Market’s listeners’ lane, Wynn, the last of the old listeners, sits on a crate under the dishes halfway up, still listening to the silent tower after thirty years. He has something to say once it speaks.',
    'In the City-Shaft, Tobin now sends you back to Lio with his coin round the outer rim, past three more of his coin telescopes, each with its little yellow price board. A look through them is on the house.',
    'In the desert, while the great tree is still cold, the cool air of the cave under the fallen giant breathes out through its skull: a thin pale column rising over Qanat’s back gate, which you can see from the camps over the city walls.',
  ] },
  { v: '1.22', date: '2026-10-10', items: [
    // the enemy roster's last step: balance and sound (docs/audits/combat-v1.22.md)
    'Every creature, machine and spirit now sounds like itself when your blade lands and when it falls: a crab’s shell clacks and cracks, a toad’s throat wheezes and pops, a heron rings like a clay jug and breaks like one, a jelly’s lanterns ring like glass, a moth crinkles like paper, the bell walker’s bronze bongs and cracks, a shade’s empty cloak swishes and flutters down, a marionette’s strings snap one by one.',
    'A shot or an ember that does nothing to a foe now says so: a spark and a dull tick off its iron or its shell, and it no longer flinches as if hurt.',
    'The journey grows harder as you go, and the Signal Market is now its hardest stretch. From Viridel on, pairs and swarms come with company; the Hangar’s and the Garden of Spheres’ packs are bigger; the Garden’s shades and halo hounds and the Market’s alley hounds, parcel puppets and bell walkers lead more often; and in the last three worlds three foes may strike at once instead of two, a little sooner, a heavy blow takes a whole heart, and in the Market an ordinary blow takes three quarters.',
    'Each sword move has a job: the light combo’s third swing hits harder (the quickest way through the middleweights on the ground), the air cut hits flying and hovering foes twice as hard, and the full charged cut takes a little longer to gather, still the answer to the heavy ones.',
    'The crucible cart’s slag burns you a little less often and cools sooner; the ring drone’s diving ram and the shade’s sword cut hit as hard as the other heavy blows, and the shade winds its cut up a touch longer.',
  ] },
  { v: '1.21', date: '2026-10-10', items: [
    // the pictures: what the visual audit's probes found
    'Standing near a room’s corner in shade no longer paints a dark copy of the traveller on the wall beside him (worst on Handheld): the deep black masses in corners and recesses stay as they are whoever stands in front of them.',
    'Inside the Givers’ Hearth, and in the cave of the giant’s heart, no hairline of daylight shows any more where the floor meets the wall: the floor now runs on under the rock all the way round.',
    'The makers’ machines hovering and stalking in the temple halls no longer drag a jagged black halo across the wall behind them: the deep shadows in the walls stay put as they pass.',
    'Your own shadow on the sand no longer carries a ragged black blotch beside your hand (only a crease in the dune still darkens it), and the shield on your wrist and the sword on your back no longer fill with black in the shade: they count as part of you now, as your body does.',
  ] },
  { v: '1.20', date: '2026-10-09', items: [
    // the worlds, fourth round of the level design audit: every way home passes something new, and a landmark on every long leg
    'In Vael II, the monastery’s roof tiles that fell up with the bell’s clapper now hang in a long drifting string from the floating island’s church back over Tiv’s great table to the bell tower. Brother Calix asks you to follow them home with the clapper.',
    'Eight small floating stones carrying the riders’ old lanterns now hang from the rose cliff’s north lip past the Founders’ Belfry to Sister Aube’s hermitage by the landing. Dark for thirty years, they light again when the bell rings, and Calix sends you home along them.',
    'Brother Calix no longer wanders into the cloister’s door: he keeps to the courtyard beside it.',
    'Lorn’s crystal cave now wears a crown: teal crystal spires grown up through its ridge from the vault below, glowing with the cave’s own crystals, which show over the swamp from far off.',
    'Wendel’s egg-lamps, glowing eggs in iron cups on posts in the shallows, now run from the crystal cave’s west mouth along the swamp’s south shore to the landing, the egg-gatherers’ punt moored halfway with its baskets full. When the cave sings, its heart points you home along them.',
    'In the Deep Wood the lamp-keepers’ old water-way is back: lamps on posts for boats, from a water-gate by the root cave’s lagoon round the deep water east of the wood to the landing, a lamp-raft moored halfway. Hollin lights it once you have told him what was in the saucer, and sends you home along it on the skiff.',
    'In Viridel, Mira’s water clock now spills into a narrow runnel of white stone that winds west round the meadow, through a sluice-gate and a round stone basin by the pond, down to the vines over the fallen ship. Once you have seen what the garden uncovered, Vey sends you back up it to Mira.',
    'In the Sealed Hangar’s upside-down quarter, the Major’s old signal mast now stands over his desk with a red flag and a lamp on its tip, seen from the ring’s portal (one tall house that hid it is gone). Halfway back to the portal home, his telescope still stands on its tripod beside a stool, trained on the portal’s light.',
    'In the Buried Machine, forty-one Tooth Day posts now cross the dunes from the great wheel’s foot to Wen’s dome, one for every year, each with that year’s sliver nailed on top: the counters’ way, and the quest sends you back along it with yours.',
    'In the Signal Market, once the silent tower speaks again, Madame Sel sends you home the quiet way: down the alley behind Signal Square and up the back lane behind the west towers, where the market’s old dishes have stayed turned to the tower for thirty years, past the radio-mender’s table, and out by the lantern market.',
  ] },
  { v: '1.19', date: '2026-10-09', items: [
    // two more temples rebuilt round one idea each (the temple design audit), their guardians ending on it
    'The Warden’s Well is rebuilt round one idea: the tower breathes through its vanes. The makers’ bellows turned its machines on the shaft’s breath, and a vane still drives its machine only while it turns; a splash spins a small one, and it slows as it goes. The Turning Floors’ discs ride only while the vane over the far door spins, and on the Climb the ball’s groove crosses a slot whose stones stand only while the vane in the well’s floor turns: splash it, then roll the ball over before it stops.',
    'With the jets, you are the wind. The great vanes are too heavy for a splash, but hover over one on the jets (aim, and they hold you) and it turns under you. In the Lamp Gallery, now banded in steel blue with slit windows and shelves of carved eyes, the eye over the west shelf hides behind stone lids that lift only while the great vane in the floor turns; wake it and an iris in the ceiling opens onto the loft, where a ball on a high shelf must be pushed across a gap from the air while the loft’s own great vane holds its stones up. In the crown above, the eye by the warden’s door wants two vanes turning at once: splash the little one, then fly to the great one before it slows.',
    'The warden now backs onto one of four great vanes in its hall’s floor when its crown hatch opens. In its second phase a hit while that vane turns under your jets counts twice; in its last it keeps the hatch shut against still air, so hover over its vane until the draught lifts the hatch, then shoot down into it. Getting it wrong only costs time.',
    'The Warden’s Well from outside: its door is now a tall pointed arch at the top of a short flight of steps, banded in steel blue at its foot, an old lamp on a post beside the steps. Once the warden is still, Vell keeps it lit.',
    'Riding the shaft’s breath up from the City-Shaft’s bottom terrace now carries you all the way over the rim and sets you down there; near the end it used to let you sink off its crest and fall back down.',
    'The Engine-House is rebuilt round one idea: a ball in the teeth stops the engine there. In the Piston Hall the valve hisses but the pistons stay put, a stone ball sitting in their crank’s teeth: roll it out and they ride, roll it back and they stop. Past the gantry, in the new Crank Hall, the engine’s great hammer slams down on a walkway over a pit; roll the gantry’s ball down its groove into the hammer’s crank and it hangs up, still.',
    'With the fourth chamber, the Engine-House’s banks of four eyes now stand on pistons that rise in turn behind iron parapets, never four up in one breath. In the chest’s chamber one crank drives all four: jam it and they all stand up. In the Furnace only the two west pistons have cranks on the near lip: jam those two, then catch the other two as they rise one after the other.',
    'The Tooth-Warden now turns on the great gear in its hall’s floor. In its second phase a ball rolled into the gear’s teeth holds it, and four vents in a breath count twice; in its last it stamps the ball out and opens turning, one vent facing out at a time, so roll the ball back into the teeth and all four face you. Getting it wrong only costs time.',
    'The Engine-House from outside: its oval door is set in a riveted iron plate, and the door itself stands swung back against the drum on two great greased hinges.',
  ] },
  { v: '1.18', date: '2026-10-09', items: [
    // the enemy roster, part five: the last three
    'The last three foes of the new roster: the shade is remade, and the pearl roller and the marionette arrive. Every foe in every world now has a shape, a way of moving and a job in a fight of its own; none borrows another’s body any more.',
    'The shade is an empty hooded cloak worn by nothing: two white eyes in the dark of the hood, wide sleeves bent at the elbow, empty boots that step with bending knees under a hem that breaks into smoke, long ribbons trailing behind, and a sword of poured ink drawn out of its sleeve as it comes for you. Lorn II’s hollow woodsman wears a pointed bark hood; the Eclipse’s pilgrim a round violet hood with a brass crescent and a lantern on its belt. It fights like you: parry its cut and riposte. When its cut stops halfway and the sword drops to its hip, it is about to thrust low: step aside. When its cloak sinks into a pool of shadow, the pool slides round and it comes up beside you, cutting; light it with an ember and it can’t step at all. Left alone, it walks a path back and forth and waits at its end, as at a doorway.',
    'The pearl roller is a snail with a shell bigger than itself, gliding on a rippling foot with two long eye stalks: polished steel with an oily rainbow sheen in the Sealed Hangar, glowing pearl in the Garden of Spheres. When its stalks sink and its shell rocks three times, it pulls in and rolls at you, a perfect ball whose spin always matches the ground it covers; rolling, nothing hurts it. Guard and it bounces off stunned; sidestep it and it bounces off a wall once, and the next wall stops it cold. Hurt badly, it spins up glowing and shatters in a ring you jump. Left alone it grazes and keeps to itself.',
    'The marionette is a thin puppet hanging a metre off the ground from four strings that rise into a knot of black smoke: clear glass on silver threads in the Garden of Spheres, brown paper parcels tied with string in the Signal Market. It swings on its strings as it moves and jerks its limbs. When it lifts its arms and two strings unspool from its hands, they drop onto a creature near it, even a grazing one: its eyes go black and it fights faster and harder. Cut the strings, with an air cut, the boomerang or an ember, and the creature drops free and wanders off. It can also yank you off your feet with a string, and alone it drops low and whirls its legs, then hangs slack and open.',
    'In the Garden of Spheres a glass puppet hangs by the white archway in the android wood, swaying like a coat on a hook until you come near.',
  ] },
  { v: '1.17', date: '2026-10-09', items: [
    // the worlds, third round of the level design audit: the City-Shaft
    'In the City-Shaft, Basile waits at the middle levels’ cab stop beside Fausta’s Basket-Shop, a stack of her baskets on his back, for a cab that will stop for baskets. Stand by him and he talks about the cabs, Fausta’s prices and, later, the light.',
    'The lamplighters’ red lamp-posts now begin on the City-Shaft’s rim: from the Warden’s Well’s door along the edge past your ship to the red stair, down which Nima’s corner lies, so the walk to her is marked from the first step.',
    'On the climb from the shrine to the palace, a second lamplighters’ pad hangs just off the high ring past the relay lamp, its rail scratched with tally marks like the first, and a note beside the newest.',
    'Lio’s errand is quicker: walk up to Tobin on the rim and he pays the fare as you come, grumbling, with no conversation to sit through between Lio’s two.',
    // the desert
    'In the giant’s chest under Qanat, a stair of stone now climbs behind the pool, beside one of the tree’s roots, to a doorway in the far wall, and comes up under a hatch in the city’s back lane, a short walk from the well. Once the water runs, the quest sends you up it; the hatch only lifts from below, so the skull’s mouth is still the way in.',
    'On the straight ride out to the Givers’ Hearth, between Yara’s shade and the wreck, the skiff’s stone anchor lies tipped in the sand, its frayed rope trailing off toward the wreck it failed to hold. It is named as it comes up, and you can look at it.',
    // Vael
    'In Vael, a tall white mast flies the riders’ long streamer and a rust-red pennon on the slope under the crest west of the landing, where the standing stones lead. Oïa points to it when she sends you to the Aerie for wings, and from its foot the white house with the stone wings comes into view.',
  ] },
  { v: '1.16', date: '2026-10-09', items: [
    // the enemy roster, part four: the possessed machines
    'Four more foes of the new roster: the old makers’ machines with a dark spirit inside, each with its own shape, way of moving and job in a fight, in every world it lives in. They take over from the glass golem, the rust drone and the slag walker; Viridel now meets only the new foes, and the Deep Wood all of them but its rare shades. They come for you, but they keep their old habits until you come near: a brute stands where it stopped working, a cart trundles its old round, a drone polishes a dome that isn’t there, a bell tolls the hours.',
    'The furnace brute is a wardrobe with fists, taller than a house: a headless egg of a body cracked all over like a dropped jar, tar running from every crack and violet light in the widest, which burn brighter as you hurt it. It walks on short legs with a heavy dip at every step that you feel underfoot, its long arms swinging down to the ground. When both fists rise over its head, get to its side and jump the quake that runs out from the slam; a perfect parry chips its hull. It also tears a slab out of the ground and throws it (the mark shows where), and swings a backhand at you if you stand in front. Light cuts don’t stagger it: wait for a parry, a charged cut, or a bomb, which cracks it twice as deep. Lorn II’s wood cutter, grown through with roots and moss with a rusted saw in its fist, stands alone by the lit path; Viridel’s pruning machines have shears for hands; the Glass Dunes’ furnace walker is plated in glass.',
    'The ring drone is a floating cake stand: three plates spinning at their own speeds on a spindle, black smoke caught between them with two eyes drifting in it, three thin arms dangling below. It hangs out of the blade’s reach and hides between strikes. When its plates part and a reel slides out between them, a harpoon is coming: guard it to cut the line, or it reels you in. When its plates lock and spin up with a rising whine, it dives at you. Still it with a glob and it drops; the magnet glove and the hook pull it down to be cut.',
    'The crucible cart is a squat pot of boiling ink on a turntable over two caterpillar tracks, a column of smoke with eyes rising out of it. Its tracks roll exactly as far as it goes and its crucible turns on a slow spring. When the crucible tips toward you and its lip glows, get behind it or to one side: it pours burning slag that stays for a while, and it drips slag as it goes. When it backs up with its tracks spinning, it is about to ram; let it hit a wall and it stalls there, open. A plain shot cools its crust so cuts land double, and a bomb on its tracks stops it turning.',
    'The bell walker is a great bronze bell in a riveted yoke on five spider legs, the spirit inside it peering over the rim as the clapper. Only the clapper can be hurt. When it rears back and the clapper swings higher three times, three rings of sound run out over the ground: jump each one. Answer its note with the bell-note whistle while it winds up and it chokes on its toll and sits open. When the bell rises, step out from under it: it slams down where you stood, then tips up toward you with the clapper in reach. The Signal Market’s rings with coins and patched pennants; the Salt Harbour’s is a dock winch with a hook on its chain.',
    // what they cost
    'A flock of skitters takes far less to draw: each skitter’s legs and feelers are now one piece that bends at the joints instead of forty-odd separate parts, so a flock of eight costs about forty draw calls instead of three hundred and fifty, moving exactly as before. The new machines are built the same way.',
    // two more temples rebuilt round one idea each (the temple design audit), their guardians ending on it
    'The Builders’ Greenhouse is rebuilt round one idea: nothing grows in the shade. Its roof is a field of louvres; a stone ball rolled onto a plate turns one, and a sunbeam swings down onto whatever it was turned for. The eye behind the potting benches opens only in the sun, the Glass Stair’s one ball sends the light either to an eye high on the wall or to the disc over the root-wall, which rides only in the sun, and the flower-door after the chest stands in a sunbeam.',
    'In the Greenhouse’s Vine Gulf, now under a ribbed glass vault, the seed at the lip lies in the shade and only sprouts pale: roll the sun-ball onto its plate and the great louvre swings the light up off the dark below onto it. Across the chasm the seed is a seed-ball lying beside the glass wall: roll it into the sunbeam at the glass’s foot and bloom it there, and its vine climbs the glass into the great bud, which opens round it.',
    'The Gardener now kneels to the sun. A footstone before each dead bed turns the dome’s louvre onto that quarter of the glasshouse: in its second phase its back blooms twice as fast in the sun, and in its last nothing grows on it in the shade, so bring the sun to the quarter it kneels in, then bloom it. Getting it wrong only costs time.',
    'The Builders’ Greenhouse from outside: two pilasters rise past its rim either side of a tall narrow door, the builders’ three dots over an arc above it, panes gone from the dome here and there, and sown beds in rows along the path where nothing has come up.',
    'The Aerie is rebuilt round one idea: one wind, and it comes out wherever no stone stops it. Push the stone in the Hall of Winds up its groove, a push at a time between the gusts, into the vent they pour out of: the hall falls calm, and the wind rises instead up the new Wind Well, a tall white shaft open to the sky through a crown of stone feathers, and lifts the feather raft to the Wing Chamber.',
    'With the wings, the Wind Well’s column lifts you to its high balcony beside a great carved eye. Past it the Gulf is crossed in two legs: roll the stone out of the vent’s throat in the balcony and the wind pours over the gulf in gusts that carry your wings to a stone perch; then roll the perch’s own stone out of its throat, and a column rises beside it to a ledge higher than the perch.',
    'The Elder’s roost has two vents in its floor and one stone between them: in one vent, the wind rises from the other. Aloft she drifts over the nearer vent. In her second phase flying with her in its wind counts twice; in her last she will not trust still air, so roll the stone into the other vent and ride the wind up beside her. Getting it wrong only costs time.',
    'The Aerie’s doorway is now a tall round-topped arch cut through the drum, framed in ochre, the glyph over it.',
  ] },
  { v: '1.15', date: '2026-10-09', items: [
    // the temple guardians: each last phase asks for its temple's one idea
    'Five temple guardians now end their fight with their temple’s own idea, taught in the phase before, where the old way still works too; getting it wrong only costs time. In the Founders’ Belfry, stones that fell up hang under the Cloud-Mother’s dome: sound the bell as she rises to dive and one comes down where she will dive, held while the note sounds, and she lies on it, crying. In her last phase she no longer sinks to cry by herself: the stone is the way to her.',
    'In the Lamp-House’s lamp-room three dark pools lie round the floor. Light one, with a splash or by holding your lantern by it, and when the Lampless searches it drifts down to the lit pool and drinks it dark. In its last phase it shies from you: it comes down only to a pool, and only while you stand back.',
    'Three crystal pendulums now swing high over the Mother Snapper in the Hush-House, out of order round her hall. Still them in turn, smallest first, as the house was sung, and their notes calm her; out of turn one rings flat, the rest fade and she snaps up. In her last phase a cold glob in her mouth no longer eases her: only the crystals do.',
    'The First Sign’s hall in the Undertower has two low dishes on its wall, each with a cable running to the Sign’s foot: its word played into one reaches it from anywhere in the hall. In its last phase it turns its dish up to the dark as it listens and hears only through those dishes.',
    'When the Clockwork Foreman’s face opens in the First Garage, its hands now come round to four, the hour every clock in the house stopped at, and numerals hit round the clock from there ring out and light up. In its last phase only that order counts, all six inside one breath; out of step they all go dark.',
    // a fix
    'The antler hound’s smoke mane moves again: its tongues of smoke stream and flicker off its back, flattening as it runs. They had stood still since the hound was drawn.',
    // the worlds, reworked from the level design audit, second round: the desert
    'On the ride out to the Givers’ Hearth, where the red rocks begin, two great tusks stand either side of the way, leaning in until their tips cross high over it: the bike rides under. In their shade the Givers left a sealed jar on a low wall, and riders leave a little cairn.',
    'Qanat has a second way home. West of the main gate an old pilgrims’ road of stacked-stone cairns runs over the dunes, past Oum’s stone and the resting stone on the last dune’s crest, where pilgrims first saw the tree, down to your ship. Its lamps are cold until the tree burns; then the city lights them for you, one after another from the gate to the ship.',
    // Vael
    'In Vael, the great bird’s old tracks lead down from the Aerie’s door over the plateau’s north side to Oïa’s stone, a different way from the standing stones you came up by. Halfway, on the plateau’s lip, the rider’s mounting stone still has its iron ring and a saddle-cloth folded over it.',
    'Flying home from the lone tower, you pass the rider’s roost: a stone floating halfway to the landing with a lean-to, a bedroll, a cup and a long white streamer, where the rider and the bird used to rest. Land on it and the bird settles where the rock is worn smooth.',
    // the City-Shaft
    'In the City-Shaft, the old lamplighters’ drops mark the way down on the jets: a red lamp-post and a painted ring on the edge of every terrace, landing to landing from Nima’s corner down to the Upward Shrine. Nima sends you down them, and halfway, on the middle levels, Perrine’s tea stall and her mirror now stand where they land. On a landing below the smog, the lamplighters’ locker still holds their rope and the card from their last round.',
    'The climb from the shrine to the palace has its stops too: a floating pad with a lamp a quarter of the way up, and an old relay lamp on the spire’s ring that catches the splinter’s light as you carry it past. Coming back down from the palace to Nima you pass Tobin’s view pad, a coin telescope on a floating pad aimed straight up at the Lodestar.',
  ] },
  { v: '1.14', date: '2026-10-09', items: [
    // a shop in every world
    'Every world on the way home now has a shop of its own, built the way its people build and kept by someone who lives there. Walk in through its door, talk to the keeper or look at the wares on the counter, and buy healing potions, heart containers and magic expansions with your chimes; each keeper has their own words at the counter, and you will find them on the People page once you have met them.',
    'In Vael, Brin keeps the Wind-Shelf, a shelter carved into the foot of a hoodoo on the long walk to the lone tower: an ochre sail on a pole, her wares turning on cords in the wind, a white feather for a sign and her prices drawn in a tray of sand. She says one word at a time.',
    'In Vael II, Sister Perpetue keeps the Almonry, the monastery’s gatehouse on the cliff-top between two round towers under slate roofs: seven little bells over its hatch, one rung for every sale, and every cure sealed in wax with the Three Notes.',
    'In Lorn, Nettle keeps a raft-house moored at the landing island’s shore: grey planks and reed bundles under a steep thatch, a violet crystal lantern under the eave, the Hush painted over the door so the snappers leave her be, and her accounts kept as knots on a cord.',
    'In Lorn II, Rowan keeps the Welcome-Shelf, a moss dome on the lit path with a blue door, a striped stall of flasks and three little lamps over the door. He has kept it stocked for travellers for thirty years, and you are his first customer.',
    'In Viridel, Clover keeps a potting house of wood and glass against a fallen white slab under an umbrella tree, halfway from Mira’s garden down to the fallen ship: a striped awning, pots and flasks on a ladder of shelves, a brass bracket hanging a flask in a ring, and a heart grown in a pot of moss.',
    'In the City-Shaft, Fausta keeps a narrow three-storey shop on the middle terrace beside the cab stop, with a striped awning over its window, green shutters and a crane that lowers baskets of cures to every level.',
    'In the Sealed Hangar, Odo, the Major’s quartermaster, keeps a riveted hatch beside the way from the landing to the keep, a gear and a flask stencilled on its side, and stamps every sale on a requisition the Major signed long ago.',
    'In the Buried Machine, Mott keeps the Tooth-Counter, a small riveted dome among the domes on the way to Wen, a rusty gear tooth hung for its sign; she counts on an abacus of gear teeth and dates every sale by the great wheel.',
    'In the Garden of Spheres, Hale keeps the Listening Stall, a round white pavilion beside the path to the sphere-arch, and listens to every cure with a tuning fork before he sells it.',
    'In the Signal Market, Pashka keeps the loudest cure-stall on the avenue, in a coral tower’s foot under a red awning hung with bulbs, a lit board of a heart and a flask over it.',
    // what they sell
    'Heart containers and magic expansions are now sold all along the way: fifteen hearts and six expansions in all, one or two in each shop and a few more in the later worlds. Each costs a little more than the last wherever you buy it, and buying them all takes you to 18 hearts and a full magic bar.',
  ] },
  { v: '1.13', date: '2026-10-09', items: [
    // the enemy roster, part three: four more foes, each its own
    'Four more foes of the new roster, each with its own shape, way of moving and job in a fight, in every world it lives in. They take over from the spitting blot, the blot swarm and the root stalker, and the Desert, Vael and Lorn now meet only the new foes. Left alone they keep their own ways: toads sit by the water, herons wade and fish, skitters graze in flocks, and a root knot stands among the mushrooms like one of them.',
    'The bellows toad sits upright like a fat old man, taller than you, its throat sac hanging in folds down its cream belly, and it moves in heavy hops. It keeps its distance: its throat swells see-through with a glob inside, it rears back and lobs it, and where it lands (the mark on the ground shows where) it bursts into spores that slow you down for a few seconds. Shoot the swollen throat and it chokes on its own glob. Up close it crouches deep, legs shaking, then belly-flops onto you with a ring of shock: jump the ring, or meet it in the air with the air cut and it lands on its back. The City-Shaft’s pressure toads, with a brass valve and gauge on their backs, lob three at once.',
    'The stilt heron is the tallest thing you will meet, a body on two stilt legs taller than a doorway, with a long S-shaped neck: in the Desert its body is a cream clay jug with ochre bands, in Vael a slim blue bird with a rust-red crest. It walks one long leg at a time, its body swaying on top. It draws its neck back into a tight S and spears you from five metres: step aside, or guard to knock the bill away and leave its head hanging open. Under it, it lifts a foot and stamps. Get in close and cut its legs; a charged cut at a leg topples it, and while it lies there every cut lands double. Vael’s herons also flare their wings to beat you back.',
    'The skitter swarm: eight knee-high round domes on high-kneed legs that graze together like little sheep and scatter in a ripple if you run at them. Stand in the middle of the flock too long and they ring you, darting in one at a time, each rearing up on its back legs and clicking first; three of them may climb onto each other into a wobbling heap that topples onto you. One cut, one shot or a push ends each, a push on the heap scatters it, and an ember sends the rest running.',
    'The root knot looks like a tall mushroom on five long, jointed root-arms, a broad cap over a ribbed bulb and two small pale eyes; standing still it is hard to tell from the mushrooms round it, but its cap turns to follow you. It walks one arm at a time and nothing knocks it back. When it plunges two arms into the ground, the soil heaves toward you as its root runs under it: jump it or step aside, or it drags you in for a lash of two arms coiled back high (guard it). A bloom glob puts it to sleep, cuts landing double the whole time, and embers burn it; in the Deep Wood its glowing cap shudders and breathes out a haze of spores.',
    // what they cost
    'The roster’s foes take less to draw: the tapering parts of their bodies (legs, toes, claws, horns, rootlets) are one piece each instead of a stack of small ones, so a crab, a lizard or a hound costs about half the draw calls it did, with nothing changed in how it looks.',
  ] },
  { v: '1.12', date: '2026-10-09', items: [
    // the temples, reworked from the temple design audit: the Undertower
    'The Undertower is rebuilt round one idea: a note travels. In the Hall of Dishes the disc over the cable pit waits for a horn on the far landing, too far off to hear any note sung on your side. Roll the singing ball onto the footstone of the great dish on the west wall, splash it there, and its note comes out of the dish’s twin across the pit. In the Cable Well the second disc waits for the horn on the ledge, which listens for the low stone on the floor: its ring is that note’s colour.',
    'In the Undertower no stone sings the low note in the Shell Chamber any more: carry it up from the Cable Well in the shell. In the Gallery of Voices the pillars stand only while the great horn rings with the high note, and the far door listens through the dish above it. Roll the ball onto the footstone of that dish’s twin on your side and play the middle note into it, then carry the high note to the horn and cross. Cross too soon and a horn on the far side brings the pillars back for you, and the pillars never sink while you stand on them.',
    'The Gallery of Voices is redrawn after its picked reference: three singing eggs of three sizes on stepped plinths, a great brass horn on a tall stand at the chasm’s edge, a bridge of tall pillars rising out of the dark, bundles of old cable down the walls into the chasm, and the market’s coral and teal light falling through slots far overhead. The Undertower’s doorway behind the silent tower is now one great monolith of blue-grey blocks that steps down at its sides, with a deep doorway framed three times, a round dish-face over the door and the old cables coming out from under its foot.',
    // the First Garage
    'The First Garage is rebuilt round one idea: the makers’ clock counts round from where its hand points, and every clock in the house stopped at four the night the light passed. The escapement’s disc now waits for the three eyes round the dial over the far door, woken in turn from the one its hand points at, the way a clock goes round. The Winding Well’s door wants its counterweight home: the stone ball still waiting on the escapement’s far landing, its groove running through into the well to a socket at the foot of the wall.',
    'In the First Garage’s Clock Gallery the great clock face has lost its hands. Its six eyes still want two tanks in one breath, and now in turn as well: count round from the hour every clock in the house stopped at, which the little clock over the way in, behind you, still shows. The gallery is redrawn after its picked reference, with the makers’ cogs turning slowly in the dark of the chasm, brass pendulums swinging in arched niches, high round windows of warm light and a ring of brass round the eyes. Outside, the house’s doorway is now a round arch ringed in brass, and the great clock has a second brass frame.',
    // the Lamp-House and the Hush-House, after their rework
    'In the Lamp-House the disc over the Root Stair’s dark pool now waits, still and dark, for the lamp in its socket, and only light wakes it. Back in the Hall of Dark Pools a pool-orb rests beside a small pool by the door, in a groove that runs through the doorway to the socket: light the pool, let the orb drink its light, then roll it through before it fades. The eye that only the lantern shows in the Dark Gallery has moved high over the way in, behind you as you cross: look back from the far door to find it.',
    'In the Hush-House’s Pendulum Gallery a keeper’s ledge now runs back along the east wall, over the chasm, to a gate by the near landing. Its footstone is behind the gate, so it only opens from the far side: once you are across, the way back is a walk instead of the pendulums again.',
  ] },
  { v: '1.11', date: '2026-10-09', items: [
    // the worlds, reworked from the level design audit: the desert
    'While Qanat’s tree stands cold, the pilgrims’ camps keep a column of smoke going for whoever fell behind, so from the moment you land you can see where the city lies beyond the dune. Old Oum now waits on a dune in sight of the way in, and a dry, stone-lined channel runs from Qanat’s east side to the Givers’ House.',
    'The long ride out to the Givers’ Hearth has company: Yara the salt-carrier rests under her sunshade a third of the way, and a sand-skiff’s wreck lies on its side two thirds of the way, its mast still up. Coming home, the marked stones lead you back to Qanat past the keepers’ bowl and their cold camp.',
    // Vael
    'In Vael, Senn now listens at the foot of the capped needle spire out on the plain, halfway from the landing to the lone tower, and the makers’ box with the hush-cloth waits on that spire’s cap beside one of the shed feathers: one long climb, two finds. A line of standing stones leads up the slope from the landing toward the Aerie.',
    'The doorway in the sand before the desert’s masked head is a short passage into the dark now, with a little warm light on its floor, so it no longer looks like a shut door.',
    // the controller's quick buttons, rearranged
    'On a controller every button now has one job. D-pad ← drinks a healing potion in one press, where you held View + D-pad ↓ before. D-pad → takes the next gun mode, round to the first after the last. D-pad ↓ still calls your mount or hails a taxi (in the Arena, the Arcade and the References it opens their lists), D-pad ↑ still chooses a gadget, and L3 only runs.',
    'If you played v1.11’s first build, its double-duty buttons are gone: L3 no longer calls your mount when you stand still, tapping D-pad ↑ while aiming no longer changes the gun mode, and the gadget wheel holds only gadgets again. Buttons you moved on the Controls page come with you, and a note tells you once what moved.',
    // the ship's rooms, laid out as the picked reference
    'Inside the ship the main room is laid out anew, one long room opening onto the cockpit. The holo table stands in the middle in the crook of a curved console, and the voicemail now sits on the console’s near end, its button, the projector and a little boxy screen: you stand behind it facing forward, and your parents rise over it with the whole room and the windshield beyond them (the holo table’s planet folds away while they speak). The galley runs along the left wall from the door to the cockpit, a board of tools over the counter; coats and packs hang by the door, which has a round porthole now; your bunk lies in an arched alcove under the right-hand window, with its books and photographs, and you wake there; the lockers stand at the back on the right. The cockpit has two seats side by side and a panel overhead, and the sofa and the little table have moved to the back room.',
    // the chimes, redrawn
    'Chimes have a new look: each is a long, blunt crystal of broad uneven facets, with a small flat top, a blunt point below, a lavender seam down its length and a warm light glowing at its heart. Each is 30 cm long, its top at your knee, floating upright with only a slight lean over the sand and turning slowly, each over its own small, soft lavender shadow. Come near and the nearest drifts to you on a gentle curve, glowing, a trail of little lights behind it.',
    'Chimes now come in six worths, each the same crystal in its own colour, a little bigger, brighter and quicker to glint the more it is worth: cyan for 1, jade 5, amber 10, coral 20, violet 50 and pearl 100. A drop scatters the fewest pieces it can (eight chimes are a jade and three cyan; a guardian’s purse is two coral twenties), and picking up a big one rings with more notes. The pale five-clusters are gone; what you have in your wallet stays as it is.',
    // the roster's foes painted as on their sheets (procedural surfaces)
    'The foes of the new roster are painted as on their design sheets: pale lichen stars and specks on the cliff crab’s slate dome, cream barnacle rosettes and ochre stains on the anchor crab, mottled scales over pale belly plates on the lizards (amber rosettes on the coin lizard), gold glints in the hounds’ ink, pink rust streaks and a shine on the lamp tripod’s boiler (mottled copper on the diving bell), a wet violet gloss on the ink blot, rust flecks on the worms’ rings, a net of veins over the sky ray’s wings, ribbed lanterns glowing under the jellies and in the moths, and cobalt bands and medallions round the porcelain jelly, which now trails coral-red threads and carries yellow glass lanterns; the Forest of Antennas’ moth glows mint green. The patterns are drawn as part of each foe, so a pack costs no more to draw.',
    // the Debug menu, tidied
    'The Debug menu is laid out anew, in sections with a heading each: Play (Continue, then the route’s worlds in story order), Story places, Test rooms, Worlds in progress, Games, Pages, and This build (its version, build number and commit). Worlds keep their picture cards, everything else is a row with its name and one line. Type to filter it, or jump between sections with the chips at the top, PgUp / PgDn, or LB / RB on a controller (Y opens the filter); coming back from a page or a world puts you back on what you opened.',
    // the fluid sword, alive
    'The fluid sword feels alive: currents swirl up the blade with fine ripples and small bubbles rising to the point, its edges shimmer like the skin of water with a bright line along the cutting edge, a swing bends the fluid back and smears it and flings drops that splash on the ground, each hit, block and parry sends a ring of light along it, and after dark the blade glows from within.',
  ] },
  { v: '1.10', date: '2026-10-09', items: [
    // the enemy roster, part two: five more foes, each its own
    'Five more foes of the new roster, each with its own shape, way of moving and job in a fight, in every world it lives in. They take over from the dune ray, the old sign moth and the winged blots; Vael II now meets only the new foes. Left alone they keep their own ways: rays circle in the thermals, moths round their lamps, jellies drift with the wind, centipedes lie coiled on warm rocks, and a worm’s mound wanders the dunes.',
    'The mound worm swims under the sand as a travelling mound with a tall ivory fin and a wake of humps behind it. When the mound stops and trembles and the fin sinks, step away: it bursts up where you stood, a stack of fat banded rings with a round toothed mouth, and stays up a while to fight, spitting grit or diving back under. Cut its fin, drop a bomb or come down on the mound with the air cut (it hurts twice as much) to flush it out. Left alone it swims on past you.',
    'The sky ray glides overhead on slow beats of its broad red wings, the tips trailing, banking into its turns, a long jointed tail whipping behind. It banks round onto a line at you, sweeps its wings back and comes in low: a perfect guard at the last moment ploughs it into the ground, open. In Vael and Vael II it also stalls over you and beats you down out of the air.',
    'The signal moth flies in threes, an upright paper lantern glowing from inside, with a little hooded face, two antennae tipped with glowing bulbs, six long hooked legs hanging under it and two kite-like wings on fine rods that fan slowly. It snaps its wings open toward you like two signal panels, their eye-spots blazing, to flash (turn away or guard), folds them back to dart, and the lamp moths of the Deep Wood and the moths of the Antennas shake dust over you that makes your lock slip for a few seconds. One blow, a shot or a gust ends each.',
    'The ring centipede: a long tube of banded plates on two dozen little legs that step in a ripple running down its body, with great crab claws round a drill for jaws. Coiled on a rock it suns itself; come close and it runs round you, its body closing into a ring you can’t walk through, then tightens. Get out over its back with the wings or the jets, push it apart, or cut its head as it turns in (twice the harm); its plated back shrugs off cuts, and cut from behind it sheds its tail as two little skitterers.',
    'The lantern jelly drifts high with three glowing lanterns under its puffy bell and long threads trailing. It never starts a fight but joins one: a thread of light from a lantern to another foe halves the harm that foe takes and keeps it from staggering, and in later worlds it sinks down to mend the hurt. Shoot a lantern (or hit it with the boomerang) to pop it and break its thread, catch it with the air cut when it comes down, and don’t stand under it when its bell clenches.',
    // the title's own music
    { text: 'The title screen has its own recorded music now, “Distant Home”: glass harmonica and celesta carrying a slow five-note call over warm low strings, a soft far-off voice, nylon guitar and hand bells, looping gently for as long as you stay. It fades in over the old music box tune within a moment of the title opening, follows your music volume and mute, and fades out as you start playing. On Android and the Steam Deck it comes with the game, so it plays offline from the first launch.',
      see: 'With the sound on, open the game and wait on the title: the music box tune gives way, over two seconds, to the recording. Turn the music volume down in Settings and it follows; choose Continue and it fades out as the world comes in.' },
    // the first five foes, redrawn after their design sheets
    'The shellback crab is redrawn after its design sheet: a deep slate-blue dome flecked with pale lichen stars over an ivory belly of plates, six thick ivory legs with hooked tips, two tall arms holding big upright pincers with apricot tips above its shell, and black eyes on thin stalks. The Salt Harbour’s anchor crab is turquoise, crusted with cream barnacles, on coral joints, with an old rope and a little iron anchor caught on its back.',
    'The horn lizard now hugs the ground like a salamander, its back no higher than your knee: short legs sprawled out to the sides on splayed toes, a long low neck, a flat head whose snout grows into a curved brass horn with a flared mouth, and a heavy tail lying behind it that coils up into a tight spiral. The City-Shaft’s are terracotta with dark mottled bands; the Signal Market’s are teal with amber rosettes, coins hanging under the horn and a wind-up key on the back. Winding up its blare, it lifts its front half and its throat swells into a great ivory balloon.',
    'The antler hound stands taller, on long lean legs with a deep chest, a narrow waist and a long muzzle, under a much bigger branching crown, and smoke streams off its back like a mane. In the Garden of Spheres it is ink-black, its black antlers glinting gold with a thin gold halo caught in them; in the White Mangrove its antlers are bleached driftwood, it drips like wet ink and its smoke is sage and lilac. Lying in wait, its head and crown rise out of a ragged pool of shadow.',
    'The lamp tripod stands on three long ivory legs, nearly upright, under a taller riveted boiler with a slate-blue band, two smokestacks, a bigger porthole and a searchlight as wide as the boiler with a grid over its lens; as it aims at you, a harpoon gun slides out under the boiler. Underwater it is a coral-copper diving bell with a turquoise band, portholes all round, a wind-up key and bubbles.',
    'The ink blot is a glossy drop now, round below and drawn up into a splashing point, with big cream eyes and dark pupils, violet light on its ink and a ragged rim of the ground’s colour where it pools; winding up a lunge, it sinks into a stack of rings. In the Sealed Hangar it is gunmetal, its rim rust and oily teal, with metal shavings stuck in it.',
  ] },
  { v: '1.9', date: '2026-10-09', items: [
    // the temples, reworked from the temple design audit: the Founders' Belfry
    'The Founders’ Belfry is rebuilt round one idea: the founders’ bells hold things only while they ring. The Hall of Stones is now a crossroads: two archways open off it into two stone stores, a ball to roll home in each, in whichever order you like, and the door’s two lamps wait for both. The Stone Stair’s high door is shut, and its eye hides on the landing’s face, seen from the ledge on the way up.',
    'In the Founders’ Belfry the door out of the Bell Chamber now stands open only while the bell rings, and the hanging stones in the Hall of Echoes come down only for as long as the note lasts. The far door wants the ball waiting at the near edge: ring, roll it across while the stones are down (it stops at the edge while they hang, and drops if they rise under it), and its weight on the far plate keeps the bridge down for good.',
    // the Hush-House
    'The Hush-House’s first crystal now stands by the door, in the Threshold: the Choir’s three ring flat until it has sung, and say where the first note was. The Bog Well’s way up has a door at the top of the root-wall, and its eye is on the wall’s face, in sight from the climbing disc but not from the top.',
    'In the Hush-House’s Pendulum Gallery the far gate of jaws is gone: the far door wants the three pendulums’ notes, and a stilled pendulum’s note only rings true in turn, smallest crystal first, as the Choir taught. They hang out of that order, so stilling them to cross gets it wrong: from the far side, still them again, in turn.',
    // the Lamp-House
    'The Lamp-House’s Hall of Dark Pools has two pools on its floor now; the door’s third lamp waits on a pool up on a loft of roots against the west wall, hidden from the floor by its edge. Climb its face to find it.',
    'In the Lamp-House’s Dark Gallery the far door’s lamp now sits in a niche low in the west wall, and only a pool-orb’s light wakes it: stand still by the orb with your lantern until it glows, then roll it down its groove into the niche before the glow fades. Rolled in dark, it wakes nothing, and the niche tips it back out.',
    // controllers
    'An 8BitDo SN30 Pro (and the other 8BitDo pads printed with Nintendo letters) now shows its own buttons in every prompt, the title screen included: B at the bottom, A on the right, the way they are printed on it, and A confirms in the menus, as on a Switch pad.',
    // the chimes
    'Chimes float now: every crystal hovers well clear of the ground, a five as high as a one, with a soft patch of shade on the ground under it that shrinks and fades as it bobs up, so you can see they are floating rather than lying in the sand.',
  ] },
  { v: '1.8', date: '2026-10-09', items: [
    // the family ship, redrawn
    'The traveller’s ship is the family’s angular ship now: a long faceted hull in worn cream enamel with one coral stripe at the windows and muted lavender panels at the back, a wedge nose under a wide windshield, two slender pods raked up off the stern, four short legs and a side door with a railed stair-ramp. It stands in every world where the round ship stood.',
    'Inside, real rooms you walk through: the cockpit with its dash, the voicemail button and the projector, the pilot’s seat and the round screen; the main room with the holo table, the galley under its window, the entry bench and lockers, a sofa and a little table for three; the sleeping cabin with the bed in its alcove, the desk, books under straps and clothes on hooks; and the hold at the back. The camera follows you close through the doorways.',
    'The ship’s scenes are filmed for the new ship: the recordings from beside the pilot at the dash, the singing light passing the cockpit on the hatch’s side, the forced landing coming in nose first and slewing round in the sand, arrivals flying in nose first, the door sliding along the hull and the stair-ramp folding out.',
    'The child’s drawing on the dash shows the striped ship, and the people who talk about it call it the striped ship. Far off, the ship draws fewer small details, and it has a quarter of the round ship’s triangles.',
    // the chimes grow back to the coin's size, with a crystal shader
    'Chimes are as big again as the brass coins were, so you can see them lying about from a few steps away, and a five is a bigger cluster as the coin’s five was. They look like real crystal now: flat facets that turn light and dark as they spin, bright edges, a soft light inside that pulses gently, faint lines inside that shift as you walk round them, a hint of rainbow at their rims, and a facet that flashes white when it catches the sun (or your light in the dark). Their glint is subtler and they turn and bob more calmly.',
    // the enemy roster: fewer foes, each its own
    'The hundred look-alike world enemies are gone. In their place a roster of distinct foes, each with its own shape, its own way of moving and its own job in a fight, met in several worlds in that world’s colours and dress. The first five are here; worlds whose other foes are still being drawn keep the old ones meanwhile.',
    'The shellback crab: a low wide shell with two raised pincers, scuttling sideways in bursts on six jointed legs. Its shell turns your blade from the front; guard its spinning charge and it flips onto its back; parry its snap and a piece of claw breaks off. In the Salt Harbour and Underwater it sinks into the sand and springs out where you stood. Seven worlds, seven crabs: a lichen-flecked cliff crab, an oil beetle, a market crab under a patched awning, a barnacled anchor crab, a glass crab, a coral crab, a copper beetle.',
    'The horn lizard: long and low, its tail curled up behind, a brass trumpet where its snout should be. They hunt in pairs: one rears up and blares at you, a blast that shoves you toward the other while it slips round behind you to bite; stand behind one and its tail whips. Pipe lizards, ash lizards, coin lizards hung with coins, night lizards, ember lizards.',
    'The antler hound: a lean shadow on long legs under a crown of antlers wider than itself, running as a shadow on the ground and rising out of it to pounce, or sinking into it to come up behind you. Hurt, it rakes with its antlers. An ember makes it solid and burns. Not every one hunts: some only stand up and watch you go.',
    'The lamp tripod: a tall boiler on three thin piston legs with a searchlight on top, a dark face pressed against its porthole and black steam from its vents. It keeps its distance: its light finds you and follows, then holds and narrows, and a harpoon bolt flies down the beam. Step behind something, guard it, or parry it back into the lamp; get under it and it stamps.',
    'The ink blot hops now, squashing and stretching as it goes, and lies pooled as a stain until you come near; at its edge it takes the colour of the ground. Keep away from one and it rears up and spits a glob at you (its landing spot marked), as the spitting blots did.',
    'Out in the worlds, creatures keep to themselves until provoked: a crab picks along and backs away as you pass, lizards bask on their stones. Come too close, corner one or hit one, and it fights, and its neighbours with it. The machines and the spirits still come for you.',
  ] },
  { v: '1.7', date: '2026-10-09', items: [
    { text: 'Cinematic previews start and replay silently, including dialogue and the trailer.', see: 'Open Debug → Cinematics and replay any scene. Sound stays off until you enable it.' },
    'Your father’s recordings now use his chosen likeness: silver hair, a slate-blue coat and rust waistcoat, with moving hands and a softly animated face inside the hologram. His shoulders and sleeves bend smoothly, speech leaves his nose and neck still, glances turn his head without pulling his jaw, collar or torso, and his neck keeps its shape through turns, and the recording model is two thirds smaller to download.',
    // the audits page
    'Debug: an Audits page gathers every review of the game (the look, the fights, the worlds, the temples, the dialogue, the speed, the cinematics) with their scores as tables and bars, their findings with pictures, the edits they ranked and the to-do items they led to, and shows how the scores changed between two reviews of the same kind; it works with a controller.',
    // foes walk on jointed legs (the locomotion kit)
    'Crabs, the salt crab and the other six-legged creatures now walk on real legs: each leg bends at a high knee, every foot stays where it lands until it steps, and the legs step in two alternating threes instead of all the left ones and then all the right. The shell rides on its feet and dips a little as they lift.',
    'Shadow hounds and the lizards trot on four jointed legs, the front knees forward and the hind ones bent back, the diagonal legs stepping together; the lizards now stand on four legs instead of two. A pouncing hound stretches its legs out fore and aft through the leap.',
    'The makers’ machines and the possessed machines walk on jointed piston legs, one foot at a time in hard, straight moves (lift, swing, set down), with a piston sliding at each knee and a puff of dust where a foot lands.',
    'Foes step quicker when they run and slower when they walk, so their feet no longer skate over the ground, and two of a kind no longer step in time with each other. Winding up an attack, a foe on legs plants its feet wide and sits back away from you, holds, then lunges through.',
    // the fluid sword
    'The fluid blade is the chosen sword now: a broad blade of turquoise water, narrow where it leaves a brass cup and splashing out to its full width near the hilt, with cream currents and deep teal pools flowing up it to a long point, on a leather-wrapped grip with a brass collar and a pommel with a little curled tail. It grows broader as well as longer as it lights for a cut, and a little broader with each step of ink. Through every cut ribbons of the fluid trail off its edge and drops fly from it: wider and fuller on a charged cut, gold in a riposte, thrown down with the air cut, a long streak behind the dash cut.',
    'Out of a fight the fluid sword now rides on your back: its hilt sits in a small leather holder behind your right shoulder, beside the tank, the pommel peeking over the shoulder, and both hands are free. When a fight starts (a swing, the guard, an evade, locking on, a blow) your right hand reaches back over the shoulder and draws it, and a few seconds after the fight it goes back the same way. Swinging with the sword on your back is never slower: the swing starts at once and the hilt is in your hand before the blade cuts. It is on his back on the title screen too.',
    // the water
    'Little waves lap at whatever stands in the water: round rocks, pillars, tree roots, walls, piers, boats, people and the traveller himself when he wades or swims, a pale band of foam hugging it, breathing out and back, with small moving gaps, a broken inked ripple or two just off it and a few flecks of foam. It reaches the shore too, wherever the water meets the ground. (Graphics: on everywhere but Handheld.)',
    // the traveller's fingers
    'The traveller’s fingers curl gently in toward his palms, both hands alike, standing, walking, running, talking and holding the blade or the shield. They used to bend back from the palm and splay: in the game his skin had slipped off the bones of his fingers, and on the title screen his hands were never posed at all.',
    // the traveller's kit
    'The hose from the backpack’s tank to your glove is gone: it bent stiffly over the shoulder and through the arm as you aimed. The glove now carries a small glass vial of the tank’s own fluid on its cuff, glowing with it, brighter as the tank fills and flashing as you shoot, so the glove and the tank still read as one. The story’s waters now pour into the tank instead of climbing the hose.',
    // the chimes become small floating crystals
    'Chimes are now small floating crystals instead of brass discs: blunt cyan shards about as long as your thumb, with a lavender seam and a soft light inside, that hover a hand above the ground, tilted and turning, and catch the light now and then. A five is a little cluster of three. They still drop from foes, drift to you when you come near, and buy the same things.',
    'Picking up chimes rings like struck glass, a clear shimmering ting that climbs as you gather a run of them; they scatter from a foe and are counted onto a shop’s counter with the same glassy sound.',
    'The chimes’ coin beside your hearts, in the shop’s prices and wallet and by the Gear heading of the menu is now a little cyan crystal. Haddu’s shop hangs strings of crystals by its door and a big crystal on its signs, and he explains what chimes are in his new words.',
    // the family, as their chosen drawings
    'Your family now looks as their chosen drawings do. At home, Lou wears a golden-yellow tunic with two coral pockets, rust-red trousers and soft tan boots, her chestnut hair in two messy bunches and a folded drawing in her hand; Aunt Tove is sturdy and silver-haired, a lavender shawl round her shoulders over a dusty-blue tunic, a pale apron and brown boots. Their faces, colours and boots match from the front, the side and the back, walking, talking and sitting, and on the People page.',
    'Ilen, at the Lantern and later at home, wears a long faded-teal coat lined in coral, open over a cream shirt, a narrow tool belt with its pouches, charcoal trousers and tall worn boots, her dark hair in a low bun.',
    'On the recordings your parents are the old couple they were when the reel ended: your father lean and grey-haired, clean-shaven, in a faded slate-blue coat open over a rust vest and a navy roll-neck; your mother silver-haired in a low bun, a long teal scarf lined in coral wound at her throat over a cream tunic.',
    'Moustache is an old, lean, long-legged wire terrier now, sandy all over, with a long white moustache and beard, white scruffy brows and one ear folded over. He trots on jointed legs, each paw set down and held where it lands while the diagonal pair steps, faster when he hurries; when he sits his back paws step in under him, he noses about with his head down, wags harder the happier he is, and lies down at the stone with you.',
  ] },
  { v: '1.6', date: '2026-10-09', items: [
    // the galactic map's signature search
    'The galactic map has a signature search: a world newly in reach is no longer named outright. The ship hears the singing light’s three pulses out there and marks uncharted regions on the chart; sweep them with the mouse, the left stick, W A S D or a finger, and the scanner warms, quickens and sings louder as you near a world that carries it, with a signal meter in the corner. Hold it there a moment and the planet appears and is charted.',
    'The worlds still open in the same order as before, and saves from before keep every world they had on the map.',
    // rumble
    'Controllers rumble: a hit (harder the more hearts it costs), a heavy foe’s slam nearby, a hard landing, drinking a potion, letting go of a charged cut, picking up chimes (barely), the ship lifting off, and the signature search, beating in threes as you near a world. In Settings, Controller rumble turns it off and Rumble strength picks low, medium or high; without a controller that can rumble they are greyed out. On Android it comes with the new app, which the game offers.',
    // the title screen
    'The title screen’s menu is much smaller and sits low at the left, so the world behind the name shows: Continue (or New game) and Saves as two small buttons, and under them a row of little ink icons for Settings (a gear), What’s new (a star), Debug (a beetle) and Full screen (corner brackets), each named when you point at it or reach it with the controller. Full screen no longer shows in the Xbox app.',
    'On the title screen the traveller now stands still, upright, his arms straight down at his sides and his back to you, looking out over the world as on the covers; only his breath and his coat move.',
    // the opening, the singing light and the father's message
    'Your father’s first message now makes the years away plain: “We haven’t heard from you for so long.” He misses you, he is still disappointed in you, and you are not to come home until you bring back something of value. Those words, the game’s own, are now written in gold with their ✦ wherever anyone says them: on his message, on the later recordings and in conversations.',
    'The singing light has a song of its own: five high, wordless notes, first far off under your father’s message, then nearer, then nearest under his last words.',
    'The opening is restaged: you pause the message to listen, and the singing light passes close by the ship, singing, and drains its power as it goes. The lights go out, the reserve comes on, and the ship comes down in the desert on its belly, a hard landing rather than a crash, with no fire and no smoke.',
    'As the emergency power comes on, the ship says it can follow the light’s signature, and you tell it to: when the ship can fly again, you follow the light, because you want to hear it again.',
    'Nobody talks about your ship being struck any more: Marrow and Nour in the desert, the witnesses in every world, the People page, the Sightings, the map’s note and Ilen at the Lantern now speak of the light passing your ship and draining it.',
    // Qanat repays you
    'In the desert, Qanat now repays you for its tree: once the tree burns, the villagers come down to your ship, each with what their house can spare (the camps’ share of the Drinking, a street’s lamps, the well’s first water), and pour it in together, Nour last. That is what wakes the ship, not your jar alone.',
    // the creatures' gallery
    'In the creatures and spirits gallery, the creatures’ shadows are clean again: they were torn into ragged, streaky shapes that crawled as the creature moved or the view turned. Now each one casts one smooth ink shadow that holds still, drawn as in the game, and thin parts like a ray’s tail cast theirs too. The game itself was not affected.',
    // the fights: told by the body, not the ground
    'Foes no longer draw their attacks on the ground. Every attack is told by the body that makes it: its own wind-up (a slam rears up, a charge crouches and draws back, a sweep coils away, a crab spins up in its shell, a drone tips its harpoon at you), a spark gathering on the claw, foot, jaw or lens about to strike that burns white just before it lands, and a sound that rises over the whole wind-up, then a brief stillness before the blow.',
    'Only what is thrown or lobbed still marks the ground, where it will fall: a spitter’s globs, a glass golem’s chunk, and the guardians’ seeds, clods, cogs, mortars and hail.',
    'A few wind-ups are longer, so they can be read: the shadow hound’s pounce (0.6 s, now 0.8 s), the salt crab’s snap and the ink blot’s lunge. A hound stepping through the shadow now sinks into its own pool before it comes up behind you, and a dune ray’s fin stands tall and glows as it races at you. Gentle still slows every wind-up.',
    'The eleven temple guardians each fight a staged fight of their own: four to six moves drawn from their bodies and their temples, combos of two or three moves whose last is the big one to read, and three phases instead of two. At each change a guardian staggers and is changed, cracks or glyph veins lighting up on it, and comes back with new moves.',
    'Their openings are read from their bodies: after a combo they pant or open their vents, and a stamp, a charge, a dive or a spin that misses you leaves them stuck for a moment (forefeet wedged in the stone, a beak in the floor, a machine spun dizzy). Some slams and cries now send a ring running along the floor: jump it.',
    'Among the new moves: the Keeper ploughs under the sand at you and spits clods; the Elder pecks twice before her buffet; the Mother Snapper feints with short snaps before the real lunge; the warden vents straight up when you hang over its crown; the Clockwork Foreman spins itself dizzy; the First Sign stutters on its word before it cries.',
    // the traveller's hands
    'The traveller’s hands stay joined to his arms. A raised hand no longer twists off the end of its forearm on a pinched wrist: his forearms now bend at the elbow the way his upper arms turn, and the turn of the wrist is shared along the forearm. Standing, he no longer hooks a thumb in a belt hidden under his open overshirt, which drew his hand across the front of the coat at the hip.',
    // the debug pages
    'Every page reached from Debug (Creatures & spirits, the character studio, Motion, the trailer, Cinematics, Items, and What’s new when opened from there) has a small ◀ Debug button at the top left that goes back to the Debug menu; on those pages B on a controller, or Esc, does the same when nothing else is open. A world opened from the Debug list has the button too.',
    'On the Motion page, motion matching (which the game does not use) no longer sets off from standing as if already on the move: it chose a jog’s stop and leaned back looking at the sky. Its feet slide about a third less on the test runs, still more than with the game’s own animation; the page now says at the top why the game keeps that.',
  ] },
  { v: '1.5', date: '2026-10-09', items: [
    'A People page in the menu (View): everyone you have talked to, world by world, with their portrait. Open someone to read what you know of them, where they are now, and what passed between you: the quests, the things exchanged and the choices you made.',
    // the Arena
    'The Arena’s waves now come round to every foe there is: after the ink blots and the worlds’ kinds, each of the hundred new enemies alone, world by world from the Desert on, then each world’s in pairs, then all four of a world together. Each wave says what is coming and from which world.',
    'The Arena’s FOES list is easier to find and to use: the FOES tab on the left says how to open it (K, or D-pad ↓ on a controller), and the list is grouped by world, with a search and a row of world filters (LB / RB on a controller). Pick a foe to fight it again and again, or start the waves from any world.',
    'The Arena can call the temples’ guardians: from the list’s Guardians, the Keeper, the Elder, the Cloud-Mother, the warden, the First Sign and the rest come into a ring on the sand to fight as they do in their temples. Give a living one water when it pants, shoot a machine when it opens, and it comes to its end as at home.',
    // the worlds' new enemies, seen
    'The hundred new enemies can always be seen, as the other foes: their eyes glow brighter, through the orange of a wind-up too, and the dark spirits, and the spirit inside each possessed machine, are drawn with white outlines, so none of them melts into dark ground or the night.',
    // hearts, potions and the magic bar
    'Your health is now hearts: three to start, drawn in ink at the top left where the bar was, with your potions and the magic bar beside them. Foes hit a little harder: an ordinary blow takes half a heart, a heavy one three quarters, a machine’s slam or a guardian’s heaviest strike a whole heart, and a long fall up to two. One blow still never takes you from more than one heart to nothing, and Gentle still halves the harm.',
    'Hearts no longer come back by themselves. Drink a healing potion instead: C on the keyboard, View + D-pad ↓ on a controller, or tap the flask beside your hearts. It gives two hearts back after a quick swig. Potions never run out for now.',
    'The backpack’s three charges are now a magic bar under your hearts. A shot, a push or a boost spends a third of it and the jets burn it steadily; it starts filling again a second after you stop, empty to full in about four seconds. The fourth chamber lengthens the bar by a third and the quick coil makes it refill twice as fast. Saves that had them keep them, and the Engine-House’s doors still open.',
    'Spines and flames now bite a quarter heart at a time, and stepping straight back into spines no longer pricks you again at once. In the Arena, Second wind gives all your hearts back and mends them slowly, and the tank boons lengthen and quicken the magic bar.',
    // chimes, the currency
    'Foes now leave chimes when they fall: small brass discs with a square hole that pop out, glint and ring as they land. Walk over them, or just come near and they fly to you; left lying, they blink and are gone after half a minute. Small foes leave one or two, heavy ones more, and a temple’s guardian leaves a purse of forty the first time it is calmed or broken. Nothing drops in the Ink tide.',
    'Your chimes show beside your hearts and potion whenever they change, counting up as they ring in, and on the menu’s Items page by your gear. Finishing a makers’ run for the first time adds fifteen. Shops to spend them in are coming.',
    // the first shop
    'The first shop has opened in the desert: Haddu’s Chimes & Cures, a little house with a striped awning beside the way from the pilgrims’ camps up to Qanat’s main gate. Walk in through its door and you are inside, its name shows as you step in, and a save made inside brings you back inside.',
    'Haddu, a broad, slow chime-weigher in a red fez, keeps the counter. Talk to him, or look at the wares on his counter, and his shop opens: a card for each ware with its picture, what it does, its price and how many are left. Choose one, say yes, and he takes your chimes; he tells you when you are short, when something is sold out, and thanks you for every sale. It works with a controller, the keyboard, the mouse or a finger, on any screen.',
    'He sells healing potions (10 chimes), heart containers (one more heart for good, and your hearts filled) and magic expansions (one more unit on the magic bar). He only has a couple of hearts and expansions, and each one costs more than the last: the first heart is 50 chimes, a few fights’ worth.',
    'Potions now run out: a new journey starts with three and you carry five at most, so buy more from Haddu (his shelf holds three and fills again with time). Saves from before start with a full five.',
    // platforms
    { text: 'Hiraeth on Xbox, for testers with a console in Developer Mode: an app of its own that plays the game full screen on the TV with the controller, the Xbox buttons in every prompt, its menus kept inside the TV’s safe area, and the game’s updates arriving by themselves, saves kept.',
      see: 'For testers with an Xbox in Developer Mode: download the package from the xbox prerelease, install it through the Device Portal, set it to Game, and open Hiraeth from Dev Home. Press F3 (or open the frame readout from the settings) to see XBOX, the frame time and whether the JIT is on.' },
    // the title screen
    'A new title screen: HIRAETH in big ivory letters with an ink outline and a red shadow, and behind the menu one of the worlds itself, seen as on its cover: the city behind the waterfall, the Sky Stones over the cloud, the Salt Harbour’s beached ships, the eclipse over the city and a dozen more, with you standing in it. Each time you open the game it shows a different one, more often the worlds you have reached. The name and the menu come up at once on the paper and the world fades in behind them; on a phone held upright the menu sits at the bottom in two columns.',
  ] },
  { v: '1.4', date: '2026-10-09', items: [
    { text: 'Creatures and spirits: 100 reference-based enemies across 25 worlds, each with two attacks. Half are possessed old machines or dark humanoid spirits.', see: 'Open Worlds → Creatures & spirits to inspect them and try their attacks in the Arena.' },
    { text: 'Character fittings: lanterns hang from their poles, padded seams follow the suit, and enemy wings flap from attached roots. Machines and walking guardians have connected joints, shades stay upright through turns and recoil, and each enemy flashes its own warning eyes.', see: 'Watch a winged blot flap and two machines attack at different times. In the Character Studio, inspect the Buried Machine suits and the lantern poles from the side.' },
    { text: 'The quest characters beyond the Desert wear their reference designs: bird-beaked hoods in Vael, rose monastery robes, padded machine suits, gardeners’ tools, mushroom hats and the Signal Market’s radio collars. Each named person has their own colours, headwear and equipment; Wren carries her old 991 plate and riveted repairs.', see: 'Visit the ten quest worlds from the City-Shaft to the Signal Market, or open the Character Studio and choose a world’s cast. Walk around them and watch their tools follow their hands.' },
    // the fluid blade's counters
    'A perfect parry now opens a moment for a riposte: press the blade button (RB / R1) within about half a second, even with the guard still up, and the traveller turns into a fast overhead chop that hits as hard as a full charge without the wait, doubled on the stunned foe, and leaves it reeling longer, with a gold flash and a ring of steel. Miss the moment and the blade is as before.',
    'Press the blade button during an evade (B / ○), or just as it ends, for a dash cut: he springs forward past the foe’s side, sweeping the blade across it as he goes. The evade’s own dodge window is the only protection it gives, and it needs a moment to come back before the next one.',
    // foes over the world's height
    'Foes now follow you up and down. Ink blots, shades, root stalkers and shadow hounds crouch, then leap up a ledge as tall as you, and hop down after you; machines and the other heavy foes climb steps and stairs and come round by a ramp. One that can’t reach you hangs back where it can see you instead of pressing against the wall, and no foe swings at you when you stand out of its reach above it.',
    'A spitting blot now climbs steps and ramps to the high ground over you and lobs down from there, and keeps its perch while you are below. Go up after it, or walk out of its reach and it comes down.',
    'Knock a foe off a ledge with a cut or the push and it lands dazed for a few seconds, stars turning over its head: your next cut lands double. From high enough, the fall ends it. The charged cut also throws foes farther.',
    // challenges in the open
    { text: 'A new optional challenge in the Signal Market, the Echo relay, built from the Undertower’s own singing stones and listening horns: walk past three walls hung with old dishes to the arch at the far end, then give each horn its own stone’s note. Splash a stone close enough for the echo shell to catch its song, carry it the length of the street to the horn of its colour and play it back; the shell holds one note at a time. Oyo, who sells lanterns on the avenue, has a word for you when you finish.',
      see: 'The Echo relay is in the first side street west of the avenue, a few steps from where you arrive, behind the lantern stalls. It wants the fluid gun and the echo shell from the Undertower. Walk up to the sign and press X / □ (E); play the shell back with Y / △ with no gadget in hand (V).' },
    { text: 'And one in Viridel, the Vine walk, from the Greenhouse’s own seeds and flower-doors: four white decks stand in a line down a long slope of the meadow, higher over the meadow the further they go, with a gap between each. Bloom the seed at each gap and its vine grows a bridge across; bloom the flower-door on the third deck to get through. Fall into the meadow, or open your wings, and the run is over. Mira, who keeps the water clock, has a word for you when you finish.',
      see: 'The Vine walk starts at the top of the long slope just east of Mira and her water clock. It wants the bloom mode from the Greenhouse: switch the gun to it (D-pad ← / →, X) and splash each seed. Walk up to the sign and press X / □ (E).' },
    'Knock a foe into deep water with a cut or the push, off a bank or a ledge, and it is swept away in a great splash. In the shallows it only wades.',
    'A temple’s crystal pendulum that you have stilled now holds a foe that walks into it: the frost takes it for a few seconds, harmless, its eyes pale, and your next cut lands double. Swinging, the crystal still knocks foes away.',
    { text: 'And one in the Sky Stones, the Bell crossing, from the Founders’ Belfry’s own fallen-up bridges and bell-tuned door: four stone decks float in a line out over the sea of cloud, and the stones of the bridge across each gap hang high above it. Sound the bell-note whistle by the bell at the gap’s edge and they come down into place; the door on the last deck opens to the bell too. Fall into the cloud, or open your wings, and the run is over. Sister Aube, the hermit of the edge, has a word for you when you finish.',
      see: 'The Bell crossing starts at the south rim of the starting plateau, past Sister Aube’s hermitage. It wants the bell-note whistle from the Founders’ Belfry. Walk up to the sign and press X / □ (E); sound the whistle with Y / △ with no gadget in hand (V).' },
    // controllers
    { text: 'Button prompts now always name one button, the one on the controller in your hands, never two names for the same button side by side. Before your first press in a world, and on the Steam Deck, they use the controller you last played with, or the Deck’s own letters.',
      see: 'Start a world with a controller and don’t touch it while it loads: the prompts on the loading screen, the hints and the menus already show A, B, X, Y (or the shapes of the PlayStation pad you last used), never both. On the Steam Deck it is the Deck’s letters from the first second.' },
  ] },
  { v: '1.3', date: '2026-10-09', items: [
    // the desert's first hour
    { text: 'Ama no longer waves you straight on to the city while she still has her jar for you: as you come up to the camps she calls you over to her fire, once more at most if you pass near, and then asks about it as soon as you sit down. Once the jar is yours she waves you on as before.',
      see: 'Start a new game and walk from the ship to the camp fires outside Qanat without talking to anyone: Ama shouts for you to come by her fire. Talk to her and pick “You called me over. A jar?”.' },
    // the route's people and Ilen
    { text: 'Once you know who Ilen was, a few people along the way have a word about her: Madame Sel at the Signal Market, Hollin in the deep wood and Nour in Qanat. Sel also hears how the message ended once you have found her, and Hollin can hear where Odile and Talo went even if you never promised to come back.',
      see: 'After the mother’s recording about Ilen has played at the console, go back to Madame Sel under the tower, to Hollin on his island or to Nour under the tree, and talk to them: a new answer about your sister. After the Lantern, Sel and Hollin have one more.' },
    { text: 'Saves from before you could choose what to do with Dov’s lift token now count it as kept: Dov mentions it, and Ilen asks about it at the Lantern.',
      see: 'Load a save that got the lift token from Dov in the City-Shaft before version 0.97 and talk to him at the palace gate after the Lodestar is lit.' },
    // challenges in the open
    { text: 'Two new optional challenges built from the temples’ own pieces, out in the open. In the desert, the Wind hall: a roofless hall on a dune crest where gusts shove you back unless you shelter behind its screens, and three eyes to wake in one breath at its end. In Lorn, the Hush walk: a causeway over the lake with crystal pendulums swinging across it, out to the round stone and back without being knocked into the water. Each has a sign that shows the makers’ mark, then your best time, and someone who lives nearby has a word for you when you finish.',
      see: 'The Wind hall stands on the dune crest west of the desert’s landing, near Pell: walk up to the sign by its steps and press X / □ (E). The Hush walk is on Lorn’s south shore, a short walk from the landing.' },
    { text: 'Two more of them. In Vael, the Feather leap: open your wings in a column of rising wind to reach a tower’s terrace, cross it through the gusts from screen to screen, then glide over a gap to a lower ledge, without coming down on the plain. In the Buried Machine, the Furnace steps: jump across eight iron pillars over a glowing grate, then wake the four eyes round a sealed door in one breath. Kesh and Jot have a word for you when you finish.',
      see: 'In Vael, the Feather leap stands north-west of where the ship lands, near Kesh and the stone hand; it wants the fluid wings. In the Buried Machine, the Furnace steps are on the sand east of the landing, past Jot; they want the fourth chamber. Walk up to the sign and press X / □ (E).' },
    { text: 'And two more, with the temples’ stone balls to roll onto their plates with the fluid’s push. In the Garden of Spheres, the Sphere court: weave a slalom of stone spheres, then roll two white spheres home from either end of the court. In the City-Shaft, the Long look: roll a stone ball out along a makers’ balcony over the shaft, jumping the gaps behind it, with no parapet between you and the drop. Nell and Tobin have a word for you when you finish.',
      see: 'In the Garden of Spheres, the Sphere court lies on the meadow south of the mirror lake, near Nell. In the City-Shaft, the Long look reaches out from the rim a short walk round from the spawn, near Tobin, who sells views. Both want the fluid gun: switch it to the push (D-pad ← / →, X) and push each ball from behind.' },
    { text: 'While you are running a trial or a challenge, the game’s other notices wait for the results: only the clock and the goal stay on the screen.',
      see: 'Start the Wind hall or any world’s trial: the box hints and other messages that would have come up during the run show after it.' },
    // the makers' boxes
    'Opening a makers’ box now ends with a moment that suits what was inside: a gadget is tried once, the pale star is pinned on and shown worn, a charm is turned over in his hand and pocketed, a part for the tank clicks onto the pack, the glyph lens and the listening shell turn him toward the nearest box still shut, and the whistle and the echo shell play a few notes. It lasts under two seconds, and B / ○ or Esc skips it.',
    'A box also takes its time from what it holds: a gadget’s box rocks three quick times, a charm’s only twice and opens sooner.',
    // the fluid blade
    'Hold the blade button (RB / R1) and the first swing turns into a charge: the traveller draws the sword back over his shoulder and holds it there, the blade pulsing and gathering sparks, a ring when it is full. Let go for a wide sweep taken from a great-sword swing: it hits harder (harder still when full) and staggers even an armoured foe or one already swinging at you. A quick tap still swings as before.',
    'A swing in the air is now a leaping overhead cleave: at the top of the jump he lifts the sword over his head, hangs a moment, then drops onto the foe below with it, carried in a little if it is just out of reach. One a jump.',
    'Going from one sword swing into the next, into the guard, or back to walking now blends smoothly instead of snapping straight to the new pose.',
    'The blade’s spark trail sweeps through the cut itself, a full arc along the path the edge travelled, and only glints at the tip while the sword winds up and follows through.',
  ] },
  { v: '1.2', date: '2026-10-09', items: [
    // shadows in caves and rooms
    'The dark masses in shaded corners, on stairs and round furniture stay put as the camera moves instead of shifting about in blocks, and come out as brushed shapes rather than stacked rectangles, most of all on Handheld.',
    'No more bright line of sunlight round the floor of the cave under the giant and of the Givers’ Hearth.',
    // screens at every size
    'On a phone the touch buttons now size themselves to the screen: held sideways they stay in the lower right corner instead of reaching the top and covering half the view, and the stick under your left thumb needs less travel.',
    // buttons in the menus
    'Every menu shows its buttons inside the buttons themselves instead of in a line of hints under them: a small A beside the entry you are on, B on Back and Resume, LB and RB on the journal’s side tabs, X on a save’s Delete, A on Travel and Restart. With the keyboard they show its keys (Enter, Esc, Q, E); on a touch screen they stay out of the way.',
    'The buttons shown match the controller in your hands: A B X Y and LB RB on an Xbox pad, × ○ □ △ and L1 R1 on a PlayStation pad, a Switch pad’s own letters and L R ZL ZR, a Retroid’s A B X Y and L1 R1. The prompts in conversations and while playing follow it too.',
    'A Switch Pro Controller or Joy-Cons on a computer now confirm with A on the right and go back with B, as on a Switch.',
    // debug
    'Debug: the worlds list is a grid of small cards that the D-pad and stick move through in every direction; the card you are on is lifted in a red frame with A on it, always scrolled into view, and its description shows at the foot of the screen.',
    'Debug: the Items page works with a controller: move through the cards, A opens one full screen, LB and RB (or left and right) go to the other items, up and down zoom, the right stick tilts it, Y turns it, X resets the view and B closes it.',
    'Debug: an item full screen shows one short line under it; “more” (A, or I) opens the rest in a column beside it and the item moves over, so on a handheld’s small screen the words never cover the item.',
    // the desert's first hour
    'The desert gets you moving sooner: after the chest opens, Nour gives you the Speaker’s old verse herself, so Ama’s jar is the only errand before the way down under the giant. Walking with the Speaker is up to you; he still tells the old story whole.',
    'Stop at Ama’s fire on your way into Qanat and she gives you her jar there, so after the chest you go straight from Nour to the giant’s mouth.',
    'On the ride to the Givers’ Hearth, the bronze bowl, the keepers’ old camp, the glinting bell and the Hearth itself are pointed out under the view as they come up ahead, while there is still time to stop.',
    // the cinematics, a second pass
    'The makers’ boxes in the temples of the Garden of Spheres and of Lorn stand on their dais instead of sunk into it, so opening them no longer cuts your head off the picture.',
    'The City-Shaft: when the Lodestar lights again, the billboards’ LOOK UP now reads, close and square, and afterwards the camera comes back behind you instead of pressed against your head.',
    'In Vael, the bird’s arrival keeps the horizon and the stone towers under her as she comes down, instead of two seconds of empty sky.',
    'The Lantern: the light coming down out of the dusk glows from the first shot, beside the crown, instead of being out of the picture until it is nearly there.',
    'Lou’s window seat at home has a second shot: from beside you, your profile against the round window and the land beyond it.',
    'The recordings at the ship’s console cut between angles as they play: your parents’ faces close, your own face lit by them as you listen, and wide past you to the window; the words and their timing are as before.',
    'Opening a makers’ box comes in four ways now, one per box: over either shoulder, from above, or from the box’s side with the item revealed in front of your face.',
    'At the stone at home, laying everything down cuts between your hands on the slab, your face, Lou as she speaks and over your shoulder, instead of one angle for over a minute.',
    { text: 'The pale star’s description and the line as you lay it on the stone say it is pinned to your overshirt, not a hood.', see: 'Open the journal’s gear page with the pale star found, or lay it on the stone at home.' },
  ] },
  { v: '1.1', date: '2026-10-09', items: [
    // shadows and visuals, from the playtest
    'People no longer leave a pale, person-shaped ghost in the dark shading behind them (Marrow by the ship, the traveller on the stairs to the great tree), and the dark masses round them no longer jump about as the camera moves.',
    'Heading to space now opens onto the night: the jump’s streaks fly across a dark sky instead of a blank white page, and the next world’s loading screen keeps that dark.',
    // screens at every size
    'The pause menu fits on a phone held sideways (every button shows, down to Quit to title) and takes less of the screen on a phone held upright; the smallest words in the journal and on the title screen are a little larger.',
    // foes you can see, from the playtest
    'No more invisible shadow hounds: running, a hound is now a low hump of shadow with a glowing rim and lit eyes, and its body has a white outline, so it shows on the Eclipse’s dark streets.',
    'A dune ray about to burst up under you now swims at you with its fin held high, throwing sand, instead of sinking out of sight first. Its fin has a white outline and the sand it turns is darker.',
    'A foe winding up behind a wall or a rock now gets the round warning marker too, and foes never appear inside rocks or walls. A shadow hound that steps out behind you waits a little longer before it bites.',
    'Blot swarms have bigger eyes and glass splinters are a little bigger, so both are easier to spot.',
    // the stone hand, from the playtest
    'The stone hand on Vael is fairer: its fingers clearly rise from little to middle, each knuckle has one to four dots cut in it, a right knuckle stays lit and rings the next note up, and a wrong one knocks and flashes rust. After two misses Kesh calls the order out and the journal writes it down; after three the next knuckle glints.',
    // the cinematics, checked one by one
    'Notices no longer pop up over a scene: a quest’s card waits until a recording, an arrival, a box opening or a filmed moment is over, and the gadget badge and the tank’s gauge hide while one plays.',
    'The pale star from the makers’ box is pinned to your overshirt instead of hanging in the air beside your face.',
    'The Lantern: the light’s arrival is filmed again, from behind you as it comes down, across from the crown as it settles, then on your face; the camera no longer ends up against the crown’s rail, and its chime rings as it starts.',
    'At home, kneeling at the stone now turns to your face as you lay things down, and the window seat keeps your head in the picture; both show how to skip.',
    'Filling the tank for the first time in Qanat: the third shot shows you and the pool instead of the back of your head.',
    'In Vael, the bird’s arrival no longer opens from inside a dune, and opening a makers’ box now pushes in on the item instead of jumping.',
    // small fixes (made before v1.0, without a line then)
    { text: 'In the References world, the Moon Foundry’s views no longer stretch tall after the window changes size.', see: 'Debug → References, go to a Moon Foundry view, then resize the window or turn the device.' },
    { text: 'While you play a game (the shooting gallery, the drum circle, a race…), the gadget’s card, aiming mark and wheel no longer stay on the screen.', see: 'Hold a gadget, then play the shooting gallery at its stall in the Signal Market: only the game’s own display shows.' },
    { text: 'Updates on Android and the Steam Deck no longer stop partway through the download.', see: 'Settings → Updates → Check for updates on Android or the Steam Deck: the update downloads to the end and installs.' },
    { text: 'The game can be played at rnaud.github.io/moebius again, as well as on its main site.', see: 'Open https://rnaud.github.io/moebius/ in a browser.' },
  ] },
  { v: '1.0', date: '2026-10-08', items: [
    // the opening, from the playtest
    { text: 'Your father’s message at the start is shorter and tighter: four lines instead of six, about nine seconds less, and under his last words something starts to hum and the picture begins to break up, just before the impact.', see: 'Start a new game and play the voicemail in the cockpit; listen under “Bring back something of value.”' },
    { text: 'The hum everyone talks about can now be heard: a low sung note that swells three times. It rises under your father’s message until the impact, sounds again from the scar on the hull after the landing, comes from the makers’ boxes (Nour’s chest first) every few seconds as you come near, and answers softly whenever someone mentions humming.', see: 'In the desert, climb towards the chest on the great tree’s trunk, or listen when Ilo shouts that Nour’s chest is humming.' },
    'Nobody talks while the ship is still crashing: no speech balloons or talk prompts until you have the controls.',
    'Marrow no longer stands right under your ship as it crash-lands: he waits a safe distance away, to the side of the hatch.',
    'Stepping out of the ship no longer offers to take you straight back in: “go aboard” waits until you have walked away from the ramp and come back.',
    { text: 'The traveller’s backpack is now a flat ivory-framed glass reservoir with jade fluid, turquoise and lemon currents, a sage backing and matching ivory-and-sage scout.', see: 'Wear the backpack and launch the scout; the same reservoir appears in the item viewer.' },
    { text: 'The fallen giant has deep eye sockets, a toothed mouth and a broad rounded lower jaw leading into its throat. The ship gains warm coral flooring, cream overhead cupboards and an oval ceiling light.', see: 'Approach the giant beyond Qanat’s back gate, then explore the ship’s galley and central room.' },
    { text: 'The Debug button is back on the title screen and in the Start menu for everyone, for now, so testers can jump to any world.', see: 'Open the game: Debug is on the title screen.' },
    // conversations, from the playtest
    'Fewer speech balloons: walking past people, only those with something for you greet you with a balloon over their head (the one your quest points to, someone with a quest to give, someone you have never spoken to, or a bystander with news you have not heard yet). Everyone else still turns, waves and talks to you when you press X / □; calls and shouts still show.',
    'Talking to Ama by the camp fire, the camera no longer looks at her through the flames: it finds a view round the fire, as it does for every fire in the game.',
    'When Nour tells you to stand in water to fill the backpack, your answers now follow on from it: ask where there is any water out here (she tells you how it stopped rising the night the light sang), or whether living water could wake your ship.',
    'Picking an answer in a conversation no longer plays your own words back to you: the person you are talking to replies straight away.',
    'In conversations the traveller holds still: he no longer shifts his weight about, turns his head or breaks into his looking-around idle while someone talks to him, and his eyes stay on whoever is speaking instead of darting about.',
    // the HUD, from the playtest
    'Notices are quieter: soft paper and a thin line instead of a heavy inked box, and they always keep clear of the health bar. On a phone held sideways they wrap beside the touch buttons instead of sliding off the bottom of the screen.',
    'Starting a quest or an errand shows its own card, unlike the other notices: “New quest” in gold over the quest’s name and its first step.',
    { text: 'Getting into a vehicle no longer lists its buttons along the bottom of the screen; the Controls page in the settings still has them.', see: 'Get on a bike, a skiff, the bird or a cab: nothing is written at the bottom of the screen. Settings → Controls → Riding lists the buttons.' },
    'The touch buttons stay as you left them when a new world loads: hidden while you play with a controller or the keyboard, back as soon as you touch the screen.',
    { text: 'A Cinematics review page gathers the films, recordings, journeys and makers’ boxes, with replay controls and notes for quality control.', see: 'Debug → Cinematics, or open cinematics.html. Choose a scene; review notes can be exported.' },
    // the ending
    { text: 'Coming home after six worlds is now a first homecoming: something passes over the hill while you are at the stone, and the story isn’t over.', see: 'Fly home after six worlds and stay at the stone until the end.' },
    { text: 'After the Signal Market, the ship’s map charts one more place, off every chart.', see: 'After your first homecoming, play the message waiting on the voicemail, then open the holo table.' },
    { text: 'A last, small world at the end of the light’s trace, with someone waiting there, and a real ending after it: end card and credits.', see: 'Follow the trace from the map and walk the sand bar to the tower.' },
    { text: 'Some of what you decide along the way now stays with you: a guard’s lift token, a promise to a lamp-keeper, a hill of tea. The stone remembers, and so does someone else.', see: 'Talk to Dov in the City-Shaft after bringing his ration, or to Hollin in Lorn II.' },
    { text: 'Saves that already finished the game keep their ending as the first homecoming, and can go on to the new last chapter.', see: 'Load a finished save and check the ship’s voicemail.' },
    // the worlds' great moments
    { text: 'The great moment of every world is now filmed, like the desert’s first water: the bird coming down out of the haze, the bell after thirty years, the crystal cave singing, the saucer blinking back, the terraces giving way, the Lodestar lit, the lights on the Hangar’s floor, the great wheel turning, the spheres’ chord and the market’s broadcast. Each is short, plays once, can be skipped, and gives you the controls back while it is still happening.', see: 'Play the rider’s flute in Vael, or relight the Lodestar in the City-Shaft.' },
    { text: 'People’s chatter balloons no longer cover a filmed moment.', see: 'Ring the bell in Vael II: only the monks’ shouts appear.' },
    // the light's trail
    { text: 'The Sketchbook has a Sightings page: every time someone tells you about the singing light, the makers’ three dots over an arc, or a voice sent from far away, it is noted there with the world and who said it. A question mark waits for each one still to find.', see: 'Open the menu’s Sketchbook after talking to Oum and Marrow in the desert.' },
    { text: 'Each of the twelve worlds off the route now hides one trace of the light, or of someone who came that way alone before you: a person who remembers, or a mark burned, fused or chalked somewhere.', see: 'Liss on the White Mangrove’s ring walk, or the burned mark at the foot of the Fallen Ring’s tilted piece.' },
    // the words, edited
    { text: 'The last chapter’s great conversation is gentler: it leaves room to take in the news, tells what it knows in its own words, and lets you answer more than one way.', see: 'At the end of the light’s trace, when asked to tell it straight, try “Can I sit down first?”' },
    { text: 'The oldest recording on the reel is just a family morning again: a baby, a spoon and a wave, the way old tapes are.', see: 'The true ending, at the stone.' },
    { text: 'Oïa rides the Overnight Train without a word, the way she keeps her tower: watch what she points at.', see: 'The train’s sky lounge.' },
    { text: 'Answers that no longer matched what was said to you now do, from Nell’s reflections to Dun’s wandering key and Saba’s rain; and a few story slips are mended: where people come from, how long Hollin has kept his lamps, and the desert’s two Givers’ places no longer share a name in directions.', see: 'Talk to Nell in the Garden of Spheres, Dun in the Buried Machine, Saba at the crystal in Lorn, or Sabri in the desert (“the rose-stone house”).' },
    { text: 'Lines and hints that teach a control now name your own keys or buttons and follow your remapping, and change with you if you pick up a controller mid-conversation; on a controller the gun’s push is always the D-pad, never X.', see: 'In the Signal Market, ask Ferro about the bulbs, then remap Aim (Menu, Controls) and talk to him again.' },
    { text: 'The Android app and the Steam Deck package are about 39 MB smaller: the photographs the developer’s reference world is drawn from stay on the website, where that world reads them anyway.', numbers: [{ title: 'Reference photographs carried by the device', unit: 'MB', better: 'lower', device: 'the APK and the Deck package', rows: [{ where: 'reference sheets', before: 38.8, after: 0 }], source: 'node .claude/skills/perf-audit/size.mjs; scripts/site-only.mjs' }] },
    { text: 'The Android app and the Steam Deck download are about 100 MB smaller: they carry only the Desert’s music and download the other worlds’ themes once, in the background, the first time you open the game, then keep them for offline play.', numbers: [{ title: 'The Android app', unit: 'MB', better: 'lower', device: 'the APK, estimated from the packaged files', rows: [{ where: 'download', before: 229, after: 130 }], source: 'scripts/site-only.mjs, src/music-store.js' }], see: 'Open the game online and look at Settings, Updates: “Music: 18 of 25 downloaded” counts up while the themes arrive. A world entered before its theme has arrived plays its composed score, and the recording comes in at the next musical moment.' },
    { text: 'Game updates are about 100 MB smaller too: the music no longer comes with every update.', see: 'Check for updates on Android or the Steam Deck: the download is much smaller than before.' },
    { text: 'The traveller is about half the download and far lighter to draw, looking exactly the same: files he never used are gone, his textures are sized to what any screen shows, and away from close-ups he is drawn with fewer triangles (conversations and close shots always use his full model).', numbers: [{ title: 'The traveller', better: 'lower', device: 'the Mac, Chrome; Handheld preset for triangles', rows: [{ where: 'download (MB)', before: 13.3, after: 6.9 }, { where: 'graphics memory (MB)', before: 179, after: 45 }, { where: 'texture upload at load (ms)', before: '350–430', after: '90–100' }, { where: 'triangles a frame, behind him (thousands)', before: 223, after: 64 }], source: 'scripts/bench/traveller.mjs; docs/systems/characters.md, “What the traveller costs”' }], see: 'Play anywhere: he should look just as before, and close-ups are unchanged.' },
    // the sound, from the playtest
    { text: 'Footsteps follow what you walk on: grass or sand on the open ground, stone on rocks, roofs, stairs and the ship. Grassy worlds no longer rustle like leaves on every surface.', see: 'At home, walk off the grass up the ship’s ramp or onto a rock: the rustle turns to a firm step, and back to grass as you step off.' },
    { text: 'The desert wind is much quieter, and a sandstorm rises to a low roar instead of a hiss over everything.', numbers: [{ title: 'The desert wind: how loud, against before', unit: '%', better: 'lower', note: '100 = as loud as before; 10 dB less sounds about half as loud', device: 'any (rendered offline)', rows: [{ where: 'calm (-46.7 → -54.1 dBFS)', before: 100, after: 60 }, { where: 'gusting, walking (-42.4 → -47.5 dBFS)', before: 100, after: 70 }, { where: 'sandstorm, walking (-32.3 → -40.5 dBFS)', before: 100, after: 57 }], source: 'tests/sound-mix.test.js: the game’s Sound rendered by engine/webaudio.js, the loudest 100 ms' }], see: 'Stand in the desert through a sandstorm: the music and your steps still come through.' },
    { text: 'Water welling up, in the desert’s cave channel and its city well and the Buried Machine’s oil dish, now gurgles and bubbles softly instead of a loud whoosh.', numbers: [{ title: 'The water welling up: how loud, against before', unit: '%', better: 'lower', note: '100 = as loud as before; 10 dB less sounds about half as loud', device: 'any (rendered offline)', rows: [{ where: 'loudest moment (-22.9 → -36 dBFS)', before: 100, after: 40 }], source: 'tests/sound-mix.test.js: the game’s Sound rendered by engine/webaudio.js, the loudest 100 ms' }], see: 'Clear the rib off the cave’s channel in the desert, or watch the city well rise.' },
    { text: 'Whistling for your hoverbike or hailing a taxi is far softer, and so is the Overnight Train’s whistle.', numbers: [{ title: 'The whistles: how loud, against before', unit: '%', better: 'lower', note: '100 = as loud as before; 10 dB less sounds about half as loud', device: 'any (rendered offline)', rows: [{ where: 'calling the mount (-20.8 → -30.2 dBFS)', before: 100, after: 52 }, { where: 'the train (-27.1 → -31.5 dBFS)', before: 100, after: 74 }], source: 'tests/sound-mix.test.js: the game’s Sound rendered by engine/webaudio.js, the loudest 100 ms' }], see: 'Call the hoverbike (D-pad ↓) in the desert.' },
    // menus and settings
    'The galactic map charts only finished worlds: the detours still being made are off it until they are ready.',
    'Every setting works on a controller: A / × opens a dropdown, the D-pad or stick goes through its choices, A / × keeps one and B / ○ leaves it as it was; left and right still change dropdowns and sliders.',
    'The language no longer changes by itself on a controller: holding right into the Settings stops on the first setting, and the Language dropdown changes only once opened with A / ×.',
    // loading
    { text: 'The Steam Deck no longer hangs on “mixing the inks…”: a graphics driver that never says when it has finished its work no longer holds the loading screen up, and every world loads in seconds again.', numbers: [{ title: 'Loading the Desert with a driver that never reports its work done', unit: 's', better: 'lower', device: 'a Mac, headless Chrome, the driver’s silence simulated', rows: [{ where: 'Desert', before: 185, after: 3.8 }], source: 'src/load-steps.js gpuPacer; a CDP script overriding getSyncParameter' }], see: 'Start any world on the Steam Deck: the loading screen goes past “mixing the inks…” in a few seconds.' },
    // characters and animation, from the playtest
    'People wave properly when they greet you: the arm comes out to the side with the hand up and waving side to side, eased in and out, instead of a stiff arm shot straight up and snapping back.',
    'The traveller no longer wrings his neck when he looks about while standing: his head turns over his shoulder as far as a neck goes, instead of nearly backwards with his jaw sunk into his shoulder.',
    'People standing in a crowd step out of your way when you brush past: a step to the side or back, at a walking pace, feet moving, half turned to you, then back to their place, instead of sliding off their spot.',
    'Looking into the dry well in Qanat, the traveller now faces the well and looks down into it, instead of turning his back on it.',
  ] },
  { v: '0.99', date: '2026-10-08', items: [
    // playing your way
    { text: 'You can choose your own keys and controller buttons: open Controls, pick an action and press its new key or button. Two actions on one key are flagged, Reset puts the defaults back, and every prompt on the screen shows your keys.', see: 'Menu → Controls → Your buttons / Your keys.' },
    { text: 'Run and guard can be held or toggled.', see: 'Settings → Controls → Run, Guard.' },
    { text: 'A Text size setting (Small to Larger) makes conversations, notes, story pages and menus easier to read on a small screen, and speech can have a plain, solid background for more contrast.', see: 'Settings → Screen and text, then talk to anyone.' },
    { text: 'Reduce motion turns off camera shake, freeze-frames and slow motion and stills the title view; it is on by itself if your system asks for less motion. A slider sets how much the camera shakes.', see: 'Settings → Camera and motion, then land a blade hit.' },
    { text: 'The lock-on ring changes shape as well as colour: doubled chevrons as a foe winds up, a burst at the strike, chevrons turned round a hollow ring when it is open to a cut. Low health is hatched too, and a winded stamina wheel shows “!”.', see: 'Lock on to a foe in the Arena and parry it.' },
    { text: 'Menus, settings and prompts can be in French as well as English (the story is still in English).', see: 'Settings → Langue / Language → Français.' },
    // the tools in the worlds
    { text: 'The gadgets are now in the worlds: each route world after the desert has a makers’ court of pale stone with a box holding one gadget, and everything round it is there to try it on.', see: 'The court on the rise west of Vael’s landing (the grappling hook).' },
    { text: 'Every route world has an optional trial: walk up to its glowing sign for a timed run built from that world’s ride or ability. Your best time is kept, and the first finish wins an upgrade for a gadget.', see: 'The sign by the dunes east of the desert’s landing (the hoverbike run), or the wind columns west of Vael’s landing.' },
    { text: 'Columns of rising air stand over Vael’s plain: open your wings in one and it lifts you; knock a foe into one and it is thrown up.', see: 'Vael, west of the landing.' },
    // foes and fire that use the world
    { text: 'Winged blots and rust drones rise to stay above you, hold their height out over drops, and hide behind rocks for a moment between attacks (less long on Gentle).', see: 'The rust drones in the Sealed Hangar, or the Arena’s flyer wave.' },
    { text: 'Foes can be knocked into the world: shove or blast one into cactus spines, snapping jaws or fire and it is cut; a long fall hurts it, and one knocked into a chasm is gone. In temples, updrafts, gusts and swinging crystals push foes about too.', see: 'The desert’s cacti with the gust fan, or the jaws and pendulums in Lorn’s Hush-House.' },
    { text: 'Fire spreads by itself: a burning bramble lights the next, further downwind, the fan’s gusts throw sparks, and creatures run from the flames. Stilling puts a fire out; bloom grows a burnt bramble back.', see: 'The bramble hedge at a desert camp’s edge: light one with an ember.' },
  ] },
  { v: '0.98', date: '2026-10-08', items: [
    // the first minutes
    { text: 'A first-time player is no longer greeted with “Updated to…”: that note is only for players coming from an older version.', see: 'Start on a new device: no note at the title or in the desert.' },
    { text: 'The title screen’s Debug button and the menu’s “Debug: worlds” are gone (tick Developer panel in Settings to bring them back).', see: 'The title menu.' },
    { text: 'In the ship, if you stand still for a while before playing the message, one quiet line says how to move and look (or where the message is), then goes.', see: 'The prologue: wait 20 seconds by the bunk.' },
    { text: 'Your first steps in the desert say once how to look around and how to jump, only if you haven’t already, with the buttons you are holding.', see: 'Step out of the ship and wait without touching the camera.' },
    { text: 'The makers’ chest leaves one shot of old fluid in the tank, so you can try the gun straight away; the giant’s pool still fills it.', see: 'Open the chest on the tree and shoot once.' },
    { text: 'Nour has you listen at the well with her, and Ama’s jar and the Speaker can be done in either order: two errands where there were four in a row.', see: 'The quest list after the chest opens.' },
    { text: 'On the ride to the Givers’ Hearth: a keepers’ bowl that lights its stone when you fill it, their cold camp halfway, and a bell glinting in the sand (the Speaker would like to hear of it).', see: 'The marked stones along the way to the Hearth.' },
    { text: 'Prompts name what you are holding: on a controller, the tank’s first fill says the D-pad switches to push, not X.', see: 'The note at the giant’s pool, with a controller.' },
    { text: '“Your father’s charge” is lettered small and low on the screen, not across the middle, and leaves sooner, so the world you land in can be seen.', see: 'The card after the crash, or on arriving in any world.' },
    // the sound of the traveller
    { text: 'The traveller is no longer silent: jumps, landings (harder the further you fall, and different on stone, grass and sand), grabbing a wall, pulling up over a ledge, the roll, the wings opening and folding, the jets lighting, being knocked down and getting up all make soft, recorded sounds.', see: 'Jump off a rock in the desert, then off a roof in the City-Shaft.' },
    { text: 'Now and then the traveller breathes out on a jump or a climb, and a blow draws a short grunt: never often, never twice in a row.', see: 'Climb a few ledges in a row, or let an ink blot hit you.' },
    { text: 'Footsteps, swimming strokes, splashes and the makers’ boxes’ creak and knocks use real recordings, every step a little different.', see: 'Walk across grass, then wade in and swim.' },
    { text: 'The fluid blade lands with weight: each cut of the combo has its own whoosh, the third deeper; a hit lands with a wet slap of ink and a thud, heaviest on the third; a block splashes and knocks.', see: 'A three-cut combo on an ink blot.' },
    // the music
    { text: 'The music keeps itself for the moments: a world’s theme plays as you arrive, indoors and when you find something (a relic, a keepsake, a box’s gift, a story moment), then fades and lets the wind, the world and a quiet drone carry you, and comes back later.', see: 'Land in the desert, wait two and a half minutes, then open a box.' },
    { text: 'New setting, Music plays: Moments (the new default) or Always (the theme all the time, as before).', see: 'Settings, under Music.' },
  ] },
  { v: '0.97', date: '2026-10-08', items: [
    'The traveller has a new face and wavy hair, rebuilt from the character drawings in Tripo, with more natural eyes. The new head moves with him and supports blinking, expressions and speech.',
    'The traveller’s chin keeps the shape of his new head: fitting the neck into the scarf no longer pushes the jaw forward.',
    { text: 'Locked on, flick the right stick (or the mouse) left or right to switch to the next foe on that side; R3 or Tab still locks on and lets go.', see: 'In the Arena, lock on (R3 / Tab) in a wave of three, then flick the right stick sideways: the reticle jumps to the foe that way.' },
    { text: 'A cut that lands but doesn’t stop a foe (a heavy one, or one already committed to its blow) now answers with a dull thunk, sparks and a gold ring, and the first time the game says what does stagger it.', see: 'In the Arena, choose the makers’ machine and cut it while it walks up: thunk and sparks. Cut it early in its wind-up, or with the heavy third swing: it reels.' },
    { text: 'Winged blots and rust drones can be fought with the blade: a swing from the ground at one hovering over you leaps you up to it, and a cut knocks it down within reach for a few seconds.', see: 'In the Arena, choose the winged blot and swing at it while it hovers: you leap up into the cut, it drops low, and you can chain the next swings on the ground.' },
  ] },
  { v: '0.96', date: '2026-10-08', items: [
    // staying in the fight
    { text: 'Foes no longer walk off when they knock you down: they wait round you, facing you, and come on again as you get up.', see: 'In the Arena (the worlds list), choose a foe from the FOES tab on the left (the makers’ machine knocks you down) and let it hit you: it holds a step away while you rise, then attacks again.' },
    { text: 'A foe you lead away from where it stood keeps fighting while you are still there; it goes back only once you have left too.', see: 'In a temple, draw a machine out of its room and keep fighting it: it no longer turns its back on you halfway.' },
    { text: 'Spitting blots and rust drones back off a step when you close in, then stand their ground and fight, instead of running from you across the field.', see: 'In the Arena (the worlds list), choose a foe from the FOES tab on the left, choose the spitting blot and run at it: it backs off about two metres, then holds and lobs at you.' },
    { text: 'While a foe you can see is striking, one behind you or off the screen waits its turn, so a blow from behind never lands on top of one you are watching.', see: 'Fight a wave of three or more in the Arena: the one behind you only attacks when nobody in view is.' },
    { text: 'The dune ray is easier to read: buried, a tall dark fin and an ink ripple on the sand show where it swims, and a cut at the fin flushes it out. Up, it stays up a few seconds to fight instead of diving after every attack.', see: 'In the Arena (the worlds list), choose a foe from the FOES tab on the left, choose the dune ray: cut at its fin as it circles, then fight it on the surface.' },
    { text: 'Shadow hounds are solid once they come close; only further off are they shadows the blade passes through.', see: 'In the City During the Eclipse, or the Arena’s shadow hounds: let one run up to you and cut it before it pounces.' },
    // the lock-on
    'The lock-on has a new reticle: four gold chevrons on a hand-drawn ring, sized to the foe, with pips over it for what is left of it.',
    'The reticle reads the foe: it turns red and closes in as a strike winds up, meeting as it lands; it spreads pale blue while the foe is open to a cut, and dims while it can’t be cut (a ray under the sand, a hound running as a shadow).',
    { text: 'When the foe you are locked on to falls, the lock moves straight on to the next one near you, and a new lock picks the foe nearest the middle of the view.', see: 'Lock on (R3 / Tab) in a wave of several and cut one down: the reticle snaps on to the next.' },
    // the blade
    { text: 'A swing begun with a foe just out of reach steps you in to it, so the cut lands where you meant it.', see: 'Stand a long step from a foe and swing: the traveller closes in through the wind-up.' },
    { text: 'An attack pressed during an evade, or just before the blade is ready again, is remembered: it swings as soon as it can, so evade-then-cut flows.', see: 'Evade (B / ○, Alt) and press attack before the evade ends: the cut follows straight out of it.' },
    { text: 'The blow that finishes a foe lands harder, and the last foe of a fight falls in a moment of slow motion.', see: 'Cut down the last foe of an Arena wave.' },
  ] },
  { v: '0.95', date: '2026-10-08', items: [
    'The Desert’s golden dunes are the warm ochre of its drawings now, not a pale cream, and a dune in shade (round Qanat too) turns a deeper orange-brown instead of a khaki grey; the shadows lean violet-blue.',
    'The Glass Dunes: the sand is a pale peach in the light (it was a flat salmon), the glass a deeper emerald with bluer tops, the far walls keep their green instead of fading grey, and the evening sky runs from a warm peach at the horizon to grey-teal overhead.',
    'The Buried Machine’s dunes are a warmer cream and shade a soft sage, as in its drawings (the shadows were a cold grey-brown), and the hanging city is a deeper slate blue.',
    'The Sealed Hangar is painted in the dusty tones its people are drawn in: faded blue, mustard, lilac, coral and olive instead of toy-box colours, a paler sage ground and a softer sky.',
    'The City-Shaft’s shade is one steel blue, as in its drawings: a pink wall’s turned side goes blue, not a dull grey-lavender; cast shadows a lighter step, and the haze down the shaft a clearer, thinner blue.',
    'On the Overnight Train the night sky glows: a broad rose band along the horizon fading up into the blue-violet, where there was a thin pale line under a flat blue.',
    'Lorn’s long evening shadows are violet now, not near-black stripes across the moss; the moss a softer olive and the evening light a paler mint.',
    'Lorn II, the Deep Wood: the swamp floor is a greener teal and the crystal reeds a lavender instead of a glaring white.',
    'The City During the Eclipse is darker and bluer, as its pictures are: the lime walls a blue lavender instead of a pale violet, their shade a deep indigo, more of the streets in shadow and darker pockets in the doorways, so the lamps glow warmer against them.',
    'The City Floating in Space is pinker: its walls salmon and coral rather than cream, their shade a rose that keeps their colour, the far islands no longer washed pale, and far fewer stars, so the city stands out against a near-black sky.',
    'The Fallen Ring’s sky is a deeper blue, its great clouds white with a pale blue shade and a light, soft outline instead of grey lumps in black ink, the hulls’ shaded sides a cooler grey-green and the far plain a little hazier.',
    'In the Moon Foundry the moons turn from the light with a clear edge of shade, the rust goes dark brown where it is turned away, the floor is a darker stone and the far moons and pillars fade into a warm haze; the sky is a paler, greyer blue.',
    'The Underside’s town hangs darker: its timber a deep brown, its banners a deeper red, the gaps between its decks nearly black, the shade on its rock a warm grey instead of lavender, and its skies a softer blue over a warmer horizon.',
    'Vael II: the shade under the great caps is a light blue-grey under dense strokes, no longer a grey-black, the shade everywhere a bluer grey-teal, the plain a touch less glaring and the far horizon a little hazier.',
    'Vael’s shadows are a cooler, paler lilac-grey and the shadows thrown on the open sand are lighter; Viridel’s light is a warmer cream and its shade a softer grey-blue, as their people’s sheets are drawn.',
    'The Signal Market: the street’s shade a bluer teal with a little of each wall’s own colour in it, its far end going pale in the haze, fewer black masses in the towers’ machinery and a finer line; at night the dark walls and screen casings a slate blue instead of near-black, and the lane’s paving a deep night blue.',
    'The Forest of Antennas: the masts in the middle distance pale into the yellow air, the violet grass a softer mauve with lighter tufts, the lattices a warmer rust in a finer line, and the great receiver on the path to the workshops a dark navy against the glare.',
    'The City Behind the Waterfall: the cavern’s rock a deeper teal, the falls a brighter turquoise, and the houses keep their warm stone in the shade, so the city glows against the dark cave.',
    'The Salt Harbour: the shadows on the salt a clear cerulean blue instead of grey-lilac, the terracotta hulls a deep rust in their shade, a softer sky, and the hulls’ plating and the ropes drawn in a lighter line.',
    'The Underwater City: the coral towers stay pink into the distance and all round, the water veiling them later and less, and the walks a darker teal beneath them.',
    'The White Mangrove: the great trees a cooler white that splits into a pale light and a lavender-blue shade instead of one even pink, the lake’s creatures glowing electric blue and magenta, and the wood behind a deeper blue.',
    'The Garden of Spheres: the white stone’s shade a sea-green grey, as in the drawings, the umbrella trees’ trunks a blue-grey, and the lawns a warmer yellow, less lime.',
  ] },
  { v: '0.94', date: '2026-10-08', items: [
    { text: 'Game updates can now deliver the full soundtrack to Android and Steam Deck, and the website can publish all 25 themes.', see: 'Check for updates, then visit any world with music enabled. Downloaded music remains available offline.' },
    {"text": "Home has a quiet new piano-led theme, completing the instrumental soundtrack for all 25 playable worlds.", "see": "Visit these worlds with music enabled; each has its own instrumental recording, balanced beneath dialogue and ambience."},
    {"text": "The Moon Foundry, the Underside, the City Floating in Space and the Overnight Train now have their own instrumental music.", "see": "Visit these worlds with music enabled; each has its own instrumental recording, balanced beneath dialogue and ambience."},
    {"text": "New music follows you through the Glass Dunes, the Underwater City, the City During the Eclipse and the Fallen Ring.", "see": "Visit these worlds with music enabled; each has its own instrumental recording, balanced beneath dialogue and ambience."},
    {"text": "The Salt Harbour, the City Behind the Waterfall, the Forest of Antennas and the Atelier gain new instrumental music.", "see": "Visit these worlds with music enabled; each has its own instrumental recording, balanced beneath dialogue and ambience."},
    {"text": "Lorn, the Deep Wood, the Signal Market and the White Mangrove now have their own instrumental soundtracks.", "see": "Visit these worlds with music enabled; each has its own instrumental recording, balanced beneath dialogue and ambience."},
    {"text": "New instrumental music fills the Sealed Hangar, the Buried Machine, Viridel and the Garden of Spheres.", "see": "Visit these worlds with music enabled; each has its own instrumental recording, balanced beneath dialogue and ambience."},
    { text: 'New instrumental soundtracks accompany the Desert, the City-Shaft, Vael and the Sky Stones, each with its own instruments and mood.', see: 'Visit these four worlds with music enabled. The recordings loop softly, hush near musicians and under menus, and follow the music volume and mute controls.' },
  ] },
  { v: '0.93', date: '2026-10-08', items: [
    'The shade has a new look: a cartoon drawn in negative, a flat black figure with a clean white outline and a few white strokes for its folds, so it stands out in the desert at noon and in the night market alike. Its head is a black flame with two white eye-slits, rising from its shoulders to three wavy tips that lick upward, with small black wisps breaking off them. The flame streams back as it runs, flares up as it winds up an attack, whips across with the swing, gutters and shrinks when you hit or stun it, and tears away into black licks as it dies, while its body pours back down into the ground. Its sword swing plays again (it had stopped moving its arms), and the drops it sheds are plain black.',
    'The shield is a device now: a small brass disc worn on the back of your left hand. Raise the guard (LB / L1) and in a blink six brass petals fan out round it and the tank’s fluid spills out beyond them: not a disc but a living blob of it, its edge never quite round and always rippling, drawn in ink as a few strokes swirling round the hub inside a bright wavy rim, so you still see yourself through it. As it opens it swings off your hand on a short brass arm to sit in front of your chest, turned to face the blow, so it guards both sides alike (about 52° either way of where you face; it used to lean to the left, 63° there and only 28° on the right). A ripple runs out to its rim while you hold it, a block sends ripples running out, a perfect parry bursts bright rings off it, it cracks and flickers when a blow finds the tank empty, and it folds back into the disc when you let go, each with its own click and hiss. What it guards is what it covers as drawn: a blow is blocked if it comes from within the shield’s edges as seen from your chest.',
    'The evade (B / ○) now has a moment of invulnerability, as in the big action games: from just after you push off until just before you land (0.03 to 0.24 s of the 0.28 s dodge, to its very end on Gentle) no blow lands on you: strikes, lobbed globs, charges, flashes, harpoon lines, grabbing roots and shockwaves pass through, and you cross burning slag unburnt (stand in it after, and it burns). Dodging through a blow is a perfect dodge: the moment freezes for a blink, a white ring at your feet, and in Ink tide it is worth style points. It cannot be chained into lasting cover: after each window comes a short rest without it, and an evade begun too soon after the last has none.',
    'In the Arena you always have the backpack, the fluid blade and the shield, even on a brand-new save that has not found them yet; they are lent for the visit and nothing is written to your save.',
    'The sword sits in your fist: its grip closed in the fingers, the guard over the thumb, the pommel under the little finger, the blade along the hand and its edge leading every cut, on every swing, the heavy one, the whirl, strafing, evading, blocking and taking a hit. It stays in your hand in a fight and for a moment after (all the while you are locked on), and is put away when you climb, swim, glide, fly, ride, aim, fall or talk.',
    'Each world now has foes of its own, the loose ink taking the shape of what is round it: the packs in the wilds, the guards round a relic and the rooms of some temples are drawn from the world’s own kinds, and the first time each kind comes for you the game says what beats it.',
    'Dune rays swim under the Desert’s sand and the Buried Machine’s: a ripple ring closes round your feet, and they burst up there. Glass golems walk the Glass Dunes: slams, a burst of shards and a hurled chunk; bombs crack them deep, a perfect parry chips them, and they break into splinters that keep coming. Salt crabs in the Salt Harbour and the Underwater City turn the blade with their shells from the front: get round them, guard their spinning charge to flip them on their backs, or crack the shell with a bomb.',
    'Sign moths of neon tube in the Signal Market flare their wings to blind whoever looks at them (turn away or guard). Rust drones in the Sealed Hangar, the City-Shaft and the Moon Foundry hang out of reach and fire a harpoon on a line that drags you in: guard it to cut the line, or pull them down with the magnet glove. Root stalkers in the White Mangrove and Lorn run their roots along the ground to grab you, then lash; cut them to break free, burn them with embers, or put them to sleep with a bloom glob.',
    'Slag walkers in the Moon Foundry leave burning slag where they tread, stamp rings of it and pour it ahead; a plain fluid shot cools their crust so the blade bites twice as deep. Shadow hounds in the City During the Eclipse run as shadows the blade passes through, solid only to strike or when an ember lights them; a dark pool behind you means one is stepping through to bite.',
    'The old foes have new attacks: ink blots coil longer for a lunge and a second quick one (a guard stops the second), spitters lob a volley of three globs in a row across your way, and the makers’ machines raise both arms for a ground slam whose shockwave runs out over the floor: jump it.',
    'In the Arena a FOES tab on the left lists every kind: choose one and the waves stop while it comes for you, again each time it falls; “Waves again” brings them back (?level=arena&foe=crab starts on one). With the hitboxes on, shockwaves, burning slag, a harpoon’s line and a volley’s rings show too.',
    'Hitboxes, to study a fight: in the Arena a board by the way in shows or hides them (X / □, E), and anywhere F4, both sticks clicked together (L3 + R3), the dev menu or ?hitboxes=1 do too; the choice is kept. Drawn over everything in bright lines: the traveller’s hurt column, the blade’s cone and edge (yellow, red on the frames it cuts, with its sweep), the guard’s arc (white while a parry would land), an evade, the lock-on; each foe’s body, its sight and reach, where its strike lands (orange as it winds up, red while it lands) and its state in words, stunned or reeling; shots, bombs’ blasts and the hook’s line.',
    'The Arcade (Debug worlds, next to the Gadget Yard): a round plaza with an arcade sign for every game, its name and your best on a plate under it. Walk up and press the interact button to play; Quit or the end of a run puts you back in front of that sign. The games board by the way in (or Tab, or D-pad ↓) lists them all to jump straight into one, and a game started from the Arcade has Previous game, Next game and Back to the Arcade on its cards (LB / RB or [ and ]) to go round all ten without leaving.',
    'Controls: the controller now follows the big action games. X / □ uses, talks and gets on; B / ○ evades (and, as in every menu, goes back: it now also leaves a conversation); D-pad ↓ whistles for your mount or hails a taxi; R3 sends the scout to your objective when there is no foe to lock on to. If you played before, a short note tells you the first time you pick up the pad.',
    'The bell-note whistle and the echo shell have a controller button again once you own a gadget: with no gadget in hand, Y / △ sounds them (the card in the corner shows the whistle, and it is the first slot of the gadget wheel). The bell and shell guardians can be played on a pad.',
    'Photo mode moved off the D-pad: hold View and press D-pad ↑ (View alone opens the sketchbook as you let it go). It is in the Start menu too, so a touch screen can take photos now.',
    'Controllers the browser does not know now work in full: an 8BitDo SN30 Pro (and the rest of the 8BitDo family) in its D-input mode, a DualSense or DualShock 4 in Firefox or Safari, a Switch Pro Controller or a USB SNES-style pad are read by where their buttons are, so the bottom button jumps, the D-pad answers, the right stick looks up and down, LB / RB and the triggers do their jobs and Menu and View open the menus. Pads that already worked are left as they were.',
    'An input display, to check a controller: in the Arena a small ink drawing of a pad in the lower right lights each button as you press it, shows where both sticks are and how far the triggers go, and lists the last presses with the controller’s own button number and what it does in the game, under the pad’s name and how it is being read. View + D-pad ← hides or shows it there; F6, the dev menu or ?inputs=1 bring it up anywhere.',
    'Keyboard and mouse: a left click swings the fluid blade (while aiming it still shoots); the jets are Space held in the air. B only changes gadgets: it no longer raises your guard.',
    'The Controls page shows the new layout for the controller, the keyboard and touch, with the hitbox toggle as a debug row; every prompt, item card and hint names the new buttons, and the Arena’s description no longer says LB / L1 swings the blade.',
    'Ink tide: from wave 7 the worlds’ own foes come up out of the ink too, one new kind every wave or two, mixed in with the old ones: sign moths, then dune rays swimming under the basin’s sand, root stalkers, salt crabs, rust drones, slag walkers, glass golems (their splinters are part of the wave, and score too) and at last shadow hounds running among the pillars’ long evening shadows. A new boon once the moths have come, Steady eyes: flashes blind you less, and harpoon lines and roots let go sooner. On Gentle the crowd stays as small as before.',
    'A dune ray’s glide and a salt crab’s spinning charge now catch you only inside the lane drawn on the ground before them (they used to reach a step past its sides), the lanes drawn a little wider to match. With the hitboxes on, a charge shows the circle round its body that hits as it runs, its lane kept faint behind it.',
    'The bubble wand says what its bubble burst on: a glass golem’s sharp glass, a salt crab’s crusted shell, a slag walker’s hot crust, no longer always “the machine’s shell”.',
  ] },
  { v: '0.92', date: '2026-10-08', items: [
    'Games: the worlds list (Debug) has a row of small games. Each opens on a card with its rules and its controls, counts you in 3, 2, 1, runs a clock, pauses on Menu or Esc (Resume, Retry, Quit), and ends on your score, with your best kept in your save and a stamp when you beat it. Quit takes you back where you came from.',
    'Dune skiing: the traveller on sand-skis down a kilometre of dune. Carve with the stick between the gates (a missed one costs 3 seconds), tuck on RT / R2 for speed, skid on LT / L2 to brake, fly off the lips and spin in the air (a spin landed clean takes a second off). Sand sprays off the edges, the view widens with the speed, and past the line the camera swings round to watch you skid to a stop.',
    'Sky steps: a side-on run across stones floating over the desert to the makers’ gate. Stones that drift, stones that crack and fall under you, springs that throw you higher the longer you hold the jump, 40 glyphs, banners to start again from and three lives. The jump is forgiving: a press just before landing still counts, so does one just after running off an edge, and a short press is a short hop.',
    'Canyon run: the hoverbike round the Rose Canyon, three laps against the clock. Ride the bends between banded cliffs and under stone arches, hit the wooden kickers fast to clear two chasms, take the ink chevrons for a burst of speed, and keep off the sand banks and the drifts that bog you down (hop a drift with A / ×). Every checkpoint shows your split against your best run. Its sign stands under the lavender cliffs by the desert’s rope bridge.',
    'Fishing: three quiet minutes at the end of a pier over the Still Oasis. Hold and let go of A / × to cast as far as the meter says, wait as the float bobs, strike when it goes under, then reel in on RT / R2: ease off when the line glows red, and hold the stick against the fish as it runs. Eight strange kinds live in the pond, from the glass minnow to the Old Hermit with a little house on its back; your score is the weight you land, and a journal keeps every kind you have caught. Its sign stands on the shore of the desert’s mineral basin.',
    'Ring race: the jets, tuned for racing, through twenty brass hoops strung among the sandstone needles of the Needle Field. RT / R2 lifts you off the start mesa and drives you on, the stick dives, climbs and banks, and a gold arrow at the top of the view points at the next ring. Each ring rings a note higher and tops up the tank (let go of the trigger to glide and save it). A missed ring costs 5 seconds, a crash into a needle or the sand 3, and you start again at the last ring. Your best run flies beside you as a teal ghost, and each ring tells you how far ahead or behind it you are.',
    'Wing drop: three drops from high over the Painted Mesa, a bullseye painted on its top. Fall, open the fluid wings with A / ×, ride the thermals (columns of rising air, drawn as ink swirls that turn upward) and thread the star gates for 100 each, then pull back just before you touch down to flare and land soft. Up to 600 points for landing on the centre, 200 for a gentle landing; fly into the mesa’s side or come down too hard and you tumble. The wind changes every drop, and the last one blows against you.',
    'Both new games have an arcade sign in the desert, one on each rock shelf at the ends of the hanging bridge.',
    'The shooting gallery, a fairground stall of the Signal Market: painted fish and birds slide along brass rails, ink blots pop up behind a fence, plates spin on sticks and two bells swing from the beam. You stand at the counter with the stall’s tank (six shots, full again a second after the last): aim with LT / L2, fire with RT / R2. A minute on the clock; hits in a row raise the multiplier up to ×5 and a miss ends it, gold targets are worth 100, and splashing the market’s folk with their parasols and cats costs 50. The stallkeeper calls it all from the side in the market’s patter. Its sign stands on the pavement a few steps from where you arrive in the Signal Market.',
    'Ink tide: a basin of sand in a sea of ink, and the ink keeps coming. Wave after wave of blots, spitters, swarms, winged blots, shades and machines, more of them and more kinds as you go, fought with the blade (RB / R1 attack, LB / L1 guard, X / □ evade) and the fluid gun. Between waves you get some health back and three small boons rise in front of you: a longer blade, a deeper tank, quicker refills, harder cuts, lighter feet and more; walk onto the one you want. The score is the waves cleared plus style: quick chains of cuts, perfect parries, waves untouched. With Gentle enemies the waves are smaller. Its sign stands by the way into the Arena.',
    'Drum circle: a night round a fire in the dunes with the desert’s villagers, drumming their song with them. Glyphs roll in along four spokes to the drum’s ring, one for each face button (A / ×, B / ○, X / □, Y / △; the arrows or W A S D on the keys, or tap the ring): on the beat is perfect, near it good. Hits in a row build a combo worth up to four times as much, and the longer it lasts the higher the fire burns and the harder the villagers dance. Easy, Normal and Hard each keep a best, and a Timing setting on its card matches the beat to your screen and controller (the results suggest one).',
    'Sketch hunt: three minutes in the Signal Market with your sketchbook and a list of six things to draw, never the same list twice: a ticket finch, a strange plant, someone sitting on the kerb, the silent tower from Signal Square… Hold LT / L2 to look through the sketchbook, RT / R2 to sketch, LB / RB to zoom. A sketch scores by how well its subject fills the frame and sits in its middle, seen from the side the list asks for; sketch it again to do better, and the whole list done early is worth the time left. The results are your page of sketches.',
    'Arcade signs in the worlds: the drum circle’s stands by the pilgrims’ small fire in the Desert, the sketch hunt’s on the Signal Market’s pavement by the gate. Walk up and press B / ○ (E) to play; Quit brings you back.',
    'Games, a polish pass: “New best!” is stamped only when you beat a best you had (not on a first run, and never for a score of nothing); the Games row in the worlds list shows each game’s best under its name; on a touch screen a game shows only the buttons it uses, keeps them off its cards, and its start card fits a phone held sideways.',
    'Ring race: hold Shift or RB / R1 (run, on a touch screen) to boost: faster along the nose, for a heavier burn of the tank. Space or RT / R2 alone is the thrust.',
    'Wing drop: after each landing the camera rises behind you and looks down over you at the bullseye, and on the last drop you stand clear of the results. The star gates are a little wider, and a thermal’s swirls no longer smear across the view while you circle inside it.',
    'Ink tide’s longer blade is drawn longer, not only cutting further; the shooting gallery’s bells hang lower, in reach over the rails; the sketch hunt’s readout sees people standing in the way, as the sketch does; and the drum circle’s sign in the desert stands a few steps from the child by the fire, so the button plays the game.',
    'Arcade signs for the last two games: Dune skiing’s on the crest of the tall golden dune north-west of where you wake in the Desert, Sky steps’ on the west rim of the Sky Stones’ start plateau, looking out at the stones in the cloud. The Ring race’s boost is a little stronger (40 m/s instead of 38): used on the straights with some fuel kept back, it wins about four seconds a run.',
  ] },
  { v: '0.91', date: '2026-10-08', items: [
    'Gadgets: things to carry besides the backpack, ten of them, each with its own bay in the Gadget Yard. Hold one in hand and Y / △ uses it (T, or the middle mouse button; ◆ on a touch screen). D-pad up changes it (B), and held a moment it opens a wheel: point the stick at one and let go. With nothing in hand Y / △ still sends the scout. A small card in the lower left shows what is in hand.',
    'The grappling hook: hold Y / △ to aim, and a ring shows what it would catch up to 25 m away (it finds the brass rings by itself); let go and it flies. Caught on a wall, a ledge or a ring, it reels you in: at a wall you take hold of it, at a ledge you haul yourself over the top. Caught on a crate it drags it to you; on a foe it pulls it in, stunned. Jump while reeling to let go and fly on. It works in every world.',
    'Ink bombs: hold Y / △ and a dotted arc shows where the bomb will land, with a red ring as wide as its blast; let go to throw. It bounces, rolls, fizzes and goes off after two seconds, at once if it lands on a foe: a cloud, a star of ink, cracked walls blown open, foes cut down and thrown, crates sent flying, and you knocked back if you stand too close (never hurt). Three in the pouch; another grows back every five seconds.',
    'The recall hourglass: point it at something that moved in the last few seconds (a crate knocked off a ledge, a bomb you threw, a cab in the City-Shaft’s traffic) and a dotted ink line shows where it has been, its outline drawn along the way. Press Y / △ and it goes back along that path, up to eight seconds, carrying whatever stands on it: knock a crate off a ledge, stand on it and ride it back up. Press again to stop it where it is.',
    'The ink bridge pen: hold Y / △ and a line of ink runs out from your feet toward where you aim; sweep the aim to bend it, aim higher for a ramp. Let go and it sets into a hand-inked plank up to 16 m long that you can walk across, even over the City-Shaft’s drop. It holds for twelve seconds, then wears away from both ends. Aim up steeply as you start and it draws a short wall instead, which stops foes and keeps a temple’s gusts off you. The pen’s ink flows back while you are not drawing.',
    'The seeing lens: hold Y / △ to look through a monocle of the makers’ glass. Inside its brass ring the world turns to blue ink on pale paper, and what the makers hid shows: paths of glass that hold you up only while you look, false floors that vanish, writing on walls, caches buried in the sand, and boxes and relics shimmering through walls. A foe seen through it shows its weak point, and a cut there bites twice as deep. The glass clouds over as you look (slower while you stand on what it shows) and clears when you lower it.',
    'Secrets for the glass in two worlds: words inside Qanat’s main gate and a stair of glass climbing onto it, and in the Buried Machine a bridge of glass across the canyon between two stone abutments that face each other with nothing between them.',
    'Spring boots: hold Y / △ to crouch and wind the coils under your boots, let go to spring fourteen metres straight up, or forward if you point the stick. Press again just before you land to bounce on higher, up to three times; press high in the air to stomp down: it breaks cracked floors, throws foes and crates back and brings up what is buried. No landing on them hurts.',
    'The Gadget Yard, a new world in the Debug worlds list, has a bay for each gadget round a sandy yard: a wall with rings along its top, two towers across a gap, a ring on a tall pole, cracked walls and a cracked boulder, crates and metal crates, targets on posts, a floor plate that opens a gate while a crate sits on it, and a pen of ink blots; for the lens two towers with a plank bridge between them that is not what it seems, and for the spring boots a climb of blocks up to a 20 m tower and a little room under a cracked roof. Every gadget is yours there.',
    'The bubble wand: hold Y / △ to aim and let go to blow a bubble, an ink ring with a pastel shimmer. It catches the first thing it meets and floats it slowly up for six seconds: a foe hangs helpless inside, a crate can be lifted onto a ledge, a bomb’s fuse waits until the bubble pops. Aim at your own feet, or blow one in the air, and you float up yourself, drifting with the stick, then sink gently back down. Press again, or jump, to pop it; spikes, fire and blades pop it too.',
    'The gust fan: press Y / △ to swing it (hold to keep swinging) and a gust of drawn wind blows out ahead of you: crates slide, foes are knocked back, a swarm of blots is blown apart, bombs roll, bubbles drift, sand and spray fly up, pinwheels spin, a parked skiff sails off and fires go out (a lamp lit by an ember too). In the air with the wings open, swing it at the ground to lift yourself a little, three times before you land; riding a skiff, it fills your own sail.',
    'In the Gadget Yard the bubble wand’s bay has a ledge with a floor plate on top to float a crate up to, a cracked boulder on a pillar too tall for a thrown bomb, and a pole to float yourself onto; the fan’s has three pinwheels facing three ways that open a gate when they turn together, a fire to blow out of a hut’s doorway, and a ledge to hover up to.',
    'The gadgets are in the game menu’s Items with pictures of their own (choose one there to take it in hand), and on the items page.',
    'The boomerang: hold Y / △ and a dotted line shows its flight, and whatever the reticle passes over is locked on to, up to three, each with a number. Let go and it curves out through each in turn and back to your hand: it stuns foes for a moment, flips switches and targets, cuts ropes, and brings back the small things it touches, a relic or a pot of ink. With an ember on the backpack it carries the flame and lights the lanterns it passes (stilling: it stills the foes). A wall sends it back with a clink.',
    'The magnet glove: hold Y / △ near metal up to 18 m away and the wavy ink lines of its field reach out. A metal crate or a makers’ machine is lifted and held where you look: the camera moves it, the left stick (W / S) brings it nearer or sends it further, and letting go drops it (a machine dropped from high is hurt by the fall; swung into a foe, it knocks it down). A tap throws metal away from you. Heavy metal that cannot move, an iron block or the Sealed Hangar’s brass machinery, pulls you to it instead, across a gap or up a wall.',
    'The Gadget Yard has two more bays: the boomerang’s, with targets in a row, unlit lanterns, crates hung on ropes and pots of ink out of reach; and the magnet’s, a small puzzle: lift a metal crate off a tower and over a wall onto a plate only metal can press, and a gate opens.',
    'The ten gadgets play well together: changing gadget, a conversation, a scene or a game no longer leaves the last one’s aim, reticle, magnet field, lens view or floating bubble behind, and spring boots no longer lift you into the sky in photo mode. The wheel is wider so all ten fit, each with its picture, and once you own a gadget B only changes it (it no longer raises your guard too).',
    'Gadget fixes: lower the seeing lens on a path of glass and it holds you a moment longer, flickering, so you can raise it again or step off (and the Buried Machine’s bridge no longer lets you slip between its planks). The ink pen draws on along a plank already standing, and its walls can no longer be climbed. The bubble finds foes, crates and bombs a little off your aim; the boomerang locks only on what it can see, and an ember on it spends a charge. A bomb that falls off the world is gone, the magnet’s field is drawn in fine pen lines, and a crate held up over a floor plate no longer presses it.',
  ] },
  { v: '0.90', date: '2026-10-08', items: [
    { text: 'Experimental motion matching no longer borrows the next motion capture’s pose when searching at a loop boundary. It remains an optional comparison; the normal blended movement is still the default.', see: 'Open the Motion page and compare the 90° walking turn. Matching changes clips less often, but its foot sliding and stair handling still need work.' },
    { text: 'Read a foe’s body: ink blots coil and lunge, machines plant their feet and raise their arms before slamming. Their ordinary melee attacks no longer draw warnings on the floor, and a missed strike leaves an opening.', see: 'In the Arena, watch a blot compress or a machine hold its arms overhead; step aside and attack while it recovers.' },
    { text: 'Sword cuts use the whole body, with a deliberate wind-up, a fast release and a follow-through. Attacks, guard and movement blend into each other, and a short step carries each grounded cut forward.', see: 'Stand in the Arena and press F, then press again during the swing to queue the next cut. Watch the feet and hips as the heavier third cut begins.' },
    { text: 'The moving blade makes contact during the cut. Foes recoil in the direction of the blow, heavy cuts buckle them, and the sound and brief pause land with the impact.', see: 'Compare a cut through empty air with a close hit on a machine, then land the third swing.' },
    { text: 'Attack and defense have separate buttons: F / RB / R1 attacks, Ctrl or Z / LB / L1 guards, and Alt / X / □ evades in your movement direction, or backsteps when standing. Guard just before a blow to parry without spending fluid and leave the foe open longer. On a controller, hold LT / L2 with X / □ to call your mount; push remains a gun mode; touch has separate guard and evade buttons.', see: 'In the Arena, hold guard early for a normal block, then release and time the next guard just before contact for a bright parry. Try evading sideways during the enemy wind-up.' },
  ] },
  { v: '0.89', date: '2026-10-07', items: [
    'The Glass Dunes’ glass glows from within: the sun comes through its thin edges, its foot and the lips of its waves in bands of mint and lime, the more as you look toward the light, and the giants, heads and trees held inside it are crisp dark shapes instead of soft smudges.',
    'In the Glass Dunes the light that comes through the glass falls on the sand beyond it: mint and lime pools at the walls’ feet, on the side away from the sun; and the late afternoon’s shade stays an emerald green instead of going grey.',
    'Two archways in the Glass Dunes go through now: walk through the cliff of the giants to the sand behind it, and through the frozen wave in the middle of the valley, under a vault of glass lit green. The breaking wave’s hollow can be walked into from its camp, a long way under the lip.',
    'In the References level the Glass Dunes’ fourth picture has its tall wave: it rises steep over the glassworkers’ camp, curls over its dark hollow and sweeps down to the sand, as drawn, instead of a low hood.',
    'A world picked from the Debug worlds list now opens in a separate debug save, as if you had played every world before it through: their quests done, their boxes open, the gear, the tank’s colours, the keepsakes and the recordings, with the world itself fresh. Your own saves are left as they were.',
    'The jets fly like a plane. RT / R2 is the thrust, and the harder you press it the faster you go: from the ground it lifts you straight up, about fifty metres in three seconds, where before it only hovered you off the sand.',
    'On the jets the left stick flies the nose: forward dives, back climbs, left and right bank you into a turn, so you can fly up, down and round every way, nearly three times as fast as before. The camera swings round behind you and tips up with a climb and down with a dive. Settings has “Invert the jets’ pitch” if you would rather push forward to climb.',
    'Let go of the jets in the air and you glide on, sinking gently, even out of a steep climb, down to a soft landing; a dive into the ground lands you on your feet. Aim (LT / L2) while flying and the jets hold you in the air, sinking slowly, while you shoot.',
    'With a keyboard the jets are the left mouse button, or SPACE held in the air: W and S tip the nose down and up, A and D turn, SHIFT goes faster. On a touch screen hold ⤒ in the air and steer with the left-hand drag.',
    'After a dive on the jets the camera no longer stays tipped down at your feet once you land: it eases back to its usual view over a moment, as it does when you leave the jets for the water, the wings, a wall or a ride. Turn it yourself as you land and it stays where you put it.',
    'The scout drone goes up and down now, not only out: send it for a goal on a rooftop, a tower’s deck or the floor above and it climbs toward it, straight up a shaft or the side of a tower you stand under; for one in a pit or a cave below it sinks toward it, its eye turned up or down at it. It stays in view behind you as it climbs.',
    'Indoors the drone keeps under the ceiling and short of the walls instead of pressing into them.',
    'When what the drone finds is well above or below you its word says so (“27 m, 10 m above”), and its flare on a goal far below you rises past your feet, so you see it from up there.',
    'Old walls no longer carry dark dirt streaks and blotches of broken plaster: they show the odd fine hairline crack instead, faint and branching, and not on every building, and a crack never runs over or close to a window, a door or anything fixed on the wall. You see it in Qanat, the Signal Market, at home and in the old towns of the other worlds.',
    'The darker smudges round the doors are gone, like the wall dirt: the doorways of Qanat, home, the Signal Market, Vael II’s monastery and the City During the Eclipse are clean plaster again.',
    'People seen close, in a conversation or with the camera pulled in, no longer catch patches of sunlight on their faces, necks and clothes while they stand in the shade.',
    'Climbing, the traveller no longer drags a dark, ragged smudge round himself on the wall, and people walking in the shade lose the dark blots that slid round their feet as the camera turned.',
    'Turning the camera quickly no longer makes distant shadows flick on and off: across the City-Shaft whole towers changed their shade for a moment after each turn, and after each cut in a conversation.',
  ] },
  { v: '0.88', date: '2026-10-07', items: [
    'Blows land with weight: the world catches for an instant as a cut connects, the camera jolts, and the heavy third swing throws a foe back.',
    'A foe winding up out of sight shows a marker at the edge of the screen, on its side, filling as its strike comes.',
    'Foes take turns: no more than two strike at once while the others circle, and they no longer stand inside each other.',
    'Cut-down foes leave ink, which runs into the glove, and the blade grows with it: at 8 ink it reaches further, at 20 its third swing becomes a whirl that cuts all round you, at 40 a swing begun at a run lunges into the cut.',
    'Relics out in the wilds are guarded: ink blots gather round as you come near, and once cut down they are gone for good.',
    'New controls for the blade: RB / R1 swings it, LB / L1 held guards, and clicking the right stick (R3) locks on to a foe, then the next, then lets go. On a keyboard: F swings, Ctrl or Z held guards, Tab locks on. The bell whistle moved to the D-pad’s up.',
    'Locked on, the camera keeps the foe ahead, a ring marks it, and the blade and the guard turn to it.',
    'The push is a gun mode now, beside fluid, stilling, ember and bloom: switch to it with X or the D-pad and fire it as you shoot. C and the middle click do nothing now.',
    'Three new foes: a spitting blot that keeps its distance and lobs ink where you stand, a swarm of tiny blots that a push scatters, and winged blots that fly out of reach under open skies and dive along a lane drawn on the ground.',
    'A perfect parry: raise the guard just as a strike comes and it costs nothing and leaves the foe stunned. A foe frozen by stilling takes the blade double.',
    'The frame freezes for an instant as a blow lands, longer on a heavy one and on a perfect parry, so every impact reads.',
    'The makers’ machines are rebuilt: a round brass shell on three spindly legs, two clawed arms, the makers’ glyph glowing for an eye. Broken, they come apart, their pieces flying and settling on the ground.',
    'The Enemies setting has a Gentle choice: half the harm, slower wind-ups, one foe striking at a time and smaller, rarer packs. Normal and Off stay.',
    'Locked on, the traveller faces the foe and strafes round it, side-stepping left and right or backing away in a sword stance, instead of running round it.',
    'The fluid blade is a real sword now: a slim two-edged blade of the tank’s fluid tapering to a point, its edges bright, on a brass crossguard, a wrapped grip and a pommel, its edge leading every cut.',
    'An items page, linked from the worlds list (Debug): every item in 3D, drawn in the game’s own ink, to drag round and turn, or to open full screen (zoom, and the next item with the arrow keys), with what it does and where its boxes are, a search and the kinds to filter by.',
    'Fights have their own music: a drum and a low drone come in under the world’s music while foes chase you, and fade when the fight is over.',
    'Where a blot falls, its ink stains the ground for a while; a shade’s cut leaves a dark arc of shadow in the air.',
    'In the temples the makers’ machines meet the rooms’ workings: a gust shoves them down its hall, and one standing on a pressure plate presses it.',
    'On a touch screen the blade has one button again: tap ⚔ to swing, hold it to guard; the lock-on button shows only in a fight.',
    'A new foe, the shade: a person made of living shadow, near-black violet running down its body in streaks, its feet melting into the ground, dripping as it walks and leaving dark pools behind. It comes in later packs out in the wilds and cuts with a sword’s swing; five cuts bring it down, and it runs away into the ground.',
  ] },
  { v: '0.87', date: '2026-10-07', items: [
    'The fluid blade: the glove draws a blade of the tank’s fluid and swings it (F, LB / L1, or ⚔ on a touch screen). Press again to chain three swings, the last one heavier. It turns you toward the nearest foe and costs nothing.',
    'Ink blots gather in the wilds, away from people, the ship and the cities: loose ink and scribble that come at you and lunge. Their ring is drawn on the ground before they strike, so you can step out of it. The blade cuts them back into ink, a shot or an ember washes them away, stilling freezes them, and every one you cut gives the tank a charge back.',
    'The makers’ machines stand guard in the temples’ rooms: heavier and slower, their slam drawn on the floor before it lands. The blade breaks them; fluid only staggers them. Once broken, they stay broken.',
    'No blow from a foe empties a healthy bar, and a new Enemies setting turns them all off for the calm game. There are none at home.',
    'The frame readout moved from F to F3 (F is the blade now).',
    'The Arena, in the worlds list (Debug): a ring of sand where the foes come in waves, to try the blade.',
    'The References level has the Overnight Train’s four pictures rebuilt as views: a long streamlined train crossing a lavender plain at dusk under two moons, its round nose and railed balcony full of people, rows of lit orange windows, gardens on its roofs, pink pennants streaming back and a salmon cloud of dust rolling along its wheels.',
    'A new world off the route, the Overnight Train: a long streamlined train crossing a lavender plain by night under two moons. The ship comes down on its landing wagon while the train waits at a lonely station; walk forward through the library, two sleeping cars and the dining car to the observation lounge and its railed balcony at the round nose, where the plain runs straight at you.',
    'On the Overnight Train the land runs past: the sleepers under the wheels, the telegraph poles and their wires, stones, far buttes, now and then a lit hut or a signal lamp. Every few minutes it slows into a lonely station, waits, and pulls out again; pink dust rolls back from the wheels and the pennants stream in the wind.',
    'Climb the ladder on any porch of the Overnight Train and walk the roofs from carriage to carriage over plank bridges, past the roof gardens, to the terrace and its little sky lounge.',
    'The Overnight Train sounds like a train: the wheels’ beat over the rail joints, ta-dum … ta-dum, slowing to nothing at a station, the rumble underfoot, the rush of the air on the roofs and the balcony, and a whistle as it pulls out or brakes.',
    'The fluid blade swings like a sword: three cuts from motion capture, a slash down from the right, a rising backhand and an overhead cut, the blade held in the fist.',
    'Hold the blade button to raise your guard: a shield of fluid blooms over your left arm. A strike from in front is blocked for a charge and leaves the foe reeling; with the tank empty it gets through.',
    'A foe’s strike that lands makes the traveller flinch, from motion capture.',
    'The Arena is bright now: golden sand under an open blue sky.',
    'On the Overnight Train the carriages’ ceilings have round lamps in a row instead of one long glowing strip, which drew a bright beam down the middle of the dining car and the library; the brackets of the library’s roof terrace no longer poke through its ceiling.',
  ] },
  { v: '0.86', date: '2026-10-07', items: [
    'A new world off the route, the City Floating in Space: rounded houses in cream, salmon and coral heaped on islands in the black of space, joined by pale arched bridges, with the stars all round you, even under your feet. Cross the crowded Market Bridge to the stalls of the plaza, climb to the Towers, rest under the dark trees of the Garden, and look out from the Balcony at the great planet, which turns its lit face toward the city as night comes. Step over a parapet and you fall into the void, and come back where you last stood.',
    'The References level has the City Floating in Space’s four pictures rebuilt as views: rounded houses in cream, salmon and coral heaped on islands that float in the black of space, pale arched bridges between them, dark machinery and long cables hanging under them into the void, and a great pale planet over the roofs.',
    'Space is drawn the way the drawings draw it: a flat black all round, below you as well as above, printed with fine white and teal stars and a faint nebula, and a great planet hanging as an ink-ringed disc, full or a crescent.',
    'The References level has the Signal Market at night: its four pictures rebuilt as views, a narrow lane of the market after midnight, its walls stacked with old screens of every age and size lit pink, violet, lemon, orange and green, each showing its own picture, vendors mending them at the walls’ feet.',
    'The Signal Market has its night: after dark its billboards and shop signs light up as the old screens of a night market, each in its own colour (a pale face on violet, a planet on cobalt, glyphs on lemon or white, a head on scarlet), the towers go dark round them under a black sky, the lanterns throw warm pools on the street, steam rises off the stalls and half the crowd has gone home. By day the market is as it was.',
  ] },
  { v: '0.85', date: '2026-10-07', items: [
    'A new world off the route, the City During the Eclipse: a city of white domes and round towers at midday, with the moon over the sun. The lamps are lit at noon and people eat outside at their tables by lantern light, pale figures lean out from the walls, and the stars are out. Walk the Lantern Square, climb the Great Stair and the tiers of the bowl, and look out from the overlook over the lit city on the plain. It is on the ship’s galactic map from the start. There is nothing to do there but walk, climb and look, and three faces from other worlds came for the eclipse.',
    'Eclipses are drawn the way the drawings draw them: the moon’s black disc ringed with light, its corona in fine pen rays or a stipple of dots, a band of rose light all round the horizon, and in a city lit cold by it, the lamps throw warm amber pools on the walls.',
    'The References level has the City During the Eclipse’s four pictures rebuilt as views, to set beside the pictures they come from.',
    'A new world off the route, the Fallen Ring: the pieces of a broken orbital ring lying across a sage-green plain. Walk under a great arch higher than the clouds, past a segment leaning on its crushed vermilion foot, to the long tube lying in the grass with a village built into its side; climb its service stairs to the crest, or step into its broken end, where the old street inside is lamplit and planted. A low segment rests on posts over a second village, a vault lies half sunk beside a tube broken open end-on, herds of woolly beasts graze everywhere and shy away if you come too close, and the rest of the ring stands pale on the horizon all round. Oro of Viridel and Emrys of the Garden of Spheres came to see it. It is on the galactic map from the start.',
    'The References level has the Fallen Ring’s four pictures rebuilt as views: the colossal curved segments of a broken ring standing as arches over a sage-green plain, tubes lying in the grass with villages along their feet, broken ends opening on the streets and gardens inside, grazing beasts and great white cumulus.',
    'A new world off the route, the Moon Foundry: an abandoned workshop for making moons under a vast open roof on rust pillars. Unfinished ivory moons hang from the cranes or rest in orange claws, the workers live in the old machinery, and one great moon lies broken open like an eggshell round a little courtyard of houses and mint trees. Climb the stair to the gantry and walk straight into it, cross to the garden in the half-shell, and warm your hands at the last furnace. Dun and Wen of the Buried Machine and Emrys of the Garden of Spheres came to see it. It is on the galactic map from the start.',
    'In the Moon Foundry the last furnace still pours: molten metal falls from a tipped ladle into a small new moon in bands of hot colour that march down the stream, its mouth glows, and it drones as you come near. At night it is the warmest light on the floor.',
    'The References level has the Moon Foundry’s four pictures rebuilt as views: ivory moons hanging from cranes or held in orange claws, shells broken open round little courtyards of houses and mint trees, gantries between the workstations under a vast open roof. Their camera keeps every pillar upright, as the pictures do.',
    { text: 'The title screen has a What’s new button: every change, with its before and after pictures, without starting a game.', see: 'On the title screen, choose What’s new under Settings; Play brings you back.' },
    { text: 'Debug on the title screen opens the worlds list straight away, instead of loading a whole world behind it first.',
      numbers: [{ title: 'From Debug on the title screen to the worlds list', unit: 's', better: 'lower', device: 'MacBook, headless Chrome, dev server (modules cached)', source: 'docs/systems/dev-tools.md, “The Lab”', rows: [
        { where: 'Debug → worlds list', before: 15.1, after: 1.0 },
      ] }],
      see: 'On the title screen, choose Debug: the list of worlds shows in about a second. Esc or B / ○ goes back to the title.' },
    'A new world off the route, the Underside: a shelf of white rock jutting far out over a sea of cloud, with a town hung under it. Round white houses cling to the rock and hang from it like swallows’ nests, timber galleries are slung beneath it on rods, long red banners fall toward the clouds and baskets go up and down on their ropes. Walk down the great stair cut into the cliff, along the rope walk and the galleries under the shelf to the deck at its tip, and climb back up the timber stair on its north face. It is on the ship’s galactic map from the start. There is nothing to do there but walk, climb and look, and three faces from other worlds came to see it.',
    'The References level has the Underside’s four pictures rebuilt as views: an immense shelf of pale rock jutting out over a sea of cloud, a town of round white houses and timber decks hung under it, long red banners falling toward the clouds, baskets let down on ropes, and the traveller on a stair cut into the cliff.',
    { text: 'What’s new lists each version’s newest changes first, in the game and on the changelog page.', see: 'Press N in the game, or choose What’s new on the title screen: the change at the top of each version is its latest.' },
    { text: 'The worlds list has a fresh picture of every world, the hidden ones included, and links at the top to the character studio, the Motion page, the trailer and What’s new. The character studio left the title screen for it.', see: 'On the title screen, choose Debug.' },
  ] },
  { v: '0.84', date: '2026-10-07', items: [
    'A new world off the route, the Glass Dunes: a desert turned to green glass, its frozen waves, cliffs and billows holding great dark shapes inside them, sandy paths winding between the walls to a wave breaking over a camp. The glassworkers live at the walls’ feet under fabric awnings; archways glow in the glass at night, and sandstorms blow through. It is on the galactic map from the start, marked as a detour: no quest, just somewhere to walk.',
    'In the References level (the worlds list), the Glass Dunes’ four plates are rebuilt as views: walls and frozen waves of green glass with giants held inside them, the glassworkers’ camps under their ramps of sand, archways in the walls’ feet and the low sun through the glass on the amber sand.',
    'A new world off the route, the City Behind the Waterfall: a long cavern city hidden behind a towering curtain of falling water. Walk the dry promenade along the falls, climb the terraced streets of rounded houses, look out over a sunlit valley from the balconies behind slits in the water, or swim in the pool at its foot. The ship’s map charts it from the start.',
    'Waterfalls are drawn the way the drawings draw them: flat turquoise bands streaming down with fine pen streaks, slits of light where the water runs thin, mist and spray at the foot, and a roar that grows as you come near.',
    'The References level has the City Behind the Waterfall’s four pictures rebuilt as views, to set beside the pictures they come from.',
    'A new world off the route, the Salt Harbour: huge old ships standing on their keels in a dry white salt basin, with people living in them. Walk the street between their hulls under the sailcloth, past shops cut into their feet and houses built out from the plating, climb the timber stair to a deck and cross the gangway high over the street, and walk on to the ship that stands on its stern. It is on the ship’s galactic map from the start. There is nothing to do there but walk, climb and look, and three faces from other worlds came to see it too.',
    'The References level has the Salt Harbour’s four pictures rebuilt as views: huge ships standing on their keels in a white salt basin, the streets between their hulls shaded by sailcloth, gangways overhead, shops and houses built onto the plating, mooring ropes staked into the salt.',
    'A new world off the route, the Forest of Antennas: abandoned masts by the thousand on a plain of violet grass, great dishes turned up like flowers with birds nesting in them, vine-grown cables strung between the towers, and a small settlement of rounded workshops under one immense receiver. Climb the long stair to the observation deck and cross the maintenance bridge to the receiver’s balcony; Lune and Ottla of the Sealed Hangar and Teb of the Signal Market came to hear it. It is on the galactic map from the start.',
    'The Forest of Antennas hums: a low drone that swells near the masts and under the great receiver, static crackling in the air, and now and then a far signal whistling as it tunes in.',
    'In the Forest of Antennas, far-off masts, wires and lattice struts stay steady lines as you walk and turn, instead of breaking into flickering pixels.',
    'The References level has the Forest of Antennas’ four pictures rebuilt as views, to set beside the pictures they come from.',
    'The References level has the Underwater City’s four pictures rebuilt as views: salmon towers ringed with amber pods on the sea floor, glass columns of rising bubbles, cafés lit warm under their domes, a manta overhead, and the light falling in shafts from the surface far above.',
    'Under a sea, the water is drawn the way the drawings draw it: a flat blue haze in layers that leaves what is near in its own colours, shafts of light from the surface as pale bands slanting away from the sun, and the light’s ripples printed as fine lines on the ground.',
    'A new world off the route, the Underwater City: a city on the floor of a sea, its salmon towers ringed with amber-lit pods, glass columns of rising bubbles between them and a manta gliding overhead. Walk the lamplit avenue in the water, step into the dry cafés under their domes, cross the canal, look out from the terrace over the drop into the deep, or swim up among the towers and land on their pods. It is on the ship’s galactic map from the start.',
    'Deep under a sea you walk its floor, a little slower than on land: jump (A / ×) to kick off and swim, hold it to rise, let go to sink gently back down and land on whatever is under you. Your pack gives you air down there.',
  ] },
  { v: '0.83', date: '2026-10-07', items: [
    { text: 'The game is now called Hiraeth: on the title screen, in the menus, in the apps and in the Steam library. Your saves and settings carry over.', see: 'Open the title screen to see Hiraeth above the clouds. Existing Steam shortcuts receive the new name when the updater next runs with Steam closed.' },
    'Once four worlds are behind you, a faint signal pulses on the galactic map further along the route, and the ship’s console mentions it: a broadcast worth hearing before you go home. After the Signal Market the recording you put off waits at the console as soon as you step outside, a second one follows it, the later worlds’ recordings find their own lines again, and the stone at home remembers Ilen even if you learn of her after the end.',
    'Your mother’s note in the ship’s galley ends differently now, with the lamp she keeps in the window.',
    'At the stone at home, the listening shell and the echo shell go down with the other gifts, each with its own words.',
    'What happened at Esk’s terraces in Viridel is filed under “What happened” in the Quests page now, not marked failed; and coming back to Viridel later, Esk has decided there is one small job for you, down in the mud where her hill went.',
    'Viridel closes with a few words of its own as the flowers close over the ship again, as Lorn and Lorn II do.',
    'In the Buried Machine, Wen has thought about the old story now that the great wheel never stops turning: ask her about the last tooth after Tooth Day, and Hask has heard what she thinks.',
    'Everyone has a name of their own now: where two people shared one, or nearly, one of them has a new name in their world’s way (the Hangar’s Zazie, Viridel’s Rue, the City-Shaft’s Tobin who sells views, Ket and Jot under the sand, Kesh by Vael’s stone hand, Emrys and Linnet among the spheres, Hobb at the Undertower, Agathe on Vael II’s bridge, Rima and Dalia in the desert, Gaspard, Fisk and Robin), and the desert’s sketcher is Naji.',
    'Vael II’s people sound more like themselves, and less alike: Brother Calix, Mother Ysolde, Ondine, Tiv and the bridge’s keeper each end their words their own way. A few jokes that three worlds shared now belong to one, and each world hears the singing light in its own words.',
    'Halfway down the City-Shaft, by the middle levels’ cab stop, Perrine keeps a tea stall now, and the old mirror beside it wants washing and turning back up the shaft, so a little of the Lodestar’s light reaches the bottom again. One of the city’s five relics waits on her awning.',
    'A few quiet places have something to say now: Vael’s fallen giant on the plain, a carved frieze over the Givers’ Hearth’s door, the little mask in the masked head’s chamber, and an old salvager’s slate by the crashed hull in the southern dunes, which Marrow will want to talk about.',
    'The City-Shaft’s terraces go all the way round the shaft now. Each level’s two or three stretches of terrace were all built in the same place, one on top of another, so much of every ring stood empty; now they follow each other round the pit, with their houses, stalls, railings, bridges and people, and the story’s places stay where they were.',
    'A new world off the route, the White Mangrove: bone-white trees standing on arching roots in a black lake, houses on decks round their trunks, plank walks lit by lanterns, stairs and rope bridges between them, boats poled through the channels, and creatures glowing blue and pink in the water like a second sky. It is on the ship’s galactic map from the start. There is nothing to do there but walk, climb, swim and look, and three faces from other worlds came to see it too.',
    'The References level has the White Mangrove’s four pictures rebuilt as views, to set beside the pictures they come from.',
  ] },
  { v: '0.82', date: '2026-10-07', items: [
    'The camera follows closer: out in the open it hangs low behind the traveller, a little over his head and looking a little down the way he faces, so he stands bigger in the lower middle of the view with the world ahead filling the rest. Zooming with the mouse wheel or LB / L1 and the right stick still works from there; gliding and the jets stand it further back so you see ahead and below.',
    'In closed spaces (the ship, temples, caves, corridors, houses) the camera comes in close over a shoulder, about two metres back at shoulder height, and picks the shoulder with room beside it so the way ahead shows next to the traveller. It slides across only when a wall really closes in, eases in and out at doorways, stands a little further back in big halls, and aiming the fluid tool is always over the right shoulder.',
    { text: 'On a handheld, looking down the City-Shaft no longer stutters: where the graphics chip is what holds a frame back, the picture softens a little to keep it smooth (about 44 frames a second before, 54 now); where softening would not help, it stays sharp.',
      see: 'On a handheld with automatic resolution and the frame readout on (F), stand at the City-Shaft’s rim and look down into the shaft: within a few seconds the scale on the readout steps from 0.75 to 0.55 and the frames a second rise. At the desert’s camps it tries one step and goes straight back.',
      numbers: [
        { title: 'Looking down the City-Shaft (the wide view): frames a second', unit: 'fps', better: 'higher', device: 'Retroid Pocket Nova (GeckoView 157), Handheld preset, automatic resolution', source: 'docs/systems/performance.md, “The Retroid, round 4”', rows: [
          { where: 'the wide view (the scale 0.75 → 0.55)', before: 44.1, after: 53.5 },
        ] },
        { title: 'Refreshes missed', unit: '%', better: 'lower', device: 'Retroid Pocket Nova (GeckoView 157), Handheld preset, automatic resolution', rows: [
          { where: 'the wide view', before: 26.7, after: 10.9 },
        ] },
      ] },
    'The traveller moves more like a person at the moments that used to look mechanical: setting off at a walk he straightens and swings his arms instead of hunching into a jog, stopping he throws his arms out to brake, and turning on the spot or doubling back at a run his head and shoulders lead the turn. His feet land and hold exactly as before, and the controls answer just as fast.',
    'Knocked down, the traveller gets up as a person does, by how he landed: face down he pushes up and gets his feet under him, on his back he sits up and rises, instead of always coming up through the same stiff kneel. People knocked over get up the same way.',
    'Jumps and landings look caught from life: a running jump is a long stride through the air, dropping off a ledge he lands in a deep crouch, landing hard at a run makes him stumble, and kicking off a wall he pushes away with his whole body.',
    'Standing still a while, he now and then looks about him or just breathes, his feet staying where they are.',
    'Picking something up off the ground he goes down on one knee for it, and petting Moustache he kneels and reaches out to him.',
  ] },
  { v: '0.81', date: '2026-10-07', items: [
    'In the desert, letting the water out of the giant’s pool before anyone has sent you there no longer stalls the story: the steps that only led there pass on their own, and Ama still hands you her jar.',
    'Qanat and its camps say a little more, and nothing that goes stale once the chest is open: Oum, Marrow, Rook, Tamsin, the sketcher and the townspeople have new lines, Pell wants to hear about the sleeping mask, and the Speaker has heard Ilo’s report of a monster.',
    'Landing in Vael with the wings already yours, the drone finds Oïa first instead of the Aerie.',
    'Notes that still pointed to the old sketchbook name the game menu now: a hidden box’s note sends you to the Quests page, and a delivered parcel names View (or J) for the Sketchbook.',
    'In Vael, Hollin now waits beside his stone hand, where Oïa’s people say he is, and has a little more to say; the hand’s quest says the order and the buttons, and the shed feathers wait at the tower’s balcony until the bird has answered her call.',
    'In Vael II, Mother Ysolde answers her sister’s lamp the old way and lays a place at supper once the bell has rung; Sister Aube, Brother Calix and Ondine say more in passing, Hollin’s feather gets a thanks that fits, and the belfry’s guardian brings down only the stones round her tower, as you can see.',
    'In Viridel, reading Talo’s note on the tallest tree before Lio has asked you to climb no longer leaves Lio asking forever: tell him what you saw and it counts. Mira no longer says her clock rang while it was missing its gear, and thanks you once it does; what happened at Esk’s terraces is told as it happened, and nobody suggests you should have turned the gate more gently.',
    'In Lorn and Lorn II, prompts name the pad’s buttons, Ivo lets you keep his fireflies, Ysse tells the crossing as everyone else does, the humming crystal goes to Bram where he actually sits, and Bram, Pim and Wick have more to say, Wick once every pool is lit.',
    'In the Buried Machine, lighting the Wick before Wen or Hask has sent you no longer stalls Tooth Day, and reading the three gauges before you meet Ossa no longer leaves her repeating herself: both quests go on from what you did. Hask has noticed the wheel never stopped.',
    'In the City-Shaft you can give Dov Ossa’s message from the bottom, and he answers it; Dov knows he left before Pip was born, Lio hears that Hask tipped, and the rim no longer says the cabs stop for anyone. Lio’s taxi token is for Clemence in the Sealed Hangar, by name, and Lio, Hask and two of the Hangar’s people have more to say.',
    'In the Signal Market, meeting Kip before Madame Sel no longer leaves the broadcast out of reach; the keepsake quotes what your father actually says, and Ferro’s prompt names the pad’s buttons. In the Garden of Spheres, hearing all three spheres before you meet Aube no longer stops her sending you on, and a few answers fit what was said to you.',
    'At home, Lou talks about the drawing of the furthest world you have written from, any of them, and the round window only speaks of singing once the reel has told you about it.',
    'Four new parcels to carry, so every world on the way hands you something for the next: Brother Calix’s muffled hand bell for Wendel in Lorn, Nikko’s gear grease for Tull’s squeaky doors under the sand, Ossa’s pipe whistle for Aube among the spheres, and Nell’s sliver of lake mirror for Oyo’s lantern stall in the Signal Market.',
    'What’s new (N) has a See what changed button: every change with pictures of before and after to drag between, the numbers for the ones that make the game faster, and how to see the rest, with filters by world and kind and a search. It works with the mouse, touch and a controller; the pictures come from the game’s site, so they need a connection.',
  ] },
  { v: '0.80', date: '2026-10-07', items: [
    'Crowded places run smoother on handhelds: the camps, the Signal Market and everywhere people gather cost less to draw each frame, with everyone moving exactly as before.',
    'On the Handheld and Steam Deck settings the grass grows further round you: the Garden of Spheres’ meadows and the dry grass round home no longer turn to bare ground a few steps ahead of the traveller.',
    'On the Steam Deck, a game that closes unexpectedly after you have been playing no longer starts again by itself in a different graphics mode: it returns to Steam, and the next launch draws the way that worked.',
    'In conversations you see the traveller’s face now: when he answers, and sometimes when someone says something that moves him, the camera cuts to a close view of him, so his smile, frown or surprise shows. Otherwise it keeps its view of you both, and it never cuts on every line.',
    'When you choose an answer the traveller says it before the reply comes, with his words, his name and his portrait in the panel. Press to go straight on to the reply.',
    'The traveller’s expressions are drawn more strongly, so his smiles, frowns and raised brows read in a close view and in his portrait.',
  ] },
  { v: '0.79', date: '2026-10-07', items: [
    'Cloaks hang over people’s arms now: hands and arms no longer poke out through a cape, standing, walking or gesturing as they talk.',
    'Bako’s bag hangs over his cloak, where his drawings show it, instead of half inside it, and it is the bag of his drawings now: a big soft canvas shoulder bag with a flap, on a wide strap over his shoulder.',
    'Sefa slings her oud on her back over her cloak when she walks, and takes it in hand again when she stops; Marrow carries his pack on his back and walks on cloth-wrapped shins, as his drawings show.',
    'In Vael II the needle spires and the mushroom tables’ stalks take their shade in one clean band down their side, as in its drawings, instead of breaking into lit patches across their flutes.',
    'The cracks in Vael II’s peach plain are no longer black holes: their walls are a lit red-brown, hatched with strokes running down them, as in its drawings.',
    'Vael II’s sea of cloud is printed flat as in its drawings: a warm white in the light and one pale grey-blue in its shade, following the real sun through the day instead of being lit from the same side at every hour.',
    'At dusk and at night Vael II’s shadows keep the soft grey-teal of its day, warmer at dusk and deeper at night, instead of turning the old violet-blue.',
    'The game menu’s Quests panel lists everything you have finished, in every world: after the desert, the Tree That Drinks is under Done in the worlds that follow, instead of “None yet”.',
    'In the Sketchbook, a story you told on an older save, before story pages were drawn, now reads as told rather than “not told yet”.',
    'The Buried Machine’s drum is lined with dense small machinery, as in its drawings: pipe runs with their valves and flanges, conduits, casings and louvred plates between the tall windows, pipes hung under the balcony; machinery clusters cling to the trench’s walls too, and you can climb on all of it.',
    'Under the City-Shaft’s terraces, between the ribs of their blue undersides, hang pipes, casings and plates on their rods, as in its drawings.',
    'The undersides of Vael II’s mushroom tables are lumpy and pocketed rock, as in its drawings, their hollows filled with deep shadow, instead of smooth.',
    'The Signal Market’s back alleys are crowded with pipes, valves, conduits and casings up their walls, as in its drawings, and you can climb them.',
    'Stepping out of a cab beside a building, the camera no longer ends up inside the cab: it sees the cabs as they are drawn, so it stays out of their hulls and canopies (never the one you are riding in).',
    'E (B / ○) uses what you are facing: walk up to a cab with someone at your shoulder and it gets you in the cab instead of starting a chat, and the prompt over it always says what E will do. A cab counts as near from its side, not its middle.',
  ] },
  { v: '0.78', date: '2026-10-07', items: [
    'The City-Shaft looks more like its drawings: half its walls are pink now among the cream, drainpipes run down the houses, washing hangs over the balconies’ rails, the undersides of the terraces are hung with ribs, machinery and pipes, three orange blimps drift slowly round the shaft, and the lake at the bottom is turquoise water instead of acid green.',
    'The Signal Market’s stalls are full now: fruit piled high in mounds over brass bowls, crates stacked and sacks slumped between them, jars, strings of goods hanging under the awnings and round pictures painted on the counters.',
    'In the Buried Machine the trench walls are a mass of pipes, bends rising over the long runs and dropping back; inside the drum an arcade of little dark bays runs under the rim, with slits, panels and machinery against the wall, some of it lit; and the city overhead hangs its towers in clusters, lesser towers round the great ones, each ending in a bulb.',
    'The desert’s canyon walls and violet cliffs are drawn with many cracks running down their faces, as in their drawings, instead of a few far-apart fissures.',
    'A wall turned away from the sun now stays in full shadow when the building across the street also shades it, as in the drawings, instead of being lifted to a lighter half-tone.',
    'Where sand has banked against an old wall, the band of dust at the wall’s foot is drawn along the top of the sand instead of disappearing under it.',
    'The plaster is stained darker round the doors of Qanat’s houses, of both houses at home, of the Signal Market’s shops and of Vael II’s monastery and church, as walls are in the drawings.',
    'In the References level the gorge under the rope bridges lies in the shadow of its rim, as drawn, the sun low over the right wall catching only the pillar further down.',
    'In the References level the Signal Market’s panels have a crowd of people in coats, hoods and hats, the quiet ones among them, stalls full of goods with their sellers, and the game’s own cabs; the Buried Machine’s have the trench’s pipes, the hanging towers in clusters, the drums’ arcades and machinery under vaulted ceilings, the oval tunnel’s inside, the moon seen from the arched cave and the layered rock ledge; the City-Shaft’s houses have pipes, balconies with washing and machinery under their overhangs, with blimps and the game’s own cabs in the sky.',
    'Looking across the City-Shaft is lighter on handhelds: its towers are drawn together, a few at a time, each with its own colours and bands exactly as before.',
  ] },
  { v: '0.77', date: '2026-10-07', items: [
    'The traveller’s face moves now: he smiles, frowns, looks worried, surprised or tired with the tone of what is said, blinks, glances about with his eyes, and his mouth opens and shuts on the syllables when he speaks, as everyone else’s does. At rest he looks as he always did, with the corners of his mouth a little up.',
    'The fluid tank is the glass jar of the traveller’s drawings now: a squat flask of green, living fluid on his upper back, its other colours turning through it in slow streams, the level falling a third with each charge you use, with a dark collar, brass fittings, a stoppered neck and leather straps over his shoulders. A gun mode tints the fluid its colour, and the Items panel shows the new flask.',
    'On handhelds every world runs a little smoother around the traveller: his shirt now swings and falls round his legs on the graphics chip instead of the processor, and looks the same as before.',
    'In the Garden of Spheres the white hill is carved: each terrace is ringed with rounded pillows of white stone instead of a plain drum, and the white stone everywhere takes its shade as a flat pale blue, with almost no hatching, as in its drawings.',
    'The Garden’s olives and shrubs are drawn as clusters of small leaf masses, each with its own outline, instead of single smooth lumps; the hedges round the plaza are clipped hedges heavy with fruit.',
    'The undersides of the great umbrella trees show their branches: lighter veins forking out from the trunk to the rim, thicker toward the trunk.',
    'The round plaza is paved: the joints between its slabs are drawn in each ring.',
    'The robot statue in the android wood is a proper statue now, with feet, knees, a chest plate, shoulder pads, hands and a visor, and the wood’s white ruins have arcades of round arches.',
    'In Lorn II the great roots are tangles of strands twisting round each other, and the root cave’s mouth is framed in arches of roots, with roots crawling out along the ground and hanging in the mouth.',
    'Lorn II’s roots and the bushes on its banks are drawn as dense hatched masses, as in its drawings, and the bushes are clusters of small leaf clumps.',
    'Look up near the start of Lorn II’s path: on the flat cap of a giant mushroom sits a woven nest of glowing eggs under a ribbed glass dome.',
    'The desert’s people carry the rest of what their drawings give them: Nour has clay gourds and a ring of keys at her belt and a tall staff with a pierced disc at its head; Marrow wears his long patched coat without a cloak, with a salvage bag at his hip (a bone and a pipe sticking out of it) and a pack on his back; Sefa’s cloak has little brass bells all along its hem and her oud has tassels; the Speaker’s bell is copper and his staff carries streamers.',
    'Sefa’s oud no longer pokes through her cloak as she walks: the cloth swings round it.',
    'The desert sand no longer looks bare at noon: with the sun high and the pebbles’ shadows short, more pebbles lie on it, a little bigger, so it reads about as busy as in mid-morning. Dawn, dusk and the rest of the day look as they did.',
    'Lorn II’s bank bushes keep their leafy look from further off: a fringe of blades breaks their outline, and their hatching stays drawn as strokes instead of melting into a smooth dark tone.',
    'The Garden of Spheres’ olive trees have rounder, layered crowns, a broad tier of leaves with a smaller one over it and a little cap on top, as in its drawings, instead of flat cushions.',
    'The Garden’s round plaza reads pale from where you stand, as in its drawings: its slabs are wider and their joints a lighter tone, instead of crowding into dark bands across the rings.',
    'The floor of the Buried Machine’s rust canyon no longer has long straight bands of sand running across it: the sand banks against the canyon’s walls along their foot, where it belongs.',
    'Climbing a wall where sand is banked against its foot, you take hold standing on the bank: your hands and knees no longer go into the sand, and climbing down you step off onto it.',
    'Cabs are solid just as they are drawn: you stand on a parked cab’s nose, tail or striped canopy where they are, instead of on an invisible lid at the canopy’s height, and walking up to one you stop at its side rather than a step away from it. The rolling stone balls in the temples are round underfoot too.',
    'Climbing an olive tree in the Garden of Spheres, you stop under its crown or climb on round its leaves and stand on top, instead of coming out inside the crown; and pulling yourself up over an edge never puts you inside something solid.',
  ] },
  { v: '0.76', date: '2026-10-07', items: [
    'The Steam Deck gets its own Graphics setting, between Handheld and Medium, and Auto picks it there: the game draws at the Deck’s own resolution with a lighter crowd, fewer far pebbles and plants and lighter shadows, and lowers its resolution by itself when a scene is too much. A Deck that started on High moves to Auto once; a lighter setting you picked is kept.',
    'On handhelds the City-Shaft runs smoother when you look across the shaft: its terrace railings are drawn in far fewer pieces, the same as before.',
    'On handhelds the picture no longer goes soft for nothing: the automatic resolution now notices every stutter, but only lowers the sharpness where that can help, and keeps it in busy places where the processor, not the graphics, is what slows the game.',
    'The desert’s camps and other crowded places run a little smoother: people standing or sitting still a little way off move their idle breathing on every other frame.',
    'The loading screen’s turning pen should keep turning smoothly while a world is built, instead of stopping for a moment now and then.',
    'The Buried Machine’s great wheel is solid just as it is drawn, and turns with you on it: you stand on its teeth and in the gaps between them, climb its rim and spokes, and once it turns it carries you round with it; a spoke sweeps you aside instead of passing through you, and you no longer stand on an invisible disc over its spokes.',
    'In the Buried Machine’s rust canyon, the heavy rims round the two cross-walls’ great oval openings are solid, so you climb and stand on them as drawn, and the way through each opening is bare floor: sand no longer banks up across it.',
    'In Lorn II’s Deep Wood every root is solid as it is drawn: the gnarled roots sprawling along the banks, the thin roots whipping round the great arches and the small roots splaying from their feet. You climb and stand on them instead of walking through them.',
    'In the Garden of Spheres the olive trees’ trunks and the dark cypresses are solid just as they are drawn: you no longer walk half a metre into a cypress before it stops you, or bump into an invisible post beside an olive’s leaning trunk.',
    'In Lorn’s Hush-House the gates of jaws are solid exactly where their two snapping halves are, and they still will not let you by until they are stilled.',
    'You no longer sink into banked sand: where a drift of sand against a wall or a rock rose above the ground you walked on, your feet now stand on the sand as it is drawn, in the desert, on Vael and in the Buried Machine’s canyon. The trim round a temple rotunda’s open roof is solid where it lies on the roof.',
  ] },
  { v: '0.75', date: '2026-10-07', items: [
    'The sketchbook is now a game menu in the spirit of Ocarina of Time’s pause screen, drawn in the game’s own ink and paper: four panels side by side, Items, Quests, Sketchbook and Worlds. View / Select (J, or the ❏ button) opens it; LB / L1 and RB / R1 (Q and E, or the tabs) turn from panel to panel, the stick or the D-pad moves a cursor, the strip at the bottom says what you have picked, and B / ○ closes it from anywhere.',
    'Items shows what you have found as pictures of the things themselves, with an empty slot for each thing still to find; the one you pick shows large, with what it is and what it does. A / × on a fluid mode switches your tank to it. Under them: what you carry for a quest, and your keepsakes.',
    'Quests shows only what matters now: for your father’s charge and for each quest under way, its goal and its next step, never the steps already done; finished quests are a short list of names. A / × on a quest makes it the one your scout finds. The Start menu’s Items and Quests open the same panels.',
    'Sketchbook keeps every story page, relic, errand and observatory sketch, a row for each world, and A / × holds one up to look at; Worlds lists the worlds you know in the order of your journey, with whether their story is told and the relics and makers’ boxes found there.',
    'When the scout finds your objective, the line at the bottom gives the quest’s goal over its next step and how far it is.',
    'The charms that came out of their boxes as a plain gold gem (the soft-fall soles, the hush-cloth, the listening shell, the glow-moss pin, the seed pouch, the wind-silk scarf, the breathing reed, the climber’s resin) and the cab pass now look like what they are.',
    'Standing still, the traveller’s legs hold still: his right foot no longer snaps round and steps every second or so, and when he shifts his weight his hips go over the leg he stands on while the other knee relaxes forward, instead of the free foot stepping back and forth every few seconds.',
    'The traveller stands as he is drawn, upright with his feet under him a little apart, instead of in a wide split stance that looked like a stride from the side.',
    'Standing about, the traveller holds his head up and looks ahead, as in his drawings, instead of hanging it to stare at the ground, and running he keeps his eyes on the way ahead instead of on his feet; when he looks around, his head turns as far as the motion has it.',
    'Cabs drive themselves now: nobody sits up front. You ride seated inside, in an open cabin under the striped canopy, and the camera watches from beside the cab so you see yourself sitting there as the city goes by. As you get in, a little screen on the dash asks where to: choose a stop with the mouse, a number key or the stick and A / ×, and the cab flies you there. At the stop press E (B / ○) to step out, or SPACE (X / □) to choose somewhere else.',
    'The Signal Market’s cabs stop at the lantern market, the skybridge over the old sign, Signal Square and the cream balcony on the silent tower; the City-Shaft’s at the rim by the ship, the high terrace, the middle levels and the palace gate. Only Wren goes down to the bottom terrace, by the call-lamp.',
    'Wren is the old cab itself now, not its driver: light the call-lamp at the bottom, get in, and Wren talks to you from its dash before it takes you up. The errand is called The Cab That Stops, and the City-Shaft’s people speak of cabs where they used to speak of drivers.',
    'On the Steam Deck the settings have the same Updates section as the Android app: what you are playing, Check for updates, what the new version brings, Download and restart with a progress bar, Restart now and the update details. Restarting keeps your saves and comes back at the title screen.',
  ] },
  { v: '0.74', date: '2026-10-06', items: [
    'Seated people’s capes rest on what they sit on: they fall down the back, over the bench’s edge and onto the ground behind, without crumpling into stiff folded sheets or spreading out along the bench, and they no longer pass through a crate, a stool or a stone the sitter is perched on.',
    'In the City-Shaft the shade is printed flat in the shaft’s blue, as in its drawings: a pink wall’s shaded side goes blue, while the trees stay green and people keep the shade of their own clothes. In the desert’s reference views of the dish city and the dunes, the shadows the dishes and cliffs throw on the sand are solid dark ink, as drawn, while the domes keep their blue shade.',
    'No more filter stuck to the screen: the faint paper grain and the darkened corners that stayed put while the world moved under them are gone, and the slight wobble of the ink lines now turns with the world as you look around instead of sitting on the screen like rippled glass.',
    'Old walls no longer shimmer as you look around: the small dark grime streaks on distant walls, such as Qanat’s, are a soft faint stain instead of tiny outlined drops that flickered, the chipped plaster has no flickering edge, and very fine hatching on far walls turns to a flat tone instead of crawling.',
    'The spots on the desert sand are pebbles and stones now, as Moebius draws them: each a little stone with its side away from the sun in shadow and a short shadow on the sand pointing away from the sun, long at dawn and dusk and short at noon. Far off they become small dashes all pointing the same way instead of a scatter of dots.',
    'The Steam Deck version updates all of itself from the game’s site again, not just the game: the app around it too, when it changes.',
    'On the Steam Deck the game has its own pictures in the Steam library, drawn from the game itself: the floating island under the title on its cover, the cliff monastery on its banner, and the desert’s saucer city across the top of its page. It is called Memento there too, no longer Moebius, with its time played kept.',
    'The game runs smoothly on handhelds again: the traveller’s new coral overshirt had pulled the Retroid down to about 20 frames a second in every world. Its cloth now moves exactly as before but is worked out several times faster, away from the rest of the game.',
  ] },
  { v: '0.73', date: '2026-10-06', items: [
    'The desert is solid where it is drawn: on the Givers’ Hearth butte and the Givers’ House tower you hang on the rough rock and the carved stone instead of half inside it, and your feet rest on the sunken leviathan’s ribs and skull, on the crashed hull and its salvage, on the fallen giant’s brow, cheeks, teeth and arm, and on the petal station’s great petals and its cage.',
    'Qanat’s dry well is a well again: an invisible floor used to cap its mouth a metre above the terrace, so you walked over the hole. The great tree’s roots spread over the terrace are solid under your feet now, and lie low enough to step over.',
    'Qanat’s houses, domes and tower-houses, and the cave in the giant’s chest — its basin, its rough walls and the ribs arching over it — are solid exactly where they are drawn.',
    'In the Buried Machine your feet and hands meet the metal where it is drawn: the trench’s pipe strata, collars, tanks and ribs, the drum’s rail, its windows and porthole, and the Engine-House’s gantry, ember floor, wall pipes and riveted bands are solid now.',
    'In the Garden of Spheres the hill’s boulders, the pillars, the monoliths, the white ruins and the robot statue hold you up where they are drawn, and the singing spheres in the Footprint are round under your feet instead of a flat disc over them.',
    'In Lorn the Hush-House’s dome, its ribs and the swamp crystals, and in Lorn II the Lamp-House’s tower bands and pool-lamps, the root heaps and gate over the cave, the arches’ roots and the glass dome’s ribs are solid where they are drawn.',
    'Things you can stand on are the things you see: the painted bands, window frames and chimney cap of the houses at home, the Signal Market’s awnings and tower billboards, Viridel’s glass dome and its ribs, and the First Garage’s clocks and great escapement wheels. The band round the small house at home no longer runs across its own doorway.',
    'In the desert the radio dishes’ bowls, rims and feeds, the sail camp’s domes and the salt lagoons’ floating plates hold you up where they are drawn — you can stand on a salt plate now instead of going through it.',
    'Every temple’s halls lose the invisible ledge at the top of their round rooms: the stone cornice is solid where it is drawn, so climbing one you meet the overhang instead of passing through it.',
    'The desert’s people carry what their drawings give them: Bako his reed flute, and his flat bag on its strap over his coat instead of under it; Sefa her oud, and her cap over her braid; Marrow a salvager’s hook, with his loaded hand-cart parked at his pitch in the camps; the Speaker’s staff has the procession’s bell at its head; and the keepers wear their own, a bead fringe at Ama’s hips and the well’s keys at Hessa’s belt.',
    'People walking somewhere no longer lean against a wall, a kerb or a well for ever: they walk round it and carry on.',
    'A few clouds drift over the desert again, far apart, drawn in ink with hatched undersides, and their shadows pass slowly over the dunes. The horizon stays clear, as in its drawings.',
    'Your footprints in the sand no longer vanish when you turn the camera: they stay wherever you walked until the wind fills them in.',
    'The stone half-arch that hung in the sky over the pilgrims’ camps, joined to nothing, is back where it belongs: on the inner face of Qanat’s main gate, framing the way in.',
    'Vael’s bird stands tall on long wading legs, her feet on the ground, and folds her wings close along her sides as the drawings have her, instead of holding them out flat behind her.',
    'In Vael II the mushroom tables lean as the drawings have them, their caps tipped off the level, with stalactites hanging in the shade under their lips; the stacked stones and the egg on the disc column are split by deep cracks, and the sea of cloud is knobbly as a cauliflower.',
    'Vael II’s monastery has a cloister and a church porch of round arches, arched doors, red eaves over the walls, slender columns round the great dome and a ball and spike on every dome, among more cypresses.',
    'The traveller no longer holds a phone: the old handheld screen he carried in his right hand (in the character studio and on the Motion page) is gone, and his hand is empty.',
    'With the tank on your back you now wear a dark leather glove on your right hand, as on the drawings: the hose runs down your arm into its cuff, its three knuckles light for the charges left and its plate glows in the fluid’s colour, and your shots and pushes leave from your fist. The wrist bracer, whose brass nozzle lay along your hand like a phone, is gone.',
    'People sitting on benches, stones and kerbs wear their robes as seated people do: over the lap and falling from the knees in front of their shins, instead of standing out round their knees and through the bench. Robed people in the crowds no longer have their robe swing out with an arm as they walk, or rise over their head when they sit.',
    'On the Steam Deck the game starts in Gaming Mode: it used to stay on a black screen you couldn’t close, because Steam’s overlay crashed it as it opened. If it ever can’t draw, it now tries another way and otherwise takes you back to your library, and Exit Game closes it at once.',
  ] },
  { v: '0.72', date: '2026-10-06', items: [
    'The traveller now wears the new coral overshirt, with a new face, articulated fingers and cloth that moves as you explore.',
    'Fingertips on the new character bodies now bend with hand gestures instead of staying rigid.',
    'The 48-second trailer opens on the new coral-shirt traveller walking across empty dunes toward the ship. Reference compositions frame the City-Shaft’s busy flying taxis, the glowing Deep Wood and the Garden of Spheres. Taxis keep clear of the walls, hover jets leave colourful trails, small birds pass the great bird, and climbing hands meet the wall. The ending changes worlds; the film renders at 4K for a smoother 1440p video, with music, action sounds and no text over the footage.',
    'Soft things are drawn in softer lines, as in the drawings: clouds in a thin blue-grey line, Lorn II’s reeds and crystals in a pale violet one, leaves and the Garden of Spheres’ canopies in a lighter dark green, glass and the Signal Market’s painted billboards in a darker shade of their own colours, instead of heavy black ink everywhere.',
    'Distance falls away in layers of haze, as in the drawings: in Lorn II the trunks step back into a cool violet mist, with a low mist over the water and the paths; the desert’s far dunes and the Signal Market’s far towers pale in warm bands; Vael II’s plain lightly too. Looking down the City-Shaft, the town fades into a pale blue haze toward the bottom.',
    'Cast shadows fall as the drawings have them: on Vael II’s plain and on Lorn II’s paths and water they are only a faint trace or gone, the Garden of Spheres’ lawns are lighter under the trees, while form shade stays.',
    'A wall turned edge-on to the sun no longer breaks into a field of tiny light specks: it sits cleanly in its shade, and the fine pen marks on shaded walls read more clearly.',
    'On Android, putting the handheld to sleep (or leaving the app) now silences the game at once: the music no longer plays on with the screen off, on the title screen, in a world that is still loading or anywhere else, and it comes back when you return.',
    'Arriving in a new world with an errand from the last one still under way, the drone now finds the person who starts this world’s quest, and the marker shows them, instead of finding nothing (Vael II, Lorn, Viridel, the Hangar, the Garden of Spheres and the Signal Market).',
    'The drawing holds still as you move: old walls seen at a slant no longer shimmer with flickering grime streaks and cracks, the edge where a big pipe, tank or trunk turns from the sun is one clean line instead of crawling teeth, and the fine pen marks on distant walls change scale gently instead of popping as you ride or fly past.',
    'Haze and fog stay put on the land as you turn the camera, instead of sliding across it with the view.',
    'In the City-Shaft a red stair now runs down the shaft’s wall from the rim to Nima’s terrace, 50 metres below: look for the cream gate with the red lintel on the rim near the stone pillar. You no longer have to glide or climb to reach her (gliding down still works).',
    'Errands between worlds now always send you on to the next world on your way, never back to one you have finished: singing sand from the desert for Senn in Vael, the bird’s feather from Vael for Vael II, a storm crystal from Lorn for Bram in Lorn II, a brass gear from Lorn II for Mira’s water clock in Viridel, a glass seed from Viridel for Nima in the City-Shaft, and a taxi token from the City-Shaft for the Sealed Hangar, each with new words from the one who gives it and the one who takes it.',
    'Pushing with your fluid (RB / R1) shows its shock front again inside temples, caves and halls: the rings and spray had vanished there, along with the splash where a shot lands.',
    'Gliding, your hands no longer twist and spin at the ends of your arms: they stay open and flat, palms down like the tips of the wings, through turns and as the wings open and fold.',
    'Vael’s bird lands like a bird now: coming down she lowers her legs and reaches them forward, flares her wings and slows, touches down with her feet on the ground, even on a slope, sinks into her knees and walks off the last of her speed.',
    'Cast shadows have smooth, clean edges instead of blocky steps, most visibly the desert’s deep dark shadows and on the handheld. Small shadows such as a flower’s petals or a ribcage’s bones keep their true shape. The dark edge no longer crawls when you move the camera.',
    'On the moving stone discs of Vael II’s Founders’ Belfry the traveller’s feet rest on the stone instead of sinking into it, and he rides a rising disc without dipping into it; the same on every temple’s riding discs and pressure plates and on the Belfry’s ledges. The trims, door frames and columns of the temples’ walls are solid where they are drawn.',
    'Vael II’s rocks are solid exactly where they are drawn: climbing a needle, a boulder or a stone table the traveller hangs on the rock’s face instead of half inside it, and on the caps, boulders and rubble his feet rest on the stone. The same for Lorn II’s trunks, giant mushrooms and root arches, the Garden of Spheres’ spheres and umbrella trees, the desert’s umbrella grove and the towers outside several temples.',
  ] },
  { v: '0.71', date: '2026-10-06', items: [
    'In the Signal Market the shaded sides of the pink and cream towers turn the street’s cool teal, as in its drawings, instead of a dark brown.',
    'The References scenes now include the Signal Market: twenty-one views from its eight sheets, the canyon of towers and billboards, the skybridges, the stalls, the cabs and the crowd. Every reference sheet of every world is now in the References.',
    'The desert runs smoother again on large and Retina screens: the shading of deep pockets and creases costs far less, so Qanat’s streets and the camps are back near 60 frames a second on a MacBook, with the same look.',
    'Game updates in the app and on the Steam Deck are about a third of their old size: the References scenes’ drawings are no longer packed into them and come from the game’s site when you open those scenes.',
    'On the Steam Deck the screen no longer dims or goes to sleep while you play with the controls.',
    'Walls and machines are drawn with fine pen detail, as in the drawings: panel seams and joints, little vents, hatches and plates, bolts up close, and the same marks on the far buildings at their own scale. Tree trunks, roots and the giant mushrooms’ stalks have short grain strokes along their bark.',
    'The Steam Deck version starts again in Desktop Mode on the latest SteamOS, where its window used to stay blank and close.',
    'Shading strokes follow the shapes, as in the drawings: under Vael II’s stone tables, the Garden of Spheres’ umbrella trees and Lorn II’s giant mushrooms they fan out from the stalk and run down it, and round the Buried Machine’s tanks, drums and chimneys and the trees’ trunks they wrap round instead of crossing them on the slant.',
    'Old walls are no longer one even colour: as in the drawings, a building’s colour breaks into a few big flat patches, a repainted stretch over a storey or three, one face a little paler or warmer than the next, now and then a whole storey in another render. You see it in the Signal Market, the desert’s city and domes, the City-Shaft’s houses and the Buried Machine.',
    'Every world runs smoother, most of all on large and Retina screens, where a frame takes about a tenth less time to draw; the busiest places, like the Garden of Spheres’ crowds and home, also ask less of the computer. The look is the same.',
  ] },
  { v: '0.70', date: '2026-10-06', items: [
    'People wear many more kinds of headwear: wide and narrow-brimmed hats, flat straw hats, bowlers, peaked and flat caps, knit caps, fur hats with their ear-flaps down, aviators’ caps, kerchiefs and headscarves, small round caps, circlets, miners’ hard hats with a lamp, and hoods thrown back on the shoulders. On their faces and necks: round spectacles, dark glasses, cloths over the mouth, desert face-wraps, now and then a monocle, neckerchiefs, thick mufflers and goggles hung round the neck.',
    'Each world wears its own: wraps, veils, face-wraps and straw hats in the desert; bowlers on the City-Shaft’s rim, caps, knit caps and goggles further down, ear-flaps and kerchiefs at the bottom; aviators’ caps in the Hangar, hard hats under the Buried Machine, circlets in the gardens, flat caps, knit caps and headscarves in the Signal Market. People in the crowds far off wear them too.',
    'On the new bodies, hair shows under a hat, a cap or a headband: pressed flat where the hat sits and falling out below it, instead of a short cap of hair under every hat.',
    'The Signal Market’s people have the new bodies too, children, the old and the heavy in their own shapes. Kip is a child of eleven in a courier’s cap and neckerchief; Madame Sel wears round spectacles under her turban; Ferro a kerchief with her goggles pushed up and a tool belt; Brush a painter’s beret; and on the street Oyo a small cap and spectacles, Teb a flat cap and a muffler.',
    'The City-Shaft’s people have the new bodies too: Pip is a child of nine in a knit cap (and no longer has a beard), Wren the cab driver wears an aviator’s cap with her goggles pushed up, Lio the dispatcher a peaked cap, and Corvin of the rim a bowler and a monocle. No child anywhere grows a beard.',
    'Vael’s silent people have the new bodies too, and Tam, the boy who copies you, is the size of a seven-year-old.',
    'In the bell monastery of Vael II, Tiv the novice is a boy of ten, Mother Ysolde reads her letters through round spectacles, and the monks and sisters wear skullcaps and headscarves.',
    'The Sealed Hangar’s mechanics have the new bodies too: Pip is a child of nine, Ambroise the clerk wears a monocle, and the crowd adds aviators’ caps, peaked caps and goggles hung round the neck.',
    'Under the Buried Machine the dome people have the new bodies too: Pim, nine teeth old, is a small boy (he was an old man’s size), Hask keeps the Wick under a miner’s hard hat with its lamp, and the crowd wears hard hats, knit caps and fur hats.',
    'In Viridel’s gardens the people have the new bodies too: Lio, who climbs, is a child of nine, Esk tends the tea terraces under a straw hat, and the gardeners wear straw hats, wide brims and circlets among the flower crowns.',
    'In the Garden of Spheres the listeners have the new bodies too, and some wear circlets, small round caps or a bowler instead of their sphere hats.',
    'In Lorn the swamp people have the new bodies too: Corm feeds the plants under a wide drooping hat, and the crowd wears drooping brims, kerchiefs and hoods thrown back among the reed hats.',
    'In the deep wood of Lorn II the lamp-keepers have the new bodies too: Wick, the young lamp-keeper, is a girl of fifteen, and the crowd wears knit caps, fur hats, mufflers and hoods thrown back.',
    'At home, Lou, your aunt Tove and the neighbours have the new bodies too.',
    'The Lab’s giants, its gallery of faces, have the new bodies and faces too, so the faces you study there are the ones people wear.',
    'The small robed walkers in the References scenes have the new bodies too.',
    'The artist in the atelier has the new body too: every world’s people now do, except the traveller, who keeps his own.',
  ] },
  { v: '0.69', date: '2026-10-06', items: [
    'Old buildings look worn by time: dirt streaks run down their walls from the tops and sills, patches of plaster have broken away with a little shadow under the edge, longer cracks have a shadow side, and dust darkens the foot of the walls. Each building wears differently. You see it on the desert’s city and domes, the Signal Market’s shops, the houses at home and of the City-Shaft.',
    'Faceted shapes far from the middle of a world no longer break into fuzzy dots where the sun grazes them.',
    'The traveller looks more like his drawings. His hair is a short, tousled mop of soft curls with a fringe over his forehead, instead of long locks. His coral overshirt has a proper collar and hangs open and loose over his undershirt, down to his thighs.',
    'He wears a little tan neckerchief knotted at his throat instead of the bunched scarf, and slim, low suede ankle boots with thin soles instead of the big rounded ones. His trousers hang looser, and his satchel sits on his right hip, as in the drawings.',
    'In Lorn II the giant mushrooms stay pale even on their shaded side, as in the drawings, glowing against the dark wood.',
    'The References scenes now include Lorn II: twenty-three views from its four sheets, the giant mushrooms, the egg heaps and coral pools, the moss domes, the root arches and caves, the saucer and the skiff. The glowing eggs, pools and doors in these scenes now light what is around them.',
  ] },
  { v: '0.68', date: '2026-10-05', items: [
    'In the desert the quest no longer just appears when you land: Marrow the salvager is at your ship, looking over the scar on its hull, and calls you over. Talk to him and he tells you the only fire that could wake your ship is the great tree’s, in Qanat, and to ask old Nour; the quest begins then. Until you have talked to someone, your drone finds the one to ask.',
    'Every other world opens the same way: its quest begins when you talk to the person who knows where to go (Oïa, Sister Aube, Madame Sel, Wen, Mira, Ambroise, Nima, Wendel, Hollin, Aube), and the drone leads you to them first.',
    'Nour no longer starts talking by herself when the makers’ chest opens: she comes over and calls you with a soft “psst” every few seconds, turning to you, until you go and talk to her.',
    'The traveller no longer asks Nour how it is that he understands her.',
    'The spark-stone goes into your pack instead of floating about you: your gear in the sketchbook (and the menu’s Quests page) lists it with the other things you carry, and it comes out in your hand when you set it in the well.',
    'In the giant’s chest the gutter is lit along its whole length, so once the rib is off it looks clear all the way down instead of half full of rubble.',
    'The desert’s two cinematics show instead of tell: the traveller says nothing in them, and at the end only the corner of his mouth goes up.',
    'Shadows have a third, darkest tone, as in the drawings: deep pockets in shade, between ribs and pipes, inside machines and under overhangs, fill with a near-black mass of the world’s darkest colour, and long shadows thrown by big masses go a little deeper. Lit areas stay clean; faces and people never go black.',
    'The Buried Machine’s deep machinery and the rust canyon’s shadows are darker and richer, rust-brown and deep teal, as in its drawings.',
    'The References scenes now include the Buried Machine: twenty-two views from its four sheets, the domes and pipes in the dunes, the rust canyon and its ovals, the teal drum open to the sky, the hanging city and the ring of arches.',
    'The Garden of Spheres looks more like its drawings: the undersides of the great umbrella trees and the thickets are a deep, dark green, the white stone’s shade is a clean pale blue, and the darkest pockets of shade turn deep green instead of grey.',
    'The References scenes now include the Garden of Spheres: twenty-two views from its four sheets, the umbrella groves, the pyramids, the giant spheres and their arches, the white hill, the lake and the olive avenue to the round plaza.',
    'The References scenes have a quick menu: press Tab (X / □ on a controller, or the small “views” button at the top left) to see every view, grouped by world and sheet, each with a tiny picture of its panel, its number and its title. The one you are in is marked; move with the mouse, the arrows or the d-pad and choose one to go straight there. B / ○ or Esc closes it.',
  ] },
  { v: '0.67', date: '2026-10-05', items: [
    'The traveller dresses more casually: an everyday canvas rucksack, with a lid, buckled straps, pockets and a rolled bedroll, replaces the old radio box, and nothing of the space suit is left: soft desert boots without seams or buckles, a loose cotton scarf instead of the ringed collar.',
    'The fluid tank is a slim, flat glass flask now, set into the rucksack and held by leather bands. It sticks out far less from your back, and its three coloured bands still show your charges from behind. When the flask goes into a vehicle, the rucksack stays on your back.',
    'The drone perches on top of the flask’s leather upright, beside its neck and clear of your swinging arms; before you have the flask it rides on the rucksack’s lid. The lantern hangs just below it.',
    'His face is leaner, with thinner cheeks and a narrower chin, and his hair is a scruffier, curly mop of broken locks.',
    'Capes and robes stay on people at every distance: they no longer stream out behind walkers or let legs and arms through until you come close, a robe no longer shows through the cape over it, and the people farther off in a crowd wear capes as wide as the ones up close, over their arms, so nothing changes as they come near.',
    'Not everyone out there is built like you. In the Garden of Spheres, old drifters float over the grass: pale ribbed bells with a glowing heart and long threads.',
    'In Vael, tall stilt-walkers pace the plain on three long legs, with a lantern for a head. In Lorn II, shellbacks glide along the lit path, carrying their spiral houses. In the Signal Market, murmurs, five small pale bulbs who speak as one, hop through the crowd together.',
    'You can talk to all of them. Each people has its own voice and its own writing, which the translator turns into your words. They have no faces, so a line’s mood shows in how they glow and move: a brighter heart, a lowered lantern, drooping eye stalks, a huddle.',
    'Some of them know what you are looking for. They give hints while your quest is at that step, and they have news once a world’s story is done.',
    'They react to your fluid in their own ways. Push a drifter and it floats away and drifts back; a stilt-walker totters and steps to keep its balance; a shellback pulls into its shell and rolls; the murmurs scatter and hop back together.',
  ] },
  { v: '0.66', date: '2026-10-05', items: [
    'The worlds come in a new order. After the desert, Vael is first: you find the fluid wings in its Aerie and learn to ride the winds. The fluid jets come much later, in the City-Shaft, the seventh world, and no world before it needs them. Saves that already have the jets keep them.',
    'Vael II is charted once you have finished Vael, since it needs the bird you meet there.',
    'In Vael the great bird stays hidden in the sky, and can’t be ridden, until you learn her call. A column of rising wind climbs the lone tower’s side: open your wings in it and it carries you up to the balcony.',
    'The lone tower’s window is a deep stone arch now. On its sill lies a little bone flute with a feather tied to it. Pick it up and play it: five notes, and the bird comes down to you for the first time. From then on, calling her plays that tune.',
    'The bird walks on the ground: her legs step in turn, her body bobs and her wings stay folded. Taking off, she crouches, leaps, and only starts to beat her wings at the top of the leap.',
    'Right after you find the jets in the Warden’s Well, a line tells you what to do with them, the drone flies up to show the way, and pale rings rise through the round opening in the ceiling you fly up through.',
    'The City-Shaft’s cabs ignore you until you have a cab pass. Lio, the dispatcher on the rim, writes one if you collect the fare Hask owes him. The pass is listed with your gear. Wren still stops for anyone at her lamp.',
    'The makers’ boxes have a new look: one smooth dark blue box with no edges, a pale star on top and a ring on each side, and a thin ray of light that keeps travelling across its surface. Come close and the ray crosses it more often and the star brightens.',
    'Opening a box: it floats up off the ground, wobbles two or three times with little pauses in between, as if deciding, then comes apart into light.',
    'In Qanat, the box on the great tree now waits much higher up, on a carved stone pedestal of the makers with lamps and a ring of light: climb the big root, then the stone pier above it.',
    'Nobody tells you about the makers’ boxes before you have found one yourself: the hints for a world’s other boxes only start once you have opened your first.',
    'A new app icon, taken from the game itself: the big pink dish on its stem over the blue domes of the desert city, under a clear sky. It shows on the Android home screen (with a themed version on Android 13 and later), on the start screen before Android 12, in the browser tab, when you add the game to a phone’s home screen, and on the Steam Deck.',
  ] },
  { v: '0.65', date: '2026-10-05', items: [
    'On a controller the sketchbook, what’s new and the other panels no longer say “J to close”: they name the controller’s own back button (B on a Retroid), and that button closes them. In the menu, B closes it from any page, Quests and Controls too, and the sketchbook opened over a conversation closes before the conversation does.',
    'The skip tags of the game’s little scenes name the controller’s back button too, the one printed B on your handheld.',
    'No more row of pills for the tank beside the traveller or under the crosshair: the tank on your backpack shows how full it is. Only an empty tank still says “empty”, for a moment.',
    'The drone no longer carries a second pointer: no lit beak, no beam on a find. It flies out the way to go, faces what it found and drops its flare there. It also really faces it now (it used to look the way it was flying).',
    'A guardian’s bar is what is left of it: full when the fight starts, going down as it goes your way. A machine’s is its health; a living guardian’s is its unrest, since it is calmed, never hurt. The bar sits above the line at the bottom of the screen.',
    'The warden in the Warden’s Well: once it shuts its sides, the hatch on its crown visibly swings up and a column of its glow rises out of it every time it opens, so you can see from the floor that it is still opening, and it says so. In its first phase a shot into any of its side vents counts, not only the one in front.',
    'In a guardian’s fight, ping the drone (Q, Y / △, or ping on a touch screen) for a hint: it chirps, rises over your shoulder, turns its lens on the weak point or the thing to use with a short beam, and the line at the bottom says what to do. Ping again and it says it more plainly. Every guardian has its own hints, the gentle way first.',
    'The Gardener in the Builders’ Greenhouse can be calmed again: a bloom shot on its bare back used to count as plain water.',
    'The jets fly like Superman: hold RT / R2 (or the left mouse button) and push the stick to fly where you look. Look up to climb, look down to dive, straight down to drop head first. Let go of the stick to hover in place, and hold A / × as well to rise straight up. The traveller stretches out flat along the flight, arms ahead.',
    'Flying low on the jets over rising ground skims along it at full speed instead of stumbling into a walk, and diving into the ground lands you.',
    'Aiming the fluid tool, you can now look straight up anywhere, including the tight rooms of the temples, where the view used to stop partway up. The shot goes where the reticle points.',
    'Knocked limp off a ledge into a long drop, the traveller now stays limp all the way down and gets up only on the ground. Before, the fall could stop and the traveller would stand up in mid-air. The landing at the bottom hurts like any hard fall, and the camera keeps up with the body.',
    'While you jump, fall, glide or fly, a small patch of shadow sits on the ground right under you, so you can judge a landing even when the sun’s shadow falls to one side. It shrinks the higher you are.',
  ] },
  { v: '0.64', date: '2026-10-05', items: [
    'Vael II, the Sky Stones, looks more like its drawings: the shade on its rock, its plain and its monasteries is one flat grey-blue whatever their colour, the needles keep a clean light side with few strokes in shade, the undersides of the mushroom caps are the darkest places, and the sky is clear, with no bank of clouds on the horizon. Its flowers and its people keep their own colours in shade.',
    'Cliffs, needles and rock faces everywhere are hatched with strokes running down the face, as an inker draws rock, and the shade under a cap or an overhang no longer curls into wood grain.',
    'The References scenes now include Vael II: thirty-one views from its six sheets, the needles on peach and aqua skies, the balanced eggs, the monasteries on their cliffs and floating islands, the mushrooms over the sea of cloud and the plain with its lone tower.',
    'Starting a conversation, the camera cuts straight to the view of you both instead of swinging round to it, and cuts straight back to you when it ends. If someone steps into the view mid-talk, it cuts to a new angle rather than sweeping across.',
    'Start talking to someone while standing right on top of them and you are a comfortable step apart when the conversation opens, already turned to face them. It works with children and with people sitting down, and you are never put into a wall, off a ledge or onto someone else.',
    'Alien speech turns into English more than twice as fast: each word becomes readable a moment after it is said, and the whole line is in English a fraction of a second after the last word.',
    'Waking up on the ship, no lights or stripes on the floor lead you to the cockpit any more: the voicemail button on the console blinks, the round screen above it glows with “1 new message”, and when you walk up to it a prompt says to press it.',
    'The holo table in the middle of the deck now opens the galactic map. The cockpit console is the voicemail: its button blinks while a message is waiting, and pressing it plays the message.',
    'The ship no longer tells you that you are playing a recording: it says you have a new message. What the messages really are, you find out as they go on.',
    'Flying to another world is a landing now, not a crash: the ship brakes into the air, comes down through the clouds upright on its jets and settles gently onto its feet, dust blowing out from under it, with no fire and no shaking. Coming home lands the same way. Only the first arrival in the desert is a crash.',
  ] },
  { v: '0.63', date: '2026-10-05', items: [
    'The desert’s sky is clear now, as in its drawings: no bank of clouds on the horizon, and the far dunes fade into a pale warm band.',
    'Steep dune faces in shade are hatched again with dense strokes, while flat sand in shade stays a calm tone.',
    'The City-Shaft is drawn with fewer hatch strokes and a clean sky, and its houses have fewer, smaller windows.',
    'The References scenes now include the City-Shaft: twenty-three views from its five sheets, up and down the shaft, after the desert’s.',
    'Walking through a door, into a cave, a temple or the crashed ship’s hatch, through the Lab’s doors or the Hangar’s portals is smooth now: a sheet of paper sweeps across and you walk on out of the far side at the pace you had, mid-stride, the camera still where it was behind you, instead of stopping dead with the view snapped in close.',
    'The rooms, caves and halls behind every door, and the ship’s cabins, are made ready while the world loads, so the first step inside no longer hitches.',
    'Stepping into the ship or a house, the camera comes level gently instead of jumping.',
    'A world loads without freezing the page: it is built a piece at a time behind the loading screen, so the pen keeps turning smoothly and the first moments in the world no longer stutter while the rest settles in.',
    'The desert’s people have new bodies. Children look like children, and teenagers, heavy people and the old have bodies of their own age and build instead of one stretched man or woman. Their faces move as they talk (a smile lifts the cheeks, worry raises the brows), and their hair is drawn as a few big locks with strand lines, which now show on dark hair in the shade too.',
    'Ilo and Kito are as small as children their age, and the people in the crowd who come close keep their age and build, so an old pilgrim stays old as you walk up.',
    'Bako, Nour, Marrow, Sefa and the Speaker dress more like themselves: Bako in a head-wrap, a grey beard and a long teal coat; Nour under a wide straw hat with a veil, in ochre robes; Marrow in a patched hood with goggles and a scarf; Sefa in a long purple cloak; the Speaker in a tall, wide-brimmed hat with a high collar over his mouth.',
    'Capes hang round fuller and thinner bodies without passing through them, and someone knocked over lies on their own shape.',
    'The traveller has a new look: tousled dark hair, a loose coral overshirt, cream trousers rolled above worn ankle boots, a beige scarf and a round satchel. His sleeves are rolled up and his face is uncovered.',
    'The glass backpack is smaller, with green fittings, faded turquoise and lavender cloth ties, and a dark wrist tool. The makers’ star sits on his lapel and the lantern hangs below the scout’s dock.',
    'The character studio can show the complete fluid backpack and wrist tool while you inspect an outfit or animation.',
  ] },
  { v: '0.62', date: '2026-10-05', items: [
    'Nothing stays on the screen while you play any more: the box in the corner with the place, the objective and the relics is gone. Your health shows while you are hurt or healing, the stamina wheel while you are tired, the tank beside you while it refills or the jets burn, and each fades away after. A short line at the bottom says what the use button does when there is something to use, and a region’s name as you cross into it.',
    'To find where to go, send your drone: Q, Y / △ on a controller (riding and flying too), or ping on a touch screen. It flies a little way towards your objective, points its lens beam at it, drops a flare there that you can see from far away, chirps, says what it found and how far, and comes back to your pack. With nothing to find, it shrugs.',
    'The menu has a Quests page: where to go now, your father’s charge, and every quest with the steps you have done struck through, the finished ones and the failed ones. Choose a quest there to track it. Every control, for the controller, the keyboard and touch, is on its new Controls page (H opens it).',
    'The floating diamond over your objective only shows for a while after the drone has found it. A makers’ box offered when you arrive no longer takes the drone away from the quest you are on, and the drone no longer points at relics: they are yours to find.',
    'The frame-rate readout is off unless you turn it on (F, or in the settings). On a touch screen the menu button is a small, faint ⚙ in the corner; with a keyboard or a controller there is none (O, Esc or Menu open the menu).',
    'The Android app now runs the game in an engine of its own (Mozilla’s GeckoView) instead of the system’s web view: on handhelds stuck with an old web view, like the Retroid Pocket Nova, busy places such as Qanat and the camps play close to 60 fps instead of 30 to 45, and the game starts several seconds sooner. Your saves come along by themselves the first time. The app download is bigger, about 100 MB.',
    'The frame readout (F) now starts with the browser engine and its version, such as GECKO 157, WEBVIEW 109 or CHROME 154, so a screenshot says where it ran.',
    'Shadows have more than one tone: a form turned from the sun is a lighter half-tone, the underside of an overhang catches the light the ground throws up, and cast shadows stay the deepest. Sand, bone and metal keep their own colour in shade instead of all turning the same blue.',
    'Fewer strokes over big shaded areas: walls in half-shade, sand, bone and metal are a flat tone with few hatch lines, and layered rock keeps a few strokes along its layers in the light. The ink is finer and more broken, solid black in the deepest crevices, and soft dune crests are no longer outlined.',
    'Calmer sand, with fewer wavy ripple lines and scattered dots; bare rock shows long cracks. Water ripples only in the patches the wind ruffles, and far water lies flat. The printed sky is one grainy tint down to the horizon, the page has more of a paper texture, and hulls are plated in uneven panels.',
    'Old walls look lived in: cracks run down from their tops, up from their feet and out from window corners, with patches where the plaster has gone. In the desert, sand banks up against the buildings, tents, skeletons and wrecks, so they sit in the ground, and you can walk up the drifts.',
    'The cave under the giant’s skull runs smoothly on handhelds: inside it, and inside every temple and chamber you reach through a doorway, the game no longer draws the whole world outside behind the walls.',
  ] },
  { v: '0.61', date: '2026-10-05', items: [
    'Plants no longer get shoved aside as you walk past: they lean a little away from you, as if brushed, and spring back with a small wobble, more the closer and the faster you pass. Grass parts round your feet the same way.',
    'Grass no longer pops in or stops at a line: the blades fade out tuft by tuft with distance, shorter and in the colour of the ground, and sparse low tufts carry the meadow about twice as far before it melts into the ground. Turning the camera no longer makes the grass in front of you jump.',
    'Flowers that open no longer push their petals into walls, rocks or each other: they lean a little away from what is close and open only as far as there is room, and those squeezed into a tight corner grow a step further out.',
    'No more comic pages popping up over the game when you arrive in a world or reach its goal: their words now come as a note at the top of the screen, like other messages, and the moment still goes into your sketchbook.',
    'The jets climb again: hold RT / R2 (without aiming) and you rise, straight up, or up and wherever the left stick points. Hold A / × as well to hover in place.',
    'The fluid gun’s paint now lands on what it hits and takes its shape: it wraps over steps, rocks, domes and tree trunks and runs round their edges, instead of a flat disc floating in front of them or cut through by them.',
    'Faces in the conversation portrait are sharp: clean outlines instead of jagged, broken lines, on small screens too.',
    'Boulders, big globes and pillars far away now cast shadows like the buildings beside them, and Perdide’s great crystal throws its shadow across the island.',
    'Game updates for the Android app and the Steam Deck now come from the game’s own site. Accept the new Android app when it is offered, once, to keep getting them; your saves are kept.',
    'A new place in the worlds list (Debug on the title screen): The References, twenty-seven desert scenes from four sheets of the drawings the game is made after, each seen the way its drawing frames it. [ and ] (L3 / R3) change scene, \\ (View) puts the drawing beside or over the picture.',
    'The first time the water runs in the giant’s chest you see it happen, like a page of a comic: the rib rolls clear, the crack in the wall lights up, the water comes down the gutter and spreads across the dry basin round the roots, to the desert’s own tune, and the traveller says what he sees. It plays once; B / ○, Menu or Esc skips it.',
    'The first time your empty tank fills in the giant’s pool, you watch it: the water climbs into the dry glass in three colours to your father’s tune, the rings on your bracer light one by one, and the first shot leaves the nozzle and splashes across the pool. Then you are told how to shoot and push.',
  ] },
  { v: '0.60', date: '2026-10-05', items: [
    'Every world has music of its own now, with its own instruments, scale and short tune: ney, oud and frame drum in the desert; a muted horn, vibes and a walking bass down the City-Shaft; wind and breath on Vael; the monks and their far bell over Vael II’s clouds; a ticking, unresolved machine in the Sealed Hangar; low brass and struck metal in the Buried Machine.',
    'More of it: harp, strings and the water clock dripping in Viridel; glass, bells and mallets in the Garden of Spheres; a singing crystal, a low clarinet and wooden knocks in Lorn; woodwinds and woodblocks in the Deep Wood; market drums, claps and a hammered santur in the Signal Market; a felt piano and a music box at home and in the Atelier.',
    'Your father’s tune, the one you hear when he gives you his charge, comes back now and then in every world, in that world’s own voice. At home it opens the music.',
    'The music follows what you do: drums and plucked notes join in when you walk, run or ride, and when you stand still a while, go indoors, or night falls, it settles back to a drone, a few chords and the world’s tune. It never plays the same way twice.',
    'No more sharp clicks in some sounds: the ticking gears, drums, footsteps and gusts.',
    'Hands are no longer stiff and flat. At rest the fingers fall into the natural curve of a relaxed hand, each a little more curled than the last, the thumb in by the first finger.',
    'Hands follow what you do: looser and more open when you run or glide, gripping the holds when you climb, the hoverbike’s handlebars and the bird’s reins, a fist round the fluid gun with the other hand cupped under it. People hold their staffs, lanterns and baskets for real.',
    'People talk with their hands, in the tone of what they say: a fist when angry, a pointing finger when curious, open hands when happy, fingers flung wide when surprised, limp hands when sad, beating with the words. Fingers also drift a little on their own and swing as the hand moves.',
    'The character studio has a Hands view up close, and every hand pose to pick from.',
    'Jumps move now: you push off, tuck your legs as you rise, open up at the top, reach for the ground as it comes up and land in a short crouch, deeper after a long drop. A long fall throws the arms out.',
    'Running, climbing and swimming fast share one stamina. Sprinting tires you now, and a small inked wheel beside the traveller shows what is left while it isn’t full. Run it dry and you are winded: no sprint and no new hold on a wall until it has come back. Standing still brings it back fastest.',
    'Sprinting is about 14 % faster.',
    'At the edge of each world the traveller no longer runs on the spot and stutters: you stop, turn into it and lean against the wind, ink shimmers where you touch it, and the first time a line says what holds you back. Walking along the edge slides smoothly.',
  ] },
  { v: '0.59', date: '2026-10-05', items: [
    'People look kinder: most now rest with a slight smile and easy, open eyes, and each has a mood of their own (kind, amused, curious, calm; a few stern, like the palace and Qanat gate guards).',
    'Softer faces: lighter, finer eyebrows, the heavy double line over the eyes gone, fewer hollow cheeks and long jaws, fewer lines on younger faces (elders keep theirs).',
    'The corners of the mouth no longer turn down at rest; sad faces still look sad.',
    'Shadows on faces and necks are warm skin tones instead of blue-violet, and the whites of the eyes stay warm in shade.',
    'Every people now has its own range of faces, rounder, longer or lined, with the odd freckled face in the crowd.',
    'Your parents’ holograms look gentler too.',
    'Every world now writes in its own script: the desert’s joined, flowing letters read right to left, the City-Shaft scratches runes, Vael barely writes at all, the Hangar stamps its letters, Lorn ties knots on a cord, the Spheres draw round signs, and so on. In a conversation each word appears in the speaker’s script as it is said and turns into your words a moment later, as the translator catches up, without the line jumping about.',
  ] },
  { v: '0.58', date: '2026-10-05', items: [
    'The browser game has an additional Cloudflare hosting target, alongside GitHub Pages.',
    'Conversations across every world now have clearer directions, distinct personalities, and a little more unexpected humour.',
    'Family recordings and the homecoming have been rewritten, giving Lou, Tove, and the traveller more room to speak for themselves.',
    'Temple guides, journal entries, item descriptions, and errands are easier to follow while keeping the worlds mysterious.',
  ] },
  { v: '0.57', date: '2026-10-05', items: [
    'Smoother frame rate everywhere, most of all close to metal, cracked rock and other detailed surfaces; nothing looks different.',
    'No more stutter the first time you walk into a new place or turn to something new: everything is prepared while the world loads, and worlds load faster.',
    'Grassy places no longer waste time redrawing every blade of grass each frame; stepping through a door no longer stalls while the grass appears.',
  ] },
  { v: '0.56', date: '2026-10-05', items: [
    'The settings now have an Updates section in the Android app: see the version you’re playing, check for updates, read what the new one brings, and download it with a progress bar. The game restarts at the title screen with your saves kept.',
    'Updates now arrive reliably: the app checks each time you come back to it, not only when it starts, tries again when the connection drops, and picks up an interrupted download where it stopped.',
    'A downloaded update now starts the next time you open the title screen, without closing the app.',
    'A world that loads slowly no longer undoes an update.',
    'When an update needs a new version of the app, the settings say so and open its download page. This version needs the new app once.',
    'The fluid gun now shoots in a straight line to the crosshair, and the dotted aiming arc is gone.',
    'The gun fires only while you aim: hold LT / L2 (right mouse or R), then press RT / R2 (left click or G).',
    'RT / R2 without aiming fires the jets, as does a left click on a computer. They hover, the left stick flies you any way you point it, and holding jump as well climbs.',
    'On a controller, holding jump in the air opens the wings, and a second press boosts at once.',
    'A / × (the bottom button) jumps off the bird, the hoverbike, the skiff or a taxi with a little hop, and you carry their speed. Hop, flap and rise moved to X / □ (the left button).',
    'Getting off something moving or flying is now a jump off. With the wings they open by themselves, and if you jump off the bird high up with nothing to break the fall, she swoops in and catches you.',
    'You no longer tumble over after a fall of about 10 m; the ragdoll now starts from about 16 m.',
    'A new Motion page (from the character studio or the dev menu): the traveller walking on the blended loops next to motion matching, both driven by the same controls or by scripted runs, in slow motion or frame by frame, with what the matcher plays, its predicted path and the planted feet drawn on the ground, and a row of people on the twelve captured walks.',
    'Answers in conversations no longer have their number or mark drawn over their first letters (it happened on Android handhelds); with a controller, the answer you’re on shows the button that picks it.',
    'People who aren’t part of a quest don’t ask you anything any more: you just listen. They drop a hint about their world, a piece of its wisdom, a joke, or tell you to move along. They say something new each time you talk to them, and have news once you’ve woken the temple or finished the world’s quest.',
  ] },
  { v: '0.55', date: '2026-10-05', items: [
    'The desert story is reworked. Qanat’s great tree went out the night the singing light passed: it now stands cold over the walls, with no flame, no smoke and no glow.',
    'The makers’ backpack comes out of its chest empty. It fills for the first time in the giant’s pool, with cyan, violet and the pool’s coral, and until then it shoots and pushes nothing.',
    'The fallen rib in the giant’s chest is too heavy for your arms: find the old keepers’ pole by the mural and lever the rib off over the carved post.',
    'Back in Qanat, watch the water climb the roots into the well. The tree drinks, and stays cold.',
    'A new errand: Nour sends you for the spark-stone in the Givers’ Hearth, far out in the red rocks. Find Marrow’s hoverbike first, then ride from marked stone to marked stone.',
    'In the Hearth’s dark hall the stone breathes light behind a stone grille. Find what lifts it, climb to it, and carry it home glowing at your side.',
    'Set the stone in the well and the great tree catches again, in the cool colours of the drinking, while the procession sings. Only then will the ship take the jar of living water.',
    'Ember mode can’t light Qanat’s tree. The hoverbike, the masked head and the Givers’ House wait for a filled tank, and Teo’s drum can be freed by hand.',
    'Saves where the water had already risen keep their burning tree and go straight on to the ship.',
    'People in the towns walk their own way: a dozen walks captured from real people (an old man’s short steps, a heavyset roll, a relaxed stroll, a sad, head-down walk), chosen to suit who they are and how fast they go.',
  ] },
  { v: '0.54', date: '2026-10-05', items: [
    'Every world now has a makers’ temple.',
    'The Sealed Hangar’s First Garage: a stair-house on the plateau’s rim with a stopped clock over its door. Ride the escapement, roll the counterweight, wake banks of six eyes in one breath, and set the Clockwork Foreman right. Afterwards the Hangar keeps time again, and the great cogs in the cliff turn.',
    'Viridel’s Builders’ Greenhouse, under a dome of glass north of the white ruins: open flower-doors, grow a vine bridge and a vine up a wall of glass, and calm the Gardener, a moss giant gone bare. Afterwards the white ruins all over the garden are in flower.',
    'The Signal Market’s Undertower, through an old doorway in the back of the silent tower: carry the singing stones’ notes to the doors that listen for them, and give the First Sign its words back. Afterwards the silent tower speaks, once a night.',
    'Bloom mode: a fourth gun mode, leaf green and petal pink in the tank. It makes the makers’ plants grow, and leaves a few flowers wherever it lands.',
    'The echo shell keeps the last note sung near you and plays it back, together with the bell-note whistle if you carry one.',
    'The quick coil now waits inside the First Garage. The keep’s wall holds a new gift, the brass level, which shows how the floor lies when down has turned. If you already had the coil, its chest is open for you.',
  ] },
  { v: '0.53', date: '2026-10-05', items: [
    'The makers’ temples: great buildings in eight worlds, each with rooms of puzzles, a gift found halfway that opens the rest, and a guardian at the end. Living guardians are calmed, never killed; broken machines can be stopped.',
    'The desert’s Givers’ House: the ember mode is found inside; calm the Keeper and the fields round Qanat turn green.',
    'The City-Shaft’s Warden’s Well: the fluid jets are found inside; stop the robot warden and the shaft’s breath becomes an updraft.',
    'Vael’s Aerie: wait out the gusts, glide the gulf, ride the wind well, and fly beside the Elder until she flies again. The fluid wings are found inside now; afterwards great birds circle overhead.',
    'Vael II’s Founders’ Belfry: the bell-note whistle is found inside; calm the Cloud-Mother and the fallen-up stones come down.',
    'The Buried Machine’s Engine-House: a fourth tank chamber inside; stop the Tooth-Warden and the pipe-cart runs again.',
    'The Garden of Spheres’ Footprint: the glyph lens inside; calm the Echo and the Footprint fills with water, the spheres ringed with light.',
    'Lorn’s Hush-House on the cave island: sing its crystals low to high, still the jaws and the pendulums, and calm the Mother Snapper. The stilling mode is found inside now; afterwards every snapping plant wears a ring of flowers.',
    'Lorn II’s Lamp-House: the lantern charm inside; calm the Lampless and the lamp’s beam turns over the wood again.',
    'Half the gifts are in the temples now, half out in the worlds; new gifts in the open include the breathing reed (twice the breath under water) and the wind-silk scarf (the wings sink slower). Gifts you already own leave their temple chests open.',
    'People sitting on benches, ledges and steps no longer have capes sticking out like wings: the cloth falls down their back, over the edge of the seat and onto the ground.',
  ] },
  { v: '0.52', date: '2026-10-05', items: [
    'People’s faces are drawn the way Moebius draws them: flat colour with one clean shadow, a crisp eyelid line, a nose drawn as one line ending in a hook at the nostril, a mouth with small ticks at its corners, curled ears, and only a few fine strokes of hatching in the eye sockets and under the cheekbones.',
    'Eyebrows are single tapered strokes, and eyes have a ringed iris with a small pupil.',
    'Children and young people have young faces: Lou’s is drawn with just her eyes, a tiny nose, a soft mouth and a few freckles, and the traveller keeps a clean young face, while older people keep their lines.',
    'Faces keep their lines a steady width on screen and simplify with distance, so people across the street stay clean instead of turning into scribbles.',
    'The Lab has a gallery of giant faces: twelve towering villagers, each with a different face and expression, and a walkway that brings you eye to eye with them.',
    'Character studio: a close-up view, a lineup of a face from every world, and a faces sheet you can save.',
    'The traveller’s feet stay planted: no more skating at a jog or a run, and boots no longer sink into slopes or stairs.',
    'Starting off you lean into the stride, braking you lean back; turning, you bank into the curve and your head leads the way.',
    'Stopping mid-stride ends with a small settling step; turning on the spot, the feet step round instead of spinning in place; a sharp turn at a run is a plant-and-pivot.',
    'Stairs: the feet land on the steps, the body rides them smoothly, and standing on a flight one foot rests a step lower.',
    'People walk their own way: stride, bounce, posture and pace vary with build and age, and nobody marches in step with their neighbour. Near you they turn toward you with steps, their feet planted.',
    'Far-off people use simpler bodies and less frequent animation, which makes busy streets cheaper to draw.',
  ] },
  { v: '0.51', date: '2026-10-05', items: [
    'Viridel: help Esk water her tea terraces. You’ll do your best, and it won’t be enough. What happens stays happened.',
    'Quests can now fail: the sketchbook files them under “Failed”, and your father’s charge remembers what you could not mend.',
    'Teo’s drum is pinned under the ribcage by a knuckle of bone: shove it from the side and the drum rolls out like a wheel.',
    'The sleeping mask’s eyes are drifted shut with sand: wash both clear before the wind fills them again, and it looks at you.',
    'City-Shaft: Pip’s ration tin hangs in an old goods hoist over the void. Shoot out its rusted pin and push the weight round to swing it in.',
    'Vael II: Ondine answers Ysolde’s letter with the tower’s signal lamp. Light it, turn it to the carved bell, and watch the cliff answer. The bell’s clapper lies under roof tiles that fell up with it: shove them off.',
    'Buried Machine: Dun’s key hangs from a crane swung out over the drop. Free its rusted collar, then push the jib round click by click.',
    'Lorn II: Pim’s door still sticks with moss: wake the moss lamp over it, then push it shut. And Fen asks you to bring his skiff home: light his berth lamp and nudge it in.',
    'Viridel: the brass gear from the Hangar goes on Mira’s water clock. Fit it, then fill the leaking bowl fast enough to ring the bell.',
    'Story fixes: every world now remembers the singing light the same way, the night your ship was struck, climbing away. Ilen’s message is thirty years old. Odile and Talo’s journey is told one way everywhere. People who share a name are no longer mixed up in the credits.',
    'Your parents’ later recordings now remember your daughter, quietly.',
    'At your parents’ stone, if Esk’s tea terraces in Viridel came down, the traveller says so. Aunt Tove’s words about your parents and Lou are a little warmer.',
    'The Signal Market: Oyo kept one lantern back from the night the sky rang. Ask him for it and its little sun goes into your tank as a new yellow-green band.',
    'Home is on the ship’s map once the last recording on the reel has played; the sketchbook says when a recording is waiting at the console and keeps counting the worlds you finish after six.',
    'Small story fixes: in Vael, Hollin hands over the feather with his hands and two words; in Vael II, Sister Aube explains the sky stones floated long before the bell stopped; in the City-Shaft, Nima explains the Lodestar has faded all her life and has been going out since the night the sky rang.',
  ] },
  { v: '0.50', date: '2026-10-05', items: [
    'Home is bigger: walk into your parents’ round house, dark and still with its memories, and into your own small house across the yard, warm and lit.',
    'Your daughter Lou lives in the small house with Aunt Tove. She runs to meet you every time you come home and wants to know what you brought, and her drawings of every world you wrote to her from are on the wall.',
    'Moustache the dog follows you everywhere, barks at the bird and the drone, and loves to be petted.',
    'A little garden in the front yard: vegetable beds, a bench, and flowers you can pick.',
    'Pay your respects at your parents’ stone: kneel, lay a flower or what you have found since, and stay a moment.',
    'At the ending Lou comes to the stone with you and leaves a drawing of her own.',
    'Lou looks like a real seven-year-old: a big head, short arms and legs, a round young face, two buns, quick little steps, and she can’t keep still.',
    'The washing, the bunting, the flag and the curtains are real cloth now: they blow in the wind and move aside when you walk into them.',
  ] },
  { v: '0.49', date: '2026-10-05', items: [
    'Water has a new hand-drawn look in every world: pale shallows over deeper colour, foam where it meets the shore and the rocks, ripples that drift with the wind, the sky in the far water, and the sun glittering on it.',
    'Ripples ring out round anything that touches the water, from you, creatures and vehicles to splashes.',
    'You can swim: wade into any lake, pool or swamp channel and you float once it’s deep. Sprint for a front crawl.',
    'Dive and swim where you look under water, and come up for air before your breath bubbles run out.',
    'Climb out by swimming into a low ledge; higher walls can be climbed straight from the water.',
    'Jumping or falling into deep water no longer hurts, however high you jump from.',
    'Under water the world turns blue-green and the sound goes muffled; splashes and strokes have their own sounds.',
    'The hoverbike skims across water everywhere, and getting off over deep water drops you in for a swim.',
    'In Lorn and the Garden of Spheres, deep water no longer sends you back to the shore.',
    'The Lab has a swimming pool with a beach, a deep end and a diving tower.',
    'Distant buildings, rocks, plants and crowds are drawn with simpler shapes wherever the difference is too small to see, so wide views cost less, most of all on the Handheld setting.',
    'The ship’s smoke, flame and dust no longer cost anything while there are none.',
  ] },
  { v: '0.48', date: '2026-10-05', items: [
    'The traveller looks their age now: a younger, warmer face with a few freckles, and a tousled fringe under the helmet.',
    'The enamel star from the makers’ boxes sits on the helmet liner, inside the glass, instead of poking out through the top.',
    'People have real hair instead of a round cap: a hairline at the brow, round the ears and at the nape, even under their hats. Beards follow the jaw, up the cheeks to the sideburns.',
    'Every world’s people wear their own hairstyles: braids and curls in the desert, swept hair and bobs on the City-Shaft’s rim, tonsures at the bell monastery, crests and twin buns among the mechanics, long loose hair in the garden, locks in the swamp.',
    'On the recordings, your father has his short brown hair and beard, and your mother her long dark hair down.',
    'Faces speak with their words: people look happy, sad, angry or surprised as they say a line, their mouths move with each syllable, and their faces relax when they have finished.',
    'The traveller’s face answers too: it follows what they say, and in a conversation they look the other person in the eye. The villager whose speech balloon is up near you says it with their face as well.',
    'The night lantern now rides with the tank into the hoverbike’s socket instead of floating beside your back.',
  ] },
  { v: '0.47', date: '2026-10-05', items: [
    'Metal now looks like metal: chrome, steel, brass, copper, iron and painted metal reflect the sky and the ground in flat bands and catch the sun in a crisp highlight. You’ll see it on the ship, the hoverbike, the taxi, your backpack, the Hangar’s machines, the listening stones, the bell and the market’s brass.',
    'Lights glow: lamps, crystals, signal lamps, portals and the makers’ mark have a bright core and a printed halo that spills their colour onto what’s nearby, strongest at night.',
    'At dusk, windows in the towns light up one by one.',
    'The makers’ marks are now carved inscriptions: friezes of their signs and framed seals cut into Qanat’s gate, the giant’s door, the standing stones, the observatory and the Builders’ ruins. Ordinary walls are left plain.',
    'Real grass: blades sway in the wind and part around your feet in Viridel, the Garden of Spheres, home and Lorn’s mosses (fewer on the Handheld and Low settings).',
    'The grass is lush and green: wider blades in several shades of the ground’s green, drawn with soft green outlines instead of black ones, with only a few tufts inked by hand.',
    'The scout drone is redesigned: a little round pod with one big eye that folds shut on your back and blooms open into four spinning vanes when it flies.',
    'When you ping it, the drone hops off your back, unfolds and spins up; coming home it folds up on the way in and settles back in place, on top of the radio pack or clamped to the tank’s side rail.',
    'While you glide, the drone hops up onto the tank’s cap, out of the way of the fluid wings. In flight it stays level and leans into its speed; its lit beak still points where you’re going.',
  ] },
  { v: '0.46', date: '2026-10-05', items: [
    'The ship’s floor is flat now: walking the deck no longer lifts you over doorways or up onto stools, the bench or the bed.',
    'The ship’s doorway no longer flickers as the camera moves.',
    'The crashed ship in the desert now sits upright in the sand, so its floor is level.',
    'The reactor column is gone from the middle of the ship: a small holo table stands there, showing the planet you’re on (in the opening, the one below you).',
    'The ship’s main room is smaller and cosier, sized for one pilot.',
    'The ship feels lived in: lockers, a galley with a stove and sink, a pantry covered in notes, crates strapped down, instrument racks by the window, cables overhead, plants, and a jacket thrown over the desk chair.',
    'The recordings of your parents now appear as holograms in their own colours, not a blue glow: head and shoulders over the projector’s lens, faint scanlines and a soft flicker, fading out below the chest.',
    'Your father now has a full, trimmed beard; your mother has her long dark hair down, a teal scarf and a lilac top.',
    'Your parents turn to face you while the recording plays: they nod as they speak, glance at each other, and look up at you over the stone at home.',
    'The camera moves in on their faces while the hologram is up and pulls back once it fades.',
    'A character studio: try on bodies, outfits, faces and expressions for every person of every world, drawn exactly as the game draws them. Open it from the title screen, under Debug.',
    'New hairstyles for the people (a short crop, shaved, bald, curls, a braid, long hair down) that follow the shape of the head instead of sitting on it like a bowl. For now they are in the character studio.',
    'Faces can now show feeling: smiles and frowns, an open mouth, raised or knitted brows, narrowed eyes. For now they are in the character studio.',
  ] },
  { v: '0.45', date: '2026-10-05', items: [
    'The ship now has a reason for its route: whatever struck it left a magnetic signature in the scar on the hull, and the ship flies only to worlds that carry the same signature.',
    'The galactic map marks every signature world with the glyph, shows its reading, and explains the signature beside the chart.',
    'The ship mentions the signature after the crash, the first time the map opens, and on first arrival at each world; newly charted worlds say it reads there too.',
    'A few people across the worlds now notice the strange pull the light left on compasses and metal.',
    'Odile and Talo’s names are now right on the saucer’s console and on Talo’s note.',
    'The roots and branches of Qanat’s burning tree are solid now: up close, from the terraces, the stairs or while climbing, you see bark, never the inside.',
    'The giant’s arm in the dunes and the ribs and roots in the cave under it are solid too.',
    'Taxi drivers and passengers are the size of people again, not giants twice your height.',
    'A taxi you call comes empty, and the seat is yours. Cabs with a passenger aboard turn off their “for hire” lamps, and a free cab answers your call first.',
    'The bazaar’s taxis are as big as the City-Shaft’s, so you fit under the awning.',
    '“Bring back something of value”, your father’s last words on the recording, is now the main quest of the journey. As the dust settles after the crash it appears as a title card with its own music.',
    'The sketchbook opens with your father’s charge pinned at the top: his words, how many worlds you have seen, and every keepsake you carry.',
    'Your father’s charge has its own gold ✦ tag on the objective line. It shows when nothing else is asked of you, and for a moment each time you earn a keepsake.',
    'Conversations are easier to follow: never more than three answers at once, usually one or two. Follow-up questions now come after the first answer instead of all at once.',
    'The glowing screens in the City-Shaft, the Signal Market and the Sealed Hangar are now the makers’ listening stones: carved stones with a brass rim and three lenses. They wake with glyphs in the makers’ manner instead of English words.',
  ] },
  { v: '0.44', date: '2026-10-04', items: [
    'The traveller is a real person again: normal proportions and a natural stance, in a baggy lavender suit with salmon gloves and boots, the bubble helmet sitting right round their head, headphones on their ears, a scarf, a belt of pouches and the radio pack strapped on their back.',
    'Before you find the fluid backpack, the traveller carries the old radio pack with its long antenna, and the scout drone rides on top of it.',
    'Conversations keep a clear view: the camera finds a spot with no wall, tree, rock or passer-by in the way, even in narrow streets, the ship and Viridel’s cabin.',
    'Looking at something now shows it over your shoulder, and the traveller turns to face it (and to whoever they talk to).',
    'Fewer things clip: trees no longer grow through houses, crowds don’t stand inside walls, boxes sit flat on ledges and stones, and capes and your bracer no longer pass through bodies.',
    'On handhelds, the picture lowers its resolution as soon as frames start to hitch, rather than staying put while the game stutters every few frames.',
    'Sun shadows close to you update a little less often on the Handheld setting, which takes a big load off the Retroid and phones.',
    'The City-Shaft draws its trees more efficiently: the same trees, less work for your device.',
    'You can walk on the desert city’s domed roofs: the domes, the tower bulbs and the flat roofs hold you up instead of letting you sink inside them.',
    'Other people’s chatter balloons no longer cover the dialogue choices while you’re talking to someone.',
    'Calling your mount (the hoverbike, the bird) or hailing a taxi now comes with a whistle.',
  ] },
  { v: '0.43', date: '2026-10-04', items: [
    'People no longer shake or spin when you walk into them or talk to them up close: they turn to you and hold still, and crowd folk step round you instead of jittering on the spot.',
    'Capes hang properly on people seen from afar instead of floating where they were, and no longer drop into place as you come near.',
    'Fall from too high and you tumble over limp, lie a moment and get back up; falls hurt much less now. Only a really long fall (about 36 m or more) is fatal, and the game then asks you to Restart from where you last stood (Enter, A / ×, or a tap).',
    'A close push from your fluid gun knocks people right off their feet; they pick themselves up and glare at you.',
    'In the desert city, the first makers’ box now waits on a little wooden ledge up the burning tree’s trunk, out in the open where you can see it from the stairs: climb the big root to reach it. Qanat gathers at the tree’s foot to watch, and Nour waits there for you to come down.',
    'Your feet no longer sink into the terraces around the burning tree, and climbing the trunk puts your hands on the bark.',
    'The cave in the giant’s chest is dry until you push the fallen rib off the channel; then the stream runs down and the pool fills before your eyes.',
    'People’s eyes are no longer black: everyone has eye whites, an iris of their own colour (brown, hazel, green, grey or blue) and a pupil, their eyes follow you when you talk to them, and they blink, in the crowds too. The traveller’s eyes match.',
    'For testing: a Debug entry on the title screen and in the Start menu opens the worlds list, and in the Lab [ and ] (L3 and R3 on a pad) hop from one world’s room to the next without walking to the doors.',
    'The Lab (in the worlds list, L) has a door for every world: step through to a little copy of each one, with its own ground, sky and light, rocks and buildings, plants, creatures and people in their own clothes. Each room has a door home behind you, and wandering off its edge brings you back to it.',
    'Plants part round you as you walk through them, leaning away from your legs, more when you hurry.',
    'The title screen is calmer: the name in thin, airy capitals, no subtitle or key hints, and the menu as light lettering over the view.',
    'Plants feel the wind: they lean downwind, gusts roll across the meadows as a wave, and a storm bends them hard.',
    'The traveller is rebuilt on the same body and skeleton as everyone else, with the suit, helmet and pack on top: walking, climbing, gliding, aiming and riding no longer bend joints the wrong way.',
    'People now come in all heights and builds, slim to broad to heavy, men and women alike: long hair, buns and beards, and the same face in the crowd every time you visit.',
    'Every world now grows its own plants: flowers, cushions and tufts in clumps, with a few large plants among them, from desert candelabras to Viridel’s giant parasol leaves. They keep clear of paths, people, boxes and where the ship lands.',
    'The large plants are solid: you bump into them and can climb them. Handhelds grow a lighter garden to stay smooth.',
    'In the Garden of Spheres every great sphere rings its own note when you shoot it, bigger ones lower. Splash the three that remember to wake them, then splash the pole on the plaza and it plays them back as a little tune.',
    'When the great wheel in the Buried Machine turns, the sand slides off it into a long hollow, and it keeps on turning.',
    'The jets no longer push you out through the floor of the Sealed Hangar’s ring. If you ever get caught outside it, or wedged in mid-air anywhere, you’re put back where you last stood.',
    'The hoverbike isn’t yours from the start any more: Marrow the salvager has hidden one under a tarp in a hollow near the camps. Ask him (or Rook) about it, pull back the tarp and wake it with your backpack. If you were already riding it, you keep it.',
    'The hoverbike and Lorn’s skiff are redrawn: a long-nosed bike with a fluttering pennant and a rudder that turns with you, and an open boat with a curled prow, a swinging lantern and a striped sail that fills as you go.',
    'The flying taxis are redrawn: round cabs with a checker band, a driver up front, a striped awning over your seat, and a “for hire” light that blinks while the cab waits for you.',
  ] },
  { v: '0.42', date: '2026-10-04', items: [
    'A title screen greets you when the game opens: continue where you left off, choose a save, or change the settings.',
    'Three save slots: each shows its world, how far you’ve come, the time played and when you last played. Start a new game in an empty slot, or delete a save after a confirmation. Your current progress is kept in the first slot.',
    'Start and Select now open full-screen menus that pause the game, with their own calm music over the hushed world. Quit to title is in the Start menu, and restarting from the prologue only starts over the save you’re playing.',
    'Places to go, the next thing to do and the hints that solve a puzzle now stand out in colour in conversations, in every world, far more often than before. Speech balloons show these highlights too, instead of stray stars.',
    'The title screen is a live view of the land above the clouds: stone tables and needle spires rise out of a golden-hour sea of cloud while the camera drifts slowly past. Devices that can’t draw it keep the drawn backdrop.',
    'There are no calls home any more: after each world you play an old recording of your parents at the cockpit console, and they appear in front of you as a hologram over the dash. You always face them as it plays.',
    'The recordings don’t always fit where you’ve been, and little by little they show how old they are: date stamps, a worn tape, a child’s voice in the background.',
    'Home is different now: the house is quiet, and in the yard is your parents’ stone. You set everything you collected on it, one piece at a time, before one last recording plays. The ending closes with an end card and credits that list what you left on the stone.',
  ] },
  { v: '0.41', date: '2026-10-04', items: [
    'Arriving on a new world now starts in space: the planet grows ahead in its own colours, the ship dives into the air in a burst of fire, then falls through the sky to land.',
    'The ship’s engines fire from the thrusters under the hull and blow dust out along the ground. The hatch pops out and slides up the hull, and the ramp slides out, tips down and telescopes to the ground.',
    'The camera inside the ship no longer clips through walls and bunks: in tight spots it rises and looks down over your shoulder, and it no longer jumps about as you walk. You can’t walk up the curved walls any more.',
    'The desert sand is redrawn: fine grains and wind ripples close up, long wind lines sweeping over the dunes further out, fading smoothly into the sand colour instead of popping in as you walk or drive.',
    'The cracked salt flats are drawn as crisp cracks that hold up in the distance, with small crust cracks close by, and fade into an even tone far away instead of turning fuzzy.',
    'Buildings no longer flicker as the camera moves: walls, windows, striped walls and window grids stay steady at a distance.',
    'People in the distance keep their colours with a fine outline instead of turning into dark shapes, especially on handhelds.',
    'Your bed in the ship is a proper bed now, not a bunk: a wide, unmade bed with a headboard and two pillows.',
    'Inside the ship the camera is at your height, close over your shoulder and looking level, instead of up under the ceiling pointing at the floor, and you can tilt it freely with the mouse or the stick.',
    'The burning tree in Qanat is now one great 3D flame: red, orange and white-gold tongues lick up and sway around the crown, glowing from within. The planet seen through the window during the crash keeps its pattern instead of swimming.',
    'The burning tree’s flame swallows all of its branches, runs at a slower, steady pace at any distance, and burns you if you climb into it. Cactus spines prick you and push you off if you brush or climb them.',
  ] },
  { v: '0.40', date: '2026-10-04', items: [
    'The galactic map asks “Travel to …?” before the ship takes off, with Yes and No on keyboard, mouse, touch and controller.',
    'The galactic map is simpler: worlds are small drawn planets instead of pictures, and the info panel no longer covers their names on any screen.',
    'Worlds open up as you go: you start with a choice of two, and each world you finish adds the next to the ship’s map (and to the worlds list).',
    'The stone gates are gone, and walking off the edge of a world no longer takes you to another: the ship is how you travel now.',
    'Controller buttons now work by position on every pad. On a Retroid: B jumps, A talks and gets on, Y calls your mount or a taxi, X pings, L2 aims, R2 shoots, R1 pushes, and you click the left stick to run.',
    'Riding on a controller: R2 is the throttle and L2 brakes, and the stick steers. On the bird and the taxi the stick also tips you up and down.',
    'Select opens your gear, every item and what it does; Start opens the settings. In menus, A confirms and B goes back. The “Swap A/B” setting is now “Controller buttons”, for pads whose letters sit somewhere else.',
    'Conversations are calmer: no button hints or “translating” tag, and the speaker’s name now sits clearly at the top of the panel.',
    'Portraits in conversations show just the person against a plain colour that suits their world.',
    'Fewer things on screen: no more lists of button reminders, only a short prompt when you’re next to something, and with a controller (like a Retroid Pocket) no touch buttons at all. Button prompts now use small round badges.',
    'Fixed: a world’s closing page could open over your last conversation and stay stuck on screen; it now waits until the conversation ends and closes with the next press.',
    'Nothing in the game is named after a Moebius work any more: the great light above the City-Shaft is the Lodestar, Arzach is now Vael, Edena is Viridel, Perdide is Lorn, the Airtight Garage is the Sealed Hangar, and their people have new names too (Major Brask, Clemence, Odile and Talo). The worlds list shows each world’s own tagline instead of a credit. Your saves carry over.',
    'The game is now called Memento: on the title screen, in the menus, as the app’s name on Android and the Steam Deck, and on the web. Your saves and settings carry over.',
  ] },
  { v: '0.39', date: '2026-10-04', items: [
    'The backpack’s charges now come back two seconds after you last used them (for the jets, two seconds after you land), instead of five.',
    'Animals are bigger and easier to spot.',
    'The hoverbike and the skiff no longer swerve when the stick drifts a little as you drive forward: small pushes turn gently, a full turn needs the stick well over.',
    'The “Updated to …” and “Update ready” notes show once, not again on every world you visit. The worlds list has smaller pictures.',
    'Ask Bako, the ney player by the desert fire, to play, and he does: a slow, eerie tune over a low drone, while the rest of the camp falls quiet.',
    'The makers’ boxes are nearly twice as big, so you notice them. Opening one is new: it wakes, lifts off the ground turning slowly, and comes apart into light from the top down, leaving the item hovering where it stood. Once opened, a box is gone.',
    'The scout drone no longer sinks into the backpack’s tank when it rests on your back: it clings to the side, lens out.',
    'The scout drone (ping) keeps your pace whether you walk, ride or fly: it leads a little ahead towards the goal instead of falling behind, points at it (up and down too) with a lit beak, and leaves a glowing trail so you don’t lose it.',
    'Landing on a new world is no longer silent: the sound starts with the world in the Android app, and you hear the engines, the roar of the descent and the touchdown. (In a browser it starts with your first key or click.)',
    'In the open you can now look almost straight up at the sky.',
    'The door to the crashed ship on Edena is now a hatch in its hull, under an arch of flowers, instead of a doorway standing a few metres away.',
    'It no longer rains indoors: rooms, the crashed ship’s cabin and your own ship stay dry, and the rain becomes a muffled drumming on the roof.',
    'Ringing the bell in Arzach no longer swings its rope through the tower. Perdide’s tooth flowers have an inside you can’t see through.',
    'Arzach’s stone hand now tells you what it wants when you look at it: its quest starts, it shows the feather caught in its fingers, and it says to shoot the knuckles in the right order, which Hollin knows.',
    'In the City-Shaft the jets’ box no longer waits beside the ship: it sits on top of a lone makers’ pillar on the rim, a climb away.',
    'The City-Shaft’s rim is easier to see across: its olive trees hold their crowns high on tall trunks, and the grove by the ship is lighter, so the people among them stand out.',
    'In the sketchbook, finished quests are plain to see: they move under “Completed” with a green ✓ Complete stamp and how they ended, below the ones still under way.',
    'Every world’s hidden makers’ box now has its own quest: a few seconds after you land it appears in your sketchbook with where to look, tracking it sends the scout there, and opening the box finishes it.',
    'A health bar, and falls hurt: a long drop takes a share of it, a very long one knocks you out and you come round where you last stood. It refills after a few quiet seconds, and only shows while you are hurt.',
    'Walking through the portals in the Airtight Garage is smooth: a quick fade into the portal’s light and you walk out the other side at your own pace, the view already upright, instead of a hard cut. Fixed a portal sometimes throwing you back to the one you entered.',
    'For testing: the worlds list (L) opens every world, whatever you have found, including a Lab world that shows every surface the game draws side by side, with four giant villagers to study faces by.',
  ] },
  { v: '0.38', date: '2026-10-04', items: [
    'Villagers keep the same little walks on every visit, and no longer wander onto steep banks.',
    'Steadier sun shadows: building and cliff shadows no longer shimmer or crawl as you walk and turn, and their edges are softer.',
    'Faster drawing on every world: the game skips what you can’t see, and the shadows of things that can’t reach the screen. A new Handheld graphics setting is chosen automatically on Android, and the frame readout (F) now shows frame time, draw calls and resolution in the top right.',
    'The settings now say plainly whether you have the newest game: “Up to date (build 16)”, “Build 17 available, downloading…”, or “downloaded: restart to play it”. This needs the new app once; accept the app update when it is offered.',
  ] },
  { v: '0.37', date: '2026-10-04', items: [
    'The Android app now updates the game by itself: when you are online it downloads the newest game in the background and uses it from the next launch (or right away with “restart now” in the settings). No new APK needed. If an update ever fails to start, the app goes back to the game it shipped with. Your saves are kept either way.',
    'People on every world now dress like it: pilgrim robes and straw hats in the desert, beaked monks’ cowls in Arzach, antenna helmets and overalls in the Garage, reed capes in Perdide, turbans and patterned coats in the Signal Market. The City-Shaft’s rim and bottom dress apart.',
    'The camera comes in close over your shoulder in the ship, caves and narrow alleys. The walk to the cockpit is yours, at your own pace. Subtitles, hints and messages no longer overlap.',
    'Swap A/B in the settings, for handhelds whose confirm button is on the other side. The prompts follow.',
    'Leaving the app pauses the game and its sound, and coming back restores fullscreen. On a handheld the sound now starts with the first button press.',
  ] },
  { v: '0.36', date: '2026-10-04', items: [
    'The backpack now waits in Qanat. After the crash, follow the smoke to the city: in a shrine by the dry well stands a makers’ box that has not opened in living memory. Opening it brings the villagers and Nour, the eldest, who sends you on the rest of your search for power.',
    'Every item box is now an artifact of the makers, the people of the three-dot glyph, left for whoever comes a long way. People in each world have their own name for them.',
    'The Retroid Pocket’s built-in sticks and buttons now work, and every prompt uses its button names (A, B, X, Y, L1, R1, L2, R2, Select, Start). This also fixes being stuck after the crash on Android.',
    'Everyone now speaks: every line has a mumbled alien voice in its own world’s tongue, with a tone that fits it (happy, sad, angry, whispered…). Your translator turns it into words as you read. Voice volume and an alien voices toggle are in the settings.',
    'With a controller, the button list now shows for a few seconds and then fades (it stays in menus), and the status box no longer stretches across the screen on handhelds.',
    'The Android app updates itself from GitHub releases: when a newer build is out, it offers to install it and keeps your progress.',
    'Fixed a gap between the ship’s floor and its ramp that you could fall through. The burning tree’s smoke is one soft continuous trail, and the wind is quieter.',
  ] },
  { v: '0.35', date: '2026-10-04', items: [
    'You start without the backpack. It was thrown out in the crash: find its box near the ship. Item boxes glow and shudder as you come near; open one to kneel over it while light pours out and the item rises in front of you.',
    'Boxes in every world hold new things: fluid jets in the City-Shaft, fluid wings in Arzach II, stilling and ember modes for the wrist nozzle, a fourth chamber, a quick coil, a lantern charm, a glyph lens, a bell-note whistle and a pale star.',
    'Everything runs on the backpack. The jets burn its fluid, the wings bloom out of it, and X switches between shoot, stilling (freezes) and ember (lights lamps and fires, burns brambles). Vehicles need it too: you slot the tank into the hoverbike or skiff to ride.',
    'The ship now crashes facing Qanat, so the city stands on the horizon when you step out. A long trail of smoke rises from the burning tree, visible across the whole desert.',
    'A developer menu (the ` key): toggle every item, open or reset boxes, jump to any world.',
    'An Android version: install the APK from the GitHub release page and play offline.',
  ] },
  { v: '0.34', date: '2026-10-04', items: [
    'Calls home now react to what you found and who you met. After the Signal Market, ask about Ilen.',
    'After six worlds, your parents ask you home. Choose one keepsake to bring, land at the house under two moons, and see how they take it. Credits list everyone you met. You can keep exploring afterwards.',
    'The bird remembers her promise: whistle in a world with open sky and she comes.',
  ] },
  { v: '0.33', date: '2026-10-04', items: [
    'Every world now has a story. Each one has people to talk to, a main quest that ends in a keepsake, and two side quests. Each also holds a clue about the singing light that struck your ship.',
    'Ring the monastery bell to settle the cloud in Arzach II. Make the Great Crystal sing in Perdide. Watch the buried wheel turn one tooth, and relight the lamps in the deep wood.',
    'Edena and Perdide II reveal that you were not the first. In the City-Shaft the Incal brightens when someone finally looks up, and the Signal Market’s silent tower plays a voice you know.',
    'The ship’s scorch mark now matches the symbol seen in every world.',
  ] },
  { v: '0.32', date: '2026-10-04', items: [
    'A new game opens aboard the traveller’s round ship. You wake in your bunk, take a call from your father, and then something strikes the ship and it crash-lands in the desert.',
    'The magic-fluid backpack: a lava-lamp tank of shifting colours feeds a hose to your wrist. Shoot, push, and boost-jump share three charges, and all three refill five seconds after the last use.',
    'Talk to people with E. Conversations have choices, and many people have stories, rumours or a favour to ask. Quests show on screen, in the journal, and when you ping.',
    'The desert story “The Tree That Drinks”. Find the pilgrims’ camps, walk with the procession, and explore Qanat, the old city around a burning tree. Then go down into the giant’s chest, where the colour-shifting water lies, and bring power back to the ship.',
    'Once the ship has power, its cockpit opens a galactic map for travelling between worlds. A call home waits after each world you finish.',
  ] },
  { v: '0.31', date: '2026-10-03', items: [
    'Wildlife in every world: two or three species each, with a surprise when scared. A lizard balloons up and floats away, a kite unfolds from the bones, a tortoise raises its shell into a little temple, and more.',
    'A non-lethal tool: hold right mouse (or R) to aim and click to fire. The paralyze ray freezes creatures and people for a moment. Foam darts wake flowers and machines, turn lenses, ring the gate and hail taxis from afar. X switches modes.',
    'The cities are crowded now: hundreds of people talking in small groups, strolling, leaning on rails and sitting on edges. They make room when you walk through, and turn to look.',
    'The desert dunes are smoother, so the hoverbike stays on the sand. New landmarks: a half-buried leviathan, a crashed ship with a salvage camp, a rose gorge with bridges, an umbrella grove, a petal station, salt lagoons and a radio-dish array.',
    'Fixes: fast movement no longer passes into buildings, the scout drone flies smoothly over terrain, climbing knees bend the right way, and hover trails stay above the ground.',
  ] },
  { v: '0.30', date: '2026-10-03', items: [
    'Arzach II: The Sky Stones. Ride the bird over a sea of cloud past needle forests, balanced stones, giant mushroom tables, cliff-top monasteries and aqueducts, then cross the peach plain to the lone tower.',
    'The Buried Machine. Domes and pipes surface from pale dunes. Below them lie a rust canyon of machinery, giant ring windows and the oculus, all under a city hanging upside down from the sky.',
    'The Garden of Spheres. Umbrella trees, white pyramids, great pale spheres, a mirror lake and a cypress avenue leading to a round stone plaza.',
    'Perdide II: The Deep Wood. A violet swamp of pale mushrooms, glowing eggs and root arches, lit by pools of light, leads to the cave where the skiff waits.',
  ] },
  { v: '0.29', date: '2026-10-03', items: [
    'The traveller face is drawn like a Moebius portrait, with tapered pen lines: almond eyelids with dark pupils, light brows, a single nose line, a lower-lip stroke, and fine hatching along the shadow edge. The face now has one clean shadow shape and a lighter skin tone, matching the reference.',
    'The suit no longer uses a painted texture. It now uses flat printed colours from the reference art. The shader draws its shadows and folds: chevrons at the elbows and knees, gathered cuffs, pulls at the hips and armpits, and the front zip.',
    'The boots, gloves, pack and headphones use the same reference palette. The character file is less than half its previous size.',
  ] },
  { v: '0.28', date: '2026-10-03', items: [
    'The traveller face now uses animated shader ink: blinking eyes, subtle gaze and breathing, plus adjustable smile and brows. No face image texture is needed.',
    'Smoother movement starts, quicker braking, and stable foot contacts that cannot repeatedly replant during one support stroke.',
    'Climbing limbs lift away from the wall when reaching. Ledge climbs ease into position and release each hand before standing.',
  ] },
  { v: '0.27', date: '2026-10-03', items: [
    'Desert sand now uses broad flat colors and sparse wind-shaped ink strokes. Removed the ground dots and round color flecks; thinned the scrub to leave open dunes like the reference art.',
    'Rebuilt the traveller’s gloves with thumbs and individual finger shapes, pink boots with soles and straps, and a cream radio backpack with vents, a display and pouches.',
    'Smoothed skin weights around elbows, knees and hips. Corrected the gloves’ thumb placement so thumbs point inward on climbing walls. The refined face and clear helmet are preserved. Equipment details share materials to keep drawing costs down.',
  ] },
  { v: '0.26', date: '2026-10-03', items: [
    'Refined the traveller’s face from the character reference: a longer forehead, tapered jaw, sculpted nose, small inked eyes and mouth, and a grey liner behind the head.',
    'Facial features now sit on the surface and remain readable through the bubble helmet. The existing body rig and walking/running corrections are preserved.',
  ] },
  { v: '0.25', date: '2026-10-03', items: [
    'Fixed the imported traveller’s wrist mapping: hands now follow the animation’s finger direction and palm rotation instead of twisting sideways from the different resting pose.',
    'Climbing also uses the actual hand-bone direction. Walk, jog and run now have full-cycle checks for limb direction, wrist twist, boot pitch and seamless looping.',
  ] },
  { v: '0.24', date: '2026-10-03', items: [
    'Your illustrated traveller is now playable in every world: lavender coveralls, orange gloves, pink boots, blue headphones, a clear bubble helmet and the textured radio backpack.',
    'The new skeleton follows the existing running, climbing, gliding and vehicle animations, with planted feet and wall contact for the hands and boots. The scout still launches from the backpack.',
  ] },
  { v: '0.23', date: '2026-10-03', items: [
    'Fixed iPhone scrolling in the world picker and other menus. Gameplay now captures swipes only on the canvas, leaving menu scrolling to the browser.',
  ] },
  { v: '0.22', date: '2026-10-03', items: [
    'The world notices you: reactive scenery across all eight worlds responds to proximity and attention, then settles when you leave. Nearby objects answer in a delayed wave.',
    'Salt blooms open and release spores in the desert; Edena flowers turn pink and unfold; shy Perdide fungi close and glow. Pale fronds listen in Arzach and the Atelier.',
    'City and Garage terminals wake with messages. Signal Market storefronts and selected existing billboards respond as you pass. Returning visitors and encounters from other worlds leave a remembered signal.',
    'Reactions respect walls, pause in menus and photo mode, and use bounded spore effects. The Garage reactions follow local gravity, including the upside-down quarter and ring.',
  ] },
  { v: '0.21', date: '2026-10-03', items: [
    'Desert birds now have bodies, heads, beaks, fan tails and feathered wings. They circle closer at a smaller scale, with bounded distance scaling to keep their silhouettes natural.',
    'The Arzach riding bird has a curved neck, hooked beak, eyes, talons and a feathered tail. Layered flight feathers replace the old flat wing panels.',
    'Shoulders and wrists articulate through the wingbeat; wings fold along the back on landing, legs tuck in flight and the tail responds to banking. Feathers are batched within each joint for rendering.',
  ] },
  { v: '0.20', date: '2026-10-03', items: [
    'New world: The Signal Market. A street-level city of coral and teal towers, illustrated billboards, awnings, lanterns, cables and four walkable skybridges, inspired by your city reference sheets.',
    'Meet the market crowd and lavender inhabitants, hail flying taxis, or take the cab parked near the entrance. Climb or jetpack to the broadcast balcony to find The Last Broadcast.',
    'Five new relics, a city soundtrack and sketchbook entries. Choose world 7 in the picker; the journey now continues from Perdide through the market and back to the desert.',
  ] },
  { v: '0.19', date: '2026-10-03', items: [
    'Controller support: analog movement and camera, jumping, climbing, gliding, vehicles, interaction and scout ping. Hold RT/R2 to run or boost; LB/RB zoom the camera.',
    'Navigate settings, worlds, story pages and the sketchbook with your controller. Photo mode supports flying, altitude and saving pictures. Button hints appear when you use a controller.',
    'Stick deadzones prevent drift. Disconnecting releases controls, and menu confirmation cannot carry a held jump into gameplay.',
  ] },
  { v: '0.18', date: '2026-10-03', items: [
    'More natural running and climbing cadence. Climbing hands hold their place during the support stroke; palms face the wall and boots point toward it. Wrists follow the animation.',
    'Ping lasts five seconds, then the scout returns to the backpack.',
    'The hoverbike arrives faster and parks close enough to board. If blocked or still approaching after four seconds, it recalls to a clear spot nearby.',
    'Inspired by the new reference sheets: softer lavender coveralls, a cream radio pack, a turquoise mineral basin, a suspension bridge and vast dish canopies over the desert village. Fewer scattered rocks leave the dunes more open.',
  ] },
  { v: '0.17', date: '2026-10-03', items: [
    'Press Q or tap ping to launch a tiny scout from your backpack. It flies ahead toward your next objective, waits nearby and returns home.',
    'The scout follows your progress: traveler, observatory ledges, unfinished lenses, story objectives, relics and gates. Doorways and gravity portals are included.',
    'Clearer small characters: thinner silhouettes, lighter shadows and less clothing detail at a distance, so the lavender suit stays readable on phones.',
  ] },
  { v: '0.16', date: '2026-10-03', items: [
    'Install on iPhone from Safari: Share → Add to Home Screen. Launch from the Moebius icon to play without browser bars, with controls clear of the notch and home indicator.',
    'The Sleeping Observatory: meet the traveler beside desert camp, follow their sketch east, climb six resting ledges and align three lenses to unfold the roof and reveal a constellation.',
    'Lens positions, discoveries and the awakened observatory are saved in the sketchbook. Return to the traveler for new dialogue.',
    'Smoother outlines at every graphics setting. Mobile Auto now favours a clear image at 30 fps, starts at full resolution and stops reducing resolution at 0.75×.',
    'Lighter, more widely spaced sky dots, with less ink at low resolution. Comic pages fit narrow phone screens.',
  ] },
  { v: '0.15', date: '2026-10-03', items: [
    'A new hero after your reference: a baggy lavender suit with creases, salmon gloves, a glass bubble helmet over a blue headset, a radio pack with a whip antenna, cables, a pouch belt and a handheld device. No cape.',
    'Real climbing animation (Quaternius mocap): up, down, sideways and a hanging idle, with the hands and feet pressed onto the wall. The ledge climb is mocap too.',
    'Standing still a while, the hero sometimes looks around properly.',
    'Footprints take the colour of whatever they\'re on, as a darker print in the surface.',
    'The hoverbike drives over to you when you whistle, instead of appearing.',
    'Whistle for the bird in mid-air and it swoops in and catches you.',
    'The paraglider is in fixed colour cells (no more pulsing stripes), and folds away when you mount.',
  ] },
  { v: '0.14', date: '2026-10-03', items: [
    'Speech balloons sit over the speaker\'s head and stay put as the camera moves.',
    'The paraglider\'s lines run into the rider\'s hands, gripping the brake handles; pull one to turn.',
    'The outfit is in flat blocks of colour, like a printed plate.',
    'A shorter cape, and the rider carries a lot of little things: belt pouches, a canteen, a lantern, bells, a bandolier of charms, a bedroll with a pot, and a walking stick with a pennant. The hanging ones swing as you move.',
    'A proper standing pose: the weight settles on one leg, then shifts, with breathing, a hand on the belt and the odd glance around.',
    'The hoverbike is about 25% slower (34 m/s, 54 m/s boosted).',
    'Arzach: warm peach sand under an aqua sky, rose shadows, mushroom rocks and balanced stones.',
    'Edena: a ligne-claire look (thin lines, flat colour, little hatching) and an android garden of spheres, cones and diamonds.',
    'Perdide: giant glowing fungus trees and reeds along the waterlines.',
    'The Garage: pipes with valves and pumps, aerials, cabins and cables all over Grubert\'s plateau.',
    'This changelog (N).',
  ] },
  { v: '0.13', date: '2026-10-03', items: [
    'Drawn textures: windows with shutters on the city houses, tiled roofs, leaves on the trees, cracks in the rocks.',
    'City houses get arched doors, balconies and chimneys; umbrella pines join the cypresses.',
    'Broken pen strokes on interior lines, and a heavier outline round the rider.',
    'Distant layers go paler and greyer (aerial perspective); marks are finer near the camera.',
    'A robe under the cape.',
    'Errands: villagers ask you to carry things to someone in the next world.',
    'Walk, ride or glide off the edge of a world into the neighbouring one.',
    'Auto quality: the resolution adapts to keep the frame rate up, with a low-detail mode for phones.',
    'Villa floors no longer flicker against the ground.',
  ] },
  { v: '0.12', date: '2026-10-03', items: [
    'Walk-in interiors: city villas, the masked head\'s chamber, Edena\'s ship cabin.',
    'A paraglider with momentum, banking turns, dives and flares.',
    'A soundtrack per world, with its own lead instrument, melody and ambience.',
    'A blue-to-purple cape and a purple hat.',
  ] },
  { v: '0.11', date: '2026-10-03', items: [
    'The city-shaft rebuilt as a Moebius hill-town: terraces, terracotta roofs, cypresses and olives, viaducts and a megastructure overhead.',
    'Street life: a crowd, market stalls, laundry lines, passengers in the taxis.',
    'Faster city: collision built in the background, culling per terrace, distance detail.',
  ] },
  { v: '0.10', date: '2026-10-02', items: [
    'Faster walking, and feet that follow the slope.',
    'A faster hoverbike with two glowing, colour-shifting jet trails.',
    'A heavier cape that barely lifts in the wind.',
    'An FPS counter (F).',
  ] },
  { v: '0.9', date: '2026-10-02', items: [
    'The "Moebius print" look: flat dotted skies, a cumulus bank, dotted sand, scrub, blue-grey shadows.',
    'Climbing with hands and feet on real holds, and mantling over ledges.',
    'A steadier camera you can drop low to look at the sky.',
  ] },
  { v: '0.8', date: '2026-10-02', items: [
    'Varied villagers, a settings menu, touch controls, continue where you left off, and an ending.',
  ] },
  { v: '0.7', date: '2026-10-02', items: [
    'A real human rider with motion-captured walking and running, in slim Moebius proportions with an inked face.',
    'The cape collides with the whole body; the jetpack leans forward and holds twice the fuel.',
  ] },
  { v: '0.6', date: '2026-10-02', items: [
    'A cloth cape, planted feet, a story thread per world, villagers, relics, gates between worlds, sound and weather.',
  ] },
  { v: '0.5', date: '2026-10-02', items: [
    'A slender, Arzach-style rider with a real run cycle.',
  ] },
  { v: '0.4', date: '2026-10-01', items: [
    'Beauty pass: inked line weights, antialiasing, form-following hatching, skies, birds and life, photo mode.',
    'Published on GitHub Pages; Sable-like thin outlines by default.',
  ] },
  { v: '0.3', date: '2026-10-01', items: [
    'Four new worlds (Arzach, the Garage, Edena, Perdide) and a world picker (L).',
  ] },
  { v: '0.2', date: '2026-10-01', items: [
    'The L\'Incal city-shaft with a jetpack and rideable taxis; you can stand on everything.',
  ] },
  { v: '0.1', date: '2026-10-01', items: [
    'The first desert: inked edges, two-tone shading, hatching that sticks to surfaces, dunes, the hoverbike.',
  ] },
];

export const VERSION = CHANGELOG[0].v;
const SEEN_KEY = 'hiraeth.changelog.seen';
/** A line's words: the line itself, or the text of a line written with its pictures. */
export const lineText = (item) => (typeof item === 'string' ? item : item.text);
/** A version's lines as they are shown, newest first: lines are added at the end of their version (CLAUDE.md), read from the top. */
export const newestFirst = (entry) => [...entry.items].reverse();
/** The interactive changelog, its pictures and numbers: the page beside the game, in a frame over it. */
export const PICTURES_PAGE = 'changelog.html';

export class Changelog {
  constructor({ onOpen, onBeforeRestart } = {}) {
    const el = (this.el = document.createElement('div'));
    // the page's Refresh may restart the game into a newer build (src/changelog-refresh.js): save it first
    window.changelogBeforeRestart = () => onBeforeRestart?.();
    el.id = 'changelog';
    el.innerHTML = `<div class="panel"><h1>WHAT'S NEW <span>v${VERSION}</span></h1><div class="list">${
      CHANGELOG.map((r) => `<section><h2>v${r.v} <span>${r.date}</span></h2><ul>${newestFirst(r).map((i) => `<li>${lineText(i)}</li>`).join('')}</ul></section>`).join('')
    }</div><div class="buttons"><button data-a="pictures">See what changed</button><button data-a="close">Close (N)</button></div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      if (e.target.dataset?.a === 'pictures') this.pictures(true);
      else if (e.target === el || e.target.dataset?.a === 'close') this.toggle(false);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyN') this.toggle();
      else if (e.code === 'Escape' && this.open) { e.stopImmediatePropagation(); if (this.framed) this.pictures(false); else this.toggle(false); }
    });
    // the page asks to be closed (its Close, B / ○, Escape, N): back to the list
    window.addEventListener('message', (e) => { if (e.origin === location.origin && e.data?.hiraeth === 'changelog-close') this.pictures(false); });
    this.onOpen = onOpen;
    let seen = null;
    seen = store.get(SEEN_KEY);
    this.fresh = seen !== VERSION;      // updated since your last visit
  }

  /** This version's notes count as seen: the "Updated to …" toast shows once, not on every world. */
  markSeen() {
    store.set(SEEN_KEY, VERSION);
    this.fresh = false;
  }

  /** The interactive changelog over the game (the game's own page, so it works offline; its pictures come from the site). */
  pictures(on) {
    if (on && !this.frame) {
      const f = (this.frame = document.createElement('iframe'));
      f.className = 'pictures'; f.title = 'What changed, with pictures';
      f.src = `${PICTURES_PAGE}?embed=1`;
      this.el.appendChild(f);
      f.addEventListener('load', () => f.contentWindow?.focus());
    } else if (this.frame) this.frame.hidden = !on;
    if (on) this.frame.contentWindow?.focus();
    else this.el.querySelector('[data-a="pictures"]')?.focus();
    this.el.classList.toggle('framed', !!on);
  }

  get framed() { return !!this.frame && !this.frame.hidden && this.open; }

  /** A controller press while the page is up goes to it (main.js); false when it isn't up. */
  pad(name, ...args) {
    if (!this.framed) return false;
    const page = this.frame.contentWindow?.changelogPad;
    if (page) page(name, ...args);
    else if (name === 'back') this.pictures(false);
    return true;
  }

  toggle(on = !this.open) {
    if (!on && this.frame) this.pictures(false);
    this.open = on;
    if (on) { document.exitPointerLock?.(); this.onOpen?.(); this.markSeen(); }
    // its button carries the way out for the hands on the game: N, a controller's back button (src/pad-glyphs.js), a tap
    const b = on && this.el.querySelector('[data-a="close"]');
    if (b) b.innerHTML = `${glyph('back', { key: 'N' })}Close`;
    this.el.classList.toggle('open', on);
  }
}
