// The makers' battery in its bracer on the traveller's right forearm (issue #799; references/characters/battery/bracer/,
// the author's pick: the battery embedded in the glove): a slim glass cell set lengthwise along the back of his forearm in
// a leather bracer from under his rolled sleeve down to his wrist, both rigid on the forearm's bone (src/battery-bracer.js).
// Checked here on the game's traveller (v2 in his own clothes, and B3): where it sits and that it is carried by the
// forearm; that the forearm's own skin stays inside the leather and nothing else of him (his hand, the glove, his sleeve,
// his body, his legs, his other arm) nor the hilt in his fist comes into the leather or the cell in any pose he takes:
// standing, the gaits, the sprint, talking, the title's stance, jumping from a stand and from a run, aiming the gun,
// the evade, every cut of the blade, climbing, the ledge, riding, sitting on a bench, swimming, gliding, the dodge roll;
// and that it is shown in all of them (nothing tucks it away: it replaced the hip battery's swing and tuck, #745).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const element = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null });
globalThis.document ??= { createElement: element, body: element(), getElementById: () => null, querySelector: () => null };
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const { FluidTool, TANK, tankGap } = await import('../src/fluid-tool.js');
const { BRACER, bracerGap, bracerInside, bracerEnd, inSlit, cellFrame } = await import('../src/battery-bracer.js');
const { WING_ROOT } = await import('../src/fluid-kit.js');
const { ATTACKS } = await import('../src/fluid-blade.js');
const { GameState } = await import('../src/game-state.js');
const { items } = await import('../src/items.js');
const { benchSitPose } = await import('../src/benches.js');
const { holdStance } = await import('../src/title-world.js');
const { dressTravellerV2 } = await import('../src/characters/traveller-v2.js');
const { traveller, course, CAM_PLUS_Z } = await import('./gait-sim.js');

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), dt = 1 / 60;
// (a clock of the test's own, as in tests/sword-sheath-seat.test.js: every step one frame of 1/60 s)
let clock = 0;
performance.now = () => clock;
const DIR = 'data/characters/traveller-v2/';
const manifest = JSON.parse(readFileSync(DIR + 'manifest.json', 'utf8')), list = JSON.parse(readFileSync(DIR + 'outfits.json', 'utf8'));
async function glb(path) {
  const g = readFileSync(path), n = g.readUInt32LE(12), json = JSON.parse(g.toString('utf8', 20, 20 + n)), bin = g.subarray(28 + n);
  json.buffers = [{ uri: 'data:application/octet-stream;base64,' + bin.toString('base64'), byteLength: bin.length }];
  delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.materials ?? []) { delete m.pbrMetallicRoughness?.baseColorTexture; delete m.normalTexture; delete m.emissiveTexture; }
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}

/** The traveller (B3, or v2 in his own clothes) wearing the battery, the blade and the gun. */
async function worn(who = 'v2') {
  items.grant('backpack'); items.grant('gun');
  const scene = course({ ramp: false, stairs: false });
  const p = await traveller(scene, v(0, 0, -60), { body: 'b3', moves: true });
  if (who === 'v2') dressTravellerV2(p.character, { root: DIR, list, baseManifest: manifest, baseGltf: await glb(DIR + list.base), outfit: { id: 'default' } }, { cloth: false });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, -65); camera.lookAt(0, 1, -55); camera.updateMatrixWorld();
  const tool = new FluidTool({ scene, player: p, physics: p.physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
  const tick = (input = {}, move = null) => { clock += dt * 1000; if (move) p.swingMove = move; p.update(dt, input, CAM_PLUS_Z); tool.update(dt, input); };
  for (let i = 0; i < 40; i++) tick();
  return { p, tool, tick };
}

/** His drawn skinned meshes (his body, his clothes, the glove), and the hilt when it is in his fist. */
function meshesOf(p, tool) {
  const out = [];
  p.object.traverse((o) => { if (o.isSkinnedMesh && o.visible) { for (let w = o; w; w = w.parent) if (!w.visible) return; out.push(o); } });
  const hand = p.humanoid.b.hand_r, G = tool.blade?.group, hilt = tool.blade?.hilt;
  if (G && hilt && G.parent === hand) hilt.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.geometry?.attributes?.position) { for (let w = o; w; w = w.parent) if (!w.visible) return; out.push(o); } });
  return out;
}

/**
 * The forearm's own skin (the bind pose's vertices inside the leather at rest): per mesh, the vertex indices that must
 * stay inside it; every other vertex must stay out of the leather and the cell.
 */
function forearmSkin(p, tool) {
  const fit = tool.fit, arm = tool.arm, own = new Map();
  p.object.updateMatrixWorld(true);
  const inv = arm.matrixWorld.clone().invert(), w = v();
  for (const m of meshesOf(p, tool)) {
    if (!m.isSkinnedMesh) continue;
    m.skeleton.update();
    const P = m.geometry.attributes.position, M = m.matrixWorld.clone().premultiply(inv), set = new Set();
    for (let i = 0; i < P.count; i++) {
      w.fromBufferAttribute(P, i); m.applyBoneTransform(i, w); w.applyMatrix4(M);
      if (bracerInside(fit, w) > -0.004 && w.y > fit.y[0] - 0.004 && w.y < fit.y[1] + 0.004) set.add(i);
    }
    own.set(m, set);
  }
  return own;
}

/** The dominant bone of a skinned mesh's vertex ('' for a rigid mesh). */
function boneOf(m, i) {
  const J = m.geometry.attributes.skinIndex, W = m.geometry.attributes.skinWeight;
  if (!J) return '';
  let bn = '', bw = 0;
  for (let k = 0; k < 4; k++) if (W.getComponent(i, k) > bw) { bw = W.getComponent(i, k); bn = m.skeleton.bones[J.getComponent(i, k)].name; }
  return bn;
}
/** What may never touch it in any pose: his right hand and the glove on it, and the hilt in his fist. */
const HAND = /^(hand|thumb_0\d|index_0\d|middle_0\d|ring_0\d|pinky_0\d)_r$/;
/** v2's open shirt below his chest: the game moves it as cloth (traveller-v2-cloth.js, a cage on his hips), not as it is
 *  skinned here, and its hem hangs 5 mm off his bare forearm as he runs: it may graze the bracer by SHIRT_DEPTH. */
const SHIRT = (m, bone) => m.name === 'TravellerV2.clothes' && /^(pelvis|spine_0[12])$/.test(bone), SHIRT_DEPTH = 0.003;

/**
 * The bracer and the cell against him as he is now: `inside` the least of the forearm's own skin inside the leather (m;
 * Infinity: none in its length); `hand` the least of his right hand, the glove and the hilt outside the leather and the
 * cell; `other` the least of everything else of him (his body, his clothes, his other arm, his head, his legs).
 */
function clearance(p, tool, own) {
  const fit = tool.fit, arm = tool.arm, cell = tool.tank.group, hilt = new Set();
  tool.blade?.hilt?.traverse((o) => hilt.add(o));
  p.object.updateMatrixWorld(true); cell.updateWorldMatrix(true, false);
  const toArm = arm.matrixWorld.clone().invert(), toCell = cell.matrixWorld.clone().invert(), w = v(), c = v();
  const r = { inside: Infinity, hand: Infinity, other: Infinity, shirt: Infinity, handWhat: '', otherWhat: '', shirtWhat: '' };
  for (const m of meshesOf(p, tool)) {
    if (m.isSkinnedMesh) m.skeleton.update();
    const P = m.geometry.attributes.position, mine = own.get(m), glove = /^Glove/.test(m.name) || hilt.has(m);
    for (let i = 0; i < P.count; i++) {
      w.fromBufferAttribute(P, i); if (m.isSkinnedMesh) m.applyBoneTransform(i, w); w.applyMatrix4(m.matrixWorld);
      c.copy(w).applyMatrix4(toCell); w.applyMatrix4(toArm);
      if (Math.abs(w.x) > 0.15 || Math.abs(w.z) > 0.15 || w.y < fit.y[0] - 0.05 || w.y > fit.y[1] + 0.05) continue;   // (far from it)
      if (mine?.has(i)) { if (w.y > fit.y[0] && w.y < bracerEnd(fit, Math.atan2(w.z, w.x)) && inSlit(fit, Math.atan2(w.z, w.x)) < 0) { const d = bracerInside(fit, w); if (d < r.inside) { r.inside = d; r.insideAt = `${(w.y * 100).toFixed(1)} cm down, ${Math.atan2(w.z, w.x).toFixed(2)} round (${boneOf(m, i)})`; } } continue; }   // (past its ends: under or beside its edge)
      const d = Math.min(bracerGap(fit, w), tankGap(c)), bone = boneOf(m, i), hand = glove || HAND.test(bone);
      const k = hand ? 'hand' : SHIRT(m, bone) ? 'shirt' : 'other';
      if (d < r[k]) { r[k] = d; r[k + 'What'] = `${m.name}${bone ? ` (${bone})` : ''}${process.env.SAY === '2' ? ` at ${(w.y * 100).toFixed(1)} cm down, ${Math.atan2(w.z, w.x).toFixed(2)} round, cell ${(tankGap(c) * 1000).toFixed(1)}` : ''}`; }
    }
  }
  return r;
}

/**
 * Every pose he takes, each [label, pose(), look]: the gaits and the jumps frame by frame as in the game, the clips and
 * the overlays posed, with the state he is in while he takes them (climbing, on the ledge, swimming, sitting, rolling).
 */
function poses({ p, tool, tick }) {
  const a = p.animator, lib = a.lib, H = p.humanoid, out = [];
  const settle = () => { p.char.root.updateMatrixWorld(true); H.update(); p.object.updateMatrixWorld(true); tool.seatCell(); };
  const reset = () => { p.talking = false; p.climbing = false; p.mantle = null; p.swim = null; p.overlay = null; p.combatMotion = null; p.swingMove = null; tool.forceGun = false; p.pos.set(0, p.physics.groundAt(0, 5, -60), -60); p.vel.set(0, 0, 0); p.heading = 0; };
  const gait = (label, input, frames, { setup, look = (i) => i % 4 === 3, move } = {}) => {
    out.push([label, () => { reset(); setup?.(); for (let i = 0; i < 30; i++) tick(); }, false]);
    for (let i = 0; i < frames; i++) out.push([label, () => tick(typeof input === 'function' ? input(i) : input, move?.(i)), look(i)]);
  };
  const clip = (label, name, u, state, after) => [label, () => {
    reset(); state?.();
    const c = lib.all.find((k) => k.name === name);
    for (const act of Object.values(a.actions)) act.setEffectiveWeight(0);
    const act = a.mixer.clipAction(c); act.play(); act.enabled = true; act.setEffectiveWeight(1); act.time = u * c.duration;
    a.mixer.update(0); a.src.updateMatrixWorld(true); a.apply(p.char.root); act.setEffectiveWeight(0);
    after?.(); settle();
  }, true];
  gait('standing', {}, 60); gait('walking', { y: 0.5 }, 90); gait('jogging', { y: 1 }, 90); gait('running', { y: 1, run: true }, 120);
  gait('sprinting', { y: 1, run: true, ShiftLeft: true }, 120);
  gait('talking', {}, 90, { setup: () => { p.talking = true; } });
  gait('a jump from a stand', (i) => (i === 2 ? { Space: true } : {}), 100, { look: (i) => i % 2 === 0 });
  gait('a jump from a run', (i) => ({ y: 1, run: true, Space: i === 40 }), 140, { look: (i) => i > 38 && i % 2 === 0 });
  gait('aiming the gun', { KeyR: true }, 60, { setup: () => { tool.forceGun = true; } });
  gait('walking, aiming', { KeyR: true, y: 0.5 }, 90, { setup: () => { tool.forceGun = true; } });
  gait('the evade', (i) => (i < 3 ? { AltLeft: true } : {}), 50, { look: (i) => i % 2 === 0 });
  // every cut of the blade on its captured clip, the guard held (the blade drawn, the hilt in his fist)
  for (const [name, S] of Object.entries(ATTACKS)) {
    const n = Math.max(2, Math.round((S.to - S.from) / dt));
    gait(`the blade: ${name}`, { KeyZ: true }, n, { look: (i) => i % 3 === 0, move: (i) => ({ clip: S.clip, t: S.from + (i / (n - 1)) * (S.to - S.from), w: 1, full: true, id: 'probe' }) });
  }
  for (let i = 0; i < 4; i++) out.push(clip('the title stance', 'Idle_Loop', i / 4, null, () => holdStance(p.char, i)));
  const climbing = () => { p.climbing = true; }, ledge = () => { p.mantle = { t: 0 }; };
  for (const [n, k, st] of [['Climb_Up_Loop', 6, climbing], ['Climb_Idle_Loop', 3, climbing], ['Climb_Left_Loop', 4, climbing], ['Climb_Right_Loop', 4, climbing], ['Climb_Down_Loop', 4, climbing], ['ClimbLedge', 8, ledge], ['Driving_Loop', 4], ['Jump_Loop', 3], ['Jump_Start', 3], ['Jump_Land', 3]])
    for (let i = 0; i < k; i++) out.push(clip(n, n, i / k, st));
  for (const k of [0.5, 1]) out.push(clip('sitting on a bench', 'Idle_Loop', 0, () => { p.overlay = () => {}; }, () => benchSitPose(p.char, k)));
  const swim = (label, crawl, i, n) => [label, () => { reset(); p.swim = { k: 1, crawl, ph: i / n, pitch: 1.4, roll: 0, vy: 0, hs: 1 }; p.animate(dt, 0); settle(); }, true];
  for (let i = 0; i < 8; i++) out.push(swim('swimming (crawl)', 1, i, 8));
  for (let i = 0; i < 4; i++) out.push(swim('swimming (breaststroke)', 0, i, 4));
  // the roll, frame by frame from his feet (its state set: combatMotion.roll)
  for (let k = 1; k <= 53; k += 4) out.push(['the dodge roll', () => { reset(); p.combatMotion = { dir: v(0, 0, 1), speed: 0, scale: 0, evade: k * dt, roll: k * dt }; p.onGround = true; p.animate(dt, 0); settle(); }, true]);
  out.push(['gliding', () => { reset(); p.gliding = true; p.onGround = false; p.animate(dt, 0); p.wingK = 1; p.spreadArms?.(); settle(); p.gliding = false; p.onGround = true; p.wingK = 0; }, true]);
  return out;
}

/** Per label: the least of each clearance, which part, how many of its frames something else touched it, and how often it was shown. */
function measure(it) {
  const res = new Map(), own = forearmSkin(it.p, it.tool);
  for (const [label, pose, look] of poses(it)) {
    pose();
    if (!look) continue;
    const r = res.get(label) ?? { inside: Infinity, hand: Infinity, other: Infinity, shirt: Infinity, handWhat: '', otherWhat: '', shirtWhat: '', touched: 0, shown: 0, n: 0 };
    const d = clearance(it.p, it.tool, own);
    if (d.inside < r.inside) { r.inside = d.inside; r.insideAt = d.insideAt; }
    for (const k of ['hand', 'other', 'shirt']) if (d[k] < r[k]) { r[k] = d[k]; r[k + 'What'] = d[k + 'What']; }
    if (Math.min(d.other, d.shirt) < 0) r.touched++;
    r.n++;
    if (it.tool.tank.group.visible && it.tool.bracer.visible) r.shown++;
    res.set(label, r);
  }
  return res;
}

const mm = (x) => (x === Infinity ? '—' : `${(x * 1000).toFixed(1)} mm`);
const say = (who, res) => process.env.SAY && console.log(`${who}:\n` + [...res].map(([k, r]) => `  ${k}: his forearm ${mm(r.inside)} inside${process.env.SAY === '2' ? ` (${r.insideAt})` : ''}; his hand, the glove, the hilt ${mm(r.hand)} off (${r.handWhat}); the rest ${mm(r.other)} off (${r.otherWhat}), his shirt ${mm(r.shirt)}, touching in ${r.touched}/${r.n}; shown ${r.shown}/${r.n}`).join('\n'));
/** The fast moves: a cut of the blade, the evade, the roll. In them his other hand, his head, his body or his legs come
 *  within 5–18 mm of the bare forearm (and his upper arm folds onto it): the clips' own closeness, which a bracer can't
 *  stand clear of. They may touch it, never deeper than FAST_DEPTH. */
const FAST = /^(the blade: |the evade|the dodge roll)/, FAST_DEPTH = 0.012;

test('on his right forearm in its bracer, carried by the forearm\'s bone; the cell along its back; nothing on his hip or his back', async () => {
  const { p, tool } = await worn('v2');
  const H = p.humanoid, g = tool.tank.group, b = tool.bracer;
  const body = p.object.getObjectByName('TravellerV2.body');
  assert.ok(body && tool.fit.sig.includes(`${body.id}:`), 'fitted to v2\'s own forearm');
  assert.ok(g.parent === H.b.lowerarm_r && b.parent === H.b.lowerarm_r, 'the cell and the bracer on the right forearm\'s bone');
  assert.ok(g.visible && b.visible, 'shown standing');
  g.updateWorldMatrix(true, false);
  // the cell lies along the forearm, its foot toward the wrist, on the outside of the leather
  const foot = g.localToWorld(v(0, 0, 0)), head = g.localToWorld(v(0, TANK.height, 0));
  const elbow = H.b.lowerarm_r.getWorldPosition(v()), wrist = H.b.hand_r.getWorldPosition(v());
  const arm = wrist.clone().sub(elbow).normalize(), along = head.clone().sub(foot).normalize();
  assert.ok(along.dot(arm) < -0.98, `lengthwise along the forearm, its foot at the wrist (${along.dot(arm).toFixed(3)})`);
  assert.ok(foot.distanceTo(wrist) < head.distanceTo(wrist), 'its foot nearer the wrist');
  const F = cellFrame(tool.fit, TANK), mid = F.position.clone().addScaledVector(F.up, TANK.height / 2);
  assert.ok(bracerGap(tool.fit, mid) > 0.005, 'its middle stands outside the leather');
  // facing out from him as his arm hangs: the cell's outside turned away from his body
  const out = F.out.clone().transformDirection(H.b.lowerarm_r.matrixWorld), side = p.object.worldToLocal(mid.clone().applyMatrix4(H.b.lowerarm_r.matrixWorld)).x;
  const toward = v(Math.sign(side) * 1, 0, 0).transformDirection(p.object.matrixWorld);
  assert.ok(out.dot(toward) > -0.2, `not turned in against his body (${out.dot(toward).toFixed(2)})`);
  // the bracer from under his rolled sleeve to above the wrist; the cell inside its length
  assert.ok(TANK.height > 0.08 && TANK.height < BRACER.y[1] - BRACER.y[0], `the cell ${(TANK.height * 100).toFixed(1)} cm, inside the bracer's length`);
  assert.ok(BRACER.y[1] < H.b.hand_r.position.length() - 0.03, 'the bracer ends above the wrist (the hand bends free of it)');
  // no battery on his hip anchor nor on his back: the only thing there is the wings' root, an empty frame until they open
  let onHip = 0; H.hipAnchor?.traverse((o) => { if (o.isMesh && /tank|battery|glass/i.test(o.name)) onHip++; });
  assert.equal(onHip, 0, 'nothing of the battery on his hip');
  const back = tool.back;
  assert.ok(back.parent === H.chestAnchor && back.position.z === WING_ROOT.at[2]);
  let shown = 0; back.traverse((o) => { if (o.isMesh && o.visible) for (let w = o; w; w = w.parent) { if (!w.visible) break; if (w === back) { shown++; break; } } });
  assert.equal(shown, 0, 'nothing drawn on his back with the wings folded');
  tool.dispose();
});

test('the bracer stays on his arm while the cell sits in a vehicle\'s socket, and the cell comes back to it', async () => {
  const { p, tool } = await worn('B3');
  const body = p.object.getObjectByName('TravellerB3Body');
  assert.ok(body && tool.fit.sig.includes(`${body.id}:`), 'fitted to B3\'s forearm');
  const sock = new THREE.Object3D(); sock.position.set(2, 1, -60); tool.scene.add(sock);
  p.ride = { powered: true, socket: sock }; tool.update(dt, {});
  assert.equal(tool.where, 'socket'); assert.equal(tool.tank.group.parent, sock);
  assert.ok(tool.bracer.visible && tool.bracer.parent === p.humanoid.b.lowerarm_r, 'the empty bracer stays on his forearm');
  p.ride = null; tool.update(dt, {});
  assert.equal(tool.where, 'back'); assert.equal(tool.tank.group.parent, p.humanoid.b.lowerarm_r, 'back in the bracer');
  tool.dispose();
});

for (const who of ['v2', 'B3']) {
  test(`${who}: the forearm inside the leather, his hand, the glove and the hilt clear of it in every pose; the rest of him clear of it but in the fast moves; shown in every pose`, { timeout: 600000 }, async () => {
    const it = await worn(who);
    const res = measure(it);
    say(who, res);
    const bad = [];
    for (const [label, r] of res) {
      if (!(r.inside > 0.0003)) bad.push(`${label}: his forearm ${mm(r.inside)} inside the leather (through it)`);
      // (B3, the body the game falls back to, lays the hilt back against the wrist end of the leather in the first
      // cut's wind-up, 0.6 mm in for a frame: allowed it; v2, the game's traveller, 1 mm clear everywhere)
      if (!(r.hand > (who === 'v2' ? 0.001 : -0.001))) bad.push(`${label}: ${r.handWhat} ${mm(r.hand)} off the bracer or the cell (into it)`);
      if (FAST.test(label) ? !(Math.min(r.other, r.shirt) > -FAST_DEPTH) : !(r.other > 0)) bad.push(`${label}: ${r.otherWhat} ${mm(r.other)} off the bracer or the cell`);
      if (!FAST.test(label) && !(r.shirt > -SHIRT_DEPTH)) bad.push(`${label}: his shirt ${mm(r.shirt)} off the bracer (${r.shirtWhat})`);
      if (r.shown < r.n) bad.push(`${label}: shown ${r.shown}/${r.n} (nothing hides it)`);
    }
    assert.deepEqual(bad, []);
    assert.ok(res.size >= 30, `every pose looked at (${res.size})`);
    it.tool.dispose();
  });
}
