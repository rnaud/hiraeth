// The serendipity map's data (issue #381; docs/systems/dev-tools.md "The serendipity map"): every thing of interest in
// a built world (world.js buildWorld), by kind, read from where the game reads it, no position kept here:
//
//   the dev menu's gathering (src/world-debug.js gatherPoints: the ship, the temples' doors, the games' signs and the
//   fight temples' doors, the shops, the level's sights, beacons and leading lines, the trials, the makers' runs and
//   courts, the doors and named places, the boxes, the relics), the quests (src/story/*-data.js through the story's
//   locators: each stage where its marker stands, main or errand), the people (src/levels/content.js and the stories'),
//   the fragments of the singing light (src/fragments-data.js), the foes placed by hand and the relics' guards
//   (src/foe-worlds.js PLACED, src/foes.js), the games' hosts (src/minigames/kit/hosts.js).
//
// A thing inside a temple or a room built far from the ground is drawn at its door (as the Map does, main.js mapAt);
// one with no door to stand for it is counted, not drawn.
//
//   collectMarkers(W, { games }) → { markers: [{ kind, name, quest, note, pos: [x, y, z], inside }], landing, hidden }
//   emptiness(W, markers, o)     → the walkable ground from the landing on a grid, how far each cell is from anything
//   KINDS                         [{ key, name, color }] in the legend's order

import * as THREE from 'three';
import { gatherPoints, xyz } from '../world-debug.js';
import { FRAGMENTS } from '../fragments-data.js';
import { PLACED } from '../foe-worlds.js';
import { partsOf, shiftAt } from '../levels/names.js';
import { ITEMS } from '../items.js';

export const KINDS = [
  { key: 'landing', name: 'Ship & landing', color: '#1d1d1f' },
  { key: 'temple', name: 'Makers’ temples & courts', color: '#7b4fd0' },
  { key: 'fight', name: 'Fight temples', color: '#d0312d' },
  { key: 'main', name: 'Main quest steps', color: '#f08c00' },
  { key: 'errand', name: 'Errands', color: '#0f9d8a' },
  { key: 'person', name: 'People', color: '#e0559a' },
  { key: 'poi', name: 'Places & landmarks', color: '#2f6fd6' },
  { key: 'game', name: 'Games, trials & runs', color: '#8a5a2c' },
  { key: 'shard', name: 'Light shards & relics', color: '#d9c400' },
  { key: 'box', name: 'Makers’ boxes', color: '#2e9e48' },
  { key: 'chest', name: 'Chests (temple, court, story)', color: '#a0761b' },
  { key: 'foe', name: 'Foes (placed)', color: '#5a5a66' },
];
export const KIND = Object.fromEntries(KINDS.map((k) => [k.key, k]));
/** Kinds that are not "something to find" for the emptiness measure (the foes come and go; the landing is where you start). */
export const NOT_INTEREST = new Set(['foe']);
/** The traveller's run (src/player.js RUN), m/s: the rings' times. */
export const RUN = 8.2;
/** The rings round the landing, metres. */
export const RINGS = [100, 250, 500, 1000, 2000];

const V = (a) => new THREE.Vector3(a[0], a[1] ?? 0, a[2]);
const near3 = (a, b, r) => Math.hypot(a[0] - b[0], (a[1] ?? 0) - (b[1] ?? 0), a[2] - b[2]) < r;

/** Every thing of interest in a built world (see the head of the file). */
export function collectMarkers(W, { games = [] } = {}) {
  const { id, level, quests, npcs = [], boxes, content, physics } = W;
  const temples = (level.temples?.length ? level.temples : [level.temple]).filter(Boolean);
  // (the open ground under a point: the level's terrain where it has one, not a room built over it)
  const terrain = (x, z) => { const h = level.ground?.heightAt?.(x, z); return Number.isFinite(h) ? h : null; };
  // the rooms off the map: a door from the open ground whose far side lies far over (or under) it
  const roomy = (p) => { const t = terrain(p.x, p.z); return t !== null ? Math.abs(p.y - t) > 150 : p.y > 1200; };
  const doors = (level.portals ?? []).filter((p) => p.at && p.to && !p.toUp && !p.temple && roomy(p.to) && !roomy(p.at));
  // (a point with no height: the highest surface there, from a little over the terrain, not a room built far over it)
  const ground = (x, z) => { const t = terrain(x, z), from = t === null ? 1e4 : t + 200; const g = physics?.groundAt?.(x, from, z, from + 2e4); return Number.isFinite(g) ? g : t ?? 0; };
  const out = [];
  let hidden = 0;
  /** Where it stands on the map: itself, or the door of the temple or room it is in (null: nowhere to draw it). */
  const onMap = (a, room) => {
    const v = V(a);
    for (const t of temples) { let inn = false; try { inn = !!t.inside?.(v); } catch { inn = false; } if (inn && t.outside?.door?.at) return { pos: xyz(t.outside.door.at), inside: t.def?.name ?? 'the temple' }; }
    // (a room is reached by its door: anything within 160 m of where a door comes out, a cave or a hall far from the map)
    const d = doors.find((p) => near3(a, xyz(p.to), 160));
    if (d) return { pos: xyz(d.at), inside: d.label ?? 'a room' };
    if (room || a[1] > 1200) {
      for (const t of temples) if (t.arrival?.pos && t.outside?.door?.at && near3(a, xyz(t.arrival.pos), 400)) return { pos: xyz(t.outside.door.at), inside: t.def?.name ?? 'the temple' };
      return null;
    }
    return { pos: a, inside: null };
  };
  const put = (kind, name, p, o = {}) => {
    const a = xyz(p);
    if (!a || !Number.isFinite(a[0]) || !Number.isFinite(a[2])) return;
    if (a[1] === null) a[1] = ground(a[0], a[2]);
    const m = onMap(a, o.room);
    if (!m || (m.inside && o.outside)) { hidden++; return; }
    if (m.pos[1] === null) m.pos[1] = ground(m.pos[0], m.pos[2]);
    out.push({ kind, name: String(name), quest: o.quest ?? '', note: o.note ?? '', pos: m.pos.map((v) => Math.round(v * 10) / 10), ...(m.inside ? { inside: m.inside } : {}) });
  };

  // ---- the dev menu's points (the landing, temples, games, shops, sights, runs, places, finds), each to its kind
  const relics = { items: (content?.relics?.spots ?? []).map((s, i) => ({ i, pos: xyz(Array.isArray(s) ? s : s.at) })), names: content?.relics?.names ?? [] };
  const pts = gatherPoints({ levelId: id, level, quests: null, npcs: [], boxes: null, relics, ship: null, content, games });
  for (const p of pts) {
    if (p.kind === 'landing') { if (p.key === 'ship' || !out.some((m) => m.kind === 'landing')) put('landing', p.label === 'the start' ? 'the landing' : p.label, p.pos, { note: p.hint }); continue; }
    if (p.kind === 'temple') {
      if (p.key === 'fight') put('fight', p.label.replace(/^fight temple: /, ''), p.pos, { note: 'a fight temple: its door' });
      else if (!p.room) put('temple', p.label.replace(/^outside /, ''), p.pos, { note: 'a makers’ temple: its door' });
      continue;
    }
    if (p.kind === 'run') {
      if (/makers' court/.test(p.label)) put('temple', 'the makers’ court', p.pos, { note: p.hint });
      else put('game', p.label, p.pos, { note: p.hint });
      continue;
    }
    if (p.kind === 'shop') { if (!p.room) put('poi', p.label.replace(/^outside /, 'shop: '), p.pos, { note: p.hint }); continue; }
    if (p.kind === 'sight') { put('poi', p.label, p.pos, { note: p.hint }); continue; }
    if (p.kind === 'place') { if (!p.label.endsWith(': inside')) put('poi', p.label, p.pos, { note: p.hint, outside: true }); continue; }   // (a door inside a room: its way out)
    if (p.kind === 'find' && p.label.startsWith('relic: ')) { put('shard', p.label, p.pos, { note: 'a relic' }); continue; }
  }

  // ---- the quests (a merged world's parts' too): each stage where its marker stands
  const parts = partsOf(id);
  const defs = quests?.defs ? [...quests.defs.values()].filter((d) => !d.world || parts.includes(d.world)) : [];
  const stagesAt = [];
  for (const d of defs) {
    const box = d.id.startsWith('box.');
    d.stages.forEach((s, i) => {
      let p = null;
      try { p = quests.where(s); } catch { p = null; }
      const a = xyz(p);
      if (!a) return;
      stagesAt.push({ pos: a, title: d.title ?? d.id, label: s.label ?? s.text ?? s.id, box: box ? d.id.slice(4) : null });
      if (box) return;   // (a box's own quest: on its box)
      put(d.main ? 'main' : 'errand', s.label ?? s.text ?? s.id, a, { quest: d.title ?? d.id, note: `step ${i + 1} of ${d.stages.length}${d.main ? ' · the main quest' : ''}` });
    });
  }
  const questsAt = (a, r = 3) => [...new Set(stagesAt.filter((s) => a && Math.hypot(s.pos[0] - a[0], s.pos[2] - a[2]) < r && Math.abs((s.pos[1] ?? a[1]) - a[1]) < 6).map((s) => s.title))].join(' · ');

  // ---- the people (the crowd's pooled walkers are not people to find), with the quests that stand on them
  const seen = new Set();
  for (const n of npcs) {
    const d = n?.def;
    if (n?.pooled || !d || !(d.name || d.id) || seen.has(d.id ?? d.name) || !n.pos) continue;
    seen.add(d.id ?? d.name);
    const a = xyz(n.pos);
    put('person', d.name ?? d.id, a, { quest: questsAt(a), note: d.title ?? '' });
  }
  // the games' hosts (a person beside a sign, or the sign itself read)
  for (const h of W.hosts ?? []) put('game', `host: ${h.name ?? h.id}`, h.at, { note: 'offers a game' });

  // ---- the makers' boxes: the ones in the open, and the chests (a temple's, a court's, the story's)
  const courts = Object.values(level.finds?.courts ?? (level.finds?.court ? { one: level.finds.court } : {}));
  for (const b of boxes?.list ?? []) {
    const a = xyz(b.pos), P = b.place ?? {};
    const inCourt = courts.some((c) => { const q = xyz(c.box ?? c.at); return q && Math.hypot(q[0] - a[0], q[2] - a[2]) < 4; });
    const chest = !!(P.chest || P.temple || P.story || inCourt);
    const box = stagesAt.find((s) => s.box === b.id);
    put(chest ? 'chest' : 'box', `${ITEMS[b.item]?.name ?? b.item}${chest ? ' (chest)' : ''}`, a, { quest: box?.title ?? questsAt(a), note: P.hint ?? P.note ?? '' });
  }

  // ---- the fragments of the singing light
  (FRAGMENTS[id] ?? []).forEach((f, i) => put('shard', `fragment of light ${i + 1}`, f, { note: 'a fragment of the singing light' }));

  // ---- the foes that stand somewhere: placed by hand (by part), and the relics' guards
  for (const part of parts) for (const p of PLACED[part] ?? []) { const [x, z] = shiftAt(part, p.at); put('foe', p.archetype, [x, null, z], { note: 'placed by hand (src/foe-worlds.js)' }); }
  if (!level.peaceful && !level.foes?.waves && !level.foes?.own) for (const r of relics.items) if (r.pos) put('foe', 'a relic’s guard', r.pos, { note: 'guards the relic, once a save' });

  // ---- one of each within 1.5 m (the dev menu lists a start and the ship, a door twice…)
  const kept = [];
  for (const m of out) if (!kept.some((k) => k.kind === m.kind && k.name === m.name && near3(k.pos, m.pos, 1.5))) kept.push(m);
  const landing = kept.find((m) => m.kind === 'landing')?.pos ?? xyz(level.ship?.pos ?? level.spawn);
  return { markers: kept, landing, hidden };
}

/**
 * The walkable ground from the landing and how empty it is (a grid, cell metres a side): each cell's ground height
 * (the highest surface: a roof is ground), the cells reached from the landing's over steps no higher than a slope of
 * `slope`, the walking distance to each (over the grid), and how far each is from the nearest thing of interest.
 * The emptiness is measured inside the convex hull of the things and the landing (beyond it: the outskirts).
 * → { x0, z0, cell, nx, nz, h, walk (m, -1 not reached), empty (m to anything, -1 not measured), worst: { pos, metres, walk },
 *     share (of the ground reached in the hull, the share more than `far` m from anything), reached (cells), hull }
 */
export function emptiness(W, markers, { landing, cell = null, far = 50, slope = 1.2, margin = 80, maxSide = 3000 } = {}) {
  const { physics, level } = W;
  const pts = markers.filter((m) => !NOT_INTEREST.has(m.kind)).map((m) => m.pos);
  const all = [...pts, landing].filter(Boolean);
  const xs = all.map((p) => p[0]), zs = all.map((p) => p[2]), ys = all.map((p) => p[1]);
  let x0 = Math.min(...xs) - margin, x1 = Math.max(...xs) + margin, z0 = Math.min(...zs) - margin, z1 = Math.max(...zs) + margin;
  // (a world whose places stand kilometres apart, the Hangar's zones: the square round the landing)
  if (x1 - x0 > maxSide) { x0 = Math.max(x0, landing[0] - maxSide / 2); x1 = x0 + maxSide; }
  if (z1 - z0 > maxSide) { z0 = Math.max(z0, landing[2] - maxSide / 2); z1 = z0 + maxSide; }
  cell ??= Math.max(4, Math.ceil(Math.max(x1 - x0, z1 - z0) / 180));
  const nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell);
  const top = Math.max(...ys.filter(Number.isFinite)) + 150, bottom = Math.min(...ys.filter(Number.isFinite)) - 150;
  const killY = level.killY ?? -Infinity, limit = Number.isFinite(level.limit) ? level.limit : Infinity;   // (past the world's limit: not ground)
  const h = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const g = physics.groundAt(x0 + (i + 0.5) * cell, top, z0 + (j + 0.5) * cell, top - bottom);
    const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell;
    h[j * nx + i] = Number.isFinite(g) && g > killY + 0.5 && g > bottom && !(Math.abs(x) > limit || Math.abs(z) > limit) ? g : NaN;
  }
  // the walk out from the landing (Dijkstra on the grid, eight ways; a step up or down at most slope × the run)
  const walk = new Float64Array(nx * nz).fill(-1);
  const li = Math.floor((landing[0] - x0) / cell), lj = Math.floor((landing[2] - z0) / cell);
  let start = -1, best = Infinity;
  for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {   // (the landing's own cell may be the ship's hull)
    const i = li + di, j = lj + dj;
    if (i < 0 || j < 0 || i >= nx || j >= nz || !Number.isFinite(h[j * nx + i])) continue;
    const d = Math.hypot(di, dj) + Math.abs(h[j * nx + i] - landing[1]) / cell;
    if (d < best) { best = d; start = j * nx + i; }
  }
  if (start >= 0) {
    const heap = [[0, start]];
    const push = (e) => { heap.push(e); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const r = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, rr = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return r; };
    walk[start] = 0;
    while (heap.length) {
      const [d, c] = pop();
      if (d > walk[c] && walk[c] >= 0) continue;
      const i = c % nx, j = (c - i) / nx;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
        const n = b * nx + a, hn = h[n];
        if (!Number.isFinite(hn)) continue;
        const run = Math.hypot(di, dj) * cell, rise = Math.abs(hn - h[c]);
        if (rise > slope * run) continue;
        const nd = d + Math.hypot(run, rise);
        if (walk[n] < 0 || nd < walk[n]) { walk[n] = nd; push([nd, n]); }
      }
    }
  }
  // how far each cell reached is from the nearest thing of interest (flat metres), inside the hull round them all: the
  // ground beyond the outermost things is the world's outskirts, not a stretch between two of them
  const hull = convexHull(all.map((p) => [p[0], p[2]]));
  const empty = new Float32Array(nx * nz).fill(-1);
  let worst = null, reached = 0, farCells = 0;
  for (let c = 0; c < nx * nz; c++) {
    if (walk[c] < 0) continue;
    const x = x0 + ((c % nx) + 0.5) * cell, z = z0 + (Math.floor(c / nx) + 0.5) * cell;
    if (!inHull(hull, x, z)) continue;
    reached++;
    let d = Infinity;
    for (const p of pts) { const e = Math.hypot(p[0] - x, p[2] - z); if (e < d) d = e; }
    empty[c] = d;
    if (d > far) farCells++;
    if (!worst || d > worst.metres) worst = { pos: [x, h[c], z], metres: d, walk: walk[c] };
  }
  if (worst) worst = { pos: worst.pos.map((v) => Math.round(v)), metres: Math.round(worst.metres), walk: Math.round(worst.walk) };
  return { x0, z0, cell, nx, nz, h, walk, empty, worst, reached, share: reached ? +(farCells / reached).toFixed(3) : 0, far, hull };
}

/** The convex hull of [x, z] points (Andrew's monotone chain), anticlockwise in x-z. */
export function convexHull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}
/** Is (x, z) inside the hull (or within 1 m of its edge)? A hull of fewer than three points holds nothing but its points' neighbourhood. */
export function inHull(hull, x, z) {
  if (hull.length < 3) return hull.some((q) => Math.hypot(q[0] - x, q[1] - z) < 30);
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez) || 1;
    if ((ex * (z - a[1]) - ez * (x - a[0])) / l < -1) return false;
  }
  return true;
}

/** The walking distance from the landing to a point, over the grid (the nearest cell reached within two), or null. */
export function walkTo(E, p) {
  const i0 = Math.floor((p[0] - E.x0) / E.cell), j0 = Math.floor((p[2] - E.z0) / E.cell);
  let best = null;
  for (let r = 0; r <= 2 && best === null; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    const i = i0 + di, j = j0 + dj;
    if (i < 0 || j < 0 || i >= E.nx || j >= E.nz) continue;
    const w = E.walk[j * E.nx + i];
    if (w >= 0 && (best === null || w < best)) best = w;
  }
  return best === null ? null : Math.round(best);
}

/** Counts per kind ({ key: n }), every kind present (0 for none). */
export const countByKind = (markers) => Object.fromEntries(KINDS.map((k) => [k.key, markers.filter((m) => m.kind === k.key).length]));
