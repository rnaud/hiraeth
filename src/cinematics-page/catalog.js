import { PLACEMENTS } from '../boxes/placements.js';
import { WORLD_MOMENTS } from '../story/film.js';
import { TITLES, ORDER, SIDE } from '../levels/names.js';
import { CALL_COUNT, recordingLabel } from '../story/calls.js';
export const CINEMATICS = [
  { id: 'prologue', world: 'desert', group: 'Story', title: 'The crash · prologue', query: { prologue: '1' } },
  ...Object.entries(WORLD_MOMENTS).flatMap(([world, moments]) => moments.map(m => ({ ...m, world, group: 'World moments', title: m.beat }))),
  { id: 'lantern.arrive', world: 'lantern', group: 'World moments', title: 'The light returns to the Lantern' },
  ...['first', 'final'].map((kind, i) => ({ id: `homecoming.${kind}`, world: 'home', group: 'Story', title: `${kind === 'first' ? 'First' : 'Final'} homecoming`, query: { ending: String(i + 1) } })),
  ...['homage', 'windowSeat'].map(id => ({ id: `home.${id}`, world: 'home', group: 'Story', title: id === 'homage' ? 'At the stone' : 'The window seat' })),
  ...Array.from({ length: CALL_COUNT }, (_, i) => i + 1).concat(['ilen', 'ilen.after', 'trace']).map(n => ({ id: `call.${n}`, n, world: 'desert', group: 'Recordings', title: `Recording ${n} · ${recordingLabel(n) || 'Home'}` })),
  ...[...ORDER, ...SIDE, 'home', 'lantern'].map(world => ({ id: `arrival.${world}`, world, group: 'Travel', title: `Arrival · ${TITLES[world]}`, query: { via: 'ship' } })),
  { id: 'takeoff', world: 'arzach', group: 'Travel', title: 'Departure · takeoff' },
  ...Object.entries(PLACEMENTS).flatMap(([world, boxes]) => boxes.map(box => ({ id: `box.${box.id}`, boxId: box.id, item: box.item, world, group: 'Items', title: `Makers’ box · ${box.item}` }))),
  { id: 'trailer', world: 'desert', group: 'Trailer', title: 'Hiraeth · in-engine trailer' },
];
export function reviewURL(entry) {
  const q = new URLSearchParams({ level: entry.world, cinematicReview: entry.id, ...entry.query });
  return entry.id === 'trailer' ? './trailer.html' : `./index.html?${q}`;
}
