// The City-Shaft's red stair (src/levels/incal.js STAIR): the drone's first find, Nima, sweeps the high
// terrace 50 m under the rim. She is reached on foot now, down a stair cut into the shaft's wall, and the
// wings' way down still lands by her.
import test from 'node:test';
import assert from 'node:assert/strict';

const A = await import('./playthrough-agent.js');
const { STAIR } = await import('../src/levels/incal.js');
const { V } = A;
const W = A.loadWorld('incal');
const S = W.level.shaft, stair = S.places.stair;
const nima = W.quests.resolve('nima').clone();

/** A real traveller (no jets, no wings) walking from waypoint to waypoint: where does he end, and how low did he get? */
function walk(points, { from = points[0] } = {}) {
  const P = new A.Player(W.physics, { health: false, climb: false });
  P.has = () => false;
  P.respawn(from.clone().add(V(0, 0.2, 0)));
  let low = Infinity, stuck = 0;
  for (const to of points) {
    for (let i = 0; i < 60 * 40 && A.flat(P.pos, to) > 0.9; i++) {
      const heading = Math.atan2(to.x - P.pos.x, to.z - P.pos.z);
      const was = P.pos.clone();
      P.heading = heading;
      P.update(1 / 60, { KeyW: true }, heading + Math.PI);
      if (P.onGround) low = Math.min(low, P.pos.y - to.y);
      if (P.pos.distanceTo(was) < 0.002) stuck++;
    }
  }
  return { at: P.pos.clone(), onGround: P.onGround, low, stuck };
}

test('the red stair: from the ship to Nima on foot, and back up', () => {
  assert.ok(A.walkTo(W, W.level.spawn, nima).ok, 'a walk from the ship reaches Nima');
  assert.ok(A.walkTo(W, nima, W.level.spawn).ok, 'and comes back up to the ship');
});

test('the red stair: a traveller walks down every flight to Nima, and back up', () => {
  // (from the ship round the rim's parapet to the gate, then down)
  const round = V(Math.cos(0.25) * (S.R + 14), S.TOP, Math.sin(0.25) * (S.R + 14));
  const down = walk([round, ...stair.path, nima], { from: W.level.spawn.clone() });
  assert.ok(down.onGround && Math.abs(down.at.y - nima.y) < 0.5, `he ends on the terrace (y ${down.at.y.toFixed(1)})`);
  assert.ok(A.flat(down.at, nima) < 2, `beside Nima (${A.flat(down.at, nima).toFixed(1)} m)`);
  assert.ok(down.low > -1, 'never below the step he was heading for: no fall');
  const up = walk([...stair.path].reverse(), { from: nima });
  assert.ok(up.onGround && Math.abs(up.at.y - S.TOP) < 0.5 && A.flat(up.at, stair.top) < 2, `back on the rim (y ${up.at.y.toFixed(1)})`);
});

test('the red stair: headroom all the way, ground under every step, readable from the rim', () => {
  for (let i = 1; i < stair.path.length; i++) {
    const a = stair.path[i - 1], b = stair.path[i];
    const m = Math.ceil(a.distanceTo(b) / 0.5);
    for (let j = 0; j <= m; j++) {
      const p = a.clone().lerp(b, j / m);
      const g = W.physics.groundAt(p.x, p.y + 1.5, p.z, 3);
      assert.ok(Number.isFinite(g) && Math.abs(g - p.y) < 0.6, `ground under the way at ${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)}`);
      assert.ok(W.physics.rayDistance(V(p.x, g + 0.3, p.z), V(0, 1, 0), 3) >= 3, `headroom at ${p.x.toFixed(0)}, ${g.toFixed(1)}, ${p.z.toFixed(0)}`);
    }
  }
  const seen = (from, to) => { const d = from.distanceTo(to); return W.physics.rayDistance(from, to.clone().sub(from).normalize(), d) > d - 0.5; };
  // the gate stands up over the rim where the stair starts: seen from the ship's ramp
  const lintel = V(Math.cos(STAIR.top) * (S.R + 1), S.TOP + 5.6, Math.sin(STAIR.top) * (S.R + 1));
  assert.ok(seen(W.level.spawn.clone().add(V(0, 1.7, 0)), lintel), 'the gate is seen from the ship');
  // and from the top landing, in the gate, the first flight is in plain view down to its foot
  assert.ok(seen(stair.path[1].clone().add(V(0, 1.7, 0)), stair.path[3].clone().add(V(0, 0.5, 0))), 'the first flight is seen from the gate');
});

test('the wings still take you down from the rim to Nima', () => {
  // from the rim's edge nearest her (on the parapet or just behind it), steering for her on wings: where does he land?
  const a = Math.atan2(nima.z, nima.x);
  let best = Infinity;
  for (const da of [-0.3, -0.15, 0, 0.15, 0.3]) for (const r of [S.R + 1, S.R + 4]) {
    const x = Math.cos(a + da) * r, z = Math.sin(a + da) * r, g = W.physics.groundAt(x, S.TOP + 5, z, 10);
    if (!Number.isFinite(g) || Math.abs(g - S.TOP) > 2) continue;
    const P = new A.Player(W.physics, { health: false });
    P.has = (id) => id === 'backpack' || id === 'glider';
    P.respawn(V(x, g + 0.1, z));
    for (let i = 0; i < 60 * 60; i++) {
      const heading = Math.atan2(nima.x - P.pos.x, nima.z - P.pos.z);
      P.heading = heading;
      P.update(1 / 60, { KeyW: A.flat(P.pos, nima) > 2, Space: i < 4 || (i > 30 && !P.onGround) }, heading + Math.PI);
      if (i > 40 && P.onGround) break;
    }
    if (P.onGround) best = Math.min(best, P.pos.distanceTo(nima));
  }
  assert.ok(best < 8, `a glide lands ${best.toFixed(0)} m from Nima`);
});
