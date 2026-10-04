// What's new, version by version (newest first). Shown in the game with N or
// from the settings menu; after an update a note points you to it once.
// Add an entry at the top for every release.

export const CHANGELOG = [
  { v: '0.38', date: '2026-10-04', items: [
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
const SEEN_KEY = 'moebius.changelog.seen';

export class Changelog {
  constructor({ onOpen } = {}) {
    const el = (this.el = document.createElement('div'));
    el.id = 'changelog';
    el.innerHTML = `<div class="panel"><h1>WHAT'S NEW <span>v${VERSION}</span></h1><div class="list">${
      CHANGELOG.map((r) => `<section><h2>v${r.v} <span>${r.date}</span></h2><ul>${r.items.map((i) => `<li>${i}</li>`).join('')}</ul></section>`).join('')
    }</div><div class="buttons"><button data-a="close">Close (N)</button></div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { if (e.target === el || e.target.dataset?.a === 'close') this.toggle(false); });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyN') this.toggle();
      else if (e.code === 'Escape' && this.open) { e.stopImmediatePropagation(); this.toggle(false); }
    });
    this.onOpen = onOpen;
    let seen = null;
    try { seen = localStorage.getItem(SEEN_KEY); } catch { /* ignore */ }
    this.fresh = seen !== VERSION;      // updated since your last visit
  }

  toggle(on = !this.open) {
    this.open = on;
    if (on) { document.exitPointerLock?.(); this.onOpen?.(); try { localStorage.setItem(SEEN_KEY, VERSION); } catch { /* ignore */ } this.fresh = false; }
    this.el.classList.toggle('open', on);
  }
}
