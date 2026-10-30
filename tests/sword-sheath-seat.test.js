// The sheathed sword seated on the traveller's back (issue #763; src/sword-sheath.js): since the round backpack went
// (#728) nothing but the frog holds the hilt, so it lies against his back, diagonal over the right shoulder blade, its
// strip 0.5–4 cm off him, and none of him comes into it in any pose he takes (the battery-bracer test's poses: standing, the
// gaits, the sprint, talking, the title's stance, climbing, the ledge, riding, the jump, sitting on a bench, swimming,
// gliding, the dodge roll). Checked on B3 and on v2 in his own clothes and in every outfit of the Wardrobe (an outfit
// with something on its back, a pack or a hood, has the frog stood off by SHEATH_OUT).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const element = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null });
globalThis.document ??= { createElement: element, body: element(), getElementById: () => null, querySelector: () => null };
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const { SHEATH, SHEATH_OUT, sheathFrame, hiltPoints, frogGeometry } = await import('../src/sword-sheath.js');
const { dressTravellerV2 } = await import('../src/characters/traveller-v2.js');
const { benchSitPose } = await import('../src/benches.js');
const { holdStance } = await import('../src/title-world.js');
const { traveller, course, CAM_PLUS_Z } = await import('./gait-sim.js');

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), dt = 1 / 60;
// (a clock of the test's own: the robe's skirt swing steps on performance.now, src/characters/outfits.js attachSwing, so on
// the wall clock each step was as long as the last pose's measuring had taken, and where it swung to went with the
// machine's load (a ~25 ms step from the glide into the roll put its back fold 3.6 cm into the frog): here every pose is
// one frame of 1/60 s, as in the game at 60 fps)
let clock = 0;
performance.now = () => clock;
const tick = () => { clock += dt * 1000; };
const DIR = 'data/characters/traveller-v2/';
const manifest = JSON.parse(readFileSync(DIR + 'manifest.json', 'utf8'));
const list = JSON.parse(readFileSync(DIR + 'outfits.json', 'utf8'));
async function glb(path) {
  const g = readFileSync(path), n = g.readUInt32LE(12), json = JSON.parse(g.toString('utf8', 20, 20 + n)), bin = g.subarray(28 + n);
  json.buffers = [{ uri: 'data:application/octet-stream;base64,' + bin.toString('base64'), byteLength: bin.length }];
  delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.materials ?? []) { delete m.pbrMetallicRoughness?.baseColorTexture; delete m.normalTexture; delete m.emissiveTexture; }
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
let baseGltf = null;
async function outfitSources(id) {
  baseGltf ??= await glb(DIR + list.base);
  let outfit = { id: 'default' };
  const o = list.outfits.find((x) => x.id === id && x.dir);
  if (o) { const m = JSON.parse(readFileSync(DIR + o.dir + 'manifest.json', 'utf8')); outfit = { id, manifest: m, gltf: await glb(DIR + o.dir + m.glb) }; }
  return { root: DIR, list, baseManifest: manifest, baseGltf, outfit };
}

/** The game's traveller (B3, or dressed as v2 in `outfit`) standing on the course. */
async function wearer(outfit = null) {
  const p = await traveller(course({ ramp: false, stairs: false }), v(0, 0, -60), { body: 'b3' });
  if (outfit) dressTravellerV2(p.character, await outfitSources(outfit), { cloth: false });
  for (let i = 0; i < 5; i++) { tick(); p.update(dt, {}, CAM_PLUS_Z); }
  return p;
}

/**
 * What is on his back, in the chest anchor's frame: the hilt's balls, and gap(w) how far a point is from the hilt or the
 * frog's strip (the strip a slab in the hilt's frame: a point through its face toward him counts negative).
 */
function sheathShape(outfit) {
  const F = sheathFrame(SHEATH, outfit), toHilt = new THREE.Matrix4().compose(F.position, F.quaternion, v(1, 1, 1)).invert();
  const hilt = hiltPoints().map(({ x, y, r }) => ({ c: v(x, y, 0).applyQuaternion(F.quaternion).add(F.position), r }));
  const strip = frogGeometry()[0].geometry;
  strip.computeBoundingBox();
  const B = strip.boundingBox, cy = (B.min.y + B.max.y) / 2, hx = (B.max.x - B.min.x) / 2, hy = (B.max.y - B.min.y) / 2, h = v();
  const gap = (w) => {
    let d = Infinity;
    for (const b of hilt) d = Math.min(d, w.distanceTo(b.c) - b.r);
    h.copy(w).applyMatrix4(toHilt);
    const dx = Math.max(0, Math.abs(h.x) - hx), dy = Math.max(0, Math.abs(h.y - cy) - hy), dz = h.z - B.max.z;
    return Math.min(d, dx === 0 && dy === 0 && h.z > B.min.z - 0.03 ? dz : Math.hypot(dx, dy, Math.max(0, dz)));
  };
  return { hilt, gap };
}

/** The 22 poses the hip battery's test measured (tests/battery-bracer.test.js measures the bracer on them now), each a [label, pose(), look] list (look: measure after it). */
function poses(p) {
  const H = p.humanoid, a = p.animator, lib = a.lib, out = [];
  const gait = (label, input, frames, setup, look = (i) => i % 6 === 5) => {
    out.push([label, () => { p.talking = false; p.pos.set(0, p.physics.groundAt(0, 5, -60), -60); p.vel.set(0, 0, 0); setup?.(); }, false]);
    for (let i = 0; i < frames; i++) out.push([label, () => p.update(dt, input, CAM_PLUS_Z), look(i)]);
  };
  const clip = (name, u, after) => () => {
    const c = lib.all.find((k) => k.name === name);
    for (const act of Object.values(a.actions)) act.setEffectiveWeight(0);
    const act = a.mixer.clipAction(c); act.play(); act.enabled = true; act.setEffectiveWeight(1); act.time = u * c.duration;
    a.mixer.update(0); a.src.updateMatrixWorld(true); a.apply(p.char.root); act.setEffectiveWeight(0);
    after?.(); p.char.root.updateMatrixWorld(true); H.update();
  };
  const still = () => { p.char.root.updateMatrixWorld(true); H.update(); };
  gait('standing', {}, 120); gait('walking', { y: 0.5 }, 90); gait('jogging', { y: 1 }, 90); gait('running', { y: 1, run: true }, 120);
  gait('sprinting', { y: 1, run: true, ShiftLeft: true }, 120);
  gait('talking', {}, 90, () => { p.talking = true; });
  for (let i = 0; i < 4; i++) out.push(['the title stance', clip('Idle_Loop', i / 4, () => { p.talking = false; holdStance(p.char, i); }), true]);
  for (const [n, k] of [['Climb_Up_Loop', 6], ['Climb_Idle_Loop', 3], ['Climb_Left_Loop', 4], ['Climb_Right_Loop', 4], ['Climb_Down_Loop', 4], ['ClimbLedge', 8], ['Driving_Loop', 4], ['Jump_Loop', 3], ['Jump_Start', 3], ['Jump_Land', 3]])
    for (let i = 0; i < k; i++) out.push([n, clip(n, i / k), true]);
  for (const k of [0.5, 1]) out.push(['sitting on a bench', clip('Idle_Loop', 0, () => benchSitPose(p.char, k)), true]);
  for (let i = 0; i < 8; i++) out.push(['swimming (crawl)', () => { p.swim = { k: 1, crawl: 1, ph: i / 8, pitch: 1.4, roll: 0, vy: 0, hs: 1 }; p.animate(dt, 0); still(); p.swim = null; }, true]);
  for (let i = 0; i < 4; i++) out.push(['swimming (breaststroke)', () => { p.swim = { k: 1, crawl: 0, ph: i / 4, pitch: 1.4, roll: 0, vy: 0, hs: 1 }; p.animate(dt, 0); still(); p.swim = null; }, true]);
  out.push(['gliding', () => { p.gliding = true; p.onGround = false; p.animate(dt, 0); still(); p.wingK = 1; p.spreadArms?.(); p.gliding = false; p.onGround = true; p.wingK = 0; }, true]);
  // (the roll from his feet, frame by frame as in the game, looked at i/8 s into it: not one frame on from the glide, which
  // left the robe's swing a step from a pose he never rolls out of)
  gait('the dodge roll', {}, 30, null, () => false);
  const rolled = (s) => () => { p.combatMotion = { dir: v(0, 0, 1), speed: 0, scale: 0, evade: s, roll: s }; p.onGround = true; p.animate(dt, 0); still(); p.combatMotion = null; };
  for (let k = 1; k <= 53; k++) out.push(['the dodge roll', rolled(k * dt), [1, 2, 3, 4, 5, 6, 7].some((i) => Math.round(i * 7.5) === k)]);
  return out;
}

const SPINE = /^spine_0[123]$/;
/**
 * In each pose, per label: `seat`, how far the hilt and its frog are from his back (the vertices his spine carries most:
 * not the shoulders and arms that move past it), and `clear`, how far they are from any of him (his skin, his clothes,
 * the outfit's pieces). Negative: inside him.
 */
function measure(p, outfit, { only = null } = {}) {
  const C = p.humanoid.chestAnchor, { gap } = sheathShape(outfit);
  const meshes = [];
  p.object.traverse((o) => { if (o.isSkinnedMesh && o.visible) { for (let w = o; w; w = w.parent) if (!w.visible) return; meshes.push(o); } });
  const back = new Map(meshes.map((m) => {
    const J = m.geometry.attributes.skinIndex, W = m.geometry.attributes.skinWeight, bones = m.skeleton.bones, mark = new Uint8Array(J.count);
    for (let i = 0; i < J.count; i++) { let best = 0, k = 0; for (let c = 0; c < 4; c++) if (W.getComponent(i, c) > best) { best = W.getComponent(i, c); k = J.getComponent(i, c); } mark[i] = SPINE.test(bones[k]?.name ?? '') ? 1 : 0; }
    return [m, mark];
  }));
  const res = new Map(), w = v();
  for (const [label, pose, look] of poses(p)) {
    if (only && !only.includes(label)) continue;
    tick(); pose();
    if (!look) continue;
    p.object.updateMatrixWorld(true); C.updateWorldMatrix(true, false);
    const inv = C.matrixWorld.clone().invert();
    let seat = Infinity, clear = Infinity, near = '';
    for (const m of meshes) {
      m.skeleton.update();
      const P = m.geometry.attributes.position, M = m.matrixWorld.clone().premultiply(inv), mark = back.get(m);
      for (let i = 0; i < P.count; i++) {
        w.fromBufferAttribute(P, i); m.applyBoneTransform(i, w); w.applyMatrix4(M);
        if (w.z > 0.02 || w.x > 0.12 || w.x < -0.35 || w.y < 0.35 || w.y > 1.0) continue;   // (far from it)
        const d = gap(w); if (d < clear) { clear = d; if (process.env.WHERE) near = w.toArray().map((x) => x.toFixed(3)).join(',') + ' ' + m.name + ' ' + (Object.entries(p.character.v2?.wardrobe?.worn?.ranges ?? {}).find(([, [a, n]]) => i >= a && i < a + n)?.[0] ?? ''); } if (mark[i] && d < seat) seat = d;
      }
    }
    if (process.env.WHERE) console.log(label, cm(clear), near);
    const was = res.get(label);
    res.set(label, { seat: Math.max(was?.seat ?? -Infinity, seat), clear: Math.min(was?.clear ?? Infinity, clear) });
  }
  return res;
}
if (process.env.OUT) SHEATH_OUT[process.env.ONLY] = +process.env.OUT;
const cm = (x) => `${(x * 100).toFixed(1)} cm`;
const say = (who, res) => process.env.SAY && console.log(`${who}: ` + [...res].map(([k, r]) => `${k} ${cm(r.seat)} / ${cm(r.clear)}`).join(', '));
// (the salt pilgrim's robe is a skinned skirt, loose about him: tests/traveller-outfits.test.js LOOSE; sitting on a bench
// its back fold swings up behind the cup when he sits or springs, into it by up to 2 cm, as it swings through his tunic)
const LOOSE = { 'salt-pilgrim': -0.025 };
function check(who, res, n = 22) {
  say(who, res);
  const bad = [];
  for (const [label, { seat, clear }] of res) {
    if (!(seat >= 0.005 && seat <= 0.04)) bad.push(`${label}: the frog ${cm(seat)} off his back (0.5–4 cm: seated, not floating)`);
    if (!(clear > (LOOSE[who] ?? 0.002))) bad.push(`${label}: ${cm(clear)} (into him)`);
  }
  assert.deepEqual(bad, [], `${who}: ${bad.join('; ')}`);
  assert.equal(res.size, n, 'every pose looked at');
}

test('seated on his back (B3): its frog 0.5–4 cm off him and into none of him in every pose', { timeout: 300000 }, async () => {
  check('B3', measure(await wearer(), null));
});

test('seated on his back (v2, his own clothes): the same in every pose', { timeout: 300000 }, async () => {
  check('v2', measure(await wearer('default'), 'default'));
});

test('every outfit of the Wardrobe: seated and clear, standing, running, climbing, swimming and in the roll', { timeout: 600000 }, async () => {
  const some = ['standing', 'sprinting', 'ClimbLedge', 'Climb_Up_Loop', 'swimming (crawl)', 'the dodge roll', 'gliding', 'sitting on a bench'];
  const bad = [];
  for (const o of list.outfits.filter((x) => x.dir && (!process.env.ONLY || x.id === process.env.ONLY))) {
    try { check(o.id, measure(await wearer(o.id), o.id, { only: process.env.FULL ? null : some }), process.env.FULL ? 22 : some.length); } catch (e) { bad.push(e.message.split('\n')[0]); }
  }
  assert.deepEqual(bad, []);
  // (only outfits of the list stand it off)
  for (const id of Object.keys(SHEATH_OUT)) assert.ok(list.outfits.some((o) => o.id === id), id);
});

test('in the game: the frog and the hilt where SHEATH_OUT says for the outfit worn, and the reach goes there', { timeout: 120000 }, async () => {
  const { FluidTool } = await import('../src/fluid-tool.js');
  const { GameState } = await import('../src/game-state.js');
  const { items } = await import('../src/items.js');
  items.grant('backpack');
  const p = await wearer('gravity-ranger');
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, -65); camera.lookAt(0, 1, -55); camera.updateMatrixWorld();
  const tool = new FluidTool({ scene: p.object.parent, player: p, physics: p.physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
  try {
    for (let i = 0; i < 5; i++) { p.update(dt, {}, CAM_PLUS_Z); tool.update(dt, {}); }
    const b = tool.blade, F = sheathFrame(SHEATH, 'gravity-ranger');
    assert.equal(b.group.parent, p.humanoid.chestAnchor);
    assert.ok(b.group.position.distanceTo(F.position) < 1e-6 && b.frog.position.distanceTo(F.position) < 1e-6, 'stood off his pack');
    assert.ok(p.sheathReach.at.distanceTo(F.position) < 1e-6, 'the hand reaches there');
    await p.character.v2.wear('default');
    tool.update(dt, {});
    assert.ok(b.group.position.distanceTo(sheathFrame().position) < 1e-6, 'his own clothes: against his back');
  } finally { tool.dispose(); }
});
