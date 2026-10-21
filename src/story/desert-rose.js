// Main-route ownership is saved independently of the race presentation. Existing owners
// and already-entered houses remain usable after the first-planet consolidation.
export function roseReady(game) {
  return !!(game.flag('desert.bike.found') || game.flag('desert.bike.race.won') || game.flag('desert.rose.legacy'));
}
export function migrateRoseRoute(game, version) {
  if (version >= 7) return null;
  const progressed = ['item.sword', 'item.shield', 'item.gun', 'temple.desert.entered', 'desert.stone.taken', 'desert.tree.lit', 'ship.powered'].some(f => game.flag(f));
  if (progressed) game.set('desert.rose.legacy', true);
  const stage = game.flag('quest.desert.power');
  const moved = { hearth: 'rose', gear: 'blade' }[stage];
  if (moved) game.set('quest.desert.power', moved);
  return moved ?? null;
}
