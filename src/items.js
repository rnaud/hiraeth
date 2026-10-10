import { keyText } from './prompt-keys.js';
import { game } from './game-state.js';

// The traveller's items: what they have found (in boxes, through quests) and
// can use. Everything runs on the magic-fluid backpack: without it there is
// no tool, no jetpack, no glider, and vehicles cannot be powered.
//
//   import { items } from './items.js';
//   items.has('jetpack')                  // owned?
//   items.grant('jetpack')                // found it (persists; emits 'item' { id, def })
//   items.revoke('jetpack')               // (dev menu)
//   items.on((id, owned) => …)            // any change; returns an unsubscribe function
//   ITEMS.jetpack.name / .text / .kind    // for the box-opening card and the dev menu
//
// Stored as game flags `item.<id>` = true. Systems read items.has() every
// frame (cheap), so a grant takes effect at once.
//
// Kinds: core (the backpack), movement, mode (gun modes, MODE_ITEMS), and the
// (the mastery trials' rewards, `trial: '<world>'`: upgrades to the gadgets, won not found: src/trials/)
// boxes' special items: upgrade (the tank), charm, cosmetic; and pass (`quest: true`: someone
// gives it at the end of a quest, not a box: the City-Shaft's cab pass). Most items come
// out of item boxes (src/boxes/), the makers' chests, left for a traveller who
// comes a long way (docs/story-bible.md, "The boxes"): the box-opening card
// shows name, text ("what it is") and use ("what it does").

export const ITEMS = {
  backpack: {
    name: 'Magic-fluid backpack', kind: 'core',
    text: "A makers’ glass tank and the leather glove that drinks from it: the glove is what shoots. Fill it with living water. Someone built it for a traveller they would never meet.",
    use: 'Aim with {key:aim} and shoot bursts of fluid with {key:fire}; switch the gun’s mode with {key:mode} to push people and things away, and to the modes you find; boost-jump. Its glove draws the fluid blade: {key:blade} swings it, {key:guard} held guards, {key:evade} evades. Everything it does spends the magic bar (a shot, a push or a boost: a third of it), which refills by itself a moment after the last use. It also powers vehicles.'
  },
  jetpack: {
    name: 'Fluid jets', kind: 'movement', needs: 'backpack',
    text: "Ancient nozzles that turn the tank’s fluid into thrust. Worn smooth, still reliable. The makers expected a long journey.",
    use: 'They fly like a plane. {key:thrust} is the thrust, the harder the faster: from the ground it lifts you straight up. {key:move} flies the nose: forward dives, back climbs, left and right bank and turn. Let go to glide on; aim with {key:aim} in flight and they hold you while you shoot. They burn the backpack’s fluid; land to let it recover.',
  },
  glider: {
    name: 'Fluid wings', kind: 'movement', needs: 'backpack',
    text: "Folded membranes that open into bright wings. A whole sky tucked into very little luggage.",
    use: 'Hold jump while falling to unfold the wings and glide.',
  },
  stun: {
    name: 'Stilling mode', kind: 'mode', needs: 'backpack',
    text: "A glyph-cut lens that chills the fluid. A small pause for things moving much too quickly.",
    use: 'Switch modes with {key:mode}. A stilling burst freezes creatures and people for a few seconds.',
  },
  fire: {
    name: 'Ember mode', kind: 'mode', needs: 'backpack',
    text: "A flint ring that turns fluid into ember bursts. Useful fire, small enough to wear on the glove.",
    use: 'Switch modes with {key:mode}. Ember bursts light lamps, braziers and fuses, and burn away dry brambles.',
  },
  bloom: {
    name: 'Bloom mode', kind: 'mode', needs: 'backpack',
    text: "A green glass seed for the glove, with a tiny root curled inside. The makers grew their doorways as well as their gardens.",
    use: 'Switch modes with {key:mode}. A bloom burst tells the makers’ plants to grow: seeds sprout, budded doorways open, vines climb glass and bridge a gap. Anywhere else, a few flowers come up where it lands.',
  },
  // ---- special items, found in boxes across the worlds (src/boxes/placements.js; effects in src/boxes/effects.js)
  cell: {
    name: 'Fourth chamber', kind: 'upgrade', needs: 'backpack',
    text: "An extra glass chamber for the tank. More room, without having to grow a larger back.",
    use: 'The magic bar grows by a third: four shots in a row instead of three.',
  },
  coil: {
    name: 'Quick coil', kind: 'upgrade', needs: 'backpack',
    text: "A warm copper coil that helps the tank refill faster. Still warm after centuries in a box.",
    use: 'The magic bar starts refilling half a second after the last use instead of one, and fills twice as fast.',
  },
  lantern: {
    name: 'Lantern charm', kind: 'charm',
    text: "A thumb-sized paper lantern tied with red string. Nobody has needed to replace its light.",
    use: 'After dusk the charm glows and lights the ground around you.',
  },
  lens: {
    name: 'Glyph lens', kind: 'charm',
    text: "A cloudy lens marked with the glyph. It reveals the makers’ hidden marks and distant unopened chests.",
    use: 'Unopened boxes show from far away: a pale column of light rises from each one.',
  },
  bell: {
    name: 'Bell-note whistle', kind: 'charm',
    text: "A blue clay whistle shaped like a bell. It plays one clear note. Nearby makers’ chests know the reply.",
    use: 'Sound it with {key:whistle}. Unopened boxes nearby answer with a chime from where they hide.',
  },
  soles: {
    name: 'Soft-fall soles', kind: 'charm',
    text: "Thin grey boot soles with a tiny glyph under each heel. Someone thought travellers deserved softer landings.",
    use: 'Hard landings hurt less: you can drop much further before a fall knocks you over.',
  },
  hush: {
    name: 'Hush-cloth', kind: 'charm',
    text: "Soft grey cloth to wrap around your boots. Woven for quiet footsteps and considerate entrances.",
    use: 'Creatures don’t hear you walking up to them: they only notice you when you are very close.',
  },
  shell: {
    name: 'Listening shell', kind: 'charm',
    text: "A small white shell. Hidden makers’ chests answer it with a faint hum. Listen for where the sound comes from.",
    use: 'Every little while, the makers’ unopened boxes near you hum back, softly, from where they hide.',
  },
  moss: {
    name: 'Glow-moss pin', kind: 'charm',
    text: "A bead of glass protects a sprig of luminous moss. A very small garden that lights your way.",
    use: 'After dusk it lights the ground round your feet, a little.',
  },
  pouch: {
    name: 'Seed pouch', kind: 'charm',
    text: "A linen pouch of tiny seeds. However many you scatter, there are more. The makers travelled with planting in mind.",
    use: 'Small flowers come up in your footsteps where you walk, and fade a while after.',
  },
  scarf: {
    name: 'Wind-silk scarf', kind: 'charm',
    text: "A fine white scarf with the makers’ glyph woven into one end. Even a slight breeze can lift it.",
    use: 'Your fluid wings sink more slowly when you glide.',
  },
  reed: {
    name: 'Breathing reed', kind: 'charm',
    text: "A crystal-tipped reed to hold between your teeth. It gives you longer to explore beneath the water.",
    use: 'You hold your breath twice as long under water.',
  },
  resin: {
    name: 'Climber’s resin', kind: 'charm',
    text: "Amber resin in a small tin, still soft. Rub it on your palms for a steadier grip while climbing.",
    use: 'Climbing tires you half as fast: you hang on twice as long.',
  },
  echo: {
    name: 'Echo shell', kind: 'charm',
    text: "A pale brass shell that holds the last note it hears from the makers’ devices. Unlike most souvenirs, it can repeat itself.",
    use: 'It catches the last note sung near you (a singing stone, a machine’s one word) and holds it. Play it back with {key:whistle}: whatever listens for that note answers.',
  },
  level: {
    name: 'Brass level', kind: 'charm',
    text: "A brass spirit level bearing the Major’s initials. In the Hangar, even the bubble needs help finding down.",
    use: 'Where down is not where it was (the Hangar’s upside-down quarter and its ring), a small level in the corner of your eye shows how the floor lies.',
  },
  // ---- won in the worlds' mastery trials (src/trials/: the first finish of each), upgrades to the gadgets
  clearglass: {
    name: 'Clear glass', kind: 'upgrade', needs: 'monocle', trial: 'desert', where: 'The first finish of the Dune line, the Desert’s hoverbike run.',
    text: "A second lens of the makers’ glass for the monocle, ground thinner than a fingernail. The world looks a little cleaner through it.",
    use: 'The seeing lens clouds over half as fast.',
  },
  longline: {
    name: 'Long line', kind: 'upgrade', needs: 'hook', trial: 'arzach', where: 'The first finish of the Wind ladder, Vael’s wing run.',
    text: "A spool of the makers’ grey cord, finer than hair and stronger than rope. Someone measured the sky and found it short.",
    use: 'The grappling hook reaches 34 m instead of 25.',
  },
  fourthcoil: {
    name: 'Fourth coil', kind: 'upgrade', needs: 'springs', trial: 'arzach2', where: 'The first finish of the Stone circuit, the Sky Stones’ bird race.',
    text: "A spare spring for each boot, wound tighter than the others. It hums when it is happy.",
    use: 'The spring boots bounce four times in a chain instead of three.',
  },
  widevane: {
    name: 'Wide vane', kind: 'upgrade', needs: 'fan', trial: 'perdide', where: 'The first finish of the Reed race, Lorn’s skiff run.',
    text: "Two more paper ribs for the fan, painted with reeds. It opens wider and keeps the air longer.",
    use: 'The gust fan lifts you five times in the air before you land instead of three.',
  },
  fourthnotch: {
    name: 'Fourth notch', kind: 'upgrade', needs: 'boomerang', trial: 'perdide2', where: 'The first finish of the Lagoon laps, the Deep Wood’s skiff run.',
    text: "A fourth notch cut in the boomerang’s elbow by a careful hand. It remembers one more thing on the way out.",
    use: 'The boomerang locks on to four things instead of three.',
  },
  longbreath: {
    name: 'Long breath', kind: 'upgrade', needs: 'bubble', trial: 'edena', where: 'The first finish of the Eye garden, Viridel’s game of eyes.',
    text: "A drop of the meadow’s sap for the bubble wand’s ring. The bubbles come out rounder and stubborn.",
    use: 'Bubbles last half as long again before they pop.',
  },
  deepwell: {
    name: 'Deep well', kind: 'upgrade', needs: 'bridge', trial: 'incal', where: 'The first finish of the Shaft climb, the City-Shaft’s jet route.',
    text: "A deeper ink well for the bridge pen, in brass with a glass window. You can see the ink think.",
    use: 'The ink bridge pen holds half as much ink again: longer bridges, more of them.',
  },
  lodestone: {
    name: 'Strong lodestone', kind: 'upgrade', needs: 'magnet', trial: 'garage', where: 'The first finish of the Pillar slalom, the Hangar’s jet run.',
    text: "A darker lodestone for the glove’s palm, from deep in the Hangar’s floor. Spoons follow you about.",
    use: 'The magnet glove reaches 26 m instead of 18.',
  },
  fourthpouch: {
    name: 'Fourth pouch', kind: 'upgrade', needs: 'bomb', trial: 'buried', where: 'The first finish of the Canyon dive, the Buried Machine’s jet run.',
    text: "One more leather pouch on the bomb belt. It already smells of ink.",
    use: 'Four ink bombs in the pouch instead of three.',
  },
  longsand: {
    name: 'Long sand', kind: 'upgrade', needs: 'recall', trial: 'spheres', where: 'The first finish of the Garden round, the Garden of Spheres’ run on foot.',
    text: "A pinch of the garden’s finest sand for the hourglass. It runs slower and remembers longer.",
    use: 'The recall hourglass sends things back up to 12 seconds instead of 8.',
  },
  racersribbon: {
    name: 'Racer’s ribbon', kind: 'cosmetic', trial: 'bazaar', where: 'The first finish of the Avenue run, the Signal Market’s jet run.',
    text: "A ribbon in the market’s racing colours, stamped with the silent tower. The cab drivers nod at it.",
    use: 'It does nothing at all, and everyone in the market knows what it means.',
  },
  // ---- given by people, through a quest (quests.give: the same item.<id> flag), not found in a box
  cabpass: {
    name: 'Cab pass', kind: 'pass', quest: true,
    text: "A stiff card stamped with the palace seal, a name punched into it more or less like yours. Lio, the City-Shaft’s dispatcher, wrote it.",
    use: 'Cabs stop for you now: whistle when one passes with {key:call}, or get in one that waits, and tell it where to go. It drives itself.',
  },
  star: {
    name: 'Pale star', kind: 'cosmetic',
    text: "A pale enamel star, like the ones on the makers’ chests. The makers’ sign for a traveller: a small light, a long way from home.",
    use: 'Pinned to your overshirt, or over the brow when a hood is up. It does nothing at all, and it looks very good.',
  },
};

/** Gun modes: shoot is always there with the backpack; the others are unlocked by items. */
export const MODE_ITEMS = { shoot: 'backpack', stun: 'stun', fire: 'fire', bloom: 'bloom' };

const key = (id) => `item.${id}`;
const listeners = new Set();

export const items = {
  has(id) { return !!game.flag(key(id)); },
  grant(id) {
    if (!ITEMS[id] || this.has(id)) return false;
    game.set(key(id), true);
    game.emit('item', { id, def: ITEMS[id] });
    for (const fn of listeners) fn(id, true);
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
const KIND_ORDER = ['core', 'movement', 'mode', 'gadget', 'upgrade', 'charm', 'pass', 'cosmetic'];   // (gadget: src/gadgets/)

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
  const rows = list.map((id) => `<li><b>${esc(ITEMS[id].name)}</b> · ${keys(ITEMS[id].use)}</li>`).join('');
  const body = rows ? `<ul>${rows}</ul>${mode ? `<p class="qhint">gun mode: ${esc(mode)}</p>` : ''}` : '<p class="qhint">Nothing yet.</p>';
  const pack = carried.length ? `<h4 class="qgroup">In your pack</h4><ul class="pack">${carried.map((n) => `<li><b>${esc(n.replace(/^./, (c) => c.toUpperCase()))}</b></li>`).join('')}</ul>` : '';
  return `<section class="quests gear"><h2>Gear <span>${list.length + carried.length}</span></h2>${body}${pack}</section>`;
}
