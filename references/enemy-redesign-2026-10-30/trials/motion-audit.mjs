// #800 phase 2: scripts/motion-audit's straight-line walk of a trial foe in each variant (node, no GPU): slide a metre,
// worst contact, reach and lift, groups and cadence, at full and half pace, per variant.
//   node references/enemy-redesign-2026-10-30/trials/motion-audit.mjs [crab@arzach2 | brute@perdide2] [--json]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { TRIAL_BUILDERS } from '../../../src/enemies/plans/index.js';
import { shellbackModel } from '../../../src/enemies/plans/shellback.js';
import { tripoShellbackModel, shellbackSource } from '../../../src/enemies/plans/shellback-tripo.js';
import { broadHoundModel } from '../../../src/enemies/plans/broad-hound.js';
import { tripoHoundModel } from './hound-tripo/model.js';
import { nodeSource as houndSource } from './hound-tripo/node-source.mjs';
import { woodcutterModel } from '../../../src/enemies/plans/woodcutter.js';
import { tripoWoodcutterModel } from './woodcutter-tripo/model.js';
import { nodeSource as woodcutterSource } from './woodcutter-tripo/source-node.mjs';
import { foeSystem, foeSubject, legsFor } from '../../../scripts/motion-audit/walk.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), json = args.includes('--json'), id = args.find((a) => !a.startsWith('--')) ?? 'crab@arzach2';
// (the mummer is on the humanoid clip rig, not the kit: its audit is foe-slide's, on the clips: mummer-tripo/motion.mjs)
if (id.startsWith('mummer')) { await (await import('./mummer-tripo/motion.mjs')).run(id, json); process.exit(0); }
// (the Tripo shellback is the game's crab now, #800: its shipped body, public/enemies/shellback/body.glb, read at once in node)
const src = shellbackSource();
const BY_KIND = { crab: { current: null, direct: shellbackModel, tripo: (skin) => tripoShellbackModel(skin, src) } };
BY_KIND.hound = (() => { const h = houndSource(); return { current: null, direct: broadHoundModel, tripo: (skin) => tripoHoundModel(skin, h) }; })();
BY_KIND.brute = (() => { const w = woodcutterSource(); return { current: null, direct: woodcutterModel, tripo: (skin) => tripoWoodcutterModel(skin, w) }; })();
const VARIANTS = BY_KIND[id.split('@')[0]];
// (two measures of a foot: the audit's own, the leg's lowest drawn point, and the kit's foot joint itself: a broad flat
//  sole has no one lowest point, its lowest vertex hops heel to toe, which reads as slide; the Tripo legs are bones
//  outside the kit's chains, read from the skin's foot bones)
const footJoints = (M) => M.rig.legs.map((L, k) => { const foot = M.group.getObjectByName(`leg${k}_foot`) ?? L.foot; return { lowest: (o) => foot.getWorldPosition(o), getWorldPosition: (o) => L.root.getWorldPosition(o) }; });
const kind = id.split('@')[0], out = {};
/** Each kind's lunge, measured standing (the pounce of the hound). */
const ARCHETYPE_LUNGE = { hound: 'pounce' };
const brief = (r) => ({ slidePerMetre: +r.slidePerMetre.toFixed(4), worstSlide: +r.worstSlide.toFixed(3), reachShare: +(r.reachShare ?? 0).toFixed(3), liftShare: +(r.liftShare ?? 0).toFixed(3), cadence: r.cadence, bob: +r.bob.toFixed(3), groups: r.groups, legLength: +(r.legLength ?? 0).toFixed(2) });
for (const [v, fn] of Object.entries(VARIANTS)) {
  if (fn) TRIAL_BUILDERS[kind] = fn; else delete TRIAL_BUILDERS[kind];
  for (const pace of [1, 0.5]) for (const [m, legs] of [['lowest point', legsFor(kind)], ['foot joint', footJoints]]) {
    if (v === 'tripo' && m === 'lowest point') continue;   // (its skin's bones are not under the kit's legs: no lowest point to read)
    const sys = foeSystem();
    const r = foeSubject(sys, id, legs, { pace });
    out[`${v} ×${pace} · ${m}`] = json ? r : brief(r);
    sys.dispose();
  }
}
// the lunge (the hound's pounce, #800 phase 2b): standing, its wind-up and strike played through at 60 fps; the planted
// feet's slip a frame while planted through the crouch and coil (they must hold; the steps it takes to brace counted), the body's lowest dip, its highest point in the leap and
// how far forward the head travels, and whether the feet leave the ground in the leap
const lunge = ARCHETYPE_LUNGE[kind];
if (lunge) for (const [v, fn] of Object.entries(VARIANTS)) {
  if (fn) TRIAL_BUILDERS[kind] = fn; else delete TRIAL_BUILDERS[kind];
  const sys = foeSystem(), f = sys.add(id, new THREE.Vector3()), M = f.model, a = f.def.attacks.find((x) => x.id === lunge);
  const feet = footJoints(M), p = new THREE.Vector3(), head = M.tell('bite'), h = new THREE.Vector3();
  const dt = 1 / 60, at = () => feet.map((x) => x.lowest(new THREE.Vector3()));
  f.heading = 0; f.provoked = true; f.dist = 3; f.state = 'idle';
  for (let i = 0; i < 60; i++) sys.look(f, dt);
  const rest = at(), y0 = M.body.getWorldPosition(p).y, h0 = head.getWorldPosition(h).clone();
  let drift = 0, dip = 0, rise = 0, ahead = 0, airborne = 0, lowFoot = Infinity;
  f.atk = a; f.state = 'wind';
  let last = rest, steps = 0; const planted = () => M.rig.planner.feet.map((x) => x.planted); let was = planted();
  for (let t = 0; t < a.wind; t += dt) { f.k = t / a.wind; sys.look(f, dt); const q = at(), now = planted(); q.forEach((x, i) => { if (now[i] && was[i]) drift = Math.max(drift, Math.hypot(x.x - last[i].x, x.z - last[i].z) / dt * dt); if (now[i] && !was[i]) steps++; }); last = q; was = now; dip = Math.min(dip, M.body.getWorldPosition(p).y - y0); }
  f.state = 'strike';
  for (let t = 0; t < a.strike; t += dt) { f.k = t / a.strike; sys.look(f, dt); const q = at(); lowFoot = Math.min(lowFoot, ...q.map((x) => x.y)); if (q.every((x) => x.y > 0.05)) airborne++;
    rise = Math.max(rise, M.group.position.y + M.body.getWorldPosition(p).y - y0); ahead = Math.max(ahead, head.getWorldPosition(h).z - h0.z); }
  out[`${v} · ${lunge}`] = { plantedSlipPerFrameM: +drift.toFixed(4), windSteps: steps, crouchDipM: +dip.toFixed(3), leapRiseM: +rise.toFixed(3), headAheadM: +ahead.toFixed(3), airborneFrames: airborne, lowestFootInLeapM: +lowFoot.toFixed(3) };
  sys.dispose();
}
delete TRIAL_BUILDERS[kind];
if (json) console.log(JSON.stringify(out, null, 1));
else for (const [k, r] of Object.entries(out)) console.log(k.padEnd(30), JSON.stringify(r));
