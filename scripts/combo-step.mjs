// The combo's step-in (issue #780, the author: "every move should move you toward" the foe): the light combo's three cuts
// pressed at a foe standing `gap` m off its body (or at nothing), on the reach rig (scripts/combat-reach.mjs: the game's
// traveller, real clips and blade, the foe's own model). Per cut: how far he travelled (m, flat), how far off the foe's
// body he stood as the blade came through (m), and whether it landed.
//
//   node scripts/combo-step.mjs                  the table, gaps 0.3..4 m and no foe, free and locked (the foe's mind off: it stands)
//   node scripts/combo-step.mjs --minds          its mind on: it is shoved by the blows, backs off, closes in (rows vary with it)
//   node scripts/combo-step.mjs --json
//
// tests/combo-step.test.js reads the same rig.
import * as THREE from 'three';
import { reachRig } from './combat-reach.mjs';
import { sample, metaOf } from './motion-qc/sample.mjs';
import { analyse } from './motion-qc/lib.mjs';
import { seeded } from '../src/motion-kit/gait.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), DT = 1 / 60;

/**
 * The three cuts at a `kind` `gap` m off its body straight ahead (null: no foe), `angle` rad off his facing, locked on or
 * not, `stick` (camera-relative { x, y }, or null) held through. The foe's mind is off: it stands where it was put.
 * { steps: [m per cut], gaps: [m off its body as each cut's blade arrived], hits: '111', end: m off its body at the end, path }.
 */
export async function comboAt(rig, kind, o = {}) {
  // (the foes' minds and poses draw on Math.random: a fixed seed a row, so each row is the same every run)
  const random = Math.random;
  Math.random = seeded(o.seed ?? 7);
  try { return await comboRun(rig, kind, o); } finally { Math.random = random; }
}

async function comboRun(rig, kind, { gap = 1.5, angle = 0, locked = false, stick = null, presses = 3, place = null, motion = false, shove = false } = {}) {
  const { p, tool, foes, home, tick } = rig;
  const { allTargets } = await import('../src/targets.js');
  const { FOES } = await import('../src/foes.js');
  const B = tool.blade;
  B.stop(); B.cool = 0; B.chainT = 0; B.buffered = 0; B.queued = false; B.last = -1;
  p.pos.copy(home); p.vel.set(0, 0, 0); p.heading = 0; p.lockOn = null; p.aim = null; p.health = 99;
  for (let i = 0; i < 30; i++) tick({});
  let f = null, T = null, R = 0;
  if (kind) {
    R = FOES[kind].radius;
    const d = R + gap, at = place ?? v(home.x + Math.sin(angle) * d, home.y, home.z + Math.cos(angle) * d);
    f = foes.add(kind, at);
    f.heading = Math.atan2(home.x - at.x, home.z - at.z); f.state = 'idle'; f.provoked = true; f.hp = 999;
    f.fight = { ...f.fight, evade: null }; f.def = { ...f.def, answerMash: null };   // (its own dodges out of a combo are its design, not this)
    for (let i = 0; i < 40; i++) foes.look(f, DT);
    f.model.group.updateMatrixWorld(true);
    T = allTargets().find((t) => t.foe === f);
  }
  const hits = new Set();
  if (T) { const orig = T.onHit; T.onHit = (...a) => { hits.add(B.n); return orig?.(...a); }; }
  rig.setLock(locked ? T : null);
  const lockDir = () => { if (locked && f) p.lockOn = { dir: v(f.pos.x - p.pos.x, 0, f.pos.z - p.pos.z).normalize() }; };
  lockDir();
  const off = () => (f ? Math.hypot(f.pos.x - p.pos.x, f.pos.z - p.pos.z) - (T.reach ?? R) : null);
  const input = (k) => ({ ...(stick ? { stick } : {}), ...(k ? { KeyF: true } : {}) });
  const startAt = [], gaps = [], path = [];
  let closest = Infinity;
  const near = () => { if (f) closest = Math.min(closest, Math.hypot(f.pos.x - p.pos.x, f.pos.z - p.pos.z) - R); };
  let pressed = 1, n = -1;
  const S = [], st = {};
  let t = 0;
  const rec = (tag) => { if (motion) S.push(sample(p, st, { t: (t += DT), dt: DT, tag, stick: stick ? [stick.x, stick.y] : null })); };
  tick(input(true)); rec('press');
  for (let i = 0; i < 300; i++) {
    if (B.n !== n && B.n >= 0) { n = B.n; startAt[n] = p.pos.clone(); }
    if (B.n >= 0 && gaps[B.n] == null && B.phase === 'strike') gaps[B.n] = off();
    const press = pressed < presses && B.swinging && B.n === pressed - 1 && B.phase === 'recover';
    if (press) pressed++;
    lockDir();
    if (f) f.cool = 9;
    tick(input(press));
    if (f && shove) foes.update(DT);
    rec(B.n >= 0 ? `cut ${B.n + 1} ${B.phase}` : 'between');
    path.push(p.pos.clone()); near();
    if (!B.swinging && pressed >= presses && i > 20) break;
  }
  for (let i = 0; i < 20; i++) { tick(input(false)); if (f && shove) foes.update(DT); rec('after'); path.push(p.pos.clone()); near(); }
  const endPos = p.pos.clone();
  const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  // (toward the foe where it first stood, signed: a foe walking into him pushes him back; with none, the flat distance)
  const toward = f ? v(Math.sin(angle), 0, Math.cos(angle)) : null;
  const steps = startAt.map((s, k) => { const b = startAt[k + 1] ?? endPos; return toward ? (b.x - s.x) * toward.x + (b.z - s.z) * toward.z : flat(s, b); });
  const out = { steps, gaps, hits: [0, 1, 2].slice(0, presses).map((k) => (hits.has(k) ? 1 : 0)).join(''), end: off(), total: flat(startAt[0] ?? home, endPos), path, closest: f ? closest : null,
    ...(motion ? { motion: analyse(S, metaOf(p)) } : {}) };
  rig.setLock(null); if (f) foes.remove(f);
  return out;
}

export async function stepTable({ kind = 'grunt', gaps = [0.3, 0.8, 1.2, 1.8, 2.5, 3.2, 4], rig = null, minds = false } = {}) {
  rig ??= await reachRig();
  const rows = [];
  for (const locked of [false, true]) {
    for (const gap of gaps) rows.push({ kind, gap, locked, ...(await comboAt(rig, kind, { gap, locked, motion: true, shove: minds })) });
  }
  rows.push({ kind: null, gap: null, locked: false, ...(await comboAt(rig, null, { motion: true })) });
  rows.push({ kind: null, gap: null, locked: false, stickRight: true, ...(await comboAt(rig, null, { stick: { x: 1, y: 0 }, motion: true })) });
  return rows;
}

const f2 = (x) => (x == null ? '—' : x.toFixed(2));
export const stepMarkdown = (rows) => ['| foe | gap (m) | lock | steps per cut (m) | off its body as each cut lands (m) | closest (m) | hits | foot slide p95 / max (cm) | held (cm) | pops / jolts | worst jolt (cm) |', '|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.kind ?? (r.stickRight ? 'none, stick right' : 'none')} | ${f2(r.gap)} | ${r.locked ? 'yes' : ''} | ${r.steps.map(f2).join(' / ')} | ${r.gaps.map(f2).join(' / ')} | ${f2(r.closest)} | ${r.kind ? r.hits : ''} | ${r.motion ? `${(r.motion.measures.slideP95 * 100).toFixed(1)} / ${(r.motion.measures.slideMax * 100).toFixed(1)}` : ''} | ${r.motion ? (r.motion.measures.held * 100).toFixed(1) : ''} | ${r.motion ? `${r.motion.measures.pops} / ${r.motion.measures.jolts}` : ''} | ${r.motion ? (r.motion.measures.joltMax * 100).toFixed(1) : ''} |`)].join('\n');

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = await stepTable({ minds: process.argv.includes('--minds') });
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows.map(({ path, motion, ...r }) => ({ ...r, motion: motion?.measures })), null, 1));
  else console.log(stepMarkdown(rows));
  process.exit(0);
}
