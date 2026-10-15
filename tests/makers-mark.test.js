import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MARK_CANDIDATES, candidateGeometry, reviewMark, activeMark } from '../src/makers-mark/candidates.js';
import { glyphGeometry } from '../src/story/sign-text.js';
import { reviewStorage } from '../src/cinematics-page/storage.js';

test('option 4 is the live glyph; alternatives require an explicit review URL', () => {
  assert.equal(reviewMark('?mark=listening'), null);
  assert.equal(reviewMark('?markReview=1&mark=unknown'), null);
  assert.equal(reviewMark('?markReview=1&mark=current'), null);
  assert.equal(reviewMark('?markReview=1&mark=listening'), 'listening');
  assert.equal(activeMark(''), 'corner');
  assert.equal(activeMark('?mark=listening'), 'corner');
  assert.equal(activeMark('?markReview=1&mark=current'), null);
  assert.equal(activeMark('?markReview=1&mark=listening'), 'listening');
  const g = glyphGeometry(2); assert.equal(g.userData.makersMark, 'corner'); g.dispose();
});
test('all five selected silhouettes remain centred, finite and within their allotted square', () => {
  assert.equal(MARK_CANDIDATES.length, 5);
  for (const mark of MARK_CANDIDATES) for (const size of [.3, 3.5, 9]) {
    const g = candidateGeometry(mark.id, size, .08);
    assert.ok([...g.attributes.position.array, ...g.attributes.normal.array].every(Number.isFinite));
    g.computeBoundingBox(); const b = g.boundingBox, s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    assert.ok(Math.abs(Math.max(s.x,s.y)-size)<1e-5, mark.id);
    assert.ok(c.length()<1e-5, `${mark.id} is centred`);
    assert.ok(Math.abs(s.z-.08)<1e-6);
    assert.ok(s.x>size*.35 && s.y>size*.35);
    assert.ok(g.attributes.position.count>30); g.dispose();
  }
});
test('mark review storage is ephemeral even before save-slot initialization', () => {
  const a = reviewStorage('?markReview=1&mark=corner'); a.setItem('hiraeth.slot','3');
  assert.equal(a.getItem('hiraeth.slot'),'3');
  assert.equal(reviewStorage('?markReview=1').getItem('hiraeth.slot'),null);
  assert.equal(reviewStorage('?mark=corner'),null);
});
test('review mute is applied at audio construction, before later review staging', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url),'utf8');
  assert.match(main, /new Sound\(levelId, \{ muted:[^\n]+query\.has\('markReview'\)[^\n]+true/);
});


test('curved ink follows its surface and keeps the gap between the two strokes', async () => {
  const { markOnSurface } = await import('../src/makers-mark/surface.js');
  const g = markOnSurface(2, (x,y) => new THREE.Vector3(x,y,.2*(x*x+y*y)));
  const p=g.attributes.position;
  assert.ok(p.count>100);
  for(let i=0;i<p.count;i++) assert.ok(Math.abs(p.getZ(i)-.2*(p.getX(i)**2+p.getY(i)**2))<1e-6);
  assert.ok([...g.attributes.normal.array].every(Number.isFinite));g.dispose();
});

// The old mark (three dots over an arc) is drawn nowhere now but in the shared fallback a review URL can ask for
// (?markReview=1&mark=current): a run of three dots with a partial ring under it, in any source but the shared code.
// (The futuristic skins, src/temples/skins/, are scanned too: they take the shared mark, see below; src/levels/dismissed/
// is not in the game.)
test('no source draws the old dots-over-arc mark: every glyph is the shared one', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const root = new URL('../src/', import.meta.url).pathname, files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!/^(makers-mark|dismissed)$/.test(f)) walk(p); } else if (p.endsWith('.js')) files.push(p); } };
  walk(root);
  // three dots in a row (x offsets -a, 0, a, or [x, y] pairs), each a disc, a cylinder seen end-on or a sphere
  const dots = /(for \(const [^)]*of |\(\[)\[\s*(\[\s*)?-[\d.]+[^\n]*?\b0\b[^\n]*?(Circle|Cylinder|Sphere)Geometry/;
  const arc = /TorusGeometry\([^\n]*Math\.PI(\s*\*\s*0?\.\d+)?\s*\)/;
  const found = [];
  for (const f of files) {
    const L = readFileSync(f, 'utf8').split('\n');
    for (let i = 0; i < L.length; i++) {
      if (!dots.test(L[i]) || !L.slice(i, i + 3).some((l) => arc.test(l))) continue;
      if (L.slice(Math.max(0, i - 3), i).some((l) => /if \(candidate\)/.test(l))) continue;   // (the review fallback)
      found.push(`${f.slice(root.length)}:${i + 1}`);
    }
  }
  assert.deepEqual(found, [], 'the old mark is still drawn here');
  // the pebble token at Home (three dots alone) is the shared mark too
  assert.doesNotMatch(readFileSync(new URL('../src/levels/home.js', import.meta.url), 'utf8'), /for \(const x of \[-0\.022, 0, 0\.022\]\)/);
});

test('the temple kit draws the shared mark along its friezes: the Greenhouse, and the Rose House’s carved one without its skin', async () => {
  const { TempleKit, templeMaterials, prep } = await import('../src/temples/kit.js');
  const { TEMPLES } = await import('../src/temples/index.js');
  const shape = (g) => { g.computeBoundingBox(); const s = g.boundingBox.getSize(new THREE.Vector3()); return [g.attributes.position.count, +(s.x / s.y).toFixed(3)]; };
  const local = (K, g) => g.clone().applyMatrix4(K.inv);
  for (const id of ['edena', 'desert']) {
    const M = templeMaterials(TEMPLES[id].def.palette);
    const K = new TempleKit(new THREE.Group(), `${id} frieze`, new THREE.Vector3(), 0, M);
    K.frieze([-9, 0], [9, 0], 5, 'n');
    const glyphs = K.batches.get(M.glyph);
    assert.equal(glyphs.length, 5, `${id}: one glyph each 4.5 m`);
    const want = shape(prep(glyphGeometry(1.0, 0.12)));
    for (const g of glyphs) assert.deepEqual(shape(local(K, g)), want, `${id}: its frieze glyphs are the shared mark`);
    if (id !== 'desert') continue;
    // the Rose House's ornament: the same mark again, smaller, carved under each lit one (no three dots, no arc)
    const carved = shape(prep(glyphGeometry(0.8, 0.02)));
    const orn = [...K.batches.values()].flat().filter((g) => !glyphs.includes(g));
    assert.equal(orn.length, 5, 'one carved mark under each glyph');
    for (const g of orn) assert.deepEqual(shape(local(K, g)), carved);
  }
});

// ------------------------------------------------------------------ every temple skin wears the adopted mark
// A skin keeps its colour, glow and setting, never its own shape of the makers' sign: every sign in a skinned house
// (the frieze, the threshold, the doors' medallions, the cradles' hoods, the bells, the spout slab, the terminals) is
// the shared glyphGeometry's, found in the built house by its vertex signature (its outline up to size and pose).
import { readdirSync } from 'node:fs';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TEMPLES as skTEMPLES } from '../src/temples/index.js';
import { TempleRuntime as SkRuntime } from '../src/temples/runtime.js';
import { printGeometry as skPrint } from '../src/temples/pieces.js';
import { GameState as SkGame } from '../src/game-state.js';

const skRef = glyphGeometry(1, 0.06).attributes.position, skN = skRef.count;
const skF = [], skB = [];
for (let i = 0; i < skN; i++) (skRef.getZ(i) > 0 ? skF : skB).push(i);
const skV = (P, i) => new THREE.Vector3().fromBufferAttribute(P, i);
const skMid = (P, o, I) => { const c = new THREE.Vector3(); for (const i of I) c.add(skV(P, o + i)); return c.divideScalar(I.length); };
const skR = [skF, skB].map((I) => { const c = skMid(skRef, 0, I); return I.map((i) => skV(skRef, i).distanceTo(c)); });
// (a quick first look: three distances across the front face, in proportion as the mark's)
const skPairs = [[skF[0], skF[skF.length >> 1]], [skF[0], skF[skF.length - 1]], [skF[7], skF[(skF.length * 3) >> 2]]];
const skPR = skPairs.map(([a, b]) => skV(skRef, a).distanceTo(skV(skRef, b)));
/** The mark's size if the N vertices from o are the shared mark (any size, depth, pose), else 0. */
function skMarkAt(P, o) {
  const d = skPairs.map(([a, b]) => skV(P, o + a).distanceTo(skV(P, o + b)));
  const k0 = d[0] / skPR[0];
  if (!(k0 > 1e-4) || d.some((x, j) => Math.abs(x - k0 * skPR[j]) > 1e-3 * Math.max(1, k0))) return 0;
  let k = 0;
  for (const [s, I] of [skF, skB].entries()) {
    const c = skMid(P, o, I);
    for (let j = 0; j < I.length; j++) {
      const r = skR[s][j], e = skV(P, o + I[j]).distanceTo(c);
      if (r < 1e-3) continue;
      if (!k) k = e / r; else if (Math.abs(e - k * r) > 1e-3 * Math.max(1, k)) return 0;
    }
  }
  return k;
}
/** The shared marks in a geometry (merged ones, in order) and the sizes of what lies between them. */
function skMarks(g) {
  const P = g.attributes.position, marks = [], rest = [];
  let gap = null;
  const close = (e) => { const b = new THREE.Box3(); for (let i = gap; i < e; i++) b.expandByPoint(skV(P, i)); rest.push(Object.assign(b.getSize(new THREE.Vector3()), { n: e - gap })); gap = null; };
  for (let o = 0; o < P.count;) {
    const k = o + skN <= P.count ? skMarkAt(P, o) : 0;
    if (k) { if (gap !== null) close(o); marks.push(k); o += skN; } else { if (gap === null) gap = o; o++; }
  }
  if (gap !== null) close(P.count);
  return { marks, rest };
}
const skBuild = (def) => {
  const w = console.warn, l = console.log; console.warn = console.log = () => {};
  try { return new SkRuntime({ scene: new THREE.Scene(), level: { lights: [], ground: { baseAt: () => 0, heightAt: () => 0 } }, def: { ...def, exterior: null, change: null }, game: new SkGame(null) }); }
  finally { console.warn = w; console.log = l; }
};
const skMeshes = (o) => { const out = []; o.traverse((m) => { if (m.isMesh) out.push(m); }); return out; };
const skBare = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };
// Lights in a house's glyph material that are not signs, named one by one: the Footprint's (spheres.js) walker's print
// over its door, a three-toed footprint, the house's own emblem (printGeometry(3, 2.4)), drawn by the temple, not a skin.
const skAllow = { spheres: [skBare(skPrint(3, 2.4)).attributes.position.count] };
const skAllowed = (id, s) => (skAllow[id] ?? []).includes(s.n);

test('the vertex signature knows the shared mark at any size and pose, and not the old arch under three dots', () => {
  const g = glyphGeometry(2.3, 0.2).rotateY(0.7).rotateX(-Math.PI / 2).translate(4, 1, -3);
  assert.deepEqual(skMarks(g).marks.map((k) => +k.toFixed(3)), [2.3]);
  const two = mergeGeometries([glyphGeometry(0.4, 0.03), new THREE.BoxGeometry(1, 1, 1), glyphGeometry(1.1, 0.1).rotateY(Math.PI)].map(skBare));
  assert.equal(skMarks(two).marks.length, 2);
  // (the arch under three dots the skins once drew in its place)
  const arch = mergeGeometries([new THREE.TorusGeometry(1, 0.045, 4, 18, Math.PI * 0.6), ...[-0.2, 0, 0.2].map((x) => new THREE.CylinderGeometry(0.055, 0.055, 0.06, 8).translate(x, 0.27, 0))].map(skBare));
  assert.equal(skMarks(arch).marks.length, 0);
});

test('no temple skin draws its own sign: each takes the shared makers’ mark (story/sign-text.js glyphGeometry)', () => {
  const dir = new URL('../src/temples/skins/', import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(src, /function\s+(signGeometry|engineSign|belfrySign|\w*Sign)\s*\(/, `${f} draws a sign of its own`);
    assert.doesNotMatch(src, /candidateGeometry|makers-mark\/candidates\.js/, `${f} picks a mark itself, not the shared glyphGeometry`);
  }
});

test('every skinned house’s signs are the shared makers’ mark: friezes, threshold, doors, cradles, bells, spout', () => {
  const houses = Object.entries(skTEMPLES).filter(([, t]) => t.def.skin);
  assert.ok(houses.length >= 10, `${houses.length} skinned houses`);
  for (const [id, t] of houses) {
    const rt = skBuild(t.def), glyph = rt.skin.mats?.glyph ?? rt.M.glyph;
    // the friezes' and the threshold's glyphs: nothing in the house's glyph light but the mark (and the rings lying flat
    // round the chests' mounds)
    let frieze = 0;
    for (const m of rt.kit.group.children.filter((m) => m.material === glyph)) {
      const { marks, rest } = skMarks(m.geometry);
      frieze += marks.length;
      for (const s of rest) assert.ok(s.y < 0.25 || skAllowed(id, s), `${id}: a ${s.toArray().map((x) => x.toFixed(2)).join(' by ')} shape stands in the glyphs' light that is not the mark`);
    }
    assert.ok(frieze > 40, `${id}: ${frieze} marks on its friezes`);
    // the doors' medallions, one on each face
    const doors = rt.pieces.filter((p) => p.constructor.name === 'Door' && p.glowMesh);
    assert.ok(doors.length >= 4, `${id}: ${doors.length} doors`);
    for (const d of doors) assert.equal(skMarks(d.glowMesh.geometry).marks.length, 2, `${id}: ${d.id}'s medallions`);
    // the house's own sign places
    const all = [...skMeshes(rt.kit.group), ...rt.pieces.flatMap((p) => { const o = p.group ?? p.mesh ?? p.root; return o?.isObject3D ? skMeshes(o) : []; })];
    const count = (pick) => all.filter(pick).reduce((n, m) => n + skMarks(m.geometry).marks.length, 0);
    if (id === 'desert') {
      assert.ok(count((m) => m.name === 'skin: lit lines, lenses and the daylight slots') >= 2, 'the Rose House: the mark on the spout slab');
      const terminals = all.filter((m) => m.name === 'brazier circuit');
      assert.ok(terminals.length >= 1);
      for (const m of terminals) assert.equal(skMarks(m.geometry).marks.length, 1, 'the Rose House: the mark on each obelisk terminal');
    }
    if (id === 'moonfoundry') {
      const hoods = all.filter((m) => m.name === 'cradle sign (skin)');
      assert.equal(hoods.length, 2);
      for (const m of hoods) assert.equal(skMarks(m.geometry).marks.length, 1, 'the Casting-House: the mark on each cradle’s hood');
      assert.equal(count((m) => m.name === 'skin: their lights'), 1, 'the Casting-House: the mark on the moon’s ring');
    }
    if (id === 'arzach2') assert.ok(count((m) => m.material === rt.skin.mats.cobalt) >= 2, 'the Founders’ Belfry: the mark on its bells');
  }
});
