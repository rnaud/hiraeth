import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

// People of different body shapes (issue #402, the author: "Add people with different body shapes so they don't
// all look the same (more slender, fatter)"): six builds from slender to heavy (costumes.js BUILDS; each a
// MakeHuman shape with its own girths on the mesh, src/makehuman/shape.js MH_BUILDS; the crowd figure's belly,
// hips and limbs in its aBody), at each world's odds (WORLD_BUILDS), from a hash of the look.

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
const { BUILDS, WORLD_BUILDS, BUILD_ODDS, buildOdds, dressFor, crowdLook, namedLook, packBody, bodyShapeCode, unpackBodyShape, BODY_STEP } = await import('../src/costumes.js');
const { mulberry32 } = await import('../src/noise.js');
const { capeCensus } = await import('../scripts/cape-census.mjs');
const { MH_BUILDS, buildMorph, buildMorphShare } = await import('../src/makehuman/shape.js');
const { BUILD_SHAPE, BODY_MORPHS } = await import('../src/morph.js');
const { CROWD_BODY } = await import('../src/crowd-shader.js');
const { parseBody } = await import('../src/makehuman/body.js');
const { personTemplate, withBuildMorph } = await import('../src/makehuman/people.js');
const { Humanoid, segmentGirths, CAPSULES } = await import('../src/humanoid.js');
const { buildCharacter } = await import('../src/player.js');

const IDS = ['slender', 'slim', 'average', 'broad', 'stout', 'heavy'];
const census = await capeCensus();
const crowdShare = (w) => {
  const c = census.worlds[w].builds.crowd, n = Object.values(c).reduce((a, b) => a + b, 0);
  return Object.fromEntries(IDS.map((b) => [b, (c[b] ?? 0) / n]));
};
const heft = (sh) => IDS.reduce((a, b, i) => a + sh[b] * (i - 2), 0);   // (slender -2 .. heavy +3)

test('six builds, slender to heavy, everywhere in the game: every world\'s crowd has thin and round people', () => {
  assert.deepEqual(Object.keys(BUILDS), IDS);
  assert.deepEqual(Object.keys(MH_BUILDS), IDS, 'each a MakeHuman shape');
  for (const k of ['m', 'f']) assert.deepEqual(Object.keys(BUILD_ODDS[k]), IDS);
  for (const [w, r] of Object.entries(census.worlds)) {
    if (!Object.keys(r.builds.crowd).length) continue;   // (home, the Lantern: no crowd)
    const sh = crowdShare(w);
    const used = IDS.filter((b) => sh[b] > 0);
    assert.equal(used.length, IDS.length, `${w}: every build in its crowd (${used})`);
    assert.ok(sh.average < 0.4, `${w}: no more than 40 % average (${(sh.average * 100).toFixed(0)} %)`);
    assert.ok(sh.slender + sh.slim >= 0.2, `${w}: thin people (${((sh.slender + sh.slim) * 100).toFixed(0)} %)`);
    assert.ok(sh.stout + sh.heavy >= 0.07, `${w}: round people (${((sh.stout + sh.heavy) * 100).toFixed(0)} %)`);
    assert.ok(sh.heavy <= 0.2, `${w}: the heavy a few (${(sh.heavy * 100).toFixed(0)} %)`);
  }
});

test('each world its own lean: the desert\'s pilgrims and the silent ones leaner, the market, the harbour and the foundry sturdier', () => {
  const lean = ['desert', 'arzach', 'underside', 'mangrove'], sturdy = ['bazaar', 'saltharbour', 'moonfoundry', 'eclipse'];
  const all = Object.keys(census.worlds).filter((w) => Object.keys(census.worlds[w].builds.crowd).length);
  const mean = all.reduce((a, w) => a + heft(crowdShare(w)), 0) / all.length;
  for (const w of lean) assert.ok(heft(crowdShare(w)) < mean, `${w} leaner than the mean (${heft(crowdShare(w)).toFixed(2)} < ${mean.toFixed(2)})`);
  for (const w of sturdy) assert.ok(heft(crowdShare(w)) > mean, `${w} sturdier than the mean (${heft(crowdShare(w)).toFixed(2)} > ${mean.toFixed(2)})`);
  for (const w of Object.keys(WORLD_BUILDS)) for (const b of Object.keys(WORLD_BUILDS[w])) assert.ok(IDS.includes(b), `${w}: ${b}`);
  assert.deepEqual(Object.keys(buildOdds('nowhere', 'f')), IDS);
});

test('a build is drawn from no random number: the streams are the same people, only their builds changed', () => {
  for (const world of ['desert', 'bazaar', 'incal', 'arzach']) {
    const stream = () => { const r = mulberry32(9); return Array.from({ length: 80 }, (_, i) => dressFor(world, r, { kind: i % 2 ? 'f' : 'm' })); };
    const was = WORLD_BUILDS[world];
    WORLD_BUILDS[world] = { slender: 0, slim: 0, average: 0, broad: 0, stout: 0, heavy: 1 };
    const heavy = stream();
    WORLD_BUILDS[world] = was;
    const now = stream();
    for (let i = 0; i < now.length; i++) {
      assert.equal(heavy[i].build, 'heavy');
      const { build: a, ...x } = now[i], { build: b, ...y } = heavy[i];
      assert.deepEqual(x, y, `${world} #${i}: the rest of the look`);
    }
    assert.ok(new Set(now.map((s) => s.build)).size >= 4, `${world}: a spread`);
  }
  // the same person, every time: a crowd person and the full body they become, a named person on every visit
  for (let seed = 1; seed < 30; seed++) {
    const a = crowdLook(mulberry32(seed), { world: 'bazaar', kind: seed % 2 ? 'f' : 'm' }), b = crowdLook(mulberry32(seed), { world: 'bazaar', kind: seed % 2 ? 'f' : 'm' });
    assert.equal(a.build, b.build);
  }
  assert.equal(namedLook({ world: 'desert', id: 'someone' }).build, namedLook({ world: 'desert', id: 'someone' }).build);
  // a build the story sets is kept; the young are seldom heavy
  assert.equal(dressFor('bazaar', mulberry32(3), { look: { build: 'slender' } }).build, 'slender');
  let young = 0, heavyYoung = 0;
  for (let i = 0; i < 400; i++) { const s = dressFor('bazaar', mulberry32(100 + i), { young: true, kind: i % 2 ? 'f' : 'm' }); young++; if (s.build === 'heavy') heavyYoung++; }
  assert.ok(heavyYoung / young < 0.06, `children and teenagers seldom heavy (${heavyYoung} of ${young})`);
});

test('the named people whose notes give them a body have it', () => {
  const who = Object.fromEntries(Object.values(census.worlds).flatMap((r) => r.built.map((t) => { const m = t.match(/^(.*) \((\w+)\)$/); return [m[1], m[2]]; })));
  const want = { 'Anselm Thrum': 'slender', Pashka: 'heavy' };
  for (const [name, b] of Object.entries(want)) assert.equal(who[name], b, name);
});

test('the crowd figure carries the build: shoulders, girth, and belly, hips and limbs packed over the female bit', () => {
  for (const b of IDS) {
    for (const kind of ['m', 'f']) {
      const s = { kind, build: b, eyes: '#4a2e20' };
      const p = packBody(s), u = unpackBodyShape(p[0]);
      assert.equal(u.fem, kind === 'f' ? 1 : 0);
      for (const k of ['belly', 'hips', 'limbs']) assert.ok(Math.abs(u[k] - BUILDS[b][k]) <= BODY_STEP / 2 + 1e-9, `${b} ${k}`);
      assert.equal(p[1], BUILDS[b].width); assert.equal(p[2], BUILDS[b].girth);
    }
  }
  assert.deepEqual(unpackBodyShape(1), { fem: 1, belly: 1, hips: 1, limbs: 1 }, 'an old aBody (0 / 1): neutral');
  assert.ok(Math.max(...IDS.map((b) => 2 * bodyShapeCode(BUILDS[b]) + 1)) < 2 ** 24, 'exact in a float');
  // the port's shader reads it the same way (unity/…/Crowd.hlsl)
  const hlsl = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Shaders/Crowd.hlsl', import.meta.url), 'utf8');
  assert.match(hlsl, /float fem = cmod\(aBody\.x, 2\.0\)/);
  assert.match(hlsl, new RegExp(`- 16\\.0\\) \\* ${BODY_STEP}`));
  assert.match(hlsl, new RegExp(`max\\(0\\.0, bg - 1\\.0\\) \\* ${CROWD_BODY.armOut}`));
  assert.match(hlsl, new RegExp(`\\(bHips - 1\\.0\\) \\* ${CROWD_BODY.hipPivot}\\)`));
  assert.match(hlsl, new RegExp(`\\(bBelly - 1\\.0\\) \\* ${CROWD_BODY.bellyF} \\* belly`));
});

test('the rig\'s limits: a build\'s girths stay within the body sliders, ordered thin to round; the head, hands and feet untouched', () => {
  const R = Object.fromEntries(BODY_MORPHS.map((d) => [d.key, d]));
  for (const b of IDS) {
    const m = MH_BUILDS[b].morph ?? {};
    for (const [k, v] of Object.entries(m)) {
      assert.ok(['shoulders', 'chest', 'belly', 'hips', 'arms', 'legs', 'neck'].includes(k), `${b}: ${k} is a girth`);
      assert.ok(v >= R[k].min && v <= R[k].max, `${b}: ${k} ${v} within ${R[k].min}..${R[k].max}`);
    }
    assert.ok(MH_BUILDS[b].weight >= 0 && MH_BUILDS[b].weight <= 1 && MH_BUILDS[b].muscle >= 0 && MH_BUILDS[b].muscle <= 1, `${b}: MakeHuman's own range`);
    assert.ok(b === 'average' || BUILD_SHAPE[b], `${b}: the Quaternius bodies (?mh=0) have it too`);
    assert.ok((BUILDS[b].armOut ?? 0) <= 0.25, `${b}: arms held out at most 0.25`);
  }
  // a child takes none of a build's girths, a teenager some, a grown-up all
  assert.equal(buildMorph('heavy', buildMorphShare(8)), null);
  assert.ok(buildMorph('heavy', buildMorphShare(15)).belly < MH_BUILDS.heavy.morph.belly);
  assert.deepEqual(buildMorph('heavy', buildMorphShare(40)), MH_BUILDS.heavy.morph);
  // a story person's own body morph on top: the girths multiply
  assert.equal(withBuildMorph({ belly: 1.2 }, { belly: 1.1, legLength: 0.9 }).belly, 1.2 * 1.1);
  assert.equal(withBuildMorph({ belly: 1.2 }, { legLength: 0.9 }).legLength, 0.9);
});

const bin = readFileSync(new URL('../public/anim/mh/body.bin', import.meta.url));
const data = parseBody(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

test('on the MakeHuman bodies: thin to round round the trunk, limbs to match, the skeleton and the head as they were', () => {
  for (const kind of ['m', 'f']) {
    const t = personTemplate(data, { kind, world: 'bazaar' });
    const h = new Humanoid(t, buildCharacter(), kind);
    const bones = h.body.skeleton.bones.map((b) => b.position.clone());
    const head = h.b.Head.position.clone();
    const g = {};
    for (const b of IDS) {
      h.setBuild(b, 32);
      g[b] = segmentGirths(h.body, 0.9, h.body.geometry);
      assert.deepEqual(h.body.skeleton.bones.map((x) => x.position.clone()), bones, `${kind} ${b}: the skeleton unchanged (feet, hands, props, hats)`);
      assert.ok(h.b.Head.position.equals(head));
    }
    const at = (n) => CAPSULES.findIndex(([a]) => a === n);
    for (const [seg, lo, hi] of [['pelvis', 1.6, 3.2], ['thigh_l', 1.3, 3.5], ['upperarm_l', 1.3, 2.2]]) {
      const i = at(seg), r = g.heavy[i] / g.slender[i];
      assert.ok(r > lo && r < hi, `${kind} ${seg}: heavy ${(g.heavy[i] * 100).toFixed(1)} cm / slender ${(g.slender[i] * 100).toFixed(1)} cm = ${r.toFixed(2)}`);
      // (thin to round: broad is the muscled one beside them)
      const chain = ['slender', 'slim', 'average', 'stout', 'heavy'];
      for (let k = 1; k < chain.length; k++) assert.ok(g[chain[k]][i] > g[chain[k - 1]][i], `${kind} ${seg}: ${chain[k]} fuller than ${chain[k - 1]}`);
      assert.ok(g.broad[i] >= g.average[i] * 0.9, `${kind} ${seg}: broad hardly thinner than average`);
    }
    assert.equal(h.armOut, BUILDS.heavy.armOut, 'the heavy hold their arms out');
    h.setBuild('heavy', 8);
    assert.equal(h.armOut, 0, 'a child\'s arms as they hang');
  }
});
