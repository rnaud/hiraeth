// Persistent story state shared by every system: the ship, conversations and
// quests, the fluid tool, calls home, keepsakes. One small store with flags
// and an event bus so systems coordinate without importing each other.
//
//   import { game } from './game-state.js';
//   game.flag('ship.powered')            // read (undefined if never set)
//   game.set('ship.powered', true)        // write + persist + emit 'flag' and 'flag:ship.powered'
//   game.on('flag:ship.powered', (v) => …) // returns an unsubscribe function
//   game.emit('dialogue:end', { npc })    // transient events (not persisted)
//   game.addKeepsake({ id, level, name, kind, text })   // things of value, for the ending
//
// Well-known flags (add more freely, document them here):
//   prologue.done         the opening cinematic has played (skip it next time)
//   ship.powered          the ship can fly; the galactic map is unlocked
//   ship.level            id of the world the ship is parked on
//   tool.colours          number of colour bands in the backpack fluid (1 at start: cyan and
//                         violet; each band adds a tone, up to 5; written by tool.refill)
//   calls.<n>             call n home has been heard
//   quest.<id>            a quest's stage (string); see src/story/quests.js
//   world.<id>.done       that world's discovery is made
//
// Well-known events:
//   'ship:enter' / 'ship:exit'     the player walks into / out of the ship
//   'travel' { to }                the galactic map chose a destination
//   'dialogue:start' / 'dialogue:end' { npc, id }
//   'quest' { id, stage }          a quest advanced
//   'tool:fire' { mode, point }    the fluid tool was used (mode: 'shoot' | 'boost' | 'push')
//   'tool:refilled' { charges, colours, added }   the tank filled up (after the 5 s wait, or refill());
//                                  added: a colour band was added (magical water)
// Requests the fluid tool listens for (fluid-tool.js; same as calling the tool directly):
//   'tool:refill' { addColour }    fill the tank now; addColour: true adds a colour band for good
//                                  (sets tool.colours, up to 5) — the desert's magical water
//   'tool:enable' { on }           on: false puts the tool away (no shoot, push or boost), e.g.
//                                  inside the ship before the player first steps outside

const KEY = 'moebius.game.v1';

class GameState {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.listeners = new Map();
    try { this.data = JSON.parse(storage?.getItem(KEY)) ?? {}; } catch { this.data = {}; }
    this.data.flags ??= {};
    this.data.keepsakes ??= [];
  }
  save() { try { this.storage?.setItem(KEY, JSON.stringify(this.data)); } catch { /* private mode */ } }
  flag(name) { return this.data.flags[name]; }
  set(name, value) {
    if (this.data.flags[name] === value) return value;
    this.data.flags[name] = value;
    this.save();
    this.emit('flag', { name, value });
    this.emit(`flag:${name}`, value);
    return value;
  }
  on(event, fn) {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(fn);
    return () => set.delete(fn);
  }
  emit(event, payload) { for (const fn of [...(this.listeners.get(event) ?? [])]) fn(payload); }
  keepsakes() { return this.data.keepsakes; }
  addKeepsake(k) {
    if (this.data.keepsakes.some((o) => o.id === k.id)) return false;
    this.data.keepsakes.push({ ...k, t: Date.now() });
    this.save();
    this.emit('keepsake', k);
    return true;
  }
  /** Forget everything (new game). */
  reset() { this.data = { flags: {}, keepsakes: [] }; this.save(); this.emit('reset'); }
}

export const game = new GameState();
export { GameState };
