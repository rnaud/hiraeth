// A foe's eyes on the traveller (issue #508) cross the engines' bridge: the mirror (engine/mirror.js, with the Unity
// backend's options) sends the eyes' world matrices as they follow him, a skinned eye's (the roller's) as its bones'.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installMatrixCache } from '../src/matrix-cache.js';
import { watchSceneEdits } from '../engine/scene-matrices.js';
import { SceneMirror } from '../engine/mirror.js';
import { Foes } from '../src/foes.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';

installMatrixCache();
watchSceneEdits();

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };

for (const opts of [{}, { quietWalk: true, listMatrices: true, stillMatrices: true, skipHidden: true }]) {
  test(`the eyes' moves reach the backend as matrices (${Object.keys(opts).length ? 'the Unity bridge\'s options' : 'plain'})`, () => {
    clearTargets();
    const P = { pos: v(5, 0, 3), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurt() {}, knockDown() { return true; }, flinch() {} };
    const scene = new THREE.Scene();
    const foes = new Foes({ scene, level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null) });
    foes.waveRest = 1e9;
    const sent = new Map(), bones = new Map();
    const B = { geometry() {}, material() {}, create() {}, visible() {}, geometryOf() {}, vertices() {}, instances() {}, materialLive() {}, keyWeights() {}, remove() {}, camera() {},
      transforms(ids, mats, n) { for (let i = 0; i < n; i++) sent.set(ids[i], Array.from(mats.subarray(i * 16, i * 16 + 16))); },
      skeleton(sid, mats, n) { bones.set(sid, Array.from(mats.subarray(0, n * 16))); } };
    const mirror = new SceneMirror(B, opts), cam = new THREE.PerspectiveCamera();
    const crab = foes.add('crab', v(0, 0, 0)), roller = foes.add('roller', v(8, 0, 0));
    const eyeMesh = (f) => { let m = null; f.model.gaze[0].node.traverse((o) => { if (!m && o.isMesh) m = o; }); return m; };
    // (the crab standing: chasing from afar the shellback scuttles side-on, #800, and he would stay past one side of its look)
    const frame = () => { for (const f of [crab, roller]) { f.heading = 0; f.state = f === crab ? 'idle' : 'chase'; f.provoked = true; f.dist = f.pos.distanceTo(P.pos); foes.look(f, DT); } scene.updateMatrixWorld(); mirror.sync(scene, cam); };
    for (let i = 0; i < 30; i++) frame();
    const id = mirror.idOf(eyeMesh(crab));
    assert.ok(id > 0, 'the crab\'s eye is a drawable the backend knows');
    const was = sent.get(id).slice(), bonesWas = new Map([...bones].map(([k, x]) => [k, x.slice()]));
    // he goes round to its other side: the eyes follow, and the backend hears it
    P.pos.set(-5, 0, 3);
    for (let i = 0; i < 40; i++) frame();
    const now = sent.get(id);
    assert.ok(Math.hypot(now[12] - was[12], now[13] - was[13], now[14] - was[14]) > 0.05, 'the crab\'s eye moved in the matrices sent');
    assert.ok([...bones].some(([k, x]) => bonesWas.has(k) && x.some((y, i) => Math.abs(y - bonesWas.get(k)[i]) > 0.01)), 'the roller\'s eyeballs\' bones sent turned');
    foes.dispose(); clearTargets();
  });
}
