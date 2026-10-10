// The City-Shaft's air pillars (src/shaft-pillars.js): columns of rising air that carry the wings back up the shaft.
// Each is clear all the way up, and a real traveller rides each to where it lets him off: the spire's from the bottom
// viaduct to the palace landing, the wall ones from the depths to the rim, or off onto a terrace on the way.
import test from 'node:test';
import assert from 'node:assert/strict';

const A = await import('./playthrough-agent.js');
const { items, V } = A;
const { PILLARS, pillarAxis, pillarAt, latticeRange } = await import('../src/shaft-pillars.js');
const W = A.loadWorld('incal');
const S = W.level.shaft, ph = W.physics, pillars = S.pillars;
const DT = 1 / 60;
const byId = (id) => pillars.pillars.find((c) => c.id === id);

test('the pillars: where they stand, and the lattice that draws them', () => {
  assert.equal(pillars.pillars.length, PILLARS.length);
  assert.ok(PILLARS.length >= 5, 'the spire’s, the crown’s, and three by the terraces');
  const spire = byId('spire');
  assert.ok(spire.top > S.places.palace.y + 4 && spire.top < S.places.palace.y + 12, 'the spire’s tops out a few metres over the palace landing');
  const land = Math.hypot(spire.x, spire.z) - spire.w;
  assert.ok(land > 52 && land < 56, `its inner edge just off the landing’s rim (${land.toFixed(1)} m from the axis)`);
  const crown = byId('crown');
  assert.equal(crown.foot, S.places.palace.y, 'the crown’s stands on the palace landing');
  assert.ok(crown.top > S.places.palace.crown.y + 4, 'and tops out over the dome’s crown');
  for (const c of PILLARS.filter((p) => p.id !== 'spire' && p.id !== 'crown')) {
    assert.ok(c.top > S.TOP + 15, `${c.name} tops out well over the rim, to glide back onto it`);
    assert.ok(c.foot < S.LEVELS.at(-1) - 50, `${c.name} rises from deep under the bottom terrace: it catches a fall`);
  }
  assert.equal(pillarAt(V(pillarAxis(spire).x, 0, pillarAxis(spire).z))?.id, 'spire');
  assert.equal(pillarAt(V(0, 0, 0)), null);
  const [k0, k1] = latticeRange(0, 5, 2, 10, 30);
  assert.deepEqual([k0, k1], [2, 5], 'the pieces in a window, anchored to the world');
});

test('every pillar is clear of the city from its foot to its top, and inside every terrace’s edge', () => {
  for (const c of pillars.pillars) {
    const ax = pillarAxis(c);
    for (let i = 0; i <= 16; i++) {
      const b = (i / 16) * Math.PI * 2, rr = i === 16 ? 0 : c.w;
      const x = ax.x + Math.cos(b) * rr, z = ax.z + Math.sin(b) * rr;
      const g = ph.groundAt(x, c.top, z, c.top - c.foot - 1);
      assert.ok(!(g > c.foot + 1), `${c.name}: something at ${g?.toFixed?.(1)} m in it (${x.toFixed(1)}, ${z.toFixed(1)})`);
    }
    if (c.id === 'spire' || c.id === 'crown') continue;
    for (const t of S.terraces) {
      const d = ((c.a - t.a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (d <= t.a1 - t.a0) assert.ok(c.r + c.w < t.r0 - 1, `${c.name} clear of the ${t.y} m terrace’s edge`);
    }
  }
});

/** A traveller with the wings, from `from`, doing what the hands say each frame ({ input, yaw } | null to stop). */
function fly(from, hands, secs = 90) {
  for (const id of ['backpack', 'glider']) items.grant(id);
  const P = new A.Player(ph, { health: false, climb: false });
  P.respawn(from.clone());
  let rode = 0, top = -Infinity;
  for (let i = 0; i < secs / DT; i++) {
    const h = hands(P, i);
    if (!h) break;
    P.update(DT, h.input ?? {}, h.yaw ?? 0);
    if (pillars.carry(DT, P)) rode += DT;
    top = Math.max(top, P.pos.y);
  }
  return { P, rode, top };
}
const toward = (P, to) => Math.atan2(-(to.x - P.pos.x), -(to.z - P.pos.z));   // (the camera's yaw that points the stick at `to`)

test('the spire’s pillar: off the bottom viaduct, up past every level, and off onto the palace landing', () => {
  const c = byId('spire'), PY = S.places.palace.y;
  const foot = V(c.x, c.foot, c.z);
  assert.ok(Math.abs(ph.groundAt(foot.x, c.foot + 2, foot.z, 6) - c.foot) < 0.6, 'its foot stands on the bottom viaduct’s deck');
  const landing = V(Math.cos(c.a) * 44, PY, Math.sin(c.a) * 44);
  let phase = 'in', jumpAt = 0;
  // walk along the deck into it, and jump: falling back, the wings open by themselves and it takes you
  const { P, rode, top } = fly(foot.clone().add(V(-7 * Math.cos(c.a), 0.3, -7 * Math.sin(c.a))), (P, i) => {
    if (phase === 'in') { if (A.flat(P.pos, foot) < 1.5 && P.onGround) { phase = 'jump'; jumpAt = i; } return { input: { KeyW: true }, yaw: toward(P, foot) }; }
    if (phase === 'jump') { if (i - jumpAt > 6) phase = 'up'; return { input: { Space: i - jumpAt < 4 } }; }
    if (phase === 'up') { if (P.pos.y > c.top - 2) phase = 'off'; return {}; }
    // the stick toward the landing: out of the column and over it, then the wings folded
    if (P.onGround) return null;
    if (Math.hypot(P.pos.x, P.pos.z) < 48) return {};   // (over the landing: the wings folded, down onto it)
    return { input: { Space: true, KeyW: true }, yaw: toward(P, landing) };
  }, 120);
  assert.ok(rode > 20, `carried up it (${rode.toFixed(1)} s)`);
  assert.ok(top > PY + 2, `up over the palace landing (${top.toFixed(1)} m)`);
  assert.ok(P.onGround && Math.abs(P.pos.y - PY) < 0.8 && Math.hypot(P.pos.x, P.pos.z) < 52, `and onto the landing (${P.pos.toArray().map((v) => v.toFixed(1))})`);
});

test('the crown’s pillar: from the palace landing up past the dome, and down onto its crown', () => {
  const c = byId('crown'), crown = S.places.palace.crown;
  const foot = V(c.x, c.foot, c.z);
  let phase = 'jump';
  const { P, top } = fly(foot.clone().add(V(0, 0.3, 0)), (P, i) => {
    if (phase === 'jump') { if (i > 8) phase = 'up'; return { input: { Space: i > 2 && i < 6 } }; }
    if (phase === 'up') { if (P.pos.y > c.top - 2) phase = 'off'; return {}; }
    if (P.onGround) return null;
    if (A.flat(P.pos, crown) < 4) return {};   // (over the crown: the wings folded)
    return { input: { Space: true, KeyW: P.updraft && P.time - P.updraft.at < 0.2 }, yaw: toward(P, crown) };
  }, 40);
  assert.ok(top > crown.y + 3, `up past the dome (${top.toFixed(1)} m)`);
  assert.ok(P.onGround && Math.abs(P.pos.y - crown.y) < 0.8 && A.flat(P.pos, crown) < 6.5, `onto the crown (${P.pos.toArray().map((v) => v.toFixed(1))})`);
});

test('the depths’ pillar: off the bottom terrace by the shrine, a glide into it, and back onto the rim', () => {
  const c = byId('depths');
  const shrine = S.places.shrine;
  // the bottom terrace's edge in line with the pillar: run off it, open the wings, and it takes you
  const edge = V(Math.cos(c.a) * (S.places.bottom.r0 + 1.5), S.places.bottom.y + 0.3, Math.sin(c.a) * (S.places.bottom.r0 + 1.5));
  assert.ok(edge.distanceTo(shrine) < 40, 'beside the Upward Shrine');
  const ax = V(c.x, 0, c.z), rim = V(Math.cos(c.a) * (S.R + 20), S.TOP, Math.sin(c.a) * (S.R + 20));
  let phase = 'run';
  const { P, rode, top } = fly(edge, (P) => {
    if (phase === 'run') { if (!P.onGround && P.pos.y < edge.y - 0.5) phase = 'glide'; return { input: { KeyW: true }, yaw: toward(P, ax) }; }
    if (phase === 'glide') { if (P.updraft) phase = 'up'; return { input: { Space: true } }; }
    if (phase === 'up') { if (P.pos.y > c.top - 2) phase = 'off'; return { input: { Space: true } }; }
    if (P.onGround) return null;
    return { input: { Space: true, KeyW: P.updraft && P.time - P.updraft.at < 0.2 }, yaw: toward(P, rim) };
  }, 120);
  assert.ok(rode > 20, `carried up it (${rode.toFixed(1)} s)`);
  assert.ok(top > S.TOP + 10, `up over the rim (${top.toFixed(1)} m)`);
  assert.ok(P.onGround && Math.abs(P.pos.y - S.TOP) < 1 && Math.hypot(P.pos.x, P.pos.z) > S.R, `and back on the rim (${P.pos.toArray().map((v) => v.toFixed(1))})`);
});

test('every wall pillar lets you glide back onto the rim from its top', () => {
  for (const c of pillars.pillars.filter((p) => p.id !== 'spire' && p.id !== 'crown')) {
    const rim = V(Math.cos(c.a) * (S.R + 20), S.TOP, Math.sin(c.a) * (S.R + 20));
    let phase = 'up';
    const { P } = fly(V(c.x, S.TOP - 60, c.z), (P) => {
      if (phase === 'up') { if (P.pos.y > c.top - 2) phase = 'off'; return { input: { Space: true } }; }
      if (P.onGround) return null;
      return { input: { Space: true, KeyW: P.updraft && P.time - P.updraft.at < 0.2 }, yaw: toward(P, rim) };
    }, 60);
    assert.ok(P.onGround && Math.abs(P.pos.y - S.TOP) < 1 && Math.hypot(P.pos.x, P.pos.z) > S.R, `${c.name}: back on the rim (${P.pos.toArray().map((v) => v.toFixed(1))})`);
  }
});

test('the City-Shaft’s trial, the Shaft climb, is flown on the wings: off the middle terrace into the halfway pillar, up through its rings, out over the rim', async () => {
  const { TRIALS } = await import('../src/trials/data.js');
  const { CourseRun, parTime } = await import('../src/trials/course.js');
  const T = TRIALS.incal;
  assert.equal(T.mode, 'glider', 'the wings, not the jets (v1.42)');
  const gates = T.gates.map(([x, y, z, r]) => ({ x, y, z, r }));
  const run = new CourseRun(gates);
  const start = V(T.start[0], T.start[1], T.start[2]);
  assert.ok(Math.abs(ph.groundAt(start.x, start.y + 2, start.z, 6) - start.y) < 0.6, 'it starts on the middle terrace');
  const last = gates.at(-1);
  let prev = start.clone();
  const { P } = fly(start.clone().add(V(0, 0.3, 0)), (P, i) => {
    run.step(prev, P.pos, i * DT); prev = P.pos.clone();
    if (run.done) return null;
    const g = run.gate;
    if (g === last) return { input: { Space: true, KeyW: !!P.updraft && P.time - P.updraft.at < 0.2 }, yaw: toward(P, V(g.x, g.y, g.z)) };   // (out of its top toward the rim's ring)
    if (i < 90 && !P.updraft) return { input: { Space: i > 10, KeyW: P.onGround }, yaw: toward(P, V(g.x, 0, g.z)) };   // (off the terrace's edge toward it, the wings open)
    return { input: { Space: true } };
  }, 90);
  assert.ok(run.done, `every ring passed (${run.next} of ${gates.length}; at ${P.pos.toArray().map((v) => v.toFixed(1))})`);
  const par = parTime(gates, start, T.speed);
  assert.ok(run.splits.at(-1) < par, `in ${run.splits.at(-1).toFixed(1)} s, inside its par of ${par} s`);
});

test('steered off on the way: the halfway pillar sets you down on the middle terrace, by Perrine’s landing', () => {
  const c = byId('halfway'), mid = -24;
  const t = S.terraces.find((s) => s.y === mid && ((c.a - s.a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) <= s.a1 - s.a0);
  assert.ok(t, 'a middle terrace beside it');
  const target = V(Math.cos(c.a) * (t.r0 + 8), mid, Math.sin(c.a) * (t.r0 + 8));
  let phase = 'up';
  const { P } = fly(V(c.x, mid - 40, c.z), (P) => {
    if (phase === 'up') { if (P.pos.y > mid + 6) phase = 'off'; return { input: { Space: true } }; }
    if (P.onGround) return null;
    return { input: { Space: true, KeyW: P.updraft && P.time - P.updraft.at < 0.2 }, yaw: toward(P, target) };
  }, 40);
  assert.ok(P.onGround && Math.abs(P.pos.y - mid) < 1, `on the middle terrace (${P.pos.toArray().map((v) => v.toFixed(1))})`);
});

test('the pillars draw a window round the camera: a few hundred pieces at most, none outside a pillar', () => {
  const cam = { position: V(0, 0, 0) };
  pillars.update(DT, 12.3, { camera: cam });
  const total = pillars.rings.count + pillars.streaks.count + pillars.ink.count + pillars.motes.count;
  assert.ok(total > 100 && total < 1200, `${total} pieces`);
  const m = new (W.level.shaft.places.palace.landing.constructor)();
  const M = new (Object.getPrototypeOf(pillars._m).constructor)();
  for (let i = 0; i < pillars.rings.count; i++) {
    pillars.rings.getMatrixAt(i, M); m.setFromMatrixPosition(M);
    assert.ok(pillarAt(m, pillars.pillars) || pillars.pillars.some((c) => Math.abs(m.y - c.top) < 1), `ring ${i} in a pillar`);
  }
});
