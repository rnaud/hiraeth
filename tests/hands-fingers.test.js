// The traveller's fingers curl toward his palms. (The author, on the Motion page after the v1.6 fix of his
// wrists: "the hands look very odd, with the curve of the hands being off (fingers going in the wrong
// direction)": both hands by his thighs with the fingers bent back from the palm, the right one splayed.)
// Three things did it, all measured here on the shipped body:
//   - every traveller built after the first (the title's, then the game's; the Motion page's two) fitted
//     the one cached MakeHuman template again and rewrote the bind matrices every earlier body shares
//     with it: his skin no longer sat on his bones, the fingers bound up to 7.7 cm off theirs;
//   - the fitted rig's finger joints are bent at rest (up to 30°, toward the palm or away, not the same
//     on both hands): the hand poses, laid over them, bent some joints back and curled others double;
//   - on the pages that don't drive the hands (the title, the Motion page, the trailer) his fingers sank
//     into that rest, bent back: a "softening" pulled them 20% toward it on every frame.
// Measured: each finger joint's bend (src/hands.js fingerFlex: + toward the palm, the same sign on both
// hands) over the idle, a walk, a run, a conversation, the title's stance, the blade, the shield, the
// glove's aim; and how far the fingertips sit from the palm, relaxed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const element = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null });
globalThis.document ??= { createElement: element, body: element(), getElementById: () => null, querySelector: () => null };
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const { parseBody } = await import('../src/makehuman/body.js');
const { Player } = await import('../src/player.js');
const { Physics } = await import('../src/physics.js');
const { Animator, libraryFrom } = await import('../src/animator.js');
const { createTravellerV1 } = await import('../src/characters/traveller-v1.js');
const { course, CAM_PLUS_Z } = await import('../src/gait-course.js');
const { holdStance } = await import('../src/title-world.js');
const { fingerFlex, playerHands, FINGERS, HANDS } = await import('../src/hands.js');

const parse = (file) => { const b = readFileSync(file); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
const dir = 'public/characters/traveller-v1/';
const assets = (async () => {
  const b = readFileSync('public/anim/mh/body.bin'), data = parseBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const report = JSON.parse(readFileSync(dir + 'rig.json')), colors = JSON.parse(readFileSync(dir + 'colors.json'));
  // (the shipped GLB without its textures: Node has no image decoder)
  const g = readFileSync(dir + 'model.glb'), n = g.readUInt32LE(12), json = JSON.parse(g.toString('utf8', 20, 20 + n)), bin = g.subarray(28 + n);
  json.buffers = [{ uri: 'data:application/octet-stream;base64,' + bin.toString('base64'), byteLength: bin.length }];
  delete json.images; delete json.textures; delete json.materials;
  for (const m of json.meshes) for (const p of m.primitives) delete p.material;
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  return { gltf, data, report, colors, lib: libraryFrom(await parse('public/anim/ual.glb')) };
})();

async function traveller() {
  const { gltf, data, report, colors, lib } = await assets;
  const scene = course(), physics = new Physics(scene);
  const p = new Player(physics, { climb: false, health: false });
  p.animator = new Animator(lib, p.char);
  p.character = createTravellerV1(p.char, { gltf, data, report, colors });
  p.humanoid = p.character.humanoid;
  p.gear = { update() {}, device: { visible: true } };
  p._lastVel = new T.Vector3();
  p.pos.set(0, physics.groundAt(0, 5, 0), 0); p.heading = 0; p.vel.set(0, 0, 0); p.onGround = true; p.lastSafe.copy(p.pos);
  scene.add(p.object);
  return p;
}

/** How far each bone's bind (the skin's matrices) is from its rest (the pose's), at worst (m). */
function bindOff(p) {
  const H = p.humanoid, sk = p.character.mesh.skeleton;
  let worst = 0;
  sk.bones.forEach((b, i) => {
    if (!H.rest.has(b)) return;
    worst = Math.max(worst, new T.Vector3().setFromMatrixPosition(sk.boneInverses[i].clone().invert()).distanceTo(H.rest.get(b).p));
  });
  return worst;
}

test('a second traveller leaves the first one\'s skin on its bones (the title\'s, then the game\'s)', { timeout: 120000 }, async () => {
  const a = await traveller();
  assert.ok(bindOff(a) < 1e-4, `the first alone: ${bindOff(a)}`);
  const b = await traveller(), c = await traveller();
  for (const [name, p] of [['the first', a], ['the second', b], ['the third', c]]) assert.ok(bindOff(p) < 1e-4, `${name}, after three were built: its skin ${(bindOff(p) * 100).toFixed(2)} cm off its bones`);
  const at = (p) => p.humanoid.rest.get(p.humanoid.b.index_03_r).p;
  assert.ok(at(a).distanceTo(c.humanoid.rest.get(c.humanoid.b.index_03_r).p) < 1e-6, 'each fitted the same: the template was not fitted twice');
});

const flat = (f) => FINGERS.flatMap((k) => f[k]);
const say = (f) => FINGERS.map((k) => `${k} ${f[k].map((x) => x.toFixed(0)).join('/')}`).join(', ');

test('his hand poses are each joint\'s bend from a straight finger, the same on both hands', { timeout: 120000 }, async () => {
  const p = await traveller(), H = p.humanoid;
  H.update(true);
  H.hands.set(new Float32Array(16));
  for (const s of ['l', 'r']) for (const a of flat(fingerFlex(H, s))) assert.ok(Math.abs(a) < 1, `${s}: straight at zero, ${say(fingerFlex(H, s))}`);
  for (const pose of ['relaxed', 'open', 'grip', 'fist', 'hold', 'hook', 'cup', 'limp', 'talk']) {
    H.hands.set(pose);
    const l = fingerFlex(H, 'l'), r = fingerFlex(H, 'r');
    flat(l).forEach((a, i) => assert.ok(Math.abs(a - flat(r)[i]) < 1.5, `${pose}: left (${say(l)}) and right (${say(r)}) alike`));
    for (const a of [...flat(l), ...flat(r)]) assert.ok(a > -1, `${pose}: no joint bent back (${say(l)} / ${say(r)})`);
  }
});

test('the measure sees the old fault: his rig\'s rest, with the poses laid over it as they were, bends fingers back', { timeout: 120000 }, async () => {
  const p = await traveller(), H = p.humanoid;
  for (const S of H.hands.sides) for (const J of S.joints) J.zero = 0;
  H.update(true);
  H.hands.set('open');
  const worst = Math.min(...flat(fingerFlex(H, 'l')), ...flat(fingerFlex(H, 'r')));
  assert.ok(worst < -10, `the old open hand: ${say(fingerFlex(H, 'l'))} / ${say(fingerFlex(H, 'r'))}`);
});

// Every joint's bend over each context, at the worst: relaxed ones never bent back; any (a startled
// splay flings the index 6° back) no more than a few degrees; none curled past a fist.
const RANGE = { min: -8, max: 125, relaxedMin: -2, relaxedCurl: 30 };
const CONTEXTS = [
  ['standing (the idle and its gestures)', 6 * 60, () => ({}), {}, true],
  ['walking', 3 * 60, () => ({ y: 1 }), {}, true],
  ['running', 3 * 60, () => ({ y: 1, run: true }), {}, false],
  ['in a conversation, talking in every tone', 6 * 60, () => ({}), { setup: (p) => { p.talking = true; }, hands: (i) => ({ talk: { tone: ['neutral', 'happy', 'sad', 'angry', 'scared', 'surprised', 'curious', 'whisper'][Math.floor(i / 45) % 8], k: 1, beat: 0.5 + 0.5 * Math.sin(i * 0.4) } }) }, false],
  ['the title stance', 3 * 60, () => ({}), { setup: (p) => { p.talking = true; p.character.poseArms = (q) => { holdStance(q.char, q.time); return []; }; } }, true],
  ['the blade drawn, the shield open', 2 * 60, () => ({}), { hands: () => ({ sword: 1, shield: 1 }) }, false],
  ['aiming the glove', 2 * 60, () => ({}), { hands: () => ({ aim: 1 }) }, false],
];

for (const [name, frames, drive, { setup, hands } = {}, relaxed] of CONTEXTS) {
  test(`his fingers curl toward his palms, never back: ${name}`, { timeout: 300000 }, async () => {
    const p = await traveller(), H = p.humanoid, dt = 1 / 60;
    setup?.(p);
    const lo = { l: Infinity, r: Infinity }, hi = { l: -Infinity, r: -Infinity }, curl = { l: Infinity, r: Infinity };
    let apart = 0;
    for (let i = 0; i < frames; i++) {
      p.update(dt, drive(i * dt), CAM_PLUS_Z); p.object.updateMatrixWorld(true);
      H.hands.update(dt, { ...playerHands(p), ...(hands?.(i) ?? {}) });   // (as main.js: updateHands)
      p.character.updateHands();
      if (i % 5) continue;
      const F = {};
      for (const s of ['l', 'r']) {
        const f = (F[s] = fingerFlex(H, s)), a = flat(f);
        lo[s] = Math.min(lo[s], ...a); hi[s] = Math.max(hi[s], ...a);
        for (const k of FINGERS) curl[s] = Math.min(curl[s], f[k].reduce((x, y) => x + y, 0));
      }
      flat(F.l).forEach((a, j) => { apart = Math.max(apart, Math.abs(a - flat(F.r)[j])); });
    }
    if (process.env.SAY) console.log(name, 'bend', lo.l.toFixed(1), '..', hi.l.toFixed(1), '/', lo.r.toFixed(1), '..', hi.r.toFixed(1), 'least curl', curl.l.toFixed(0), curl.r.toFixed(0), 'left vs right', apart.toFixed(1));
    for (const s of ['l', 'r']) {
      const side = s === 'l' ? 'left' : 'right';
      assert.ok(lo[s] > (relaxed ? RANGE.relaxedMin : RANGE.min), `${side} hand, ${name}: a joint bent back ${lo[s].toFixed(1)}°`);
      assert.ok(hi[s] < RANGE.max, `${side} hand, ${name}: a joint bent ${hi[s].toFixed(1)}°`);
      if (relaxed) assert.ok(curl[s] > RANGE.relaxedCurl, `${side} hand, ${name}: a finger curled only ${curl[s].toFixed(0)}° in all`);
    }
    // the two hands alike when doing the same (each drifts a little, and lags its own wrist)
    if (relaxed) assert.ok(apart < 14, `${name}: left and right differ by ${apart.toFixed(1)}° at a joint`);
  });
}

test('relaxed, his fingertips come in toward the palm: nearer it than a straight finger\'s, on its side, short of a fist', { timeout: 120000 }, async () => {
  const p = await traveller(), H = p.humanoid, mesh = p.character.mesh, g = mesh.geometry;
  const pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = mesh.skeleton.bones;
  const at = (i) => mesh.applyBoneTransform(i, new T.Vector3().fromBufferAttribute(pos, i)).applyMatrix4(mesh.matrixWorld);
  // each finger's tip: the vertices on its last bone, the 8 furthest from its knuckle in the bind pose
  H.update(true); H.hands.set(new Float32Array(16)); p.object.updateMatrixWorld(true);
  const tips = {};
  for (const S of H.hands.sides) for (const f of FINGERS) {
    const b = H.b[`${f}_03_${S.s}`], bi = bones.indexOf(b), knuckle = H.b[`${f}_01_${S.s}`].getWorldPosition(new T.Vector3());
    const own = [];
    for (let i = 0; i < pos.count; i++) for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === bi && sw.getComponent(i, k) > 0.6) own.push(i);
    tips[`${f}_${S.s}`] = own.map((i) => [i, at(i).distanceTo(knuckle)]).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([i]) => i);
    assert.ok(tips[`${f}_${S.s}`].length === 8, `${f} (${S.s}): its tip's vertices`);
  }
  /** Each fingertip's distance to the palm's middle (m), and how far it is out on the palm's side. */
  const palm = () => {
    p.object.updateMatrixWorld(true);
    const out = {};
    for (const S of H.hands.sides) {
      const turn = S.hand.getWorldQuaternion(new T.Quaternion()).multiply(S.restHandQ.clone().invert());
      const n = S.normal.clone().applyQuaternion(turn);
      const middle = [S.hand, ...FINGERS.map((f) => H.b[`${f}_01_${S.s}`])].reduce((c, b) => c.add(b.getWorldPosition(new T.Vector3())), new T.Vector3()).divideScalar(5);
      for (const f of FINGERS) {
        const tip = tips[`${f}_${S.s}`].reduce((c, i) => c.add(at(i)), new T.Vector3()).divideScalar(8);
        out[`${f}_${S.s}`] = { d: tip.distanceTo(middle), side: tip.clone().sub(middle).dot(n) };
      }
    }
    return out;
  };
  const straight = palm();
  H.hands.set('relaxed'); p.character.updateHands();
  const relaxed = palm();
  H.hands.set('fist'); p.character.updateHands();
  const fist = palm();
  for (const s of ['l', 'r']) {
    let nearer = 0;
    for (const f of FINGERS) {
      const k = `${f}_${s}`, [r, s0, fi] = [relaxed[k], straight[k], fist[k]];
      if (process.env.SAY) console.log(k, `straight ${(s0.d * 100).toFixed(1)} (${(s0.side * 100).toFixed(1)} out on the palm's side), relaxed ${(r.d * 100).toFixed(1)} (${(r.side * 100).toFixed(1)}), fist ${(fi.d * 100).toFixed(1)} cm`);
      assert.ok(r.d <= s0.d + 0.002, `${k}: relaxed, the tip ${(r.d * 100).toFixed(1)} cm from the palm's middle, further than straight (${(s0.d * 100).toFixed(1)})`);
      assert.ok(r.d > fi.d + 0.008, `${k}: relaxed (${(r.d * 100).toFixed(1)} cm) is no fist (${(fi.d * 100).toFixed(1)})`);
      assert.ok(r.side > s0.side + 0.02 && r.side < 0.07, `${k}: the tip ${(r.side * 100).toFixed(1)} cm out on the palm's side, straight ${(s0.side * 100).toFixed(1)}`);
      nearer += s0.d - r.d;
    }
    // (round its knuckle, a curling finger's tip keeps much of its distance to the palm's middle; the index
    // curls least: the arc tightens toward the little finger)
    assert.ok(nearer / 4 > 0.003, `${s}: the fingertips ${(nearer / 4 * 100).toFixed(1)} cm nearer the palm's middle on average`);
  }
  // (the setting the rig's straightening keys on, for the record)
  assert.ok(HANDS.straighten > 0 && HANDS.straighten < 0.2);
});
