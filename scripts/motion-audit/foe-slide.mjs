// Foot slide of the roster's foes (issue #749): each walks, runs, strafes, turns on the spot and is knocked back on flat
// ground through the game's own model and Foes.look, with the clip library loaded (the humanoid rig) or on the kit; a
// foot is the lowest vertex under its leg (walk.mjs lowest). Prints slide per metre the body moved (the foot's travel
// over the ground while on it) and the worst single contact, per scenario.
//   node scripts/motion-audit/foe-slide.mjs [ids…] [--json]
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { libraryFrom } from '../../src/animator.js';
import { attachMotion } from '../../src/motion-match.js';
import { setFoeClips, footBall } from '../../src/enemies/humanoid-rig.js';
import { clearTargets } from '../../src/targets.js';
import { footSlide } from './metrics.mjs';
import { Foes } from '../../src/foes.js';
import { GameState } from '../../src/game-state.js';

export const SLIDE_FOES = ['grunt', 'hulk', 'prowler', 'warlord', 'sentinel', 'fencer', 'crawler', 'tripod', 'skitter'];
// (no feet on the ground: the oracle hovers, the ray and the drone fly, the blot is a glob of ink: measured as "—")
export const NO_FEET = ['oracle', 'ray', 'drone', 'blot'];
export const SCENARIOS = ['walk', 'run', 'strafe', 'turn', 'knock'];

const DT = 1 / 60;
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export async function loadClips() {
  const parse = async (n) => { const b = await readFile(new URL(`../../public/anim/${n}`, import.meta.url)); return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
  const [u, m, g] = await Promise.all(['ual.glb', 'moves.glb', 'gestures.glb'].map(parse));
  const lib = libraryFrom(u); attachMotion(lib, m); attachMotion(lib, g);
  setFoeClips(lib);
  return lib;
}

export function slideArena() {
  clearTargets();
  const P = { pos: v(0, 0, 400), vel: v(), heading: 0, onGround: true, health: 1, hurt() {}, knockDown() { return true; }, stagger() {}, flinch() {}, guarding() { return false; }, guard() { return false; } };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null }, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng: () => 0.5 });
  foes.setPractice('');
  return { foes, P, done: () => { foes.dispose(); clearTargets(); } };
}

/**
 * Where to read each foot: the humanoid rig's ankles (the ball of the sole under each, footBall) or the kit's foot
 * pivots (the pad's spot on the ground: its lowest vertex flips across a round pad as the leg tilts, 10-20 cm).
 */
export function footRoots(M) {
  if (M.joints?.feet) return M.joints.feet;
  return M.rig?.legs.map((l) => l.foot) ?? [];
}

/**
 * One scenario for one foe: { slidePerM, worst, moved } (moved: the body's travel over the ground, m; slidePerM the
 * feet's mean slide over it; for a turn on the spot, per radian turned). `frames` after 40 settling.
 */
export function measure(foes, kind, scenario, { frames = 180 } = {}) {
  const f = foes.add(kind, v());
  f.provoked = true; f.state = 'chase'; f.heading = 0; f.cool = 99;
  const M = f.model, roots = footRoots(M), speed = f.def.speed;
  const feet = roots.map(() => []);
  let moved = 0, turned = 0;
  const p = v();
  let balls = null;
  for (let i = 0; i < 40 + frames; i++) {
    if (i === 39 && M.joints?.feet) { M.group.updateMatrixWorld(true); balls = roots.map((r) => footBall(r)); }
    const t = i * DT, on = i >= 40;
    const prev = f.pos.clone(), h0 = f.heading;
    if (scenario === 'walk') { if (on || i > 20) f.pos.z += speed * 0.35 * DT; }
    else if (scenario === 'run') { if (on || i > 20) f.pos.z += speed * DT; }
    else if (scenario === 'strafe') { if (on || i > 20) f.pos.x += speed * 0.6 * DT; f.heading = 0; }
    else if (scenario === 'turn') { if (on && ((i - 40) % 60) === 0) f.heading += Math.PI / 2; }
    else if (scenario === 'knock') {
      // (a cut's shove every second: knockK along the blow, eased out at e^-6t as Foe.update does, stunned 0.6 s)
      if (on && ((i - 40) % 60) === 0) { f.vel.set(0, 0, -f.knockK() * 2.2); f.stunned = 0.6; f.state = 'recover'; f.timer = 0.6; }
      if (f.vel.lengthSq() > 1e-4) { f.pos.addScaledVector(f.vel, DT); f.vel.multiplyScalar(Math.exp(-6 * DT)); }
      f.stunned = Math.max(0, f.stunned - DT);
      if (f.stunned <= 0) f.state = 'chase';
    }
    // (the traveller close by, off to one side: the kit's and the rig's near tiers, as in a fight)
    foes.player.pos.set(f.pos.x + 5, 0, f.pos.z + 3); f.dist = 5.8;
    foes.look(f, DT);
    M.group.updateMatrixWorld(true);
    if (!on) continue;
    moved += Math.hypot(f.pos.x - prev.x, f.pos.z - prev.z);
    turned += Math.abs(f.heading - h0);

    roots.forEach((r, k) => feet[k].push((balls?.[k] ? r.localToWorld(p.copy(balls[k])) : r.getWorldPosition(p)).toArray()));
  }
  foes.remove(f);
  if (!roots.length) return null;
  const per = feet.map((ft) => footSlide(ft, 0.03));
  const slide = per.reduce((a, s) => a + s.slide, 0) / per.length, worst = Math.max(...per.map((s) => s.worst));
  const base = scenario === 'turn' ? Math.max(turned, 1e-3) : Math.max(moved, 1e-3);
  return { slidePerM: slide / base, worst, moved, share: per.reduce((a, s) => a + s.share, 0) / per.length };
}

export async function slideTable(ids = SLIDE_FOES, o = {}) {
  await loadClips();
  const { foes, done } = slideArena();
  const out = {};
  for (const id of ids) { out[id] = {}; for (const s of SCENARIOS) out[id][s] = measure(foes, id, s, o); }
  done();
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), json = args.includes('--json'), ids = args.filter((a) => !a.startsWith('--'));
  const T = await slideTable(ids.length ? ids : SLIDE_FOES);
  if (json) console.log(JSON.stringify(T, null, 1));
  else {
    console.log(`${'foe'.padEnd(10)} ${SCENARIOS.map((s) => s.padStart(15)).join('')}   (slide m per m moved / worst contact m; turn: per rad)`);
    for (const [id, r] of Object.entries(T)) console.log(`${id.padEnd(10)} ${SCENARIOS.map((s) => (r[s] ? `${r[s].slidePerM.toFixed(3)}/${r[s].worst.toFixed(2)}` : '—').padStart(15)).join('')}`);
  }
}
