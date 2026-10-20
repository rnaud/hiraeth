import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCityLife, CITY_SCHOOLS } from '../src/levels/underwater-life.js';
import { fishSchool } from '../src/levels/underwater-kit.js';
import { Physics } from '../src/physics.js';
import { createUnderwater, DOMES, TUBES, seabed, SEA_Y } from '../src/levels/underwater.js';

function fixture() {
  const movers = [], group = new THREE.Group(), material = new THREE.MeshBasicMaterial();
  const kit = { group, noShadow: [], mover: (fn) => movers.push(fn), mat: () => material };
  return { kit, movers, material, M: { fish: material, manta: material } };
}
function inBuilding(p) {
  for (const d of Object.values(DOMES)) {
    if (p.y >= d.y - 1 && (p.x-d.x)**2 + (p.z-d.z)**2 + (Math.max(0,p.y-d.y)/d.sy)**2 < (d.r+0.5)**2) return true;
  }
  for (const tube of Object.values(TUBES)) {
    const a = new THREE.Vector3(...tube.a), b = new THREE.Vector3(...tube.b), delta = b.sub(a), t = p.clone().sub(a).dot(delta)/delta.lengthSq();
    if (t < 0 || t > 1) continue;
    const q = a.addScaledVector(delta,t);
    if (p.y > q.y-1 && (p.x-q.x)**2+(p.z-q.z)**2+Math.max(0,p.y-q.y)**2 < (tube.R+.5)**2) return true;
  }
  return false;
}

test('city fauna stays outside glass and above the bed through complete routes', () => {
  const {kit,movers,M}=fixture(), life=buildCityLife(kit,M);
  assert.equal(life.schools.reduce((sum,o)=>sum+o.count,0),960);
  assert.equal(life.mantas.length,4); assert.equal(life.whales.length,2);
  const p=new THREE.Vector3(), matrix=new THREE.Matrix4(), world=new THREE.Matrix4();
  for(let t=0;t<=600;t+=2) {
    for(const move of movers) move(t);
    kit.group.updateMatrixWorld(true);
    for(const root of [...life.schools,...life.mantas,...life.whales]) root.traverse(mesh=>{
      if(!mesh.isMesh) return;
      const positions=mesh.geometry.attributes.position;
      for(let instance=0;instance<(mesh.isInstancedMesh?mesh.count:1);instance++) {
        if(mesh.isInstancedMesh) { mesh.getMatrixAt(instance,matrix); world.multiplyMatrices(mesh.matrixWorld,matrix); }
        else world.copy(mesh.matrixWorld);
        // Every fish centre, every vertex of the large articulated animals.
        const count=mesh.isInstancedMesh?1:positions.count;
        for(let i=0;i<count;i++) {
          if(mesh.isInstancedMesh) p.set(0,0,0); else p.fromBufferAttribute(positions,i);
          p.applyMatrix4(world);
          assert.ok(!inBuilding(p),`${root.name} enters glass at t=${t}: ${p.toArray()}`);
          assert.ok(p.y>seabed(p.x,p.z)+.5,`${root.name} enters bed at t=${t}: ${p.toArray()}`);
          assert.ok(p.y<SEA_Y-1,'remains submerged');
        }
      }
    });
  }
});

test('school LOD resumes the current absolute phase and bounds contain every fish',()=>{
 const a=fixture(),b=fixture(), route=CITY_SCHOOLS[0];
 const A=fishSchool(a.kit,a.M,route),B=fishSchool(b.kit,b.M,route),viewer=new THREE.Vector3(...route.at),m=new THREE.Matrix4(),p=new THREE.Vector3();
 a.movers[0](10,viewer.clone().add(new THREE.Vector3(100,0,0)));assert.equal(A.count,22);
 a.movers[0](20,viewer.clone().add(new THREE.Vector3(200,0,0)));assert.equal(A.visible,false);
 a.movers[0](300,viewer);b.movers[0](300,viewer);assert.equal(A.visible,true);assert.equal(A.count,64);
 assert.deepEqual(A.instanceMatrix.array,B.instanceMatrix.array,'returning near does not resume a stale school phase');
 for(let t=0;t<100;t+=.7){a.movers[0](t,viewer);for(let i=0;i<A.count;i++){A.getMatrixAt(i,m);p.setFromMatrixPosition(m);assert.ok(A.boundingSphere.containsPoint(p));}}
 assert.equal(a.kit.group.children.length,1,'one instanced draw per school');
});


test('resident routes clear the actual towers, balconies and columns', () => {
  const scene = new THREE.Scene(), level = createUnderwater(scene);
  const physics = new Physics(scene, level.ground), p = new THREE.Vector3(), matrix = new THREE.Matrix4();
  for (let t = 0; t < 600; t += 4) {
    level.update(0, t, {});
    scene.updateMatrixWorld(true);
    for (const roots of Object.values(level.cityLife)) for (const root of roots) root.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const vertices = mesh.geometry.attributes.position;
      for (let i = 0; i < (mesh.isInstancedMesh ? mesh.count : vertices.count); i += mesh.isInstancedMesh ? 1 : 3) {
        if (mesh.isInstancedMesh) { mesh.getMatrixAt(i, matrix); p.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld); }
        else p.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld);
        const radius = mesh.isInstancedMesh ? matrix.getMaxScaleOnAxis() * .85 : .15;
        assert.ok(!physics.embedded(p) && physics.roomAt(p, radius) >= radius - .05,
          `${root.name} contacts a city structure at ${t}s: ${p.toArray()}`);
      }
    });
  }
});
