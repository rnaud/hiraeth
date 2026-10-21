import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildShipModel } from '../src/ship/model.js';
import { Physics } from '../src/physics.js';
import { loadPlayableCaravan } from '../src/ship/caravan-asset.js';
import { ROOMS, STAIRS, deckAt, authoredToShip, HINGE_R, BOOSTER_CENTRES, SCIENTIST } from '../src/ship/caravan-layout.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
let template;
async function asset() {
  if (!template) {
    const b=readFileSync(new URL('../public/models/ships/caravan-a/playable.glb',import.meta.url));
    template=(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;
  }
  return template;
}
test('production loading fails explicitly, retries, and shares the parsed template between worlds',async()=>{
  await assert.rejects(loadPlayableCaravan('',{loader:{loadAsync:async()=>{throw new Error('missing GLB');}}}),/caravan could not be loaded: missing GLB/);
  let late;
  await assert.rejects(loadPlayableCaravan('',{timeoutMs:10,loader:{loadAsync:()=>new Promise(resolve=>{late=resolve;})}}),/ship download timed out/);
  let calls=0; const scene=await asset();
  const loader={loadAsync:async()=>{calls++;return {scene};}};
  const [a,b]=await Promise.all([loadPlayableCaravan('',{loader}),loadPlayableCaravan('',{loader})]);
  assert.equal(a,b);assert.equal(calls,1);
  late({scene:new THREE.Group()});
  await Promise.resolve();
  assert.equal(await loadPlayableCaravan('',{loader}),scene,'a late timed-out request cannot replace the successful retry');
});
test('actual authored entry and terrain-ramp edge agree with the playable metre contract',async()=>{
  const a=await asset(), spec=a.getObjectByName('hull').userData.playableContract;
  assert.equal(spec.scale,1.3);
  const entry=authoredToShip(V(...spec.entry)), hinge=authoredToShip(V(...spec.rampHinge));
  assert.ok(entry.distanceTo(V(-3.25,0,0))<1e-5);
  assert.ok(hinge.distanceTo(V(-HINGE_R,0,0))<1e-5);
  for(const booster of BOOSTER_CENTRES) assert.ok(a.getObjectByName(booster.name));
});
test('actual playable model has through entry, walking floors, and human headroom up the cockpit stairs',async()=>{
  const model=buildShipModel({caravan:await asset()});
  model.door.position.x-=1.9;
  const scene=new THREE.Scene();scene.add(model.group);
  const physics=new Physics(new THREE.Scene());
  physics.addCollider(model.group);
  for(const p of model.movingParts)physics.addMover(p);
  physics.syncMovers(1/60);
  assert.equal(physics.rayDistance(V(-2.1,1.3,0),V(-1,0,0),HINGE_R),Infinity,'entry is a real hole, not a painted door');
  for(const [name,r] of Object.entries(ROOMS)) {
    const z=name==='main'?-.5:(r.z0+r.z1)/2;
    const y=physics.groundAt(.5,r.floor+1,z,2);
    assert.ok(Math.abs(y-r.floor)<.15,`${name} has a walkable floor: ${y}`);
    assert.ok(physics.rayDistance(V(.5,r.floor+.05,z),V(0,1,0),2.1)>2,`${name} has standing headroom`);
  }
  const npc=V(...SCIENTIST.at), jar=V(...SCIENTIST.jar);
  assert.ok(npc.z>ROOMS.hold.z0 && npc.z<ROOMS.hold.z1);
  assert.ok(Math.abs(physics.groundAt(npc.x,.5,npc.z,1))<.03,'Anselm stands on the hold floor');
  assert.ok(physics.rayDistance(npc.clone().add(V(0,.05,0)),V(0,1,0),2.1)>2,'Anselm has standing headroom');
  assert.ok(Math.abs(physics.groundAt(jar.x,jar.y+.2,jar.z,.5)-jar.y)<.08,'jar rests on the hold crate');
  const visitor=npc.clone().add(V(Math.sin(SCIENTIST.heading),0,Math.cos(SCIENTIST.heading)).multiplyScalar(1.6));
  assert.ok(physics.rayDistance(visitor.clone().add(V(0,1.2,0)),npc.clone().sub(visitor).normalize(),1.6)===Infinity,'conversation faces him across a clear aisle');
  for(let i=0;i<STAIRS.steps;i++) {
    const z=STAIRS.z1-(i+.5)*(STAIRS.z1-STAIRS.z0)/STAIRS.steps, floor=deckAt(0,z);
    assert.ok(Math.abs(physics.groundAt(0,floor+.5,z,1)-floor)<.03,`stair ${i} floor follows walking collision`);
    assert.ok(physics.rayDistance(V(0,floor+.05,z),V(0,1,0),2.1)>2,`stair ${i} standing clearance`);
  }
});
test('rigid camp contents rise outside before retracting above the occupied living room',async()=>{
  const m=buildShipModel({caravan:await asset()});
  for(const name of ['porch-furniture','plants']) {
    const contents=m.authored.getObjectByName(name), lift=m.authored.getObjectByName(name+'-lift');
    assert.equal(lift.parent,contents);
    for(const camp of [1,.9,.82,.76,.7,.6,.55,0,.55,.7,.82,1]) {
      m.applyCamp(camp,0);m.group.updateMatrixWorld(true);
      assert.deepEqual(contents.scale.toArray(),[1,1,1]);assert.deepEqual(lift.scale.toArray(),[1,1,1]);
      const bounds=new THREE.Box3().setFromObject(contents);
      assert.ok(Number.isFinite(bounds.min.y));
      if(camp<=.7)assert.ok(bounds.min.y>3.3,`${name} clears living ceiling before inward movement: ${bounds.min.y}`);
    }
  }
});
test('parked/orbit copies own resources without mutating the parsed asset',async()=>{
  const a=await asset(), parked=buildShipModel({caravan:a}), orbit=buildShipModel({caravan:a,space:true});
  const first=root=>{let found;root.traverse(n=>{if(!found&&n.isMesh)found=n;});return found;};
  assert.notEqual(first(parked.authored).geometry,first(orbit.authored).geometry);
  assert.notEqual(first(parked.authored).geometry,first(a).geometry);
  assert.equal(first(parked.authored).material,first(orbit.authored).material,'immutable cached paint is shared');
  let disposed=0,paintDisposed=0,parkedDisposed=0;
  first(orbit.authored).geometry.addEventListener('dispose',()=>disposed++);
  first(parked.authored).geometry.addEventListener('dispose',()=>parkedDisposed++);
  const paint=first(orbit.authored).material;
  for(const m of Array.isArray(paint)?paint:[paint])m.addEventListener('dispose',()=>paintDisposed++);
  orbit.disposeAuthored();orbit.disposeAuthored();
  assert.equal(disposed,1);assert.equal(parkedDisposed,0);assert.equal(paintDisposed,0);
  parked.applyCamp(0,4);orbit.applyCamp(1,0);
  assert.notEqual(parked.authored.getObjectByName('porch-panel').rotation.x,orbit.authored.getObjectByName('porch-panel').rotation.x);
});
test('each authored landing foot adapts to terrain without moving its hull mount',async()=>{
  const terrain=p=>-4.68+.12*p.x-.025*p.z;
  const m=buildShipModel({caravan:await asset(),footY:terrain});m.group.updateMatrixWorld(true);
  let count=0;
  m.authored.traverse(n=>{
    const spec=n.userData.caravanFoot;if(!spec)return;count++;
    const local=V(spec.at[0],spec.at[1]+.8,spec.at[2]);
    const at=local.applyMatrix4(n.matrixWorld), expected=terrain(authoredToShip(V(...spec.at)));
    assert.ok(Math.abs(at.y-expected)<1e-5,`${n.name} reaches the local terrain: ${at.y} vs ${expected}`);
  });
  assert.equal(count,4);
});
test('normal walking traverses every stair in both directions and the real entry ramp',async()=>{
  const { Player }=await import('../src/player.js');
  const model=buildShipModel({caravan:await asset(),ramp:{dir:V(-1,-.45,0).normalize(),length:12}});
  model.door.position.x-=1.9;
  const scene=new THREE.Scene(), ground=new THREE.Mesh(new THREE.BoxGeometry(100,1,100),new THREE.MeshBasicMaterial());ground.position.y=-5.5;scene.add(ground);
  const physics=new Physics(scene);physics.addCollider(model.group);
  for(const part of model.movingParts)physics.addMover(part);
  const player=new Player(physics);player.opts.climb=false;
  const walk=(start,target,expectedY)=>{
    player.respawn(start);player.vel.set(0,0,0);
    let reached=false;
    for(let i=0;i<900;i++) {
      physics.syncMovers(1/60);
      const dx=target.x-player.pos.x,dz=target.z-player.pos.z;
      if(Math.hypot(dx,dz)<.2){reached=true;break;}
      player.update(1/60,{KeyW:true},Math.atan2(dx,dz)+Math.PI);
      assert.ok(Number.isFinite(player.pos.y));
    }
    assert.ok(reached,`walk reached ${target.toArray()} from ${start.toArray()}, stopped at ${player.pos.toArray()}`);
    assert.ok(Math.abs(player.pos.y-expectedY)<.25,`walking height ${player.pos.y}, expected ${expectedY}`);
  };
  walk(V(0,.05,-2.8),V(0,0,-13.0),ROOMS.cockpit.floor);
  walk(V(0,ROOMS.cockpit.floor+.05,-13),V(0,0,-2.8),0);
  walk(V(-2.1,.05,0),V(-22.2,0,0),-5);
  walk(V(-22.2,-4.95,0),V(-2.1,0,0),0);
});
test('the real seated cockpit eye sees through outward-facing glass rather than an opaque inside pane',async()=>{
  const m=buildShipModel({caravan:await asset()});m.group.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(V(.6,7,-17),V(0,0,-1),0,18);
  const hits=ray.intersectObject(m.authored,true);
  assert.equal(hits.length,0,`windshield sightline blocked by ${hits.map(h=>h.object.name).join(',')}`);
});
test('the playable directors close camp before lift-off and restore a usable landed ship after skip',async()=>{
  globalThis.window ??= {addEventListener(){}};
  const {Ship}=await import('../src/ship/ship.js');
  const {Player}=await import('../src/player.js');
  const {TakeoffDirector,ArrivalDirector}=await import('../src/ship/cinematics.js');
  const scene=new THREE.Scene();scene.add(new THREE.Mesh(new THREE.PlaneGeometry(400,400).rotateX(-Math.PI/2)));
  const physics=new Physics(scene),level={spawn:V(0,0,60),ground:{heightAt:()=>0},lights:[],shipSite:{x:0,z:0,heading:Math.PI/2}};
  const ship=new Ship({caravan:await asset(),scene,physics,level,levelId:'edena',content:{npcs:[],relics:{spots:[]}}});
  ship.player=new Player(physics);ship.rig={yaw:0,pitch:.2,target:V(0,0,0),indoor:false};ship.camera=new THREE.PerspectiveCamera();ship.sound={};ship.warp={start(){},update(){}};
  let done=false;const departure=new TakeoffDirector(ship,{to:'arzach',title:'Vael',onDone:()=>done=true});departure.start();
  let flew=false;
  for(let i=0;i<1500&&!done;i++){
    departure.update(1/60,false);
    if(ship.parked.group.position.y>ship.restPos.y+.01){flew=true;assert.equal(ship.parked.rampK,0);assert.equal(ship.parked.doorK,0);}
  }
  assert.ok(done&&flew);
  const arrival=new ArrivalDirector(ship);arrival.start();arrival.update(1,true);
  assert.ok(arrival.done);assert.ok(ship.parked.group.position.distanceTo(ship.restPos)<1e-8);
  assert.equal(ship.parked.rampK,1);assert.equal(ship.parked.doorK,1);
  for(const [anchor,method,other] of [['cockpit','atConsole','atTable'],['tableFoot','atTable','atConsole']]){
    ship.player.pos.copy(ship.world(ship.parked,ship.parked.interior.points[anchor]));
    assert.ok(ship[method](),`${anchor} can be used`);assert.ok(!ship[other](),`${anchor} does not steal the other interaction`);
  }
});

test('Pirates uses the packed production caravan and four flame mouths through the arena context', async()=>{
  const { default: pirates } = await import('../src/minigames/pirates.js');
  const { levelMetaFor } = await import('../src/minigames/kit/world.js');
  const scene=new THREE.Scene(), meta=levelMetaFor(pirates,()=>({id:'arena'}));
  const gen=meta.build(scene,{caravan:await asset()}); let step;
  do {step=gen.next();} while(!step.done);
  const p=step.value.pirates;
  assert.ok(p.model.authored,'the arena forwards the host asset to the ship builder');
  assert.equal(p.flames.children.length,4);assert.equal(p.fit.mouths.length,4);
  for(let i=0;i<4;i++) {
    const expected=BOOSTER_CENTRES[i].at.clone().sub(p.fit.mid).multiplyScalar(p.fit.scale);
    assert.ok(p.flames.children[i].position.distanceTo(expected)<1e-6);
  }
  assert.ok(p.model.authored.getObjectByName('porch-panel'));
  assert.equal(p.model.gearAltitude,4);
});

test('exhaust mouths agree with the actual GLB dark nozzle faces and fire rearward during the opening',async()=>{
  const raw=await asset();raw.updateMatrixWorld(true);
  const centres=BOOSTER_CENTRES.map(b=>{
    const box=new THREE.Box3();raw.getObjectByName(b.name).traverse(o=>{
      if(o.isMesh && o.material.name==='dark')box.union(new THREE.Box3().setFromObject(o));
    });
    assert.ok(!box.isEmpty(),`${b.name} has an actual dark exhaust face`);
    const c=authoredToShip(box.getCenter(V()));assert.ok(c.distanceTo(b.at)<.002,`${b.name} mouth matches exported face`);return c;
  });
  const {exhaust}=await import('../src/ship/exhaust.js');
  const {PrologueDirector}=await import('../src/ship/cinematics.js');
  const model=buildShipModel({caravan:raw}), emitted=[];
  const ship={jets:{items:[],emit:(p,v)=>emitted.push({p:p.clone(),v:v.clone()})},smoke:{emit(){}},restPos:V(0,10,0),cinema:{},shot(){}};
  const random=Math.random;Math.random=()=>.5;
  try{
    model.group.position.set(19,12,-30);model.group.rotation.set(.4,.7,1.1);model.group.scale.setScalar(1.2);
    exhaust(ship,model,.1,{power:.45});
    const check=()=>{
      assert.equal(emitted.length,4);const dir=V(0,0,1).applyQuaternion(model.group.quaternion);
      emitted.forEach((e,i)=>{const mouth=centres[i].clone().applyMatrix4(model.group.matrixWorld);const delta=e.p.clone().sub(mouth);assert.ok(delta.clone().cross(dir).length()<.001);assert.ok(delta.dot(dir)>.1&&delta.dot(dir)<.7);assert.ok(e.v.clone().normalize().distanceTo(dir)<1e-6);});
    };check();emitted.length=0;
    const director={s:ship,pk:model,sp:null,N:V(1,0,0),T:V(0,0,1),look:V(),bez:u=>V(u*30,20-u*10,u*50)};
    PrologueDirector.prototype.frame.call(director,'glide',4.8,.1);check();
  }finally{Math.random=random;}
});

test('Pirates trail starts at the rendered nozzle through yaw, pitch, full roll, parent transform and scale',async()=>{
  const {pirateTrailOrigin}=await import('../src/minigames/pirates.js');
  const {railPoint}=await import('../src/minigames/pirates-rules.js');
  const parent=new THREE.Group(),ship=new THREE.Group();parent.add(ship);parent.position.set(3,4,8);parent.rotation.y=.3;parent.scale.setScalar(1.2);
  ship.position.set(7,8,-140);ship.rotation.set(.4,-.7,2.1);ship.scale.setScalar(.8);
  for(const mouth of BOOSTER_CENTRES.map(b=>b.at.clone().multiplyScalar(.15))){
    const origin=pirateTrailOrigin(ship,mouth,140),world=railPoint(140+origin.ds,origin.u,origin.v,V());
    const anchor=new THREE.Object3D();ship.add(anchor);anchor.position.copy(mouth).add(V(0,0,.6));
    const expected=anchor.getWorldPosition(V());assert.ok(world.distanceTo(expected)<1e-6);ship.remove(anchor);
  }
});
