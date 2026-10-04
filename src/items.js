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

export const ITEMS = {
  backpack: {
    name: 'Magic-fluid backpack', kind: 'core',
    text: 'A glass tank of living fluid, its colours always moving. A hose runs to your wrist.',
    use: 'Shoot bursts of fluid, push people and things away, and boost-jump. Three charges; they refill five seconds after the last use. It also powers vehicles.',
  },
  jetpack: {
    name: 'Fluid jets', kind: 'movement', needs: 'backpack',
    text: 'Two nozzles that clip under the tank and burn its fluid as thrust.',
    use: 'Hold jump in the air to fly upward. Uses the backpack’s fluid; land to let it recover.',
  },
  glider: {
    name: 'Fluid wings', kind: 'movement', needs: 'backpack',
    text: 'Folded membranes that bloom from the tank in the fluid’s colours.',
    use: 'Hold jump while falling to unfold the wings and glide.',
  },
  stun: {
    name: 'Stilling mode', kind: 'mode', needs: 'backpack',
    text: 'A lens for the wrist nozzle that turns the fluid cold and still.',
    use: 'Switch modes with X. A stilling burst freezes creatures and people for a few seconds.',
  },
  fire: {
    name: 'Ember mode', kind: 'mode', needs: 'backpack',
    text: 'A flint ring for the wrist nozzle. The fluid comes out burning, but the fire does not hurt.',
    use: 'Switch modes with X. Ember bursts light lamps, braziers and fuses, and burn away dry brambles.',
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
