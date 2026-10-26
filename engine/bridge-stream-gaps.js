// Sequence and picture parity contracts, independent of source-audit paths.
export const STATUSES = ['handled', 'web-only', 'gap'];

/**
 * The sequences' differences (issue #429, engine/sequences.js): what a beat's state shows on the web and not in the
 * engines' bundle, or the other way, that is known. Each { seq, beat (globs, default '*'), keys (globs of compareBeat's
 * keys: 'part-:lock', 'obj+:ink', 'menu.rows'…), status (STATUSES), and its issue (a gap), why (web only) or where
 * (handled) }. tests/sequences.test.js fails on a difference none of them names, and on an entry that names nothing.
 */
export const STREAM_DIFFS = [
  // ---- known gaps (the first run, 2026-10-16: scripts/unity-compare/sequences.mjs)
  { seq: 'menus', beat: 'start|settings', keys: ['menu.rows'], what: 'the Settings page\'s Language row; and the page\'s rows it hides until they apply (the jets\' and the pirates\' pitch, the developer panel), which its probe reads all the same', status: 'web-only', why: 'no localisation for now: the engines are in English only; the rest is the page\'s rows in its groups and order, the hidden ones shown as there once they apply (engine/menus.js SETTINGS_ROWS `when`, issue #264)' },
  // ---- web only
  { seq: 'menus|house-map|start-pages', beat: 'start|settings|map|controls', keys: ['menu.side'], what: 'the Start menu\'s "Debug: worlds"', status: 'web-only', why: 'a developer\'s entry on the page (the worlds picker); the engines\' debug saves are on the title' },
  { seq: 'start-pages', beat: 'controls', keys: ['menu.rows'], what: 'the Controls page\'s list for a touch screen (Move · look, Jump · use…), and its headings, Reset rows and the Run / Guard choices, which the page draws as headings and buttons its probe does not read as rows', status: 'web-only', why: 'the engines are played with a pad or keys, never a touch screen; the rest is the probe\'s reading: the engines\' page has the same sections (engine/menus.js startPageRows controls, issue #264)' },
  { seq: 'start-pages', beat: 'news', keys: ['menu.rows'], what: 'What\'s new\'s prompts in its lines: the page writes the letters of the pad it last saw ("press A"), the node VM the house form ("A / ×")', status: 'handled', where: 'the same lines; each side rewrites their prompts for its pad (src/native-pad.js promptText; Unity: setEnginePad, Xbox letters on the Xbox and the Deck, the Retroid\'s own)' },
  // ---- handled
  { seq: '*', keys: ['obj-:planet'], what: 'the sky\'s planets', status: 'handled', where: 'sent as the look\'s data, not meshes (engine/game.js fullLook planets; Unity draws them in its sky)' },
];

/**
 * What the sequences' pictures show differently in Unity (issue #429: scripts/unity-compare/sequences.mjs, its sheets),
 * the most visible first; what the state stream can't see (a shader's look, the sky, a pass). Each { seq, beat, what,
 * issue, visible (3 seen at once … 1 barely), status 'handled' + where once fixed }. Written by hand from the sheets;
 * docs/systems/bridge-gaps.md lists them.
 */
export const PICTURE_DIFFS = [
  // ---- known gaps
  { seq: 'fight', beat: 'cut|hit', what: 'the blade is a thin grey sword in Unity, not the page\'s blue fluid blade (src/blade-shader.js: materials\' BLADE_FLUID)', issue: 264, visible: 3,
    status: 'handled', where: 'Surface.shader HIRAETH_FIGHT, BladeSurface.hlsl (scripts/unity-export/blade-hlsl.mjs): its turquoise currents, cream streaks and edge, smeared through a cut as the page\'s' },
  { seq: 'fight|foes', beat: 'chimes*', what: 'a dropped chime\'s shade a white disc in Unity, the page\'s a soft violet patch (chimes.js blobMaterial); the crystal itself not yet seen in a Unity picture', issue: 264,
    status: 'handled', where: 'Hiraeth/ChimeShade (port-format.js chimeshade, issue #264 surfaces E); the foes sequence\'s chimes-rest beat shows the crystals at rest and their shade as the page\'s (CrystalSurface.hlsl)' },
  { seq: 'talk|moment-arzach2.bell|moment-edena.terraces', beat: 'beside|start|mid', what: 'people\'s barks, the speech balloons over their heads ("A visitor! On a bird!", "Shut it! Shut it!"), not drawn in Unity', issue: 264, visible: 2 },
  { seq: 'moment-perdide.crystal', what: 'the hearts and wallet show over the crystal\'s moment in Unity (the screen\'s health part up; none on the page or in node)', issue: 264,
    status: 'handled', where: 'src/foes.js: held still by a scene, nothing is fighting you (Foes.update kept `fighting` at its last value: a toad chasing as the moment began kept the hearts up); now gone from the mid beat on, the first beat still fading (wireHealth\'s 3 s)' },
  { seq: 'moment-perdide.crystal', what: 'a bellows toad and a walker in Unity\'s shot of the cave, hiding him; none in the page\'s. Not the wilds\' pack (#538: the staging begins a few frames after the world, packRest 8 s): the guards of the relic 2.6 m from where the staging puts him (foes.perdide.r0), risen in the staging\'s two frames; the page and the bundle in node read that spot as tame (a person within the wilds\' distance), Unity\'s run as wild. Not the people\'s LOD (-js-off people: the same)', issue: 538, visible: 2 },
  // ---- handled (#264, 2026-10-17: scripts/unity-compare/sequences.mjs, before and after sheets on the issue)
  { seq: 'moment-edena.terraces', beat: 'start', what: 'the far white tower and the slope before it in a cloud\'s shadow in Unity, lit on the page', issue: 264, status: 'handled',
    where: 'engine/game.js takes the world\'s own cloud shadows (level.defaults.cloudShadows, as main.js): most worlds have none, Unity drew them everywhere (Lorn all in shade)' },
  { seq: 'moment-bazaar.broadcast', beat: 'mid|late', what: 'the broadcast\'s moment turned black in Unity from four seconds in', issue: 264, status: 'handled',
    where: 'Bloom.shader Extract leaves out a pixel that is not a number: one on the white signs (glow 0.8) spread over the whole glow buffer' },
  { seq: 'menus|house-map', beat: 'map', what: 'the Map page\'s drawn ground missing in Unity (its marks on a plain sheet)', issue: 264, status: 'handled',
    where: 'engine/game.js mapSource puts what is in a shop\'s or a temple\'s room at its door (main.js mapAt): those rooms framed the map kilometres wide and lifted its rays over the ground' },
  { seq: 'fight', beat: 'hit|death', what: 'a struck foe stayed white and glowing in Unity (its death a white flash, not its ink burst)', issue: 264, status: 'handled',
    where: 'engine/mirror.js calls an object\'s onAfterRender after reading its material: a foe\'s flash (foe-react.js installFlash) is given back' },
  { seq: 'takeoff', beat: 'away', what: 'the take-off\'s warp disc see-through grey with no world\'s name in Unity, opaque with THE DESERT on the page', issue: 264, status: 'handled',
    where: 'the page\'s picture was ahead: its CSS fades ran on the wall\'s clock in slow headless Chrome; sequences.mjs runs them on the game\'s, and both now show the disc opening' },
  { seq: 'moment-arzach2.bell|moment-perdide2.pools', beat: 'late', what: 'his face close up with ink blotches on the chin and neck, a darker skin; dark drips down Vael\'s walls', issue: 264, status: 'handled',
    where: 'engine/traveller-paint.js portraitPaint (the portrait head\'s paint as wearPortraitHeadFace leaves it) and the old collar in skin (b3NeckSkin); Marks.hlsl weatherInk the web\'s hairline cracks (the grime and chips were older)' },
  { seq: 'moment-edena.terraces', beat: 'start', what: 'the builders\' wall without its carved glyphs in Unity', issue: 264, status: 'handled', where: 'Marks.hlsl glyphCarve, the web\'s inscriptions (src/glyphs.js)' },
  { seq: 'box', what: 'a dark band round his shirt at the waist in Unity, close up', issue: 264, status: 'handled', where: 'engine/traveller-paint.js fillUnfound: the overshirt\'s cut vertices take their neighbours\' colour, not black' },
  { seq: 'fight-temple|game-*', beat: 'count', what: 'the count\'s numeral larger in Unity', issue: 264, status: 'handled', where: 'BridgeHud.cs the 3-2-1 at 84 (GO at 72): the condensed face stands taller than the page\'s Futura' },
  { seq: 'temple', what: 'the key counter a "KEY ×0" box in Unity, the page\'s a key glyph', issue: 264, status: 'handled', where: 'BridgeHud.cs KeyGlyph: the page\'s KEY_SVG and GREAT_KEY_SVG drawn, ×N beside them' },
  { seq: 'menus', what: 'the buttons\' names written as words in Unity\'s menus ("LB/RB turn · A choose · B close"), the page\'s glyphs in its buttons', issue: 517, status: 'handled',
    where: 'BridgeMenu.Glyphs.cs: the page\'s .glyph for the pad in hand (engine/menus.js glyphLabels, src/pad-glyphs.js padGlyphs), in the title\'s and the Start menu\'s entries, the side tabs, the strip, the way out, the shop, and the prompt line (hintParts)' },
  { seq: 'mark', what: 'a sign of Unity\'s own ("⁖⌒") where the page draws the makers\' mark in a line', issue: 513, status: 'handled',
    where: 'BridgeHud.Mark.cs: the shared mark filled from its contours (the dialogue\'s and a balloon\'s `mark`, src/makers-mark/shape.js) in a gap the words leave' },
];
