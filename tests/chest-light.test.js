// The light out of an opening chest (issue #285, src/boxes/light.js): real light, washes over the picture, where eleven
// glowing blades and eighteen jade specks rose until then; it swells as the halves part, settles as the item rises,
// lights his face (the chest's lamp), and is gone with the scene.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BoxScene, TIMES, OPENING } from '../src/boxes/scene.js';
import { buildBox, BOX_SCALE } from '../src/boxes/model.js';
import { ChestLight, chestLightK, chestLamp, SETTLE, LAMP, MOUTHS } from '../src/boxes/light.js';
import { Veils } from '../src/veil.js';
import { ITEMS } from '../src/items.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

test('its strength: none before it opens, swelling with the halves, full as they finish, settling as the item rises, gone after', () => {
  const T = { ...TIMES, beat: 2 };
  for (const ph of ['approach', 'wake', 'rise', 'wobble']) assert.equal(chestLightK(ph, 0.3, T), 0, ph);
  const open = OPENING.open, at = (u) => chestLightK('dissolve', u * T.dissolve, T, { open });
  assert.equal(at(0), 0);
  let last = -1;
  for (let u = 0; u <= open + 1e-9; u += open / 20) { const k = at(u); assert.ok(k >= last - 1e-9, `rising at ${u.toFixed(2)}`); last = k; }
  assert.ok(Math.abs(at(open) - 1) < 1e-9, 'full as the halves finish parting');
  assert.ok(at(0.75) < 1 && at(0.75) > SETTLE, 'settling as the item rises');
  assert.ok(Math.abs(at(1) - SETTLE) < 1e-9);
  assert.equal(chestLightK('reveal', 0.4, T), SETTLE);
  assert.equal(chestLightK('card', 3, T), SETTLE);
  assert.ok(chestLightK('beat', 2, T) < SETTLE * 0.5, 'dimming in the closing beat');
  assert.ok(chestLightK('out', 0, T, { from: 0.5 }) === 0.5 && chestLightK('out', 1.3, T, { from: 0.5 }) === 0, 'gone as the scene hands back');
});

test('its lamp lights round it: wider with its light, raised over the mouth toward his face', () => {
  const mouth = V(1, 0.4, 2), L = new THREE.Vector4();
  chestLamp(L, mouth, 0, 0);
  assert.equal(L.w, LAMP.base);
  chestLamp(L, mouth, 0.6, 0);
  assert.ok(L.w > LAMP.base, 'a little, as light leaks at its seam');
  chestLamp(L, mouth, 0, 1);
  assert.ok(Math.abs(L.w - LAMP.base - LAMP.reach) < 1e-9 && Math.abs(L.y - 0.4 - LAMP.lift) < 1e-9 && L.x === 1 && L.z === 2);
});

test('the light is washes (no G-buffer mesh, no new program) and leaves the pass when disposed', () => {
  const veils = new Veils(), scene = new THREE.Scene();
  const L = new ChestLight({ veils, parent: scene });
  assert.equal(veils.list.length, 4, 'the column (a jade cone and a gold core), the mouth, the motes');
  assert.ok(L.washes.every((w) => w.material.blending === THREE.AdditiveBlending), 'light only adds');
  const meshes = []; L.group.traverse((o) => o.isMesh && meshes.push(o));
  assert.ok(meshes.length === 4 && meshes.every((m) => m.layers.isEnabled(31) && !m.layers.isEnabled(0) && m.material.visible === false), 'nothing drawn into the G-buffer');
  const prog = veils.list[0].material;
  assert.ok(L.washes.every((w) => w.material.fragmentShader === prog.fragmentShader && w.material.vertexShader === prog.vertexShader), 'one wash program');
  assert.ok(L.outer.washes[0].material.uniforms.uRays.value.x > 0 && L.mouthMesh.userData.wash.material.uniforms.uRays.value.x === 0, 'rays on the column only');
  L.update({ mouth: V(0, 0.4, 0), k: 1, time: 1, eye: V(0, 1.5, 4), scale: BOX_SCALE });
  assert.ok(L.visible);
  const pos = L.outer.meshes[0].geometry.attributes.position;
  const ys = Array.from({ length: pos.count }, (_, i) => pos.getY(i));
  assert.ok(Math.max(...ys) > 3 && Math.min(...ys) > 0.39, 'up out of its mouth, metres high');
  const motes = L.moteMesh.geometry.attributes.position.array;
  assert.ok(motes.every(Number.isFinite), 'the motes placed');
  L.update({ mouth: V(0, 0.4, 0), k: 0 });
  assert.equal(L.visible, false, 'nothing at no light');
  L.dispose();
  assert.equal(veils.list.length, 0, 'its washes out of the pass');
  assert.equal(veils.scene.children.length, 0);
  assert.ok(!L.group.parent, 'gone from the scene');
});

test('in a chest opening: light exists while it opens, follows the lid, lights round it, and is removed after', () => {
  for (const kind of ['makers', 'temple']) {
    const scene = new THREE.Scene(), veils = new Veils();
    const parts = buildBox(`t.${kind}`, { kind });
    parts.root.scale.setScalar(BOX_SCALE);
    scene.add(parts.root);
    const box = { id: `t.${kind}`, pos: V(), yaw: 0.4, parts, scene, light: new THREE.Vector4(0, -1e5, 0, 0), sceneLight: 0 };
    let ended = 0;
    const sc = new BoxScene({ box, def: ITEMS.lens, item: 'lens', player: null, veils, onGrant() {}, onEnd: () => ended++ });
    sc.start();
    assert.ok(sc.light && veils.list.length === 4, `${kind}: its light, as washes`);
    const A = parts.mats.body.uniforms.uBoxA.value;
    const rows = [];
    let guard = 0;
    while (sc.phase !== 'card' && guard++ < 30 * 20) {
      sc.update(1 / 30);
      const p = parts.petals[0].pivot.quaternion;
      rows.push({ ph: sc.phase, t: sc.t, k: sc.lightK, lid: 2 * Math.acos(Math.min(1, Math.abs(p.w))), lamp: box.light.w, y: A.y, vis: sc.light.visible });
    }
    const before = rows.filter((r) => ['wake', 'rise', 'wobble'].includes(r.ph));
    assert.ok(before.every((r) => r.k === 0 && !r.vis), `${kind}: no light out of it before it opens`);
    assert.ok(before.some((r) => r.lamp > LAMP.base), `${kind}: a little at its seam`);
    const opening = rows.filter((r) => r.ph === 'dissolve' && r.t <= TIMES.dissolve * OPENING.open);
    assert.ok(opening.length > 10);
    for (let i = 1; i < opening.length; i++) {
      assert.ok(opening[i].k >= opening[i - 1].k - 1e-9 && opening[i].lid >= opening[i - 1].lid - 1e-9, `${kind}: light and lid rise together`);
      if (opening[i].k > opening[i - 1].k + 1e-6) assert.ok(opening[i].lamp > opening[i - 1].lamp - 1e-6, `${kind}: its lamp with it`);
    }
    const peak = rows.reduce((m, r) => (r.k > m.k ? r : m));
    assert.ok(peak.k > 0.98 && peak.ph === 'dissolve', `${kind}: full as the halves open`);
    assert.ok(peak.lamp > LAMP.base + LAMP.reach * 0.95, `${kind}: its lamp reaches out round it`);
    assert.ok(peak.y > 1.5, `${kind}: its linings glow with it (uBoxA.y over 1)`);
    const mouthY = sc.mouth().y;
    assert.ok(Math.abs(mouthY - parts.size.h * BOX_SCALE * MOUTHS[kind].y) < 1e-6, `${kind}: from where it opens`);
    assert.ok(Math.abs(rows.at(-1).k - SETTLE) < 1e-6 && sc.light.visible, `${kind}: settled and still shining on the card`);
    sc.dismiss(true);
    for (let i = 0; i < 30 * 3 && !sc.done; i++) sc.update(1 / 30);
    assert.ok(sc.done && ended === 1);
    assert.equal(sc.light, null);
    assert.equal(veils.list.length, 0, `${kind}: its washes out of the pass after`);
    assert.ok(!scene.getObjectByName('Chest light'), `${kind}: nothing left in the scene`);
    assert.ok(box.light.y < -1e4 && box.sceneLight === 0, `${kind}: its lamp out`);
  }
});

test('the little shapes are gone: no blades, no specks out of the chest (issue #285)', async () => {
  const model = await import('../src/boxes/model.js');
  assert.equal(model.buildShaft, undefined);
  assert.equal(model.buildMotes, undefined);
});
