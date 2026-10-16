// The fight temples' room hazards beyond the desert's geysers (issue #341; docs/design/fight-temples.md "The hazards"):
// each world's own, all run on lanes across a room (a strip the whole room long, `w` wide, on whole metres in its table)
// so they read from the iso camera and can be learnt:
//
//   gust   (Vael's Wind Cloister)  pale chevrons run down the lane for `warn` s, then the wind blows through it: him
//          shoved along it (a little harm, a flinch), every foe in it buffeted (a cut) and carried toward the wall at
//          its end, slammed there (another)
//   stone  (Lorn's Drowned Mill)    a millstone rises at the lane's head and rolls down it: him crushed (a heart) and
//          thrown aside, every foe it rolls over crushed
//   pour   (the Moon Foundry)       a channel cut in the floor glows at its rim, then the slag runs down it and lies there
//          a while: in it he burns (half a heart a tick), every foe in it too
//
// A room's table: `hazard: { kind, every, n, lanes: [{ along: 'x' | 'z', at, w, dir: ±1 }] }` (`at` across the room,
// `dir` the way it blows, rolls or flows). Every `every` s of a wave (the last wave a quarter sooner; Gentle 1.6 times as
// rarely and half the harm) `n` lanes go: the one he is in (or nearest him) first. A roll's i-frames take him through.
// The pure rules first (the tests hold them), then the run's side (meshes, hits), which session.js drives.

import * as THREE from 'three';
import { makeMaterial } from '../materials.js';

export const HAZARD = {
  gust: { warn: 1.1, secs: 0.7, push: 11, harm: 0.25, foePush: 15, buffet: 1, slam: 1, word: 'a gust' },
  stone: { warn: 1.4, speed: 8.5, radius: 1.35, harm: 1, crush: 3, throw: 8, word: 'a millstone' },
  pour: { warn: 1.5, secs: 3.6, flow: 14, tick: 0.7, harm: 0.5, burn: 1, cool: 0.6, word: 'a channel of slag' },
  last: 0.75, gentle: 1.6,
};

/** A lane's rectangle on the floor: the whole room along it, `w` wide across it. */
export function laneRect(room, lane) {
  const h = lane.w / 2;
  return lane.along === 'x' ? { x: room.x.slice(), z: [lane.at - h, lane.at + h] } : { x: [lane.at - h, lane.at + h], z: room.z.slice() };
}
/** Is (x, z) in the lane (`pad` m wider each side)? */
export function inLane(room, lane, x, z, pad = 0) {
  const r = laneRect(room, lane);
  return x > r.x[0] - pad && x < r.x[1] + pad && z > r.z[0] - pad && z < r.z[1] + pad;
}
/** How far along the lane (m from its head, the end it starts from: the far end from `dir`) a point is. */
export function alongLane(room, lane, x, z) {
  const [a0, a1] = lane.along === 'x' ? room.x : room.z, v = lane.along === 'x' ? x : z;
  return lane.dir > 0 ? v - a0 : a1 - v;
}
/** The lane's length (the room's side along it). */
export const laneLength = (room, lane) => (lane.along === 'x' ? room.x[1] - room.x[0] : room.z[1] - room.z[0]);
/** The point `s` m down the lane from its head, on its middle line: [x, z]. */
export function lanePoint(room, lane, s) {
  const [a0, a1] = lane.along === 'x' ? room.x : room.z, v = lane.dir > 0 ? a0 + s : a1 - s;
  return lane.along === 'x' ? [v, lane.at] : [lane.at, v];
}
/** The lane's way, flat: [dx, dz]. */
export const laneDir = (lane) => (lane.along === 'x' ? [lane.dir, 0] : [0, lane.dir]);

/**
 * Which lanes go this round: the one he stands in, or else the nearest him, first; then others at random, `n` in all.
 * Returns their indices.
 */
export function pickLanes(room, lanes, at, n, rng = Math.random) {
  if (!lanes?.length || n <= 0) return [];
  const across = (l) => Math.abs((l.along === 'x' ? at.z : at.x) - l.at) - l.w / 2;
  const order = lanes.map((l, i) => i).sort((a, b) => across(lanes[a]) - across(lanes[b]));
  const out = [order[0]], rest = order.slice(1);
  while (out.length < n && rest.length) out.push(rest.splice(Math.floor(rng() * rest.length), 1)[0]);
  return out;
}
/** How often a room's hazard comes (s): its `every`, the last wave's sooner, Gentle's rarer; 0 none. */
export function hazardEvery(room, { last = false, gentle = false } = {}, H = HAZARD) {
  const z = room?.hazard;
  return z?.every ? z.every * (last ? H.last : 1) * (gentle ? H.gentle : 1) : 0;
}

// ------------------------------------------------------------------ the run's side
const FLAT = (color, glow = 0) => makeMaterial({ color, flat: true, ...(glow ? { glow } : {}) });
/** A flat strip on the floor, `len` along x by `w` across z, its middle at the origin (laid by layLane). */
const strip = (len, w, mat, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w).rotateX(-Math.PI / 2), mat); m.position.y = y; m.renderOrder = 2; m.userData.noCollide = true; return m; };
/** A group set along a lane: its local x is the lane's way (dir), its middle at the lane's middle. */
function layLane(g, room, lane, y = 0) {
  const L = laneLength(room, lane), [cx, cz] = lanePoint(room, lane, L / 2), [dx, dz] = laneDir(lane);
  g.position.set(cx, y, cz);
  g.rotation.y = Math.atan2(-dz, dx);   // (local +x onto the lane's way)
  return L;
}

/** A chevron pointing +x, flat. */
function chevronGeo(w) {
  const s = new THREE.Shape(), a = w * 0.36, t = 0.32;
  s.moveTo(0.5, 0); s.lineTo(-0.2, a); s.lineTo(-0.2 - t, a); s.lineTo(0.5 - t, 0); s.lineTo(-0.2 - t, -a); s.lineTo(-0.2, -a); s.closePath();
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
}

/** A millstone: a thick stone disc on its edge, its axle across the lane (local z), a glyph ring on each face. */
function millstoneModel(P, r) {
  const g = new THREE.Group();
  const stone = makeMaterial({ color: P.wall2, color2: P.wall, color3: P.wall3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.8, 18).rotateX(Math.PI / 2), stone);
  const ring = FLAT(P.glyph, 0.7);
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.TorusGeometry(r * 0.62, 0.06, 5, 24), ring); m.position.z = s * 0.41; body.add(m); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.0, 8).rotateX(Math.PI / 2), FLAT(P.ink));
  body.add(hub);
  g.add(body);
  g.traverse((o) => { o.userData.noCollide = true; });
  return Object.assign(g, { body });
}

/**
 * The hazards of a temple's rooms, run: `env` { ctx, def, player, foes, tool, sfx, sound, gentle, mine: () => foes of
 * the wave, onHit(what) }. The channels of the pour are cut into the floor from the start (drawn always); everything
 * else shows only while it comes and goes. update(dt, { fighting, room, last }) each frame; clear() at the end.
 */
export function roomHazards(env) {
  const { ctx, def, player, tool, gentle } = env;
  const P = def.palette, rooms = def.rooms;
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const pale = FLAT(P.gust ?? '#f4f7ff', 0.85), hot = FLAT(P.glyph, 0.9), slag = FLAT(P.slag ?? P.glyph, 0.95), slag2 = FLAT(P.slag2 ?? '#ffd36a', 0.95);
  const rust = FLAT(P.cap, 0.4), dark = FLAT(P.ink), crust = FLAT(P.crust ?? '#6a5a50');
  const active = [];
  let t = 0, T = 0, count = 0;
  // the pour's channels, cut into every room's floor that has them (a dark groove, its rim in the cap's colour)
  const channels = [];
  rooms.forEach((room, ri) => {
    if (room.hazard?.kind !== 'pour') return;
    for (const lane of room.hazard.lanes) {
      const g = new THREE.Group(); g.userData.noCollide = true;
      const L = layLane(g, room, lane, 0);
      g.add(strip(L, lane.w, dark, 0.04));
      const rims = [-1, 1].map((s) => { const m = strip(L, 0.16, rust, 0.055); m.position.z = s * (lane.w / 2 - 0.08); g.add(m); return m; });
      ctx.add(g);
      channels.push({ ri, lane, g, rims });
    }
  });
  const rimsOf = (ri, lane) => channels.find((c) => c.ri === ri && c.lane === lane)?.rims ?? [];

  function hurtHim(kind, at, amount) {
    if (player.dead || player.dodge?.(at, 'strike', gentle)) return false;
    player.hurt?.(amount * (gentle ? 0.5 : 1), kind);
    player.flinch?.();
    env.onHit?.(kind);
    return true;
  }
  const hurtFoe = (f, dir, damage, source) => env.foes?.hurt?.(f, 'world', _w.set(dir[0] + 1e-3, 0, dir[1]).normalize(), { damage, source });

  /** One lane's hazard begun: its warning on the floor. */
  function start(ri, lane) {
    const room = rooms[ri], kind = room.hazard.kind, H = HAZARD[kind];
    const g = new THREE.Group(); g.userData.noCollide = true;
    const L = layLane(g, room, lane, 0);
    const a = { ri, room, lane, kind, H, g, L, t: 0, hitHim: false, hit: new Set(), ticks: new Map(), tickHim: 0 };
    if (kind === 'gust') {
      // pale chevrons running down the lane the way it will blow
      a.chev = [];
      const geo = chevronGeo(lane.w);
      for (let s = 0.8; s < L; s += 2.2) { const m = new THREE.Mesh(geo, pale); m.position.set(s - L / 2, 0.08, 0); m.renderOrder = 2; m.userData.noCollide = true; g.add(m); a.chev.push(m); }
    } else if (kind === 'stone') {
      // the lane's edges in rust, and the millstone rising at its head
      for (const s of [-1, 1]) { const m = strip(L, 0.14, rust, 0.07); m.position.z = s * (lane.w / 2 - 0.07); g.add(m); }
      a.stone = millstoneModel(P, H.radius);
      a.stone.position.set(-L / 2 + H.radius, -H.radius, 0);
      g.add(a.stone);
    } else if (kind === 'pour') {
      a.rims = rimsOf(ri, lane);
      a.fill = strip(1, lane.w - 0.3, slag, 0.065); a.fill.visible = false; g.add(a.fill);
      a.vein = strip(1, 0.22, slag2, 0.07); a.vein.visible = false; g.add(a.vein);
      a.crust = strip(1, lane.w - 0.3, crust, 0.066); a.crust.visible = false; g.add(a.crust);
    }
    ctx.add(g);
    active.push(a);
    count++;
  }
  function stop(a) {
    a.g.removeFromParent();
    if (a.rims) for (const m of a.rims) m.material = rust;
    active.splice(active.indexOf(a), 1);
  }

  /** The point s m down a's lane, and his place along and across it. */
  const along = (a, p) => alongLane(a.room, a.lane, p.x, p.z);
  const inIt = (a, p, pad = 0) => inLane(a.room, a.lane, p.x, p.z, pad);

  function step(a, dt) {
    a.t += dt;
    const { H, lane, room, L } = a, dir = laneDir(lane), live = (env.mine?.() ?? []).filter((f) => f.alive);
    const blowing = a.t >= H.warn;
    if (a.kind === 'gust') {
      for (const m of a.chev) { m.position.x = ((m.position.x + L / 2 + dt * (blowing ? 16 : 4)) % L) - L / 2; m.visible = !blowing || a.t < H.warn + H.secs * 0.8; }
      if (!blowing) return a.t;
      if (!a.blew) {
        a.blew = true;
        env.sfx?.whoosh?.();
        for (let i = 0; i < 30; i++) {
          const [x, z] = lanePoint(room, lane, Math.random() * L * 0.7);
          tool?.drops?.add({ pos: _v.set(x + (lane.along === 'z' ? (Math.random() - 0.5) * lane.w : 0), 0.4 + Math.random() * 1.6, z + (lane.along === 'x' ? (Math.random() - 0.5) * lane.w : 0)), vel: _w.set(dir[0] * 18, 0.3, dir[1] * 18), drag: 0.6, grav: 0, size: 0.05, stretch: 6, life: 0.5 + Math.random() * 0.3, color: i % 3 ? '#ffffff' : P.glyph });
        }
      }
      // him: shoved along it, once
      if (!a.hitHim && inIt(a, player.pos, 0.2) && !player.dead) {
        a.hitHim = true;
        if (hurtHim('gust', player.pos.clone().addScaledVector(_v.set(dir[0], 0, dir[1]), -2), H.harm)) player.vel?.addScaledVector(_v.set(dir[0], 0.15, dir[1]), H.push);
      }
      // the foes in it: carried down it to the wall, slammed there
      const [e0, e1] = lane.along === 'x' ? room.x : room.z;
      for (const f of live) {
        if (!inIt(a, f.pos, 0.3)) continue;
        if (!a.caught?.has(f)) { (a.caught ??= new Set()).add(f); hurtFoe(f, dir, H.buffet, 'gust'); if (!f.alive) continue; }
        const r = f.def.radius ?? 0.5, k = lane.along === 'x' ? 'x' : 'z';
        const end = dir[lane.along === 'x' ? 0 : 1] > 0 ? e1 - r - 0.1 : e0 + r + 0.1;
        const v = f.pos[k] + Math.sign(end - f.pos[k]) * Math.min(Math.abs(end - f.pos[k]), H.foePush * dt);
        f.pos[k] = v; f.model?.group?.position.copy(f.pos);
        if (Math.abs(end - v) < 0.05 && !a.hit.has(f)) { a.hit.add(f); hurtFoe(f, dir, H.slam, 'gust'); }
      }
      return a.t >= H.warn + H.secs ? -1 : a.t;
    }
    if (a.kind === 'stone') {
      const s0 = H.radius;
      if (!blowing) { const k = a.t / H.warn; a.stone.position.y = -H.radius + (2 * H.radius) * Math.min(1, k * 1.4); a.stone.body.rotation.z = Math.sin(a.t * 14) * 0.04 * k; return a.t; }
      if (!a.rolled) { a.rolled = true; env.sfx?.gate?.(); env.sound?.foeWarn?.('machine'); }
      const s = s0 + (a.t - H.warn) * H.speed;
      a.stone.position.set(s - L / 2, H.radius, 0);
      a.stone.body.rotation.z = -(s - s0) / H.radius;
      if (Math.random() < 0.5) { const [x, z] = lanePoint(room, lane, s - H.radius * 0.8); tool?.drops?.add({ pos: _v.set(x, 0.15, z), vel: _w.set((Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3), drag: 1.5, grav: 12, size: 0.06, stretch: 1.5, life: 0.5, color: P.inkLite }); }
      const near = (p, r) => inIt(a, p, r * 0.5) && Math.abs(along(a, p) - s) < H.radius + r;
      if (!a.hitHim && near(player.pos, 0.4) && !player.dead) {
        a.hitHim = true;
        const [cx, cz] = lanePoint(room, lane, s);
        if (hurtHim('millstone', _v.set(cx, 0, cz).clone(), H.harm)) {
          // (thrown out of its way, to the nearer side)
          const side = lane.along === 'x' ? Math.sign(player.pos.z - lane.at || 1) : Math.sign(player.pos.x - lane.at || 1);
          player.vel?.addScaledVector(_v.set(lane.along === 'x' ? 0 : side, 0.3, lane.along === 'x' ? side : 0), H.throw);
        }
      }
      for (const f of live) if (!f.def.hover && !a.hit.has(f) && near(f.pos, f.def.radius ?? 0.5)) { a.hit.add(f); hurtFoe(f, dir, H.crush, 'millstone'); }
      return s > L + H.radius ? -1 : a.t;
    }
    // the pour: the rim glows, the slag runs down, lies, crusts over and is gone
    const tf = a.t - H.warn;
    const glowRim = !blowing ? (Math.sin(a.t * (6 + 10 * a.t / H.warn)) > -0.2) : tf < H.secs;
    for (const m of a.rims) m.material = glowRim ? hot : rust;
    if (!blowing) return a.t;
    if (!a.poured) { a.poured = true; env.sfx?.splash?.(); env.sound?.foeWarn?.('ink'); }
    const front = Math.min(L, tf * H.flow), lying = tf < H.secs;
    for (const m of [a.fill, a.vein]) { m.visible = lying && front > 0.05; m.scale.x = front; m.position.x = -L / 2 + front / 2; }
    a.crust.visible = !lying; a.crust.scale.x = L; a.crust.position.x = 0;
    if (lying && Math.random() < 0.6) { const [x, z] = lanePoint(room, lane, Math.random() * front); tool?.glow?.add?.({ pos: _v.set(x, 0.2, z), vel: _w.set(0, 1.5 + Math.random() * 2, 0), drag: 1, size: 0.06, life: 0.6, color: P.slag2 ?? '#ffd36a' }); }
    if (lying) {
      const inSlag = (p, pad) => inIt(a, p, pad) && along(a, p) < front;
      if (!player.dead && inSlag(player.pos, -0.15)) {
        if ((a.tickHim -= dt) <= 0) { a.tickHim = H.tick; const [cx, cz] = lanePoint(room, lane, along(a, player.pos)); hurtHim('slag', _v.set(cx, 0, cz).clone(), H.harm); }
      } else a.tickHim = 0;
      for (const f of live) {
        if (f.def.hover || !inSlag(f.pos, 0)) continue;
        const k = (a.ticks.get(f) ?? 0) - dt;
        if (k <= 0) { a.ticks.set(f, H.tick); hurtFoe(f, dir, H.burn, 'slag'); } else a.ticks.set(f, k);
      }
    }
    return tf >= H.secs + H.cool ? -1 : a.t;
  }

  return {
    get active() { return active.length; },
    get count() { return count; },
    /** (the checks: the lanes under way now, { kind, ri, lane, t }) */
    get list() { return active.map((a) => ({ kind: a.kind, ri: a.ri, lane: a.lane, t: a.t })); },
    /** Every frame: while a wave is fought in a room with a hazard, its lanes go every so often; those under way run on. */
    update(dt, { fighting = false, room = -1, last = false } = {}) {
      t += dt;
      const R = rooms[room], every = fighting ? hazardEvery(R, { last, gentle }) : 0;
      if (every && (T += dt) >= every) {
        T = 0;
        const busy = new Set(active.filter((a) => a.ri === room).map((a) => a.lane));
        for (const i of pickLanes(R, R.hazard.lanes, player.pos, R.hazard.n ?? 1)) if (!busy.has(R.hazard.lanes[i])) start(room, R.hazard.lanes[i]);
      } else if (!every) T = 0;
      for (const a of active.slice()) if (step(a, dt) < 0) stop(a);
    },
    /** (the checks: a lane begun now) */
    start,
    clear() {
      for (const a of active.slice()) stop(a);
      for (const c of channels) for (const m of c.rims) m.material = rust;
      T = 0;
    },
    dispose() { this.clear(); for (const c of channels) c.g.removeFromParent(); channels.length = 0; },
  };
}
