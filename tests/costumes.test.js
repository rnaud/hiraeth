import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// a little DOM for the people's speech balloons
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.window ??= { innerWidth: 1200, innerHeight: 800 };

const { COSTUMES, HEADS, MASKS, BODIES, PROPS, TRIM_IDS, HEAD_IDS, dressFor, namedLook, crowdLook, silhouette, packDress, unpackDress, tribeOf } = await import('../src/costumes.js');
const { LEVELS } = await import('../src/levels/index.js');
const { Crowd, figureGeometry, worldPieces } = await import('../src/crowd.js');
const { pooledNPC, NPC } = await import('../src/npc.js');
const { createBazaar } = await import('../src/levels/bazaar.js');
const { Physics } = await import('../src/physics.js');
const { mulberry32 } = await import('../src/noise.js');

const people = (world, n = 60, o = {}) => { const rng = mulberry32(3); return Array.from({ length: n }, () => crowdLook(rng, { world, ...o })); };
const MAIN = ['desert', 'incal', 'arzach', 'arzach2', 'garage', 'buried', 'edena', 'spheres', 'perdide', 'perdide2', 'bazaar'];

test('every world has a costume set, built from pieces that exist', () => {
  for (const { id } of LEVELS) {
    assert.ok(COSTUMES[id], `${id} has no costumes`);
    for (const t of COSTUMES[id].tribes) {
      for (const h of [...Object.keys(t.heads), ...Object.values(t.as)]) assert.ok(HEADS[h] && HEAD_IDS.includes(h), `${id}: headwear ${h}`);
      for (const m of Object.keys(t.masks)) assert.ok(MASKS[m], `${id}: mask ${m}`);
      for (const b of Object.keys(t.body)) assert.ok(BODIES[b], `${id}: chest piece ${b}`);
      for (const p of Object.keys(t.props)) assert.ok(PROPS[p], `${id}: prop ${p}`);
      for (const k of Object.keys(t.trim)) assert.ok(TRIM_IDS.includes(k), `${id}: pattern ${k}`);
    }
    // the crowd figure bakes in only the world's own pieces, and stays light (stage 3's headwear raised it: from
    // 1500 / 400 triangles; measured, the busiest crowds draw 8-12 % more triangles, the frame time the same: docs/makehuman.md)
    const mid = figureGeometry('mid', id), far = figureGeometry('far', id);
    assert.ok(mid.index.count / 3 < 2500 && far.index.count / 3 < 600, `${id}: ${mid.index.count / 3} / ${far.index.count / 3} triangles`);
    assert.ok(mid.attributes.position.count < 2500, `${id}: ${mid.attributes.position.count} vertices`);
  }
});

test('the worlds dress apart: silhouettes and palettes differ from world to world', () => {
  const looks = Object.fromEntries(MAIN.map((w) => [w, people(w)]));
  const set = (w, k) => new Set(looks[w].map((s) => s[k]));
  const top = (w) => { const c = {}; for (const s of looks[w]) c[s.head] = (c[s.head] ?? 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; };
  for (let i = 0; i < MAIN.length; i++) for (let j = i + 1; j < MAIN.length; j++) {
    const a = MAIN[i], b = MAIN[j];
    const sig = (w) => [...set(w, 'head')].sort().join() + '|' + [...set(w, 'body')].sort().join() + '|' + [...set(w, 'prop')].sort().join();
    assert.notEqual(sig(a), sig(b), `${a} and ${b} wear the same pieces`);
    const shared = [...set(a, 'cloak')].filter((c) => set(b, 'cloak').has(c));
    assert.ok(shared.length < Math.min(set(a, 'cloak').size, set(b, 'cloak').size), `${a} and ${b} share every cloak colour`);
  }
  // most people of each world wear that world's own headwear
  assert.equal(top('desert'), 'headcloth'); assert.equal(top('arzach'), 'cowl'); assert.equal(top('garage'), 'antenna');
  assert.equal(top('spheres'), 'orb'); assert.equal(top('perdide2'), 'lamphat'); assert.equal(top('bazaar'), 'turban');
  // two far-apart worlds share no headwear at all
  assert.equal([...set('desert', 'head')].filter((h) => set('arzach', 'head').has(h)).length, 0);
  assert.equal([...set('garage', 'head')].filter((h) => set('arzach', 'head').has(h)).length, 0);
  // skins: the Hangar's grey-blue and Lorn's pale violet aren't anyone else's
  assert.ok([...set('garage', 'skin')].every((c) => !set('desert', 'skin').has(c)));
  assert.ok([...set('perdide', 'skin')].every((c) => !set('bazaar', 'skin').has(c)));
});

test('the City-Shaft dresses by depth: tall hats on the rim, rag hoods and goggles at the bottom', () => {
  const rim = people('incal', 40, { pos: new THREE.Vector3(0, 200, 0) }), low = people('incal', 40, { spot: { id: 'lower' } });
  assert.match(tribeOf('incal', { pos: new THREE.Vector3(0, 200, 0) }).name, /rim/);
  assert.ok(rim.filter((s) => ['tophat', 'spire', 'bowler', 'trilby'].includes(s.head)).length > 28);
  assert.ok(rim.filter((s) => s.head === 'tophat' || s.head === 'spire').length > 18, 'mostly the tall ones');
  assert.ok(rim.every((s) => s.head !== 'raghood'));
  assert.ok(low.filter((s) => ['raghood', 'hood', 'beanie', 'trapper', 'bandana'].includes(s.head)).length > 32);
  assert.ok(low.filter((s) => s.head === 'raghood' || s.head === 'hood').length > 18, 'mostly the rag hoods');
  assert.ok(low.some((s) => s.mask === 'goggles' || s.mask === 'browgoggles'));
  assert.ok(rim.every((s) => !low.some((l) => l.cloak === s.cloak)));
});

test('a named person keeps their colours, in their world’s style, the same every time', () => {
  const palette = { cloak: '#c8483a', cloth: '#5a4a3a', legs: '#2b2f45', hat: '#f3ead8', hair: '#2b211f' };
  const a = namedLook({ world: 'desert', id: 'ama', palette, head: 'hat', cape: 1.25 });
  const b = namedLook({ world: 'desert', id: 'ama', palette, head: 'hat', cape: 1.25 });
  assert.deepEqual(a, b);
  for (const k of Object.keys(palette)) assert.equal(a[k], palette[k]);
  assert.equal(a.head, 'sunhat');
  assert.equal(a.capeLen, 1.25);
  assert.equal(namedLook({ world: 'incal', id: 'x', palette, head: 'hat', pos: new THREE.Vector3(0, 200, 0) }).head, 'tophat');
  assert.equal(namedLook({ world: 'arzach', id: 'x', palette, head: 'hood' }).head, 'cowl');
  // the story can pin a piece
  assert.equal(namedLook({ world: 'desert', id: 'speaker', palette, look: { prop: 'staff' } }).prop, 'staff');
});

test('the crowd shader reads back exactly what each person wears', () => {
  for (const w of MAIN) for (const s of people(w, 20)) {
    const d = packDress(s);
    assert.deepEqual(unpackDress(d.dress, d.w), silhouette(s));
    for (const v of [...d.dress, d.w]) assert.ok(Number.isFinite(v) && Math.abs(v) < 2 ** 24);
  }
  // the figure has every piece the world's crowd can wear
  const W = worldPieces('bazaar');
  for (const s of people('bazaar')) { assert.ok(W.heads.includes(s.head)); if (s.prop !== 'none') assert.ok(W.props.includes(s.prop)); }
});

test('a crowd person promoted to a full NPC keeps their look', () => {
  const scene = new THREE.Scene();
  const level = createBazaar(scene);
  const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
  level.init?.(physics);
  const crowd = new Crowd(scene, physics, { spots: level.crowdSpots(), makeNPC: (kind) => pooledNPC(scene, physics, { kind }) });
  assert.equal(crowd.world, 'bazaar');
  const p = crowd.people[17], e = crowd.pool.find((x) => x.kind === p.kind);
  crowd.promote(e, p);
  const npc = e.npc;
  assert.equal(npc.look, p.style);
  assert.deepEqual(silhouette(npc.look), unpackDress(p.look[2], p.look[1][3]));
  assert.equal(npc.char.colors.cloak, p.style.cloak);
  assert.equal(npc.object.scale.x, p.size);
  assert.equal(!!npc.cape, p.style.capeLen > 0);
  if (npc.cape) assert.equal(npc.cape.rows, p.style.capeLen > 1 ? 8 : 6);
  crowd.demote(e);
  // and a story person in this world is dressed in the market's style
  const sel = new NPC(scene, physics, { route: [new THREE.Vector3()], palette: { cloak: '#88b4b5', hat: '#f0a083' }, lines: ['…'], head: 'wrap', world: 'bazaar', def: { id: 'sel' } });
  assert.equal(sel.look.head, 'turban');
  assert.equal(sel.look.cloak, '#88b4b5');
  crowd.dispose();
});
