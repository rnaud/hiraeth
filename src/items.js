import { keyText } from './prompt-keys.js';
import { game } from './game-state.js';

// The traveller's items: what they have found (in boxes, through quests) and
// can use. He starts with nothing in his hands (v1.44): the fluid sword and the shield's guard (src/fluid-blade.js) are
// found in the Rose House, the desert's temple (`sword`, `shield`; src/temples/desert.js). The magic-fluid
// backpack holds the fluid: without it there is no double jump, no glider, no jetpack, no gun
// (the glove drinks from it) and vehicles cannot be powered.
//
//   import { items } from './items.js';
//   items.has('jetpack')                  // owned?
//   items.grant('jetpack')                // found it (persists; emits 'item' { id, def })
//   items.revoke('jetpack')               // (dev menu)
//   items.on((id, owned) => …)            // any change; returns an unsubscribe function
//   ITEMS.jetpack.name / .text / .kind    // for the items page and the dev menu (text: the one description)
//   itemLine(ITEMS.jetpack)               // the box-opening card's one line: what it does (issue #329)
//
// Stored as game flags `item.<id>` = true. Systems read items.has() every
// frame (cheap), so a grant takes effect at once.
//
// Kinds: core (the backpack), movement (its strengths: the lift valve's double jump, the wings, the
// Warden's bellows, `wardenbellows` (not the pocket bellows, a charm): BACKPACK_STAGES; the jets anywhere, `jetpack`, are a debug item), mode (gun modes, MODE_ITEMS), gadget (src/gadgets/: the fluid gun is one), and the
// (the mastery trials' rewards, `trial: '<world>'`: upgrades to the gadgets, won not found: src/trials/)
// boxes' special items: upgrade (the tank), charm, cosmetic; and pass (`quest: true`: someone
// gives it at the end of a quest, not a box: the City-Shaft's cab pass). Most items come
// out of item boxes (src/boxes/), the makers' chests, left for a traveller who
// comes a long way (docs/story-bible.md, "The boxes"): the box-opening card
// shows its name and one description, `text`: what it is and what it does together, a line or two (issue #165:
// at most 180 letters, its buttons as {key:verb}; tests/item-cards.test.js).

export const ITEMS = {
  // the fluid sword and the shield's guard (v1.44: found in the Rose House; before, his from the start). Without
  // them the blade button and the guard do nothing, and neither is drawn on him (main.js: tool.swordOn, tool.shieldOn)
  sword: {
    name: 'Givers’ blade', kind: 'weapon', where: 'In the Rose House, the great stone drum in the dunes east of Qanat: on the dais under the sword chamber’s oculus.',
    text: 'A worn brass hilt that grows a blade of fluid. {key:blade} cuts, three in a row; hold it for a sweeping cut. It clears thorns and wakes the makers’ eyes.',
  },
  shield: {
    name: 'Givers’ guard', kind: 'weapon', where: 'In the Rose House: in the Watcher’s Hall, over the Hall of Fires’ bridge, where the Givers’ watcher stands.',
    text: 'A brass flower on your forearm that opens into living fluid. Hold {key:guard}: it takes a blow from in front, turns one back if raised in time, and sends a bolt back.',
  },
  backpack: {
    name: 'Magic-fluid backpack', kind: 'core',
    text: 'A makers’ glass sphere for living water, built for a traveller they would never meet. It holds your magic bar, powers vehicles and feeds the glove.',
  },
  doublejump: {
    name: 'Lift valve', kind: 'movement', needs: 'backpack',
    text: 'A brass valve on the backpack’s ring that lets one breath of fluid out under your boots: press {key:jump} again in the air for a second jump.',
  },
  // (a gadget, src/gadgets/gun.js registers it with its model; here too so node's tests and the save know it without the registry)
  gun: {
    // (it comes with ember mode, `with`: one chest for the gun and its two modes, issue #83)
    name: 'Fluid gun', kind: 'gadget', needs: 'backpack', with: ['fire'], where: 'In the Givers’ Hearth, the desert’s old fire-house, in the Givers’ room off the hall.',
    text: 'The makers’ glove, fed by the backpack. Aim with {key:aim} and push with {key:fire}; {key:mode} turns it to ember, which lights lamps, braziers and fuses, or to a shot of fluid.',
    does: 'Aim with {key:aim} and push with {key:fire}; {key:mode} turns it to ember, which lights fires, or to a shot.',
  },
  // the jets anywhere: too powerful for the worlds (the author, 2026-10-10), so a debug item since v1.38, given only by the
  // debug menus (the world debug menu's toggle, the dev menu): no box, shop or quest holds it, and old saves lose it
  // (src/save-migrate.js step 9). The City-Shaft's own, the Warden's harness, went too in v1.42: its air pillars
  // carry the wings (src/shaft-pillars.js)
  jetpack: {
    name: 'Fluid jets (debug)', kind: 'movement', needs: 'backpack', debug: true, where: 'Only from the debug menus (L3 + R3, F2: Toggles).',
    text: 'Debug only: nozzles that turn the fluid into thrust in any world. Hold {key:jump} in the air to fire them, {key:move} steers, {key:aim} holds you still.',
  },
  // the backpack's third strength (v1.42: the City-Shaft's air pillars carry the wings, so the Warden's harness, the
  // City-Shaft's own jets, went: src/save-migrate.js step 11 turns a save's harness into these)
  wardenbellows: {
    name: 'Warden’s bellows', kind: 'movement', needs: 'backpack',
    text: 'Bellows under the tank that breathe wind down while your wings are open: you climb faster in rising air, and a makers’ vane you hover over turns.',
    where: 'In the makers’ court on Lorn’s dry ground east of the landing.',
  },
  glider: {
    name: 'Fluid wings', kind: 'movement', needs: 'backpack',
    text: 'Folded membranes that open into bright wings. Hold {key:jump} while falling to glide; a column of rising air carries you straight up.',
  },
  stun: {
    name: 'Stilling mode', kind: 'mode', needs: 'gun',
    text: 'A glyph-cut lens that chills the fluid. In stilling mode ({key:mode}), a burst freezes creatures and people for a few seconds.',
  },
  fire: {
    name: 'Ember mode', kind: 'mode', needs: 'gun', where: 'It comes with the fluid gun, in the Givers’ Hearth.',
    text: 'A flint ring for the glove. In ember mode ({key:mode}), a burst lights lamps, braziers and fuses, and burns dry brambles away.',
  },
  bloom: {
    name: 'Bloom mode', kind: 'mode', needs: 'gun',
    text: 'A green glass seed with a root curled inside. In bloom mode ({key:mode}), a burst wakes the makers’ plants: seeds sprout, doorways open, vines bridge gaps.',
  },
  // the Moon Foundry's Casting-House (src/temples/moonfoundry.js): the push takes hold of the founders' iron moons
  tongs: {
    name: 'Founders’ tongs', kind: 'upgrade', needs: 'gun',
    text: 'Black iron tongs shrunk to the glove’s cuff. Your push takes hold of iron now: the Moon Foundry’s cast moons, too heavy for a plain push, roll for it.',
  },
  // the City Floating in Space's Mooring-House (src/temples/spacecity.js): a gun mode that pulls
  tether: {
    name: 'Tether mode', kind: 'mode', needs: 'gun',
    text: 'A coil of pale cord that lives in the glove. In tether mode ({key:mode}), a shot pulls toward you: stone balls, the moorers’ rings, loose things.',
  },
  // the Underwater City's Whale-House (src/temples/underwater.js): the whales' deep note
  // (retired by issue #377: the Whale-House's chest holds the spring boots, whose stomp booms the deep note; kept for the saves
  // that found it, it still sounds the note)
  horn: {
    name: 'Whale-horn', kind: 'charm', retired: true, where: 'The Whale-House’s chest, before the spring boots were put in it.',
    text: 'A curled shell horn with one deep note, the whales’ own. Sound it with {key:whistle}: the makers’ listening ears answer, and so do the whales.',
  },
  // ---- special items, found in boxes across the worlds (src/boxes/placements.js; effects in src/boxes/effects.js)
  cell: {
    name: 'Fourth chamber', kind: 'upgrade', needs: 'backpack',
    text: 'An extra glass chamber for the tank: your magic bar grows by a third, four shots in a row instead of three.',
  },
  coil: {
    name: 'Quick coil', kind: 'upgrade', needs: 'backpack',
    text: 'A copper coil, still warm after centuries in a box. Your magic bar starts refilling sooner after a shot and fills twice as fast.',
  },
  lantern: {
    name: 'Lantern charm', kind: 'charm',
    text: 'A thumb-sized paper lantern on red string. After dusk it glows and lights the ground around you.',
  },
  lens: {
    name: 'Glyph lens', kind: 'charm',
    text: 'A cloudy lens marked with the glyph. Unopened chests show from far away, a pale column of light rising from each.',
  },
  bell: {
    name: 'Bell-note whistle', kind: 'charm',
    text: 'A blue clay whistle shaped like a bell. Sound it with {key:whistle} and the unopened chests nearby chime back from where they hide.',
  },
  soles: {
    name: 'Soft-fall soles', kind: 'charm',
    text: 'Thin soles with a glyph under each heel. Hard landings hurt less: you can drop much further before a fall knocks you over.',
  },
  hush: {
    name: 'Hush-cloth', kind: 'charm',
    text: 'Soft grey cloth for your boots. Creatures don’t hear you coming: they notice you only up close.',
  },
  shell: {
    name: 'Listening shell', kind: 'charm',
    text: 'A small white shell. Every little while, the unopened chests near you hum back, softly, from where they hide.',
  },
  moss: {
    name: 'Glow-moss pin', kind: 'charm',
    text: 'A sprig of glowing moss under a glass bead. After dusk it lights the ground round your feet, a little.',
  },
  pouch: {
    name: 'Seed pouch', kind: 'charm',
    text: 'A linen pouch of seeds that never empties. Small flowers come up in your footsteps and fade a while after.',
  },
  scarf: {
    name: 'Wind-silk scarf', kind: 'charm',
    text: 'A fine white scarf any breeze can lift. Your fluid wings sink more slowly when you glide.',
  },
  reed: {
    name: 'Breathing reed', kind: 'charm',
    text: 'A crystal-tipped reed to hold in your teeth: you hold your breath twice as long under water.',
  },
  resin: {
    name: 'Climber’s resin', kind: 'charm',
    text: 'Soft amber resin for your palms. Climbing tires you half as fast: you hang on twice as long.',
  },
  echo: {
    name: 'Echo shell', kind: 'charm',
    text: 'A brass shell that keeps the last note sung near you, a singing stone’s or a machine’s. Play it back with {key:whistle}: what listens for it answers.',
  },
  level: {
    name: 'Brass level', kind: 'charm',
    text: 'A brass spirit level, somebody’s initials scratched on its side. Where down has moved, it shows how the floor lies.',
  },
  // the three worlds that joined the route in v1.40: one gift each in the open (src/temples/index.js GADGETS)
  pearl: {
    name: 'Diver’s pearl', kind: 'charm',
    text: 'A cold grey pearl on a cord, worn by the drowned city’s divers on the long walks through the tubes. Running tires you a third less.',
  },
  bellows: {
    name: 'Pocket bellows', kind: 'charm',
    text: 'A purse-sized bellows the founders kept at the belt to blow on their hands. Your stamina comes back twice as fast when you rest.',
  },
  starthread: {
    name: 'Star-thread', kind: 'charm',
    text: 'A twist of pale thread the moorers tied on for luck on the long climbs. You climb a third faster.',
  },
  // the makers' courts of the three worlds of v1.40 (v1.48, issue #101: src/finds/courts.js): each behind its court's
  // gate, a charm for the gadget the court is for (one found worlds before): src/trials/upgrades.js CHARM_TUNES
  floatbead: {
    name: 'Float-bead', kind: 'charm',
    text: 'A bead of the divers’ bubble-glass for the wand. The bubble wand lifts what it holds half as high again: 10 m instead of 7.',
  },
  keeper: {
    name: 'Founders’ keeper', kind: 'charm',
    text: 'A bar of soft iron the founders laid across their magnets at night. The magnet glove pulls you to fixed metal a third faster.',
  },
  splice: {
    name: 'Moorer’s splice', kind: 'charm',
    text: 'A splice of the moorers’ cable, its strands still humming. The grappling hook reels you in a third faster.',
  },
  // (issue #169) the City-Shaft's light that goes down: in the makers' chest the mirrors' sun reaches on the bottom terrace
  // (src/boxes/placements.js incal.sunglass), a little more for the bridge pen, the shaft's gadget (src/trials/upgrades.js CHARM_TUNES)
  sunglass: {
    name: 'Lamplighter’s glass', kind: 'charm',
    text: 'A palm-sized mirror of the lamplighters’, still warm from the sun. Bridges drawn with the bridge pen stand half as long again before they fade.',
  },
  // ---- won in the worlds' mastery trials (src/trials/: the first finish of each), upgrades to the gadgets
  dunefins: {
    name: 'Dune fins', kind: 'upgrade', trial: 'desert', where: 'The first finish of the Dune line, the Desert’s hoverbike run.',
    text: 'Two brass fins for the hoverbike’s skirt; the sand slips past them. Its top speed is 42 m/s instead of 34.',
    does: 'The hoverbike’s top speed is 42 m/s instead of 34.',
  },
  clearglass: {
    name: 'Clear glass', kind: 'upgrade', needs: 'monocle', trial: 'spheres', where: 'The first finish of the Garden round, the Garden of Spheres’ run on foot.',
    text: 'A second lens for the monocle, ground thinner than a fingernail. The seeing lens clouds over half as fast.',
  },
  longline: {
    name: 'Long line', kind: 'upgrade', needs: 'hook', trial: 'arzach', where: 'The first finish of the Wind ladder, Vael’s wing run.',
    text: 'A spool of the makers’ grey cord, finer than hair and stronger than rope. The grappling hook reaches 34 m instead of 25.',
  },
  fourthcoil: {
    name: 'Fourth coil', kind: 'upgrade', needs: 'springs', trial: 'underwater', where: 'The first finish of the Tube run, the Underwater City’s run through its halls.',
    text: 'A spare spring for each boot, wound tighter than the rest. It hums when it is happy. The spring boots bounce four times in a chain instead of three.',
    does: 'The spring boots bounce four times in a chain instead of three.',
  },
  widevane: {
    name: 'Wide vane', kind: 'upgrade', needs: 'fan', trial: 'spacecity', where: 'The first finish of the Courier’s round, the City Floating in Space’s run over its bridges.',
    text: 'Two more paper ribs for the fan, painted with reeds. The gust fan lifts you five times in the air before you land instead of three.',
  },
  fourthnotch: {
    name: 'Fourth notch', kind: 'upgrade', needs: 'boomerang', trial: 'glassdunes', where: 'The first finish of the Glass slalom, the Glass Dunes’ run on the wings.',
    text: 'A fourth notch cut in the boomerang’s elbow by a careful hand. It locks on to four things instead of three.',
    does: 'The boomerang locks on to four things instead of three.',
  },
  longbreath: {
    name: 'Long breath', kind: 'upgrade', needs: 'bubble', trial: 'edena', where: 'The first finish of the Eye garden, Viridel’s game of eyes.',
    text: 'A drop of the meadow’s sap for the wand’s ring. Bubbles last half as long again before they pop.',
  },
  deepwell: {
    name: 'Deep well', kind: 'upgrade', needs: 'bridge', trial: 'incal', where: 'The first finish of the Shaft climb, the City-Shaft’s jet route.',
    text: 'A deeper ink well for the bridge pen, with a glass window: you can see the ink think. Half as much ink again: longer bridges, more of them.',
  },
  lodestone: {
    name: 'Strong lodestone', kind: 'upgrade', needs: 'magnet', trial: 'moonfoundry', where: 'The first finish of the Floor round, the Moon Foundry’s run on foot.',
    text: 'A darker lodestone dug from under the Glass Dunes’ kilns; spoons follow you about. The magnet glove reaches 26 m instead of 18.',
  },
  fourthpouch: {
    name: 'Fourth pouch', kind: 'upgrade', needs: 'bomb', trial: 'buried', where: 'The first finish of the Canyon dive, the Buried Machine’s run on the wings.',
    text: 'One more leather pouch on the bomb belt, already smelling of ink. Four ink bombs instead of three.',
  },
  longsand: {
    name: 'Long sand', kind: 'upgrade', needs: 'recall', trial: 'bazaar', where: 'The first finish of the Avenue run, the Signal Market’s run on the wings.',
    text: 'A pinch of the market’s finest sand for the hourglass. The recall hourglass sends things back up to 12 seconds instead of 8.',
  },
  // (the Avenue run's until v1.47, when the run gave the hourglass its long sand: kept for the saves that won it)
  racersribbon: {
    name: 'Racer’s ribbon', kind: 'cosmetic', retired: true, where: 'The first finish of the Avenue run, the Signal Market’s run on the wings, before v1.47.',
    text: 'A ribbon in the market’s racing colours. It does nothing at all, and everyone in the market knows what it means.',
  },
  // (worn for the finishing: the three worlds that joined the route in v1.40 gave them until issues #375 and #377, when their
  // trials took the upgrades of the gadgets their temples and the ones before them earn, and the first three on the route these)
  divercap: {
    name: 'Rider’s cap', kind: 'cosmetic', trial: 'arzach2', where: 'The first finish of the Stone circuit, the Sky Stones’ bird race.',
    text: 'A knitted cap in the sky-riders’ blue, a brass ring sewn over one ear. It does nothing at all, and every bird on the stones looks twice at it.',
  },
  founderspin: {
    name: 'Reed pin', kind: 'cosmetic', trial: 'perdide', where: 'The first finish of the Reed race, Lorn’s skiff run.',
    text: 'A tiny skiff of pressed reed on a pin, for whoever sailed the reeds fastest. It does nothing at all, and the punt-folk say it suits you.',
  },
  courierribbon: {
    name: 'Lagoon ribbon', kind: 'cosmetic', trial: 'perdide2', where: 'The first finish of the Lagoon laps, the Deep Wood’s skiff run.',
    text: 'A strip of the lagoon racers’ green for the wrist. It does nothing at all, and the boat-folk wave you past.',
  },
  // ---- given by people, through a quest (quests.give: the same item.<id> flag), not found in a box
  cabpass: {
    name: 'Cab pass', kind: 'pass', quest: true,
    text: 'A card from Lio, Tobin’s name crossed out and something like yours written over it. Cabs stop for you now: whistle one down with {key:call}, or get in one that waits.',
  },
  star: {
    name: 'Pale star', kind: 'cosmetic',
    text: 'A pale enamel star, the makers’ sign for a traveller far from home. Pinned to your overshirt, or your brow under a hood. It does nothing at all, and looks very good.',
    does: 'It does nothing at all, and looks very good.',
  },
  // ---- the scientist's work with the fragments of the singing light (src/fragment-shop.js, src/story/scientist.js):
  // Anselm Thrum sells them aboard the ship for fragments (v1.62, issue #185: `fragments`, the price; `light`: the gear
  // it is fitted to, for its model; `needs`: the gear it can’t be fitted without). The prices add up to 96, every fragment
  // there was until v1.70 (a third of the 288 since: the prices kept, issue #317), the cheapest first as the milestones were (5, 10, 15, 25, 50, 75, 96 until v1.62). Their numbers: src/trials/upgrades.js FRAGMENT_TUNES, src/boxes/effects.js,
  // src/resources.js HEART_ITEMS / MAGIC_ITEMS.
  lightheart: {
    name: 'Light-stitched heart', kind: 'upgrade', fragments: 5, light: 'heart', where: 'Anselm Thrum sells it aboard your ship, for five fragments of the singing light.',
    text: 'Fragments sewn into your coat’s lining over your heart. One more heart, for good: four to start with instead of three.',
  },
  finder: {
    name: 'Fragment finder', kind: 'charm', fragments: 3, toggle: true, where: 'Anselm Thrum sells it aboard your ship, for three fragments of the singing light.',
    text: 'Anselm’s brass box with a splinter of the light inside. It beeps faster as a fragment comes within 60 m. Switch it off or on here on the items page.',
    does: 'It beeps faster as a fragment comes within 60 m; the items page switches it off or on.',
  },
  lightedge: {
    name: 'Light-tempered edge', kind: 'upgrade', fragments: 7, light: 'sword', needs: 'sword', where: 'Anselm Thrum sells it aboard your ship, for seven fragments of the singing light.',
    text: 'The blade’s fluid sings a little now. Every cut of the blade lands half as hard again: the combo’s three cut 1.5, 1.5 and 4.5 instead of 1, 1 and 3.',
  },
  lightcell: {
    name: 'Light chamber', kind: 'upgrade', fragments: 10, light: 'cell', needs: 'backpack', where: 'Anselm Thrum sells it aboard your ship, for ten fragments of the singing light.',
    text: 'A chamber of fragments ground fine, fitted to the tank. Your magic bar grows by one: one more shot, push or boost before it runs dry.',
  },
  lightwing: {
    name: 'Light-veined wings', kind: 'upgrade', fragments: 18, light: 'glider', needs: 'glider', where: 'Anselm Thrum sells it aboard your ship, for eighteen fragments of the singing light.',
    text: 'Light threaded through the wings’ veins. Gliding is a fifth faster (18 m/s instead of 15) and sinks a quarter slower.',
  },
  lightstep: {
    name: 'Light-soled boots', kind: 'upgrade', fragments: 23, light: 'soles', where: 'Anselm Thrum sells it aboard your ship, for twenty-three fragments of the singing light.',
    text: 'Fragments set in your boots’ heels. Running tires you 30% less, and your stamina comes back half as fast again when you rest.',
  },
  lightguard: {
    name: 'Light-rimmed guard', kind: 'upgrade', fragments: 30, light: 'shield', needs: 'shield', where: 'Anselm Thrum sells it aboard your ship, for thirty fragments of the singing light.',
    text: 'Fragments round the guard’s rim. A blow you block with {key:guard} takes half a unit of magic instead of a whole one.',
  },
};

/**
 * What it does, in one line: the box-opening card's words under the name (issue #329, the author: "It should just tell
 * me the name of the item and what it does"). An item's own `does`, else its description without its first sentence
 * (what it is), else, one sentence with a colon, what follows the colon. At most CARD_LINE_MAX letters (tests/item-cards.test.js).
 */
export function itemLine(def) {
  if (!def) return '';
  if (def.does) return def.does;
  const text = def.text ?? '';
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z{])/);
  if (parts.length > 1) return parts.slice(1).join(' ');
  const c = text.indexOf(': ');
  return c > 0 ? text.charAt(c + 2).toUpperCase() + text.slice(c + 3) : text;
}
/** The longest the card's line is (letters, with its {key:…} placeholders). */
export const CARD_LINE_MAX = 125;

/** The scientist's upgrades, the cheapest first, and their price in fragments (src/fragment-shop.js, issue #185). */
export const FRAGMENT_ITEMS = Object.entries(ITEMS).filter(([, d]) => d.fragments).sort((a, b) => a[1].fragments - b[1].fragments).map(([id, d]) => ({ id, price: d.fragments }));

/** Gun modes: shoot (and push) come with the fluid gun (a gadget: src/gadgets/gun.js); the others are unlocked by items. */
export const MODE_ITEMS = { shoot: 'gun', stun: 'stun', fire: 'fire', bloom: 'bloom', tether: 'tether' };

/**
 * The backpack's strengths in the order the route brings them (docs/systems/progression.md): the lift valve's
 * double jump (the desert's giant's cave), the wings (Vael's Aerie), the bellows (the City-Shaft's Warden's Well).
 * How many are owned is the backpack's stage (0..3): the round tank shows it (src/fluid-tool.js buildTank).
 */
export const BACKPACK_STAGES = ['doublejump', 'glider', 'wardenbellows'];
/** The backpack's stage (0..3) from what is owned (has: id -> bool); the debug jets count as the bellows (they turn a great vane too). */
export const backpackStage = (has) => BACKPACK_STAGES.filter((id) => has(id) || (id === 'wardenbellows' && has('jetpack'))).length;

const key = (id) => `item.${id}`;
const EQUIPPED = 'gadget.equipped';   // (src/gadgets/index.js EQUIPPED_FLAG: the gadget in hand)
const listeners = new Set();

export const items = {
  has(id) { return !!game.flag(key(id)); },
  /** Found: and what comes with it (`with`: the gun's ember mode). */
  grant(id) {
    if (!ITEMS[id] || this.has(id)) return false;
    game.set(key(id), true);
    // a gadget found is in hand at once (issue #330): the save's hand here, the world's runtime on the listeners (src/gadgets/index.js)
    if (ITEMS[id].kind === 'gadget') game.set(EQUIPPED, id);
    game.emit('item', { id, def: ITEMS[id] });
    for (const fn of listeners) fn(id, true);
    for (const w of ITEMS[id].with ?? []) this.grant(w);
    return true;
  },
  revoke(id) {
    if (!this.has(id)) return false;
    game.set(key(id), false);
    for (const fn of listeners) fn(id, false);
    return true;
  },
  owned() { return Object.keys(ITEMS).filter((id) => this.has(id)); },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

const keys = (t) => keyText(esc(t), { html: true, teach: true });   // (a {key:verb}: the player's own key or button)
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KIND_ORDER = ['core', 'weapon', 'movement', 'gadget', 'mode', 'upgrade', 'charm', 'pass', 'cosmetic'];   // (gadget: src/gadgets/)

/**
 * The gear you carry as a plain list: each item's name and what it does, the backpack
 * first; then what you carry in your pack for the quests (the spark-stone, Ama's jar…).
 * (The game's own screen is the game menu's Items panel, src/game-menu.js, which draws
 * each item's model; this list is the same order in words, for the tests and tools.)
 * @param owned item ids (items.owned()) · mode: the gun mode in use, when there is a choice
 * · carried: the quest items' names (src/story/quests.js carried())
 */
export function gearHtml(owned = [], { mode = null, carried = [] } = {}) {
  const list = owned.filter((id) => ITEMS[id]).sort((a, b) => KIND_ORDER.indexOf(ITEMS[a].kind) - KIND_ORDER.indexOf(ITEMS[b].kind));
  const rows = list.map((id) => `<li><b>${esc(ITEMS[id].name)}</b> · ${keys(ITEMS[id].text)}</li>`).join('');
  const body = rows ? `<ul>${rows}</ul>${mode ? `<p class="qhint">gun mode: ${esc(mode)}</p>` : ''}` : '<p class="qhint">Nothing yet.</p>';
  const pack = carried.length ? `<h4 class="qgroup">In your pack</h4><ul class="pack">${carried.map((n) => `<li><b>${esc(n.replace(/^./, (c) => c.toUpperCase()))}</b></li>`).join('')}</ul>` : '';
  return `<section class="quests gear"><h2>Gear <span>${list.length + carried.length}</span></h2>${body}${pack}</section>`;
}
