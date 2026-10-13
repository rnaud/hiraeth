import test from 'node:test';
import assert from 'node:assert/strict';
import { CINEMATICS, reviewURL } from '../src/cinematics-page/catalog.js';
import { reviewStorage, mergeNotes } from '../src/cinematics-page/storage.js';
import { readFileSync } from 'node:fs';
import { WORLD_MOMENTS } from '../src/story/film.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { ORDER, SIDE, isDismissed } from '../src/levels/names.js';
test('review covers every registered moment, item box and destination without duplicate links', () => {
  const ids = new Set(CINEMATICS.map(e => e.id));
  assert.equal(ids.size, CINEMATICS.length);
  // (a dismissed world's moments and boxes are not played: src/levels/names.js DISMISSED)
  for (const m of Object.entries(WORLD_MOMENTS).filter(([w]) => !isDismissed(w)).flatMap(([, ms]) => ms)) assert.ok(ids.has(m.id), m.id);
  for (const b of Object.entries(PLACEMENTS).filter(([w]) => !isDismissed(w)).flatMap(([, bs]) => bs)) assert.ok(ids.has(`box.${b.id}`), b.id);
  for (const world of [...ORDER, ...SIDE, 'home', 'lantern']) assert.ok(ids.has(`arrival.${world}`));
  for (const e of CINEMATICS.filter(e => e.id !== 'trailer')) assert.equal(new URL(reviewURL(e), 'https://example.com/game/').searchParams.get('cinematicReview'), e.id);
});
test('review storage never writes through to a player save and starts fresh on replay', () => {
  assert.equal(reviewStorage('?level=desert'), null);
  const a = reviewStorage('?cinematicReview=desert.flow'); a.setItem('hiraeth.s1.game.v1', 'temporary');
  assert.equal(a.getItem('hiraeth.s1.game.v1'), 'temporary');
  const b = reviewStorage('?cinematicReview=desert.flow'); assert.equal(b.getItem('hiraeth.s1.game.v1'), null);
  assert.equal(new URL(reviewURL(CINEMATICS.find(e=>e.id==='trailer')), 'https://example.com/').searchParams.get('muted'),'1');
  a.removeItem('hiraeth.s1.game.v1'); assert.equal(a.getItem('hiraeth.s1.game.v1'), null);
});

test('imported QC notes merge by date, and the last QC pass\'s notes load and name real cinematics', () => {
  const here = { a: { verdict: 'Pass', text: 'old', updated: '2026-10-01' }, b: { verdict: 'Needs work', text: 'mine', updated: '2026-10-09' } };
  const merged = mergeNotes(here, { notes: { a: { verdict: 'Needs work', text: 'new', updated: '2026-10-05' }, b: { verdict: 'Pass', text: 'older', updated: '2026-10-02' }, c: { verdict: 'Nonsense' } } });
  assert.equal(merged.a.text, 'new'); assert.equal(merged.b.text, 'mine'); assert.equal(merged.c, undefined);
  const pass = JSON.parse(readFileSync(new URL('../docs/systems/cinematics-qc-notes.json', import.meta.url), 'utf8'));
  const ids = new Set(CINEMATICS.map((e) => e.id));
  for (const id of Object.keys(pass.notes)) assert.ok(ids.has(id), id);
  assert.equal(Object.keys(mergeNotes({}, pass)).length, CINEMATICS.length, 'every cinematic has its verdict');
});

// The review page's staging (runtime.js stageCinematic) on a stand-in world: a merged world's second part films its own
// climax (Vael II's bell, Lorn II's pools: both played the first part's film, staged by the level), and the desert's
// films stand where play has you (the drain's debris; the roots with the spark-stone), not the lever that went (#158).
test('the staging films each merged part\'s own climax, and the desert\'s at the debris and the roots', async () => {
  const THREE = await import('three');
  const { stageCinematic } = await import('../src/cinematics-page/runtime.js');
  globalThis.requestAnimationFrame ??= (f) => setTimeout(f, 0);
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const stage = async (id, parts, level = {}) => {
    const calls = [], at = [];
    const world = { parts, ...Object.values(parts)[0], film: Object.values(parts)[0].film };
    const w = { THREE, level, storyRt: { world, moments: { current: null } }, player: { teleport: (p) => at.push(p.clone()), pos: V() } };
    for (const [name, part] of Object.entries(parts)) for (const [k, f] of Object.entries(part.film ?? {})) part.film[k] = (...a) => { calls.push(`${name}.${k}`); return f(...a); };
    const ok = await stageCinematic(w, CINEMATICS.find((e) => e.id === id));
    return { ok, calls, at };
  };
  const bell = await stage('arzach2.bell', { arzach: { film: { bird: () => true } }, arzach2: { film: { bell: () => true } } }, { arzach2: { ropeFoot: V(5, 0, 5) } });
  assert.deepEqual(bell.calls, ['arzach2.bell']);
  assert.ok(bell.at[0].distanceTo(V(5, 0, 5)) > 0.5 && bell.at[0].distanceTo(V(5, 0, 5)) < 1.5, 'an arm\'s length from the bell rope, not in it');
  const lit = [];
  const pools = [0, 1, 2].map((i) => ({ c: V(i * 10, 0, 0) }));
  const p2 = await stage('perdide2.pools', { perdide: { film: { crystal: () => true }, places: { heart: V() } }, perdide2: { film: {}, pools, light: (p) => { lit.push(pools.indexOf(p)); return true; } } });
  assert.deepEqual([p2.calls, lit], [[], [0, 1, 2]], 'Lorn II\'s pools lit, not the crystal\'s film');
  const cave = { bone: { position: V(3, 1, 7) }, chDir: V(1, 0, 0), levels: { high: 1 }, poolCenter: V(), origin: V(), basinR: () => 4 };
  const flow = await stage('desert.flow', { desert: { film: { flow: () => true } } }, { qanat: { cave, city: {} } });
  assert.deepEqual(flow.calls, ['desert.flow']);
  assert.ok(flow.at[0].distanceTo(cave.bone.position) < 3, 'beside the drain\'s debris');
  let set = 0;
  const city = { rootsLook: V(40, 2, 9) };
  const tree = await stage('desert.lit', { desert: { film: {}, setStone: () => { set++; } } }, { qanat: { cave, city } });
  assert.equal(set, 1, 'the spark-stone set');
  assert.ok(tree.at[0].equals(city.rootsLook), 'in front of the roots');
  // the Signal Market's broadcast: at the console up the tower, where you play it (from the square below, his face's
  // panel was shot against a wall)
  let played = 0;
  const console_ = V(0, 45.4, -236.9);
  const cast = await stage('bazaar.broadcast', { bazaar: { film: {}, play: () => { played++; } } }, { signal: { places: { console: console_ } } });
  assert.equal(played, 1);
  assert.ok(cast.at[0].distanceTo(console_) < 2, 'by the console');
});
