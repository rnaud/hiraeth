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
  // (a house in the machined finish only, skins/machined-plates.js, has no air of its own: the Greenhouse, issue #691)
  const skinned = Object.keys(TEMPLES).filter((id) => typeof TEMPLES[id].def.skin === 'function' && !TEMPLES[id].def.skin.finishOnly).sort();
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

test('a fixed view holds the lights at their reach as built, on the web\'s capture and the engines\' pinned views alike (#264)', async () => {
  const { level, lights } = fakeLevel();
  const air = new HouseAir(level, { host: new THREE.Scene() });
  const cam = { position: new THREE.Vector3(0, 2, 0) };
  air.still = true;
  for (const t of [1, 1.3, 2.7, 5.1]) { air.update(0.016, t, cam, new THREE.Vector3(0, 1, 0)); assert.deepEqual(lights.map((l) => l.w), [8, 6], `still at ${t}`); }
  air.still = false;
  air.update(0.016, 2.7, cam, new THREE.Vector3(0, 1, 0));
  assert.ok(lights.some((l, i) => l.w !== [8, 6][i]), 'flickering again once let go');
  air.dispose();
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync(new URL('../engine/game.js', import.meta.url), 'utf8'), /pin\(v\) \{[^\n]*if \(houseAir\) houseAir\.still = !!v;/);
  assert.match(readFileSync(new URL('../scripts/design-qc/capture.mjs', import.meta.url), 'utf8'), /window\.houseAir\.still = true/);
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

test('every house uses one shared recording, replacing procedural house beds and restoring outdoors', async () => {
  const G = globalThis, saved = { window: G.window, AudioContext: G.AudioContext };
  G.window = G; G.window.addEventListener ??= () => {}; G.window.removeEventListener ??= () => {};
  delete G.AudioContext; installAudio(G);
  const { Sound } = await import('../src/audio.js');
  const s = new Sound('desert', { score: false, muted: false }); s.start();
  const calls = [], active = new Set();
  s.bank = { start(group) { const h = { set() {}, stop() { active.delete(h); } }; calls.push(group); active.add(h); return h; } };
  const levels = new Map(), originalSet = s.set.bind(s); s.set = (name, level, freq) => { levels.set(name, level); originalSet(name, level, freq); };
  try {
    const base = { speed: 0, gust: 1, storm: 0, rain: 0, rainRoof: 0, altitude: 0, indoor: 1, rideSpeed: 0, jetPower: 1, roar: 1, hum: 1 };
    for (const [id, A] of Object.entries(HOUSE_AIR)) {
      s.update({ ...base, house: A.sound });
      assert.equal(s.houseBed, 'recorded', id); assert.equal(active.size, 1);
      for (const name of ['roar', 'hiss', 'howl', 'wind', 'static']) assert.equal(levels.get(name), 0, id + ': no doubled ' + name);
      let ticks = 0; const old = s.houseTick; s.houseTick = () => { ticks++; return true; };
      s.ambienceTick(s.ctx.currentTime, .5); s.houseTick = old;
      assert.equal(ticks, 0, id + ': no old random house events');
    }
    assert.deepEqual(calls, ['temple-ambience']);
    s.update({ ...base, house: null }); assert.equal(active.size, 0); assert.equal(s.houseBed, null);
    assert.ok(levels.get('wind') > 0); assert.ok(levels.get('roar') > 0);
  } finally {
    clearInterval(s.scheduler); clearInterval(s.menuTimer); s._unlisten?.(); s._selectedWorldAudio?.dispose();
    if (saved.AudioContext) G.AudioContext = saved.AudioContext; else delete G.AudioContext;
    if (saved.window === undefined) delete G.window;
  }
});
