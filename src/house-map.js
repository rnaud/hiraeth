// The house's map (issue #405, recommendation G5 of docs/design/temple-best-practices.md): inside a makers' house, the
// Start menu's House map shows it floor by floor, one tab a floor (LB / RB, Q / E), drawn in the game's ink and paper
// from the house's own plan (src/temples/house-plan.js: what its layout built, never drawn by hand). On it:
//   - the rooms you have stood in, solid; once the little chest's map is yours, the rest too, faint (before it, only
//     those you have seen);
//   - the traveller, where he stands and the way he faces;
//   - the doors, shut or open, a lock with its keyhole until its key is in; the great key's door in gold, the
//     guardian's door ringed in red, and the guardian's hall marked.
// The scout's ping (logic.next) is as it was: the map shows, it never points.
// What is saved (the save's flags, src/game-state.js): temple.<id>.found.<map element> (the map is yours) and
// temple.<id>.been.<room> (rooms stood in, src/temples/runtime.js trackRooms).
//
//   houseHere(level, player)           the house the traveller is inside (a TempleRuntime), or null
//   houseView(rt, { game, player })    what the map shows now: { plan, seen, has, floors (the tabs), here, me, doors }
//   floorTabs(plan, seen, has, here)   the tabs: the floors with something to show, each { id, label, name }
//   drawHouseMap(ctx, view, floor, o)  draw one floor on a canvas 2D context (the web's canvas or engine/raster.js's)
//   new HouseMapPage()                 the page's state: the floor chosen in each house, .turn(d); .draw(canvas, view)
//
// The same drawing on the web (src/ui.js, the Start menu's House map page) and in an engine (engine/menus.js, its picture
// sent to BridgeMenu.cs as the Map's are). Tests: tests/house-map.test.js.

import { roomAt } from './temples/house-plan.js';

export const HOUSE_MAP = {
  w: 960, h: 600,          // px: the picture (its aspect the page's box)
  pad: 40,                 // px round the plan
  legend: 34,              // px: the key's strip at the foot
  ink: '#2b211f', paper: '#f6ecd3', wash: '#ead6a6', faint: 'rgba(43,33,31,0.42)', faintWash: '#efe4c9',
  red: '#c8483a', gold: '#e2b23c', door: '#7a4a2a',
  face: "600 15px 'Avenir Next', Futura, 'Helvetica Neue', Roboto, sans-serif",
  small: "500 13px 'Avenir Next', Futura, 'Helvetica Neue', Roboto, sans-serif",
};

const ROOM_KINDS = new Set(['hall', 'round', 'corridor', 'slab', 'ring']);
const WAYS = new Set(['stairs', 'ramp', 'bridge']);

/** The makers' house the traveller is inside (the level's temples: a merged world has two), or null. */
export function houseHere(level, player) {
  const p = player?.pos;
  if (!p) return null;
  return (level?.temples ?? (level?.temple ? [level.temple] : [])).find((t) => t?.kit?.chart && t.def?.logic && t.inside?.(p)) ?? null;
}

/** The element of a house's logic that is its map's chest (type 'map'), or null. */
export const mapElement = (logic) => Object.entries(logic?.elements ?? {}).find(([, e]) => e.type === 'map')?.[0] ?? null;

/**
 * The rooms seen in a house: those stood in (temple.<id>.been.<room>), the way in, and those where something has been
 * done (a lit eye, a key taken, an open door's both sides: a save from before the map was kept them too).
 */
export function seenRooms(rt, game) {
  const L = rt.logic, def = rt.def.logic, out = new Set([def.entry]);
  for (const r of Object.keys(def.rooms ?? {})) if (game?.flag?.(`temple.${rt.id}.been.${r}`)) out.add(r);
  for (const [id, e] of Object.entries(def.elements ?? {})) {
    if (!e.room) continue;
    if (L.isLit?.(id) || L.isFound?.(id) || (e.type === 'gadget' && L.gadget)) out.add(e.room);
  }
  return out;
}

/** A floor's tab: 1F the ground floor, 2F, 3F over it, B1, B2 under it. */
export function floorLabel(floors, id) {
  const i = floors.findIndex((f) => f.id === id), g = floors.findIndex((f) => f.name === 'ground floor');
  const k = i - (g < 0 ? 0 : g);
  return k >= 0 ? `${k + 1}F` : `B${-k}`;
}
const COUNT = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
/** A floor in words, under its tab: the ground floor, one floor up, two floors down. */
export function floorName(floors, id) {
  const label = floorLabel(floors, id), below = label.startsWith('B'), n = Number(below ? label.slice(1) : label.slice(0, -1)) - (below ? 0 : 1);
  if (!n) return 'Ground floor';
  return `${COUNT[n] ?? n} floor${n > 1 ? 's' : ''} ${below ? 'down' : 'up'}`;
}

/**
 * Is a shape shown, and how: 'seen' (solid), 'faint' (on the map, not yet seen) or null (not drawn). `part`: 'wall' (a
 * wall's or a round hall's ring: seen from any room beside it) or 'floor' (the room on it).
 */
export function shapeState(s, seen, has, part = s.kind === 'wall' ? 'wall' : 'floor') {
  const rooms = part === 'wall' ? s.rooms ?? (s.room ? [s.room] : []) : s.room ? [s.room] : [];
  if (rooms.some((r) => seen.has(r))) return 'seen';
  return has ? 'faint' : null;
}

/** The tabs: every floor once the map is yours, else those with a room seen (and the one you stand on). */
export function floorTabs(plan, seen, has, here = null) {
  const shown = new Set(has ? plan.floors.map((f) => f.id) : plan.rooms.filter((r) => seen.has(r.id)).map((r) => r.floor));
  if (here) shown.add(here);
  return plan.floors.filter((f) => shown.has(f.id)).map((f) => ({ id: f.id, label: floorLabel(plan.floors, f.id), name: floorName(plan.floors, f.id) }));
}

/** What the house's map shows now. `player`: { pos, heading, frame } (the traveller), or null. */
export function houseView(rt, { game = rt.game, player = rt.player } = {}) {
  const plan = rt.housePlan();
  const seen = seenRooms(rt, game);
  const mapId = mapElement(rt.def.logic);
  const has = !!mapId && rt.logic.isFound(mapId);
  let me = null, here = null;
  if (player?.pos && rt.kit) {
    const p = rt.kit.local(player.pos.clone());
    const dir = player.frame?.dir ? player.frame.dir(player.heading, player.pos.clone().set(0, 0, 0)) : { x: Math.sin(player.heading ?? 0), z: Math.cos(player.heading ?? 0) };
    const yaw = rt.kit.yaw ?? 0, c = Math.cos(-yaw), s = Math.sin(-yaw);
    // (the way he faces, turned into the kit's frame: the kit stands turned yaw about up)
    me = { x: p.x, y: p.y, z: p.z, dx: dir.x * c + dir.z * s, dz: -dir.x * s + dir.z * c };
    const room = roomAt(plan, [p.x, p.y, p.z]);
    here = plan.rooms.find((r) => r.id === room)?.floor ?? null;
  }
  const L = rt.logic;
  const doors = plan.doors.map((d) => ({ ...d, open: !!L.isOpen?.(d.id), unlocked: !d.lock || !!L.unlocked?.(d.id) }));
  return { id: rt.id, name: rt.def.name, plan, seen, has, me, here, doors, floors: floorTabs(plan, seen, has, here) };
}

// ------------------------------------------------------------------ the drawing

/**
 * The plan's metres → the picture's pixels: the whole house (every floor) fitted, north (−z) up as the page has it, or
 * turned a quarter (the way in on the left, the house running right) when it is deeper than it is wide, so a long house
 * fills a wide picture. `at(x, z)` → [px, py]; `vec(dx, dz)` → the same turn for a direction.
 */
export function mapFrame(plan, { w = HOUSE_MAP.w, h = HOUSE_MAP.h, pad = HOUSE_MAP.pad, legend = HOUSE_MAP.legend } = {}) {
  const [x0, z0, x1, z1] = plan.bounds;
  const bw = Math.max(1, x1 - x0), bh = Math.max(1, z1 - z0), aw = w - 2 * pad, ah = h - 2 * pad - legend;
  const turned = bh > bw * 1.15 && aw > ah;
  const [cw, ch] = turned ? [bh, bw] : [bw, bh];
  const k = Math.min(aw / cw, ah / ch);
  const ox = pad + (aw - cw * k) / 2, oy = pad + (ah - ch * k) / 2;
  // (turned: +z to the right, +x down, a quarter turn of the north-up view: never a mirror)
  return turned
    ? { k, turned, at: (x, z) => [ox + (z - z0) * k, oy + (x - x0) * k], vec: (dx, dz) => [dz, dx] }
    : { k, turned, at: (x, z) => [ox + (x - x0) * k, oy + (z1 - z) * k], vec: (dx, dz) => [dx, -dz] };
}

/** The wall's runs between its doorways (holes from the floor `fy` up, on a wall that rises past several), in metres along it. */
function wallRuns(s, fy = s.y0, span = 0) {
  const cut = (s.holes ?? []).filter((q) => { const rel = s.y0 + q.y0 - fy; return rel > -1 && rel < span + 2.5; }).sort((a, b) => a.x0 - b.x0);
  const out = [];
  let from = 0;
  for (const q of cut) { if (q.x0 - from > 0.05) out.push([from, q.x0]); from = Math.max(from, q.x1); }
  if (s.L - from > 0.05) out.push([from, s.L]);
  return out;
}
/** The picture's angle (radians, clockwise from up) of a direction on the plan. */
const angleOf = (F, dx, dz) => { const [vx, vy] = F.vec(dx, dz); return Math.atan2(vx, -vy); };

/**
 * Draw one floor of a house's map (`view`: houseView) on a 2D context `w` × `h` px: the paper, the floors and passages
 * washed, the ways up hatched, the walls inked with their doorways open, the doors, the guardian's hall, the traveller,
 * and the key along the foot.
 */
export function drawHouseMap(ctx, view, floor, { w = HOUSE_MAP.w, h = HOUSE_MAP.h } = {}) {
  const C = HOUSE_MAP, { plan, seen, has } = view;
  const F = mapFrame(plan, { w, h }), k = F.k;
  // the paper, a ruled border
  ctx.save();
  ctx.setTransform?.(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.setLineDash?.([]);
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.lineWidth = 0.8; ctx.strokeRect(15, 15, w - 30, h - 30);
  const F0 = plan.floors.find((f) => f.id === floor) ?? { y: 0, top: 0 }, span = F0.top - F0.y;
  const onFloor = (s) => s.floor === floor || (s.to && s.to === floor) || !!s.floors?.includes(floor);
  const shapes = plan.shapes.filter(onFloor).map((s) => ({ s, st: shapeState(s, seen, has, 'floor'), ring: shapeState(s, seen, has, 'wall') })).filter((x) => x.st || x.ring);
  const rect = (x0, z0, x1, z1) => poly([F.at(x0, z0), F.at(x1, z0), F.at(x1, z1), F.at(x0, z1)]);
  const line = (st, width) => { ctx.strokeStyle = st === 'seen' ? C.ink : C.faint; ctx.lineWidth = st === 'seen' ? width : Math.max(1.2, width * 0.5); ctx.setLineDash?.(st === 'seen' ? [] : [6, 4]); };
  const poly = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  const quad = (s) => {
    const [ax, ay] = F.at(s.a[0], s.a[2]), [bx, by] = F.at(s.b[0], s.b[2]), L = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / L, ny = (bx - ax) / L, r = (s.w / 2) * k;
    return { pts: [[ax + nx * r, ay + ny * r], [bx + nx * r, by + ny * r], [bx - nx * r, by - ny * r], [ax - nx * r, ay - ny * r]], ax, ay, bx, by, nx, ny, r, L };
  };
  // the floors and passages, washed (faint: a ghost of a wash)
  for (const { s, st } of shapes) {
    if (!st || !ROOM_KINDS.has(s.kind) || s.floor !== floor) continue;
    ctx.fillStyle = st === 'seen' ? C.wash : C.faintWash;
    if (s.kind === 'hall') { if (s.hasFloor === false) continue; rect(s.x - s.w / 2, s.z - s.d / 2, s.x + s.w / 2, s.z + s.d / 2); ctx.fill(); }
    else if (s.kind === 'round') { if (s.hasFloor === false || s.oculus < 0) continue; const [x, y] = F.at(s.x, s.z); ctx.beginPath(); ctx.arc(x, y, (s.r + (s.t ?? 1.4) / 2) * k, 0, Math.PI * 2); ctx.fill(); }
    else if (s.kind === 'ring') {
      // a balcony round a well (the Footprint's): its arc washed, the well open inside it, its holes (the drops) left open
      // with a dashed lip and an arrow down
      const pt = (a, r) => F.at(s.x + Math.sin(a) * r, s.z + Math.cos(a) * r), N = Math.max(8, Math.round(((s.a1 - s.a0) / (Math.PI * 2)) * 96));
      const arc = [];
      for (let i = 0; i <= N; i++) arc.push(pt(s.a0 + ((s.a1 - s.a0) * i) / N, s.r1));
      for (let i = N; i >= 0; i--) arc.push(pt(s.a0 + ((s.a1 - s.a0) * i) / N, s.r0));
      poly(arc); ctx.fill();
      line(st, 1.2); ctx.beginPath(); for (let i = 0; i <= N; i++) { const [x, y] = pt(s.a0 + ((s.a1 - s.a0) * i) / N, s.r0); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();
      ctx.setLineDash?.([]);
      for (const h of s.holes ?? []) {
        const [hx, hy] = F.at(h.x, h.z);
        ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(hx, hy, h.r * k, 0, Math.PI * 2); ctx.fill();
        line(st, 1.4); ctx.setLineDash?.([3, 3]); ctx.stroke(); ctx.setLineDash?.([]);
        arrow(ctx, hx, hy - h.r * k * 0.55, hx, hy + h.r * k * 0.55, st === 'seen' ? C.ink : C.faint, 'down');
        ctx.fillStyle = st === 'seen' ? C.wash : C.faintWash;
      }
    }
    else { rect(s.x0, s.z0, s.x1, s.z1); ctx.fill(); }
  }
  // the ways up and down: stairs hatched, ramps and bridges outlined, the lifts and winds dashed rings
  for (const { s, st } of shapes) {
    if (!st) continue;
    if (WAYS.has(s.kind)) {
      const q = quad(s);
      ctx.fillStyle = st === 'seen' ? C.wash : C.faintWash; poly(q.pts); ctx.fill();
      line(st, 1.4); poly(q.pts); ctx.stroke();
      if (s.kind === 'stairs') {
        const n = Math.min(20, Math.max(3, Math.round(q.L / (0.9 * k))));
        ctx.beginPath();
        for (let i = 1; i < n; i++) { const t = i / n, cx = q.ax + (q.bx - q.ax) * t, cy = q.ay + (q.by - q.ay) * t; ctx.moveTo(cx + q.nx * q.r, cy + q.ny * q.r); ctx.lineTo(cx - q.nx * q.r, cy - q.ny * q.r); }
        ctx.lineWidth = 0.9; ctx.stroke();
      }
      // (an arrow up the way it rises, from this floor)
      const up = s.b[1] >= s.a[1] ? 1 : -1, [fx, fy] = up > 0 ? [q.ax, q.ay] : [q.bx, q.by], [tx, ty] = up > 0 ? [q.bx, q.by] : [q.ax, q.ay];
      if (Math.abs(s.b[1] - s.a[1]) > 0.5 && q.L > 18) arrow(ctx, fx + (tx - fx) * 0.25, fy + (ty - fy) * 0.25, tx - (tx - fx) * 0.2, ty - (ty - fy) * 0.2, st === 'seen' ? C.ink : C.faint, s.floor === floor ? 'up' : 'down');
    } else if (s.kind === 'lift' || s.kind === 'updraft' || s.kind === 'shaft') {
      const ps = s.kind === 'lift' ? [s.path[0], s.path.at(-1)].filter(Boolean).map((p) => F.at(p[0], p[2])) : [F.at(s.x, s.z)];
      line(st, 1.4); ctx.setLineDash?.([4, 3]);
      for (const [x, y] of ps) { ctx.beginPath(); ctx.arc(x, y, s.r * k, 0, Math.PI * 2); ctx.stroke(); }
      if (s.kind === 'lift' && ps.length > 1) { ctx.beginPath(); ctx.moveTo(...ps[0]); ctx.lineTo(...ps[1]); ctx.stroke(); }
      ctx.setLineDash?.([]);
    }
  }
  // the walls, inked, their doorways left open
  ctx.lineCap = 'round';
  for (const { s, ring } of shapes) {
    if (!ring) continue;
    // (a wall of a floor below rising past this one, a tall hall's or a well's: thin, the room open to below)
    const below = s.floor !== floor ? 0.45 : 1;
    if (s.kind === 'wall') {
      line(ring, Math.max(1.4, Math.min(5, s.t * k) * below));
      ctx.beginPath();
      for (const [u0, u1] of wallRuns(s, F0.y, span)) { const [x0, y0] = F.at(s.a[0] + s.dir[0] * u0, s.a[1] + s.dir[1] * u0), [x1, y1] = F.at(s.a[0] + s.dir[0] * u1, s.a[1] + s.dir[1] * u1); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
      ctx.stroke();
    } else if (s.kind === 'round') {
      const R = s.r + (s.t ?? 1.4) / 2, N = 72, rel = (q) => s.y + (q.y0 ?? 0) - F0.y;
      const gap = (a) => (s.gaps ?? []).some((q) => rel(q) > -1 && rel(q) < span + 2.5 && Math.abs(Math.atan2(Math.sin(a - q.a), Math.cos(a - q.a))) * R < q.w / 2);
      line(ring, Math.max(1.4, Math.min(5, (s.t ?? 1.4) * k) * below));
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        if (gap(a)) { pen = false; continue; }
        const [x, y] = F.at(s.x + Math.sin(a) * R, s.z + Math.cos(a) * R);
        if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        pen = true;
      }
      ctx.stroke();
    }
  }
  ctx.setLineDash?.([]);
  // the guardian's hall: its sign in its middle
  const boss = plan.rooms.find((r) => r.boss);
  const roomShown = (id) => seen.has(id) || has;
  if (boss && boss.floor === floor && roomShown(boss.id)) { const [x, y] = F.at(boss.pos[0], boss.pos[2]); guardianSign(ctx, x, y, 13, seen.has(boss.id)); }
  // the doors on this floor (of a room drawn)
  for (const d of view.doors) {
    if (d.floor !== floor || !(roomShown(d.a) || roomShown(d.b))) continue;
    const st = seen.has(d.a) || seen.has(d.b) ? 'seen' : 'faint';
    const [x, y] = F.at(d.pos[0], d.pos[2]);
    const ang = doorAngle(plan, d, floor, F);
    doorMark(ctx, x, y, ang, d, st, k);
  }
  // the traveller
  if (view.me && view.here === floor) {
    const [x, y] = F.at(view.me.x, view.me.z);
    you(ctx, x, y, angleOf(F, view.me.dx, view.me.dz));
  }
  legend(ctx, view, { w, h });
  ctx.restore();
}

/** The angle (radians, on the picture) of the wall a door stands in: its nearest wall on the floor, else across its link. */
function doorAngle(plan, d, floor, F) {
  let best = null, bd = 4;
  for (const s of plan.shapes) {
    if (s.kind !== 'wall' || !(s.floors ?? [s.floor]).includes(floor)) continue;
    const px = d.pos[0] - s.a[0], pz = d.pos[2] - s.a[1], u = px * s.dir[0] + pz * s.dir[1];
    if (u < -1 || u > s.L + 1) continue;
    const off = Math.abs(px * s.dir[1] - pz * s.dir[0]);
    if (off < bd) { bd = off; best = s; }
  }
  // (the leaf is drawn along x before it is turned: the angle of the wall's run on the picture, less a quarter)
  if (best) return angleOf(F, best.dir[0], best.dir[1]) - Math.PI / 2;
  const A = plan.rooms.find((r) => r.id === d.a)?.pos, B = plan.rooms.find((r) => r.id === d.b)?.pos;
  return A && B ? angleOf(F, B[0] - A[0], B[2] - A[2]) : 0;
}

function doorMark(ctx, x, y, ang, d, st, k) {
  const C = HOUSE_MAP, faint = st !== 'seen', shut = !d.open, len = Math.max(10, Math.min(26, 3.2 * k)), th = Math.max(4, Math.min(8, 0.9 * k));
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.globalAlpha = faint ? 0.45 : 1;
  const great = d.lock === 'big';
  // the door's leaf: solid while shut, an empty frame once open (a bridge: its planks, dashed while sunk)
  ctx.lineWidth = 1.6; ctx.strokeStyle = C.ink;
  if (d.bridge) { ctx.setLineDash?.(shut ? [3, 3] : []); ctx.strokeRect(-len / 2, -th / 2, len, th); ctx.setLineDash?.([]); }
  else if (shut) { ctx.fillStyle = great ? C.gold : C.door; ctx.fillRect(-len / 2, -th / 2, len, th); ctx.strokeRect(-len / 2, -th / 2, len, th); }
  else { ctx.fillStyle = C.paper; ctx.fillRect(-len / 2, -th / 2, len, th); ctx.strokeRect(-len / 2, -th / 2, len, th); }
  ctx.rotate(-ang);
  // a lock: its keyhole while it waits for its key; the great key's door its diamond, gold
  if (great) { diamond(ctx, 0, 0, 9, !d.unlocked ? C.gold : C.paper); if (!d.unlocked) keyhole(ctx, 0, 0, 4.2); }
  else if (d.lock && !d.unlocked) { ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); keyhole(ctx, 0, 0, 3.4); }
  // the guardian's door: ringed in red
  if (d.guardian) { ctx.strokeStyle = C.red; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(0, 0, Math.max(len, 18) * 0.62, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}
function keyhole(ctx, x, y, r) {
  ctx.fillStyle = HOUSE_MAP.ink;
  ctx.beginPath(); ctx.arc(x, y - r * 0.35, r * 0.45, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - r * 0.3, y + r * 0.75); ctx.lineTo(x + r * 0.3, y + r * 0.75); ctx.lineTo(x + r * 0.12, y - r * 0.2); ctx.lineTo(x - r * 0.12, y - r * 0.2); ctx.closePath(); ctx.fill();
}
function diamond(ctx, x, y, r, fill) {
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = HOUSE_MAP.ink; ctx.stroke();
}
/** The guardian's sign: a red ring, an eye in it (the makers' watcher). */
function guardianSign(ctx, x, y, r, seen) {
  const C = HOUSE_MAP;
  ctx.save();
  ctx.globalAlpha = seen ? 1 : 0.5;
  ctx.fillStyle = C.paper; ctx.strokeStyle = C.red; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - r * 0.62, y); ctx.quadraticCurveTo(x, y - r * 0.62, x + r * 0.62, y); ctx.quadraticCurveTo(x, y + r * 0.62, x - r * 0.62, y); ctx.closePath();
  ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
/** The traveller: the world map's red arrow, inked, pointing the way he faces (dx, dz: north is −z, up). */
function you(ctx, x, y, a) {
  const C = HOUSE_MAP, s = 11;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(0, -s * 1.25); ctx.lineTo(s * 0.85, s * 0.9); ctx.lineTo(0, s * 0.4); ctx.lineTo(-s * 0.85, s * 0.9); ctx.closePath();
  ctx.fillStyle = C.ink; ctx.translate(1.6, 1.6); ctx.fill(); ctx.translate(-1.6, -1.6);
  ctx.fillStyle = C.red; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, colour, kind) {
  ctx.save();
  ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = 1.6; ctx.setLineDash?.([]);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0), r = 6;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - 0.5) * r, y1 - Math.sin(a - 0.5) * r); ctx.lineTo(x1 - Math.cos(a + 0.5) * r, y1 - Math.sin(a + 0.5) * r); ctx.closePath(); ctx.fill();
  ctx.restore();
  return kind;
}
/** The key along the foot: what the marks are; before the map, that only the rooms seen are drawn. */
function legend(ctx, view, { w, h }) {
  const C = HOUSE_MAP, y = h - 32;
  ctx.font = C.small; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = C.ink;
  let x = 30;
  const word = (s) => { ctx.fillStyle = C.ink; ctx.fillText(s, x, y); x += (ctx.measureText?.(s)?.width ?? s.length * 7) + 22; };
  you(ctx, x + 6, y, 0); x += 20; word('You');
  ctx.fillStyle = C.door; ctx.fillRect(x, y - 4, 20, 8); ctx.lineWidth = 1.4; ctx.strokeStyle = C.ink; ctx.strokeRect(x, y - 4, 20, 8); x += 28; word('Door shut');
  diamond(ctx, x + 8, y, 8, C.gold); keyhole(ctx, x + 8, y, 3.8); x += 24; word('Great key’s door');
  guardianSign(ctx, x + 9, y, 9, true); x += 26; word('Guardian');
  if (view.has) { ctx.save(); ctx.strokeStyle = C.faint; ctx.lineWidth = 1.4; ctx.setLineDash?.([5, 4]); ctx.strokeRect(x, y - 6, 22, 12); ctx.restore(); x += 30; word('Not yet seen'); }
  else { ctx.font = C.small; ctx.fillStyle = 'rgba(43,33,31,0.7)'; ctx.textAlign = 'right'; ctx.fillText('No map yet: only the rooms you have seen', w - 30, y); ctx.textAlign = 'left'; }
}

/** The House map page's state: the floor chosen in each house (the traveller's own when it first opens). */
export class HouseMapPage {
  constructor() { this.chosen = new Map(); }
  /** The floor shown in `view` (one of its tabs). */
  floor(view) {
    const tabs = view.floors, want = this.chosen.get(view.id);
    return (tabs.find((f) => f.id === want) ?? tabs.find((f) => f.id === view.here) ?? tabs[0])?.id ?? null;
  }
  /** Back to the traveller's floor (each time the page opens). */
  reset(view) { if (view) this.chosen.delete(view.id); }
  /** LB / RB: the floor below / above (in the tabs' order, lowest first), held at the ends. */
  turn(view, d) {
    const tabs = view.floors, i = tabs.findIndex((f) => f.id === this.floor(view));
    const j = Math.max(0, Math.min(tabs.length - 1, i + Math.sign(d)));
    if (j === i) return false;
    this.chosen.set(view.id, tabs[j].id);
    return true;
  }
  pick(view, id) { if (view.floors.some((f) => f.id === id)) { this.chosen.set(view.id, id); return true; } return false; }
}
