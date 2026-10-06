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
// Known and left, by world (docs/systems/movement.md, "Contact"):
//  - desert: the Givers' Hearth butte's rough sides and the Givers' House tower's flared foot round smooth
//    stand-ins (made exact, they shift the sand banked against them and the Qanat gathering: a follow-up);
//    the crashed hull's and the sunken leviathan's drawn ribs over their coarse floors;
//  - buried: the machine's drawn pipes, tanks and sand over coarser walls and floors;
//  - garage, bazaar, edena, perdide, home: drawn trims, sills and frames on buildings without collision of their own;
//  - spheres: rock and props round the lake still on coarse stand-ins; the resonators are round, not discs;
//  - perdide2: the roots draped over the root cave are walk-through by design;
//  - temples everywhere: a shut door's edge, the rotunda's top lip (0.1 m in, 0.4 m out), the balls (round).
const KNOWN = {
  desert: { sink: 57, hover: 18, inside: 186 }, incal: { sink: 0, hover: 0, inside: 4 }, arzach: { sink: 6, hover: 0, inside: 2 },
  arzach2: { sink: 1, hover: 0, inside: 2 }, garage: { sink: 5, hover: 0, inside: 34 }, buried: { sink: 270, hover: 3, inside: 833 },
  edena: { sink: 18, hover: 0, inside: 31 }, spheres: { sink: 91, hover: 7, inside: 120 }, perdide: { sink: 61, hover: 7, inside: 35 },
  perdide2: { sink: 97, hover: 1, inside: 5 }, bazaar: { sink: 7, hover: 0, inside: 86 }, atelier: { sink: 0, hover: 0, inside: 0 }, home: { sink: 23, hover: 0, inside: 15 },
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
    assert.ok((r.counts['climbs inside'] ?? 0) <= 4, `${id}: ${formatContact(r)}`);
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
