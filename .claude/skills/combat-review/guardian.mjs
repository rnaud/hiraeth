// The combat review's guardian fight, played in node (.claude/skills/combat-review/SKILL.md, "Guardians, played"):
// each guardian in its own temple (src/temples/<world>.js through the level that holds it: the real def, its temple's
// hooks, its real body; the Arena's ring when its temple can't be built here), a scripted traveller in three manners,
// every phase in turn, and what the fight's own code says:
//
//   pace        moves begun a minute (a combo is one), strikes a minute, hearts a minute a still player loses
//   telegraphs  each move's wind-up as played (begin to strike, s), the shortest own move and the shortest link
//   recovery    after each strike, the s before its next wind-up begins (or before it opens): when you can act
//   openings    a minute and their s, per manner: 'still' (takes every blow), 'dodge' (clear of every blow: a jump or a
//               hop as it lands), 'guard' (the shield up at every blow); a phase with none of its own for a player who
//               dodges or guards is a failure (issue #316: the Keeper's last phase had none)
//   hitboxes    each move at its strike: the floor its hit takes (Guardian.wouldHit when the game has it, else the
//               area: inArea at points()) against the floor its body actually sweeps over (its skinned vertices, or
//               its meshes, over the strike's first 0.3 s, a traveller's column 1.9 m high, 0.45 m round): the share hit
//               far (> 1 m) from the body ("phantom"), the share touched and not hit, the furthest hit from the body
//   lock point  where the lock-on aims (src/foes.js GuardianLock.chest) against its weak point (model.mouth): m apart
//   shadow      every drawn mesh of its body casts in the shadow passes (not self-lit, not opted out, not hidden), and
//               it has a contact shadow on the floor (boss.js GroundShadow: a temple's hall gets no sun)
//   sidestep    the traveller's own (the game's Player on tests/gait-sim.js's flat course, a foe 7 m off, locked on): how
//               far a 2 s strafe each way and a side hop carry him off the foe (issue #314: 1.6 m; a fail past 0.25 m)
//
//   node .claude/skills/combat-review/guardian.mjs <out-dir> [--ids desert,incal | all] [--secs 90] [--grid 0.5]
// Writes <out-dir>/guardians.json and guardians.md; exits 1 if a check fails (FAIL lines), with --strict.
import fs from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(ROOT, '.local-tools/guardian-fight'));
const SECS = +arg('secs', 90), GRID = +arg('grid', 0.5), DT = 1 / 60;
fs.mkdirSync(OUT, { recursive: true });

// (the game loads its skins by URL: here from public/, without textures: node has no image decoder)
globalThis.ProgressEvent ??= class { constructor(type, v) { this.type = type; Object.assign(this, v); } };
const PUBLIC = new URL('../../../public/', import.meta.url);
GLTFLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  try {
    const bytes = fs.readFileSync(new URL(String(url).replace(/^\/+/, ''), PUBLIC)), len = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + len));
    for (const m of json.meshes) for (const p of m.primitives) delete p.material;
    delete json.materials; delete json.textures; delete json.images;
    json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + len).toString('base64');
    this.parse(JSON.stringify(json), '', onLoad, onError);
  } catch (e) { onError?.(e); }
};
const quiet = async (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return await fn(); } finally { console.warn = w; console.log = l; } };

await import(join(ROOT, 'tests/register-gadgets.js'));
const { Guardian, inArea, comboOf, windOf } = await import(join(ROOT, 'src/temples/boss.js'));
const { GUARDIANS } = await import(join(ROOT, 'src/arena-guardians.js'));
const { templeOf, templeWorld } = await import(join(ROOT, 'src/temples/index.js'));
const { buildableById } = await import(join(ROOT, 'src/levels/buildable.js'));
const { Physics } = await import(join(ROOT, 'src/physics.js'));
const { guardianLock } = await import(join(ROOT, 'src/foes.js'));
const { selfLitSkips } = await import(join(ROOT, 'src/shadows.js'));
const L = await import(join(ROOT, 'scripts/combat-review/lib.mjs'));

/** The limits the report holds each guardian to (the first one, the Keeper, a little kinder: `first`). */
export const LIMITS = { wind: 0.8, link: 0.6, recover: 0.8, chain: 1.2, phantom: 0.15, far: 1.5, lock: 0.6, openings: 1, sidestep: 0.25 };

/** The traveller's sidestep locked on: m gained from the foe by a 2 s strafe right, left, and a side hop (and landing). */
async function sidestep() {
  const { traveller, course, CAM_PLUS_Z } = await import(join(ROOT, 'tests/gait-sim.js'));
  const { items } = await import(join(ROOT, 'src/items.js'));
  items.grant('backpack');
  const p = await quiet(() => traveller(course({ ramp: false, stairs: false }), V(0, 0, -60), { moves: true, body: 'v1' }));
  const foe = V(0, 0, -53), d = () => Math.hypot(foe.x - p.pos.x, foe.z - p.pos.z);
  const step = (keys = {}) => { p.lockOn = { dir: V(foe.x - p.pos.x, 0, foe.z - p.pos.z).normalize(), at: foe }; p.update(DT, keys, CAM_PLUS_Z); };
  for (let i = 0; i < 60; i++) step();
  const out = {};
  for (const [k, keys] of [['strafeRight', { KeyD: true }], ['strafeLeft', { KeyA: true }]]) { const d0 = d(); for (let i = 0; i < 2 / DT; i++) step(keys); out[k] = +(d() - d0).toFixed(2); }
  for (let i = 0; i < 30; i++) step();
  const d0 = d();
  for (let i = 0; i < 3; i++) step({ KeyD: true });
  step({ KeyD: true, Space: true });
  out.hopped = p.hopping?.kind ?? null;
  for (let i = 0; i < 50 && !p.onGround; i++) step({ KeyD: true });
  for (let i = 0; i < 20; i++) step();
  out.sideHop = +(d() - d0).toFixed(2);
  return out;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** The guardian in its temple (the real def and hooks), or in the Arena's ring (its sparring rule) if that can't be built. */
async function stage(G) {
  const P = { pos: V(), heading: 0, vel: V(), dead: false, down: null, hearts: 3, maxHearts: 3, health: 1, hurts: [], knocks: 0,
    hurt(d) { this.hurts.push(d); }, knockDown() { this.knocks++; }, guard: null, untouchable: null };
  try {
    const scene = new THREE.Scene();
    const level = await quiet(() => buildableById(templeWorld(G.id)).create(scene));
    const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
    level.init?.(physics);
    const rt = templeOf(level, G.id);
    if (!rt?.guardian) throw new Error('no guardian in its temple');
    await quiet(async () => { rt.connect({ player: P }); await rt.guardian.model.ready; });
    return { g: rt.guardian, P, where: 'temple', rt, scene };
  } catch (e) {
    const rt = { def: { id: `arena-${G.id}` }, root: new THREE.Group(), logic: { resolved: false }, physics: { groundAt: () => 0 }, player: P, notice() {}, rumble() {} };
    const model = G.model();
    model.pos.set(0, 0, 9); model.home = model.pos.clone(); model.heading = Math.PI;
    rt.root.add(model.group);
    const g = new Guardian(rt, { def: G.def, model, arena: { center: V(), r: 20, y: 0 } });
    await model.ready;
    return { g, P, where: `ring (${String(e.message ?? e).slice(0, 60)})`, rt };
  }
}

/** The body's drawn points (world), posed now: skinned vertices (every `step`th), else each mesh's vertices. */
function bodyPoints(model, step = 7) {
  const out = [], v = V();
  model.group.updateMatrixWorld(true);
  model.group.traverse((o) => {
    if (!o.isMesh || !o.visible || o.userData.noBody) return;
    const p = o.geometry?.attributes?.position;
    if (!p || /glyph|marks|tele|glow/i.test(o.name)) return;
    if (o.isSkinnedMesh) { o.skeleton.update(); for (let i = 0; i < p.count; i += step) out.push(o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld).clone()); }
    else for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 900))) out.push(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).clone());
  });
  return out;
}

/** Its drawn blow's points (world) now (boss.js Blast: a beam's cylinder, a front's bands), every vertex: what it is drawn as. */
function blowPoints(g) {
  const out = [], v = V();
  for (const o of g.blast?.meshes?.() ?? []) {
    o.updateMatrixWorld(true);
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) out.push(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).clone());
  }
  return out;
}

/** The game's own test of a strike reaching a traveller standing at p (Guardian.wouldHit, else its area). */
const reaches = (g, a, p) => (g.wouldHit ? g.wouldHit(a, p) : g.points(a).some((o) => inArea(a, o, g.attackH, p)));

/** One phase, played SECS s in one manner: events, openings, recovery. */
function playPhase(S, i, manner) {
  const { g, P } = S, A = g.arena, def = g.def;
  g.reset?.(); g.stop(); g.clearWaves?.();
  const lo = i > 0 ? def.phases[i - 1].to : 0;
  g.meter = g.floor = lo; g.answered = new Set([i]);   // (its second verb taken as answered: the phase as it plays after)
  g.enter('fight'); g.cool = 1;
  P.pos.set(A.center.x, A.y, A.center.z); P.hurts = []; P.knocks = 0;
  // (in front of it, 6 m off its body's edge: where a player fights it from)
  const h = g.model.heading, off = (g.model.radius ?? 2.6) + 6;
  P.pos.set(g.model.pos.x + Math.sin(h) * off, A.y, g.model.pos.z + Math.cos(h) * off);
  P.guard = manner === 'guard' ? () => true : null;
  // the dodger is clear of every blow: in the air as each lands (a hop's height), and over every wave
  const strike = g.strike.bind(g);
  g.strike = (a, PP) => { if (manner !== 'dodge') return strike(a, PP); const y = PP.pos.y; PP.pos.y = A.y + 6; const r = strike(a, PP); PP.pos.y = y; return r; };
  const ev = { begins: [], strikes: [], opens: [], winds: {}, links: {}, recover: [], chain: [] };
  let t = 0, prevAttack = null, openAt = null, lastStrike = null, prevState = g.state, beganAt = 0;
  for (let f = 0; f < SECS / DT; f++) {
    const was = g.attack, struck = g.struck;
    // (clear of the blow through its whole active window: a body blow lands over its first s, Guardian.live)
    if (manner === 'dodge') P.pos.y = A.y + (g.waves?.length || (g.attack && g.struck && g.at - g.windFor < 0.6) ? 6 : 0);
    g.update(DT, (t += DT));
    if (g.phaseIndex !== i) { g.meter = g.floor = lo; if (g.state === 'shift' || g.state === 'weary') g.enter('fight'); }
    P.down = null; P.dead = false;
    if (g.attack && g.attack !== was) {
      const a = g.attack, link = !!def.attacks[a.id]?.link || (was && was.then === a.id);
      if (!link) ev.begins.push({ t, id: a.id });
      // (a combo's next link is its chain: timed strike to strike below; anything else is the recovery)
      if (lastStrike !== null && !link) { ev.recover.push({ after: lastStrike.id, s: +(t - lastStrike.t).toFixed(2), next: a.id, opened: !!lastStrike.opened }); lastStrike = null; }
      if (link && lastStrike !== null) lastStrike = { ...lastStrike, chained: a.id };
      beganAt = t;
    }
    if (g.attack && g.struck && !struck) {
      ev.strikes.push({ t, id: g.attack.id }); (link(def, g.attack.id) ? ev.links : ev.winds)[g.attack.id] = +(t - beganAt).toFixed(2);
      if (lastStrike?.chained === g.attack.id) ev.chain.push({ after: lastStrike.id, s: +(t - lastStrike.t).toFixed(2), next: g.attack.id });
      lastStrike = { t, id: g.attack.id };
    }
    if (g.state === 'open' && prevState !== 'open') { openAt = t; if (lastStrike !== null) lastStrike = { ...lastStrike, opened: true }; }
    if (g.state !== 'open' && prevState === 'open' && openAt !== null) { ev.opens.push(+(t - openAt).toFixed(2)); openAt = null; }
    prevState = g.state; prevAttack = g.attack;
  }
  g.strike = strike;
  const min = SECS / 60;
  return {
    manner, movesPerMin: +(ev.begins.length / min).toFixed(1), strikesPerMin: +(ev.strikes.length / min).toFixed(1),
    heartsPerMin: +(P.hurts.reduce((s, d) => s + d, 0) / min).toFixed(2), knocksPerMin: +(P.knocks / min).toFixed(1),
    opensPerMin: +(ev.opens.length / min).toFixed(1), openSecsPerMin: +(ev.opens.reduce((s, d) => s + d, 0) / min).toFixed(1),
    openMin: ev.opens.length ? Math.min(...ev.opens) : 0, recoverMin: ev.recover.length ? Math.min(...ev.recover.map((r) => r.s)) : null,
    recoverMedian: L.median(ev.recover.map((r) => r.s)), chainMin: ev.chain.length ? Math.min(...ev.chain.map((r) => r.s)) : null, recoverLog: ev.recover.slice(0, 12), winds: ev.winds, links: ev.links, moves: [...new Set(ev.begins.map((b) => b.id))],
  };
}
const link = (def, id) => !!def.attacks[id]?.link;

/** Each move at its strike: the floor its hit takes against the floor its body sweeps over. */
function hitboxes(S) {
  const { g, P } = S, A = g.arena, def = g.def, rows = [];
  for (const [id, a0] of Object.entries(def.attacks)) {
    if (a0.lob) { rows.push({ id, lob: true }); continue; }
    g.reset?.(); g.stop(); g.enter('fight'); g.meter = g.floor = 0; g.answered = new Set([0, 1, 2, 3]);
    // (on its hall's floor, where it fights: its home may be a perch over it, the Elder's)
    if (!g.model.rooted) g.model.pos.set(A.center.x, A.y, A.center.z);
    const h = g.model.heading, off = (g.model.radius ?? 2.6) + 3;
    P.pos.set(g.model.pos.x + Math.sin(h) * off, A.y + 50, g.model.pos.z + Math.cos(h) * off);   // (out of its way: nothing lands)
    let t = 100;
    for (let f = 0; f < 30; f++) g.update(DT, (t += DT));
    // (here no floor holds it up: a body that hung in the air in its last phase stays up there without this)
    if (!g.model.floats) g.model.pos.y = A.y;
    g.stop(); g.cool = 99; g.begin(P, null, id);
    g.attackAt.set(g.model.pos.x + Math.sin(g.model.heading) * off, A.y, g.model.pos.z + Math.cos(g.model.heading) * off);
    const zone = new Map(), body = new Set(), cell = (x, z) => `${Math.round(x / GRID)},${Math.round(z / GRID)}`, c = g.model.pos.clone();
    const R = 16;
    let hitAny = false, frames = 0;
    while (g.attack?.id === id && frames++ < 600) {
      const wasStruck = g.struck;
      g.update(DT, (t += DT));
      if (!g.attack || g.attack.id !== id) break;
      if (g.struck) {
        const since = g.at - g.windFor;
        if (!wasStruck || g.live) {
          // the game's test, at every cell of the floor round it (a traveller standing there, on the floor)
          for (let x = -R; x <= R; x += GRID) for (let z = -R; z <= R; z += GRID) {
            const p = V(c.x + x, A.y, c.z + z);
            if (reaches(g, g.attack, p)) { zone.set(cell(p.x, p.z), p); hitAny = true; }
          }
        }
        // (what it strikes with: its posed body, and what it draws of its blow: v1.70, a beam, a front)
        if (since < (g.live?.for ?? g.attack.active ?? 0.3)) for (const q of [...bodyPoints(g.model), ...blowPoints(g)]) {
          if (q.y - A.y > 1.9 + 0.3 || q.y - A.y < -1) continue;
          for (let dx = -0.45; dx <= 0.45; dx += GRID) for (let dz = -0.45; dz <= 0.45; dz += GRID) body.add(cell(q.x + dx, q.z + dz));
        }
        if (since > Math.max(0.35, (g.live?.for ?? g.attack.active ?? 0) + 0.05) && !g.live) break;
      }
    }
    const pts = [...zone.values()], bodyCells = [...body].map((k) => k.split(',').map((n) => +n * GRID));
    const nearBody = (p) => { let best = Infinity; for (const [x, z] of bodyCells) best = Math.min(best, Math.hypot(p.x - x, p.z - z)); return best; };
    const far = pts.map(nearBody), phantom = far.filter((d) => d > 1).length;
    const touchedNotHit = [...body].filter((k) => !zone.has(k)).length;
    rows.push({ id, hitM2: +(pts.length * GRID * GRID).toFixed(1), bodyM2: +(body.size * GRID * GRID).toFixed(1), phantom: pts.length ? +(phantom / pts.length).toFixed(2) : 0,
      missed: body.size ? +(touchedNotHit / body.size).toFixed(2) : 0, farthest: far.length ? (bodyCells.length ? +Math.max(...far).toFixed(1) : `${R}+ (no body at his height)`) : 0, reach: pts.length ? +Math.max(...pts.map((p) => Math.hypot(p.x - c.x, p.z - c.z))).toFixed(1) : 0, hit: hitAny });
  }
  return rows;
}

/** The lock-on's aim against the weak point, and the body's meshes in the shadow passes. */
function lockAndShadow(S) {
  const { g } = S;
  g.enter('fight');
  g.update(DT, 200);
  const Lk = guardianLock(g), at = (Lk.aim ?? Lk.chest).clone(), mouth = g.model.mouth.clone();
  const meshes = [];
  g.model.group.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
  const drawn = meshes.filter((o) => !/glyph|marks/i.test(o.name));
  // (the sun's passes draw every mesh not self-lit and not opted out, src/shadows.js selfLitSkips; indoors, where no sun
  // reaches (the Rose House's cistern is lit by its braziers), only its contact shadow grounds it: Guardian.ground)
  const casting = drawn.filter((o) => !selfLitSkips(o) && o.material?.allowOverride !== false && o.userData.castShadow !== false);
  const skinned = drawn.filter((o) => o.isSkinnedMesh), G = g.ground, dark = drawn.filter((o) => !casting.includes(o)).map((o) => o.name || o.parent?.name || '(unnamed)');
  const contact = !!G?.group?.parent && G.group.visible && !!G.spots?.some((x) => x.visible);
  return { lockToMouth: +at.distanceTo(mouth).toFixed(2), lockY: +(at.y - g.arena.y).toFixed(2), mouthY: +(mouth.y - g.arena.y).toFixed(2), mouthR: g.model.mouthR ?? 1.2,
    meshes: drawn.length, casting: casting.length, dark, skinned: skinned.length, skinnedCasting: skinned.filter((o) => casting.includes(o)).length, contact, contactSpots: G?.spots?.filter((x) => x.visible).length ?? 0 };
}

// (--ids all: every guardian, in the order the temples are met)
const ids = arg('ids', 'desert') === 'all' ? GUARDIANS.map((G) => G.id) : arg('ids', 'desert').split(',');
const out = [];
for (const id of ids) {
  const G = GUARDIANS.find((x) => x.id === id);
  if (!G) { console.log(`no guardian ${id}`); continue; }
  const S = await stage(G);
  const phases = S.g.def.phases.filter((p) => !p.weary);
  const play = phases.map((p, i) => ({ phase: i + 1, moves: p.attacks, manners: ['still', 'dodge', 'guard'].map((m) => playPhase(S, i, m)) }));
  const hb = hitboxes(S);
  const ls = lockAndShadow(S);
  const own = Object.entries(S.g.def.attacks).filter(([, a]) => !a.link).map(([k, a]) => [k, windOf(a)]), links = Object.entries(S.g.def.attacks).filter(([, a]) => a.link).map(([k, a]) => [k, windOf(a)]);
  const fails = [];
  for (const [k, w] of own) if (w < LIMITS.wind) fails.push(`${k}: a wind-up of ${w.toFixed(2)} s (< ${LIMITS.wind})`);
  for (const [k, w] of links) if (w < LIMITS.link) fails.push(`${k}: a link of ${w.toFixed(2)} s (< ${LIMITS.link})`);
  for (const P of play) {
    const best = Math.max(...P.manners.filter((m) => m.manner !== 'still').map((m) => m.opensPerMin));
    if (best < LIMITS.openings) fails.push(`phase ${P.phase}: ${best} openings a minute for a player who dodges or guards (< ${LIMITS.openings})`);
    for (const m of P.manners) if (m.recoverMin !== null && m.recoverMin < LIMITS.recover) fails.push(`phase ${P.phase} (${m.manner}): ${m.recoverMin} s from a strike to its next move's wind-up (< ${LIMITS.recover})`);
    for (const m of P.manners) if (m.chainMin !== null && m.chainMin < LIMITS.chain) fails.push(`phase ${P.phase} (${m.manner}): a combo's next blow ${m.chainMin} s after the last (< ${LIMITS.chain})`);
  }
  for (const r of hb) if (!r.lob && r.hit && (r.phantom > LIMITS.phantom || r.farthest > LIMITS.far)) fails.push(`${r.id}: its hit takes ${Math.round(r.phantom * 100)} % of its floor more than 1 m from its body, up to ${r.farthest} m`);
  if (ls.lockToMouth > LIMITS.lock) fails.push(`the lock aims ${ls.lockToMouth} m from its weak point (its mouth)`);
  if (ls.casting < ls.meshes) fails.push(`${ls.meshes - ls.casting} of its ${ls.meshes} meshes cast no shadow (${ls.dark.join(', ')})`);
  if (!ls.contact) fails.push('no contact shadow on the floor under it (indoors, out of the sun, nothing grounds it)');
  out.push({ id, name: G.name, where: S.where, winds: Object.fromEntries(own), links: Object.fromEntries(links), play, hitboxes: hb, lock: ls, fails });
  S.rt?.dispose?.();
  console.log(`${G.name} (${S.where}): ${fails.length ? fails.map((f) => `\n  FAIL ${f}`).join('') : 'ok'}`);
}

const side = await sidestep().catch((e) => ({ error: String(e?.message ?? e).slice(0, 120) }));
const sideFails = side.error ? [`the sidestep could not be measured: ${side.error}`] : Object.entries(side).filter(([k, v]) => typeof v === 'number' && Math.abs(v) > LIMITS.sidestep).map(([k, v]) => `the traveller's ${k} carries him ${v} m off a locked foe (> ${LIMITS.sidestep})`);
if (!side.error && side.hopped == null) sideFails.push('locked on, a jump with a side held is no side hop');
console.log(`the traveller's sidestep: ${JSON.stringify(side)}${sideFails.map((f) => `\n  FAIL ${f}`).join('')}`);
const md = [];
for (const G of out) {
  md.push(`## ${G.name} (${G.where})`, '');
  md.push(L.table(['phase', 'manner', 'moves/min', 'strikes/min', 'hearts/min', 'openings/min', 'open s/min', 'shortest opening (s)', 'strike → next move (min / median s)', 'combo blow to blow (min s)'],
    G.play.flatMap((P) => P.manners.map((m) => [P.phase, m.manner, m.movesPerMin, m.strikesPerMin, m.heartsPerMin, m.opensPerMin, m.openSecsPerMin, m.openMin || '-', `${m.recoverMin ?? '-'} / ${m.recoverMedian ?? '-'}`, m.chainMin ?? '-']))), '');
  md.push(L.table(['move', 'wind (s)'], [...Object.entries(G.winds).map(([k, w]) => [k, w.toFixed(2)]), ...Object.entries(G.links).map(([k, w]) => [`${k} (link)`, w.toFixed(2)])]), '');
  md.push(L.table(['move', 'hit floor (m²)', 'body swept (m²)', 'hit > 1 m from body', 'body not hit', 'farthest hit from body (m)', 'reach from centre (m)'],
    G.hitboxes.map((r) => (r.lob ? [r.id, 'lobbed: its landing marks', '', '', '', '', ''] : [r.id, r.hitM2, r.bodyM2, `${Math.round(r.phantom * 100)} %`, `${Math.round(r.missed * 100)} %`, r.farthest, r.reach]))), '');
  md.push(`Lock point ${G.lock.lockToMouth} m from its mouth (lock at ${G.lock.lockY} m up, mouth at ${G.lock.mouthY} m, its hit sphere ${G.lock.mouthR} m); ${G.lock.casting} of ${G.lock.meshes} meshes cast a shadow (${G.lock.skinnedCasting} of ${G.lock.skinned} skinned); contact shadow ${G.lock.contact ? `on the floor (${G.lock.contactSpots} spots)` : 'none'}.`, '');
  md.push(G.fails.length ? G.fails.map((f) => `- FAIL ${f}`).join('\n') : '- every check passes', '');
}
md.push('## The traveller’s sidestep, locked on', '', `m gained from the foe (7 m off): ${Object.entries(side).map(([k, v]) => `${k} ${v}`).join(', ')}`, '', sideFails.length ? sideFails.map((f) => `- FAIL ${f}`).join('\n') : '- every check passes', '');
fs.writeFileSync(join(OUT, 'guardians.json'), JSON.stringify({ guardians: out, sidestep: side, sideFails }, null, 2));
fs.writeFileSync(join(OUT, 'guardians.md'), md.join('\n'));
console.log(`wrote ${join(OUT, 'guardians.md')}`);
if (args.includes('--strict') && (out.some((G) => G.fails.length) || sideFails.length)) process.exit(1);
process.exit(0);
