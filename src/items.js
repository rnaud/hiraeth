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
// boxes' special items: upgrade (the tank), charm, cosmetic. Most items come
// out of item boxes (src/boxes/), the makers' chests, left for a traveller who
// comes a long way (docs/story-bible.md, "The boxes"): the box-opening card
// shows name, text ("what it is") and use ("what it does").

export const ITEMS = {
  backpack: {
    name: 'Magic-fluid backpack', kind: 'core',
    text: "A makers’ glass tank with a hose and wrist nozzle. Fill it with living water. Someone built it for a traveller they would never meet.",
    use: 'Aim (LT / L2, right click) and shoot bursts of fluid, push people and things away, and boost-jump. Three charges; they refill five seconds after the last use. It also powers vehicles.',
  },
  jetpack: {
    name: 'Fluid jets', kind: 'movement', needs: 'backpack',
    text: "Ancient nozzles that turn the tank’s fluid into thrust. Worn smooth, still reliable. The makers expected a long journey.",
    use: 'Hold RT / R2 or the left mouse button when not aiming (on a keyboard, also SPACE held in the air) and fly where you look: the stick forward takes you that way, up if you look up, diving if you look down; leave the stick and you hover, hold jump too and you climb straight up. They burn the backpack’s fluid; land to let it recover.',
  },
  glider: {
    name: 'Fluid wings', kind: 'movement', needs: 'backpack',
    text: "Folded membranes that open into bright wings. A whole sky tucked into very little luggage.",
    use: 'Hold jump while falling to unfold the wings and glide.',
  },
  stun: {
    name: 'Stilling mode', kind: 'mode', needs: 'backpack',
    text: "A glyph-cut lens that chills the fluid. A small pause for things moving much too quickly.",
    use: 'Switch modes with X (on a controller, the D-pad left or right). A stilling burst freezes creatures and people for a few seconds.',
  },
  fire: {
    name: 'Ember mode', kind: 'mode', needs: 'backpack',
    text: "A flint ring that turns fluid into ember bursts. Useful fire, small enough to carry on your wrist.",
    use: 'Switch modes with X (on a controller, the D-pad left or right). Ember bursts light lamps, braziers and fuses, and burn away dry brambles.',
  },
  bloom: {
    name: 'Bloom mode', kind: 'mode', needs: 'backpack',
    text: "A green glass seed for the nozzle, with a tiny root curled inside. The makers grew their doorways as well as their gardens.",
    use: 'Switch modes with X (on a controller, the D-pad left or right). A bloom burst tells the makers’ plants to grow: seeds sprout, budded doorways open, vines climb glass and bridge a gap. Anywhere else, a few flowers come up where it lands.',
  },
  // ---- special items, found in boxes across the worlds (src/boxes/placements.js; effects in src/boxes/effects.js)
  cell: {
    name: 'Fourth chamber', kind: 'upgrade', needs: 'backpack',
    text: "An extra glass chamber for the tank. More room, without having to grow a larger back.",
    use: 'The backpack holds four charges instead of three.',
  },
  coil: {
    name: 'Quick coil', kind: 'upgrade', needs: 'backpack',
    text: "A warm copper coil that helps the tank refill faster. Still warm after centuries in a box.",
    use: 'The tank refills three seconds after the last use instead of five.',
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
    use: 'Press V (on a controller, click the right stick, R3) to sound it. Unopened boxes nearby answer with a chime from where they hide.',
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
    use: 'It catches the last note sung near you (a singing stone, a machine’s one word) and holds it. Press V (or click the right stick, RS / R3) to play it back: whatever listens for that note answers.',
  },
  level: {
    name: 'Brass level', kind: 'charm',
    text: "A brass spirit level bearing the Major’s initials. In the Hangar, even the bubble needs help finding down.",
    use: 'Where down is not where it was (the Hangar’s upside-down quarter and its ring), a small level in the corner of your eye shows how the floor lies.',
  },
  star: {
    name: 'Pale star', kind: 'cosmetic',
    text: "A pale enamel star, like those on the chest lids. The makers’ sign for a traveller: a small light, a long way from home.",
    use: 'Worn on the hood, over the brow. It does nothing at all, and it looks very good.',
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

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KIND_ORDER = ['core', 'movement', 'mode', 'upgrade', 'charm', 'cosmetic'];

/**
 * The gear you carry, for the top of the sketchbook (J, or View / Select on a
 * controller): each item's name and what it does, the backpack first.
 * @param owned item ids (items.owned()) · mode: the gun mode in use, when there is a choice
 */
export function gearHtml(owned = [], { mode = null } = {}) {
  const list = owned.filter((id) => ITEMS[id]).sort((a, b) => KIND_ORDER.indexOf(ITEMS[a].kind) - KIND_ORDER.indexOf(ITEMS[b].kind));
  const rows = list.map((id) => `<li><b>${esc(ITEMS[id].name)}</b> · ${esc(ITEMS[id].use)}</li>`).join('');
  const body = rows ? `<ul>${rows}</ul>${mode ? `<p class="qhint">gun mode: ${esc(mode)}</p>` : ''}` : '<p class="qhint">Nothing yet: the makers’ boxes hold what a traveller needs.</p>';
  return `<section class="quests gear"><h2>Gear <span>${list.length}</span></h2>${body}</section>`;
}
