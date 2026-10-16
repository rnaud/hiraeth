// The makers' houses' air (issue #372, src/temples/air.js): every skinned house has one, within the budgets (two layers,
// one draw each; half the motes on a low-detail preset), only while you are inside (the world's motes hidden there,
// the house's lights eased and put back), its sound's bed known to the sound, and the motes' new options leaving the
// worlds' motes as they were. The sound is rendered on the engines' in-memory Web Audio: nothing reaches a speaker.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './register-gadgets.js';
import { HOUSE_AIR, AIR_LOW, airLayers, lightPulse, HouseAir } from '../src/temples/air.js';
import { Motes } from '../src/life.js';
import { portMaterial } from '../engine/unity/port-format.js';
import { AudioContext, installAudio } from '../engine/webaudio.js';

test('every house in a futuristic skin has its air, and nothing else does', async () => {
  const { TEMPLES } = await import('../src/temples/index.js');
  const skinned = Object.keys(TEMPLES).filter((id) => typeof TEMPLES[id].def.skin === 'function').sort();
  assert.equal(skinned.length, 13);
  assert.deepEqual(Object.keys(HOUSE_AIR).sort(), skinned);
});

test('within the budgets: at most two layers (a draw each), a few hundred motes, half on low detail', () => {
  for (const [id, A] of Object.entries(HOUSE_AIR)) {
    assert.ok(A.layers.length >= 1 && A.layers.length <= 2, `${id}: ${A.layers.length} layers`);
    const full = airLayers(id), low = airLayers(id, { lowDetail: true });
    const n = full.reduce((s, l) => s + l.count, 0), nl = low.reduce((s, l) => s + l.count, 0);
    assert.ok(n <= 160, `${id}: ${n} motes`);
    assert.ok(nl <= Math.ceil(n * AIR_LOW) + 2, `${id}: ${nl} on low`);
    assert.ok(A.theme && A.light && A.sound?.bed, `${id}: a theme, a light and a sound`);
  }
});

test('the fire houses have embers: glowing, warm and rising', () => {
  for (const id of ['desert', 'buried', 'moonfoundry']) {
    const ember = HOUSE_AIR[id].layers.find((l) => l.glow >= 0.7 && l.rise > 0.5);
    assert.ok(ember, `${id}: embers`);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(ember.color.slice(i, i + 2), 16) / 255);
    assert.ok(r > 0.9 && g > 0.4 && g < 0.85 && b < 0.4, `${id}: ${ember.color} is an ember's orange`);
    assert.equal(HOUSE_AIR[id].light.kind, 'flicker', `${id}: its lights flicker`);
  }
});

test('the lights\' pulse stays within its depth, and moves', () => {
  for (const [id, A] of Object.entries(HOUSE_AIR)) {
    const v = Array.from({ length: 400 }, (_, i) => lightPulse(A.light, i * 0.05, 3));
    const lo = Math.min(...v), hi = Math.max(...v);
    assert.ok(lo >= 1 - A.light.depth * 1.05 - 1e-9 && hi <= 1 + A.light.depth * 1.05 + 1e-9, `${id}: ${lo.toFixed(3)}..${hi.toFixed(3)}`);
    assert.ok(hi - lo > A.light.depth * 0.5, `${id}: it moves`);
  }
});

test('the motes\' new options leave the worlds\' motes as they were, and reach the Unity port', () => {
  const m = new Motes(null, { count: 8 });
  assert.equal(m.sway, 1); assert.equal(m.tall, 0.5); assert.equal(m.uniforms.uAlpha.value, 1);
  const spec = { type: 'shader', u: { uColor: [1, 0.6, 0.2], uSize: 0.04, uGlow: 1, uAlpha: 0.5 } };
  const p = portMaterial(spec, 3);
  assert.equal(p.port, 'mote'); assert.equal(p.glow, 1); assert.equal(p.alpha, 0.5);
  assert.equal(portMaterial({ type: 'shader', u: { uColor: [1, 1, 1], uSize: 0.05, uGlow: 0 } }).alpha, 1);
});

/** A level with one house: inside a box round the origin, its skin on, two lights of its own. */
function fakeLevel(id = 'buried') {
  const box = new THREE.Box3(new THREE.Vector3(-10, -2, -10), new THREE.Vector3(10, 12, 10));
  const lights = [new THREE.Vector4(0, 3, 0, 8), new THREE.Vector4(4, 3, 0, 6)];
  const rt = { id, def: { name: 'a house' }, skin: {}, ownLights: lights, inside: (p) => box.containsPoint(p) };
  return { level: { temples: [rt, { id: 'edena', skin: null, inside: () => true }] }, rt, lights };
}

test('the air is built when you first go in, shown only inside, the world\'s motes hidden there and the lights put back', () => {
  const { level, rt, lights } = fakeLevel();
  const world = new Motes(null, { count: 4 }), host = new THREE.Scene();
  const air = new HouseAir(level, { host, worldMotes: world });
  const cam = { position: new THREE.Vector3(0, 2, 0) };
  assert.equal(air.update(0.016, 1, cam, new THREE.Vector3(50, 0, 0)), null, 'outside');
  assert.equal(air.built.size, 0, 'nothing built before you go in');
  assert.equal(air.sound, null);
  assert.equal(air.update(0.016, 2, cam, new THREE.Vector3(0, 1, 0)), rt, 'inside');
  const layers = air.built.get(rt);
  assert.equal(layers.length, HOUSE_AIR.buried.layers.length);
  assert.ok(layers.every((m) => m.points.visible && m.points.parent === host), 'its motes in the host scene, shown');
  assert.equal(world.scene.children[0].visible, false, 'the world\'s motes hidden inside');
  assert.equal(air.sound, HOUSE_AIR.buried.sound);
  const moved = lights.map((l) => l.w);
  air.update(0.016, 2.7, cam, new THREE.Vector3(0, 1, 0));
  assert.ok(lights.some((l, i) => l.w !== moved[i]), 'its lights flicker');
  air.update(0.016, 3, cam, new THREE.Vector3(50, 0, 0));
  assert.deepEqual(lights.map((l) => l.w), [8, 6], 'its lights back as built');
  assert.ok(layers.every((m) => !m.points.visible), 'hidden outside');
  assert.equal(world.scene.children[0].visible, true);
  assert.equal(air.sound, null);
  // a low-detail preset: half the motes
  const low = new HouseAir(fakeLevel().level, { lowDetail: () => true, host });
  low.update(0.016, 1, cam, new THREE.Vector3(0, 1, 0));
  const counts = [...low.built.values()][0].map((m) => m.count);
  assert.deepEqual(counts, HOUSE_AIR.buried.layers.map((l) => Math.max(4, Math.round(l.count * AIR_LOW))));
  air.dispose(); low.dispose();
});

test('the page draws each layer from a scene of its own, against the G-buffer it is given', () => {
  const { level } = fakeLevel('desert');
  const air = new HouseAir(level, {});
  const tex = new THREE.Texture();
  air.setTarget(tex, 640, 360, 1.5);
  air.update(0.016, 1, { position: new THREE.Vector3() }, new THREE.Vector3(0, 1, 0));
  const scenes = air.scenes();
  assert.equal(scenes.length, HOUSE_AIR.desert.layers.length);
  for (const m of air.built.values().next().value) {
    assert.equal(m.uniforms.tNormal.value, tex); assert.equal(m.uniforms.uRes.value.x, 640); assert.equal(m.uniforms.uPR.value, 1.5);
  }
});

test('every house\'s bed sounds: its events on the beat, its drone and roar, and the world\'s ambience back outside', async () => {
  const G = globalThis;
  const saved = { window: G.window, AudioContext: G.AudioContext };
  G.window = G; G.window.addEventListener ??= () => {}; G.window.removeEventListener ??= () => {};
  delete G.AudioContext; installAudio(G);
  const { Sound } = await import('../src/audio.js');
  const s = new Sound('desert', { score: false });
  s.start();
  try {
    assert.ok(s.ctx instanceof AudioContext);
    s.ctx.render(4800);
    const base = { speed: 0, gust: 0, storm: 0, rain: 0, rainRoof: 0, altitude: 0, indoor: 1, rideSpeed: 0, jetPower: 1 };
    for (const [id, A] of Object.entries(HOUSE_AIR)) {
      s.update({ ...base, house: A.sound });
      assert.equal(s.houseBed, A.sound.bed);
      let made = 0;
      const mk = s.ctx.createBufferSource.bind(s.ctx), mo = s.ctx.createOscillator.bind(s.ctx);
      s.ctx.createBufferSource = () => { made++; return mk(); }; s.ctx.createOscillator = () => { made++; return mo(); };
      for (let b = 0; b < 60; b++) { s.beat = b; assert.equal(s.houseTick(A.sound.bed, s.ctx.currentTime + 0.1, 0.5), true, `${id}: ${A.sound.bed}`); }
      s.ctx.createBufferSource = mk; s.ctx.createOscillator = mo;
      assert.ok(made > 0, `${id}: something sounds in 60 beats`);
      const out = s.ctx.render(4800);
      assert.ok(out.every(Number.isFinite), `${id}: finite`);
      if (A.sound.hum) assert.equal(s.hum.f, A.sound.humF, `${id}: its drone`);
    }
    s.update({ ...base, house: null });
    assert.equal(s.houseBed, null);
    assert.equal(s.houseTick('wind', 0, 0.5), false, 'a world\'s ambience is not a house\'s');
  } finally {
    clearInterval(s.scheduler); clearInterval(s.menuTimer); s._unlisten?.();
    if (saved.AudioContext) G.AudioContext = saved.AudioContext; else delete G.AudioContext;
    if (saved.window === undefined) delete G.window;
  }
});
