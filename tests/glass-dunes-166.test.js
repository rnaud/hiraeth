// The Glass Dunes, issue #166 (the author's picks, trapped-time and sunken-city): the stopped minutes held in the glass
// (src/glass-dunes-frozen.js), the windows in the sand, the sinkhole by the Clock-House and the city under it
// (src/glass-dunes-city.js). The new spaces are reachable, the sinkhole has a way back, the frozen scenes are seen
// from the path.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { Player } = await import('../src/player.js');
const { FROZEN_SCENES, frozenTraces, clock, sceneParts } = await import('../src/glass-dunes-frozen.js');
const { frozenPerson, frozenGreatBird, frozenFlockBird, FROZEN_POSES } = await import('../src/glass-dunes-figures.js');
const crowdModule = await import('../src/crowd.js');
const { SAND_WINDOWS, SINKHOLE, CITY, inCity, cityPoint } = await import('../src/glass-dunes-city.js');
const { CLOCK_HOUSE, GLASS_CONTENT, GLASS_CAMPS } = await import('../src/levels/glass-dunes.js');
const { FLOAT_POSTS } = await import('../src/glass-dunes-ways.js');
const { parseLine } = await import('../src/story/tone.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
/** The traveller walks from `from` toward `to` until within `near` m of it (flat) and at its height. */
function walk(physics, from, to, { seconds = 30, near = 0.8 } = {}) {
  const P = new Player(physics, { health: false });
  P.pos.copy(from); P.onGround = true;
  let ok = false;
  for (let i = 0; i < 60 * seconds && !ok; i++) {
    const yaw = Math.atan2(to.x - P.pos.x, to.z - P.pos.z);
    P.heading = yaw;
    quiet(() => P.update(1 / 60, { KeyW: true }, yaw + Math.PI));
    ok = flat(P.pos, to) < near && Math.abs(P.pos.y - to.y) < 1.2;
  }
  return { ok, pos: P.pos.clone() };
}
let W = null;
const world = () => {
  if (!W) { globalThis.location = { search: '?level=glassdunes' }; W = A.loadWorld('glassdunes'); }
  return W;
};
test.after(() => W?.dispose());

test('the stopped minutes: each scene built in its glass, read where its trace says, its line toned and short', () => {
  const { level } = world();
  const scenes = level.frozen.scenes;
  assert.deepEqual(scenes.map((s) => s.id), FROZEN_SCENES.map((s) => s.id), 'every scene found its wall');
  const traces = GLASS_CONTENT.traces.filter((t) => t.id.startsWith('glassdunes.frozen.'));
  assert.equal(traces.length, FROZEN_SCENES.length);
  for (const s of scenes) {
    const t = traces.find((x) => x.id === `glassdunes.frozen.${s.id}`);
    assert.ok(flat(V(t.at[0], 0, t.at[2]), s.stand) < 2.5, `${s.id}: its trace (${t.at}) where you stand to read it (${s.stand.toArray().map((v) => v.toFixed(1))})`);
    const line = t.person.talk.nodes.look.say[0], p = parseLine(line);
    assert.ok(p.explicit && p.text.split(/\s+/).length <= 16, `${s.id}: toned and terse: "${p.text}"`);
    assert.ok(/minutes to/.test(p.text), `${s.id}: its stopped minute`);
    assert.ok(s.lens?.geometry?.attributes.position.count > 100 && s.lens.material.uniforms.uVeil.value > 0, `${s.id}: its clear glass (a veil)`);
    assert.ok(s.wash, `${s.id}: its body washed over the picture`);
  }
  // the last is the Clock-House's own minute
  assert.equal(FROZEN_SCENES.at(-1).minute, 7);
  assert.equal(frozenTraces().length, FROZEN_SCENES.length);
});

test('the figures are the game’s own people and creatures, posed and held; the clocks have a dial', () => {
  const { figureGeometry } = crowdModule;
  // a frozen person is the crowd's figure (its pieces, its rig) posed: as tall as one, its arms where the pose puts them
  const src = figureGeometry('mid', 'desert');
  for (const pose of Object.keys(FROZEN_POSES)) {
    const g = frozenPerson(pose);
    assert.ok(g.attributes.position.array.every(Number.isFinite) && g.attributes.color, pose);
    assert.ok(g.attributes.position.count > 600 && g.attributes.position.count <= (src.index ? src.index.count : src.attributes.position.count), `${pose}: the crowd figure's own triangles`);
    const b = new THREE.Box3().setFromBufferAttribute(g.attributes.position);
    assert.ok(b.max.y > 1.6 && b.max.y < 2.3 && b.min.y > -0.1, `${pose}: as tall as a person (${b.max.y.toFixed(2)})`);
  }
  const top = (g) => new THREE.Box3().setFromBufferAttribute(g.attributes.position).max.y;
  assert.ok(top(frozenPerson('armsUp')) > top(frozenPerson('stride')) + 0.15, 'arms up over the head');
  const bird = frozenGreatBird(), fb = frozenFlockBird(0.6);
  assert.ok(bird.attributes.position.count > 5000 && bird.attributes.color && fb.attributes.color, 'Vael’s great bird and a flock’s bird');
  // the minute hand of a clock at 15 to points at 9 o'clock (−x); twelve ticks and a hub on its dial
  const c = clock({ minute: 15, kind: 'round' }), p = c.hands.attributes.position;
  let far = null;
  for (let i = 0; i < p.count; i++) if (!far || Math.hypot(p.getX(i), p.getY(i)) > Math.hypot(far[0], far[1])) far = [p.getX(i), p.getY(i)];
  assert.ok(far[0] < -0.3 && Math.abs(far[1]) < 0.1, `the minute hand at quarter to (${far.map((v) => v.toFixed(2))})`);
  assert.ok(c.ticks.attributes.position.count >= 13 * 24, 'twelve ticks and a hub');
  for (const def of FROZEN_SCENES) assert.ok(sceneParts(def).some(([k]) => k === 'figure'), `${def.id}: holds someone or something`);
});

test('the stopped minutes are seen from the path (the near three from the critical path, the far two from their camps)', () => {
  const { level, physics } = world();
  const door = level.temples?.find((t) => t.id === 'garage')?.outside?.door?.at ?? level.temple.outside.door.at;
  const ground = (x, z) => level.ground.heightAt(x, z);
  const path = [[0, 226], [25, 229], [48, 184], [70, 140], [91, 109], [door.x, door.z], ...FLOAT_POSTS].map(([x, z]) => V(x, ground(x, z) + 1.7, z));
  const camps = { dust: GLASS_CAMPS.west, moment: GLASS_CAMPS.north };
  for (const s of level.frozen.scenes) {
    const from = camps[s.id] ? [V(camps[s.id].x, ground(camps[s.id].x, camps[s.id].z) + 1.7, camps[s.id].z + (s.id === 'moment' ? 6 : 0))] : path;
    const seen = from.filter((eye) => {
      const d = eye.distanceTo(s.at);
      if (d > 130) return false;
      const dir = s.at.clone().sub(eye).normalize(), hit = physics.rayHit(eye, dir, d + 2);
      return !hit || hit.point.distanceTo(s.at) < Math.max(...s.size) + 1.5;   // (the first thing met is its own glass)
    });
    assert.ok(seen.length > 0, `${s.id}: seen from ${camps[s.id] ? 'its camp' : 'the path'}`);
  }
});

test('the moment in the breaking wave: walked into, through its cleft, from the north camp', () => {
  const { level, physics } = world();
  const m = level.frozen.scenes.find((s) => s.id === 'moment');
  const c = GLASS_CAMPS.north, from = V(c.x - 12, 0, c.z - 4);
  from.y = physics.groundAt(from.x, 20, from.z, 40);
  // to the mouth of the cleft, then in to the middle
  const yaw = Math.atan2(c.x - m.at.x, c.z - m.at.z), mouth = m.at.clone().add(V(Math.sin(yaw) * 12, 0, Math.cos(yaw) * 12));
  mouth.y = physics.groundAt(mouth.x, 20, mouth.z, 40);
  const a = walk(physics, from, mouth, { seconds: 30, near: 1.5 });
  assert.ok(a.ok, `to the cleft's mouth (reached ${a.pos.toArray().map((v) => v.toFixed(1))})`);
  const inside = m.at.clone(); inside.y = physics.groundAt(inside.x, inside.y + 3, inside.z, 20);
  const b = walk(physics, a.pos, inside, { seconds: 20, near: 2 });
  assert.ok(b.ok, `into the chamber (reached ${b.pos.toArray().map((v) => v.toFixed(1))}, its middle ${inside.toArray().map((v) => v.toFixed(1))})`);
});

test('the windows in the sand: their glass holds you, the city lies far below it', () => {
  const { level, physics } = world();
  const ws = level.sandCity.windows;
  assert.equal(ws.length, SAND_WINDOWS.length);
  for (const w of ws) {
    const g = physics.groundAt(w.x + 1, w.rim + 5, w.z - 1, 40);
    assert.ok(Math.abs(g - (w.rim + 0.3)) < 0.25, `${w.id}: you stand on its glass (${g.toFixed(2)}, the rim ${w.rim.toFixed(2)})`);
    assert.ok(level.ground.heightAt(w.x, w.z) < w.rim - 10, `${w.id}: its well`);
    // walked onto from the sand round it
    const from = V(w.x + w.r + 10, 0, w.z); from.y = physics.groundAt(from.x, 100, from.z, 200);
    const r = walk(physics, from, V(w.x, w.rim + 0.3, w.z), { seconds: 15, near: 1 });
    assert.ok(r.ok && r.pos.y > w.rim, `${w.id}: walked out onto its glass (${r.pos.y.toFixed(2)})`);
  }
  assert.ok(level.floraAvoid(SAND_WINDOWS[0].x, SAND_WINDOWS[0].z), 'no plant grows on a window');
});

test('the sinkhole by the Clock-House leads into the city, and the ramp of sand leads back up', () => {
  const { level, physics } = world();
  const S = level.sandCity.sinkhole;
  assert.ok(Math.hypot(S.x - CLOCK_HOUSE.x, S.z - CLOCK_HOUSE.z) < 40, 'by the Clock-House');
  const [down, back] = level.sandCity.portals;
  assert.ok(level.portals.includes(down) && level.portals.includes(back), 'both ways are the level’s');
  // walked down its funnel from the sand round it, into the way through
  const from = V(S.x + S.r + 6, 0, S.z); from.y = physics.groundAt(from.x, 100, from.z, 200);
  const P = new Player(physics, { health: false });
  P.pos.copy(from); P.onGround = true;
  let reached = false;
  for (let i = 0; i < 60 * 15 && !reached; i++) {
    const yaw = Math.atan2(S.x - P.pos.x, S.z - P.pos.z);
    P.heading = yaw; quiet(() => P.update(1 / 60, { KeyW: true }, yaw + Math.PI));
    reached = P.pos.distanceTo(down.at) < down.r;
  }
  assert.ok(reached, `walked into the throat (got to ${P.pos.toArray().map((v) => v.toFixed(1))})`);
  // it lands you in the city, on its floor, the tower ahead
  assert.ok(inCity(down.to), 'into the city');
  const g = physics.groundAt(down.to.x, down.to.y + 1, down.to.z, 10);
  assert.ok(Math.abs(g - (CITY.at[1])) < 0.3, `on its streets (${g.toFixed(2)})`);
  assert.ok(down.to.distanceTo(back.at) > back.r + 8, 'not straight back out');
  // the way back: up the ramp of sand to its top, under the hole
  const top = back.at.clone(); top.y = physics.groundAt(top.x, top.y + 1, top.z, 5);
  const foot = cityPoint(CITY.ramp.foot[0], 0, CITY.ramp.foot[2] + 1.5);
  const toFoot = walk(physics, down.to.clone(), foot, { seconds: 10, near: 0.8 });
  assert.ok(toFoot.ok, 'to the foot of the ramp');
  const up = walk(physics, toFoot.pos, top, { seconds: 30, near: 0.3 });
  assert.ok(up.ok && up.pos.distanceTo(back.at) < back.r, `up the ramp to the way out (reached ${up.pos.toArray().map((v) => v.toFixed(1))})`);
  // out on the lip, on the sand, clear of the throat
  assert.ok(!inCity(back.to) && back.to.distanceTo(down.at) > down.r + 4, 'out on the lip, not back in');
  assert.ok(Math.abs(physics.groundAt(back.to.x, back.to.y + 2, back.to.z, 10) - back.to.y) < 0.3, 'on the sand');
});

test('the city: its round tower stands under the Clock-House, its ceiling over the streets, footprints on it', () => {
  const { physics } = world();
  assert.ok(Math.abs(CITY.tower.x - (CLOCK_HOUSE.x - SINKHOLE.x)) < 1 && Math.abs(CITY.tower.z - (CLOCK_HOUSE.z - SINKHOLE.z)) < 1, 'its tower under the house');
  // the tower is solid, the streets walked
  const t = cityPoint(CITY.tower.x, 3, CITY.tower.z + CITY.tower.r + 3);
  const d = physics.rayDistance(t, V(0, 0, -1), 10);
  assert.ok(d < 4, `the tower's drum (${d.toFixed(2)})`);
  // the walls close it in: from the landing, every way out meets a wall within the city's box
  const at = cityPoint(...CITY.landing).add(V(0, 1.5, 0));
  for (const dir of [V(1, 0, 0), V(-1, 0, 0), V(0, 0, 1), V(0, 0, -1)]) assert.ok(physics.rayDistance(at, dir, 200) < 90, 'walled in');
});
