import { ITEMS } from '../items.js';
import { registerItemModel } from '../boxes/model.js';

// The gadgets' registry (docs/systems/gadgets.md): the Zelda-like things the traveller carries besides the
// backpack's tool, one module each (src/gadgets/<id>.js, its default export a definition). src/gadgets/all.js
// finds every module in the folder and registers it here; nothing else keeps a list, so a new gadget is one
// new file. Registering one makes it an item (ITEMS[id], kind 'gadget', owned as the flag `item.<id>`), gives
// the item its model (the menu's picture, the items page, the box it might one day come out of), and puts it
// in the list the runtime (src/gadgets/index.js) and the Gadget Yard (src/levels/gadget-yard.js) read.
//
// A definition:
//   {
//     id: 'hook', name: 'Grappling hook', glyph: '⚓',      // glyph: the HUD chip's and the wheel's mark
//     text: 'what it is', use: 'what it does',              // the item card (Xbox / PlayStation prompt form)
//     order: 10,                                            // its place in the wheel and the yard (low first)
//     model() → THREE.Object3D,                             // about 0.3 m, inked materials (makeMaterial)
//     create(ctx) → instance,                               // once per world, when the runtime starts
//     yard(kit) {}                                          // optional: its own test props in the Gadget Yard
//   }
// An instance (every method optional):
//   equip() · unequip()                 taken in hand / put away
//   press() · hold(dt) · release()      the use button (Y / △, T, the middle mouse button, touch ◆)
//   update(dt)                          every frame while the world runs, equipped or not (things in flight)
//   aiming → bool                       while true the camera comes over the shoulder (getter or field)
//   hud() → { count, max, note }        the chip's counter (bombs left) and a word under it
//   cancel()                            the traveller was knocked down, got on a vehicle, a menu opened
//   dispose()

/** Every gadget registered, in their order. */
export const GADGETS = [];

const REQUIRED = ['id', 'name', 'text', 'use', 'model', 'create'];

/** What is wrong with a definition (empty: nothing). */
export function checkGadget(def) {
  const out = [];
  if (!def || typeof def !== 'object') return ['not an object'];
  for (const k of REQUIRED) if (def[k] == null) out.push(`no ${k}`);
  if (def.id != null && !/^[a-z][a-z0-9]*$/.test(def.id)) out.push(`id "${def.id}" must be lower-case letters and digits`);
  for (const k of ['model', 'create', 'yard']) if (def[k] != null && typeof def[k] !== 'function') out.push(`${k} must be a function`);
  if (def.id && ITEMS[def.id] && ITEMS[def.id].kind !== 'gadget') out.push(`id "${def.id}" is already an item`);
  return out;
}

/** Register a gadget: it becomes an item (kind 'gadget') with a model. Registering the same id again replaces it. */
export function registerGadget(def) {
  const bad = checkGadget(def);
  if (bad.length) throw new Error(`gadget ${def?.id ?? '?'}: ${bad.join(', ')}`);
  const i = GADGETS.findIndex((g) => g.id === def.id);
  if (i >= 0) GADGETS.splice(i, 1);
  GADGETS.push(def);
  GADGETS.sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id));
  // (as items in the registry's order, whatever order the files were found in: the menu and the items page list them so)
  for (const g of GADGETS) delete ITEMS[g.id];
  for (const g of GADGETS) ITEMS[g.id] = { name: g.name, kind: 'gadget', needs: g.needs, text: g.text, use: g.use, where: g.where ?? 'In a makers’ court, in one of the worlds on the way home.' };
  registerItemModel(def.id, () => def.model());
  return def;
}

export const gadgetById = (id) => GADGETS.find((g) => g.id === id) ?? null;

/**
 * The next gadget round the list from `current` (dir 1 or -1) among the owned ones, with "none" (null) as
 * one stop of the round when `none` is set (with nothing in hand Y / △ sounds the bell-note whistle).
 */
export function nextGadget(owned, current, dir = 1, { none = true } = {}) {
  const ring = none ? [null, ...owned] : owned.slice();
  if (!ring.length) return null;
  const i = ring.indexOf(current ?? null);
  return ring[((i < 0 ? 0 : i + dir) % ring.length + ring.length) % ring.length];
}

/**
 * The wheel's slot a stick points at: slots laid round a circle clockwise from the top. Returns the index,
 * or -1 while the stick rests near the middle.
 */
export function wheelSlot(x, y, n, dead = 0.45) {
  if (n <= 0 || Math.hypot(x, y) < dead) return -1;
  const a = (Math.atan2(x, y) + Math.PI * 2) % (Math.PI * 2);   // 0 up, clockwise (y up)
  return Math.round(a / ((Math.PI * 2) / n)) % n;
}
