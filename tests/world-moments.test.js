// Every world's climax is filmed (src/story/film.js WORLD_MOMENTS): each route world has its moment,
// its module plays it with that id and flag, its world's story calls it, and every moment is short,
// once per save and skippable (src/story/moment.js; each world's own test plays it: tests/moments-<world>.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };

const { WORLD_MOMENTS, momentDef } = await import('../src/story/film.js');
const { ORDER } = await import('../src/levels/names.js');
const { Moment } = await import('../src/story/moment.js');
const src = (f) => readFileSync(new URL(`../src/story/${f}`, import.meta.url), 'utf8');

test('every route world has its climax filmed, registered once', () => {
  const ids = new Set(), flags = new Set();
  for (const w of ORDER) {
    assert.ok(WORLD_MOMENTS[w]?.length, `${w} has a moment`);
    for (const m of WORLD_MOMENTS[w]) {
      assert.ok(!ids.has(m.id) && !flags.has(m.flag), `unique: ${m.id}`);
      ids.add(m.id); flags.add(m.flag);
      assert.equal(momentDef(m.id), m);
      assert.ok(m.beat, `${m.id}: what it shows`);
    }
  }
});

test('each world’s module plays its moments with the registry’s id and flag, and its story calls it', async () => {
  for (const w of ORDER.filter((x) => x !== 'desert')) {
    const file = `${w}-moments.js`;
    assert.ok(existsSync(new URL(`../src/story/${file}`, import.meta.url)), file);
    const mod = await import(`../src/story/${file}`);
    assert.deepEqual(mod.MOMENTS.map((m) => [m.id, m.flag]), WORLD_MOMENTS[w].map((m) => [m.id, m.flag]), `${w}: as registered`);
    const code = src(file);
    for (const m of WORLD_MOMENTS[w]) {
      assert.ok(code.includes(`'${m.id}'`) && code.includes(`'${m.flag}'`), `${file} plays ${m.id}`);
      assert.ok(/moments\.play\(/.test(code), `${file} plays it on the stage`);
    }
    assert.ok(new RegExp(`from '\\./${w}-moments\\.js'`).test(src(`${w}.js`)), `${w}.js uses it`);
    assert.ok(existsSync(new URL(`./moments-${w}.test.js`, import.meta.url)), `${w}: its own test plays it`);
  }
});

test('a moment is skippable after its grace, and its end always runs', () => {
  const log = [];
  const m = new Moment({ id: 'x', flag: 'x.moment', dur: 9, shots: [{ dur: 9, from: { pos: { x: 0, y: 0, z: 0 }, look: { x: 0, y: 0, z: -1 } } }],
    stage: { bars() {}, hud() {}, skipTag() {}, say() {}, release() {}, game: { set() {} } }, onEnd: (mm, skipped) => log.push(skipped) });
  m.start();
  assert.equal(m.skip(), false, 'not in its first moments');
  for (let i = 0; i < 30; i++) m.update(1 / 30);
  assert.equal(m.skip(), true);
  m.update(1 / 30);
  assert.deepEqual(log, [true]);
});

test('riseLook: a long lens up at the sky keeps the horizon at the foot and the target inside the top (Vael’s panel B, the QC pass)', async () => {
  const { riseLook, V } = await import('../src/story/film.js');
  const D = Math.PI / 180, eye = V(0, 0, 0);
  const elev = (p) => Math.atan2(p.y, Math.hypot(p.x, p.z)) / D;
  for (const up of [5, 15, 25, 35]) {
    const target = V(0, Math.tan(up * D) * 200, -200);
    const { look, fov } = riseLook(eye, target, 30);
    const el = elev(look), h = fov / 2;
    assert.ok(up - el <= 0.5 * h + 1e-6, `${up}°: the target inside the frame's top (${(up - el).toFixed(1)}° of ${h})`);
    if (fov < 48) assert.ok(el <= 0.62 * h + 1e-6, `${up}°: the horizon in frame (${el.toFixed(1)}°)`);
    assert.ok(fov >= 30 && fov <= 48, `fov ${fov}`);
  }
  const low = riseLook(eye, V(0, 2, -100), 30);
  assert.equal(low.fov, 30, 'low over the horizon: the lens stays long');
  assert.ok(Math.abs(elev(low.look) - elev(V(0, 2, -100))) < 1e-6, 'and looks straight at it');
});
