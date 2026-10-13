// The level design audit's critical path through a built world (scripts/level-design/audit.mjs measures it; the fragments
// of the singing light are kept off it, tests/fragments-route.test.js and scripts/fragment-spots.mjs): the landing, the
// route's quests stage by stage (its temple's door when it goes in), back to the ship, through the doorways that take you
// elsewhere and along the leading lines a leg follows. `W` is a world as tests/playthrough-agent.js loadWorld builds it.
import * as THREE from 'three';
import * as L from './lib.mjs';
import { ROUTE as MAIN_ROUTE, SUBROUTES } from '../../tests/playthrough-worlds.js';

// (a sub-level, the Overnight Train: walked from where you arrive to where you leave, SUBROUTES)
export const ROUTE = [...MAIN_ROUTE, ...SUBROUTES];
// (the mounts had partway along a world's route: { world: { after: the quest that gives it, by } })
export const MOUNTED_AFTER = { arzach: { after: 'arzach.bird', by: 'bird' } };

export const arr = (p) => (p == null ? null : p.isVector3 ? [p.x, p.y, p.z] : Array.isArray(p) ? p.slice(0, 3) : Number.isFinite(p.x) ? [p.x, p.y ?? 0, p.z] : p.at ? arr(p.at) : p.pos ? arr(p.pos) : null);

/** The world's temples, and whether a point is inside one (or in a room far overhead). */
export function templesOf(level) {
  const temples = level.temples ?? (level.temple ? [level.temple] : []);
  const inTemple = (p) => temples.some((t) => t.inside(new THREE.Vector3(...p))) || (!!temples.length && p[1] > 1200);
  return { temples, rt: level.temple, templeOf: (tid) => L.templeFor(temples, tid, level.temple), inTemple };
}

/** { path: the stops walked ({ label, kind, pos, via?, jump?, by? }), later: the mount had partway, lines, portals (both ways), oneWay (as the level lists them), spawn }. */
export function criticalPath(W, id) {
  const { level } = W;
  const sub = SUBROUTES.find((r) => r.id === id);
  const { templeOf, inTemple } = templesOf(level);
  const ground = (x, z) => W.physics.groundAt(x, 1100, z, 2500);
  const onGround = (x, z, y = null) => { const g = ground(x, z); return [x, Number.isFinite(g) ? g : y ?? 0, z]; };
  const spawn = arr(level.ship?.pos ?? level.spawn);
  const stops = [{ label: 'landing', kind: 'ship', pos: spawn }];
  const people = new Set(W.npcs.map((n) => n.def?.id).filter(Boolean));
  const kindOf = (s) => (s.talk || people.has(s.at) ? 'talk' : s.goto ? 'go' : s.bring ? 'bring' : 'do');
  let home = null;   // (a route quest's stage whose words send you home along a leading line names it: `home`)
  // (a mount had partway: Vael's bird answers at the end of its first quest, and the bell under the cloud is flown on her:
  // the stops after that quest are reached on the mount, its stretches timed at its speed)
  const later = MOUNTED_AFTER[id];
  let mountedFrom = null, pending = false;
  const met = new Set();
  const entered = new Set();   // (the temples gone into so far, by id: a world's own temple by the world's id)
  for (const p of ROUTE.find((r) => r.id === id)?.play ?? []) {
    if (pending) { mountedFrom ??= stops.length; pending = false; }
    if (later && p === later.after) pending = true;
    // (a temple whose keeper sends you home along a leading line after it, the Glass Dunes' Wim by the float-posts: `home`)
    if (p.temple && templeOf(p.id)?.outside?.door) {
      const T = templeOf(p.id), door = arr(T.outside.door.at);
      entered.add(p.id ?? id);
      stops.push({ label: 'the temple', kind: 'temple', pos: door });
      // (v1.50: a temple whose last way out, past its guardian, lets you out somewhere else, the Whale-House's keepers' hatch
      // in the divers' court: you go on from there, the hop to it not walked)
      const out = p.temple === 'done' ? arr(T.portals?.filter((q) => q.label === 'way out' && q.to).at(-1)?.to) : null;
      if (out && Math.hypot(out[0] - door[0], out[2] - door[2]) > 20) stops.push({ label: 'the temple’s way out', kind: 'temple', pos: out, jump: true });
      if (p.home) home = p.home; continue;
    }
    // (an act the route plays where someone stands, Vael's Oïa by the landing opening the main quest: a talk there)
    if (p.act && p.at) { met.add(p.at); const w = arr(W.quests.resolve(p.at)); if (w && !inTemple(w)) stops.push({ label: p.label ?? p.at, kind: people.has(p.at) ? 'talk' : 'do', pos: w }); continue; }
    if (typeof p !== 'string') continue;
    const q = W.quests.def(p);
    for (const [i, s] of (q?.stages ?? []).entries()) {
      // (a quest opened by an act earlier in the route, Bastien at the lock before the errands: its first talk is had)
      if (i === 0 && met.has(s.at ?? s.talk)) continue;
      // (a stage passed over on reaching it when its goal is met, `pass: true`: the core gadgets' last step, "take the
      // fluid wings from the Aerie", never seen by a route that has been in at that temple's door already: issue #226)
      if (s.pass && [...entered].some((t) => s.at === `temple.${t}.door`)) continue;
      // (a stage whose words send you along a leading line, "home along the marked stones": `via` names the line)
      // (a stage whose person has walked on by the time you get there, Hollin down to the root cave: `stands` names where)
      const w = arr(s.stands ? W.quests.resolve(s.stands) : W.quests.where(s)); if (w && !inTemple(w)) stops.push({ label: s.label ?? s.id, kind: kindOf(s), pos: w, ...(s.via ? { via: s.via } : {}) });
      // (a stage whose marker moves on as you go, ask Marrow, then find his bike in the hollow: `ends` names where it is done)
      const e = s.ends && arr(W.quests.resolve(s.ends)); if (e && !inTemple(e)) stops.push({ label: `${s.label ?? s.id} (done)`, kind: 'do', pos: e });
      if (s.home) home = s.home;
    }
  }
  if (pending) mountedFrom ??= stops.length;
  // (the walk back to the ship: along the line the last stage that names one sends you home by, "fly home along the lanterns")
  if (!sub) stops.push({ label: 'back to the ship', kind: 'ship', pos: spawn, ...(home ? { via: home } : {}) });   // (a sub-level ends where you step off)
  const oneWay = (level.navigationPortals ?? level.portals ?? []).filter((p) => !p.temple).map((p) => ({ at: arr(p.at ?? p.pos), to: arr(p.to), label: p.label ?? 'portal', only: !!p.oneWay })).filter((p) => p.at && p.to);
  // (a doorway is walked both ways: where a world lists only the way in, its way out is the same door backwards; not a
  // way marked `oneWay`, a hatch that only lifts from below)
  const portals = [...oneWay, ...oneWay.filter((p) => !p.only && !oneWay.some((q) => q !== p && L.flat(q.at, p.to) < 12)).map((p) => ({ at: p.to, to: p.at, label: `${p.label} (out)` }))];
  // the level's leading lines (`lines`: [{ name, points: [[x, z] or [x, y, z], …] }], a row of marked stones, a dry
  // channel, cairns: what the eye follows on the ground): a leg one carries is walked along it (lib.mjs followLines)
  const lines = ((typeof level.lines === 'function' ? level.lines() : level.lines) ?? [])
    .map((l) => ({ name: l.name, auto: l.auto, ...(l.ride ? { ride: l.ride } : {}), points: (l.points ?? []).map((p) => (p.length === 2 ? onGround(p[0], p[1]) : arr(p))).filter(Boolean) }))
    .filter((l) => l.points.length > 1);
  if (mountedFrom != null) for (let k = mountedFrom; k < stops.length; k++) stops[k].by = later.by;
  // (v1.60, issue #233: a place left by its mouth, Lorn's crystal cave, a tube 130 m long: a leg from inside it to outside
  // (or back) is walked by the mouth, not in a straight line through its wall. The level's `mouths`: [{ name, at: [x, y, z]
  // just outside it, inside(p) }]; a stop there, a waypoint as a portal's is, and the leg's two halves judged each)
  const mouths = (typeof level.mouths === 'function' ? level.mouths() : level.mouths) ?? [];
  for (let k = stops.length - 1; k > 0; k--) {
    const a = stops[k - 1], b = stops[k], m = b.jump ? null : mouths.find((q) => q.inside(a.pos) !== q.inside(b.pos));
    if (m) stops.splice(k, 0, { label: m.name, kind: 'portal', pos: arr(m.at), ...(b.by ? { by: b.by } : {}) });
  }
  // (and a leg whose straight line runs mostly over nothing, the City Floating in Space's void between its islands, is
  // no walk: the line its stage names is followed however far round the bridges go, lib.mjs followLines `overVoid`)
  const overVoid = (a, b) => {
    const n = Math.max(2, Math.ceil(L.flat(a, b) / 5));
    let none = 0;
    for (let k = 1; k < n; k++) { const t = k / n, g = ground(a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t); if (!Number.isFinite(g) || g < Math.min(a[1], b[1]) - 60) none++; }
    return none > (n - 1) / 2;
  };
  for (let k = 1; k < stops.length; k++) if (!stops[k].jump && stops[k].via && overVoid(stops[k - 1].pos, stops[k].pos)) stops[k].overVoid = true;
  const path = L.followLines(L.viaPortals(stops.filter((s, i) => i === 0 || L.dist(s.pos, stops[i - 1].pos) > 15 || i === stops.length - 1), portals), lines);
  return { path, later, lines, portals, oneWay, spawn };
}

/** The straight legs walked along a path ([[a, b]] in 3D; the hops through a doorway left out). */
export function pathSegments(path) {
  const segs = [];
  for (let i = 0; i + 1 < path.length; i++) {
    if (path[i + 1].jump) continue;
    const pts = L.legPoints(path[i], path[i + 1]);
    for (let j = 0; j + 1 < pts.length; j++) segs.push([pts[j], pts[j + 1]]);
  }
  return segs;
}

/** How far a point is from the nearest of those legs, in 3D. */
export function distanceToPath(p, segs) {
  let best = Infinity;
  for (const [a, b] of segs) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    const t = dd ? Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / dd)) : 0;
    best = Math.min(best, L.dist(p, [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t]));
  }
  return best;
}
