// "I've been hit" and the defeats (docs/systems/foes.md, "Hit and defeat", v1.35): every archetype's body flinches along
// a blow on springs (its feet planted), a stagger more than a flinch, its ink flashes through the materials' own flags
// (src/foe-react.js); every archetype goes down its own way in 0.8-1.5 s and bursts at the end (src/enemies/defeat.js),
// harmless and out of the way meanwhile, cheap with many at once; an armoured glance keeps its own look.
import test from 'node:test';
import { SMOKE } from '../src/smoke-puff.js';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES } from '../src/foes.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets, allTargets } from '../src/targets.js';
import { FoeReact, REACT, applyReact, restoreBody, installFlash, splashTones, lightness } from '../src/foe-react.js';
import { DEFEATS, defeatPose, startDefeat, stage } from '../src/enemies/defeat.js';
import { resetFeel } from '../src/feel.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const BUILT = Object.entries(ARCHETYPES).filter(([, A]) => A.status === 'built');
function world() {
  clearTargets(); resetFeel();
  const P = { pos: v(0, 0, 0), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  const game = new GameState(null), drops = [];
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game, tool: { drops: { add: (d) => drops.push(d) } } });
  foes.setPractice('');
  return { foes, P, game, drops };
}
/** A blow that tells on every archetype: from behind it (past a crab's shell; a centipede's from in front), out of the sand, a bell sitting open. */
function cut(foes, f, damage = 1) {
  f.buried = false; f.open = Math.max(f.open ?? 0, 1); f.state = f.state === 'dead' ? f.state : 'recover'; f.timer = 0.5;
  // (its own forward: a blow on its back, past a crab's shell; a plated centipede's from the front, where its plates aren't)
  const back = v(Math.sin(f.heading), 0, Math.cos(f.heading)).multiplyScalar(f.def.segmented ? -1 : 1);
  return foes.hurt(f, 'blade', back, { damage }, f.chest.clone());
}

test('springs: a blow shoves, tips and squashes, then settles; a stagger is bigger and slower than a flinch', () => {
  const peak = (kind) => { const R = new FoeReact(); R.hit(v(0, 0, 1), kind); let p = 0, t = 0, settled = null; for (let i = 0; i < 120; i++) { R.update(DT); if (Math.abs(R.push.y) > p) { p = Math.abs(R.push.y); t = i * DT; } if (settled === null && i > 10 && !R.live) settled = i * DT; } return { p, t, settled }; };
  const fl = peak('flinch'), st = peak('stagger'), sh = peak('shrug');
  assert.ok(fl.p > 0.08 && fl.p < 0.3, `a flinch shoves ${fl.p.toFixed(3)} m`);
  assert.ok(st.p > fl.p * 1.6, `a stagger more (${st.p.toFixed(3)})`);
  assert.ok(st.t > fl.t, 'and slower to peak');
  assert.ok(sh.p < fl.p * 0.6, 'a cut shrugged off: a little');
  assert.ok(fl.settled !== null && fl.settled < 1.2, `settled in ${fl.settled?.toFixed(2)} s`);
  const R = new FoeReact(); R.hit(v(1, 0, 0), 'flinch'); assert.ok(R.flashT > 0 && R.flashT <= REACT.flash.time);
  for (let i = 0; i < 20; i++) R.update(DT);
  assert.equal(R.flashK, 0, 'the flash is a blink');
});

test('the shove goes on the body along the blow and is put back before its own pose: nothing accumulates', () => {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.rotation.y = Math.PI / 2; g.updateMatrixWorld(true);
  body.position.set(0, 1, 0);
  const R = new FoeReact(); R.hit(v(1, 0, 0), 'stagger');
  for (let i = 0; i < 4; i++) R.update(DT);
  applyReact(R, body);
  const w = body.getWorldPosition(v());
  assert.ok(w.x > 0.02, `shoved the blow's way in the world (${w.x.toFixed(3)})`);
  assert.ok(body.scale.y < 1, 'squashed');
  restoreBody(R, body);
  assert.ok(body.position.distanceTo(v(0, 1, 0)) < 1e-9 && Math.abs(body.scale.y - 1) < 1e-9, 'put back');
});

test('the flash: its ink brightens through the materials\' own flags as it is drawn, and is given back after; not in the shadow pass', () => {
  const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color('#302820') }, uGlow: { value: 0 }, uLineWhite: { value: 0 } } });
  const g = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), mat); g.add(mesh);
  const R = new FoeReact('creature'); installFlash({ group: g }, R);
  R.hit(v(0, 0, 1), 'flinch'); R.update(0.001);
  mesh.onBeforeRender(null, null, null, mesh.geometry, mat);
  assert.ok(lightness(mat.uniforms.uColor.value) > 0.5, 'pale');
  assert.ok(mat.uniforms.uGlow.value > 0.62, 'self-lit past the bloom\'s threshold');
  assert.equal(mat.uniforms.uLineWhite.value, 1, 'its line white at the start');
  mesh.onAfterRender(null, null, null, mesh.geometry, mat);
  assert.equal(mat.uniforms.uColor.value.getHexString(), '302820'); assert.equal(mat.uniforms.uGlow.value, 0); assert.equal(mat.uniforms.uLineWhite.value, 0);
  const shadow = new THREE.MeshBasicMaterial();
  mesh.onBeforeRender(null, null, null, mesh.geometry, shadow);
  assert.equal(mat.uniforms.uGlow.value, 0, 'the shadow pass (the scene\'s override material) untouched');
  assert.deepEqual(splashTones('machine').slice(0, 2), ['#fff6dc', '#ffd27a'], 'sparks off a machine');
  assert.ok(lightness(splashTones('spirit')[0]) < 0.1, 'black ink off a spirit');
});

test('every archetype flinches on its body when cut (its own family\'s flash and splash), a heavy blow staggers it; an armoured glance keeps its own look', () => {
  const { foes, drops } = world();
  for (const [id, A] of BUILT) {
    const f = foes.add(A.kind, v(0, 0, 6));
    f.hp = 99;
    for (let i = 0; i < 12; i++) foes.update(DT);
    const M = f.model, base = M.body.getWorldPosition(v());
    drops.length = 0;
    assert.ok(cut(foes, f, 1), `${id}: the cut told`);
    assert.ok(f.react?.live, `${id}: reacting`);
    assert.equal(f.react.family, A.family);
    // (v1.41: fewer, HIT_SPLASH: the author found the hits too noisy)
    assert.ok(drops.length >= 3 && drops.length <= 14, `${id}: a small splash where it was cut (${drops.length})`);
    let moved = 0;
    for (let i = 0; i < 12; i++) { foes.update(DT); M.group.updateMatrixWorld(true); moved = Math.max(moved, M.body.getWorldPosition(v()).distanceTo(base)); }
    assert.ok(moved > 0.03, `${id}: its body moves (${moved.toFixed(3)} m)`);
    const light = f.react.push.yd;
    for (let i = 0; i < 90; i++) foes.update(DT);
    cut(foes, f, 3);
    assert.equal(f.react.kind, 'stagger', `${id}: a heavy blow staggers`);
    assert.ok(Math.abs(f.react.push.yd) > Math.abs(light) || light === 0, `${id}: harder`);
    foes.remove(f);
  }
  // the crab's shell from the front: a glance, its sparks and thunk, no flinch, no flash
  const c = foes.add('crab', v(0, 0, 6)); c.heading = 0;
  for (let i = 0; i < 5; i++) foes.update(DT);
  const r = foes.hurt(c, 'blade', v(-Math.sin(c.heading), 0, -Math.cos(c.heading)), { damage: 1 }, c.chest.clone());   // (onto its face)
  assert.ok(r && !(c.react.flashT > 0) && !c.react.live, 'a glance: its own look');
  foes.dispose(); clearTargets();
});

test('every archetype goes down its own way: 0.8-1.5 s, harmless and out of the way, then the burst (ink, chimes) at the end', () => {
  const { foes, game } = world();
  const bursts = [];
  game.on('foe:burst', (e) => bursts.push(e.archetype));
  const seen = new Set();
  for (const [id, A] of BUILT) {
    const R = DEFEATS[id];
    assert.ok(R, `${id}: a defeat of its own`);
    assert.ok(R.time >= 0.8 && R.time <= 1.5, `${id}: ${R.time} s`);
    const moves = ['flip', 'roll', 'topple', 'sag', 'squash', 'sink', 'land', 'spin', 'slack', 'ripple'].filter((k) => R[k]);
    assert.ok(moves.length >= 1, `${id}: moves`);
    seen.add(JSON.stringify(moves));
    const f = foes.add(A.kind, v(0, 0, 6));
    for (let i = 0; i < 12; i++) foes.update(DT);
    const M = f.model, q0 = M.group.quaternion.clone(), p0 = M.group.position.clone(), b0 = M.body.getWorldPosition(v());
    f.hp = 1; bursts.length = 0;
    cut(foes, f, 5);
    assert.ok(f.dying && !f.alive, `${id}: going down, its mind done`);
    assert.equal(bursts.length, 0, `${id}: no burst at the blow`);
    const T = allTargets().find((t) => t.foe === f);
    assert.ok(!T.enabled(), `${id}: nothing to cut or lock on any more`);
    let changed = 0, t = 0;
    while (f.dead === undefined && t < 3) {
      foes.update(DT); t += DT;
      M.group.updateMatrixWorld(true);
      changed = Math.max(changed, M.group.quaternion.angleTo(q0), M.group.position.distanceTo(p0), M.body.getWorldPosition(v()).distanceTo(b0), Math.abs(M.body.scale.y - 1));
      assert.notEqual(f.state, 'wind', `${id}: no blow while it falls`);
    }
    assert.ok(Math.abs(t - R.time) < 0.05, `${id}: burst after ${t.toFixed(2)} s`);
    assert.deepEqual(bursts, [id], `${id}: then the burst, with its chimes`);
    assert.ok(changed > 0.15, `${id}: its body went down (${changed.toFixed(2)})`);
    // (it lies a while, SMOKE.linger, then shrinks away in its puff of smoke, SMOKE.fade, and is gone)
    for (let i = 0; i < Math.round(SMOKE.linger / DT) - 2; i++) foes.update(DT);
    assert.ok(foes.list.includes(f) && f.model.group.scale.x > 0.9 * (f.model.size ?? 1), `${id}: still lying there a second after`);
    for (let i = 0; i < Math.round((SMOKE.fade + 0.1) / DT); i++) foes.update(DT);
    assert.ok(!foes.list.includes(f), `${id}: gone`);
    assert.ok(foes.puffs?.live > 0, `${id}: in a puff of smoke`);
  }
  assert.ok(seen.size >= 12, `the plans go down in many ways (${seen.size})`);
  foes.dispose(); clearTargets();
});

test('a defeat\'s pose: each move over its own window, eased; a flyer comes down to the ground', () => {
  assert.equal(stage({ at: [0.2, 0.6] }, 0.1), 0); assert.equal(stage({ at: [0.2, 0.6] }, 0.7), 1);
  const D = startDefeat({ alt: 1.6, over: 0.4, heading: 0 }, DEFEATS.moth);
  const P0 = defeatPose(D, 0), P1 = defeatPose(D, 1);
  assert.ok(Math.abs(P0.alt - 1.6) < 1e-9 && Math.abs(P1.alt) < 1e-9, 'the moth: from its height to the ground');
  const C = startDefeat({ alt: 0, heading: 0 }, DEFEATS.crab);
  assert.ok(Math.abs(defeatPose(C, 1).flip - Math.PI) < 1e-9 && defeatPose(C, 1).curl > 1.5, 'the crab: on its back, legs curled');
});

test('many going down at once stay cheap', () => {
  const { foes } = world();
  const list = [];
  for (let i = 0; i < 16; i++) { const k = BUILT[i % BUILT.length][1].kind; const f = foes.add(k, v((i % 4) * 4 - 6, 0, 6 + Math.floor(i / 4) * 4)); list.push(f); }
  for (let i = 0; i < 10; i++) foes.update(DT);
  for (const f of list) { f.hp = 1; cut(foes, f, 5); }
  const t0 = performance.now(); let n = 0;
  while (list.some((f) => f.dying && f.dead === undefined) && n < 120) { foes.update(DT); n++; }
  const per = (performance.now() - t0) / n;
  assert.ok(per < 12, `16 falling: ${per.toFixed(2)} ms a frame in node`);
  foes.dispose(); clearTargets();
});
