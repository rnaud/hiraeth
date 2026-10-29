// Issues #752 and #755 (the author: "When locked on enemies I should see the whole enemy and myself and the ground like
// Zelda botw"; "Sometimes the lock on feels too big vs the size of the enemy. Check how botw handles this"). Locked on any
// foe the camera frames its drawn body whole, him whole and the ground at both your feet (src/lock-frame.js foeBox,
// LOCK_FRAME_FOE; CameraRig.fitFrame), only in the open; the lock's ring sits round its head or the weak point the lock was
// switched to, one size on the screen whatever the foe (src/lock-reticle.js markerAt, markerHalf).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LOCK_FRAME, LOCK_FRAME_FOE, foeBox, framePoints } from '../src/lock-frame.js';
import { LockReticle, RETICLE, markerAt, markerHalf, reticleRing } from '../src/lock-reticle.js';
import { bodySpan } from '../src/foe-body.js';
import { arenaFoe, around, lockedOn, allFramed, circle } from '../scripts/camera-qc/sim-foes.mjs';
import { lockFraming, FRAME_COVER } from '../scripts/camera-qc/lib.mjs';
import { SCENARIOS, FRAME_KINDS } from '../scripts/camera-qc/scenarios.mjs';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

test('a foe\'s box: its drawn body round its footing, clamped near its size, its footing as the ground, the foe framing\'s tuning', () => {
  const span = () => ({ _box: new THREE.Box3(V(9, 2.9, 4), V(11, 4.1, 6)) });   // (a flyer 2.9 m up, drawn round (10, 5))
  const f = { pos: V(10, 0, 5), chest: V(10, 3.5, 5), def: { radius: 0.9 }, model: { group: new THREE.Group() } };
  const out = foeBox(f, f.pos, { min: V(), max: V() }, 0, span);
  assert.deepEqual(out.min.toArray(), [9, 2.9, 4]); assert.deepEqual(out.max.toArray(), [11, 4.1, 6]);
  assert.equal(out.ground, 0); assert.equal(out.F, LOCK_FRAME_FOE);
  // (held between measures, carried with its point: no new measure until `every` s on)
  const moved = foeBox(f, V(12, 0, 5), out, 0.1, () => { throw new Error('measured again'); });
  assert.deepEqual(moved.min.toArray(), [11, 2.9, 4]);
  // (a part flung far off its body is clamped near its size; no body to measure, its radius and chest)
  const g = { pos: V(), chest: V(0, 1, 0), def: { radius: 0.5 }, model: { group: new THREE.Group() } };
  const far = foeBox(g, g.pos, { min: V(), max: V() }, 0, () => ({ _box: new THREE.Box3(V(-30, 0, -0.5), V(0.5, 40, 0.5)) }));
  assert.ok(far.min.x >= -(0.5 * LOCK_FRAME_FOE.box + 0.5) - 1e-9 && far.max.y <= 1.5 * LOCK_FRAME_FOE.box + 0.5 + 1e-9, `${far.min.x} ${far.max.y}`);
  const none = foeBox({ pos: V(), chest: V(0, 1, 0), def: { radius: 0.5 } }, V(), { min: V(), max: V() }, 0, null);
  assert.deepEqual([none.min.x, none.max.y], [-0.5, 1.5]);
});

test('the framed points: a foe\'s eight corners, the floor between, and under a flyer the ground; a guardian as before', () => {
  const box = { min: V(-1, 3, -6), max: V(1, 4, -4), ground: 0 };
  const pts = framePoints(V(0, 0, 0), box, [], LOCK_FRAME_FOE);
  assert.equal(pts.length, 8 + 8 + 1 + 1);
  for (let k = 0; k < 8; k++) assert.ok(pts.slice(8, 16).some((p) => p.equals(V(k & 1 ? 1 : -1, k & 2 ? 4 : 3, k & 4 ? -4 : -6))), `corner ${k}`);
  assert.ok(pts.at(-1).equals(V(0, 0, -5)), 'the ground under it');
  // (on its feet: no ground point of its own; a guardian keeps its round body, LOCK_FRAME)
  assert.equal(framePoints(V(), { min: V(-1, 0, -6), max: V(1, 2, -4), ground: 0 }, [], LOCK_FRAME_FOE).length, 17);
  assert.equal(framePoints(V(), { min: V(-1, 0, -6), max: V(1, 2, -4) }, [], LOCK_FRAME).length, 16);
});

test('locked on in the Arena: a crawler, a grunt, a hulk, a warlord and a sky ray whole, he whole and both their feet, 2, 5 and 9 m off', () => {
  for (const kind of ['crawler', 'grunt', 'hulk', 'warlord', 'ray']) {
    const G = arenaFoe(kind);
    const looks = [];
    for (const d of [2, 5, 9]) {
      const rows = around(G, d, 4).map((p) => lockedOn(G, p));
      const ok = rows.filter((r) => allFramed(r.whole)).length;
      // (2 m off, in the cut's reach, his body may cover a little more of it from one side: on the screen whole all the
      // same, and never more than 45 % of it behind him)
      if (d === 2) for (const r of rows) assert.ok(r.whole.slice(0, 4).every(Boolean) && r.whole[4] < 0.45, `${kind} at 2 m: ${r.whole.map((v) => +v.toFixed(2))}`);
      assert.ok(ok >= (d === 2 ? 2 : 4), `${kind} at ${d} m: framed from ${ok} of 4 (${rows.map((r) => r.whole.map((v) => +v.toFixed(2)).join(',')).join(' | ')})`);
      for (const r of rows) {
        looks.push(r.pitch);
        assert.ok(r.fov < LOCK_FRAME_FOE.fov + 1e-6, `${kind} at ${d} m: the lens ${r.fov.toFixed(1)}°`);
        assert.ok(r.arm <= LOCK_FRAME_FOE.arm[1] + 1e-6, `${kind} at ${d} m: the arm ${r.arm.toFixed(1)} m`);
      }
    }
    // (looking down onto the ground between you, the land and the sky still over you: 0.2–0.4 rad, the free camera's 0.16)
    assert.ok(Math.min(...looks) > 0.18 && Math.max(...looks) < 0.4, `${kind}: the view ${Math.min(...looks).toFixed(2)}–${Math.max(...looks).toFixed(2)} rad down`);
  }
  // before #752 (no box for a foe that is not a guardian): the hulk 5 m off stood behind his back
  const H = arenaFoe('hulk');
  const before = around(H, 5, 4).map((p) => lockedOn(H, p, { fit: false }));
  assert.ok(before.some((r) => r.whole[4] > FRAME_COVER), 'the hulk was covered by him before');
});

test('circling a hulk and a crawler locked on: smooth (the camera QC\'s limits) and framed nearly always', () => {
  for (const kind of ['hulk', 'crawler']) {
    const c = circle(arenaFoe(kind));
    assert.ok(c.green, `${kind}: ${c.fails.join('; ')}`);
    assert.ok(c.framed >= 0.95, `${kind}: framed ${(c.framed * 100).toFixed(0)} %`);
  }
});

test('a foe\'s framing only in the open: close in (a corridor, a temple\'s room) the rig keeps its close-in camera', () => {
  const G = arenaFoe('grunt');
  const r = lockedOn(G, V(0, 0, 5));
  assert.ok(r.rig.fitK > 0.9, `open: the fit on (${r.rig.fitK.toFixed(2)})`);
  // (the same rig told it is close in: the fit eases out, the close-in framing comes back)
  const rig = r.rig, box = { min: V(), max: V() };
  rig.tight = 1;
  for (let i = 0; i < 180; i++) { rig.locked = true; rig.frameWith = foeBox(G.f, G.f.pos, box, i / 60, bodySpan); rig.update(V(0, 0, 5), 1 / 60, null); }
  assert.ok(rig.fitK < 0.05, `close in: the fit off (${rig.fitK.toFixed(2)})`);
});

test('the camera QC locks on to every built kind in the Arena at 2, 5 and 9 m, and counts the frames with everything framed', () => {
  for (const k of FRAME_KINDS) {
    const sc = SCENARIOS.find((s) => s.name === `frame-${k}`);
    assert.ok(sc, k); assert.equal(sc.world, 'arena');
    assert.deepEqual(sc.segs.filter((s) => s.shot).map((s) => s.shot), ['2m', '5m', '9m']);
  }
  const S = [{ whole: [1, 1, 1, 1, 0], foeD: 2 }, { whole: [0, 1, 1, 1, 0], foeD: 2 }, { whole: [1, 1, 1, 1, 0.6], foeD: 5 }, { whole: [1, 1, 1, 1, 0.1], foeD: 9 }, { whole: null, foeD: null }];
  const L = lockFraming(S);
  assert.equal(L.all.frames, 4); assert.equal(L.all.share, 0.5);
  assert.equal(L[2].share, 0.5); assert.equal(L[5].share, 0); assert.equal(L[9].share, 1);
  assert.equal(L.lost.foe, 0.25); assert.equal(L.lost.covered, 0.25);
});

test('the lock\'s ring: round its head, one size whatever the foe; on its weak point once switched to it (#722)', () => {
  // markerHalf: the head's own size plus the gap, within RETICLE.size
  assert.equal(markerHalf(0), RETICLE.size[0]); assert.equal(markerHalf(500), RETICLE.size[1]);
  assert.equal(markerHalf(20, 1, 10), 30); assert.equal(markerHalf(500, 1.5), RETICLE.size[1] * 1.5);
  // the real bodies on a 1280 × 720 screen: a hulk 2 m off and a crawler 9 m off, the camera 4.8 m behind him
  const W = 1280, H = 720, sizes = {};
  for (const [kind, d] of [['hulk', 2], ['crawler', 9], ['grunt', 5]]) {
    const G = arenaFoe(kind), pos = V(0, 0, d);
    const r = lockedOn(G, pos);
    const self = { span: { lo: 0, hi: 0, centre: V(), radius: 0 } };
    const box = LockReticle.prototype.screenBox.call(self, G.f, r.camera, W, H);
    const old = LockReticle.prototype.bodyBox.call(self, G.f, r.camera, W, H);
    assert.ok(box && old, kind);
    const ring = reticleRing(box, 1, {}, 1), was = { rx: Math.min(300, (old.x1 - old.x0) / 2 + 14), ry: Math.min(300, (old.y1 - old.y0) / 2 + 14) };
    sizes[kind] = { ring: ring.rx, was: Math.max(was.rx, was.ry) };
    // (round its head: the ring's middle in the top half of its body's box on the screen)
    assert.ok(ring.cy < (old.y0 + old.y1) / 2 + 1, `${kind}: the ring at ${ring.cy.toFixed(0)} px, its body ${old.y0.toFixed(0)}–${old.y1.toFixed(0)}`);
  }
  for (const k of Object.keys(sizes)) assert.ok(sizes[k].ring >= RETICLE.size[0] && sizes[k].ring <= RETICLE.size[1], `${k}: ${sizes[k].ring}`);
  assert.ok(sizes.hulk.was > 3 * sizes.crawler.was, `before: the hulk's ring ${sizes.hulk.was.toFixed(0)} px, the crawler's ${sizes.crawler.was.toFixed(0)}`);
  assert.ok(sizes.hulk.ring / sizes.crawler.ring <= RETICLE.size[1] / RETICLE.size[0] + 1e-9, 'now within 5:3');
  // its weak point once the lock is switched to it: the ring there (f.aim, f.aimR)
  const G = arenaFoe('hulk');
  const weak = { aimR: 0.3, aim: V(1, 2, 3), model: G.f.model, chest: V() };
  const m = markerAt(weak);
  assert.ok(m.at.equals(V(1, 2, 3)) && m.r === 0.3);
  // (no weak point and no eyes: the top of its drawn body)
  const top = markerAt({ model: { group: new THREE.Group() }, chest: V(0, 1, 0) }, undefined, { lo: 0, hi: 2, centre: V(4, 1, 5) });
  assert.ok(top.at.equals(V(4, 2 - RETICLE.top, 5)));
});
