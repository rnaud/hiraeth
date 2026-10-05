import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mulberry32 } from '../src/noise.js';
import { COSTUMES, HEADS, HEAD_IDS, HEAD_ID_LIMIT, HAIR_IDS, GENERIC_HAIR, lookPieces, scalp, curtain, dressFor, namedLook, crowdLook, packDress, unpackDress, hairstyleOf, tribeOf, hairCap } from '../src/costumes.js';
import { figureGeometry } from '../src/crowd.js';
import { PEOPLE } from '../src/ship/hologram.js';

// Hair on the skull's own shape (costumes.js scalp, curtain): every people wears its own hairstyles
// (tribe.hair), the parents on the recordings theirs, and the crowd figure carries them within its ids.

const finite = (g) => { const P = g.attributes.position; for (let i = 0; i < P.count; i++) if (!Number.isFinite(P.getX(i) + P.getY(i) + P.getZ(i))) return false; return true; };
const MAIN = ['desert', 'incal', 'arzach2', 'garage', 'edena', 'spheres', 'perdide', 'bazaar'];

test('every hairstyle builds on both skulls, full and in the crowd, and fits the shader ids', () => {
  assert.ok(HEAD_IDS.length <= HEAD_ID_LIMIT);
  for (const id of HAIR_IDS) {
    assert.ok(HEADS[id] && HEAD_IDS.includes(id), id);
    for (const kind of ['m', 'f']) for (const q of [1, 0.5, 0.3]) {
      const s = dressFor('bazaar', mulberry32(2), { kind, look: { head: id, mask: 'none' } });
      for (const p of lookPieces(s, q).head) assert.ok(p.geo.attributes.position.count > 0 && finite(p.geo), `${kind} ${id} q${q}`);
    }
  }
  // the hair cap (under hats, the base of most styles) has a hairline: off the brow, up round the ears, down at the nape
  const g = hairCap(1).geo, P = g.attributes.position;
  let brow = Infinity, ear = Infinity, nape = Infinity;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), az = Math.abs(Math.atan2(x, z)) * 180 / Math.PI;
    if (az < 8) brow = Math.min(brow, y); else if (az > 95 && az < 108) ear = Math.min(ear, y); else if (az > 172) nape = Math.min(nape, y);
  }
  assert.ok(brow > 0.045 && ear > -0.005 && nape < -0.06, `hairline: brow ${brow.toFixed(3)}, over the ear ${ear.toFixed(3)}, nape ${nape.toFixed(3)}`);
  // long hair hangs below the skull, open at the face
  const c = curtain(1, { bottom: -0.25 }), C = c.attributes.position;
  let low = Infinity, faceOpen = true;
  for (let i = 0; i < C.count; i++) { low = Math.min(low, C.getY(i)); if (C.getZ(i) > 0.06 && Math.abs(C.getX(i)) < 0.03) faceOpen = false; }
  assert.ok(low < -0.24 && faceOpen);
  // a tonsure leaves the crown bare
  let top = -Infinity;
  const t = scalp(1, { top: 56 }).attributes.position;
  for (let i = 0; i < t.count; i++) top = Math.max(top, t.getY(i));
  assert.ok(top < 0.1, 'the crown shaved');
});

test('each people has its own hairstyles: bare heads, story people\'s too, seeded and kept', () => {
  const styles = {};
  for (const world of MAIN) {
    const rng = mulberry32(5), krng = mulberry32(6), seen = new Set();
    for (const t of COSTUMES[world].tribes) for (const k of ['m', 'f']) for (const id of Object.keys(t.hair[k])) assert.ok(HAIR_IDS.includes(id), `${world}: ${id}`);
    for (let i = 0; i < 500; i++) {
      const pos = { y: [200, 150, 36, -100][i % 4] }, s = crowdLook(rng, { world, kind: krng() < 0.5 ? 'm' : 'f', pos });
      if (GENERIC_HAIR.includes(s.head)) assert.ok(tribeOf(world, { pos }).hair[s.kind][s.head], `${world}: a bare head is drawn in the tribe's hair, not '${s.head}'`);
      if (HAIR_IDS.includes(s.head)) seen.add(s.head);
      if (s.kind === 'f') assert.notEqual(s.head, 'bald');
    }
    assert.ok(seen.size >= 3, `${world}: ${[...seen]}`);
    styles[world] = [...seen].sort().join();
  }
  // no two peoples share their whole set
  const sets = Object.values(styles);
  assert.equal(new Set(sets).size, sets.length, JSON.stringify(styles));
  // a story person with a bare head ('hair') wears their people's: the same on every visit
  const kip = namedLook({ world: 'bazaar', id: 'kip', head: 'hair', kind: 'f' });
  assert.ok(Object.keys(COSTUMES.bazaar.tribes[0].hair.f).includes(kip.head), kip.head);
  assert.deepEqual(namedLook({ world: 'bazaar', id: 'kip', head: 'hair', kind: 'f' }), kip);
  const tiv = namedLook({ world: 'arzach2', id: 'tiv', head: 'hair', kind: 'm' });
  assert.ok(['tonsure', 'shaved', 'bald'].includes(tiv.head), `the bell monastery: ${tiv.head}`);
  // and a story override is kept as it is
  assert.equal(dressFor('desert', mulberry32(3), { kind: 'f', look: { head: 'hair' } }).head, 'hair');
  assert.equal(hairstyleOf(tribeOf('garage'), 'm', 0.01), 'crest');
});

test('the crowd packs head ids past 32 with the hair cap, and the figures stay light', () => {
  for (const head of ['tonsure', 'twin', 'swept', 'short', 'crest']) {
    const s = { head, mask: 'none', body: 'none', prop: 'none', robe: 0, capeLen: 0.9, capeWide: 1.1, trim: 'none' };
    const d = packDress(s);
    assert.equal(unpackDress(d.dress, d.w).head, head);
    assert.equal(d.dress[0] >= HEAD_ID_LIMIT, !!HEADS[head].cap, `${head}: the cap flag`);
  }
  // (the vertex budgets the crowd was built to: tests/costumes.test.js checks every world's)
  for (const world of MAIN) {
    const mid = figureGeometry('mid', world);
    assert.ok(mid.attributes.position.count < 1700 && mid.index.count / 3 < 1500, world);
  }
});

test('the parents on the recordings: his short brown hair and beard, her long dark hair down', () => {
  assert.equal(PEOPLE.father.look.head, 'short');
  assert.equal(PEOPLE.father.look.mask, 'beard');
  assert.equal(PEOPLE.mother.look.head, 'flow');
  assert.equal(PEOPLE.mother.kind, 'f');
  const mum = namedLook({ world: 'home', id: 'holo-mother', palette: PEOPLE.mother.palette, look: PEOPLE.mother.look, kind: 'f' });
  const hair = lookPieces(mum).head.filter((p) => p.role === 'hair');
  const box = new THREE.Box3();
  for (const p of hair) box.union(new THREE.Box3().setFromBufferAttribute(p.geo.attributes.position));
  assert.ok(box.min.y < -0.3, `down past her shoulders (${box.min.y.toFixed(2)})`);
});
