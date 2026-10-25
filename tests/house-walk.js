// The walker in a makers' house, shared by tests/door-bypass.js (no way round a shut door, issue #356) and
// tests/hook-reach.test.js (no hook past a lock, issue #432): a house built with its level and physics, a door shut with
// every other open, the walker's flood from a spot (a cell at a time, up what the double jump climbs, down what a fall
// doesn't hurt, never into a pit, with room for the traveller's body: tests/fragments-reach.js's steps), and its spots
// looked up by place.
import * as THREE from 'three';
import { templeOf } from '../src/temples/attachment.js';
import { Physics } from '../src/physics.js';
import { items, ITEMS } from '../src/items.js';
import { RISE } from './fragments-reach.js';
import { Door } from '../src/temples/pieces.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const UP = V(0, 1, 0);
export const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
export const own = (...ids) => { for (const id of Object.keys(ITEMS)) if (ids.includes(id)) items.grant(id); else items.revoke(id); };
/** What each house may be walked with (tests/temple-playthrough.test.js CARRY), and the wings everywhere after the Rose House. */
export const carry = (id) => (id === 'desert' ? ['backpack', 'doublejump'] : ['backpack', 'gun', 'doublejump', 'glider']);
/** The walker's cell and drop (m). */
export const WALK = { cell: 1, drop: 6 };
/** The walker's body (m): the traveller's capsule (src/player.js RADIUS), over a step, pushed no more than `give`. */
export const BODY = { r: 0.45, bottom: 0.65, top: 1.8, give: 0.05 };
export const fmt = (p) => p.toArray().map((v) => v.toFixed(1)).join(', ');

/** The house `id` built in its world: { scene, level, physics, rt }. */
export function buildHouse(id, createWorld) {
  if (typeof createWorld !== 'function') throw new TypeError('buildHouse requires the actual world constructor');
  const scene = new THREE.Scene();
  const level = quiet(() => createWorld(scene));
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  return { scene, level, physics, rt: templeOf(level, id) ?? level.temple };
}

/** A door's piece(s): the element's piece and its twins. */
export const piecesOf = (rt, id) => [rt.byId.get(id), ...(rt.twins?.get(id) ?? [])].filter(Boolean);

/** Shut `id` and open every other door of the house's links (instantly, colliders and all). */
export function onlyShut(rt, id) {
  for (const l of rt.logic.def.links) if (l.door) for (const p of piecesOf(rt, l.door)) p.setOpen?.(l.door !== id, true);
}

/** Are rooms a and b joined by the house's links without `link` (any condition: a way the logic knows)? */
export function joinedWithout(def, link) {
  const adj = new Map();
  for (const l of def.links) if (l !== link) for (const [x, y] of [[l.a, l.b], [l.b, l.a]]) (adj.get(x) ?? adj.set(x, []).get(x)).push(y);
  const seen = new Set([link.a]), q = [link.a];
  while (q.length) for (const y of adj.get(q.shift()) ?? []) if (!seen.has(y)) { if (y === link.b) return true; seen.add(y); q.push(y); }
  return false;
}

/** A door's two sides: { at: its foot, from: [a floor spot out from each face] } (world). */
export function sides(rt, physics, id) {
  const p = piecesOf(rt, id)[0], o = p.o, K = rt.kit;
  const at = K.world(...o.at), f = V(Math.sin(K.heading(o.yaw ?? 0)), 0, Math.cos(K.heading(o.yaw ?? 0))), t = (o.t ?? 0.9) / 2;
  const from = [1, -1].map((s) => {
    for (const d of [1.4, 2.2, 3.2, 4.4]) {
      const q = at.clone().addScaledVector(f, s * (t + d));
      const g = physics.groundAt(q.x, at.y + 1.6, q.z, 3.2);
      if (Number.isFinite(g) && Math.abs(g - at.y) < 1.6 && physics.rayDistance(V(q.x, g + 0.3, q.z), UP, 1.9) >= 1.5) return V(q.x, g, q.z);
    }
    return null;
  });
  return { at, from };
}

/** Is a spot harmful (in a pit, under the level's kill height)? */
export const harmful = ({ level, rt }, p) => rt.pits.some((pit) => pit.contains(p)) || (Number.isFinite(level.killY) && p.y < level.killY);

/** The walker's flood from `from`: [Vector3], each with `prev` (the spot it was reached from). */
export function walk(W, from, { cell = WALK.cell, rise = RISE.doublejump, drop = WALK.drop, max = 60000, slope = 0.7 } = {}) {
  const { physics } = W;
  const key = (x, y, z) => `${Math.round(x / cell)},${Math.round(z / cell)},${Math.round(y / 2)}`;
  const seen = new Set([key(from.x, from.y, from.z)]);
  const q = [from.clone()];
  const _o = V(), _d = V(), _c = V(), _push = V();
  const tight = (x, y, z) => { const pushed = physics.pushCapsule(_c.set(x, y, z), BODY.r, BODY.bottom, BODY.top, _push); return !!pushed && pushed.length() > BODY.give; };
  const inside = (x, y, z) => { const h = physics.rayHit(_o.set(x + 1.37e-4, y + 0.3, z + 2.91e-4), _d.set(0, -1, 0), 0.6); return !!h && !h.front; };
  let n = 0;
  while (n < q.length && n < max) {
    const c = q[n++];
    const top = Math.min(rise + 0.2, physics.rayDistance(_o.set(c.x, c.y + 0.3, c.z), UP, rise + 1) + 0.15);
    for (const [dx, dz] of [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]) {
      const x = c.x + dx, z = c.z + dz;
      const g0 = physics.groundAt(x, c.y + 0.6, z, 0.6 + drop), g1 = physics.groundAt(x, c.y + top, z, top + drop);
      for (const g of new Set([g0, g1])) {
        if (!Number.isFinite(g) || g - c.y > rise || c.y - g > drop) continue;
        if (slope && g - c.y > 0.6 && physics.groundNormal(x, g + 0.5, z).y < slope) continue;
        { const h = Math.max(c.y, g) + 0.9; if (physics.rayDistance(_o.set(c.x, h, c.z), _d.set(dx, 0, dz).normalize(), cell) < cell) continue; }
        if (g - c.y > 0.6 && physics.rayDistance(_o.set(c.x, c.y + 0.3, c.z), UP, g - c.y + 1.6) < g - c.y + 1.5) continue;
        if (physics.rayDistance(_o.set(x, g + 0.3, z), UP, 1.9) < 1.5) continue;
        // (room for the traveller's body, there and on the way: a slit beside a door or in a wall too narrow for him is no way)
        if (tight(x, g, z) || tight(c.x + dx / 2, Math.max(c.y, g), c.z + dz / 2)) continue;
        // (a floor met from inside a solid is no floor: a cell on a wall's face drops into the wall's thickness, where
        // the underside of its foot looks like ground and a body on the face's plane is pushed nowhere; the Mooring-House's
        // north wall walked from the east landing's railing to under the west landing, #444)
        if (inside(x, g, z)) continue;
        const p = V(x, g, z);
        if (harmful(W, p)) continue;
        const k = key(x, g, z);
        if (seen.has(k)) continue;
        seen.add(k);
        p.prev = c;
        q.push(p);
      }
    }
  }
  return q;
}

/** Spots looked up by place: has(p), one within `r` m across and `dy` m up or down; nearest(p, r, lo, hi). */
export function spots(list, r = 1.0, dy = 1.2) {
  const m = new Map(), k = (x, z) => `${Math.floor(x)},${Math.floor(z)}`;
  for (const p of list) { const kk = k(p.x, p.z); (m.get(kk) ?? m.set(kk, []).get(kk)).push(p); }
  const nearest = (p, rr = r, lo = -dy, hi = dy) => {
    const cx = Math.floor(p.x), cz = Math.floor(p.z), R = Math.ceil(rr);
    let best = null, bd = rr;
    for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) for (const s of m.get(`${cx + i},${cz + j}`) ?? []) {
      const d = Math.hypot(s.x - p.x, s.z - p.z), up = s.y - p.y;
      if (d <= bd && up >= lo && up <= hi) { best = s; bd = d; }
    }
    return best;
  };
  return { nearest, has: (p) => !!nearest(p) };
}

/** Spots of a list one `every` m apart (and 3 m in height). */
export const thin = (list, every = 3) => { const g = new Set(); return list.filter((p) => { const k = `${Math.round(p.x / every)},${Math.round(p.z / every)},${Math.round(p.y / 3)}`; return !g.has(k) && g.add(k); }); };

/** A floor spot in room `room`: its checkpoint's, else round the middle the house's map gives it (world), else null. */
export function seedOf(W, room) {
  const { rt, physics } = W, _o = V();
  const m = rt.marks.find((k) => k.room === room);
  const tryAt = (q) => {
    const g = physics.groundAt(q.x, q.y + 1.6, q.z, 4);
    if (!Number.isFinite(g)) return null;
    const p = V(q.x, g, q.z);
    return !harmful(W, p) && physics.rayDistance(_o.set(p.x, g + 0.3, p.z), UP, 1.9) >= 1.5 ? p : null;
  };
  if (m) { const p = tryAt(m.spot); if (p) return p; }
  const r = rt.housePlan().rooms.find((x) => x.id === room);
  if (!r) return null;
  const c = rt.kit.world(...r.pos);
  for (let rad = 0; rad <= 8; rad += 1) for (let k = 0; k < (rad ? 12 : 1); k++) {
    const p = tryAt(c.clone().add(V(Math.cos(k * Math.PI / 6) * rad, 0, Math.sin(k * Math.PI / 6) * rad)));
    if (p) return p;
  }
  return null;
}

/** The house's locks: links the logic can't go round, with a gate (a door or bridge element) or an item to cross. */
export function locksOf(def) {
  return def.links.filter((l) => {
    const e = l.door ? def.elements[l.door] : null;
    const gated = (e && (e.type === 'door' || e.type === 'bridge')) || l.needs?.some((n) => n !== 'hook');
    return gated && !joinedWithout(def, l);
  });
}

/** A lock's name in a finding: its door (or the way), its rooms, what it needs. */
export const lockName = (link) => `${link.door ?? `the way ${link.a} | ${link.b}`} (${link.a} | ${link.b}${link.needs ? `, needs ${link.needs.join(' ')}` : ''})`;

/**
 * A lock's two sides, shut with every other door open: { name, A, B, hasA, hasB } (the walker's flood of each, looked up
 * by place), or { name, skip } (no floor to start from; or walked across, not a lock for the walker).
 */
export function lockSides(W, link) {
  const { rt, physics } = W, def = rt.logic.def, name = lockName(link);
  const el = link.door ? def.elements[link.door] : null;
  const S = el && rt.byId.get(link.door) instanceof Door ? sides(rt, physics, link.door).from : [seedOf(W, link.a), seedOf(W, link.b)];
  if (!S[0] || !S[1]) return { name, skip: 'no floor to start from' };
  onlyShut(rt, link.door ?? null);
  const [A, B] = S.map((s) => walk(W, s));
  const [hasA, hasB] = [A, B].map((f) => spots(f));
  if (hasA.has(S[1]) || hasB.has(S[0])) return { name, skip: 'walked across (not a lock for the walker)' };
  return { name, A, B, hasA, hasB };
}
