import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TempleKit, templeMaterials } from '../src/temples/kit.js';
import { landmark, LANDMARK_SCALE } from '../src/temples/landmarks.js';
import { readFileSync, existsSync } from 'node:fs';
import { Veils } from '../src/veil.js';
import { EDENA_TEMPLE } from '../src/temples/edena.js';
import { PERDIDE2_TEMPLE } from '../src/temples/perdide2.js';
import { DESERT_TEMPLE } from '../src/temples/desert.js';
import { BURIED_TEMPLE } from '../src/temples/buried.js';
import { SPHERES_TEMPLE } from '../src/temples/spheres.js';

const picks = JSON.parse(readFileSync(new URL('../references/temples/landmarks-2026-10-14/manifest.json', import.meta.url)));
function build(id) {
  const root = new THREE.Group(), K = new TempleKit(root, id, new THREE.Vector3(), 0, templeMaterials({}));
  const top = landmark(K, id, { y: 4, R: id === 'garage' ? 7 : 15, bottom: 0 });
  K.flush(); root.updateMatrixWorld(true);
  return { root, top, drawn: K.group.children.filter(o => o.visible), solid: K.group.children.find(o => !o.visible) };
}
test('all fourteen selected temple references are preserved, with their original jobs', () => {
  assert.equal(picks.length, 14);
  assert.equal(new Set(picks.map(p => p.id)).size, 14);
  for (const p of picks) {
    assert.equal(p.provider, 'Midjourney'); assert.equal(p.selectedBy, 'user favourite');
    assert.match(p.job, /^https:\/\/www\.midjourney\.com\/jobs\/.+\?index=[0-3]$/);
    assert.ok(existsSync(new URL('../references/temples/landmarks-2026-10-14/' + p.file, import.meta.url)));
  }
});
test('landmark structures have finite geometry and matching climbable surfaces, with bounded geometry cost', () => {
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, 0, -1);
  for (const { id } of picks) {
    const { root, top, drawn, solid } = build(id);
    assert.ok(Number.isFinite(top) && top > 35, id);
    assert.ok(solid && !solid.userData.noClimb, `${id}: structural collision`);
    let triangles = 0;
    for (const m of drawn) {
      const p = m.geometry.attributes.position;
      triangles += p.count / 3;
      for (const value of p.array) assert.ok(Number.isFinite(value), `${id}: finite positions`);
    }
    assert.ok(triangles < 24000, `${id}: ${triangles} triangles`);
    // Stone, ceramic, metal, glazing and the painted trim stay separate; parts
    // of the same material still merge. The Aerie uses six distinct surfaces.
    assert.ok(drawn.length <= 6, `${id}: batched materials (${drawn.length})`);
    // Compare actual visible and collision surfaces from outside, including the open crowns.
    for (const x of [-18, -6, 0, 6, 18]) for (const y of [8, 24, 40, 56, 72]) {
      ray.set(new THREE.Vector3(x, y, 180), down);
      const a = ray.intersectObjects(drawn, false)[0], b = ray.intersectObject(solid, false)[0];
      if (a) assert.ok(b && Math.abs(a.distance - b.distance) < 0.5, `${id}: visible structure is solid at ${x},${y}`);
      else assert.ok(!b, `${id}: no invisible wall at ${x},${y}`);
    }
    root.traverse(o => o.geometry?.dispose());
  }
});

function exterior(def) {
  const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
  const level = { ground: { baseAt: () => 0, heightAt: () => 0 } };
  const rt = { root, M: templeMaterials(def.palette), veils: new Veils(), lights: [] };
  rt.outside = def.exterior(scene, level, rt);
  return { scene, level, rt };
}
test('Greenhouse windows reveal their interior and retain a depth-tested tint after batching', () => {
  const { rt } = exterior(EDENA_TEMPLE), K = rt.outside.kit;
  const windows = K.group.children.find(m => m.material === rt.outside.glassM);
  assert.equal(windows.material.uniforms.uGlass.value, 1);
  assert.ok(windows.material.uniforms.uGlassCenter.value.distanceTo(rt.outside.gardenFrame.world(0, rt.outside.sill + 20, 0)) < 1e-6, 'highlight center follows the kit’s baked world coordinates');
  assert.ok('S_GLASS' in windows.material.defines, 'the opaque body is discarded');
  assert.equal(windows.userData.noBatch, true, 'the wash keeps its visible source mesh');
  const wash = rt.veils.list.find(w => w.userData.of === windows);
  assert.ok(wash && wash.geometry === windows.geometry);
  assert.ok(wash.material.transparent && !wash.material.depthWrite);
  assert.ok(wash.material.uniforms.uWash.value.x > 0 && wash.material.uniforms.uWash.value.x < .4);
  assert.ok(rt.veils.show());
  K.group.visible = false; rt.veils.show();
  assert.equal(wash.visible, false, 'hidden temple leaves no floating wash');
});
test('Lamp-House has glass around a glowing pilot, then lights its full beacon when restored', () => {
  const { scene, level, rt } = exterior(PERDIDE2_TEMPLE), O = rt.outside;
  const change = PERDIDE2_TEMPLE.change(scene, level, rt);
  change.set(false, { instant: true }); change.update(1/60, 0);
  assert.equal(O.glassM.uniforms.uGlass.value, 1);
  assert.ok(O.glassWashes.length > 0);
  assert.ok(O.lampM.uniforms.uGlow.value >= .7, 'pilot remains self-lit at night');
  const light = rt.lights.at(-1), pilotRadius = light.w;
  assert.ok(pilotRadius > 0 && pilotRadius < 25);
  assert.equal(light.y, O.lamp.position.y);
  const pilot = O.lampM.uniforms.uColor.value.clone();
  change.set(true, { instant: true }); change.update(1/60, 0);
  assert.ok(O.lampM.uniforms.uGlow.value > .98);
  assert.ok(O.lampM.uniforms.uColor.value.g > pilot.g, 'full lamp warms towards white');
  assert.ok(light.w > O.lamp.position.y, 'the restored light reaches the water');
  change.set(false, { instant: true }); change.update(1/60, 0);
  assert.equal(light.w, pilotRadius, 'restoration can reset without a stuck floodlight');
});
test('the open belfry frames the bell without a wall across its sky opening', () => {
  const { drawn, solid } = build('arzach2');
  const ray = new THREE.Raycaster(new THREE.Vector3(3 * LANDMARK_SCALE.arzach2[0], 4 + 52 * LANDMARK_SCALE.arzach2[1], 100), new THREE.Vector3(0, 0, -1));
  assert.equal(ray.intersectObjects(drawn).length, 0);
  assert.equal(ray.intersectObject(solid).length, 0);
  ray.set(new THREE.Vector3(0, 4 + 32 * LANDMARK_SCALE.arzach2[1], 100), new THREE.Vector3(0, 0, -1));
  assert.ok(ray.intersectObjects(drawn).length > 0, 'the bell occupies the lower opening');
});

test('the widened Rose and Engine foundations leave the original thresholds and approaches open', () => {
  for (const def of [DESERT_TEMPLE, BURIED_TEMPLE]) {
    const { scene, rt } = exterior(def), O = rt.outside;
    scene.updateMatrixWorld(true);
    const solids = O.kit.group.children.filter(m => !m.visible);
    const forward = new THREE.Vector3(Math.sin(O.door.heading), 0, Math.cos(O.door.heading));
    const d = O.door.at;
    const ray = new THREE.Raycaster(d.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, -1, 0));
    assert.ok(Math.abs(ray.intersectObjects(solids)[0].point.y - d.y) < .3, `${def.id}: threshold stays at its walking height`);
    ray.set(d.clone().addScaledVector(forward, 7).add(new THREE.Vector3(0, 1.7, 0)), forward.clone().negate());
    const hit = ray.intersectObjects(solids)[0];
    assert.ok(!hit || hit.distance > 6.7, `${def.id}: no foundation crosses the walk to the portal`);
  }
});

test('Rose House has exposed descending treads around every side of the plinth', () => {
  const {scene,rt}=exterior(DESERT_TEMPLE),O=rt.outside,K=O.kit;
  scene.updateMatrixWorld(true);
  const solids=K.group.children.filter(m=>!m.visible),ray=new THREE.Raycaster();
  const height=(x,z)=>{ray.set(K.world(x,100,z),new THREE.Vector3(0,-1,0));return ray.intersectObjects(solids)[0]?.point.y;};
  for(let i=0;i<8;i++){
    const a=(i+.2)*Math.PI/4;
    const inner=height(Math.sin(a)*43*1.3,Math.cos(a)*41);
    const outer=height(Math.sin(a)*50.8*1.3,Math.cos(a)*48.8);
    assert.ok(Number.isFinite(inner)&&Number.isFinite(outer),'continuous steps around the whole base');
    assert.ok(inner-outer>2,'the outer drum cannot hide the stair treads');
    assert.ok(outer>0&&inner<O.doorY,'steps rise out of the sand to the doorway');
  }
});

test('Engine pipes and Footprint roots extend beyond their central buildings, with solid drawn surfaces', () => {
  for(const def of [BURIED_TEMPLE,SPHERES_TEMPLE]){
    const {scene,rt}=exterior(def),O=rt.outside,K=O.kit;scene.updateMatrixWorld(true);
    const solids=K.group.children.filter(m=>!m.visible),drawn=K.group.children.filter(m=>m.visible);
    const points=def===BURIED_TEMPLE?[-1.25,-.8,.8,1.25].map(a=>[Math.sin(a)*(O.R+13)*1.25,Math.cos(a)*(O.R+13)]):[-65,-50,50,65].map(x=>[x,12]);
    for(const [x,z]of points){
      const ray=new THREE.Raycaster(K.world(x,100,z),new THREE.Vector3(0,-1,0));
      const a=ray.intersectObjects(solids)[0],b=ray.intersectObjects(drawn)[0];
      assert.ok(a&&b&&a.point.y>1,`${def.id}: substantial structure outside the old foundation at ${x},${z}`);
      assert.ok(Math.abs(a.distance-b.distance)<.05,'visible and climbable surfaces agree');
    }
  }
});
