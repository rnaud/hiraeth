// The contact audit (src/contact-audit.js; docs/systems/movement.md, "Contact"): the drawn surfaces you
// stand on and climb against the collision, in made-up scenes and in every world; what you stand on
// that moves (src/carriers.js) for the feet; and the real traveller's soles on a riding disc.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { auditContact, formatContact, drawnSurfaces } from '../src/contact-audit.js';
import { standGround } from '../src/carriers.js';
import { StepLag } from '../src/locomotion.js';
import { LEVELS } from '../src/levels/index.js';
import { Player } from '../src/player.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = (f) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; } };
const mesh = (scene, geo, { at = [0, 0, 0], free = false, hidden = false, name = '' } = {}) => {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  m.position.set(...at); m.name = name;
  if (free) m.userData.noCollide = true;
  if (hidden) m.visible = false;
  scene.add(m);
  return m;
};

test('the audit finds a drawn trim over a lower floor, a stand-in inside a drawn rock, and a disc drawn above its solid', () => {
  const scene = new THREE.Scene();
  mesh(scene, new THREE.BoxGeometry(200, 1, 200), { at: [0, -0.5, 0], name: 'floor' });
  // a ledge whose drawn trim stands 0.2 m over its collision top (the Belfry's stair ledges)
  mesh(scene, new THREE.BoxGeometry(6, 2, 4), { at: [20, 1, 0], name: 'ledge' });
  mesh(scene, new THREE.BoxGeometry(6.2, 0.3, 4.2), { at: [20, 2.05, 0], free: true, name: 'trim' });
  // a drawn boulder with a stand-in a metre smaller inside it (Vael II's rock)
  mesh(scene, new THREE.SphereGeometry(4, 24, 16), { at: [-20, 4, 0], free: true, name: 'drawn boulder' });
  mesh(scene, new THREE.IcosahedronGeometry(3, 0), { at: [-20, 4, 0], hidden: true, name: 'stand-in' });
  // a moving disc whose drawn lip stands over its solid's top
  const disc = { group: new THREE.Group(), solid: { pos: V(0, 3, 30), r: 2, top: 3, vel: V(), flat: true }, id: 'disc' };
  disc.group.position.set(0, 3, 30);
  disc.group.add(new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.5, 24).translate(0, 0.05, 0), new THREE.MeshBasicMaterial()));
  disc.group.userData.noCollide = true;
  scene.add(disc.group);
  const physics = new Physics(scene);
  const r = auditContact({ physics, scene, solids: [disc], cell: 0.5 });
  const of = (issue, name) => r.groups.filter((g) => g.issue === issue && g.name.includes(name));
  assert.ok(of('feet sink', 'trim').length && Math.abs(of('feet sink', 'trim')[0].max - 0.2) < 0.02, formatContact(r));
  assert.ok(of('climbs inside', 'drawn boulder').length && of('climbs inside', 'drawn boulder')[0].max > 0.5, formatContact(r));
  assert.ok(of('carrier sinks', 'disc').length, formatContact(r));
  // the other way round: the trim's drawn top is 0.2 m over the ledge you would really stand on
  assert.ok(of('walks through', 'trim').length && Math.abs(of('walks through', 'trim')[0].max - 0.2) < 0.02, formatContact(r));
  assert.ok(r.checked.walk > 100, `drawn tops checked: ${r.checked.walk}`);
  assert.equal(r.groups.filter((g) => g.name.includes('floor')).length, 0, 'the floor is drawn as it collides');
  // the same scene with the trim solid, the boulder colliding as drawn and the disc's top flush: nothing off
  const clean = new THREE.Scene();
  mesh(clean, new THREE.BoxGeometry(200, 1, 200), { at: [0, -0.5, 0] });
  mesh(clean, new THREE.BoxGeometry(6, 2, 4), { at: [20, 1, 0] });
  mesh(clean, new THREE.BoxGeometry(6.2, 0.3, 4.2), { at: [20, 2.05, 0] });
  mesh(clean, new THREE.SphereGeometry(4, 24, 16), { at: [-20, 4, 0] });
  disc.solid.top = 3.3;
  clean.add(disc.group);
  const r2 = auditContact({ physics: new Physics(clean), scene: clean, solids: [disc], cell: 0.5 });
  assert.equal(Object.keys(r2.counts).length, 0, formatContact(r2));
});

test('the drawn surfaces name the mesh each hit came from', () => {
  const scene = new THREE.Scene();
  for (let i = 0; i < 5; i++) mesh(scene, new THREE.BoxGeometry(1, 1, 1), { at: [i * 3, 0, 0], name: `box ${i}` });
  const d = drawnSurfaces(scene);
  for (let i = 0; i < 5; i++) {
    const hit = d.bvh.raycastFirst(new THREE.Ray(V(i * 3, 5, 0.1), V(0, -1, 0)), THREE.DoubleSide);
    assert.equal(d.owner(hit.faceIndex), `box ${i}`);
  }
});

test('the feet find a moving floor: its top under them, level, and not when it is the one you ride', () => {
  const scene = new THREE.Scene();
  mesh(scene, new THREE.BoxGeometry(50, 1, 50), { at: [0, -0.5, 0] });
  const physics = new Physics(scene);
  const disc = { solid: { pos: V(0, 6, 0), r: 2, top: 6, vel: V() } };
  let riding = null;
  const G = standGround(physics, () => [disc], () => riding);
  const up = V(0, 1, 0);
  assert.ok(Math.abs(G.heightAbove(V(0.5, 6.02, 0), up, 0.6) - 0.02) < 1e-6, 'on the disc');
  assert.ok(Math.abs(G.heightAbove(V(3, 6.02, 0), up, 0.6) - 6.02) < 1e-6, 'beside it: the floor');
  assert.ok(Math.abs(G.groundAt(0.5, 7, 0) - 6) < 1e-6);
  assert.deepEqual(G.groundNormal(0.5, 7, 0).toArray(), [0, 1, 0]);
  riding = disc;
  assert.ok(G.heightAbove(V(0.5, 6.02, 0), up, 0.6) > 6, 'the vehicle you ride is not under your feet');
});

test('a riding disc’s rise is not a step: the drawn body rides it without lagging into it', () => {
  const lag = new StepLag(), up = V(0, 1, 0), pos = V(), dt = 1 / 60, carried = V(0, 2 * dt, 0);
  let worst = 0, plain = new StepLag(), worstPlain = 0;
  for (let i = 0; i < 120; i++) {
    pos.addScaledVector(carried, 1);
    worst = Math.max(worst, Math.abs(lag.update(dt, pos, up, true, carried)));
    worstPlain = Math.max(worstPlain, Math.abs(plain.update(dt, pos, up, true)));
  }
  assert.ok(worst < 1e-6, `carried: ${worst}`);
  assert.ok(worstPlain > 0.1, `(uncarried, the same rise read as a stair: ${worstPlain.toFixed(2)} m of lag)`);
});

// ------------------------------------------------------------------ the worlds
// What the audit still finds in each world, at max 12000 samples of each kind (the regression line: a world
// may not grow past it by more than a third and ten). Before the audit (same sampling): Vael II 1816 feet sink,
// 481 hover, 4618 climbs inside; the Deep Wood 1810 / 177 / 474; the Garden of Spheres 4604 sink, 1382 inside.
// Before its second pass (October 2026, which took every world's coarse stand-ins out): the desert 57 sink /
// 186 inside, the Buried Machine 270 / 833, the Garden 91 / 120, Lorn 61 / 35, the Deep Wood 97 / 5, the
// Hangar 7 / 86, the First Garage 5 / 34, Viridel 18 / 31, home 23 / 15.
// The third pass (October 2026) settled the rest of the list: the great wheel collides as drawn and turns
// (physics.addMover), the cross-walls' rims are solid with their passages clear of sand, Lorn II's roots are
// solid, the olives' trunks and the cypresses collide as drawn, the gates of Jaws snap as moving colliders,
// the rotunda's oculus trim is solid over its ceiling, and a sand skirt collides where it is drawn over the
// ground (sand-drifts.js misfits): walks through 46 → 6 on the desert's sand, 80 → 28 on Vael's; the Buried
// Machine's feet sink 69 → 23. Known and left, by world (docs/systems/movement.md, "Contact"):
//  - buried, desert, arzach: sand banked up a wall's foot is drawn in front of the wall a climb starts on;
//    the canyon walls' footprints (one convex hull each, sand-drifts.js) cover the canyon floor;
//  - home, bazaar: a lining drawn 0.06 m inside its shell, a market sign through an awning;
//  - spheres: the meadow's walk-through flora tops (walks through); the olives' crowns, leaves drawn round a
//    20-faced blob standing in for them (feet sink, climbs inside: up to a metre of leaves over it);
//  - temples everywhere: a shut door's edge, the oculus trim's 0.3 m lip over the opening (drawn-only on
//    purpose: the oculus stays as open to the collision as its ceiling's hole), the balls (round);
//  - taxis and the guardians' balls: a car's roof and a ball are a disc only in the middle (carrier counts).
const KNOWN = {
  desert: { sink: 8, hover: 3, inside: 15, walk: 30 }, incal: { sink: 0, hover: 0, inside: 2, walk: 0 },
  arzach: { sink: 5, hover: 0, inside: 5, walk: 34 }, arzach2: { sink: 3, hover: 1, inside: 4, walk: 2 },
  garage: { sink: 0, hover: 0, inside: 13, walk: 1 }, buried: { sink: 23, hover: 1, inside: 24, walk: 4 },
  edena: { sink: 3, hover: 0, inside: 7, walk: 28 }, spheres: { sink: 52, hover: 26, inside: 47, walk: 217 },
  perdide: { sink: 3, hover: 0, inside: 4, walk: 7 }, perdide2: { sink: 5, hover: 0, inside: 1, walk: 8 },
  bazaar: { sink: 4, hover: 0, inside: 2, walk: 2 }, atelier: { sink: 0, hover: 0, inside: 0, walk: 0 },
  home: { sink: 0, hover: 0, inside: 3, walk: 13 },
  mangrove: { sink: 0, hover: 0, inside: 6, walk: 0 },   // (the White Mangrove: solid as drawn, roots, decks, leaves and all)
  waterfall: { sink: 2, hover: 0, inside: 2, walk: 0 },   // (its mist banks: drawn only, walked through on purpose)
  saltharbour: { sink: 1, hover: 0, inside: 12, walk: 6 },   // (the Salt Harbour: hulls, houses, stairs and decks solid as drawn; a porthole or two proud of a facet)
  antennas: { sink: 1, hover: 0, inside: 3, walk: 1 },   // (the Forest of Antennas: solid where walked; the masts' legs kept clear by stand-ins too steep to stand on or climb)
  underwater: { sink: 46, hover: 0, inside: 150, walk: 93 },   // (the cafés' chair backs and the domes' ribs, drawn only; the towers' tops)
  fallenring: { sink: 2, hover: 0, inside: 13, walk: 0 },   // (the Fallen Ring: hulls, houses, posts, stairs and the interiors solid as drawn; the awnings drawn only)
};
const audits = new Map();
function audit(id) {
  if (audits.has(id)) return audits.get(id);
  const scene = new THREE.Scene();
  const level = quiet(() => LEVELS.find((l) => l.id === id).create(scene));
  const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const region = level.unsafe ? (p) => !level.unsafe(p) : null;
  const r = { level, physics, scene, ...auditContact({ physics, scene, region, solids: level.dynamic?.() ?? [], max: 12000 }) };
  audits.set(id, r);
  return r;
}

test('Vael and Vael II: what you climb and stand on is the drawn rock (no stand-in inside it, no lip over it)', () => {
  for (const id of ['arzach', 'arzach2']) {
    const r = audit(id);
    assert.ok(r.checked.wall > 8000 && r.checked.top > 4000, `${id}: ${JSON.stringify(r.checked)}`);
    // (and the Aerie's rotunda trim, whose 0.3 m lip over the oculus is drawn-only on purpose: src/temples/kit.js)
    assert.ok((r.counts['climbs inside'] ?? 0) <= 6, `${id}: ${formatContact(r)}`);
    assert.ok((r.counts['feet sink'] ?? 0) + (r.counts['feet hover'] ?? 0) <= 8, `${id}: ${formatContact(r)}`);
  }
});

test('every riding disc and pressure plate in every world is drawn flush with the top you stand on', () => {
  let flat = 0;
  for (const id of Object.keys(KNOWN)) {
    const r = audit(id);
    const solids = r.level.dynamic?.() ?? [];
    flat += solids.filter((v) => v.solid?.flat).length;
    const bad = r.groups.filter((g) => g.issue.startsWith('carrier') && solids.some((v) => v.solid?.flat && (v.id ?? v.constructor?.name) === g.name));
    assert.deepEqual(bad, [], `${id}: ${formatContact(r)}`);
  }
  assert.ok(flat >= 10, `discs and plates checked: ${flat}`);
});

test('no world grows new places where the feet sink into or hover over what is drawn, or a climber goes inside it', () => {
  for (const [id, k] of Object.entries(KNOWN)) {
    const r = audit(id), c = r.counts;
    const over = (n, known) => n > Math.ceil(known * 1.34) + 10;
    assert.ok(!over(c['feet sink'] ?? 0, k.sink), `${id}: feet sink ${c['feet sink']} (known ${k.sink})\n${formatContact(r)}`);
    assert.ok(!over(c['feet hover'] ?? 0, k.hover), `${id}: feet hover ${c['feet hover']} (known ${k.hover})\n${formatContact(r)}`);
    assert.ok(!over(c['climbs inside'] ?? 0, k.inside), `${id}: climbs inside ${c['climbs inside']} (known ${k.inside})\n${formatContact(r)}`);
    assert.ok(!over(c['walks through'] ?? 0, k.walk), `${id}: walks through ${c['walks through']} (known ${k.walk})\n${formatContact(r)}`);
    assert.ok(r.checked.walk > 400, `${id}: drawn tops checked ${r.checked.walk}`);
  }
});

test('Vael II: the traveller dropped onto its rock lands with his feet on the drawn surface', () => {
  const { physics, scene, level } = audit('arzach2');
  const drawn = drawnSurfaces(scene);
  const P = new Player(physics, { unsafe: level.unsafe, health: false });
  let n = 0, worst = 0, s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // the start plateau, the needle plateau and the great table, where the rubble, the needles' feet and the caps' rims are
  for (const [cx, cz, R] of [[0, 0, 86], [215, -250, 92], [-30, -450, 56]]) {
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      const top = physics.groundAt(x, 400, z, 600);
      if (!Number.isFinite(top) || level.unsafe(V(x, top, z))) continue;
      const hit = drawn.bvh.raycastFirst(new THREE.Ray(V(x + 1e-3, top + 3, z + 2e-3), V(0, -1, 0)), THREE.DoubleSide, 0, 6);
      if (!hit) continue;
      P.respawn(V(x, top + 1.5, z));
      P.onGround = false;
      for (let f = 0; f < 90 && !(P.onGround && f > 10); f++) P.update(1 / 60, {}, 0);
      if (!P.onGround || Math.hypot(P.pos.x - x, P.pos.z - z) > 0.3) continue;   // (slid off a slope, or stepped: not this point)
      const drawnTop = drawn.bvh.raycastFirst(new THREE.Ray(V(P.pos.x + 1e-3, P.pos.y + 1, P.pos.z + 2e-3), V(0, -1, 0)), THREE.DoubleSide, 0, 3);
      if (!drawnTop) continue;
      worst = Math.max(worst, Math.abs(drawnTop.point.y - P.pos.y));
      n++;
    }
  }
  assert.ok(n > 60, `landings: ${n}`);
  assert.ok(worst < 0.08, `the feet and the drawn rock part by up to ${worst.toFixed(2)} m`);
});

test('the real traveller rides a rising disc with his soles on its top (feet, the drawn body and the disc agree)', async () => {
  const { traveller } = await import('./gait-sim.js');
  const scene = new THREE.Scene();
  mesh(scene, new THREE.BoxGeometry(60, 1, 60), { at: [0, -0.5, 0] });
  // a riding disc as a temple's Platform is to the player: a solid in level.dynamic, moved after the player's frame
  const disc = { solid: { pos: V(0, 0.3, 0), r: 2.2, top: 0.3, vel: V(), flat: true } };
  const p = await traveller(scene, V(0, 0, 0));
  p.opts.dynamic = () => [disc];
  p.pos.set(0.4, 0.31, 0); p.vel.set(0, 0, 0); p.onGround = false;
  const H = p.humanoid, ball = (s) => H.b[`ball_${s}`].getWorldPosition(V()).y;
  const dt = 1 / 60, rows = [];
  for (let f = 0; f < 300; f++) {
    p.update(dt, {}, 0);
    p.object.updateMatrixWorld(true);
    if (f > 60) rows.push({ l: ball('l') - disc.solid.top, r: ball('r') - disc.solid.top, lag: p.object.position.y - p.pos.y, onDisc: Math.abs(p.pos.y - disc.solid.top) });
    // the disc: still for a second, then up at 2 m/s (its frame comes after the player's, as level.update does)
    const v = f > 60 ? 2 : 0;
    disc.solid.vel.set(0, v, 0); disc.solid.top += v * dt; disc.solid.pos.y = disc.solid.top;
  }
  const ballRest = H.rest.get(H.b.ball_l).p.y * (H.char.root.scale.y ?? 1);
  const worst = (k) => Math.max(...rows.map((r) => Math.abs(r[k])));
  for (const s of ['l', 'r']) {
    const lo = Math.min(...rows.map((r) => r[s])), hi = Math.max(...rows.map((r) => r[s]));
    assert.ok(lo > ballRest - 0.04 && hi < ballRest + 0.12, `${s} ball over the disc's top: ${lo.toFixed(3)}..${hi.toFixed(3)} (at rest ${ballRest.toFixed(3)})`);
  }
  // (the disc's first frame of rise comes before the player knows it moves: one 3 cm step, eased out; then none)
  assert.ok(worst('lag') < 0.035, `the drawn body behind the root: ${worst('lag').toFixed(3)} m`);
  const riding = rows.slice(30).map((r) => Math.abs(r.lag));
  assert.ok(Math.max(...riding) < 0.005, `riding, the drawn body lags by up to ${Math.max(...riding).toFixed(3)} m`);
  assert.ok(worst('onDisc') < 0.06, `the root off the disc's top: ${worst('onDisc').toFixed(3)} m`);
});
