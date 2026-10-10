// The level design audit's fifth round (docs/audits/level-design-v1.21.md): the flat worlds' high places, climbed for
// real by the traveller (a short climb and a rest, each pitch), and the places pulled in toward the path.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { Player } = await import('../src/player.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

/**
 * One pitch: the traveller standing at `from` walks toward `to` (W, the camera behind him) until he stands on the
 * surface at `to.y`, climbing what is in the way. → { ok, climbed, y }
 */
export function pitch(physics, from, to, { seconds = 20 } = {}) {
  const P = new Player(physics, { health: false });
  const g = physics.groundAt(from.x, from.y + 1, from.z, 3);
  P.pos.set(from.x, Number.isFinite(g) ? g : from.y, from.z);
  P.onGround = true;
  let climbed = false, ok = false;
  for (let i = 0; i < 60 * seconds && !ok; i++) {
    const yaw = Math.atan2(to.x - P.pos.x, to.z - P.pos.z);
    P.heading = yaw;
    quiet(() => P.update(1 / 60, { KeyW: true }, yaw + Math.PI));
    climbed ||= !!P.climbing;
    ok = P.onGround && !P.climbing && !P.mantle && Math.abs(P.pos.y - to.y) < 0.3;
  }
  return { ok, climbed, y: P.pos.y };
}

/** A point `back` m from column `b`'s centre toward column `a`'s centre, at a's top: where you stand to climb b. */
const before = (a, b, back) => { const d = a.clone().sub(b).setY(0).normalize(); return V(b.x + d.x * back, a.y, b.z + d.z * back); };

test('Lorn: Wendel’s lookout climbs 6 m at a time, column by column, to the makers’ box on its top, 30 m over the rise', () => {
  const W = A.loadWorld('perdide');
  try {
    const { lookout } = W.level, { physics } = W;
    assert.ok(lookout?.steps?.length === 5, 'four columns round the middle one');
    assert.ok(lookout.height >= 30, `30 m up (${lookout.height})`);
    // each pitch: from the last column's top (the ground for the first) up the next one's face onto its top
    let at = lookout.foot.clone();
    for (const [k, s] of lookout.steps.entries()) {
      const r = pitch(physics, before(at, s, 3.6), s);
      assert.ok(r.climbed && r.ok, `pitch ${k + 1}: up onto ${s.y.toFixed(1)} m (ended at ${r.y.toFixed(2)})`);
      at = s;
    }
    // the box on the top, on the middle column, with room to stand
    const box = W.boxes.list.find((b) => b.id === 'perdide.reed');
    assert.ok(box && Math.abs(box.pos.y - lookout.top.y) < 0.5 && Math.hypot(box.pos.x - lookout.top.x, box.pos.z - lookout.top.z) < 2.6,
      `the box on the top (${box?.pos.y.toFixed(2)} vs ${lookout.top.y.toFixed(2)})`);
  } finally { W.dispose(); }
});

test('Lorn II: the keepers’ stalks climb from the shallows 6 m at a time to the keepers’ lamp, 30 m up, lit with the water-way', () => {
  const W = A.loadWorld('perdide2');
  try {
    const { stalks, waterWay } = W.level, { physics } = W;
    assert.ok(stalks?.steps?.length === 5 && stalks.height >= 30);
    let at = stalks.foot.clone();
    for (const [k, s] of stalks.steps.entries()) {
      const r = pitch(physics, before(at, s, 3.4), s);
      assert.ok(r.climbed && r.ok, `pitch ${k + 1}: up onto ${s.y.toFixed(1)} m (ended at ${r.y.toFixed(2)})`);
      at = s;
    }
    // within 80 m of the landing, off the lit path
    assert.ok(Math.hypot(stalks.top.x - W.level.spawn.x, stalks.top.z - W.level.spawn.z) < 80, 'by the landing');
    // the lamp on the top lights with the water-way
    waterWay.lit(true);
    assert.ok(stalks.isLit(), 'lit with the water-way');
    waterWay.lit(false);
    assert.ok(!stalks.isLit(), 'and dark without it');
  } finally { W.dispose(); }
});
