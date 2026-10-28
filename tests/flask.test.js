import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildFlask, setStage, TANK, tankRadiusAt, tankGlassMeasure } from '../src/fluid-tool.js';
import { makeMaterial } from '../src/materials.js';
import { buildItemModel } from '../src/boxes/model.js';
import { BACKPACK_STAGES, backpackStage } from '../src/items.js';

// The makers' battery (issue #728, references/Core Objects/Makers Battery/selected-2026-10-28/: the author's pick, a
// hip lantern, no tether): a broad turquoise glass cylinder of lavender fluid between rounded cream ceramic endcaps,
// brass rims and two brass rails, a rigid clip on its back toward his hip; its three stages, one per strength found.

const glassMat = () => makeMaterial({ color: '#ffffff', fluid: 'tank', fluidBox: [0, TANK.full, TANK.radius, 0], fluidBase: TANK.base });
const visibleBox = (root) => { const b = new THREE.Box3(); root.updateMatrixWorld(true); root.traverse((o) => { for (let w = o; w; w = w.parent) if (!w.visible) return; if (o.isMesh) b.expandByObject(o); }); return b; };
const colours = (root) => { const s = new Set(); root.traverse((o) => { if (o.isMesh) for (const m of [o.material].flat()) if (m.uniforms?.uColor && !m.uniforms.uFluidA) s.add('#' + m.uniforms.uColor.value.getHexString()); }); return s; };

test('a broad glass cylinder between two rounded endcaps, hip-sized: its fluid standing at the magic bar\'s level', () => {
  const { group, glass } = buildFlask(glassMat(), { stage: 0, worn: false });
  const box = visibleBox(group), size = box.getSize(new THREE.Vector3());
  const across = Math.max(size.x, size.z), tall = size.y;
  assert.ok(across > 0.11 && across < 0.16, `about 12–15 cm across with its rails (${across.toFixed(3)} m)`);
  assert.ok(tall > 0.2 && tall < 0.26, `about 23 cm tall, endcap to endcap (${tall.toFixed(3)} m)`);
  assert.ok(tall / across > 1.5 && tall / across < 2.3, 'broad: a stout capsule, as the reference draws it, not a slim tube');
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
  assert.ok(share > 0.6 && share < 0.85, `full, the fluid stands ${share.toFixed(2)} up the glass: a band of turquoise glass over it, as the reference`);
  assert.ok(TANK.glow[1] > TANK.glow[0], 'it glows brighter the fuller the bar');
});

test('lavender fluid, cream ceramic, brass rims and rails; the clip only when worn; the item picture is the same battery', () => {
  const { group, glass, lights } = buildFlask(glassMat(), { stage: 0 });
  assert.equal('#' + glass.material.uniforms.uFluidBase.value.getHexString(), TANK.base);
  const base = new THREE.Color(TANK.base);
  assert.ok(base.b > base.g && base.r > base.g, 'lavender: violet, not jade');
  assert.deepEqual(lights, [], 'no charge lights: the fluid\'s level is the bar');
  const c = colours(group);
  for (const k of ['#e4dbbb', '#c8903f', '#6f7550']) assert.ok(c.has(k), `${k} (ceramic, brass, the clip's plate)`);
  // the clip on its +z side (toward his hip), nothing on its other sides
  const worn = visibleBox(group), bare = buildFlask(glassMat(), { worn: false, stage: 0 }).group, b = visibleBox(bare);
  assert.ok(worn.max.z > TANK.clip.z + TANK.clip.d, 'the clip behind it, toward him');
  assert.ok(b.max.z < TANK.capR + 0.01, 'no clip on the item');
  assert.ok(Math.abs(worn.min.z - b.min.z) < 1e-6, 'nothing else added worn');
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
  setStage(f, 0); const h0 = visibleBox(f.group).max.y;
  setStage(f, 1);
  assert.ok(visibleBox(f.group).max.y > h0 + 0.015, 'the lift valve\'s wheel over the top endcap');
});
