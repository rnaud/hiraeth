// The makers' battery at the traveller's side (issues #728, #745; references/Core Objects/Makers Battery/selected-2026-10-28/:
// the author's hip lantern, no tether): on his belt at his left side, 45° round from it toward his front, just in front of
// his hanging hand (TANK.at, the hip anchor: the chest's frame carried by the pelvis), as Link wears the Sheikah Slate.
// His arm hangs at his side and his thigh comes up in front of it, so that is the one place both clear it standing and in
// every gait. Anything else that comes to it swings it out on its clip (a jump's spring, the landing, a cut); his climbing,
// swimming, sitting and rolling tuck it away (src/battery-hang.js). Checked here on the game's traveller (v2 in his own
// clothes, and B3): where it sits, that it is seen from a front three-quarter view, and that neither his arms nor his legs
// nor his body come into it in any pose he takes: standing, the gaits, the sprint, talking, the title's stance, jumping
// from a stand and from a run, climbing, the ledge, riding, sitting on a bench, swimming, gliding, the dodge roll, every
// cut of the blade and aiming the gun. Nothing of the battery on his back.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const element = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null });
globalThis.document ??= { createElement: element, body: element(), getElementById: () => null, querySelector: () => null };
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const { FluidTool, TANK, tankGap } = await import('../src/fluid-tool.js');
const { HANG, tuckedPose } = await import('../src/battery-hang.js');
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

/** His drawn skinned meshes (his body, his clothes). */
const meshesOf = (p) => { const out = []; p.object.traverse((o) => { if (o.isSkinnedMesh && o.visible) { for (let w = o; w; w = w.parent) if (!w.visible) return; out.push(o); } }); return out; };

/** The least of him outside the battery as it is now (m; Infinity: hidden, tucked away). */
function clearance(p, tool) {
  const g = tool.tank.group;
  if (!g.visible) return Infinity;
  p.object.updateMatrixWorld(true); g.updateWorldMatrix(true, false);
  const inv = g.matrixWorld.clone().invert(), w = v();
  let least = Infinity;
  for (const m of meshesOf(p)) {
    m.skeleton.update();
    const P = m.geometry.attributes.position, M = m.matrixWorld.clone().premultiply(inv);
    for (let i = 0; i < P.count; i++) {
      w.fromBufferAttribute(P, i); m.applyBoneTransform(i, w); w.applyMatrix4(M);
      if (Math.abs(w.x) > 0.25 || Math.abs(w.z) > 0.25 || w.y < -0.1 || w.y > TANK.height + 0.1) continue;   // (far from it)
      least = Math.min(least, tankGap(w));
    }
  }
  return least;
}

/**
 * Every pose he takes, each [label, pose(), look]: the gaits and the jumps frame by frame as in the game (the battery's
 * own swing and tuck as they run), the clips and the overlays posed and the battery settled on them (hangOnHip(0)), with
 * the state he is in while he takes them (climbing, on the ledge, swimming, sitting, rolling).
 */
function poses({ p, tool, tick }) {
  const a = p.animator, lib = a.lib, H = p.humanoid, out = [];
  const settle = () => { p.char.root.updateMatrixWorld(true); H.update(); p.object.updateMatrixWorld(true); tool.hangOnHip(0); tool.tank.group.visible = (tool.hang?.tuck ?? 0) < 0.999; };
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
  // every cut of the blade on its captured clip, the guard held (the blade drawn)
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

/** Per label: the least of him outside the battery, how far it swung (rad) at most, and whether it was ever tucked. */
async function measure(it) {
  const res = new Map();
  for (const [label, pose, look] of poses(it)) {
    pose();
    if (!look) continue;
    const r = res.get(label) ?? { gap: Infinity, swing: 0, tucked: 0, shown: 0, n: 0 };
    const d = clearance(it.p, it.tool), h = it.tool.hang;
    r.gap = Math.min(r.gap, d); r.swing = Math.max(r.swing, h.swing); r.n++;
    if (it.tool.tank.group.visible) r.shown++; else r.tucked++;
    res.set(label, r);
  }
  return res;
}

const cm = (x) => (x === Infinity ? 'hidden' : `${(x * 100).toFixed(1)} cm`);
const say = (who, res) => process.env.SAY && console.log(`${who}:\n` + [...res].map(([k, r]) => `  ${k}: ${cm(r.gap)}, swung ${(r.swing * 57.3).toFixed(0)}°, shown ${r.shown}/${r.n}`).join('\n'));

test('at his left side, just behind his hand, hanging from his belt, carried by his pelvis; nothing on his back but the wings\' roots', async () => {
  const { p, tool } = await worn('v2');
  const H = p.humanoid, g = tool.tank.group;
  assert.ok(g.parent === H.hipAnchor && H.hipAnchor !== H.chestAnchor, 'on the hip anchor, not the chest\'s');
  assert.equal(H.hipAnchor.parent.name, 'pelvis', 'carried by the pelvis');
  assert.ok(g.visible && tool.hang.tuck === 0 && tool.hang.swing < 1e-3, 'standing: at its place, not swung, not tucked');
  const feet = p.pos.y;
  g.updateWorldMatrix(true, false);
  const mid = g.localToWorld(v(0, TANK.center, 0)), local = p.object.worldToLocal(mid.clone());
  const top = g.localToWorld(v(0, TANK.height, 0)).y - feet;
  assert.ok(mid.y - feet > 0.78 && mid.y - feet < 0.92 && top > 0.9 && top < 1.0, `hanging from his belt down his hip (its middle ${(mid.y - feet).toFixed(2)} m up, its top ${top.toFixed(2)})`);
  assert.ok(local.x > 0.18 && local.x < 0.3, `at his left side (+x ${local.x.toFixed(3)})`);
  assert.ok(local.z < -0.08 && local.z > -0.2 && Math.atan2(-local.z, local.x) < 0.6, `at his side, a little behind it, not his back (z ${local.z.toFixed(3)})`);
  const hand = p.object.worldToLocal(H.b.hand_l.getWorldPosition(v()));
  assert.ok(local.z < hand.z - 0.1, `just behind his hanging hand (z ${local.z.toFixed(3)}, the hand ${hand.z.toFixed(3)})`);
  const up = v(0, 1, 0).transformDirection(g.matrixWorld);
  assert.ok(up.y > 0.98, 'upright, as a lantern hangs');
  // no battery on his back: the only thing there is the wings' root, an empty frame until they open
  const back = tool.back;
  assert.ok(back.parent === H.chestAnchor && back.position.z === WING_ROOT.at[2]);
  let shown = 0; back.traverse((o) => { if (o.isMesh && o.visible) for (let w = o; w; w = w.parent) { if (!w.visible) break; if (w === back) { shown++; break; } } });
  assert.equal(shown, 0, 'nothing drawn on his back with the wings folded');
  tool.dispose();
});

test('seen from a front three-quarter view, from his side and from behind: nothing of him between the camera and its glass', async () => {
  const { p, tool } = await worn('v2');
  const g = tool.tank.group;
  p.object.updateMatrixWorld(true); g.updateWorldMatrix(true, false);
  const mid = g.localToWorld(v(0, TANK.center, 0));
  const meshes = meshesOf(p), w = v(), seg = new THREE.Line3(), near = v();
  for (const [name, yaw] of [['front three-quarter, his left', Math.PI / 4], ['his left side', Math.PI / 2], ['back three-quarter, his left', Math.PI * 0.75], ['from behind, the follow camera', Math.PI * 0.93]]) {
    // (the camera 3 m off, at his chest's height, `yaw` round from his front toward his left)
    const cam = p.object.localToWorld(v(3 * Math.sin(yaw), 1.3, 3 * Math.cos(yaw)));
    let blocked = 0;
    for (const s of [-1, 0, 1]) {
      const aim = mid.clone().addScaledVector(v(0, 1, 0), s * 0.06);
      seg.set(cam, aim);
      for (const m of meshes) {
        m.skeleton.update();
        const P = m.geometry.attributes.position;
        for (let i = 0; i < P.count; i++) {
          w.fromBufferAttribute(P, i); m.applyBoneTransform(i, w); w.applyMatrix4(m.matrixWorld);
          const t = seg.closestPointToPointParameter(w, true);
          if (t < 0.97 && seg.at(t, near).distanceTo(w) < 0.012) { blocked++; break; }
        }
      }
    }
    assert.equal(blocked, 0, `${name}: ${blocked} of 3 sight lines to the glass go through him`);
  }
  tool.dispose();
});

for (const who of ['v2', 'B3']) {
  test(`${who}: clear of his arms, his legs and his body in every pose he takes; at his side standing and in every gait`, { timeout: 600000 }, async () => {
    const it = await worn(who === 'B3' ? 'b3' : 'v2');
    const res = await measure(it);
    say(who, res);
    const bad = [];
    for (const [label, r] of res) if (!(r.gap > 0.002)) bad.push(`${label}: ${cm(r.gap)} (into the battery)`);
    // at his side, neither swung nor tucked, standing, walking, talking, aiming the gun and gliding
    for (const label of ['standing', 'walking', 'jogging', 'talking', 'aiming the gun', 'walking, aiming', 'gliding']) {
      const r = res.get(label);
      if (r.tucked || r.swing > 0.12) bad.push(`${label}: swung ${(r.swing * 57.3).toFixed(0)}°, tucked ${r.tucked}/${r.n} (should hang still at his side, 7° at most)`);
    }
    // on his hip through a run, the sprint and a jump (swung out of his arm's or his thigh's way as they pass, not
    // tucked): on v2, always; on B3, whose sprinting arm swings wider, most of the time
    for (const label of ['running', 'sprinting', 'a jump from a stand', 'a jump from a run']) {
      const r = res.get(label), least = who === 'v2' ? 1 : 0.75;
      if (r.shown < r.n * least) bad.push(`${label}: shown only ${r.shown}/${r.n}`);
    }
    // tucked away while he climbs, swims, sits or rolls, or is on the ledge
    for (const label of ['Climb_Up_Loop', 'Climb_Idle_Loop', 'Climb_Left_Loop', 'Climb_Right_Loop', 'Climb_Down_Loop', 'ClimbLedge', 'sitting on a bench', 'swimming (crawl)', 'swimming (breaststroke)', 'the dodge roll'])
      if (res.get(label).shown) bad.push(`${label}: shown ${res.get(label).shown}/${res.get(label).n} (should be tucked away)`);
    assert.deepEqual(bad, []);
    assert.ok(res.size >= 30, `every pose looked at (${res.size})`);
    it.tool.dispose();
  });
}

test('the swing and the tuck: out of the way at once, back in its place once clear; the poses that tuck it', () => {
  assert.ok(HANG.margin > 0.005 && HANG.swingMax < 1.2 && HANG.tuckIn <= 0.12);
  for (const s of [{ climbing: true }, { mantle: {} }, { swim: {} }, { overlay: () => {} }, { combatMotion: { roll: 0.2 } }]) assert.ok(tuckedPose(s), JSON.stringify(Object.keys(s)));
  for (const s of [{}, { combatMotion: { dash: true } }, { combatMotion: { evade: 0.3 } }, { gliding: true }, { talking: true }]) assert.ok(!tuckedPose(s), JSON.stringify(s));
});
