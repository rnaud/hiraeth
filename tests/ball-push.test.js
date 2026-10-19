// The push and the balls (issue #522: "the push gun should be stronger so I don't have to push balls so many times").
// Every ball of every temple pushed with the fluid gun (not the hand-rolled, the sword's, the magnet's iron moons or the
// cable-rail's) is rolled along its puzzle's way, from its start to each plate its puzzle wants it on, by a player who
// stands just behind it and, each time it rolls past its plate, steps a metre further back to push it softer: it comes
// to rest on the plate, it never drops through a hole that isn't its own way, and the long rolls take clearly fewer
// pushes than with the push as it was (BALL_PUSH 4.2 + 4.5 × strength).
import test from 'node:test';
import assert from 'node:assert/strict';
import './register-gadgets.js';
import { TEMPLES } from '../src/temples/index.js';
import { Ball, BALL_PUSH, END_BOUNCE } from '../src/temples/pieces.js';
import { templeWorld, wantedOn } from '../scripts/ball-room.mjs';

const OLD = { base: 4.2, per: 4.5 };
const DT = 1 / 60, REACH = 6;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };

/** The pushed balls of temple `id`, each with the plates its puzzle wants it on ([plate, t]). */
function pushedBalls(rt) {
  const L = rt.logic, conds = [...Object.values(L.def.elements), ...rt.pieces.map((q) => q.o?.when).filter(Boolean)];
  const out = [];
  for (const b of rt.pieces) {
    if (!(b instanceof Ball)) continue;
    const e = L.el(b.id);
    if (!e || e.roll === 'hand' || e.roll === 'sword' || b.o.heavy === 'magnet' || (e.needs ?? []).includes('tether')) continue;
    const want = wantedOn(b.id, conds), targets = [];
    if (e.stops) for (const [p, t] of Object.entries(e.stops)) if (!want.size || want.has(p)) targets.push([p, t]);
    if (e.plate && !(e.stops && e.plate in e.stops)) targets.push([e.plate, e.plateAt ?? 1]);
    out.push({ b, e, targets: targets.filter(([, t]) => Math.abs(t - (e.start ?? 0)) > 1e-3) });
  }
  return out;
}

/** Rolled from its start onto the plate at `at`: { pushes, home, fell, overs }. */
function roll(rt, b, e, at, push) {
  const L = rt.logic, start = e.start ?? 0, tol = e.tolerance ?? 0.06;
  Object.assign(BALL_PUSH, push);
  b.t = start; b.v = 0; b.rest = true; b.place(); L.moveDrum(b.id, start);
  const own = !!b.o.hole && at >= 1 - 1e-6;   // (its hole is its way: the Footprint's Sounding Toe)
  let pushes = 0, overs = 0, stand = 1.0, fell = false;
  while (Math.abs(b.t - at) > tol && pushes < 30 && !fell) {
    const sgn = Math.sign(at - b.t) || 1, strength = Math.max(0, 1 - (b.r + stand) / REACH);
    b.hit('push', b.dir.clone().multiplyScalar(sgn), { strength }); pushes++;
    for (let i = 0; i < 60 * 20 && !b.rest && !b.fell; i++) quiet(() => b.update(DT, i * DT));
    fell = !!(b.fell || b.drop || b.falling2);
    if ((at - b.t) * sgn < -tol) { overs++; stand = Math.min(REACH - b.r - 0.4, stand + 1); }
  }
  const home = own ? !!b.fell : Math.abs(b.t - at) <= tol;
  b.fell = false; b.falling2 = null; b.drop = null;
  return { pushes, home, fell: fell && !own, overs };
}

test('every pushed ball still comes to rest on each plate its puzzle wants, never through a hole that isn’t its way, in about half the pushes on a long roll', () => {
  const was = { ...BALL_PUSH };
  assert.ok(BALL_PUSH.base + BALL_PUSH.per * 0.65 > 1.6 * (OLD.base + OLD.per * 0.65), 'a push from close behind sends it 1.6 times as fast or more');
  assert.ok(BALL_PUSH.base < 1.2 * OLD.base + 0.5, 'the softest push, from the far end of the reach, about as soft as it was');
  assert.ok(END_BOUNCE <= 0.25 * (OLD.base + OLD.per) + 0.05, 'off the groove’s end no harder than the hardest old push came back');
  const rows = [];
  try {
    for (const id of Object.keys(TEMPLES)) {
      const { rt } = quiet(() => templeWorld(id));
      for (const { b, e, targets } of pushedBalls(rt)) {
        if (b.o.jaws) { const j = rt.piece(b.o.jaws.id); if (j) j.open = true; }   // (stilled: it rolls through)
        b.o.current = null;   // (the pool stilled)
        for (const [plate, at] of targets) {
          const before = roll(rt, b, e, at, OLD), after = roll(rt, b, e, at, was);
          rows.push({ name: `${id}.${b.id} → ${plate} (${(Math.abs(at - (e.start ?? 0)) * b.len).toFixed(1)} m)`, before, after });
        }
      }
      quiet(() => rt.dispose?.());
    }
  } finally { Object.assign(BALL_PUSH, was); }
  assert.ok(rows.length >= 40, `${rows.length} rolls`);
  for (const { name, after } of rows) {
    assert.ok(after.home, `${name}: on its plate (${after.pushes} pushes)`);
    assert.ok(!after.fell, `${name}: never dropped through a hole on the way`);
    assert.ok(after.pushes <= 6, `${name}: ${after.pushes} pushes`);
    assert.ok(after.overs <= 3, `${name}: past its plate ${after.overs} times`);   // (a short hop to a stop mid-groove: the Clock-House's first hour, 3.7 m, eased on from further back)
  }
  if (process.env.BALL_PUSH_TABLE) for (const r of rows) console.log(`${r.name}: ${r.before.pushes} → ${r.after.pushes} (past it ${r.before.overs} → ${r.after.overs})`);
  const long = rows.filter((r) => r.before.pushes >= 2);
  const sum = (k) => long.reduce((a, r) => a + r[k].pushes, 0);
  assert.ok(sum('after') <= 0.7 * sum('before'), `the rolls that took two pushes or more: ${sum('before')} pushes before, ${sum('after')} now`);
});
