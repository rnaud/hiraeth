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
    text: 'A glass tank of living water, its colours always moving: the makers made it to be worn, and filled it with what the giants carried. A hose runs to a bracer for your wrist.',
    use: 'Shoot bursts of fluid, push people and things away, and boost-jump. Three charges; they refill five seconds after the last use. It also powers vehicles.',
  },
  jetpack: {
    name: 'Fluid jets', kind: 'movement', needs: 'backpack',
    text: 'Two nozzles, worn smooth by hands older than any city, that clip under the tank and burn its fluid as thrust.',
    use: 'Hold jump in the air to fly upward. Uses the backpack’s fluid; land to let it recover.',
  },
  glider: {
    name: 'Fluid wings', kind: 'movement', needs: 'backpack',
    text: 'Membranes the makers folded small, a very long time ago, to bloom from the tank in the fluid’s colours.',
    use: 'Hold jump while falling to unfold the wings and glide.',
  },
  stun: {
    name: 'Stilling mode', kind: 'mode', needs: 'backpack',
    text: 'A lens for the wrist nozzle, cut with the glyph, that turns the fluid cold and still.',
    use: 'Switch modes with X (on a controller, the D-pad left or right). A stilling burst freezes creatures and people for a few seconds.',
  },
  fire: {
    name: 'Ember mode', kind: 'mode', needs: 'backpack',
    text: 'A flint ring for the wrist nozzle. The fluid comes out burning, but the makers’ fire does not hurt.',
    use: 'Switch modes with X (on a controller, the D-pad left or right). Ember bursts light lamps, braziers and fuses, and burn away dry brambles.',
  },
  // ---- special items, found in boxes across the worlds (src/boxes/placements.js; effects in src/boxes/effects.js)
  cell: {
    name: 'Fourth chamber', kind: 'upgrade', needs: 'backpack',
    text: 'A ring of blown glass, older than it looks, that screws under the tank and makes it a little taller.',
    use: 'The backpack holds four charges instead of three.',
  },
  coil: {
    name: 'Quick coil', kind: 'upgrade', needs: 'backpack',
    text: 'A copper spiral, still warm after all this time in the dark, that warms the fluid while it rests.',
    use: 'The tank refills three seconds after the last use instead of five.',
  },
  lantern: {
    name: 'Lantern charm', kind: 'charm',
    text: 'A paper lantern no bigger than a thumb, tied to the tank with red string. Nobody knows how long it has been lit. It never goes out.',
    use: 'After dusk the charm glows and lights the ground around you.',
  },
  lens: {
    name: 'Glyph lens', kind: 'charm',
    text: 'A cloudy disc ground with the three-dot glyph. Through it, the makers’ mark burns where nobody looks, and so do their chests.',
    use: 'Unopened boxes show from far away: a pale column of light rises from each one.',
  },
  bell: {
    name: 'Bell-note whistle', kind: 'charm',
    text: 'A bone whistle that plays one clear bell note, the same note in every world. The makers’ chests know it.',
    use: 'Press V (on a controller, click the right stick, R3) to sound it. Unopened boxes nearby answer with a chime from where they hide.',
  },
  resin: {
    name: 'Climber’s resin', kind: 'charm',
    text: 'A little tin of amber resin, still soft after who knows how long, the makers’ thumb pressed into the lid. Rub it on your palms.',
    use: 'Climbing tires you half as fast: you hang on twice as long.',
  },
  star: {
    name: 'Pale star', kind: 'cosmetic',
    text: 'A star of pale enamel, the same as the one on every chest lid: the makers’ sign for a traveller, a small light a long way from home.',
    use: 'Worn on the hood, over the brow. It does nothing at all, and it looks very good.',
  },
};

/** Gun modes: shoot is always there with the backpack; the others are unlocked by items. */
export const MODE_ITEMS = { shoot: 'backpack', stun: 'stun', fire: 'fire' };

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
