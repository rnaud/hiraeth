// The wind's wisps (src/wind.js WindStreaks, issue #348): none drawn inside an interior (a room, the ship, a temple:
// whatever src/shelter.js knows as indoors), none while you are indoors, and at Handheld on the Retroid's frame they
// are light strokes (about a render pixel wide, pointed, in less than full ink), not the heavy black dashes they were.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WindStreaks, WISP, wispPx } from '../src/wind.js';
import { buildRoom, inTightRoom } from '../src/interiors.js';
import { addIndoors, isIndoors } from '../src/shelter.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = { heightAt: () => 0 };
// (the same wisps every run)
function seeded(fn) {
  const r = Math.random; let a = 7;
  Math.random = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  try { return fn(); } finally { Math.random = r; }
}
function camera(rows, at = v(0, 1.7, -6), look = v(0, 1, 20)) {
  const c = new THREE.PerspectiveCamera(55, 4 / 3, 0.1, 2000);
  c.position.copy(at); c.lookAt(look); c.updateMatrixWorld(); c.updateProjectionMatrix();
  return Object.assign(c, { rows });
}
function wind(rows) {
  const w = new WindStreaks();
  w.uniforms.uRes.value.set(Math.round(rows * 4 / 3), rows);
  w.fixedAngle = Math.PI / 2;   // (blowing along +z, into what stands downwind)
  w.gust = () => 1;
  return w;
}
const pxScale = (cam) => (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / cam.rows;
/** Every drawn point of every wisp (alpha over 0): its middle, its alpha, and its width in render pixels. */
function drawn(w, cam, all = false) {
  const out = [], P = w.positions, A = w.alphas, a = v(), b = v(), H = w.uniforms.uRes.value.y;
  for (let i = 0; i < A.length; i += 2) {
    if (!(A[i] > 1e-4)) continue;
    a.fromArray(P, i * 3); b.fromArray(P, i * 3 + 3);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const pa = a.clone().project(cam), pb = b.clone().project(cam);
    if (!all && ![pa, pb].every((q) => Math.abs(q.x) <= 1 && Math.abs(q.y) <= 1 && Math.abs(q.z) <= 1)) continue;   // (out of the frame)
    out.push({ mid, alpha: A[i], px: Math.hypot((pa.x - pb.x) * cam.aspect, pa.y - pb.y) * H / 2, dist: mid.distanceTo(cam.position) });
  }
  return out;
}

test('no wisp is drawn inside an interior: a room, a box a level registers (the ship), and they blow on round them', () => seeded(() => {
  // a room (a shop's, interiors.js buildRoom) and a ship-sized box registered as indoors, both downwind of the traveller
  const scene = new THREE.Scene();
  const room = buildRoom(scene, { pos: v(0, 0, 18), w: 8, d: 10, h: 3.2 });
  const ship = (p, m = 0) => Math.abs(p.x - 14) < 4 - m && Math.abs(p.z - 10) < 9 - m && p.y > -1 && p.y < 5;
  const off = addIndoors(ship);
  try {
    assert.ok(isIndoors(room.inside.clone().setY(1)) && isIndoors(v(14, 1, 10)), 'both are interiors');
    const cam = camera(720), w = wind(720);
    let inside = 0, seen = 0, graze = 0;
    for (let f = 0; f < 600; f++) {
      w.update(1 / 60, v(4, 0, 0), cam, flat, pxScale(cam), true);
      for (const d of drawn(w, cam, true)) {
        seen++;
        // (a wisp running along a wall may wiggle into its thickness, half a metre at most, where the wall hides it)
        if (inTightRoom(d.mid, -0.6) || ship(d.mid, 0.6)) inside++;
        else if (isIndoors(d.mid)) graze++;
      }
    }
    assert.ok(seen > 20000, `wisps blowing (${seen} points drawn)`);
    assert.equal(inside, 0, `${inside} drawn points inside an interior`);
    assert.ok(graze < seen * 0.01, `a few along the walls (${graze})`);
    // and the ground round them still has its wisps (only those in the rooms are gone)
    const near = drawn(w, cam, true).filter((d) => d.mid.z > 5 && d.mid.z < 30).length;
    assert.ok(near > 50, `wisps downwind, round the rooms (${near})`);
    // without the interiors they would be in them
    const w2 = wind(720); w2.indoors = null; let would = 0;
    for (let f = 0; f < 600; f++) { w2.update(1 / 60, v(4, 0, 0), cam, flat, pxScale(cam), true); for (const d of drawn(w2, cam, true)) if (inTightRoom(d.mid, -0.6) || ship(d.mid, 0.6)) would++; }
    assert.ok(would > 1000, `(${would} points in them unchecked)`);
  } finally { off(); }
}));

test('none while you are indoors (the shelter\'s indoor): they fade and none start', () => seeded(() => {
  const cam = camera(720), w = wind(720);
  for (let f = 0; f < 240; f++) w.update(1 / 60, v(), cam, flat, pxScale(cam), true);
  assert.ok(drawn(w, cam).length > 100, 'blowing outdoors');
  w.hush = 1;
  w.update(1 / 60, v(), cam, flat, pxScale(cam), true);
  assert.equal(drawn(w, cam).length, 0, 'none drawn at once, indoors');
  for (let f = 0; f < 600; f++) w.update(1 / 60, v(), cam, flat, pxScale(cam), true);
  w.hush = 0;
  w.update(1 / 60, v(), cam, flat, pxScale(cam), true);
  assert.ok(drawn(w, cam).length < 30, 'and none started while indoors: stepping out, the gusts begin again');
}));

test('at Handheld on the Retroid\'s frame (960 × 720 render pixels) a wisp is a light stroke, as on a big screen', () => seeded(() => {
  const stroke = (rows) => {
    const cam = camera(rows), w = wind(rows);
    let pts = [];
    for (let f = 0; f < 240; f++) w.update(1 / 60, v(), cam, flat, pxScale(cam), true);
    pts = drawn(w, cam).filter((d) => d.dist > 10 && d.dist < 60);
    assert.ok(pts.length > 100, `wisps 10-60 m off (${pts.length})`);
    const px = pts.map((d) => d.px).sort((a, b) => a - b), widest = px[px.length - 1], middle = px[px.length >> 1];
    const darkest = Math.max(...pts.map((d) => d.alpha));
    // the share of the frame's height a stroke takes (its widest: off the frame's middle, a little wider)
    return { widest, middle, darkest, share: widest / rows };
  };
  const retroid = stroke(720), desk = stroke(2234);
  // (the old ribbon: 1.7 CSS px whatever the frame, 2.55 render px on the Retroid's 2× at 0.75, in full ink)
  assert.ok(retroid.widest < 1.6 && retroid.middle < 1.2, `about a render pixel wide on the Retroid (${retroid.middle.toFixed(2)} px, at most ${retroid.widest.toFixed(2)})`);
  assert.ok(retroid.darkest <= WISP.ink + 1e-6 && WISP.ink < 0.9, `less than full ink (${retroid.darkest.toFixed(2)})`);
  assert.ok(Math.abs(retroid.share - desk.share) < 0.0004, `the same share of the picture as a DPR-2 desktop's (${retroid.share.toFixed(4)}, ${desk.share.toFixed(4)})`);
  assert.ok(desk.middle > 3 && desk.middle < 4, `the desktop's as before, about 3.5 px (${desk.middle.toFixed(2)})`);
}));

test('a stroke under a pixel is drawn a pixel wide with its coverage as its ink; its ends pointed', () => {
  assert.deepEqual(wispPx(2234).cover, 1);
  const small = wispPx(400);
  assert.equal(small.px, WISP.minPx);
  assert.ok(small.cover > 0.6 && small.cover < 0.7, `coverage ${small.cover}`);
  assert.ok(WISP.tip < 0.5, 'pointed at the ends');
});
