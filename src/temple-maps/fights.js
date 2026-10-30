// The temple maps (issue #396; docs/systems/dev-tools.md "The temple maps"): a fight temple's run as a map, from its
// world's table (src/fight-temples/<world>.js) drawn with a seed as the game draws it (generate.js drawRun: the rooms
// shuffled and laid out afresh, their waves drawn for their place's budget). A fight temple has no puzzle: each room's
// gate opens once its waves are cleared, the last room's altar holds the reward. Its map is the same shape as a
// makers' temple's (makers.js), so the page draws both alike:
//
//   { kind, id, name, world, seed, floors: [{ id, y, name }], plan: { shapes, bounds }, rooms: [{ id, name, pos, floor,
//     entry, boss }], links: [{ id, a, b, type, label, way, keys: [{ id, how, room, metres, rooms, visible, pos }] }],
//     cages, elements: [{ id, type, room, noun, pos, verbs }], steps: [{ id, n, text, room, pos, path, metres, verbs,
//     opens, optional, clue }], metrics: { rooms, floors, keys, locks, puzzles, steps, walked, furthestClue, backtracks,
//     verbs, solved } }
//
//   FIGHTS                  every world's table, in the route's order
//   fightMap(def, seed)     the map of one run

import { DESERT_FIGHT } from '../fight-temples/desert.js';
import { ARZACH_FIGHT } from '../fight-temples/arzach.js';
import { PERDIDE_FIGHT } from '../fight-temples/perdide.js';
import { EDENA_FIGHT } from '../fight-temples/edena.js';
import { UNDERWATER_FIGHT } from '../fight-temples/underwater.js';
import { INCAL_FIGHT } from '../fight-temples/incal.js';
import { GLASSDUNES_FIGHT } from '../fight-temples/glassdunes.js';
import { BURIED_FIGHT } from '../fight-temples/buried.js';
import { MOONFOUNDRY_FIGHT } from '../fight-temples/moonfoundry.js';
import { SPHERES_FIGHT } from '../fight-temples/spheres.js';
import { SPACECITY_FIGHT } from '../fight-temples/spacecity.js';
import { BAZAAR_FIGHT } from '../fight-temples/bazaar.js';
import { drawRun, waveCost } from '../fight-temples/generate.js';
import { doorGap, wallBoxes, roomWaves } from '../fight-temples/rules.js';
import { HAZARD, laneRect } from '../fight-temples/hazards.js';
import { waveWords, FOES } from '../foes.js';
import { ORDER } from '../levels/names.js';

/** Every fight temple's table, the route's worlds first. */
export const FIGHTS = [DESERT_FIGHT, ARZACH_FIGHT, PERDIDE_FIGHT, EDENA_FIGHT, UNDERWATER_FIGHT, INCAL_FIGHT, GLASSDUNES_FIGHT, BURIED_FIGHT, MOONFOUNDRY_FIGHT, SPHERES_FIGHT, SPACECITY_FIGHT, BAZAAR_FIGHT]
  .sort((a, b) => (ORDER.indexOf(a.world) + 1 || 99) - (ORDER.indexOf(b.world) + 1 || 99));

const round1 = (v) => Math.round(v * 10) / 10;
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const mid = (r) => [(r.x[0] + r.x[1]) / 2, 0, (r.z[0] + r.z[1]) / 2];
const hpOf = (k) => FOES[k]?.hp ?? 2;

/** A wave in plain words: "10 ink blots, 2 stilt herons and 1 gorged ink blot". */
export function waveText(wave) {
  const plain = wave.filter(([, , o]) => !o?.gorged && !o?.tough).flatMap(([k, n]) => Array(n).fill(k));
  const parts = [plain.length ? waveWords(plain) : ''];
  const gorged = wave.filter(([, , o]) => o?.gorged).flatMap(([k, n]) => Array(n).fill(k));
  const tough = wave.filter(([, , o]) => o?.tough).flatMap(([k, n]) => Array(n).fill(k));
  if (tough.length) parts.push(`the tough ones: ${waveWords(tough)}`);
  if (gorged.length) parts.push(`gorged: ${waveWords(gorged)}`);
  return parts.filter(Boolean).join('; ');
}

/** The map of a fight temple's run (`def` its world's table, `seed` the run's). */
export function fightMap(def, seed) {
  const run = drawRun(def, seed);
  const rooms = run.rooms, doors = run.doors ?? [];
  const floors = [{ id: 'f0', y: 0, top: 0, name: 'the one floor' }];
  const hz = rooms.find((r) => r.hazard)?.hazard?.kind ?? (rooms.some((r) => r.geysers) ? 'geyser' : null);
  const hazardWord = hz === 'geyser' ? 'an ink geyser' : HAZARD[hz]?.word ?? null;

  // ---- the plan: the rooms' floors, their walls with the doors' gaps, pillars, springs, the altar, the hazard's lanes
  const shapes = [];
  rooms.forEach((r, i) => shapes.push({ kind: 'slab', x0: r.x[0], x1: r.x[1], z0: r.z[0], z1: r.z[1], y: 0, floor: 'f0', room: r.id }));
  for (const b of wallBoxes(rooms, doors)) shapes.push({ kind: 'box', x0: b.x[0], x1: b.x[1], z0: b.z[0], z1: b.z[1], floor: 'f0' });
  for (const r of rooms) {
    for (const p of r.pillars ?? []) shapes.push({ kind: 'pillar', x: p[0], z: p[1], r: 0.7, floor: 'f0' });
    for (const s of r.springs ?? []) shapes.push({ kind: 'spring', x: s[0], z: s[1], r: 0.9, floor: 'f0' });
    if (r.basin) shapes.push({ kind: 'basin', x: r.basin[0], z: r.basin[1], r: r.basin[2], floor: 'f0' });
    if (r.altar) shapes.push({ kind: 'altar', x: r.altar[0], z: r.altar[1], r: 1.4, floor: 'f0' });
    for (const l of r.hazard?.lanes ?? []) if (l.at != null && l.w) { const q = laneRect(r, l); shapes.push({ kind: 'lane', x0: q.x[0], x1: q.x[1], z0: q.z[0], z1: q.z[1], along: l.along, dir: l.dir, floor: 'f0' }); }
    for (const s of r.hazard?.signs ?? []) shapes.push({ kind: 'sign', x: s[0], z: s[1], r: 0.6, floor: 'f0' });
    for (const s of r.hazard?.lamps ?? []) shapes.push({ kind: 'lamp', x: s[0], z: s[1], r: 0.6, floor: 'f0' });
  }
  const gaps = doors.map((d) => doorGap(rooms, d));
  gaps.forEach((g, i) => shapes.push({ kind: 'gate', x0: g.x[0], x1: g.x[1], z0: g.z[0], z1: g.z[1], floor: 'f0', link: `L${i}` }));

  // ---- the rooms, the gates between them, what is in each
  const out = rooms.map((r, i) => ({ id: r.id, name: r.name, pos: mid(r).map(round1), floor: 'f0', kind: 'combat', stage: i, entry: i === 0, boss: i === rooms.length - 1 }));
  const links = doors.map((d, i) => {
    const g = gaps[i], way = [(g.x[0] + g.x[1]) / 2, 0, (g.z[0] + g.z[1]) / 2].map(round1), a = rooms[d.from], b = rooms[d.to];
    return { id: `L${i}`, a: a.id, b: b.id, door: `gate-${a.id}`, type: 'gate', oneWay: false, needs: [], way, floor: 'f0', label: `the gate sinks once the ${a.name.replace(/^The /, '').toLowerCase()} is cleared`,
      keys: [{ id: `${a.id}-clear`, how: 'cleared', room: a.id, metres: round1(d2(mid(a), way)), rooms: 0, visible: true, pos: mid(a).map(round1) }], latch: true };
  });
  const elements = [];
  rooms.forEach((r, i) => {
    elements.push({ id: `${r.id}-clear`, type: 'waves', room: r.id, noun: `${(r.waves ?? []).length} waves`, pos: mid(r).map(round1), floor: 'f0', verbs: ['fight', ...(r.hazard || r.geysers ? ['dodge'] : [])] });
    if (r.altar) elements.push({ id: 'reliquary', type: 'reward', room: r.id, noun: 'reliquary', pos: [r.altar[0], 0, r.altar[1]], floor: 'f0', verbs: ['take'] });
  });

  // ---- the solution: room by room, wave by wave, the gate, then the reliquary
  const steps = [];
  let here = [run.spawn[0], 0, run.spawn[2]], walked = 0;
  const step = (o) => { const n = steps.length + 1; walked += o.metres; steps.push({ id: `${def.id}-${n}`, n, optional: false, opens: [], rooms: [], through: [], clue: [], ...o }); };
  rooms.forEach((r, i) => {
    const waves = r.waves ?? [];
    const path = [here];
    if (i > 0) path.push(links[i - 1].way);
    const c = mid(r).map(round1);
    path.push(c);
    const metres = path.slice(1).reduce((a, p, k) => a + d2(path[k], p), 0);
    here = c;
    waves.forEach((w, k) => {
      const dodge = r.hazard || r.geysers ? hazardWord : null;
      const tough = w.some(([, , o]) => o?.tough);
      step({
        verb: 'fight', element: `${r.id}-clear`, room: r.id, roomName: r.name, floor: 'f0', pos: c,
        text: `${k === 0 ? `${i === 0 ? 'Go down into' : 'Go through the gate into'} ${r.name.replace(/^The/, 'the')}, and clear` : 'Clear'} wave ${k + 1} of ${waves.length}: ${waveText(w)}${dodge ? ` (mind ${dodge})` : ''}`,
        path: k === 0 ? path.map((p) => p.map(round1)) : [c, c], metres: k === 0 ? round1(metres) : 0,
        verbs: ['fight', ...(dodge ? ['dodge'] : []), ...(w.some(([, , o]) => o?.gorged) ? ['gorged'] : []), ...(tough ? ['tough'] : [])],
        through: k === 0 && i > 0 ? [links[i - 1].id] : [], cost: waveCost(w), foes: w.reduce((a, [, n]) => a + n, 0),
        opens: k === waves.length - 1 && links[i] ? [links[i].door] : [], rooms: k === waves.length - 1 && links[i] ? [links[i].b] : [],
      });
    });
    if (r.altar) {
      const p = [r.altar[0], 0, r.altar[1]];
      step({ verb: 'take', element: 'reliquary', room: r.id, roomName: r.name, floor: 'f0', pos: p, text: `Open the reliquary on the altar in ${r.name.replace(/^The/, 'the')}: the ${def.colours} colours for the battery, the sword and the shield`, path: [here, p], metres: round1(d2(here, p)), verbs: ['take'] });
      here = p;
    }
  });

  const verbs = {};
  for (const s of steps) for (const v of s.verbs) verbs[v] = (verbs[v] ?? 0) + 1;
  const foes = rooms.reduce((a, r) => a + roomWaves(r, { hpOf }).reduce((b, w) => b + w.length, 0), 0);
  const metrics = {
    rooms: rooms.length, floors: 1, keys: 0, locks: links.length, puzzles: 0,
    steps: steps.length, optional: 0, walked: Math.round(walked),
    // (no clue sits away from its lock: each gate's key is its own room cleared)
    furthestClue: null, backtracks: 0, verbs, solved: true,
    foes, waves: rooms.reduce((a, r) => a + (r.waves ?? []).length, 0), hazard: hazardWord,
  };
  // (the plan's frame, as a makers' temple's: +z up the page. A fight temple runs north, -z, up the screen under its
  // camera, so its z is turned round: the way in at the bottom, as the player sees it)
  const F = (p) => (p ? [p[0], p[1], -p[2]] : p);
  for (const s of shapes) { if (s.z != null) s.z = -s.z; if (s.z0 != null) [s.z0, s.z1] = [-s.z1, -s.z0]; }
  for (const r of out) r.pos = F(r.pos);
  for (const l of links) { l.way = F(l.way); for (const k of l.keys) k.pos = F(k.pos); }
  for (const e of elements) e.pos = F(e.pos);
  for (const s of steps) { s.pos = F(s.pos); s.path = s.path.map(F); }
  const xs = shapes.flatMap((s) => (s.x0 != null ? [s.x0, s.x1] : [s.x])), zs = shapes.flatMap((s) => (s.z0 != null ? [s.z0, s.z1] : [s.z]));
  return {
    kind: 'fight', id: def.id, name: def.name, world: def.world, seed: run.seed, order: run.order, blurb: def.blurb, colours: def.colours,
    gadget: null, guardian: null, floors, plan: { shapes, bounds: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)].map(round1) },
    rooms: out, links, cages: [], elements, steps, extras: [], metrics,
  };
}
