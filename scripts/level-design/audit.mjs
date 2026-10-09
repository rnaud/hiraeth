// The level design audit's measurements (.claude/skills/level-design-qc/SKILL.md), in node, read-only
// against the game: each route world is built as the play-through builds it (tests/playthrough-agent.js
// loadWorld: the level with its temple, real collision, the story with its people and quests, the makers'
// boxes), its points of interest gathered, its critical path laid through the route's quests
// (tests/playthrough-worlds.js ROUTE) from the landing and back to the ship, and both measured
// (scripts/level-design/lib.mjs): spacing, the empty stretches, the walks back, remote dead ends, the
// landmarks (a height grid of the collision, tall blobs in it) and what sees them, each leg's guidance,
// height, the kinds of stop; then scored.
//
//   node scripts/level-design/audit.mjs [<out-dir>] [--worlds desert,arzach] [--cell 6]
// Writes <out-dir>/report.json, <out-dir>/<world>-map.png (+ <world>-map.svg: the same with names) and
// <out-dir>/views.json (a view from high over each world and a few along its path, for
// scripts/design-qc/capture.mjs). The sight lines use the collision (what you can stand on or bump into)
// and the terrain; things you walk through (grass, flowers, most foliage) don't block them.
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'level-design'));
mkdirSync(OUT, { recursive: true });

await import(join(ROOT, 'tests/register-gadgets.js'));
const A = await import(join(ROOT, 'tests/playthrough-agent.js'));
const { ROUTE } = await import(join(ROOT, 'tests/playthrough-worlds.js'));
const THREE = await import('three');
const L = await import(join(ROOT, 'scripts/level-design/lib.mjs'));
const { TRIALS } = await import(join(ROOT, 'src/trials/data.js'));
const { kitTrialsFor } = await import(join(ROOT, 'src/trials/kit-data.js'));

const worlds = (arg('worlds') ?? A.ORDER.join(',')).split(',').filter(Boolean);
const report = { date: new Date().toISOString(), worlds: [] };
const views = [];
const arr = (p) => (p == null ? null : p.isVector3 ? [p.x, p.y, p.z] : Array.isArray(p) ? p.slice(0, 3) : Number.isFinite(p.x) ? [p.x, p.y ?? 0, p.z] : p.at ? arr(p.at) : p.pos ? arr(p.pos) : null);
const r1 = (v) => Math.round(v * 10) / 10;

for (const id of worlds) {
  const t0 = Date.now();
  const W = A.loadWorld(id);
  const { level, physics } = W;
  const rt = level.temple;
  const inTemple = (p) => !!rt && (rt.inside(new THREE.Vector3(...p)) || p[1] > 1200);
  const ground = (x, z) => physics.groundAt(x, 1100, z, 2500);
  const onGround = (x, z, y = null) => { const g = ground(x, z); return [x, Number.isFinite(g) ? g : y ?? 0, z]; };

  // ---- the points of interest
  const pois = [];
  const put = (kind, name, p, o = {}) => { const a = arr(p); if (a && a.every(Number.isFinite) && !inTemple(a)) pois.push({ kind, name, pos: a, ...o }); };
  const spawn = arr(level.ship?.pos ?? level.spawn);
  put('ship', 'the ship', spawn, { main: true });
  for (const n of W.npcs) if (!n.pooled && n.def?.id) put('person', n.def.name ?? n.def.id, n.pos, { optional: true });
  const quests = [...W.quests.defs.values()].filter((d) => d.world === id);
  const routeQuests = new Set(ROUTE.find((r) => r.id === id)?.play.filter((p) => typeof p === 'string') ?? []);
  for (const q of quests) for (const s of q.stages) put(q.main || routeQuests.has(q.id) ? 'goal' : q.id.startsWith('box.') ? 'box goal' : 'side goal', `${q.title ?? q.id}: ${s.label ?? s.id}`, W.quests.where(s), { main: q.main || routeQuests.has(q.id), optional: !(q.main || routeQuests.has(q.id)) });
  for (const b of W.boxes.list) put('box', `box: ${b.item ?? b.id}`, b.pos, { optional: true });
  if (rt?.outside?.door) put('temple', `the temple's door`, rt.outside.door.at, { optional: !ROUTE.find((r) => r.id === id)?.play.some((p) => p.temple) });
  if (TRIALS[id]) { const [x, z] = TRIALS[id].marker; put('trial', `trial: ${TRIALS[id].name}`, onGround(x, z)); }
  for (const T of kitTrialsFor(id)) put('trial', `makers' run: ${T.name}`, T.origin, { optional: true });
  for (const pt of level.portals ?? []) if (!pt.temple && pt.at) put('door', pt.label ?? 'a way in', pt.at, { optional: true });
  if (level.finds?.court) put('court', "the makers' court", level.finds.court.at ?? level.finds.court.box ?? level.finds.court.frame?.origin, { optional: true });
  // things to stop for that are neither people nor quests (a bowl to fill, a cold camp, a wreck: a level's `sights`)
  for (const s of (typeof level.sights === 'function' ? level.sights() : level.sights) ?? []) put('sight', s.name, s.at, { optional: true });
  for (const p of pois) if (p.kind === 'trial') p.optional = true;
  const places = L.dedupe(pois, 6);

  // ---- the critical path: the landing, the route's quests stage by stage (its temple's door when it goes in), back to the ship
  const stops = [{ label: 'landing', kind: 'ship', pos: spawn }];
  const people = new Set(W.npcs.map((n) => n.def?.id).filter(Boolean));
  const kindOf = (s) => (s.talk || people.has(s.at) ? 'talk' : s.goto ? 'go' : s.bring ? 'bring' : 'do');
  for (const p of ROUTE.find((r) => r.id === id)?.play ?? []) {
    if (p.temple && rt?.outside?.door) { stops.push({ label: 'the temple', kind: 'temple', pos: arr(rt.outside.door.at) }); continue; }
    if (typeof p !== 'string') continue;
    const q = W.quests.def(p);
    for (const s of q?.stages ?? []) {
      const w = arr(W.quests.where(s)); if (w && !inTemple(w)) stops.push({ label: s.label ?? s.id, kind: kindOf(s), pos: w });
      // (a stage whose marker moves on as you go, ask Marrow, then find his bike in the hollow: `ends` names where it is done)
      const e = s.ends && arr(W.quests.resolve(s.ends)); if (e && !inTemple(e)) stops.push({ label: `${s.label ?? s.id} (done)`, kind: 'do', pos: e });
    }
  }
  stops.push({ label: 'back to the ship', kind: 'ship', pos: spawn });
  const oneWay = (level.navigationPortals ?? level.portals ?? []).filter((p) => !p.temple).map((p) => ({ at: arr(p.at ?? p.pos), to: arr(p.to), label: p.label ?? 'portal' })).filter((p) => p.at && p.to);
  // (a doorway is walked both ways: where a world lists only the way in, its way out is the same door backwards)
  const portals = [...oneWay, ...oneWay.filter((p) => !oneWay.some((q) => q !== p && L.flat(q.at, p.to) < 12)).map((p) => ({ at: p.to, to: p.at, label: `${p.label} (out)` }))];
  const path = L.viaPortals(stops.filter((s, i) => i === 0 || L.dist(s.pos, stops[i - 1].pos) > 15 || i === stops.length - 1), portals);

  // ---- the height grid (the collision's tops seen from above), for landmarks and the map
  const pts = [...places.map((p) => p.pos), ...path.map((s) => s.pos)].filter((p) => L.flat(p, spawn) < 1500);   // (the Hangar's far zones: off this map)
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[2]);
  let x0 = Math.min(...xs) - 120, x1 = Math.max(...xs) + 120, z0 = Math.min(...zs) - 120, z1 = Math.max(...zs) + 120;
  const side = Math.min(2000, Math.max(x1 - x0, z1 - z0));
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; x0 = cx - side / 2; z0 = cz - side / 2;
  const cell = +arg('cell', Math.max(4, Math.round(side / 200)));
  const nx = Math.ceil(side / cell), nz = nx;
  const top = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const g = ground(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell); top[j * nx + i] = Number.isFinite(g) && g > -2000 ? g : -Infinity; }
  const grid = { x0, z0, cell, nx, nz, top };
  // (and the level's `beacons`: tall things seen over everything that the collision doesn't make tall, a smoke
  // column, a mast with its pennant: { name, top: [x, y, z], height }, aimed at as a landmark is)
  const beacons = ((typeof level.beacons === 'function' ? level.beacons() : level.beacons) ?? []).map((b) => ({ pos: arr(b.top), height: b.height, area: 0, beacon: b.name })).filter((b) => b.pos);
  const landmarks = [...L.landmarksFrom(grid, { min: 25, win: Math.max(3, Math.round(60 / cell)) }), ...beacons];

  // ---- sight: the collision, and the terrain under the ray
  const base = level.ground?.heightAt ? (x, z) => level.ground.heightAt(x, z) : null;
  const _o = new THREE.Vector3(), _d = new THREE.Vector3();
  const los = (a, b) => {
    const d = L.dist(a, b);
    if (d < 1) return true;
    _o.set(...a); _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    // (from the landing the eye stands inside the ship's own hull: step through what is within 16 m of it)
    let left = d, hit = physics.rayDistance(_o, _d, left);
    for (let k = 0; k < 4 && hit < 16 && L.flat(a, spawn) < 3; k++) { _o.addScaledVector(_d, hit + 0.3); left -= hit + 0.3; hit = physics.rayDistance(_o, _d, left); }
    if (hit < left - 3) return false;
    if (base) for (let s = 6; s < d - 3; s += 6) { const t = s / d, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t, h = base(x, z); if (Number.isFinite(h) && y < h - 0.3) return false; }
    return true;
  };

  // ---- the measures
  // (between two stops on the ground, a straight line rides high over a basin you'd cross down in it: the points of a leg
  // over 200 m are laid on the ground where it lies under them, up to 70 m down; not over a deep drop, a shaft or the sky)
  const below = (x, y, z, d) => physics.groundAt(x, y, z, d);   // (the first surface under a point, not the highest at x, z: a porch roof)
  const onFoot = (p) => { const g = below(p[0], p[1] + 2, p[2], 6); return Number.isFinite(g) && Math.abs(p[1] - g) < 3; };
  const drape = (pos, a, b) => {
    if (b.jump || L.flat(a.pos, b.pos) < 200 || !onFoot(a.pos) || !onFoot(b.pos)) return pos;
    const g = below(pos[0], pos[1], pos[2], 70);
    return Number.isFinite(g) && g < pos[1] ? [pos[0], g + 1, pos[2]] : pos;
  };
  const samples = L.samplePath(path, 10, drape);
  const metres = L.pathLength(path);
  const gaps = L.interestGaps(samples, places.filter((p) => p.kind !== 'ship' || true), 40);
  const seen = L.visibleCount(samples.filter((_, i) => i % 3 === 0).map((s) => s.pos), landmarks, los);
  const fromSpawn = L.visibleCount([spawn], landmarks, los)[0];
  // (Vael's bird answers only at the end of its main quest: the path there is walked and glided)
  const mount = id === 'arzach' ? null : level.mountName ?? (level.vehicles?.length ? 'vehicle' : null);
  const by = mount === 'bird' ? 'bird' : /bike/i.test(mount ?? '') ? 'bike' : /skiff/i.test(mount ?? '') ? 'skiff' : 'foot';
  const m = {
    travel: { by: by === 'foot' ? 'running' : `on the ${by}`, speed: L.TRAVEL[by], mount },
    spacing: L.spacing(places),
    path: { stops: path.length, metres: Math.round(metres), seconds: Math.round(metres / L.RUN) },
    gaps,
    returns: L.returnLegs(path, places, { drape }),
    remote: L.remote(places, samples),
    gravity: L.gravity(places, samples),
    landmarks: { count: landmarks.length, fromSpawn, seenShare: seen.length ? +(seen.filter((n) => n > 0).length / seen.length).toFixed(2) : 0, meanSeen: seen.length ? +(seen.reduce((a, b) => a + b, 0) / seen.length).toFixed(1) : 0 },
    guidance: L.legGuidance(path, landmarks, los),
    vertical: L.vertical(places.filter((p) => L.flat(p.pos, spawn) < 1500 && p.pos[1] < 900), samples.filter((q) => L.flat(q.pos, spawn) < 1500 && q.pos[1] < 900), ground),   // (interiors far overhead or away: left out)
    pacing: L.pacing(path),
    spawn: { firstGoal: path[1] ? Math.round(L.dist(path[0].pos, path[1].pos)) : 0, near: places.filter((p) => p.kind !== 'ship' && L.dist(p.pos, spawn) < 80).length },
  };
  const scores = L.scoreWorld(m);
  report.worlds.push({ id, title: W.meta.title, places: places.map((p) => ({ names: p.names, kinds: p.kinds, pos: p.pos.map(r1), main: p.main, optional: p.optional })), path: path.map((s) => ({ ...s, pos: s.pos.map(r1) })), landmarks, metrics: m, scores });

  // ---- the map, and its names
  const map = L.mapPng(grid, { path: path.map((s) => s.pos), gaps: gaps.gaps.slice(0, 4), pois: places.filter((p) => p.kind !== 'ship'), landmarks, spawn });
  writeFileSync(join(OUT, `${id}-map.png`), map.png);
  const label = (p, t, c) => { const [x, y] = map.toPx(p); return `<text x="${(x + 6).toFixed(0)}" y="${(y + 3).toFixed(0)}" fill="${c}" font-size="10" font-family="sans-serif" paint-order="stroke" stroke="#fff" stroke-width="2.5">${String(t).replace(/[&<>]/g, '')}</text>`; };
  writeFileSync(join(OUT, `${id}-map.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="${map.w}" height="${map.h}"><image href="${id}-map.png" width="${map.w}" height="${map.h}"/>${path.map((s, i) => label(s.pos, `${i}. ${s.label}`, '#2b211f')).join('')}${places.filter((p) => p.optional).map((p) => label(p.pos, p.names[0], '#3a7a5a')).join('')}</svg>`);

  // ---- the views: from high over the world, then along the path (the landing toward the first goal, the longest empty stretch, the blind legs)
  const fov = 60, h = side * 0.62 / Math.tan((fov / 2) * Math.PI / 180);
  views.push({ world: id, name: `${id}-above`, eye: [cx, Math.max(...pts.map((p) => p[1])) + h, cz - 1], target: [cx, 0, cz], fov, hour: 12, note: 'from above' });
  const along = (at, to, name, note) => { const from = onGround(at[0], at[2], at[1]); const e = [from[0], from[1] + 2.2, from[2]]; /* (a point on a leg may hang in the air: stand on the ground under it) */ const back = [to[0] - from[0], 0, to[2] - from[2]], n = Math.hypot(back[0], back[2]) || 1; views.push({ world: id, name, eye: [e[0] - back[0] / n * 4, e[1] + 1.2, e[2] - back[2] / n * 4].map(r1), target: [to[0], to[1] + 3, to[2]].map(r1), player: from.map(r1), fov: 60, hour: 12, note }); };
  if (path[1]) along(path[0].pos, path[1].pos, `${id}-landing`, `the landing, looking toward "${path[1].label}"`);
  const lg = gaps.longest; if (lg.from) along(lg.from, lg.to, `${id}-gap`, `the longest empty stretch: ${lg.metres} m`);
  for (const leg of m.guidance.legs.filter((l) => l.how === 'blind').slice(0, 1)) { const a = path.find((s) => s.label === leg.from), b = path.find((s) => s.label === leg.to); if (a && b) along(a.pos, b.pos, `${id}-blind`, `a blind leg: "${leg.from}" → "${leg.to}" (${leg.metres} m)`); }

  W.dispose();
  console.log(`${id.padEnd(9)} ${String(places.length).padStart(3)} places, path ${String(m.path.metres).padStart(5)} m (${Math.round(m.path.seconds / 60)} min), longest gap ${lg.metres} m, ${m.returns.filter((r) => r.empty).length} empty walks back, ${landmarks.length} landmarks (${fromSpawn} from the landing, ${Math.round(m.landmarks.seenShare * 100)} % of the path), guided ${Math.round(m.guidance.guidedShare * 100)} % → ${scores.total}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(join(OUT, 'views.json'), JSON.stringify({ views }, null, 2));
console.log('\nscores (1-5): landmarks, wayfinding, density, spacing, loops, optional, verticality, pacing, onboarding → mean');
for (const w of report.worlds) console.log(`${w.id.padEnd(9)} ${Object.values(w.scores.criteria).map((c) => c.score).join('  ')}  → ${w.scores.total}`);
console.log(`\nreport.json, maps and views.json in ${OUT}`);
process.exit(0);
