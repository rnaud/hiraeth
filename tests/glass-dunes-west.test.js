// The Glass Dunes' west on a path (issue #475, the level design audit v1.85: the folded ravine, the prism crossings and
// the pearl city lay 280-435 m off every path, three loners 157 m apart, and nothing sent you there). Now the west posts
// lead from the landing flat round by the red cleft, down the ravine and through the crossings to the pearl city, and
// from its east stair home by the gap (src/glass-dunes-ways.js WEST_POSTS, a `lines` entry the audit follows); Fenna, by
// the cleft's arch, sends you along them to read the old city's clock (src/story/glassdunes-people.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
await import('./register-gadgets.js');
const { loadWorld, talkTo, goalOf } = await import('./playthrough-agent.js');
const { WEST_POSTS } = await import('../src/glass-dunes-ways.js');
const { game } = await import('../src/game-state.js');

let W;
const world = () => W ??= (globalThis.location = { search: '?level=glassdunes' }, loadWorld('glassdunes'));
test.after(() => W?.dispose());
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const nearLine = (line, p) => Math.min(...line.map((q) => flat(q, p)));

test('the west posts stand on open sand, a few tens of metres apart, and their line reaches every place of the west', () => {
  const { level, physics } = world(), H = (x, z) => level.ground.heightAt(x, z);
  for (const run of WEST_POSTS) for (const [i, [x, z]] of run.entries()) {
    const h = H(x + 0.5, z), g = physics.groundAt(x + 0.5, h + 40, z, 80);   // (beside its own pole)
    assert.ok(Math.abs(g - h) < 0.3, `post ${x}, ${z}: something built under it (${g} over the sand's ${h})`);
    if (i) { const [px, pz] = run[i - 1]; assert.ok(Math.hypot(x - px, z - pz) < 75, `posts ${px}, ${pz} and ${x}, ${z}: ${Math.round(Math.hypot(x - px, z - pz))} m apart`); }
  }
  const line = level.lines.find((l) => l.name === 'the west posts')?.points;
  assert.ok(line?.length > 30, 'the level gives the audit the west posts');
  assert.ok(nearLine(line, level.spawn.toArray()) < 40, 'from the landing flat');
  for (const s of level.sights.filter((x) => /folded|prism|pearl|vermilion/.test(x.name))) assert.ok(nearLine(line, s.at.toArray()) < 30, `${s.name}: ${Math.round(nearLine(line, s.at.toArray()))} m off the posts`);
  assert.ok(nearLine(line, [10, 0, -180]) < 50, 'and home to the north camp');
});

test('the west is no row of loners: each of its places has a goal within 150 m, and Fenna stands where the posts leave the cleft', () => {
  const { level, npcs } = world(), G = level.westGoals;
  const sight = (re) => level.sights.find((s) => re.test(s.name)).at.toArray();
  assert.ok(flat(G.bridge, sight(/prism/)) < 150 && flat(G.bridge, sight(/pearl/)) < 150, 'the high bridge between the crossings and the city');
  assert.ok(flat(G.gallery, sight(/pearl/)) < 150, 'the upper gallery in the city');
  assert.ok(G.gallery[1] - level.ground.heightAt(G.gallery[0], G.gallery[2]) > 20, 'the gallery high over the sand');
  const fenna = npcs.find((n) => n.def?.id === 'fenna');
  assert.ok(fenna && nearLine(level.lines.find((l) => l.name === 'the west posts').points, fenna.pos.toArray()) < 15, 'Fenna by the posts');
});

test('Fenna gives the old city\'s clock; standing on the upper gallery reads it and ends the errand, the bridge passed over', () => {
  const W = world(), q = W.quests, id = 'glassdunes.oldclock';
  assert.ok(!q.isActive(id) && !q.isDone(id), 'not given before her talk');
  const r = talkTo(W, 'fenna', goalOf(W, id));
  assert.ok(!r.error, r.error);
  W.step(2);
  assert.equal(q.stage(id), 'bridge', 'given: the high bridge first');
  const G = W.level.westGoals;
  W.at(new THREE.Vector3(G.gallery[0] - 4, G.gallery[1], G.gallery[2] + 3));
  W.step(4);
  assert.ok(game.flag('glassdunes.oldclock.read'), 'the clock read from the gallery');
  assert.ok(q.isDone(id), `straight to the end: ${q.stage(id)}`);
  assert.ok(W.toasts.some((t) => /seven minutes to the hour/.test(t)), 'its minute said');
});
