import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildFlask, setStage, TANK, tankRadiusAt, tankGlassMeasure } from '../src/fluid-tool.js';
import { makeMaterial } from '../src/materials.js';
import { buildItemModel } from '../src/boxes/model.js';
import { BACKPACK_STAGES, backpackStage } from '../src/items.js';

// The makers' battery (issue #799, references/characters/battery/bracer/: the author's pick, the battery in the glove's
// bracer; it hung at his hip from #728): a slim turquoise glass cell of lavender fluid between domed brass end caps,
// dark rims and two brass rails, set in a leather bracer on his forearm (tests/battery-bracer.test.js); its three
// stages, one per strength found.

const glassMat = () => makeMaterial({ color: '#ffffff', fluid: 'tank', fluidBox: [0, TANK.full, TANK.radius, 0], fluidBase: TANK.base });
const visibleBox = (root) => { const b = new THREE.Box3(); root.updateMatrixWorld(true); root.traverse((o) => { for (let w = o; w; w = w.parent) if (!w.visible) return; if (o.isMesh) b.expandByObject(o); }); return b; };
const colours = (root) => { const s = new Set(); root.traverse((o) => { if (o.isMesh) for (const m of [o.material].flat()) if (m.uniforms?.uColor && !m.uniforms.uFluidA) s.add('#' + m.uniforms.uColor.value.getHexString()); }); return s; };

test('a slim glass cell between two domed end caps, forearm-sized: its fluid standing at the magic bar\'s level', () => {
  const { group, glass } = buildFlask(glassMat(), { stage: 0, worn: false });
  const box = visibleBox(group), size = box.getSize(new THREE.Vector3());
  const across = Math.max(size.x, size.z), tall = size.y;
  assert.ok(across > 0.025 && across < 0.04, `about 3 cm across with its rails (${across.toFixed(3)} m)`);
  assert.ok(tall > 0.08 && tall < 0.1, `about 9 cm long, end cap to end cap (${tall.toFixed(3)} m)`);
  assert.ok(tall / across > 2.4 && tall / across < 3.6, 'slim: a cell along the forearm, as the reference draws it');
  // the glass: a cylinder (open: its ends inside the caps), the caps a little wider and rounded
  const g = new THREE.Box3().setFromObject(glass);
  assert.ok(Math.abs(g.max.x - TANK.radius) < 1e-3 && Math.abs(g.min.y - TANK.glass.y0) < 1e-6 && Math.abs(g.max.y - TANK.glass.y1) < 1e-6);
  assert.ok(TANK.capR > TANK.radius, 'the endcaps stand proud of the glass');
  assert.ok(tankRadiusAt(TANK.center) === TANK.radius && tankRadiusAt(0) < TANK.capR * 0.7 && tankRadiusAt(TANK.height) < TANK.capR * 0.7, 'rounded ends');
  assert.ok(tankGlassMeasure(new THREE.Vector3(0, TANK.center, 0)) < 1 && tankGlassMeasure(new THREE.Vector3(TANK.radius * 1.2, TANK.center, 0)) > 1);
  // the shader's battery branch: uFluidDomeK under 0, the glass's box for the fill
  assert.equal(glass.material.uniforms.uFluidDomeK.value, -1);
  assert.deepEqual(glass.material.uniforms.uFluidBox.value.toArray().slice(0, 3), [TANK.glass.y0, TANK.full, TANK.radius]);
  const share = (TANK.full - TANK.glass.y0) / (TANK.glass.y1 - TANK.glass.y0);
  assert.ok(share > 0.6 && share < 0.9, `full, the fluid stands ${share.toFixed(2)} up the glass: a band of turquoise glass over it, as the reference`);
  assert.ok(TANK.glow[1] > TANK.glow[0], 'it glows brighter the fuller the bar');
});

test('lavender fluid, brass caps and rails; nothing else on it (its bracer holds it); the item picture is the same battery', () => {
  const { group, glass, lights } = buildFlask(glassMat(), { stage: 0 });
  assert.equal('#' + glass.material.uniforms.uFluidBase.value.getHexString(), TANK.base);
  const base = new THREE.Color(TANK.base);
  assert.ok(base.b > base.g && base.r > base.g, 'lavender: violet, not jade');
  assert.deepEqual(lights, [], 'no charge lights: the fluid\'s level is the bar');
  const c = colours(group);
  for (const k of ['#c8903f', '#7d5a2e']) assert.ok(c.has(k), `${k} (the brass, its dark rims)`);
  assert.ok(!c.has('#e4dbbb'), 'no cream ceramic: brass caps, as the reference');
  // nothing on its sides past its rails (the bracer's brackets hold it: src/battery-bracer.js)
  const b = visibleBox(group);
  assert.ok(b.max.z < TANK.capR + 0.002 && b.min.z > -TANK.capR - 0.002, 'nothing on its back or its face');
  // nothing hangs off it: no hose, no cord, no strap (the author: no tether)
  let tubes = 0; group.traverse((o) => { if (o.isMesh && /hose|cord|strap|tether/i.test(o.name)) tubes++; });
  assert.equal(tubes, 0);
  const item = buildItemModel('backpack');
  let fluid = null;
  item.traverse((o) => { if (o.isMesh && o.material?.uniforms?.uFluidBase) fluid = o; });
  assert.ok(fluid && fluid.geometry.attributes.position.count === glass.geometry.attributes.position.count, 'the item\'s picture: the same glass');
});

test('the stages: the lift valve, the wings and the Warden\'s bellows each add their parts (a valve wheel, a band, a second valve)', () => {
  assert.deepEqual(BACKPACK_STAGES, ['doublejump', 'glider', 'fan'], 'the double jump is its first strength (the Warden\'s Well\'s gust fan the third: issue #377, the bellows before)');
  assert.equal(backpackStage(() => false), 0);
  assert.equal(backpackStage((id) => id === 'doublejump'), 1);
  assert.equal(backpackStage((id) => ['doublejump', 'glider', 'fan'].includes(id)), 3);
  assert.equal(backpackStage((id) => ['doublejump', 'glider', 'wardenbellows'].includes(id)), 2, 'the bellows, found earlier on the route now (Lorn\'s court), are no stage');
  assert.equal(backpackStage((id) => ['doublejump', 'glider', 'jetpack'].includes(id)), 3, 'the debug jets count as the bellows');
  const f = buildFlask(glassMat(), { stage: 0 });
  assert.equal(f.stages.length, 4);
  const counts = [];
  for (let s = 0; s <= 3; s++) {
    setStage(f, s);
    f.stages.forEach((g, i) => { if (g) assert.equal(g.visible, i <= s, `stage ${s}: its parts and those below it, ${i}`); });
    let n = 0; f.group.traverse((o) => { for (let w = o; w; w = w.parent) if (!w.visible) return; if (o.isMesh) n++; });
    counts.push(n);
  }
  for (let s = 1; s <= 3; s++) assert.ok(counts[s] > counts[s - 1], `stage ${s} adds something to see (${counts.join(' < ')})`);
  setStage(f, 0); const z0 = visibleBox(f.group).min.z;
  setStage(f, 1);
  assert.ok(visibleBox(f.group).min.z < z0 - 0.003, 'the lift valve\'s wheel on the top cap\'s face, out from his arm');
});
