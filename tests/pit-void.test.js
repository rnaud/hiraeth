// Issue #312: every deadly drop wears the dark from below (src/pit-void.js); a drop with a floor to land on none.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './register-gadgets.js';
import { TEMPLES } from '../src/temples/index.js';
import { TempleRuntime } from '../src/temples/runtime.js';
import { GameState } from '../src/game-state.js';
import { pitVoid, worldVoid, worldVoidY, PIT_VOID } from '../src/pit-void.js';
import { Veils } from '../src/veil.js';
import { CLEFT } from '../src/vael-canyon.js';

const quiet = (f) => { const w = console.warn, l = console.log; console.warn = console.log = () => {}; try { return f(); } finally { console.warn = w; console.log = l; } };
/** Each temple's rooms built on their own (its pits; not its building outside or its change to the world, which want the world). */
const built = Object.entries(TEMPLES).map(([id, T]) => {
  const level = { lights: [] };
  const rt = quiet(() => new TempleRuntime({ scene: new THREE.Scene(), level, def: { ...T.def, exterior: null, change: null }, game: new GameState(null) }));
  return { id, rt, level };
});

test('every temple pit fills with the dark from below, unless it says it is deadly by its own look', () => {
  let n = 0;
  for (const { id, rt, level } of built) {
    for (const pit of rt.pits) {
      if (pit.own) { assert.equal(pit.look, undefined, `${id} ${pit.room}: its own look (${pit.own}), no dark`); continue; }
      n++;
      assert.ok(pit.look?.mesh?.userData.pitVoid, `${id}: the ${pit.room} pit has the dark`);
      assert.ok(level.veils.list.includes(pit.look.mesh), `${id} ${pit.room}: drawn as a wash over the picture`);
      // its box is the pit's own: a point in the pit (where it puts you back) is in the dark, one over its lip is not
      const mid = pit.box.getCenter(new THREE.Vector3()), w = rt.kit.world(mid.x, mid.y, mid.z);
      assert.ok(pit.contains(w) && pit.look.contains(w), `${id} ${pit.room}: the dark is where the pit is`);
      const over = rt.kit.world(mid.x, pit.box.max.y + 1, mid.z);
      assert.ok(!pit.contains(over) && !pit.look.contains(over), `${id} ${pit.room}: not over its lip`);
    }
  }
  assert.ok(n >= 20, `the temples' pits (${n})`);
  // the one that says so: the Casting-House's molten channel
  const molten = built.find((b) => b.id === 'moonfoundry').rt.pits.find((p) => p.room === 'furnace');
  assert.ok(molten.own && !molten.look);
});

test('the dark only where a drop is deadly: none over a floor you land on, nothing in a temple without pits', () => {
  // every wash a temple adds for the dark is one of its pits'
  for (const { id, rt, level } of built) {
    const darks = (level.veils?.list ?? []).filter((w) => w.userData.pitVoid);
    assert.equal(darks.length, rt.pits.filter((p) => !p.own).length, `${id}: one dark a deadly pit, no more`);
  }
  // a world with no kill height (Vael: its cleft round the lone tower has a floor, CLEFT.floor) has no void
  assert.equal(worldVoidY({ killY: -Infinity }), null);
  assert.equal(worldVoid({ killY: -Infinity }), null);
  assert.ok(CLEFT.floor > -Infinity);
  const level = { killY: -Infinity };
  worldVoid(level);
  assert.equal(level.veils, undefined, 'no washes made for nothing');
});

test("a world's void: under its kill height (or voidY), as wide as its reach", () => {
  const level = { voidY: -40, killY: -Infinity, limit: 500, spawn: new THREE.Vector3(10, 0, 20) };
  const v = worldVoid(level);
  assert.ok(v && level.veils instanceof Veils && level.veils.list.includes(v.mesh));
  assert.ok(v.contains(new THREE.Vector3(300, -41, -300)), 'under the kill height, far out');
  assert.ok(!v.contains(new THREE.Vector3(0, -30, 0)), 'not over it, where you still fly');
  assert.equal(worldVoidY({ killY: -20 }), -20);
});

test('the look: the box in its frame, its uniforms, its clock; bound after, it reads the scene', () => {
  const frame = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(100, 2000, -50);
  const veils = new Veils();
  const v = pitVoid(veils, { min: [-5, -10, 0], max: [5, -2, 20], frame });
  assert.equal(v.mesh.material.side, THREE.BackSide, 'its inside faces: drawn from outside it and from within');
  assert.ok(v.contains(new THREE.Vector3(-5, -5, 10).applyMatrix4(frame)));
  assert.ok(!v.contains(new THREE.Vector3(-5, 0, 10).applyMatrix4(frame)));
  assert.equal(v.mesh.material.uniforms.uLook.value.x, Math.min(PIT_VOID.fade, 8));
  v.update(3.5);
  assert.equal(v.mesh.material.uniforms.uLook.value.w, 3.5);
  const tNormal = { name: 'the scene\'s normals and depth' };
  veils.bind({ tNormal, uniforms: {} });
  assert.equal(v.mesh.material.uniforms.tNormal.value, tNormal);
  const late = pitVoid(veils, { min: [0, 0, 0], max: [1, 1, 1] });
  assert.equal(late.mesh.material.uniforms.tNormal.value, tNormal, 'added after the bind: bound at once');
  v.dispose();
  assert.ok(!veils.list.includes(v.mesh));
});
