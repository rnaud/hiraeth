// #800 family G: the hulk's stomp with the clips (tests/monster-shapes.test.js's): the body raised over its standing leg,
// that foot's drift, frame by frame through the wind-up.
//   node references/enemy-redesign-2026-10-30/trials/familyG-tripo/stomp-probe.mjs
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Foes } from '../../../../src/foes.js';
import { libraryFrom } from '../../../../src/animator.js';
import { attachMotion } from '../../../../src/motion-match.js';
import { HOLD_AT, setFoeClips } from '../../../../src/enemies/humanoid-rig.js';
import { clearTargets } from '../../../../src/targets.js';
import { GameState } from '../../../../src/game-state.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const parse = async (n) => { const b = await readFile(new URL(`../../../../public/anim/${n}`, import.meta.url)); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
const [u, m, g] = await Promise.all([parse('ual.glb'), parse('moves.glb'), parse('gestures.glb')]);
const lib = libraryFrom(u); attachMotion(lib, m); attachMotion(lib, g); setFoeClips(lib);
clearTargets();
const P = { pos: v(0, 0, -6), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: true, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, stagger() {}, flinch() {}, guarding() { return false; }, guard() { return false; } };
const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null }, player: P, settings: { enemies: 'normal' }, game: new GameState(null) });
foes.setPractice('');
const DT = 1 / 60, run = (f, n, set) => { for (let i = 0; i < n; i++) { set?.(i); foes.look(f, DT); } };
import { nextRigSeed } from '../../../../src/motion-kit/rig.js';
if (process.env.SEED) nextRigSeed(+process.env.SEED);
if (process.env.DSEED) (await import('../../../../src/enemies/humanoid-rig.js')).nextDriverSeed(+process.env.DSEED);
if (process.env.LEGACY) { const [{ TRIAL_BUILDERS }, M] = await Promise.all([import('../../../../src/enemies/plans/index.js'), import('../../../../src/enemies/plans/monster.js')]); TRIAL_BUILDERS.hulk = M.legacyHulkModel; }
const { nextDriverSeed } = await import('../../../../src/enemies/humanoid-rig.js');
const out = [];
for (const ds of (process.env.SCAN ?? '').split(',').filter(Boolean).map(Number).concat(process.env.SCAN ? [] : [null])) {
  if (ds !== null) nextDriverSeed(ds);
  const f = foes.add(process.argv[2] ?? 'hulk', v()); f.provoked = true; f.heading = 0; f.state = 'chase';
  const J = f.model.joints, W = (j) => { f.model.group.updateMatrixWorld(true); return j.getWorldPosition(v()); };
  for (let i = 0; i < 40; i++) { f.pos.z += 0.03; foes.look(f, DT); }
  f.state = 'idle'; run(f, 30);
  const atk = f.def.attacks.find((a) => a.id === 'stomp');
  const at = (k) => { run(f, 16, () => { f.state = 'wind'; f.atk = atk; f.k = k; }); return W(J.feet[1]); };
  const a0 = at(0.02), a1 = at(HOLD_AT);
  out.push(`${ds}:${a1.distanceTo(a0).toFixed(2)}`);
  foes.remove(f);
}
console.log('drift by driver seed', out.join(' '));
