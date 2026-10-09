// The kit for a game played on foot (a definition with `drives: false`: docs/systems/minigames.md): the
// usual play runs, the traveller walks, cuts, guards and shoots; the game adds its targets or its foes.
//
//   const back = lendTool(ctx.tool, { max: 6, delay: 1 });   // the backpack lent for the game, a longer magic bar
//   back.set({ max: 4 });                                   // (a boon: the bar's length, its refill)
//   …  back();                                              // (in the session's end(): as it was)
//
//   const keep = tune(BLADE, { reach: 3.6 });  …  keep();   // a table of tunings changed for the game, put back after

/**
 * The fluid tool lent for a game: worn and full even on a save that has not found the backpack yet (or
 * whose tank is still dry), in plain shooting mode, with a magic bar of `max` units refilling `delay` s after
 * the last shot at `rate` units a second (all left out: the save's own bar, upgrades and all). Nothing is written to the save.
 * Returns the function that puts it all back.
 */
export function lendTool(tool, { max = null, delay = null, rate = null, mode = 'shoot' } = {}) {
  const none = () => {}; none.set = () => {};
  if (!tool) return none;
  const items = tool.items, had = items.has('backpack');
  const lent = { ...items, has: (id) => id === 'backpack' || items.has(id), on: (fn) => items.on(fn), owned: () => items.owned() };
  tool.items = lent;
  const dry = Object.getOwnPropertyDescriptor(tool, 'dry');   // (lent again inside a lending, the Arena's Ink tide: put back as it was)
  Object.defineProperty(tool, 'dry', { value: false, configurable: true, writable: true });
  // (the tank's size and its refill held for the game: the save's upgrades set them every frame, src/boxes/effects.js)
  const R = tool.reserve, was = { max: R.max, delay: R.delay, rate: R.rate, mode: tool.mode, enabled: tool.enabled };
  const held = { max: max ?? R.max, delay: delay ?? R.delay, rate: rate ?? R.rate };
  // (none given, the Arena's: the save's own bar, its upgrades and all)
  const hold = max != null || delay != null || rate != null;
  if (hold) for (const k of ['max', 'delay', 'rate']) Object.defineProperty(R, k, { get: () => held[k], set: () => {}, configurable: true });
  R.fill();
  tool.enabled = true;
  if (mode && tool.modes.includes(mode)) tool.mode = mode;
  if (!had) tool.shimmer?.();
  const back = () => {
    tool.items = items;
    delete tool.dry;
    if (dry) Object.defineProperty(tool, 'dry', dry);
    if (hold) { delete R.max; delete R.delay; delete R.rate; R.max = was.max; R.delay = was.delay; R.rate = was.rate; }
    R.fill();
    tool.enabled = was.enabled;
    if (tool.modes.includes(was.mode)) tool.mode = was.mode;
  };
  /** The lent bar's length and refill, changed while the game runs (a boon). */
  back.set = ({ max: m = held.max, delay: d = held.delay, rate: r = held.rate } = {}) => { held.max = m; held.delay = d; held.rate = r; };
  return back;
}

/** Change some fields of a tuning table (BLADE, EVADE, …) for a while: returns the function that puts them back. */
export function tune(table, changes) {
  const old = {};
  for (const [k, v] of Object.entries(changes)) { old[k] = table[k]; table[k] = v; }
  return () => Object.assign(table, old);
}

/** The traveller back on his feet and whole, at a place, facing a way (a retry, a start). */
export function standAt(player, pos, heading, rig = null, yaw = null) {
  if (player.dead || player.down) player.restart?.();
  player.respawn?.(pos.clone());
  player.heading = heading;
  player.health = 1;
  player.hurtAt = -1e9;
  if (rig) {
    rig.target?.copy(pos);
    if (yaw !== null) rig.yaw = yaw;
  }
}
