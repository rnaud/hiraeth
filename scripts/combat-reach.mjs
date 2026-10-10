// The reach table (docs/systems/foes.md, "The body the blade meets"): does a plain swing land on each archetype at a
// typical engagement? The game's traveller (motion capture, the real FluidTool and blade) swings at each archetype's
// real model, posed at rest by the game's own Foes.look, from `gaps` m off its body, at `angles` off his facing, locked
// on or not. Each swing records whether the game registered the hit (onHit) and whether the drawn blade passed through
// the drawn body at all (src/foe-body.js bodyTouch: the "visible" contact), and how far over or under it went.
//
//   node scripts/combat-reach.mjs                      the whole table (markdown), swings 1-3
//   node scripts/combat-reach.mjs crab heron --swings=1 --gaps=1.5 --angles=0
//   node scripts/combat-reach.mjs --json               the rows as JSON
//   node scripts/combat-reach.mjs --legacy             as the blade was before v1.35 (the sphere, no soft aim): the before table
//
// tests/combat-reach.test.js runs the first swing from in front at 1.5 m on every archetype.
import * as THREE from 'three';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), DT = 1 / 60;

/** The rig: a traveller with the blade on the gait course, and a Foes world (models, no minds) to stand foes in. */
export async function reachRig() {
  const { items } = await import('../src/items.js');
  const { FluidTool } = await import('../src/fluid-tool.js');
  const { GameState } = await import('../src/game-state.js');
  const { Foes } = await import('../src/foes.js');
  const { traveller, course, CAM_PLUS_Z } = await import('../tests/gait-sim.js');
  items.grant('backpack');
  const scene = course({ ramp: false, stairs: false });
  const home = v(0, 0, -60);
  const p = await traveller(scene, home, { moves: true, body: 'v1' });
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, -65); camera.lookAt(0, 1, -55); camera.updateMatrixWorld();
  const tool = new FluidTool({ scene, player: p, physics: p.physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
  const flat = { groundAt: () => home.y, rayDistance: () => Infinity, rayHit: () => null };
  const foes = new Foes({ scene, level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: p, tool: null, settings: { enemies: 'normal' }, game: new GameState(null) });
  let lock = null;
  tool.lockOn = () => lock;
  const tick = (input = {}) => { p.update(DT, input, CAM_PLUS_Z); tool.update(DT, input); };
  return { p, tool, foes, home, tick, setLock: (t) => { lock = t; }, scene };
}

/**
 * One swing (`swing` 0..2: the combo's first, second, third) at a foe of `kind` standing `gap` m off its body (its
 * radius) at `angle` rad off the traveller's facing, locked on or not. { hit, touched, over, point }: hit, the game
 * registered it; touched, the drawn blade passed through the drawn body; over, how far (m) the blade's lowest point in
 * front went over the body's top (negative: under the body's bottom; 0: within its span).
 */
export async function swingAt(rig, kind, { gap = 1.5, angle = 0, swing = 0, locked = false, legacy = false } = {}) {
  const { p, tool, foes, home, tick } = rig;
  const { allTargets } = await import('../src/targets.js');
  const { bodyTouch, bodySpan } = await import('../src/foe-body.js');
  const { BLADE, AIM, MAGNET } = await import('../src/fluid-blade.js');
  // (legacy: as before v1.35, to compare: the target's sphere only, no soft aim, the pull through the whole cut)
  const keep = { down: AIM.down, up: AIM.up, arrive: MAGNET.arrive };
  if (legacy) { AIM.down = AIM.up = 0; MAGNET.arrive = 1; }
  const B = tool.blade;
  // a fresh start: standing at home facing +z, the blade put away, nothing swinging
  B.stop(); B.cool = 0; B.chainT = 0; B.buffered = 0; B.queued = false; B.last = -1;
  p.pos.copy(home); p.vel.set(0, 0, 0); p.heading = 0; p.lockOn = null; p.aim = null;
  for (let i = 0; i < 20; i++) tick({});
  const def = (await import('../src/foes.js')).FOES[kind];
  const d = def.radius + gap, at = v(home.x + Math.sin(angle) * d, home.y, home.z + Math.cos(angle) * d);
  const f = foes.add(kind, at);
  f.heading = Math.atan2(home.x - at.x, home.z - at.z);
  f.state = 'idle'; f.provoked = true;
  // posed at rest by the game's own look (no mind: it stands where it was put)
  for (let i = 0; i < 40; i++) foes.look(f, DT);
  f.model.group.updateMatrixWorld(true);
  const T = allTargets().find((t) => t.foe === f);
  let hit = null;
  T.onHit = (mode, point) => { hit ??= point?.clone?.() ?? true; };
  if (legacy) { T.body = null; T.reach = undefined; }
  rig.setLock(locked ? T : null);
  if (locked) p.lockOn = { dir: v(at.x - home.x, 0, at.z - home.z).normalize() };
  // the combo up to `swing`: each press in the chain window of the one before
  let touched = null, low = Infinity, prev = null;
  const span = bodySpan(f.model), foot = def.radius + 0.25, P0 = v();
  tick({ KeyF: true }); tick({});
  for (let i = 0, pressed = 0; i < 160 && (B.swinging || pressed < swing); i++) {
    if (pressed < swing && B.swinging && B.n === pressed && B.phase === 'recover') { pressed++; tick({ KeyF: true }); }
    else tick({});
    if (B.n !== swing) { prev = null; continue; }
    if (locked && p.lockOn) p.lockOn.dir.set(f.pos.x - p.pos.x, 0, f.pos.z - p.pos.z).normalize();
    for (let k = 0; k < 4; k++) foes.look(f, DT / 4);
    f.model.group.updateMatrixWorld(true);
    const seg = B.cutting ? B.bladeSegment() : null;
    if (seg) {
      const c = bodyTouch(f.model, prev ?? seg, seg, BLADE.width / 2);
      if (c && !touched) touched = c.clone();
      // the blade's lowest where it passed over the foe's footprint (its radius and a little): over its top, or short of it
      for (let k = 0; k <= 10; k++) { P0.lerpVectors(seg.a, seg.b, k / 10); if (Math.hypot(P0.x - f.pos.x, P0.z - f.pos.z) <= foot) low = Math.min(low, P0.y - home.y); }
      prev = { a: seg.a.clone(), b: seg.b.clone() };
    } else prev = null;
  }
  for (let i = 0; i < 40 && B.swinging; i++) tick({});
  rig.setLock(null);
  foes.remove(f);
  Object.assign(AIM, { down: keep.down, up: keep.up }); MAGNET.arrive = keep.arrive;
  // (over: how far over the body's top the blade's lowest point over it passed; null: it never came over it, short)
  const top = span.hi - home.y;
  return { hit: !!hit, touched: !!touched, low: Number.isFinite(low) ? low : null, over: Number.isFinite(low) ? Math.max(0, low - top) : null, span: { lo: span.lo - home.y, hi: top } };
}

/** The table: rows per archetype of the swings' results over the gaps and angles. */
export async function reachTable({ kinds = null, swings = [0, 1, 2], gaps = [1, 1.5, 2, 2.5], angles = [0, 0.7, -0.7], locks = [false, true], rig = null, legacy = false } = {}) {
  const { ARCHETYPES } = await import('../src/enemies/archetypes.js');
  rig ??= await reachRig();
  const rows = [];
  for (const [id, A] of Object.entries(ARCHETYPES)) {
    if (A.status !== 'built' || (kinds && !kinds.includes(id) && !kinds.includes(A.kind))) continue;
    const row = { id, kind: A.kind, runs: [] };
    for (const swing of swings) for (const gap of gaps) for (const angle of angles) for (const locked of locks) {
      if (swing > 0 && (angle !== 0 || locked)) continue;   // (the chain's later swings: from in front, unlocked)
      const r = await swingAt(rig, A.kind, { gap, angle, swing, locked, legacy });
      row.runs.push({ swing, gap, angle, locked, ...r });
    }
    row.span = row.runs[0]?.span;
    rows.push(row);
  }
  return rows;
}

/** The table in markdown: per archetype, the misses (of the game's hit test) out of the runs, by swing; and why. */
export function tableMarkdown(rows) {
  const out = ['| archetype | body (m) | swing 1 | swing 2 | swing 3 | locked | angled | misses: over it / short of it | missed, the drawn blade through its drawn body | hit, the drawn blade not on its drawn body |', '|---|---|---|---|---|---|---|---|---|---|'];
  const frac = (runs) => (runs.length ? `${runs.filter((r) => !r.hit).length}/${runs.length}` : '–');
  for (const R of rows) {
    const by = (f) => R.runs.filter(f);
    const unfair = by((r) => r.touched && !r.hit).length, ghost = by((r) => r.hit && !r.touched).length;
    const missed = by((r) => !r.hit), over = missed.filter((r) => r.over > 0).length, short = missed.filter((r) => r.low == null).length;
    out.push(`| ${R.id} | ${R.span ? `${R.span.lo.toFixed(2)}–${R.span.hi.toFixed(2)}` : '?'} | ${frac(by((r) => r.swing === 0))} | ${frac(by((r) => r.swing === 1))} | ${frac(by((r) => r.swing === 2))} | ${frac(by((r) => r.locked))} | ${frac(by((r) => r.angle !== 0))} | ${over} / ${short} | ${unfair} | ${ghost} |`);
  }
  const all = rows.flatMap((R) => R.runs);
  const miss = all.filter((r) => !r.hit);
  out.push(`| **all** | | ${frac(all.filter((r) => r.swing === 0))} | ${frac(all.filter((r) => r.swing === 1))} | ${frac(all.filter((r) => r.swing === 2))} | ${frac(all.filter((r) => r.locked))} | ${frac(all.filter((r) => r.angle !== 0))} | ${miss.filter((r) => r.over > 0).length} / ${miss.filter((r) => r.low == null).length} | ${all.filter((r) => r.touched && !r.hit).length} | ${all.filter((r) => r.hit && !r.touched).length} |`);
  return out.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
  const list = (k, d) => (opt(k) ? opt(k).split(',').map(Number) : d);
  const kinds = args.filter((a) => !a.startsWith('--'));
  const rows = await reachTable({ kinds: kinds.length ? kinds : null, swings: list('swings', [1, 2, 3]).map((n) => n - 1), gaps: list('gaps', [1, 1.5, 2, 2.5]), angles: list('angles', [0, 0.7, -0.7]), legacy: args.includes('--legacy') });
  if (args.includes('--json')) console.log(JSON.stringify(rows, null, 1));
  else console.log(tableMarkdown(rows));
  process.exit(0);
}
