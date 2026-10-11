// A headless traveller (Player + Humanoid + the clip library + Physics) driven through scripted
// input, with the measures the animation work is judged by: how far a foot slides while it is
// on the ground, how deep a sole goes under it, how much the pose jitters, and how long the body
// takes to answer the stick. tests/locomotion.test.js uses it; so can a script (see
// docs/systems/animation.md, "Locomotion").
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Humanoid, prepareHuman } from '../src/humanoid.js';
import { buildCharacter, Player } from '../src/player.js';
import { Physics } from '../src/physics.js';
import { libraryFrom } from '../src/animator.js';
import { Animator } from '../src/animator.js';
import { attachMotion } from '../src/motion-match.js';
import { createTravellerV1 } from '../src/characters/traveller-v1.js';
import { course, measure, timeToFace, CAM_PLUS_Z, sampleFrame } from '../src/gait-course.js';

const parse = async (name) => {
  const b = await readFile(new URL(`../public/anim/${name}`, import.meta.url));
  return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
};
let assets = null;
export async function loadAssets() {
  // (the clip library with the captured motion attached, lib.motion: the people's walks, public/anim/walks.glb,
  // and the matching database, public/anim/locomotion.glb)
  assets ??= Promise.all([parse('ual.glb'), parse('human_m.glb'), parse('human_f.glb'), parse('walks.glb'), parse('locomotion.glb'), parse('moves.glb')]).then(([ual, m, f, walks, loco, moves]) => {
    const lib = libraryFrom(ual);
    attachMotion(lib, walks);
    attachMotion(lib, loco);
    attachMotion(lib, moves);
    return { lib, human: { m: prepareHuman(m.scene, 'm'), f: prepareHuman(f.scene, 'f') } };
  });
  return assets;
}

// the game's traveller (the coral shirt), its GLB without textures (Node has no image decoder), as tests/idle-legs.test.js loads him
let v1 = null;
export async function travellerV1() {
  v1 ??= (async () => {
    const element = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null });
    globalThis.document ??= { createElement: element, body: element(), getElementById: () => null, querySelector: () => null };
    globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
    const { parseBody } = await import('../src/makehuman/body.js');
    const read = (f) => readFile(new URL(`../${f}`, import.meta.url));
    const b = await read('public/anim/mh/body.bin'), data = parseBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const dir = 'public/characters/traveller-v1/';
    const report = JSON.parse(await read(dir + 'rig.json')), colors = JSON.parse(await read(dir + 'colors.json'));
    const g = await read(dir + 'model.glb'), n = g.readUInt32LE(12), json = JSON.parse(g.toString('utf8', 20, 20 + n)), bin = g.subarray(28 + n);
    json.buffers = [{ uri: 'data:application/octet-stream;base64,' + bin.toString('base64'), byteLength: bin.length }];
    delete json.images; delete json.textures; delete json.materials;
    for (const m of json.meshes) for (const pr of m.primitives) delete pr.material;
    const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
    return { gltf, data, report, colors };
  })();
  return v1;
}

// his approved Tripo head, as the game wears it (src/characters/tripo-head.js), without its textures
let headV2 = null;
export async function tripoHead() {
  headV2 ??= (async () => {
    const g = await readFile(new URL('../public/characters/traveller-v1/head-v2/model.glb', import.meta.url)), n = g.readUInt32LE(12), json = JSON.parse(g.toString('utf8', 20, 20 + n)), bin = g.subarray(28 + n);
    json.buffers = [{ uri: 'data:application/octet-stream;base64,' + bin.toString('base64'), byteLength: bin.length }];
    delete json.images; delete json.textures; delete json.materials;
    for (const m of json.meshes) for (const pr of m.primitives) delete pr.material;
    return new GLTFLoader().parseAsync(JSON.stringify(json), '');
  })();
  return headV2;
}

// the course, the measures and the runs live in src/gait-course.js (the Motion page uses them too)
export { course, measure, timeToFace, CAM_PLUS_Z };

/**
 * A traveller on the course, standing at `at` facing +z (heading 0); o.matching: motion matching on,
 * or off (the loops, the game's default); o.moves: the starts, stops and turns over the loops
 * (src/loco-moves.js; the game's default) or not; o.body: 'v1' the game's coral-shirt traveller
 * (src/characters/traveller-v1.js), else the people's plain body; o.head: with it, his approved Tripo head
 * (public/characters/traveller-v1/head-v2, the game's) instead of the body's own.
 */
export async function traveller(scene, at = new THREE.Vector3(0, 0, 0), { matching = false, moves = false, body = 'plain', head = false } = {}) {
  const { lib, human } = await loadAssets();
  const physics = new Physics(scene);
  const p = new Player(physics, { climb: false, health: false });
  p.animator = new Animator(lib, p.char);
  p.animator.matching = matching;
  p.locoMoves = moves;
  if (body === 'v1') { p.character = createTravellerV1(p.char, { ...(await travellerV1()), ...(head ? { head: await tripoHead() } : {}) }); p.humanoid = p.character.humanoid; }
  else p.humanoid = new Humanoid(human.m, p.char, 'm');
  p.gear = { update() {}, device: { visible: true } };   // (no cloth or gear: they don't move the body)
  p._lastVel = new THREE.Vector3();
  p.pos.copy(at); p.pos.y = physics.groundAt(at.x, at.y + 5, at.z);
  p.heading = 0; p.vel.set(0, 0, 0); p.onGround = true;
  p.lastSafe.copy(p.pos);
  scene.add(p.object);
  return p;
}

/**
 * Run a script of [seconds, input] at `fps`, sampling every frame. Returns the frames and the
 * measures. input: { KeyW, KeyS, KeyA, KeyD, ShiftLeft } or { stick: { x, y } } (camera-relative).
 */
export function drive(p, script, { fps = 60, camYaw = CAM_PLUS_Z } = {}) {
  const dt = 1 / fps, frames = [];
  let t = 0, prev = null;
  for (const [secs, input, tag] of script) {
    const n = Math.round(secs * fps);
    for (let i = 0; i < n; i++) {
      p.update(dt, input, camYaw);
      p.object.updateMatrixWorld(true);
      frames.push(prev = sampleFrame(p, t, tag, prev));
      t += dt;
    }
  }
  return { frames, ...measure(frames, p.humanoid, dt) };
}
