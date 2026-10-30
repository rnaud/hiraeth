import test from 'node:test';
import assert from 'node:assert/strict';
import { CINEMATICS, reviewURL } from '../src/cinematics-page/catalog.js';
import { reviewStorage, mergeNotes, QC_VERDICTS } from '../src/cinematics-page/storage.js';
import { readFileSync } from 'node:fs';
import { WORLD_MOMENTS } from '../src/story/film.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { ORDER, SIDE, isDismissed } from '../src/levels/names.js';
import { FINALES } from '../src/temples/finale.js';
test('review covers every registered moment, item box and destination without duplicate links', () => {
  const ids = new Set(CINEMATICS.map(e => e.id));
  assert.equal(ids.size, CINEMATICS.length);
  // (a dismissed world's moments and boxes are not played: src/levels/names.js DISMISSED)
  for (const m of Object.entries(WORLD_MOMENTS).filter(([w]) => !isDismissed(w)).flatMap(([, ms]) => ms)) assert.ok(ids.has(m.id), m.id);
  for (const b of Object.entries(PLACEMENTS).filter(([w]) => !isDismissed(w)).flatMap(([, bs]) => bs)) assert.ok(ids.has(`box.${b.id}`), b.id);
  for (const world of [...ORDER, ...SIDE, 'home', 'lantern']) assert.ok(ids.has(`arrival.${world}`));
  // every makers' house's ending, in a group of its own, played in the world the house stands in (the QC of v1.85, #490:
  // the fourteen were off the page, so never reviewed)
  const endings = CINEMATICS.filter((e) => e.group === 'Temple endings' && !e.opening);
  // (and the introductions at the special doors of the twelve whose ending is the guardian's trial, #655)
  const openings = CINEMATICS.filter((e) => e.opening);
  assert.equal(openings.length, 12);
  for (const e of openings) { assert.equal(e.id, `opening.${e.temple}`); assert.equal(e.group, 'Temple endings'); }
  assert.deepEqual(endings.map((e) => e.temple).sort(), Object.keys(FINALES).sort());
  assert.equal(endings.length, 14, 'the fourteen houses');
  for (const e of endings) assert.equal(e.id, `finale.${e.temple}`);
  assert.equal(endings.find((e) => e.temple === 'garage').world, 'glassdunes', 'the Clock-House in the Glass Dunes');
  assert.equal(endings.find((e) => e.temple === 'arzach2').world, 'arzach', 'the Founders’ Belfry in Vael');
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
  // Frozen review evidence keeps films deliberately retired after that review.
  const retired = new Set(['box.edena.pouch']); // #625: seed pouch and its reward removed.
  for (const id of retired) {
    assert.equal(ids.has(id), false, `${id}: no retired film in the current catalogue`);
    assert.ok(pass.notes[id], `${id}: retain the original reviewed evidence`);
  }
  for (const id of Object.keys(pass.notes)) assert.ok(ids.has(id) || retired.has(id), id);
  const imported = mergeNotes({}, pass);
  assert.equal(Object.keys(pass.notes).length, 112, 'the frozen evidence inventory stays 112 entries');
  assert.equal(Object.keys(imported).length, 112, 'all reviewed notes survive import');
  assert.equal(pass.scope.version, '1.90');
  assert.equal(pass.scope.source, 'c5449ab6c');
  assert.equal(pass.scope.reviewedLive, 111);
  assert.deepEqual(pass.scope.separateEntries, ['trailer']);
  assert.equal(Object.keys(imported).filter(id => id !== 'trailer').length, 111);
  assert.equal(imported.trailer.verdict, 'Pass with creative recommendation', 'do not flatten the trailer’s qualified judgment into Pass');
  assert.equal(imported.trailer.text, pass.notes.trailer.text);
  const unreviewed = ['arrival.mangrove', 'arrival.waterfall', 'arrival.saltharbour', 'arrival.antennas', 'arrival.eclipse', 'arrival.fallenring', 'arrival.underside'];
  assert.deepEqual([...pass.scope.unreviewed].sort(), [...unreviewed].sort());
  // (the trial introductions came after the frozen pass, #655: unreviewed there, never manufactured passes)
  // (and films added after it, reviewed in a pass of their own: docs/systems/cinematics-qc.md; the Font Room's, #784)
  const after = new Set(['desert.font']);
  const later = CINEMATICS.filter(e => e.opening || after.has(e.id)).map(e => e.id);
  assert.deepEqual(CINEMATICS.filter(e => !imported[e.id]).map(e => e.id).sort(), [...unreviewed, ...later].sort(), 'catalogue entries outside frozen coverage remain unreviewed, never manufactured passes');
  for (const id of unreviewed) assert.equal(imported[id], undefined);
  for (const id of retired) assert.deepEqual(imported[id], pass.notes[id], 'retired film evidence survives import unchanged');
  assert.equal(Object.keys(imported).length - retired.size + unreviewed.length + later.length, CINEMATICS.length, 'every current entry is explicitly reviewed or outside the frozen review');
  const html = readFileSync(new URL('../cinematics.html', import.meta.url), 'utf8');
  const options = [...html.match(/<select id="verdict">(.*?)<\/select>/s)[1].matchAll(/<option>(.*?)<\/option>/g)].map(m => m[1]);
  assert.deepEqual(options, QC_VERDICTS, 'the review UI can display and preserve every accepted imported status');
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

// A house's ending staged as play has it (#490): in its arena between the keeper and the way out, the doors of the way in
// forced open (the way out and the arena's door left to the house and its film), the keeper woken and resolved.
test('the staging plays a house\'s ending from its arena, the way in open, the keeper resolved', async () => {
  const THREE = await import('three');
  const { stageCinematic } = await import('../src/cinematics-page/runtime.js');
  globalThis.requestAnimationFrame ??= (f) => setTimeout(f, 0);
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const forced = {}, calls = [], at = [];
  const pieces = { way: { group: { position: V(0, 0, 20) } }, d1: { group: { position: V(30, 0, 0) } } };
  const moments = { current: null };
  const T = {
    id: 'desert', def: { arenaDoor: 'arena' },
    logic: { def: { elements: { way: { type: 'door', opens: { resolved: true } }, d1: { type: 'door', opens: { lit: 'b1' } }, arena: { type: 'door', opens: null }, b1: { type: 'brazier' } } }, force: (id, open) => { forced[id] = open; } },
    piece: (id) => pieces[id], applyDoors: () => calls.push('doors'),
    guardian: { model: { pos: V(0, 0, 0) }, arena: { center: V(), r: 16, y: 0 }, wake: () => calls.push('wake'), resolve: () => { calls.push('resolve'); moments.current = { id: 'temple.desert.finale' }; } },
  };
  const w = { THREE, level: { temples: [T] }, storyRt: { world: {}, moments }, player: { teleport: (p) => at.push(p.clone()), pos: V() } };
  const ok = await stageCinematic(w, CINEMATICS.find((e) => e.id === 'finale.desert'));
  assert.equal(ok, true, 'its film plays');
  assert.deepEqual(forced, { d1: true }, 'the way in open; the way out and the arena\'s door left to the house');
  assert.deepEqual(calls, ['doors', 'wake', 'resolve']);
  assert.ok(at[0].distanceTo(V(0, 0, 6)) < 0.2, 'in the arena, between the keeper and the way out');
});
