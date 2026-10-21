import { store } from '../platform.js';

// A device preference, separate from story progress. Both complete ship implementations remain playable.
export const SHIP_MODELS = Object.freeze([
  { id: 'caravan', name: 'Rounded caravan' },
  { id: 'original', name: 'Original ship' },
]);
const valid = id => SHIP_MODELS.some(model => model.id === id);
export const shipSetting = {
  key: 'hiraeth.shipModel',
  get(search = typeof location === 'undefined' ? '' : location.search) {
    const requested = new URLSearchParams(search).get('ship');
    if (valid(requested)) return requested;
    const kept = store.get(this.key);
    return valid(kept) ? kept : 'caravan';
  },
  set(id) {
    if (!valid(id)) throw new Error(`Unknown ship: ${id}`);
    store.set(this.key, id);
  },
};

/** An occupied room in the other hull is not a valid resume position. Keep the story, land at this ramp. */
export function shipResume(saved, ship) {
  const active = ship.caravan ? 'caravan' : 'original';
  if (!saved?.aboardShip || !saved.shipModel || saved.shipModel === active) return saved;
  const at = ship.arrivalSpot?.();
  if (!at?.pos) return saved;
  return { ...saved, pos: at.pos.toArray(), heading: at.heading, yaw: at.heading + Math.PI,
    up: [0, 1, 0], fwd: [0, 0, 1], aboardShip: false, shipModel: active };
}
