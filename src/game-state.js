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
//   ship.powered          the ship can fly; the galactic map is unlocked (set by the desert story
//                         when the power source is brought back; src/ship/ship.js listens)
//   ship.level            id of the world the ship last flew to (set on travel and by the prologue)
//   ship.launched         the ship has taken off at least once since the crash (the desert then shows
//                         it standing on its legs, not dug into the dune)
//   objective             the current main objective, shown in the HUD (string; the prologue sets
//                         'Find a new source of power.'; the story clears or replaces it)
//   tool.colours          number of colour bands in the backpack fluid (1 at start: cyan and
//                         violet; each band adds a tone, up to 5; written by tool.refill)
//   tool.tones            optional custom tones by index ([, , '#e9a53c']), when a band was
//                         added with refill({ addColour: true, tone })
//   calls.<n>             call n home has been heard (src/story/calls.js; call n waits at the
//                         cockpit console once n worlds are complete)
//   quest.<id>            a quest's stage (string); see src/story/quests.js
//   world.<id>.done       that world's discovery is made
//   quest.tracked         the quest shown on the HUD and pinged by Q (src/story/quests.js)
//   item.<id>             how many of an item the traveller carries (quests.give / has / take)
//   met.<person>          you have talked to them (set by the conversation panel)
//   said.<person>.<node>.<i>  a once-only answer was given
//   desert.*              the desert's story (src/story/desert.js): camps.seen, jar.given,
//                         speaker.heard, well.seen, cave.seen, channel.open (the rib is pushed
//                         clear and the tree drinks), jar.filled, ship.fed, pool.tinted, teo.drumming,
//                         ilo.following / ilo.atSkull / ilo.told, oum.following / oum.home,
//                         stele.read, mural.read, brow.seen, rumour.light; clue.desert.perdide
//
// Well-known events:
//   'ship:enter' / 'ship:exit' { level }  the player walks into / out of the ship
//   'travel' { to }                the galactic map chose a destination (take-off follows)
//   'call' { n }                   call n home has just been heard
//   'dialogue:start' / 'dialogue:end' { npc, id }
//   'quest' { id, stage }          a quest advanced
//   'tool:fire' { mode, point }    the fluid tool was used (mode: 'shoot' | 'boost' | 'push')
//   'item' { item, n }             an item was given (n > 0) or taken (n < 0)
//   'tool:refilled' { charges, colours, added }   the tank filled up (after the 5 s wait, or refill());
//                                  added: a colour band was added (magical water)
// Requests the fluid tool listens for (fluid-tool.js; same as calling the tool directly):
//   'tool:refill' { addColour, tone }  fill the tank now; addColour: true adds a colour band for good
//                                  (sets tool.colours, up to 5) — the desert's magical water; tone:
//                                  optional hex colour for that band (default: the next fluid tone)
//   'tool:enable' { on }           on: false puts the tool away (no shoot, push or boost), e.g.
//                                  inside the ship before the player first steps outside

import { slotStorage } from './save-slots.js';
import { migrateFlags, MIGRATED } from './save-migrate.js';

const KEY = 'moebius.game.v1';   // per save slot (src/save-slots.js)

class GameState {
  constructor(storage = slotStorage) {
    this.storage = storage;
    this.listeners = new Map();
    try { this.data = JSON.parse(storage?.getItem(KEY)) ?? {}; } catch { this.data = {}; }
    this.data.flags ??= {};
    this.data.keepsakes ??= [];
    if (migrateFlags(this.data.flags)) this.save();   // older saves (src/save-migrate.js)
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
  reset() { this.data = { flags: { 'save.migrated': MIGRATED() }, keepsakes: [] }; this.save(); this.emit('reset'); }
}

export const game = new GameState();
export { GameState };
