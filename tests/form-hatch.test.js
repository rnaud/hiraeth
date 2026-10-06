import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeMaterial, surfaceDefines, formOf, FORM, MODE_TERRAIN, MODE_OUTFIT } from '../src/materials.js';
import { formAxis, padForm, mergeFormed, keepForm } from '../src/form.js';
import { RoomKit, mergeable, put } from '../src/levels/lab-kit.js';

const near = (a, b, e = 1e-5) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
const at = (g, k, i = 0) => { const a = g.attributes[k]; return [a.getX(i), a.getY(i), a.getZ(i), a.itemSize > 3 ? a.getW(i) : undefined]; };

test('hatching that follows the form: a material asks for it, never a person, the ground or water', () => {
  assert.equal(surfaceDefines({ color: '#fff', form: true }).S_FORM, 1);
  assert.equal(surfaceDefines({ color: '#fff' }).S_FORM, undefined);
  for (const o of [{ figure: true }, { mode: MODE_TERRAIN }, { mode: MODE_OUTFIT }, { glass: true }, { facePart: true }]) assert.equal(formOf({ ...o, form: true }), false);
  const m = makeMaterial({ color: '#c8643f', form: true, key: 't.form.mat' });
  // a part with no axis reads kind 0: plain hatching
  assert.deepEqual(m.defaultAttributeValues.aFormC, [0, 0, 0, 0]);
  assert.ok(m.vertexShader.includes('in vec4 aFormC') && m.fragmentShader.includes('vec2 formHatch('));
  assert.ok(/else if \(dark > 0\.0 && uHatch > 0\.0 && vForm\.w > 0\.5 && uFormHatch > 0\.0\)/.test(m.fragmentShader), 'only parts with an axis, only in shade');
});

test('a part carries its axis through translate, rotate, put and the merge', () => {
  const g = formAxis(new THREE.CylinderGeometry(1, 1, 4, 8), 'wrap');
  assert.equal(at(g, 'aFormC')[3], FORM.kinds.wrap);
  g.rotateZ(Math.PI / 2).translate(5, 2, -3);
  const [cx, cy, cz] = at(g, 'aFormC'), [ax, ay, az] = at(g, 'aFormA');
  near(cx, 5); near(cy, 2); near(cz, -3);
  near(Math.abs(ax), 1); near(ay, 0); near(az, 0);   // (the y axis turned onto x)
  put(g, 1, 0, 0, Math.PI / 2);
  near(at(g, 'aFormC')[0], 1 + (-3)); near(at(g, 'aFormC')[2], -5);   // (yawed a quarter turn: x → -z, z → x)
  near(Math.abs(at(g, 'aFormA')[2]), 1);
  // a copy keeps carrying it once told so
  const n = keepForm(g.toNonIndexed()).translate(0, 10, 0);
  near(at(n, 'aFormC')[1], 12);
  // a cap's axis: every vertex the same line
  const cap = formAxis(new THREE.LatheGeometry([new THREE.Vector2(1, 0), new THREE.Vector2(3, 1)], 12), 'cap', { centre: [2, 0, 2] });
  assert.equal(at(cap, 'aFormC', cap.attributes.position.count - 1)[3], FORM.kinds.cap);
  near(at(cap, 'aFormC', 5)[0], 2);
});

test('parts with and without an axis merge (the others take none)', () => {
  const a = formAxis(new THREE.CylinderGeometry(1, 1, 2, 6).toNonIndexed(), 'wrap');
  const b = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  b.deleteAttribute('uv'); a.deleteAttribute('uv');
  const m = mergeFormed([a, b]);
  const n = m.attributes.position.count;
  assert.equal(m.attributes.aFormC.count, n);
  assert.equal(m.attributes.aFormC.getW(0), FORM.kinds.wrap);
  assert.equal(m.attributes.aFormC.getW(n - 1), 0);
  assert.equal(padForm([new THREE.BoxGeometry()]).length, 1);   // (none with an axis: nothing added)
  // the Lab's and the references' kit keeps the axis through mergeable and pads at finish
  const group = new THREE.Group();
  const kit = new RoomKit({ group, centre: new THREE.Vector3() });
  const mat = makeMaterial({ color: '#7ba381', form: true, key: 't.form.kit' });
  kit.add(mat, formAxis(new THREE.LatheGeometry([new THREE.Vector2(1, 0), new THREE.Vector2(1, 3)], 10), 'wrap').translate(4, 0, 0));
  kit.add(mat, new THREE.BoxGeometry(1, 1, 1));
  assert.ok(mergeable(formAxis(new THREE.CylinderGeometry(), 'cap')).attributes.aFormC, 'mergeable keeps it');
  kit.finish();
  const mesh = group.children[0];
  assert.ok(mesh.geometry.attributes.aFormC, 'merged with its axis');
  near(mesh.geometry.attributes.aFormC.getX(0), 4);
});

test('the angle closes on itself: a stroke on the seam is the same stroke either side', () => {
  // formLevel's stroke id (mod(k · s, period)) for c just either side of the seam, at every power-of-two spacing
  const T = FORM.turn, id = (c, s) => { const k = Math.floor(c / s + 0.5); return ((k * s) % T + T) % T; };
  for (let e = -4; e <= Math.log2(T) - 1; e++) {
    const s = 2 ** e;
    assert.equal(id(T / 2 - 1e-6, s), id(-T / 2 + 1e-6, s), `spacing ${s}`);
    assert.equal(Number.isInteger(T / s), true);
  }
});

test('the worlds give their caps and cylinders an axis', async () => {
  const src = async (f) => (await import('node:fs')).readFileSync(new URL(`../src/levels/${f}`, import.meta.url), 'utf8');
  assert.ok(/formAxis\(t\.vis, 'cap'/.test(await src('arzach2.js')), "Vael II's tables");
  assert.ok(/formAxis\(canopy\.toNonIndexed\(\), 'cap'\)/.test(await src('spheres.js')), "the Garden's umbrellas");
  assert.ok(/formAxis\(lathe\(parts\[key\], seg\), 'cap'\)/.test(await src('perdide2.js')), "Lorn II's mushrooms");
  assert.ok(/formAxis\(new THREE\.CylinderGeometry\(r1, r0, len, seg, 1, open\), 'wrap'\)/.test(await src('buried.js')), "the Buried Machine's tanks");
  for (const f of ['reference-vael2.js', 'reference-spheres.js', 'reference-lorn.js', 'reference-buried.js']) assert.ok((await src(f)).includes('formAxis('), f);
});
