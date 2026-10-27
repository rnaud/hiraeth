import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HitBursts, HIT_BURST, burstPieces } from '../src/hit-burst.js';
import { FluidBlade, SWINGS } from '../src/fluid-blade.js';
import { Foe, Foes } from '../src/foes.js';
import { clearTargets, registerTarget } from '../src/targets.js';
import { resetFeel, feelState, feelDt, selfDt, setMotion, hitStop } from '../src/feel.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const camera = () => { const c = new THREE.PerspectiveCamera(); c.position.set(0, 1.5, -4); c.lookAt(0, 1, 2); c.updateMatrixWorld(); return c; };

test('a burst: rays round a core at once (its biggest frame), a heavy one more and longer with a streak along the cut; gone after its life', () => {
  const light = burstPieces({ heavy: false, spin: 0, cut: null }, 0), heavy = burstPieces({ heavy: true, spin: 0, cut: 0.4 }, 0);
  assert.equal(light.filter((p) => p.kind === 'light' && !p.fleck).length, HIT_BURST.light.rays);
  assert.equal(light.filter((p) => p.kind === 'ink' && !p.fleck).length, HIT_BURST.light.rays, 'each ray cut out of an ink one');
  assert.equal(light.filter((p) => p.kind === 'core').length, 4, 'the cream accent at its heart on the first frame');
  assert.equal(heavy.filter((p) => p.kind === 'light' && !p.streak && !p.fleck).length, HIT_BURST.heavy.rays, 'a heavy blow: more rays');
  const streak = heavy.filter((p) => p.kind === 'light' && p.streak);
  assert.equal(streak.length, 2, 'and a streak through the point, both ways along the cut');
  assert.ok(Math.abs(Math.abs(streak[1].angle - streak[0].angle) - Math.PI) < 1e-9 && 2 * streak[0].length > 2.5 * Math.max(...heavy.filter((p) => p.kind === 'light' && !p.streak).map((p) => p.length)) && streak[0].width < 0.1, 'long and thin');
  assert.equal(light.filter((p) => p.streak).length, 0, 'none on a light cut');
  const longest = (ps) => Math.max(...ps.filter((p) => p.kind === 'light' && !p.streak).map((p) => p.length));
  assert.ok(longest(heavy) > longest(light) * 1.4, 'a heavy burst reaches further');
  for (const p of light.filter((x) => x.kind === 'light')) {
    const ink = light.find((x) => x.kind === 'ink' && x.angle === p.angle);
    assert.ok(ink.width > p.width && ink.length > p.length && ink.lift < p.lift, 'the ink behind, wider and longer (an inked edge)');
  }
  assert.ok(burstPieces({ heavy: false, spin: 0 }, HIT_BURST.light.life * 0.6).every((p) => p.kind !== 'core'), 'the core is gone by half its life');
  assert.deepEqual(burstPieces({ heavy: false, spin: 0 }, HIT_BURST.light.life), [], 'over');
  assert.deepEqual(burstPieces({ heavy: true, spin: 0 }, HIT_BURST.heavy.life + 0.01), []);
  assert.ok(HIT_BURST.light.life <= 0.15 && HIT_BURST.heavy.life <= 0.25, 'a few frames: a mark, not a cloud');
});

test('the bursts are drawn turned to the camera, toward it from the contact, and cleaned up when done; the oldest gives way', () => {
  const group = new THREE.Group(), cam = camera(), B = new HitBursts(group, () => cam);
  assert.equal(B.mesh.parent, group);
  const at = v(0, 1, 2);
  B.add({ at, heavy: true, cut: v(1, -1, 0) });
  B.update(0);
  assert.ok(B.mesh.count > HIT_BURST.heavy.rays * 2, `drawn: ${B.mesh.count} pieces`);
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  B.mesh.getMatrixAt(0, m); m.decompose(p, q, s);
  const n = v(0, 0, 1).applyQuaternion(q), toCam = cam.position.clone().sub(at).normalize();
  assert.ok(n.dot(toCam) > 0.99, 'its face to the camera');
  assert.ok(p.distanceTo(cam.position) < at.distanceTo(cam.position), 'out of the body toward the camera');
  for (let i = 0; i < HIT_BURST.max + 3; i++) B.add({ at, heavy: false });
  assert.equal(B.list.length, HIT_BURST.max, 'at most HIT_BURST.max at once');
  B.update(HIT_BURST.heavy.life + 0.01);
  assert.equal(B.list.length, 0); assert.equal(B.mesh.count, 0, 'nothing left drawn');
  B.dispose(); assert.equal(B.mesh.parent, null);
});

test('a hit-stop holds the burst on its first, biggest frame: its clock is the traveller\'s, frozen with the world', () => {
  resetFeel(); setMotion({ reduce: false, shake: 1 });
  const cam = camera(), B = new HitBursts(null, () => cam);
  B.add({ at: v(0, 1, 2), heavy: true });
  // (the cut lands: the frame freezes for the heavy hit-stop; main.js steps the tool by selfDt())
  hitStop(0.11);
  for (let i = 0; i < 5; i++) { feelDt(1 / 60); B.update(selfDt()); }
  assert.ok(B.list[0].age < 0.001, `held through the freeze (${B.list[0].age.toFixed(4)} s old after 5 frames)`);
  for (let i = 0; i < 4; i++) { feelDt(1 / 60); B.update(selfDt()); }
  assert.ok(B.list[0].age > 0, 'then it bursts on');
  resetFeel();
});

function fixture(n) {
  clearTargets(); resetFeel(); setMotion({ reduce: false, shake: 1 });
  const bursts = [];
  const tool = { physics: { rayDistance: () => Infinity }, info: () => ({}), splash() {}, sound: { fluidSlashHit() {} }, rings: { add() {} }, glow: { add() {} }, lastHit: null,
    bursts: { add: (b) => bursts.push(b) } };
  const blade = Object.assign(Object.create(FluidBlade.prototype), { tool, n, special: null, rising: true, hit: false, dir: v(0, 0, 1), hitTargets: new Set(),
    coarse: () => ({ origin: v(0, 1, 0), dir: v(0, 0, 1), reach: 4, angle: 1.3 }), rippleAt() {} });
  const foes = { list: [], sound: { foeGlance() {}, foeHurt() {} }, sparks() {}, react() {}, defeat() {}, armour() {}, tool };
  const foe = (f) => registerTarget({ kind: 'foe', accepts: ['blade'], radius: 0.4, position: () => v(0, 1, 2), onHit: (mode, point, dir, info) => Foes.prototype.hurt.call(foes, f, mode, dir, info, point) });
  return { blade, bursts, foe };
}

test('a landed cut bursts where it struck, heavy on the combo\'s third, with the longer hit-stop; a miss or armour does not', () => {
  for (const n of [0, 2]) {
    const F = fixture(n), f = new Foe('blot', v(0, 0, 2)); f.hp = 20; F.foe(f);
    assert.equal(F.blade.strike().length, 1);
    assert.equal(F.bursts.length, 1, 'one burst for the one foe');
    assert.equal(F.bursts[0].heavy, n === 2, `swing ${n + 1}: ${n === 2 ? 'heavy' : 'light'}`);
    assert.ok(F.bursts[0].at.distanceTo(v(0, 1, 2)) < 0.45, 'at the contact, drawn a little into the body');
    const stop = feelState().stop;
    if (n === 2) assert.ok(stop >= 0.1, `the finisher freezes longer (${stop})`); else assert.ok(stop > 0.03 && stop <= 0.07, `a light cut: a few frames (${stop})`);
  }
  const miss = fixture(0); assert.deepEqual(miss.blade.strike(), []); assert.equal(miss.bursts.length, 0, 'a miss: nothing');
  const shell = fixture(0), crab = new Foe('crab', v(0, 0, 2)); crab.heading = Math.PI; crab.shelled = true; shell.foe(crab);
  shell.blade.strike(); assert.equal(shell.bursts.length, 0, 'armour: its own sparks, no burst');
  clearTargets(); resetFeel();
  assert.ok(SWINGS[2].heavy);
});


test('amber contact keeps its colour in instance data, with a tiny cream core and a bounded draw budget', () => {
  const B = new HitBursts(null, camera());
  for (const heavy of [false, true]) {
    B.clear(); B.add({ at: v(0, 1, 2), heavy, cut: v(1, -1, 0) }); B.update(0);
    const pieces = burstPieces(B.list[0], 0), c = new THREE.Color();
    let creamArea = 0, rayArea = 0;
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i]; B.mesh.getColorAt(i, c);
      if (p.kind === 'light') {
        assert.ok(c.r > c.g * 1.5 && c.g > c.b * 2, 'rays are saturated amber, never white');
        rayArea += p.width * p.length;
      }
      if (p.kind === 'core') creamArea += p.width * p.length;
    }
    assert.ok(creamArea < rayArea / 3, 'cream is a small contact accent, not the whole burst');
    assert.ok(B.mesh.material.uniforms.uGlow.value < 0.62, 'a readable flat print below the bloom threshold');
    B.update(HIT_BURST[heavy ? 'heavy' : 'light'].life * 0.75);
    assert.ok(burstPieces(B.list[0], B.list[0].age).every(p => p.kind !== 'core'), 'only coloured flecks remain as it clears');
  }
  B.dispose();
});


test('the approved impact is an irregular needle fan followed by detached flecks, not a regular star badge', () => {
  for (const heavy of [false, true]) {
    const S = HIT_BURST[heavy ? 'heavy' : 'light'], b = { heavy, spin: 0.2, cut: 0.8 };
    const rays = burstPieces(b, 0).filter(p => p.kind === 'light' && !p.streak && !p.fleck);
    assert.ok(rays.length >= 18, 'dense sharp contact silhouette');
    assert.ok(Math.max(...rays.map(p => p.length)) > 3 * Math.min(...rays.map(p => p.length)), 'deliberately uneven ray lengths');
    const leader = rays.reduce((a, p) => p.length > a.length ? p : a);
    assert.equal(leader.angle, b.cut, 'dominant ray follows the actual cut');
    assert.ok(leader.width < leader.length * 0.1, 'a needle, not a broad petal');
    const tail = burstPieces(b, S.life * 0.75);
    assert.equal(tail.filter(p => p.kind === 'light').length, S.flecks);
    assert.ok(tail.every(p => p.fleck && p.from > S.reach), 'after contact only separated slivers remain');
  }
});
