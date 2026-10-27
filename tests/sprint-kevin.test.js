// Kevin Iglesias's sprint, the traveller's sprint loop (a switch in issue #704, the default since #709): the conversion of his rig
// (scripts/mocap/maps.js KEVIN_MAP, kevin-sprint.js), the shipped clip (public/anim/sprint-kevin.glb), the switch
// (src/animator.js sprintSetting) and the Animator taking it in the sprint's place (useSprint), the traveller's alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { mapFor, KEVIN_MAP } from '../scripts/mocap/maps.js';
import { closeLoop, SPRINT_CLIP, SPRINT_TRACKS } from '../scripts/mocap/kevin-sprint.js';
import { BONES } from '../scripts/mocap/retarget.js';
import { libraryFrom, sprintFrom, sprintSetting, SPRINTS, Animator, analyseGait, gaitOf } from '../src/animator.js';
import { buildCharacter } from '../src/player.js';
import { devTabs } from '../src/world-debug.js';

const read = (f) => readFile(new URL(`../${f}`, import.meta.url));
const parse = async (f) => { const b = await read(f); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
let assets = null;
const load = () => (assets ??= Promise.all([parse('public/anim/ual.glb'), parse('public/anim/sprint-kevin.glb')]).then(([ual, kev]) => ({ ual, kev, lib: libraryFrom(ual), clip: sprintFrom(kev, 'kevin') })));

const KEVIN_BONES = ['B-root', 'B-hips', 'B-spine', 'B-chest', 'B-neck', 'B-head', ...['L', 'R'].flatMap((s) => [`B-shoulder${s}`, `B-upperArm${s}`, `B-forearm${s}`, `B-hand${s}`, `B-middleFinger01${s}`, `B-thigh${s}`, `B-shin${s}`, `B-foot${s}`, `B-toe${s}`])];

test('his rig is recognised and every bone of ours takes one of his', () => {
  const m = mapFor(KEVIN_BONES);
  assert.ok(m, 'the B- skeleton has a map');
  for (const b of BONES) assert.ok(m.map[b]?.rot, `${b} mapped`);
  assert.equal(m.map.thigh_l.rot, 'B-thighL');
  assert.equal(m.landmarks.ballR, 'B-toeR');
  // (without the fingers the hands keep their turn, unaimed)
  assert.equal(mapFor(KEVIN_BONES.filter((n) => !n.includes('Finger'))).map.hand_l.aim, undefined);
  assert.deepEqual(Object.keys(KEVIN_MAP).sort(), [...BONES].sort());
});

test('a loop is closed: the last frame is the first, the drift taken out evenly', () => {
  const n = 9, local = Object.fromEntries(BONES.map((k) => [k, new Float32Array(n * 4)]));
  const q = new THREE.Quaternion();
  for (const k of BONES) for (let i = 0; i < n; i++) q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.1 * i / (n - 1)).toArray(local[k], i * 4);
  const pelvisPos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pelvisPos[i * 3 + 2] = 0.04 * i / (n - 1);
  const r = { n, local, pelvisPos };
  const { closed, drift } = closeLoop(r);
  assert.ok(Math.abs(closed - 0.1) < 1e-4 && Math.abs(drift - 0.04) < 1e-6);
  for (const k of BONES) for (let i = 0; i < n; i++) assert.ok(Math.abs(local[k][i * 4 + 3] - 1) < 1e-5, 'the steady turn taken out');
  assert.ok(Math.abs(pelvisPos[(n - 1) * 3 + 2] - pelvisPos[2]) < 1e-7);
});

test('the shipped clip: one closed loop on the library skeleton, 0.533 s', async () => {
  const { kev, ual } = await load();
  assert.equal(kev.animations.length, 1);
  const a = kev.animations[0];
  assert.equal(a.name, SPRINT_CLIP);
  assert.ok(Math.abs(a.duration - 0.5333) < 0.002, `${a.duration}`);
  assert.equal(a.userData.loop, true);
  const names = new Set(a.tracks.map((t) => t.name));
  for (const k of SPRINT_TRACKS) assert.ok(names.has(`${k}.quaternion`), `${k} turns`);
  assert.ok(names.has('pelvis.position'));
  for (const t of a.tracks) assert.ok(ual.scene.getObjectByName(t.name.split('.')[0]), `${t.name} binds onto the library`);
  // (closed: its last key is its first)
  for (const t of a.tracks) { const S = t.getValueSize(), n = t.times.length; for (let j = 0; j < S; j++) assert.ok(Math.abs(t.values[j] - t.values[(n - 1) * S + j]) < 1e-4, `${t.name} closes`); }
});

test('his sprint leans further and pumps the arms higher than the library\'s, both feet coming down in turn', async () => {
  const { lib, clip } = await load();
  const pose = (c) => {
    const s = cloneSkeleton(lib.scene), mixer = new THREE.AnimationMixer(s);
    mixer.clipAction(c).play();
    const P = (n) => s.getObjectByName(n).getWorldPosition(new THREE.Vector3());
    let lean = 0, fwd = -Infinity, back = Infinity;
    const N = 40;
    for (let i = 0; i < N; i++) {
      mixer.setTime((i / N) * c.duration); s.updateMatrixWorld(true);
      const v = P('neck_01').sub(P('pelvis')); lean += Math.atan2(v.z, v.y) / N;
      for (const f of ['l', 'r']) { const z = P(`hand_${f}`).z - P('pelvis').z; fwd = Math.max(fwd, z); back = Math.min(back, z); }
    }
    return { lean, swing: fwd - back };
  };
  const ours = pose(lib.clips.sprint), his = pose(clip);
  assert.ok(his.lean > ours.lean + 0.05, `lean ${his.lean.toFixed(2)} vs ${ours.lean.toFixed(2)} rad`);
  assert.ok(his.swing > ours.swing * 1.4, `arm swing ${his.swing.toFixed(2)} vs ${ours.swing.toFixed(2)} m`);
  const feet = gaitOf(lib, clip);
  for (const f of ['l', 'r']) { const on = Array.from(feet.contact[f]).filter((x) => x > 0.5).length / feet.contact[f].length; assert.ok(on > 0.12 && on < 0.4, `${f} down ${on.toFixed(2)} of the cycle`); }
  const down = (c) => c.findIndex((x, i) => x >= 0.5 && c[(i + c.length - 1) % c.length] < 0.5) / c.length;
  const d = (((down(feet.contact.r) - down(feet.contact.l)) % 1) + 1) % 1;
  assert.ok(Math.abs(d - 0.5) < 0.1, `the feet half a cycle apart (${d.toFixed(2)})`);
});

test('the switch: his sprint unless asked for, ?sprint= or this device; #704\'s stored choice not read (issue #709)', () => {
  const g = globalThis, had = { location: g.location, localStorage: g.localStorage };
  const store = new Map();
  g.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  try {
    g.location = { search: '' };
    assert.equal(sprintSetting.get(), 'kevin', 'the default');
    // (a device left on the library's while #704's switch was tried takes the new default)
    store.set('hiraeth.sprint', 'ual');
    assert.equal(sprintSetting.get(), 'kevin');
    sprintSetting.set('ual');
    assert.equal(store.get('hiraeth.sprintLoop'), 'ual');
    assert.equal(sprintSetting.get(), 'ual', 'chosen again: kept');
    g.location = { search: '?sprint=kevin' };
    assert.equal(sprintSetting.get(), 'kevin', 'the address wins');
    g.location = { search: '?sprint=nonsense' };
    assert.equal(sprintSetting.get(), 'ual');
    sprintSetting.set('nonsense');
    assert.equal(sprintSetting.get(), 'kevin');
  } finally { g.location = had.location; g.localStorage = had.localStorage; }
  assert.equal(SPRINTS.ual, null);
  assert.ok(SPRINTS.kevin.url.endsWith('sprint-kevin.glb'));
});

test('the Animator takes it in the sprint\'s place, its feet in step with the library\'s; the people keep the library\'s', async () => {
  const { lib, clip } = await load();
  const libSprint = lib.clips.sprint;
  const A = new Animator(lib, buildCharacter()), people = new Animator(lib, buildCharacter());
  A.useSprint(clip);
  assert.equal(A.clips.sprint, clip);
  assert.equal(A.actions.sprint.getClip(), clip);
  assert.equal(A.sprintName, 'kevin');
  assert.equal(lib.clips.sprint, libSprint, 'the library is untouched');
  assert.equal(people.clips.sprint, libSprint);
  assert.equal(analyseGait(lib).clips.sprint.phase ?? 0, 0);
  // (his left foot comes down where the library's does, through the shared phase)
  const G = A.gait.clips.sprint, base = analyseGait(lib).clips.sprint;
  const at = (c, p) => c[Math.floor(((((p % 1) + 1) % 1) * c.length)) % c.length];
  const down = base.contact.l.findIndex((x, i, c) => x >= 0.5 && c[(i + c.length - 1) % c.length] < 0.5) / base.contact.l.length;
  assert.ok(at(G.contact.l, down + G.phase + 0.02) > 0.5, 'down just after the library\'s touchdown');
  assert.equal(G.strideK, SPRINTS.kevin.strideK);
  // sprinting with it: the pose is his
  for (let i = 0; i < 60; i++) A.update(1 / 60, { speed: 8.2, onGround: true, mode: 'ground', walkAt: 1.5, jogAt: 3.8, sprintAt: 8.2, steering: true });
  assert.ok(A.w.sprint > 0.9 && A.actions.sprint.getEffectiveWeight() > 0.9);
  // and back
  A.useSprint(null);
  assert.equal(A.clips.sprint, libSprint);
  assert.equal(A.gait.clips.sprint, base);
  assert.equal(A.sprintName, null);
});

test('the dev menu has the switch beside the carried stop', () => {
  const tabs = devTabs({ motion: true, toggles: { kevinSprint: true } });
  const row = tabs.find((t) => t.id === 'story').rows.find((r) => r.act?.key === 'kevinSprint');
  assert.ok(row, 'a row for it');
  assert.equal(row.state, true);
  assert.match(row.hint, /\?sprint=kevin \/ ual/);
  assert.match(row.hint, /the default/);
});

test('the shipped file is what the converter makes of the pack\'s FBX (where the FBX is on this machine)', { skip: !existsSync(new URL('../data/mocap/kevin-iglesias/HumanM@Sprint01_Forward.fbx', import.meta.url)) && 'the FBX stays out of git' }, async () => {
  const { sprintGLB } = await import('../scripts/mocap/kevin-sprint.js');
  const { ual } = await load();
  const fbx = await read('data/mocap/kevin-iglesias/HumanM@Sprint01_Forward.fbx');
  const { bytes } = sprintGLB(fbx.buffer.slice(fbx.byteOffset, fbx.byteOffset + fbx.byteLength), ual.scene);
  assert.ok(Buffer.from(bytes).equals(await read('public/anim/sprint-kevin.glb')), 'same bytes: run node scripts/mocap/build-sprint.mjs');
});
