import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ITEMS } from '../src/items.js';
import './register-gadgets.js';   // (the gadgets join ITEMS as kind 'gadget')
import { PLACEMENTS } from '../src/boxes/placements.js';
import { BEATS, MAX_BEAT, KIND_BEATS, ITEM_BEATS, beatFor, timingFor, closingShot, beatPath, PLAN_REVEAL } from '../src/boxes/beats.js';
import { BoxScene, BOX_PLANS, TIMES, WOBBLES, OUT_TIME, STAND_AT } from '../src/boxes/scene.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const boxItems = [...new Set(Object.values(PLACEMENTS).flat().map((p) => p.item))];

test('closing beats: each kind of item has its beat, the finders point and the whistles play', () => {
  assert.equal(beatFor('hook', ITEMS.hook), 'try', 'a gadget: tried once');
  assert.equal(beatFor('fire', ITEMS.fire), 'try', 'a gun mode too');
  assert.equal(beatFor('jetpack', ITEMS.jetpack), 'try', 'the jets too');
  assert.equal(beatFor('backpack', ITEMS.backpack), 'try');
  assert.equal(beatFor('star', ITEMS.star), 'wear', 'a cosmetic: worn');
  assert.equal(beatFor('soles', ITEMS.soles), 'keep', 'a charm: turned over and pocketed');
  assert.equal(beatFor('coil', ITEMS.coil), 'fit', 'a tank part: fitted to the pack');
  assert.equal(beatFor('lens', ITEMS.lens), 'point');
  assert.equal(beatFor('shell', ITEMS.shell), 'point');
  assert.equal(beatFor('bell', ITEMS.bell), 'play');
  assert.equal(beatFor('echo', ITEMS.echo), 'play');
  assert.equal(beatFor('nothing', null), 'keep', 'an unknown item still gets a beat');
  for (const b of [...Object.values(KIND_BEATS), ...Object.values(ITEM_BEATS)]) assert.ok(BEATS[b], b);
  // every box's item has a beat, and every beat is used by some box
  const used = new Set();
  for (const id of boxItems) { const b = beatFor(id, ITEMS[id]); assert.ok(BEATS[b], `${id}: ${b}`); used.add(b); }
  assert.deepEqual([...used].sort(), Object.keys(BEATS).sort(), 'all six beats are seen');
});

test('closing beats are short, act after the item reaches him, and end stowed', () => {
  for (const [name, b] of Object.entries(BEATS)) {
    assert.ok(b.dur > 0.8 && b.dur <= MAX_BEAT, `${name}: ${b.dur} s, at most ${MAX_BEAT}`);
    assert.ok(b.act >= 0.45 && b.act < b.dur - 0.2, `${name}: acts once it is held, before the end`);
    assert.ok(b.scale > 0 && b.scale < 1, `${name}: smaller in the hand than hovering`);
    const p0 = beatPath(name, 0), pa = beatPath(name, b.act - 0.01), pe = beatPath(name, b.dur);
    assert.equal(p0.toHold, 0);
    assert.equal(p0.toStow, 0);
    assert.ok(pa.toHold > 0.99, `${name}: in hand when it acts`);
    assert.equal(pe.toStow, 1, `${name}: away by the end`);
  }
});

test('opening timings per plan and beat: a gadget wobbles three times, a keepsake twice; the side plan holds its reveal', () => {
  const base = { times: TIMES, wobbles: WOBBLES };
  for (const plan of Object.keys(BOX_PLANS)) {
    for (const beat of Object.keys(BEATS)) {
      const { times, wobbles } = timingFor(plan, beat, base);
      const open = Object.values(times).reduce((s, v) => s + v, 0);
      assert.ok(open >= 6.5 && open <= 8, `${plan}/${beat}: the opening ${open.toFixed(1)} s`);
      assert.ok(open + BEATS[beat].dur + OUT_TIME <= 11, `${plan}/${beat}: with the beat and the hand-back`);
      assert.ok(wobbles.length >= 2 && wobbles.length <= 3);
      for (let i = 0; i < wobbles.length; i++) {
        const w = wobbles[i];
        if (i) assert.ok(w.at - (wobbles[i - 1].at + wobbles[i - 1].dur) > 0.25, `${plan}/${beat}: a rest before wobble ${i}`);
        assert.ok(w.amp > 0.1 && w.amp < 0.4);
      }
      const last = wobbles.at(-1);
      assert.ok(times.wobble - (last.at + last.dur) > 0.15, `${plan}/${beat}: a still moment before it opens`);
      assert.equal(times.reveal, PLAN_REVEAL[plan] ?? TIMES.reveal);
    }
  }
  assert.equal(timingFor('shoulder', 'try', base).wobbles.length, 3);
  assert.equal(timingFor('shoulder', 'keep', base).wobbles.length, 2);
  assert.ok(timingFor('shoulder', 'keep', base).times.wobble < TIMES.wobble, 'a keepsake opens sooner, paying for its beat');
  assert.ok(timingFor('side', 'wear', base).times.reveal > TIMES.reveal);
  assert.deepEqual(timingFor('shoulder', 'wear', base).wobbles, WOBBLES, 'otherwise the plain three');
});

test('closing shots keep to the plan: in front of him (or over his back for the pack), never on top of him', () => {
  for (const beat of Object.keys(BEATS)) {
    for (const plan of Object.keys(BOX_PLANS)) {
      const { pos, look, fov } = closingShot(beat, plan, STAND_AT);
      const chest = V(0, 1.3, STAND_AT), p = V(...pos);
      const d = p.distanceTo(chest);
      assert.ok(d > 1.1 && d < 3.6, `${beat}/${plan}: lens ${d.toFixed(2)} m from him`);
      assert.ok(pos[1] > 1.1 && pos[1] < 2.7, `${beat}/${plan}: at a person's height or a little over`);
      assert.ok(fov >= 28 && fov <= 54);
      if (beat !== 'fit') assert.ok(pos[2] < STAND_AT + 0.2, `${beat}/${plan}: sees his front`);
      if (beat === 'fit') assert.ok(pos[2] > STAND_AT + 0.8, 'the pack is on his back: from behind');
      assert.ok(V(...look).distanceTo(p) > 0.8);
      // he is in the picture: within 30° of the aim (the frame's half-width is ~37° at these lenses)
      const off = V(...look).sub(p).angleTo(chest.clone().sub(p)) * 180 / Math.PI;
      assert.ok(off < 30, `${beat}/${plan}: he is ${off.toFixed(0)}° off the aim`);
    }
    const r = closingShot(beat, 'shoulder', STAND_AT), l = closingShot(beat, 'left', STAND_AT);
    assert.equal(l.pos[0], -r.pos[0], `${beat}: 'left' mirrors it`);
    assert.ok(closingShot(beat, 'high', STAND_AT).pos[1] > r.pos[1], `${beat}: 'high' looks from higher`);
  }
});

function playTo(sc, phase, max = 30 * 15) {
  for (let i = 0; i < max && sc.phase !== phase && !sc.done; i++) sc.update(1 / 30);
  return sc.phase;
}

test('the beat plays after the card, about its length, acts once, stows the item and hands back; a skip ends it', () => {
  for (const item of ['hook', 'star', 'soles', 'coil', 'lens', 'bell']) {
    const calls = [];
    const sound = new Proxy({}, { get: (_, k) => (...a) => calls.push([k, ...a]) });
    const shots = [];
    const cam = { shot: (o) => shots.push(o), release: () => shots.push('release'), hud() {}, bars() {} };
    const player = { pos: V(), vel: V(), heading: 0, object: null };
    let granted = 0, ended = 0;
    const sc = new BoxScene({ box: { id: `t.${item}`, pos: V(), yaw: 0, parts: { mats: {} }, scene: null }, def: ITEMS[item], item, player, cam, sound,
      pointAt: () => V(20, 0, 0), onGrant: () => granted++, onEnd: () => ended++ });
    sc.start();
    assert.equal(playTo(sc, 'card'), 'card', item);
    assert.equal(granted, 0);
    for (let i = 0; i < 20; i++) sc.update(1 / 30);
    assert.equal(sc.dismiss(), true);
    assert.equal(sc.phase, 'beat');
    assert.equal(granted, 1, `${item}: granted as the beat starts`);
    const before = calls.length;
    const h0 = player.heading;
    let n = 0;
    while (sc.phase === 'beat' && n < 90) { sc.update(1 / 30); n++; }
    const heading = player.heading - h0;
    const dur = BEATS[sc.beat].dur;
    assert.ok(Math.abs(n / 30 - dur) < 0.1, `${item}: ${sc.beat} lasts ${dur} s (${(n / 30).toFixed(2)})`);
    assert.equal(sc.model.visible, false, `${item}: stowed (or worn) by the end of its beat`);
    assert.ok(calls.length > before, `${item}: its sound`);
    if (sc.beat === 'point') assert.ok(heading < -0.8, `${item}: he turns toward the box it points to, on his right (${heading.toFixed(2)})`);
    else assert.equal(heading, 0, `${item}: he stays facing where the box was`);
    assert.ok(shots.filter((s) => s.pos).every((s) => s.pos.distanceTo(V(0, 1.3, STAND_AT)) > 0.85), `${item}: the lens never on top of him`);
    assert.equal(playTo(sc, 'done-never', 60), 'out');
    assert.ok(sc.done && ended === 1 && shots.includes('release'));
  }
  // a skip in the beat: straight to the hand-back; a skip on the card: past the beat
  const mk = () => new BoxScene({ box: { id: 't', pos: V(), yaw: 0, parts: { mats: {} }, scene: null }, def: ITEMS.hook, item: 'hook', player: null, onGrant() {}, onEnd() {} });
  const a = mk(); a.start(); playTo(a, 'card'); for (let i = 0; i < 20; i++) a.update(1 / 30);
  a.dismiss(); a.update(1 / 30); a.skip();
  assert.equal(a.phase, 'out');
  const b = mk(); b.start(); b.update(1 / 30); b.skip();
  assert.equal(b.phase, 'card');
  b.skip();
  assert.equal(b.phase, 'out', 'the skip goes past the beat');
  const c = mk(); c.start(); playTo(c, 'card');
  assert.equal(c.dismiss(), false, 'the card waits its minimum');
});
